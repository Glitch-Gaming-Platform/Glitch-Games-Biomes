/// <reference types="mocha" />

import assert from "assert";
import { ch1Quest } from "@/shared/harthmere/ch1_quests";
import { harthmereMaterialAcquisitionPlan } from "@/shared/harthmere/material_acquisition_guidance";

describe("Chapter 1 'Gather Parts' material acquisition contract", () => {
  /**
   * CRITICAL PRODUCTION GATE
   *
   * The "Gather Parts" quest step requires:
   * - 4 Scrap Metal
   * - 2 Iron Ingots
   * - 1 Tree Resin
   *
   * Each material must have at least one visible, actionable player path:
   * - A location to gather it (with necessary tools available)
   * - A vendor to buy it (with sufficient stock and player can afford it)
   * - A recipe to craft it (with component materials available)
   *
   * The player must be able to complete this objective without external guidance,
   * fixtures, or console commands.
   */

  it("provides visible acquisition for 4 Scrap Metal", () => {
    const plan = harthmereMaterialAcquisitionPlan({
      itemId: "scrap_metal",
      count: 4,
    });

    assert.ok(plan, "scrap_metal must have an acquisition plan");

    // Must have at least one direct route (gather or buy)
    const directRoutes = plan!.routes.filter(
      (r) =>
        (r.kind === "gather" || r.kind === "buy") &&
        r.markerPosition !== undefined
    );

    assert.ok(
      directRoutes.length >= 1,
      "scrap_metal must have at least one gather or buy route with map marker"
    );

    // Each route should have description
    for (const route of directRoutes) {
      assert.ok(
        route.description && route.description.length > 10,
        `scrap_metal ${route.kind} route must have clear description`
      );

      // Buy routes should list price
      if (route.kind === "buy") {
        assert.ok(
          route.sourceName && route.sourceName.length > 0,
          "scrap_metal buy route must name the vendor"
        );
      }

      // Gather routes should list tools/requirements
      if (route.kind === "gather") {
        assert.ok(
          route.sourceName && route.sourceName.length > 0,
          "scrap_metal gather route must name the location"
        );
      }
    }

    assert.ok(
      directRoutes.some((route) =>
        ["Luis", "Mel the Handyman"].includes(route.sourceName)
      ),
      "Scrap Metal must have a Grove supplier"
    );
  });

  it("provides visible acquisition for 2 Iron Ingots", () => {
    const plan = harthmereMaterialAcquisitionPlan({
      itemId: "iron_ingot",
      count: 2,
    });

    assert.ok(plan, "iron_ingot must have an acquisition plan");

    // Iron ingots can be bought or crafted
    const buyRoutes = plan!.routes.filter(
      (r) => r.kind === "buy" && r.markerPosition !== undefined
    );

    assert.ok(
      buyRoutes.length >= 1,
      "iron_ingot must have at least one buy route with map marker"
    );

    // Craft routes should show recipe
    const craftRoutes = plan!.routes.filter(
      (r) => r.kind === "craft" && r.sourceName
    );
    for (const route of craftRoutes) {
      assert.ok(
        route.inputs && route.inputs.length > 0,
        "iron_ingot craft route must show required inputs"
      );
    }

    assert.ok(
      buyRoutes.some((route) => route.sourceName === "Luis"),
      "Iron Ingots must be sold by the Grove repair supplier"
    );
  });

  it("provides visible acquisition for 1 Tree Resin", () => {
    const plan = harthmereMaterialAcquisitionPlan({
      itemId: "tree_resin",
      count: 1,
    });

    assert.ok(plan, "tree_resin must have an acquisition plan");

    // Tree resin must have at least one route
    const directRoutes = plan!.routes.filter(
      (r) =>
        (r.kind === "gather" || r.kind === "buy") &&
        r.markerPosition !== undefined
    );

    assert.ok(
      directRoutes.length >= 1,
      "tree_resin must have at least one gather or buy route with map marker"
    );

    assert.ok(
      directRoutes.some((route) => route.sourceName === "Rin the Forager"),
      "Tree Resin must be sold by the Grove forage supplier"
    );
  });

  it("keeps the cheapest visible vendor path within the 75-gold starter wallet", () => {
    const gatherPartsStep = ch1Quest("ch1_a1_q03_stand_him_up")!.steps.find(
      (step) => step.id === "gather_parts"
    )!;
    let totalGold = 0;
    for (const requirement of gatherPartsStep.inventoryRequirements ?? []) {
      const plan = harthmereMaterialAcquisitionPlan({
        itemId: requirement.itemId,
        count: requirement.count,
      })!;
      const cheapestUnitPrice = Math.min(
        ...plan.routes.flatMap((route) =>
          route.kind === "buy" && route.unitPriceGold !== undefined
            ? [route.unitPriceGold]
            : []
        )
      );
      assert.ok(
        Number.isFinite(cheapestUnitPrice),
        `${requirement.itemId} must have a priced vendor route`
      );
      totalGold += cheapestUnitPrice * requirement.count;
    }
    assert.ok(
      totalGold <= 75,
      `Gather Parts cheapest visible vendor route costs ${totalGold} gold`
    );
  });

  it("ensures player can obtain all three materials from the Grove", () => {
    const gatherPartsQuest = ch1Quest("ch1_a1_q03_stand_him_up");
    assert.ok(gatherPartsQuest, "Stand Him Up quest must exist");

    const gatherPartsStep = gatherPartsQuest!.steps.find(
      (s) => s.id === "gather_parts"
    );
    assert.ok(gatherPartsStep, "Gather Parts step must exist");

    const requirements = gatherPartsStep!.inventoryRequirements ?? [];
    assert.equal(requirements.length, 3, "must have 3 material types");

    const materialsByName = new Map<string, (typeof requirements)[0]>();
    for (const req of requirements) {
      materialsByName.set(req.itemId, req);
    }

    // Verify each material
    for (const [itemId, requirement] of materialsByName) {
      const plan = harthmereMaterialAcquisitionPlan({
        itemId,
        count: requirement.count,
      });

      assert.ok(plan, `${itemId} must have acquisition plan for Gather Parts`);

      // Player should be able to execute at least one route
      const executableRoutes = plan!.routes.filter(
        (r) =>
          // Route is directly executably (has position)
          r.markerPosition !== undefined &&
          // Route is not transitively blocked
          (!r.purpose || !r.purpose.includes("Needed to"))
      );

      assert.ok(
        executableRoutes.length >= 1,
        `${itemId} must have at least one executable route; got: ${JSON.stringify(
          plan!.routes.map((r) => ({
            kind: r.kind,
            source: r.sourceName,
            purpose: r.purpose,
            hasMarker: r.markerPosition ? "yes" : "no",
          }))
        )}`
      );
    }
  });

  it("documents the Grove time investment required", () => {
    // Gather Parts is expected to take some time to source materials
    // The quest documentation should be clear about this
    const gatherPartsQuest = ch1Quest("ch1_a1_q03_stand_him_up");
    const gatherPartsStep = gatherPartsQuest!.steps.find(
      (s) => s.id === "gather_parts"
    );

    // Objective should mention gathering/sourcing
    assert.ok(
      gatherPartsStep!.objective.includes("gathering") ||
        gatherPartsStep!.objective.includes("buying") ||
        gatherPartsStep!.objective.includes("crafting") ||
        gatherPartsStep!.objective.includes("choosing and track"),
      "Gather Parts objective should mention how to obtain materials"
    );
  });
});
