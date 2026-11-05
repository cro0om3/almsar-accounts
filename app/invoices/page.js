import DocDesk from "../../components/DocDesk";
import { getSettings, invoicesForDesk } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const [docs, settings] = await Promise.all([invoicesForDesk(), getSettings()]);
  return <DocDesk kind="invoice" docs={docs} defaultTerms={settings.invoiceTerms} />;
}
