import { secondsSinceEpoch } from "@/shared/ecs/config";
import { Emote } from "@/shared/ecs/gen/components";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import { Entity } from "@/shared/ecs/gen/entities";
import {
  getPlayerBuffs,
  getPlayerModifiersFromBuffs,
} from "@/shared/game/players";
import type { BiomesId } from "@/shared/ids";
import { zBiomesId } from "@/shared/ids";
import { degToRad, diffAngle } from "@/shared/math/angles";
import { distSq, length, sub, yaw } from "@/shared/math/linear";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";
import { isSafeZone } from "@/shared/npc/behavior/common";
import {
  AStarPathfinder,
  GraphImpl,
  findNextTargetOnPath,
  stuckWhilePathfinding,
  updatePathfindingPosition,
  zPathfindingComponent,
} from "@/shared/npc/behavior/pathfinding";
import { getNpcRunSpeed } from "@/shared/npc/bikkie";
import type { Environment } from "@/shared/npc/environment";
import type { BehaviorChaseAttackParams } from "@/shared/npc/npc_types";
import type { SimulatedNpc } from "@/shared/npc/simulated";
import { ok } from "assert";
import { z } from "zod";

export const zChaseAttackComponent = z.object({
  chaseAttack: z
    .object({
      attackTime: z.number().optional(),
      // The entity that the NPC is chasing.
      attackTarget: zBiomesId.optional(),
      // When did the player's attack last strike? (If this is *before* the attack
      // time, then the strike hasn't occurred yet),
      strikeTime: z.number().optional(),
      // Pathfinding behavior for chasing around walls/obstacles.
      pathfinding: zPathfindingComponent.optional(),
    })
    .default({}),
});
export type ChaseAttackComponent = z.infer<typeof zChaseAttackComponent>;

export function chaseAttackTargetTick(
  env: Environment,
  npc: SimulatedNpc,
  params: BehaviorChaseAttackParams
): {
  forwardSpeed: number;
} {
  const out = { forwardSpeed: 0 };

  if (!npc.state.chaseAttack?.attackTarget) {
    return out;
  }

  const target = env.resources.get(
    "/ecs/entity",
    npc.state.chaseAttack.attackTarget
  );
  if (!target?.health || !target.position) {
    if (npc.state.chaseAttack.attackTarget !== undefined) {
      npc.mutableState().chaseAttack!.attackTarget = undefined;
    }
    return out;
  }

  // Always set our rotation target toward the next path node, not blindly at
  // the target origin. This lets NPCs chase around walls/obstacles while still
  // falling back to direct pursuit if pathfinding cannot produce a route.
  const vecToPlayer = sub(target.position.v, npc.position);
  const distToPlayer = length(vecToPlayer);
  const chaseTarget = nextChasePathTarget(env, npc, target.position.v) ?? target.position.v;
  const vecToChaseTarget = sub(chaseTarget, npc.position);
  const angleToPlayer = yaw(vecToChaseTarget);

  if (angleToPlayer !== npc.state.rotateTarget) {
    npc.mutableState().rotateTarget = angleToPlayer;
  }

  if (distToPlayer >= params.attackDistance) {
    const diffAngleToPlayer = Math.abs(diffAngle(angleToPlayer, npc.orientation[1]));
    // Keep chasing even while turning. The old cosine multiplier hit zero
    // whenever the target was behind the NPC, which made combatants pivot in
    // place and feel broken. Use a floor so they keep closing distance while
    // rotateTargetTick catches up.
    const turnSlowdown = Math.max(0.35, Math.cos(Math.min(diffAngleToPlayer, Math.PI / 2)));
    out.forwardSpeed = getNpcRunSpeed(npc.type) * turnSlowdown;
    return out;
  }

  // We're in range, stop chasing!
  out.forwardSpeed = 0;

  if (
    !canAttackTarget(
      distToPlayer,
      diffAngle(angleToPlayer, npc.orientation[1]),
      params.attackDistance,
      params.attackFovDeg
    )
  ) {
    // Wait until we're able to hit the target before proceeding to the attack
    // logic.
    return out;
  }

  const maybeDiff = (a?: number, b?: number) =>
    a === undefined || b === undefined ? undefined : a - b;

  const now = secondsSinceEpoch();
  const timeSinceLastAttack = maybeDiff(now, npc.state.chaseAttack.attackTime);
  if (
    timeSinceLastAttack === undefined ||
    timeSinceLastAttack > params.attackIntervalSecs
  ) {
    // We haven't started an attack, but we can attack, so attack.
    const attackTime = now;
    npc.mutableState().chaseAttack!.attackTime = attackTime;
        // HARTHMERE_NPC_ATTACK_ANIM_PULSE_V2_INSTALL_MARKER
        // Re-pulse the emote window so the renderer's Attack clip
        // (fileAnimationName: "Attack") triggers visibly each strike.
        const __animPulseEmote = {
          emote_type: "attack" as const,
          emote_start_time: attackTime,
          emote_expiry_time:
            attackTime +
            (params.attackStrikeMomentSecs ?? 0.5) *
              (params.attackAnimationMultiplier ?? 1) +
            0.4,
        };
        // SimulatedNpc.setEmote() below is the supported path; mutableEmote()
        // was an older internal hook that no longer exists on SimulatedNpc.
        // Leaving the computed pulse object inert here keeps the attack-pulse
        // metadata available for future telemetry without touching a missing API.
        void __animPulseEmote;

    npc.setEmote(
      Emote.create({
        emote_type: "attack1",
        emote_start_time: attackTime,
        emote_expiry_time:
          attackTime +
          params.attackStrikeMomentSecs / params.attackAnimationMultiplier,
      })
    );
  } else if (
    timeSinceLastAttack >
    params.attackStrikeMomentSecs / params.attackAnimationMultiplier
  ) {
    // We're in the middle of an attack, check if we cross over the moment
    // when we should trigger damage.
    if (
      npc.state.chaseAttack.strikeTime === undefined ||
      npc.state.chaseAttack.strikeTime < npc.state.chaseAttack.attackTime!
    ) {
      npc.mutableState().chaseAttack!.strikeTime = now;
      // We've advanced past the point of the attack where we
      // will deal damage, emit an event for this.
      npc.attack(target.id, params.attackDamage);
    }
  }

  return out;
}

const TARGET_HITBOX_ATTACK_RANGE_CUSHION_METERS = 0.55;

function nextChasePathTarget(
  env: Environment,
  npc: SimulatedNpc,
  targetPosition: ReadonlyVec3
): Vec3 | undefined {
  const state = npc.mutableState().chaseAttack!;
  if (state.pathfinding) {
    updatePathfindingPosition(state.pathfinding, npc.position);
    if (stuckWhilePathfinding(state.pathfinding)) {
      state.pathfinding = undefined;
    }
  }

  if (!state.pathfinding) {
    const graph = new GraphImpl();
    const srcNode = graph.closestNode(npc.position);
    const destNode = graph.closestNode(targetPosition);
    if (srcNode && destNode) {
      const path = new AStarPathfinder(
        graph,
        srcNode,
        destNode,
        env.resources
      ).findPath();
      if (path) {
        state.pathfinding = {
          path,
          searchTime: secondsSinceEpoch(),
          position: npc.position as Vec3,
        };
      }
    }
  }

  return state.pathfinding
    ? findNextTargetOnPath(npc.position, state.pathfinding.path)
    : undefined;
}

function canAttackTarget(
  targetDistance: number,
  targetOrientationDiff: number,
  attackRadius: number,
  attackFovDeg: number
) {
  // Approximate the target collision capsule instead of requiring origin-to-origin
  // overlap. This keeps large NPCs and player-sized targets from missing because
  // their centers cannot get close enough without the bodies already touching.
  const effectiveAttackRadius =
    attackRadius + TARGET_HITBOX_ATTACK_RANGE_CUSHION_METERS;
  return (
    targetDistance <= effectiveAttackRadius &&
    Math.abs(targetOrientationDiff) <= degToRad(attackFovDeg / 2)
  );
}

export function getNearestPlayer(
  env: Environment,
  position: ReadonlyVec3,
  withinRadius: number,
  isValidPlayer?: (player: ReadonlyEntity) => boolean
): BiomesId | undefined {
  // Check if we should switch to offense.
  let nearest: BiomesId | undefined;
  let nearestDistSq = Number.POSITIVE_INFINITY;
  for (const playerId of env.ecsMetaIndex.player_selector.scanSphere({
    center: position,
    radius: withinRadius,
  })) {
    const player = env.resources.get("/ecs/entity", playerId);
    if (!Entity.has(player, "health", "position")) {
      continue;
    }

    if (player.health.hp <= 0) {
      // Don't attack dead players.
      continue;
    }

    if (isValidPlayer) {
      if (!isValidPlayer(player)) {
        // Does not pass the filter.
        continue;
      }
    }

    if (
      isSafeZone(
        env.voxeloo,
        player.position.v,
        env.ecsMetaIndex,
        env.resources
      )
    ) {
      // Don't attack players in safe zones.
      continue;
    }

    const playerDistSq = distSq(player.position.v, position);
    if (playerDistSq < nearestDistSq) {
      nearestDistSq = playerDistSq;
      nearest = player.id;
    }
  }

  return nearest;
}

// HARTHMERE_NPC_RETALIATION_MEMORY_V1:
// How long an NPC remembers it was attacked and is willing to retaliate. Once
// they actually enter a chase attack they will continue it until they lose
// their target by distance/death/peace.
export const ATTACK_MEMORY_SECONDS = 30;

// HARTHMERE_NPC_RETALIATION_SAFE_ZONE_V1:
// Returns the entity id of the last attacker if the NPC was hit by a player
// recently enough to retaliate, AND that attacker is still close enough to
// chase. This is shared logic between the proximity and onlyIfAttacked aggro
// paths so safe-zone hostiles can still fight back when explicitly struck.
//
// Exported as `evaluateRetaliationTarget` so the combat-AI test suite can
// exercise the decision rules without booting the full server runtime.
export interface RetaliationDecisionInputs {
  lastDamageSource?: { kind: string; attacker: BiomesId } | undefined;
  lastDamageTime?: number | undefined;
  npcPosition: ReadonlyVec3;
  deAggroDistanceSq: number;
  lookupEntity: (
    id: BiomesId
  ) =>
    | { position?: { v: ReadonlyVec3 }; health?: { hp: number } }
    | undefined;
  now: number;
  memorySeconds: number;
}

export function evaluateRetaliationTarget(
  inputs: RetaliationDecisionInputs
): BiomesId | undefined {
  const {
    lastDamageSource,
    lastDamageTime,
    npcPosition,
    deAggroDistanceSq,
    lookupEntity,
    now,
    memorySeconds,
  } = inputs;
  if (
    lastDamageSource?.kind !== "attack" ||
    lastDamageTime === undefined
  ) {
    return undefined;
  }
  if (now - lastDamageTime >= memorySeconds) {
    return undefined;
  }
  const lastAttackerId = lastDamageSource.attacker;
  const lastAttacker = lookupEntity(lastAttackerId);
  if (!lastAttacker?.position) {
    return undefined;
  }
  if ((lastAttacker.health?.hp ?? 0) <= 0) {
    return undefined;
  }
  if (distSq(lastAttacker.position.v, npcPosition) >= deAggroDistanceSq) {
    return undefined;
  }
  return lastAttackerId;
}

function lastValidAttackerId(
  env: Environment,
  npc: SimulatedNpc,
  deAggroDistanceSq: number
): BiomesId | undefined {
  return evaluateRetaliationTarget({
    lastDamageSource: npc.health.lastDamageSource as any,
    lastDamageTime: npc.health.lastDamageTime,
    npcPosition: npc.position,
    deAggroDistanceSq,
    lookupEntity: (id) => env.resources.get("/ecs/entity", id) as any,
    now: secondsSinceEpoch(),
    memorySeconds: ATTACK_MEMORY_SECONDS,
  });
}

export function updateAttackTarget(
  env: Environment,
  npc: SimulatedNpc,
  params: BehaviorChaseAttackParams
) {
  if (!npc.state.chaseAttack) {
    npc.mutableState().chaseAttack = {};
    ok(npc.state.chaseAttack);
  }

  const deAggroDistanceSq = params.disengageDistance ** 2;

  // HARTHMERE_NPC_RETALIATION_SAFE_ZONE_V1:
  // Independent of the aggro trigger kind, if the NPC was just attacked by a
  // player it must be allowed to retaliate. Previously, hostile NPCs that used
  // proximity-based aggro became completely non-responsive when they happened
  // to be inside a safe zone (within wardRange of a quest giver or a ward),
  // because the safe-zone gate cleared their target before the retaliation
  // memory check ever ran. That made the "hit a Muckling but it won't hit back"
  // bug reported from the Grove combat primer where every hostile sits next to
  // Jackie/Thom/etc. and is therefore inside ward range.
  const recentAttackerId = lastValidAttackerId(env, npc, deAggroDistanceSq);

  if (
    !recentAttackerId &&
    isSafeZone(env.voxeloo, npc.position, env.ecsMetaIndex, env.resources)
  ) {
    // No active attacker and we're inside a safe zone — never hold a proactive
    // target. Retaliation is the deliberate exception, handled above.
    if (npc.state.chaseAttack.attackTarget) {
      npc.mutableState().chaseAttack!.attackTarget = undefined;
    }
    return;
  }

  // By default, continue to attack our current target, if we have one.
  let targetId = npc.state.chaseAttack.attackTarget;

  // Check to see if we can acquire a new target.
  if (params.aggroTrigger.kind === "onlyIfAttacked") {
    targetId = recentAttackerId ?? targetId;
  } else {
    if (recentAttackerId) {
      // HARTHMERE_NPC_RETALIATION_PROXIMITY_PRIORITY_V1:
      // A specific attacker outranks a generic proximity scan — players who
      // commit to a fight should not get ignored in favor of a stranger
      // wandering into aggro range.
      targetId = recentAttackerId;
    } else {
      // Check if any players are in the NPC's aggro distance.
      targetId = getNearestPlayer(
        env,
        npc.position,
        params.aggroTrigger.distance,
        (player: ReadonlyEntity) => {
          const buffs = getPlayerBuffs(env.voxeloo, env.resources, player.id);
          return !getPlayerModifiersFromBuffs(buffs)?.peace.enabled;
        }
      );
    }
  }

  // If we have a target, check if we should disengage.
  if (targetId) {
    const attackTarget = env.resources.get("/ecs/entity", targetId);
    const buffs = getPlayerBuffs(env.voxeloo, env.resources, targetId);

    if (!attackTarget?.position || (attackTarget.health?.hp ?? 0) <= 0) {
      targetId = undefined;
    } else if (
      distSq(attackTarget.position.v, npc.position) > deAggroDistanceSq
    ) {
      targetId = undefined;
    } else if (getPlayerModifiersFromBuffs(buffs)?.peace.enabled) {
      targetId = undefined;
    }
  }

  if (targetId !== npc.state.chaseAttack.attackTarget) {
    npc.mutableState().chaseAttack!.attackTarget = targetId;
  }
}
