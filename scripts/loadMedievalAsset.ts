import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { MEDIEVAL_FINAL_ASSETS, MedievalAssetDefinition, resolveMedievalAssetUrl } from "./medievalFinalAssets";

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const cache = new Map<string, Promise<THREE.Object3D>>();

export type LoadedMedievalAssetOptions = {
  clone?: boolean;
  receiveShadow?: boolean;
  castShadow?: boolean;
};

function applyCommonObjectSettings(
  object: THREE.Object3D,
  asset: MedievalAssetDefinition,
  options: LoadedMedievalAssetOptions = {},
) {
  const scale = asset.defaultScale ?? 1;
  object.scale.setScalar(scale);

  if (asset.yOffset) {
    object.position.y += asset.yOffset;
  }

  const castShadow = options.castShadow ?? true;
  const receiveShadow = options.receiveShadow ?? true;

  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;

    // Avoid black/flat-looking props when imported materials are missing flags.
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      material.needsUpdate = true;
    }
  });

  object.userData.medievalAssetId = asset.id;
  object.userData.medievalAssetFormat = asset.format;
}

function cloneObject(object: THREE.Object3D) {
  // SkeletonUtils is not needed for these static props. These assets are non-animated/static.
  return object.clone(true);
}

export function loadMedievalAsset(
  assetOrId: MedievalAssetDefinition | keyof typeof MEDIEVAL_FINAL_ASSETS,
  options: LoadedMedievalAssetOptions = {},
): Promise<THREE.Object3D> {
  const asset = typeof assetOrId === "string" ? MEDIEVAL_FINAL_ASSETS[assetOrId] : assetOrId;

  if (!asset) {
    return Promise.reject(new Error(`Unknown medieval asset: ${String(assetOrId)}`));
  }

  if (asset.format === "png") {
    return Promise.reject(new Error(`Asset ${asset.id} is a PNG UI icon, not a 3D world asset.`));
  }

  const url = resolveMedievalAssetUrl(asset);
  const cacheKey = `${asset.format}:${url}`;

  if (!cache.has(cacheKey)) {
    const promise = new Promise<THREE.Object3D>((resolve, reject) => {
      if (asset.format === "gltf") {
        gltfLoader.load(
          url,
          (gltf) => {
            const object = gltf.scene;
            applyCommonObjectSettings(object, asset, options);
            resolve(object);
          },
          undefined,
          (error) => reject(new Error(`Failed to load GLTF asset ${asset.id} from ${url}: ${error.message}`)),
        );
        return;
      }

      if (asset.format === "fbx") {
        fbxLoader.load(
          url,
          (object) => {
            applyCommonObjectSettings(object, asset, options);
            resolve(object);
          },
          undefined,
          (error) => reject(new Error(`Failed to load FBX asset ${asset.id} from ${url}: ${error.message}`)),
        );
        return;
      }

      reject(new Error(`Unsupported medieval asset format for ${asset.id}: ${asset.format}`));
    });

    cache.set(cacheKey, promise);
  }

  return cache.get(cacheKey)!.then((object) => {
    if (options.clone === false) return object;
    const copy = cloneObject(object);
    applyCommonObjectSettings(copy, asset, options);
    return copy;
  });
}

export async function preloadMedievalAssets(assetIds: string[]) {
  const worldAssets = assetIds
    .map((id) => MEDIEVAL_FINAL_ASSETS[id])
    .filter((asset): asset is MedievalAssetDefinition => Boolean(asset) && asset.format !== "png");

  const results = await Promise.allSettled(
    worldAssets.map((asset) => loadMedievalAsset(asset, { clone: false })),
  );

  const failures = results
    .map((result, index) => ({ result, asset: worldAssets[index] }))
    .filter(({ result }) => result.status === "rejected")
    .map(({ result, asset }) => ({
      assetId: asset.id,
      path: asset.path,
      reason: result.status === "rejected" ? String(result.reason?.message ?? result.reason) : "unknown",
    }));

  if (failures.length) {
    // Keep this as a warning. One broken optional prop should not kill the whole town.
    console.warn("Some medieval assets failed to preload", failures);
  }

  return { loaded: results.length - failures.length, failed: failures };
}
