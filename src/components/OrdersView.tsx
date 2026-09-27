"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Section, { slugOf } from "@/components/Section";
import PurchaseOrderDoc from "@/components/PurchaseOrderDoc";
import { PURCHASE_ORDERS, GST_RATE, materialById, vendorById, type PurchaseOrder } from "@/lib/data";
import { cardFromOrder } from "@/lib/cards";
import { allOrders } from "@/lib/session-orders";

/**
 * The purchase orders list and a single order, in the browser.
 *
 * Client-side so it can include orders raised in chat this session, which
 * only the browser holds. The first render uses the seeded list so the server
 * and browser agree; the session's orders join straight after.
 */
export default function OrdersView({ target }: { target: string }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>(PURCHASE_ORDERS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOrders(allOrders());
    setReady(true);
  }, []);

  // One PO can span several materials — each is a row; group them back up.
  const groups = group(orders);

  if (target) {
    const rows = groups.find((g) => slugOf(g[0].poNumber) === target);
    if (!rows) {
      // A session order isn't known until the browser has loaded it.
      if (!ready) return null;
      return (
        <Section title="Purchase orders" summary="That order is not on this project.">
          <Back label="Back to all orders" />
        </Section>
      );
    }
    // Same heading and same width as the list, so opening an order reads as
    // going one level deeper rather than landing on an unrelated screen.
    return (
      <Section title={<Crumb here={rows[0].poNumber} />}>
        {/* The same document the agent shows when it drafts one — reached
            from the list instead of from the conversation. */}
        <div className="overflow-hidden rounded-[10px] border border-line bg-bg">
          <PurchaseOrderDoc card={cardFromOrder(rows)} issued />
        </div>
      </Section>
    );
  }

  return (
    <Section title="Purchase orders" summary={count(groups.length)}>
      <div className="space-y-2">
        {groups.map((rows) => {
          const order = rows[0];
          const vendor = vendorById(order.vendorId);
          const materials = rows
            .map((r) => materialById(r.materialId))
            .map((m) => (m ? `${m.name} (${m.spec})` : "—"))
            .join(", ");
          const total = rows.reduce((n, r) => n + r.qty * r.rate, 0) * (1 + GST_RATE);

          return (
            <Link
              key={order.poNumber}
              href={`/orders/${slugOf(order.poNumber)}`}
              className="flex items-center gap-4 rounded-[10px] border border-line bg-bg px-4 py-3 transition-colors hover:bg-raised"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2.5">
                  <span className="text-[14px] font-medium tabular-nums text-txt">
                    {order.poNumber}
                  </span>
                  <Status status={order.status} />
                </p>
                <p className="mt-1 truncate text-[12px] text-txt-dim">
                  {vendor?.name ?? "—"} · {materials}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[14px] tabular-nums text-txt">{money(total)}</p>
                <p className="mt-0.5 text-[12px] text-txt-faint">
                  {order.status === "Delivered" ? "Delivered" : "Expected"} {when(order.expectedOn)}
                </p>
              </div>

              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-txt-faint"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          );
        })}
      </div>
    </Section>
  );
}

/** Rows grouped by PO number, newest PO first. */
function group(orders: PurchaseOrder[]) {
  const by = new Map<string, PurchaseOrder[]>();
  for (const o of orders) by.set(o.poNumber, [...(by.get(o.poNumber) ?? []), o]);
  return Array.from(by.values()).sort((a, b) => b[0].poNumber.localeCompare(a[0].poNumber));
}

/**
 * Which order you are in, and the way out of it.
 *
 * The arrow carries the going-back; naming the section beside it only repeats
 * what the rail already has highlighted.
 */
function Crumb({ here }: { here: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <Link
        href="/orders"
        aria-label="Back to purchase orders"
        className="-ml-1 shrink-0 rounded-[6px] p-1 text-txt-dim transition-colors hover:bg-raised hover:text-txt"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </Link>
      <span className="tabular-nums">{here}</span>
    </span>
  );
}

/** The way back out, for a record that is not there. */
function Back({ label }: { label: string }) {
  return (
    <Link
      href="/orders"
      className="group inline-flex items-center gap-2 text-[14px] text-txt-dim transition-colors hover:text-txt"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 transition-transform duration-150 group-hover:-translate-x-0.5"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      <span className="tabular-nums">{label}</span>
    </Link>
  );
}

/** Delivered is settled, anything else is still money in the air. */
function Status({ status }: { status: string }) {
  const done = status === "Delivered";
  return (
    <span
      className={`rounded-full px-2 py-[2px] text-[11px] font-medium ${
        done ? "bg-raised text-txt-dim" : "bg-accent-soft text-accent-ink"
      }`}
    >
      {status}
    </span>
  );
}

const count = (n: number) => `${n} purchase order${n === 1 ? "" : "s"}`;

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
