/**
 * The "how do you want to find a vendor?" card, built by the app.
 *
 * Asking to find vendors, raise a PO or order something — without naming a
 * vendor — always opens with this card. Left to the model it sometimes went
 * straight to the vendor table, and the card never showed.
 */

import { MATERIALS, QUOTES, VENDORS, shortfall, vendorById, type PurchaseOrder } from "./data";
import { COMMON } from "./cards";
import { findMaterials } from "./tools";

// Words in vendor names that don't tell one vendor from another.
const GENERIC = new Set(["building", "materials", "cements", "traders", "industries", "steel", "alloys", "ltd", "&"]);

/** "Acme", "Sri Ganesh", "SteelCo" — the name people use. */
export const vendorShortName = (name: string) =>
  name
    .split(" ")
    .filter((w) => !GENERIC.has(w.toLowerCase()))
    .join(" ");

// Words that name a vendor in a message: "acme", "ganesh", "steelco"…
const VENDOR_WORDS = VENDORS.flatMap((v) =>
  vendorShortName(v.name)
    .split(" ")
    .filter((w) => w.length > 3)
    .map((w) => w.toLowerCase()),
);

const COURTESY = /^(?:\s*(?:please|pls|ok|okay|so|now|can you|could you|let'?s|go ahead and)[,\s]+)+/i;
const ASKS = /^(?:(?:find|get|show)(?:\s+me)?\s+(?:the\s+)?vendors?\s+for|order|buy|raise\s+(?:a\s+|the\s+)?pos?\s+for)\b/i;
const EVERYTHING = /\b(?:everything|all)\b/i;

const count = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const PER: Record<string, string> = { bags: "bag", sheets: "sheet", tonnes: "tonne", "cu.m": "cu.m", kg: "kg" };
const listOf = (parts: string[]) =>
  parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

type Material = (typeof MATERIALS)[number];
type Reorder = { m: Material; vendorId: string; vendor: string; rate: number };

/**
 * What a "find vendors for…" message is asking about: the short materials it
 * names, and for each the vendor we last bought it from, at today's quote.
 * Null when it isn't that kind of message, or names a vendor already.
 */
function analyse(text: string, orders: PurchaseOrder[]) {
  const ask = text.trim().replace(COURTESY, "");
  if (!ASKS.test(ask) || /\bcompare\b/i.test(ask)) return null;

  // A named vendor means the choice is made — that goes straight to the PO.
  const words = ask.toLowerCase().split(/[^a-z]+/);
  if (VENDOR_WORDS.some((w) => words.includes(w))) return null;

  const short = MATERIALS.filter((m) => shortfall(m, orders) > 0);
  let wanted = short;
  if (!EVERYTHING.test(ask)) {
    const named = findMaterials(ask).map((r) => MATERIALS.find((m) => m.id === r.materialId)!);
    // Something asked for that isn't short gets the agent's own answer —
    // which order covers it — rather than a card.
    if (!named.length || named.some((m) => !short.includes(m))) return null;
    wanted = named;
  }
  if (!wanted.length) return null;
  // Soonest first, the same order as the shortage table.
  wanted = [...wanted].sort((a, b) => a.neededBy.localeCompare(b.neededBy));

  const reorders = wanted
    .map((m): Reorder | null => {
      const last = orders
        .filter((o) => o.materialId === m.id)
        .sort((a, b) => b.raisedOn.localeCompare(a.raisedOn))[0];
      const quote = last && QUOTES.find((q) => q.vendorId === last.vendorId && q.materialId === m.id);
      return last && quote
        ? { m, vendorId: last.vendorId, vendor: vendorShortName(vendorById(last.vendorId)?.name ?? ""), rate: quote.rate }
        : null;
    })
    .filter((r): r is Reorder => !!r);

  return { wanted, reorders };
}

export function sourcingQuestion(text: string, orders: PurchaseOrder[]) {
  const found = analyse(text, orders);
  if (!found) return null;
  const { wanted, reorders } = found;

  // Reorder only for one material, where the option can say who and at what
  // rate. Across several, one "reorder from our last vendors" line can't show
  // which vendor gets which material — agreeing to it would be blind.
  const options: string[] = [];
  if (wanted.length === 1 && reorders.length === 1) {
    const { vendor, rate, m } = reorders[0];
    options.push(`Reorder from ${vendor}, our last vendor (₹${count(rate)}${m.unit === "nos" ? " each" : `/${PER[m.unit] ?? m.unit}`})`);
  }
  options.push("Compare vendors", "Raise a new REQ");

  const name = (m: Material) => COMMON[m.id] ?? m.name.toLowerCase();
  const question =
    wanted.length === 1
      ? `How do you want to find a vendor for ${count(shortfall(wanted[0], orders))} ${
          wanted[0].unit === "nos" ? name(wanted[0]) : `${wanted[0].unit} of ${name(wanted[0])}`
        }?`
      : `How do you want to find vendors for the ${listOf(wanted.map(name))}?`;

  return { question, options };
}

/**
 * The POs for "Reorder from our last vendor": one per vendor, the shortfall
 * at today's quote. Null when some material has no last vendor — the agent
 * then shows vendors for those.
 */
export function reorderPlan(text: string, orders: PurchaseOrder[]) {
  const found = analyse(text, orders);
  if (!found || found.reorders.length !== found.wanted.length) return null;
  const byVendor = new Map<string, Reorder[]>();
  for (const r of found.reorders) byVendor.set(r.vendorId, [...(byVendor.get(r.vendorId) ?? []), r]);
  return Array.from(byVendor, ([vendorId, rs]) => ({
    vendorId,
    items: rs.map((r) => ({ materialId: r.m.id, quantity: shortfall(r.m, orders), rate: r.rate })),
    justification: "Reorder from the vendor we last bought this from.",
  }));
}
