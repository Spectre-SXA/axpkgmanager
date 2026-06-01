#!/usr/bin/env node

const fs = require('fs/promises');
const fssync = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const readline = require('readline');
const { pipeline } = require('stream/promises');
const { Command } = require('commander');
const tar = require('tar');

const AX_ROOT = '/opt/ax';
const APP_ROOT = path.join(AX_ROOT, 'apps');
const REGISTRY_ROOT = path.join(AX_ROOT, 'registry');
const STATE_PATH = path.join(AX_ROOT, 'state.json');
const GLOBAL_BIN = '/usr/local/bin';
const DEFAULT_REGISTRY_URL = process.env.AX_REGISTRY_URL || 'https://raw.githubusercontent.com/Spectre-SXA/axpkgmanager/refs/heads/main/registry-data/packages.json';

function requireRoot() {
  if (typeof process.getuid === 'function' && process.getuid() !== 0) {
    console.error('ERROR: ax must be run with sudo or as root.');
    process.exit(1);
  }
}

async function ensureDirs() {
  await fs.mkdir(APP_ROOT, { recursive: true });
  await fs.mkdir(REGISTRY_ROOT, { recursive: true });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadState() {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { installed: {}, active: {}, registry: {} };
  }
}

async function saveState(state) {
  await ensureDirs();
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

async function downloadFile(url, destination) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const client = url.startsWith('https://') ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      const writer = fssync.createWriteStream(destination, { mode: 0o644 });
      response.pipe(writer);
      writer.on('finish', () => resolve());
      writer.on('error', reject);
    });

    request.on('error', reject);
  });
}

function normalizeChecksum(checksum) {
  if (!checksum) return checksum;
  return checksum.replace(/^sha256:/i, '').trim().toLowerCase();
}

async function computeSHA256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fssync.createReadStream(filePath);

    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function verifyFileChecksum(filePath, expectedChecksum) {
  const actual = await computeSHA256(filePath);
  if (actual !== normalizeChecksum(expectedChecksum)) {
    throw new Error(`Checksum verification failed for ${filePath}\n  expected=${expectedChecksum}\n  actual=${actual}`);
  }
}

async function parseChecksums(checksumFile) {
  const content = await fs.readFile(checksumFile, 'utf8');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [checksum, ...pathParts] = line.split(/\s+/);
      return { checksum, file: pathParts.join(' ') };
    });
}

async function loadRegistryFile() {
  const registryPath = path.join(REGISTRY_ROOT, 'packages.json');
  if (!(await fileExists(registryPath))) {
    return null;
  }
  const raw = await fs.readFile(registryPath, 'utf8');
  return JSON.parse(raw);
}

async function fetchRegistry(url = DEFAULT_REGISTRY_URL) {
  const destination = path.join(REGISTRY_ROOT, 'packages.json');
  await downloadFile(url, destination);
  const registry = await loadRegistryFile();
  return registry;
}

function parsePackageReference(reference) {
  const atIndex = reference.lastIndexOf('@');
  if (atIndex > 0 && !reference.startsWith('.') && !reference.startsWith('/')) {
    return { name: reference.slice(0, atIndex), version: reference.slice(atIndex + 1) };
  }
  return { name: reference, version: null };
}

function findPackageEntry(registry, name) {
  return registry?.packages?.find((pkg) => pkg.name === name) || null;
}

function pickVersion(entry, requested) {
  if (!entry) return null;
  if (requested) {
    return entry.versions.find((version) => version.version === requested) || null;
  }
  if (entry.latest) {
    const candidate = entry.versions.find((version) => version.version === entry.latest);
    if (candidate) return candidate;
  }
  return entry.versions[entry.versions.length - 1] || null;
}

async function extractPackage(archivePath, destination) {
  await fs.mkdir(destination, { recursive: true });
  await tar.extract({ file: archivePath, cwd: destination });
}

async function verifyInternalChecksums(packageRoot) {
  const checksumFile = path.join(packageRoot, 'checksums.sha256');
  if (!(await fileExists(checksumFile))) {
    throw new Error('Package is missing checksums.sha256');
  }
  const checksums = await parseChecksums(checksumFile);
  for (const entry of checksums) {
    const sourcePath = path.join(packageRoot, entry.file);
    if (!(await fileExists(sourcePath))) {
      throw new Error(`Missing file declared in checksums.sha256: ${entry.file}`);
    }
    await verifyFileChecksum(sourcePath, entry.checksum);
  }
}

async function updateGlobalLink(manifest, installPath) {
  const target = path.join(installPath, manifest.entry);
  const linkPath = path.join(GLOBAL_BIN, manifest.binary || path.basename(manifest.entry));

  if (!(await fileExists(target))) {
    throw new Error(`Package entry does not exist: ${manifest.entry}`);
  }

  const targetResolved = path.resolve(target);

  if (await fileExists(linkPath)) {
    const existingTarget = await fs.realpath(linkPath);
    if (existingTarget !== targetResolved) {
      throw new Error(
        `Binary conflict: ${linkPath} already points to ${existingTarget}. Remove the conflicting package or choose a different version.`
      );
    }
  }

  await fs.rm(linkPath, { force: true });
  await fs.symlink(targetResolved, linkPath);
  await fs.chmod(targetResolved, 0o755);
}

async function installPackageFromArchive(archivePath, sourceLabel) {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ax-install-'));

  try {
    await extractPackage(archivePath, temporaryRoot);

    const manifestPath = path.join(temporaryRoot, 'manifest.json');
    if (!(await fileExists(manifestPath))) {
      throw new Error('Package manifest.json is missing');
    }

    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    if (!manifest.name || !manifest.version) {
      throw new Error('manifest.json must include name and version');
    }
    if (!manifest.entry) {
      throw new Error('manifest.json must include entry');
    }

    await verifyInternalChecksums(temporaryRoot);

    const installPath = manifest.install_path || path.join(APP_ROOT, manifest.name, manifest.version);
    if (!installPath.startsWith(APP_ROOT)) {
      throw new Error('Package install_path must be inside /opt/ax/apps');
    }

    const finalPath = installPath;
    await fs.rm(finalPath, { recursive: true, force: true });
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.cp(temporaryRoot, finalPath, { recursive: true });

    // Fix permissions so package is readable by everyone
    await fs.chmod(finalPath, 0o755);
    const binPath = path.join(finalPath, 'bin');
    if (await fileExists(binPath)) {
      await fs.chmod(binPath, 0o755);
    }

    await updateGlobalLink(manifest, finalPath);

    const state = await loadState();
    state.installed[manifest.name] = state.installed[manifest.name] || { versions: {} };
    state.installed[manifest.name].versions[manifest.version] = {
      path: finalPath,
      entry: manifest.entry,
      binary: manifest.binary || path.basename(manifest.entry),
      installed_at: new Date().toISOString(),
      source: sourceLabel,
    };
    state.active[manifest.name] = manifest.version;
    await saveState(state);

    console.log(`Installed ${manifest.name}@${manifest.version} to ${finalPath}`);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function askConfirmation(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${prompt} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function loadManifestFromInstalled(name, version) {
  const state = await loadState();
  const record = state.installed[name]?.versions?.[version];
  if (!record) {
    throw new Error(`Package ${name}@${version} is not installed.`);
  }
  const manifestPath = path.join(record.path, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  return { manifest, record };
}

const program = new Command();
program.name('ax').description('AX package manager').version('0.1.0');

program
  .command('install <package>')
  .description('Install a package from the registry or from a local .axpkg archive')
  .action(async (packageRef) => {
    requireRoot();
    await ensureDirs();

    const isLocalPath = packageRef.endsWith('.axpkg') || packageRef.startsWith('./') || packageRef.startsWith('/') || packageRef.includes(path.sep);
    let installLabel = packageRef;

    if (isLocalPath) {
      const archivePath = path.resolve(packageRef);
      if (!(await fileExists(archivePath))) {
        console.error(`Local package not found: ${archivePath}`);
        process.exit(1);
      }
      console.log(`Installing local package from ${archivePath}`);
      const approved = await askConfirmation('Continue with local package installation?');
      if (!approved) {
        console.log('Installation aborted.');
        process.exit(0);
      }
      await installPackageFromArchive(archivePath, 'local');
      return;
    }

    const registry = await loadRegistryFile();
    if (!registry) {
      console.error('Local registry snapshot not found. Run `ax update` first.');
      process.exit(1);
    }

    const { name, version: requestedVersion } = parsePackageReference(packageRef);
    const entry = findPackageEntry(registry, name);
    if (!entry) {
      console.error(`Package not found in registry: ${name}`);
      process.exit(1);
    }

    const versionEntry = pickVersion(entry, requestedVersion);
    if (!versionEntry) {
      console.error(`Version not found for ${name}${requestedVersion ? `@${requestedVersion}` : ''}`);
      process.exit(1);
    }

    const checksum = normalizeChecksum(versionEntry.checksum);
    const archiveFile = path.join(os.tmpdir(), `ax-${name}-${versionEntry.version}.axpkg`);

    console.log(`Preparing to install ${name}@${versionEntry.version}`);
    if (entry.versions && entry.versions.length > 0) {
      console.log(`Registry source: ${versionEntry.url}`);
    }
    if (versionEntry.architectures) {
      console.log(`Supported architectures: ${versionEntry.architectures.join(', ')}`);
    }

    if (versionEntry.dependencies && Object.keys(versionEntry.dependencies).length > 0) {
      console.log('Dependencies:');
      for (const [depName, depConstraint] of Object.entries(versionEntry.dependencies || {})) {
        console.log(`  - ${depName} ${depConstraint}`);
      }
    }

    const approved = await askConfirmation('Continue with installation?');
    if (!approved) {
      console.log('Installation aborted.');
      process.exit(0);
    }

    await downloadFile(versionEntry.url, archiveFile);
    await verifyFileChecksum(archiveFile, checksum);
    await installPackageFromArchive(archiveFile, versionEntry.url);
  });

program
  .command('remove <package>')
  .description('Remove an installed package or package version')
  .action(async (packageRef) => {
    requireRoot();
    await ensureDirs();

    const { name, version } = parsePackageReference(packageRef);
    const state = await loadState();
    const entry = state.installed[name];
    if (!entry) {
      console.error(`Package not installed: ${name}`);
      process.exit(1);
    }

    const selectedVersion = version || Object.keys(entry.versions)[0];
    if (!selectedVersion) {
      console.error(`No version found for installed package: ${name}`);
      process.exit(1);
    }

    if (!version && Object.keys(entry.versions).length > 1) {
      console.error(`Multiple versions installed for ${name}. Use ${name}@<version> to remove a specific version.`);
      process.exit(1);
    }

    const record = entry.versions[selectedVersion];
    if (!record) {
      console.error(`Installed version not found: ${name}@${selectedVersion}`);
      process.exit(1);
    }

    if (await fileExists(path.join(record.path, 'manifest.json'))) {
      const manifest = JSON.parse(await fs.readFile(path.join(record.path, 'manifest.json'), 'utf8'));
      const linkPath = path.join(GLOBAL_BIN, manifest.binary || path.basename(manifest.entry));
      if (await fileExists(linkPath)) {
        const existingTarget = await fs.realpath(linkPath);
        const expectedTarget = path.resolve(record.path, manifest.entry);
        if (existingTarget === expectedTarget) {
          await fs.rm(linkPath, { force: true });
        }
      }
    }

    await fs.rm(record.path, { recursive: true, force: true });
    delete state.installed[name].versions[selectedVersion];
    if (Object.keys(state.installed[name].versions).length === 0) {
      delete state.installed[name];
      delete state.active[name];
    } else if (state.active[name] === selectedVersion) {
      const remaining = Object.keys(state.installed[name].versions).sort();
      state.active[name] = remaining[remaining.length - 1];
      const activeRecord = state.installed[name].versions[state.active[name]];
      const manifest = JSON.parse(await fs.readFile(path.join(activeRecord.path, 'manifest.json'), 'utf8'));
      await updateGlobalLink(manifest, activeRecord.path);
    }

    await saveState(state);
    console.log(`Removed ${name}@${selectedVersion}`);
  });

program
  .command('update')
  .description('Pull the latest registry snapshot from the configured server')
  .option('--check', 'Compare installed packages against registry latest versions after update')
  .action(async (options) => {
    requireRoot();
    await ensureDirs();

    try {
      const registry = await fetchRegistry();
      const state = await loadState();
      state.registry = { updated_at: new Date().toISOString(), source: DEFAULT_REGISTRY_URL };
      await saveState(state);
      console.log('Registry snapshot updated.');

      if (options.check) {
        const installed = Object.entries(state.installed || {});
        for (const [name, packageRecord] of installed) {
          const registryEntry = findPackageEntry(registry, name);
          if (!registryEntry) {
            console.log(`Installed package ${name} is not present in registry.`);
            continue;
          }
          const latest = registryEntry.latest || registryEntry.versions.slice(-1)[0]?.version;
          const activeVersion = state.active[name];
          if (latest && activeVersion && latest !== activeVersion) {
            console.log(`${name}: installed ${activeVersion}, latest ${latest}`);
          }
        }
      }
    } catch (error) {
      console.error(`Registry update failed: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('search <query>')
  .description('Search the local registry cache for matching packages')
  .action(async (query) => {
    requireRoot();
    await ensureDirs();
    const registry = await loadRegistryFile();
    if (!registry) {
      console.error('Local registry snapshot not found. Run `ax update` first.');
      process.exit(1);
    }

    const matches = registry.packages.filter((pkg) => pkg.name.includes(query) || (pkg.description || '').includes(query));
    if (matches.length === 0) {
      console.log('No matching packages found.');
      return;
    }

    for (const pkg of matches) {
      console.log(`${pkg.name}@${pkg.latest || pkg.versions.slice(-1)[0]?.version}`);
      if (pkg.description) {
        console.log(`  ${pkg.description}`);
      }
      console.log(`  architectures: ${(pkg.versions?.[0]?.architectures || []).join(', ')}`);
    }
  });

program
  .command('list')
  .description('List installed packages and active versions')
  .action(async () => {
    requireRoot();
    await ensureDirs();
    const state = await loadState();
    const installed = Object.entries(state.installed || {});
    if (installed.length === 0) {
      console.log('No packages installed.');
      return;
    }

    for (const [name, packageRecord] of installed) {
      console.log(name);
      const active = state.active[name];
      for (const [version, record] of Object.entries(packageRecord.versions)) {
        const marker = version === active ? '*' : ' ';
        console.log(`  ${marker} ${version} -> ${record.path}`);
      }
    }
  });

program
  .command('use <package>')
  .description('Activate a specific installed package version globally')
  .action(async (packageRef) => {
    requireRoot();
    await ensureDirs();
    const { name, version } = parsePackageReference(packageRef);
    if (!version) {
      console.error('Specify a version with package@version.');
      process.exit(1);
    }

    const state = await loadState();
    const entry = state.installed[name];
    if (!entry || !entry.versions[version]) {
      console.error(`Package not installed: ${name}@${version}`);
      process.exit(1);
    }

    const record = entry.versions[version];
    const manifest = JSON.parse(await fs.readFile(path.join(record.path, 'manifest.json'), 'utf8'));
    await updateGlobalLink(manifest, record.path);

    state.active[name] = version;
    await saveState(state);
    console.log(`Now using ${name}@${version}`);
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error.message);
  process.exit(1);
});
