import DocDesk from "../../components/DocDesk";
import { getSettings, quotesForDesk } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const [docs, settings] = await Promise.all([quotesForDesk(), getSettings()]);
  return <DocDesk kind="quote" docs={docs} defaultTerms={settings.quoteTerms} />;
}
