import { BikkieIds } from "@/shared/bikkie/ids";
import {
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES,
  harthmereAdditiveTownInteriorWorldPosition,
} from "@/shared/harthmere/harthmere_additive_town_interiors";
import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE } from "@/shared/harthmere/snapshot_grove_content";
import type { BiomesId } from "@/shared/ids";
import type { Vec2, Vec3 } from "@/shared/math/types";

export const HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEED_VERSION =
  "harthmere-additive-town-cooking-station-seed-v1" as const;
export const HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_ID_OFFSET_BASE = 12_000;

export interface HarthmereAdditiveTownCookingStationSeed {
  readonly stationSeedId: string;
  readonly fixtureId: string;
  readonly buildingName: string;
  readonly stationKind: "campfire" | "cookpot" | "oven";
  readonly stationItemId: BiomesId;
  readonly stationName: string;
  readonly entityId: BiomesId;
  readonly position: Vec3;
  readonly orientation: Vec2;
  readonly size: Vec3;
}

function entityIdForIndex(index: number): BiomesId {
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) +
    HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_ID_OFFSET_BASE +
    index) as BiomesId;
}

export const HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEEDS: readonly HarthmereAdditiveTownCookingStationSeed[] =
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES.filter(
    (fixture) => fixture.kind === "cooking" && fixture.stationKind
  ).map((fixture, index) => ({
    stationSeedId: `town_cooking:${fixture.fixtureId}`,
    fixtureId: fixture.fixtureId,
    buildingName: fixture.buildingName,
    stationKind: fixture.stationKind!,
    // The base game has two appropriate native, inventory-backed graphics:
    // Kitchen for an enclosed oven/range and Campfire for hearth/fire cooking.
    // A cookpot adds the existing cauldron visual over the native fire.
    stationItemId:
      fixture.stationKind === "oven" ? BikkieIds.kitchen : BikkieIds.campfire,
    stationName: fixture.label,
    entityId: entityIdForIndex(index),
    position: [
      ...harthmereAdditiveTownInteriorWorldPosition(fixture.position),
    ] as Vec3,
    orientation: [0, fixture.yaw] as Vec2,
    size: [...fixture.size] as Vec3,
  }));

const COOKING_ENTITY_IDS = new Set(
  HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEEDS.map((seed) =>
    Number(seed.entityId)
  )
);
const COOKING_VISUAL_ASSET_BY_ENTITY_ID = new Map(
  HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEEDS.map(
    (seed) =>
      [
        Number(seed.entityId),
        seed.stationKind === "oven"
          ? "town_oven_range"
          : seed.stationKind === "cookpot"
            ? "town_cookpot"
            : undefined,
      ] as const
  )
);
const COOKING_KIND_BY_ENTITY_ID = new Map(
  HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEEDS.map(
    (seed) => [Number(seed.entityId), seed.stationKind] as const
  )
);

export function isHarthmereAdditiveTownCookingStationEntityId(
  id: BiomesId | number | undefined
) {
  return id !== undefined && COOKING_ENTITY_IDS.has(Number(id));
}

export function harthmereAdditiveTownCookingStationVisualAsset(
  id: BiomesId | number | undefined
) {
  return id === undefined
    ? undefined
    : COOKING_VISUAL_ASSET_BY_ENTITY_ID.get(Number(id));
}

export function harthmereAdditiveTownCookingStationKind(
  id: BiomesId | number | undefined
) {
  return id === undefined
    ? undefined
    : COOKING_KIND_BY_ENTITY_ID.get(Number(id));
}

export function harthmereAdditiveTownCookingStationSeedEntityIds() {
  return HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEEDS.map(
    (seed) => seed.entityId
  );
}

export function validateHarthmereAdditiveTownCookingStationSeeds() {
  const problems: string[] = [];
  const ids = new Set<number>();
  for (const seed of HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEEDS) {
    if (ids.has(Number(seed.entityId))) {
      problems.push(`${seed.fixtureId}:duplicate_entity_id`);
    }
    ids.add(Number(seed.entityId));
    if (!seed.stationName.trim())
      problems.push(`${seed.fixtureId}:missing_label`);
    if (
      !seed.position.every(Number.isFinite) ||
      !seed.size.every(Number.isFinite)
    ) {
      problems.push(`${seed.fixtureId}:invalid_bounds`);
    }
  }
  return problems;
}
