#!/usr/bin/env python3
"""Build the labeled review sheet for premium Harthmere projectiles."""

from __future__ import annotations

import argparse
import json
import math
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", default=".")
    args = parser.parse_args()
    repo = Path(args.repo_root).resolve()
    asset_root = repo / "public/assets/harthmere"
    manifest = json.loads(
        (asset_root / "glb/projectiles/manifest.json").read_text()
    )
    projectiles = manifest["projectiles"]
    columns = 6
    image_size = 256
    label_height = 54
    rows = math.ceil(len(projectiles) / columns)
    sheet = Image.new(
        "RGB",
        (columns * image_size, rows * (image_size + label_height)),
        (8, 10, 17),
    )
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype(
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf", 16
        )
    except OSError:
        font = ImageFont.load_default()

    for index, projectile in enumerate(projectiles):
        preview = Image.open(
            asset_root / "projectile_previews" / f"{projectile['id']}.png"
        ).convert("RGB")
        preview = preview.resize((image_size, image_size), Image.Resampling.LANCZOS)
        x = (index % columns) * image_size
        y = (index // columns) * (image_size + label_height)
        sheet.paste(preview, (x, y))
        lines = (textwrap.wrap(projectile["label"], width=26) or [projectile["label"]])[:2]
        for line_index, line in enumerate(lines):
            bounds = draw.textbbox((0, 0), line, font=font)
            width = bounds[2] - bounds[0]
            draw.text(
                (
                    x + (image_size - width) / 2,
                    y + image_size + 7 + line_index * 19,
                ),
                line,
                fill=(240, 244, 255),
                font=font,
            )

    output = asset_root / "projectile_previews/contact_sheet.png"
    sheet.save(output, optimize=True)
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
