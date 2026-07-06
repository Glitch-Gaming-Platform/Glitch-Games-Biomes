import { readHarthmereGlitchIdentity } from "@/client/game/glitch/harthmere_glitch_identity";

// HARTHMERE_LIVE_FETCH_TIMEOUT_RETRY (2026-07-05): production HAR analysis
// showed the live_mode server route regularly takes 10s+ to respond while the
// old timeouts were 8s (reads) / 15s (mutations). Roughly HALF of all write
// traffic (eat_food, use_medical_item, request_respawn, request_death_transition)
// was aborted client-side at exactly the timeout — "eating does nothing",
// medical items silently failing, respawns hanging, etc. Every mutation carries
// an idempotencyKey the server dedupes/replays, so timed-out requests are also
// SAFE to retry. Timeouts are therefore raised above the observed server
// latency and timed-out/network-failed requests are automatically retried.
export const HARTHMERE_LIVE_READ_TIMEOUT_MS = 20_000;
export const HARTHMERE_LIVE_MUTATION_TIMEOUT_MS = 30_000;
// Total attempts (1 initial + retries). Mutations are idempotent server-side
// (requestId/idempotencyKey), so retrying a timed-out POST cannot double-apply.
export const HARTHMERE_LIVE_MUTATION_MAX_ATTEMPTS = 3;
export const HARTHMERE_LIVE_READ_MAX_ATTEMPTS = 2;
export const HARTHMERE_LIVE_RETRY_BACKOFF_MS = 750;

const HARTHMERE_LIVE_API_PATH = "/api/harthmere/live_mode";
const HARTHMERE_LIVE_INSTALL_HEADER = "X-Glitch-Install-Id";
const HARTHMERE_LIVE_INSTALL_STORAGE_KEYS = [
  "biomes.glitch.installId",
  "biomes.localDev.harthmere.installId",
] as const;

function isHarthmereLiveApiPath(pathname: string) {
  return (
    pathname === HARTHMERE_LIVE_API_PATH ||
    pathname.startsWith(`${HARTHMERE_LIVE_API_PATH}_`)
  );
}

function currentWindowLocation() {
  return typeof window !== "undefined" ? window.location : undefined;
}

function currentLocationSearch() {
  return currentWindowLocation()?.search ?? "";
}

function installIdFromSearch(search: string | undefined) {
  const params = new URLSearchParams(search ?? "");
  return params.get("install_id") ?? params.get("installId") ?? undefined;
}

function storedHarthmereInstallId() {
  if (
    typeof window === "undefined" ||
    typeof window.localStorage === "undefined"
  ) {
    return undefined;
  }
  for (const key of HARTHMERE_LIVE_INSTALL_STORAGE_KEYS) {
    const value = window.localStorage.getItem(key)?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

// HARTHMERE_LIVE_INSTALL_ID_STICKY (2026-07-02): every live-mode request MUST
// carry the install id, because the server resolves the player-state actor from
// it. When it is missing, the WRITE path falls back to the raw biomes auth
// userId — a DIFFERENT actor key than the install-linked user the READ endpoints
// use — so mutations (eat / mine / place / use) persist to an actor the game
// never displays (validated in production: eat with the install id restored
// stamina and decremented the item; without it, nothing happened).
//
// The URL/location and the two storage fallbacks can all come up empty inside the
// blocked/partitioned glitch.fun iframe (raw `window.localStorage` throws). So we
// cache the first install id we ever see in a module variable that survives
// storage loss, and the glitch bootstrap seeds it via `rememberHarthmereLiveInstallId`.
let cachedHarthmereLiveInstallId: string | undefined;

export function rememberHarthmereLiveInstallId(
  installId: string | null | undefined
): void {
  const value = typeof installId === "string" ? installId.trim() : "";
  if (value) {
    cachedHarthmereLiveInstallId = value;
  }
}

// The sticky install-id cache is module-global; tests must reset it so one
// test's install id never leaks into the next (test-order dependence).
export function resetHarthmereLiveInstallIdForTest(): void {
  cachedHarthmereLiveInstallId = undefined;
}

function resolveHarthmereLiveInstallId(url: URL) {
  const resolved =
    installIdFromSearch(url.search) ??
    installIdFromSearch(currentLocationSearch()) ??
    readHarthmereGlitchIdentity()?.installId ??
    storedHarthmereInstallId() ??
    cachedHarthmereLiveInstallId;
  // Remember it so a later request in a storage-blocked iframe still has it.
  if (resolved) {
    cachedHarthmereLiveInstallId = resolved;
  }
  return resolved;
}

function urlBaseForHarthmereLiveFetch() {
  const location = currentWindowLocation();
  return location?.href ?? "http://localhost/";
}

function formatDecoratedHarthmereLiveUrl(input: RequestInfo | URL, url: URL) {
  if (input instanceof URL) {
    return url;
  }
  const raw =
    typeof input === "string" ? input : isRequestInput(input) ? input.url : "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    return url.toString();
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function isRequestInput(input: unknown): input is Request {
  return typeof Request !== "undefined" && input instanceof Request;
}

export function prepareHarthmereLiveFetchRequest(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
): { input: RequestInfo | URL; init: RequestInit & { timeoutMs?: number } } {
  const rawUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : isRequestInput(input)
      ? input.url
      : "";
  let url: URL;
  try {
    url = new URL(rawUrl, urlBaseForHarthmereLiveFetch());
  } catch {
    return { input, init };
  }
  if (!isHarthmereLiveApiPath(url.pathname)) {
    return { input, init };
  }
  let nextInit = init;
  const method = String(nextInit.method ?? "GET").toUpperCase();
  if (method === "GET") {
    // Live state reads are already coalesced in-memory above. Browser/HTTP
    // caching can replay stale 304 snapshots after a mutation, so always
    // read these Cloud Save projections from the backend source.
    nextInit = { ...nextInit, cache: "no-store" };
  }
  const nextHeaders = new Headers(
    nextInit.headers ?? (isRequestInput(input) ? input.headers : undefined)
  );
  if (method === "GET") {
    nextHeaders.delete("If-None-Match");
    nextHeaders.delete("If-Modified-Since");
    nextHeaders.delete("If-Range");
    if (!nextHeaders.has("Cache-Control")) {
      nextHeaders.set("Cache-Control", "no-cache");
    }
    if (!nextHeaders.has("Pragma")) {
      nextHeaders.set("Pragma", "no-cache");
    }
  }
  const installId = resolveHarthmereLiveInstallId(url);
  if (installId && !url.searchParams.has("install_id")) {
    url.searchParams.set("install_id", installId);
  }
  if (installId && !nextHeaders.has(HARTHMERE_LIVE_INSTALL_HEADER)) {
    nextHeaders.set(HARTHMERE_LIVE_INSTALL_HEADER, installId);
  }
  nextInit = { ...nextInit, headers: nextHeaders };

  if (isRequestInput(input)) {
    return {
      input: new Request(formatDecoratedHarthmereLiveUrl(input, url), input),
      init: nextInit,
    };
  }

  return {
    input: formatDecoratedHarthmereLiveUrl(input, url),
    init: nextInit,
  };
}

function harthmereLiveRetrySleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

// Requests constructed from a `Request` object may hold a one-shot body stream,
// which cannot be safely re-sent. Plain string/URL inputs with (string) bodies
// — which is what every live-mode caller in this codebase uses — are always
// safe to retry.
function isRetryableHarthmereLiveInput(
  input: RequestInfo | URL,
  requestInit: RequestInit
) {
  if (isRequestInput(input)) return false;
  const body = (requestInit as { body?: unknown }).body;
  return (
    body === undefined ||
    body === null ||
    typeof body === "string" ||
    (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams)
  );
}

async function rawHarthmereLiveFetchWithTimeout(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  const { timeoutMs: requestedTimeoutMs, ...requestInit } = init;
  if (requestInit.signal || typeof AbortController === "undefined") {
    return fetchImpl(input, requestInit);
  }
  const isMutation =
    String(requestInit.method ?? "GET").toUpperCase() === "POST";
  const timeoutMs =
    requestedTimeoutMs ??
    (isMutation
      ? HARTHMERE_LIVE_MUTATION_TIMEOUT_MS
      : HARTHMERE_LIVE_READ_TIMEOUT_MS);
  // Mutations carry a stable requestId/idempotencyKey the server dedupes on, so
  // retrying a timed-out or network-failed attempt is safe and cannot
  // double-apply (the server replays the original result). Reads are idempotent
  // by definition.
  const maxAttempts = isRetryableHarthmereLiveInput(input, requestInit)
    ? isMutation
      ? HARTHMERE_LIVE_MUTATION_MAX_ATTEMPTS
      : HARTHMERE_LIVE_READ_MAX_ATTEMPTS
    : 1;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(input, {
        ...requestInit,
        signal: controller.signal,
      });
    } catch (error) {
      lastError = error;
      const timedOut =
        controller.signal.aborted && isHarthmereLiveFetchAbortError(error);
      if (attempt < maxAttempts) {
        // Timed out OR network error: back off briefly and retry with the same
        // body (same idempotencyKey → server-side replay, never double-apply).
        await harthmereLiveRetrySleep(
          HARTHMERE_LIVE_RETRY_BACKOFF_MS * attempt
        );
        continue;
      }
      if (timedOut) {
        return new Response(
          JSON.stringify({
            error: "harthmere_live_fetch_timeout",
            timeoutMs,
            attempts: attempt,
          }),
          {
            status: 504,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  // Unreachable: the loop always returns or throws. Keeps TypeScript satisfied.
  throw lastError ?? new Error("harthmere_live_fetch_failed");
}

export function isHarthmereLiveFetchAbortError(error: unknown) {
  return typeof DOMException !== "undefined" && error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error
    ? error.name === "AbortError" ||
      error.message.toLowerCase().includes("aborted")
    : false;
}

// HARTHMERE_LIVE_FETCH_COALESCE
//
// The live_mode_*_state snapshots are fetched from several independent pollers
// (e.g. building_state is read by the minimap, the land tab, the world prompt,
// and the home console). Each used to hit the network on its own, so a single
// page session produced many duplicate GETs of the SAME idempotent endpoint --
// expensive given each request is server-bound (~1.3s avg TTFB). Coalescing
// concurrent + near-simultaneous identical GETs collapses that fan-out while
// changing nothing semantically: every caller still receives an independent,
// readable Response (a clone of the shared one).
//
// Only idempotent GETs without a caller-supplied AbortSignal are coalesced.
// POST mutations (which carry unique requestId/idempotencyKey) always pass
// straight through.
export const HARTHMERE_LIVE_FETCH_COALESCE_TTL_MS = 1_000;

export function planHarthmereLiveFetchCache(input: {
  method?: string;
  hasCustomSignal?: boolean;
  url: string;
}): { cacheable: boolean; key?: string } {
  const method = String(input.method ?? "GET").toUpperCase();
  if (method !== "GET" || input.hasCustomSignal) {
    return { cacheable: false };
  }
  return { cacheable: true, key: `GET ${input.url}` };
}

interface HarthmereLiveFetchCacheEntry {
  at: number;
  promise: Promise<Response>;
}

const globalForHarthmereLiveFetchCache = globalThis as typeof globalThis & {
  __harthmereLiveFetchCache?: Map<string, HarthmereLiveFetchCacheEntry>;
};

function harthmereLiveFetchCache() {
  return (globalForHarthmereLiveFetchCache.__harthmereLiveFetchCache ??=
    new Map<string, HarthmereLiveFetchCacheEntry>());
}

// Exposed for tests.
export function resetHarthmereLiveFetchCache() {
  harthmereLiveFetchCache().clear();
}

export function invalidateHarthmereLiveFetchCache() {
  harthmereLiveFetchCache().clear();
}

export function coalescedHarthmereLiveFetch(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
  options: { nowMs?: () => number; ttlMs?: number } = {}
): Promise<Response> {
  const prepared = prepareHarthmereLiveFetchRequest(input, init);
  input = prepared.input;
  init = prepared.init;
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : (input as Request).url;
  let preparedUrl: URL | undefined;
  try {
    preparedUrl = new URL(url, urlBaseForHarthmereLiveFetch());
  } catch {
    preparedUrl = undefined;
  }
  if (
    preparedUrl &&
    isHarthmereLiveApiPath(preparedUrl.pathname) &&
    String(init.method ?? "GET").toUpperCase() !== "GET"
  ) {
    invalidateHarthmereLiveFetchCache();
  }
  const plan = planHarthmereLiveFetchCache({
    method: init.method,
    hasCustomSignal: Boolean(init.signal),
    url,
  });
  if (!plan.cacheable || !plan.key) {
    return rawHarthmereLiveFetchWithTimeout(fetchImpl, input, init);
  }
  const key = plan.key;
  const cache = harthmereLiveFetchCache();
  const nowMs = options.nowMs ?? Date.now;
  const ttlMs = options.ttlMs ?? HARTHMERE_LIVE_FETCH_COALESCE_TTL_MS;
  const now = nowMs();
  const existing = cache.get(key);
  if (existing && now - existing.at < ttlMs) {
    // Clone so each caller owns an independently-readable body; the cached
    // original is never read directly.
    return existing.promise.then(cloneHarthmereLiveResponse);
  }
  const promise = rawHarthmereLiveFetchWithTimeout(fetchImpl, input, init);
  cache.set(key, { at: now, promise });
  // Never let a rejection, an error response (non-2xx), or a response that
  // cannot be cloned (so it cannot be safely shared) linger in the cache.
  promise
    .then((response) => {
      const cacheable =
        response.ok && typeof (response as any).clone === "function";
      if (!cacheable && cache.get(key)?.promise === promise) {
        cache.delete(key);
      }
    })
    .catch(() => {
      if (cache.get(key)?.promise === promise) {
        cache.delete(key);
      }
    });
  return promise.then(cloneHarthmereLiveResponse);
}

// Clone the response so concurrent/cached callers each get an independent body.
// Falls back to the original when clone() is unavailable (e.g. a test fetch
// stub), in which case the entry is also evicted above so it is never reused.
function cloneHarthmereLiveResponse(response: Response): Response {
  return typeof (response as any).clone === "function"
    ? response.clone()
    : response;
}

// Public entry point used across the Harthmere live adapters. It now coalesces
// idempotent GETs (POSTs and signal-bearing requests pass straight through to
// the raw timeout fetch), so every caller -- including the ones that call this
// directly rather than via defaultHarthmereLiveFetch -- shares the dedupe.
export function fetchHarthmereLiveWithTimeout(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  return coalescedHarthmereLiveFetch(fetchImpl, input, init);
}

export function defaultHarthmereLiveFetch(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  return fetchHarthmereLiveWithTimeout(fetch, input, init);
}
