#!/usr/bin/env bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="$DIR/../cep-panel/lib"
mkdir -p "$TARGET_DIR"
URL="https://raw.githubusercontent.com/Adobe-CEP/CEP-Resources/master/CEP_11.x/CSInterface.js"
OUTPUT="$TARGET_DIR/CSInterface.js"
echo "Downloading CSInterface.js..."
curl -fsSL "$URL" -o "$OUTPUT"
echo "Downloaded CSInterface.js to $OUTPUT"
