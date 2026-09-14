"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ApprovalCard from "./ApprovalCard";
import AgentTrace from "./AgentTrace";
import QuestionCard from "./QuestionCard";
import PurchaseOrderPanel from "./PurchaseOrderPanel";
import ChatHistoryPanel, { type PastChat } from "./ChatHistoryPanel";
import SuiteNav from "./SuiteNav";
import type { Card } from "@/lib/cards";
import { USER } from "@/lib/data";

/** Last resort if the naming request never reaches the server. */
function provisionalTitle(text: string) {
  const clean = text.trim().replace(/\s+/g, " ").replace(/[.?!]+$/, "");
  return clean.length > 40 ? clean.slice(0, 40).trimEnd() + "\u2026" : clean;
}

const CHATS_KEY = "ina-procure:chats";

type Source = { label: string; page: string };

type Bubble =
  | { kind: "user"; text: string }
  | { kind: "agent"; text: string; sources?: Source[] }
  | {
      kind: "tools";
      items: { id: string; label: string; short: string; source?: Source; done: boolean }[];
    }
  | {
      kind: "card";
      id: string;
      card: Card;
      decided?: "approve" | "reject";
      answers?: (string | null)[];
    }
  | { kind: "error"; text: string };

// Three, covering the three things worth knowing this agent can do: see the
// problem, fix it, and catch the expensive mistake before it is made.
const SUGGESTIONS = [
  "What are we short on?",
  "Sort out the cement shortfall",
  "Are there any orders already in transit?",
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

export default function Chat() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [panelId, setPanelId] = useState<string | null>(null);
  const [chats, setChats] = useState<PastChat[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [bubbles]);

  useEffect(() => {
    if (!busy) box.current?.focus();
  }, [busy]);

  async function run(messages: any[], decisions?: Record<string, string>) {
    setBusy(true);
    let acc = "";
    let textIndex = -1;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages, decisions }),
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
            setBubbles((b) => {
              const next = [...b];
              if (textIndex === -1 || next[textIndex]?.kind !== "agent") {
                next.push({ kind: "agent", text: acc, sources: sourcesBehind(next) });
                textIndex = next.length - 1;
              } else {
                const prev = next[textIndex];
                next[textIndex] = {
                  kind: "agent",
                  text: acc,
                  sources: prev.kind === "agent" ? prev.sources : undefined,
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

          if (ev.t === "approval") {
            acc = "";
            textIndex = -1;
            setBubbles((b) => [...b, { kind: "card", id: ev.id, card: ev.card }]);
          }

          if (ev.t === "state") setHistory(ev.messages);
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

    // The opening message names the chat, in the header and in history.
    if (!title) nameChat(t);

    const commit = () => {
      if (!chatId) setChatId(String(Date.now()));
      setInput("");
      setFiles([]);
      setBubbles((b) => [...b, { kind: "user", text: t }]);
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
      run(next);
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

  function decide(id: string, decision: "approve" | "reject") {
    setBubbles((b) =>
      b.map((x) => (x.kind === "card" && x.id === id ? { ...x, decided: decision } : x)),
    );
    run(history, { [id]: decision });
  }

  function answer(id: string, questions: { question: string }[], picked: (string | null)[]) {
    setBubbles((b) =>
      b.map((x) => (x.kind === "card" && x.id === id ? { ...x, answers: picked } : x)),
    );
    run(history, {
      [id]: JSON.stringify(
        questions.map((q, i) => ({ question: q.question, answer: picked[i] })),
      ),
    });
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
  }

  const started = bubbles.length > 0;

  // The indicator stands in for activity that has nothing else to show yet.
  // A live tool trace already shimmers, and streaming prose speaks for
  // itself — showing it under either one reads as a second agent thinking.
  const panelBubble = bubbles.find((b) => b.kind === "card" && b.id === panelId);
  const panelCard =
    panelBubble?.kind === "card" && panelBubble.card.kind === "po" ? panelBubble.card : null;

  const last = bubbles[bubbles.length - 1];
  const showThinking = busy && last?.kind !== "tools" && last?.kind !== "agent";

  return (
    <div className="flex h-[100dvh] flex-col bg-bg">
      <SuiteNav />
      <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
      {/* header */}
      <header className="shrink-0">
        <div className="mx-auto flex h-12 max-w-col items-center gap-3 px-6">
          <Typewriter
            text={title ?? "New chat"}
            className="min-w-0 flex-1 truncate text-[15px] font-medium text-txt"
          />

          <div className="flex shrink-0 items-center gap-1">
            <IconButton label="New chat" onClick={reset}>
              <path d="M12 5v14M5 12h14" />
            </IconButton>
            <IconButton
              label="Past chats"
              active={historyOpen}
              onClick={() => {
                setPanelId(null);
                setHistoryOpen((v) => !v);
              }}
            >
              <path d="M3 3v6h6" />
              <path d="M3.5 13a9 9 0 1 0 2.2-6.4L3 9" />
              <path d="M12 7v5l3.5 2" />
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
                />
              }
            />
          ) : (
            <div className="space-y-5 py-8">
              {bubbles.map((b, i) => (
                <Row
                  key={i}
                  b={b}
                  onDecide={decide}
                  onAnswer={answer}
                  onView={() => {
                    setHistoryOpen(false);
                    setPanelId(b.kind === "card" ? b.id : null);
                  }}
                  live={busy && i === bubbles.length - 1}
                />
              ))}
              {showThinking && <Thinking />}
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
  live = false,
}: {
  b: Bubble;
  onDecide: (id: string, d: "approve" | "reject") => void;
  onAnswer: (id: string, questions: { question: string }[], picked: (string | null)[]) => void;
  onView: () => void;
  live?: boolean;
}) {
  if (b.kind === "user") {
    return (
      <div className="animate-rise flex justify-end">
        <div className="max-w-[80%] rounded-[10px] border border-line-soft bg-raised px-3.5 py-2 text-[13.5px] leading-relaxed text-txt">
          {b.text}
        </div>
      </div>
    );
  }

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
          onSubmit={(picked) => onAnswer(b.id, questions, picked)}
          onDismiss={() => onDecide(b.id, "reject")}
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
      <div className="rounded-[8px] border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-[12.5px] text-danger">
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
        }}
      >
        {b.text}
      </ReactMarkdown>
      </div>
      {b.kind === "agent" && b.sources?.length ? <Sources sources={b.sources} /> : null}
    </div>
  );
}

function Sources({ sources }: { sources: Source[] }) {
  return (
    <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-txt-faint">
      <span>{sources.length > 1 ? "Sources" : "Source"}</span>
      {sources.map((s, i) => (
        <span key={s.page} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden>·</span>}
          {/* The path is the link target, not something to read — printing it
              next to the name just said the same word twice. */}
          <a
            href={s.page}
            title={s.page}
            className="underline decoration-line underline-offset-2 transition-colors hover:text-txt-dim"
          >
            {s.label}
          </a>
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
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-[6px] transition-colors ${
        active ? "bg-raised text-txt" : "text-txt-faint hover:bg-raised hover:text-txt-dim"
      }`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
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
}: {
  input: string;
  setInput: (v: string) => void;
  send: (t: string) => void;
  busy: boolean;
  boxRef: React.RefObject<HTMLTextAreaElement>;
  files: File[];
  setFiles: (f: File[]) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);

  return (
    <div
      className="rounded-[10px] border border-line bg-bg shadow-input"
      style={{ viewTransitionName: "composer" }}
    >
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-3">
          {files.map((f, i) => (
            <span
              key={f.name + i}
              className="flex max-w-[220px] items-center gap-1.5 rounded-[6px] border border-line bg-surface py-1 pl-2 pr-1 text-[11.5px] text-txt-dim"
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
        placeholder="Ask Anything"
        disabled={busy}
        className="max-h-40 w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-[14px] leading-relaxed outline-none placeholder:text-txt-faint disabled:opacity-50"
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
          disabled={busy}
          aria-label="Attach images or files"
          title="Attach images or files"
          className="flex h-6 w-6 items-center justify-center rounded-[5px] text-txt-faint transition-colors hover:bg-raised hover:text-txt-dim disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <Paperclip size={14} />
        </button>

        <button
          onClick={() => send(input)}
          disabled={busy || !input.trim()}
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
    <div className="flex min-h-[calc(100dvh-96px)] flex-col justify-center py-10">
      <h1 className="text-center text-[32px] font-normal tracking-[-0.02em] text-txt">
        {USER.firstName}, what’s on the list today?
      </h1>
      <div className="mt-5">{composer}</div>

      <div className="mt-5 border-t border-line-soft">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="group flex w-full items-center gap-3 border-b border-line-soft py-3 text-left transition-colors hover:bg-raised/60"
          >
            <span className="flex-1 text-[13px] text-txt-dim transition-colors group-hover:text-txt">
              {s}
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-1 shrink-0 text-txt-faint opacity-0 transition-opacity group-hover:opacity-100"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
