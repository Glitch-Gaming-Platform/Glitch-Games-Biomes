// Local-dev Harthmere economy hardening helpers.
// This file is intentionally client/localStorage based for the local-dev town.
// TODO(server-authoritative-economy): production MMO inventory, currency,
// vendor, auction, guild, property, and quest reward mutations must be owned by
// a server transaction service. Do not promote this localStorage implementation
// to a production economy path.

export const HARTHMERE_LOCAL_DEV_ECONOMY_HARDENING_VERSION = 1;
export const HARTHMERE_LOCAL_DEV_ECONOMY_SERVER_AUTHORITY_TODO =
  "server-authoritative-economy-required-before-production";

export const HARTHMERE_LOCAL_DEV_STATE_KEYS = {
  inventory: "biomes.localDev.harthmere.inventoryState.v1",
  economy: "biomes.localDev.harthmere.economyState.v1",
  gathering: "biomes.localDev.harthmere.gatheringState.v1",
  guild: "biomes.localDev.harthmere.guildState.v1",
  building: "biomes.localDev.harthmere.buildingState.v1",
  reputation: "biomes.localDev.harthmere.reputationState.v1",
  vendorStock: "biomes.localDev.harthmere.vendorStockState.v1",
  rapidActions: "biomes.localDev.harthmere.rapidEconomyActions.v1",
  transactions: "biomes.localDev.harthmere.economyTransactions.v1",
} as const;

export const HARTHMERE_ALLOWED_WALLET_CURRENCIES = [
  "gold",
  "silver",
  "copper",
  "harthmere_favor",
  "black_market_coins",
  "guild_marks",
  "bounty_tokens",
  "crafting_writs",
  "festival_tokens",
  "dungeon_tokens",
  "pvp_marks",
] as const;

export type HarthmereAllowedWalletCurrency =
  (typeof HARTHMERE_ALLOWED_WALLET_CURRENCIES)[number];

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function nonNegativeInt(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }
  return Math.max(0, Math.round(numberValue));
}

export function normalizeHarthmereWallet(
  raw: Record<string, unknown> | undefined,
): Record<HarthmereAllowedWalletCurrency, number> {
  const out = Object.fromEntries(
    HARTHMERE_ALLOWED_WALLET_CURRENCIES.map((currency) => [currency, 0]),
  ) as Record<HarthmereAllowedWalletCurrency, number>;
  for (const currency of HARTHMERE_ALLOWED_WALLET_CURRENCIES) {
    out[currency] = nonNegativeInt(raw?.[currency], 0);
  }
  return out;
}

export function normalizeHarthmereNumberMap(
  raw: Record<string, unknown> | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    out[key] = nonNegativeInt(value, 0);
  }
  return out;
}

export function createHarthmereLocalDevTransactionId(
  kind: string,
  subject: string,
) {
  return `${kind}:${subject}:${Date.now()}:${Math.floor(Math.random() * 1_000_000)}`;
}

type RapidActionState = Record<string, number>;

function readRapidActionState(): RapidActionState {
  if (!isBrowser()) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(HARTHMERE_LOCAL_DEV_STATE_KEYS.rapidActions);
    return raw ? (JSON.parse(raw) as RapidActionState) : {};
  } catch {
    return {};
  }
}

function writeRapidActionState(state: RapidActionState) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(
    HARTHMERE_LOCAL_DEV_STATE_KEYS.rapidActions,
    JSON.stringify(state),
  );
}

export function claimHarthmereLocalDevRapidAction(
  actionKey: string,
  ttlMs = 450,
) {
  if (!isBrowser()) {
    return true;
  }
  const at = Date.now();
  const state = readRapidActionState();
  const previousAt = Number(state[actionKey] ?? 0);
  if (Number.isFinite(previousAt) && at - previousAt < ttlMs) {
    return false;
  }
  state[actionKey] = at;
  // Keep only recent action locks so localStorage cannot grow forever.
  for (const [key, value] of Object.entries(state)) {
    if (at - Number(value) > Math.max(5_000, ttlMs * 10)) {
      delete state[key];
    }
  }
  writeRapidActionState(state);
  return true;
}

export function resetHarthmereLocalDevRapidActionGuards() {
  if (isBrowser()) {
    window.localStorage.removeItem(HARTHMERE_LOCAL_DEV_STATE_KEYS.rapidActions);
  }
}

export function createHarthmereStructuredLogFields(
  system: "inventory" | "economy" | "vendor" | "auction" | "guild" | "building" | "gathering",
  action: string,
  success = true,
) {
  return {
    system,
    actorId: "local-player",
    reason: action,
    success,
  } as const;
}
