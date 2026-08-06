import { CH1_ITEMS } from "@/shared/harthmere/ch1_items";

export interface Ch1ItemVisualAsset {
  itemId: string;
  assetUrl: string;
}

/**
 * Chapter 1 props are authored at believable real-world dimensions, while the
 * voxel-avatar hand socket and its animation make a literal 4–7 cm runtime
 * silhouette disappear inside the sleeve. Keep the Blender source metric and
 * exaggerate only the in-world presentation to the readable 12–21 cm range.
 */
export const CH1_ITEM_WORLD_PRESENTATION_SCALE = 3;

export interface Ch1ItemGltfMaterialDefinition {
  name?: string;
  pbrMetallicRoughness?: {
    baseColorFactor?: readonly number[];
  };
}

/**
 * Three's loaded material color can be normalized to white before the item is
 * converted into Biomes' base pass. The GLB JSON remains the canonical source
 * for these deliberately untextured Chapter 1 props, so preserve its RGB
 * factor instead of silently turning every held item white.
 */
export function resolveCh1ItemGltfBaseColor(
  materialName: string | undefined,
  materialIndex: number | undefined,
  materials: readonly Ch1ItemGltfMaterialDefinition[] | undefined,
  fallback: readonly [number, number, number]
): [number, number, number] {
  // Object3D.clone() retains the Three material name but GLTFLoader's
  // association table only guarantees entries for parser-owned objects. Some
  // multi-material props therefore keep an index while many ordinary props do
  // not. Prefer the stable exported name and use the parser index as fallback.
  const definition =
    (materialName
      ? materials?.find(({ name }) => name === materialName)
      : undefined) ??
    (materialIndex === undefined ? undefined : materials?.[materialIndex]);
  const factor = definition?.pbrMetallicRoughness?.baseColorFactor;
  if (
    factor !== undefined &&
    factor.length >= 3 &&
    factor.slice(0, 3).every((value) => Number.isFinite(value))
  ) {
    return [Number(factor[0]), Number(factor[1]), Number(factor[2])];
  }
  return [...fallback];
}

/**
 * Compact Blender-authored held/drop meshes for every Chapter 1 plot item.
 *
 * Inventory art remains the exact generated icon catalogue. These GLBs cover
 * the physical presentation path only; using generic Bikkie presentation
 * donors made the items resolve, but their source meshes were several times
 * hand scale and many collapsed into the same large block silhouette.
 */
export const CH1_ITEM_VISUAL_ASSETS: readonly Ch1ItemVisualAsset[] =
  Object.freeze(
    CH1_ITEMS.map(({ id }) => ({
      itemId: id,
      assetUrl: `/assets/harthmere/glb/items/chapter1/${id}.glb`,
    }))
  );

const BY_ITEM_ID = new Map(
  CH1_ITEM_VISUAL_ASSETS.map((asset) => [asset.itemId, asset])
);

export function getCh1ItemVisualAsset(
  itemId: string
): Ch1ItemVisualAsset | undefined {
  return BY_ITEM_ID.get(itemId);
}
