# Harthmere Portable Storage

A pluggable, fallback-chained key/value storage layer for the Harthmere client.

## Why this exists

The live game runs **embedded in a cross-origin iframe on glitch.fun** (the game
document is served from `*.azurecontainerapps.io` and framed by glitch.fun). In
that context browsers **partition or fully block third-party storage** (Safari
ITP, "block all cookies", private windows), so `window.localStorage.getItem` /
`setItem` can **throw a `SecurityError`**.

The client had ~176 direct `localStorage` call sites (container/crate contents,
food & stamina, missions, inventory/hotbar snapshots, tutorial progress). Many
**writes were unguarded**, so a single throw aborted the exact action the player
just took — which is why eating, picking up items, and opening the clothing
crate "did nothing" in the iframe even though the game logic was correct.

This module provides one storage abstraction that:

- **Never throws** — every call is safe.
- **Falls back across backends** — memory, `localStorage`, Glitch Cloud Save
  (API), a REST/database service — in priority order.
- **Exposes a synchronous, `localStorage`-compatible surface**, so the existing
  call sites migrate with a one-line swap instead of being rewritten to async.

## Architecture

```
        call sites (getItem/setItem — synchronous)
                        │
                 ┌──────▼───────┐
                 │ LayeredStorage│  in-memory cache = synchronous source of truth
                 └──────┬───────┘
        sync mirror ────┤ (window.localStorage — immediate durable reads/writes)
                        │
     ┌──────────────────┼───────────────────┐   async write-through + hydrate
     ▼                  ▼                   ▼
GlitchCloudSaveAdapter  RestDatabaseAdapter  MemoryStorageAdapter  (StorageAdapters)
```

- **`LayeredStorage`** holds an in-memory cache (the synchronous layer the game
  reads/writes) plus an ordered list of async `StorageAdapter`s and an optional
  synchronous `localStorage` **mirror**.
  - **reads** → returned from the cache; on a miss it consults the sync mirror so
    persisted values are available on the first frame (before async hydration).
  - **writes** → update the cache + mirror synchronously, then flush to every
    available adapter in the background.
  - **`hydrate()`** → on startup, loads persisted keys from the durable adapters
    into the cache (highest-priority adapter wins on conflicts).
- **`StorageAdapter`** is one backend (uniformly async). Provided implementations:
  - `MemoryStorageAdapter` — always available, not durable (the universal fallback).
  - `LocalStorageAdapter` — wraps a Web Storage object; probes availability, never
    throws, optional `keyPredicate` so it only owns its own keys.
  - `GlitchCloudSaveAdapter` — a **blob-snapshot** backend (the Glitch Cloud Save
    model). Keeps an in-memory snapshot, serves per-key reads/writes against it,
    and **debounces** a burst of writes into one `transport.store()` call.
  - `RestDatabaseAdapter` — a generic per-key REST/database backend.
- All adapters are **dependency-injected** (Web Storage object, cloud-save
  transport, key/value transport), so they are fully unit-testable without a
  browser or network.

## Usage

### Drop-in replacement for `window.localStorage`

```ts
import { harthmereLocalStorage } from "@/client/util/storage";

// Before:  window.localStorage.setItem(key, JSON.stringify(state));
// After:
harthmereLocalStorage.setItem(key, JSON.stringify(state));

// Before:  const raw = window.localStorage.getItem(key);
// After:
const raw = harthmereLocalStorage.getItem(key);
```

Identical synchronous API (`getItem`, `setItem`, `removeItem`, `clear`, `key`,
`length`) — but blocked-iframe safe and, once Cloud Save is wired, persisted
across devices.

### Migrating a call site (the pattern all 176 follow)

1. `import { harthmereLocalStorage } from "@/client/util/storage";`
2. Replace `window.localStorage` → `harthmereLocalStorage`.
3. Delete any now-redundant `typeof window.localStorage !== "undefined"` guards
   and `try/catch` wrappers — the layer never throws.

Until a site is migrated, the global safety net in
`@/client/util/harthmere_storage_hardening.ts` (installed in `_app.tsx`) keeps its
raw `localStorage` calls from throwing, so migration can be incremental.

### Wiring Glitch Cloud Save (cross-device persistence)

`harthmereStorage` ships with a Cloud Save adapter whose transport is registered
at runtime by the Glitch bridge once the session is authenticated:

```ts
import {
  harthmereCloudSaveTransport,
  harthmereStorage,
} from "@/client/util/storage";

harthmereCloudSaveTransport.register({
  isReady: async () => isAuthenticatedGlitchSession(),
  // Load the saved blob (e.g. from claimSession / requestGlitch("listSaves")).
  load: async () => currentCloudSaveBlob(),
  // Persist the whole snapshot (requestGlitch("storeSave", { data: snapshot })).
  store: async (snapshot) => requestGlitch("storeSave", { data: snapshot }),
});

await harthmereStorage.hydrate(); // pull persisted state into the cache
```

Before the transport is registered, `isReady()` resolves `false`, the adapter is
skipped, and the layer runs on the `localStorage` mirror + in-memory cache.

### Building a custom store

```ts
import {
  LayeredStorage,
  MemoryStorageAdapter,
  RestDatabaseAdapter,
} from "@/client/util/storage";

const store = new LayeredStorage(
  [new RestDatabaseAdapter(myDbTransport), new MemoryStorageAdapter()],
  { namespace: `user:${userId}`, syncMirror: window.localStorage }
);
await store.hydrate();
```

## Per-player Cloud Save vs shared world state (important)

This layer is for **per-player** state that should follow a player across devices:
stamina, inventory/hotbar snapshots, quest/mission progress, container/crate
contents, tutorial progress. It keys the save to the player's `install_id` and
uploads one JSON blob to a reserved Cloud Save slot.

It is **not** for **world-altering, shared** state — buildings, plots, homes, and
terrain edits that *every* player must see. Those are **server-owned world state**
written through the sync / live-mode authority (`mmo_building_authority.ts` →
`live_mode_backend.ts`) into **Redis**, which:

- is shared across all players (a house one player buys is visible to everyone), and
- survives process restarts via Redis persistence.

Do not route world purchases through Cloud Save (other players would never see
them). For those changes to also **survive world migrations** (a new base
snapshot), the deploy-time world reconciler must merge player-created entities
into the new snapshot — see the production deployment README's reconciliation
section. Cloud Save and the world are two separate durability systems on purpose.

## Wiring status

Cloud Save is wired in `wire_glitch_cloud_save.ts` and invoked from the Glitch
install bootstrap once a real (non-guest) identity is resolved. The `challenges/`
gameplay-state modules have been migrated to `harthmereLocalStorage`; any
not-yet-migrated raw `localStorage` call sites remain protected by the global
`harthmere_storage_hardening.ts` safety net.

## Contract for adapters

`isAvailable`, `get`, and `keys` **must not reject for expected unavailability**
(blocked storage, offline API) — resolve `false`/`null`/`[]` instead. This lets
`LayeredStorage` treat every backend uniformly and never surface an error to the
game. Adapters may reject only for genuinely exceptional programmer errors.

## Tests

`__tests__/storage.test.ts` (mocha + `assert`) covers every adapter (including a
blocked Web Storage that throws on every call), the debounced Cloud Save flush,
and the layered manager (sync mirror, write-through, hydration priority,
namespacing, owned-key `clear`, and the `localStorage` facade).

Run just this suite:

```bash
npx ts-mocha --paths -p tsconfig.json src/client/util/storage/__tests__/storage.test.ts
```
