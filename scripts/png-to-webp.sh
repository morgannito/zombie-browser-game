#!/bin/sh
# Generate WebP companions for every PNG under assets/.
# The client's AssetManager tries .webp first and falls back to .png on 404.
#
# Requires: cwebp (brew install webp) or libwebp package on Linux.
# Usage: ./scripts/png-to-webp.sh [quality]

set -eu

QUALITY="${1:-82}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v cwebp >/dev/null 2>&1; then
  echo "ERROR: cwebp not found. Install libwebp (brew install webp)." >&2
  exit 1
fi

count=0
find "$ROOT/assets" -name "*.png" -type f | while IFS= read -r png; do
  webp="${png%.png}.webp"
  # Skip if webp is fresher than png
  if [ -f "$webp" ] && [ "$webp" -nt "$png" ]; then
    continue
  fi
  cwebp -q "$QUALITY" -quiet "$png" -o "$webp"
  count=$((count + 1))
done
echo "WebP generation done."
