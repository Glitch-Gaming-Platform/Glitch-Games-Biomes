import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_ADDITIVE_TOWN_OFFSET_Z,
  HARTHMERE_EXTENSION_GROUND_Y,
} from "@/shared/harthmere/world_extension";
import {
  HARTHMERE_RIVER_MAX_CARVE_DEPTH,
  harthmereRiverCarveDepthAt,
  harthmereRiverCarvesAirAt,
  harthmereRiverContains,
  harthmereRiverTouchesAuthoredSpan,
  harthmereRiverWaterLevelAt,
} from "@/shared/harthmere/harthmere_river";
import {
  HARTHMERE_STILL_WATER_MAX_REL_Y,
  HARTHMERE_STILL_WATER_MIN_REL_Y,
  harthmereStillWaterCarvesAirAt,
  harthmereStillWaterContains,
  harthmereStillWaterLevelAt,
  harthmereStillWaterTouchesAuthoredSpan,
} from "@/shared/harthmere/harthmere_still_water";

/**
 * HARTHMERE_AUTHORED_WATER
 *
 * The single answer to "is this column authored open water?", and the reason
 * the Brell kept getting filled in with dirt.
 *
 * THE BUG THIS EXISTS TO END
 * -----------------------------------------------------------------------
 * The additive Harthmere extension is a flat plane at Y=52, and FOUR separate
 * maintenance systems independently treat any column that breaks that plane as
 * damage to be repaired:
 *
 *   1. `harthmereUnsolidSurfaceTerrainIds` — scans every surface shard and
 *      flags any column with no block at ground Y as "holed", queueing the
 *      shard for a rebuild on every single boot;
 *   2. `harthmereSurfaceRepairColumnEdits` — fills sub-grade columns back up to
 *      Y=52 with soil and caps them with grass;
 *   3. the terrain-bounds/fingerprint pass, which treats a holed shard as
 *      "not yet seeded" and reseeds it;
 *   4. `terrainSeedEntityForWrite`, which only writes `shard_water` on shard
 *      CREATE — so on an ordinary additive deploy the carve landed and the
 *      water did not.
 *
 * Every one of them had exactly one whitelisted exception: the Bellbinder
 * chapel stair mouth. The river was not on that list, so each deploy carved a
 * channel, refused to fill it with water, and then paved it over with dirt —
 * which is precisely the reported symptom of a river that keeps vanishing into
 * uneven ground.
 *
 * Adding a fifth private exception list would have left the same trap for the
 * next feature. Instead every one of those systems now asks THIS module, and
 * the invariant has a name and a test.
 *
 * WORLD COORDINATES IN, ALWAYS
 * -----------------------------------------------------------------------
 * The maintenance passes all work in world space while the water generators are
 * authored-space, and mixing the two by hand is how the additive town has been
 * bitten before. Every entry point here takes WORLD coordinates and does the
 * transform itself.
 */

export const HARTHMERE_AUTHORED_WATER_VERSION =
  "harthmere-authored-water-v1" as const;

/** Ground plane the extension's maintenance passes measure against. */
export const HARTHMERE_AUTHORED_WATER_GROUND_Y = HARTHMERE_EXTENSION_GROUND_Y;

/**
 * Deepest an authored water feature cuts below the plane.
 *
 * The surface repair uses this to tell "authored channel" from "sunken pit":
 * anything deeper than this in a water column really is damage.
 */
export const HARTHMERE_AUTHORED_WATER_MAX_DEPTH = Math.max(
  HARTHMERE_RIVER_MAX_CARVE_DEPTH,
  Math.abs(Math.min(0, HARTHMERE_STILL_WATER_MIN_REL_Y)) + 1
);

function authoredX(worldX: number) {
  return worldX - HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
}

function authoredZ(worldZ: number) {
  return worldZ - HARTHMERE_ADDITIVE_TOWN_OFFSET_Z;
}

/**
 * True where authored water owns the column.
 *
 * This is the predicate the maintenance passes consult before deciding a hole
 * is damage. It covers the Brell's whole channel — banks included, because the
 * shelving bed means a bank column is still carved — and all three still-water
 * features.
 */
export function isHarthmereAuthoredWaterColumn(
  worldX: number,
  worldZ: number
): boolean {
  const x = authoredX(worldX);
  const z = authoredZ(worldZ);
  return harthmereRiverContains(x, z) || harthmereStillWaterContains(x, z);
}

/**
 * True where authored water intends this exact voxel to be open (air or water)
 * rather than solid ground.
 *
 * Narrower than `isHarthmereAuthoredWaterColumn`: a column can be part of the
 * river and still be solid below its bed, and the mill race's bank columns are
 * inside the feature's footprint but deliberately stay solid.
 */
export function isHarthmereAuthoredWaterVoxel(
  worldX: number,
  worldY: number,
  worldZ: number
): boolean {
  const x = authoredX(worldX);
  const z = authoredZ(worldZ);
  const relY = worldY - HARTHMERE_AUTHORED_WATER_GROUND_Y;
  // Both generators already know about their own decks, banks and beds, so ask
  // them rather than re-deriving the geometry here and getting the bridge
  // crossings wrong.
  return (
    harthmereStillWaterCarvesAirAt(x, relY, z) ||
    harthmereRiverCarvesAirAt(x, relY, z)
  );
}

/**
 * Authored water level for a voxel, in world coordinates.
 *
 * One entry point so the seeder and any reconcile pass cannot disagree about
 * what the river holds.
 */
export function harthmereAuthoredWaterLevelAt(
  worldX: number,
  worldY: number,
  worldZ: number
): number {
  const x = authoredX(worldX);
  const z = authoredZ(worldZ);
  const relY = worldY - HARTHMERE_AUTHORED_WATER_GROUND_Y;
  const river = harthmereRiverWaterLevelAt(x, relY, z);
  if (river > 0) return river;
  return harthmereStillWaterLevelAt(x, relY, z);
}

/**
 * Does this shard carry any authored water?
 *
 * Takes the shard's WORLD bounds. Used to decide which shards must have their
 * water re-asserted on a deploy, and — critically — which shards must write
 * `shard_water` as AUTHORED data rather than as a mutable default.
 */
export function harthmereShardHasAuthoredWater(
  v0: readonly [number, number, number],
  v1: readonly [number, number, number]
): boolean {
  const spanX0 = Math.min(authoredX(v0[0]), authoredX(v1[0] - 1));
  const spanX1 = Math.max(authoredX(v0[0]), authoredX(v1[0] - 1));
  const spanZ0 = Math.min(authoredZ(v0[2]), authoredZ(v1[2] - 1));
  const spanZ1 = Math.max(authoredZ(v0[2]), authoredZ(v1[2] - 1));
  const groundY = HARTHMERE_AUTHORED_WATER_GROUND_Y;
  const hasRiver =
    v0[1] <= groundY &&
    v1[1] > groundY - HARTHMERE_RIVER_MAX_CARVE_DEPTH &&
    harthmereRiverTouchesAuthoredSpan(spanX0, spanX1, spanZ0, spanZ1);
  const hasStill =
    v0[1] <= groundY + HARTHMERE_STILL_WATER_MAX_REL_Y &&
    v1[1] > groundY + HARTHMERE_STILL_WATER_MIN_REL_Y &&
    harthmereStillWaterTouchesAuthoredSpan(spanX0, spanX1, spanZ0, spanZ1);
  return hasRiver || hasStill;
}

/**
 * How far below the plane authored water legitimately cuts at this column.
 *
 * The surface repair uses this to allow the channel while still reporting a
 * genuine pit that happens to overlap it. 0 means "no authored water here".
 */
export function harthmereAuthoredWaterDepthAt(
  worldX: number,
  worldZ: number
): number {
  const x = authoredX(worldX);
  const z = authoredZ(worldZ);
  const river = harthmereRiverCarveDepthAt(x, z);
  if (river > 0) return river;
  return harthmereStillWaterContains(x, z)
    ? Math.abs(Math.min(0, HARTHMERE_STILL_WATER_MIN_REL_Y)) + 1
    : 0;
}
