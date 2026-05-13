import type { BiomesId } from "@/shared/ids";

const HARTHMERE_ACTIVE_USER_SCOPE_KEY =
  "biomes.localDev.harthmere.activeUserScope.v1";
const HARTHMERE_ANONYMOUS_SCOPE = "anonymous";
const HARTHMERE_ANONYMOUS_SESSION_SCOPE_KEY =
  "biomes.localDev.harthmere.anonymousSessionScope.v1";

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function anonymousSessionScope() {
  if (!isBrowser()) {
    return HARTHMERE_ANONYMOUS_SCOPE;
  }
  const existing = window.sessionStorage?.getItem(
    HARTHMERE_ANONYMOUS_SESSION_SCOPE_KEY,
  );
  if (existing) {
    return existing;
  }
  const next = `anonymous-${Date.now()}-${Math.floor(
    Math.random() * 1_000_000,
  )}`;
  window.sessionStorage?.setItem(HARTHMERE_ANONYMOUS_SESSION_SCOPE_KEY, next);
  return next;
}

function normalizeScope(userId: BiomesId | number | string | undefined | null) {
  const raw = userId === undefined || userId === null ? "" : String(userId);
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "0") {
    return anonymousSessionScope();
  }
  return trimmed;
}

export function setHarthmereLocalDevUserScope(
  userId: BiomesId | number | string | undefined | null,
) {
  if (!isBrowser()) {
    return;
  }
  const scope = normalizeScope(userId);
  window.sessionStorage?.setItem(HARTHMERE_ACTIVE_USER_SCOPE_KEY, scope);
  window.localStorage.setItem(HARTHMERE_ACTIVE_USER_SCOPE_KEY, scope);
  window.dispatchEvent(new CustomEvent("biomes:harthmere-reputation-changed"));
  window.dispatchEvent(new CustomEvent("biomes:harthmere-combat-changed"));
  window.dispatchEvent(new CustomEvent("biomes:harthmere-multiplayer-combat-changed"));
  window.dispatchEvent(new CustomEvent("biomes:harthmere-leveling-changed"));
}

export function getHarthmereLocalDevUserScope() {
  if (!isBrowser()) {
    return HARTHMERE_ANONYMOUS_SCOPE;
  }
  return normalizeScope(
    window.sessionStorage?.getItem(HARTHMERE_ACTIVE_USER_SCOPE_KEY) ??
      window.localStorage.getItem(HARTHMERE_ACTIVE_USER_SCOPE_KEY),
  );
}

export function harthmereUserScopedStorageKey(baseKey: string) {
  return `${baseKey}.user.${getHarthmereLocalDevUserScope()}`;
}
