#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SOURCE_DIR="$PROJECT_ROOT/media/source-frames"
OUTPUT_DIR="$PROJECT_ROOT/public/frames"

command -v cwebp >/dev/null 2>&1 || {
  echo "缺少 cwebp，请先安装 WebP 工具。" >&2
  exit 1
}

mkdir -p "$OUTPUT_DIR"

for source in "$SOURCE_DIR"/frame-*.png; do
  name="$(basename "$source" .png)"
  cwebp -quiet -q 82 -resize 800 800 "$source" -o "$OUTPUT_DIR/$name.webp"
done
