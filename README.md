# AX Package Manager

A lightweight cross-distro Linux package manager with its own universal package format (`.axpkg`). Works on Ubuntu, Fedora, Arch, and any Linux distribution.

## One-Command Installation

```bash
curl https://tempdomain/install.sh | sudo bash
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
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Deploy AX for your users
- **[FEDORA_INSTALL.md](./FEDORA_INSTALL.md)** — Fedora setup for developers
- **[AX_Design.md](./AX_Design.md)** — Full system architecture and `.axpkg` specification

---

## For Package Developers & Maintainers

### Building Packages

To create a new `.axpkg` package, see [AX_Design.md](./AX_Design.md) for the specification.

Example: Build a sample package

```bash
npm run build-sample-package
```

This creates an `.axpkg` archive in `registry-data/packages/`.

### Running the Registry Server

The registry server hosts packages for end users.

**Start in foreground:**

```bash
npm run start-registry
```

The server listens on `http://localhost:8080` and serves:
- `/packages.json` — registry metadata
- `/packages/<name>.axpkg` — package archives

**Run as a background systemd service:**

See [FEDORA_INSTALL.md](./FEDORA_INSTALL.md) for complete systemd setup instructions.

### Deployment

To deploy AX for your users:

1. **Host the installer script:**
   - Upload `install.sh` to your server
   - Update the `CLI_URL` in the script to point to your `cli.js`
   - Users run: `curl https://your-domain/install.sh | sudo bash`

2. **Host the CLI:**
   - Upload `cli.js` to a web server (e.g., `https://your-domain/cli.js`)

3. **Run the registry server:**
   - Use `npm run start-registry` to serve packages
   - Ensure the registry is accessible at the URL you configured in `install.sh`

### Architecture

- **Client:** Users install the lightweight AX CLI via one-liner
- **Registry:** You host packages and metadata on your server
- **Packages:** Universal `.axpkg` format works on all Linux distributions

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

See [QUICKSTART.md](./QUICKSTART.md) or [AX_Design.md](./AX_Design.md) for more information.

### Building Packages

To create a new `.axpkg` package, see [AX_Design.md](./AX_Design.md) for the specification.

Example: Build a sample package

```bash
npm run build-sample-package
```

This creates an `.axpkg` archive in `registry-data/packages/`.

### Project Structure

```
/home/spectre/axpkgmanager/
├── cli.js                 # AX CLI tool
├── server.js              # Registry server
├── install.sh             # One-liner installer for end users
├── package.json           # npm project metadata
├── README.md              # This file
├── QUICKSTART.md          # User quick start guide
├── AX_Design.md           # System design document
├── registry-data/         # Registry and packages
│   ├── packages.json      # Registry metadata snapshot
│   └── packages/          # .axpkg archives
└── scripts/
    └── build-sample-package.js  # Package builder
```
