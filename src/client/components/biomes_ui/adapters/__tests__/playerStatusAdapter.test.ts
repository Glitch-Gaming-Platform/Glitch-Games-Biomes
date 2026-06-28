/// <reference types="mocha" />

import assert from "assert";
import { biomesUIVitalsDisplayFromLiveStatusForTest } from "../playerStatusAdapter";

describe("Biomes UI player status adapter", () => {
  it("does not let stale higher live HP undo fresher local damage", () => {
    const display = biomesUIVitalsDisplayFromLiveStatusForTest(
      {
        className: "Warrior",
        level: 1,
        combat: {
          hp: 90,
          maxHp: 100,
          deathState: "alive",
          primaryResource: "mana",
          resource: 90,
          maxResource: 100,
        },
      },
      {
        hp: 72,
        maxHp: 100,
        combatState: "in_combat",
        resourceLabel: "Mana",
        resourceValue: 44,
        resourceMax: 100,
      }
    );

    assert.equal(display.hp, 72);
    assert.equal(display.maxHp, 100);
    assert.equal(display.combatState, "in_combat");
    assert.equal(display.resourceValue, 44);
  });
});
