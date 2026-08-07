export interface GroveItemVisualAsset {
  itemId: string;
  assetUrl: string;
}

// The festival skewer is authored at its real hand scale in Blender, unlike
// the deliberately tiny Chapter 1 keepsakes that need a 3x readability boost.
export const GROVE_ITEM_WORLD_PRESENTATION_SCALE = 1;

export const GROVE_ITEM_VISUAL_ASSETS: readonly GroveItemVisualAsset[] =
  Object.freeze([
    {
      itemId: "grove_festival_skewer",
      assetUrl:
        "/assets/harthmere/glb/items/grove/grove_festival_skewer.glb",
    },
  ]);

const BY_ITEM_ID = new Map(
  GROVE_ITEM_VISUAL_ASSETS.map((asset) => [asset.itemId, asset])
);

export function getGroveItemVisualAsset(
  itemId: string
): GroveItemVisualAsset | undefined {
  return BY_ITEM_ID.get(itemId);
}
