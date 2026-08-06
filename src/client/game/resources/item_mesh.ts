import type { ClientContext } from "@/client/game/context";
import {
  cloneMaterials,
  gltfToBasePassThree,
  replaceThreeMaterials,
} from "@/client/game/renderers/util";
import type {
  ClientResourceDeps,
  ClientResourcesBuilder,
} from "@/client/game/resources/types";
import {
  WORLD_TO_VOX_SCALE,
  gltfDispose,
  gltfToThree,
  parseGltf,
} from "@/client/game/util/gltf_helpers";
import {
  makeBlockBufferGeometryFromBase64,
  makeFloraBufferGeometryFromBase64,
} from "@/client/game/util/meshes";
import { decodeBase64ArrayBuffer } from "@/client/game/util/mobile_atlas_decode";
import { resolveAssetUrlUntyped } from "@/galois/interface/asset_paths";
import type {
  BlockItemMeshData,
  FloraItemMeshData,
  GlassItemMeshData,
  ItemMeshData,
} from "@/galois/interface/types/data";
import { makeBlockItemMaterial } from "@/gen/client/game/shaders/block_item";
import { makeFloraItemMaterial } from "@/gen/client/game/shaders/flora_item";
import { makeBasicMaterial } from "@/gen/client/game/shaders/basic";
import { staticUrlForAttribute } from "@/shared/bikkie/schema/binary";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { Disposable } from "@/shared/disposable";
import { makeDisposable } from "@/shared/disposable";
import type { Item } from "@/shared/game/item";
import {
  CH1_ITEM_WORLD_PRESENTATION_SCALE,
  getCh1ItemVisualAsset,
  resolveCh1ItemGltfBaseColor,
} from "@/shared/harthmere/ch1_item_visual_assets";
import { harthmereNativeItemIdForBiomesId } from "@/shared/harthmere/harthmere_native_item_ids";
import { getHarthmerePremiumWeapon } from "@/shared/harthmere/premium_weapon_catalog";
import { log } from "@/shared/logging";
import { affineToMatrix } from "@/shared/math/affine";
import type { RegistryLoader } from "@/shared/registry";
import { AcceptableAsPathKey } from "@/shared/resources/path_map";
import {
  itemDyedColor,
  resolveBinaryAttribute,
} from "@/shared/util/dye_helpers";
import { binaryFetch, jsonFetch } from "@/shared/util/fetch_helpers";
import { ok } from "assert";
import * as THREE from "three";
import { DoubleSide, Mesh } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

interface ItemMeshInstanceImpl {
  three: THREE.Object3D;
  handAttachmentTransform?: THREE.Matrix4;
  animationClipNames?: readonly string[];
  updateAnimation?: (clipName: string, localTimeSeconds: number) => void;
  socketWorldPosition?: (socketName: string) => THREE.Vector3 | undefined;
}
export type ItemMeshInstance = Disposable<ItemMeshInstanceImpl>;

// Allows efficient creation of an instance of an item mesh.
export type ItemMeshFactory = () => ItemMeshInstance;

export function harthmereChapter1ItemCanonicalBaseColor(
  material: THREE.Material
): [number, number, number] | undefined {
  const value = material.userData.harthmereChapter1CanonicalBaseColor;
  if (
    !Array.isArray(value) ||
    value.length < 3 ||
    !value.slice(0, 3).every((channel) => Number.isFinite(channel))
  ) {
    return undefined;
  }
  return [Number(value[0]), Number(value[1]), Number(value[2])];
}

async function makeBlockItemMesh(
  _clientContext: ClientContext,
  deps: ClientResourceDeps,
  meshData: BlockItemMeshData
) {
  const [textures] = await Promise.all([deps.get("/terrain/block/textures")]);

  const geometry = makeBlockBufferGeometryFromBase64(
    meshData.vertices,
    meshData.indices
  );
  geometry.translate(-0.5, -0.5, -0.5);
  geometry.scale(10, 10, 10);

  return makeDisposable(
    () => {
      const material = makeBlockItemMaterial({
        colorMap: textures.colorMap,
        mreaMap: textures.mreaMap,
        sampleIndex: meshData.sample,
        textureIndex: textures.index,
      });
      return makeDisposable(
        {
          three: new Mesh(geometry, material),
        },
        () => material.dispose()
      );
    },
    () => {
      geometry.dispose();
    }
  );
}

async function makeGlassItemMesh(
  _clientContext: ClientContext,
  deps: ClientResourceDeps,
  meshData: GlassItemMeshData
) {
  const [textures] = await Promise.all([deps.get("/terrain/glass/textures")]);

  const geometry = makeBlockBufferGeometryFromBase64(
    meshData.vertices,
    meshData.indices
  );
  geometry.translate(-0.5, -0.5, -0.5);
  geometry.scale(10, 10, 10);

  return makeDisposable(
    () => {
      // TODO(matthew): Make this GlassItemMaterial. Currently can't since that results
      // in player and item having different scenes.
      const material = makeBlockItemMaterial({
        colorMap: textures.colorMap,
        mreaMap: textures.mreaMap,
        sampleIndex: meshData.sample,
        textureIndex: textures.index,
      });
      return makeDisposable(
        {
          three: new Mesh(geometry, material),
        },
        () => material.dispose()
      );
    },
    () => {
      geometry.dispose();
    }
  );
}

async function makeFloraItemMesh(
  _clientContext: ClientContext,
  deps: ClientResourceDeps,
  meshData: FloraItemMeshData
) {
  const [colorMap] = await Promise.all([deps.get("/terrain/flora/colors")]);

  const geometry = makeFloraBufferGeometryFromBase64(
    meshData.vertices,
    meshData.indices
  );
  geometry.translate(0, 0, 0);
  geometry.scale(8, 8, 8);

  return makeDisposable(
    () => {
      const material = makeFloraItemMaterial({ colorMap });
      material.side = DoubleSide;
      return makeDisposable(
        {
          three: new Mesh(geometry, material),
        },
        () => material.dispose()
      );
    },
    () => {
      geometry.dispose();
    }
  );
}

export async function loadItemGltf(
  item: Item
): Promise<Disposable<GLTF> | undefined> {
  ok(item.mesh);
  const buffer = await binaryFetch(
    staticUrlForAttribute(resolveBinaryAttribute(item.mesh, item))
  );

  const gltf = await parseGltf(buffer);

  return makeDisposable(gltf, () => {
    gltfDispose(gltf);
  });
}

async function gltfToItemMesh(
  data: string | ArrayBuffer,
  handAttachmentTransform: number[],
  inWorldScale: boolean
) {
  if (handAttachmentTransform.length !== 16) {
    throw new Error(
      "Expected GLTF item mesh hand attachment transform to be an array of 16 elements."
    );
  }
  const threeHandTransform = new THREE.Matrix4().fromArray(
    handAttachmentTransform
  );

  const gltf = await parseGltf(data);
  const [three, materials] = gltfToBasePassThree(gltf);

  const templateObject = (() => {
    if (!inWorldScale) {
      return three;
    }
    three.scale.setScalar(WORLD_TO_VOX_SCALE);
    const parent = new THREE.Object3D();
    parent.add(three);
    return parent;
  })();

  return makeDisposable(
    () => {
      const three = templateObject.clone();
      const [instMats, _oldMaterials] = cloneMaterials(three);
      return makeDisposable(
        {
          three,
          handAttachmentTransform: threeHandTransform,
        },
        () => {
          instMats.forEach((material) => material.dispose());
        }
      );
    },
    () => {
      gltfDispose(gltf);
      materials.forEach((m) => m.dispose());
    }
  );
}

async function makeHarthmerePremiumItemMesh(item: Item) {
  const semanticItemId =
    harthmereNativeItemIdForBiomesId(Number(item.id)) ?? String(item.id);
  const premium = getHarthmerePremiumWeapon(semanticItemId);
  if (!premium) return undefined;

  const gltf = await parseGltf(await binaryFetch(premium.assetUrl));
  // `gltfToBasePassThree` intentionally uses ordinary Object3D.clone(), which
  // is correct for static item meshes but leaves a SkinnedMesh skeleton bound
  // to bones outside the cloned hierarchy. Premium bows are rigged, so their
  // very first clone must be skeleton-aware; otherwise the later instance
  // clone contains undefined bones and Three.js throws from
  // SkinnedMesh.computeBoundingSphere while equipping the bow.
  const template = SkeletonUtils.clone(gltfToThree(gltf));
  const [materials] = replaceThreeMaterials(template, true, true);
  template.traverse((child) => {
    const skinned = child as THREE.SkinnedMesh;
    if (!skinned.isSkinnedMesh) return;
    if (skinned.skeleton.bones.some((bone) => !bone)) {
      throw new Error(
        `${semanticItemId} contains a detached premium-item skeleton`
      );
    }
    // The player entity is already culled as one renderable. Recomputing a
    // dynamic bounding sphere for each tiny held bow segment is redundant and
    // is exactly the Three.js path that exposed detached skeleton state.
    skinned.frustumCulled = false;
  });
  // Premium assets are authored in world meters. Native wearable/player
  // meshes use voxel units, so keep the same conversion as ordinary GLTF item
  // meshes while retaining the authored grip-at-origin transform.
  template.scale.setScalar(WORLD_TO_VOX_SCALE);
  const clips = [...gltf.animations];

  return makeDisposable(
    () => {
      const three = SkeletonUtils.clone(template);
      const [instMats] = cloneMaterials(three);
      const mixer = new THREE.AnimationMixer(three);
      let activeClipName: string | undefined;
      let activeAction: THREE.AnimationAction | undefined;
      const updateAnimation = (clipName: string, localTimeSeconds: number) => {
        const clip = clips.find(({ name }) => name === clipName);
        if (!clip) return;
        if (activeClipName !== clipName) {
          activeAction?.stop();
          activeClipName = clipName;
          activeAction = mixer.clipAction(clip);
          activeAction.reset();
          activeAction.clampWhenFinished = true;
          activeAction.setLoop(
            /idle|aim/i.test(clipName) ? THREE.LoopRepeat : THREE.LoopOnce,
            /idle|aim/i.test(clipName) ? Number.POSITIVE_INFINITY : 1
          );
          activeAction.play();
        }
        const safeTime = Math.max(0, Number(localTimeSeconds) || 0);
        const clipTime =
          /idle|aim/i.test(clipName) && clip.duration > 0
            ? safeTime % clip.duration
            : Math.min(safeTime, clip.duration);
        mixer.setTime(clipTime);
      };
      return makeDisposable(
        {
          three,
          handAttachmentTransform: new THREE.Matrix4(),
          animationClipNames: clips.map(({ name }) => name),
          updateAnimation,
          socketWorldPosition: (socketName: string) => {
            const socket = three.getObjectByName(socketName);
            if (!socket) return undefined;
            three.updateWorldMatrix(true, true);
            return socket.getWorldPosition(new THREE.Vector3());
          },
        },
        () => {
          mixer.stopAllAction();
          mixer.uncacheRoot(three);
          instMats.forEach((material) => material.dispose());
        }
      );
    },
    () => {
      gltfDispose(gltf);
      materials.forEach((material) => material.dispose());
    }
  );
}

async function makeHarthmereChapter1ItemMesh(item: Item) {
  const semanticItemId =
    harthmereNativeItemIdForBiomesId(Number(item.id)) ?? String(item.id);
  const authored = getCh1ItemVisualAsset(semanticItemId);
  if (!authored) return undefined;

  const gltf = await parseGltf(await binaryFetch(authored.assetUrl));
  const canonicalMaterials = gltf.parser.json.materials as
    | Array<{
        name?: string;
        pbrMetallicRoughness?: { baseColorFactor?: number[] };
      }>
    | undefined;
  const [template, materials] = gltfToBasePassThree(
    gltf,
    (material) => {
      const materialIndex = gltf.parser.associations.get(material)?.materials;
      const baseColor = resolveCh1ItemGltfBaseColor(
        material.name,
        materialIndex,
        canonicalMaterials,
        material.color.toArray() as [number, number, number]
      );
      const next = makeBasicMaterial({
        baseColor,
        map: material.map ?? new THREE.Texture(),
        useMap: !!material.map,
        vertexColors: material.vertexColors,
      });
      next.name = material.name;
      next.userData = {
        ...material.userData,
        harthmereChapter1CanonicalBaseColor: baseColor,
        harthmereChapter1GltfMaterialName: material.name,
        harthmereChapter1GltfMaterialIndex: materialIndex,
      };
      return next;
    },
    true,
    true
  );
  // Chapter 1 props are authored in meters. The avatar hand socket shrinks a
  // literal real-world prop into the sleeve, so apply the shared readable
  // voxel-world multiplier after the ordinary meter-to-voxel conversion.
  template.scale.setScalar(
    WORLD_TO_VOX_SCALE * CH1_ITEM_WORLD_PRESENTATION_SCALE
  );

  return makeDisposable(
    () => {
      const three = template.clone();
      const [instanceMaterials] = cloneMaterials(three);
      return makeDisposable(
        {
          three,
          handAttachmentTransform: new THREE.Matrix4(),
        },
        () => instanceMaterials.forEach((material) => material.dispose())
      );
    },
    () => {
      gltfDispose(gltf);
      materials.forEach((material) => material.dispose());
    }
  );
}

function itemMeshPath(item: Item) {
  // Based on the item attributes, decide how to fetch or create the mesh.
  const meshPath = (() => {
    const meshGaloisPath = item.meshGaloisPath;
    if (meshGaloisPath) {
      return `item_meshes/${meshGaloisPath}`;
    }

    const galoisPath = item.galoisPath;
    if (galoisPath) {
      return `item_meshes/${galoisPath}`;
    }
  })();

  // Return the resolved asset URL for the mesh path if it exists.
  const url = meshPath ? resolveAssetUrlUntyped(meshPath) : undefined;
  if (url) {
    return url;
  }

  log.warn(`Failed to resolve mesh path "${meshPath}" for item "${item.id}"`);
  return undefined;
}

function proceduralFallbackMaterial(color: number) {
  // Procedural item fallbacks can be selected and attached after the player
  // avatar has already been coerced into the MRT/base material family. A stock
  // MeshStandardMaterial added at that point makes the marked player root
  // mixed (`base,three`), sends the stock shader into the MRT pass, and causes
  // a draw-buffer error every frame. Keep fallback items in the same generated
  // base pass as ordinary loaded item meshes so late hotbar selection remains
  // renderer-safe.
  return makeBasicMaterial({
    baseColor: new THREE.Color(color).toArray() as [number, number, number],
    useMap: false,
    vertexColors: false,
  });
}

export function makeMissingItemMesh(
  item: Item,
  reason: unknown
): ItemMeshFactory {
  if (item.id === BikkieIds.spikefish) {
    // Spikefish is a fishing reward without authored item-mesh JSON in the
    // production Bikkie snapshot. Give it an intentional fish silhouette
    // instead of reporting a missing-asset warning and rendering a cardboard
    // box every time it appears in inventory or the hotbar.
    const body = new THREE.SphereGeometry(4, 12, 8);
    body.scale(1.8, 0.75, 0.55);
    const tail = new THREE.ConeGeometry(3.2, 4.5, 3);
    tail.rotateZ(-Math.PI / 2);
    tail.translate(-8.5, 0, 0);
    const dorsal = new THREE.ConeGeometry(1.8, 3.5, 3);
    dorsal.translate(0, 3.4, 0);
    log.info("Using authored procedural Spikefish item mesh", {
      id: item.id,
      reason,
    });
    return makeDisposable(
      () => {
        const material = proceduralFallbackMaterial(0x6fb6c4);
        const group = new THREE.Group();
        group.add(
          new Mesh(body, material),
          new Mesh(tail, material),
          new Mesh(dorsal, material)
        );
        return makeDisposable({ three: group }, () => material.dispose());
      },
      () => {
        body.dispose();
        tail.dispose();
        dorsal.dispose();
      }
    );
  }

  // Local/dev snapshots can be missing arbitrary production item mesh JSON. Do
  // not chase another asset fallback here: previous fallbacks still tried to
  // fetch cardboard_box, which is also missing in the sparse local snapshot.
  // Return a small procedural box instead so UI/held-item rendering never
  // blocks the playable world.
  log.warn("Using procedural fallback item mesh", {
    id: item.id,
    reason,
  });

  const geometry = new THREE.BoxGeometry(6, 6, 6);
  geometry.translate(0, 0, 0);

  return makeDisposable(
    () => {
      const material = proceduralFallbackMaterial(0xb8874f);
      return makeDisposable(
        {
          three: new Mesh(geometry, material),
        },
        () => material.dispose()
      );
    },
    () => geometry.dispose()
  );
}

async function resolveGaloisItemMesh(
  context: ClientContext,
  deps: ClientResourceDeps,
  item: Item,
  path: string
) {
  let mesh: ItemMeshData;
  try {
    mesh = await jsonFetch<ItemMeshData>(path);
  } catch (error) {
    // Sparse local snapshots can contain Bikkie items whose generated mesh JSON
    // was never copied into /public/buckets. Treat that as an optional visual
    // miss instead of a fatal resource failure.
    return makeMissingItemMesh(item, error);
  }

  switch (mesh.kind) {
    case "GLTFItemMesh":
      {
        const handAttachmentTransform = item.attachmentTransform
          ? affineToMatrix(item.attachmentTransform)
          : mesh.hand_attachment_transform;
        switch (mesh.data.kind) {
          case "GLB":
            return gltfToItemMesh(
              // HARTHMERE_ATLAS_BASE64_DECODE (2026-08-04 mobile audit,
              // item 6). Was `Buffer.from(mesh.data.data, "base64").buffer`,
              // which hands the GLB parser the whole backing ArrayBuffer and
              // discards the offset -- so outside the browser it would be
              // parsing from the wrong byte entirely. See
              // `mobile_atlas_decode.ts`.
              decodeBase64ArrayBuffer(mesh.data.data),
              handAttachmentTransform,
              !!item.mesh
            );
          case "GLTF":
            return gltfToItemMesh(
              mesh.data.data,
              handAttachmentTransform,
              !!item.mesh
            );
        }
      }
      break;
    case "BlockItemMesh":
      return makeBlockItemMesh(context, deps, mesh);
    case "GlassItemMesh":
      return makeGlassItemMesh(context, deps, mesh);
    case "FloraItemMesh":
      return makeFloraItemMesh(context, deps, mesh);
  }
  throw new Error("Unknown item mesh kind.");
}

export class ItemMeshKey extends AcceptableAsPathKey {
  constructor(public readonly item: Item) {
    super();
  }

  toString() {
    return `${this.item.id}:${itemDyedColor(this.item)}`;
  }
}

async function makeItemMesh(
  context: ClientContext,
  deps: ClientResourceDeps,
  { item }: ItemMeshKey
): Promise<ItemMeshFactory> {
  try {
    const chapter1 = await makeHarthmereChapter1ItemMesh(item);
    if (chapter1) return chapter1;
  } catch (error) {
    log.warn("Failed to load authored Chapter 1 item mesh", {
      id: item.id,
      error,
    });
  }
  try {
    const premium = await makeHarthmerePremiumItemMesh(item);
    if (premium) return premium;
  } catch (error) {
    log.warn("Failed to load authored Harthmere premium item mesh", {
      id: item.id,
      error,
    });
  }
  if (item.mesh) {
    try {
      return await gltfToItemMesh(
        await binaryFetch(
          staticUrlForAttribute(resolveBinaryAttribute(item.mesh, item))
        ),
        affineToMatrix(item.attachmentTransform),
        true
      );
    } catch (error) {
      return makeMissingItemMesh(item, error);
    }
  }
  const path = itemMeshPath(item);
  if (!path) {
    return makeMissingItemMesh(item, "unresolved galois item mesh path");
  }
  try {
    return await resolveGaloisItemMesh(context, deps, item, path);
  } catch (error) {
    // Keep this outer guard too because a malformed mesh payload or GLTF parse
    // failure should be handled the same way as a missing file in local/dev.
    return makeMissingItemMesh(item, error);
  }
}

export async function addItemMeshResources(
  loader: RegistryLoader<ClientContext>,
  builder: ClientResourcesBuilder
) {
  builder.add("/scene/item/mesh", loader.provide(makeItemMesh));
}
