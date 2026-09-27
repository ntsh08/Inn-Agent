"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Card } from "@/lib/cards";

type Props = {
  card: Card;
  onDecide: (decision: "approve" | "reject") => void;
  /** Opens the order beside the transcript. */
  onView: () => void;
  decided?: "approve" | "reject" | "replaced";
};

// The good green (#128766) as the raise wave spreads, and where it settles.
const WAVE = "rgba(18, 135, 102, 0.07)";
const REST = "rgba(18, 135, 102, 0.01)";

export default function ApprovalCard({ card, onDecide, onView, decided }: Props) {
  const replaced = decided === "replaced";
  const raised = decided === "approve" && card.kind === "po";

  // Only a raise made here and now plays the animation. An order already
  // raised — a past chat, a re-render — just shows where it ends up.
  const [justRaised, setJustRaised] = useState(false);
  const [ghostGone, setGhostGone] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const washRef = useRef<HTMLDivElement>(null);
  const moverRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef<SVGPathElement>(null);
  const ghostRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);

  // One wave from the centre, a big tick where it started, then the tick
  // shrinks into the top-right corner. Everything rests in its final state;
  // the animations run from the start state back to it.
  useLayoutEffect(() => {
    if (!justRaised || !raised) return;
    const box = cardRef.current;
    const wash = washRef.current;
    const mover = moverRef.current;
    const pop = popRef.current;
    const tick = tickRef.current;
    const status = statusRef.current;
    if (!box || !wash || !mover || !pop || !tick || !status) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // The tick sits 16px from the right and 14px from the top at a quarter
    // of its 64px size; at full size its centre is 48px in and 46px down.
    const toCentre = `translate(${48 - box.clientWidth / 2}px, ${box.clientHeight / 2 - 46}px) scale(1)`;
    const hold = { fill: "backwards" as const };

    const running = [
      // The wave is the same layer as the resting tint, but spreads at the
      // strength it was designed at (7%) and only then fades to the faint 1%
      // — at 1% the whole way, the wave couldn't be seen at all.
      wash.animate(
        [
          { clipPath: "circle(0% at 50% 50%)", backgroundColor: WAVE, easing: "cubic-bezier(.2,0,0,1)" },
          { clipPath: "circle(75% at 50% 50%)", backgroundColor: WAVE, offset: 0.65, easing: "ease-out" },
          { clipPath: "circle(75% at 50% 50%)", backgroundColor: REST },
        ],
        { ...hold, duration: 1000 },
      ),
      ghostRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { ...hold, duration: 200, delay: 100 }),
      pop.animate(
        [
          { opacity: 0, transform: "scale(.4)" },
          { opacity: 1, transform: "scale(1.08)", offset: 0.7 },
          { opacity: 1, transform: "scale(1)" },
        ],
        { ...hold, duration: 380, delay: 600, easing: "ease-out" },
      ),
      tick.animate([{ strokeDashoffset: 24 }, { strokeDashoffset: 0 }], {
        ...hold,
        duration: 320,
        delay: 750,
        easing: "ease-out",
      }),
      mover.animate([{ transform: toCentre }, { transform: "translate(0px, 0px) scale(0.375)" }], {
        ...hold,
        duration: 500,
        delay: 1400,
        easing: "cubic-bezier(.4,0,.2,1)",
      }),
      status.animate([{ opacity: 0 }, { opacity: 1 }], { ...hold, duration: 250, delay: 1650 }),
    ];
    // The faded button has done its job; take it out of the page.
    const ghost = running[1];
    if (ghost) ghost.onfinish = () => setGhostGone(true);
    return () => running.forEach((a) => a?.cancel());
  }, [justRaised, raised]);

  return (
    <div>
      <div
        ref={cardRef}
        className={`animate-rise relative max-w-[470px] overflow-hidden rounded-[10px] border bg-surface transition-[border-color,box-shadow] duration-300 motion-reduce:transition-none ${
          raised ? "border-good/30 shadow-lift delay-500" : replaced ? "border-line" : "border-line shadow-lift"
        }`}
      >
        {raised && (
          <>
            <div ref={washRef} aria-hidden className="pointer-events-none absolute inset-0 z-[2] bg-good/[0.01]" />
            <div
              ref={moverRef}
              aria-hidden
              className="pointer-events-none absolute right-4 top-3.5 z-[3] h-16 w-16 origin-top-right"
              style={{ transform: "scale(0.375)" }}
            >
              <div ref={popRef} className="flex h-16 w-16 items-center justify-center rounded-full bg-good">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <path ref={tickRef} d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray={24} />
                </svg>
              </div>
            </div>
          </>
        )}

        {/* Typed past, so never raised: the order steps back — faded, no
            colour — with View PO faded to match. The status stays readable. */}
        <div className={`transition duration-300 ${replaced ? "opacity-50 grayscale" : ""}`}>
          {card.kind === "plan" && <PlanBody card={card} />}
          {card.kind === "po" && <PoBody card={card} raised={raised} />}
          {card.kind === "generic" && (
            <div className="p-4">
              <h4 className="text-[14px] font-medium">{card.title}</h4>
              <dl className="mt-2.5 space-y-1.5">
                {card.rows.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-6 text-[12px]">
                    <dt className="text-txt-faint">{k}</dt>
                    <dd className="text-right text-txt-dim">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-line-soft bg-raised/60 px-3 py-2.5">
          {decided ? (
            <span className="grid">
              {/* The button, fading out where it was pressed. */}
              {justRaised && raised && !ghostGone && (
                <span
                  ref={ghostRef}
                  aria-hidden
                  className="flex h-8 items-center self-center rounded-[6px] bg-brand px-3 text-[14px] font-medium text-brand-ink opacity-0 [grid-area:1/1]"
                >
                  Raise purchase order
                </span>
              )}
              <span
                ref={statusRef}
                className={`flex items-center gap-1.5 self-center pl-1 text-[12px] [grid-area:1/1] ${
                  raised ? "font-medium text-accent-ink" : "text-txt-faint"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    decided === "approve" ? "bg-good" : "bg-txt-faint"
                  }`}
                />
                {decided === "approve"
                  ? card.kind === "po"
                    ? `${card.reference} raised`
                    : "Approved"
                  : replaced
                    ? card.kind === "po"
                      ? "Not raised"
                      : "Not approved"
                    : "Cancelled"}
              </span>
            </span>
          ) : (
            <>
              <button
                onClick={() => {
                  setJustRaised(true);
                  onDecide("approve");
                }}
                className="flex h-8 items-center rounded-[6px] bg-brand px-3 text-[14px] font-medium text-brand-ink transition-colors hover:bg-brand-hover"
              >
                {card.kind === "po" ? "Raise purchase order" : "Approve"}
              </button>
              {/* No Cancel on a PO: it led nowhere — you still had to type what
                  you wanted changed. Typing the change works without it, and
                  an Edit action will replace it. */}
              {card.kind !== "po" && (
                <button
                  onClick={() => onDecide("reject")}
                  className="flex h-8 items-center rounded-[6px] border border-line px-3 text-[14px] font-medium text-txt-dim transition-colors hover:bg-raised hover:text-txt"
                >
                  Reject
                </button>
              )}
            </>
          )}

          {card.kind === "po" && (
            <button
              onClick={onView}
              title={`Open ${card.reference}`}
              // Above the raised wash, so it stays a plain white button.
              className={`relative z-[3] ml-auto flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] border border-line bg-bg px-2.5 text-[14px] tabular-nums text-txt-dim transition duration-300 hover:bg-raised hover:text-txt ${
                replaced ? "opacity-50" : ""
              }`}
            >
              <DocIcon />
              View PO
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-txt-faint">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Label({ children, tone = "accent" }: { children: React.ReactNode; tone?: "accent" | "warn" }) {
  return (
    <span
      className={`rounded-[4px] px-1.5 py-[3px] text-[11px] font-medium uppercase tracking-[0.07em] ${
        tone === "warn" ? "bg-warn/10 text-warn" : "bg-accent-soft text-accent-ink"
      }`}
    >
      {children}
    </span>
  );
}

function PlanBody({ card }: { card: Extract<Card, { kind: "plan" }> }) {
  return (
    <div className="px-4 pb-4 pt-3.5">
      <Label>Plan</Label>
      <h4 className="mt-2.5 text-[14px] font-medium leading-snug">{card.title}</h4>
      <ol className="mt-3 space-y-2.5">
        {card.todos.map((t, i) => (
          <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-txt-dim">
            <span className="mt-[3px] flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border border-line text-[11px] text-txt-faint">
              {i + 1}
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PoBody({ card, raised }: { card: Extract<Card, { kind: "po" }>; raised?: boolean }) {
  return (
    <div>
      {/* A raised order keeps the tick in the top-right corner; the vendor
          name stops short of it. */}
      <div className={`pb-3 pl-4 pt-3.5 ${raised ? "pr-12" : "pr-4"}`}>
        <h4 className="truncate text-[16px] font-medium leading-tight">{card.vendor}</h4>
        {card.vendorRating != null && (
          <div className="mt-1.5 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Star />
              <span className="text-[12px] tabular-nums text-txt-dim">{card.vendorRating}</span>
            </span>
            {card.vendorOnTime != null && (
              <span className="flex items-center gap-1.5">
                {/* Same meter idiom as the header. Reliability is worth seeing
                    rather than reading — it is what the delivery date rides on. */}
                <span className="h-[3px] w-8 overflow-hidden rounded-full bg-line">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${card.vendorOnTime}%` }}
                  />
                </span>
                <span className="text-[12px] tabular-nums text-txt-faint">
                  {card.vendorOnTime}% on time
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Figures on one right-hand spine. One order can carry several
          materials, so this is a list even when it holds a single line. */}
      <div className="border-t border-line-soft px-4 pb-3 pt-3">
        {card.items.map((line, i) => (
          <div key={line.material} className={i > 0 ? "mt-2.5" : undefined}>
            <div className="flex items-baseline justify-between gap-6">
              <span className="min-w-0 text-[14px] text-txt">{line.material}</span>
              <span className="shrink-0 text-[14px] tabular-nums text-txt">{line.amount}</span>
            </div>
            <p className="mt-0.5 text-[12px] text-txt-faint">
              {line.quantity} at {line.rate}
            </p>
          </div>
        ))}

        {card.items.length > 1 && (
          <div className="mt-2.5 flex items-baseline justify-between gap-6 border-t border-line-soft pt-2">
            <span className="text-[12px] text-txt-faint">Subtotal</span>
            <span className="shrink-0 text-[12px] tabular-nums text-txt-dim">{card.subtotal}</span>
          </div>
        )}

        <div className="mt-2 flex items-baseline justify-between gap-6">
          <span className="text-[12px] text-txt-faint">GST</span>
          <span className="shrink-0 text-[12px] tabular-nums text-txt-dim">{card.gst}</span>
        </div>
      </div>

      {/* The band carries the total. Weight and ground do the work, so the
          figure can stay at reading size instead of shouting. */}
      <div className="flex items-baseline justify-between gap-6 border-y border-line bg-raised px-4 py-2.5">
        <span className="text-[14px] font-medium text-txt">Total incl. GST</span>
        <span className="shrink-0 text-[16px] font-medium tabular-nums text-txt">{card.total}</span>
      </div>

      {/* A late delivery is what kills an order, so the date gets a verdict
          rather than a row: how much float is left against the need-by date. */}
      <div className="flex items-start gap-2 px-4 py-3">
        <span
          className={`mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full ${
            card.floatDays != null && card.floatDays < 0 ? "bg-danger" : "bg-accent"
          }`}
        />
        <div className="min-w-0">
          <p className="text-[14px] leading-snug text-txt">
            Arrives {shortDate(card.deliverBy)}
            {card.floatDays != null && ", " + floatPhrase(card.floatDays)}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-txt-faint">
            {card.deliverTo}
            {card.neededFor && `, for the ${card.neededFor.replace(/^.*— /, "")}`}
          </p>
        </div>
      </div>

      {card.warning && (
        <p className="mx-4 mb-3.5 rounded-[6px] bg-danger/10 px-3 py-2 text-[12px] font-medium text-danger">
          {card.warning}
        </p>
      )}
    </div>
  );
}

/** The year is noise next to "2 days before it's needed". The panel keeps it. */
function shortDate(date: string) {
  return date.replace(/\s+\d{4}$/, "");
}

function floatPhrase(days: number) {
  if (days > 1) return `${days} days before it's needed`;
  if (days === 1) return "a day before it's needed";
  if (days === 0) return "the day it's needed";
  if (days === -1) return "a day late";
  return `${Math.abs(days)} days late`;
}

function Star() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-star">
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
      {/* The document mark the sidebar uses for Purchase orders. */}
      <path d="M6 3h8l4 4v14H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
