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

function findInstallId(): string | undefined {
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
      if (value) {
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

function normalizeIdentity(json: any, installId: string) {
  const glitchUserId =
    firstString(json?.glitch_user_id) ??
    firstString(json?.user_id);

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


// GLITCH_BIOMES_DEV_AUTH_BRIDGE_V100
async function ensureBiomesDevAuth(identity: any, installId: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const existing = await fetch("/api/auth/check", {
      credentials: "same-origin",
    });
    if (existing.ok) {
      return;
    }
  } catch {
    // Continue and try to create the local auth session.
  }

  const throttleKey = `biomes.localDev.harthmere.biomesAuthAttempt.v100:${installId}`;
  const lastAttempt = Number(window.sessionStorage.getItem(throttleKey) || "0");
  if (Date.now() - lastAttempt < 30000) {
    return;
  }
  window.sessionStorage.setItem(throttleKey, String(Date.now()));

  const username =
    identity?.userName ||
    identity?.username ||
    identity?.glitchUserId ||
    `glitch-${installId.slice(0, 8)}`;

  console.info("GLITCH_BIOMES_DEV_AUTH_BRIDGE_V100 creating Biomes dev auth", {
    username,
    installId,
  });

  const response = await fetch(
    `/api/auth/dev/login?usernameOrId=${encodeURIComponent(username)}`,
    {
      method: "POST",
      credentials: "same-origin",
    }
  );

  if (!response.ok && !response.redirected) {
    console.error("GLITCH_BIOMES_DEV_AUTH_BRIDGE_V100 dev auth failed", {
      status: response.status,
      text: await response.text().catch(() => ""),
    });
    return;
  }

  window.sessionStorage.setItem(
    `biomes.localDev.harthmere.biomesAuthInstalled.v100:${installId}`,
    "1"
  );

  window.location.replace(window.location.href);
}

async function validateGlitchInstall(installId: string) {
  const response = await fetch("/api/glitch/harthmere", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({
      op: "validate",
      install_id: installId,
      glitch_auto_play: true,
      source: "harthmere_glitch_install_bootstrap_v90",
    }),
  });

  const json = await response.json().catch(() => undefined);

  if (!response.ok || !json?.valid) {
    throw new Error(
      `Glitch install validation failed: ${response.status} ${JSON.stringify(json)}`
    );
  }

  return json;
}

export function HarthmereGlitchInstallBootstrap() {
  useEffect(() => {
    const installId = findInstallId();
    if (!installId) {
      return;
    }

    persistInstallId(installId);

    let cancelled = false;

    validateGlitchInstall(installId)
      .then(async (json) => {
        if (cancelled) {
          return;
        }

        const identity = normalizeIdentity(json, installId);

        try {
          writeHarthmereGlitchIdentity(identity);
        } catch (error) {
          console.warn("GLITCH_BOOTSTRAP_WRITE_IDENTITY_FAILED", error);
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

        await ensureBiomesDevAuth(identity, installId);

        console.info("GLITCH_INSTALL_BOOTSTRAP_VALIDATED_V90", {
          installId,
          gameUserId: identity.gameUserId,
          userName: identity.userName,
          licenseType: identity.licenseType,
        });
      })
      .catch((error) => {
        console.error("GLITCH_INSTALL_BOOTSTRAP_FAILED_V90", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
