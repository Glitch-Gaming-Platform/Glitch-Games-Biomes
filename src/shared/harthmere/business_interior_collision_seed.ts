import {
  HARTHMERE_BUSINESS_INTERIORS,
  harthmereBusinessInteriorLocalToWorld,
  type HarthmereBusinessInteriorManifestRecord,
} from "@/shared/harthmere/business_interior_runtime";
import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE } from "@/shared/harthmere/snapshot_grove_ids";
import type { BiomesId } from "@/shared/ids";
import type { Vec2, Vec3 } from "@/shared/math/types";

export const HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEED_VERSION =
  "harthmere-business-interior-collision-seed-v2" as const;

// Keep this deterministic band outside the currently allocated Harthmere seed
// ranges. The manifest contains 178 furniture proxies and one floor slab for
// each of 19 businesses, so 11_200..11_396 are occupied by this family. Floors
// are appended after every v1 proxy so all previously deployed ids stay stable.
export const HARTHMERE_BUSINESS_INTERIOR_COLLISION_ID_OFFSET_BASE = 11_200;
export const HARTHMERE_BUSINESS_INTERIOR_FLOOR_THICKNESS_METERS = 0.5;

type CollisionBox =
  HarthmereBusinessInteriorManifestRecord["collisionBoxes"][number];

export interface HarthmereBusinessInteriorCollisionSeed {
  collisionSeedId: string;
  entityId: BiomesId;
  idOffset: number;
  outpostId: string;
  businessType: string;
  label: string;
  role: CollisionBox["role"] | "floor";
  sourceCollisionIndex: number | undefined;
  position: Vec3;
  size: Vec3;
  orientation: Vec2;
}

function collisionSeedForFloor(input: {
  record: HarthmereBusinessInteriorManifestRecord;
  globalCollisionIndex: number;
}): HarthmereBusinessInteriorCollisionSeed {
  const idOffset =
    HARTHMERE_BUSINESS_INTERIOR_COLLISION_ID_OFFSET_BASE +
    input.globalCollisionIndex;
  const thickness = HARTHMERE_BUSINESS_INTERIOR_FLOOR_THICKNESS_METERS;
  return {
    collisionSeedId: `business_interior_collision:${input.record.outpostId}:floor`,
    entityId: collisionEntityIdFromOffset(idOffset),
    idOffset,
    outpostId: input.record.outpostId,
    businessType: input.record.businessType,
    label: `${input.record.displayName} floor`,
    role: "floor",
    sourceCollisionIndex: undefined,
    // ECS Position is the bottom-center. The slab's top is exactly the
    // manifest anchor, which is also the authored standing height.
    position: [
      input.record.assetWorldAnchor[0] + input.record.footprint.width / 2,
      input.record.assetWorldAnchor[1] - thickness,
      input.record.assetWorldAnchor[2] + input.record.footprint.depth / 2,
    ],
    size: [
      input.record.footprint.width,
      thickness,
      input.record.footprint.depth,
    ],
    orientation: [0, 0],
  };
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
  const rotationRadians = (Number(input.box.rotationDegrees) * Math.PI) / 180;
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
    for (const record of HARTHMERE_BUSINESS_INTERIORS) {
      seeds.push(
        collisionSeedForFloor({
          record,
          globalCollisionIndex: seeds.length,
        })
      );
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
    HARTHMERE_BUSINESS_INTERIORS.length
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
