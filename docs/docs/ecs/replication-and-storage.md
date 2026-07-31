# Replication and storage

`WorldApi` is the common boundary for health checks, versioned reads, existence checks, applies, subscriptions, leaderboard access, and editor creation. Production implementations use Redis; tests and local tools can use the in-memory implementation while preserving the same transaction semantics.

## Authoritative regular-change storage

The regular-change world stores each entity as its entity version, per-component versions, encoded component map, and last-change information. Redis Lua performs the critical read-check-write operation so each transaction's preconditions and changes are evaluated atomically.

Successful applies append encoded updates to the ECS Redis stream. Subscribers first mark the stream, scan a bootstrap snapshot, catch up through stream entries written during the scan, then emit a `bootstrapped` marker. This ordering prevents a gap between snapshot and live updates.

Redis reads use lazy entities so a service does not decode every component in every entity. Materialization is explicit and unknown active component IDs are treated as errors on the server. IDs listed as deprecated are ignored for backward compatibility.

## High-frequency component storage

HFC Redis separates components that change too often for the regular stream. It uses hashes and pub/sub, assigns Lamport-style local timestamps, and deliberately omits transactions, events, and leaderboards.

`HybridWorldApi` merges regular and HFC reads and subscriptions. It waits for the regular bootstrap before HFC bootstrap, caps HFC updates at a version already seen from the regular stream, and refetches HFC state after regular creates so high-frequency fields are not lost from the merged view.

Entity existence and authoritative transaction outcomes come from the regular world. HFC propagation and repair are designed as best-effort high-frequency synchronization, not an independent gameplay authority.

## Filters

A subscription filter can require any component from `anyOf` and reject any component from `noneOf`. During bootstrap, Redis can apply a compiled component-ID filter. During streaming, `FilterContext` tracks which entities have already been sent.

When an update changes a component relevant to inclusion, the filter re-reads authoritative state and can transform the stream transition:

- Newly matching entity: emit a full `create`.
- Still matching entity: pass through the `update`.
- No longer matching entity: emit a `delete`.
- Delete for an entity never sent to the subscriber: suppress it.

Updates unrelated to the filter pass through only for entities already included. This stateful behavior is why filter transition tests must cover create, unaffected update, exclusion, re-inclusion, delete, and bootstrap reset.

## Replicas

`Replica` subscribes to the world, materializes lazy changes, and applies them to an indexed in-process table. `LazyReplica` keeps lazy entities in a map and is useful when callers want deferred component decoding without table indexes.

Replica startup does not complete until the subscription emits `bootstrapped`. After that, live updates continue in a background task. A materialized replica emits `tick` events after effective applies. `localOnlyUpdate` can intentionally diverge a replica from authoritative state and should be reserved for narrowly understood cases.

`materializeEcs` is a snapshot helper: it starts a replica, waits for bootstrap, stops the subscription, and returns the resulting table.

## Operational invariants

- A subscriber must see a gap-free bootstrap-to-stream handoff.
- Applying stale changes must not move a table backward.
- Create/update/delete merges must preserve component-removal semantics.
- Filters must not leak entities that do not match and must send deletes for entities that leave the result set.
- Replica shutdown and pre-aborted utility reads must terminate without hanging.
- Regular/HFC merging must not make HFC appear newer than the regular entity view.
