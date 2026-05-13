import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import {
  healHarthmerePlayer,
  reviveHarthmerePlayer,
} from "@/client/components/challenges/LocalDevHarthmereCombat";
import { getHarthmereLevelSummary } from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import React, { useEffect, useMemo, useState } from "react";

const HARTHMERE_INVENTORY_STATE_KEY =
  "biomes.localDev.harthmere.inventoryState.v1";
const HARTHMERE_INVENTORY_EVENT = "biomes:harthmere-inventory-changed";

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
  action: string;
  detail: string;
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
    icon: "▣",
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
    description: "Redeemable at the Black Anvil for local-dev repair service.",
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
    category: "crafting_material",
    subtype: "fish",
    quality: "common",
    icon: "><>",
    stackable: true,
    maxStack: 100,
    bindType: "unbound",
    baseValue: 5,
    description:
      "Fresh fish used in cooking, tavern contracts, and trade crates.",
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
    category: "crafting_material",
    subtype: "vegetable",
    quality: "common",
    icon: "∨",
    stackable: true,
    maxStack: 100,
    bindType: "unbound",
    baseValue: 2,
    description: "Cooking ingredient and farm contract material.",
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
};

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

const VENDOR_STOCK: Record<
  number,
  {
    vendorName: string;
    stocks: { itemId: string; quantity: number; price: number }[];
    buys?: HarthmereItemCategory[];
  }
> = {
  5: {
    vendorName: "Dawn Loaf Bakery",
    stocks: [
      { itemId: "apple_tart", quantity: 2, price: 8 },
      { itemId: "road_ration", quantity: 4, price: 10 },
    ],
    buys: ["food", "crafting_material", "trade_good", "junk"],
  },
  29: {
    vendorName: "Black Anvil Smithy",
    stocks: [
      { itemId: "training_dagger", quantity: 1, price: 28 },
      { itemId: "wooden_shield", quantity: 1, price: 45 },
      { itemId: "iron_longsword", quantity: 1, price: 140 },
    ],
    buys: ["weapon", "armor", "crafting_material", "trade_good", "junk"],
  },
  7: {
    vendorName: "Weapons Counter",
    stocks: [
      { itemId: "training_dagger", quantity: 1, price: 28 },
      { itemId: "wooden_shield", quantity: 1, price: 45 },
    ],
    buys: ["weapon", "armor", "junk"],
  },
  8: {
    vendorName: "Green Mortar Healer",
    stocks: [
      { itemId: "minor_healing_salve", quantity: 3, price: 18 },
      { itemId: "chapel_candle", quantity: 2, price: 12 },
      { itemId: "field_revival_scroll", quantity: 1, price: 90 },
    ],
    buys: ["consumable", "food", "crafting_material", "junk"],
  },
  47: {
    vendorName: "Ysabet's Apothecary Shelf",
    stocks: [
      { itemId: "minor_healing_salve", quantity: 3, price: 18 },
      { itemId: "chapel_candle", quantity: 2, price: 12 },
      { itemId: "field_revival_scroll", quantity: 1, price: 95 },
    ],
    buys: ["consumable", "crafting_material", "junk"],
  },
  9: {
    vendorName: "Wyrm & Candle Magic Shop",
    stocks: [
      { itemId: "scroll_of_spark", quantity: 1, price: 45 },
      { itemId: "field_revival_scroll", quantity: 1, price: 110 },
    ],
    buys: ["spell_scroll", "book", "quest_item", "junk"],
  },
  11: {
    vendorName: "Copper Kettle Bar",
    stocks: [
      { itemId: "road_ration", quantity: 3, price: 9 },
      { itemId: "apple_tart", quantity: 1, price: 5 },
      { itemId: "copper_kettle_token", quantity: 1, price: 10 },
    ],
    buys: ["food", "drink", "event_item", "junk"],
  },
  30: {
    vendorName: "Copper Kettle Inn",
    stocks: [
      { itemId: "road_ration", quantity: 3, price: 9 },
      { itemId: "copper_kettle_token", quantity: 1, price: 10 },
    ],
    buys: ["food", "event_item", "junk"],
  },
  34: {
    vendorName: "River Dock Supply",
    stocks: [
      { itemId: "road_ration", quantity: 2, price: 7 },
      { itemId: "river_knot_marker", quantity: 1, price: 25 },
    ],
    buys: ["trade_good", "crafting_material", "junk"],
  },
  57: {
    vendorName: "Traveling Merchant Ossa",
    stocks: [
      { itemId: "road_ration", quantity: 4, price: 12 },
      { itemId: "minor_healing_salve", quantity: 1, price: 22 },
      { itemId: "iron_key_blank", quantity: 1, price: 15 },
    ],
    buys: ["trade_good", "junk", "food", "tool"],
  },
};

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
    items: [{ itemId: "iron_key_blank", quantity: 1 }],
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

function inventoryEvent() {
  if (isBrowser()) {
    window.dispatchEvent(new Event(HARTHMERE_INVENTORY_EVENT));
  }
}

function instanceId(itemId: string) {
  return `hm-${itemId}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function itemDef(itemId: string) {
  return ITEM_DEFINITIONS[itemId];
}

function makeItemInstance(
  itemId: string,
  quantity = 1,
  location: HarthmereStorageLocation = "backpack",
): HarthmereItemInstance {
  const def = itemDef(itemId);
  return {
    instanceId: instanceId(itemId),
    itemId,
    location,
    quantity,
    durability: def.durabilityMax,
    bound: ["bind_on_pickup", "quest_bound", "account_bound"].includes(
      def.bindType,
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
  detail: string,
): HarthmereInventoryState {
  return {
    ...state,
    recent: [
      {
        id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        at: Date.now(),
        action,
        detail,
      },
      ...state.recent,
    ].slice(0, 18),
  };
}

function emptyState(): HarthmereInventoryState {
  return {
    version: 1,
    backpack: {
      maxSlots: 24,
      items: [
        makeItemInstance("minor_healing_salve", 3, "backpack"),
        makeItemInstance("field_revival_scroll", 1, "backpack"),
        makeItemInstance("road_ration", 5, "backpack"),
        makeItemInstance("cracked_mug", 2, "backpack"),
      ],
    },
    equipment: {
      main_hand: {
        ...makeItemInstance("training_dagger", 1, "equipment"),
        location: "equipment",
        equipmentSlot: "main_hand",
        bound: true,
      },
    },
    questPouch: [],
    materialStorage: { cold_iron_scrap: 2, fresh_egg: 0 },
    keyring: [],
    wallet: {
      gold: 75,
      silver: 0,
      copper: 0,
      harthmere_favor: 0,
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
        action: "Inventory Ready",
        detail:
          "Starter backpack, wallet, equipment slots, quest pouch, material storage, keyring, and spellbook initialized.",
      },
    ],
  };
}

function normalizeInstance(
  raw: Partial<HarthmereItemInstance>,
  fallbackLocation: HarthmereStorageLocation,
): HarthmereItemInstance | undefined {
  if (!raw.itemId || !itemDef(raw.itemId)) {
    return undefined;
  }
  const def = itemDef(raw.itemId);
  return {
    instanceId: raw.instanceId ?? instanceId(raw.itemId),
    itemId: raw.itemId,
    location: raw.location ?? fallbackLocation,
    slotIndex: raw.slotIndex,
    equipmentSlot: raw.equipmentSlot,
    quantity: Math.max(1, raw.quantity ?? 1),
    durability: raw.durability ?? def.durabilityMax,
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
      maxSlots: raw?.backpack?.maxSlots ?? fallback.backpack.maxSlots,
      items: backpackItems.slice(0, raw?.backpack?.maxSlots ?? 24),
    },
    equipment,
    questPouch,
    materialStorage: {
      ...fallback.materialStorage,
      ...(raw?.materialStorage ?? {}),
    },
    keyring: Array.from(new Set(raw?.keyring ?? [])),
    wallet: {
      ...fallback.wallet,
      ...(raw?.wallet ?? {}),
    },
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
    const raw = window.localStorage.getItem(HARTHMERE_INVENTORY_STATE_KEY);
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
  window.localStorage.setItem(
    HARTHMERE_INVENTORY_STATE_KEY,
    JSON.stringify(normalizeState(state)),
  );
  inventoryEvent();
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
  quantity = 1,
): { state: HarthmereInventoryState; added: number; overflow: number } {
  const def = itemDef(itemId);
  if (!def || quantity <= 0) {
    return { state, added: 0, overflow: quantity };
  }

  let remaining = quantity;
  let items = [...state.backpack.items];

  if (def.stackable) {
    for (const item of items) {
      if (item.itemId !== itemId || !stackCompatible(item, item)) {
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
  quantity = 1,
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

export function grantHarthmereItem(
  itemId: string,
  quantity = 1,
  reason = "Item received",
) {
  const def = itemDef(itemId);
  if (!def) {
    return;
  }
  const current = readHarthmereInventoryState();
  const { state, added, overflow } = addItemByStorageRules(
    current,
    itemId,
    quantity,
  );
  const next = appendLog(
    state,
    reason,
    overflow > 0
      ? `${def.name}: added ${added}, overflow ${overflow}. Normal items need backpack space; quest items/materials/keys route to special storage.`
      : `${def.name} x${added} added to ${storageLabelForCategory(def.category)}.`,
  );
  writeHarthmereInventoryState(next);
}

function addGold(state: HarthmereInventoryState, amount: number) {
  return {
    ...state,
    wallet: {
      ...state.wallet,
      gold: Math.max(0, (state.wallet.gold ?? 0) + amount),
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
        (state.wallet.harthmere_favor ?? 0) + amount,
      ),
    },
  };
}

function learnSpell(
  state: HarthmereInventoryState,
  spellId: string,
  source: string,
): { state: HarthmereInventoryState; learned: boolean } {
  if (!SPELL_DEFINITIONS[spellId]) {
    return { state, learned: false };
  }
  if (state.spellbook.knownSpells.some((spell) => spell.spellId === spellId)) {
    return { state, learned: false };
  }
  const firstOpenSlot = Object.entries(state.spellbook.activeSpellSlots).find(
    ([, value]) => !value,
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
  questTitle: string,
) {
  const reward = QUEST_REWARDS[questId];
  if (!reward) {
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
      item.quantity ?? 1,
    );
    state = result.state;
    rewardLines.push(
      `${itemDef(item.itemId)?.name ?? item.itemId} x${result.added}`,
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
        : `already knew ${SPELL_DEFINITIONS[spell.spellId]?.name ?? spell.spellId}`,
    );
  }

  writeHarthmereInventoryState(
    appendLog(
      state,
      "Quest Reward",
      `${questTitle}: ${rewardLines.join(", ") || "reward recorded"}.`,
    ),
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
  quantity = 1,
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
  instanceId: string,
): { state: HarthmereInventoryState; removed?: HarthmereItemInstance } {
  const fromBackpack = removeFromBackpack(
    state,
    instanceId,
    Number.MAX_SAFE_INTEGER,
  );
  if (fromBackpack.removed) {
    return fromBackpack;
  }

  const bankItems = [...state.bank.items];
  const bankIndex = bankItems.findIndex(
    (item) => item.instanceId === instanceId,
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
    (item) => item.instanceId === instanceId,
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
        `${def?.name ?? "Item"} has no use effect.`,
      ),
    );
    return;
  }

  let detail = "";
  if (def.useEffect.type === "heal") {
    healHarthmerePlayer(def.useEffect.amount, def.name);
    detail = `${def.name} used. It attempts to restore ${def.useEffect.amount} HP.`;
  } else if (def.useEffect.type === "revive") {
    reviveHarthmerePlayer();
    detail = `${def.name} used for local-dev revival.`;
  } else if (def.useEffect.type === "learn_spell") {
    const spell = SPELL_DEFINITIONS[def.useEffect.spellId];
    const learned = learnSpell(state, def.useEffect.spellId, def.name);
    state = learned.state;
    detail = learned.learned
      ? `${def.name} taught ${spell?.name ?? def.useEffect.spellId}.`
      : `You already know ${spell?.name ?? def.useEffect.spellId}. The scroll was not consumed.`;
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
}

function equipBackpackItem(instanceId: string) {
  let state = readHarthmereInventoryState();
  const instance = state.backpack.items.find(
    (item) => item.instanceId === instanceId,
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
        `${def?.name ?? "Item"} is not equipment.`,
      ),
    );
    return;
  }

  const levelSummary = getHarthmereLevelSummary();
  if ((def.requiredLevel ?? 1) > levelSummary.state.level) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Level Required",
        `${def.name} requires level ${def.requiredLevel}. You are level ${levelSummary.state.level}.`,
      ),
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
      0,
    );
    state = reinsert.state;
  }

  writeHarthmereInventoryState(
    appendLog(
      state,
      "Equipped",
      `${def.name} equipped to ${def.slot.replaceAll("_", " ")}. ${def.bindType === "bind_on_equip" ? "It is now bound." : ""}`,
    ),
  );
}

function ensureStarterWeaponEquipped() {
  let state = readHarthmereInventoryState();
  if (state.equipment.main_hand) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Weapon Ready",
        `${itemName(state.equipment.main_hand)} is already equipped.`,
      ),
    );
    return;
  }

  const backpackDagger = state.backpack.items.find(
    (item) => item.itemId === "training_dagger",
  );
  if (backpackDagger) {
    equipBackpackItem(backpackDagger.instanceId);
    return;
  }

  state = {
    ...state,
    equipment: {
      ...state.equipment,
      main_hand: {
        ...makeItemInstance("training_dagger", 1, "equipment"),
        location: "equipment",
        equipmentSlot: "main_hand",
        bound: true,
      },
    },
  };
  writeHarthmereInventoryState(
    appendLog(
      state,
      "Starter Weapon Equipped",
      "A Training Dagger was equipped so combat starts with an actual weapon instead of bare hands.",
    ),
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
        `Cannot unequip ${itemDef(item.itemId)?.name ?? "item"}; free a backpack slot first.`,
      ),
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
      `${itemDef(item.itemId)?.name ?? "Item"} returned to your backpack.`,
    ),
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
      ]),
    ) as Partial<Record<EquipmentSlot, HarthmereItemInstance>>,
  };
  writeHarthmereInventoryState(
    appendLog(state, "Lock Toggled", "Item lock status changed."),
  );
}

function sortBackpack() {
  const state = readHarthmereInventoryState();
  const sorted = [...state.backpack.items].sort((a, b) => {
    const da = itemDef(a.itemId);
    const db = itemDef(b.itemId);
    return `${da?.category ?? "zzz"}-${da?.quality ?? "zzz"}-${da?.name ?? a.itemId}`.localeCompare(
      `${db?.category ?? "zzz"}-${db?.quality ?? "zzz"}-${db?.name ?? b.itemId}`,
    );
  });
  writeHarthmereInventoryState(
    appendLog(
      { ...state, backpack: { ...state.backpack, items: sorted } },
      "Sorted",
      "Backpack sorted by category, quality, and name.",
    ),
  );
}

function sellJunk() {
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
    gold,
  );
  writeHarthmereInventoryState(
    appendLog(
      state,
      "Sold Junk",
      gold > 0
        ? `Sold unlocked junk for ${gold} gold.`
        : "No unlocked junk was available to sell.",
    ),
  );
}

function depositMaterials() {
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
        : "No loose crafting materials were in the backpack.",
    ),
  );
}

function repairAllEquipment() {
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
    }),
  ) as Partial<Record<EquipmentSlot, HarthmereItemInstance>>;
  writeHarthmereInventoryState(
    appendLog(
      { ...state, equipment },
      "Repaired Gear",
      "Equipped gear durability was restored for local-dev testing.",
    ),
  );
}

function resetInventory() {
  writeHarthmereInventoryState(
    appendLog(emptyState(), "Inventory Reset", "Local-dev inventory reset."),
  );
}

function buyFromVendor(
  offset: number,
  itemId: string,
  quantity: number,
  price: number,
) {
  const vendor = VENDOR_STOCK[offset];
  const def = itemDef(itemId);
  if (!vendor || !def) {
    return;
  }
  let state = readHarthmereInventoryState();
  const total = price;
  if ((state.wallet.gold ?? 0) < total) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Cannot Buy",
        `${vendor.vendorName} asks ${total} gold for ${def.name}; you do not have enough.`,
      ),
    );
    return;
  }

  let result = addItemByStorageRules(state, itemId, quantity);
  state = result.state;
  if (result.added <= 0 || result.overflow > 0) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Cannot Buy",
        `${def.name} could not fit in the correct storage. Free space first.`,
      ),
    );
    return;
  }
  state = addGold(state, -total);
  writeHarthmereInventoryState(
    appendLog(
      { ...state, lastVendor: vendor.vendorName },
      "Bought Item",
      `${def.name} x${quantity} bought from ${vendor.vendorName} for ${total} gold.`,
    ),
  );
}

function transferToBank(instanceId: string) {
  let state = readHarthmereInventoryState();
  if (state.bank.items.length >= state.bank.maxSlots) {
    writeHarthmereInventoryState(
      appendLog(state, "Bank Full", "No bank slot is available."),
    );
    return;
  }
  const removed = removeFromBackpack(
    state,
    instanceId,
    Number.MAX_SAFE_INTEGER,
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
        "Quest items stay in the quest pouch and cannot be banked.",
      ),
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
    appendLog(state, "Bank Deposit", `${def?.name ?? "Item"} moved to bank.`),
  );
}

function withdrawFromBank(instanceId: string) {
  let state = readHarthmereInventoryState();
  if (state.backpack.items.length >= state.backpack.maxSlots) {
    writeHarthmereInventoryState(
      appendLog(
        state,
        "Backpack Full",
        "Free a backpack slot before withdrawing.",
      ),
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
      `${itemDef(item.itemId)?.name ?? "Item"} moved to backpack.`,
    ),
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
    readHarthmereInventoryState(),
  );

  useEffect(() => {
    const refresh = () => setState(readHarthmereInventoryState());
    const interval = window.setInterval(refresh, 750);
    window.addEventListener("storage", refresh);
    window.addEventListener(HARTHMERE_INVENTORY_EVENT, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(HARTHMERE_INVENTORY_EVENT, refresh);
    };
  }, []);

  return state;
}

export function inventoryActionsForHarthmereNpc(
  offset: number,
): TalkDialogStepAction[] {
  const vendor = VENDOR_STOCK[offset];
  const actions: TalkDialogStepAction[] = [];

  if (vendor) {
    for (const stock of vendor.stocks.slice(0, 3)) {
      const def = itemDef(stock.itemId);
      if (!def) {
        continue;
      }
      actions.push({
        name: `Buy ${def.name}`,
        tooltip: `${stock.price} gold. Stored in ${storageLabelForCategory(def.category)}. ${def.description}`,
        onPerformed: () =>
          buyFromVendor(offset, stock.itemId, stock.quantity, stock.price),
      });
    }
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
      name: "Ready a starter weapon",
      tooltip:
        "Equips a Training Dagger if you do not currently have a weapon. Combat damage now reads your equipped weapon.",
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

function InventorySlot({
  item,
  onUse,
  onEquip,
  onBank,
  onLock,
}: {
  item: HarthmereItemInstance;
  onUse?: () => void;
  onEquip?: () => void;
  onBank?: () => void;
  onLock?: () => void;
}) {
  const def = itemDef(item.itemId);
  if (!def) {
    return null;
  }
  const qualityStyle = QUALITY_STYLE[def.quality];
  return (
    <div className={`rounded border bg-black/40 p-2 ${qualityStyle}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-base font-bold">
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
          ? ` Durability: ${item.durability ?? def.durabilityMax}/${def.durabilityMax}.`
          : ""}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {def.useEffect && (
          <button
            className="rounded bg-white/10 px-2 py-0.5 text-[10px] hover:bg-white/20"
            onClick={onUse}
          >
            Use
          </button>
        )}
        {def.slot && (
          <button
            className="rounded bg-white/10 px-2 py-0.5 text-[10px] hover:bg-white/20"
            onClick={onEquip}
          >
            Equip
          </button>
        )}
        {onBank && def.category !== "quest_item" && (
          <button
            className="rounded bg-white/10 px-2 py-0.5 text-[10px] hover:bg-white/20"
            onClick={onBank}
          >
            Bank
          </button>
        )}
        <button
          className="rounded bg-white/10 px-2 py-0.5 text-[10px] hover:bg-white/20"
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
      className="pointer-events-none w-[21rem] rounded-lg border border-white/20 bg-black/70 p-2 text-white shadow-lg"
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-amber-200">
            Harthmere Inventory
          </div>
          <div className="text-xs text-white/80">
            Backpack {inventoryUsed(state)}/{state.backpack.maxSlots} · Gold{" "}
            {state.wallet.gold ?? 0}
          </div>
        </div>
        <div className="rounded bg-white/10 px-1.5 py-0.5 text-xs font-semibold text-white/80">
          {equippedWeapon ? itemName(equippedWeapon) : "No weapon"}
        </div>
      </div>
      <div className="mt-1 text-xs leading-snug text-white/80">
        <span className="font-semibold text-amber-100">Latest:</span>{" "}
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
  const stats = totalEquippedStats(state);

  const filteredBackpack = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return state.backpack.items;
    }
    return state.backpack.items.filter((item) => {
      const def = itemDef(item.itemId);
      return `${def?.name ?? item.itemId} ${def?.category ?? ""} ${def?.quality ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [query, state.backpack.items]);

  return (
    <div className="mb-2 max-h-[70vh] w-[31rem] overflow-hidden rounded-lg border border-white/20 bg-black/85 text-white shadow-xl">
      <div className="border-b border-white/10 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-amber-200">
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
                className="min-w-0 flex-1 rounded border border-white/15 bg-black/50 px-2 py-1 text-xs text-white placeholder:text-white/40"
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
                  className="flex items-center justify-between rounded border border-white/10 bg-white/5 p-2 text-xs"
                >
                  <div>
                    <div className="font-semibold capitalize text-white/90">
                      {slot.replaceAll("_", " ")}
                    </div>
                    <div className="text-white/60">
                      {item && def
                        ? `${def.icon} ${itemName(item)} · durability ${item.durability ?? def.durabilityMax ?? "—"}/${def.durabilityMax ?? "—"}`
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
                    className="rounded border border-sky-300/30 bg-sky-300/10 p-2"
                  >
                    <div className="font-semibold text-sky-100">
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
            <div className="col-span-2 rounded border border-white/10 bg-white/5 p-2">
              <div className="font-semibold text-white/90">Materials</div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-white/70">
                {Object.entries(state.materialStorage).map(([itemId, qty]) => (
                  <div key={itemId}>
                    {itemDef(itemId)?.name ?? itemId}: {qty}
                  </div>
                ))}
              </div>
            </div>
            <div className="col-span-2 rounded border border-white/10 bg-white/5 p-2">
              <div className="font-semibold text-white/90">Quest Pouch</div>
              <div className="mt-1 text-white/70">
                {state.questPouch.length
                  ? state.questPouch.map((item) => itemName(item)).join(", ")
                  : "No quest items."}
              </div>
            </div>
            <div className="col-span-2 rounded border border-white/10 bg-white/5 p-2">
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
                    className="flex items-center justify-between rounded border border-white/10 bg-white/5 p-2"
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
              <div className="font-semibold text-amber-100">Storage Rules</div>
              Normal items use backpack slots. Quest items go to the quest
              pouch. Currencies go to the wallet. Crafting materials go to
              material storage. Keys go to the keyring. Learned spells go to the
              spellbook.
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <div className="font-semibold text-amber-100">Safety Rules</div>
              Locked items cannot be sold by quick actions. Quest items are
              protected. Backpack overflow is reported instead of silently
              deleting items.
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <div className="font-semibold text-amber-100">
                Server Authority Target
              </div>
              This is local-dev UI/state. The production version should validate
              ownership, stack counts, currency, equip rules, vendor prices,
              quest items, trades, crafting, spell knowledge, and cooldowns
              server-side.
            </div>
            <div className="rounded border border-white/10 bg-white/5 p-2">
              <div className="font-semibold text-amber-100">
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
              className="rounded bg-red-500/30 px-2 py-1 text-xs text-red-100 hover:bg-red-500/40"
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
