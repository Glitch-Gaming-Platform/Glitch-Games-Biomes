# Bikkie architecture and data model

Bikkie has two related representations: editable definitions and baked runtime objects. Definitions preserve authoring operations such as inheritance and inference. Baking resolves those operations into plain Biscuits that game systems can read cheaply.

## Identity and names

Every Biscuit has a stable `BiomesId`. That numeric ID is the identity stored in ECS components, item stacks, drop tables, recipes, quest triggers, and references from other Biscuits.

A Biscuit also has an internal `name`, such as `stone` or `oakLog`. Names are maintained separately from tray definitions and are made unique when renamed. They are useful for authoring and generated constants, but durable references should use the numeric ID. Frequently referenced IDs are checked into `src/shared/bikkie/ids.ts` as `BikkieIds`.

Changing an internal name does not migrate IDs already stored in ECS. Reusing a numeric ID for a different semantic object is therefore a data-corruption risk even if the new Biscuit has a different name.

## Attributes

Attributes are registered in `src/shared/bikkie/schema/attributes.ts`. Each attribute has:

- a stable numeric ID used in stored definitions and per-item payloads;
- a TypeScript-facing name used on baked Biscuits;
- a Zod type that validates and can migrate decoded values;
- optional editor labels, help, descriptions, fallbacks, or a default inference rule.

Attribute IDs are deliberately above 200 so they do not overlap the ECS component-ID space. Deprecated IDs remain unused rather than being recycled.

Stored Biscuits use attribute IDs, not names. Baking converts those IDs into named object properties. This lets a compatible Zod parser migrate old stored values, but both the numeric ID and the code-facing name remain deployment contracts: old data depends on the ID, while compiled consumers depend on the name and TypeScript type.

The `Biscuit` interface is maintained beside the registry because TypeScript cannot infer the complete recursive type cheaply enough. Adding an attribute requires both the registry entry and its matching interface field.

## Structural schemas

`src/shared/bikkie/schema/biomes.ts` defines paths such as:

- `/blocks`;
- `/items`, `/items/tools`, `/items/seed`, and `/items/wearables/hat`;
- `/npcs/types`, `/npcs/spawnEvents`, and `/npcs/globals`;
- `/recipes`, `/quests`, `/buffs`, and `/metaquests`.

Schemas are structural, not nominal. A Biscuit conforms when it has every required attribute for that path. Child paths inherit their parent's required and recommended attributes. Recommended attributes guide the editor but do not affect conformance.

This has two important consequences:

1. adding a required attribute to a schema can remove existing Biscuits from that schema until they are updated;
2. adding the right attributes can make one Biscuit conform to several paths.

The server computes schema membership for `/api/bikkie`, and clients use that index for fast `getBiscuits(schema)` calls.

## Definitions, assignments, and baked values

An editable `BiscuitDefinition` contains an ID, an optional `extendedFrom` Biscuit ID, and assignments keyed by attribute ID.

Assignments can represent:

- a constant authored value;
- an inference rule request;
- an explicit unassignment that removes an inherited value;
- an inherited value when a resolved definition is inspected.

`BiscuitTray.prepare()` resolves tray history and Biscuit inheritance into `PreparedBiscuitDefinition` objects containing only constants and inference requests. The Bakery then runs inference and produces a baked Biscuit with ordinary named properties.

## Two forms of inheritance

Bikkie has two independent inheritance mechanisms.

### Tray inheritance

Each save normally creates a child tray over the previously active tray. Only changed definitions need to be written. Reads walk the parent chain and apply newer assignments over older ones. The Bakery compacts deep chains into a parentless tray so read cost stays bounded.

Trays are immutable once written. A tray ID is a version token, not a mutable row ID.

### Biscuit inheritance

`extendedFrom` lets one Biscuit inherit attributes from another Biscuit. This is useful for templates and families of related content. Local assignments override inherited attributes, and an explicit unassignment removes one.

The tray validates that the referenced parent exists and that the inheritance graph has no cycle. Deleting a Biscuit that another Biscuit extends is rejected by compaction.

## Biscuits and item instances

An ECS item is not a full copy of a Biscuit. Its raw representation is an ID plus an optional payload:

```ts
type RawItem = {
  id: BiomesId;
  payload?: Record<number, unknown>;
};
```

`anItem()` builds an object whose lookup order is:

1. raw item fields;
2. payload values keyed by Bikkie attribute ID;
3. the shared Biscuit;
4. runtime fallback values.

This permits instance-specific overrides without copying the whole definition. The payload is dynamic ECS/item data; the Biscuit remains the shared default. Changing a Biscuit can therefore affect every item with that ID unless an instance payload overrides the changed attribute.

## Fallback and unknown Biscuits

`BikkieRuntime` builds a fallback Biscuit from attributes that declare `fallbackValue`. Materialized Biscuits use that fallback as their prototype.

`getBiscuit(id)` creates an `unknown` placeholder when the ID has not been registered. The placeholder is updated in place if that ID later arrives. This keeps long-lived object references valid across refreshes, but it also means a truthy return value does not prove that content exists. Strict validation should use `getBiscuitOnlyIfExists()` or a schema check.

## Source map

| Concern               | Main source                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| Attribute definitions | `src/shared/bikkie/schema/attributes.ts`                                     |
| Attribute value types | `src/shared/bikkie/schema/types.ts`, `binary.ts`, `animation.ts`, `icons.ts` |
| Structural schemas    | `src/shared/bikkie/schema/biomes.ts`                                         |
| Schema type machinery | `src/shared/bikkie/core.ts`                                                  |
| Tray model            | `src/shared/bikkie/tray.ts`                                                  |
| Runtime registry      | `src/shared/bikkie/active.ts`                                                |
| Item overlay model    | `src/shared/game/item.ts`                                                    |
