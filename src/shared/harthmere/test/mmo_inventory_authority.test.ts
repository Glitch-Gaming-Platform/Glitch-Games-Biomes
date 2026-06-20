/**
 * mmo_inventory_authority.test.ts
 *
 * Comprehensive tests for server-authoritative inventory validation.
 * Covers base cases and edge cases for every mutation kind.
 */

import assert from "assert";
import {
  applyHarthmereInventoryMutationResult,
  countInventorySlots,
  getHarthmereItemDefinition,
  getHarthmereVendorEntry,
  HARTHMERE_BANK_SLOTS,
  HARTHMERE_DEFAULT_INVENTORY_SLOTS,
  inventoryHasCapacity,
  isConsumableOnCooldown,
  availableCount,
  reduceHarthmereInventoryMutation,
  registerHarthmereCraftingRecipe,
  registerHarthmereItemDefinition,
  registerHarthmereVendorEntry,
  type HarthmereInventoryMutationContext,
  type HarthmereInventoryMutationRequest,
  type HarthmereInventorySnapshot,
  type HarthmereItemDefinition,
} from "../mmo_inventory_authority";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeItem(
  overrides: Partial<HarthmereItemDefinition> = {}
): HarthmereItemDefinition {
  return {
    itemId: "iron_sword",
    displayName: "Iron Sword",
    maxStackSize: 1,
    baseValue: 100,
    binding: "none",
    isQuestItem: false,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: false,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: { attack: 10 },
    tradeable: true,
    ...overrides,
  };
}

function makeSnapshot(
  overrides: Partial<HarthmereInventorySnapshot> = {}
): HarthmereInventorySnapshot {
  return {
    actorId: "player_1",
    gold: 500,
    equipment: {},
    items: {},
    bank: {},
    escrow: {},
    consumableCooldowns: {},
    knownAbilities: [],
    knownRecipes: [],
    ...overrides,
  };
}

function makeCtx(
  snapshot: HarthmereInventorySnapshot,
  overrides: Partial<HarthmereInventoryMutationContext> = {}
): HarthmereInventoryMutationContext {
  return {
    snapshot,
    playerLevel: 10,
    playerSkills: {},
    reputation: {},
    ...overrides,
  };
}

function makeReq(
  overrides: Partial<HarthmereInventoryMutationRequest> = {}
): HarthmereInventoryMutationRequest {
  return {
    requestId: "req_1",
    actorId: "player_1",
    kind: "buy_from_vendor",
    ...overrides,
  } as HarthmereInventoryMutationRequest;
}

// Register test catalogue entries once
before(() => {
  registerHarthmereItemDefinition(makeItem({ itemId: "iron_sword" }));
  registerHarthmereItemDefinition(
    makeItem({
      itemId: "health_potion",
      maxStackSize: 20,
      baseValue: 25,
      isConsumable: true,
      consumableCooldownCategory: "potion",
      consumableCooldownMs: 30_000,
    })
  );
  registerHarthmereItemDefinition(
    makeItem({
      itemId: "fire_tome",
      isSpellTome: true,
      grantsAbilityId: "fireball",
      levelRequirement: 5,
      baseValue: 200,
    })
  );
  registerHarthmereItemDefinition(
    makeItem({
      itemId: "quest_relic",
      isQuestItem: true,
      binding: "quest",
      tradeable: false,
      baseValue: 0,
    })
  );
  registerHarthmereItemDefinition(
    makeItem({
      itemId: "bound_armor",
      binding: "on_pickup",
      tradeable: false,
      baseValue: 300,
    })
  );
  registerHarthmereItemDefinition(
    makeItem({
      itemId: "iron_ore",
      maxStackSize: 200,
      baseValue: 5,
      isCraftingMaterial: true,
    })
  );
  registerHarthmereItemDefinition(
    makeItem({
      itemId: "iron_ingot",
      maxStackSize: 100,
      baseValue: 12,
      isCraftingMaterial: true,
    })
  );
  registerHarthmereItemDefinition(
    makeItem({
      itemId: "gold_coin",
      maxStackSize: 9999,
      baseValue: 1,
      isCurrency: true,
      stats: {},
    })
  );

  // One entry per vendor+item pair
  registerHarthmereVendorEntry({
    vendorId: "blacksmith",
    itemId: "iron_sword",
    buyPrice: 120,
    sellPrice: 60,
    stock: 5,
    requiredFaction: "city_guard",
    requiredReputationTier: 0,
  });
  registerHarthmereVendorEntry({
    vendorId: "blacksmith",
    itemId: "health_potion",
    buyPrice: 30,
    sellPrice: 12,
    stock: -1,
    requiredFaction: "city_guard",
    requiredReputationTier: 0,
  });
  registerHarthmereVendorEntry({
    vendorId: "restricted_vendor",
    itemId: "iron_sword",
    buyPrice: 200,
    sellPrice: 100,
    stock: 1,
    requiredFaction: "noble_guild",
    requiredReputationTier: 5,
  });

  registerHarthmereCraftingRecipe({
    recipeId: "smelt_iron",
    outputItemId: "iron_ingot",
    outputCount: 1,
    inputs: [{ itemId: "iron_ore", count: 3 }],
    requiredSkillId: "smithing",
    requiredSkillLevel: 1,
    requiredLevel: 1,
    craftingTimeMs: 1000,
    xpReward: 10,
  });
});

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

describe("Inventory utilities", () => {
  it("countInventorySlots counts distinct item types", () => {
    assert.strictEqual(countInventorySlots({}), 0);
    assert.strictEqual(countInventorySlots({ iron_sword: 1 }), 1);
    assert.strictEqual(
      countInventorySlots({ iron_sword: 1, health_potion: 5 }),
      2
    );
    assert.strictEqual(
      countInventorySlots({ iron_sword: 0, health_potion: -1, iron_ore: 3 }),
      1
    );
  });

  it("inventoryHasCapacity returns true when under limit", () => {
    const items: Record<string, number> = {};
    for (let i = 0; i < HARTHMERE_DEFAULT_INVENTORY_SLOTS - 1; i++) {
      items[`item_${i}`] = 1;
    }
    assert.ok(inventoryHasCapacity(items, 1));
  });

  it("inventoryHasCapacity returns false when at limit", () => {
    const items: Record<string, number> = {};
    for (let i = 0; i < HARTHMERE_DEFAULT_INVENTORY_SLOTS; i++) {
      items[`item_${i}`] = 1;
    }
    assert.ok(!inventoryHasCapacity(items, 1));
  });

  it("isConsumableOnCooldown uses server clock, not client", () => {
    const now = Date.now();
    assert.ok(
      isConsumableOnCooldown(
        makeSnapshot({ consumableCooldowns: { potion: now + 10_000 } }),
        "potion",
        now
      )
    );
    assert.ok(
      !isConsumableOnCooldown(
        makeSnapshot({ consumableCooldowns: { potion: now - 1 } }),
        "potion",
        now
      )
    );
    assert.ok(
      !isConsumableOnCooldown(
        makeSnapshot({ consumableCooldowns: {} }),
        "potion",
        now
      )
    );
  });

  it("availableCount excludes escrowed items", () => {
    assert.strictEqual(
      availableCount(
        makeSnapshot({ items: { iron_sword: 2 }, escrow: { iron_sword: 1 } }),
        "iron_sword"
      ),
      1
    );
    assert.strictEqual(
      availableCount(
        makeSnapshot({ items: { iron_sword: 1 }, escrow: { iron_sword: 1 } }),
        "iron_sword"
      ),
      0
    );
    assert.strictEqual(
      availableCount(
        makeSnapshot({ items: { iron_sword: 1 }, escrow: {} }),
        "iron_sword"
      ),
      1
    );
    assert.strictEqual(
      availableCount(makeSnapshot({ items: {}, escrow: {} }), "iron_sword"),
      0
    );
  });
});

// ---------------------------------------------------------------------------
// Vendor buy
// ---------------------------------------------------------------------------

describe("Vendor buy", () => {
  it("succeeds for basic purchase with enough gold", () => {
    const snap = makeSnapshot({ gold: 200 });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "buy_from_vendor",
      vendorId: "blacksmith",
      itemId: "iron_sword",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(
      result.ok,
      `expected ok but got errors: ${result.errors?.join(", ")}`
    );
    assert.ok(result.goldDelta < 0, "buying should cost gold");
    assert.ok(
      (result.itemDeltas["iron_sword"] ?? 0) > 0,
      "should receive item"
    );
  });

  it("fails when player cannot afford it", () => {
    const snap = makeSnapshot({ gold: 10 });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "buy_from_vendor",
      vendorId: "blacksmith",
      itemId: "iron_sword",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some((e) => e.includes("gold")));
  });

  it("fails when vendor or item not found", () => {
    const snap = makeSnapshot({ gold: 9999 });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "buy_from_vendor",
      vendorId: "nonexistent",
      itemId: "iron_sword",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
  });

  it("fails when reputation is insufficient", () => {
    const snap = makeSnapshot({ gold: 5000 });
    const ctx = makeCtx(snap, { reputation: { noble_guild: 2 } });
    const req = makeReq({
      kind: "buy_from_vendor",
      vendorId: "restricted_vendor",
      itemId: "iron_sword",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some((e) => e.includes("reputation")));
  });

  it("succeeds when reputation requirement is met", () => {
    const snap = makeSnapshot({ gold: 5000 });
    const ctx = makeCtx(snap, { reputation: { noble_guild: 5 } });
    const req = makeReq({
      kind: "buy_from_vendor",
      vendorId: "restricted_vendor",
      itemId: "iron_sword",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
  });

  it("rejects buying 0 or negative count", () => {
    const snap = makeSnapshot({ gold: 9999 });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "buy_from_vendor",
      vendorId: "blacksmith",
      itemId: "iron_sword",
      count: 0,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
  });

  it("rejects buying more than stock allows", () => {
    const snap = makeSnapshot({ gold: 9999 });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "buy_from_vendor",
      vendorId: "blacksmith",
      itemId: "iron_sword",
      count: 99,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
  });

  it("succeeds buying unlimited-stock item in large quantity", () => {
    const snap = makeSnapshot({ gold: 9999 });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "buy_from_vendor",
      vendorId: "blacksmith",
      itemId: "health_potion",
      count: 10,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.strictEqual(result.itemDeltas["health_potion"], 10);
  });
});

// ---------------------------------------------------------------------------
// Vendor sell
// ---------------------------------------------------------------------------

describe("Vendor sell", () => {
  it("succeeds when player owns item", () => {
    const snap = makeSnapshot({ items: { iron_sword: 1 } });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "sell_to_vendor",
      vendorId: "blacksmith",
      itemId: "iron_sword",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.ok(result.goldDelta > 0, "selling should grant gold");
    assert.ok((result.itemDeltas["iron_sword"] ?? 0) < 0, "should lose item");
  });

  it("fails when player does not own item", () => {
    const snap = makeSnapshot({ items: {} });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "sell_to_vendor",
      vendorId: "blacksmith",
      itemId: "iron_sword",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
  });

  it("blocks selling quest items", () => {
    const snap = makeSnapshot({ items: { quest_relic: 1 } });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "sell_to_vendor",
      vendorId: "blacksmith",
      itemId: "quest_relic",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some((e) => e.includes("quest")));
  });

  it("blocks selling bound items", () => {
    const snap = makeSnapshot({ items: { bound_armor: 1 } });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "sell_to_vendor",
      vendorId: "blacksmith",
      itemId: "bound_armor",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
  });

  it("fails if trying to sell more than owned", () => {
    const snap = makeSnapshot({ items: { iron_ore: 2 } });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "sell_to_vendor",
      vendorId: "blacksmith",
      itemId: "iron_ore",
      count: 5,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
  });

  it("blocks selling items the vendor does not buy", () => {
    const snap = makeSnapshot({ items: { iron_ore: 1 } });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "sell_to_vendor",
      vendorId: "blacksmith",
      itemId: "iron_ore",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.includes("vendor_does_not_buy_item"));
  });

  it("cannot sell items that are in escrow", () => {
    const snap = makeSnapshot({
      items: { iron_ore: 5 },
      escrow: { iron_ore: 4 },
    });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "sell_to_vendor",
      vendorId: "blacksmith",
      itemId: "iron_ore",
      count: 3,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok, "should block selling escrowed stock");
  });
});

// ---------------------------------------------------------------------------
// Use item / learn from spell tome
// ---------------------------------------------------------------------------

describe("Use item / spell tome", () => {
  it("fails using item player does not own", () => {
    const snap = makeSnapshot({ items: {} });
    const ctx = makeCtx(snap, { playerLevel: 10 });
    const req = makeReq({ kind: "use_item", itemId: "health_potion" });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
  });

  it("rejects zero-count item use so cooldowns and spell unlocks cannot be free", () => {
    const now = Date.now();
    const snap = makeSnapshot({ items: { health_potion: 5 } });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "use_item",
      itemId: "health_potion",
      count: 0,
      nowMs: now,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.includes("invalid_count"));
  });

  it("fails when on cooldown", () => {
    const now = Date.now();
    const snap = makeSnapshot({
      items: { health_potion: 5 },
      consumableCooldowns: { potion: now + 60_000 },
    });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "use_item",
      itemId: "health_potion",
      nowMs: now,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some((e) => e.includes("cooldown")));
  });

  it("succeeds when cooldown has expired", () => {
    const now = Date.now();
    const snap = makeSnapshot({
      items: { health_potion: 5 },
      consumableCooldowns: { potion: now - 1 },
    });
    const ctx = makeCtx(snap, { playerLevel: 1 });
    const req = makeReq({
      kind: "use_item",
      itemId: "health_potion",
      nowMs: now,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
  });

  it("fails learning spell tome below level requirement", () => {
    const snap = makeSnapshot({ items: { fire_tome: 1 } });
    const ctx = makeCtx(snap, { playerLevel: 3 }); // requires 5
    const req = makeReq({ kind: "learn_spell_from_tome", itemId: "fire_tome" });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some((e) => e.includes("level")));
  });

  it("succeeds learning spell tome at required level", () => {
    const snap = makeSnapshot({ items: { fire_tome: 1 }, knownAbilities: [] });
    const ctx = makeCtx(snap, { playerLevel: 5 });
    const req = makeReq({ kind: "learn_spell_from_tome", itemId: "fire_tome" });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.ok(result.newAbilityIds[0] === "fireball");
  });

  it("fails learning already-known spell", () => {
    const snap = makeSnapshot({
      items: { fire_tome: 1 },
      knownAbilities: ["fireball"],
    });
    const ctx = makeCtx(snap, { playerLevel: 10 });
    const req = makeReq({ kind: "learn_spell_from_tome", itemId: "fire_tome" });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.some((e) => e.includes("already_known")));
  });
});

// ---------------------------------------------------------------------------
// Crafting
// ---------------------------------------------------------------------------

describe("Crafting", () => {
  it("succeeds with sufficient materials and known recipe", () => {
    const snap = makeSnapshot({
      items: { iron_ore: 10 },
      knownRecipes: ["smelt_iron"],
    });
    const ctx = makeCtx(snap, {
      playerLevel: 1,
      playerSkills: { smithing: { level: 1 } },
    });
    const req = makeReq({
      kind: "craft_item",
      recipeId: "smelt_iron",
      count: 2,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.strictEqual(result.itemDeltas["iron_ore"], -6);
    assert.strictEqual(result.itemDeltas["iron_ingot"], 2);
    assert.strictEqual(result.xpDelta, 20);
  });

  it("rejects zero-count crafting instead of silently crafting one item", () => {
    const snap = makeSnapshot({
      items: { iron_ore: 10 },
      knownRecipes: ["smelt_iron"],
    });
    const ctx = makeCtx(snap, {
      playerLevel: 1,
      playerSkills: { smithing: { level: 1 } },
    });
    const req = makeReq({
      kind: "craft_item",
      recipeId: "smelt_iron",
      count: 0,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.includes("invalid_count"));
  });

  it("allows crafting in a full bag when consumed inputs free the output slot", () => {
    const fullItems: Record<string, number> = { iron_ore: 3 };
    for (let i = 0; i < HARTHMERE_DEFAULT_INVENTORY_SLOTS - 1; i++) {
      fullItems[`filler_${i}`] = 1;
    }
    const snap = makeSnapshot({
      items: fullItems,
      knownRecipes: ["smelt_iron"],
    });
    const ctx = makeCtx(snap, {
      playerLevel: 1,
      playerSkills: { smithing: { level: 1 } },
    });
    const req = makeReq({
      kind: "craft_item",
      recipeId: "smelt_iron",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.strictEqual(result.itemDeltas["iron_ore"], -3);
    assert.strictEqual(result.itemDeltas["iron_ingot"], 1);
  });

  it("pulls crafting materials from material storage when backpack is short", () => {
    const snap = makeSnapshot({
      items: { iron_ore: 1 },
      materialStorage: { iron_ore: 2 },
      knownRecipes: ["smelt_iron"],
    });
    const ctx = makeCtx(snap, {
      playerLevel: 1,
      playerSkills: { smithing: { level: 1 } },
    });
    const req = makeReq({
      kind: "craft_item",
      recipeId: "smelt_iron",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.strictEqual(result.itemDeltas.iron_ore, -1);
    assert.strictEqual(result.materialStorageDeltas.iron_ore, -2);
    assert.strictEqual(result.itemDeltas.iron_ingot, 1);
  });

  it("does not let material storage inputs fake an empty backpack slot", () => {
    const fullItems: Record<string, number> = {};
    for (let i = 0; i < HARTHMERE_DEFAULT_INVENTORY_SLOTS; i++) {
      fullItems[`filler_${i}`] = 1;
    }
    const snap = makeSnapshot({
      items: fullItems,
      materialStorage: { iron_ore: 3 },
      knownRecipes: ["smelt_iron"],
    });
    const ctx = makeCtx(snap, {
      playerLevel: 1,
      playerSkills: { smithing: { level: 1 } },
    });
    const req = makeReq({
      kind: "craft_item",
      recipeId: "smelt_iron",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.includes("inventory_full"));
  });

  it("fails with insufficient materials", () => {
    const snap = makeSnapshot({
      items: { iron_ore: 2 },
      knownRecipes: ["smelt_iron"],
    });
    const ctx = makeCtx(snap, {
      playerLevel: 1,
      playerSkills: { smithing: { level: 1 } },
    });
    const req = makeReq({
      kind: "craft_item",
      recipeId: "smelt_iron",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
    assert.ok(
      result.errors?.some(
        (e) => e.includes("material") || e.includes("insufficient")
      )
    );
  });

  it("fails with unknown recipe", () => {
    const snap = makeSnapshot({ items: { iron_ore: 10 }, knownRecipes: [] });
    const ctx = makeCtx(snap, {
      playerLevel: 1,
      playerSkills: { smithing: { level: 1 } },
    });
    const req = makeReq({
      kind: "craft_item",
      recipeId: "smelt_iron",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
    assert.ok(
      result.errors?.some(
        (e) => e.includes("recipe_not_known") || e.includes("recipe")
      )
    );
  });

  it("fails when skill level is insufficient", () => {
    const snap = makeSnapshot({
      items: { iron_ore: 10 },
      knownRecipes: ["smelt_iron"],
    });
    const ctx = makeCtx(snap, {
      playerLevel: 1,
      playerSkills: { smithing: { level: 0 } },
    });
    const req = makeReq({
      kind: "craft_item",
      recipeId: "smelt_iron",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
  });

  it("refuses if output exceeds max stack size", () => {
    const snap = makeSnapshot({
      items: { iron_ore: 999 },
      knownRecipes: ["smelt_iron"],
    });
    // Fill inventory to near capacity to trigger overflow
    const fullItems: Record<string, number> = { iron_ore: 999 };
    for (let i = 0; i < HARTHMERE_DEFAULT_INVENTORY_SLOTS - 1; i++) {
      fullItems[`filler_${i}`] = 1;
    }
    const snap2 = makeSnapshot({
      items: fullItems,
      knownRecipes: ["smelt_iron"],
    });
    const ctx = makeCtx(snap2, {
      playerLevel: 1,
      playerSkills: { smithing: { level: 1 } },
    });
    const req = makeReq({
      kind: "craft_item",
      recipeId: "smelt_iron",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok, "should reject when inventory full");
  });

  it("refunds failed-craft materials on the combined consumed total, not per-ledger (no rounding loss)", () => {
    registerHarthmereCraftingRecipe({
      recipeId: "refund_split_test",
      outputItemId: "iron_ingot",
      outputCount: 1,
      inputs: [{ itemId: "iron_ore", count: 2 }],
      requiredSkillId: "smithing",
      requiredSkillLevel: 1,
      requiredLevel: 1,
      craftingTimeMs: 1000,
      xpReward: 10,
      successChance: 0, // deterministically fails so the refund path runs
      failureMaterialRefundPercent: 0.5,
    });
    // One unit from the backpack and one from material storage: a single input split
    // across both ledgers. 50% of 2 consumed = 1 unit refunded; per-ledger flooring
    // (the old bug) would refund floor(0.5)+floor(0.5)=0.
    const snap = makeSnapshot({
      items: { iron_ore: 1 },
      materialStorage: { iron_ore: 1 },
      knownRecipes: ["refund_split_test"],
    });
    const ctx = makeCtx(snap, {
      playerLevel: 1,
      playerSkills: { smithing: { level: 1 } },
    });
    const req = makeReq({
      kind: "craft_item",
      recipeId: "refund_split_test",
      count: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    const netConsumed =
      (result.itemDeltas.iron_ore ?? 0) +
      (result.materialStorageDeltas.iron_ore ?? 0);
    assert.strictEqual(
      netConsumed,
      -1,
      "net consumed should be 1 of 2 after the 50% refund"
    );
    assert.ok(
      !result.itemDeltas.iron_ingot,
      "a failed craft produces no output"
    );
  });
});

describe("Unimplemented mutation kinds", () => {
  it("hard-fails split_stack and stack_items instead of a permissive ok passthrough", () => {
    const snap = makeSnapshot({ items: { iron_ore: 10 } });
    const ctx = makeCtx(snap);
    for (const kind of ["split_stack", "stack_items"] as const) {
      const result = reduceHarthmereInventoryMutation(
        makeReq({ kind, itemId: "iron_ore", count: 5 }),
        ctx
      );
      assert.ok(!result.ok, `${kind} must not silently succeed`);
      assert.ok(
        result.errors?.some((e) => e.includes("not_implemented")),
        `${kind} should report not_implemented, got: ${result.errors?.join(
          ", "
        )}`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Bank transfer
// ---------------------------------------------------------------------------

describe("Bank transfer", () => {
  it("deposits item from inventory to bank", () => {
    const snap = makeSnapshot({ items: { iron_ore: 5 }, bank: {} });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "transfer_to_bank",
      bankItemId: "iron_ore",
      bankCount: 3,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.strictEqual(result.itemDeltas["iron_ore"], -3);
    assert.strictEqual(result.bankDeltas["iron_ore"], 3);
  });

  it("withdraws item from bank to inventory", () => {
    const snap = makeSnapshot({ items: {}, bank: { iron_ore: 5 } });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "withdraw_from_bank",
      bankItemId: "iron_ore",
      bankCount: 2,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.strictEqual(result.itemDeltas["iron_ore"], 2);
    assert.strictEqual(result.bankDeltas["iron_ore"], -2);
  });

  it("fails depositing more than owned", () => {
    const snap = makeSnapshot({ items: { iron_ore: 1 }, bank: {} });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "transfer_to_bank",
      bankItemId: "iron_ore",
      bankCount: 5,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
  });

  it("fails withdrawing more than in bank", () => {
    const snap = makeSnapshot({ items: {}, bank: { iron_ore: 1 } });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "withdraw_from_bank",
      bankItemId: "iron_ore",
      bankCount: 5,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
  });

  it("fails withdrawing when the destination stack would exceed its max size", () => {
    const snap = makeSnapshot({
      items: { health_potion: 15 },
      bank: { health_potion: 10 },
    });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "withdraw_from_bank",
      bankItemId: "health_potion",
      bankCount: 10,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
    assert.ok(result.errors?.includes("inventory_stack_size_exceeded"));
  });

  it("blocks depositing quest items", () => {
    const snap = makeSnapshot({ items: { quest_relic: 1 }, bank: {} });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "transfer_to_bank",
      bankItemId: "quest_relic",
      bankCount: 1,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(!result.ok);
  });
});

// ---------------------------------------------------------------------------
// Quest item grant / remove
// ---------------------------------------------------------------------------

describe("Quest item grant/remove", () => {
  it("grants quest item to player", () => {
    const snap = makeSnapshot({ items: {} });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "grant_quest_item",
      itemId: "quest_relic",
      count: 1,
      questId: "quest_1",
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.strictEqual(result.itemDeltas["quest_relic"], 1);
  });

  it("removes quest item from player", () => {
    const snap = makeSnapshot({ items: { quest_relic: 1 } });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "remove_quest_item",
      itemId: "quest_relic",
      count: 1,
      questId: "quest_1",
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
  });

  it("removes only the requested quest count across backpack and bank", () => {
    const snap = makeSnapshot({
      items: { quest_relic: 4 },
      bank: { quest_relic: 4 },
    });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "remove_quest_item",
      itemId: "quest_relic",
      count: 5,
      questId: "quest_1",
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.strictEqual(result.itemDeltas["quest_relic"], -4);
    assert.strictEqual(result.bankDeltas["quest_relic"], -1);
  });

  it("routes currency pickups to the wallet rather than backpack slots", () => {
    const snap = makeSnapshot({ gold: 5, items: {} });
    const ctx = makeCtx(snap);
    const req = makeReq({ kind: "pickup_item", itemId: "gold_coin", count: 7 });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.strictEqual(result.goldDelta, 7);
    assert.deepStrictEqual(result.itemDeltas, {});
  });

  it("validates equip and unequip instead of passing through unsupported changes", () => {
    const snap = makeSnapshot({ items: { iron_sword: 1 } });
    const ctx = makeCtx(snap, { playerLevel: 10 });
    const equip = reduceHarthmereInventoryMutation(
      makeReq({
        kind: "equip_item",
        itemId: "iron_sword",
        targetSlot: "main_hand",
      }),
      ctx
    );
    assert.ok(equip.ok, equip.errors?.join(", "));
    assert.strictEqual(equip.itemDeltas["iron_sword"], -1);
    assert.strictEqual(equip.equipmentChanges.main_hand, "iron_sword");

    const equipped = applyHarthmereInventoryMutationResult(snap, equip);
    const unequip = reduceHarthmereInventoryMutation(
      makeReq({ kind: "unequip_item", sourceSlot: "main_hand" }),
      makeCtx(equipped)
    );
    assert.ok(unequip.ok, unequip.errors?.join(", "));
    assert.strictEqual(unequip.itemDeltas["iron_sword"], 1);
    assert.strictEqual(unequip.equipmentChanges.main_hand, undefined);
  });

  it("enforces equipment classRestriction when the player class is known", () => {
    registerHarthmereItemDefinition(
      makeItem({ itemId: "mage_staff", classRestriction: ["mage"], stats: {} })
    );
    const snap = makeSnapshot({ items: { mage_staff: 1 } });
    const wrong = reduceHarthmereInventoryMutation(
      makeReq({
        kind: "equip_item",
        itemId: "mage_staff",
        targetSlot: "main_hand",
      }),
      makeCtx(snap, { playerClassId: "warrior" })
    );
    assert.ok(!wrong.ok, "a warrior must not equip a mage-only item");
    assert.ok(wrong.errors?.includes("class_requirement_not_met"));

    const right = reduceHarthmereInventoryMutation(
      makeReq({
        kind: "equip_item",
        itemId: "mage_staff",
        targetSlot: "main_hand",
      }),
      makeCtx(snap, { playerClassId: "mage" })
    );
    assert.ok(right.ok, right.errors?.join(", "));

    // No class supplied → enforcement skipped (caller could not determine eligibility).
    const noClass = reduceHarthmereInventoryMutation(
      makeReq({
        kind: "equip_item",
        itemId: "mage_staff",
        targetSlot: "main_hand",
      }),
      makeCtx(snap)
    );
    assert.ok(noClass.ok, noClass.errors?.join(", "));
  });

  it("enforces two-handed weapon vs off-hand slot exclusivity", () => {
    registerHarthmereItemDefinition(
      makeItem({
        itemId: "greatsword",
        twoHanded: true,
        maxStackSize: 1,
        stats: { attack: 30 },
      })
    );
    registerHarthmereItemDefinition(
      makeItem({
        itemId: "wooden_shield",
        maxStackSize: 1,
        stats: { defense: 8 },
      })
    );

    // Equipping a two-hander while an off-hand item is equipped is rejected.
    const blockedByShield = reduceHarthmereInventoryMutation(
      makeReq({
        kind: "equip_item",
        itemId: "greatsword",
        targetSlot: "main_hand",
      }),
      makeCtx(
        makeSnapshot({
          items: { greatsword: 1 },
          equipment: { off_hand: "wooden_shield" },
        })
      )
    );
    assert.ok(!blockedByShield.ok);
    assert.ok(
      blockedByShield.errors?.includes("off_hand_must_be_empty_for_two_handed")
    );

    // Equipping an off-hand item while a two-hander is in the main hand is rejected.
    const blockedByTwoHander = reduceHarthmereInventoryMutation(
      makeReq({
        kind: "equip_item",
        itemId: "wooden_shield",
        targetSlot: "off_hand",
      }),
      makeCtx(
        makeSnapshot({
          items: { wooden_shield: 1 },
          equipment: { main_hand: "greatsword" },
        })
      )
    );
    assert.ok(!blockedByTwoHander.ok);
    assert.ok(
      blockedByTwoHander.errors?.includes("two_handed_weapon_blocks_off_hand")
    );

    // With both hands free, the two-hander equips cleanly.
    const ok = reduceHarthmereInventoryMutation(
      makeReq({
        kind: "equip_item",
        itemId: "greatsword",
        targetSlot: "main_hand",
      }),
      makeCtx(makeSnapshot({ items: { greatsword: 1 } }))
    );
    assert.ok(ok.ok, ok.errors?.join(", "));
  });

  it("blocks dropping quest items and validates destroy counts", () => {
    const snap = makeSnapshot({ items: { quest_relic: 1, iron_ore: 2 } });
    const ctx = makeCtx(snap);
    const dropQuest = reduceHarthmereInventoryMutation(
      makeReq({ kind: "drop_item", itemId: "quest_relic", count: 1 }),
      ctx
    );
    assert.ok(!dropQuest.ok);
    assert.ok(dropQuest.errors?.includes("cannot_drop_quest_item"));

    const destroyZero = reduceHarthmereInventoryMutation(
      makeReq({ kind: "destroy_item", itemId: "iron_ore", count: 0 }),
      ctx
    );
    assert.ok(!destroyZero.ok);
    assert.ok(destroyZero.errors?.includes("invalid_count"));
  });

  it("drops and destroys directly from material storage when requested", () => {
    const snap = makeSnapshot({
      items: {},
      materialStorage: { iron_ore: 3 },
    });
    const ctx = makeCtx(snap);

    const dropMaterial = reduceHarthmereInventoryMutation(
      makeReq({
        kind: "drop_item",
        itemId: "iron_ore",
        count: 2,
        sourceSlot: "material_storage",
      }),
      ctx
    );
    assert.ok(dropMaterial.ok, dropMaterial.errors?.join(", "));
    assert.deepStrictEqual(dropMaterial.itemDeltas, {});
    assert.strictEqual(dropMaterial.materialStorageDeltas.iron_ore, -2);

    const destroyTooMany = reduceHarthmereInventoryMutation(
      makeReq({
        kind: "destroy_item",
        itemId: "iron_ore",
        count: 4,
        sourceSlot: "material_storage",
      }),
      ctx
    );
    assert.ok(!destroyTooMany.ok);
    assert.ok(destroyTooMany.errors?.includes("insufficient_item_count"));
  });

  it("fails removing quest item player does not have", () => {
    const snap = makeSnapshot({ items: {} });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "remove_quest_item",
      itemId: "quest_relic",
      count: 1,
      questId: "quest_1",
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    // Returns a warning-only success when item is missing — quest system handles gracefully
    assert.ok(
      result.warnings?.some((w) => w.includes("mismatch")) || !result.ok
    );
  });
});

// ---------------------------------------------------------------------------
// Admin grant
// ---------------------------------------------------------------------------

describe("Admin grant", () => {
  it("grants any item regardless of normal rules", () => {
    const snap = makeSnapshot({ gold: 0, items: {} });
    const ctx = makeCtx(snap);
    const req = makeReq({
      kind: "admin_grant",
      itemId: "iron_sword",
      count: 5,
    });
    const result = reduceHarthmereInventoryMutation(req, ctx);
    assert.ok(result.ok, result.errors?.join(", "));
    assert.strictEqual(result.itemDeltas["iron_sword"], 5);
  });
});

// ---------------------------------------------------------------------------
// applyHarthmereInventoryMutationResult
// ---------------------------------------------------------------------------

describe("applyHarthmereInventoryMutationResult", () => {
  it("does not mutate snapshot on failure result", () => {
    const snap = makeSnapshot({ gold: 100, items: { iron_ore: 5 } });
    const result = {
      ok: false,
      requestId: "r",
      kind: "buy_from_vendor" as const,
      actorId: "player_1",
      goldDelta: -100,
      itemDeltas: { iron_ore: -3 },
      bankDeltas: {},
      materialStorageDeltas: {},
      escrowDeltas: {},
      equipmentChanges: {},
      newConsumableCooldowns: {},
      newAbilityIds: [],
      newRecipeIds: [],
      xpDelta: 0,
      errors: ["test_fail"],
      warnings: [],
      auditTags: [],
    };
    const next = applyHarthmereInventoryMutationResult(snap, result);
    assert.strictEqual(next.gold, 100);
    assert.strictEqual(next.items["iron_ore"], 5);
  });

  it("applies gold delta on success", () => {
    const snap = makeSnapshot({ gold: 200 });
    const result = {
      ok: true,
      requestId: "r",
      kind: "buy_from_vendor" as const,
      actorId: "player_1",
      goldDelta: -50,
      itemDeltas: { iron_sword: 1 },
      bankDeltas: {},
      materialStorageDeltas: {},
      escrowDeltas: {},
      equipmentChanges: {},
      newConsumableCooldowns: {},
      newAbilityIds: [],
      newRecipeIds: [],
      xpDelta: 0,
      errors: [],
      warnings: [],
      auditTags: [],
    };
    const next = applyHarthmereInventoryMutationResult(snap, result);
    assert.strictEqual(next.gold, 150);
    assert.strictEqual(next.items["iron_sword"], 1);
  });

  it("gold cannot go below zero", () => {
    const snap = makeSnapshot({ gold: 10 });
    const result = {
      ok: true,
      requestId: "r",
      kind: "admin_grant" as const,
      actorId: "player_1",
      goldDelta: -9999,
      itemDeltas: {},
      bankDeltas: {},
      materialStorageDeltas: {},
      escrowDeltas: {},
      equipmentChanges: {},
      newConsumableCooldowns: {},
      newAbilityIds: [],
      newRecipeIds: [],
      xpDelta: 0,
      errors: [],
      warnings: [],
      auditTags: [],
    };
    const next = applyHarthmereInventoryMutationResult(snap, result);
    assert.strictEqual(next.gold, 0);
  });

  it("items at zero count are removed from the map", () => {
    const snap = makeSnapshot({ items: { iron_ore: 3 } });
    const result = {
      ok: true,
      requestId: "r",
      kind: "sell_to_vendor" as const,
      actorId: "player_1",
      goldDelta: 15,
      itemDeltas: { iron_ore: -3 },
      bankDeltas: {},
      materialStorageDeltas: {},
      escrowDeltas: {},
      equipmentChanges: {},
      newConsumableCooldowns: {},
      newAbilityIds: [],
      newRecipeIds: [],
      xpDelta: 0,
      errors: [],
      warnings: [],
      auditTags: [],
    };
    const next = applyHarthmereInventoryMutationResult(snap, result);
    assert.ok(!("iron_ore" in next.items), "zero-count item should be removed");
  });

  it("new abilities are appended when returned in result", () => {
    const snap = makeSnapshot({ knownAbilities: ["slash"] });
    const result = {
      ok: true,
      requestId: "r",
      kind: "learn_spell_from_tome" as const,
      actorId: "player_1",
      goldDelta: 0,
      itemDeltas: { fire_tome: -1 },
      bankDeltas: {},
      materialStorageDeltas: {},
      escrowDeltas: {},
      equipmentChanges: {},
      newConsumableCooldowns: {},
      newAbilityIds: ["fireball"],
      newRecipeIds: [],
      xpDelta: 0,
      errors: [],
      warnings: [],
      auditTags: [],
    };
    const next = applyHarthmereInventoryMutationResult(snap, result);
    assert.ok(next.knownAbilities.includes("fireball"));
    assert.ok(next.knownAbilities.includes("slash"));
  });
});
