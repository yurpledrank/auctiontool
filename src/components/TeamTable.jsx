import { useState, useMemo } from "react";
import { TEAM_NAMES, TEAM_GROUP, getTier } from "../constants";

const SORT_OPTIONS = [
  { key: "queue",         label: "Auction Order" },
  { key: "champion",      label: "P(Champ)" },
  { key: "mean_earnings", label: "Fair $" },
  { key: "final",         label: "P(Final)" },
  { key: "sf",            label: "P(SF)" },
  { key: "qf",            label: "P(QF)" },
  { key: "r16",           label: "P(R16)" },
  { key: "r32",           label: "P(R32)" },
  { key: "name",          label: "Name" },
  { key: "group",         label: "Group" },
];

function pct(v) {
  if (v == null) return "—";
  return (v * 100).toFixed(1) + "%";
}

export default function TeamTable({ teams, sold, currentTeam, onSelect, evData, evLoading, queue }) {
  const [sortKey, setSortKey] = useState("queue");
  const [filter, setFilter] = useState("all"); // all | unsold | sold

  const sorted = useMemo(() => {
    const list = Object.keys(teams).map((code) => ({
      code,
      name: TEAM_NAMES[code] ?? code,
      group: TEAM_GROUP[code] ?? "?",
      ...teams[code]?.advancement,
      mean_earnings: evData[code]?.mean_earnings ?? null,
    }));

    const queueIndex = Object.fromEntries((queue ?? []).map((code, i) => [code, i]));
    list.sort((a, b) => {
      if (sortKey === "queue") {
        const ai = queueIndex[a.code] ?? Infinity;
        const bi = queueIndex[b.code] ?? Infinity;
        return ai - bi;
      }
      if (sortKey === "name")  return a.name.localeCompare(b.name);
      if (sortKey === "group") return a.group.localeCompare(b.group) || (b.champion ?? 0) - (a.champion ?? 0);
      return (b[sortKey] ?? 0) - (a[sortKey] ?? 0);
    });

    return list;
  }, [teams, sortKey, evData, queue]);

  const visible = sorted.filter((t) => {
    if (filter === "sold")   return t.code in sold;
    if (filter === "unsold") return !(t.code in sold);
    return true;
  });

  return (
    <div className="team-table-wrap">
      <div className="table-controls">
        <div className="sort-pills">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.key}
              className={`pill ${sortKey === o.key ? "active" : ""}`}
              onClick={() => setSortKey(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="filter-pills">
          {["all", "unsold", "sold"].map((f) => (
            <button
              key={f}
              className={`pill ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="table-scroll">
        <table className="team-table">
          <thead>
            <tr>
              <th>Grp</th>
              <th>Team</th>
              <th>R32</th>
              <th>R16</th>
              <th>QF</th>
              <th>SF</th>
              <th>Final</th>
              <th>Champ</th>
              <th className={`col-fair ${evLoading ? "ev-loading-header" : ""}`}>Fair $</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => {
              const tier   = getTier(t.champion ?? 0);
              const isCur  = t.code === currentTeam;
              const sale   = sold[t.code];
              return (
                <tr
                  key={t.code}
                  className={`team-row ${isCur ? "on-block" : ""} ${sale ? "sold-row" : ""}`}
                  onClick={() => onSelect(t.code)}
                >
                  <td className="col-group">{t.group}</td>
                  <td className="col-team">
                    <span className="tier-dot" style={{ background: tier.color }} />
                    <span className="team-code">{t.code}</span>
                    <span className="team-name">{t.name}</span>
                  </td>
                  <td>{pct(t.r32)}</td>
                  <td>{pct(t.r16)}</td>
                  <td>{pct(t.qf)}</td>
                  <td>{pct(t.sf)}</td>
                  <td>{pct(t.final)}</td>
                  <td style={{ color: tier.color }}>{pct(t.champion)}</td>
                  <td className="col-fair">
                    {t.mean_earnings != null
                      ? <span className="fair-val">${t.mean_earnings.toFixed(0)}</span>
                      : <span className="fair-empty">—</span>}
                  </td>
                  <td className="col-status">
                    {isCur && <span className="badge badge-block">On Block</span>}
                    {sale && (
                      <span className="badge badge-sold">
                        ${sale.price} · {sale.syndicate}
                      </span>
                    )}
                    {!isCur && !sale && <span className="badge badge-unsold">Unsold</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        {Object.keys(sold).length} / {Object.keys(teams).length} sold
        &nbsp;·&nbsp;
        Pot: ${Object.values(sold).reduce((s, v) => s + (v.price || 0), 0).toLocaleString()}
      </div>
    </div>
  );
}
