import assert from "assert";
import {
  HARTHMERE_SUBLEVEL_BENEFITS,
  HARTHMERE_SUBLEVEL_POTENCY_CAP,
  harthmereCombatSkillWeights,
  harthmereDeterministicYieldCount,
  harthmereLoanTermsForPersuasion,
  harthmereSublevelCurrentEffects,
  harthmereSublevelEfficiencyMultiplier,
  harthmereSublevelNextMilestone,
  harthmereSublevelPotencyMultiplier,
  harthmereSublevelRareChance,
  harthmereSublevelTitle,
  harthmereSublevelWeightedProgress,
  harthmereSublevelYieldMultiplier,
  harthmereWeightedPotencyMultiplier,
  normalizeHarthmereSublevelId,
} from "@/shared/harthmere/harthmere_sublevel_benefits";
import { HARTHMERE_SKILL_DEFINITIONS } from "@/shared/harthmere/mmo_class_ability_collectibles";

describe("Harthmere sublevel benefits", () => {
  it("defines gameplay benefits for every specialized visible skill", () => {
    const specialized = Object.keys(HARTHMERE_SKILL_DEFINITIONS).filter(
      (skillId) => skillId !== "character_level"
    );
    assert.deepEqual(
      Object.keys(HARTHMERE_SUBLEVEL_BENEFITS).sort(),
      specialized.sort()
    );
    for (const skillId of specialized) {
      const definition = HARTHMERE_SUBLEVEL_BENEFITS[skillId];
      assert.ok(definition.improves.length > 0, `${skillId} needs effects`);
      assert.deepEqual(
        definition.milestones.map((milestone) => milestone.level),
        [5, 10, 20, 35, 50, 75, 100]
      );
    }
  });

  it("keeps action potency at the requested 25 percent maximum", () => {
    assert.equal(HARTHMERE_SUBLEVEL_POTENCY_CAP, 0.25);
    assert.equal(harthmereSublevelPotencyMultiplier(1), 1);
    assert.equal(harthmereSublevelPotencyMultiplier(100), 1.25);
    assert.equal(
      harthmereWeightedPotencyMultiplier(
        { combat: 100, melee_combat: 100 },
        { combat: 0.35, melee_combat: 0.65 }
      ),
      1.25
    );
  });

  it("caps efficiency, yield, and relative rare chance independently", () => {
    assert.equal(harthmereSublevelEfficiencyMultiplier(100), 0.8);
    assert.equal(harthmereSublevelYieldMultiplier(100), 1.2);
    assert.ok(
      Math.abs(harthmereSublevelRareChance(0.1, 100) - 0.15) < 0.000001
    );
  });

  it("turns fractional yield into a stable authoritative integer result", () => {
    const first = harthmereDeterministicYieldCount({
      baseCount: 3,
      multiplier: 1.2,
      seed: "same-action",
    });
    assert.equal(
      first,
      harthmereDeterministicYieldCount({
        baseCount: 3,
        multiplier: 1.2,
        seed: "same-action",
      })
    );
    assert.ok(first === 3 || first === 4);
    assert.equal(
      harthmereDeterministicYieldCount({
        baseCount: 10,
        multiplier: 1.2,
        seed: "guaranteed",
      }),
      12
    );
  });

  it("uses parent and specialty weights without additive overstacking", () => {
    const dagger = harthmereCombatSkillWeights({
      itemId: "iron_dagger",
      kind: "melee",
    });
    assert.deepEqual(dagger, {
      combat: 0.2,
      melee_combat: 0.35,
      dagger_mastery: 0.45,
    });
    assert.equal(
      harthmereSublevelWeightedProgress(
        { combat: 100, melee_combat: 1, dagger_mastery: 1 },
        dagger
      ),
      0.2
    );
  });

  it("normalizes profession aliases at every authority boundary", () => {
    assert.equal(normalizeHarthmereSublevelId("smithing"), "blacksmithing");
    assert.equal(normalizeHarthmereSublevelId("foraging"), "gathering");
    assert.equal(normalizeHarthmereSublevelId("community"), "persuasion");
  });

  it("adds Expert and Master titles and exposes current/next effects", () => {
    assert.equal(harthmereSublevelTitle(74), "Adept");
    assert.equal(harthmereSublevelTitle(75), "Expert");
    assert.equal(harthmereSublevelTitle(100), "Master");
    assert.ok(harthmereSublevelCurrentEffects("cooking", 50).length > 0);
    assert.deepEqual(harthmereSublevelNextMilestone("cooking", 50), {
      level: 75,
      label: "Master Recipes",
    });
  });

  it("improves loan terms without bypassing credit rules", () => {
    assert.deepEqual(
      harthmereLoanTermsForPersuasion({
        persuasionLevel: 100,
        basePrincipal: 250,
        baseDailyInterestRate: 0.015,
        baseDays: 30,
      }),
      {
        maxPrincipal: 312,
        dailyInterestRate: 0.012,
        maxDays: 37,
      }
    );
  });
});
