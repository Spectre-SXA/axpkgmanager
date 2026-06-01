#!/bin/bash
# AX Package Manager - Installation Script
# Usage: curl https://tempdomain/install.sh | sudo bash

set -e

# Configuration - Update these for your deployment
REGISTRY_URL="${AX_REGISTRY_URL:-http://localhost:8080/packages.json}"
CLI_URL="${AX_CLI_URL:-https://your-domain/cli.js}"

# Installation paths
INSTALL_DIR="/opt/ax/cli"
BIN_PATH="/usr/local/bin/ax"

echo "🚀 Installing AX Package Manager CLI..."

# Create installation directories
mkdir -p "$INSTALL_DIR"
mkdir -p /opt/ax/apps
mkdir -p /opt/ax/registry

# Download CLI
echo "📥 Downloading CLI from $CLI_URL..."
if command -v curl &> /dev/null; then
  curl -fsSL "$CLI_URL" -o "$INSTALL_DIR/cli.js" 2>/dev/null || {
    echo "❌ Failed to download CLI"
    exit 1
  }
elif command -v wget &> /dev/null; then
  wget -qO "$INSTALL_DIR/cli.js" "$CLI_URL" || {
    echo "❌ Failed to download CLI"
    exit 1
  }
else
  echo "❌ Error: curl or wget required"
  exit 1
fi

# Make CLI executable
chmod +x "$INSTALL_DIR/cli.js"

# Create wrapper script
cat > "$BIN_PATH" <<'WRAPPER'
#!/bin/bash
export AX_REGISTRY_URL="__REGISTRY_URL__"
exec /usr/bin/node /opt/ax/cli/cli.js "$@"
WRAPPER

sed -i "s|__REGISTRY_URL__|$REGISTRY_URL|g" "$BIN_PATH"
chmod +x "$BIN_PATH"

# Fix permissions
chmod 755 /opt/ax
chmod 755 /opt/ax/apps
chmod 755 /opt/ax/registry

echo "✅ Installation complete!"
echo ""
echo "Registry: $REGISTRY_URL"
echo ""
echo "Quick start:"
echo "  sudo ax update         # Fetch packages"
echo "  sudo ax search NAME    # Search for packages"
echo "  sudo ax install NAME   # Install a package"
echo "  sudo ax list           # List installed packages"
