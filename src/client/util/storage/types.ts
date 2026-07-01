// HARTHMERE PORTABLE STORAGE — core types
//
// See ./README.md for the full design rationale. In short: the live Harthmere
// client runs inside a cross-origin iframe (glitch.fun) where `localStorage` can
// be blocked or partitioned, so we need a storage layer that (a) never throws,
// (b) can fall back across several backends, and (c) still exposes a SYNCHRONOUS
// `localStorage`-compatible surface so the ~176 existing call sites can adopt it
// without being rewritten to async.
//
// A `StorageAdapter` is one concrete backend (memory, localStorage, the Glitch
// Cloud Save API, a REST/database service, ...). Adapters are uniformly async so
// the layered manager can treat an in-process Map and a network API the same
// way. The synchronous surface lives on `LayeredStorage` (a memory cache in
// front of the adapters), not on the adapters themselves.

/** Storage keys and values are strings, mirroring the Web Storage API. */
export type StorageKey = string;
export type StorageValue = string;

/**
 * A single storage backend. Every method is asynchronous and, by contract, MUST
 * NOT reject for "expected" unavailability (blocked storage, offline API): it
 * should resolve to a neutral value (`null`, `[]`) or, for availability, resolve
 * `false`. Adapters may reject only for genuinely exceptional/programmer errors.
 */
export interface StorageAdapter {
  /** Stable, human-readable identifier (used in logs and diagnostics). */
  readonly name: string;

  /**
   * Whether values written to this adapter survive a full page reload. Memory is
   * not durable; localStorage, Cloud Save and a database are. Used by
   * `LayeredStorage` to decide what to hydrate from and where a value truly lives.
   */
  readonly durable: boolean;

  /**
   * Resolve `true` only if this backend can currently be read and written. This
   * is probed (e.g. a localStorage adapter attempts a throwaway write) rather
   * than assumed, because a cross-origin iframe can expose `window.localStorage`
   * yet throw on use.
   */
  isAvailable(): Promise<boolean>;

  /** Resolve the stored value for `key`, or `null` if absent/unavailable. */
  get(key: StorageKey): Promise<StorageValue | null>;

  /** Persist `value` under `key`. Resolves even if persistence was rejected. */
  set(key: StorageKey, value: StorageValue): Promise<void>;

  /** Remove `key`. Resolves even if nothing was stored. */
  remove(key: StorageKey): Promise<void>;

  /** All keys currently held by this backend (used to hydrate the cache). */
  keys(): Promise<StorageKey[]>;

  /** Remove every key owned by this backend. */
  clear(): Promise<void>;
}

/**
 * The synchronous, `localStorage`-compatible surface that call sites use. It is a
 * strict superset of the parts of the Web Storage API the codebase relies on, so
 * `harthmereStorage.local` can be dropped in wherever `window.localStorage` was
 * used. Reads are served from an in-memory cache; writes update the cache
 * synchronously and are flushed to the durable adapters in the background.
 */
export interface SyncKeyValueStore {
  getItem(key: StorageKey): StorageValue | null;
  setItem(key: StorageKey, value: StorageValue): void;
  removeItem(key: StorageKey): void;
  clear(): void;
  key(index: number): StorageKey | null;
  readonly length: number;
}
