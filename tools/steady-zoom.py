"""Cancel a slow camera zoom in cut-out frames, so a walk-on-the-spot can loop without the
character growing and snapping back.

Measures the character's height and feet line in every frame (rows wider than 15% of the frame,
so a small object above it doesn't count), fits a straight line from frame FIT_FROM on, and scales
each frame around its feet so the character keeps the size and feet line of frame REF.

usage: python3 tools/steady-zoom.py <cut dir with fNNN.png> <out dir> [REF=61] [FIT_FROM=40]
Needs numpy + Pillow. tools/make-catch-video.sh runs it.
"""
import sys, glob, os
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
ref = int(sys.argv[3]) - 1 if len(sys.argv) > 3 else 60
fit_from = int(sys.argv[4]) if len(sys.argv) > 4 else 40
os.makedirs(dst, exist_ok=True)
files = sorted(glob.glob(os.path.join(src, "f*.png")))

height, feet = [], []
for f in files:
    a = np.asarray(Image.open(f))[..., 3] > 200
    rows = np.flatnonzero(a.sum(1) > a.shape[1] * .15)
    height.append(rows[-1] - rows[0]); feet.append(rows[-1])
i = np.arange(len(files))
ph = np.polyfit(i[fit_from:], np.array(height[fit_from:], float), 1)   # straight line: the zoom, not the walk's bob
pf = np.polyfit(i[fit_from:], np.array(feet[fit_from:], float), 1)

for k, f in enumerate(files):
    im = Image.open(f)
    a = np.polyval(ph, k) / np.polyval(ph, ref)                       # input pixels per output pixel
    cx = im.width / 2
    fy, fr = np.polyval(pf, k), np.polyval(pf, ref)
    # out(x, y) = in(cx + (x - cx) * a, fy + (y - fr) * a): same size, feet on the same line as frame REF
    im.transform(im.size, Image.AFFINE, (a, 0, cx - cx * a, 0, a, fy - fr * a), resample=Image.BICUBIC) \
      .save(os.path.join(dst, os.path.basename(f)))
print(f"{len(files)} frames steadied to frame {ref + 1} -> {dst}")
