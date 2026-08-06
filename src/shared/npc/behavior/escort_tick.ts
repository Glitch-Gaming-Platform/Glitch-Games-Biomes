// HARTHMERE_ESCORT — Anima-side execution of the unified escort state.
//
// The scheduler assigns `npc_state.escort` and nothing else. Everything below —
// locomotion, terrain physics, combat targeting, recovery — is owned here, by the
// same Anima tick that already drives every other NPC.
//
// This is the structural fix for the committed jobs-board escort, which
// reconstructed the companion entity in ECS once a second from live-mode Redis.
// That design had to hard-code `isAttackable: false` and suppress attacks,
// because enabling combat would have let each projection clobber the health,
// velocity, target, and Anima state that combat produces. Assigning intent and
// letting Anima own execution removes the conflict entirely.
//
// The pure policy lives in `escort.ts`; this file only supplies world
// observations and applies the result.

import { secondsSinceEpoch } from "@/shared/ecs/config";
import { Entity } from "@/shared/ecs/gen/entities";
import type { BiomesId } from "@/shared/ids";
import { yaw } from "@/shared/math/linear";
import type { Vec3 } from "@/shared/math/types";
import { horizontalDistance } from "@/shared/npc/behavior/combat_geometry";
import {
  escortFormationAnchor,
  escortLocomotionDecision,
  escortPathProgress,
  escortShouldWarp,
  escortStatusFor,
  escortWarpAnchor,
  evaluateEscortCombatTarget,
  type EscortHostileCandidate,
  type EscortState,
} from "@/shared/npc/behavior/escort";
import { GraphImpl } from "@/shared/npc/behavior/pathfinding";
import { isMuckerOrHexerNameForNightAggro } from "@/shared/npc/behavior/chase_attack";
import { getNpcRunSpeed } from "@/shared/npc/bikkie";
import type { Environment } from "@/shared/npc/environment";
import type { SimulatedNpc } from "@/shared/npc/simulated";

export const HARTHMERE_ESCORT_TICK_VERSION =
  "harthmere-escort-tick-v1" as const;

/** Radius scanned for hostiles an escort might be allowed to fight. */
const ESCORT_HOSTILE_SCAN_RADIUS = 24;

export function escortStateOf(npc: SimulatedNpc): EscortState | undefined {
  return npc.state.escort as EscortState | undefined;
}

export function npcHasEscortAssignment(npc: SimulatedNpc): boolean {
  return escortStateOf(npc) !== undefined;
}

function leaderPose(env: Environment, leaderId: BiomesId) {
  const leader = env.resources.get("/ecs/entity", leaderId);
  if (!leader?.position) return undefined;
  return {
    position: leader.position.v,
    yawRadians: leader.orientation?.v[1] ?? 0,
    alive: (leader.health?.hp ?? 1) > 0,
  };
}

/**
 * Chooses the escort's combat target from its policy, and writes it into the
 * normal `chaseAttack` slot so the existing chase/attack tick executes the fight.
 * Returns the chosen target so the caller can decide locomotion priority.
 *
 * Escorts deliberately do NOT use proximity aggro: an escort that picks its own
 * fights turns a delivery into an unwinnable brawl, and one that can hit
 * livestock or civilians is a griefing tool.
 */
export function updateEscortCombatTarget(
  env: Environment,
  npc: SimulatedNpc
): BiomesId | undefined {
  const escort = escortStateOf(npc);
  if (!escort) return undefined;

  if (escort.combatPolicy === "noncombatant") {
    if (npc.state.chaseAttack?.attackTarget !== undefined) {
      npc.mutableState().chaseAttack!.attackTarget = undefined;
    }
    npc.setPublicCombatTarget(undefined);
    return undefined;
  }

  const leader = leaderPose(env, escort.leaderId);
  const candidates: EscortHostileCandidate[] = [];
  const recentAttackerId =
    npc.health.lastDamageSource?.kind === "attack"
      ? (npc.health.lastDamageSource as { attacker: BiomesId }).attacker
      : undefined;

  for (const candidateId of env.ecsMetaIndex.npc_selector.scanSphere({
    center: npc.position,
    radius: ESCORT_HOSTILE_SCAN_RADIUS,
  })) {
    if (candidateId === npc.id) continue;
    const candidate = env.resources.get("/ecs/entity", candidateId);
    if (!Entity.has(candidate, "health", "position")) continue;
    const label = candidate.label?.text;
    const isMuck = isMuckerOrHexerNameForNightAggro(label);
    const attackTarget = candidate.npc_combat_state?.attack_target;
    candidates.push({
      id: candidate.id,
      isMuck,
      // An escort may only ever fight something that is itself hostile. A grazing
      // cow or a town civilian is never a valid escort target.
      hostile: isMuck || attackTarget !== undefined,
      alive: candidate.health.hp > 0,
      attackingLeader: attackTarget === escort.leaderId,
      attackingEscort:
        attackTarget === npc.id || candidate.id === recentAttackerId,
      distanceToEscort: horizontalDistance(candidate.position.v, npc.position),
      distanceToLeader: leader
        ? horizontalDistance(candidate.position.v, leader.position)
        : Number.POSITIVE_INFINITY,
    });
  }

  const targetId = evaluateEscortCombatTarget({
    policy: escort.combatPolicy,
    candidates,
  });

  if (!npc.state.chaseAttack) {
    npc.mutableState().chaseAttack = {};
  }
  if (npc.state.chaseAttack?.attackTarget !== targetId) {
    npc.mutableState().chaseAttack!.attackTarget = targetId;
  }
  npc.setPublicCombatTarget(targetId);
  return targetId;
}

/**
 * Follow locomotion for one tick.
 *
 * Movement is expressed as a forward speed plus a rotate target, exactly like
 * every other NPC behaviour, so the escort inherits collision, climbing, gravity,
 * and ground settling for free. That is the whole point: the previous
 * implementation wrote positions straight into ECS and therefore had no terrain
 * grounding at all, which on hills produced floating and buried companions.
 */
export function escortTick(
  env: Environment,
  npc: SimulatedNpc,
  nowSeconds = secondsSinceEpoch()
): { forwardSpeed: number } {
  const escort = escortStateOf(npc);
  if (!escort) return { forwardSpeed: 0 };

  const mutable = npc.mutableState();
  const state = mutable.escort!;
  const leader = leaderPose(env, escort.leaderId);
  if (!leader) {
    // Leader paged out or deleted. Hold position rather than wandering off with
    // a stale anchor; the assigning scheduler owns clearing the assignment.
    state.status = "following";
    return { forwardSpeed: 0 };
  }
  state.lastLeaderSeenAtSeconds = nowSeconds;

  const anchor = escortFormationAnchor({
    leaderPosition: leader.position,
    leaderYawRadians: leader.yawRadians,
    followDistance: escort.followDistance,
    formationSlot: escort.formationSlot,
  });
  const distanceToAnchor = horizontalDistance(anchor, npc.position);
  const distanceToLeader = horizontalDistance(leader.position, npc.position);
  const destinationDistance = escort.destination
    ? horizontalDistance(escort.destination, npc.position)
    : undefined;

  const decision = escortLocomotionDecision({
    distanceToFormationAnchor: distanceToAnchor,
    distanceToLeader,
    leashDistance: escort.leashDistance,
    destinationDistance,
  });

  // Track useful catch-up progress. Normal terrain physics own movement, but an
  // escort sliding along an obstacle without closing the gap must eventually use
  // the terrain-validated recovery warp instead of being left behind forever.
  const progress = escortPathProgress({
    catchingUp: decision.action === "catch_up",
    position: npc.position,
    nowSeconds,
    lastProgressPosition: state.lastProgressPosition,
    lastProgressAtSeconds: state.lastProgressAtSeconds,
    pathFailingSinceSeconds: state.pathFailingSinceSeconds,
    distanceToLeader,
    lastProgressDistanceToLeader: state.lastProgressDistanceToLeader,
  });
  state.lastProgressPosition = progress.lastProgressPosition;
  state.lastProgressAtSeconds = progress.lastProgressAtSeconds;
  state.pathFailingSinceSeconds = progress.pathFailingSinceSeconds;
  state.lastProgressDistanceToLeader = progress.lastProgressDistanceToLeader;

  if (
    escortShouldWarp({
      distanceToLeader,
      leashDistance: escort.leashDistance,
      pathFailingSinceSeconds: state.pathFailingSinceSeconds,
      nowSeconds,
      inCombat: Boolean(npc.state.chaseAttack?.attackTarget),
    })
  ) {
    const warpTo = escortWarpAnchor({
      leaderPosition: leader.position,
      leaderYawRadians: leader.yawRadians,
      followDistance: escort.followDistance,
      formationSlot: escort.formationSlot,
    });
    // A formation anchor is intent, not a guaranteed-safe landing point. Resolve
    // it through the same terrain occupancy graph used by NPC pathfinding; if no
    // standable voxel exists, keep following and retry instead of teleporting
    // into a hill or empty air.
    const safeWarpNode = new GraphImpl().closestNode(warpTo, env.resources);
    if (safeWarpNode) {
      npc.setPosition(safeWarpNode.position as Vec3);
      npc.setVelocity([0, 0, 0]);
      state.pathFailingSinceSeconds = undefined;
      state.lastProgressPosition = [...safeWarpNode.position] as Vec3;
      state.lastProgressAtSeconds = nowSeconds;
      state.lastProgressDistanceToLeader = 0;
      state.status = "following";
      return { forwardSpeed: 0 };
    }
  }

  if (decision.runSpeedMultiplier > 0) {
    mutable.rotateTarget = yaw([
      anchor[0] - npc.position[0],
      0,
      anchor[2] - npc.position[2],
    ]);
  } else {
    // Holding station: face the way the leader faces so a stopped party looks
    // like a party rather than a huddle.
    mutable.rotateTarget = leader.yawRadians;
  }

  state.status = escortStatusFor({
    hasCombatTarget: Boolean(npc.state.chaseAttack?.attackTarget),
    alive: npc.hp > 0,
    action: decision.action,
  });

  return {
    forwardSpeed: getNpcRunSpeed(npc.type) * decision.runSpeedMultiplier,
  };
}
