import type { OwnedItemReference } from "@/shared/ecs/gen/types";
import type { BiomesId } from "@/shared/ids";
import type { InventoryUiRef } from "@/client/components/biomes_ui/tabs/InventoryTab";

export function nativeConsumablePresentationForBiomesUIForTest(item: any): {
  canUse: boolean;
  useActionLabel?: "Eat" | "Drink";
} {
  if (item?.isConsumable !== true) {
    return { canUse: false };
  }
  return {
    canUse: true,
    useActionLabel: item.action === "drink" ? "Drink" : "Eat",
  };
}

/**
 * Resolves a BiomesUI slot to the exact native inventory reference consumed by
 * the server. Kept independent of the large live adapter so this authority
 * boundary can be tested without browser asset loaders.
 */
export function nativeConsumptionForBiomesUIForTest(
  inventory: any,
  ref: InventoryUiRef
):
  | {
      itemId: BiomesId;
      ref: OwnedItemReference;
      action: "eat" | "drink";
    }
  | undefined {
  if (ref.kind !== "item" && ref.kind !== "hotbar") return undefined;
  const idx = Number(ref.idx ?? 0);
  const nativeRef = {
    kind: ref.kind,
    idx,
  } as OwnedItemReference;
  const nativeSlot =
    ref.kind === "item" ? inventory?.items?.[idx] : inventory?.hotbar?.[idx];
  const nativeItem = nativeSlot?.item;
  if (!nativeItem?.isConsumable) return undefined;
  return {
    itemId: nativeItem.id,
    ref: nativeRef,
    action: nativeItem.action === "drink" ? "drink" : "eat",
  };
}
