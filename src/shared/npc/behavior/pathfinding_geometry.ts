// HARTHMERE_HILL_PATHFINDING_GEOMETRY
//
// Pure movement rules for the NPC A* graph, extracted from `pathfinding.ts` so
// they can be exercised against a synthetic `canOccupy` predicate instead of a
// live voxel resource graph.
//
// What was wrong on hills
// -----------------------
// The original graph was authored for flat block floors:
//
//   * Cardinal movement only. A creature on a slope had to walk an L around every
//     diagonal step, which on rolling ground means constant zig-zag, constant
//     "no progress" stuck detection, and a target that keeps drifting out of the
//     path's destination tolerance.
//   * `closestNode()` rounded the raw float position of BOTH endpoints. A player
//     standing at Y=34.6 on a hill rounds to Y=35; if that voxel is solid, the
//     destination node can never be expanded, A* burns its whole node budget and
//     returns `undefined`, and the NPC falls back to blind direct pursuit into the
//     hillside. This is the single largest contributor to "they can't reach me".
//   * Any target drift past 3 m threw the entire cached path away and paid a full
//     search again on the next tick, per NPC. With a moving player that is a
//     rebuild almost every tick.
//
// None of the fixes here widen where an NPC may stand: `canOccupy` remains the
// authority, and diagonal moves additionally require both orthogonal neighbours to
// be free so a creature can never squeeze through a sealed corner.

import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";

export const HARTHMERE_HILL_PATHFINDING_GEOMETRY_VERSION =
  "harthmere-hill-pathfinding-geometry-v1" as const;

/** Cost of a flat cardinal step. */
export const PATHFINDING_CARDINAL_WEIGHT = 1;
/** Cost of a flat diagonal step (true Euclidean length, so A* stays admissible). */
export const PATHFINDING_DIAGONAL_WEIGHT = Math.SQRT2;
/** Cost of a step that also changes height. Retained from the original graph. */
export const PATHFINDING_VERTICAL_WEIGHT = 3;

/**
 * How far above / below a rounded position we look for a voxel a body can
 * actually stand in. Four blocks covers the terrain relief measured around the
 * July 27 fight (feet Y 31..48 within 45 m) without letting an NPC target a
 * completely different shelf.
 */
export const PATHFINDING_STANDING_SEARCH_UP = 3;
export const PATHFINDING_STANDING_SEARCH_DOWN = 4;

/**
 * Node budget for one search. Raised from the original 2,000 because diagonal
 * expansion plus vertical relief legitimately needs more nodes on a hill; kept
 * bounded because this runs per hostile NPC per rebuild.
 */
export const PATHFINDING_MAX_EXPANDED_NODES = 3200;

/**
 * A cached path whose destination drifted by less than this is REPAIRED (final
 * node replaced) rather than discarded. Below one voxel of drift the route is
 * unchanged in every practical sense.
 */
export const PATHFINDING_DESTINATION_REPAIR_METERS = 1.5;

/**
 * Minimum seconds between two full A* searches for the same NPC. Prevents a
 * sprinting player from forcing a fresh search on every tick while still allowing
 * a rebuild about three times a second.
 */
export const PATHFINDING_REBUILD_COOLDOWN_SECONDS = 0.35;

export function isDiagonalOffset(offset: ReadonlyVec3): boolean {
  return offset[0] !== 0 && offset[2] !== 0;
}

export function pathfindingEdgeWeight(offset: ReadonlyVec3): number {
  if (offset[1] !== 0) {
    return PATHFINDING_VERTICAL_WEIGHT * Math.abs(offset[1]);
  }
  return isDiagonalOffset(offset)
    ? PATHFINDING_DIAGONAL_WEIGHT
    : PATHFINDING_CARDINAL_WEIGHT;
}

export interface NpcMovementOffsetOptions {
  /**
   * True when the NPC is standing on a full-height block. Climbing one block up
   * is only possible from a full block, exactly as before.
   */
  onFullBlock: boolean;
  /** Escape hatch for callers that want the historical cardinal-only graph. */
  allowDiagonals?: boolean;
  /** Maximum cardinal rise/drop for an oversized ground body. */
  maxStepHeight?: number;
}

/**
 * Neighbour offsets for one graph node.
 *
 * Diagonals are deliberately restricted to the same height (`y === 0`). A
 * diagonal that also climbs or drops would need four corner probes instead of two
 * and is not needed: a slope is walkable as a diagonal step followed by a cardinal
 * step, and A* finds that pair.
 */
export function npcMovementOffsets(options: NpcMovementOffsetOptions): Vec3[] {
  const offsets: Vec3[] = [];
  const maxStepHeight = Math.max(
    1,
    Math.min(
      4,
      Math.trunc(
        Number.isFinite(options.maxStepHeight) ? options.maxStepHeight! : 1
      )
    )
  );
  const levels: number[] = [];
  for (let y = -maxStepHeight; y <= 0; y += 1) {
    levels.push(y);
  }
  if (options.onFullBlock) {
    for (let y = 1; y <= maxStepHeight; y += 1) {
      levels.push(y);
    }
  }
  for (const y of levels) {
    offsets.push([1, y, 0], [-1, y, 0], [0, y, 1], [0, y, -1]);
  }
  if (options.allowDiagonals !== false) {
    offsets.push([1, 0, 1], [1, 0, -1], [-1, 0, 1], [-1, 0, -1]);
  }
  return offsets;
}

/**
 * The two orthogonal cells a diagonal step cuts across. Both must be occupiable
 * or the move is rejected, which is what stops an NPC from slipping through the
 * corner where two walls meet.
 */
export function diagonalCornerProbes(
  node: ReadonlyVec3,
  offset: ReadonlyVec3
): [Vec3, Vec3] {
  return [
    [node[0] + offset[0], node[1] + offset[1], node[2]],
    [node[0], node[1] + offset[1], node[2] + offset[2]],
  ];
}

/**
 * True when a candidate neighbour is legal, including the diagonal corner rule.
 * `canOccupy` is the caller's terrain predicate.
 */
export function movementOffsetIsTraversable(input: {
  node: ReadonlyVec3;
  offset: ReadonlyVec3;
  canOccupy: (position: Vec3) => boolean;
}): boolean {
  const destination: Vec3 = [
    input.node[0] + input.offset[0],
    input.node[1] + input.offset[1],
    input.node[2] + input.offset[2],
  ];
  if (!input.canOccupy(destination)) {
    return false;
  }
  if (!isDiagonalOffset(input.offset)) {
    return true;
  }
  return diagonalCornerProbes(input.node, input.offset).every((probe) =>
    input.canOccupy(probe)
  );
}

/**
 * Resolves a raw float world position to the nearest voxel a body can stand in.
 *
 * Search order is by absolute distance from the rounded Y (0, -1, +1, -2, +2 ...)
 * with a bias toward looking DOWN first at equal distance, because a body's feet
 * sit on the surface below it. Returns `undefined` when nothing in range is
 * occupiable, which the caller must treat as "unreachable" rather than silently
 * substituting a solid voxel.
 */
export function nearestStandingVoxel(input: {
  position: ReadonlyVec3;
  canOccupy: (position: Vec3) => boolean;
  searchUp?: number;
  searchDown?: number;
}): Vec3 | undefined {
  const x = Math.round(input.position[0]);
  const z = Math.round(input.position[2]);
  const baseY = Math.round(input.position[1]);
  const up = Math.max(0, input.searchUp ?? PATHFINDING_STANDING_SEARCH_UP);
  const down = Math.max(
    0,
    input.searchDown ?? PATHFINDING_STANDING_SEARCH_DOWN
  );
  const candidates: number[] = [baseY];
  for (let step = 1; step <= Math.max(up, down); step += 1) {
    if (step <= down) candidates.push(baseY - step);
    if (step <= up) candidates.push(baseY + step);
  }
  for (const y of candidates) {
    const candidate: Vec3 = [x, y, z];
    if (input.canOccupy(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export interface PathDestinationDecisionInput {
  /** Current final node of the cached path, or undefined when there is none. */
  destination: ReadonlyVec3 | undefined;
  /**
   * Where A* actually routed to, which is NOT the same as `destination` once the
   * tail has been repaired.
   *
   * Drift must be measured from the searched destination, or repairs compound: a
   * player moving two metres per tick is always "within repair range" of the
   * previous repair, so the tail chases them indefinitely while the intermediate
   * nodes still lead somewhere forty metres away. Defaults to `destination` for
   * callers that have not yet stored it.
   */
  searchDestination?: ReadonlyVec3;
  targetPosition: ReadonlyVec3;
  /** Beyond this the path no longer leads to the target at all. */
  maxDriftMeters: number;
  repairRadiusMeters?: number;
  nowSeconds: number;
  lastSearchAtSeconds?: number;
  rebuildCooldownSeconds?: number;
}

export type PathDestinationDecision =
  | { kind: "keep" }
  | { kind: "repair"; destination: Vec3 }
  | { kind: "rebuild" }
  | { kind: "wait_for_cooldown" };

/**
 * Decides what to do with a cached path when the target has moved.
 *
 * `repair` is the new middle ground: a player who stepped one voxel sideways does
 * not invalidate the twenty nodes of route behind them, so we swap the final node
 * and keep walking. Only a genuine drift forces a rebuild, and rebuilds are rate
 * limited so a sprinting player cannot pin every nearby NPC in A*.
 */
export function evaluatePathDestination(
  input: PathDestinationDecisionInput
): PathDestinationDecision {
  const cooldown =
    input.rebuildCooldownSeconds ?? PATHFINDING_REBUILD_COOLDOWN_SECONDS;
  const sinceSearch =
    input.lastSearchAtSeconds === undefined
      ? Number.POSITIVE_INFINITY
      : input.nowSeconds - input.lastSearchAtSeconds;

  if (!input.destination) {
    return sinceSearch >= cooldown
      ? { kind: "rebuild" }
      : { kind: "wait_for_cooldown" };
  }

  const driftFromTail = distance(input.destination, input.targetPosition);
  if (
    driftFromTail <=
    (input.repairRadiusMeters ?? PATHFINDING_DESTINATION_REPAIR_METERS)
  ) {
    return { kind: "keep" };
  }
  const driftFromSearch = distance(
    input.searchDestination ?? input.destination,
    input.targetPosition
  );
  if (driftFromSearch <= input.maxDriftMeters) {
    return {
      kind: "repair",
      // Keep the raw target here. The caller must resolve it through the same
      // terrain-aware standing-voxel search used for a full A* destination
      // before mutating the path. Blindly rounding here reintroduced the exact
      // hill bug this module was created to fix: a repaired tail could point at
      // a solid voxel even though a valid standing voxel existed one block down.
      destination: [...input.targetPosition] as Vec3,
    };
  }
  return sinceSearch >= cooldown
    ? { kind: "rebuild" }
    : { kind: "wait_for_cooldown" };
}

function distance(a: ReadonlyVec3, b: ReadonlyVec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
