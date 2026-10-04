"""Cut a character out of a plain-background video, keeping its soft floor shadow.

The first frames must show the empty background (the character walks in from the right),
and by the last frame the right side must be empty again: together they give the
"clean plate" every other frame is compared against.

  Colourful or dark pixels (far from the plate)   -> the character, opaque
  Plate colour, only darker                       -> shadow, black with partial alpha
  Plate colour                                    -> transparent

With a third argument "edges" the character may be in every frame (e.g. walking on the spot):
the plate is built from the left and right edges of each row instead, interpolated across.

usage: python3 tools/cutout-video.py <frames dir with fNNN.png> <out dir> [edges]
Needs numpy + Pillow. tools/make-404-video.sh runs the whole pipeline.
"""
import sys, glob, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
files = sorted(glob.glob(os.path.join(src, "f*.png")))

def smooth(x, a, b):          # 0 at a, 1 at b (a may be > b)
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

load = lambda f: np.asarray(Image.open(f).convert("RGB")).astype(np.float32)
if len(sys.argv) > 3 and sys.argv[3] == "edges":
    first = np.median(np.stack([load(f) for f in files[::12]]), axis=0)
    H, W, _ = first.shape
    e = max(4, int(W * .05))
    left, right = np.median(first[:, :e], axis=1), np.median(first[:, -e:], axis=1)   # one colour per row and side
    t = np.linspace(0, 1, W, dtype=np.float32)[None, :, None]
    plate = left[:, None] * (1 - t) + right[:, None] * t
else:
    plate = np.median(np.stack([load(f) for f in files[:3]]), axis=0)
    H, W, _ = plate.shape
    plate[:, int(W * .8):] = load(files[-1])[:, int(W * .8):]    # the character is already peeking in on the right
pp = (plate * plate).sum(2) + 1e-3
low = smooth(np.arange(H, dtype=np.float32), H * .55, H * .8)[:, None]   # shadows only near the floor

for f in files:
    a = load(f)
    k = (a * plate).sum(2) / pp                                     # brightness relative to the plate
    resid = np.sqrt(((a - k[..., None] * plate) ** 2).sum(2))      # colour that isn't the plate's
    fg = np.maximum(smooth(resid, 14, 38), smooth(k, .62, .42))    # colourful, or much darker (black fur)
    # light patches enclosed by the head (white muzzle) are part of it, not background;
    # only the head: lower down, the gap between touching legs is enclosed too
    solid = fg > .95
    m = Image.fromarray(np.pad(solid.astype(np.uint8) * 255, 1)).copy()   # copy: floodfill can't write to a numpy-backed image
    m = m.filter(ImageFilter.MaxFilter(7))                                # close hairline gaps so the muzzle counts as enclosed
    ImageDraw.floodfill(m, (0, 0), 128)
    hole = np.asarray(m)[1:-1, 1:-1] == 0
    rows = np.flatnonzero(solid.sum(1) > W * .15)                   # the body's rows, not small objects floating above it
    if rows.size:
        hole[int(rows[0] + .45 * (rows[-1] - rows[0])):] = False
        fg = np.where(hole, 1, fg)
    fg = np.asarray(Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.8))) / 255.0
    sh = smooth(k, .985, .7) * .7 * low                             # soft floor shadow

    # un-mix the beige out of the fur edges: a = fg*F + (1-fg)*k*plate
    bg = np.clip(k, 0, 1)[..., None] * plate
    F = np.where(fg[..., None] > .05, (a - (1 - fg[..., None]) * bg) / np.maximum(fg[..., None], .05), a)
    alpha = fg + (1 - fg) * sh
    rgb = np.where(alpha[..., None] > 1e-3, fg[..., None] * F / np.maximum(alpha[..., None], 1e-3), 0)
    alpha = np.where(alpha < .03, 0, alpha)

    out = np.dstack([np.clip(rgb, 0, 255), np.clip(alpha * 255, 0, 255)]).astype(np.uint8)
    Image.fromarray(out).save(os.path.join(dst, os.path.basename(f)))
print(f"{len(files)} frames -> {dst}")
