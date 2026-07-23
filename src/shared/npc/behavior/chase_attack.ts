import { secondsSinceEpoch } from "@/shared/ecs/config";
import { Emote } from "@/shared/ecs/gen/components";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import { Entity } from "@/shared/ecs/gen/entities";
import { CollisionHelper } from "@/shared/game/collision";
import {
  getPlayerBuffs,
  getPlayerModifiersFromBuffs,
} from "@/shared/game/players";
import { isDayTime, sunInclination } from "@/shared/game/sun_moon_position";
import type { BiomesId } from "@/shared/ids";
import { zBiomesId } from "@/shared/ids";
import { degToRad, diffAngle } from "@/shared/math/angles";
import {
  add,
  centerAndSideLengthToAABB,
  distSq,
  length,
  scale,
  sub,
  yaw,
} from "@/shared/math/linear";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";
import { isSafeZone } from "@/shared/npc/behavior/common";
import {
  AStarPathfinder,
  GraphImpl,
  findNextTargetOnPath,
  stuckWhilePathfinding,
  updatePathfindingPosition,
  zPathfindingComponent,
  type Path,
} from "@/shared/npc/behavior/pathfinding";
import { getNpcRunSpeed } from "@/shared/npc/bikkie";
import type { Environment } from "@/shared/npc/environment";
import type { BehaviorChaseAttackParams } from "@/shared/npc/npc_types";
import type { SimulatedNpc } from "@/shared/npc/simulated";
import {
  decayThreat,
  pickThreatPreferredTarget,
  type ThreatTable,
  type ThreatTargetCandidate,
} from "@/shared/npc/threat";
import { ok } from "assert";
import { z } from "zod";

// If the chase target drifts more than this far (meters) from the destination
// of the cached A* path, the path is stale and must be rebuilt instead of
// walking the NPC to where the target used to be.
const CHASE_PATH_TARGET_DRIFT_METERS = 3.0;
const CHASE_PATH_TARGET_DRIFT_SQ =
  CHASE_PATH_TARGET_DRIFT_METERS * CHASE_PATH_TARGET_DRIFT_METERS;
export const NIGHT_MUCKER_HEX_UNPROVOKED_AGGRO_DISTANCE = 30;
export const NIGHT_MUCKER_HEX_DISENGAGE_DISTANCE = 48;
export const NIGHT_MUCKER_HEX_MOVEMENT_MULTIPLIER = 1.8;
export const NIGHT_MUCKER_HEX_DAMAGE_MULTIPLIER = 1.5;
export const NIGHT_MUCKER_HEX_ATTACK_INTERVAL_MULTIPLIER = 0.55;
export const HARTHMERE_NPC_CHASE_SPEED_MULTIPLIER = 1.35;
// Normal player sprint animation transitions at 8 m/s. Keep Harthmere pursuit
// urgent without allowing an NPC to outrun a sprinting player on open ground.
export const HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND = 7.6;
const LINE_OF_SIGHT_SAMPLE_STEP_METERS = 0.45;
const LINE_OF_SIGHT_SAMPLE_BOX_METERS = 0.18;
const DEFAULT_PLAYER_EYE_HEIGHT_METERS = 1.45;

// The strike of a swing lands `attackStrikeMomentSecs / attackAnimationMultiplier`
// seconds in. If that delay is >= the attack interval, every new swing restarts
// before the strike window opens, so `npc.attack()` is never called and the NPC
// flails without ever dealing damage. Clamp the delay to sit strictly inside the
// interval so a hit always lands, regardless of biscuit configuration.
export function effectiveAttackStrikeDelaySecs(params: {
  attackStrikeMomentSecs: number;
  attackAnimationMultiplier: number;
  attackIntervalSecs: number;
}): number {
  const animationMultiplier =
    params.attackAnimationMultiplier > 0 ? params.attackAnimationMultiplier : 1;
  const rawDelay =
    Math.max(0, params.attackStrikeMomentSecs) / animationMultiplier;
  if (!(params.attackIntervalSecs > 0)) {
    return rawDelay;
  }
  // Keep the strike strictly before the interval boundary (95% of it) so the
  // damage branch is always reachable.
  return Math.min(rawDelay, params.attackIntervalSecs * 0.95);
}

// True when the cached path's destination no longer matches where the target is
// now (squared-distance comparison against `maxDriftSq`). An empty path is
// always considered stale.
export function chasePathTargetIsStale(
  path: Path,
  targetPosition: ReadonlyVec3,
  maxDriftSq: number
): boolean {
  const { nodes } = path;
  if (nodes.length === 0) {
    return true;
  }
  const destination = nodes[nodes.length - 1].position;
  return distSq(destination, targetPosition) > maxDriftSq;
}

export function isNightForNpcAggro(seconds: number): boolean {
  return !isDayTime(sunInclination(seconds));
}

export function isMuckerOrHexerNameForNightAggro(
  name: string | undefined
): boolean {
  const text = String(name ?? "").toLowerCase();
  if (
    /robot|bot|sentinel|sentential|sentiental|shield|beacon|board|voucher|ration|matter|ward/.test(
      text
    )
  ) {
    return false;
  }
  return /\b(muckling|mucker|muckwad|hex|hexer)\b|muck[-\s]scarred|pale\s+muck/.test(
    text
  );
}

export function isHarthmereSightBoundChaserName(
  name: string | undefined
): boolean {
  const text = String(name ?? "").toLowerCase();
  if (
    /robot|bot|sentinel|sentential|sentiental|shield|beacon|board|voucher|ration|matter|ward|prisoner/.test(
      text
    )
  ) {
    return false;
  }
  return (
    isMuckerOrHexerNameForNightAggro(text) ||
    /\b(bandit|outlaw|thief|brigand|rogue|ambusher|trapper|bruiser)\b/.test(
      text
    ) ||
    /\b(cow|sheep|rabbit)\b/.test(text)
  );
}

export function boundedHarthmereChaseSpeedForName(
  name: string | undefined,
  requestedSpeed: number
): number {
  if (!Number.isFinite(requestedSpeed) || requestedSpeed <= 0) {
    return 0;
  }
  return isHarthmereSightBoundChaserName(name)
    ? Math.min(
        requestedSpeed * HARTHMERE_NPC_CHASE_SPEED_MULTIPLIER,
        HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND
      )
    : requestedSpeed;
}

export function shouldDropHarthmereChaseTargetForLineOfSight(
  name: string | undefined,
  hasLineOfSight: boolean
): boolean {
  return isHarthmereSightBoundChaserName(name) && !hasLineOfSight;
}

// Only the authored mixed Muck encounters participate in pack retaliation.
// The deny-list keeps player-owned pets, robots, wards, and similarly named
// utility NPCs from becoming hostile because they happened to be nearby.
export function isMixedCreatureGroupRetaliationName(
  name: string | undefined
): boolean {
  const text = String(name ?? "").toLowerCase();
  if (
    /\b(pet|companion|tamed|owned|mount)\b|robot|bot|sentinel|sentential|sentiental|shield|beacon|board|voucher|ration|matter|ward/.test(
      text
    )
  ) {
    return false;
  }
  return (
    isMuckerOrHexerNameForNightAggro(text) ||
    /\b(cow|sheep|rabbit)\b/.test(text)
  );
}

export function isMixedCreatureGroupRetaliationEligible(input: {
  name: string | undefined;
  hasHealth: boolean;
  hasPosition: boolean;
  hasNpcMetadata: boolean;
  isPlayerOwned: boolean;
  isLockedInPlace: boolean;
  isRobot: boolean;
  isQuestGiver: boolean;
}): boolean {
  return (
    input.hasHealth &&
    input.hasPosition &&
    input.hasNpcMetadata &&
    !input.isPlayerOwned &&
    !input.isLockedInPlace &&
    !input.isRobot &&
    !input.isQuestGiver &&
    isMixedCreatureGroupRetaliationName(input.name)
  );
}

function isMuckerOrHexerNpcForNightAggro(npc: SimulatedNpc): boolean {
  const type = npc.type as unknown as {
    name?: string;
    displayName?: string;
  };
  return isMuckerOrHexerNameForNightAggro(
    [npc.label, type.displayName, type.name].filter(Boolean).join(" ")
  );
}

function harthmereNpcCombatName(npc: SimulatedNpc): string {
  const type = npc.type as unknown as {
    name?: string;
    displayName?: string;
  };
  return [npc.label, type.displayName, type.name].filter(Boolean).join(" ");
}

function isHarthmereSightBoundChaserNpc(npc: SimulatedNpc): boolean {
  return isHarthmereSightBoundChaserName(harthmereNpcCombatName(npc));
}

export function boundedHarthmereNpcChaseSpeed(
  npc: SimulatedNpc,
  requestedSpeed: number
): number {
  return boundedHarthmereChaseSpeedForName(
    harthmereNpcCombatName(npc),
    requestedSpeed
  );
}

export function nightMuckerHexUnprovokedAggroParams(
  npc: SimulatedNpc,
  baseParams: BehaviorChaseAttackParams | undefined,
  fallbackParams: BehaviorChaseAttackParams
): BehaviorChaseAttackParams | undefined {
  const type = npc.type as unknown as {
    name?: string;
    displayName?: string;
  };
  return enhancedNightMuckerHexCombatParams(
    [npc.label, type.displayName, type.name].filter(Boolean).join(" "),
    isNightForNpcAggro(secondsSinceEpoch()),
    baseParams,
    fallbackParams
  );
}

export function enhancedNightMuckerHexCombatParams(
  name: string,
  isNight: boolean,
  baseParams: BehaviorChaseAttackParams | undefined,
  fallbackParams: BehaviorChaseAttackParams
): BehaviorChaseAttackParams | undefined {
  if (!isNight || !isMuckerOrHexerNameForNightAggro(name)) {
    return undefined;
  }

  const base = baseParams ?? fallbackParams;
  const authoredAggroDistance =
    base.aggroTrigger.kind === "proximity"
      ? base.aggroTrigger.distance
      : NIGHT_MUCKER_HEX_UNPROVOKED_AGGRO_DISTANCE;
  const aggroDistance = Math.max(
    authoredAggroDistance,
    NIGHT_MUCKER_HEX_UNPROVOKED_AGGRO_DISTANCE
  );
  return {
    ...base,
    aggroTrigger: { kind: "proximity", distance: aggroDistance },
    disengageDistance: Math.max(
      base.disengageDistance,
      NIGHT_MUCKER_HEX_DISENGAGE_DISTANCE
    ),
    attackDistance: base.attackDistance + 0.75,
    attackAnimationMultiplier: base.attackAnimationMultiplier * 1.35,
    attackStrikeMomentSecs: base.attackStrikeMomentSecs * 0.7,
    attackIntervalSecs: Math.max(
      0.55,
      base.attackIntervalSecs * NIGHT_MUCKER_HEX_ATTACK_INTERVAL_MULTIPLIER
    ),
    attackFovDeg: Math.max(base.attackFovDeg, 175),
    attackDamage: Math.max(
      base.attackDamage + 1,
      Math.ceil(base.attackDamage * NIGHT_MUCKER_HEX_DAMAGE_MULTIPLIER)
    ),
  };
}

export function nightMuckerHexMovementMultiplier(
  npc: SimulatedNpc,
  seconds = secondsSinceEpoch()
): number {
  return isMuckerOrHexerNpcForNightAggro(npc) && isNightForNpcAggro(seconds)
    ? NIGHT_MUCKER_HEX_MOVEMENT_MULTIPLIER
    : 1;
}

function eyePosition(
  position: ReadonlyVec3,
  height = DEFAULT_PLAYER_EYE_HEIGHT_METERS
): Vec3 {
  return add(position, [0, Math.max(0.4, height), 0]);
}

export function hasTerrainLineOfSight(
  env: Environment,
  from: ReadonlyVec3,
  to: ReadonlyVec3,
  fromEyeHeight = DEFAULT_PLAYER_EYE_HEIGHT_METERS,
  toEyeHeight = DEFAULT_PLAYER_EYE_HEIGHT_METERS
): boolean {
  const fromEye = eyePosition(from, fromEyeHeight);
  const toEye = eyePosition(to, toEyeHeight);
  const delta = sub(toEye, fromEye);
  const distance = length(delta);
  if (distance <= LINE_OF_SIGHT_SAMPLE_STEP_METERS * 2) {
    return true;
  }

  const direction = scale(1 / distance, delta);
  for (
    let d = LINE_OF_SIGHT_SAMPLE_STEP_METERS;
    d < distance - LINE_OF_SIGHT_SAMPLE_STEP_METERS;
    d += LINE_OF_SIGHT_SAMPLE_STEP_METERS
  ) {
    const sample = add(fromEye, scale(d, direction));
    if (
      CollisionHelper.intersectAnyAABB(
        (id) => env.resources.get("/physics/boxes", id),
        centerAndSideLengthToAABB(sample, LINE_OF_SIGHT_SAMPLE_BOX_METERS)
      )
    ) {
      return false;
    }
  }
  return true;
}

function hasLineOfSightToPlayer(
  env: Environment,
  npc: SimulatedNpc,
  player: ReadonlyEntity
): boolean {
  if (!player.position) {
    return false;
  }
  const npcEyeHeight =
    Array.isArray(npc.size) && Number.isFinite(npc.size[1])
      ? Math.max(0.5, npc.size[1] * 0.72)
      : DEFAULT_PLAYER_EYE_HEIGHT_METERS;
  const playerSize = player.size?.v;
  const playerEyeHeight =
    playerSize && Number.isFinite(playerSize[1])
      ? Math.max(0.5, playerSize[1] * 0.72)
      : DEFAULT_PLAYER_EYE_HEIGHT_METERS;
  return hasTerrainLineOfSight(
    env,
    npc.position,
    player.position.v,
    npcEyeHeight,
    playerEyeHeight
  );
}

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
  const chaseTarget =
    nextChasePathTarget(env, npc, target.position.v) ?? target.position.v;
  const vecToChaseTarget = sub(chaseTarget, npc.position);
  const angleToPlayer = yaw(vecToChaseTarget);

  if (angleToPlayer !== npc.state.rotateTarget) {
    npc.mutableState().rotateTarget = angleToPlayer;
  }

  if (distToPlayer >= params.attackDistance) {
    const diffAngleToPlayer = Math.abs(
      diffAngle(angleToPlayer, npc.orientation[1])
    );
    // Keep chasing even while turning. The old cosine multiplier hit zero
    // whenever the target was behind the NPC, which made combatants pivot in
    // place and feel broken. Use a floor so they keep closing distance while
    // rotateTargetTick catches up.
    const turnSlowdown = Math.max(
      0.35,
      Math.cos(Math.min(diffAngleToPlayer, Math.PI / 2))
    );
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
  const strikeDelaySecs = effectiveAttackStrikeDelaySecs(params);
  const timeSinceLastAttack = maybeDiff(now, npc.state.chaseAttack.attackTime);
  if (
    timeSinceLastAttack === undefined ||
    timeSinceLastAttack > params.attackIntervalSecs
  ) {
    // We haven't started an attack, but we can attack, so attack.
    const attackTime = now;
    npc.mutableState().chaseAttack!.attackTime = attackTime;
    // HARTHMERE_NPC_ATTACK_ANIM_PULSE_INSTALL_MARKER
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
        emote_expiry_time: attackTime + strikeDelaySecs,
      })
    );
  } else if (timeSinceLastAttack > strikeDelaySecs) {
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
    if (
      stuckWhilePathfinding(state.pathfinding) ||
      chasePathTargetIsStale(
        state.pathfinding.path,
        targetPosition,
        CHASE_PATH_TARGET_DRIFT_SQ
      )
    ) {
      // Either we've made no progress for a while, or the target has moved far
      // enough that the cached route no longer leads to it. Drop the path so a
      // fresh one is computed toward the target's current position below.
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

// HARTHMERE_NPC_RETALIATION_MEMORY:
// How long an NPC remembers it was attacked and is willing to retaliate. Once
// they actually enter a chase attack they will continue it until they lose
// their target by distance/death/peace.
export const ATTACK_MEMORY_SECONDS = 30;

// Group alerts are intentionally local. The guarded herds fit inside this
// radius, while separate spawns in the same broad Muck region do not form one
// map-wide aggro chain. The vertical limit and terrain visibility check prevent
// alerts through stacked caves, giant cliffs, and sealed structures.
export const MIXED_CREATURE_GROUP_ALERT_RADIUS = 18;
export const MIXED_CREATURE_GROUP_ALERT_MAX_VERTICAL_DISTANCE = 10;

export interface MixedCreatureGroupAlertCandidate {
  id: BiomesId;
  position: ReadonlyVec3;
  eligible: boolean;
  hasLineOfSight: boolean;
  lastDamageSource?: { kind: string; attacker: BiomesId };
  lastDamageTime?: number;
  lastDamageAmount?: number;
}

export interface MixedCreatureGroupAlertAttacker {
  position: ReadonlyVec3;
  hp: number;
  isPlayer: boolean;
  canBeTargeted: boolean;
}

export interface MixedCreatureGroupAlertInputs {
  recipientId: BiomesId;
  recipientEligible: boolean;
  recipientPosition: ReadonlyVec3;
  candidates: ReadonlyArray<MixedCreatureGroupAlertCandidate>;
  lookupAttacker: (id: BiomesId) => MixedCreatureGroupAlertAttacker | undefined;
  now: number;
  memorySeconds: number;
  deAggroDistanceSq: number;
  alertRadius?: number;
  maxVerticalDistance?: number;
}

export function shouldDropNpcTargetAtSafeZoneBoundary(input: {
  targetId: BiomesId;
  recentDirectAttackerId: BiomesId | undefined;
  targetInSafeZone: boolean;
}): boolean {
  return (
    input.targetInSafeZone && input.targetId !== input.recentDirectAttackerId
  );
}

// Selects the player responsible for the newest valid nearby hit. This reads
// only actual Health damage metadata, so an alerted NPC cannot recursively
// alert a second ring of NPCs. A dead source remains valid long enough for a
// one-shot kill to alert its surviving group members.
export function evaluateMixedCreatureGroupRetaliationTarget(
  inputs: MixedCreatureGroupAlertInputs
): BiomesId | undefined {
  if (!inputs.recipientEligible) {
    return undefined;
  }
  const alertRadius = inputs.alertRadius ?? MIXED_CREATURE_GROUP_ALERT_RADIUS;
  const maxVerticalDistance =
    inputs.maxVerticalDistance ??
    MIXED_CREATURE_GROUP_ALERT_MAX_VERTICAL_DISTANCE;
  const alertRadiusSq = alertRadius * alertRadius;
  let best:
    | {
        attackerId: BiomesId;
        damageTime: number;
        sourceDistanceSq: number;
        sourceId: BiomesId;
      }
    | undefined;

  for (const candidate of inputs.candidates) {
    if (
      candidate.id === inputs.recipientId ||
      !candidate.eligible ||
      !candidate.hasLineOfSight ||
      candidate.lastDamageSource?.kind !== "attack" ||
      candidate.lastDamageTime === undefined ||
      // Health.lastDamageAmount is negative for real damage. Ignore healing,
      // zero-damage contacts, and malformed events that merely claim a hit.
      !(
        candidate.lastDamageAmount !== undefined &&
        candidate.lastDamageAmount < 0
      )
    ) {
      continue;
    }

    const damageAge = inputs.now - candidate.lastDamageTime;
    if (damageAge < 0 || damageAge >= inputs.memorySeconds) {
      continue;
    }

    const dx = candidate.position[0] - inputs.recipientPosition[0];
    const dy = Math.abs(candidate.position[1] - inputs.recipientPosition[1]);
    const dz = candidate.position[2] - inputs.recipientPosition[2];
    const sourceDistanceSq = dx * dx + dz * dz;
    if (sourceDistanceSq > alertRadiusSq || dy > maxVerticalDistance) {
      continue;
    }

    const attackerId = candidate.lastDamageSource.attacker;
    const attacker = inputs.lookupAttacker(attackerId);
    if (
      !attacker?.isPlayer ||
      !attacker.canBeTargeted ||
      attacker.hp <= 0 ||
      distSq(attacker.position, inputs.recipientPosition) >=
        inputs.deAggroDistanceSq
    ) {
      continue;
    }

    if (
      !best ||
      candidate.lastDamageTime > best.damageTime ||
      (candidate.lastDamageTime === best.damageTime &&
        (sourceDistanceSq < best.sourceDistanceSq ||
          (sourceDistanceSq === best.sourceDistanceSq &&
            candidate.id < best.sourceId)))
    ) {
      best = {
        attackerId,
        damageTime: candidate.lastDamageTime,
        sourceDistanceSq,
        sourceId: candidate.id,
      };
    }
  }

  return best?.attackerId;
}

// HARTHMERE_NPC_RETALIATION_SAFE_ZONE:
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
  ) => { position?: { v: ReadonlyVec3 }; health?: { hp: number } } | undefined;
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
  if (lastDamageSource?.kind !== "attack" || lastDamageTime === undefined) {
    return undefined;
  }
  const damageAge = now - lastDamageTime;
  if (damageAge < 0 || damageAge >= memorySeconds) {
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
  deAggroDistanceSq: number,
  now: number
): BiomesId | undefined {
  return evaluateRetaliationTarget({
    lastDamageSource: npc.health.lastDamageSource as any,
    lastDamageTime: npc.health.lastDamageTime,
    npcPosition: npc.position,
    deAggroDistanceSq,
    lookupEntity: (id) => env.resources.get("/ecs/entity", id) as any,
    now,
    memorySeconds: ATTACK_MEMORY_SECONDS,
  });
}

function mixedCreatureEntityIsEligible(entity: ReadonlyEntity | undefined) {
  return isMixedCreatureGroupRetaliationEligible({
    name: entity?.label?.text,
    hasHealth: Boolean(entity?.health),
    hasPosition: Boolean(entity?.position),
    hasNpcMetadata: Boolean(entity?.npc_metadata),
    isPlayerOwned: Boolean(entity?.created_by),
    isLockedInPlace: Boolean(entity?.locked_in_place),
    isRobot: Boolean(entity?.robot_component),
    isQuestGiver: Boolean(entity?.quest_giver),
  });
}

function nearbyMixedCreatureGroupAttackerId(
  env: Environment,
  npc: SimulatedNpc,
  deAggroDistanceSq: number,
  now: number
): BiomesId | undefined {
  const recipient = env.resources.get("/ecs/entity", npc.id);
  if (!mixedCreatureEntityIsEligible(recipient)) {
    return undefined;
  }
  if (isSafeZone(env.voxeloo, npc.position, env.ecsMetaIndex, env.resources)) {
    // Direct retaliation remains allowed in a safe zone, but bystanders never
    // join it. This prevents one accidental tutorial/town hit from turning the
    // whole protected area hostile.
    return undefined;
  }

  const candidates: MixedCreatureGroupAlertCandidate[] = [];
  for (const candidateId of env.ecsMetaIndex.npc_selector.scanSphere({
    center: npc.position,
    // The spatial index uses a 3D sphere. Scan the diagonal of the horizontal
    // and vertical limits, then let the pure evaluator enforce each axis.
    radius: Math.hypot(
      MIXED_CREATURE_GROUP_ALERT_RADIUS,
      MIXED_CREATURE_GROUP_ALERT_MAX_VERTICAL_DISTANCE
    ),
  })) {
    if (candidateId === npc.id) {
      continue;
    }
    const candidate = env.resources.get("/ecs/entity", candidateId);
    if (!Entity.has(candidate, "health", "position", "npc_metadata")) {
      continue;
    }
    const eligible = mixedCreatureEntityIsEligible(candidate);
    if (
      !eligible ||
      candidate.health.lastDamageSource?.kind !== "attack" ||
      candidate.health.lastDamageTime === undefined ||
      !(
        candidate.health.lastDamageAmount !== undefined &&
        candidate.health.lastDamageAmount < 0
      )
    ) {
      // Most nearby NPCs have not been hit. Skip the terrain raycast unless
      // this entity could actually raise a valid group alert.
      continue;
    }
    const npcEyeHeight = Math.max(0.5, npc.size[1] * 0.72);
    const candidateEyeHeight = Math.max(
      0.5,
      (candidate.size?.v[1] ?? DEFAULT_PLAYER_EYE_HEIGHT_METERS) * 0.72
    );
    candidates.push({
      id: candidate.id,
      position: candidate.position.v,
      eligible,
      hasLineOfSight: hasTerrainLineOfSight(
        env,
        npc.position,
        candidate.position.v,
        npcEyeHeight,
        candidateEyeHeight
      ),
      lastDamageSource: candidate.health.lastDamageSource as
        | { kind: string; attacker: BiomesId }
        | undefined,
      lastDamageTime: candidate.health.lastDamageTime,
      lastDamageAmount: candidate.health.lastDamageAmount,
    });
  }

  return evaluateMixedCreatureGroupRetaliationTarget({
    recipientId: npc.id,
    recipientEligible: true,
    recipientPosition: npc.position,
    candidates,
    lookupAttacker: (attackerId) => {
      const attacker = env.resources.get("/ecs/entity", attackerId);
      if (!Entity.has(attacker, "health", "position", "player_status")) {
        return undefined;
      }
      const buffs = getPlayerBuffs(env.voxeloo, env.resources, attacker.id);
      const atPeace = Boolean(
        getPlayerModifiersFromBuffs(buffs)?.peace.enabled
      );
      const inSafeZone = isSafeZone(
        env.voxeloo,
        attacker.position.v,
        env.ecsMetaIndex,
        env.resources
      );
      return {
        position: attacker.position.v,
        hp: attacker.health.hp,
        isPlayer: true,
        canBeTargeted: !atPeace && !inSafeZone,
      };
    },
    now,
    memorySeconds: ATTACK_MEMORY_SECONDS,
    deAggroDistanceSq,
  });
}

function decayNpcThreat(npc: SimulatedNpc) {
  const table = npc.state.threat?.table;
  if (!table || Object.keys(table).length === 0) {
    return;
  }
  const mutableThreat = npc.mutableState().threat!;
  mutableThreat.lastDecayAt = decayThreat(
    mutableThreat.table,
    secondsSinceEpoch(),
    mutableThreat.lastDecayAt
  );
}

// Scans valid players in aggro range (alive, not at peace, not in a safe zone)
// and picks the highest-threat one, falling back to the nearest. Shares the same
// per-player filters as `getNearestPlayer` so threat-aware acquisition can never
// target a player that proximity acquisition would have rejected.
function chooseProximityTarget(
  env: Environment,
  npc: SimulatedNpc,
  aggroDistance: number,
  threatTable: ThreatTable | undefined,
  options: {
    requireLineOfSight?: boolean;
    allowNearestFallback?: boolean;
  } = {}
): BiomesId | undefined {
  const candidates: ThreatTargetCandidate[] = [];
  for (const playerId of env.ecsMetaIndex.player_selector.scanSphere({
    center: npc.position,
    radius: aggroDistance,
  })) {
    const player = env.resources.get("/ecs/entity", playerId);
    if (!Entity.has(player, "health", "position")) {
      continue;
    }
    if (player.health.hp <= 0) {
      continue;
    }
    const buffs = getPlayerBuffs(env.voxeloo, env.resources, player.id);
    if (getPlayerModifiersFromBuffs(buffs)?.peace.enabled) {
      continue;
    }
    if (
      isSafeZone(
        env.voxeloo,
        player.position.v,
        env.ecsMetaIndex,
        env.resources
      )
    ) {
      continue;
    }
    if (
      options.requireLineOfSight &&
      !hasLineOfSightToPlayer(env, npc, player)
    ) {
      continue;
    }
    candidates.push({
      id: player.id,
      distanceSq: distSq(player.position.v, npc.position),
      threat: threatTable?.[String(player.id)] ?? 0,
    });
  }
  const eligibleCandidates =
    options.allowNearestFallback === false
      ? candidates.filter((candidate) => candidate.threat > 0)
      : candidates;
  return pickThreatPreferredTarget(eligibleCandidates);
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

  // Decay accumulated threat so aggro fades over time and the table stays
  // bounded instead of growing with every distinct attacker forever.
  decayNpcThreat(npc);

  const deAggroDistanceSq = params.disengageDistance ** 2;
  const now = secondsSinceEpoch();
  const usesNightMuckerHexAggro = isMuckerOrHexerNpcForNightAggro(npc);
  const usesSightBoundHarthmereChase = isHarthmereSightBoundChaserNpc(npc);
  const isNight = isNightForNpcAggro(now);

  // HARTHMERE_NPC_RETALIATION_SAFE_ZONE:
  // Independent of the aggro trigger kind, if the NPC was just attacked by a
  // player it must be allowed to retaliate. Previously, hostile NPCs that used
  // proximity-based aggro became completely non-responsive when they happened
  // to be inside a safe zone (within wardRange of a quest giver or a ward),
  // because the safe-zone gate cleared their target before the retaliation
  // memory check ever ran. That made the "hit a Muckling but it won't hit back"
  // bug reported from the Grove combat primer where every hostile sits next to
  // Jackie/Thom/etc. and is therefore inside ward range.
  const recentAttackerId = lastValidAttackerId(
    env,
    npc,
    deAggroDistanceSq,
    now
  );
  // A direct hit on this NPC always wins. Otherwise, a nearby cow, sheep,
  // rabbit, Mucker, or Hex can share its real recent player attacker with this
  // NPC. Alert state is not itself shared, so propagation cannot fan out.
  const groupAttackerId = recentAttackerId
    ? undefined
    : nearbyMixedCreatureGroupAttackerId(env, npc, deAggroDistanceSq, now);
  const provokedAttackerId = recentAttackerId ?? groupAttackerId;

  if (
    !provokedAttackerId &&
    isSafeZone(env.voxeloo, npc.position, env.ecsMetaIndex, env.resources)
  ) {
    // No active attacker and we're inside a safe zone — never hold a proactive
    // target. Retaliation is the deliberate exception, handled above.
    if (npc.state.chaseAttack.attackTarget) {
      npc.mutableState().chaseAttack!.attackTarget = undefined;
    }
    npc.setPublicCombatTarget(undefined);
    return;
  }

  // By default, continue to attack our current target, if we have one.
  let targetId = npc.state.chaseAttack.attackTarget;

  // Check to see if we can acquire a new target.
  if (params.aggroTrigger.kind === "onlyIfAttacked") {
    targetId = provokedAttackerId ?? targetId;
  } else {
    if (provokedAttackerId) {
      // HARTHMERE_NPC_RETALIATION_PROXIMITY_PRIORITY:
      // A specific attacker outranks a generic proximity scan — players who
      // commit to a fight should not get ignored in favor of a stranger
      // wandering into aggro range.
      targetId = provokedAttackerId;
    } else if (usesNightMuckerHexAggro && !isNight) {
      // Hexes/muckers are only proactively hostile at night. During the day
      // they can still fight back through recent-attacker/threat paths, but a
      // harmless player walking by is not a valid target.
      targetId = chooseProximityTarget(
        env,
        npc,
        params.disengageDistance,
        npc.state.threat?.table,
        { allowNearestFallback: false }
      );
    } else {
      // Acquire the highest-threat valid player in aggro range (whoever has
      // dealt the most damage / taunted), falling back to the nearest one.
      targetId = chooseProximityTarget(
        env,
        npc,
        usesNightMuckerHexAggro
          ? Math.max(
              params.aggroTrigger.distance,
              NIGHT_MUCKER_HEX_UNPROVOKED_AGGRO_DISTANCE
            )
          : params.aggroTrigger.distance,
        npc.state.threat?.table,
        {
          allowNearestFallback: true,
          requireLineOfSight: usesNightMuckerHexAggro,
        }
      );
    }
  }

  // If we have a target, check if we should disengage.
  if (targetId) {
    const attackTarget = env.resources.get("/ecs/entity", targetId);
    const buffs = getPlayerBuffs(env.voxeloo, env.resources, targetId);
    const targetIsProvoked =
      targetId === provokedAttackerId ||
      (npc.state.threat?.table?.[String(targetId)] ?? 0) > 0;

    if (!attackTarget?.position || (attackTarget.health?.hp ?? 0) <= 0) {
      targetId = undefined;
    } else if (
      distSq(attackTarget.position.v, npc.position) > deAggroDistanceSq
    ) {
      targetId = undefined;
    } else if (getPlayerModifiersFromBuffs(buffs)?.peace.enabled) {
      targetId = undefined;
    } else if (
      shouldDropNpcTargetAtSafeZoneBoundary({
        targetId,
        recentDirectAttackerId: recentAttackerId,
        targetInSafeZone: isSafeZone(
          env.voxeloo,
          attackTarget.position.v,
          env.ecsMetaIndex,
          env.resources
        ),
      })
    ) {
      // Direct retaliation is the deliberate safe-zone exception. A shared
      // group alert, proactive aggro, or stale remembered target must stop at
      // the boundary instead of dragging an entire herd into a protected area.
      targetId = undefined;
    } else if (usesNightMuckerHexAggro && !targetIsProvoked && !isNight) {
      targetId = undefined;
    } else if (
      usesSightBoundHarthmereChase &&
      shouldDropHarthmereChaseTargetForLineOfSight(
        harthmereNpcCombatName(npc),
        hasLineOfSightToPlayer(env, npc, attackTarget)
      )
    ) {
      // Harthmere fights remain visual and fair: Muckers, Hexes, bandits, and
      // retaliating herd animals pursue while they can see the player, then
      // immediately release the target once terrain breaks line of sight.
      targetId = undefined;
    }
  }

  if (targetId !== npc.state.chaseAttack.attackTarget) {
    npc.mutableState().chaseAttack!.attackTarget = targetId;
  }
  npc.setPublicCombatTarget(targetId);
}
