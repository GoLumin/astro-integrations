# quote-experience Astro integration

A self-contained [Astro integration](https://docs.astro.build/en/reference/integrations-reference/)
that owns the post-submission MI-BOX quote page — the WebGL container
configurator with live pricing from the [gofuse](https://gofuse.app) headless
Quoting API.

Everything the feature needs lives in this one folder: the injected route and
its `.astro` page, the styles, the client configurator script (served
fingerprinted through Vite — nothing goes in `public/`), and a server-side
Quoting API client exposed as a virtual module. To put it on another MI-BOX
site, you copy this folder, register it with that site's options, and set one
env var.

## Folder layout

```
src/integrations/quote-experience/
├── index.ts          # the integration — options, env, injectRoute, virtual modules
├── runtime.ts        # Fuse Quoting API client factory + shared types
├── virtual.d.ts      # TypeScript declarations for the virtual modules
├── README.md
├── pages/
│   └── quote-thank-you.astro    # the injected quote page
└── assets/
    ├── quote-experience.css        # base configurator styles
    ├── quote-experience-mibox.css  # MI-BOX brand skin (scoped .qx-mibox)
    └── quote-experience-vt.js      # WebGL configurator + pricing state machine
```

## Setup

### 1. Register in `astro.config.mjs`

```js
import quoteExperience from "./src/integrations/quote-experience";

export default defineConfig({
  integrations: [
    // ...
    quoteExperience({
      phones: [
        { label: "Vermont Customers", number: "8022422022" },
        { label: "Mass & CT Customers", number: "9783000404" },
      ],
      fallbackPrices: { 8: 159, 16: 239, 20: 359 },
    }),
  ],
});
```

### 2. Set the environment

```
# Site-scoped fuse_… API key with "API mode" enabled in the gofuse admin.
QUOTING_API_TOKEN=fuse_...

# gofuse host (already used by the quote form). Can also be passed as the
# `baseUrl` option instead.
PUBLIC_API_URL_V2=https://miboxvermont.gofuse.app
```

For Cloudflare Workers Builds, add both as Build variables/secrets in the
dashboard (env vars are inlined at build time — see `wrangler.toml`).

Without the token the integration still works: it logs a warning at build
time, quote persistence is skipped, and the page falls back to URL params and
`fallbackPrices`. It never breaks form submissions.

### 3. Serve a logo

The WebGL shader decals `/logo.png` onto the container's side faces — the
site must serve one from `public/logo.png` (aspect ≈ 3.5:1, transparent
background looks best).

### Options

| Option           | Required | Default                                      | Description                                                       |
| ---------------- | -------- | -------------------------------------------- | ----------------------------------------------------------------- |
| `route`          | no       | `"/quote-thank-you"`                         | Path the quote page is injected at.                               |
| `baseUrl`        | no       | `PUBLIC_API_URL_V2` env var                  | gofuse host for the Quoting API.                                  |
| `tokenEnv`       | no       | `"QUOTING_API_TOKEN"`                        | Name of the env var holding the API token.                        |
| `phones`         | no       | VT + MA numbers                              | CTA phone buttons, rendered in order (first = primary style).     |
| `fallbackPrices` | no       | `{ 8: 159, 16: 239, 20: 359 }`               | Monthly rent per container size (ft → dollars) if the API is down. |

## How the flow works

```
QuoteForm.svelte
   │  submits the quoteForm Astro action
   ▼
src/actions/index.ts
   │  1. verifies Turnstile
   │  2. createQuote() → Fuse persists the quote, returns a uuid   (non-fatal on failure)
   │  3. sends admin + client emails, fires the Stella webhook
   │  4. returns { quoteId }
   ▼
redirect → /quote-thank-you?q=<uuid>   (plus legacy URL params as fallback)
   │
   ▼
pages/quote-thank-you.astro  (server, request time)
   │  1. getQuote(uuid) → full stored quote (line items, fees, totals)
   │     — falls back to URL params if ?q is missing or Fuse is down
   │  2. getConfig() → site settings, product catalog, reviews, FAQs
   │  3. derives container size + service to pre-check the configurator radios
   │  4. injects window.__QX_PRICES (per-size $) and window.__QX_QUOTE
   │     (computed pricing only — email/phone never reach the client)
   ▼
assets/quote-experience-vt.js  (browser)
      reads the checked radios + __QX_PRICES, renders the WebGL container
      and the live pricing panel; Keep-It shows a computed monthly rate,
      Move/Store services show "Call for pricing".
```

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
// siteConfig.phones, siteConfig.fallbackPrices
```

## Porting to another MI-BOX site — checklist

1. `cp -r src/integrations/quote-experience` into the new repo (same path).
2. Register it in `astro.config.mjs` with that site's `phones`,
   `fallbackPrices`, and (if the env var name differs) `baseUrl`/`tokenEnv`.
3. Set `QUOTING_API_TOKEN` + `PUBLIC_API_URL_V2` in `.env` and in the deploy
   platform's build variables.
4. Make sure `public/logo.png` exists.
5. The site needs a `@layouts/Layout.astro` (the page passes `title`,
   `description`, `noIndex`) — adjust the import in
   `pages/quote-thank-you.astro` if the layout lives elsewhere.
6. Point the site's quote form redirect at the route (default
   `/quote-thank-you`), passing `?q=<uuid>` from the action's `quoteId` —
   see `handleSubmit` in `src/components/forms/QuoteForm.svelte` and the
   `createQuote` block in `src/actions/index.ts` for the reference wiring.
7. Verify: submit the form → page opens pre-set to the chosen size/service
   with live catalog pricing; then load it with no params → renders with
   defaults.

## Notes

- The legacy consumers in this repo (`quote-thank-you-legacy.astro`,
  `QuoteTool.svelte`, `api/quote/preview.ts`) still use `src/lib/quoting.ts`
  and `public/quote-experience.js`. Those can be deleted together with the
  legacy page; this integration has no dependency on them.
- `window.__QX_QUOTE` deliberately contains only computed pricing (products,
  fees, totals) — customer contact details stay server-side.
