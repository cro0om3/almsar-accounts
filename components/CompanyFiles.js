"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteCompanyFileAction, saveCompanyFileAction, updateCompanyFileAction } from "../app/actions";
import { flashSaved } from "./SavedToast";
import { useI18n } from "./I18nProvider";

const emptyForm = { id: "", title: "", category: "other", notes: "" };

export default function CompanyFiles({ files, heading = false }) {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(null);
  const labels = { license: t.fileLicense, papers: t.filePapers, other: t.fileOther };

  function openNew() {
    setError("");
    setEditor({ ...emptyForm });
  }

  function openEdit(file) {
    setError("");
    setEditor({
      id: file.id,
      title: file.title || "",
      category: file.category || "other",
      notes: file.notes || "",
    });
  }

  async function save(event) {
    event.preventDefault();
    setError("");
    const body = new FormData(event.currentTarget);
    const result = editor.id
      ? await updateCompanyFileAction(body)
      : await saveCompanyFileAction(body);
    if (result?.error) {
      setError(result.error === "type" ? t.receiptHint : t.fileRequired);
      return;
    }
    setEditor(null);
    flashSaved();
    router.refresh();
  }

  return (
    <div className="files-page">
      {heading ? (
        <header className="files-head">
          <h1>{t.files}</h1>
          <p>{t.filesLead}</p>
        </header>
      ) : <p className="lead">{t.filesLead}</p>}
      <button className="btn files-add" type="button" onClick={openNew}>
        <Plus size={18} /> {t.addFile}
      </button>
      {editor ? (
        <form className="files-form" onSubmit={save}>
          {editor.id ? <input type="hidden" name="id" value={editor.id} /> : null}
          <label>{t.fileTitle}<input name="title" value={editor.title} required onChange={(event) => setEditor({ ...editor, title: event.target.value })} /></label>
          <label>{t.category}
            <select name="category" value={editor.category} onChange={(event) => setEditor({ ...editor, category: event.target.value })}>
              <option value="license">{t.fileLicense}</option>
              <option value="papers">{t.filePapers}</option>
              <option value="other">{t.fileOther}</option>
            </select>
          </label>
          {editor.id ? null : (
            <label className="span-2">{t.uploadFile}
              <input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
            </label>
          )}
          <label className="span-2">{t.notes}
            <textarea name="notes" value={editor.notes} onChange={(event) => setEditor({ ...editor, notes: event.target.value })} />
          </label>
          <div className="files-form-actions span-2">
            <button className="btn" type="submit">{t.save}</button>
            <button className="btn ghost" type="button" onClick={() => setEditor(null)}>{t.cancel}</button>
            {error ? <span className="red">{error}</span> : null}
          </div>
        </form>
      ) : null}
      <div className="files-card">
        {files.length === 0 ? <p className="files-empty">{t.noFiles}</p> : files.map((file) => {
          const note = String(file.notes || "").trim();
          const meta = [labels[file.category] || labels.other, String(file.createdAt || "").slice(0, 10), note].filter(Boolean).join(" · ");
          return (
            <article className="file-row" key={file.id}>
              <span className="file-mark"><FileText size={18} /></span>
              <span className="file-copy">
                <b>{file.title}</b>
                <small>{meta}</small>
              </span>
              <span className="file-actions">
                <button className="icon-btn" type="button" aria-label={t.edit} onClick={() => openEdit(file)}><Pencil size={16} /></button>
                <a className="icon-btn" href={`/api/company-files/${file.storedName}`} target="_blank" rel="noreferrer" aria-label={t.download}><Download size={16} /></a>
                <button className="icon-btn danger" type="button" aria-label={t.delete} onClick={async () => {
                  await deleteCompanyFileAction(file.id);
                  router.refresh();
                }}><Trash2 size={16} /></button>
              </span>
            </article>
          );
        })}
      </div>
    </div>
  );
}
