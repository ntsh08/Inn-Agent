"use client";

import { useEffect, useRef, useState } from "react";

export type Question = { question: string; options: string[] };

/**
 * The choices only the user can make, asked before anything is committed.
 *
 * One question at a time with numbered options, a free-text row for anything
 * not listed, and Skip. Answering the last one submits the lot — there is no
 * separate confirm, because the purchase order card that follows is the real
 * decision point. Like Claude's own question prompt, a number key picks that
 * option and Esc skips.
 */
export default function QuestionCard({
  questions,
  answers,
  replaced,
  onSubmit,
}: {
  questions: Question[];
  /** Present once answered — the card becomes a read-only record. */
  answers?: (string | null)[];
  /** The user typed a message instead of answering. */
  replaced?: boolean;
  onSubmit: (answers: (string | null)[]) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState<(string | null)[]>(() => questions.map(() => null));
  const [other, setOther] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {});

  // While the card is open it takes the keyboard, so a number picks straight
  // away without clicking first.
  useEffect(() => {
    if (answers) return;
    cardRef.current?.focus({ preventScroll: true });
    const listener = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [answers]);

  if (answers) return <Answered questions={questions} answers={answers} replaced={replaced} />;

  const q = questions[idx];
  if (!q) return null;

  function record(value: string | null) {
    const next = [...draft];
    next[idx] = value;
    setDraft(next);
    setOther("");

    const unanswered = next.findIndex((a, i) => a === null && i !== idx);
    if (unanswered === -1) onSubmit(next);
    else setIdx(unanswered);
  }

  onKey.current = (e) => {
    // A "1" typed into a text box is just a 1, and keys meant for something
    // else on the page — a side panel's Esc — aren't the card's.
    const typing = e.target instanceof HTMLElement && (e.target.matches("input, textarea") || e.target.isContentEditable);
    const active = document.activeElement;
    const ours = !active || active === document.body || !!cardRef.current?.contains(active);
    if (typing || !ours || e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === "Escape") {
      e.preventDefault();
      record(null);
      return;
    }
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= q.options.length) {
      e.preventDefault();
      record(q.options[n - 1]);
    }
  };

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      className="animate-rise overflow-hidden rounded-[10px] border border-line bg-surface shadow-lift outline-none"
    >
      <div className="flex items-center gap-4 px-4 pb-3 pt-3.5">
        <h4 className="min-w-0 flex-1 text-[14px] font-medium leading-snug text-txt">
          {q.question}
        </h4>

        {questions.length > 1 && (
          <div className="flex shrink-0 items-center gap-1.5 text-txt-faint">
            <Step label="Previous" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
              <path d="M15 18l-6-6 6-6" />
            </Step>
            <span className="text-[11px] tabular-nums">
              {idx + 1} of {questions.length}
            </span>
            <Step
              label="Next"
              disabled={idx === questions.length - 1}
              onClick={() => setIdx(idx + 1)}
            >
              <path d="M9 18l6-6-6-6" />
            </Step>
          </div>
        )}

        {/* Skip sits where a close button would: there was one of each, and
            they did different things nobody could tell apart. */}
        <button
          onClick={() => record(null)}
          className="shrink-0 rounded-[6px] border border-line px-3 py-[5px] text-[12px] font-medium text-txt-dim transition-colors hover:bg-raised hover:text-txt"
        >
          Skip
        </button>
      </div>

      <div className="border-t border-line-soft">
        {q.options.map((option, i) => (
          <button
            key={option}
            onClick={() => record(option)}
            className="flex w-full items-center gap-3 border-b border-line-soft px-4 py-2.5 text-left transition-colors hover:bg-raised"
          >
            <Badge>{i + 1}</Badge>
            <span className="text-[14px] leading-snug text-txt">{option}</span>
            {/* The prototype offers a REQ to show where it fits, but can't raise one. */}
            {/^raise a new req$/i.test(option.trim()) && (
              <span className="shrink-0 rounded-[4px] bg-warn/10 px-1.5 py-[3px] text-[11px] font-medium text-warn">
                Not implemented yet
              </span>
            )}
          </button>
        ))}

        <div className="flex items-center gap-3 px-4 py-2.5">
          <Badge>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
            </svg>
          </Badge>
          <input
            value={other}
            onChange={(e) => setOther(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && other.trim()) {
                e.preventDefault();
                record(other.trim());
              }
            }}
            placeholder="Something else"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-txt outline-none placeholder:text-txt-faint"
          />
        </div>
      </div>
    </div>
  );
}

function Answered({
  questions,
  answers,
  replaced,
}: {
  questions: Question[];
  answers: (string | null)[];
  replaced?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
      {questions.map((q, i) => (
        <div
          key={q.question}
          className="border-b border-line-soft px-4 py-2.5 last:border-b-0"
        >
          {/* Typed past: faded like an order that was never raised. */}
          <p className={`text-[12px] text-txt-faint transition duration-300 ${replaced ? "opacity-50" : ""}`}>
            {q.question}
          </p>
          <p className={`mt-1 text-[14px] leading-snug ${replaced ? "text-txt-faint" : "text-txt"}`}>
            {replaced ? "Not answered" : answers[i] ?? "Skipped"}
          </p>
        </div>
      ))}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border border-line bg-raised text-[11px] tabular-nums text-txt-faint">
      {children}
    </span>
  );
}

function Step({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="rounded-[4px] p-0.5 transition-colors hover:text-txt-dim disabled:opacity-35 disabled:hover:text-txt-faint"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
