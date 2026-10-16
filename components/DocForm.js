"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { saveInvoiceAction, saveQuoteAction } from "../app/actions";
import { downloadExcel, downloadPdf, printDocument } from "../lib/download-doc";
import { useI18n } from "./I18nProvider";
import { aed, recomputeLine, summarize } from "../lib/money";

function freshLine() {
  return recomputeLine({
    id: crypto.randomUUID(),
    vehicleTypeId: "",
    vehicleTypeLabel: "",
    vehicleNumber: "",
    description: "",
    rentalBasis: "",
    quantity: 1,
    unitPrice: 0,
    taxPercent: 5,
  });
}

function prettyDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
}

export default function DocForm({ kind, doc, customers, vehicles, quotes = [], invoices = [] }) {
  const { t } = useI18n();
  const router = useRouter();
  const isInvoice = kind === "invoice";
  const [header, setHeader] = useState({
    id: doc.id || "",
    number: doc.number || "",
    date: String(doc.date || "").slice(0, 10),
    dueDate: String(doc.dueDate || "").slice(0, 10),
    duration: doc.duration || "",
    customerId: doc.customerId || "",
    quoteId: doc.quoteId || "",
    poNumbers: doc.poNumbers || "",
    status: doc.status || "draft",
    amountReceived: doc.amountReceived || 0,
    notes: doc.notes || "",
  });
  const [items, setItems] = useState(doc.items?.length ? doc.items.map(recomputeLine) : [freshLine()]);
  const [copyId, setCopyId] = useState("");
  const totals = useMemo(() => summarize(items.map(recomputeLine)), [items]);
  const customer = customers.find((row) => row.id === header.customerId);
  const pending = totals.total - (Number(header.amountReceived) || 0);
  const invalid = !items.some((line) => String(line.description || "").trim() && Number(line.unitPrice) > 0) || totals.total <= 0;

  function patchLine(id, field, value) {
    setItems((current) =>
      current.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, [field]: value };
        if (field === "vehicleNumber") {
          const vehicle = vehicles.find((item) => item.vehicleNumber === value);
          if (!value) {
            next.vehicleTypeId = "";
            next.vehicleTypeLabel = "";
          } else if (vehicle) {
            next.vehicleTypeId = vehicle.id || "";
            next.vehicleTypeLabel = vehicle.vehicleType || vehicle.vehicleNumber || "";
            if (!String(next.description || "").trim() && vehicle.description) next.description = vehicle.description;
            if (!(Number(next.unitPrice) > 0) && Number(vehicle.basePrice) > 0) next.unitPrice = vehicle.basePrice;
          }
        }
        return recomputeLine(next);
      })
    );
  }

  function exportPayload() {
    return {
      ...header,
      terms: doc.terms || "",
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      items: items.map(recomputeLine),
    };
  }

  async function onSave(event) {
    event.preventDefault();
    const payload = { ...header, items: items.map(recomputeLine) };
    if (isInvoice) await saveInvoiceAction(payload);
    else await saveQuoteAction(payload);
  }

  return (
    <form onSubmit={onSave}>
      <div className="doc-top">
        <div>
          <h1>{header.id ? (isInvoice ? t.editInvoice : t.editQuote) : (isInvoice ? t.newInvoiceTitle : t.newQuotation)}</h1>
          <p>{isInvoice ? t.invoices : t.quotations} {header.number}</p>
        </div>
      </div>
      <div className="doc-grid">
        <section className="panel">
          <h2>{isInvoice ? t.invoiceDetails : t.quoteDetails}</h2>
          <div className="split" style={{ marginTop: 12 }}>
            <label>{isInvoice ? t.invoiceNumber : t.quoteNumber}
              <input value={header.number} onChange={(event) => setHeader({ ...header, number: event.target.value })} />
            </label>
            <label>{t.date}
              <input type="date" value={header.date} onChange={(event) => setHeader({ ...header, date: event.target.value })} />
            </label>
            {isInvoice ? (
              <label>{t.dueDate}
                <input type="date" value={header.dueDate} onChange={(event) => setHeader({ ...header, dueDate: event.target.value })} />
              </label>
            ) : null}
            <label>{t.status}
              <select value={header.status} onChange={(event) => setHeader({ ...header, status: event.target.value })}>
                <option value="draft">{t.draft}</option>
                <option value="invoice_sent">{t.sent}</option>
                <option value="payment_received">{t.paid}</option>
              </select>
            </label>
            {isInvoice ? (
              <label>{t.duration}
                <input value={header.duration} placeholder="September 2026" onChange={(event) => setHeader({ ...header, duration: event.target.value })} />
              </label>
            ) : null}
            {isInvoice ? (
              <label>{t.quoteRef}
                <select value={header.quoteId} onChange={(event) => setHeader({ ...header, quoteId: event.target.value })}>
                  <option value="">—</option>
                  {quotes.map((row) => <option key={row.id} value={row.id}>{row.number}</option>)}
                </select>
              </label>
            ) : null}
          </div>
          {isInvoice ? (
            <div className="copy-row" style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <label style={{ flex: 1 }}>{t.poOptional}
                <input value={header.poNumbers} onChange={(event) => setHeader({ ...header, poNumbers: event.target.value })} />
              </label>
              <label style={{ flex: 1 }}>{t.addFromExisting}
                <select value={copyId} onChange={(event) => {
                  const value = event.target.value;
                  setCopyId(value);
                  if (!value) return;
                  router.push(value.startsWith("q:") ? `/invoices/new?fromQuote=${value.slice(2)}` : `/invoices/new?fromInvoice=${value.slice(2)}`);
                }}>
                  <option value="">{t.copySource}</option>
                  {quotes.map((row) => <option key={row.id} value={`q:${row.id}`}>{row.number}</option>)}
                  {invoices.map((row) => <option key={row.id} value={`i:${row.id}`}>{row.number}</option>)}
                </select>
              </label>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <h2>{t.customer}</h2>
          <label style={{ marginTop: 12 }}>{t.selectCustomer}
            <select value={header.customerId} onChange={(event) => setHeader({ ...header, customerId: event.target.value })}>
              <option value="">{t.selectCustomer}</option>
              {customers.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
          {customer ? (
            <div className="customer-box">
              <b>{customer.name}</b>
              <div className="meta">
                <span>{t.email}</span><span>{customer.email || "—"}</span>
                <span>{t.phone}</span><span>{customer.phone || "—"}</span>
                <span>{t.address}</span><span>{customer.address || "—"}</span>
              </div>
            </div>
          ) : null}
        </section>

        <section className="panel">
          <h2>{t.summary}</h2>
          <div className="sum-row"><span>{t.subtotal}</span><b className="money">{aed(totals.subtotal)}</b></div>
          <div className="sum-row"><span>{t.tax}</span><b className="money">{aed(totals.tax)}</b></div>
          <div className="sum-row total"><span>{t.total}</span><b className="money">{aed(totals.total)}</b></div>
          <label>{t.amountReceived}
            <input type="number" value={header.amountReceived} onChange={(event) => setHeader({ ...header, amountReceived: event.target.value })} />
          </label>
          <div className="sum-row"><span>{t.pendingAmount}</span><b className="money">{aed(pending)}</b></div>
          {invalid ? (
            <div className="errors">
              <b>{t.errors}</b>
              <div>• {t.lineRequired}</div>
              <div>• {t.totalRequired}</div>
            </div>
          ) : null}
          <div className="tool-row">
            <button className="sq pdf" type="button" title="PDF" onClick={() => downloadPdf(kind, exportPayload(), customer)}><FileText size={16} /></button>
            <button className="sq xls" type="button" title="Excel" onClick={() => downloadExcel(kind, exportPayload(), customer)}><FileSpreadsheet size={16} /></button>
            <button className="sq print" type="button" title="Print" onClick={() => printDocument(kind, exportPayload(), customer)}><Printer size={16} /></button>
          </div>
          <button className="btn save" type="submit">{isInvoice ? t.saveInvoice : t.saveQuote}</button>
          <button className="cancel" type="button" onClick={() => router.back()}>{t.cancel}</button>
        </section>
      </div>

      <section className="panel" style={{ marginTop: 14 }}>
        <div className="lines-head">
          <h2>{t.lineItems}</h2>
          <button className="btn ghost" type="button">{t.customize}</button>
        </div>
        <table className="lines">
          <thead>
            <tr>
              <th>#</th>
              <th>{t.vehicle}</th>
              <th>{t.description}</th>
              <th>{t.basis}</th>
              <th>{t.qty}</th>
              <th>{t.rate}</th>
              <th>{t.gross}</th>
              <th>{t.taxPct}</th>
              <th>{t.net}</th>
              <th>{t.received}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((line, index) => (
              <tr key={line.id}>
                <td>{index + 1}</td>
                <td>
                  <select value={line.vehicleNumber || ""} onChange={(event) => patchLine(line.id, "vehicleNumber", event.target.value)}>
                    <option value="">—</option>
                    {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.vehicleNumber}>{vehicle.vehicleNumber}</option>)}
                  </select>
                </td>
                <td><input value={line.description || ""} onChange={(event) => patchLine(line.id, "description", event.target.value)} /></td>
                <td>
                  <select value={line.rentalBasis || ""} onChange={(event) => patchLine(line.id, "rentalBasis", event.target.value)}>
                    <option value="">—</option>
                    <option value="hourly">{t.hourly}</option>
                    <option value="monthly">{t.monthly}</option>
                  </select>
                </td>
                <td><input type="number" value={line.quantity} onChange={(event) => patchLine(line.id, "quantity", event.target.value)} /></td>
                <td><input type="number" value={line.unitPrice} onChange={(event) => patchLine(line.id, "unitPrice", event.target.value)} /></td>
                <td className="money">{aed(line.grossAmount)}</td>
                <td><input type="number" value={line.taxPercent} onChange={(event) => patchLine(line.id, "taxPercent", event.target.value)} /></td>
                <td className="money">{aed(line.lineTotal)}</td>
                <td className="money">{aed(0)}</td>
                <td><button className="cancel" type="button" onClick={() => setItems((current) => current.filter((item) => item.id !== line.id))}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="add-line" type="button" onClick={() => setItems((current) => [...current, freshLine()])}>+ {t.addLine}</button>
        <p className="k">{prettyDate(header.date)}</p>
      </section>
    </form>
  );
}
