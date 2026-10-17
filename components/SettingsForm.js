"use client";

import { useState } from "react";
import { saveSettingsAction } from "../app/actions";
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

export default function SettingsForm({ settings }) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    companyName: settings.companyName || "",
    address: settings.address || "",
    vatNumber: settings.vatNumber || "",
    footerContactEnglish: settings.footerContactEnglish || "",
    footerAddressEnglish: settings.footerAddressEnglish || "",
    currency: settings.currency || "AED",
    defaultTerms: plainTerms(settings.defaultTerms),
  });
  const [saved, setSaved] = useState(false);

  function update(key, value) {
    setSaved(false);
    setForm({ ...form, [key]: value });
  }

  return (
    <div className="desk-page">
      <header className="desk-head">
        <h1>{t.settings}</h1>
        <p>{t.brand}</p>
      </header>
      <form className="panel master-form" style={{ margin: 22 }} onSubmit={async (event) => { event.preventDefault(); await saveSettingsAction(form); setSaved(true); }}>
        <div className="master-grid">
          <label>{t.companyName}<input value={form.companyName} onChange={(event) => update("companyName", event.target.value)} /></label>
          <label>{t.vatNumber}<input value={form.vatNumber} onChange={(event) => update("vatNumber", event.target.value)} /></label>
          <label>{t.phone}<input value={form.footerContactEnglish} onChange={(event) => update("footerContactEnglish", event.target.value)} /></label>
          <label>{t.footerAddress}<input value={form.footerAddressEnglish} onChange={(event) => update("footerAddressEnglish", event.target.value)} /></label>
          <label>{t.address}<textarea value={form.address} onChange={(event) => update("address", event.target.value)} /></label>
          <label>{t.defaultTerms}<textarea value={form.defaultTerms} onChange={(event) => update("defaultTerms", event.target.value)} /></label>
        </div>
        <button className="btn" type="submit">{t.save}</button>
        {saved ? <span className="green"> {t.saved}</span> : null}
      </form>
    </div>
  );
}
