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
import { hasSelectedWorldInteractionCandidate } from "@/client/components/challenges/worldInteractionDispatcher";

export interface TabShortcut {
  key: string;
  label: string;
  tab: TabKey;
}

export const RESERVED_GAMEPLAY_SHORTCUT_KEYS = new Set(["z", "e", "q"]);

export function isReservedGameplayShortcutKey(key: string): boolean {
  return RESERVED_GAMEPLAY_SHORTCUT_KEYS.has(key.trim().toLowerCase());
}

/** Default keybindings — overridable per-user in OptionsTab. */
export const DEFAULT_TAB_SHORTCUTS: TabShortcut[] = [
  { key: "i", label: "I", tab: "inventory" },
  { key: "p", label: "P", tab: "farming" },
  { key: "k", label: "K", tab: "skills" },
  { key: "y", label: "Y", tab: "classes" },
  { key: "l", label: "L", tab: "land" },
  { key: "o", label: "O", tab: "loot" },
  { key: "g", label: "G", tab: "guilds" },
  { key: "b", label: "B", tab: "banking" },
  { key: "m", label: "M", tab: "map" },
  { key: "[", label: "[", tab: "recovered" },
  { key: "]", label: "]", tab: "collections" },
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
    if (e.defaultPrevented) return;
    if (e.repeat) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingInInput()) return;
    const key = e.key.toLowerCase();
    if (isReservedGameplayShortcutKey(key)) return;
    const match = shortcuts.find((s) => s.key === key);
    if (!match) return;
    const keyCode =
      e.code || (key.length === 1 ? `Key${key.toUpperCase()}` : "");
    if (keyCode && hasSelectedWorldInteractionCandidate(keyCode)) return;
    e.preventDefault();
    onToggle(match.tab);
  }
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
}
