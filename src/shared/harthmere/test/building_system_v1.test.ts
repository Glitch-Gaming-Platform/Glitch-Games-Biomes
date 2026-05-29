import assert from "assert";
import {
  BUILDING_SYSTEM_ABANDON_AFTER_UNPAID_TAX_MS_V1,
  BUILDING_SYSTEM_TAX_PERIOD_MS_V1,
  applyBuildingSystemPropertyLifecycleV1,
  buildingSystemBlueprintByIdV1,
  buildingSystemCanOpenDoorLockV1,
  buildingSystemCanUseStorageContainerV1,
  buildingSystemPlotByIdV1,
  createBuildingSystemDoorLockV1,
  createBuildingSystemPropertyRecordV1,
  createBuildingSystemStorageContainerV1,
} from "../building_system_v1";

const NOW_MS = 1_800_000_000_000;

describe("building_system_v1 — property access and lifecycle oversights", () => {
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
