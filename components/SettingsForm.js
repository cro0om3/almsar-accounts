"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveBrandingAction, saveSettingsAction } from "../app/actions";
import { flashSaved } from "./SavedToast";
import AccessPanel from "./AccessPanel";
import CompanyFiles from "./CompanyFiles";
import FilePick from "./FilePick";
import { useI18n } from "./I18nProvider";

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
    quoteTerms: settings.quoteTerms || "",
    invoiceTerms: settings.invoiceTerms || "",
  });
  const [saved, setSaved] = useState(false);
  const [brandPick, setBrandPick] = useState({});
  const stamp = settings.updatedAt || "0";

  function update(key, value) {
    setSaved(false);
    setForm({ ...form, [key]: value });
  }

  async function saveForm(event) {
    event.preventDefault();
    await saveSettingsAction(form);
    setSaved(true);
    flashSaved();
    router.refresh();
  }

  const tabs = [
    ["company", t.tabCompany],
    ["terms", t.tabTerms],
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
        <form className="panel master-form" style={{ margin: 22 }} onSubmit={saveForm}>
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
          </div>
          <div className="detail-actions">
            <button className="btn" type="submit">{t.save}</button>
            {saved ? <span className="green">{t.saved}</span> : null}
          </div>
        </form>
      ) : null}

      {tab === "terms" ? (
        <form className="panel master-form" style={{ margin: 22 }} onSubmit={saveForm}>
          <p className="lead">{t.termsHint}</p>
          <div className="terms-grid">
            <label>{t.quoteTerms}
              <textarea className="terms-edit" dir="ltr" rows={18} value={form.quoteTerms} onChange={(event) => update("quoteTerms", event.target.value)} />
            </label>
            <label>{t.invoiceTerms}
              <textarea className="terms-edit" dir="ltr" rows={18} value={form.invoiceTerms} onChange={(event) => update("invoiceTerms", event.target.value)} />
            </label>
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

      {tab === "access" ? <AccessPanel staff={staff} /> : null}
    </div>
  );
}
