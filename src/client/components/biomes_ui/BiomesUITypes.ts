// Shared types for BiomesUI.

export type TabKey =
  | "daily"
  | "inventory"
  | "farming"
  | "abilities"
  | "skills"
  | "classes"
  | "land"
  | "loot"
  | "guilds"
  | "banking"
  | "quests"
  | "recovered"
  | "map"
  | "collections"
  | "inbox"
  | "options";

export const TAB_ORDER: TabKey[] = [
  "daily",
  "inventory",
  "farming",
  "abilities",
  "skills",
  "classes",
  "land",
  "loot",
  "guilds",
  "banking",
  "quests",
  "recovered",
  "map",
  "collections",
  "inbox",
  "options",
];

// R belongs to the original handcraft/Recipes modal. Do not route it through
// the replacement tab rail: doing so captures the event before ShortcutsHUD
// can open crafting and strands native quests such as Busted's Muck Busters.
export const BIOMES_UI_RECIPES_SHORTCUT = "R";
export const BIOMES_UI_RECIPES_KEY_CODE = "KeyR";
export const BIOMES_UI_QUESTS_SHORTCUT = "J";
export const BIOMES_UI_QUESTS_KEY_CODE = "KeyJ";

export interface TabDescriptor {
  key: TabKey;
  label: string;
  /** Short uppercase code displayed beneath the icon, e.g. "INV" */
  code: string;
  /** Direct tab shortcut. Omitted when the key belongs to gameplay UI. */
  shortcut?: string;
  /** Lore-flavored subtitle for the tab header */
  subtitle: string;
}

export const TAB_DESCRIPTORS: Record<TabKey, TabDescriptor> = {
  daily: {
    key: "daily",
    label: "Today",
    code: "DAY",
    subtitle: "Daily check-in, cozy errands, and small rewards",
  },
  inventory: {
    key: "inventory",
    label: "Inventory",
    code: "INV",
    shortcut: "I",
    subtitle: "Equipment, food, materials, and quest items",
  },
  farming: {
    key: "farming",
    label: "Farming",
    code: "FRM",
    shortcut: "P",
    subtitle: "Plant, tend, and harvest crops",
  },
  abilities: {
    key: "abilities",
    label: "Abilities",
    code: "ABI",
    subtitle: "Choose and arrange abilities for combat and exploration",
  },
  skills: {
    key: "skills",
    label: "Skills",
    code: "SKL",
    shortcut: "K",
    subtitle:
      "Build your skills through combat, exploration, crafting, and everyday life",
  },
  classes: {
    key: "classes",
    label: "Classes",
    code: "CLS",
    shortcut: "Y",
    subtitle: "Choose your class and specialization",
  },
  land: {
    key: "land",
    label: "Home & Business",
    code: "BLD",
    shortcut: "L",
    subtitle: "Buy land, build a home or shop, and run your business",
  },
  loot: {
    key: "loot",
    label: "Loot",
    code: "LOT",
    shortcut: "O",
    subtitle: "Review items and rewards you recently received",
  },
  guilds: {
    key: "guilds",
    label: "Guilds",
    code: "GLD",
    shortcut: "G",
    subtitle: "Join other players to share missions and resources",
  },
  banking: {
    key: "banking",
    label: "Bank",
    code: "BNK",
    shortcut: "B",
    subtitle: "Store and manage your money and valuables",
  },
  quests: {
    key: "quests",
    label: "Quests",
    code: "QST",
    shortcut: BIOMES_UI_QUESTS_SHORTCUT,
    subtitle: "Review active, available, and completed quests",
  },
  recovered: {
    key: "recovered",
    label: "Recovered",
    code: "MEM",
    shortcut: "[",
    subtitle: "Review recovered memories, skills, and discoveries",
  },
  map: {
    key: "map",
    label: "Map",
    code: "MAP",
    shortcut: "M",
    subtitle: "View locations, routes, markers, and active destinations",
  },
  collections: {
    key: "collections",
    label: "Collections",
    code: "COL",
    shortcut: "C",
    subtitle: "Review everything you have discovered and collected",
  },
  inbox: {
    key: "inbox",
    label: "Inbox",
    code: "MSG",
    shortcut: "V",
    subtitle: "Read messages from the game, allies, and factions",
  },
  options: {
    key: "options",
    label: "Options",
    code: "OPT",
    shortcut: ",",
    subtitle: "Adjust graphics, audio, controls, and accessibility",
  },
};
