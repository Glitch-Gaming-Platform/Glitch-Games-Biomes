// HARTHMERE_BUSINESS_STOREFRONT_GOODS_V1
//
// Each of the 19 outpost businesses carries a themed storefront of building
// materials + interior furnishings + one recipe book, on TOP of what it already
// sells (its themed tool, food, etc.). Every business offers 5 building blocks,
// 4 interior/decor items, and 1 recipe book relevant to its trade.
//
// Supply is UNLIMITED and self-replenishing: the goods are registered as vendor
// entries with stock = -1 (the buy reducer treats -1 as never-out-of-stock), so
// no matter how many players buy, the shelves never run dry. This mirrors the
// per-business tool shop (harthmere_business_tool_shop_v151) for normal goods.
// Recipe books are sold only through buy_storefront_good so the backend can
// enforce one purchase per player based on knownRecipes.
//
// Pure module (string ids only) except for the registration step, which prices
// each good from its registered item def and is guarded against re-running.

import {
  ensureHarthmerePlaceableDecorCatalogueV1,
  harthmerePlaceableDecorItemIdsV1,
} from "@/shared/harthmere/mmo_placeable_decor_catalogue_v1";
import {
  ensureHarthmereSpecializedBlocksCatalogueV1,
  harthmereSpecializedBlockItemIdsV1,
} from "@/shared/harthmere/mmo_specialized_blocks_catalogue_v1";
import {
  getHarthmereItemDefinitionV1,
  getHarthmereVendorEntryV1,
  registerHarthmereVendorEntryV1,
} from "@/shared/harthmere/mmo_inventory_authority_v1";
import {
  ensureHarthmereRecipeBookItemsV1,
  harthmereRecipeBookForBusinessTypeV1,
  harthmereRecipeBookForItemV1,
  harthmereRecipeBookLearnableRecipeIdsV1,
  type HarthmereRecipeBookDefinitionV1,
} from "@/shared/harthmere/harthmere_recipe_books_v1";
import { HARTHMERE_BUSINESS_OUTPOSTS_V1 } from "@/shared/harthmere/business_customer_simulator_v1";
import type { HarthmereEconomyBusinessTypeIdV1 } from "@/shared/harthmere/mmo_economy_authority_v1";

export const HARTHMERE_BUSINESS_STOREFRONT_GOODS_VERSION_V1 =
  "harthmere-business-storefront-goods-v1" as const;

export interface HarthmereBusinessStorefrontGoodsV1 {
  /** 5 building-block item ids themed to the business. */
  blocks: readonly string[];
  /** 4 interior / decor item ids themed to the business. */
  interior: readonly string[];
}

// businessType -> its themed 5 blocks + 4 interior items. These are a curated,
// trade-relevant selection (blocks may recur across businesses — there are only
// ~53 blocks for 19 shops — but each storefront is a distinct themed set).
const HARTHMERE_BUSINESS_STOREFRONT_GOODS_V1: Readonly<
  Record<HarthmereEconomyBusinessTypeIdV1, HarthmereBusinessStorefrontGoodsV1>
> = {
  exotic_matter_refinery: {
    blocks: ["neptunium", "led", "asphalt", "copper", "basalt_brick"],
    interior: ["led_panel", "lockbox", "boombox", "wall_lantern"],
  },
  biome_maintenance_repair: {
    blocks: [
      "stone_brick",
      "cobblestone_brick",
      "oak_reinforced",
      "asphalt",
      "copper",
    ],
    interior: ["shelf", "wood_container", "wall_lantern", "mailbox"],
  },
  biome_design_studio: {
    blocks: [
      "stone_polished",
      "granite_polished",
      "quartzite_carved",
      "simple_glass",
      "cotton_fabric",
    ],
    interior: [
      "large_oak_frame",
      "display_shelf",
      "runic_stone_light",
      "padded_chair",
    ],
  },
  security_defense_contractor: {
    blocks: [
      "basalt_brick",
      "stone_brick",
      "copper",
      "oak_reinforced",
      "asphalt",
    ],
    interior: ["lockbox", "treasure_chest", "wall_lantern", "silver_frame"],
  },
  portal_transit_company: {
    blocks: [
      "quartzite_polished",
      "moonstone",
      "sunstone",
      "led",
      "basalt_polished",
    ],
    interior: ["led_panel", "runic_stone_light", "lockbox", "mailbox"],
  },
  biome_farming_rare_foods: {
    blocks: [
      "thatch",
      "clay_brick",
      "cotton_fabric",
      "oak_lumber",
      "mushroom_leather",
    ],
    interior: ["oak_tray", "wooden_chair", "small_oak_sign", "wood_container"],
  },
  weapons_tools: {
    blocks: ["copper", "silver", "stone_brick", "oak_reinforced", "asphalt"],
    interior: ["shelf", "display_shelf", "wall_lantern", "wood_container"],
  },
  magic_goods: {
    blocks: ["emberstone", "sunstone", "moonstone", "ice", "led"],
    interior: ["runic_stone_light", "led_panel", "silver_frame", "gold_frame"],
  },
  exploration_guide: {
    blocks: [
      "cobblestone_brick",
      "limestone_brick",
      "oak_lumber",
      "simple_glass",
      "stone_shingles",
    ],
    interior: ["large_oak_frame", "mailbox", "oak_tray", "small_oak_sign"],
  },
  custom_home_property_development: {
    blocks: [
      "stone_brick",
      "granite_brick",
      "oak_lumber",
      "clay_brick",
      "stone_shingles",
    ],
    interior: ["wardrobe_storage", "shelf", "small_bed", "display_shelf"],
  },
  general_trader: {
    blocks: [
      "cobblestone_brick",
      "oak_lumber",
      "clay_brick",
      "simple_glass",
      "stone_polished",
    ],
    interior: ["cargo_crate", "wood_container", "shelf", "mailbox"],
  },
  hunter_wild_meat: {
    blocks: [
      "thatch",
      "oak_lumber",
      "cobblestone_brick",
      "mushroom_leather",
      "stone_shingles",
    ],
    interior: [
      "fish_wall_mount",
      "wood_container",
      "wooden_chair",
      "small_oak_sign",
    ],
  },
  medical_doctor: {
    blocks: [
      "simple_glass",
      "limestone_polished",
      "clay_polished",
      "cotton_fabric",
      "stone_polished",
    ],
    interior: ["small_bed", "shelf", "wall_lantern", "padded_chair"],
  },
  teleport_owner: {
    blocks: [
      "moonstone",
      "quartzite_polished",
      "led",
      "basalt_carved",
      "sunstone",
    ],
    interior: ["runic_stone_light", "led_panel", "lockbox", "silver_frame"],
  },
  waste_sanitation_cleanup: {
    blocks: [
      "asphalt",
      "cobblestone_brick",
      "clay_brick",
      "basalt_brick",
      "copper",
    ],
    interior: ["wood_container", "cargo_crate", "wall_lantern", "mailbox"],
  },
  repair_maintenance_person: {
    blocks: [
      "oak_reinforced",
      "birch_reinforced",
      "stone_brick",
      "cobblestone_brick",
      "asphalt",
    ],
    interior: ["shelf", "wood_container", "oak_tray", "wall_lantern"],
  },
  food_service_restaurant: {
    blocks: [
      "clay_brick",
      "thatch",
      "cotton_fabric",
      "oak_lumber",
      "simple_glass",
    ],
    interior: ["table", "padded_chair", "display_shelf", "wall_lantern"],
  },
  courier: {
    blocks: [
      "cobblestone_brick",
      "oak_lumber",
      "asphalt",
      "stone_shingles",
      "clay_brick",
    ],
    interior: ["cargo_crate", "mailbox", "wood_container", "small_oak_sign"],
  },
  hospitality_inn_hotel_shelter: {
    blocks: [
      "oak_lumber",
      "clay_brick",
      "cotton_fabric",
      "stone_polished",
      "sakura_lumber",
    ],
    interior: ["small_bed", "fancy_bed", "padded_chair", "table"],
  },
};

export interface HarthmereBusinessStorefrontListingV1 {
  businessType: HarthmereEconomyBusinessTypeIdV1;
  itemId: string;
  kind: "block" | "interior" | "recipe_book";
  buyPrice: number;
  recipeIds?: readonly string[];
}

/** Sale markup over the item's base value (buying from a shop is a bit pricier
 *  than crafting it yourself from materials). */
const STOREFRONT_MARKUP_V1 = 1.15;

function storefrontBuyPriceV1(itemId: string): number {
  const base = Number(getHarthmereItemDefinitionV1(itemId)?.baseValue ?? 0);
  return Math.max(1, Math.round((base || 1) * STOREFRONT_MARKUP_V1));
}

export function harthmereBusinessStorefrontGoodsForTypeV1(
  businessType: string | undefined
): HarthmereBusinessStorefrontGoodsV1 | undefined {
  if (!businessType) return undefined;
  return HARTHMERE_BUSINESS_STOREFRONT_GOODS_V1[
    businessType as HarthmereEconomyBusinessTypeIdV1
  ];
}

/** Priced listings for one business (for the shopfront UI + server pricing).
 *  Ensures the block/decor catalogues so prices resolve identically on client
 *  and server (the buyer is never charged a different price than displayed). */
export function harthmereBusinessStorefrontListingsForTypeV1(
  businessType: string | undefined
): HarthmereBusinessStorefrontListingV1[] {
  const goods = harthmereBusinessStorefrontGoodsForTypeV1(businessType);
  if (!goods) return [];
  ensureHarthmereSpecializedBlocksCatalogueV1();
  ensureHarthmerePlaceableDecorCatalogueV1();
  ensureHarthmereRecipeBookItemsV1();
  const type = businessType as HarthmereEconomyBusinessTypeIdV1;
  const recipeBook = harthmereRecipeBookForBusinessTypeV1(type);
  return [
    ...goods.blocks.map(
      (itemId): HarthmereBusinessStorefrontListingV1 => ({
        businessType: type,
        itemId,
        kind: "block",
        buyPrice: storefrontBuyPriceV1(itemId),
      })
    ),
    ...goods.interior.map(
      (itemId): HarthmereBusinessStorefrontListingV1 => ({
        businessType: type,
        itemId,
        kind: "interior",
        buyPrice: storefrontBuyPriceV1(itemId),
      })
    ),
    ...(recipeBook
      ? [
          {
            businessType: type,
            itemId: recipeBook.itemId,
            kind: "recipe_book" as const,
            buyPrice: storefrontBuyPriceV1(recipeBook.itemId),
            recipeIds: recipeBook.recipeIds,
          },
        ]
      : []),
  ];
}

export function harthmereBusinessStorefrontRecipeBookForItemV1(
  itemId: string | undefined
): HarthmereRecipeBookDefinitionV1 | undefined {
  return harthmereRecipeBookForItemV1(itemId);
}

export function harthmereBusinessStorefrontLearnableRecipeIdsV1(
  itemId: string | undefined,
  knownRecipes: readonly string[] = []
): string[] {
  return harthmereRecipeBookLearnableRecipeIdsV1(itemId, knownRecipes);
}

let registered = false;

/** Registers block/decor storefront goods as UNLIMITED (stock -1) vendor entries
 *  keyed by the business TYPE id. Recipe books intentionally skip vendor-entry
 *  registration: they must pass through buy_storefront_good so knownRecipes can
 *  enforce one purchase per player. Idempotent + guarded against circular import. */
export function ensureHarthmereBusinessStorefrontGoodsV1(): void {
  if (registered) return;
  ensureHarthmereSpecializedBlocksCatalogueV1();
  ensureHarthmerePlaceableDecorCatalogueV1();
  ensureHarthmereRecipeBookItemsV1();
  registered = true;

  for (const businessType of Object.keys(
    HARTHMERE_BUSINESS_STOREFRONT_GOODS_V1
  ) as HarthmereEconomyBusinessTypeIdV1[]) {
    for (const listing of harthmereBusinessStorefrontListingsForTypeV1(
      businessType
    )) {
      if (getHarthmereVendorEntryV1(businessType, listing.itemId)) {
        continue;
      }
      if (listing.kind === "recipe_book") {
        continue;
      }
      registerHarthmereVendorEntryV1({
        vendorId: businessType,
        itemId: listing.itemId,
        buyPrice: listing.buyPrice,
        sellPrice: Math.max(1, Math.floor(listing.buyPrice * 0.45)),
        stock: -1, // unlimited / self-replenishing
      });
    }
  }
}

/** Validates the storefront catalog: one entry per real outpost business, 5
 *  blocks + 4 interior each, and every id is a real block / decor item. */
export function validateHarthmereBusinessStorefrontGoodsV1(): string[] {
  const errors: string[] = [];
  ensureHarthmereSpecializedBlocksCatalogueV1();
  ensureHarthmerePlaceableDecorCatalogueV1();
  ensureHarthmereRecipeBookItemsV1();
  const blockIds = new Set(harthmereSpecializedBlockItemIdsV1());
  const decorIds = new Set(harthmerePlaceableDecorItemIdsV1());

  const outpostTypes = new Set(
    HARTHMERE_BUSINESS_OUTPOSTS_V1.map((o) => o.businessType)
  );
  for (const type of outpostTypes) {
    if (!HARTHMERE_BUSINESS_STOREFRONT_GOODS_V1[type]) {
      errors.push(`${type}:missing_storefront`);
    }
  }
  for (const [type, goods] of Object.entries(
    HARTHMERE_BUSINESS_STOREFRONT_GOODS_V1
  )) {
    if (goods.blocks.length !== 5) {
      errors.push(`${type}:expected_5_blocks_got_${goods.blocks.length}`);
    }
    if (goods.interior.length !== 4) {
      errors.push(`${type}:expected_4_interior_got_${goods.interior.length}`);
    }
    if (!harthmereRecipeBookForBusinessTypeV1(type)) {
      errors.push(`${type}:missing_recipe_book`);
    }
    for (const id of goods.blocks) {
      if (!blockIds.has(id)) errors.push(`${type}:not_a_block:${id}`);
    }
    for (const id of goods.interior) {
      if (!decorIds.has(id)) errors.push(`${type}:not_a_decor_item:${id}`);
    }
  }
  return errors;
}

export function harthmereBusinessStorefrontTypesV1(): HarthmereEconomyBusinessTypeIdV1[] {
  return Object.keys(
    HARTHMERE_BUSINESS_STOREFRONT_GOODS_V1
  ) as HarthmereEconomyBusinessTypeIdV1[];
}
