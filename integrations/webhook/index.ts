import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import type { AstroIntegration } from "astro";

export interface WebhookOptions {
  /**
   * Webhook endpoint URL. If omitted, the integration reads it from the
   * environment variable named by `urlEnv` (default `WEBHOOK_URL`).
   */
  url?: string;
  /**
   * Name of the environment variable holding the endpoint URL.
   * @default "WEBHOOK_URL"
   */
  urlEnv?: string;
  /**
   * Field-name mapping applied by the exported `mapFields(input)` helper:
   * `{ sourceKey: destKey }`. Use it to rename form fields to the payload keys
   * the webhook expects, for simple rename-only cases. When the caller needs
   * value transformation it should build the payload itself and call
   * `sendWebhook` directly.
   */
  fieldMapping?: Record<string, string>;
  /**
   * Static HTTP headers sent on every request (e.g. auth keys).
   * Per-call headers in `sendWebhook({ headers })` are merged over these.
   */
  headers?: Record<string, string>;
  /**
   * HTTP method used for the request.
   * @default "POST"
   */
  method?: "POST" | "PUT";
}

const VIRTUAL_ID = "virtual:webhook";
const RESOLVED_VIRTUAL_ID = "\0" + VIRTUAL_ID;

export default function webhook(
  options: WebhookOptions = {},
): AstroIntegration {
  const {
    urlEnv = "WEBHOOK_URL",
    fieldMapping = {},
    headers = {},
    method = "POST",
  } = options;

  return {
    name: "webhook",
    hooks: {
      "astro:config:setup": ({ command, updateConfig, logger }) => {
        // Resolve the URL at config time so it is bundled into the server
        // output only (never imported from a client component).
        const env = loadEnv(
          command === "dev" ? "development" : "production",
          process.cwd(),
          "",
        );
        const url = options.url ?? env[urlEnv];

        if (!url) {
          logger.warn(
            `no webhook URL found — set \`${urlEnv}\` in your environment or pass \`url\`. Requests will fail.`,
          );
        }

        const runtimeId = fileURLToPath(new URL("./runtime.ts", import.meta.url));

        updateConfig({
          vite: {
            plugins: [
              {
                name: "vite-plugin-webhook",
                resolveId(id) {
                  if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
                },
                load(id) {
                  if (id !== RESOLVED_VIRTUAL_ID) return;
                  const config = { url, headers, fieldMapping, method };
                  return [
                    `import { createClient } from ${JSON.stringify(runtimeId)};`,
                    `const { sendWebhook, mapFields } = createClient(${JSON.stringify(config)});`,
                    `export { sendWebhook, mapFields };`,
                  ].join("\n");
                },
              },
            ],
          },
        });
      },
    },
  };
}
