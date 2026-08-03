import { secondsSinceEpoch } from "@/shared/ecs/config";
import { dist, yaw } from "@/shared/math/linear";
import type { Vec3 } from "@/shared/math/types";
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

export function businessCustomerStateOf(
  npc: SimulatedNpc
): BusinessCustomerState | undefined {
  return npc.state.businessCustomer as BusinessCustomerState | undefined;
}
export function npcHasBusinessCustomerAssignment(npc: SimulatedNpc) {
  return businessCustomerStateOf(npc) !== undefined;
}

function isStationaryPhase(phase: BusinessCustomerPhase) {
  return (
    phase === "queued" ||
    phase === "serving" ||
    phase === "despawn_ready" ||
    phase === "despawned"
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
        path,
        searchTime: nowSeconds,
        position: [...npc.position] as Vec3,
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

  if (isStationaryPhase(state.phase)) {
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
  const needsPath =
    !state.pathfinding ||
    !currentDestination ||
    dist(currentDestination, nextTarget) > 1.1 ||
    stuckWhilePathfinding(state.pathfinding, nowSeconds);
  if (needsPath) {
    mutable.pathfinding = buildPath(env, npc, nextTarget, nowSeconds);
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
