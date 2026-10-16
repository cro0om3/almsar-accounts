import PoForm from "../../../components/PoForm";
import { blankPurchaseOrder, getPurchaseOrder, listVehicles, listVendors } from "../../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderEditor({ params }) {
  const { id } = await params;
  const doc = id === "new" ? blankPurchaseOrder() : getPurchaseOrder(id);
  if (!doc) return null;
  return <PoForm doc={doc} vendors={listVendors()} vehicles={listVehicles()} />;
}
