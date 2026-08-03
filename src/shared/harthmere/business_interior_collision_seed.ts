import {
  HARTHMERE_BUSINESS_INTERIORS,
  harthmereBusinessInteriorLocalToWorld,
  type HarthmereBusinessInteriorManifestRecord,
} from "@/shared/harthmere/business_interior_runtime";
import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE } from "@/shared/harthmere/snapshot_grove_ids";
import type { BiomesId } from "@/shared/ids";
import type { Vec2, Vec3 } from "@/shared/math/types";

export const HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEED_VERSION =
  "harthmere-business-interior-collision-seed-v1" as const;

// Keep this deterministic band outside the currently allocated Harthmere seed
// ranges. The manifest currently contains 178 proxies, so 11_200..11_377 are
// occupied by this family.
export const HARTHMERE_BUSINESS_INTERIOR_COLLISION_ID_OFFSET_BASE = 11_200;

type CollisionBox =
  HarthmereBusinessInteriorManifestRecord["collisionBoxes"][number];

export interface HarthmereBusinessInteriorCollisionSeed {
  collisionSeedId: string;
  entityId: BiomesId;
  idOffset: number;
  outpostId: string;
  businessType: string;
  label: string;
  role: CollisionBox["role"];
  sourceCollisionIndex: number;
  position: Vec3;
  size: Vec3;
  orientation: Vec2;
}

function collisionEntityIdFromOffset(idOffset: number): BiomesId {
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + idOffset) as BiomesId;
}

function collisionSeedForBox(input: {
  record: HarthmereBusinessInteriorManifestRecord;
  box: CollisionBox;
  sourceCollisionIndex: number;
  globalCollisionIndex: number;
}): HarthmereBusinessInteriorCollisionSeed {
  const localCenter = input.box.center as [number, number, number];
  const localSize = input.box.size as [number, number, number];
  const worldCenter = harthmereBusinessInteriorLocalToWorld(
    input.record,
    localCenter
  );
  // Blender dimensions are X width, Y depth, Z height. Native ECS Size is
  // X width, Y height, Z depth and Position is the bottom-center of that box.
  const size: Vec3 = [localSize[0], localSize[2], localSize[1]];
  const position: Vec3 = [
    worldCenter[0],
    worldCenter[1] - size[1] / 2,
    worldCenter[2],
  ];
  const rotationRadians =
    (Number(input.box.rotationDegrees) * Math.PI) / 180;
  const idOffset =
    HARTHMERE_BUSINESS_INTERIOR_COLLISION_ID_OFFSET_BASE +
    input.globalCollisionIndex;
  return {
    collisionSeedId: `business_interior_collision:${input.record.outpostId}:${input.sourceCollisionIndex}`,
    entityId: collisionEntityIdFromOffset(idOffset),
    idOffset,
    outpostId: input.record.outpostId,
    businessType: input.record.businessType,
    label: input.box.label,
    role: input.box.role,
    sourceCollisionIndex: input.sourceCollisionIndex,
    position,
    size,
    orientation: [0, rotationRadians],
  };
}

export const HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS: readonly HarthmereBusinessInteriorCollisionSeed[] =
  (() => {
    const seeds: HarthmereBusinessInteriorCollisionSeed[] = [];
    for (const record of HARTHMERE_BUSINESS_INTERIORS) {
      record.collisionBoxes.forEach((box, sourceCollisionIndex) => {
        seeds.push(
          collisionSeedForBox({
            record,
            box,
            sourceCollisionIndex,
            globalCollisionIndex: seeds.length,
          })
        );
      });
    }
    return seeds;
  })();

export function harthmereBusinessInteriorCollisionSeedIds(): BiomesId[] {
  return HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS.map(
    (seed) => seed.entityId
  );
}

const HARTHMERE_BUSINESS_INTERIOR_COLLISION_ENTITY_ID_SET = new Set<number>(
  HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS.map((seed) =>
    Number(seed.entityId)
  )
);

export function isHarthmereBusinessInteriorCollisionEntityId(
  id: BiomesId | number | undefined
) {
  return (
    id !== undefined &&
    HARTHMERE_BUSINESS_INTERIOR_COLLISION_ENTITY_ID_SET.has(Number(id))
  );
}

export function validateHarthmereBusinessInteriorCollisionSeeds(): string[] {
  const errors: string[] = [];
  const expectedCount = HARTHMERE_BUSINESS_INTERIORS.reduce(
    (sum, record) => sum + record.collisionBoxes.length,
    0
  );
  if (HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS.length !== expectedCount) {
    errors.push(
      `collision_count:${HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS.length}:${expectedCount}`
    );
  }
  const ids = new Set<number>();
  for (const seed of HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS) {
    if (ids.has(Number(seed.entityId))) {
      errors.push(`${seed.collisionSeedId}:duplicate_entity_id`);
    }
    ids.add(Number(seed.entityId));
    if (seed.size.some((value) => !Number.isFinite(value) || value <= 0)) {
      errors.push(`${seed.collisionSeedId}:invalid_size`);
    }
    if (seed.position.some((value) => !Number.isFinite(value))) {
      errors.push(`${seed.collisionSeedId}:invalid_position`);
    }
    if (seed.orientation.some((value) => !Number.isFinite(value))) {
      errors.push(`${seed.collisionSeedId}:invalid_orientation`);
    }
  }
  return errors;
}
