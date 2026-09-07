import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import type { AstroIntegration } from "astro";

/**
 * quote-experience — self-contained Astro integration for the post-submission
 * MI-BOX quote page (WebGL configurator + live Fuse pricing).
 *
 * Owns:
 *  - the injected route (default /quote-thank-you) and its page, styles, and
 *    client script (fingerprinted via Vite, nothing needed in public/)
 *  - `virtual:quoting` — server-side Fuse Quoting API client with the base
 *    URL + token baked in (previewQuote / createQuote / getQuote / getConfig)
 *  - `virtual:quoting/config` — per-site display options (brand name, phones,
 *    logo, service notes) so nothing regional is hardcoded in the page
 *
 * Pricing, labels, brand colours, reviews and FAQs all come from gofuse at
 * request time; the page never substitutes an invented number when the API is
 * silent (see pricing.ts).
 *
 * To reuse on another MI-BOX site: copy this folder, register it in
 * astro.config.mjs with that site's options, and set its Quoting API token
 * in the environment. The site must also serve the `logo` image (the WebGL
 * shader decals it onto the container).
 */

export interface QuotePhone {
  /** Button label, e.g. "Vermont Customers". */
  label: string;
  /** Digits-only dial string, e.g. "8022422022". */
  number: string;
}

export interface QuoteExperienceOptions {
  /**
   * Route the quote page is served at.
   * @default "/quote-thank-you"
   */
  route?: string;
  /**
   * gofuse host for the Quoting API. Defaults to the `PUBLIC_API_URL_V2`
   * environment variable.
   */
  baseUrl?: string;
  /**
   * Name of the environment variable holding the Quoting API token.
   * @default "QUOTING_API_TOKEN"
   */
  tokenEnv?: string;
  /**
   * Fallback call-to-action phone numbers, first one wins. Only used when
   * gofuse returns no phone for the quote's ZIP.
   */
  phones?: QuotePhone[];
  /**
   * Path (served from public/) of the logo the WebGL shader decals onto the
   * container's side faces. Aspect ≈ 3.5:1, transparent background.
   * @default "/logo.png"
   */
  logo?: string;
  /**
   * Brand name used in the page title and copy.
   * @default "MI-BOX"
   */
  brandName?: string;
  /**
   * One-line note under each service name in the configurator, keyed by the
   * gofuse service slug. A slug with no entry renders without a note — the
   * page never invents copy from the slug.
   */
  serviceNotes?: Record<string, string>;
}

const VIRTUAL_ID = "virtual:quoting";
const RESOLVED_VIRTUAL_ID = "\0" + VIRTUAL_ID;
const CONFIG_ID = "virtual:quoting/config";
const RESOLVED_CONFIG_ID = "\0" + CONFIG_ID;

export default function quoteExperience(
  options: QuoteExperienceOptions = {},
): AstroIntegration {
  const {
    route = "/quote-thank-you",
    tokenEnv = "QUOTING_API_TOKEN",
    phones = [
      { label: "Vermont Customers", number: "8022422022" },
      { label: "Mass & CT Customers", number: "9783000404" },
    ],
    logo = "/logo.png",
    brandName = "MI-BOX",
    serviceNotes = {
      "keep-it": "on your property",
      "move-it": "to a new address",
      "store-it": "at our secure facility",
    },
  } = options;

  return {
    name: "quote-experience",
    hooks: {
      "astro:config:setup": ({ command, updateConfig, injectRoute, logger }) => {
        const env = loadEnv(
          command === "dev" ? "development" : "production",
          process.cwd(),
          "",
        );
        const token = env[tokenEnv];
        const baseUrl =
          options.baseUrl ?? env.PUBLIC_API_URL_V2 ?? "https://miboxvermont.gofuse.app";

        if (!token) {
          logger.warn(
            `no Quoting API token found — set \`${tokenEnv}\` in your environment. ` +
              "Stored-quote lookups (?q=…) and quote persistence will be skipped; " +
              "the page falls back to URL params and renders \"Call for pricing\".",
          );
        }

        const runtimeId = fileURLToPath(new URL("./runtime.ts", import.meta.url));

        injectRoute({
          pattern: route,
          entrypoint: fileURLToPath(
            new URL("./pages/quote-thank-you.astro", import.meta.url),
          ),
        });

        updateConfig({
          vite: {
            plugins: [
              {
                name: "vite-plugin-quote-experience",
                resolveId(id) {
                  if (id === VIRTUAL_ID) return RESOLVED_VIRTUAL_ID;
                  if (id === CONFIG_ID) return RESOLVED_CONFIG_ID;
                },
                load(id) {
                  if (id === RESOLVED_VIRTUAL_ID) {
                    const config = { baseUrl, token };
                    return [
                      `import { createQuotingClient, formatCents } from ${JSON.stringify(runtimeId)};`,
                      `const client = createQuotingClient(${JSON.stringify(config)});`,
                      `export const previewQuote = client.previewQuote;`,
                      `export const createQuote = client.createQuote;`,
                      `export const getQuote = client.getQuote;`,
                      `export const getForm = client.getForm;`,
                      `export const getConfig = client.getConfig;`,
                      `export { formatCents };`,
                    ].join("\n");
                  }
                  if (id === RESOLVED_CONFIG_ID) {
                    return `export default ${JSON.stringify({ phones, logo, brandName, serviceNotes })};`;
                  }
                },
              },
            ],
          },
        });
      },
    },
  };
}
