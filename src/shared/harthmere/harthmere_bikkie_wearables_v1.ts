import { BikkieIds } from "@/shared/bikkie/ids";
import type { BiomesId } from "@/shared/ids";
import type { HarthmereClothingSlot } from "@/shared/harthmere/voxel_faces";

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
  equipment:
    | Record<string, string | { itemId?: string } | undefined>
    | undefined
): HarthmereBikkieWearableV1[] {
  const wearables: HarthmereBikkieWearableV1[] = [];
  for (const [equipmentSlot, item] of Object.entries(equipment ?? {})) {
    const itemId = typeof item === "string" ? item : item?.itemId;
    const wearable = harthmereLocalItemBikkieWearableV1(itemId);
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

const HARTHMERE_BIKKIE_BODY_WEARABLE_SLOTS_V1 = new Set<BiomesId>([
  BikkieIds.outerwear,
  BikkieIds.top,
  BikkieIds.bottoms,
  BikkieIds.feet,
  BikkieIds.hands,
]);

const HARTHMERE_BIKKIE_HEAD_WEARABLE_SLOTS_V1 = new Set<BiomesId>([
  BikkieIds.head,
  BikkieIds.hair,
  BikkieIds.hat,
  BikkieIds.face,
  BikkieIds.ears,
  BikkieIds.neck,
]);

const HARTHMERE_BIKKIE_WEARABLE_HIDDEN_CLOTHING_SLOTS_V1 = new Map<
  BiomesId,
  readonly HarthmereClothingSlot[]
>([
  [BikkieIds.head, ["head"]],
  [BikkieIds.hair, ["hair"]],
  [BikkieIds.hat, ["head", "hair"]],
  [BikkieIds.face, ["face"]],
  [BikkieIds.ears, ["head"]],
  [BikkieIds.neck, ["head"]],
  [BikkieIds.outerwear, ["torso", "back", "belt"]],
  [BikkieIds.top, ["torso", "belt"]],
  [BikkieIds.bottoms, ["legs", "belt"]],
  [BikkieIds.feet, ["feet"]],
  [BikkieIds.hands, ["hands"]],
]);

export function harthmereBikkieWearableSlotsFromAssignmentV1(
  wearables?: ReadonlyMap<BiomesId, unknown>
): ReadonlySet<BiomesId> {
  const slots = new Set<BiomesId>();
  for (const [slot, item] of wearables ?? []) {
    if (item && HARTHMERE_BIKKIE_WEARABLE_HIDDEN_CLOTHING_SLOTS_V1.has(slot)) {
      slots.add(slot);
    }
  }
  return slots;
}

export function harthmereBikkieWearablesUseGeneratedBodyV1(
  slots: ReadonlySet<BiomesId>
): boolean {
  for (const slot of slots) {
    if (HARTHMERE_BIKKIE_BODY_WEARABLE_SLOTS_V1.has(slot)) {
      return true;
    }
  }
  return false;
}

export function harthmereBikkieWearablesUseGeneratedHeadV1(
  slots: ReadonlySet<BiomesId>
): boolean {
  for (const slot of slots) {
    if (HARTHMERE_BIKKIE_HEAD_WEARABLE_SLOTS_V1.has(slot)) {
      return true;
    }
  }
  return false;
}

export function harthmereClothingSlotsHiddenByBikkieWearablesV1(
  slots: ReadonlySet<BiomesId>
): ReadonlySet<HarthmereClothingSlot> {
  const hidden = new Set<HarthmereClothingSlot>();
  for (const slot of slots) {
    for (const clothingSlot of HARTHMERE_BIKKIE_WEARABLE_HIDDEN_CLOTHING_SLOTS_V1.get(
      slot
    ) ?? []) {
      hidden.add(clothingSlot);
    }
  }
  return hidden;
}
