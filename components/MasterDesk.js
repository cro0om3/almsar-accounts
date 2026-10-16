"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { deleteMasterAction, saveMasterAction } from "../app/actions";
import { useI18n } from "./I18nProvider";

export default function MasterDesk({ kind, titleKey, rows, fields, labelKey }) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(rows[0]?.id || "");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter((row) => fields.some((field) => String(row[field.key] || "").toLowerCase().includes(text)));
  }, [rows, query, fields]);

  const current = draft || visible.find((row) => row.id === selectedId) || visible[0] || null;

  function blank() {
    const next = { id: "" };
    fields.forEach((field) => {
      next[field.key] = "";
    });
    setDraft(next);
    setSelectedId("");
  }

  function choose(row) {
    setDraft(null);
    setSelectedId(row.id);
  }

  function update(key, value) {
    setDraft({ ...(current || {}), [key]: value });
  }

  async function save(event) {
    event.preventDefault();
    if (!current || !String(current[fields[0].key] || "").trim()) return;
    setSaving(true);
    const id = await saveMasterAction(kind, current);
    setDraft(null);
    setSelectedId(id);
    setSaving(false);
    router.refresh();
  }

  async function remove() {
    if (!current?.id || !window.confirm(t.delete)) return;
    await deleteMasterAction(kind, current.id);
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
            {visible.length === 0 ? <p className="desk-empty">{t.noRecords}</p> : visible.map((row) => (
              <button key={row.id} type="button" className={row.id === current?.id && !draft ? "doc-row on" : "doc-row"} onClick={() => choose(row)}>
                <b>{row[labelKey] || "—"}</b>
                <small>{row[fields[1]?.key] || ""}</small>
              </button>
            ))}
          </div>
        </aside>
        <section className="desk-detail">
          {!current ? (
            <div className="desk-blank"><h2>{t.noRecords}</h2></div>
          ) : (
            <form className="panel master-form" onSubmit={save}>
              <h2>{current[labelKey] || t.newRecord}</h2>
              <div className="master-grid">
                {fields.map((field) => (
                  <label key={field.key}>{t[field.label] || field.label}
                    {field.long ? (
                      <textarea value={current[field.key] || ""} onChange={(event) => update(field.key, event.target.value)} />
                    ) : (
                      <input type={field.number ? "number" : "text"} value={current[field.key] || ""} onChange={(event) => update(field.key, event.target.value)} />
                    )}
                  </label>
                ))}
              </div>
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
