"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { savePurchaseOrderAction } from "../app/actions";
import { aed, recomputeLine, summarize } from "../lib/money";
import { isFleetVehicle } from "../lib/vehicle-kind";
import { useI18n } from "./I18nProvider";

function freshLine() {
  return recomputeLine({
    id: crypto.randomUUID(),
    vehicleNumber: "",
    description: "",
    rentalBasis: "",
    quantity: 1,
    unitPrice: 0,
    taxPercent: 5,
  });
}

export default function PoForm({ doc, vendors, vehicles }) {
  const { t } = useI18n();
  const fleetVehicles = vehicles.filter(isFleetVehicle);
  const router = useRouter();
  const [header, setHeader] = useState({
    id: doc.id || "",
    number: doc.number || "",
    date: String(doc.date || "").slice(0, 10),
    vendorId: doc.vendorId || "",
    status: doc.status || "draft",
    notes: doc.notes || "",
    terms: doc.terms || "",
  });
  const [items, setItems] = useState(doc.items?.length ? doc.items.map(recomputeLine) : [freshLine()]);
  const totals = useMemo(() => summarize(items.map(recomputeLine)), [items]);
  const vendor = vendors.find((row) => row.id === header.vendorId);

  function payload() {
    return { ...header, subtotal: totals.subtotal, tax: totals.tax, total: totals.total, items: items.map(recomputeLine) };
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); savePurchaseOrderAction(payload()); }}>
      <div className="doc-top">
        <div>
          <h1>{header.id ? t.edit : t.newPurchaseOrder}</h1>
          <p>{header.number}</p>
        </div>
      </div>
      <div className="doc-grid">
        <section className="panel">
          <h2>{t.purchaseOrders}</h2>
          <div className="split" style={{ marginTop: 12 }}>
            <label>{t.poNumber}<input value={header.number} onChange={(event) => setHeader({ ...header, number: event.target.value })} /></label>
            <label>{t.date}<input type="date" value={header.date} onChange={(event) => setHeader({ ...header, date: event.target.value })} /></label>
            <label>{t.status}
              <select value={header.status} onChange={(event) => setHeader({ ...header, status: event.target.value })}>
                <option value="draft">{t.draft}</option>
                <option value="sent">{t.sent}</option>
                <option value="accepted">{t.paid}</option>
              </select>
            </label>
          </div>
        </section>
        <section className="panel">
          <h2>{t.vendor}</h2>
          <label style={{ marginTop: 12 }}>{t.vendor}
            <select value={header.vendorId} onChange={(event) => setHeader({ ...header, vendorId: event.target.value })} required>
              <option value="">—</option>
              {vendors.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </label>
          {vendor ? <div className="customer-box"><b>{vendor.name}</b><div className="meta"><span>{t.phone}</span><span>{vendor.phone || "—"}</span></div></div> : null}
        </section>
        <section className="panel">
          <h2>{t.summary}</h2>
          <div className="sum-row"><span>{t.subtotal}</span><b>{aed(totals.subtotal)}</b></div>
          <div className="sum-row"><span>{t.tax}</span><b>{aed(totals.tax)}</b></div>
          <div className="sum-row total"><span>{t.total}</span><b>{aed(totals.total)}</b></div>
          <div className="tool-row">
            <button className="sq pdf" type="button" title="PDF" onClick={async () => { const { downloadPdf } = await import("../lib/download-doc"); downloadPdf("po", { ...payload(), customerName: vendor?.name }, vendor); }}><FileText size={16} /></button>
            <button className="sq xls" type="button" title="Excel" onClick={async () => { const { downloadExcel } = await import("../lib/download-doc"); downloadExcel("po", { ...payload(), customerName: vendor?.name }, vendor); }}><FileSpreadsheet size={16} /></button>
            <button className="sq print" type="button" title="Print" onClick={async () => { const { printDocument } = await import("../lib/download-doc"); printDocument("po", { ...payload(), customerName: vendor?.name }, vendor); }}><Printer size={16} /></button>
          </div>
          <button className="btn save" type="submit" disabled={!header.vendorId}>{t.save}</button>
          <button className="cancel" type="button" onClick={() => router.push("/purchase-orders")}>{t.cancel}</button>
        </section>
      </div>
      <section className="panel" style={{ marginTop: 14 }}>
        <h2>{t.lineItems}</h2>
        <table className="lines">
          <thead><tr><th>#</th><th>{t.vehicle}</th><th>{t.description}</th><th>{t.basis}</th><th>{t.qty}</th><th>{t.rate}</th><th>{t.net}</th><th></th></tr></thead>
          <tbody>
            {items.map((line, index) => (
              <tr key={line.id}>
                <td>{index + 1}</td>
                <td>
                  <select value={line.vehicleNumber || ""} onChange={(event) => setItems((rows) => rows.map((item) => item.id === line.id ? recomputeLine({ ...item, vehicleNumber: event.target.value }) : item))}>
                    <option value="">—</option>
                    {fleetVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.vehicleNumber}>{vehicle.vehicleNumber}</option>)}
                  </select>
                </td>
                <td><input value={line.description || ""} onChange={(event) => setItems((rows) => rows.map((item) => item.id === line.id ? { ...item, description: event.target.value } : item))} /></td>
                <td>
                  <select value={line.rentalBasis || ""} onChange={(event) => setItems((rows) => rows.map((item) => item.id === line.id ? { ...item, rentalBasis: event.target.value } : item))}>
                    <option value="">—</option>
                    <option value="hourly">{t.hourly}</option>
                    <option value="monthly">{t.monthly}</option>
                  </select>
                </td>
                <td><input type="number" value={line.quantity} onChange={(event) => setItems((rows) => rows.map((item) => item.id === line.id ? recomputeLine({ ...item, quantity: event.target.value }) : item))} /></td>
                <td><input type="number" value={line.unitPrice} onChange={(event) => setItems((rows) => rows.map((item) => item.id === line.id ? recomputeLine({ ...item, unitPrice: event.target.value }) : item))} /></td>
                <td>{aed(line.lineTotal)}</td>
                <td><button className="cancel" type="button" onClick={() => setItems((rows) => rows.filter((item) => item.id !== line.id))}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="line-edit">
          {items.map((line, index) => (
            <article className="line-card" key={line.id}>
              <div className="line-card-top">
                <b>{index + 1}</b>
                <button className="cancel" type="button" aria-label={t.delete} onClick={() => setItems((rows) => rows.filter((item) => item.id !== line.id))}>×</button>
              </div>
              <label>{t.vehicle}
                <select value={line.vehicleNumber || ""} onChange={(event) => setItems((rows) => rows.map((item) => item.id === line.id ? recomputeLine({ ...item, vehicleNumber: event.target.value }) : item))}>
                  <option value="">—</option>
                  {fleetVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.vehicleNumber}>{vehicle.vehicleNumber}</option>)}
                </select>
              </label>
              <label>{t.description}<input value={line.description || ""} onChange={(event) => setItems((rows) => rows.map((item) => item.id === line.id ? { ...item, description: event.target.value } : item))} /></label>
              <div className="line-grid">
                <label>{t.basis}
                  <select value={line.rentalBasis || ""} onChange={(event) => setItems((rows) => rows.map((item) => item.id === line.id ? { ...item, rentalBasis: event.target.value } : item))}>
                    <option value="">—</option>
                    <option value="hourly">{t.hourly}</option>
                    <option value="monthly">{t.monthly}</option>
                  </select>
                </label>
                <label>{t.qty}<input type="number" value={line.quantity} onChange={(event) => setItems((rows) => rows.map((item) => item.id === line.id ? recomputeLine({ ...item, quantity: event.target.value }) : item))} /></label>
                <label>{t.rate}<input type="number" value={line.unitPrice} onChange={(event) => setItems((rows) => rows.map((item) => item.id === line.id ? recomputeLine({ ...item, unitPrice: event.target.value }) : item))} /></label>
              </div>
              <div className="sum-row total"><span>{t.net}</span><b>{aed(line.lineTotal)}</b></div>
            </article>
          ))}
        </div>
        <button className="add-line" type="button" onClick={() => setItems((rows) => [...rows, freshLine()])}>+ {t.addLine}</button>
        <label style={{ marginTop: 12 }}>{t.terms}<textarea value={header.terms} onChange={(event) => setHeader({ ...header, terms: event.target.value })} /></label>
      </section>
    </form>
  );
}
