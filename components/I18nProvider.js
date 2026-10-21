"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { dictionary } from "../lib/i18n";

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    const saved = localStorage.getItem("accounts-lang");
    if (saved === "ar" || saved === "en") setLang(saved);
  }, []);

  useEffect(() => {
    const pack = dictionary[lang];
    document.documentElement.lang = lang === "ar" ? "ar-AE" : "en-GB";
    document.documentElement.dir = pack.dir;
    localStorage.setItem("accounts-lang", lang);
  }, [lang]);

  const value = {
    lang,
    t: dictionary[lang],
    toggle: () => setLang((current) => (current === "en" ? "ar" : "en")),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
