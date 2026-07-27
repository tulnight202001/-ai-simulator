#!/usr/bin/env python3
"""建立可交接的專案 ZIP；只封裝 Git 追蹤檔案並排除敏感/暫存內容。"""
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.2.0-alpha"
DATE = "20260727"
OUTPUT = ROOT / f"ai-simulator-v{VERSION}-{DATE}.zip"
BLOCKED_PARTS = {"node_modules", ".git", "dist", ".cache", "__pycache__", ".env", ".env.local"}
BLOCKED_SUFFIXES = {".pem", ".key", ".p12", ".token"}

def main() -> None:
    files = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard"], cwd=ROOT, text=True).splitlines()
    with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in sorted(files):
            path = Path(name)
            if not (ROOT/path).is_file() or any(part in BLOCKED_PARTS for part in path.parts) or path.suffix.lower() in BLOCKED_SUFFIXES or path.name == OUTPUT.name:
                continue
            archive.write(ROOT / path, f"ai-simulator/{path.as_posix()}")
    print(OUTPUT.name)

if __name__ == "__main__": main()
