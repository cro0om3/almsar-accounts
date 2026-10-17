"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { saveReceiptAction } from "../app/actions";
import { useI18n } from "./I18nProvider";
import { aed } from "../lib/money";

export default function ReceiptForm({ doc, customers, invoices }) {
  const { t } = useI18n();
  const router = useRouter();
  const [header, setHeader] = useState(doc);
  const [error, setError] = useState("");
  const customer = useMemo(
    () => customers.find((row) => row.id === header.customerId) || null,
    [customers, header.customerId]
  );
  const methods = [
    ["cash", t.methodCash],
    ["transfer", t.methodTransfer],
    ["cheque", t.methodCheque],
    ["card", t.methodCard],
  ];

  function chooseInvoice(invoiceId) {
    const invoice = invoices.find((row) => row.id === invoiceId);
    if (!invoice) {
      setHeader((current) => ({ ...current, invoiceId: "", invoiceNumber: "" }));
      return;
    }
    const pending = Math.max(0, (Number(invoice.total) || 0) - (Number(invoice.amountReceived) || 0));
    setHeader((current) => ({
      ...current,
      invoiceId: invoice.id,
      invoiceNumber: invoice.number || "",
      customerId: invoice.customerId || current.customerId,
      amount: current.amount === "" || Number(current.amount) === 0 ? pending.toFixed(2) : current.amount,
    }));
  }

  async function onSave(event) {
    event.preventDefault();
    if (!header.customerId || !(Number(header.amount) > 0)) {
      setError(t.receiptRequired);
      return;
    }
    setError("");
    await saveReceiptAction(header);
  }

  return (
    <form className="doc-form" onSubmit={onSave}>
      <div className="doc-top">
        <div>
          <h1>{header.id ? t.editReceipt : t.newReceipt}</h1>
          <p>{t.receipts} {header.number}</p>
        </div>
      </div>
      <div className="doc-grid">
        <section className="panel details-panel">
          <h2>{t.receiptDetails}</h2>
          <div className="split" style={{ marginTop: 12 }}>
            <label>{t.receiptNumber}
              <input value={header.number} onChange={(event) => setHeader({ ...header, number: event.target.value })} />
            </label>
            <label>{t.date}
              <input type="date" value={header.date} onChange={(event) => setHeader({ ...header, date: event.target.value })} />
            </label>
            <label>{t.againstInvoice}
              <select value={header.invoiceId || ""} onChange={(event) => chooseInvoice(event.target.value)}>
                <option value="">—</option>
                {invoices.map((row) => <option key={row.id} value={row.id}>{row.number} · {row.customerName || ""}</option>)}
              </select>
            </label>
            <label>{t.paymentMethod}
              <select value={header.method || "cash"} onChange={(event) => setHeader({ ...header, method: event.target.value })}>
                {methods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>{t.referenceNo}
              <input value={header.reference || ""} onChange={(event) => setHeader({ ...header, reference: event.target.value })} />
            </label>
          </div>
          <label style={{ marginTop: 12 }}>{t.receiptNote}
            <textarea rows={4} value={header.notes || ""} onChange={(event) => setHeader({ ...header, notes: event.target.value })} />
          </label>
        </section>

        <section className="panel customer-panel">
          <h2>{t.customer}</h2>
          <label style={{ marginTop: 12 }}>{t.selectCustomer}
            <select value={header.customerId || ""} onChange={(event) => setHeader({ ...header, customerId: event.target.value })}>
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

        <section className="panel summary-panel">
          <h2>{t.summary}</h2>
          <label style={{ marginTop: 12 }}>{t.receivedAmount}
            <input type="number" min="0" step="0.01" value={header.amount} onChange={(event) => setHeader({ ...header, amount: event.target.value })} />
          </label>
          <div className="sum-row total"><span>{t.total}</span><b className="money">{aed(header.amount || 0)}</b></div>
          {error ? <div className="errors">{error}</div> : null}
          <div className="tool-row">
            <button className="sq pdf" type="button" title="PDF" onClick={async () => { const { downloadReceipt } = await import("../lib/download-doc"); downloadReceipt(header, customer); }}><FileText size={16} /></button>
          </div>
          <div className="form-actions">
            <button className="btn save" type="submit">{t.save}</button>
            <button className="cancel" type="button" onClick={() => router.push("/receipts")}>{t.cancel}</button>
          </div>
        </section>
      </div>
    </form>
  );
}
