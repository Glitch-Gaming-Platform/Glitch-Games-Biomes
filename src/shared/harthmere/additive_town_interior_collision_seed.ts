import {
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES,
  harthmereAdditiveTownInteriorWorldPosition,
} from "@/shared/harthmere/harthmere_additive_town_interiors";
import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE } from "@/shared/harthmere/snapshot_grove_content";
import type { BiomesId } from "@/shared/ids";
import type { Vec2, Vec3 } from "@/shared/math/types";

export const HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEED_VERSION =
  "harthmere-additive-town-interior-collision-seed-v1" as const;
export const HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_ID_OFFSET_BASE = 11_400;

export interface HarthmereAdditiveTownInteriorCollisionSeed {
  readonly collisionSeedId: string;
  readonly fixtureId: string;
  readonly buildingName: string;
  readonly entityId: BiomesId;
  readonly position: Vec3;
  readonly orientation: Vec2;
  readonly size: Vec3;
}

function entityIdForIndex(index: number): BiomesId {
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) +
    HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_ID_OFFSET_BASE +
    index) as BiomesId;
}

// Cooking stations are real collidable native placeables and therefore own
// their own physics. Every other solid visual fixture gets one invisible native
// collideable proxy so player/NPC movement agrees with the rendered room.
export const HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEEDS: readonly HarthmereAdditiveTownInteriorCollisionSeed[] =
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_FIXTURES.filter(
    (fixture) => fixture.collidable && fixture.kind !== "cooking"
  ).map((fixture, index) => ({
    collisionSeedId: `town_interior_collision:${fixture.fixtureId}`,
    fixtureId: fixture.fixtureId,
    buildingName: fixture.buildingName,
    entityId: entityIdForIndex(index),
    position: [
      ...harthmereAdditiveTownInteriorWorldPosition(fixture.position),
    ] as Vec3,
    orientation: [0, fixture.yaw] as Vec2,
    size: [...fixture.size] as Vec3,
  }));

export function harthmereAdditiveTownInteriorCollisionSeedEntityIds() {
  return HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEEDS.map(
    (seed) => seed.entityId
  );
}

export function validateHarthmereAdditiveTownInteriorCollisionSeeds() {
  const problems: string[] = [];
  const ids = new Set<number>();
  const fixtures = new Set<string>();
  for (const seed of HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEEDS) {
    if (ids.has(Number(seed.entityId))) {
      problems.push(`${seed.fixtureId}:duplicate_entity_id`);
    }
    ids.add(Number(seed.entityId));
    if (fixtures.has(seed.fixtureId)) {
      problems.push(`${seed.fixtureId}:duplicate_fixture`);
    }
    fixtures.add(seed.fixtureId);
    if (
      !seed.position.every(Number.isFinite) ||
      !seed.size.every(Number.isFinite)
    ) {
      problems.push(`${seed.fixtureId}:invalid_bounds`);
    }
    if (seed.size.some((value) => value <= 0)) {
      problems.push(`${seed.fixtureId}:non_positive_size`);
    }
  }
  return problems;
}
