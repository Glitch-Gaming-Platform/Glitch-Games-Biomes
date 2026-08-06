import assert from "assert";
import { TriggerState } from "@/shared/ecs/gen/components";
import { harthmereNativeFishingClaimSkillOutcome } from "@/server/logic/events/handlers/fishing";
import { harthmereNativeTerrainGatheringSkillModifiers } from "@/server/logic/events/handlers/edits";
import { writeHarthmereNativeSkillTotalXp } from "@/shared/harthmere/harthmere_skill_progression";
import { harthmereSkillTotalXpCap } from "@/shared/harthmere/mmo_class_ability_collectibles";

function master(state: ReturnType<typeof TriggerState.create>, ...skillIds: string[]) {
  for (const skillId of skillIds) {
    writeHarthmereNativeSkillTotalXp(
      state,
      skillId,
      harthmereSkillTotalXpCap(skillId)
    );
  }
}

describe("Harthmere native ECS fishing and terrain sublevels", () => {
  it("caps Fishing plus Gathering rod efficiency and can grant a deterministic bonus catch", () => {
    const state = TriggerState.create();
    master(state, "gathering", "fishing");
    let bonus = false;
    for (let catchTime = 1; catchTime <= 100 && !bonus; catchTime += 1) {
      const outcome = harthmereNativeFishingClaimSkillOutcome({
        triggerState: state,
        playerId: 42,
        catchTime,
        caughtItemId: 99,
      });
      assert.equal(outcome.durabilityMultiplier, 0.8);
      bonus = outcome.bonusCatch;
    }
    assert.equal(bonus, true);
  });

  it("caps native Mining plus Gathering terrain yield and tool efficiency", () => {
    const state = TriggerState.create();
    master(state, "gathering", "mining");
    assert.deepEqual(
      harthmereNativeTerrainGatheringSkillModifiers({
        triggerState: state,
        resourceText: "rich iron ore stone deposit",
      }),
      { mining: true, durability: 0.8, yield: 1.2 }
    );
  });

  it("uses Gathering alone for non-mineral terrain", () => {
    const state = TriggerState.create();
    master(state, "gathering");
    assert.deepEqual(
      harthmereNativeTerrainGatheringSkillModifiers({
        triggerState: state,
        resourceText: "fallen softwood log",
      }),
      { mining: false, durability: 0.8, yield: 1.2 }
    );
  });
});
