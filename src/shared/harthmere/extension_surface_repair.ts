// HARTHMERE_EXTENSION_SURFACE_REPAIR (sunken-forest fix, 2026-07-28)
//
// WHAT WENT WRONG
// ---------------
// The additive extension is seeded as four stacked shard layers per column
// (shardY -2..1). Layer 1 is the SURFACE shard: it owns world Y 32..63 and is
// the layer that contains the flat ground cap at Y=52, the soil under it, and
// the wilds forest standing on it. Layers -2..0 are plain foundation stone
// ending at Y=31.
//
// A 2026-07-28 HAR capture of the live world shows columns where the client
// fetched the foundation shards (shardY -2, -1, 0) and even the tall-building
// shard above (shardY 2) but NEVER fetched shardY 1 — impossible under a load
// radius, because the surface shard is nearer than the one above it. Those
// surface shards are simply not in the ECS. With the surface layer absent the
// column's topmost solid voxel falls from Y=52 to Y=31, so the player sees a
// 32x32, 21-block-deep pit whose walls read exactly as the generator writes
// them: one grass voxel at 52, six dirt to 46, stone below. The floor is black
// because nothing ever computed sky occlusion down there.
//
// So: NOT a cave. Harthmere's real underground is authored and entered through
// authored mouths — the Old Well / Underways rooms at Y 46..51 under the town,
// the Bellbinder switchback below the chapel, and the exotic-matter caves. The
// town sits on the antimatter deposit it refuses to mine; the shafts in the
// lore are SEALED and live behind the back wall as scenery. An open hole in the
// forest floor is a missing shard, not content.
//
// WHAT THIS MODULE IS
// -------------------
// The pure half of the repair. Given a probe of a column's current topmost
// solid Y, it returns the MINIMAL, ADD-ONLY voxel edits that bring the column
// back to the flat plane and re-dress it as forest:
//
//   fill    stone/dirt from just above the existing terrain up to Y=51
//   cap     grass at Y=52
//   cover   one voxel of ground flora at Y=53 where the wilds generator wants it
//   forest  trunk/canopy voxels above that, from the same generator the seeder
//           uses, so a repaired patch is indistinguishable from its neighbours
//
// Three properties matter and are all tested:
//
//   ADD-ONLY. The repair never returns an air edit and never returns an edit at
//   or below the probed surface. It cannot shave a player's build, cannot punch
//   through the Underways ceiling, and cannot carve a dungeon.
//
//   IDEMPOTENT. A column that is already solid at Y=52 produces zero edits, so
//   the apply script can be re-run, resumed, or run twice with no effect.
//
//   PROTECTED COLUMNS. Authored voids that are SUPPOSED to reach the plane —
//   the Bellbinder chapel stair mouth — are refused outright, and the authored
//   underground rooms are additionally guarded by the add-only rule above.
//
// The same math backs the offline apply script
// (scripts/harthmere/repair-harthmere-extension-surface.cjs) and the creature
// re-grounding pass, so "where the ground is" has exactly one definition.

import type { Vec3 } from "@/shared/math/types";
import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_ADDITIVE_TOWN_OFFSET_Z,
  HARTHMERE_BELLBINDER_DESCENT,
  HARTHMERE_EXTENSION_FEET_Y,
  HARTHMERE_EXTENSION_GROUND_Y,
  HARTHMERE_EXTENSION_SHARD_SIZE,
  HARTHMERE_EXTENSION_ROAD,
  HARTHMERE_EXTENSION_WORLD_BOUNDS,
  harthmereExtensionTerrainEntityIdForShard,
} from "@/shared/harthmere/world_extension";
import { HARTHMERE_TOWN_BACK_BOUNDARY_X } from "@/shared/harthmere/harthmere_town_horizon";
import {
  HARTHMERE_FOREST_MAX_HEIGHT,
  harthmereWildsForestBlockAt,
  harthmereWildsGroundCoverAt,
  type HarthmereForestMaterial,
} from "@/shared/harthmere/harthmere_wilds_forest";
import { harthmereTownFlattenAuthoredBounds } from "@/shared/harthmere/town_flatten_terraform";
import { HARTHMERE_EXOTIC_MATTER_CAVES } from "@/shared/harthmere/exotic_matter_caves";

export const HARTHMERE_EXTENSION_SURFACE_REPAIR_VERSION =
  "harthmere-extension-surface-repair-v1" as const;

/** The flat plane every extension column must terminate at. */
export const HARTHMERE_SURFACE_REPAIR_TARGET_Y = HARTHMERE_EXTENSION_GROUND_Y;

/**
 * Soil depth under the cap, matching the seeder's column exactly
 * (`depth === 0 ? grass : depth > 6 ? stone : dirt`). Repaired ground therefore
 * exposes the same strata as the pit walls beside it.
 */
export const HARTHMERE_SURFACE_REPAIR_SOIL_DEPTH = 6;

/**
 * Floor of the fill. The surface shard's own bottom is Y=32, and everything
 * below it belongs to the foundation shards, which have their own audit check
 * (`emptyFoundation`). Refusing to fill below 32 keeps this repair inside the
 * one layer it is about, and turns "the foundation is missing too" into a
 * reported condition rather than an unbounded write.
 */
export const HARTHMERE_SURFACE_REPAIR_MIN_FILL_Y = 32;

/**
 * Deepest drop we are willing to call "sunken". The observed pits bottom out at
 * Y=31 (21 below the plane); anything further down is a foundation problem or a
 * genuine authored descent and is reported instead of filled.
 */
export const HARTHMERE_SURFACE_REPAIR_MAX_DROP = 24;

export type HarthmereSurfaceRepairMaterial =
  | "grass"
  | "dirt"
  | "stone"
  | HarthmereForestMaterial;

export type HarthmereSurfaceRepairLabel = "fill" | "cap" | "cover" | "forest";

export interface HarthmereSurfaceRepairEdit {
  /** World position. */
  position: Vec3;
  /** Material NAME, resolved to a TerrainID by the caller (same palette keys
   * the shim's localDevMaterials() uses), so this module stays registry-free
   * and unit-testable in milliseconds. */
  material: HarthmereSurfaceRepairMaterial;
  label: HarthmereSurfaceRepairLabel;
}

export interface HarthmereSurfaceRepairProbe {
  /** Topmost solid world Y in the column, or undefined when the column's
   * terrain could not be read (shard missing from the scan). */
  surfaceY: number | undefined;
  /** True when the column is currently air all the way down through the
   * probed range — i.e. the surface shard is missing outright. */
  emptyColumn?: boolean;
}

export type HarthmereSurfaceRepairStatus =
  | "flat"
  | "repaired"
  | "protected"
  | "outside"
  | "unknown"
  | "tooDeep";

export interface HarthmereSurfaceRepairColumnResult {
  status: HarthmereSurfaceRepairStatus;
  edits: HarthmereSurfaceRepairEdit[];
  /** How far below the plane the column's terrain currently stops. */
  drop?: number;
}

// ---------------------------------------------------------------------------
// Where the repair is allowed to act
// ---------------------------------------------------------------------------

export function isHarthmereSurfaceRepairWorldColumn(
  worldX: number,
  worldZ: number
): boolean {
  return (
    worldX >= HARTHMERE_EXTENSION_WORLD_BOUNDS.minX &&
    worldX < HARTHMERE_EXTENSION_WORLD_BOUNDS.maxX &&
    worldZ >= HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ &&
    worldZ < HARTHMERE_EXTENSION_WORLD_BOUNDS.maxZ
  );
}

export function harthmereSurfaceRepairAuthoredX(worldX: number): number {
  return worldX - HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
}

export function harthmereSurfaceRepairAuthoredZ(worldZ: number): number {
  return worldZ - HARTHMERE_ADDITIVE_TOWN_OFFSET_Z;
}

/**
 * The one authored void that legitimately breaks the plane: the chapel stair
 * mouth. The seeder leaves it as real air (`harthmereIsBellbinderSurfaceOpening`)
 * and the terrain audit whitelists it, so the repair must too — otherwise every
 * run would pave over the Bellbound descent.
 */
export function isHarthmereSurfaceRepairIntentionalOpening(
  worldX: number,
  worldZ: number
): boolean {
  const [authoredCenterX, , centerZ] =
    HARTHMERE_BELLBINDER_DESCENT.surfaceOpeningCenter;
  const centerX = authoredCenterX + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
  return (
    worldX >= centerX - 1 &&
    worldX <= centerX + 1 &&
    worldZ >= centerZ - 2 &&
    worldZ <= centerZ
  );
}

/**
 * Columns that sit over an authored cave/room. The add-only rule already makes
 * it impossible to fill a roofed room, but a cave whose roof is ALSO missing
 * must not be silently sealed — that would delete quest space. Report, don't
 * repair.
 */
export function isHarthmereSurfaceRepairProtectedColumn(
  worldX: number,
  worldZ: number
): boolean {
  if (isHarthmereSurfaceRepairIntentionalOpening(worldX, worldZ)) {
    return true;
  }
  const authoredX = harthmereSurfaceRepairAuthoredX(worldX);
  const authoredZ = harthmereSurfaceRepairAuthoredZ(worldZ);
  for (const cave of HARTHMERE_EXOTIC_MATTER_CAVES) {
    // Cave bounds are authored X/Z with a real world Y.
    if (
      authoredX >= cave.bounds.x0 - 2 &&
      authoredX <= cave.bounds.x1 + 2 &&
      authoredZ >= cave.bounds.z0 - 2 &&
      authoredZ <= cave.bounds.z1 + 2 &&
      cave.bounds.y1 >= HARTHMERE_SURFACE_REPAIR_MIN_FILL_Y
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Whether the repair may re-dress a column as forest.
 *
 * DELIBERATELY MORE CONSERVATIVE THAN THE SEEDER. The seeder's own predicate
 * (`harthmereWildsForestAllowed`) also knows about every individual town road
 * and Muck patch, and those live in the shim. Rather than duplicate them and
 * risk planting an oak through a road, this asks three cheap questions that can
 * only ever REMOVE candidate columns:
 *
 *   * outside the twelve-district town envelope (padded), so no tree lands in a
 *     street or a building footprint;
 *   * west of the back boundary, so nothing grows into the horizon backdrop;
 *   * clear of the connector-road and North Gate corridors.
 *
 * A handful of fringe columns will therefore come back as bare flat grass
 * instead of forest. They are restored properly by the next full reseed, which
 * the bumped terrain-bounds version forces.
 */
export const HARTHMERE_SURFACE_REPAIR_TOWN_PAD = 22;
export const HARTHMERE_SURFACE_REPAIR_ROAD_PAD = 12;

function nearAuthoredSegment(
  authoredX: number,
  authoredZ: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  pad: number
): boolean {
  const minX = Math.min(ax, bx) - pad;
  const maxX = Math.max(ax, bx) + pad;
  const minZ = Math.min(az, bz) - pad;
  const maxZ = Math.max(az, bz) + pad;
  return (
    authoredX >= minX &&
    authoredX <= maxX &&
    authoredZ >= minZ &&
    authoredZ <= maxZ
  );
}

export function isHarthmereSurfaceRepairForestColumn(
  worldX: number,
  worldZ: number
): boolean {
  const authoredX = harthmereSurfaceRepairAuthoredX(worldX);
  const authoredZ = harthmereSurfaceRepairAuthoredZ(worldZ);
  if (authoredX > HARTHMERE_TOWN_BACK_BOUNDARY_X) {
    return false;
  }
  const town = harthmereTownFlattenAuthoredBounds();
  const pad = HARTHMERE_SURFACE_REPAIR_TOWN_PAD;
  if (
    authoredX >= town.minX - pad &&
    authoredX <= town.maxX + pad &&
    authoredZ >= town.minZ - pad &&
    authoredZ <= town.maxZ + pad
  ) {
    return false;
  }
  const [roadStartX, roadStartZ] = HARTHMERE_EXTENSION_ROAD.authoredStart;
  const [westGateX, westGateZ] = HARTHMERE_EXTENSION_ROAD.authoredWestGate;
  const [northGateX, northGateZ] = HARTHMERE_EXTENSION_ROAD.authoredNorthGate;
  if (
    nearAuthoredSegment(
      authoredX,
      authoredZ,
      roadStartX,
      roadStartZ,
      westGateX,
      westGateZ,
      HARTHMERE_SURFACE_REPAIR_ROAD_PAD
    ) ||
    nearAuthoredSegment(
      authoredX,
      authoredZ,
      westGateX,
      westGateZ,
      northGateX,
      northGateZ,
      HARTHMERE_SURFACE_REPAIR_ROAD_PAD
    )
  ) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// The edits
// ---------------------------------------------------------------------------

function fillMaterial(worldY: number): HarthmereSurfaceRepairMaterial {
  const depth = HARTHMERE_SURFACE_REPAIR_TARGET_Y - worldY;
  return depth > HARTHMERE_SURFACE_REPAIR_SOIL_DEPTH ? "stone" : "dirt";
}

/**
 * Minimal add-only edits for one column.
 *
 * `dressAsForest` defaults to the conservative predicate above; the apply
 * script can pass `false` to run a ground-only repair.
 */
export function harthmereSurfaceRepairColumnEdits(
  worldX: number,
  worldZ: number,
  probe: HarthmereSurfaceRepairProbe,
  options?: {
    dressAsForest?: boolean;
    targetY?: number;
  }
): HarthmereSurfaceRepairColumnResult {
  const targetY = options?.targetY ?? HARTHMERE_SURFACE_REPAIR_TARGET_Y;
  if (!isHarthmereSurfaceRepairWorldColumn(worldX, worldZ)) {
    return { status: "outside", edits: [] };
  }
  if (isHarthmereSurfaceRepairProtectedColumn(worldX, worldZ)) {
    return { status: "protected", edits: [] };
  }
  if (probe.surfaceY === undefined && !probe.emptyColumn) {
    return { status: "unknown", edits: [] };
  }
  const surfaceY = probe.surfaceY ?? HARTHMERE_SURFACE_REPAIR_MIN_FILL_Y - 1;
  if (surfaceY >= targetY) {
    // Already at (or above) the plane. Above is a player build or an authored
    // structure; either way this repair has no business touching it.
    return { status: "flat", edits: [] };
  }
  const drop = targetY - surfaceY;
  if (drop > HARTHMERE_SURFACE_REPAIR_MAX_DROP) {
    return { status: "tooDeep", edits: [], drop };
  }

  const edits: HarthmereSurfaceRepairEdit[] = [];
  const from = Math.max(surfaceY + 1, HARTHMERE_SURFACE_REPAIR_MIN_FILL_Y);
  for (let y = from; y < targetY; y += 1) {
    edits.push({ position: [worldX, y, worldZ], material: fillMaterial(y), label: "fill" });
  }
  edits.push({
    position: [worldX, targetY, worldZ],
    material: "grass",
    label: "cap",
  });

  const dress = options?.dressAsForest ?? isHarthmereSurfaceRepairForestColumn(worldX, worldZ);
  if (dress) {
    // The wilds generator is authored-space and relative-height, exactly as the
    // seeder calls it, so a repaired column grows the same tree the original
    // seed would have grown there.
    const authoredX = harthmereSurfaceRepairAuthoredX(worldX);
    const authoredZ = harthmereSurfaceRepairAuthoredZ(worldZ);
    for (let relY = 1; relY <= HARTHMERE_FOREST_MAX_HEIGHT; relY += 1) {
      const forest = harthmereWildsForestBlockAt(authoredX, relY, authoredZ);
      if (forest) {
        edits.push({
          position: [worldX, targetY + relY, worldZ],
          material: forest,
          label: "forest",
        });
        continue;
      }
      if (relY === 1) {
        const cover = harthmereWildsGroundCoverAt(authoredX, authoredZ);
        if (cover) {
          edits.push({
            position: [worldX, targetY + relY, worldZ],
            material: cover,
            label: "cover",
          });
        }
      }
    }
  }
  return { status: "repaired", edits, drop };
}

// ---------------------------------------------------------------------------
// Shard bookkeeping
// ---------------------------------------------------------------------------

export interface HarthmereSurfaceShardSpec {
  shardX: number;
  shardY: number;
  shardZ: number;
  id: number;
}

/**
 * The 576 surface shards — the layer that owns Y=52. This is the exact set the
 * production audit counts, so a mismatch between the two is itself a bug.
 */
export function harthmereSurfaceRepairShardSpecs(): HarthmereSurfaceShardSpec[] {
  const size = HARTHMERE_EXTENSION_SHARD_SIZE;
  const shardY = Math.floor(HARTHMERE_SURFACE_REPAIR_TARGET_Y / size);
  const minShardX = Math.floor(HARTHMERE_EXTENSION_WORLD_BOUNDS.minX / size);
  const maxShardX = Math.ceil(HARTHMERE_EXTENSION_WORLD_BOUNDS.maxX / size) - 1;
  const minShardZ = Math.floor(HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ / size);
  const maxShardZ = Math.ceil(HARTHMERE_EXTENSION_WORLD_BOUNDS.maxZ / size) - 1;
  const specs: HarthmereSurfaceShardSpec[] = [];
  for (let shardX = minShardX; shardX <= maxShardX; shardX += 1) {
    for (let shardZ = minShardZ; shardZ <= maxShardZ; shardZ += 1) {
      const id = harthmereExtensionTerrainEntityIdForShard(
        shardX,
        shardY,
        shardZ
      );
      if (id === undefined) {
        throw new Error(
          `surface shard outside the stable id grid: ${shardX}:${shardY}:${shardZ}`
        );
      }
      specs.push({ shardX, shardY, shardZ, id });
    }
  }
  return specs;
}

// ---------------------------------------------------------------------------
// Creatures that fell in
//
// The grounding passes resolve an actor's Y from the terrain under it. While a
// surface shard was missing, "the terrain under it" was the foundation top at
// Y=31, so NPCs, town livestock and wandering wildlife were legitimately
// grounded 21 blocks down and are standing in the dark at the bottom of the
// pit. Once the plane is back they must be lifted, or they stay buried inside
// the fill we just wrote.
// ---------------------------------------------------------------------------

export interface HarthmereSunkenActorProbe {
  position: Vec3;
  /** Optional: an actor explicitly authored underground (Underways, Bellbinder,
   * cave quest NPCs) is never lifted. */
  authoredUnderground?: boolean;
}

export interface HarthmereSunkenActorResult {
  sunken: boolean;
  position?: Vec3;
  reason?: string;
}

/**
 * Where a sunken actor belongs after the plane is restored: standing on it, at
 * the deterministic extension feet plane Y=53. Returns `sunken: false` for
 * anything that is already at or above the plane, outside the extension,
 * authored underground, or below the pit floor (which means it is a dungeon
 * actor, not a casualty).
 */
export function harthmereSunkenActorRegroundTarget(
  probe: HarthmereSunkenActorProbe
): HarthmereSunkenActorResult {
  const [x, y, z] = probe.position;
  if (!isHarthmereSurfaceRepairWorldColumn(x, z)) {
    return { sunken: false, reason: "outsideExtension" };
  }
  if (probe.authoredUnderground) {
    return { sunken: false, reason: "authoredUnderground" };
  }
  if (isHarthmereSurfaceRepairProtectedColumn(Math.round(x), Math.round(z))) {
    return { sunken: false, reason: "protectedColumn" };
  }
  if (y >= HARTHMERE_EXTENSION_FEET_Y) {
    return { sunken: false, reason: "abovePlane" };
  }
  const drop = HARTHMERE_EXTENSION_FEET_Y - y;
  if (drop > HARTHMERE_SURFACE_REPAIR_MAX_DROP + 1) {
    // Deeper than any pit this bug can make — an Underways/Bellbinder actor.
    return { sunken: false, reason: "belowPitFloor" };
  }
  return {
    sunken: true,
    position: [x, HARTHMERE_EXTENSION_FEET_Y, z],
  };
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export function validateHarthmereSurfaceRepairContract(): {
  ok: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  const specs = harthmereSurfaceRepairShardSpecs();
  if (specs.length !== 576) {
    failures.push(
      `expected 576 surface shards, got ${specs.length} — the repair set no ` +
        `longer matches audit-production-extension-terrain.cjs`
    );
  }
  if (new Set(specs.map((spec) => spec.id)).size !== specs.length) {
    failures.push("surface shard ids are not unique");
  }
  const shardY = Math.floor(
    HARTHMERE_SURFACE_REPAIR_TARGET_Y / HARTHMERE_EXTENSION_SHARD_SIZE
  );
  if (specs.some((spec) => spec.shardY !== shardY)) {
    failures.push("surface shard specs span more than one Y layer");
  }
  if (
    HARTHMERE_SURFACE_REPAIR_MIN_FILL_Y !==
    shardY * HARTHMERE_EXTENSION_SHARD_SIZE
  ) {
    failures.push(
      "the fill floor must be the surface shard's own bottom, so the repair " +
        "never writes into the foundation layer"
    );
  }
  if (HARTHMERE_EXTENSION_FEET_Y !== HARTHMERE_SURFACE_REPAIR_TARGET_Y + 1) {
    failures.push("actor feet must sit exactly one block above the cap");
  }
  // The chapel stair mouth must survive a repair run.
  const [openingAuthoredX, , openingZ] =
    HARTHMERE_BELLBINDER_DESCENT.surfaceOpeningCenter;
  const openingX = openingAuthoredX + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
  if (
    harthmereSurfaceRepairColumnEdits(openingX, openingZ, { surfaceY: 31 })
      .status !== "protected"
  ) {
    failures.push("the repair would pave over the Bellbinder stair mouth");
  }
  return { ok: failures.length === 0, failures };
}
