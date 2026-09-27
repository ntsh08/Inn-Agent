import OrdersView from "@/components/OrdersView";

export const metadata = { title: "Purchase orders — INA Procure" };

/** No slug lists the orders; a slug opens that one as a document. */
export default function OrdersPage({ params }: { params: { slug?: string[] } }) {
  return <OrdersView target={params.slug?.join("/") ?? ""} />;
}
