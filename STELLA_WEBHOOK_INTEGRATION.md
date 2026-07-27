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
│   └── webhook/
```

# Stella Webhook Integration

This project includes the generic `webhook` Astro integration, configured for
Stella. It forwards a JSON payload (typically built from a form submission) to
Stella's webhook endpoint from an Astro action or API route.

---

## Environment Variables

```env
# Stella
STELLA_WEBHOOK_URL=https://example.com/stella-webhook
```

---

## Astro Configuration

Register the integration in `astro.config.mjs`, pointing `urlEnv` at the
Stella-specific environment variable:

```ts
import webhook from "./src/integrations/webhook";

export default defineConfig({
  integrations: [
    webhook({ urlEnv: "STELLA_WEBHOOK_URL" }),
  ],
});
```

---

## Sending to Stella

Use `sendWebhook()` inside Astro Actions or API routes. It is **server-only**
— never import `virtual:webhook` from a client component.

```ts
import { sendWebhook } from "virtual:webhook";

await sendWebhook({
  first_name: input.firstName,
  email: input.email,
  phone: input.phone,
});
```

`sendWebhook` returns `{ ok, status, body? }` on success and throws
`WebhookError` on a non-2xx response or network failure — wrap the call in
`try/catch` when it shouldn't be fatal to the request.

### Example: Astro Action

Since the payload here needs value transforms (mapping `serviceKey` to the
label Stella expects), build the object in the action rather than relying on
`fieldMapping`:

```ts
// src/actions/index.ts
import { defineAction } from "astro:actions";
import { z } from "astro:schema";
import { sendWebhook } from "virtual:webhook";

const SERVICE_MAP: Record<string, string> = {
  // ...
};

export const server = {
  submitQuote: defineAction({
    input: z.object({
      firstName: z.string(),
      lastName: z.string(),
      phone: z.string(),
      email: z.string().email(),
      initialDeliveryZip: z.string(),
      finalDeliveryZip: z.string(),
      serviceType: z.string(),
      selectedContainerType: z.string(),
    }),
    handler: async (input) => {
      const serviceKey = input.serviceType;

      await sendWebhook({
        first_name: input.firstName,
        last_name: input.lastName,
        phone: input.phone,
        email: input.email,
        id_zip: input.initialDeliveryZip,
        relo_zip: input.finalDeliveryZip,
        fd_zip: input.finalDeliveryZip,
        service: SERVICE_MAP[serviceKey] ?? input.serviceType,
        box_size: input.selectedContainerType,
      });
    },
  }),
};
```

### Optional: field rename via config

For rename-only mappings (no value transforms), configure `fieldMapping` and
compose with `mapFields`:

```ts
webhook({
  urlEnv: "STELLA_WEBHOOK_URL",
  fieldMapping: {
    firstName: "first_name",
    email: "email",
    phone: "phone",
  },
}),
```

```ts
import { sendWebhook, mapFields } from "virtual:webhook";

await sendWebhook(mapFields(input));
```

---

## Notes

- `sendWebhook()` is **server-only**.
- Never expose the Stella webhook URL or any auth headers to the client.
- Full option reference (`url`, `headers`, `method`, etc.) is in
  `integrations/webhook/README.md`.
