/**
 * Optional per-call overrides applied on top of the integration's configured
 * defaults (headers).
 */
export interface WebhookCallOptions {
  /** Extra/override HTTP headers for this single request. */
  headers?: Record<string, string>;
}

/** Result of a successful webhook call. */
export interface WebhookResult {
  ok: boolean;
  status: number;
  /** Parsed response body, when JSON was returned. */
  body?: unknown;
}

interface ClientConfig {
  url: string | undefined;
  headers: Record<string, string>;
  fieldMapping: Record<string, string>;
  method: "POST" | "PUT";
}

export class WebhookError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "WebhookError";
  }
}

/**
 * Apply a configured field-name mapping to `input`: for each
 * `"sourceKey" -> "destKey"` entry, `destKey: input.sourceKey` is added to the
 * output (skipping missing/empty values). With no `fieldMapping` configured the
 * input object is returned as-is. Useful for simple form-to-webhook renames
 * where no value transformation is needed.
 */
export type MapFields = <T extends Record<string, unknown>>(
  input: T,
) => Record<string, unknown>;

export function createClient(config: ClientConfig) {
  const mapFields: MapFields = (input) => {
    const entries = Object.entries(config.fieldMapping);
    if (entries.length === 0) return { ...input };
    const out: Record<string, unknown> = {};
    for (const [src, dest] of entries) {
      const value = input[src];
      if (value !== undefined && value !== null && value !== "") {
        out[dest] = value;
      }
    }
    return out;
  };

  async function sendWebhook(
    payload: Record<string, unknown>,
    options: WebhookCallOptions = {},
  ): Promise<WebhookResult> {
    if (!config.url) {
      throw new WebhookError(
        "Missing webhook URL. Set it in your environment or pass `url` to the integration.",
      );
    }

    const headers = {
      "Content-Type": "application/json",
      ...config.headers,
      ...options.headers,
    };

    let res: Response;
    try {
      res = await fetch(config.url, {
        method: config.method,
        headers,
        body: JSON.stringify(payload),
      });
    } catch (err) {
      throw new WebhookError(
        `Webhook request failed: ${(err as Error).message}`,
      );
    }

    if (!res.ok) {
      let message = `Webhook request failed with status ${res.status}.`;
      try {
        const text = await res.text();
        if (text) message = `${message} ${text}`;
      } catch {
        // ignore unreadable body
      }
      throw new WebhookError(message, res.status);
    }

    let body: unknown;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        body = await res.json();
      } catch {
        // ignore JSON parse failure
      }
    }

    return { ok: true, status: res.status, body };
  }

  return { sendWebhook, mapFields };
}
