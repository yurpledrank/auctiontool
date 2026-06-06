import { useMemo } from "react";
import { TEAM_NAMES, getTier } from "../constants";

function fmtDelta(v) {
  if (v == null) return "—";
  const sign = v >= 0 ? "+" : "";
  return `${sign}$${Math.round(Math.abs(v)).toLocaleString()}`;
}

export default function SyndicateBoard({ syndicates, sold, teams, evData }) {
  const boards = useMemo(() => {
    return syndicates.map((name) => {
      const entries = Object.entries(sold)
        .filter(([, v]) => v.syndicate === name)
        .map(([code, v]) => {
          const fairVal = evData?.[code]?.mean_earnings ?? null;
          const delta   = fairVal != null ? fairVal - v.price : null;
          return {
            code,
            price: v.price,
            champProb: teams[code]?.advancement?.champion ?? 0,
            fairVal,
            delta,
          };
        })
        .sort((a, b) => (b.delta ?? -Infinity) - (a.delta ?? -Infinity));

      const spent    = entries.reduce((s, e) => s + e.price, 0);
      const netDelta = entries.every((e) => e.delta != null)
        ? entries.reduce((s, e) => s + e.delta, 0)
        : null;

      return { name, entries, spent, netDelta };
    });
  }, [syndicates, sold, teams, evData]);

  const totalPot = Object.values(sold).reduce((s, v) => s + (v.price || 0), 0);

  return (
    <div className="syndicate-board">
      <div className="board-title">
        Syndicates
        <span className="board-pot">
          Total Pot: ${totalPot.toLocaleString()}
        </span>
      </div>
      <div className="board-grid">
        {boards.map(({ name, entries, spent, netDelta }) => (
          <div key={name} className="syn-card">
            <div className="syn-header">
              <span className="syn-name">{name}</span>
              <span className="syn-spent">${spent.toLocaleString()}</span>
            </div>
            <div className="syn-stat-row">
              <span className="syn-stat-label">Teams</span>
              <span className="syn-stat-val">{entries.length}</span>
              <span className="syn-stat-label">Net EV</span>
              <span
                className="syn-stat-val"
                style={{
                  color: netDelta == null ? undefined
                       : netDelta >= 0    ? "var(--success)"
                       :                   "var(--danger)",
                }}
              >
                {netDelta != null ? fmtDelta(netDelta) : "—"}
              </span>
            </div>
            {entries.length === 0 ? (
              <div className="syn-empty">No teams yet</div>
            ) : (
              <ul className="syn-teams">
                {entries.map((e) => {
                  const tier = getTier(e.champProb);
                  return (
                    <li key={e.code} className="syn-team-row">
                      <span className="tier-dot" style={{ background: tier.color }} />
                      <span className="syn-team-code">{e.code}</span>
                      <span className="syn-team-name">{TEAM_NAMES[e.code] ?? e.code}</span>
                      <span
                        className="syn-team-delta"
                        style={{
                          color: e.delta == null ? "var(--text-dim)"
                               : e.delta >= 0    ? "var(--success)"
                               :                   "var(--danger)",
                        }}
                      >
                        {fmtDelta(e.delta)}
                      </span>
                      <span className="syn-team-price">${e.price.toLocaleString()}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
