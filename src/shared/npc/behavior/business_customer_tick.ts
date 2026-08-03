import { secondsSinceEpoch } from "@/shared/ecs/config";
import { dist, yaw } from "@/shared/math/linear";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";
import {
  type BusinessCustomerState,
  type BusinessCustomerPhase,
} from "@/shared/npc/behavior/business_customer";
import {
  AStarPathfinder,
  findNextTargetOnPath,
  GraphImpl,
  pathDestination,
  stuckWhilePathfinding,
  updatePathfindingPosition,
} from "@/shared/npc/behavior/pathfinding";
import { getNpcRunSpeed } from "@/shared/npc/bikkie";
import type { Environment } from "@/shared/npc/environment";
import type { SimulatedNpc } from "@/shared/npc/simulated";

export const HARTHMERE_BUSINESS_CUSTOMER_TICK_VERSION =
  "harthmere-business-customer-tick-v1" as const;

const ARRIVAL_DISTANCE = 0.85;
const SLOW_DISTANCE = 2.4;
const MAX_INITIAL_SPAWN_GROUNDING_DISTANCE = 4;
export const BUSINESS_CUSTOMER_GROUND_CLEARANCE_METERS = 0.02;

/**
 * Vertical error, in metres, above which a body is treated as off its walking
 * surface rather than merely bobbing on it. Half a voxel: anything less is
 * ordinary physics settle, anything more means the body is embedded in terrain
 * or floating over it, and in both cases the collision solver will fight the
 * walking force instead of letting the route run.
 */
const BUSINESS_CUSTOMER_REGROUND_HEIGHT_ERROR_METERS = 0.5;

/**
 * How long a body may make no forward progress on a moving phase before the
 * route is rebuilt and the body re-grounded.
 *
 * Anima keeps re-running A* on a stalled body and keeps getting a valid path,
 * because A* traverses voxel centres and does not know the swept body is
 * wedged. A changing path search timestamp is therefore not evidence of
 * locomotion — that mistake cost the original investigation several live
 * browser runs. Progress is measured on the authoritative position instead.
 */
const BUSINESS_CUSTOMER_STALL_SECONDS = 3;

/** Distance a body must cover within the stall window to count as moving. */
const BUSINESS_CUSTOMER_STALL_PROGRESS_METERS = 0.35;

export function groundedBusinessCustomerSpawnPosition(
  position: ReadonlyVec3,
  sourceNode: ReadonlyVec3,
  maxDistance = MAX_INITIAL_SPAWN_GROUNDING_DISTANCE
): Vec3 | undefined {
  const grounded: Vec3 = [
    sourceNode[0] + 0.5,
    sourceNode[1] + BUSINESS_CUSTOMER_GROUND_CLEARANCE_METERS,
    sourceNode[2] + 0.5,
  ];
  return dist(position, grounded) <= maxDistance ? grounded : undefined;
}

/**
 * Decide whether a body walking a route should be re-seated on its graph voxel.
 *
 * The original implementation only ever did this once, at spawn, within four
 * metres. That covered "the authored spawn Y was wrong" and nothing else — but
 * a customer can also be shouldered off the graded apron by the body behind it,
 * or drift onto a neighbouring column whose surface is a voxel higher. Once
 * that happens the body is embedded, the collision escape force fires, and the
 * customer never reaches the counter no matter how many valid paths Anima
 * authors for it.
 *
 * Re-seating is deliberately conservative: it only fires when the body is both
 * off its surface height *and* not making progress, so a customer walking
 * normally over a doorsill is never teleported. Queue advancement stays
 * path-driven; this only corrects the body onto the surface it is already
 * standing over.
 */
export function shouldRegroundBusinessCustomer(input: {
  position: ReadonlyVec3;
  sourceNode: ReadonlyVec3;
  stalledSeconds: number;
}): boolean {
  const heightError = Math.abs(
    input.position[1] -
      (input.sourceNode[1] + BUSINESS_CUSTOMER_GROUND_CLEARANCE_METERS)
  );
  return (
    heightError > BUSINESS_CUSTOMER_REGROUND_HEIGHT_ERROR_METERS &&
    input.stalledSeconds >= BUSINESS_CUSTOMER_STALL_SECONDS
  );
}

/**
 * Track forward progress on the authoritative position so a wedged body can be
 * distinguished from a slow one. Returns how long the body has been stalled.
 */
export function updateBusinessCustomerProgress(
  state: {
    progressPosition?: Vec3;
    progressAtSeconds?: number;
  },
  position: ReadonlyVec3,
  nowSeconds: number
): number {
  const previous = state.progressPosition;
  if (
    previous === undefined ||
    state.progressAtSeconds === undefined ||
    dist(previous, position) >= BUSINESS_CUSTOMER_STALL_PROGRESS_METERS
  ) {
    state.progressPosition = [position[0], position[1], position[2]];
    state.progressAtSeconds = nowSeconds;
    return 0;
  }
  return Math.max(0, nowSeconds - state.progressAtSeconds);
}

export function businessCustomerStateOf(
  npc: SimulatedNpc
): BusinessCustomerState | undefined {
  return npc.state.businessCustomer as BusinessCustomerState | undefined;
}
export function npcHasBusinessCustomerAssignment(npc: SimulatedNpc) {
  return businessCustomerStateOf(npc) !== undefined;
}

function isStationaryPhase(
  state: BusinessCustomerState,
  position: ReadonlyVec3
) {
  return (
    (state.phase === "queued" &&
      dist(position, state.queueTarget) <= ARRIVAL_DISTANCE) ||
    state.phase === "serving" ||
    state.phase === "despawn_ready" ||
    state.phase === "despawned"
  );
}

function actorPosition(
  env: Environment,
  state: BusinessCustomerState
): Vec3 | undefined {
  if (!state.actorEntityId) return undefined;
  const entity = env.resources.get("/ecs/entity", state.actorEntityId);
  return entity?.position?.v as Vec3 | undefined;
}

function phaseAfterRoute(state: BusinessCustomerState): BusinessCustomerPhase {
  if (state.phase === "departing" || state.phase === "cancelled") {
    return "despawn_ready";
  }
  const atCounter = dist(state.queueTarget, state.customer) <= 0.25;
  return atCounter ? "serving" : "queued";
}

function buildPath(
  env: Environment,
  npc: SimulatedNpc,
  target: Vec3,
  nowSeconds: number
) {
  const graph = new GraphImpl();
  const source = graph.closestNode(npc.position, env.resources);
  const destination = graph.closestNode(target, env.resources);
  if (!source || !destination) return undefined;
  const path = new AStarPathfinder(
    graph,
    source,
    destination,
    env.resources
  ).findPath();
  return path
    ? {
        source: source.position as Vec3,
        pathfinding: {
          path,
          searchTime: nowSeconds,
          position: [...npc.position] as Vec3,
        },
      }
    : undefined;
}

export function businessCustomerTick(
  env: Environment,
  npc: SimulatedNpc,
  nowSeconds = secondsSinceEpoch()
): { forwardSpeed: number; phase: BusinessCustomerPhase } {
  const state = businessCustomerStateOf(npc);
  if (!state) return { forwardSpeed: 0, phase: "despawned" };
  const mutable = npc.mutableState().businessCustomer! as BusinessCustomerState;

  if (state.phase === "serving") {
    const lookAt = actorPosition(env, state) ?? state.staff;
    mutable.waypointIndex = state.waypoints.length;
    npc.mutableState().rotateTarget = yaw([
      lookAt[0] - npc.position[0],
      0,
      lookAt[2] - npc.position[2],
    ]);
    return { forwardSpeed: 0, phase: state.phase };
  }

  if (isStationaryPhase(state, npc.position)) {
    if (state.phase === "queued") {
      npc.mutableState().rotateTarget = yaw([
        state.customer[0] - npc.position[0],
        0,
        state.customer[2] - npc.position[2],
      ]);
    }
    return { forwardSpeed: 0, phase: state.phase };
  }

  const target = state.waypoints[state.waypointIndex];
  if (!target) {
    mutable.phase = phaseAfterRoute(state);
    mutable.lastPhaseChangedAtSeconds = nowSeconds;
    mutable.pathfinding = undefined;
    return { forwardSpeed: 0, phase: mutable.phase };
  }

  const distanceToTarget = dist(npc.position, target);
  if (distanceToTarget <= ARRIVAL_DISTANCE) {
    mutable.waypointIndex += 1;
    mutable.pathfinding = undefined;
    if (mutable.waypointIndex >= state.waypoints.length) {
      mutable.phase = phaseAfterRoute(state);
      mutable.lastPhaseChangedAtSeconds = nowSeconds;
      return { forwardSpeed: 0, phase: mutable.phase };
    }
  }

  const nextTarget = state.waypoints[mutable.waypointIndex];
  if (!nextTarget) return { forwardSpeed: 0, phase: mutable.phase };

  const currentDestination = state.pathfinding
    ? pathDestination(state.pathfinding.path)
    : undefined;
  // Progress is measured on the authoritative position every tick, on every
  // moving phase — not only while entering. A body can wedge anywhere on the
  // route, and a stalled queue is just as broken as a stalled entrance.
  const stalledSeconds = updateBusinessCustomerProgress(
    mutable,
    npc.position,
    nowSeconds
  );
  const needsPath =
    !state.pathfinding ||
    !currentDestination ||
    dist(currentDestination, nextTarget) > 1.1 ||
    stuckWhilePathfinding(state.pathfinding, nowSeconds) ||
    // `stuckWhilePathfinding` only notices a body that stopped advancing along
    // an existing path. A body wedged against geometry can keep "advancing"
    // between two adjacent nodes forever, so real position progress is the
    // authority for whether the route needs rebuilding and the body re-seating.
    stalledSeconds >= BUSINESS_CUSTOMER_STALL_SECONDS;

  if (needsPath) {
    const hadPath = Boolean(state.pathfinding);
    const built = buildPath(env, npc, nextTarget, nowSeconds);
    if (built) {
      const atSpawn =
        !hadPath &&
        state.phase === "entering" &&
        state.waypointIndex === 0 &&
        dist(npc.position, npc.metadata.spawn_position) <= 1;
      const wedged = shouldRegroundBusinessCustomer({
        position: npc.position,
        sourceNode: built.source,
        stalledSeconds,
      });
      const grounded =
        atSpawn || wedged
          ? groundedBusinessCustomerSpawnPosition(
              npc.position,
              built.source,
              // A wedged body is re-seated onto the voxel it is already
              // standing over, so the tolerance is one voxel — never a
              // cross-room teleport.
              wedged && !atSpawn ? 1.5 : MAX_INITIAL_SPAWN_GROUNDING_DISTANCE
            )
          : undefined;
      if (grounded) {
        // Customer-only NPCs spawn outside and out of view. Seat the ECS anchor
        // on the terrain-aware A* source voxel so physics does not drop the
        // body into a nearby curb/ledge before locomotion starts, and re-seat
        // it if it later drifts off its walking surface and stops making
        // progress. Queue and departure movement remains entirely path-driven;
        // no queue node is ever teleported to.
        npc.setPosition(grounded);
        npc.setVelocity([0, 0, 0]);
        built.pathfinding.position = grounded;
        mutable.progressPosition = [grounded[0], grounded[1], grounded[2]];
        mutable.progressAtSeconds = nowSeconds;
      }
    }
    mutable.pathfinding = built?.pathfinding;
  } else if (mutable.pathfinding) {
    updatePathfindingPosition(mutable.pathfinding, npc.position);
  }

  const movementTarget = mutable.pathfinding
    ? findNextTargetOnPath(npc.position, mutable.pathfinding.path) ?? nextTarget
    : nextTarget;
  npc.mutableState().rotateTarget = yaw([
    movementTarget[0] - npc.position[0],
    0,
    movementTarget[2] - npc.position[2],
  ]);
  const baseSpeed = getNpcRunSpeed(npc.type);
  return {
    forwardSpeed:
      dist(npc.position, nextTarget) <= SLOW_DISTANCE
        ? baseSpeed * 0.48
        : baseSpeed * 0.72,
    phase: mutable.phase,
  };
}
