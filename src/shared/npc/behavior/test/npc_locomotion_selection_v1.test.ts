import assert from "assert";

import {
  selectNpcLocomotion,
  type NpcLocomotionInputs,
} from "@/shared/npc/logic";

// Every flag off: the NPC has nothing to do.
const base: NpcLocomotionInputs = {
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
  it("idles when no behavior applies", () => {
    assert.equal(selectNpcLocomotion(base), "idle");
  });

  it("swims/flies above every other behavior", () => {
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
});
