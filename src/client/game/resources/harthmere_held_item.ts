import type { Item } from "@/shared/game/item";
import { anItem } from "@/shared/game/item";
import { getCh1ItemVisualAsset } from "@/shared/harthmere/ch1_item_visual_assets";
import {
  harthmereNativeBiomesIdForItemId,
  harthmereNativeItemIdForBiomesId,
} from "@/shared/harthmere/harthmere_native_item_ids";
import { HARTHMERE_HOTBAR_HELD_ITEM_EVENT } from "@/shared/harthmere/premium_weapon_catalog";

export const HARTHMERE_AUTHORITATIVE_HELD_ITEM_BRIDGE_VERSION =
  "harthmere-authoritative-held-item-bridge-v2" as const;

let compatibilityHeldItemId: string | undefined;
let bridgeInstalled = false;

function normalizeHeldItemId(itemId: string | undefined) {
  const normalized = String(itemId ?? "").trim();
  return normalized || undefined;
}

export function setHarthmereCompatibilityHeldItemId(
  itemId: string | undefined
) {
  compatibilityHeldItemId = normalizeHeldItemId(itemId);
}

export function readHarthmereCompatibilityHeldItemId() {
  return compatibilityHeldItemId;
}

export function installHarthmereHeldItemEventBridge() {
  if (bridgeInstalled || typeof window === "undefined") return;
  window.addEventListener(HARTHMERE_HOTBAR_HELD_ITEM_EVENT, (event) => {
    const itemId = (event as CustomEvent<{ itemId?: string }>).detail?.itemId;
    setHarthmereCompatibilityHeldItemId(itemId);
  });
  bridgeInstalled = true;
}

/**
 * Dispatches the compatibility event for legacy HUD consumers and updates the
 * authoritative player attachment state immediately in the same turn.
 */
export function dispatchHarthmereHotbarHeldItemSelection(
  itemId: string | undefined
) {
  setHarthmereCompatibilityHeldItemId(itemId);
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_HOTBAR_HELD_ITEM_EVENT, {
      detail: { itemId: normalizeHeldItemId(itemId) },
    })
  );
}

export function harthmereHotbarHeldItemForAttachment(
  nativeSelectedItem: Item | undefined
): Item | undefined {
  // A populated ECS hotbar slot is always authoritative.
  if (nativeSelectedItem) return nativeSelectedItem;

  installHarthmereHeldItemEventBridge();
  const nativeId = harthmereNativeBiomesIdForItemId(compatibilityHeldItemId);
  return nativeId === undefined ? undefined : anItem(nativeId);
}

/**
 * Chapter 1 plot props are display-only inventory items. Their missing action
 * must not fall through the generic ACL helper's `destroy` default and hide
 * the held mesh while the player is standing in a protected region.
 */
export function isHarthmereChapter1DisplayOnlyHeldItem(item: Item | undefined) {
  if (!item) return false;
  const semanticItemId =
    harthmereNativeItemIdForBiomesId(Number(item.id)) ?? String(item.id);
  return Boolean(getCh1ItemVisualAsset(semanticItemId));
}

const HARTHMERE_PROTECTED_REGION_VISIBLE_JOB_TOOLS = new Set([
  "muck_rake",
  "repair_mallet",
]);

/**
 * Protected regions may forbid using a selected tool, but the restriction must
 * not erase the item from the player's hands. Chapter 1 display props and the
 * two Grove job tools remain visible; the normal permission gate still blocks
 * any disallowed action.
 */
export function isHarthmereProtectedRegionVisibleHeldItem(
  item: Item | undefined
) {
  if (!item) return false;
  const semanticItemId =
    harthmereNativeItemIdForBiomesId(Number(item.id)) ?? String(item.id);
  return (
    Boolean(getCh1ItemVisualAsset(semanticItemId)) ||
    HARTHMERE_PROTECTED_REGION_VISIBLE_JOB_TOOLS.has(semanticItemId)
  );
}
