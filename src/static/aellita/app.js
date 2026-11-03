// Aellita: a bare salon by a window over Prague, dressed as you scroll.
// The video (media/room-*.mp4, 241 frames at 24 fps, a keyframe every 4) does the sewing; this script picks the frame
// for the scroll position, moves a camera, and draws the tape measure and labels in the same 1920×1080 frame.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ramp = (v, a, b) => clamp((v - a) / (b - a), 0, 1);     // 0 before a, 1 after b
  const ease = (t) => t * t * (3 - 2 * t);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const portraitQuery = matchMedia("(max-aspect-ratio: 1/1), (max-width: 760px)");

  // ---------- the video ----------
  const FPS = 24;
  const LAST = 240;
  // what happens in it: the sheer sweeps in 44–104, the velvet drops 104–128, cushions and flowers 132–184,
  // the drapes close 188–240
  const WINDOW = [462, 55, 1432, 592];               // the glass, [left, top, right, bottom] in the frame

  // ---------- the timeline, in screen heights of scrolling ----------
  const segs = [];
  let total = 0;
  const seg = (kind, len, x0, x1) => {
    const s = { kind, len, t0: total, x0, x1 };
    segs.push(s);
    total += len;
    return s;
  };
  const sCover = seg("cover", 0.5, 0, 0);
  const sIntro = seg("intro", 0.75, 0, 0);
  const sMeasure = seg("measure", 0.85, 0, 40);
  const sSheer = seg("sheer", 1.0, 40, 104);
  const sDrapes = seg("drapes", 0.85, 104, 130);
  const sDetails = seg("details", 0.9, 130, 186);
  const sClose = seg("close", 1.0, 186, LAST);
  const sEnd = seg("end", 0.8, LAST, LAST);
  const TOTAL = total;
  const v = (s, T) => (T - s.t0) / s.len;            // progress through a segment (keeps going below 0 and above 1)

  const segAt = (T) => {
    for (let i = segs.length - 1; i >= 0; i--) if (T >= segs[i].t0) return segs[i];
    return segs[0];
  };
  const frameAt = (T) => {
    const s = segAt(T);
    return lerp(s.x0, s.x1, s.kind === "measure" ? ramp(v(s, T), 0.55, 1) : ramp(v(s, T), 0, 0.92));
  };

  const CHAPTERS = [
    { name: "Zaměření", t: sMeasure.t0, text: "Přijedeme, změříme okno a posoudíme světlo i prostor. Zdarma." },
    { name: "Záclona", t: sSheer.t0, text: "Lehký voál změkčí denní světlo a výhled na Hrad vám nechá." },
    { name: "Samet", t: sDrapes.t0, text: "Těžký samet, ručně řasený, s úvazy na míru." },
    { name: "Detaily", t: sDetails.t0, text: "Polštáře z téže látky propojí okno s celým pokojem." },
    { name: "Večer", t: sClose.t0, text: "Jedním pohybem soukromí a ticho. Pokoj je hotový." },
  ];
  const chapterAt = (T) => {
    let c = 0;
    CHAPTERS.forEach((ch, i) => { if (T >= ch.t - 0.02) c = i; });
    return c;
  };

  // daylight in the room, by frame: the voile softens it, the velvet frames it, closed drapes all but shut it out
  const LIGHT = [[0, 100], [44, 100], [104, 74], [130, 66], [188, 66], [LAST, 8]];
  const lightAt = (f) => {
    for (let i = 1; i < LIGHT.length; i++) {
      if (f <= LIGHT[i][0]) return lerp(LIGHT[i - 1][1], LIGHT[i][1], ease(ramp(f, LIGHT[i - 1][0], LIGHT[i][0])));
    }
    return LIGHT[LIGHT.length - 1][1];
  };

  // ---------- elements ----------
  const room = $("room"), stage = $("stage"), view = $("view"), camera = $("camera");
  const end = $("end"), video = $("video"), tagLayer = $("tags");
  const cover = $("cover");
  const intro = $("intro"), chapter = $("chapter"), chNum = $("chNum"), chWord = $("chWord"), chText = $("chText");
  const finale = $("finale");
  const light = $("light"), lightFill = $("lightFill"), lightNum = $("lightNum");
  const rail = $("rail"), railTrack = $("railTrack"), railNum = $("railNum"), railName = $("railName"), railHint = $("railHint");
  const top = $("top");
  room.style.setProperty("--units", TOTAL.toFixed(3));

  // ---------- the tape measure and labels ----------
  const NS = "http://www.w3.org/2000/svg";
  const svg = (name, attrs, parent) => {
    const el = document.createElementNS(NS, name);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    parent.append(el);
    return el;
  };
  const makeTag = (text, note, kind = "") => {
    const el = document.createElement("span");
    el.className = "tag" + (kind ? ` tag--${kind}` : "");
    el.innerHTML = `<i class="tag__dot"></i><span class="tag__label">${text}${note ? ` <small>${note}</small>` : ""}</span>`;
    tagLayer.append(el);
    return el;
  };

  // across the top of the window, then down its side; ticks appear as the tape passes them
  const tapes = [
    { a: [WINDOW[0], 28], b: [WINDOW[2], 28], label: makeTag("3 400 mm", "šířka", "plain"), at: [(WINDOW[0] + WINDOW[2]) / 2, 28] },
    { a: [1462, WINDOW[1]], b: [1462, WINDOW[3]], label: makeTag("1 700 mm", "výška", "plain"), at: [1462, (WINDOW[1] + WINDOW[3]) / 2] },
  ].map((t) => {
    const g = svg("g", { opacity: 0 }, $("tapes"));
    const along = t.a[1] === t.b[1] ? "x" : "y";
    const len = along === "x" ? t.b[0] - t.a[0] : t.b[1] - t.a[1];
    const cap = (p) => along === "x" ? { x1: p[0], x2: p[0], y1: p[1] - 14, y2: p[1] + 14 } : { x1: p[0] - 14, x2: p[0] + 14, y1: p[1], y2: p[1] };
    const ticks = [];
    for (let d = 24, i = 1; d < len - 4; d += 24, i++) {
      const h = i % 5 === 0 ? 9 : 5;
      const p = along === "x" ? [t.a[0] + d, t.a[1]] : [t.a[0], t.a[1] + d];
      const attrs = along === "x" ? { x1: p[0], x2: p[0], y1: p[1], y2: p[1] + h } : { x1: p[0] - h, x2: p[0], y1: p[1], y2: p[1] };
      ticks.push({ d, el: svg("line", { class: "tape__tick", ...attrs, opacity: 0 }, g) });
    }
    return {
      ...t, g, along, len, ticks,
      capA: svg("line", { class: "tape__cap", ...cap(t.a) }, g),
      capB: svg("line", { class: "tape__cap", ...cap(t.b), opacity: 0 }, g),
      line: svg("line", { class: "tape__line", x1: t.a[0], y1: t.a[1], x2: t.a[0], y2: t.a[1] }, g),
      glow: svg("circle", { class: "tape__glow", r: 16, cx: t.a[0], cy: t.a[1] }, g),
      head: svg("circle", { class: "tape__head", r: 6, cx: t.a[0], cy: t.a[1] }, g),
    };
  });

  // labels pinned to things in the room: [x, y] in the frame, and the frames they're shown for
  const PINS = [
    { at: [700, 330], tag: makeTag("Voál", "propouští světlo"), from: 92, to: 132 },
    { at: [300, 548], tag: makeTag("Samet", "ručně řasený"), from: 116, to: 186 },
    { at: [1612, 560], tag: makeTag("Úvaz", "šitý na míru", "left"), from: 120, to: 186 },
    { at: [1250, 640], tag: makeTag("Polštáře", "z téže látky"), from: 150, to: 196 },
  ];

  // ---------- layout and camera ----------
  let vw = 1, vh = 1, cw = 1, portrait = false, dist = 1;
  const measure = () => {
    vw = view.clientWidth || 1;
    vh = view.clientHeight || 1;
    portrait = portraitQuery.matches;
    cw = Math.max(vw, vh * 16 / 9);                  // the frame always covers the screen
    camera.style.setProperty("--cw", `${cw}px`);
    dist = Math.max(1, room.offsetHeight - stage.offsetHeight);
  };

  // where the camera looks (frame x, y) and how close; phones pan across the frame to follow the work
  const cameraAt = (T) => {
    if (reduceMotion) return { fx: 960, fy: 540, z: 1 };
    const s = segAt(T), u = v(s, T);
    const settle = 1 - ease(ramp(T, 0, sCover.len + 0.4));   // the room opens a touch close and eases back
    if (portrait) {
      let fx = 946;
      if (s === sMeasure) fx = lerp(946, 1250, ease(ramp(u, 0.4, 0.8)));
      else if (s === sSheer) fx = lerp(1250, 900, ease(ramp(u, 0.1, 0.9)));
      else if (s === sDrapes) fx = lerp(900, 420, ease(ramp(u, -0.2, 0.6)));
      else if (s === sDetails) fx = lerp(420, 1180, ease(ramp(u, -0.1, 0.5)));
      else if (s === sClose) fx = lerp(1180, 960, ease(ramp(u, 0, 0.6)));
      else if (s === sEnd) fx = 960;
      return { fx, fy: 500, z: 1 + 0.04 * settle };
    }
    const zDetail = 0.07 * ease(ramp(v(sDetails, T), -0.1, 0.5)) * (1 - ease(ramp(v(sClose, T), 0, 0.7)));
    return { fx: 946, fy: 600 * (zDetail / 0.07), z: 1 + 0.05 * settle + zDetail };   // held at the top: the curtain rod is the first thing dressed
  };

  const cam = { fx: 960, fy: 540, z: 1 };
  const map = { k: 1, x: 0, y: 0 };                 // frame → view: x' = map.x + X * map.k
  const placeCamera = () => {
    const W = cw * cam.z, H = W * 9 / 16;
    let dx = -(cam.fx / 1920 - 0.5) * W, dy = -(cam.fy / 1080 - 0.5) * H;
    dx = clamp(dx, -(W - vw) / 2, (W - vw) / 2);      // never past the edge of the frame
    dy = clamp(dy, -(H - vh) / 2, (H - vh) / 2);
    camera.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${cam.z.toFixed(5)})`;
    map.k = W / 1920;
    map.x = vw / 2 + dx - W / 2;
    map.y = vh / 2 + dy - H / 2;
  };

  const shown = new Map();                           // last opacity per tag, so hidden tags aren't touched each frame
  const widths = new Map();                          // label widths, measured once, to keep labels on screen
  const placeTag = (el, a, X, Y) => {
    if (a < 0.01) {
      if (shown.get(el) !== 0) { el.style.opacity = 0; shown.set(el, 0); }
      return;
    }
    if (!widths.has(el)) widths.set(el, el.querySelector(".tag__label").offsetWidth);
    const w = widths.get(el), m = 12;
    let x = map.x + X * map.k;
    if (el.classList.contains("tag--plain")) x = clamp(x, m + w / 2, vw - m - w / 2);
    else {
      // a label belongs to its dot: when the thing it names is out of the picture (phones), it fades out
      const left = el.classList.contains("tag--left");
      const edge = Math.min(left ? x - w - 22 - m : x - m, left ? vw - m - x : vw - m - x - w - 22);   // room left on the tighter side
      a *= clamp(1 + edge / 30, 0, 1);
      if (a < 0.01) { if (shown.get(el) !== 0) { el.style.opacity = 0; shown.set(el, 0); } return; }
    }
    const y = clamp(map.y + Y * map.k, 90, vh - 40);
    el.style.opacity = a.toFixed(3);
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    shown.set(el, a);
  };

  // ---------- loading and seeking the video ----------
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
  const big = () => cw * (devicePixelRatio || 1) > 1500 && !slowNet && !saveData;   // phones too: the frame is stretched to their full height
  const useStills = () => {                          // no video: the finished room fades in instead
    stills = true;
    end.src = big() ? "media/room-end-1920.jpg" : "media/room-end-1280.jpg";
    end.hidden = false;
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
        const { done, value } = await reader.read();
        if (done) break;
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

  // ---------- the chapter word ----------
  const setChapter = (c) => {
    const ch = CHAPTERS[c];
    chWord.classList.remove("is-in");
    chWord.innerHTML = `<span>${[...ch.name].map((l, i) => `<b style="--i:${i}">${l}</b>`).join("")}</span>`;
    chText.classList.remove("is-in");
    chText.textContent = ch.text;
    void chWord.offsetWidth;                         // start the letters from below
    chWord.classList.add("is-in");
    chText.classList.add("is-in");
    chNum.textContent = railNum.textContent = String(c + 1).padStart(2, "0");
    railName.textContent = ch.name;
  };

  // ---------- drawing one moment ----------
  let T = 0, target = 0;

  const render = (now = performance.now()) => {
    const x = frameAt(T);
    const frame = Math.round(x);
    showFrame(frame);
    if (stills) end.style.opacity = ease(ramp(T, sSheer.t0, sClose.t0 + sClose.len)).toFixed(3);

    placeCamera();

    // the scroll hint drifts away on the first scroll
    const ta = 1 - ease(ramp(v(sCover, T), 0.02, 0.4));
    cover.style.opacity = ta.toFixed(3);
    cover.style.transform = `translate3d(0, ${(-80 * (1 - ta)).toFixed(1)}px, 0)`;
    cover.style.visibility = ta < 0.02 ? "hidden" : "";

    // the tape measure
    const mv = v(sMeasure, T);
    const tapeOut = 1 - ramp(v(sSheer, T), 0.05, 0.25);
    const draws = [ease(ramp(mv, 0.04, 0.42)), ease(ramp(mv, 0.36, 0.72))];
    tapes.forEach((t, i) => {
      const d = draws[i], a = d > 0 ? tapeOut : 0;
      t.g.setAttribute("opacity", a.toFixed(3));
      if (a <= 0) { placeTag(t.label, 0); return; }
      const reach = d * t.len;
      const hx = t.along === "x" ? t.a[0] + reach : t.a[0], hy = t.along === "x" ? t.a[1] : t.a[1] + reach;
      t.line.setAttribute("x2", hx.toFixed(1));
      t.line.setAttribute("y2", hy.toFixed(1));
      const tip = d > 0 && d < 1 ? 1 : 0;
      for (const c of [t.glow, t.head]) { c.setAttribute("cx", hx.toFixed(1)); c.setAttribute("cy", hy.toFixed(1)); c.setAttribute("opacity", tip); }
      t.capB.setAttribute("opacity", d >= 1 ? 1 : 0);
      for (const k of t.ticks) k.el.setAttribute("opacity", reach >= k.d ? 0.85 : 0);
      placeTag(t.label, a * ramp(d, 0.9, 1), t.at[0], t.at[1]);
    });

    // labels on the fabrics
    for (const p of PINS) placeTag(p.tag, ramp(x, p.from, p.from + 6) * (1 - ramp(x, p.to - 6, p.to)), p.at[0], p.at[1]);

    // words: the headline over the room, then one big word per chapter, then the closing strip
    const ia = 1 - ease(ramp(v(sIntro, T), 0.6, 0.95));   // the headline is there from the first screen
    intro.style.opacity = ia.toFixed(3);
    intro.style.transform = `translate3d(0, ${(30 * (1 - ia)).toFixed(1)}px, 0)`;
    intro.style.visibility = ia < 0.02 ? "hidden" : "visible";
    const cu = v(sClose, T);
    const ca = ease(ramp(T, sMeasure.t0 - 0.12, sMeasure.t0 + 0.08)) * (1 - ease(ramp(cu, 0.5, 0.68)));
    chapter.style.opacity = ca.toFixed(3);
    chapter.style.visibility = ca < 0.02 ? "hidden" : "visible";
    const fa = ease(ramp(cu, 0.82, 1.1));
    finale.style.opacity = fa.toFixed(3);
    finale.style.transform = `translate3d(0, ${(24 * (1 - fa)).toFixed(1)}px, 0)`;
    finale.style.visibility = fa < 0.02 ? "hidden" : "visible";
    if ((fa > 0.5) !== render.fin) {
      render.fin = fa > 0.5;
      for (const a of finale.querySelectorAll("a")) a.tabIndex = render.fin ? 0 : -1;
    }
    stage.style.setProperty("--dusk", ease(ramp(cu, 0.6, 1)).toFixed(3));
    stage.style.setProperty("--lede", Math.max(ia, 0.55).toFixed(3));   // deeper shade behind the headline

    const c = chapterAt(T);
    if (c !== render.c) { render.c = c; setChapter(c); }

    // daylight meter
    const l = stills ? lerp(100, 8, ease(ramp(T, sSheer.t0, sClose.t0 + sClose.len))) : lightAt(x);
    light.classList.toggle("is-on", T > sMeasure.t0 - 0.1 && T < sEnd.t0 + sEnd.len * 0.5);
    lightFill.style.setProperty("--l", (l / 100).toFixed(3));
    const ln = `${Math.round(l)} %`;
    if (ln !== render.ln) lightNum.textContent = render.ln = ln;

    rail.classList.toggle("is-on", T > sCover.len * 0.6);
    railTrack.style.setProperty("--p", (T / TOTAL).toFixed(4));
    const finished = T >= sEnd.t0 - 0.05;
    const hint = finished ? "Dál" : !videoOk && !stills && T > sCover.len ? `Načítám ${Math.round(loaded * 100)} %` : "Scrollujte";
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

  // ---------- the loop: runs while the room is on screen and something is moving ----------
  const scrollT = () => clamp(-room.getBoundingClientRect().top / dist, 0, 1) * TOTAL;
  let visible = false, raf = 0, last = 0, still = 0, drawn = "";
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 1 / 60);
    last = now;
    target = scrollT();
    T += (target - T) * (1 - Math.exp(-dt * 7));    // scrolling feels like drawing a heavy curtain: weighted, never jumpy
    if (Math.abs(target - T) < 1.5e-3) T = target;
    const goal = cameraAt(T), k = 1 - Math.exp(-dt * 4);
    cam.fx += (goal.fx - cam.fx) * k;
    cam.fy += (goal.fy - cam.fy) * k;
    cam.z += (goal.z - cam.z) * k;
    // the last of the easing settles at once: sub-pixel creeping makes the picture shimmer once the scroll has stopped
    if (Math.abs(goal.fx - cam.fx) < 0.6 && Math.abs(goal.fy - cam.fy) < 0.6 && Math.abs(goal.z - cam.z) < 0.0015) { cam.fx = goal.fx; cam.fy = goal.fy; cam.z = goal.z; }
    const state = `${T.toFixed(5)} ${cam.fx.toFixed(2)} ${cam.fy.toFixed(2)} ${cam.z.toFixed(4)} ${loaded.toFixed(2)} ${videoOk} ${stills}`;
    if (state !== drawn) { drawn = state; render(now); still = 0; } else still++;
    raf = visible && still < 20 ? requestAnimationFrame(loop) : 0;
  };
  function wake() {
    if (visible && !raf) { last = performance.now(); still = 0; raf = requestAnimationFrame(loop); }
  }
  new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; wake(); }).observe(room);
  addEventListener("scroll", wake, { passive: true });

  const relayout = () => {
    measure();
    Object.assign(cam, cameraAt(T));
    widths.clear();
    render();
    wake();
  };
  new ResizeObserver(relayout).observe(view);
  portraitQuery.addEventListener?.("change", relayout);
  measure();
  T = target = scrollT();                            // a reload halfway down starts where the visitor was
  Object.assign(cam, cameraAt(T));
  render();
  document.fonts?.ready.then(() => { widths.clear(); render(); });   // sizes change once the fonts arrive

  if (saveData) useStills();
  else loadVideo(big() ? video.dataset.big : video.dataset.small).catch(useStills);

  // "Scrollujte" also plays the room by itself; any wheel, touch or key hands control back
  let auto = 0;
  const html = document.documentElement;
  const stopAuto = () => {
    cancelAnimationFrame(auto);
    auto = 0;
    html.style.scrollBehavior = "";
    for (const ev of ["wheel", "touchstart", "keydown", "mousedown"]) removeEventListener(ev, stopAuto);
  };
  $("railGo").addEventListener("click", (e) => {
    if (T >= sEnd.t0 - 0.05) return;                 // already dressed: the link goes on to the next section
    e.preventDefault();
    stopAuto();
    const from = scrollY, to = room.offsetTop + (dist * (sEnd.t0 + 0.2)) / TOTAL;
    const dur = Math.max(800, (14000 * (to - from)) / dist), t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      scrollTo(0, from + (to - from) * k);
      if (k < 1) auto = requestAnimationFrame(step); else stopAuto();
    };
    html.style.scrollBehavior = "auto";
    for (const ev of ["wheel", "touchstart", "keydown", "mousedown"]) addEventListener(ev, stopAuto, { passive: true });
    auto = requestAnimationFrame(step);
  });

  // ---------- header: see-through over the room, solid after it ----------
  // while the room is being dressed and you scroll on, the header steps aside so the curtain rod at the very top shows
  const sheet = document.querySelector(".about");
  let lastY = scrollY;
  const solid = () => {
    const r = room.getBoundingClientRect(), y = scrollY;
    top.classList.toggle("is-solid", sheet.getBoundingClientRect().top < top.offsetHeight + 1);   // the page rises over the film
    const inRoom = -r.top > innerHeight * 0.6 && r.bottom > innerHeight * 1.2;
    if (Math.abs(y - lastY) > 4) {
      top.classList.toggle("is-away", inRoom && y > lastY && !top.classList.contains("is-open"));
      lastY = y;
    }
    if (!inRoom) top.classList.remove("is-away");
  };
  addEventListener("scroll", solid, { passive: true });

  // phones: the call bar shows once the room is behind you, and steps aside at the contact form
  const dock = $("dock"), contact = $("kontakt");
  const placeDock = () => {
    const past = room.getBoundingClientRect().bottom < innerHeight * 0.5;
    const atForm = contact.getBoundingClientRect().top < innerHeight * 0.85;
    dock.classList.toggle("is-on", past && !atForm && !top.classList.contains("is-open"));
  };
  addEventListener("scroll", placeDock, { passive: true });
  placeDock();
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

  // the cushion pile rolls in only once it is fully on screen and above the bottom quarter, so it is seen;
  // once it drops back below the screen it resets, and rolls in again next time
  // ---------- hems: a brass stitch runs along the top of a sheet as it rises over the picture, a needle leading it ----------
  document.querySelectorAll(".hem").forEach((hem, n) => {
    const host = hem.parentElement,
          stitch = hem.querySelector(".hem__stitch"), reveal = hem.querySelector(".hem__reveal"), needle = hem.querySelector(".hem__needle");
    hem.querySelector("mask").id = "hemMask" + n; stitch.setAttribute("mask", `url(#hemMask${n})`);
    let len = 0, busy = false;
    const sew = () => {
      busy = false;
      const t = host.getBoundingClientRect().top;
      if (n === 0 && rail) rail.classList.toggle("is-gone", t < innerHeight * 1.02);
      if (!len) return;
      const p = reduceMotion ? 1 : clamp((innerHeight - t) / (innerHeight * 0.7), 0, 1);
      reveal.style.strokeDashoffset = len * (1 - p);
      const pt = stitch.getPointAtLength(len * p), ah = stitch.getPointAtLength(Math.min(len, len * p + 2));
      const ang = Math.atan2(ah.y - pt.y, ah.x - pt.x) * 180 / Math.PI;
      needle.setAttribute("transform", `translate(${pt.x} ${pt.y}) rotate(${ang - 135})`);
      hem.classList.toggle("is-done", p >= 1 || p <= 0);
    };
    const build = () => {
      const W = hem.clientWidth, R = parseFloat(getComputedStyle(host).borderTopLeftRadius) || 44,
            d = R < 36 ? 12 : 18, r = R - d, tail = R + 40;
      const path = `M${d} ${tail}V${R}A${r} ${r} 0 0 1 ${R} ${d}H${W - R}A${r} ${r} 0 0 1 ${W - d} ${R}V${tail}`;
      stitch.setAttribute("d", path); reveal.setAttribute("d", path);
      len = stitch.getTotalLength();
      reveal.style.strokeDasharray = len;
      sew();
    };
    addEventListener("scroll", () => { if (!busy) { busy = true; requestAnimationFrame(sew); } }, { passive: true });
    addEventListener("resize", build);
    build();
  });

  // the pincushion and the tape react to a tap too, not only under a mouse
  for (const toy of [$("pincushion"), $("tape")]) {
    if (!toy) continue;
    toy.addEventListener("pointerdown", () => { toy.classList.remove("is-poked"); void toy.offsetWidth; toy.classList.add("is-poked"); });
    toy.addEventListener("animationend", () => toy.classList.remove("is-poked"));
  }

  const pile = $("pile");
  if (pile) {
    new IntersectionObserver(([e]) => { if (e.isIntersecting) pile.classList.add("is-in"); },
      { rootMargin: "0px 0px -25% 0px", threshold: 1 }).observe(pile);
    new IntersectionObserver(([e]) => {
      if (!e.isIntersecting && e.boundingClientRect.top > 0) {   // gone off the bottom: get ready to roll again
        pile.classList.remove("is-in");
        for (const img of pile.querySelectorAll("img")) { img.style.animation = "none"; void img.offsetWidth; img.style.animation = ""; }
      }
    }).observe(pile);
  }

  // ---------- pictures that drift a little against the page (data-drift: % of their height, over the screen) ----------
  const drifters = [...document.querySelectorAll("[data-drift]"), $("bandImg")].filter(Boolean);
  if (drifters.length && !reduceMotion) {
    let ticking = false;
    const drift = () => {
      ticking = false;
      for (const el of drifters) {
        const box = (el.closest("figure") || el).getBoundingClientRect();
        if (box.bottom < -100 || box.top > innerHeight + 100) continue;
        const p = clamp((innerHeight - box.top) / (innerHeight + box.height), 0, 1);   // 0 arriving, 1 leaving
        const k = el.id === "bandImg" ? (innerWidth <= 860 ? 0 : -13) : +el.dataset.drift;
        el.style.transform = k ? `translate3d(0, ${(k * p).toFixed(2)}%, 0)` : "";
      }
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(drift); } }, { passive: true });
    addEventListener("resize", drift);
    drift();
  }

  // ---------- motion between sections ----------
  // headings: every word in its own mask, rising one after another
  const splitWords = (el) => {
    let i = 0;
    const walk = (node) => {
      for (const n of [...node.childNodes]) {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const part of n.textContent.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) { frag.append(" "); continue; }
            const w = document.createElement("span"), inner = document.createElement("span");
            w.className = "w"; inner.textContent = part; inner.style.setProperty("--i", i++);
            w.append(inner); frag.append(w);
          }
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      }
    };
    walk(el);
    el.classList.add("words");
  };
  const wordsIo = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("is-in"); wordsIo.unobserve(e.target); }
  }, { rootMargin: "0px 0px -12% 0px" });
  if (!reduceMotion) document.querySelectorAll(".head h2, .about__lead, .band blockquote, .contact h2, .team__intro h2").forEach((el) => { splitWords(el); wordsIo.observe(el); });

  // pictures part like curtains as they come into view
  const curtainIo = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      el.classList.add("is-open");
      el.addEventListener("transitionend", (ev) => { if (ev.propertyName === "clip-path") el.classList.add("is-done"); }, { once: true });
      curtainIo.unobserve(el);
    }
  }, { rootMargin: "0px 0px -10% 0px" });
  if (!reduceMotion) document.querySelectorAll(".about__img, .svc__media, .svc__thumb, .steps3__img, .ref__img, .team__hero, .strip__img").forEach((el) => {
    if (el.matches(".ref__img, .strip__img")) {   // a row of photos opens one after another
      const box = el.matches(".strip__img") ? el.parentElement : el;
      el.style.setProperty("--d", `${([...box.parentElement.children].indexOf(box) % 6) * 0.09}s`);
    }
    el.classList.add("curtain");
    curtainIo.observe(el);
  });

  // the ribbon of what we make drifts sideways as you scroll
  const ribbon = $("ribbon");
  if (ribbon && !reduceMotion) {
    let ticking = false;
    const slide = () => {
      ticking = false;
      const r = ribbon.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const x = ((innerHeight - r.top) * 0.45) % (ribbon.scrollWidth / 2);
      ribbon.style.transform = `translate3d(${(-x).toFixed(1)}px, 0, 0)`;
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(slide); } }, { passive: true });
    slide();
  }

  // ---------- services: the picture follows the service in the middle of the screen, or under the pointer ----------
  const items = [...$("svcList").children], pics = [...document.querySelectorAll(".svc__pic")];
  const pickService = (i) => {
    items.forEach((el, k) => el.classList.toggle("is-on", k === i));
    pics.forEach((el, k) => {
      el.classList.toggle("is-on", k === i);
      const v = el.querySelector("video");
      if (v) { if (k === i && !reduceMotion) v.play().catch(() => {}); else v.pause(); }
    });
  };
  const svcIo = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) pickService(items.indexOf(e.target));
  }, { rootMargin: "-45% 0px -45% 0px" });
  items.forEach((el, i) => {
    svcIo.observe(el);
    el.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") pickService(i); });
  });

  // ---------- references: tabs ----------
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const selectTab = (i, focus) => {
    tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      const panel = $(t.getAttribute("aria-controls"));
      panel.hidden = !on;
      panel.classList.toggle("is-on", on);
    });
    if (focus) tabs[i].focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => selectTab(i));
    t.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (d) { e.preventDefault(); selectTab((i + d + tabs.length) % tabs.length, true); }
    });
  });

  // ---------- lightbox ----------
  const box = $("lightbox"), boxImg = $("lightboxImg");
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-full]");
    if (!b || !box.showModal) return;
    const img = b.querySelector("img");
    boxImg.src = b.dataset.full;
    boxImg.alt = img ? img.alt : "";
    box.showModal();
  });
  $("lightboxClose").addEventListener("click", () => box.close());
  box.addEventListener("click", (e) => { if (e.target === box) box.close(); });

  // ---------- contact form: opens the visitor's e-mail with everything filled in ----------
  const form = $("form"), note = $("formNote");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let ok = true;
    for (const name of ["name", "phone"]) {
      const field = form[name], bad = !field.value.trim();
      field.closest(".field").classList.toggle("is-bad", bad);
      if (bad && ok) { field.focus(); ok = false; }
    }
    if (!ok) { note.textContent = "Vyplňte prosím jméno a telefon."; return; }
    const what = [...form.querySelectorAll('[name="what"]:checked')].map((c) => c.value);
    const body = [
      `Dobrý den, mám zájem o bezplatné zaměření.`,
      what.length ? `Zajímá mě: ${what.join(", ")}` : "",
      form.msg.value.trim(),
      "",
      `${form.name.value.trim()}, tel. ${form.phone.value.trim()}`,
    ].filter((l, i, a) => l || (i > 0 && a[i - 1])).join("\n");
    location.href = `mailto:aellita@email.cz?subject=${encodeURIComponent("Zaměření – " + form.name.value.trim())}&body=${encodeURIComponent(body)}`;
    note.textContent = "Děkujeme! Pokud se e-mail neotevřel, zavolejte nám na +420 776 789 143.";
  });

  $("year").textContent = new Date().getFullYear();
})();
