"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImagePlus, Pencil, Search, Trash2, Wallet, X } from "lucide-react";
import { deleteExpenseAction, saveExpenseAction } from "../app/actions";
import { flashSaved } from "./SavedToast";
import { useI18n } from "./I18nProvider";
import { aed } from "../lib/money";

const CATEGORIES = ["rent", "fuel", "maintenance", "insurance", "registration", "driver", "purchase", "petty", "office", "other"];
const LEGACY = {
  Fuel: "fuel",
  Maintenance: "maintenance",
  Insurance: "insurance",
  Registration: "registration",
  "Driver Salary": "driver",
  Purchase: "purchase",
  Other: "other",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function blankForm(category) {
  return { id: "", description: "", amount: "", date: today(), category, notes: "", receipt: null, preview: "", receiptPath: "", clearReceipt: false };
}

function isPdf(file, path) {
  return file?.type === "application/pdf" || /\.pdf$/i.test(file?.name || "") || /\.pdf$/i.test(path || "");
}

export default function ExpensesDesk({ vehicles, general }) {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState("vehicle");
  const [query, setQuery] = useState("");
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || "");
  const [generalId, setGeneralId] = useState("");
  const fileRef = useRef(null);
  const [form, setForm] = useState(blankForm("fuel"));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const labels = {
    fuel: t.catFuel,
    maintenance: t.catMaintenance,
    insurance: t.catInsurance,
    registration: t.catRegistration,
    driver: t.catDriver,
    purchase: t.catPurchase,
    rent: t.catRent,
    petty: t.catPetty,
    office: t.catOffice,
    other: t.catOther,
  };

  function categoryLabel(value) {
    const key = LEGACY[value] || value;
    return labels[key] || value || labels.other;
  }

  const vehicleRows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return vehicles.filter((vehicle) => `${vehicle.vehicleNumber} ${vehicle.vehicleType}`.toLowerCase().includes(text));
  }, [vehicles, query]);

  const currentVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId) || null;
  const currentGeneral = general.find((row) => row.id === generalId) || null;
  const history = mode === "vehicle" ? currentVehicle?.expenses || [] : general;
  const spent = history.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);

  function openGeneral() {
    setMode("general");
    setError("");
    setForm(blankForm("rent"));
    setGeneralId("");
    requestAnimationFrame(() => {
      document.getElementById("vehicle-card-general")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    });
  }

  function openVehicle(id) {
    setMode("vehicle");
    setVehicleId(id);
    setError("");
    setForm(blankForm("fuel"));
    requestAnimationFrame(() => {
      document.getElementById(`vehicle-card-${id}`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    });
  }

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    if (!form.description.trim() || Number(form.amount) <= 0) {
      setError(t.requiredExpense);
      return;
    }
    if (mode === "vehicle" && !currentVehicle) return;
    const body = new FormData();
    body.set("id", form.id || "");
    body.set("kind", mode);
    body.set("vehicleId", currentVehicle?.id || "");
    body.set("receiptPath", form.clearReceipt ? "" : (form.receiptPath || ""));
    if (form.clearReceipt) body.set("clearReceipt", "1");
    body.set("description", form.description.trim());
    body.set("amount", form.amount);
    body.set("date", form.date);
    body.set("category", form.category);
    body.set("notes", form.notes);
    if (form.receipt) body.set("receipt", form.receipt);
    setSaving(true);
    const result = await saveExpenseAction(body);
    setSaving(false);
    if (result?.error) {
      setError(t.requiredExpense);
      return;
    }
    setForm(blankForm(mode === "general" ? form.category : "fuel"));
    if (fileRef.current) fileRef.current.value = "";
    flashSaved();
    router.refresh();
  }

  function edit(row) {
    const category = LEGACY[row.category] || row.category || (mode === "general" ? "rent" : "fuel");
    setForm({
      id: row.id,
      description: row.description || "",
      amount: String(row.amount ?? ""),
      date: row.date || today(),
      category: labels[category] ? category : "other",
      notes: row.notes || "",
      receipt: null,
      preview: "",
      receiptPath: row.receiptPath || "",
      clearReceipt: false,
    });
    if (fileRef.current) fileRef.current.value = "";
    if (mode === "general") setGeneralId(row.id);
    document.querySelector(".expense-form")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  async function remove(kind, id) {
    if (!window.confirm(t.delete)) return;
    await deleteExpenseAction(kind, id);
    if (id === generalId) setGeneralId("");
    router.refresh();
  }

  const generalTotal = general.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="desk-page">
      <div className="desk finance">
        <aside className="desk-list">
          <header className="finance-head">
            <h1>{t.expensesMenu}</h1>
            <p>{t.vehicleExpenseLead}</p>
            <label className="search">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchVehicle} />
            </label>
          </header>
          <div className="desk-scroll">
            <div className="vehicle-swipe">
              <button id="vehicle-card-general" type="button" className={mode === "general" ? "finance-card on" : "finance-card"} onClick={openGeneral}>
                <b>{t.generalExpenses}</b>
                <span>{t.generalLead}</span>
                {general.length ? <strong>{aed(generalTotal)}</strong> : <em>{t.noGeneral}</em>}
              </button>
              {vehicleRows.map((vehicle) => {
                const total = vehicle.expenses.reduce((sum, row) => sum + row.amount, 0);
                const selected = mode === "vehicle" && vehicle.id === currentVehicle?.id;
                return (
                  <button id={`vehicle-card-${vehicle.id}`} key={vehicle.id} type="button" className={selected ? "finance-card on" : "finance-card"} onClick={() => openVehicle(vehicle.id)}>
                    <b>{vehicle.vehicleType || t.vehicle}</b>
                    <span>{vehicle.vehicleNumber}</span>
                    {vehicle.expenses.length ? <strong>{aed(total)}</strong> : <em>{t.noExpenses}</em>}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
        <section className="desk-detail">
          {mode === "vehicle" && !currentVehicle ? (
            <div className="desk-blank">
              <div className="blank-icon"><Wallet size={28} /></div>
              <h2>{t.selectVehicle}</h2>
              <p>{t.vehicleExpenseLead}</p>
            </div>
          ) : (
            <>
              <div className="detail-top">
                <div>
                  <h2>{mode === "vehicle" ? (currentVehicle.vehicleType || t.vehicle) : t.generalExpenses}</h2>
                  <p>{mode === "vehicle" ? currentVehicle.vehicleNumber : t.generalLead}</p>
                </div>
                <b className="money">{t.spent}: {aed(spent)}</b>
              </div>
              <form className="panel expense-form" onSubmit={onSubmit}>
                <h3>{form.id ? t.edit : t.addExpense}</h3>
                <div className="master-grid">
                  <label>{t.description}
                    <input value={form.description} onChange={(event) => update("description", event.target.value)} placeholder={t.expenseDetails} />
                  </label>
                  <label>{t.amount}
                    <input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => update("amount", event.target.value)} />
                  </label>
                  <label>{t.date}
                    <input type="date" value={form.date} onChange={(event) => update("date", event.target.value)} />
                  </label>
                  <label>{t.category}
                    <select value={form.category} onChange={(event) => update("category", event.target.value)}>
                      {CATEGORIES.map((key) => <option key={key} value={key}>{labels[key]}</option>)}
                    </select>
                  </label>
                  <label>{t.notes}
                    <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} />
                  </label>
                  <label className="receipt-wrap">{t.receipt}
                    <span className="receipt-box">
                      <ImagePlus size={18} />
                      <span>{form.receipt ? form.receipt.name : t.receiptHint}</span>
                      <input ref={fileRef} className="receipt-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        setForm((current) => ({ ...current, receipt: file, preview: file ? URL.createObjectURL(file) : "", clearReceipt: false }));
                      }} />
                    </span>
                  </label>
                </div>
                {(form.preview || (form.receiptPath && !form.clearReceipt) || form.receipt) ? (
                  <div className="receipt-chosen">
                    {isPdf(form.receipt, form.receiptPath) ? (
                      <a className="pdf-chip" href={form.preview || `/api/receipts/${form.receiptPath}`} target="_blank" rel="noreferrer"><FileText size={16} /> PDF</a>
                    ) : (
                      <img className="receipt-preview" src={form.preview || `/api/receipts/${form.receiptPath}`} alt="" />
                    )}
                    <button className="btn ghost" type="button" onClick={() => {
                      if (fileRef.current) fileRef.current.value = "";
                      setForm((current) => ({ ...current, receipt: null, preview: "", receiptPath: "", clearReceipt: true }));
                    }}>
                      <X size={16} /> {t.removePhoto}
                    </button>
                  </div>
                ) : null}
                {error ? <div className="errors">{error}</div> : null}
                <button className="btn" type="submit" disabled={saving}>{t.save}</button>
              </form>
              <div className="expense-list">
                {history.length === 0 ? <p className="desk-empty">{mode === "vehicle" ? t.noExpenses : t.noGeneral}</p> : history.map((row) => (
                  <article className={`expense-row ${row.id === currentGeneral?.id ? "on" : ""}`} key={row.id}>
                    {row.receiptPath ? (
                      isPdf(null, row.receiptPath)
                        ? <a className="receipt-empty" href={`/api/receipts/${row.receiptPath}`} target="_blank" rel="noreferrer">PDF</a>
                        : <img src={`/api/receipts/${row.receiptPath}`} alt="" />
                    ) : <span className="receipt-empty"><ImagePlus size={16} /></span>}
                    <div>
                      <b>{row.description}</b>
                      <small>{row.date} · {categoryLabel(row.category)}{row.notes ? ` · ${row.notes}` : ""}</small>
                    </div>
                    <strong className="money">{aed(row.amount)}</strong>
                    <div className="expense-actions">
                      <button type="button" aria-label={t.edit} title={t.edit} onClick={() => edit(row)}><Pencil size={16} /></button>
                      <button className="danger" type="button" aria-label={t.delete} title={t.delete} onClick={() => remove(mode === "general" ? "general" : "vehicle", row.id)}><Trash2 size={16} /></button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
