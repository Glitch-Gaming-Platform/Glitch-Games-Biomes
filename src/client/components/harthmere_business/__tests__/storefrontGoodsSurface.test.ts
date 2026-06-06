import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HarthmereBusinessInterfacePanel } from "../HarthmereBusinessInterfacePanel";
import {
  createHarthmereBusinessInterfaceAdapterV1,
  getHarthmereBusinessShopfrontV1,
  normalizeHarthmereBusinessEconomySnapshotV1,
} from "../businessInterfaceLiveAdapter";
import { harthmereBusinessStorefrontTypesV1 } from "@/shared/harthmere/harthmere_business_storefront_goods_v1";
import { HARTHMERE_RECIPE_BOOKS_V1 } from "@/shared/harthmere/harthmere_recipe_books_v1";

function openBusiness(id: string, typeId: string) {
  return {
    businessId: id,
    ownerKind: "player" as const,
    ownerId: "owner_x",
    typeId,
    name: `${typeId} Shop`,
    status: "open" as const,
    licenseClass: "basic_trade",
    licenseLevel: 2,
    propertyId: `property_${id}`,
    townId: "harthmere_grove",
    regionId: "harthmere_grove_region",
    inventory: {},
    storageMaxSlots: 12,
    employees: [],
    activeContracts: [],
    completedContracts: 0,
    reputation: 10,
    customerSatisfaction: 70,
    sanitationRating: 70,
    safetyRating: 68,
    serviceRadius: 2,
    priceModifiers: {},
    balanceGold: 100,
    debtGold: 0,
    upkeepGoldPerDay: 5,
    rentGoldPerDay: 3,
    wageGoldPerDay: 0,
    salesTaxRate: 0.06,
    lastTickAtMs: 1_800_000_000_000,
    createdAtMs: 1_800_000_000_000,
    updatedAtMs: 1_800_000_000_000,
    flags: {},
  };
}

describe("business shopfront surfaces blocks, furnishings, and recipe books", () => {
  it("customer-mode storefrontGoods includes the 5 blocks, 4 furnishings, and 1 recipe book", () => {
    const snapshot = normalizeHarthmereBusinessEconomySnapshotV1({
      businesses: { biz_clinic: openBusiness("biz_clinic", "medical_doctor") },
    } as any);
    const shop = getHarthmereBusinessShopfrontV1(
      snapshot,
      "biz_clinic",
      "customer"
    );
    const goods = shop.storefrontGoods ?? [];
    const blocks = goods.filter((g) => g.kind === "block");
    const interior = goods.filter((g) => g.kind === "interior");
    const recipeBooks = goods.filter((g) => g.kind === "recipe_book");
    assert.equal(blocks.length, 5, `expected 5 blocks, got ${blocks.length}`);
    assert.equal(
      interior.length,
      4,
      `expected 4 furnishings, got ${interior.length}: ${JSON.stringify(goods)}`
    );
    assert.equal(recipeBooks.length, 1);
    assert.ok(recipeBooks[0].recipeIds?.length);
  });

  it("resolves a Bikkie visual tile for every item in all 19 storefronts", () => {
    for (const businessType of harthmereBusinessStorefrontTypesV1()) {
      const snapshot = normalizeHarthmereBusinessEconomySnapshotV1({
        actorId: "customer_a",
        businesses: {
          [`biz_${businessType}`]: openBusiness(
            `biz_${businessType}`,
            businessType
          ),
        },
      } as any);
      const shop = getHarthmereBusinessShopfrontV1(
        snapshot,
        `biz_${businessType}`,
        "customer"
      );
      const goods = shop.storefrontGoods ?? [];
      assert.equal(goods.length, 10, `${businessType} should sell 10 goods`);
      for (const good of goods) {
        assert.ok(good.displayName, `${businessType}:${good.itemId} label`);
        assert.ok(good.visual, `${businessType}:${good.itemId} visual`);
        assert.ok(
          good.visual!.visualId.length > 0,
          `${businessType}:${good.itemId} visual id`
        );
        assert.ok(
          good.visual!.glyph.length > 0,
          `${businessType}:${good.itemId} glyph`
        );
      }
    }
  });

  it("renders storefront goods as shop cards instead of compact inventory slots", () => {
    const snapshot = normalizeHarthmereBusinessEconomySnapshotV1({
      actorId: "customer_a",
      businesses: {
        biz_refinery: openBusiness("biz_refinery", "exotic_matter_refinery"),
      },
    } as any);
    const adapter = createHarthmereBusinessInterfaceAdapterV1({
      state: snapshot,
      hydrated: true,
      refresh: async () => snapshot,
      submit: async () => ({ ok: true, economyState: snapshot }),
    });

    const html = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter,
        nearbyBusinessId: "biz_refinery",
        compact: true,
        initialTab: "shopfront",
      })
    );

    const storefrontCards =
      html.match(/data-testid="biomes-business-storefront-good-(?!icon-)/g) ??
      [];
    assert.ok(storefrontCards.length >= 10);
    const storefrontIcons =
      html.match(/data-testid="biomes-business-storefront-good-icon-/g) ?? [];
    assert.equal(storefrontIcons.length, storefrontCards.length);
    assert.ok(
      html.includes('data-testid="biomes-business-tool-for-sale-icon"')
    );
    assert.ok(html.includes('data-bikkie-visual="true"'));
    assert.ok(
      html.includes('data-testid="biomes-business-storefront-section-block"')
    );
    assert.ok(
      html.includes('data-testid="biomes-business-storefront-section-interior"')
    );
    assert.ok(
      html.includes(
        'data-testid="biomes-business-storefront-section-recipe_book"'
      )
    );
    assert.ok(
      html.includes('data-testid="biomes-business-storefront-section-stock"')
    );
    assert.ok(html.includes('data-testid="biomes-business-tool-for-sale"'));
    assert.ok(html.includes("Building Materials"));
    assert.ok(html.includes("Furnishings"));
    assert.ok(html.includes("Recipe Books"));
    assert.ok(html.includes("Shop Stock"));
    assert.equal(
      html.includes('class="biomes-ui-slot"'),
      false,
      "storefront goods should not inherit hotbar/inventory slot dimensions"
    );
    assert.ok(html.includes("Buy Containment Tongs"));
  });

  it("marks a recipe book learned when the actor knows all recipes in it", () => {
    const book = HARTHMERE_RECIPE_BOOKS_V1.find(
      (entry) => entry.businessType === "weapons_tools"
    )!;
    const snapshot = normalizeHarthmereBusinessEconomySnapshotV1({
      actorId: "customer_a",
      actorKnownRecipes: [...book.recipeIds],
      businesses: {
        biz_weapons: openBusiness("biz_weapons", "weapons_tools"),
      },
    } as any);
    const shop = getHarthmereBusinessShopfrontV1(
      snapshot,
      "biz_weapons",
      "customer"
    );
    const recipeBook = shop.storefrontGoods?.find(
      (good) => good.kind === "recipe_book"
    );
    assert.ok(recipeBook);
    assert.equal(recipeBook!.itemId, book.itemId);
    assert.equal(recipeBook!.learned, true);

    const adapter = createHarthmereBusinessInterfaceAdapterV1({
      state: snapshot,
      hydrated: true,
      refresh: async () => snapshot,
      submit: async () => ({ ok: true, economyState: snapshot }),
    });
    const html = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter,
        nearbyBusinessId: "biz_weapons",
        compact: true,
        initialTab: "shopfront",
      })
    );
    assert.ok(html.includes("Learned"));
  });

  it("renders Bikkie visual tiles for normal shop stock cards", () => {
    const clinic = {
      ...openBusiness("biz_clinic", "medical_doctor"),
      inventory: {
        field_medkit: { itemId: "field_medkit", count: 1 },
        medicine: { itemId: "medicine", count: 5 },
      },
    };
    const snapshot = normalizeHarthmereBusinessEconomySnapshotV1({
      actorId: "customer_a",
      businesses: { biz_clinic: clinic },
    } as any);
    const adapter = createHarthmereBusinessInterfaceAdapterV1({
      state: snapshot,
      hydrated: true,
      refresh: async () => snapshot,
      submit: async () => ({ ok: true, economyState: snapshot }),
    });

    const html = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter,
        nearbyBusinessId: "biz_clinic",
        compact: true,
        initialTab: "shopfront",
      })
    );

    assert.ok(html.includes("Field Medkit"));
    assert.ok(html.includes("Medicine"));
    assert.ok(
      html.includes(
        'data-testid="biomes-business-shop-stock-icon-field_medkit"'
      )
    );
    assert.ok(
      html.includes('data-testid="biomes-business-shop-stock-icon-medicine"')
    );
  });
});
