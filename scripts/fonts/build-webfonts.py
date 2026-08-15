#!/usr/bin/env python3
"""Subset the six stage fonts to their stage words and emit WOFF2 into the repo.

Usage:
    python scripts/fonts/build-webfonts.py [SOURCE_DIR]

SOURCE_DIR defaults to the annotated font folder next to this repo
(E:\\pyprojects\\选中字体) which contains manifest.json + the six TTF files.
The order of stages follows STAGES in src/score-domain.ts:
    0 小难梁, 1 牢梁, 2 梁子, 3 梁圣, 4 梁神, 5 梁祖
(Note: the manifest's file numbering 04_梁神/05_梁圣 is NOT stage order.)

Outputs: src/assets/fonts/stage-{index:02d}.woff2
"""

from __future__ import annotations

import json
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DEFAULT_SOURCE = r"E:\pyprojects\选中字体"
OUT_DIR = os.path.join(REPO_ROOT, "src", "assets", "fonts")

# Must match src/score-domain.ts STAGES order.
STAGES = ["小难梁", "牢梁", "梁子", "梁圣", "梁神", "梁祖"]
# Weight for the variable Noto Serif SC (梁子): keep the heavy background look.
NOTO_INSTANCE_WGHT = 900
# Per-stage source-font overrides (filename within SOURCE_DIR), used instead of
# manifest.json entries. 牢梁 now uses 丁烈傩言 (custom font, all rights reserved).
STAGE_FONT_OVERRIDES: dict[str, str] = {
    "牢梁": "dinglienuoyanfont20250330.ttf",
}


def main() -> int:
    source_dir = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SOURCE
    manifest_path = os.path.join(source_dir, "manifest.json")
    if not os.path.isfile(manifest_path):
        print(f"manifest.json not found under {source_dir}", file=sys.stderr)
        return 1

    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)

    os.makedirs(OUT_DIR, exist_ok=True)
    total = 0

    for index, word in enumerate(STAGES):
        info = manifest["fonts"].get(word)
        if not info:
            print(f"stage {word}: missing from manifest", file=sys.stderr)
            return 1
        src_name = STAGE_FONT_OVERRIDES.get(word, info["file"])
        src_path = os.path.join(source_dir, src_name)
        out_path = os.path.join(OUT_DIR, f"stage-{index:02d}.woff2")

        font = TTFont(src_path, fontNumber=0)
        if "fvar" in font:
            from fontTools.varLib.instancer import instantiateVariableFont

            instantiateVariableFont(font, {"wght": NOTO_INSTANCE_WGHT}, inplace=True)
            print(f"stage {index} {word}: variable font instanced to wght={NOTO_INSTANCE_WGHT}")

        sub = subset.Subsetter()
        sub.populate(text=word)
        sub.subset(font)

        cmap = font.getBestCmap()
        missing = [ch for ch in word if ord(ch) not in cmap]
        if missing:
            print(f"stage {index} {word}: missing glyphs after subset {missing}", file=sys.stderr)
            return 1

        font.flavor = "woff2"
        font.save(out_path)
        size = os.path.getsize(out_path)
        total += size
        print(f"stage {index} {word} <- {src_name}: {out_path} ({size}B)")

    print(f"TOTAL: {total}B in {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
