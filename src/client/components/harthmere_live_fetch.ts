import { readHarthmereGlitchIdentity } from "@/client/game/glitch/harthmere_glitch_identity";
import { emitHarthmereGlitchBehaviorEvent } from "@/client/game/glitch/harthmere_glitch_behavior_events";
import { humanizeHarthmereGlitchKey } from "@/client/game/glitch/harthmere_glitch_event_catalog";
import {
  HARTHMERE_GLITCH_LIVE_ACTION_BEHAVIORS,
  HARTHMERE_GLITCH_LIVE_OPERATION_BEHAVIORS,
} from "@/client/game/glitch/harthmere_glitch_tracking_manifest";
import type { HarthmereLiveModeActionKind } from "@/shared/harthmere/live_mode_readiness";
import { harthmereBiomesAuthHeaders } from "@/shared/util/harthmere_auth_session";

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

const HARTHMERE_TELEMETRY_PAYLOAD_KEYS = [
  "questId",
  "objectiveId",
  "jobId",
  "postingId",
  "itemId",
  "recipeId",
  "stationId",
  "businessId",
  "businessTypeId",
  "propertyId",
  "plotId",
  "blueprintId",
  "targetId",
  "slot",
  "quantity",
  "count",
  "amount",
  "price",
] as const;

function telemetryKey(value: unknown, fallback: string) {
  const key = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return key || fallback;
}

export function planHarthmereLiveMutationTelemetry(init: RequestInit) {
  if (String(init.method ?? "GET").toUpperCase() !== "POST") return undefined;
  if (typeof init.body !== "string") return undefined;
  try {
    const envelope = JSON.parse(init.body) as Record<string, any>;
    const payload =
      envelope.payload && typeof envelope.payload === "object"
        ? envelope.payload
        : {};
    const actionKind = telemetryKey(envelope.actionKind, "live_action");
    const actionDefinition =
      HARTHMERE_GLITCH_LIVE_ACTION_BEHAVIORS[
        actionKind as HarthmereLiveModeActionKind
      ];
    if (!actionDefinition?.playerBehavior) {
      return undefined;
    }
    const subsystem = telemetryKey(envelope.subsystem, "gameplay");
    const operation = telemetryKey(
      payload.operation ??
        payload.buildingAction ??
        payload.questOperation ??
        actionKind,
      actionKind
    );
    const knownOperation = HARTHMERE_GLITCH_LIVE_OPERATION_BEHAVIORS[operation];
    const known =
      knownOperation ??
      (operation === actionKind ? actionDefinition : undefined);
    const operationLabel = humanizeHarthmereGlitchKey(operation);
    const stepKey =
      known?.stepKey ??
      telemetryKey(`${subsystem}_${operation}`, "live_action");
    const label = known?.label ?? operationLabel;
    const metadata: Record<string, unknown> = {
      action_kind: actionKind,
      subsystem,
      operation,
      zone_id:
        typeof envelope.zoneId === "string" ? envelope.zoneId : undefined,
      target_id:
        typeof envelope.targetId === "string" ? envelope.targetId : undefined,
    };
    for (const key of HARTHMERE_TELEMETRY_PAYLOAD_KEYS) {
      const value = payload[key];
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        metadata[telemetryKey(key, "field")] = value;
      }
    }
    return {
      stepKey,
      label,
      description:
        known?.description ??
        `The player uses ${operationLabel.toLowerCase()}.`,
      metadata,
      sampleIntervalMs: actionDefinition.sampleIntervalMs,
    };
  } catch {
    return undefined;
  }
}

const harthmereLiveTelemetrySampleAt = new Map<string, number>();

function reserveHarthmereLiveTelemetrySample(
  plan: NonNullable<ReturnType<typeof planHarthmereLiveMutationTelemetry>>,
  now = Date.now()
) {
  if (!plan.sampleIntervalMs) return true;
  const key = `${plan.stepKey}:${plan.metadata.action_kind ?? "action"}`;
  const previous = harthmereLiveTelemetrySampleAt.get(key) ?? 0;
  if (now - previous < plan.sampleIntervalMs) return false;
  harthmereLiveTelemetrySampleAt.set(key, now);
  return true;
}

export function resetHarthmereLiveTelemetrySamplesForTest() {
  harthmereLiveTelemetrySampleAt.clear();
}

function firstLiveMutationFailure(body: any) {
  const candidates = [
    ...(Array.isArray(body?.validation?.errors) ? body.validation.errors : []),
    ...(Array.isArray(body?.backendMutation?.warnings)
      ? body.backendMutation.warnings
      : []),
    ...(Array.isArray(body?.warnings) ? body.warnings : []),
  ];
  const failure = candidates.find((value) =>
    /(?:rejected|failed|invalid|denied|error)/i.test(String(value))
  );
  if (!failure) return undefined;
  const raw = String(failure).trim();
  return /^[a-z0-9_:-]+$/i.test(raw)
    ? telemetryKey(raw, "action_failed")
    : "validation_failed";
}

async function fetchWithLiveMutationTelemetry(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number },
  plan: NonNullable<ReturnType<typeof planHarthmereLiveMutationTelemetry>>
) {
  const startedAt = Date.now();
  const sampled = reserveHarthmereLiveTelemetrySample(plan, startedAt);
  if (sampled) {
    emitHarthmereGlitchBehaviorEvent(plan.stepKey, "attempt", plan.metadata, {
      step_label: plan.label,
      step_description: plan.description,
    });
  }
  try {
    const response = await rawHarthmereLiveFetchWithTimeout(
      fetchImpl,
      input,
      init
    );
    let body: any;
    try {
      body = await response.clone().json();
    } catch {
      body = undefined;
    }
    const failureReason = firstLiveMutationFailure(body);
    const succeeded =
      response.ok &&
      body?.ok !== false &&
      body?.backendMutation?.applied !== false &&
      !failureReason;
    if (sampled || !succeeded) {
      emitHarthmereGlitchBehaviorEvent(
        plan.stepKey,
        succeeded ? "success" : "fail",
        {
          ...plan.metadata,
          duration_ms: Date.now() - startedAt,
          http_status: response.status,
          ...(failureReason ? { reason_code: failureReason } : {}),
        },
        {
          step_label: plan.label,
          step_description: plan.description,
        }
      );
    }
    return response;
  } catch (error) {
    emitHarthmereGlitchBehaviorEvent(
      plan.stepKey,
      "fail",
      {
        ...plan.metadata,
        duration_ms: Date.now() - startedAt,
        reason_code: "network_error",
      },
      {
        step_label: plan.label,
        step_description: plan.description,
      }
    );
    throw error;
  }
}

function isHarthmereLiveApiPath(pathname: string) {
  return (
    pathname === HARTHMERE_LIVE_API_PATH ||
    pathname.startsWith(`${HARTHMERE_LIVE_API_PATH}_`)
  );
}

function isHarthmereApiPath(pathname: string) {
  return (
    pathname === "/api/harthmere" || pathname.startsWith("/api/harthmere/")
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
  if (!isHarthmereApiPath(url.pathname)) {
    return { input, init };
  }
  const location = currentWindowLocation();
  if (location?.origin && url.origin !== location.origin) {
    return { input, init };
  }
  const isLiveApiRequest = isHarthmereLiveApiPath(url.pathname);
  let nextInit = init;
  const method = String(nextInit.method ?? "GET").toUpperCase();
  if (isLiveApiRequest && method === "GET") {
    // Live state reads are already coalesced in-memory above. Browser/HTTP
    // caching can replay stale 304 snapshots after a mutation, so always
    // read these Cloud Save projections from the backend source.
    nextInit = { ...nextInit, cache: "no-store" };
  }
  const nextHeaders = new Headers(
    nextInit.headers ?? (isRequestInput(input) ? input.headers : undefined)
  );
  if (isLiveApiRequest && method === "GET") {
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
  // Glitch's install id selects the portable per-player live-mode/Cloud Save
  // projection. It is not an ECS credential. Native ECS APIs instead require
  // the authenticated Biomes user/session pair created by the Glitch login
  // bridge. Keep both identities on live-mode requests, and only the Biomes
  // session on other same-origin Harthmere APIs. The helper deliberately
  // returns no credentials for cross-origin URLs.
  for (const [key, value] of Object.entries(harthmereBiomesAuthHeaders(url))) {
    if (!nextHeaders.has(key)) {
      nextHeaders.set(key, value);
    }
  }
  if (isLiveApiRequest) {
    const installId = resolveHarthmereLiveInstallId(url);
    if (installId && !url.searchParams.has("install_id")) {
      url.searchParams.set("install_id", installId);
    }
    if (installId && !nextHeaders.has(HARTHMERE_LIVE_INSTALL_HEADER)) {
      nextHeaders.set(HARTHMERE_LIVE_INSTALL_HEADER, installId);
    }
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
  settledAt?: number;
  promise: Promise<Response>;
}

const globalForHarthmereLiveFetchCache = globalThis as typeof globalThis & {
  __harthmereLiveFetchCache?: Map<string, HarthmereLiveFetchCacheEntry>;
  __harthmereLiveMutationLocks?: Map<string, Promise<unknown>>;
  __harthmereLiveMutationQueues?: Map<string, Promise<void>>;
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

function harthmereLiveMutationLocks() {
  return (globalForHarthmereLiveFetchCache.__harthmereLiveMutationLocks ??=
    new Map<string, Promise<unknown>>());
}

// UI surfaces can independently dispatch the same semantic mutation while the
// first request is still pending (double-click, Enter + click, retrying React
// handlers). Request IDs alone cannot dedupe that because every handler call
// creates a new ID. Keep one promise per semantic action until it settles so
// callers share the authoritative result rather than producing a mutation
// storm.
export function runHarthmereLiveMutationOnce<T>(
  key: string,
  operation: () => Promise<T>
): Promise<T> {
  const locks = harthmereLiveMutationLocks();
  const existing = locks.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = operation();
  locks.set(key, promise);
  const cleanup = () => {
    if (locks.get(key) === promise) locks.delete(key);
  };
  void promise.then(cleanup, cleanup);
  return promise;
}

export function resetHarthmereLiveMutationLocksForTest() {
  harthmereLiveMutationLocks().clear();
  globalForHarthmereLiveFetchCache.__harthmereLiveMutationQueues?.clear();
}

function harthmereLiveMutationQueues() {
  return (globalForHarthmereLiveFetchCache.__harthmereLiveMutationQueues ??=
    new Map<string, Promise<void>>());
}

// Ordered state-changing actions for one actor must reach the server in the
// same order the player performed them. In particular, crate -> equip -> quest
// and inventory debit -> world drop cannot safely race one another and then
// depend on HTTP completion order. The server remains authoritative; this
// queue only prevents avoidable same-browser contention and timeout retries.
export function runHarthmereLiveMutationSerially<T>(
  scope: string,
  operation: () => Promise<T>
): Promise<T> {
  const queues = harthmereLiveMutationQueues();
  const previous = queues.get(scope);
  // Preserve the old call-site contract: the first mutation starts during the
  // current turn (several UI tests and loading indicators observe that), while
  // later mutations wait for its settled tail.
  const result = previous
    ? previous.catch(() => {}).then(operation)
    : operation();
  const tail = result.then(
    () => {},
    () => {}
  );
  queues.set(scope, tail);
  void tail.finally(() => {
    if (queues.get(scope) === tail) queues.delete(scope);
  });
  return result;
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
  const liveMutationTelemetry = planHarthmereLiveMutationTelemetry(init);
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
    return liveMutationTelemetry
      ? fetchWithLiveMutationTelemetry(
          fetchImpl,
          input,
          init,
          liveMutationTelemetry
        )
      : rawHarthmereLiveFetchWithTimeout(fetchImpl, input, init);
  }
  const key = plan.key;
  const cache = harthmereLiveFetchCache();
  const nowMs = options.nowMs ?? Date.now;
  const ttlMs = options.ttlMs ?? HARTHMERE_LIVE_FETCH_COALESCE_TTL_MS;
  const now = nowMs();
  const existing = cache.get(key);
  // A slow request must remain the single in-flight request for this URL even
  // after the short response-reuse TTL expires. The old implementation aged a
  // still-pending promise out after one second, so every poller started another
  // 20-second request behind it. Production then accumulated dozens of
  // identical inventory/status reads and amplified an ordinary slowdown into a
  // request storm. TTL applies only after the request settles.
  if (
    existing &&
    (existing.settledAt === undefined || now - existing.settledAt < ttlMs)
  ) {
    // Clone so each caller owns an independently-readable body; the cached
    // original is never read directly.
    return existing.promise.then(cloneHarthmereLiveResponse);
  }
  const promise = rawHarthmereLiveFetchWithTimeout(fetchImpl, input, init);
  const entry: HarthmereLiveFetchCacheEntry = { at: now, promise };
  cache.set(key, entry);
  // Never let a rejection, an error response (non-2xx), or a response that
  // cannot be cloned (so it cannot be safely shared) linger in the cache.
  promise
    .then((response) => {
      entry.settledAt = nowMs();
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
