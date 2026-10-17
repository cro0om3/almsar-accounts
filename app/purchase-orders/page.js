import DocDesk from "../../components/DocDesk";
import { purchaseOrdersForDesk } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage() {
  return <DocDesk kind="po" docs={await purchaseOrdersForDesk()} />;
}
