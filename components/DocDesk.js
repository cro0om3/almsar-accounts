"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Download, FileOutput, FileText, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { deleteInvoiceAction, deletePurchaseOrderAction, deleteQuoteAction, recordPaymentAction } from "../app/actions";
import { flashSaved } from "./SavedToast";
import { useI18n } from "./I18nProvider";
import { aed } from "../lib/money";
import { customerContact, customerTitle } from "../lib/party";

function basisLabel(value, t) {
  if (value === "hourly") return t.hourly;
  if (value === "monthly") return t.monthly;
  return value || "—";
}

function termsHtml(value) {
  const text = String(value || "").trim();
  if (!text || text === "—" || text === "-") return "";
  const safe = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  if (/<[a-z][\s\S]*>/i.test(safe)) return safe;
  return safe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
}

function statusLabel(status, t, kind) {
  if (kind === "quote" && (!status || status === "active")) return t.draft;
  if (status === "invoice_sent" || status === "sent") return t.sent;
  if (status === "payment_received") return t.paid;
  if (status === "accepted") return t.accepted;
  if (status === "declined") return t.declined;
  if (status === "draft") return t.draft;
  return t.active;
}

export default function DocDesk({ kind, docs }) {
  const { t } = useI18n();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(docs[0]?.id || "");
  const [paying, setPaying] = useState(false);
  const [amount, setAmount] = useState("");
  const current = useMemo(
    () => docs.find((doc) => doc.id === selectedId) || null,
    [docs, selectedId]
  );

  const titles = {
    quote: { title: t.quotations, lead: t.manageQuotes, all: t.allQuotations, create: t.newQuotation, href: "/quotes/new" },
    invoice: { title: t.invoices, lead: t.manageInvoices, all: t.allInvoices, create: t.newInvoice, href: "/invoices/new" },
    po: { title: t.purchaseOrders, lead: t.managePo, all: t.allPurchaseOrders, create: t.newPurchaseOrder, href: "/purchase-orders/new" },
  }[kind];

  async function remove(id) {
    if (!window.confirm(t.delete)) return;
    if (kind === "quote") await deleteQuoteAction(id);
    if (kind === "invoice") await deleteInvoiceAction(id);
    if (kind === "po") await deletePurchaseOrderAction(id);
    setSelectedId("");
    router.refresh();
  }

  async function savePayment(event) {
    event.preventDefault();
    if (!current) return;
    await recordPaymentAction(current.id, amount);
    setPaying(false);
    flashSaved();
    router.refresh();
  }

  return (
    <div className="desk-page">
      <header className="desk-head">
        <h1>{titles.title}</h1>
        <p>{titles.lead}</p>
      </header>
      <div className="desk">
        <aside className="desk-list">
          <div className="desk-list-head">
            <span>{titles.all} ({docs.length})</span>
            <Link className="btn tiny" href={titles.href}><Plus size={14} /> {titles.create}</Link>
          </div>
          <div className="desk-scroll">
            {docs.length === 0 ? (
              <div className="desk-empty">
                <p>{t.noPo}</p>
                <span className="linkish">{t.createFirstPo}</span>
              </div>
            ) : docs.map((doc) => {
              const due = Math.max(0, Number(doc.total || 0) - Number(doc.amountReceived || 0));
              const first = doc.items?.[0];
              const chip = kind === "invoice"
                ? [first?.vehicleNumber, first?.vehicleTypeLabel].filter(Boolean).join(" · ")
                : (first?.vehicleTypeLabel || first?.vehicleNumber || "");
              return (
                <button
                  key={doc.id}
                  type="button"
                  id={`doc-card-${doc.id}`}
                  className={doc.id === current?.id ? "doc-row on" : "doc-row"}
                  onClick={() => {
                    setSelectedId(doc.id);
                    setPaying(false);
                    setAmount(String(doc.amountReceived || ""));
                    requestAnimationFrame(() => {
                      document.getElementById(`doc-card-${doc.id}`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
                    });
                  }}
                >
                  <div className="doc-row-top">
                    <b>{doc.number}</b>
                    <strong>{aed(doc.total)}</strong>
                  </div>
                  <div>{customerTitle(doc) || doc.vendorName || "—"}</div>
                  <small>{doc.date}</small>
                  <div className="doc-row-meta">
                    {chip ? <em>{chip}</em> : null}
                    {kind !== "po" ? <span className="tag green">{statusLabel(doc.status, t, kind)}</span> : null}
                  </div>
                  {kind === "invoice" && due > 0 ? <span className="due">{aed(due)} {t.due}</span> : null}
                </button>
              );
            })}
          </div>
        </aside>
        <section className="desk-detail">
          {!current ? (
            <div className="desk-blank">
              <div className="blank-icon"><FileText size={28} /></div>
              <h2>{kind === "po" ? t.noPoSelected : titles.title}</h2>
              <p>{kind === "po" ? t.selectPo : titles.lead}</p>
              {kind !== "po" ? null : <Link className="btn ghost" href="/purchase-orders/new">{t.createNewPo}</Link>}
            </div>
          ) : (
            <>
              <div className="detail-top">
                <div>
                  <h2>
                    {current.number}{" "}
                    <span className={kind === "invoice" ? "tag green" : "tag mint"}>{statusLabel(current.status, t, kind)}</span>
                  </h2>
                  <p>{customerTitle(current) || current.vendorName} · {current.date}</p>
                </div>
                <div className="detail-actions">
                  <button type="button" className="btn ghost" aria-label={t.download} title={t.download} onClick={async () => { const { downloadPdf } = await import("../lib/download-doc"); downloadPdf(kind, current, current.customer); }}><Download size={18} /><span>{t.download}</span></button>
                  {kind === "quote" ? (
                    <Link className="btn" href={`/invoices/new?fromQuote=${current.id}`} aria-label={t.convertToInvoice} title={t.convertToInvoice}><FileOutput size={18} /><span>{t.convertToInvoice}</span></Link>
                  ) : null}
                  {kind === "invoice" ? (
                    <button type="button" className="btn ghost" aria-label={t.recordPayment} title={t.recordPayment} onClick={() => setPaying((open) => !open)}><Wallet size={18} /><span>{t.recordPayment}</span></button>
                  ) : null}
                  <Link className="btn ghost" href={kind === "quote" ? `/quotes/${current.id}` : kind === "invoice" ? `/invoices/${current.id}` : `/purchase-orders/${current.id}`} aria-label={t.edit} title={t.edit}><Pencil size={18} /><span>{t.edit}</span></Link>
                  <button type="button" className="btn danger" aria-label={t.delete} title={t.delete} onClick={() => remove(current.id)}><Trash2 size={18} /><span>{t.delete}</span></button>
                </div>
              </div>
              {paying ? (
                <form className="pay-box" onSubmit={savePayment}>
                  <label>{t.received}<input value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
                  <button className="btn" type="submit">{t.add}</button>
                </form>
              ) : null}
              <div className="detail-cards">
                <article className="panel">
                  <h3>{t.customerDetails}</h3>
                  <div className="pair"><span>{t.customerName}</span><b>{customerTitle(current.customer || current) || current.vendorName || "—"}</b></div>
                  {customerContact(current.customer || current) ? <div className="pair"><span>{t.contactPerson}</span><b>{customerContact(current.customer || current)}</b></div> : null}
                  <div className="pair"><span>{t.email}</span><b>{current.customer?.email || "—"}</b></div>
                  <div className="pair"><span>{t.phone}</span><b className="ltr">{current.customer?.phone || "—"}</b></div>
                  {current.customer?.address ? <div className="pair"><span>{t.address}</span><b>{current.customer.address}</b></div> : null}
                  {current.customer?.trn ? <div className="pair"><span>TRN</span><b className="ltr">{current.customer.trn}</b></div> : null}
                </article>
                <article className="panel">
                  <h3>{t.summary}</h3>
                  <div className="sum-row"><span>{t.subtotal}</span><b>{aed(current.subtotal)}</b></div>
                  <div className="sum-row"><span>{t.tax}</span><b>{aed(current.tax)}</b></div>
                  <div className="sum-row total"><span>{t.total}</span><b>{aed(current.total)}</b></div>
                  {kind === "invoice" ? (
                    <>
                      <div className="sum-row"><span>{t.received}</span><b>{aed(current.amountReceived)}</b></div>
                      <div className="sum-row"><span>{t.pending}</span><b className="orange">{aed(Math.max(0, Number(current.total || 0) - Number(current.amountReceived || 0)))}</b></div>
                    </>
                  ) : null}
                </article>
              </div>
              <article className="panel lines-card">
                <h3>{t.lineItems}</h3>
                <div className="line-cards">
                  {(current.items || []).map((item, index) => (
                    <article className="line-card" key={item.id || index}>
                      <div className="line-card-top">
                        <b>{index + 1}. {kind === "invoice" ? [item.vehicleNumber, item.vehicleTypeLabel].filter(Boolean).join(" · ") || t.vehicle : (item.vehicleTypeLabel || item.vehicleNumber || t.vehicle)}</b>
                        <strong className="money">{aed(item.lineTotal)}</strong>
                      </div>
                      <p>{item.description || "—"}</p>
                      <div className="line-meta">
                        <span>{t.basis}<b>{basisLabel(item.rentalBasis, t)}</b></span>
                        <span>{t.qty}<b>{item.quantity}</b></span>
                        <span>{t.rate}<b>{Number(item.unitPrice || 0).toFixed(2)}</b></span>
                        <span>{t.taxPct}<b>{Number(item.taxPercent || 0).toFixed(0)}%</b></span>
                        {kind === "invoice" ? <span>{t.received}<b>{aed(item.amountReceived || 0)}</b></span> : null}
                      </div>
                    </article>
                  ))}
                </div>
                <table className="line-table">
                  <thead>
                    <tr>
                      <th>#</th><th>{t.vehicle}</th><th>{t.description}</th><th>{t.basis}</th>
                      <th>{t.qty}</th><th>{t.rate}</th><th>{t.gross}</th><th>{t.taxPct}</th><th>{t.net}</th>
                      {kind === "invoice" ? <th>{t.received}</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {(current.items || []).map((item, index) => (
                      <tr key={item.id || index}>
                        <td>{index + 1}</td>
                        <td>{kind === "invoice" ? [item.vehicleNumber, item.vehicleTypeLabel].filter(Boolean).join(" · ") || "—" : (item.vehicleTypeLabel || item.vehicleNumber || "—")}</td>
                        <td>{item.description || "—"}</td>
                        <td>{item.rentalBasis || "—"}</td>
                        <td>{item.quantity}</td>
                        <td>{Number(item.unitPrice || 0).toFixed(2)}</td>
                        <td>{Number(item.grossAmount || item.quantity * item.unitPrice || 0).toFixed(2)}</td>
                        <td>{Number(item.taxPercent || 0).toFixed(2)}</td>
                        <td>{Number(item.lineTotal || 0).toFixed(2)}</td>
                        {kind === "invoice" ? <td>{Number(item.amountReceived || 0).toFixed(2)}</td> : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
              <article className="panel">
                <h3>{t.terms}</h3>
                {termsHtml(current.terms || current.notes) ? (
                  <div className="terms-html" dangerouslySetInnerHTML={{ __html: termsHtml(current.terms || current.notes) }} />
                ) : <p className="k">—</p>}
              </article>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
