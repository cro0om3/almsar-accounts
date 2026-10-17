"use client";

import { useMemo, useState } from "react";
import { useI18n } from "./I18nProvider";
import VehicleArt from "./VehicleArt";
import { kindOrder, vehicleKind } from "../lib/vehicle-kind";

export default function FleetBoard({ vehicles }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState("all");
  const grouped = useMemo(() => {
    const buckets = new Map();
    for (const vehicle of vehicles) {
      const kind = vehicleKind(vehicle);
      if (kind === "record") continue;
      const list = buckets.get(kind) || [];
      list.push(vehicle);
      buckets.set(kind, list);
    }
    return [...buckets.entries()].sort((a, b) => kindOrder(a[0]) - kindOrder(b[0]));
  }, [vehicles]);
  const visible = filter === "all" ? grouped : grouped.filter(([kind]) => kind === filter);

  return (
    <div className="fleet">
      <div className="fleet-filters">
        <button className={filter === "all" ? "on" : ""} type="button" onClick={() => setFilter("all")}>
          {t.allTypes}
          <span>{grouped.reduce((sum, [, rows]) => sum + rows.length, 0)}</span>
        </button>
        {grouped.map(([kind, rows]) => (
          <button key={kind} className={filter === kind ? "on" : ""} type="button" onClick={() => setFilter(kind)}>
            {t[`kind_${kind}`]}
            <span>{rows.length}</span>
          </button>
        ))}
      </div>
      {visible.map(([kind, rows]) => (
        <section key={kind}>
          <h2>{t[`kind_${kind}`]} <span>{rows.length}</span></h2>
          <div className="fleet-grid">
            {rows.map((vehicle) => (
              <article className="fleet-card" key={vehicle.id}>
                <div className="fleet-stage">
                  <VehicleArt kind={kind} />
                </div>
                <div className="fleet-body">
                  <b>{vehicle.vehicleType || t[`kind_${kind}`]}</b>
                  <p>{vehicle.vehicleNumber}</p>
                  <em>{vehicle.status === "active" ? t.active : vehicle.status}</em>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
