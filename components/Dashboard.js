"use client";

import Link from "next/link";
import {
  BarChart3,
  Car,
  CreditCard,
  FilePlus2,
  FileText,
  Receipt,
  UserPlus,
  Users,
} from "lucide-react";
import { useI18n } from "./I18nProvider";
import { aed } from "../lib/money";

export default function Dashboard({ data }) {
  const { t } = useI18n();
  const margin = data.revenue ? Math.round((data.profit / data.revenue) * 1000) / 10 : 0;
  return (
    <>
      <section className="panel alerts-board">
        <h2>{t.alerts}</h2>
        <p className="lead">{t.alertWindow}</p>
        {data.alerts?.length ? (
          <div className="alerts-list">
            {data.alerts.map((alert) => {
              const name = alert.vehicleType || "";
              const number = alert.vehicleNumber || "—";
              return (
                <Link className={`alert-line ${alert.expired ? "expired" : ""}`} key={`${alert.id}-${alert.kind}`} href={`/vehicles?id=${alert.id}`}>
                  <span className="alert-who">
                    <b>{name || number}</b>
                    {name ? <small>{number}</small> : null}
                  </span>
                  <span className="alert-when">
                    <span className="alert-kind">{alert.kind === "ownership" ? t.ownershipExpiry : t.vehicleExpiry}</span>
                    <em>{alert.expired ? t.expiredOn : t.expiresOn} {formatAlertDate(alert.date, t.dir)}</em>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : <p>{t.noAlerts}</p>}
      </section>

      <section className="panel quick">
        <h2>{t.quickActions}</h2>
        <div className="actions">
          <Link className="action blue" href="/quotes/new"><FilePlus2 size={22} />{t.newQuotation}</Link>
          <Link className="action green" href="/invoices/new"><CreditCard size={22} />{t.newInvoice}</Link>
          <Link className="action mint" href="/vehicles"><Car size={22} />{t.addVehicle}</Link>
          <Link className="action violet" href="/customers"><UserPlus size={22} />{t.addCustomer}</Link>
          <Link className="action lilac" href="/employees"><Users size={22} />{t.addEmployee}</Link>
          <Link className="action pink" href="/invoices"><Receipt size={22} />{t.processPayment}</Link>
          <Link className="action peach" href="/reports"><BarChart3 size={22} />{t.viewReports}</Link>
        </div>
      </section>

      <section className="grid-3">
        <article className="panel">
          <FileText size={18} color="#2f6fed" />
          <h2>{t.quotesInvoices}</h2>
          <p className="lead">{t.quotesInvoicesLead}</p>
          <div className="split">
            <div>
              <div className="k">{t.quotes}</div>
              <div className="stat"><span>{t.totalQuotes}</span><b>{data.quotes}</b></div>
              <div className="stat"><span>{t.thisMonth}</span><b>{data.quotesMonth}</b></div>
              <div className="stat"><span>{t.totalValue}</span><b className="money">{aed(data.quoteValue)}</b></div>
              <div className="stat"><span>{t.valueThisMonth}</span><b className="money">{aed(data.quoteValueMonth)}</b></div>
            </div>
            <div>
              <div className="k">{t.invoicesLabel}</div>
              <div className="stat"><span>{t.totalInvoices}</span><b>{data.invoices}</b></div>
              <div className="stat"><span>{t.thisMonth}</span><b>{data.invoicesMonth}</b></div>
              <div className="stat"><span>{t.paymentReceived}</span><b className="money">{aed(data.received)}</b></div>
              <div className="stat"><span>{t.pending}</span><b>{data.pending}</b></div>
            </div>
          </div>
        </article>
        <article className="panel">
          <Users size={18} color="#12b76a" />
          <h2>{t.employeeSalaries}</h2>
          <p className="lead">{t.employeeSalariesLead}</p>
          <div className="stat"><span>{t.activeEmployees}</span><b>{data.employees}</b></div>
          <div className="stat"><span>{t.thisMonth}</span><b className="money">{aed(data.payroll)}</b></div>
          <div className="stat"><span>{t.avgPerEmployee}</span><b className="money">{aed(data.employees ? data.payroll / data.employees : 0)}</b></div>
        </article>
        <article className="panel">
          <BarChart3 size={18} color="#7a5af8" />
          <h2>{t.vehicleRevenue}</h2>
          <p className="lead">{t.vehicleRevenueLead}</p>
          <div className="stat"><span>{t.totalRevenue}</span><b className="money">{aed(data.revenue)}</b></div>
          <div className="stat"><span>{t.totalExpenses}</span><b className="money">{aed(data.expenses)}</b></div>
          <div className="stat"><span>{t.netProfit}</span><b className="money green">{aed(data.profit)}</b></div>
          <div className="stat"><span>{t.profitMargin}</span><b>{margin}%</b></div>
        </article>
      </section>

      <section className="grid-3b">
        <article className="panel">
          <h2>{t.activityMonth}</h2>
          <div className="cols" style={{ marginTop: 12, gridTemplateColumns: "1fr" }}>
            <div className="mini"><span className="chip" style={{ background: "#e0eaff", color: "#2f6fed" }}><FileText size={14} /></span><span><span>{t.quotesThisMonth}</span><b>{data.quotesMonth}</b></span></div>
            <div className="mini"><span className="chip" style={{ background: "#e7f8f1", color: "#079455" }}><Receipt size={14} /></span><span><span>{t.invoicesThisMonth}</span><b>{data.invoicesMonth}</b></span></div>
            <div className="mini"><span className="chip" style={{ background: "#e8f8ef", color: "#12b76a" }}><CreditCard size={14} /></span><span><span>{t.amountReceived}</span><b className="money">{aed(data.receivedMonth)}</b></span></div>
            <div className="mini"><span className="chip" style={{ background: "#f4ebff", color: "#7a5af8" }}><Users size={14} /></span><span><span>{t.payrollMonth}</span><b className="money">{aed(data.payroll)}</b></span></div>
          </div>
        </article>
        <article className="panel">
          <h2>{t.financialHealth}</h2>
          <div className="stat"><span>{t.totalRevenue}</span><b className="green money">{aed(data.revenue)}</b></div>
          <div className="stat"><span>{t.netProfit}</span><b className="green money">{aed(data.profit)}</b></div>
          <div className="stat"><span>{t.profitMargin}</span><b className="orange">{margin}%</b></div>
          <div className="stat"><span>{t.outstandingAmount}</span><b className="orange money">{aed(data.outstanding)}</b></div>
        </article>
        <article className="panel">
          <h2>{t.businessOverview}</h2>
          <div className="stat"><span>{t.totalCustomers}</span><b className="purple">{data.customers}</b></div>
          <div className="stat"><span>{t.totalQuoteValue}</span><b className="purple money">{aed(data.quoteValue)}</b></div>
          <div className="stat"><span>{t.pendingInvoices}</span><b className="orange">{data.pending}</b></div>
          <div className="stat"><span>{t.activeEmployees}</span><b className="green">{data.employees}</b></div>
        </article>
      </section>

      <section className="panel trend">
        <h2>{t.revenueTrend}</h2>
        <p className="lead">{t.revenueTrendLead}</p>
        <div className="legend">
          <span><i className="dot" style={{ background: "#2f6fed" }} />{t.revenue}</span>
          <span><i className="dot" style={{ background: "#f04438" }} />{t.expenses}</span>
          <span><i className="dot" style={{ background: "#12b76a" }} />{t.profitLoss}</span>
        </div>
        <Trend months={data.months || []} lang={t.dir === "rtl" ? "ar" : "en"} />
      </section>

      <section className="two">
        <article className="panel">
          <h2>{t.topCustomers}</h2>
          {data.topCustomers.map((row, index) => (
            <div className="person" key={row.name + index}>
              <div>
                <span className="rank">{index + 1}</span>
                <b>{row.name}</b>
                <div className="k">{row.invoices} / {row.quotes}</div>
              </div>
              <div>
                <b className="money">{aed(row.total)}</b>
                <div className="k orange money">{aed(row.outstanding)}</div>
              </div>
            </div>
          ))}
        </article>
        <article className="panel">
          <h2>{t.activitySummary}</h2>
          {data.activity.map((row, index) => (
            <div className="activity" key={index}>
              <span className="chip" style={{ background: row.kind === "quote" ? "#e0eaff" : "#fff4e8", color: "#1c2430" }}>
                {row.kind === "quote" ? <FileText size={14} /> : <UserPlus size={14} />}
              </span>
              <div>
                <div>{row.kind === "quote" ? `${row.text} · ${row.customer}` : row.text}</div>
                <small className="money">{row.total ? aed(row.total) : row.at}</small>
              </div>
            </div>
          ))}
        </article>
      </section>
    </>
  );
}

function formatAlertDate(value, dir) {
  const text = String(value || "").slice(0, 10);
  const date = new Date(`${text}T00:00:00`);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat(dir === "rtl" ? "ar" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function Trend({ months, lang }) {
  const series = months.length ? months : [{ key: "", revenue: 0, expenses: 0 }];
  const rev = series.map((month) => month.revenue || 0);
  const exp = series.map((month) => month.expenses || 0);
  const max = Math.max(...rev, ...exp, 1);
  const step = series.length > 1 ? 460 / (series.length - 1) : 0;
  const x = (index) => 50 + index * step;
  const y = (value) => 180 - (value / max) * 140;
  const line = (values) => values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const area = `50,180 ${line(rev)} ${x(series.length - 1)},180`;
  const names = lang === "ar" ? MONTHS_AR : MONTHS_EN;
  return (
    <svg className="chart" viewBox="0 0 560 210">
      <defs>
        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2f6fed" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#2f6fed" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((row) => (
        <line key={row} x1="30" x2="540" y1={40 + row * 40} y2={40 + row * 40} stroke="#eef2f6" />
      ))}
      <polygon fill="url(#revFill)" points={area} />
      <polyline fill="none" stroke="#f04438" strokeWidth="3" strokeLinejoin="round" points={line(exp)} />
      <polyline fill="none" stroke="#12b76a" strokeWidth="3" strokeLinejoin="round" points={line(rev.map((value, index) => value - exp[index]))} />
      <polyline fill="none" stroke="#2f6fed" strokeWidth="3" strokeLinejoin="round" points={line(rev)} />
      {series.map((month, index) => {
        const monthIndex = Number(String(month.key).slice(5)) - 1;
        return <text key={month.key || index} x={x(index)} y="202" textAnchor="middle" fontSize="12" fill="#667085">{names[monthIndex] || ""}</text>;
      })}
    </svg>
  );
}
