import { BikkieIds } from "@/shared/bikkie/ids";
import type { BiomesId } from "@/shared/ids";
import type { HarthmereClothingSlot } from "@/shared/harthmere/voxel_faces";

export interface HarthmereBikkieWearable {
  slot: BiomesId;
  itemId: BiomesId;
}

const HARTHMERE_LOCAL_ITEM_BIKKIE_WEARABLES: Record<
  string,
  HarthmereBikkieWearable
> = {
  baker_apron: { slot: BikkieIds.top, itemId: BikkieIds.grassyTop },
  field_trousers: { slot: BikkieIds.bottoms, itemId: BikkieIds.bellBottoms },
  patched_cloak: { slot: BikkieIds.outerwear, itemId: BikkieIds.poncho },
  travel_cloak: { slot: BikkieIds.outerwear, itemId: BikkieIds.poncho },
  leather_armor: { slot: BikkieIds.top, itemId: BikkieIds.grassyTop },
};

export function harthmereEquipmentSlotToBikkieWearableSlot(
  slot: string | undefined
): BiomesId | undefined {
  switch (slot) {
    case "head":
    case "hat":
      return BikkieIds.hat;
    case "hair":
      return BikkieIds.hair;
    case "face":
      return BikkieIds.face;
    case "ears":
      return BikkieIds.ears;
    case "chest":
      return BikkieIds.top;
    case "legs":
      return BikkieIds.bottoms;
    case "feet":
      return BikkieIds.feet;
    case "hands":
      return BikkieIds.hands;
    case "back":
    case "outerwear":
      return BikkieIds.outerwear;
    case "neck":
      return BikkieIds.neck;
    default:
      return undefined;
  }
}

export function harthmereLocalItemBikkieWearable(
  itemId: string | undefined
): HarthmereBikkieWearable | undefined {
  return itemId ? HARTHMERE_LOCAL_ITEM_BIKKIE_WEARABLES[itemId] : undefined;
}

export function harthmereLocalEquipmentBikkieWearables(
  equipment:
    | Record<string, string | { itemId?: string } | undefined>
    | undefined
): HarthmereBikkieWearable[] {
  const wearables: HarthmereBikkieWearable[] = [];
  for (const [equipmentSlot, item] of Object.entries(equipment ?? {})) {
    const itemId = typeof item === "string" ? item : item?.itemId;
    const wearable = harthmereLocalItemBikkieWearable(itemId);
    if (!wearable) {
      continue;
    }
    const expectedSlot =
      harthmereEquipmentSlotToBikkieWearableSlot(equipmentSlot);
    wearables.push({
      slot: expectedSlot ?? wearable.slot,
      itemId: wearable.itemId,
    });
  }
  return wearables;
}

const HARTHMERE_BIKKIE_BODY_WEARABLE_SLOTS = new Set<BiomesId>([
  BikkieIds.outerwear,
  BikkieIds.top,
  BikkieIds.bottoms,
  BikkieIds.feet,
  BikkieIds.hands,
]);

const HARTHMERE_BIKKIE_HEAD_WEARABLE_SLOTS = new Set<BiomesId>([
  BikkieIds.head,
  BikkieIds.hair,
  BikkieIds.hat,
  BikkieIds.face,
  BikkieIds.ears,
  BikkieIds.neck,
]);

const HARTHMERE_BIKKIE_WEARABLE_HIDDEN_CLOTHING_SLOTS = new Map<
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

export function harthmereBikkieWearableSlotsFromAssignment(
  wearables?: ReadonlyMap<BiomesId, unknown>
): ReadonlySet<BiomesId> {
  const slots = new Set<BiomesId>();
  for (const [slot, item] of wearables ?? []) {
    if (item && HARTHMERE_BIKKIE_WEARABLE_HIDDEN_CLOTHING_SLOTS.has(slot)) {
      slots.add(slot);
    }
  }
  return slots;
}

export function harthmereBikkieWearablesUseGeneratedBody(
  slots: ReadonlySet<BiomesId>
): boolean {
  for (const slot of slots) {
    if (HARTHMERE_BIKKIE_BODY_WEARABLE_SLOTS.has(slot)) {
      return true;
    }
  }
  return false;
}

export function harthmereBikkieWearablesUseGeneratedHead(
  slots: ReadonlySet<BiomesId>
): boolean {
  for (const slot of slots) {
    if (HARTHMERE_BIKKIE_HEAD_WEARABLE_SLOTS.has(slot)) {
      return true;
    }
  }
  return false;
}

export function harthmereClothingSlotsHiddenByBikkieWearables(
  slots: ReadonlySet<BiomesId>
): ReadonlySet<HarthmereClothingSlot> {
  const hidden = new Set<HarthmereClothingSlot>();
  for (const slot of slots) {
    for (const clothingSlot of HARTHMERE_BIKKIE_WEARABLE_HIDDEN_CLOTHING_SLOTS.get(
      slot
    ) ?? []) {
      hidden.add(clothingSlot);
    }
  }
  return hidden;
}
