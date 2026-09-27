import InventoryView from "@/components/InventoryView";

export const metadata = { title: "Inventory — INA Procure" };

/** Optional slug so a cited material lands on its own row. */
export default function InventoryPage({ params }: { params: { slug?: string[] } }) {
  return <InventoryView target={params.slug?.join("/") ?? ""} />;
}
