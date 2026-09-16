"use client";

import { useEffect } from "react";
import type { Source } from "@/lib/sources";
import { slug } from "@/lib/sources";
import PurchaseOrderDoc from "./PurchaseOrderDoc";
import { cardFromOrder } from "@/lib/cards";
import {
  MATERIALS,
  PURCHASE_ORDERS,
  QUOTES,
  VENDORS,
  available,
  shortfall,
  materialById,
  vendorById,
} from "@/lib/data";

/**
 * The record behind a citation, beside the conversation that cited it.
 *
 * Checking where a number came from should never cost you the thread you were
 * reading it in — so a source opens here rather than navigating away. It shows
 * the cited record when there is one, and the register it came from when there
 * is not.
 */
export default function SourcePanel({
  source,
  onClose,
}: {
  source: Source;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const register = source.page.split("/")[1] ?? "";

  return (
    <aside className="flex h-full w-[45%] min-w-[380px] max-w-[620px] shrink-0 flex-col border-l border-line bg-bg">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-line-soft px-4 py-3">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-txt">
          {source.label}
          {source.record && (
            <span className="text-txt-faint"> / {source.record}</span>
          )}
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Body register={register} record={source.record} />
      </div>
    </aside>
  );
}

function Body({ register, record }: { register: string; record?: string }) {
  if (register === "orders") {
    const po = record
      ? PURCHASE_ORDERS.find((p) => slug(p.poNumber) === slug(record))
      : null;

    // A cited order shows as the order, not as a row in a list.
    if (po) return <PurchaseOrderDoc card={cardFromOrder(po)} issued />;

    return (
      <Rows>
        {PURCHASE_ORDERS.map((p) => (
          <Row
            key={p.id}
            title={p.poNumber}
            note={`${vendorById(p.vendorId)?.name ?? ""} · ${materialById(p.materialId)?.name ?? ""}`}
            value={p.status}
          />
        ))}
      </Rows>
    );
  }

  if (register === "inventory" || register === "catalogue") {
    return (
      <Rows>
        {MATERIALS.map((m) => {
          const gap = shortfall(m);
          return (
            <Row
              key={m.id}
              cited={!!record && slug(`${m.name} (${m.spec})`) === slug(record)}
              title={`${m.name} (${m.spec})`}
              note={`${fmt(available(m))} ${m.unit} available of ${fmt(m.required)} needed`}
              value={gap > 0 ? `${fmt(gap)} ${m.unit} short` : "In stock"}
              tone={gap > 0 ? "bad" : undefined}
            />
          );
        })}
      </Rows>
    );
  }

  if (register === "vendors") {
    return (
      <Rows>
        {VENDORS.filter((v) => v.approved).map((v) => (
          <Row
            key={v.id}
            cited={!!record && slug(v.name) === slug(record)}
            title={v.name}
            note={v.location}
            value={`${v.rating} · ${v.onTimePct}% on time`}
          />
        ))}
      </Rows>
    );
  }

  if (register === "quotes") {
    const material = record
      ? MATERIALS.find((m) => slug(`${m.name} (${m.spec})`) === slug(record) || slug(m.name) === slug(record))
      : null;
    const quotes = QUOTES.filter((q) => !material || q.materialId === material.id);

    return (
      <Rows>
        {quotes.map((q) => {
          const m = materialById(q.materialId);
          return (
            <Row
              key={`${q.vendorId}-${q.materialId}`}
              title={vendorById(q.vendorId)?.name ?? q.vendorId}
              note={`${m?.name ?? ""} · ${q.leadDays} day lead · min ${fmt(q.moq)} ${m?.unit ?? ""}`}
              value={`₹${fmt(q.rate)}`}
            />
          );
        })}
      </Rows>
    );
  }

  return <p className="px-4 py-4 text-[12.5px] text-txt-faint">Nothing to show here.</p>;
}

function Rows({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-2">{children}</div>;
}

function Row({
  title,
  note,
  value,
  cited,
  tone,
}: {
  title: string;
  note?: string;
  value?: string;
  /** The row the citation actually pointed at. */
  cited?: boolean;
  tone?: "bad";
}) {
  return (
    <div
      className={`flex items-start gap-3 border-b border-line-soft px-2 py-2.5 last:border-b-0 ${
        cited ? "-mx-2 rounded-[6px] bg-accent-soft/60 px-4" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] text-txt">{title}</p>
        {note && <p className="mt-0.5 text-[11.5px] text-txt-faint">{note}</p>}
      </div>
      {value && (
        <span
          className={`shrink-0 text-[12px] tabular-nums ${
            tone === "bad" ? "text-danger" : "text-txt-dim"
          }`}
        >
          {value}
        </span>
      )}
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("en-IN");
