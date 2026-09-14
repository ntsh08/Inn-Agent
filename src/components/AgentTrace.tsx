"use client";

import { useState } from "react";
import { Orb } from "./Orb";
import { ThinkingState } from "./ThinkingState";

export type TraceItem = { id: string; label: string; short: string; done: boolean };

/**
 * One line of agent activity: the orb, a shimmering label naming the step in
 * flight, and a chevron that opens the steps taken so far.
 *
 * It expands itself while work is happening and collapses once the turn
 * settles, so a finished turn costs one line in the transcript instead of
 * one per tool. Either way the reader can reopen it.
 */
export default function AgentTrace({
  items,
  live = false,
}: {
  items: TraceItem[];
  /** The turn this trace belongs to is still streaming. */
  live?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const running = items.find((t) => !t.done);
  const working = live || Boolean(running);

  // The header names the step rather than saying something generic. These
  // tools read local data and finish in the same tick, so there is rarely an
  // in-flight one to point at — fall back to the most recent step, which is
  // what the agent just did.
  const current = running ?? items[items.length - 1];
  const heading = working
    ? current?.short ?? "Thinking"
    : `Ran ${items.length} step${items.length === 1 ? "" : "s"}`;

  // Stays shut until the reader opens it, mid-turn included.
  const canExpand = items.length > 0;
  const expanded = canExpand && open;

  return (
    <div className="flex flex-col [--orb-fg:#128766] [--shimmer-ink-soft:rgba(138,145,144,0.35)] [--shimmer-ink:#8A9190]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!canExpand}
        aria-expanded={canExpand ? expanded : undefined}
        className={`-mx-1.5 flex w-fit items-center gap-2 rounded-[6px] px-1.5 py-1 text-left transition-colors ${
          canExpand ? "hover:bg-raised" : "cursor-default"
        }`}
      >
        {/* The label beside it already says this; the orb is decoration.
            It stops moving once the turn settles — a looping mark would keep
            reading as "still working". */}
        <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center">
          <Orb variant="M3" size={20} className={working ? undefined : "orb-still"} />
        </span>

        <span role="status">
          {working ? (
            <ThinkingState>{heading}</ThinkingState>
          ) : (
            <span className="animate-rise text-[12.5px] font-medium text-txt-faint">
              {heading}
            </span>
          )}
        </span>

        {canExpand && (
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-txt-faint transition-transform duration-300"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </button>

      {/* 0fr → 1fr so the open/close animates without measuring anything. */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="ml-[7px] mt-1 border-l border-line-soft pl-4">
            <div className="flex flex-col gap-0.5 py-1">
              {items.map((t) => (
                <div key={t.id} className="animate-rise flex min-h-[26px] items-center gap-2">
                  {t.done ? <Check /> : <Spinner />}
                  <span
                    className={`text-[12.5px] ${t.done ? "text-txt-faint" : "text-txt-dim"}`}
                  >
                    {t.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-txt-faint"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function Spinner() {
  return (
    <span className="h-3 w-3 shrink-0 animate-spin rounded-full border-[1.5px] border-line border-t-accent" />
  );
}
