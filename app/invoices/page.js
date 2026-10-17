import DocDesk from "../../components/DocDesk";
import { invoicesForDesk } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  return <DocDesk kind="invoice" docs={await invoicesForDesk()} />;
}
