/**
 * Purchase orders raised in this browser session.
 *
 * The prototype has no database, and on serverless the server's memory does
 * not survive between requests — so a PO raised in chat used to vanish before
 * the orders page could see it. The browser keeps them instead, for as long
 * as the tab is open, and hands them back to the server on every chat turn so
 * the agent sees them too.
 */

import { PURCHASE_ORDERS, type PurchaseOrder } from "./data";

const KEY = "ina-procure:orders";

export function loadSessionOrders(): PurchaseOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PurchaseOrder[]) : [];
  } catch {
    return [];
  }
}

export function addSessionOrders(orders: PurchaseOrder[]) {
  if (!orders.length) return;
  const merged = mergeOrders(loadSessionOrders(), orders);
  try {
    sessionStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // A blocked store just means this session forgets them on reload.
  }
}

/** The seeded orders plus anything raised this session, without duplicates. */
export function allOrders(): PurchaseOrder[] {
  return mergeOrders(PURCHASE_ORDERS, loadSessionOrders());
}

/** One row per PO number and material — the same order never appears twice. */
export function mergeOrders(base: PurchaseOrder[], extra: PurchaseOrder[]) {
  const key = (o: PurchaseOrder) => `${o.poNumber}|${o.materialId}`;
  const seen = new Set(base.map(key));
  return [...base, ...extra.filter((o) => !seen.has(key(o)))];
}
