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
import type { ReadonlyVec3 } from "@/shared/math/types";
import { isSafeZone } from "@/shared/npc/behavior/common";
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

  // Always set our rotation target to face the player.
  const vecToPlayer = sub(target.position.v, npc.position);
  const distToPlayer = length(vecToPlayer);
  const angleToPlayer = yaw(vecToPlayer);

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

export function updateAttackTarget(
  env: Environment,
  npc: SimulatedNpc,
  params: BehaviorChaseAttackParams
) {
  if (!npc.state.chaseAttack) {
    npc.mutableState().chaseAttack = {};
    ok(npc.state.chaseAttack);
  }

  if (isSafeZone(env.voxeloo, npc.position, env.ecsMetaIndex, env.resources)) {
    // If we're off-limits, never hold a target.
    if (npc.state.chaseAttack.attackTarget) {
      npc.mutableState().chaseAttack!.attackTarget = undefined;
    }
    return;
  }

  // By default, continue to attack our current target, if we have one.
  let targetId = npc.state.chaseAttack.attackTarget;

  const deAggroDistanceSq = params.disengageDistance ** 2;

  // Check to see if we can acquire a new target.
  if (params.aggroTrigger.kind === "onlyIfAttacked") {
    // How long the NPC remembers it was attacked and is willing to retaliate.
    // Once they enter a chase attack though, they will continue it until they
    // lose their target.
    const ATTACK_MEMORY_SECONDS = 30;
    const health = npc.health;
    if (
      health.lastDamageSource?.kind === "attack" &&
      health.lastDamageTime !== undefined &&
      secondsSinceEpoch() - health.lastDamageTime < ATTACK_MEMORY_SECONDS
    ) {
      const lastAttackerId = health.lastDamageSource.attacker;
      const lastAttacker = env.resources.get("/ecs/entity", lastAttackerId);
      if (
        lastAttacker?.position &&
        distSq(lastAttacker.position.v, npc.position) < deAggroDistanceSq
      ) {
        targetId = lastAttackerId;
      }
    }
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
