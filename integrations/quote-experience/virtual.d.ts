declare module "virtual:quoting" {
  import type {
    QuoteParams,
    QuotePreview,
    QuoteConfig,
  } from "./runtime";

  /**
   * Configured Fuse Quoting API client. Server-side only — import from
   * actions, API routes, or .astro frontmatter, never from a client
   * component (the module bakes the API token in at build time).
   */
  export const previewQuote: (params: QuoteParams) => Promise<QuotePreview>;
  export const createQuote: (params: QuoteParams) => Promise<any>;
  export const getQuote: (uuid: string) => Promise<any>;
  export const getForm: (slug: string) => Promise<any>;
  export const getConfig: (params?: {
    service_type?: string;
    product_type?: string;
    zip_code?: string;
  }) => Promise<QuoteConfig>;
  export const formatCents: (cents: number | null | undefined) => string;
}

declare module "virtual:quoting/config" {
  /** Per-site display options passed to the integration in astro.config.mjs. */
  const config: {
    phones: { label: string; number: string }[];
    fallbackPrices: Record<number, number>;
  };
  export default config;
}
