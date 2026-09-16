"use client";

import type { PoCard } from "@/lib/cards";
import { PROJECT } from "@/lib/data";

/**
 * The purchase order as a document.
 *
 * Shared deliberately: the order the agent drafts and the order on file are
 * the same piece of paper, so they are the same component. Anything that
 * frames it — a panel beside the transcript, a page of its own — wraps this.
 */
export default function PurchaseOrderDoc({
  card,
  issued,
}: {
  card: PoCard;
  /** True once it has been raised, so the document stops saying draft. */
  issued?: boolean;
}) {
  return (
    <>
        <Banner card={card} />

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[17px] font-medium tabular-nums leading-none text-txt">
                {card.reference}
              </h2>
              <p className="mt-1.5 text-[11.5px] text-txt-faint">
                Raised {card.raisedOn ?? prettyToday()} · {PROJECT.name}
              </p>
            </div>
            <Status issued={issued} />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-6">
            <Block label="From">
              <p className="text-[13px] font-medium text-txt">{PROJECT.name}</p>
              <p className="mt-0.5 text-[11.5px] text-txt-faint">{card.deliverTo}</p>
              {card.neededFor && (
                <p className="mt-0.5 text-[11.5px] text-txt-faint">{card.neededFor}</p>
              )}
            </Block>
            <Block label="To">
              <p className="text-[13px] font-medium text-txt">{card.vendor}</p>
              {card.vendorLocation && (
                <p className="mt-0.5 text-[11.5px] text-txt-faint">{card.vendorLocation}</p>
              )}
              {card.vendorRating != null && (
                <p className="mt-0.5 text-[11.5px] text-txt-faint">
                  {card.vendorRating} rating, {card.vendorOnTime}% on time
                </p>
              )}
            </Block>
          </div>

          <div className="mt-6 overflow-hidden rounded-[8px] border border-line">
            <div className="flex items-center gap-3 border-b border-line-soft bg-surface px-3 py-2">
              <span className="flex-1 text-[10.5px] uppercase tracking-[0.06em] text-txt-faint">
                Material
              </span>
              <span className="w-24 text-right text-[10.5px] uppercase tracking-[0.06em] text-txt-faint">
                Qty
              </span>
              <span className="w-28 text-right text-[10.5px] uppercase tracking-[0.06em] text-txt-faint">
                Amount
              </span>
            </div>
            {card.items.map((line) => (
              <div
                key={line.material}
                className="flex items-start gap-3 border-b border-line-soft px-3 py-2.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] text-txt">{line.material}</p>
                  <p className="mt-0.5 text-[11px] text-txt-faint">{line.rate}</p>
                </div>
                <span className="w-24 shrink-0 text-right text-[12.5px] tabular-nums text-txt-dim">
                  {line.quantity}
                </span>
                <span className="w-28 shrink-0 text-right text-[12.5px] tabular-nums text-txt">
                  {line.amount}
                </span>
              </div>
            ))}
          </div>

          <dl className="ml-auto mt-4 w-[240px]">
            <Total label="Subtotal" value={card.subtotal} />
            <Total label="GST" value={card.gst} />
            <Total label="Total" value={card.total} strong />
          </dl>

        </div>
    </>
  );
}

/**
 * Whether the order lands in time, above the paperwork rather than buried in
 * it. The icon carries the verdict as much as the colour does: a tick when
 * there is room, a clock when it lands on the day, a warning when it does not.
 */
function Banner({ card }: { card: PoCard }) {
  const late = card.floatDays != null && card.floatDays < 0;
  const tight = card.floatDays === 0;
  const bad = Boolean(card.warning) || late;

  const tone = bad
    ? { wrap: "bg-danger/8 border-danger/25", text: "text-danger" }
    : tight
      ? { wrap: "bg-warn/8 border-warn/25", text: "text-warn" }
      : { wrap: "bg-accent-soft border-accent/20", text: "text-accent-ink" };

  return (
    <div className={`shrink-0 border-b px-6 py-2.5 ${tone.wrap}`}>
      <p className={`flex items-center gap-2 text-[12.5px] font-medium ${tone.text}`}>
        {bad ? <WarningIcon /> : tight ? <ClockIcon /> : <CheckIcon />}
        <span>
          Arrives {card.deliverBy}
          {card.floatDays != null && ` \u2014 ${floatPhrase(card.floatDays)}`}
        </span>
      </p>

      {card.warning && (
        <p className="mt-1 pl-6 text-[12px] font-medium leading-snug text-danger">
          {card.warning}
        </p>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.2l2.4 2.4 4.6-4.9" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M10.3 3.9L2.4 17.5A1.9 1.9 0 0 0 4 20.4h16a1.9 1.9 0 0 0 1.6-2.9L13.7 3.9a1.9 1.9 0 0 0-3.4 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </svg>
  );
}

function floatPhrase(days: number) {
  if (days > 1) return `${days} days of float`;
  if (days === 1) return "one day of float";
  if (days === 0) return "no float, it lands on the need-by date";
  if (days === -1) return "a day late";
  return `${Math.abs(days)} days late`;
}

function Status({ issued }: { issued?: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-[4px] px-1.5 py-[3px] text-[10px] font-medium uppercase tracking-[0.07em] ${
        issued ? "bg-accent-soft text-accent-ink" : "bg-raised text-txt-faint"
      }`}
    >
      {issued ? "Issued" : "Draft"}
    </span>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.07em] text-txt-faint">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-6 py-[7px] ${
        strong ? "border-t border-line" : "border-b border-line-soft"
      }`}
    >
      <dt className={`text-[11.5px] ${strong ? "text-txt" : "text-txt-faint"}`}>{label}</dt>
      <dd
        className={`text-right tabular-nums ${
          strong ? "text-[15px] font-medium text-txt" : "text-[12.5px] text-txt-dim"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function prettyToday() {
  return new Date(PROJECT.today).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
