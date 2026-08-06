import {
  BIOMES_UI_QUESTS_KEY_CODE,
  type TabKey,
} from "../BiomesUITypes";

/**
 * Capture-phase shortcuts owned by the replacement tab rail. KeyR is
 * intentionally absent: the original native Recipes/handcraft modal owns it.
 */
const BIOMES_UI_KEY_TO_TAB: Readonly<Record<string, TabKey>> = {
  KeyI: "inventory",
  KeyP: "farming",
  KeyB: "banking",
  KeyK: "skills",
  KeyY: "classes",
  KeyL: "land",
  KeyO: "loot",
  KeyG: "guilds",
  KeyM: "map",
  KeyU: "map",
  BracketLeft: "recovered",
  [BIOMES_UI_QUESTS_KEY_CODE]: "quests",
  BracketRight: "collections",
  KeyV: "inbox",
  Comma: "options",
};

export function biomesUITabForKeyboardCodeForTest(
  code: string,
  worldInteractionOwnsKey = false
) {
  return worldInteractionOwnsKey ? undefined : BIOMES_UI_KEY_TO_TAB[code];
}
