#!/usr/bin/env bash
# WSL: export the model and render with the installed Windows Blender.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
if [[ "$ROOT" == /www/* && -d "/mnt/c$ROOT" ]]; then ROOT="/mnt/c$ROOT"; fi
cd "$ROOT"
OUT="$ROOT/captures/still"
BLENDER_BIN=${BLENDER_BIN:-'/mnt/c/Program Files/Blender Foundation/Blender 5.2/blender.exe'}
EDGE_BIN=${EDGE_BIN:-'/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}
node util/export-still.js "$OUT"
WIN_OUT=$(wslpath -w "$OUT")
URL_OUT=${WIN_OUT//\\//}
"$EDGE_BIN" --headless=new --no-sandbox --disable-gpu --dump-dom \
  "file:///$URL_OUT/textures.html" > "$OUT/textures-dom.html" 2> "$OUT/edge.log"
node util/export-still.js "$OUT" --textures-dom
"$BLENDER_BIN" --background --factory-startup --python-exit-code 1 \
  --python "$(wslpath -w "$ROOT/util/render-still.py")" -- --scene "$WIN_OUT" "$@"
