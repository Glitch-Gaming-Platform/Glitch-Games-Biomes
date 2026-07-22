export type HotbarPrimaryAction =
  | "attack"
  | "cast"
  | "consume"
  | "fish"
  | "place"
  | "tool"
  | "use";

export interface HotbarActionDescriptor {
  kind: HotbarPrimaryAction;
  label: string;
  /** Native eat/drink/home actions use the original one-second channel. */
  holdDurationMs: number;
}

const ACTION_LABELS: Record<string, HotbarActionDescriptor> = {
  bikkie: { kind: "cast", label: "Cast", holdDurationMs: 350 },
  despawnWand: { kind: "cast", label: "Cast", holdDurationMs: 350 },
  drink: { kind: "consume", label: "Drink", holdDurationMs: 1150 },
  dump: { kind: "tool", label: "Pour", holdDurationMs: 350 },
  dye: { kind: "tool", label: "Dye", holdDurationMs: 350 },
  eat: { kind: "consume", label: "Eat", holdDurationMs: 1150 },
  fertilize: { kind: "tool", label: "Fertilize", holdDurationMs: 350 },
  fish: { kind: "fish", label: "Fish", holdDurationMs: 350 },
  negaWand: { kind: "cast", label: "Cast", holdDurationMs: 350 },
  photo: { kind: "use", label: "Take Photo", holdDurationMs: 350 },
  place: { kind: "place", label: "Place", holdDurationMs: 350 },
  placeRobot: { kind: "place", label: "Place", holdDurationMs: 350 },
  placerWand: { kind: "cast", label: "Cast", holdDurationMs: 350 },
  plant: { kind: "tool", label: "Plant", holdDurationMs: 350 },
  reveal: { kind: "tool", label: "Reveal", holdDurationMs: 350 },
  shape: { kind: "tool", label: "Shape", holdDurationMs: 350 },
  shaper: { kind: "tool", label: "Shape", holdDurationMs: 350 },
  spaceClipboard: { kind: "cast", label: "Cast", holdDurationMs: 350 },
  till: { kind: "tool", label: "Till", holdDurationMs: 350 },
  wand: { kind: "cast", label: "Cast", holdDurationMs: 350 },
  warpHome: { kind: "use", label: "Warp Home", holdDurationMs: 1150 },
  waterPlant: { kind: "tool", label: "Water", holdDurationMs: 350 },
  waypointCam: { kind: "use", label: "Use Camera", holdDurationMs: 350 },
};

/**
 * Describe the authored primary action without duplicating its implementation.
 * InteractScript remains responsible for actually placing, attacking, casting,
 * harvesting, or consuming through native ECS events.
 */
export function describeHotbarPrimaryAction(item: any): HotbarActionDescriptor {
  const action = String(item?.action ?? "");
  if (ACTION_LABELS[action]) {
    return ACTION_LABELS[action];
  }
  if (item?.dps || item?.damage || item?.isWeapon) {
    return { kind: "attack", label: "Attack", holdDurationMs: 350 };
  }
  if (item?.isBlock || item?.isPlaceable) {
    return { kind: "place", label: "Place", holdDurationMs: 350 };
  }
  if (item?.isTool) {
    return { kind: "tool", label: "Use Tool", holdDurationMs: 350 };
  }
  if (item?.isConsumable) {
    return { kind: "consume", label: "Use", holdDurationMs: 1150 };
  }
  return { kind: "use", label: "Use", holdDurationMs: 350 };
}

/** Eligibility follows behavior, not a narrow block/tool/food category list. */
export function isHotbarActionableItem(item: any) {
  if (!item || item.isQuest) return false;
  return Boolean(
    ACTION_LABELS[String(item.action ?? "")] ||
      item.dps ||
      item.damage ||
      item.isWeapon ||
      item.isBlock ||
      item.isPlaceable ||
      item.isTool ||
      item.isConsumable
  );
}
