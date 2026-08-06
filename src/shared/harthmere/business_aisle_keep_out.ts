import {
  HARTHMERE_BUSINESS_INTERIORS,
  harthmereBusinessInteriorForOutpost,
  harthmereBusinessInteriorInteractionPoints,
  harthmereBusinessInteriorLocalToWorld,
  type HarthmereBusinessInteriorManifestRecord,
} from "@/shared/harthmere/business_interior_runtime";
import type { Vec3 } from "@/shared/math/types";

export const HARTHMERE_BUSINESS_AISLE_KEEP_OUT_VERSION =
  "harthmere-business-aisle-keep-out-v1" as const;

/**
 * HARTHMERE_BUSINESS_AISLE_KEEP_OUT — why persistent NPCs need a keep-out rule.
 *
 * The audited interiors publish a `protectedAisle` rectangle: the lane from the
 * front door to the service counter that the customer queue walks. The asset
 * pipeline validates it rigorously — the generator reports zero protected-aisle
 * intrusions across all 211 fixtures — but that check only ever covered
 * *fixtures*. Nothing checked the other thing that occupies floor space and
 * collides: persistent NPC bodies.
 *
 * Three families of them were standing in the lane:
 *
 * - Business owners. `ownerPositionForSafeSite` placed every owner at the
 *   centre of its building footprint, which is by construction the middle of
 *   the aisle, for all nineteen businesses.
 * - Chapter 1 quest actors whose authored posts happen to fall inside a
 *   business shell now that the outposts occupy their audited 24x20 / 28x22
 *   footprints. Ashline had two (a foreman and a quest giver) standing at
 *   roughly z=-57 and z=-55, directly across the entrance.
 * - Any future authored post, because nothing forbade it.
 *
 * A native NPC body is a collidable one-metre box. One of them parked in a
 * three-voxel doorway or a four-voxel aisle is indistinguishable, to physics,
 * from a wall — and it produces exactly the failure the widened doorway was
 * meant to end: a customer with a valid A* path that cannot advance.
 *
 * So the aisle becomes a first-class keep-out volume with a deterministic
 * relocation for anything authored inside it. Relocation is deliberately
 * *lateral*: a displaced NPC stays in the same room, at the same depth, facing
 * the same way, just moved to the working side of the shop. Owners keep reading
 * as "the person who runs this place", quest actors keep their staging, and the
 * lane stays walkable.
 *
 * The rule lives in shared authored data rather than in a repair script so a
 * cold seed, a warm-Redis refresh and any world reconciliation pass all produce
 * the same clear aisle.
 */

/**
 * Extra clearance, in metres, held around the published aisle rectangle.
 *
 * The aisle is sized for the queue's centre line. A body standing exactly on
 * the boundary still overlaps it by half its width, so the keep-out volume is
 * grown by half a body plus a small margin.
 */
export const HARTHMERE_BUSINESS_AISLE_KEEP_OUT_MARGIN_METERS = 0.75;

/**
 * Clearance held around the counter service points. The customer stands at the
 * customer point and the player works from the staff point; an NPC parked on
 * either makes the hand-off impossible.
 */
export const HARTHMERE_BUSINESS_SERVICE_POINT_KEEP_OUT_METERS = 1.5;

/**
 * Player bodies are not points. The authoritative ECS position is the centre
 * of the player's capsule, while the visible feet can already be touching the
 * staff-side floor beside a thick counter. Accept a small overlap across the
 * mathematical counter centre so ordinary collision/contact jitter does not
 * tell a correctly positioned player to go behind the counter again.
 *
 * Every audited customer point is at least 1.675 m beyond the boundary, so this
 * tolerance cannot admit a customer standing in the queue lane.
 */
export const HARTHMERE_BUSINESS_STAFF_SIDE_TOLERANCE_METERS = 0.75;

export interface HarthmereBusinessKeepOutVolume {
  outpostId: string;
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
  /** Vertical span of the first floor, so upper-floor posts are unaffected. */
  yMin: number;
  yMax: number;
}

/**
 * The protected aisle in world coordinates, grown by the body margin.
 *
 * Manifest aisle bounds are interior-local: `x` is local X and `y` is local
 * depth, which maps to world Z. Reading them as world coordinates, or forgetting
 * the depth/height swap, silently produces a keep-out volume somewhere else
 * entirely — so the conversion goes through the same
 * `harthmereBusinessInteriorLocalToWorld` helper the fixtures and collision
 * proxies use.
 */
export function harthmereBusinessAisleKeepOut(
  record: HarthmereBusinessInteriorManifestRecord
): HarthmereBusinessKeepOutVolume {
  const aisle = record.protectedAisle;
  const near = harthmereBusinessInteriorLocalToWorld(record, [
    aisle.xMin,
    aisle.yMin,
    0,
  ]);
  const far = harthmereBusinessInteriorLocalToWorld(record, [
    aisle.xMax,
    aisle.yMax,
    0,
  ]);
  const margin = HARTHMERE_BUSINESS_AISLE_KEEP_OUT_MARGIN_METERS;
  return {
    outpostId: record.outpostId,
    xMin: Math.min(near[0], far[0]) - margin,
    xMax: Math.max(near[0], far[0]) + margin,
    zMin: Math.min(near[2], far[2]) - margin,
    zMax: Math.max(near[2], far[2]) + margin,
    // Only the first floor. An upper-floor post is directly above the aisle but
    // has its own floor between it and the customers.
    yMin: record.shellOrigin[1],
    yMax: record.shellOrigin[1] + 4,
  };
}

function withinVolume(volume: HarthmereBusinessKeepOutVolume, point: Vec3) {
  return (
    point[0] >= volume.xMin &&
    point[0] <= volume.xMax &&
    point[2] >= volume.zMin &&
    point[2] <= volume.zMax &&
    point[1] >= volume.yMin &&
    point[1] <= volume.yMax
  );
}

/**
 * True when a persistent body at this world point would stand in the customer
 * lane or on a service point of the given business.
 */
export function harthmereBusinessPointBlocksAisle(
  record: HarthmereBusinessInteriorManifestRecord,
  point: Vec3
): boolean {
  if (withinVolume(harthmereBusinessAisleKeepOut(record), point)) return true;
  const points = harthmereBusinessInteriorInteractionPoints(record);
  for (const service of [points.customer, points.staff, points.entrance]) {
    const planar = Math.hypot(point[0] - service[0], point[2] - service[2]);
    const vertical = Math.abs(point[1] - service[1]);
    if (
      planar <= HARTHMERE_BUSINESS_SERVICE_POINT_KEEP_OUT_METERS &&
      vertical <= 4
    ) {
      return true;
    }
  }
  return false;
}

/**
 * HARTHMERE_BUSINESS_STAFF_SIDE
 *
 * True when a world point is on the staff side of the service counter.
 *
 * The shift is a mini-game played from *behind the counter*: the player stands
 * at the staff point, customers queue up the aisle and stop at the customer
 * point opposite, and the counter is between them. Nothing enforced that. The
 * proximity rule only required being near the counter, which is satisfied just
 * as well from the customer side — so a shift could be started and run while
 * standing in the queue's lane, facing the wrong way, blocking the customers
 * the player is supposed to be serving.
 *
 * The production HAR confirms the shape of the problem: the shift-start request
 * carried `businessInteractionPosition {x:652,y:65,z:-178}` for Greenlamp,
 * which is the side dashboard console, not the audited staff point at
 * `(656.5, 65, -175)`.
 *
 * Sidedness is measured along the room's depth axis, because that is how the
 * audited interiors are laid out for all 19: entrance at low local depth,
 * counter across the middle, staff behind it. The customer point is always
 * shallower than the staff point.
 */
export function harthmereBusinessPointIsStaffSide(
  record: HarthmereBusinessInteriorManifestRecord,
  point: Vec3
): boolean {
  const points = harthmereBusinessInteriorInteractionPoints(record);
  const boundary = (points.customer[2] + points.staff[2]) / 2;
  return points.staff[2] > points.customer[2]
    ? point[2] >= boundary - HARTHMERE_BUSINESS_STAFF_SIDE_TOLERANCE_METERS
    : point[2] <= boundary + HARTHMERE_BUSINESS_STAFF_SIDE_TOLERANCE_METERS;
}

/**
 * The business whose counter a point is working from, if the point is close
 * enough to serve and on the staff side.
 */
export function harthmereBusinessStaffSideStationForPoint(
  point: Vec3,
  maxDistanceMeters = HARTHMERE_BUSINESS_STAFF_STATION_RADIUS_METERS
): HarthmereBusinessInteriorManifestRecord | undefined {
  return HARTHMERE_BUSINESS_INTERIORS.find((record) => {
    const points = harthmereBusinessInteriorInteractionPoints(record);
    const planar = Math.hypot(
      point[0] - points.staff[0],
      point[2] - points.staff[2]
    );
    return (
      planar <= maxDistanceMeters &&
      Math.abs(point[1] - points.staff[1]) <= 4 &&
      harthmereBusinessPointIsStaffSide(record, point)
    );
  });
}

/**
 * How far from the audited staff point still counts as "behind the counter".
 *
 * Generous enough that the player is not pinned to a single voxel while
 * serving, tight enough that it cannot be satisfied from the customer aisle,
 * the doorway, or the far wall.
 */
export const HARTHMERE_BUSINESS_STAFF_STATION_RADIUS_METERS = 4.25;

/** The business whose aisle a world point falls in, if any. */
export function harthmereBusinessBlockedAisleForPoint(
  point: Vec3
): HarthmereBusinessInteriorManifestRecord | undefined {
  return HARTHMERE_BUSINESS_INTERIORS.find((record) =>
    harthmereBusinessPointBlocksAisle(record, point)
  );
}

/**
 * Move a post laterally out of the aisle, staying inside the shell.
 *
 * Lateral, not longitudinal, for two reasons. Depth carries meaning — an owner
 * belongs near the counter, a greeter near the door — and preserving it keeps
 * authored staging intact. And the aisle spans the room's full depth, so moving
 * along it cannot escape anyway.
 *
 * The side is chosen by whichever wall the post is already nearer, so a body
 * authored on the left of the room stays on the left. Ties break toward the
 * staff side of the counter, which is where shop personnel belong. The result
 * is clamped a metre inside the shell so a displaced body never ends up in a
 * wall — the failure mode that would replace one stuck NPC with another.
 */
export function harthmereBusinessPostClearOfAisle(
  record: HarthmereBusinessInteriorManifestRecord,
  point: Vec3
): Vec3 {
  if (!harthmereBusinessPointBlocksAisle(record, point)) {
    return [point[0], point[1], point[2]];
  }
  const keepOut = harthmereBusinessAisleKeepOut(record);
  const shellMinX = record.shellOrigin[0];
  const shellMaxX = record.shellOrigin[0] + record.footprint.width;
  const wallMargin = 1.5;
  const leftCandidate = keepOut.xMin - HARTHMERE_BUSINESS_AISLE_KEEP_OUT_MARGIN_METERS;
  const rightCandidate =
    keepOut.xMax + HARTHMERE_BUSINESS_AISLE_KEEP_OUT_MARGIN_METERS;
  const leftFits = leftCandidate >= shellMinX + wallMargin;
  const rightFits = rightCandidate <= shellMaxX - wallMargin;
  const nearerLeft =
    point[0] <= (keepOut.xMin + keepOut.xMax) / 2 ? leftFits : !rightFits;
  const chosenX = nearerLeft && leftFits ? leftCandidate : rightCandidate;
  const clampedX = Math.min(
    Math.max(chosenX, shellMinX + wallMargin),
    shellMaxX - wallMargin
  );
  const moved: Vec3 = [clampedX, point[1], point[2]];
  if (!harthmereBusinessPointBlocksAisle(record, moved)) return moved;
  // Still conflicting means the post sat on a service point rather than in the
  // lane. Step it back off the counter along depth as well, toward the wall
  // behind the staff side, which is the only remaining free direction.
  const points = harthmereBusinessInteriorInteractionPoints(record);
  const staffIsDeeper = points.staff[2] > points.customer[2];
  const shellMinZ = record.shellOrigin[2];
  const shellMaxZ = record.shellOrigin[2] + record.footprint.depth;
  const depthStep = HARTHMERE_BUSINESS_SERVICE_POINT_KEEP_OUT_METERS + 0.75;
  const shiftedZ = staffIsDeeper ? point[2] + depthStep : point[2] - depthStep;
  return [
    clampedX,
    point[1],
    Math.min(Math.max(shiftedZ, shellMinZ + wallMargin), shellMaxZ - wallMargin),
  ];
}

/**
 * Clear a post of every business aisle, not just one.
 *
 * Outposts do not overlap, but a post nudged out of one shop must not land in a
 * neighbour's lane, and Chapter 1 actors are authored without any knowledge of
 * which business they are standing in. Resolving against the whole set — with a
 * bounded number of passes so a pathological arrangement cannot loop — keeps
 * the guarantee global.
 */
export function harthmereBusinessPostClearOfEveryAisle(point: Vec3): Vec3 {
  let current: Vec3 = [point[0], point[1], point[2]];
  for (let pass = 0; pass < HARTHMERE_BUSINESS_INTERIORS.length; pass += 1) {
    const blocking = harthmereBusinessBlockedAisleForPoint(current);
    if (!blocking) return current;
    const next = harthmereBusinessPostClearOfAisle(blocking, current);
    if (
      next[0] === current[0] &&
      next[1] === current[1] &&
      next[2] === current[2]
    ) {
      // No progress available; return the best position found rather than
      // spinning. The contract test surfaces this as a real authoring failure.
      return current;
    }
    current = next;
  }
  return current;
}

/**
 * Deterministic staff-side post for a business, used when authored data has no
 * meaningful position of its own (a shop owner belongs behind their counter).
 *
 * `index` fans multiple bodies along the back of the counter without stacking
 * them, so an owner and, say, an assistant do not occupy the same voxel.
 */
export function harthmereBusinessStaffSidePost(
  outpostId: string,
  index = 0
): Vec3 | undefined {
  const record = harthmereBusinessInteriorForOutpost(outpostId);
  if (!record) return undefined;
  const points = harthmereBusinessInteriorInteractionPoints(record);
  const keepOut = harthmereBusinessAisleKeepOut(record);
  const shellMaxX = record.shellOrigin[0] + record.footprint.width;
  const spacing = 1.6;
  const candidate: Vec3 = [
    keepOut.xMax + 0.75 + index * spacing,
    points.staff[1],
    points.staff[2],
  ];
  if (candidate[0] > shellMaxX - 1.5) {
    // Ran out of room on the right of the counter; fan left instead.
    candidate[0] = keepOut.xMin - 0.75 - index * spacing;
  }
  return harthmereBusinessPostClearOfEveryAisle(candidate);
}
