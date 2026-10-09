#!/usr/bin/env node
/*
  Media for the Square & Plumb concept site (src/static/projects/square-plumb/media/).

  The source video shows an empty wall that fills with a kitchen, but most pieces just appear in a single
  frame. The scroll video makes them travel instead: each piece is cut out (what changed between the frame
  before and the frame it appears in) and moved into place over the room as it was, with motion blur.
    - tall pantries slide in from the sides, base cabinets slide along the floor, wall cabinets and the
      rangehood drop from the ceiling, bar stools roll in from the front
    - the island glide and the lights coming on keep every source frame
    - a keyframe every 6 frames, so the page can show any frame quickly while scrolling
  The frame numbers were picked for this source (where each piece appears); for a new export, re-check them.
  app.js in the concept times its captions and outlines to these frames: change both together.

  Outputs:
    build-1920.mp4, build-1280.mp4   the scroll video, no sound
    wall-1920.jpg, wall-1280.jpg     its first frame: shown at once, while the video loads
    done-1920.jpg, done-1280.jpg     its last frame: shown without JavaScript and when data is saved
    before.jpg, after.jpg            first and last frame for the before/after slider
    step-1…4.jpg                     four stages of the build for the process cards
    room.jpg                         the empty sunlit room (closing section)
    swatch-*.jpg, og.jpg             details of the finished kitchen photo, and the share image

  Needs ffmpeg (brew install ffmpeg); jpegtran (brew install jpeg-turbo) makes the JPEGs a little smaller.
  usage: node tools/make-square-plumb-media.js <build.mp4> <empty-room.png> <kitchen.png>
*/
const { spawn, spawnSync } = require("child_process");
const { once } = require("events");
const fs = require("fs");
const path = require("path");

const [video, roomPng, kitchenPng] = process.argv.slice(2);
if (!kitchenPng) {
  console.error("usage: node tools/make-square-plumb-media.js <build.mp4> <empty-room.png> <kitchen.png>");
  process.exit(1);
}
const OUT = path.join(__dirname, "..", "src", "static", "projects", "square-plumb", "media");
fs.mkdirSync(OUT, { recursive: true });

// ---- the build, as source frame numbers (24 fps, 1920×1080) ----
const SLIDE = 14;                         // frames for a piece to travel in; then the source frame itself
const FADE = 6;
// [frame it appears in, where it comes from, where it stands: left, top, right, bottom]. Floor-standing
// pieces include their reflection in the floor; wall cabinets the shadow under them.
const CABINETS = [
  [12, "right", [1549, 56, 1840, 1000]],  // tall pantry
  [31, "left", [1318, 556, 1549, 960]],   // base cabinets, right to left
  [35, "above", [1313, 56, 1549, 472]],   // wall cabinets
  [45, "left", [1086, 556, 1324, 960]],
  [48, "above", [1160, 56, 1313, 472]],
  [57, "left", [795, 556, 1091, 960]],
  [59, "above", [876, 56, 1167, 400]],    // rangehood canopy, in two halves
  [63, "left", [555, 556, 800, 960]],
  [65, "above", [700, 56, 1000, 400]],
  [72, "left", [318, 556, 560, 960]],
  [75, "above", [566, 56, 716, 472]],
  [79, "above", [318, 56, 573, 472]],
  [87, "left", [70, 56, 324, 1000]],      // the second tall pantry
];
const ISLAND = [104, 152];                // splashback, then the island glides in
const TAP = 153;                          // fades in
const STOOLS = [                          // roll in from the front; with the last one, the styling fades in
  [164, [528, 600, 735, 1080]], [169, [738, 600, 945, 1080]], [174, [948, 600, 1155, 1080]], [178, [1158, 600, 1365, 1080]],
];
const LIGHTS = [179, 196];                // lights come on

// The output, frame by frame: a source frame, a blend of two, or a piece on its way in.
const plan = [{ src: 0 }];
let state = 0;
const slideTo = (to, from, area, fadeRest = false) => {
  for (let i = 1; i <= SLIDE; i++) plan.push({ slide: { a: state, b: to, from, area, t: i / SLIDE, fadeRest } });
  plan.push({ src: to });
  state = to;
};
const fadeTo = (to) => {
  for (let k = 1; k <= FADE; k++) {
    const t = k / (FADE + 1);
    plan.push({ a: state, b: to, t: t * t * (3 - 2 * t) });
  }
  plan.push({ src: to });
  state = to;
};
CABINETS.forEach(([f, from, area]) => slideTo(f, from, area));
for (let n = ISLAND[0]; n <= ISLAND[1]; n++) plan.push({ src: n });
state = ISLAND[1];
fadeTo(TAP);
STOOLS.forEach(([f, area], i) => slideTo(f, "front", area, i === STOOLS.length - 1));
for (let n = LIGHTS[0]; n <= LIGHTS[1]; n++) plan.push({ src: n });

const W = 1920, H = 1080, FS = W * H * 3;
const run = (args) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
  if (r.status) throw new Error("ffmpeg failed: " + args.join(" "));
};
const optimise = (file) => {
  const r = spawnSync("jpegtran", ["-copy", "none", "-optimize", "-progressive", "-outfile", file + ".tmp", file]);
  if (r.status === 0) fs.renameSync(file + ".tmp", file);
  else fs.rmSync(file + ".tmp", { force: true });
};
const jpg = (name) => path.join(OUT, name);

// ---- cutting a piece out ----
// Binary dilate (erode = false) or erode over a (2r+1)² square, as two passes with running sums.
function morph(m, w, h, r, erode) {
  const pass = (src, len, lines, step, lineStep) => {
    const out = new Uint8Array(src.length), pre = new Uint32Array(len + 1);
    for (let l = 0; l < lines; l++) {
      const base = l * lineStep;
      for (let i = 0; i < len; i++) pre[i + 1] = pre[i] + src[base + i * step];
      for (let i = 0; i < len; i++) {
        const a = Math.max(0, i - r), b = Math.min(len, i + r + 1), sum = pre[b] - pre[a];
        out[base + i * step] = erode ? (sum === b - a ? 1 : 0) : (sum > 0 ? 1 : 0);
      }
    }
    return out;
  };
  return pass(pass(m, w, h, 1, w), h, w, w, 1);
}

// What changed between two frames inside a piece's area, as a soft-edged mask over its bounding box.
function pieceMask(A, B, [ax0, ay0, ax1, ay1]) {
  const TH = 24, m = new Uint8Array(W * H), cols = new Uint32Array(W), rows = new Uint32Array(H);
  for (let y = ay0; y < ay1; y++) for (let x = ax0; x < ax1; x++) {
    const p = y * W + x, i = p * 3;
    const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
    if (d > TH) { m[p] = 1; cols[x]++; rows[y]++; }
  }
  const span = (arr, min) => {                    // rows/columns with a few changed pixels: drops stray shimmer
    let a = 0, b = arr.length - 1;
    while (a < b && arr[a] < min) a++;
    while (b > a && arr[b] < min) b--;
    return [a, b + 1];
  };
  let [x0, x1] = span(cols, 4), [y0, y1] = span(rows, 4);
  x0 = Math.max(ax0, x0 - 2); y0 = Math.max(ay0, y0 - 2); x1 = Math.min(ax1, x1 + 2); y1 = Math.min(ay1, y1 + 2);
  const w = x1 - x0, h = y1 - y0;
  let r = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) r[y * w + x] = m[(y0 + y) * W + x0 + x];
  r = morph(morph(r, w, h, 5, false), w, h, 5, true);   // close: fill small gaps inside the piece
  r = morph(morph(r, w, h, 1, true), w, h, 1, false);   // open: drop specks
  const a = new Float32Array(w * h);                      // 3×3 blur: a one-pixel soft edge
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const yy = y + dy, xx = x + dx;
      if (yy >= 0 && yy < h && xx >= 0 && xx < w) s += r[yy * w + xx];
    }
    a[y * w + x] = s / 9;
  }
  return { x0, y0, w, h, a };
}

// How far a piece travels and how it arrives
const outQuart = (t) => 1 - Math.pow(1 - t, 4);
const outBack = (s) => (t) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const MOVES = {
  left: { ease: outQuart, start: (k) => [-(k.x0 + k.w) - 30, 0] },        // along the floor, from off the left side
  right: { ease: outBack(0.8), start: (k) => [W - k.x0 + 30, 0] },        // from off the right side
  above: { ease: outBack(1.3), start: (k) => [0, -(k.y0 + k.h) - 30] },   // dropped from the ceiling, a small bounce
  front: { ease: outBack(1.0), start: (k) => [0, H - k.y0 + 30] },        // rolled in from the front
};

// The piece (from frame B, inside mask k) drawn over frame A at several points along its path: motion blur.
// fadeT: everything outside the piece's area fades from A to B at the same time (styling, first lights).
function slideFrame(A, B, k, area, offs, fadeT) {
  let bg = A;
  if (fadeT !== undefined) {
    bg = Buffer.alloc(FS);
    for (let p = 0, i = 0; p < W * H; p++, i += 3) {
      const x = p % W, y = (p / W) | 0;
      const t = x >= area[0] && x < area[2] && y >= area[1] && y < area[3] ? 0 : fadeT;
      for (let c = 0; c < 3; c++) bg[i + c] = A[i + c] + (B[i + c] - A[i + c]) * t + 0.5;
    }
  }
  const out = Buffer.from(bg), n = offs.length;
  let rx0 = W, ry0 = H, rx1 = 0, ry1 = 0;
  for (const [dx, dy] of offs) {
    rx0 = Math.min(rx0, k.x0 + dx); ry0 = Math.min(ry0, k.y0 + dy);
    rx1 = Math.max(rx1, k.x0 + k.w + dx); ry1 = Math.max(ry1, k.y0 + k.h + dy);
  }
  rx0 = Math.max(0, rx0); ry0 = Math.max(0, ry0); rx1 = Math.min(W, rx1); ry1 = Math.min(H, ry1);
  for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++) {
    const p = (y * W + x) * 3;
    let r = 0, g = 0, b = 0, hit = false;
    for (const [dx, dy] of offs) {
      const mx = x - dx - k.x0, my = y - dy - k.y0;
      const a = mx >= 0 && my >= 0 && mx < k.w && my < k.h ? k.a[my * k.w + mx] : 0;
      if (a > 0) {
        const q = ((y - dy) * W + (x - dx)) * 3;
        r += bg[p] + (B[q] - bg[p]) * a; g += bg[p + 1] + (B[q + 1] - bg[p + 1]) * a; b += bg[p + 2] + (B[q + 2] - bg[p + 2]) * a;
        hit = true;
      } else {
        r += bg[p]; g += bg[p + 1]; b += bg[p + 2];
      }
    }
    if (hit) { out[p] = r / n + 0.5; out[p + 1] = g / n + 0.5; out[p + 2] = b / n + 0.5; }
  }
  return out;
}

async function buildVideo() {
  // every source frame the plan uses, kept in memory
  const need = new Set();
  for (const p of plan) for (const n of [p.src, p.a, p.b, p.slide?.a, p.slide?.b]) if (n !== undefined) need.add(n);
  const frames = new Map();
  const dec = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", video,
    "-vf", `scale=${W}:${H}:in_color_matrix=bt709:in_range=tv,format=rgb24`, "-f", "rawvideo", "-"],
  { stdio: ["ignore", "pipe", "inherit"] });
  const decoded = once(dec, "close");
  let n = 0, fill = 0, cur = Buffer.alloc(FS);
  for await (const chunk of dec.stdout) {
    for (let off = 0; off < chunk.length;) {
      const take = Math.min(FS - fill, chunk.length - off);
      chunk.copy(cur, fill, off, off + take);
      fill += take; off += take;
      if (fill < FS) continue;
      if (need.has(n)) { frames.set(n, cur); cur = Buffer.alloc(FS); }
      fill = 0; n++;
    }
  }
  const [decodeExit] = await decoded;
  const missing = [...need].filter((f) => !frames.has(f));
  if (decodeExit || missing.length) throw new Error(`could not read frame ${missing[0] ?? ""} of ${video} (it has ${n} frames)`);

  const x264 = (crf) => ["-c:v", "libx264", "-preset", "slow", "-tune", "film", "-crf", String(crf), "-bf", "0",
    "-x264-params", "keyint=6:min-keyint=6:scenecut=0", "-pix_fmt", "yuv420p",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart", "-an"];
  const enc = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${W}x${H}`, "-r", "24", "-i", "-",
    "-filter_complex", "[0]split=2[a][b];" +
      "[a]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[big];" +
      "[b]scale=1280:720:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p[small]",
    "-map", "[big]", ...x264(25), jpg("build-1920.mp4"),
    "-map", "[small]", ...x264(24), jpg("build-1280.mp4")], { stdio: ["pipe", "inherit", "inherit"] });
  const write = async (frame) => { if (!enc.stdin.write(frame)) await once(enc.stdin, "drain"); };

  const masks = new Map();
  for (const p of plan) {
    if (p.src !== undefined) { await write(frames.get(p.src)); continue; }
    if (!p.slide) {
      const A = frames.get(p.a), B = frames.get(p.b), out = Buffer.alloc(FS);
      for (let i = 0; i < FS; i++) out[i] = A[i] + (B[i] - A[i]) * p.t + 0.5;
      await write(out);
      continue;
    }
    const { a, b, from, area, t, fadeRest } = p.slide, A = frames.get(a), B = frames.get(b);
    const key = `${a}-${b}`;
    if (!masks.has(key)) masks.set(key, pieceMask(A, B, area));
    const k = masks.get(key), move = MOVES[from], [sx, sy] = move.start(k);
    const at = (tt) => { const q = move.ease(Math.max(0, tt)); return [sx * (1 - q), sy * (1 - q)]; };
    // the shutter is open for the last 60% of the frame: a streak as long as that stretch of the path
    const [ax, ay] = at(t - 0.6 / SLIDE), [bx, by] = at(t);
    const steps = Math.max(1, Math.min(20, Math.ceil(Math.hypot(bx - ax, by - ay) / 5)));
    const offs = [];
    for (let s = 0; s < steps; s++) {
      const [x, y] = at(t - (0.6 / SLIDE) * (steps > 1 ? 1 - s / (steps - 1) : 0));
      offs.push([Math.round(x), Math.round(y)]);
    }
    await write(slideFrame(A, B, k, area, offs, fadeRest ? Math.min(1, t * 1.3) : undefined));
  }
  enc.stdin.end();
  const [code] = await once(enc, "close");
  if (code) throw new Error("video encode failed");
  console.log(`build video: ${plan.length} frames`);
}

function stills() {
  const frame = (n, w, file, q = 3) => {
    run(["-i", video, "-vf", `select=eq(n\\,${n}),scale=${w}:-2:flags=lanczos`, "-fps_mode", "passthrough",
      "-frames:v", "1", "-q:v", String(q), file]);
    optimise(file);
  };
  const last = LIGHTS[1];
  frame(0, 1920, jpg("wall-1920.jpg"));
  frame(0, 1280, jpg("wall-1280.jpg"));
  frame(last, 1920, jpg("done-1920.jpg"));
  frame(last, 1280, jpg("done-1280.jpg"));
  frame(0, 1440, jpg("before.jpg"));
  frame(last, 1440, jpg("after.jpg"));
  // four stages for the process cards, cut to 4:3 around where the work happens
  const stage = (n, cropX, file) => {
    run(["-i", video, "-vf", `select=eq(n\\,${n}),crop=1280:960:${cropX}:60,scale=800:600:flags=lanczos`,
      "-fps_mode", "passthrough", "-frames:v", "1", "-q:v", "4", jpg(file)]);
    optimise(jpg(file));
  };
  stage(0, 320, "step-1.jpg");
  stage(48, 640, "step-2.jpg");
  stage(130, 480, "step-3.jpg");
  stage(last, 320, "step-4.jpg");

  // the photos: empty room for the closing section, kitchen for its details and the share image
  const still = (src, vf, file, q = 4) => {
    run(["-i", src, "-vf", vf, "-frames:v", "1", "-q:v", String(q), jpg(file)]);
    optimise(jpg(file));
  };
  still(roomPng, "scale=1448:-2", "room.jpg");
  still(kitchenPng, "crop=1200:630:236:150,scale=1200:630", "og.jpg");
  // details of the finished kitchen (left, top, width in the 1672×941 photo), as 3:4 tiles
  const swatch = (name, x, y, w) => still(kitchenPng, `crop=${w}:${Math.round(w * 4 / 3)}:${x}:${y},scale=450:600:flags=lanczos`, `swatch-${name}.jpg`);
  swatch("kitchen", 700, 330, 300);     // tap and marble
  swatch("tall", 1395, 150, 210);       // pantry doors with long brass handles
  swatch("shelving", 1165, 170, 200);   // lit glass cabinet
  swatch("stools", 640, 450, 360);      // bar stools
}

(async () => {
  await buildVideo();
  stills();
  for (const f of fs.readdirSync(OUT).sort()) console.log(`  ${f.padEnd(18)} ${(fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0).padStart(6)} KB`);
})().catch((e) => { console.error(e.message); process.exit(1); });
