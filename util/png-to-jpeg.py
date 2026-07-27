#!/usr/bin/env python3
"""Convert a captured PNG to a progressive JPEG and report the saving."""
import os, sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
q = int(sys.argv[3]) if len(sys.argv) > 3 else 88
before = os.path.getsize(src)
Image.open(src).convert("RGB").save(dst, "JPEG", quality=q,
                                    optimize=True, progressive=True)
after = os.path.getsize(dst)
print(f"  {os.path.basename(dst)}  {before//1024} KB png -> {after//1024} KB jpg")
