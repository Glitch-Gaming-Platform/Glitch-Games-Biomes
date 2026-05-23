import {
  HARTHMERE_GLITCH_IDENTITY_CHANGED_EVENT,
  writeHarthmereGlitchIdentity,
} from "@/client/game/glitch/harthmere_glitch_identity";
import { useEffect } from "react";

const INSTALL_PARAM_NAMES = [
  "install_id",
  "glitch_install_id",
  "installId",
  "game_install_id",
];

const INSTALL_STORAGE_KEYS = [
  "glitch.install.id",
  "glitch_install_id",
  "game_install_id",
  "biomes.localDev.harthmere.localInstallId.v1",
];

function firstString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isLocalGeneratedInstallId(installId: string) {
  return installId.startsWith("local-");
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

export function normalizeIdentity(json: any, installId: string) {
  const glitchUserId =
    firstString(json?.glitch_user_id) ?? firstString(json?.user_id);

  const gameUserId =
    firstString(json?.game_user_id) ??
    (glitchUserId ? `glitch:${glitchUserId}` : `install:${installId}`);

  const userName =
    firstString(json?.user_name) ??
    firstString(json?.username) ??
    firstString(json?.name) ??
    `glitch-${installId.slice(0, 8)}`;

  return {
    titleId: firstString(json?.title_id),
    installId,
    gameUserId,
    glitchUserId,
    userName,
    licenseType: firstString(json?.license_type),
    validatedAt: new Date().toISOString(),
    raw: json,
  } as any;
}

// HARTHMERE_INSTALL_ID_FLOW_V127
async function checkBiomesAuth(): Promise<boolean> {
  try {
    const existing = await fetch("/api/auth/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({}),
    });
    return existing.ok;
  } catch {
    return false;
  }
}

function markAutoAuthReload() {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("glitch_biomes_auth", "1");
  // eslint-disable-next-line no-console
  console.info(
    `HARTHMERE_PRE_RELOAD_V127 nextUrl=${nextUrl.toString()} reason=auth_cookies_set`
  );
  window.location.replace(nextUrl.toString());
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
      source: "harthmere_glitch_install_bootstrap_v127",
    }),
  });

  const json = await response.json().catch(() => undefined);

  if (!response.ok || !json?.valid) {
    throw new Error(
      `Glitch install auto-login failed: ${response.status} ${JSON.stringify(json)}`
    );
  }

  return json;
}

function writeBootstrapIdentity(json: any, installId: string) {
  const identity = normalizeIdentity(json, installId);

  try {
    writeHarthmereGlitchIdentity(identity);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("HARTHMERE_BOOTSTRAP_WRITE_IDENTITY_FAILED_V127", error);
  }

  try {
    window.localStorage.setItem(
      "biomes.localDev.harthmere.glitchBootstrapIdentity.v90",
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
  console.info("GLITCH_INSTALL_BOOTSTRAP_AUTO_LOGIN_V115", {
    installId,
    gameUserId: identity.gameUserId,
    userName: identity.userName,
    licenseType: identity.licenseType,
  });

  return identity;
}

export function HarthmereGlitchInstallBootstrap() {
  useEffect(() => {
    const installId = findInstallId();
    if (!installId) {
      // eslint-disable-next-line no-console
      console.info("HARTHMERE_INSTALL_NO_ID_V127");
      return;
    }
    // eslint-disable-next-line no-console
    console.info(`HARTHMERE_INSTALL_ID_FOUND_V127 installId=${installId}`);

    persistInstallId(installId);

    const params =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    const isAfterReload = params.has("glitch_biomes_auth");

    let cancelled = false;

    (async () => {
      try {
        const initialAuthed = await checkBiomesAuth();
        // eslint-disable-next-line no-console
        console.info(
          `HARTHMERE_INITIAL_AUTH_CHECK_V127 authed=${initialAuthed} isAfterReload=${isAfterReload}`
        );

        if (cancelled) return;

        if (initialAuthed) {
          // Already authed (e.g. post-reload). Skip the autoLogin
          // round-trip because cookies are already valid. Refresh identity
          // in the background but never block on it.
          // eslint-disable-next-line no-console
          console.info(
            `HARTHMERE_ALREADY_AUTHED_V127 isAfterReload=${isAfterReload}`
          );

          autoLoginWithGlitchInstall(installId)
            .then((json) => {
              if (cancelled) return;
              writeBootstrapIdentity(json, installId);
              // eslint-disable-next-line no-console
              console.info(
                `HARTHMERE_POST_RELOAD_IDENTITY_REFRESHED_V127 gameUserId=${json?.game_user_id ?? "(none)"}`
              );
            })
            .catch((error) => {
              // eslint-disable-next-line no-console
              console.warn(
                "HARTHMERE_POST_RELOAD_IDENTITY_REFRESH_FAILED_V127",
                error
              );
            });
          return;
        }

        // eslint-disable-next-line no-console
        console.info(
          `HARTHMERE_AUTO_LOGIN_REQUEST_V127 installId=${installId}`
        );
        const json = await autoLoginWithGlitchInstall(installId);
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.info(
          `HARTHMERE_AUTO_LOGIN_RESPONSE_V127 installId=${installId} gameUserId=${json?.game_user_id ?? "(none)"} biomesUserId=${json?.biomes_user_id ?? "(none)"}`
        );

        writeBootstrapIdentity(json, installId);

        const postLoginAuthed = await checkBiomesAuth();
        // eslint-disable-next-line no-console
        console.info(
          `HARTHMERE_POST_LOGIN_AUTH_CHECK_V127 authed=${postLoginAuthed}`
        );

        if (cancelled) return;

        if (postLoginAuthed) {
          markAutoAuthReload();
          return;
        }

        // eslint-disable-next-line no-console
        console.error("HARTHMERE_AUTH_COOKIE_MISSING_V127", {
          installId,
          gameUserId: json?.game_user_id,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("HARTHMERE_INSTALL_BOOTSTRAP_FAILED_V127", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
