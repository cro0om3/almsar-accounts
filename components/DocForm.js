"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { saveInvoiceAction, saveQuoteAction } from "../app/actions";
import DateField from "./DateField";
import { useI18n } from "./I18nProvider";
import { customerContact, customerTitle } from "../lib/party";
import { aed, recomputeLine, summarize } from "../lib/money";
import { isFleetVehicle } from "../lib/vehicle-kind";

function vehicleChoice(vehicle, isInvoice) {
  const name = vehicle.vehicleType || "";
  const number = vehicle.vehicleNumber || "";
  if (isInvoice) return [number, name].filter(Boolean).join(" · ") || number;
  return name || number;
}

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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function prettyDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value || "").slice(0, 10);
  return `${match[3]}-${MONTHS[Number(match[2]) - 1] || match[2]}-${match[1]}`;
}

export default function DocForm({ kind, doc, customers, vehicles, quotes = [], invoices = [], askCopy = false }) {
  const { t } = useI18n();
  const router = useRouter();
  const isInvoice = kind === "invoice";
  const [asking, setAsking] = useState(askCopy);
  useEffect(() => { setAsking(askCopy); }, [askCopy]);
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [poError, setPoError] = useState("");
  const fleetVehicles = vehicles.filter(isFleetVehicle);
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
  const [showColumns, setShowColumns] = useState(false);
  const [columns, setColumns] = useState({
    vehicle: true,
    description: true,
    basis: true,
    qty: true,
    rate: true,
    gross: true,
    tax: true,
    net: true,
    received: true,
  });
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
    if (isInvoice && !header.id && !String(header.poNumbers || "").trim()) {
      setPoError(t.customerPoRequired);
      return;
    }
    setPoError("");
    const payload = { ...header, items: items.map(recomputeLine) };
    if (isInvoice) await saveInvoiceAction(payload);
    else await saveQuoteAction(payload);
  }

  const copyChoices = useMemo(() => {
    const text = invoiceQuery.trim().toLowerCase();
    const rows = isInvoice ? invoices : quotes;
    return rows.filter((row) => `${row.number} ${customerTitle(row)} ${row.customerName || ""}`.toLowerCase().includes(text));
  }, [invoices, quotes, invoiceQuery, isInvoice]);

  if (asking) {
    return (
      <div className="start-gate">
        <h1>{isInvoice ? t.newInvoiceTitle : t.newQuotation}</h1>
        <p>{t.startTitle}</p>
        <button className="btn start-new" type="button" onClick={() => setAsking(false)}>{t.startNew}</button>
        <h2>{isInvoice ? t.copyInvoice : t.copyQuote}</h2>
        <p className="k">{isInvoice ? t.copyInvoiceLead : t.copyQuoteLead}</p>
        <label className="search">
          <input value={invoiceQuery} onChange={(event) => setInvoiceQuery(event.target.value)} placeholder={t.search} />
        </label>
        <div className="start-list">
          {copyChoices.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => router.push(isInvoice ? `/invoices/new?fromInvoice=${row.id}` : `/quotes/new?fromQuote=${row.id}`)}
            >
              <b>{row.number}</b>
              <span>{customerTitle(row) || "—"}</span>
              <small>{String(row.date || "").slice(0, 10)} · {aed(row.total)}</small>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <form className="doc-form" onSubmit={onSave}>
      <div className="doc-top">
        <div>
          <h1>{header.id ? (isInvoice ? t.editInvoice : t.editQuote) : (isInvoice ? t.newInvoiceTitle : t.newQuotation)}</h1>
          <p>{isInvoice ? t.invoices : t.quotations} {header.number}</p>
        </div>
      </div>
      <div className="doc-grid">
        <section className="panel details-panel">
          <h2>{isInvoice ? t.invoiceDetails : t.quoteDetails}</h2>
          <div className="split" style={{ marginTop: 12 }}>
            <label>{isInvoice ? t.invoiceNumber : t.quoteNumber}
              <input value={header.number} onChange={(event) => setHeader({ ...header, number: event.target.value })} />
            </label>
            <label>{t.date}
              <DateField value={header.date} onChange={(date) => setHeader({ ...header, date })} />
            </label>
            {isInvoice ? (
              <label>{t.dueDate}
                <DateField value={header.dueDate} onChange={(dueDate) => setHeader({ ...header, dueDate })} />
              </label>
            ) : null}
            <label>{t.status}
              <select value={header.status || "draft"} onChange={(event) => setHeader({ ...header, status: event.target.value })}>
                <option value="draft">{t.draft}</option>
                <option value={isInvoice ? "invoice_sent" : "sent"}>{t.sent}</option>
                {isInvoice ? <option value="payment_received">{t.paid}</option> : null}
                {isInvoice ? null : <option value="accepted">{t.accepted}</option>}
                {isInvoice ? null : <option value="declined">{t.declined}</option>}
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
                <input value={header.poNumbers} onChange={(event) => { setPoError(""); setHeader({ ...header, poNumbers: event.target.value }); }} />
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

        <section className="panel customer-panel">
          <h2>{t.customer}</h2>
          <label style={{ marginTop: 12 }}>{t.selectCustomer}
            <select value={header.customerId} onChange={(event) => setHeader({ ...header, customerId: event.target.value })}>
              <option value="">{t.selectCustomer}</option>
              {customers.map((row) => <option key={row.id} value={row.id}>{customerTitle(row)}</option>)}
            </select>
          </label>
          {customer ? (
            <div className="customer-box">
              <b>{customerTitle(customer)}</b>
              {customerContact(customer) ? <div>{customerContact(customer)}</div> : null}
              <div className="meta">
                <span>{t.email}</span><span>{customer.email || "—"}</span>
                <span>{t.phone}</span><span>{customer.phone || "—"}</span>
                <span>{t.address}</span><span>{customer.address || "—"}</span>
              </div>
            </div>
          ) : null}
        </section>

        <section className="panel summary-panel">
          <h2>{t.summary}</h2>
          <div className="sum-row"><span>{t.subtotal}</span><b className="money">{aed(totals.subtotal)}</b></div>
          <div className="sum-row"><span>{t.tax}</span><b className="money">{aed(totals.tax)}</b></div>
          <div className="sum-row total"><span>{t.total}</span><b className="money">{aed(totals.total)}</b></div>
          {isInvoice ? (
            <>
              <label>{t.amountReceived}
                <input type="number" value={header.amountReceived} onChange={(event) => setHeader({ ...header, amountReceived: event.target.value })} />
              </label>
              <div className="sum-row"><span>{t.pendingAmount}</span><b className="money">{aed(pending)}</b></div>
            </>
          ) : null}
          {poError ? <div className="errors">{poError}</div> : null}
          {invalid ? (
            <div className="errors">
              <b>{t.errors}</b>
              <div>• {t.lineRequired}</div>
              <div>• {t.totalRequired}</div>
            </div>
          ) : null}
          <div className="tool-row">
            <button className="sq pdf" type="button" title="PDF" onClick={async () => { const { downloadPdf } = await import("../lib/download-doc"); downloadPdf(kind, exportPayload(), customer); }}><FileText size={16} /></button>
            <button className="sq xls" type="button" title="Excel" onClick={async () => { const { downloadExcel } = await import("../lib/download-doc"); downloadExcel(kind, exportPayload(), customer); }}><FileSpreadsheet size={16} /></button>
            <button className="sq print" type="button" title="Print" onClick={async () => { const { printDocument } = await import("../lib/download-doc"); printDocument(kind, exportPayload(), customer); }}><Printer size={16} /></button>
          </div>
          <div className="form-actions">
            <button className="btn save" type="submit">{isInvoice ? t.saveInvoice : t.saveQuote}</button>
            <button className="cancel" type="button" onClick={() => router.back()}>{t.cancel}</button>
          </div>
        </section>
      </div>

      <section className="panel lines-panel">
        <div className="lines-head">
          <h2>{t.lineItems}</h2>
          <button className="btn ghost customize-columns" type="button" onClick={() => setShowColumns((open) => !open)}>{t.customize}</button>
        </div>
        {showColumns ? (
          <div className="column-picks">
            {[
              ["vehicle", t.vehicle],
              ["description", t.description],
              ["basis", t.basis],
              ["qty", t.qty],
              ["rate", t.rate],
              ["gross", t.gross],
              ["tax", t.taxPct],
              ["net", t.net],
              ["received", t.received],
            ].map(([key, label]) => (
              <label key={key} className="check">
                <input type="checkbox" checked={columns[key]} onChange={() => setColumns((current) => ({ ...current, [key]: !current[key] }))} />
                {label}
              </label>
            ))}
          </div>
        ) : null}
        <table className="lines">
          <thead>
            <tr>
              <th>#</th>
              {columns.vehicle ? <th>{t.vehicle}</th> : null}
              {columns.description ? <th>{t.description}</th> : null}
              {columns.basis ? <th>{t.basis}</th> : null}
              {columns.qty ? <th>{t.qty}</th> : null}
              {columns.rate ? <th>{t.rate}</th> : null}
              {columns.gross ? <th>{t.gross}</th> : null}
              {columns.tax ? <th>{t.taxPct}</th> : null}
              {columns.net ? <th>{t.net}</th> : null}
              {columns.received ? <th>{t.received}</th> : null}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((line, index) => (
              <tr key={line.id}>
                <td>{index + 1}</td>
                {columns.vehicle ? <td>
                  <select value={line.vehicleNumber || ""} onChange={(event) => patchLine(line.id, "vehicleNumber", event.target.value)}>
                    <option value="">—</option>
                    {fleetVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.vehicleNumber}>{vehicleChoice(vehicle, isInvoice)}</option>)}
                  </select>
                </td> : null}
                {columns.description ? <td><input value={line.description || ""} onChange={(event) => patchLine(line.id, "description", event.target.value)} /></td> : null}
                {columns.basis ? <td>
                  <select value={line.rentalBasis || ""} onChange={(event) => patchLine(line.id, "rentalBasis", event.target.value)}>
                    <option value="">—</option>
                    <option value="hourly">{t.hourly}</option>
                    <option value="monthly">{t.monthly}</option>
                  </select>
                </td> : null}
                {columns.qty ? <td><input type="number" value={line.quantity} onChange={(event) => patchLine(line.id, "quantity", event.target.value)} /></td> : null}
                {columns.rate ? <td><input type="number" value={line.unitPrice} onChange={(event) => patchLine(line.id, "unitPrice", event.target.value)} /></td> : null}
                {columns.gross ? <td className="money">{aed(line.grossAmount)}</td> : null}
                {columns.tax ? <td><input type="number" value={line.taxPercent} onChange={(event) => patchLine(line.id, "taxPercent", event.target.value)} /></td> : null}
                {columns.net ? <td className="money">{aed(line.lineTotal)}</td> : null}
                {columns.received ? <td className="money">{aed(0)}</td> : null}
                <td><button className="cancel" type="button" onClick={() => setItems((current) => current.filter((item) => item.id !== line.id))}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="line-edit">
          {items.map((line, index) => (
            <article className="line-card" key={line.id}>
              <div className="line-card-top">
                <b>{index + 1}</b>
                <button className="cancel" type="button" aria-label={t.delete} onClick={() => setItems((current) => current.filter((item) => item.id !== line.id))}>×</button>
              </div>
              {columns.vehicle ? <label>{t.vehicle}
                <select value={line.vehicleNumber || ""} onChange={(event) => patchLine(line.id, "vehicleNumber", event.target.value)}>
                  <option value="">—</option>
                  {fleetVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.vehicleNumber}>{vehicleChoice(vehicle, isInvoice)}</option>)}
                </select>
              </label> : null}
              {columns.description ? <label>{t.description}<input value={line.description || ""} onChange={(event) => patchLine(line.id, "description", event.target.value)} /></label> : null}
              <div className="line-grid">
                {columns.basis ? <label>{t.basis}
                  <select value={line.rentalBasis || ""} onChange={(event) => patchLine(line.id, "rentalBasis", event.target.value)}>
                    <option value="">—</option>
                    <option value="hourly">{t.hourly}</option>
                    <option value="monthly">{t.monthly}</option>
                  </select>
                </label> : null}
                {columns.qty ? <label>{t.qty}<input type="number" value={line.quantity} onChange={(event) => patchLine(line.id, "quantity", event.target.value)} /></label> : null}
                {columns.rate ? <label>{t.rate}<input type="number" value={line.unitPrice} onChange={(event) => patchLine(line.id, "unitPrice", event.target.value)} /></label> : null}
                {columns.tax ? <label>{t.taxPct}<input type="number" value={line.taxPercent} onChange={(event) => patchLine(line.id, "taxPercent", event.target.value)} /></label> : null}
              </div>
              <div className="sum-row total"><span>{t.net}</span><b className="money">{aed(line.lineTotal)}</b></div>
            </article>
          ))}
        </div>
        <button className="add-line" type="button" onClick={() => setItems((current) => [...current, freshLine()])}>+ {t.addLine}</button>
        <p className="k doc-date-foot">{prettyDate(header.date)}</p>
      </section>
    </form>
  );
}
