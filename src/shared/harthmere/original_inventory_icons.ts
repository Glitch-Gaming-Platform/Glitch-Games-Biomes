import { resolveAssetUrlUntyped } from "@/galois/interface/asset_paths";
import { resolveHarthmereAssetUrl } from "@/shared/harthmere/galois_asset_paths";
import { harthmereNativeItemIdForBiomesId } from "@/shared/harthmere/harthmere_native_item_ids";
import { safeParseBiomesId } from "@/shared/ids";

/**
 * Original Biomes placeable renders that remain the best inventory art for
 * their matching workstations and furniture. These are generated from the
 * shipped placeable models, so the icon matches the object the player places.
 */
const ORIGINAL_INVENTORY_ICON_ASSET_BY_ITEM_ID: Readonly<
  Record<string, string>
> = {
  // Original numeric Bikkie identities.
  "1534621126189448": "icons/placeables/crafting_stations/log_workbench",
  "1485695172010242": "icons/placeables/crafting_stations/oak_kitchen",
  "7539420629350105": "icons/placeables/crafting_stations/oak_tailoring_booth",
  "4537020877769775": "icons/placeables/crafting_stations/stone_thermoblaster",
  "2443541317223860": "icons/placeables/crafting_stations/stone_thermolite",
  "4537020877769721": "icons/placeables/arcade_machine",
  "7839178235946121": "icons/placeables/record_player",
  "4537020877769751": "icons/placeables/boombox",

  // Semantic Harthmere identities and recipe outputs that point at the same
  // physical placeables.
  workbench: "icons/placeables/crafting_stations/log_workbench",
  harthmere_station_workbench:
    "icons/placeables/crafting_stations/log_workbench",
  harthmere_station_kitchen: "icons/placeables/crafting_stations/oak_kitchen",
  harthmere_station_tailoring_booth:
    "icons/placeables/crafting_stations/oak_tailoring_booth",
  harthmere_station_thermoblaster:
    "icons/placeables/crafting_stations/stone_thermoblaster",
  harthmere_station_thermolite:
    "icons/placeables/crafting_stations/stone_thermolite",
  record_player: "icons/placeables/record_player",
  boombox: "icons/placeables/boombox",
  bench: "icons/placeables/furniture/bench",
  // The native presentation donor for the Muck Rake is a Muck Buster, which
  // made the sanitation storefront show an orange combat tool instead of a
  // cleanup implement. This shipped Kenney hoe is the closest exact readable
  // inventory/shop silhouette and preserves the semantic `muck_rake` item.
  muck_rake: "/assets/harthmere/png/kenney/items/hoe_iron.png",
};

export function harthmereOriginalInventoryIconUrl(
  itemId: string | number | undefined
): string | undefined {
  if (itemId === undefined || itemId === null) return undefined;
  const raw = String(itemId).trim();
  if (!raw) return undefined;
  const normalized = raw.replace(/^b:/, "");
  const nativeId = safeParseBiomesId(normalized);
  const semanticId = nativeId
    ? harthmereNativeItemIdForBiomesId(nativeId)
    : normalized;
  const assetPath =
    ORIGINAL_INVENTORY_ICON_ASSET_BY_ITEM_ID[raw] ??
    ORIGINAL_INVENTORY_ICON_ASSET_BY_ITEM_ID[normalized] ??
    (semanticId
      ? ORIGINAL_INVENTORY_ICON_ASSET_BY_ITEM_ID[semanticId]
      : undefined);
  if (!assetPath) return undefined;
  return assetPath.startsWith("/")
    ? resolveHarthmereAssetUrl(assetPath)
    : resolveAssetUrlUntyped(assetPath);
}
