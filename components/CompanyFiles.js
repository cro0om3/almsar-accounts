"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2 } from "lucide-react";
import { deleteCompanyFileAction, saveCompanyFileAction } from "../app/actions";
import { flashSaved } from "./SavedToast";
import { useI18n } from "./I18nProvider";

export default function CompanyFiles({ files, heading = false }) {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState("");
  const labels = { license: t.fileLicense, papers: t.filePapers, other: t.fileOther };

  return (
    <div>
      {heading ? <h2>{t.files}</h2> : null}
      <p className="lead">{t.filesLead}</p>
      <form className="master-grid" onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const result = await saveCompanyFileAction(new FormData(event.currentTarget));
        if (result?.error) {
          setError(result.error === "type" ? t.receiptHint : t.fileRequired);
          return;
        }
        event.currentTarget.reset();
        flashSaved();
        router.refresh();
      }}>
        <label>{t.fileTitle}<input name="title" required /></label>
        <label>{t.category}
          <select name="category" defaultValue="license">
            <option value="license">{t.fileLicense}</option>
            <option value="papers">{t.filePapers}</option>
            <option value="other">{t.fileOther}</option>
          </select>
        </label>
        <label className="span-2">{t.uploadFile}
          <input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
        </label>
        <label className="span-2">{t.notes}<textarea name="notes" /></label>
        <div className="span-2">
          <button className="btn" type="submit">{t.uploadFile}</button>
          {error ? <span className="red"> {error}</span> : null}
        </div>
      </form>
      <div className="file-list">
        {files.length === 0 ? <p>{t.noFiles}</p> : files.map((file) => (
          <article className="file-row" key={file.id}>
            <FileText size={18} />
            <span>
              <b>{file.title}</b>
              <small>{labels[file.category] || labels.other} · {String(file.createdAt || "").slice(0, 10)}</small>
            </span>
            <a href={`/api/company-files/${file.storedName}`} target="_blank" rel="noreferrer">{t.download}</a>
            <button className="icon-btn danger" type="button" aria-label={t.delete} onClick={async () => {
              await deleteCompanyFileAction(file.id);
              router.refresh();
            }}><Trash2 size={16} /></button>
          </article>
        ))}
      </div>
    </div>
  );
}
