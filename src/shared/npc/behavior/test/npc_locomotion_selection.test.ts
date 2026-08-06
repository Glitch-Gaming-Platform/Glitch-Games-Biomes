import assert from "assert";

import {
  npcForwardSpeedForLocomotion,
  npcGroundWalkingForceCoefficient,
  npcShouldStartCombatEvade,
  selectNpcLocomotion,
  type NpcLocomotionInputs,
} from "@/shared/npc/logic";
import { horizontalForceForTargetSpeed } from "@/shared/physics/forces";
import { DEFAULT_ENVIRONMENT_PARAMS } from "@/shared/physics/environments";
import { HARTHMERE_NPC_CHASE_SPEED_MULTIPLIER } from "@/shared/npc/behavior/chase_attack";

// Every flag off: the NPC has nothing to do.
const base: NpcLocomotionInputs = {
  hasActiveEvade: false,
  swim: false,
  fly: false,
  hasFleeOutput: false,
  isQuestGiver: false,
  hasActiveSchedule: false,
  hasChaseAttack: false,
  hasAttackTarget: false,
  canMeander: false,
  canSocialize: false,
};

describe("NPC locomotion priority selection", () => {
  it("gives active stagger priority over evade, combat, and ambient movement", () => {
    assert.equal(
      selectNpcLocomotion({
        ...base,
        hasActiveStagger: true,
        hasActiveEvade: true,
        hasChaseAttack: true,
        hasAttackTarget: true,
        hasActiveSchedule: true,
        canMeander: true,
      }),
      "stagger"
    );
  });

  it("starts an evade only for an incoming attack telegraph or a fresh hit", () => {
    assert.equal(
      npcShouldStartCombatEvade({
        nowSeconds: 10,
        targetEmoteType: "attack1",
        targetEmoteStartTime: 9.6,
      }),
      true
    );
    assert.equal(
      npcShouldStartCombatEvade({
        nowSeconds: 10,
        targetEmoteType: "wave",
        targetEmoteStartTime: 9.9,
        lastDamageTime: 9.85,
      }),
      true
    );
    assert.equal(
      npcShouldStartCombatEvade({
        nowSeconds: 10,
        targetEmoteType: "attack2",
        targetEmoteStartTime: 9,
        lastDamageTime: 9,
      }),
      false
    );
    assert.equal(npcShouldStartCombatEvade({ nowSeconds: 10 }), false);
  });

  it("idles when no behavior applies", () => {
    assert.equal(selectNpcLocomotion(base), "idle");
  });

  it("gives an active evade the highest movement priority", () => {
    assert.equal(
      selectNpcLocomotion({
        ...base,
        hasActiveEvade: true,
        swim: true,
        fly: true,
        hasFleeOutput: true,
        hasChaseAttack: true,
        hasAttackTarget: true,
        hasActiveSchedule: true,
      }),
      "evade"
    );
  });

  it("swims/flies above every regular behavior", () => {
    assert.equal(
      selectNpcLocomotion({
        ...base,
        swim: true,
        hasChaseAttack: true,
        hasAttackTarget: true,
        hasActiveSchedule: true,
      }),
      "swim"
    );
    assert.equal(
      selectNpcLocomotion({ ...base, fly: true, hasActiveSchedule: true }),
      "fly"
    );
  });

  it("flees from nearby threats before idle behaviors", () => {
    assert.equal(
      selectNpcLocomotion({ ...base, hasFleeOutput: true, canMeander: true }),
      "flee"
    );
  });

  it("a quest giver with no schedule stays home", () => {
    assert.equal(
      selectNpcLocomotion({ ...base, isQuestGiver: true, canMeander: true }),
      "returnHome"
    );
  });

  it("REGRESSION: a quest giver WITH a schedule follows it instead of standing at spawn", () => {
    // This is the bug the audit found: the quest-giver "stay home" branch used
    // to short-circuit before the schedule branch, freezing scheduled town NPCs.
    assert.equal(
      selectNpcLocomotion({
        ...base,
        isQuestGiver: true,
        hasActiveSchedule: true,
      }),
      "schedule"
    );
  });

  it("live combat outranks the schedule", () => {
    assert.equal(
      selectNpcLocomotion({
        ...base,
        isQuestGiver: true,
        hasActiveSchedule: true,
        hasChaseAttack: true,
        hasAttackTarget: true,
      }),
      "chaseAttack"
    );
  });

  it("a chaseAttack NPC with a target chases over schedule/meander", () => {
    assert.equal(
      selectNpcLocomotion({
        ...base,
        hasChaseAttack: true,
        hasAttackTarget: true,
        hasActiveSchedule: true,
        canMeander: true,
      }),
      "chaseAttack"
    );
  });

  it("the schedule outranks meander and socialize", () => {
    assert.equal(
      selectNpcLocomotion({
        ...base,
        hasActiveSchedule: true,
        canMeander: true,
        canSocialize: true,
      }),
      "schedule"
    );
  });

  it("meander outranks socialize", () => {
    assert.equal(
      selectNpcLocomotion({ ...base, canMeander: true, canSocialize: true }),
      "meander"
    );
  });

  it("a hostile NPC with no target idle-wanders so it isn't a training dummy", () => {
    assert.equal(
      selectNpcLocomotion({ ...base, hasChaseAttack: true }),
      "hostileIdleWander"
    );
  });

  it("keeps ordinary walking unchanged even for Muckers, Hexes, and animals", () => {
    for (const locomotion of [
      "schedule",
      "meander",
      "socialize",
      "hostileIdleWander",
      "returnHome",
      "flee",
    ] as const) {
      assert.equal(
        npcForwardSpeedForLocomotion({
          locomotion,
          forwardSpeed: 2.2,
          nightMovementMultiplier: 1.8,
          boundChaseSpeed: (requestedSpeed) =>
            requestedSpeed * HARTHMERE_NPC_CHASE_SPEED_MULTIPLIER,
        }),
        2.2,
        `${locomotion} night speed`
      );
      assert.equal(
        npcGroundWalkingForceCoefficient({
          locomotion,
          fightSpeedBoostEligible: true,
          forwardSpeed: 2.2,
        }),
        2.2,
        locomotion
      );
    }
  });

  it("boosts grounded movement only for eligible creatures actively fighting", () => {
    const chaseSpeed = 4.4;
    assert.equal(
      npcForwardSpeedForLocomotion({
        locomotion: "chaseAttack",
        forwardSpeed: chaseSpeed,
        nightMovementMultiplier: 1.8,
        boundChaseSpeed: (requestedSpeed) =>
          requestedSpeed * HARTHMERE_NPC_CHASE_SPEED_MULTIPLIER,
      }),
      chaseSpeed * 1.8 * HARTHMERE_NPC_CHASE_SPEED_MULTIPLIER
    );
    assert.equal(
      npcGroundWalkingForceCoefficient({
        locomotion: "chaseAttack",
        fightSpeedBoostEligible: true,
        forwardSpeed: chaseSpeed,
      }),
      horizontalForceForTargetSpeed(chaseSpeed, DEFAULT_ENVIRONMENT_PARAMS)
    );
    assert.equal(
      npcGroundWalkingForceCoefficient({
        locomotion: "chaseAttack",
        fightSpeedBoostEligible: false,
        forwardSpeed: chaseSpeed,
      }),
      chaseSpeed
    );
  });

  it("converts escort target speed into enough ground force to overcome friction", () => {
    const escortSpeed = 6.6;
    assert.equal(
      npcGroundWalkingForceCoefficient({
        locomotion: "escort",
        fightSpeedBoostEligible: false,
        forwardSpeed: escortSpeed,
      }),
      horizontalForceForTargetSpeed(escortSpeed, DEFAULT_ENVIRONMENT_PARAMS)
    );
  });
});
