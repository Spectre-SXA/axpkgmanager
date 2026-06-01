# AX Package Manager - Quick Start

One-command installation for any Linux distribution.

## Installation

```bash
curl https://your-domain/install.sh | sudo bash
```

Or with wget:

```bash
wget -qO- https://your-domain/install.sh | sudo bash
```

That's it! The AX CLI is now installed and ready to use.

## Usage

After installation, you can immediately start installing packages:

```bash
# Update the registry
sudo ax update

# Search for packages
sudo ax search axfetch

# Install a package
sudo ax install axfetch

# Run the installed package
axfetch

# List installed packages
sudo ax list

# Remove a package
sudo ax remove fastfetch
```

## Custom Registry

By default, the installer points to our hosted registry at `http://localhost:8080/packages.json`. 

To use a different registry, set the environment variable before running the installer:

```bash
export AX_REGISTRY_URL=https://registry.example.com/packages.json
curl https://your-domain/install.sh | sudo bash
```

Or modify `/usr/local/bin/ax` directly:

```bash
export AX_REGISTRY_URL=https://registry.example.com/packages.json
```

## What Gets Installed

- `/opt/ax/cli/cli.js` — AX CLI tool
- `/usr/local/bin/ax` — Global command symlink
- `/opt/ax/apps/` — Installation directory for packages
- `/opt/ax/registry/` — Registry cache

## Commands

| Command | Description |
|---------|-------------|
| `sudo ax update` | Fetch latest registry snapshot |
| `sudo ax search <name>` | Search for packages |
| `sudo ax install <package>` | Install a package |
| `sudo ax list` | List installed packages |
| `sudo ax remove <package>` | Remove a package |
| `sudo ax use <pkg>@<version>` | Switch active version |

## Requirements

- Linux system (Ubuntu, Fedora, Arch, etc.)
- `sudo` access
- `curl` or `wget`
- `node` and `npm` (installed automatically if missing)

## Notes

- All `ax` commands must be run with `sudo`
- Packages are installed to `/opt/ax/apps/`
- Global symlinks are created in `/usr/local/bin/`
- The registry service is hosted by us, not on your machine
