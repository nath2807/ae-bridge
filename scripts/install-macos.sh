#!/usr/bin/env bash
set -e

echo "Setting up AE Bridge for Adobe After Effects on macOS..."

# 1. Set PlayerDebugMode for CSXS 10 - 13
for ver in 10 11 12 13; do
    defaults write "com.adobe.CSXS.${ver}" PlayerDebugMode 1
    echo "Set PlayerDebugMode = 1 for CSXS.${ver}"
done

# Flush cfprefsd preferences daemon
killall cfprefsd 2>/dev/null || true

# 2. Check and fetch CSInterface.js if missing or corrupt
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$DIR/.." && pwd)"
CS_INTERFACE="$REPO_ROOT/cep-panel/lib/CSInterface.js"
EXPECTED_HASH="d940cbc991553b4885d1b3b04d99c17f448041a738a12cc0b24ce688ace2d263"

NEEDS_FETCH=true
if [ -f "$CS_INTERFACE" ]; then
    CURRENT_HASH=$(shasum -a 256 "$CS_INTERFACE" 2>/dev/null | awk '{print $1}' || sha256sum "$CS_INTERFACE" 2>/dev/null | awk '{print $1}')
    if [ "$CURRENT_HASH" = "$EXPECTED_HASH" ]; then
        NEEDS_FETCH=false
        echo "CSInterface.js verified present and intact in cep-panel/lib/"
    fi
fi

if [ "$NEEDS_FETCH" = true ]; then
    echo "CSInterface.js missing or hash mismatched. Running fetch-deps.sh..."
    bash "$DIR/fetch-deps.sh"
fi

# 3. Create symlink in CEP extensions directory
CEP_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions"
mkdir -p "$CEP_DIR"

# Migration: Clean legacy extension link if present
LEGACY_LINK="$CEP_DIR/ae-bridge"
if [ -L "$LEGACY_LINK" ] || [ -d "$LEGACY_LINK" ]; then
    echo "Cleaning up legacy extension link at $LEGACY_LINK..."
    rm -rf "$LEGACY_LINK"
fi

TARGET_LINK="$CEP_DIR/com.aebridge"
SOURCE_PANEL="$REPO_ROOT/cep-panel"

if [ -L "$TARGET_LINK" ] || [ -d "$TARGET_LINK" ]; then
    echo "Updating existing extension at $TARGET_LINK..."
    rm -rf "$TARGET_LINK"
fi

ln -s "$SOURCE_PANEL" "$TARGET_LINK"
echo "Successfully created symlink: $TARGET_LINK -> $SOURCE_PANEL"

echo ""
echo "AE Bridge installed successfully!"
echo "Restart After Effects and open: Window > Extensions > AE Bridge"
