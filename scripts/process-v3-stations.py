from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
GENERATED = Path(r"C:\Users\USER\.codex\generated_images\019faa25-ab18-7821-a8bf-2bea25ce93b2")
HISTORY = ROOT / "review" / "art" / "history" / "2026-07-30_station-v3-sources"
OUTPUT = ROOT / "public" / "art" / "generated" / "v3"
CHROMA_TOOL = Path(r"C:\Users\USER\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py")
MAX_SIZE = (512, 512)

STATIONS = {
    "counter": "exec-3a478a3a-7281-4584-9faf-cc2052994207.png",
    "text": "exec-0415b7d0-e231-4285-b91e-e01998bbde75.png",
    "search": "exec-77c163bc-e8f5-471a-9639-1775002aebd4.png",
    "document": "exec-9b7bb810-5c1f-4cfd-91b9-58ac5e7d2b63.png",
    "art": "exec-e8cf7ee2-4131-488d-bdd0-98ae308a3e9a.png",
    "music": "exec-3f43ba4e-c2e5-4527-ba19-befbf9bdc785.png",
    "recording": "exec-6e28c6d3-2140-4f8e-b8d6-0f07e456fe66.png",
    "studio": "exec-f7a25681-fe85-4d38-8e98-cc7c9ccbfdeb.png",
    "video": "exec-93002356-05ce-4740-b885-ea4a0ef8f172.png",
    "code": "exec-6d4248c3-9e29-4e2c-841f-1e12f23203dd.png",
    "deploy": "exec-d52e2ec4-2f97-4204-8666-f4e5102c7f83.png",
}


def trim_resize_validate(path: Path, padding: int = 12) -> tuple[int, int, float]:
    with Image.open(path) as source:
        image = source.convert("RGBA")
        box = image.getchannel("A").getbbox()
        if box is None:
            raise RuntimeError(f"No visible pixels after chroma removal: {path.name}")
        crop = (
            max(0, box[0] - padding),
            max(0, box[1] - padding),
            min(image.width, box[2] + padding),
            min(image.height, box[3] + padding),
        )
        image = image.crop(crop)
        image.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)
        alpha = image.getchannel("A")
        corners = (
            alpha.getpixel((0, 0)),
            alpha.getpixel((image.width - 1, 0)),
            alpha.getpixel((0, image.height - 1)),
            alpha.getpixel((image.width - 1, image.height - 1)),
        )
        if any(value > 10 for value in corners):
            raise RuntimeError(f"Opaque chroma corner in {path.name}: {corners}")
        coverage = sum(alpha.histogram()[11:]) / (image.width * image.height)
        if not 0.35 <= coverage <= 0.92:
            raise RuntimeError(f"Implausible coverage in {path.name}: {coverage:.3f}")
        image.save(path, optimize=True, compress_level=9)
        return image.width, image.height, coverage


def process_station(station_id: str, source_name: str) -> None:
    source = GENERATED / source_name
    if not source.is_file():
        raise FileNotFoundError(source)
    output = OUTPUT / f"station-{station_id}-v3.png"
    matte = OUTPUT / f".station-{station_id}-v3.matte.png"
    shutil.copy2(source, HISTORY / f"station-{station_id}-v3-source.png")
    subprocess.run(
        [
            sys.executable,
            str(CHROMA_TOOL),
            "--input",
            str(source),
            "--out",
            str(matte),
            "--auto-key",
            "border",
            "--soft-matte",
            "--transparent-threshold",
            "12",
            "--opaque-threshold",
            "190",
            "--edge-feather",
            "1",
            "--despill",
            "--force",
        ],
        check=True,
    )
    shutil.move(matte, output)
    width, height, coverage = trim_resize_validate(output)
    print(f"{station_id}: {width}x{height}, visible={coverage:.1%}")


def main() -> None:
    HISTORY.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for station_id, source_name in STATIONS.items():
        process_station(station_id, source_name)


if __name__ == "__main__":
    main()
