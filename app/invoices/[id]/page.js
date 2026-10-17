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
  const customers = await listCustomers();
  const vehicles = await listVehicles();
  const quotes = await listQuotes();
  const invoices = await listInvoices();
  let doc;
  if (id === "new" && query.fromQuote) {
    doc = await invoiceFromQuote(query.fromQuote);
  } else if (id === "new" && query.fromInvoice) {
    doc = await invoiceFromInvoice(query.fromInvoice);
  } else if (id === "new") {
    doc = await blankInvoice();
  } else {
    doc = await getInvoice(id);
  }
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
