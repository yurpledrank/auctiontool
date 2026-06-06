import { useState } from "react";
import { DEFAULT_SYNDICATES } from "../constants";

export default function SetupScreen({ runInfo, potTarget, onPotTargetChange, evLoading, evReady, onStart }) {
  const [names, setNames] = useState(DEFAULT_SYNDICATES.join("\n"));
  const [err,   setErr]   = useState("");

  function handleStart() {
    const list = names.split("\n").map(s => s.trim()).filter(Boolean);
    if (list.length < 2) { setErr("Enter at least 2 syndicate names."); return; }
    if (new Set(list).size !== list.length) { setErr("Syndicate names must be unique."); return; }
    onStart(list);
  }

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <h1 className="setup-title">WC2026 Calcutta Auction</h1>
        {runInfo && (
          <p className="setup-meta">
            {(runInfo.n_sims ?? 0).toLocaleString()} sims · seed {runInfo.seed}
          </p>
        )}

        <div className="setup-field">
          <label className="setup-label">
            Syndicates <span className="setup-hint">(one per line)</span>
          </label>
          <textarea
            className="syndicate-input"
            rows={10}
            value={names}
            onChange={e => { setNames(e.target.value); setErr(""); }}
          />
        </div>

        <div className="setup-field setup-row">
          <label className="setup-label">Pot target</label>
          <div className="setup-pot-wrap">
            <span className="setup-dollar">$</span>
            <input
              className="setup-pot-input"
              type="number"
              min="0"
              step="500"
              value={potTarget}
              onChange={e => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v >= 0) onPotTargetChange(v);
              }}
            />
          </div>
        </div>

        <div className={`setup-ev-status ${evLoading ? "sev-loading" : evReady ? "sev-ready" : "sev-waiting"}`}>
          {evLoading
            ? "Calculating expected values…"
            : evReady
            ? "Expected values ready — auction can begin"
            : "Waiting for simulation data…"}
        </div>

        {err && <div className="modal-err">{err}</div>}

        <button
          className="btn-primary setup-start-btn"
          onClick={handleStart}
          disabled={!evReady}
        >
          {evReady ? "Start Auction" : "Loading…"}
        </button>
      </div>
    </div>
  );
}
