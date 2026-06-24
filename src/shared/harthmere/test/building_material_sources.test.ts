import assert from "assert";
import {
  BUILDING_SYSTEM_MATERIAL_CATALOG,
  buildingSystemMaterialSourceForSymbol,
} from "../building_system";
import { ensureHarthmereProductionVendorCatalog } from "../harthmere_vendor_catalog";
import {
  getHarthmereItemDefinition,
  getHarthmereVendorEntry,
  reduceHarthmereInventoryMutation,
} from "../mmo_inventory_authority";

describe("building material source routing", () => {
  before(() => {
    ensureHarthmereProductionVendorCatalog();
  });

  it("makes every staged construction material findable and buyable", () => {
    for (const material of Object.keys(BUILDING_SYSTEM_MATERIAL_CATALOG)) {
      const source = buildingSystemMaterialSourceForSymbol(material);
      assert.ok(source, `missing source for ${material}`);
      assert.equal(source?.sourceKind, "buy", material);
      assert.equal(source?.sourceId, "black_anvil_building_counter", material);
      assert.deepEqual(source?.position, [1630, 43, -780], material);
      assert.ok(
        getHarthmereItemDefinition(material),
        `missing item definition for ${material}`
      );
      assert.ok(
        getHarthmereVendorEntry("black_anvil_smithy", material),
        `Black Anvil does not sell ${material}`
      );
    }
  });

  it("lets the live inventory authority buy a missing building material", () => {
    const result = reduceHarthmereInventoryMutation(
      {
        requestId: "buy_rough_stone_for_building",
        actorId: "builder",
        kind: "buy_from_vendor",
        itemId: "rough_stone",
        vendorId: "black_anvil_smithy",
        count: 1,
        nowMs: 1_800_000_000_000,
      },
      {
        snapshot: {
          actorId: "builder",
          gold: 25,
          equipment: {},
          items: {},
          bank: {},
          escrow: {},
          consumableCooldowns: {},
          knownAbilities: [],
          knownRecipes: [],
        },
        playerLevel: 1,
        playerSkills: {},
        reputation: {},
      }
    );

    assert.equal(result.ok, true);
    assert.equal(result.itemDeltas.rough_stone, 1);
    assert.ok(result.goldDelta < 0);
  });
});
