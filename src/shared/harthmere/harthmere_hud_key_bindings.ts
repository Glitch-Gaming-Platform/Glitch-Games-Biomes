// BIOMES_HUD_KEY_BINDINGS
// Central contract for the local-dev Biomes/Harthmere HUD hotkeys.
// Tests lock these bindings so bottom-bar labels, keyboard behavior, and menu targets do not drift.

export type HarthmereHudSystemTab =
  | "journal"
  | "inventory"
  | "combat"
  | "standing"
  | "skills"
  | "world"
  | "dialogue";

export type HarthmereHudAction =
  | "inventory"
  | "crafting"
  | "map"
  | "quests"
  | "tasks"
  | "mail"
  | "notifications"
  | "codex"
  | "settings";

export type HarthmereHudTargetPanel = "map" | "quests" | "systems";

export interface HarthmereHudKeyBinding {
  readonly action: HarthmereHudAction;
  readonly key: string;
  readonly code: string;
  readonly label: string;
  readonly eventName: string;
  readonly targetPanel: HarthmereHudTargetPanel;
  readonly targetTab?: HarthmereHudSystemTab;
  readonly ruleRef: string;
}

export const HARTHMERE_HUD_KEY_BINDINGS: readonly HarthmereHudKeyBinding[] = [
  {
    action: "inventory",
    key: "I",
    code: "KeyI",
    label: "Bag",
    eventName: "biomes:harthmere-toggle-inventory",
    targetPanel: "systems",
    targetTab: "inventory",
    ruleRef: "MMO_RULES inventory/storage and Harthmere Town Design Bible service readability",
  },
  {
    action: "crafting",
    key: ";",
    code: "Semicolon",
    label: "Craft",
    eventName: "biomes:harthmere-toggle-crafting",
    targetPanel: "systems",
    targetTab: "world",
    ruleRef: "MMO_RULES crafting/resource progression and Town Design Bible service hubs",
  },
  {
    action: "map",
    key: "M",
    code: "KeyM",
    label: "Map",
    eventName: "biomes:harthmere-toggle-map",
    targetPanel: "map",
    ruleRef: "Snapshot Map Landscape Guide Rule 3 and Grove Lore objective continuity",
  },
  {
    action: "quests",
    key: "J",
    code: "KeyJ",
    label: "Quests",
    eventName: "biomes:harthmere-toggle-quests",
    targetPanel: "quests",
    ruleRef: "Grove Lore Bible objective state should remain readable in HUD/map/journal",
  },
  {
    action: "tasks",
    key: "K",
    code: "KeyK",
    label: "Tasks",
    eventName: "biomes:harthmere-toggle-challenges",
    targetPanel: "systems",
    targetTab: "journal",
    ruleRef: "MMO_RULES objectives must be clear and mapped",
  },
  {
    action: "mail",
    key: "Y",
    code: "KeyY",
    label: "Mail",
    eventName: "biomes:harthmere-toggle-mail",
    targetPanel: "systems",
    targetTab: "world",
    ruleRef: "Town Design Bible service UX for mail/storage/recovery systems",
  },
  {
    action: "notifications",
    key: "N",
    code: "KeyN",
    label: "Notif",
    eventName: "biomes:harthmere-toggle-notifs",
    targetPanel: "systems",
    targetTab: "journal",
    ruleRef: "MMO_RULES objectives/events should be visible without blocking play",
  },
  {
    action: "codex",
    key: "V",
    code: "KeyV",
    label: "Codex",
    eventName: "biomes:harthmere-toggle-codex",
    targetPanel: "systems",
    targetTab: "dialogue",
    ruleRef: "Harthmere lore/rules bibles should be inspectable from the local-dev HUD",
  },
  {
    action: "settings",
    key: "Esc",
    code: "Escape",
    label: "Settings",
    eventName: "biomes:harthmere-toggle-settings",
    targetPanel: "systems",
    targetTab: "world",
    ruleRef: "Harthmere Town Design Bible §14 readable service/system UX",
  },
] as const;

export function harthmereHudBindingForCode(code: string): HarthmereHudKeyBinding | undefined {
  return HARTHMERE_HUD_KEY_BINDINGS.find((binding) => binding.code === code);
}

export function harthmereHudBindingForAction(action: HarthmereHudAction): HarthmereHudKeyBinding {
  const binding = HARTHMERE_HUD_KEY_BINDINGS.find((entry) => entry.action === action);
  if (!binding) {
    throw new Error(`Missing Harthmere HUD binding for action ${action}`);
  }
  return binding;
}

export function dispatchHarthmereHudActionEvent(
  action: HarthmereHudAction,
) {
  if (typeof window === "undefined") {
    return;
  }
  const binding = harthmereHudBindingForAction(action);
  window.dispatchEvent(
    new CustomEvent("biomes:harthmere-hud-action", {
      detail: { action, binding },
    }),
  );
  window.dispatchEvent(new CustomEvent(binding.eventName, { detail: binding }));
}
