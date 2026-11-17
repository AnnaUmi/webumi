// Square & Plumb concept: a kitchen goes in as you scroll.
// The video (tools/make-square-plumb-media.js) moves every piece into place; this script picks the frame for the
// scroll position, moves a camera, and draws the laser lines, outlines and tags in the same 1920×1080 frame.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ramp = (v, a, b) => clamp((v - a) / (b - a), 0, 1);     // 0 before a, 1 after b
  const ease = (t) => t * t * (3 - 2 * t);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const portraitQuery = matchMedia("(max-aspect-ratio: 1/1)");

  // ---------- the scroll video, as made by the media tool ----------
  const FPS = 24;
  const STEP = 15;                                   // a piece: 14 frames on its way in, then the frame with it in place
  // where pieces come from: how far into their stretch of scrolling they touch down, and how hard they land
  const MOVES = { right: { land: 0.43, bump: 5 }, left: { land: 0.47, bump: 2.5 }, above: { land: 0.33, bump: 3 }, front: { land: 0.38, bump: 1.5 } };
  // Pieces in the order they go in. r = the piece in the 1920×1080 frame: [left, top, right, bottom].
  const PIECES = [
    { from: "right", r: [1549, 64, 1823, 744], tag: "Tall pantry", note: "1 of 2", bump: 5 },
    { from: "left", r: [1324, 567, 1549, 744], tag: "Base cabinet", note: "1 of 5" },
    { from: "above", r: [1313, 64, 1549, 447], tag: "Wall cabinet", note: "1 of 4" },
    { from: "left", r: [1091, 567, 1324, 744], tag: "Base cabinet", note: "2 of 5" },
    { from: "above", r: [1167, 64, 1313, 447], tag: "Wall cabinet", note: "2 of 4" },
    { from: "left", r: [800, 567, 1091, 744], tag: "Base cabinet", note: "3 of 5" },
    { from: "above", r: [716, 64, 1167, 373], tag: "Rangehood canopy", note: "", until: 8 },   // comes in two halves
    { from: "left", r: [560, 567, 800, 744], tag: "Base cabinet", note: "4 of 5" },
    { from: "above", focus: 860 },                                                            // the canopy's second half
    { from: "left", r: [324, 567, 560, 744], tag: "Base cabinet", note: "5 of 5" },
    { from: "above", r: [573, 64, 716, 447], tag: "Wall cabinet", note: "3 of 4" },
    { from: "above", r: [324, 64, 573, 447], tag: "Wall cabinet", note: "4 of 4" },
    { from: "left", r: [83, 64, 324, 744], tag: "Tall pantry", note: "2 of 2", bump: 5 },
  ];
  const ISLAND = { x0: PIECES.length * STEP, x1: PIECES.length * STEP + 49, r: [311, 593, 1576, 880] };
  const TAP = { x0: ISLAND.x1, x1: ISLAND.x1 + 7 };   // the tap fades in
  const STOOLS = [630, 840, 1050, 1260];             // bar stools roll in, left to right: their centres
  const LAST = TAP.x1 + STOOLS.length * STEP + 18;   // the lights come on over the last 18 frames

  const LINES = {                                    // laser lines: bench height, underside of the wall cabinets, plumb
    bench: { x1: 83, y1: 567, x2: 1823, y2: 567 },
    wall: { x1: 83, y1: 447, x2: 1823, y2: 447 },
    plumb: { x1: 1549, y1: 64, x2: 1549, y2: 744 },
  };

  // ---------- the timeline, in screen heights of scrolling ----------
  const segs = [];
  let total = 0;
  const seg = (kind, len, extra = {}) => {
    const s = { kind, len, t0: total, ...extra };
    segs.push(s);
    total += len;
    return s;
  };
  const sIntro = seg("intro", 0.35);
  const sMeasure = seg("measure", 0.8);
  const sPieces = PIECES.map((p, k) => seg("piece", 0.2, { p, k, x0: k * STEP, x1: (k + 1) * STEP }));
  const sIsland = seg("island", 1, { x0: ISLAND.x0, x1: ISLAND.x1 });
  const sTap = seg("tap", 0.12, TAP);
  const sStools = STOOLS.map((x, k) => seg("stool", 0.17, { k, x0: TAP.x1 + k * STEP, x1: TAP.x1 + (k + 1) * STEP }));
  const sLights = seg("lights", 0.45, { x0: TAP.x1 + STOOLS.length * STEP, x1: LAST });
  const sEnd = seg("end", 0.35);
  const TOTAL = total;
  const v = (s, T) => (T - s.t0) / s.len;            // progress through a segment (keeps going below 0 and above 1)

  const segAt = (T) => {
    for (let i = segs.length - 1; i >= 0; i--) if (T >= segs[i].t0) return segs[i];
    return segs[0];
  };
  const frameAt = (T) => {
    const s = segAt(T), u = v(s, T);
    switch (s.kind) {
      case "intro": case "measure": return 0;
      case "piece": case "stool": return lerp(s.x0, s.x1, ramp(u, 0, 0.82));   // the video already eases each move
      case "tap": return lerp(s.x0, s.x1, ramp(u, 0, 0.9));
      case "island": return lerp(s.x0, s.x1, ramp(u, 0.15, 0.92));
      case "lights": return lerp(s.x0, s.x1, ramp(u, 0, 0.9));
      default: return LAST;
    }
  };

  const CHAPTERS = [
    { name: "The wall", t: sMeasure.t0 },
    { name: "Tall pantry", t: sPieces[0].t0 },
    { name: "Cabinets", t: sPieces[1].t0 },
    { name: "Island", t: sIsland.t0 },
    { name: "Details", t: sTap.t0 },
    { name: "Ready", t: sLights.t0 },
  ];
  const chapterAt = (T) => {
    let c = 0;
    CHAPTERS.forEach((ch, i) => { if (T >= ch.t - 0.02) c = i; });
    return c;
  };

  // Time on site: minutes of work at each step; a working day runs 7:30 am to 5:00 pm.
  const WORK = [[sMeasure.t0, 0], [sPieces[0].t0, 70], [sPieces[1].t0, 120], [sIsland.t0, 950],
    [sTap.t0, 1180], [sLights.t0, 1460], [sEnd.t0, 1680]];
  const DAY = 570;
  const clockAt = (T) => {
    let m = WORK[0][1];
    for (let i = 1; i < WORK.length; i++) {
      if (T <= WORK[i][0]) { m = lerp(WORK[i - 1][1], WORK[i][1], ramp(T, WORK[i - 1][0], WORK[i][0])); break; }
      m = WORK[i][1];
    }
    const day = Math.min(3, Math.floor(m / DAY) + 1);
    const min = 450 + Math.round((m - (day - 1) * DAY) / 10) * 10;
    const h = Math.floor(min / 60);
    return `Day ${day} · ${((h + 11) % 12) + 1}:${String(min % 60).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
  };

  // ---------- elements ----------
  const build = $("build"), stage = $("stage"), view = $("view"), camera = $("camera");
  const done = $("done"), video = $("video"), plan = $("plan"), tagLayer = $("tags");
  const intro = $("intro"), card = $("card"), cardNum = $("cardNum"), clock = $("clock");
  const stepList = $("steps"), steps = [...stepList.children];
  const fitSteps = () => { stepList.style.height = `${steps[render.c || 0].offsetHeight}px`; };
  const rail = $("rail"), railTrack = $("railTrack"), railNum = $("railNum"), railName = $("railName"), railHint = $("railHint");
  const top = $("top");
  build.style.setProperty("--units", TOTAL.toFixed(3));

  const NS = "http://www.w3.org/2000/svg";
  const svg = (name, attrs, parent) => {
    const el = document.createElementNS(NS, name);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    parent.append(el);
    return el;
  };
  const CHECK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.4l2.6 2.6L10 3.4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';
  const makeTag = (text, note, laser) => {
    const el = document.createElement("span");
    el.className = "tag" + (laser ? " tag--laser" : "");
    el.innerHTML = (laser ? "" : CHECK) + text + (note ? ` <small>${note}</small>` : "");
    tagLayer.append(el);
    return el;
  };

  // laser lines, drawn from their start point; a bright head travels with the tip
  const beams = {};
  for (const [name, l] of Object.entries(LINES)) {
    const g = svg("g", { class: "beam", opacity: 0 }, $("beams"));
    const lines = ["beam__halo", "beam__glow", "beam__core"].map((c) => svg("line", { class: c, x1: l.x1, y1: l.y1, x2: l.x1, y2: l.y1 }, g));
    const flare = svg("circle", { class: "beam__flare", r: 15, cx: l.x1, cy: l.y1 }, g);
    const head = svg("circle", { r: 4.5, cx: l.x1, cy: l.y1 }, g);
    beams[name] = { l, g, lines, flare, head };
  }
  beams.bench.tag = makeTag("Level line", "900 mm", true);
  beams.wall.tag = makeTag("Wall cabinets", "1,550 mm", true);
  beams.plumb.tag = makeTag("Plumb", "", true);
  beams.plumb.tag.classList.add("tag--left");
  const studs = [];                                  // studs every 450 mm, marked as the bench line passes
  for (let x = 167; x < 1823; x += 87) studs.push({ x, el: svg("line", { class: "stud", x1: x, x2: x, y1: 555, y2: 579 }, $("beams")) });

  // a dashed landing zone for each piece before it arrives; corners and a tag once it's in place
  const box = (r) => `M${r[0]} ${r[1]}H${r[2]}V${r[3]}H${r[0]}Z`;
  const corners = (r, s = 26) => [[r[0], r[1], 1, 1], [r[2], r[1], -1, 1], [r[2], r[3], -1, -1], [r[0], r[3], 1, -1]]
    .map(([x, y, a, b]) => `M${x} ${y + b * s}V${y}H${x + a * s}`).join("");
  const outlines = $("outlines");
  const marks = [];
  PIECES.forEach((p, k) => {
    if (!p.r) return;
    marks.push({                                     // a piece that comes in halves is done when its last half lands
      s: sPieces[k], done: sPieces[p.until ?? k], r: p.r, land: MOVES[PIECES[p.until ?? k].from].land,
      path: svg("path", { class: "outline outline--target", d: box(p.r), opacity: 0 }, outlines),
      corners: svg("path", { class: "corners", d: corners(p.r) }, outlines),
      tag: makeTag(p.tag, p.note),
    });
  });
  const island = {
    target: svg("path", { class: "outline outline--target", d: box(ISLAND.r), opacity: 0 }, outlines),
    path: svg("path", { class: "outline", d: box(ISLAND.r), opacity: 0 }, outlines),
    corners: svg("path", { class: "corners", d: corners(ISLAND.r, 34) }, outlines),
    tag: makeTag("Island", "4.1 m, fixed down"),
  };
  const stoolsTag = makeTag("Bar stool", "1 of 4");
  const stoolsNote = stoolsTag.querySelector("small");

  // ---------- layout and camera ----------
  let vw = 1, vh = 1, portrait = false, zFit = 1, zEnd = 1, dist = 1;
  const measure = () => {
    vw = view.clientWidth || 1;
    vh = view.clientHeight || 1;
    portrait = portraitQuery.matches;
    zFit = vw / Math.max(vw, vh * 16 / 9);           // whole frame visible across the width
    zEnd = clamp(zFit * 1920 / 1300, zFit, 1);       // the finished island, end to end
    dist = Math.max(1, build.offsetHeight - stage.offsetHeight);
  };

  // where the camera looks (frame x) and how close: phones follow the work, wide screens drift a little
  const centre = (r) => (r[0] + r[2]) / 2;
  const focusOfPiece = (k) => (PIECES[k].r ? centre(PIECES[k].r) : PIECES[k].focus);
  const cameraAt = (T) => {
    let fx = 960, fy = 540, z = 1;
    if (T < sPieces[0].t0 - 0.1) {                   // phones: follow the laser across the wall
      const mv = v(sMeasure, T);
      if (portrait) fx = mv < 0.06 ? lerp(960, 83, ease(ramp(mv, -0.3, 0.06))) : lerp(83, 1823, ease(ramp(mv, 0.06, 0.5)));
    } else if (T < sIsland.t0) {
      const s = segAt(T);
      const k = s.kind === "piece" ? s.k : 0;
      fx = lerp(focusOfPiece(Math.max(0, k - 1)), focusOfPiece(k), ease(ramp(v(s, T), -0.1, 0.45)));
    } else if (T < sTap.t0) {                       // follow the island as it glides in
      fx = lerp(1600, 944, ease(ramp(v(sIsland, T), 0.2, 0.95)));
    }
    if (portrait) {
      const end = ease(ramp(v(sLights, T), 0.1, 0.95));
      z = lerp(1, zEnd, end);
      fy = lerp(540, 300, end);                      // the finished room sits low, close to the words
    } else {
      const island = ramp(v(sIsland, T), -0.2, 0.1) * (1 - ramp(v(sIsland, T), 0.95, 1.4));
      fx = lerp(960, fx, lerp(0.28, 0.55, island));
      fy = lerp(470, 560, island);                   // tops clear of the menu; lower for the island
      z = 1.07 - 0.07 * ease(ramp(v(sMeasure, T), 0, 0.3)) + 0.05 * ease(ramp(v(sPieces[0], T), -0.3, 0.6))
        + 0.05 * ease(island) - 0.02 * ease(ramp(v(sIsland, T), 0.9, 1.5)) - 0.03 * ease(ramp(v(sLights, T), 0, 1));
    }
    if (reduceMotion) return { fx: 960, fy: 540, z: portrait ? zFit : 1 };
    return { fx, fy, z };
  };

  // a small bump each time something lands, only while scrolling forwards
  const LANDINGS = [
    ...sPieces.map((s, k) => ({ t: s.t0 + s.len * MOVES[PIECES[k].from].land, amp: PIECES[k].bump || MOVES[PIECES[k].from].bump })),
    { t: sIsland.t0 + sIsland.len * 0.86, amp: 6 },
    ...sStools.map((s) => ({ t: s.t0 + s.len * MOVES.front.land, amp: MOVES.front.bump })),
  ];
  let bumpAt = -1e9, bumpAmp = 0;
  const bumpY = (now) => {
    const t = (now - bumpAt) / 1000;
    return t > 0.5 ? 0 : bumpAmp * Math.exp(-t * 11) * Math.sin(t * 2 * Math.PI * 13);
  };

  const cam = { fx: 960, fy: 540, z: 1 };
  const map = { k: 1, x: 0, y: 0 };                 // frame → view: x' = map.x + X * map.k
  let lastK = 0;
  const placeCamera = () => {
    const cw = Math.max(vw, vh * 16 / 9);
    const W = cw * cam.z, H = W * 9 / 16;
    let dx = -(cam.fx / 1920 - 0.5) * W, dy = -(cam.fy / 1080 - 0.5) * H;
    dx = W > vw ? clamp(dx, -(W - vw) / 2, (W - vw) / 2) : 0;
    dy = clamp(dy, -Math.abs(H - vh) / 2, Math.abs(H - vh) / 2) + bumpY(performance.now());
    camera.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${cam.z.toFixed(5)})`;
    map.k = W / 1920;
    map.x = vw / 2 + dx - W / 2;
    map.y = vh / 2 + dy - H / 2;
    if (Math.abs(map.k - lastK) > 1e-4) { plan.style.setProperty("--k", (1 / map.k).toFixed(4)); lastK = map.k; }
  };

  const shown = new Map();                           // last opacity per tag, so hidden tags aren't touched each frame
  const widths = new Map();                          // measured once, so a tag can be kept inside the screen
  const placeTag = (el, a, X, Y, ox = 0, oy = 0, minX = -1e4) => {
    if (a < 0.01) {
      if (shown.get(el) !== 0) { el.style.opacity = 0; shown.set(el, 0); }
      return;
    }
    if (!widths.has(el)) widths.set(el, el.classList.contains("tag--left") ? 0 : el.offsetWidth);
    const x = Math.max(minX, Math.min(map.x + X * map.k + ox, vw - widths.get(el) - 8));
    el.style.opacity = a.toFixed(3);
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${(map.y + Y * map.k + oy).toFixed(1)}px, 0)`;
    shown.set(el, a);
  };

  // ---------- the video ----------
  let videoOk = false, stills = false, frameShown = -1, frameWanted = 0, seeking = false, seekAt = 0;
  const showFrame = (i) => {
    frameWanted = i;
    if (!videoOk || i === frameShown) return;
    if (seeking && performance.now() - seekAt < 400) return;   // one seek at a time; the newest frame wins
    seeking = true;
    seekAt = performance.now();
    frameShown = i;
    video.currentTime = (i + 0.5) / FPS;
  };
  video.addEventListener("seeked", () => {
    seeking = false;
    video.classList.add("is-ready");
    if (frameWanted !== frameShown) showFrame(frameWanted);
  });

  const net = navigator.connection || {};
  const saveData = !!net.saveData;
  const slowNet = /(^|-)(2g|3g)$/.test(net.effectiveType || "");
  const big = () => {
    const shownWidth = portrait ? vw / 0.45 : Math.max(vw, vh * 16 / 9) * 1.07;
    return shownWidth * (devicePixelRatio || 1) > 1500 && !slowNet;
  };
  const useStills = () => {                          // no video: the finished kitchen fades in instead
    stills = true;
    done.src = big() ? "media/done-1920.jpg" : "media/done-1280.jpg";
    done.hidden = false;
    wake();
  };
  let loaded = 0;
  const loadVideo = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const size = +res.headers.get("content-length") || 0;
    let blob;
    if (res.body && size) {
      const reader = res.body.getReader(), parts = [];
      let got = 0;
      for (;;) {
        const { done: end, value } = await reader.read();
        if (end) break;
        parts.push(value);
        got += value.length;
        loaded = Math.min(1, got / size);
        wake();                                      // the rail shows the progress
      }
      blob = new Blob(parts, { type: "video/mp4" });
    } else {
      blob = await res.blob();
    }
    loaded = 1;
    video.preload = "auto";                          // the HTML says "none" so nothing streams before this download
    video.src = URL.createObjectURL(blob);
    video.load();
    await new Promise((ok, fail) => {
      video.addEventListener("loadeddata", ok, { once: true });
      video.addEventListener("error", fail, { once: true });
      setTimeout(() => fail(new Error("video did not start")), 10000);
    });
    try { await video.play(); } catch { /* blocked (e.g. Low Power Mode): seeking still shows frames */ }
    video.pause();
    videoOk = true;
    frameShown = -1;
    showFrame(frameWanted);
    wake();
  };

  // ---------- drawing one moment of the build ----------
  let T = 0, target = 0;
  const render = () => {
    const x = frameAt(T);
    const frame = Math.round(x);
    showFrame(frame);
    if (stills) done.style.opacity = ease(ramp(T, sPieces[0].t0, sLights.t0 + sLights.len)).toFixed(3);

    placeCamera();

    // laser lines
    const mv = v(sMeasure, T);
    const draws = { bench: ease(ramp(mv, 0.06, 0.5)), wall: ease(ramp(mv, 0.12, 0.56)), plumb: ease(ramp(mv, 0.62, 0.85)) };
    const fades = {
      bench: 1 - ramp(T, sPieces[10].t0, sPieces[10].t0 + 0.12),
      wall: 1 - ramp(T, sPieces[12].t0, sPieces[12].t0 + 0.12),
      plumb: 1 - ramp(T, sPieces[1].t0 + 0.05, sPieces[1].t0 + 0.17),
    };
    for (const name in beams) {
      const b = beams[name], d = draws[name], a = d > 0 ? fades[name] : 0;
      b.g.setAttribute("opacity", a.toFixed(3));
      if (a <= 0) { placeTag(b.tag, 0); continue; }
      const hx = lerp(b.l.x1, b.l.x2, d), hy = lerp(b.l.y1, b.l.y2, d);
      for (const ln of b.lines) { ln.setAttribute("x2", hx.toFixed(1)); ln.setAttribute("y2", hy.toFixed(1)); }
      const tip = d > 0 && d < 1 ? 1 : 0;
      for (const c of [b.flare, b.head]) { c.setAttribute("cx", hx.toFixed(1)); c.setAttribute("cy", hy.toFixed(1)); c.setAttribute("opacity", tip); }
      const ta = a * ramp(d, 0.92, 1) * (1 - ramp(T, sPieces[0].t0 + 0.04, sPieces[0].t0 + 0.14));
      if (name === "plumb") placeTag(b.tag, ta, b.l.x1, 300, -12, 0);
      else placeTag(b.tag, ta, 360, b.l.y1, 0, -36, 16);   // stays on screen while the camera pans
      if (name === "bench") for (const s of studs) s.el.style.opacity = (a * ramp(hx, s.x - 6, s.x + 40)).toFixed(3);
    }

    // a piece's landing zone shows before it arrives; corners and tag when it touches down; gone two pieces later
    for (const m of marks) {
      const u = v(m.s, T), du = v(m.done, T), out = 1 - ramp(du, 1.45, 2);
      const landed = ramp(du, m.land, m.land + 0.12);
      m.path.setAttribute("opacity", (ramp(u, -0.5, -0.2) * (1 - landed)).toFixed(3));
      m.corners.style.opacity = (landed * out).toFixed(3);
      placeTag(m.tag, landed * out, m.r[0], m.r[1], 12, 12);
    }

    // the island: a dashed target on the floor, then it glides in
    const iu = v(sIsland, T), ia = ramp(iu, -0.05, 0.1) * (1 - ramp(T, sStools[0].t0, sStools[0].t0 + 0.1));
    const iLanded = ramp(iu, 0.9, 1);
    island.target.setAttribute("opacity", (ia * (1 - iLanded)).toFixed(3));
    island.path.setAttribute("opacity", (ia * iLanded).toFixed(3));
    island.corners.style.opacity = (ia * iLanded).toFixed(3);
    placeTag(island.tag, ia * iLanded, 560, ISLAND.r[1], 0, 12);
    let stools = 0;
    sStools.forEach((s, i) => { if (v(s, T) >= MOVES.front.land) stools = i + 1; });
    if (stools && stools !== render.stools) { stoolsNote.textContent = `${(render.stools = stools)} of 4`; widths.delete(stoolsTag); }
    placeTag(stoolsTag, ramp(v(sStools[0], T), MOVES.front.land, MOVES.front.land + 0.12) * (1 - ramp(v(sLights, T), 0.15, 0.35)),
      STOOLS[Math.max(0, stools - 1)] - 70, 612, 0, 0);

    // words
    const ia2 = 1 - ease(ramp(T, 0.04, 0.22));
    intro.style.opacity = ia2.toFixed(3);
    intro.style.transform = `translate3d(0, ${(-30 * (1 - ia2)).toFixed(1)}px, 0)`;
    intro.style.visibility = ia2 < 0.02 ? "hidden" : "";
    const ca = ease(ramp(T, 0.24, 0.4));            // after the intro has gone (phones show both in one place)
    card.style.opacity = ca.toFixed(3);
    card.style.transform = `translate3d(0, ${(18 * (1 - ca)).toFixed(1)}px, 0)`;
    card.classList.toggle("is-on", ca > 0.5);
    const c = chapterAt(T);
    if (c !== render.c) {
      render.c = c;
      steps.forEach((el, i) => {
        el.classList.toggle("is-on", i === c);
        for (const a of el.querySelectorAll("a")) a.tabIndex = i === c ? 0 : -1;
      });
      fitSteps();
      cardNum.textContent = railNum.textContent = String(c + 1).padStart(2, "0");
      railName.textContent = CHAPTERS[c].name;
    }
    const time = clockAt(T);
    if (time !== render.time) clock.textContent = render.time = time;

    railTrack.style.setProperty("--p", (T / TOTAL).toFixed(4));
    const finished = T >= sEnd.t0 - 0.05;
    const hint = finished ? "Built" : !videoOk && !stills && T > sIntro.len ? `Loading ${Math.round(loaded * 100)}%` : "Scroll to build";
    if (hint !== render.hint) { railHint.textContent = render.hint = hint; rail.classList.toggle("is-done", finished); }
    railTrack.style.setProperty("--load", videoOk || stills ? 1 : loaded.toFixed(3));
  };

  // chapter ticks on the rail
  for (const ch of CHAPTERS) {
    const tick = document.createElement("i");
    tick.className = "rail__tick";
    tick.style.left = `${(ch.t / TOTAL) * 100}%`;
    railTrack.append(tick);
  }

  // ---------- the loop: runs while the build is on screen and something is moving ----------
  const scrollT = () => clamp(-build.getBoundingClientRect().top / dist, 0, 1) * TOTAL;
  let visible = false, raf = 0, last = 0, still = 0, drawn = "";
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 1 / 60);
    last = now;
    target = scrollT();
    const was = T;
    T += (target - T) * (1 - Math.exp(-dt * 9));    // scrolling feels weighted, never jumpy
    if (Math.abs(target - T) < 2e-4) T = target;
    if (!reduceMotion && T > was && T - was < 0.25) {
      for (const l of LANDINGS) if (was < l.t && T >= l.t) { bumpAt = now; bumpAmp = l.amp; }
    }
    const goal = cameraAt(T), k = 1 - Math.exp(-dt * 4);
    cam.fx += (goal.fx - cam.fx) * k;
    cam.fy += (goal.fy - cam.fy) * k;
    cam.z += (goal.z - cam.z) * k;
    const state = `${T.toFixed(5)} ${cam.fx.toFixed(2)} ${cam.fy.toFixed(2)} ${cam.z.toFixed(4)} ${loaded.toFixed(2)} ${videoOk} ${stills} ${bumpY(now).toFixed(2)}`;
    if (state !== drawn) { drawn = state; render(); still = 0; } else still++;
    raf = visible && still < 20 ? requestAnimationFrame(loop) : 0;
  };
  function wake() {
    if (visible && !raf) { last = performance.now(); still = 0; raf = requestAnimationFrame(loop); }
  }
  new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; wake(); }).observe(build);
  addEventListener("scroll", wake, { passive: true });

  const relayout = () => {
    measure();
    Object.assign(cam, cameraAt(T));
    fitSteps();
    render();
    wake();
  };
  new ResizeObserver(relayout).observe(view);
  portraitQuery.addEventListener?.("change", relayout);
  measure();
  T = target = scrollT();                            // a reload halfway down starts where the visitor was
  Object.assign(cam, cameraAt(T));
  render();
  document.fonts?.ready.then(() => { widths.clear(); fitSteps(); });   // sizes change once the fonts arrive

  if (saveData) useStills();
  else loadVideo(big() ? video.dataset.big : video.dataset.small).catch(useStills);   // versioned by the site build

  // "Scroll to build" also plays the build by itself; any wheel, touch or key hands control back
  let auto = 0;
  const html = document.documentElement;
  const stopAuto = () => {
    cancelAnimationFrame(auto);
    auto = 0;
    html.style.scrollBehavior = "";
    for (const ev of ["wheel", "touchstart", "keydown", "mousedown"]) removeEventListener(ev, stopAuto);
  };
  $("railGo").addEventListener("click", (e) => {
    if (T >= sEnd.t0 - 0.05) return;                 // already built: the link goes on to the next section
    e.preventDefault();
    stopAuto();
    const from = scrollY, to = build.offsetTop + (dist * (sEnd.t0 + 0.15)) / TOTAL;
    const dur = Math.max(800, (11000 * (to - from)) / dist), t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      scrollTo(0, from + (to - from) * k);
      if (k < 1) auto = requestAnimationFrame(step); else stopAuto();
    };
    html.style.scrollBehavior = "auto";
    for (const ev of ["wheel", "touchstart", "keydown", "mousedown"]) addEventListener(ev, stopAuto, { passive: true });
    auto = requestAnimationFrame(step);
  });

  // ---------- header: see-through over the build, solid after it ----------
  const solid = () => top.classList.toggle("is-solid", build.getBoundingClientRect().bottom < top.offsetHeight + 1);
  addEventListener("scroll", solid, { passive: true });
  solid();

  const burger = $("burger");
  const setMenu = (open) => { top.classList.toggle("is-open", open); burger.setAttribute("aria-expanded", open); };
  burger.addEventListener("click", () => setMenu(!top.classList.contains("is-open")));
  $("menu").addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
  addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  // ---------- blocks fade in as they arrive ----------
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  // ---------- before / after ----------
  const cmp = $("compare"), range = $("compareRange");
  let hinting = 0;
  const setPos = (p) => { cmp.style.setProperty("--pos", `${p}%`); range.value = Math.round(p); };
  const posFrom = (e) => { const r = cmp.getBoundingClientRect(); return clamp(((e.clientX - r.left) / r.width) * 100, 0, 100); };
  const used = () => { cancelAnimationFrame(hinting); hinting = -1; cmp.classList.add("is-used"); };
  let drag = null;
  cmp.addEventListener("pointerdown", (e) => {
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, on: e.pointerType === "mouse" };
    if (drag.on) { cmp.setPointerCapture(e.pointerId); used(); setPos(posFrom(e)); }
  });
  cmp.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (!drag.on) {                                  // touch: only a sideways drag moves it, so the page still scrolls
      const dx = Math.abs(e.clientX - drag.x), dy = Math.abs(e.clientY - drag.y);
      if (dx < 6 || dx < dy) return;
      drag.on = true;
      cmp.setPointerCapture(e.pointerId);
      used();
    }
    setPos(posFrom(e));
  });
  const endDrag = () => { drag = null; };
  cmp.addEventListener("pointerup", endDrag);
  cmp.addEventListener("pointercancel", endDrag);
  range.addEventListener("input", () => { used(); setPos(+range.value); });

  // a small sweep the first time it's on screen, to show it can move
  if (!reduceMotion) {
    new IntersectionObserver((entries, obs) => {
      if (!entries[entries.length - 1].isIntersecting || hinting) return;
      obs.disconnect();
      const t0 = performance.now(), keys = [50, 74, 28, 50];
      const step = (now) => {
        if (hinting < 0) return;
        const t = (now - t0) / 2600, i = Math.min(2, Math.floor(t * 3));
        setPos(lerp(keys[i], keys[i + 1], ease(clamp(t * 3 - i, 0, 1))));
        hinting = t < 1 ? requestAnimationFrame(step) : -1;
      };
      hinting = requestAnimationFrame(step);
    }, { threshold: 0.6 }).observe(cmp);
  }

  // ---------- quote form (a concept: nothing is sent) ----------
  const form = $("qform"), fileName = $("fileName");
  form.photos.addEventListener("change", () => {
    const n = form.photos.files.length;
    fileName.textContent = n ? `${n} photo${n > 1 ? "s" : ""} added` : "Add photos";
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    $("qdone").hidden = false;
  });
})();
