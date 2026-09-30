/* =========================================================
   Webumi — website plan: prices, share links and the presentation page.
   Used by /plan/ (the AI planner) and /plan/offer/ (the presentation).
   Prices always come from /api/catalog.json, never from the AI.
   ========================================================= */
(() => {
  const aud = (n) => "$" + Math.round(n).toLocaleString("en-AU");
  const half = (n) => Math.ceil(n / 2);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ic = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let catalogPromise;
  const loadCatalog = () => (catalogPromise ||= fetch("/api/catalog.json").then((r) => { if (!r.ok) throw new Error("catalog"); return r.json(); }));

  /* ---------- Price an offer from the catalog ---------- */
  function price(offer, catalog) {
    const t = offer.type === "landing" ? "landing" : "website";
    const type = catalog.types[t];
    const pages = t === "website" ? Math.min(type.maxPages, Math.max(type.pages, offer.pages || type.pages)) : 1;
    const lines = [{ id: "base", name: `${type.name} (${type.pages} page${type.pages > 1 ? "s" : ""})`, why: "", value: type.price }];
    const extra = t === "website" ? pages - type.pages : 0;
    if (extra > 0) lines.push({ id: "pages", name: `${extra} extra page${extra > 1 ? "s" : ""}`, why: "", value: extra * type.extraPage });

    // one option per group; monthly plans include domain + hosting, so they win over the one-off hosting option
    const find = (id) => catalog.options.find((x) => x.id === id);
    const sorted = [...(offer.options || [])].sort((a, b) => !!find(b.id)?.monthly - !!find(a.id)?.monthly);
    const byGroup = {}, picked = [];
    sorted.forEach((o) => {
      const opt = find(o.id);
      if (!opt || picked.some((p) => p.opt.id === opt.id)) return;
      if (opt.group) { if (byGroup[opt.group]) return; byGroup[opt.group] = true; }
      picked.push({ opt, why: o.why });
    });

    let total = lines.reduce((s, l) => s + l.value, 0), monthly = 0, noRush = 0, speed = null;
    const quoted = [], monthlyLines = [];
    picked.forEach(({ opt, why }) => {
      if (opt.quote) return quoted.push({ id: opt.id, name: opt.name, why });
      if (opt.group === "speed") return (speed = { opt, why });
      if (opt.monthly) { monthly += opt.monthly; return monthlyLines.push({ id: opt.id, name: opt.name, why, value: opt.monthly }); }
      const name = opt.id === "crm" && offer.crm_system && offer.crm_system !== "none" ? `${opt.name}: ${offer.crm_system}` : opt.name;
      total += opt[t]; if (opt.noRush) noRush += opt[t];
      lines.push({ id: opt.id, name, why, value: opt[t], from: !!opt.from });
    });
    if (speed) {
      const fee = Math.round(((total - noRush) * speed.opt.percent) / 100 / 10) * 10;
      lines.push({ id: speed.opt.id, name: `${speed.opt.name} (+${speed.opt.percent}%)`, why: speed.why, value: fee });
      total += fee;
    }
    const ids = new Set(picked.map((p) => p.opt.id));
    const from = lines.some((l) => l.from);   // e.g. an online store "from $1,290": the total is a starting price
    return { t, type, pages, lines, monthlyLines, quoted, total, monthly, ids, from, speed: speed?.opt.id, time: speed ? speed.opt[t + "Time"] : type.time };
  }

  /* ---------- Share links: the whole plan lives in the URL hash ---------- */
  const encode = (offer) => btoa(unescape(encodeURIComponent(JSON.stringify(offer)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const decode = (s) => JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/")))));
  const linkFor = (offer) => `/plan/offer/#${encode(offer)}`;

  function planText(offer, p) {
    return [
      `Website plan for ${offer.business_name}`, offer.headline, "",
      ...p.lines.map((l) => `- ${l.name}: ${l.from ? "from " : ""}${aud(l.value)}`),
      ...p.monthlyLines.map((l) => `- ${l.name}: ${aud(l.value)}/month`),
      ...p.quoted.map((l) => `- ${l.name}: quoted after a chat`),
      `Total: ${p.from ? "from " : ""}${aud(p.total)}${p.monthly ? ` + ${aud(p.monthly)}/month` : ""}`, "",
      "Pages: " + (offer.sitemap || []).map((s) => s.name).join(", "),
      "", `Full plan: ${location.origin}${linkFor(offer)}`,
    ].join("\n");
  }

  window.WebumiOffer = { loadCatalog, price, encode, decode, linkFor, planText, aud, half, esc };

  /* =========================================================
     Presentation page
     ========================================================= */
  const root = $id("pres");
  if (!root) return;
  function $id(id) { return document.getElementById(id); }

  const ICONS = {
    base: "doc", pages: "doc", "design-unique": "sparkle", "text-written": "doc", "images-stock": "camera", "images-unique": "camera",
    "cms-simple": "doc", "cms-wordpress": "folder", "hosting-year": "search", care: "shield", "care-plus": "lifebuoy", "care-growth": "chart",
    booking: "calendar", payments: "card", logo: "star", blog: "doc", email: "envelope", "quote-form": "inbox", crm: "user", store: "card",
    "email-marketing": "envelope", reviews: "star", tracking: "chart", whatsapp: "chat", "ai-assistant": "robot", automations: "bolt", rush: "clock", express: "bolt",
  };
  // share of the timeline each step takes: [start, end] where 1 = launch
  const SPANS = [[0, .05], [.05, .12], [.12, .28], [.28, .48], [.48, .86], [.86, 1], [1, 1.2]];
  const COLORS = ["#0f2a3d", "#ff6b4a", "#1ee3ff", "#ffd23f", "#1fa592", "#8b7cf6", "#ff9fb2", "#6fe3d1", "#f4a261", "#5d6c78"];

  function flow(o, p) {
    const has = (id) => p.ids.has(id);
    const col = (title, items, cls = "") => `
      <div class="pz-flow__col ${cls}" data-anim>
        <p class="pz-flow__title">${title}</p>
        ${items.filter(Boolean).map(([icon, text, sub]) => `<div class="pz-node">${ic(icon)}<span><b>${esc(text)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span></div>`).join("")}
      </div>`;
    const arrow = `<div class="pz-flow__arrow" aria-hidden="true"><span></span></div>`;
    return `<div class="pz-flow">
      ${col("Customers find you", [["search", "Google search", "people looking for what you do"], ["pin", "Google Maps", "Business Profile"], ["sparkle", "ChatGPT & AI search", "recommends businesses it can read clearly"], ["chat", "Social & word of mouth"], has("tracking") && ["chart", "Google & Meta ads", "tracked"]])}
      ${arrow}
      ${col("They land on your site", [["doc", p.type.name, `${p.pages} page${p.pages > 1 ? "s" : ""}, fast on phones`], has("reviews") && ["star", "Google reviews", "shown on the site"]], "pz-flow__col--site")}
      ${arrow}
      ${col("They take action", [["phone", "Call or enquiry form"], has("quote-form") && ["inbox", "Smart quote form", "with photos"], has("booking") && ["calendar", "Book online"], has("store") && ["card", "Buy products"], has("whatsapp") && ["chat", "WhatsApp you"], has("ai-assistant") && ["robot", "AI assistant", "answers 24/7"], has("email-marketing") && ["envelope", "Join your newsletter"]])}
      ${arrow}
      ${col("Behind the scenes", [has("payments") && ["card", "Payment or deposit taken"], has("crm") && ["user", "Saved in your CRM", o.crm_system && o.crm_system !== "none" ? o.crm_system : ""], has("automations") && ["bolt", "Follow-ups sent automatically"], ["envelope", "Instant reply to the customer"], ["chart", "Counted in Google Analytics"]])}
      ${arrow}
      ${col("You", [["bell", "You get the details", "by email or phone"], (has("care") || has("care-plus") || has("care-growth")) && ["shield", "Site looked after", "support plan"]], "pz-flow__col--you")}
    </div>`;
  }

  function sitemap(o, p) {
    const items = o.sitemap || [];
    const home = items[0], rest = items.slice(1);
    if (p.t === "landing") return `<ol class="pz-sections">${items.map((s, i) => `<li data-anim style="--i:${i}"><span class="pz-sections__n">${i + 1}</span><b>${esc(s.name)}</b><small>${esc(s.purpose)}</small></li>`).join("")}</ol>`;
    return `<div class="pz-tree">
      <div class="pz-tree__root" data-anim>${ic("doc")}<b>${esc(home?.name || "Home")}</b><small>${esc(home?.purpose || "")}</small></div>
      <div class="pz-tree__kids">${rest.map((s, i) => `<div class="pz-tree__kid" data-anim style="--i:${i}"><b>${esc(s.name)}</b><small>${esc(s.purpose)}</small></div>`).join("")}</div>
    </div>`;
  }

  function priceChart(p) {
    const segs = p.lines.map((l, i) => ({ ...l, color: COLORS[i % COLORS.length], pct: (l.value / p.total) * 100 }));
    return `<div class="pz-chart" data-anim>
      <div class="pz-bar" role="img" aria-label="Price breakdown">${segs.map((s) => `<span style="--w:${s.pct}%;--c:${s.color}" title="${esc(s.name)}: ${aud(s.value)}"></span>`).join("")}</div>
      <ul class="pz-legend">${segs.map((s) => `<li><i style="--c:${s.color}"></i><span>${esc(s.name)}</span><b>${s.from ? "from " : ""}${aud(s.value)}</b></li>`).join("")}</ul>
      <div class="pz-total"><span>${p.from ? "Total, from" : "Total"}</span><b data-count="${p.total}">${aud(p.total)}</b></div>
      ${p.monthly ? `<p class="pz-monthly">+ ${aud(p.monthly)}/month for ${esc(p.monthlyLines.map((l) => l.name).join(", "))}, starting 30 days after launch</p>` : ""}
      ${p.quoted.length ? `<p class="pz-quoted">+ ${esc(p.quoted.map((q) => q.name).join(" and "))}: priced after a free chat</p>` : ""}
    </div>`;
  }

  function timeline(catalog, p) {
    const steps = catalog.process;
    return `<div class="pz-gantt" data-anim>
      <div class="pz-gantt__axis"><span>Day 1</span><span>Launch · ${esc(p.time)}</span><span>+30 days</span></div>
      ${steps.map((st, i) => {
        const [a, b] = SPANS[i] || [1, 1.2];
        return `<div class="pz-gantt__row"><div class="pz-gantt__label"><b>${esc(st.step)}</b><small>You: ${esc(st.you)}</small></div>
          <div class="pz-gantt__track"><span style="--a:${(a / 1.2) * 100}%;--b:${((b - a) / 1.2) * 100}%;--i:${i}"${i === steps.length - 1 ? ' class="is-after"' : ""}></span></div></div>`;
      }).join("")}
    </div>`;
  }

  // tools that aren't in the plan yet, explained in plain words, with an "Add to my plan" button
  function suggestions(o, p, catalog) {
    const hasCms = [...p.ids].some((id) => id.startsWith("cms-"));
    const hasPlan = ["care", "care-plus", "care-growth"].some((id) => p.ids.has(id));
    const list = (catalog.suggest || [])
      .map((id) => catalog.options.find((x) => x.id === id))
      .filter((opt) => opt && opt.explain && !p.ids.has(opt.id) && !(opt.id === "cms-simple" && hasCms) && !(opt.id === "care" && hasPlan))
      .slice(0, 4);
    if (!list.length) return "";
    const priceOf = (opt) => (opt.monthly ? `${aud(opt.monthly)}/month` : `${opt.from ? "from " : ""}${aud(opt[p.t])}`);
    return `
      <section class="pz-sec"><div class="wrap">
        <p class="kicker">Worth considering</p>
        <h2>Tools that could help you.</h2>
        <p class="pz-lead">Not in your plan yet. Add any of them and the price updates straight away.</p>
        <div class="pz-tools">${list.map((opt, i) => `
          <article class="pz-tool" data-anim style="--i:${i}">
            <span class="pz-card__ic">${ic(ICONS[opt.id] || "sparkle")}</span>
            <h3>${esc(opt.name)}</h3>
            <p>${esc(opt.explain)}</p>
            <div class="pz-tool__foot"><b>${priceOf(opt)}</b><button type="button" class="btn btn--small btn--primary" data-add="${opt.id}">Add to my plan</button></div>
          </article>`).join("")}
        </div>
      </div></section>`;
  }

  // change the plan from the presentation: update the link (and the planner's copy), redraw without replaying animations
  function update(o, catalog, change) {
    o = { ...o, options: change(o.options || []) };
    history.replaceState(null, "", linkFor(o));
    try { const st = JSON.parse(sessionStorage.getItem("webumiPlan")); if (st) { st.offer = o; sessionStorage.setItem("webumiPlan", JSON.stringify(st)); } } catch {}
    const y = scrollY;
    root.classList.add("no-anim");
    render(o, catalog);
    scrollTo(0, y);
  }

  function render(o, catalog) {
    const p = price(o, catalog);
    const phone = $id("ctPhone")?.textContent || "", email = $id("ctEmail")?.textContent || "";
    const mins = $id("cal")?.dataset.videoMinutes || "15";
    const express = p.speed === "express";
    const words = esc(o.headline).split(" ").map((w, i) => `<span style="--i:${i}">${w}</span>`).join(" ");
    const sugg = suggestions(o, p, catalog);
    const cards = [...p.lines.filter((l) => l.id !== "base" && l.id !== "pages"), ...p.monthlyLines.map((l) => ({ ...l, monthly: true })), ...p.quoted.map((l) => ({ ...l, quote: true }))];

    root.innerHTML = `
      <section class="pz-cover">
        <div class="pz-cover__blob pz-cover__blob--1" aria-hidden="true"></div>
        <div class="pz-cover__blob pz-cover__blob--2" aria-hidden="true"></div>
        <div class="wrap pz-cover__in">
          <p class="pz-for">Website plan for <b>${esc(o.business_name)}</b></p>
          <h1 class="pz-headline">${words}</h1>
          <p class="pz-summary">${esc(o.summary)}</p>
          <div class="pz-stats">
            <div class="pz-stat"><small>${p.from ? "Total, from" : "Total"}</small><b data-count="${p.total}">${aud(p.total)}</b></div>
            ${p.monthly ? `<div class="pz-stat"><small>Monthly</small><b>${aud(p.monthly)}</b></div>` : ""}
            <div class="pz-stat"><small>${p.t === "landing" ? "Sections" : "Pages"}</small><b>${p.t === "landing" ? (o.sitemap || []).length : p.pages}</b></div>
            <div class="pz-stat"><small>Live in</small><b class="pz-stat__txt">${esc(p.time)}</b></div>
          </div>
          <a href="#pz-flow" class="pz-scroll">See the plan ↓</a>
        </div>
      </section>

      <section class="pz-sec" id="pz-flow"><div class="wrap">
        <p class="kicker">How it works for your customers</p>
        <h2>From a search to a new customer.</h2>
        ${flow(o, p)}
      </div></section>

      <section class="pz-sec pz-sec--white"><div class="wrap">
        <p class="kicker">${p.t === "landing" ? "Your page" : "Your website"}</p>
        <h2>${p.t === "landing" ? "One page, section by section." : `${p.pages} pages, each with a job.`}</h2>
        ${sitemap(o, p)}
      </div></section>

      <section class="pz-sec"><div class="wrap">
        <p class="kicker">What you get</p>
        <h2>Chosen for your business.</h2>
        <div class="pz-cards">${cards.map((c, i) => `
          <article class="pz-card" data-anim style="--i:${i}">
            <span class="pz-card__ic">${ic(ICONS[c.id] || "sparkle")}</span>
            <h3>${esc(c.name)}</h3>
            <p>${esc(c.why)}</p>
            <div class="pz-card__foot"><b class="pz-card__p">${c.quote ? "Quoted after a chat" : c.monthly ? `${aud(c.value)}/month` : `${c.from ? "from " : ""}${aud(c.value)}`}</b>
              <button type="button" class="pz-card__rm" data-remove="${esc(c.id)}" aria-label="Remove ${esc(c.name)}">Remove</button></div>
          </article>`).join("")}
        </div>
        <div class="pz-incl" data-anim><p>Always included</p><ul>${catalog.included.map((i) => `<li>${ic("sparkle")} ${esc(i)}</li>`).join("")}</ul></div>
      </div></section>

      <section class="pz-sec pz-sec--white"><div class="wrap pz-split">
        <div>
          <p class="kicker">Price</p>
          <h2>One fixed price. No surprises.</h2>
          <p class="pz-lead">Every line comes from Webumi's price list. After a free chat you get a written quote, and that's the price you pay.</p>
          <div class="pz-pay" data-anim>
            <h3>Payments</h3>
            ${express
              ? `<div class="pz-pay__row"><span style="--w:100%"></span><b>${aud(p.total)}</b><small>Upfront (Express starts straight away)</small></div>`
              : `<div class="pz-pay__row"><span style="--w:50%"></span><b>${aud(half(p.total))}</b><small>Deposit, after you approve the quote</small></div>
                 <div class="pz-pay__row"><span style="--a:50%;--w:50%;--d:.3s"></span><b>${aud(p.total - half(p.total))}</b><small>At launch, before the site goes live</small></div>`}
            <p>${esc(catalog.payment.notes[2])}</p>
          </div>
        </div>
        ${priceChart(p)}
      </div></section>

      <section class="pz-sec"><div class="wrap">
        <p class="kicker">Timeline</p>
        <h2>Live in ${esc(p.time)}.</h2>
        <p class="pz-lead">${esc(catalog.communication)}</p>
        ${timeline(catalog, p)}
      </div></section>

      <section class="pz-sec pz-sec--white"><div class="wrap">
        <p class="kicker">Ideas</p>
        <h2>3 ideas for ${esc(o.business_name.startsWith("Your ") ? "your business" : o.business_name)}.</h2>
        <ol class="pz-ideas">${(o.ideas || []).map((idea, i) => `<li data-anim style="--i:${i}"><span>${i + 1}</span><p>${esc(idea)}</p></li>`).join("")}</ol>
      </div></section>

      ${sugg}

      <section class="pz-sec${sugg ? " pz-sec--white" : ""}"><div class="wrap">
        <div class="pz-cta" data-anim>
          <div>
            <h2>Let's go through it together.</h2>
            <p>A free ${esc(mins)}-minute video call from anywhere in Australia, or meet in person in Sydney.</p>
            <ul class="pz-cta__contact"><li>${ic("phone")} ${esc(phone)}</li><li>${ic("envelope")} ${esc(email)}</li><li>${ic("pin")} In-person meetings in Sydney only</li></ul>
          </div>
          <div class="pz-cta__actions">
            <a href="#contact" class="btn btn--primary" id="pzBook">${ic("calendar")} Book a free call</a>
            <button type="button" class="btn btn--ghost" id="pzCopy">Copy link to this plan</button>
            <button type="button" class="btn btn--ghost" id="pzPrint">Save as PDF</button>
            <a href="/plan/" class="btn btn--ghost">Change something</a>
          </div>
        </div>
        <p class="pz-fine">Prices in AUD. Plan made ${new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}.</p>
      </div></section>`;

    // pre-fill the booking and message forms at the bottom of the page
    const text = planText(o, p);
    const note = document.querySelector('#bookForm textarea[name="note"]'); if (note) note.value = text;
    const msg = document.querySelector('#contactForm textarea[name="message"]'); if (msg) msg.value = text;
    const need = [...document.querySelectorAll('input[name="need"]')].find((i) => i.value === (p.t === "landing" ? "Landing page" : "Business website")); if (need) need.checked = true;
    const biz = document.querySelectorAll('input[name="business"]');
    if (!o.business_name.startsWith("Your ")) biz.forEach((b) => { if (!b.value) b.value = o.business_name; });

    root.querySelectorAll("[data-add]").forEach((b) => b.addEventListener("click", () =>
      update(o, catalog, (opts) => [...opts, { id: b.dataset.add, why: catalog.options.find((x) => x.id === b.dataset.add)?.explain || "" }])));
    root.querySelectorAll("[data-remove]").forEach((b) => b.addEventListener("click", () =>
      update(o, catalog, (opts) => opts.filter((x) => x.id !== b.dataset.remove))));
    $id("pzPrint").addEventListener("click", () => print());
    $id("pzCopy").addEventListener("click", async (e) => {
      const url = location.origin + linkFor(o);
      try { await navigator.clipboard.writeText(url); e.target.textContent = "Link copied ✓"; }
      catch { prompt("Copy this link:", url); }
      setTimeout(() => (e.target.textContent = "Copy link to this plan"), 2500);
    });
    animate();
  }

  function animate() {
    const els = [...root.querySelectorAll("[data-anim]")];
    const countUp = (el) => {
      const end = +el.dataset.count, start = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - start) / 1100);
        el.textContent = aud(end * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    root.classList.add("is-ready");
    if (reduceMotion || root.classList.contains("no-anim") || !("IntersectionObserver" in window)) { els.forEach((el) => el.classList.add("in")); return; }
    root.querySelectorAll(".pz-cover [data-count]").forEach(countUp);
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add("in");
      en.target.querySelectorAll("[data-count]").forEach(countUp);
      io.unobserve(en.target);
    }), { threshold: 0.15 });
    els.forEach((el) => io.observe(el));
  }

  function empty(message) {
    root.innerHTML = `<section class="pz-empty"><div class="wrap">
      <p class="kicker">Website plan</p><h1>${esc(message)}</h1>
      <p class="pz-lead">Answer a few questions and get a plan made for your business, with pages, features and a price.</p>
      <a href="/plan/" class="btn btn--primary">Plan my website →</a></div></section>`;
  }

  let offer = null;
  try { if (location.hash.length > 1) offer = decode(location.hash.slice(1)); } catch {}
  if (!offer) try { offer = JSON.parse(sessionStorage.getItem("webumiPlan"))?.offer || null; } catch {}
  if (!offer || !offer.headline) return empty("No plan here yet.");
  loadCatalog().then((c) => render(offer, c)).catch(() => empty("This plan couldn't load. Please refresh the page."));
})();
