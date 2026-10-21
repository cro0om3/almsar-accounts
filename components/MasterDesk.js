"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ScanLine, Search } from "lucide-react";
import { deleteMasterAction, saveEmployeeAction, saveMasterAction, saveVehicleAction } from "../app/actions";
import FilePick from "./FilePick";
import { flashSaved } from "./SavedToast";
import { useI18n } from "./I18nProvider";

function emptyUploads() {
  return {};
}

export default function MasterDesk({ kind, titleKey, rows, fields, labelKey, initialId = "" }) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(initialId || rows[0]?.id || "");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState("");
  const [reading, setReading] = useState(false);
  const [uploads, setUploads] = useState(emptyUploads);
  const fileRefs = useRef({});
  const scanRef = useRef(null);
  const readGen = useRef(0);
  const currentRef = useRef(null);
  const fileFields = fields.filter((field) => field.file);

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter((row) => fields.some((field) => String(row[field.key] || "").toLowerCase().includes(text)));
  }, [rows, query, fields]);

  const current = draft || visible.find((row) => row.id === selectedId) || visible[0] || null;
  currentRef.current = current;

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

  function slotOf(key) {
    return uploads[key] || { file: null, preview: "", cleared: false };
  }

  function setSlot(key, next) {
    setUploads((prev) => {
      if (prev[key]?.preview && prev[key].preview !== next.preview) URL.revokeObjectURL(prev[key].preview);
      return { ...prev, [key]: next };
    });
  }

  function resetUploads() {
    setUploads((prev) => {
      for (const slot of Object.values(prev)) {
        if (slot.preview) URL.revokeObjectURL(slot.preview);
      }
      return emptyUploads();
    });
    Object.values(fileRefs.current).forEach((el) => {
      if (el) el.value = "";
    });
  }

  function fileSrc(field) {
    const slot = slotOf(field.key);
    if (slot.preview) return slot.preview;
    if (!slot.cleared && current?.[field.key]) return `/api/${field.folder || "ownership"}/${current[field.key]}`;
    return "";
  }

  function blank() {
    const next = { id: "" };
    fields.forEach((field) => {
      next[field.key] = "";
    });
    readGen.current += 1;
    setNotice("");
    setNoticeKind("");
    setDraft(next);
    setSelectedId("");
    resetUploads();
  }

  function choose(row) {
    readGen.current += 1;
    setDraft(null);
    setNotice("");
    setNoticeKind("");
    resetUploads();
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

  async function readIdPhoto(file) {
    if (!file) return;
    const gen = ++readGen.current;
    setSlot("idPath", { file, preview: "", cleared: false });
    setReading(true);
    setNoticeKind("busy");
    setNotice(t.readingId);
    try {
      const { readEmiratesIdPhoto } = await import("../lib/read-employee-doc");
      const info = await readEmiratesIdPhoto(file);
      if (gen !== readGen.current) return;
      if (!info) {
        setNoticeKind("err");
        setNotice(t.idReadFailed);
        return;
      }
      const base = currentRef.current || {};
      setDraft({
        ...base,
        name: info.name || base.name,
        employeeId: info.employeeId || base.employeeId,
        idExpiry: info.idExpiry || base.idExpiry,
      });
      setNoticeKind("ok");
      setNotice(t.idReadOk);
    } catch {
      if (gen !== readGen.current) return;
      setNoticeKind("err");
      setNotice(t.idReadFailed);
    } finally {
      if (gen === readGen.current) setReading(false);
    }
  }

  function appendFileFields(body) {
    for (const field of fileFields) {
      const slot = slotOf(field.key);
      body.set(field.key, slot.cleared ? "" : (current[field.key] || ""));
      if (slot.cleared) body.set(`clear_${field.key}`, "1");
      if (slot.file) body.set(`file_${field.key}`, slot.file);
    }
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
        const photo = slotOf("ownershipPath");
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
      } else if (kind === "employees" && fileFields.length) {
        const body = new FormData();
        body.set("id", current.id || "");
        for (const field of fields) {
          if (field.file) continue;
          body.set(field.key, current[field.key] ?? "");
        }
        appendFileFields(body);
        const result = await saveEmployeeAction(body);
        if (result?.error) throw new Error(result.error);
        id = result;
      } else {
        const result = await saveMasterAction(kind, payload());
        if (result?.error) throw new Error(result.error);
        id = result;
      }
      setDraft(null);
      resetUploads();
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
    resetUploads();
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
              <div className="master-form-top">
                <h2>{(kind === "customers" ? (current.company || current.name) : current[labelKey]) || t.newRecord}</h2>
                {kind === "employees" ? (
                  <button className="btn ghost scan-id" type="button" disabled={reading} onClick={() => scanRef.current?.click()}>
                    <ScanLine size={16} /> {t.scanId}
                  </button>
                ) : null}
              </div>
              {kind === "employees" ? (
                <input
                  ref={scanRef}
                  className="sr-only"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    event.target.value = "";
                    void readIdPhoto(file);
                  }}
                />
              ) : null}
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
                {fileFields.length > 1 ? <div className="file-picks-title span-2">{t.employeeDocuments}</div> : null}
                {fileFields.length > 1 ? (
                  <div className="file-picks span-2">
                    {fileFields.map((field) => (
                      <FilePick
                        key={field.key}
                        label={t[field.label] || field.label}
                        file={slotOf(field.key).file}
                        preview={fileSrc(field)}
                        storedName={current[field.key]}
                        inputRef={(el) => { fileRefs.current[field.key] = el; }}
                        onChange={(file) => setSlot(field.key, { file, preview: "", cleared: false })}
                        onClear={() => setSlot(field.key, { file: null, preview: "", cleared: true })}
                      />
                    ))}
                  </div>
                ) : fileFields.map((field) => (
                  <FilePick
                    key={field.key}
                    label={t[field.label] || field.label}
                    file={slotOf(field.key).file}
                    preview={fileSrc(field)}
                    storedName={current[field.key]}
                    inputRef={(el) => { fileRefs.current[field.key] = el; }}
                    onChange={(file) => setSlot(field.key, { file, preview: "", cleared: false })}
                    onClear={() => setSlot(field.key, { file: null, preview: "", cleared: true })}
                  />
                ))}
              </div>
              {notice ? <div className={noticeKind === "ok" ? "notice-ok" : noticeKind === "busy" ? "notice-busy" : "errors"}>{notice}</div> : null}
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
