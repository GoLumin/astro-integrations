import sanitizeHtml from "sanitize-html";

/**
 * Sanitiser for rich text that arrives from an external system — CMS body
 * copy, gofuse reviews and FAQ answers. Everything is authored in a rich-text
 * editor, so the tag list covers formatting and links and nothing else: no
 * script, no style, no iframe, no event handlers.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "sub", "sup",
    "ul", "ol", "li", "blockquote", "a", "code", "pre", "span", "div",
    "h1", "h2", "h3", "h4", "h5", "h6", "hr", "table", "thead", "tbody",
    "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    "*": ["class"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  // Anything opening a new tab must not hand the opener a window reference.
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs:
        attribs.target === "_blank"
          ? { ...attribs, rel: "noopener noreferrer" }
          : attribs,
    }),
  },
};

export function sanitize(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}

/** Strips every tag — for values that land in an attribute or a plain slot. */
export function sanitizeToText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();
}
