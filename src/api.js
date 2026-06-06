import { API_BASE, ALL_TEAMS } from "./constants";

async function get(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

// Load advancement profiles for all 48 teams in parallel.
// Returns { ESP: { advancement: {...}, groupFinish: {...} }, ... }
// Throws if any team profile fails to load, so callers see a clear error
// rather than silently operating with a partial team list.
export async function loadAllProfiles() {
  const results = await Promise.all(
    ALL_TEAMS.map((team) =>
      get(`/teams/${team}/profile`).then((d) => [team, d])
    )
  );
  return Object.fromEntries(results);
}

export async function loadRoundSummary(round = "champion") {
  return get(`/rounds/${round}`);
}

export async function loadOpponents(team, round) {
  return get(`/teams/${team}/opponents/${round}`);
}

export async function loadH2H(teamA, teamB) {
  return get(`/h2h/${teamA}/${teamB}`);
}

export async function loadRunInfo() {
  return get("/info");
}

export async function fetchEV(prices, defaultPrice = 0) {
  const res = await fetch(API_BASE + "/ev", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prices, default_price: defaultPrice }),
  });
  if (!res.ok) throw new Error(`API /ev → ${res.status}`);
  return res.json();
}
