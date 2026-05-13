import {
  MEDIEVAL_ALL_ASSETS,
  MEDIEVAL_GLTF_ASSETS,
  MEDIEVAL_FBX_ASSETS,
  MEDIEVAL_OBJ_ASSETS,
  MEDIEVAL_VOX_ASSETS,
  MEDIEVAL_ICON_ASSETS,
  MEDIEVAL_HARTHMERE_ASSETS,
  type MedievalAsset,
} from "./medievalAssetManifest.generated";

export function getMedievalAssetByKey(key: string): MedievalAsset | undefined {
  return MEDIEVAL_ALL_ASSETS.find((asset) => asset.key === key);
}

export function getMedievalAssetsByPack(pack: string): MedievalAsset[] {
  return MEDIEVAL_ALL_ASSETS.filter((asset) => asset.pack === pack);
}

export function getMedievalGltfAssets(): MedievalAsset[] {
  return MEDIEVAL_GLTF_ASSETS;
}

export function getMedievalFbxAssets(): MedievalAsset[] {
  return MEDIEVAL_FBX_ASSETS;
}

export function getMedievalObjAssets(): MedievalAsset[] {
  return MEDIEVAL_OBJ_ASSETS;
}

export function getMedievalVoxAssets(): MedievalAsset[] {
  return MEDIEVAL_VOX_ASSETS;
}

export function getMedievalIconAssets(): MedievalAsset[] {
  return MEDIEVAL_ICON_ASSETS;
}

export function getHarthmereMedievalAssets(): MedievalAsset[] {
  return MEDIEVAL_HARTHMERE_ASSETS;
}

export function getRandomMedievalAsset(
  assets: MedievalAsset[],
  fallback?: MedievalAsset
): MedievalAsset | undefined {
  if (!assets.length) return fallback;
  return assets[Math.floor(Math.random() * assets.length)];
}

export function isBrowserLoadableMedievalModel(asset: MedievalAsset): boolean {
  return (
    asset.format === "gltf" ||
    asset.format === "glb" ||
    asset.format === "fbx" ||
    asset.format === "obj"
  );
}

export function needsSpecialMedievalLoader(asset: MedievalAsset): boolean {
  return asset.format === "fbx" || asset.format === "obj" || asset.format === "vox";
}
