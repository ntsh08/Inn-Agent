/**
 * Mock procurement data.
 *
 * Everything the agent "knows" lives here. The model is real; the records are
 * staged. Rates, stock and vendors are invented but shaped like the real thing
 * so the demo reads as plausible to someone who buys materials for a living.
 */

/** Who is signed in. Real auth would supply this; the prototype stages it. */
export const USER = {
  firstName: "Nitish",
  /** Drop a file in /public and point this at it to show a real photo. */
  avatar: "",
};

export const PROJECT = {
  id: "prj_highrise",
  name: "Acme Project",
  packageName: "Core-1",
  site: "Tower 1 — Site Store",
  today: "2026-09-13",
};

export type Material = {
  id: string;
  name: string;
  spec: string;
  unit: string;
  inStock: number;
  reserved: number;
  required: number;
  neededBy: string;
  activity: string;
};

/** Stock on hand vs what the plan needs. Shortfall = required - (inStock - reserved). */
export const MATERIALS: Material[] = [
  {
    id: "mat_opc53",
    name: "Cement",
    spec: "OPC 53 Grade",
    unit: "bags",
    inStock: 160,
    reserved: 0,
    required: 800,
    neededBy: "2026-09-25",
    activity: "Tower 1 — Level 4 slab pour",
  },
  {
    id: "mat_tmt16",
    name: "TMT Steel Bar",
    spec: "Fe 500D — 16mm",
    unit: "tonnes",
    inStock: 3.2,
    reserved: 0,
    required: 24,
    neededBy: "2026-09-28",
    activity: "Tower 1 — Level 4 reinforcement",
  },
  {
    id: "mat_ply12",
    name: "Shuttering Plywood",
    spec: "12mm film-faced",
    unit: "sheets",
    inStock: 95,
    reserved: 20,
    required: 120,
    neededBy: "2026-09-27",
    activity: "Tower 1 — Level 4 formwork",
  },
  {
    id: "mat_rmc30",
    name: "Ready Mix Concrete",
    spec: "M30",
    unit: "cu.m",
    inStock: 0,
    reserved: 0,
    required: 180,
    neededBy: "2026-09-26",
    activity: "Tower 1 — Level 4 slab pour",
  },
  {
    id: "mat_bwire",
    name: "Binding Wire",
    spec: "18 SWG",
    unit: "kg",
    inStock: 420,
    reserved: 0,
    required: 400,
    neededBy: "2026-09-28",
    activity: "Tower 1 — Level 4 reinforcement",
  },
  {
    id: "mat_cover",
    name: "Cover Blocks",
    spec: "25mm PVC",
    unit: "nos",
    inStock: 6000,
    reserved: 500,
    required: 4500,
    neededBy: "2026-09-27",
    activity: "Tower 1 — Level 4 reinforcement",
  },
];

export type Vendor = {
  id: string;
  name: string;
  rating: number;
  onTimePct: number;
  location: string;
  supplies: string[];
};

export const VENDORS: Vendor[] = [
  {
    id: "ven_acme",
    name: "Acme Building Materials",
    rating: 4.6,
    onTimePct: 94,
    location: "Hyderabad",
    supplies: ["mat_opc53", "mat_ply12", "mat_rmc30", "mat_bwire", "mat_cover"],
  },
  {
    id: "ven_deccan",
    name: "Deccan Cements Ltd",
    rating: 4.2,
    onTimePct: 81,
    location: "Nalgonda",
    supplies: ["mat_opc53", "mat_rmc30"],
  },
  {
    id: "ven_ganesh",
    name: "Sri Ganesh Traders",
    rating: 4.8,
    onTimePct: 97,
    location: "Hyderabad",
    supplies: ["mat_opc53", "mat_ply12", "mat_bwire", "mat_cover"],
  },
  {
    id: "ven_steelco",
    name: "SteelCo Industries",
    rating: 4.5,
    onTimePct: 89,
    location: "Vijayawada",
    supplies: ["mat_tmt16", "mat_bwire"],
  },
  {
    id: "ven_bharat",
    name: "Bharat Steel & Alloys",
    rating: 4.1,
    onTimePct: 76,
    location: "Raipur",
    supplies: ["mat_tmt16"],
  },
];

export type Quote = {
  vendorId: string;
  materialId: string;
  rate: number;
  leadDays: number;
  moq: number;
  validTill: string;
};

/** Live quotes, keyed by material. Rate is per unit, in INR. */
export const QUOTES: Quote[] = [
  { vendorId: "ven_acme", materialId: "mat_opc53", rate: 395, leadDays: 3, moq: 100, validTill: "2026-09-30" },
  { vendorId: "ven_deccan", materialId: "mat_opc53", rate: 372, leadDays: 8, moq: 500, validTill: "2026-09-30" },
  { vendorId: "ven_ganesh", materialId: "mat_opc53", rate: 408, leadDays: 2, moq: 50, validTill: "2026-09-30" },
  { vendorId: "ven_steelco", materialId: "mat_tmt16", rate: 62400, leadDays: 6, moq: 5, validTill: "2026-09-30" },
  { vendorId: "ven_bharat", materialId: "mat_tmt16", rate: 59800, leadDays: 11, moq: 10, validTill: "2026-09-30" },
  { vendorId: "ven_acme", materialId: "mat_ply12", rate: 1850, leadDays: 4, moq: 25, validTill: "2026-09-30" },
  { vendorId: "ven_ganesh", materialId: "mat_ply12", rate: 1790, leadDays: 6, moq: 20, validTill: "2026-09-30" },
  { vendorId: "ven_deccan", materialId: "mat_rmc30", rate: 5200, leadDays: 2, moq: 30, validTill: "2026-09-30" },
  { vendorId: "ven_acme", materialId: "mat_rmc30", rate: 5350, leadDays: 3, moq: 20, validTill: "2026-09-30" },
  { vendorId: "ven_steelco", materialId: "mat_bwire", rate: 78, leadDays: 6, moq: 100, validTill: "2026-09-30" },
  { vendorId: "ven_ganesh", materialId: "mat_bwire", rate: 80, leadDays: 2, moq: 50, validTill: "2026-09-30" },
  { vendorId: "ven_ganesh", materialId: "mat_cover", rate: 4, leadDays: 2, moq: 500, validTill: "2026-09-30" },
  { vendorId: "ven_acme", materialId: "mat_cover", rate: 4.2, leadDays: 3, moq: 1000, validTill: "2026-09-30" },
];

export type PurchaseOrder = {
  id: string;
  poNumber: string;
  vendorId: string;
  materialId: string;
  qty: number;
  rate: number;
  status: "Draft" | "Issued" | "In Transit" | "Delivered";
  raisedOn: string;
  expectedOn: string;
};

/**
 * Orders already on this project. One PO is one row per material — they
 * share the PO number — because nobody raises a purchase order for a single
 * item. Only materials from the inventory list appear here.
 */
const po = (
  id: string, poNumber: string, vendorId: string, materialId: string, qty: number, rate: number,
  status: PurchaseOrder["status"], raisedOn: string, expectedOn: string,
): PurchaseOrder => ({ id, poNumber, vendorId, materialId, qty, rate, status, raisedOn, expectedOn });

export const PURCHASE_ORDERS: PurchaseOrder[] = [
  // Steel for the Level 4 reinforcement, still on the way.
  po("po_1", "PO-2026-0412", "ven_steelco", "mat_tmt16", 18, 61200, "In Transit", "2026-09-04", "2026-09-15"),
  po("po_2", "PO-2026-0412", "ven_steelco", "mat_bwire", 200, 76, "In Transit", "2026-09-04", "2026-09-15"),
  // Formwork materials, delivered.
  po("po_3", "PO-2026-0398", "ven_acme", "mat_ply12", 80, 1790, "Delivered", "2026-08-24", "2026-08-30"),
  po("po_4", "PO-2026-0398", "ven_acme", "mat_bwire", 300, 78, "Delivered", "2026-08-24", "2026-08-30"),
  po("po_5", "PO-2026-0398", "ven_acme", "mat_cover", 3000, 4, "Delivered", "2026-08-24", "2026-08-30"),
  // The last cement order — the ₹388 a bag the agent compares new quotes against.
  po("po_6", "PO-2026-0401", "ven_acme", "mat_opc53", 500, 388, "Delivered", "2026-08-12", "2026-08-14"),
  po("po_7", "PO-2026-0401", "ven_acme", "mat_cover", 2500, 4, "Delivered", "2026-08-12", "2026-08-14"),
];

/** The next PO number — one past the highest, however many items each PO holds. */
export function nextPoNumber(orders: PurchaseOrder[] = PURCHASE_ORDERS) {
  const top = Math.max(0, ...orders.map((o) => Number(o.poNumber.split("-").pop()) || 0));
  return `PO-2026-${String(top + 1).padStart(4, "0")}`;
}

export const GST_RATE = 0.18;

/**
 * An order as it will be raised: today's quoted rate, and at least the
 * vendor's minimum. Applied in code because the model reached for what we
 * paid last time (₹61,200 steel against a ₹62,400 quote) and ordered below
 * the minimum. Items without a live quote from that vendor are left as sent.
 */
export function asQuoted<T extends { vendorId: string; items?: { materialId: string; quantity: number; rate: number }[] }>(
  order: T,
): T {
  return {
    ...order,
    items: (order.items ?? []).map((it) => {
      const q = QUOTES.find((x) => x.vendorId === order.vendorId && x.materialId === it.materialId);
      return q ? { ...it, rate: q.rate, quantity: Math.max(it.quantity, q.moq) } : it;
    }),
  };
}

export function materialById(id: string) {
  return MATERIALS.find((m) => m.id === id);
}
export function vendorById(id: string) {
  return VENDORS.find((v) => v.id === id);
}
/**
 * Roughly how long this material takes to arrive, averaged over its vendors.
 *
 * Lead time belongs to a quote, not a material — the same cement is 2 days
 * from one vendor and 8 from another — so the table shows the average and
 * leaves the per-vendor spread to a quote comparison, where it is actionable.
 */
export function leadTime(materialId: string) {
  const days = QUOTES.filter((q) => q.materialId === materialId).map((q) => q.leadDays);
  if (!days.length) return null;
  return Math.round(days.reduce((sum, d) => sum + d, 0) / days.length);
}

/**
 * When an order from this vendor would land: today plus the slowest quoted
 * lead time among the materials on it. Null when the vendor has no live quote
 * for one of them — then there is nothing to calculate from.
 */
export function arrivalDate(vendorId: string, materialIds: string[]) {
  const leads = materialIds.map(
    (id) => QUOTES.find((q) => q.vendorId === vendorId && q.materialId === id)?.leadDays,
  );
  if (!leads.length || leads.some((d) => d == null)) return null;
  const d = new Date(PROJECT.today);
  d.setDate(d.getDate() + Math.max(...(leads as number[])));
  return d.toISOString().slice(0, 10);
}

export function available(m: Material) {
  return m.inStock - m.reserved;
}
/**
 * Ordered and not yet delivered. It counts toward covering a shortfall — the
 * agent once ordered 20.8 t of steel with 18 t already on the way.
 */
export function inTransit(materialId: string, orders: PurchaseOrder[] = PURCHASE_ORDERS) {
  return openOrders(materialId, orders).reduce((n, o) => n + o.qty, 0);
}

/** The orders behind inTransit — raised for this material, not yet delivered. */
export function openOrders(materialId: string, orders: PurchaseOrder[] = PURCHASE_ORDERS) {
  return orders.filter(
    (o) => o.materialId === materialId && (o.status === "Issued" || o.status === "In Transit"),
  );
}

/**
 * What still needs ordering: required, less what's free on site, less what's
 * on the way. The table reads left to right as exactly this sum.
 */
export function shortfall(m: Material, orders: PurchaseOrder[] = PURCHASE_ORDERS) {
  const gap = m.required - available(m) - inTransit(m.id, orders);
  return Math.max(0, Math.round(gap * 100) / 100);
}
export function daysUntil(dateStr: string) {
  const from = new Date(PROJECT.today).getTime();
  const to = new Date(dateStr).getTime();
  return Math.round((to - from) / 86400000);
}
