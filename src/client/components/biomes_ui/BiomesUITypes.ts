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
    subtitle: "Till voxel soil, tend native crops, and harvest the field",
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
    subtitle:
      "Specialization — choose your role across the fractured timelines",
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
    shortcut: "Q",
    subtitle: "Exotic-matter vault — secured across timelines",
  },
  quests: {
    key: "quests",
    label: "Quests",
    code: "QST",
    shortcut: BIOMES_UI_QUESTS_SHORTCUT,
    subtitle: "Your quest log — active, available, and what must be done",
  },
  recovered: {
    key: "recovered",
    label: "Recovered",
    code: "MEM",
    shortcut: "Z",
    subtitle: "Fragments, confidence, latent skills, and what changed",
  },
  map: {
    key: "map",
    label: "Map",
    code: "MAP",
    shortcut: "M",
    subtitle: "Charts, beacons, routes, and active destinations",
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
