import ReportsView from "../../components/ReportsView";
import { dashboard, listInvoices } from "../../lib/accounts";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [data, invoices] = await Promise.all([dashboard(), listInvoices()]);
  const rows = invoices
    .filter((row) => (Number(row.amountReceived) || 0) < (Number(row.total) || 0))
    .map((row) => ({
      id: row.id,
      number: row.number,
      customerName: row.customerName || "",
      date: row.date,
      total: row.total,
      amountReceived: row.amountReceived,
    }));
  return (
    <ReportsView
      stats={{ invoices: data.invoices, billed: data.billed, quotes: data.quotes, quoteValue: data.quoteValue, outstanding: data.outstanding }}
      rows={rows}
    />
  );
}
