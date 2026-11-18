/* Bears in work clothes (video/bears; the list with fingerprinted file names is in partials/bear-list.html).
   Safari only shows the transparent HEVC (mp4), everyone else the VP9 WebM (same choice as the 404 bear).
   - The sale banner shows all the bears, one jump each, in turn.
   - A .bear <video> on a page (the bear on a page's hero box) loads when it's near the screen,
     plays once, and again on hover.
   - When an order or contact form is sent, the icon on the "sent" screen becomes a bear jumping for joy:
     on the order form, the bear of the visitor's industry (from "What does the business do?").
   Reduced motion: the bear's first frame, still. */
(() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ua = navigator.userAgent;
  const apple = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ||
    (/Safari\//.test(ua) && !/Chrom|Edg|Firefox|OPR/.test(ua));
  const ext = apple ? "mp4" : "webm";
  const play = (v) => {
    if (still) return;
    if (!v.src) { v.src = v.dataset[ext]; v.preload = "auto"; }
    if (!v.paused && v.currentTime < v.duration - 0.3) return;   // mid-jump: let it land
    v.currentTime = 0;
    v.play().catch(() => {});
  };

  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { io.unobserve(e.target); play(e.target); }
  }), { threshold: 0.6 });
  document.querySelectorAll(".bear video[data-webm]").forEach((v) => {
    io.observe(v);
    const host = v.closest(".btn, .contact__head") || v;
    host.addEventListener("mouseenter", () => play(v));
  });

  /* Sale banner: all the bears take turns. Every clip is cut to the same size and standing point (feet at the same spot), so the bears swap in place. Two stacked videos: one plays, the next bear loads in the hidden one and they swap
     when the jump ends, so there is no blank frame between bears. Only while the banner is on screen. */
  const stage = document.getElementById("saleBears");
  if (stage && !still) {
    let clips = [];
    try { clips = JSON.parse(document.getElementById("saleBearList")?.textContent || "[]"); } catch {}
    let [a, b] = stage.querySelectorAll("video"), i = 0, seen = false, started = false;
    const SPEED = 1.35;   /* a little quicker than filmed, so the line of bears keeps moving */
    const cue = (v, n) => { v.src = clips[n % clips.length][ext]; v.preload = "auto"; v.load(); v.defaultPlaybackRate = v.playbackRate = SPEED; };
    const next = () => {
      if (!seen) { started = false; return; }
      const go = () => {
        b.hidden = false; a.hidden = true; b.play().catch(() => {});
        [a, b] = [b, a]; i++; cue(b, i + 1);
      };
      if (b.readyState >= 3) go(); else b.addEventListener("canplay", go, { once: true });
    };
    [a, b].forEach((v) => v.addEventListener("ended", () => { if (v === a) next(); }));
    if (clips.length > 1) new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      if (seen && !started) {
        started = true;
        if (!a.src) { cue(a, 0); cue(b, 1); a.play().catch(() => {}); } else next();
      }
    }, { threshold: 0.4 }).observe(stage);
  }

  let list = {};
  try { list = JSON.parse(document.getElementById("bearList")?.textContent || "{}"); } catch {}
  const KINDS = [
    ["dentist", /dent|teeth|tooth|orthodon/],
    ["groomer", /groom|dog|pet|puppy|cat\b|vet|walker|sitter|kennel/],
    ["hairdresser", /hair|barber/],
    ["beauty", /beauty|nail|brow|lash|make-?up|skin|spa\b|salon|cosmet|tann|wax/],
    ["cleaner", /clean|maid|laundr|carpet|window|pressure wash/],
    ["barista", /caf|coffee|barista|restaurant|bakery|bake|food|bar\b|pub|catering|pizza|kitchen|chef/],
    ["physio", /physio|chiro|osteo|massage|rehab|clinic|health|medical|doctor|gp\b|psych|therap|podiat|nurs/],
    ["pilates", /pilates|yoga|gym|fitness|coach|personal train|trainer|tutor|teach|lesson|sport|dance|martial|swim/],
    ["mechanic", /mechanic|car\b|cars|auto|plumb|electric|build|trade|tradie|carpent|landscap|roof|paint|til(e|ing)|handyman|install|repair|joiner|fenc|concret|weld|garage/],
  ];
  const kindFor = (text) => (KINDS.find(([, re]) => re.test(text.toLowerCase())) || ["wave"])[0];
  const celebrate = (done, kind) => {
    const icon = done.querySelector(".form__doneIcon"), b = list[kind] || list.wave;
    if (!icon || !b) return;
    icon.innerHTML = `<span class="bear bear--stand" aria-hidden="true"><video muted playsinline disablepictureinpicture poster="${b.poster}"></video></span>`;
    const v = icon.querySelector("video");
    v.dataset.webm = b.webm; v.dataset.mp4 = b.mp4;
    setTimeout(() => play(v), 350);   // after the page has scrolled to the message
  };
  [["ordDone", () => kindFor(document.querySelector('#orderForm [name="industry"]')?.value || "")], ["formDone", () => "wave"], ["bookDone", () => "wave"]]
    .forEach(([id, kind]) => {
      const done = document.getElementById(id);
      if (!done) return;
      new MutationObserver(() => { if (!done.hidden && !done.dataset.bear) { done.dataset.bear = "1"; celebrate(done, kind()); } })
        .observe(done, { attributes: true, attributeFilter: ["hidden"] });
    });
})();
