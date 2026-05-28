// Canonical registry of every unique id the tutorial / quest system can blink.
//
// Keeping these centralized prevents typos and lets us validate at build time
// (the verification script in scripts/harthmere/ asserts every TUT id used by
// the tutorial map exists here).

export const UI_IDS = {
  // Top-level tabs
  TAB_INVENTORY: "tab.inventory",
  TAB_ABILITIES: "tab.abilities",
  TAB_SKILLS: "tab.skills",
  TAB_CLASSES: "tab.classes",
  TAB_LAND: "tab.land",
  TAB_LOOT: "tab.loot",
  TAB_GUILDS: "tab.guilds",
  TAB_BANKING: "tab.banking",
  TAB_MAP: "tab.map",
  TAB_COLLECTIONS: "tab.collections",
  TAB_INBOX: "tab.inbox",
  TAB_OPTIONS: "tab.options",

  // Player vitals / social standing HUD
  HUD_VITALS: "hud.vitals",
  HUD_VITALS_HEALTH: "hud.vitals.health",
  HUD_VITALS_MANA: "hud.vitals.mana",
  HUD_VITALS_LIKEABILITY: "hud.vitals.likeability",
  HUD_VITALS_LEGAL: "hud.vitals.legal",
  HUD_VITALS_NOTORIETY: "hud.vitals.notoriety",
  HUD_PROMPT_OPEN_MENU: "hud.prompt.open_menu",

  // Hotbar slots
  HOTBAR_SLOT: (n: number) => `hotbar.slot_${n}`,

  // Inventory equipment slots
  INVENTORY_SLOT_CHEST: "inventory.slot.chest",
  INVENTORY_SLOT_LEGS: "inventory.slot.legs",
  INVENTORY_SLOT_HEAD: "inventory.slot.head",
  INVENTORY_SLOT_FEET: "inventory.slot.feet",
  INVENTORY_SLOT_HANDS: "inventory.slot.hands",
  INVENTORY_SLOT_MAIN_HAND: "inventory.slot.main_hand",
  INVENTORY_SLOT_OFF_HAND: "inventory.slot.off_hand",

  // Specific recipes / actions
  RECIPE_MUCK_BUSTER: "recipes.muck_buster",
  RECIPE_LIST: "recipes.list",

  // Camera / selfie
  CAMERA_BUTTON: "camera.button",
  CAMERA_SELFIE_MODE: "camera.selfie",

  // Movement tutorial cues
  CUE_SPRINT: "movement.cue.sprint",
  CUE_JUMP: "movement.cue.jump",

  // Map markers (the in-world markers — UI id forwarded to mini-map)
  MAP_MARKER: (id: string) => `map.marker.${id}`,

  // Ability slots
  ABILITY_SLOT: (n: number) => `abilities.slot_${n}`,

  // Skill rows
  SKILL_ROW: (id: string) => `skills.row.${id}`,

  // Class card
  CLASS_CARD: (id: string) => `classes.card.${id}`,

  // Land tiles
  LAND_PLOT: (id: string) => `land.plot.${id}`,

  // Loot rolls
  LOOT_ENTRY: (id: string) => `loot.entry.${id}`,

  // Guild
  GUILD_ROSTER: "guilds.roster",
  GUILD_RANK: (id: string) => `guilds.rank.${id}`,

  // Banking
  BANKING_DEPOSIT: "banking.deposit",
  BANKING_WITHDRAW: "banking.withdraw",
  BANKING_VAULT_SLOT: (n: number) => `banking.vault.slot_${n}`,
} as const;

export type UiId = string;
