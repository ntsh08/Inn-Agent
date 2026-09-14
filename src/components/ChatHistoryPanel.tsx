"use client";

import { useEffect } from "react";

export type PastChat = {
  id: string;
  title: string;
  /** Epoch ms, so the list can be ordered and dated without a library. */
  at: number;
  bubbles: unknown[];
  history: unknown[];
};

/**
 * Past chats, in a column beside the current one.
 *
 * Same split treatment as the purchase order: it takes width from the
 * conversation rather than covering it, so you can read a past thread and the
 * live one at the same time.
 */
export default function ChatHistoryPanel({
  chats,
  currentId,
  onOpen,
  onClose,
}: {
  chats: PastChat[];
  currentId: string | null;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside className="flex h-full w-[35%] min-w-[280px] max-w-[400px] shrink-0 flex-col border-l border-line bg-bg">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-line-soft px-4 py-3">
        <span className="flex-1 text-[13px] font-medium text-txt">Past chats</span>
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <p className="px-4 py-4 text-[12.5px] leading-relaxed text-txt-faint">
            Nothing here yet. Chats land here when you start a new one.
          </p>
        ) : (
          chats.map((c) => (
            <button
              key={c.id}
              onClick={() => onOpen(c.id)}
              className={`flex w-full flex-col items-start gap-1 border-b border-line-soft px-4 py-3 text-left transition-colors hover:bg-raised ${
                c.id === currentId ? "bg-raised" : ""
              }`}
            >
              <span className="line-clamp-2 text-[12.5px] leading-snug text-txt">{c.title}</span>
              <span className="text-[11px] text-txt-faint">{when(c.at)}</span>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

/** Short relative date — enough to find a thread, not a full timestamp. */
function when(at: number) {
  const mins = Math.round((Date.now() - at) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
