"use client";

import { useMemo, useState } from "react";
import { Search, Wallet } from "lucide-react";
import { useI18n } from "./I18nProvider";
import { vehicleKind } from "../lib/vehicle-kind";
import { aed } from "../lib/money";

export default function FinanceDesk({ vehicles }) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [profit, setProfit] = useState("all");
  const [sort, setSort] = useState("profit");
  const [selectedId, setSelectedId] = useState("");

  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return vehicles
      .filter((vehicle) => {
        const hay = `${vehicle.vehicleNumber} ${vehicle.vehicleType}`.toLowerCase();
        if (vehicleKind(vehicle) === "record" && vehicle.transactions.length === 0) return false;
        if (text && !hay.includes(text)) return false;
        if (status !== "all" && vehicle.status !== status) return false;
        if (profit === "profit" && vehicle.profit <= 0) return false;
        if (profit === "loss" && vehicle.profit >= 0) return false;
        if (profit === "none" && vehicle.transactions.length > 0) return false;
        return true;
      })
      .sort((a, b) => (sort === "name" ? a.vehicleNumber.localeCompare(b.vehicleNumber) : b.profit - a.profit || a.vehicleNumber.localeCompare(b.vehicleNumber)));
  }, [vehicles, query, status, profit, sort]);

  const current = rows.find((vehicle) => vehicle.id === selectedId) || null;

  return (
    <div className="desk-page">
      <div className="desk finance">
        <aside className="desk-list">
          <header className="finance-head">
            <h1>{t.vehicleFinances}</h1>
            <p>{t.financeLead}</p>
            <label className="search">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.searchVehicle} />
            </label>
            <div className="finance-filters">
            <label>{t.status}
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">{t.allStatuses}</option>
                <option value="active">{t.active}</option>
              </select>
            </label>
            <label>{t.profitability}
              <select value={profit} onChange={(event) => setProfit(event.target.value)}>
                <option value="all">{t.allTypes}</option>
                <option value="profit">{t.netProfit}</option>
                <option value="none">{t.noFinancial}</option>
              </select>
            </label>
            <label>{t.sortBy}
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="profit">{t.profitHigh}</option>
                <option value="name">{t.nameSort}</option>
              </select>
            </label>
            </div>
            <small>{rows.length} {t.vehiclesCount}</small>
          </header>
          <div className="desk-scroll">
            {rows.map((vehicle) => (
              <button
                key={vehicle.id}
                type="button"
                id={`finance-card-${vehicle.id}`}
                className={vehicle.id === current?.id ? "finance-card on" : "finance-card"}
                onClick={() => {
                  setSelectedId(vehicle.id);
                  requestAnimationFrame(() => {
                    document.getElementById(`finance-card-${vehicle.id}`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
                  });
                }}
              >
                <b>{vehicle.vehicleType || t.vehicle}</b>
                <span>{vehicle.vehicleNumber}</span>
                {vehicle.transactions.length === 0 ? <em>{t.noFinancial}</em> : <strong className={vehicle.profit >= 0 ? "green" : "orange"}>{aed(vehicle.profit)}</strong>}
              </button>
            ))}
          </div>
        </aside>
        <section className="desk-detail">
          {!current ? (
            <div className="desk-blank">
              <div className="blank-icon"><Wallet size={28} /></div>
              <h2>{t.selectVehicle}</h2>
              <p>{t.viewFinance}</p>
            </div>
          ) : (
            <>
              <div className="detail-top">
                <div>
                  <h2>{current.vehicleType || t.vehicle}</h2>
                  <p>{current.vehicleNumber}</p>
                </div>
              </div>
              {current.transactions.length === 0 ? (
                <div className="desk-blank">
                  <h2>{t.noFinancial}</h2>
                  <p>{t.viewFinance}</p>
                </div>
              ) : (
                <>
                  <div className="detail-cards three">
                    <article className="panel"><h3>{t.revenue}</h3><b>{aed(current.revenue)}</b></article>
                    <article className="panel"><h3>{t.expenses}</h3><b>{aed(current.expenses)}</b></article>
                    <article className="panel"><h3>{t.netProfit}</h3><b className="green">{aed(current.profit)}</b></article>
                  </div>
                  <article className="panel lines-card">
                    <h3>{t.viewFinance}</h3>
                    <table>
                      <thead><tr><th>{t.date}</th><th>{t.description}</th><th>{t.total}</th></tr></thead>
                      <tbody>
                        {current.transactions.map((row) => (
                          <tr key={row.id}>
                            <td>{row.date}</td>
                            <td>{row.description || row.transactionType}</td>
                            <td>{aed(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </article>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
