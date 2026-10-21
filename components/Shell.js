"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
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
} from "lucide-react";
import { displayFromIso } from "../lib/dates";
import { useI18n } from "./I18nProvider";
import SavedToast from "./SavedToast";
import { can } from "../lib/permissions";

function NavGroup({ open, expanded, onToggle, icon: Icon, label, links, active }) {
  if (!links.length) return null;
  const childOn = links.some(([href]) => active(href));
  return (
    <>
      <button className={`group ${childOn ? "on" : ""}`} type="button" onClick={onToggle}>
        <Icon size={18} />
        {open ? <span>{label}</span> : null}
        {open ? <ChevronDown size={16} className={expanded ? "chev" : ""} /> : null}
      </button>
      {open && expanded ? (
        <div className="sub">
          {links.map(([href, , text]) => (
            <Link prefetch={false} key={href} className={active(href) ? "active" : ""} href={href}>{text}</Link>
          ))}
        </div>
      ) : null}
    </>
  );
}

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
              <span>{alert.kind === "insurance" ? t.insuranceExpiry : alert.kind === "ownership" ? t.ownershipExpiry : t.vehicleExpiry}</span>
              <em className={alert.expired ? "expired" : ""}>
                {alert.expired ? t.expiredOn : t.expiresOn} {displayFromIso(alert.date) || alert.date}
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
  const [docs, setDocs] = useState(false);
  const here = (href) => pathname === href || pathname.startsWith(`${href}/`);
  const [fleet, setFleet] = useState(["/vehicle-dashboard", "/vehicle-finances"].some(here));
  const [masters, setMasters] = useState(["/customers", "/vehicles", "/vendors", "/employees", "/payslips"].some(here));

  useEffect(() => {
    if (["/quotes", "/invoices", "/receipts", "/purchase-orders", "/expenses"].some(here)) setDocs(true);
    if (["/vehicle-dashboard", "/vehicle-finances"].some(here)) setFleet(true);
    if (["/customers", "/vehicles", "/vendors", "/employees", "/payslips"].some(here)) setMasters(true);
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

  const active = (href) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
  const allowed = (key) => can(session, key);
  if (pathname === "/login") return children;

  const docLinks = [
    ["/quotes", "quotes", t.quotations],
    ["/invoices", "invoices", t.invoices],
    ["/receipts", "receipts", t.receipts],
    ["/purchase-orders", "orders", t.purchaseOrders],
    ["/expenses", "expenses", t.expensesMenu],
  ].filter(([, key]) => allowed(key));
  const fleetLinks = [
    ["/vehicle-dashboard", "fleet", t.vehicleDashboard],
    ["/vehicle-finances", "finances", t.vehicleFinances],
  ].filter(([, key]) => allowed(key));
  const masterLinks = [
    ["/customers", "customers", t.customers],
    ["/vehicles", "vehicles", t.vehicles],
    ["/vendors", "vendors", t.vendors],
    ["/employees", "employees", t.employees],
    ["/payslips", "payslips", t.payslips],
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
        <nav className="nav" onClick={(event) => { if (event.target.closest("a")) closeMenu(); }}>
          {allowed("home") ? (
          <Link prefetch={false} className={active("/") && pathname === "/" ? "active" : ""} href="/" title={t.home}>
            <Home size={18} />
            {open ? <span>{t.home}</span> : null}
          </Link>
          ) : null}
          <NavGroup open={open} expanded={fleet} onToggle={() => setFleet((value) => !value)} icon={Car} label={t.fleet} links={fleetLinks} active={active} />
          <NavGroup open={open} expanded={docs} onToggle={() => setDocs((value) => !value)} icon={FileText} label={t.docGenerator} links={docLinks} active={active} />
          <NavGroup open={open} expanded={masters} onToggle={() => setMasters((value) => !value)} icon={Database} label={t.masters} links={masterLinks} active={active} />
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
          <div className="user">
            <span className="avatar"><Users size={16} /></span>
            {open ? (
              <span>
                <b>{session?.name || t.brand}</b>
                <small>{roleLabel}</small>
              </span>
            ) : null}
          </div>
          <div className="foot-row">
            <button className="lang" type="button" onClick={toggle}>{t.language}</button>
            <button className="lang" type="button" onClick={async () => {
              await fetch("/api/logout", { method: "POST" });
              window.location.href = "/login";
            }}>{t.logout}</button>
          </div>
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
