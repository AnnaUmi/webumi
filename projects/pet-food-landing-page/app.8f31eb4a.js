// Mew&Co hero: the cat "watches" the cursor approach the CTA, then reacts to the click.
//
// Video is split in two at the frame where the cat looks at the button:
//   intro  = frames 0…106 (all-intra, scrubbed by cursor distance)
//   outro  = frames 106…144 (food drops, cat is surprised)
// Both clips share frame 106, so swapping from one to the other is invisible.
(() => {
  "use strict";

  const FPS = 24;
  const END_FRAME = 106;                 // cat looks at the button, eyes open, not blinking
  const T_END = END_FRAME / FPS;
  const MAX_RATE = 1;                    // never scrub faster than real-time playback
  const SPRING = 14;                     // smoothing stiffness for the scrub position
  const JITTER_PX = 1.5;                 // ignore tiny mouse tremor
  const REACH = 0.62;                    // proximity radius as a share of stage width

  const $ = (id) => document.getElementById(id);
  const scene = $("scene"), poster = $("poster"), intro = $("intro"), outro = $("outro");
  const cta = $("cta"), ctaWrap = $("ctaWrap"), ctaLabel = $("ctaLabel"), cursorEl = $("cursor");

  // The headline narrates what the cat is thinking as the cursor gets closer.
  const STORY = {
    idle: "Psst… he’s<br><em>watching</em> you.",
    closer: "Ooh, is that<br><em>dinner?</em>",
    near: "Go on then…<br><em>press</em> it!",
    done: "Dinner they’ll<br><em>purr</em> about.",
  };
  const hl = $("hl");

  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const compactQuery = matchMedia("(max-width: 760px), (max-aspect-ratio: 1/1)");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- media loading ----------
  const sceneWidthPx = () => scene.getBoundingClientRect().width * (window.devicePixelRatio || 1);
  // retina gets the sharp set — unless the visitor is on slow data or has Data Saver on
  const net = navigator.connection;
  const slowNet = !!net && (net.saveData || /(^|-)(2g|3g)$/.test(net.effectiveType || ""));
  const res = sceneWidthPx() > 1400 && !slowNet ? 1920 : 1280;
  const src = (name) => `assets/video/${name}-${res}.mp4`;
  const posterSrc = (frame) => `assets/video/frame-${String(frame).padStart(3, "0")}-${res}.jpg`;

  // Side fill for wide screens: stretch the video's own edge columns, so colours match exactly.
  const band = document.querySelector(".band");
  const paintBand = (srcEl, w, h) => {
    if (!w || !h) return;
    try {
      const c = document.createElement("canvas");
      c.width = 2; c.height = 270;
      const x = c.getContext("2d");
      x.drawImage(srcEl, 6, 0, 10, h, 0, 0, 1, 270);           // left edge (skip the outermost pixels)
      x.drawImage(srcEl, w - 16, 0, 10, h, 1, 0, 1, 270);      // right edge
      band.style.backgroundImage = `url(${c.toDataURL()})`;
    } catch { /* tainted canvas (file://): keep the CSS gradient */ }
  };

  // Touch devices never scrub: they start on the "waiting" frame and only need the outro.
  const useIntro = canHover;
  poster.addEventListener("load", () => paintBand(poster, poster.naturalWidth, poster.naturalHeight), { once: true });
  poster.src = posterSrc(useIntro ? 0 : END_FRAME);

  // Load whole files into memory so seeking works regardless of server range support.
  const loadClip = async (video, url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      video.src = URL.createObjectURL(await res.blob());
    } catch {
      video.preload = "auto";                          // e.g. opened from file:// — stream directly
      video.src = url;
    }
    video.load();
    await new Promise((ok, fail) => {
      video.addEventListener("loadeddata", ok, { once: true });
      video.addEventListener("error", fail, { once: true });
    });
    return video;
  };
  const introReady = useIntro ? loadClip(intro, src("intro")).catch(() => null) : Promise.resolve(null);
  const outroReady = introReady.then(() => loadClip(outro, src("outro"))).then(() => {
    outro.pause(); outro.currentTime = 0; return outro;
  }).catch(() => null);
  if (!useIntro) intro.remove();

  // ---------- state ----------
  let state = "interactive";             // interactive → pressing → finishing → outro → done
  let introOk = false;
  let shownFrame = 0, seeking = false, seekWatchdog = 0;
  let scrub = 0, scrubVel = 0;           // smoothed intro time (s)
  let prox = 0;                          // 0…1 cursor proximity to the CTA
  let mouse = null, mouseRaw = null;

  // ---------- story headline ----------
  let story = "idle", pendingStory = null, swapping = false;
  const setStory = (key) => {
    pendingStory = key;
    if (!swapping) runStory();
  };
  const runStory = async () => {
    swapping = true;
    while (pendingStory && pendingStory !== story) {
      const key = pendingStory; pendingStory = null;
      if (!reduceMotion) {
        await hl.animate([
          { opacity: 1, transform: "none", filter: "blur(0)" },
          { opacity: 0, transform: "translateY(-.18em)", filter: "blur(6px)" },
        ], { duration: 170, easing: "ease-in", fill: "forwards" }).finished;
      }
      hl.innerHTML = STORY[key]; story = key;
      if (!reduceMotion) {
        await hl.animate([
          { opacity: 0, transform: "translateY(.22em)", filter: "blur(6px)" },
          { opacity: 1, transform: "none", filter: "blur(0)" },
        ], { duration: 300, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }).finished;
      }
    }
    swapping = false;
  };
  // Touch devices start on the "waiting" frame, so the story starts there too.
  if (!useIntro) { hl.innerHTML = STORY.near; story = "near"; }

  introReady.then((v) => {
    if (!v) return;
    introOk = true;
    intro.pause();
    intro.currentTime = 0;
    intro.addEventListener("seeked", () => paintBand(intro, intro.videoWidth, intro.videoHeight), { once: true });
  });

  intro.addEventListener("seeked", () => { seeking = false; });

  // ---------- proximity (distance from cursor to the button, not hover) ----------
  let ctaRect = null, stageW = 1;
  const measure = () => {
    ctaRect = cta.getBoundingClientRect();
    stageW = scene.getBoundingClientRect().width;
  };
  measure();
  addEventListener("resize", measure);
  compactQuery.addEventListener?.("change", measure);

  const proximity = () => {
    if (!mouse || !ctaRect || state !== "interactive") return 0;
    if (compactQuery.matches) return 1;              // narrow window: cat just waits for the tap
    const dx = Math.max(ctaRect.left - mouse.x, 0, mouse.x - ctaRect.right);
    const dy = Math.max(ctaRect.top - mouse.y, 0, mouse.y - ctaRect.bottom);
    const t = 1 - Math.min(Math.hypot(dx, dy) / (stageW * REACH), 1);
    return t * t * (3 - 2 * t);                      // smoothstep: soft start, soft arrival
  };

  // ---------- custom cursor ----------
  const cur = { x: 0, y: 0, angle: 0, flip: 1, scale: 1, t: 0 };
  if (canHover) {
    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      if (mouseRaw && Math.hypot(e.clientX - mouseRaw.x, e.clientY - mouseRaw.y) < JITTER_PX) return;
      const first = !mouseRaw;
      mouseRaw = { x: e.clientX, y: e.clientY };
      if (first) { mouse = { ...mouseRaw }; cur.x = mouse.x; cur.y = mouse.y; }
      document.documentElement.classList.add("has-cursor");   // hide system cursor only after real movement
    }, { passive: true });
    document.documentElement.addEventListener("mouseleave", () => {
      mouseRaw = null; mouse = null;
      document.documentElement.classList.remove("has-cursor");
    });
  }

  const updateCursor = (dt, now) => {
    if (!mouseRaw) return;
    const follow = reduceMotion ? 1 : 1 - Math.exp(-dt * 22);       // slight lag
    const vx = (mouseRaw.x - cur.x), vy = (mouseRaw.y - cur.y);
    cur.x += vx * follow; cur.y += vy * follow;
    if (Math.abs(vx) > 2) cur.flip = vx < 0 ? -1 : 1;                // mirror, never upside down
    const lean = Math.max(-10, Math.min(10, vy * 0.4)) * cur.flip;
    const idle = reduceMotion ? 0 : Math.sin(now / 650) * 1.5;        // tiny "alive" sway
    cur.angle += (lean + idle - cur.angle) * (1 - Math.exp(-dt * 10));
    cur.scale += ((1 + prox * 0.3) - cur.scale) * (1 - Math.exp(-dt * 10));
    cursorEl.style.transform =
      `translate(${cur.x}px, ${cur.y}px) scale(${cur.flip * cur.scale}, ${cur.scale}) rotate(${cur.angle}deg)`;
  };

  // ---------- main loop ----------
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;

    if (mouseRaw && mouse) {                          // low-pass the pointer to kill tremor
      const a = 1 - Math.exp(-dt * 30);
      mouse.x += (mouseRaw.x - mouse.x) * a; mouse.y += (mouseRaw.y - mouse.y) * a;
    }

    if (state === "interactive") {
      prox = proximity();
      const target = prox * T_END;
      // critically damped spring, then hard speed cap (≤ real-time)
      scrubVel += (SPRING * SPRING * (target - scrub) - 2 * SPRING * scrubVel) * dt;
      scrubVel = Math.max(-MAX_RATE, Math.min(MAX_RATE, scrubVel));
      scrub = Math.max(0, Math.min(T_END, scrub + scrubVel * dt));
      if (Math.abs(target - scrub) < 1e-4 && Math.abs(scrubVel) < 1e-3) { scrub = target; scrubVel = 0; }

      if (introOk) {
        const f = Math.round(scrub * FPS);
        if (f !== shownFrame && (!seeking || now > seekWatchdog)) {
          seeking = true; seekWatchdog = now + 250; shownFrame = f;
          intro.currentTime = (f + 0.25) / FPS;       // land inside frame f
        }
      }
      const prog = scrub / T_END;
      ctaWrap.style.setProperty("--lift", prog.toFixed(3));
      if (useIntro) {                                  // thresholds with hysteresis, so text never flickers
        const shown = pendingStory || story;
        const next = prog >= 0.78 || (shown === "near" && prog > 0.7) ? "near"
          : prog >= 0.22 || (shown !== "idle" && prog > 0.15) ? "closer" : "idle";
        if (next !== shown) setStory(next);
      }
    } else if (state === "outro" || state === "done") {
      const l = parseFloat(ctaWrap.style.getPropertyValue("--lift")) || 0;
      ctaWrap.style.setProperty("--lift", Math.max(0, l - dt * 2).toFixed(3));
    }

    updateCursor(dt, now);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // ---------- click: squash & stretch, then continue the film ----------
  const u = () => (compactQuery.matches ? 1 : stageW / 1440);
  const press = () => {
    if (reduceMotion) return Promise.resolve();
    const ease = "cubic-bezier(.3,.7,.4,1)";
    const k = u();
    const btn = cta.animate([
      { transform: "scale(1, 1)" },
      { transform: "scale(1.05, .86)", offset: .2 },
      { transform: "scale(.95, 1.07)", offset: .46 },
      { transform: "scale(1.025, .975)", offset: .68 },
      { transform: "scale(.995, 1.005)", offset: .85 },
      { transform: "scale(1, 1)" },
    ], { duration: 480, easing: ease });
    ctaLabel.animate([                                 // label plays against the body
      { transform: "none" },
      { transform: `translateY(${2.5 * k}px) scale(.94, 1.12)`, offset: .2 },
      { transform: `translateY(${-2.5 * k}px) scale(1.05, .95)`, offset: .46 },
      { transform: `translateY(${0.6 * k}px)`, offset: .7 },
      { transform: "none" },
    ], { duration: 480, easing: ease });
    return btn.finished;
  };

  // ---------- hanging stat tags: swing on hover, always finishing the motion ----------
  const stats = [...document.querySelectorAll(".stat")];
  const swing = (s, hovered = false) => {
    if (reduceMotion || s.classList.contains("bump")) return;
    s.classList.toggle("hovered", hovered);
    s.classList.add("bump");
  };
  for (const s of stats) {
    s.addEventListener("mouseenter", () => swing(s, true));
    s.addEventListener("animationend", () => s.classList.remove("bump", "hovered"));
  }

  const swapToOutro = () => {
    // outro is paused on its first frame (== intro frame 106): show it, then play.
    outro.classList.remove("is-hidden");
    state = "outro";
    setStory("done");
    setTimeout(() => stats.forEach((s) => swing(s)), 420);   // the food lands: the tags get bumped
    requestAnimationFrame(() => {
      outro.play().catch(() => {});
      if (useIntro) intro.classList.add("is-hidden");
    });
  };

  outro.addEventListener("ended", () => {
    state = "done";
    outro.pause();                                     // stay on the final frame
    ctaLabel.firstChild.nodeValue = "yum! thank you ♥";
  });

  cta.addEventListener("click", async () => {
    if (state !== "interactive") return;              // lock while anything is playing
    state = "pressing";
    cta.setAttribute("aria-disabled", "true");
    await press();
    const [, out] = await Promise.all([introReady, outroReady]);
    if (!out) { state = "done"; return; }

    // If clicked before the cat finished turning, let the intro play out first.
    const remaining = introOk ? T_END - intro.currentTime : 0;
    if (useIntro && introOk && remaining > 1 / FPS) {
      state = "finishing";
      intro.playbackRate = Math.min(3, Math.max(1, remaining / 0.9));
      intro.addEventListener("ended", swapToOutro, { once: true });
      intro.play().catch(swapToOutro);
    } else {
      swapToOutro();
    }
  });
})();
