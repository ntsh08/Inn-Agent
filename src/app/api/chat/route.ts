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
import { OPENAI_TOOLS, TOOL_BY_NAME, type ToolContext } from "@/lib/tools";
import { COMMON, buildCard, orderContext } from "@/lib/cards";
import { MATERIALS, PURCHASE_ORDERS, asQuoted, shortfall, type PurchaseOrder } from "@/lib/data";
import { mergeOrders } from "@/lib/session-orders";
import { isSmallTalk } from "@/lib/smalltalk";
import { reorderPlan, sourcingQuestion } from "@/lib/sourcing";

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

/**
 * A reply typed into "Something else" rather than one of the options. It is
 * the user's next message, so the model is told to answer it — left alone it
 * treated "how much do we have in stock?" as a go-ahead and compared vendors.
 */
function typedReply(answers: { question: string; answer: string | null }[], args: any) {
  const typed = answers.filter((a, i) => {
    const options: string[] = args?.questions?.[i]?.options ?? [];
    return a.answer != null && !options.includes(a.answer);
  });
  if (!typed.length) return {};
  return {
    typed: true,
    note: `The user typed their own reply instead of picking an option: "${typed.map((a) => a.answer).join('", "')}". Respond to it as their message — answer a question, follow an instruction. Don't go on to the vendor comparison unless it asks for that.`,
  };
}

/** A PO row as the browser sends it back — anything else is dropped. */
function isOrder(o: any): o is PurchaseOrder {
  return (
    !!o &&
    typeof o.poNumber === "string" &&
    typeof o.vendorId === "string" &&
    typeof o.materialId === "string" &&
    typeof o.qty === "number" &&
    typeof o.rate === "number"
  );
}

/**
 * po_create's orders, accepting the older single-vendor shape too, each at
 * today's quoted rate and the vendor's minimum — the card, the line above it
 * and the raised PO all read from here, so they can't disagree.
 */
function ordersOf(args: any): any[] {
  const orders = Array.isArray(args?.orders) ? args.orders : args?.vendorId ? [args] : [];
  return orders.map(asQuoted);
}

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

  // The orders this turn works on: the seeded ones plus whatever this browser
  // has raised. A fresh list every request — the server keeps nothing, so one
  // visitor's POs never reach another and closing the tab starts clean.
  const raised: PurchaseOrder[] = Array.isArray(body.orders) ? body.orders.filter(isOrder) : [];
  const ctx: ToolContext = { orders: mergeOrders(PURCHASE_ORDERS, raised) };

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
          return def.run(args, ctx);
        } catch (err: any) {
          // Errors go back to the model as data so it can self-correct,
          // rather than blowing up the turn.
          return { error: String(err?.message ?? err) };
        }
      };

      // Raises one order from a po_create call and hands the new rows to the
      // browser to keep. Quiet when it happens on the way to answering
      // something else, so the reply doesn't cite the PO as its source.
      const raiseOrder = (callId: string, order: any, i: number, quiet = false) => {
        const id = `${callId}::${i}`;
        const def = TOOL_BY_NAME.po_create;
        send({ t: "tool", id, name: "po_create", label: def.label, short: def.short, status: "start" });
        const before = ctx.orders.length;
        const r = runTool("po_create", order);
        send({ t: "tool", id, status: "done" });
        const created = ctx.orders.slice(before);
        if (created.length) send({ t: "orders", orders: created, ...(quiet ? { quiet: true } : {}) });
        return r;
      };

      // Gated calls go to the user as cards: a line saying what is short and
      // why each quantity, then one card per PO (or the question card), and
      // the turn waits.
      const presentGate = (gated: { id: string; name: string; args: string }[]) => {
        const raising = gated
          .filter((c) => c.name === "po_create")
          .flatMap((c) => ordersOf(JSON.parse(c.args || "{}")));
        const context = raising.length ? orderContext(raising, ctx.orders) : "";
        if (context) send({ t: "note", v: context });

        let offset = 0;
        for (const c of gated) {
          const args = JSON.parse(c.args || "{}");
          if (c.name === "po_create") {
            // One call can carry several vendors; each gets its own card.
            ordersOf(args).forEach((order, i) => {
              send({ t: "approval", id: `${c.id}::${i}`, name: c.name, card: buildCard(c.name, order, offset++, ctx.orders) });
            });
            continue;
          }
          send({ t: "approval", id: c.id, name: c.name, card: buildCard(c.name, args, 0, ctx.orders) });
        }
        send({ t: "state", messages });
        send({ t: "done", awaiting: true });
        controller.close();
      };

      // What is left to order once the POs are in — worked out here, so the
      // closing line can't list something that was just ordered.
      const stillShort = () =>
        MATERIALS.filter((m) => shortfall(m, ctx.orders) > 0).map((m) => COMMON[m.id] ?? m.name);

      // A card typed past owes the model a reply. POs the user had already
      // raised on it still get raised — the button was pressed — and only the
      // cards left open are dropped.
      const typedPast = (c: any) => {
        if (c.function?.name === "po_create") {
          const orders = ordersOf(JSON.parse(c.function.arguments || "{}"));
          if (orders.some((_, i) => decisions[`${c.id}::${i}`] === "approve")) {
            return {
              orders: orders.map((order, i) =>
                decisions[`${c.id}::${i}`] === "approve"
                  ? raiseOrder(c.id, order, i, true)
                  : { ok: false, vendorId: order.vendorId, superseded: true },
              ),
              stillShort: stillShort(),
              note: "The user raised the POs marked ok, then typed a message instead of deciding the rest — those were not raised. Answer their message; confirm the raised PO in one line.",
            };
          }
        }
        return {
          ok: false,
          superseded: true,
          note: "The user skipped this card or typed a message instead. Nothing was chosen or raised. Treat their new message as what they want now — don't bring the card back.",
        };
      };

      try {
        // ---- cards the user answered by typing instead ------------------------
        // A card left open and then talked past still owes the model a reply
        // to its tool call, or the API rejects the whole conversation. Fill it
        // in, pointing the model at the message the user sent instead.
        for (let i = messages.length - 2; i >= 0; i--) {
          const m = messages[i];
          if (m.role !== "assistant" || !m.tool_calls?.length) continue;
          const answered = new Set(
            messages.slice(i + 1).filter((x) => x.role === "tool").map((x) => x.tool_call_id),
          );
          const missing = m.tool_calls.filter((c: any) => !answered.has(c.id));
          if (!missing.length) continue;
          messages.splice(
            i + 1,
            0,
            ...missing.map((c: any) => ({
              role: "tool",
              tool_call_id: c.id,
              content: JSON.stringify(typedPast(c)),
            })),
          );
        }

        // ---- resume: the previous turn stopped on an approval gate ----------
        const pending = messages[messages.length - 1];
        const resuming = pending?.role === "assistant" && !!pending.tool_calls?.length;
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const smallTalk =
          !resuming && typeof lastUser?.content === "string" && isSmallTalk(lastUser.content);
        if (resuming) {
          for (const call of pending.tool_calls) {
            const decision = decisions[call.id] ?? "reject";
            const args = JSON.parse(call.function.arguments || "{}");
            const def = TOOL_BY_NAME[call.function.name];
            let result: unknown;
            if (def?.collectsAnswers) {
              // The "decision" for a question card is the answers themselves.
              const answers: { question: string; answer: string | null }[] | null =
                decision && decision !== "reject" ? JSON.parse(decision) : null;
              // Skip comes back as null. Said plainly, or the model reads the
              // null as "no answer yet" and tells the user to pick on a card
              // that has already closed.
              result = answers?.every((a) => a.answer == null)
                ? {
                    ok: true,
                    skipped: true,
                    note: "The user pressed Skip and the card is closed. Do not ask again or mention the card — carry on with the default: compare vendors.",
                  }
                : answers
                  ? { ok: true, answers, ...typedReply(answers, args) }
                  : {
                      ok: false,
                      dismissed: true,
                      note: "The user closed the questions without answering. Do not ask them again — say briefly what you need and stop.",
                    };
            } else if (call.function.name === "po_create") {
              const results = ordersOf(args).map((order, i) =>
                decisions[`${call.id}::${i}`] === "approve"
                  ? raiseOrder(call.id, order, i)
                  : {
                      ok: false,
                      vendorId: order.vendorId,
                      rejected: true,
                      note: "The user did not raise this one. Do not retry it; ask what they would like changed.",
                    },
              );
              result = { orders: results, stillShort: stillShort() };
            } else if (decision === "approve") {
              send({ t: "tool", id: call.id, name: call.function.name, label: def?.label ?? call.function.name, short: def?.short ?? def?.label ?? call.function.name, source: def?.source, status: "start" });
              const before = ctx.orders.length;
              result = runTool(call.function.name, args);
              send({ t: "tool", id: call.id, status: "done" });
              // Hand any newly raised order to the client to keep for the session.
              const created = ctx.orders.slice(before);
              if (created.length) send({ t: "orders", orders: created });
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

        // ---- "find vendors for…": the card comes first, every time ---------
        // Built here, not by the model, so it always shows. The answer comes
        // back to the model like any card answer, and it carries on from there.
        // Not for a go-ahead on a vendor comparison — "raise all" then means
        // the recommended vendors, not a fresh search. "Find vendors for…" is
        // always a fresh search, comparison or not.
        const lastReply = [...messages].reverse().find((m) => m.role === "assistant" && typeof m.content === "string");
        const freshSearch = typeof lastUser?.content === "string" && /^\s*(?:find|get|show)\b/i.test(lastUser.content);
        const answeringPicks =
          !freshSearch && typeof lastReply?.content === "string" && lastReply.content.includes("★");
        const sourcing =
          !resuming && !answeringPicks && typeof lastUser?.content === "string"
            ? sourcingQuestion(lastUser.content, ctx.orders)
            : null;
        if (sourcing) {
          const id = `call_sourcing_${Date.now()}`;
          const args = JSON.stringify({ questions: [sourcing] });
          messages.push({
            role: "assistant",
            content: null,
            tool_calls: [{ id, type: "function", function: { name: "ask_user", arguments: args } }],
          });
          presentGate([{ id, name: "ask_user", args }]);
          return;
        }

        // ---- "Reorder from our last vendor" picked on that card ------------
        // The vendors, rates and quantities are all known, so the PO cards
        // are made here — left to the model it sometimes showed the vendor
        // table instead, or priced the PO at what we paid last time.
        const sourced = resuming ? pending.tool_calls.find((c: any) => c.id.startsWith("call_sourcing_")) : null;
        if (sourced && typeof lastUser?.content === "string") {
          let answer: string | null = null;
          try {
            answer = JSON.parse(decisions[sourced.id] ?? "null")?.[0]?.answer ?? null;
          } catch {
            answer = null;
          }
          const plan = answer && /^reorder\b/i.test(answer) ? reorderPlan(lastUser.content, ctx.orders) : null;
          if (plan) {
            const id = `call_reorder_${Date.now()}`;
            const args = JSON.stringify({ orders: plan });
            messages.push({
              role: "assistant",
              content: null,
              tool_calls: [{ id, type: "function", function: { name: "po_create", arguments: args } }],
            });
            presentGate([{ id, name: "po_create", args }]);
            return;
          }
        }

        // ---- the loop -------------------------------------------------------
        for (let step = 0; step < MAX_STEPS; step++) {
          const completion = await client.chat.completions.create({
            model: MODEL,
            messages: [{ role: "system", content: buildSystemPrompt() }, ...messages],
            tools: OPENAI_TOOLS,
            stream: true,
            // Minimal thinking only for small talk, so "hi" answers in about two
            // seconds. Any request for work thinks at "low": at "minimal" it
            // skipped the sourcing card, announced POs it never raised, and
            // replied "I'll check… one moment" without calling a tool.
            ...(MODEL.startsWith("gpt-5")
              ? { reasoning_effort: smallTalk ? ("minimal" as const) : ("low" as const) }
              : {}),
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
            presentGate(gated);
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
