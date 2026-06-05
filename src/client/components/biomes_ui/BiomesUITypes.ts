// Shared types for BiomesUI.

export type TabKey =
  | "daily"
  | "inventory"
  | "abilities"
  | "skills"
  | "classes"
  | "land"
  | "loot"
  | "guilds"
  | "banking"
  | "map"
  | "collections"
  | "inbox"
  | "options";

export const TAB_ORDER: TabKey[] = [
  "daily",
  "inventory",
  "abilities",
  "skills",
  "classes",
  "land",
  "loot",
  "guilds",
  "banking",
  "map",
  "collections",
  "inbox",
  "options",
];

export const BIOMES_UI_OPEN_MENU_TAB: TabKey = "daily";
export const BIOMES_UI_OPEN_MENU_SHORTCUT = "R";
export const BIOMES_UI_OPEN_MENU_KEY_CODE = "KeyR";
export const BIOMES_UI_QUESTS_SHORTCUT = "J";
export const BIOMES_UI_QUESTS_KEY_CODE = "KeyJ";

export interface TabDescriptor {
  key: TabKey;
  label: string;
  /** Short uppercase code displayed beneath the icon, e.g. "INV" */
  code: string;
  shortcut: string;
  /** Lore-flavored subtitle for the tab header */
  subtitle: string;
}

export const TAB_DESCRIPTORS: Record<TabKey, TabDescriptor> = {
  daily: {
    key: "daily",
    label: "Today",
    code: "DAY",
    shortcut: BIOMES_UI_OPEN_MENU_SHORTCUT,
    subtitle: "Daily check-in, cozy errands, and small rewards",
  },
  inventory: {
    key: "inventory",
    label: "Inventory",
    code: "INV",
    shortcut: "I",
    subtitle: "Equipment, food, materials, and quest items",
  },
  abilities: {
    key: "abilities",
    label: "Abilities",
    code: "ABI",
    shortcut: "B",
    subtitle: "Active loadout — slot abilities for combat and exploration",
  },
  skills: {
    key: "skills",
    label: "Skills",
    code: "SKL",
    shortcut: "K",
    subtitle: "Mastery tracks — practice levels gained across disciplines",
  },
  classes: {
    key: "classes",
    label: "Classes",
    code: "CLS",
    shortcut: "Y",
    subtitle: "Specialization — choose your role across the fractured timelines",
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
    subtitle: "Recent drops & rolls — the past tends to leave residue",
  },
  guilds: {
    key: "guilds",
    label: "Guilds",
    code: "GLD",
    shortcut: "G",
    subtitle: "Cohorts across the rift — share missions and resources",
  },
  banking: {
    key: "banking",
    label: "Bank",
    code: "BNK",
    shortcut: "P",
    subtitle: "Exotic-matter vault — secured across timelines",
  },
  map: {
    key: "map",
    label: "Map & Quests",
    code: "MAP",
    shortcut: "M",
    subtitle: "Charts, beacons, mission log",
  },
  collections: {
    key: "collections",
    label: "Collections",
    code: "COL",
    shortcut: "C",
    subtitle: "Cataloged anomalies — every snapped fragment",
  },
  inbox: {
    key: "inbox",
    label: "Inbox",
    code: "MSG",
    shortcut: "V",
    subtitle: "Transmissions — system, ally, and faction messages",
  },
  options: {
    key: "options",
    label: "Options",
    code: "OPT",
    shortcut: ",",
    subtitle: "Calibration — graphics, audio, controls, accessibility",
  },
};
