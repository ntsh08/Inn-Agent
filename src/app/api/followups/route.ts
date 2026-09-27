/**
 * Follow-up suggestions.
 *
 * Reads the turn that just finished and offers the two or three things a buyer
 * would plausibly ask next. Same shape as the title route — one small
 * non-streaming call, no tools — and it fails to an empty list, because a
 * missing suggestion row costs nothing while a wrong one costs trust.
 */

import OpenAI from "openai";
import { NextRequest } from "next/server";
import { MATERIALS, PROJECT, VENDORS } from "@/lib/data";
import { COMMON } from "@/lib/cards";

export const runtime = "nodejs";
export const maxDuration = 15;

const MODEL = process.env.FOLLOWUP_MODEL ?? "gpt-5-mini";

const SYSTEM = `You suggest what a construction buyer would ask INA Procure next, given the turn that just finished.

INA Procure can: report shortfalls against the project plan, check stock for one material, find vendors, compare live quotes, look up what the project last paid, list purchase orders and their delivery status, and raise a purchase order for approval. It cannot approve payments, add vendors or contact anyone.

Rules:
- One or two suggestions, each the natural next step of the reply that just finished — what a buyer would do next with what they just learned, not an unrelated lookup. Give a second only when it is a genuinely different next step; one is often enough.
  After a shortfall list → the most urgent one first: "Find vendors for cement", then "Find vendors for all the short materials"
  After a purchase order is raised, with things still short → "Find vendors for plywood", "Find vendors for everything still short"; with nothing left short → "Which POs are still pending delivery?"
  After a vendor comparison of one material → one per vendor, recommended first: "Raise the PO for Deccan", "Raise the PO for Acme".
  After a comparison of several materials → only "Raise POs for the recommended vendors".
  Until the reply has compared vendors, the next step is finding one — never suggest raising a PO, and never name a vendor.
  After a delivery status → "Is the steel on the way enough?", "What are we still short on?"
- Never "order" or "buy". Before vendors are compared it is "Find vendors for …"; after a comparison it is "Raise the PO for <vendor>".
- Never ask for other, faster or cheaper vendors, and never suggest gathering quotes or raising a REQ. Never use the word "cheapest".
- Name the material or order the reply is about, and lead with the most urgent one. Never ask something the reply already answered.
- Write it the way a site engineer would type it to a colleague: one plain question or request, under 8 words, everyday names ("cement", not "Cement OPC 53 Grade"). No task labels ("Check stock for…", "List PO status"), no colons, no abbreviations.
- The only materials are ${MATERIALS.map((m) => m.name.toLowerCase()).join(", ")}. Call them by everyday names — cement, steel, plywood, RMC, binding wire, cover blocks — and never add a grade, size or spec ("18mm", "OPC 53", "BWR"). Never mention a material that isn't on this list.
- Never suggest anything outside the capabilities above.
- Only refer to things that exist. Never say "open", "view" or "approve" a purchase order unless the reply says one has been raised.
- Today is ${PROJECT.today}. Never name the project — the user is already in it.

Reply as a JSON array of 2 strings and nothing else.`;

export async function POST(req: NextRequest) {
  const { user, agent } = (await req.json().catch(() => ({}))) as {
    user?: string;
    agent?: string;
  };

  if (!agent?.trim() || !process.env.OPENAI_API_KEY) {
    return Response.json({ suggestions: [] });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `They asked: ${user?.slice(0, 400) ?? "(nothing)"}\n\nINA Procure replied: ${agent.slice(0, 1200)}`,
        },
      ],
      max_completion_tokens: 300,
      ...(MODEL.startsWith("gpt-5") ? { reasoning_effort: "minimal" as const } : {}),
      // A strict shape, so the answer can't come back as loose lines the
      // parser can't read — that left the row empty about a third of the time.
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "followups",
          strict: true,
          schema: {
            type: "object",
            properties: { suggestions: { type: "array", items: { type: "string" } } },
            required: ["suggestions"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    let suggestions = readSuggestions(raw);
    // The vendor is chosen on the question card, or from a comparison the user
    // has seen. Anywhere else, "Order the cement from Acme" skips that step, so
    // the vendor comes off in code rather than trusting the prompt.
    if (!agent.includes("★")) {
      // Without the vendor, "Raise the PO for Deccan" is a bare "Raise the
      // PO" — two of those showed side by side. Dropped, not shown.
      suggestions = suggestions.map(dropVendor).filter((x) => !BARE.test(x)).map(findFirst);
    }

    // Several materials compared: the one offer is the whole recommendation —
    // the reply asks "want me to raise POs with these vendors?" and this is
    // the yes. A single vendor's PO on its own isn't a useful second.
    if (PICKS.test(agent) || (agent.match(/★/g) ?? []).length > 1) suggestions = [RECOMMENDED];
    // After a shortage list: the most urgent material first — the reply offers
    // to find vendors for it, so that's the yes — then all of it.
    if (SHORTAGE_TABLE.test(agent) && tableRows(agent) > 1) suggestions = shortageFollowUps(suggestions, agent);

    // Specs don't belong in a suggestion either — "18mm BWR" plywood was made
    // up outright, and it isn't anything the project buys.
    suggestions = suggestions.map(dropSpecs).filter(Boolean);
    // The same pill twice says nothing.
    suggestions = suggestions.filter((x, i) => suggestions.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);

    return Response.json({ suggestions });
  } catch {
    return Response.json({ suggestions: [] });
  }
}

const VENDOR_WORDS = VENDORS.map((v) => v.name.split(" ")[0] === "Sri" ? "Sri Ganesh" : v.name.split(" ")[0]);
const VENDOR_TAIL = new RegExp(`\\s+(?:from|with|via|to|for)\\s+(?:${VENDOR_WORDS.join("|")})[^?]*`, "i");

function dropVendor(s: string) {
  return s.replace(VENDOR_TAIL, "").trim();
}

// No vendor picked yet, so the step is finding one, not raising a PO.
function findFirst(s: string) {
  return s.replace(/^raise (?:a |the )?POs? for /i, "Find vendors for ");
}

const BARE = /^raise (?:a |the )?pos?\.?$/i;
const PICKS = /\|\s*vendor\s*\|\s*supplies\s*\|/i;
const RECOMMENDED = "Raise POs for the recommended vendors";

const SHORTAGE_TABLE = /\|\s*material\s*\|\s*short by\s*\|/i;
const ALL_SHORT = "Find vendors for all the short materials";

/** Data rows in the reply's first table — "all the short materials" means nothing for one. */
function tableRows(agent: string) {
  const lines = agent.split("\n").map((l) => l.trim());
  const sep = lines.findIndex((l) => /^\|\s*:?-{3,}/.test(l));
  if (sep < 0) return 0;
  let n = 0;
  while (lines[sep + 1 + n]?.startsWith("|")) n++;
  return n;
}

/** The single most urgent material first, then all of it. */
function shortageFollowUps(suggestions: string[], agent: string) {
  const single = suggestions.find((s) => /^find vendors for /i.test(s) && !/\b(all|everything)\b/i.test(s));
  if (single) return [single, ALL_SHORT];
  // The table is sorted most urgent first; its first row names that one.
  const first = agent.match(/\|\s*:?-{3,}[^\n]*\n\|\s*([^|(]+)/)?.[1]?.trim();
  const everyday = first ? MATERIALS.find((m) => first.startsWith(m.name)) : undefined;
  return everyday ? [`Find vendors for ${COMMON[everyday.id] ?? everyday.name.toLowerCase()}`, ALL_SHORT] : [ALL_SHORT];
}

const SPEC = /\([^)]*\)|\b(?:OPC\s?\d+(?:\s?grade)?|Fe\s?\d+D?|\d+\s?mm|M\d{2}|\d+\s?SWG|BWR|PVC|film-faced|grade)\b/gi;

function dropSpecs(s: string) {
  return s
    .replace(SPEC, "")
    .replace(/\s*[—–-]\s*(?=$|\?)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([?.,])/g, "$1")
    .trim();
}

/**
 * The two suggestions out of whatever came back — the strict object, a bare
 * array, or, failing both, one per line. Long ones are trimmed at a word
 * rather than dropped: dropping a 69-character suggestion left a single pill.
 */
function readSuggestions(raw: string): string[] {
  let list: unknown = null;
  try {
    const parsed = JSON.parse(raw);
    list = Array.isArray(parsed) ? parsed : parsed?.suggestions;
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    try {
      list = match ? JSON.parse(match[0]) : null;
    } catch {
      list = null;
    }
  }
  if (!Array.isArray(list)) list = raw.split("\n");

  return (list as unknown[])
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim().replace(/^[-*\d.)\s]+/, "").replace(/^["']|["']$/g, ""))
    .filter(Boolean)
    .map((x) => (x.length <= 70 ? x : x.slice(0, x.lastIndexOf(" ", 67)).replace(/[,;:]$/, "") + "…"))
    .slice(0, 2);
}
