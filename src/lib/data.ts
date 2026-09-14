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
    neededBy: "2026-09-18",
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
    neededBy: "2026-09-22",
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
    neededBy: "2026-09-20",
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
    neededBy: "2026-09-18",
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
    neededBy: "2026-09-22",
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
    neededBy: "2026-09-20",
    activity: "Tower 1 — Level 4 reinforcement",
  },
];

export type Vendor = {
  id: string;
  name: string;
  approved: boolean;
  rating: number;
  onTimePct: number;
  location: string;
  supplies: string[];
};

export const VENDORS: Vendor[] = [
  {
    id: "ven_acme",
    name: "Acme Building Materials",
    approved: true,
    rating: 4.6,
    onTimePct: 94,
    location: "Hyderabad",
    supplies: ["mat_opc53", "mat_ply12", "mat_bwire"],
  },
  {
    id: "ven_deccan",
    name: "Deccan Cements Ltd",
    approved: true,
    rating: 4.2,
    onTimePct: 81,
    location: "Nalgonda",
    supplies: ["mat_opc53", "mat_rmc30"],
  },
  {
    id: "ven_ganesh",
    name: "Sri Ganesh Traders",
    approved: true,
    rating: 4.8,
    onTimePct: 97,
    location: "Hyderabad",
    supplies: ["mat_opc53", "mat_bwire", "mat_cover"],
  },
  {
    id: "ven_steelco",
    name: "SteelCo Industries",
    approved: true,
    rating: 4.5,
    onTimePct: 89,
    location: "Vijayawada",
    supplies: ["mat_tmt16"],
  },
  {
    id: "ven_bharat",
    name: "Bharat Steel & Alloys",
    approved: true,
    rating: 4.1,
    onTimePct: 76,
    location: "Raipur",
    supplies: ["mat_tmt16"],
  },
  {
    id: "ven_lowcost",
    name: "Value Traders",
    approved: false,
    rating: 3.4,
    onTimePct: 62,
    location: "Hyderabad",
    supplies: ["mat_opc53", "mat_ply12"],
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
  { vendorId: "ven_acme", materialId: "mat_opc53", rate: 395, leadDays: 3, moq: 100, validTill: "2026-09-25" },
  { vendorId: "ven_deccan", materialId: "mat_opc53", rate: 372, leadDays: 8, moq: 500, validTill: "2026-09-30" },
  { vendorId: "ven_ganesh", materialId: "mat_opc53", rate: 408, leadDays: 2, moq: 50, validTill: "2026-09-20" },
  { vendorId: "ven_steelco", materialId: "mat_tmt16", rate: 62400, leadDays: 6, moq: 5, validTill: "2026-09-28" },
  { vendorId: "ven_bharat", materialId: "mat_tmt16", rate: 59800, leadDays: 11, moq: 10, validTill: "2026-09-30" },
  { vendorId: "ven_acme", materialId: "mat_ply12", rate: 1850, leadDays: 4, moq: 25, validTill: "2026-09-26" },
  { vendorId: "ven_deccan", materialId: "mat_rmc30", rate: 5200, leadDays: 2, moq: 30, validTill: "2026-09-22" },
];

export type RateHistoryEntry = {
  materialId: string;
  vendorId: string;
  rate: number;
  orderedOn: string;
  qty: number;
};

export const RATE_HISTORY: RateHistoryEntry[] = [
  { materialId: "mat_opc53", vendorId: "ven_acme", rate: 388, orderedOn: "2026-08-12", qty: 600 },
  { materialId: "mat_opc53", vendorId: "ven_acme", rate: 381, orderedOn: "2026-07-04", qty: 450 },
  { materialId: "mat_opc53", vendorId: "ven_ganesh", rate: 402, orderedOn: "2026-06-19", qty: 200 },
  { materialId: "mat_tmt16", vendorId: "ven_steelco", rate: 61200, orderedOn: "2026-08-02", qty: 18 },
  { materialId: "mat_ply12", vendorId: "ven_acme", rate: 1790, orderedOn: "2026-07-28", qty: 80 },
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

/** Seeded with a couple of live orders so po_search has something to return. */
export const PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "po_1",
    poNumber: "PO-2026-0412",
    vendorId: "ven_steelco",
    materialId: "mat_tmt16",
    qty: 18,
    rate: 61200,
    status: "In Transit",
    raisedOn: "2026-09-04",
    expectedOn: "2026-09-15",
  },
  {
    id: "po_2",
    poNumber: "PO-2026-0398",
    vendorId: "ven_acme",
    materialId: "mat_ply12",
    qty: 80,
    rate: 1790,
    status: "Delivered",
    raisedOn: "2026-08-24",
    expectedOn: "2026-08-30",
  },
];

export const GST_RATE = 0.28;

export function materialById(id: string) {
  return MATERIALS.find((m) => m.id === id);
}
export function vendorById(id: string) {
  return VENDORS.find((v) => v.id === id);
}
export function available(m: Material) {
  return m.inStock - m.reserved;
}
export function shortfall(m: Material) {
  return Math.max(0, m.required - available(m));
}
export function daysUntil(dateStr: string) {
  const from = new Date(PROJECT.today).getTime();
  const to = new Date(dateStr).getTime();
  return Math.round((to - from) / 86400000);
}
