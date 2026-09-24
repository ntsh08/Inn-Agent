/**
 * Tool registry.
 *
 * Mirrors the INA pattern: every tool carries a prose description that teaches
 * the model when to call it and what goes wrong if it calls it wrong. Domain
 * guidance lives next to the tool, not buried in the system prompt.
 *
 * `requiresApproval: true` is the whole HITL mechanism — the server stops the
 * loop before executing one of these and hands the client a confirmation card.
 * Reads run freely; anything that commits money or changes a record does not.
 */

import {
  GST_RATE,
  MATERIALS,
  PROJECT,
  PURCHASE_ORDERS,
  QUOTES,
  RATE_HISTORY,
  VENDORS,
  arrivalDate,
  available,
  daysUntil,
  materialById,
  shortfall,
  vendorById,
} from "./data";
import { SKILLS, SKILL_BY_NAME } from "./skills";
import { SOURCES, type Source } from "./sources";

export type ToolDef = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  requiresApproval?: boolean;
  /** Human label shown on the tool chip while it runs. */
  label: string;
  /** Two-or-three word form for the shimmering header. */
  short: string;
  /** Gated tool whose 'decision' is the user's answers rather than approve/reject. */
  collectsAnswers?: boolean;
  /** Where this tool's data comes from. Cited under any answer built on it. */
  source?: Source;
  run: (args: any) => unknown;
};

const obj = (props: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties: props,
  required,
  additionalProperties: false,
});

export const TOOLS: ToolDef[] = [
  // ---------------------------------------------------------------- reads
  {
    name: "shortfall_report",
    source: SOURCES.inventory,
    label: "Checking stock against the plan",
    short: "Checking stock",
    description: `Compare what the project plan requires against what is actually in stock, and return every material that falls short.

This is the right first call whenever the user asks what they are short on, what needs ordering, what is running low, or what to buy this week. It already does the stock lookup and the requirement lookup together — do NOT call stock_check first to answer a "what are we short on" question.

Returns one row per material with: what the plan needs, what is on hand, what is already reserved, the resulting shortfall, the date it is needed by, and the activity driving the requirement. Materials with enough stock are excluded.

Always mention the need-by date when you present these — a shortfall that is due in 5 days is a different problem from one due in 3 weeks, and the user needs to see which is which.`,
    parameters: obj({}),
    run: () =>
      MATERIALS.filter((m) => shortfall(m) > 0).map((m) => ({
        material: `${m.name} (${m.spec})`,
        materialId: m.id,
        required: m.required,
        inStock: m.inStock,
        reserved: m.reserved,
        available: available(m),
        shortfall: shortfall(m),
        unit: m.unit,
        neededBy: m.neededBy,
        daysRemaining: daysUntil(m.neededBy),
        drivenBy: m.activity,
      })),
  },
  {
    name: "stock_check",
    source: SOURCES.inventory,
    label: "Checking site stock",
    short: "Checking stock",
    description: `Current stock position for ONE material at the project site: quantity on hand, quantity reserved against other activities, and what is genuinely free to use.

Use this when the user asks about a specific material's stock. For "what are we short on" across the whole project, use shortfall_report instead — it is one call rather than six.`,
    parameters: obj(
      { materialId: { type: "string", description: "Material id from shortfall_report or material_search." } },
      ["materialId"],
    ),
    run: ({ materialId }: { materialId: string }) => {
      const m = materialById(materialId);
      if (!m) return { error: `No material with id ${materialId}` };
      return {
        material: `${m.name} (${m.spec})`,
        inStock: m.inStock,
        reserved: m.reserved,
        available: available(m),
        unit: m.unit,
        site: PROJECT.site,
      };
    },
  },
  {
    name: "material_search",
    label: "Looking up the catalogue",
    short: "Checking catalogue",
    description: `Resolve a free-text material name to a catalogue item. Users say "cement" or "steel"; the catalogue holds "OPC 53 Grade" and "Fe 500D 16mm".

Call this before any tool that takes a materialId when all you have is a name the user typed. Returns matches with their id, full spec and unit.`,
    parameters: obj(
      { query: { type: "string", description: 'Free text, e.g. "cement", "steel", "plywood".' } },
      ["query"],
    ),
    run: ({ query }: { query: string }) => {
      const q = query.toLowerCase();
      return MATERIALS.filter(
        (m) => m.name.toLowerCase().includes(q) || m.spec.toLowerCase().includes(q),
      ).map((m) => ({ materialId: m.id, name: m.name, spec: m.spec, unit: m.unit }));
    },
  },
  {
    name: "vendor_search",
    label: "Finding approved vendors",
    short: "Finding vendors",
    description: `List vendors who supply a given material.

IMPORTANT: only vendors with approved=true may be used on a purchase order. Unapproved vendors are returned so you can see they exist, but you must never put one on a PO, and you must never offer to approve one — vendor approval is an admin function outside your scope. If the user asks you to use an unapproved vendor, explain that it needs to go through vendor onboarding first.

Returns rating (out of 5) and on-time delivery percentage — both are relevant when recommending between vendors.`,
    parameters: obj({ materialId: { type: "string" } }, ["materialId"]),
    run: ({ materialId }: { materialId: string }) =>
      VENDORS.filter((v) => v.supplies.includes(materialId)).map((v) => ({
        vendorId: v.id,
        name: v.name,
        approved: v.approved,
        rating: v.rating,
        onTimePct: v.onTimePct,
        location: v.location,
      })),
  },
  {
    name: "quote_compare",
    label: "Comparing quotes",
    short: "Comparing quotes",
    description: `Side-by-side comparison of live vendor quotes for one material: rate per unit, lead time in days, minimum order quantity, and quote validity.

This is the tool that produces the comparison the user actually decides on, so call it before recommending a vendor. Compute the landed cost yourself from rate x quantity.

CRITICAL — lead time is not a tiebreaker, it is a constraint. Compare each vendor's leadDays against the days remaining until the material is needed. A cheaper vendor that arrives after the need-by date is not an option, and you must say so explicitly rather than listing it as a cheaper alternative. Also check the quantity against moq (minimum order quantity).

Present all viable options with the tradeoff visible, recommend one, and give the reason in one sentence. Do not silently drop an option — the user decides, you advise.`,
    parameters: obj(
      {
        materialId: { type: "string" },
        quantity: { type: "number", description: "Quantity being bought, to check against MOQ and cost out each quote." },
      },
      ["materialId", "quantity"],
    ),
    run: ({ materialId, quantity }: { materialId: string; quantity: number }) => {
      const m = materialById(materialId);
      return {
        material: m ? `${m.name} (${m.spec})` : materialId,
        quantity,
        unit: m?.unit,
        neededBy: m?.neededBy,
        daysRemaining: m ? daysUntil(m.neededBy) : null,
        quotes: QUOTES.filter((q) => q.materialId === materialId).map((q) => {
          const v = vendorById(q.vendorId);
          return {
            vendorId: q.vendorId,
            vendor: v?.name,
            approved: v?.approved,
            rating: v?.rating,
            onTimePct: v?.onTimePct,
            rate: q.rate,
            leadDays: q.leadDays,
            moq: q.moq,
            meetsMoq: quantity >= q.moq,
            subtotal: Math.round(q.rate * quantity),
            validTill: q.validTill,
          };
        }),
      };
    },
  },
  {
    name: "rate_history",
    source: SOURCES.orders,
    label: "Pulling past rates",
    short: "Checking past rates",
    description: `What this project last paid for a material, and to whom. Use it to sanity-check a quote before recommending it — a rate well above the last purchase is worth flagging to the user, and a rate below it is worth pointing out as a win.

Returns most recent first. Empty if the material has never been purchased.`,
    parameters: obj({ materialId: { type: "string" } }, ["materialId"]),
    run: ({ materialId }: { materialId: string }) =>
      RATE_HISTORY.filter((r) => r.materialId === materialId)
        .sort((a, b) => b.orderedOn.localeCompare(a.orderedOn))
        .map((r) => ({
          vendor: vendorById(r.vendorId)?.name,
          rate: r.rate,
          qty: r.qty,
          orderedOn: r.orderedOn,
        })),
  },
  {
    name: "po_search",
    source: SOURCES.orders,
    label: "Checking open orders",
    short: "Checking orders",
    description: `List purchase orders on this project with their delivery status.

Worth calling before raising a new PO for a material — there may already be one in transit that covers the shortfall, in which case the right answer is "you already have 18 tonnes arriving on the 15th" rather than a new order.`,
    parameters: obj({
      materialId: { type: "string", description: "Optional: filter to one material." },
    }),
    run: ({ materialId }: { materialId?: string }) =>
      PURCHASE_ORDERS.filter((p) => !materialId || p.materialId === materialId).map((p) => {
        const m = materialById(p.materialId);
        return {
          poNumber: p.poNumber,
          vendor: vendorById(p.vendorId)?.name,
          material: m ? `${m.name} (${m.spec})` : p.materialId,
          qty: p.qty,
          unit: m?.unit,
          status: p.status,
          expectedOn: p.expectedOn,
        };
      }),
  },

  {
    name: "load_skill",
    label: "Loading skill",
    short: "Loading skill",
    description: `Load the full instructions for a named skill. Call this BEFORE acting on any request that matches a skill listed in <available_skills>. What it returns is authoritative — follow it over your own general approach.`,
    parameters: obj({ name: { type: "string", description: "Exact skill name, e.g. 'buy-materials'." } }, ["name"]),
    run: ({ name }: { name: string }) => {
      const skill = SKILL_BY_NAME[name];
      if (!skill) {
        return { error: `Unknown skill '${name}'. Available: ${SKILLS.map((s) => s.name).join(", ")}` };
      }
      return { name: skill.name, instructions: skill.body };
    },
  },

  // ------------------------------------------- clarifying questions (gated)
  {
    name: "ask_user",
    label: "Asking you a couple of questions",
    short: "Asking you",
    description: `Ask the user the one or two choices only they can make, BEFORE raising a purchase order. The interface shows each question as a card with numbered options, a free-text "Something else" row, and Skip.

Call this AFTER your read tools and BEFORE \`po_create\`. By the time you ask, you must already know the material, spec, shortfall quantity, need-by date and the live quotes — the questions are about what the user WANTS, never about facts you could look up yourself.

Ask exactly ONE question — how to source what they need — however many materials are involved. It has two options:

1. Reorder from the vendor used last, named inline with the rate and date from \`rate_history\`.
2. "Raise a new REQ", always last and in those words.

Never ask one question per material: four shortfalls is still one question. Never offer "compare all approved vendors" — a REQ is how fresh quotes get gathered.

Never use this to ask for permission — the purchase order card is the permission step.`,
    parameters: obj(
      {
        questions: {
          type: "array",
          description: "One to three questions, asked in order.",
          items: obj(
            {
              question: {
                type: "string",
                description: "The question, as the user reads it. Keep it to one short line.",
              },
              options: {
                type: "array",
                description: "Two to five answers to choose from. Name vendors, rates and dates in full — the user decides from this text alone.",
                items: { type: "string" },
              },
            },
            ["question", "options"],
          ),
        },
      },
      ["questions"],
    ),
    requiresApproval: true,
    collectsAnswers: true,
    // The answers come back from the user, so there is nothing to run here.
    run: () => ({ ok: true }),
  },

  // --------------------------------------------------------- write (gated)
  {
    name: "po_create",
    label: "Raising the purchase order",
    short: "Raising PO",
    description: `Raise a purchase order against an approved vendor. This commits the project to a spend, so it always goes to the user for approval before anything is issued.

Preconditions — satisfy ALL of these before calling:
- The vendor is approved (vendor_search returns approved=true).
- You have compared quotes and can state why this vendor over the others.
- The quantity is at or above the vendor's MOQ.
- The lead time lands on or before the need-by date.

Pass the rate exactly as quoted. GST is added downstream — do not include it in the rate. Never invent a rate, a vendor or a PO number.

Do not ask for confirmation in chat before calling this. The approval card shows the vendor, the amount and the delivery date, and the user approves or rejects there.`,
    parameters: obj(
      {
        vendorId: { type: "string" },
        items: {
          type: "array",
          description:
            "Every material being bought from this vendor on this order. One order can carry several materials — do not split them into separate POs when the same vendor supplies them all.",
          items: obj(
            {
              materialId: { type: "string" },
              quantity: { type: "number" },
              rate: { type: "number", description: "Per-unit rate, exactly as quoted. Excludes GST." },
            },
            ["materialId", "quantity", "rate"],
          ),
        },
        deliverBy: {
          type: "string",
          description:
            "YYYY-MM-DD. Only used when this vendor has no live quote for an item. Otherwise it is ignored: the arrival date is calculated from today plus the quoted lead time.",
        },
        justification: {
          type: "string",
          description:
            "One sentence the approver will read: why this vendor over the alternatives. The card already shows the delivery date and how much float it leaves, so do not restate either — spend the sentence on what the alternatives cost or when they would have landed.",
        },
      },
      ["vendorId", "items", "justification"],
    ),
    requiresApproval: true,
    run: (args: any) => {
      const lines = (args.items ?? []).map((it: any) => ({
        material: materialById(it.materialId),
        materialId: it.materialId,
        quantity: it.quantity,
        rate: it.rate,
        amount: Math.round(it.rate * it.quantity),
      }));
      const subtotal = lines.reduce((n: number, l: any) => n + l.amount, 0);
      const poNumber = `PO-2026-${String(413 + PURCHASE_ORDERS.length - 2).padStart(4, "0")}`;
      const deliverBy =
        arrivalDate(args.vendorId, lines.map((l: any) => l.materialId)) ?? args.deliverBy;
      // The store keeps one row per material; they share the PO number.
      for (const l of lines) {
        PURCHASE_ORDERS.push({
          id: `po_${PURCHASE_ORDERS.length + 1}`,
          poNumber,
          vendorId: args.vendorId,
          materialId: l.materialId,
          qty: l.quantity,
          rate: l.rate,
          status: "Issued",
          raisedOn: PROJECT.today,
          expectedOn: deliverBy,
        });
      }
      return {
        ok: true,
        poNumber,
        vendor: vendorById(args.vendorId)?.name,
        items: lines.map((l: any) => ({
          material: l.material ? `${l.material.name} (${l.material.spec})` : l.materialId,
          quantity: l.quantity,
          unit: l.material?.unit,
          rate: l.rate,
          amount: l.amount,
        })),
        subtotal,
        gst: Math.round(subtotal * GST_RATE),
        total: Math.round(subtotal * (1 + GST_RATE)),
        deliverBy,
        status: "Issued",
      };
    },
  },
];

export const TOOL_BY_NAME = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

/** OpenAI function-tool schema for the model. */
export const OPENAI_TOOLS = TOOLS.map((t) => ({
  type: "function" as const,
  function: { name: t.name, description: t.description, parameters: t.parameters },
}));
