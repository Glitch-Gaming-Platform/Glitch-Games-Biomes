import {
  HARTHMERE_EXOTIC_MATTER_CAVES,
  type HarthmereExoticMatterCaveId,
} from "@/shared/harthmere/exotic_matter_caves";
import { harthmereLiveEntityIdFromOffset } from "@/shared/harthmere/live_entity_seed_ids";
import type { BiomesId } from "@/shared/ids";
import type { Vec2, Vec3 } from "@/shared/math/types";

export const HARTHMERE_INDISWORM_SPAWNS_VERSION =
  "harthmere-indisworm-spawns-v1" as const;
export const HARTHMERE_INDISWORM_PACKS_PER_CAVERN = 3;
export const HARTHMERE_INDISWORMS_PER_PACK = 5;
export const HARTHMERE_INDISWORM_FIRST_ID_OFFSET = 11_001;

export const HARTHMERE_INDISWORM_CAVE_IDS = [
  "deep_spindle_massive_cave",
  "harthmere_core_massive_cave",
  "harthmere_far_hollow_massive_cave",
  "harthmere_high_vault_massive_cave",
] as const satisfies readonly HarthmereExoticMatterCaveId[];

const MEMBER_OFFSETS = [
  [-3, 0, -2],
  [0, 0, -3],
  [3, 0, -2],
  [-2, 0, 2],
  [2, 0, 2],
] as const satisfies readonly Vec3[];

const CAVE_LAYOUTS = {
  deep_spindle_massive_cave: {
    progressionLevel: 4,
    packCenters: [
      [714, -32, -379],
      [724, -32, -369],
      [734, -32, -359],
    ],
  },
  harthmere_core_massive_cave: {
    progressionLevel: 5,
    packCenters: [
      [924, -2, -315],
      [956, -1, -315],
      [940, 0, -281],
    ],
  },
  harthmere_far_hollow_massive_cave: {
    progressionLevel: 6,
    packCenters: [
      [956, 12, -690],
      [988, 13, -690],
      [972, 14, -656],
    ],
  },
  harthmere_high_vault_massive_cave: {
    progressionLevel: 7,
    packCenters: [
      [178, 101, 293],
      [210, 102, 293],
      [194, 103, 327],
    ],
  },
} as const satisfies Record<
  (typeof HARTHMERE_INDISWORM_CAVE_IDS)[number],
  {
    progressionLevel: number;
    packCenters: readonly [Vec3, Vec3, Vec3];
  }
>;

export interface HarthmereIndiswormSpawnDescriptor {
  seedId: string;
  entityId: BiomesId;
  idOffset: number;
  caveId: (typeof HARTHMERE_INDISWORM_CAVE_IDS)[number];
  caveLabel: string;
  position: Vec3;
  orientation: Vec2;
  groupId: string;
  packIndex: number;
  memberIndex: number;
  progressionLevel: number;
}

const caveById = new Map(
  HARTHMERE_EXOTIC_MATTER_CAVES.map((cave) => [cave.caveId, cave] as const)
);

export function isPositionInsideHarthmereIndiswormCave(
  caveId: string | undefined,
  position: readonly number[]
) {
  const cave = caveById.get(caveId as HarthmereExoticMatterCaveId);
  if (!cave || position.length < 3) return false;
  const { x0, x1, y0, y1, z0, z1 } = cave.bounds;
  return (
    position[0] >= x0 &&
    position[0] <= x1 &&
    position[1] >= y0 &&
    position[1] <= y1 &&
    position[2] >= z0 &&
    position[2] <= z1
  );
}

export const HARTHMERE_INDISWORM_SPAWNS: readonly HarthmereIndiswormSpawnDescriptor[] =
  HARTHMERE_INDISWORM_CAVE_IDS.flatMap((caveId, caveIndex) => {
    const cave = caveById.get(caveId);
    if (!cave) {
      throw new Error(`Missing massive cavern definition ${caveId}`);
    }
    const layout = CAVE_LAYOUTS[caveId];
    return layout.packCenters.flatMap((center, packIndex) =>
      MEMBER_OFFSETS.map((offset, memberIndex) => {
        const ordinal =
          caveIndex *
            HARTHMERE_INDISWORM_PACKS_PER_CAVERN *
            HARTHMERE_INDISWORMS_PER_PACK +
          packIndex * HARTHMERE_INDISWORMS_PER_PACK +
          memberIndex;
        const idOffset = HARTHMERE_INDISWORM_FIRST_ID_OFFSET + ordinal;
        return {
          seedId: `cavern-indisworm-${caveId}-pack-${packIndex + 1}-member-${
            memberIndex + 1
          }`,
          entityId: harthmereLiveEntityIdFromOffset(idOffset),
          idOffset,
          caveId,
          caveLabel: cave.label,
          position: [
            center[0] + offset[0],
            center[1] + offset[1],
            center[2] + offset[2],
          ],
          orientation: [
            0,
            (packIndex * Math.PI * 2) / 3 + (memberIndex - 2) * 0.16,
          ],
          groupId: `indisworm:${caveId}:pack-${packIndex + 1}`,
          packIndex,
          memberIndex,
          progressionLevel: layout.progressionLevel,
        } satisfies HarthmereIndiswormSpawnDescriptor;
      })
    );
  });

export const HARTHMERE_INDISWORM_PRODUCTION_COUNT =
  HARTHMERE_INDISWORM_CAVE_IDS.length *
  HARTHMERE_INDISWORM_PACKS_PER_CAVERN *
  HARTHMERE_INDISWORMS_PER_PACK;
