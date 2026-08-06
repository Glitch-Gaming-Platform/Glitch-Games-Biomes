# Bikkie authoring, baking, and assets

The authoring path creates immutable definitions; the baking path turns those definitions into deployable runtime content. Keeping those stages separate allows inheritance, inferred assets, incremental baking, and rollback by tray ID.

## Authoring workflow

The general editor lives under `/admin/bikkie`. Specialized admin surfaces also edit Bikkie-backed quests, triggers, farming definitions, drops, buffs, binary attributes, and other domain values.

A normal edit follows this sequence:

1. Search for or allocate a Biscuit ID and unique internal name.
2. Choose a schema path to see its required and recommended attributes.
3. Edit constant values, inheritance, unassignments, or inference rules.
4. Save a named change set.
5. The save API creates a new active tray and sends a baking notification.
6. The Bikkie server bakes, publishes changed binaries, stores the baked tray, and sends a refresh notification.

The editor holds unsaved changes in the browser, but the saved unit is a tray. A multi-Biscuit save therefore produces one content version and one audit-log entry.

## Definition validation

`BiscuitTray` validates constant assignments with the attribute's current Zod type. Invalid constants are logged and omitted instead of entering the prepared tray. Deserialization also parses known attributes through their current types, which is the migration point for old data.

Unknown attribute IDs can survive loading an old tray so data is not immediately destroyed. Compaction removes unknown attributes, so deleting an attribute implementation before old trays have been migrated can make the loss permanent on the next compaction.

## Baking

The Bakery performs four main operations:

1. load the active tray and its ancestors;
2. resolve tray inheritance, `extendedFrom`, and unassignments;
3. run requested inference rules when their input attributes are available;
4. emit a map of baked Biscuits plus a definition hash for each ID.

The definition hash includes `CONFIG.bikkieInferenceEpoch`. When a prior baked tray has the same hash, the Bakery reuses that Biscuit rather than recomputing it. A name-only change reuses the attributes and replaces the name.

Dependent inference rules can be fulfilled in passes as earlier outputs become available. Missing required inputs leave a rule unresolved. Unknown rules, cycles, invalid outputs, and inference exceptions are operational errors and must not be treated as valid empty content.

Outside Kubernetes, expensive inference is skipped unless `RUN_INFERENCE_LOCALLY` is enabled. When possible, the Bakery retains the prior inferred value. Local authors should therefore enable inference deliberately when validating an output-changing asset edit.

## Current inference rules

The registered rules in `src/server/bikkie/inference.ts` are:

| Rule            | Typical output              | Main inputs                                                   |
| --------------- | --------------------------- | ------------------------------------------------------------- |
| `renderIcon`    | `icon` PNG binary           | `vox`, icon settings, palette color, wearable/placeable flags |
| `itemMesh`      | `mesh` GLB/item-mesh binary | `vox`, palette color, wearable flag                           |
| `placeableMesh` | `worldMesh` GLB binary      | `vox`, palette color, placeable flag, optional animation info |

The admin editor exposes these rules according to the target binary attribute type. Rules use the same Galois TypeScript/Python/Voxeloo build path as other assets, so a Bikkie inference change can cross all three language boundaries.

## Two asset-reference models

Bikkie can point at art in two different ways.

### Logical Galois paths

`galoisPath` and `meshGaloisPath` refer to logical assets published by Galois. Consumers resolve them through Galois' generated asset-version index. These values should not contain or depend on a generated content hash.

`galoisIcon` commonly contains a logical icon name, but the current icon resolver also accepts an absolute HTTP URL, data/blob URL, or root-relative path. Authors should choose that escape hatch deliberately rather than assuming every `galoisIcon` is indexed by Galois.

Examples include block and item mesh recipes, legacy wearable paths, NPC models, and icons.

### Bikkie binary attributes

Attributes such as `vox`, `mesh`, `worldMesh`, and `icon` contain content-addressed descriptors:

```ts
interface AnyBinaryAttribute {
  origin?: string;
  hash: string;
  mime?: string;
  ext?: string;
  samples?: BinaryAttributeSample[];
}
```

Uploaded or inferred bytes are staged in the `biomes-bikkie` bucket. Runtime-facing binary attributes are published to `biomes-static` before the baked tray that references them becomes active. Paths are derived from the SHA-1 content hash, so the bytes behind a published path are immutable.

Sampled binary attributes can carry alternate outputs selected by other attribute values, such as palette color variants. The default descriptor and every sample must be published as one closure.

## Bikkie and Galois

Bikkie and Galois are complementary:

- Galois defines reproducible asset transformations and publishes logical asset families.
- Bikkie binds gameplay identity to those logical paths or supplies uploaded source data for per-Biscuit inference.
- Runtime wearable export reads Bikkie slot, palette, `galoisPath`, and VOX attributes, then asks Galois to build an animated player GLB.
- Client item and placeable resources choose between Bikkie binary attributes and logical Galois assets according to the Biscuit's presentation fields.

See [Galois publishing and runtime serving](../galois/publishing-and-serving.md) for the other side of this boundary.

## Asset mirroring and automatic updates

The optional drive mirror records uploaded assets and stores them through the Bikkie binary store. `BikkieAssetUpdater` scans binary attributes with an `origin` and creates a new tray when a newer mirrored hash exists for that source path.

This is still an authored content change: it receives a tray ID, appears in the log, triggers a bake, and follows normal publication and refresh ordering.

## Publication ordering

The Bikkie server publishes changed `mesh`, `worldMesh`, and `icon` binaries before saving and announcing the new baked tray. Preserve that order:

1. produce or upload content-addressed bytes;
2. verify every referenced binary is available from static storage;
3. save the baked tray;
4. notify runtimes and clients.

Reversing the order can make a valid tray point at assets that are not yet readable by clients.
