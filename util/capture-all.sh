#!/usr/bin/env bash
# Every screenshot with the interface hidden, except `ui`, which is there to
# show the interface. `t` pins the animation clock so the flames are repeatable.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
for v in "aerial:view=aerial&hour=9&ui=none" \
         "court:view=court&hour=9&ui=none" \
         "facade:go=porch&hour=9&ui=none" \
         "fire:cam=178,29.8,210.5,146.7,14.2,230&hour=18.1&t=5.2&ui=none" \
         "south:view=south&hour=8&ui=none" \
         "dusk:view=aerial&hour=17.9&ui=none" \
         "women:go=women&hour=9&ui=none" \
         "ui:view=court&hour=9&ui=1"; do
  n="${v%%:*}"; q="${v#*:}"
  ./util/capture.sh "$n" "$q" >/dev/null 2>&1
  echo "done $n"
done
