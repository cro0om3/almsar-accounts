"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, Paperclip, X } from "lucide-react";
import { useI18n } from "./I18nProvider";

const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

function isPdf(file, stored) {
  if (file) return file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
  return /\.pdf$/i.test(stored || "");
}

function isDocx(file, stored) {
  if (file) return /wordprocessingml/.test(file.type || "") || /\.docx$/i.test(file.name || "");
  return /\.docx$/i.test(stored || "");
}

function caption(file, storedName, has, t) {
  if (file?.name) return file.name;
  if (!has) return t.chooseFile;
  if (/\.pdf$/i.test(storedName || "")) return "PDF";
  if (/\.docx$/i.test(storedName || "")) return "Word";
  return t.attached;
}

function downloadUrl(src) {
  if (!src || src.startsWith("blob:") || src.startsWith("data:")) return src;
  return `${src}${src.includes("?") ? "&" : "?"}download=1`;
}

export default function FilePick({
  label,
  name,
  accept = DEFAULT_ACCEPT,
  required = false,
  file = null,
  preview = "",
  storedName = "",
  onChange,
  onClear,
  inputRef,
  allowClear = true,
  disabled = false,
}) {
  const { t } = useI18n();
  const innerRef = useRef(null);
  const [blobUrl, setBlobUrl] = useState("");
  const has = Boolean(file || preview);
  const pdf = isPdf(file, storedName);
  const docx = isDocx(file, storedName);
  const src = blobUrl || preview;
  const showImage = Boolean(src) && !pdf && !docx;
  const saveAs = file?.name || storedName || "file";

  useEffect(() => {
    if (!file) {
      setBlobUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function bindRef(el) {
    innerRef.current = el;
    if (typeof inputRef === "function") inputRef(el);
    else if (inputRef) inputRef.current = el;
  }

  function stop(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function clear(event) {
    stop(event);
    if (innerRef.current) innerRef.current.value = "";
    onClear?.();
  }

  return (
    <label className={`file-pick${has ? " has" : ""}${disabled ? " locked" : ""}`}>
      {label ? <span className="file-pick-label">{label}</span> : null}
      <span className="file-pick-row" title={t.receiptHint}>
        {src ? (
          <a className="file-pick-open" href={src} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
            {showImage ? <img className="file-pick-thumb" src={src} alt="" /> : <span className="file-pick-icon"><FileText size={15} /></span>}
          </a>
        ) : (
          <span className="file-pick-icon"><Paperclip size={15} /></span>
        )}
        <span className="file-pick-name">{caption(file, storedName, has, t)}</span>
        {src ? (
          <a
            className="file-pick-dl"
            href={downloadUrl(src)}
            download={saveAs}
            aria-label={t.download}
            title={t.download}
            onClick={(event) => event.stopPropagation()}
          >
            <Download size={14} />
          </a>
        ) : null}
        {has && allowClear && !disabled ? (
          <button className="file-pick-x" type="button" aria-label={t.removePhoto} onClick={clear}>
            <X size={14} />
          </button>
        ) : null}
        {disabled ? null : (
          <input
            ref={bindRef}
            className="file-pick-input"
            type="file"
            name={name}
            accept={accept}
            required={required && !has}
            onChange={(event) => onChange?.(event.target.files?.[0] || null)}
          />
        )}
      </span>
    </label>
  );
}
