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
  const customers = listCustomers();
  const vehicles = listVehicles();
  const quotes = listQuotes();
  const invoices = listInvoices();
  let doc;
  if (id === "new" && query.fromQuote) {
    doc = invoiceFromQuote(query.fromQuote);
  } else if (id === "new" && query.fromInvoice) {
    doc = invoiceFromInvoice(query.fromInvoice);
  } else if (id === "new") {
    doc = blankInvoice();
  } else {
    doc = getInvoice(id);
  }
  if (!doc) notFound();
  return (
    <DocForm
      kind="invoice"
      doc={doc}
      customers={customers}
      vehicles={vehicles}
      quotes={quotes}
      invoices={invoices}
    />
  );
}
