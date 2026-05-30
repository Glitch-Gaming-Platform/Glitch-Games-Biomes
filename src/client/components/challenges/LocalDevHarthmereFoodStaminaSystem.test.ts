import assert from "assert";
import { HARTHMERE_FARMING_FOOD_STAMINA_VERSION_V1 } from "@/shared/harthmere/mmo_farming_food_stamina_v1";
import { normalizeFoodStaminaStateForTest } from "./LocalDevHarthmereFoodStaminaSystem";

describe("LocalDevHarthmereFoodStaminaSystem", () => {
  it("migrates old fast-drain zero-stamina saves back to a playable state", () => {
    const migrated = normalizeFoodStaminaStateForTest({
      actorId: "local-player",
      stamina: 0,
      maxStamina: 100,
      lastStaminaTickMs: 1_700_000_000_000,
      deadFromStaminaAtMs: 1_700_000_001_000,
      inventory: { road_ration: 1 },
      plots: {},
      spawns: {},
    });

    assert.equal(migrated.stateVersion, HARTHMERE_FARMING_FOOD_STAMINA_VERSION_V1);
    assert.equal(migrated.stamina, 100);
    assert.equal(migrated.deadFromStaminaAtMs, undefined);
    assert.equal(migrated.inventory.road_ration, 1);
    assert.deepEqual(migrated.livestock, {});
  });

  it("preserves current-version zero-stamina death state", () => {
    const migrated = normalizeFoodStaminaStateForTest({
      stateVersion: HARTHMERE_FARMING_FOOD_STAMINA_VERSION_V1,
      actorId: "local-player",
      stamina: 0,
      maxStamina: 100,
      lastStaminaTickMs: 1_700_000_000_000,
      deadFromStaminaAtMs: 1_700_000_001_000,
      inventory: {},
      plots: {},
      spawns: {},
    });

    assert.equal(migrated.stamina, 0);
    assert.equal(migrated.deadFromStaminaAtMs, 1_700_000_001_000);
    assert.deepEqual(migrated.livestock, {});
  });

  it("repairs current-version zero-stamina playable saves without a death marker", () => {
    const migrated = normalizeFoodStaminaStateForTest({
      stateVersion: HARTHMERE_FARMING_FOOD_STAMINA_VERSION_V1,
      actorId: "local-player",
      stamina: 0,
      maxStamina: 100,
      lastStaminaTickMs: 1_700_000_000_000,
      inventory: {},
      plots: {},
      spawns: {},
    });

    assert.equal(migrated.stamina, 100);
    assert.equal(migrated.deadFromStaminaAtMs, undefined);
    assert.ok(migrated.lastStaminaTickMs > 1_700_000_000_000);
  });
});
