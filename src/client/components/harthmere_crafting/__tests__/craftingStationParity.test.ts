import assert from "assert";

import {
  HARTHMERE_CRAFTING_STATIONS,
  ensureHarthmereProductionCraftingCatalogue,
} from "@/shared/harthmere/mmo_crafting_catalogue";
import {
  createHarthmereCraftingStationAdapter,
  createHarthmereCraftingVisibleRecipes,
  filterHarthmereCraftingRecipes,
  harthmereCraftingAlternativeRecipes,
  harthmereCraftingHandcraftPartition,
  harthmereCraftingMaxCraftable,
  harthmereCraftingRecipeDetail,
  normalizeHarthmereCraftingStationClientSnapshot,
} from "../";

// HARTHMERE_CRAFTING_UI_PARITY: the BiomesUI panel must match the old
// crafting table's functionality. These assert the adapter-level features that
// back the detail pane, batch selector, search, alternatives, and handcraft tabs.

function snapshotWith(overrides = {}) {
  ensureHarthmereProductionCraftingCatalogue();
  return normalizeHarthmereCraftingStationClientSnapshot({
    actorId: "parity_actor",
    stationId: HARTHMERE_CRAFTING_STATIONS.workbench,
    gold: 100,
    inventoryItems: {},
    materialStorage: { softwood_log: 8 },
    knownRecipes: ["harthmere_carpentry_wood_plank"],
    skills: { carpentry: { level: 5 } },
    nowMs: 1000,
    ...overrides,
  });
}

describe("crafting UI parity (V151)", () => {
  it("recipe detail breakdown exposes ingredients with have/need + output + quality + workflow", () => {
    const snapshot = snapshotWith();
    const adapter = createHarthmereCraftingStationAdapter({ state: snapshot });
    const detail = adapter.getRecipeDetail("harthmere_carpentry_wood_plank");
    assert.ok(detail, "detail should resolve for a known recipe");
    assert.ok(detail!.ingredients.length >= 1, "has ingredient lines");
    for (const ing of detail!.ingredients) {
      assert.equal(typeof ing.need, "number");
      assert.equal(typeof ing.have, "number");
      assert.equal(ing.enough, ing.have >= ing.need);
      assert.ok(ing.name && !ing.name.includes("_"), `clean name: ${ing.name}`);
    }
    assert.ok(detail!.outputName);
    assert.ok(detail!.outputCount >= 1);
    assert.ok(detail!.qualityLabel);
    assert.ok(detail!.workflowLabel);
    assert.equal(typeof detail!.maxCraftable, "number");
  });

  it("max-craftable reflects available materials and gold", () => {
    ensureHarthmereProductionCraftingCatalogue();
    const recipe = createHarthmereCraftingVisibleRecipes(snapshotWith()).find(
      (e) => e.recipe.recipeId === "harthmere_carpentry_wood_plank"
    )!.recipe;
    // Use the recipe's own required station so it is station-OK here.
    const atStation = (overrides = {}) =>
      snapshotWith({ stationId: recipe.requiredStationId, ...overrides });
    // Plenty of wood -> can batch several (2 softwood_log per batch, 20 wood -> 10).
    const plenty = harthmereCraftingMaxCraftable(
      recipe,
      atStation({ materialStorage: { softwood_log: 20 } })
    );
    assert.ok(plenty >= 1, `plenty: ${plenty}`);
    // No materials -> zero.
    const none = harthmereCraftingMaxCraftable(
      recipe,
      atStation({ materialStorage: {} })
    );
    assert.equal(none, 0);
    // Unknown recipe -> zero (can't craft any here).
    const unknown = harthmereCraftingMaxCraftable(
      recipe,
      atStation({ knownRecipes: [] })
    );
    assert.equal(unknown, 0);
    // Wrong station (kitchen, not the recipe's workbench) -> zero even with materials.
    const wrongStation = harthmereCraftingMaxCraftable(
      recipe,
      snapshotWith({
        stationId: HARTHMERE_CRAFTING_STATIONS.kitchen,
        materialStorage: { softwood_log: 20 },
      })
    );
    assert.equal(wrongStation, 0);
  });

  it("search filters recipes by name/output", () => {
    const recipes = createHarthmereCraftingVisibleRecipes(snapshotWith());
    const all = recipes.length;
    assert.ok(all >= 1);
    const hits = filterHarthmereCraftingRecipes(recipes, "plank");
    assert.ok(hits.length >= 1 && hits.length <= all);
    assert.equal(
      filterHarthmereCraftingRecipes(recipes, "zzz_no_match").length,
      0
    );
    assert.equal(filterHarthmereCraftingRecipes(recipes, "  ").length, all);
  });

  it("alternative recipes group by output item", () => {
    const recipes = createHarthmereCraftingVisibleRecipes(snapshotWith());
    const first = recipes[0];
    const alts = harthmereCraftingAlternativeRecipes(
      recipes,
      first.recipe.outputItemId
    );
    assert.ok(
      alts.every((a) => a.recipe.outputItemId === first.recipe.outputItemId)
    );
    assert.ok(alts.some((a) => a.recipe.recipeId === first.recipe.recipeId));
  });

  it("handcraft partition splits station-only from handcraft recipes", () => {
    const recipes = createHarthmereCraftingVisibleRecipes(snapshotWith());
    const { handcraft, station } = harthmereCraftingHandcraftPartition(recipes);
    assert.equal(handcraft.length + station.length, recipes.length);
    for (const e of station) {
      assert.ok(e.recipe.requiredStationId || e.recipe.requiredStationType);
    }
    for (const e of handcraft) {
      assert.ok(!e.recipe.requiredStationId && !e.recipe.requiredStationType);
    }
  });

  it("batch crafting is supported through the craft payload count", async () => {
    let sent: any;
    const adapter = createHarthmereCraftingStationAdapter({
      state: snapshotWith(),
      submit: async (payload) => {
        sent = payload;
        return { ok: true };
      },
    });
    await adapter.craft("harthmere_carpentry_wood_plank", { count: 3 });
    assert.equal(sent.recipeId, "harthmere_carpentry_wood_plank");
    assert.equal(sent.count, 3);
    assert.equal(sent.jobAction, "instant");
  });
});
