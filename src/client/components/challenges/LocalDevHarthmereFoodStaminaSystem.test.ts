import assert from "assert";
import {
  HARTHMERE_FARMING_FOOD_STAMINA_VERSION,
  defaultHarthmereFoodStaminaState,
  tickHarthmereStaminaForGameplay,
} from "@/shared/harthmere/mmo_farming_food_stamina";
import {
  carriedHarthmereLocalInventoryFromStorageValuesForStamina,
  carriedHarthmereLocalInventoryForStamina,
  normalizeFoodStaminaStateForTest,
} from "./LocalDevHarthmereFoodStaminaSystem";

const NOW_MS = 1_700_000_000_000;

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

    assert.equal(migrated.stateVersion, HARTHMERE_FARMING_FOOD_STAMINA_VERSION);
    assert.equal(migrated.stamina, 100);
    assert.equal(migrated.deadFromStaminaAtMs, undefined);
    assert.equal(migrated.inventory.road_ration, 1);
    assert.deepEqual(migrated.livestock, {});
  });

  it("preserves current-version zero-stamina death state", () => {
    const migrated = normalizeFoodStaminaStateForTest({
      stateVersion: HARTHMERE_FARMING_FOOD_STAMINA_VERSION,
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
      stateVersion: HARTHMERE_FARMING_FOOD_STAMINA_VERSION,
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

  it("uses local carried inventory when applying overweight stamina drain", () => {
    const carried = carriedHarthmereLocalInventoryForStamina({
      backpack: {
        items: [
          { itemId: "iron_longsword", quantity: 2 },
          { itemId: "road_ration", quantity: 5 },
        ],
      },
      materialStorage: {
        iron_ore: 10,
        fresh_egg: 0,
      },
    });

    assert.deepEqual(carried, {
      iron_longsword: 2,
      road_ration: 5,
      iron_ore: 10,
    });

    const baseline = defaultHarthmereFoodStaminaState(
      "local-player",
      NOW_MS
    );
    const baselineTick = tickHarthmereStaminaForGameplay(baseline, {
      nowMs: NOW_MS + 60_000,
      gameplayActive: true,
    });
    const overweightTick = tickHarthmereStaminaForGameplay(
      {
        ...baseline,
        inventory: carried ?? baseline.inventory,
      },
      {
        nowMs: NOW_MS + 60_000,
        gameplayActive: true,
      }
    );

    assert.ok(
      overweightTick.state.stamina < baselineTick.state.stamina,
      `expected overweight stamina ${overweightTick.state.stamina} below baseline ${baselineTick.state.stamina}`
    );
  });

  it("reads the scoped inventory storage before the legacy key for stamina drain", () => {
    const scoped = JSON.stringify({
      backpack: {
        items: [{ itemId: "iron_longsword", quantity: 3 }],
      },
      materialStorage: {
        raw_meat: 12,
      },
    });
    const legacy = JSON.stringify({
      backpack: {
        items: [{ itemId: "road_ration", quantity: 1 }],
      },
    });

    assert.deepEqual(
      carriedHarthmereLocalInventoryFromStorageValuesForStamina(
        scoped,
        legacy
      ),
      {
        iron_longsword: 3,
        raw_meat: 12,
      }
    );
    assert.deepEqual(
      carriedHarthmereLocalInventoryFromStorageValuesForStamina(
        "{not-json",
        legacy
      ),
      {
        road_ration: 1,
      }
    );
  });
});
