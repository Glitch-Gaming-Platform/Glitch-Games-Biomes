// HARTHMERE PORTABLE STORAGE — public entry point & default wiring
//
// Import this module to get:
//   * `harthmereStorage`      — the shared `LayeredStorage` instance.
//   * `harthmereLocalStorage` — a `localStorage`-shaped view of it. This is the
//                               drop-in the ~176 call sites use in place of
//                               `window.localStorage`.
//   * the adapter classes + `LayeredStorage`, for building custom stores.
//
// Default backend chain (see README): a synchronous localStorage MIRROR for
// immediate durable reads/writes, the in-memory cache for the blocked-iframe
// fallback, and the Glitch Cloud Save adapter for cross-device durability once
// the Glitch bridge registers its transport.

import {
  GlitchCloudSaveAdapter,
  type BlobSaveTransport,
  type WebStorageLike,
} from "./adapters";
import { LayeredStorage } from "./layered_storage";

export * from "./types";
export * from "./adapters";
export { LayeredStorage } from "./layered_storage";
export type { LayeredStorageOptions } from "./layered_storage";

/** Guarded access to `window.localStorage` (its getter can throw in an iframe). */
function browserLocalStorage(): WebStorageLike | undefined {
  try {
    if (typeof window === "undefined") {
      return undefined;
    }
    return window.localStorage as unknown as WebStorageLike;
  } catch {
    return undefined;
  }
}

const dynamicBrowserLocalStorage: WebStorageLike = {
  getItem(key) {
    const storage = browserLocalStorage();
    if (!storage) {
      throw new Error("browser localStorage is unavailable");
    }
    return storage.getItem(key);
  },
  setItem(key, value) {
    browserLocalStorage()?.setItem(key, value);
  },
  removeItem(key) {
    browserLocalStorage()?.removeItem(key);
  },
  key(index) {
    return browserLocalStorage()?.key(index) ?? null;
  },
  get length() {
    return browserLocalStorage()?.length ?? 0;
  },
};

/**
 * A Cloud Save transport whose real implementation is registered at runtime by
 * the Glitch bridge once the session is authenticated (it calls
 * `requestGlitch("storeSave" / "listSaves", ...)`). Until then `isReady()`
 * resolves `false`, so the Cloud Save adapter is transparently skipped and the
 * layer runs on the localStorage mirror + in-memory cache. Every method is
 * guarded so a mis-behaving transport can never break gameplay writes.
 */
class RegisterableBlobSaveTransport implements BlobSaveTransport {
  private impl: BlobSaveTransport | undefined;

  register(impl: BlobSaveTransport): void {
    this.impl = impl;
  }
  unregister(): void {
    this.impl = undefined;
  }
  async isReady(): Promise<boolean> {
    try {
      return this.impl ? await this.impl.isReady() : false;
    } catch {
      return false;
    }
  }
  async load(): Promise<Record<string, string> | null> {
    try {
      return this.impl ? await this.impl.load() : null;
    } catch {
      return null;
    }
  }
  async store(snapshot: Record<string, string>): Promise<void> {
    if (!this.impl) {
      return;
    }
    // The adapter's flush boundary catches failures and keeps its snapshot
    // dirty. Swallowing here incorrectly marked conflict-paused writes as
    // successfully durable.
    await this.impl.store(snapshot);
  }
}

/** Register the concrete Glitch Cloud Save transport from the Glitch bridge. */
export const harthmereCloudSaveTransport = new RegisterableBlobSaveTransport();

const cloudSaveAdapter = new GlitchCloudSaveAdapter(
  harthmereCloudSaveTransport
);

/**
 * The shared storage instance. Call `harthmereStorage.hydrate()` once at startup
 * (after the Cloud Save transport is registered, if any) to pull persisted state
 * into the cache; reads/writes are safe before then and simply run on the
 * synchronous localStorage mirror.
 */
export const harthmereStorage = new LayeredStorage([cloudSaveAdapter], {
  syncMirror: dynamicBrowserLocalStorage,
});

/**
 * Drop-in replacement for `window.localStorage`. Migrate a call site by swapping
 * `window.localStorage` → `harthmereLocalStorage` (identical synchronous API),
 * which gains blocked-iframe safety and, once wired, Cloud Save persistence.
 */
export const harthmereLocalStorage = harthmereStorage.asLocalStorage();
