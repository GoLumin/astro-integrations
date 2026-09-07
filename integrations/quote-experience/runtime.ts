/**
 * Runtime client for the gofuse headless Quoting API (/api/v1/quoting).
 *
 * Factory-style so the integration can bake the per-site base URL and Bearer
 * token in at build time via the `virtual:quoting` module — mirror of the
 * getoutsend/turnstile runtime pattern. Keep the token SERVER-SIDE: only
 * import `virtual:quoting` from actions, API routes, or .astro frontmatter,
 * never from a client component.
 */

export interface QuotingClientConfig {
  /** gofuse host, e.g. "https://miboxvermont.gofuse.app". */
  baseUrl: string;
  /** Site-scoped `fuse_…` API key with API mode enabled. */
  token: string | undefined;
}

export interface QuoteParams {
  service_type: string;
  product_type?: string;
  zip_code?: string;
  destination_zip_code?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  delivery_date?: string;
  form_slug?: string;
  /** { "<productId>": quantity } — omit to let the API default the first product to 1. */
  quantities?: Record<string, number>;
  /** Set on create() to make retries idempotent. */
  idempotency_key?: string;
}

export interface QuoteProductLine {
  id: number;
  name: string;
  quantity: number;
  price: number; // cents (original unit price)
  subtotal: number; // cents (line total at the discounted price)
  has_discount: boolean;
  original_price: number; // cents
  discounted_price: number; // cents
  weekly: boolean;
  monthly: boolean;
}

export interface QuoteFeeLine {
  name: string;
  amount: number; // cents
  per_quantity: boolean;
  excluded_from_total: boolean;
  starting_at: boolean;
  /** Monthly recurring charge — group under "Monthly recurring", not transit. */
  recurring: boolean;
}

export interface QuoteSettings {
  name?: string;
  logo_url?: string;
  phone?: string;
  /** Phone specific to the ZIP's service location (absent when it has none). */
  location_phone?: string;
  call_now_label?: string;
  top_rated_label?: string;
  product_price_label?: string;
  fees_price_label?: string;
  total_price_label?: string;
  discount_badge_label?: string;
  copy_before_product_price?: string;
  total_qualifying_text?: string;
  what_happens_next?: string;
  book_now_button_text?: string;
  book_now_button_link?: string;
  show_pricing_breakdown?: boolean;
  primary_color?: string;
  secondary_color?: string;
}

export interface CatalogProduct {
  id: number;
  name: string;
  price: number; // cents
  discounted_price: number; // cents
  image_url?: string;
  dimensions?: string;
  ideal_for: string[];
  product_type?: string;
  product_type_name?: string;
  service_types: string[];
  for_sale: boolean;
  monthly: boolean;
  discount?: { name: string; label: string };
}

export interface QuoteReview {
  name: string;
  title?: string;
  content?: string; // HTML
  avatar_url?: string;
}

export interface QuoteFaq {
  question: string;
  answer?: string; // HTML
}

export interface QuoteConfig {
  settings: QuoteSettings;
  service_types: { slug: string; name: string }[];
  product_types: { slug: string; name: string }[];
  products: CatalogProduct[];
  reviews: QuoteReview[];
  faqs: QuoteFaq[];
}

/** Response shape of POST /api/v1/quoting/preview (data envelope unwrapped). */
export interface QuotePreview {
  products: QuoteProductLine[];
  fees: QuoteFeeLine[];
  subtotal: number; // cents
  total: number; // cents
  total_discount: number; // cents
  fees_total: number; // cents
  total_quantity: number;
  delivery_address?: string;
  relo_address?: string;
  out_of_area_zip_text?: string;
}

export function createQuotingClient(config: QuotingClientConfig) {
  const baseUrl = config.baseUrl.replace(/\/$/, "");

  function authHeaders(): Record<string, string> {
    if (!config.token) {
      throw new Error(
        "Missing Quoting API token — set it in your environment or pass it to the quote-experience integration.",
      );
    }
    return { Accept: "application/json", Authorization: `Bearer ${config.token}` };
  }

  // Every quoting endpoint answers { data: ... } on success and { error } or
  // { message } on failure, so unwrap one level when it is there.
  interface Envelope {
    data?: unknown;
    error?: string;
    message?: string;
  }

  async function unwrap<T>(res: Response): Promise<T> {
    const json = (await res.json().catch(() => ({}))) as Envelope;
    if (!res.ok) {
      throw new Error(json?.error || json?.message || `Quoting API ${res.status}`);
    }
    return (json?.data ?? json) as T;
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    return unwrap<T>(res);
  }

  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, { headers: authHeaders() });
    return unwrap<T>(res);
  }

  return {
    /** Stateless pricing — calculates a quote, persists nothing. */
    previewQuote(params: QuoteParams): Promise<QuotePreview> {
      return post<QuotePreview>("/api/v1/quoting/preview", params);
    },

    /** Calculate + persist a quote; returns the full stored quote (incl. uuid). */
    createQuote(params: QuoteParams): Promise<any> {
      return post<any>("/api/v1/quoting/quotes", params);
    },

    /** Fetch a stored quote by uuid (persisted earlier via createQuote). */
    getQuote(uuid: string): Promise<any> {
      return get<any>(`/api/v1/quoting/quotes/${encodeURIComponent(uuid)}`);
    },

    /** Fetch a form definition (schema + pricing metadata). */
    getForm(slug: string): Promise<any> {
      return get<any>(`/api/v1/quoting/forms/${encodeURIComponent(slug)}`);
    },

    /**
     * Site config for the quote page: display settings, product catalog (with
     * images/dimensions/ideal-for/discounts), reviews, and FAQs.
     */
    getConfig(
      params: { service_type?: string; product_type?: string; zip_code?: string } = {},
    ): Promise<QuoteConfig> {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v) as [string, string][],
      ).toString();
      return get<QuoteConfig>(`/api/v1/quoting/config${qs ? `?${qs}` : ""}`);
    },
  };
}

export type QuotingClient = ReturnType<typeof createQuotingClient>;

/** Format integer cents as USD (e.g. 12345 -> "$123.45", 12000 -> "$120"). */
export function formatCents(cents: number | null | undefined): string {
  const value = (cents ?? 0) / 100;
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
