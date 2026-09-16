/**
 * Where an answer's facts came from.
 *
 * One registry, shared three ways: the tools tag their own output with it, the
 * system prompt lists the keys so the model can cite them, and the client maps
 * a citation back to a page link. Adding a source means adding it here once.
 */

export type Source = {
  label: string;
  page: string;
  /** The one record the answer rests on, when it rests on one. */
  record?: string;
};

export const SOURCES = {
  inventory: { label: "Inventory", page: "/inventory" },
  catalogue: { label: "Material catalogue", page: "/catalogue" },
  vendors: { label: "Approved vendors", page: "/vendors" },
  quotes: { label: "Vendor quotes", page: "/quotes" },
  orders: { label: "Purchase orders", page: "/orders" },
} as const satisfies Record<string, Source>;

export type SourceKey = keyof typeof SOURCES;

export const SOURCE_KEYS = Object.keys(SOURCES) as SourceKey[];

/**
 * The tag the model closes a reply with.
 *
 * A key on its own cites the whole page; `key:record` cites the one row the
 * answer is actually about — `<sources>orders:PO-2026-0412</sources>`.
 */
const TAG = /<sources>([\s\S]*?)<\/sources>/i;

// Mid-stream the tag arrives a character at a time, so the tail has to go the
// moment it starts looking like one — otherwise the reader watches "<sourc"
// type itself out under the answer.
const PARTIAL = /<\/?s(o(u(r(c(e(s(>[^<]*)?)?)?)?)?)?)?$/i;

/**
 * Splits a reply into what the user reads and what it cites.
 *
 * An absent or unrecognisable tag yields no citations rather than an error —
 * the caller falls back to the tools that ran, which is what happened before
 * the model was asked to cite anything.
 */
export function parseSources(text: string): { body: string; sources: Source[] } {
  const match = text.match(TAG);
  const body = (match ? text.replace(TAG, "") : text.replace(PARTIAL, "")).trimEnd();

  if (!match) return { body, sources: [] };

  const seen = new Map<string, Source>();
  for (const raw of match[1].split(",")) {
    const [rawKey, ...rest] = raw.trim().split(":");
    const key = rawKey.trim().toLowerCase();
    if (!(key in SOURCES)) continue;

    const base = SOURCES[key as SourceKey];
    const record = rest.join(":").trim();
    const source: Source = record
      ? { ...base, record, page: `${base.page}/${slug(record)}` }
      : base;

    seen.set(source.page, source);
  }

  // A record citation is more specific than the register it sits in, so the
  // bare register drops out when a record from it is also cited: "Purchase
  // orders" next to "PO-2026-0412" says nothing the second one does not.
  const detailed = new Set(
    Array.from(seen.values(), (s) => (s.record ? s.label : null)).filter(Boolean),
  );

  return {
    body,
    sources: Array.from(seen.values()).filter((s) => s.record || !detailed.has(s.label)),
  };
}

/**
 * A record name as a URL segment — "PO-2026-0412", "acme-building-materials".
 *
 * Exported because the section pages anchor their rows with it: a citation
 * that slugs differently from the page it points at lands nowhere, silently.
 */
export function slug(record: string) {
  return record
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
