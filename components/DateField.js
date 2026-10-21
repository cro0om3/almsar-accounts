"use client";

import { useEffect, useState } from "react";
import { displayFromIso, isoFromDisplay } from "../lib/dates";
import { useI18n } from "./I18nProvider";

export default function DateField({ value, onChange, disabled = false }) {
  const { t } = useI18n();
  const iso = String(value || "").slice(0, 10);
  const [text, setText] = useState(displayFromIso(iso));

  useEffect(() => {
    setText(displayFromIso(iso));
  }, [iso]);

  function commit(raw) {
    const next = isoFromDisplay(raw);
    setText(next ? displayFromIso(next) : raw);
    if (next) onChange?.(next);
  }

  return (
    <span className={`date-field${disabled ? " locked" : ""}`}>
      <input
        type="text"
        inputMode="numeric"
        placeholder={t.datePlaceholder}
        autoComplete="off"
        value={text}
        disabled={disabled}
        readOnly={disabled}
        onChange={(event) => {
          if (disabled) return;
          const raw = event.target.value;
          setText(raw);
          const next = isoFromDisplay(raw);
          if (next) onChange?.(next);
        }}
        onBlur={() => { if (!disabled) commit(text); }}
      />
      {disabled ? null : (
        <input
          className="date-field-picker"
          type="date"
          lang="en-GB"
          value={/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : ""}
          onChange={(event) => onChange?.(event.target.value)}
          tabIndex={-1}
          aria-label={t.datePlaceholder}
        />
      )}
    </span>
  );
}
