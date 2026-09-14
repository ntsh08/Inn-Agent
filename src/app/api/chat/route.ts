/**
 * Chat endpoint.
 *
 * Runs the tool loop server-side and streams NDJSON events to the client.
 * The key behaviour is the approval gate: when the model calls a tool marked
 * `requiresApproval`, the loop STOPS before executing it and hands the client a
 * card. Nothing is written until the user sends a decision back.
 *
 * The API key never leaves this file's process — it is read from the
 * environment and used only here.
 */

import OpenAI from "openai";
import { NextRequest } from "next/server";
import { buildSystemPrompt } from "@/lib/prompt";
import { OPENAI_TOOLS, TOOL_BY_NAME } from "@/lib/tools";
import { buildCard } from "@/lib/cards";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.MODEL ?? "gpt-5-mini";
// A multi-material request costs a lookup round per material — quotes,
// rate history, open orders — before it can ask anything, so the budget has
// to clear that plus the ask and the raise.
const MAX_STEPS = 14;
const MAX_MESSAGES = 60;

/** Crude per-IP limiter. Enough for a public demo; resets when the lambda cycles. */
const hits = new Map<string, { n: number; t: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;

function rateLimited(ip: string) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.t > WINDOW_MS) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  rec.n += 1;
  return rec.n > MAX_PER_WINDOW;
}

type Decision = "approve" | "reject";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return new Response(JSON.stringify({ error: "Too many messages. Give it a minute." }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
  }
  if (!process.env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not set." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const body = await req.json();
  const incoming: any[] = Array.isArray(body.messages) ? body.messages : [];
  const decisions: Record<string, Decision> = body.decisions ?? {};

  if (incoming.length > MAX_MESSAGES) {
    return new Response(
      JSON.stringify({ error: "This conversation is long enough — start a new chat." }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const messages: any[] = [...incoming];
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      const runTool = (name: string, args: any) => {
        const def = TOOL_BY_NAME[name];
        if (!def) return { error: `Unknown tool ${name}` };
        try {
          return def.run(args);
        } catch (err: any) {
          // Errors go back to the model as data so it can self-correct,
          // rather than blowing up the turn.
          return { error: String(err?.message ?? err) };
        }
      };

      try {
        // ---- resume: the previous turn stopped on an approval gate ----------
        const pending = messages[messages.length - 1];
        if (pending?.role === "assistant" && pending.tool_calls?.length) {
          for (const call of pending.tool_calls) {
            const decision = decisions[call.id] ?? "reject";
            const args = JSON.parse(call.function.arguments || "{}");
            const def = TOOL_BY_NAME[call.function.name];
            let result: unknown;
            if (def?.collectsAnswers) {
              // The "decision" for a question card is the answers themselves.
              result =
                decision && decision !== "reject"
                  ? { ok: true, answers: JSON.parse(decision) }
                  : {
                      ok: false,
                      dismissed: true,
                      note: "The user closed the questions without answering. Do not ask them again — say briefly what you need and stop.",
                    };
            } else if (decision === "approve") {
              send({ t: "tool", id: call.id, name: call.function.name, label: def?.label ?? call.function.name, short: def?.short ?? def?.label ?? call.function.name, source: def?.source, status: "start" });
              result = runTool(call.function.name, args);
              send({ t: "tool", id: call.id, status: "done" });
            } else {
              result = {
                ok: false,
                rejected: true,
                note: "The user rejected this. Do not retry it or call it again with different arguments. Acknowledge briefly and ask what they would like changed.",
              };
            }
            messages.push({
              role: "tool",
              tool_call_id: call.id,
              content: JSON.stringify(result),
            });
          }
        }

        // ---- the loop -------------------------------------------------------
        for (let step = 0; step < MAX_STEPS; step++) {
          const completion = await client.chat.completions.create({
            model: MODEL,
            messages: [{ role: "system", content: buildSystemPrompt() }, ...messages],
            tools: OPENAI_TOOLS,
            stream: true,
            // Keeps latency demo-tolerable. This agent's reasoning is shallow —
            // compare a few numbers against a date — so deep thinking buys nothing.
            ...(MODEL.startsWith("gpt-5") ? { reasoning_effort: "low" as const } : {}),
          });

          let text = "";
          const calls: Record<number, { id: string; name: string; args: string }> = {};

          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;
            if (delta.content) {
              text += delta.content;
              send({ t: "text", v: delta.content });
            }
            for (const tc of delta.tool_calls ?? []) {
              const i = tc.index ?? 0;
              calls[i] ??= { id: "", name: "", args: "" };
              if (tc.id) calls[i].id = tc.id;
              if (tc.function?.name) calls[i].name += tc.function.name;
              if (tc.function?.arguments) calls[i].args += tc.function.arguments;
            }
          }

          const toolCalls = Object.values(calls).filter((c) => c.name);

          if (!toolCalls.length) {
            messages.push({ role: "assistant", content: text });
            send({ t: "state", messages });
            send({ t: "done" });
            controller.close();
            return;
          }

          const assistantMsg = {
            role: "assistant",
            content: text || null,
            tool_calls: toolCalls.map((c) => ({
              id: c.id,
              type: "function",
              function: { name: c.name, arguments: c.args },
            })),
          };
          messages.push(assistantMsg);

          // Any gated tool in this batch halts the loop and asks the user.
          const gated = toolCalls.filter((c) => TOOL_BY_NAME[c.name]?.requiresApproval);
          if (gated.length) {
            for (const c of gated) {
              const args = JSON.parse(c.args || "{}");
              send({
                t: "approval",
                id: c.id,
                name: c.name,
                card: buildCard(c.name, args),
              });
            }
            send({ t: "state", messages });
            send({ t: "done", awaiting: true });
            controller.close();
            return;
          }

          for (const c of toolCalls) {
            const def = TOOL_BY_NAME[c.name];
            send({ t: "tool", id: c.id, name: c.name, label: def?.label ?? c.name, short: def?.short ?? def?.label ?? c.name, source: def?.source, status: "start" });
            const result = runTool(c.name, JSON.parse(c.args || "{}"));
            send({ t: "tool", id: c.id, status: "done" });
            messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result) });
          }
          send({ t: "state", messages });
        }

        send({ t: "text", v: "\n\nI've hit my step limit for this turn — ask me to continue." });
        send({ t: "state", messages });
        send({ t: "done" });
        controller.close();
      } catch (err: any) {
        send({ t: "error", v: err?.message ?? "Something went wrong." });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" },
  });
}
