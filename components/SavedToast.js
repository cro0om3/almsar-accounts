"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { useI18n } from "./I18nProvider";

export function flashSaved() {
  window.dispatchEvent(new Event("almsar-saved"));
}

function clearSavedFlag() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("saved") !== "1") return false;
  url.searchParams.delete("saved");
  const query = url.searchParams.toString();
  window.history.replaceState(null, "", url.pathname + (query ? `?${query}` : "") + url.hash);
  return true;
}

export default function SavedToast() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [on, setOn] = useState(false);
  const [tick, setTick] = useState(0);

  function show() {
    setOn(true);
    setTick((value) => value + 1);
  }

  useEffect(() => {
    if (clearSavedFlag()) show();
    const onSaved = () => show();
    window.addEventListener("almsar-saved", onSaved);
    const original = window.history.pushState;
    window.history.pushState = function (...args) {
      const result = original.apply(this, args);
      if (clearSavedFlag()) show();
      return result;
    };
    return () => {
      window.removeEventListener("almsar-saved", onSaved);
      window.history.pushState = original;
    };
  }, [pathname]);

  useEffect(() => {
    if (!on) return undefined;
    const timer = window.setTimeout(() => setOn(false), 4500);
    return () => window.clearTimeout(timer);
  }, [on, tick]);

  if (!on) return null;
  return (
    <div className="saved-toast" role="status">
      <Check size={18} />
      <span>{t.saved}</span>
    </div>
  );
}
