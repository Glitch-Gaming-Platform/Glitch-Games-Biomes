#!/usr/bin/env python3
"""Build a labeled contact sheet from the premium weapon previews."""

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
    manifest = json.loads((asset_root / "glb/weapons/manifest.json").read_text())
    weapons = manifest["weapons"]
    columns = 6
    image_size = 256
    label_height = 58
    rows = math.ceil(len(weapons) / columns)
    sheet = Image.new(
        "RGB",
        (columns * image_size, rows * (image_size + label_height)),
        (10, 12, 20),
    )
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype(
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf", 16
        )
    except OSError:
        font = ImageFont.load_default()

    for index, weapon in enumerate(weapons):
        preview = Image.open(
            asset_root / "weapon_previews" / f"{weapon['id']}.png"
        ).convert("RGB")
        preview = preview.resize((image_size, image_size), Image.Resampling.LANCZOS)
        x = (index % columns) * image_size
        y = (index // columns) * (image_size + label_height)
        sheet.paste(preview, (x, y))
        lines = textwrap.wrap(weapon["label"], width=25) or [weapon["label"]]
        lines = lines[:2]
        for line_index, line in enumerate(lines):
            bounds = draw.textbbox((0, 0), line, font=font)
            line_width = bounds[2] - bounds[0]
            draw.text(
                (
                    x + (image_size - line_width) / 2,
                    y + image_size + 8 + line_index * 20,
                ),
                line,
                fill=(238, 242, 255),
                font=font,
            )

    output = asset_root / "weapon_previews/contact_sheet.png"
    sheet.save(output, optimize=True)
    print(output)

    try:
        icon_font = ImageFont.truetype(
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf", 14
        )
    except OSError:
        icon_font = font
    icon_columns = 6
    icon_cell_width = 210
    icon_cell_height = 218
    icon_rows = math.ceil(len(weapons) / icon_columns)
    icon_sheet = Image.new(
        "RGB",
        (icon_columns * icon_cell_width, icon_rows * icon_cell_height),
        (8, 10, 17),
    )
    icon_draw = ImageDraw.Draw(icon_sheet)
    for index, weapon in enumerate(weapons):
        x = (index % icon_columns) * icon_cell_width
        y = (index // icon_columns) * icon_cell_height
        icon_draw.rounded_rectangle(
            (x + 12, y + 8, x + icon_cell_width - 12, y + 166),
            radius=16,
            fill=(27, 31, 43),
            outline=(70, 82, 110),
            width=2,
        )
        icon = Image.open(
            asset_root / "weapon_icons" / f"{weapon['id']}.png"
        ).convert("RGBA")
        icon = icon.resize((156, 156), Image.Resampling.LANCZOS)
        icon_sheet.paste(icon, (x + 27, y + 9), icon)
        lines = (textwrap.wrap(weapon["label"], width=26) or [weapon["label"]])[:2]
        for line_index, line in enumerate(lines):
            bounds = icon_draw.textbbox((0, 0), line, font=icon_font)
            line_width = bounds[2] - bounds[0]
            icon_draw.text(
                (
                    x + (icon_cell_width - line_width) / 2,
                    y + 176 + line_index * 17,
                ),
                line,
                fill=(238, 242, 255),
                font=icon_font,
            )

    icon_output = asset_root / "weapon_icons/contact_sheet.png"
    icon_sheet.save(icon_output, optimize=True)
    print(icon_output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
