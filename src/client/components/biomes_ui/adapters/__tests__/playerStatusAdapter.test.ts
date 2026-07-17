/// <reference types="mocha" />

import assert from "assert";
import {
  applyOptimisticPlayerStatusForTest,
  biomesUIVitalsDisplayFromLiveStatusForTest,
} from "../playerStatusAdapter";

describe("Biomes UI player status adapter", () => {
  it("applies immediate damage deltas while the authority response is in flight", () => {
    const damaged = applyOptimisticPlayerStatusForTest(
      {
        combat: { hp: 80, maxHp: 100, deathState: "alive" },
      },
      { hpDelta: -5, hpPercentDelta: -0.1 }
    );
    assert.equal(damaged?.combat?.hp, 65);
    assert.equal(damaged?.combat?.deathState, "alive");

    const downed = applyOptimisticPlayerStatusForTest(damaged, {
      hpDelta: -100,
    });
    assert.equal(downed?.combat?.hp, 0);
    assert.equal(downed?.combat?.deathState, "downed");
  });

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

  it("keeps the health/mana bar scale identical whether alive or in combat (stable server max)", () => {
    // Server reports a leveled max of 108; the local combat fallback still uses a
    // base max of 100. The bar must use the SAME max in both states, otherwise it
    // visibly rescales when combat starts. We always take the server max and take
    // the local current hp for damage freshness.
    const inCombat = biomesUIVitalsDisplayFromLiveStatusForTest(
      {
        className: "Warrior",
        level: 5,
        combat: {
          hp: 108,
          maxHp: 108,
          deathState: "alive",
          primaryResource: "mana",
          resource: 120,
          maxResource: 128,
        },
      },
      {
        hp: 50, // fresh local damage
        maxHp: 100, // stale local base max
        combatState: "in_combat",
        resourceLabel: "Mana",
        resourceValue: 60,
        resourceMax: 100,
      }
    );
    // Max comes from the server (stable), current hp/mana stays local & fresh.
    assert.equal(inCombat.maxHp, 108);
    assert.equal(inCombat.hp, 50);
    assert.equal(inCombat.resourceMax, 128);
    assert.equal(inCombat.resourceValue, 60);

    const alive = biomesUIVitalsDisplayFromLiveStatusForTest(
      {
        className: "Warrior",
        level: 5,
        combat: {
          hp: 108,
          maxHp: 108,
          deathState: "alive",
          primaryResource: "mana",
          resource: 120,
          maxResource: 128,
        },
      },
      {
        hp: 108,
        maxHp: 100,
        combatState: "idle",
        resourceLabel: "Mana",
        resourceValue: 120,
        resourceMax: 100,
      }
    );
    // Same max scale in the alive state → the bar does not rescale.
    assert.equal(alive.maxHp, inCombat.maxHp);
    assert.equal(alive.resourceMax, inCombat.resourceMax);
  });

  it("clamps current hp into the stable max so the bar never overflows", () => {
    const display = biomesUIVitalsDisplayFromLiveStatusForTest(
      {
        combat: { hp: 100, maxHp: 100, deathState: "alive" },
      },
      {
        hp: 140, // impossible local overshoot
        maxHp: 100,
        combatState: "in_combat",
        resourceLabel: "Mana",
        resourceValue: 10,
        resourceMax: 100,
      }
    );
    assert.equal(display.maxHp, 100);
    assert.equal(display.hp, 100);
  });
});
