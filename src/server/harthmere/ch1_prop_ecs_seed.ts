// CHAPTER_1_PROP_ECS_SEED
//
// Turns the Chapter 1 prop table into real ECS placeables.
//
// `newPlaceable` supplies the canonical entity shell. Existing ids receive a
// narrow transform/item reconciliation so the v1 plaza props migrate into the
// real road-house without replacing container contents or edited sign labels.

import { newPlaceable } from "@/server/logic/utils/placeables";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import { Label } from "@/shared/ecs/gen/components";
import type { Entity } from "@/shared/ecs/gen/entities";
import { anItem } from "@/shared/game/item";
import {
  CH1_PROPS,
  CH1_PROP_ENTITY_IDS,
} from "@/shared/harthmere/ch1_prop_seed";
import type { BiomesId } from "@/shared/ids";

export function chapter1PropSeedIds(): BiomesId[] {
  return [...CH1_PROP_ENTITY_IDS];
}

export function buildChapter1PropSeedChanges(input: {
  tick: number;
  nowSeconds: number;
  existingIds?: ReadonlySet<BiomesId>;
}): Change[] {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  const changes: Change[] = [];
  for (const prop of CH1_PROPS) {
    const placeable = newPlaceable({
      id: prop.entityId,
      creatorId: prop.entityId,
      position: [...prop.position],
      orientation: [...prop.orientation] as [number, number],
      item: anItem(prop.itemId),
      timestamp: input.nowSeconds,
    });
    if (existingIds.has(prop.entityId)) {
      changes.push({
        kind: "update",
        tick: input.tick,
        entity: {
          id: prop.entityId,
          position: placeable.position ?? null,
          orientation: placeable.orientation ?? null,
          size: placeable.size ?? null,
          placeable_component: placeable.placeable_component ?? null,
          collideable: placeable.collideable ?? null,
          locked_in_place: placeable.locked_in_place ?? null,
          // v1 represented the table, bed, and desk as wood containers. Clear
          // that stale behavior only when the canonical item is not itself a
          // container. The real Road-House Stores chest keeps its inventory.
          ...(prop.key === "roadhouse_stores"
            ? {}
            : placeable.container_inventory
            ? {}
            : { container_inventory: null }),
          ...(prop.key === "roadhouse_stores"
            ? {}
            : placeable.priced_container_inventory
            ? {}
            : { priced_container_inventory: null }),
          ...(placeable.crafting_station_component
            ? {
                crafting_station_component:
                  placeable.crafting_station_component,
              }
            : { crafting_station_component: null }),
          ...(placeable.unmuck
            ? { unmuck: placeable.unmuck }
            : { unmuck: null }),
          ...(placeable.irradiance
            ? { irradiance: placeable.irradiance }
            : { irradiance: null }),
        },
      });
      continue;
    }
    const entity: Entity = {
      ...placeable,
      // The authored label is what the objective prompt and the F-interaction
      // toaster read, so it has to be on the entity rather than inferred from
      // the placeable's item name ("Wood Container" is not "Jackie's Kettle").
      label: Label.create({ text: prop.label }),
    };
    changes.push({ kind: "create", tick: input.tick, entity });
  }
  return changes;
}

export function buildChapter1PropSeedProposedChanges(input: {
  nowSeconds: number;
  existingIds?: ReadonlySet<BiomesId>;
}): ProposedChange[] {
  return buildChapter1PropSeedChanges({
    tick: 1,
    nowSeconds: input.nowSeconds,
    existingIds: input.existingIds,
  }).map((change): ProposedChange => {
    if (change.kind === "delete") {
      return { kind: "delete", id: change.id };
    }
    if (change.kind === "create") {
      return { kind: "create", entity: change.entity };
    }
    return { kind: "update", entity: change.entity };
  });
}
