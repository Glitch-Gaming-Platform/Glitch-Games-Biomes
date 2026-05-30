import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  HARTHMERE_CRAFTING_STATIONS_V1,
  HARTHMERE_CRAFTING_TOOLS_V1,
  HARTHMERE_EXOTIC_MATTER_RECIPE_IDS_V1,
  ensureHarthmereProductionCraftingCatalogueV1,
} from "@/shared/harthmere/mmo_crafting_catalogue_v1";
import {
  HarthmereCraftingStationPanel,
  createHarthmereCraftingStationAdapterV1,
  createHarthmereCraftingVisibleRecipesV1,
  formatHarthmereCraftingPlayerErrorV1,
  normalizeHarthmereCraftingStationClientSnapshotV1,
  type HarthmereCraftingStationSubmitPayloadV1,
} from "../";

describe("HarthmereCraftingStationPanel", () => {
  it("renders as a separate BiomesUI-styled station interface with pointer and keyboard affordances", () => {
    ensureHarthmereProductionCraftingCatalogueV1();
    const snapshot = normalizeHarthmereCraftingStationClientSnapshotV1({
      actorId: "craft_ui_actor",
      stationId: HARTHMERE_CRAFTING_STATIONS_V1.workbench,
      gold: 20,
      inventoryItems: { [HARTHMERE_CRAFTING_TOOLS_V1.simpleAxe]: 1 },
      materialStorage: { wood_log: 4 },
      knownRecipes: ["harthmere_carpentry_wood_plank"],
      skills: { carpentry: { level: 2 } },
      nowMs: 1000,
    });
    const adapter = createHarthmereCraftingStationAdapterV1({
      state: snapshot,
      hydrated: true,
      submit: async () => ({ ok: true, craftingState: snapshot }),
    });
    const html = renderToStaticMarkup(
      React.createElement(HarthmereCraftingStationPanel, { adapter })
    );
    assert.ok(
      html.includes('data-harthmere-crafting-station-interface="true"')
    );
    assert.ok(html.includes('data-pointer-lock-policy="unlock-while-open"'));
    assert.ok(html.includes('data-mouse-policy="show-while-open"'));
    assert.ok(html.includes('aria-label="Crafting station sections"'));
    assert.ok(html.includes('role="grid"'));
    assert.ok(html.includes("Workbench"));
    assert.ok(html.includes("Wood Plank"));
    assert.ok(html.includes('data-harthmere-crafting-visual="true"'));
    assert.ok(html.includes('data-visual-source="procedural_voxel"'));
    assert.ok(html.includes("Close crafting station"));
    const visibleText = html.replace(/<[^>]*>/g, " ");
    assert.ok(!visibleText.includes("_"), visibleText);
    assert.ok(!/harthmere/i.test(visibleText), visibleText);
    assert.ok(!/\b[a-z]+[A-Z][A-Za-z]*\b/.test(visibleText), visibleText);
  });

  it("normalizes visible recipes with station gates and missing material reasons", () => {
    ensureHarthmereProductionCraftingCatalogueV1();
    const snapshot = normalizeHarthmereCraftingStationClientSnapshotV1({
      stationId: HARTHMERE_CRAFTING_STATIONS_V1.workbench,
      knownRecipes: ["harthmere_carpentry_wood_plank"],
      skills: { carpentry: { level: 2 } },
      materialStorage: {},
    });
    const recipes = createHarthmereCraftingVisibleRecipesV1(snapshot);
    const plank = recipes.find(
      (entry) => entry.recipe.recipeId === "harthmere_carpentry_wood_plank"
    );
    assert.ok(plank);
    assert.strictEqual(plank?.stationOk, true);
    assert.strictEqual(plank?.canCraft, false);
    assert.ok(plank?.missing.some((entry) => /Wood Log/i.test(entry)));
    assert.ok(plank?.missing.includes("Tool"));
    assert.ok(plank?.outputVisual.primaryHex);
    assert.equal(plank?.outputVisual.procedural.canGenerateWithVoxels, true);
  });

  it("exposes Exotic Matter recipe outputs as voxel block visuals", () => {
    ensureHarthmereProductionCraftingCatalogueV1();
    const snapshot = normalizeHarthmereCraftingStationClientSnapshotV1({
      stationId: HARTHMERE_CRAFTING_STATIONS_V1.thermoblaster,
      knownRecipes: [
        HARTHMERE_EXOTIC_MATTER_RECIPE_IDS_V1.stabilizedExoticMatter,
      ],
      skills: { exotic_refining: { level: 6 } },
    });
    const recipes = createHarthmereCraftingVisibleRecipesV1(snapshot);
    const exoticBlock = recipes.find(
      (entry) =>
        entry.recipe.recipeId ===
        HARTHMERE_EXOTIC_MATTER_RECIPE_IDS_V1.stabilizedExoticMatter
    );
    assert.ok(exoticBlock);
    assert.equal(exoticBlock?.outputVisual.shape, "block");
    assert.equal(exoticBlock?.outputVisual.source, "procedural_voxel");
    assert.equal(exoticBlock?.outputVisual.procedural.canGenerateWithVoxels, true);
  });

  it("maps craft, start, complete, and cancel actions to request_crafting payloads", async () => {
    const snapshot = normalizeHarthmereCraftingStationClientSnapshotV1({
      stationId: HARTHMERE_CRAFTING_STATIONS_V1.workbench,
    });
    const payloads: HarthmereCraftingStationSubmitPayloadV1[] = [];
    const adapter = createHarthmereCraftingStationAdapterV1({
      state: snapshot,
      submit: async (payload) => {
        payloads.push(payload);
        return { ok: true, craftingState: snapshot };
      },
    });
    await adapter.craft("harthmere_carpentry_wood_plank", { count: 2 });
    await adapter.startJob("harthmere_blacksmith_repair_iron_sword", {
      stationId: HARTHMERE_CRAFTING_STATIONS_V1.thermolite,
    });
    await adapter.completeJob("craft_craft_ui_actor_1");
    await adapter.cancelJob("craft_craft_ui_actor_2");
    assert.deepStrictEqual(
      payloads.map((payload) => payload.jobAction),
      ["instant", "start", "complete", "cancel"]
    );
    assert.strictEqual(payloads[0].recipeId, "harthmere_carpentry_wood_plank");
    assert.strictEqual(
      payloads[0].stationId,
      HARTHMERE_CRAFTING_STATIONS_V1.workbench
    );
    assert.strictEqual(
      payloads[1].stationId,
      HARTHMERE_CRAFTING_STATIONS_V1.thermolite
    );
    assert.strictEqual(payloads[2].craftingJobId, "craft_craft_ui_actor_1");
    assert.strictEqual(payloads[3].craftingJobId, "craft_craft_ui_actor_2");
  });

  it("turns internal crafting warning codes into player-facing text", () => {
    const message = formatHarthmereCraftingPlayerErrorV1([
      "crafting_rejected:missing_tool_action:shape",
      "crafting_rejected:tool_durability_depleted:7539420629350252",
    ]);
    assert.strictEqual(
      message,
      "You need the right tool. That tool needs repair."
    );
    assert.ok(!message.includes("_"));
    assert.ok(!message.includes(":"));
  });
});
