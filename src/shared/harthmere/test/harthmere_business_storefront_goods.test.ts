import assert from "assert";
import {
  ensureHarthmereBusinessStorefrontGoods,
  harthmereBusinessJobMaterialListings,
  harthmereBusinessStorefrontListingsForType,
  harthmereBusinessStorefrontTypes,
  validateHarthmereBusinessStorefrontGoods,
} from "../harthmere_business_storefront_goods";
import {
  getHarthmereItemDefinition,
  getHarthmereVendorEntry,
  reduceHarthmereInventoryMutation,
  type HarthmereInventoryMutationRequest,
  type HarthmereInventorySnapshot,
} from "../mmo_inventory_authority";
import { HARTHMERE_BUSINESS_OUTPOSTS } from "../business_customer_simulator";
import { harthmereResolveBikkieVisual } from "../bikkie_visual_resolver";

const NOW_MS = 1_762_000_000_000;
const ACTOR = "storefront_player";

function snapshot(
  overrides: Partial<HarthmereInventorySnapshot> = {}
): HarthmereInventorySnapshot {
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
  base: HarthmereInventorySnapshot,
  vendorId: string,
  itemId: string,
  count: number
) {
  return reduceHarthmereInventoryMutation(
    {
      requestId: `sf-${vendorId}-${itemId}`,
      actorId: ACTOR,
      kind: "buy_from_vendor",
      nowMs: NOW_MS,
      vendorId,
      itemId,
      count,
    } as HarthmereInventoryMutationRequest,
    { snapshot: base, playerLevel: 10, playerSkills: {}, reputation: {} }
  );
}

describe("Harthmere business storefront goods", () => {
  before(() => {
    ensureHarthmereBusinessStorefrontGoods();
  });

  it("gives all 19 businesses a valid 5-block + 4-interior + 1-book storefront", () => {
    assert.deepEqual(validateHarthmereBusinessStorefrontGoods(), []);
    // Every real outpost business type is covered.
    const types = new Set(harthmereBusinessStorefrontTypes());
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
      assert.ok(
        types.has(outpost.businessType),
        `missing storefront for ${outpost.businessType}`
      );
    }
    assert.equal(types.size, 19);
  });

  it("registers repeat-buy goods, but not one-time recipe books, as unlimited vendor entries", () => {
    for (const businessType of harthmereBusinessStorefrontTypes()) {
      const listings = harthmereBusinessStorefrontListingsForType(businessType);
      const restrictedWeaponCount =
        businessType === "security_defense_contractor" ? 5 : 0;
      assert.equal(
        listings.length,
        10 +
          restrictedWeaponCount +
          harthmereBusinessJobMaterialListings(businessType).length,
        `${businessType} should sell its themed goods, security exclusives, and real material stock`
      );
      assert.equal(
        listings.filter((listing) => listing.kind === "recipe_book").length,
        1,
        `${businessType} should sell exactly one recipe book`
      );
      for (const listing of listings) {
        const entry = getHarthmereVendorEntry(businessType, listing.itemId);
        if (listing.kind === "recipe_book") {
          assert.equal(
            entry,
            undefined,
            `${businessType}:${listing.itemId} must not bypass one-time rules through buy_from_vendor`
          );
          continue;
        }
        assert.ok(entry, `${businessType} missing entry for ${listing.itemId}`);
        assert.equal(entry!.stock, -1, "must be unlimited/self-replenishing");
        assert.ok(entry!.buyPrice > 0);
      }
    }
  });

  it("registers enough metadata for every storefront good to resolve a Bikkie visual", () => {
    for (const businessType of harthmereBusinessStorefrontTypes()) {
      for (const listing of harthmereBusinessStorefrontListingsForType(
        businessType
      )) {
        const definition = getHarthmereItemDefinition(listing.itemId);
        assert.ok(
          definition,
          `${businessType}:${listing.itemId} should have an item definition`
        );
        const visual = harthmereResolveBikkieVisual({
          id: listing.itemId,
          label: definition!.displayName,
          kind: definition!.category ?? listing.kind,
          description: definition!.description,
          objectMetadata: definition!.objectMetadata,
        });
        assert.ok(
          visual.visualId.length > 0,
          `${businessType}:${listing.itemId} visual id`
        );
        assert.ok(
          visual.glyph.length > 0,
          `${businessType}:${listing.itemId} glyph`
        );
        assert.match(visual.primaryHex, /^#[0-9a-f]{6}$/);
      }
    }
  });

  it("sells a block from a business with truly unlimited supply (many buys never deplete)", () => {
    const businessType = "biome_farming_rare_foods";
    const listing = harthmereBusinessStorefrontListingsForType(businessType)[0];
    let state = snapshot();
    // Buy a large quantity repeatedly — stock -1 means it never runs out.
    for (let i = 0; i < 50; i++) {
      const result = buy(state, businessType, listing.itemId, 10);
      assert.ok(result.ok, `buy ${i} failed: ${result.errors.join(",")}`);
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
    const interior = harthmereBusinessStorefrontListingsForType(
      businessType
    ).find((l) => l.kind === "interior")!;
    const result = buy(snapshot(), businessType, interior.itemId, 1);
    assert.ok(result.ok, result.errors.join(","));
    assert.equal(result.itemDeltas[interior.itemId], 1);
  });

  it("exposes finished Workbench materials through the businesses that make them", () => {
    const iron = harthmereBusinessStorefrontListingsForType(
      "weapons_tools"
    ).find((listing) => listing.itemId === "iron_ingot");
    const planks = harthmereBusinessStorefrontListingsForType(
      "custom_home_property_development"
    ).find((listing) => listing.itemId === "wood_plank");
    assert.equal(iron?.kind, "material");
    assert.equal(planks?.kind, "material");
    assert.equal(
      getHarthmereVendorEntry("weapons_tools", "iron_ingot")?.stock,
      -1
    );
    assert.equal(
      getHarthmereVendorEntry("custom_home_property_development", "wood_plank")
        ?.stock,
      -1
    );
  });
});
