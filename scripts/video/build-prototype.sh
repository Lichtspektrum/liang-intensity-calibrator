#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SOURCE_DIR="$PROJECT_ROOT/public/frames"
OUTPUT_DIR="$PROJECT_ROOT/output/video-prototype"
WORK_DIR="$(mktemp -d /tmp/liang-video-prototype.XXXXXX)"
RIFE_MODEL="${RIFE_MODEL:-$(dirname "$RIFE_BIN")/rife-v4.6}"

trap 'rm -rf "$WORK_DIR"' EXIT

"$SCRIPT_DIR/check-toolchain.sh"

if [[ ! -f "$RIFE_MODEL/flownet.bin" || ! -f "$RIFE_MODEL/flownet.param" ]]; then
  echo "找不到 RIFE v4 模型：$RIFE_MODEL" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

prepare_segment() {
  local start_level="$1"
  local end_level="$2"
  local target_dir="$3"
  local output_index=0

  mkdir -p "$target_dir"

  for ((level = start_level; level <= end_level; level += 1)); do
    local source_name
    local output_name
    source_name="$(printf 'frame-%02d.png' "$level")"
    output_name="$(printf '%03d.png' "$output_index")"

    if [[ ! -f "$SOURCE_DIR/$source_name" ]]; then
      echo "缺少源图片：$SOURCE_DIR/$source_name" >&2
      exit 1
    fi

    ffmpeg -hide_banner -loglevel error -y \
      -i "$SOURCE_DIR/$source_name" \
      -vf "scale=800:800:force_original_aspect_ratio=increase,crop=800:800" \
      "$target_dir/$output_name"
    output_index=$((output_index + 1))
  done
}

interpolate_segment() {
  local input_dir="$1"
  local output_dir="$2"

  mkdir -p "$output_dir"
  (
    cd "$(dirname "$RIFE_BIN")"
    "$RIFE_BIN" -i "$input_dir" -o "$output_dir" -n 49 -m "$RIFE_MODEL"
  )
}

encode_segment() {
  local input_dir="$1"
  local output_file="$2"

  ffmpeg -hide_banner -loglevel error -y \
    -framerate 30 -pattern_type glob -i "$input_dir/*.png" \
    -c:v libx264 -preset medium -crf 18 \
    -g 4 -keyint_min 1 -sc_threshold 0 \
    -pix_fmt yuv420p -movflags +faststart \
    "$output_file"
}

prepare_segment 0 6 "$WORK_DIR/early-input"
prepare_segment 24 30 "$WORK_DIR/final-input"

interpolate_segment "$WORK_DIR/early-input" "$WORK_DIR/early-output"
interpolate_segment "$WORK_DIR/final-input" "$WORK_DIR/final-output"

encode_segment "$WORK_DIR/early-output" "$OUTPUT_DIR/xiaonanliang-to-laoliang.mp4"
encode_segment "$WORK_DIR/final-output" "$OUTPUT_DIR/liangshen-to-liangzu.mp4"

for video in "$OUTPUT_DIR"/*.mp4; do
  echo "已生成：$video"
  ffprobe -v error -count_frames -select_streams v:0 \
    -show_entries stream=width,height,nb_read_frames \
    -of default=noprint_wrappers=1 "$video"
done
