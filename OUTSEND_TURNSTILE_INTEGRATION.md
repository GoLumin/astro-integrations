## Installation

Copy the `integrations` folder into your project's `src` directory.

**Source**

```text
/Users/shahidaziz/Documents/integrations/integrations
```

**Destination**

```text
./src/integrations
```

Your project structure should look like:

```text
src/
├── integrations/
│   ├── getoutsend/
│   └── turnstile/
```

# Outsend + Cloudflare Turnstile Integration

This project includes two custom Astro integrations:

- **Cloudflare Turnstile** — Protects forms from spam and bots.
- **Outsend** — Sends transactional emails from Astro server actions or API routes.

---

## Environment Variables

```env
# Cloudflare Turnstile
PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
# Outsend
GETOUTSEND_API_KEY=your-api-key
```

---

## Astro Configuration

Please register both integrations in `astro.config.mjs`.

```ts
import turnstile from "./src/integrations/turnstile";
import getoutsend from "./src/integrations/getoutsend";

export default defineConfig({
  integrations: [
    turnstile(),
    getoutsend({
      fromName: "Your Company",
      fromEmail: "marketing@YOurCompany.com",
    }),
  ],
});
```

---

## Turnstile Verification

Use `verifyTurnstile()` inside Astro Actions or API routes.

```ts
import { verifyTurnstile } from "virtual:turnstile";

const { success } = await verifyTurnstile(token);

if (!success) {
  throw new Error("Turnstile verification failed.");
}
```

---

## Rendering the Widget

Install:

```bash
pnpm add @svelte-put/cloudflare-turnstile
```

Example:

```svelte
<script>
  import { turnstile } from "@svelte-put/cloudflare-turnstile";

  const siteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY;
  let token = "";
</script>

<div
  use:turnstile
  turnstile-sitekey={siteKey}
  onturnstile={(e) => (token = e.detail.token)}
></div>
```

Send the generated token to your server and verify it with `verifyTurnstile()`.

---

## Sending Email

Use `sendEmail()` anywhere on the server.

```ts
`to`        | `string \| string[]`     | required                                         |
| `subject`   | `string`                 | required                                         |
| `html`      | `string`                 | required unless `text` is set                    |
| `text`      | `string`                 | required unless `html` is set
import { sendEmail } from "virtual:getoutsend";

await sendEmail({
  to: "owner@example.com",
  subject: "Contact Form",
  html: "<p>Hello!</p>",
});
```

---

## Notes

- `verifyTurnstile()` is **server-only**.
- `sendEmail()` is **server-only**.
- Never expose your secret keys or API keys to the client.
- The `fromEmail` must belong to a verified Outsend sending domain.
