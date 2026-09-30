# Webumi website

Plain HTML/CSS/JS. A tiny build script (no installs) stitches shared parts into each page.

```
node build.js          # build src/ → dist/
node build.js serve    # build + preview at http://localhost:8080 (rebuilds when you save)
```

**Deploy the `dist/` folder** (Netlify, Cloudflare Pages, any static host). Don't edit `dist/` — it's regenerated on every build.

## Where things live

| What | File |
|---|---|
| Pages (one file each) | `src/pages/*.html`, `src/pages/for/*.html` |
| Shared header / footer / contact form | `src/partials/header.html`, `footer.html`, `contact.html` |
| `<head>`, SEO tags, page wrapper | `src/layout.html` |
| Icons (sprite) | `src/partials/icons.html` — use `{{icon:name}}` in pages |
| Business details for Google/AI (structured data) | `src/data/business.json` |
| Styles, script, logos, images, robots.txt, llms.txt | `src/static/` |

## Adding a page

1. Create `src/pages/my-page.html` → it becomes `/my-page/`.
2. Start it with a meta block:
   ```html
   <!--meta
   { "title": "Page title | Webumi", "description": "Under 160 characters.", "crumb": "Short name" }
   -->
   ```
3. Build. The page gets its own SEO tags, breadcrumb, sitemap entry, and FAQ structured data
   from any `<details><summary>Question</summary><p>Answer</p></details>` blocks.

## Prices

All prices live in `src/static/api/catalog.json`. The price builder (`/pricing/`) and the AI planner (`/plan/`) both read it, so change a price there and rebuild.

## AI website planner (`/plan/`)

A chat that asks a few questions and then shows a personal website plan with pages, ideas and a price.
It uses OpenAI through `api/chat.php`, which runs on Hostinger's normal PHP hosting (no Node server).
The AI only picks options from the catalog; the page calculates the prices, so it can't invent a price.

| What | File |
|---|---|
| What the planner says and how it decides | `src/static/api/prompt.txt` |
| The two actions it can take (ask / present offer) | `src/static/api/tools.json` |
| Server bridge to OpenAI (holds no key itself) | `src/static/api/chat.php` |

**One-time setup on Hostinger**
1. Create an API key at platform.openai.com → API keys, and add a monthly spending limit under Billing → Limits.
2. In hPanel → File Manager, go **one folder above** `public_html` and create `webumi-config.php`:
   ```php
   <?php return ['openai_key' => 'sk-...your key...', 'model' => 'gpt-5-mini'];
   ```
   It sits outside `public_html`, so nobody can download it.
3. Upload `dist/` as usual. Open webumi.com.au/plan/ and try it.

**Testing on your Mac:** `node build.js serve` runs a scripted demo (no key needed).
To test with the real AI, put your key in a `.env` file in the project folder (git ignores it):
```
OPENAI_API_KEY=sk-...
```

Visitors are limited to 40 messages per hour each, to protect your OpenAI bill.
