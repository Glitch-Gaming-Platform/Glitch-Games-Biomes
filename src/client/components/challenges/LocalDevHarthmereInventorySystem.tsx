import { harthmereLocalStorage } from "@/client/util/storage";
import { RovingGrid } from "@/client/components/biomes_ui/nav/RovingGrid";
import {
  BiomesUIShopChrome,
  BiomesUIShopItemIcon,
  BiomesUIShopSection,
} from "@/client/components/inventory/BiomesUIShopChrome";
// LocalDevHarthmereInventorySystem local-dev economy boundary. Do not trust client storage in production.
import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import {
  HARTHMERE_BUSINESS_TOOL_SHOP_NEW_TOOL_DEFS,
  harthmereBusinessToolForType,
  harthmereBusinessToolPurchaseOutcome,
} from "@/shared/harthmere/harthmere_business_tool_shop";
import {
  HARTHMERE_VENDOR_STOCK,
  getHarthmereCurrentVendorStockLine,
  receiveHarthmereVendorGold,
  receiveHarthmereVendorStock,
  spendHarthmereVendorGold,
} from "@/client/components/challenges/LocalDevHarthmereVendorCatalog";
import {
  claimHarthmereQuestEconomyReward,
  isHarthmereVendorStockUnlocked,
  recordHarthmereQuestItemRecovered,
  cleanupHarthmereTemporaryQuestItemsForQuest,
} from "@/client/components/challenges/LocalDevHarthmereQuestEconomySystem";
import {
  claimHarthmereLocalDevRapidAction,
  HARTHMERE_LOCAL_DEV_STATE_KEYS,
  normalizeHarthmereNumberMap,
  normalizeHarthmereWallet,
  nonNegativeInt,
} from "@/client/components/challenges/LocalDevHarthmereEconomyHardening";
import { completeHarthmereDailyTaskSoon } from "@/client/components/challenges/harthmereDailyTasks";
import {
  defaultHarthmereLiveFetch,
  fetchHarthmereLiveWithTimeout,
  runHarthmereLiveMutationOnce,
  runHarthmereLiveMutationSerially,
} from "@/client/components/harthmere_live_fetch";
import {
  healHarthmerePlayer,
  reviveHarthmerePlayer,
} from "@/client/components/challenges/LocalDevHarthmereCombat";
import { eatHarthmereFoodForStamina } from "@/client/components/challenges/LocalDevHarthmereFoodStaminaSystem";
import { getHarthmereLevelSummary } from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import { readHarthmereReputationState } from "@/client/components/challenges/LocalDevHarthmereReputation";
import { SNAPSHOT_GROVE_QUESTS } from "@/shared/harthmere/snapshot_grove_content";
import { harthmereLocalItemBikkieWearable } from "@/shared/harthmere/harthmere_bikkie_wearables";
import { ensureHarthmereProductionVendorCatalog } from "@/shared/harthmere/harthmere_vendor_catalog";
import { ensureHarthmereProductionCraftingCatalogue } from "@/shared/harthmere/mmo_crafting_catalogue";
import {
  getHarthmereItemDefinition as getAuthoritativeHarthmereItemDefinition,
  type HarthmereItemDefinition as AuthoritativeHarthmereItemDefinition,
} from "@/shared/harthmere/mmo_inventory_authority";
import {
  HARTHMERE_BIOMES_ECS_INVENTORY_UPDATED_EVENT,
  createHarthmereBiomesEcsInventory,
} from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import { harthmereNativeItemIdForBiomesId } from "@/shared/harthmere/harthmere_native_item_ids";
import {
  chapter1RevealedItemDescription,
  chapter1RevealedItemName,
  ensureChapter1RevealLoaded,
  isChapter1RevealableItem,
} from "@/client/components/challenges/chapter1ItemRevealStore";
import { HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT } from "@/shared/harthmere/snapshot_grove_trigger_contract";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import { harthmereLiveServerAuthoritative } from "@/client/components/challenges/harthmereLiveAuthoritySignal";
import { resolveAssetUrlUntyped } from "@/galois/interface/asset_paths";
import { safeGetTerrainName } from "@/shared/asset_defs/terrain";
import { BikkieIds } from "@/shared/bikkie/ids";
import { terrainIdToBlock } from "@/shared/bikkie/terrain";
import type { AnyBinaryAttribute } from "@/shared/bikkie/schema/binary";
import { staticUrlForAttribute } from "@/shared/bikkie/schema/binary";
import { PLAYER_INVENTORY_SLOTS } from "@/shared/game/inventory";
import { anItem } from "@/shared/game/item";
import { findItemEquippableSlot } from "@/shared/game/wearables";
import { safeParseBiomesId } from "@/shared/ids";
import { resolveBinaryAttribute } from "@/shared/util/dye_helpers";
import {
  HARTHMERE_INVENTORY_EVENT,
  HARTHMERE_LIVE_EQUIPMENT_EVENT,
  HARTHMERE_LIVE_INVENTORY_SYNC_EVENT,
  HARTHMERE_VENDOR_TRADE_CLOSE_TALK_EVENT,
} from "@/client/components/challenges/harthmereEvents";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

// Cloud-save guardrails scan this owning file for the literal save key:
// biomes.localDev.harthmere.inventoryState
const HARTHMERE_INVENTORY_STATE_KEY = HARTHMERE_LOCAL_DEV_STATE_KEYS.inventory;
const HARTHMERE_VENDOR_TRADE_EVENT = "biomes:harthmere-open-vendor-trade";
const HARTHMERE_VENDOR_TRADE_REQUEST_KEY =
  "biomes.localDev.harthmere.pendingVendorTrade";
export const HARTHMERE_NATIVE_TERRAIN_BLOCK_DESTROYED_EVENT =
  "biomes:harthmere-native-terrain-block-destroyed" as const;
// Fired by the place-voxel path (client/game/interact/helpers.ts). Mirror of the
// destroyed event: placing a raw voxel must debit one of the block's biscuit
// item from the Harthmere live-mode inventory (mining credited it). Keeps the
// displayed inventory/hotbar count in step with the canonical /sync EditEvent.
export const HARTHMERE_NATIVE_TERRAIN_BLOCK_PLACED_EVENT =
  "biomes:harthmere-native-terrain-block-placed" as const;

export interface HarthmereNativeTerrainBlockDestroyedDetail {
  terrainId?: number;
  blockItemId?: string;
  terrainName?: string;
  blockName?: string;
  position?: unknown;
  at?: number;
}

type HarthmereVendorTradeMode = "buy" | "sell";

type HarthmereVendorTradeRequest = {
  offset: number;
  mode: HarthmereVendorTradeMode;
};

export type HarthmereItemCategory =
  | "weapon"
  | "armor"
  | "accessory"
  | "consumable"
  | "food"
  | "drink"
  | "crafting_material"
  | "quest_item"
  | "currency"
  | "key"
  | "book"
  | "spell_scroll"
  | "tool"
  | "trade_good"
  | "junk"
  | "trophy"
  | "cosmetic"
  | "housing"
  | "container"
  | "event_item";

export type HarthmereItemQuality =
  | "poor"
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "quest"
  | "event";

type HarthmereBindType =
  | "unbound"
  | "bind_on_pickup"
  | "bind_on_equip"
  | "bind_on_use"
  | "account_bound"
  | "quest_bound";

type EquipmentSlot =
  | "head"
  | "chest"
  | "legs"
  | "feet"
  | "hands"
  | "back"
  | "neck"
  | "ring_1"
  | "ring_2"
  | "trinket_1"
  | "trinket_2"
  | "main_hand"
  | "off_hand"
  | "ranged"
  | "tool";

type HarthmereStorageLocation =
  | "backpack"
  | "equipment"
  | "quest_pouch"
  | "material_storage"
  | "keyring"
  | "spellbook"
  | "wallet"
  | "bank";

interface HarthmereItemDefinition {
  id: string;
  name: string;
  category: HarthmereItemCategory;
  subtype: string;
  quality: HarthmereItemQuality;
  icon: string;
  stackable: boolean;
  maxStack: number;
  slot?: EquipmentSlot;
  requiredLevel?: number;
  bindType: HarthmereBindType;
  baseValue: number;
  durabilityMax?: number;
  stats?: Partial<{
    attackPoints: number;
    defense: number;
    armor: number;
    magicResistance: number;
    accuracy: number;
    evasion: number;
    criticalChance: number;
  }>;
  useEffect?:
    | { type: "heal"; amount: number; combatUsable: boolean }
    | { type: "revive" }
    | { type: "learn_spell"; spellId: string }
    | { type: "unlock_key"; keyId: string };
  questUsage?: string;
  hotbarEligible?: boolean;
  throwable?: boolean;
  description: string;
}

interface HarthmereSpellDefinition {
  id: string;
  name: string;
  school: string;
  category: string;
  rank: number;
  icon: string;
  requiredLevel: number;
  manaCost: number;
  cooldownSeconds: number;
  range: number;
  description: string;
}

export interface HarthmereItemInstance {
  instanceId: string;
  itemId: string;
  location: HarthmereStorageLocation;
  slotIndex?: number;
  equipmentSlot?: EquipmentSlot;
  quantity: number;
  durability?: number;
  bound: boolean;
  stolen: boolean;
  locked: boolean;
  createdBy?: string;
  enchantments: string[];
  expiration?: number;
  customName?: string;
  acquiredAt: number;
}

interface HarthmereKnownSpell {
  spellId: string;
  learnedAt: number;
  source: string;
  equippedSlot?: string;
  runes: string[];
}

interface HarthmereInventoryLogEntry {
  id: string;
  at: number;
  system: "inventory";
  actorId: "local-player";
  action: string;
  detail: string;
  itemId?: string;
  quantity?: number;
  currency?: "gold";
  amount?: number;
  reason?: string;
  success: boolean;
}

export interface HarthmereInventoryState {
  version: 1;
  backpack: {
    maxSlots: number;
    items: HarthmereItemInstance[];
  };
  equipment: Partial<Record<EquipmentSlot, HarthmereItemInstance>>;
  questPouch: HarthmereItemInstance[];
  materialStorage: Record<string, number>;
  keyring: string[];
  wallet: Record<string, number>;
  spellbook: {
    knownSpells: HarthmereKnownSpell[];
    activeSpellSlots: Record<string, string | undefined>;
    passiveSlots: Record<string, string | undefined>;
  };
  bank: {
    maxSlots: number;
    items: HarthmereItemInstance[];
  };
  hotbar: Record<string, string | undefined>;
  recent: HarthmereInventoryLogEntry[];
  lastVendor?: string;
}

const ITEM_DEFINITIONS: Record<string, HarthmereItemDefinition> = {
  billys_lunch_pail: {
    id: "billys_lunch_pail",
    name: "Billy's Lunch Pail",
    category: "quest_item",
    subtype: "lost_property",
    quality: "common",
    icon: "🪣",
    stackable: false,
    maxStack: 1,
    bindType: "quest_bound",
    baseValue: 0,
    description:
      "Billy's dented lunch pail, recovered from the Old Grove Road.",
  },
  jackies_sealed_letter: {
    id: "jackies_sealed_letter",
    name: "Jackie's Sealed Letter",
    category: "quest_item",
    subtype: "delivery",
    quality: "quest",
    icon: "✉",
    stackable: false,
    maxStack: 1,
    bindType: "quest_bound",
    baseValue: 0,
    questUsage: "Letter for the North Gate",
    description: "Jackie's sealed letter for the North Gate watch.",
  },
  bolt_order: {
    id: "bolt_order",
    name: "Luis's Bolt Order",
    category: "quest_item",
    subtype: "work_order",
    quality: "quest",
    icon: "▤",
    stackable: false,
    maxStack: 1,
    bindType: "quest_bound",
    baseValue: 0,
    questUsage: "Toll Ledger Problem",
    description: "Luis's written order for the market bolt crates.",
  },
  sils_tuning_strip: {
    id: "sils_tuning_strip",
    name: "Sil's Tuning Strip",
    category: "quest_item",
    subtype: "audio_clue",
    quality: "quest",
    icon: "♫",
    stackable: false,
    maxStack: 1,
    bindType: "quest_bound",
    baseValue: 0,
    questUsage: "Tone Beneath the Road",
    description: "Sil's marked tuning strip from the Mosslawn song stones.",
  },
  training_dagger: {
    id: "training_dagger",
    name: "Training Dagger",
    category: "weapon",
    subtype: "dagger",
    quality: "common",
    icon: "†",
    stackable: false,
    maxStack: 1,
    slot: "main_hand",
    requiredLevel: 1,
    bindType: "bind_on_equip",
    baseValue: 18,
    durabilityMax: 35,
    stats: { attackPoints: 9, accuracy: 2 },
    description: "A blunt-edged practice dagger from the Guard Yard racks.",
  },
  iron_longsword: {
    id: "iron_longsword",
    name: "Iron Longsword",
    category: "weapon",
    subtype: "sword",
    quality: "uncommon",
    icon: "⚔",
    stackable: false,
    maxStack: 1,
    slot: "main_hand",
    requiredLevel: 2,
    bindType: "bind_on_equip",
    baseValue: 120,
    durabilityMax: 50,
    stats: { attackPoints: 18, accuracy: 3 },
    description: "A reliable town-watch blade with a plain iron guard.",
  },
  woodsman_axe: {
    id: "woodsman_axe",
    name: "Woodsman's Axe",
    category: "weapon",
    subtype: "axe",
    quality: "common",
    icon: "🪓",
    stackable: false,
    maxStack: 1,
    slot: "main_hand",
    requiredLevel: 1,
    bindType: "bind_on_equip",
    baseValue: 70,
    durabilityMax: 45,
    stats: { attackPoints: 14, accuracy: 1, criticalChance: 0.01 },
    description:
      "A plain chopping axe balanced well enough for rough roadside defense.",
  },
  two_handed_sword: {
    id: "two_handed_sword",
    name: "Two-Handed Sword",
    category: "weapon",
    subtype: "greatsword",
    quality: "uncommon",
    icon: "⚔",
    stackable: false,
    maxStack: 1,
    slot: "main_hand",
    requiredLevel: 3,
    bindType: "bind_on_equip",
    baseValue: 180,
    durabilityMax: 60,
    stats: { attackPoints: 26, accuracy: 1, criticalChance: 0.02 },
    description:
      "A heavy Black Anvil blade for players who want slower, harder hits.",
  },
  wooden_shield: {
    id: "wooden_shield",
    name: "Town Watch Buckler",
    category: "armor",
    subtype: "shield",
    quality: "common",
    icon: "⬟",
    stackable: false,
    maxStack: 1,
    slot: "off_hand",
    requiredLevel: 1,
    bindType: "bind_on_equip",
    baseValue: 45,
    durabilityMax: 45,
    stats: { defense: 8, armor: 14 },
    description: "A reinforced wooden shield used during guard-yard drills.",
  },
  patched_cloak: {
    id: "patched_cloak",
    name: "Patched Mudden Cloak",
    category: "armor",
    subtype: "cloak",
    quality: "uncommon",
    icon: "♜",
    stackable: false,
    maxStack: 1,
    slot: "back",
    requiredLevel: 1,
    bindType: "bind_on_pickup",
    baseValue: 30,
    durabilityMax: 40,
    stats: { evasion: 4 },
    description:
      "A rough but warm cloak stitched from old sailcloth and careful favors.",
  },
  baker_apron: {
    id: "baker_apron",
    name: "Dawn Loaf Apron",
    category: "cosmetic",
    subtype: "outfit",
    quality: "common",
    icon: "🥼",
    stackable: false,
    maxStack: 1,
    slot: "chest",
    bindType: "bind_on_pickup",
    baseValue: 12,
    durabilityMax: 30,
    stats: { defense: 1 },
    description:
      "A flour-dusted apron given to helpers who can carry apples cleanly.",
  },
  field_trousers: {
    id: "field_trousers",
    name: "Grove Field Trousers",
    category: "cosmetic",
    subtype: "outfit",
    quality: "common",
    icon: "👖",
    stackable: false,
    maxStack: 1,
    slot: "legs",
    bindType: "bind_on_pickup",
    baseValue: 12,
    durabilityMax: 30,
    stats: { defense: 1 },
    description:
      "Sturdy work trousers for the road — the bottoms half of a traveler's starter outfit.",
  },
  minor_healing_salve: {
    id: "minor_healing_salve",
    name: "Minor Healing Salve",
    category: "consumable",
    subtype: "healing",
    quality: "common",
    icon: "+",
    stackable: true,
    maxStack: 20,
    bindType: "unbound",
    baseValue: 8,
    useEffect: { type: "heal", amount: 35, combatUsable: true },
    description:
      "Clean cloth packed with willow and mint. Usable during combat.",
  },
  apple_tart: {
    id: "apple_tart",
    name: "Warm Apple Tart",
    category: "food",
    subtype: "stamina_food",
    quality: "common",
    icon: "◍",
    stackable: true,
    maxStack: 50,
    bindType: "unbound",
    baseValue: 4,
    useEffect: { type: "heal", amount: 12, combatUsable: false },
    description: "A sweet road snack from Dawn Loaf Bakery.",
  },
  road_ration: {
    id: "road_ration",
    name: "Road Ration",
    category: "food",
    subtype: "travel_food",
    quality: "common",
    icon: "□",
    stackable: true,
    maxStack: 50,
    bindType: "unbound",
    baseValue: 3,
    useEffect: { type: "heal", amount: 8, combatUsable: false },
    description:
      "Hard bread, dried fruit, and enough salt to survive a wet road.",
  },
  repair_voucher: {
    id: "repair_voucher",
    name: "Black Anvil Repair Voucher",
    category: "trade_good",
    subtype: "service_token",
    quality: "uncommon",
    icon: "⌁",
    stackable: true,
    maxStack: 20,
    bindType: "bind_on_pickup",
    baseValue: 18,
    description: "Redeemable at the Black Anvil for trusted field repairs.",
  },
  apple_basket: {
    id: "apple_basket",
    name: "Clean Orchard Apple Basket",
    category: "quest_item",
    subtype: "delivery",
    quality: "quest",
    icon: "●",
    stackable: false,
    maxStack: 1,
    bindType: "quest_bound",
    baseValue: 0,
    questUsage: "Apples for Dawnloaf",
    description:
      "A quest basket that belongs in the separate quest pouch, not the backpack.",
  },
  bank_lockbox_clue: {
    id: "bank_lockbox_clue",
    name: "Wet Lockbox Footprint Note",
    category: "quest_item",
    subtype: "clue",
    quality: "quest",
    icon: "?",
    stackable: false,
    maxStack: 1,
    bindType: "quest_bound",
    baseValue: 0,
    questUsage: "Missing Lockbox",
    description: "A copied clue from Courier Anwen's counter mat.",
  },
  cold_iron_scrap: {
    id: "cold_iron_scrap",
    name: "Cold Iron Scrap",
    category: "crafting_material",
    subtype: "metal",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 2,
    description: "Small, useful metal pieces for smithing orders.",
  },
  fever_tea_bundle: {
    id: "fever_tea_bundle",
    name: "Fever Tea Bundle",
    category: "quest_item",
    subtype: "medicine",
    quality: "quest",
    icon: "♧",
    stackable: false,
    maxStack: 1,
    bindType: "quest_bound",
    baseValue: 0,
    questUsage: "Fever Tea",
    description:
      "A careful chapel delivery. It is protected in the quest pouch.",
  },
  copper_kettle_token: {
    id: "copper_kettle_token",
    name: "Copper Kettle Tavern Token",
    category: "event_item",
    subtype: "social_token",
    quality: "common",
    icon: "☕",
    stackable: true,
    maxStack: 99,
    bindType: "bind_on_pickup",
    baseValue: 5,
    description: "A tavern token for food, rumors, or a round by the hearth.",
  },
  fresh_egg: {
    id: "fresh_egg",
    name: "Fresh Chicken Egg",
    category: "crafting_material",
    subtype: "cooking",
    quality: "common",
    icon: "○",
    stackable: true,
    maxStack: 50,
    bindType: "unbound",
    baseValue: 2,
    description: "A cooking material from Tilda's chicken yard.",
  },
  river_knot_marker: {
    id: "river_knot_marker",
    name: "Blue River Knot Marker",
    category: "key",
    subtype: "smuggler_mark",
    quality: "uncommon",
    icon: "∞",
    stackable: false,
    maxStack: 1,
    bindType: "bind_on_pickup",
    baseValue: 0,
    description: "A quiet sign that certain dock doors may open later.",
  },
  old_bronze_bell_shard: {
    id: "old_bronze_bell_shard",
    name: "Old Bronze Bell Shard",
    category: "quest_item",
    subtype: "artifact",
    quality: "quest",
    icon: "◈",
    stackable: false,
    maxStack: 1,
    bindType: "quest_bound",
    baseValue: 0,
    questUsage: "The Missing Bell",
    description: "A resonant shard from the mystery under Harthmere.",
  },
  scroll_of_spark: {
    id: "scroll_of_spark",
    name: "Scroll of Spark",
    category: "spell_scroll",
    subtype: "arcane_scroll",
    quality: "uncommon",
    icon: "✦",
    stackable: true,
    maxStack: 5,
    requiredLevel: 1,
    bindType: "bind_on_use",
    baseValue: 35,
    useEffect: { type: "learn_spell", spellId: "spark_rank_1" },
    description: "Teaches Spark Rank 1 if you do not already know it.",
  },
  chapel_candle: {
    id: "chapel_candle",
    name: "Chapel Road Candle",
    category: "consumable",
    subtype: "blessing",
    quality: "common",
    icon: "i",
    stackable: true,
    maxStack: 20,
    bindType: "bind_on_pickup",
    baseValue: 6,
    useEffect: { type: "heal", amount: 18, combatUsable: false },
    description: "A quiet blessing candle. Best used outside combat.",
  },

  repair_mallet: {
    id: "repair_mallet",
    name: "Repair Mallet",
    category: "tool",
    subtype: "repair_tool",
    quality: "common",
    icon: "🔨",
    stackable: false,
    maxStack: 1,
    // Equippable in the main hand: a tool only has its effect while EQUIPPED.
    // Equipped, it RESTORES broken structure blocks (fences etc.) instead of
    // destroying them, and satisfies repair jobs' required-tool gate.
    slot: "main_hand",
    requiredLevel: 1,
    bindType: "bind_on_equip",
    baseValue: 30,
    durabilityMax: 60,
    description:
      "Equip in your main hand to repair broken structures — it restores their blocks instead of breaking them. Required for repair jobs.",
  },
  muck_rake: {
    id: "muck_rake",
    name: "Muck Rake",
    category: "tool",
    subtype: "cleanup_tool",
    quality: "common",
    icon: "🧹",
    stackable: false,
    maxStack: 1,
    // Equippable: clears muck (converts muck voxels back to dirt) and plants
    // seeds for gardening. Required for cleanup jobs.
    slot: "main_hand",
    requiredLevel: 1,
    bindType: "bind_on_equip",
    baseValue: 30,
    durabilityMax: 60,
    description:
      "Equip in your main hand to clear muck — it turns muck back into dirt — and to plant seeds. Required for cleanup jobs.",
  },
  rusty_pickaxe: {
    id: "rusty_pickaxe",
    name: "Rusty Pickaxe",
    category: "tool",
    subtype: "mining_tool",
    quality: "common",
    icon: "⛏",
    stackable: false,
    maxStack: 1,
    bindType: "bind_on_pickup",
    baseValue: 12,
    durabilityMax: 60,
    description:
      "Starter mining tool for copper, iron, stone, and simple gems.",
  },
  woodcutters_axe: {
    id: "woodcutters_axe",
    name: "Woodcutter's Axe",
    category: "tool",
    subtype: "logging_tool",
    quality: "common",
    icon: "∕",
    stackable: false,
    maxStack: 1,
    bindType: "bind_on_pickup",
    baseValue: 12,
    durabilityMax: 60,
    description:
      "Starter logging tool for fallen branches, softwood, and orchard wood.",
  },
  herbalist_sickle: {
    id: "herbalist_sickle",
    name: "Herbalist Sickle",
    category: "tool",
    subtype: "herbalism_tool",
    quality: "common",
    icon: "☘",
    stackable: false,
    maxStack: 1,
    bindType: "bind_on_pickup",
    baseValue: 10,
    durabilityMax: 55,
    description:
      "A small curved blade for harvesting herbs without ruining roots.",
  },
  simple_fishing_rod: {
    id: "simple_fishing_rod",
    name: "Simple Fishing Rod",
    category: "tool",
    subtype: "fishing_tool",
    quality: "common",
    icon: "⌒",
    stackable: false,
    maxStack: 1,
    bindType: "bind_on_pickup",
    baseValue: 10,
    durabilityMax: 55,
    description:
      "A dockhand's rod for river fish, bait work, and basic fishing pools.",
  },
  skinning_knife: {
    id: "skinning_knife",
    name: "Skinning Knife",
    category: "tool",
    subtype: "skinning_tool",
    quality: "common",
    icon: "╱",
    stackable: false,
    maxStack: 1,
    bindType: "bind_on_pickup",
    baseValue: 10,
    durabilityMax: 55,
    description: "A practical knife for hides, meat, bone, and monster parts.",
  },
  scavenger_hook: {
    id: "scavenger_hook",
    name: "Scavenger Hook",
    category: "tool",
    subtype: "scavenging_tool",
    quality: "common",
    icon: "J",
    stackable: false,
    maxStack: 1,
    bindType: "bind_on_pickup",
    baseValue: 9,
    durabilityMax: 50,
    description:
      "A hooked rod for pulling safe scrap from piles without cutting your hands.",
  },
  clay_shovel: {
    id: "clay_shovel",
    name: "Clay Shovel",
    category: "tool",
    subtype: "digging_tool",
    quality: "common",
    icon: "⌠",
    stackable: false,
    maxStack: 1,
    bindType: "bind_on_pickup",
    baseValue: 10,
    durabilityMax: 55,
    description: "A short shovel for river clay, relic digs, and soft earth.",
  },
  arcane_extractor: {
    id: "arcane_extractor",
    name: "Arcane Extractor",
    category: "tool",
    subtype: "magical_harvest_tool",
    quality: "uncommon",
    icon: "✧",
    stackable: false,
    maxStack: 1,
    bindType: "bind_on_pickup",
    baseValue: 30,
    durabilityMax: 40,
    description:
      "A glass-and-copper tool for safely drawing magical residue into vials.",
  },
  iron_ore: {
    id: "iron_ore",
    name: "Iron Ore",
    category: "crafting_material",
    subtype: "ore",
    quality: "common",
    icon: "◆",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "Tier 1 mining material used in smithing, repairs, tools, and town projects.",
  },
  rough_stone: {
    id: "rough_stone",
    name: "Rough Stone",
    category: "crafting_material",
    subtype: "stone",
    quality: "common",
    icon: "▪",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 1,
    hotbarEligible: true,
    throwable: true,
    description: "Construction and repair material from mining nodes.",
  },
  rough_garnet: {
    id: "rough_garnet",
    name: "Rough Garnet",
    category: "crafting_material",
    subtype: "gem",
    quality: "uncommon",
    icon: "♦",
    stackable: true,
    maxStack: 50,
    bindType: "unbound",
    baseValue: 18,
    description:
      "Rare mining bonus used by jewelers, mages, and wealthy collectors.",
  },
  softwood_log: {
    id: "softwood_log",
    name: "Softwood Log",
    category: "crafting_material",
    subtype: "wood",
    quality: "common",
    icon: "▱",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 3,
    description: "Basic carpentry and housing material from fallen branches.",
  },
  oak_branch: {
    id: "oak_branch",
    name: "Oak Branch",
    category: "crafting_material",
    subtype: "wood",
    quality: "common",
    icon: "╲",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description: "Flexible wood for bows, handles, tools, and cart repairs.",
  },
  tree_resin: {
    id: "tree_resin",
    name: "Tree Resin",
    category: "crafting_material",
    subtype: "resin",
    quality: "uncommon",
    icon: "◒",
    stackable: true,
    maxStack: 100,
    bindType: "unbound",
    baseValue: 10,
    description:
      "Sticky rare logging material for bows, waterproofing, and alchemy.",
  },
  peacebloom: {
    id: "peacebloom",
    name: "Peacebloom",
    category: "crafting_material",
    subtype: "herb",
    quality: "common",
    icon: "✿",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "Gentle medicinal herb used in alchemy, temple offerings, and fever tea.",
  },
  fine_peacebloom: {
    id: "fine_peacebloom",
    name: "Fine Peacebloom",
    category: "crafting_material",
    subtype: "herb",
    quality: "uncommon",
    icon: "✾",
    stackable: true,
    maxStack: 100,
    bindType: "unbound",
    baseValue: 12,
    description: "Higher quality medicinal herb with stronger potion value.",
  },
  willow_bark: {
    id: "willow_bark",
    name: "Willow Bark",
    category: "crafting_material",
    subtype: "medicine",
    quality: "common",
    icon: "∩",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 3,
    description:
      "Pain-relief ingredient for salves, teas, and healer contracts.",
  },
  river_trout: {
    id: "river_trout",
    name: "River Trout",
    category: "food",
    subtype: "fish",
    quality: "common",
    icon: "><>",
    stackable: true,
    maxStack: 100,
    bindType: "unbound",
    baseValue: 5,
    useEffect: { type: "heal", amount: 4, combatUsable: false },
    description:
      "Fresh fish used in cooking, tavern contracts, trade crates, and stamina recovery.",
  },
  clean_water: {
    id: "clean_water",
    name: "Clean Water",
    category: "crafting_material",
    subtype: "water",
    quality: "common",
    icon: "~",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 1,
    description: "Water for alchemy, cooking, farming, and temple aid.",
  },
  river_pearl: {
    id: "river_pearl",
    name: "River Pearl",
    category: "crafting_material",
    subtype: "jewel",
    quality: "rare",
    icon: "●",
    stackable: true,
    maxStack: 20,
    bindType: "unbound",
    baseValue: 45,
    description:
      "Rare fishing find used for jewelry, noble trade, and magic focuses.",
  },
  field_wheat: {
    id: "field_wheat",
    name: "Field Wheat",
    category: "crafting_material",
    subtype: "grain",
    quality: "common",
    icon: "≋",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 2,
    description:
      "Food supply material for bread, rations, taverns, and town projects.",
  },
  fresh_carrot: {
    id: "fresh_carrot",
    name: "Fresh Carrot",
    category: "food",
    subtype: "vegetable",
    quality: "common",
    icon: "∨",
    stackable: true,
    maxStack: 100,
    bindType: "unbound",
    baseValue: 2,
    useEffect: { type: "heal", amount: 0, combatUsable: false },
    description:
      "Cooking ingredient, farm contract material, and quick stamina snack.",
  },
  loaf_bread: {
    id: "loaf_bread",
    name: "Loaf Bread",
    category: "food",
    subtype: "bread",
    quality: "common",
    icon: "▭",
    stackable: true,
    maxStack: 50,
    bindType: "unbound",
    baseValue: 4,
    useEffect: { type: "heal", amount: 0, combatUsable: false },
    description:
      "A practical loaf baked from Harthmere wheat. Reliable stamina food.",
  },
  grilled_meat: {
    id: "grilled_meat",
    name: "Grilled Meat",
    category: "food",
    subtype: "cooked_meat",
    quality: "common",
    icon: "◖",
    stackable: true,
    maxStack: 50,
    bindType: "unbound",
    baseValue: 7,
    useEffect: { type: "heal", amount: 6, combatUsable: false },
    description:
      "Cooked wild meat from hunted animals. Strong stamina recovery food.",
  },
  seed_wheat: {
    id: "seed_wheat",
    name: "Wheat Seed",
    category: "crafting_material",
    subtype: "seed",
    quality: "common",
    icon: "⋮",
    stackable: true,
    maxStack: 100,
    bindType: "unbound",
    baseValue: 1,
    description: "Farm seed bought from growers or found near worked fields.",
  },
  seed_carrot: {
    id: "seed_carrot",
    name: "Carrot Seed",
    category: "crafting_material",
    subtype: "seed",
    quality: "common",
    icon: "⋮",
    stackable: true,
    maxStack: 100,
    bindType: "unbound",
    baseValue: 1,
    description: "Farm seed for quick food crops.",
  },
  seed_muckroot: {
    id: "seed_muckroot",
    name: "Muckroot Seed",
    category: "crafting_material",
    subtype: "monster_seed",
    quality: "uncommon",
    icon: "✣",
    stackable: true,
    maxStack: 100,
    bindType: "unbound",
    baseValue: 5,
    description:
      "A strange seed sometimes gathered from monsters near corrupted roots.",
  },
  golden_carrot: {
    id: "golden_carrot",
    name: "Golden Carrot",
    category: "crafting_material",
    subtype: "rare_crop",
    quality: "rare",
    icon: "▽",
    stackable: true,
    maxStack: 20,
    bindType: "unbound",
    baseValue: 35,
    description: "Rare crop used in high-value cooking and animal training.",
  },
  scrap_metal: {
    id: "scrap_metal",
    name: "Scrap Metal",
    category: "crafting_material",
    subtype: "scrap",
    quality: "common",
    icon: "#",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 2,
    description: "Recovered metal for repairs, engineering, and town projects.",
  },
  cloth_scrap: {
    id: "cloth_scrap",
    name: "Cloth Scrap",
    category: "crafting_material",
    subtype: "cloth",
    quality: "common",
    icon: "≡",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 2,
    description: "Tailoring and bandage material recovered from salvage piles.",
  },
  old_coin: {
    id: "old_coin",
    name: "Old Coin",
    category: "trade_good",
    subtype: "curio",
    quality: "uncommon",
    icon: "¤",
    stackable: true,
    maxStack: 50,
    bindType: "unbound",
    baseValue: 12,
    description: "A scavenged curio with minor collector value.",
  },
  river_clay: {
    id: "river_clay",
    name: "River Clay",
    category: "crafting_material",
    subtype: "clay",
    quality: "common",
    icon: "◖",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 2,
    description: "Used for bricks, pottery, repairs, and housing construction.",
  },
  sand_lump: {
    id: "sand_lump",
    name: "Sand Lump",
    category: "crafting_material",
    subtype: "sand",
    quality: "common",
    icon: ".",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 1,
    description: "Glassmaking and mortar material from riverbanks.",
  },
  blue_glass_shard: {
    id: "blue_glass_shard",
    name: "Blue Glass Shard",
    category: "crafting_material",
    subtype: "glass",
    quality: "uncommon",
    icon: "◁",
    stackable: true,
    maxStack: 50,
    bindType: "unbound",
    baseValue: 14,
    description:
      "A rare riverbank find used for lamps, charms, and window repairs.",
  },
  mana_essence: {
    id: "mana_essence",
    name: "Mana Essence",
    category: "crafting_material",
    subtype: "magical",
    quality: "uncommon",
    icon: "✧",
    stackable: true,
    maxStack: 100,
    bindType: "unbound",
    baseValue: 20,
    description:
      "Magical residue for scrolls, potions, enchantments, and arcane lamps.",
  },
  mana_draught: {
    id: "mana_draught",
    name: "Mana Draught",
    category: "consumable",
    subtype: "mana_potion",
    quality: "uncommon",
    icon: "◈",
    stackable: true,
    maxStack: 20,
    bindType: "unbound",
    baseValue: 28,
    description:
      "A measured blue draught that restores mana without consuming raw essence.",
  },
  mana_crystal_shard: {
    id: "mana_crystal_shard",
    name: "Mana Crystal Shard",
    category: "crafting_material",
    subtype: "crystal",
    quality: "rare",
    icon: "✦",
    stackable: true,
    maxStack: 50,
    bindType: "unbound",
    baseValue: 55,
    description:
      "Rare magical harvesting material used by mages and enchanters.",
  },
  raw_exotic_matter: {
    id: "raw_exotic_matter",
    name: "Raw Exotic Matter",
    category: "crafting_material",
    subtype: "exotic_matter",
    quality: "rare",
    icon: "x",
    stackable: true,
    maxStack: 50,
    bindType: "unbound",
    baseValue: 90,
    description:
      "Unstable Biome fuel drawn from Muck-adjacent anomalies. Best handled before it starts humming.",
  },
  stabilized_exotic_matter: {
    id: "stabilized_exotic_matter",
    name: "Stabilized Exotic Matter",
    category: "crafting_material",
    subtype: "exotic_matter",
    quality: "epic",
    icon: "*",
    stackable: true,
    maxStack: 50,
    bindType: "unbound",
    baseValue: 180,
    description:
      "Contained Exotic Matter suitable for emergency robots, Biome stabilizers, and high-risk repairs.",
  },
  muck_boss_trophy: {
    id: "muck_boss_trophy",
    name: "Muck Boss Trophy",
    category: "trophy",
    subtype: "muck_boss",
    quality: "rare",
    icon: "!",
    stackable: true,
    maxStack: 20,
    bindType: "bind_on_pickup",
    baseValue: 125,
    description:
      "Proof that a hard Muck breach threat was fully defeated, not merely scratched.",
  },
  relic_fragment: {
    id: "relic_fragment",
    name: "Relic Fragment",
    category: "crafting_material",
    subtype: "archaeology",
    quality: "uncommon",
    icon: "▥",
    stackable: true,
    maxStack: 100,
    bindType: "unbound",
    baseValue: 15,
    description:
      "Archaeology fragment used for museum turn-ins, lore, and relic crafting.",
  },
  old_bone_button: {
    id: "old_bone_button",
    name: "Old Bone Button",
    category: "trade_good",
    subtype: "archaeology_curio",
    quality: "common",
    icon: "○",
    stackable: true,
    maxStack: 50,
    bindType: "unbound",
    baseValue: 5,
    description:
      "A small graveyard curio. Legal only if recovered with permission.",
  },
  saint_coin: {
    id: "saint_coin",
    name: "Saint Coin",
    category: "trade_good",
    subtype: "holy_curio",
    quality: "rare",
    icon: "◎",
    stackable: true,
    maxStack: 20,
    bindType: "unbound",
    baseValue: 50,
    description: "A rare chapel relic that priests and collectors both value.",
  },
  wolf_hide: {
    id: "wolf_hide",
    name: "Wolf Hide",
    category: "crafting_material",
    subtype: "hide",
    quality: "common",
    icon: "▰",
    stackable: true,
    maxStack: 100,
    bindType: "unbound",
    baseValue: 5,
    description: "Leatherworking material from wolf carcasses.",
  },
  raw_meat: {
    id: "raw_meat",
    name: "Raw Meat",
    category: "crafting_material",
    subtype: "meat",
    quality: "common",
    icon: "◗",
    stackable: true,
    maxStack: 100,
    bindType: "unbound",
    baseValue: 3,
    description: "Cooking and animal feed material from harvested creatures.",
  },
  wolf_fang: {
    id: "wolf_fang",
    name: "Wolf Fang",
    category: "crafting_material",
    subtype: "bone",
    quality: "uncommon",
    icon: "⌃",
    stackable: true,
    maxStack: 50,
    bindType: "unbound",
    baseValue: 12,
    description:
      "Rare skinning bonus used in charms, trophies, and hunter contracts.",
  },
  field_revival_scroll: {
    id: "field_revival_scroll",
    name: "Field Revival Scroll",
    category: "spell_scroll",
    subtype: "revival_scroll",
    quality: "rare",
    icon: "✚",
    stackable: true,
    maxStack: 5,
    requiredLevel: 1,
    bindType: "bind_on_use",
    baseValue: 65,
    useEffect: { type: "revive" },
    description:
      "A single-use revival charm. It can pull you out of downed or dead state with partial HP.",
  },
  cracked_mug: {
    id: "cracked_mug",
    name: "Cracked Mug",
    category: "junk",
    subtype: "junk",
    quality: "poor",
    icon: "u",
    stackable: true,
    maxStack: 20,
    bindType: "unbound",
    baseValue: 1,
    description: "Junk. Safe to sell unless you are strangely attached to it.",
  },
  iron_key_blank: {
    id: "iron_key_blank",
    name: "Iron Key Blank",
    category: "key",
    subtype: "blank",
    quality: "common",
    icon: "⚿",
    stackable: false,
    maxStack: 1,
    bindType: "bind_on_pickup",
    baseValue: 0,
    description: "A blank key stored on the keyring, not in a normal bag.",
  },
  oak_log: {
    id: "oak_log",
    name: "Oak Log",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  pine_log: {
    id: "pine_log",
    name: "Pine Log",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  pine_pitch: {
    id: "pine_pitch",
    name: "Pine Pitch",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  straight_pine_heartwood: {
    id: "straight_pine_heartwood",
    name: "Straight Pine Heartwood",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "uncommon",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 10,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  birch_bark: {
    id: "birch_bark",
    name: "Birch Bark",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  lightwood_log: {
    id: "lightwood_log",
    name: "Lightwood Log",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  clean_birch_strip: {
    id: "clean_birch_strip",
    name: "Clean Birch Strip",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  flexible_willow: {
    id: "flexible_willow",
    name: "Flexible Willow",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  flood_willow_sap: {
    id: "flood_willow_sap",
    name: "Flood Willow Sap",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  black_iron_shard: {
    id: "black_iron_shard",
    name: "Black Iron Shard",
    category: "crafting_material",
    subtype: "ore",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  coal: {
    id: "coal",
    name: "Coal",
    category: "crafting_material",
    subtype: "ore",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  dense_coal_lump: {
    id: "dense_coal_lump",
    name: "Dense Coal Lump",
    category: "crafting_material",
    subtype: "ore",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  silver_ore: {
    id: "silver_ore",
    name: "Silver Ore",
    category: "crafting_material",
    subtype: "ore",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  bright_silver_nugget: {
    id: "bright_silver_nugget",
    name: "Bright Silver Nugget",
    category: "crafting_material",
    subtype: "ore",
    quality: "uncommon",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 10,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  gold_ore: {
    id: "gold_ore",
    name: "Gold Ore",
    category: "crafting_material",
    subtype: "ore",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  grave_stone_chip: {
    id: "grave_stone_chip",
    name: "Grave Stone Chip",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  bell_gold_flake: {
    id: "bell_gold_flake",
    name: "Bell Gold Flake",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "uncommon",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 10,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  wild_berries: {
    id: "wild_berries",
    name: "Wild Berries",
    category: "food",
    subtype: "berries",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    useEffect: { type: "heal", amount: 0, combatUsable: false },
    description:
      "Foraged berries that restore a little stamina and feed simple cooking work.",
  },
  berry_leaf: {
    id: "berry_leaf",
    name: "Berry Leaf",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  sweet_greenmere_berry: {
    id: "sweet_greenmere_berry",
    name: "Sweet Greenmere Berry",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  forest_mushroom: {
    id: "forest_mushroom",
    name: "Forest Mushroom",
    category: "crafting_material",
    subtype: "ore",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  damp_moss: {
    id: "damp_moss",
    name: "Damp Moss",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  mooncap_mushroom: {
    id: "mooncap_mushroom",
    name: "Mooncap Mushroom",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "uncommon",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 10,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  reed_bundle: {
    id: "reed_bundle",
    name: "Reed Bundle",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  mudroot: {
    id: "mudroot",
    name: "Mudroot",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  flood_lotus: {
    id: "flood_lotus",
    name: "Flood Lotus",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "uncommon",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 10,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  blackwater_clay: {
    id: "blackwater_clay",
    name: "Blackwater Clay",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  ghost_pearl: {
    id: "ghost_pearl",
    name: "Ghost Pearl",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "uncommon",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 10,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  grave_moss: {
    id: "grave_moss",
    name: "Grave Moss",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  nightshade: {
    id: "nightshade",
    name: "Nightshade",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  ghost_ash: {
    id: "ghost_ash",
    name: "Ghost Ash",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "uncommon",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 10,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  flax_stalk: {
    id: "flax_stalk",
    name: "Flax Stalk",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  plant_fiber: {
    id: "plant_fiber",
    name: "Plant Fiber",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  clean_flax_bundle: {
    id: "clean_flax_bundle",
    name: "Clean Flax Bundle",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  honeycomb: {
    id: "honeycomb",
    name: "Honeycomb",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  beeswax: {
    id: "beeswax",
    name: "Beeswax",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  queen_honey: {
    id: "queen_honey",
    name: "Queen Honey",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "uncommon",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 10,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  deer_hide: {
    id: "deer_hide",
    name: "Deer Hide",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  venison: {
    id: "venison",
    name: "Venison",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  clean_antler: {
    id: "clean_antler",
    name: "Clean Antler",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  boar_hide: {
    id: "boar_hide",
    name: "Boar Hide",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  boar_tusk: {
    id: "boar_tusk",
    name: "Boar Tusk",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  heavy_boar_bristle: {
    id: "heavy_boar_bristle",
    name: "Heavy Boar Bristle",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  bear_hide: {
    id: "bear_hide",
    name: "Bear Hide",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  bear_fat: {
    id: "bear_fat",
    name: "Bear Fat",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  black_bear_claw: {
    id: "black_bear_claw",
    name: "Black Bear Claw",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "uncommon",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 10,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  grave_dust: {
    id: "grave_dust",
    name: "Grave Dust",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  bone_fragment: {
    id: "bone_fragment",
    name: "Bone Fragment",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "common",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 4,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
  bell_woken_ash: {
    id: "bell_woken_ash",
    name: "Bell-Woken Ash",
    category: "crafting_material",
    subtype: "raw_material",
    quality: "uncommon",
    icon: "◇",
    stackable: true,
    maxStack: 200,
    bindType: "unbound",
    baseValue: 10,
    description:
      "A gathered Harthmere resource used by crafting, projects, vendors, and the town economy.",
  },
};

function harthmereResourceIconForItem(def: HarthmereItemDefinition): string {
  const text =
    `${def.id} ${def.name} ${def.subtype} ${def.description}`.toLowerCase();
  if (
    /log|wood|branch|bark|willow|resin|sap|pitch|heartwood|birch|oak|pine|timber/.test(
      text
    )
  ) {
    return "🪵";
  }
  if (
    /ore|iron|coal|silver|gold|stone|shard|nugget|garnet|rock|marble|quartz|crystal/.test(
      text
    )
  ) {
    return "⛏️";
  }
  if (/mushroom|fungus|spore|cap/.test(text)) {
    return "🍄";
  }
  if (
    /berry|berries|leaf|peacebloom|herb|moss|nightshade|lotus|root|reed|flax|fiber|daffodil|grain|wheat|flower|seed|petal/.test(
      text
    )
  ) {
    return "🌿";
  }
  if (/trout|fish|pearl|water|river|scale/.test(text)) {
    return "🐟";
  }
  if (/clay|mud|brick/.test(text)) {
    return "🧱";
  }
  if (/hide|pelt|meat|fang|bone|fur|antler|carcass|venison|boar/.test(text)) {
    return "🦴";
  }
  if (
    /relic|dust|ash|ghost|bell|rune|arcane|magic|well|grave|spirit|aether/.test(
      text
    )
  ) {
    return "✦";
  }
  if (/scrap|gear|metal|hook|junk|cog|part|wire/.test(text)) {
    return "⚙️";
  }
  return "◆";
}

for (const def of Object.values(ITEM_DEFINITIONS)) {
  if (def.category === "crafting_material" && def.icon === "◇") {
    def.icon = harthmereResourceIconForItem(def);
  }
}

// HARTHMERE_BUSINESS_TOOL_SHOP: register the tools introduced for the per-
// business tool shops (the businesses that had no themed tool). They are real
// main-hand tools so they can be bought, carried, and equipped like any other.
for (const seed of HARTHMERE_BUSINESS_TOOL_SHOP_NEW_TOOL_DEFS) {
  if (ITEM_DEFINITIONS[seed.itemId]) {
    continue;
  }
  ITEM_DEFINITIONS[seed.itemId] = {
    id: seed.itemId,
    name: seed.name,
    category: "tool",
    subtype: seed.subtype,
    quality: "common",
    icon: seed.icon,
    stackable: false,
    maxStack: 1,
    slot: "main_hand",
    requiredLevel: 1,
    bindType: "bind_on_pickup",
    baseValue: seed.baseValue,
    durabilityMax: 60,
    description: seed.description,
  };
}

const SPELL_DEFINITIONS: Record<string, HarthmereSpellDefinition> = {
  spark_rank_1: {
    id: "spark_rank_1",
    name: "Spark",
    school: "Arcane",
    category: "damage",
    rank: 1,
    icon: "✦",
    requiredLevel: 1,
    manaCost: 10,
    cooldownSeconds: 4,
    range: 24,
    description:
      "A small arcane bolt. In this local-dev pass it appears in the spellbook and can be slotted later.",
  },
  candle_blessing_rank_1: {
    id: "candle_blessing_rank_1",
    name: "Candle Blessing",
    school: "Holy",
    category: "utility",
    rank: 1,
    icon: "i",
    requiredLevel: 1,
    manaCost: 0,
    cooldownSeconds: 30,
    range: 0,
    description:
      "A minor Harthmere chapel blessing unlocked by helping Temple Green.",
  },
};

const QUALITY_STYLE: Record<HarthmereItemQuality, string> = {
  poor: "border-stone-500 text-stone-300",
  common: "border-white/30 text-white",
  uncommon: "border-emerald-300/60 text-emerald-100",
  rare: "border-sky-300/70 text-sky-100",
  epic: "border-purple-300/70 text-purple-100",
  legendary: "border-orange-300/80 text-orange-100",
  quest: "border-yellow-300/70 text-yellow-100",
  event: "border-pink-300/70 text-pink-100",
};

const CATEGORY_LABELS: Record<HarthmereItemCategory, string> = {
  weapon: "Weapon",
  armor: "Armor",
  accessory: "Accessory",
  consumable: "Consumable",
  food: "Food",
  drink: "Drink",
  crafting_material: "Crafting Material",
  quest_item: "Quest Item",
  currency: "Currency",
  key: "Key",
  book: "Book",
  spell_scroll: "Spell Scroll",
  tool: "Tool",
  trade_good: "Trade Good",
  junk: "Junk",
  trophy: "Trophy",
  cosmetic: "Cosmetic",
  housing: "Housing",
  container: "Container",
  event_item: "Event Item",
};

const VENDOR_STOCK = HARTHMERE_VENDOR_STOCK as Record<
  number,
  {
    vendorId: string;
    vendorName: string;
    stocks: { itemId: string; quantity: number; price: number }[];
    buys?: string[];
    buysStolenGoods?: boolean;
    baseSellModifier?: number;
    baseBuyModifier?: number;
    goldSupply?: number;
    restockHours?: number;
    refusesStolenGoods?: boolean;
    lawfulService?: boolean;
  }
>;

const QUEST_REWARDS: Record<
  string,
  {
    gold?: number;
    favor?: number;
    items?: { itemId: string; quantity?: number }[];
    materials?: Record<string, number>;
    keys?: string[];
    spells?: { spellId: string; source: string }[];
  }
> = {
  "welcome-to-harthmere": {
    gold: 20,
    favor: 5,
    items: [
      { itemId: "road_ration", quantity: 3 },
      { itemId: "repair_voucher", quantity: 1 },
    ],
  },
  "apples-for-dawnloaf": {
    gold: 12,
    favor: 10,
    items: [
      { itemId: "apple_tart", quantity: 4 },
      { itemId: "baker_apron", quantity: 1 },
    ],
  },
  "missing-lockbox": {
    gold: 25,
    favor: 8,
    keys: ["iron_key_blank"],
  },
  "cold-iron-hot-temper": {
    gold: 18,
    favor: 8,
    items: [{ itemId: "repair_voucher", quantity: 2 }],
    materials: { cold_iron_scrap: 8 },
  },
  "fever-tea": {
    gold: 10,
    favor: 12,
    items: [
      { itemId: "minor_healing_salve", quantity: 3 },
      { itemId: "chapel_candle", quantity: 2 },
    ],
    spells: [{ spellId: "candle_blessing_rank_1", source: "chapel quest" }],
  },
  "rumor-has-it": {
    gold: 8,
    favor: 5,
    items: [{ itemId: "copper_kettle_token", quantity: 2 }],
  },
  "loose-chickens": {
    gold: 8,
    favor: 6,
    materials: { fresh_egg: 6 },
  },
  "whispering-crate": {
    gold: 15,
    favor: 8,
    keys: ["river_knot_marker"],
  },
  "the-missing-bell": {
    gold: 30,
    favor: 20,
    items: [{ itemId: "old_bronze_bell_shard", quantity: 1 }],
    spells: [{ spellId: "candle_blessing_rank_1", source: "missing bell" }],
  },
};

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function addHarthmereInventoryItemCount(
  counts: Record<string, number>,
  itemId: string | undefined,
  quantity: number | undefined
) {
  if (!itemId) {
    return;
  }
  const count = Math.max(0, Math.floor(Number(quantity ?? 0)));
  if (count <= 0) {
    return;
  }
  counts[itemId] = (counts[itemId] ?? 0) + count;
}

function harthmereInventoryItemsForBiomesEcs(state: HarthmereInventoryState) {
  const items: Record<string, number> = {};
  for (const item of state.backpack.items) {
    addHarthmereInventoryItemCount(items, item.itemId, item.quantity);
  }
  for (const item of state.questPouch) {
    addHarthmereInventoryItemCount(items, item.itemId, item.quantity);
  }
  for (const [itemId, count] of Object.entries(state.materialStorage)) {
    addHarthmereInventoryItemCount(items, itemId, count);
  }
  return items;
}

function dispatchHarthmereInventoryBiomesEcsProjection(
  state: HarthmereInventoryState
) {
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_BIOMES_ECS_INVENTORY_UPDATED_EVENT, {
      detail: createHarthmereBiomesEcsInventory({
        gold: state.wallet.gold,
        items: harthmereInventoryItemsForBiomesEcs(state),
        maxItemSlots: state.backpack.maxSlots,
      }),
    })
  );
}

function inventoryEvent(state?: HarthmereInventoryState) {
  if (isBrowser()) {
    window.dispatchEvent(new Event(HARTHMERE_INVENTORY_EVENT));
    if (state) {
      if (!nativeBiomesEcsAuthorityEnabled()) {
        dispatchHarthmereInventoryBiomesEcsProjection(state);
      }
      window.dispatchEvent(
        new CustomEvent("biomes:live-mode-wallet-updated", {
          detail: { gold: Math.max(0, Math.floor(state.wallet.gold ?? 0)) },
        })
      );
    }
  }
}

// ---------------------------------------------------------------------------
// HARTHMERE_LIVE_INVENTORY_SNAPSHOT (audit fix, 2026-07-13)
//
// Module-level "last known live server inventory" so NON-React code (quest
// bridges, mission steps) can check what the player really owns. Root cause it
// fixes: the Road Ahead "Carry a Muck Buster" step only checked ECS items and
// the localStorage inventory — but in live-authoritative sessions the display
// deliberately drops localStorage (HARTHMERE_INVENTORY_SERVER_AUTHORITATIVE),
// so a tool acquired server-side could never complete the step (soft-lock).
// Every live inventory response that flows through this module records the
// actor's item counts here.
// ---------------------------------------------------------------------------

let lastKnownHarthmereLiveInventoryItems: Record<string, number> = {};
let lastKnownHarthmereLiveEquipment: Record<string, string> = {};
let lastKnownHarthmereLiveEquipmentInstances: Record<string, string> = {};

// Record the actor item counts from a live-mode response body (mutation or
// read). Accepts the standard `inventoryLootState.actor.items` shape and
// ignores anything else, so it is safe to call with any response.
export function recordHarthmereLiveInventoryItemsSnapshot(body: unknown) {
  const actor = (body as any)?.inventoryLootState?.actor;
  const items = actor?.items;
  if (!items || typeof items !== "object" || Array.isArray(items)) return;
  const next: Record<string, number> = {};
  for (const [itemId, count] of Object.entries(
    items as Record<string, unknown>
  )) {
    const safeCount = Math.max(0, Math.trunc(Number(count) || 0));
    if (safeCount > 0) next[itemId] = safeCount;
  }
  lastKnownHarthmereLiveInventoryItems = next;
  lastKnownHarthmereLiveEquipment = Object.fromEntries(
    Object.entries(actor?.equipment ?? {}).filter(
      ([slot, itemId]) =>
        typeof slot === "string" &&
        slot.length > 0 &&
        typeof itemId === "string" &&
        itemId.length > 0
    )
  ) as Record<string, string>;
  lastKnownHarthmereLiveEquipmentInstances = Object.fromEntries(
    Object.entries(actor?.equipmentInstances ?? {}).filter(
      ([slot, instanceId]) =>
        typeof slot === "string" &&
        slot.length > 0 &&
        typeof instanceId === "string" &&
        instanceId.length > 0
    )
  ) as Record<string, string>;
  if (isBrowser()) {
    window.dispatchEvent(new Event(HARTHMERE_LIVE_EQUIPMENT_EVENT));
  }
}

// How many of `itemId` the live server last reported the player owning.
// Returns 0 before any live response has been seen this session.
export function readHarthmereLiveInventoryItemCount(itemId: string): number {
  return Math.max(
    0,
    Math.trunc(Number(lastKnownHarthmereLiveInventoryItems[itemId] ?? 0))
  );
}

export function readHarthmereLiveEquipmentSnapshot() {
  return {
    equipment: { ...lastKnownHarthmereLiveEquipment },
    equipmentInstances: { ...lastKnownHarthmereLiveEquipmentInstances },
  };
}

// Test-only reset so unit tests can isolate snapshots.
export function resetHarthmereLiveInventoryItemsSnapshotForTest() {
  lastKnownHarthmereLiveInventoryItems = {};
  lastKnownHarthmereLiveEquipment = {};
  lastKnownHarthmereLiveEquipmentInstances = {};
}

export function syncHarthmereLiveWalletProjectionForTest(gold: unknown) {
  const numericGold = Number(gold);
  if (!isBrowser() || !Number.isFinite(numericGold)) {
    return false;
  }
  const normalizedGold = Math.max(0, Math.floor(numericGold));
  const current = readHarthmereInventoryState();
  if (current.wallet.gold === normalizedGold) {
    return false;
  }
  writeHarthmereInventoryState({
    ...current,
    wallet: { ...current.wallet, gold: normalizedGold },
  });
  return true;
}

function dispatchHarthmereLiveInventorySync(body: unknown) {
  if (!isBrowser()) return;
  // Keep the module-level live-inventory snapshot current for quest bridges.
  recordHarthmereLiveInventoryItemsSnapshot(body);
  const liveGold = Number((body as any)?.inventoryLootState?.actor?.gold);
  if (Number.isFinite(liveGold)) {
    syncHarthmereLiveWalletProjectionForTest(liveGold);
    window.dispatchEvent(
      new CustomEvent("biomes:live-mode-wallet-updated", {
        detail: { gold: Math.max(0, Math.floor(liveGold)) },
      })
    );
  }
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_LIVE_INVENTORY_SYNC_EVENT, {
      detail: { body },
    })
  );
}

async function parseHarthmereLiveMutationResponse(response: Response) {
  const body = await response.json().catch(() => undefined);
  if (!response.ok || body?.ok === false) {
    const validationErrors = Array.isArray(body?.validation?.errors)
      ? body.validation.errors.join(",")
      : undefined;
    throw new Error(
      validationErrors ||
        body?.message ||
        body?.error ||
        `harthmere_live_mutation_failed:${response.status}`
    );
  }
  return body;
}

/**
 * The live-mode route returns HTTP 200 for a transaction that was parsed and
 * persisted even when the requested gameplay mutation was rejected.  Callers
 * must therefore verify the authoritative write model, not merely `body.ok`,
 * before removing an item from a crate or applying another local projection.
 */
export function assertHarthmereLiveMutationAppliedForTest(
  body: any,
  requiredTouchedModel: string,
  rejectionPrefix: string
) {
  const mutation = body?.backendMutation;
  const warnings: string[] = Array.isArray(mutation?.warnings)
    ? mutation.warnings.map(String)
    : [];
  const touchedModels: string[] = Array.isArray(mutation?.touchedModels)
    ? mutation.touchedModels.map(String)
    : [];
  const rejection = warnings.find((warning) =>
    warning.startsWith(rejectionPrefix)
  );
  if (
    mutation?.applied !== true ||
    rejection ||
    !touchedModels.includes(requiredTouchedModel)
  ) {
    throw new Error(
      rejection ?? `harthmere_live_mutation_not_applied:${requiredTouchedModel}`
    );
  }
  return body;
}

function submitHarthmereInventoryMutationToLiveMode(
  operation: "grant" | "spend",
  itemId: string,
  quantity = 1,
  reason = operation === "grant" ? "Item received" : "Item spent"
) {
  if (
    !isBrowser() ||
    typeof window.fetch !== "function" ||
    !itemId ||
    quantity <= 0
  ) {
    return undefined;
  }
  const count = Math.max(1, Math.floor(Number(quantity) || 0));
  const directVoxelItemDeltas =
    operation === "grant" && /^b:\d+$/.test(itemId)
      ? { [itemId]: count }
      : undefined;
  return runHarthmereLiveMutationSerially("inventory-equipment", async () => {
    const requestId = `harthmere_local_inventory_${operation}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;
    const response = await fetchHarthmereLiveWithTimeout(
      window.fetch.bind(window),
      "/api/harthmere/live_mode",
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          idempotencyKey: requestId,
          actionKind:
            operation === "grant"
              ? "request_loot_roll"
              : "request_inventory_item_action",
          subsystem: "inventory",
          actorEntityVersion: 1,
          zoneId: "harthmere",
          payload:
            operation === "grant"
              ? {
                  itemId,
                  count,
                  ...(directVoxelItemDeltas
                    ? { itemDeltas: directVoxelItemDeltas }
                    : {}),
                  source: reason,
                }
              : {
                  operation: "destroy_item",
                  itemId,
                  count,
                  source: reason,
                },
          includeSnapshots: [
            "inventoryLootState",
            "farmingFoodState",
            "buildingState",
            "playerStatusState",
          ],
          clientClaims: {
            source: `local_harthmere_inventory_${operation}`,
            reason,
          },
        }),
      }
    );
    const body = await parseHarthmereLiveMutationResponse(response);
    assertHarthmereLiveMutationAppliedForTest(
      body,
      "inventory_items",
      operation === "grant" ? "loot_rejected:" : "inventory_item_rejected:"
    );
    if (body) dispatchHarthmereLiveInventorySync(body);
    return body;
  });
}

export function submitHarthmereVendorPurchaseToLiveModeForTest(
  offset: number,
  itemId: string,
  quantity: number,
  reason = "Vendor purchase"
) {
  const vendor = VENDOR_STOCK[offset];
  const count = Math.floor(Number(quantity) || 0);
  if (
    !isBrowser() ||
    typeof window.fetch !== "function" ||
    !vendor ||
    !itemId ||
    count <= 0
  ) {
    return undefined;
  }

  // One semantic purchase may be triggered by a pointer click, keyboard
  // activation, or a React replay.  Share the in-flight request so the server
  // sees exactly one idempotent transaction and the UI applies exactly one
  // confirmation.
  return runHarthmereLiveMutationOnce(
    `vendor-buy:${vendor.vendorId}:${itemId}`,
    () =>
      runHarthmereLiveMutationSerially("inventory-equipment", async () => {
        const requestId = `harthmere_vendor_buy_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}`;
        const response = await fetchHarthmereLiveWithTimeout(
          window.fetch.bind(window),
          "/api/harthmere/live_mode",
          {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requestId,
              idempotencyKey: requestId,
              actionKind: "request_vendor_transaction",
              subsystem: "vendor",
              actorEntityVersion: 1,
              zoneId: "harthmere",
              payload: {
                vendorId: vendor.vendorId,
                transactionKind: "buy",
                itemId,
                count,
              },
              includeSnapshots: [
                "economyState",
                "inventoryLootState",
                "playerStatusState",
                "bankingState",
              ],
              clientClaims: {
                source: "harthmere_biomes_ui_vendor_store",
                reason,
              },
            }),
          }
        );
        const body = await parseHarthmereLiveMutationResponse(response);

        // A rejected transaction still contains the authoritative inventory
        // and wallet.  Publish it before surfacing the rejection so stale
        // browser state cannot keep advertising gold or space the player does
        // not actually have.
        if (body) dispatchHarthmereLiveInventorySync(body);
        assertHarthmereLiveMutationAppliedForTest(
          body,
          "inventory_items",
          "vendor_rejected:"
        );
        return body;
      })
  );
}

export function submitHarthmereInventoryGrantToLiveModeForTest(
  itemId: string,
  quantity = 1,
  reason = "Item received"
) {
  return submitHarthmereInventoryMutationToLiveMode(
    "grant",
    itemId,
    quantity,
    reason
  );
}

export function submitHarthmereContainerTransferToLiveModeForTest(
  transferKey: string,
  items: ReadonlyArray<{ itemId: string; quantity: number }>,
  reason = "Container contents"
) {
  if (!isBrowser() || typeof window.fetch !== "function") return undefined;
  const itemRecord: Record<string, number> = {};
  for (const item of items) {
    const itemId = String(item.itemId);
    const quantity = Math.max(0, Math.trunc(Number(item.quantity) || 0));
    if (!itemId || quantity <= 0) continue;
    itemRecord[itemId] = (itemRecord[itemId] ?? 0) + quantity;
  }
  if (Object.keys(itemRecord).length === 0) return undefined;
  return runHarthmereLiveMutationOnce(`container-transfer:${transferKey}`, () =>
    runHarthmereLiveMutationSerially("inventory-equipment", async () => {
      const requestId = `harthmere_container_transfer_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;
      const response = await fetchHarthmereLiveWithTimeout(
        window.fetch.bind(window),
        "/api/harthmere/live_mode",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId,
            idempotencyKey: requestId,
            actionKind: "request_container_transfer",
            subsystem: "inventory",
            actorEntityVersion: 1,
            zoneId: "harthmere",
            payload: { items: itemRecord, source: reason },
            includeSnapshots: [
              "inventoryLootState",
              "questState",
              "playerStatusState",
            ],
            clientClaims: {
              source: "harthmere_object_container",
              reason,
            },
          }),
        }
      );
      const body = await parseHarthmereLiveMutationResponse(response);
      assertHarthmereLiveMutationAppliedForTest(
        body,
        "container_transfer",
        "container_transfer_rejected:"
      );
      if (body) dispatchHarthmereLiveInventorySync(body);
      return body;
    })
  );
}

// Server-authoritative DEBIT of an item from the live-mode inventory. Mirror of
// submitHarthmereInventoryGrantToLiveModeForTest, but removes items instead of
// granting them. Uses `request_inventory_item_action` with operation
// "destroy_item" — the client-authorized removal path (request_inventory_mutation
// requires server authority and would be rejected). Routes through the same
// shared live fetch wrapper so it carries the sticky install id and lands on
// the SAME actor the reads use.
export function submitHarthmereInventorySpendToLiveModeForTest(
  itemId: string,
  quantity = 1,
  reason = "Item spent"
) {
  return submitHarthmereInventoryMutationToLiveMode(
    "spend",
    itemId,
    quantity,
    reason
  );
}

function instanceId(itemId: string) {
  return `hm-${itemId}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function fallbackInventoryGlyph(itemId: string, fallback = "IT") {
  const letters = itemId.match(/[A-Za-z0-9]/g)?.join("") ?? "";
  return (letters.slice(0, 2).toUpperCase() || fallback).padEnd(2, " ");
}

function readableNativeItemName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value.trim();
  if (!name || /^(?:\?+|unknown(?: item)?|item)$/i.test(name)) {
    return undefined;
  }
  return name;
}

function humanizeHarthmereSemanticItemId(itemId: string | undefined) {
  const value = itemId?.replace(/^b:/, "").trim();
  if (!value) return undefined;
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

let authoritativeHarthmerePresentationCatalogueReady = false;

function authoritativeHarthmereItemDefinition(
  itemId: string,
  biomesId: ReturnType<typeof safeParseBiomesId>
) {
  if (!authoritativeHarthmerePresentationCatalogueReady) {
    // Vendor and crafting registration is the server-authoritative source for
    // names, categories, descriptions and stack rules. Bikkie remains the
    // source for native identity, actions and authored presentation assets.
    ensureHarthmereProductionVendorCatalog();
    ensureHarthmereProductionCraftingCatalogue();
    authoritativeHarthmerePresentationCatalogueReady = true;
  }
  const strippedItemId = itemId.replace(/^b:/, "");
  const semanticItemId = biomesId
    ? harthmereNativeItemIdForBiomesId(biomesId)
    : undefined;
  for (const candidate of [
    itemId,
    strippedItemId,
    `b:${strippedItemId}`,
    semanticItemId,
  ]) {
    if (!candidate) continue;
    const definition = getAuthoritativeHarthmereItemDefinition(candidate);
    if (!definition) continue;
    // The Chapter 1 plot items rename themselves at the consolidation. The
    // shared registry holds one static name for every player, so the per-player
    // reveal is applied here, as presentation, over the authoritative row.
    if (isChapter1RevealableItem(definition.itemId)) {
      ensureChapter1RevealLoaded();
      const revealedName = chapter1RevealedItemName(definition.itemId);
      const revealedDescription = chapter1RevealedItemDescription(
        definition.itemId
      );
      if (
        (revealedName && revealedName !== definition.displayName) ||
        (revealedDescription && revealedDescription !== definition.description)
      ) {
        return {
          ...definition,
          displayName: revealedName ?? definition.displayName,
          description: revealedDescription ?? definition.description,
        };
      }
    }
    return definition;
  }
  return undefined;
}

function localCategoryForAuthoritativeItem(
  definition: AuthoritativeHarthmereItemDefinition
): HarthmereItemCategory {
  if (definition.isQuestItem) return "quest_item";
  if (definition.isCurrency) return "currency";
  if (definition.isSpellTome) return "spell_scroll";
  if (definition.isConsumable) return "consumable";
  const category = definition.category?.trim().toLowerCase();
  switch (category) {
    case "weapon":
    case "armor":
    case "accessory":
    case "consumable":
    case "food":
    case "drink":
    case "quest_item":
    case "currency":
    case "key":
    case "book":
    case "spell_scroll":
    case "tool":
    case "trade_good":
    case "junk":
    case "trophy":
    case "cosmetic":
    case "housing":
    case "container":
    case "event_item":
      return category;
    case "material":
    case "materials":
    case "crafting_material":
      return "crafting_material";
    default:
      return definition.isCraftingMaterial ? "crafting_material" : "trade_good";
  }
}

function authoritativeHarthmereItemGlyph(
  definition: AuthoritativeHarthmereItemDefinition
) {
  const category = localCategoryForAuthoritativeItem(definition);
  const text = `${definition.itemId} ${definition.displayName} ${
    definition.description ?? ""
  } ${definition.category ?? ""}`.toLowerCase();
  if (/watering can|waterplant/.test(text)) return "💧";
  if (/\bhoe\b|\btill\b/.test(text)) return "⛏";
  if (/\bbucket\b/.test(text)) return "🪣";
  if (/\baxe\b|woodcutter/.test(text)) return "🪓";
  if (/pickaxe|\bpick\b|mining/.test(text)) return "⛏️";
  if (/fishing|\brod\b/.test(text)) return "🎣";
  if (/hammer|mallet|repair/.test(text)) return "🔨";
  if (/wand|arcane|magic|spell|rune/.test(text)) return "✦";
  if (category === "tool") return "🛠️";
  if (category === "weapon") return "⚔";
  if (category === "armor" || category === "cosmetic") return "◈";
  if (category === "food") return "🍎";
  if (category === "drink") return "🥤";
  if (category === "consumable") return "✚";
  if (category === "key") return "🗝";
  if (category === "book" || category === "spell_scroll") return "📜";
  if (category === "currency") return "●";
  if (category === "container") return "▣";
  return harthmereResourceIconForItem({
    id: definition.itemId,
    name: definition.displayName,
    category,
    subtype: definition.category ?? "harthmere_item",
    quality: "common",
    icon: "◇",
    stackable: definition.maxStackSize > 1,
    maxStack: Math.max(1, definition.maxStackSize),
    bindType: "unbound",
    baseValue: definition.baseValue,
    description: definition.description ?? "An item from the Harthmere world.",
  });
}

function authoritativeHarthmereItemDescription(
  definition: AuthoritativeHarthmereItemDefinition
) {
  const authoredDescription = definition.description?.trim();
  if (authoredDescription) return authoredDescription;
  const visualDescription =
    definition.objectMetadata?.visualDescription?.trim();
  if (visualDescription) return visualDescription;
  const category = localCategoryForAuthoritativeItem(definition);
  const text = `${definition.itemId} ${definition.displayName}`.toLowerCase();
  if (/\bhoe\b/.test(text)) {
    return "A farming tool for tilling dirt and grass voxels into plantable soil.";
  }
  if (/watering can/.test(text)) {
    return "A farming tool for watering planted crops through the native farming system.";
  }
  if (/\bbucket\b/.test(text)) {
    return "A utility bucket for carrying water and supporting farm work.";
  }
  if (category === "tool") {
    return `A Harthmere tool used for ${definition.displayName.toLowerCase()} work.`;
  }
  if (category === "weapon") {
    return "A Harthmere weapon with native combat and hotbar behavior.";
  }
  if (category === "armor" || category === "cosmetic") {
    return "A Harthmere wearable rendered and equipped through the native item system.";
  }
  if (category === "crafting_material") {
    return "A Harthmere material used by crafting, vendors, and world projects.";
  }
  if (category === "food" || category === "drink") {
    return "A Harthmere provision that can be carried and consumed from inventory.";
  }
  if (category === "consumable") {
    return "A Harthmere consumable with native inventory behavior.";
  }
  return "An item from the Harthmere world.";
}

function dynamicBiomesItemIcon(
  item: ReturnType<typeof anItem>,
  itemId: string
): string | undefined {
  if (!item) {
    return undefined;
  }
  try {
    if (item.icon) {
      return staticUrlForAttribute(
        resolveBinaryAttribute(item.icon as AnyBinaryAttribute, item)
      );
    }
    if (item.galoisIcon) {
      const url = resolveAssetUrlUntyped(`icons/${item.galoisIcon}`);
      if (url) return url;
    }
    if (item.galoisPath) {
      const url = resolveAssetUrlUntyped(`icons/${item.galoisPath}`);
      if (url) return url;
    }
    if (item.groupId) {
      return `/api/environment_group/${item.groupId}/thumbnail`;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function dynamicBiomesItemDefinition(
  itemId: string
): HarthmereItemDefinition | undefined {
  const biomesId = safeParseBiomesId(itemId.replace(/^b:/, ""));
  if (!biomesId) {
    return undefined;
  }
  const canonicalItemId = `b:${biomesId}`;
  const item = anItem(biomesId);
  const semanticItemId = harthmereNativeItemIdForBiomesId(biomesId);
  const semanticDefinition = semanticItemId
    ? ITEM_DEFINITIONS[semanticItemId]
    : undefined;
  const authoritative = authoritativeHarthmereItemDefinition(itemId, biomesId);
  const nativeWearableSlot =
    findItemEquippableSlot(item) ??
    (biomesId === BikkieIds.muckyTop
      ? BikkieIds.top
      : biomesId === BikkieIds.muckySkirt
      ? BikkieIds.bottoms
      : undefined);
  const equipmentSlot: EquipmentSlot | undefined = (() => {
    switch (nativeWearableSlot) {
      case BikkieIds.hat:
      case BikkieIds.head:
      case BikkieIds.hair:
      case BikkieIds.face:
      case BikkieIds.ears:
        return "head";
      case BikkieIds.top:
        return "chest";
      case BikkieIds.bottoms:
        return "legs";
      case BikkieIds.feet:
        return "feet";
      case BikkieIds.hands:
        return "hands";
      case BikkieIds.outerwear:
        return "back";
      case BikkieIds.neck:
        return "neck";
      default:
        return undefined;
    }
  })();
  const stackable = Number(
    authoritative?.maxStackSize ??
      semanticDefinition?.maxStack ??
      item?.stackable ??
      (item?.isBlock ? 99n : 1n)
  );
  const isStackable = Number.isFinite(stackable) && stackable > 1;
  const name =
    readableNativeItemName(item?.displayName) ??
    readableNativeItemName(authoritative?.displayName) ??
    readableNativeItemName(semanticDefinition?.name) ??
    humanizeHarthmereSemanticItemId(semanticItemId) ??
    (item?.isBlock ? `Biomes Block ${biomesId}` : `Biomes Item ${biomesId}`);
  const category = authoritative
    ? localCategoryForAuthoritativeItem(authoritative)
    : semanticDefinition
    ? semanticDefinition.category
    : item?.isBlock
    ? "crafting_material"
    : equipmentSlot
    ? "armor"
    : "trade_good";
  const icon =
    dynamicBiomesItemIcon(item, canonicalItemId) ??
    semanticDefinition?.icon ??
    (authoritative
      ? authoritativeHarthmereItemGlyph(authoritative)
      : undefined) ??
    fallbackInventoryGlyph(name);
  return {
    id: canonicalItemId,
    name,
    category,
    subtype: authoritative
      ? `harthmere_${category}`
      : semanticDefinition?.subtype ??
        (item?.isBlock
          ? "biomes_voxel_block"
          : equipmentSlot
          ? "biomes_wearable"
          : "biomes_item"),
    quality: semanticDefinition?.quality ?? "common",
    icon,
    stackable: isStackable,
    maxStack: isStackable ? Math.max(2, Math.trunc(stackable)) : 1,
    slot: equipmentSlot ?? semanticDefinition?.slot,
    requiredLevel:
      authoritative?.levelRequirement ?? semanticDefinition?.requiredLevel,
    bindType:
      authoritative?.binding === "on_pickup"
        ? "bind_on_pickup"
        : authoritative?.binding === "on_equip"
        ? "bind_on_equip"
        : authoritative?.binding === "quest"
        ? "quest_bound"
        : semanticDefinition?.bindType ?? "unbound",
    baseValue: authoritative?.baseValue ?? semanticDefinition?.baseValue ?? 0,
    durabilityMax:
      authoritative?.durabilityMax ?? semanticDefinition?.durabilityMax,
    description:
      (authoritative
        ? authoritativeHarthmereItemDescription(authoritative)
        : undefined) ??
      semanticDefinition?.description ??
      (item?.isBlock
        ? "A mined Biomes voxel block saved from the world."
        : "A Biomes item saved from the world."),
  };
}

// Biomes block/item ids are data-driven, so they cannot all live in the static
// Harthmere item table. Generate a display definition on demand and keep the
// canonical `b:<id>` key that Cloud Save and BiomesUI both understand.
function itemDef(itemId: string): HarthmereItemDefinition | undefined {
  const staticDefinition = ITEM_DEFINITIONS[itemId];
  if (staticDefinition) return staticDefinition;
  const authoritative = authoritativeHarthmereItemDefinition(itemId, undefined);
  if (authoritative) {
    const category = localCategoryForAuthoritativeItem(authoritative);
    const stackable = authoritative.maxStackSize > 1;
    const definition: HarthmereItemDefinition = {
      id: itemId,
      name: authoritative.displayName,
      category,
      subtype: authoritative.category ?? `harthmere_${category}`,
      quality: "common",
      icon: authoritativeHarthmereItemGlyph(authoritative),
      stackable,
      maxStack: stackable ? authoritative.maxStackSize : 1,
      requiredLevel: authoritative.levelRequirement,
      bindType:
        authoritative.binding === "on_pickup"
          ? "bind_on_pickup"
          : authoritative.binding === "on_equip"
          ? "bind_on_equip"
          : authoritative.binding === "quest"
          ? "quest_bound"
          : "unbound",
      baseValue: authoritative.baseValue,
      durabilityMax: authoritative.durabilityMax,
      description: authoritativeHarthmereItemDescription(authoritative),
    };
    return definition;
  }
  return dynamicBiomesItemDefinition(itemId);
}

// HARTHMERE_OBJECT_CONTAINER_UI:
// Lightweight, read-only view of an item definition for surfaces that render
// item rows/slots outside this module (e.g. the world-object container panel).
// Keeps the full ITEM_DEFINITIONS map private while letting other components
// show an item's name, icon, category and stack rules.
export interface HarthmereItemDisplay {
  id: string;
  name: string;
  icon: string;
  category: HarthmereItemCategory;
  quality: HarthmereItemQuality;
  description: string;
  stackable: boolean;
  maxStack: number;
  slot?: string;
  bikkieWearableSlot?: number;
  bikkieWearableItemId?: number;
  canEquip: boolean;
  canUse: boolean;
  hotbarEligible: boolean;
  useEffectType?: string;
}

function itemDefinitionHotbarEligible(def: HarthmereItemDefinition) {
  if (def.hotbarEligible !== undefined) return def.hotbarEligible;
  return (
    def.category === "consumable" ||
    def.category === "food" ||
    def.category === "weapon" ||
    def.category === "tool" ||
    def.category === "spell_scroll" ||
    def.useEffect !== undefined ||
    def.subtype === "biomes_voxel_block"
  );
}

export function harthmereItemHotbarEligible(itemId: string) {
  const def = itemDef(itemId);
  return Boolean(def && itemDefinitionHotbarEligible(def));
}

export function harthmereItemThrowable(itemId: string) {
  return itemDef(itemId)?.throwable === true;
}

export function getHarthmereItemDisplay(
  itemId: string
): HarthmereItemDisplay | undefined {
  const def = itemDef(itemId);
  if (!def) {
    return undefined;
  }
  const wearable = harthmereLocalItemBikkieWearable(def.id);
  return {
    id: def.id,
    name: def.name,
    icon: def.icon,
    category: def.category,
    quality: def.quality,
    description: def.description,
    stackable: def.stackable,
    maxStack: def.maxStack,
    slot: def.slot,
    bikkieWearableSlot: wearable ? Number(wearable.slot) : undefined,
    bikkieWearableItemId: wearable ? Number(wearable.itemId) : undefined,
    canEquip: Boolean(def.slot),
    canUse: Boolean(def.useEffect),
    hotbarEligible: itemDefinitionHotbarEligible(def),
    useEffectType: def.useEffect?.type,
  };
}

function hotbarSlotKeyForBiomesUI(index: number) {
  const clamped = Math.max(0, Math.min(8, Math.trunc(index)));
  return `slot_${clamped + 1}`;
}

function hasHarthmereHotbarAssignableItem(
  state: HarthmereInventoryState,
  itemId: string
) {
  return (
    state.backpack.items.some((item) => item.itemId === itemId) ||
    state.questPouch.some((item) => item.itemId === itemId) ||
    (state.materialStorage[itemId] ?? 0) > 0 ||
    Object.values(state.equipment).some((item) => item?.itemId === itemId)
  );
}

export function performHarthmereHotbarAssignForBiomesUI(
  itemId: string,
  hotbarIndex: number,
  allowKnownItem = false
) {
  const state = readHarthmereInventoryState();
  if (
    !harthmereItemHotbarEligible(itemId) ||
    (!allowKnownItem && !hasHarthmereHotbarAssignableItem(state, itemId))
  ) {
    return false;
  }
  writeHarthmereInventoryState({
    ...state,
    hotbar: {
      ...state.hotbar,
      [hotbarSlotKeyForBiomesUI(hotbarIndex)]: itemId,
    },
  });
  return true;
}

export function performHarthmereMaterialStorageRemoveForBiomesUI(
  itemId: string,
  count = 1
) {
  const state = readHarthmereInventoryState();
  const removeCount = Math.max(1, Math.trunc(Number(count) || 1));
  const available = Math.max(0, Number(state.materialStorage[itemId] ?? 0));
  const removed = Math.min(available, removeCount);
  if (removed <= 0) {
    return 0;
  }
  const nextMaterialStorage = { ...state.materialStorage };
  const remaining = available - removed;
  if (remaining <= 0) {
    delete nextMaterialStorage[itemId];
  } else {
    nextMaterialStorage[itemId] = remaining;
  }
  writeHarthmereInventoryState({
    ...state,
    materialStorage: nextMaterialStorage,
  });
  return removed;
}

export function performHarthmereHotbarSlotMoveForBiomesUI(
  fromHotbarIndex: number,
  toHotbarIndex: number
) {
  if (
    !Number.isInteger(fromHotbarIndex) ||
    !Number.isInteger(toHotbarIndex) ||
    fromHotbarIndex < 0 ||
    fromHotbarIndex > 8 ||
    toHotbarIndex < 0 ||
    toHotbarIndex > 8 ||
    fromHotbarIndex === toHotbarIndex
  ) {
    return false;
  }
  const state = readHarthmereInventoryState();
  const fromKey = hotbarSlotKeyForBiomesUI(fromHotbarIndex);
  const toKey = hotbarSlotKeyForBiomesUI(toHotbarIndex);
  const nextHotbar = { ...state.hotbar };
  const fromItemId = nextHotbar[fromKey];
  nextHotbar[fromKey] = nextHotbar[toKey];
  nextHotbar[toKey] = fromItemId;
  writeHarthmereInventoryState({ ...state, hotbar: nextHotbar });
  return true;
}

export function performHarthmereHotbarClearForBiomesUI(hotbarIndex: number) {
  const state = readHarthmereInventoryState();
  const key = hotbarSlotKeyForBiomesUI(hotbarIndex);
  if (!state.hotbar[key]) {
    return false;
  }
  const nextHotbar = { ...state.hotbar, [key]: undefined };
  writeHarthmereInventoryState({ ...state, hotbar: nextHotbar });
  return true;
}

function makeItemInstance(
  itemId: string,
  quantity = 1,
  location: HarthmereStorageLocation = "backpack"
): HarthmereItemInstance {
  const def = itemDef(itemId);
  if (!def) {
    throw new Error(`Unknown Harthmere inventory item: ${itemId}`);
  }
  return {
    instanceId: instanceId(itemId),
    itemId,
    location,
    quantity,
    durability: def.durabilityMax,
    bound: ["bind_on_pickup", "quest_bound", "account_bound"].includes(
      def.bindType
    ),
    stolen: false,
    locked: def.category === "quest_item" || def.quality === "legendary",
    enchantments: [],
    acquiredAt: Date.now(),
  };
}

function appendLog(
  state: HarthmereInventoryState,
  action: string,
  detail: string
): HarthmereInventoryState {
  return {
    ...state,
    recent: [
      {
        id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        at: Date.now(),
        system: "inventory",
        actorId: "local-player",
        action,
        detail,
        reason: action,
        success: !/^(cannot|not enough|failed|blocked)/i.test(action),
      } as HarthmereInventoryLogEntry,
      ...state.recent,
    ].slice(0, 18),
  };
}

function emptyState(): HarthmereInventoryState {
  return {
    version: 1,
    backpack: {
      maxSlots: PLAYER_INVENTORY_SLOTS,
      items: [
        makeItemInstance("iron_longsword", 1, "backpack"),
        makeItemInstance("minor_healing_salve", 3, "backpack"),
        makeItemInstance("field_revival_scroll", 1, "backpack"),
        makeItemInstance("road_ration", 5, "backpack"),
        makeItemInstance("cracked_mug", 2, "backpack"),
      ],
    },
    equipment: {},
    questPouch: [],
    materialStorage: { cold_iron_scrap: 2, fresh_egg: 0 },
    keyring: [],
    wallet: {
      gold: 75,
      silver: 0,
      copper: 0,
      harthmere_favor: 0,
      black_market_coins: 0,
      guild_marks: 0,
      bounty_tokens: 0,
      crafting_writs: 0,
      festival_tokens: 0,
      dungeon_tokens: 0,
      pvp_marks: 0,
    },
    spellbook: {
      knownSpells: [],
      activeSpellSlots: {
        slot_1: undefined,
        slot_2: undefined,
        slot_3: undefined,
        slot_4: undefined,
      },
      passiveSlots: {
        passive_1: undefined,
      },
    },
    bank: { maxSlots: 48, items: [] },
    hotbar: {
      slot_1: undefined,
      slot_2: undefined,
      slot_3: undefined,
      slot_4: undefined,
    },
    recent: [
      {
        id: "starter-kit",
        at: Date.now(),
        system: "inventory",
        actorId: "local-player",
        action: "Inventory Ready",
        detail:
          "Starter backpack, wallet, equipment slots, quest pouch, material storage, keyring, and spellbook initialized.",
        reason: "starter-state",
        success: true,
      },
    ],
  };
}

function normalizeInstance(
  raw: Partial<HarthmereItemInstance>,
  fallbackLocation: HarthmereStorageLocation
): HarthmereItemInstance | undefined {
  if (!raw.itemId) {
    return undefined;
  }
  const def = itemDef(raw.itemId);
  if (!def) {
    return undefined;
  }
  return {
    instanceId: raw.instanceId ?? instanceId(raw.itemId),
    itemId: raw.itemId,
    location: raw.location ?? fallbackLocation,
    slotIndex: raw.slotIndex,
    equipmentSlot: raw.equipmentSlot,
    quantity: Math.min(
      def.maxStack,
      Math.max(1, nonNegativeInt(raw.quantity, 1))
    ),
    durability:
      typeof def.durabilityMax === "number"
        ? Math.min(
            def.durabilityMax,
            nonNegativeInt(raw.durability, def.durabilityMax)
          )
        : undefined,
    bound: raw.bound ?? false,
    stolen: raw.stolen ?? false,
    locked: raw.locked ?? false,
    createdBy: raw.createdBy,
    enchantments: raw.enchantments ?? [],
    expiration: raw.expiration,
    customName: raw.customName,
    acquiredAt: raw.acquiredAt ?? Date.now(),
  };
}

function normalizeState(raw?: Partial<HarthmereInventoryState>) {
  const fallback = emptyState();
  const backpackMaxSlots = Math.max(
    PLAYER_INVENTORY_SLOTS,
    Number(raw?.backpack?.maxSlots ?? fallback.backpack.maxSlots)
  );
  const backpackItems = (raw?.backpack?.items ?? fallback.backpack.items)
    .map((item) => normalizeInstance(item, "backpack"))
    .filter((item): item is HarthmereItemInstance => Boolean(item));
  const bankItems = (raw?.bank?.items ?? [])
    .map((item) => normalizeInstance(item, "bank"))
    .filter((item): item is HarthmereItemInstance => Boolean(item));
  const questPouch = (raw?.questPouch ?? [])
    .map((item) => normalizeInstance(item, "quest_pouch"))
    .filter((item): item is HarthmereItemInstance => Boolean(item));
  const equipment: Partial<Record<EquipmentSlot, HarthmereItemInstance>> = {};
  for (const [slot, item] of Object.entries(raw?.equipment ?? {})) {
    const normalized = normalizeInstance(item ?? {}, "equipment");
    if (normalized) {
      equipment[slot as EquipmentSlot] = {
        ...normalized,
        location: "equipment",
        equipmentSlot: slot as EquipmentSlot,
      };
    }
  }

  return {
    version: 1 as const,
    backpack: {
      maxSlots: backpackMaxSlots,
      items: backpackItems.slice(0, backpackMaxSlots),
    },
    equipment,
    questPouch,
    materialStorage: normalizeHarthmereNumberMap({
      ...fallback.materialStorage,
      ...(raw?.materialStorage ?? {}),
    }),
    keyring: Array.from(new Set(raw?.keyring ?? [])),
    wallet: normalizeHarthmereWallet({
      ...fallback.wallet,
      ...(raw?.wallet ?? {}),
    }),
    spellbook: {
      knownSpells: raw?.spellbook?.knownSpells ?? [],
      activeSpellSlots: {
        ...fallback.spellbook.activeSpellSlots,
        ...(raw?.spellbook?.activeSpellSlots ?? {}),
      },
      passiveSlots: {
        ...fallback.spellbook.passiveSlots,
        ...(raw?.spellbook?.passiveSlots ?? {}),
      },
    },
    bank: {
      maxSlots: raw?.bank?.maxSlots ?? fallback.bank.maxSlots,
      items: bankItems.slice(0, raw?.bank?.maxSlots ?? fallback.bank.maxSlots),
    },
    hotbar: {
      ...fallback.hotbar,
      ...(raw?.hotbar ?? {}),
    },
    recent: (raw?.recent ?? fallback.recent).slice(0, 18),
    lastVendor: raw?.lastVendor,
  };
}

export function readHarthmereInventoryState(): HarthmereInventoryState {
  if (!isBrowser()) {
    return emptyState();
  }
  try {
    const raw = harthmereLocalStorage.getItem(HARTHMERE_INVENTORY_STATE_KEY);
    if (!raw) {
      return emptyState();
    }
    return normalizeState(JSON.parse(raw) as Partial<HarthmereInventoryState>);
  } catch {
    return emptyState();
  }
}

export function writeHarthmereInventoryState(state: HarthmereInventoryState) {
  if (!isBrowser()) {
    return;
  }
  const normalized = normalizeState(state);
  harthmereLocalStorage.setItem(
    HARTHMERE_INVENTORY_STATE_KEY,
    JSON.stringify(normalized)
  );
  inventoryEvent(normalized);
}

function stackCompatible(a: HarthmereItemInstance, b: HarthmereItemInstance) {
  return (
    a.itemId === b.itemId &&
    a.bound === b.bound &&
    a.stolen === b.stolen &&
    a.locked === b.locked &&
    a.durability === b.durability &&
    a.expiration === b.expiration &&
    a.enchantments.join("|") === b.enchantments.join("|")
  );
}

function insertBackpackItem(
  state: HarthmereInventoryState,
  itemId: string,
  quantity = 1
): { state: HarthmereInventoryState; added: number; overflow: number } {
  const def = itemDef(itemId);
  if (!def || quantity <= 0) {
    return { state, added: 0, overflow: quantity };
  }

  let remaining = quantity;
  // Clone every item before attempting a stack merge.  This function is also
  // used for capacity preflight, so mutating the original item objects here
  // could silently grant quantity even when the purchase was later rejected.
  let items = state.backpack.items.map((item) => ({
    ...item,
    enchantments: [...item.enchantments],
  }));

  if (def.stackable) {
    const incomingStack = makeItemInstance(itemId, 1, "backpack");
    for (const item of items) {
      if (item.itemId !== itemId || !stackCompatible(item, incomingStack)) {
        continue;
      }
      const room = def.maxStack - item.quantity;
      if (room <= 0) {
        continue;
      }
      const move = Math.min(room, remaining);
      item.quantity += move;
      remaining -= move;
      if (remaining <= 0) {
        break;
      }
    }
  }

  while (remaining > 0 && items.length < state.backpack.maxSlots) {
    const move = def.stackable ? Math.min(def.maxStack, remaining) : 1;
    items = [...items, makeItemInstance(itemId, move, "backpack")];
    remaining -= move;
  }

  const next = {
    ...state,
    backpack: { ...state.backpack, items },
  };
  return { state: next, added: quantity - remaining, overflow: remaining };
}

function addItemByStorageRules(
  state: HarthmereInventoryState,
  itemId: string,
  quantity = 1
): { state: HarthmereInventoryState; added: number; overflow: number } {
  const def = itemDef(itemId);
  if (!def) {
    return { state, added: 0, overflow: quantity };
  }

  if (def.category === "crafting_material") {
    return {
      state: {
        ...state,
        materialStorage: {
          ...state.materialStorage,
          [itemId]: (state.materialStorage[itemId] ?? 0) + quantity,
        },
      },
      added: quantity,
      overflow: 0,
    };
  }

  if (def.category === "quest_item") {
    const alreadyHas = state.questPouch.some((item) => item.itemId === itemId);
    if (alreadyHas && !def.stackable) {
      return { state, added: 0, overflow: quantity };
    }
    return {
      state: {
        ...state,
        questPouch: [
          ...state.questPouch,
          makeItemInstance(itemId, quantity, "quest_pouch"),
        ],
      },
      added: quantity,
      overflow: 0,
    };
  }

  if (def.category === "key") {
    return {
      state: {
        ...state,
        keyring: Array.from(new Set([...state.keyring, itemId])),
      },
      added: quantity,
      overflow: 0,
    };
  }

  return insertBackpackItem(state, itemId, quantity);
}

// HARTHMERE_QUEST_ITEM_FLOW:
// Count how many of a given item id the player holds across all relevant
// storage locations (backpack, quest pouch, material storage). Quest steps
// that "require" an item check this before allowing the Complete action.
export function harthmereInventoryCountByItemId(itemId: string): number {
  const state = readHarthmereInventoryState();
  let total = 0;
  for (const item of state.backpack.items) {
    if (item.itemId === itemId) {
      total += item.quantity;
    }
  }
  for (const item of state.questPouch) {
    if (item.itemId === itemId) {
      total += item.quantity;
    }
  }
  if (state.materialStorage?.[itemId]) {
    total += state.materialStorage[itemId];
  }
  return total;
}

// HARTHMERE_QUEST_ITEM_FLOW:
// Remove `quantity` of `itemId` from the player's inventory, preferring the
// quest pouch (where mid-quest items normally land) and falling back to the
// backpack and material storage. Returns the number actually removed.
export function consumeHarthmereItemByItemId(
  itemId: string,
  quantity = 1,
  reason = "Quest step turn-in"
): number {
  if (quantity <= 0) {
    return 0;
  }
  let state = readHarthmereInventoryState();
  let remaining = quantity;

  // Quest pouch first (where mid-quest items live).
  const pouch = [...state.questPouch];
  for (let index = 0; index < pouch.length && remaining > 0; index += 1) {
    if (pouch[index].itemId !== itemId) {
      continue;
    }
    const take = Math.min(remaining, pouch[index].quantity);
    pouch[index] = { ...pouch[index], quantity: pouch[index].quantity - take };
    remaining -= take;
  }
  const trimmedPouch = pouch.filter((item) => item.quantity > 0);
  if (trimmedPouch.length !== state.questPouch.length || remaining < quantity) {
    state = { ...state, questPouch: trimmedPouch };
  }

  // Backpack next.
  if (remaining > 0) {
    const items = [...state.backpack.items];
    for (let index = 0; index < items.length && remaining > 0; index += 1) {
      if (items[index].itemId !== itemId) {
        continue;
      }
      const take = Math.min(remaining, items[index].quantity);
      items[index] = {
        ...items[index],
        quantity: items[index].quantity - take,
      };
      remaining -= take;
    }
    const trimmedItems = items.filter((item) => item.quantity > 0);
    state = { ...state, backpack: { ...state.backpack, items: trimmedItems } };
  }

  // Material storage last.
  if (remaining > 0 && state.materialStorage?.[itemId]) {
    const have = state.materialStorage[itemId];
    const take = Math.min(remaining, have);
    const nextMaterial = { ...state.materialStorage };
    if (have - take <= 0) {
      delete nextMaterial[itemId];
    } else {
      nextMaterial[itemId] = have - take;
    }
    state = { ...state, materialStorage: nextMaterial };
    remaining -= take;
  }

  const consumed = quantity - remaining;
  if (consumed > 0) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        reason,
        `${itemDef(itemId)?.name ?? itemId} x${consumed} consumed.`
      )
    );
  }
  return consumed;
}

export function grantHarthmereItemLocallyForTest(
  itemId: string,
  quantity = 1,
  reason = "Item received"
): { added: number; overflow: number } {
  const def = itemDef(itemId);
  if (!def) {
    return { added: 0, overflow: quantity };
  }
  const current = readHarthmereInventoryState();
  const { state, added, overflow } = addItemByStorageRules(
    current,
    itemId,
    quantity
  );
  const next = appendLog(
    state,
    reason,
    overflow > 0
      ? `${def.name}: added ${added}, overflow ${overflow}. Normal items need backpack space; quest items/materials/keys route to special storage.`
      : `${def.name} x${added} added to ${storageLabelForCategory(
          def.category
        )}.`
  );
  writeHarthmereInventoryState(next);
  return { added, overflow };
}

export function grantHarthmereItem(
  itemId: string,
  quantity = 1,
  reason = "Item received"
): { added: number; overflow: number } {
  const result = grantHarthmereItemLocallyForTest(itemId, quantity, reason);
  if (result.added > 0) {
    void submitHarthmereInventoryGrantToLiveModeForTest(
      itemId,
      result.added,
      reason
    )?.catch(() => undefined);
  }
  return result;
}

function knownHarthmereMaterialOrFallback(
  itemId: string,
  fallback = "rough_stone"
) {
  return itemDef(itemId) ? itemId : fallback;
}

function nativeTerrainBlockItemIdFromDetail(
  detail: HarthmereNativeTerrainBlockDestroyedDetail
) {
  // Prefer the exact biscuit id emitted by the mining path. Terrain names are
  // only a legacy fallback for debug payloads that predate the id bridge.
  const explicitId = safeParseBiomesId(detail.blockItemId);
  if (explicitId) {
    return `b:${explicitId}`;
  }
  if (detail.terrainId) {
    try {
      const block = terrainIdToBlock(detail.terrainId);
      if (block?.id) {
        return `b:${block.id}`;
      }
    } catch {
      // The text fallback below still handles ad-hoc/debug terrain details.
    }
  }
  return undefined;
}

function terrainBlockNameParts(
  detail: HarthmereNativeTerrainBlockDestroyedDetail
) {
  const parts = [detail.blockItemId, detail.blockName, detail.terrainName];
  if (detail.terrainId) {
    parts.push(safeGetTerrainName(detail.terrainId));
    try {
      const block = terrainIdToBlock(detail.terrainId) as
        | {
            displayName?: string;
            name?: string;
            id?: string | number;
          }
        | undefined;
      parts.push(
        block?.displayName,
        block?.name,
        block?.id === undefined ? undefined : String(block.id)
      );
    } catch {
      // Terrain biscuit lookup is best-effort; the terrain name is enough for
      // the generic stone/wood/sand/clay fallbacks.
    }
  }
  return parts
    .filter(
      (part): part is string => typeof part === "string" && part.length > 0
    )
    .join(" ")
    .toLowerCase();
}

export function harthmereInventoryItemForNativeTerrainBlockForTest(
  detail: HarthmereNativeTerrainBlockDestroyedDetail
) {
  const blockItemId = nativeTerrainBlockItemIdFromDetail(detail);
  if (blockItemId) {
    return blockItemId;
  }
  const text = terrainBlockNameParts(detail);
  if (/coal|charcoal/.test(text)) {
    return knownHarthmereMaterialOrFallback("coal");
  }
  if (/gold/.test(text)) {
    return knownHarthmereMaterialOrFallback("gold_ore");
  }
  if (/silver/.test(text)) {
    return knownHarthmereMaterialOrFallback("silver_ore");
  }
  if (/iron|ore|metal/.test(text)) {
    return knownHarthmereMaterialOrFallback("iron_ore");
  }
  if (/log|wood|tree|trunk|branch|timber|plank|bark/.test(text)) {
    return knownHarthmereMaterialOrFallback("softwood_log");
  }
  if (/sand|beach|dune/.test(text)) {
    return knownHarthmereMaterialOrFallback("sand_lump");
  }
  if (/clay|mud|brick/.test(text)) {
    return knownHarthmereMaterialOrFallback("river_clay");
  }
  return knownHarthmereMaterialOrFallback("rough_stone");
}

const recentNativeTerrainBlockGrants = new Map<string, number>();

function nativeTerrainBlockGrantKey(
  detail: HarthmereNativeTerrainBlockDestroyedDetail,
  itemId: string
) {
  const position = Array.isArray(detail.position)
    ? detail.position
        .slice(0, 3)
        .map((value) => Math.floor(Number(value) || 0))
        .join(",")
    : "unknown";
  return `${itemId}:${
    detail.terrainId ?? detail.terrainName ?? detail.blockName ?? "terrain"
  }:${position}`;
}

export function grantHarthmereNativeTerrainBlockDropForTest(
  detail: HarthmereNativeTerrainBlockDestroyedDetail,
  options: { nowMs?: number; dedupeMs?: number } = {}
) {
  const itemId = harthmereInventoryItemForNativeTerrainBlockForTest(detail);
  const nowMs = options.nowMs ?? Date.now();
  const dedupeMs = options.dedupeMs ?? 1_250;
  const key = nativeTerrainBlockGrantKey(detail, itemId);
  const lastGrantAt = recentNativeTerrainBlockGrants.get(key);
  if (lastGrantAt !== undefined && nowMs - lastGrantAt < dedupeMs) {
    return { itemId, added: 0, overflow: 0, skipped: true as const };
  }
  recentNativeTerrainBlockGrants.set(key, nowMs);
  const terrainLabel =
    detail.blockName ??
    detail.terrainName ??
    (detail.terrainId ? safeGetTerrainName(detail.terrainId) : undefined) ??
    "block";
  const result = grantHarthmereItem(
    itemId,
    1,
    `Mined ${String(terrainLabel).replaceAll("_", " ")}`
  );
  return { itemId, ...result, skipped: false as const };
}

// Dedupe placement debits the same way mining grants are deduped: a single place
// interaction can surface more than one event during first-load/render churn.
const recentNativeTerrainBlockSpends = new Map<string, number>();

// Debit one of the placed block's biscuit item from the Harthmere inventory —
// the -1 half of the mine(+1)/place(-1) mirror. Decrements local state
// immediately (so the UI updates without a round-trip) and posts a server
// authoritative debit so the persisted live-mode inventory matches.
export function spendHarthmereNativeTerrainBlockForPlacement(
  detail: HarthmereNativeTerrainBlockDestroyedDetail,
  options: { nowMs?: number; dedupeMs?: number } = {}
) {
  const itemId = harthmereInventoryItemForNativeTerrainBlockForTest(detail);
  const nowMs = options.nowMs ?? Date.now();
  const dedupeMs = options.dedupeMs ?? 1_250;
  const key = nativeTerrainBlockGrantKey(detail, itemId);
  const lastSpendAt = recentNativeTerrainBlockSpends.get(key);
  if (lastSpendAt !== undefined && nowMs - lastSpendAt < dedupeMs) {
    return { itemId, consumed: 0, skipped: true as const };
  }
  recentNativeTerrainBlockSpends.set(key, nowMs);
  const terrainLabel =
    detail.blockName ??
    detail.terrainName ??
    (detail.terrainId ? safeGetTerrainName(detail.terrainId) : undefined) ??
    "block";
  const reason = `Placed ${String(terrainLabel).replaceAll("_", " ")}`;
  const consumed = consumeHarthmereItemByItemId(itemId, 1, reason);
  if (consumed > 0) {
    void submitHarthmereInventorySpendToLiveModeForTest(
      itemId,
      consumed,
      reason
    )?.catch(() => undefined);
  }
  return { itemId, consumed, skipped: false as const };
}

export const HarthmereNativeTerrainBlockInventoryBridge: React.FunctionComponent<{}> =
  () => {
    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }
      const onNativeTerrainBlockDestroyed = (event: Event) => {
        const result = grantHarthmereNativeTerrainBlockDropForTest(
          ((event as CustomEvent<HarthmereNativeTerrainBlockDestroyedDetail>)
            .detail ?? {}) as HarthmereNativeTerrainBlockDestroyedDetail
        );
        (
          window as typeof window & {
            __harthmereNativeTerrainInventoryBridgeLastGrant?: unknown;
          }
        ).__harthmereNativeTerrainInventoryBridgeLastGrant = result;
      };
      // Place path: debit the placed block so the count drops in step with the
      // canonical /sync EditEvent (the -1 half of the mine/place mirror).
      const onNativeTerrainBlockPlaced = (event: Event) => {
        const result = spendHarthmereNativeTerrainBlockForPlacement(
          ((event as CustomEvent<HarthmereNativeTerrainBlockDestroyedDetail>)
            .detail ?? {}) as HarthmereNativeTerrainBlockDestroyedDetail
        );
        (
          window as typeof window & {
            __harthmereNativeTerrainInventoryBridgeLastSpend?: unknown;
          }
        ).__harthmereNativeTerrainInventoryBridgeLastSpend = result;
      };
      window.addEventListener(
        HARTHMERE_NATIVE_TERRAIN_BLOCK_DESTROYED_EVENT,
        onNativeTerrainBlockDestroyed
      );
      window.addEventListener(
        HARTHMERE_NATIVE_TERRAIN_BLOCK_PLACED_EVENT,
        onNativeTerrainBlockPlaced
      );
      // HARTHMERE_NATIVE_BLOCK_PLACEMENT_GATE: expose the Harthmere owned count
      // for a would-be-placed terrain block so the native placement path can
      // refuse to place blocks the player does not actually hold. Only present
      // while this bridge is mounted (Harthmere live-mode HUD), so vanilla Biomes
      // placement is never gated. Reads the SAME Cloud Save inventory the place
      // debit decrements, so "can place" and "gets decremented" stay in lockstep
      // and the player can only place what the hotbar/inventory shows they own.
      const gateWindow = window as typeof window & {
        __harthmereNativeBlockPlacementOwnedCount?: (
          detail: HarthmereNativeTerrainBlockDestroyedDetail
        ) => number;
      };
      gateWindow.__harthmereNativeBlockPlacementOwnedCount = (detail) => {
        try {
          const itemId = harthmereInventoryItemForNativeTerrainBlockForTest(
            detail ?? ({} as HarthmereNativeTerrainBlockDestroyedDetail)
          );
          return harthmereInventoryCountByItemId(itemId);
        } catch {
          // On any lookup failure, do not block placement (fail open).
          return Number.POSITIVE_INFINITY;
        }
      };
      return () => {
        window.removeEventListener(
          HARTHMERE_NATIVE_TERRAIN_BLOCK_DESTROYED_EVENT,
          onNativeTerrainBlockDestroyed
        );
        window.removeEventListener(
          HARTHMERE_NATIVE_TERRAIN_BLOCK_PLACED_EVENT,
          onNativeTerrainBlockPlaced
        );
        delete gateWindow.__harthmereNativeBlockPlacementOwnedCount;
      };
    }, []);

    return null;
  };

// HARTHMERE_REWARD_INVENTORY_FIT:
// Dry-run whether a set of reward items can ALL be received without overflow,
// threading the simulated state through each item so multiple rewards are
// checked cumulatively (and special-storage categories like materials/quest
// items, which never overflow, are accounted for correctly). Callers use this
// to refuse a quest turn-in that would silently drop reward items when the
// backpack is full, leaving the quest claimable once the player frees space.
export function harthmereInventoryCanAcceptItems(
  items: ReadonlyArray<{ itemId: string; quantity: number }>,
  state: HarthmereInventoryState = readHarthmereInventoryState()
): boolean {
  let working = state;
  for (const item of items) {
    if (!itemDef(item.itemId)) {
      continue;
    }
    const result = addItemByStorageRules(working, item.itemId, item.quantity);
    if (result.overflow > 0) {
      return false;
    }
    working = result.state;
  }
  return true;
}

export function harthmereInventoryAcceptableQuantity(
  itemId: string,
  quantity: number,
  state: HarthmereInventoryState = readHarthmereInventoryState()
): number {
  if (quantity <= 0 || !itemDef(itemId)) {
    return 0;
  }
  return addItemByStorageRules(state, itemId, quantity).added;
}

// HARTHMERE_REPAIR_TOOL_EQUIP: a repair tool only works while EQUIPPED in
// the main hand. These read the equipped main-hand item and report whether it
// is a repair tool, so the repair interaction and job completion can gate on it.
export function isHarthmereRepairToolItemId(
  itemId: string | undefined
): boolean {
  if (!itemId) {
    return false;
  }
  const def = itemDef(itemId);
  return !!def && def.category === "tool" && def.subtype === "repair_tool";
}

export function equippedHarthmereRepairToolItemId(
  state: HarthmereInventoryState = readHarthmereInventoryState()
): string | undefined {
  // In a live-authoritative session the native selected item is the source of
  // truth. The local Harthmere inventory may still contain an older main-hand
  // projection, so using it here can prevent the real F repair interaction
  // from submitting its matching Jobs Board objective (or falsely keep a tool
  // equipped after the player switched away from it).
  const itemId = harthmereLiveServerAuthoritative()
    ? readHarthmereLiveEquipmentSnapshot().equipment.main_hand
    : state.equipment.main_hand?.itemId;
  return isHarthmereRepairToolItemId(itemId) ? itemId : undefined;
}

export function isHarthmereRepairToolEquipped(
  state: HarthmereInventoryState = readHarthmereInventoryState()
): boolean {
  return equippedHarthmereRepairToolItemId(state) !== undefined;
}

// Cleanup tool (muck->dirt + gardening) equip detection — mirror of repair.
export function isHarthmereCleanupToolItemId(
  itemId: string | undefined
): boolean {
  if (!itemId) {
    return false;
  }
  const def = itemDef(itemId);
  return !!def && def.category === "tool" && def.subtype === "cleanup_tool";
}

export function equippedHarthmereCleanupToolItemId(
  state: HarthmereInventoryState = readHarthmereInventoryState()
): string | undefined {
  const itemId = harthmereLiveServerAuthoritative()
    ? readHarthmereLiveEquipmentSnapshot().equipment.main_hand
    : state.equipment.main_hand?.itemId;
  return isHarthmereCleanupToolItemId(itemId) ? itemId : undefined;
}

export function isHarthmereCleanupToolEquipped(
  state: HarthmereInventoryState = readHarthmereInventoryState()
): boolean {
  return equippedHarthmereCleanupToolItemId(state) !== undefined;
}

// HARTHMERE_JOB_TOOL_EQUIP_STATE: a single read of whether the repair/cleanup
// tools are currently equipped, so the jobs-board map adapters can decide whether
// to surface a "buy the tool here" vendor marker + quest-detail callout.
export interface HarthmereJobToolEquipState {
  repairToolEquipped: boolean;
  cleanupToolEquipped: boolean;
}

export function harthmereJobToolEquipState(
  state: HarthmereInventoryState = readHarthmereInventoryState()
): HarthmereJobToolEquipState {
  return {
    repairToolEquipped: isHarthmereRepairToolEquipped(state),
    cleanupToolEquipped: isHarthmereCleanupToolEquipped(state),
  };
}

// HARTHMERE_JOB_TOOL_OWNED_STATE: whether the player OWNS the repair/cleanup
// tool at all (backpack OR equipped), not just whether it's equipped. The job
// buy-redirect is keyed on ownership: a player who already owns the tool is never
// sent to a shop — they're sent to the job (and may equip the tool they bought).
export interface HarthmereJobToolOwnedState {
  repairToolOwned: boolean;
  cleanupToolOwned: boolean;
}

function ownsHarthmereToolMatching(
  state: HarthmereInventoryState,
  matches: (itemId: string | undefined) => boolean
): boolean {
  if (
    matches(state.equipment.main_hand?.itemId) ||
    matches(state.equipment.off_hand?.itemId)
  ) {
    return true;
  }
  return state.backpack.items.some((item) => matches(item.itemId));
}

export function harthmereJobToolOwnedState(
  state: HarthmereInventoryState = readHarthmereInventoryState()
): HarthmereJobToolOwnedState {
  return {
    repairToolOwned: ownsHarthmereToolMatching(
      state,
      isHarthmereRepairToolItemId
    ),
    cleanupToolOwned: ownsHarthmereToolMatching(
      state,
      isHarthmereCleanupToolItemId
    ),
  };
}

// HARTHMERE_BUSINESS_TOOL_PURCHASE: buy the tool a given business sells,
// paying with the player's own gold and depositing the tool into their backpack.
// This is the path a tool-gated job's "buy it at the marked shop" redirect leads
// to. Idempotent against double-owning: refuses if the player already owns it.
export function purchaseHarthmereBusinessTool(
  businessType: string | undefined
): { ok: boolean; reason?: string; toolItemId?: string } {
  const listing = harthmereBusinessToolForType(businessType);
  if (!listing) {
    return { ok: false, reason: "no_tool" };
  }
  let state = readHarthmereInventoryState();
  const def = itemDef(listing.toolItemId);
  if (!def) {
    return { ok: false, reason: "unknown_tool" };
  }
  const alreadyOwned = ownsHarthmereToolMatching(
    state,
    (id) => id === listing.toolItemId
  );
  const outcome = harthmereBusinessToolPurchaseOutcome({
    businessType,
    goldAvailable: state.wallet.gold ?? 0,
    alreadyOwned,
  });
  if (!outcome.ok) {
    const message =
      outcome.reason === "already_owned"
        ? `You already own a ${listing.toolName}.`
        : `${listing.toolName} costs ${
            listing.priceGold
          } gold, but you only have ${state.wallet.gold ?? 0}.`;
    writeHarthmereInventoryState(
      appendLog(
        state,
        outcome.reason === "already_owned" ? "Already Owned" : "Cannot Buy",
        message
      )
    );
    return { ok: false, reason: outcome.reason };
  }
  // Deduct gold, then grant the tool into the backpack.
  state = {
    ...state,
    wallet: { ...state.wallet, gold: outcome.goldAfter },
  };
  writeHarthmereInventoryState(state);
  grantHarthmereItem(listing.toolItemId, 1, `Bought ${listing.toolName}`);
  return { ok: true, toolItemId: listing.toolItemId };
}

// HARTHMERE_JOB_REWARD_BRIDGE:
// Jobs-board (and crafting) payouts must land in the player's VISIBLE wallet +
// inventory (the LocalDev HUD), which is what the player actually spends from —
// the server jobs-board economy is separate bookkeeping the HUD never reads, so
// there is no double-pay. This pure core applies a job's reward (gold + items)
// to a HUD state ONCE per jobId (idempotent), so a re-fired turn-in effect can
// never double-grant. Items route through addItemByStorageRules (overflow is
// reported, never silently lost — the turn-in flow refuses when it won't fit).
export interface HarthmereJobReward {
  jobId: string;
  rewardGold?: number;
  rewardItems?: ReadonlyArray<{ itemId: string; count: number }>;
}

export interface HarthmereJobRewardApplyResult {
  granted: boolean;
  alreadyGranted: boolean;
  goldAdded: number;
  itemsAdded: number;
  overflow: number;
}

export function applyHarthmereJobRewardToState(
  state: HarthmereInventoryState,
  granted: ReadonlySet<string>,
  reward: HarthmereJobReward
): {
  state: HarthmereInventoryState;
  granted: Set<string>;
  result: HarthmereJobRewardApplyResult;
} {
  const grantedNext = new Set(granted);
  if (granted.has(reward.jobId)) {
    return {
      state,
      granted: grantedNext,
      result: {
        granted: false,
        alreadyGranted: true,
        goldAdded: 0,
        itemsAdded: 0,
        overflow: 0,
      },
    };
  }
  let working = state;
  const gold = Math.max(0, Math.round(Number(reward.rewardGold ?? 0)));
  if (gold > 0) {
    working = addGold(working, gold);
  }
  let itemsAdded = 0;
  let overflow = 0;
  for (const item of reward.rewardItems ?? []) {
    if (!itemDef(item.itemId)) {
      continue;
    }
    const out = addItemByStorageRules(working, item.itemId, item.count);
    working = out.state;
    itemsAdded += out.added;
    overflow += out.overflow;
  }
  grantedNext.add(reward.jobId);
  return {
    state: working,
    granted: grantedNext,
    result: {
      granted: true,
      alreadyGranted: false,
      goldAdded: gold,
      itemsAdded,
      overflow,
    },
  };
}

const HARTHMERE_JOB_REWARD_GRANTED_KEY =
  "biomes.localDev.harthmere.jobsBoardRewardsGranted";

function readGrantedHarthmereJobRewards(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = harthmereLocalStorage.getItem(HARTHMERE_JOB_REWARD_GRANTED_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function harthmereJobRewardAlreadyGranted(jobId: string): boolean {
  return readGrantedHarthmereJobRewards().has(jobId);
}

// Add gold to the HUD wallet (exported for reward/economy callers).
export function addHarthmereGold(amount: number, reason = "Gold received") {
  if (typeof window === "undefined") return;
  const next = addGold(readHarthmereInventoryState(), amount);
  writeHarthmereInventoryState(
    appendLog(next, reason, `+${Math.max(0, Math.round(amount))} gold`)
  );
}

// localStorage-backed idempotent job-reward grant used on turn-in.
export function grantHarthmereJobReward(
  reward: HarthmereJobReward
): HarthmereJobRewardApplyResult {
  if (typeof window === "undefined") {
    return {
      granted: false,
      alreadyGranted: false,
      goldAdded: 0,
      itemsAdded: 0,
      overflow: 0,
    };
  }
  const granted = readGrantedHarthmereJobRewards();
  const applied = applyHarthmereJobRewardToState(
    readHarthmereInventoryState(),
    granted,
    reward
  );
  if (!applied.result.granted) {
    return applied.result;
  }
  writeHarthmereInventoryState(
    appendLog(
      applied.state,
      "Job reward",
      `${reward.jobId}: +${applied.result.goldAdded} gold, +${
        applied.result.itemsAdded
      } items${
        applied.result.overflow > 0
          ? `, overflow ${applied.result.overflow}`
          : ""
      }`
    )
  );
  try {
    harthmereLocalStorage.setItem(
      HARTHMERE_JOB_REWARD_GRANTED_KEY,
      JSON.stringify([...applied.granted])
    );
  } catch {
    // Reward already applied in-memory; the granted-set persist is best-effort.
  }
  return applied.result;
}

export function grantHarthmereTutorialInventoryItem(
  itemId: string,
  quantity = 1,
  reason = "Tutorial item received"
) {
  const def = itemDef(itemId);
  if (!def) {
    return;
  }
  const current = readHarthmereInventoryState();
  const { state, added, overflow } = insertBackpackItem(
    current,
    itemId,
    quantity
  );
  const next = appendLog(
    state,
    reason,
    overflow > 0
      ? `${def.name}: added ${added}, backpack overflow ${overflow}.`
      : `${def.name} x${added} added to backpack for the active tutorial.`
  );
  writeHarthmereInventoryState(next);
}

function addGold(state: HarthmereInventoryState, amount: number) {
  return {
    ...state,
    wallet: {
      ...state.wallet,
      gold: Math.max(
        0,
        nonNegativeInt(state.wallet.gold, 0) + Math.round(amount)
      ),
    },
  };
}

function addFavor(state: HarthmereInventoryState, amount: number) {
  return {
    ...state,
    wallet: {
      ...state.wallet,
      harthmere_favor: Math.max(
        0,
        (state.wallet.harthmere_favor ?? 0) + amount
      ),
    },
  };
}

function learnSpell(
  state: HarthmereInventoryState,
  spellId: string,
  source: string
): { state: HarthmereInventoryState; learned: boolean } {
  if (!SPELL_DEFINITIONS[spellId]) {
    return { state, learned: false };
  }
  if (state.spellbook.knownSpells.some((spell) => spell.spellId === spellId)) {
    return { state, learned: false };
  }
  const firstOpenSlot = Object.entries(state.spellbook.activeSpellSlots).find(
    ([, value]) => !value
  )?.[0];
  return {
    state: {
      ...state,
      spellbook: {
        ...state.spellbook,
        knownSpells: [
          ...state.spellbook.knownSpells,
          {
            spellId,
            source,
            learnedAt: Date.now(),
            equippedSlot: firstOpenSlot,
            runes: [],
          },
        ],
        activeSpellSlots: firstOpenSlot
          ? { ...state.spellbook.activeSpellSlots, [firstOpenSlot]: spellId }
          : state.spellbook.activeSpellSlots,
      },
    },
    learned: true,
  };
}

export function grantHarthmereQuestInventoryReward(
  questId: string,
  questTitle: string
) {
  const reward = QUEST_REWARDS[questId];
  if (!reward) {
    return;
  }
  if (!claimHarthmereQuestEconomyReward(questId, questTitle)) {
    writeHarthmereInventoryState(
      appendLog(
        readHarthmereInventoryState(),
        "Quest Reward Blocked",
        `${questTitle}: duplicate or cooldown-blocked reward claim prevented.`
      )
    );
    return;
  }
  let state = readHarthmereInventoryState();
  const rewardLines: string[] = [];

  if (reward.gold) {
    state = addGold(state, reward.gold);
    rewardLines.push(`${reward.gold} gold`);
  }
  if (reward.favor) {
    state = addFavor(state, reward.favor);
    rewardLines.push(`${reward.favor} Harthmere Favor`);
  }
  for (const [itemId, quantity] of Object.entries(reward.materials ?? {})) {
    const result = addItemByStorageRules(state, itemId, quantity);
    state = result.state;
    rewardLines.push(`${itemDef(itemId)?.name ?? itemId} x${result.added}`);
  }
  for (const keyId of reward.keys ?? []) {
    const result = addItemByStorageRules(state, keyId, 1);
    state = result.state;
    rewardLines.push(`${itemDef(keyId)?.name ?? keyId}`);
  }
  for (const item of reward.items ?? []) {
    const result = addItemByStorageRules(
      state,
      item.itemId,
      item.quantity ?? 1
    );
    state = result.state;
    rewardLines.push(
      `${itemDef(item.itemId)?.name ?? item.itemId} x${result.added}`
    );
    if (result.overflow > 0) {
      rewardLines.push(`${result.overflow} item overflow blocked by backpack`);
    }
  }
  for (const spell of reward.spells ?? []) {
    const result = learnSpell(state, spell.spellId, spell.source);
    state = result.state;
    rewardLines.push(
      result.learned
        ? `learned ${SPELL_DEFINITIONS[spell.spellId]?.name ?? spell.spellId}`
        : `already knew ${
            SPELL_DEFINITIONS[spell.spellId]?.name ?? spell.spellId
          }`
    );
  }

  writeHarthmereInventoryState(
    appendLog(
      state,
      "Quest Reward",
      `${questTitle}: ${rewardLines.join(", ") || "reward recorded"}.`
    )
  );
}

export function recoverHarthmereQuestItemIfLost(
  questId: string,
  itemId: string
) {
  let state = readHarthmereInventoryState();
  const def = itemDef(itemId);
  if (!def || def.category !== "quest_item") {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Quest Item Recovery Failed",
        `${itemId} is not a recoverable quest item.`
      )
    );
    return false;
  }
  const alreadyHas = state.questPouch.some((item) => item.itemId === itemId);
  if (alreadyHas) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Quest Item Already Present",
        `${def.name} is already in the quest pouch.`
      )
    );
    return true;
  }
  const result = addItemByStorageRules(state, itemId, 1);
  state = result.state;
  recordHarthmereQuestItemRecovered(questId, itemId);
  writeHarthmereInventoryState(
    appendLog(
      state,
      "Quest Item Recovered",
      `${def.name} recovered into the quest pouch for ${questId}.`
    )
  );
  return result.added > 0;
}

export function removeTemporaryHarthmereQuestItemsForAbandon(
  questId: string,
  itemIds: string[]
) {
  const state = readHarthmereInventoryState();
  const itemIdSet = new Set(itemIds);
  const nextQuestPouch = state.questPouch.filter(
    (item) => !itemIdSet.has(item.itemId)
  );
  cleanupHarthmereTemporaryQuestItemsForQuest(questId, itemIds);
  writeHarthmereInventoryState(
    appendLog(
      { ...state, questPouch: nextQuestPouch },
      "Temporary Quest Items Removed",
      `${
        itemIds.join(", ") || "No temporary quest items"
      } removed after ${questId} ended.`
    )
  );
}

function storageLabelForCategory(category: HarthmereItemCategory) {
  if (category === "quest_item") {
    return "quest pouch";
  }
  if (category === "crafting_material") {
    return "material storage";
  }
  if (category === "key") {
    return "keyring";
  }
  return "backpack";
}

function removeFromBackpack(
  state: HarthmereInventoryState,
  instanceId: string,
  quantity = 1
): { state: HarthmereInventoryState; removed?: HarthmereItemInstance } {
  const items = [...state.backpack.items];
  const index = items.findIndex((item) => item.instanceId === instanceId);
  if (index < 0) {
    return { state };
  }
  const item = items[index];
  const removedQuantity = Math.min(quantity, item.quantity);
  let removed = { ...item, quantity: removedQuantity };
  if (item.quantity <= removedQuantity) {
    items.splice(index, 1);
  } else {
    items[index] = { ...item, quantity: item.quantity - removedQuantity };
  }
  return {
    state: { ...state, backpack: { ...state.backpack, items } },
    removed,
  };
}

function removeInstanceEverywhere(
  state: HarthmereInventoryState,
  instanceId: string
): { state: HarthmereInventoryState; removed?: HarthmereItemInstance } {
  const fromBackpack = removeFromBackpack(
    state,
    instanceId,
    Number.MAX_SAFE_INTEGER
  );
  if (fromBackpack.removed) {
    return fromBackpack;
  }

  const bankItems = [...state.bank.items];
  const bankIndex = bankItems.findIndex(
    (item) => item.instanceId === instanceId
  );
  if (bankIndex >= 0) {
    const [removed] = bankItems.splice(bankIndex, 1);
    return {
      state: { ...state, bank: { ...state.bank, items: bankItems } },
      removed,
    };
  }

  for (const [slot, item] of Object.entries(state.equipment)) {
    if (item?.instanceId === instanceId) {
      const equipment = { ...state.equipment };
      delete equipment[slot as EquipmentSlot];
      return { state: { ...state, equipment }, removed: item };
    }
  }

  return { state };
}

function useBackpackItem(instanceId: string) {
  let state = readHarthmereInventoryState();
  const instance = state.backpack.items.find(
    (item) => item.instanceId === instanceId
  );
  if (!instance) {
    return;
  }
  const def = itemDef(instance.itemId);
  if (!def?.useEffect) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Cannot Use",
        `${def?.name ?? "Item"} has no use effect.`
      )
    );
    return;
  }

  let detail = "";
  if (def.useEffect.type === "heal") {
    if (def.category === "food") {
      const stamina = eatHarthmereFoodForStamina(def.id);
      detail = stamina.warnings.length
        ? `${def.name} could not restore stamina: ${stamina.warnings.join(
            ", "
          )}.`
        : `${def.name} used. It restores stamina so exhaustion does not reach zero.`;
    } else {
      healHarthmerePlayer(def.useEffect.amount, def.name);
      detail = `${def.name} used. It attempts to restore ${def.useEffect.amount} HP.`;
    }
  } else if (def.useEffect.type === "revive") {
    reviveHarthmerePlayer();
    detail = `${def.name} used for local-dev revival.`;
  } else if (def.useEffect.type === "learn_spell") {
    const spell = SPELL_DEFINITIONS[def.useEffect.spellId];
    const learned = learnSpell(state, def.useEffect.spellId, def.name);
    state = learned.state;
    detail = learned.learned
      ? `${def.name} taught ${spell?.name ?? def.useEffect.spellId}.`
      : `You already know ${
          spell?.name ?? def.useEffect.spellId
        }. The scroll was not consumed.`;
    if (!learned.learned) {
      writeHarthmereInventoryState(appendLog(state, "Already Known", detail));
      return;
    }
  } else if (def.useEffect.type === "unlock_key") {
    state = {
      ...state,
      keyring: Array.from(new Set([...state.keyring, def.useEffect.keyId])),
    };
    detail = `${def.name} added a key to your keyring.`;
  }

  const removed = removeFromBackpack(state, instanceId, 1);
  state = removed.state;
  if (def.bindType === "bind_on_use" && removed.removed) {
    removed.removed.bound = true;
  }
  writeHarthmereInventoryState(appendLog(state, "Item Used", detail));
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT, {
        detail: {
          itemId: instance.itemId,
          itemName: def.name,
          category: def.category,
          subtype: def.subtype,
          useEffect: def.useEffect.type,
          instanceId,
          source: "harthmere-inventory-use",
        },
      })
    );
  }
  if (def.category === "food") {
    completeHarthmereDailyTaskSoon("eat_meal");
  }
}

function resolveBackpackInstanceIdForBiomesUI(
  instanceId: string,
  itemId?: string
) {
  const state = readHarthmereInventoryState();
  if (state.backpack.items.some((item) => item.instanceId === instanceId)) {
    return instanceId;
  }
  const fallbackInstanceId = itemId
    ? state.backpack.items.find((item) => item.itemId === itemId)?.instanceId
    : undefined;
  if (fallbackInstanceId) {
    writeHarthmereInventoryState(state);
    return fallbackInstanceId;
  }
  return instanceId;
}

export function performHarthmereBackpackItemUseForBiomesUI(
  instanceId: string,
  itemId?: string
) {
  useBackpackItem(resolveBackpackInstanceIdForBiomesUI(instanceId, itemId));
}

export function performHarthmereBackpackItemEquipForBiomesUI(
  instanceId: string,
  itemId?: string
) {
  equipBackpackItem(resolveBackpackInstanceIdForBiomesUI(instanceId, itemId));
}

export function performHarthmereEquipmentItemUnequipForBiomesUI(slot: string) {
  unequipItem(slot as EquipmentSlot);
}

function equipBackpackItem(instanceId: string) {
  let state = readHarthmereInventoryState();
  const instance = state.backpack.items.find(
    (item) => item.instanceId === instanceId
  );
  if (!instance) {
    return;
  }
  const def = itemDef(instance.itemId);
  if (!def?.slot) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Cannot Equip",
        `${def?.name ?? "Item"} is not equipment.`
      )
    );
    return;
  }

  const levelSummary = getHarthmereLevelSummary();
  if ((def.requiredLevel ?? 1) > levelSummary.state.level) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Level Required",
        `${def.name} requires level ${def.requiredLevel}. You are level ${levelSummary.state.level}.`
      )
    );
    return;
  }

  const removed = removeFromBackpack(state, instanceId, 1);
  if (!removed.removed) {
    return;
  }
  state = removed.state;
  const equipment = { ...state.equipment };
  const previous = equipment[def.slot];
  const equipped = {
    ...removed.removed,
    location: "equipment" as const,
    equipmentSlot: def.slot,
    bound: removed.removed.bound || def.bindType === "bind_on_equip",
  };
  equipment[def.slot] = equipped;
  state = { ...state, equipment };

  if (previous) {
    const reinsert = insertBackpackItem(
      {
        ...state,
        backpack: {
          ...state.backpack,
          items: [
            ...state.backpack.items,
            { ...previous, location: "backpack" },
          ],
        },
      },
      previous.itemId,
      0
    );
    state = reinsert.state;
  }

  writeHarthmereInventoryState(
    appendLog(
      state,
      "Equipped",
      `${def.name} equipped to ${def.slot.replaceAll("_", " ")}. ${
        def.bindType === "bind_on_equip" ? "It is now bound." : ""
      }`
    )
  );
}

function mainHandWeaponIds() {
  return Object.values(ITEM_DEFINITIONS)
    .filter((def) => def.category === "weapon" && def.slot === "main_hand")
    .map((def) => def.id);
}

function ownedMainHandWeaponIds(state: HarthmereInventoryState) {
  const owned = new Set<string>();
  const current = state.equipment.main_hand;
  if (current?.itemId && mainHandWeaponIds().includes(current.itemId)) {
    owned.add(current.itemId);
  }
  for (const item of state.backpack.items) {
    if (mainHandWeaponIds().includes(item.itemId)) {
      owned.add(item.itemId);
    }
  }
  return [...owned];
}

function unequipMainHandToBackpack(state: HarthmereInventoryState) {
  const current = state.equipment.main_hand;
  if (!current) {
    return state;
  }
  if (state.backpack.items.length >= state.backpack.maxSlots) {
    return appendLog(
      state,
      "Backpack Full",
      "You need one free backpack slot before switching back to fists."
    );
  }
  const equipment = { ...state.equipment };
  delete equipment.main_hand;
  return appendLog(
    {
      ...state,
      equipment,
      backpack: {
        ...state.backpack,
        items: [
          ...state.backpack.items,
          { ...current, location: "backpack", equipmentSlot: undefined },
        ],
      },
    },
    "Fists Readied",
    "You put away your main-hand weapon. Your current weapon is now fists."
  );
}

export function ensureHarthmereStarterSwordGranted() {
  let state = readHarthmereInventoryState();

  // Harthmere starter weapon migration current:
  // Old local-dev saves may have fists or only a dagger. This function is
  // intentionally idempotent: it gives the player one Iron Longsword if they
  // do not already own one, then equips it in main hand so the renderer and
  // combat systems have a concrete sword item to represent visually.
  const ownsSword =
    state.equipment.main_hand?.itemId === "iron_longsword" ||
    state.backpack.items.some((item) => item.itemId === "iron_longsword");

  if (!ownsSword) {
    const swordLocation: HarthmereStorageLocation = state.equipment.main_hand
      ? "backpack"
      : "equipment";
    const swordEquipmentSlot: EquipmentSlot | undefined = state.equipment
      .main_hand
      ? undefined
      : "main_hand";
    const sword: HarthmereItemInstance = {
      ...makeItemInstance("iron_longsword", 1, swordLocation),
      location: swordLocation,
      equipmentSlot: swordEquipmentSlot,
      bound: true,
    };

    if (state.equipment.main_hand) {
      state = {
        ...state,
        backpack: {
          ...state.backpack,
          items: [...state.backpack.items, sword],
        },
      };
    } else {
      state = {
        ...state,
        equipment: {
          ...state.equipment,
          main_hand: sword,
        },
      };
    }
  }

  if (state.equipment.main_hand?.itemId !== "iron_longsword") {
    const backpackSword = state.backpack.items.find(
      (item) => item.itemId === "iron_longsword"
    );
    if (backpackSword) {
      writeHarthmereInventoryState(state);
      equipBackpackItem(backpackSword.instanceId);
      return;
    }
  }

  writeHarthmereInventoryState(
    appendLog(
      state,
      "Sword Ready",
      "You have an Iron Longsword. Draw or sheathe it with the weapon stance control before fighting."
    )
  );
}

// HARTHMERE_TOOL_OBTAINABLE: ensure the player can always obtain the job
// tools, so repair AND cleanup jobs (which require the matching equipped tool)
// are never soft-locked. Idempotent per tool. The tools are ALSO stocked at the
// in-world vendor owners so they can be re-bought if sold/dropped (see the
// vendor catalog), and the resolver guides the player there when one is missing.
function ensureHarthmereStarterToolGranted(
  itemId: string,
  reason: string,
  state = readHarthmereInventoryState()
) {
  const owns =
    state.equipment.main_hand?.itemId === itemId ||
    state.equipment.off_hand?.itemId === itemId ||
    state.backpack.items.some((item) => item.itemId === itemId);
  if (owns) {
    return;
  }
  grantHarthmereItem(itemId, 1, reason);
}

export function ensureHarthmereStarterRepairToolGranted() {
  ensureHarthmereStarterToolGranted("repair_mallet", "Starter repair tool");
}

export function ensureHarthmereStarterCleanupToolGranted() {
  ensureHarthmereStarterToolGranted("muck_rake", "Starter cleanup tool");
}

export function ensureStarterWeaponEquipped() {
  let state = readHarthmereInventoryState();
  if (state.equipment.main_hand) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Weapon Ready",
        `${itemName(state.equipment.main_hand)} is already equipped.`
      )
    );
    return;
  }

  const owned = ownedMainHandWeaponIds(state);
  if (!owned.length) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Fists Ready",
        "No weapon is owned yet. You can fight with fists or buy a weapon from the Black Anvil weapon counter."
      )
    );
    return;
  }

  quickEquipHarthmereWeapon(owned[0]);
}

export function quickEquipHarthmereWeapon(itemId?: string) {
  let state = readHarthmereInventoryState();
  if (!itemId) {
    writeHarthmereInventoryState(unequipMainHandToBackpack(state));
    return;
  }

  const def = itemDef(itemId);
  if (!def || def.category !== "weapon" || def.slot !== "main_hand") {
    return;
  }

  const current = state.equipment.main_hand;
  if (current?.itemId === itemId) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Weapon Ready",
        `${itemName(current)} is already equipped.`
      )
    );
    return;
  }

  const backpackWeapon = state.backpack.items.find(
    (item) => item.itemId === itemId
  );
  if (!backpackWeapon) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Weapon Not Owned",
        `${def.name} is not in your backpack. Buy it from the Black Anvil weapon counter first.`
      )
    );
    return;
  }

  equipBackpackItem(backpackWeapon.instanceId);
}

export function cycleHarthmereWeapon() {
  const state = readHarthmereInventoryState();
  const owned = ownedMainHandWeaponIds(state);
  const cycle = [undefined, ...owned] as Array<string | undefined>;
  const current = state.equipment.main_hand?.itemId;
  const currentIndex = cycle.findIndex((itemId) => itemId === current);
  const next = cycle[(currentIndex + 1 + cycle.length) % cycle.length];
  quickEquipHarthmereWeapon(next);
}

export function ensureHarthmereSpellSlotted(spellId: string, slot = "slot_1") {
  let state = readHarthmereInventoryState();
  const spell = SPELL_DEFINITIONS[spellId];
  if (!spell) {
    return;
  }

  if (!state.spellbook.knownSpells.some((known) => known.spellId === spellId)) {
    const learned = learnSpell(state, spellId, "HUD quick slot");
    state = learned.state;
  }

  writeHarthmereInventoryState(
    appendLog(
      {
        ...state,
        spellbook: {
          ...state.spellbook,
          activeSpellSlots: {
            ...state.spellbook.activeSpellSlots,
            [slot]: spellId,
          },
          knownSpells: state.spellbook.knownSpells.map((known) =>
            known.spellId === spellId ? { ...known, equippedSlot: slot } : known
          ),
        },
      },
      "Spell Slotted",
      `${spell.name} is ready in ${slot.replaceAll(
        "_",
        " "
      )}. The action bar uses Q for the primary spell.`
    )
  );
}

function unequipItem(slot: EquipmentSlot) {
  let state = readHarthmereInventoryState();
  const item = state.equipment[slot];
  if (!item) {
    return;
  }
  if (state.backpack.items.length >= state.backpack.maxSlots) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Backpack Full",
        `Cannot unequip ${
          itemDef(item.itemId)?.name ?? "item"
        }; free a backpack slot first.`
      )
    );
    return;
  }
  const equipment = { ...state.equipment };
  delete equipment[slot];
  state = {
    ...state,
    equipment,
    backpack: {
      ...state.backpack,
      items: [...state.backpack.items, { ...item, location: "backpack" }],
    },
  };
  writeHarthmereInventoryState(
    appendLog(
      state,
      "Unequipped",
      `${itemDef(item.itemId)?.name ?? "Item"} returned to your backpack.`
    )
  );
}

function toggleLock(instanceId: string) {
  let state = readHarthmereInventoryState();
  const mutate = (item: HarthmereItemInstance) =>
    item.instanceId === instanceId ? { ...item, locked: !item.locked } : item;
  state = {
    ...state,
    backpack: {
      ...state.backpack,
      items: state.backpack.items.map(mutate),
    },
    bank: { ...state.bank, items: state.bank.items.map(mutate) },
    equipment: Object.fromEntries(
      Object.entries(state.equipment).map(([slot, item]) => [
        slot,
        item ? mutate(item) : item,
      ])
    ) as Partial<Record<EquipmentSlot, HarthmereItemInstance>>,
  };
  writeHarthmereInventoryState(
    appendLog(state, "Lock Toggled", "Item lock status changed.")
  );
}

function sortBackpack() {
  const state = readHarthmereInventoryState();
  const sorted = [...state.backpack.items].sort((a, b) => {
    const da = itemDef(a.itemId);
    const db = itemDef(b.itemId);
    return `${da?.category ?? "zzz"}-${da?.quality ?? "zzz"}-${
      da?.name ?? a.itemId
    }`.localeCompare(
      `${db?.category ?? "zzz"}-${db?.quality ?? "zzz"}-${db?.name ?? b.itemId}`
    );
  });
  writeHarthmereInventoryState(
    appendLog(
      { ...state, backpack: { ...state.backpack, items: sorted } },
      "Sorted",
      "Backpack sorted by category, quality, and name."
    )
  );
}

function sellJunk() {
  if (!claimHarthmereLocalDevRapidAction("inventory:sell-junk", 650)) {
    return;
  }
  let state = readHarthmereInventoryState();
  let gold = 0;
  const kept: HarthmereItemInstance[] = [];
  for (const item of state.backpack.items) {
    const def = itemDef(item.itemId);
    if (def?.category === "junk" && !item.locked) {
      gold += def.baseValue * item.quantity;
    } else {
      kept.push(item);
    }
  }
  state = addGold(
    { ...state, backpack: { ...state.backpack, items: kept } },
    gold
  );
  writeHarthmereInventoryState(
    appendLog(
      state,
      "Sold Junk",
      gold > 0
        ? `Sold unlocked junk for ${gold} gold.`
        : "No unlocked junk was available to sell."
    )
  );
}

function depositMaterials() {
  if (!claimHarthmereLocalDevRapidAction("inventory:deposit-materials", 650)) {
    return;
  }
  let state = readHarthmereInventoryState();
  const kept: HarthmereItemInstance[] = [];
  const materialStorage = { ...state.materialStorage };
  let moved = 0;
  for (const item of state.backpack.items) {
    const def = itemDef(item.itemId);
    if (def?.category === "crafting_material" && !item.locked) {
      materialStorage[item.itemId] =
        (materialStorage[item.itemId] ?? 0) + item.quantity;
      moved += item.quantity;
    } else {
      kept.push(item);
    }
  }
  state = {
    ...state,
    backpack: { ...state.backpack, items: kept },
    materialStorage,
  };
  writeHarthmereInventoryState(
    appendLog(
      state,
      "Deposited Materials",
      moved > 0
        ? `Moved ${moved} crafting materials into material storage.`
        : "No loose crafting materials were in the backpack."
    )
  );
}

function repairAllEquipment() {
  if (!claimHarthmereLocalDevRapidAction("inventory:repair-all", 650)) {
    return;
  }
  const state = readHarthmereInventoryState();
  const equipment = Object.fromEntries(
    Object.entries(state.equipment).map(([slot, item]) => {
      if (!item) {
        return [slot, item];
      }
      const def = itemDef(item.itemId);
      return [
        slot,
        { ...item, durability: def?.durabilityMax ?? item.durability },
      ];
    })
  ) as Partial<Record<EquipmentSlot, HarthmereItemInstance>>;
  writeHarthmereInventoryState(
    appendLog(
      { ...state, equipment },
      "Repaired Gear",
      "Equipped gear durability was restored for local-dev testing."
    )
  );
}

function resetInventory() {
  writeHarthmereInventoryState(
    appendLog(emptyState(), "Inventory Reset", "Local-dev inventory reset.")
  );
}

function readPendingVendorTradeRequest():
  | HarthmereVendorTradeRequest
  | undefined {
  if (!isBrowser()) {
    return undefined;
  }
  try {
    const raw = harthmereLocalStorage.getItem(
      HARTHMERE_VENDOR_TRADE_REQUEST_KEY
    );
    if (!raw) {
      return undefined;
    }
    const parsed = JSON.parse(raw) as Partial<HarthmereVendorTradeRequest>;
    if (typeof parsed.offset !== "number" || !VENDOR_STOCK[parsed.offset]) {
      return undefined;
    }
    return {
      offset: parsed.offset,
      mode: parsed.mode === "sell" ? "sell" : "buy",
    };
  } catch {
    return undefined;
  }
}

function clearPendingVendorTradeRequest() {
  if (!isBrowser()) {
    return;
  }
  harthmereLocalStorage.removeItem(HARTHMERE_VENDOR_TRADE_REQUEST_KEY);
}

export function openHarthmereVendorTrade(
  offset: number,
  mode: HarthmereVendorTradeMode = "buy"
) {
  if (!isBrowser() || !VENDOR_STOCK[offset]) {
    return;
  }

  // The vendor UI must not sit behind the NPC dialogue. Ask any active
  // Harthmere talk modal to close first, then open the top-level vendor modal.
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_VENDOR_TRADE_CLOSE_TALK_EVENT)
  );

  const request: HarthmereVendorTradeRequest = { offset, mode };
  harthmereLocalStorage.setItem(
    HARTHMERE_VENDOR_TRADE_REQUEST_KEY,
    JSON.stringify(request)
  );

  const dispatch = () => {
    window.dispatchEvent(
      new CustomEvent<HarthmereVendorTradeRequest>(
        HARTHMERE_VENDOR_TRADE_EVENT,
        {
          detail: request,
        }
      )
    );
  };
  dispatch();
  window.setTimeout(dispatch, 0);
  window.setTimeout(dispatch, 80);
}

function vendorStockLine(offset: number, itemId: string) {
  return getHarthmereCurrentVendorStockLine(offset, itemId);
}

function vendorCanBuyCategory(offset: number, category: HarthmereItemCategory) {
  return VENDOR_STOCK[offset]?.buys?.includes(category) ?? false;
}

function reputationPriceModifierForVendor(offset: number) {
  const vendor = VENDOR_STOCK[offset];
  const reputation = readHarthmereReputationState().regions.harthmere;
  const likeability =
    reputation.likeability >= 2_000
      ? 0.94
      : reputation.likeability <= -2_000
      ? 1.16
      : 1;
  const legal =
    reputation.legal >= 2_000
      ? 0.96
      : reputation.legal <= -5_000 && vendor?.lawfulService !== false
      ? 1.25
      : 1;
  return likeability * legal;
}

function finalVendorBuyPriceForPlayer(
  offset: number,
  itemId: string,
  quantity: number
) {
  const stock = vendorStockLine(offset, itemId);
  if (!stock) {
    return 0;
  }
  const requested = Math.max(1, quantity);
  // In live mode the shared vendor catalogue is server authority.  Display
  // the exact bundle price the server will charge instead of independently
  // re-pricing the same offer from browser-local reputation state.
  if (harthmereLiveServerAuthoritative()) {
    return Math.max(1, Math.ceil(stock.price));
  }
  const unitPrice = stock.price / Math.max(1, stock.quantity);
  return Math.max(
    1,
    Math.ceil(unitPrice * requested * reputationPriceModifierForVendor(offset))
  );
}

function finalVendorSellQuoteForPlayer(
  offset: number,
  item: HarthmereItemInstance
) {
  const def = itemDef(item.itemId);
  const vendor = VENDOR_STOCK[offset];
  if (!def || def.baseValue <= 0 || !vendor) {
    return 0;
  }
  const condition = def.durabilityMax
    ? Math.max(
        0.25,
        Math.min(1, (item.durability ?? def.durabilityMax) / def.durabilityMax)
      )
    : 1;
  const stolenPenalty = item.stolen && vendor.buysStolenGoods ? 0.55 : 1;
  const buyModifier = vendor.baseBuyModifier ?? 0.45;
  const reputation = readHarthmereReputationState().regions.harthmere;
  const likeability =
    reputation.likeability >= 2_000
      ? 1.08
      : reputation.likeability <= -2_000
      ? 0.82
      : 1;
  const legal =
    reputation.legal >= 2_000 && vendor.lawfulService !== false ? 1.04 : 1;
  return Math.max(
    1,
    Math.floor(
      def.baseValue *
        buyModifier *
        condition *
        stolenPenalty *
        likeability *
        legal
    )
  );
}

function buyFitReason(
  state: HarthmereInventoryState,
  offset: number,
  itemId: string
) {
  const vendor = VENDOR_STOCK[offset];
  const stock = vendorStockLine(offset, itemId);
  const def = itemDef(itemId);
  if (!vendor || !stock || !def) {
    return "This item is not currently sold by this vendor.";
  }
  if (!isHarthmereVendorStockUnlocked(offset, itemId)) {
    return "This stock unlocks after the related quest changes local trust or supply.";
  }
  if (stock.quantity <= 0 || stock.price <= 0) {
    return "This vendor listing has an invalid quantity or price.";
  }
  // The server validates live gold, storage capacity, stack limits,
  // reputation, and catalogue quantity atomically. Browser-local copies can
  // lag behind a live response and must not block a valid request.
  if (harthmereLiveServerAuthoritative()) {
    return undefined;
  }
  const price = finalVendorBuyPriceForPlayer(offset, itemId, stock.quantity);
  if ((state.wallet.gold ?? 0) < price) {
    return `Need ${price} gold; you have ${state.wallet.gold ?? 0}.`;
  }
  const result = addItemByStorageRules(state, itemId, stock.quantity);
  if (result.added < stock.quantity || result.overflow > 0) {
    return `${def.name} cannot fit in ${storageLabelForCategory(
      def.category
    )} right now.`;
  }
  return undefined;
}

function vendorPurchaseFailureMessage(error: unknown, itemName: string) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const knownFailures: Array<[string, string]> = [
    ["insufficient_gold", "You do not have enough gold."],
    ["vendor_out_of_stock", "The vendor is out of stock."],
    ["inventory_full", "Your inventory is full."],
    ["stack_size_exceeded", "That purchase would exceed the item stack limit."],
    [
      "insufficient_reputation_for_vendor_item",
      "Your reputation is not high enough for this item.",
    ],
    [
      "invalid_vendor_bundle_count",
      "The vendor only sells this item as the displayed bundle.",
    ],
    ["item_not_in_vendor_catalogue", "That listing is no longer available."],
    ["unknown_item_id", "That item is no longer recognized by the server."],
  ];
  const failure = knownFailures.find(([code]) => message.includes(code));
  if (failure) {
    return `${itemName}: ${failure[1]}`;
  }
  return `${itemName}: Purchase was not confirmed. No item, gold, or listing was changed. Try again.`;
}

async function buyFromVendor(offset: number, itemId: string) {
  if (
    !claimHarthmereLocalDevRapidAction(
      `inventory:vendor-buy:${offset}:${itemId}`,
      650
    )
  ) {
    return;
  }
  const vendor = VENDOR_STOCK[offset];
  const stock = vendorStockLine(offset, itemId);
  const def = itemDef(itemId);
  let state = readHarthmereInventoryState();
  if (!vendor || !stock || !def) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Cannot Buy",
        "That vendor listing is no longer available."
      )
    );
    return;
  }

  const reason = buyFitReason(state, offset, itemId);
  if (reason) {
    writeHarthmereInventoryState(
      appendLog(state, "Cannot Buy", `${def.name}: ${reason}`)
    );
    return;
  }

  const price = finalVendorBuyPriceForPlayer(offset, itemId, stock.quantity);
  if (harthmereLiveServerAuthoritative()) {
    try {
      const body = await submitHarthmereVendorPurchaseToLiveModeForTest(
        offset,
        itemId,
        stock.quantity,
        `${def.name} purchased from ${vendor.vendorName}`
      );
      if (!body) {
        throw new Error("harthmere_vendor_live_mode_unavailable");
      }
      state = readHarthmereInventoryState();
      writeHarthmereInventoryState(
        appendLog(
          { ...state, lastVendor: vendor.vendorName },
          "Bought Item",
          `${def.name} x${stock.quantity} bought from ${vendor.vendorName} for ${price} gold.`
        )
      );
    } catch (error) {
      // The live endpoint is atomic.  A rejection or network failure must only
      // add an error message; it must never debit gold, grant an item, or hide
      // the catalogue offer in browser state.
      state = readHarthmereInventoryState();
      writeHarthmereInventoryState(
        appendLog(
          state,
          "Cannot Buy",
          vendorPurchaseFailureMessage(error, def.name)
        )
      );
    }
    return;
  }

  if ((state.wallet.gold ?? 0) < price) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Cannot Buy",
        `${def.name} costs ${price} gold, but you only have ${
          state.wallet.gold ?? 0
        }.`
      )
    );
    return;
  }

  const result = addItemByStorageRules(state, itemId, stock.quantity);
  if (result.added < stock.quantity || result.overflow > 0) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Cannot Buy",
        `${def.name} could not be added atomically. Free space and try again.`
      )
    );
    return;
  }

  state = addGold(result.state, -price);
  receiveHarthmereVendorGold(offset, price);
  writeHarthmereInventoryState(
    appendLog(
      { ...state, lastVendor: vendor.vendorName },
      "Bought Item",
      `${def.name} x${stock.quantity} bought from ${vendor.vendorName} for ${price} gold.`
    )
  );
}

export function buyHarthmereVendorItemForTest(offset: number, itemId: string) {
  return buyFromVendor(offset, itemId);
}

function sellQuote(item: HarthmereItemInstance) {
  const def = itemDef(item.itemId);
  if (!def || def.baseValue <= 0) {
    return 0;
  }
  const condition = def.durabilityMax
    ? Math.max(
        0.25,
        Math.min(1, (item.durability ?? def.durabilityMax) / def.durabilityMax)
      )
    : 1;
  return Math.max(1, Math.floor(def.baseValue * 0.45 * condition));
}

function sellBlockReason(offset: number, item: HarthmereItemInstance) {
  const vendor = VENDOR_STOCK[offset];
  const def = itemDef(item.itemId);
  if (!vendor || !def) {
    return "This vendor is not available.";
  }
  if (item.locked) {
    return "Locked items are protected. Unlock it first if you really want to sell it.";
  }
  if (def.category === "quest_item" || def.bindType === "quest_bound") {
    return "Quest items cannot be sold.";
  }
  if (item.bound) {
    return "Bound items cannot be sold to this vendor.";
  }
  if (item.stolen && !vendor.buysStolenGoods) {
    return "Lawful vendors refuse stolen goods. Use a fence instead.";
  }
  if (!vendorCanBuyCategory(offset, def.category)) {
    return `${vendor.vendorName} does not buy ${
      CATEGORY_LABELS[def.category] ?? def.category
    }.`;
  }
  if (sellQuote(item) <= 0) {
    return "This item has no vendor value.";
  }
  return undefined;
}

function sellToVendor(offset: number, instanceId: string, quantity = 1) {
  if (
    !claimHarthmereLocalDevRapidAction(
      `inventory:vendor-sell:${offset}:${instanceId}`,
      650
    )
  ) {
    return;
  }
  const vendor = VENDOR_STOCK[offset];
  let state = readHarthmereInventoryState();
  const item = state.backpack.items.find(
    (entry) => entry.instanceId === instanceId
  );
  if (!vendor || !item) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Cannot Sell",
        "That item is no longer in your backpack or the vendor is unavailable."
      )
    );
    return;
  }
  const def = itemDef(item.itemId);
  const reason = sellBlockReason(offset, item);
  if (reason || !def) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Cannot Sell",
        `${def?.name ?? item.itemId}: ${reason ?? "Unknown item."}`
      )
    );
    return;
  }
  const amount = Math.max(1, Math.min(quantity, item.quantity));
  const payout = finalVendorSellQuoteForPlayer(offset, item) * amount;
  if (
    !spendHarthmereVendorGold(
      offset,
      payout,
      `${vendor.vendorName} paid ${payout} gold for ${def.name}.`
    )
  ) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Cannot Sell",
        `${vendor.vendorName} does not have enough gold supply to buy ${def.name}.`
      )
    );
    return;
  }
  const removed = removeFromBackpack(state, instanceId, amount);
  if (!removed.removed || removed.removed.quantity !== amount) {
    receiveHarthmereVendorGold(offset, payout);
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Cannot Sell",
        `${def.name} sale failed safely. Try again.`
      )
    );
    return;
  }
  receiveHarthmereVendorStock(offset, item.itemId, amount);
  state = addGold(removed.state, payout);
  writeHarthmereInventoryState(
    appendLog(
      { ...state, lastVendor: vendor.vendorName },
      "Sold Item",
      `${def.name} x${amount} sold to ${vendor.vendorName} for ${payout} gold.`
    )
  );
}

function transferToBank(instanceId: string) {
  if (
    !claimHarthmereLocalDevRapidAction(
      `inventory:bank-deposit:${instanceId}`,
      650
    )
  ) {
    return;
  }
  let state = readHarthmereInventoryState();
  if (state.bank.items.length >= state.bank.maxSlots) {
    writeHarthmereInventoryState(
      appendLog(state, "Bank Full", "No bank slot is available.")
    );
    return;
  }
  const removed = removeFromBackpack(
    state,
    instanceId,
    Number.MAX_SAFE_INTEGER
  );
  if (!removed.removed) {
    return;
  }
  const def = itemDef(removed.removed.itemId);
  if (def?.category === "quest_item") {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Cannot Bank Quest Item",
        "Quest items stay in the quest pouch and cannot be banked."
      )
    );
    return;
  }
  state = {
    ...removed.state,
    bank: {
      ...removed.state.bank,
      items: [
        ...removed.state.bank.items,
        { ...removed.removed, location: "bank" },
      ],
    },
  };
  writeHarthmereInventoryState(
    appendLog(state, "Bank Deposit", `${def?.name ?? "Item"} moved to bank.`)
  );
}

function withdrawFromBank(instanceId: string) {
  if (
    !claimHarthmereLocalDevRapidAction(
      `inventory:bank-withdraw:${instanceId}`,
      650
    )
  ) {
    return;
  }
  let state = readHarthmereInventoryState();
  if (state.backpack.items.length >= state.backpack.maxSlots) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Backpack Full",
        "Free a backpack slot before withdrawing."
      )
    );
    return;
  }
  const bankItems = [...state.bank.items];
  const index = bankItems.findIndex((item) => item.instanceId === instanceId);
  if (index < 0) {
    return;
  }
  const [item] = bankItems.splice(index, 1);
  state = {
    ...state,
    bank: { ...state.bank, items: bankItems },
    backpack: {
      ...state.backpack,
      items: [...state.backpack.items, { ...item, location: "backpack" }],
    },
  };
  writeHarthmereInventoryState(
    appendLog(
      state,
      "Bank Withdraw",
      `${itemDef(item.itemId)?.name ?? "Item"} moved to backpack.`
    )
  );
}

function itemName(item: HarthmereItemInstance) {
  const def = itemDef(item.itemId);
  return item.customName ?? def?.name ?? item.itemId;
}

function inventoryUsed(state: HarthmereInventoryState) {
  return state.backpack.items.length;
}

function totalEquippedStats(state: HarthmereInventoryState) {
  const totals = {
    attackPoints: 0,
    defense: 0,
    armor: 0,
    magicResistance: 0,
    accuracy: 0,
    evasion: 0,
    criticalChance: 0,
  };
  for (const item of Object.values(state.equipment)) {
    const stats = item ? itemDef(item.itemId)?.stats : undefined;
    if (!stats) {
      continue;
    }
    for (const key of Object.keys(totals) as Array<keyof typeof totals>) {
      totals[key] += stats[key] ?? 0;
    }
  }
  return totals;
}

export function useHarthmereInventoryState() {
  const [state, setState] = useState<HarthmereInventoryState>(() =>
    readHarthmereInventoryState()
  );

  useEffect(() => {
    const refresh = () => setState(readHarthmereInventoryState());
    const syncLiveWallet = (event: Event) => {
      syncHarthmereLiveWalletProjectionForTest(
        (event as CustomEvent<{ gold?: unknown }>).detail?.gold
      );
    };
    const interval = window.setInterval(refresh, 750);
    window.addEventListener("storage", refresh);
    window.addEventListener(HARTHMERE_INVENTORY_EVENT, refresh);
    window.addEventListener("biomes:live-mode-wallet-updated", syncLiveWallet);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(HARTHMERE_INVENTORY_EVENT, refresh);
      window.removeEventListener(
        "biomes:live-mode-wallet-updated",
        syncLiveWallet
      );
    };
  }, []);

  return state;
}

export function inventoryActionsForHarthmereNpc(
  offset: number
): TalkDialogStepAction[] {
  const vendor = VENDOR_STOCK[offset];
  const actions: TalkDialogStepAction[] = [];

  if (vendor) {
    actions.push({
      name: "Browse goods",
      type: "primary",
      tooltip: `Open ${vendor.vendorName}'s buy window with every item, price, storage destination, and your current gold.`,
      closeAfterPerformed: true,
      onPerformed: () => openHarthmereVendorTrade(offset, "buy"),
    });
    actions.push({
      name: "Sell goods",
      tooltip: `Open ${vendor.vendorName}'s sell window. Locked, bound, quest, stolen, and wrong-category items are protected.`,
      closeAfterPerformed: true,
      onPerformed: () => openHarthmereVendorTrade(offset, "sell"),
    });
  }

  if ([6, 36, 59, 60].includes(offset)) {
    actions.push({
      name: "Deposit materials",
      tooltip:
        "Move loose crafting materials from backpack into material storage.",
      onPerformed: () => depositMaterials(),
    });
    actions.push({
      name: "Sell junk",
      tooltip:
        "Sell unlocked junk from your backpack. Locked items are protected.",
      onPerformed: () => sellJunk(),
    });
  }

  if ([29, 7, 56].includes(offset)) {
    actions.push({
      name: "Repair equipped gear",
      tooltip: "Restore equipped item durability for local-dev testing.",
      onPerformed: () => repairAllEquipment(),
    });
  }

  if ([7, 29, 41, 44, 56].includes(offset)) {
    actions.push({
      name: "Ready an owned weapon",
      tooltip:
        "Equips your first owned weapon, or leaves you on fists if you have not bought one yet.",
      onPerformed: () => ensureStarterWeaponEquipped(),
    });
  }

  if (offset === 41) {
    actions.push({
      name: "Reset local-dev inventory",
      tooltip:
        "Clears only the Harthmere local-dev inventory, wallet, equipment, spellbook, bank, quest pouch, materials, and keyring.",
      onPerformed: () => resetInventory(),
    });
  }

  return actions;
}

function chunkHarthmereVendorRows<T>(items: readonly T[], columns = 2): T[][] {
  const safeColumns = Math.max(1, Math.trunc(columns));
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += safeColumns) {
    rows.push(items.slice(index, index + safeColumns));
  }
  return rows;
}

export const HarthmereVendorTradePanel: React.FunctionComponent<{}> = () => {
  const inventory = useHarthmereInventoryState();
  const [request, setRequest] = useState<
    HarthmereVendorTradeRequest | undefined
  >(undefined);
  const [pendingBuyItemId, setPendingBuyItemId] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    if (!isBrowser()) {
      return;
    }
    const openRequest = (detail?: HarthmereVendorTradeRequest) => {
      const pending = detail ?? readPendingVendorTradeRequest();
      if (!pending || !VENDOR_STOCK[pending.offset]) {
        return;
      }
      setRequest({
        offset: pending.offset,
        mode: pending.mode === "sell" ? "sell" : "buy",
      });
    };
    const handler = (event: Event) => {
      openRequest((event as CustomEvent<HarthmereVendorTradeRequest>).detail);
    };
    const storageHandler = (event: StorageEvent) => {
      if (event.key === HARTHMERE_VENDOR_TRADE_REQUEST_KEY) {
        openRequest();
      }
    };
    openRequest();
    window.addEventListener(HARTHMERE_VENDOR_TRADE_EVENT, handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener(HARTHMERE_VENDOR_TRADE_EVENT, handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  const closePanel = () => {
    clearPendingVendorTradeRequest();
    setPendingBuyItemId(undefined);
    setRequest(undefined);
  };

  useEffect(() => {
    if (!request || !isBrowser()) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closePanel();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [request]);

  if (!request || !isBrowser()) {
    return null;
  }

  const vendor = VENDOR_STOCK[request.offset];
  if (!vendor) {
    return null;
  }

  const latest = inventory.recent[0];
  const buyStocks = vendor.stocks
    .filter((stock) =>
      isHarthmereVendorStockUnlocked(request.offset, stock.itemId)
    )
    .map((stock) =>
      getHarthmereCurrentVendorStockLine(request.offset, stock.itemId)
    )
    .filter(
      (
        stock
      ): stock is NonNullable<
        ReturnType<typeof getHarthmereCurrentVendorStockLine>
      > => Boolean(stock)
    );
  const sellableBackpackItems = inventory.backpack.items.filter((item) =>
    itemDef(item.itemId)
  );

  const panel = (
    <div
      data-harthmere-vendor-trade-panel="true"
      className="biomes-ui-container-backdrop"
      style={{ zIndex: 2147483000 }}
      onMouseDown={(event) => event.stopPropagation()}
      onMouseUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="biomes-ui-vendor-panel">
        <BiomesUIShopChrome
          title={vendor.vendorName}
          eyebrow="BiomesUI Store"
          variant="vendor"
          onClose={closePanel}
          subtitle={
            <>
              <strong>{inventory.wallet.gold ?? 0} Gold</strong>
              {" · "}Backpack {inventory.backpack.items.length}/
              {inventory.backpack.maxSlots}
            </>
          }
          actions={
            <div
              className="biomes-ui-vendor-tabs"
              role="tablist"
              aria-label="Vendor transaction mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={request.mode === "buy"}
                data-selected={request.mode === "buy" ? "true" : undefined}
                data-biomes-ui-shop-initial-focus={
                  request.mode === "buy" ? "true" : undefined
                }
                className="biomes-ui-action-button"
                onClick={() => openHarthmereVendorTrade(request.offset, "buy")}
              >
                Buy
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={request.mode === "sell"}
                data-selected={request.mode === "sell" ? "true" : undefined}
                data-biomes-ui-shop-initial-focus={
                  request.mode === "sell" ? "true" : undefined
                }
                className="biomes-ui-action-button"
                onClick={() => openHarthmereVendorTrade(request.offset, "sell")}
              >
                Sell
              </button>
            </div>
          }
          footer={
            <div className="biomes-ui-vendor-transaction-log">
              <strong>Transaction log</strong>
              <span>
                {latest
                  ? `${latest.action}: ${latest.detail}`
                  : "No vendor transaction yet."}
              </span>
            </div>
          }
        >
          {request.mode === "buy" ? (
            <BiomesUIShopSection
              title="Available Goods"
              meta={`${buyStocks.length} listings`}
              className="biomes-ui-vendor-catalog"
            >
              {buyStocks.length ? (
                <RovingGrid
                  ariaLabel={`${vendor.vendorName} goods`}
                  className="biomes-ui-vendor-grid"
                  items={chunkHarthmereVendorRows(buyStocks)}
                  renderCell={(stock, _coords, cell) => {
                    const def = itemDef(stock.itemId);
                    if (!def) {
                      return null;
                    }
                    const reason = buyFitReason(
                      inventory,
                      request.offset,
                      stock.itemId
                    );
                    const dynamicPrice = finalVendorBuyPriceForPlayer(
                      request.offset,
                      stock.itemId,
                      stock.quantity
                    );
                    return (
                      <article
                        ref={cell.ref}
                        role="gridcell"
                        tabIndex={cell.tabIndex}
                        data-focused={_coords.focused ? "true" : undefined}
                        data-harthmere-vendor-item={stock.itemId}
                        className="biomes-ui-vendor-card"
                        onFocus={cell.onFocus}
                        onClick={cell.onClick}
                        onKeyDown={(event) => {
                          if (event.target === event.currentTarget) {
                            cell.onKeyDown(event);
                          }
                        }}
                      >
                        <BiomesUIShopItemIcon
                          icon={def.icon}
                          label={def.name}
                        />
                        <div className="biomes-ui-vendor-card__content">
                          <div className="biomes-ui-vendor-card__heading">
                            <div>
                              <strong>{def.name}</strong>
                              {stock.quantity > 1 ? (
                                <span>Bundle of {stock.quantity}</span>
                              ) : null}
                            </div>
                            <span
                              className="biomes-ui-vendor-price"
                              data-harthmere-dynamic-vendor-price="true"
                            >
                              {dynamicPrice} Gold
                            </span>
                          </div>
                          <div className="biomes-ui-vendor-card__meta">
                            <span>{CATEGORY_LABELS[def.category]}</span>
                            <span>{def.quality}</span>
                            <span>
                              Stores in {storageLabelForCategory(def.category)}
                            </span>
                          </div>
                          <p>{def.description}</p>
                          <p
                            className="biomes-ui-vendor-card__pricing-note"
                            data-harthmere-dynamic-vendor-modifiers="true"
                          >
                            Price reflects stock, reputation, legal standing,
                            and local supply.
                          </p>
                          {reason ? (
                            <div className="biomes-ui-vendor-card__warning">
                              {reason}
                            </div>
                          ) : null}
                          <div className="biomes-ui-vendor-card__actions">
                            <button
                              type="button"
                              className="biomes-ui-action-button"
                              disabled={
                                Boolean(reason) ||
                                pendingBuyItemId === stock.itemId
                              }
                              onClick={(event) => {
                                event.stopPropagation();
                                setPendingBuyItemId(stock.itemId);
                                void buyFromVendor(
                                  request.offset,
                                  stock.itemId
                                ).finally(() => {
                                  setPendingBuyItemId((current) =>
                                    current === stock.itemId
                                      ? undefined
                                      : current
                                  );
                                });
                              }}
                            >
                              {pendingBuyItemId === stock.itemId
                                ? "Buying…"
                                : `Buy for ${dynamicPrice} Gold`}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  }}
                />
              ) : (
                <p className="biomes-ui-shop-muted biomes-ui-vendor-empty">
                  This vendor has no unlocked stock available right now.
                </p>
              )}
            </BiomesUIShopSection>
          ) : (
            <BiomesUIShopSection
              title="Your Backpack"
              meta={`${sellableBackpackItems.length} items`}
              className="biomes-ui-vendor-catalog"
            >
              {sellableBackpackItems.length ? (
                <RovingGrid
                  ariaLabel={`Items to sell to ${vendor.vendorName}`}
                  className="biomes-ui-vendor-grid"
                  items={chunkHarthmereVendorRows(sellableBackpackItems)}
                  renderCell={(item, _coords, cell) => {
                    const def = itemDef(item.itemId);
                    if (!def) {
                      return null;
                    }
                    const reason = sellBlockReason(request.offset, item);
                    const unitQuote = finalVendorSellQuoteForPlayer(
                      request.offset,
                      item
                    );
                    return (
                      <article
                        ref={cell.ref}
                        role="gridcell"
                        tabIndex={cell.tabIndex}
                        data-focused={_coords.focused ? "true" : undefined}
                        data-harthmere-vendor-item={item.itemId}
                        className="biomes-ui-vendor-card"
                        onFocus={cell.onFocus}
                        onClick={cell.onClick}
                        onKeyDown={(event) => {
                          if (event.target === event.currentTarget) {
                            cell.onKeyDown(event);
                          }
                        }}
                      >
                        <BiomesUIShopItemIcon
                          icon={def.icon}
                          label={itemName(item)}
                        />
                        <div className="biomes-ui-vendor-card__content">
                          <div className="biomes-ui-vendor-card__heading">
                            <div>
                              <strong>{itemName(item)}</strong>
                              {item.quantity > 1 ? (
                                <span>Stack of {item.quantity}</span>
                              ) : null}
                            </div>
                            <span className="biomes-ui-vendor-price">
                              {reason
                                ? "Not accepted"
                                : `${unitQuote} Gold each`}
                            </span>
                          </div>
                          <div className="biomes-ui-vendor-card__meta">
                            <span>{CATEGORY_LABELS[def.category]}</span>
                            <span>{def.quality}</span>
                            <span>
                              {item.locked
                                ? "locked"
                                : item.bound
                                ? "bound"
                                : item.stolen
                                ? "stolen"
                                : "available to sell"}
                            </span>
                          </div>
                          <p>{def.description}</p>
                          {reason ? (
                            <div className="biomes-ui-vendor-card__warning">
                              {reason}
                            </div>
                          ) : null}
                          <div className="biomes-ui-vendor-card__actions">
                            <button
                              type="button"
                              className="biomes-ui-action-button"
                              disabled={Boolean(reason)}
                              onClick={(event) => {
                                event.stopPropagation();
                                sellToVendor(
                                  request.offset,
                                  item.instanceId,
                                  1
                                );
                              }}
                            >
                              Sell 1
                            </button>
                            {item.quantity > 1 ? (
                              <button
                                type="button"
                                className="biomes-ui-action-button"
                                disabled={Boolean(reason)}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  sellToVendor(
                                    request.offset,
                                    item.instanceId,
                                    item.quantity
                                  );
                                }}
                              >
                                Sell Stack ({unitQuote * item.quantity} Gold)
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  }}
                />
              ) : (
                <p className="biomes-ui-shop-muted biomes-ui-vendor-empty">
                  Your backpack is empty. Quest pouch, keyring, wallet, bank,
                  and material storage are protected from accidental sales.
                </p>
              )}
            </BiomesUIShopSection>
          )}
        </BiomesUIShopChrome>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
};

// HARTHMERE_INVENTORY_TUTORIAL_ITEM_HIGHLIGHT:
// Reads the active Snapshot Grove lesson directly from localStorage (not via
// the runtime module) to avoid import cycles. This lets Backpack, material,
// and quest-pouch rows pulse when a tutorial says "eat the ration", "collect
// the root sample", or "use the bandage".
const SNAPSHOT_GROVE_QUEST_STATE_KEY_FOR_INVENTORY =
  "biomes.localDev.snapshotGroveQuestState";

function snapshotGroveTutorialItemIdsForObjective(text: string) {
  const lowered = text.toLowerCase();
  const ids = new Set<string>();
  if (/ration|food|snack|eat|stamina/.test(lowered)) ids.add("road_ration");
  if (/bandage|first.?aid|scratch|wound|medicine|salve|health/.test(lowered))
    ids.add("minor_healing_salve");
  if (
    /clean root|mucked root|root sample|muck sample|sealed muck|mudroot/.test(
      lowered
    )
  )
    ids.add("mudroot");
  if (/bright berr|berries|berry/.test(lowered)) ids.add("wild_berries");
  if (/wood scrap|practice stick|stick|branch|wheel/.test(lowered))
    ids.add("softwood_log");
  if (/stone|repair piece|block|road block|drop/.test(lowered))
    ids.add("rough_stone");
  if (/cloth|trade slot|practice item/.test(lowered)) ids.add("cloth_scrap");
  if (/bolt|coil|metal/.test(lowered)) ids.add("scrap_metal");
  if (/key/.test(lowered)) ids.add("iron_key_blank");
  return ids;
}

function readSnapshotGroveActiveInventoryItemIds() {
  if (typeof window === "undefined" || !window.localStorage) {
    return new Set<string>();
  }
  try {
    const raw = harthmereLocalStorage.getItem(
      SNAPSHOT_GROVE_QUEST_STATE_KEY_FOR_INVENTORY
    );
    const parsed = raw ? JSON.parse(raw) : undefined;
    const activeQuestId =
      typeof parsed?.activeQuestId === "string"
        ? parsed.activeQuestId
        : undefined;
    const activeObjectiveIndex = Number.isFinite(parsed?.activeObjectiveIndex)
      ? Math.max(0, Number(parsed.activeObjectiveIndex))
      : 0;
    const quest = SNAPSHOT_GROVE_QUESTS.find(
      (entry) => entry.id === activeQuestId
    );
    if (!quest || parsed?.completedQuestIds?.includes?.(quest.id)) {
      return new Set<string>();
    }
    const objective =
      quest.objectives[
        Math.min(activeObjectiveIndex, quest.objectives.length - 1)
      ] ?? "";
    return snapshotGroveTutorialItemIdsForObjective(
      `${quest.id} ${quest.title} ${objective}`
    );
  } catch {
    return new Set<string>();
  }
}

function InventorySlot({
  item,
  onUse,
  onEquip,
  onBank,
  onLock,
  highlighted,
}: {
  item: HarthmereItemInstance;
  onUse?: () => void;
  onEquip?: () => void;
  onBank?: () => void;
  onLock?: () => void;
  highlighted?: boolean;
}) {
  const def = itemDef(item.itemId);
  if (!def) {
    return null;
  }
  const qualityStyle = QUALITY_STYLE[def.quality];
  return (
    <div
      className={`rounded border bg-black/40 p-2 ${qualityStyle} ${
        highlighted
          ? "ring-lime-200/85 shadow-[0_0_18px_rgba(190,242,100,0.38)] ring-2"
          : ""
      }`}
      data-harthmere-tutorial-item-highlight={highlighted ? "true" : "false"}
      data-harthmere-auto-focus={highlighted ? "true" : undefined}
      data-harthmere-inventory-item-id={item.itemId}
      tabIndex={highlighted ? 0 : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-2">
          <div className="rounded text-base flex h-8 w-8 items-center justify-center bg-white/10 font-bold">
            {def.icon}
          </div>
          <div>
            <div className="text-xs font-semibold leading-tight">
              {itemName(item)} {item.quantity > 1 ? `x${item.quantity}` : ""}
            </div>
            <div className="text-[10px] text-white/60">
              {CATEGORY_LABELS[def.category]} · {def.quality}
            </div>
          </div>
        </div>
        <div className="text-[10px] text-white/50">
          {item.locked ? "Locked" : item.bound ? "Bound" : def.bindType}
        </div>
      </div>
      <div className="mt-1 text-[10px] leading-snug text-white/70">
        {def.description}
        {def.questUsage ? ` Used for: ${def.questUsage}.` : ""}
        {def.durabilityMax
          ? ` Durability: ${item.durability ?? def.durabilityMax}/${
              def.durabilityMax
            }.`
          : ""}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {def.useEffect && (
          <button
            className="rounded py-0.5 bg-white/10 px-2 text-[10px] hover:bg-white/20"
            data-harthmere-primary-action={highlighted ? "true" : undefined}
            onClick={onUse}
          >
            Use
          </button>
        )}
        {def.slot && (
          <button
            className="rounded py-0.5 bg-white/10 px-2 text-[10px] hover:bg-white/20"
            onClick={onEquip}
          >
            Equip
          </button>
        )}
        {onBank && def.category !== "quest_item" && (
          <button
            className="rounded py-0.5 bg-white/10 px-2 text-[10px] hover:bg-white/20"
            onClick={onBank}
          >
            Bank
          </button>
        )}
        <button
          className="rounded py-0.5 bg-white/10 px-2 text-[10px] hover:bg-white/20"
          onClick={onLock}
        >
          {item.locked ? "Unlock" : "Lock"}
        </button>
      </div>
    </div>
  );
}

export const HarthmereInventoryHUD: React.FunctionComponent<{}> = () => {
  const state = useHarthmereInventoryState();
  const latest = state.recent[0];
  const equippedWeapon = state.equipment.main_hand;
  return (
    <div
      className="rounded-lg pointer-events-none w-[21rem] border border-white/20 bg-black/70 p-2 text-white shadow-lg"
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-amber-200 text-sm font-semibold uppercase tracking-wide">
            Harthmere Inventory
          </div>
          <div className="text-xs text-white/80">
            Backpack {inventoryUsed(state)}/{state.backpack.maxSlots} · Gold{" "}
            {state.wallet.gold ?? 0}
          </div>
        </div>
        <div className="rounded px-1.5 py-0.5 bg-white/10 text-xs font-semibold text-white/80">
          {equippedWeapon ? itemName(equippedWeapon) : "Fists"}
        </div>
      </div>
      <div className="mt-1 text-xs leading-snug text-white/80">
        <span className="text-amber-100 font-semibold">Latest:</span>{" "}
        {latest?.detail ?? "Inventory ready."}
      </div>
    </div>
  );
};

export const HarthmereInventoryMenuPanel: React.FunctionComponent<{}> = () => {
  const state = useHarthmereInventoryState();
  const [tab, setTab] = useState<
    "backpack" | "equipment" | "spellbook" | "wallet" | "bank" | "guide"
  >("backpack");
  const [query, setQuery] = useState("");
  const [tutorialItemIds, setTutorialItemIds] = useState(() =>
    readSnapshotGroveActiveInventoryItemIds()
  );
  const stats = totalEquippedStats(state);

  useEffect(() => {
    const refresh = () =>
      setTutorialItemIds(readSnapshotGroveActiveInventoryItemIds());
    const interval = window.setInterval(refresh, 500);
    window.addEventListener("storage", refresh);
    window.addEventListener(
      "biomes:local-dev-snapshot-grove-quest-state",
      refresh
    );
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(
        "biomes:local-dev-snapshot-grove-quest-state",
        refresh
      );
    };
  }, []);

  useEffect(() => {
    if (!tutorialItemIds.size) {
      return;
    }
    const needsBackpack = state.backpack.items.some((item) =>
      tutorialItemIds.has(item.itemId)
    );
    if (needsBackpack && tab !== "backpack") {
      setTab("backpack");
      return;
    }
    const needsMaterials = Object.entries(state.materialStorage).some(
      ([itemId, qty]) => tutorialItemIds.has(itemId) && qty > 0
    );
    if (!needsBackpack && needsMaterials && tab !== "wallet") {
      setTab("wallet");
    }
  }, [state.backpack.items, state.materialStorage, tab, tutorialItemIds]);

  const filteredBackpack = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return state.backpack.items;
    }
    return state.backpack.items.filter((item) => {
      const def = itemDef(item.itemId);
      return `${def?.name ?? item.itemId} ${def?.category ?? ""} ${
        def?.quality ?? ""
      }`
        .toLowerCase()
        .includes(q);
    });
  }, [query, state.backpack.items]);

  return (
    <div
      className="rounded-lg bg-black/85 mb-2 max-h-[70vh] w-[31rem] overflow-hidden border border-white/20 text-white shadow-xl"
      data-harthmere-inventory-tutorial-items={
        tutorialItemIds.size ? "true" : "false"
      }
    >
      <div className="border-b border-white/10 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base text-amber-200 font-semibold">
              Harthmere Inventory
            </div>
            <div className="text-xs text-white/70">
              Backpack, equipment, wallet, quest pouch, material storage,
              keyring, bank, and spellbook.
            </div>
          </div>
          <div className="rounded bg-white/10 px-2 py-1 text-xs text-white/80">
            {inventoryUsed(state)}/{state.backpack.maxSlots} slots
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {(
            [
              "backpack",
              "equipment",
              "spellbook",
              "wallet",
              "bank",
              "guide",
            ] as const
          ).map((nextTab) => (
            <button
              key={nextTab}
              className={`rounded px-2 py-1 text-xs capitalize ${
                tab === nextTab
                  ? "bg-amber-300 text-black"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              onClick={() => setTab(nextTab)}
            >
              {nextTab}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[52vh] overflow-y-auto p-3 text-sm">
        {tab === "backpack" && (
          <>
            <div className="mb-2 flex gap-2">
              <input
                className="rounded border-white/15 min-w-0 flex-1 border bg-black/50 px-2 py-1 text-xs text-white placeholder:text-white/40"
                value={query}
                placeholder="Search item, type, quality..."
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                onClick={() => sortBackpack()}
              >
                Sort
              </button>
              <button
                className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                onClick={() => sellJunk()}
              >
                Sell Junk
              </button>
              <button
                className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20"
                onClick={() => depositMaterials()}
              >
                Deposit Materials
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {filteredBackpack.length ? (
                filteredBackpack.map((item) => (
                  <InventorySlot
                    key={item.instanceId}
                    item={item}
                    onUse={() => useBackpackItem(item.instanceId)}
                    onEquip={() => equipBackpackItem(item.instanceId)}
                    onBank={() => transferToBank(item.instanceId)}
                    onLock={() => toggleLock(item.instanceId)}
                    highlighted={tutorialItemIds.has(item.itemId)}
                  />
                ))
              ) : (
                <div className="rounded border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                  No backpack items match the current search.
                </div>
              )}
            </div>
          </>
        )}

        {tab === "equipment" && (
          <div className="space-y-2">
            <div className="rounded border border-white/10 bg-white/5 p-2 text-xs text-white/80">
              Equipped stats: Attack +{stats.attackPoints}, Defense +
              {stats.defense}, Armor +{stats.armor}, Accuracy +{stats.accuracy},
              Evasion +{stats.evasion}.
            </div>
            {(
              [
                "head",
                "chest",
                "back",
                "main_hand",
                "off_hand",
                "feet",
                "ring_1",
                "ring_2",
                "trinket_1",
                "tool",
              ] as EquipmentSlot[]
            ).map((slot) => {
              const item = state.equipment[slot];
              const def = item ? itemDef(item.itemId) : undefined;
              return (
                <div
                  key={slot}
                  className="rounded flex items-center justify-between border border-white/10 bg-white/5 p-2 text-xs"
                >
                  <div>
                    <div className="font-semibold capitalize text-white/90">
                      {slot.replaceAll("_", " ")}
                    </div>
                    <div className="text-white/60">
                      {item && def
                        ? `${def.icon} ${itemName(item)} · durability ${
                            item.durability ?? def.durabilityMax ?? "—"
                          }/${def.durabilityMax ?? "—"}`
                        : "Empty"}
                    </div>
                  </div>
                  {item && (
                    <button
                      className="rounded bg-white/10 px-2 py-1 text-[10px] hover:bg-white/20"
                      onClick={() => unequipItem(slot)}
                    >
                      Unequip
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === "spellbook" && (
          <div className="space-y-2 text-xs">
            <div className="rounded border border-white/10 bg-white/5 p-2 text-white/70">
              Spells are learned into the spellbook instead of living
              permanently in backpack slots. Scrolls are inventory items until
              used.
            </div>
            {state.spellbook.knownSpells.length ? (
              state.spellbook.knownSpells.map((spell) => {
                const def = SPELL_DEFINITIONS[spell.spellId];
                return (
                  <div
                    key={spell.spellId}
                    className="rounded border-sky-300/30 bg-sky-300/10 border p-2"
                  >
                    <div className="text-sky-100 font-semibold">
                      {def?.icon} {def?.name ?? spell.spellId} Rank{" "}
                      {def?.rank ?? 1}
                    </div>
                    <div className="text-white/70">
                      {def?.school} · {def?.category} · cooldown{" "}
                      {def?.cooldownSeconds}s · range {def?.range}m
                    </div>
                    <div className="mt-1 text-white/60">{def?.description}</div>
                  </div>
                );
              })
            ) : (
              <div className="rounded border border-white/10 bg-white/5 p-2 text-white/70">
                No spells learned yet. Try buying a spell scroll from Wyrm &
                Candle.
              </div>
            )}
          </div>
        )}

        {tab === "wallet" && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(state.wallet).map(([currency, amount]) => (
              <div
                key={currency}
                className="rounded border border-white/10 bg-white/5 p-2"
              >
                <div className="font-semibold capitalize text-white/90">
                  {currency.replaceAll("_", " ")}
                </div>
                <div className="text-amber-100">{amount}</div>
              </div>
            ))}
            <div className="rounded col-span-2 border border-white/10 bg-white/5 p-2">
              <div className="font-semibold text-white/90">Materials</div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-white/70">
                {Object.entries(state.materialStorage).map(([itemId, qty]) => {
                  const def = itemDef(itemId);
                  return (
                    <div
                      key={itemId}
                      className={`rounded px-1.5 flex min-w-0 items-center gap-1 py-1 ${
                        tutorialItemIds.has(itemId)
                          ? "border-lime-200/60 bg-lime-300/20 text-lime-50 border"
                          : "bg-white/5"
                      }`}
                      data-harthmere-tutorial-item-highlight={
                        tutorialItemIds.has(itemId) ? "true" : "false"
                      }
                      data-harthmere-auto-focus={
                        tutorialItemIds.has(itemId) ? "true" : undefined
                      }
                      data-harthmere-inventory-item-id={itemId}
                      tabIndex={tutorialItemIds.has(itemId) ? 0 : undefined}
                    >
                      <span className="shrink-0 text-sm" aria-hidden="true">
                        {def?.icon ?? "◆"}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {def?.name ?? itemId.replaceAll("_", " ")}
                      </span>
                      <span className="shrink-0 font-semibold text-white/90">
                        x{qty}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded col-span-2 border border-white/10 bg-white/5 p-2">
              <div className="font-semibold text-white/90">Quest Pouch</div>
              <div className="mt-1 text-white/70">
                {state.questPouch.length
                  ? state.questPouch.map((item) => itemName(item)).join(", ")
                  : "No quest items."}
              </div>
            </div>
            <div className="rounded col-span-2 border border-white/10 bg-white/5 p-2">
              <div className="font-semibold text-white/90">Keyring</div>
              <div className="mt-1 text-white/70">
                {state.keyring.length
                  ? state.keyring
                      .map((keyId) => itemDef(keyId)?.name ?? keyId)
                      .join(", ")
                  : "No keys yet."}
              </div>
            </div>
          </div>
        )}

        {tab === "bank" && (
          <div className="space-y-2 text-xs">
            <div className="rounded border border-white/10 bg-white/5 p-2 text-white/70">
              Bank storage: {state.bank.items.length}/{state.bank.maxSlots}.
              Quest items stay in the quest pouch. Materials should go to
              material storage.
            </div>
            {state.bank.items.length ? (
              state.bank.items.map((item) => {
                const def = itemDef(item.itemId);
                return (
                  <div
                    key={item.instanceId}
                    className="rounded flex items-center justify-between border border-white/10 bg-white/5 p-2"
                  >
                    <div>
                      <div className="font-semibold text-white/90">
                        {def?.icon} {itemName(item)}{" "}
                        {item.quantity > 1 ? `x${item.quantity}` : ""}
                      </div>
                      <div className="text-white/60">{def?.description}</div>
                    </div>
                    <button
                      className="rounded bg-white/10 px-2 py-1 text-[10px] hover:bg-white/20"
                      onClick={() => withdrawFromBank(item.instanceId)}
                    >
                      Withdraw
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="rounded border border-white/10 bg-white/5 p-2 text-white/70">
                No banked items. Use the Bank button on backpack items or speak
                with bank/service NPCs.
              </div>
            )}
          </div>
        )}

        {tab === "guide" && (
          <div className="space-y-2 text-xs leading-snug text-white/75">
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <div className="text-amber-100 font-semibold">Storage Rules</div>
              Normal items use backpack slots. Quest items go to the quest
              pouch. Currencies go to the wallet. Crafting materials go to
              material storage. Keys go to the keyring. Learned spells go to the
              spellbook.
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <div className="text-amber-100 font-semibold">Safety Rules</div>
              Locked items cannot be sold by quick actions. Quest items are
              protected. Backpack overflow is reported instead of silently
              deleting items.
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <div className="text-amber-100 font-semibold">
                Server Authority Target
              </div>
              This is local-dev UI/state. The production version should validate
              ownership, stack counts, currency, equip rules, vendor prices,
              quest items, trades, crafting, spell knowledge, and cooldowns
              server-side.
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <div className="text-amber-100 font-semibold">
                Recent Transactions
              </div>
              <div className="mt-1 space-y-1">
                {state.recent.slice(0, 6).map((entry) => (
                  <div key={entry.id}>
                    <span className="text-white/90">{entry.action}:</span>{" "}
                    {entry.detail}
                  </div>
                ))}
              </div>
            </div>
            <button
              className="rounded bg-red-500/30 text-red-100 hover:bg-red-500/40 px-2 py-1 text-xs"
              onClick={() => resetInventory()}
            >
              Reset Local-Dev Inventory
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
