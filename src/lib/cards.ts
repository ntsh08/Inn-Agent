/**
 * Approval cards.
 *
 * A gated tool call is turned into something a human can judge in about five
 * seconds. The model passes ids; the card resolves them back to names, prices
 * out the totals, and puts the number being committed where it cannot be missed.
 */

import { GST_RATE, PURCHASE_ORDERS, materialById, vendorById, PROJECT } from "./data";

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

const dayGap = (from: string, to: string) =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);

const prettyDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export function buildCard(toolName: string, args: any): Card {
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
          rate: `${inr(it.rate)} per ${m?.unit?.replace(/s$/, "") ?? "unit"}`,
          amount: inr((it.rate ?? 0) * (it.quantity ?? 0)),
        },
      };
    });

    const subtotal = lines.reduce((n, l) => n + l.amount, 0);
    const gst = subtotal * GST_RATE;

    // The tightest need-by across the items is what the delivery date has to beat.
    const needBys = lines.map((l) => l.m?.neededBy).filter(Boolean) as string[];
    const tightest = needBys.sort()[0];

    // Flag anything the approver should catch even if the model missed it.
    let warning: string | undefined;
    if (v && !v.approved) {
      warning = `${v.name} is not an approved vendor.`;
    } else if (tightest && args.deliverBy && args.deliverBy > tightest) {
      warning = `Delivery lands after the ${prettyDate(tightest)} need-by date.`;
    }

    const activities = Array.from(new Set(lines.map((l) => l.m?.activity).filter(Boolean)));

    return {
      kind: "po",
      reference: `PO-2026-${String(413 + PURCHASE_ORDERS.length - 2).padStart(4, "0")}`,
      vendor: v?.name ?? args.vendorId,
      vendorLocation: v?.location,
      vendorRating: v?.rating,
      vendorOnTime: v?.onTimePct,
      items: lines.map((l) => l.line),
      subtotal: inr(subtotal),
      gst: `${inr(gst)} (${Math.round(GST_RATE * 100)}%)`,
      total: inr(subtotal + gst),
      deliverBy: prettyDate(args.deliverBy),
      floatDays: tightest && args.deliverBy ? dayGap(args.deliverBy, tightest) : undefined,
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
