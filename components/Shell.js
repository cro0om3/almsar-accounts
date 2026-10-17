"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bell,
  Car,
  ChevronDown,
  Database,
  FileText,
  FolderOpen,
  Home,
  Menu,
  Receipt,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { useI18n } from "./I18nProvider";
import SavedToast from "./SavedToast";
import { can } from "../lib/permissions";

function AlertsButton({ alerts, t }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bell-wrap">
      <button className="icon-btn bell" type="button" aria-label={t.alerts} onClick={() => setOpen((value) => !value)}>
        <Bell size={18} />
        {alerts.length ? <span className="bell-count">{alerts.length}</span> : null}
      </button>
      {open ? (
        <div className="notice-panel">
          <b>{t.alerts}</b>
          <p>{t.alertWindow}</p>
          {alerts.length === 0 ? <p>{t.noAlerts}</p> : alerts.map((alert) => (
            <Link prefetch={false} key={`${alert.id}-${alert.kind}`} href={`/vehicles?id=${alert.id}`} onClick={() => setOpen(false)}>
              <strong>{alert.vehicleType || alert.vehicleNumber}</strong>
              {alert.vehicleType ? <small>{alert.vehicleNumber}</small> : null}
              <span>{alert.kind === "ownership" ? t.ownershipExpiry : t.vehicleExpiry}</span>
              <em className={alert.expired ? "expired" : ""}>
                {alert.expired ? t.expiredOn : t.expiresOn} {alert.date}
              </em>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Shell({ children, session }) {
  const { t, toggle } = useI18n();
  const pathname = usePathname();
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [docs, setDocs] = useState(true);
  const [masters, setMasters] = useState(
    ["/customers", "/vehicles", "/vendors", "/employees"].some((href) => pathname.startsWith(href))
  );

  useEffect(() => {
    if (["/quotes", "/invoices", "/receipts", "/purchase-orders", "/expenses"].some((href) => pathname.startsWith(href))) setDocs(true);
    if (["/customers", "/vehicles", "/vendors", "/employees"].some((href) => pathname.startsWith(href))) setMasters(true);
    setDrawer(false);
    if (pathname === "/login") return undefined;
    let stop = false;
    fetch("/api/alerts").then((response) => response.json()).then((rows) => {
      if (!stop && Array.isArray(rows)) setAlerts(rows);
    }).catch(() => {});
    return () => { stop = true; };
  }, [pathname]);

  function closeMenu() {
    setDrawer(false);
  }

  const active = (href) => pathname === href || (href !== "/" && pathname.startsWith(href));
  const allowed = (key) => can(session, key);
  if (pathname === "/login") return children;

  const docLinks = [
    ["/quotes", "quotes", t.quotations],
    ["/invoices", "invoices", t.invoices],
    ["/receipts", "receipts", t.receipts],
    ["/purchase-orders", "orders", t.purchaseOrders],
    ["/expenses", "expenses", t.expensesMenu],
  ].filter(([, key]) => allowed(key));
  const masterLinks = [
    ["/customers", "customers", t.customers],
    ["/vehicles", "vehicles", t.vehicles],
    ["/vendors", "vendors", t.vendors],
    ["/employees", "employees", t.employees],
  ].filter(([, key]) => allowed(key));
  const roleLabel = session?.role === "admin" ? t.adminRole : session?.role === "accountant" ? t.accountantRole : t.customRole;

  return (
    <div className={`app ${open ? "is-open" : "is-collapsed"} ${drawer ? "menu-open" : ""}`}>
      <header className="phone-bar">
        <button className="icon-btn" type="button" onClick={() => setDrawer(true)} aria-label="Menu">
          <Menu size={20} />
        </button>
        <b>{t.brand}</b>
        <AlertsButton alerts={alerts} t={t} />
        <button className="lang" type="button" onClick={toggle}>{t.language}</button>
      </header>
      {drawer ? <button className="backdrop" type="button" aria-label="Close" onClick={() => setDrawer(false)} /> : null}
      <aside className="side">
        <button className="icon-btn menu-btn" type="button" aria-label="Menu" onClick={() => {
          if (window.matchMedia("(max-width: 800px)").matches) setDrawer(false);
          else setOpen((value) => !value);
        }}>
          <Menu size={18} />
        </button>
        <div className="logo-tile">
          <img src="/api/branding/logo" alt="Almsar Alzaki" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/logo.png"; }} />
        </div>
        {open ? (
          <div className="brand-copy">
            <b>{t.brand}</b>
            <span>{t.brandSub}</span>
          </div>
        ) : null}
        <nav className="nav" onClick={(event) => { if (event.target.closest("a")) closeMenu(); }}>
          {allowed("home") ? (
          <Link prefetch={false} className={active("/") && pathname === "/" ? "active" : ""} href="/" title={t.home}>
            <Home size={18} />
            {open ? <span>{t.home}</span> : null}
          </Link>
          ) : null}
          {allowed("fleet") ? (
          <Link prefetch={false} className={active("/vehicle-dashboard") ? "active" : ""} href="/vehicle-dashboard" title={t.vehicleDashboard}>
            <BarChart3 size={18} />
            {open ? <span>{t.vehicleDashboard}</span> : null}
          </Link>
          ) : null}
          {allowed("finances") ? (
          <Link prefetch={false} className={active("/vehicle-finances") ? "active" : ""} href="/vehicle-finances" title={t.vehicleFinances}>
            <Car size={18} />
            {open ? <span>{t.vehicleFinances}</span> : null}
          </Link>
          ) : null}
          {docLinks.length ? (
          <button className={`group ${docs ? "on" : ""}`} type="button" onClick={() => setDocs((value) => !value)}>
            <FileText size={18} />
            {open ? <span>{t.docGenerator}</span> : null}
            {open ? <ChevronDown size={16} /> : null}
          </button>
          ) : null}
          {open && docs && docLinks.length ? (
            <div className="sub">
              {docLinks.map(([href, , label]) => (
                <Link prefetch={false} key={href} className={active(href) ? "active" : ""} href={href}>{label}</Link>
              ))}
            </div>
          ) : null}
          {masterLinks.length ? (
          <button className={`group ${masters ? "on" : ""}`} type="button" onClick={() => setMasters((value) => !value)}>
            <Database size={18} />
            {open ? <span>{t.masters}</span> : null}
            {open ? <ChevronDown size={16} /> : null}
          </button>
          ) : null}
          {open && masters && masterLinks.length ? (
            <div className="sub">
              {masterLinks.map(([href, , label]) => (
                <Link prefetch={false} key={href} className={active(href) ? "active" : ""} href={href}>{label}</Link>
              ))}
            </div>
          ) : null}
          {allowed("payslips") ? (
          <Link prefetch={false} className={active("/payslips") ? "active" : ""} href="/payslips" title={t.payslips}>
            <Wallet size={18} />
            {open ? <span>{t.payslips}</span> : null}
          </Link>
          ) : null}
          {allowed("reports") ? (
          <Link prefetch={false} className={active("/reports") ? "active" : ""} href="/reports" title={t.reports}>
            <Receipt size={18} />
            {open ? <span>{t.reports}</span> : null}
          </Link>
          ) : null}
          {allowed("files") ? (
          <Link prefetch={false} className={active("/files") ? "active" : ""} href="/files" title={t.files}>
            <FolderOpen size={18} />
            {open ? <span>{t.files}</span> : null}
          </Link>
          ) : null}
          {allowed("settings") ? (
          <Link prefetch={false} className={active("/settings") ? "active" : ""} href="/settings" title={t.settings}>
            <Settings size={18} />
            {open ? <span>{t.settings}</span> : null}
          </Link>
          ) : null}
        </nav>
        <div className="side-foot">
          <button className="lang" type="button" onClick={toggle}>{t.language}</button>
          <div className="user">
            <span className="avatar"><Users size={16} /></span>
            {open ? (
              <span>
                <b>{session?.name || t.brand}</b>
                <small>{roleLabel}</small>
              </span>
            ) : null}
          </div>
          <button className="lang" type="button" onClick={async () => {
            await fetch("/api/logout", { method: "POST" });
            window.location.href = "/login";
          }}>{t.logout}</button>
        </div>
      </aside>
      <SavedToast />
      <main className="main">
        <div className="notice-bar"><AlertsButton alerts={alerts} t={t} /></div>
        {children}
      </main>
    </div>
  );
}
