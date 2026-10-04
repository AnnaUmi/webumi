#!/bin/bash
# The walking bear on the 404 page: src/video/404.mp4 → see-through videos in src/static/video/
#   bear-404[-960].webm  VP9 with alpha   (Chrome, Firefox, Edge)
#   bear-404[-960].mp4   HEVC with alpha  (Safari, every iPhone/iPad browser)
#   -960 = the phone size
# Needs ffmpeg (brew install ffmpeg) and python3 with numpy + Pillow.
# usage: bash tools/make-404-video.sh
set -euo pipefail
cd "$(dirname "$0")/.."

LAST=122   # the video stops (and stays) on this frame: the shrug, head tilted, paws up

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
out=src/static/video; mkdir -p "$out" "$tmp/raw" "$tmp/cut"

ffmpeg -hide_banner -loglevel error -i src/video/404.mp4 -vf scale=1280:-2 "$tmp/raw/f%03d.png"
python3 tools/cutout-video.py "$tmp/raw" "$tmp/cut"
for f in "$tmp"/cut/f*.png; do n=$(basename "$f" .png); if [ $((10#${n#f})) -gt $LAST ]; then rm "$f"; fi; done

# full size for big screens, 960px for phones (shown ~700px wide there)
enc() {  # <scale filter> <suffix> <hevc bitrate>
  ffmpeg -hide_banner -loglevel error -y -framerate 24 -i "$tmp/cut/f%03d.png" -an -vf "$1" \
    -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 34 -row-mt 1 -deadline good "$out/bear-404$2.webm"
  ffmpeg -hide_banner -loglevel error -y -framerate 24 -i "$tmp/cut/f%03d.png" -an -vf "$1" \
    -c:v hevc_videotoolbox -allow_sw 1 -alpha_quality 0.8 -b:v "$3" -pix_fmt bgra -tag:v hvc1 \
    -movflags +faststart "$out/bear-404$2.mp4"
}
enc null "" 1400k
enc scale=960:-2 "-960" 450k

ls -lh "$out"
