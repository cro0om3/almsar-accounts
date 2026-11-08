"use client";

import { useMemo, useState } from "react";
import DateField from "./DateField";
import { useI18n } from "./I18nProvider";
import { aed } from "../lib/money";
import { buildReport, EMPTY_FILTERS, LATER_REPORTS, periodText, REPORT_GROUPS, REPORTS } from "../lib/reports";

const INVOICE_STATUSES = [
  ["", "allStatuses"],
  ["draft", "draft"],
  ["invoice_sent", "sent"],
  ["partial", "partial"],
  ["payment_received", "paid"],
];

const PO_STATUSES = [
  ["", "allStatuses"],
  ["draft", "draft"],
  ["sent", "sent"],
  ["accepted", "accepted"],
];

function show(column, value) {
  if (value === "" || value == null) return "";
  if (column.kind === "money") return aed(value);
  return value;
}

export default function ReportsView({ data, settings }) {
  const { t } = useI18n();
  const [reportId, setReportId] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [busy, setBusy] = useState(false);
  const meta = REPORTS[reportId];
  const report = useMemo(
    () => (meta ? buildReport(reportId, data, filters, t) : null),
    [meta, reportId, data, filters, t]
  );

  function setFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function excel() {
    const { downloadReportExcel } = await import("../lib/report-export");
    await downloadReportExcel({
      id: reportId,
      title: t[meta.title],
      company: settings.companyName,
      period: periodText(filters, t),
      report,
    });
  }

  async function pdf() {
    setBusy(true);
    try {
      const { downloadReportPdf } = await import("../lib/report-export");
      await downloadReportPdf({
        id: reportId,
        title: t[meta.title],
        period: periodText(filters, t),
        report,
        settings,
      });
    } catch (error) {
      console.error(error);
      window.alert(t.pdfFailed);
    } finally {
      setBusy(false);
    }
  }

  if (!meta || !report) {
    return (
      <div className="reports-screen">
        <h1>{t.reports}</h1>
        <p className="reports-sub">{t.reportsLead}</p>
        <p className="reports-note">{t.reportsNote}</p>
        {REPORT_GROUPS.map((group) => (
          <section key={group.label}>
            <div className="reports-group">{t[group.label]}</div>
            <div className="reports-grid">
              {group.reports.map((id) => (
                <button className="reports-card" type="button" key={id} onClick={() => { setReportId(id); setFilters((current) => ({ ...current, status: "" })); }}>
                  <h3>{t[REPORTS[id].title]}</h3>
                  <p>{t[REPORTS[id].desc]}</p>
                </button>
              ))}
            </div>
          </section>
        ))}
        <section>
          <div className="reports-group">{t.laterGroup}</div>
          <div className="reports-grid">
            {LATER_REPORTS.map(([title, desc]) => (
              <div className="reports-card later" key={title}>
                <h3>{t[title]}</h3>
                <p>{t[desc]}</p>
                <div className="reports-later">{t.needsBooks}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  const statuses = meta.status === "invoice" ? INVOICE_STATUSES : meta.status === "po" ? PO_STATUSES : [];

  return (
    <div className="reports-screen reports-detail">
      <style>{"@media print { @page { size: A4 landscape; margin: 10mm; } }"}</style>
      <button className="reports-back" type="button" onClick={() => setReportId("")}>← {t.allReports}</button>
      <h1>{t[meta.title]}</h1>
      <p className="reports-sub">{t[meta.sub]}</p>
      <div className="reports-filters">
        <label>{t.fromDate}<DateField allowClear value={filters.from} onChange={(value) => setFilter("from", value)} /></label>
        <label>{t.toDate}<DateField allowClear value={filters.to} onChange={(value) => setFilter("to", value)} /></label>
        {meta.customer ? (
          <label>{t.customer}
            <select value={filters.customerId} onChange={(event) => setFilter("customerId", event.target.value)}>
              <option value="">{t.allCustomers}</option>
              {data.customers.map((row) => <option key={row.id} value={row.id}>{row.company || row.name}</option>)}
            </select>
          </label>
        ) : null}
        {meta.vendor ? (
          <label>{t.vendor}
            <select value={filters.vendorId} onChange={(event) => setFilter("vendorId", event.target.value)}>
              <option value="">{t.allVendors}</option>
              {data.vendors.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
        ) : null}
        {statuses.length ? (
          <label>{t.status}
            <select value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
              {statuses.map(([value, label]) => <option key={value || "all"} value={value}>{t[label]}</option>)}
            </select>
          </label>
        ) : null}
      </div>
      <div className="reports-actions">
        <button className="btn reports-pdf" type="button" onClick={pdf} disabled={busy}>{busy ? t.generatingPdf : "PDF"}</button>
        <button className="btn reports-excel" type="button" onClick={excel}>{t.exportExcel}</button>
        <button className="btn ghost" type="button" onClick={() => window.print()}>{t.print}</button>
        <button className="btn reports-reset" type="button" onClick={() => setFilters(EMPTY_FILTERS)}>{t.resetFilters}</button>
      </div>
      <div className="reports-kpis">
        {report.kpis.map((item) => (
          <article key={item.label}>
            <b>{item.money ? aed(item.value) : item.value}</b>
            <span>{item.label}</span>
          </article>
        ))}
      </div>
      {report.rows.length === 0 ? <div className="reports-empty">{t.noReportRows}</div> : (
        <div className="reports-table">
          <table>
            <thead>
              <tr>
                {report.columns.map((column) => (
                  <th key={column.label} className={column.kind === "text" ? "" : "num"}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, index) => (
                <tr key={index}>
                  {row.map((value, cell) => (
                    <td key={report.columns[cell].label} className={report.columns[cell].kind === "text" ? "" : "num"}>{show(report.columns[cell], value)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
