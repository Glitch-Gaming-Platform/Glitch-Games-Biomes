import type { Change, ProposedChange } from "@/shared/ecs/change";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import {
  Collideable,
  CraftingStationComponent,
  CreatedBy,
  Label,
  LockedInPlace,
  Orientation,
  PlaceableComponent,
  PlacedBy,
  Position,
  Size,
} from "@/shared/ecs/gen/components";
import type { Entity } from "@/shared/ecs/gen/entities";
import {
  HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEEDS,
  harthmereAdditiveTownCookingStationSeedEntityIds,
  type HarthmereAdditiveTownCookingStationSeed,
} from "@/shared/harthmere/additive_town_cooking_station_seed";
import type { BiomesId } from "@/shared/ids";

function entityForSeed(
  seed: HarthmereAdditiveTownCookingStationSeed,
  timestamp: number
): Entity {
  return {
    id: seed.entityId,
    position: Position.create({ v: seed.position }),
    orientation: Orientation.create({ v: seed.orientation }),
    size: Size.create({ v: seed.size }),
    placeable_component: PlaceableComponent.create({
      item_id: seed.stationItemId,
    }),
    crafting_station_component: CraftingStationComponent.create(),
    collideable: Collideable.create(),
    locked_in_place: LockedInPlace.create(),
    created_by: CreatedBy.create({ id: seed.entityId, created_at: timestamp }),
    placed_by: PlacedBy.create({ id: seed.entityId, placed_at: timestamp }),
    label: Label.create({ text: seed.stationName }),
  };
}

export function buildHarthmereAdditiveTownCookingStationSeedChanges(input: {
  tick: number;
  nowSeconds?: number;
  existingIds?: ReadonlySet<BiomesId>;
}): Change[] {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  const timestamp = input.nowSeconds ?? secondsSinceEpoch();
  return HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEEDS.map((seed) => ({
    kind: existingIds.has(seed.entityId) ? "update" : "create",
    tick: input.tick,
    entity: entityForSeed(seed, timestamp),
  }));
}

export function buildHarthmereAdditiveTownCookingStationSeedProposedChanges(input: {
  nowSeconds: number;
  existingIds?: ReadonlySet<BiomesId>;
}): ProposedChange[] {
  return buildHarthmereAdditiveTownCookingStationSeedChanges({
    tick: 1,
    nowSeconds: input.nowSeconds,
    existingIds: input.existingIds,
  }).map((change): ProposedChange => {
    if (change.kind === "delete") return { kind: "delete", id: change.id };
    if (change.kind === "create")
      return { kind: "create", entity: change.entity };
    return { kind: "update", entity: change.entity };
  });
}

export { harthmereAdditiveTownCookingStationSeedEntityIds };
