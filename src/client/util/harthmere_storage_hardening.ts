// HARTHMERE_STORAGE_HARDENING (2026-07-01)
//
// The live Harthmere client runs embedded in a CROSS-ORIGIN IFRAME on glitch.fun
// (the game is served from *.azurecontainerapps.io and framed by glitch.fun).
// In that context browsers partition third-party storage or, under stricter
// privacy modes (Safari ITP, "block all cookies", private windows), block it
// entirely — so `localStorage.setItem/getItem/removeItem` can THROW a
// SecurityError.
//
// The Harthmere client has ~176 direct localStorage call sites (container/crate
// contents, food & stamina, missions, inventory/hotbar snapshots, tutorial
// progress). Many WRITES were unguarded, so a single throw aborted the exact
// action the player just took — which is why eating, picking up items, and
// opening the clothing crate "did nothing" in the iframe even though the logic
// was correct.
//
// Rather than edit every call site, this installs a ONE-TIME global hardening of
// the shared `Storage.prototype` so that EVERY `localStorage`/`sessionStorage`
// call — from any module — becomes safe:
//   * `setItem` mirrors the value into an in-memory map and best-effort persists;
//     a blocked/partitioned/quota throw is swallowed.
//   * `getItem` returns the persisted value when available, else the in-memory
//     mirror, else null. It never throws.
//   * `removeItem`/`clear` update both layers and never throw.
//
// The in-memory mirror is per-Storage-instance (WeakMap keyed by the Storage
// object), so localStorage and sessionStorage stay separate and we never touch
// the `window.localStorage` getter (which can itself throw in blocked contexts).
//
// Net effect: inside the iframe every storage-backed system keeps working for the
// session (state simply doesn't persist across reloads when the browser forbids
// persistence); in a normal first-party tab real localStorage is used and
// persists exactly as before.

let installed = false;

// Per-Storage-instance in-memory fallback. Keyed by the actual Storage object so
// we never have to read `window.localStorage` (whose getter can throw).
const fallbackByStore = new WeakMap<Storage, Map<string, string>>();

function fallbackFor(store: Storage): Map<string, string> {
  let map = fallbackByStore.get(store);
  if (!map) {
    map = new Map<string, string>();
    fallbackByStore.set(store, map);
  }
  return map;
}

export function installHarthmereStorageHardening(): void {
  if (installed) {
    return;
  }
  installed = true;
  if (typeof window === "undefined") {
    return; // SSR / non-browser: nothing to harden.
  }

  const StorageCtor: typeof Storage | undefined = (window as any).Storage;
  const proto = StorageCtor && StorageCtor.prototype;
  if (!proto) {
    return; // Ancient/unusual environment without the Storage interface.
  }

  const origGetItem = proto.getItem;
  const origSetItem = proto.setItem;
  const origRemoveItem = proto.removeItem;
  const origClear = proto.clear;

  try {
    proto.getItem = function (this: Storage, key: string): string | null {
      const k = String(key);
      try {
        const value = origGetItem.call(this, k);
        if (value !== null && value !== undefined) {
          return value;
        }
      } catch {
        // Persistent read blocked; fall through to the in-memory mirror.
      }
      const map = fallbackByStore.get(this);
      return map && map.has(k) ? (map.get(k) as string) : null;
    };

    proto.setItem = function (this: Storage, key: string, value: string): void {
      const k = String(key);
      // Always mirror in memory so subsequent reads succeed this session.
      fallbackFor(this).set(k, String(value));
      try {
        origSetItem.call(this, k, value);
      } catch {
        // Blocked/partitioned/quota: the in-memory mirror keeps this working.
      }
    };

    proto.removeItem = function (this: Storage, key: string): void {
      const k = String(key);
      const map = fallbackByStore.get(this);
      if (map) {
        map.delete(k);
      }
      try {
        origRemoveItem.call(this, k);
      } catch {
        // Nothing persisted to remove.
      }
    };

    proto.clear = function (this: Storage): void {
      const map = fallbackByStore.get(this);
      if (map) {
        map.clear();
      }
      try {
        origClear.call(this);
      } catch {
        // Nothing persisted to clear.
      }
    };
  } catch {
    // Storage.prototype is frozen or read-only in this environment. The explicit
    // per-system safe-storage wrappers (harthmereSafeStorage.ts) still cover the
    // critical gameplay systems even when this global patch cannot be applied.
    installed = false;
  }
}
