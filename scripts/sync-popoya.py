#!/usr/bin/env python3
"""Keep Popoya artwork references in sync with the exact uploaded PNG."""
import base64
import hashlib
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
png = (root / "public/assets/popoya-original.png").read_bytes()
if not png.startswith(bytes.fromhex("89504e470d0a1a0a")):
    raise SystemExit("Popoya image is not a valid PNG file")
stamp = "popoya-" + hashlib.sha256(png).hexdigest()[:12]

for name in ("app.js", "piece-preview.html"):
    path = root / "public" / name
    old = path.read_text(encoding="utf-8")
    new, count = re.subn(
        r"(/assets/popoya-original\.png)\?v=[a-zA-Z0-9_-]+",
        lambda match: match.group(1) + "?v=" + stamp,
        old,
    )
    if count < 1:
        raise SystemExit("No artwork reference found in " + name)
    if new != old:
        path.write_text(new, encoding="utf-8")
    print(name + ": updated " + str(count) + " image URL(s)")

path = root / "public/single.html"
old = path.read_text(encoding="utf-8")
encoded = base64.b64encode(png).decode("ascii")
new, count = re.subn(
    r"const POPOYA_PNG='data:image/png;base64,[a-zA-Z0-9+/=]+';",
    lambda match: "const POPOYA_PNG='data:image/png;base64," + encoded + "';",
    old,
)
if count != 1:
    raise SystemExit("Expected one embedded Popoya PNG in offline game, got " + str(count))
if new != old:
    path.write_text(new, encoding="utf-8")
print("single.html: embedded uploaded original PNG, no visual modifications")
