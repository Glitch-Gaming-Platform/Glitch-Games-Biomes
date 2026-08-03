import {
  HARTHMERE_AUTHORED_WATER_GROUND_Y,
  HARTHMERE_AUTHORED_WATER_MAX_DEPTH,
  harthmereAuthoredWaterDepthAt,
  harthmereAuthoredWaterLevelAt,
  isHarthmereAuthoredWaterColumn,
  isHarthmereAuthoredWaterVoxel,
} from "@/shared/harthmere/harthmere_authored_water";
import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_ADDITIVE_TOWN_OFFSET_Z,
} from "@/shared/harthmere/world_extension";
import {
  harthmereRiverBedMaterialAt,
  harthmereRiverCrossingDeckAt,
} from "@/shared/harthmere/harthmere_river";
import { harthmereStillWaterBlockAt } from "@/shared/harthmere/harthmere_still_water";

/**
 * HARTHMERE_AUTHORED_WATER_PLAN
 *
 * The per-column plan that MATERIALIZES the Brell, as opposed to merely
 * exempting it from repair.
 *
 * WHY THIS HAD TO EXIST
 * -----------------------------------------------------------------------
 * The production deploy is run with `HARTHMERE_SKIP_EXTENSION_TERRAIN_SEED=1`,
 * which returns early from `seed_production_harthmere_extension_terrain`. The
 * terrain seed is the only writer that rewrites a whole `shard_seed`, and
 * therefore the only writer that can REMOVE ground. The sunken-surface repair
 * that does run in reconciliation is add-only by design — it fills holes, it
 * cannot cut a channel.
 *
 * So with that flag set, teaching the repair to skip authored-water columns is
 * actively harmful on its own: the river is never carved, and the columns it
 * would have occupied are now permanently exempt from the one pass that would
 * otherwise have levelled them. Protection without materialization leaves a
 * hole.
 *
 * This module is the other half. It produces an explicit, idempotent plan for
 * one column — what must be cleared, what must be placed, and what water level
 * each voxel holds — so a narrow reconciliation writer can build the river into
 * an existing world without a full reseed.
 *
 * SCOPE DISCIPLINE
 * -----------------------------------------------------------------------
 * A pass that can delete voxels is dangerous, so this one is boxed in hard:
 *
 *   * it returns nothing at all for a column that is not authored water;
 *   * it never touches a voxel above the ground plane, so player builds and
 *     the bridge decks above the channel are out of reach;
 *   * it never reaches deeper than `HARTHMERE_AUTHORED_WATER_MAX_DEPTH`, so a
 *     genuine deep pit under the river is reported rather than excavated;
 *   * the deck and bank voxels the generators declare solid are placed, not
 *     cleared.
 */

export const HARTHMERE_AUTHORED_WATER_PLAN_VERSION =
  "harthmere-authored-water-plan-v1" as const;

/** Materials this plan may place, all already in the repair palette. */
export type HarthmereAuthoredWaterPlanMaterial =
  | "sand"
  | "gravel"
  | "moss"
  | "oakLumber"
  | "stoneBrick"
  | "stonePolished"
  | "dirt";

export interface HarthmereAuthoredWaterPlanEdit {
  readonly position: readonly [number, number, number];
  /** `undefined` means "clear this voxel to air". */
  readonly material?: HarthmereAuthoredWaterPlanMaterial;
  readonly label: "clear" | "bed" | "deck" | "floor";
}

export interface HarthmereAuthoredWaterPlanWater {
  readonly position: readonly [number, number, number];
  readonly level: number;
}

export type HarthmereAuthoredWaterPlanStatus =
  /** Not an authored-water column; this pass must not touch it. */
  | "outside"
  /** Nothing to do: the column already matches the authored channel. */
  | "matches"
  /** Terrain and/or water edits required. */
  | "materialize";

export interface HarthmereAuthoredWaterColumnPlan {
  readonly status: HarthmereAuthoredWaterPlanStatus;
  readonly edits: readonly HarthmereAuthoredWaterPlanEdit[];
  readonly water: readonly HarthmereAuthoredWaterPlanWater[];
}

const EMPTY: HarthmereAuthoredWaterColumnPlan = Object.freeze({
  status: "outside",
  edits: [],
  water: [],
});

/**
 * What the authored world says this voxel should be.
 *
 * `null` means air. A string is a material to place. `undefined` means the
 * authored world has no opinion, which is only possible outside the channel.
 */
function authoredVoxel(
  worldX: number,
  worldY: number,
  worldZ: number
): HarthmereAuthoredWaterPlanMaterial | null | undefined {
  const ax = worldX - HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
  const az = worldZ - HARTHMERE_ADDITIVE_TOWN_OFFSET_Z;
  const relY = worldY - HARTHMERE_AUTHORED_WATER_GROUND_Y;

  const deck = harthmereRiverCrossingDeckAt(ax, relY, az);
  if (deck) return deck as HarthmereAuthoredWaterPlanMaterial;

  const still = harthmereStillWaterBlockAt(ax, relY, az);
  if (still) return still as HarthmereAuthoredWaterPlanMaterial;

  const bed = harthmereRiverBedMaterialAt(ax, relY, az);
  if (bed) return bed as HarthmereAuthoredWaterPlanMaterial;

  if (isHarthmereAuthoredWaterVoxel(worldX, worldY, worldZ)) return null;
  return undefined;
}

export interface HarthmereAuthoredWaterProbe {
  /**
   * Terrain id currently at a world voxel, or 0/undefined for air. The caller
   * reads this straight out of the shard so the plan can be a no-op when the
   * channel is already correct.
   */
  readonly terrainAt: (
    worldX: number,
    worldY: number,
    worldZ: number
  ) => number | undefined;
  /** Whether a terrain id counts as solid ground. */
  readonly isSolid: (terrainId: number) => boolean;
  /** Current water level at a world voxel, 0 when dry. */
  readonly waterAt?: (
    worldX: number,
    worldY: number,
    worldZ: number
  ) => number | undefined;
}

/**
 * Plan one column of the authored channel.
 *
 * Idempotent by construction: every edit is derived from a difference between
 * the authored world and the probe, so a second run over a materialized river
 * returns `matches` with no edits.
 */
export function harthmereAuthoredWaterColumnPlan(
  worldX: number,
  worldZ: number,
  probe: HarthmereAuthoredWaterProbe
): HarthmereAuthoredWaterColumnPlan {
  if (!isHarthmereAuthoredWaterColumn(worldX, worldZ)) {
    return EMPTY;
  }
  const depth = harthmereAuthoredWaterDepthAt(worldX, worldZ);
  if (depth <= 0 || depth > HARTHMERE_AUTHORED_WATER_MAX_DEPTH) {
    // Deeper than the authored channel can be: report rather than excavate.
    return { status: "outside", edits: [], water: [] };
  }

  const edits: HarthmereAuthoredWaterPlanEdit[] = [];
  const water: HarthmereAuthoredWaterPlanWater[] = [];
  const groundY = HARTHMERE_AUTHORED_WATER_GROUND_Y;

  // Walk from the bed up to the plane. Never above it: player builds and the
  // authored bridge decks live up there and are none of this pass's business.
  for (let worldY = groundY - depth; worldY <= groundY; worldY += 1) {
    const want = authoredVoxel(worldX, worldY, worldZ);
    if (want === undefined) continue;
    const current = probe.terrainAt(worldX, worldY, worldZ) ?? 0;
    const currentSolid = current !== 0 && probe.isSolid(current);
    if (want === null) {
      // Must be open. Only clear something that is actually in the way.
      if (currentSolid) {
        edits.push({ position: [worldX, worldY, worldZ], label: "clear" });
      }
    } else if (!currentSolid) {
      // Bed, bank or deck missing under the water.
      edits.push({
        position: [worldX, worldY, worldZ],
        material: want,
        label: worldY === groundY ? "deck" : "bed",
      });
    }
  }

  // A floor under the bed, so a pit that opened beneath the channel cannot
  // drain it. Add-only: this never removes anything.
  const bedY = groundY - depth;
  const belowId = probe.terrainAt(worldX, bedY - 1, worldZ) ?? 0;
  if (!(belowId !== 0 && probe.isSolid(belowId))) {
    edits.push({
      position: [worldX, bedY - 1, worldZ],
      material: "dirt",
      label: "floor",
    });
  }

  for (let worldY = groundY - depth; worldY <= groundY; worldY += 1) {
    const level = harthmereAuthoredWaterLevelAt(worldX, worldY, worldZ);
    const current = probe.waterAt?.(worldX, worldY, worldZ) ?? 0;
    if (level !== current) {
      water.push({ position: [worldX, worldY, worldZ], level });
    }
  }

  return {
    status: edits.length || water.length ? "materialize" : "matches",
    edits,
    water,
  };
}
