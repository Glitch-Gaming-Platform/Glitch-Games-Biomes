import type { WebServerApiRequest } from "@/server/web/context";
import type { SessionStore } from "@/server/web/db/sessions";
import type { FirestoreSession } from "@/server/web/db/types";
import type { APIErrorCode } from "@/shared/api/errors";
import { APIError, isApiErrorCode } from "@/shared/api/errors";
import type { BiomesId, StoredEntityId } from "@/shared/ids";
import { toStoredEntityId, zLegacyIdOrBiomesId } from "@/shared/ids";
import { autoId } from "@/shared/util/auto_id";
import type * as cookie from "cookie";
import type { IncomingMessage, ServerResponse } from "http";
import { omit } from "lodash";
import type { NextApiResponse } from "next";
import nookies from "nookies";

export interface AuthedToken {
  sessionId: string;
  session: FirestoreSession;
  userId: BiomesId;
}

export type AuthenticationResult =
  | { auth: AuthedToken; error: null }
  | { error: "no-user" }
  | { error: "no-session" }
  | { error: "invalid-user" }
  | { error: "invalid-session" }
  | { error: "other" };

function shouldClearCookes(result: AuthenticationResult) {
  switch (result.error) {
    case "invalid-session":
    case "invalid-user":
      return true;
  }
  return false;
}

export async function authenticateUserSession(
  sessionStore: SessionStore,
  userId: BiomesId,
  sessionId: string
): Promise<AuthenticationResult> {
  // Get the user session from the DB.
  const session = await sessionStore.findSession(sessionId, userId);
  if (!session) {
    return { error: "invalid-session" };
  }
  return {
    auth: {
      sessionId,
      session,
      userId,
    },
    error: null,
  };
}

export async function verifyCookies(
  sessionStore: SessionStore,
  cookies: Record<string, string>
): Promise<AuthenticationResult> {
  const buid = process.env.BIOMES_OVERRIDE_AUTH ?? cookies.BUID;
  if (buid === undefined || buid.length === 0) {
    return { error: "no-user" };
  }
  const sessionId = cookies.BSID;
  if (sessionId === undefined || sessionId.length === 0) {
    return { error: "no-session" };
  }
  return authenticateUserSession(
    sessionStore,
    zLegacyIdOrBiomesId.parse(buid as StoredEntityId),
    sessionId
  );
}

async function verifyGlitchHeaderSession(
  sessionStore: SessionStore,
  req: IncomingMessage
): Promise<AuthenticationResult> {
  if (!isGlitchLocalAuthRuntime()) {
    return { error: "no-session" };
  }

  const userIdHeader = firstHeaderValue(req.headers["x-biomes-user-id"]);
  const sessionIdHeader = firstHeaderValue(req.headers["x-biomes-session-id"]);
  if (!userIdHeader || !sessionIdHeader) {
    return { error: "no-session" };
  }

  try {
    return authenticateUserSession(
      sessionStore,
      zLegacyIdOrBiomesId.parse(userIdHeader as StoredEntityId),
      sessionIdHeader
    );
  } catch {
    return { error: "invalid-session" };
  }
}

// Expire auth in 1 year, it is refreshed on every authenticated request where possible however.
const AUTH_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;
const USER_ID_COOKIE = "BUID";
const SESSION_ID_COOKIE = "BSID";
const DEVICE_ID_COOKIE = "BDID";

function isGlitchLocalAuthRuntime() {
  return (
    process.env.GLITCH_RUNTIME === "1" ||
    process.env.GLITCH_LOCAL_ASSETS === "1" ||
    process.env.GLITCH_DEV_AUTH === "1" ||
    !!process.env.GLITCH_TITLE_ID
  );
}

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isLikelyHttpsGlitchEmbedRequest(req?: IncomingMessage) {
  if (
    !req ||
    !isGlitchLocalAuthRuntime() ||
    process.env.NODE_ENV !== "production"
  ) {
    return false;
  }

  if (process.env.GLITCH_AUTH_COOKIE_MODE === "local") {
    return false;
  }
  if (
    process.env.GLITCH_AUTH_COOKIE_MODE === "cross-site" ||
    process.env.GLITCH_CROSS_SITE_COOKIES === "1"
  ) {
    return true;
  }

  const proto = firstHeaderValue(req.headers["x-forwarded-proto"]);
  const host =
    firstHeaderValue(req.headers["x-forwarded-host"]) ||
    firstHeaderValue(req.headers.host) ||
    "";

  return (
    proto === "https" ||
    /(^|\.)azurecontainerapps\.io(?::|$)/i.test(host) ||
    /(^|\.)glitch\.fun(?::|$)/i.test(host)
  );
}

// We cannot do direct communication between the main window and a pop-up, so
// to support this the callback system also supports supplying error codes via
// a cookie so the main window (watching on the /check endpoint) can handle
// these deferred errors, such as an invalid login token.
const CALLBACK_FAILED_COOKIE = "BCBF";

function cookieOptions(httpOnly: boolean, req?: IncomingMessage) {
  const base: cookie.CookieSerializeOptions = {
    maxAge: AUTH_COOKIE_MAX_AGE,
    path: "/",
    httpOnly,
  };
  if (process.env.NODE_ENV === "production") {
    if (isGlitchLocalAuthRuntime()) {
      // GLITCH_CROSS_SITE_EMBED_COOKIE_FIX
      // Harthmere is launched inside a www.glitch.fun iframe but served from
      // the game container origin. Chrome treats the iframe as a third-party
      // context, so auth cookies must be SameSite=None; Secure when the request
      // is HTTPS. Keep local HTTP Docker/dev flows on host-only lax cookies.
      if (isLikelyHttpsGlitchEmbedRequest(req)) {
        base.sameSite = "none";
        base.secure = true;
      }
    } else {
      base.domain = "biomes.gg";
      base.secure = true;
    }
  }
  return base;
}

export function checkCallbackFailedCookie(req: WebServerApiRequest) {
  const bcbf = nookies.get({ req }).BCBF;
  if (isApiErrorCode(bcbf)) {
    throw new APIError(bcbf);
  } else {
    throw new APIError("unauthorized");
  }
}

export function markCallbackFailed(res: ServerResponse, code?: APIErrorCode) {
  if (code === undefined) {
    clearCallbackFailedCookie(res);
  } else {
    nookies.set({ res }, CALLBACK_FAILED_COOKIE, code, cookieOptions(false));
  }
}

export function clearCallbackFailedCookie(res: ServerResponse) {
  nookies.destroy({ res }, CALLBACK_FAILED_COOKIE, cookieOptions(false));
}

export function serializeAuthCookies(session: {
  userId: BiomesId;
  id: string;
}): string {
  return `${USER_ID_COOKIE}=${toStoredEntityId(
    session.userId
  )}; ${SESSION_ID_COOKIE}=${session.id}`;
}

export function setAuthCookies(
  res: ServerResponse,
  session: FirestoreSession,
  req?: IncomingMessage
) {
  clearCallbackFailedCookie(res);
  nookies.set(
    { res },
    USER_ID_COOKIE,
    toStoredEntityId(session.userId),
    cookieOptions(false, req)
  );
  nookies.set({ res }, SESSION_ID_COOKIE, session.id, cookieOptions(true, req));
}

export function clearAuthCookies(res: ServerResponse, req?: IncomingMessage) {
  if (process.env.NODE_ENV === "production") {
    nookies.destroy({ res }, USER_ID_COOKIE, {
      ...cookieOptions(false, req),
      domain: isGlitchLocalAuthRuntime() ? undefined : "wwww.biomes.gg",
    });
    nookies.destroy({ res }, SESSION_ID_COOKIE, {
      ...cookieOptions(false, req),
      domain: isGlitchLocalAuthRuntime() ? undefined : "wwww.biomes.gg",
    });
  }
  nookies.destroy({ res }, USER_ID_COOKIE, cookieOptions(false, req));
  nookies.destroy(
    { res },
    USER_ID_COOKIE,
    omit(cookieOptions(false, req), "domain")
  );
  nookies.destroy({ res }, SESSION_ID_COOKIE, cookieOptions(true, req));
  nookies.destroy(
    { res },
    SESSION_ID_COOKIE,
    omit(cookieOptions(true, req), "domain")
  );
}

function extractDeviceId(req: IncomingMessage): string | undefined {
  const bdid = nookies.get({ req }).BDID;
  if (bdid) {
    return bdid;
  }
  const bdidHeader = req.headers["x-bdid"];
  if (Array.isArray(bdidHeader)) {
    return bdidHeader[0];
  }
  return bdidHeader;
}

export const UNKNOWN_DEVICE_ID = "unknown";

export function getDeviceIdCookie(req: IncomingMessage): string {
  return extractDeviceId(req) || UNKNOWN_DEVICE_ID;
}

export function setDeviceIdCookie(res: ServerResponse, req?: IncomingMessage) {
  const id = autoId(20);
  nookies.set({ res }, DEVICE_ID_COOKIE, id, cookieOptions(true, req));
  return id;
}

export async function verifyAuthenticatedRequest(
  sessionStore: SessionStore,
  req: IncomingMessage,
  res?: NextApiResponse
) {
  let authResult = await verifyCookies(sessionStore, nookies.get({ req }));
  if (authResult.error) {
    const headerAuthResult = await verifyGlitchHeaderSession(sessionStore, req);
    if (!headerAuthResult.error) {
      authResult = headerAuthResult;
    }
  }
  if (res) {
    // Correct cookies or extend them if we can.
    if (!authResult.error) {
      setAuthCookies(res, authResult.auth.session, req);
    } else if (shouldClearCookes(authResult)) {
      clearAuthCookies(res, req);
    }
  }
  return authResult;
}
