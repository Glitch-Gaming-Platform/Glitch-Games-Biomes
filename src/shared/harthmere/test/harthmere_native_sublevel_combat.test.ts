import assert from "assert";
import { TriggerState } from "@/shared/ecs/gen/components";
import {
  harthmereNativeCombatSublevelMultipliers,
  writeHarthmereNativeSkillTotalXp,
} from "@/shared/harthmere/harthmere_skill_progression";
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

describe("Harthmere native ECS sublevel combat", () => {
  it("caps native melee damage and status potency at 25 percent", () => {
    const state = TriggerState.create();
    master(state, "combat", "melee_combat");
    const result = harthmereNativeCombatSublevelMultipliers(state, {
      itemId: "iron_longsword",
      kind: "melee",
    });
    assert.equal(result.potency, 1.25);
    assert.equal(result.statusPotency, 1.25);
  });

  it("uses Death Lore against undead and Tracking against wildlife without overstacking", () => {
    const undead = TriggerState.create();
    master(undead, "combat", "melee_combat", "death_lore");
    const undeadResult = harthmereNativeCombatSublevelMultipliers(undead, {
      itemId: "iron_longsword",
      kind: "melee",
      targetDescriptor: "undead crypt skeleton",
    });
    assert.equal(undeadResult.potency, 1.25);

    const wildlife = TriggerState.create();
    master(wildlife, "combat", "ranged_combat", "archery", "tracking");
    const wildlifeResult = harthmereNativeCombatSublevelMultipliers(wildlife, {
      itemId: "hunter_bow",
      kind: "ranged",
      targetDescriptor: "wildlife boar animal",
    });
    assert.equal(wildlifeResult.potency, 1.25);
  });

  it("lets Arcane Literacy improve spell efficiency while the total reduction stays at 20 percent", () => {
    const arcaneOnly = TriggerState.create();
    master(arcaneOnly, "arcane_literacy");
    const partial = harthmereNativeCombatSublevelMultipliers(arcaneOnly, {
      itemId: "fireball_spell",
      kind: "spell",
    });
    assert.ok(partial.efficiency < 1);
    assert.ok(partial.efficiency > 0.8);

    master(arcaneOnly, "combat", "fire_magic");
    const mastered = harthmereNativeCombatSublevelMultipliers(arcaneOnly, {
      itemId: "fireball_spell",
      kind: "spell",
    });
    assert.equal(mastered.efficiency, 0.8);
  });
});
