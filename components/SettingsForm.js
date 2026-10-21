"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deleteStaffAction, saveBrandingAction, saveSettingsAction, saveStaffAction } from "../app/actions";
import { flashSaved } from "./SavedToast";
import { ACCOUNTANT_PERMISSIONS, PERMISSIONS } from "../lib/permissions";
import CompanyFiles from "./CompanyFiles";
import FilePick from "./FilePick";
import { useI18n } from "./I18nProvider";

function plainTerms(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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

function emptyStaff() {
  return { id: "", name: "", code: "", active: true, permissions: [...ACCOUNTANT_PERMISSIONS], role: "custom" };
}

export default function SettingsForm({ settings, files, staff }) {
  const { t } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState("company");
  const [form, setForm] = useState({
    companyName: settings.companyName || "",
    companyNameArabic: settings.companyNameArabic || "",
    tagline: settings.tagline || "",
    headerNote: settings.headerNote || "",
    address: settings.address || "",
    vatNumber: settings.vatNumber || "",
    footerContactEnglish: settings.footerContactEnglish || "",
    footerAddressEnglish: settings.footerAddressEnglish || "",
    email: settings.email || "",
    website: settings.website || "",
    currency: settings.currency || "AED",
    defaultTerms: plainTerms(settings.defaultTerms),
  });
  const [saved, setSaved] = useState(false);
  const [person, setPerson] = useState(emptyStaff);
  const [staffError, setStaffError] = useState("");
  const [brandPick, setBrandPick] = useState({});
  const stamp = settings.updatedAt || "0";

  function update(key, value) {
    setSaved(false);
    setForm({ ...form, [key]: value });
  }

  const tabs = [
    ["company", t.tabCompany],
    ["logo", t.tabLogo],
    ["files", t.tabFiles],
    ["access", t.tabAccess],
  ];

  return (
    <div className="desk-page">
      <header className="desk-head">
        <h1>{t.settings}</h1>
        <p>{t.settingsLead}</p>
      </header>
      <div className="settings-tabs">
        {tabs.map(([id, label]) => (
          <button className={tab === id ? "on" : ""} key={id} type="button" onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === "company" ? (
        <form className="panel master-form" style={{ margin: 22 }} onSubmit={async (event) => {
          event.preventDefault();
          await saveSettingsAction(form);
          setSaved(true);
          flashSaved();
          router.refresh();
        }}>
          <div className="master-grid">
            <label>{t.companyName}<input value={form.companyName} onChange={(event) => update("companyName", event.target.value)} /></label>
            <label>{t.companyNameArabic}<input value={form.companyNameArabic} onChange={(event) => update("companyNameArabic", event.target.value)} /></label>
            <label>{t.tagline}<input value={form.tagline} onChange={(event) => update("tagline", event.target.value)} /></label>
            <label>{t.headerNote}<input value={form.headerNote} onChange={(event) => update("headerNote", event.target.value)} /></label>
            <label>{t.phone}<input value={form.footerContactEnglish} onChange={(event) => update("footerContactEnglish", event.target.value)} /></label>
            <label>{t.email}<input value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
            <label>{t.website}<input value={form.website} onChange={(event) => update("website", event.target.value)} /></label>
            <label>{t.vatNumber}<input value={form.vatNumber} onChange={(event) => update("vatNumber", event.target.value)} /></label>
            <label>{t.footerAddress}<input value={form.footerAddressEnglish} onChange={(event) => update("footerAddressEnglish", event.target.value)} /></label>
            <label>{t.currency}<input value={form.currency} onChange={(event) => update("currency", event.target.value)} /></label>
            <label className="span-2">{t.address}<textarea value={form.address} onChange={(event) => update("address", event.target.value)} /></label>
            <label className="span-2">{t.defaultTerms}<textarea value={form.defaultTerms} onChange={(event) => update("defaultTerms", event.target.value)} /></label>
          </div>
          <div className="detail-actions">
            <button className="btn" type="submit">{t.save}</button>
            {saved ? <span className="green">{t.saved}</span> : null}
          </div>
        </form>
      ) : null}

      {tab === "logo" ? (
        <form className="panel master-form" style={{ margin: 22 }} onSubmit={async (event) => {
          event.preventDefault();
          await saveBrandingAction(new FormData(event.currentTarget));
          setSaved(true);
          flashSaved();
          router.refresh();
        }}>
          <p className="lead">{t.brandingLead}</p>
          <div className="brand-grid">
            {["logo", "seal", "signature"].map((slot) => (
              <FilePick
                key={slot}
                name={slot}
                label={t[slot]}
                accept="image/jpeg,image/png,image/webp"
                file={brandPick[slot] || null}
                preview={`/api/branding/${slot}?v=${stamp}`}
                allowClear={Boolean(brandPick[slot])}
                onChange={(next) => setBrandPick((current) => ({ ...current, [slot]: next }))}
                onClear={() => setBrandPick((current) => ({ ...current, [slot]: null }))}
              />
            ))}
          </div>
          <div className="detail-actions">
            <button className="btn" type="submit">{t.save}</button>
            {saved ? <span className="green">{t.saved}</span> : null}
          </div>
        </form>
      ) : null}

      {tab === "files" ? (
        <section className="panel master-form" style={{ margin: 22 }}>
          <CompanyFiles files={files} />
        </section>
      ) : null}

      {tab === "access" ? (
        <section className="panel master-form" style={{ margin: 22 }}>
          <p className="lead">{t.accessLead}</p>
          <form className="master-grid" onSubmit={async (event) => {
            event.preventDefault();
            setStaffError("");
            const result = await saveStaffAction(person);
            if (result?.error) {
              setStaffError(result.error === "taken" ? t.codeTaken : t.codeInvalid);
              return;
            }
            setPerson(emptyStaff());
            flashSaved();
            router.refresh();
          }}>
            <label>{t.staffName}<input value={person.name} onChange={(event) => setPerson({ ...person, name: event.target.value })} required /></label>
            <label>{t.accessCode}
              <input
                inputMode="numeric"
                value={person.role === "admin" ? "4477" : person.code}
                disabled={person.role === "admin"}
                onChange={(event) => setPerson({ ...person, code: event.target.value.replace(/\D/g, "").slice(0, 8) })}
                required
              />
            </label>
            <div className="span-2 perm-grid">
              {PERMISSIONS.map((key) => (
                <label className="check" key={key}>
                  <input
                    type="checkbox"
                    checked={person.role === "admin" || person.permissions.includes(key)}
                    disabled={person.role === "admin"}
                    onChange={(event) => {
                      const permissions = event.target.checked
                        ? [...person.permissions, key]
                        : person.permissions.filter((item) => item !== key);
                      setPerson({ ...person, permissions });
                    }}
                  />
                  {t[PERMISSION_LABEL[key]]}
                </label>
              ))}
            </div>
            {person.role === "admin" ? null : (
              <label className="check">
                <input type="checkbox" checked={person.active} onChange={(event) => setPerson({ ...person, active: event.target.checked })} />
                {t.activeAccess}
              </label>
            )}
            <div className="span-2 detail-actions">
              <button className="btn" type="submit">{person.id ? t.save : t.addStaff}</button>
              {person.id ? <button className="btn ghost" type="button" onClick={() => { setPerson(emptyStaff()); setStaffError(""); }}>{t.cancel}</button> : null}
              {staffError ? <span className="red">{staffError}</span> : null}
            </div>
          </form>
          <div className="file-list">
            {staff.map((row) => (
              <article className="file-row" key={row.id}>
                <span>
                  <b>{row.name}</b>
                  <small>{row.role === "admin" ? t.adminRole : row.role === "accountant" ? t.accountantRole : t.customRole} · {row.code}</small>
                </span>
                <button className="icon-btn" type="button" aria-label={t.edit} onClick={() => { setPerson(row); setStaffError(""); }}><Pencil size={16} /></button>
                {row.role === "admin" ? null : (
                  <button className="icon-btn danger" type="button" aria-label={t.delete} onClick={async () => {
                    await deleteStaffAction(row.id);
                    if (person.id === row.id) setPerson(emptyStaff());
                    router.refresh();
                  }}><Trash2 size={16} /></button>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
