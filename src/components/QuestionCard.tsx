"use client";

import { useState } from "react";

export type Question = { question: string; options: string[] };

/**
 * The choices only the user can make, asked before anything is committed.
 *
 * One question at a time with numbered options, a free-text row for anything
 * not listed, and Skip. Answering the last one submits the lot — there is no
 * separate confirm, because the purchase order card that follows is the real
 * decision point.
 */
export default function QuestionCard({
  questions,
  answers,
  onSubmit,
  onDismiss,
}: {
  questions: Question[];
  /** Present once answered — the card becomes a read-only record. */
  answers?: (string | null)[];
  onSubmit: (answers: (string | null)[]) => void;
  onDismiss: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState<(string | null)[]>(() => questions.map(() => null));
  const [other, setOther] = useState("");

  if (answers) return <Answered questions={questions} answers={answers} />;

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

  return (
    <div className="animate-rise overflow-hidden rounded-[10px] border border-line bg-surface shadow-lift">
      <div className="flex items-center gap-4 px-4 pb-3 pt-3.5">
        <h4 className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug text-txt">
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

        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-[5px] p-1 text-txt-faint transition-colors hover:bg-raised hover:text-txt-dim"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
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
            <span className="text-[12.5px] leading-snug text-txt">{option}</span>
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
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-txt outline-none placeholder:text-txt-faint"
          />
          <button
            onClick={() => record(null)}
            className="shrink-0 rounded-[6px] border border-line px-3 py-[5px] text-[12px] font-medium text-txt-dim transition-colors hover:bg-raised hover:text-txt"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

function Answered({
  questions,
  answers,
}: {
  questions: Question[];
  answers: (string | null)[];
}) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
      {questions.map((q, i) => (
        <div
          key={q.question}
          className="border-b border-line-soft px-4 py-2.5 last:border-b-0"
        >
          <p className="text-[11.5px] text-txt-faint">{q.question}</p>
          <p className="mt-1 text-[12.5px] leading-snug text-txt">
            {answers[i] ?? "Skipped"}
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
