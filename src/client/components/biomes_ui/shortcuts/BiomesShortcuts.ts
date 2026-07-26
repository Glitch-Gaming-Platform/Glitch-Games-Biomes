// Centralized shortcut map for BiomesUI.
//
// The hotbar 1..9 keys go through the existing biomes hotbar machinery
// (see HotBar.tsx). The shortcuts below add fast access to every UI tab
// — they fire even when the main pause menu is closed, mirroring the
// "press M for map" pattern most players already expect.
//
// We intentionally keep tab keys to single letters that don't collide
// with movement (WASD/space/shift). If a user already mapped a letter
// elsewhere, the user-facing Options tab exposes a remapping panel
// (see OptionsTab.tsx).

import type { TabKey } from "../BiomesUITypes";

export interface TabShortcut {
  key: string;
  label: string;
  tab: TabKey;
}

/** Default keybindings — overridable per-user in OptionsTab. */
export const DEFAULT_TAB_SHORTCUTS: TabShortcut[] = [
  { key: "i", label: "I", tab: "inventory" },
  { key: "p", label: "P", tab: "farming" },
  { key: "b", label: "B", tab: "abilities" },
  { key: "k", label: "K", tab: "skills" },
  { key: "y", label: "Y", tab: "classes" },
  { key: "l", label: "L", tab: "land" },
  { key: "o", label: "O", tab: "loot" },
  { key: "g", label: "G", tab: "guilds" },
  { key: "q", label: "Q", tab: "banking" },
  { key: "m", label: "M", tab: "map" },
  { key: "z", label: "Z", tab: "recovered" },
  { key: "c", label: "C", tab: "collections" },
  { key: "v", label: "V", tab: "inbox" },
  { key: ",", label: ",", tab: "options" },
];

/** Toggle (open if closed, close if open and on this tab). */
export type TabToggleHandler = (tab: TabKey) => void;

/**
 * Install global keydown handlers for tab shortcuts. Returns a cleanup fn.
 * Accepts a "isTypingInInput" guard so we never steal keys from chat or
 * any other input element.
 */
export function installTabShortcuts(
  shortcuts: TabShortcut[],
  onToggle: TabToggleHandler,
  isTypingInInput: () => boolean
): () => void {
  function onKeyDown(e: KeyboardEvent) {
    if (e.repeat) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingInInput()) return;
    const key = e.key.toLowerCase();
    const match = shortcuts.find((s) => s.key === key);
    if (!match) return;
    e.preventDefault();
    onToggle(match.tab);
  }
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}
