import assert from "assert";
import { HARTHMERE_BUSINESS_OUTPOSTS } from "../business_customer_simulator";
import {
  harthmereMaterialAcquisitionPlan,
  normalizeHarthmereMaterialItemId,
} from "../material_acquisition_guidance";
import { harthmereNativeBiomesIdForItemId } from "../harthmere_native_item_ids";

describe("Harthmere material acquisition guidance", () => {
  it("explains every real way to obtain Workbench iron", () => {
    const plan = harthmereMaterialAcquisitionPlan({
      itemId: "iron_ingot",
      count: 1,
    })!;
    assert.ok(
      plan.routes.some(
        (route) =>
          route.kind === "buy" &&
          route.sourceName === "Cinderlane Tool Forge" &&
          route.description.startsWith("Head to Cinderlane Tool Forge")
      ),
      "direct iron ingots should be buyable at the weapons/tool business"
    );
    const smelt = plan.routes.find(
      (route) =>
        route.kind === "craft" && route.sourceName.includes("Thermolite")
    );
    assert.ok(smelt, "iron ingots should explain the Thermolite route");
    assert.deepEqual(
      smelt!.inputs?.map(({ itemId, count }) => ({ itemId, count })),
      [
        { itemId: "iron_ore", count: 3 },
        { itemId: "coal", count: 1 },
      ]
    );
    assert.ok(
      plan.routes.some(
        (route) =>
          route.kind === "gather" &&
          route.sourceName === "North Road Iron Vein" &&
          route.description.startsWith("Head to North Road Iron Vein") &&
          route.requirements?.some((requirement) =>
            requirement.includes("Rusty Pickaxe")
          )
      )
    );
    assert.ok(
      plan.routes.some(
        (route) =>
          route.kind === "buy" &&
          route.itemId === "rusty_pickaxe" &&
          route.purpose === "Needed to gather Iron Ore" &&
          route.markerPosition
      ),
      "the blocked gather route should explain where to buy its pickaxe"
    );
    assert.ok(
      plan.routes.some(
        (route) =>
          route.kind === "gather" &&
          route.sourceName === "Bandit Ridge Coal Seam"
      )
    );
  });

  it("explains how to buy, craft, and gather enough Wood Planks", () => {
    const plan = harthmereMaterialAcquisitionPlan({
      itemId: "wood_plank",
      count: 4,
    })!;
    assert.ok(
      plan.routes.some(
        (route) =>
          route.kind === "buy" && route.sourceName === "Keylot Property Office"
      )
    );
    const fountain = plan.routes.find(
      (route) =>
        route.kind === "craft" && route.sourceName === "Fountain Workbench"
    );
    assert.ok(fountain, "the public Workbench should avoid a crafting loop");
    assert.ok(
      fountain!.description.startsWith("Head to Fountain Workbench"),
      "the recipe must tell the player to travel to the crafting station"
    );
    assert.deepEqual(
      fountain!.inputs?.map(({ itemId, count }) => ({ itemId, count })),
      [{ itemId: "softwood_log", count: 4 }]
    );
    assert.ok(
      plan.routes.some(
        (route) =>
          route.kind === "gather" &&
          route.sourceName === "Orchard Softwood Branches" &&
          route.requirements?.some((requirement) =>
            requirement.includes("Woodcutter")
          )
      )
    );
    assert.ok(
      plan.routes.some(
        (route) =>
          route.kind === "buy" &&
          route.itemId === "woodcutters_axe" &&
          route.purpose === "Needed to gather Softwood Log" &&
          route.markerPosition
      ),
      "the logging route should explain where to buy its axe"
    );
  });

  it("supports staged home materials and native blueprint item ids", () => {
    const roughStone = harthmereMaterialAcquisitionPlan({
      itemId: "rough_stone",
      count: 4,
    })!;
    assert.ok(roughStone.routes.some((route) => route.kind === "buy"));
    assert.ok(roughStone.routes.some((route) => route.kind === "gather"));

    const nativeWoodPlank = harthmereNativeBiomesIdForItemId("wood_plank")!;
    assert.equal(
      normalizeHarthmereMaterialItemId(nativeWoodPlank, "Wood Plank"),
      "wood_plank"
    );
  });

  it("uses finite existing map destinations and audits all 19 businesses", () => {
    assert.equal(HARTHMERE_BUSINESS_OUTPOSTS.length, 19);
    for (const itemId of [
      "iron_ingot",
      "wood_plank",
      "iron_ore",
      "coal",
      "softwood_log",
      "rough_stone",
    ]) {
      const plan = harthmereMaterialAcquisitionPlan({ itemId, count: 1 })!;
      for (const route of plan.routes) {
        if (!route.markerPosition) continue;
        assert.ok(
          route.markerPosition.every(Number.isFinite),
          `${route.id} should reuse a finite canonical map position`
        );
      }
    }
  });
});
