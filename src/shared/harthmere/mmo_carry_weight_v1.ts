import {
  getHarthmereItemDefinitionV1,
  type HarthmereItemDefinitionV1,
} from "./mmo_inventory_authority_v1";

/** Maximum total inventory weight (in pounds) a player can carry before they are
 *  encumbered. Carrying at or below this limit incurs no penalty. */
export const HARTHMERE_CARRY_WEIGHT_LIMIT_V1 = 25;

/** Stamina-drain penalty applied per pound carried over the limit. The penalty
 *  COMPOUNDS: each excess pound multiplies the drain rate by this factor, so the
 *  effective multiplier is `FACTOR ^ poundsOver`. Each pound adds a +1/6 (≈16.7%)
 *  marginal drain — a third of the original +1/2 (50%) tuning, i.e. "1/3 as brutal":
 *  1 over → ~1.17x, 2 over → ~1.36x, 5 over → ~2.2x, 10 over → ~4.5x. */
export const HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB_V1 = 1 + 0.5 / 3;

export function isLikelyBankingMaterialItemIdV1(itemId: string) {
  return /(ore|wood|log|stone|clay|fiber|hide|meat|herb|mushroom|ingot|shard|crystal|sand|salt|grain|cloth|coal|copper|iron|silver|gold|exotic|matter|resource|material)/i.test(
    itemId
  );
}

export function itemCategoryFromDefinitionV1(
  def: HarthmereItemDefinitionV1 | undefined,
  itemId: string
) {
  const text = `${itemId} ${def?.displayName ?? ""}`.toLowerCase();
  if (def?.isCurrency) return "currency";
  if (def?.isQuestItem || def?.binding === "quest") return "quest";
  if (def?.isCraftingMaterial || isLikelyBankingMaterialItemIdV1(itemId))
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

export function harthmereItemUnitWeightV1(itemId: string) {
  const def = getHarthmereItemDefinitionV1(itemId);
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
  const category = itemCategoryFromDefinitionV1(def, itemId);
  if (category === "currency") return 0;
  if (category === "quest") return 0.5;
  if (category === "materials") return 2;
  if (category === "tools") return 5;
  if (category === "consumables") return 1;
  return 1;
}

export function harthmereInventoryCarryWeightV1(items: Record<string, number>) {
  return Object.entries(items ?? {}).reduce((sum, [itemId, count]) => {
    const safeCount = Math.max(0, Math.trunc(Number(count) || 0));
    return sum + harthmereItemUnitWeightV1(itemId) * safeCount;
  }, 0);
}

/** Pounds carried beyond the limit (0 when at or under the limit). */
export function harthmereCarryWeightOverageV1(
  carryWeight: number,
  limit: number = HARTHMERE_CARRY_WEIGHT_LIMIT_V1
) {
  const safeWeight = Number.isFinite(carryWeight) ? carryWeight : 0;
  return Math.max(0, safeWeight - limit);
}

/** Multiplier applied to the stamina drain rate for a given carried weight.
 *  Returns 1 when at or under the limit; otherwise compounds the per-pound
 *  penalty: `FACTOR ^ poundsOver`. Fractional overage is supported (a 0.5 lb
 *  overage yields `FACTOR ^ 0.5`). */
export function harthmereEncumbranceStaminaMultiplierV1(
  carryWeight: number,
  limit: number = HARTHMERE_CARRY_WEIGHT_LIMIT_V1
) {
  const overage = harthmereCarryWeightOverageV1(carryWeight, limit);
  if (overage <= 0) return 1;
  return Math.pow(HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB_V1, overage);
}

/** Convenience: encumbrance multiplier computed directly from an inventory map. */
export function harthmereInventoryEncumbranceStaminaMultiplierV1(
  items: Record<string, number>,
  limit: number = HARTHMERE_CARRY_WEIGHT_LIMIT_V1
) {
  return harthmereEncumbranceStaminaMultiplierV1(
    harthmereInventoryCarryWeightV1(items),
    limit
  );
}
