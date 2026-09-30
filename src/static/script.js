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

  /* ---------- Hero phone demo ---------- */
  const scenarios = {
    trade: {
      query: "emergency plumber bondi",
      notes: [
        ["ink", "search", "Google", "You showed up #2 in Bondi", "“Emergency plumber bondi” · 14 views today"],
        ["coral", "envelope", "New quote request", "Burst pipe — Jake, Bondi Beach", "Photo attached · wants today if possible"],
        ["sea", "bolt", "Auto-reply sent", "“Thanks Jake, we'll call in 10 min”", "Sent instantly, while you were on the tools"],
        ["sun", "card", "Invoice paid", "$420.00 received", "Paid by card from the job link"],
        ["sea", "star", "New 5-star review", "“Turned up in 40 min. Legend.”", "Review request sent automatically"],
      ],
    },
    beauty: {
      query: "gel nails near me",
      notes: [
        ["coral", "calendar", "New booking", "Mia · Gel extensions", "Thu 2:30pm · booked at 11:48pm"],
        ["sun", "card", "Deposit paid", "$30.00 deposit received", "Fewer no-shows"],
        ["sea", "chat", "Reminder sent", "“See you tomorrow at 2:30, Mia!”", "SMS sent automatically"],
        ["ink", "repeat", "Rebooked", "Mia booked her fill in 3 weeks", "From the “Book again” email"],
        ["sea", "star", "New 5-star review", "“Obsessed with my nails 😍”", "Asked 2 hours after her visit"],
      ],
    },
    pets: {
      query: "mobile dog grooming manly",
      notes: [
        ["ink", "search", "Google", "New visitor from Manly", "Landed on your Manly suburb page"],
        ["coral", "calendar", "New booking", "Biscuit the cavoodle 🐶", "Full groom · Sat 9:00am · 42 Pine St"],
        ["sun", "card", "Deposit paid", "$25.00 deposit received", "Card saved for the balance"],
        ["sea", "pin", "Route ready", "Saturday: 5 dogs, 3 suburbs", "Added to your calendar automatically"],
        ["sea", "star", "New 5-star review", "“Biscuit came back fluffy & happy”", "Review request sent automatically"],
      ],
    },
    clean: {
      query: "end of lease cleaning parramatta",
      notes: [
        ["coral", "envelope", "New quote request", "3-bed end of lease · Parramatta", "Priya · needs it before the 14th"],
        ["sea", "bolt", "Instant estimate sent", "“From $480 — book your date here”", "Priced from your own rate card"],
        ["ink", "calendar", "Job booked", "Fri 8:00am · 3-bed unit", "Added to your team's calendar"],
        ["sun", "card", "Paid in full", "$520.00 received", "Invoice synced to Xero"],
        ["sea", "star", "New 5-star review", "“Got my full bond back!”", "Review request sent automatically"],
      ],
    },
    coach: {
      query: "maths tutor year 10 brisbane",
      notes: [
        ["ink", "search", "Website visit", "Parent viewing “Year 10 Maths”", "From Google · 2 min on page"],
        ["coral", "calendar", "Free intro call booked", "Tom's mum · Wed 4:00pm", "Booked straight from your site"],
        ["sea", "envelope", "Follow-up sent", "“Here's what Tom's plan looks like”", "Sent automatically after the call"],
        ["sun", "card", "Term package paid", "$640.00 · 8 sessions", "Paid online by card"],
        ["sea", "chart", "This week", "6 new enquiries · 4 booked", "Your whole pipeline, in one place"],
      ],
    },
  };

  const feed = $("#feed");
  const queryEl = $("#searchQuery");
  const clockEl = $("#clock");
  let run = 0;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function noteEl([tone, icon, app, title, text], mins) {
    const el = document.createElement("div");
    el.className = "note";
    el.innerHTML = `
      <div class="note__icon note__icon--${tone}">${ic(icon)}</div>
      <div class="note__body">
        <div class="note__app"><span>${app}</span><span>${mins === 0 ? "now" : mins + "m ago"}</span></div>
        <div class="note__title">${title}</div>
        <div class="note__text">${text}</div>
      </div>`;
    return el;
  }

  async function playScenario(key) {
    const id = ++run;
    const s = scenarios[key];
    feed.innerHTML = "";
    queryEl.textContent = "";

    if (reduceMotion) {
      queryEl.textContent = s.query;
      s.notes.slice(0, 4).forEach((n) => feed.appendChild(noteEl(n, 0)));
      return;
    }

    for (const ch of s.query) {
      if (id !== run) return;
      queryEl.textContent += ch;
      await sleep(45 + Math.random() * 50);
    }
    await sleep(500);

    let t = 41;
    while (id === run) {
      for (const n of s.notes) {
        if (id !== run) return;
        t += 3 + Math.floor(Math.random() * 7);
        clockEl.textContent = `${9 + Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
        feed.prepend(noteEl(n, 0));
        const all = $$(".note", feed);
        all.slice(1).forEach((el, i) => { el.querySelector(".note__app span:last-child").textContent = `${(i + 1) * 4}m ago`; });
        if (all.length > 4) {
          const last = all[all.length - 1];
          last.classList.add("is-leaving");
          setTimeout(() => last.remove(), 350);
        }
        await sleep(2100);
      }
      if (t > 180) t = 41;
    }
  }

  $$(".industry .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      $$(".industry .chip").forEach((c) => { c.classList.remove("is-active"); c.setAttribute("aria-selected", "false"); });
      chip.classList.add("is-active");
      chip.setAttribute("aria-selected", "true");
      playScenario(chip.dataset.industry);
    });
  });

  // Only start the animation once the phone is on screen (saves battery, feels intentional)
  const phoneIO = new IntersectionObserver((e) => {
    if (e[0].isIntersecting) { playScenario("trade"); phoneIO.disconnect(); }
  });
  if ($(".phone")) phoneIO.observe($(".phone"));

  /* ---------- Pain points ---------- */
  const pains = $$(".pain");
  const painCount = $("#painCount");
  const painCountWrap = $(".pains__count");
  const painMsg = $("#painMsg");
  const painCta = $("#painCta");
  const msgs = [
    "Tap any that apply.",
    "One problem. Usually a quick, low-cost fix.",
    "Two problems. Both can be solved in one project.",
    "Three. These are the most common problems I see.",
    "Four. A lot of this work can run automatically.",
    "Five. The right setup can save you hours every week.",
    "Six. You need one connected system, not more apps.",
    "Seven. Let's talk. A free chat will show where to start.",
    "Eight. There's a lot of time to win back here.",
    "All nine. This is exactly the kind of business I help.",
  ];
  pains.forEach((p) => p.addEventListener("click", () => {
    p.setAttribute("aria-pressed", p.getAttribute("aria-pressed") !== "true");
    const n = pains.filter((x) => x.getAttribute("aria-pressed") === "true").length;
    painCount.textContent = n;
    painMsg.textContent = msgs[n];
    painCta.hidden = n === 0;
    painCountWrap.classList.remove("bump");
    void painCountWrap.offsetWidth;
    painCountWrap.classList.add("bump");
  }));

  /* ---------- Solutions chooser ---------- */
  const goals = {
    customers: {
      more: ["/websites/", "More about websites →"],
      title: "Get found on Google, turn visitors into enquiries.",
      desc: "Many small business websites look fine but don't bring in work. I build yours around one goal: more enquiries.",
      list: [
        "A fast, mobile-first website that says what you do in 5 seconds",
        "Service + suburb pages so you show up where people search",
        "Google Business Profile polished, with reviews front and centre",
        "One-tap call, quote form and instant auto-reply",
      ],
      pkg: ["Business website — from $2,490", "website"],
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
      desc: "No more back-and-forth messages. Customers pick a time, pay a deposit and get a reminder.",
      list: [
        "Booking built into your site, using Square, Fresha or Calendly",
        "Deposits that make no-shows basically disappear",
        "Automatic confirmations and SMS reminders",
        "Review requests and “book again” nudges after every visit",
      ],
      pkg: ["Business website with online booking — from $2,490", "website"],
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
  $$(".choose__btn").forEach((b) => b.addEventListener("click", () => {
    $$(".choose__btn").forEach((x) => { x.classList.remove("is-active"); x.setAttribute("aria-selected", "false"); });
    b.classList.add("is-active");
    b.setAttribute("aria-selected", "true");
    showGoal(b.dataset.goal);
  }));
  if (panel) showGoal("customers");

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
      $("#bldQuote").textContent = `+ ${quotes.join(" and ")}: priced after a free chat.`;
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

    bld.addEventListener("submit", (e) => {
      e.preventDefault();
      const need = typeOf() === "landing" ? "Landing page" : "Business website";
      const box = $(`input[name="need"][value="${need}"]`);
      if (box) box.checked = true;
      const msg = $('textarea[name="message"]');
      if (msg) msg.value = ["My website estimate:", ...summary].join("\n");
      contactTab("message");
      contact?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      setTimeout(() => $('#contactForm input[name="name"]')?.focus({ preventScroll: true }), 600);
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
    const greeting = { text: "Hi! I'll help you plan your website and show you what it costs. What do you need?", choices: ["I need a website", "I need a landing page", "Not sure yet"] };
    const afterOffer = ["Open my presentation →", "Make it cheaper", "Add a feature"];
    let state = { messages: [], bubbles: [], offer: null, choices: greeting.choices };
    let catalog, busy = false, planText = "";

    // Cloudflare Turnstile: an invisible "are you human?" check, needed once per conversation
    const ts = { widget: null, token: null, waiters: [] };
    function tsInit() {
      const box = $("#plVerify");
      if (ts.widget !== null || !box?.dataset.sitekey || !window.turnstile) return;
      ts.widget = window.turnstile.render(box, {
        sitekey: box.dataset.sitekey,
        appearance: "interaction-only",
        callback: (t) => { ts.token = t; ts.waiters.splice(0).forEach((f) => f(t)); },
        "expired-callback": () => { ts.token = null; },
        "error-callback": () => { ts.waiters.splice(0).forEach((f) => f("")); return true; },
      });
    }
    async function humanToken() {
      if (!$("#plVerify")?.dataset.sitekey) return "";
      // Cloudflare's script loads async; give it a few seconds (it can be blocked by ad blockers)
      for (let i = 0; i < 16 && !window.turnstile; i++) await new Promise((r) => setTimeout(r, 250));
      if (!window.turnstile) return "";
      tsInit();
      if (ts.token) { const t = ts.token; ts.token = null; setTimeout(() => ts.widget !== null && window.turnstile.reset(ts.widget), 0); return Promise.resolve(t); }
      return new Promise((resolve) => {
        const done = (t) => { clearTimeout(timer); ts.token = null; setTimeout(() => ts.widget !== null && window.turnstile.reset(ts.widget), 0); resolve(t); };
        const timer = setTimeout(() => { ts.waiters = ts.waiters.filter((f) => f !== done); resolve(""); }, 12000);
        ts.waiters.push(done);
      });
    }
    const tsPoll = setInterval(() => { if (window.turnstile) { clearInterval(tsPoll); tsInit(); } }, 300);
    setTimeout(() => clearInterval(tsPoll), 30000);

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
            <button type="button" class="btn btn--ghost btn--block" id="ofBook">${ic("calendar")} Book a free call</button>
            <button type="button" class="btn btn--ghost btn--block" id="ofSend">Email this plan to Anna</button>
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
    if ($("#bookForm")) $("#bookForm").hidden = !book;
    if ($("#contactForm")) $("#contactForm").hidden = book;
  }
  $("#tabBook")?.addEventListener("click", () => contactTab("book"));
  $("#tabMsg")?.addEventListener("click", () => contactTab("message"));
  $$('a[href="#contact"]').forEach((a) => a.addEventListener("click", () => { if (!a.hasAttribute("data-choose")) contactTab("book"); }));

  /* ---------- Booking calendar (requests are emailed, then confirmed by hand) ---------- */
  const bookForm = $("#bookForm");
  if (bookForm) {
    const SLOTS = {
      video: ["9:00", "9:30", "10:00", "10:30", "11:00", "11:30", "12:00", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"],
      person: ["10:00", "11:30", "14:00", "15:30"],
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
      if (wd === 0 || wd === 6 || d < today || d > today + DAYS_AHEAD * DAY) return [];
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

    bookForm.addEventListener("submit", (e) => {
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
      const to = $("#ctEmail")?.textContent || "hello@webumi.com.au";
      location.href = `mailto:${to}?subject=${encodeURIComponent(`${video ? "Call" : "Meeting"} request: ${when}`)}&body=${encodeURIComponent(body)}`;
      $("#bookName").textContent = String(fd.get("name")).split(" ")[0];
      $("#bookWhen").textContent = when;
      $("#bookDone").hidden = false;
      confetti(bookForm);
    });
    $$(".field input", bookForm).forEach((i) => i.addEventListener("input", () => i.closest(".field").classList.remove("is-invalid")));
  }

  /* ---------- Contact form ---------- */
  const form = $("#contactForm");
  form?.addEventListener("submit", (e) => {
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
    location.href = `mailto:hello@webumi.com.au?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    $("#doneName").textContent = String(fd.get("name")).split(" ")[0];
    $("#formDone").hidden = false;
    confetti(form);
  });
  if (form) $$(".field input", form).forEach((i) => i.addEventListener("input", () => i.closest(".field").classList.remove("is-invalid")));

  /* ---------- Non-profit application form ---------- */
  const npForm = $("#npForm");
  npForm?.addEventListener("submit", (e) => {
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
    const to = $("#ctEmail")?.textContent || "hello@webumi.com.au";
    location.href = `mailto:${to}?subject=${encodeURIComponent(`Non-profit application: ${fd.get("org")}`)}&body=${encodeURIComponent(body)}`;
    $("#npName").textContent = String(fd.get("name")).split(" ")[0];
    $("#npDone").hidden = false;
    confetti(npForm);
  });
  if (npForm) $$(".field input, .field textarea", npForm).forEach((i) => i.addEventListener("input", () => i.closest(".field").classList.remove("is-invalid")));

  function confetti(from) {
    if (reduceMotion) return;
    const colors = ["#ff6b4a", "#ffc857", "#1fa592", "#0f2a3d", "#ffffff"];
    const rect = from.getBoundingClientRect();
    for (let i = 0; i < 80; i++) {
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

  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();
})();
