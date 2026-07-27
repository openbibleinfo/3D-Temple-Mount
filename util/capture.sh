#!/usr/bin/env bash
# capture.sh <name> <query-string>   -> captures/<name>.jpg
# Edge can only screenshot to PNG, so it is converted and the PNG discarded.
#
# Edge is a Windows program and needs Windows paths, so they are derived from
# where this script actually is (`wslpath -w`). Hardcoding a drive letter breaks
# silently the moment the checkout moves: Edge reports "cannot find the path
# specified", exits 0-ish, and you are left with the stale JPEG or none at all.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
EDGE="/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
WIN_DIR=$(wslpath -w "$PWD")                    # C:\www\exec\temple
WIN_URL=${WIN_DIR//\\//}                        # C:/www/exec/temple
mkdir -p captures
N="$1"; Q="${2:-}"
rm -f "captures/$N.png"
"$EDGE" --headless=new --no-sandbox --disable-gpu-sandbox \
  --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
  --hide-scrollbars --window-size=1440,900 --virtual-time-budget=180000 \
  --screenshot="$WIN_DIR\\captures\\$N.png" \
  "file:///$WIN_URL/index.html${Q:+?$Q}" >/dev/null 2>&1 || true
if [ ! -s "captures/$N.png" ]; then
  echo "capture.sh: Edge wrote no PNG for '$N' (tried $WIN_DIR\\captures\\$N.png)" >&2
  exit 1
fi
rm -f "captures/$N.jpg"
python3 util/png-to-jpeg.py "captures/$N.png" "captures/$N.jpg" 88
rm -f "captures/$N.png"
ls -la "captures/$N.jpg"
