// Frontend surfacing test: the specialized blocks + placeable decor registered
// by the backend catalogues must actually appear in the client-facing crafting
// recipe list (the surface the crafting station panel renders), at the right
// station. This closes the loop from "registered" to "the player can see/craft it".
import assert from "assert";
import {
  createHarthmereCraftingVisibleRecipesV1,
  normalizeHarthmereCraftingStationClientSnapshotV1,
} from "../craftingStationLiveAdapter";
import { HARTHMERE_CRAFTING_STATIONS_V1 } from "@/shared/harthmere/mmo_crafting_catalogue_v1";
import {
  HARTHMERE_SPECIALIZED_BLOCK_STATIONS_V1,
  ensureHarthmereSpecializedBlocksCatalogueV1,
  specializedBlockRecipeIdV1,
} from "@/shared/harthmere/mmo_specialized_blocks_catalogue_v1";
import {
  ensureHarthmerePlaceableDecorCatalogueV1,
  placeableDecorRecipeIdV1,
} from "@/shared/harthmere/mmo_placeable_decor_catalogue_v1";

describe("specialized craftables surface in the client crafting UI", () => {
  before(() => {
    ensureHarthmereSpecializedBlocksCatalogueV1();
    ensureHarthmerePlaceableDecorCatalogueV1();
  });

  it("shows a specialized block recipe at its station (Stonecutter)", () => {
    const snapshot = normalizeHarthmereCraftingStationClientSnapshotV1({
      stationId: HARTHMERE_SPECIALIZED_BLOCK_STATIONS_V1.stonecutter,
    });
    const visible = createHarthmereCraftingVisibleRecipesV1(snapshot);
    const recipeId = specializedBlockRecipeIdV1("cobblestone_brick");
    const entry = visible.find((v) => v.recipe.recipeId === recipeId);
    assert.ok(entry, "cobblestone_brick recipe should surface at the Stonecutter");
    assert.ok(entry!.stationOk, "should be flagged as the correct station");
  });

  it("shows a placeable decor recipe at its station (Workbench)", () => {
    const snapshot = normalizeHarthmereCraftingStationClientSnapshotV1({
      stationId: HARTHMERE_CRAFTING_STATIONS_V1.workbench,
    });
    const visible = createHarthmereCraftingVisibleRecipesV1(snapshot);
    const recipeId = placeableDecorRecipeIdV1("bench");
    const entry = visible.find((v) => v.recipe.recipeId === recipeId);
    assert.ok(entry, "bench decor recipe should surface at the Workbench");
    assert.ok(entry!.stationOk, "should be flagged as the correct station");
  });

  it("does not surface a block recipe at the wrong station", () => {
    const snapshot = normalizeHarthmereCraftingStationClientSnapshotV1({
      stationId: HARTHMERE_SPECIALIZED_BLOCK_STATIONS_V1.forge,
    });
    const visible = createHarthmereCraftingVisibleRecipesV1(snapshot);
    const recipeId = specializedBlockRecipeIdV1("cobblestone_brick");
    const entry = visible.find((v) => v.recipe.recipeId === recipeId);
    // It may appear only if "known"; for a fresh snapshot it must not show at
    // the Forge (wrong station) since the stone recipes belong to the Stonecutter.
    assert.ok(!entry, "stone recipe must not surface at the Forge");
  });
});
