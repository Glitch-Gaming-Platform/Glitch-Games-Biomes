export const HARTHMERE_LIVE_READ_TIMEOUT_MS_V1 = 8_000;
export const HARTHMERE_LIVE_MUTATION_TIMEOUT_MS_V1 = 15_000;

async function rawHarthmereLiveFetchWithTimeoutV1(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  const { timeoutMs: requestedTimeoutMs, ...requestInit } = init;
  if (requestInit.signal || typeof AbortController === "undefined") {
    return fetchImpl(input, requestInit);
  }
  const timeoutMs =
    requestedTimeoutMs ??
    (String(requestInit.method ?? "GET").toUpperCase() === "POST"
      ? HARTHMERE_LIVE_MUTATION_TIMEOUT_MS_V1
      : HARTHMERE_LIVE_READ_TIMEOUT_MS_V1);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(input, {
      ...requestInit,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

// HARTHMERE_LIVE_FETCH_COALESCE_V1
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
export const HARTHMERE_LIVE_FETCH_COALESCE_TTL_MS_V1 = 1_000;

export function planHarthmereLiveFetchCacheV1(input: {
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

interface HarthmereLiveFetchCacheEntryV1 {
  at: number;
  promise: Promise<Response>;
}

const globalForHarthmereLiveFetchCacheV1 = globalThis as typeof globalThis & {
  __harthmereLiveFetchCacheV1?: Map<string, HarthmereLiveFetchCacheEntryV1>;
};

function harthmereLiveFetchCacheV1() {
  return (globalForHarthmereLiveFetchCacheV1.__harthmereLiveFetchCacheV1 ??=
    new Map<string, HarthmereLiveFetchCacheEntryV1>());
}

// Exposed for tests.
export function resetHarthmereLiveFetchCacheV1() {
  harthmereLiveFetchCacheV1().clear();
}

export function coalescedHarthmereLiveFetchV1(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
  options: { nowMs?: () => number; ttlMs?: number } = {}
): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : (input as Request).url;
  const plan = planHarthmereLiveFetchCacheV1({
    method: init.method,
    hasCustomSignal: Boolean(init.signal),
    url,
  });
  if (!plan.cacheable || !plan.key) {
    return rawHarthmereLiveFetchWithTimeoutV1(fetchImpl, input, init);
  }
  const key = plan.key;
  const cache = harthmereLiveFetchCacheV1();
  const nowMs = options.nowMs ?? Date.now;
  const ttlMs = options.ttlMs ?? HARTHMERE_LIVE_FETCH_COALESCE_TTL_MS_V1;
  const now = nowMs();
  const existing = cache.get(key);
  if (existing && now - existing.at < ttlMs) {
    // Clone so each caller owns an independently-readable body; the cached
    // original is never read directly.
    return existing.promise.then(cloneHarthmereLiveResponseV1);
  }
  const promise = rawHarthmereLiveFetchWithTimeoutV1(fetchImpl, input, init);
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
  return promise.then(cloneHarthmereLiveResponseV1);
}

// Clone the response so concurrent/cached callers each get an independent body.
// Falls back to the original when clone() is unavailable (e.g. a test fetch
// stub), in which case the entry is also evicted above so it is never reused.
function cloneHarthmereLiveResponseV1(response: Response): Response {
  return typeof (response as any).clone === "function"
    ? response.clone()
    : response;
}

// Public entry point used across the Harthmere live adapters. It now coalesces
// idempotent GETs (POSTs and signal-bearing requests pass straight through to
// the raw timeout fetch), so every caller -- including the ones that call this
// directly rather than via defaultHarthmereLiveFetchV1 -- shares the dedupe.
export function fetchHarthmereLiveWithTimeoutV1(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  return coalescedHarthmereLiveFetchV1(fetchImpl, input, init);
}

export function defaultHarthmereLiveFetchV1(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {}
) {
  return fetchHarthmereLiveWithTimeoutV1(fetch, input, init);
}
