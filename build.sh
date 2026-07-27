#!/usr/bin/env bash
# Concatenate src/ into index.html—a standalone page, opened straight from
# disk. Anything that wants the page as a fragment rather than a document can
# take the body out of index.html; there is no separate build for it.
set -euo pipefail
cd "$(dirname "$0")"

SRC=src
JS="$SRC/10-math.js $SRC/20-textures.js $SRC/30-geom.js $SRC/40-data.js \
    $SRC/50-build-mount.js $SRC/55-build-temple.js $SRC/60-gl.js $SRC/70-app.js"

emit_body() {
  cat "$SRC/01-shell.html"
  echo
  echo '<script>'
  for f in $JS; do
    echo "/* ================= $(basename "$f") ================= */"
    cat "$f"
    echo
  done
  echo '</script>'
}

{
  echo '<!doctype html>'
  echo '<html lang="en"><head><meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">'
  echo '<meta name="description" content="An interactive 3-D reconstruction of Herod'"'"'s Temple Mount in Jerusalem as it stood about AD 30, built from Mishnah Middot, Josephus, and the Temple Mount excavations.">'
  echo '<meta name="color-scheme" content="light dark">'
  echo '</head><body>'
  emit_body
  echo '</body></html>'
} > index.html

for f in $JS; do node --check "$f"; done
echo "ok:"
wc -c index.html | sed 's/^/  /'
