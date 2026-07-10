// HARTHMERE PORTABLE STORAGE — the layered manager + synchronous facade
//
// `LayeredStorage` composes an ordered list of `StorageAdapter`s (highest read
// priority first) behind ONE in-memory cache. That cache is the synchronous
// source of truth the game reads/writes; the adapters provide persistence.
//
//   reads   → served synchronously from the cache (never throw, never block).
//   writes  → update the cache synchronously, then flush to every AVAILABLE
//             durable adapter in the background (write-through).
//   hydrate → on startup, load persisted keys from the durable adapters into the
//             cache (highest-priority adapter wins on conflicts).
//
// This is what lets ~176 existing `window.localStorage.getItem/setItem` call
// sites migrate with a one-line swap to `harthmereStorage.local` while gaining
// blocked-iframe safety and optional Cloud-Save/DB persistence — WITHOUT being
// rewritten to async.
//
// See ./README.md.

import type { WebStorageLike } from "./adapters";
import type {
  StorageAdapter,
  StorageKey,
  StorageValue,
  SyncKeyValueStore,
} from "./types";

// Local, dependency-free diagnostics. We deliberately avoid importing the shared
// logger here so this module (and its unit tests) stay decoupled from the
// client/server logging config. Failures are best-effort diagnostics only.
function warn(message: string, error: unknown): void {
  try {
    // eslint-disable-next-line no-console
    console.warn(`[harthmereStorage] ${message}`, error);
  } catch {
    /* ignore */
  }
}

export interface LayeredStorageOptions {
  /**
   * Optional key namespace. When set, all keys are transparently prefixed with
   * `${namespace}:` in the backends, so multiple logical stores (or per-user
   * scopes) can share the same physical adapters without colliding.
   */
  namespace?: string;

  /**
   * Optional SYNCHRONOUS durable mirror — almost always `window.localStorage`.
   * Because the async adapters cannot answer a read until `hydrate()` finishes,
   * the sync facade also reads/writes this mirror directly so localStorage-backed
   * values are available immediately on the first frame, exactly as raw
   * `window.localStorage` was. Every access is guarded, so a blocked iframe just
   * skips the mirror and relies on the in-memory cache + async adapters. Provide
   * `undefined` (or omit) when no synchronous durable store exists.
   */
  syncMirror?: WebStorageLike;
}

export class LayeredStorage {
  /** Synchronous source of truth in front of the async adapters. */
  private readonly cache = new Map<StorageKey, StorageValue>();
  private readonly adapters: readonly StorageAdapter[];
  private readonly namespace?: string;
  private readonly syncMirror?: WebStorageLike;
  private hydrated = false;
  private hydrating: Promise<void> | undefined;

  constructor(adapters: StorageAdapter[], options: LayeredStorageOptions = {}) {
    if (adapters.length === 0) {
      throw new Error("LayeredStorage requires at least one adapter");
    }
    this.adapters = adapters;
    this.namespace = options.namespace;
    this.syncMirror = options.syncMirror;
  }

  /** Guarded synchronous read of the durable mirror (localStorage). */
  private mirrorGet(physicalKey: StorageKey): {
    available: boolean;
    value: StorageValue | null;
  } {
    try {
      if (!this.syncMirror) {
        return { available: false, value: null };
      }
      return {
        available: true,
        value: this.syncMirror.getItem(physicalKey),
      };
    } catch {
      return { available: false, value: null };
    }
  }
  private mirrorSet(physicalKey: StorageKey, value: StorageValue): void {
    try {
      this.syncMirror?.setItem(physicalKey, value);
    } catch {
      /* blocked/full: rely on cache + async adapters */
    }
  }
  private mirrorRemove(physicalKey: StorageKey): void {
    try {
      this.syncMirror?.removeItem(physicalKey);
    } catch {
      /* ignore */
    }
  }

  private physicalKey(key: StorageKey): StorageKey {
    return this.namespace ? `${this.namespace}:${key}` : key;
  }
  private logicalKey(physical: StorageKey): StorageKey | undefined {
    if (!this.namespace) {
      return physical;
    }
    const prefix = `${this.namespace}:`;
    return physical.startsWith(prefix)
      ? physical.slice(prefix.length)
      : undefined;
  }

  /**
   * Load persisted state into the cache. Idempotent and safe to call more than
   * once (concurrent calls share one in-flight promise). Iterates adapters from
   * lowest to highest priority so that, after all writes, the highest-priority
   * adapter's value wins on any key present in several backends.
   */
  async hydrate(): Promise<void> {
    if (this.hydrated) {
      return;
    }
    if (this.hydrating) {
      return this.hydrating;
    }
    this.hydrating = (async () => {
      for (const adapter of [...this.adapters].reverse()) {
        try {
          if (!(await adapter.isAvailable())) {
            continue;
          }
          for (const physical of await adapter.keys()) {
            const logical = this.logicalKey(physical);
            if (logical === undefined) {
              continue; // key belongs to a different namespace
            }
            const value = await adapter.get(physical);
            if (value !== null) {
              this.cache.set(logical, value);
            }
          }
        } catch (error) {
          warn(`hydrate failed for adapter ${adapter.name}`, error);
        }
      }
      this.hydrated = true;
      this.hydrating = undefined;
    })();
    return this.hydrating;
  }

  // --- Synchronous API (cache-backed) -------------------------------------

  getItem(key: StorageKey): StorageValue | null {
    // The synchronous durable mirror is authoritative whenever it is available.
    // This keeps the facade aligned with legacy code, other tabs, and bootstrap
    // paths that may still write directly to window.localStorage.
    const mirrored = this.mirrorGet(this.physicalKey(key));
    if (mirrored.available) {
      if (mirrored.value === null) {
        this.cache.delete(key);
        return null;
      }
      this.cache.set(key, mirrored.value);
      return mirrored.value;
    }
    return this.cache.get(key) ?? null;
  }

  setItem(key: StorageKey, value: StorageValue): void {
    this.cache.set(key, value);
    const physical = this.physicalKey(key);
    // Synchronous durable write first (immediate persistence when allowed).
    this.mirrorSet(physical, value);
    for (const adapter of this.adapters) {
      // Fire-and-forget write-through; availability is re-checked per adapter so
      // a backend that comes online later starts receiving writes.
      void this.writeThrough(adapter, physical, value);
    }
  }

  removeItem(key: StorageKey): void {
    this.cache.delete(key);
    const physical = this.physicalKey(key);
    this.mirrorRemove(physical);
    for (const adapter of this.adapters) {
      void adapter
        .isAvailable()
        .then((ok) => (ok ? adapter.remove(physical) : undefined))
        .catch(() => undefined);
    }
  }

  clear(): void {
    // Remove only the keys we know about from the synchronous mirror so we do not
    // wipe unrelated data other libraries put in the same localStorage bucket.
    for (const key of this.cache.keys()) {
      this.mirrorRemove(this.physicalKey(key));
    }
    this.cache.clear();
    for (const adapter of this.adapters) {
      void adapter
        .isAvailable()
        .then((ok) => (ok ? adapter.clear() : undefined))
        .catch(() => undefined);
    }
  }

  key(index: number): StorageKey | null {
    if (index < 0) {
      return null;
    }
    let i = 0;
    for (const key of this.cache.keys()) {
      if (i === index) {
        return key;
      }
      i++;
    }
    return null;
  }

  get length(): number {
    return this.cache.size;
  }

  private async writeThrough(
    adapter: StorageAdapter,
    physicalKey: StorageKey,
    value: StorageValue
  ): Promise<void> {
    try {
      if (await adapter.isAvailable()) {
        await adapter.set(physicalKey, value);
      }
    } catch (error) {
      // Never let a persistence failure surface to the caller; the cache already
      // holds the value for this session.
      warn(`write-through failed for adapter ${adapter.name}`, error);
    }
  }

  // --- Adapters / diagnostics ---------------------------------------------

  /** The adapters in priority order (read-only view for diagnostics/flush). */
  get backends(): readonly StorageAdapter[] {
    return this.adapters;
  }

  /**
   * A `localStorage`-shaped view of this store. This is the object the ~176 call
   * sites use in place of `window.localStorage`.
   */
  asLocalStorage(): SyncKeyValueStore {
    // Capture the instance so the `length` getter reflects live cache size.
    const store = this;
    return {
      getItem: (key) => store.getItem(key),
      setItem: (key, value) => store.setItem(key, value),
      removeItem: (key) => store.removeItem(key),
      clear: () => store.clear(),
      key: (index) => store.key(index),
      get length() {
        return store.length;
      },
    };
  }
}
