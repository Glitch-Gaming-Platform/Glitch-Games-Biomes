import type { BuildingSystemMaterializationPlan } from "@/shared/harthmere/building_system";
import type {
  HarthmereBusinessInteriorManifestRecord,
} from "@/shared/harthmere/business_interior_runtime";
import { harthmereBusinessInteriorInteractionPoints } from "@/shared/harthmere/business_interior_runtime";

export const HARTHMERE_BUSINESS_ROUTE_CLEARANCE_VERSION =
  "harthmere-business-route-clearance-v1" as const;

/**
 * HARTHMERE_BUSINESS_DOORWAY_WIDTH — why this file exists.
 *
 * A native Harthmere NPC body (`LOCAL_DEV_HUMAN`) has an authored collision
 * size of `[1, 1.8, 1]`. `npcGroundTraversalProfile` leaves that profile alone
 * because it is not "oversized", so the body that physics actually sweeps is
 * exactly **one metre wide**.
 *
 * The original Grove-reference storefront language authored an "open 1x2
 * doorway": the wall row was left open at `doorX` only, and `doorX ± 1` were
 * re-walled at body height to read as jambs. That produces a **one-voxel**
 * opening — precisely the body's own width.
 *
 * A 1.0 m AABB cannot traverse a 1.0 m gap. Its faces are coincident with the
 * voxel faces on both sides, so any floating-point drift on either axis
 * registers as an intersection. The observed live symptom was exact and
 * repeatable: business customers spawned correctly, Anima authored a valid A*
 * path straight through the door (A* reasons about voxel *centres*, which are
 * traversable), the body walked up the approach lane, and then stopped dead
 * outside the wall with the collision escape force `[0, 10, 0]` on its rigid
 * body. Every one of the 19 live browser rows timed out in phase `entering`.
 *
 * So the doorway is widened to three voxels at body height and the jambs move
 * outward to `doorX ± 2`. The storefront keeps supported jambs, a visible
 * header, and the wide step apron; the opening simply becomes something a real
 * body can walk through, with a full voxel of margin on each side.
 *
 * This module owns that rule and the contract that proves it, so the geometry
 * cannot silently regress the next time the storefront dressing is retouched.
 * It reads the same authored materialization plan the deploy and any world
 * reconciliation pass consume, so a green contract here means the shipped world
 * is traversable — not merely that a test fixture was.
 */
export const HARTHMERE_NPC_BODY_WIDTH_METERS = 1;

/**
 * Voxels either side of `doorX` that stay open at body height. `1` yields a
 * three-voxel opening: one voxel of margin on each side of a one-metre body.
 */
export const HARTHMERE_BUSINESS_DOORWAY_HALF_WIDTH_VOXELS = 1;

/**
 * Minimum contiguous free width, in voxels, required at body height across
 * every row of the authored customer route. Three voxels is the smallest span
 * that leaves a full voxel of margin around a one-metre body, which is what
 * keeps ordinary path-follow jitter from turning into a collision stall.
 */
export const HARTHMERE_BUSINESS_MIN_ROUTE_CLEARANCE_VOXELS = 3;

/**
 * The body occupies the two voxel rows above the walking surface. Walls, door
 * jambs and fixtures only obstruct a walking NPC if they are solid in this
 * band; a lintel, awning or roof beam above it does not.
 */
export const HARTHMERE_BUSINESS_BODY_HEIGHT_VOXELS = 2;

export function harthmereBusinessDoorwayColumns(doorX: number): number[] {
  const columns: number[] = [];
  for (
    let dx = -HARTHMERE_BUSINESS_DOORWAY_HALF_WIDTH_VOXELS;
    dx <= HARTHMERE_BUSINESS_DOORWAY_HALF_WIDTH_VOXELS;
    dx += 1
  ) {
    columns.push(doorX + dx);
  }
  return columns;
}

/** The jamb columns sit immediately outside the traversable opening. */
export function harthmereBusinessDoorJambColumns(doorX: number): number[] {
  const offset = HARTHMERE_BUSINESS_DOORWAY_HALF_WIDTH_VOXELS + 1;
  return [doorX - offset, doorX + offset];
}

/**
 * Steps a native ground NPC can climb in one move.
 *
 * `npcGroundTraversalProfile` gives an ordinary (non-oversized) body
 * `maxStepHeight: 1`. A one-voxel porch deck, doorsill or graded pad is
 * therefore walkable; a two-voxel ledge is a wall. A clearance model that
 * ignores this reports every raised porch in Harthmere as impassable and buries
 * the real defects in false positives.
 */
export const HARTHMERE_BUSINESS_MAX_STEP_VOXELS = 1;

export interface HarthmereBusinessVoxelOccupancy {
  /** True when the voxel is solid after the whole edit stream is applied. */
  solid: (x: number, y: number, z: number) => boolean;
  /** True when a standing body at this column would intersect something. */
  blocked: (x: number, z: number, surfaceY: number) => boolean;
  /**
   * Foot level a body can stand at in this column, within one step of
   * `referenceFootY`, or undefined when the column is not standable.
   *
   * "Standable" means the body's own two voxel rows are clear and the voxel
   * beneath them is solid enough to stand on. Terrain outside the authored
   * plan is treated as supporting ground at the reference level, because the
   * plan only contains the edits this building makes — not the whole world.
   */
  footLevel: (
    x: number,
    z: number,
    referenceFootY: number
  ) => number | undefined;
  /** Label of the winning edit, for diagnostics. */
  labelAt: (x: number, y: number, z: number) => string | undefined;
  editCount: number;
}

/**
 * Collapse a materialization plan to final voxel state.
 *
 * Edits are a stream and later edits overwrite earlier ones at the same
 * position — the storefront dressing pass genuinely repaints voxels the shell
 * pass already wrote. Any clearance check that treats "some edit touched this
 * voxel" as "solid" reports phantom walls where a later edit cleared them, and
 * misses real walls that a later pass restored. Last write wins, exactly like
 * the applied world.
 */
export function buildHarthmereOutpostVoxelOccupancy(
  plan: Pick<BuildingSystemMaterializationPlan, "edits">
): HarthmereBusinessVoxelOccupancy {
  const final = new Map<string, { value: number; label: string }>();
  for (const edit of plan.edits) {
    const [x, y, z] = edit.position;
    final.set(`${x},${y},${z}`, {
      value: Number(edit.value),
      label: String(edit.label),
    });
  }
  const solid = (x: number, y: number, z: number) => {
    const entry = final.get(`${x},${y},${z}`);
    return entry !== undefined && entry.value !== 0;
  };
  const touched = (x: number, y: number, z: number) =>
    final.has(`${x},${y},${z}`);
  const bodyClearAt = (x: number, z: number, footY: number) => {
    for (let dy = 0; dy < HARTHMERE_BUSINESS_BODY_HEIGHT_VOXELS; dy += 1) {
      if (solid(x, footY + dy, z)) return false;
    }
    return true;
  };
  return {
    solid,
    blocked: (x: number, z: number, surfaceY: number) => {
      for (let dy = 1; dy <= HARTHMERE_BUSINESS_BODY_HEIGHT_VOXELS; dy += 1) {
        if (solid(x, surfaceY + dy, z)) return true;
      }
      return false;
    },
    footLevel: (x: number, z: number, referenceFootY: number) => {
      // Prefer the highest reachable standing level, so a porch deck is read as
      // "step up onto the porch" rather than "squeeze under it".
      for (
        let footY = referenceFootY + HARTHMERE_BUSINESS_MAX_STEP_VOXELS;
        footY >= referenceFootY - HARTHMERE_BUSINESS_MAX_STEP_VOXELS;
        footY -= 1
      ) {
        if (!bodyClearAt(x, z, footY)) continue;
        // Support must be an authored solid voxel — except exactly at the level
        // the body is already walking, where untouched world terrain is assumed
        // to continue. Allowing the untouched fallback *above* the reference
        // would let the model float a body upward over open ground and report
        // every wall as walkable.
        const supported =
          solid(x, footY - 1, z) ||
          (footY === referenceFootY && !touched(x, footY - 1, z));
        if (supported) return footY;
      }
      return undefined;
    },
    labelAt: (x: number, y: number, z: number) =>
      final.get(`${x},${y},${z}`)?.label,
    editCount: plan.edits.length,
  };
}

export interface HarthmereBusinessRouteRowClearance {
  z: number;
  /** Widest run of contiguous free columns inside the searched span. */
  freeWidth: number;
  /** Inclusive column range of that widest run, or undefined when fully blocked. */
  freeRange?: { minX: number; maxX: number };
  /** Labels of the blocking voxels adjacent to the door axis, for diagnostics. */
  blockingLabels: string[];
}

export interface HarthmereBusinessRouteClearanceReport {
  version: typeof HARTHMERE_BUSINESS_ROUTE_CLEARANCE_VERSION;
  outpostId: string;
  doorX: number;
  surfaceY: number;
  /** Every z row the customer must cross, from spawn approach to the counter. */
  rows: HarthmereBusinessRouteRowClearance[];
  /** The tightest row on the whole route. */
  minFreeWidth: number;
  tightestRowZ: number;
  passable: boolean;
}

/**
 * Measure the customer route the way the body experiences it.
 *
 * The route is a corridor along the door axis: the customer approaches from
 * outside on `-z`, crosses the apron, passes the wall row, and continues to the
 * counter. For every z row it must cross we take the widest contiguous run of
 * unblocked columns within `searchHalfWidth` of the door axis. The narrowest
 * such run anywhere on the route is what decides whether a one-metre body can
 * physically complete the walk.
 *
 * This deliberately does not ask the pathfinder. A* traverses voxel centres and
 * will happily return a route through a one-voxel gap that the swept body can
 * never fit through; believing it is what cost the original investigation
 * several live browser runs.
 */
export function harthmereBusinessRouteClearance(input: {
  outpostId: string;
  occupancy: HarthmereBusinessVoxelOccupancy;
  doorX: number;
  surfaceY: number;
  /** First z row of the approach, outside the building. */
  approachZ: number;
  /** Last z row of the route, at the service counter. */
  counterZ: number;
  searchHalfWidth?: number;
}): HarthmereBusinessRouteClearanceReport {
  const halfWidth = input.searchHalfWidth ?? 4;
  const rows: HarthmereBusinessRouteRowClearance[] = [];
  const zMin = Math.min(input.approachZ, input.counterZ);
  const zMax = Math.max(input.approachZ, input.counterZ);
  // The customer walks from the approach toward the counter, so foot level is
  // carried forward row by row: a porch deck raises it, a doorsill keeps it.
  // Each row is measured relative to where the body actually arrives, not to a
  // fixed pad height, which is what makes a stepped approach read correctly.
  let referenceFootY = input.surfaceY + 1;
  for (let z = zMin; z <= zMax; z += 1) {
    let best = 0;
    let bestRange: { minX: number; maxX: number } | undefined;
    let bestFootY: number | undefined;
    let run = 0;
    let runFootY: number | undefined;
    for (let x = input.doorX - halfWidth; x <= input.doorX + halfWidth; x += 1) {
      const footY = input.occupancy.footLevel(x, z, referenceFootY);
      // A run is only a corridor if the body can walk it without stepping more
      // than once between neighbouring columns.
      const continues =
        footY !== undefined &&
        (runFootY === undefined ||
          Math.abs(footY - runFootY) <= HARTHMERE_BUSINESS_MAX_STEP_VOXELS);
      if (!continues) {
        run = 0;
        runFootY = undefined;
        continue;
      }
      run += 1;
      runFootY = footY;
      if (run > best) {
        best = run;
        bestRange = { minX: x - run + 1, maxX: x };
        bestFootY = footY;
      }
    }
    if (bestFootY !== undefined) referenceFootY = bestFootY;
    const blockingLabels: string[] = [];
    for (let x = input.doorX - 1; x <= input.doorX + 1; x += 1) {
      if (input.occupancy.footLevel(x, z, referenceFootY) !== undefined) {
        continue;
      }
      for (let dy = 0; dy <= HARTHMERE_BUSINESS_BODY_HEIGHT_VOXELS; dy += 1) {
        const label = input.occupancy.solid(x, referenceFootY + dy, z)
          ? input.occupancy.labelAt(x, referenceFootY + dy, z)
          : undefined;
        if (label && !blockingLabels.includes(label)) blockingLabels.push(label);
      }
    }
    rows.push({ z, freeWidth: best, freeRange: bestRange, blockingLabels });
  }
  const tightest = rows.reduce(
    (worst, row) => (row.freeWidth < worst.freeWidth ? row : worst),
    rows[0] ?? { z: zMin, freeWidth: 0, blockingLabels: [] }
  );
  return {
    version: HARTHMERE_BUSINESS_ROUTE_CLEARANCE_VERSION,
    outpostId: input.outpostId,
    doorX: input.doorX,
    surfaceY: input.surfaceY,
    rows,
    minFreeWidth: tightest.freeWidth,
    tightestRowZ: tightest.z,
    passable:
      tightest.freeWidth >= HARTHMERE_BUSINESS_MIN_ROUTE_CLEARANCE_VOXELS,
  };
}

/**
 * Convenience wrapper that derives the route bounds from the audited interior
 * manifest, so a contract cannot drift from the coordinates the simulation
 * actually routes customers through.
 */
export function harthmereBusinessRouteClearanceForRecord(input: {
  record: HarthmereBusinessInteriorManifestRecord;
  plan: Pick<BuildingSystemMaterializationPlan, "edits">;
  doorX: number;
  surfaceY: number;
  /** How far outside the door the customer spawns; matches the spawn point. */
  approachDepth?: number;
}): HarthmereBusinessRouteClearanceReport {
  const points = harthmereBusinessInteriorInteractionPoints(input.record);
  const approachDepth = input.approachDepth ?? 10;
  return harthmereBusinessRouteClearance({
    outpostId: input.record.outpostId,
    occupancy: buildHarthmereOutpostVoxelOccupancy(input.plan),
    doorX: input.doorX,
    surfaceY: input.surfaceY,
    approachZ: Math.floor(points.entrance[2] - approachDepth),
    counterZ: Math.floor(points.customer[2]),
  });
}
