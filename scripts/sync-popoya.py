#!/usr/bin/env python3
"""Sync the exact original PNG into the active OC pack; no image processing."""
import hashlib
import re
import subprocess
import sys
from pathlib import Path

root=Path(__file__).resolve().parents[1]
png=(root/"public/assets/popoya-original.png").read_bytes()
if not png.startswith(bytes.fromhex("89504e470d0a1a0a")):
    raise SystemExit("Not a PNG")
stamp="popoya-"+hashlib.sha256(png).hexdigest()[:12]

# Keep legacy sample/test pages in sync with the original asset and cache tag.
for name in ("piece-preview.html","piece-motion-test.html","piece-color-test.html","goal-test.html"):
    path=root/"public"/name
    if not path.exists():
        continue
    original=path.read_text(encoding="utf-8")
    replacement=re.sub(
      r"(/assets/popoya-original\.png)\?v=[a-zA-Z0-9_-]+",
      lambda m:m.group(1)+"?v="+stamp,
      original
    )
    if replacement!=original:
        path.write_text(replacement,encoding="utf-8")
        print(name+": refreshed original PNG reference")

# A user explicitly updating the original PNG opts into syncing this artwork
# to the OC pack. Normal content-pack rebuilds never replace artwork on their own.
original_in_pack=root/'content/packs/oc/assets/popoya-original.png'
original_in_pack.parent.mkdir(parents=True,exist_ok=True)
if not original_in_pack.exists() or original_in_pack.read_bytes()!=png:
    original_in_pack.write_bytes(png)
subprocess.run([sys.executable,str(root/"scripts/build-content-pack.py")],check=True)
print("Original PNG byte-for-byte synchronized; no image filters or transformations")
