"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Download, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteReceiptAction } from "../app/actions";
import { useI18n } from "./I18nProvider";
import { aed } from "../lib/money";

export default function ReceiptDesk({ docs }) {
  const { t } = useI18n();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(docs[0]?.id || "");
  const current = useMemo(
    () => docs.find((doc) => doc.id === selectedId) || null,
    [docs, selectedId]
  );
  const methods = {
    cash: t.methodCash,
    transfer: t.methodTransfer,
    cheque: t.methodCheque,
    card: t.methodCard,
  };

  async function remove(id) {
    if (!window.confirm(t.delete)) return;
    await deleteReceiptAction(id);
    setSelectedId("");
    router.refresh();
  }

  return (
    <div className="desk-page">
      <header className="desk-head">
        <h1>{t.receipts}</h1>
        <p>{t.manageReceipts}</p>
      </header>
      <div className="desk">
        <aside className="desk-list">
          <div className="desk-list-head">
            <span>{t.allReceipts} ({docs.length})</span>
            <Link className="btn tiny" href="/receipts/new"><Plus size={14} /> {t.newReceipt}</Link>
          </div>
          <div className="desk-scroll">
            {docs.length === 0 ? (
              <div className="desk-empty">
                <p>{t.noReceipts}</p>
                <span className="linkish">{t.selectReceipt}</span>
              </div>
            ) : docs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                id={`doc-card-${doc.id}`}
                className={doc.id === current?.id ? "doc-row on" : "doc-row"}
                onClick={() => {
                  setSelectedId(doc.id);
                  requestAnimationFrame(() => {
                    document.getElementById(`doc-card-${doc.id}`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
                  });
                }}
              >
                <div className="doc-row-top">
                  <b>{doc.number}</b>
                  <strong>{aed(doc.amount)}</strong>
                </div>
                <div>{doc.customerName || "—"}</div>
                <small>{doc.date}{doc.invoiceNumber ? ` · ${doc.invoiceNumber}` : ""}</small>
              </button>
            ))}
          </div>
        </aside>
        <section className="desk-detail">
          {!current ? (
            <div className="desk-blank">
              <div className="blank-icon"><FileText size={28} /></div>
              <h2>{t.receipts}</h2>
              <p>{t.selectReceipt}</p>
            </div>
          ) : (
            <>
              <div className="detail-top">
                <div>
                  <h2>{current.number}</h2>
                  <p>{current.customerName || "—"} · {current.date}</p>
                </div>
                <div className="detail-actions">
                  <button type="button" className="btn ghost" aria-label={t.download} title={t.download} onClick={async () => { const { downloadReceipt } = await import("../lib/download-doc"); downloadReceipt(current, current.customer); }}><Download size={18} /><span>{t.download}</span></button>
                  <Link className="btn ghost" href={`/receipts/${current.id}`} aria-label={t.edit} title={t.edit}><Pencil size={18} /><span>{t.edit}</span></Link>
                  <button type="button" className="btn danger" aria-label={t.delete} title={t.delete} onClick={() => remove(current.id)}><Trash2 size={18} /><span>{t.delete}</span></button>
                </div>
              </div>
              <div className="detail-cards">
                <article className="panel">
                  <h3>{t.customerDetails}</h3>
                  <div className="pair"><span>{t.customerName}</span><b>{current.customer?.name || current.customerName || "—"}</b></div>
                  <div className="pair"><span>{t.email}</span><b>{current.customer?.email || "—"}</b></div>
                  <div className="pair"><span>{t.phone}</span><b className="ltr">{current.customer?.phone || "—"}</b></div>
                  {current.customer?.trn ? <div className="pair"><span>TRN</span><b className="ltr">{current.customer.trn}</b></div> : null}
                </article>
                <article className="panel">
                  <h3>{t.summary}</h3>
                  <div className="pair"><span>{t.againstInvoice}</span><b>{current.invoiceNumber || "—"}</b></div>
                  <div className="pair"><span>{t.paymentMethod}</span><b>{methods[current.method] || current.method}</b></div>
                  <div className="pair"><span>{t.referenceNo}</span><b className="ltr">{current.reference || "—"}</b></div>
                  <div className="sum-row total"><span>{t.receivedAmount}</span><b>{aed(current.amount)}</b></div>
                </article>
              </div>
              <article className="panel lines-card">
                <h3>{t.receiptNote}</h3>
                <p className="k">{current.notes || "—"}</p>
              </article>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
