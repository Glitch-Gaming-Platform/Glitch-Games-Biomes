import assert from "assert";
import {
  getHarthmereCraftingRecipe,
  getHarthmereCraftingStation,
  getHarthmereItemDefinition,
  getHarthmereVendorEntry,
  listHarthmereCraftingRecipes,
  reduceHarthmereInventoryMutation,
  type HarthmereInventoryMutationKind,
  type HarthmereInventoryMutationRequest,
  type HarthmereInventorySnapshot,
} from "../mmo_inventory_authority";
import {
  HARTHMERE_NATURAL_BLOCK_ITEM_IDS,
  HARTHMERE_SPECIALIZED_BLOCK_SPECS,
  HARTHMERE_SPECIALIZED_BLOCK_STATIONS,
  assertHarthmereSpecializedBlockRules,
  ensureHarthmereSpecializedBlocksCatalogue,
  harthmereSpecializedBlockItemIds,
  isHarthmereNaturalBlock,
  refinedMaterialRecipeId,
  specializedBlockRecipeId,
} from "../mmo_specialized_blocks_catalogue";
import { HARTHMERE_SEED_DEFINITIONS } from "../mmo_farming_food_stamina";

const NOW_MS = 1_760_000_000_000;
const ACTOR = "block_player_1";

// The four existing vendors the specialized blocks are sold through.
const BLOCK_VENDOR_IDS = [
  "river_dock_supply",
  "black_anvil_smithy",
  "wyrm_candle_magic_shop",
  "orchard_produce_stand",
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
      requestId: `block-test-${kind}`,
      actorId: ACTOR,
      kind,
      nowMs: NOW_MS,
      ...overrides,
    } as HarthmereInventoryMutationRequest,
    {
      snapshot: base,
      playerLevel: 10,
      playerSkills,
      reputation: {},
    }
  );
}

describe("Harthmere specialized blocks catalogue", () => {
  before(() => {
    ensureHarthmereSpecializedBlocksCatalogue();
  });

  it("registers an item, a recipe, and a vendor entry for every spec block", () => {
    for (const spec of HARTHMERE_SPECIALIZED_BLOCK_SPECS) {
      const def = getHarthmereItemDefinition(spec.itemId);
      assert.ok(def, `missing item def for ${spec.itemId}`);
      assert.strictEqual(def!.category, "block");
      assert.strictEqual(def!.baseValue, spec.price);

      const recipe = getHarthmereCraftingRecipe(
        specializedBlockRecipeId(spec.itemId)
      );
      assert.ok(recipe, `missing recipe for ${spec.itemId}`);
      assert.strictEqual(recipe!.outputItemId, spec.itemId);
      assert.strictEqual(recipe!.outputCount, spec.output);
      assert.ok(recipe!.requiredStationId, `recipe ${spec.itemId} has no station`);

      // Exactly one vendor sells it, at the spec price, with a lower sell price.
      const entries = BLOCK_VENDOR_IDS.map((vendorId) =>
        getHarthmereVendorEntry(vendorId, spec.itemId)
      ).filter((e): e is NonNullable<typeof e> => e !== undefined);
      assert.strictEqual(
        entries.length,
        1,
        `${spec.itemId} should be sold by exactly one vendor`
      );
      assert.strictEqual(entries[0].buyPrice, spec.price);
      assert.ok(entries[0].sellPrice < entries[0].buyPrice);
      assert.ok(entries[0].sellPrice >= 1);
    }
  });

  it("covers the full block bible (stone families, wood, clay, metal, magic)", () => {
    const ids = new Set(harthmereSpecializedBlockItemIds());
    const expected = [
      // stone families
      "cobblestone_brick",
      "stone_polished",
      "granite_carved",
      "basalt_shingles",
      "quartzite_brick",
      "limestone_polished",
      // wood
      "oak_lumber",
      "birch_lumber",
      "rubber_lumber",
      "sakura_lumber",
      "oak_stripped",
      "birch_stripped",
      "rubber_stripped",
      // reinforced wood
      "oak_reinforced",
      "birch_reinforced",
      "rubber_reinforced",
      // clay + glass
      "clay_brick",
      "clay_polished",
      "clay_carved",
      "clay_shingles",
      "simple_glass",
      // fabric
      "thatch",
      "cotton_fabric",
      "mushroom_leather",
      // metal / industrial
      "copper",
      "silver",
      "gold",
      "diamond",
      "neptunium",
      "asphalt",
      "led",
      // glass / light / magic
      "ice",
      "emberstone",
      "sunstone",
      "moonstone",
    ];
    for (const id of expected) {
      assert.ok(ids.has(id), `expected specialized block "${id}" to exist`);
    }
    // 6 stones x 4 variants (24) + 7 wood + 3 reinforced + 5 clay/glass +
    // 3 fabric + 7 metal + 4 magic = 53 blocks.
    assert.strictEqual(HARTHMERE_SPECIALIZED_BLOCK_SPECS.length, 53);
  });

  it("registers the five new crafting stations (reusing existing graphics)", () => {
    for (const stationId of Object.values(
      HARTHMERE_SPECIALIZED_BLOCK_STATIONS
    )) {
      const station = getHarthmereCraftingStation(stationId);
      assert.ok(station, `missing station ${stationId}`);
      const item = getHarthmereItemDefinition(stationId);
      assert.ok(item, `missing station item ${stationId}`);
      // Graphics reuse is expressed as a bikkie graphic hint.
      const hints = item!.objectMetadata?.bikkieGraphicHints ?? [];
      assert.ok(
        hints.length > 0,
        `station ${stationId} should reuse an existing graphic via hints`
      );
    }
  });

  it("never makes a natural/gather-only block craftable or purchasable", () => {
    assert.doesNotThrow(assertHarthmereSpecializedBlockRules);

    const recipes = listHarthmereCraftingRecipes();
    for (const naturalId of HARTHMERE_NATURAL_BLOCK_ITEM_IDS) {
      assert.ok(isHarthmereNaturalBlock(naturalId));

      // No recipe outputs a natural block.
      const producing = recipes.filter((r) => r.outputItemId === naturalId);
      assert.strictEqual(
        producing.length,
        0,
        `natural block ${naturalId} must not be a craft output`
      );

      // No block vendor sells a natural block.
      for (const vendorId of BLOCK_VENDOR_IDS) {
        assert.strictEqual(
          getHarthmereVendorEntry(vendorId, naturalId),
          undefined,
          `natural block ${naturalId} must not be purchasable at ${vendorId}`
        );
      }
    }
  });

  it("crafts a stone brick from gathered cobblestone at the Stonecutter", () => {
    const recipeId = specializedBlockRecipeId("cobblestone_brick");
    const recipe = getHarthmereCraftingRecipe(recipeId)!;
    const base = snapshot({
      items: { cobblestone: 4 },
      knownRecipes: [recipeId],
    });
    const result = mutate(
      "craft_item",
      base,
      {
        recipeId,
        stationId: recipe.requiredStationId,
        count: 1,
      },
      { masonry: { level: 1 } }
    );
    assert.ok(result.ok, `craft failed: ${result.errors.join(",")}`);
    assert.strictEqual(result.itemDeltas["cobblestone_brick"], 4);
    assert.strictEqual(result.itemDeltas["cobblestone"], -4);
  });

  it("blocks crafting at the wrong station", () => {
    const recipeId = specializedBlockRecipeId("cobblestone_brick");
    const base = snapshot({
      items: { cobblestone: 4 },
      knownRecipes: [recipeId],
    });
    const result = mutate(
      "craft_item",
      base,
      {
        recipeId,
        stationId: HARTHMERE_SPECIALIZED_BLOCK_STATIONS.forge, // wrong
        count: 1,
      },
      { masonry: { level: 1 } }
    );
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some((e) => e.startsWith("missing_station")));
  });

  it("purchases a specialized block from its vendor for the spec price", () => {
    const entry = getHarthmereVendorEntry(
      "river_dock_supply",
      "cobblestone_brick"
    )!;
    const base = snapshot({ gold: 100 });
    const result = mutate("buy_from_vendor", base, {
      vendorId: "river_dock_supply",
      itemId: "cobblestone_brick",
      count: 2,
    });
    assert.ok(result.ok, `buy failed: ${result.errors.join(",")}`);
    assert.strictEqual(result.goldDelta, -(entry.buyPrice * 2));
    assert.strictEqual(result.itemDeltas["cobblestone_brick"], 2);
  });

  it("cannot purchase a natural block (no vendor entry exists)", () => {
    const base = snapshot({ gold: 100 });
    const result = mutate("buy_from_vendor", base, {
      vendorId: "river_dock_supply",
      itemId: "stone",
      count: 1,
    });
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("item_not_in_vendor_catalogue"));
  });

  // HARTHMERE_BLOCK_INPUT_OBTAINABLE: guardrail that would have caught the
  // dead-recipe gap — every craft input of every block must be obtainable.
  it("every block recipe input is obtainable (gathered, farmed, bought, or a craftable block)", () => {
    const farmedYieldIds = new Set(
      Object.values(HARTHMERE_SEED_DEFINITIONS).map((s) => s.yieldItemId)
    );
    const blockIds = new Set(harthmereSpecializedBlockItemIds());
    const PRODUCTION_BASICS = new Set(["coal", "iron_ingot", "wood_plank"]);
    const BLOCK_VENDORS = BLOCK_VENDOR_IDS;
    const obtainable = (itemId: string): boolean =>
      isHarthmereNaturalBlock(itemId) || // gathered in the world
      farmedYieldIds.has(itemId) || // grown via farming
      blockIds.has(itemId) || // a craftable block (e.g. led needs copper)
      PRODUCTION_BASICS.has(itemId) || // production-catalog staples
      BLOCK_VENDORS.some((v) => getHarthmereVendorEntry(v, itemId)); // buyable

    const dead: string[] = [];
    for (const spec of HARTHMERE_SPECIALIZED_BLOCK_SPECS) {
      for (const input of [...spec.inputs, ...(spec.fuelInputs ?? [])]) {
        if (!obtainable(input.itemId)) {
          dead.push(`${spec.itemId} <- ${input.itemId}`);
        }
      }
    }
    assert.deepEqual(dead, [], `unobtainable block inputs: ${dead.join(", ")}`);
  });

  it("crafts a metal block from a purchased ingot (buy -> craft path works)", () => {
    // Buy 4 copper ingots from the smithy, then craft a copper block at the Forge.
    const ingotEntry = getHarthmereVendorEntry(
      "black_anvil_smithy",
      "copper_ingot"
    );
    assert.ok(ingotEntry, "copper_ingot must be purchasable");
    const recipeId = specializedBlockRecipeId("copper");
    const recipe = getHarthmereCraftingRecipe(recipeId)!;
    const base = snapshot({
      items: { copper_ingot: 4 },
      knownRecipes: [recipeId],
    });
    const result = mutate(
      "craft_item",
      base,
      { recipeId, stationId: recipe.requiredStationId, count: 1 },
      { blacksmithing: { level: 1 } }
    );
    assert.ok(result.ok, `craft failed: ${result.errors.join(",")}`);
    assert.strictEqual(result.itemDeltas["copper"], 4);
  });

  it("crafts a fabric block from FARMED cotton (farming feeds the Loom)", () => {
    const recipeId = specializedBlockRecipeId("cotton_fabric");
    const recipe = getHarthmereCraftingRecipe(recipeId)!;
    // The recipe input is the real farmed Cotton id; harvesting cotton yields it.
    const cottonId = recipe.inputs[0].itemId;
    assert.strictEqual(
      HARTHMERE_SEED_DEFINITIONS["1760645252542797"].yieldItemId,
      cottonId,
      "cotton_fabric input should be the farmed Cotton yield id"
    );
    const base = snapshot({
      items: { [cottonId]: 4 },
      knownRecipes: [recipeId],
    });
    const result = mutate(
      "craft_item",
      base,
      { recipeId, stationId: recipe.requiredStationId, count: 1 },
      { weaving: { level: 1 } }
    );
    assert.ok(result.ok, `craft failed: ${result.errors.join(",")}`);
    assert.strictEqual(result.itemDeltas["cotton_fabric"], 2);
  });

  // HARTHMERE_REFINED_MATERIAL_RECIPES: every refined intermediate must be
  // creatable (no more buy-only ingots) from gathered raw materials.
  const REFINED_INTERMEDIATES = [
    "copper_ingot",
    "silver_ingot",
    "gold_ingot",
    "diamond_shard",
    "neptunium_shard",
    "tree_resin",
  ];

  it("makes every refined intermediate craftable from gathered raw materials", () => {
    for (const id of REFINED_INTERMEDIATES) {
      const recipe = getHarthmereCraftingRecipe(refinedMaterialRecipeId(id));
      assert.ok(recipe, `${id} has no refine recipe`);
      assert.strictEqual(recipe!.outputItemId, id);
      // Its inputs are themselves obtainable (natural ore/log + coal fuel).
      for (const input of [...recipe!.inputs, ...(recipe!.fuelInputs ?? [])]) {
        assert.ok(
          isHarthmereNaturalBlock(input.itemId),
          `${id} refine input ${input.itemId} should be a gathered raw material`
        );
      }
    }
  });

  it("smelts copper ore + coal into a copper ingot at the Forge", () => {
    const recipeId = refinedMaterialRecipeId("copper_ingot");
    const recipe = getHarthmereCraftingRecipe(recipeId)!;
    const base = snapshot({
      items: { copper_ore: 2, coal: 1 },
      knownRecipes: [recipeId],
    });
    const result = mutate(
      "craft_item",
      base,
      { recipeId, stationId: recipe.requiredStationId, count: 1 },
      { blacksmithing: { level: 1 } }
    );
    assert.ok(result.ok, `smelt failed: ${result.errors.join(",")}`);
    assert.strictEqual(result.itemDeltas["copper_ingot"], 2);
  });

  it("makes every block AND every refined intermediate purchasable somewhere", () => {
    const sellable = [
      ...harthmereSpecializedBlockItemIds(),
      ...REFINED_INTERMEDIATES,
    ];
    const missing = sellable.filter(
      (id) => !BLOCK_VENDOR_IDS.some((v) => getHarthmereVendorEntry(v, id))
    );
    assert.deepEqual(missing, [], `not purchasable anywhere: ${missing.join(", ")}`);
  });
});
