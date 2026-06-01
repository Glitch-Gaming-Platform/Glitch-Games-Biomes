import assert from "assert";
import { isTerrainID } from "@/shared/asset_defs/terrain";
import { BikkieIds } from "@/shared/bikkie/ids";
import { validateHarthmereBuildingPlacementV1 } from "../mmo_building_authority_v1";
import {
  BUILDING_SYSTEM_ABANDON_AFTER_UNPAID_TAX_MS_V1,
  BUILDING_SYSTEM_BIKKIE_BLUEPRINTS_V1,
  BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1,
  BUILDING_SYSTEM_PLOTS_V1,
  BUILDING_SYSTEM_TAX_PERIOD_MS_V1,
  applyBuildingSystemPropertyLifecycleV1,
  buildingSystemBlueprintByItemIdV1,
  buildingSystemBlueprintByIdV1,
  buildingSystemCanOpenDoorLockV1,
  buildingSystemCanUseStorageContainerV1,
  buildingSystemDefaultOriginV1,
  buildingSystemMaterialRequirementLinesV1,
  buildingSystemPlotByIdV1,
  countBuildingSystemVoxelLabelsV1,
  createBuildingSystemGuideConstructionMathV1,
  createBuildingSystemMaterializationPlanV1,
  createBuildingSystemPlacementContextV1,
  createBuildingSystemPlacementPreviewV1,
  createBuildingSystemStageMaterializationPlanV1,
  createBuildingSystemDoorLockV1,
  createBuildingSystemHomeConsoleMarkerV1,
  createBuildingSystemPropertyRecordV1,
  createBuildingSystemStorageContainerV1,
  validateBuildingSystemGuideConstructionReadinessV1,
} from "../building_system_v1";

const NOW_MS = 1_800_000_000_000;

describe("building_system_v1 — property access and lifecycle oversights", () => {
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

    assert.equal(BUILDING_SYSTEM_BIKKIE_BLUEPRINTS_V1.length, 20);
    assert.equal(
      new Set(
        BUILDING_SYSTEM_BIKKIE_BLUEPRINTS_V1.map((blueprint) => blueprint.blueprintItemId)
      ).size,
      expectedBikkieBlueprintIds.length
    );
    for (const itemId of expectedBikkieBlueprintIds) {
      const blueprint = buildingSystemBlueprintByItemIdV1(itemId);
      assert.ok(blueprint, `missing building-system blueprint for item ${itemId}`);
      assert.equal(blueprint.source, "bikkie_blueprint");
      assert.equal(blueprint.blueprintItemId, itemId);
      assert.ok(blueprint.colors?.length, `${blueprint.blueprintId} should carry color metadata`);
      assert.ok(blueprint.description.length > 24);
    }
  });

  it("keeps every Bikkie blueprint zoned to a plot where authority placement validates", () => {
    for (const blueprint of BUILDING_SYSTEM_BIKKIE_BLUEPRINTS_V1) {
      const plot = BUILDING_SYSTEM_PLOTS_V1.find((candidate) =>
        candidate.allowedBlueprintIds.includes(blueprint.blueprintId)
      );
      assert.ok(plot, `${blueprint.blueprintId} is not allowed by any plot`);
      for (const stage of BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1) {
        assert.doesNotThrow(() =>
          buildingSystemMaterialRequirementLinesV1({ blueprint, stage })
        );
      }
      const origin = buildingSystemDefaultOriginV1(plot, blueprint);
      const result = validateHarthmereBuildingPlacementV1(
        {
          requestId: `validate_${blueprint.blueprintId}`,
          actorId: "builder",
          structureTypeId: blueprint.structureTypeId,
          origin,
          rotationDegrees: 0,
          plotId: plot.plotId,
          nowMs: NOW_MS,
        },
        createBuildingSystemPlacementContextV1({
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
    const bench = buildingSystemBlueprintByIdV1("bikkie_bench");
    const fence = buildingSystemBlueprintByIdV1("bikkie_fence");
    const shopPlot = buildingSystemPlotByIdV1("grove_crossroads_shop_lot");
    const farmPlot = buildingSystemPlotByIdV1("grove_seedworks_plot");
    assert.ok(bench);
    assert.ok(fence);
    assert.ok(shopPlot);
    assert.ok(farmPlot);

    const benchPlan = createBuildingSystemMaterializationPlanV1({
      requestId: "bench_fixture_plan",
      actorId: "builder",
      plot: shopPlot,
      blueprint: bench,
      activatedAtMs: NOW_MS,
    });
    const benchLabels = countBuildingSystemVoxelLabelsV1(benchPlan);
    assert.equal(benchLabels.wall ?? 0, 0);
    assert.equal(benchLabels.roof ?? 0, 0);
    assert.ok((benchLabels.frame ?? 0) > 0);
    assert.ok(benchPlan.edits.length < 30);

    const fenceStagePlan = createBuildingSystemStageMaterializationPlanV1({
      requestId: "fence_frame_stage",
      actorId: "builder",
      projectId: "project_fence",
      plot: farmPlot,
      blueprint: fence,
      stage: "frame",
      activatedAtMs: NOW_MS,
    });
    const fenceLabels = countBuildingSystemVoxelLabelsV1(fenceStagePlan);
    assert.ok((fenceLabels.frame ?? 0) > 0);
    assert.equal(fenceLabels.wall ?? 0, 0);
    assert.equal(fenceLabels.roof ?? 0, 0);
  });

  it("uses the guide construction equations across preview, materialization, and cleanup", () => {
    const readiness = validateBuildingSystemGuideConstructionReadinessV1({
      actorId: "guide_builder",
      nowMs: NOW_MS,
    });
    assert.deepStrictEqual(readiness.errors, []);
    assert.ok(readiness.checkedBlueprints >= BUILDING_SYSTEM_BIKKIE_BLUEPRINTS_V1.length);

    const plot = buildingSystemPlotByIdV1("grove_crossroads_shop_lot");
    const blueprint = buildingSystemBlueprintByIdV1("grove_voxel_shop_tier_1");
    assert.ok(plot);
    assert.ok(blueprint);
    const guide = createBuildingSystemGuideConstructionMathV1({ plot, blueprint });
    const preview = createBuildingSystemPlacementPreviewV1({
      plot,
      blueprint,
      owned: true,
    });
    const plan = createBuildingSystemMaterializationPlanV1({
      requestId: "guide_math_shop_plan",
      actorId: "shop_owner",
      propertyId: "property_guide_math_shop",
      plot,
      blueprint,
      activatedAtMs: NOW_MS,
    });
    const labels = countBuildingSystemVoxelLabelsV1(plan);

    assert.deepStrictEqual(preview.origin, guide.origin);
    assert.strictEqual(plan.guideConstruction.doorX, guide.doorX);
    assert.strictEqual(plan.guideConstruction.roofY, guide.roofY);
    assert.ok((labels.foundation ?? 0) > 0);
    assert.ok((labels.floor ?? 0) > 0);
    assert.ok((labels.wall ?? 0) > 0);
    assert.ok((labels.roof ?? 0) > 0);
    assert.ok((labels.stair ?? 0) > 0);
    assert.ok(
      plan.edits.every((edit) => edit.value === 0 || isTerrainID(Number(edit.value))),
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
  });

  it("keeps public business shopfronts enterable while denying public storage access", () => {
    const plot = buildingSystemPlotByIdV1("grove_crossroads_shop_lot");
    const blueprint = buildingSystemBlueprintByIdV1("grove_voxel_shop_tier_1");
    assert.ok(plot);
    assert.ok(blueprint);

    const property = createBuildingSystemPropertyRecordV1({
      propertyId: "property_shopfront_access_test",
      ownerId: "shop_owner",
      plot,
      blueprint,
      nowMs: NOW_MS,
    });
    const storage = createBuildingSystemStorageContainerV1({
      property,
      plot,
      blueprint,
      nowMs: NOW_MS,
    });
    const door = createBuildingSystemDoorLockV1({
      property,
      plot,
      blueprint,
      nowMs: NOW_MS,
    });

    assert.strictEqual(property.accessMode, "public");
    assert.strictEqual(
      buildingSystemCanOpenDoorLockV1({ property, lock: door, actorId: "customer" }),
      true
    );
    assert.strictEqual(
      buildingSystemCanUseStorageContainerV1({ property, container: storage, actorId: "customer" }),
      false
    );
    assert.strictEqual(
      buildingSystemCanUseStorageContainerV1({ property, container: storage, actorId: "shop_owner" }),
      true
    );
  });

  it("publishes player-facing access points in home building materialization plans", () => {
    const plot = buildingSystemPlotByIdV1("grove_muckstead_cottage_lot");
    const blueprint = buildingSystemBlueprintByIdV1("grove_voxel_cottage_tier_1");
    assert.ok(plot);
    assert.ok(blueprint);
    const origin = {
      x: buildingSystemDefaultOriginV1(plot, blueprint).x + 1,
      y: buildingSystemDefaultOriginV1(plot, blueprint).y,
      z: buildingSystemDefaultOriginV1(plot, blueprint).z + 1,
    };
    const property = createBuildingSystemPropertyRecordV1({
      propertyId: "property_home_access_plan_test",
      ownerId: "home_owner",
      plot,
      blueprint,
      nowMs: NOW_MS,
    });
    const plan = createBuildingSystemMaterializationPlanV1({
      requestId: "home_access_plan",
      actorId: "home_owner",
      propertyId: property.propertyId,
      plot,
      blueprint,
      origin,
      activatedAtMs: NOW_MS,
    });
    const markers = plan.inWorldMarkers ?? [];
    const storage = createBuildingSystemStorageContainerV1({
      property,
      plot,
      blueprint,
      origin,
      nowMs: NOW_MS,
    });
    const door = createBuildingSystemDoorLockV1({
      property,
      plot,
      blueprint,
      origin,
      nowMs: NOW_MS,
    });
    const consoleMarker = createBuildingSystemHomeConsoleMarkerV1({
      property,
      plot,
      blueprint,
      origin,
      nowMs: NOW_MS,
    });

    assert.deepStrictEqual(
      markers.map((marker) => marker.kind).sort(),
      ["door_lock", "home_console", "storage_container"]
    );
    const labels = countBuildingSystemVoxelLabelsV1(plan);
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
      markers.every((marker) => marker.label && !/[a-z]+_[a-z]+/.test(marker.label)),
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
    const plot = buildingSystemPlotByIdV1("grove_crossroads_shop_lot");
    const blueprint = buildingSystemBlueprintByIdV1("grove_voxel_shop_tier_1");
    assert.ok(plot);
    assert.ok(blueprint);

    const plan = createBuildingSystemMaterializationPlanV1({
      requestId: "business_access_plan",
      actorId: "shop_owner",
      propertyId: "property_shop_access_plan_test",
      plot,
      blueprint,
      activatedAtMs: NOW_MS,
    });
    const markers = plan.inWorldMarkers ?? [];
    const labels = countBuildingSystemVoxelLabelsV1(plan);
    assert.ok(markers.some((marker) => marker.kind === "storage_container"));
    assert.ok(markers.some((marker) => marker.kind === "door_lock"));
    assert.ok(markers.some((marker) => marker.kind === "business_marker"));
    assert.equal(markers.some((marker) => marker.kind === "home_console"), false);
    assert.ok((labels.storage_container ?? 0) >= 1);
    assert.ok((labels.door_lock ?? 0) >= 1);
    assert.ok((labels.business_marker ?? 0) >= 1);
    assert.ok(
      markers.every((marker) => marker.label && !/[a-z]+_[a-z]+/.test(marker.label)),
      JSON.stringify(markers)
    );
  });

  it("only publishes access markers when staged construction reaches utility setup", () => {
    const plot = buildingSystemPlotByIdV1("grove_muckstead_cottage_lot");
    const blueprint = buildingSystemBlueprintByIdV1("grove_voxel_cottage_tier_1");
    assert.ok(plot);
    assert.ok(blueprint);

    const framePlan = createBuildingSystemStageMaterializationPlanV1({
      requestId: "home_frame_stage_access_plan",
      actorId: "home_owner",
      projectId: "project_home_access_plan",
      propertyId: "property_home_stage_access_plan_test",
      plot,
      blueprint,
      stage: "frame",
      activatedAtMs: NOW_MS,
    });
    const utilityPlan = createBuildingSystemStageMaterializationPlanV1({
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
    const plot = buildingSystemPlotByIdV1("grove_muckstead_cottage_lot");
    const blueprint = buildingSystemBlueprintByIdV1("grove_voxel_cottage_tier_1");
    assert.ok(plot);
    assert.ok(blueprint);

    const property = createBuildingSystemPropertyRecordV1({
      propertyId: "property_tax_abandonment_test",
      ownerId: "home_owner",
      plot,
      blueprint,
      nowMs: NOW_MS,
      value: 500,
    });
    const firstAbandonmentMoment =
      NOW_MS +
      BUILDING_SYSTEM_TAX_PERIOD_MS_V1 +
      BUILDING_SYSTEM_ABANDON_AFTER_UNPAID_TAX_MS_V1;

    const result = applyBuildingSystemPropertyLifecycleV1({
      property,
      nowMs: firstAbandonmentMoment,
    });

    assert.ok(result.taxDeltaGold > 0);
    assert.strictEqual(result.property.unpaidTaxSinceMs, NOW_MS + BUILDING_SYSTEM_TAX_PERIOD_MS_V1);
    assert.strictEqual(result.property.abandoned, true);
    assert.strictEqual(result.property.status, "abandoned");
    assert.ok(result.warnings.includes("property_marked_abandoned:unpaid_taxes"));
  });
});
