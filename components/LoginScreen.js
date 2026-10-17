"use client";

import { useState } from "react";
import { useI18n } from "./I18nProvider";

export default function LoginScreen() {
  const { t, toggle } = useI18n();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setBusy(false);
    if (!response.ok) {
      setError(true);
      return;
    }
    window.location.href = "/";
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <img src="/logo.png" alt="" />
        <h1>{t.brand}</h1>
        <p>{t.loginLead}</p>
        <input
          inputMode="numeric"
          autoComplete="off"
          value={code}
          onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 8)); setError(false); }}
          aria-label={t.accessCode}
        />
        {error ? <p className="login-error">{t.badCode}</p> : null}
        <button className="btn" type="submit" disabled={busy || code.length < 4}>{t.loginButton}</button>
        <button className="lang" type="button" onClick={toggle}>{t.language}</button>
      </form>
    </main>
  );
}
