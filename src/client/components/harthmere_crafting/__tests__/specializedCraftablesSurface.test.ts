// Frontend surfacing test: the specialized blocks + placeable decor registered
// by the backend catalogues must actually appear in the client-facing crafting
// recipe list (the surface the crafting station panel renders), at the right
// station. This closes the loop from "registered" to "the player can see/craft it".
import assert from "assert";
import {
  createHarthmereCraftingVisibleRecipes,
  normalizeHarthmereCraftingStationClientSnapshot,
} from "../craftingStationLiveAdapter";
import { HARTHMERE_CRAFTING_STATIONS } from "@/shared/harthmere/mmo_crafting_catalogue";
import {
  HARTHMERE_SPECIALIZED_BLOCK_STATIONS,
  ensureHarthmereSpecializedBlocksCatalogue,
  specializedBlockRecipeId,
} from "@/shared/harthmere/mmo_specialized_blocks_catalogue";
import {
  ensureHarthmerePlaceableDecorCatalogue,
  placeableDecorRecipeId,
} from "@/shared/harthmere/mmo_placeable_decor_catalogue";

describe("specialized craftables surface in the client crafting UI", () => {
  before(() => {
    ensureHarthmereSpecializedBlocksCatalogue();
    ensureHarthmerePlaceableDecorCatalogue();
  });

  it("shows a specialized block recipe at its station (Stonecutter)", () => {
    const snapshot = normalizeHarthmereCraftingStationClientSnapshot({
      stationId: HARTHMERE_SPECIALIZED_BLOCK_STATIONS.stonecutter,
    });
    const visible = createHarthmereCraftingVisibleRecipes(snapshot);
    const recipeId = specializedBlockRecipeId("cobblestone_brick");
    const entry = visible.find((v) => v.recipe.recipeId === recipeId);
    assert.ok(entry, "cobblestone_brick recipe should surface at the Stonecutter");
    assert.ok(entry!.stationOk, "should be flagged as the correct station");
  });

  it("shows a placeable decor recipe at its station (Workbench)", () => {
    const snapshot = normalizeHarthmereCraftingStationClientSnapshot({
      stationId: HARTHMERE_CRAFTING_STATIONS.workbench,
    });
    const visible = createHarthmereCraftingVisibleRecipes(snapshot);
    const recipeId = placeableDecorRecipeId("bench");
    const entry = visible.find((v) => v.recipe.recipeId === recipeId);
    assert.ok(entry, "bench decor recipe should surface at the Workbench");
    assert.ok(entry!.stationOk, "should be flagged as the correct station");
  });

  it("does not surface a block recipe at the wrong station", () => {
    const snapshot = normalizeHarthmereCraftingStationClientSnapshot({
      stationId: HARTHMERE_SPECIALIZED_BLOCK_STATIONS.forge,
    });
    const visible = createHarthmereCraftingVisibleRecipes(snapshot);
    const recipeId = specializedBlockRecipeId("cobblestone_brick");
    const entry = visible.find((v) => v.recipe.recipeId === recipeId);
    // It may appear only if "known"; for a fresh snapshot it must not show at
    // the Forge (wrong station) since the stone recipes belong to the Stonecutter.
    assert.ok(!entry, "stone recipe must not surface at the Forge");
  });
});
