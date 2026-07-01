// HARTHMERE PORTABLE STORAGE — backend adapters
//
// Concrete `StorageAdapter` implementations. All are dependency-injected so they
// can be unit-tested without a browser or network:
//   * MemoryStorageAdapter    — in-process Map. Always available, never durable.
//   * LocalStorageAdapter     — wraps a Web Storage object; probes availability
//                               and never throws (safe in blocked iframes).
//   * GlitchCloudSaveAdapter  — the Glitch Cloud Save API (a whole-blob snapshot
//                               keyed by user/slot); an injectable transport does
//                               the actual load/store.
//   * RestDatabaseAdapter     — a generic per-key REST/database service via an
//                               injectable key/value transport.
//
// See ./README.md for how these compose in `LayeredStorage`.

import type { StorageAdapter, StorageKey, StorageValue } from "./types";

/**
 * In-memory backend. Always available; contents are lost on reload. Acts as the
 * universal fallback so the layered store keeps working when every durable
 * backend is unavailable.
 */
export class MemoryStorageAdapter implements StorageAdapter {
  readonly name = "memory";
  readonly durable = false;
  private readonly store = new Map<StorageKey, StorageValue>();

  async isAvailable(): Promise<boolean> {
    return true;
  }
  async get(key: StorageKey): Promise<StorageValue | null> {
    return this.store.has(key) ? (this.store.get(key) as StorageValue) : null;
  }
  async set(key: StorageKey, value: StorageValue): Promise<void> {
    this.store.set(key, value);
  }
  async remove(key: StorageKey): Promise<void> {
    this.store.delete(key);
  }
  async keys(): Promise<StorageKey[]> {
    return [...this.store.keys()];
  }
  async clear(): Promise<void> {
    this.store.clear();
  }
}

/**
 * The minimal slice of the Web Storage API this adapter needs. Injected so tests
 * can supply a fake (including one that throws to simulate a blocked iframe).
 */
export interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

/**
 * Wraps a Web Storage object (`window.localStorage`/`sessionStorage`). Every
 * operation is guarded, so a `SecurityError`/`QuotaExceededError` in a
 * blocked/partitioned iframe degrades to "unavailable" instead of throwing.
 *
 * Availability is probed with a throwaway write and cached for the session,
 * because a cross-origin iframe can expose the object yet reject every call.
 *
 * An optional `keyPredicate` restricts which keys this adapter reports from
 * `keys()`/`clear()`, so the storage layer does not vacuum unrelated keys that
 * other libraries put in the same Web Storage bucket.
 */
export class LocalStorageAdapter implements StorageAdapter {
  readonly name: string;
  readonly durable = true;
  private available: boolean | undefined;

  constructor(
    private readonly backing: WebStorageLike | undefined,
    private readonly options: {
      name?: string;
      keyPredicate?: (key: string) => boolean;
    } = {}
  ) {
    this.name = options.name ?? "localStorage";
  }

  async isAvailable(): Promise<boolean> {
    if (this.available !== undefined) {
      return this.available;
    }
    this.available = false;
    try {
      if (!this.backing) {
        return false;
      }
      const probe = "__harthmere_storage_probe__";
      this.backing.setItem(probe, "1");
      this.backing.removeItem(probe);
      this.available = true;
    } catch {
      this.available = false;
    }
    return this.available;
  }

  async get(key: StorageKey): Promise<StorageValue | null> {
    try {
      return this.backing?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  async set(key: StorageKey, value: StorageValue): Promise<void> {
    try {
      this.backing?.setItem(key, value);
    } catch {
      // Blocked/full: treated as best-effort. LayeredStorage still has memory.
    }
  }
  async remove(key: StorageKey): Promise<void> {
    try {
      this.backing?.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  async keys(): Promise<StorageKey[]> {
    const result: StorageKey[] = [];
    try {
      if (!this.backing) {
        return result;
      }
      for (let i = 0; i < this.backing.length; i++) {
        const key = this.backing.key(i);
        if (key !== null && (this.options.keyPredicate?.(key) ?? true)) {
          result.push(key);
        }
      }
    } catch {
      /* ignore */
    }
    return result;
  }
  async clear(): Promise<void> {
    // Only clear keys we own (respecting keyPredicate) so we don't wipe unrelated
    // data sharing the same bucket.
    const owned = await this.keys();
    for (const key of owned) {
      await this.remove(key);
    }
  }
}

/**
 * Transport for a blob-snapshot cloud save (the Glitch Cloud Save model): the
 * whole key/value map is stored/loaded as one document, keyed server-side by the
 * authenticated user + slot. Injected so the adapter is testable and decoupled
 * from the concrete `requestGlitch("storeSave"/"listSaves", ...)` calls.
 */
export interface BlobSaveTransport {
  /** Load the saved key/value map, or null if none/unavailable. */
  load(): Promise<Record<string, string> | null>;
  /** Persist the entire key/value map as one snapshot. */
  store(snapshot: Record<string, string>): Promise<void>;
  /** Whether the transport can currently be used (authenticated, online). */
  isReady(): Promise<boolean>;
}

/**
 * Durable backend on top of a blob-snapshot API such as Glitch Cloud Save. It
 * keeps an in-memory snapshot loaded via `transport.load()` and serves per-key
 * reads/writes against it; writes schedule a DEBOUNCED `transport.store()` of the
 * full snapshot (so a burst of `setItem`s becomes one network round-trip). This
 * bridges the per-key `StorageAdapter` contract to a whole-document API.
 */
export class GlitchCloudSaveAdapter implements StorageAdapter {
  readonly name = "glitchCloudSave";
  readonly durable = true;
  private snapshot: Record<string, string> | undefined;
  private loadPromise: Promise<Record<string, string>> | undefined;
  private flushTimer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;

  constructor(
    private readonly transport: BlobSaveTransport,
    private readonly options: { debounceMs?: number } = {}
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      return await this.transport.isReady();
    } catch {
      return false;
    }
  }

  private async ensureLoaded(): Promise<Record<string, string>> {
    if (this.snapshot) {
      return this.snapshot;
    }
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        try {
          this.snapshot = (await this.transport.load()) ?? {};
        } catch {
          this.snapshot = {};
        }
        return this.snapshot;
      })();
    }
    return this.loadPromise;
  }

  async get(key: StorageKey): Promise<StorageValue | null> {
    const snapshot = await this.ensureLoaded();
    return key in snapshot ? snapshot[key] : null;
  }
  async set(key: StorageKey, value: StorageValue): Promise<void> {
    const snapshot = await this.ensureLoaded();
    if (snapshot[key] === value) {
      return;
    }
    snapshot[key] = value;
    this.scheduleFlush();
  }
  async remove(key: StorageKey): Promise<void> {
    const snapshot = await this.ensureLoaded();
    if (key in snapshot) {
      delete snapshot[key];
      this.scheduleFlush();
    }
  }
  async keys(): Promise<StorageKey[]> {
    return Object.keys(await this.ensureLoaded());
  }
  async clear(): Promise<void> {
    this.snapshot = {};
    this.scheduleFlush();
  }

  /** Coalesce writes into a single snapshot push. */
  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer !== undefined) {
      return;
    }
    const debounceMs = this.options.debounceMs ?? 1500;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      void this.flush();
    }, debounceMs);
  }

  /** Force-persist the current snapshot now (also called on page hide/unload). */
  async flush(): Promise<void> {
    if (!this.dirty || !this.snapshot) {
      return;
    }
    this.dirty = false;
    try {
      await this.transport.store({ ...this.snapshot });
    } catch {
      // Keep dirty so a later flush retries.
      this.dirty = true;
    }
  }
}

/** A generic per-key transport (REST endpoint, IndexedDB, SQL service, ...). */
export interface KeyValueTransport {
  isReady(): Promise<boolean>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * Durable backend over any per-key key/value service (a REST API, a database).
 * Thin pass-through to the injected transport, with the same "never reject for
 * expected unavailability" contract as the other adapters.
 */
export class RestDatabaseAdapter implements StorageAdapter {
  readonly name: string;
  readonly durable = true;

  constructor(
    private readonly transport: KeyValueTransport,
    options: { name?: string } = {}
  ) {
    this.name = options.name ?? "restDatabase";
  }

  async isAvailable(): Promise<boolean> {
    try {
      return await this.transport.isReady();
    } catch {
      return false;
    }
  }
  async get(key: StorageKey): Promise<StorageValue | null> {
    try {
      return await this.transport.get(key);
    } catch {
      return null;
    }
  }
  async set(key: StorageKey, value: StorageValue): Promise<void> {
    try {
      await this.transport.set(key, value);
    } catch {
      /* best-effort */
    }
  }
  async remove(key: StorageKey): Promise<void> {
    try {
      await this.transport.remove(key);
    } catch {
      /* best-effort */
    }
  }
  async keys(): Promise<StorageKey[]> {
    try {
      return await this.transport.keys();
    } catch {
      return [];
    }
  }
  async clear(): Promise<void> {
    for (const key of await this.keys()) {
      await this.remove(key);
    }
  }
}
