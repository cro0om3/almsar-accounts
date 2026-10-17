import PoForm from "../../../components/PoForm";
import { blankPurchaseOrder, getPurchaseOrder, listVehicles, listVendors } from "../../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderEditor({ params }) {
  const { id } = await params;
  const [doc, vendors, vehicles] = await Promise.all([
    id === "new" ? blankPurchaseOrder() : getPurchaseOrder(id),
    listVendors(),
    listVehicles(),
  ]);
  if (!doc) return null;
  return <PoForm doc={doc} vendors={vendors} vehicles={vehicles} />;
}
