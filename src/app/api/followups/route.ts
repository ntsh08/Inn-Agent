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
import { PROJECT } from "@/lib/data";

export const runtime = "nodejs";
export const maxDuration = 15;

const MODEL = process.env.FOLLOWUP_MODEL ?? "gpt-5-nano";

const SYSTEM = `You suggest what a construction buyer would ask INA Procure next, given the turn that just finished.

INA Procure can: report shortfalls against the project plan, check stock for one material, find approved vendors, compare live quotes, look up what the project last paid, list purchase orders and their delivery status, and raise a purchase order for approval. It cannot approve payments, add vendors or contact anyone.

Rules:
- Exactly 3 suggestions, each a message the user would type, in first person.
- Under 8 words each. No trailing punctuation except a question mark.
- Move the work forward: name the material, vendor or order the reply just mentioned. Never suggest something the reply already answered.
- Never suggest anything outside the capabilities above.
- Only refer to things that exist. Never say "open", "view" or "approve" a purchase order unless the reply says one has been raised.
- Today is ${PROJECT.today}; the project is ${PROJECT.name}.

Reply as a JSON array of 3 strings and nothing else.`;

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
      max_completion_tokens: 200,
      ...(MODEL.startsWith("gpt-5") ? { reasoning_effort: "minimal" as const } : {}),
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    // Small models like to wrap JSON in a fence; take the array out of whatever
    // arrives rather than trusting the whole string to parse.
    const match = raw.match(/\[[\s\S]*\]/);
    const parsed = match ? JSON.parse(match[0]) : null;

    const suggestions = Array.isArray(parsed)
      ? parsed
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""))
          .filter((s) => s.length > 0 && s.length <= 60)
          .slice(0, 3)
      : [];

    return Response.json({ suggestions });
  } catch {
    return Response.json({ suggestions: [] });
  }
}
