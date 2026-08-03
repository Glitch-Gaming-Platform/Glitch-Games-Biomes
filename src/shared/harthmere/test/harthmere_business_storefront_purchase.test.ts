import assert from "assert";
import {
  defaultHarthmereProductionEconomyState,
  reduceHarthmereEconomyMutation,
  type HarthmereEconomyMutationContext,
  type HarthmereEconomyMutationRequest,
  type HarthmereProductionEconomyState,
} from "../mmo_economy_authority";
import {
  ensureHarthmereBusinessStorefrontGoods,
  harthmereBusinessStorefrontGoodsForType,
  harthmereBusinessStorefrontListingsForType,
} from "../harthmere_business_storefront_goods";
import { ensureHarthmereProductionCraftingCatalogue } from "../mmo_crafting_catalogue";
import {
  HARTHMERE_RECIPE_BOOKS,
  validateHarthmereRecipeBooks,
} from "../harthmere_recipe_books";
import {
  harthmereBusinessToolForType,
  harthmereBusinessToolListings,
} from "../harthmere_business_tool_shop";

const NOW_MS = 1_763_000_000_000;
const ACTOR = "storefront_buyer";

function ctx(
  overrides: Partial<HarthmereEconomyMutationContext> = {}
): HarthmereEconomyMutationContext {
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
// reduceHarthmereEconomyMutation(state, request, context)
function run(
  state: HarthmereProductionEconomyState,
  operation: string,
  payload: Partial<HarthmereEconomyMutationRequest> = {},
  context = ctx()
) {
  seq += 1;
  return reduceHarthmereEconomyMutation(
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
  let state = defaultHarthmereProductionEconomyState();
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
  // The matrix includes regulated businesses such as the clinic. Use the
  // highest authored license tier so this helper tests the sale rather than
  // failing during setup on a type-specific licensing prerequisite.
  r = run(r.economy, "issue_license", { businessId, licenseLevel: 3 });
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
    ensureHarthmereProductionCraftingCatalogue();
    ensureHarthmereBusinessStorefrontGoods();
  });

  it("registers one recipe book in every business storefront", () => {
    assert.deepStrictEqual(validateHarthmereRecipeBooks(), []);
    for (const book of HARTHMERE_RECIPE_BOOKS) {
      const listings = harthmereBusinessStorefrontListingsForType(
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
    const block = harthmereBusinessStorefrontGoodsForType(
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
    const interior = harthmereBusinessStorefrontGoodsForType(
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

  it("sells a finished Workbench material from the matching business", () => {
    const { state, businessId } = openBusiness("weapons_tools");
    const listing = harthmereBusinessStorefrontListingsForType(
      "weapons_tools"
    ).find((entry) => entry.itemId === "iron_ingot")!;
    assert.equal(listing.kind, "material");
    const r = run(state, "buy_storefront_good", {
      businessId,
      itemId: listing.itemId,
      count: 2,
    });
    assert.deepStrictEqual(
      r.warnings.filter((warning: string) =>
        warning.startsWith("economy_rejected")
      ),
      []
    );
    assert.equal(r.inventoryItemDeltas.iron_ingot, 2);
  });

  it("sells actual Scrap Metal for the Chapter 1 repair quest", () => {
    const { state, businessId } = openBusiness("weapons_tools");
    const listing = harthmereBusinessStorefrontListingsForType(
      "weapons_tools"
    ).find((entry) => entry.itemId === "scrap_metal");
    assert.ok(listing);
    assert.equal(listing!.kind, "material");

    const result = run(state, "buy_storefront_good", {
      businessId,
      itemId: "scrap_metal",
      count: 4,
    });
    assert.deepStrictEqual(
      result.warnings.filter((warning: string) =>
        warning.startsWith("economy_rejected")
      ),
      []
    );
    assert.equal(result.inventoryItemDeltas.scrap_metal, 4);
    assert.equal(result.inventoryItemDeltas.metal_part, undefined);
    assert.ok(result.inventoryGoldDelta < 0);
  });

  it("sells each restricted energy weapon at its fixed Security & Defense price", () => {
    const { state, businessId } = openBusiness("security_defense_contractor");
    const listings = harthmereBusinessStorefrontListingsForType(
      "security_defense_contractor"
    ).filter((entry) => entry.kind === "weapon");
    assert.deepEqual(
      listings.map(({ buyPrice }) => buyPrice),
      [5_000, 12_500, 30_000, 75_000, 180_000]
    );
    for (const listing of listings) {
      const r = run(
        state,
        "buy_storefront_good",
        { businessId, itemId: listing.itemId, count: 1 },
        ctx({ actorGold: 250_000 })
      );
      assert.deepStrictEqual(
        r.warnings.filter((warning: string) =>
          warning.startsWith("economy_rejected")
        ),
        []
      );
      assert.equal(r.inventoryItemDeltas[listing.itemId], 1);
      assert.equal(r.inventoryGoldDelta, -listing.buyPrice);
    }
  });

  it("sells a recipe book once, teaches its recipes, and does not add inventory stock", () => {
    const book = HARTHMERE_RECIPE_BOOKS.find(
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
    const book = HARTHMERE_RECIPE_BOOKS.find(
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
    const book = HARTHMERE_RECIPE_BOOKS.find(
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
      harthmereBusinessStorefrontGoodsForType("general_trader")!.blocks[0];
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
    const block = harthmereBusinessStorefrontGoodsForType(
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

describe("Harthmere business tool purchase (buy_business_tool)", function () {
  this.timeout(60_000);
  before(() => {
    ensureHarthmereProductionCraftingCatalogue();
  });

  it("atomically sells the Field Surgeon's Kit for its exact listed price", () => {
    const listing = harthmereBusinessToolForType("medical_doctor")!;
    const { state, businessId } = openBusiness("medical_doctor");
    const balanceBefore = state.businesses[businessId].balanceGold;
    const ledgerBefore = state.ledger.length;
    const result = run(state, "buy_business_tool", {
      businessId,
      itemId: listing.toolItemId,
      count: 1,
    });

    assert.deepStrictEqual(
      result.warnings.filter((warning) =>
        warning.startsWith("economy_rejected")
      ),
      []
    );
    assert.equal(result.inventoryItemDeltas.field_surgeon_kit, 1);
    assert.equal(result.inventoryGoldDelta, -38);
    assert.equal(result.economy.ledger.length, ledgerBefore + 1);
    assert.equal(result.economy.ledger.at(-1)?.kind, "business_tool_purchased");
    assert.ok(
      result.economy.businesses[businessId].balanceGold > balanceBefore,
      "the shop should receive the sale proceeds after tax"
    );
  });

  it("delivers every one of the 19 business tools to inventory", () => {
    const listings = harthmereBusinessToolListings();
    assert.equal(listings.length, 19);
    for (const listing of listings) {
      const { state, businessId } = openBusiness(listing.businessType);
      const result = run(state, "buy_business_tool", {
        businessId,
        itemId: listing.toolItemId,
        count: 1,
      });
      assert.deepStrictEqual(
        result.warnings.filter((warning) =>
          warning.startsWith("economy_rejected")
        ),
        [],
        `${listing.businessType} rejected ${listing.toolItemId}`
      );
      assert.equal(
        result.inventoryItemDeltas[listing.toolItemId],
        1,
        listing.toolItemId
      );
      assert.equal(
        result.inventoryGoldDelta,
        -listing.priceGold,
        listing.toolItemId
      );
    }
  });

  it("leaves gold, inventory, stock, and ledger unchanged when a tool purchase fails", () => {
    const listing = harthmereBusinessToolForType("medical_doctor")!;
    const cases = [
      {
        name: "insufficient gold",
        payload: { itemId: listing.toolItemId, count: 1 },
        context: ctx({ actorGold: listing.priceGold - 1 }),
        warning: "economy_rejected:insufficient_customer_gold_for_sale",
      },
      {
        name: "already owned",
        payload: { itemId: listing.toolItemId, count: 1 },
        context: ctx({ actorInventoryItems: { [listing.toolItemId]: 1 } }),
        warning: "economy_rejected:business_tool_already_owned",
      },
      {
        name: "wrong listing",
        payload: { itemId: "ward_hammer", count: 1 },
        context: ctx(),
        warning: "economy_rejected:business_tool_listing_mismatch",
      },
      {
        name: "multiple copies",
        payload: { itemId: listing.toolItemId, count: 2 },
        context: ctx(),
        warning: "economy_rejected:business_tool_single_purchase_only",
      },
    ] as const;

    for (const testCase of cases) {
      const { state, businessId } = openBusiness("medical_doctor");
      const businessBefore = structuredClone(state.businesses[businessId]);
      const ledgerBefore = structuredClone(state.ledger);
      const result = run(
        state,
        "buy_business_tool",
        { businessId, ...testCase.payload },
        testCase.context
      );
      assert.ok(
        result.warnings.includes(testCase.warning),
        `${testCase.name}: ${JSON.stringify(result.warnings)}`
      );
      assert.equal(result.inventoryGoldDelta, 0, testCase.name);
      assert.deepStrictEqual(result.inventoryItemDeltas, {}, testCase.name);
      assert.deepStrictEqual(
        result.economy.businesses[businessId],
        businessBefore,
        testCase.name
      );
      assert.deepStrictEqual(
        result.economy.ledger,
        ledgerBefore,
        testCase.name
      );
    }
  });

  it("rejects legacy stock with no native item identity before charging or removing it", () => {
    const { state, businessId } = openBusiness("medical_doctor");
    state.businesses[businessId].inventory.legacy_unmapped_surgical_tool = {
      itemId: "legacy_unmapped_surgical_tool",
      count: 1,
    };
    const balanceBefore = state.businesses[businessId].balanceGold;
    const result = run(state, "record_customer_sale", {
      businessId,
      itemId: "legacy_unmapped_surgical_tool",
      count: 1,
    });

    assert.ok(
      result.warnings.includes("economy_rejected:item_not_purchasable")
    );
    assert.equal(result.inventoryGoldDelta, 0);
    assert.deepStrictEqual(result.inventoryItemDeltas, {});
    assert.equal(
      result.economy.businesses[businessId].inventory
        .legacy_unmapped_surgical_tool.count,
      1
    );
    assert.equal(
      result.economy.businesses[businessId].balanceGold,
      balanceBefore
    );
  });
});
