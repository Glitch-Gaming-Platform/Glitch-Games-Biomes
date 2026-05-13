# Final Medieval Asset Implementation

This implementation installs and registers the uploaded final packs without creating fake `.glb` references.

## What was added

- KayKit Forest Nature Pack: direct `.gltf` world assets for trees, grass, bushes, and rocks.
- Quaternius Fantasy Props MegaKit: direct `.gltf` world assets for market stalls, carts, barrels, crates, blacksmith props, tavern props, alchemy props, library props, banners, chests, keys, and coins.
- Quaternius Farm Animals: copied as `.fbx` and registered as FBX-only assets.
- Quaternius Ultimate Food Pack: copied as `.fbx` and registered as FBX-only assets.
- Quaternius Ultimate RPG Items Pack: copied as `.fbx` models and `.png` inventory icons.
- Kenney game icons: copied as `.png` HUD/control icons.

## Install

Put the uploaded zip files in `asset-packs/` at the repo root, then run:

```bash
mkdir -p scripts
cp install-final-medieval-assets.sh scripts/install-final-medieval-assets.sh
chmod +x scripts/install-final-medieval-assets.sh
./scripts/install-final-medieval-assets.sh
```

If the zips are somewhere else:

```bash
PACK_DIR=/absolute/path/to/zips ./scripts/install-final-medieval-assets.sh
```

By default the script installs into:

```text
public/buckets/biomes-static/asset_data/vendor
```

Override it only if your static asset bucket is elsewhere:

```bash
ASSET_ROOT=public/buckets/biomes-static/asset_data PACK_DIR=asset-packs ./scripts/install-final-medieval-assets.sh
```

## Wire the code

Copy these files into the part of your client that owns world asset loading:

```text
medievalFinalAssets.ts
loadMedievalAsset.ts
medievalMiniWorldFinalPlacements.ts
```

Then use `MEDIEVAL_MINI_WORLD_FINAL_PLACEMENTS` to spawn props.

Example:

```ts
import * as THREE from "three";
import { MEDIEVAL_MINI_WORLD_FINAL_PLACEMENTS } from "./medievalMiniWorldFinalPlacements";
import { loadMedievalAsset } from "./loadMedievalAsset";

export async function addFinalMedievalProps(scene: THREE.Scene) {
  for (const placement of MEDIEVAL_MINI_WORLD_FINAL_PLACEMENTS) {
    const object = await loadMedievalAsset(placement.assetId);
    object.position.set(...placement.position);
    object.rotation.y = placement.rotationY ?? 0;

    if (placement.scale !== undefined) {
      object.scale.multiplyScalar(placement.scale);
    }

    object.userData.collision = placement.collision ?? "none";
    object.userData.zone = placement.zone;
    scene.add(object);
  }
}
```

## Critical correctness notes

1. Do not rename `.gltf`, `.bin`, or texture files independently. The `.gltf` files reference sidecar files by relative path.
2. Do not reference the animal, food, or RPG item models as `.glb`. Those packs are FBX/OBJ, not GLB.
3. If your current world loader only supports GLTF/GLB, spawn only `MEDIEVAL_SAFE_GLTF_ASSET_IDS` until `FBXLoader` is wired.
4. The `defaultScale` values for FBX assets are intentionally tiny because those packs usually import much larger than GLTF props.
5. Keep the main spawn area clear. The placements intentionally push trees and large props outside the walking lanes.
