export const HARTHMERE_GLITCH_IDENTITY_KEY =
  "biomes.localDev.harthmere.glitchIdentity.v1";
export const HARTHMERE_GLITCH_IDENTITY_CHANGED_EVENT =
  "biomes:harthmere-glitch-identity-changed";
export const HARTHMERE_GLITCH_SESSION_DISCONNECTED_EVENT =
  "biomes:harthmere-glitch-session-disconnected";

const HARTHMERE_ACTIVE_USER_SCOPE_KEY =
  "biomes.localDev.harthmere.activeUserScope.v1";

export type HarthmereGlitchIdentity = {
  source: "glitch" | "local";
  titleId: string;
  installId?: string;
  sessionId?: string;
  serverSessionId?: string;
  gameUserId: string;
  glitchUserId?: string;
  userName: string;
  validatedAt?: string;
};

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function dispatchIdentityChanged() {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(HARTHMERE_GLITCH_IDENTITY_CHANGED_EVENT));
}

export function readHarthmereGlitchIdentity(): HarthmereGlitchIdentity | undefined {
  if (!isBrowser()) return undefined;
  return safeJsonParse<HarthmereGlitchIdentity | undefined>(
    window.localStorage.getItem(HARTHMERE_GLITCH_IDENTITY_KEY),
    undefined,
  );
}

export function writeHarthmereGlitchIdentity(identity: HarthmereGlitchIdentity) {
  if (!isBrowser()) return;
  window.localStorage.setItem(HARTHMERE_GLITCH_IDENTITY_KEY, JSON.stringify(identity));
  window.localStorage.setItem(HARTHMERE_ACTIVE_USER_SCOPE_KEY, identity.gameUserId);
  window.sessionStorage?.setItem(HARTHMERE_ACTIVE_USER_SCOPE_KEY, identity.gameUserId);
  dispatchIdentityChanged();
}

export function clearHarthmereGlitchIdentity() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(HARTHMERE_GLITCH_IDENTITY_KEY);
  dispatchIdentityChanged();
}

export function getHarthmereGlitchGameUserId() {
  return readHarthmereGlitchIdentity()?.gameUserId;
}

export function getHarthmereGlitchUserName() {
  return readHarthmereGlitchIdentity()?.userName;
}
