// (combat fix C-4, 2026-07-14)
// -----------------------------------------------------------------------------
// Resolve the weapon TYPE a Harthmere live-mode player actually has equipped.
//
// buildActorSnapshot() in live_mode_backend.ts used to hard-code the player's
// main-hand as "sword" (and off-hand "none"). That silently bypassed every
// ability's `requiredWeaponType` gate: a bow/staff/mace ability either always
// passed or always failed regardless of what the player was really holding.
//
// The live-mode player carries an equipment map (slot -> itemId). This module
// turns the equipped main-hand / off-hand item ids into the combat-authority
// HarthmereWeaponType used by weapon gating, so the gate reflects reality.
//
// Resolution order for an item id:
//   1. the authored equipment catalogue's `subtype` (source of truth), mapped
//      onto the combat-authority weapon vocabulary;
//   2. a name-based fallback for ids not in the catalogue (mirror-equipped
//      local items such as `woodsman_axe`, `two_handed_sword`, `muck_rake`);
//   3. "unarmed" when nothing weapon-like is equipped.
// Pure and dependency-light so every branch is unit-testable.
// -----------------------------------------------------------------------------

import { HARTHMERE_EQUIPMENT_CATALOG } from "./complete_combat_progression";
import type { HarthmereWeaponType } from "./mmo_combat_authority";

export const HARTHMERE_EQUIPPED_WEAPON_TYPE_VERSION =
  "harthmere-equipped-weapon-type-2026-07-14" as const;

export const HARTHMERE_MAIN_HAND_EQUIPMENT_SLOTS = [
  "main_hand",
  "mainHand",
  "mainhand",
  "weapon",
] as const;

export const HARTHMERE_OFF_HAND_EQUIPMENT_SLOTS = [
  "off_hand",
  "offHand",
  "offhand",
  "shield",
] as const;

// Map the broader authored equipment subtypes onto the narrower combat-authority
// weapon vocabulary that abilities gate against. Anything not listed (shield,
// tool, armor subtypes like "medium"/"cloth") is not a usable weapon type.
const SUBTYPE_TO_WEAPON_TYPE: Record<string, HarthmereWeaponType> = {
  sword: "sword",
  short_sword: "sword",
  rapier: "sword",
  great_weapon: "sword",
  axe: "axe",
  mace: "mace",
  hammer: "mace",
  dagger: "dagger",
  staff: "staff",
  bow: "bow",
  crossbow: "crossbow",
  wand: "wand",
  fist_weapon: "unarmed",
  unarmed: "unarmed",
};

function weaponTypeFromName(itemId: string): HarthmereWeaponType | undefined {
  const text = itemId.toLowerCase();
  // Order matters: check the more specific tokens first (crossbow before bow,
  // longsword/greatsword before generic sword).
  if (/crossbow/.test(text)) return "crossbow";
  if (/\bbow\b|longbow|shortbow|hunting_bow/.test(text)) return "bow";
  if (/dagger|dirk|knife|stiletto/.test(text)) return "dagger";
  if (/axe|hatchet|rake/.test(text)) return "axe";
  if (/mace|mallet|maul|hammer|spanner|club/.test(text)) return "mace";
  if (/staff|quarterstaff|pilgrim_staff/.test(text)) return "staff";
  if (/wand/.test(text)) return "wand";
  if (/sword|longsword|greatsword|blade|sabre|saber|rapier/.test(text)) {
    return "sword";
  }
  return undefined;
}

/**
 * Weapon type for a single equipped item id, or undefined when the item is not
 * a usable weapon (empty slot, shield, armor, generic tool with no weapon
 * meaning).
 */
export function harthmereWeaponTypeForEquippedItem(
  itemId: string | undefined
): HarthmereWeaponType | undefined {
  if (!itemId) return undefined;
  const catalogEntry = (HARTHMERE_EQUIPMENT_CATALOG as Record<
    string,
    { subtype?: string; category?: string }
  >)[itemId];
  if (catalogEntry?.subtype) {
    const mapped = SUBTYPE_TO_WEAPON_TYPE[catalogEntry.subtype];
    if (mapped) return mapped;
    // Catalogued but a non-weapon subtype (shield/medium/cloth/tool): only fall
    // through to name inference for the generic "tool" subtype, which covers
    // improvised weapons like the muck rake.
    if (catalogEntry.subtype !== "tool") return undefined;
  }
  return weaponTypeFromName(itemId);
}

function firstEquippedItemId(
  equipment: Record<string, string> | undefined,
  slots: readonly string[]
): string | undefined {
  if (!equipment) return undefined;
  for (const slot of slots) {
    const itemId = equipment[slot];
    if (itemId) return itemId;
  }
  return undefined;
}

/**
 * The main-hand weapon type for weapon gating. Defaults to "unarmed" (rather
 * than the old hard-coded "sword") when no weapon is equipped, so unarmed
 * abilities gate correctly and weapon-required abilities are correctly refused.
 */
export function harthmereMainHandWeaponType(
  equipment: Record<string, string> | undefined
): HarthmereWeaponType {
  const itemId = firstEquippedItemId(
    equipment,
    HARTHMERE_MAIN_HAND_EQUIPMENT_SLOTS
  );
  return harthmereWeaponTypeForEquippedItem(itemId) ?? "unarmed";
}

/**
 * The off-hand weapon type, or "none" when the off-hand is empty or holds a
 * non-weapon (e.g. a shield).
 */
export function harthmereOffHandWeaponType(
  equipment: Record<string, string> | undefined
): HarthmereWeaponType | "none" {
  const itemId = firstEquippedItemId(
    equipment,
    HARTHMERE_OFF_HAND_EQUIPMENT_SLOTS
  );
  return harthmereWeaponTypeForEquippedItem(itemId) ?? "none";
}
