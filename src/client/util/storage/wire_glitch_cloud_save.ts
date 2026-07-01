// HARTHMERE PORTABLE STORAGE — Cloud Save wiring
//
// Connects the shared storage layer's Cloud Save adapter to the live Glitch save
// API (proxied by the game server at POST /api/glitch/harthmere with an `op`).
// Call `wireHarthmereCloudSave(...)` once, right after the Glitch install has
// authenticated to a REAL (non-guest) user — Cloud Save is per-player and the
// guide forbids guest saves.
//
// After registration the layer's per-player state (stamina, inventory, quests,
// crate contents, tutorial progress, ...) is loaded from the cloud into the cache
// and every subsequent write is debounced up to the reserved save slot. World-
// altering, shared state (buildings/plots/homes) is intentionally NOT routed here
// — that stays server-owned in the world (Redis) so all players see it.

import {
  GlitchCloudSaveBlobTransport,
  type CloudSaveHttp,
} from "./glitch_cloud_save_transport";
import { harthmereCloudSaveTransport, harthmereStorage } from "./index";

let wired = false;

/** Reset flag — test-only. */
export function resetHarthmereCloudSaveWiringForTest(): void {
  wired = false;
}

/**
 * The default HTTP transport: POST the documented ops to the game server's Glitch
 * proxy. Never throws (returns status 0 on network failure) so a Cloud Save
 * outage can never break gameplay writes.
 */
export function defaultCloudSaveHttp(): CloudSaveHttp {
  return {
    async request(op, body) {
      try {
        const response = await fetch("/api/glitch/harthmere", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ op, ...body }),
        });
        const json = await response.json().catch(() => ({}));
        return { status: response.status, json };
      } catch {
        return { status: 0, json: {} };
      }
    },
  };
}

export function wireHarthmereCloudSave(params: {
  titleId?: string;
  installId?: string;
  isGuest: boolean;
  http?: CloudSaveHttp;
}): boolean {
  if (wired) {
    return true;
  }
  const { titleId, installId, isGuest } = params;
  // Cloud Save requires a real user + a title/install to key the save to.
  if (!titleId || !installId || isGuest) {
    return false;
  }
  wired = true;

  harthmereCloudSaveTransport.register(
    new GlitchCloudSaveBlobTransport(params.http ?? defaultCloudSaveHttp(), {
      titleId,
      installId,
      // Guest-ness was already checked above; the transport just needs the ids.
      isAuthenticated: () => true,
    })
  );

  // Pull the player's persisted per-device state into the synchronous cache.
  void harthmereStorage.hydrate();
  return true;
}
