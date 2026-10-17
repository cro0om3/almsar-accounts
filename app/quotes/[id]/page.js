import { notFound } from "next/navigation";
import DocForm from "../../../components/DocForm";
import { blankQuote, getQuote, listCustomers, listQuotes, listVehicles, quoteFromQuote } from "../../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function QuoteEditorPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const customers = await listCustomers();
  const vehicles = await listVehicles();
  const quotes = id === "new" ? await listQuotes() : [];
  const doc = id === "new" && query.fromQuote
    ? await quoteFromQuote(query.fromQuote)
    : id === "new"
      ? await blankQuote()
      : await getQuote(id);
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
