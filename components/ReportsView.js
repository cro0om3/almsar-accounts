"use client";

import Link from "next/link";
import { useI18n } from "./I18nProvider";
import { aed } from "../lib/money";

export default function ReportsView({ stats, rows }) {
  const { t } = useI18n();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t.reports}</h1>
          <p className="lead">{t.openInvoices}</p>
        </div>
      </div>
      <section className="grid-3">
        <article className="panel"><h2>{t.invoices}</h2><b className="report-stat">{stats.invoices}</b><p className="money">{aed(stats.billed)}</p></article>
        <article className="panel"><h2>{t.quotations}</h2><b className="report-stat">{stats.quotes}</b><p className="money">{aed(stats.quoteValue)}</p></article>
        <article className="panel"><h2>{t.outstanding}</h2><b className="report-stat money orange">{aed(stats.outstanding)}</b></article>
      </section>
      <section className="report-cards">
        {rows.length === 0 ? <p className="desk-empty">{t.noRecords}</p> : rows.map((row) => (
          <article className="report-card" key={row.id}>
            <div className="line-card-top">
              <Link href={`/invoices/${row.id}`}><b>{row.number}</b></Link>
              <strong className="money">{aed(row.total)}</strong>
            </div>
            <span>{row.customerName || "—"}</span>
            <small>{String(row.date || "").slice(0, 10)} · {t.due} {aed((Number(row.total) || 0) - (Number(row.amountReceived) || 0))}</small>
          </article>
        ))}
      </section>
      <section className="table-card report-table" style={{ marginTop: 14 }}>
        <table>
          <thead>
            <tr>
              <th>{t.invoices}</th>
              <th>{t.customer}</th>
              <th>{t.date}</th>
              <th>{t.total}</th>
              <th>{t.received}</th>
              <th>{t.due}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6}>{t.noRecords}</td></tr>
            ) : rows.map((row) => (
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
