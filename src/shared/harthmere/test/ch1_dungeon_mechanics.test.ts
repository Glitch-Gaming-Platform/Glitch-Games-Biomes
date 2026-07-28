import assert from "assert";
import { TriggerState } from "@/shared/ecs/gen/components";
import { ch1Augur9Initial } from "../ch1_augur9";
import {
  CH1_DUNGEON_ZONE_MECHANICS,
  applyCh1DungeonNativeEffectForTest,
  ch1ApplyDungeonObjectiveMechanic,
  ch1InitialDungeonSurvivalState,
} from "../ch1_dungeon_mechanics";
import {
  ch1ConsumeProvisioningResourceFromInventory,
  ch1ProvisioningCarriedFromInventory,
} from "../ch1_live_gate";
import {
  readCh1NativeRunAdmission,
  writeCh1NativeRunAdmission,
} from "../ch1_native_run";
import { CH1_QUESTS } from "../ch1_quests";

describe("Chapter 1 dungeon survival mechanics", () => {
  it("spends the exact mandatory water and fuel budgets across authored zones", () => {
    const totals = Object.values(CH1_DUNGEON_ZONE_MECHANICS).reduce(
      (sum, zone) => {
        sum[zone.dungeonId] += zone.resourceCost;
        return sum;
      },
      { ch1_dungeon_desert: 0, ch1_dungeon_winter: 0 }
    );
    assert.deepEqual(totals, {
      ch1_dungeon_desert: 12,
      ch1_dungeon_winter: 18,
    });
  });

  it("routes every stat-bearing dungeon objective through signed completion", () => {
    const authoredSteps = new Map(
      CH1_QUESTS.flatMap((quest) =>
        quest.steps.map((step) => [step.id, step] as const)
      )
    );
    for (const stepId of Object.keys(CH1_DUNGEON_ZONE_MECHANICS)) {
      const step = authoredSteps.get(stepId);
      assert(step, `${stepId} is missing from the Chapter 1 quest chain`);
      assert.notEqual(
        step.trigger,
        "near_location",
        `${stepId} would bypass its resource/stat consequence in native ECS`
      );
    }
  });

  it("applies every desert zone in one run and drains AUGUR faster in heat", () => {
    let survival = ch1InitialDungeonSurvivalState({
      dungeonId: "ch1_dungeon_desert",
      carried: { water: 12, light: 10 },
    });
    let augur9 = ch1Augur9Initial();
    const routes: ReadonlyArray<[string, string?]> = [
      ["d1_dune_threshold"],
      ["d1_salt_market", "drop_awnings"],
      ["d1_cistern_stair", "lit_stair"],
      ["ch1_a3_d1_hall_of_weights", "temple_balance"],
      ["d1_sun_court", "break_horns"],
      ["d1_seed_vault"],
      ["d1_find_iris"],
      ["d1_the_long_walk"],
    ];
    for (const [stepId, choice] of routes) {
      const result = ch1ApplyDungeonObjectiveMechanic({
        survival,
        augur9,
        stepId,
        choice,
        carryWeight: 20,
      });
      assert.equal(result.ok, true, result.reason);
      survival = result.survival;
      augur9 = result.augur9;
    }
    assert.equal(survival.resourceRemaining, 0);
    assert.equal(survival.lightRemaining, 7);
    assert.ok(augur9.charge < ch1Augur9Initial().charge);
  });

  it("rejects drifting modern instruments and accepts the temple balance", () => {
    const survival = ch1InitialDungeonSurvivalState({
      dungeonId: "ch1_dungeon_desert",
      carried: { water: 12, light: 10 },
    });
    const wrong = ch1ApplyDungeonObjectiveMechanic({
      survival,
      augur9: ch1Augur9Initial(),
      stepId: "ch1_a3_d1_hall_of_weights",
      choice: "modern_scale_a",
      carryWeight: 10,
    });
    assert.equal(wrong.ok, false);
    assert.match(wrong.reason ?? "", /drifts/i);

    const right = ch1ApplyDungeonObjectiveMechanic({
      survival,
      augur9: ch1Augur9Initial(),
      stepId: "ch1_a3_d1_hall_of_weights",
      choice: "temple_balance",
      carryWeight: 10,
    });
    assert.equal(right.ok, true);
  });

  it("turns missing supplies into health/stamina loss rather than creating them", () => {
    const survival = ch1InitialDungeonSurvivalState({
      dungeonId: "ch1_dungeon_winter",
      carried: { fuel: 1 },
    });
    const result = ch1ApplyDungeonObjectiveMechanic({
      survival,
      augur9: ch1Augur9Initial(),
      stepId: "d2_ash_hall",
      choice: "feed_hearth",
      carryWeight: 20,
    });
    assert.equal(result.ok, true);
    assert.equal(result.survival.resourceRemaining, 0);
    assert.ok(result.effect.healthDamage >= 68);
    assert.ok(result.effect.staminaDelta < -14);
  });

  it("makes carry weight a hard Whale Road requirement, stricter on return", () => {
    const survival = ch1InitialDungeonSurvivalState({
      dungeonId: "ch1_dungeon_winter",
      carried: { fuel: 18 },
    });
    const outbound = ch1ApplyDungeonObjectiveMechanic({
      survival,
      augur9: ch1Augur9Initial(),
      stepId: "d2_whale_road",
      carryWeight: 56,
    });
    assert.equal(outbound.ok, false);
    assert.match(outbound.reason ?? "", /55 lb or less/);

    const returnTrip = ch1ApplyDungeonObjectiveMechanic({
      survival,
      augur9: ch1Augur9Initial(),
      stepId: "d2_the_breaking_year",
      carryWeight: 46,
    });
    assert.equal(returnTrip.ok, false);
    assert.match(returnTrip.reason ?? "", /45 lb or less/);
  });

  it("does not award the same native health/stamina consequence twice", () => {
    const triggerState = TriggerState.create({ by_root: new Map() });
    const health = { hp: 100, maxHp: 100 };
    const effect = {
      effectKey: "ch1_dungeon_desert/d1_salt_market",
      staminaDelta: -10,
      healthDamage: 8,
      resourceConsumes: { water: 2 } as const,
      outcome: "test",
    };
    const first = applyCh1DungeonNativeEffectForTest({
      triggerState,
      health,
      effect,
    });
    const second = applyCh1DungeonNativeEffectForTest({
      triggerState,
      health,
      effect,
    });
    assert.equal(first.applied, true);
    assert.equal(second.applied, false);
    assert.equal(health.hp, 92);
    assert.equal(first.vitals.stamina, 90);
    assert.equal(second.vitals.stamina, 90);
  });

  it("keeps signed portal admission when a dungeon consequence is applied", () => {
    const triggerState = TriggerState.create({ by_root: new Map() });
    const admission = {
      dungeonId: "ch1_dungeon_desert",
      runId: "run-1",
      partyId: "solo:1",
    };
    writeCh1NativeRunAdmission(triggerState, admission);

    applyCh1DungeonNativeEffectForTest({
      triggerState,
      health: { hp: 100, maxHp: 100 },
      effect: {
        effectKey: "ch1_dungeon_desert/d1_dune_threshold",
        staminaDelta: -8,
        healthDamage: 0,
        resourceConsumes: { water: 1 },
        outcome: "test",
      },
    });

    assert.deepEqual(readCh1NativeRunAdmission(triggerState), admission);
  });

  it("consumes heterogeneous real inventory stacks deterministically", () => {
    const items = {
      clean_water_flask: 2,
      water: 1,
      field_torch: 4,
      firewood: 3,
    };
    assert.deepEqual(ch1ProvisioningCarriedFromInventory(items), {
      water: 3,
      food: 0,
      cooked: 0,
      forage: 0,
      light: 4,
      repair_kit: 0,
      bandage: 0,
      fuel: 3,
      cold_gear: 0,
      rope: 0,
      iron: 0,
    });
    const result = ch1ConsumeProvisioningResourceFromInventory(
      items,
      "water",
      2
    );
    assert.equal(result.consumedCount, 2);
    assert.equal(result.missingCount, 0);
    assert.equal(items.clean_water_flask, undefined);
    assert.equal(items.water, 1);
  });

  it("recognizes canonical native b:<id> inventory spellings", () => {
    const items = {
      "b:8660732475922643": 12, // clean_water
      "b:8680649876498765": 18, // coal
      "b:8656273202062989": 10, // wall_lantern
    };
    const carried = ch1ProvisioningCarriedFromInventory(items);
    assert.equal(carried.water, 12);
    assert.equal(carried.fuel, 18);
    assert.equal(carried.light, 10);

    const consumed = ch1ConsumeProvisioningResourceFromInventory(
      items,
      "light",
      3
    );
    assert.equal(consumed.consumedCount, 3);
    assert.equal(items["b:8656273202062989"], 7);
  });
});
