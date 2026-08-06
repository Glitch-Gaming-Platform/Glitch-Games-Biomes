import assert from "assert";
import { applyCreatureLevelToChaseAttackParams } from "@/shared/npc/behavior/chase_attack";
import { buildCreatureProgression } from "@/shared/npc/creature_level";

describe("Anima isolation from player sublevels", () => {
  it("does not apply player Combat, Death Lore, Tracking, or magic levels to NPC attacks", () => {
    const creatureProgression = buildCreatureProgression({
      assignment: { level: 10, levelSource: "authored" },
    });
    const baseParams = {
      attackDamage: 20,
      attackIntervalSecs: 1.5,
    } as any;
    const ordinaryNpc = {
      state: { creatureProgression },
    } as any;
    const npcWithInjectedPlayerFields = {
      state: {
        creatureProgression,
        playerSkillLevels: {
          combat: 100,
          death_lore: 100,
          tracking: 100,
          fire_magic: 100,
        },
      },
    } as any;

    assert.deepEqual(
      applyCreatureLevelToChaseAttackParams(
        npcWithInjectedPlayerFields,
        baseParams
      ),
      applyCreatureLevelToChaseAttackParams(ordinaryNpc, baseParams)
    );
  });
});
