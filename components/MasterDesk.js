"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImagePlus, Plus, Search, X } from "lucide-react";
import { deleteMasterAction, saveMasterAction, saveVehicleAction } from "../app/actions";
import { flashSaved } from "./SavedToast";
import { useI18n } from "./I18nProvider";

export default function MasterDesk({ kind, titleKey, rows, fields, labelKey, initialId = "" }) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(initialId || rows[0]?.id || "");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [photo, setPhoto] = useState({ file: null, preview: "", cleared: false });
  const fileRef = useRef(null);

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter((row) => fields.some((field) => String(row[field.key] || "").toLowerCase().includes(text)));
  }, [rows, query, fields]);

  const current = draft || visible.find((row) => row.id === selectedId) || visible[0] || null;

  function rowLines(row) {
    if (kind === "vehicles") {
      return { primary: row.vehicleType || "—", secondary: row.vehicleNumber || "" };
    }
    if (kind === "customers") {
      const company = String(row.company || "").trim();
      const contact = String(row.name || "").trim();
      return {
        primary: company || contact || "—",
        secondary: company && contact && company !== contact ? contact : "",
      };
    }
    const subtitle = fields.find((field) => field.key !== labelKey && !field.file && !field.date && !field.long);
    return { primary: row[labelKey] || "—", secondary: subtitle ? (row[subtitle.key] || "") : "" };
  }

  function blank() {
    const next = { id: "" };
    fields.forEach((field) => {
      next[field.key] = "";
    });
    setDraft(next);
    setSelectedId("");
    setPhoto({ file: null, preview: "", cleared: false });
    if (fileRef.current) fileRef.current.value = "";
  }

  function choose(row) {
    setDraft(null);
    setNotice("");
    setPhoto({ file: null, preview: "", cleared: false });
    if (fileRef.current) fileRef.current.value = "";
    setSelectedId(row.id);
    requestAnimationFrame(() => {
      document.getElementById(`master-card-${row.id}`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    });
  }

  function update(key, value) {
    setDraft({ ...(current || {}), [key]: value });
  }

  function payload() {
    const next = { ...(current || {}) };
    for (const field of fields) {
      if (!field.number) continue;
      const raw = next[field.key];
      next[field.key] = raw === "" || raw == null ? null : Number(raw);
    }
    return next;
  }

  async function save(event) {
    event.preventDefault();
    const requiredKey = labelKey || fields[0].key;
    if (!current || !String(current[requiredKey] || "").trim()) return;
    setSaving(true);
    setNotice("");
    try {
      let id = current.id;
      if (kind === "vehicles") {
        const body = new FormData();
        body.set("id", current.id || "");
        for (const field of fields) {
          if (field.file) continue;
          body.set(field.key, current[field.key] || "");
        }
        body.set("ownershipPath", photo.cleared ? "" : (current.ownershipPath || ""));
        if (photo.cleared) body.set("clearOwnership", "1");
        if (photo.file) body.set("ownership", photo.file);
        id = await saveVehicleAction(body);
      } else {
        const result = await saveMasterAction(kind, payload());
        if (result?.error) throw new Error(result.error);
        id = result;
      }
      setDraft(null);
      setPhoto({ file: null, preview: "", cleared: false });
      setSelectedId(id);
      flashSaved();
      router.refresh();
    } catch (error) {
      setNotice(error?.message && !/server components|digest/i.test(error.message) ? error.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!current?.id || !window.confirm(t.delete)) return;
    const result = await deleteMasterAction(kind, current.id);
    if (result?.error === "inUse") {
      setNotice(t.inUse);
      return;
    }
    setNotice("");
    setDraft(null);
    setSelectedId("");
    router.refresh();
  }

  return (
    <div className="desk-page">
      <header className="desk-head">
        <h1>{t[titleKey]}</h1>
        <p>{t.masters}</p>
      </header>
      <div className="desk">
        <aside className="desk-list">
          <div className="desk-list-head">
            <span>{t[titleKey]} ({visible.length})</span>
            <button className="btn tiny" type="button" onClick={blank}><Plus size={14} /> {t.newRecord}</button>
          </div>
          <label className="search" style={{ margin: "0 12px 8px" }}>
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} />
          </label>
          <div className="desk-scroll">
            {visible.length === 0 ? <p className="desk-empty">{t.noRecords}</p> : visible.map((row) => {
              const lines = rowLines(row);
              return (
                <button id={`master-card-${row.id}`} key={row.id} type="button" className={row.id === current?.id && !draft ? "doc-row on" : "doc-row"} onClick={() => choose(row)}>
                  <b>{lines.primary}</b>
                  <small>{lines.secondary}</small>
                </button>
              );
            })}
          </div>
        </aside>
        <section className="desk-detail">
          {!current ? (
            <div className="desk-blank"><h2>{t.noRecords}</h2></div>
          ) : (
            <form className="panel master-form" onSubmit={save}>
              <h2>{(kind === "customers" ? (current.company || current.name) : current[labelKey]) || t.newRecord}</h2>
              <div className="master-grid">
                {fields.filter((field) => !field.file).map((field) => (
                  <label key={field.key} className={field.long ? "span-2" : undefined}>{t[field.label] || field.label}
                    {field.long ? (
                      <textarea value={current[field.key] || ""} onChange={(event) => update(field.key, event.target.value)} />
                    ) : field.options ? (
                      <select value={current[field.key] || ""} onChange={(event) => update(field.key, event.target.value)}>
                        <option value="">—</option>
                        {field.options.map((value) => <option key={value} value={value}>{t[`kind_${value}`] || value}</option>)}
                      </select>
                    ) : (
                      <input type={field.date ? "date" : field.number ? "number" : "text"} value={field.date ? String(current[field.key] ?? "").slice(0, 10) : (current[field.key] ?? "")} onChange={(event) => update(field.key, event.target.value)} />
                    )}
                  </label>
                ))}
              </div>
              {fields.some((field) => field.file) ? (
                <label className="receipt-wrap">{t.ownershipPhoto}
                  <span className="receipt-box">
                    <ImagePlus size={18} />
                    <span>{photo.file ? photo.file.name : t.receiptHint}</span>
                    <input ref={fileRef} className="receipt-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setPhoto({ file, preview: file ? URL.createObjectURL(file) : "", cleared: false });
                    }} />
                  </span>
                </label>
              ) : null}
              {fields.some((field) => field.file) && (photo.preview || photo.file || (!photo.cleared && current.ownershipPath)) ? (
                <div className="receipt-chosen">
                  {(photo.file?.type === "application/pdf" || /\.pdf$/i.test(photo.file?.name || "") || (!photo.file && /\.pdf$/i.test(current.ownershipPath || ""))) ? (
                    <a className="pdf-chip" href={photo.preview || `/api/ownership/${current.ownershipPath}`} target="_blank" rel="noreferrer"><FileText size={16} /> PDF</a>
                  ) : (
                    <img className="receipt-preview" src={photo.preview || `/api/ownership/${current.ownershipPath}`} alt="" />
                  )}
                  <button className="btn ghost" type="button" onClick={() => {
                    if (fileRef.current) fileRef.current.value = "";
                    setPhoto({ file: null, preview: "", cleared: true });
                  }}>
                    <X size={16} /> {t.removePhoto}
                  </button>
                </div>
              ) : null}
              {notice ? <div className="errors">{notice}</div> : null}
              <div className="detail-actions">
                <button className="btn" type="submit" disabled={saving}>{t.save}</button>
                {current.id ? <button className="btn danger" type="button" onClick={remove}>{t.delete}</button> : null}
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
