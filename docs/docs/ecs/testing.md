# Native ECS testing

The native ECS should be tested as a stack of contracts, not only as individual component classes. A schema can serialize correctly while transaction, filter, replica, or rolling-compatibility behavior is still broken.

## Test layers

| Layer                  | What it must prove                                                                                         | Main test locations                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Python generator       | Schema validation, stable IDs and hashes, type lowering, deterministic output, checked-in output freshness | `ecs/ecs_ast_test.py`, `ecs/ts_test.py`                  |
| Generated/shared model | Component defaults and clone behavior, entity/change serialization, legacy formats, wrappers, extern types | `src/shared/ecs/test`                                    |
| Tables and indexes     | Create/update/delete, stale ordering, layered tables, selectors, spatial/key indexes, versions, exports    | `src/shared/ecs/test`                                    |
| Server lazy runtime    | Lazy decode/materialization, component removals, transaction checks, filters, signed applies               | `src/server/shared/ecs/test`                             |
| World contract         | `WorldApi`, `WorldEditor`, bootstrap utilities, optimistic authority, catch-ups                            | `src/server/shared/world/test`                           |
| Redis/Lua integration  | Durable encoding, reads, atomic applies, component `iffs`, catch-ups, stream subscriptions                 | `src/server/shared/world/test` with Redis enabled        |
| Replication            | Filter forwarding, bootstrap, materialized/lazy updates, tick events, snapshot helpers                     | `src/server/shared/replica/test`                         |
| Logic integration      | Versioned entity sources, `ChangeSet`, handler selection, authority and conflict behavior                  | `src/server/logic/events/context/test` and handler tests |

## Core commands

Run the fast native ECS suites during development:

```bash
bazel test //ecs:ecs_ast_test //ecs:ts_test
./b test -p 'src/shared/ecs/test/**/*.test.ts'
./b test -p 'src/server/shared/ecs/test/**/*.test.ts'
./b test -p 'src/server/shared/replica/test/**/*.test.ts'
./b test -p 'src/server/shared/world/test/**/*.test.ts'
./b test -p 'src/server/logic/events/context/test/**/*.test.ts'
```

The world directory contains Redis integration tests that skip unless `REDIS_TESTS=1` is set. Run them in an environment where the test helper can start or reach its isolated Redis instance:

```bash
REDIS_TESTS=1 ./b test -p 'src/server/shared/world/test/**/*.test.ts'
```

After schema edits, also run:

```bash
./b gen:ecs
./b typecheck
```

The test runner transpiles TypeScript and does not replace a typecheck.

The Python generator suite deliberately constructs multiple generators in one process, validates duplicate and reserved names and IDs, checks sparse field numbering and visibility metadata, pins critical persistent component IDs, and compares generated content hashes with the checked-in TypeScript outputs. That makes generator determinism and stale generated files test failures rather than review-only concerns.

## Required regression cases

Every affected layer should cover success, failure, and transitions. At minimum:

- Create, update, delete, component addition, component removal, and merged buffered changes.
- Old/stale tick rejection and component-aware version progression.
- Full-entity and component-scoped `iffs`, aborted event suppression, transaction ordering, and catch-ups.
- Legacy and current entity/change formats, server/client visibility, extern/ZRPC wrappers, buffers, maps, bigints, and deprecated IDs.
- Selector all/point/multi/subset/key/spatial behavior across updates and deletion.
- Filter `anyOf` and `noneOf`, including changes to any individual denied component, entry, exit, re-entry, and delete suppression.
- Bootstrap plus live-stream handoff, pre-aborted cancellation, and clean shutdown.
- Materialized and lazy replica create/update/delete behavior and effective tick emission.
- Signed apply valid, wrong-user, tampered, malformed, and expired cases.

## Upgrade baseline policy

Before a dependency, generator, Redis, serialization, or runtime upgrade, record the passing suite and coverage report on the old implementation. Run the same tests unchanged against the candidate upgrade first. Any deliberate behavior change should then update both the test and the relevant architecture or migration document in the same review.

Coverage percentage is a signal, not the acceptance criterion. Generated repetitive branches may dominate the number; the important requirement is that every public contract, compatibility branch, authority decision, and state transition has a direct assertion. New uncovered native ECS behavior should block the upgrade until it is either tested or explicitly documented as unreachable.
