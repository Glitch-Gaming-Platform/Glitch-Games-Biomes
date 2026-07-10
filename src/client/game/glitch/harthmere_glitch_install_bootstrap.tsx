import {
  HARTHMERE_GLITCH_IDENTITY_CHANGED_EVENT,
  writeHarthmereGlitchIdentity,
} from "@/client/game/glitch/harthmere_glitch_identity";
import { shouldReloadHarthmereGlitchAuth } from "@/client/game/glitch/harthmere_glitch_auth_reload";
import {
  harthmereBiomesAuthHeaders,
  readHarthmereBiomesAuthSession,
  rememberHarthmereBiomesAuthSession,
} from "@/shared/util/harthmere_auth_session";
import { wireHarthmereCloudSave } from "@/client/util/storage/wire_glitch_cloud_save";
import { rememberHarthmereLiveInstallId } from "@/client/components/harthmere_live_fetch";
import { useEffect } from "react";

const INSTALL_PARAM_NAMES = ["install_id", "installId"];

const INSTALL_STORAGE_KEYS = [
  "glitch.install.id",
  "biomes.localDev.harthmere.localInstallId",
];

const AUTH_GATE_SELECTOR = '[data-harthmere-glitch-auth-waiting="1"]';
const AUTO_AUTH_RELOAD_PARAM = "glitch_biomes_auth";
const AUTO_AUTH_RELOAD_REASON_PARAM = "glitch_biomes_auth_reason";
const AUTO_AUTH_RELOAD_ATTEMPT_KEY =
  "biomes.localDev.harthmere.glitchAutoAuthReloadAttempts";
const AUTO_AUTH_MAX_RELOAD_ATTEMPTS = 2;
const AUTH_CHECK_RETRY_DELAYS_MS = [100, 250, 500, 1000];

function firstString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function isLocalGeneratedInstallId(installId: string) {
  return installId.startsWith("local-");
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

function isGuestLikeIdentity(json: any) {
  return (
    json?.is_guest === true ||
    json?.guest === true ||
    json?.isGuest === true ||
    isGuestLikeString(json?.account_type) ||
    isGuestLikeString(json?.user_type) ||
    isGuestLikeString(json?.license_type) ||
    isGuestLikeString(json?.glitch_user_id) ||
    isGuestLikeString(json?.user_id)
  );
}

export function findInstallId(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const params = new URLSearchParams(window.location.search);
  for (const name of INSTALL_PARAM_NAMES) {
    const value = firstString(params.get(name));
    if (value) {
      return value;
    }
  }

  for (const key of INSTALL_STORAGE_KEYS) {
    try {
      const value = firstString(window.localStorage.getItem(key));
      if (value && !isLocalGeneratedInstallId(value)) {
        return value;
      }
    } catch {
      // Ignore unavailable localStorage.
    }
  }

  return undefined;
}

function persistInstallId(installId: string) {
  for (const key of INSTALL_STORAGE_KEYS) {
    try {
      window.localStorage.setItem(key, installId);
    } catch {
      // Ignore unavailable localStorage.
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isServerAuthGateWaiting() {
  return Boolean(document.querySelector(AUTH_GATE_SELECTOR));
}

function reloadAttemptStorageKey(installId: string) {
  return `${AUTO_AUTH_RELOAD_ATTEMPT_KEY}:${installId}`;
}

function nextReloadAttempt(installId: string) {
  try {
    const key = reloadAttemptStorageKey(installId);
    const next = Number(window.sessionStorage.getItem(key) ?? "0") + 1;
    window.sessionStorage.setItem(key, String(next));
    return next;
  } catch {
    return 1;
  }
}

function clearReloadAttempts(installId: string) {
  try {
    window.sessionStorage.removeItem(reloadAttemptStorageKey(installId));
  } catch {
    // Ignore unavailable sessionStorage.
  }
}

async function waitForBiomesAuth() {
  if (await checkBiomesAuth()) {
    return true;
  }

  for (const delayMs of AUTH_CHECK_RETRY_DELAYS_MS) {
    await sleep(delayMs);
    if (await checkBiomesAuth()) {
      return true;
    }
  }

  return false;
}

export function normalizeIdentity(json: any, installId: string) {
  const guestIdentity = isGuestLikeIdentity(json);
  const rawGlitchUserId =
    firstString(json?.glitch_user_id) ?? firstString(json?.user_id);
  const glitchUserId =
    guestIdentity || isGuestLikeString(rawGlitchUserId)
      ? undefined
      : rawGlitchUserId;

  const biomesUserId = firstString(json?.biomes_user_id);
  const responseGameUserId = firstString(json?.game_user_id);
  const gameUserId =
    !guestIdentity && glitchUserId
      ? `glitch:${glitchUserId}`
      : !guestIdentity &&
        responseGameUserId &&
        !isGuestLikeString(responseGameUserId)
      ? responseGameUserId
      : !guestIdentity && biomesUserId
      ? `biomes:${biomesUserId}`
      : `install:${installId}`;

  const userName =
    firstString(json?.user_name) ??
    firstString(json?.username) ??
    firstString(json?.name) ??
    `glitch-${installId.slice(0, 8)}`;

  return {
    source: "glitch",
    titleId: firstString(json?.title_id),
    installId,
    gameUserId,
    glitchUserId,
    biomesUserId,
    userName,
    licenseType: firstString(json?.license_type),
    validatedAt: new Date().toISOString(),
    raw: json,
  } as any;
}

// HARTHMERE_INSTALL_ID_FLOW
async function checkBiomesAuth(): Promise<boolean> {
  try {
    const existing = await fetch("/api/auth/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...harthmereBiomesAuthHeaders("/api/auth/check"),
      },
      credentials: "same-origin",
      body: JSON.stringify({}),
    });
    return existing.ok;
  } catch {
    return false;
  }
}

function markAutoAuthReload(installId: string, reason: string) {
  const attempt = nextReloadAttempt(installId);
  if (attempt > AUTO_AUTH_MAX_RELOAD_ATTEMPTS) {
    // eslint-disable-next-line no-console
    console.error("HARTHMERE_AUTH_RELOAD_LIMIT", {
      installId,
      reason,
      attempt,
    });
    return false;
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set(AUTO_AUTH_RELOAD_PARAM, "1");
  nextUrl.searchParams.set(AUTO_AUTH_RELOAD_REASON_PARAM, reason);
  // eslint-disable-next-line no-console
  console.info(
    `HARTHMERE_PRE_RELOAD nextUrl=${nextUrl.toString()} reason=${reason} attempt=${attempt}`
  );
  window.location.replace(nextUrl.toString());
  return true;
}

async function autoLoginWithGlitchInstall(installId: string) {
  const response = await fetch("/api/glitch/harthmere", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({
      op: "autoLogin",
      install_id: installId,
      glitch_auto_play: true,
      source: "harthmere_glitch_install_bootstrap",
    }),
  });

  const json = await response.json().catch(() => undefined);
  const hasBiomesSession = Boolean(
    json?.auto_login && json?.biomes_user_id && json?.biomes_session_id
  );

  if (!response.ok || (!json?.valid && !hasBiomesSession)) {
    throw new Error(
      `Glitch install auto-login failed: ${response.status} ${JSON.stringify(
        json
      )}`
    );
  }

  return json;
}

function writeBootstrapIdentity(json: any, installId: string) {
  const previousSession = readHarthmereBiomesAuthSession();
  const identity = normalizeIdentity(json, installId);
  rememberHarthmereBiomesAuthSession({
    userId: json?.biomes_user_id,
    sessionId: json?.biomes_session_id,
    installId,
    titleId: identity.titleId,
  });

  try {
    writeHarthmereGlitchIdentity(identity);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("HARTHMERE_BOOTSTRAP_WRITE_IDENTITY_FAILED", error);
  }

  try {
    window.localStorage.setItem(
      "biomes.localDev.harthmere.glitchBootstrapIdentity",
      JSON.stringify(identity)
    );
  } catch {
    // Ignore unavailable localStorage.
  }

  window.dispatchEvent(
    new CustomEvent(HARTHMERE_GLITCH_IDENTITY_CHANGED_EVENT, {
      detail: identity,
    })
  );

  window.dispatchEvent(
    new CustomEvent("biomes:harthmere-glitch-changed", {
      detail: identity,
    })
  );

  // Preserve the legacy v115 marker so any prior log-pattern scrapers still
  // catch the bootstrap. v127 emits checkpoint markers separately above.
  // eslint-disable-next-line no-console
  console.info("GLITCH_INSTALL_BOOTSTRAP_AUTO_LOGIN", {
    installId,
    gameUserId: identity.gameUserId,
    userName: identity.userName,
    licenseType: identity.licenseType,
  });

  // HARTHMERE_CLOUD_SAVE_WIRING: now that we've resolved a REAL (non-guest)
  // Glitch identity, connect the portable storage layer's Cloud Save adapter so
  // per-player state (stamina, inventory, quests, crate contents, tutorial
  // progress) syncs cross-device. No-op for guests / missing ids. World-altering
  // shared state (buildings/plots/homes) stays server-owned and is NOT routed
  // through Cloud Save.
  try {
    wireHarthmereCloudSave({
      titleId: identity.titleId,
      installId,
      isGuest: isGuestLikeIdentity(json),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("HARTHMERE_CLOUD_SAVE_WIRING_FAILED", error);
  }

  return {
    identity,
    sessionChanged:
      Boolean(json?.biomes_user_id) &&
      String(previousSession?.userId ?? "") !== String(json.biomes_user_id),
  };
}

export function HarthmereGlitchInstallBootstrap() {
  useEffect(() => {
    const installId = findInstallId();
    if (!installId) {
      // eslint-disable-next-line no-console
      console.info("HARTHMERE_INSTALL_NO_ID");
      return;
    }
    // eslint-disable-next-line no-console
    console.info(`HARTHMERE_INSTALL_ID_FOUND installId=${installId}`);

    // HARTHMERE_LIVE_INSTALL_ID_STICKY: seed the sticky install-id cache used by
    // every live-mode fetch, so WRITES always carry the install id (and resolve to
    // the same actor the reads use) even when storage is blocked in the iframe.
    rememberHarthmereLiveInstallId(installId);

    persistInstallId(installId);

    const params =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    const isAfterReload = params.has(AUTO_AUTH_RELOAD_PARAM);

    let cancelled = false;

    (async () => {
      try {
        const initialAuthed = await checkBiomesAuth();
        // eslint-disable-next-line no-console
        console.info(
          `HARTHMERE_INITIAL_AUTH_CHECK authed=${initialAuthed} isAfterReload=${isAfterReload}`
        );

        if (cancelled) return;

        if (initialAuthed) {
          // eslint-disable-next-line no-console
          console.info(
            `HARTHMERE_ALREADY_AUTHED isAfterReload=${isAfterReload}`
          );

          const gateWaitingBeforeRefresh = isServerAuthGateWaiting();
          try {
            const json = await autoLoginWithGlitchInstall(installId);
            if (cancelled) return;
            const { sessionChanged } = writeBootstrapIdentity(json, installId);
            // eslint-disable-next-line no-console
            console.info(
              `HARTHMERE_POST_RELOAD_IDENTITY_REFRESHED gameUserId=${
                json?.game_user_id ?? "(none)"
              }`
            );

            if (
              sessionChanged &&
              shouldReloadHarthmereGlitchAuth({
                isAfterReload,
                serverGateWaiting: gateWaitingBeforeRefresh,
              }) &&
              markAutoAuthReload(installId, "biomes_session_rotated")
            ) {
              return;
            }

            if (gateWaitingBeforeRefresh || isServerAuthGateWaiting()) {
              // /api/auth/check can be true for a signed stateless cookie even
              // when the current SSR render still used the install auth gate
              // because the install-backed user did not exist yet. Refresh the
              // install identity first, then reload the gated SSR page so it can
              // find the freshly-created user and mount the game automatically.
              // HARTHMERE_SERVER_GATE_IDENTITY_REFRESH
              if (
                markAutoAuthReload(installId, "server_gate_identity_refreshed")
              ) {
                return;
              }
              // eslint-disable-next-line no-console
              console.error(
                "HARTHMERE_AUTH_GATE_IDENTITY_REFRESH_RELOAD_LIMIT",
                {
                  installId,
                }
              );
            } else {
              clearReloadAttempts(installId);
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.warn(
              "HARTHMERE_POST_RELOAD_IDENTITY_REFRESH_FAILED",
              error
            );
          }
          return;
        }

        // eslint-disable-next-line no-console
        console.info(`HARTHMERE_AUTO_LOGIN_REQUEST installId=${installId}`);
        const json = await autoLoginWithGlitchInstall(installId);
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.info(
          `HARTHMERE_AUTO_LOGIN_RESPONSE installId=${installId} gameUserId=${
            json?.game_user_id ?? "(none)"
          } biomesUserId=${json?.biomes_user_id ?? "(none)"}`
        );

        writeBootstrapIdentity(json, installId);

        const postLoginAuthed = await waitForBiomesAuth();
        // eslint-disable-next-line no-console
        console.info(
          `HARTHMERE_POST_LOGIN_AUTH_CHECK authed=${postLoginAuthed}`
        );

        if (cancelled) return;

        // The install validation succeeded. Even if the immediate cookie probe
        // loses a race against Set-Cookie visibility, reload the gated /at page
        // once so SSR can re-read cookies. A manual hard refresh was already
        // proving that this path works; do it automatically and cap retries.
        const serverGateWaiting = isServerAuthGateWaiting();
        if (
          (postLoginAuthed || serverGateWaiting) &&
          shouldReloadHarthmereGlitchAuth({
            isAfterReload,
            serverGateWaiting,
          })
        ) {
          const reason = postLoginAuthed
            ? isAfterReload
              ? "auth_cookies_set_after_prior_reload"
              : "auth_cookies_set"
            : "valid_autologin_cookie_check_pending";
          if (markAutoAuthReload(installId, reason)) {
            return;
          }
        }

        if (postLoginAuthed && isAfterReload && !serverGateWaiting) {
          clearReloadAttempts(installId);
          return;
        }

        // eslint-disable-next-line no-console
        console.error("HARTHMERE_AUTH_COOKIE_MISSING", {
          installId,
          gameUserId: json?.game_user_id,
          isAfterReload,
          serverGateWaiting,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("HARTHMERE_INSTALL_BOOTSTRAP_FAILED", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
