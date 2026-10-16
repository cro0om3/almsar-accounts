import DocDesk from "../../components/DocDesk";
import { quotesForDesk } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default function QuotesPage() {
  return <DocDesk kind="quote" docs={quotesForDesk()} />;
}
