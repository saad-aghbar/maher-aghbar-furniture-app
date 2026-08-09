#!/usr/bin/env python3
"""Bake smaller, denser left-tilt M watermark field."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "apps/mobile/assets/brand"


def make_field(src: Path, out: Path, mark_alpha: float = 0.52) -> None:
    mark = Image.open(src).convert("RGBA")
    target = 36
    mark = mark.resize((target, target), Image.Resampling.LANCZOS)
    r, g, b, a = mark.split()
    a = a.point(lambda p: int(p * mark_alpha))
    mark = Image.merge("RGBA", (r, g, b, a))
    tilted = mark.rotate(20, expand=True, resample=Image.Resampling.BICUBIC)
    tw, th = tilted.size

    gap_x = max(4, int(tw * 0.14))
    gap_y = max(3, int(th * 0.10))
    cell_x = tw + gap_x
    cell_y = th + gap_y
    cols, rows = 16, 22
    width = cols * cell_x
    height = rows * cell_y
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))

    for j in range(rows):
        stagger = (cell_x // 2) if (j % 2) else 0
        for i in range(cols):
            x = (i * cell_x + stagger) % width
            y = j * cell_y + max(0, (cell_y - th) // 2)
            canvas.alpha_composite(tilted, (x, y))
            if x + tw > width:
                canvas.alpha_composite(tilted, (x - width, y))

    canvas.save(out, "PNG", optimize=True)
    print(f"wrote {out} {canvas.size} cell=({cell_x},{cell_y})")


if __name__ == "__main__":
    make_field(BRAND / "watermark-mark.png", BRAND / "watermark-field-on-light.png", 0.52)
    make_field(BRAND / "watermark-mark-dark.png", BRAND / "watermark-field-on-dark.png", 0.58)
