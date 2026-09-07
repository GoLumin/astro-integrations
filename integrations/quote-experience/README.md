# quote-experience Astro integration

A self-contained [Astro integration](https://docs.astro.build/en/reference/integrations-reference/)
that owns the post-submission MI-BOX quote page — the WebGL container
configurator with live pricing from the [gofuse](https://gofuse.app) headless
Quoting API.

Everything the feature needs lives in this one folder: the injected route and
its `.astro` page, the styles, the client configurator script (served
fingerprinted through Vite — nothing goes in `public/`), the pricing
normaliser, and a server-side Quoting API client exposed as a virtual module.
To put it on another MI-BOX site, you copy this folder, register it with that
site's options, and set one env var.

**Everything the page shows comes from gofuse at request time** — prices, fees,
labels, brand colours, reviews, FAQs. Nothing is substituted when the API is
silent: a service with no catalog is disabled and a missing price renders as
"Call for pricing", because a plausible-looking wrong number on a quote is
worse than an absent one.

## Folder layout

```
src/integrations/quote-experience/
├── index.ts          # the integration — options, env, injectRoute, virtual modules
├── runtime.ts        # gofuse Quoting API client factory + shared types
├── pricing.ts        # normalises config + preview into what the page renders
├── sanitize.ts       # sanitiser for gofuse's rich-text reviews and FAQ answers
├── virtual.d.ts      # TypeScript declarations for the virtual modules
├── pages/
│   └── quote-thank-you.astro    # the injected quote page
└── assets/
    ├── quote-experience.css        # base configurator styles
    ├── quote-experience-mibox.css  # MI-BOX brand skin (scoped .qx-mibox)
    └── quote-experience-vt.js      # WebGL configurator + pricing state machine
```

## Setup

### 1. Install the one dependency

`sanitize.ts` cleans the HTML gofuse returns for reviews and FAQ answers:

```bash
npm i sanitize-html && npm i -D @types/sanitize-html
```

### 2. Register in `astro.config.mjs`

```js
import quoteExperience from "./src/integrations/quote-experience";

export default defineConfig({
  integrations: [
    // ...
    quoteExperience({
      baseUrl: "https://mulebox.gofuse.app",
      brandName: "Mule Box",
      logo: "/logo.webp",
      phones: [{ label: "Austin Customers", number: "5125752929" }],
    }),
  ],
});
```

### 3. Set the environment

```
# Site-scoped fuse_… API key with "API mode" enabled in the gofuse admin.
QUOTING_API_TOKEN=fuse_...

# gofuse host. Can also be passed as the `baseUrl` option instead.
PUBLIC_API_URL_V2=https://miboxvermont.gofuse.app
```

For Cloudflare Workers Builds, add both as Build variables/secrets in the
dashboard (env vars are inlined at build time — see `wrangler.toml`).

Without the token the integration still works: it logs a warning at build
time, quote persistence and stored-quote lookups are skipped, and the page
falls back to URL params. It never breaks form submissions.

### 4. Serve a logo

The WebGL shader decals the `logo` option onto the container's side faces —
the site must serve it from `public/` (aspect ≈ 3.5:1, transparent background
looks best).

### Options

| Option         | Required | Default                              | Description                                                                 |
| -------------- | -------- | ------------------------------------ | --------------------------------------------------------------------------- |
| `route`        | no       | `"/quote-thank-you"`                 | Path the quote page is injected at.                                          |
| `baseUrl`      | no       | `PUBLIC_API_URL_V2` env var          | gofuse host for the Quoting API.                                             |
| `tokenEnv`     | no       | `"QUOTING_API_TOKEN"`                | Name of the env var holding the API token.                                   |
| `brandName`    | no       | `"MI-BOX"`                           | Used in the page title and body copy.                                        |
| `logo`         | no       | `"/logo.png"`                        | Logo the WebGL shader decals onto the container.                             |
| `phones`       | no       | VT + MA numbers                      | Fallback CTA numbers, first wins — only used when gofuse returns no phone.    |
| `serviceNotes` | no       | keep-it / move-it / store-it notes   | One-liner under each service name, keyed by gofuse slug.                      |

## How the flow works

```
QuoteForm
   │  submits the quote Astro action
   ▼
src/actions/…
   │  1. honeypot + Turnstile check
   │  2. createQuote() → gofuse persists the quote, returns a uuid  (non-fatal on failure)
   │  3. sends admin + client emails, fires any webhook
   │  4. returns { quoteId }
   ▼
redirect → /quote-thank-you?q=<uuid>   (plus legacy URL params as fallback)
   │
   ▼
pages/quote-thank-you.astro  (server, request time)
   │  1. getQuote(uuid) → the stored quote (line items, service, ZIPs)
   │     — falls back to URL params if ?q is missing or gofuse is down
   │  2. getConfig() → settings, full product catalog, reviews, FAQs
   │  3. previewQuote() once per service type → that service's fees
   │  4. pricing.ts folds each pair into a ServiceView (cents, end to end)
   │  5. injects window.__QX_DATA — services, lengths, labels, brand colours
   │     (computed pricing only; email/phone never reach the client)
   ▼
assets/quote-experience-vt.js  (browser)
      re-renders the WebGL container and the pricing panel from __QX_DATA on
      every size/service change — no further network calls.
```

### Why one preview per service

gofuse's fee calculator keys off service type and ZIP only, never the product,
so a single preview prices every product in that service. One unfiltered
`getConfig` returns the whole catalog tagged with the services each product
belongs to, which the page scopes per service locally.

### The self-check

`toServiceView` compares our computed total for gofuse's default product
against the total gofuse itself returned. If they ever diverge, gofuse has
changed how it totals a quote and the page logs a loud server-side error —
`totalsAgree: false` — rather than silently showing a number gofuse would not
honour. If you see that in the logs, re-read `extractFees()`.

### Money is in cents

gofuse stores and returns every amount in cents. `pricing.ts` keeps it that
way end to end and formats only at the point of display — converting early
would round away real half-dollar prices.

## Usage of the virtual modules

`virtual:quoting` is the configured API client. **Server-only** — import it
from Astro actions, API routes, or `.astro` frontmatter, never from a client
component (the token is baked into the module at build time and would ship to
the browser).

```ts
import { createQuote, getQuote, getConfig, previewQuote } from "virtual:quoting";

const quote = await createQuote({
  service_type: "keep-it",
  zip_code: "05401",
  full_name: "Jane Doe",
  idempotency_key: crypto.randomUUID(),
});
// quote.uuid → pass as ?q= to the quote page
```

`virtual:quoting/config` is the per-site display config (safe anywhere):

```ts
import siteConfig from "virtual:quoting/config";
// siteConfig.phones, siteConfig.logo, siteConfig.brandName, siteConfig.serviceNotes
```

## Porting to another MI-BOX site — checklist

1. `cp -R integrations/quote-experience /path/to/site/src/integrations/`.
2. `npm i sanitize-html` (+ `@types/sanitize-html`).
3. Register it in `astro.config.mjs` with that site's `baseUrl`, `brandName`,
   `logo`, `phones` and `serviceNotes`.
4. Set `QUOTING_API_TOKEN` + `PUBLIC_API_URL_V2` in `.env` and in the deploy
   platform's build variables.
5. Make sure the `logo` image exists in `public/`.
6. The site needs a `@layouts/Layout.astro` (the page passes `title`,
   `description`, `noIndex`) — adjust the import in
   `pages/quote-thank-you.astro` if the layout lives elsewhere.
7. Point the site's quote form redirect at the route (default
   `/quote-thank-you`), passing `?q=<uuid>` from the action's `quoteId`.
8. Verify: submit the form → page opens pre-set to the chosen size/service
   with live catalog pricing; then load it with no params → renders with
   whatever gofuse returns for the site.

## Notes

- The page trusts the customer's own choice first when picking which service
  and size to open on, then falls back to whatever gofuse can actually price.
  A requested size gofuse does not stock (the form still offers 8', which may
  have no product) falls to the nearest size it does stock.
- Sizes are not hardcoded. Container lengths are parsed out of each product's
  `dimensions` string, so a site that stocks 10' or 24' units needs no code
  change.
- `window.__QX_DATA` deliberately contains only computed pricing (products,
  fees, totals) — customer contact details stay server-side.
- gofuse resolves the phone number from the ZIP's service location, so that is
  the accurate one; the configured `phones` are only a last resort for when the
  API is unreachable.
