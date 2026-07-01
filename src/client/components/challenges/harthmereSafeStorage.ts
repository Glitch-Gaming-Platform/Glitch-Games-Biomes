import { harthmereLocalStorage } from "@/client/util/storage";
// HARTHMERE_SAFE_STORAGE (2026-07-01)
//
// The live Harthmere client runs EMBEDDED IN A CROSS-ORIGIN IFRAME on glitch.fun
// (the game document is served from *.azurecontainerapps.io and framed by
// glitch.fun). In that context modern browsers either PARTITION third-party
// storage or, under stricter privacy modes (Safari ITP, "block all cookies",
// private windows), BLOCK it entirely — so `window.localStorage.getItem/setItem`
// can THROW a SecurityError instead of returning/persisting.
//
// A large number of Harthmere client systems (container/crate contents, food &
// stamina survival state, mission mirrors, inventory/hotbar snapshots, tutorial
// progress) persisted directly through `window.localStorage`. The READS were
// usually wrapped in try/catch, but many WRITES were not — so the throw would
// abort the very action the player just took (open the clothing crate, eat food,
// pick up an item), which is why those features "did nothing" in the iframe even
// though the code was correct.
//
// This module is a single drop-in replacement for the localStorage calls those
// systems make. It:
//   * NEVER throws — every method is safe to call unconditionally.
//   * Uses real `window.localStorage` when the browser genuinely allows it
//     (normal first-party play, so state still persists across reloads there).
//   * Falls back to an in-memory key/value store when storage is unavailable, so
//     every gameplay system keeps working for the whole session inside the iframe.
//   * Mirrors every write into memory as well, so a read succeeds this session
//     even if the persistent write was rejected.
//
// Availability is probed once (it does not change within a page load) to avoid
// paying a try/catch on every access.

const memoryStore = new Map<string, string>();

let probed = false;
let persistentUsable = false;

/**
 * Detect whether `window.localStorage` can actually be read AND written in this
 * context. A cross-origin iframe with blocked storage throws on access, so we
 * probe with a temporary key rather than trusting `typeof window.localStorage`.
 */
function persistentStorageUsable(): boolean {
  if (probed) {
    return persistentUsable;
  }
  probed = true;
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      persistentUsable = false;
      return false;
    }
    const probeKey = "__harthmere_safe_storage_probe__";
    harthmereLocalStorage.setItem(probeKey, "1");
    harthmereLocalStorage.removeItem(probeKey);
    persistentUsable = true;
  } catch {
    // Storage is blocked/partitioned/denied in this iframe.
    persistentUsable = false;
  }
  return persistentUsable;
}

/** True when real cross-reload persistence is available in this context. */
export function harthmereStoragePersists(): boolean {
  return persistentStorageUsable();
}

/** localStorage.getItem replacement that never throws. */
export function harthmereSafeGetItem(key: string): string | null {
  if (persistentStorageUsable()) {
    try {
      const value = harthmereLocalStorage.getItem(key);
      if (value !== null) {
        return value;
      }
    } catch {
      // fall through to the in-memory mirror
    }
  }
  return memoryStore.has(key) ? (memoryStore.get(key) as string) : null;
}

/** localStorage.setItem replacement that never throws. */
export function harthmereSafeSetItem(key: string, value: string): void {
  // Always keep the in-memory mirror current so reads succeed this session even
  // when the persistent write below is rejected.
  memoryStore.set(key, value);
  if (persistentStorageUsable()) {
    try {
      harthmereLocalStorage.setItem(key, value);
    } catch {
      // Blocked/full: the in-memory mirror keeps the system working this session.
    }
  }
}

/** localStorage.removeItem replacement that never throws. */
export function harthmereSafeRemoveItem(key: string): void {
  memoryStore.delete(key);
  if (persistentStorageUsable()) {
    try {
      harthmereLocalStorage.removeItem(key);
    } catch {
      // Ignore: nothing persisted, nothing to remove.
    }
  }
}
