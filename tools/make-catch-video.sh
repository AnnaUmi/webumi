#!/bin/bash
# The bear catching the sparkle in the pricing page header → see-through videos in src/static/video/
#   bear-catch.webm / .mp4            frames 1..CATCH_END: the sparkle falls, the bear catches it and walks on
#   bear-catch-loop.webm / .mp4       frames LOOP_START..LOOP_END: walking on the spot holding it, looped
#                                     (frame LOOP_END looks like LOOP_START-1, so the loop has no seam)
#   bear-catch-start.webp             the first frame: poster while the video loads (no jump when it starts)
#   bear-catch.webp                   frame STILL, standing with both feet down: shown when motion is reduced
#                                     or autoplay is blocked
# VP9 with alpha (.webm) for Chrome, Firefox, Edge; HEVC with alpha (.mp4) for Safari and every iPhone/iPad.
# The bear is in every frame, so the background is taken from the frame edges (cutout-video.py ... edges).
# The source slowly zooms in; steady-zoom.py cancels that, otherwise the loop would shrink and grow.
# The frame numbers were picked for this source; for a new export, re-check them.
# Needs ffmpeg (brew install ffmpeg) and python3 with numpy + Pillow.
# usage: bash tools/make-catch-video.sh <source.mp4>
set -euo pipefail
cd "$(dirname "$0")/.."
src="${1:?usage: bash tools/make-catch-video.sh <source.mp4>}"

CATCH_END=103; LOOP_START=104; LOOP_END=134; STILL=61

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
out=src/static/video; mkdir -p "$out" "$tmp/raw" "$tmp/cut" "$tmp/steady"

ffmpeg -hide_banner -loglevel error -i "$src" -vf scale=720:-2 "$tmp/raw/f%03d.png"
python3 tools/cutout-video.py "$tmp/raw" "$tmp/cut" edges
python3 tools/steady-zoom.py "$tmp/cut" "$tmp/steady" "$STILL"

# crop the empty sides and the floor below the shadow, then 480px wide (shown ~240px wide, sharp on retina)
vf="crop=640:1216:40:0,scale=480:-2"
enc() {  # <first frame> <last frame> <out name>
  local n=$(( $2 - $1 + 1 ))
  ffmpeg -hide_banner -loglevel error -y -framerate 24 -start_number "$1" -i "$tmp/steady/f%03d.png" -frames:v "$n" -an -vf "$vf" \
    -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 40 -row-mt 1 -deadline good "$out/$3.webm"
  ffmpeg -hide_banner -loglevel error -y -framerate 24 -start_number "$1" -i "$tmp/steady/f%03d.png" -frames:v "$n" -an -vf "$vf" \
    -c:v hevc_videotoolbox -allow_sw 1 -alpha_quality 0.5 -b:v 400k -pix_fmt bgra -tag:v hvc1 \
    -movflags +faststart "$out/$3.mp4"
}
enc 1 "$CATCH_END" bear-catch
enc "$LOOP_START" "$LOOP_END" bear-catch-loop

still() { python3 -c "from PIL import Image; Image.open('$1').crop((40,0,680,1216)).resize((480,912)).save('$2', quality=82)"; }
still "$tmp/steady/f001.png" "$out/bear-catch-start.webp"
still "$(printf "%s/steady/f%03d.png" "$tmp" "$STILL")" "$out/bear-catch.webp"

ls -lh "$out"/bear-catch*
