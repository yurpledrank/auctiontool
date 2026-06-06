export const TEAM_NAMES = {
  MEX: "Mexico",     RSA: "South Africa", KOR: "South Korea",  CZE: "Czech Republic",
  CAN: "Canada",     BIH: "Bosnia & Herz", QAT: "Qatar",       SUI: "Switzerland",
  ESP: "Spain",      URU: "Uruguay",       KSA: "Saudi Arabia", CPV: "Cape Verde",
  USA: "USA",        PAR: "Paraguay",      AUS: "Australia",    TUR: "Turkey",
  ARG: "Argentina",  AUT: "Austria",       ALG: "Algeria",      JOR: "Jordan",
  ENG: "England",    CRO: "Croatia",       PAN: "Panama",       GHA: "Ghana",
  FRA: "France",     NOR: "Norway",        SEN: "Senegal",      IRQ: "Iraq",
  BRA: "Brazil",     MAR: "Morocco",       SCO: "Scotland",     HAI: "Haiti",
  POR: "Portugal",   COL: "Colombia",      COD: "DR Congo",     UZB: "Uzbekistan",
  GER: "Germany",    ECU: "Ecuador",       CIV: "Ivory Coast",  CUW: "Curaçao",
  NED: "Netherlands",JPN: "Japan",         SWE: "Sweden",       TUN: "Tunisia",
  BEL: "Belgium",    EGY: "Egypt",         IRN: "Iran",         NZL: "New Zealand",
};

// Official FIFA World Cup 2026 groups (draw: December 5, 2024)
export const GROUPS = {
  A: ["MEX", "RSA", "KOR", "CZE"],   // Host: MEX
  B: ["CAN", "BIH", "QAT", "SUI"],   // Host: CAN
  C: ["BRA", "MAR", "SCO", "HAI"],
  D: ["USA", "PAR", "AUS", "TUR"],   // Host: USA
  E: ["GER", "ECU", "CIV", "CUW"],
  F: ["NED", "JPN", "SWE", "TUN"],
  G: ["BEL", "EGY", "IRN", "NZL"],
  H: ["ESP", "URU", "KSA", "CPV"],
  I: ["FRA", "NOR", "SEN", "IRQ"],
  J: ["ARG", "AUT", "ALG", "JOR"],
  K: ["POR", "COL", "COD", "UZB"],
  L: ["ENG", "CRO", "PAN", "GHA"],
};

// Build reverse lookup: team -> group letter
export const TEAM_GROUP = Object.fromEntries(
  Object.entries(GROUPS).flatMap(([letter, teams]) =>
    teams.map((t) => [t, letter])
  )
);

export const ALL_TEAMS = Object.keys(TEAM_NAMES);

// Probability tier thresholds (champion %)
export const TIERS = [
  { min: 0.10, label: "Elite",     color: "#f59e0b" },  // amber
  { min: 0.03, label: "Contender", color: "#3b82f6" },  // blue
  { min: 0.01, label: "Dark Horse",color: "#22c55e" },  // green
  { min: 0.00, label: "Longshot",  color: "#6b7280" },  // gray
];

export function getTier(champProb) {
  return TIERS.find((t) => champProb >= t.min) ?? TIERS[TIERS.length - 1];
}

export const DEFAULT_SYNDICATES = [
  "JS", "Gibson + JC", "Penney", "Mike + Pat",
  "Scott", "Weems", "Dave", "Paul", "Guido",
];

export const API_BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
