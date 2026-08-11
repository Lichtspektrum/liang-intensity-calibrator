#!/bin/bash

set -euo pipefail

for tool in ffmpeg ffprobe; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "缺少 $tool，请先安装 FFmpeg。" >&2
    exit 1
  fi
done

if [[ -z "${RIFE_BIN:-}" || ! -x "$RIFE_BIN" ]]; then
  echo "找不到 RIFE 可执行文件，请通过 RIFE_BIN 指定绝对路径。" >&2
  exit 1
fi

echo "系统架构：$(uname -m)"
echo "FFmpeg：$(ffmpeg -version | head -n 1)"
echo "FFprobe：$(ffprobe -version | head -n 1)"
echo "RIFE：$(file "$RIFE_BIN")"
