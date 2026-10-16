import { notFound } from "next/navigation";
import DocForm from "../../../components/DocForm";
import { blankQuote, getQuote, listCustomers, listVehicles } from "../../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function QuoteEditorPage({ params }) {
  const { id } = await params;
  const customers = listCustomers();
  const vehicles = listVehicles();
  const doc = id === "new" ? blankQuote() : getQuote(id);
  if (!doc) notFound();
  return <DocForm kind="quote" doc={doc} customers={customers} vehicles={vehicles} />;
}
