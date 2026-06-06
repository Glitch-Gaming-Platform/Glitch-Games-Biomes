import assert from "assert";
import {
  defaultHarthmereProductionEconomyStateV1,
  reduceHarthmereEconomyMutationV1,
  type HarthmereEconomyMutationContextV1,
  type HarthmereEconomyMutationRequestV1,
  type HarthmereProductionEconomyStateV1,
} from "../mmo_economy_authority_v1";
import {
  ensureHarthmereBusinessStorefrontGoodsV1,
  harthmereBusinessStorefrontGoodsForTypeV1,
  harthmereBusinessStorefrontListingsForTypeV1,
} from "../harthmere_business_storefront_goods_v1";
import { ensureHarthmereProductionCraftingCatalogueV1 } from "../mmo_crafting_catalogue_v1";
import {
  HARTHMERE_RECIPE_BOOKS_V1,
  validateHarthmereRecipeBooksV1,
} from "../harthmere_recipe_books_v1";

const NOW_MS = 1_763_000_000_000;
const ACTOR = "storefront_buyer";

function ctx(
  overrides: Partial<HarthmereEconomyMutationContextV1> = {}
): HarthmereEconomyMutationContextV1 {
  return {
    actorGold: 50_000,
    actorInventoryItems: {},
    canManageGuildBusiness: () => false,
    canManageTownBusiness: () => false,
    allowNpcAdministration: false,
    ...overrides,
  };
}

let seq = 0;
// reduceHarthmereEconomyMutationV1(state, request, context)
function run(
  state: HarthmereProductionEconomyStateV1,
  operation: string,
  payload: Partial<HarthmereEconomyMutationRequestV1> = {},
  context = ctx()
) {
  seq += 1;
  return reduceHarthmereEconomyMutationV1(
    state,
    {
      requestId: `sf-${operation}-${seq}`,
      actorId: ACTOR,
      nowMs: NOW_MS,
      operation,
      ...payload,
    },
    context
  );
}

function openBusiness(type = "food_service_restaurant") {
  let state = defaultHarthmereProductionEconomyStateV1();
  const before = new Set(Object.keys(state.businesses));
  let r = run(state, "register_business", {
    businessType: type as any,
    name: `${type} Shop`,
  });
  assert.deepStrictEqual(r.warnings, []);
  const businessId = Object.keys(r.economy.businesses).find(
    (id) => !before.has(id)
  )!;
  assert.ok(businessId);
  r = run(r.economy, "issue_license", { businessId, licenseLevel: 1 });
  assert.deepStrictEqual(r.warnings, []);
  r = run(r.economy, "open_business", {
    businessId,
    propertyId: `property_${businessId}`,
    townId: "harthmere_grove",
  });
  assert.deepStrictEqual(r.warnings, []);
  return { state: r.economy, businessId };
}

describe("Harthmere business storefront purchase (buy_storefront_good)", () => {
  before(() => {
    ensureHarthmereProductionCraftingCatalogueV1();
    ensureHarthmereBusinessStorefrontGoodsV1();
  });

  it("registers one recipe book in every business storefront", () => {
    assert.deepStrictEqual(validateHarthmereRecipeBooksV1(), []);
    for (const book of HARTHMERE_RECIPE_BOOKS_V1) {
      const listings = harthmereBusinessStorefrontListingsForTypeV1(
        book.businessType
      );
      const bookListing = listings.find(
        (entry) => entry.itemId === book.itemId
      );
      assert.ok(bookListing, `${book.businessType} should sell ${book.itemId}`);
      assert.equal(bookListing!.kind, "recipe_book");
      assert.deepStrictEqual(bookListing!.recipeIds, book.recipeIds);
      assert.ok(bookListing!.buyPrice > 0);
    }
  });

  it("sells a themed block: buyer gets the item + pays gold, no inventory needed", () => {
    const { state, businessId } = openBusiness("food_service_restaurant");
    const block = harthmereBusinessStorefrontGoodsForTypeV1(
      "food_service_restaurant"
    )!.blocks[0];
    const r = run(state, "buy_storefront_good", {
      businessId,
      itemId: block,
      count: 2,
    });
    assert.deepStrictEqual(
      r.warnings.filter((w: string) => w.startsWith("economy_rejected")),
      []
    );
    assert.strictEqual(r.inventoryItemDeltas[block], 2);
    assert.ok(r.inventoryGoldDelta < 0, "buyer should pay gold");
  });

  it("sells a themed interior item too", () => {
    const { state, businessId } = openBusiness("hospitality_inn_hotel_shelter");
    const interior = harthmereBusinessStorefrontGoodsForTypeV1(
      "hospitality_inn_hotel_shelter"
    )!.interior[0];
    const r = run(state, "buy_storefront_good", {
      businessId,
      itemId: interior,
      count: 1,
    });
    assert.deepStrictEqual(
      r.warnings.filter((w: string) => w.startsWith("economy_rejected")),
      []
    );
    assert.strictEqual(r.inventoryItemDeltas[interior], 1);
  });

  it("sells a recipe book once, teaches its recipes, and does not add inventory stock", () => {
    const book = HARTHMERE_RECIPE_BOOKS_V1.find(
      (entry) => entry.businessType === "weapons_tools"
    )!;
    const { state, businessId } = openBusiness(book.businessType);
    const r = run(state, "buy_storefront_good", {
      businessId,
      itemId: book.itemId,
      count: 1,
    });
    assert.deepStrictEqual(
      r.warnings.filter((w: string) => w.startsWith("economy_rejected")),
      []
    );
    assert.deepStrictEqual(r.newRecipeIds, book.recipeIds);
    assert.equal(r.inventoryItemDeltas[book.itemId] ?? 0, 0);
    assert.ok(r.inventoryGoldDelta < 0, "buyer should pay gold");
  });

  it("rejects a recipe book repeat purchase when all taught recipes are already known", () => {
    const book = HARTHMERE_RECIPE_BOOKS_V1.find(
      (entry) => entry.businessType === "weapons_tools"
    )!;
    const { state, businessId } = openBusiness(book.businessType);
    const r = run(
      state,
      "buy_storefront_good",
      { businessId, itemId: book.itemId, count: 1 },
      ctx({ actorKnownRecipes: [...book.recipeIds] })
    );
    assert.ok(
      r.warnings.includes("economy_rejected:recipe_book_already_learned"),
      JSON.stringify(r.warnings)
    );
    assert.deepStrictEqual(r.newRecipeIds, []);
    assert.strictEqual(r.inventoryGoldDelta, 0);
  });

  it("rejects buying multiple copies of a recipe book at once", () => {
    const book = HARTHMERE_RECIPE_BOOKS_V1.find(
      (entry) => entry.businessType === "weapons_tools"
    )!;
    const { state, businessId } = openBusiness(book.businessType);
    const r = run(state, "buy_storefront_good", {
      businessId,
      itemId: book.itemId,
      count: 2,
    });
    assert.ok(
      r.warnings.includes("economy_rejected:recipe_book_single_purchase_only"),
      JSON.stringify(r.warnings)
    );
    assert.deepStrictEqual(r.newRecipeIds, []);
    assert.strictEqual(r.inventoryGoldDelta, 0);
  });

  it("rejects an item the business does not carry", () => {
    const { state, businessId } = openBusiness("food_service_restaurant");
    // neptunium is the refinery's block, not the restaurant's.
    const r = run(state, "buy_storefront_good", {
      businessId,
      itemId: "neptunium",
      count: 1,
    });
    assert.ok(
      r.warnings.includes("economy_rejected:item_not_in_storefront"),
      JSON.stringify(r.warnings)
    );
    assert.equal(r.inventoryItemDeltas["neptunium"] ?? 0, 0);
  });

  it("has unlimited / self-replenishing supply (a huge buy still succeeds)", () => {
    const { state, businessId } = openBusiness("general_trader");
    const block =
      harthmereBusinessStorefrontGoodsForTypeV1("general_trader")!.blocks[0];
    const r = run(
      state,
      "buy_storefront_good",
      { businessId, itemId: block, count: 999 },
      ctx({ actorGold: 1_000_000 })
    );
    assert.deepStrictEqual(
      r.warnings.filter((w: string) => w.startsWith("economy_rejected")),
      []
    );
    assert.strictEqual(r.inventoryItemDeltas[block], 999);
  });

  it("rejects when the buyer cannot afford it", () => {
    const { state, businessId } = openBusiness("food_service_restaurant");
    const block = harthmereBusinessStorefrontGoodsForTypeV1(
      "food_service_restaurant"
    )!.blocks[0];
    const r = run(
      state,
      "buy_storefront_good",
      { businessId, itemId: block, count: 5 },
      ctx({ actorGold: 0 })
    );
    assert.ok(
      r.warnings.some((w: string) => w.includes("insufficient_customer_gold")),
      JSON.stringify(r.warnings)
    );
  });
});
