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

A chat that asks a few questions (business, goal, services, what they have, features, editing/CMS, CRM, timing)
and then makes a personal website plan. The plan opens as an animated presentation at `/plan/offer/`
(flow diagram, page map, price chart, timeline, "worth considering" tools with Add/Remove, next steps).
The whole plan is stored in the link, so it can be shared. Plain-language tool explanations live in `catalog.json` ("explain").
It uses OpenAI through `api/chat.php`, which runs on Hostinger's normal PHP hosting (no Node server).
The AI only picks options from the catalog; the page calculates the prices, so it can't invent a price.

| What | File |
|---|---|
| What the planner says and how it decides | `src/static/api/prompt.txt` |
| The two actions it can take (ask / present offer) | `src/static/api/tools.json` |
| Server bridge to OpenAI (holds no key itself) | `src/static/api/chat.php` |
| Plan prices, share links and the presentation page | `src/static/offer.js` |
| Contact details (phone is a placeholder) | `src/data/contact.json` |

**One-time setup on Hostinger**
1. In OpenAI (platform.openai.com): create an API key and set a monthly limit under Billing → Limits.
2. In hPanel → File Manager, go **one folder above** `public_html` and create `webumi-config.php`:
   ```php
   <?php return [
     'openai_key'       => 'sk-...your OpenAI key...',
     'model'            => 'gpt-5-mini',
     'turnstile_secret' => '0x...your Cloudflare Turnstile SECRET key...',
     'daily_budget'     => 0.50,   // USD per day for all visitors together
   ];
   ```
   It sits outside `public_html`, so nobody can download it. Usage counters are saved next to it in `webumi-data/`.
3. Upload `dist/` as usual. Open webumi.com.au/plan/ and try it.

**Order form (`/order/`)** sends orders by email through `api/order.php`, sends the customer a confirmation,
and keeps a backup of every order in `webumi-data/orders/` (next to the config file, not public).
Add two lines to `webumi-config.php`:
```php
'order_email' => 'you@webumi.com.au',     // where orders arrive
'mail_from'   => 'orders@webumi.com.au',  // a real mailbox on your domain (hPanel → Emails)
```
Limits: 5 orders per hour and 10 per day per visitor, plus the same Turnstile check as the planner.
On your Mac, order emails are saved to `webumi-data/outbox/` instead of being sent.

**Protection against wasted OpenAI money** (all in `chat.php`)
| Check | Limit |
|---|---|
| Only requests from webumi.com.au + hidden bot field | blocked before any cost |
| Cloudflare Turnstile "are you human?" check | once per conversation |
| Messages per conversation | 14 |
| New conversations per visitor | 3 per day |
| Messages per visitor | 25 per hour |
| Daily budget (real cost of every reply added up) | `daily_budget`, default $0.50 |

When a limit or the budget is reached, the planner points visitors to the price builder and the booking form.
To see today's spend, open `webumi-data/usage-YYYY-MM-DD.json` in File Manager.
The Turnstile site key (public) is in `src/data/site.json`; the widget is managed at dash.cloudflare.com → Turnstile.
