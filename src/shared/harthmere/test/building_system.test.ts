import assert from "assert";
import { isTerrainID } from "@/shared/asset_defs/terrain";
import { BikkieIds } from "@/shared/bikkie/ids";
import { validateHarthmereBuildingPlacement } from "../mmo_building_authority";
import {
  BUILDING_SYSTEM_ABANDON_AFTER_UNPAID_TAX_MS,
  BUILDING_SYSTEM_BIKKIE_BLUEPRINTS,
  BUILDING_SYSTEM_CONSTRUCTION_STAGES,
  BUILDING_SYSTEM_PLOTS,
  BUILDING_SYSTEM_LAND_REQUEST_AREAS,
  BUILDING_SYSTEM_PLOT_SIZE_OPTIONS,
  BUILDING_SYSTEM_TAX_PERIOD_MS,
  applyBuildingSystemPropertyLifecycle,
  buildingSystemBlueprintByItemId,
  buildingSystemBlueprintById,
  buildingSystemCanOpenDoorLock,
  buildingSystemCanUseStorageContainer,
  buildingSystemDefaultOrigin,
  groundedBuildingSystemMaterializationPlan,
  shiftBuildingSystemMaterializationPlanY,
  buildingSystemMaterialRequirementLines,
  buildingSystemPlotById,
  countBuildingSystemVoxelLabels,
  createBuildingSystemGuideConstructionMath,
  createBuildingSystemMaterializationPlan,
  createBuildingSystemPlacementContext,
  createBuildingSystemPlacementPreview,
  createBuildingSystemStageMaterializationPlan,
  createBuildingSystemDoorLock,
  createBuildingSystemHomeConsoleMarker,
  createBuildingSystemPropertyRecord,
  createBuildingSystemStorageContainer,
  createBuildingSystemRequestedPlotDefinition,
  buildingSystemRequestedPlotPriceGold,
  validateBuildingSystemGuideConstructionReadiness,
  normalizeBuildingSystemPropertyRecord,
  buildingSystemRepairCostGold,
  buildingSystemDemolitionRefundGold,
} from "../building_system";

const NOW_MS = 1_800_000_000_000;

describe("building_system — property access and lifecycle oversights", () => {
  it("quotes sharply higher deed prices as requested plot area grows", () => {
    const quotes = BUILDING_SYSTEM_PLOT_SIZE_OPTIONS.map((size) =>
      buildingSystemRequestedPlotPriceGold({
        width: size.width,
        depth: size.depth,
        startsMucked: true,
      })
    );
    assert.ok(quotes[1] > quotes[0]);
    assert.ok(quotes[2] > quotes[1]);
    assert.ok(quotes[3] > quotes[2]);
    assert.ok(
      quotes[3] >= quotes[0] * 5,
      `estate ${quotes[3]} should cost at least five starter deeds ${quotes[0]}`
    );
  });

  it("creates sized requests in additive Harthmere with a serviced-land premium", () => {
    const blueprint = buildingSystemBlueprintById(
      "grove_voxel_cottage_tier_1"
    )!;
    const area = BUILDING_SYSTEM_LAND_REQUEST_AREAS.find(
      (entry) => entry.areaId === "additive_east_estates"
    )!;
    const size = BUILDING_SYSTEM_PLOT_SIZE_OPTIONS.find(
      (entry) => entry.sizeId === "large"
    )!;
    const result = createBuildingSystemRequestedPlotDefinition({
      requestAreaId: area.areaId,
      blueprint,
      center: { x: area.center[0], z: area.center[2] },
      width: size.width,
      depth: size.depth,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.plot.groundY, 52);
    assert.equal(result.plot.startsMucked, false);
    assert.equal(result.plot.bounds.xMax - result.plot.bounds.xMin, size.width);
    assert.equal(result.plot.bounds.zMax - result.plot.bounds.zMin, size.depth);
    assert.ok(
      result.plot.claimPriceGold >
        buildingSystemRequestedPlotPriceGold({
          width: size.width,
          depth: size.depth,
          startsMucked: false,
        })
    );
  });

  it("registers every available Bikkie blueprint item as a buildable building-system blueprint", () => {
    const expectedBikkieBlueprintIds = [
      BikkieIds.blueprintAnglersTable,
      BikkieIds.blueprintBench,
      BikkieIds.blueprintCanopyFrame,
      BikkieIds.blueprintCommsTower,
      BikkieIds.blueprintComposter,
      BikkieIds.blueprintDyeOMatic,
      BikkieIds.blueprintFence,
      BikkieIds.blueprintKitchen,
      BikkieIds.blueprintModernShelterFrame,
      BikkieIds.blueprintSeedMill,
      BikkieIds.blueprintSpaceAgeShelterFrame,
      BikkieIds.blueprintMarinaShoppingStall,
      BikkieIds.blueprintNetworkTower,
      BikkieIds.blueprintTTable,
      BikkieIds.blueprintTable,
      BikkieIds.blueprintTailoringBooth,
      BikkieIds.blueprintThermoblaster,
      BikkieIds.blueprintThermolite,
      BikkieIds.blueprintTraditionalShelterFrame,
      BikkieIds.blueprintWorkbench,
    ].map(String);

    assert.equal(BUILDING_SYSTEM_BIKKIE_BLUEPRINTS.length, 20);
    assert.equal(
      new Set(
        BUILDING_SYSTEM_BIKKIE_BLUEPRINTS.map(
          (blueprint) => blueprint.blueprintItemId
        )
      ).size,
      expectedBikkieBlueprintIds.length
    );
    for (const itemId of expectedBikkieBlueprintIds) {
      const blueprint = buildingSystemBlueprintByItemId(itemId);
      assert.ok(
        blueprint,
        `missing building-system blueprint for item ${itemId}`
      );
      assert.equal(blueprint.source, "bikkie_blueprint");
      assert.equal(blueprint.blueprintItemId, itemId);
      assert.ok(
        blueprint.colors?.length,
        `${blueprint.blueprintId} should carry color metadata`
      );
      assert.ok(blueprint.description.length > 24);
    }
  });

  it("clamps hostile/corrupt persisted property fields on normalization (no negative gold math)", () => {
    const blueprint = BUILDING_SYSTEM_BIKKIE_BLUEPRINTS[0];
    const plot = BUILDING_SYSTEM_PLOTS.find((candidate) =>
      candidate.allowedBlueprintIds.includes(blueprint.blueprintId)
    )!;
    const property = normalizeBuildingSystemPropertyRecord({
      propertyId: "property_corrupt",
      ownerId: "builder",
      nowMs: NOW_MS,
      raw: {
        plotId: plot.plotId,
        blueprintId: blueprint.blueprintId,
        ownerId: "builder",
        condition: 9999,
        value: -100,
        taxBalanceGold: -50,
        repairDebtGold: -10,
        tier: -3,
        taxRate: -1,
      },
    });
    assert.ok(
      property.condition >= 0 && property.condition <= 100,
      `condition ${property.condition}`
    );
    assert.ok(property.value >= 0, `value ${property.value}`);
    assert.ok(
      property.taxBalanceGold >= 0,
      `taxBalanceGold ${property.taxBalanceGold}`
    );
    assert.ok(
      property.repairDebtGold >= 0,
      `repairDebtGold ${property.repairDebtGold}`
    );
    assert.ok(property.tier >= 1, `tier ${property.tier}`);
    assert.ok(property.taxRate >= 0, `taxRate ${property.taxRate}`);
    // Downstream gold math must never go negative off corrupt input.
    assert.ok(
      buildingSystemRepairCostGold(property) >= 0,
      "repair cost must be non-negative"
    );
    assert.ok(
      buildingSystemDemolitionRefundGold(property) >= 0,
      "demolition refund must be non-negative"
    );
  });

  it("keeps every Bikkie blueprint zoned to a plot where authority placement validates", () => {
    for (const blueprint of BUILDING_SYSTEM_BIKKIE_BLUEPRINTS) {
      const plot = BUILDING_SYSTEM_PLOTS.find((candidate) =>
        candidate.allowedBlueprintIds.includes(blueprint.blueprintId)
      );
      assert.ok(plot, `${blueprint.blueprintId} is not allowed by any plot`);
      for (const stage of BUILDING_SYSTEM_CONSTRUCTION_STAGES) {
        assert.doesNotThrow(() =>
          buildingSystemMaterialRequirementLines({ blueprint, stage })
        );
      }
      const origin = buildingSystemDefaultOrigin(plot, blueprint);
      const result = validateHarthmereBuildingPlacement(
        {
          requestId: `validate_${blueprint.blueprintId}`,
          actorId: "builder",
          structureTypeId: blueprint.structureTypeId,
          origin,
          rotationDegrees: 0,
          plotId: plot.plotId,
          nowMs: NOW_MS,
        },
        createBuildingSystemPlacementContext({
          actorId: "builder",
          plot,
          blueprint,
          origin,
          owned: true,
        })
      );
      assert.deepEqual(result.errors, [], blueprint.blueprintId);
      assert.equal(result.ok, true, blueprint.blueprintId);
    }
  });

  it("materializes fixture and fence blueprints at fixture scale instead of generating full building shells", () => {
    const bench = buildingSystemBlueprintById("bikkie_bench");
    const fence = buildingSystemBlueprintById("bikkie_fence");
    const shopPlot = buildingSystemPlotById("grove_crossroads_shop_lot");
    const farmPlot = buildingSystemPlotById("grove_seedworks_plot");
    assert.ok(bench);
    assert.ok(fence);
    assert.ok(shopPlot);
    assert.ok(farmPlot);

    const benchPlan = createBuildingSystemMaterializationPlan({
      requestId: "bench_fixture_plan",
      actorId: "builder",
      plot: shopPlot,
      blueprint: bench,
      activatedAtMs: NOW_MS,
    });
    const benchLabels = countBuildingSystemVoxelLabels(benchPlan);
    assert.equal(benchLabels.wall ?? 0, 0);
    assert.equal(benchLabels.roof ?? 0, 0);
    assert.ok((benchLabels.frame ?? 0) > 0);
    assert.ok(benchPlan.edits.length < 30);

    const fenceStagePlan = createBuildingSystemStageMaterializationPlan({
      requestId: "fence_frame_stage",
      actorId: "builder",
      projectId: "project_fence",
      plot: farmPlot,
      blueprint: fence,
      stage: "frame",
      activatedAtMs: NOW_MS,
    });
    const fenceLabels = countBuildingSystemVoxelLabels(fenceStagePlan);
    assert.ok((fenceLabels.frame ?? 0) > 0);
    assert.equal(fenceLabels.wall ?? 0, 0);
    assert.equal(fenceLabels.roof ?? 0, 0);
  });

  it("uses the guide construction equations across preview, materialization, and cleanup", () => {
    const readiness = validateBuildingSystemGuideConstructionReadiness({
      actorId: "guide_builder",
      nowMs: NOW_MS,
    });
    assert.deepStrictEqual(readiness.errors, []);
    assert.ok(
      readiness.checkedBlueprints >= BUILDING_SYSTEM_BIKKIE_BLUEPRINTS.length
    );

    const plot = buildingSystemPlotById("grove_crossroads_shop_lot");
    const blueprint = buildingSystemBlueprintById("grove_voxel_shop_tier_1");
    assert.ok(plot);
    assert.ok(blueprint);
    const guide = createBuildingSystemGuideConstructionMath({
      plot,
      blueprint,
    });
    const preview = createBuildingSystemPlacementPreview({
      plot,
      blueprint,
      owned: true,
    });
    const plan = createBuildingSystemMaterializationPlan({
      requestId: "guide_math_shop_plan",
      actorId: "shop_owner",
      propertyId: "property_guide_math_shop",
      plot,
      blueprint,
      activatedAtMs: NOW_MS,
    });
    const labels = countBuildingSystemVoxelLabels(plan);

    assert.deepStrictEqual(preview.origin, guide.origin);
    assert.strictEqual(plan.guideConstruction.doorX, guide.doorX);
    assert.strictEqual(plan.guideConstruction.roofY, guide.roofY);
    assert.ok((labels.foundation ?? 0) > 0);
    assert.ok((labels.floor ?? 0) > 0);
    assert.ok((labels.wall ?? 0) > 0);
    assert.ok((labels.roof ?? 0) > 0);
    assert.ok((labels.stair ?? 0) > 0);
    assert.ok(
      plan.edits.every(
        (edit) => edit.value === 0 || isTerrainID(Number(edit.value))
      ),
      "player home/business materialization edits must be terrain block ids"
    );
    assert.ok(
      plan.edits.some(
        (edit) =>
          edit.label === "stair" &&
          edit.position.join(",") === guide.stairPosition.join(",")
      )
    );
    assert.equal(
      plan.edits.some(
        (edit) =>
          edit.label === "wall" &&
          edit.position[0] === guide.doorX &&
          edit.position[2] === guide.z0 &&
          (edit.position[1] === guide.doorYMin ||
            edit.position[1] === guide.doorYMax)
      ),
      false
    );
    assert.equal(
      plan.edits.some(
        (edit) =>
          edit.label === "wall" &&
          edit.position[0] === guide.doorX - 1 &&
          edit.position[2] === guide.z0 &&
          (edit.position[1] === guide.doorYMin ||
            edit.position[1] === guide.doorYMax)
      ),
      false
    );
  });

  it("keeps public business shopfronts enterable while denying public storage access", () => {
    const plot = buildingSystemPlotById("grove_crossroads_shop_lot");
    const blueprint = buildingSystemBlueprintById("grove_voxel_shop_tier_1");
    assert.ok(plot);
    assert.ok(blueprint);

    const property = createBuildingSystemPropertyRecord({
      propertyId: "property_shopfront_access_test",
      ownerId: "shop_owner",
      plot,
      blueprint,
      nowMs: NOW_MS,
    });
    const storage = createBuildingSystemStorageContainer({
      property,
      plot,
      blueprint,
      nowMs: NOW_MS,
    });
    const door = createBuildingSystemDoorLock({
      property,
      plot,
      blueprint,
      nowMs: NOW_MS,
    });

    assert.strictEqual(property.accessMode, "public");
    assert.strictEqual(
      buildingSystemCanOpenDoorLock({
        property,
        lock: door,
        actorId: "customer",
      }),
      true
    );
    assert.strictEqual(
      buildingSystemCanUseStorageContainer({
        property,
        container: storage,
        actorId: "customer",
      }),
      false
    );
    assert.strictEqual(
      buildingSystemCanUseStorageContainer({
        property,
        container: storage,
        actorId: "shop_owner",
      }),
      true
    );
  });

  it("publishes player-facing access points in home building materialization plans", () => {
    const plot = buildingSystemPlotById("grove_muckstead_cottage_lot");
    const blueprint = buildingSystemBlueprintById("grove_voxel_cottage_tier_1");
    assert.ok(plot);
    assert.ok(blueprint);
    const origin = {
      x: buildingSystemDefaultOrigin(plot, blueprint).x + 1,
      y: buildingSystemDefaultOrigin(plot, blueprint).y,
      z: buildingSystemDefaultOrigin(plot, blueprint).z + 1,
    };
    const property = createBuildingSystemPropertyRecord({
      propertyId: "property_home_access_plan_test",
      ownerId: "home_owner",
      plot,
      blueprint,
      nowMs: NOW_MS,
    });
    const plan = createBuildingSystemMaterializationPlan({
      requestId: "home_access_plan",
      actorId: "home_owner",
      propertyId: property.propertyId,
      plot,
      blueprint,
      origin,
      activatedAtMs: NOW_MS,
    });
    const markers = plan.inWorldMarkers ?? [];
    const storage = createBuildingSystemStorageContainer({
      property,
      plot,
      blueprint,
      origin,
      nowMs: NOW_MS,
    });
    const door = createBuildingSystemDoorLock({
      property,
      plot,
      blueprint,
      origin,
      nowMs: NOW_MS,
    });
    const consoleMarker = createBuildingSystemHomeConsoleMarker({
      property,
      plot,
      blueprint,
      origin,
      nowMs: NOW_MS,
    });

    assert.deepStrictEqual(markers.map((marker) => marker.kind).sort(), [
      "door_lock",
      "home_console",
      "storage_container",
    ]);
    const labels = countBuildingSystemVoxelLabels(plan);
    assert.ok((labels.storage_container ?? 0) >= 1);
    assert.ok((labels.door_lock ?? 0) >= 1);
    assert.ok((labels.home_console ?? 0) >= 1);
    assert.deepStrictEqual(
      markers.find((marker) => marker.kind === "storage_container")?.position,
      storage.position
    );
    assert.deepStrictEqual(
      markers.find((marker) => marker.kind === "door_lock")?.position,
      door.position
    );
    assert.deepStrictEqual(
      markers.find((marker) => marker.kind === "home_console")?.position,
      consoleMarker.position
    );
    assert.ok(
      markers.every(
        (marker) => marker.label && !/[a-z]+_[a-z]+/.test(marker.label)
      ),
      JSON.stringify(markers)
    );
    assert.ok(
      consoleMarker.position[0] >= origin.x &&
        consoleMarker.position[0] < origin.x + blueprint.footprint.width &&
        consoleMarker.position[2] >= origin.z &&
        consoleMarker.position[2] < origin.z + blueprint.footprint.depth
    );
    assert.notDeepStrictEqual(consoleMarker.position, door.position);
    assert.notDeepStrictEqual(consoleMarker.position, storage.position);
  });

  it("uses business access markers for shops without exposing a home console", () => {
    const plot = buildingSystemPlotById("grove_crossroads_shop_lot");
    const blueprint = buildingSystemBlueprintById("grove_voxel_shop_tier_1");
    assert.ok(plot);
    assert.ok(blueprint);

    const plan = createBuildingSystemMaterializationPlan({
      requestId: "business_access_plan",
      actorId: "shop_owner",
      propertyId: "property_shop_access_plan_test",
      plot,
      blueprint,
      activatedAtMs: NOW_MS,
    });
    const markers = plan.inWorldMarkers ?? [];
    const labels = countBuildingSystemVoxelLabels(plan);
    assert.ok(markers.some((marker) => marker.kind === "storage_container"));
    assert.ok(markers.some((marker) => marker.kind === "door_lock"));
    assert.ok(markers.some((marker) => marker.kind === "business_marker"));
    assert.equal(
      markers.some((marker) => marker.kind === "home_console"),
      false
    );
    assert.ok((labels.storage_container ?? 0) >= 1);
    assert.ok((labels.door_lock ?? 0) >= 1);
    assert.ok((labels.business_marker ?? 0) >= 1);
    assert.ok(
      markers.every(
        (marker) => marker.label && !/[a-z]+_[a-z]+/.test(marker.label)
      ),
      JSON.stringify(markers)
    );
  });

  it("only publishes access markers when staged construction reaches utility setup", () => {
    const plot = buildingSystemPlotById("grove_muckstead_cottage_lot");
    const blueprint = buildingSystemBlueprintById("grove_voxel_cottage_tier_1");
    assert.ok(plot);
    assert.ok(blueprint);

    const framePlan = createBuildingSystemStageMaterializationPlan({
      requestId: "home_frame_stage_access_plan",
      actorId: "home_owner",
      projectId: "project_home_access_plan",
      propertyId: "property_home_stage_access_plan_test",
      plot,
      blueprint,
      stage: "frame",
      activatedAtMs: NOW_MS,
    });
    const utilityPlan = createBuildingSystemStageMaterializationPlan({
      requestId: "home_utility_stage_access_plan",
      actorId: "home_owner",
      projectId: "project_home_access_plan",
      propertyId: "property_home_stage_access_plan_test",
      plot,
      blueprint,
      stage: "utility_setup",
      activatedAtMs: NOW_MS,
    });

    assert.equal((framePlan.inWorldMarkers ?? []).length, 0);
    assert.deepStrictEqual(
      (utilityPlan.inWorldMarkers ?? []).map((marker) => marker.kind).sort(),
      ["door_lock", "home_console", "storage_container"]
    );
  });

  it("marks unpaid property abandoned after the first due date plus the abandonment window", () => {
    const plot = buildingSystemPlotById("grove_muckstead_cottage_lot");
    const blueprint = buildingSystemBlueprintById("grove_voxel_cottage_tier_1");
    assert.ok(plot);
    assert.ok(blueprint);

    const property = createBuildingSystemPropertyRecord({
      propertyId: "property_tax_abandonment_test",
      ownerId: "home_owner",
      plot,
      blueprint,
      nowMs: NOW_MS,
      value: 500,
    });
    const firstAbandonmentMoment =
      NOW_MS +
      BUILDING_SYSTEM_TAX_PERIOD_MS +
      BUILDING_SYSTEM_ABANDON_AFTER_UNPAID_TAX_MS;

    const result = applyBuildingSystemPropertyLifecycle({
      property,
      nowMs: firstAbandonmentMoment,
    });

    assert.ok(result.taxDeltaGold > 0);
    assert.strictEqual(
      result.property.unpaidTaxSinceMs,
      NOW_MS + BUILDING_SYSTEM_TAX_PERIOD_MS
    );
    assert.strictEqual(result.property.abandoned, true);
    assert.strictEqual(result.property.status, "abandoned");
    assert.ok(
      result.warnings.includes("property_marked_abandoned:unpaid_taxes")
    );
  });
});

describe("building_system - terrain grounding (rest on real surface)", () => {
  // A flat synthetic surface: solid at/below `groundTopY`, air above. The shared
  // scan finds feet at groundTopY + 1 (stand on top of the solid block).
  const flatSurfaceSolid =
    (groundTopY: number) => (_x: number, y: number, _z: number) =>
      y <= groundTopY;

  function buildShopPlan() {
    const plot = buildingSystemPlotById("grove_crossroads_shop_lot");
    const blueprint = buildingSystemBlueprintById("grove_voxel_shop_tier_1");
    assert.ok(plot && blueprint);
    return createBuildingSystemMaterializationPlan({
      requestId: "grounding_shop_plan",
      actorId: "shop_owner",
      propertyId: "property_grounding_shop",
      plot: plot!,
      blueprint: blueprint!,
      activatedAtMs: NOW_MS,
    });
  }

  it("shifts a building plan so its floor rests flush on the real surface", () => {
    const plan = buildShopPlan();
    // Plot authored groundY is 54 -> floor (origin.y) is 55. Pretend the real
    // ground top is 52 (feet 53), i.e. the building was floating ~3 blocks.
    const grounded = groundedBuildingSystemMaterializationPlan(
      plan,
      flatSurfaceSolid(52)
    );
    // Floor flush with the surface: stand-on-floor == ground feet (53), so the
    // floor block (origin.y) lands at feet - 1 = 52.
    assert.strictEqual(grounded.origin.y, 52);
    assert.strictEqual(grounded.origin.y, plan.origin.y - 3);
    // Every edit + marker shifted by the same -3, footprint XZ untouched.
    for (let i = 0; i < plan.edits.length; i += 1) {
      assert.strictEqual(
        grounded.edits[i].position[0],
        plan.edits[i].position[0]
      );
      assert.strictEqual(
        grounded.edits[i].position[1],
        plan.edits[i].position[1] - 3
      );
      assert.strictEqual(
        grounded.edits[i].position[2],
        plan.edits[i].position[2]
      );
    }
    for (let i = 0; i < (plan.inWorldMarkers?.length ?? 0); i += 1) {
      assert.strictEqual(
        grounded.inWorldMarkers![i].position[1],
        plan.inWorldMarkers![i].position[1] - 3
      );
    }
  });

  it("leaves a plan untouched when no real surface can be resolved (never buries)", () => {
    const plan = buildShopPlan();
    const grounded = groundedBuildingSystemMaterializationPlan(
      plan,
      () => false // terrain unreadable / empty column
    );
    assert.strictEqual(grounded, plan);
  });

  it("does not shift a plan already resting on the surface", () => {
    const plan = buildShopPlan();
    // Real ground top so that floor (origin.y) is already flush: floor == feet-1
    // => feet == origin.y + 1 => ground top == origin.y.
    const grounded = groundedBuildingSystemMaterializationPlan(
      plan,
      flatSurfaceSolid(plan.origin.y)
    );
    assert.strictEqual(grounded.origin.y, plan.origin.y);
    assert.deepStrictEqual(
      grounded.edits.map((edit) => edit.position[1]),
      plan.edits.map((edit) => edit.position[1])
    );
  });

  it("shiftBuildingSystemMaterializationPlanY is a no-op for a zero shift", () => {
    const plan = buildShopPlan();
    assert.strictEqual(shiftBuildingSystemMaterializationPlanY(plan, 0), plan);
  });
});
