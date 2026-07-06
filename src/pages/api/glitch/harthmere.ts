import crypto from "crypto";
import type { IncomingMessage, ServerResponse } from "http";
import type { NextApiRequest, NextApiResponse } from "next";

import { ensurePlayerExists } from "@/server/logic/utils/players";
import { connectToRedis } from "@/server/shared/redis/connection";
import {
  connectForeignAuth,
  findLinkForForeignAuth,
} from "@/server/shared/auth/auth_link";
import { setAuthCookies } from "@/server/shared/auth/cookies";
import type { ForeignAccountProfile } from "@/server/shared/auth/types";
import type { WebServerRequest } from "@/server/web/context";
import {
  getUserOrCreateIfNotExists,
  saveUsername as saveUsernameToDb,
} from "@/server/web/db/users";
import { findUniqueByUsername } from "@/server/web/db/users_fetch";
import {
  isGeneratedPlaceholderUsername,
  preferredGlitchDisplayUsername,
} from "@/server/web/util/username";
import { BIOMES_GAME_NAME } from "@/shared/biomes/display_names";
import {
  harthmereLiveModeInstallGameUserLinkKey,
  harthmereLiveModeInstallLinkKey,
} from "@/shared/harthmere/live_mode_actor_identity";
import { parseBiomesId, type BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import { Timer } from "@/shared/metrics/timer";
import {
  harthmereCloudSaveForeignAuthCandidateIds,
  harthmereCloudSaveForeignAuthPrimaryId,
  harthmereHasStableGlitchAccount,
} from "@/server/shared/glitch/harthmere_cloud_save_identity";
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

const DEFAULT_GLITCH_API_BASE_URL = "https://api.glitch.fun/api";
const DEFAULT_HARTHMERE_TITLE_ID = "42de534c-600f-4228-af9e-b69faef94cce";
const DEFAULT_IDLE_SESSION_MS = 2 * 60 * 1000;
const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_VALIDATE_CACHE_MS = 60 * 1000;
const DEFAULT_GLITCH_API_TIMEOUT_MS = 10 * 1000;
const DEFAULT_GLITCH_TELEMETRY_TIMEOUT_MS = 2500;
const DEFAULT_GLITCH_API_SLOW_MS = 1500;
const DEFAULT_HARTHMERE_ROUTE_SLOW_MS = 1500;
const GLITCH_HARTHMERE_SESSION_REDIS_PREFIX = "glitch:harthmere:current";
const GLITCH_HARTHMERE_ASYNC_OUTBOX_KEY =
  "glitch:harthmere:current:async_api_outbox";

export type JsonMap = Record<string, any>;
type GlitchProxyResponse = {
  ok: boolean;
  status?: number;
  json?: any;
  disabled?: boolean;
  reason?: string;
};
type QueuedGlitchApiCall = {
  path: string;
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  label?: string;
  enqueuedAtMs: number;
};

export type HarthmereValidatedIdentity = {
  valid: boolean;
  // True when the install resolves to NO stable Glitch account (a guest). Guests
  // may play the entire game but get an ephemeral, unlinked biomes user and never
  // cloud-save (Glitch itself returns GUEST_NOT_ALLOWED for their saves).
  guest: boolean;
  titleId: string;
  installId: string;
  gameUserId: string;
  glitchUserId?: string;
  userName: string;
  licenseType?: string;
  raw: any;
};

type HarthmereServerSession = {
  serverSessionId: string;
  titleId: string;
  installId: string;
  clientSessionId?: string;
  gameUserId: string;
  glitchUserId?: string;
  userName: string;
  createdAtMs: number;
  lastSeenAtMs: number;
  disconnectedAtMs?: number;
  disconnectedReason?: string;
};

type HarthmereCachedValidation = {
  identity: HarthmereValidatedIdentity;
  expiresAtMs: number;
};

type HarthmereSessionStore = {
  sessionsById: Map<string, HarthmereServerSession>;
  validationsByKey: Map<string, HarthmereCachedValidation>;
};

const globalForHarthmere = globalThis as typeof globalThis & {
  __harthmereGlitchSessionStore?: HarthmereSessionStore;
  __harthmereGlitchSessionRedis?: ReturnType<typeof connectToRedis>;
  __harthmereGlitchAsyncOutboxDrain?: boolean;
  __harthmereGlitchTelemetryAuthBackoffUntil?: number;
};

const sessionStore: HarthmereSessionStore =
  globalForHarthmere.__harthmereGlitchSessionStore ??
  (globalForHarthmere.__harthmereGlitchSessionStore = {
    sessionsById: new Map<string, HarthmereServerSession>(),
    validationsByKey: new Map<string, HarthmereCachedValidation>(),
  });

// Backfill older hot-reloaded/global stores that were created before the
// validation cache existed.
sessionStore.validationsByKey ??= new Map<string, HarthmereCachedValidation>();

function harthmereGlitchRedis() {
  return (globalForHarthmere.__harthmereGlitchSessionRedis ??=
    connectToRedis("firehose"));
}

function envString(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function envNumber(name: string, fallback: number) {
  const value = Number(envString(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function glitchApiBaseUrl() {
  return (
    envString("GLITCH_API_BASE_URL") ?? DEFAULT_GLITCH_API_BASE_URL
  ).replace(/\/+$/, "");
}

function configuredTitleId() {
  return envString("GLITCH_TITLE_ID") ?? DEFAULT_HARTHMERE_TITLE_ID;
}

function configuredTitleToken() {
  return envString("GLITCH_TITLE_TOKEN");
}

function idleSessionMs() {
  return envNumber("GLITCH_IDLE_SESSION_MS", DEFAULT_IDLE_SESSION_MS);
}

function sessionTtlMs() {
  return envNumber("GLITCH_SESSION_TTL_MS", DEFAULT_SESSION_TTL_MS);
}

function validateCacheMs() {
  return envNumber("GLITCH_VALIDATE_CACHE_MS", DEFAULT_VALIDATE_CACHE_MS);
}

function glitchApiTimeoutMs() {
  return envNumber("GLITCH_API_TIMEOUT_MS", DEFAULT_GLITCH_API_TIMEOUT_MS);
}

function glitchTelemetryTimeoutMs() {
  return envNumber(
    "GLITCH_TELEMETRY_TIMEOUT_MS",
    DEFAULT_GLITCH_TELEMETRY_TIMEOUT_MS
  );
}

function glitchApiSlowMs() {
  return envNumber("GLITCH_API_SLOW_MS", DEFAULT_GLITCH_API_SLOW_MS);
}

function harthmereRouteSlowMs() {
  return envNumber(
    "GLITCH_HARTHMERE_ROUTE_SLOW_MS",
    DEFAULT_HARTHMERE_ROUTE_SLOW_MS
  );
}

export function shouldRunGlitchHarthmereOperationAsync(
  op: string,
  env = process.env
) {
  if (env.GLITCH_HARTHMERE_ASYNC_API_OPS === "0") {
    return false;
  }
  return new Set([
    "heartbeatInstall",
    "submitProgression",
    "recordEvent",
    "recordEvents",
  ]).has(op);
}

export function shouldUseRedisHarthmereSessionStore(env = process.env) {
  if (env.GLITCH_HARTHMERE_SESSION_STORE === "memory") {
    return false;
  }
  return (
    env.GLITCH_HARTHMERE_SESSION_STORE === "redis" ||
    env.GLITCH_RUNTIME === "1" ||
    Boolean(env.GLITCH_REDIS_HOST || env.LOCAL_REDIS_HOST || env.REDIS_HOST)
  );
}

function validationCacheKey(titleId: string, installId: string) {
  return `${titleId}:${installId}`;
}

function validationRedisKey(cacheKey: string) {
  return `${GLITCH_HARTHMERE_SESSION_REDIS_PREFIX}:validation:${cacheKey}`;
}

function sessionRedisKey(serverSessionId: string) {
  return `${GLITCH_HARTHMERE_SESSION_REDIS_PREFIX}:session:${serverSessionId}`;
}

function sessionUserIndexRedisKey(titleId: string, gameUserId: string) {
  const digest = crypto
    .createHash("sha1")
    .update(`${titleId}:${gameUserId}`)
    .digest("hex");
  return `${GLITCH_HARTHMERE_SESSION_REDIS_PREFIX}:sessions_by_user:${digest}`;
}

async function readJsonFromRedis<T>(key: string): Promise<T | undefined> {
  if (!shouldUseRedisHarthmereSessionStore()) {
    return undefined;
  }
  try {
    const redis = await harthmereGlitchRedis();
    const raw = await redis.primary.get(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch (error) {
    log.warn("GLITCH_HARTHMERE_REDIS_SESSION_READ_FAILED", { key, error });
    return undefined;
  }
}

async function setJsonInRedis(key: string, value: unknown, ttlSeconds: number) {
  if (!shouldUseRedisHarthmereSessionStore()) {
    return;
  }
  try {
    const redis = await harthmereGlitchRedis();
    await redis.primary.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    log.warn("GLITCH_HARTHMERE_REDIS_SESSION_WRITE_FAILED", { key, error });
  }
}

async function setStringInRedis(
  key: string,
  value: string,
  ttlSeconds?: number
) {
  if (!shouldUseRedisHarthmereSessionStore()) {
    return;
  }
  try {
    const redis = await harthmereGlitchRedis();
    if (ttlSeconds !== undefined) {
      await redis.primary.set(key, value, "EX", ttlSeconds);
    } else {
      await redis.primary.set(key, value);
    }
  } catch (error) {
    log.warn("GLITCH_HARTHMERE_REDIS_STRING_WRITE_FAILED", { key, error });
  }
}

async function deleteRedisKey(key: string) {
  if (!shouldUseRedisHarthmereSessionStore()) {
    return;
  }
  try {
    const redis = await harthmereGlitchRedis();
    await redis.primary.del(key);
  } catch (error) {
    log.warn("GLITCH_HARTHMERE_REDIS_SESSION_DELETE_FAILED", { key, error });
  }
}

function allowLocalDevInstallIdentity(installId: string) {
  if (configuredTitleToken()) {
    return false;
  }

  const nodeEnv = process.env.NODE_ENV ?? "";
  const runtime =
    process.env.GLITCH_RUNTIME ?? process.env.NEXT_PUBLIC_GLITCH_RUNTIME ?? "";
  const forceLocalTown = process.env.BIOMES_FORCE_LOCAL_DEV_TOWN === "1";

  return (
    nodeEnv !== "production" ||
    runtime === "local" ||
    forceLocalTown ||
    installId.startsWith("local-")
  );
}

function makeLocalDevValidatedIdentity(
  titleId: string,
  installId: string
): HarthmereValidatedIdentity {
  const hash = crypto
    .createHash("sha1")
    .update(`${titleId}:${installId}`)
    .digest("hex")
    .slice(0, 12);

  const userName = `Local${hash}`.slice(0, 20);
  // Local-dev installs have no real Glitch account, but we still want durable
  // saves while developing. Give them a STABLE synthetic glitch user id derived
  // from the install so they resolve to a real (non-guest) account scope instead
  // of falling into the guest/no-save path that real production guests get.
  const localDevGlitchUserId = `localdev-${hash}`;

  return {
    valid: true,
    guest: false,
    titleId,
    installId,
    gameUserId: `glitch:${localDevGlitchUserId}`,
    glitchUserId: localDevGlitchUserId,
    userName,
    licenseType: "local_dev",
    raw: {
      ok: true,
      valid: true,
      local_dev: true,
      disabled: false,
      reason: "local_dev_missing_title_token_fallback",
      title_id: titleId,
      install_id: installId,
      game_user_id: `install:${installId}`,
      user_name: userName,
      username: userName,
      license_type: "local_dev",
    },
  };
}

function titleIdFromBody(body: JsonMap) {
  const requested =
    typeof body.title_id === "string" ? body.title_id.trim() : "";
  const configured = configuredTitleId();
  if (requested && requested !== configured) {
    throw new Error("TITLE_ID_MISMATCH");
  }
  return configured;
}

function installIdFromBody(body: JsonMap) {
  const installId =
    typeof body.install_id === "string" ? body.install_id.trim() : "";
  if (!installId) {
    throw new Error("MISSING_INSTALL_ID");
  }
  return installId;
}

function requireServerConfig() {
  const token = configuredTitleToken();
  if (!token) {
    return undefined;
  }
  return token;
}

async function callGlitchApi(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    query?: URLSearchParams;
    timeoutMs?: number;
    label?: string;
  } = {}
): Promise<GlitchProxyResponse> {
  const token = requireServerConfig();
  if (!token) {
    return {
      ok: true,
      disabled: true,
      reason: "missing_server_title_token",
    };
  }

  const url = `${glitchApiBaseUrl()}${path}${
    options.query ? `?${options.query.toString()}` : ""
  }`;
  const timeoutMs = options.timeoutMs ?? glitchApiTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof (timeout as any).unref === "function") {
    (timeout as any).unref();
  }
  const timer = new Timer();
  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    const text = await response.text();
    let json: any = undefined;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
    }

    const ms = timer.elapsed;
    if (ms >= glitchApiSlowMs() || !response.ok) {
      log.warn("GLITCH_API_CALL_SLOW_OR_ERROR", {
        label: options.label,
        method: options.method ?? "GET",
        path: redactedGlitchApiPathForLog(path),
        status: response.status,
        ms,
        timeoutMs,
      });
    }

    return {
      ok: response.ok,
      status: response.status,
      json,
    };
  } catch (error: any) {
    const timedOut = controller.signal.aborted || error?.name === "AbortError";
    const ms = timer.elapsed;
    const status = timedOut ? 504 : 502;
    log.warn("GLITCH_API_CALL_FAILED", {
      label: options.label,
      method: options.method ?? "GET",
      path: redactedGlitchApiPathForLog(path),
      status,
      ms,
      timeoutMs,
      error: error?.message ?? String(error),
      timedOut,
    });
    return {
      ok: false,
      status,
      json: {
        ok: false,
        error: timedOut ? "GLITCH_API_TIMEOUT" : "GLITCH_API_REQUEST_FAILED",
        message: timedOut
          ? `Glitch API timed out after ${timeoutMs}ms`
          : error?.message ?? String(error),
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

function kickGlitchAsyncOutboxDrain() {
  if (globalForHarthmere.__harthmereGlitchAsyncOutboxDrain) {
    return;
  }
  globalForHarthmere.__harthmereGlitchAsyncOutboxDrain = true;
  setImmediate(async () => {
    try {
      await drainGlitchAsyncOutbox();
    } finally {
      globalForHarthmere.__harthmereGlitchAsyncOutboxDrain = false;
    }
  });
}

async function enqueueGlitchApiCall(
  call: Omit<QueuedGlitchApiCall, "enqueuedAtMs">
) {
  const telemetryBackoffMs = isBehaviorTelemetryCall(call)
    ? behaviorTelemetryAuthBackoffRemainingMs()
    : 0;
  if (telemetryBackoffMs > 0) {
    return {
      ok: true,
      queued: false,
      skipped: true,
      reason: "behavior_telemetry_auth_backoff",
      retry_after_ms: telemetryBackoffMs,
    };
  }
  const queued: QueuedGlitchApiCall = {
    ...call,
    enqueuedAtMs: Date.now(),
  };
  if (!configuredTitleToken()) {
    return {
      ok: true,
      queued: false,
      skipped: true,
      reason: "missing_server_title_token",
    };
  }
  if (shouldUseRedisHarthmereSessionStore()) {
    try {
      const redis = await harthmereGlitchRedis();
      await redis.primary.rpush(
        GLITCH_HARTHMERE_ASYNC_OUTBOX_KEY,
        JSON.stringify(queued)
      );
      kickGlitchAsyncOutboxDrain();
      return { ok: true, queued: true };
    } catch (error) {
      log.warn("GLITCH_HARTHMERE_ASYNC_OUTBOX_ENQUEUE_FAILED", {
        error,
        label: call.label,
      });
    }
  }

  setImmediate(() => {
    void callGlitchApi(queued.path, {
      label: queued.label,
      method: queued.method,
      body: queued.body,
      timeoutMs: queued.timeoutMs,
    }).then((response) => {
      if (isBehaviorTelemetryCall(queued)) {
        noteBehaviorTelemetryAuthFailure(response.status);
      }
    });
  });
  return { ok: true, queued: false, background: true };
}

async function drainGlitchAsyncOutbox() {
  if (!shouldUseRedisHarthmereSessionStore()) {
    return;
  }
  const redis = await harthmereGlitchRedis();
  const maxPerDrain = Math.max(
    1,
    Math.trunc(
      Number(process.env.GLITCH_HARTHMERE_ASYNC_OUTBOX_DRAIN_MAX ?? 25)
    )
  );
  for (let i = 0; i < maxPerDrain; i += 1) {
    const raw = await redis.primary.lpop(GLITCH_HARTHMERE_ASYNC_OUTBOX_KEY);
    if (!raw) {
      break;
    }
    let queued: QueuedGlitchApiCall | undefined;
    try {
      queued = JSON.parse(raw) as QueuedGlitchApiCall;
    } catch (error) {
      log.warn("GLITCH_HARTHMERE_ASYNC_OUTBOX_BAD_ITEM", { error });
      continue;
    }
    if (
      isBehaviorTelemetryCall(queued) &&
      behaviorTelemetryAuthBackoffRemainingMs() > 0
    ) {
      continue;
    }
    const response = await callGlitchApi(queued.path, {
      label: queued.label,
      method: queued.method,
      body: queued.body,
      timeoutMs: queued.timeoutMs,
    });
    if (isBehaviorTelemetryCall(queued)) {
      noteBehaviorTelemetryAuthFailure(response.status);
    }
  }
}

export function redactedGlitchApiPathForLog(path: string) {
  return path
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ":uuid"
    )
    .replace(/install:[^/]+/g, "install::id")
    .slice(0, 512);
}

function collectionData(raw: any): any[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (Array.isArray(raw?.data)) {
    return raw.data;
  }
  return [];
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

function isGuestLikeString(value: unknown) {
  if (typeof value !== "string") return false;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
  return (
    normalized === "guest" ||
    normalized === "guest_user" ||
    normalized === "anonymous" ||
    normalized === "anonymous_user" ||
    normalized === "anon" ||
    normalized === "0"
  );
}

function truthyGuestFlag(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function looksLikeGuestIdentity(root: any, user: any, install: any) {
  if (
    truthyGuestFlag(root?.is_guest) ||
    truthyGuestFlag(root?.guest) ||
    truthyGuestFlag(root?.isGuest) ||
    truthyGuestFlag(user?.is_guest) ||
    truthyGuestFlag(user?.guest) ||
    truthyGuestFlag(install?.is_guest) ||
    truthyGuestFlag(install?.guest)
  ) {
    return true;
  }

  const kind = firstString(
    root?.account_type,
    root?.accountType,
    root?.user_type,
    root?.userType,
    root?.license_type,
    root?.licenseType,
    user?.account_type,
    user?.user_type,
    install?.account_type,
    install?.user_type
  );
  if (isGuestLikeString(kind)) {
    return true;
  }

  const candidateUserId = firstString(
    root?.glitch_user_id,
    root?.user_id,
    root?.userId,
    root?.glitchUserId,
    user?.glitch_user_id,
    user?.user_id,
    user?.userId,
    user?.id,
    install?.user_id,
    install?.glitch_user_id
  );
  if (isGuestLikeString(candidateUserId)) {
    return true;
  }

  const candidateName = firstString(
    root?.user_name,
    root?.username,
    root?.display_name,
    root?.name,
    user?.user_name,
    user?.username,
    user?.display_name,
    user?.name,
    install?.user_name,
    install?.username
  );
  return !candidateUserId && isGuestLikeString(candidateName);
}

function stableGuestUsernameSuffix(identity: HarthmereValidatedIdentity) {
  return crypto
    .createHash("sha1")
    .update(`${identity.titleId}:${identity.installId}:${identity.gameUserId}`)
    .digest("hex")
    .slice(0, 10);
}

function normalizeIdentityFromValidateResponse(
  titleId: string,
  installId: string,
  raw: any
): HarthmereValidatedIdentity {
  const root = raw?.data ?? raw ?? {};
  const user =
    root.user ??
    root.glitch_user ??
    root.player ??
    root.account ??
    raw?.user ??
    {};
  const install = root.install ?? raw?.install ?? {};
  const responseValid =
    root.valid === true ||
    root.ok === true ||
    raw?.valid === true ||
    raw?.ok === true ||
    Boolean(
      root.user ||
        root.user_id ||
        root.username ||
        root.user_name ||
        install.user_id
    );

  const guestIdentity = looksLikeGuestIdentity(root, user, install);
  const valid = responseValid && !guestIdentity;
  const rawGlitchUserId = firstString(
    root.glitch_user_id,
    root.user_id,
    root.userId,
    root.glitchUserId,
    user.glitch_user_id,
    user.user_id,
    user.userId,
    user.id,
    install.user_id,
    install.glitch_user_id
  );
  const glitchUserId =
    guestIdentity || isGuestLikeString(rawGlitchUserId)
      ? undefined
      : rawGlitchUserId;
  const userName =
    firstString(
      root.user_name,
      root.username,
      root.display_name,
      root.name,
      user.user_name,
      user.username,
      user.display_name,
      user.name,
      install.user_name,
      install.username
    ) ?? "Guest";

  const responseGameUserId = firstString(
    root.game_user_id,
    root.gameUserId,
    install.game_user_id,
    install.gameUserId
  );
  const gameUserId =
    !guestIdentity && glitchUserId
      ? `glitch:${glitchUserId}`
      : !guestIdentity &&
        responseGameUserId &&
        !isGuestLikeString(responseGameUserId)
      ? responseGameUserId
      : `install:${installId}`;

  // A guest is any install that does NOT resolve to a stable Glitch account
  // (explicit guest markers, or simply no glitch user id and no stable account
  // name). Guests can play but never cloud-save.
  const guest =
    guestIdentity ||
    !harthmereHasStableGlitchAccount({
      titleId,
      installId,
      glitchUserId,
      userName,
    });

  return {
    valid,
    guest,
    titleId,
    installId,
    gameUserId,
    glitchUserId,
    userName,
    licenseType:
      firstString(
        root.license_type,
        root.licenseType,
        install.license_type,
        install.licenseType
      ) ?? (guestIdentity ? "guest_not_allowed" : undefined),
    raw,
  };
}

function validationJson(identity: HarthmereValidatedIdentity) {
  return {
    ...(identity.raw && typeof identity.raw === "object" ? identity.raw : {}),
    ok: true,
    valid: identity.valid,
    guest: identity.guest,
    cloud_save: !identity.guest,
    title_id: identity.titleId,
    install_id: identity.installId,
    game_user_id: identity.gameUserId,
    glitch_user_id: identity.glitchUserId,
    user_id: identity.glitchUserId,
    user_name: identity.userName,
    username: identity.userName,
    license_type: identity.licenseType,
    reason: identity.valid ? undefined : "GUEST_NOT_ALLOWED",
  };
}

async function createOrResumeInstallWithGlitch(titleId: string, body: JsonMap) {
  const installId = installIdFromBody(body);
  const response = await callGlitchApi(
    `/titles/${encodeURIComponent(titleId)}/installs`,
    {
      label: "createOrResumeInstall",
      method: "POST",
      body: {
        user_install_id: installId,
        session_id:
          firstString(body.session_id, body.client_session_id) ?? installId,
        analytics_session_id: firstString(body.analytics_session_id),
        fingerprint_id: firstString(body.fingerprint_id),
        device_id: firstString(body.device_id) ?? installId,
        platform: body.platform ?? "web",
        device_type: body.device_type,
        operating_system: body.operating_system,
        game_version: body.game_version ?? "harthmere-glitch",
        referral_source: body.referral_source ?? "other",
        first_party_cookie: body.first_party_cookie,
        advertising_id: body.advertising_id,
        consent_given: body.consent_given,
        consent_version: body.consent_version,
        exclude_from_conversion: body.exclude_from_conversion,
      },
    }
  );
  return response;
}

async function getCachedValidation(cacheKey: string) {
  const local = sessionStore.validationsByKey.get(cacheKey);
  if (local && local.expiresAtMs > Date.now()) {
    return local;
  }
  if (local) {
    sessionStore.validationsByKey.delete(cacheKey);
  }
  const redis = await readJsonFromRedis<HarthmereCachedValidation>(
    validationRedisKey(cacheKey)
  );
  if (redis && redis.expiresAtMs > Date.now()) {
    sessionStore.validationsByKey.set(cacheKey, redis);
    return redis;
  }
  return undefined;
}

async function setCachedValidation(
  cacheKey: string,
  cached: HarthmereCachedValidation
) {
  sessionStore.validationsByKey.set(cacheKey, cached);
  await setJsonInRedis(
    validationRedisKey(cacheKey),
    cached,
    Math.max(1, Math.ceil((cached.expiresAtMs - Date.now()) / 1000))
  );
}

async function deleteCachedValidation(cacheKey: string) {
  sessionStore.validationsByKey.delete(cacheKey);
  await deleteRedisKey(validationRedisKey(cacheKey));
}

async function validateInstallWithGlitch(titleId: string, body: JsonMap) {
  const installId = installIdFromBody(body);
  const cacheKey = validationCacheKey(titleId, installId);
  const cached = await getCachedValidation(cacheKey);
  if (cached) {
    return {
      response: { ok: true, json: validationJson(cached.identity) },
      identity: cached.identity,
    };
  }

  if (allowLocalDevInstallIdentity(installId)) {
    const identity = makeLocalDevValidatedIdentity(titleId, installId);
    await setCachedValidation(cacheKey, {
      identity,
      expiresAtMs: Date.now() + validateCacheMs(),
    });
    return {
      response: { ok: true, json: validationJson(identity) },
      identity,
    };
  }

  const installResponse = await createOrResumeInstallWithGlitch(titleId, body);
  if ((installResponse as any).disabled) {
    return { response: installResponse, identity: undefined };
  }
  if (!installResponse.ok) {
    log.warn("GLITCH_INSTALL_CREATE_OR_RESUME_FAILED", {
      titleId,
      installId,
      status: installResponse.status,
      response: installResponse.json,
    });
  }

  const response = await callGlitchApi(
    `/titles/${encodeURIComponent(titleId)}/installs/${encodeURIComponent(
      installId
    )}/validate`,
    {
      label: "validateInstall",
      method: "POST",
      body: {
        fingerprint_id: body.fingerprint_id,
        device_id: body.device_id,
        platform: body.platform ?? "web",
      },
    }
  );
  if ((response as any).disabled) {
    return { response, identity: undefined };
  }
  if (!response.ok) {
    await deleteCachedValidation(cacheKey);
    return { response, identity: undefined };
  }

  const identity = normalizeIdentityFromValidateResponse(
    titleId,
    installId,
    response.json
  );
  if (identity.valid) {
    await setCachedValidation(cacheKey, {
      identity,
      expiresAtMs: Date.now() + validateCacheMs(),
    });
  }

  return {
    response,
    identity,
  };
}

async function getSession(serverSessionId: string) {
  const local = sessionStore.sessionsById.get(serverSessionId);
  if (local) {
    return local;
  }
  const redis = await readJsonFromRedis<HarthmereServerSession>(
    sessionRedisKey(serverSessionId)
  );
  if (redis) {
    sessionStore.sessionsById.set(serverSessionId, redis);
  }
  return redis;
}

async function setSession(session: HarthmereServerSession) {
  const ttlSeconds = Math.max(1, Math.ceil(sessionTtlMs() / 1000));
  sessionStore.sessionsById.set(session.serverSessionId, session);
  await setJsonInRedis(
    sessionRedisKey(session.serverSessionId),
    session,
    ttlSeconds
  );
  if (shouldUseRedisHarthmereSessionStore()) {
    try {
      const redis = await harthmereGlitchRedis();
      const indexKey = sessionUserIndexRedisKey(
        session.titleId,
        session.gameUserId
      );
      await redis.primary.sadd(indexKey, session.serverSessionId);
      await redis.primary.expire(indexKey, ttlSeconds);
    } catch (error) {
      log.warn("GLITCH_HARTHMERE_REDIS_SESSION_INDEX_WRITE_FAILED", {
        error,
        serverSessionId: session.serverSessionId,
      });
    }
  }
}

async function pruneExpiredSessions(now = Date.now()) {
  const ttl = sessionTtlMs();
  for (const [id, session] of sessionStore.sessionsById) {
    if (now - session.lastSeenAtMs > ttl) {
      sessionStore.sessionsById.delete(id);
      await deleteRedisKey(sessionRedisKey(id));
    }
  }
}

async function sessionIdsForUser(session: HarthmereServerSession) {
  const ids = new Set<string>();
  for (const candidate of sessionStore.sessionsById.values()) {
    if (
      candidate.titleId === session.titleId &&
      candidate.gameUserId === session.gameUserId
    ) {
      ids.add(candidate.serverSessionId);
    }
  }
  if (shouldUseRedisHarthmereSessionStore()) {
    try {
      const redis = await harthmereGlitchRedis();
      const redisIds = await redis.primary.smembers(
        sessionUserIndexRedisKey(session.titleId, session.gameUserId)
      );
      for (const id of redisIds) ids.add(id);
    } catch (error) {
      log.warn("GLITCH_HARTHMERE_REDIS_SESSION_INDEX_READ_FAILED", {
        error,
        serverSessionId: session.serverSessionId,
      });
    }
  }
  return [...ids];
}

async function disconnectIdleSessionsForUser(current: HarthmereServerSession) {
  const now = Date.now();
  const idleMs = idleSessionMs();
  const disconnected: HarthmereServerSession[] = [];
  for (const sessionId of await sessionIdsForUser(current)) {
    const session = await getSession(sessionId);
    if (!session) continue;
    if (session.serverSessionId === current.serverSessionId) continue;
    if (session.titleId !== current.titleId) continue;
    if (session.gameUserId !== current.gameUserId) continue;
    if (session.disconnectedAtMs) continue;
    if (now - session.lastSeenAtMs >= idleMs) {
      session.disconnectedAtMs = now;
      session.disconnectedReason = "new_login_replaced_idle_session";
      await setSession(session);
      disconnected.push(session);
    }
  }
  return disconnected;
}

async function claimServerSession(
  identity: HarthmereValidatedIdentity,
  body: JsonMap
) {
  const now = Date.now();
  await pruneExpiredSessions(now);
  const serverSessionId = crypto.randomUUID();
  const session: HarthmereServerSession = {
    serverSessionId,
    titleId: identity.titleId,
    installId: identity.installId,
    clientSessionId: firstString(body.session_id, body.client_session_id),
    gameUserId: identity.gameUserId,
    glitchUserId: identity.glitchUserId,
    userName: identity.userName,
    createdAtMs: now,
    lastSeenAtMs: now,
  };
  await setSession(session);
  const disconnected = await disconnectIdleSessionsForUser(session);
  return { session, disconnected };
}

function decodeSavePayload(save: any) {
  if (!save?.payload || typeof save.payload !== "string") {
    return undefined;
  }
  try {
    const text = Buffer.from(save.payload, "base64").toString("utf8");
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function makeSavePayload(snapshot: unknown) {
  const json = JSON.stringify(snapshot ?? {});
  const bytes = Buffer.from(json, "utf8");
  return {
    payload: bytes.toString("base64"),
    checksum: crypto.createHash("sha256").update(bytes).digest("hex"),
    size_bytes: bytes.byteLength,
  };
}

function biomesUserIdFromDecodedSavePayload(
  decodedPayload: unknown
): BiomesId | undefined {
  const raw = firstString(
    (decodedPayload as any)?.identity?.biomesUserId,
    (decodedPayload as any)?.identity?.biomes_user_id,
    (decodedPayload as any)?.metadata?.biomes_user_id
  );
  if (!raw) return undefined;
  try {
    return parseBiomesId(raw);
  } catch {
    return undefined;
  }
}

async function latestBiomesUserIdFromGlitchSave(
  identity: HarthmereValidatedIdentity
): Promise<BiomesId | undefined> {
  if (identity.guest || !identity.valid) {
    return undefined;
  }
  try {
    const response = await callGlitchApi(
      `/titles/${encodeURIComponent(
        identity.titleId
      )}/installs/${encodeURIComponent(identity.installId)}/saves`,
      { label: "recoverBiomesUserIdFromCloudSave" }
    );
    if (!response.ok) {
      return undefined;
    }
    const latest = collectionData(response.json)
      .map((save) => ({ ...save, decoded_payload: decodeSavePayload(save) }))
      .filter(
        (save) => save?.decoded_payload?.version === "harthmere-glitch-save"
      )
      .sort((a, b) => Number(b.version ?? 0) - Number(a.version ?? 0))[0];
    return biomesUserIdFromDecodedSavePayload(latest?.decoded_payload);
  } catch (error) {
    log.warn("HARTHMERE_CLOUD_SAVE_BIOMES_USER_RECOVERY_FAILED", {
      error,
      installId: identity.installId,
      gameUserId: identity.gameUserId,
    });
    return undefined;
  }
}

async function rememberStableGlitchLiveModeActor(
  identity: HarthmereValidatedIdentity,
  biomesUserId?: BiomesId
) {
  if (!identity.installId || identity.guest || !identity.gameUserId) {
    return;
  }
  await setStringInRedis(
    harthmereLiveModeInstallGameUserLinkKey(identity.installId),
    identity.gameUserId
  );
  if (biomesUserId !== undefined) {
    await setStringInRedis(
      harthmereLiveModeInstallLinkKey(identity.installId),
      String(biomesUserId)
    );
  }
}

function normalizeProgressionPayload(body: JsonMap) {
  const payload =
    body.payload && typeof body.payload === "object" ? body.payload : {};
  return {
    idempotency_key:
      typeof body.idempotency_key === "string" && body.idempotency_key.trim()
        ? body.idempotency_key.trim()
        : `harthmere-${Date.now()}-${crypto.randomUUID()}`,
    payload,
    trust_level: body.trust_level ?? "client",
    platform: body.platform ?? "web",
  };
}

function normalizeBehaviorEventPayload(body: JsonMap, titleId: string) {
  const installId = installIdFromBody(body);
  const stepKey = firstString(body.step_key, body.stepKey) ?? "unknown_step";
  const actionKey = firstString(body.action_key, body.actionKey) ?? "event";
  const metadata =
    body.metadata && typeof body.metadata === "object" ? body.metadata : {};
  return {
    game_install_id: installId,
    step_key: stepKey,
    action_key: actionKey,
    event_timestamp:
      firstString(body.event_timestamp, body.eventTimestamp) ??
      new Date().toISOString(),
    metadata: {
      ...metadata,
      source: metadata.source ?? "harthmere-biomes",
      title_id: titleId,
    },
  };
}

function normalizeBehaviorEventsPayload(body: JsonMap, titleId: string) {
  const installId = installIdFromBody(body);
  const rawEvents = Array.isArray(body.events) ? body.events : [];
  const events = rawEvents
    .slice(0, 50)
    .filter((event) => event && typeof event === "object")
    .map((event) => {
      const row = event as JsonMap;
      const metadata =
        row.metadata && typeof row.metadata === "object" ? row.metadata : {};
      return {
        game_install_id:
          firstString(row.game_install_id, row.install_id) ?? installId,
        step_key: firstString(row.step_key, row.stepKey) ?? "unknown_step",
        action_key: firstString(row.action_key, row.actionKey) ?? "event",
        event_timestamp:
          firstString(row.event_timestamp, row.eventTimestamp) ??
          new Date().toISOString(),
        metadata: {
          ...metadata,
          source: metadata.source ?? "harthmere-biomes",
          title_id: titleId,
        },
      };
    });
  return { events };
}

export function shouldFallbackBehaviorBulkStatus(status: number | undefined) {
  // 401/403 mean the server-side title token or account auth is wrong. Falling
  // back from one bulk call into many single calls just multiplies load while
  // producing the same failure, which is exactly what showed up in production.
  return status === 404 || status === 409;
}

export function shouldAcceptBehaviorTelemetryFailure(
  status: number | undefined
) {
  // Behavioral telemetry is optional and already sent in the background. If the
  // upstream is down, timing out, or rate limiting, returning a 5xx to the
  // browser just causes client requeues/retries and more load. Keep 401/403 as
  // failures so the existing auth circuit-breaker can still engage.
  return status === 408 || status === 429 || (status ?? 0) >= 500;
}

function isBehaviorTelemetryCall(call: Pick<QueuedGlitchApiCall, "label">) {
  return call.label === "recordEvent" || call.label === "recordEventsBulk";
}

function behaviorTelemetryAuthBackoffRemainingMs() {
  const until =
    globalForHarthmere.__harthmereGlitchTelemetryAuthBackoffUntil ?? 0;
  return Math.max(0, until - Date.now());
}

function noteBehaviorTelemetryAuthFailure(status: number | undefined) {
  if (status !== 401 && status !== 403) return;
  globalForHarthmere.__harthmereGlitchTelemetryAuthBackoffUntil =
    Date.now() +
    envNumber("GLITCH_BEHAVIOR_TELEMETRY_AUTH_BACKOFF_MS", 5 * 60 * 1000);
}

async function recordBehaviorEventsIndividually(
  titleId: string,
  events: JsonMap[]
) {
  const results = await Promise.all(
    events.map((event) =>
      callGlitchApi(`/titles/${encodeURIComponent(titleId)}/events`, {
        label: "recordEventFallback",
        method: "POST",
        body: event,
        timeoutMs: glitchTelemetryTimeoutMs(),
      })
    )
  );
  const sent = results.filter((result) => result.ok).length;
  const failures = results.filter((result) => !result.ok);
  return {
    ok: sent > 0 && failures.length < events.length,
    sent,
    failed: failures.length,
    firstFailure: failures[0],
  };
}

function stableBiomesUsername(identity: HarthmereValidatedIdentity) {
  if (!identity.glitchUserId && /^guest( user)?$/i.test(identity.userName)) {
    return `Guest${stableGuestUsernameSuffix(identity)}`.slice(0, 20);
  }

  // Prefer the real display name the Glitch API returned; only fall back to the
  // id-derived Glitch<uid> placeholder when no usable real name exists.
  // (Username collisions during creation are handled by
  // getUserOrCreateIfNotExists, which falls back to `user-<id>`.)
  const preferred = preferredGlitchDisplayUsername(identity);
  if (preferred) {
    return preferred;
  }

  const raw =
    firstString(
      identity.glitchUserId,
      identity.gameUserId,
      identity.userName,
      identity.installId
    ) ?? "Player";
  const compact = raw.replace(/[^a-zA-Z0-9]/g, "");
  const fallbackCompact = identity.installId.replace(/[^a-zA-Z0-9]/g, "");
  const source = compact || fallbackCompact || "Player";
  const suffix =
    source.length > 14 ? `${source.slice(0, 10)}${source.slice(-4)}` : source;

  return `Glitch${suffix}`.slice(0, 20);
}

function glitchForeignProfile(
  identity: HarthmereValidatedIdentity
): ForeignAccountProfile {
  // HARTHMERE_CLOUD_SAVE_IDENTITY: the link key MUST NOT depend on the
  // volatile `gameUserId` (which flipped between `glitch:<uid>` and
  // `install:<id>` depending on whether the Glitch validate response happened
  // to carry a user id), because that minted a fresh biomes user — and thus a
  // fresh save scope — every session. The link is anchored ONLY to the stable
  // Glitch account; a guest (no account) has no durable link and must never
  // reach here.
  const id = harthmereCloudSaveForeignAuthPrimaryId({
    titleId: identity.titleId,
    installId: identity.installId,
    glitchUserId: identity.glitchUserId,
    userName: identity.userName,
  });
  if (!id) {
    throw new Error("HARTHMERE_GLITCH_PROFILE_REQUIRES_STABLE_ACCOUNT");
  }
  return {
    provider: "dev",
    id,
    username: stableBiomesUsername(identity),
  };
}

async function ensureLogicHasPlayer(
  req: WebServerRequest,
  userId: any,
  username: string
) {
  const editor = req.context.worldApi.edit();
  await ensurePlayerExists(editor, userId, username);
  await editor.commit();
}

export async function createBiomesAuthForGlitchIdentity(
  req: IncomingMessage,
  res: ServerResponse,
  identity: HarthmereValidatedIdentity
) {
  const webReq = req as WebServerRequest;
  const context = webReq.context;
  if (
    !context?.db ||
    !context?.idGenerator ||
    !context?.sessionStore ||
    !context?.worldApi
  ) {
    throw new Error("MISSING_BIOMES_WEB_CONTEXT");
  }

  // Guests have no stable Glitch account, so there is nothing durable to anchor a
  // biomes user / cloud save to. Give them an EPHEMERAL, UNLINKED biomes user so
  // the entire game is playable, but never create a foreign-auth link (so the id
  // is not reused or persisted) and never save. Cloud save for guests is rejected
  // by Glitch itself (GUEST_NOT_ALLOWED) and skipped client-side.
  if (
    identity.guest ||
    !harthmereHasStableGlitchAccount({
      titleId: identity.titleId,
      installId: identity.installId,
      glitchUserId: identity.glitchUserId,
      userName: identity.userName,
    })
  ) {
    const username = stableBiomesUsername(identity);
    const guestUser = await getUserOrCreateIfNotExists(
      context.db,
      await context.idGenerator.next(),
      username,
      undefined
    );
    try {
      await ensureLogicHasPlayer(
        webReq,
        guestUser.id,
        guestUser.username ?? username
      );
    } catch (error) {
      log.warn("HARTHMERE_GLITCH_GUEST_PLAYER_BOOTSTRAP_FAILED", {
        error,
        userId: guestUser.id,
        installId: identity.installId,
      });
      throw error;
    }
    const guestSession = await context.sessionStore.createSession(guestUser.id);
    setAuthCookies(res, guestSession, req);
    return {
      user: guestUser,
      session: guestSession,
      profile: {
        provider: "dev",
        id: `glitch:${identity.titleId}:guest:${identity.installId}`,
        username,
      } satisfies ForeignAccountProfile,
      guest: true,
    };
  }

  const profile = glitchForeignProfile(identity);
  // HARTHMERE_CLOUD_SAVE_IDENTITY: resolve the SAME biomes user across
  // sessions even though the Glitch response is inconsistent about which
  // identifiers it returns. Try every key the link could legitimately live
  // under (newest-preference first), reuse the first that exists, and back-fill
  // the stable primary key so subsequent logins converge to one user.
  const candidateIds = harthmereCloudSaveForeignAuthCandidateIds({
    titleId: identity.titleId,
    installId: identity.installId,
    glitchUserId: identity.glitchUserId,
    userName: identity.userName,
  });
  let link: Awaited<ReturnType<typeof findLinkForForeignAuth>> | undefined;
  let matchedId: string | undefined;
  for (const candidateId of candidateIds) {
    try {
      const found = await findLinkForForeignAuth(
        context.db,
        profile.provider,
        candidateId
      );
      if (found) {
        link = found;
        matchedId = candidateId;
        break;
      }
    } catch (error) {
      log.warn("HARTHMERE_CLOUD_SAVE_LINK_LOOKUP_FAILED", {
        error,
        candidateId,
        installId: identity.installId,
      });
    }
  }
  let recoveredBiomesUserId: BiomesId | undefined;
  if (!link) {
    recoveredBiomesUserId = await latestBiomesUserIdFromGlitchSave(identity);
    link = await connectForeignAuth(
      context.db,
      profile.provider,
      profile,
      recoveredBiomesUserId ?? (await context.idGenerator.next())
    );
  } else if (matchedId !== profile.id) {
    // The player was found under a legacy/secondary key. Back-fill the stable
    // primary key (pointing at the SAME user) so the volatile-id flip can never
    // orphan their progress again.
    try {
      await connectForeignAuth(
        context.db,
        profile.provider,
        profile,
        link.userId
      );
    } catch (error) {
      log.warn("HARTHMERE_CLOUD_SAVE_LINK_BACKFILL_FAILED", {
        error,
        matchedId,
        primaryId: profile.id,
        userId: link.userId,
      });
    }
  }

  if (!link) {
    throw new Error("HARTHMERE_CLOUD_SAVE_LINK_UNRESOLVED");
  }
  const user = await getUserOrCreateIfNotExists(
    context.db,
    link.userId,
    profile.username,
    undefined
  );
  let username = user.username ?? profile.username ?? "GlitchPlayer";

  // HARTHMERE_GLITCH_DISPLAY_USERNAME: accounts created before the real-name
  // preference (or while the Glitch API omitted `user_name`) carry an
  // id-derived placeholder like "Glitch43af071c9979a6". Once the API returns a
  // real name, upgrade the stored username in place — ensureLogicHasPlayer
  // below re-syncs the ECS label on every login, so the on-screen name heals
  // immediately. Never overwrite a name the player chose themselves.
  const preferredUsername = preferredGlitchDisplayUsername(identity);
  if (
    preferredUsername &&
    preferredUsername !== username &&
    isGeneratedPlaceholderUsername(username)
  ) {
    try {
      const otherUser = await findUniqueByUsername(
        context.db,
        preferredUsername
      );
      if (!otherUser || otherUser.id === user.id) {
        await saveUsernameToDb(context.db, user.id, preferredUsername);
        username = preferredUsername;
      }
    } catch (error) {
      log.warn("HARTHMERE_GLITCH_USERNAME_UPGRADE_FAILED", {
        error,
        userId: user.id,
        from: username,
        to: preferredUsername,
      });
    }
  }

  try {
    await ensureLogicHasPlayer(webReq, user.id, username);
  } catch (error) {
    log.warn("GLITCH_INSTALL_AUTO_LOGIN_PLAYER_BOOTSTRAP_FAILED", {
      error,
      userId: user.id,
      installId: identity.installId,
    });
    throw error;
  }

  const session = await context.sessionStore.createSession(user.id);
  setAuthCookies(res, session, req);
  await rememberStableGlitchLiveModeActor(identity, user.id);

  return { user, session, profile, guest: false };
}

export async function createBiomesAuthForGlitchInstall(
  req: IncomingMessage,
  res: ServerResponse,
  body: JsonMap
) {
  const titleId = titleIdFromBody(body);
  const { response, identity } = await validateInstallWithGlitch(titleId, body);
  // Guests validate as an allowed trial install with no stable Glitch account
  // (`valid: false`, `guest: true` after normalization). They still need a
  // normal Biomes session so /at can mount the game immediately during SSR.
  if (!identity || (!identity.valid && !identity.guest)) {
    const error = new Error("INVALID_GLITCH_INSTALL") as Error & {
      status?: number;
      response?: GlitchProxyResponse;
    };
    error.status = response.ok ? 403 : response.status || 500;
    error.response = response;
    throw error;
  }

  return {
    ...(await createBiomesAuthForGlitchIdentity(req, res, identity)),
    identity,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = (req.body ?? {}) as JsonMap;
  const op = typeof body.op === "string" ? body.op : "";
  const routeTimer = new Timer();
  let routeError: string | undefined;

  try {
    const titleId = titleIdFromBody(body);

    if (op === "config") {
      return res.status(200).json({
        ok: true,
        enabled: Boolean(configuredTitleToken()),
        title_id: titleId,
        api_base_url: glitchApiBaseUrl(),
        idle_session_ms: idleSessionMs(),
      });
    }

    if (op === "validate") {
      const { response, identity } = await validateInstallWithGlitch(
        titleId,
        body
      );
      if (!identity) {
        return res
          .status(response.ok ? 200 : response.status || 500)
          .json(response.json ?? response);
      }
      return res
        .status(identity.valid ? 200 : 403)
        .json(validationJson(identity));
    }

    if (op === "autoLogin") {
      const { response, identity } = await validateInstallWithGlitch(
        titleId,
        body
      );
      if (!identity) {
        return res
          .status(response.ok ? 200 : response.status || 500)
          .json(response.json ?? response);
      }
      // Guests (valid install, no Glitch account) are allowed to play; only a
      // genuinely invalid install (neither valid nor guest) is rejected.
      if (!identity.valid && !identity.guest) {
        return res
          .status(403)
          .json({ ok: false, valid: false, error: "INVALID_INSTALL" });
      }

      const { user, session, profile, guest } =
        await createBiomesAuthForGlitchIdentity(req, res, identity);
      // HARTHMERE_CLOUD_SAVE_IDENTITY: the durable cloud game_user_id is the
      // stable Glitch account user_id surfaced by normalizeIdentityFromValidateResponse
      // as identity.gameUserId (`glitch:<user_id>`), which validationJson returns.
      // biomes_user_id remains the internal biomes user resolved from that scope.
      return res.status(200).json({
        ...validationJson(identity),
        guest,
        cloud_save: !guest,
        biomes_user_id: user.id,
        biomes_session_id: session.id,
        biomes_username: user.username ?? profile.username,
        auth_provider: profile.provider,
        auto_login: true,
      });
    }

    if (op === "claimSession") {
      const { response, identity } = await validateInstallWithGlitch(
        titleId,
        body
      );
      if (!identity) {
        return res
          .status(response.ok ? 200 : response.status || 500)
          .json(response.json ?? response);
      }
      // Guests (valid install, no Glitch account) are allowed to play; only a
      // genuinely invalid install (neither valid nor guest) is rejected.
      if (!identity.valid && !identity.guest) {
        return res
          .status(403)
          .json({ ok: false, valid: false, error: "INVALID_INSTALL" });
      }
      const { user, guest } = await createBiomesAuthForGlitchIdentity(
        req,
        res,
        identity
      );
      // HARTHMERE_CLOUD_SAVE_IDENTITY: scope the session and return the cloud
      // game_user_id off the stable Glitch account id (identity.gameUserId =
      // `glitch:<user_id>` from the validate response), the canonical user id for
      // the game. biomes_user_id is the internal biomes user resolved from it.
      const { session, disconnected } = await claimServerSession(
        identity,
        body
      );
      return res.status(200).json({
        ok: true,
        valid: true,
        guest,
        cloud_save: !guest,
        title_id: identity.titleId,
        install_id: identity.installId,
        game_user_id: identity.gameUserId,
        glitch_user_id: identity.glitchUserId,
        user_id: identity.glitchUserId,
        biomes_user_id: user.id,
        user_name: identity.userName,
        username: identity.userName,
        server_session_id: session.serverSessionId,
        idle_session_ms: idleSessionMs(),
        disconnected_session_ids: disconnected.map((s) => s.serverSessionId),
      });
    }

    if (op === "heartbeatSession") {
      const serverSessionId = firstString(
        body.server_session_id,
        body.serverSessionId
      );
      if (!serverSessionId) {
        return res.status(422).json({
          ok: false,
          revoked: true,
          error: "MISSING_SERVER_SESSION_ID",
        });
      }
      await pruneExpiredSessions();
      const session = await getSession(serverSessionId);
      if (!session) {
        // The production Glitch iframe can survive a web worker/process restart
        // while this in-memory session map does not. Treat a missing in-memory
        // heartbeat session as recoverable; the client will re-claim on its next
        // normal bridge cycle, and older clients can safely keep playing instead
        // of showing the misleading "newer session" overlay.
        return res.status(200).json({
          ok: true,
          revoked: false,
          server_session_id: serverSessionId,
          recovered_missing_session: true,
          reason: "session_not_found_recovered",
        });
      }
      if (session.disconnectedAtMs) {
        return res.status(200).json({
          ok: false,
          revoked: true,
          reason: session.disconnectedReason ?? "session_disconnected",
          disconnected_at: new Date(session.disconnectedAtMs).toISOString(),
        });
      }
      session.lastSeenAtMs = Date.now();
      await setSession(session);
      return res
        .status(200)
        .json({ ok: true, revoked: false, server_session_id: serverSessionId });
    }

    if (op === "releaseSession") {
      const serverSessionId = firstString(
        body.server_session_id,
        body.serverSessionId
      );
      if (serverSessionId) {
        const session = await getSession(serverSessionId);
        if (session && !session.disconnectedAtMs) {
          session.disconnectedAtMs = Date.now();
          session.disconnectedReason =
            firstString(body.reason) ?? "client_release";
          await setSession(session);
        }
      }
      return res.status(200).json({ ok: true });
    }

    if (op === "heartbeatInstall") {
      if (shouldRunGlitchHarthmereOperationAsync(op)) {
        const installId = installIdFromBody(body);
        const queued = await enqueueGlitchApiCall({
          path: `/titles/${encodeURIComponent(titleId)}/installs`,
          label: "createOrResumeInstall",
          method: "POST",
          body: {
            user_install_id: installId,
            session_id:
              firstString(body.session_id, body.client_session_id) ?? installId,
            analytics_session_id: firstString(body.analytics_session_id),
            fingerprint_id: firstString(body.fingerprint_id),
            device_id: firstString(body.device_id) ?? installId,
            platform: body.platform ?? "web",
            device_type: body.device_type,
            operating_system: body.operating_system,
            game_version: body.game_version ?? "harthmere-glitch",
            referral_source: body.referral_source ?? "other",
            first_party_cookie: body.first_party_cookie,
            advertising_id: body.advertising_id,
            consent_given: body.consent_given,
            consent_version: body.consent_version,
            exclude_from_conversion: body.exclude_from_conversion,
          },
        });
        return res.status(200).json({ ...queued, ok: true, async: true, op });
      }
      const response = await createOrResumeInstallWithGlitch(titleId, body);
      if ((response as any).disabled) {
        return res
          .status(200)
          .json({ ok: true, skipped: true, reason: response.reason });
      }
      if (shouldAcceptBehaviorTelemetryFailure(response.status)) {
        return res.status(200).json({
          ok: true,
          dropped: true,
          reason: "telemetry_upstream_unavailable",
          upstream_status: response.status,
        });
      }
      return res
        .status(response.ok ? 200 : response.status || 500)
        .json(response.json ?? response);
    }

    if (op === "listSaves") {
      const installId = installIdFromBody(body);
      const query = new URLSearchParams({ include_payload: "1" });
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/installs/${encodeURIComponent(
          installId
        )}/saves`,
        { label: "listSaves", query }
      );
      if (!response.ok || (response as any).disabled) {
        return res
          .status(response.ok ? 200 : response.status || 500)
          .json(response.json ?? response);
      }
      const saves = collectionData(response.json).map((save) => ({
        ...save,
        decoded_payload: decodeSavePayload(save),
      }));
      return res.status(200).json({ ok: true, saves, raw: response.json });
    }

    if (op === "storeSave") {
      const installId = installIdFromBody(body);
      const encoded = makeSavePayload(body.snapshot ?? {});
      const metadata =
        body.metadata && typeof body.metadata === "object" ? body.metadata : {};
      const saveBody = {
        slot_index: Number.isInteger(body.slot_index) ? body.slot_index : 0,
        payload: encoded.payload,
        checksum: encoded.checksum,
        base_version: Number.isInteger(body.base_version)
          ? body.base_version
          : 0,
        save_type: body.save_type ?? "auto",
        client_timestamp: new Date().toISOString(),
        slot_name: body.slot_name ?? `${BIOMES_GAME_NAME} Autosave`,
        metadata,
        device_id: body.device_id ?? body.install_id,
        platform: body.platform ?? "web",
        game_version: body.game_version ?? "harthmere-glitch",
        last_played_at: new Date().toISOString(),
        play_duration_seconds: Math.max(
          0,
          Math.floor(Number(body.play_duration_seconds ?? 0))
        ),
      };
      if (shouldRunGlitchHarthmereOperationAsync(op)) {
        const queued = await enqueueGlitchApiCall({
          path: `/titles/${encodeURIComponent(
            titleId
          )}/installs/${encodeURIComponent(installId)}/saves`,
          label: "storeSave",
          method: "POST",
          body: saveBody,
        });
        return res.status(200).json({ ...queued, ok: true, async: true, op });
      }
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/installs/${encodeURIComponent(
          installId
        )}/saves`,
        {
          label: "storeSave",
          method: "POST",
          body: saveBody,
        }
      );
      return res
        .status(response.ok ? 200 : response.status || 500)
        .json(response.json ?? response);
    }

    if (op === "submitProgression") {
      const installId = installIdFromBody(body);
      const progressionPayload = normalizeProgressionPayload(body);
      if (shouldRunGlitchHarthmereOperationAsync(op)) {
        const queued = await enqueueGlitchApiCall({
          path: `/titles/${encodeURIComponent(
            titleId
          )}/installs/${encodeURIComponent(installId)}/submit`,
          label: "submitProgression",
          method: "POST",
          body: progressionPayload,
        });
        return res.status(200).json({ ...queued, ok: true, async: true, op });
      }
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/installs/${encodeURIComponent(
          installId
        )}/submit`,
        {
          label: "submitProgression",
          method: "POST",
          body: progressionPayload,
        }
      );
      return res
        .status(response.ok ? 200 : response.status || 500)
        .json(response.json ?? response);
    }

    if (op === "recordEvent") {
      const event = normalizeBehaviorEventPayload(body, titleId);
      if (shouldRunGlitchHarthmereOperationAsync(op)) {
        const queued = await enqueueGlitchApiCall({
          path: `/titles/${encodeURIComponent(titleId)}/events`,
          label: "recordEvent",
          method: "POST",
          body: event,
          timeoutMs: glitchTelemetryTimeoutMs(),
        });
        return res.status(200).json({ ...queued, ok: true, async: true, op });
      }
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/events`,
        {
          label: "recordEvent",
          method: "POST",
          body: event,
          timeoutMs: glitchTelemetryTimeoutMs(),
        }
      );
      if ((response as any).disabled) {
        return res
          .status(200)
          .json({ ok: true, skipped: true, reason: response.reason });
      }
      return res
        .status(response.ok ? 200 : response.status || 500)
        .json(response.json ?? response);
    }

    if (op === "recordEvents") {
      const payload = normalizeBehaviorEventsPayload(body, titleId);
      if (payload.events.length === 0) {
        return res
          .status(200)
          .json({ ok: true, skipped: true, reason: "empty_events" });
      }
      if (shouldRunGlitchHarthmereOperationAsync(op)) {
        const queued = await enqueueGlitchApiCall({
          path: `/titles/${encodeURIComponent(titleId)}/events/bulk`,
          label: "recordEventsBulk",
          method: "POST",
          body: payload,
          timeoutMs: glitchTelemetryTimeoutMs(),
        });
        return res.status(200).json({ ...queued, ok: true, async: true, op });
      }
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/events/bulk`,
        {
          label: "recordEventsBulk",
          method: "POST",
          body: payload,
          timeoutMs: glitchTelemetryTimeoutMs(),
        }
      );
      if ((response as any).disabled) {
        return res
          .status(200)
          .json({ ok: true, skipped: true, reason: response.reason });
      }
      if (!response.ok && shouldFallbackBehaviorBulkStatus(response.status)) {
        const fallback = await recordBehaviorEventsIndividually(
          titleId,
          payload.events
        );
        if (fallback.ok) {
          return res.status(200).json({
            ok: true,
            fallback: "single_events",
            bulk_status: response.status,
            sent: fallback.sent,
            failed: fallback.failed,
          });
        }
        return res
          .status(fallback.firstFailure?.status ?? response.status ?? 500)
          .json(fallback.firstFailure?.json ?? response.json ?? response);
      }
      if (shouldAcceptBehaviorTelemetryFailure(response.status)) {
        return res.status(200).json({
          ok: true,
          dropped: true,
          reason: "telemetry_upstream_unavailable",
          upstream_status: response.status,
        });
      }
      return res
        .status(response.ok ? 200 : response.status || 500)
        .json(response.json ?? response);
    }

    if (op === "playerStats") {
      const installId = installIdFromBody(body);
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/installs/${encodeURIComponent(
          installId
        )}/stats`,
        { label: "playerStats" }
      );
      return res
        .status(response.ok ? 200 : response.status || 500)
        .json(response.json ?? response);
    }

    if (op === "playerAchievements") {
      const installId = installIdFromBody(body);
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/installs/${encodeURIComponent(
          installId
        )}/achievements`,
        { label: "playerAchievements" }
      );
      return res
        .status(response.ok ? 200 : response.status || 500)
        .json(response.json ?? response);
    }

    if (op === "wakeUpNoop") {
      return res.status(200).json({ ok: true, skipped: true });
    }

    if (op === "leaderboard") {
      const apiKey =
        typeof body.api_key === "string" ? body.api_key.trim() : "";
      if (!apiKey) {
        return res
          .status(422)
          .json({ ok: false, error: "MISSING_LEADERBOARD_API_KEY" });
      }
      const query = new URLSearchParams();
      if (typeof body.install_id === "string" && body.install_id.trim()) {
        query.set("around_me", "1");
        query.set("install_id", body.install_id.trim());
      }
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(
          titleId
        )}/leaderboards/${encodeURIComponent(apiKey)}`,
        { label: "leaderboard", query }
      );
      return res
        .status(response.ok ? 200 : response.status || 500)
        .json(response.json ?? response);
    }

    return res
      .status(422)
      .json({ ok: false, error: "UNKNOWN_GLITCH_HARTHMERE_OP", op });
  } catch (error: any) {
    const message = error?.message ?? String(error);
    routeError = message;
    const status =
      message === "TITLE_ID_MISMATCH"
        ? 403
        : message === "MISSING_INSTALL_ID"
        ? 422
        : 500;
    return res.status(status).json({ ok: false, error: message });
  } finally {
    const ms = routeTimer.elapsed;
    if (ms >= harthmereRouteSlowMs() || res.statusCode >= 500) {
      log.warn("GLITCH_HARTHMERE_ROUTE_SLOW_OR_ERROR", {
        op: op || "unknown",
        status: res.statusCode,
        ms,
        requestBytes: approximateJsonBytes(body),
        error: routeError,
      });
    }
  }
}

export function approximateJsonBytes(value: unknown) {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? {}), "utf8");
  } catch {
    return undefined;
  }
}
