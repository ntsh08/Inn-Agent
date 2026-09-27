/**
 * Approval cards.
 *
 * A gated tool call is turned into something a human can judge in about five
 * seconds. The model passes ids; the card resolves them back to names, prices
 * out the totals, and puts the number being committed where it cannot be missed.
 */

import {
  GST_RATE,
  QUOTES,
  arrivalDate,
  materialById,
  nextPoNumber,
  shortfall,
  vendorById,
  PROJECT,
  PURCHASE_ORDERS,
  type PurchaseOrder,
} from "./data";

export type QuestionsCard = {
  kind: "questions";
  questions: { question: string; options: string[] }[];
};

export type PlanCard = {
  kind: "plan";
  title: string;
  todos: string[];
};

export type PoLine = {
  material: string;
  quantity: string;
  rate: string;
  amount: string;
};

export type PoCard = {
  kind: "po";
  /** The number this PO will carry once issued — same formula `po_create` uses. */
  reference: string;
  vendor: string;
  vendorLocation?: string;
  vendorRating?: number;
  vendorOnTime?: number;
  /** One order can cover several materials from the same vendor. */
  items: PoLine[];
  subtotal: string;
  gst: string;
  total: string;
  deliverBy: string;
  /** When it was raised. Absent while it is still being drafted — that is today. */
  raisedOn?: string;
  /** Where an order on file stands. Absent for a draft the agent is proposing. */
  status?: "Draft" | "Issued" | "In Transit" | "Delivered";
  /** Days between delivery and the tightest need-by date. Negative means late. */
  floatDays?: number;
  deliverTo: string;
  neededFor?: string;
  justification: string;
  warning?: string;
};

export type Card =
  | QuestionsCard
  | PlanCard
  | PoCard
  | { kind: "generic"; title: string; rows: [string, string][] };

const inr = (n: number) =>
  "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n));

/** "₹395 per bag", "₹61,200 per tonne" — but counted items are "₹4 each". */
const rateLabel = (rate: number, unit?: string) =>
  !unit || unit === "nos" ? `${inr(rate)} each` : `${inr(rate)} per ${unit.replace(/s$/, "")}`;

const dayGap = (from: string, to: string) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);

const prettyDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/**
 * A purchase order already on file, as the same document the agent drafts.
 *
 * One shape for both, so an order does not look like a different thing
 * depending on whether you reached it from the conversation or from the list.
 * Float here is measured against the material's need-by date, exactly as it is
 * when the order is being raised.
 */
export function cardFromOrder(order: PurchaseOrder | PurchaseOrder[]): PoCard {
  // One PO is stored as one row per material; they share the PO number.
  const rows = Array.isArray(order) ? order : [order];
  const po = rows[0];
  const v = vendorById(po.vendorId);
  const lines = rows.map((r) => ({ r, m: materialById(r.materialId), amount: r.qty * r.rate }));
  const subtotal = lines.reduce((n, l) => n + l.amount, 0);
  const gst = subtotal * GST_RATE;

  // It arrives when its last line does, and has to beat the tightest need-by.
  const expectedOn = rows.map((r) => r.expectedOn).sort().at(-1) ?? po.expectedOn;
  const tightest = lines.map((l) => l.m?.neededBy).filter(Boolean).sort()[0] as string | undefined;
  const activities = Array.from(new Set(lines.map((l) => l.m?.activity).filter(Boolean)));

  return {
    kind: "po",
    reference: po.poNumber,
    vendor: v?.name ?? po.vendorId,
    vendorLocation: v?.location,
    vendorRating: v?.rating,
    vendorOnTime: v?.onTimePct,
    items: lines.map(({ r, m, amount }) => ({
      material: m ? `${m.name} — ${m.spec}` : r.materialId,
      quantity: `${new Intl.NumberFormat("en-IN").format(r.qty)} ${m?.unit ?? ""}`.trim(),
      rate: rateLabel(r.rate, m?.unit),
      amount: inr(amount),
    })),
    subtotal: inr(subtotal),
    gst: `${inr(gst)} (${Math.round(GST_RATE * 100)}%)`,
    total: inr(subtotal + gst),
    deliverBy: prettyDate(expectedOn),
    raisedOn: prettyDate(po.raisedOn),
    status: po.status,
    floatDays: tightest ? dayGap(expectedOn, tightest) : undefined,
    deliverTo: PROJECT.site,
    neededFor: activities.length === 1 ? (activities[0] as string) : undefined,
    justification: "",
  };
}

const shiftPo = (po: string, by: number) => {
  const n = Number(po.split("-").pop()) + by;
  return `${po.slice(0, po.lastIndexOf("-") + 1)}${String(n).padStart(4, "0")}`;
};

export function buildCard(
  toolName: string,
  args: any,
  offset = 0,
  orders: PurchaseOrder[] = PURCHASE_ORDERS,
): Card {
  if (toolName === "ask_user") {
    return {
      kind: "questions",
      questions: (args.questions ?? []).filter(
        (q: any) => q?.question && Array.isArray(q.options) && q.options.length,
      ),
    };
  }

  if (toolName === "po_create") {
    const v = vendorById(args.vendorId);
    const raw = (args.items ?? []) as { materialId: string; quantity: number; rate: number }[];
    const lines = raw.map((it) => {
      const m = materialById(it.materialId);
      return {
        m,
        amount: (it.rate ?? 0) * (it.quantity ?? 0),
        line: {
          material: m ? `${m.name} — ${m.spec}` : it.materialId,
          quantity: `${new Intl.NumberFormat("en-IN").format(it.quantity)} ${m?.unit ?? ""}`.trim(),
          rate: rateLabel(it.rate, m?.unit),
          amount: inr((it.rate ?? 0) * (it.quantity ?? 0)),
        },
      };
    });

    const subtotal = lines.reduce((n, l) => n + l.amount, 0);
    const gst = subtotal * GST_RATE;

    // Worked out from the quote, not taken from the model — left to the model
    // it sometimes copied the need-by date, and the card reported no float
    // when there were days to spare.
    const deliverBy: string | undefined =
      arrivalDate(args.vendorId, raw.map((it) => it.materialId)) ?? args.deliverBy;

    // The tightest need-by across the items is what the delivery date has to beat.
    const needBys = lines.map((l) => l.m?.neededBy).filter(Boolean) as string[];
    const tightest = needBys.sort()[0];

    // Flag anything the approver should catch even if the model missed it.
    let warning: string | undefined;
    if (tightest && deliverBy && deliverBy > tightest) {
      warning = `Delivery lands after the ${prettyDate(tightest)} need-by date.`;
    }

    const activities = Array.from(new Set(lines.map((l) => l.m?.activity).filter(Boolean)));

    return {
      kind: "po",
      // Several cards in one turn each preview their own number.
      reference: shiftPo(nextPoNumber(orders), offset),
      vendor: v?.name ?? args.vendorId,
      vendorLocation: v?.location,
      vendorRating: v?.rating,
      vendorOnTime: v?.onTimePct,
      items: lines.map((l) => l.line),
      subtotal: inr(subtotal),
      gst: `${inr(gst)} (${Math.round(GST_RATE * 100)}%)`,
      total: inr(subtotal + gst),
      deliverBy: deliverBy ? prettyDate(deliverBy) : "Date not quoted",
      floatDays: tightest && deliverBy ? dayGap(deliverBy, tightest) : undefined,
      deliverTo: PROJECT.site,
      neededFor: activities.length === 1 ? (activities[0] as string) : undefined,
      justification: args.justification ?? "",
      warning,
    };
  }

  return {
    kind: "generic",
    title: toolName,
    rows: Object.entries(args).map(([k, v]) => [k, String(v)] as [string, string]),
  };
}

/** What people call each material in a sentence. */
export const COMMON: Record<string, string> = {
  mat_opc53: "cement",
  mat_tmt16: "steel",
  mat_ply12: "plywood",
  mat_rmc30: "RMC",
  mat_bwire: "binding wire",
  mat_cover: "cover blocks",
};

const dayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

const count = (n: number) => new Intl.NumberFormat("en-IN").format(n);

const listOf = (parts: string[]) =>
  parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

/**
 * The line above the PO cards: what is short, and why each quantity.
 *
 * Written here rather than by the model, so it is always there and always
 * agrees with the cards under it — left to the model, the cards arrived with
 * no word on why 640 bags.
 */
export function orderContext(
  orders: { vendorId: string; items?: { materialId: string; quantity: number }[] }[],
  all: PurchaseOrder[],
): string {
  const exact: { text: string; vendorId: string }[] = [];
  // Phrased once we know whether they open the line or follow it.
  const other: ((first: boolean) => string)[] = [];

  for (const o of orders) {
    const vendor = vendorById(o.vendorId)?.name ?? o.vendorId;
    const vendors = vendor.endsWith("s") ? `${vendor}'` : `${vendor}'s`;

    for (const it of o.items ?? []) {
      const m = materialById(it.materialId);
      if (!m) continue;
      const name = COMMON[m.id] ?? m.name.toLowerCase();
      const units = (n: number) => `${count(n)} ${m.unit === "nos" ? name : m.unit}`;
      const amount = (n: number) => (m.unit === "nos" ? units(n) : `${units(n)} of ${name}`);
      const purpose = `for the ${m.activity.split(" — ").pop()} (needed ${dayMonth(m.neededBy)})`;
      const short = shortfall(m, all);
      const moq = QUOTES.find((q) => q.vendorId === o.vendorId && q.materialId === m.id)?.moq ?? 0;
      const Name = `${name[0].toUpperCase()}${name.slice(1)}`;
      const lead = (first: boolean) =>
        first ? `You're short ${amount(short)}` : `${Name} is short by ${units(short)}`;
      const its = (first: boolean) => (first ? "the" : "its");

      if (Math.abs(it.quantity - short) < 0.01) {
        exact.push({ text: `${amount(short)} ${purpose}`, vendorId: o.vendorId });
      } else if (short > 0 && moq > short && Math.abs(it.quantity - moq) < 0.01) {
        other.push((f) => `${lead(f)} ${purpose}, but ${vendors} minimum order is ${units(moq)}, so ${its(f)} PO is for ${units(it.quantity)}.`);
      } else if (short <= 0) {
        other.push((f) => `${Name} isn't short — ${its(f)} PO is for ${amount(it.quantity)}, as you asked.`);
      } else {
        other.push((f) => `${lead(f)} ${purpose}; ${its(f)} PO is for ${units(it.quantity)}, as you asked.`);
      }
    }
  }

  const lines: string[] = [];
  if (exact.length) {
    const many = new Set(exact.map((e) => e.vendorId)).size > 1;
    lines.push(
      `You're short ${listOf(exact.map((e) => e.text))}, so ${many ? "these POs cover" : "this PO covers"} exactly that.`,
    );
  }
  other.forEach((phrase, i) => lines.push(phrase(!exact.length && i === 0)));
  return lines.join(" ");
}
