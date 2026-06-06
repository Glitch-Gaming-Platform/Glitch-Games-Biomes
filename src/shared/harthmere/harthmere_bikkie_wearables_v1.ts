import { BikkieIds } from "@/shared/bikkie/ids";
import type { BiomesId } from "@/shared/ids";

export interface HarthmereBikkieWearableV1 {
  slot: BiomesId;
  itemId: BiomesId;
}

const HARTHMERE_LOCAL_ITEM_BIKKIE_WEARABLES_V1: Record<
  string,
  HarthmereBikkieWearableV1
> = {
  baker_apron: { slot: BikkieIds.top, itemId: BikkieIds.grassyTop },
  field_trousers: { slot: BikkieIds.bottoms, itemId: BikkieIds.bellBottoms },
  patched_cloak: { slot: BikkieIds.outerwear, itemId: BikkieIds.poncho },
};

export function harthmereEquipmentSlotToBikkieWearableSlotV1(
  slot: string | undefined
): BiomesId | undefined {
  switch (slot) {
    case "head":
      return BikkieIds.hat;
    case "chest":
      return BikkieIds.top;
    case "legs":
      return BikkieIds.bottoms;
    case "feet":
      return BikkieIds.feet;
    case "hands":
      return BikkieIds.hands;
    case "back":
      return BikkieIds.outerwear;
    case "neck":
      return BikkieIds.neck;
    default:
      return undefined;
  }
}

export function harthmereLocalItemBikkieWearableV1(
  itemId: string | undefined
): HarthmereBikkieWearableV1 | undefined {
  return itemId ? HARTHMERE_LOCAL_ITEM_BIKKIE_WEARABLES_V1[itemId] : undefined;
}

export function harthmereLocalEquipmentBikkieWearablesV1(
  equipment: Record<string, { itemId?: string } | undefined> | undefined
): HarthmereBikkieWearableV1[] {
  const wearables: HarthmereBikkieWearableV1[] = [];
  for (const [equipmentSlot, item] of Object.entries(equipment ?? {})) {
    const wearable = harthmereLocalItemBikkieWearableV1(item?.itemId);
    if (!wearable) {
      continue;
    }
    const expectedSlot =
      harthmereEquipmentSlotToBikkieWearableSlotV1(equipmentSlot);
    wearables.push({
      slot: expectedSlot ?? wearable.slot,
      itemId: wearable.itemId,
    });
  }
  return wearables;
}
