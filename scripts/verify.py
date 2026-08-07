from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
t = (root / "book-content.js").read_text(encoding="utf-8")
keys = re.findall(r'"([^"]+\.md)"\s*:', t)
d = (root / "data.js").read_text(encoding="utf-8")
files = re.findall(r'file:\s*"([^"]+)"', d)
print("CHAPTER_TEXT keys:", len(keys))
print("data.js files:", files)
print("missing:", [f for f in files if f not in keys])
print("size:", (root / "book-content.js").stat().st_size)
