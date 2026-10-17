import ReceiptDesk from "../../components/ReceiptDesk";
import { receiptsForDesk } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
  return <ReceiptDesk docs={await receiptsForDesk()} />;
}
