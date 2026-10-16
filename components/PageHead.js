"use client";

import { useI18n } from "./I18nProvider";

export default function PageHead({ title, children }) {
  const { t } = useI18n();
  return (
    <div className="page-head">
      <h1>{t[title] || title}</h1>
      {children}
    </div>
  );
}
