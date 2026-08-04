// HARTHMERE_WEST_SEAM_RIDGE
//
// The land either side of the road where the two maps meet.
//
// THE PROBLEM
// The imported production map ends at X=1792. The additive Harthmere terrain
// begins at exactly that column and is a dead-flat plane at Y=52 for the whole
// 768-block band east of it. So the join between the two maps was a straight
// north-south line, 768 voxels long, with real imported landscape on one side
// and a featureless table-top on the other. Nothing about it read as terrain;
// it read as the edge of a level.
//
// `extension_edge_horizon.ts` already solved the sibling problem — the NORTH and
// SOUTH notches, where metadata claims land the extension never seeds — with a
// rising ridge that hides the strip's outer end. This module does the same job
// for the WEST seam, which is the one the player actually walks through.
//
// THE SHAPE
// A ridge running the full Z band of the extension, with a PASS cut through it
// at the connector road. Coming east along the road from the old map you now
// approach rising ground, go through a gap in it, and come out on Harthmere's
// plain — instead of stepping over an invisible line onto a flat field.
//
// Two rules keep it safe:
//
//   * It is ZERO at the seam column itself and ramps up over the next few
//     voxels. The imported map's height at X=1791 is not knowable from here, so
//     raising ground exactly at the join risks butting a 20-block cliff against
//     whatever is there. Starting at the plane and swelling eastward cannot.
//   * It returns to the plain well before the town. The ridge ends at X=1880;
//     the westernmost authored structure is at X=1940 and the street network
//     starts at X=1924. Nothing it writes can reach either.
//
// The road pass is cut by the same corridor the shim paints its gravel road
// along, plus a feather, so the road surface and its shoulders stay flat and
// the ridge ramps up beyond them.

import {
  harthmereLinearBoundary,
  harthmereUpwardBiasedNoise,
} from "@/shared/harthmere/harthmere_horizon_noise";
import {
  HARTHMERE_BUILDINGS,
  type HarthmereBuilding,
} from "@/shared/harthmere/harthmere_town_buildings";
import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_EXTENSION_GROUND_Y,
  HARTHMERE_EXTENSION_WORLD_BOUNDS,
  HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
} from "@/shared/harthmere/world_extension";

export const HARTHMERE_WEST_SEAM_RIDGE_VERSION =
  "harthmere-west-seam-ridge-v1" as const;

export type HarthmereWestSeamRidgeMaterial =
  "grass" | "moss" | "dirt" | "stone" | "gravel";

/** How far east of the seam the ridge reaches before it is plain again. */
export const HARTHMERE_WEST_SEAM_RIDGE_DEPTH = 88;
/**
 * Voxels of ramp at the seam itself, so the join is never a cliff.
 *
 * At 10 this climbed 18 blocks in 8 — technically not a cliff, but it read as
 * one, and it put a near-vertical face directly on the join it was supposed to
 * disguise. 24 gives a hillside you can see up.
 */
export const HARTHMERE_WEST_SEAM_RIDGE_TOE = 24;
/** Where the ridge stops rising and starts settling back to the plain. */
export const HARTHMERE_WEST_SEAM_RIDGE_CREST = 40;
/** Tallest the ridge may stand above Harthmere's Y=52 plane. */
export const HARTHMERE_WEST_SEAM_RIDGE_MAX_RISE = 26;

/**
 * The connector road's Z line. `HARTHMERE_EXTENSION_ROAD` puts the boundary
 * handoff at (1792, -209) and the shim paints its gravel lane straight east
 * from there, so this is the corridor that must stay open.
 */
export const HARTHMERE_WEST_SEAM_PASS_Z = -209;
/** Flat road corridor: the 3-wide lane plus its 7-wide gravel shoulder. */
export const HARTHMERE_WEST_SEAM_PASS_HALF_WIDTH = 10;
/** Ground climbs to full ridge height over this distance beyond the shoulder. */
export const HARTHMERE_WEST_SEAM_PASS_FEATHER = 26;

export const HARTHMERE_WEST_SEAM_RIDGE_BOUNDS = Object.freeze({
  minX: HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
  maxX: HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X + HARTHMERE_WEST_SEAM_RIDGE_DEPTH,
  minZ: HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ,
  maxZ: HARTHMERE_EXTENSION_WORLD_BOUNDS.maxZ,
});

export function harthmereIsWestSeamRidgeColumn(
  worldX: number,
  worldZ: number
): boolean {
  const b = HARTHMERE_WEST_SEAM_RIDGE_BOUNDS;
  return (
    worldX >= b.minX && worldX <= b.maxX && worldZ >= b.minZ && worldZ <= b.maxZ
  );
}

/**
 * How much of the full ridge height this column is allowed, 0..1, from its
 * distance east of the seam. Zero at the join, zero again at the far edge.
 */
function alongSeamProfile(worldX: number): number {
  const dx = worldX - HARTHMERE_WEST_SEAM_RIDGE_BOUNDS.minX;
  if (dx < 0 || dx > HARTHMERE_WEST_SEAM_RIDGE_DEPTH) {
    return 0;
  }
  const toe = harthmereLinearBoundary(dx, HARTHMERE_WEST_SEAM_RIDGE_TOE);
  const settle = harthmereLinearBoundary(
    HARTHMERE_WEST_SEAM_RIDGE_DEPTH - dx,
    HARTHMERE_WEST_SEAM_RIDGE_DEPTH - HARTHMERE_WEST_SEAM_RIDGE_CREST
  );
  return Math.min(toe, settle);
}

/**
 * How wide a clearing every authored structure keeps around it.
 *
 * A hill must not swallow a building. `charcoal_burners_camp` stands at world
 * x 1836, inside the ridge's X band — it was authored out in the wilds near the
 * seam, and once the extension's Z bounds were widened to cover it, the ridge
 * reached it too. The camp keeps its own ground and the hillside settles around
 * it, the same way the road pass works.
 */
export const HARTHMERE_WEST_SEAM_STRUCTURE_CLEARANCE = 12;
export const HARTHMERE_WEST_SEAM_STRUCTURE_FEATHER = 20;

/**
 * World-space footprints inside the ridge band, resolved once. Buildings are
 * authored at +1600 in X, so the offset has to be applied to compare them
 * against the world-space ridge.
 */
let structureKeepOuts:
  Array<readonly [number, number, number, number]> | undefined;

function keepOutsInBand(): Array<readonly [number, number, number, number]> {
  if (structureKeepOuts) {
    return structureKeepOuts;
  }
  const b = HARTHMERE_WEST_SEAM_RIDGE_BOUNDS;
  const pad =
    HARTHMERE_WEST_SEAM_STRUCTURE_CLEARANCE +
    HARTHMERE_WEST_SEAM_STRUCTURE_FEATHER;
  const worldX = (building: HarthmereBuilding, edge: "x0" | "x1") =>
    building[edge] + HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
  structureKeepOuts = HARTHMERE_BUILDINGS.filter(
    (building) =>
      worldX(building, "x0") - pad <= b.maxX &&
      worldX(building, "x1") + pad >= b.minX &&
      building.z0 - pad <= b.maxZ &&
      building.z1 + pad >= b.minZ
  ).map(
    (building) =>
      [
        worldX(building, "x0"),
        worldX(building, "x1"),
        building.z0,
        building.z1,
      ] as const
  );
  return structureKeepOuts;
}

/** Exported for tests: forget the resolved keep-outs. */
export function harthmereResetWestSeamRidgeCache(): void {
  structureKeepOuts = undefined;
}

/** Zero on top of any authored structure, climbing to 1 beyond its feather. */
function structureProfile(worldX: number, worldZ: number): number {
  let factor = 1;
  for (const [x0, x1, z0, z1] of keepOutsInBand()) {
    const dx = Math.max(x0 - worldX, 0, worldX - x1);
    const dz = Math.max(z0 - worldZ, 0, worldZ - z1);
    const distance = Math.max(dx, dz) - HARTHMERE_WEST_SEAM_STRUCTURE_CLEARANCE;
    if (distance <= 0) {
      return 0;
    }
    factor = Math.min(
      factor,
      harthmereLinearBoundary(distance, HARTHMERE_WEST_SEAM_STRUCTURE_FEATHER)
    );
  }
  return factor;
}

/** Zero inside the road corridor, climbing to 1 beyond its feather. */
function passProfile(worldZ: number): number {
  const distance =
    Math.abs(worldZ - HARTHMERE_WEST_SEAM_PASS_Z) -
    HARTHMERE_WEST_SEAM_PASS_HALF_WIDTH;
  if (distance <= 0) {
    return 0;
  }
  return harthmereLinearBoundary(distance, HARTHMERE_WEST_SEAM_PASS_FEATHER);
}

export function harthmereWestSeamRidgeSurfaceY(
  worldX: number,
  worldZ: number
): number | undefined {
  if (!harthmereIsWestSeamRidgeColumn(worldX, worldZ)) {
    return undefined;
  }
  const shape =
    alongSeamProfile(worldX) *
    passProfile(worldZ) *
    structureProfile(worldX, worldZ);
  if (shape <= 0) {
    return undefined;
  }
  const longForm = harthmereUpwardBiasedNoise(
    "harthmere_west_seam_long",
    worldX,
    worldZ,
    148,
    [12, 8, 4, 2]
  );
  const brokenGround = harthmereUpwardBiasedNoise(
    "harthmere_west_seam_detail",
    worldX,
    worldZ,
    58,
    [6, 4, 2, 1]
  );
  // Two thirds of the height is the shaped ridge and one third is noise, so the
  // crest wanders instead of reading as an extruded curve.
  const lift =
    shape *
    (HARTHMERE_WEST_SEAM_RIDGE_MAX_RISE * 0.62 +
      longForm * HARTHMERE_WEST_SEAM_RIDGE_MAX_RISE * 0.28 +
      brokenGround * HARTHMERE_WEST_SEAM_RIDGE_MAX_RISE * 0.1);
  const surface = Math.round(HARTHMERE_EXTENSION_GROUND_Y + lift);
  return surface > HARTHMERE_EXTENSION_GROUND_Y ? surface : undefined;
}

export function harthmereWestSeamRidgeBlockAt(
  worldX: number,
  worldY: number,
  worldZ: number
): HarthmereWestSeamRidgeMaterial | undefined {
  const surface = harthmereWestSeamRidgeSurfaceY(worldX, worldZ);
  // Only ADD. Everything at or below the plane is the flat world's own ground
  // fill, and the ridge must never carve into it or into the road.
  if (
    surface === undefined ||
    worldY > surface ||
    worldY <= HARTHMERE_EXTENSION_GROUND_Y
  ) {
    return undefined;
  }
  const depth = surface - worldY;
  if (depth === 0) {
    const scree = harthmereUpwardBiasedNoise(
      "harthmere_west_seam_scree",
      worldX,
      worldZ,
      40,
      [5, 3, 1]
    );
    if (surface >= HARTHMERE_EXTENSION_GROUND_Y + 20 && scree > 0.72) {
      return "gravel";
    }
    return scree > 0.86 ? "moss" : "grass";
  }
  if (depth <= 3) {
    return "dirt";
  }
  return "stone";
}

/**
 * The road corridor stays walkable at the plane, all the way through.
 *
 * This is the property that matters: a ridge that closes the pass turns the
 * only route between the two maps into a wall.
 */
export function harthmereValidateWestSeamRidge(): string[] {
  const problems: string[] = [];
  const b = HARTHMERE_WEST_SEAM_RIDGE_BOUNDS;
  // Annotated: `b.minX` carries the literal type 1792 through Object.freeze, so
  // an inferred `x` cannot be reassigned to break out of the scan below.
  for (let x: number = b.minX; x <= b.maxX; x += 1) {
    for (
      let z = HARTHMERE_WEST_SEAM_PASS_Z - HARTHMERE_WEST_SEAM_PASS_HALF_WIDTH;
      z <= HARTHMERE_WEST_SEAM_PASS_Z + HARTHMERE_WEST_SEAM_PASS_HALF_WIDTH;
      z += 1
    ) {
      if (harthmereWestSeamRidgeSurfaceY(x, z) !== undefined) {
        problems.push(`ridge closes the road pass at (${x},${z})`);
        x = b.maxX;
        break;
      }
    }
  }
  // The seam column itself must stay at the plane so the join is not a cliff.
  for (let z = b.minZ; z <= b.maxZ; z += 1) {
    if (harthmereWestSeamRidgeSurfaceY(b.minX, z) !== undefined) {
      problems.push(
        `ridge stands proud of the plane at the seam column, z=${z}`
      );
      break;
    }
  }
  return problems;
}
