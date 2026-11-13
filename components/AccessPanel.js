"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Pencil, Plus, Trash2, X } from "lucide-react";
import { deleteStaffAction, saveStaffAction } from "../app/actions";
import { flashSaved } from "./SavedToast";
import { ACCOUNTANT_PERMISSIONS } from "../lib/permissions";
import { useI18n } from "./I18nProvider";

const PERMISSION_LABEL = {
  home: "home",
  fleet: "vehicleDashboard",
  finances: "vehicleFinances",
  quotes: "quotations",
  invoices: "invoices",
  receipts: "receipts",
  orders: "purchaseOrders",
  expenses: "expensesMenu",
  customers: "customers",
  vehicles: "vehicles",
  vendors: "vendors",
  employees: "employees",
  payslips: "payslips",
  reports: "reports",
  files: "files",
  settings: "settings",
};

const GROUPS = [
  ["groupDocs", ["quotes", "invoices", "receipts", "orders"]],
  ["groupFleet", ["fleet", "finances", "vehicles"]],
  ["groupPeople", ["customers", "vendors", "employees", "payslips"]],
  ["groupGeneral", ["home", "expenses", "reports", "files", "settings"]],
];

function emptyPerson() {
  return { id: "", name: "", role: "custom", active: true, permissions: [...ACCOUNTANT_PERMISSIONS] };
}

function roleLabel(role, t) {
  if (role === "admin") return t.adminRole;
  if (role === "accountant") return t.accountantRole;
  return t.customRole;
}

function CodeInput({ label, value, onChange, show, onToggle, t }) {
  return (
    <label>{label}
      <span className="code-field">
        <input
          type={show ? "text" : "password"}
          inputMode="numeric"
          autoComplete="new-password"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 8))}
        />
        <button type="button" className="code-eye" aria-label={show ? t.hideCode : t.showCode} title={show ? t.hideCode : t.showCode} onClick={onToggle}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </span>
    </label>
  );
}

function PersonDialog({ person, onClose, t }) {
  const router = useRouter();
  const isNew = !person.id;
  const isAdmin = person.role === "admin";
  const [draft, setDraft] = useState(person);
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(key) {
    const has = draft.permissions.includes(key);
    setDraft({ ...draft, permissions: has ? draft.permissions.filter((item) => item !== key) : [...draft.permissions, key] });
  }

  function toggleGroup(keys) {
    const all = keys.every((key) => draft.permissions.includes(key));
    const rest = draft.permissions.filter((key) => !keys.includes(key));
    setDraft({ ...draft, permissions: all ? rest : [...rest, ...keys] });
  }

  async function onSave(event) {
    event.preventDefault();
    setError("");
    if (!draft.name.trim()) return setError(t.codeInvalid);
    if (isNew && !code) return setError(t.codeInvalid);
    if (code && !/^\d{4,8}$/.test(code)) return setError(t.codeInvalid);
    if (code && code !== confirm) return setError(t.codeMismatch);
    if (!isAdmin && !draft.permissions.length) return setError(t.codeInvalid);
    setBusy(true);
    const result = await saveStaffAction({ ...draft, code });
    setBusy(false);
    if (result?.error) {
      setError(result.error === "taken" ? t.codeTaken : t.codeInvalid);
      return;
    }
    flashSaved();
    onClose();
    router.refresh();
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="dialog-card" onSubmit={onSave}>
        <div className="dialog-head">
          <h2>{isNew ? t.addStaff : t.editPerson}</h2>
          <button type="button" className="icon-btn" aria-label={t.cancel} onClick={onClose}><X size={18} /></button>
        </div>

        <div className="dialog-body">
          <label>{t.staffName}
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoFocus />
          </label>

          <div className="dialog-section">
            <h3><KeyRound size={15} /> {isNew ? t.accessCode : t.changeCode}</h3>
            {isNew ? null : <p className="k">{t.codeKeep}</p>}
            <div className="dialog-pair">
              <CodeInput label={isNew ? t.accessCode : t.newCode} value={code} onChange={setCode} show={show} onToggle={() => setShow(!show)} t={t} />
              <CodeInput label={t.confirmCode} value={confirm} onChange={setConfirm} show={show} onToggle={() => setShow(!show)} t={t} />
            </div>
            {isAdmin && code ? <p className="k orange">{t.adminCodeNote}</p> : null}
          </div>

          {isAdmin ? (
            <div className="dialog-section">
              <h3>{t.permissionsTitle}</h3>
              <p className="k">{t.adminAllAccess}</p>
            </div>
          ) : (
            <>
              <label className="switch-row">
                <span>{t.activeAccess}</span>
                <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
              </label>
              <div className="dialog-section">
                <h3>{t.permissionsTitle}</h3>
                <div className="perm-groups">
                  {GROUPS.map(([group, keys]) => {
                    const all = keys.every((key) => draft.permissions.includes(key));
                    return (
                      <fieldset className="perm-group" key={group}>
                        <div className="perm-group-head">
                          <b>{t[group]}</b>
                          <button type="button" className="linkish" onClick={() => toggleGroup(keys)}>{all ? t.clearAll : t.selectAll}</button>
                        </div>
                        {keys.map((key) => (
                          <label className="perm-item" key={key}>
                            <input type="checkbox" checked={draft.permissions.includes(key)} onChange={() => toggle(key)} />
                            <span>{t[PERMISSION_LABEL[key]]}</span>
                          </label>
                        ))}
                      </fieldset>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          {error ? <div className="errors">{error}</div> : null}
        </div>

        <div className="dialog-foot">
          <button className="btn" type="submit" disabled={busy}>{t.save}</button>
          <button className="btn ghost" type="button" onClick={onClose}>{t.cancel}</button>
        </div>
      </form>
    </div>
  );
}

export default function AccessPanel({ staff }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(null);

  async function remove(row) {
    if (!window.confirm(`${t.delete} ${row.name}?`)) return;
    await deleteStaffAction(row.id);
    router.refresh();
  }

  return (
    <section className="panel master-form access-panel" style={{ margin: 22 }}>
      <div className="access-head">
        <p className="lead">{t.accessLead}</p>
        <button className="btn" type="button" onClick={() => setOpen(emptyPerson())}><Plus size={16} /> {t.addStaff}</button>
      </div>
      <div className="people-list">
        {staff.map((row) => (
          <article className="person-row" key={row.id}>
            <span className={`person-mark ${row.role}`}>{(row.name || "?").trim().charAt(0)}</span>
            <span className="person-copy">
              <b>{row.name}</b>
              <small>
                <span className={row.role === "admin" ? "tag navy" : "tag"}>{roleLabel(row.role, t)}</span>
                <span className={row.active ? "tag green" : "tag gray"}>{row.active ? t.activeAccess : t.stoppedAccess}</span>
                <span className="person-perms">{row.role === "admin" ? t.allAccess : `${row.permissions.length} ${t.permissionsCount}`}</span>
              </small>
            </span>
            <span className="file-actions">
              <button className="icon-btn" type="button" aria-label={t.edit} title={t.edit} onClick={() => setOpen(row)}><Pencil size={16} /></button>
              {row.role === "admin" ? null : (
                <button className="icon-btn danger" type="button" aria-label={t.delete} title={t.delete} onClick={() => remove(row)}><Trash2 size={16} /></button>
              )}
            </span>
          </article>
        ))}
      </div>
      {open ? <PersonDialog key={open.id || "new"} person={open} t={t} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}
