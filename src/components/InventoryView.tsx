"use client";

import { useEffect, useState } from "react";
import Section, { highlight, slugOf } from "@/components/Section";
import { MATERIALS, PURCHASE_ORDERS, available, inTransit, shortfall, type PurchaseOrder } from "@/lib/data";
import { allOrders } from "@/lib/session-orders";

/**
 * Stock against the plan, read left to right as one sum:
 * Required − Available now − In transit = Short by.
 *
 * In the browser so that orders raised in chat this session count as in
 * transit — only the browser holds them.
 */
export default function InventoryView({ target }: { target: string }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>(PURCHASE_ORDERS);
  useEffect(() => setOrders(allOrders()), []);

  return (
    <Section title="Inventory" summary={`${MATERIALS.length} materials`}>
      <div className="overflow-hidden rounded-[10px] border border-line bg-bg">
        {/* Fixed layout so the five figure columns share the width equally,
            rather than each shrinking to whatever it happens to hold. */}
        <table className="w-full table-fixed border-collapse text-[14px]">
          <colgroup>
            <col className="w-[25%]" />
            {[0, 1, 2, 3, 4].map((i) => (
              <col key={i} className="w-[15%]" />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-raised text-left text-[11px] uppercase tracking-[0.06em] text-txt-faint">
              <Th>Material</Th>
              <Th right>Required QTY</Th>
              <Th right title="On site and free to use — stock reserved for other work is left out">
                Available QTY
              </Th>
              <Th right title="Ordered and not yet delivered">In transit QTY</Th>
              <Th right>Short by</Th>
              <Th>Required by</Th>
            </tr>
          </thead>
          <tbody>
            {MATERIALS.map((m) => {
              const coming = inTransit(m.id, orders);
              const gap = shortfall(m, orders);
              const cited =
                !!target &&
                (slugOf(`${m.name} (${m.spec})`) === target ||
                  slugOf(m.name) === target ||
                  m.id === target);

              return (
                <tr
                  key={m.id}
                  id={slugOf(`${m.name} (${m.spec})`)}
                  className={`border-t border-line-soft ${highlight(cited)}`}
                >
                  <Td>
                    <span className="text-txt">{m.name}</span>
                    <span className="block text-[12px] text-txt-faint">{m.spec}</span>
                  </Td>
                  <Td right>{num(m.required)} {m.unit}</Td>
                  <Td right>{num(available(m))} {m.unit}</Td>
                  <Td right>{coming > 0 ? `${num(coming)} ${m.unit}` : <Dash />}</Td>
                  <Td right>
                    {gap > 0 ? (
                      <span className="font-medium text-danger">
                        {num(gap)} {m.unit}
                      </span>
                    ) : (
                      <Dash />
                    )}
                  </Td>
                  {/* The date the vendor has to beat. Quieter when nothing is
                      short, since it no longer drives a decision. */}
                  <Td>
                    <span className={gap > 0 ? "text-txt" : "text-txt-faint"}>{when(m.neededBy)}</span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function Dash() {
  return <span className="text-txt-faint">—</span>;
}

function Th({ children, right, title }: { children: React.ReactNode; right?: boolean; title?: string }) {
  return (
    <th title={title} className={`px-3.5 py-2.5 font-normal ${right ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td className={`px-3.5 py-3 align-top ${right ? "text-right tabular-nums" : ""}`}>
      {children}
    </td>
  );
}

const num = (n: number) => n.toLocaleString("en-IN");

const when = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
