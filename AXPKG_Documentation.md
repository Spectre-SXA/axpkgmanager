# AX Package Documentation

This document explains the AX package format (`.axpkg`) for end users and package developers.
It covers package structure, manifest fields, checksum validation, and publishing guidance.

## What is an `.axpkg`?

An `.axpkg` is a portable archive containing everything needed to install, run, and verify an AX package.
AX packages are designed to work across Linux distributions without relying on native package managers.

Each `.axpkg` archive includes:

- `manifest.json` — package metadata and install instructions
- `checksums.sha256` — SHA256 checksums for package contents
- `bin/` — executable files
- optional files such as `lib/`, `install.sh`, `uninstall.sh`, or packaged assets

## Package structure

A valid AX package archive must contain:

```
manifest.json
checksums.sha256
bin/
```

Optional layout examples:

```
bin/
  myapp
lib/
  helper.so
install.sh
uninstall.sh
README.md
```

## `manifest.json`

The package manifest is the core package descriptor. It must be valid JSON.

### Required fields

- `name`: Unique package identifier.
- `version`: Package version string.
- `author`: Package author or maintainer.
- `entry`: Relative path to the main executable inside the package.
- `binary`: The global command name that will be symlinked into `/usr/local/bin`.
- `dependencies`: Object mapping package names to version constraints.
- `install_path`: Absolute path where the package will be installed.
- `supported_architectures`: Array of architectures, e.g. `["x86_64"]`.

### Recommended metadata

- `first_created`: ISO timestamp when the package was first published.
- `last_updated`: ISO timestamp when the package was last changed.
- `description`: Short package description.

### Example manifest

```json
{
  "name": "myapp",
  "version": "1.0.0",
  "author": "AX Developer",
  "description": "A useful example AX package.",
  "entry": "bin/myapp",
  "binary": "myapp",
  "dependencies": {
    "libfoo": ">=1.2.0"
  },
  "install_path": "/opt/ax/apps/myapp/1.0.0",
  "supported_architectures": ["x86_64"],
  "first_created": "2026-06-01T00:00:00Z",
  "last_updated": "2026-06-01T00:00:00Z"
}
```

## `checksums.sha256`

This file verifies package content integrity after extraction.
Each line contains a SHA256 checksum and a relative file path.

Example:

```
3b6d5f8d9b7b6d2fa1a2a0f9f6c4d3b2f1e0d9c8b7a6f5e4d3c2b1a0e9f8d7c  manifest.json
29c8d6b4a9c7d1e2f3b4c5d6e7f8091a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e  bin/myapp
```

The AX CLI verifies every entry in `checksums.sha256` before install.

## Packaging rules

- The package must be a gzip-compressed tar archive (`.axpkg`).
- All required files must exist inside the archive.
- `manifest.json` must be valid JSON and include required fields.
- `checksums.sha256` must reference every file that is part of the package payload.
- The `install_path` must be under `/opt/ax/apps/` for AX installs.
- Executables in `bin/` should be marked executable.

## Building an `.axpkg`

A package can be built manually or with a script. The steps are:

1. Create a package root directory.
2. Write `manifest.json`.
3. Add package files and executables under `bin/` and optional directories.
4. Generate `checksums.sha256` for each file.
5. Create a `.axpkg` archive.

### Manual build example

```bash
mkdir -p myapp-1.0.0/bin
cp myapp myapp-1.0.0/bin/
cat > myapp-1.0.0/manifest.json <<'EOF'
{
  "name": "myapp",
  "version": "1.0.0",
  "author": "AX Developer",
  "entry": "bin/myapp",
  "binary": "myapp",
  "dependencies": {},
  "install_path": "/opt/ax/apps/myapp/1.0.0",
  "supported_architectures": ["x86_64"]
}
EOF
cd myapp-1.0.0
sha256sum manifest.json bin/myapp > checksums.sha256
cd ..
tar -czf myapp-1.0.0.axpkg -C myapp-1.0.0 manifest.json checksums.sha256 bin
```

## Publishing packages

To publish an AX package, you must:

1. Upload the `.axpkg` file to a public host.
2. Add package metadata to the registry `packages.json`.
3. Ensure the `url` in `packages.json` points to the hosted `.axpkg`.
4. Make `packages.json` publicly accessible via the registry URL.

### Registry entry example

```json
{
  "name": "myapp",
  "description": "A useful example AX package",
  "latest": "1.0.0",
  "versions": [
    {
      "version": "1.0.0",
      "url": "https://example.com/packages/myapp-1.0.0.axpkg",
      "checksum": "sha256:...",
      "architectures": ["x86_64"],
      "size": 1234,
      "published_at": "2026-06-01T00:00:00Z"
    }
  ]
}
```

## Naming and versioning

- Use a consistent package name that is unique within the registry.
- Follow semantic versioning where possible.
- Add new package versions by appending to the package's `versions` array and updating `latest`.

## Best practices for developers

- Keep package manifests small and clear.
- Provide a useful `description` for registry browsing.
- Use stable URLs for hosted `.axpkg` archives.
- Verify checksums after package creation.
- Test install and removal on a clean environment.

## Developer tooling

If you are using the repository tooling, the package builder script can help automate packaging.

Example:

```bash
npm run build-sample-package
```

That script builds a sample `.axpkg` archive from the repository sample package data.

## Troubleshooting

- If install fails, verify `checksums.sha256` matches package contents.
- Make sure `manifest.json` includes the correct `entry` path.
- Ensure the `install_path` is under `/opt/ax/apps/`.
- Confirm the registry URL points to a valid `packages.json` file.

## Security notes

- AX verifies package integrity using SHA256 checksums.
- Use HTTPS for package hosting and registry URLs.
- Treat the registry file as the source of truth for package metadata.

## Useful links

- `README.md` — project overview
- `AX_Design.md` — system architecture and package format design
- `DEPLOYMENT.md` — how to host the registry and deploy AX
- `QUICKSTART.md` — user quick start guide
