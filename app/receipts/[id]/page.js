import { notFound } from "next/navigation";
import ReceiptForm from "../../../components/ReceiptForm";
import { blankReceipt, getReceipt, listCustomers, listInvoices } from "../../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function ReceiptEditorPage({ params }) {
  const { id } = await params;
  const [customers, invoices, doc] = await Promise.all([
    listCustomers(),
    listInvoices(),
    id === "new" ? blankReceipt() : getReceipt(id),
  ]);
  if (!doc) notFound();
  return <ReceiptForm doc={doc} customers={customers} invoices={invoices} />;
}
