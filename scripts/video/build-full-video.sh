#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SOURCE_DIR="$PROJECT_ROOT/public/frames"
OUTPUT_DIR="$PROJECT_ROOT/public/video"
WORK_DIR="$(mktemp -d /tmp/liang-full-video.XXXXXX)"
RIFE_MODEL="${RIFE_MODEL:-$(dirname "$RIFE_BIN")/rife-v4.6}"

trap 'rm -rf "$WORK_DIR"' EXIT

"$SCRIPT_DIR/check-toolchain.sh"

if [[ ! -f "$RIFE_MODEL/flownet.bin" || ! -f "$RIFE_MODEL/flownet.param" ]]; then
  echo "找不到 RIFE v4 模型：$RIFE_MODEL" >&2
  exit 1
fi

mkdir -p "$WORK_DIR/input" "$WORK_DIR/interpolated" "$OUTPUT_DIR"

for ((level = 0; level <= 30; level += 1)); do
  source_name="$(printf 'frame-%02d.png' "$level")"
  output_name="$(printf '%03d.png' "$level")"

  if [[ ! -f "$SOURCE_DIR/$source_name" ]]; then
    echo "缺少源图片：$SOURCE_DIR/$source_name" >&2
    exit 1
  fi

  ffmpeg -hide_banner -loglevel error -y \
    -i "$SOURCE_DIR/$source_name" \
    -vf "scale=800:800:force_original_aspect_ratio=increase,crop=800:800" \
    "$WORK_DIR/input/$output_name"
done

(
  cd "$(dirname "$RIFE_BIN")"
  "$RIFE_BIN" \
    -i "$WORK_DIR/input" \
    -o "$WORK_DIR/interpolated" \
    -n 241 \
    -m "$RIFE_MODEL"
)

frame_count="$(find "$WORK_DIR/interpolated" -type f -name '*.png' | wc -l | tr -d ' ')"
if [[ "$frame_count" != "241" ]]; then
  echo "插帧数量异常：预期 241，实际 $frame_count。" >&2
  exit 1
fi

ffmpeg -hide_banner -loglevel error -y \
  -framerate 30 -pattern_type glob -i "$WORK_DIR/interpolated/*.png" \
  -c:v libvpx-vp9 -crf 28 -b:v 0 -row-mt 1 -cpu-used 2 \
  -g 4 -pix_fmt yuv420p \
  "$OUTPUT_DIR/liang-evolution.webm"

ffmpeg -hide_banner -loglevel error -y \
  -framerate 30 -pattern_type glob -i "$WORK_DIR/interpolated/*.png" \
  -c:v libx264 -preset medium -crf 18 \
  -g 4 -keyint_min 1 -sc_threshold 0 \
  -pix_fmt yuv420p -movflags +faststart \
  "$OUTPUT_DIR/liang-evolution.mp4"

for video in "$OUTPUT_DIR"/liang-evolution.webm "$OUTPUT_DIR"/liang-evolution.mp4; do
  echo "已生成：$video"
  ffprobe -v error -count_frames -select_streams v:0 \
    -show_entries stream=width,height,r_frame_rate,nb_read_frames:format=duration \
    -of default=noprint_wrappers=1 "$video"
done
