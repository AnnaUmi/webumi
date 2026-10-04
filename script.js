/* =========================================================
   Webumi — interactions
   ========================================================= */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ic = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const aud = (n) => "$" + Math.round(n).toLocaleString("en-AU");
  const half = (n) => Math.ceil(n / 2);   // 50% deposit, rounded to whole dollars

  /* Cloudflare Turnstile: an invisible "are you human?" check. Returns a function that resolves to a
     fresh token ("" if there's no site key or Cloudflare's script is blocked, e.g. by an ad blocker). */
  function humanCheck(box) {
    const ts = { widget: null, token: null, waiters: [] };
    const reset = () => setTimeout(() => ts.widget !== null && window.turnstile.reset(ts.widget), 0);
    const init = () => {
      if (ts.widget !== null || !box?.dataset.sitekey || !window.turnstile) return;
      ts.widget = window.turnstile.render(box, {
        sitekey: box.dataset.sitekey,
        appearance: "interaction-only",
        callback: (t) => { ts.token = t; ts.waiters.splice(0).forEach((f) => f(t)); },
        "expired-callback": () => { ts.token = null; },
        "error-callback": () => { ts.waiters.splice(0).forEach((f) => f("")); return true; },
      });
    };
    const poll = setInterval(() => { if (window.turnstile) { clearInterval(poll); init(); } }, 300);
    setTimeout(() => clearInterval(poll), 30000);
    return async () => {
      if (!box?.dataset.sitekey) return "";
      for (let i = 0; i < 16 && !window.turnstile; i++) await new Promise((r) => setTimeout(r, 250));
      if (!window.turnstile) return "";
      init();
      if (ts.token) { const t = ts.token; ts.token = null; reset(); return t; }
      return new Promise((resolve) => {
        const done = (t) => { clearTimeout(timer); ts.token = null; reset(); resolve(t); };
        const timer = setTimeout(() => { ts.waiters = ts.waiters.filter((f) => f !== done); resolve(""); }, 12000);
        ts.waiters.push(done);
      });
    };
  }

  /* ---------- Nav ---------- */
  const nav = $("#nav");
  const burger = $(".nav__burger");
  const links = $(".nav__links");
  const sticky = $("#stickyCta");
  const contact = $("#contact");
  const build = $("#build");

  const onScroll = () => {
    nav.classList.toggle("is-scrolled", scrollY > 8);
    const contactTop = contact ? contact.getBoundingClientRect().top : Infinity;
    const b = build?.getBoundingClientRect();
    const inBuilder = b && b.top < innerHeight && b.bottom > 0;
    sticky.classList.toggle("is-shown", scrollY > 600 && contactTop > innerHeight && !inBuilder);
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  burger.addEventListener("click", () => {
    const open = burger.getAttribute("aria-expanded") !== "true";
    burger.setAttribute("aria-expanded", open);
    links.classList.toggle("is-open", open);
  });
  $$("a", links).forEach((a) => a.addEventListener("click", () => {
    burger.setAttribute("aria-expanded", "false");
    links.classList.remove("is-open");
  }));

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add("is-in");
      io.unobserve(el);
      // Once revealed, hand transitions back to the element's own hover styles
      setTimeout(() => { el.classList.remove("reveal", "is-in"); el.style.transitionDelay = ""; }, 1100);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  $$(".reveal").forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 60}ms`;
    io.observe(el);
  });

  /* ---------- Why Webumi star path ----------
     Joins the star centres with one line, redrawn when the layout changes, and plays once in view. */
  $$("[data-sky]").forEach((sky) => {
    const svg = $(".sky__lines", sky), path = $(".sky__path", sky), stars = $$(".sky__star", sky);
    const draw = () => {
      const box = sky.getBoundingClientRect();
      svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
      path.setAttribute("d", stars.map((s, i) => {
        const r = s.getBoundingClientRect();
        return `${i ? "L" : "M"}${(r.left - box.left + r.width / 2).toFixed(1)} ${(r.top - box.top + r.height / 2).toFixed(1)}`;
      }).join(" "));
    };
    sky.classList.add("is-armed");
    draw();
    new ResizeObserver(draw).observe(sky);
    const skyIO = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      sky.classList.add("is-on");
      skyIO.disconnect();
    }, { threshold: 0.3 });
    skyIO.observe(sky);
  });

  /* ---------- Starting point ----------
     One card at a time: picking it shows its suggestion (or the detailed panel below) and picking it again goes back to "Not sure yet". */
  const pains = $$(".pain");
  const answers = $$(".pains__answer");
  pains.forEach((p) => p.addEventListener("click", () => {
    const on = p.getAttribute("aria-pressed") !== "true";
    pains.forEach((x) => x.setAttribute("aria-pressed", x === p && on));
    const goal = on ? p.dataset.goal : "";
    const detailed = goal in goals;          // customers, bookings, admin, AI: the panel with the customer's journey
    answers.forEach((a) => { a.hidden = detailed || a.dataset.for !== goal; });
    panel.hidden = !detailed;
    if (detailed) showGoal(goal);
  }));

  /* ---------- How it works: the three homepage directions ----------
     Picking a direction shows it in the bigger preview. */
  const demo = $(".demo--big");
  const picks = $$(".journey__pick");
  picks.forEach((b) => b.addEventListener("click", () => {
    picks.forEach((x) => x.setAttribute("aria-pressed", x === b));
    demo.dataset.dir = b.dataset.dir;
  }));

  /* ---------- Starting point: the detailed answers ---------- */
  const goals = {
    customers: {
      more: ["/websites/", "More about websites →"],
      title: "Get found on Google, turn visitors into enquiries.",
      desc: "Many small business websites look fine but don't bring in work. We build yours around one goal: more enquiries.",
      list: [
        "A fast, mobile-first website that says what you do in 5 seconds",
        "Service + suburb pages so you show up where people search",
        "Google Business Profile polished, with reviews front and centre",
        "One-tap call, quote form and instant auto-reply",
      ],
      pkg: ["Business website — from $1,290", "website"],
      flow: [
        ["search", "Customer searches Google", "“landscaper eastern suburbs”"],
        ["pin", "Finds your Google profile", "Reviews, photos, hours"],
        ["phone", "Lands on the exact right page", "Not just your homepage"],
        ["envelope", "Taps “Get a quote”", "30-second form, no friction"],
        ["bolt", "Gets a reply instantly", "“Thanks Sarah, we'll be in touch today”"],
        ["bell", "You get the lead on your phone", "Name, job, photos — ready to go"],
      ],
    },
    bookings: {
      more: ["/online-bookings/", "More about online bookings →"],
      title: "Let customers book (and pay) while you sleep.",
      desc: "No more back-and-forth messages. Customers pick a time, pay a deposit and get a reminder. Selling products? We add an online shop, from $1,290.",
      list: [
        "Booking built into your site, using Square, Fresha or Calendly",
        "Deposits that make no-shows basically disappear",
        "Automatic confirmations and SMS reminders",
        "Review requests and “book again” nudges after every visit",
      ],
      pkg: ["Business website with online booking — from $1,680", "website"],
      flow: [
        ["camera", "Sees you on Instagram", "Taps the link in your bio"],
        ["polish", "Chooses a service", "Clear prices, no DMs needed"],
        ["clock", "Picks a time that suits", "Only your real availability"],
        ["card", "Pays a small deposit", "Commitment = fewer no-shows"],
        ["chat", "Gets reminded the day before", "Automatically, by SMS"],
        ["star", "Leaves a review & rebooks", "Regulars come back more often"],
      ],
    },
    admin: {
      more: ["/automation/", "More about automation →"],
      title: "Stop copy-pasting. Let your tools talk to each other.",
      desc: "Most businesses don't need custom software. They need the apps they already use, connected properly, so routine tasks happen automatically.",
      list: [
        "Every enquiry lands in one simple list (no more lost emails)",
        "Quotes follow themselves up if nobody replies",
        "Jobs → invoices → payments → Xero, without retyping",
        "A weekly snapshot of how the business is actually going",
      ],
      pkg: ["Automations added to any website, app or platform", "platform"],
      flow: [
        ["envelope", "Enquiry comes in", "Website, email or Facebook"],
        ["folder", "Customer added to your CRM", "Automatically, no typing"],
        ["envelope", "Quote sent & followed up", "Nudges after 2 days if quiet"],
        ["calendar", "Job booked into calendar", "You, your team, the customer"],
        ["doc", "Invoice sent, payment taken", "Synced straight to Xero"],
        ["clock", "Hours back every week", "Time for paid work instead of admin"],
      ],
    },
    ai: {
      more: ["/ai-assistants/", "More about AI assistants →"],
      title: "Put AI to work on the repetitive stuff.",
      desc: "A practical assistant trained on your business. It answers questions, sorts enquiries and fills in data for you.",
      list: [
        "An AI assistant on your site that answers and books, 24/7",
        "Enquiries sorted and replies drafted in your tone",
        "Details pulled from emails, forms and PDFs automatically",
        "Plugged into your CRM, calendar, payments or Xero",
      ],
      pkg: ["An AI assistant added to any website, app or platform", "app"],
      flow: [
        ["moon", "Customer asks a question at 11pm", "“How much for a large dog?”"],
        ["sparkle", "AI answers from your price list", "Accurate, friendly, in your tone"],
        ["calendar", "Offers a time and books it", "Straight into your calendar"],
        ["folder", "Saves the details to your CRM", "Name, pet, notes — no typing"],
        ["user", "Hands tricky ones to you", "With a summary, so you're up to speed"],
        ["sun", "You wake up to new bookings", "Not 14 unanswered messages"],
      ],
    },
  };

  const panel = $("#flowPanel");
  function showGoal(key) {
    const g = goals[key];
    $("#goalTitle").textContent = g.title;
    $("#goalDesc").textContent = g.desc;
    $("#goalList").innerHTML = g.list.map((l) => `<li>${l}</li>`).join("");
    const pkgLink = $("#goalPkg");
    pkgLink.textContent = g.pkg[0];
    pkgLink.dataset.target = g.pkg[1];
    const more = $("#goalMore");
    if (more) { more.href = g.more[0]; more.textContent = g.more[1]; }
    $("#goalFlow").innerHTML = g.flow.map(([i, t, s], n) =>
      `<li style="animation-delay:${n * 90}ms"><span class="flow__dot">${ic(i)}</span><span class="flow__t">${t}<span class="flow__s">${s}</span></span></li>`
    ).join("");
    panel.classList.remove("is-swapping");
    void panel.offsetWidth;
    panel.classList.add("is-swapping");
  }

  // Highlight the recommended package when jumping to it
  $("#goalPkg")?.addEventListener("click", (e) => {
    const card = $(`[data-pkg="${e.currentTarget.dataset.target}"]`);
    $$(".pkg").forEach((p) => p.classList.remove("is-highlight"));
    card?.classList.add("is-highlight");
    setTimeout(() => card?.classList.remove("is-highlight"), 3500);
  });

  /* ---------- AI chat demo ---------- */
  const chatBody = $("#chatBody");
  const chatScript = [
    ["user", "Hi! How much is a full groom for a big fluffy dog? 🐕"],
    ["bot", "Hi! A full groom for a large dog is $120 and takes about 2 hours. Want me to find you a time?"],
    ["user", "Yes please, is Saturday morning free?"],
    ["bot", "Saturday 9:00am is free 🙌 Shall I book it? A $25 deposit holds the spot."],
    ["user", "Perfect, book it!"],
    ["bot", "Done! You're booked for Sat 9:00am. Confirmation is on its way to your phone 📲"],
  ];
  let chatRun = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function bubble(who, text) {
    const b = document.createElement("div");
    b.className = `bubble bubble--${who}`;
    b.textContent = text;
    chatBody.appendChild(b);
    chatBody.scrollTop = chatBody.scrollHeight;
    return b;
  }
  async function playChat() {
    const id = ++chatRun;
    chatBody.innerHTML = "";
    if (reduceMotion) { chatScript.forEach(([w, t]) => bubble(w, t)); return; }
    while (id === chatRun) {
      for (const [who, text] of chatScript) {
        if (id !== chatRun) return;
        if (who === "bot") {
          const typing = bubble("bot", "");
          typing.classList.add("bubble--typing");
          typing.innerHTML = "<i></i><i></i><i></i>";
          await sleep(1100);
          typing.remove();
        } else {
          await sleep(900);
        }
        bubble(who, text);
        await sleep(who === "bot" ? 1500 : 500);
      }
      await sleep(3500);
      chatBody.innerHTML = "";
    }
  }
  const chatIO = new IntersectionObserver((e) => {
    if (e[0].isIntersecting) { playChat(); chatIO.disconnect(); }
  }, { threshold: 0.3 });
  if ($(".chat")) chatIO.observe($(".chat"));

  /* ---------- Calculator ---------- */
  const inputs = { hours: $("#hours"), rate: $("#rate"), missed: $("#missed"), job: $("#job") };
  const shown = { hours: 0, money: 0 };
  let tween;

  function paintRange(el) {
    const p = ((el.value - el.min) / (el.max - el.min)) * 100;
    el.style.setProperty("--p", p + "%");
  }

  function calc() {
    const h = +inputs.hours.value, r = +inputs.rate.value, m = +inputs.missed.value, j = +inputs.job.value;
    $("#oHours").textContent = `${h} hr${h === 1 ? "" : "s"}`;
    $("#oRate").textContent = aud(r);
    $("#oMissed").textContent = m;
    $("#oJob").textContent = aud(j);
    Object.values(inputs).forEach(paintRange);

    const hoursBack = h * 0.5 * 48;                     // ~half the admin automated, 48 working weeks
    const timeValue = hoursBack * r;
    const wonBack = m * 0.25 * 12 * j;                  // ~a quarter of missed enquiries recovered
    const target = { hours: hoursBack, money: timeValue + wonBack };

    $("#rHoursSub").textContent = (() => {
      const weekends = hoursBack / 16;
      if (weekends < 1) return `That's about ${Math.round(hoursBack / 8)} full working days.`;
      return `That's about ${Math.round(weekends)} full weekend${Math.round(weekends) === 1 ? "" : "s"} back.`;
    })();
    $("#rBar").style.width = Math.min(100, (target.money / 60000) * 100) + "%";

    cancelAnimationFrame(tween);
    const from = { ...shown };
    const start = performance.now();
    const dur = reduceMotion ? 0 : 450;
    const step = (now) => {
      const k = dur ? Math.min(1, (now - start) / dur) : 1;
      const e = 1 - Math.pow(1 - k, 3);
      shown.hours = from.hours + (target.hours - from.hours) * e;
      shown.money = from.money + (target.money - from.money) * e;
      $("#rHours").textContent = Math.round(shown.hours).toLocaleString("en-AU");
      $("#rMoney").textContent = aud(shown.money);
      if (k < 1) tween = requestAnimationFrame(step);
    };
    tween = requestAnimationFrame(step);
  }
  if (inputs.hours) {
    Object.values(inputs).forEach((el) => el.addEventListener("input", calc));
    calc();
  }

  /* ---------- Count-up stat ---------- */
  const statIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target, end = +el.dataset.count, start = performance.now();
      const step = (now) => {
        const k = reduceMotion ? 1 : Math.min(1, (now - start) / 1200);
        el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      statIO.unobserve(el);
    });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach((el) => statIO.observe(el));

  /* ---------- Website builder ---------- */
  const bld = $("#builder");
  if (bld) {
    const pages = $("#bldPages");
    const typeOf = () => $('input[name="type"]:checked', bld).value;
    const priceOf = (input) => +(input.dataset[typeOf()] || 0);
    const label = (input) => input.closest(".opt").querySelector(".opt__t").textContent;
    let lastTotal = null, summary = [];

    function update() {
      const t = typeOf();
      $$("[data-only]", bld).forEach((el) => (el.hidden = el.dataset.only !== t));
      const crmSystem = $("#bldCrm")?.checked ? bld.elements.crmSystem.value : "";
      if ($("#bldCrmPick")) $("#bldCrmPick").hidden = !crmSystem;
      $$(".bld__step:not([hidden]) .bld__n", bld).forEach((n, i) => (n.textContent = i + 1));
      $$("[data-price]", bld).forEach((el) => (el.textContent = ("from" in el.dataset ? "from +" : "+") + aud(priceOf(el.closest(".opt").querySelector("input")))));
      const timeOf = (input) => input.dataset[t + "Time"];
      $$("[data-time]", bld).forEach((el) => (el.textContent = `Live in ${timeOf(el.closest(".opt").querySelector("input"))}.`));

      const lines = [], quotes = [];
      let total = 0, monthly = 0, from = false;
      const base = $('input[name="type"]:checked', bld);
      const pageCount = t === "website" ? +pages.value : 1;
      const included = t === "website" ? +pages.dataset.min : 1;
      lines.push([`${label(base)} (${included} page${included > 1 ? "s" : ""})`, priceOf(base), true]);
      summary = [`${label(base)}, ${pageCount} page${pageCount > 1 ? "s" : ""} in total: ${aud(priceOf(base))}`];
      total += priceOf(base);

      const extraPages = t === "website" ? pageCount - +pages.dataset.min : 0;
      if (extraPages > 0) {
        const cost = extraPages * +pages.dataset.each;
        lines.push([`${extraPages} extra page${extraPages > 1 ? "s" : ""}`, cost]);
        summary.push(`${extraPages} extra page${extraPages > 1 ? "s" : ""}: ${aud(cost)}`);
        total += cost;
      }

      $$('input:checked:not([name="type"]):not([name="speed"])', bld).forEach((i) => {
        if ("quote" in i.dataset) return quotes.push(i.value);
        if (i.dataset.monthly) {
          monthly += +i.dataset.monthly;
          lines.push([i.value, `${aud(+i.dataset.monthly)}/mo`]);
          return summary.push(`${i.value}: ${aud(+i.dataset.monthly)}/month`);
        }
        const p = priceOf(i), name = i.id === "bldCrm" ? `${i.value} (${crmSystem})` : i.value;
        if (i.closest(".opt").querySelector("[data-from]")) from = true;
        if (p) lines.push([name, p]);
        summary.push(`${name}: ${p ? aud(p) : "included"}`);
        total += p;
      });
      const rushable = total - priceOf($('input[name="hosting"]:checked', bld)); // rush doesn't apply to domain & hosting

      const rush = $('input[name="speed"]:checked', bld);
      if (rush.dataset.rush) {
        const fee = Math.round((rushable * +rush.dataset.rush) / 100 / 10) * 10;
        lines.push([`${rush.value} delivery (+${rush.dataset.rush}%)`, fee]);
        summary.push(`${rush.value} delivery, live in ${timeOf(rush)}: ${aud(fee)}`);
        total += fee;
      } else summary.push(`Standard delivery (live in ${timeOf(rush)})`);

      $("#bldLines").innerHTML = lines.map(([n, p, isBase]) =>
        `<li${isBase ? ' class="is-base"' : ""}><span>${n}</span><span>${typeof p === "number" ? aud(p) : p}</span></li>`).join("");
      const totalEl = $("#bldTotal");
      totalEl.textContent = aud(total);
      $(".bld__total span", bld).textContent = from ? "Total, from" : "Total";
      if (lastTotal !== null && lastTotal !== total && !reduceMotion) {
        totalEl.classList.remove("bump"); void totalEl.offsetWidth; totalEl.classList.add("bump");
      }
      lastTotal = total;
      $("#bldMonthly").hidden = !monthly;
      $("#bldMonthly").textContent = `+ ${aud(monthly)}/month`;
      $("#bldDeposit").textContent = rush.value === "Express" ? "Paid upfront, because Express work starts straight away." : `Pay 50% (${aud(half(total))}) to start and the rest at launch.`;
      $("#bldQuote").hidden = !quotes.length;
      $("#bldQuote").textContent = `+ ${quotes.join(" and ")}: priced once we've discussed your project.`;
      $("#bldBarTotal").textContent = (from ? "from " : "") + aud(total);
      $("#bldBarMonthly").textContent = monthly ? `+ ${aud(monthly)}/mo` : "";

      summary.push("", `Total: ${from ? "from " : ""}${aud(total)}${monthly ? ` + ${aud(monthly)}/month` : ""}`);
      if (quotes.length) summary.push(`Also interested in: ${quotes.join(", ")}`);
    }

    $$(".bld__stepper", bld).forEach((b) => b.addEventListener("click", () => {
      const v = Math.min(+pages.dataset.max, Math.max(+pages.dataset.min, +pages.value + +b.dataset.step));
      pages.value = v;
      $("#bldPagesOut").textContent = v;
      $$(".bld__stepper", bld).forEach((s) => (s.disabled = (s.dataset.step < 0 && v <= +pages.dataset.min) || (s.dataset.step > 0 && v >= +pages.dataset.max)));
      update();
    }));
    $('.bld__stepper[data-step="-1"]', bld).disabled = true;
    bld.addEventListener("change", update);
    update();

    // "Continue to order": the estimate travels to the order form and is attached to the order
    bld.addEventListener("submit", (e) => {
      e.preventDefault();
      try { sessionStorage.setItem("webumiEstimate", ["Price builder estimate:", ...summary].join("\n")); } catch {}
      location.href = `/order/?type=${typeOf()}`;
    });
  }

  /* ---------- Website planner (AI chat → offer) ---------- */
  const planner = $("#planner");
  if (planner) {
    const log = $("#plLog"), chips = $("#plChips"), input = $("#plInput"), plForm = $("#plForm");
    const store = {
      get() { try { return JSON.parse(sessionStorage.getItem("webumiPlan")) || null; } catch { return null; } },
      set(v) { try { sessionStorage.setItem("webumiPlan", JSON.stringify(v)); } catch {} },
      clear() { try { sessionStorage.removeItem("webumiPlan"); } catch {} },
    };
    const greeting = { text: "Hi! We'll help you plan your website and show you what it costs. What do you need?", choices: ["I need a website", "I need a landing page", "Not sure yet"] };
    const afterOffer = ["Open my presentation →", "Make it cheaper", "Add a feature"];
    let state = { messages: [], bubbles: [], offer: null, choices: greeting.choices };
    let catalog, busy = false, planText = "";

    // Cloudflare "are you human?" check, needed once per conversation
    const humanToken = humanCheck($("#plVerify"));

    async function ask(retried = false) {
      const body = { messages: state.messages, conv: state.conv || "", website: plForm.elements.website?.value || "" };
      if (!state.conv) body.turnstile = await humanToken();
      const r = await fetch("/api/chat.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({ error: "The planner is busy. Please try again in a moment." }));
      if (data.code === "verify" && !retried) { state.conv = null; return ask(true); }   // conversation expired: check again once
      if (data.conv) state.conv = data.conv;
      return data;
    }

    function bubble(who, text, save = true) {
      const el = document.createElement("div");
      el.className = `bubble bubble--${who}`;
      el.textContent = text;
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
      if (save) state.bubbles.push([who, text]);
      return el;
    }
    function showChips(list, onPick) {
      state.choices = onPick ? [] : list;
      chips.innerHTML = "";
      list.forEach((c) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "chip"; b.textContent = c;
        b.addEventListener("click", () => (onPick ? onPick(c) : c === "Open my presentation →" ? openPresentation() : send(c)));
        chips.appendChild(b);
      });
    }
    function save() { store.set(state); $("#plReset").hidden = !state.messages.length; }

    async function send(text) {
      text = text.trim();
      if (!text || busy || !catalog) return;
      busy = true;
      bubble("user", text);
      state.messages.push({ role: "user", content: text });
      showChips([]);
      input.value = "";
      const typing = bubble("bot", "", false);
      typing.classList.add("bubble--typing");
      typing.innerHTML = "<i></i><i></i><i></i>";
      const slow = setTimeout(() => { typing.classList.remove("bubble--typing"); typing.textContent = "Putting your plan together…"; }, 4000);
      try {
        const data = await ask();
        typing.remove();
        if (data.error) throw Object.assign(new Error(data.error), { code: data.code });
        const a = data.args;
        if (data.tool === "present_offer") {
          bubble("bot", a.message);
          state.messages.push({ role: "assistant", content: `${a.message}\n[Offer shown to the visitor: ${JSON.stringify(a)}]` });
          state.offer = a;
          renderOffer(a);
          showChips(afterOffer);
          showOffer();
        } else {
          bubble("bot", a.message);
          state.messages.push({ role: "assistant", content: a.message });
          showChips(a.choices || []);
        }
      } catch (e) {
        typing.remove();
        state.messages.pop();
        const shown = e.code ? e.message : e instanceof TypeError ? "Can't reach the planner. Check your internet connection and try again." : e.message || "Something went wrong. Please try again.";
        const err = bubble("bot", shown, false);
        err.classList.add("bubble--error");
        const mine = err.previousElementSibling;
        if (e.code === "limit" || e.code === "budget") {
          // out of messages for today: send people to the free options
          showChips(["Use the price builder", "Book a free call"], (c) => {
            if (c === "Use the price builder") location.href = "/pricing/#build";
            else { contactTab("book"); contact?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" }); }
          });
        } else showChips(["Try again"], () => { err.remove(); mine?.remove(); state.bubbles.pop(); busy = false; send(text); });
      }
      clearTimeout(slow);
      busy = false;
      save();
      const justOffered = state.messages.at(-1)?.content.includes("[Offer shown");
      if (!justOffered) input.focus({ preventScroll: true });
    }

    function renderOffer(o) {
      const W = window.WebumiOffer, p = W.price(o, catalog), link = W.linkFor(o), esc = W.esc;
      planText = W.planText(o, p);
      $("#offerBody").innerHTML = `
        <article class="ofc">
          <div class="ofc__main">
            <p class="of__for">Website plan for <b>${esc(o.business_name)}</b></p>
            <h2>${esc(o.headline)}</h2>
            <ul class="of__facts">
              <li>${esc(p.type.name)}</li><li>${p.pages} page${p.pages > 1 ? "s" : ""}</li><li>Live in ${esc(p.time)}</li>
            </ul>
            <ul class="ofc__lines">
              ${p.lines.map((l) => `<li><span>${esc(l.name)}</span><b>${l.from ? "from " : ""}${W.aud(l.value)}</b></li>`).join("")}
              ${p.monthlyLines.map((l) => `<li><span>${esc(l.name)}</span><b>${W.aud(l.value)}/mo</b></li>`).join("")}
              ${p.quoted.map((l) => `<li><span>${esc(l.name)}</span><b>Quoted</b></li>`).join("")}
            </ul>
          </div>
          <div class="ofc__side">
            <p class="ofc__label">${p.from ? "Total, from" : "Total"}</p>
            <p class="ofc__total">${W.aud(p.total)}</p>
            ${p.monthly ? `<p class="ofc__monthly">+ ${W.aud(p.monthly)}/month</p>` : ""}
            <a class="btn btn--primary btn--block" href="${link}" id="ofOpen">Open your presentation →</a>
            <a class="btn btn--dark btn--block" href="/order/?type=${p.t}">Order this plan</a>
            <button type="button" class="btn btn--ghost btn--block" id="ofBook">${ic("calendar")} Book a free call</button>
            <button type="button" class="btn btn--ghost btn--block" id="ofSend">Email this plan to us</button>
            <p class="ofc__hint">The presentation shows how it all works, your pages, the timeline and payments. You can share its link.</p>
          </div>
        </article>`;
      $("#offer").hidden = false;
      $("#ofSend").addEventListener("click", () => {
        const box = $$('input[name="need"]').find((i) => i.value === (p.t === "landing" ? "Landing page" : "Business website"));
        if (box) box.checked = true;
        const msg = $('#contactForm textarea[name="message"]');
        if (msg) msg.value = planText;
        contactTab("message");
        contact?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
        setTimeout(() => $('#contactForm input[name="name"]')?.focus({ preventScroll: true }), 600);
      });
      $("#ofBook").addEventListener("click", () => {
        const note = $('#bookForm textarea[name="note"]');
        if (note) note.value = planText;
        const biz = $('#bookForm input[name="business"]');
        if (biz && !biz.value && !/^your /i.test(o.business_name)) biz.value = o.business_name;
        contactTab("book");
        contact?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      });
    }
    function showOffer() { $("#offer").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" }); }
    function openPresentation() { if (state.offer) location.href = window.WebumiOffer.linkFor(state.offer); }

    plForm.addEventListener("submit", (e) => { e.preventDefault(); send(input.value); });
    $("#plReset").addEventListener("click", () => {
      store.clear();
      state = { messages: [], bubbles: [], offer: null, choices: greeting.choices, conv: null };
      log.innerHTML = ""; $("#offer").hidden = true;
      bubble("bot", greeting.text, false); showChips(greeting.choices); save();
    });

    bubble("bot", greeting.text, false);
    window.WebumiOffer.loadCatalog().then((c) => {
      catalog = c;
      const saved = store.get();
      if (saved?.messages?.length && Array.isArray(saved.bubbles)) {
        state = saved;
        state.bubbles.forEach(([w, t]) => bubble(w, t, false));
        if (state.offer) try { renderOffer(state.offer); } catch { state.offer = null; }
      }
      showChips(state.choices || []);
      save();
    }).catch(() => {
      const err = bubble("bot", "The planner couldn't load. Please refresh the page, or use the contact form below.", false);
      err.classList.add("bubble--error");
    });
  }

  /* ---------- Package buttons pre-fill the form ---------- */
  $$("[data-choose]").forEach((b) => b.addEventListener("click", () => {
    const box = $$('input[name="need"]').find((i) => i.value === b.dataset.choose);
    if (box) box.checked = true;
    const msg = $('textarea[name="message"]');
    if (msg && !msg.value) msg.value = `I'm interested in: ${b.dataset.choose}.`;
    contactTab("message");
  }));

  /* ---------- Contact tabs ---------- */
  function contactTab(name) {
    const book = name === "book";
    $("#tabBook")?.setAttribute("aria-selected", book);
    $("#tabMsg")?.setAttribute("aria-selected", !book);
    if ($("#bookPanel")) $("#bookPanel").hidden = !book;
    if ($("#msgPanel")) $("#msgPanel").hidden = book;
  }
  $("#tabBook")?.addEventListener("click", () => contactTab("book"));
  $("#tabMsg")?.addEventListener("click", () => contactTab("message"));
  $$('a[href="#contact"]').forEach((a) => a.addEventListener("click", () => { if (!a.hasAttribute("data-choose")) contactTab("book"); }));

  /* ---------- Booking calendar (requests are sent through /api/contact.php, then confirmed by hand) ---------- */
  const bookForm = $("#bookForm");
  if (bookForm) {
    const SLOTS = {
      video: ["9:00", "9:30", "10:00", "10:30", "11:00", "11:30", "12:00", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
        "16:00", "16:30", "17:00", "17:30", "18:00", "18:30"],   // hours: Mon–Sat, 9am–7pm Sydney (data/contact.json)
      person: ["10:00", "11:30", "14:00", "15:30", "17:00"],
    };
    const DAYS_AHEAD = 60, LEAD_MINUTES = 180;       // bookable up to 60 days out, at least 3 hours ahead
    const syd = Object.fromEntries(new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" })
      .formatToParts(new Date()).map((p) => [p.type, +p.value]));
    const today = Date.UTC(syd.year, syd.month - 1, syd.day), nowMin = syd.hour * 60 + syd.minute, DAY = 864e5;
    const toMin = (t) => { const [h, m] = t.split(":"); return h * 60 + +m; };
    const label12 = (t) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`; };
    const dayLabel = (d) => new Date(d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
    const mtype = () => $('input[name="mtype"]:checked', bookForm).value;
    const slotsFor = (d) => {
      const wd = new Date(d).getUTCDay();
      if (wd === 0 || d < today || d > today + DAYS_AHEAD * DAY) return [];
      return SLOTS[mtype()].filter((t) => d > today || toMin(t) >= nowMin + LEAD_MINUTES);
    };
    let view = { y: syd.year, m: syd.month - 1 }, picked = { day: null, time: null };

    function drawCal() {
      const first = Date.UTC(view.y, view.m, 1), days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
      $("#calTitle").textContent = new Date(first).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" });
      const lead = (new Date(first).getUTCDay() + 6) % 7;
      let html = "<span></span>".repeat(lead);
      for (let i = 0; i < days; i++) {
        const d = first + i * DAY, ok = slotsFor(d).length > 0;
        html += `<button type="button" class="cal__day${d === picked.day ? " is-picked" : ""}${d === today ? " is-today" : ""}" data-day="${d}"${ok ? "" : " disabled"} aria-label="${dayLabel(d)}">${i + 1}</button>`;
      }
      $("#calGrid").innerHTML = html;
      $('.cal__nav[data-month="-1"]').disabled = view.y === syd.year && view.m === syd.month - 1;
      $('.cal__nav[data-month="1"]').disabled = Date.UTC(view.y, view.m + 1, 1) > today + DAYS_AHEAD * DAY;
    }
    function drawSlots() {
      const list = picked.day ? slotsFor(picked.day) : [];
      if (!list.includes(picked.time)) picked.time = null;
      $("#slotsWrap").hidden = !picked.day;
      $("#slotsDay").textContent = picked.day ? `on ${dayLabel(picked.day)}` : "";
      $("#slots").innerHTML = list.map((t) => `<button type="button" class="slot${t === picked.time ? " is-picked" : ""}" data-time="${t}">${label12(t)}</button>`).join("");
      $("#bkPick").textContent = picked.time ? `${mtype() === "video" ? "Video call" : "In-person meeting"}: ${dayLabel(picked.day)}, ${label12(picked.time)} Sydney time` : "Pick a day and time above.";
      $("#bkPick").classList.toggle("is-set", !!picked.time);
    }

    $("#calGrid").addEventListener("click", (e) => {
      const b = e.target.closest(".cal__day"); if (!b) return;
      picked.day = +b.dataset.day; drawCal(); drawSlots();
    });
    $("#slots").addEventListener("click", (e) => {
      const b = e.target.closest(".slot"); if (!b) return;
      picked.time = b.dataset.time; drawSlots();
    });
    $$(".cal__nav", bookForm).forEach((b) => b.addEventListener("click", () => {
      const d = new Date(Date.UTC(view.y, view.m + +b.dataset.month, 1));
      view = { y: d.getUTCFullYear(), m: d.getUTCMonth() }; drawCal();
    }));
    $$('input[name="mtype"]', bookForm).forEach((r) => r.addEventListener("change", () => {
      $("#suburbField").hidden = mtype() !== "person";
      if (picked.day && !slotsFor(picked.day).length) picked.day = null;
      drawCal(); drawSlots();
    }));
    // open on the month of the first bookable day; if that's in the last 3 days of a month, show the next month
    for (let d = today; d <= today + DAYS_AHEAD * DAY; d += DAY) {
      if (!slotsFor(d).length) continue;
      const f = new Date(d), nearEnd = Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0) - d < 3 * DAY;
      const v = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + (nearEnd ? 1 : 0), 1));
      view = { y: v.getUTCFullYear(), m: v.getUTCMonth() };
      break;
    }
    drawCal(); drawSlots();

    bookForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!picked.time) { $("#bkPick").classList.add("is-error"); setTimeout(() => $("#bkPick").classList.remove("is-error"), 600); $("#cal").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" }); return; }
      let ok = true;
      ["name", "email", ...(mtype() === "person" ? ["suburb"] : [])].forEach((n) => {
        const input = bookForm.elements[n];
        const valid = input.value.trim() && input.checkValidity();
        input.closest(".field").classList.toggle("is-invalid", !valid);
        if (!valid && ok) { input.focus(); ok = false; }
      });
      if (!ok) return;
      const fd = new FormData(bookForm), video = mtype() === "video";
      const when = `${dayLabel(picked.day)}, ${label12(picked.time)} (Sydney time)`;
      const mins = $("#cal").dataset[video ? "videoMinutes" : "personMinutes"];
      const body = [
        `${video ? `${mins}-minute video call` : `${mins}-minute in-person meeting`}: ${when}`,
        ...(video ? [] : [`Where: ${fd.get("suburb")}`]),
        "", `Name: ${fd.get("name")}`, `Business: ${fd.get("business") || "-"}`, `Email: ${fd.get("email")}`, `Phone: ${fd.get("phone") || "-"}`,
        "", fd.get("note") || "",
      ].join("\n");
      const how = await sendForm(bookForm, {
        kind: "book", name: fd.get("name"), email: fd.get("email"), title: `${video ? "Video call" : "In-person meeting"}, ${when}`,
        rows: [["Meeting", video ? `${mins}-minute video call` : `${mins}-minute in-person meeting`], ["When", when],
          ...(video ? [] : [["Where", fd.get("suburb")]]), ["Business", fd.get("business")], ["Phone", fd.get("phone")], ["About", fd.get("note")]],
      }, `${video ? "Call" : "Meeting"} request: ${when}`, body);
      if (!how) return;
      $("#bookName").textContent = String(fd.get("name")).split(" ")[0];
      $("#bookWhen").textContent = when;
      showDone($("#bookDone"), how);
      confetti(bookForm);
    });
    $$(".field input", bookForm).forEach((i) => i.addEventListener("input", () => i.closest(".field").classList.remove("is-invalid")));
  }

  /* ---------- Contact form ---------- */
  const form = $("#contactForm");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    let ok = true;
    ["name", "email"].forEach((n) => {
      const input = form.elements[n];
      const valid = input.value.trim() && input.checkValidity();
      input.closest(".field").classList.toggle("is-invalid", !valid);
      if (!valid && ok) { input.focus(); ok = false; }
    });
    if (!ok) return;

    const needs = fd.getAll("need").join(", ") || "Not specified";
    const body = [
      `Name: ${fd.get("name")}`,
      `Business: ${fd.get("business") || "-"}`,
      `Email: ${fd.get("email")}`,
      `Phone: ${fd.get("phone") || "-"}`,
      `Looking for: ${needs}`,
      "",
      fd.get("message") || "",
    ].join("\n");
    const subject = `New enquiry from ${fd.get("name")}${fd.get("business") ? " — " + fd.get("business") : ""}`;
    const how = await sendForm(form, {
      kind: "message", name: fd.get("name"), email: fd.get("email"),
      title: `${fd.get("name")}${fd.get("business") ? " — " + fd.get("business") : ""}`,
      rows: [["Business", fd.get("business")], ["Phone", fd.get("phone")], ["Looking for", needs], ["Message", fd.get("message")]],
    }, subject, body);
    if (!how) return;
    $("#doneName").textContent = String(fd.get("name")).split(" ")[0];
    showDone($("#formDone"), how);
    confetti(form);
  });
  if (form) $$(".field input", form).forEach((i) => i.addEventListener("input", () => i.closest(".field").classList.remove("is-invalid")));

  /* ---------- AI agents page: robot, live demo, browser mock ---------- */
  const bot = $("#bot");
  if (bot) {
    // eyes follow the cursor
    const eyes = $("#botEyes");
    if (!reduceMotion && matchMedia("(pointer: fine)").matches) {
      addEventListener("mousemove", (e) => {
        const r = bot.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * 0.36);
        const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 400);
        eyes.style.transform = `translate(${(dx / d) * 7 * k}px, ${(dy / d) * 6 * k}px)`;
      }, { passive: true });
    }
    // status bubbles pop in turn
    const bubbles = $$("[data-bot-bubble]", bot);
    let bi = 0;
    const nextBubble = () => { bubbles.forEach((b, i) => b.classList.toggle("is-on", i === bi % bubbles.length)); bi++; };
    nextBubble();
    if (!reduceMotion) setInterval(nextBubble, 2200);
  }

  const ademo = $("#ademo");
  if (ademo) {
    const log = $("#ademoLog"), chips = $("#ademoChips"), lines = $("#adocLines");
    const wait = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? 0 : ms));
    let run = 0;
    const say = (who, text) => {
      const el = document.createElement("div");
      el.className = `bubble bubble--${who}`; el.textContent = text; log.appendChild(el);
      while (log.scrollHeight > log.clientHeight && log.children.length > 2) log.firstChild.remove();
      return el;
    };
    // every step checks it still belongs to the latest run, so "Play again" mid-way can't mix two runs
    const ask = async (id, q, options, answer) => {
      if (id !== run) return;
      say("bot", q); await wait(600); if (id !== run) return;
      chips.innerHTML = options.map((o) => `<span>${o}</span>`).join("");
      await wait(900); if (id !== run) return;
      [...chips.children].find((c) => c.textContent === answer)?.classList.add("is-tap");
      await wait(350); if (id !== run) return;
      chips.innerHTML = ""; say("user", answer); await wait(500);
    };
    async function play() {
      const id = ++run;
      log.innerHTML = ""; chips.innerHTML = ""; lines.innerHTML = "";
      $("#adocMeta").textContent = "…"; $("#adocTotal").textContent = "$0";
      $("#adocStamp").classList.remove("is-on"); $("#adocToast").classList.remove("is-on"); ademo.classList.remove("is-thinking");
      await ask(id, "Hi! I can quote your end-of-lease clean in 30 seconds. How many bedrooms?", ["1", "2", "3", "4+"], "3");
      await ask(id, "And bathrooms?", ["1", "2", "3"], "2");
      await ask(id, "Any extras?", ["Oven", "Windows", "Carpets", "No extras"], "Oven");
      if (id !== run) return;
      const think = say("bot", ""); think.classList.add("bubble--typing"); think.innerHTML = "<i></i><i></i><i></i>";
      ademo.classList.add("is-thinking");
      $("#adocMeta").textContent = "3 bedrooms, 2 bathrooms";
      const items = [["End-of-lease clean, 3 bed", 420], ["Second bathroom", 60], ["Oven & rangehood", 80], ["Bond-back re-clean guarantee", 0]];
      let total = 0;
      for (const [n, v] of items) {
        await wait(550); if (id !== run) return;
        const li = document.createElement("li"); li.innerHTML = `<span>${n}</span><b>${v ? "$" + v : "Included"}</b>`; lines.appendChild(li);
        total += v; $("#adocTotal").textContent = "$" + total;
      }
      await wait(400); if (id !== run) return;
      ademo.classList.remove("is-thinking"); think.remove();
      $("#adocStamp").classList.add("is-on");
      await wait(500); if (id !== run) return;
      say("bot", "Your quote is ready: $" + total + ". I've emailed you the PDF, and the team will confirm your date.");
      await wait(700); if (id === run) $("#adocToast").classList.add("is-on");
    }
    const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { play(); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(ademo);
    $("#ademoReplay").addEventListener("click", play);
  }

  // industry tabs: "something goes in, something useful comes out"
  $$(".agen__tab").forEach((tab) => tab.addEventListener("click", () => {
    $$(".agen__tab").forEach((t) => t.setAttribute("aria-selected", t === tab));
    $$(".agen__pane").forEach((p) => (p.hidden = p.dataset.panel !== tab.dataset.gen));
  }));

  const abrowser = $("#abrowser");
  if (abrowser) {
    const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { abrowser.classList.add("is-live"); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(abrowser);
    const names = ["WordPress", "Wix", "Squarespace", "Shopify", "any website"];
    let ni = 0;
    if (!reduceMotion) setInterval(() => {
      const el = $("#abPlatform"); ni = (ni + 1) % names.length;
      const clone = el.cloneNode(); clone.textContent = names[ni]; el.replaceWith(clone);   // re-triggers the swap animation
    }, 1800);
  }

  /* ---------- AI assistants page: live night-time chat ---------- */
  const aphone = $("#aphoneLog");
  if (aphone) {
    const talk = [
      ["11:42 pm", "Do you groom big dogs?", "Yes! A full groom for a large dog is $120 and takes about 2 hours. Want me to find a time?"],
      ["11:43 pm", "Is there parking?", "Yes, free street parking right out front."],
      ["11:44 pm", "Saturday morning?", "Saturday 9:00am is free. Booked ✓ You'll get a confirmation by SMS."],
    ];
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const add = (who, text) => {
      const el = document.createElement("div");
      el.className = `bubble bubble--${who}`; el.textContent = text; aphone.appendChild(el);
      while (aphone.children.length > 5) aphone.firstChild.remove();
      return el;
    };
    if (reduceMotion) talk.slice(0, 2).forEach(([, q, a]) => { add("user", q); add("bot", a); });
    else (async () => {
      for (let i = 0; ; i = (i + 1) % talk.length) {
        const [time, q, a] = talk[i];
        $("#anClock").textContent = time;
        if (i === 0) { aphone.innerHTML = ""; $("#anBadge").classList.remove("is-on"); }
        await wait(700); add("user", q);
        await wait(500); const t = add("bot", ""); t.classList.add("bubble--typing"); t.innerHTML = "<i></i><i></i><i></i>";
        await wait(1300); t.remove(); add("bot", a);
        $("#anBadge").classList.add("is-on");
        await wait(2600);
      }
    })();
  }

  /* ---------- Order form (/order/): one page, sections open on click, file uploads ---------- */
  const ord = $("#orderForm");
  if (ord) {
    const secs = $$(".osec", ord);
    const humanToken = humanCheck($("#ordVerify"));
    const DRAFT = "webumiOrder", MAX_FILES = 12, MAX_TOTAL = 20e6;
    const files = {};            // zone -> [{ name, type, data (base64), url (preview) }]
    let attached = "";
    const selectedTypes = () => $$('input[name="types"]:checked', ord).map((i) => i.value);
    const shown = (el) => !el.closest(".ord__group[hidden], .ord__cond[hidden]");
    const titleOf = (sec) => sec.querySelector(".osec__head b").textContent;
    const labelOf = (el) => {
      if (el.dataset.label) return el.dataset.label;
      const field = el.closest(".field");
      if (field) return field.querySelector("span").childNodes[0].textContent.trim();
      const chips = el.closest(".form__chips, .bld__grid");
      return (chips?.previousElementSibling?.classList.contains("ord__label") ? chips.previousElementSibling.childNodes[0].textContent : titleOf(el.closest(".osec"))).trim();
    };

    // ---- open / close sections ----
    const open = (sec, on = true) => { sec.classList.toggle("is-open", on); $(".osec__head", sec).setAttribute("aria-expanded", on); };
    secs.forEach((sec, i) => {
      $(".osec__head", sec).addEventListener("click", () => open(sec, !sec.classList.contains("is-open")));
      $(".ord__next", sec)?.addEventListener("click", () => {
        const next = secs[i + 1]; if (!next) return;
        open(next); next.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      });
    });

    // ---- show only the questions that apply ----
    function refresh() {
      const types = selectedTypes();
      $$(".ord__group", ord).forEach((g) => (g.hidden = !g.dataset.for.split(" ").some((t) => types.includes(t))));
      $("[data-none]", ord).hidden = types.length > 0;
      const logo = $('input[name="logo"]:checked', ord)?.value || "";
      $$(".ord__cond", ord).forEach((c) => (c.hidden = !c.dataset.ifLogo.split("|").includes(logo)));
      secs.forEach((sec) => {
        let n = 0;
        $$("input, textarea", sec).forEach((el) => {
          if (!shown(el) || el.type === "file" || !el.name) return;
          if (el.type === "checkbox" || el.type === "radio") n += el.checked ? 1 : 0; else if (el.value.trim()) n++;
        });
        $$("select[data-required]", sec).forEach((el) => (n += el.value ? 1 : 0));
        $$(".drop", sec).forEach((d) => shown(d) && (n += (files[d.dataset.zone] || []).length));
        sec.classList.toggle("is-done", n > 0);
        $(".osec__status", sec).textContent = n ? `✓ ${n} answered` : "Not started";
      });
    }

    // ---- file uploads: images are shrunk in the browser so phone photos send quickly ----
    const toBase64 = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.readAsDataURL(blob); });
    async function prepare(file) {
      const isImg = /^image\/(jpeg|png|webp|heic|heif)$/.test(file.type);
      if (isImg && file.size > 600e3 && "createImageBitmap" in window) {
        try {
          const bmp = await createImageBitmap(file), k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
          const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
          c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
          const type = file.type === "image/png" ? "image/webp" : "image/jpeg";    // webp keeps transparent logos transparent
          const blob = await new Promise((r) => c.toBlob(r, type, 0.85));
          if (blob && blob.size < file.size) return { name: file.name.replace(/\.\w+$/, type === "image/webp" ? ".webp" : ".jpg"), type, blob };
        } catch {}
      }
      return { name: file.name, type: file.type, blob: file };
    }
    const totalSize = () => Object.values(files).flat().reduce((s, f) => s + f.size, 0);
    function drawList(zone) {
      const list = $(`.drop[data-zone="${zone}"] .drop__list`, ord);
      list.innerHTML = "";
      (files[zone] || []).forEach((f, i) => {
        const li = document.createElement("li");
        li.innerHTML = f.type.startsWith("image/") ? `<img src="${f.url}" alt="">` : `<span class="drop__pdf">${/\.docx$/i.test(f.name) ? "DOC" : "PDF"}</span>`;
        const name = document.createElement("span"); name.textContent = f.name; li.append(name);
        const rm = document.createElement("button"); rm.type = "button"; rm.textContent = "×"; rm.setAttribute("aria-label", "Remove " + f.name);
        rm.addEventListener("click", (e) => { e.stopPropagation(); files[zone].splice(i, 1); drawList(zone); refresh(); });
        li.append(rm); list.append(li);
      });
    }
    async function addFiles(zone, list) {
      const err = $("#ordError");
      for (const file of list) {
        const docx = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || /\.docx$/i.test(file.name);
        if (!/^image\//.test(file.type) && file.type !== "application/pdf" && !docx) { err.textContent = `${file.name}: only images, PDFs and Word (.docx) files can be uploaded.`; err.hidden = false; continue; }
        if (Object.values(files).flat().length >= MAX_FILES) { err.textContent = `Up to ${MAX_FILES} files. For more, add a Google Drive or Dropbox link in the description.`; err.hidden = false; break; }
        const p = await prepare(file);
        if (p.blob.size > 8e6 || totalSize() + p.blob.size > MAX_TOTAL) { err.textContent = `${file.name} is too big. Please add a Google Drive or Dropbox link instead.`; err.hidden = false; continue; }
        (files[zone] ||= []).push({ name: p.name, type: p.type, size: p.blob.size, data: await toBase64(p.blob), url: URL.createObjectURL(p.blob) });
      }
      drawList(zone); refresh();
    }
    $$(".drop", ord).forEach((d) => {
      const input = $("input[type=file]", d), zone = d.dataset.zone;
      d.addEventListener("click", (e) => { if (!e.target.closest("button")) input.click(); });
      input.addEventListener("change", () => { addFiles(zone, [...input.files]); input.value = ""; });
      ["dragenter", "dragover"].forEach((t) => d.addEventListener(t, (e) => { e.preventDefault(); d.classList.add("is-over"); }));
      ["dragleave", "drop"].forEach((t) => d.addEventListener(t, () => d.classList.remove("is-over")));
      d.addEventListener("drop", (e) => { e.preventDefault(); addFiles(zone, [...e.dataTransfer.files]); });
    });

    // ---- everything entered, grouped by section (for the email) ----
    function summary() {
      return secs.map((sec) => {
        const rows = [], seen = {};
        $$("input, select, textarea", sec).forEach((el) => {
          if (!shown(el) || !el.name || el.type === "file") return;
          if (el.type === "checkbox" || el.type === "radio" || el.type === "color") {
            if (el.type !== "color" && !el.checked) return;
            const v = el.name === "types" ? el.closest(".opt").querySelector(".opt__t").textContent : el.type === "color" ? el.value.toUpperCase() : el.value, key = labelOf(el);
            if (seen[key] !== undefined) rows[seen[key]][1] += ", " + v; else { seen[key] = rows.length; rows.push([key, v]); }
          } else if (el.value.trim()) rows.push([labelOf(el), el.value.trim()]);
        });
        $$(".drop", sec).forEach((d) => {
          const list = files[d.dataset.zone] || [];
          if (shown(d) && list.length) rows.push([labelOf(d), list.map((f) => f.name).join(", ")]);
        });
        return { title: titleOf(sec), rows };
      }).concat([{ title: "Your details", rows: ["name", "email", "phone", "contactBy"].map((n) => [labelOf(ord.elements[n]), ord.elements[n].value.trim()]).filter((r) => r[1]) }])
        .filter((x) => x.rows.length);
    }

    // ---- colour palettes: live preview + your own colours ----
    const preview = $("#palPreview");
    const DEFAULTS = ["#0F2A3D", "#FF6B4A", "#FFD23F", "#F4E9D8", "#1FA592"];
    function paint() {
      const pick = $('input[name="palette"]:checked', ord);
      const own = $$('input[name="customColour"]', ord).map((i) => i.value);
      const cols = pick?.dataset.colours ? pick.dataset.colours.split(" ") : own.length ? own : null;
      preview.classList.toggle("is-on", !!cols);
      if (cols) ["--p1", "--p2", "--p3", "--p4"].forEach((v, i) => preview.style.setProperty(v, cols[i % cols.length]));
      $("#palName").textContent = pick?.dataset.colours ? pick.value.split(":")[0] : cols ? "Your colours" : pick ? pick.value : "Pick a palette to preview it";
    }
    function addColour(value) {
      const box = $("#palCustom");
      if ($$('input[name="customColour"]', box).length >= 5) return;
      const chip = document.createElement("span"); chip.className = "pal__chip";
      const input = document.createElement("input");
      Object.assign(input, { type: "color", name: "customColour", value: value || DEFAULTS[$$('input[name="customColour"]', box).length] });
      input.dataset.label = "Your own colours"; input.setAttribute("aria-label", "Colour");
      const rm = document.createElement("button"); rm.type = "button"; rm.textContent = "×"; rm.setAttribute("aria-label", "Remove colour");
      rm.addEventListener("click", () => { chip.remove(); paint(); saveDraft(); refresh(); });
      chip.append(input, rm);
      box.insertBefore(chip, $("#palAdd"));
      $("#palAdd").hidden = $$('input[name="customColour"]', box).length >= 5;
      paint();
    }
    $("#palAdd").addEventListener("click", () => { addColour(); saveDraft(); refresh(); });
    ord.addEventListener("input", (e) => { if (e.target.name === "palette" || e.target.name === "customColour") paint(); });
    ord.addEventListener("change", (e) => { if (e.target.name === "palette") paint(); });

    // ---- draft: keep typed answers if the page is refreshed (files can't be kept) ----
    const saveDraft = () => {
      const d = {};
      $$("input, select, textarea", ord).forEach((el) => {
        if (!el.name || el.name === "website" || el.name === "consent" || el.type === "file") return;
        if (el.type === "checkbox" || el.type === "radio") { if (el.checked) (d[el.name] ||= []).push(el.value); }
        else if (el.type === "color") (d[el.name] ||= []).push(el.value);
        else if (el.value) d[el.name] = el.value;
      });
      try { sessionStorage.setItem(DRAFT, JSON.stringify(d)); } catch {}
    };
    try {
      const d = JSON.parse(sessionStorage.getItem(DRAFT) || "{}");
      $$("input, select, textarea", ord).forEach((el) => {
        if (!(el.name in d) || el.type === "file") return;
        if (el.type === "checkbox" || el.type === "radio") el.checked = d[el.name].includes(el.value); else el.value = d[el.name];
      });
      (d.customColour || []).forEach((c) => addColour(c));
    } catch {}
    ord.addEventListener("input", () => { saveDraft(); refresh(); });
    ord.addEventListener("change", () => { saveDraft(); refresh(); });

    // ---- arriving with ?type=website, or from the planner / price builder ----
    const q = new URLSearchParams(location.search).get("type");
    if (q) { const box = $(`input[name="types"][value="${q.replace(/[^a-z]/g, "")}"]`, ord); if (box) box.checked = true; }
    try {
      const plan = JSON.parse(sessionStorage.getItem("webumiPlan") || "{}").offer;
      const est = sessionStorage.getItem("webumiEstimate");
      if (plan?.headline && window.WebumiOffer) {
        attached = `Website plan: ${plan.headline}\n${location.origin}${window.WebumiOffer.linkFor(plan)}`;
        $("#ordPlanLink").href = window.WebumiOffer.linkFor(plan);
        $("#ordPlan").hidden = false;
        const t = $(`input[name="types"][value="${plan.type === "landing" ? "landing" : "website"}"]`, ord); if (t && !selectedTypes().length) t.checked = true;
        if (!ord.elements.business.value && !/^your /i.test(plan.business_name)) ord.elements.business.value = plan.business_name;
      } else if (est) {
        attached = est;
        $("#ordPlan").hidden = false;
        $("#ordPlan span").textContent = "Your price builder estimate will be attached to this order.";
      }
    } catch {}
    refresh(); paint();

    // ---- check, then send ----
    function check() {
      let first = null;
      const bad = (el, sec) => { if (!first) first = { el, sec }; };
      const none = !selectedTypes().length;
      $('[data-err="types"]', ord).classList.toggle("is-on", none);
      if (none) bad($('input[name="types"]', ord), secs[0]);
      $$("[data-required]", ord).forEach((el) => {
        const off = !el.value.trim() || !el.checkValidity();
        el.closest(".field").classList.toggle("is-invalid", off);
        if (off) bad(el, el.closest(".osec"));
      });
      const c = !ord.elements.consent.checked;
      $('[data-err="consent"]', ord).classList.toggle("is-on", c);
      if (c) bad(ord.elements.consent, null);
      if (first) {
        if (first.sec) open(first.sec);
        first.el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        setTimeout(() => first.el.focus({ preventScroll: true }), 300);
      }
      return !first;
    }
    $$("[data-required]", ord).forEach((el) => el.addEventListener("input", () => el.closest(".field")?.classList.remove("is-invalid")));

    ord.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!check()) return;
      const btn = $("#ordSubmit"), err = $("#ordError");
      btn.disabled = true; btn.textContent = "Sending…"; err.hidden = true;
      const payload = {
        types: selectedTypes(), name: ord.elements.name.value.trim(), email: ord.elements.email.value.trim(),
        business: ord.elements.business.value.trim(), consent: true, summary: summary(), plan: attached,
        website: ord.elements.website.value,
        files: Object.entries(files).flatMap(([zone, list]) => list.map((f) => ({ zone, name: f.name, type: f.type, data: f.data }))),
      };
      try {
        let data;
        for (let attempt = 0; attempt < 2; attempt++) {
          payload.turnstile = await humanToken();
          const r = await fetch("/api/order.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          data = await r.json().catch(() => ({ error: r.status === 413 ? "The files are too big. Please remove some, or add a Google Drive link." : "Something went wrong. Please try again in a moment." }));
          if (data.code !== "verify") break;
        }
        if (!data.ok) throw new Error(data.error || "Something went wrong.");
        try { sessionStorage.removeItem(DRAFT); sessionStorage.removeItem("webumiEstimate"); } catch {}
        $("#ordRef").textContent = data.ref;
        $("#ordEmail").textContent = payload.email;
        [...secs, $(".ord__contact", ord), $("#ordPlan")].forEach((el) => (el.hidden = true));
        $("#ordDone").hidden = false;
        ord.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
        confetti(ord);
      } catch (x) {
        const to = $("#ctEmail")?.textContent || "hello@webumi.com.au";
        err.innerHTML = "";
        err.append(`${x instanceof TypeError ? "Can't reach the server. Check your internet connection." : x.message} You can also email your order to `);
        const a = document.createElement("a"); a.href = `mailto:${to}?subject=${encodeURIComponent("Order request")}`; a.textContent = to; err.append(a, ".");
        err.hidden = false;
      }
      btn.disabled = false; btn.textContent = "Send order →";
    });
  }

  /* ---------- Non-profit application form ---------- */
  const npForm = $("#npForm");
  npForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    let ok = true;
    ["org", "name", "email", "about"].forEach((n) => {
      const input = npForm.elements[n];
      const valid = input.value.trim() && input.checkValidity();
      input.closest(".field").classList.toggle("is-invalid", !valid);
      if (!valid && ok) { input.focus(); ok = false; }
    });
    if (!ok) return;
    const fd = new FormData(npForm);
    const body = [
      `Organisation: ${fd.get("org")}`,
      `Contact: ${fd.get("name")}`,
      `Email: ${fd.get("email")}`,
      `Phone: ${fd.get("phone") || "-"}`,
      `Website / social: ${fd.get("site") || "-"}`,
      `ABN / ACNC: ${fd.get("abn") || "-"}`,
      `Would help: ${fd.getAll("need").join(", ") || "Not specified"}`,
      "", fd.get("about"),
    ].join("\n");
    const how = await sendForm(npForm, {
      kind: "nonprofit", name: fd.get("name"), email: fd.get("email"), title: fd.get("org"),
      rows: [["Organisation", fd.get("org")], ["Phone", fd.get("phone")], ["Website / social", fd.get("site")], ["ABN / ACNC", fd.get("abn")],
        ["Would help", fd.getAll("need").join(", ") || "Not specified"], ["About", fd.get("about")]],
    }, `Non-profit application: ${fd.get("org")}`, body);
    if (!how) return;
    $("#npName").textContent = String(fd.get("name")).split(" ")[0];
    showDone($("#npDone"), how);
    confetti(npForm);
  });
  if (npForm) $$(".field input, .field textarea", npForm).forEach((i) => i.addEventListener("input", () => i.closest(".field").classList.remove("is-invalid")));

  /* Small forms (booking, message, non-profit): send through /api/contact.php, which emails us and the visitor.
     If that fails (offline, server down, too many tries), fall back to the visitor's email app with everything
     filled in, so nothing is lost. Returns "sent", "mailto", or "" while a send is already running. */
  async function sendForm(f, data, subject, body) {
    const btn = $('button[type="submit"]', f);
    if (btn.disabled) return "";
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "Sending…";
    try {
      const turnstile = await humanFor(f)();
      const r = await fetch("/api/contact.php", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, website: f.elements.website?.value || "", turnstile }),
      });
      if (!r.ok) throw new Error(r.status);
      return "sent";
    } catch {
      const to = $("#ctEmail")?.textContent || "hello@webumi.com.au";
      location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      return "mailto";
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  }
  /* The human check for a small form. Cloudflare's script is loaded the first time someone starts
     filling in one of these forms, not on every page view. */
  function humanFor(f) {
    if (!f.human) {
      if (!window.turnstile && !$('script[src*="challenges.cloudflare.com/turnstile"]')) {
        const s = document.createElement("script");
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; s.async = true;
        document.head.append(s);
      }
      f.human = humanCheck($("[data-human]", f));
    }
    return f.human;
  }
  $$("#bookForm, #contactForm, #npForm").forEach((f) => f.addEventListener("focusin", () => humanFor(f), { once: true }));

  function showDone(box, how) {
    $("[data-sent]", box).hidden = how !== "sent";
    $("[data-mailto]", box).hidden = how !== "mailto";
    box.hidden = false;
  }

  function confetti(from, count = 80) {
    if (reduceMotion) return;
    const colors = ["#ff6b4a", "#ffc857", "#1fa592", "#0f2a3d", "#ffffff"];
    const rect = from.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const c = document.createElement("span");
      c.className = "confetti";
      c.style.background = colors[i % colors.length];
      document.body.appendChild(c);
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 3;
      const angle = Math.random() * Math.PI * 2, v = 200 + Math.random() * 380;
      c.animate([
        { transform: `translate(${x}px, ${y}px) rotate(0)`, opacity: 1 },
        { transform: `translate(${x + Math.cos(angle) * v}px, ${y + Math.sin(angle) * v + 420}px) rotate(${Math.random() * 900}deg)`, opacity: 0 },
      ], { duration: 1400 + Math.random() * 900, easing: "cubic-bezier(.2,.7,.4,1)" }).onfinish = () => c.remove();
    }
  }

  /* 404: the bear walks in once, then stays. Apple browsers get HEVC (their only see-through video),
     everyone else VP9 WebM; phones get the 960px version. Reduced motion, or autoplay blocked
     (iPhone Low Power Mode): straight to the last frame. */
  const bear = $(".nf__bear");
  if (bear) {
    const ua = navigator.userAgent;
    const apple = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ||
      (/Safari\//.test(ua) && !/Chrom|Edg|Firefox|OPR/.test(ua));
    const small = bear.getBoundingClientRect().width < 900;
    bear.src = `/video/bear-404${small ? "-960" : ""}.${apple ? "mp4" : "webm"}`;
    const rest = () => {
      const end = () => { bear.currentTime = Math.max(0, bear.duration - 0.05); };
      bear.readyState ? end() : bear.addEventListener("loadedmetadata", end, { once: true });
    };
    if (reduceMotion) rest();
    else bear.play().catch(rest);
  }

  /* Pricing header: the sparkle falls, the bear catches it and walks on the spot holding it, for good.
     Two videos (tools/make-catch-video.sh): the catch plays once, then the short walk clip loops natively
     (no seeking, so no stall). The walk starts on the frame that follows the catch's last one; the swap
     happens when the walk is actually playing, and the catch is hidden then (both are see-through).
     Hover or tap replays the catch. Paused off screen. Hidden (and never loaded) on narrow screens;
     reduced motion shows the bear standing with the sparkle. Same format choice as the 404 bear. */
  const catcher = $(".catch__bear");
  if (catcher && reduceMotion) catcher.poster = catcher.dataset.still;
  const wide = matchMedia("(min-width: 1101px)");   // .catch is hidden below this (styles.css)
  const startCatch = () => {
    if (!wide.matches || catcher.src) return;   // set up once, the first time the screen is wide enough
    const box = catcher.parentElement, walk = $(".catch__walk", box);
    const ua = navigator.userAgent;
    const apple = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ||
      (/Safari\//.test(ua) && !/Chrom|Edg|Firefox|OPR/.test(ua));
    const ext = apple ? "mp4" : "webm";
    catcher.src = catcher.dataset[ext];   // fingerprinted file names (build.js {{v:…}}): a re-made video is fetched at once
    walk.src = walk.dataset[ext];
    walk.preload = "auto";
    const walking = () => box.classList.contains("is-walking");
    const go = (v) => v.play().catch(() => { catcher.poster = catcher.dataset.still; });   // autoplay blocked: a still
    let handed = false;
    const toWalk = () => { if (handed) return; handed = true; walk.currentTime = 0; go(walk); };
    const nearEnd = (t) => t >= catcher.duration - 0.06;   // the last frame is on screen
    const watch = (now, m) => (nearEnd(m.mediaTime) ? toWalk() : catcher.requestVideoFrameCallback(watch));
    catcher.addEventListener("play", () => {
      handed = false;
      if ("requestVideoFrameCallback" in catcher) catcher.requestVideoFrameCallback(watch);
    });
    catcher.addEventListener("timeupdate", () => nearEnd(catcher.currentTime) && toWalk());   // browsers without rVFC
    catcher.addEventListener("ended", toWalk);
    walk.addEventListener("playing", () => { if (handed) { box.classList.add("is-walking"); catcher.pause(); } });
    const replay = () => {
      if (!walking()) return;
      box.classList.remove("is-walking"); walk.pause();
      catcher.currentTime = 0; go(catcher);
    };
    box.addEventListener("pointerenter", replay);
    box.addEventListener("click", replay);
    new IntersectionObserver(([e]) => {
      const v = walking() ? walk : catcher;
      if (!e.isIntersecting) v.pause();
      else if (walking() || !handed) go(v);
    }).observe(box);
  };
  if (catcher && !reduceMotion) { startCatch(); wide.addEventListener("change", startCatch); }

  /* ---------- Home hero: the bear's spell ----------
     The video plays the walk-in (frames 0–59), then waits holding the star. From there on the cursor
     drives it: the closer to the bear, the further the spell goes, frame by frame; moving away undoes
     it. A click finishes it. Touch screens have no cursor: the spell just plays, a tap replays it.
     The pills are page elements: each flips when the video reaches the frame where the star hits it.
     Around it: the bear asks for the cursor (speech bubble, with a nudge if nobody moves), the label
     counts the fixes ("Fixing… 2 of 6"), and the finish gets a small burst. */
  const spell = $("#spell");
  if (spell) {
    const video = $(".spell__video", spell), bubble = $("#spellBubble"), label = $("#spellLabel");
    const FPS = 24, T_READY = 59 / FPS, T_END = 144 / FPS;
    const pills = $$(".spell__list li", spell), FLIP = [94, 97, 103, 111, 117, 123].map((f) => f / FPS);   // in step with the star; the last two after the video's own four
    const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const small = video.offsetWidth <= 440 || video.offsetWidth * (devicePixelRatio || 1) <= 640;   // phones always get the light file
    const ASK = canHover ? "Bring your cursor here" : "Tap me";
    const KEEP = "Click me to keep it";
    let state = "loading";                 // loading → walk → ready (cursor scrubs) → casting → done
    let prox = 0, shown = T_READY, seeking = false, seekAt = 0, last = 0, readyAt = 0, nudges = 0, celebrated = false;
    let onScreen = true, held = null;      // held: the play() waiting for the hero to come back on screen

    const say = (html) => {
      bubble.hidden = !html;
      if (html && bubble.innerHTML !== html) bubble.innerHTML = html;
    };
    const nudge = (el) => { el.classList.remove("is-nudge"); void el.offsetWidth; el.classList.add("is-nudge"); };
    const paint = (t) => {
      let n = 0;
      pills.forEach((li, k) => { const on = t >= FLIP[k]; li.classList.toggle("is-fixed", on); n += on; });
      const text = n === pills.length ? "Your business in 2–4 weeks" : n ? `Fixing… ${n} of ${pills.length}` : "Your business today";
      if (label.textContent !== text) label.textContent = text;
    };
    const finish = () => {
      state = "done"; video.pause(); spell.classList.add("is-done"); paint(T_END); say("");
      if (!celebrated) {                    // the payoff, once per visit
        celebrated = true;
        confetti($(".spell__list", spell), 26);
        nudge($(".hero__ctas .btn--primary"));
      }
    };
    // plays only while the hero is on screen: a phone refresh lands where the page was scrolled to,
    // and the bear would do its whole spell out of sight
    const play = (fail) => {
      if (!onScreen) { held = fail; return; }
      video.play().then(loop).catch(fail);
    };
    // autoplay blocked (iPhone Low Power Mode): the bear waits holding the star, a tap starts it
    const blocked = () => {
      video.currentTime = shown = T_READY;
      state = "ready"; readyAt = performance.now(); say(ASK); loop();
    };
    const cast = () => { state = "casting"; spell.classList.remove("is-done"); say(""); play(finish); };
    const restart = () => {
      spell.classList.remove("is-done");
      if (canHover) { state = "ready"; shown = video.currentTime; readyAt = performance.now(); say(ASK); loop(); }
      else { video.currentTime = T_READY; cast(); }
    };
    video.addEventListener("ended", finish);
    video.addEventListener("seeked", () => { seeking = false; });
    spell.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;    // the bubble's link
      if (state === "ready") cast();
      else if (state === "done") restart();
    });

    // only work while the hero is on screen
    new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (onScreen) {
        if (held) { const fail = held; held = null; play(fail); }
        loop();
      } else if ((state === "walk" || state === "casting") && !video.paused) {
        video.pause(); held = state === "walk" ? blocked : finish;
      }
    }).observe(spell);

    // cursor → proximity to the bear
    addEventListener("mousemove", (e) => {
      if (!onScreen) return;
      const r = video.getBoundingClientRect();
      const d = Math.hypot(e.clientX - (r.left + r.width * 0.55), e.clientY - (r.top + r.height * 0.5));
      prox = Math.min(1, Math.max(0, 1 - d / Math.max(420, r.width * 1.3)));
    }, { passive: true });
    document.addEventListener("mouseout", (e) => { if (!e.relatedTarget) prox = 0; });   // the cursor left the window

    let looping = false;                   // one animation loop at a time
    const loop = () => { if (!looping) { looping = true; requestAnimationFrame(tick); } };
    const tick = (now = performance.now()) => {
      looping = false;
      const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
      if (state === "walk" && video.currentTime >= T_READY - 0.03) {
        video.pause(); shown = video.currentTime;
        if (canHover) { state = "ready"; readyAt = now; say(ASK); }
        else return setTimeout(cast, 600);
      }
      if (state === "ready") {
        const eased = prox * prox * (3 - 2 * prox);
        shown += (T_READY + eased * (T_END - T_READY) - shown) * Math.min(1, dt * 7);
        if (seeking && now - seekAt > 400) seeking = false;          // a lost "seeked" event
        if (!seeking && Math.abs(video.currentTime - shown) > 0.5 / FPS) { seeking = true; seekAt = now; video.currentTime = shown; }
        say(prox > 0.25 ? KEEP : ASK);
        if (prox < 0.08 && nudges < 3 && now - readyAt > 3500 + nudges * 5000) { nudges++; nudge(bubble); }
        paint(shown);
      }
      if (state === "casting") paint(video.currentTime);
      if ((state === "walk" || state === "casting" || state === "ready") && onScreen) loop();
    };

    // load the whole file first (seeking then never waits on the network), after the page itself
    const start = async () => {
      const url = `/video/hero-bear${small ? "-small" : ""}.mp4`;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.status);
        video.src = URL.createObjectURL(await res.blob());
      } catch { video.src = url; }
      const loaded = await new Promise((ok) => {
        video.addEventListener("loadeddata", () => ok(true), { once: true });
        video.addEventListener("error", () => ok(false), { once: true });
        video.preload = "auto"; video.load();   // iPhone Safari buffers nothing until told to, so "loadeddata" never came
      });
      if (!loaded) { celebrated = true; return finish(); }   // no video: still show the fixed list and the link
      if (reduceMotion) { video.currentTime = T_END; celebrated = true; return finish(); }
      state = "walk";
      play(blocked);
    };
    document.readyState === "complete" ? start() : addEventListener("load", start, { once: true });
  }

  /* Projects: stacking cards. While the stack scrolls past, each earlier card shrinks a little
     (to 1 - 0.03 per card above it) as the ones after it slide over. If a card is too tall to stick
     inside the screen, the stack stays a plain list. */
  const stack = $("[data-stack]");
  if (stack) {
    const cards = $$(".proj", stack), n = cards.length;
    let ticking = false;
    const update = () => {
      ticking = false;
      if (stack.classList.contains("is-flat") || getComputedStyle(cards[0].parentElement).position !== "sticky") {
        cards.forEach((c) => { c.style.transform = ""; });
        return;
      }
      const r = stack.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));   // 0 → 1 over the whole stack
      cards.forEach((c, i) => {
        const start = i / n, target = 1 - (n - 1 - i) * 0.03;
        const t = Math.min(1, Math.max(0, (p - start) / (1 - start)));
        c.style.transform = reduceMotion || t === 0 ? "" : `scale(${1 - t * (1 - target)})`;
      });
    };
    const fit = () => {
      stack.classList.remove("is-flat");
      const tooTall = cards.some((c) => c.offsetHeight > innerHeight - parseFloat(getComputedStyle(c.parentElement).top) - 16);
      stack.classList.toggle("is-flat", tooTall);
      update();
    };
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener("resize", fit);
    addEventListener("load", fit, { once: true });
    document.fonts?.ready.then(fit);
    fit();

    // phones and tablets: the stack is a swipe carousel; dots above it show (and jump to) the current project
    const dots = document.createElement("div");
    dots.className = "stack__dots";
    dots.setAttribute("role", "group");
    dots.setAttribute("aria-label", "Projects");
    cards.forEach((c, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", `Project ${i + 1}: ${$("h2", c).textContent}`);
      b.addEventListener("click", () => {          // scroll only the carousel sideways (scrollIntoView would also move the page)
        const pad = parseFloat(getComputedStyle(stack).paddingLeft) || 0;
        const left = stack.scrollLeft + c.parentElement.getBoundingClientRect().left - stack.getBoundingClientRect().left - pad;
        stack.scrollTo({ left, behavior: reduceMotion ? "auto" : "smooth" });
      });
      dots.appendChild(b);
    });
    stack.before(dots);   // above the cards: they are tall on phones, so dots below would be out of sight
    const markDot = () => {
      const items = cards.map((c) => c.parentElement);
      const step = items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : 1;
      const at = Math.max(0, Math.min(n - 1, Math.round(stack.scrollLeft / step)));
      [...dots.children].forEach((d, i) => d.setAttribute("aria-current", i === at));
    };
    let dotTick = false;
    stack.addEventListener("scroll", () => { if (!dotTick) { dotTick = true; requestAnimationFrame(() => { dotTick = false; markDot(); }); } }, { passive: true });
    markDot();
  }

  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
})();
