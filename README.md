# AX Package Manager

A lightweight cross-distro Linux package manager with its own universal package format (`.axpkg`). Works on Ubuntu, Fedora, Arch, and any Linux distribution that supports symlinks.

## One-Command Installation

```bash
curl https://raw.githubusercontent.com/Spectre-SXA/axpkgmanager/refs/heads/main/install.sh | sudo bash
```

That's it! You're ready to use `ax`.

## Quick Start

```bash
sudo ax update              # Fetch registry
sudo ax search axfetch    # Search for packages
sudo ax install axfetch   # Install a package
axfetch                   # Run it!
```

## Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** — User quick start guide
- **[README.md](./README.md)** - Current documentation file.

---

## For Package Developers & Maintainers

### Building Packages

To create a new `.axpkg` package, see [AX_Design.md](./AX_Design.md) for the specification.

Example: Build a sample package

```bash
npm run build-sample-package
```

This creates an `.axpkg` archive in `registry-data/packages/`.
-
## System Details

### Installation Paths

- Packages: `/opt/ax/apps/<name>/<version>/`
- CLI: `/opt/ax/cli/cli.js`
- Registry cache: `/opt/ax/registry/packages.json`
- Installation state: `/opt/ax/state.json`
- Global symlink: `/usr/local/bin/ax`

### Package Format

Each `.axpkg` is a gzip-compressed tar archive containing:

```
manifest.json          # Package metadata
checksums.sha256       # SHA256 hashes for verification
bin/                   # Executable files
lib/                   # Optional libraries
install.sh             # Optional install hook
uninstall.sh           # Optional uninstall hook
```

### Security

- All packages are verified using SHA256 checksums
- Internal payload checksums are validated after extraction
- Installation uses atomic operations and temporary directories
- Corrupted or tampered packages are rejected immediately
- Failed installs automatically roll back without leaving partial files

### CLI Commands

All commands require `sudo`:

| Command | Description |
|---------|-------------|
| `sudo ax update` | Fetch latest registry snapshot |
| `sudo ax search <name>` | Search for packages |
| `sudo ax install <package>` | Install a package |
| `sudo ax list` | List installed packages |
| `sudo ax remove <package>` | Remove a package |
| `sudo ax use <pkg>@<version>` | Switch active version |

### Notes

- **All `ax` commands require root privileges** and must be run via `sudo`.
- Installed packages are stored under `/opt/ax/apps/` (requires write access to `/opt`).
- Installed binaries are symlinked to `/usr/local/bin/`.
- Multiple versions of the same package can be installed simultaneously.
- Use `ax use` to switch between installed versions.

## Support

Message @spectre.cmd on discord for support!

### Building Packages

To create a new `.axpkg` package, see [AXPKG_Documentation.md](./AXPKG_Documentation) for the specification.

Example: Build a sample package

```bash
npm run build-sample-package
```

This creates an `.axpkg` archive in `registry-data/packages/`.

For more info on .axpkg files, see [AXPKG_Documentation.md](./AXPKG_Documentation) for their structure and more.
