import { TriggerState } from "@/shared/ecs/gen/components";
import { anItem } from "@/shared/game/item";
import {
  ensureHarthmereNativeItemCatalogue,
  harthmereBiscuitForItemDefinition,
  harthmereNativeBiomesIdForItemId,
} from "@/shared/harthmere/harthmere_native_bikkie_items";
import {
  applyHarthmereNativeConsumableToVitals,
  HARTHMERE_NATIVE_DROWNING_DAMAGE_PER_SECOND,
  HARTHMERE_NATIVE_MAX_BREATH_SECONDS,
  HARTHMERE_NATIVE_VITALS_MIGRATION_VERSION,
  harthmereNativeConsumableProfile,
  readHarthmereNativeVitals,
  restoreHarthmereNativeVitalsForRespawn,
  tickHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import { HARTHMERE_FOOD_DEFINITIONS } from "@/shared/harthmere/mmo_farming_food_stamina";
import { HARTHMERE_MEDICAL_ITEM_DEFINITIONS } from "@/shared/harthmere/mmo_medical_health";
import { getHarthmereItemDefinition } from "@/shared/harthmere/mmo_inventory_authority";
import assert from "assert";

describe("Harthmere native ECS vitals", () => {
  before(() => ensureHarthmereNativeItemCatalogue());

  it("stores and clamps mana, stamina, breath, and social standing in TriggerState", () => {
    const state = TriggerState.create();
    writeHarthmereNativeVitals(state, {
      maxMana: 120,
      mana: 140,
      maxStamina: 90,
      stamina: -10,
      maxBreath: HARTHMERE_NATIVE_MAX_BREATH_SECONDS,
      breath: 20,
      likeability: 40,
      legal: -12,
      notoriety: 8,
      notorietyFloor: 10,
      standingScopeId: "harthmere",
      migrationVersion: HARTHMERE_NATIVE_VITALS_MIGRATION_VERSION,
      statusProjectionUpdatedAtMs: 0,
    });

    assert.deepEqual(readHarthmereNativeVitals(state), {
      mana: 120,
      maxMana: 120,
      stamina: 0,
      maxStamina: 90,
      breath: 20,
      maxBreath: HARTHMERE_NATIVE_MAX_BREATH_SECONDS,
      lastTickMs: 0,
      underwater: false,
      likeability: 40,
      legal: -12,
      notoriety: 10,
      notorietyFloor: 10,
      standingScopeId: "harthmere",
      migrationVersion: HARTHMERE_NATIVE_VITALS_MIGRATION_VERSION,
      statusProjectionUpdatedAtMs: 0,
    });
  });

  it("adds thirty seconds of breath to existing native-vitals records", () => {
    const state = TriggerState.create();
    writeHarthmereNativeVitals(state, {
      maxBreath: 15,
      breath: 15,
      migrationVersion: 1,
    });
    // Recreate the legacy values because current writes always stamp the
    // current migration version.
    const values = state.by_root.values().next().value!;
    const numericEntries = [...values.entries()];
    const maxBreathEntry = numericEntries.find(([, value]) => value === 45);
    assert.ok(maxBreathEntry);
    values.set(maxBreathEntry[0], 15);
    const migrationEntry = numericEntries.find(([, value]) => value === 2);
    assert.ok(migrationEntry);
    values.set(migrationEntry[0], 1);
    const migrated = readHarthmereNativeVitals(state);
    assert.equal(migrated.maxBreath, 45);
    assert.equal(migrated.breath, 45);
  });

  it("drains 100 stamina over two hours of active gameplay only", () => {
    const state = TriggerState.create();
    writeHarthmereNativeVitals(state, {
      stamina: 100,
      maxStamina: 100,
      lastTickMs: 1,
    });
    const oneHour = tickHarthmereNativeVitals(state, {
      nowMs: 60 * 60 * 1000 + 1,
      gameplayActive: true,
      underwater: false,
      alive: true,
      maxElapsedMs: 60 * 60 * 1000,
    });
    assert.ok(Math.abs(oneHour.vitals.stamina - 50) < 0.0001);

    const paused = tickHarthmereNativeVitals(state, {
      nowMs: 2 * 60 * 60 * 1000 + 1,
      gameplayActive: false,
      underwater: false,
      alive: true,
      maxElapsedMs: 60 * 60 * 1000,
    });
    assert.ok(Math.abs(paused.vitals.stamina - 50) < 0.0001);
  });

  it("uses breath first and then rapidly damages health while submerged", () => {
    const state = TriggerState.create();
    writeHarthmereNativeVitals(state, {
      breath: 1,
      maxBreath: HARTHMERE_NATIVE_MAX_BREATH_SECONDS,
      stamina: 100,
      lastTickMs: 1_000,
    });
    const result = tickHarthmereNativeVitals(state, {
      nowMs: 3_000,
      gameplayActive: true,
      underwater: true,
      alive: true,
    });
    assert.equal(result.vitals.breath, 0);
    assert.equal(result.damage, HARTHMERE_NATIVE_DROWNING_DAMAGE_PER_SECOND);
    assert.equal(result.deathCause, "drowning");
  });

  it("gives every edible food an exact stamina amount and leaves raw food unusable", () => {
    for (const food of Object.values(HARTHMERE_FOOD_DEFINITIONS)) {
      const id = harthmereNativeBiomesIdForItemId(food.itemId);
      assert.ok(id, `${food.itemId} has no native item id`);
      const profile = harthmereNativeConsumableProfile(anItem(id));
      const definition = getHarthmereItemDefinition(food.itemId);
      assert.ok(definition, `${food.itemId} has no item definition`);
      const biscuit = harthmereBiscuitForItemDefinition(definition);
      if (food.edible === false) {
        assert.equal(
          biscuit.isConsumable,
          undefined,
          `${food.itemId} must not expose an eat action`
        );
      } else {
        assert.ok(profile, `${food.itemId} has no recovery profile`);
        assert.equal(profile.staminaRestore, food.staminaRestore);
        assert.ok(
          profile.staminaRestore > 0,
          `${food.itemId} restores no stamina`
        );
        assert.equal(biscuit.isConsumable, true);
      }
    }
  });

  it("maps every health item and the mana draught to native recovery", () => {
    for (const medical of Object.values(HARTHMERE_MEDICAL_ITEM_DEFINITIONS)) {
      const profile = harthmereNativeConsumableProfile(
        anItem(harthmereNativeBiomesIdForItemId(medical.itemId)!)
      );
      assert.ok(profile, `${medical.itemId} has no native consumable profile`);
      assert.equal(profile.healthRestore, medical.healthRestore);
    }
    const mana = harthmereNativeConsumableProfile(
      anItem(harthmereNativeBiomesIdForItemId("mana_draught")!)
    );
    assert.ok(mana);
    assert.equal(mana.action, "drink");
    assert.equal(mana.manaRestore, 35);
  });

  it("caps consumable recovery and restores every survival resource on Grove respawn", () => {
    const state = TriggerState.create();
    writeHarthmereNativeVitals(state, {
      mana: 80,
      maxMana: 100,
      stamina: 90,
      maxStamina: 100,
      breath: 0,
      maxBreath: HARTHMERE_NATIVE_MAX_BREATH_SECONDS,
    });
    applyHarthmereNativeConsumableToVitals(state, {
      itemId: "feast_and_draught",
      staminaRestore: 50,
      manaRestore: 50,
      healthRestore: 0,
      action: "drink",
    });
    assert.equal(readHarthmereNativeVitals(state).stamina, 100);
    assert.equal(readHarthmereNativeVitals(state).mana, 100);

    writeHarthmereNativeVitals(state, { stamina: 0, mana: 0, breath: 0 });
    const restored = restoreHarthmereNativeVitalsForRespawn(state, 42);
    assert.equal(restored.stamina, restored.maxStamina);
    assert.equal(restored.mana, restored.maxMana);
    assert.equal(restored.breath, restored.maxBreath);
    assert.equal(restored.lastTickMs, 42);
  });
});
