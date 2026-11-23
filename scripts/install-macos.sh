#!/usr/bin/env bash
set -e

echo "Setting up AE Bridge for Adobe After Effects on macOS..."

# 1. Set PlayerDebugMode for CSXS 10 - 13
for ver in 10 11 12 13; do
    defaults write "com.adobe.CSXS.${ver}" PlayerDebugMode 1
    echo "Set PlayerDebugMode = 1 for CSXS.${ver}"
done

# 2. Check and fetch CSInterface.js if missing
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DIR/.." && pwd)"
CS_INTERFACE="$REPO_ROOT/cep-panel/lib/CSInterface.js"

if [ ! -f "$CS_INTERFACE" ]; then
    echo "CSInterface.js missing. Running fetch-deps.sh..."
    bash "$DIR/fetch-deps.sh"
else
    echo "CSInterface.js found in cep-panel/lib/"
fi

# 3. Create symlink in CEP extensions directory
CEP_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"
mkdir -p "$CEP_DIR"

TARGET_LINK="$CEP_DIR/com.aebridge"
SOURCE_PANEL="$REPO_ROOT/cep-panel"

if [ -L "$TARGET_LINK" ] || [ -d "$TARGET_LINK" ]; then
    echo "Removing existing extension at $TARGET_LINK..."
    rm -rf "$TARGET_LINK"
fi

ln -s "$SOURCE_PANEL" "$TARGET_LINK"
echo "Successfully created symlink: $TARGET_LINK -> $SOURCE_PANEL"

echo ""
echo "AE Bridge installed successfully!"
echo "Restart After Effects and open: Window > Extensions > AE Bridge"
