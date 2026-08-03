import type { BakedBiscuitTray } from "@/server/shared/bikkie/registry";
import { BikkieIds } from "@/shared/bikkie/ids";
import { zBiscuit, type Biscuit } from "@/shared/bikkie/schema/attributes";
import {
  HARTHMERE_GATHERING_AUTHORITY_NODES,
  type HarthmereGatheringAuthorityNode,
} from "@/shared/harthmere/gathering_node_authority";
import { ensureHarthmereProductionVendorCatalog } from "@/shared/harthmere/harthmere_vendor_catalog";
import { registerCh1LiveItemDefinitions } from "@/shared/harthmere/ch1_live_items";
import { LIVE_ENTITY_HELPER_QUEST_ITEM_COPY } from "@/shared/harthmere/live_entity_helper_quests";
import {
  HARTHMERE_FOOD_DEFINITIONS,
  HARTHMERE_SEED_DEFINITIONS,
} from "@/shared/harthmere/mmo_farming_food_stamina";
import { HARTHMERE_MEDICAL_ITEM_DEFINITIONS } from "@/shared/harthmere/mmo_medical_health";
import { HARTHMERE_JOBS_BOARD_EXECUTABLE_ITEM_IDS } from "@/shared/harthmere/jobs_board_business_templates";
import {
  HARTHMERE_SIMPLE_FISHING_ROD_ITEM_ID,
  SNAPSHOT_FISHING_RODS,
} from "@/shared/harthmere/fishing_rods";
import { ensureHarthmereProductionCraftingCatalogue } from "@/shared/harthmere/mmo_crafting_catalogue";
import {
  getHarthmereItemDefinition,
  harthmereAllowedEquipmentSlots,
  listHarthmereCraftingRecipes,
  listHarthmereItemDefinitions,
  registerHarthmereItemDefinition,
  type HarthmereEquipmentSlot,
  type HarthmereItemDefinition,
} from "@/shared/harthmere/mmo_inventory_authority";
import type { BiomesId } from "@/shared/ids";
import { safeParseBiomesId } from "@/shared/ids";
import {
  HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION,
  harthmereNativeBiomesIdForItemId,
  harthmereNativeBiomesIdForRecipeId,
} from "@/shared/harthmere/harthmere_native_item_ids";
import { NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID } from "@/shared/harthmere/native_road_ahead_contract";
import {
  harthmereNativeItemCombatProfile,
  harthmereNativeItemLifetimeDurabilityMs,
  harthmereNativeNpcBiscuit,
} from "@/shared/harthmere/harthmere_native_combat";
import { allHarthmereNativeNpcCombatProfiles } from "@/shared/harthmere/harthmere_native_combat_catalog";
import { harthmereNativeConsumableProfile } from "@/shared/harthmere/harthmere_native_vitals";
import {
  allHarthmereNativeQuestBiscuits,
  HARTHMERE_NATIVE_QUEST_OVERLAY_VERSION,
} from "@/shared/harthmere/harthmere_native_quests";
import { BIBLE_QUEST_CATALOG } from "@/shared/harthmere/bible/bible_quest_catalog";
import {
  harthmereBibleObjectiveItemDefinition,
  harthmereBibleRewardItemDefinition,
} from "@/shared/harthmere/bible_quest_live_authority";
import { SNAPSHOT_STRUCTURED_REWARDS } from "@/shared/harthmere/snapshot_complete_port";
import {
  HARTHMERE_PREMIUM_WEAPONS,
  getHarthmerePremiumWeapon,
  type HarthmerePremiumWeaponDefinition,
} from "@/shared/harthmere/premium_weapon_catalog";
import { harthmereGeneratedInventoryIconUrl } from "@/shared/harthmere/generated/harthmere_inventory_icon_manifest";
import { harthmereBusinessFurnitureAsset } from "@/shared/harthmere/generated/harthmere_business_furniture_manifest";

/**
 * Existing snapshot biscuits may donate presentation data to an exact
 * Harthmere biscuit, but never donate identity.  Copying only mesh/icon/vox
 * attributes keeps `iron_ore` distinct from `goldOre` for inventory, recipes,
 * collect triggers, and quests while still letting exact tools and clothing
 * render with the best authored asset currently available.
 */
function premiumWeaponPresentationSource(
  weapon: HarthmerePremiumWeaponDefinition
) {
  if (weapon.profile === "shield") return BikkieIds.woodenFencer;
  if (weapon.family === "axe") return BikkieIds.axe;
  if (weapon.family === "crossbow" || weapon.family === "bow") {
    return BikkieIds.muckBuster;
  }
  if (weapon.family === "hammer") return BikkieIds.axe;
  if (weapon.family === "dagger" || weapon.family.includes("sword")) {
    return BikkieIds.muckBuster;
  }
  return BikkieIds.muckBuster;
}

const HARTHMERE_PREMIUM_WEAPON_PRESENTATION_SOURCE_IDS = Object.fromEntries(
  HARTHMERE_PREMIUM_WEAPONS.map((weapon) => [
    weapon.id,
    premiumWeaponPresentationSource(weapon),
  ])
) as Readonly<Record<string, BiomesId>>;

const HARTHMERE_NATIVE_PRESENTATION_SOURCE_IDS: Readonly<
  Record<string, BiomesId>
> = {
  ...HARTHMERE_PREMIUM_WEAPON_PRESENTATION_SOURCE_IDS,
  baker_apron: BikkieIds.grassyTop,
  field_trousers: BikkieIds.bellBottoms,
  patched_cloak: BikkieIds.poncho,
  travel_cloak: BikkieIds.poncho,
  leather_armor: BikkieIds.grassyTop,
  woodsman_axe: BikkieIds.axe,
  woodcutters_axe: BikkieIds.axe,
  rusty_pickaxe: BikkieIds.pickaxe,
  muck_rake: BikkieIds.muckBuster,
  repair_mallet: BikkieIds.axe,
  herbalist_sickle: BikkieIds.axe,
  simple_fishing_rod: SNAPSHOT_FISHING_RODS[1].id,
  skinning_knife: BikkieIds.axe,
  scavenger_hook: BikkieIds.muckBuster,
  clay_shovel: BikkieIds.pickaxe,
  arcane_extractor: BikkieIds.muckBuster,
  training_dagger: BikkieIds.muckBuster,
  iron_longsword: BikkieIds.muckBuster,
  two_handed_sword: BikkieIds.muckBuster,
  wooden_shield: BikkieIds.woodenFencer,
  rough_stone: BikkieIds.cobblestone,
  river_clay: BikkieIds.clay,
  softwood_log: BikkieIds.log,
  oak_branch: BikkieIds.oakLog,
  tree_resin: BikkieIds.oakLeaf,
  cloth_scrap: BikkieIds.tatteredTop,
  clean_water: BikkieIds.bucket,
  old_coin: BikkieIds.goldNugget,
  iron_ore: BikkieIds.goldOre,
  scrap_metal: BikkieIds.silverNugget,
  mana_essence: BikkieIds.powerCell,
  wild_berries: BikkieIds.fruit,
  raw_meat: BikkieIds.muckerMeat,
  grove_festival_skewer: BikkieIds.muckerMeat,
  grove_festival_skewer_ingredients: BikkieIds.muckerMeat,
  grove_road_torch: BikkieIds.log,
  billys_lunch_pail: BikkieIds.bucket,
  jackies_sealed_letter: BikkieIds.parcel,
  bolt_order: BikkieIds.recipePaper,
  sils_tuning_strip: BikkieIds.recordPlayer,
  containment_tongs: BikkieIds.axe,
  anchor_wrench: BikkieIds.axe,
  drafting_compass: BikkieIds.camera,
  ward_hammer: BikkieIds.axe,
  portal_calibrator: BikkieIds.muckBuster,
  field_surgeon_kit: BikkieIds.camera,
  beacon_attuner: BikkieIds.muckBuster,
  carving_cleaver: BikkieIds.axe,
  hearth_broom: BikkieIds.muckBuster,
};

const HARTHMERE_NATIVE_PRESENTATION_ATTRIBUTES = [
  "attachmentTransform",
  "galoisPath",
  "icon",
  "iconSettings",
  "mesh",
  "meshGaloisPath",
  "paletteColor",
  "vox",
  "voxWithHatVariant",
  "worldMesh",
] as const satisfies readonly (keyof Biscuit)[];

const ROAD_AHEAD_MUCKWAD_ITEM_ALIASES = new Set([
  "muckwad",
  "muckwad_voxel_block",
]);

const HARTHMERE_NATIVE_RECIPE_OVERLAY_VERSION =
  "harthmere-native-recipes-v1" as const;

function assertFrontendBikkieDecodable(
  contents: ReadonlyMap<BiomesId, Biscuit>
) {
  for (const [id, biscuit] of contents) {
    const parsed = zBiscuit.safeParse(biscuit);
    if (!parsed.success) {
      throw new Error(
        `Bikkie ${
          biscuit.name ?? id
        } (${id}) cannot be decoded by the frontend: ${parsed.error.message}`
      );
    }
  }
}

export function harthmereNativeRecipeBiscuit(
  recipe: ReturnType<typeof listHarthmereCraftingRecipes>[number]
): Biscuit | undefined {
  // Repair, salvage, upgrade, enchant, and quest-forge workflows have target
  // item/quality semantics that the stock InventoryCraftEvent does not model.
  // Their queue metadata may remain custom, while their physical debits and
  // outputs still use the signed ECS inventory transaction.
  if (recipe.workflowKind && recipe.workflowKind !== "craft") return undefined;
  const id = harthmereNativeBiomesIdForRecipeId(recipe.recipeId);
  const outputId = harthmereNativeBiomesIdForItemId(recipe.outputItemId);
  const input = [...recipe.inputs, ...(recipe.fuelInputs ?? [])].map(
    ({ itemId, count }) =>
      [
        harthmereNativeBiomesIdForItemId(itemId),
        Math.max(1, Math.trunc(count)),
      ] as const
  );
  if (!id || !outputId || input.some(([itemId]) => !itemId)) return undefined;
  const outputDefinition = getHarthmereItemDefinition(recipe.outputItemId);
  const stationId = safeParseBiomesId(recipe.requiredStationId);
  return {
    id,
    name: `harthmere_recipe_${recipe.recipeId.replace(/[^a-z0-9]+/gi, "_")}`,
    displayName: `${
      outputDefinition?.displayName ?? recipe.outputItemId
    } Recipe`,
    displayDescription: `Crafts ${Math.max(
      1,
      Math.trunc(recipe.outputCount)
    )} ${outputDefinition?.displayName ?? recipe.outputItemId}.`,
    craftingCategory: outputDefinition?.category ?? "Harthmere",
    tooltipTypeName: "Recipe",
    isRecipe: true,
    input: input.map(([itemId, count]) => [itemId!, count]),
    output: [[outputId, Math.max(1, Math.trunc(recipe.outputCount))]],
    craftWith: stationId ? [stationId] : [],
    craftingDurationMs: Math.max(0, Math.trunc(recipe.craftingTimeMs)),
  } as Biscuit;
}

function isRoadAheadMuckwadIdentity(itemId: string) {
  return (
    ROAD_AHEAD_MUCKWAD_ITEM_ALIASES.has(itemId.toLowerCase()) ||
    safeParseBiomesId(itemId) === NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID
  );
}

export {
  HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION,
  harthmereNativeBiomesIdForItemId,
} from "@/shared/harthmere/harthmere_native_item_ids";

function humanizeHarthmereItemId(itemId: string) {
  return itemId
    .replace(/^b:/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function harthmereBiscuitNameForItemId(itemId: string) {
  return `harthmere_${itemId.replace(/[^a-zA-Z0-9]+/g, "_")}`;
}

function defaultHarthmereItemDefinition(input: {
  itemId: string;
  displayName?: string;
  category?: string;
  maxStackSize?: number;
  isConsumable?: boolean;
  isCraftingMaterial?: boolean;
  isQuestItem?: boolean;
  tradeable?: boolean;
  equipmentSlots?: HarthmereEquipmentSlot[];
}): HarthmereItemDefinition {
  return {
    itemId: input.itemId,
    displayName:
      input.displayName?.trim() || humanizeHarthmereItemId(input.itemId),
    maxStackSize: Math.max(1, Math.trunc(input.maxStackSize ?? 999)),
    baseValue: 0,
    binding: input.isQuestItem ? "quest" : "none",
    isQuestItem: input.isQuestItem ?? false,
    isCurrency: false,
    isConsumable: input.isConsumable ?? false,
    isCraftingMaterial: input.isCraftingMaterial ?? true,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: {},
    equipmentSlots: input.equipmentSlots,
    tradeable: input.tradeable ?? !input.isQuestItem,
    category: input.category ?? "materials",
  };
}

function ensureDefinition(definition: HarthmereItemDefinition) {
  if (!getHarthmereItemDefinition(definition.itemId)) {
    registerHarthmereItemDefinition(definition);
  }
}

function ensureConsumableDefinition(
  definition: HarthmereItemDefinition,
  isConsumable: boolean
) {
  const existing = getHarthmereItemDefinition(definition.itemId);
  if (existing) {
    // Exact snapshot items can be both placeable/crafting materials and edible
    // (for example Red Mushroom). Preserve their category/action metadata while
    // adding only the server consumption capability derived from the food or
    // medical catalogue.
    registerHarthmereItemDefinition({ ...existing, isConsumable });
  } else {
    registerHarthmereItemDefinition({ ...definition, isConsumable });
  }
}

function registerGatheringDefinitions(
  nodes: readonly HarthmereGatheringAuthorityNode[]
) {
  for (const node of nodes) {
    if (node.requiredTool) {
      ensureDefinition(
        defaultHarthmereItemDefinition({
          itemId: node.requiredTool,
          category: "tool",
          maxStackSize: 1,
          isCraftingMaterial: false,
          equipmentSlots: ["main_hand"],
        })
      );
    }
    for (const yieldRow of [...node.baseYield, ...node.rareYield]) {
      ensureDefinition(
        defaultHarthmereItemDefinition({ itemId: yieldRow.itemId })
      );
    }
  }
}

/**
 * Populate the canonical item registry before deriving native Bikkie biscuits.
 * This is data authoring, not a visual alias table: every string item id gets
 * its own BiomesId and therefore its own recipe/quest/collect identity.
 */
export function ensureHarthmereNativeItemCatalogue() {
  // Chapter 1 rewards and turn-ins cross the same native inventory boundary as
  // every other Harthmere item. Register them explicitly here so browser and
  // server Bikkie overlays do not depend on live-mode module import order.
  registerCh1LiveItemDefinitions();
  // Crafting owns many combat weapons/armor that are not vendor starters.
  // Register it explicitly so Bikkie overlay contents never depend on module
  // import order at process startup.
  ensureHarthmereProductionCraftingCatalogue();
  ensureHarthmereProductionVendorCatalog();
  ensureDefinition(
    defaultHarthmereItemDefinition({
      itemId: "muckwad",
      displayName: "Muckwad",
      category: "materials",
      maxStackSize: 999,
      isCraftingMaterial: true,
    })
  );
  // Jobs Board requirements are native inventory contracts. Register the
  // complete executable set here so a business template can never advertise a
  // string-only item that has no Bikkie identity or transferable ECS stack.
  for (const itemId of HARTHMERE_JOBS_BOARD_EXECUTABLE_ITEM_IDS) {
    ensureDefinition(
      defaultHarthmereItemDefinition({
        itemId,
        category: "job_material",
        maxStackSize: 999,
        isCraftingMaterial: true,
      })
    );
  }
  ensureDefinition(
    defaultHarthmereItemDefinition({
      itemId: "sealed_package",
      displayName: "Sealed Delivery Parcel",
      category: "quest_item",
      maxStackSize: 20,
      isCraftingMaterial: false,
      isQuestItem: true,
      tradeable: false,
    })
  );
  ensureDefinition(
    defaultHarthmereItemDefinition({
      itemId: "billys_lunch_pail",
      displayName: "Billy's Lunch Pail",
      category: "quest_item",
      maxStackSize: 1,
      isCraftingMaterial: false,
      isQuestItem: true,
      tradeable: false,
    })
  );
  for (const [itemId, displayName] of [
    ["jackies_sealed_letter", "Jackie's Sealed Letter"],
    ["bolt_order", "Luis's Bolt Order"],
    ["sils_tuning_strip", "Sil's Tuning Strip"],
  ] as const) {
    ensureDefinition(
      defaultHarthmereItemDefinition({
        itemId,
        displayName,
        category: "quest_item",
        maxStackSize: 1,
        isCraftingMaterial: false,
        isQuestItem: true,
        tradeable: false,
      })
    );
  }
  ensureDefinition(
    defaultHarthmereItemDefinition({
      // Bind the semantic inventory registry to the authored snapshot item;
      // the Bikkie overlay preserves its original mesh/icon/description.
      itemId: "b:7077725005403292",
      displayName: "Water-logged Muck Buster",
      category: "quest_item",
      maxStackSize: 1,
      isCraftingMaterial: false,
      isQuestItem: true,
      tradeable: false,
    })
  );

  for (const food of Object.values(HARTHMERE_FOOD_DEFINITIONS)) {
    ensureConsumableDefinition(
      defaultHarthmereItemDefinition({
        itemId: food.itemId,
        displayName: food.displayName,
        category: "food",
        maxStackSize: 200,
        isCraftingMaterial: false,
      }),
      food.edible !== false
    );
  }
  for (const medical of Object.values(HARTHMERE_MEDICAL_ITEM_DEFINITIONS)) {
    ensureConsumableDefinition(
      defaultHarthmereItemDefinition({
        itemId: medical.itemId,
        displayName: medical.displayName,
        category: "consumable",
        maxStackSize: 20,
        isCraftingMaterial: false,
      }),
      true
    );
  }
  for (const seed of Object.values(HARTHMERE_SEED_DEFINITIONS)) {
    ensureDefinition(
      defaultHarthmereItemDefinition({
        itemId: seed.seedItemId,
        displayName: seed.displayName,
        category: "seed",
        maxStackSize: 200,
      })
    );
    const yieldFood = HARTHMERE_FOOD_DEFINITIONS[seed.yieldItemId];
    ensureConsumableDefinition(
      defaultHarthmereItemDefinition({
        itemId: seed.yieldItemId,
        displayName: seed.cropDisplayName,
        category: "food",
        maxStackSize: 200,
        isCraftingMaterial: false,
      }),
      Boolean(yieldFood && yieldFood.edible !== false)
    );
  }
  for (const copy of Object.values(LIVE_ENTITY_HELPER_QUEST_ITEM_COPY)) {
    ensureDefinition({
      ...defaultHarthmereItemDefinition({
        itemId: copy.itemId,
        displayName: copy.displayName,
        maxStackSize: copy.maxStackSize,
        isConsumable: copy.isConsumable,
        isCraftingMaterial: copy.isCraftingMaterial,
        isQuestItem: copy.isQuestItem,
        tradeable: copy.tradeable,
      }),
      description: copy.description,
      baseValue: copy.baseValue,
      binding: copy.binding,
    });
  }
  // Quest rewards and objective proofs are physical items too. Register the
  // complete authored set before the Bikkie overlay so a reward can never
  // create a string-only Redis stack with no native inventory identity.
  for (const quest of BIBLE_QUEST_CATALOG) {
    for (const rewardItemId of quest.rewards.items) {
      ensureDefinition(harthmereBibleRewardItemDefinition(rewardItemId));
    }
    for (const step of quest.steps) {
      ensureDefinition(
        harthmereBibleObjectiveItemDefinition({
          itemId: `quest_objective_item:${quest.id}:${step.id}`,
          displayName: step.targetName || step.label || "Quest Item",
        })
      );
    }
  }
  for (const reward of SNAPSHOT_STRUCTURED_REWARDS) {
    for (const itemId of reward.items) {
      ensureDefinition(
        defaultHarthmereItemDefinition({
          itemId,
          category: "quest_item",
          maxStackSize: 99,
          isCraftingMaterial: false,
          isQuestItem: true,
          tradeable: false,
        })
      );
    }
  }
  registerGatheringDefinitions(HARTHMERE_GATHERING_AUTHORITY_NODES);

  return listHarthmereItemDefinitions();
}

function wearableAttributes(definition: HarthmereItemDefinition) {
  const slots = new Set(harthmereAllowedEquipmentSlots(definition));
  const attributes: Record<string, true> = {};
  if (slots.has("head")) attributes.wearAsHat = true;
  if (slots.has("chest")) attributes.wearAsTop = true;
  if (slots.has("legs")) attributes.wearAsBottoms = true;
  if (slots.has("feet")) attributes.wearOnFeet = true;
  // Native Biomes has one hand-wear assignment rather than a separate off-hand
  // equipment component. Defensive off-hand items use that canonical slot so
  // their armor stats and equip/unequip lifecycle remain ECS-owned.
  if (slots.has("hands") || slots.has("off_hand"))
    attributes.wearOnHands = true;
  if (slots.has("back")) attributes.wearAsOuterwear = true;
  if (slots.has("neck")) attributes.wearOnNeck = true;
  if (Object.keys(attributes).length > 0) attributes.isWearable = true;
  return attributes as Partial<Biscuit>;
}

const HARTHMERE_LOCAL_CROP_BLOCK_IDS: Readonly<Record<string, BiomesId>> = {
  wheat: 7_539_420_629_350_057 as BiomesId,
  carrot: 4_560_450_207_940_471 as BiomesId,
  muckroot: 6_127_458_937_593_352 as BiomesId,
};

function nativeFarmingToolAttributes(definition: HarthmereItemDefinition) {
  if (definition.itemId === "7539420629350046") {
    return { action: "till" as const, hardnessClass: 1 };
  }
  if (definition.itemId === "7539420629350045") {
    return { action: "waterPlant" as const, waterAmount: 5 };
  }
  return undefined;
}

function nativeFishingToolAttributes(definition: HarthmereItemDefinition) {
  if (definition.itemId !== HARTHMERE_SIMPLE_FISHING_ROD_ITEM_ID) {
    return undefined;
  }
  return {
    action: "fish" as const,
    hardnessClass: 2,
    acceptsBait: true as const,
    catchBarSize: 0.25,
    // Match the snapshot Training Rod's ten-minute lifetime. The local
    // catalogue's durabilityMax is expressed in uses, while native fishing
    // spends milliseconds; without this override the generated rod broke
    // after only a couple of ordinary catches.
    lifetimeDurabilityMs: 600_000,
  };
}

function nativeFishAttributes(definition: HarthmereItemDefinition) {
  if (definition.itemId !== "river_trout") {
    return undefined;
  }
  return {
    isFish: true as const,
    fishLengthDistribution: {
      mean: 0.45,
      min: 0.15,
    },
    // The additive river intentionally has a five-voxel normal-depth channel
    // and shallow shelving banks under open sky. Publishing both conditions
    // makes its authored trout reachable through the same native fishing table
    // used by every original-world ShardWater body.
    fishConditions: [
      {
        predicates: [
          { kind: "notMuck" as const },
          { kind: "isNormalDepthWater" as const },
          { kind: "inOpen" as const },
        ],
        probability: "common" as const,
      },
      {
        predicates: [
          { kind: "notMuck" as const },
          { kind: "isShallowWater" as const },
          { kind: "inOpen" as const },
        ],
        probability: "uncommon" as const,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// HARTHMERE_NATIVE_STORABLE_IDENTITY (2026-07-26)
//
// `maxInventoryStack(item)` is `item.stackable || 0n`. A biscuit published
// WITHOUT `stackable` therefore has a maximum stack of ZERO: the native
// inventory editor can never find a slot for it, so
// `giveWithInventoryOverflow` silently diverts the whole grant into the ECS
// overflow bag. The Harthmere live-mode reader only projects `inventory.items`
// and `inventory.hotbar`, so such an item disappears on the next Redis rebase
// while the transaction's gold debit stays committed.
//
// That is exactly what happened to the Hoe (7539420629350046): the snapshot
// biscuit it binds to only carried {name, isTool}, and the farming/consumable
// overlays below merged their handful of attributes on top of it, so the
// published biscuit never gained `stackable`. Buying a Hoe charged 22 gold and
// delivered nothing, every single time.
//
// Every overlay that patches an EXISTING snapshot biscuit now goes through
// this helper so a physical Harthmere item is always storable, droppable and
// nameable, no matter how sparse the record it inherits from.
// ---------------------------------------------------------------------------
export function harthmereStorableBiscuitIdentity(
  existing: Biscuit,
  definition: HarthmereItemDefinition
): Partial<Biscuit> {
  const stackable = existing.stackable ?? 0n;
  // Deliberately narrow: only the attributes an item cannot physically exist
  // without. Cosmetic fields stay exactly as the authored snapshot published
  // them so this overlay never rewrites unrelated presentation data.
  return {
    ...(stackable <= 0n
      ? {
          stackable: BigInt(
            Math.max(1, Math.trunc(definition.maxStackSize) || 1)
          ),
        }
      : {}),
    ...(existing.isDroppable === undefined ? { isDroppable: true } : {}),
    ...(!existing.displayName ? { displayName: definition.displayName } : {}),
  };
}

// A snapshot id a Harthmere tool binds to may carry no art at all. The Hoe
// (7539420629350046) is the case in point: no vox, no mesh, no icon, so even
// once it is storable it would sit in the backpack and hand as a blank. Borrow
// the authored Wooden Hoe's presentation rather than minting a second hoe
// identity that existing recipes, vendors and quests do not reference.
const HARTHMERE_NATIVE_TOOL_PRESENTATION_DONORS: Readonly<
  Record<string, BiomesId>
> = {
  "7539420629350046": 1_534_621_126_189_388 as BiomesId,
};

function harthmereBorrowedPresentation(
  existing: Biscuit,
  donor: Biscuit | undefined
): Partial<Biscuit> {
  if (!donor) return {};
  return Object.fromEntries(
    HARTHMERE_NATIVE_PRESENTATION_ATTRIBUTES.flatMap((attribute) => {
      // Never override art the snapshot already authored.
      if (existing[attribute] !== undefined) return [];
      const value = donor[attribute];
      return value === undefined ? [] : [[attribute, value]];
    })
  ) as Partial<Biscuit>;
}

function generatedInventoryIconPresentation(itemId: string) {
  const galoisIcon =
    harthmereBusinessFurnitureAsset(itemId)?.iconUrl ??
    harthmereGeneratedInventoryIconUrl(itemId);
  return galoisIcon
    ? {
        // Native icon attributes are checked before galoisIcon. Clear any
        // donor/snapshot icon so the exact Blender render wins everywhere.
        icon: undefined,
        iconSettings: undefined,
        galoisIcon,
      }
    : {};
}

export function harthmereBiscuitForItemDefinition(
  definition: HarthmereItemDefinition,
  presentationSource?: Biscuit
): Biscuit {
  const id = harthmereNativeBiomesIdForItemId(definition.itemId)!;
  const combatProfile = harthmereNativeItemCombatProfile({ id });
  const consumableProfile = harthmereNativeConsumableProfile({ id });
  const nativeRecoveryConsumable =
    consumableProfile !== undefined &&
    (consumableProfile.staminaRestore > 0 ||
      consumableProfile.manaRestore > 0 ||
      consumableProfile.healthRestore > 0);
  const lifetimeDurabilityMs = harthmereNativeItemLifetimeDurabilityMs(
    definition,
    combatProfile
  );
  const category = definition.category?.trim() || "Harthmere";
  const premiumWeapon = getHarthmerePremiumWeapon(definition.itemId);
  const furnitureAsset = harthmereBusinessFurnitureAsset(definition.itemId);
  const generatedInventoryIcon =
    furnitureAsset?.iconUrl ??
    harthmereGeneratedInventoryIconUrl(definition.itemId);
  const inventoryIcon =
    premiumWeapon?.inventoryIconUrl ?? generatedInventoryIcon;
  const placeableSize = definition.objectMetadata?.sizeVoxels;
  const nativePlaceable = Boolean(
    placeableSize &&
    ["device", "station", "furniture", "garden", "fixture"].includes(
      definition.objectMetadata!.objectKind
    )
  );
  const seedDefinition = Object.values(HARTHMERE_SEED_DEFINITIONS).find(
    (seed) => seed.seedItemId === definition.itemId
  );
  const farmingToolAttributes = nativeFarmingToolAttributes(definition);
  const fishingToolAttributes = nativeFishingToolAttributes(definition);
  const fishAttributes = nativeFishAttributes(definition);
  const cropBlockId = seedDefinition
    ? (safeParseBiomesId(seedDefinition.cropItemId) ??
      HARTHMERE_LOCAL_CROP_BLOCK_IDS[seedDefinition.cropItemId])
    : undefined;
  const yieldItemId = seedDefinition
    ? harthmereNativeBiomesIdForItemId(seedDefinition.yieldItemId)
    : undefined;
  const presentation = Object.fromEntries(
    HARTHMERE_NATIVE_PRESENTATION_ATTRIBUTES.flatMap((attribute) => {
      if (
        inventoryIcon &&
        (attribute === "icon" || attribute === "iconSettings")
      ) {
        return [];
      }
      const value = presentationSource?.[attribute];
      return value === undefined ? [] : [[attribute, value]];
    })
  ) as Partial<Biscuit>;
  return {
    ...presentation,
    id,
    name: harthmereBiscuitNameForItemId(definition.itemId),
    displayName: definition.displayName,
    displayDescription: definition.description,
    ...(inventoryIcon ? { galoisIcon: inventoryIcon } : {}),
    craftingCategory: category,
    stackable: BigInt(Math.max(1, Math.trunc(definition.maxStackSize))),
    ...(definition.binding === "none" && !definition.isQuestItem
      ? { isDroppable: true }
      : {}),
    ...(nativePlaceable && placeableSize
      ? {
          isPlaceable: true,
          boxSize: [
            placeableSize.width,
            placeableSize.height,
            placeableSize.depth,
          ],
          ...(furnitureAsset
            ? {
                collidableSize: [...furnitureAsset.collidableSize] as [
                  number,
                  number,
                  number,
                ],
                placementType: furnitureAsset.placementType,
              }
            : {}),
        }
      : {}),
    ...(seedDefinition && cropBlockId && yieldItemId
      ? {
          isSeed: true,
          action: "plant",
          plantableBlocks: [BikkieIds.tilledSoil],
          farming: {
            kind: "basic" as const,
            block: cropBlockId,
            timeMs: seedDefinition.growMs,
            hasGrowthStages: true,
            requiresSun: seedDefinition.requiresSun,
            waterIntervalMs: seedDefinition.waterIntervalMs,
            deathTimeMs: seedDefinition.deathTimeMs,
            dropTable: [
              [
                "guaranteed" as const,
                [[yieldItemId, seedDefinition.yieldCount] as const],
              ],
            ],
            seedDropTable: [["guaranteed" as const, [[id, 1] as const]]],
          },
        }
      : {}),
    tooltipTypeName: category,
    // Native combat reads these standard Bikkie attributes on both client and
    // server. The custom catalogue remains the authoring source, but no combat
    // result depends on a second Redis/local item-stat copy.
    ...(combatProfile && combatProfile.damagePerHit > 0
      ? { dps: combatProfile.dps }
      : {}),
    ...(lifetimeDurabilityMs !== undefined ? { lifetimeDurabilityMs } : {}),
    // Only publish the standard eat/drink contract when the native handler has
    // a complete effect. Revival scrolls, antidotes, and other custom
    // interactions must keep their dedicated action instead of being silently
    // removed by a generic ConsumptionEvent.
    ...(definition.isConsumable && nativeRecoveryConsumable
      ? {
          isConsumable: true,
          action: consumableProfile?.action ?? "eat",
          ...(consumableProfile && consumableProfile.healthRestore > 0
            ? { givesHealth: consumableProfile.healthRestore }
            : {}),
        }
      : {}),
    ...(definition.category === "tool" ||
    harthmereAllowedEquipmentSlots(definition).some((slot) =>
      ["main_hand", "off_hand"].includes(slot)
    )
      ? { isTool: true }
      : {}),
    // Farming interactions are selected-item driven. Publishing the standard
    // action and item attributes here makes the exact Harthmere tools usable by
    // the normal Biomes hotbar/interact script and keeps the OwnedItemReference
    // that reaches logic authoritative.
    ...farmingToolAttributes,
    ...fishingToolAttributes,
    ...fishAttributes,
    ...wearableAttributes(definition),
  } as Biscuit;
}

/**
 * Overlay code-authored Harthmere biscuits onto the immutable baked snapshot.
 * Existing numeric Bikkie ids are preserved; string ids receive one exact,
 * collision-checked biscuit shared by every server and browser process.
 */
export function withHarthmereNativeBikkieItems(
  tray: BakedBiscuitTray
): BakedBiscuitTray {
  const contents = new Map(tray.contents);
  const hashes = new Map(tray.hashes);
  const claimedIds = new Map<BiomesId, string>();

  for (const definition of ensureHarthmereNativeItemCatalogue()) {
    const id = harthmereNativeBiomesIdForItemId(definition.itemId);
    if (id === undefined) {
      // Tests and server-only systems may register catalogue fixtures that do
      // not have a native ECS identity. They must not become an `undefined`-id
      // Bikkie record on the browser wire.
      continue;
    }
    const overlayHash = `${HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION}:${definition.itemId}:${definition.maxStackSize}`;
    const priorItemId = claimedIds.get(id);
    if (priorItemId && priorItemId !== definition.itemId) {
      if (
        safeParseBiomesId(priorItemId) === id &&
        safeParseBiomesId(definition.itemId) === id
      ) {
        // `123` and `b:123` are two lossless spellings for the same authored
        // snapshot biscuit, not two semantic Harthmere items.
        continue;
      }
      if (
        id === NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID &&
        isRoadAheadMuckwadIdentity(priorItemId) &&
        isRoadAheadMuckwadIdentity(definition.itemId)
      ) {
        // The legacy quest/material name and the snapshot voxel name are two
        // semantic handles for one physical stack. Preserve that intentional
        // alias instead of treating it as a generated-id hash collision.
        continue;
      }
      throw new Error(
        `Harthmere Bikkie id collision ${id}: ${priorItemId} vs ${definition.itemId}`
      );
    }
    claimedIds.set(id, definition.itemId);

    const existing = contents.get(id);
    const expectedName = harthmereBiscuitNameForItemId(definition.itemId);
    if (existing) {
      if (id === NATIVE_ROAD_AHEAD_MUCKWAD_ITEM_ID) {
        // Preserve the snapshot biscuit's voxel/placement action. The code
        // catalogue supplies semantic lookup only; replacing this biscuit with
        // a generic material would make collected blocks impossible to throw.
        continue;
      }
      // Numeric/b:<id> definitions intentionally bind to an authored snapshot
      // biscuit. Reapplying our own overlay is expected because Redis storage
      // may return the prior augmented tray when the baked tray id is unchanged.
      // A generated string id must never overwrite unrelated snapshot data.
      if (safeParseBiomesId(definition.itemId) !== undefined) {
        const farmingToolAttributes = nativeFarmingToolAttributes(definition);
        if (farmingToolAttributes) {
          const donorId =
            HARTHMERE_NATIVE_TOOL_PRESENTATION_DONORS[definition.itemId];
          contents.set(id, {
            ...existing,
            ...harthmereBorrowedPresentation(
              existing,
              donorId === undefined ? undefined : contents.get(donorId)
            ),
            ...harthmereStorableBiscuitIdentity(existing, definition),
            ...generatedInventoryIconPresentation(definition.itemId),
            isTool: true,
            ...farmingToolAttributes,
          });
          hashes.set(id, overlayHash);
          continue;
        }
        const profile = harthmereNativeConsumableProfile({ id });
        if (
          definition.isConsumable &&
          profile &&
          (profile.staminaRestore > 0 ||
            profile.manaRestore > 0 ||
            profile.healthRestore > 0)
        ) {
          // Some original snapshot items are dual-purpose. Red Mushroom, for
          // example, keeps its authored `place` action but is also edible from
          // BiomesUI. Add the standard consumable capability without replacing
          // the exact voxel/presentation identity or its world-use action.
          contents.set(id, {
            ...existing,
            ...harthmereStorableBiscuitIdentity(existing, definition),
            ...generatedInventoryIconPresentation(definition.itemId),
            isConsumable: true,
            ...(existing.action === undefined
              ? { action: profile.action }
              : {}),
            ...(profile.healthRestore > 0
              ? { givesHealth: profile.healthRestore }
              : {}),
          });
          hashes.set(id, overlayHash);
          continue;
        }
        // Nothing else about this snapshot biscuit needs changing, but it still
        // has to be physically storable. A `stackable`-less record is a
        // gold-eating black hole in every vendor/loot/quest grant.
        const nativePresentationOverlay = {
          ...harthmereStorableBiscuitIdentity(existing, definition),
          ...generatedInventoryIconPresentation(definition.itemId),
        };
        if (Object.keys(nativePresentationOverlay).length > 0) {
          contents.set(id, { ...existing, ...nativePresentationOverlay });
          hashes.set(id, overlayHash);
        }
        continue;
      }
      if (
        existing.name !== expectedName &&
        !hashes
          .get(id)
          ?.startsWith(
            `${HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION}:${definition.itemId}:`
          )
      ) {
        throw new Error(
          `Generated Harthmere Bikkie id ${id} for ${definition.itemId} collides with ${existing.name}`
        );
      }
    }
    const presentationSourceId =
      HARTHMERE_NATIVE_PRESENTATION_SOURCE_IDS[definition.itemId];
    const presentationSource =
      existing?.name === expectedName
        ? existing
        : presentationSourceId
          ? contents.get(presentationSourceId)
          : undefined;
    const biscuit = harthmereBiscuitForItemDefinition(
      definition,
      presentationSource
    );
    contents.set(id, biscuit);
    hashes.set(id, overlayHash);
  }

  // Each creature family receives an exact NPC type. Reusing dMucker made
  // livestock hostile, erased per-family drops/kill trigger ids, and inherited
  // a non-attackable behavior from the snapshot. These biscuits use the native
  // NPC behavior schema so Anima owns aggro, movement, retaliation, and hits.
  for (const profile of allHarthmereNativeNpcCombatProfiles()) {
    const existing = contents.get(profile.id);
    const overlayHash = `${HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION}:npc:${profile.key}`;
    const presentation = contents.get(
      profile.behaviorKind === "sentinel"
        ? BikkieIds.biomesRobot
        : BikkieIds.dMucker
    );
    const biscuit = harthmereNativeNpcBiscuit(profile, presentation);
    if (
      existing &&
      existing.name !== biscuit.name &&
      !hashes
        .get(profile.id)
        ?.startsWith(`${HARTHMERE_NATIVE_BIKKIE_OVERLAY_VERSION}:npc:`)
    ) {
      throw new Error(
        `Generated Harthmere NPC Bikkie id ${profile.id} for ${profile.key} collides with ${existing.name}`
      );
    }
    // Redis can contain the exact NPC biscuit written by a prior revision even
    // when its process-local overlay hash is absent or belongs to an older
    // overlay version. The stable biscuit name is the authored identity, so
    // adopt and refresh that exact record while continuing to reject unrelated
    // biscuits at the same numeric id.
    contents.set(profile.id, biscuit);
    hashes.set(profile.id, overlayHash);
  }

  // Native-compatible recipes are real Bikkie recipe items. Giving one through
  // PlayerInventoryEditor routes it into RecipeBook and emits recipeUnlocked,
  // matching the snapshot's one-authority crafting path. Complex target-item
  // workflows remain custom metadata but still transact physical items in ECS.
  for (const recipe of listHarthmereCraftingRecipes()) {
    const biscuit = harthmereNativeRecipeBiscuit(recipe);
    if (!biscuit) continue;
    const existing = contents.get(biscuit.id);
    const overlayHash = `${HARTHMERE_NATIVE_RECIPE_OVERLAY_VERSION}:${recipe.recipeId}`;
    if (
      existing &&
      existing.name !== biscuit.name &&
      !hashes
        .get(biscuit.id)
        ?.startsWith(`${HARTHMERE_NATIVE_RECIPE_OVERLAY_VERSION}:`)
    ) {
      throw new Error(
        `Harthmere recipe Bikkie id ${biscuit.id} for ${recipe.recipeId} collides with ${existing.name}`
      );
    }
    contents.set(biscuit.id, biscuit);
    hashes.set(biscuit.id, overlayHash);
  }

  // Authored Grove/Bible quests use native Challenges + TriggerState. Their
  // objective leaves consume server-signed firehose evidence, while normal
  // collect/wear/craft events continue to update stock snapshot quests.
  for (const quest of allHarthmereNativeQuestBiscuits()) {
    const existing = contents.get(quest.id);
    const overlayHash = `${HARTHMERE_NATIVE_QUEST_OVERLAY_VERSION}:${quest.name}`;
    if (
      existing &&
      existing.name !== quest.name &&
      !hashes
        .get(quest.id)
        ?.startsWith(`${HARTHMERE_NATIVE_QUEST_OVERLAY_VERSION}:`)
    ) {
      throw new Error(
        `Harthmere quest Bikkie id ${quest.id} for ${quest.name} collides with ${existing.name}`
      );
    }
    contents.set(quest.id, quest);
    hashes.set(quest.id, overlayHash);
  }
  // Native overlays are applied after the normal bakery validation path. Do
  // not allow that bypass to ship a wire payload the browser's zBiscuit parser
  // cannot consume; catch it during server refresh and deployment tests.
  assertFrontendBikkieDecodable(contents);
  return { ...tray, contents, hashes };
}
