import assert from "assert";
import {
  getHarthmereCraftingRecipe,
  getHarthmereItemDefinition,
  getHarthmereVendorEntry,
  reduceHarthmereInventoryMutation,
  type HarthmereInventoryMutationKind,
  type HarthmereInventoryMutationRequest,
  type HarthmereInventorySnapshot,
} from "../mmo_inventory_authority";
import {
  HARTHMERE_CRAFTING_TOOLS,
  ensureHarthmereProductionCraftingCatalogue,
} from "../mmo_crafting_catalogue";
import { ensureHarthmereProductionVendorCatalog } from "../harthmere_vendor_catalog";

const NOW_MS = 1_761_000_000_000;
const ACTOR = "farm_tool_player";
const FARM_VENDOR = "orchard_produce_stand";

// The farming tools that must be obtainable (craft + buy), and their recipe ids.
const FARMING_TOOLS = [
  {
    name: "Hoe",
    itemId: HARTHMERE_CRAFTING_TOOLS.hoe,
    recipeId: "harthmere_tool_hoe_recipe",
  },
  {
    name: "Watering Can",
    itemId: HARTHMERE_CRAFTING_TOOLS.wateringCan,
    recipeId: "harthmere_tool_watering_can_recipe",
  },
  {
    name: "Bucket",
    itemId: HARTHMERE_CRAFTING_TOOLS.bucket,
    recipeId: "harthmere_tool_bucket_recipe",
  },
];

function snapshot(
  overrides: Partial<HarthmereInventorySnapshot> = {}
): HarthmereInventorySnapshot {
  return {
    actorId: ACTOR,
    gold: 1_000,
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

function mutate(
  kind: HarthmereInventoryMutationKind,
  base: HarthmereInventorySnapshot,
  overrides: Partial<HarthmereInventoryMutationRequest>,
  playerSkills: Record<string, { level: number }> = {}
) {
  return reduceHarthmereInventoryMutation(
    {
      requestId: `tool-test-${kind}`,
      actorId: ACTOR,
      kind,
      nowMs: NOW_MS,
      ...overrides,
    } as HarthmereInventoryMutationRequest,
    { snapshot: base, playerLevel: 10, playerSkills, reputation: {} }
  );
}

describe("Harthmere farming tools are obtainable", () => {
  before(() => {
    ensureHarthmereProductionCraftingCatalogue();
    ensureHarthmereProductionVendorCatalog();
  });

  it("registers every farming tool as a craftable item with a recipe", () => {
    for (const tool of FARMING_TOOLS) {
      assert.ok(
        getHarthmereItemDefinition(tool.itemId),
        `${tool.name} item def missing`
      );
      const recipe = getHarthmereCraftingRecipe(tool.recipeId);
      assert.ok(recipe, `${tool.name} has no craft recipe`);
      assert.strictEqual(recipe!.outputItemId, tool.itemId);
      assert.ok(
        recipe!.requiredStationId,
        `${tool.name} recipe has no station`
      );
    }
  });

  it("sells every farming tool at the Orchard Produce Stand", () => {
    for (const tool of FARMING_TOOLS) {
      const entry = getHarthmereVendorEntry(FARM_VENDOR, tool.itemId);
      assert.ok(entry, `${tool.name} is not purchasable`);
      assert.ok(entry!.buyPrice > 0);
    }
  });

  it("crafts a hoe from basic materials at the workbench", () => {
    const recipe = getHarthmereCraftingRecipe("harthmere_tool_hoe_recipe")!;
    const base = snapshot({
      items: { wood_plank: 3, iron_ingot: 1 },
      knownRecipes: [recipe.recipeId],
    });
    const result = mutate(
      "craft_item",
      base,
      {
        recipeId: recipe.recipeId,
        stationId: recipe.requiredStationId,
        count: 1,
      },
      { carpentry: { level: 1 } }
    );
    assert.ok(result.ok, `craft failed: ${result.errors.join(",")}`);
    assert.strictEqual(result.itemDeltas[HARTHMERE_CRAFTING_TOOLS.hoe], 1);
  });

  it("buys a watering can (the tool home gardens require) from the vendor", () => {
    const entry = getHarthmereVendorEntry(
      FARM_VENDOR,
      HARTHMERE_CRAFTING_TOOLS.wateringCan
    )!;
    const base = snapshot({ gold: 100 });
    const bundleQuantity = entry.bundleQuantity ?? 1;
    const bundlePrice = entry.bundlePrice ?? entry.buyPrice * bundleQuantity;
    const result = mutate("buy_from_vendor", base, {
      vendorId: FARM_VENDOR,
      itemId: HARTHMERE_CRAFTING_TOOLS.wateringCan,
      count: bundleQuantity,
    });
    assert.ok(result.ok, `buy failed: ${result.errors.join(",")}`);
    assert.strictEqual(result.goldDelta, -bundlePrice);
    assert.strictEqual(
      result.itemDeltas[HARTHMERE_CRAFTING_TOOLS.wateringCan],
      bundleQuantity
    );
  });

  it("buys the exact native Hoe used by tilling and the farming hotbar", () => {
    const entry = getHarthmereVendorEntry(
      FARM_VENDOR,
      HARTHMERE_CRAFTING_TOOLS.hoe
    )!;
    const base = snapshot({ gold: 100 });
    const bundleQuantity = entry.bundleQuantity ?? 1;
    const bundlePrice = entry.bundlePrice ?? entry.buyPrice * bundleQuantity;
    const result = mutate("buy_from_vendor", base, {
      vendorId: FARM_VENDOR,
      itemId: HARTHMERE_CRAFTING_TOOLS.hoe,
      count: bundleQuantity,
    });
    assert.ok(result.ok, `buy failed: ${result.errors.join(",")}`);
    assert.strictEqual(result.goldDelta, -bundlePrice);
    assert.strictEqual(
      result.itemDeltas[HARTHMERE_CRAFTING_TOOLS.hoe],
      bundleQuantity
    );
  });
});
