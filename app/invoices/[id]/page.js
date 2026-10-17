import { notFound } from "next/navigation";
import DocForm from "../../../components/DocForm";
import {
  blankInvoice,
  getInvoice,
  invoiceFromInvoice,
  invoiceFromQuote,
  listCustomers,
  listInvoices,
  listQuotes,
  listVehicles,
} from "../../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function InvoiceEditorPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const copying = id === "new" && !query.fromQuote && !query.fromInvoice;
  const [customers, vehicles, quotes, invoices, doc] = await Promise.all([
    listCustomers(),
    listVehicles(),
    listQuotes(),
    copying ? listInvoices() : Promise.resolve([]),
    id === "new" && query.fromQuote ? invoiceFromQuote(query.fromQuote) : id === "new" && query.fromInvoice ? invoiceFromInvoice(query.fromInvoice) : id === "new" ? blankInvoice() : getInvoice(id),
  ]);
  if (!doc) notFound();
  return (
    <DocForm
      key={id === "new" ? (query.fromInvoice || query.fromQuote || "blank") : id}
      kind="invoice"
      doc={doc}
      customers={customers}
      vehicles={vehicles}
      quotes={quotes}
      invoices={invoices}
      askCopy={id === "new" && !query.fromQuote && !query.fromInvoice}
    />
  );
}
