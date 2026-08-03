import { secondsSinceEpoch } from "@/shared/ecs/config";
import type { ReadonlyWorldMetadata } from "@/shared/ecs/gen/components";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import { CollisionHelper } from "@/shared/game/collision";
import {
  createMovementActionState,
  lateralEvadeDirection,
  movementActionIsActive,
  movementActionIsOnCooldown,
  npcEvadeProfileForDescriptor,
} from "@/shared/game/movement_actions";
import { ch1DetachedWorldBoundsAt } from "@/shared/harthmere/ch1_elsewhen_region";
import {
  harthmereNativeNpcCombatProfileForEntity,
  harthmereNativeNpcCombatProfileForTypeId,
} from "@/shared/harthmere/harthmere_native_combat_catalog";
import { harthmereNativeNpcChaseAttackParams } from "@/shared/harthmere/harthmere_native_combat";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import {
  add,
  anchorAndSizeToAABB,
  containsAABB,
  normalizev,
  pitchAndYaw,
  scale,
  sub,
} from "@/shared/math/linear";
import type { AABB, ReadonlyVec3 } from "@/shared/math/types";
import {
  applyCreatureLevelToChaseAttackParams,
  boundedHarthmereNpcChaseSpeed,
  cancelPendingMeleeAttack,
  chapter1EncounterChaseAttackParams,
  chaseAttackTargetTick,
  isHarthmereFightSpeedBoostNpc,
  nightMuckerHexMovementMultiplier,
  nightMuckerHexUnprovokedAggroParams,
  updateAttackTarget,
} from "@/shared/npc/behavior/chase_attack";
import {
  escortTick,
  npcHasEscortAssignment,
  updateEscortCombatTarget,
} from "@/shared/npc/behavior/escort_tick";
import {
  businessCustomerTick,
  npcHasBusinessCustomerAssignment,
} from "@/shared/npc/behavior/business_customer_tick";
import { scheduleFollowTick } from "@/shared/npc/behavior/schedule_follow";
import { drownTick } from "@/shared/npc/behavior/drown";
import { farFromHomeTick } from "@/shared/npc/behavior/far_from_home";
import { flyTick } from "@/shared/npc/behavior/fly";
import { fleeFromThreatTick } from "@/shared/npc/behavior/flee";
import { meanderTick } from "@/shared/npc/behavior/meander";
import { returnHomeTick } from "@/shared/npc/behavior/return_home";
import { rotateTargetTick } from "@/shared/npc/behavior/rotate_target";
import { socializeTick } from "@/shared/npc/behavior/socialize";
import { swimTick } from "@/shared/npc/behavior/swim";
import {
  getMovementTypeByNpcType,
  getNpcBehavior,
  getNpcRotateSpeed,
  npcGlobals,
} from "@/shared/npc/bikkie";
import type { Environment } from "@/shared/npc/environment";
import {
  npcGroundLocomotionAabb,
  npcGroundTraversalProfile,
} from "@/shared/npc/ground_locomotion";
import {
  finiteNpcOrientation,
  hasFiniteNpcMotionDirection,
  isFiniteNpcOrientation,
} from "@/shared/npc/motion_safety";
import type { MovementType } from "@/shared/npc/npc_types";
import type { BehaviorChaseAttackParams } from "@/shared/npc/npc_types";
import type { SimulatedNpc } from "@/shared/npc/simulated";
import {
  DEFAULT_ENVIRONMENT_PARAMS,
  NPC_FLYING_ENVIRONMENT_PARAMS,
  NPC_SWIMMING_ENVIRONMENT_PARAMS,
} from "@/shared/physics/environments";
import {
  addForce,
  forwardWalkingForce,
  horizontalForceForTargetSpeed,
  nullForce,
} from "@/shared/physics/forces";
import { moveBodyFluid, moveBodyWithClimbing } from "@/shared/physics/movement";
import type { Force, HitFn } from "@/shared/physics/types";
import { toClimbableIndex, yawVector } from "@/shared/physics/utils";
import _ from "lodash";

export const ATTACKED_NPC_RETALIATION_FALLBACK =
  "ATTACKED_NPC_RETALIATION_FALLBACK";

const focusedBusinessCustomerMovementProbes = new Set<BiomesId>();

/**
 * Anima owns the timing of persistent NPC status effects. Damage remains a
 * Native ECS transaction: the NPC handler validates this stored burn record,
 * advances it, applies creature resistance, and credits the original player.
 */
export function tickHarthmereEnergyWeaponStatuses(
  npc: SimulatedNpc,
  nowMs = Date.now()
) {
  const burn = npc.state.energyWeapon?.burn;
  if (
    npc.hp <= 0 ||
    !burn ||
    burn.ticksRemaining <= 0 ||
    nowMs < burn.nextTickAtMs
  ) {
    return false;
  }
  npc.damage(burn.tickDamage, {
    kind: "attack",
    attacker: burn.source,
    dir: undefined,
  });
  return true;
}

const ATTACKED_NPC_RETALIATION_CHASE_ATTACK_PARAMS: BehaviorChaseAttackParams =
  {
    aggroTrigger: { kind: "onlyIfAttacked" },
    disengageDistance: 24,
    attackDistance: 2.2,
    attackAnimationMultiplier: 1,
    attackStrikeMomentSecs: 0.5,
    attackIntervalSecs: 2,
    attackFovDeg: 120,
    attackDamage: 10,
  };

function effectiveChaseAttackParams(
  npc: SimulatedNpc,
  behavior: ReturnType<typeof getNpcBehavior>
): BehaviorChaseAttackParams | undefined {
  const base = baseChaseAttackParams(npc, behavior);
  // HARTHMERE_CREATURE_LEVELING: the shared NPC type supplies the level 1
  // baseline; the entity's own level scales it. Applied last so every authored
  // Chapter 1 / night-aggro override is itself levelled rather than bypassed.
  return base ? applyCreatureLevelToChaseAttackParams(npc, base) : undefined;
}

/**
 * Native Harthmere combat profiles are authoritative over a stale Bikkie
 * behavior. The July road-pack tray still had the legacy human fallback
 * (`attackable: false`, no `chaseAttack`), which left Anima managing and ticking
 * the creatures without ever giving them a combat policy.
 */
export function configuredChaseAttackParamsForNpcType(
  typeId: BiomesId,
  behavior: Pick<ReturnType<typeof getNpcBehavior>, "chaseAttack">
): BehaviorChaseAttackParams | undefined {
  const nativeProfile = harthmereNativeNpcCombatProfileForTypeId(typeId);
  if (nativeProfile) {
    return harthmereNativeNpcChaseAttackParams(nativeProfile);
  }
  return behavior.chaseAttack;
}

function baseChaseAttackParams(
  npc: SimulatedNpc,
  behavior: ReturnType<typeof getNpcBehavior>
): BehaviorChaseAttackParams | undefined {
  const concreteProfile = harthmereNativeNpcCombatProfileForEntity({
    entityId: npc.id,
    typeId: npc.metadata.type_id,
    displayName: [npc.label, npc.type.displayName, npc.type.name]
      .filter(Boolean)
      .join(" "),
    maxHp: npc.health.maxHp,
  });
  const configuredChaseAttack = concreteProfile
    ? harthmereNativeNpcChaseAttackParams(concreteProfile)
    : configuredChaseAttackParamsForNpcType(npc.metadata.type_id, behavior);
  const chapter1Params = chapter1EncounterChaseAttackParams(
    npc,
    configuredChaseAttack,
    ATTACKED_NPC_RETALIATION_CHASE_ATTACK_PARAMS
  );
  if (chapter1Params) return chapter1Params;
  const nightAggroChaseAttack = nightMuckerHexUnprovokedAggroParams(
    npc,
    configuredChaseAttack,
    ATTACKED_NPC_RETALIATION_CHASE_ATTACK_PARAMS
  );
  if (nightAggroChaseAttack) {
    return nightAggroChaseAttack;
  }

  if (configuredChaseAttack) {
    return configuredChaseAttack;
  }

  // ATTACKED_NPC_RETALIATION_FALLBACK:
  // Preserve authored proactive aggression for beasts/civilians that already
  // have chaseAttack. For older snapshot/imported NPC types that are attackable
  // but forgot that behavior, still let them fight back after a real player hit.
  //
  // ATTACKED_NPC_RETALIATION_FALLBACK — condition fix:
  // The original check was `behavior.damageable?.attackable !== true`, which
  // treated `undefined` (i.e. not explicitly set) as non-attackable. This
  // blocked retaliation for all snapshot NPCs (Mucklings, Hexes, animals)
  // whose biscuit data goes through snapshotLegacyNpcType: that path
  // shallow-merges the human-NPC fallback which has attackable: false, so any
  // NPC whose biscuit doesn't explicitly set attackable inherits false.
  //
  // New rule:
  //   - No damageable component at all → NPC has no health, cannot retaliate.
  //   - damageable.attackable === false → explicitly marked un-attackable.
  //   - damageable.attackable === true OR undefined → allowed; the schema
  //     default is true, so absence means the author did not opt out.
  if (
    !behavior.damageable ||
    behavior.damageable.attackable === false ||
    npc.health.lastDamageSource?.kind !== "attack" ||
    npc.health.lastDamageTime === undefined
  ) {
    return undefined;
  }

  return ATTACKED_NPC_RETALIATION_CHASE_ATTACK_PARAMS;
}

// The single locomotion behavior an NPC runs this tick. Exactly one is chosen
// per tick by strict priority; see `selectNpcLocomotion`.
export type NpcLocomotionChoice =
  | "evade"
  | "swim"
  | "fly"
  | "flee"
  | "returnHome"
  | "chaseAttack"
  | "businessCustomer"
  | "escort"
  | "schedule"
  | "meander"
  | "socialize"
  | "hostileIdleWander"
  | "idle";

export interface NpcLocomotionInputs {
  hasActiveEvade?: boolean;
  swim: boolean;
  fly: boolean;
  hasFleeOutput: boolean;
  isQuestGiver: boolean;
  hasActiveSchedule: boolean;
  hasChaseAttack: boolean;
  hasAttackTarget: boolean;
  /** Session-only customer route intent outranks ordinary civilian behavior. */
  hasBusinessCustomerAssignment?: boolean;
  /** HARTHMERE_ESCORT: this NPC has a live `npc_state.escort` assignment. */
  hasEscortAssignment?: boolean;
  canMeander: boolean;
  canSocialize: boolean;
}

// Pure behavior-priority selector. Extracted from `npcTickLogic` so the
// ordering is unit-testable in isolation — in particular that an authored
// schedule outranks the quest-giver "stay home" fallback (HARTHMERE town NPCs)
// while live combat still outranks the schedule.
export function selectNpcLocomotion(
  inputs: NpcLocomotionInputs
): NpcLocomotionChoice {
  if (inputs.hasActiveEvade) {
    return "evade";
  }
  if (inputs.swim) {
    return "swim";
  }
  if (inputs.fly) {
    return "fly";
  }
  if (inputs.hasFleeOutput) {
    return "flee";
  }
  // HARTHMERE_ESCORT: an escort assignment outranks the quest-giver "stay home"
  // fallback and any authored schedule, because an escorted companion that walks
  // back to its spawn is the whole failure the escort system exists to prevent.
  // Live combat still outranks the escort itself, so a combat-capable escort
  // interrupts following, fights, and then resumes formation.
  //
  // Moving the combat branch above `returnHome` also fixes a smaller pre-existing
  // problem: a quest giver with no schedule used to walk home while being hit,
  // because the stay-home branch short-circuited before combat was considered.
  if (inputs.hasChaseAttack && inputs.hasAttackTarget) {
    return "chaseAttack";
  }
  if (inputs.hasBusinessCustomerAssignment) {
    return "businessCustomer";
  }
  if (inputs.hasEscortAssignment) {
    return "escort";
  }
  if (inputs.isQuestGiver && !inputs.hasActiveSchedule) {
    return "returnHome";
  }
  if (inputs.hasActiveSchedule) {
    return "schedule";
  }
  if (inputs.canMeander) {
    return "meander";
  }
  if (inputs.canSocialize) {
    return "socialize";
  }
  if (inputs.hasChaseAttack) {
    return "hostileIdleWander";
  }
  return "idle";
}

export function npcShouldStartCombatEvade({
  nowSeconds,
  targetEmoteType,
  targetEmoteStartTime,
  lastDamageTime,
}: {
  nowSeconds: number;
  targetEmoteType?: string;
  targetEmoteStartTime?: number;
  lastDamageTime?: number;
}) {
  const attackAge =
    nowSeconds - (targetEmoteStartTime ?? Number.NEGATIVE_INFINITY);
  const targetIsAttacking =
    (targetEmoteType === "attack1" || targetEmoteType === "attack2") &&
    attackAge >= 0 &&
    attackAge <= 0.65;
  const damageAge = nowSeconds - (lastDamageTime ?? Number.NEGATIVE_INFINITY);
  const wasJustHit = damageAge >= 0 && damageAge <= 0.2;
  return targetIsAttacking || wasJustHit;
}

function maybeStartNpcCombatEvade(
  env: Environment,
  npc: SimulatedNpc,
  nowSeconds: number
) {
  const targetId = npc.state.chaseAttack?.attackTarget;
  const target = targetId
    ? env.resources.get("/ecs/entity", targetId)
    : undefined;
  if (!target?.position || (target.health?.hp ?? 0) <= 0) {
    return;
  }
  if (
    !npcShouldStartCombatEvade({
      nowSeconds,
      targetEmoteType: target.emote?.emote_type,
      targetEmoteStartTime: target.emote?.emote_start_time,
      lastDamageTime: npc.health.lastDamageTime,
    })
  ) {
    return;
  }

  const previous = npc.movementState;
  if (
    movementActionIsActive(previous, nowSeconds) ||
    movementActionIsOnCooldown(previous, nowSeconds)
  ) {
    return;
  }

  const movementType = getMovementTypeByNpcType(npc.type);
  // Authored type identity decides the evade profile because that profile sets
  // invulnerability duration. `npc.label` is presentation and is passed last so
  // it only applies to actors with no usable type descriptor.
  const profile = npcEvadeProfileForDescriptor(
    npc.type.name,
    npc.type.displayName,
    movementType,
    npc.label
  );
  const away = normalizev(sub(npc.position, target.position.v));
  const direction =
    profile.directionMode === "away"
      ? away
      : lateralEvadeDirection({
          awayFromAttacker: away,
          seed: Number(npc.id) + Math.floor(nowSeconds),
        });
  npc.setMovementState(
    createMovementActionState({
      previous,
      action: "evade",
      direction,
      nonce: nowSeconds + (Number(npc.id) % 997) / 997,
      nowSeconds,
      durationSeconds: profile.durationSeconds,
      invulnerabilitySeconds: profile.invulnerabilitySeconds,
      cooldownSeconds: profile.cooldownSeconds,
    })
  );
  if (npc.state.chaseAttack) {
    cancelPendingMeleeAttack(npc.mutableState().chaseAttack!, nowSeconds);
  }
}

export function npcGroundWalkingForceCoefficient(input: {
  locomotion: NpcLocomotionChoice;
  fightSpeedBoostEligible: boolean;
  forwardSpeed: number;
}): number {
  // Business customer routes author their pace in metres per second, just like
  // chase and escort behavior. `forwardWalkingForce` consumes acceleration,
  // however, and a raw 2-4 value is completely cancelled by the ordinary
  // ground friction at Anima's fixed tick rate. Convert this route explicitly
  // so customers actually move while leaving every historical locomotion path
  // unchanged.
  if (input.locomotion === "businessCustomer") {
    return horizontalForceForTargetSpeed(
      input.forwardSpeed,
      DEFAULT_ENVIRONMENT_PARAMS
    );
  }
  if (input.locomotion !== "chaseAttack" || !input.fightSpeedBoostEligible) {
    return input.forwardSpeed;
  }
  return horizontalForceForTargetSpeed(
    input.forwardSpeed,
    DEFAULT_ENVIRONMENT_PARAMS
  );
}

export function npcForwardSpeedForLocomotion(input: {
  locomotion: NpcLocomotionChoice;
  forwardSpeed: number;
  nightMovementMultiplier: number;
  boundChaseSpeed: (requestedSpeed: number) => number;
}): number {
  if (input.locomotion !== "chaseAttack") {
    return input.forwardSpeed;
  }
  return input.boundChaseSpeed(
    input.forwardSpeed * input.nightMovementMultiplier
  );
}

export function npcCinematicPauseActive(
  state: { cinematicPauseUntil?: number },
  nowSeconds: number
): boolean {
  const pauseUntil = state.cinematicPauseUntil;
  return (
    typeof pauseUntil === "number" &&
    Number.isFinite(pauseUntil) &&
    nowSeconds < pauseUntil
  );
}

export function npcIsInsideWorldBounds(
  worldMetadata: ReadonlyWorldMetadata,
  position: ReadonlyVec3
) {
  const detachedBounds = ch1DetachedWorldBoundsAt(position);
  return containsAABB(
    detachedBounds
      ? [detachedBounds.v0, detachedBounds.v1]
      : [worldMetadata.aabb.v0, worldMetadata.aabb.v1],
    position
  );
}

// The tick context that drives most of the NPCs based on their data-driven
// behavioral definitions.
export function npcTickLogic(
  env: Environment,
  npc: SimulatedNpc,
  dtSecs: number
) {
  if (!isFiniteNpcOrientation(npc.orientation)) {
    npc.setOrientation(
      finiteNpcOrientation(npc.orientation, npc.metadata.spawn_orientation)
    );
  }
  if (npcCinematicPauseActive(npc.state, secondsSinceEpoch())) {
    npc.setVelocity([0, 0, 0]);
    return;
  }
  tickHarthmereEnergyWeaponStatuses(npc);
  if (npc.lockedInPlace) {
    // Currently this primarily applies for robots, but if they are locked
    // in place, then we will not apply any physics at all to them.
    return;
  }

  // Dead NPCs are corpses, not active AI agents. Keep their final position
  // stable while expiry/despawn and corpse rendering handle the visual state.
  if (npc.hp <= 0) {
    return;
  }

  if (!npcIsInsideWorldBounds(env.worldMetadata, npc.position)) {
    npc.kill({ kind: "npc", type: { kind: "outOfWorldBounds" } });
    return;
  }

  // Older NPC biscuits may not define a behavior object. Normalize once at the
  // top of the tick so the rest of the AI logic can stay data-driven without
  // tripping strict-null checks.
  const behavior = getNpcBehavior(npc.type);
  const chaseAttack = effectiveChaseAttackParams(npc, behavior);

  // HARTHMERE_ESCORT: an escort's target comes from its combat POLICY, never from
  // proximity aggro. An escort that picks its own fights turns a delivery quest
  // into an unwinnable brawl, and one that can hit livestock or civilians is a
  // griefing tool. `updateEscortCombatTarget` writes into the same `chaseAttack`
  // slot, so the ordinary chase/attack tick executes the fight.
  const hasEscortAssignment = npcHasEscortAssignment(npc);
  const hasBusinessCustomerAssignment = npcHasBusinessCustomerAssignment(npc);
  if (hasEscortAssignment) {
    updateEscortCombatTarget(env, npc);
  } else if (chaseAttack) {
    updateAttackTarget(env, npc, chaseAttack);
  }

  const nowSeconds = secondsSinceEpoch();
  maybeStartNpcCombatEvade(env, npc, nowSeconds);
  const activeEvade = movementActionIsActive(npc.movementState, nowSeconds);

  let forwardSpeed = 0;
  const homePoint: ReadonlyVec3 = npc.metadata.spawn_position;

  let force = nullForce;

  const fleeOutput = !chaseAttack ? fleeFromThreatTick(env, npc) : undefined;

  // HARTHMERE_SCHEDULE_FOLLOW_LOGIC_INSTALL_MARKER: an NPC with authored
  // schedule entries should follow its route. This must take precedence over
  // the quest-giver "stay home" fallback, otherwise scheduled quest-givers
  // (most Harthmere town NPCs) stand still at spawn forever.
  const hasActiveSchedule = Boolean(
    (npc.state as any).schedule?.entries?.length
  );

  const locomotion = selectNpcLocomotion({
    hasActiveEvade: activeEvade,
    swim: Boolean(behavior.swim),
    fly: Boolean(behavior.fly),
    hasFleeOutput: Boolean(fleeOutput),
    isQuestGiver: Boolean(npc.questGiver),
    hasActiveSchedule,
    // An escort with a policy target must be able to fight even if its authored
    // biscuit never declared chaseAttack (the Chapter 1 companions do not).
    hasChaseAttack: Boolean(chaseAttack) || hasEscortAssignment,
    hasAttackTarget: Boolean(npc.state.chaseAttack?.attackTarget),
    hasBusinessCustomerAssignment,
    hasEscortAssignment,
    canMeander: Boolean(behavior.meander),
    canSocialize: Boolean(behavior.socialize),
  });

  switch (locomotion) {
    case "evade": {
      const profile = npcEvadeProfileForDescriptor(
        npc.label,
        npc.type.name,
        npc.type.displayName,
        getMovementTypeByNpcType(npc.type)
      );
      const movementType = getMovementTypeByNpcType(npc.type);
      const movementEnvironment =
        movementType === "swimming"
          ? NPC_SWIMMING_ENVIRONMENT_PARAMS
          : movementType === "flying"
            ? NPC_FLYING_ENVIRONMENT_PARAMS
            : DEFAULT_ENVIRONMENT_PARAMS;
      const forceCoefficient = horizontalForceForTargetSpeed(
        profile.speedMetersPerSecond,
        movementEnvironment
      );
      const direction = normalizev(
        npc.movementState?.direction ?? yawVector(npc.orientation[1])
      );
      force = addForce(force, (dt) => scale(dt * forceCoefficient, direction));
      break;
    }
    case "swim":
      force = addForce(force, swimTick(env, npc).force);
      break;
    case "fly":
      force = addForce(force, flyTick(env, npc).force);
      break;
    case "flee":
      forwardSpeed = fleeOutput!.forwardSpeed;
      break;
    case "returnHome":
      // Quest givers stay where they were spawned (unless they have an authored
      // schedule to follow, which takes precedence).
      forwardSpeed = returnHomeTick(npc).forwardSpeed;
      break;
    case "chaseAttack":
      ({ forwardSpeed } = chaseAttackTargetTick(
        env,
        npc,
        chaseAttack ?? ATTACKED_NPC_RETALIATION_CHASE_ATTACK_PARAMS
      ));
      break;
    case "businessCustomer":
      ({ forwardSpeed } = businessCustomerTick(env, npc));
      break;
    case "escort":
      ({ forwardSpeed } = escortTick(env, npc));
      break;
    case "schedule":
      forwardSpeed = scheduleFollowTick(env, npc).forwardSpeed;
      break;
    case "meander":
      forwardSpeed = meanderTick(env, npc, homePoint).forwardSpeed;
      break;
    case "socialize":
      forwardSpeed = socializeTick(
        env,
        npc,
        homePoint,
        behavior.socialize!
      ).forwardSpeed;
      break;
    case "hostileIdleWander":
      // HARTHMERE_NPC_HOSTILE_IDLE_WANDER:
      // Hostile NPCs that only declare chaseAttack (no meander, no socialize,
      // no schedule) used to stand perfectly still until aggroed. This made
      // Mucklings and Hexers feel like training dummies and broke the "muckers
      // are walking around" promise in the snapshot rules. Give every combatant
      // an implicit wander loop around its spawn so the world feels alive even
      // before the player engages.
      forwardSpeed = meanderTick(env, npc, homePoint).forwardSpeed;
      break;
    case "idle":
      break;
  }
  // The night speed increase is combat-only. Idle patrols, schedules,
  // socializing, fleeing, and ordinary meandering retain their authored
  // movement behavior.
  forwardSpeed = npcForwardSpeedForLocomotion({
    locomotion,
    forwardSpeed,
    nightMovementMultiplier: nightMuckerHexMovementMultiplier(npc),
    boundChaseSpeed: (requestedSpeed) =>
      boundedHarthmereNpcChaseSpeed(npc, requestedSpeed),
  });
  // Compute the NPC's AABB which is needed for physics and drowning logic.
  const aabb = anchorAndSizeToAABB(npc.position, npc.size);
  const movementType = getMovementTypeByNpcType(npc.type);
  const focusedBusinessProbe =
    locomotion === "businessCustomer" &&
    process.env.GLITCH_FOCUSED_NATIVE_E2E_STACK === "1" &&
    !focusedBusinessCustomerMovementProbes.has(npc.id)
      ? {
          type: {
            id: npc.type.id,
            name: npc.type.name,
            runSpeed: npc.type.runSpeed,
            rotateSpeed: npc.type.rotateSpeed,
          },
          size: [...npc.size],
          position: [...npc.position],
          orientation: [...npc.orientation],
          velocity: [...npc.velocity],
          rotateTarget: npc.state.rotateTarget,
          forwardSpeed,
        }
      : undefined;

  rotateTargetTick(npc, getNpcRotateSpeed(npc.type), dtSecs);
  const focusedOrientationAfterRotate = focusedBusinessProbe
    ? [...npc.orientation]
    : undefined;

  if (behavior.damageable) {
    drownTick(env.resources, npc, aabb, {
      breathingType: behavior.swim ? "water" : "air",
    });
  }

  const lastDamageForce = (() => {
    if (!behavior.damageable) {
      return undefined;
    }
    const health = npc.health;
    if (
      health.lastDamageSource?.kind !== "attack" ||
      health.lastDamageSource.dir === undefined ||
      !health.lastDamageTime
    ) {
      return undefined;
    }

    if (
      npc.state.damageReaction?.lastReactionTime &&
      health.lastDamageTime <= npc.state.damageReaction.lastReactionTime
    ) {
      return undefined;
    }

    return health.lastDamageSource.dir;
  })();

  if (lastDamageForce) {
    npc.mutableState().damageReaction = {
      lastReactionTime: Math.min(
        npc.health.lastDamageTime!,
        secondsSinceEpoch()
      ),
    };
  }

  const walkingForceCoefficient = npcGroundWalkingForceCoefficient({
    locomotion,
    fightSpeedBoostEligible: isHarthmereFightSpeedBoostNpc(npc),
    forwardSpeed,
  });
  const walkingForce = forwardWalkingForce(
    walkingForceCoefficient,
    npc.orientation[1]
  );

  force = addForce(force, walkingForce);

  const focusedPhysics = applyNpcPhysics({
    env,
    npc,
    dtSecs,
    aabb,
    lastDamageForce,
    force,
    movementType,
    captureDebug: focusedBusinessProbe !== undefined,
  });

  if (focusedBusinessProbe) {
    focusedBusinessCustomerMovementProbes.add(npc.id);
    log.info("Focused business customer physics result", {
      id: npc.id,
      dtSecs,
      walkingForceCoefficient,
      before: focusedBusinessProbe,
      movementType,
      orientationAfterRotate: focusedOrientationAfterRotate,
      physics: focusedPhysics,
      after: {
        position: [...npc.position],
        orientation: [...npc.orientation],
        velocity: [...npc.velocity],
      },
    });
  }

  if (behavior.meander?.stayDistanceFromSpawn) {
    // If the NPC is far from its home for more than 5 minutes, it will
    // expire.
    const FAR_FROM_HOME_SECONDS_BEFORE_EXPIRE = 2 * 60;
    farFromHomeTick(
      npc,
      homePoint,
      FAR_FROM_HOME_SECONDS_BEFORE_EXPIRE,
      behavior.meander.stayDistanceFromSpawn
    );
  }
}

function applyNpcPhysics({
  env,
  npc,
  dtSecs,
  aabb,
  lastDamageForce,
  force,
  movementType,
  captureDebug = false,
}: {
  env: Environment;
  npc: SimulatedNpc;
  dtSecs: number;
  aabb: AABB;
  lastDamageForce: ReadonlyVec3 | undefined;
  force: Force;
  movementType: MovementType;
  captureDebug?: boolean;
}) {
  const metadata = env.resources.get("/ecs/metadata");
  const collisionHits: Array<{
    hit: AABB;
    entityId?: BiomesId;
  }> = [];
  // Define the intersection testing routine.
  const collisionIndex = ([v0, v1]: AABB, fn: HitFn) => {
    CollisionHelper.intersect(
      (id) => env.resources.get("/physics/boxes", id),
      env.table,
      metadata,
      [v0, v1],
      (hit: AABB, entity?: ReadonlyEntity) => {
        // Avoid self-intersections.
        if (!entity || entity.id !== npc.id) {
          if (captureDebug && collisionHits.length < 40) {
            collisionHits.push({
              hit: [
                [...hit[0]],
                [...hit[1]],
              ],
              entityId: entity?.id,
            });
          }
          return fn(hit);
        }
      }
    );
  };

  // Define a routine to test if an NPC can climb on collision.
  const traversalProfile = npcGroundTraversalProfile(npc.size);
  const climbableIndex = toClimbableIndex(
    collisionIndex,
    traversalProfile.maxStepHeight
  );
  const groundLocomotionAabb = npcGroundLocomotionAabb(npc.position, npc.size);

  const forces = [force];
  const globals = npcGlobals();

  if (lastDamageForce) {
    const velocityDiff = scale(
      globals.knockback.force,
      normalizev(lastDamageForce)
    );

    // Pop the NPC up into the air a bit when it gets hit.
    velocityDiff[1] = globals.knockback.popup;

    forces.push(() => velocityDiff);
  }

  // Run a physics step to compute the NPCs new position and momentum.
  const result =
    movementType === "swimming" || movementType === "flying"
      ? moveBodyFluid(
          dtSecs,
          { aabb, velocity: npc.velocity },
          collisionIndex,
          forces,
          movementType === "swimming"
            ? NPC_SWIMMING_ENVIRONMENT_PARAMS
            : NPC_FLYING_ENVIRONMENT_PARAMS
        )
      : moveBodyWithClimbing(
          dtSecs,
          { aabb: groundLocomotionAabb, velocity: [...npc.velocity] },
          { ...DEFAULT_ENVIRONMENT_PARAMS, gravity: globals.gravity },
          collisionIndex,
          climbableIndex,
          forces,
          []
        );

  if (movementType === "swimming" || movementType === "flying") {
    if (hasFiniteNpcMotionDirection(result.movement.velocity)) {
      npc.setOrientation(pitchAndYaw(result.movement.velocity));
    }
  }

  if (!_.isEqual(result.movement.impulse, [0, 0, 0])) {
    npc.setPosition(add(npc.position, result.movement.impulse));
  }
  if (!_.isEqual(result.movement.velocity, npc.velocity)) {
    npc.setVelocity([...result.movement.velocity]);
  }
  return captureDebug
    ? {
        groundLocomotionAabb: [
          [...groundLocomotionAabb[0]],
          [...groundLocomotionAabb[1]],
        ] as AABB,
        movement: {
          impulse: [...result.movement.impulse],
          velocity: [...result.movement.velocity],
        },
        collisionHits,
      }
    : undefined;
}
