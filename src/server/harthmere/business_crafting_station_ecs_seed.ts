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
import { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS } from "@/shared/harthmere/business_owner_npc_seed";
import {
  HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS,
  type HarthmereBusinessCraftingStationSeed,
} from "@/shared/harthmere/business_crafting_station_seed";
import type { BiomesId } from "@/shared/ids";
import { INVALID_BIOMES_ID } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";

// HARTHMERE_BUSINESS_CRAFTING_STATION_ECS_SEED
//
// Materializes the one in-shop crafting station each of the 19 outpost businesses
// gets (see business_crafting_station_seed.ts) as a PLACEABLE ECS entity. The
// entity carries `placeable_component` (item id = the real bikkie crafting
// station), `crafting_station_component`, and `placed_by` — the last is required
// for the client's rich placeable inspection branch to fire, which then routes a
// crafting-station item to the native "F – craft" overlay. The owner of the shop
// is recorded as the placer so the station reads as the shop's own equipment.

export const HARTHMERE_BUSINESS_CRAFTING_STATION_SEED_SOURCE =
  "harthmere-business-crafting-station-seed";

// AABB size (Size.v = [x/width, y/height, z/depth]) for each station kind, taken
// from the crafting catalogue station sizes. Hardcoded so the seed stays
// deterministic and node-safe (no bikkie tray dependency at seed time).
const HARTHMERE_BUSINESS_CRAFTING_STATION_SIZE: Readonly<
  Record<HarthmereBusinessCraftingStationSeed["stationKind"], Vec3>
> = {
  thermoblaster: [3, 3, 3],
  thermolite: [1, 3, 2],
  workbench: [1, 3, 1],
  kitchen: [1, 4, 1],
  seedMill: [1, 1, 3],
  composter: [1, 3, 2],
  anglersTable: [2, 3, 2],
  dyeOMatic: [3, 3, 3],
};

const HARTHMERE_BUSINESS_OWNER_ENTITY_BY_OUTPOST = new Map<string, BiomesId>(
  HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.map((owner) => [
    owner.outpostId,
    owner.entityId,
  ])
);

function changeKindForSeed(id: BiomesId, existingIds: ReadonlySet<BiomesId>) {
  return existingIds.has(id) ? "update" : "create";
}

function proposedFromChange(change: Change): ProposedChange {
  if (change.kind === "delete") {
    return { kind: "delete", id: change.id };
  }
  if (change.kind === "create") {
    return { kind: "create", entity: change.entity };
  }
  return { kind: "update", entity: change.entity };
}

export function harthmereBusinessCraftingStationSeedEntityIds() {
  return HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS.map(
    (seed) => seed.entityId
  );
}

function craftingStationEntityForSeed(
  seed: HarthmereBusinessCraftingStationSeed,
  timestamp: number
): Entity {
  // The shop owner is the placer; fall back to the station id itself if (somehow)
  // an owner is missing, so placed_by is always populated for the client overlay.
  const placerId =
    HARTHMERE_BUSINESS_OWNER_ENTITY_BY_OUTPOST.get(seed.outpostId) ??
    seed.entityId ??
    INVALID_BIOMES_ID;
  return {
    id: seed.entityId,
    position: Position.create({ v: seed.position }),
    orientation: Orientation.create({ v: seed.orientation }),
    size: Size.create({
      v: HARTHMERE_BUSINESS_CRAFTING_STATION_SIZE[seed.stationKind],
    }),
    placeable_component: PlaceableComponent.create({
      item_id: seed.stationItemId,
    }),
    crafting_station_component: CraftingStationComponent.create(),
    collideable: Collideable.create(),
    // Placeables are immovable by default (matches newPlaceable()).
    locked_in_place: LockedInPlace.create(),
    created_by: CreatedBy.create({ id: placerId, created_at: timestamp }),
    placed_by: PlacedBy.create({ id: placerId, placed_at: timestamp }),
    label: Label.create({ text: seed.stationName }),
  };
}

export function buildHarthmereBusinessCraftingStationSeedChanges(input: {
  tick: number;
  nowSeconds?: number;
  existingIds?: ReadonlySet<BiomesId>;
}): Change[] {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  const nowSeconds = input.nowSeconds ?? secondsSinceEpoch();
  const changes: Change[] = [];
  for (const seed of HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS) {
    changes.push({
      kind: changeKindForSeed(seed.entityId, existingIds),
      tick: input.tick,
      entity: craftingStationEntityForSeed(seed, nowSeconds),
    });
  }
  return changes;
}

export function buildHarthmereBusinessCraftingStationSeedProposedChanges(input: {
  nowSeconds: number;
  existingIds?: ReadonlySet<BiomesId>;
}): ProposedChange[] {
  return buildHarthmereBusinessCraftingStationSeedChanges({
    tick: 1,
    nowSeconds: input.nowSeconds,
    existingIds: input.existingIds,
  }).map(proposedFromChange);
}
