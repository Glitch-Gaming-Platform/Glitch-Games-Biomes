import { hasActiveHarthmereHardBossQuestForTest } from "@/pages/api/harthmere/native_combat_boss";
import {
  migrateHarthmereLegacyCombatEquipmentForTest,
  migrateHarthmereLegacyInventoryForTest,
  migrateHarthmereLegacyMaterialStorageForTest,
  migrateHarthmereLegacyRecipeBookForTest,
} from "@/pages/api/harthmere/native_combat_sync";
import { applyHarthmereNativeVitalsHeartbeatForTest } from "@/pages/api/harthmere/native_vitals";
import { BikkieRuntime } from "@/shared/bikkie/active";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  Inventory,
  HarthmereMaterialStorage,
  RecipeBook,
  TriggerState,
  Wearing,
} from "@/shared/ecs/gen/components";
import {
  ensureHarthmereNativeItemCatalogue,
  harthmereBiscuitForItemDefinition,
  harthmereNativeBiomesIdForItemId,
  harthmereNativeRecipeBiscuit,
} from "@/shared/harthmere/harthmere_native_bikkie_items";
import { listHarthmereCraftingRecipes } from "@/shared/harthmere/mmo_inventory_authority";
import assert from "assert";
import { writeHarthmereNativeVitals } from "@/shared/harthmere/harthmere_native_vitals";
import {
  harthmereStatusProjectionIsStaleForTest,
  replaceNativeGoldCurrencyForTest,
} from "@/server/harthmere/native_vitals";
import { bagCount, countOf } from "@/shared/game/items";

describe("native combat API migration helpers", () => {
  before(() => {
    const definitions = ensureHarthmereNativeItemCatalogue();
    const fixtures = new Map();
    for (const itemId of ["iron_longsword", "leather_armor", "wooden_shield"]) {
      const definition = definitions.find((entry) => entry.itemId === itemId)!;
      const biscuit = harthmereBiscuitForItemDefinition(definition);
      fixtures.set(biscuit.id, biscuit);
    }
    const recipe = listHarthmereCraftingRecipes().find(
      (candidate) =>
        !candidate.workflowKind || candidate.workflowKind === "craft"
    )!;
    const recipeBiscuit = harthmereNativeRecipeBiscuit(recipe)!;
    fixtures.set(recipeBiscuit.id, recipeBiscuit);
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

  it("additively migrates the legacy backpack and overflow exactly once", () => {
    const itemId = harthmereNativeBiomesIdForItemId("iron_longsword")!;
    const inventory = Inventory.create({
      items: new Array(8),
      hotbar: [countOf(itemId, 1n)],
    });
    const first = migrateHarthmereLegacyInventoryForTest({
      inventory,
      items: { iron_longsword: 3 },
      overflow: [{ itemId: "iron_longsword", count: 2 }],
    });
    assert.equal(first.addedCount, 4n);
    assert.deepEqual(first.unresolvedItemIds, []);

    const second = migrateHarthmereLegacyInventoryForTest({
      inventory,
      items: { iron_longsword: 3 },
      overflow: [{ itemId: "iron_longsword", count: 2 }],
    });
    assert.equal(second.addedCount, 0n);
    assert.deepEqual(second.unresolvedItemIds, []);
    const total = [...inventory.items, ...inventory.hotbar].reduce(
      (count, slot) =>
        count + (slot?.item.id === itemId ? Number(slot.count) : 0),
      0
    );
    assert.equal(total, 5);
  });

  it("migrates compatible recipe ownership into native RecipeBook once", () => {
    const compatible = listHarthmereCraftingRecipes().find(
      (candidate) =>
        !candidate.workflowKind || candidate.workflowKind === "craft"
    )!;
    const customWorkflow = listHarthmereCraftingRecipes().find(
      (candidate) =>
        candidate.workflowKind && candidate.workflowKind !== "craft"
    );
    const recipeBook = RecipeBook.create();
    const first = migrateHarthmereLegacyRecipeBookForTest({
      recipeBook,
      knownRecipeIds: [
        compatible.recipeId,
        ...(customWorkflow ? [customWorkflow.recipeId] : []),
        "dynamic_event_recipe",
      ],
    });
    assert.equal(first.addedCount, 1);
    assert.deepEqual(first.unresolvedRecipeIds, []);

    const second = migrateHarthmereLegacyRecipeBookForTest({
      recipeBook,
      knownRecipeIds: [compatible.recipeId],
    });
    assert.equal(second.addedCount, 0);
    assert.equal(recipeBook.recipes.size, 1);
  });

  it("migrates every legacy bank vault into the player ECS component", () => {
    const storage = HarthmereMaterialStorage.create({ max_slots: 1 });
    const first = migrateHarthmereLegacyMaterialStorageForTest({
      storage,
      items: { iron_longsword: 3 },
      maxSlots: 24,
      personalItems: { leather_armor: 2 },
      personalMaxSlots: 30,
      accountItems: { wooden_shield: 4 },
      accountMaxSlots: 48,
    });
    assert.equal(first.addedCount, 9n);
    assert.deepEqual(first.unresolvedItemIds, []);
    assert.equal(storage.max_slots, 24);
    assert.equal(storage.personal_max_slots, 30);
    assert.equal(storage.account_max_slots, 48);
    assert.equal(
      bagCount(storage.personal_items, {
        id: harthmereNativeBiomesIdForItemId("leather_armor")!,
      }),
      2n
    );
    assert.equal(
      bagCount(storage.account_items, {
        id: harthmereNativeBiomesIdForItemId("wooden_shield")!,
      }),
      4n
    );

    const second = migrateHarthmereLegacyMaterialStorageForTest({
      storage,
      items: { iron_longsword: 3 },
      maxSlots: 24,
      personalItems: { leather_armor: 2 },
      personalMaxSlots: 30,
      accountItems: { wooden_shield: 4 },
      accountMaxSlots: 48,
    });
    assert.equal(second.addedCount, 0n);
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
