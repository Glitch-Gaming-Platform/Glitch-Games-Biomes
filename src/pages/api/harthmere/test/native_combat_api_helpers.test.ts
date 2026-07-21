import { hasActiveHarthmereHardBossQuestForTest } from "@/pages/api/harthmere/native_combat_boss";
import { migrateHarthmereLegacyCombatEquipmentForTest } from "@/pages/api/harthmere/native_combat_sync";
import { applyHarthmereNativeVitalsHeartbeatForTest } from "@/pages/api/harthmere/native_vitals";
import { BikkieRuntime } from "@/shared/bikkie/active";
import { BikkieIds } from "@/shared/bikkie/ids";
import { Inventory, TriggerState, Wearing } from "@/shared/ecs/gen/components";
import {
  ensureHarthmereNativeItemCatalogue,
  harthmereBiscuitForItemDefinition,
  harthmereNativeBiomesIdForItemId,
} from "@/shared/harthmere/harthmere_native_bikkie_items";
import assert from "assert";
import { writeHarthmereNativeVitals } from "@/shared/harthmere/harthmere_native_vitals";
import {
  harthmereStatusProjectionIsStaleForTest,
  replaceNativeGoldCurrencyForTest,
} from "@/server/harthmere/native_vitals";

describe("native combat API migration helpers", () => {
  before(() => {
    const definitions = ensureHarthmereNativeItemCatalogue();
    const fixtures = new Map();
    for (const itemId of ["iron_longsword", "leather_armor", "wooden_shield"]) {
      const definition = definitions.find((entry) => entry.itemId === itemId)!;
      const biscuit = harthmereBiscuitForItemDefinition(definition);
      fixtures.set(biscuit.id, biscuit);
    }
    BikkieRuntime.get().registerBiscuits(fixtures);
  });

  it("moves legacy equipment once into native selected-item and Wearing slots", () => {
    const inventory = Inventory.create({
      items: new Array(4),
      hotbar: new Array(4),
    });
    const wearing = Wearing.create();
    const selected = migrateHarthmereLegacyCombatEquipmentForTest({
      inventory,
      wearing,
      equipment: {
        main_hand: "iron_longsword",
        chest: "leather_armor",
        off_hand: "wooden_shield",
      },
    });

    assert.deepEqual(selected, { kind: "hotbar", idx: 0 });
    assert.equal(
      inventory.hotbar[0]?.item.id,
      harthmereNativeBiomesIdForItemId("iron_longsword")
    );
    assert.equal(
      wearing.items.get(BikkieIds.top)?.id,
      harthmereNativeBiomesIdForItemId("leather_armor")
    );
    assert.equal(
      wearing.items.get(BikkieIds.hands)?.id,
      harthmereNativeBiomesIdForItemId("wooden_shield")
    );

    const second = migrateHarthmereLegacyCombatEquipmentForTest({
      inventory,
      wearing,
      equipment: { main_hand: "iron_longsword" },
    });
    assert.deepEqual(second, selected);
    assert.equal(
      inventory.hotbar.filter(
        (slot) =>
          slot?.item.id === harthmereNativeBiomesIdForItemId("iron_longsword")
      ).length,
      1
    );
  });

  it("requires a real active hard-boss quest before materialization", () => {
    assert.equal(hasActiveHarthmereHardBossQuestForTest({}), false);
    assert.equal(
      hasActiveHarthmereHardBossQuestForTest({
        q: { questKind: "hard_boss", title: "A Worthy Foe" },
      }),
      true
    );
    assert.equal(
      hasActiveHarthmereHardBossQuestForTest({
        q: { questKind: "food_water", title: "Road Supplies" },
      }),
      false
    );
  });

  it("projects committed gold exactly, including a zero balance", () => {
    const inventory = Inventory.create();
    replaceNativeGoldCurrencyForTest(inventory, 42.9);
    assert.equal(inventory.currencies.get(String(BikkieIds.bling))?.count, 42n);
    replaceNativeGoldCurrencyForTest(inventory, 0);
    assert.equal(inventory.currencies.has(String(BikkieIds.bling)), false);
  });

  it("does not let an older committed status callback replace a newer ECS projection", () => {
    assert.equal(harthmereStatusProjectionIsStaleForTest(99, 100), true);
    assert.equal(harthmereStatusProjectionIsStaleForTest(100, 100), false);
    assert.equal(harthmereStatusProjectionIsStaleForTest(101, 100), false);
  });

  it("kills at zero stamina and applies drowning only after breath is empty", () => {
    const exhausted = TriggerState.create();
    writeHarthmereNativeVitals(exhausted, {
      stamina: 0.001,
      maxStamina: 100,
      lastTickMs: 1,
    });
    const starvation = applyHarthmereNativeVitalsHeartbeatForTest({
      triggerState: exhausted,
      health: { hp: 100, maxHp: 100 },
      nowMs: 10_001,
      gameplayActive: true,
      underwater: false,
    });
    assert.equal(starvation.deathCause, "stamina");
    assert.equal(starvation.hp, 0);

    const submerged = TriggerState.create();
    writeHarthmereNativeVitals(submerged, {
      breath: 1,
      maxBreath: 15,
      stamina: 100,
      lastTickMs: 1_000,
    });
    const drowning = applyHarthmereNativeVitalsHeartbeatForTest({
      triggerState: submerged,
      health: { hp: 4, maxHp: 100 },
      nowMs: 3_000,
      gameplayActive: true,
      underwater: true,
    });
    assert.equal(drowning.damage, 5);
    assert.equal(drowning.deathCause, "drowning");
    assert.equal(drowning.hp, 0);
  });
});
