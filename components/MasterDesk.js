"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Save, ScanLine, Search, Trash2, X } from "lucide-react";
import { deleteMasterAction, saveEmployeeAction, saveMasterAction, saveVehicleAction } from "../app/actions";
import { daysUntil } from "../lib/dates";
import { uploadOriginalFile } from "../lib/upload-file";
import DateField from "./DateField";
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
  const [editing, setEditing] = useState(false);
  const [uploads, setUploads] = useState(emptyUploads);
  const canEdit = kind !== "vehicles" || editing;
  const fileRefs = useRef({});
  const scanRef = useRef(null);
  const scanSide = useRef("front");
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
      let days = null;
      try {
        const next = daysUntil(row.ownershipExpiry || row.registrationExpiry);
        if (Number.isFinite(next)) days = next;
      } catch {
        days = null;
      }
      return { primary: row.vehicleType || "—", secondary: row.vehicleNumber || "", days };
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
    setEditing(true);
    resetUploads();
  }

  function choose(row) {
    readGen.current += 1;
    setDraft(null);
    setNotice("");
    setNoticeKind("");
    setEditing(false);
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

  async function readOwnership(fileList, slotKey) {
    const files = Array.from(fileList || []).slice(0, 2);
    if (!files.length) return;
    const gen = ++readGen.current;
    if (slotKey && files[0]) setSlot(slotKey, { file: files[0], preview: "", cleared: false });
    setReading(true);
    setNoticeKind("busy");
    setNotice(t.readingOwnership);
    try {
      const { readVehicleOwnership } = await import("../lib/read-employee-doc");
      const info = await readVehicleOwnership(files);
      if (gen !== readGen.current) return;
      if (!info) {
        setNoticeKind("err");
        setNotice(t.ownershipReadFailed);
        return;
      }
      const base = currentRef.current || {};
      const next = { ...base };
      const front = slotKey !== "ownershipBackPath";
      const back = slotKey !== "ownershipPath";
      if (front) {
        if (info.vehicleNumber) next.vehicleNumber = info.vehicleNumber;
        if (info.category) next.category = info.category;
        if (info.ownershipExpiry) next.ownershipExpiry = info.ownershipExpiry;
        if (info.insuranceExpiry) next.insuranceExpiry = info.insuranceExpiry;
      }
      if (back) {
        if (info.vehicleType) next.vehicleType = info.vehicleType;
        if (info.year) next.year = info.year;
        if (info.chassisNumber) next.chassisNumber = info.chassisNumber;
      }
      setDraft(next);
      setNoticeKind("ok");
      setNotice(t.ownershipReadOk);
    } catch {
      if (gen !== readGen.current) return;
      setNoticeKind("err");
      setNotice(t.ownershipReadFailed);
    } finally {
      if (gen === readGen.current) setReading(false);
    }
  }

  async function appendFileFields(body) {
    for (const field of fileFields) {
      const slot = slotOf(field.key);
      body.set(field.key, slot.cleared ? "" : (current[field.key] || ""));
      if (slot.cleared) body.set(`clear_${field.key}`, "1");
      if (slot.file) body.set(field.key, await uploadOriginalFile(field.folder, slot.file));
    }
  }

  function startEdit() {
    setEditing(true);
    setNotice("");
    setNoticeKind("");
  }

  function cancelEdit() {
    setDraft(null);
    resetUploads();
    setEditing(false);
    setNotice("");
    setNoticeKind("");
  }

  async function save(event) {
    event.preventDefault();
    if (kind === "vehicles" && !editing) return;
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
        await appendFileFields(body);
        const result = await saveVehicleAction(body);
        if (result?.error) throw new Error(result.error === "duplicateChassis" ? t.duplicateChassis : result.error === "duplicateVehicle" ? t.duplicateVehicle : result.error);
        id = result;
      } else if (kind === "employees" && fileFields.length) {
        const body = new FormData();
        body.set("id", current.id || "");
        for (const field of fields) {
          if (field.file) continue;
          body.set(field.key, current[field.key] ?? "");
        }
        await appendFileFields(body);
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
      setEditing(false);
      flashSaved();
      router.refresh();
    } catch (error) {
      setNoticeKind("err");
      const raw = String(error?.message || "");
      setNotice(
        raw === "duplicateChassis" ? t.duplicateChassis
          : raw === "duplicateVehicle" ? t.duplicateVehicle
            : raw === "fileTooLarge" ? t.fileTooLarge
              : /unexpected response|failed to fetch|network|load failed/i.test(raw) ? t.saveFailedNetwork
                : raw && !/server components|digest/i.test(raw) ? raw
                  : t.saveFailed
      );
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
    setEditing(false);
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
              const dueClass = lines.days == null ? "" : lines.days < 0 ? "late" : lines.days <= 7 ? "late" : lines.days <= 30 ? "soon" : "ok";
              return (
                <button id={`master-card-${row.id}`} key={row.id} type="button" className={row.id === current?.id && !draft ? "doc-row on" : "doc-row"} onClick={() => choose(row)}>
                  <b>{lines.primary}</b>
                  <small>{lines.secondary}</small>
                  {lines.days != null ? (
                    <em className={`doc-days ${dueClass}`}>
                      {lines.days < 0 ? t.expiredShort : String(t.daysLeftShort).replace("{n}", String(lines.days))}
                    </em>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>
        <section className="desk-detail">
          {!current ? (
            <div className="desk-blank"><h2>{t.noRecords}</h2></div>
          ) : (
            <form className={`panel master-form${kind === "vehicles" && !canEdit ? " locked" : ""}`} onSubmit={save}>
              <div className="master-form-top">
                <h2>{(kind === "customers" ? (current.company || current.name) : current[labelKey]) || t.newRecord}</h2>
                {kind === "employees" ? (
                  <button className="btn ghost scan-id" type="button" disabled={reading} onClick={() => scanRef.current?.click()}>
                    {reading ? <Loader2 size={16} className="spin" /> : <ScanLine size={16} />}
                    {reading ? t.readingId : t.scanId}
                  </button>
                ) : null}
                {kind === "vehicles" ? (
                  <span className="scan-pair">
                    {canEdit ? (
                      <>
                        <button className="btn ghost scan-id" type="button" disabled={reading} onClick={() => { scanSide.current = "front"; scanRef.current?.click(); }}>
                          {reading && scanSide.current === "front" ? <Loader2 size={16} className="spin" /> : <ScanLine size={16} />}
                          {t.scanFront}
                        </button>
                        <button className="btn ghost scan-id" type="button" disabled={reading} onClick={() => { scanSide.current = "back"; scanRef.current?.click(); }}>
                          {reading && scanSide.current === "back" ? <Loader2 size={16} className="spin" /> : <ScanLine size={16} />}
                          {t.scanBack}
                        </button>
                        <button className="btn" type="submit" disabled={saving}><Save size={16} /> {t.save}</button>
                        {current.id ? <button className="btn ghost" type="button" onClick={cancelEdit}><X size={16} /> {t.cancel}</button> : null}
                      </>
                    ) : (
                      <button className="btn" type="button" onClick={startEdit}><Pencil size={16} /> {t.edit}</button>
                    )}
                    {current.id ? <button className="btn danger" type="button" onClick={remove}><Trash2 size={16} /> {t.delete}</button> : null}
                  </span>
                ) : null}
              </div>
              {kind === "employees" || kind === "vehicles" ? (
                <input
                  ref={scanRef}
                  className="sr-only"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    event.target.value = "";
                    if (kind === "vehicles") {
                      const slot = scanSide.current === "back" ? "ownershipBackPath" : "ownershipPath";
                      void readOwnership(files, slot);
                    } else {
                      void readIdPhoto(files[0] || null);
                    }
                  }}
                />
              ) : null}
              {notice ? <div className={noticeKind === "ok" ? "notice-ok" : noticeKind === "busy" ? "notice-busy" : "errors"}>{notice}</div> : null}
              <div className="master-grid">
                {fields.filter((field) => !field.file).map((field) => (
                  <label key={field.key} className={field.long ? "span-2" : undefined}>{t[field.label] || field.label}
                    {field.long ? (
                      <textarea value={current[field.key] || ""} disabled={!canEdit} readOnly={!canEdit} onChange={(event) => update(field.key, event.target.value)} />
                    ) : field.options ? (
                      <select value={current[field.key] || ""} disabled={!canEdit} onChange={(event) => update(field.key, event.target.value)}>
                        <option value="">—</option>
                        {field.options.map((value) => <option key={value} value={value}>{t[`kind_${value}`] || value}</option>)}
                      </select>
                    ) : (
                      field.date ? (
                        <DateField value={current[field.key]} disabled={!canEdit} onChange={(next) => update(field.key, next)} />
                      ) : (
                        <input type={field.number ? "number" : "text"} value={current[field.key] ?? ""} disabled={!canEdit} readOnly={!canEdit} onChange={(event) => update(field.key, event.target.value)} />
                      )
                    )}
                  </label>
                ))}
                {fileFields.length > 1 ? <div className="file-picks-title span-2">{kind === "vehicles" ? t.ownershipDocuments : t.employeeDocuments}</div> : null}
                {fileFields.length > 1 ? (
                  <div className="file-picks span-2">
                    {fileFields.map((field) => (
                      <FilePick
                        key={field.key}
                        label={t[field.label] || field.label}
                        accept="image/*,application/pdf,.heic,.heif"
                        file={slotOf(field.key).file}
                        preview={fileSrc(field)}
                        storedName={current[field.key]}
                        inputRef={(el) => { fileRefs.current[field.key] = el; }}
                        disabled={!canEdit}
                        onChange={(file) => {
                          if (kind === "vehicles" && (field.key === "ownershipPath" || field.key === "ownershipBackPath") && file) void readOwnership([file], field.key);
                          else if (kind === "employees" && field.key === "idPath" && file) void readIdPhoto(file);
                          else setSlot(field.key, { file, preview: "", cleared: false });
                        }}
                        onClear={() => setSlot(field.key, { file: null, preview: "", cleared: true })}
                      />
                    ))}
                  </div>
                ) : fileFields.map((field) => (
                  <FilePick
                    key={field.key}
                    label={t[field.label] || field.label}
                    accept="image/*,application/pdf,.heic,.heif"
                    file={slotOf(field.key).file}
                    preview={fileSrc(field)}
                    storedName={current[field.key]}
                    inputRef={(el) => { fileRefs.current[field.key] = el; }}
                    disabled={!canEdit}
                    onChange={(file) => {
                      if (kind === "vehicles" && (field.key === "ownershipPath" || field.key === "ownershipBackPath") && file) void readOwnership([file], field.key);
                      else if (kind === "employees" && field.key === "idPath" && file) void readIdPhoto(file);
                      else setSlot(field.key, { file, preview: "", cleared: false });
                    }}
                    onClear={() => setSlot(field.key, { file: null, preview: "", cleared: true })}
                  />
                ))}
              </div>
              {kind === "vehicles" ? null : (
                <div className="detail-actions">
                  <button className="btn" type="submit" disabled={saving}><Save size={16} /> {t.save}</button>
                  {current.id ? <button className="btn danger" type="button" onClick={remove}><Trash2 size={16} /> {t.delete}</button> : null}
                </div>
              )}
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
