// Shared types for BiomesUI.

export type TabKey =
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
  inventory: {
    key: "inventory",
    label: "Inventory",
    code: "INV",
    shortcut: "I",
    subtitle: "Personal manifest — equipment, consumables, quest payload",
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
    label: "Land",
    code: "LND",
    shortcut: "L",
    subtitle: "Biome ownership — claim, configure, defend your pocket dimension",
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
