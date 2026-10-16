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
          <div className="stat"><span>{t.thisMonth}</span><b className="money">{aed(0)}</b></div>
          <div className="stat"><span>{t.avgPerEmployee}</span><b className="money">{aed(0)}</b></div>
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
            <div className="mini"><span className="chip" style={{ background: "#f4ebff", color: "#7a5af8" }}><Users size={14} /></span><span><span>{t.payrollMonth}</span><b className="money">{aed(0)}</b></span></div>
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
        <Trend revenue={data.revenue} expenses={data.expenses} />
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

function Trend({ revenue, expenses }) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const rev = months.map((_, index) => revenue * (0.55 + index * 0.08));
  const exp = months.map((_, index) => expenses * (0.7 + index * 0.04));
  const max = Math.max(...rev, ...exp, 1);
  const x = (index) => 40 + index * 90;
  const y = (value) => 180 - (value / max) * 140;
  const line = (series) => series.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  return (
    <svg className="chart" viewBox="0 0 560 210">
      {[0, 1, 2, 3].map((row) => (
        <line key={row} x1="30" x2="540" y1={40 + row * 40} y2={40 + row * 40} stroke="#eef2f6" />
      ))}
      <polyline fill="none" stroke="#f04438" strokeWidth="3" points={line(exp)} />
      <polyline fill="none" stroke="#12b76a" strokeWidth="3" points={line(rev.map((value, index) => value - exp[index]))} />
      <polyline fill="none" stroke="#2f6fed" strokeWidth="3" points={line(rev)} />
      {months.map((month, index) => (
        <text key={month} x={x(index)} y="202" textAnchor="middle" fontSize="12" fill="#98a2b3">{month}</text>
      ))}
    </svg>
  );
}
