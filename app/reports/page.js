import Link from "next/link";
import PageHead from "../../components/PageHead";
import { dashboard, listInvoices } from "../../lib/accounts";
import { aed } from "../../lib/money";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  const data = dashboard();
  const open = listInvoices().filter((row) => (Number(row.amountReceived) || 0) < (Number(row.total) || 0));
  return (
    <>
      <PageHead title="reports" />
      <section className="grid-3">
        <article className="panel"><h2>Invoices</h2><b>{data.invoices}</b><p className="money">{aed(data.billed)}</p></article>
        <article className="panel"><h2>Quotes</h2><b>{data.quotes}</b><p className="money">{aed(data.quoteValue)}</p></article>
        <article className="panel"><h2>Outstanding</h2><b className="money orange">{aed(data.outstanding)}</b></article>
      </section>
      <section className="table-card" style={{ marginTop: 14 }}>
        <table>
          <thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Total</th><th>Received</th><th>Due</th></tr></thead>
          <tbody>
            {open.map((row) => (
              <tr key={row.id}>
                <td><Link href={`/invoices/${row.id}`}>{row.number}</Link></td>
                <td>{row.customerName || "—"}</td>
                <td>{String(row.date || "").slice(0, 10)}</td>
                <td>{aed(row.total)}</td>
                <td>{aed(row.amountReceived)}</td>
                <td className="orange">{aed((Number(row.total) || 0) - (Number(row.amountReceived) || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
