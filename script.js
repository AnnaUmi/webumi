/* =========================================================
   Webumi — interactions
   ========================================================= */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const aud = (n) => "$" + Math.round(n).toLocaleString("en-AU");

  /* ---------- Nav ---------- */
  const nav = $("#nav");
  const burger = $(".nav__burger");
  const links = $(".nav__links");
  const sticky = $("#stickyCta");
  const contact = $("#contact");

  const onScroll = () => {
    nav.classList.toggle("is-scrolled", scrollY > 8);
    const contactTop = contact.getBoundingClientRect().top;
    sticky.classList.toggle("is-shown", scrollY > 600 && contactTop > innerHeight);
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
        ["ink", "🔎", "Google", "You showed up #2 in Bondi", "“Emergency plumber bondi” · 14 views today"],
        ["coral", "📩", "New quote request", "Burst pipe — Jake, Bondi Beach", "Photo attached · wants today if possible"],
        ["sea", "⚡", "Auto-reply sent", "“Thanks Jake, we'll call in 10 min”", "Sent instantly, while you were on the tools"],
        ["sun", "💳", "Invoice paid", "$420.00 received", "Paid by card from the job link"],
        ["sea", "⭐", "New 5-star review", "“Turned up in 40 min. Legend.”", "Review request sent automatically"],
      ],
    },
    beauty: {
      query: "gel nails near me",
      notes: [
        ["coral", "📅", "New booking", "Mia · Gel extensions", "Thu 2:30pm · booked at 11:48pm"],
        ["sun", "💳", "Deposit paid", "$30.00 deposit received", "Fewer no-shows"],
        ["sea", "💬", "Reminder sent", "“See you tomorrow at 2:30, Mia!”", "SMS sent automatically"],
        ["ink", "🔁", "Rebooked", "Mia booked her fill in 3 weeks", "From the “Book again” email"],
        ["sea", "⭐", "New 5-star review", "“Obsessed with my nails 😍”", "Asked 2 hours after her visit"],
      ],
    },
    pets: {
      query: "mobile dog grooming manly",
      notes: [
        ["ink", "🔎", "Google", "New visitor from Manly", "Landed on your Manly suburb page"],
        ["coral", "📅", "New booking", "Biscuit the cavoodle 🐶", "Full groom · Sat 9:00am · 42 Pine St"],
        ["sun", "💳", "Deposit paid", "$25.00 deposit received", "Card saved for the balance"],
        ["sea", "🗺️", "Route ready", "Saturday: 5 dogs, 3 suburbs", "Added to your calendar automatically"],
        ["sea", "⭐", "New 5-star review", "“Biscuit came back fluffy & happy”", "Review request sent automatically"],
      ],
    },
    clean: {
      query: "end of lease cleaning parramatta",
      notes: [
        ["coral", "📩", "New quote request", "3-bed end of lease · Parramatta", "Priya · needs it before the 14th"],
        ["sea", "⚡", "Instant estimate sent", "“From $480 — book your date here”", "Priced from your own rate card"],
        ["ink", "📅", "Job booked", "Fri 8:00am · 3-bed unit", "Added to your team's calendar"],
        ["sun", "💳", "Paid in full", "$520.00 received", "Invoice synced to Xero"],
        ["sea", "⭐", "New 5-star review", "“Got my full bond back!”", "Review request sent automatically"],
      ],
    },
    coach: {
      query: "maths tutor year 10 brisbane",
      notes: [
        ["ink", "🔎", "Website visit", "Parent viewing “Year 10 Maths”", "From Google · 2 min on page"],
        ["coral", "📅", "Free intro call booked", "Tom's mum · Wed 4:00pm", "Booked straight from your site"],
        ["sea", "📨", "Follow-up sent", "“Here's what Tom's plan looks like”", "Sent automatically after the call"],
        ["sun", "💳", "Term package paid", "$640.00 · 8 sessions", "Paid online by card"],
        ["sea", "📈", "This week", "6 new enquiries · 4 booked", "Your whole pipeline, in one place"],
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
      <div class="note__icon note__icon--${tone}">${icon}</div>
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
  phoneIO.observe($(".phone"));

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
      title: "Get found on Google, turn visitors into enquiries.",
      desc: "Many small business websites look fine but don't bring in work. I build yours around one goal: more enquiries.",
      list: [
        "A fast, mobile-first website that says what you do in 5 seconds",
        "Service + suburb pages so you show up where people search",
        "Google Business Profile polished, with reviews front and centre",
        "One-tap call, quote form and instant auto-reply",
      ],
      pkg: ["Get Found — from $1,490", "launch"],
      flow: [
        ["🔎", "Customer searches Google", "“landscaper eastern suburbs”"],
        ["📍", "Finds your Google profile", "Reviews, photos, hours"],
        ["📱", "Lands on the exact right page", "Not just your homepage"],
        ["📩", "Taps “Get a quote”", "30-second form, no friction"],
        ["⚡", "Gets a reply instantly", "“Thanks Sarah, we'll be in touch today”"],
        ["🔔", "You get the lead on your phone", "Name, job, photos — ready to go"],
      ],
    },
    bookings: {
      title: "Let customers book (and pay) while you sleep.",
      desc: "No more back-and-forth messages. Customers pick a time, pay a deposit and get a reminder.",
      list: [
        "Booking built into your site, using Square, Fresha or Calendly",
        "Deposits that make no-shows basically disappear",
        "Automatic confirmations and SMS reminders",
        "Review requests and “book again” nudges after every visit",
      ],
      pkg: ["Get Booked — from $2,990", "grow"],
      flow: [
        ["📸", "Sees you on Instagram", "Taps the link in your bio"],
        ["💅", "Chooses a service", "Clear prices, no DMs needed"],
        ["🕑", "Picks a time that suits", "Only your real availability"],
        ["💳", "Pays a small deposit", "Commitment = fewer no-shows"],
        ["💬", "Gets reminded the day before", "Automatically, by SMS"],
        ["⭐", "Leaves a review & rebooks", "Regulars come back more often"],
      ],
    },
    admin: {
      title: "Stop copy-pasting. Let your tools talk to each other.",
      desc: "Most businesses don't need custom software. They need the apps they already use, connected properly, so routine tasks happen automatically.",
      list: [
        "Every enquiry lands in one simple list (no more lost emails)",
        "Quotes follow themselves up if nobody replies",
        "Jobs → invoices → payments → Xero, without retyping",
        "A weekly snapshot of how the business is actually going",
      ],
      pkg: ["Run Itself — from $4,990", "auto"],
      flow: [
        ["📩", "Enquiry comes in", "Website, email or Facebook"],
        ["🗂️", "Customer added to your CRM", "Automatically, no typing"],
        ["📨", "Quote sent & followed up", "Nudges after 2 days if quiet"],
        ["📅", "Job booked into calendar", "You, your team, the customer"],
        ["🧾", "Invoice sent, payment taken", "Synced straight to Xero"],
        ["⏱️", "Hours back every week", "Time for paid work instead of admin"],
      ],
    },
    ai: {
      title: "Put AI to work on the repetitive stuff.",
      desc: "A practical assistant trained on your business. It answers questions, sorts enquiries and fills in data for you.",
      list: [
        "An AI assistant on your site that answers and books, 24/7",
        "Enquiries sorted and replies drafted in your tone",
        "Details pulled from emails, forms and PDFs automatically",
        "Plugged into your CRM, calendar, payments or Xero",
      ],
      pkg: ["AI Assistant — from $1,990", "ai"],
      flow: [
        ["🌙", "Customer asks a question at 11pm", "“How much for a large dog?”"],
        ["✨", "AI answers from your price list", "Accurate, friendly, in your tone"],
        ["📅", "Offers a time and books it", "Straight into your calendar"],
        ["🗂️", "Saves the details to your CRM", "Name, pet, notes — no typing"],
        ["🙋", "Hands tricky ones to you", "With a summary, so you're up to speed"],
        ["☀️", "You wake up to new bookings", "Not 14 unanswered messages"],
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
    $("#goalFlow").innerHTML = g.flow.map(([i, t, s], n) =>
      `<li style="animation-delay:${n * 90}ms"><span class="flow__dot">${i}</span><span class="flow__t">${t}<span class="flow__s">${s}</span></span></li>`
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
  showGoal("customers");

  // Highlight the recommended package when jumping to it
  $("#goalPkg").addEventListener("click", (e) => {
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
  chatIO.observe($(".chat"));

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
  Object.values(inputs).forEach((el) => el.addEventListener("input", calc));
  calc();

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

  /* ---------- Package buttons pre-fill the form ---------- */
  const needMap = { "Get Found": "More customers", "Get Booked": "Online bookings", "Run Itself": "Less admin", "Website Rescue": "Website Rescue", "AI Assistant": "AI assistant or integration" };
  $$("[data-choose]").forEach((b) => b.addEventListener("click", () => {
    const val = needMap[b.dataset.choose];
    const box = $(`input[name="need"][value="${val}"]`);
    if (box) box.checked = true;
    const msg = $('textarea[name="message"]');
    if (!msg.value) msg.value = `I'm interested in the ${b.dataset.choose} package.`;
  }));

  /* ---------- Contact form ---------- */
  const form = $("#contactForm");
  form.addEventListener("submit", (e) => {
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
    confetti();
  });
  $$(".field input", form).forEach((i) => i.addEventListener("input", () => i.closest(".field").classList.remove("is-invalid")));

  function confetti() {
    if (reduceMotion) return;
    const colors = ["#ff6b4a", "#ffc857", "#1fa592", "#0f2a3d", "#ffffff"];
    const rect = form.getBoundingClientRect();
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

  $("#year").textContent = new Date().getFullYear();
})();
