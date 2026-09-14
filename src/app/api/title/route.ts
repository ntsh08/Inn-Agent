/**
 * Chat title endpoint.
 *
 * Turns the opening message into a few words that read as a heading, used both
 * in the app header and in the past-chats list. Deliberately tiny: one
 * non-streaming call, no tools, and a hard fallback to a trimmed version of
 * the message so a failure here never costs the user a title.
 */

import OpenAI from "openai";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 15;

// Naming a chat is a four-word job, so it gets the smallest model and the
// least reasoning the family allows — the header waits on this call.
const MODEL = process.env.TITLE_MODEL ?? "gpt-5-nano";

const SYSTEM = `Name this procurement chat in 3 to 5 words, as a heading a person would recognise in a list of past chats.

Rules:
- Sentence case: capitalise the first word, and names like Acme or Level 4. Everything else lower case.
- Name the material, the vendor or the task — "Cement shortfall for Level 4", "Steel rates last paid", "Orders in transit".
- No trailing punctuation, no quotes, no filler like "request" or "query".
- Never exceed 40 characters.

Reply with the title alone.`;

/** What the header shows if the model is unavailable. */
function fallback(text: string) {
  const clean = text.trim().replace(/\s+/g, " ").replace(/[.?!]+$/, "");
  return clean.length > 40 ? clean.slice(0, 40).trimEnd() + "…" : clean;
}

export async function POST(req: NextRequest) {
  const { message } = (await req.json().catch(() => ({}))) as { message?: string };
  if (!message?.trim()) {
    return Response.json({ title: "New chat" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ title: fallback(message) });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: message.slice(0, 500) },
      ],
      max_completion_tokens: 64,
      ...(MODEL.startsWith("gpt-5") ? { reasoning_effort: "minimal" as const } : {}),
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    const cleaned = raw?.replace(/^["']|["']$/g, "").replace(/[.?!]+$/, "");
    // Small models drop the leading capital often enough to be worth forcing.
    const title = cleaned && cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    return Response.json({ title: title && title.length <= 60 ? title : fallback(message) });
  } catch {
    return Response.json({ title: fallback(message) });
  }
}
