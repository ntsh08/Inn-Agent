"use client";

import { Children, useEffect, useRef, useState, Fragment, useMemo } from "react";
import { SOURCES, parseSources, slug, type Source } from "@/lib/sources";
import SourcePanel from "./SourcePanel";
import { addSessionOrders, loadSessionOrders } from "@/lib/session-orders";
import { STARTER_SUGGESTIONS, isSmallTalk } from "@/lib/smalltalk";
import { clockTime, dateLabel } from "@/lib/time";
import { flushSync } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ApprovalCard from "./ApprovalCard";
import AgentTrace from "./AgentTrace";
import QuestionCard from "./QuestionCard";
import PurchaseOrderPanel from "./PurchaseOrderPanel";
import ChatHistoryPanel, { type PastChat } from "./ChatHistoryPanel";
import type { Card } from "@/lib/cards";
import { USER } from "@/lib/data";

/** Last resort if the naming request never reaches the server. */
function provisionalTitle(text: string) {
  const clean = text.trim().replace(/\s+/g, " ").replace(/[.?!]+$/, "");
  return clean.length > 40 ? clean.slice(0, 40).trimEnd() + "\u2026" : clean;
}

const CHATS_KEY = "ina-procure:chats";



type Bubble =
  | { kind: "user"; text: string; at?: number }
  | { kind: "agent"; text: string; sources?: Source[] }
  | {
      kind: "tools";
      items: { id: string; name?: string; label: string; short: string; source?: Source; done: boolean }[];
    }
  | {
      kind: "card";
      id: string;
      card: Card;
      decided?: "approve" | "reject" | "replaced";
      answers?: (string | null)[];
    }
  | { kind: "error"; text: string };

// Each row wears the icon the sidebar uses for the section it asks about.
const SUGGESTIONS: { text: string; icon: React.ReactNode }[] = [
  {
    text: "What materials are we short on?",
    icon: (
      <>
        <path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
        <path d="M3.5 7.5L12 12m0 0l8.5-4.5M12 12v9" />
      </>
    ),
  },
  {
    text: "Which POs are raised but not delivered?",
    icon: (
      <>
        <path d="M6 3h8l4 4v14H6z" />
        <path d="M14 3v4h4" />
        <path d="M9 12h6M9 16h4" />
      </>
    ),
  },
];

/** The distinct places the most recent run of tools read from. */
function sourcesBehind(bubbles: Bubble[]): Source[] | undefined {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    if (b.kind === "agent") continue;
    if (b.kind !== "tools") return undefined;
    const seen = new Map<string, Source>();
    for (const t of b.items) if (t.source) seen.set(t.source.page, t.source);
    return seen.size ? Array.from(seen.values()) : undefined;
  }
  return undefined;
}

/** The tools behind the reply, looking past earlier text and cards. */
function toolsBehind(bubbles: Bubble[]): string[] {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    // A skipped or answered question card can sit between the lookup and the reply.
    if (b.kind === "agent" || b.kind === "card") continue;
    return b.kind === "tools" ? b.items.map((t) => t.name ?? "") : [];
  }
  return [];
}

/**
 * True when the reply follows a vendor or quote lookup. There is no page for
 * vendors, so a vendor pick cites nothing — the model tends to reach for the
 * inventory row instead, which points at the wrong thing.
 */
function followsVendorLookup(bubbles: Bubble[]): boolean {
  return toolsBehind(bubbles).some((n) => n === "quote_compare" || n === "vendor_search");
}

/**
 * A shortfall table spans the whole inventory, so it cites the page rather
 * than one row — the model kept citing whichever material it listed first.
 */
function wholeInventory(sources: Source[] | undefined, body: string, bubbles: Bubble[]) {
  if (!sources || !toolsBehind(bubbles).includes("shortfall_report")) return sources;
  if (!/\|\s*:?-{3,}/.test(body)) return sources;
  return [SOURCES.inventory, ...sources.filter((s) => s.label !== SOURCES.inventory.label)];
}

export default function Chat() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [sourcePanel, setSourcePanel] = useState<Source | null>(null);
  const [chats, setChats] = useState<PastChat[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState<string | null>(null);
  const [followups, setFollowups] = useState<string[]>([]);
  // Which transcript length the current suggestions belong to, so a re-render
  // never re-asks for the same turn.
  const askedFor = useRef(-1);
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // Follow the conversation as it grows: a new message, streaming text, a new
  // step. A card changing in place — raised, greyed — isn't growth; scrolling
  // then pulled the card away as it was clicked. And while a raise animation
  // plays, anything new waits until it's done, so the card holds still.
  const seen = useRef<Bubble[]>([]);
  const holdScrollUntil = useRef(0);
  useEffect(() => {
    const before = seen.current;
    seen.current = bubbles;
    const last = bubbles[bubbles.length - 1];
    const grew =
      bubbles.length > before.length || (!!last && last !== before[before.length - 1] && last.kind !== "card");
    if (!grew) return;
    const toEnd = () =>
      scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
    const wait = holdScrollUntil.current - Date.now();
    if (wait <= 0) return void toEnd();
    const t = setTimeout(toEnd, wait);
    return () => clearTimeout(t);
  }, [bubbles]);

  // Follow-up suggestions land a second after the reply, so scroll again when
  // they do — otherwise they sit hidden under the prompt box.
  useEffect(() => {
    if (!followups.length) return;
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [followups]);

  useEffect(() => {
    if (!busy) box.current?.focus();
  }, [busy]);

  async function run(messages: any[], decisions?: Record<string, string>) {
    setBusy(true);
    let acc = "";
    let textIndex = -1;
    // POs raised in this run. The reply after them cites every one — left to
    // the model it cited the first of three.
    const raised: Source[] = [];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages, decisions, orders: loadSessionOrders() }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Request failed." }));
        setBubbles((b) => [...b, { kind: "error", text: error }]);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);

          if (ev.t === "text") {
            acc += ev.v;
            // What the model cites wins: it is the only party that knows which
            // facts it leaned on, including ones carried over from an earlier
            // turn. The tools that ran are the fallback for a reply that says
            // nothing, which is how this behaved before it was asked to.
            const parsed = parseSources(acc);
            const body = parsed.body;
            const cited = raised.length ? raised : parsed.sources;
            setBubbles((b) => {
              const next = [...b];
              if (textIndex === -1 || next[textIndex]?.kind !== "agent") {
                next.push({
                  kind: "agent",
                  text: body,
                  sources: followsVendorLookup(next)
                    ? undefined
                    : wholeInventory(cited.length ? cited : sourcesBehind(next), body, next),
                });
                textIndex = next.length - 1;
              } else {
                const prev = next[textIndex];
                next[textIndex] = {
                  kind: "agent",
                  text: body,
                  sources: followsVendorLookup(next.slice(0, textIndex))
                    ? undefined
                    : wholeInventory(
                        cited.length ? cited : prev.kind === "agent" ? prev.sources : undefined,
                        body,
                        next.slice(0, textIndex),
                      ),
                };
              }
              return next;
            });
          }

          if (ev.t === "tool") {
            acc = "";
            textIndex = -1;
            setBubbles((b) => {
              const next = [...b];
              const last = next[next.length - 1];
              if (ev.status === "start") {
                const item = {
                  id: ev.id,
                  name: ev.name,
                  label: ev.label,
                  short: ev.short ?? ev.label,
                  source: ev.source,
                  done: false,
                };
                if (last?.kind === "tools") {
                  next[next.length - 1] = { kind: "tools", items: [...last.items, item] };
                } else {
                  next.push({ kind: "tools", items: [item] });
                }
              } else {
                for (let i = next.length - 1; i >= 0; i--) {
                  const bb = next[i];
                  if (bb.kind === "tools" && bb.items.some((x) => x.id === ev.id)) {
                    next[i] = {
                      kind: "tools",
                      items: bb.items.map((x) => (x.id === ev.id ? { ...x, done: true } : x)),
                    };
                    break;
                  }
                }
              }
              return next;
            });
          }

          // The app's own line above the PO cards — no sources, it is not a reply.
          if (ev.t === "note") {
            acc = "";
            textIndex = -1;
            setBubbles((b) => [...b, { kind: "agent", text: ev.v }]);
          }

          if (ev.t === "approval") {
            acc = "";
            textIndex = -1;
            setBubbles((b) => [...b, { kind: "card", id: ev.id, card: ev.card }]);
          }

          if (ev.t === "state") setHistory(ev.messages);
          if (ev.t === "orders") {
            addSessionOrders(ev.orders);
            // Raised on the way to answering something else: kept, not cited.
            if (ev.quiet) continue;
            for (const po of Array.from(new Set<string>(ev.orders.map((o: { poNumber: string }) => o.poNumber)))) {
              raised.push({ ...SOURCES.orders, record: po, page: `${SOURCES.orders.page}/${slug(po)}` });
            }
          }
          if (ev.t === "error") setBubbles((b) => [...b, { kind: "error", text: ev.v }]);
        }
      }
    } catch {
      setBubbles((b) => [...b, { kind: "error", text: "Lost connection. Try again." }]);
    } finally {
      setBusy(false);
    }
  }

  function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const next = [...history, { role: "user", content: t }];

    // POs raised on cards still waiting for the rest of their batch. Typing
    // now still raises them — the button was pressed — and drops only the
    // cards left open.
    const raisedFirst = Object.keys(decisions.current).length ? decisions.current : undefined;

    // The opening message names the chat, in the header and in history.
    if (!title) nameChat(t);

    const commit = () => {
      if (!chatId) setChatId(String(Date.now()));
      setFollowups([]);
      setInput("");
      setFiles([]);
      decisions.current = {};
      setBubbles((b) => [
        // An open card the user typed past can no longer be acted on — the
        // message they sent is the answer now.
        ...b.map((x) =>
          x.kind === "card" && !x.decided && !x.answers
            ? x.card.kind === "questions"
              ? { ...x, answers: x.card.questions.map(() => null), decided: "replaced" as const }
              : { ...x, decided: "replaced" as const }
            : x,
        ),
        { kind: "user", text: t, at: Date.now() },
      ]);
      setHistory(next);
    };

    // The first send is the only one that moves anything: the composer
    // travels from the middle of the screen to the foot of it, and the
    // empty state gives way to a transcript. Hand that frame to the browser
    // so it morphs between the two instead of cutting. Anywhere without
    // view transitions just gets the cut, which is what it did before.
    const startViewTransition = (
      document as Document & {
        startViewTransition?: (cb: () => void) => {
          ready: Promise<void>;
          finished?: Promise<void>;
          updateCallbackDone?: Promise<void>;
        };
      }
    ).startViewTransition?.bind(document);

    if (!started && startViewTransition) {
      const transition = startViewTransition(() => flushSync(commit));
      // Kick off the request once the browser has its snapshots. Starting it
      // sooner lands a state update mid-capture and the transition aborts.
      transition.ready.then(
        () => run(next),
        () => run(next),
      );
      // An aborted transition is a cosmetic miss, not an error worth logging.
      transition.finished?.catch(() => {});
      transition.updateCallbackDone?.catch(() => {});
    } else {
      commit();
      run(next, raisedFirst);
    }
  }

  /** Swaps the stand-in title for something that reads as a heading. */
  async function nameChat(message: string) {
    try {
      const res = await fetch("/api/title", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const { title: named } = await res.json();
      if (named) setTitle(named);
    } catch {
      // Only a network failure gets here — the route always answers with
      // something. Fall back to the message itself rather than "New chat".
      setTitle(provisionalTitle(message));
    }
  }

  /**
   * Several cards can come in one turn — one PO per vendor. The turn resumes
   * only once every one of them is decided; resuming on the first would send
   * the rest as rejected.
   */
  const decisions = useRef<Record<string, string>>({});

  function settle(id: string, value: string, mark: (x: Bubble & { kind: "card" }) => Bubble) {
    decisions.current[id] = value;
    const next = bubbles.map((x) => (x.kind === "card" && x.id === id ? mark(x) : x));
    setBubbles(next);
    const open = next.some((x) => x.kind === "card" && !x.decided && !x.answers);
    if (open) return;
    const all = decisions.current;
    decisions.current = {};
    run(history, all);
  }

  function decide(id: string, decision: "approve" | "reject") {
    // The raise animation runs about two seconds; the view stays put for it.
    if (decision === "approve") holdScrollUntil.current = Date.now() + 2000;
    settle(id, decision, (x) => ({ ...x, decided: decision }));
  }

  function answer(id: string, questions: { question: string }[], picked: (string | null)[]) {
    // Skip closes the question and stops there: nothing runs, and the
    // composer opens for whatever the user wants instead. (It used to carry
    // on with a vendor comparison, which read as the agent ignoring Skip.)
    if (picked.every((p) => p == null)) {
      setBubbles((b) =>
        b.map((x) => (x.kind === "card" && x.id === id ? { ...x, answers: picked } : x)),
      );
      return;
    }
    settle(
      id,
      JSON.stringify(questions.map((q, i) => ({ question: q.question, answer: picked[i] }))),
      (x) => ({ ...x, answers: picked }),
    );
  }

  /** Past chats outlive a reload; the live one is only in memory. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHATS_KEY);
      if (raw) setChats(JSON.parse(raw));
    } catch {
      // A blocked or corrupt store just means no history — not a failure.
    }
  }, []);

  function remember(next: PastChat[]) {
    setChats(next);
    try {
      localStorage.setItem(CHATS_KEY, JSON.stringify(next.slice(0, 50)));
    } catch {
      // Ignore: the list still works for this session.
    }
  }

  /** Files the current chat away, if it has anything in it. */
  function archive() {
    if (!bubbles.length) return chats;
    const firstUser = bubbles.find((b) => b.kind === "user");
    const entry: PastChat = {
      id: chatId ?? String(Date.now()),
      title: title ?? (firstUser?.kind === "user" ? firstUser.text : "Untitled chat"),
      at: Date.now(),
      bubbles,
      history,
    };
    const next = [entry, ...chats.filter((c) => c.id !== entry.id)];
    remember(next);
    return next;
  }

  function reset() {
    archive();
    setBubbles([]);
    setHistory([]);
    setInput("");
    setFiles([]);
    setTitle(null);
    setChatId(null);
    setPanelId(null);
    setSourcePanel(null);
    setFollowups([]);
    askedFor.current = -1;
  }

  function openChat(id: string) {
    const merged = archive();
    const target = merged.find((c) => c.id === id);
    if (!target) return;
    setBubbles(target.bubbles as Bubble[]);
    setHistory(target.history as any[]);
    setChatId(target.id);
    setTitle(target.title);
    setInput("");
    setFiles([]);
    setPanelId(null);
    setSourcePanel(null);
    setFollowups([]);
    askedFor.current = (target.bubbles as Bubble[]).length;
  }

  const started = bubbles.length > 0;

  // The indicator stands in for activity that has nothing else to show yet.
  // A live tool trace already shimmers, and streaming prose speaks for
  // itself — showing it under either one reads as a second agent thinking.
  const panelBubble = bubbles.find((b) => b.kind === "card" && b.id === panelId);
  const panelCard =
    panelBubble?.kind === "card" && panelBubble.card.kind === "po" ? panelBubble.card : null;

  // Where a date header goes: above the first message, and again whenever the
  // day changes.
  const marks = useMemo(() => {
    const out: (number | null)[] = bubbles.map(() => null);
    let previous: number | null = null;
    bubbles.forEach((b, i) => {
      if (b.kind !== "user" || b.at == null) return;
      if (previous === null || dateLabel(b.at) !== dateLabel(previous)) out[i] = b.at;
      previous = b.at;
    });
    return out;
  }, [bubbles]);

  const last = bubbles[bubbles.length - 1];
  const questionOpen = bubbles.some(
    (b) => b.kind === "card" && b.card.kind === "questions" && !b.answers && !b.decided,
  );
  const showThinking = busy && last?.kind !== "tools" && last?.kind !== "agent";

  // Suggestions belong to a finished turn. A card still waiting on the user is
  // the question, so nothing else should be competing with it.
  const settled = !busy && last?.kind === "agent";

  useEffect(() => {
    if (!settled || askedFor.current === bubbles.length) return;
    askedFor.current = bubbles.length;

    const agentText = last?.kind === "agent" ? last.text : "";
    const userText = [...bubbles].reverse().find((b) => b.kind === "user");

    // After a greeting there is nothing specific to follow up on yet, so the
    // two broadest ways in — fixed, instant, always relevant.
    if (userText?.kind === "user" && isSmallTalk(userText.text)) {
      setFollowups(STARTER_SUGGESTIONS);
      return;
    }

    const controller = new AbortController();
    fetch("/api/followups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agent: agentText,
        user: userText?.kind === "user" ? userText.text : "",
      }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => setFollowups(Array.isArray(d.suggestions) ? d.suggestions : []))
      .catch(() => {
        // No suggestions is a fine outcome — the composer is right there.
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, bubbles.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg">
      <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
      {/* header */}
      <header className="shrink-0">
        <div className="mx-auto flex h-12 max-w-col items-center gap-3 px-6">
          <Typewriter
            text={title ?? "New chat"}
            className="min-w-0 flex-1 truncate text-[16px] font-medium text-txt"
          />

          <div className="flex shrink-0 items-center gap-1">
            {/* Nothing to start over from until the first message is sent. */}
            <IconButton label="New chat" onClick={reset} size={20} disabled={!started}>
              <path d="M12 5v14M5 12h14" />
            </IconButton>
            <IconButton
              label="Past chats"
              size={18}
              active={historyOpen}
              onClick={() => {
                setPanelId(null);
                setSourcePanel(null);
                setHistoryOpen((v) => !v);
              }}
            >
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 2" />
            </IconButton>
          </div>
        </div>
      </header>

      {/* transcript */}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-col px-6">
          {!started ? (
            <Empty
              onPick={send}
              composer={
                <Composer
                  input={input}
                  setInput={setInput}
                  send={send}
                  busy={busy}
                  boxRef={box}
                  files={files}
                  setFiles={setFiles}
                  placeholder="Ask anything or just say hi"
                />
              }
            />
          ) : (
            <div className="space-y-5 py-8">
              {bubbles.map((b, i) => (
                <Fragment key={i}>
                {marks[i] != null && <TimeMark at={marks[i]!} />}
                <Row
                  b={b}
                  onDecide={decide}
                  onAnswer={answer}
                  onView={() => {
                    setHistoryOpen(false);
                    setSourcePanel(null);
                    setPanelId(b.kind === "card" ? b.id : null);
                  }}
                  onSource={(s) => {
                    // One column on the right, whatever is in it.
                    setHistoryOpen(false);
                    setPanelId(null);
                    setSourcePanel(s);
                  }}
                  live={busy && i === bubbles.length - 1}
                />
                </Fragment>
              ))}
              {showThinking && <Thinking />}
              {settled && followups.length > 0 && (
                <FollowUps items={followups} onPick={send} />
              )}
              <div className="h-2" />
            </div>
          )}
        </div>
      </div>

      {/* composer — docked only once there is a transcript to sit under */}
      {started && (
        <div className="shrink-0 bg-gradient-to-t from-bg via-bg to-transparent pb-5 pt-2">
          <div className="mx-auto max-w-col px-6">
            <Composer
                  input={input}
                  setInput={setInput}
                  send={send}
                  busy={busy}
                  boxRef={box}
                  files={files}
                  setFiles={setFiles}
                  placeholder="Ask a follow-up"
                  // A question card has its own answer box, so this one waits
                  // until the card is answered or skipped.
                  locked={questionOpen ? "Pick an option above, or type in Something else" : undefined}
                />
          </div>
        </div>
      )}
      </div>

      {historyOpen && (
        <ChatHistoryPanel
          chats={chats}
          currentId={chatId}
          onOpen={openChat}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {sourcePanel && (
        <SourcePanel source={sourcePanel} onClose={() => setSourcePanel(null)} />
      )}

      {panelCard && (
        <PurchaseOrderPanel
          card={panelCard}
          issued={panelBubble?.kind === "card" && panelBubble.decided === "approve"}
          onClose={() => setPanelId(null)}
        />
      )}
      </div>
    </div>
  );
}

function Row({
  b,
  onDecide,
  onAnswer,
  onView,
  onSource,
  live = false,
}: {
  b: Bubble;
  onDecide: (id: string, d: "approve" | "reject") => void;
  onAnswer: (id: string, questions: { question: string }[], picked: (string | null)[]) => void;
  onView: () => void;
  onSource: (s: Source) => void;
  live?: boolean;
}) {
  if (b.kind === "user") return <UserBubble text={b.text} at={b.at} />;

  if (b.kind === "tools") {
    return <AgentTrace items={b.items} live={live} />;
  }

  if (b.kind === "card") {
    if (b.card.kind === "questions") {
      const questions = b.card.questions;
      return (
        <QuestionCard
          questions={questions}
          answers={b.answers}
          replaced={b.decided === "replaced"}
          onSubmit={(picked) => onAnswer(b.id, questions, picked)}
        />
      );
    }
    return (
      <ApprovalCard
        card={b.card}
        decided={b.decided}
        onDecide={(d) => onDecide(b.id, d)}
        onView={onView}
      />
    );
  }

  if (b.kind === "error") {
    return (
      <div className="rounded-[8px] border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-[14px] text-danger">
        {b.text}
      </div>
    );
  }

  return (
    <div className="animate-rise">
      <div className="prose-chat">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // `node` is pulled out only to keep it off the <table> element.
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          table({ node, ...props }) {
            return (
              <div className="table-wrap">
                <table {...props} />
              </div>
            );
          },
          // The recommended vendor's star: always after the name, in yellow,
          // wherever the model put it.
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          td({ node, children, ...props }) {
            const kids = Children.toArray(children);
            if (!kids.some((k) => typeof k === "string" && k.includes("★"))) {
              return <td {...props}>{children}</td>;
            }
            const last = kids.length - 1;
            const clean = kids.map((k, i) => {
              if (typeof k !== "string") return k;
              let t = k.replace(/\s*★\s*/g, " ");
              if (i === 0) t = t.trimStart();
              if (i === last) t = t.trimEnd();
              return t;
            });
            return (
              <td {...props}>
                {clean}
                <span role="img" aria-label="Recommended" className="ml-1.5 text-star">
                  ★
                </span>
              </td>
            );
          },
        }}
      >
        {b.text}
      </ReactMarkdown>
      </div>
      {b.kind === "agent" && b.sources?.length ? (
        <Sources sources={b.sources} onOpen={onSource} />
      ) : null}
    </div>
  );
}

function Sources({
  sources,
  onOpen,
}: {
  sources: Source[];
  onOpen: (s: Source) => void;
}) {
  // Two inventory rows cited both read "Inventory" — show it once.
  const shown = sources.filter((s, i) => sources.findIndex((t) => label(t) === label(s)) === i);
  return (
    <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-txt-faint">
      <span>{shown.length > 1 ? "Sources" : "Source"}</span>
      {shown.map((s, i) => (
        <span key={s.page} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden>·</span>}
          {/* The path is the link target, not something to read — printing it
              next to the name just said the same word twice. */}
          {/* A button, not a link: checking a source should open it beside
              the conversation, not navigate out of the conversation. */}
          <button
            onClick={() => onOpen(s)}
            title={s.page}
            className="underline decoration-line underline-offset-2 transition-colors hover:text-txt-dim"
          >
            {label(s)}
          </button>
        </span>
      ))}
    </p>
  );
}

function Thinking() {
  return <AgentTrace items={[]} live />;
}


/**
 * The prompt box. It sits in the middle of an empty screen and drops to the
 * foot of the page once there is a transcript above it.
 */
function Paperclip({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.2-9.2a3.67 3.67 0 0 1 5.18 5.19l-9.19 9.19a1.83 1.83 0 0 1-2.6-2.6l8.5-8.48" />
    </svg>
  );
}

function size(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

/**
 * Types a title out a character at a time, and backspaces to the shared
 * prefix first when it changes — so "Sort out the cement shortfall" giving way
 * to "Cement shortfall resolution" reads as a rename rather than a glitch.
 *
 * One interval drives the whole run, keyed only on the target. Scheduling a
 * timeout per character instead meant every parent re-render cleared the
 * pending one, and during streaming that slowed typing to a crawl.
 */
function Typewriter({ text, className }: { text: string; className?: string }) {
  const [shown, setShown] = useState(text);
  const shownRef = useRef(text);

  useEffect(() => {
    if (shownRef.current === text) return;

    // Anyone who has asked for less motion just gets the new title.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      shownRef.current = text;
      setShown(text);
      return;
    }

    const id = setInterval(() => {
      const current = shownRef.current;
      if (current === text) {
        clearInterval(id);
        return;
      }
      let common = 0;
      while (common < current.length && common < text.length && current[common] === text[common]) {
        common += 1;
      }
      const next =
        current.length > common ? current.slice(0, -1) : text.slice(0, current.length + 1);
      shownRef.current = next;
      setShown(next);
    }, 22);

    return () => clearInterval(id);
  }, [text]);

  return (
    <span className={className}>
      {/* The finished title for assistive tech; the animation is decoration. */}
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {shown}
        {shown !== text && <i className="type-caret" />}
      </span>
    </span>
  );
}

function IconButton({
  label,
  onClick,
  active,
  disabled,
  size = 17,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  /** Per icon, so glyphs that fill their box differently look the same size. */
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      // The faint grey read as disabled; these are live controls, so they take
      // the same weight as the other icons in the app.
      className={`flex h-8 w-8 items-center justify-center rounded-[6px] transition-colors ${
        active
          ? "bg-raised text-txt"
          : "text-txt hover:bg-raised disabled:cursor-default disabled:text-txt-faint disabled:opacity-60 disabled:hover:bg-transparent"
      }`}
    >
      {/* Stroke is scaled against size so every icon draws the same 1.5px
          line — a smaller icon at a fixed stroke looks thinner. */}
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={(1.5 * 24) / size} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}

function Composer({
  input,
  setInput,
  send,
  busy,
  boxRef,
  files,
  setFiles,
  placeholder,
  locked,
}: {
  input: string;
  setInput: (v: string) => void;
  send: (t: string) => void;
  busy: boolean;
  boxRef: React.RefObject<HTMLTextAreaElement>;
  files: File[];
  setFiles: (f: File[]) => void;
  placeholder: string;
  /** Why typing is paused, shown in place of the placeholder. */
  locked?: string;
}) {
  const picker = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`rounded-[10px] border border-line shadow-input ${locked ? "bg-raised" : "bg-bg"}`}
      style={{ viewTransitionName: "composer" }}
    >
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-3">
          {files.map((f, i) => (
            <span
              key={f.name + i}
              className="flex max-w-[220px] items-center gap-1.5 rounded-[6px] border border-line bg-surface py-1 pl-2 pr-1 text-[12px] text-txt-dim"
            >
              <Paperclip size={11} />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 tabular-nums text-txt-faint">{size(f.size)}</span>
              <button
                onClick={() => setFiles(files.filter((_, n) => n !== i))}
                aria-label={`Remove ${f.name}`}
                className="shrink-0 rounded-[4px] p-0.5 text-txt-faint transition-colors hover:bg-raised hover:text-txt-dim"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <textarea
        ref={boxRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send(input);
          }
        }}
        rows={1}
        placeholder={locked ?? placeholder}
        disabled={busy || !!locked}
        // Locked keeps its hint readable; only a busy composer fades.
        className={`max-h-40 w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-[14px] leading-relaxed outline-none placeholder:text-txt-faint ${
          locked ? "cursor-not-allowed" : "disabled:opacity-50"
        }`}
        onInput={(e) => {
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = Math.min(el.scrollHeight, 160) + "px";
        }}
      />
      <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
        <input
          ref={picker}
          type="file"
          multiple
          accept="image/*,.pdf,.csv,.xlsx,.xls,.doc,.docx,.txt"
          className="hidden"
          onChange={(e) => {
            setFiles([...files, ...Array.from(e.target.files ?? [])]);
            // Reset so picking the same file twice still fires a change.
            e.target.value = "";
          }}
        />
        <button
          onClick={() => picker.current?.click()}
          disabled={busy || !!locked}
          aria-label="Attach images or files"
          title="Attach images or files"
          className="flex h-6 w-6 items-center justify-center rounded-[5px] text-txt-faint transition-colors hover:bg-raised hover:text-txt-dim disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Paperclip size={14} />
        </button>

        <button
          onClick={() => send(input)}
          disabled={busy || !!locked || !input.trim()}
          aria-label="Send"
          className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-accent text-white transition-colors hover:bg-accent-hover disabled:bg-raised disabled:text-txt-faint"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Empty({ onPick, composer }: { onPick: (t: string) => void; composer: React.ReactNode }) {
  return (
    // Centred while the screen is empty; the composer moves to the foot of
    // the page the moment there is a transcript to sit under.
    <div className="flex min-h-[calc(100dvh-96px)] flex-col justify-center pb-[136px] pt-10">
      <h1 className="text-center text-[32px] font-normal tracking-[-0.02em] text-txt">
        Hi {USER.firstName}, what are we buying?
      </h1>
      <div className="mt-5">{composer}</div>

      {/* Open list, no rules between rows: prompts to pick from, not a
          table to read. */}
      <div className="mt-3 flex flex-col">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.text}
            onClick={() => onPick(s.text)}
            // Inset to match the prompt box, so each icon sits in line with
            // where you type.
            className="group flex items-center gap-3 rounded-[8px] px-3.5 py-2.5 text-left transition-colors hover:bg-raised"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="shrink-0 text-txt-dim"
            >
              {s.icon}
            </svg>
            <span className="text-[14px] text-txt">
              {s.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}


/**
 * What the user said, with the time and a copy control that surface on hover.
 *
 * The meta row keeps its space whether or not it is visible, so the transcript
 * does not shift under the pointer as you move down it.
 */
function UserBubble({ text, at }: { text: string; at?: number }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (await write(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
    // A clipboard that refuses both routes is the browser's call, not an
    // error worth putting in front of the user.
  }

  return (
    <div className="animate-rise group flex flex-col items-end">
      <div className="max-w-[80%] rounded-[10px] border border-line-soft bg-raised px-3.5 py-2 text-[14px] leading-relaxed text-txt">
        {text}
      </div>

      <div className="mt-1 flex h-[18px] items-center gap-2 pr-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button
          onClick={copy}
          aria-label={copied ? "Copied" : "Copy message"}
          className="rounded-[4px] p-0.5 text-txt-faint transition-colors hover:text-txt-dim"
        >
          {copied ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V5a2 2 0 012-2h8" />
            </svg>
          )}
        </button>
        {at != null && (
          <span className="text-[11px] text-txt-faint">{clockTime(at)}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Puts text on the clipboard, by whichever route the browser allows.
 *
 * The async API is the right one, but embedded and older browsers deny it
 * outright — so a denial falls through to the selection trick rather than
 * leaving the button dead.
 */
async function write(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fall through
  }

  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Where the conversation could go next.
 *
 * Suggestions sit under the reply rather than in the composer: they are the
 * agent offering, not the user typing, and picking one sends it as-is.
 */
function FollowUps({ items, onPick }: { items: string[]; onPick: (t: string) => void }) {
  return (
    <div className="animate-fade flex flex-col items-start gap-2 pt-1">
      {/* Two at most — a short menu of next questions, not a summary. */}
      {items.slice(0, 2).map((s) => (
        <button
          key={s}
          onClick={() => onPick(s)}
          // Hover fills to the same grey as your own messages: this is what
          // you would be saying.
          className="flex items-center gap-1.5 rounded-full border border-line py-[5px] pl-2.5 pr-3 text-[14px] text-txt-dim transition-colors hover:border-transparent hover:bg-raised hover:text-txt"
        >
          {/* The follow-up mark: this continues the conversation. */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className="shrink-0"
          >
            <path d="M6 6v6a3 3 0 0 0 3 3h10l-4-4m0 8 4-4" />
          </svg>
          {s}
        </button>
      ))}
    </div>
  );
}

/**
 * When this part of the conversation happened.
 *
 * Centred above the messages it introduces, the way a phone does it. Just the
 * day — each message carries its own time on hover.
 */
function TimeMark({ at }: { at: number }) {
  return (
    <p className="pt-1 text-center text-[12px] font-medium text-txt-dim">{dateLabel(at)}</p>
  );
}

/**
 * How a citation reads. A PO number already says it is a purchase order, so
 * it stands alone; a material keeps its register in front of it.
 */
/** A PO is named by its number; anything else by its page — "Inventory". */
function label(s: Source) {
  return s.record && s.page.startsWith("/orders/") ? s.record : s.label;
}
