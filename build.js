#!/usr/bin/env node
/*
  Webumi site builder — no dependencies.

    node build.js          build src/ → dist/
    node build.js serve    build, then preview at http://localhost:8080 (rebuilds on change)

  Pages live in src/pages/. Each starts with a meta block:

    <!--meta
    { "title": "...", "description": "...", "crumb": "Websites" }
    -->

  Inside pages and partials:
    {{> name}}      insert src/partials/name.html
    {{icon:name}}   insert an icon from the sprite (src/partials/icons.html)
    {{key}}         insert a meta value
    {{price:id:field}} / {{aud:id:field}}   a price from src/static/api/catalog.json, raw or as "$1,234"
                    (id = a type like "website" or an option id; field = price, landing, website, monthly, extraPage…)
    {{v:file}}      "/file?v=1a2b3c4d": a file from src/static/ with a fingerprint of its contents, so browsers
                    and Hostinger's CDN (which keep files for 7 days) fetch the new one after every change
  <details><summary>Q</summary><p>A</p></details> blocks become FAQ structured data automatically.
*/
const fs = require("fs");
const path = require("path");
const http = require("http");

// Local secrets (OPENAI_API_KEY) from .env, which git ignores
try {
  for (const line of fs.readFileSync(path.join(__dirname, ".env"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];   // a variable set on the command line (even empty) wins
  }
} catch {}

const SITE = "https://webumi.com.au";
const SRC = path.join(__dirname, "src");
const DIST = path.join(__dirname, "dist");
const today = new Date().toISOString().slice(0, 10);

const read = (p) => fs.readFileSync(p, "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}

const catalog = () => JSON.parse(read(path.join(SRC, "static", "api", "catalog.json")));
function priceOf(cat, id, field) {
  const item = id === "support" ? cat.support : cat.types[id] || cat.options.find((o) => o.id === id) || (cat.media || []).find((o) => o.id === id);
  const v = item && item[field];
  if (v === undefined) throw new Error(`Unknown price {{price:${id}:${field}}}`);
  return v;
}

// A shorter price list for the AI: fewer tokens on every message = lower OpenAI cost
function aiCatalog(cat = catalog()) {
  return {
    currency: cat.currency,
    types: cat.types,
    options: cat.options.map(({ features, explain, ...o }) => o),
    support: cat.support.note,
    included: cat.included,
    process: cat.process.map((s) => `${s.step} (${s.when})`).join(" → "),
    payment: "50% to start, 50% at launch; Express 100% upfront; support plans monthly from 30 days after launch.",
    systems: cat.systems,
  };
}

const fingerprints = {};
function fingerprint(file) {
  return (fingerprints[file] ??= require("crypto").createHash("md5").update(fs.readFileSync(path.join(SRC, "static", file))).digest("hex").slice(0, 8));
}

function render(tpl, vars, depth = 0) {
  if (depth > 5) throw new Error("Partials nested too deep");
  return tpl
    .replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, n) => render(read(path.join(SRC, "partials", n + ".html")), vars, depth + 1))
    .replace(/\{\{(price|aud):([\w-]+):(\w+)\}\}/g, (_, kind, id, f) => {
      const v = priceOf(vars.catalog || (vars.catalog = catalog()), id, f);
      return kind === "aud" ? "$" + v.toLocaleString("en-AU") : v;
    })
    .replace(/\{\{icon:([\w-]+)\}\}/g, (_, n) => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`)
    .replace(/\{\{v:([\w./-]+)\}\}/g, (_, f) => `/${f}?v=${fingerprint(f)}`)
    .replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}

function urlFor(file) {
  const rel = path.relative(path.join(SRC, "pages"), file).replace(/\\/g, "/").replace(/\.html$/, "");
  return rel === "index" ? "/" : `/${rel.replace(/\/index$/, "")}/`;
}

function schemaFor(page, body) {
  const url = SITE + page.url;
  const business = JSON.parse(read(path.join(SRC, "data", "business.json")));
  const graph = [
    business,
    { "@type": "WebSite", "@id": SITE + "/#website", url: SITE + "/", name: "Webumi", inLanguage: "en-AU", publisher: { "@id": SITE + "/#business" } },
    { "@type": "WebPage", "@id": url + "#webpage", url, name: page.title, description: page.description,
      isPartOf: { "@id": SITE + "/#website" }, about: { "@id": SITE + "/#business" }, inLanguage: "en-AU", dateModified: today },
  ];
  if (page.url === "/404/") graph.pop();   // shown at any missing address: no page or breadcrumb of its own
  else if (page.url !== "/") {
    const parts = page.url.split("/").filter(Boolean);
    const items = [{ "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" }];
    if (parts.length > 1 && page.parentCrumb) items.push({ "@type": "ListItem", position: 2, name: page.parentCrumb[0], item: SITE + page.parentCrumb[1] });
    items.push({ "@type": "ListItem", position: items.length + 1, name: page.crumb || page.title, item: url });
    graph.push({ "@type": "BreadcrumbList", "@id": url + "#breadcrumb", itemListElement: items });
  }
  const faqs = [...body.matchAll(/<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>/g)]
    .map(([, q, a]) => ({ "@type": "Question", name: strip(q), acceptedAnswer: { "@type": "Answer", text: strip(a) } }));
  if (faqs.length) graph.push({ "@type": "FAQPage", "@id": url + "#faq", mainEntity: faqs });
  if (page.service) graph.push({ "@type": "Service", "@id": url + "#service", provider: { "@id": SITE + "/#business" }, areaServed: { "@type": "Country", name: "Australia" }, url, ...page.service });
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 1);
}

function build() {
  for (const f in fingerprints) delete fingerprints[f];   // files may have changed since the last build (preview server)
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  fs.cpSync(path.join(SRC, "static"), DIST, { recursive: true });
  fs.writeFileSync(path.join(DIST, "api", "catalog-ai.json"), JSON.stringify(aiCatalog()));

  const layout = read(path.join(SRC, "layout.html"));
  const pages = walk(path.join(SRC, "pages")).filter((f) => f.endsWith(".html") && !path.basename(f).startsWith("_"));
  const urls = [];

  for (const file of pages) {
    const raw = read(file);
    const m = raw.match(/^<!--meta\s*([\s\S]*?)-->\s*/);
    if (!m) throw new Error(`Missing <!--meta --> block in ${file}`);
    const page = JSON.parse(m[1]);
    page.url = urlFor(file);
    for (const k of ["title", "description"]) if (!page[k]) throw new Error(`${file}: meta "${k}" is required`);
    if (page.description.length > 165) console.warn(`  ! ${page.url} description is ${page.description.length} chars (aim for ≤160)`);

    const data = (f) => JSON.parse(read(path.join(SRC, "data", f)));
    const vars = { ...data("contact.json"), ...data("site.json"), ...page, site: SITE };
    const body = render(raw.slice(m[0].length), vars);
    const html = render(layout, {
      ...vars,
      title: esc(page.title),
      ogTitle: esc(page.ogTitle || page.title),
      description: esc(page.description),
      url: SITE + page.url,
      content: body,
      schema: schemaFor(page, body),
    })
      // personal pages (e.g. a visitor's plan) stay out of Google
      .replace("</head>", page.noindex ? '  <meta name="robots" content="noindex">\n</head>' : "</head>")
      // the 404 page is shown at whatever address was mistyped, so it can't name its own URL
      .replace(page.url === "/404/" ? /\s*<link rel="canonical"[^>]*>|\s*<meta property="og:url"[^>]*>/g : /$^/, "")
      // mark the current page in the navigation
      .replace(new RegExp(`(<nav class="nav__links"[\\s\\S]*?)<a href="${page.url}"`), `$1<a href="${page.url}" aria-current="page"`);

    // hosts serve /404.html for missing pages
    const out = page.url === "/404/" ? path.join(DIST, "404.html") : path.join(DIST, page.url, "index.html");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    if (!page.noindex) urls.push({ url: page.url, priority: page.url === "/" ? "1.0" : page.url.split("/").length > 3 ? "0.7" : "0.8" });
  }

  urls.sort((a, b) => a.url.localeCompare(b.url));
  fs.writeFileSync(path.join(DIST, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${SITE}${u.url}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`).join("\n") +
    `\n</urlset>\n`);
  console.log(`Built ${urls.length} pages → dist/`);
  return urls;
}

build();

if (process.argv[2] === "serve") {
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml",
    ".png": "image/png", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".webmanifest": "application/manifest+json",
    ".mp4": "video/mp4", ".webm": "video/webm" };
  http.createServer((req, res) => {
    const api = req.method === "POST" && req.url.match(/^\/api\/(chat|order|contact)\.php/);
    if (api) return devPhp(req, res, api[1]);
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(DIST, p);
    if (!file.startsWith(DIST) || !fs.existsSync(file)) {
      res.writeHead(404, { "Content-Type": types[".html"] });
      try { return res.end(fs.readFileSync(path.join(DIST, "404.html"))); } catch { return res.end("Not found (rebuilding?)"); }   // dist/ is briefly empty during a rebuild
    }
    const type = types[path.extname(file)] || "application/octet-stream";
    // byte ranges: Safari won't play a video without them
    const size = fs.statSync(file).size, range = (req.headers.range || "").match(/^bytes=(\d*)-(\d*)$/);
    if (range) {
      const start = range[1] ? +range[1] : Math.max(0, size - +range[2]), end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
      res.writeHead(206, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": size });
    fs.createReadStream(file).pipe(res);
  }).listen(8080, () => console.log("Preview: http://localhost:8080"));

  let timer;
  fs.watch(SRC, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => { try { build(); } catch (e) { console.error(e.message); } }, 150);
  });
}

/*
  Local preview of the PHP files in api/ (chat.php, order.php, contact.php). PHP isn't installed on a Mac, so the
  real files run through PHP compiled to WebAssembly (npx @php-wasm/cli), with the same checks as on
  Hostinger. Settings come from .env (OPENAI_API_KEY, TURNSTILE_SECRET, WEBUMI_DAILY_BUDGET).
  Without OPENAI_API_KEY the planner plays a short scripted demo. Order and contact emails can't be sent
  locally; they're saved to webumi-data/outbox/ so you can read them.
*/
const PHP_WASM = "@php-wasm/cli@3.1.56";
const STATUS = { verify: 401, limit: 429, budget: 503 };

function devPhp(req, res, name) {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const send = (code, data) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    if (name === "chat" && !process.env.OPENAI_API_KEY) {
      let messages;
      try { messages = JSON.parse(body || "{}").messages || []; } catch { return send(400, { error: "Bad request" }); }
      return setTimeout(() => send(200, { ...demoTurn(messages), conv: "demo" }), 700);
    }
    const php = require("child_process").spawn("npx", ["-y", PHP_WASM, path.join(DIST, "api", name + ".php")], {
      env: { ...process.env, REQUEST_METHOD: "POST", HTTP_ORIGIN: req.headers.origin || "", REMOTE_ADDR: req.socket.remoteAddress || "",
        WEBUMI_ALLOWED_HOSTS: "localhost", WEBUMI_DEV_OUTBOX: "1" },
    });
    let out = "", err = "";
    php.stdout.on("data", (c) => (out += c));
    php.stderr.on("data", (c) => (err += c));
    php.on("close", () => {
      const json = out.slice(out.indexOf("{"));
      try {
        const data = JSON.parse(json);
        send(data.error ? STATUS[data.code] || 400 : 200, data);
      } catch {
        console.error(name + ".php:", (out + err).split("\n").filter((l) => !l.includes("npm warn")).join("\n").slice(0, 800));
        send(502, { error: "Something went wrong. Please try again in a moment." });
      }
    });
    php.stdin.end(body);
  });
}

function demoTurn(messages) {
  const n = messages.filter((m) => m.role === "user").length;
  const asks = [
    ["What does your business do, and which area do you work in?", ["Dog grooming, Bondi", "Plumbing, Brisbane", "Cleaning, Perth"]],
    ["Got it. What should the website mainly get you: calls, online bookings or quote requests?", ["Online bookings", "Phone calls", "Quote requests"]],
    ["Do you already have a logo, photos and a domain name?", ["Logo and photos", "Only a logo", "Nothing yet"]],
  ];
  if (n <= asks.length) return { tool: "ask", args: { message: "(Demo mode, no API key) " + asks[n - 1][0], choices: asks[n - 1][1] } };
  return { tool: "present_offer", args: {
    message: "Here's the plan I'd suggest. You can ask me to change anything.",
    business_name: "Bondi Dog Spa",
    headline: "Full grooming books, straight from Google",
    summary: "You groom dogs in Bondi and lose bookings to slow replies on Instagram. This website shows up for local searches, shows your prices upfront, and lets owners book and pay a deposit in under a minute.",
    type: "website", pages: 9, crm_system: "HubSpot (free plan)",
    sitemap: [
      { name: "Home", purpose: "Prices, reviews and a Book now button above the fold." },
      { name: "Full groom", purpose: "What's included, time needed and price by dog size." },
      { name: "Wash & tidy", purpose: "Quick option between full grooms." },
      { name: "Puppy intro", purpose: "Gentle first visit, a top search for new owners." },
      { name: "Bondi", purpose: "Local page for 'dog groomer Bondi' searches." },
      { name: "Bronte & Tamarama", purpose: "Catches searches from nearby suburbs." },
      { name: "Gallery", purpose: "Before-and-after photos." },
      { name: "About", purpose: "Your story and experience with anxious dogs." },
      { name: "Contact", purpose: "Map, hours and enquiry form." },
    ],
    options: [
      { id: "booking", why: "Owners book the slot themselves instead of messaging you." },
      { id: "payments", why: "A deposit cuts no-shows on busy Saturdays." },
      { id: "text-written", why: "You said writing isn't your thing; each page targets what Bondi owners search for." },
      { id: "crm", why: "Every booking and enquiry lands in one customer list, so regulars are easy to rebook." },
      { id: "reviews", why: "Your 5-star Google reviews sit right next to the Book now button." },
      { id: "care-plus", why: "Price and hours changes are done for you, and you get a monthly report on bookings." },
    ],
    ideas: [
      "A size-based price table (small, medium, large) so owners know the cost before they book.",
      "A 'first groom' offer on the Puppy intro page to win new owners.",
      "Show your Google reviews on the home page next to the Book now button.",
    ],
  } };
}
