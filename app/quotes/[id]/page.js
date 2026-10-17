import { notFound } from "next/navigation";
import DocForm from "../../../components/DocForm";
import { blankQuote, getQuote, listCustomers, listQuotes, listVehicles, quoteFromQuote } from "../../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function QuoteEditorPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const [customers, vehicles, quotes, doc] = await Promise.all([
    listCustomers(),
    listVehicles(),
    id === "new" ? listQuotes() : Promise.resolve([]),
    id === "new" && query.fromQuote ? quoteFromQuote(query.fromQuote) : id === "new" ? blankQuote() : getQuote(id),
  ]);
  if (!doc) notFound();
  return (
    <DocForm
      key={id === "new" ? (query.fromQuote || "blank") : id}
      kind="quote"
      doc={doc}
      customers={customers}
      vehicles={vehicles}
      quotes={quotes}
      askCopy={id === "new" && !query.fromQuote}
    />
  );
}
