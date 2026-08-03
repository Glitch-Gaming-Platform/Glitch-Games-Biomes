import assert from "assert";
import { HARTHMERE_BUSINESS_OUTPOSTS } from "../business_customer_simulator";
import {
  harthmereMaterialAcquisitionPlan,
  normalizeHarthmereMaterialItemId,
  resolveHarthmereMaterialRoutePositionForTest,
} from "../material_acquisition_guidance";
import { harthmereNativeBiomesIdForItemId } from "../harthmere_native_item_ids";
import { CH1_QUESTS } from "../ch1_quests";
import { ch1ObjectiveMaterialRequirements } from "../ch1_material_objectives";
import { SNAPSHOT_GROVE_LIVE_NPC_FEET_Y } from "../snapshot_grove_content";

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

  it("uses the live Grove floor and the same resolved coordinates the map pin uses", () => {
    const scrap = harthmereMaterialAcquisitionPlan({
      itemId: "scrap_metal",
      count: 4,
    })!;
    const resin = harthmereMaterialAcquisitionPlan({
      itemId: "tree_resin",
      count: 1,
    })!;
    for (const [plan, sourceName] of [
      [scrap, "Luis"],
      [scrap, "Mel the Handyman"],
      [resin, "Rin the Forager"],
    ] as const) {
      const route = plan.routes.find(
        (candidate) =>
          candidate.kind === "buy" && candidate.sourceName === sourceName
      );
      assert.ok(route?.markerPosition, `${sourceName} needs a map position`);
      assert.equal(
        route!.markerPosition![1],
        SNAPSHOT_GROVE_LIVE_NPC_FEET_Y,
        `${sourceName} must use the live Grove floor instead of retired Y=53`
      );
      assert.deepEqual(
        route!.markerPosition,
        resolveHarthmereMaterialRoutePositionForTest(
          route!.markerId,
          route!.markerPosition!
        ),
        `${sourceName} guide coordinates must match the active map pin`
      );
    }
  });

  it("gives every Chapter 1 material requirement a real player-selected route", () => {
    const materialSteps = CH1_QUESTS.flatMap((quest) =>
      quest.steps.flatMap((step) => {
        const requirements = ch1ObjectiveMaterialRequirements(step);
        return requirements.length ? [{ quest, step, requirements }] : [];
      })
    );
    assert.deepEqual(
      materialSteps.map(({ step }) => step.id),
      ["gather_parts", "provision", "provision_winter"]
    );

    for (const { quest, step, requirements } of materialSteps) {
      for (const requirement of requirements) {
        assert.ok(requirement.options.length > 0);
        for (const option of requirement.options) {
          const plan = harthmereMaterialAcquisitionPlan({
            itemId: option.itemId,
            itemName: option.itemName,
            count: requirement.count,
          });
          assert.ok(
            plan?.routes.length,
            `${quest.title}/${step.title}/${option.itemId} needs a real acquisition route`
          );
          assert.ok(
            plan!.routes.some((route) => route.markerPosition),
            `${quest.title}/${step.title}/${option.itemId} needs a map-trackable route`
          );
        }
      }
    }

    const gatherParts = materialSteps.find(
      ({ step }) => step.id === "gather_parts"
    )!;
    assert.deepEqual(
      gatherParts.requirements.map(({ count, options }) => [
        options[0].itemId,
        count,
      ]),
      [
        ["scrap_metal", 4],
        ["iron_ingot", 2],
        ["tree_resin", 1],
      ]
    );
  });
});
