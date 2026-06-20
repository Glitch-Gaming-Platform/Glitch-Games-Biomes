import assert from "assert";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  HARTHMERE_EXOTIC_MATTER_BLOCK_ITEM_IDS,
  HARTHMERE_EXOTIC_MATTER_ITEM_IDS,
  HARTHMERE_EXOTIC_MATTER_RECIPE_IDS,
  HARTHMERE_CRAFTING_STATION_RECIPE_IDS,
  HARTHMERE_CRAFTING_STATIONS,
  HARTHMERE_CRAFTING_TOOLS,
  HARTHMERE_HOME_DECORATION_ITEM_IDS,
  HARTHMERE_HOME_DECORATION_RECIPE_IDS,
  ensureHarthmereProductionCraftingCatalogue,
  harthmereProductionCraftingRecipeIds,
} from "../mmo_crafting_catalogue";
import {
  applyHarthmereInventoryMutationResult,
  getHarthmereCraftingRecipe,
  getHarthmereCraftingTool,
  getHarthmereItemDefinition,
  listHarthmereCraftingStations,
  reduceHarthmereInventoryMutation,
  registerHarthmereCraftingRecipe,
  registerHarthmereCraftingStation,
  registerHarthmereCraftingTool,
  registerHarthmereItemDefinition,
  type HarthmereCraftingRecipe,
  type HarthmereInventoryMutationRequest,
  type HarthmereInventorySnapshot,
  type HarthmereItemDefinition,
} from "../mmo_inventory_authority";

function item(
  itemId: string,
  overrides: Partial<HarthmereItemDefinition> = {}
): HarthmereItemDefinition {
  return {
    itemId,
    displayName: itemId.replace(/_/g, " "),
    maxStackSize: 999,
    baseValue: 1,
    binding: "none",
    isQuestItem: false,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: true,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: {},
    tradeable: true,
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<HarthmereInventorySnapshot> = {}
): HarthmereInventorySnapshot {
  return {
    actorId: "craft_tester",
    gold: 100,
    equipment: {},
    items: {},
    bank: {},
    materialStorage: {},
    escrow: {},
    consumableCooldowns: {},
    knownAbilities: [],
    knownRecipes: [],
    ...overrides,
  };
}

function craft(
  req: Partial<HarthmereInventoryMutationRequest>,
  snap: HarthmereInventorySnapshot,
  skills: Record<string, { level: number; xp?: number }> = {}
) {
  return reduceHarthmereInventoryMutation(
    {
      requestId: "craft_req",
      actorId: snap.actorId,
      kind: "craft_item",
      nowMs: 1000,
      ...req,
    } as HarthmereInventoryMutationRequest,
    {
      snapshot: snap,
      playerLevel: 10,
      playerSkills: skills,
      reputation: {},
    }
  );
}

describe("Harthmere crafting authority", () => {
  before(() => {
    for (const def of [
      item("craft_test_ore"),
      item("craft_test_coal"),
      item("craft_test_flux"),
      item("craft_test_efficiency_reagent"),
      item("craft_test_ingot"),
      item("craft_test_part"),
      item("craft_test_crystal"),
      item("craft_test_sword", {
        isCraftingMaterial: false,
        maxStackSize: 1,
        durabilityMax: 100,
        repairable: true,
      }),
      item("craft_test_sword_plus", {
        isCraftingMaterial: false,
        maxStackSize: 1,
        durabilityMax: 140,
        repairable: true,
      }),
      item("craft_test_sword_warded", {
        isCraftingMaterial: false,
        maxStackSize: 1,
        durabilityMax: 140,
        repairable: true,
      }),
      item("craft_test_hammer", {
        isCraftingMaterial: false,
        maxStackSize: 1,
        stats: { toolTier: 2 },
      }),
    ]) {
      registerHarthmereItemDefinition(def);
    }
    registerHarthmereCraftingStation({
      stationId: "craft_test_forge",
      displayName: "Test Forge",
      stationType: "general",
    });
    registerHarthmereCraftingStation({
      stationId: "craft_test_wrong_station",
      displayName: "Wrong Station",
      stationType: "general",
    });
    registerHarthmereCraftingTool({
      itemId: "craft_test_hammer",
      displayName: "Test Hammer",
      action: "shape",
      tier: 2,
      durabilityMax: 100,
    });
  });

  it("enforces station, profession, tool, fuel, optional reagent, and gold requirements", () => {
    const recipe: HarthmereCraftingRecipe = {
      recipeId: "craft_test_ingot_recipe",
      outputItemId: "craft_test_ingot",
      outputCount: 1,
      inputs: [{ itemId: "craft_test_ore", count: 3 }],
      fuelInputs: [{ itemId: "craft_test_coal", count: 1 }],
      optionalReagents: [
        {
          itemId: "craft_test_flux",
          count: 1,
          qualityBonus: 20,
          successBonus: 0.05,
        },
      ],
      requiredLevel: 1,
      requiredSkillId: "smithing",
      requiredSkillLevel: 2,
      professionId: "blacksmithing",
      requiredProfessionLevel: 2,
      requiredStationId: "craft_test_forge",
      requiredToolActions: ["shape"],
      minToolTier: 2,
      toolDurabilityCost: 3,
      goldCost: 5,
      successChance: 1,
      qualityFloor: 30,
      craftingTimeMs: 1000,
      xpReward: 10,
    };
    registerHarthmereCraftingRecipe(recipe);

    const base = snapshot({
      gold: 10,
      items: { craft_test_coal: 1, craft_test_flux: 1, craft_test_hammer: 1 },
      materialStorage: { craft_test_ore: 3 },
      knownRecipes: [recipe.recipeId],
    });
    const wrongStation = craft(
      {
        recipeId: recipe.recipeId,
        stationId: "craft_test_wrong_station",
        toolItemIds: ["craft_test_hammer"],
      },
      base,
      { smithing: { level: 2 }, blacksmithing: { level: 2 } }
    );
    assert.ok(!wrongStation.ok);
    assert.ok(wrongStation.errors.some((e) => e.includes("missing_station")));

    const missingTool = craft(
      { recipeId: recipe.recipeId, stationId: "craft_test_forge" },
      snapshot({
        gold: 10,
        items: { craft_test_coal: 1, craft_test_flux: 1 },
        materialStorage: { craft_test_ore: 3 },
        knownRecipes: [recipe.recipeId],
      }),
      { smithing: { level: 2 }, blacksmithing: { level: 2 } }
    );
    assert.ok(!missingTool.ok);
    assert.ok(
      missingTool.errors.some((e) => e.includes("missing_tool_action"))
    );

    const result = craft(
      {
        recipeId: recipe.recipeId,
        stationId: "craft_test_forge",
        toolItemIds: ["craft_test_hammer"],
        optionalReagentItemIds: ["craft_test_flux"],
        qualitySeed: 10,
      },
      base,
      { smithing: { level: 4 }, blacksmithing: { level: 4 } }
    );
    assert.ok(result.ok, result.errors.join(", "));
    assert.strictEqual(result.materialStorageDeltas.craft_test_ore, -3);
    assert.strictEqual(result.itemDeltas.craft_test_coal, -1);
    assert.strictEqual(result.itemDeltas.craft_test_flux, -1);
    assert.strictEqual(result.itemDeltas.craft_test_ingot, 1);
    assert.strictEqual(result.goldDelta, -5);
    assert.strictEqual(
      result.craftingOutcome?.toolDurabilityCosts.craft_test_hammer,
      3
    );
    assert.ok((result.craftingOutcome?.quality ?? 0) >= 50);
  });

  it("blocks crafting with a BROKEN tool (insufficient durability) — HARTHMERE_TOOL_DURABILITY", () => {
    const recipe: HarthmereCraftingRecipe = {
      recipeId: "craft_test_durability_recipe",
      outputItemId: "craft_test_ingot",
      outputCount: 1,
      inputs: [{ itemId: "craft_test_ore", count: 1 }],
      requiredLevel: 1,
      requiredStationId: "craft_test_forge",
      requiredToolActions: ["shape"],
      toolDurabilityCost: 3,
      successChance: 1,
      craftingTimeMs: 1000,
      xpReward: 10,
    };
    registerHarthmereCraftingRecipe(recipe);
    const base = (toolDurability?: Record<string, number>) =>
      snapshot({
        items: { craft_test_ore: 1, craft_test_hammer: 1 },
        knownRecipes: [recipe.recipeId],
        ...(toolDurability ? { toolDurability } : {}),
      });
    const req = {
      recipeId: recipe.recipeId,
      stationId: "craft_test_forge",
      toolItemIds: ["craft_test_hammer"],
    };

    // Broken tool (0 durability < cost 3) -> rejected.
    const broken = craft(req, base({ craft_test_hammer: 0 }));
    assert.ok(!broken.ok);
    assert.ok(
      broken.errors.some((e) => e.includes("insufficient_tool_durability")),
      broken.errors.join(", ")
    );

    // Below cost (2 < 3) -> rejected.
    const low = craft(req, base({ craft_test_hammer: 2 }));
    assert.ok(!low.ok);

    // Enough durability -> ok.
    const ok = craft(req, base({ craft_test_hammer: 100 }));
    assert.ok(ok.ok, ok.errors.join(", "));

    // No durability tracked (undefined) -> treated as full, ok (non-regressive).
    const untracked = craft(req, base());
    assert.ok(untracked.ok, untracked.errors.join(", "));
  });

  it("supports failed crafts with material refund and no output", () => {
    const recipe: HarthmereCraftingRecipe = {
      recipeId: "craft_test_failed_recipe",
      outputItemId: "craft_test_ingot",
      outputCount: 1,
      inputs: [{ itemId: "craft_test_ore", count: 4 }],
      requiredLevel: 1,
      requiredStationId: "craft_test_forge",
      successChance: 0,
      failureMaterialRefundPercent: 0.5,
      craftingTimeMs: 1000,
      xpReward: 10,
    };
    registerHarthmereCraftingRecipe(recipe);
    const result = craft(
      { recipeId: recipe.recipeId, stationId: "craft_test_forge" },
      snapshot({
        items: { craft_test_ore: 4 },
        knownRecipes: [recipe.recipeId],
      })
    );
    assert.ok(result.ok);
    assert.strictEqual(result.craftingOutcome?.success, false);
    assert.strictEqual(result.itemDeltas.craft_test_ore, -2);
    assert.strictEqual(result.itemDeltas.craft_test_ingot ?? 0, 0);
    assert.strictEqual(result.xpDelta, 0);
  });

  it("blocks client-supplied prepaid inputs outside server job completion", () => {
    const recipe: HarthmereCraftingRecipe = {
      recipeId: "craft_test_prepaid_spoof_recipe",
      outputItemId: "craft_test_ingot",
      outputCount: 1,
      inputs: [{ itemId: "craft_test_ore", count: 2 }],
      requiredLevel: 1,
      requiredStationId: "craft_test_forge",
      craftingTimeMs: 1000,
      xpReward: 5,
    };
    registerHarthmereCraftingRecipe(recipe);
    const result = craft(
      {
        recipeId: recipe.recipeId,
        stationId: "craft_test_forge",
        prepaidCraftingInputs: true,
      },
      snapshot({ knownRecipes: [recipe.recipeId] })
    );
    assert.ok(!result.ok);
    assert.ok(result.errors.includes("prepaid_crafting_inputs_not_allowed"));
  });

  it("applies optional reagent material efficiency to base inputs", () => {
    const recipe: HarthmereCraftingRecipe = {
      recipeId: "craft_test_efficiency_recipe",
      outputItemId: "craft_test_ingot",
      outputCount: 1,
      inputs: [{ itemId: "craft_test_ore", count: 4 }],
      optionalReagents: [
        {
          itemId: "craft_test_efficiency_reagent",
          count: 1,
          materialEfficiencyBonus: 0.5,
        },
      ],
      requiredLevel: 1,
      requiredStationId: "craft_test_forge",
      craftingTimeMs: 1000,
      xpReward: 5,
    };
    registerHarthmereCraftingRecipe(recipe);
    const result = craft(
      {
        recipeId: recipe.recipeId,
        stationId: "craft_test_forge",
        optionalReagentItemIds: ["craft_test_efficiency_reagent"],
      },
      snapshot({
        items: { craft_test_ore: 4, craft_test_efficiency_reagent: 1 },
        knownRecipes: [recipe.recipeId],
      })
    );
    assert.ok(result.ok, result.errors.join(", "));
    assert.strictEqual(result.itemDeltas.craft_test_ore, -2);
    assert.strictEqual(result.itemDeltas.craft_test_efficiency_reagent, -1);
  });

  it("supports repair, salvage, upgrade, and enchant workflows as server-validated crafting", () => {
    const recipes: HarthmereCraftingRecipe[] = [
      {
        recipeId: "craft_test_repair",
        outputItemId: "craft_test_sword",
        outputCount: 0,
        inputs: [{ itemId: "craft_test_part", count: 1 }],
        requiredLevel: 1,
        requiredStationId: "craft_test_forge",
        targetItemIds: ["craft_test_sword"],
        workflowKind: "repair",
        craftingTimeMs: 1000,
        xpReward: 5,
      },
      {
        recipeId: "craft_test_salvage",
        outputItemId: "craft_test_ingot",
        outputCount: 1,
        inputs: [],
        requiredLevel: 1,
        requiredStationId: "craft_test_forge",
        targetItemIds: ["craft_test_sword"],
        consumeTargetOnSuccess: true,
        workflowKind: "salvage",
        craftingTimeMs: 1000,
        xpReward: 5,
      },
      {
        recipeId: "craft_test_upgrade",
        outputItemId: "craft_test_sword_plus",
        outputCount: 1,
        inputs: [{ itemId: "craft_test_crystal", count: 1 }],
        requiredLevel: 1,
        requiredStationId: "craft_test_forge",
        targetItemIds: ["craft_test_sword"],
        consumeTargetOnSuccess: true,
        workflowKind: "upgrade",
        successChance: 1,
        craftingTimeMs: 1000,
        xpReward: 5,
      },
      {
        recipeId: "craft_test_enchant",
        outputItemId: "craft_test_sword_warded",
        outputCount: 1,
        inputs: [{ itemId: "craft_test_flux", count: 1 }],
        requiredLevel: 1,
        requiredStationId: "craft_test_forge",
        targetItemIds: ["craft_test_sword_plus"],
        consumeTargetOnSuccess: true,
        workflowKind: "enchant",
        successChance: 1,
        craftingTimeMs: 1000,
        xpReward: 5,
      },
    ];
    for (const recipe of recipes) registerHarthmereCraftingRecipe(recipe);

    const repair = craft(
      {
        recipeId: "craft_test_repair",
        stationId: "craft_test_forge",
        targetItemId: "craft_test_sword",
      },
      snapshot({
        items: { craft_test_sword: 1, craft_test_part: 1 },
        knownRecipes: ["craft_test_repair"],
      })
    );
    assert.ok(repair.ok);
    assert.strictEqual(repair.itemDeltas.craft_test_part, -1);
    assert.strictEqual(repair.itemDeltas.craft_test_sword ?? 0, 0);
    assert.strictEqual(repair.craftingOutcome?.economyTags[0], "repair");

    const repairMutation = craft(
      {
        kind: "repair_item",
        recipeId: "craft_test_repair",
        stationId: "craft_test_forge",
        targetItemId: "craft_test_sword",
      },
      snapshot({
        items: { craft_test_sword: 1, craft_test_part: 1 },
        knownRecipes: ["craft_test_repair"],
      })
    );
    assert.ok(repairMutation.ok, repairMutation.errors.join(", "));

    const nonRepairMutation = craft(
      {
        kind: "repair_item",
        recipeId: "craft_test_salvage",
        stationId: "craft_test_forge",
        targetItemId: "craft_test_sword",
      },
      snapshot({
        items: { craft_test_sword: 1 },
        knownRecipes: ["craft_test_salvage"],
      })
    );
    assert.ok(!nonRepairMutation.ok);
    assert.ok(
      nonRepairMutation.errors.includes("repair_requires_repair_workflow")
    );

    const salvage = craft(
      {
        recipeId: "craft_test_salvage",
        stationId: "craft_test_forge",
        targetItemId: "craft_test_sword",
      },
      snapshot({
        items: { craft_test_sword: 1 },
        knownRecipes: ["craft_test_salvage"],
      })
    );
    assert.ok(salvage.ok);
    assert.strictEqual(salvage.itemDeltas.craft_test_sword, -1);
    assert.strictEqual(salvage.itemDeltas.craft_test_ingot, 1);

    const upgrade = craft(
      {
        recipeId: "craft_test_upgrade",
        stationId: "craft_test_forge",
        targetItemId: "craft_test_sword",
      },
      snapshot({
        items: { craft_test_sword: 1, craft_test_crystal: 1 },
        knownRecipes: ["craft_test_upgrade"],
      })
    );
    assert.ok(upgrade.ok);
    assert.strictEqual(upgrade.itemDeltas.craft_test_sword, -1);
    assert.strictEqual(upgrade.itemDeltas.craft_test_sword_plus, 1);

    const enchant = craft(
      {
        recipeId: "craft_test_enchant",
        stationId: "craft_test_forge",
        targetItemId: "craft_test_sword_plus",
      },
      snapshot({
        items: { craft_test_sword_plus: 1, craft_test_flux: 1 },
        knownRecipes: ["craft_test_enchant"],
      })
    );
    assert.ok(enchant.ok);
    assert.strictEqual(enchant.itemDeltas.craft_test_sword_plus, -1);
    assert.strictEqual(enchant.itemDeltas.craft_test_sword_warded, 1);
  });

  it("registers the Bikkie-backed production stations and lore recipes", () => {
    ensureHarthmereProductionCraftingCatalogue();
    const stationIds = new Set(
      listHarthmereCraftingStations().map((station) => station.stationId)
    );
    assert.ok(stationIds.has(HARTHMERE_CRAFTING_STATIONS.workbench));
    assert.ok(stationIds.has(HARTHMERE_CRAFTING_STATIONS.thermolite));
    assert.ok(getHarthmereCraftingRecipe("harthmere_bellbinders_voice"));
    assert.ok(getHarthmereCraftingRecipe("harthmere_blacksmith_iron_sword"));
  });

  it("registers Exotic Matter materials as crafting blocks with rich object metadata", () => {
    ensureHarthmereProductionCraftingCatalogue();
    for (const itemId of HARTHMERE_EXOTIC_MATTER_BLOCK_ITEM_IDS) {
      const def = getHarthmereItemDefinition(itemId);
      assert.ok(def, `${itemId} should be registered`);
      assert.strictEqual(def.category, "block");
      assert.strictEqual(def.isCraftingMaterial, true);
      assert.strictEqual(def.objectMetadata?.physicalForm, "block");
      assert.deepStrictEqual(def.objectMetadata?.sizeVoxels, {
        width: 1,
        depth: 1,
        height: 1,
      });
      assert.ok((def.objectMetadata?.colors?.length ?? 0) >= 3);
      assert.ok(def.objectMetadata?.visualDescription);
      assert.strictEqual(
        def.objectMetadata?.procedural?.canGenerateWithVoxels,
        true
      );
      assert.ok((def.objectMetadata?.craftingRoles?.length ?? 0) >= 1);
    }

    const raw = getHarthmereItemDefinition(
      HARTHMERE_EXOTIC_MATTER_ITEM_IDS.rawExoticMatter
    );
    const stable = getHarthmereItemDefinition(
      HARTHMERE_EXOTIC_MATTER_ITEM_IDS.stabilizedExoticMatter
    );
    assert.strictEqual(raw?.objectMetadata?.powerMegawattsPerUnit, 100400);
    assert.strictEqual(stable?.objectMetadata?.powerMegawattsPerUnit, 100400);
    assert.strictEqual(raw?.objectMetadata?.lore?.discoveredYear, 2042);
    assert.strictEqual(raw?.objectMetadata?.lore?.discoveredBy, "Tyrone Smith");

    const portalFuel = getHarthmereItemDefinition(
      HARTHMERE_EXOTIC_MATTER_ITEM_IDS.portalFuel
    );
    const driveCore = getHarthmereItemDefinition(
      HARTHMERE_EXOTIC_MATTER_ITEM_IDS.alcubierreDriveCore
    );
    assert.strictEqual(portalFuel?.objectMetadata?.physicalForm, "fuel_cell");
    assert.strictEqual(driveCore?.objectMetadata?.objectKind, "device");
    assert.ok(
      driveCore?.objectMetadata?.craftingRoles?.includes("teleportation")
    );
  });

  it("registers and crafts home and business crafting stations and decoration items", () => {
    ensureHarthmereProductionCraftingCatalogue();
    const workbenchDef = getHarthmereItemDefinition(
      HARTHMERE_CRAFTING_STATIONS.workbench
    );
    assert.strictEqual(workbenchDef?.category, "crafting station");
    assert.strictEqual(workbenchDef?.objectMetadata?.objectKind, "station");
    assert.strictEqual(
      workbenchDef?.objectMetadata?.physicalForm,
      "crafting_station"
    );

    const cabinetDef = getHarthmereItemDefinition(
      HARTHMERE_HOME_DECORATION_ITEM_IDS.storageCabinet
    );
    assert.strictEqual(cabinetDef?.category, "home decoration");
    assert.strictEqual(cabinetDef?.objectMetadata?.physicalForm, "storage");

    const workbench = craft(
      {
        recipeId: HARTHMERE_CRAFTING_STATION_RECIPE_IDS.workbench,
      },
      snapshot({
        materialStorage: { wood_plank: 4, iron_ingot: 1 },
        knownRecipes: [HARTHMERE_CRAFTING_STATION_RECIPE_IDS.workbench],
      }),
      { carpentry: { level: 5 } }
    );
    assert.ok(workbench.ok, workbench.errors.join(", "));
    assert.strictEqual(
      workbench.itemDeltas[HARTHMERE_CRAFTING_STATIONS.workbench],
      1
    );

    const thermoblasterRecipe = getHarthmereCraftingRecipe(
      HARTHMERE_CRAFTING_STATION_RECIPE_IDS.thermoblaster
    );
    assert.strictEqual(
      thermoblasterRecipe?.requiredStationId,
      HARTHMERE_CRAFTING_STATIONS.workbench
    );
    const thermoblaster = craft(
      {
        recipeId: HARTHMERE_CRAFTING_STATION_RECIPE_IDS.thermoblaster,
        stationId: HARTHMERE_CRAFTING_STATIONS.workbench,
        toolItemIds: [HARTHMERE_CRAFTING_TOOLS.slabber],
      },
      snapshot({
        items: { [HARTHMERE_CRAFTING_TOOLS.slabber]: 1 },
        materialStorage: {
          iron_ingot: 6,
          crystal_shard: 2,
          arcane_dust: 1,
        },
        knownRecipes: [HARTHMERE_CRAFTING_STATION_RECIPE_IDS.thermoblaster],
      }),
      { exotic_refining: { level: 5 } }
    );
    assert.ok(thermoblaster.ok, thermoblaster.errors.join(", "));
    assert.strictEqual(
      thermoblaster.itemDeltas[HARTHMERE_CRAFTING_STATIONS.thermoblaster],
      1
    );

    const cabinet = craft(
      {
        recipeId: HARTHMERE_HOME_DECORATION_RECIPE_IDS.storageCabinet,
        stationId: HARTHMERE_CRAFTING_STATIONS.workbench,
        toolItemIds: [HARTHMERE_CRAFTING_TOOLS.slabber],
      },
      snapshot({
        items: { [HARTHMERE_CRAFTING_TOOLS.slabber]: 1 },
        materialStorage: { wood_plank: 4, iron_ingot: 1 },
        knownRecipes: [HARTHMERE_HOME_DECORATION_RECIPE_IDS.storageCabinet],
      }),
      { carpentry: { level: 5 } }
    );
    assert.ok(cabinet.ok, cabinet.errors.join(", "));
    assert.strictEqual(
      cabinet.itemDeltas[HARTHMERE_HOME_DECORATION_ITEM_IDS.storageCabinet],
      1
    );
    assert.strictEqual(
      cabinet.craftingOutcome?.workOrderTag,
      "home decoration"
    );
  });

  it("crafts antimatter blocks into raw and stabilized Exotic Matter", () => {
    ensureHarthmereProductionCraftingCatalogue();
    const exoticSkills = { exotic_refining: { level: 20 } };

    const antihydrogen = craft(
      {
        recipeId: HARTHMERE_EXOTIC_MATTER_RECIPE_IDS.antihydrogenBlock,
        stationId: HARTHMERE_CRAFTING_STATIONS.thermoblaster,
        toolItemIds: [HARTHMERE_CRAFTING_TOOLS.bucket],
      },
      snapshot({
        items: { [HARTHMERE_CRAFTING_TOOLS.bucket]: 1 },
        materialStorage: {
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.antiprotonCapsule]: 1,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.positronCapsule]: 1,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.containmentFilter]: 1,
        },
        knownRecipes: [HARTHMERE_EXOTIC_MATTER_RECIPE_IDS.antihydrogenBlock],
      }),
      exoticSkills
    );
    assert.ok(antihydrogen.ok, antihydrogen.errors.join(", "));
    // The bucket is an action-only tool with no durability pool; the authority must not
    // emit a durability charge for it (doing so would drive a non-existent value negative).
    assert.strictEqual(
      antihydrogen.craftingOutcome?.toolDurabilityCosts[HARTHMERE_CRAFTING_TOOLS.bucket],
      undefined,
      "no-durability bucket must not be charged tool durability"
    );
    assert.strictEqual(
      antihydrogen.itemDeltas[
        HARTHMERE_EXOTIC_MATTER_ITEM_IDS.antihydrogenBlock
      ],
      1
    );
    assert.strictEqual(
      antihydrogen.materialStorageDeltas[
        HARTHMERE_EXOTIC_MATTER_ITEM_IDS.antiprotonCapsule
      ],
      -1
    );

    const raw = craft(
      {
        recipeId: HARTHMERE_EXOTIC_MATTER_RECIPE_IDS.rawExoticMatter,
        stationId: HARTHMERE_CRAFTING_STATIONS.thermoblaster,
        toolItemIds: [HARTHMERE_CRAFTING_TOOLS.bucket],
      },
      snapshot({
        items: { [HARTHMERE_CRAFTING_TOOLS.bucket]: 1 },
        materialStorage: {
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.antihydrogenBlock]: 1,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.antiheliumBlock]: 1,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.antiboronBlock]: 1,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.containmentFilter]: 2,
        },
        knownRecipes: [HARTHMERE_EXOTIC_MATTER_RECIPE_IDS.rawExoticMatter],
      }),
      exoticSkills
    );
    assert.ok(raw.ok, raw.errors.join(", "));
    assert.strictEqual(
      raw.itemDeltas[HARTHMERE_EXOTIC_MATTER_ITEM_IDS.rawExoticMatter],
      1
    );
    assert.strictEqual(
      raw.materialStorageDeltas[
        HARTHMERE_EXOTIC_MATTER_ITEM_IDS.antiboronBlock
      ],
      -1
    );
    assert.strictEqual(
      raw.craftingOutcome?.businessTypeId,
      "exotic_matter_refinery"
    );
    assert.strictEqual(
      raw.craftingOutcome?.workOrderTag,
      "raw_exotic_matter_synthesis"
    );

    const stabilized = craft(
      {
        recipeId: HARTHMERE_EXOTIC_MATTER_RECIPE_IDS.stabilizedExoticMatter,
        stationId: HARTHMERE_CRAFTING_STATIONS.thermoblaster,
        toolItemIds: [HARTHMERE_CRAFTING_TOOLS.bucket],
      },
      snapshot({
        items: { [HARTHMERE_CRAFTING_TOOLS.bucket]: 1 },
        materialStorage: {
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.rawExoticMatter]: 2,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.stabilizingCrystal]: 1,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.coolant]: 1,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.containmentFilter]: 1,
        },
        knownRecipes: [
          HARTHMERE_EXOTIC_MATTER_RECIPE_IDS.stabilizedExoticMatter,
        ],
      }),
      exoticSkills
    );
    assert.ok(stabilized.ok, stabilized.errors.join(", "));
    assert.strictEqual(
      stabilized.itemDeltas[
        HARTHMERE_EXOTIC_MATTER_ITEM_IDS.stabilizedExoticMatter
      ],
      1
    );
    assert.strictEqual(
      stabilized.materialStorageDeltas[
        HARTHMERE_EXOTIC_MATTER_ITEM_IDS.rawExoticMatter
      ],
      -2
    );
    assert.strictEqual(
      stabilized.craftingOutcome?.workOrderTag,
      "stabilization"
    );
  });

  it("accepts placed Bikkie station ids for station-gated crafting", () => {
    ensureHarthmereProductionCraftingCatalogue();
    const result = craft(
      {
        recipeId: HARTHMERE_EXOTIC_MATTER_RECIPE_IDS.antihydrogenBlock,
        stationId: BikkieIds.thermoblaster,
        toolItemIds: [HARTHMERE_CRAFTING_TOOLS.bucket],
      },
      snapshot({
        items: { [HARTHMERE_CRAFTING_TOOLS.bucket]: 1 },
        materialStorage: {
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.antiprotonCapsule]: 1,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.positronCapsule]: 1,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.containmentFilter]: 1,
        },
        knownRecipes: [HARTHMERE_EXOTIC_MATTER_RECIPE_IDS.antihydrogenBlock],
      }),
      { exotic_refining: { level: 20 } }
    );
    assert.ok(result.ok, result.errors.join(", "));
    assert.strictEqual(
      result.craftingOutcome?.stationId,
      HARTHMERE_CRAFTING_STATIONS.thermoblaster
    );
  });

  it("registers downstream Exotic Matter fuels and cores as station-gated recipes", () => {
    ensureHarthmereProductionCraftingCatalogue();
    for (const recipeId of Object.values(
      HARTHMERE_EXOTIC_MATTER_RECIPE_IDS
    )) {
      const recipe = getHarthmereCraftingRecipe(recipeId);
      assert.ok(recipe, `${recipeId} should be registered`);
      assert.strictEqual(
        recipe.requiredStationId,
        HARTHMERE_CRAFTING_STATIONS.thermoblaster
      );
      assert.ok(recipe.requiredSkillId);
      assert.ok(recipe.businessTypeId);
      assert.ok(recipe.workOrderTag);
    }

    const powerCell = craft(
      {
        recipeId: HARTHMERE_EXOTIC_MATTER_RECIPE_IDS.powerCell,
        stationId: HARTHMERE_CRAFTING_STATIONS.thermoblaster,
        toolItemIds: [HARTHMERE_CRAFTING_TOOLS.slabber],
      },
      snapshot({
        items: { [HARTHMERE_CRAFTING_TOOLS.slabber]: 1 },
        materialStorage: {
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.stabilizedExoticMatter]: 1,
          iron_ingot: 1,
          crystal_shard: 1,
        },
        knownRecipes: [HARTHMERE_EXOTIC_MATTER_RECIPE_IDS.powerCell],
      }),
      { exotic_refining: { level: 20 } }
    );
    assert.ok(powerCell.ok, powerCell.errors.join(", "));
    assert.strictEqual(
      powerCell.itemDeltas[
        HARTHMERE_EXOTIC_MATTER_ITEM_IDS.exoticMatterPowerCell
      ],
      1
    );
    assert.strictEqual(
      powerCell.craftingOutcome?.workOrderTag,
      "power_cell_assembly"
    );
    assert.strictEqual(
      powerCell.craftingOutcome?.toolDurabilityCosts[
        HARTHMERE_CRAFTING_TOOLS.slabber
      ],
      1
    );
  });

  it("requires the Bellbound Q5 forge sequence and unlocks Bell-Bronze Ingot", () => {
    ensureHarthmereProductionCraftingCatalogue();
    const base = snapshot({
      items: {
        bell_bronze_ingot: 1,
        meteoric_trace: 1,
        [HARTHMERE_CRAFTING_TOOLS.slabber]: 1,
      },
      knownRecipes: ["harthmere_bellbinders_voice"],
    });
    const wrongSteps = craft(
      {
        recipeId: "harthmere_bellbinders_voice",
        stationId: HARTHMERE_CRAFTING_STATIONS.thermolite,
        toolItemIds: [HARTHMERE_CRAFTING_TOOLS.slabber],
        workflowStepIds: ["smelt_meteoric_trace"],
      },
      base,
      { bell_forging: { level: 3 } }
    );
    assert.ok(!wrongSteps.ok);
    assert.ok(wrongSteps.errors.includes("quest_crafting_steps_not_completed"));

    const result = craft(
      {
        recipeId: "harthmere_bellbinders_voice",
        stationId: HARTHMERE_CRAFTING_STATIONS.thermolite,
        toolItemIds: [HARTHMERE_CRAFTING_TOOLS.slabber],
        workflowStepIds: [
          "smelt_meteoric_trace",
          "match_alloy_ratio",
          "strike_rhythm",
          "tune_bell",
        ],
      },
      base,
      { bell_forging: { level: 4 } }
    );
    assert.ok(result.ok, result.errors.join(", "));
    assert.strictEqual(result.itemDeltas.bellbinders_voice, 1);
    assert.strictEqual(result.craftingOutcome?.binding, "quest");
    assert.ok(result.newRecipeIds.includes("harthmere_bell_bronze_ingot"));
    const applied = applyHarthmereInventoryMutationResult(base, result);
    assert.ok(applied.knownRecipes.includes("harthmere_bell_bronze_ingot"));
  });
});

describe("Production crafting catalogue integrity (audit hardening)", () => {
  before(() => {
    ensureHarthmereProductionCraftingCatalogue();
  });

  it("has unique recipe IDs and resolves every referenced item and tool", () => {
    const ids = harthmereProductionCraftingRecipeIds();
    assert.strictEqual(new Set(ids).size, ids.length, "duplicate production recipe IDs");
    for (const id of ids) {
      const recipe = getHarthmereCraftingRecipe(id);
      assert.ok(recipe, `recipe ${id} not registered`);
      if (!recipe) continue;
      // Repair / salvage recipes legitimately have outputCount 0 (they modify the target
      // item rather than producing a new one); only require a resolvable output when one
      // is actually produced.
      assert.ok(recipe.outputCount >= 0, `${id}: negative outputCount`);
      if (recipe.outputCount > 0) {
        assert.ok(getHarthmereItemDefinition(recipe.outputItemId), `${id}: output ${recipe.outputItemId} unregistered`);
      }
      for (const input of recipe.inputs ?? []) {
        assert.ok(getHarthmereItemDefinition(input.itemId), `${id}: input ${input.itemId} unregistered`);
        assert.ok(input.count > 0, `${id}: non-positive input count for ${input.itemId}`);
      }
      for (const target of recipe.targetItemIds ?? []) {
        assert.ok(getHarthmereItemDefinition(target), `${id}: target ${target} unregistered`);
      }
      for (const toolId of recipe.requiredToolIds ?? []) {
        assert.ok(getHarthmereCraftingTool(toolId), `${id}: required tool ${toolId} unregistered`);
      }
    }
  });

  it("classifies pure crafting ingredients as materials and finished goods as non-materials", () => {
    ensureHarthmereProductionCraftingCatalogue();
    for (const itemId of ["repair_part", "bell_metal_fragment", "river_reed"]) {
      assert.strictEqual(
        getHarthmereItemDefinition(itemId)?.isCraftingMaterial,
        true,
        `${itemId} should be a bulk crafting material`
      );
    }
    assert.strictEqual(
      getHarthmereItemDefinition("road_repair_kit")?.isCraftingMaterial,
      false,
      "road_repair_kit is a finished good, not a bulk material"
    );
  });
});
