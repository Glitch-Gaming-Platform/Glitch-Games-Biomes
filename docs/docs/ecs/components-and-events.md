# Components, entities, events, and selectors

The native ECS schema lives in `ecs/defs.py`. The generator turns those definitions into the TypeScript code under `src/shared/ecs/gen`. Generated files include a content-hash header and must not be edited manually. See [Code generation](./code-generation.md) for the complete pipeline, generator invariants, and tests.

## Components and entities

Every component definition has a stable numeric ID, a generated property name, visibility, and zero or more typed fields. An entity is a `BiomesId` plus any valid combination of components; an entity "type" such as player, NPC, or terrain shard is therefore a convention enforced by selectors and application logic rather than a separate inheritance hierarchy.

The generated API provides several useful forms:

- `Entity` and `ReadonlyEntity` for materialized state.
- Delta forms where an omitted component is unchanged and `null` removes it.
- Generated component classes with `ID`, `create`, and `clone` helpers.
- Server-side `LazyEntity` and `LazyEntityDelta`, which keep encoded Redis component data until a component is accessed.
- Patchable entities that record which components were read and which values changed.

Lazy access is part of the transaction contract. `WorldEditor` uses the set of read component IDs to create narrow optimistic preconditions, so reading fewer components can reduce unrelated write conflicts.

## Visibility and serialization targets

Component visibility controls generated client serialization. Server serialization retains the full server view, while client/self views omit components the target must not receive. A schema change must therefore test both server round trips and every affected client visibility path.

Redis stores component payloads by numeric component ID. The current component encoding uses MessagePack-compatible data with a format marker, while the decoder still recognizes the older V8 serialization marker. JSON/ZRPC entity serialization also accepts legacy entity shapes and deprecated component IDs.

## Events

Generated ECS events are typed commands, not durable entity state. They normally flow from a client or service to the logic server, where a registered handler:

1. Selects and reads the entities needed to validate the action.
2. Performs ACL, inventory, spatial, or gameplay checks.
3. Builds a `ChangeSet` with optimistic preconditions.
4. Emits proposed ECS changes and Firehose events.
5. Applies the transaction through the world API.

Event definitions belong in `ecs/defs.py`; handler registration belongs under `src/server/logic/events`. Adding the generated event without binding and testing a handler only creates a transport type—it does not create authoritative gameplay behavior.

## Selectors and indexes

Selectors define required component sets. At runtime they support:

- Full scans of matching entities.
- Point and multi-ID queries that still enforce the required component set.
- Subset indexes with an additional predicate.
- Keyed indexes for reverse lookups such as "entities by owner."
- Spatial indexes for position-oriented queries.

Indexes are projections over a table. They must remain correct across create, update, component removal, entity deletion, and out-of-order/stale changes.

## Schema change workflow

1. Edit `ecs/defs.py` and assign any new component a never-before-used numeric ID.
2. Run `./b gen:ecs`.
3. Review all generated changes, especially component ID maps, visibility maps, serde code, and event/selector output.
4. Add or update component default, clone, serialization, lazy decoding, delta/removal, selector, and event tests.
5. Follow the [migration and rolling-upgrade checklist](./migrations-and-upgrades.md) before deploying.

Never renumber or reuse a component ID. If a component is retired, preserve its ID as deprecated so old snapshots, Redis records, queued messages, and mixed-version processes can still decode safely.
