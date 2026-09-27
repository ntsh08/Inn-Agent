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
  QUOTES,
  VENDORS,
  arrivalDate,
  available,
  daysUntil,
  inTransit,
  materialById,
  nextPoNumber,
  openOrders,
  shortfall,
  vendorById,
  type PurchaseOrder,
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
  run: (args: any, ctx: ToolContext) => unknown;
};

/**
 * What one request works on. The seeded orders plus the ones this browser has
 * raised — never shared memory, so one visitor's POs can't reach another and
 * nothing outlives the tab.
 */
export type ToolContext = { orders: PurchaseOrder[] };

/** Orders on the way for a material, the way the agent should name them. */
const onOrder = (materialId: string, orders: PurchaseOrder[]) =>
  openOrders(materialId, orders).map((o) => ({
    poNumber: o.poNumber,
    vendor: vendorById(o.vendorId)?.name,
    quantity: o.qty,
    arrives: o.expectedOn,
  }));

const obj = (props: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties: props,
  required,
  additionalProperties: false,
});

/**
 * What people on site actually call each material. The catalogue says "Ready
 * Mix Concrete (M30)"; the agent itself writes "RMC", and so do its follow-up
 * suggestions — a search that only knew the catalogue name failed on them.
 */
const ALIASES: Record<string, string[]> = {
  mat_opc53: ["opc", "cement"],
  mat_tmt16: ["steel", "rebar", "rebars", "tmt", "saria", "sariya", "reinforcement", "fe500"],
  mat_ply12: ["ply", "plywood", "shuttering", "formwork"],
  mat_rmc30: ["rmc", "readymix", "ready mix", "concrete", "m30"],
  mat_bwire: ["binding wire", "tie wire", "wire"],
  mat_cover: ["cover block", "cover blocks", "spacer", "spacers"],
};

// Words that say nothing about which material is meant.
const NOISE = new Set([
  "the", "a", "an", "of", "for", "and", "by", "to", "on", "in", "our", "we",
  "some", "grade", "mm", "bag", "bags", "cheapest", "vendor", "vendors",
  "supplier", "suppliers", "delivery", "rate", "rates", "price", "quote", "quotes",
]);

const words = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);

/**
 * Any meaningful word in the query can match — the name, the spec, or a site
 * alias — and the best match comes first. "M30 RMC", "rmc" and "ready mix"
 * all land on the same item.
 */
export function findMaterials(query: string) {
  // A date's day number is not a spec — "by 18 Sept" matched "18 SWG" wire.
  const undated = query.replace(
    /\b\d{1,2}(st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/gi,
    " ",
  );
  const q = words(undated).filter((w) => !NOISE.has(w));
  const joined = ` ${q.join(" ")} `;

  const scored = MATERIALS.map((m) => {
    const own = new Set(words(`${m.name} ${m.spec}`));
    const aliases = ALIASES[m.id] ?? [];
    let score = q.filter((w) => own.has(w)).length;
    for (const a of aliases) if (joined.includes(` ${a} `)) score += 2;
    return { m, score };
  }).filter((x) => x.score > 0);

  scored.sort((a, b) => b.score - a.score);
  return scored.map(({ m }) => ({ materialId: m.id, name: m.name, spec: m.spec, unit: m.unit }));
}

export const TOOLS: ToolDef[] = [
  // ---------------------------------------------------------------- reads
  {
    name: "shortfall_report",
    source: SOURCES.inventory,
    label: "Checking stock against the plan",
    short: "Checking stock",
    description: `Compare what the project plan requires against what is actually in stock, and return every material that falls short.

This is the right first call whenever the user asks what they are short on, what needs ordering, what is running low, or what to buy this week. It already does the stock lookup and the requirement lookup together — do NOT call stock_check first to answer a "what are we short on" question.

Returns \`short\`: one row per material that still needs ordering, with what the plan needs, what is on hand, what is reserved, what is already on the way (inTransit), the resulting shortfall, the need-by date and the activity driving it.

**shortfall is already net of inTransit** — it is what still needs ordering. Never subtract in-transit orders again, and never order the gross gap.

Also returns \`notShort\`: every other material, with what is on site and the orders on the way (onOrder). These are NOT shortfalls — never put them in a shortfall table, and don't mention them at all unless the user asks to order or asks about one of them. Then say in one line why it isn't needed.

Always mention the need-by date when you present these — a shortfall that is due in 5 days is a different problem from one due in 3 weeks, and the user needs to see which is which.`,
    parameters: obj({}),
    run: (_args: unknown, { orders }: ToolContext) => ({
      // Soonest need-by first — the order the table is read in.
      short: MATERIALS.filter((m) => shortfall(m, orders) > 0)
        .sort((a, b) => a.neededBy.localeCompare(b.neededBy))
        .map((m) => ({
          material: `${m.name} (${m.spec})`,
          materialId: m.id,
          required: m.required,
          inStock: m.inStock,
          reserved: m.reserved,
          available: available(m),
          inTransit: inTransit(m.id, orders),
          shortfall: shortfall(m, orders),
          unit: m.unit,
          neededBy: m.neededBy,
          daysRemaining: daysUntil(m.neededBy),
          drivenBy: m.activity,
        })),
      notShort: MATERIALS.filter((m) => shortfall(m, orders) <= 0).map((m) => ({
        material: `${m.name} (${m.spec})`,
        materialId: m.id,
        required: m.required,
        onSite: available(m),
        unit: m.unit,
        onOrder: onOrder(m.id, orders),
      })),
    }),
  },
  {
    name: "stock_check",
    source: SOURCES.inventory,
    label: "Checking site stock",
    short: "Checking stock",
    description: `Current stock position for ONE material at the project site: quantity on hand, quantity reserved against other activities, what is genuinely free to use, what is already on the way (inTransit, and the orders behind it in onOrder), and what still needs ordering (stillShort — already net of inTransit).

Use this when the user asks about a specific material's stock. For "what are we short on" across the whole project, use shortfall_report instead — it is one call rather than six.`,
    parameters: obj(
      { materialId: { type: "string", description: "Material id from shortfall_report or material_search." } },
      ["materialId"],
    ),
    run: ({ materialId }: { materialId: string }, { orders }: ToolContext) => {
      const m = materialById(materialId);
      if (!m) return { error: `No material with id ${materialId}` };
      return {
        material: `${m.name} (${m.spec})`,
        inStock: m.inStock,
        reserved: m.reserved,
        available: available(m),
        inTransit: inTransit(m.id, orders),
        onOrder: onOrder(m.id, orders),
        stillShort: shortfall(m, orders),
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
    run: ({ query }: { query: string }) => findMaterials(query),
  },
  {
    name: "vendor_search",
    label: "Finding vendors",
    short: "Finding vendors",
    description: `List vendors who supply a given material.

Returns rating (out of 5) and on-time delivery percentage — both are relevant when recommending between vendors.`,
    parameters: obj({ materialId: { type: "string" } }, ["materialId"]),
    run: ({ materialId }: { materialId: string }) =>
      VENDORS.filter((v) => v.supplies.includes(materialId)).map((v) => ({
        vendorId: v.id,
        name: v.name,
        rating: v.rating,
        onTimePct: v.onTimePct,
        location: v.location,
      })),
  },
  {
    name: "quote_compare",
    label: "Comparing quotes",
    short: "Comparing quotes",
    description: `Side-by-side comparison of live vendor quotes for one material: rate per unit, the date it would arrive (arrives) and whether that is before the need-by date (inTime), and minimum order quantity. Show the arrives date to the user, never the lead time in days.

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
            rating: v?.rating,
            onTimePct: v?.onTimePct,
            rate: q.rate,
            leadDays: q.leadDays,
            // Worked out here so the table shows a date, never "8 days".
            arrives: arrivalDate(q.vendorId, [materialId]),
            inTime: !!m && (arrivalDate(q.vendorId, [materialId]) ?? "") <= m.neededBy,
            moq: q.moq,
            meetsMoq: quantity >= q.moq,
            subtotal: Math.round(q.rate * quantity),
          };
        }),
      };
    },
  },
  {
    name: "rate_history",
    label: "Pulling past rates",
    short: "Checking past rates",
    description: `What this project last paid for a material, and to whom. Use it to sanity-check a quote before recommending it — a rate well above the last purchase is worth flagging to the user, and a rate below it is worth pointing out as a win.

Returns most recent first. Empty if the material has never been purchased.`,
    parameters: obj({ materialId: { type: "string" } }, ["materialId"]),
    // Read from the purchase orders themselves, so a past rate and the PO it
    // came from can never disagree.
    run: ({ materialId }: { materialId: string }, { orders }: ToolContext) =>
      orders.filter((o) => o.materialId === materialId)
        .sort((a, b) => b.raisedOn.localeCompare(a.raisedOn))
        .map((o) => ({
          vendor: vendorById(o.vendorId)?.name,
          rate: o.rate,
          qty: o.qty,
          orderedOn: o.raisedOn,
          poNumber: o.poNumber,
        })),
  },
  {
    name: "po_search",
    source: SOURCES.orders,
    label: "Checking open orders",
    short: "Checking orders",
    description: `List purchase orders on this project with their delivery status.

The shortfall from shortfall_report already takes these off — never subtract them again.`,
    parameters: obj({
      materialId: { type: "string", description: "Optional: filter to one material." },
    }),
    run: ({ materialId }: { materialId?: string }, { orders }: ToolContext) =>
      orders.filter((p) => !materialId || p.materialId === materialId).map((p) => {
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
    description: `Ask the user how they want to find a vendor, when they ask to find vendors for something, order it or raise a PO for it without naming a vendor. The interface shows it as a card with numbered options, a free-text row, and Skip.

Call it AFTER your lookups, once, with ONE question however many materials there are. Options, in order: reorder from the last vendor (named, with their current rate — leave out if never bought), "Compare vendors", "Raise a new REQ". Keep each option a short phrase, no ids.

Never use it to ask for permission — the purchase order card is the permission step.`,
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

  {
    name: "order_totals",
    label: "Adding up the orders",
    short: "Adding up",
    description: `Works out a vendor split: for each vendor and the materials they would supply, the quantity to order (the shortfall, raised to the vendor's minimum order where needed), the arrival date, and the total before GST.

Call this whenever you show a combination of vendors, and copy its numbers exactly. Never add up money yourself. Use its quantities when you raise the POs.`,
    parameters: obj(
      {
        groups: {
          type: "array",
          items: obj(
            {
              vendorId: { type: "string" },
              materialIds: { type: "array", items: { type: "string" } },
            },
            ["vendorId", "materialIds"],
          ),
        },
      },
      ["groups"],
    ),
    run: ({ groups }: { groups: { vendorId: string; materialIds: string[] }[] }, { orders }: ToolContext) => {
      const inr = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(Math.round(n))}`;
      const rows = (groups ?? []).map((g) => {
        const lines = g.materialIds.map((id) => {
          const m = materialById(id);
          const q = QUOTES.find((x) => x.vendorId === g.vendorId && x.materialId === id);
          const short = m ? shortfall(m, orders) : 0;
          const quantity = q ? Math.max(short, q.moq) : short;
          return {
            material: m ? `${m.name} (${m.spec})` : id,
            materialId: id,
            quantity,
            unit: m?.unit,
            roundedUpToMinimum: !!q && q.moq > short,
            rate: q?.rate ?? null,
            amount: q ? Math.round(q.rate * quantity) : null,
            noQuote: !q,
          };
        });
        const total = lines.reduce((n, l) => n + (l.amount ?? 0), 0);
        const arrives = arrivalDate(g.vendorId, g.materialIds);
        const needBy = g.materialIds.map((id) => materialById(id)?.neededBy).filter(Boolean).sort()[0];
        return {
          vendor: vendorById(g.vendorId)?.name ?? g.vendorId,
          vendorId: g.vendorId,
          lines,
          arrives,
          inTime: !!arrives && !!needBy && arrives <= needBy,
          totalBeforeGst: inr(total),
        };
      });
      return { rows };
    },
  },

  // --------------------------------------------------------- write (gated)
  {
    name: "po_create",
    label: "Raising the purchase order",
    short: "Raising PO",
    description: `Raise a purchase order. This commits the project to a spend, so it always goes to the user for approval before anything is issued.

Preconditions — satisfy ALL of these before calling:
- The user has named this vendor, after you showed them the vendors. Never pick the vendor for them.
- The quantity is at or above the vendor's MOQ.
- The lead time lands on or before the need-by date.

Pass the rate exactly as quoted. GST is added downstream — do not include it in the rate. Never invent a rate, a vendor or a PO number.

Several vendors → one call with one entry per vendor in \`orders\`. Never raise them in separate calls.

Do not ask for confirmation in chat before calling this. Each order shows as its own card, and the user raises or changes each one there.`,
    parameters: obj(
      {
        orders: {
          type: "array",
          description:
            "One entry per vendor. When the user has chosen several vendors, put every one of them here in this single call, so all the cards show together.",
          items: obj(
            {
              vendorId: { type: "string" },
              items: {
                type: "array",
                description:
                  "Every material being bought from this vendor. One order can carry several materials — do not split them when the same vendor supplies them all.",
                items: obj(
                  {
                    materialId: { type: "string" },
                    quantity: { type: "number" },
                    rate: { type: "number", description: "Per-unit rate, exactly as quoted. Excludes GST." },
                  },
                  ["materialId", "quantity", "rate"],
                ),
              },
              justification: {
                type: "string",
                description: "One sentence: why this vendor. Kept on the record, not shown on the card.",
              },
            },
            ["vendorId", "items", "justification"],
          ),
        },
      },
      ["orders"],
    ),
    requiresApproval: true,
    run: (args: any, { orders }: ToolContext) => {
      const lines = (args.items ?? []).map((it: any) => ({
        material: materialById(it.materialId),
        materialId: it.materialId,
        quantity: it.quantity,
        rate: it.rate,
        amount: Math.round(it.rate * it.quantity),
      }));
      const subtotal = lines.reduce((n: number, l: any) => n + l.amount, 0);
      const poNumber = nextPoNumber(orders);
      const deliverBy =
        arrivalDate(args.vendorId, lines.map((l: any) => l.materialId)) ?? args.deliverBy;
      // The store keeps one row per material; they share the PO number.
      for (const l of lines) {
        orders.push({
          id: `po_${orders.length + 1}`,
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
