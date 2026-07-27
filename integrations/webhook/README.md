# webhook Astro integration

A small, generic [Astro integration](https://docs.astro.build/en/reference/integrations-reference/)
for forwarding JSON payloads to a webhook endpoint — typically fired from an
Astro action on form submit.

You configure an endpoint URL (plus optional headers and a field-name mapping)
once in `astro.config.mjs`, then call a server-side `sendWebhook()` helper from
anywhere on the server. Each site registers its own instance with its own URL,
so the same integration is reusable across sites.

## Setup

Register the integration in `astro.config.mjs`:

```js
import webhook from "./src/integrations/webhook";

export default defineConfig({
  integrations: [
    // ...
    webhook({
      // URL is read from STELLA_WEBHOOK_URL on this site.
      // The default env var name is WEBHOOK_URL for other sites.
      urlEnv: "STELLA_WEBHOOK_URL",
      headers: { "X-Source": "miboxvt" },
    }),
  ],
});
```

Set the URL in your environment (and `.env` for local dev):

```
WEBHOOK_URL=https://example.com/webhook
```

### Options

| Option         | Required | Default            | Description                                                                          |
| -------------- | -------- | ------------------ | ------------------------------------------------------------------------------------ |
| `url`          | no       | `WEBHOOK_URL` env  | Endpoint URL. Falls back to the env var named by `urlEnv`.                           |
| `urlEnv`       | no       | `"WEBHOOK_URL"`    | Name of the env var to read the endpoint URL from.                                   |
| `fieldMapping` | no       | `{}`               | `{ sourceKey: destKey }` rename map used by the `mapFields` helper.                  |
| `headers`      | no       | `{}`               | Static HTTP headers sent on every request (e.g. auth keys).                          |
| `method`       | no       | `"POST"`           | HTTP method (`"POST"` or `"PUT"`).                                                   |

## Usage

Import `sendWebhook` (and optionally `mapFields`) from the virtual module
`virtual:webhook`. It is **server-only** — use it in API routes
(`src/pages/api/*`) or Astro actions, never in a client component (that would
leak the endpoint URL / auth headers).

### Caller builds the payload (value transforms)

Use this when the webhook needs values the form doesn't carry directly
(e.g. mapping `keep-it` → `onsite`):

```ts
// src/actions/index.ts
import { sendWebhook } from "virtual:webhook";

await sendWebhook({
  first_name: input.firstName,
  phone: input.phone,
  service: SERVICE_MAP[input.serviceType] ?? input.serviceType,
});
```

### Simple field rename via config

For rename-only cases, configure `fieldMapping` and compose with `mapFields`:

```js
// astro.config.mjs
webhook({
  urlEnv: "CRM_WEBHOOK_URL",
  fieldMapping: {
    firstName: "first_name",
    email: "email",
    phone: "phone",
  },
}),
```

```ts
// src/actions/index.ts
import { sendWebhook, mapFields } from "virtual:webhook";

await sendWebhook(mapFields(input));
```

### `sendWebhook(payload, options?)`

| Field      | Type                     | Notes                                          |
| ---------- | ------------------------ | ---------------------------------------------- |
| `payload`  | `Record<string, unknown>` | required — the JSON body to POST.              |
| `options`  | `{ headers?: Record<string, string> }` | optional per-call header overrides, merged over configured `headers`. |

Returns `{ ok, status, body? }` on success. Throws `WebhookError` (with a
`status`) on a non-2xx response or network failure, so wrap calls in
`try/catch` when you want to keep them non-fatal.

### `mapFields(input)`

Applies the configured `fieldMapping`, returning a new object containing only
the mapped keys (empty/missing source values are skipped). With no mapping
configured, a shallow copy of the input is returned.
