declare module "virtual:webhook" {
  import type {
    WebhookCallOptions,
    WebhookResult,
    MapFields,
  } from "./runtime";

  /**
   * POST (or PUT) a JSON payload to the configured webhook endpoint. The caller
   * builds the payload. Server-side only — import it from API routes
   * (`src/pages/api/*`) or Astro actions, never from a client component (that
   * would leak the endpoint URL / auth headers).
   */
  export const sendWebhook: (
    payload: Record<string, unknown>,
    options?: WebhookCallOptions,
  ) => Promise<WebhookResult>;

  /**
   * Apply the integration's configured `fieldMapping` to rename keys of
   * `input`. Returns the input spread as-is when no mapping is configured.
   * Compose as `sendWebhook(mapFields(input))` for simple rename-only cases.
   */
  export const mapFields: MapFields;
}
