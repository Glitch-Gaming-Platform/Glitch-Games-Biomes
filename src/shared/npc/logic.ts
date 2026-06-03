import { secondsSinceEpoch } from "@/shared/ecs/config";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import { CollisionHelper } from "@/shared/game/collision";
import {
  add,
  anchorAndSizeToAABB,
  containsAABB,
  normalizev,
  pitchAndYaw,
  scale,
} from "@/shared/math/linear";
import type { AABB, ReadonlyVec3 } from "@/shared/math/types";
import {
  chaseAttackTargetTick,
  updateAttackTarget,
} from "@/shared/npc/behavior/chase_attack";
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
  nullForce,
} from "@/shared/physics/forces";
import { moveBodyFluid, moveBodyWithClimbing } from "@/shared/physics/movement";
import type { Force, HitFn } from "@/shared/physics/types";
import { toClimbableIndex } from "@/shared/physics/utils";
import _ from "lodash";

export const ATTACKED_NPC_RETALIATION_FALLBACK_V1 =
  "ATTACKED_NPC_RETALIATION_FALLBACK_V1";

const ATTACKED_NPC_RETALIATION_CHASE_ATTACK_PARAMS_V1: BehaviorChaseAttackParams =
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

function effectiveChaseAttackParamsV1(
  npc: SimulatedNpc,
  behavior: ReturnType<typeof getNpcBehavior>
): BehaviorChaseAttackParams | undefined {
  if (behavior.chaseAttack) {
    return behavior.chaseAttack;
  }

  // ATTACKED_NPC_RETALIATION_FALLBACK_V1:
  // Preserve authored proactive aggression for beasts/civilians that already
  // have chaseAttack. For older snapshot/imported NPC types that are attackable
  // but forgot that behavior, still let them fight back after a real player hit.
  //
  // ATTACKED_NPC_RETALIATION_FALLBACK_V2 — condition fix:
  // The original check was `behavior.damageable?.attackable !== true`, which
  // treated `undefined` (i.e. not explicitly set) as non-attackable. This
  // blocked retaliation for all snapshot NPCs (Mucklings, Hexes, animals)
  // whose biscuit data goes through snapshotLegacyNpcTypeV1: that path
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

  return ATTACKED_NPC_RETALIATION_CHASE_ATTACK_PARAMS_V1;
}

// The single locomotion behavior an NPC runs this tick. Exactly one is chosen
// per tick by strict priority; see `selectNpcLocomotion`.
export type NpcLocomotionChoice =
  | "swim"
  | "fly"
  | "flee"
  | "returnHome"
  | "chaseAttack"
  | "schedule"
  | "meander"
  | "socialize"
  | "hostileIdleWander"
  | "idle";

export interface NpcLocomotionInputs {
  swim: boolean;
  fly: boolean;
  hasFleeOutput: boolean;
  isQuestGiver: boolean;
  hasActiveSchedule: boolean;
  hasChaseAttack: boolean;
  hasAttackTarget: boolean;
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
  if (inputs.swim) {
    return "swim";
  }
  if (inputs.fly) {
    return "fly";
  }
  if (inputs.hasFleeOutput) {
    return "flee";
  }
  if (inputs.isQuestGiver && !inputs.hasActiveSchedule) {
    return "returnHome";
  }
  if (inputs.hasChaseAttack && inputs.hasAttackTarget) {
    return "chaseAttack";
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

// The tick context that drives most of the NPCs based on their data-driven
// behavioral definitions.
export function npcTickLogic(
  env: Environment,
  npc: SimulatedNpc,
  dtSecs: number
) {
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

  if (
    !containsAABB(
      [env.worldMetadata.aabb.v0, env.worldMetadata.aabb.v1],
      npc.position
    )
  ) {
    npc.kill({ kind: "npc", type: { kind: "outOfWorldBounds" } });
    return;
  }

  // Older NPC biscuits may not define a behavior object. Normalize once at the
  // top of the tick so the rest of the AI logic can stay data-driven without
  // tripping strict-null checks.
  const behavior = getNpcBehavior(npc.type);
  const chaseAttack = effectiveChaseAttackParamsV1(npc, behavior);

  if (chaseAttack) {
    updateAttackTarget(env, npc, chaseAttack);
  }

  let forwardSpeed = 0;
  const homePoint: ReadonlyVec3 = npc.metadata.spawn_position;

  let force = nullForce;

  const fleeOutput = !chaseAttack ? fleeFromThreatTick(env, npc) : undefined;

  // HARTHMERE_SCHEDULE_FOLLOW_LOGIC_V2_INSTALL_MARKER: an NPC with authored
  // schedule entries should follow its route. This must take precedence over
  // the quest-giver "stay home" fallback, otherwise scheduled quest-givers
  // (most Harthmere town NPCs) stand still at spawn forever.
  const hasActiveSchedule = Boolean((npc.state as any).schedule?.entries?.length);

  const locomotion = selectNpcLocomotion({
    swim: Boolean(behavior.swim),
    fly: Boolean(behavior.fly),
    hasFleeOutput: Boolean(fleeOutput),
    isQuestGiver: Boolean(npc.questGiver),
    hasActiveSchedule,
    hasChaseAttack: Boolean(chaseAttack),
    hasAttackTarget: Boolean(npc.state.chaseAttack?.attackTarget),
    canMeander: Boolean(behavior.meander),
    canSocialize: Boolean(behavior.socialize),
  });

  switch (locomotion) {
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
      ({ forwardSpeed } = chaseAttackTargetTick(env, npc, chaseAttack!));
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
      // HARTHMERE_NPC_HOSTILE_IDLE_WANDER_V1:
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
  // Compute the NPC's AABB which is needed for physics and drowning logic.
  const aabb = anchorAndSizeToAABB(npc.position, npc.size);

  rotateTargetTick(npc, getNpcRotateSpeed(npc.type), dtSecs);

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

  const walkingForce = forwardWalkingForce(forwardSpeed, npc.orientation[1]);

  force = addForce(force, walkingForce);

  applyNpcPhysics({
    env,
    npc,
    dtSecs,
    aabb,
    lastDamageForce,
    force,
    movementType: getMovementTypeByNpcType(npc.type),
  });

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
}: {
  env: Environment;
  npc: SimulatedNpc;
  dtSecs: number;
  aabb: AABB;
  lastDamageForce: ReadonlyVec3 | undefined;
  force: Force;
  movementType: MovementType;
}) {
  const metadata = env.resources.get("/ecs/metadata");
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
          return fn(hit);
        }
      }
    );
  };

  // Define a routine to test if an NPC can climb on collision.
  const climbableIndex = toClimbableIndex(collisionIndex);

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
          { aabb: aabb, velocity: [...npc.velocity] },
          { ...DEFAULT_ENVIRONMENT_PARAMS, gravity: globals.gravity },
          collisionIndex,
          climbableIndex,
          forces,
          []
        );

  if (movementType === "swimming" || movementType === "flying") {
    npc.setOrientation(pitchAndYaw(npc.velocity));
  }

  if (!_.isEqual(result.movement.impulse, [0, 0, 0])) {
    npc.setPosition(add(npc.position, result.movement.impulse));
  }
  if (!_.isEqual(result.movement.velocity, npc.velocity)) {
    npc.setVelocity([...result.movement.velocity]);
  }
}
