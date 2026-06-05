#!/usr/bin/env bash
# =============================================================================
# Play in MPV — Native Messaging Host Installer
# =============================================================================
# Usage:
#   ./install.sh <EXTENSION_ID>
#
# The extension ID is shown on chrome://extensions after loading the unpacked
# extension. Example:
#   ./install.sh abcdefghijklmnopqrstuvwxyzabcdef
# =============================================================================

set -euo pipefail

EXTENSION_ID="${1:-}"

if [[ -z "$EXTENSION_ID" ]]; then
  echo "Usage: $0 <EXTENSION_ID>"
  echo ""
  echo "Find your extension ID at chrome://extensions after loading the"
  echo "unpacked extension folder."
  exit 1
fi

# ---------------------------------------------------------------------------
# Resolve paths
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_SCRIPT="$SCRIPT_DIR/host.py"
MANIFEST_TEMPLATE="$SCRIPT_DIR/com.playinmpv.host.json"

if [[ ! -f "$HOST_SCRIPT" ]]; then
  echo "ERROR: host.py not found at $HOST_SCRIPT"
  exit 1
fi

# Make the host script executable
chmod +x "$HOST_SCRIPT"

# ---------------------------------------------------------------------------
# Detect browser and target directory
# ---------------------------------------------------------------------------
detect_nm_dir() {
  local browser_dirs=(
    "$HOME/.config/google-chrome/NativeMessagingHosts"
    "$HOME/.config/chromium/NativeMessagingHosts"
    "$HOME/.config/google-chrome-beta/NativeMessagingHosts"
    "$HOME/.config/google-chrome-unstable/NativeMessagingHosts"
    "$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
    "$HOME/.config/BraveSoftware/Brave-Browser-Beta/NativeMessagingHosts"
    "$HOME/.config/BraveSoftware/Brave-Browser-Nightly/NativeMessagingHosts"
    "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"          # macOS
    "$HOME/Library/Application Support/Chromium/NativeMessagingHosts"               # macOS
    "$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"  # macOS
  )

  for dir in "${browser_dirs[@]}"; do
    # Install to all that have an existing parent config directory
    parent="$(dirname "$dir")"
    if [[ -d "$parent" ]]; then
      echo "$dir"
    fi
  done
}

INSTALL_DIRS=()
while IFS= read -r dir; do
  INSTALL_DIRS+=("$dir")
done < <(detect_nm_dir)

if [[ ${#INSTALL_DIRS[@]} -eq 0 ]]; then
  echo "ERROR: No Chrome/Chromium configuration directory found."
  echo "Please create the NativeMessagingHosts directory manually."
  exit 1
fi

# ---------------------------------------------------------------------------
# Generate the manifest from the template
# ---------------------------------------------------------------------------
MANIFEST_JSON=$(sed \
  -e "s|__HOST_PATH__|$HOST_SCRIPT|g" \
  -e "s|__EXTENSION_ID__|$EXTENSION_ID|g" \
  "$MANIFEST_TEMPLATE")

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------
for dir in "${INSTALL_DIRS[@]}"; do
  mkdir -p "$dir"
  echo "$MANIFEST_JSON" > "$dir/com.playinmpv.host.json"
  echo "Installed → $dir/com.playinmpv.host.json"
done

echo ""
echo "✅  Native messaging host installed successfully."
echo "   Extension ID : $EXTENSION_ID"
echo "   Host script  : $HOST_SCRIPT"
echo ""
echo "Reload the extension at chrome://extensions if it was already loaded."
