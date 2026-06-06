import { useState, useEffect, useCallback } from "react";
import { loadAllProfiles, loadRunInfo, fetchEV } from "./api";
import { getTier, GROUPS } from "./constants";
import SetupScreen from "./components/SetupScreen";
import TeamTable from "./components/TeamTable";
import AuctionPanel from "./components/AuctionPanel";
import SyndicateBoard from "./components/SyndicateBoard";
import AuctionLog from "./components/AuctionLog";
import "./App.css";

const STORAGE_KEY = "wc2026_auction_state";

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const GROUP_LETTERS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

// Wave order: seeds 2&3 per group (A-L), then seed 1 per group, then seed 4 per group.
// Within each group, seed rank is by champion probability descending.
function buildDefaultQueue(teams) {
  const seeds = {};
  GROUP_LETTERS.forEach((letter) => {
    seeds[letter] = [...(GROUPS[letter] ?? [])].sort(
      (a, b) => (teams[b]?.advancement?.champion ?? 0) - (teams[a]?.advancement?.champion ?? 0)
    );
  });

  const wave1 = GROUP_LETTERS.flatMap((l) => [seeds[l][1], seeds[l][2]]);  // seeds 2 & 3
  const wave2 = GROUP_LETTERS.map((l) => seeds[l][0]);                      // seed 1
  const wave3 = GROUP_LETTERS.map((l) => seeds[l][3]);                      // seed 4

  return [...wave1, ...wave2, ...wave3].filter(Boolean);
}

// Bayesian shrinkage: blend $potTarget prior with observed sales to estimate
// the total pot, then return the implied price per remaining unsold team.
// S=12 means: after 12 teams sold (25%), split is 50% prior / 50% observed.
const S_SHRINK = 3;
const N_TEAMS  = 48;

function computeAssumedPerUnsold(sold, potTarget) {
  const soldVals = Object.values(sold);
  const nSold    = soldVals.length;
  const nUnsold  = N_TEAMS - nSold;
  if (nUnsold <= 0) return 0;
  if (nSold   === 0) return potTarget / N_TEAMS;

  const actualTotal     = soldVals.reduce((s, v) => s + (v.price || 0), 0);
  const extrapolatedPot = (actualTotal / nSold) * N_TEAMS;
  const estimatedPot    = (S_SHRINK * potTarget + nSold * extrapolatedPot) / (S_SHRINK + nSold);
  return Math.max(0, (estimatedPot - actualTotal) / nUnsold);
}

export default function App() {
  const [teams,    setTeams]    = useState({});
  const [runInfo,  setRunInfo]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [apiError, setApiError] = useState(null);

  const [setupDone,     setSetupDone]     = useState(false);
  const [syndicates,    setSyndicates]    = useState([]);
  const [queue,         setQueue]         = useState([]);
  const [currentIdx,    setCurrentIdx]    = useState(0);
  const [sold,          setSold]          = useState({});
  const [history,       setHistory]       = useState([]);
  const [potTarget,      setPotTarget]      = useState(5000);
  const [evData,         setEvData]         = useState({});
  const [initialEvData,  setInitialEvData]  = useState({});
  const [evLoading,      setEvLoading]      = useState(false);

  useEffect(() => {
    Promise.all([loadAllProfiles(), loadRunInfo()])
      .then(([profiles, info]) => {
        setTeams(profiles);
        setRunInfo(info);
        setLoading(false);
        const saved = loadSaved();
        if (saved?.setupDone) {
          setSyndicates(saved.syndicates ?? []);
          setSold(saved.sold ?? {});
          setHistory(saved.history ?? []);
          // Discard saved queue if team count or run_id changed (e.g. DB rebuilt)
          const freshTeamCount = Object.keys(profiles).length;
          const savedQueue = saved.queue ?? [];
          const queueStale =
            savedQueue.length !== freshTeamCount ||
            (info.run_id && saved.runId && saved.runId !== info.run_id);
          setQueue(queueStale ? buildDefaultQueue(profiles) : savedQueue);
          setCurrentIdx(saved.currentIdx ?? 0);
          if (saved.potTarget    != null) setPotTarget(saved.potTarget);
          if (saved.initialEvData)       setInitialEvData(saved.initialEvData);
          setSetupDone(true);
        }
      })
      .catch((err) => {
        setApiError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!setupDone) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ setupDone, syndicates, sold, history, queue, currentIdx, potTarget, initialEvData, runId: runInfo?.run_id })
    );
  }, [setupDone, syndicates, sold, history, queue, currentIdx, potTarget, runInfo]);

  // Recompute EV whenever sold prices or potTarget change.
  // Runs pre-setup too so EVs are ready before the first team goes up.
  useEffect(() => {
    if (Object.keys(teams).length === 0) return;
    const assumedPerUnsold = computeAssumedPerUnsold(sold, potTarget);
    const prices = {};
    Object.keys(teams).forEach((team) => {
      prices[team] = sold[team]?.price ?? assumedPerUnsold;
    });
    setEvLoading(true);
    fetchEV(prices)
      .then((data) => {
        const map = {};
        data.teams.forEach((t) => { map[t.team] = t; });
        setEvData(map);
        // Only guard initialEvData once the auction is live
        if (setupDone) {
          setInitialEvData(prev => Object.keys(prev).length === 0 ? map : prev);
        }
      })
      .catch((err) => console.warn("EV fetch failed:", err))
      .finally(() => setEvLoading(false));
  }, [setupDone, sold, potTarget, teams]);

  const handleStart = useCallback(
    (names) => {
      const q = buildDefaultQueue(teams);
      setSyndicates(names);
      setQueue(q);
      setCurrentIdx(0);
      setSold({});
      setHistory([]);
      setInitialEvData(evData);   // Capture pre-fetched EVs as the auction baseline
      setSetupDone(true);
    },
    [teams, evData]
  );

  const handleRecord = useCallback((team, price, syndicate) => {
    const champProb = teams[team]?.advancement?.champion ?? 0;
    setHistory((prev) => [
      ...prev,
      { team, price, syndicate, champProb, idx: currentIdx, ts: Date.now() },
    ]);
    setSold((prev) => ({ ...prev, [team]: { price, syndicate } }));
    setCurrentIdx((i) => i + 1);
  }, [teams, currentIdx]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setSold((prev) => {
      const next = { ...prev };
      delete next[last.team];
      return next;
    });
    setHistory((prev) => prev.slice(0, -1));
    setCurrentIdx(last.idx);
  }, [history]);

  const handleSkip  = useCallback(() => setCurrentIdx((i) => i + 1), []);
  const handlePrev  = useCallback(() => setCurrentIdx((i) => Math.max(0, i - 1)), []);

  const handleSelectTeam = useCallback(
    (code) => {
      const idx = queue.indexOf(code);
      if (idx !== -1) setCurrentIdx(idx);
    },
    [queue]
  );

  const handleEdit = useCallback((team, price, syndicate) => {
    setSold((prev) => ({ ...prev, [team]: { price, syndicate } }));
    setHistory((prev) => {
      const revIdx = [...prev].reverse().findIndex((e) => e.team === team);
      if (revIdx === -1) return prev;
      const realIdx = prev.length - 1 - revIdx;
      const updated = [...prev];
      updated[realIdx] = { ...updated[realIdx], price, syndicate };
      return updated;
    });
  }, []);

  const handleReset = useCallback(() => {
    if (!window.confirm("Reset the auction? This clears all recorded bids.")) return;
    setSold({});
    setHistory([]);
    setCurrentIdx(0);
    setInitialEvData({});
    setSetupDone(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const currentTeam  = queue[currentIdx] ?? null;
  const soldEntries  = Object.values(sold);
  const nSold        = soldEntries.length;
  const totalSpent   = soldEntries.reduce((s, v) => s + (v.price || 0), 0);
  const impliedPot   = nSold >= 1 ? Math.round((totalSpent / nSold) * N_TEAMS) : null;

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading simulation data…</p>
        <p className="loading-sub">
          Make sure the API server is running:{" "}
          <code>python server.py --db wc2026_prod.sqlite</code>
        </p>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="error-screen">
        <h2>Cannot reach API server</h2>
        <p className="err-msg">{apiError}</p>
        <p>Start the server, then reload this page:</p>
        <code>python server.py --db wc2026_prod.sqlite</code>
      </div>
    );
  }

  if (!setupDone) {
    return (
      <SetupScreen
        runInfo={runInfo}
        potTarget={potTarget}
        onPotTargetChange={setPotTarget}
        evLoading={evLoading}
        evReady={Object.keys(evData).length > 0}
        onStart={handleStart}
      />
    );
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-title">WC2026 Calcutta Auction</div>
        {runInfo && (
          <div className="header-meta">
            {(runInfo.n_sims ?? 0).toLocaleString()} sims · seed {runInfo.seed}
          </div>
        )}
        {setupDone && (
          <>
            <span className="header-counters">
              <span className="header-counter-label">Auctioned</span>
              <span className="header-counter-val">{currentIdx}/{queue.length}</span>
              <span className="header-sep">·</span>
              <span className="header-counter-label">Sold</span>
              <span className="header-counter-val">{nSold}</span>
              <span className="header-sep">·</span>
              <span className="header-counter-label">Spent</span>
              <span className="header-counter-val">${totalSpent.toLocaleString()}</span>
            </span>
            <span className="header-pot-block">
              <span className="header-counter-label">Pot target</span>
              <input
                className="assumed-price-input"
                type="number"
                min="0"
                value={potTarget}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v >= 0) setPotTarget(v);
                }}
              />
              {impliedPot != null && (
                <>
                  <span className="header-sep">·</span>
                  <span className="header-counter-label">implied</span>
                  <span className="header-pot-implied">${impliedPot.toLocaleString()}</span>
                </>
              )}
              {evLoading && <span className="ev-updating">updating…</span>}
            </span>
          </>
        )}
        {setupDone && (
          <button className="btn-ghost reset-btn" onClick={handleReset}>
            Reset
          </button>
        )}
      </header>

      <div className="app-body">
        <aside className="left-panel">
          <TeamTable
            teams={teams}
            sold={sold}
            currentTeam={currentTeam}
            onSelect={handleSelectTeam}
            evData={evData}
            evLoading={evLoading}
            queue={queue}
          />
        </aside>

        <main className="center-panel">
          <AuctionPanel
            currentTeam={currentTeam}
            teams={teams}
            sold={sold}
            syndicates={syndicates}
            queue={queue}
            currentIdx={currentIdx}
            onRecord={handleRecord}
            onSkip={handleSkip}
            onPrev={handlePrev}
            onUndo={handleUndo}
            canUndo={history.length > 0}
            evData={evData}
            initialEvData={initialEvData}
            potTarget={potTarget}
            onEdit={handleEdit}
          />
        </main>

        <aside className="right-panel">
          <SyndicateBoard syndicates={syndicates} sold={sold} teams={teams} evData={evData} />
          <AuctionLog history={history} />
        </aside>
      </div>

    </div>
  );
}
