from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1] / "public" / "art" / "generated" / "v3"
CUSTOMERS = ("polite", "urgent", "vague", "last-change", "perfectionist", "all-tools")
MAX_SIZE = (512, 768)


def optimize_and_validate(name: str) -> None:
    path = ROOT / f"customer-{name}-v3.png"
    with Image.open(path) as source:
        image = source.convert("RGBA")
        image.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)
        alpha = image.getchannel("A")
        if alpha.getbbox() is None:
            raise ValueError(f"{name}: empty alpha mask")
        corners = (alpha.getpixel((0, 0)), alpha.getpixel((image.width - 1, 0)), alpha.getpixel((0, image.height - 1)), alpha.getpixel((image.width - 1, image.height - 1)))
        if any(value > 8 for value in corners):
            raise ValueError(f"{name}: background corners are not transparent: {corners}")
        visible = sum(alpha.histogram()[9:])
        coverage = visible / (image.width * image.height)
        if not 0.08 <= coverage <= 0.72:
            raise ValueError(f"{name}: implausible subject coverage {coverage:.3f}")
        temp_path = path.with_suffix(".optimized.png")
        image.save(temp_path, optimize=True, compress_level=9)
    temp_path.replace(path)
    print(f"{name}: {image.width}x{image.height}, visible={coverage:.1%}")


if __name__ == "__main__":
    for customer in CUSTOMERS:
        optimize_and_validate(customer)
