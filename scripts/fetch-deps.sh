#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$DIR/../cep-panel/lib"
mkdir -p "$TARGET_DIR"

URL="https://raw.githubusercontent.com/Adobe-CEP/CEP-Resources/ab5e4e3e53a42fad08e1225a22a991bb1ffe73f6/CEP_11.x/CSInterface.js"
EXPECTED_HASH="d940cbc991553b4885d1b3b04d99c17f448041a738a12cc0b24ce688ace2d263"
OUTPUT="$TARGET_DIR/CSInterface.js"
TEMP_OUTPUT="$TARGET_DIR/CSInterface.js.$$.tmp"

echo "Downloading verified CSInterface.js from pinned Adobe-CEP/CEP-Resources commit..."
curl -fsSL "$URL" -o "$TEMP_OUTPUT"

ACTUAL_HASH=$(shasum -a 256 "$TEMP_OUTPUT" 2>/dev/null | awk '{print $1}' || sha256sum "$TEMP_OUTPUT" 2>/dev/null | awk '{print $1}')

if [ "$ACTUAL_HASH" != "$EXPECTED_HASH" ]; then
    rm -f "$TEMP_OUTPUT"
    echo "ERROR: SHA256 mismatch for CSInterface.js!"
    echo "Expected: $EXPECTED_HASH"
    echo "Actual:   $ACTUAL_HASH"
    exit 1
fi

mv "$TEMP_OUTPUT" "$OUTPUT"
echo "Verified and installed CSInterface.js to $OUTPUT (SHA-256: $ACTUAL_HASH)"
