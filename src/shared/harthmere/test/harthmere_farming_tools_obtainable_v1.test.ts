import assert from "assert";
import {
  getHarthmereCraftingRecipeV1,
  getHarthmereItemDefinitionV1,
  getHarthmereVendorEntryV1,
  reduceHarthmereInventoryMutationV1,
  type HarthmereInventoryMutationKindV1,
  type HarthmereInventoryMutationRequestV1,
  type HarthmereInventorySnapshotV1,
} from "../mmo_inventory_authority_v1";
import {
  HARTHMERE_CRAFTING_TOOLS_V1,
  ensureHarthmereProductionCraftingCatalogueV1,
} from "../mmo_crafting_catalogue_v1";
import { ensureHarthmereProductionVendorCatalogV1 } from "../harthmere_vendor_catalog_v1";

const NOW_MS = 1_761_000_000_000;
const ACTOR = "farm_tool_player";
const FARM_VENDOR = "orchard_produce_stand";

// The farming tools that must be obtainable (craft + buy), and their recipe ids.
const FARMING_TOOLS = [
  { name: "Hoe", itemId: HARTHMERE_CRAFTING_TOOLS_V1.hoe, recipeId: "harthmere_tool_hoe_recipe" },
  { name: "Watering Can", itemId: HARTHMERE_CRAFTING_TOOLS_V1.wateringCan, recipeId: "harthmere_tool_watering_can_recipe" },
  { name: "Bucket", itemId: HARTHMERE_CRAFTING_TOOLS_V1.bucket, recipeId: "harthmere_tool_bucket_recipe" },
];

function snapshot(
  overrides: Partial<HarthmereInventorySnapshotV1> = {}
): HarthmereInventorySnapshotV1 {
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
  kind: HarthmereInventoryMutationKindV1,
  base: HarthmereInventorySnapshotV1,
  overrides: Partial<HarthmereInventoryMutationRequestV1>,
  playerSkills: Record<string, { level: number }> = {}
) {
  return reduceHarthmereInventoryMutationV1(
    { requestId: `tool-test-${kind}`, actorId: ACTOR, kind, nowMs: NOW_MS, ...overrides } as HarthmereInventoryMutationRequestV1,
    { snapshot: base, playerLevel: 10, playerSkills, reputation: {} }
  );
}

describe("Harthmere farming tools are obtainable", () => {
  before(() => {
    ensureHarthmereProductionCraftingCatalogueV1();
    ensureHarthmereProductionVendorCatalogV1();
  });

  it("registers every farming tool as a craftable item with a recipe", () => {
    for (const tool of FARMING_TOOLS) {
      assert.ok(
        getHarthmereItemDefinitionV1(tool.itemId),
        `${tool.name} item def missing`
      );
      const recipe = getHarthmereCraftingRecipeV1(tool.recipeId);
      assert.ok(recipe, `${tool.name} has no craft recipe`);
      assert.strictEqual(recipe!.outputItemId, tool.itemId);
      assert.ok(recipe!.requiredStationId, `${tool.name} recipe has no station`);
    }
  });

  it("sells every farming tool at the Orchard Produce Stand", () => {
    for (const tool of FARMING_TOOLS) {
      const entry = getHarthmereVendorEntryV1(FARM_VENDOR, tool.itemId);
      assert.ok(entry, `${tool.name} is not purchasable`);
      assert.ok(entry!.buyPrice > 0);
    }
  });

  it("crafts a hoe from basic materials at the workbench", () => {
    const recipe = getHarthmereCraftingRecipeV1("harthmere_tool_hoe_recipe")!;
    const base = snapshot({
      items: { wood_plank: 3, iron_ingot: 1 },
      knownRecipes: [recipe.recipeId],
    });
    const result = mutate(
      "craft_item",
      base,
      { recipeId: recipe.recipeId, stationId: recipe.requiredStationId, count: 1 },
      { carpentry: { level: 1 } }
    );
    assert.ok(result.ok, `craft failed: ${result.errors.join(",")}`);
    assert.strictEqual(result.itemDeltas[HARTHMERE_CRAFTING_TOOLS_V1.hoe], 1);
  });

  it("buys a watering can (the tool home gardens require) from the vendor", () => {
    const entry = getHarthmereVendorEntryV1(
      FARM_VENDOR,
      HARTHMERE_CRAFTING_TOOLS_V1.wateringCan
    )!;
    const base = snapshot({ gold: 100 });
    const result = mutate("buy_from_vendor", base, {
      vendorId: FARM_VENDOR,
      itemId: HARTHMERE_CRAFTING_TOOLS_V1.wateringCan,
      count: 1,
    });
    assert.ok(result.ok, `buy failed: ${result.errors.join(",")}`);
    assert.strictEqual(result.goldDelta, -entry.buyPrice);
    assert.strictEqual(
      result.itemDeltas[HARTHMERE_CRAFTING_TOOLS_V1.wateringCan],
      1
    );
  });
});
