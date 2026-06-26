import assert from "assert";
import {
  BUILDING_SYSTEM_MATERIAL_CATALOG,
  buildingSystemMaterialSourceForSymbol,
} from "../building_system";
import { HARTHMERE_BUSINESS_OUTPOSTS } from "../business_customer_simulator";
import {
  HARTHMERE_BUILDING_MATERIAL_BUSINESS_VENDOR_ID,
  HARTHMERE_VENDOR_CATALOG,
  ensureHarthmereProductionVendorCatalog,
} from "../harthmere_vendor_catalog";
import {
  getHarthmereItemDefinition,
  getHarthmereVendorEntry,
  reduceHarthmereInventoryMutation,
} from "../mmo_inventory_authority";

describe("building material source routing", () => {
  const materialOutpostId = "outpost_tools_cinderlane";
  const materialVendorId = HARTHMERE_BUILDING_MATERIAL_BUSINESS_VENDOR_ID;

  before(() => {
    ensureHarthmereProductionVendorCatalog();
  });

  it("makes every staged construction material findable at a 19-business outpost and buyable", () => {
    const materialOutpost = HARTHMERE_BUSINESS_OUTPOSTS.find(
      (outpost) => outpost.outpostId === materialOutpostId
    );
    assert.equal(HARTHMERE_BUSINESS_OUTPOSTS.length, 19);
    assert.ok(
      materialOutpost,
      "material source outpost must be one of the 19 businesses"
    );
    assert.equal(materialOutpost?.displayName, "Cinderlane Tool Forge");
    assert.equal(materialOutpost?.businessType, materialVendorId);
    const materialVendor = Object.values(HARTHMERE_VENDOR_CATALOG).find(
      (profile) => profile.businessOutpostId === materialOutpostId
    );
    assert.ok(materialVendor);

    for (const material of Object.keys(BUILDING_SYSTEM_MATERIAL_CATALOG)) {
      const source = buildingSystemMaterialSourceForSymbol(material);
      assert.ok(source, `missing source for ${material}`);
      assert.equal(source?.sourceKind, "buy", material);
      assert.equal(
        source?.sourceId,
        `${materialOutpostId}:business-counter`,
        material
      );
      assert.equal(
        source?.sourceName,
        "Cinderlane Tool Forge counter",
        material
      );
      assert.deepEqual(source?.position, [1630, 43, -775], material);
      assert.ok(
        getHarthmereItemDefinition(material),
        `missing item definition for ${material}`
      );
      assert.ok(
        getHarthmereVendorEntry(materialVendorId, material),
        `Cinderlane Tool Forge business storefront does not sell ${material}`
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
        vendorId: materialVendorId,
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
