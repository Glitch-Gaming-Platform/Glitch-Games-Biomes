# Migrations and upgrades

ECS changes cross persistent Redis records, stream entries, server replicas, clients, queued RPC payloads, and generated code. Treat every schema or serialization change as a rolling distributed-system upgrade, even when the TypeScript edit looks local.

## Compatibility rules

1. Component numeric IDs are permanent. Never renumber or reuse them.
2. Retired components remain in the deprecated-ID set so old encoded entities can be ignored safely.
3. Existing field order and wire meaning must remain decodable. Prefer additive optional fields with defaults.
4. Readers should accept the old and new forms before writers emit only the new form.
5. Server, client, Redis, ZRPC, snapshot, and lazy decoders must agree on null/removal and bigint/buffer behavior.
6. Generated files are outputs. Make source changes in `ecs/defs.py` or generator templates and regenerate with `./b gen:ecs`.

The current compatibility surface includes legacy object-shaped entities, modern component-ID arrays, older and current change encodings, deprecated component IDs, and both historical V8 and current MessagePack-compatible Redis component payload markers. Do not remove a legacy branch without evidence that no persisted or in-flight data can still contain it.

## Safe additive rollout

For a new optional component or field:

1. Allocate a new stable ID if adding a component.
2. Generate code and add default/clone/round-trip/lazy tests.
3. Deploy readers that tolerate both absence and the new value.
4. Begin writing the new value.
5. Backfill only if the application requires materialized defaults; otherwise preserve absence as the old-state representation.
6. Monitor decode errors, transaction abort rates, subscription lag, and replica bootstrap health.

## Renames, replacements, and removals

A wire-visible rename is a migration, not a text refactor. The safest pattern is usually:

1. Add the replacement component or field under a new stable identifier.
2. Make readers understand old, new, and mixed entities.
3. Dual-write or lazily translate while old processes may still run.
4. Backfill persisted state with an idempotent, restartable job.
5. Stop old writes only after every reader can consume the replacement.
6. Remove application use of the old component, but keep its ID deprecated and decoder compatibility as long as old data may exist.

For HFC components, also plan how regular/HFC routing, hybrid merge behavior, and repair/sink jobs change. Moving a component between stores changes transaction guarantees and cannot be treated as a serialization-only migration.

## Transaction semantic upgrades

Changes to `Iff`, tick assignment, component versioning, catch-ups, or batching are especially risky because they affect authority rather than only representation.

- Add contract tests for successful and aborted transactions, event suppression, component-scoped conflicts, catch-ups, and ordering.
- Verify both the Redis Lua implementation and the in-memory reference implementation.
- Keep mixed-version writers conservative until every authoritative path enforces the new rule.
- Do not rely on HFC timestamps as a single globally monotonic transaction version.

## Pre-merge checklist

- `bazel test //ecs:ecs_ast_test //ecs:ts_test` passes, including the generated-output content-hash check.
- `./b gen:ecs` leaves generated output up to date.
- Generated diffs contain only intended IDs, fields, visibility, events, and selectors.
- New and legacy serialization fixtures pass.
- Component defaults, clone behavior, delta removal, and lazy decoding are covered.
- Table/index and filter transitions are covered.
- World transaction tests pass in memory and against Redis.
- Replica bootstrap/live/shutdown behavior is covered.
- The docs in this section describe the new authority, storage, and rollout behavior.
- Rollback remains possible while old and new binaries coexist.

See [Testing](./testing.md) for the concrete suites and commands.
