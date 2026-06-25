import {
  getHarthmereItemDefinition,
  type HarthmereItemDefinition,
} from "./mmo_inventory_authority";

/** Maximum total inventory weight (in pounds) a player can carry before they are
 *  encumbered. Carrying at or below this limit incurs no penalty. */
export const HARTHMERE_CARRY_WEIGHT_LIMIT = 25;

/** Stamina-drain penalty applied per pound carried over the limit. The penalty
 *  COMPOUNDS: each excess pound multiplies the drain rate by this factor, so the
 *  effective multiplier is `FACTOR ^ poundsOver`. Each pound adds a +1/6 (≈16.7%)
 *  marginal drain — a third of the original +1/2 (50%) tuning, i.e. "1/3 as brutal":
 *  1 over → ~1.17x, 2 over → ~1.36x, 5 over → ~2.2x, 10 over → ~4.5x. */
export const HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB = 1 + 0.5 / 3;

export function isLikelyBankingMaterialItemId(itemId: string) {
  return /(ore|wood|log|stone|clay|fiber|hide|meat|herb|mushroom|ingot|shard|crystal|sand|salt|grain|cloth|coal|copper|iron|silver|gold|exotic|matter|resource|material)/i.test(
    itemId
  );
}

export function itemCategoryFromDefinition(
  def: HarthmereItemDefinition | undefined,
  itemId: string,
  hint?: { category?: string; displayName?: string }
) {
  const hintedCategory = String(hint?.category ?? "").toLowerCase();
  const text = `${itemId} ${def?.displayName ?? ""} ${
    hint?.displayName ?? ""
  } ${hintedCategory}`.toLowerCase();
  if (def?.isCurrency) return "currency";
  if (def?.isQuestItem || def?.binding === "quest") return "quest";
  if (hintedCategory.includes("currency")) return "currency";
  if (hintedCategory.includes("quest")) return "quest";
  if (/seed|spore|fruit|vegetable|food|drink|ration|meal|berry/.test(text))
    return "consumables";
  if (def?.isCraftingMaterial || isLikelyBankingMaterialItemId(itemId))
    return "materials";
  if (
    hintedCategory.includes("material") ||
    hintedCategory.includes("crafting")
  )
    return "materials";
  if (def?.isConsumable || /potion|food|ration|drink|meal|medicine/.test(text))
    return "consumables";
  if (
    /sword|axe|pickaxe|tool|hammer|bow|staff|wand|shield|armor|helm|boots|glove/.test(
      text
    )
  )
    return "tools";
  return "item";
}

function fallbackHarthmereItemUnitWeight(
  itemId: string,
  def: HarthmereItemDefinition | undefined,
  hint?: { category?: string; displayName?: string }
) {
  const category = itemCategoryFromDefinition(def, itemId, hint);
  const text = `${itemId} ${def?.displayName ?? ""} ${
    hint?.displayName ?? ""
  } ${hint?.category ?? ""}`.toLowerCase();
  if (category === "currency") return 0;
  if (category === "quest") return 0.1;
  if (/seed|spore/.test(text)) return 0.05;
  if (/berry|raspberry|strawberry|grape|banana|tomato/.test(text)) return 0.1;
  if (/carrot|corn|onion|turnip|radish|cabbage|potato|pumpkin/.test(text))
    return 0.25;
  if (/wheat|grain|flour|coffee bean/.test(text)) return 0.15;
  if (/milk|smoothie|tea|coffee|cola|drink/.test(text)) return 0.75;
  if (/ration|bread|tart|soup|stew|burger|sandwich|popcorn|meal/.test(text))
    return 0.5;
  if (/raw .*meat|meat|fish|sashimi|patty/.test(text)) return 0.75;
  if (/cloth|fiber|hide|hemp|cotton|flax|ramie/.test(text)) return 0.25;
  if (/key|coin|old coin|token/.test(text)) return 0.05;
  if (/shirt|apron|trouser|pants|boots|hat|helmet|glove/.test(text))
    return 1;
  if (/block|voxel|muckwad|stone|clay|sand|wood|log/.test(text)) return 1;
  if (/ore|ingot|coal|crystal|shard|matter/.test(text)) return 1.5;
  if (/sword|axe|pickaxe|hammer|bow|staff|wand|shield|armor|tool/.test(text))
    return 5;
  if (category === "materials") return 0.5;
  if (category === "tools") return 5;
  if (category === "consumables") return 0.5;
  return 1;
}

export function harthmereItemUnitWeight(
  itemId: string,
  hint?: { category?: string; displayName?: string }
) {
  const def = getHarthmereItemDefinition(itemId);
  const explicit = Number(
    (def as any)?.weight ??
      (def as any)?.carryWeight ??
      (def as any)?.mass ??
      def?.stats?.weight ??
      def?.stats?.carryWeight ??
      def?.stats?.mass
  );
  if (Number.isFinite(explicit) && explicit >= 0) {
    return explicit;
  }
  return fallbackHarthmereItemUnitWeight(itemId, def, hint);
}

export function harthmereInventoryCarryWeight(items: Record<string, number>) {
  return Object.entries(items ?? {}).reduce((sum, [itemId, count]) => {
    const safeCount = Math.max(0, Math.trunc(Number(count) || 0));
    return sum + harthmereItemUnitWeight(itemId) * safeCount;
  }, 0);
}

/** Pounds carried beyond the limit (0 when at or under the limit). */
export function harthmereCarryWeightOverage(
  carryWeight: number,
  limit: number = HARTHMERE_CARRY_WEIGHT_LIMIT
) {
  const safeWeight = Number.isFinite(carryWeight) ? carryWeight : 0;
  return Math.max(0, safeWeight - limit);
}

/** Multiplier applied to the stamina drain rate for a given carried weight.
 *  Returns 1 when at or under the limit; otherwise compounds the per-pound
 *  penalty: `FACTOR ^ poundsOver`. Fractional overage is supported (a 0.5 lb
 *  overage yields `FACTOR ^ 0.5`). */
export function harthmereEncumbranceStaminaMultiplier(
  carryWeight: number,
  limit: number = HARTHMERE_CARRY_WEIGHT_LIMIT
) {
  const overage = harthmereCarryWeightOverage(carryWeight, limit);
  if (overage <= 0) return 1;
  return Math.pow(HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB, overage);
}

/** Convenience: encumbrance multiplier computed directly from an inventory map. */
export function harthmereInventoryEncumbranceStaminaMultiplier(
  items: Record<string, number>,
  limit: number = HARTHMERE_CARRY_WEIGHT_LIMIT
) {
  return harthmereEncumbranceStaminaMultiplier(
    harthmereInventoryCarryWeight(items),
    limit
  );
}
