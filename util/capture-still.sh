#!/usr/bin/env bash
# Capture the HTML renderer with the exported Blender cameras at 1024 x 768.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
# Some WSL sessions expose the checkout through /www; Windows needs its drive path.
if [[ "$ROOT" == /www/* && -d "/mnt/c$ROOT" ]]; then ROOT="/mnt/c$ROOT"; fi
cd "$ROOT"
OUT="$ROOT/captures/still"
EDGE_BIN=${EDGE_BIN:-'/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}
WIN_ROOT=$(wslpath -w "$ROOT")
URL_ROOT=${WIN_ROOT//\\//}
if [[ $# == 0 ]]; then set -- close overview; fi
for VIEW in "$@"; do
  case "$VIEW" in close|overview) ;; *) echo "Unknown view: $VIEW" >&2; exit 1 ;; esac
  QUERY=$(node -e 'console.log(require(process.argv[1])[process.argv[2]].query)' "$OUT/views.json" "$VIEW")
  IMAGE="$OUT/temple-$VIEW-html.png"
  REV=2
  while [[ -e "$IMAGE" ]]; do
    IMAGE="$OUT/temple-$VIEW-html-$REV.png"
    REV=$((REV+1))
  done
  "$EDGE_BIN" --headless=new --no-sandbox --disable-gpu-sandbox \
    --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
    --force-device-scale-factor=1 --hide-scrollbars --window-size=1024,768 \
    --virtual-time-budget=180000 --screenshot="$(wslpath -w "$IMAGE")" \
    "file:///$URL_ROOT/index.html?$QUERY" > "$OUT/capture-$VIEW.log" 2>&1
  test -s "$IMAGE"
  echo "Captured $IMAGE"
done
