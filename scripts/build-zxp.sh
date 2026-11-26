#!/usr/bin/env bash
# Package AE Bridge CEP panel into a .zxp extension archive
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PANEL_DIR="${ROOT_DIR}/cep-panel"
DIST_DIR="${ROOT_DIR}/dist"
OUTPUT_ZXP="${DIST_DIR}/com.aebridge.zxp"

echo "=== AE Bridge ZXP Packager ==="
echo "Source: ${PANEL_DIR}"

mkdir -p "${DIST_DIR}"
rm -f "${OUTPUT_ZXP}"

TMP_BUILD_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t 'ae-zxp')"
trap 'rm -rf "${TMP_BUILD_DIR}"' EXIT

echo "Staging clean extension files..."
# Copy panel files excluding development artifacts
rsync -av \
  --exclude='.git*' \
  --exclude='.debug' \
  --exclude='node_modules' \
  --exclude='*.log' \
  --exclude='*.tmp' \
  --exclude='*.swp' \
  "${PANEL_DIR}/" "${TMP_BUILD_DIR}/"

# Check for ZXPSignCmd
if command -v ZXPSignCmd >/dev/null 2>&1 && [ -n "${CERT_FILE:-}" ] && [ -n "${CERT_PASS:-}" ]; then
  echo "Signing package with ZXPSignCmd..."
  ZXPSignCmd -sign "${TMP_BUILD_DIR}" "${OUTPUT_ZXP}" "${CERT_FILE}" "${CERT_PASS}" -tsa http://timestamp.digicert.com
  echo "Successfully signed and built: ${OUTPUT_ZXP}"
else
  echo "Building unsigned .zxp archive (standard zip format)..."
  (cd "${TMP_BUILD_DIR}" && zip -r -q "${OUTPUT_ZXP}" .)
  echo "Created archive: ${OUTPUT_ZXP}"
  echo "Note: To sign for production distribution, use ZXPSignCmd with a certificate."
  echo "See docs/packaging.md for full instructions."
fi

echo "Done."
