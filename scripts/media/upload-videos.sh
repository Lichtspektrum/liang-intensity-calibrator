#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUCKET="${MEDIA_BUCKET:-ds-liang-media}"

npx wrangler r2 object put "$BUCKET/video/liang-evolution.webm" \
  --remote \
  --file "$PROJECT_ROOT/media/liang-evolution.webm" \
  --content-type video/webm

npx wrangler r2 object put "$BUCKET/video/liang-evolution.mp4" \
  --remote \
  --file "$PROJECT_ROOT/media/liang-evolution.mp4" \
  --content-type video/mp4
