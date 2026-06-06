import { useState } from "react";
import { DEFAULT_SYNDICATES } from "../constants";

export default function SetupModal({ onStart }) {
  const [names, setNames] = useState(DEFAULT_SYNDICATES.join("\n"));
  const [err, setErr] = useState("");

  function handleStart() {
    const list = names
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length < 2) {
      setErr("Enter at least 2 syndicate names.");
      return;
    }
    if (new Set(list).size !== list.length) {
      setErr("Syndicate names must be unique.");
      return;
    }
    onStart(list);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h2>WC2026 Calcutta Auction</h2>
        <p className="modal-sub">Enter one syndicate name per line before starting.</p>
        <textarea
          className="syndicate-input"
          rows={8}
          value={names}
          onChange={(e) => { setNames(e.target.value); setErr(""); }}
          placeholder="Alpha&#10;Beta&#10;Gamma&#10;..."
        />
        {err && <div className="modal-err">{err}</div>}
        <button className="btn-primary" onClick={handleStart}>
          Start Auction
        </button>
      </div>
    </div>
  );
}
