import { useState, useEffect } from "react";
import { TEAM_NAMES, TEAM_GROUP, GROUPS, getTier } from "../constants";
import { loadOpponents } from "../api";
import { TEAM_STATS } from "../teamStats";
import { ANALYST_ADV, PELE_RATINGS, ELO_RATINGS, PELE_RANKS, ELO_RANKS, isChampDisagreement, neloDelta } from "../analystData";

const ROUNDS = [
  { key: "r32",      label: "Grp Adv" },
  { key: "r16",      label: "R16" },
  { key: "qf",       label: "QF" },
  { key: "sf",       label: "SF" },
  { key: "final",    label: "Final" },
  { key: "champion", label: "Champ" },
];

const OPP_ROUNDS = [
  { key: "r32", label: "R32" },
  { key: "r16", label: "R16" },
  { key: "qf",  label: "QF"  },
];

function pct(v) {
  return v != null ? (v * 100).toFixed(1) + "%" : "—";
}

function ProbBar({ value, color }) {
  return (
    <div className="prob-bar-wrap">
      <div
        className="prob-bar-fill"
        style={{ width: `${Math.min(100, (value ?? 0) * 100)}%`, background: color }}
      />
    </div>
  );
}

function FormDots({ last5 }) {
  const dots = last5 ?? [null, null, null, null, null];
  return (
    <span className="form-dots">
      {dots.map((r, i) => (
        <span key={i} className={`form-dot form-${r ? r.toLowerCase() : "unknown"}`} title={r ?? "?"} />
      ))}
    </span>
  );
}

function GroupTable({ currentTeam, sold, evData }) {
  const group = TEAM_GROUP[currentTeam];
  const groupTeams = [...(GROUPS[group] ?? [])].sort(
    (a, b) => (ELO_RATINGS[b] ?? 0) - (ELO_RATINGS[a] ?? 0)
  );

  return (
    <div className="group-table-section">
      <div className="section-label">Group {group}</div>
      <table className="group-table">
        <thead>
          <tr>
            <th className="gt-team">Team</th>
            <th className="gt-price">Price</th>
            <th className="gt-pele">ELO</th>
            <th className="gt-rank">#WC</th>
            <th className="gt-rank">#FIFA</th>
            <th className="gt-form">Form</th>
          </tr>
        </thead>
        <tbody>
          {groupTeams.map((code) => {
            const sale      = sold[code];
            const fairVal   = evData?.[code]?.mean_earnings;
            const stats     = TEAM_STATS[code] ?? {};
            const isCurrent = code === currentTeam;

            let priceLabel, priceClass;
            if (sale) {
              priceLabel = `$${sale.price.toLocaleString()}`;
              priceClass = "gt-price-sold";
            } else if (fairVal != null) {
              priceLabel = `~$${Math.round(fairVal)}`;
              priceClass = "gt-price-unsold";
            } else {
              priceLabel = "—";
              priceClass = "";
            }

            return (
              <tr key={code} className={isCurrent ? "gt-row-current" : ""}>
                <td className="gt-team-cell">
                  <span className="gt-code">{code}</span>
                  <span className="gt-name">{TEAM_NAMES[code] ?? code}</span>
                </td>
                <td className={`gt-price-cell ${priceClass}`}>
                  {priceLabel}
                  {sale && <span className="gt-syn">{sale.syndicate}</span>}
                </td>
                <td className="gt-pele-cell">{stats.elo?.toFixed(0) ?? "—"}</td>
                <td className="gt-rank-cell">{stats.eloRank != null ? `#${stats.eloRank}` : "—"}</td>
                <td className="gt-rank-cell">{stats.fifaRank != null ? `#${stats.fifaRank}` : "—"}</td>
                <td className="gt-form-cell"><FormDots last5={stats.last5} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BracketPath({ opponents, sold, evData }) {
  return (
    <div className="bracket-section">
      <div className="section-label">Likely Opponents</div>
      <div className="opp-rounds">
        {OPP_ROUNDS.map(({ key, label }) => {
          const data = opponents[key];
          return (
            <div key={key} className="opp-round-block">
              <div className="opp-round-header">
                <span className="opp-round-label">{label}</span>
                {data && (
                  <span className="opp-round-reach">
                    {(data.reach_prob * 100).toFixed(0)}% reach
                  </span>
                )}
              </div>
              {!data ? (
                <div className="opp-loading">…</div>
              ) : (
                <table className="opp-table">
                  <tbody>
                    {Object.entries(data.opponents).slice(0, 5).map(([opp, prob]) => {
                      const sale    = sold[opp];
                      const fairVal = evData?.[opp]?.mean_earnings;
                      let priceStr, priceCls;
                      if (sale) {
                        priceStr = `$${sale.price.toLocaleString()}`;
                        priceCls = "opp-price-sold";
                      } else if (fairVal != null) {
                        priceStr = `~$${Math.round(fairVal)}`;
                        priceCls = "opp-price-unsold";
                      } else {
                        priceStr = "—";
                        priceCls = "";
                      }
                      return (
                        <tr key={opp} className="opp-row">
                          <td className="opp-code">{opp}</td>
                          <td className="opp-prob">{(prob * 100).toFixed(0)}%</td>
                          <td className={`opp-price ${priceCls}`}>{priceStr}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AuctionPanel({
  currentTeam,
  teams,
  sold,
  syndicates,
  queue,
  currentIdx,
  onRecord,
  onSkip,
  onPrev,
  onUndo,
  canUndo,
  evData,
  initialEvData,
  potTarget,
  onEdit,
}) {
  const [price, setPrice]         = useState("");
  const [syndicate, setSyndicate] = useState(syndicates[0] ?? "");
  const [priceErr, setPriceErr]   = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [opponents, setOpponents] = useState({});

  useEffect(() => {
    setPrice("");
    setPriceErr("");
    setSyndicate(syndicates[0] ?? "");
    setIsEditing(false);
    setOpponents({});
  }, [currentTeam, syndicates]);

  useEffect(() => {
    if (!currentTeam) return;
    let cancelled = false;
    Promise.all(
      OPP_ROUNDS.map(({ key }) =>
        loadOpponents(currentTeam, key).catch(() => null)
      )
    ).then(([r32, r16, qf]) => {
      if (!cancelled) setOpponents({ r32, r16, qf });
    });
    return () => { cancelled = true; };
  }, [currentTeam]);

  if (!currentTeam) {
    return (
      <div className="auction-panel auction-done">
        <div className="done-msg">
          <h2>Auction Complete</h2>
          <p>All {Object.keys(sold).length} teams have been sold.</p>
          <p className="done-pot">
            Total Pot: ${Object.values(sold).reduce((s, v) => s + (v.price || 0), 0).toLocaleString()}
          </p>
        </div>
      </div>
    );
  }

  const profile     = teams[currentTeam];
  const adv         = profile?.advancement ?? {};
  const champProb   = adv.champion ?? 0;
  const tier        = getTier(champProb);
  const alreadySold = sold[currentTeam];

  const fairValue     = evData?.[currentTeam]?.mean_earnings ?? null;
  const initFairValue = initialEvData?.[currentTeam]?.mean_earnings ?? null;
  const disagrees     = isChampDisagreement(adv.champion, currentTeam);
  const nelo          = neloDelta(currentTeam);
  const bidNum        = parseInt(price, 10);
  const liveEV        = fairValue != null && !isNaN(bidNum) && price !== "" ? fairValue - bidNum : null;

  function handleRecord() {
    const p = parseInt(price, 10);
    if (!price || isNaN(p) || p < 0) { setPriceErr("Enter a valid price (0 or more)."); return; }
    if (!syndicate)                   { setPriceErr("Select a syndicate."); return; }
    onRecord(currentTeam, p, syndicate);
    setPrice("");
    setPriceErr("");
  }

  function startEdit() {
    setPrice(String(alreadySold.price));
    setSyndicate(alreadySold.syndicate);
    setIsEditing(true);
  }

  function cancelEdit() {
    setPrice("");
    setPriceErr("");
    setSyndicate(syndicates[0] ?? "");
    setIsEditing(false);
  }

  function handleUpdate() {
    const p = parseInt(price, 10);
    if (!price || isNaN(p) || p < 0) { setPriceErr("Enter a valid price (0 or more)."); return; }
    if (!syndicate)                   { setPriceErr("Select a syndicate."); return; }
    onEdit(currentTeam, p, syndicate);
    setIsEditing(false);
    setPrice("");
    setPriceErr("");
  }

  const remaining = queue.length - currentIdx;
  const progress  = currentIdx / queue.length;

  return (
    <div className="auction-panel">

      {/* Progress — full width */}
      <div className="auction-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="progress-label">
          Team {currentIdx + 1} of {queue.length} &nbsp;·&nbsp; {remaining - 1} remaining after this
        </span>
      </div>

      {/* Two-column body */}
      <div className="panel-two-col">

        {/* Left: unified team card + prob breakdown */}
        <div className="panel-left-col">
          <div className="unified-card" style={{ borderColor: tier.color }}>
            <div className="uc-top-row">
              <span className="uc-group">Group {TEAM_GROUP[currentTeam]}</span>
              <div className="uc-header-right">
                {(initFairValue != null || fairValue != null) && (
                  <div className="uc-ev-display">
                    {initFairValue != null && (
                      <>
                        <span className="uc-ev-init">${Math.round(initFairValue)}</span>
                        <span className="uc-ev-sep">→</span>
                      </>
                    )}
                    {fairValue != null && (
                      <span className="uc-ev-live">${Math.round(fairValue)}</span>
                    )}
                  </div>
                )}
                <span className="auction-tier-badge" style={{ background: tier.color + "22", color: tier.color }}>
                  {tier.label}
                </span>
              </div>
            </div>
            <div className="uc-team-row">
              <span className="uc-code" style={{ color: tier.color }}>{currentTeam}</span>
              <span className="uc-name">{TEAM_NAMES[currentTeam] ?? currentTeam}</span>
            </div>
            <div className="uc-rating-grid">
              {/* Row 1: values + NELO + badge */}
              <span className="uc-chip">
                <span className="uc-clabel">PELE</span>
                <span className="uc-cval">{PELE_RATINGS[currentTeam] ?? "—"}</span>
              </span>
              <span className="uc-chip">
                <span className="uc-clabel">ELO</span>
                <span className="uc-cval">{ELO_RATINGS[currentTeam] ?? "—"}</span>
              </span>
              <span className="uc-chip">
                <span className="uc-clabel">NELO Δ</span>
                <span className="uc-cval" style={{ color: nelo != null && nelo > 1 ? "var(--success)" : nelo != null && nelo < -1 ? "var(--danger)" : "var(--text)" }}>
                  {nelo != null ? `${nelo > 0 ? "+" : ""}${nelo.toFixed(1)}%` : "—"}
                </span>
              </span>
              <span className={`uc-agree-badge ${disagrees ? "uc-agree-warn" : "uc-agree-ok"}`}>
                {disagrees ? "⚠ Sources Disagree" : "✓ Sources Converge"}
              </span>
              {/* Row 2: ranks aligned under PELE and ELO */}
              <span className="uc-chip uc-rank-chip">
                <span className="uc-clabel">PELE</span>
                <span className="uc-cval uc-rank-val">#{PELE_RANKS[currentTeam] ?? "—"}</span>
              </span>
              <span className="uc-chip uc-rank-chip">
                <span className="uc-clabel">ELO</span>
                <span className="uc-cval uc-rank-val">#{ELO_RANKS[currentTeam] ?? "—"}</span>
              </span>
              <span /><span />
            </div>
            <table className="uc-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Silver</th>
                  <th>TheAnalyst</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>R32</td>
                  <td>{pct(adv.r32)}</td>
                  <td>{pct(ANALYST_ADV[currentTeam]?.r32)}</td>
                </tr>
                <tr className={disagrees ? "uc-row-warn" : ""}>
                  <td>P(Champ)</td>
                  <td>{pct(adv.champion)}</td>
                  <td>{pct(ANALYST_ADV[currentTeam]?.champion)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="prob-grid">
            <table className="prob-table">
              <thead>
                <tr>
                  <th></th>
                  {ROUNDS.map(({ key, label }) => (
                    <th key={key}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="prob-src-label">Silver</td>
                  {ROUNDS.map(({ key }) => (
                    <td key={key} className="prob-cell"
                      style={{ color: key === "champion" ? tier.color : undefined }}>
                      {pct(adv[key])}
                    </td>
                  ))}
                </tr>
                <tr className="prob-ta-row">
                  <td className="prob-src-label">TA</td>
                  {ROUNDS.map(({ key }) => (
                    <td key={key} className="prob-cell">
                      {pct(ANALYST_ADV[currentTeam]?.[key])}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: group + opponent tables */}
        <div className="panel-right-col">
          <GroupTable currentTeam={currentTeam} sold={sold} evData={evData} />
          <BracketPath opponents={opponents} sold={sold} evData={evData} />
        </div>
      </div>

      {alreadySold && !isEditing ? (
        <div className="already-sold">
          <div className="sold-tag">SOLD</div>
          <div className="sold-detail">
            ${alreadySold.price.toLocaleString()} &rarr; {alreadySold.syndicate}
          </div>
          <div className="sold-actions">
            <button className="btn-ghost" onClick={startEdit}>Edit Sale</button>
            <button className="btn-secondary" onClick={onSkip}>Next Team →</button>
          </div>
        </div>
      ) : (
        <div className="bid-section">
          {isEditing && (
            <div className="edit-banner">Editing sale — {currentTeam}</div>
          )}
          <div className="bid-row">
            <label className="bid-label">Winning Bid</label>
            <input
              className="bid-input"
              type="number"
              min="0"
              placeholder="$0"
              value={price}
              onChange={(e) => { setPrice(e.target.value); setPriceErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && (isEditing ? handleUpdate() : handleRecord())}
            />
          </div>
          <div className="bid-row">
            <label className="bid-label">Syndicate</label>
            <select
              className="bid-select"
              value={syndicate}
              onChange={(e) => setSyndicate(e.target.value)}
            >
              {syndicates.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {priceErr && <div className="bid-err">{priceErr}</div>}
          {liveEV != null && (
            <div className="bid-live-ev"
              style={{ color: liveEV >= 0 ? "var(--success)" : "var(--danger)" }}>
              EV at ${bidNum.toLocaleString()}: {liveEV >= 0 ? "+" : ""}${Math.round(liveEV)}
              &nbsp;({liveEV >= 0 ? "+" : ""}{((liveEV / bidNum) * 100).toFixed(0)}%)
            </div>
          )}
          <div className="bid-actions">
            {isEditing ? (
              <>
                <button className="btn-ghost" onClick={cancelEdit}>Cancel</button>
                <button className="btn-primary" onClick={handleUpdate}>Update Sale</button>
              </>
            ) : (
              <>
                <button className="btn-secondary" onClick={onSkip}>Skip →</button>
                <button className="btn-primary" onClick={handleRecord}>Record Sale</button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="panel-nav">
        <button className="btn-ghost" onClick={onPrev} disabled={currentIdx === 0}>
          ← Prev
        </button>
        <button className="btn-undo" onClick={onUndo} disabled={!canUndo}>
          ↩ Undo
        </button>
        <span className="nav-hint">Click any row in the table to jump to that team</span>
      </div>
    </div>
  );
}
