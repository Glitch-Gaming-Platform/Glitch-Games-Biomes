import {
  HARTHMERE_EXOTIC_MATTER_CAVES,
  type HarthmereExoticMatterCaveId,
} from "@/shared/harthmere/exotic_matter_caves";
import {
  HARTHMERE_INDISWORM_CAVE_IDS,
  HARTHMERE_INDISWORM_CAVE_LAYOUTS,
  type HarthmereIndiswormCaveId,
} from "@/shared/harthmere/indisworm_cave_layout";
import { harthmereLiveEntityIdFromOffset } from "@/shared/harthmere/live_entity_seed_ids";
import type { BiomesId } from "@/shared/ids";
import type { Vec2, Vec3 } from "@/shared/math/types";

export const HARTHMERE_INDISWORM_SPAWNS_VERSION =
  "harthmere-indisworm-spawns-v2-guarded-deposits" as const;
export const HARTHMERE_INDISWORM_PACKS_PER_CAVERN = 3;
export const HARTHMERE_INDISWORMS_PER_PACK = 5;
export const HARTHMERE_INDISWORM_FIRST_ID_OFFSET = 11_001;

export { HARTHMERE_INDISWORM_CAVE_IDS };

const MEMBER_OFFSETS = [
  [-3, 0, -2],
  [0, 0, -3],
  [3, 0, -2],
  [-2, 0, 2],
  [2, 0, 2],
] as const satisfies readonly Vec3[];

export interface HarthmereIndiswormSpawnDescriptor {
  seedId: string;
  entityId: BiomesId;
  idOffset: number;
  caveId: HarthmereIndiswormCaveId;
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
    const layout = HARTHMERE_INDISWORM_CAVE_LAYOUTS[caveId];
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
            // Cave bounds use the walkable feet plane as y0. The confirmed
            // cave anchors are mid-volume observation points and would leave
            // these human-sized worms visibly floating several blocks up.
            cave.bounds.y0 + offset[1],
            center[1] + offset[2],
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
