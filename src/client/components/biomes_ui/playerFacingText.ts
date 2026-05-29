const EXACT_PLAYER_TEXT: Record<string, string> = {
  fetch_unavailable: "The connection is not ready yet",
  read_state: "Checking your land",
  building_state: "Land records",
  persisted: "Saved",
  the_grove: "The Grove",
  muck_edges: "Muck Edge",
  safe_zone: "Safe Area",
  site_preparation: "Preparing the Site",
  general_trader: "General Trader",
  ecs_inventory: "World Backpack",
  "ecs inventory": "World Backpack",
  "mmo inventory authority": "Backpack",
  "server inventory unavailable": "Inventory Unavailable",
  invite_only: "Invite Only",
  not_placed: "Not Placed",
  not_started: "Not Started",
  pending: "Not ready yet",
};

const DEVELOPER_WORDS = [
  /\bbackend\b/gi,
  /\bserver[-\s]?authoritative\b/gi,
  /\bserver\b/gi,
  /\bpayload\b/gi,
  /\bmutation\b/gi,
  /\bECS\b/g,
  /\bentity\b/gi,
  /\blocalStorage\b/g,
  /\bRedis\b/g,
];

const PLAYER_PHRASES: Array<[RegExp, string]> = [
  [/\bread_state\b/gi, "checking your land"],
  [/\bbuilding_state\b/gi, "land records"],
  [/\bserver accepted\b/gi, "done"],
  [/\bserver rejected\b/gi, "could not finish"],
  [/\bserver[-\s]?authoritative\b/gi, "ready when you are"],
];

export function biomesPlayerTitle(value: unknown, fallback = "Unknown"): string {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const exact = EXACT_PLAYER_TEXT[raw.toLowerCase()];
  if (exact) return exact;
  const clean = raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean
    .split(" ")
    .map((part) => {
      if (/^t\d+$/i.test(part)) return part.toUpperCase();
      if (/^xp$/i.test(part)) return "XP";
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

export function biomesPlayerSentence(value: unknown, fallback = "Nothing to show yet."): string {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const exact = EXACT_PLAYER_TEXT[raw.toLowerCase()];
  if (exact) return exact;
  let clean = raw;
  for (const [pattern, replacement] of PLAYER_PHRASES) {
    clean = clean.replace(pattern, replacement);
  }
  clean = clean
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ");
  for (const pattern of DEVELOPER_WORDS) {
    clean = clean.replace(pattern, "");
  }
  clean = clean.replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function biomesPlayerList(values: unknown[], fallback = "none"): string {
  const cleaned = values
    .map((value) => biomesPlayerSentence(value, ""))
    .filter(Boolean);
  return cleaned.length ? cleaned.join(", ") : fallback;
}
