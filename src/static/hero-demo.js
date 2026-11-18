/* Home hero: pick a business and the website in the browser window rebuilds for it.
   Example businesses only (made-up names). Each change: colours fade, the address types itself, the words and
   cards slide in, the trade's bear jumps, then a booking pops up. Until the visitor picks one, the businesses
   change on their own every few seconds (not with reduced motion, and never while the mouse is over it).
   "Now try yours": the visitor types their business name and the demo becomes their website (name, address,
   button). The button then carries the name and the business type to the order form (?business=…&industry=…).
   Also here, for every page: the sale's "N days left" ([data-sale-ends], from catalog.json's sale). */
(() => {
  // the sale deadline, counted in the visitor's own time
  document.querySelectorAll("[data-sale-ends]").forEach((el) => {
    const days = Math.ceil((new Date(el.dataset.saleEnds + "T23:59:59") - Date.now()) / 864e5);
    if (days >= 1 && days <= 60) el.textContent = ` · ${days === 1 ? "last day" : days + " days left"}`;
  });

  // the order form: fill the business name and "What does the business do?" from the link, if they're still empty
  const q = new URLSearchParams(location.search);
  [["business", 40], ["industry", 60]].forEach(([name, max]) => {
    const v = q.get(name), field = document.querySelector(`#orderForm [name="${name}"]`);
    if (v && field && !field.value) { field.value = v.slice(0, max); field.dispatchEvent(new Event("input", { bubbles: true })); }
  });

  const live = document.getElementById("live");
  if (!live) return;
  const site = document.getElementById("liveSite"), url = document.getElementById("liveUrl"), cta = document.getElementById("liveCta");
  const video = site.querySelector(".site__bear video"), toast = site.querySelector(".site__toast");
  const buttons = [...live.querySelectorAll(".live__pick button")];
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let bears = {};
  try { bears = JSON.parse(document.getElementById("bearList")?.textContent || "{}"); } catch {}
  const ua = navigator.userAgent;
  const apple = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) || (/Safari\//.test(ua) && !/Chrom|Edg|Firefox|OPR/.test(ua));
  const ext = apple ? "mp4" : "webm";

  const SITES = {
    cafe: { my: "café", bear: "barista", industry: "Café", url: "littlebean.com.au", name: "Little Bean", tag: "Surry Hills · from 6:30am", h: "Coffee that's ready when you are.", cta: "Order ahead",
      reviews: "4.9 · 312 Google reviews", s: [["Flat white", "$5.50"], ["Brekkie roll", "$14"], ["Banana bread", "$6.50"]], toast: "New order · 2 flat whites, pick-up 8:10",
      c: ["#f6efe6", "#ecdcc8", "#8a4b25", "#2b1d14"] },
    beauty: { my: "salon", bear: "beauty", industry: "Beauty salon", url: "glowstudio.com.au", name: "Glow Studio", tag: "Paddington · nails, brows & lashes", h: "Book your glow in 30 seconds.", cta: "Book now",
      reviews: "5.0 · 208 Google reviews", s: [["Gel nails", "$55"], ["Brow lamination", "$75"], ["Lash lift", "$90"]], toast: "Booked · Thu 4:00pm · Gel nails · deposit paid",
      c: ["#fdf0f4", "#f8d3e2", "#d4407f", "#3a1626"] },
    barber: { my: "barbershop", bear: "hairdresser", industry: "Barber", url: "sharpandco.com.au", name: "Sharp & Co", tag: "Newtown · walk-ins & bookings", h: "Fresh cuts. No waiting around.", cta: "Book a cut",
      reviews: "4.8 · 540 Google reviews", s: [["Skin fade", "$45"], ["Beard trim", "$25"], ["Cut + beard", "$65"]], toast: "Booked · Today 5:30pm · Skin fade",
      c: ["#eef0f3", "#d6dce3", "#1f2a37", "#11161d"] },
    groomer: { my: "grooming business", bear: "groomer", industry: "Dog grooming", url: "bondipaws.com.au", name: "Bondi Paws", tag: "Bondi · prices by dog size", h: "Happy dogs. Clean coats.", cta: "Book a groom",
      reviews: "4.9 · 187 Google reviews", s: [["Small dog", "$70"], ["Medium dog", "$90"], ["Large dog", "$120"]], toast: "Booked · Sat 10:30 · Full groom for Milo",
      c: ["#e9f6f2", "#c9ebe2", "#0e8a78", "#0f2e29"] },
    cleaner: { my: "cleaning business", bear: "cleaner", industry: "Cleaning", url: "sparkclean.com.au", name: "Spark Clean", tag: "Parramatta · bond-back cleans", h: "Your price in 10 seconds.", cta: "Get my price",
      reviews: "4.9 · 421 Google reviews", s: [["2-bed clean", "$189"], ["End of lease", "$349"], ["Oven clean", "$79"]], toast: "Paid · End of lease clean · Fri 9am",
      c: ["#ecf8ef", "#cdeed8", "#1c9a52", "#10301d"] },
    mechanic: { my: "workshop", bear: "mechanic", industry: "Car mechanic", url: "torqueauto.com.au", name: "Torque Auto", tag: "Marrickville · same-day service", h: "Car serviced while you work.", cta: "Book a service",
      reviews: "4.8 · 263 Google reviews", s: [["Logbook service", "$199"], ["Brakes", "from $149"], ["Rego check", "$45"]], toast: "Quote request · 3 photos attached",
      c: ["#f1f3f6", "#dde3ea", "#e0462b", "#151b24"] },
    physio: { my: "clinic", bear: "physio", industry: "Physiotherapy", url: "movephysio.com.au", name: "Move Physio", tag: "Bondi Junction · same-week appointments", h: "Back on your feet, sooner.", cta: "Book an appointment",
      reviews: "5.0 · 156 Google reviews", s: [["Initial consult", "$110"], ["Follow-up", "$90"], ["Sports massage", "$95"]], toast: "Booked · Mon 7:15am · Initial consult",
      c: ["#eef3fb", "#d3dff5", "#2459c6", "#121f3a"] },
    dentist: { my: "practice", bear: "dentist", industry: "Dental clinic", url: "smilelab.com.au", name: "Smile Lab", tag: "Chatswood · open Saturdays", h: "A check-up you'll actually book.", cta: "Book a check-up",
      reviews: "4.9 · 298 Google reviews", s: [["Check-up & clean", "$199"], ["Whitening", "$450"], ["Emergency visit", "$150"]], toast: "Booked · Wed 12:30 · Check-up & clean",
      c: ["#edf7fb", "#cfe9f5", "#168bc4", "#0e2a38"] },
    pilates: { my: "studio", bear: "pilates", industry: "Pilates studio", url: "corestudio.com.au", name: "Core Studio", tag: "Manly · reformer classes", h: "Stronger in 8 classes.", cta: "Book a class",
      reviews: "5.0 · 133 Google reviews", s: [["Intro pack", "$59"], ["Single class", "$32"], ["10-class pack", "$280"]], toast: "Booked · Tue 6:00am · Reformer",
      c: ["#f1f5ec", "#dce8cf", "#5c8a35", "#1d2a14"] },
  };
  const ORDER = buttons.map((b) => b.dataset.k);

  // the posters of every bear, so a switch never shows an empty frame
  Object.values(SITES).forEach((d) => { const b = bears[d.bear]; if (b) new Image().src = b.poster; });

  let current = "cafe", typing, toastTimer, cycle, picked = false, mine = "";
  const nameBox = document.getElementById("liveName");
  const slug = (t) => t.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "").slice(0, 24);
  // the visitor's own name on the demo: logo, address and the order button
  const brand = (animate) => {
    const d = SITES[current];
    set("name", mine || d.name);
    const address = mine && slug(mine) ? slug(mine) + ".com.au" : d.url;
    if (animate) typeUrl(address); else { clearInterval(typing); url.textContent = address; }
    cta.firstChild.textContent = mine ? `Get this website for ${mine} ` : "Get a website like this ";
    cta.href = `/order/?type=website&industry=${encodeURIComponent(d.industry)}${mine ? "&business=" + encodeURIComponent(mine) : ""}`;
  };
  const set = (f, v) => site.querySelectorAll(`[data-f="${f}"]`).forEach((el) => (el.textContent = v));
  const typeUrl = (text) => {
    clearInterval(typing);
    if (still) { url.textContent = text; return; }
    let i = 0; url.textContent = "";
    typing = setInterval(() => { url.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(typing); }, 38);
  };
  const jump = () => {
    if (still) return;
    video.currentTime = 0;
    video.play().catch(() => {});
  };

  function show(k) {
    const d = SITES[k];
    if (!d) return;
    current = k;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === k)));
    [["--s-bg", 0], ["--s-soft", 1], ["--s-accent", 2], ["--s-ink", 3]].forEach(([v, i]) => site.style.setProperty(v, d.c[i]));
    ["tag", "h", "cta", "reviews", "toast"].forEach((f) => set(f, d[f]));
    d.s.forEach(([name, price], i) => { set(`s${i}`, name); set(`p${i}`, price); });
    brand(true);
    site.classList.remove("is-swap"); void site.offsetWidth; site.classList.add("is-swap");
    const b = bears[d.bear];
    if (b) { video.poster = b.poster; video.src = b[ext]; video.load(); jump(); }
    toast.classList.remove("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("is-on"), still ? 0 : 1300);
  }
  nameBox?.addEventListener("input", () => {
    picked = true; clearInterval(cycle);   // it's their website now: no more switching on its own
    mine = nameBox.value.replace(/\s+/g, " ").trim();
    brand(false);
  });
  nameBox?.addEventListener("keydown", (e) => { if (e.key === "Enter") nameBox.blur(); });

  buttons.forEach((b) => b.addEventListener("click", () => { picked = true; clearInterval(cycle); show(b.dataset.k); }));

  // until someone picks, the next business every 4.5 s, paused while the mouse is over the demo or it's off screen
  let hovering = false, visible = false;
  live.addEventListener("mouseenter", () => (hovering = true));
  live.addEventListener("mouseleave", () => { hovering = false; live.style.setProperty("--rx", "0deg"); live.style.setProperty("--ry", "0deg"); });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !video.src) show(current);   // the first bear loads once the hero is on screen
  }, { threshold: 0.3 }).observe(live);
  if (!still) cycle = setInterval(() => {
    if (picked || hovering || !visible || document.hidden) return;
    show(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]);
  }, 4500);

  // a slight tilt towards the mouse
  const win = live.querySelector(".live__win");
  if (!still && matchMedia("(hover: hover) and (pointer: fine)").matches) {
    live.addEventListener("mousemove", (e) => {
      const r = win.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      win.style.setProperty("--ry", `${(x * 6).toFixed(2)}deg`);
      win.style.setProperty("--rx", `${(-y * 5).toFixed(2)}deg`);
    });
    live.addEventListener("mouseleave", () => { win.style.setProperty("--rx", "0deg"); win.style.setProperty("--ry", "0deg"); });
  }
})();
