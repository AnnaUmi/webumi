/* Small helpers for the sale and the order form, on every page:
   - the sale's "N days left" ([data-sale-ends]) and the ticking countdown in the top strip ([data-sale-clock]), in the visitor's own time;
   - the order form fills the business name and "What does the business do?" from a link (?business=…&industry=…). */
(() => {
  document.querySelectorAll("[data-sale-ends]").forEach((el) => {
    const days = Math.ceil((new Date(el.dataset.saleEnds + "T23:59:59") - Date.now()) / 864e5);
    if (days >= 1 && days <= 60) el.textContent = ` · ${days === 1 ? "last day" : days + " days left"}`;
  });
  /* the strip above the menu: days, hours, minutes and seconds to the end of the sale, ticking; gone when it's over */
  document.querySelectorAll("[data-sale-clock]").forEach((el) => {
    const end = new Date(el.dataset.saleClock + "T23:59:59").getTime(), two = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const s = Math.floor((end - Date.now()) / 1000);
      if (s < 0) { el.textContent = ""; clearInterval(timer); return; }
      el.innerHTML = `<b>${Math.floor(s / 86400)}<i>d</i></b><b>${two(Math.floor(s / 3600) % 24)}<i>h</i></b><b>${two(Math.floor(s / 60) % 60)}<i>m</i></b><b>${two(s % 60)}<i>s</i></b>`;
    };
    const timer = setInterval(tick, 1000); tick();
  });
  const q = new URLSearchParams(location.search);
  [["business", 40], ["industry", 60]].forEach(([name, max]) => {
    const v = q.get(name), field = document.querySelector(`#orderForm [name="${name}"]`);
    if (v && field && !field.value) { field.value = v.slice(0, max); field.dispatchEvent(new Event("input", { bubbles: true })); }
  });

  /* Home hero: the pointer drives the scene. Left-right, the bear turns its head after it; up-down, the cranes lift and lower their loads.
     A canvas fades in over the looping video: it draws the video's first frame (the poster) and, on it, the moving parts cut from the same footage
     (hero-head/card/block.webp: frame sheets, positions in the 1920x1080 picture). A few seconds without the pointer and it eases back to
     that first frame, the video restarts under it and the canvas fades out, so nothing jumps either way. */
  const hero = document.getElementById("setHero"), art = document.getElementById("setArt"), play = document.getElementById("setPlay");
  if (hero && art && play && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const PARTS = { head: { x: 1010, y: 227, w: 545, h: 673, cols: 7, n: 28 }, card: { x: 680, y: 257, w: 326, h: 358, cols: 6, n: 12 }, block: { x: 1552, y: 88, w: 333, h: 526, cols: 5, n: 9 } };
    const BEAR_X = 1253 / 1920, CENTRE = 15 / 27;   /* where the bear stands in the picture; the head sheet's frame that looks at the camera */
    const ctx = play.getContext("2d"), cur = { head: CENTRE, lift: 0 }, to = { head: CENTRE, lift: 0 };
    let ready = 0, asked = false, on = false, raf = 0, timer = 0, back = 0, base = null;
    const load = () => {
      if (asked) return; asked = true;
      base = new Image(); base.onload = () => ready++; base.src = art.poster;
      Object.keys(PARTS).forEach((k) => { const im = new Image(); im.onload = () => { PARTS[k].im = im; ready++; }; im.src = play.dataset[k]; });
    };
    const part = (k, t) => {
      const p = PARTS[k], i = Math.max(0, Math.min(p.n - 1, Math.round(t * (p.n - 1))));
      ctx.drawImage(p.im, (i % p.cols) * p.w, Math.floor(i / p.cols) * p.h, p.w, p.h, p.x, p.y, p.w, p.h);
    };
    const draw = () => {
      raf = 0;
      if (ready < 4) { raf = requestAnimationFrame(draw); return; }
      cur.head += (to.head - cur.head) * .16; cur.lift += (to.lift - cur.lift) * .16;
      ctx.drawImage(base, 0, 0, 1920, 1080); part("head", cur.head); part("card", cur.lift); part("block", cur.lift);
      if (!on) { on = true; hero.classList.add("is-played"); setTimeout(() => { if (on) art.pause(); }, 450); }   /* the video stops once the canvas covers it */
      if (Math.abs(to.head - cur.head) + Math.abs(to.lift - cur.lift) > .002) raf = requestAnimationFrame(draw);
    };
    const stop = () => {
      to.head = CENTRE; to.lift = 0; if (!raf) raf = requestAnimationFrame(draw);
      clearTimeout(back); back = setTimeout(() => {   /* eased back to the first frame: restart the video under the canvas, then uncover it */
        art.currentTime = 0; art.play().catch(() => {});
        setTimeout(() => { if (to.lift === 0 && to.head === CENTRE) { on = false; hero.classList.remove("is-played"); } }, 120);
      }, 700);
    };
    hero.addEventListener("pointermove", (e) => {
      load(); clearTimeout(back);
      const r = art.getBoundingClientRect(), y = (e.clientY - r.top) / r.height;
      /* the picture is cropped to cover its box: find the pointer in picture coordinates */
      const scale = Math.max(r.width / 1920, r.height / 1080), ox = (1920 * scale - r.width) * (matchMedia("(max-width: 760px)").matches ? .92 : 1);
      const px = (e.clientX - r.left + ox) / (1920 * scale);
      to.head = px < BEAR_X ? CENTRE * Math.max(0, px - .25) / (BEAR_X - .25) : CENTRE + (1 - CENTRE) * Math.min(1, (px - BEAR_X) / (1 - BEAR_X) * 1.25);
      to.lift = Math.max(0, Math.min(1, 1.15 - y * 1.3));
      if (!raf) raf = requestAnimationFrame(draw);
      clearTimeout(timer); timer = setTimeout(stop, 2500);
    });
    const leave = () => { clearTimeout(timer); if (on) stop(); };
    hero.addEventListener("pointerleave", leave); hero.addEventListener("pointercancel", leave);
  }
})();
