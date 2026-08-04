import { secondsSinceEpoch } from "@/shared/ecs/config";
import { dist, yaw } from "@/shared/math/linear";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";
import {
  type BusinessCustomerState,
  type BusinessCustomerPhase,
} from "@/shared/npc/behavior/business_customer";
import { getNpcRunSpeed } from "@/shared/npc/bikkie";
import type { Environment } from "@/shared/npc/environment";
import type { SimulatedNpc } from "@/shared/npc/simulated";

export const HARTHMERE_BUSINESS_CUSTOMER_TICK_VERSION =
  "harthmere-business-customer-tick-v3" as const;

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

function faceBusinessCustomerToward(npc: SimulatedNpc, target: ReadonlyVec3) {
  const targetYaw = yaw([
    target[0] - npc.position[0],
    0,
    target[2] - npc.position[2],
  ]);
  npc.mutableState().rotateTarget = targetYaw;
  npc.setOrientation([0, targetYaw]);
}

function holdBusinessCustomer(npc: SimulatedNpc) {
  npc.setVelocity([0, 0, 0]);
  return true;
}

export function businessCustomerTick(
  env: Environment,
  npc: SimulatedNpc,
  nowSeconds = secondsSinceEpoch(),
  dtSecs = 0.1
): {
  forwardSpeed: number;
  phase: BusinessCustomerPhase;
  kinematic: boolean;
} {
  const state = businessCustomerStateOf(npc);
  if (!state) {
    return { forwardSpeed: 0, phase: "despawned", kinematic: false };
  }
  const mutable = npc.mutableState().businessCustomer! as BusinessCustomerState;

  // Persistent authored patrons are ambient shop occupants, not shift
  // customers. Older retained worlds may still contain the former full-shop
  // waypoint loop, so hold them in place here rather than relying on a seed
  // reconciliation to prevent the whole store from running toward one corner.
  if (state.phase === "patron_wandering") {
    mutable.waypointIndex = 0;
    mutable.pathfinding = undefined;
    const anchor = npc.metadata.spawn_position;
    if (dist(npc.position, anchor) > 0.05) {
      npc.setPosition([anchor[0], anchor[1], anchor[2]]);
    }
    holdBusinessCustomer(npc);
    return { forwardSpeed: 0, phase: mutable.phase, kinematic: true };
  }

  if (state.phase === "serving") {
    const lookAt = actorPosition(env, state) ?? state.staff;
    mutable.waypointIndex = state.waypoints.length;
    if (dist(npc.position, state.customer) > 0.05) {
      npc.setPosition([
        state.customer[0],
        state.customer[1],
        state.customer[2],
      ]);
    }
    faceBusinessCustomerToward(npc, lookAt);
    holdBusinessCustomer(npc);
    return { forwardSpeed: 0, phase: state.phase, kinematic: true };
  }

  if (isStationaryPhase(state, npc.position)) {
    if (state.phase === "queued") {
      npc.setPosition([
        state.queueTarget[0],
        state.queueTarget[1],
        state.queueTarget[2],
      ]);
      faceBusinessCustomerToward(npc, state.customer);
    }
    holdBusinessCustomer(npc);
    return { forwardSpeed: 0, phase: state.phase, kinematic: true };
  }

  // Business interiors provide a collision-audited route from their doorway
  // through the queue and back out. Drive that authored route directly in
  // Anima instead of asking the terrain-only A* graph to rediscover a floor
  // that is represented by native ECS collision. This remains authoritative
  // server movement, but cannot be zeroed by a curb, terrain shard seam, or a
  // graph voxel two metres above the visible combined interior.
  mutable.pathfinding = undefined;
  while (mutable.waypointIndex < state.waypoints.length) {
    const target = state.waypoints[mutable.waypointIndex];
    if (dist(npc.position, target) > ARRIVAL_DISTANCE) break;
    npc.setPosition([target[0], target[1], target[2]]);
    mutable.waypointIndex += 1;
  }

  const nextTarget = state.waypoints[mutable.waypointIndex];
  if (!nextTarget) {
    mutable.phase = phaseAfterRoute(state);
    mutable.lastPhaseChangedAtSeconds = nowSeconds;
    mutable.progressPosition = [...npc.position];
    mutable.progressAtSeconds = nowSeconds;
    holdBusinessCustomer(npc);
    return { forwardSpeed: 0, phase: mutable.phase, kinematic: true };
  }

  const baseSpeed = getNpcRunSpeed(npc.type);
  const dx = nextTarget[0] - npc.position[0];
  const dz = nextTarget[2] - npc.position[2];
  const remaining = Math.hypot(dx, dz);
  const speed =
    remaining <= SLOW_DISTANCE ? baseSpeed * 0.48 : baseSpeed * 0.72;
  const step = Math.min(remaining, speed * Math.max(0, Math.min(dtSecs, 0.25)));
  const ratio = remaining > 0 ? step / remaining : 1;
  const nextPosition: Vec3 = [
    npc.position[0] + dx * ratio,
    // Authored business points are feet-plane positions. Keep that exact
    // height instead of inheriting terrain graph height from outside the GLB.
    nextTarget[1],
    npc.position[2] + dz * ratio,
  ];
  faceBusinessCustomerToward(npc, nextTarget);
  npc.setPosition(nextPosition);
  npc.setVelocity(
    remaining > 0 && ratio < 1
      ? [(dx / remaining) * speed, 0, (dz / remaining) * speed]
      : [0, 0, 0]
  );
  mutable.progressPosition = [...nextPosition];
  mutable.progressAtSeconds = nowSeconds;

  if (ratio >= 1) {
    mutable.waypointIndex += 1;
    if (mutable.waypointIndex >= state.waypoints.length) {
      mutable.phase = phaseAfterRoute(state);
      mutable.lastPhaseChangedAtSeconds = nowSeconds;
      holdBusinessCustomer(npc);
    }
  }
  return {
    forwardSpeed: 0,
    phase: mutable.phase,
    kinematic: true,
  };
}
