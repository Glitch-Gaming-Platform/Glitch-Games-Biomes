export const HARTHMERE_LIVE_READ_TIMEOUT_MS = 8_000;
export const HARTHMERE_LIVE_MUTATION_TIMEOUT_MS = 15_000;

async function rawHarthmereLiveFetchWithTimeout(
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
      ? HARTHMERE_LIVE_MUTATION_TIMEOUT_MS
      : HARTHMERE_LIVE_READ_TIMEOUT_MS);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    try {
      return await fetchImpl(input, {
        ...requestInit,
        signal: controller.signal,
      });
    } catch (error) {
      if (
        controller.signal.aborted &&
        isHarthmereLiveFetchAbortError(error)
      ) {
        return new Response(
          JSON.stringify({
            error: "harthmere_live_fetch_timeout",
            timeoutMs,
          }),
          {
            status: 504,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      throw error;
    }
  } finally {
    clearTimeout(timeout);
  }
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

export function coalescedHarthmereLiveFetch(
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
