import crypto from "crypto";
import type { IncomingMessage, ServerResponse } from "http";
import type { NextApiRequest, NextApiResponse } from "next";

import { ensurePlayerExists } from "@/server/logic/utils/players";
import {
  connectForeignAuth,
  findLinkForForeignAuth,
} from "@/server/shared/auth/auth_link";
import { setAuthCookies } from "@/server/shared/auth/cookies";
import type { ForeignAccountProfile } from "@/server/shared/auth/types";
import type { WebServerRequest } from "@/server/web/context";
import { getUserOrCreateIfNotExists } from "@/server/web/db/users";
import { BIOMES_GAME_NAME } from "@/shared/biomes/display_names";
import { log } from "@/shared/logging";
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

export type JsonMap = Record<string, any>;
type GlitchProxyResponse = {
  ok: boolean;
  status?: number;
  json?: any;
  disabled?: boolean;
  reason?: string;
};

export type HarthmereValidatedIdentity = {
  valid: boolean;
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
  __harthmereGlitchSessionStoreV70?: HarthmereSessionStore;
};

const sessionStore: HarthmereSessionStore =
  globalForHarthmere.__harthmereGlitchSessionStoreV70 ??
  (globalForHarthmere.__harthmereGlitchSessionStoreV70 = {
    sessionsById: new Map<string, HarthmereServerSession>(),
    validationsByKey: new Map<string, HarthmereCachedValidation>(),
  });

// Backfill older hot-reloaded/global stores that were created before the
// validation cache existed.
sessionStore.validationsByKey ??= new Map<string, HarthmereCachedValidation>();

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

function validationCacheKey(titleId: string, installId: string) {
  return `${titleId}:${installId}`;
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

  return {
    valid: true,
    titleId,
    installId,
    gameUserId: `install:${installId}`,
    glitchUserId: undefined,
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
  options: { method?: string; body?: unknown; query?: URLSearchParams } = {}
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
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
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

  return {
    ok: response.ok,
    status: response.status,
    json,
  };
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
  const valid =
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

  const glitchUserId = firstString(
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

  const gameUserId = glitchUserId
    ? `glitch:${glitchUserId}`
    : `install:${installId}`;

  return {
    valid,
    titleId,
    installId,
    gameUserId,
    glitchUserId,
    userName,
    licenseType: firstString(
      root.license_type,
      root.licenseType,
      install.license_type,
      install.licenseType
    ),
    raw,
  };
}

function validationJson(identity: HarthmereValidatedIdentity) {
  return {
    ...(identity.raw && typeof identity.raw === "object" ? identity.raw : {}),
    ok: true,
    valid: identity.valid,
    title_id: identity.titleId,
    install_id: identity.installId,
    game_user_id: identity.gameUserId,
    glitch_user_id: identity.glitchUserId,
    user_id: identity.glitchUserId,
    user_name: identity.userName,
    username: identity.userName,
    license_type: identity.licenseType,
  };
}

async function validateInstallWithGlitch(titleId: string, body: JsonMap) {
  const installId = installIdFromBody(body);
  const cacheKey = validationCacheKey(titleId, installId);
  const cached = sessionStore.validationsByKey.get(cacheKey);
  if (cached && cached.expiresAtMs > Date.now()) {
    return {
      response: { ok: true, json: validationJson(cached.identity) },
      identity: cached.identity,
    };
  }

  if (allowLocalDevInstallIdentity(installId)) {
    const identity = makeLocalDevValidatedIdentity(titleId, installId);
    sessionStore.validationsByKey.set(cacheKey, {
      identity,
      expiresAtMs: Date.now() + validateCacheMs(),
    });
    return {
      response: { ok: true, json: validationJson(identity) },
      identity,
    };
  }

  const response = await callGlitchApi(
    `/titles/${encodeURIComponent(titleId)}/installs/${encodeURIComponent(
      installId
    )}/validate`,
    {
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
    sessionStore.validationsByKey.delete(cacheKey);
    return { response, identity: undefined };
  }

  const identity = normalizeIdentityFromValidateResponse(
    titleId,
    installId,
    response.json
  );
  if (identity.valid) {
    sessionStore.validationsByKey.set(cacheKey, {
      identity,
      expiresAtMs: Date.now() + validateCacheMs(),
    });
  }

  return {
    response,
    identity,
  };
}

function pruneExpiredSessions(now = Date.now()) {
  const ttl = sessionTtlMs();
  for (const [id, session] of sessionStore.sessionsById) {
    if (now - session.lastSeenAtMs > ttl) {
      sessionStore.sessionsById.delete(id);
    }
  }
}

function disconnectIdleSessionsForUser(current: HarthmereServerSession) {
  const now = Date.now();
  const idleMs = idleSessionMs();
  const disconnected: HarthmereServerSession[] = [];
  for (const session of sessionStore.sessionsById.values()) {
    if (session.serverSessionId === current.serverSessionId) continue;
    if (session.titleId !== current.titleId) continue;
    if (session.gameUserId !== current.gameUserId) continue;
    if (session.disconnectedAtMs) continue;
    if (now - session.lastSeenAtMs >= idleMs) {
      session.disconnectedAtMs = now;
      session.disconnectedReason = "new_login_replaced_idle_session";
      disconnected.push(session);
    }
  }
  return disconnected;
}

function claimServerSession(
  identity: HarthmereValidatedIdentity,
  body: JsonMap
) {
  const now = Date.now();
  pruneExpiredSessions(now);
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
  sessionStore.sessionsById.set(serverSessionId, session);
  const disconnected = disconnectIdleSessionsForUser(session);
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

function stableBiomesUsername(identity: HarthmereValidatedIdentity) {
  if (!identity.glitchUserId && /^guest( user)?$/i.test(identity.userName)) {
    return "Guest";
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
  return {
    provider: "dev",
    id: `glitch:${identity.titleId}:${
      identity.gameUserId || `install:${identity.installId}`
    }`,
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

  const profile = glitchForeignProfile(identity);
  let link = await findLinkForForeignAuth(
    context.db,
    profile.provider,
    profile.id
  );
  if (!link) {
    link = await connectForeignAuth(
      context.db,
      profile.provider,
      profile,
      await context.idGenerator.next()
    );
  }

  const user = await getUserOrCreateIfNotExists(
    context.db,
    link.userId,
    profile.username,
    undefined
  );
  const username = user.username ?? profile.username ?? "GlitchPlayer";

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

  return { user, session, profile };
}

export async function createBiomesAuthForGlitchInstall(
  req: IncomingMessage,
  res: ServerResponse,
  body: JsonMap
) {
  const titleId = titleIdFromBody(body);
  const { response, identity } = await validateInstallWithGlitch(titleId, body);
  if (!identity || !identity.valid) {
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
      if (!identity.valid) {
        return res
          .status(403)
          .json({ ok: false, valid: false, error: "INVALID_INSTALL" });
      }

      const { user, session, profile } =
        await createBiomesAuthForGlitchIdentity(req, res, identity);
      return res.status(200).json({
        ...validationJson(identity),
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
      if (!identity.valid) {
        return res
          .status(403)
          .json({ ok: false, valid: false, error: "INVALID_INSTALL" });
      }
      const { session, disconnected } = claimServerSession(identity, body);
      return res.status(200).json({
        ok: true,
        valid: true,
        title_id: identity.titleId,
        install_id: identity.installId,
        game_user_id: identity.gameUserId,
        glitch_user_id: identity.glitchUserId,
        user_id: identity.glitchUserId,
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
        return res
          .status(422)
          .json({
            ok: false,
            revoked: true,
            error: "MISSING_SERVER_SESSION_ID",
          });
      }
      pruneExpiredSessions();
      const session = sessionStore.sessionsById.get(serverSessionId);
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
        const session = sessionStore.sessionsById.get(serverSessionId);
        if (session && !session.disconnectedAtMs) {
          session.disconnectedAtMs = Date.now();
          session.disconnectedReason =
            firstString(body.reason) ?? "client_release";
        }
      }
      return res.status(200).json({ ok: true });
    }

    if (op === "listSaves") {
      const installId = installIdFromBody(body);
      const query = new URLSearchParams({ include_payload: "1" });
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/installs/${encodeURIComponent(
          installId
        )}/saves`,
        { query }
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
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/installs/${encodeURIComponent(
          installId
        )}/saves`,
        {
          method: "POST",
          body: {
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
            game_version: body.game_version ?? "harthmere-glitch-v70",
            last_played_at: new Date().toISOString(),
            play_duration_seconds: Math.max(
              0,
              Math.floor(Number(body.play_duration_seconds ?? 0))
            ),
          },
        }
      );
      return res
        .status(response.ok ? 200 : response.status || 500)
        .json(response.json ?? response);
    }

    if (op === "submitProgression") {
      const installId = installIdFromBody(body);
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/installs/${encodeURIComponent(
          installId
        )}/submit`,
        {
          method: "POST",
          body: normalizeProgressionPayload(body),
        }
      );
      return res
        .status(response.ok ? 200 : response.status || 500)
        .json(response.json ?? response);
    }

    if (op === "playerStats") {
      const installId = installIdFromBody(body);
      const response = await callGlitchApi(
        `/titles/${encodeURIComponent(titleId)}/installs/${encodeURIComponent(
          installId
        )}/stats`
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
        )}/achievements`
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
        { query }
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
    const status =
      message === "TITLE_ID_MISMATCH"
        ? 403
        : message === "MISSING_INSTALL_ID"
        ? 422
        : 500;
    return res.status(status).json({ ok: false, error: message });
  }
}
