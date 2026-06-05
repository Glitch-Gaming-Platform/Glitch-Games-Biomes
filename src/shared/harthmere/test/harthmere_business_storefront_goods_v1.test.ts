import assert from "assert";
import {
  ensureHarthmereBusinessStorefrontGoodsV1,
  harthmereBusinessStorefrontListingsForTypeV1,
  harthmereBusinessStorefrontTypesV1,
  validateHarthmereBusinessStorefrontGoodsV1,
} from "../harthmere_business_storefront_goods_v1";
import {
  getHarthmereVendorEntryV1,
  reduceHarthmereInventoryMutationV1,
  type HarthmereInventoryMutationRequestV1,
  type HarthmereInventorySnapshotV1,
} from "../mmo_inventory_authority_v1";
import { HARTHMERE_BUSINESS_OUTPOSTS_V1 } from "../business_customer_simulator_v1";

const NOW_MS = 1_762_000_000_000;
const ACTOR = "storefront_player";

function snapshot(
  overrides: Partial<HarthmereInventorySnapshotV1> = {}
): HarthmereInventorySnapshotV1 {
  return {
    actorId: ACTOR,
    gold: 100_000,
    equipment: {},
    items: {},
    bank: {},
    escrow: {},
    consumableCooldowns: {},
    knownAbilities: [],
    knownRecipes: [],
    ...overrides,
  };
}

function buy(
  base: HarthmereInventorySnapshotV1,
  vendorId: string,
  itemId: string,
  count: number
) {
  return reduceHarthmereInventoryMutationV1(
    {
      requestId: `sf-${vendorId}-${itemId}`,
      actorId: ACTOR,
      kind: "buy_from_vendor",
      nowMs: NOW_MS,
      vendorId,
      itemId,
      count,
    } as HarthmereInventoryMutationRequestV1,
    { snapshot: base, playerLevel: 10, playerSkills: {}, reputation: {} }
  );
}

describe("Harthmere business storefront goods", () => {
  before(() => {
    ensureHarthmereBusinessStorefrontGoodsV1();
  });

  it("gives all 19 businesses a valid 5-block + 4-interior storefront", () => {
    assert.deepEqual(validateHarthmereBusinessStorefrontGoodsV1(), []);
    // Every real outpost business type is covered.
    const types = new Set(harthmereBusinessStorefrontTypesV1());
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS_V1) {
      assert.ok(
        types.has(outpost.businessType),
        `missing storefront for ${outpost.businessType}`
      );
    }
    assert.equal(types.size, 19);
  });

  it("registers each good as an UNLIMITED (stock -1) vendor entry on its business", () => {
    for (const businessType of harthmereBusinessStorefrontTypesV1()) {
      const listings =
        harthmereBusinessStorefrontListingsForTypeV1(businessType);
      assert.equal(listings.length, 9, `${businessType} should sell 9 goods`);
      for (const listing of listings) {
        const entry = getHarthmereVendorEntryV1(businessType, listing.itemId);
        assert.ok(entry, `${businessType} missing entry for ${listing.itemId}`);
        assert.equal(entry!.stock, -1, "must be unlimited/self-replenishing");
        assert.ok(entry!.buyPrice > 0);
      }
    }
  });

  it("sells a block from a business with truly unlimited supply (many buys never deplete)", () => {
    const businessType = "biome_farming_rare_foods";
    const listing =
      harthmereBusinessStorefrontListingsForTypeV1(businessType)[0];
    let state = snapshot();
    // Buy a large quantity repeatedly — stock -1 means it never runs out.
    for (let i = 0; i < 50; i++) {
      const result = buy(state, businessType, listing.itemId, 10);
      assert.ok(
        result.ok,
        `buy ${i} failed: ${result.errors.join(",")}`
      );
      // apply gold/item deltas into a fresh snapshot for the next iteration
      state = snapshot({
        gold: state.gold + result.goldDelta,
        items: {
          ...state.items,
          [listing.itemId]:
            (state.items[listing.itemId] ?? 0) +
            (result.itemDeltas[listing.itemId] ?? 0),
        },
      });
    }
    assert.equal(state.items[listing.itemId], 500);
  });

  it("sells an interior item from a business too", () => {
    const businessType = "hospitality_inn_hotel_shelter";
    const interior = harthmereBusinessStorefrontListingsForTypeV1(
      businessType
    ).find((l) => l.kind === "interior")!;
    const result = buy(snapshot(), businessType, interior.itemId, 1);
    assert.ok(result.ok, result.errors.join(","));
    assert.equal(result.itemDeltas[interior.itemId], 1);
  });
});
