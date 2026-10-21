"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveReceiptAction } from "../app/actions";
import FilePick from "./FilePick";
import { useI18n } from "./I18nProvider";
import { customerContact, customerTitle } from "../lib/party";
import { aed } from "../lib/money";

function cents(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function roomFor(invoice, saved) {
  const raw = (Number(invoice.total) || 0) - (Number(invoice.amountReceived) || 0) + (Number(saved) || 0);
  return Math.max(0, cents(raw));
}

export default function ReceiptForm({ doc, customers, invoices }) {
  const { t } = useI18n();
  const router = useRouter();
  const [header, setHeader] = useState(doc);
  const [picked, setPicked] = useState(() => Object.fromEntries((doc.allocations || []).map((line) => [line.invoiceId, cents(line.amount).toFixed(2)])));
  const [file, setFile] = useState(null);
  const [clearFile, setClearFile] = useState(false);
  const [error, setError] = useState("");
  const savedOnReceipt = useMemo(
    () => Object.fromEntries((doc.allocations || []).map((line) => [line.invoiceId, Number(line.amount) || 0])),
    [doc.allocations]
  );
  const customer = useMemo(
    () => customers.find((row) => row.id === header.customerId) || null,
    [customers, header.customerId]
  );
  const mine = useMemo(
    () => invoices.filter((row) => row.customerId === header.customerId),
    [invoices, header.customerId]
  );
  const openRows = useMemo(
    () => mine.filter((row) => roomFor(row, savedOnReceipt[row.id]) > 0 || picked[row.id] != null),
    [mine, picked, savedOnReceipt]
  );
  const outstanding = mine.reduce((sum, row) => sum + roomFor(row, savedOnReceipt[row.id]), 0);
  const selected = openRows.filter((row) => picked[row.id] != null);
  const paying = selected.reduce((sum, row) => sum + (Number(picked[row.id]) || 0), 0);
  const methods = [
    ["cash", t.methodCash],
    ["transfer", t.methodTransfer],
    ["cheque", t.methodCheque],
    ["card", t.methodCard],
  ];
  const proofUrl = !clearFile && header.filePath ? `/api/receipt-files/${header.filePath}` : "";

  function chooseCustomer(customerId) {
    setHeader((current) => ({ ...current, customerId }));
    setPicked({});
    setError("");
  }

  function toggleInvoice(invoice, on) {
    setPicked((current) => {
      const next = { ...current };
      if (on) next[invoice.id] = roomFor(invoice, savedOnReceipt[invoice.id]).toFixed(2);
      else delete next[invoice.id];
      return next;
    });
  }

  function selectOpen() {
    const next = {};
    for (const row of mine) {
      const pending = roomFor(row, savedOnReceipt[row.id]);
      if (pending > 0) next[row.id] = pending.toFixed(2);
    }
    setPicked(next);
  }

  async function onSave(event) {
    event.preventDefault();
    const allocations = selected
      .map((row) => ({ invoiceId: row.id, amount: Number(picked[row.id]) || 0 }))
      .filter((line) => line.amount > 0);
    if (!header.customerId || !allocations.length) {
      setError(t.receiptRequired);
      return;
    }
    setError("");
    const data = new FormData();
    data.set("payload", JSON.stringify({ ...header, allocations, amount: paying }));
    data.set("filePath", header.filePath || "");
    data.set("clearFile", clearFile ? "1" : "");
    if (file) data.set("file", file);
    await saveReceiptAction(data);
  }

  return (
    <form className="receipt-page" onSubmit={onSave}>
      <div className="doc-top">
        <div>
          <h1>{header.id ? t.editReceipt : t.newReceipt}</h1>
          <p>{t.receipts} · {header.number}</p>
        </div>
      </div>
      <div className="receipt-stats">
        <div className="receipt-stat"><span>{t.openInvoices}</span><strong>{customer ? openRows.length : "—"}</strong></div>
        <div className="receipt-stat"><span>{t.outstanding}</span><strong>{customer ? aed(outstanding) : "—"}</strong></div>
        <div className="receipt-stat"><span>{t.selectedInvoices}</span><strong>{selected.length}</strong></div>
        <div className="receipt-stat pay"><span>{t.thisPayment}</span><strong>{aed(paying)}</strong></div>
      </div>
      <div className="receipt-layout">
        <section className="panel receipt-main">
          <label>{t.selectCustomer}
            <select value={header.customerId || ""} onChange={(event) => chooseCustomer(event.target.value)}>
              <option value="">{t.selectCustomer}</option>
              {customers.map((row) => <option key={row.id} value={row.id}>{customerTitle(row)}</option>)}
            </select>
          </label>
          {customer ? (
            <div className="customer-box">
              <strong>{customerTitle(customer)}</strong>
              {customerContact(customer) ? <div>{customerContact(customer)}</div> : null}
              <div className="meta">
                <span>{t.email}</span><span>{customer.email || "—"}</span>
                <span>{t.phone}</span><span>{customer.phone || "—"}</span>
                <span>{t.address}</span><span>{customer.address || "—"}</span>
              </div>
            </div>
          ) : null}
          <div className="pick-head">
            <div>
              <h2>{t.pickInvoices}</h2>
              <p>{customer ? t.receiptSplit : t.chooseCustomerFirst}</p>
            </div>
            {customer && openRows.length ? <button className="btn ghost" type="button" onClick={selectOpen}>{t.selectAllOpen}</button> : null}
          </div>
          {!customer ? null : openRows.length === 0 ? <p>{t.noOpenInvoices}</p> : (
            <div className="invoice-pick">
              {openRows.map((row) => {
                const on = picked[row.id] != null;
                const room = roomFor(row, savedOnReceipt[row.id]);
                return (
                  <article className={on ? "on" : ""} key={row.id}>
                    <input type="checkbox" checked={on} onChange={(event) => toggleInvoice(row, event.target.checked)} aria-label={row.number} />
                    <div className="pick-copy">
                      <strong>{row.number}</strong>
                      <em>{String(row.date || "").slice(0, 10)}</em>
                      <em>{t.due} {aed(room)}</em>
                    </div>
                    <label className="pick-amt">{t.receivedAmount}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={!on}
                        value={on ? picked[row.id] : ""}
                        onChange={(event) => {
                          const typed = event.target.value;
                          if (typed === "") {
                            setPicked({ ...picked, [row.id]: "" });
                            return;
                          }
                          const next = Number(typed);
                          setPicked({ ...picked, [row.id]: next > room ? room.toFixed(2) : typed });
                        }}
                      />
                    </label>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <aside className="receipt-side">
          <section className="panel">
            <h2>{t.receiptDetails}</h2>
            <div className="receipt-fields">
              <label>{t.receiptNumber}
                <input value={header.number} onChange={(event) => setHeader({ ...header, number: event.target.value })} />
              </label>
              <label>{t.date}
                <input type="date" value={header.date} onChange={(event) => setHeader({ ...header, date: event.target.value })} />
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
            <label>{t.receiptNote}
              <textarea rows={3} value={header.notes || ""} onChange={(event) => setHeader({ ...header, notes: event.target.value })} />
            </label>
            <FilePick
              label={t.receiptFile}
              file={file}
              preview={proofUrl}
              storedName={header.filePath}
              onChange={(next) => {
                setFile(next);
                setClearFile(false);
              }}
              onClear={() => { setFile(null); setClearFile(true); }}
            />
          </section>
          <section className="panel summary-panel">
            <h2>{t.summary}</h2>
            <div className="sum-row"><span>{t.outstanding}</span><strong>{customer ? aed(outstanding) : "—"}</strong></div>
            <div className="sum-row"><span>{t.thisPayment}</span><strong>{aed(paying)}</strong></div>
            <div className="sum-row total"><span>{t.stillDue}</span><strong>{customer ? aed(Math.max(0, outstanding - paying)) : "—"}</strong></div>
            {error ? <div className="errors">{error}</div> : null}
            <div className="form-actions">
              <button className="sq pdf" type="button" title="PDF" onClick={async () => {
                const { downloadReceipt } = await import("../lib/download-doc");
                const numbers = selected.map((row) => row.number).filter(Boolean).join(", ");
                downloadReceipt({ ...header, amount: paying, invoiceNumber: numbers }, customer);
              }}><FileText size={16} /></button>
              <button className="btn save" type="submit">{t.save}</button>
            </div>
            <button className="cancel" type="button" onClick={() => router.push("/receipts")}>{t.cancel}</button>
          </section>
        </aside>
      </div>
    </form>
  );
}
