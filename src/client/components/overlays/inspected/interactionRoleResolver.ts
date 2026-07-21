/**
 * Player-facing role selected for an inspected native placeable.
 *
 * This resolver is intentionally capability-based. Labels and quest metadata
 * may affect copy or progression, but they never decide which interface F
 * opens when the item already declares a native capability.
 */
export type NativePlaceableInteractionRole =
  | "mailbox"
  | "shop"
  | "container"
  | "crafting_station"
  | "door"
  | "readable"
  | "text_sign"
  | "outfit_stand"
  | "media"
  | "minigame"
  | "frame"
  | "inspect";

export interface NativePlaceableCapabilities {
  isMailbox?: boolean;
  isShopContainer?: boolean;
  isContainer?: boolean;
  isCraftingStation?: boolean;
  isCookStation?: boolean;
  isDoor?: boolean;
  isReadable?: boolean;
  isCustomizableTextSign?: boolean;
  isOutfitStand?: boolean;
  isMediaPlayer?: boolean;
  isMinigame?: boolean;
  isFrame?: boolean;
}

/**
 * Specific storage/station roles precede broad visual archetypes. For example,
 * a mailbox that also owns container_inventory must open Mail, and a quest
 * frame with an explicit container route must not fall through to Talk.
 */
export function resolveNativePlaceableInteractionRole(
  capabilities: NativePlaceableCapabilities
): NativePlaceableInteractionRole {
  if (capabilities.isMailbox) return "mailbox";
  if (capabilities.isShopContainer) return "shop";
  if (capabilities.isContainer) return "container";
  if (capabilities.isCraftingStation || capabilities.isCookStation) {
    return "crafting_station";
  }
  if (capabilities.isDoor) return "door";
  if (capabilities.isReadable) return "readable";
  if (capabilities.isCustomizableTextSign) return "text_sign";
  if (capabilities.isOutfitStand) return "outfit_stand";
  if (capabilities.isMediaPlayer) return "media";
  if (capabilities.isMinigame) return "minigame";
  if (capabilities.isFrame) return "frame";
  return "inspect";
}
