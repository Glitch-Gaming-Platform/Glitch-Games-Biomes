import {
  getHarthmereCraftingRecipeV1,
  getHarthmereItemDefinitionV1,
  registerHarthmereItemDefinitionV1,
  type HarthmereItemDefinitionV1,
} from "@/shared/harthmere/mmo_inventory_authority_v1";
import type { HarthmereEconomyBusinessTypeIdV1 } from "@/shared/harthmere/mmo_economy_authority_v1";

export const HARTHMERE_RECIPE_BOOKS_VERSION_V1 =
  "harthmere-recipe-books-v1" as const;

export interface HarthmereRecipeBookDefinitionV1 {
  itemId: string;
  displayName: string;
  description: string;
  businessType: HarthmereEconomyBusinessTypeIdV1;
  baseValue: number;
  recipeIds: readonly string[];
}

const masonryRecipesV1 = [
  "cobblestone",
  "stone",
  "granite",
  "limestone",
  "quartzite",
  "basalt",
].flatMap((material) =>
  ["brick", "polished", "carved", "shingles"].map(
    (finish) => `harthmere_block_${material}_${finish}`
  )
);

export const HARTHMERE_RECIPE_BOOKS_V1 = [
  {
    itemId: "recipe_book_exotic_matter_treatise_i",
    displayName: "Exotic Matter Treatise I",
    description: "Containment notes for the first exotic matter blocks.",
    businessType: "exotic_matter_refinery",
    baseValue: 950,
    recipeIds: [
      "harthmere_exotic_antihydrogen_block",
      "harthmere_exotic_antihelium_block",
      "harthmere_exotic_antiboron_block",
      "harthmere_exotic_raw_matter_block",
    ],
  },
  {
    itemId: "recipe_book_advanced_station_schematics",
    displayName: "Advanced Station Schematics",
    description: "Late-shop diagrams for unusual crafting machines.",
    businessType: "biome_maintenance_repair",
    baseValue: 420,
    recipeIds: [
      "harthmere_station_thermoblaster",
      "harthmere_station_dye_o_matic",
    ],
  },
  {
    itemId: "recipe_book_home_decor_catalogue",
    displayName: "Home Decor Catalogue",
    description:
      "A studio catalogue of furniture, fixtures, and display pieces.",
    businessType: "biome_design_studio",
    baseValue: 360,
    recipeIds: [
      "harthmere_decor_place_bench",
      "harthmere_decor_place_table",
      "harthmere_decor_place_t_table",
      "harthmere_decor_place_wooden_chair",
      "harthmere_decor_place_padded_chair",
      "harthmere_decor_place_small_bed",
      "harthmere_decor_place_fancy_bed",
      "harthmere_decor_place_shelf",
      "harthmere_decor_place_display_shelf",
      "harthmere_decor_place_wood_container",
      "harthmere_decor_place_treasure_chest",
      "harthmere_decor_place_cargo_crate",
      "harthmere_decor_place_lockbox",
      "harthmere_decor_place_wardrobe_storage",
      "harthmere_decor_place_wall_lantern",
      "harthmere_decor_place_led_panel",
      "harthmere_decor_place_small_oak_frame",
      "harthmere_decor_place_medium_oak_frame",
      "harthmere_decor_place_large_oak_frame",
      "harthmere_decor_place_silver_frame",
      "harthmere_decor_place_gold_frame",
      "harthmere_decor_place_small_oak_sign",
      "harthmere_decor_place_record_player",
      "harthmere_decor_place_boombox",
      "harthmere_decor_place_4537020877769721",
      "harthmere_decor_place_mailbox",
      "harthmere_decor_place_oak_tray",
    ],
  },
  {
    itemId: "recipe_book_metal_block_foundry_guide",
    displayName: "Metal Block Foundry Guide",
    description: "Foundry formulas for metal, tech, and road-surface blocks.",
    businessType: "security_defense_contractor",
    baseValue: 290,
    recipeIds: [
      "harthmere_block_copper",
      "harthmere_block_silver",
      "harthmere_block_gold",
      "harthmere_block_diamond",
      "harthmere_block_neptunium",
      "harthmere_block_asphalt",
      "harthmere_block_led",
    ],
  },
  {
    itemId: "recipe_book_exotic_matter_treatise_ii",
    displayName: "Exotic Matter Treatise II",
    description: "Stabilization notes for exotic matter fuel work.",
    businessType: "portal_transit_company",
    baseValue: 1100,
    recipeIds: [
      "harthmere_exotic_stabilized_matter_block",
      "harthmere_exotic_power_cell",
      "harthmere_exotic_portal_fuel_cell",
      "harthmere_exotic_certified_portal_fuel",
    ],
  },
  {
    itemId: "recipe_book_weavers_material_sampler",
    displayName: "Weaver's Material Sampler",
    description: "Samples and patterns for flexible building materials.",
    businessType: "biome_farming_rare_foods",
    baseValue: 130,
    recipeIds: [
      "harthmere_block_thatch",
      "harthmere_block_cotton_fabric",
      "harthmere_block_mushroom_leather",
    ],
  },
  {
    itemId: "recipe_book_smiths_primer",
    displayName: "Smith's Primer",
    description: "A practical starter text for ingots and iron blades.",
    businessType: "weapons_tools",
    baseValue: 240,
    recipeIds: [
      "harthmere_blacksmith_iron_ingot",
      "harthmere_blacksmith_iron_sword",
      "harthmere_blacksmith_upgrade_iron_sword",
    ],
  },
  {
    itemId: "recipe_book_field_alchemists_notebook",
    displayName: "Field Alchemist's Notebook",
    description: "Potion, warding, and elemental block preparations.",
    businessType: "magic_goods",
    baseValue: 310,
    recipeIds: [
      "harthmere_alchemy_health_potion",
      "harthmere_alchemy_antidote",
      "harthmere_enchant_warded_iron_sword",
      "harthmere_block_ice",
      "harthmere_block_emberstone",
      "harthmere_block_sunstone",
      "harthmere_block_moonstone",
      "harthmere_decor_place_runic_stone_light",
    ],
  },
  {
    itemId: "recipe_book_hunters_bow_pattern",
    displayName: "Hunter's Bow Pattern",
    description: "A compact field pattern for making a hunter's bow.",
    businessType: "exploration_guide",
    baseValue: 160,
    recipeIds: ["harthmere_carpentry_hunter_bow"],
  },
  {
    itemId: "recipe_book_apprentice_workshop_manual",
    displayName: "Apprentice Workshop Manual",
    description: "Foundational station and shop-counter construction notes.",
    businessType: "custom_home_property_development",
    baseValue: 330,
    recipeIds: [
      "harthmere_station_stonecutter",
      "harthmere_station_kiln",
      "harthmere_station_forge",
      "harthmere_station_loom",
      "harthmere_station_alchemyBench",
      "harthmere_decor_business_service_counter",
    ],
  },
  {
    itemId: "recipe_book_refiners_ledger",
    displayName: "Refiner's Ledger",
    description: "A trader's ledger for raw-material refinement.",
    businessType: "general_trader",
    baseValue: 260,
    recipeIds: [
      "harthmere_refine_copper_ingot",
      "harthmere_refine_silver_ingot",
      "harthmere_refine_gold_ingot",
      "harthmere_refine_diamond_shard",
      "harthmere_refine_neptunium_shard",
      "harthmere_refine_tree_resin",
    ],
  },
  {
    itemId: "recipe_book_anglers_tackle_notes",
    displayName: "Angler's Tackle Notes",
    description: "Fishing-lure notes and a wall-mount pattern.",
    businessType: "hunter_wild_meat",
    baseValue: 120,
    recipeIds: [
      "harthmere_angler_fishing_lure",
      "harthmere_decor_place_fish_wall_mount",
    ],
  },
  {
    itemId: "recipe_book_tailor_leatherworker_folio",
    displayName: "Tailor and Leatherworker's Folio",
    description: "Wearable cloth and leather patterns for travel and armor.",
    businessType: "medical_doctor",
    baseValue: 220,
    recipeIds: [
      "harthmere_leatherworking_armor",
      "harthmere_tailoring_linen_cloth",
      "harthmere_tailoring_travel_cloak",
    ],
  },
  {
    itemId: "recipe_book_exotic_matter_treatise_iii",
    displayName: "Exotic Matter Treatise III",
    description: "Portal engineering and deep-exotic utility cores.",
    businessType: "teleport_owner",
    baseValue: 1400,
    recipeIds: [
      "harthmere_exotic_teleport_fuel",
      "harthmere_exotic_anchor_core",
      "harthmere_exotic_utility_core",
      "harthmere_exotic_alcubierre_drive_core",
    ],
  },
  {
    itemId: "recipe_book_ceramic_glass_kiln_guide",
    displayName: "Ceramic and Glass Kiln Guide",
    description: "Kiln firing recipes for claywork and glass.",
    businessType: "waste_sanitation_cleanup",
    baseValue: 180,
    recipeIds: [
      "harthmere_block_clay_brick",
      "harthmere_block_clay_polished",
      "harthmere_block_clay_carved",
      "harthmere_block_clay_shingles",
      "harthmere_block_simple_glass",
    ],
  },
  {
    itemId: "recipe_book_carpenters_block_book",
    displayName: "Carpenter's Block Book",
    description: "Lumber, stripped-log, and reinforced-wood block patterns.",
    businessType: "repair_maintenance_person",
    baseValue: 210,
    recipeIds: [
      "harthmere_block_oak_lumber",
      "harthmere_block_birch_lumber",
      "harthmere_block_rubber_lumber",
      "harthmere_block_sakura_lumber",
      "harthmere_block_oak_stripped",
      "harthmere_block_birch_stripped",
      "harthmere_block_rubber_stripped",
      "harthmere_block_oak_reinforced",
      "harthmere_block_birch_reinforced",
      "harthmere_block_rubber_reinforced",
    ],
  },
  {
    itemId: "recipe_book_millers_kitchen_slip",
    displayName: "Miller's Kitchen Slip",
    description: "A short kitchen note for milling grain into flour.",
    businessType: "food_service_restaurant",
    baseValue: 90,
    recipeIds: ["harthmere_seed_mill_grain_flour"],
  },
  {
    itemId: "recipe_book_masons_pattern_book",
    displayName: "Mason's Pattern Book",
    description:
      "Stonecutting patterns for brick, polished, carved, and shingle blocks.",
    businessType: "courier",
    baseValue: 340,
    recipeIds: masonryRecipesV1,
  },
  {
    itemId: "recipe_book_bellfounders_lost_pages",
    displayName: "Bellfounder's Lost Pages",
    description: "Recovered pages for bell-bronze and Bellbinder craft.",
    businessType: "hospitality_inn_hotel_shelter",
    baseValue: 520,
    recipeIds: ["harthmere_bell_bronze_ingot", "harthmere_bellbinders_voice"],
  },
] as const satisfies readonly HarthmereRecipeBookDefinitionV1[];

export type HarthmereRecipeBookIdV1 =
  (typeof HARTHMERE_RECIPE_BOOKS_V1)[number]["itemId"];

const recipeBookByItemIdV1 = new Map(
  HARTHMERE_RECIPE_BOOKS_V1.map((book) => [book.itemId, book])
);

export function harthmereRecipeBookForItemV1(
  itemId: string | undefined
): HarthmereRecipeBookDefinitionV1 | undefined {
  if (!itemId) return undefined;
  return recipeBookByItemIdV1.get(itemId);
}

export function harthmereRecipeBookForBusinessTypeV1(
  businessType: string | undefined
): HarthmereRecipeBookDefinitionV1 | undefined {
  if (!businessType) return undefined;
  return HARTHMERE_RECIPE_BOOKS_V1.find(
    (book) => book.businessType === businessType
  );
}

export function harthmereRecipeBookItemIdsV1(): string[] {
  return HARTHMERE_RECIPE_BOOKS_V1.map((book) => book.itemId);
}

export function harthmereRecipeBookLearnableRecipeIdsV1(
  itemId: string | undefined,
  knownRecipes: readonly string[] = []
): string[] {
  const book = harthmereRecipeBookForItemV1(itemId);
  if (!book) return [];
  const known = new Set(knownRecipes);
  return book.recipeIds.filter((recipeId) => !known.has(recipeId));
}

function recipeBookItemDefinitionV1(
  book: HarthmereRecipeBookDefinitionV1
): HarthmereItemDefinitionV1 {
  return {
    itemId: book.itemId,
    displayName: book.displayName,
    description: book.description,
    maxStackSize: 1,
    baseValue: book.baseValue,
    binding: "none",
    isQuestItem: false,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: false,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: {},
    tradeable: false,
    category: "recipe_book",
    objectMetadata: {
      objectKind: "recipe_book",
      physicalForm: "document",
      visualDescription: book.displayName,
      colors: ["paper", "ink", "gold"],
      craftingRoles: ["recipe_unlock"],
      businessUse: [book.businessType],
      bikkieGraphicHints: ["items/recipe_paper"],
    },
  };
}

let registered = false;

export function ensureHarthmereRecipeBookItemsV1(): void {
  if (registered) return;
  registered = true;
  for (const book of HARTHMERE_RECIPE_BOOKS_V1) {
    if (!getHarthmereItemDefinitionV1(book.itemId)) {
      registerHarthmereItemDefinitionV1(recipeBookItemDefinitionV1(book));
    }
  }
}

export function validateHarthmereRecipeBooksV1(): string[] {
  const errors: string[] = [];
  ensureHarthmereRecipeBookItemsV1();
  const seenBooks = new Set<string>();
  const seenBusinesses = new Set<string>();
  for (const book of HARTHMERE_RECIPE_BOOKS_V1) {
    if (seenBooks.has(book.itemId)) {
      errors.push(`duplicate_recipe_book:${book.itemId}`);
    }
    seenBooks.add(book.itemId);
    if (seenBusinesses.has(book.businessType)) {
      errors.push(`duplicate_business_recipe_book:${book.businessType}`);
    }
    seenBusinesses.add(book.businessType);
    if (book.recipeIds.length === 0) {
      errors.push(`${book.itemId}:empty_recipe_book`);
    }
    const seenRecipes = new Set<string>();
    for (const recipeId of book.recipeIds) {
      if (seenRecipes.has(recipeId)) {
        errors.push(`${book.itemId}:duplicate_recipe:${recipeId}`);
      }
      seenRecipes.add(recipeId);
      if (!getHarthmereCraftingRecipeV1(recipeId)) {
        errors.push(`${book.itemId}:unknown_recipe:${recipeId}`);
      }
    }
    if (!getHarthmereItemDefinitionV1(book.itemId)) {
      errors.push(`${book.itemId}:missing_item_definition`);
    }
  }
  return errors;
}
