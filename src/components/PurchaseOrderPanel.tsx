"use client";

import { useEffect } from "react";
import type { PoCard } from "@/lib/cards";
import PurchaseOrderDoc from "./PurchaseOrderDoc";

/**
 * The purchase order as a document, in a column beside the transcript.
 *
 * The card is a summary built for a five-second decision; this is the thing
 * being decided — line items, both addresses, the totals broken out, and the
 * reason it is going to this vendor. It splits the layout rather than covering
 * it, so the conversation stays readable and usable alongside the order.
 */
export default function PurchaseOrderPanel({
  card,
  issued,
  onClose,
}: {
  card: PoCard;
  /** True once the user has raised it, so the panel stops saying draft. */
  issued?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside className="flex h-full w-[45%] min-w-[380px] max-w-[620px] shrink-0 flex-col border-l border-line bg-bg">
        <header className="flex shrink-0 items-center gap-2.5 border-b border-line-soft px-4 py-3">
          <DocIcon />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-txt">
            {card.reference}
          </span>
          <span className="rounded-[4px] border border-line px-1.5 py-px text-[10px] text-txt-faint">
            Esc
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-[5px] p-1 text-txt-faint transition-colors hover:bg-raised hover:text-txt-dim"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <PurchaseOrderDoc card={card} issued={issued} />
    </aside>
  );
}

function DocIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0 text-warn">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" opacity="0.14" />
      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 9h18M9 9v12" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
