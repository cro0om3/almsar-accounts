import PoForm from "../../../components/PoForm";
import { blankPurchaseOrder, getPurchaseOrder, listVehicles, listVendors } from "../../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderEditor({ params }) {
  const { id } = await params;
  const doc = id === "new" ? await blankPurchaseOrder() : await getPurchaseOrder(id);
  if (!doc) return null;
  return <PoForm doc={doc} vendors={await listVendors()} vehicles={await listVehicles()} />;
}
