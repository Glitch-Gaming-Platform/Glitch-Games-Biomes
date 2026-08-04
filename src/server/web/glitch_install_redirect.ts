import type { ParsedUrlQuery } from "querystring";

const INSTALL_ID_KEYS = [
  "install_id",
  "glitch_install_id",
  "installId",
  "game_install_id",
] as const;

const BLOCKED_REDIRECT_QUERY_KEYS = new Set([
  "early_access",
  "login_token",
  "install_id",
  "user_install_id",
  "glitch_install_id",
  "game_install_id",
  "session_id",
  "session_install_id",
  "tracking_token",
  "analytics_session_id",
  "temp_session_id",
  "access_token",
  "refresh_token",
  "id_token",
  "auth_token",
  "oauth_token",
  "api_key",
  "client_secret",
  "authorization",
  "cookie",
  "password",
  "secret",
  "code",
  "state",
  "redirect",
  "redirect_uri",
  "return_to",
  "callback",
  "next",
]);

function normalizeQueryKey(key: string) {
  return key
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function isSensitiveQueryKey(key: string) {
  const normalizedKey = normalizeQueryKey(key);

  return (
    !normalizedKey ||
    BLOCKED_REDIRECT_QUERY_KEYS.has(normalizedKey) ||
    /(^|_)(token|secret|password|authorization|cookie|api_key|client_secret|jwt)($|_)/.test(
      normalizedKey
    )
  );
}

function firstStringQueryValue(query: ParsedUrlQuery, keys: readonly string[]) {
  for (const key of keys) {
    const value = query[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }

  return undefined;
}

export function buildGlitchInstallRedirectDestination(query: ParsedUrlQuery) {
  const installId = firstStringQueryValue(query, INSTALL_ID_KEYS);
  if (!installId) {
    return undefined;
  }

  const params = new URLSearchParams({
    install_id: installId,
    glitch_auto_play: "1",
  });
  const destinationKeys = new Set(Array.from(params.keys(), normalizeQueryKey));

  for (const [key, rawValue] of Object.entries(query)) {
    const normalizedKey = normalizeQueryKey(key);

    // The redirect target owns its launch/session parameters. Preserve only
    // missing, non-sensitive game parameters from the incoming iframe URL.
    if (isSensitiveQueryKey(key) || destinationKeys.has(normalizedKey)) {
      continue;
    }

    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (typeof value === "string") {
        params.append(key, value);
      }
    }
  }

  return `/at?${params.toString()}`;
}
