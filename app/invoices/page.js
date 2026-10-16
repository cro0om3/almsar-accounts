import DocDesk from "../../components/DocDesk";
import { invoicesForDesk } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default function InvoicesPage() {
  return <DocDesk kind="invoice" docs={invoicesForDesk()} />;
}
