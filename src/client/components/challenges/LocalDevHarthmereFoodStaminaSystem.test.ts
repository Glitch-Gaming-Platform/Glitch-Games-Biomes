import assert from "assert";
import {
  HARTHMERE_FARMING_FOOD_STAMINA_VERSION,
  defaultHarthmereFoodStaminaState,
  tickHarthmereStaminaForGameplay,
} from "@/shared/harthmere/mmo_farming_food_stamina";
import {
  carriedHarthmereLocalInventoryFromStorageValuesForStamina,
  carriedHarthmereLocalInventoryForStamina,
  HARTHMERE_CAMPFIRE_WARMTH_HEAL_AMOUNT,
  HARTHMERE_CAMPFIRE_WARMTH_TICK_MS,
  HARTHMERE_STAMINA_GAMEPLAY_TICK_MS,
  harthmereCampfireWarmthHealDecisionForTest,
  harthmereClientStaminaTickPlanForTest,
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

  it("drains survival stamina on the visible five-second gameplay cadence", () => {
    assert.equal(HARTHMERE_STAMINA_GAMEPLAY_TICK_MS, 5_000);

    const baseline = defaultHarthmereFoodStaminaState("local-player", NOW_MS);
    const tick = tickHarthmereStaminaForGameplay(baseline, {
      nowMs: NOW_MS + HARTHMERE_STAMINA_GAMEPLAY_TICK_MS,
      gameplayActive: true,
    });

    assert.ok(
      tick.state.stamina < baseline.stamina,
      `expected five-second tick to drain stamina from ${baseline.stamina}, got ${tick.state.stamina}`
    );
  });

  it("heals one HP per campfire warmth tick only while alive, damaged, and near fire", () => {
    assert.equal(HARTHMERE_CAMPFIRE_WARMTH_TICK_MS, 5_000);

    const heal = harthmereCampfireWarmthHealDecisionForTest({
      nearWarmth: true,
      gameplayActive: true,
      hp: 73,
      maxHp: 100,
      combatState: "idle",
    });
    assert.equal(heal.shouldHeal, true);
    assert.equal(heal.amount, HARTHMERE_CAMPFIRE_WARMTH_HEAL_AMOUNT);

    assert.equal(
      harthmereCampfireWarmthHealDecisionForTest({
        nearWarmth: true,
        gameplayActive: true,
        hp: 0,
        maxHp: 100,
        combatState: "dead",
      }).amount,
      0
    );
    assert.equal(
      harthmereCampfireWarmthHealDecisionForTest({
        nearWarmth: false,
        gameplayActive: true,
        hp: 73,
        maxHp: 100,
        combatState: "idle",
      }).amount,
      0
    );
    assert.equal(
      harthmereCampfireWarmthHealDecisionForTest({
        nearWarmth: true,
        gameplayActive: true,
        hp: 100,
        maxHp: 100,
        combatState: "idle",
      }).amount,
      0
    );
  });

  it("lets the client simulate stamina only when no live server snapshot is present", () => {
    // Offline / local-dev: the client sim is the sole authority and simulates.
    assert.equal(
      harthmereClientStaminaTickPlanForTest({
        liveSnapshotPresent: false,
        stamina: 40,
      }),
      "client_simulates"
    );
    // Live + alive: server owns stamina; client only keeps its clock current so
    // it never accrues a phantom drain backlog for a later offline transition.
    assert.equal(
      harthmereClientStaminaTickPlanForTest({
        liveSnapshotPresent: true,
        stamina: 40,
      }),
      "server_owns_keep_clock"
    );
    // Live + already zero/dead locally: do nothing (never trigger a second,
    // client-side starvation death — the "kills you twice" dual-source bug).
    assert.equal(
      harthmereClientStaminaTickPlanForTest({
        liveSnapshotPresent: true,
        stamina: 0,
      }),
      "server_owns_frozen"
    );
    assert.equal(
      harthmereClientStaminaTickPlanForTest({
        liveSnapshotPresent: true,
        stamina: 40,
        deadFromStaminaAtMs: NOW_MS,
      }),
      "server_owns_frozen"
    );
  });

  it("suppresses the client campfire heal while the server owns HP (live snapshot present)", () => {
    const damaged = {
      nearWarmth: true,
      gameplayActive: true,
      hp: 73,
      maxHp: 100,
      combatState: "idle",
    };
    // Offline: client heals (sole HP authority).
    assert.equal(
      harthmereCampfireWarmthHealDecisionForTest({
        ...damaged,
        liveSnapshotPresent: false,
      }).shouldHeal,
      true
    );
    // Live: server owns HP, so the client heal is suppressed.
    const live = harthmereCampfireWarmthHealDecisionForTest({
      ...damaged,
      liveSnapshotPresent: true,
    });
    assert.equal(live.shouldHeal, false);
    assert.equal(live.amount, 0);
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
