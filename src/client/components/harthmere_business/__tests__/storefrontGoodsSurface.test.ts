import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HarthmereBusinessInterfacePanel } from "../HarthmereBusinessInterfacePanel";
import {
  createHarthmereBusinessInterfaceAdapter,
  getHarthmereBusinessShopfront,
  harthmereBusinessItemDisplayName,
  normalizeHarthmereBusinessEconomySnapshot,
} from "../businessInterfaceLiveAdapter";
import {
  harthmereBusinessJobMaterialListings,
  harthmereBusinessStorefrontTypes,
} from "@/shared/harthmere/harthmere_business_storefront_goods";
import {
  HARTHMERE_ENERGY_WEAPONS,
  HARTHMERE_ENERGY_WEAPON_VENDOR_ID,
} from "@/shared/harthmere/energy_weapon_catalog";
import { HARTHMERE_RECIPE_BOOKS } from "@/shared/harthmere/harthmere_recipe_books";
import { HARTHMERE_BUSINESS_SERVICE_ITEM_CATALOG } from "@/shared/harthmere/business_customer_simulator";

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
  it("gives every internal business service item a player-readable label", () => {
    for (const itemId of Object.keys(HARTHMERE_BUSINESS_SERVICE_ITEM_CATALOG)) {
      const label = harthmereBusinessItemDisplayName(itemId);
      assert.ok(label.length >= 3, itemId);
      assert.equal(
        /[a-z]+_[a-z]+/.test(label),
        false,
        `${itemId} leaked snake case as ${label}`
      );
      assert.equal(
        /[a-z][A-Z][a-z]/.test(label),
        false,
        `${itemId} leaked camel case as ${label}`
      );
    }
  });

  it("keeps internal service ids out of the customer shop and sells the real quest material", () => {
    const forge = openBusiness("biz_forge", "weapons_tools");
    forge.flags = { canonical_outpost_business: true };
    forge.inventory = {
      repair_tool: { itemId: "repair_tool", count: 2 },
      metal_part: { itemId: "metal_part", count: 5 },
      iron_ingot: { itemId: "iron_ingot", count: 6 },
      whetstone: { itemId: "whetstone", count: 6 },
      crystal_lens: { itemId: "crystal_lens", count: 3 },
    };
    const snapshot = normalizeHarthmereBusinessEconomySnapshot({
      actorId: "customer_a",
      businesses: { biz_forge: forge },
    } as any);
    const shop = getHarthmereBusinessShopfront(
      snapshot,
      "biz_forge",
      "customer"
    );

    assert.deepEqual(shop.inventory, []);
    const scrap = shop.storefrontGoods?.find(
      (good) => good.itemId === "scrap_metal"
    );
    assert.ok(scrap, "Cinderlane must sell the quest's actual Scrap Metal");
    assert.equal(scrap!.displayName, "Scrap Metal");
    assert.equal(harthmereBusinessItemDisplayName("metal_part"), "Metal Part");

    const adapter = createHarthmereBusinessInterfaceAdapter({
      state: snapshot,
      hydrated: true,
      refresh: async () => snapshot,
      submit: async () => ({ ok: true, economyState: snapshot }),
    });
    const html = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter,
        nearbyBusinessId: "biz_forge",
        compact: true,
        initialTab: "shopfront",
      })
    );
    const visibleText = html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    assert.ok(visibleText.includes("Scrap Metal"));
    assert.equal(visibleText.includes("metal_part"), false);
    assert.equal(visibleText.includes("crystal_lens"), false);
    assert.equal(
      /[a-z]+_[a-z]+/.test(visibleText),
      false,
      `customer shop leaked a developer id: ${visibleText}`
    );
  });

  it("customer-mode storefrontGoods includes the 5 blocks, 4 furnishings, and 1 recipe book", () => {
    const snapshot = normalizeHarthmereBusinessEconomySnapshot({
      businesses: { biz_clinic: openBusiness("biz_clinic", "medical_doctor") },
    } as any);
    const shop = getHarthmereBusinessShopfront(
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
    for (const businessType of harthmereBusinessStorefrontTypes()) {
      const snapshot = normalizeHarthmereBusinessEconomySnapshot({
        actorId: "customer_a",
        businesses: {
          [`biz_${businessType}`]: openBusiness(
            `biz_${businessType}`,
            businessType
          ),
        },
      } as any);
      const shop = getHarthmereBusinessShopfront(
        snapshot,
        `biz_${businessType}`,
        "customer"
      );
      const goods = shop.storefrontGoods ?? [];
      const restrictedWeaponCount =
        businessType === HARTHMERE_ENERGY_WEAPON_VENDOR_ID
          ? HARTHMERE_ENERGY_WEAPONS.length
          : 0;
      assert.equal(
        goods.length,
        10 +
          restrictedWeaponCount +
          harthmereBusinessJobMaterialListings(businessType).length,
        `${businessType} should sell themed goods, security exclusives, and material stock`
      );
      for (const good of goods) {
        assert.ok(good.displayName, `${businessType}:${good.itemId} label`);
        assert.ok(good.visual, `${businessType}:${good.itemId} visual`);
        assert.ok(
          good.visual.visualId.length > 0,
          `${businessType}:${good.itemId} visual id`
        );
        assert.ok(
          good.visual.glyph.length > 0,
          `${businessType}:${good.itemId} glyph`
        );
        assert.ok(
          good.visual.bikkieId,
          `${businessType}:${good.itemId} should retain its native Bikkie id for icon lookup`
        );
      }
    }
  });

  it("renders storefront goods as shop cards instead of compact inventory slots", () => {
    const snapshot = normalizeHarthmereBusinessEconomySnapshot({
      actorId: "customer_a",
      businesses: {
        biz_refinery: openBusiness("biz_refinery", "exotic_matter_refinery"),
      },
    } as any);
    const adapter = createHarthmereBusinessInterfaceAdapter({
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
    const perItemQuantityControls =
      html.match(/data-testid="biomes-business-storefront-quantity-/g) ?? [];
    assert.ok(
      perItemQuantityControls.length >= 9,
      "building materials and furnishings should each own their quantity control"
    );
    assert.equal(
      html.includes('aria-label="Purchase quantity"'),
      false,
      "customer shopfront should not render a top-level purchase quantity"
    );
    assert.ok(
      html.includes('data-testid="biomes-business-tool-for-sale-icon"')
    );
    assert.ok(html.includes('data-bikkie-visual="true"'));
    assert.ok(html.includes("data-bikkie-id="));
    assert.ok(html.includes("harthmere-business-product-card"));
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
    const book = HARTHMERE_RECIPE_BOOKS.find(
      (entry) => entry.businessType === "weapons_tools"
    )!;
    const snapshot = normalizeHarthmereBusinessEconomySnapshot({
      actorId: "customer_a",
      actorKnownRecipes: [...book.recipeIds],
      businesses: {
        biz_weapons: openBusiness("biz_weapons", "weapons_tools"),
      },
    } as any);
    const shop = getHarthmereBusinessShopfront(
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

    const adapter = createHarthmereBusinessInterfaceAdapter({
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
    const snapshot = normalizeHarthmereBusinessEconomySnapshot({
      actorId: "customer_a",
      businesses: { biz_clinic: clinic },
    } as any);
    const adapter = createHarthmereBusinessInterfaceAdapter({
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
    assert.ok(
      html.includes(
        'data-testid="biomes-business-shop-stock-quantity-field_medkit"'
      )
    );
    assert.ok(
      html.includes(
        'data-testid="biomes-business-shop-stock-quantity-medicine"'
      )
    );
  });
});
