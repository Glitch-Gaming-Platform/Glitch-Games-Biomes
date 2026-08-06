import type { ReadonlyEmote } from "@/shared/ecs/gen/components";
import type { ReadonlyItem } from "@/shared/ecs/gen/types";
import { harthmereNativeItemDefinitionForBiomesId } from "@/shared/harthmere/harthmere_native_combat";
import { harthmereNativeItemIdForBiomesId } from "@/shared/harthmere/harthmere_native_item_ids";

export const HARTHMERE_MELEE_HIT_SOUND_DURATION_SECONDS = 0.15;

export const HARTHMERE_MELEE_HIT_SOUND_IDS = {
  unarmed: "melee_hit_unarmed_slap",
  tool: "melee_hit_tool_wood",
  weapon: "melee_hit_weapon_clink",
} as const;

export type HarthmereMeleeHitSoundKind =
  keyof typeof HARTHMERE_MELEE_HIT_SOUND_IDS;

const HARTHMERE_UTILITY_TOOL_ITEM_IDS = new Set([
  "rusty_pickaxe",
  "woodcutters_axe",
  "herbalist_sickle",
  "simple_fishing_rod",
  "skinning_knife",
  "scavenger_hook",
  "clay_shovel",
  "arcane_extractor",
  "muck_rake",
  "repair_mallet",
  "containment_tongs",
  "anchor_wrench",
]);

export function harthmereMeleeHitItem(
  attackerEmote: ReadonlyEmote | undefined,
  selectedItem: ReadonlyItem | undefined
) {
  return attackerEmote?.rich_emote_components?.item_override ?? selectedItem;
}

export function harthmereMeleeHitSoundKindForItem(
  item: Pick<ReadonlyItem, "id" | "isAxe" | "isPickaxe"> | undefined
): HarthmereMeleeHitSoundKind {
  if (!item) {
    return "unarmed";
  }
  const definition = harthmereNativeItemDefinitionForBiomesId(item.id);
  if (definition) {
    return definition.category === "tool" ? "tool" : "weapon";
  }
  const semanticItemId = harthmereNativeItemIdForBiomesId(item.id);
  if (semanticItemId) {
    return HARTHMERE_UTILITY_TOOL_ITEM_IDS.has(semanticItemId)
      ? "tool"
      : "weapon";
  }
  return item.isAxe || item.isPickaxe ? "tool" : "weapon";
}

export function harthmereMeleeHitSoundIdForItem(
  item: Pick<ReadonlyItem, "id" | "isAxe" | "isPickaxe"> | undefined
) {
  return HARTHMERE_MELEE_HIT_SOUND_IDS[harthmereMeleeHitSoundKindForItem(item)];
}
