"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { savePayslipAction } from "../app/actions";
import { aed } from "../lib/money";
import { useI18n } from "./I18nProvider";

export default function PayslipDesk({ rows, employees }) {
  const { t } = useI18n();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(rows[0]?.id || "");
  const current = rows.find((row) => row.id === selectedId) || null;
  const [draft, setDraft] = useState(null);
  const form = draft || current || {
    id: "",
    month: new Date().toISOString().slice(0, 7),
    employeeId: employees[0]?.id || "",
    baseSalary: employees[0]?.salary || 0,
    overtimeHours: 0,
    overtimeRate: employees[0]?.overtimeRate || 0,
    deductions: 0,
    status: "draft",
    notes: "",
  };

  function update(key, value) {
    setDraft({ ...form, [key]: value });
  }

  return (
    <div className="desk-page">
      <header className="desk-head">
        <h1>{t.payslips}</h1>
        <p>{t.employeeSalariesLead}</p>
      </header>
      <div className="desk">
        <aside className="desk-list">
          <div className="desk-list-head">
            <span>{t.payslips} ({rows.length})</span>
            <button className="btn tiny" type="button" onClick={() => { setSelectedId(""); setDraft({ id: "", month: new Date().toISOString().slice(0, 7), employeeId: "", baseSalary: 0, overtimeHours: 0, overtimeRate: 0, deductions: 0, status: "draft", notes: "" }); }}>{t.newRecord}</button>
          </div>
          <div className="desk-scroll">
            {rows.length === 0 ? <p className="desk-empty">{t.noRecords}</p> : rows.map((row) => (
              <button key={row.id} type="button" className={row.id === form.id ? "doc-row on" : "doc-row"} onClick={() => { setDraft(null); setSelectedId(row.id); }}>
                <b>{row.employeeName || "—"}</b>
                <small>{row.month}</small>
                <strong>{aed(row.netPay)}</strong>
              </button>
            ))}
          </div>
        </aside>
        <section className="desk-detail">
          <form className="panel master-form" onSubmit={async (event) => { event.preventDefault(); await savePayslipAction(form); setDraft(null); router.refresh(); }}>
            <h2>{form.id ? t.edit : t.newRecord}</h2>
            <div className="master-grid">
              <label>{t.month}<input type="month" value={String(form.month || "").slice(0, 7)} onChange={(event) => update("month", event.target.value)} /></label>
              <label>{t.employees}
                <select value={form.employeeId || ""} onChange={(event) => {
                  const employee = employees.find((row) => row.id === event.target.value);
                  setDraft({ ...form, employeeId: event.target.value, baseSalary: employee?.salary || form.baseSalary, overtimeRate: employee?.overtimeRate || form.overtimeRate });
                }}>
                  <option value="">—</option>
                  {employees.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                </select>
              </label>
              <label>{t.salary}<input type="number" value={form.baseSalary || 0} onChange={(event) => update("baseSalary", event.target.value)} /></label>
              <label>{t.overtimeHours}<input type="number" value={form.overtimeHours || 0} onChange={(event) => update("overtimeHours", event.target.value)} /></label>
              <label>{t.overtimeRate}<input type="number" value={form.overtimeRate || 0} onChange={(event) => update("overtimeRate", event.target.value)} /></label>
              <label>{t.deductions}<input type="number" value={form.deductions || 0} onChange={(event) => update("deductions", event.target.value)} /></label>
              <label>{t.status}
                <select value={form.status || "draft"} onChange={(event) => update("status", event.target.value)}>
                  <option value="draft">{t.draft}</option>
                  <option value="processed">{t.sent}</option>
                  <option value="paid">{t.paid}</option>
                </select>
              </label>
              <label>{t.notes}<textarea value={form.notes || ""} onChange={(event) => update("notes", event.target.value)} /></label>
            </div>
            <div className="sum-row total"><span>{t.netPay}</span><b>{aed((Number(form.baseSalary) || 0) + (Number(form.overtimeHours) || 0) * (Number(form.overtimeRate) || 0) - (Number(form.deductions) || 0))}</b></div>
            <button className="btn" type="submit">{t.save}</button>
          </form>
        </section>
      </div>
    </div>
  );
}
