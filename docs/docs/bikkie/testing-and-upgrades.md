# Bikkie testing and upgrades

Bikkie changes can cross stored definitions, runtime types, inference, object storage, Redis, HTTP serialization, client refresh, and downstream game systems. Test the narrow contract first, then every integration whose authored attributes changed.

## Test layers

| Layer                      | What it proves                                                                            | Main locations                                           |
| -------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Attribute and schema model | Stable IDs, type validation, schema conformance, interface alignment                      | `src/shared/bikkie/schema`, TypeScript typecheck         |
| Tray model                 | Tray inheritance, Biscuit inheritance, unassignment, compaction, migration, serialization | `src/shared/bikkie/test/tray.test.ts`                    |
| Runtime registry           | Registration, fallback behavior, schema lookups, in-place refresh                         | `src/shared/bikkie/test/active.test.ts`                  |
| Bakery                     | Active-tray save, names, inference, incremental reuse, deletion constraints               | `src/server/shared/bikkie/test/bakery.test.ts`           |
| Client delivery            | Encoding, schema indexes, immutable response cache, expected-tray refresh behavior        | `src/server/web/test/bikkie_load_response.test.ts`       |
| Asset boundary             | Inference output, binary publishing, Galois runtime export, icon and mesh consumers       | `src/server/bikkie`, Galois tests, client resource tests |
| System consumers           | ECS item overlays, Anima behavior, combat authority, Gaia farming                         | Tests beside each affected subsystem                     |

## Core commands

Run the core Bikkie suites:

```bash
./b test -p 'src/shared/bikkie/test/**/*.test.ts'
./b test -p 'src/server/shared/bikkie/test/**/*.test.ts'
./b test -p 'src/server/web/test/bikkie_load_response.test.ts'
./b typecheck
```

Build the documentation after changing these guides:

```bash
cd docs
yarn build
```

When inference or asset output changes, also run the relevant Galois suites and a representative dry-run export:

```bash
./b galois test
./b galois test-python
./b galois assets publish --dryRun -r '<affected-assets>'
```

Run downstream suites according to the changed attributes. Examples include Anima and shared NPC tests for `behavior`, Gaia farming tests for `farming` or `fertilizerEffect`, and Logic/client combat tests for `dps`, buffs, drops, or equipment presentation.

## Compatibility rules

1. Never reuse a deployed Biscuit ID for a different semantic object.
2. Never reuse a deprecated attribute ID. Stored definitions and item payloads depend on it.
3. Treat an attribute's code-facing name and TypeScript type as consumer API, even though storage uses the numeric ID.
4. Parse old stored values with the new Zod type before compaction removes legacy data.
5. Remember that adding a required schema attribute changes membership; recommended attributes do not.
6. Keep tray IDs immutable. Publish a new tray instead of changing bytes behind an existing version.
7. Publish every changed binary object before announcing the baked tray that references it.
8. Bump `bikkieInferenceEpoch` when inference semantics change without a definition-input change.
9. Verify or clear the persisted Redis cache when cached decoding or computation changes. The current implementation does not apply `bikkieCacheEpoch` to persisted Redis keys, so an epoch bump alone is insufficient.
10. Version code-authored overlays and client request URLs when effective Biscuit output changes outside the stored tray.
11. Preserve rolling compatibility between Bikkie behavior schemas and Anima's serialized NPC state.
12. Identify code-authored combat catalogs keyed by Bikkie ID before assuming the Biscuit is the only authority.

## Adding an attribute

1. Choose a new, never-used ID above 200 in `schema/attributes.ts`.
2. Add the registry entry with its Zod type, help text, and fallback or inference metadata if needed.
3. Add the matching field to the manual `Biscuit` interface.
4. Add the attribute to structural schemas only when it should affect conformance.
5. Add or update the domain-specific editor if generic Zod form synthesis is insufficient.
6. Add old-value parsing or transformation when changing an existing data shape.
7. Test stored Biscuit round trips, item-payload overrides when applicable, and every authoritative consumer.

Do not renumber neighboring attributes to make the list look contiguous.

## Changing a schema path

Before adding a required attribute, enumerate current members and determine whether each one already has the field. The server's schema index, client `getBiscuits()` results, admin search, and consumer discovery all change together.

For a safe additive editor hint, prefer `recommendedAttributes`. Use `attributes` only when the property is a real structural invariant that every member and every overlay satisfies.

## Changing inference or binary output

1. Test the inference rule with required, optional, missing, and invalid inputs.
2. Verify that the rule produces the declared binary type and MIME representation.
3. Compare output from a clean build and a cached build.
4. Bump `bikkieInferenceEpoch` when old definition hashes would otherwise reuse stale output.
5. Publish the default binary and all samples before the tray is announced.
6. Exercise icon, held-item, world-placeable, and wearable consumers as applicable.
7. Test local behavior with `RUN_INFERENCE_LOCALLY=1`; do not mistake retained prior output for a successful new inference.

## Changing storage or delivery

Storage work must cover definition and baked data separately. Test:

- parent-tray loading and circular-reference rejection;
- Redis, shim, and memory behavior where the change applies;
- prior-hash reuse and changed-Biscuit decode;
- save ordering around the baked tray ID;
- notifier refresh and process-local runtime epoch changes;
- `/api/bikkie` cold load, matching expected ID, mismatched expected ID, and encoded-response caching;
- client lazy decode, schema indexing, and refresh deduplication.

If a serialized representation changes, keep a fixture from the previous deployment and prove the new code can read it before updating expected values.

## System-specific regression baseline

### ECS and items

- Raw `{id, payload}` items still inherit the Biscuit and override only payload attributes.
- Stored inventories, drops, placeables, NPC type IDs, and farming seed IDs resolve after refresh.
- The `active_tray` signal is committed only after the baked tray is readable.

### Anima

- Existing NPC types still conform to `/npcs/types`.
- Behavior defaults and legacy forms parse correctly.
- Live and serialized NPC state survive the definition change.
- Spawn events, effects profiles, and NPC globals resolve.

### Combat

- Client prediction and server authority resolve the same item and NPC IDs.
- `dps`, cadence, reach, buffs, drops, and native Harthmere profiles do not diverge.
- Damage, durability, health, status, and death remain ECS/Logic-owned.

### Gaia

- Every seed's farm spec resolves its referenced block, log, leaf, group, and drop IDs.
- Existing planted crops can continue ticking after a tray refresh.
- Crossbreeding and fertilizer maps rebuild on the new Bikkie epoch.

### Galois

- Logical paths resolve through `asset_versions.json`.
- Bikkie binary hashes exist in static storage.
- Runtime wearable export supports both uploaded VOX and legacy `galoisPath` inputs.
- Output-changing player meshes receive the Galois asset-export version bump in addition to any Bikkie epoch change.

## Pre-merge checklist

- Only intended attribute, schema, definition, or documentation files changed.
- No stable Biscuit or attribute ID was reused.
- Old stored definitions and baked Biscuits decode successfully.
- Core tray, runtime, Bakery, and delivery tests pass.
- Typecheck confirms the manual `Biscuit` interface matches the attribute registry.
- Inference and binary publication ordering are verified when applicable.
- Affected ECS, Anima, combat, Gaia, and Galois consumer tests pass.
- Cache epochs and overlay or asset-export versions were bumped where semantics changed.
- The active tray can roll forward and back while old binaries remain available.
