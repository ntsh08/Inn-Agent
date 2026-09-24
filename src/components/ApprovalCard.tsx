"use client";

import type { Card } from "@/lib/cards";

type Props = {
  card: Card;
  onDecide: (decision: "approve" | "reject") => void;
  /** Opens the order beside the transcript. */
  onView: () => void;
  decided?: "approve" | "reject" | "replaced";
};

export default function ApprovalCard({ card, onDecide, onView, decided }: Props) {
  return (
    <div>
      <div className="animate-rise max-w-[470px] overflow-hidden rounded-[10px] border border-line bg-surface shadow-lift">
        {card.kind === "plan" && <PlanBody card={card} />}
        {card.kind === "po" && <PoBody card={card} />}
        {card.kind === "generic" && (
          <div className="p-4">
            <h4 className="text-[13px] font-medium">{card.title}</h4>
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

        <div className="flex items-center gap-2 border-t border-line-soft bg-raised/60 px-3 py-2.5">
          {decided ? (
            <span className="flex items-center gap-1.5 pl-1 text-[12px] text-txt-faint">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  decided === "approve" ? "bg-good" : "bg-txt-faint"
                }`}
              />
              {decided === "approve"
                ? card.kind === "po"
                  ? "Raised"
                  : "Approved"
                : decided === "replaced"
                  ? "Replaced by your reply"
                  : "Cancelled"}
            </span>
          ) : (
            <>
              <button
                onClick={() => onDecide("approve")}
                className="flex h-8 items-center rounded-[6px] bg-brand px-3 text-[12.5px] font-medium text-brand-ink transition-colors hover:bg-brand-hover"
              >
                {card.kind === "po" ? "Raise purchase order" : "Approve"}
              </button>
              {/* No Cancel on a PO: it led nowhere — you still had to type what
                  you wanted changed. Typing the change works without it, and
                  an Edit action will replace it. */}
              {card.kind !== "po" && (
                <button
                  onClick={() => onDecide("reject")}
                  className="flex h-8 items-center rounded-[6px] border border-line px-3 text-[12.5px] font-medium text-txt-dim transition-colors hover:bg-raised hover:text-txt"
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
              className="ml-auto flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] border border-line bg-bg px-2.5 text-[11.5px] tabular-nums text-txt-dim transition-colors hover:bg-raised hover:text-txt"
            >
              <DocIcon />
              View PO
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-txt-faint">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* The reasoning sits outside the card: the card is the figures being
          agreed to, this is the agent explaining itself afterwards. */}
      {card.kind === "po" && card.justification && (
        <p className="mt-2.5 max-w-[560px] text-[12.5px] leading-relaxed text-txt-dim">
          {card.justification}
        </p>
      )}
    </div>
  );
}

function Label({ children, tone = "accent" }: { children: React.ReactNode; tone?: "accent" | "warn" }) {
  return (
    <span
      className={`rounded-[4px] px-1.5 py-[3px] text-[10px] font-medium uppercase tracking-[0.07em] ${
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
      <h4 className="mt-2.5 text-[13.5px] font-medium leading-snug">{card.title}</h4>
      <ol className="mt-3 space-y-2.5">
        {card.todos.map((t, i) => (
          <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-txt-dim">
            <span className="mt-[3px] flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border border-line text-[10px] text-txt-faint">
              {i + 1}
            </span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PoBody({ card }: { card: Extract<Card, { kind: "po" }> }) {
  return (
    <div>
      <div className="px-4 pb-3 pt-3.5">
        <h4 className="truncate text-[15px] font-medium leading-tight">{card.vendor}</h4>
        {card.vendorRating != null && (
          <div className="mt-1.5 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Star />
              <span className="text-[11.5px] tabular-nums text-txt-dim">{card.vendorRating}</span>
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
                <span className="text-[11.5px] tabular-nums text-txt-faint">
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
              <span className="min-w-0 text-[13px] text-txt">{line.material}</span>
              <span className="shrink-0 text-[13px] tabular-nums text-txt">{line.amount}</span>
            </div>
            <p className="mt-0.5 text-[11.5px] text-txt-faint">
              {line.quantity} at {line.rate}
            </p>
          </div>
        ))}

        {card.items.length > 1 && (
          <div className="mt-2.5 flex items-baseline justify-between gap-6 border-t border-line-soft pt-2">
            <span className="text-[11.5px] text-txt-faint">Subtotal</span>
            <span className="shrink-0 text-[12.5px] tabular-nums text-txt-dim">{card.subtotal}</span>
          </div>
        )}

        <div className="mt-2 flex items-baseline justify-between gap-6">
          <span className="text-[11.5px] text-txt-faint">GST</span>
          <span className="shrink-0 text-[12.5px] tabular-nums text-txt-dim">{card.gst}</span>
        </div>
      </div>

      {/* The band carries the total. Weight and ground do the work, so the
          figure can stay at reading size instead of shouting. */}
      <div className="flex items-baseline justify-between gap-6 border-y border-line bg-raised px-4 py-2.5">
        <span className="text-[12.5px] font-medium text-txt">Total incl. GST</span>
        <span className="shrink-0 text-[15px] font-medium tabular-nums text-txt">{card.total}</span>
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
          <p className="text-[12.5px] leading-snug text-txt">
            Arrives {shortDate(card.deliverBy)}
            {card.floatDays != null && ", " + floatPhrase(card.floatDays)}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-txt-faint">
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
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-warn">
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
      {/* The document mark the sidebar uses for Purchase orders. */}
      <path d="M6 3h8l4 4v14H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 3v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
