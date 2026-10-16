"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Car,
  ChevronDown,
  Database,
  FileText,
  Home,
  Menu,
  Receipt,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { useI18n } from "./I18nProvider";

export default function Shell({ children }) {
  const { t, toggle } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [docs, setDocs] = useState(true);
  const [masters, setMasters] = useState(
    ["/customers", "/vehicles", "/vendors", "/employees"].some((href) => pathname.startsWith(href))
  );

  useEffect(() => {
    if (["/quotes", "/invoices", "/purchase-orders"].some((href) => pathname.startsWith(href))) setDocs(true);
    if (["/customers", "/vehicles", "/vendors", "/employees"].some((href) => pathname.startsWith(href))) setMasters(true);
  }, [pathname]);

  const active = (href) => pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <div className={`app ${open ? "is-open" : "is-collapsed"}`}>
      <aside className="side">
        <button className="icon-btn menu-btn" type="button" onClick={() => setOpen((value) => !value)} aria-label="Menu">
          <Menu size={18} />
        </button>
        <div className="logo-tile">
          <img src="/logo.png" alt="Almsar Alzaki" />
        </div>
        {open ? (
          <div className="brand-copy">
            <b>{t.brand}</b>
            <span>{t.brandSub}</span>
          </div>
        ) : null}
        <nav className="nav">
          <Link className={active("/") && pathname === "/" ? "active" : ""} href="/" title={t.home}>
            <Home size={18} />
            {open ? <span>{t.home}</span> : null}
          </Link>
          <Link className={active("/vehicle-dashboard") ? "active" : ""} href="/vehicle-dashboard" title={t.vehicleDashboard}>
            <BarChart3 size={18} />
            {open ? <span>{t.vehicleDashboard}</span> : null}
          </Link>
          <Link className={active("/vehicle-finances") ? "active" : ""} href="/vehicle-finances" title={t.vehicleFinances}>
            <Car size={18} />
            {open ? <span>{t.vehicleFinances}</span> : null}
          </Link>
          <button className={`group ${docs ? "on" : ""}`} type="button" onClick={() => setDocs((value) => !value)}>
            <FileText size={18} />
            {open ? <span>{t.docGenerator}</span> : null}
            {open ? <ChevronDown size={16} /> : null}
          </button>
          {open && docs ? (
            <div className="sub">
              <Link className={active("/quotes") ? "active" : ""} href="/quotes">{t.quotations}</Link>
              <Link className={active("/invoices") ? "active" : ""} href="/invoices">{t.invoices}</Link>
              <Link className={active("/purchase-orders") ? "active" : ""} href="/purchase-orders">{t.purchaseOrders}</Link>
            </div>
          ) : null}
          <button className={`group ${masters ? "on" : ""}`} type="button" onClick={() => setMasters((value) => !value)}>
            <Database size={18} />
            {open ? <span>{t.masters}</span> : null}
            {open ? <ChevronDown size={16} /> : null}
          </button>
          {open && masters ? (
            <div className="sub">
              <Link className={active("/customers") ? "active" : ""} href="/customers">{t.customers}</Link>
              <Link className={active("/vehicles") ? "active" : ""} href="/vehicles">{t.vehicles}</Link>
              <Link className={active("/vendors") ? "active" : ""} href="/vendors">{t.vendors}</Link>
              <Link className={active("/employees") ? "active" : ""} href="/employees">{t.employees}</Link>
            </div>
          ) : null}
          <Link className={active("/payslips") ? "active" : ""} href="/payslips" title={t.payslips}>
            <Wallet size={18} />
            {open ? <span>{t.payslips}</span> : null}
          </Link>
          <Link className={active("/reports") ? "active" : ""} href="/reports" title={t.reports}>
            <Receipt size={18} />
            {open ? <span>{t.reports}</span> : null}
          </Link>
          <Link className={active("/settings") ? "active" : ""} href="/settings" title={t.settings}>
            <Settings size={18} />
            {open ? <span>{t.settings}</span> : null}
          </Link>
        </nav>
        <div className="side-foot">
          <button className="lang" type="button" onClick={toggle}>{t.language}</button>
          <div className="user">
            <span className="avatar"><Users size={16} /></span>
            {open ? (
              <span>
                <b>Almsar Alzaki</b>
                <small>almsaruser@gmail.com</small>
              </span>
            ) : null}
          </div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
