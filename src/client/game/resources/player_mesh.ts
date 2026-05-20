import type { PreviewSlot } from "@/client/components/character/CharacterPreview";
import type { ClientContext } from "@/client/game/context";
import { BasePassMaterial } from "@/client/game/renderers/base_pass_material";
import {
  ItemMeshKey,
  type ItemMeshInstance,
} from "@/client/game/resources/item_mesh";
import type { ParticleSystemMaterials } from "@/client/game/resources/particles";
import type {
  ClientResourceDeps,
  ClientResources,
  ClientResourcesBuilder,
} from "@/client/game/resources/types";
import { gltfToThree, loadGltf } from "@/client/game/util/gltf_helpers";
import {
  blockPlaceParticleTexture,
  playerBuffParticleMaterials,
  playerHealingParticleMaterials,
  warpPoofParticleMaterials,
} from "@/client/game/util/particles_systems";
import type {
  AnimatedPlayerMesh,
  PlayerAnimationName,
} from "@/client/game/util/player_animations";
import {
  loadPlayerAnimatedMesh,
  playerSystem,
} from "@/client/game/util/player_animations";
import { clonePlayerSkinnedMaterial } from "@/client/game/util/skinning";
import { resolveAssetUrl } from "@/galois/interface/asset_paths";
import { updateBasicMaterial } from "@/gen/client/game/shaders/basic";
import type { CharacterAnimationTiming } from "@/server/shared/minigames/ruleset/tweaks";
import {
  makePlayerMeshQueryString,
  type WearableAssignment,
} from "@/shared/api/assets";
import { isPaletteOption } from "@/shared/asset_defs/color_palettes";
import {
  HARTHMERE_DEFAULT_HUMAN_ANCHORS,
  HARTHMERE_FACIAL_EXPRESSION_EVENT,
  dispatchHarthmereFacialExpressionEvent,
  makeHarthmereFacialExpressionState,
  loadHarthmerePlayerAppearanceConfig,
  type HarthmereCharacterAppearance,
  type HarthmereCharacterAttachmentAnchors,
  type HarthmereCharacterClothing,
  type HarthmereClothingItem,
  type HarthmereClothingSlot,
  type HarthmereFacialExpressionState,
  type HarthmereVoxelBodyConfig,
  type HarthmereVoxelFaceConfig,
} from "@/shared/harthmere/voxel_faces";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { Disposable } from "@/shared/disposable";
import { makeDisposable } from "@/shared/disposable";
import type {
  Item,
  ReadonlyAppearance,
  ReadonlyItemAssignment,
} from "@/shared/ecs/gen/types";
import { anItem } from "@/shared/game/item";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import type { RegistryLoader } from "@/shared/registry";
import { mapMap } from "@/shared/util/collections";
import { itemDyedColor } from "@/shared/util/dye_helpers";
import type { Optional } from "@/shared/util/type_helpers";
import * as _ from "lodash";
import type { Texture } from "three";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils";

export interface LoadedPlayerMesh extends AnimatedPlayerMesh {
  id: BiomesId;
  hash: string;
  url: string;
  animationTimings: CharacterAnimationTiming;
  itemAttachment: ItemAttachment;
}

export interface PlayerWearingMeshGltf {
  mesh: GLTF;
  hash: string;
  url: string;
}

const HARTHMERE_PLAYER_BODY_VARIANT_BASE_URL =
  "/assets/harthmere/gltf/characters/player_body_variants";
const HARTHMERE_PLAYER_BODY_VARIANT_SCALE = 0.68;
const HARTHMERE_PLAYER_FACE_BODY_VISUAL_REFINEMENT_VERSION = "harthmere-face-body-visual-refinement-v11";
const HARTHMERE_PLAYER_MODULAR_CLOTHING_RUNTIME_VERSION = "harthmere-modular-clothing-runtime-v16-polished-threejs-catalog";
const HARTHMERE_PLAYER_CLOTHING_RENDER_MODE_STORAGE_KEY = "biomes.localDev.harthmere.clothingRenderer";

function isHarthmerePlayerBodyVariantUrl(url: string) {
  return url.includes(`${HARTHMERE_PLAYER_BODY_VARIANT_BASE_URL}/`);
}

function harthmerePlayerBodyVariantUrl(id: BiomesId) {
  const appearance = loadHarthmerePlayerAppearanceConfig(id);
  const { body } = appearance;
  const harthmereFace = appearance.face;
  const face = harthmereFace;
  const variantConfigKey = encodeURIComponent(
    [
      `u:${id}`,
      `apv:${appearance.version}`,
      `role:${appearance.role}`,
      `species:${appearance.species}`,
      `fa:${appearance.forwardAxis}`,
      `bt:${body.bodyType}`,
      `bh:${body.bodyHeight}`,
      `sw:${body.shoulderWidth}`,
      `al:${body.armLength}`,
      `ll:${body.legLength}`,
      `st:${body.stance}`,
      `oc:${body.outfitColor}`,
      `fs:${face.faceShape}`,
      `sk:${face.skinTone}`,
      `hs:${face.hairStyle}`,
      `hc:${face.hairColor}`,
      `es:${face.eyeShape}`,
      `ec:${face.eyeColor}`,
      `bs:${face.browStyle}`,
      `ns:${face.noseStyle}`,
      `ms:${face.mouthStyle}`,
      `fh:${face.facialHair}`,
      `ch:${face.cheekStyle}`,
      `ac:${face.accessory}`,
      `eq:${Object.entries(appearance.equipment).map(([slot, item]) => `${slot}:${item}`).join(",")}`,
      `cl:${Object.entries(appearance.clothing).map(([slot, item]) => `${slot}:${item?.id ?? ""}:${item?.bindMode ?? ""}:${item?.modelUrl ?? ""}`).join(",")}`,
    ].join(";")
  );
  // The actual static file path only depends on body type + outfit color. The
  // query string intentionally includes the owner and every face/body setting so
  // the resource cache does not reuse one mutated animated GLTF across multiple
  // users or multiple saved body variants. Static serving ignores the query
  // string, but the client resource key remains unique.
  return `${HARTHMERE_PLAYER_BODY_VARIANT_BASE_URL}/harthmere_player_${body.bodyType}_${body.outfitColor}.gltf?harthmereVariant=${variantConfigKey}`;
}

function playerMeshUrlForId(
  id: BiomesId | undefined,
  wearables?: ReadonlyItemAssignment,
  appearance?: ReadonlyAppearance
) {
  if (id && process.env.NODE_ENV !== "production") {
    return harthmerePlayerBodyVariantUrl(id);
  }
  return ecsWearablesToUrl(wearables, appearance);
}

async function makePlayerPreviewMesh(
  deps: ClientResourceDeps,
  slot: PreviewSlot
) {
  const preview = deps.get("/player/preview", slot);
  const id = preview.userId;
  const appearance = preview.appearance;
  const wearing = preview.wearing;

  const mesh = await makeAnimatedMesh(deps, true, wearing, appearance, id);

  if (preview.animationKey !== null) {
    // Apply the specified single animation to the player mesh's animation
    // state.
    mesh.animationSystem.applySingleActionToState(
      {
        layers: { arms: "apply", notArms: "apply" },
        state: { repeat: { kind: "repeat" }, startTime: 0 },
        weights: playerSystem.singleAnimationWeight(
          preview.animationKey ?? "idle",
          1
        ),
      },
      mesh.animationSystemState
    );
  }

  return makeDisposable(mesh, () => {
    mesh.dispose();
  });
}

async function makePlayerMesh(
  { userId }: { userId: BiomesId },
  deps: ClientResourceDeps,
  id: BiomesId
) {
  const wearing = deps.get("/ecs/c/wearing", id);
  const appearance = deps.get("/ecs/c/appearance_component", id);

  return makeAnimatedMesh(
    deps,
    userId !== id,
    wearing?.items,
    appearance?.appearance,
    id
  );
}

export interface PlayerPreview {
  userId: BiomesId;
  appearance?: ReadonlyAppearance;
  wearing?: ReadonlyItemAssignment;
  animationKey?: PlayerAnimationName | null;
  meshVersionKey?: string;
}

async function updatePlayerMesh(
  { userId }: { userId: BiomesId },
  deps: ClientResourceDeps,
  resource: Promise<Optional<LoadedPlayerMesh>>
) {
  const resolvedPromise = await resource;
  if (!resolvedPromise) {
    return;
  }

  const { id } = resolvedPromise;
  const wearing = deps.get("/ecs/c/wearing", id);
  const appearance = deps.get("/ecs/c/appearance_component", id);
  const url = playerMeshUrlForId(id, wearing?.items, appearance?.appearance);
  const isLocalPlayer = userId === id;
  // Only consider tweaks to be out-of-date for the local player to avoid
  // performing the deep comparison for all players' changes.
  const animationTimings = tweaksParams(deps);
  const tweaksOutOfDate =
    isLocalPlayer &&
    !_.isEqual(
      Object.values(animationTimings),
      Object.values(resolvedPromise.animationTimings)
    );

  if (resolvedPromise.url !== url || tweaksOutOfDate) {
    const ret = await makeAnimatedMesh(
      deps,
      !isLocalPlayer,
      wearing?.items,
      appearance?.appearance,
      id
    );
    Object.assign(resolvedPromise, ret);
  }
}

class ItemAttachment {
  private selectedItem: Item | undefined;
  private itemMeshInstance: ItemMeshInstance | undefined;

  constructor(private threeAttachNode: THREE.Object3D) {}

  updateAttachedItem(
    resources: ClientResources,
    item: Item | undefined,
    spatialLighting?: [number, number],
    light?: [number, number, number]
  ) {
    const attachedItem = this.setAttachedItem(resources, item);
    attachedItem?.three.traverse((obj) => {
      if (
        obj instanceof THREE.Mesh &&
        obj.material instanceof BasePassMaterial
      ) {
        updateBasicMaterial(obj.material, {
          light,
          spatialLighting,
        });
      }
    });

    return attachedItem;
  }

  private setAttachedItem(resources: ClientResources, item: Item | undefined) {
    // Nothing to do if our currently attached item is equal to what is being
    // set.
    if (_.isEqual(this.selectedItem, item)) {
      return this.itemMeshInstance;
    }

    if (this.itemMeshInstance) {
      // Dispose of the previous one, if it exists
      this.itemMeshInstance.dispose();
    }

    const itemMeshFactory =
      item && resources.cached("/scene/item/mesh", new ItemMeshKey(item));

    // We're either going to switch the attachment or clear it, either way
    // we want to start by resetting it.
    this.threeAttachNode.children.length = 0;

    // If we don't have an item here, clear the attachments and indicate that
    // we don't have anything selected (so that we can try again later.)
    if (!itemMeshFactory) {
      this.selectedItem = undefined;
      return;
    }

    // Create an item mesh instance and attach it to the three attachment node
    // in the player mesh.
    this.itemMeshInstance = itemMeshFactory();
    const withHandTransform = (() => {
      if (this.itemMeshInstance.handAttachmentTransform) {
        const transformed = new THREE.Object3D();
        transformed.applyMatrix4(this.itemMeshInstance.handAttachmentTransform);
        transformed.add(this.itemMeshInstance.three);
        return transformed;
      } else {
        return this.itemMeshInstance.three;
      }
    })();
    this.threeAttachNode.add(withHandTransform);

    // Track what our currently selected item is so that we can know if we need
    // to switch it later or not.
    this.selectedItem = item;

    return this.itemMeshInstance;
  }

  dispose() {
    if (this.itemMeshInstance) {
      this.itemMeshInstance.dispose();
    }
  }
}

async function makeAnimatedMesh(
  deps: ClientResourceDeps,
  frustumCulling: boolean,
  wearables: ReadonlyItemAssignment | undefined,
  appearance: ReadonlyAppearance | undefined,
  id: BiomesId
): Promise<Disposable<LoadedPlayerMesh>> {
  // Get both the player animations and the player mesh and merge them together.
  const { mesh, url, hash } = await fetchPlayerMeshGLTF(
    deps,
    wearables,
    appearance,
    id
  );
  setFrustumCulling(mesh, frustumCulling);

  const animationTimings = tweaksParams(deps);

  const isHarthmereVariantMesh = isHarthmerePlayerBodyVariantUrl(url);
  const localDevHarthmereAppearance =
    process.env.NODE_ENV !== "production"
      ? loadHarthmerePlayerAppearanceConfig(id)
      : undefined;
  const playerAnimatedMesh = loadPlayerAnimatedMesh(mesh, animationTimings);
  if (localDevHarthmereAppearance) {
    playerAnimatedMesh.three.userData.harthmereAppearance = localDevHarthmereAppearance;
    playerAnimatedMesh.three.userData.harthmereForwardAxis =
      localDevHarthmereAppearance.forwardAxis;
  }
  if (isHarthmereVariantMesh) {
    hideHarthmereVariantBuiltInHead(playerAnimatedMesh.three);
    applyLocalDevPlayerInnerBodyConfig(
      playerAnimatedMesh.three,
      localDevHarthmereAppearance?.body ?? loadHarthmerePlayerAppearanceConfig(id).body,
      HARTHMERE_PLAYER_BODY_VARIANT_SCALE
    );
  } else {
    addLocalDevPlayerBodyShellToObject(playerAnimatedMesh.three, id);
  }
  addLocalDevSimpleFaceToObject(playerAnimatedMesh.three, id);
  await addHarthmerePlayerModularClothingRuntime(
    playerAnimatedMesh.three,
    localDevHarthmereAppearance ?? loadHarthmerePlayerAppearanceConfig(id),
  );
  const disposeExpressionBridge = installHarthmerePlayerFacialExpressionBridge(
    playerAnimatedMesh.three,
    id,
  );

  const itemAttachment = new ItemAttachment(
    playerAnimatedMesh.threeWeaponAttachment
  );

  return makeDisposable(
    {
      ...playerAnimatedMesh,
      hash,
      url,
      id,
      animationTimings: { ...animationTimings },
      itemAttachment,
    },
    () => {
      disposeExpressionBridge?.();
      itemAttachment.dispose();
    }
  );
}

async function fetchPlayerAnimationsGLTF() {
  const anims = await loadGltf(resolveAssetUrl("wearables/animations"));
  anims.animations.forEach((x) => x.optimize());

  for (const anim of anims.animations) {
    for (const track of anim.tracks) {
      if (track.name.includes("_1")) {
        throw new Error(
          "GLTF nodes that include `_1` are not supported. This might mean that nodes with duplicate names existed and the threejs loader tweaked their names to ensure uniqueness, check for duplicate node names in the GLTF."
        );
      }
    }
  }

  return anims;
}

// Convert the ECS description of the player's appearance into its Galois
// counterpart, and then use that to return a URL for the character mesh
// asset.
export function ecsWearablesToQueryString(
  wearables?: ReadonlyItemAssignment,
  appearance?: ReadonlyAppearance
) {
  const wearablesAssignment =
    wearables === undefined
      ? []
      : (mapMap(wearables, (item, slot) => [
          slot,
          item.id,
          itemDyedColor(item),
        ]) as WearableAssignment);

  const skinColorId =
    appearance?.skin_color_id &&
    isPaletteOption("color_palettes/skin_colors", appearance.skin_color_id)
      ? appearance.skin_color_id
      : undefined;
  const eyeColorId =
    appearance?.eye_color_id &&
    isPaletteOption("color_palettes/eye_colors", appearance.eye_color_id)
      ? appearance.eye_color_id
      : undefined;
  const hairColorId =
    appearance?.hair_color_id &&
    isPaletteOption("color_palettes/hair_colors", appearance.hair_color_id)
      ? appearance.hair_color_id
      : undefined;

  if (appearance?.head_id) {
    // eye shape is implemented by setting the "head" wearable (which is
    // different than the "hat" wearable that you can equip.)
    wearablesAssignment.push([BikkieIds.head, appearance.head_id, undefined]);
  }

  return makePlayerMeshQueryString(
    wearablesAssignment,
    skinColorId,
    eyeColorId,
    hairColorId
  );
}

export function ecsWearablesToUrl(
  wearables?: ReadonlyItemAssignment,
  appearance?: ReadonlyAppearance
) {
  return `/api/assets/player_mesh.glb${ecsWearablesToQueryString(
    wearables,
    appearance
  )}`;
}

export function ecsWearablesToWarmupUrl(
  wearables?: ReadonlyItemAssignment,
  appearance?: ReadonlyAppearance
) {
  return `/api/assets/warm_player_mesh${ecsWearablesToQueryString(
    wearables,
    appearance
  )}`;
}

export function replaceWithPlayerMaterial(gltf: GLTF): void {
  const scene = gltfToThree(gltf);
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.computeVertexNormals();
      child.material = clonePlayerSkinnedMaterial();
    }
  });
}

function localDevFaceSeed(root: THREE.Object3D) {
  let seed = 0;
  for (const char of root.uuid) {
    seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  }
  return seed;
}

function makeLocalDevFaceTexture(
  seed: number
): THREE.CanvasTexture | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return undefined;
  }
  ctx.imageSmoothingEnabled = false;

  const skinTones = ["#f0c7a3", "#d79a72", "#b97955", "#8b5a3c", "#f3d4b5"];
  const hairColors = [
    "#2c1d16",
    "#5b321c",
    "#8a5a2b",
    "#d6b15f",
    "#1f1f24",
    "#7a2d22",
  ];
  const eyeColors = ["#1e2a3a", "#2f5b3c", "#5b3a28", "#475a78"];
  const skin = skinTones[seed % skinTones.length];
  const skinShadow = ["#d9a47f", "#b97855", "#965f43", "#6f432f", "#e0b894"][
    seed % skinTones.length
  ];
  const hair = hairColors[(seed >> 3) % hairColors.length];
  const eyes = eyeColors[(seed >> 6) % eyeColors.length];
  const hasBeard = (seed & 4) !== 0;
  const stern = (seed & 1) !== 0;

  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Square, Minecraft-like head front. No curves, ellipses, bezier paths, or
  // anti-aliased strokes: every feature is a crisp voxel/pixel rectangle.
  rect(4, 4, 24, 24, skin);
  rect(4, 24, 24, 4, skinShadow);
  rect(4, 4, 24, 6, hair);
  rect(4, 10, 4, 8, hair);
  rect(24, 10, 4, 8, hair);

  // Slightly different blocky hairlines by seed.
  if ((seed & 2) === 0) {
    rect(8, 10, 5, 2, hair);
    rect(18, 10, 6, 2, hair);
  } else {
    rect(10, 9, 4, 3, hair);
    rect(14, 10, 4, 2, hair);
  }

  // Eyes and brows.
  rect(9, 15, 4, 3, "#f7f2e9");
  rect(20, 15, 4, 3, "#f7f2e9");
  rect(11, 15, 2, 3, eyes);
  rect(20, 15, 2, 3, eyes);
  rect(9, 13, 5, 1, hair);
  rect(19, 13, 5, 1, hair);

  // Nose, mouth, and optional beard/mustache.
  rect(15, 18, 2, 4, skinShadow);
  if (hasBeard) {
    rect(9, 21, 15, 2, hair);
    rect(11, 23, 11, 4, hair);
    rect(13, 22, 7, 1, stern ? "#1a1110" : "#6b2f33");
  } else {
    rect(stern ? 12 : 11, stern ? 24 : 23, stern ? 8 : 10, 2, "#6b2f33");
    if (!stern) {
      rect(13, 25, 6, 1, "#6b2f33");
    }
  }

  // Neck/collar pixels connect the square face to the body without creating a
  // painted portrait look.
  rect(13, 28, 6, 4, skinShadow);
  rect(8, 30, 16, 2, (seed & 8) === 0 ? "#663333" : "#27384f");

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
let harthmerePlayerToonGradientMap: THREE.DataTexture | undefined;
const harthmerePlayerRoundedVoxelGeometryCache = new Map<string, THREE.BufferGeometry>();

function getHarthmerePlayerToonGradientMap() {
  if (harthmerePlayerToonGradientMap) {
    return harthmerePlayerToonGradientMap;
  }

  // Three.js no longer exposes RGBFormat in the version used by this repo.
  // Keep the toon ramp library-backed and explicit by storing four RGBA
  // pixels. MeshToonMaterial samples this nearest-filtered ramp to create
  // clean cel bands on the rounded voxel pieces.
  const data = new Uint8Array([
    58, 58, 58, 255,
    128, 128, 128, 255,
    205, 205, 205, 255,
    255, 255, 255, 255,
  ]);
  harthmerePlayerToonGradientMap = new THREE.DataTexture(
    data,
    4,
    1,
    THREE.RGBAFormat,
  );
  harthmerePlayerToonGradientMap.magFilter = THREE.NearestFilter;
  harthmerePlayerToonGradientMap.minFilter = THREE.NearestFilter;
  harthmerePlayerToonGradientMap.generateMipmaps = false;
  harthmerePlayerToonGradientMap.needsUpdate = true;
  harthmerePlayerToonGradientMap.name = "harthmere-player-toon-gradient-map";
  return harthmerePlayerToonGradientMap;
}

function makeHarthmerePlayerRoundedVoxelGeometry(
  size: [number, number, number],
) {
  const minEdge = Math.min(...size);
  const radius = Math.max(0.002, Math.min(0.045, minEdge * 0.18));
  const segments = minEdge < 0.08 ? 1 : 2;
  const key = `${size[0]}:${size[1]}:${size[2]}:${segments}:${radius}`;
  const cached = harthmerePlayerRoundedVoxelGeometryCache.get(key);
  if (cached) {
    return cached;
  }

  // Third-party visual polish: RoundedBoxGeometry is a Three.js addon geometry
  // that keeps the voxel silhouette but removes the cheap prototype-block look.
  // This is intentionally centralized so future artists can tune radius/segments
  // without hunting through every hair, brow, mouth, outfit, and gear voxel.
  const geometry = new RoundedBoxGeometry(
    size[0],
    size[1],
    size[2],
    segments,
    radius,
  );
  geometry.computeVertexNormals();
  geometry.name = "harthmere-player-rounded-voxel-geometry";
  harthmerePlayerRoundedVoxelGeometryCache.set(key, geometry);
  return geometry;
}

function localDevBoltHeadMaterial(color: number) {
  const material = new THREE.MeshToonMaterial({
    color,
    gradientMap: getHarthmerePlayerToonGradientMap(),
  });
  material.name = "harthmere-player-polished-toon-voxel-material";
  material.userData.harthmereThirdPartyVisualPolish =
    "three-rounded-box-geometry+mesh-toon-material";
  return material;
}

function rememberHarthmerePlayerFacePartNeutralTransform(object: THREE.Object3D) {
  // Facial expressions are runtime state, not saved character-builder state.
  // Store the neutral transform once so combat/dialogue/relationship moments can
  // bend eyes, brows, and mouths, then reliably return them to the selected face.
  object.userData.harthmereExpressionNeutral ??= {
    position: object.position.toArray(),
    rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
    scale: object.scale.toArray(),
    visible: object.visible,
  };
}

function restoreHarthmerePlayerFacePartNeutralTransform(object: THREE.Object3D) {
  const neutral = object.userData.harthmereExpressionNeutral as
    | { position: number[]; rotation: number[]; scale: number[]; visible: boolean }
    | undefined;
  if (!neutral) return;
  object.position.fromArray(neutral.position);
  object.rotation.set(neutral.rotation[0] ?? 0, neutral.rotation[1] ?? 0, neutral.rotation[2] ?? 0);
  object.scale.fromArray(neutral.scale);
  object.visible = neutral.visible;
}

function localDevBoltHeadBox(
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  color: number
) {
  const mesh = new THREE.Mesh(
    makeHarthmerePlayerRoundedVoxelGeometry(size),
    localDevBoltHeadMaterial(color)
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.harthmereThirdPartyVisualPolish =
    "rounded voxel mesh generated with Three.js addon geometry";
  rememberHarthmerePlayerFacePartNeutralTransform(mesh);
  return mesh;
}

const HARTHMERE_PLAYER_SKIN_COLORS = {
  porcelain: 0xf0c7a3,
  light: 0xe4b48e,
  warm: 0xd19a68,
  tan: 0xb9825a,
  brown: 0x8f5f3f,
  deep: 0x5c3a2c,
  metal: 0x9ca3af,
} as const;

const HARTHMERE_PLAYER_SKIN_SHADOW_COLORS = {
  porcelain: 0xd9a47f,
  light: 0xc48a66,
  warm: 0x9a5f3e,
  tan: 0x7e4f36,
  brown: 0x5f3d2d,
  deep: 0x3a261e,
  metal: 0x657084,
} as const;

const HARTHMERE_PLAYER_HAIR_COLORS = {
  black: 0x1f1a16,
  brown: 0x3a2518,
  auburn: 0x6a2f21,
  blonde: 0xb89652,
  gray: 0x707070,
  white: 0xd6d0c8,
  red: 0x7a2d22,
  blue: 0x233a5a,
  green: 0x24523a,
  purple: 0x4a2d5a,
} as const;

const HARTHMERE_PLAYER_EYE_COLORS = {
  black: 0x151515,
  brown: 0x5a3a22,
  blue: 0x203a54,
  green: 0x2d4d2f,
  hazel: 0x6a5a2e,
  gray: 0x59656d,
  amber: 0x9a6b24,
  violet: 0x493463,
} as const;

function removeLocalDevFaceObject(root: THREE.Object3D, name: string) {
  const existing = root.getObjectByName(name);
  if (existing?.parent) {
    existing.parent.remove(existing);
  }
}

function harthmereVoxelColorChannelMix(source: number, target: number, amount: number) {
  const sourcePart = source & 0xff;
  const targetPart = target & 0xff;
  return Math.round(sourcePart + (targetPart - sourcePart) * amount) & 0xff;
}

function harthmereVoxelColorMix(source: number, target: number, amount: number) {
  const r = harthmereVoxelColorChannelMix(source >> 16, target >> 16, amount);
  const g = harthmereVoxelColorChannelMix(source >> 8, target >> 8, amount);
  const b = harthmereVoxelColorChannelMix(source, target, amount);
  return (r << 16) | (g << 8) | b;
}

function harthmereVoxelColorLighten(color: number, amount = 0.18) {
  return harthmereVoxelColorMix(color, 0xffffff, amount);
}

function harthmereVoxelColorDarken(color: number, amount = 0.24) {
  return harthmereVoxelColorMix(color, 0x000000, amount);
}

function localDevPlayerVoxelFaceFromConfig(
  faceConfig: HarthmereVoxelFaceConfig,
): LocalDevPlayerVoxelFaceSpec {
  const headWidthByShape: Record<HarthmereVoxelFaceConfig["faceShape"], number> = {
    bolt_square: 0.48,
    wide: 0.56,
    narrow: 0.4,
    tall: 0.46,
    soft: 0.52,
  };
  const headHeightByShape: Record<HarthmereVoxelFaceConfig["faceShape"], number> = {
    bolt_square: 0.48,
    wide: 0.46,
    narrow: 0.5,
    tall: 0.6,
    soft: 0.46,
  };
  const headDepthByShape: Record<HarthmereVoxelFaceConfig["faceShape"], number> = {
    bolt_square: 0.42,
    wide: 0.44,
    narrow: 0.36,
    tall: 0.4,
    soft: 0.44,
  };
  const headWidth = headWidthByShape[faceConfig.faceShape];
  const headHeight = headHeightByShape[faceConfig.faceShape];
  const headDepth = headDepthByShape[faceConfig.faceShape];

  const eyeSpreadByShape: Record<HarthmereVoxelFaceConfig["eyeShape"], number> = {
    square: 0.105,
    wide: 0.135,
    small: 0.088,
    sleepy: 0.112,
    sharp: 0.122,
  };
  const eyeWidthByShape: Record<HarthmereVoxelFaceConfig["eyeShape"], number> = {
    square: 0.06,
    wide: 0.09,
    small: 0.04,
    sleepy: 0.075,
    sharp: 0.08,
  };
  const eyeHeightByShape: Record<HarthmereVoxelFaceConfig["eyeShape"], number> = {
    square: 0.055,
    wide: 0.045,
    small: 0.04,
    sleepy: 0.026,
    sharp: 0.034,
  };
  const eyeYByShape: Record<HarthmereVoxelFaceConfig["eyeShape"], number> = {
    square: 1.6,
    wide: 1.598,
    small: 1.602,
    sleepy: 1.585,
    sharp: 1.61,
  };
  const eyeSpread = eyeSpreadByShape[faceConfig.eyeShape];
  const eyeY = eyeYByShape[faceConfig.eyeShape];

  const noseSizeByStyle: Record<HarthmereVoxelFaceConfig["noseStyle"], [number, number, number]> = {
    small: [0.052, 0.06, 0.06],
    straight: [0.072, 0.088, 0.074],
    wide: [0.108, 0.07, 0.08],
    long: [0.068, 0.125, 0.075],
    button: [0.088, 0.055, 0.09],
  };
  const noseYByStyle: Record<HarthmereVoxelFaceConfig["noseStyle"], number> = {
    small: 1.535,
    straight: 1.53,
    wide: 1.525,
    long: 1.51,
    button: 1.545,
  };

  const mouthWidthByStyle: Record<HarthmereVoxelFaceConfig["mouthStyle"], number> = {
    line: 0.16,
    smile: 0.17,
    frown: 0.17,
    open: 0.12,
    stern: 0.12,
    smirk: 0.15,
  };
  const mouthHeightByStyle: Record<HarthmereVoxelFaceConfig["mouthStyle"], number> = {
    line: 0.025,
    smile: 0.026,
    frown: 0.026,
    open: 0.065,
    stern: 0.022,
    smirk: 0.026,
  };
  const mouthYByStyle: Record<HarthmereVoxelFaceConfig["mouthStyle"], number> = {
    line: 1.44,
    smile: 1.455,
    frown: 1.425,
    open: 1.438,
    stern: 1.442,
    smirk: 1.452,
  };

  const hairThicknessByStyle: Record<HarthmereVoxelFaceConfig["hairStyle"], number> = {
    flat: 0.11,
    side_part: 0.13,
    short_crown: 0.16,
    balding: 0.06,
    hood: 0.14,
    cap: 0.13,
    braids: 0.11,
    curly: 0.16,
    shaved: 0.035,
    bob: 0.13,
    long: 0.13,
    bun: 0.12,
    pigtails: 0.12,
    wavy: 0.15,
  };
  const sideburnHeightByStyle: Record<HarthmereVoxelFaceConfig["hairStyle"], number> = {
    flat: 0.2,
    side_part: 0.18,
    short_crown: 0.14,
    balding: 0.23,
    hood: 0.12,
    cap: 0.1,
    braids: 0.4,
    curly: 0.18,
    shaved: 0.055,
    bob: 0.34,
    long: 0.54,
    bun: 0.2,
    pigtails: 0.38,
    wavy: 0.3,
  };
  const hairThickness = hairThicknessByStyle[faceConfig.hairStyle];
  const sideburnHeight = sideburnHeightByStyle[faceConfig.hairStyle];

  return {
    skin: HARTHMERE_PLAYER_SKIN_COLORS[faceConfig.skinTone],
    skinShadow: HARTHMERE_PLAYER_SKIN_SHADOW_COLORS[faceConfig.skinTone],
    hair: HARTHMERE_PLAYER_HAIR_COLORS[faceConfig.hairColor],
    eye: HARTHMERE_PLAYER_EYE_COLORS[faceConfig.eyeColor],
    mouth: faceConfig.mouthStyle === "open" ? 0x6b2f33 : 0x2a1712,
    cheek: faceConfig.cheekStyle === "freckled" ? 0x6a3c28 : faceConfig.cheekStyle === "strong" ? 0x8a5844 : 0xd98a7c,
    headSize: [headWidth, headHeight, headDepth],
    headPosition: [0, 1.58, -0.01],
    hairSize: [headWidth + 0.02, hairThickness, headDepth + 0.02],
    hairPosition: [0, 1.58 + headHeight / 2 + hairThickness / 2, -0.01],
    leftSideburnSize: [faceConfig.hairStyle === "braids" ? 0.07 : 0.08, sideburnHeight, headDepth + 0.02],
    leftSideburnPosition: [-headWidth / 2 - 0.015, 1.6, -0.01],
    rightSideburnSize: [faceConfig.hairStyle === "braids" ? 0.07 : 0.08, sideburnHeight, headDepth + 0.02],
    rightSideburnPosition: [headWidth / 2 + 0.015, 1.6, -0.01],
    leftEyeSize: [eyeWidthByShape[faceConfig.eyeShape], eyeHeightByShape[faceConfig.eyeShape], 0.03],
    leftEyePosition: [-eyeSpread, eyeY, -headDepth / 2 - 0.032],
    rightEyeSize: [eyeWidthByShape[faceConfig.eyeShape], eyeHeightByShape[faceConfig.eyeShape], 0.03],
    rightEyePosition: [eyeSpread, eyeY, -headDepth / 2 - 0.032],
    noseSize: noseSizeByStyle[faceConfig.noseStyle],
    nosePosition: [0, noseYByStyle[faceConfig.noseStyle], -headDepth / 2 - 0.052],
    mouthSize: [mouthWidthByStyle[faceConfig.mouthStyle], mouthHeightByStyle[faceConfig.mouthStyle], 0.026],
    mouthPosition: [faceConfig.mouthStyle === "smirk" ? 0.028 : 0, mouthYByStyle[faceConfig.mouthStyle], -headDepth / 2 - 0.04],
    browSize: [faceConfig.browStyle === "soft" ? 0.09 : faceConfig.browStyle === "stern" ? 0.14 : 0.12, faceConfig.browStyle === "scarred" ? 0.026 : 0.02, 0.026],
    leftBrowPosition: [-eyeSpread, eyeY + (faceConfig.browStyle === "soft" ? 0.055 : 0.07), -headDepth / 2 - 0.04],
    rightBrowPosition: [eyeSpread, eyeY + (faceConfig.browStyle === "stern" ? 0.052 : 0.07), -headDepth / 2 - 0.04],
    accessory: faceConfig.accessory,
    cheekStyle: faceConfig.cheekStyle,
    eyeShape: faceConfig.eyeShape,
    browStyle: faceConfig.browStyle,
    noseStyle: faceConfig.noseStyle,
    mouthStyle: faceConfig.mouthStyle,
    hairStyle: faceConfig.hairStyle,
    facialHair: faceConfig.facialHair,
    sideProfile: harthmerePlayerFaceSideProfile(faceConfig),
  };
}

type HarthmerePlayerFaceSideProfile = {
  leftWidthScale: number;
  rightWidthScale: number;
  leftHeightScale: number;
  rightHeightScale: number;
  leftYOffset: number;
  rightYOffset: number;
  leftZOffset: number;
  rightZOffset: number;
  highlightSide: "left" | "right";
  jawNotchSide: "left" | "right" | "none";
  markSide: "left" | "right" | "none";
  hairPartSide: "left" | "right";
  hairLockSide: "left" | "right" | "none";
};

const HARTHMERE_SYMMETRIC_PLAYER_FACE_SIDE_PROFILE: HarthmerePlayerFaceSideProfile = {
  leftWidthScale: 1,
  rightWidthScale: 1,
  leftHeightScale: 1,
  rightHeightScale: 1,
  leftYOffset: 0,
  rightYOffset: 0,
  leftZOffset: 0,
  rightZOffset: 0,
  highlightSide: "left",
  jawNotchSide: "none",
  markSide: "none",
  hairPartSide: "left",
  hairLockSide: "none",
};

function harthmerePlayerFaceProfileSeed(faceConfig: HarthmereVoxelFaceConfig) {
  let seed = 2166136261;
  const token = [
    faceConfig.skinTone,
    faceConfig.hairColor,
    faceConfig.eyeColor,
    faceConfig.faceShape,
    faceConfig.eyeShape,
    faceConfig.browStyle,
    faceConfig.noseStyle,
    faceConfig.mouthStyle,
    faceConfig.hairStyle,
    faceConfig.facialHair,
    faceConfig.cheekStyle,
    faceConfig.accessory,
  ].join("|");
  for (const char of token) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 16777619) >>> 0;
  }
  return seed >>> 0;
}

function harthmerePlayerFaceSideProfile(
  faceConfig: HarthmereVoxelFaceConfig,
): HarthmerePlayerFaceSideProfile {
  const seed = harthmerePlayerFaceProfileSeed(faceConfig);
  const majorLeft = (seed & 1) === 0;
  const jawVariant = (seed >>> 3) % 4;
  const markVariant = (seed >>> 7) % 5;
  const lockVariant = (seed >>> 11) % 4;
  return {
    leftWidthScale: majorLeft ? 1.16 : 0.9,
    rightWidthScale: majorLeft ? 0.92 : 1.15,
    leftHeightScale: majorLeft ? 1.12 : 0.95,
    rightHeightScale: majorLeft ? 0.96 : 1.1,
    leftYOffset: majorLeft ? 0.014 : -0.006,
    rightYOffset: majorLeft ? -0.006 : 0.014,
    leftZOffset: majorLeft ? -0.008 : 0.006,
    rightZOffset: majorLeft ? 0.006 : -0.008,
    highlightSide: majorLeft ? "left" : "right",
    jawNotchSide: jawVariant === 0 ? "none" : jawVariant === 1 ? "left" : "right",
    markSide: markVariant === 0 ? "none" : markVariant % 2 === 0 ? "left" : "right",
    hairPartSide: ((seed >>> 5) & 1) === 0 ? "left" : "right",
    hairLockSide: lockVariant === 0 ? "none" : lockVariant % 2 === 0 ? "left" : "right",
  };
}

type LocalDevPlayerVoxelFaceSpec = {
  skin: number;
  skinShadow: number;
  hair: number;
  eye: number;
  mouth: number;
  cheek: number;
  headSize: [number, number, number];
  headPosition: [number, number, number];
  hairSize: [number, number, number];
  hairPosition: [number, number, number];
  leftSideburnSize: [number, number, number];
  leftSideburnPosition: [number, number, number];
  rightSideburnSize: [number, number, number];
  rightSideburnPosition: [number, number, number];
  leftEyeSize: [number, number, number];
  leftEyePosition: [number, number, number];
  rightEyeSize: [number, number, number];
  rightEyePosition: [number, number, number];
  noseSize: [number, number, number];
  nosePosition: [number, number, number];
  mouthSize: [number, number, number];
  mouthPosition: [number, number, number];
  browSize: [number, number, number];
  leftBrowPosition: [number, number, number];
  rightBrowPosition: [number, number, number];
  accessory?: HarthmereVoxelFaceConfig["accessory"];
  cheekStyle?: HarthmereVoxelFaceConfig["cheekStyle"];
  eyeShape?: HarthmereVoxelFaceConfig["eyeShape"];
  browStyle?: HarthmereVoxelFaceConfig["browStyle"];
  noseStyle?: HarthmereVoxelFaceConfig["noseStyle"];
  mouthStyle?: HarthmereVoxelFaceConfig["mouthStyle"];
  hairStyle?: HarthmereVoxelFaceConfig["hairStyle"];
  facialHair?: HarthmereVoxelFaceConfig["facialHair"];
  sideProfile: HarthmerePlayerFaceSideProfile;
};

const LOCAL_DEV_PLAYER_VOXEL_FACE: LocalDevPlayerVoxelFaceSpec = {
  skin: 0xd19a68,
  skinShadow: 0x9a5f3e,
  hair: 0x3a2518,
  eye: 0x151515,
  mouth: 0x2a1712,
  cheek: 0xd98a7c,
  headSize: [0.48, 0.48, 0.42],
  headPosition: [0, 1.58, -0.01],
  hairSize: [0.5, 0.11, 0.44],
  hairPosition: [0, 1.85, -0.01],
  leftSideburnSize: [0.08, 0.2, 0.44],
  leftSideburnPosition: [-0.25, 1.65, -0.01],
  rightSideburnSize: [0.08, 0.2, 0.44],
  rightSideburnPosition: [0.25, 1.65, -0.01],
  leftEyeSize: [0.06, 0.055, 0.03],
  leftEyePosition: [-0.105, 1.6, -0.245],
  rightEyeSize: [0.06, 0.055, 0.03],
  rightEyePosition: [0.105, 1.6, -0.245],
  noseSize: [0.075, 0.075, 0.075],
  nosePosition: [0, 1.535, -0.262],
  mouthSize: [0.16, 0.03, 0.026],
  mouthPosition: [0, 1.44, -0.248],
  browSize: [0.12, 0.02, 0.026],
  leftBrowPosition: [-0.105, 1.665, -0.25],
  rightBrowPosition: [0.105, 1.665, -0.25],
  accessory: "none",
  cheekStyle: "none",
  eyeShape: "square",
  browStyle: "straight",
  noseStyle: "straight",
  mouthStyle: "line",
  hairStyle: "flat",
  facialHair: "none",
  sideProfile: HARTHMERE_SYMMETRIC_PLAYER_FACE_SIDE_PROFILE,
};

function shiftLocalDevFacePositionY(
  position: [number, number, number],
  yOffset: number,
): [number, number, number] {
  return [position[0], position[1] + yOffset, position[2]];
}

function shiftLocalDevPlayerVoxelFaceSpecY(
  face: LocalDevPlayerVoxelFaceSpec,
  yOffset: number,
): LocalDevPlayerVoxelFaceSpec {
  return {
    ...face,
    headPosition: shiftLocalDevFacePositionY(face.headPosition, yOffset),
    hairPosition: shiftLocalDevFacePositionY(face.hairPosition, yOffset),
    leftSideburnPosition: shiftLocalDevFacePositionY(face.leftSideburnPosition, yOffset),
    rightSideburnPosition: shiftLocalDevFacePositionY(face.rightSideburnPosition, yOffset),
    leftEyePosition: shiftLocalDevFacePositionY(face.leftEyePosition, yOffset),
    rightEyePosition: shiftLocalDevFacePositionY(face.rightEyePosition, yOffset),
    nosePosition: shiftLocalDevFacePositionY(face.nosePosition, yOffset),
    mouthPosition: shiftLocalDevFacePositionY(face.mouthPosition, yOffset),
    leftBrowPosition: shiftLocalDevFacePositionY(face.leftBrowPosition, yOffset),
    rightBrowPosition: shiftLocalDevFacePositionY(face.rightBrowPosition, yOffset),
  };
}

function scaleHarthmereExpressionPart(object: THREE.Object3D | undefined, scale: [number, number, number]) {
  if (!object) return;
  object.scale.set(object.scale.x * scale[0], object.scale.y * scale[1], object.scale.z * scale[2]);
}
function moveHarthmereExpressionPart(object: THREE.Object3D | undefined, x: number, y: number, z: number) {
  if (!object) return;
  object.position.x += x; object.position.y += y; object.position.z += z;
}
function rotateHarthmereExpressionPart(object: THREE.Object3D | undefined, z: number) {
  if (!object) return;
  object.rotation.z += z;
}
function applyHarthmerePlayerFacialExpressionToFaceRoot(faceRoot: THREE.Object3D, input: HarthmereFacialExpressionState) {
  const state = makeHarthmereFacialExpressionState(input);
  const intensity = state.intensity;
  faceRoot.traverse((object) => restoreHarthmerePlayerFacePartNeutralTransform(object));
  const leftEye = faceRoot.getObjectByName("local-dev-bolt-left-eye");
  const rightEye = faceRoot.getObjectByName("local-dev-bolt-right-eye");
  const leftBrow = faceRoot.getObjectByName("local-dev-bolt-left-brow");
  const rightBrow = faceRoot.getObjectByName("local-dev-bolt-right-brow");
  const mouth = faceRoot.getObjectByName("local-dev-bolt-mouth");
  const leftMouth = faceRoot.getObjectByName("local-dev-bolt-smile-left") ?? faceRoot.getObjectByName("local-dev-bolt-frown-left") ?? faceRoot.getObjectByName("local-dev-bolt-smirk-corner");
  const rightMouth = faceRoot.getObjectByName("local-dev-bolt-smile-right") ?? faceRoot.getObjectByName("local-dev-bolt-frown-right");
  const teeth = faceRoot.getObjectByName("local-dev-bolt-open-mouth-teeth");
  switch (state.expression) {
    case "happy": case "friendly":
      scaleHarthmereExpressionPart(leftEye, [1.06, 0.78, 1]); scaleHarthmereExpressionPart(rightEye, [1.06, 0.78, 1]);
      moveHarthmereExpressionPart(leftBrow, 0, 0.015 * intensity, 0); moveHarthmereExpressionPart(rightBrow, 0, 0.015 * intensity, 0);
      scaleHarthmereExpressionPart(mouth, [1.18, 0.9, 1]); moveHarthmereExpressionPart(mouth, 0, 0.018 * intensity, 0);
      rotateHarthmereExpressionPart(leftMouth, 0.28 * intensity); rotateHarthmereExpressionPart(rightMouth, -0.28 * intensity); break;
    case "sad":
      scaleHarthmereExpressionPart(leftEye, [0.92, 0.82, 1]); scaleHarthmereExpressionPart(rightEye, [0.92, 0.82, 1]);
      moveHarthmereExpressionPart(leftBrow, 0, -0.015 * intensity, 0); moveHarthmereExpressionPart(rightBrow, 0, -0.015 * intensity, 0);
      rotateHarthmereExpressionPart(leftBrow, -0.18 * intensity); rotateHarthmereExpressionPart(rightBrow, 0.18 * intensity);
      moveHarthmereExpressionPart(mouth, 0, -0.018 * intensity, 0); rotateHarthmereExpressionPart(leftMouth, -0.28 * intensity); rotateHarthmereExpressionPart(rightMouth, 0.28 * intensity); break;
    case "angry": case "determined":
      scaleHarthmereExpressionPart(leftEye, [1.05, 0.68, 1]); scaleHarthmereExpressionPart(rightEye, [1.05, 0.68, 1]);
      moveHarthmereExpressionPart(leftBrow, 0, -0.01 * intensity, 0); moveHarthmereExpressionPart(rightBrow, 0, -0.01 * intensity, 0);
      rotateHarthmereExpressionPart(leftBrow, -0.34 * intensity); rotateHarthmereExpressionPart(rightBrow, 0.34 * intensity); scaleHarthmereExpressionPart(mouth, [0.9, 0.78, 1]); break;
    case "surprised":
      scaleHarthmereExpressionPart(leftEye, [1.2, 1.24, 1]); scaleHarthmereExpressionPart(rightEye, [1.2, 1.24, 1]);
      moveHarthmereExpressionPart(leftBrow, 0, 0.035 * intensity, 0); moveHarthmereExpressionPart(rightBrow, 0, 0.035 * intensity, 0);
      scaleHarthmereExpressionPart(mouth, [0.75, 1.9, 1]); if (teeth) teeth.visible = true; break;
    case "afraid":
      scaleHarthmereExpressionPart(leftEye, [1.12, 1.12, 1]); scaleHarthmereExpressionPart(rightEye, [1.12, 1.12, 1]);
      moveHarthmereExpressionPart(leftBrow, 0, 0.026 * intensity, 0); moveHarthmereExpressionPart(rightBrow, 0, 0.026 * intensity, 0);
      rotateHarthmereExpressionPart(leftBrow, 0.18 * intensity); rotateHarthmereExpressionPart(rightBrow, -0.18 * intensity); scaleHarthmereExpressionPart(mouth, [0.9, 1.45, 1]); break;
    case "hurt":
      scaleHarthmereExpressionPart(leftEye, [0.62, 0.55, 1]); scaleHarthmereExpressionPart(rightEye, [1.08, 0.82, 1]);
      rotateHarthmereExpressionPart(leftBrow, -0.28 * intensity); rotateHarthmereExpressionPart(rightBrow, 0.18 * intensity);
      moveHarthmereExpressionPart(mouth, 0.015 * intensity, -0.012 * intensity, 0); rotateHarthmereExpressionPart(mouth, -0.12 * intensity); break;
    case "dead":
      scaleHarthmereExpressionPart(leftEye, [1.2, 0.34, 1]); scaleHarthmereExpressionPart(rightEye, [1.2, 0.34, 1]);
      rotateHarthmereExpressionPart(leftEye, 0.48); rotateHarthmereExpressionPart(rightEye, -0.48); scaleHarthmereExpressionPart(mouth, [0.8, 0.55, 1]); break;
    case "thinking": case "suspicious":
      scaleHarthmereExpressionPart(leftEye, [0.92, 0.72, 1]); scaleHarthmereExpressionPart(rightEye, [1.08, 0.88, 1]);
      rotateHarthmereExpressionPart(leftBrow, state.expression === "suspicious" ? -0.22 : 0.18); rotateHarthmereExpressionPart(rightBrow, state.expression === "suspicious" ? 0.08 : -0.08);
      moveHarthmereExpressionPart(mouth, state.expression === "suspicious" ? 0.014 : 0, 0, 0); break;
    case "neutral": default: break;
  }
  faceRoot.userData.harthmereFacialExpression = state;
}
function applyHarthmerePlayerFacialExpressionToObject(root: THREE.Object3D, state: HarthmereFacialExpressionState) {
  root.traverse((object) => { if (object.userData.harthmerePlayerFaceExpressionRoot) applyHarthmerePlayerFacialExpressionToFaceRoot(object, state); });
}
function installHarthmerePlayerFacialExpressionBridge(root: THREE.Object3D, userId: BiomesId) {
  if (typeof window === "undefined") return undefined;
  const actorIds = new Set(["player", "you", "Player", String(userId)]);
  let lastStateAt = 0;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent).detail as HarthmereFacialExpressionState | undefined;
    if (!detail) return;
    const actorId = String(detail.actorId ?? detail.targetId ?? "player");
    if (!actorIds.has(actorId)) return;
    const state = makeHarthmereFacialExpressionState(detail);
    lastStateAt = state.at;
    applyHarthmerePlayerFacialExpressionToObject(root, state);
    const remaining = state.expiresAt ? state.expiresAt - Date.now() : 0;
    if (remaining > 0) {
      window.setTimeout(() => {
        if (lastStateAt !== state.at) return;
        applyHarthmerePlayerFacialExpressionToObject(root, makeHarthmereFacialExpressionState({ actorId, expression: "neutral", source: "ambient", reason: "expression-expired" }));
      }, remaining);
    }
  };
  window.addEventListener(HARTHMERE_FACIAL_EXPRESSION_EVENT, handler);
  const win = window as typeof window & { __harthmereSetPlayerFacialExpression?: (expression: string, options?: Record<string, unknown>) => unknown };
  win.__harthmereSetPlayerFacialExpression = (expression, options = {}) => dispatchHarthmereFacialExpressionEvent({ ...options, actorId: "player", expression, source: String(options.source ?? "script") });
  return () => window.removeEventListener(HARTHMERE_FACIAL_EXPRESSION_EVENT, handler);
}

function harthmereFindAnchor(
  root: THREE.Object3D,
  candidates: readonly string[],
): THREE.Object3D | undefined {
  for (const name of candidates) {
    const found = root.getObjectByName(name);
    if (found && found.visible !== false) {
      return found;
    }
  }
  return undefined;
}

function harthmereVariantHeadAnchor(
  root: THREE.Object3D,
  anchors: HarthmereCharacterAttachmentAnchors = HARTHMERE_DEFAULT_HUMAN_ANCHORS,
): THREE.Object3D | undefined {
  // Prefer neck/spine anchors for the custom voxel head. Some body variants have
  // a Head node, but we hide that built-in head before adding the Harthmere face;
  // attaching to an invisible Head parent would hide the custom face as well.
  return (
    harthmereFindAnchor(root, anchors.neck) ??
    harthmereFindAnchor(root, anchors.back)
  );
}

type HarthmereRuntimeClothingAnchor =
  | "head"
  | "neck"
  | "torso"
  | "pelvis"
  | "rightHand"
  | "leftHand"
  | "hip"
  | "back"
  | "root";

const HARTHMERE_PLAYER_CLOTHING_SLOT_ANCHORS: Record<
  HarthmereClothingSlot,
  HarthmereRuntimeClothingAnchor
> = {
  hair: "head",
  head: "head",
  face: "head",
  torso: "torso",
  legs: "pelvis",
  hands: "rightHand",
  feet: "pelvis",
  back: "back",
  belt: "hip",
  weapon: "rightHand",
  shield: "leftHand",
};

function harthmereFindAnchorByPatterns(
  root: THREE.Object3D,
  patterns: readonly RegExp[],
): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  root.traverse((child) => {
    if (found || child.visible === false) {
      return;
    }
    const name = child.name || "";
    if (patterns.some((pattern) => pattern.test(name))) {
      found = child;
    }
  });
  return found;
}

function harthmerePlayerClothingAnchor(
  root: THREE.Object3D,
  anchor: HarthmereRuntimeClothingAnchor,
): THREE.Object3D {
  const byKind: Record<HarthmereRuntimeClothingAnchor, readonly RegExp[]> = {
    head: [/^head$/i, /head/i],
    neck: [/neck/i, /spine.*2/i, /chest/i],
    torso: [/spine.*2/i, /spine/i, /chest/i, /torso/i],
    pelvis: [/pelvis/i, /hips?/i],
    rightHand: [/righthand/i, /right_hand/i, /hand_r/i, /right.*hand/i],
    leftHand: [/lefthand/i, /left_hand/i, /hand_l/i, /left.*hand/i],
    hip: [/pelvis/i, /hips?/i],
    back: [/spine.*2/i, /spine/i, /chest/i, /torso/i],
    root: [],
  };
  return harthmereFindAnchorByPatterns(root, byKind[anchor]) ?? root;
}

function harthmerePlayerClothingPalette(appearance: HarthmereCharacterAppearance) {
  const bodyColor = {
    earth: 0x7a5c42,
    forest: 0x446948,
    river: 0x446685,
    ember: 0x7a4336,
    royal: 0x5b4d8c,
    ash: 0x5d6065,
  }[appearance.body.outfitColor];
  return {
    cloth: bodyColor,
    trim: harthmereVoxelColorLighten(bodyColor, 0.28),
    dark: harthmereVoxelColorDarken(bodyColor, 0.34),
    leather: 0x5b3a24,
    metal: 0x9ca3af,
    accent: appearance.role === "guard" ? 0xb8b2a4 : harthmereVoxelColorLighten(bodyColor, 0.42),
  };
}

function addHarthmerePlayerClothingBox(
  group: THREE.Group,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  color: number,
  rotation?: [number, number, number],
) {
  const mesh = localDevBoltHeadBox(name, size, position, color);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (rotation) {
    mesh.rotation.set(...rotation);
  }
  mesh.userData.harthmereModularClothingRuntime =
    HARTHMERE_PLAYER_MODULAR_CLOTHING_RUNTIME_VERSION;
  group.add(mesh);
  return mesh;
}

type HarthmerePlayerClothingRenderMode = "auto" | "gltf" | "threejs";

type HarthmerePlayerClothingFitMetrics = {
  torsoWidth: number;
  torsoHeight: number;
  shoulderWidth: number;
  armLength: number;
  legLength: number;
  torsoY: number;
  shoulderY: number;
  hipY: number;
  legSpread: number;
  stanceOffset: number;
  stanceArmX: number;
  headWidth: number;
  headDepth: number;
};

function harthmerePlayerClothingRenderMode(item: HarthmereClothingItem): HarthmerePlayerClothingRenderMode {
  const explicit = item.renderMode as HarthmerePlayerClothingRenderMode | undefined;
  if (explicit === "gltf" || explicit === "threejs" || explicit === "auto") {
    return explicit;
  }
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(HARTHMERE_PLAYER_CLOTHING_RENDER_MODE_STORAGE_KEY);
    if (stored === "gltf" || stored === "threejs" || stored === "auto") {
      return stored;
    }
  }
  return "auto";
}

function harthmerePlayerClothingFitMetrics(
  appearance: HarthmereCharacterAppearance,
): HarthmerePlayerClothingFitMetrics {
  const body = appearance.body;
  const torsoWidth =
    body.bodyType === "slim"
      ? 0.34
      : body.bodyType === "broad"
      ? 0.5
      : body.bodyType === "stocky"
      ? 0.54
      : body.bodyType === "athletic"
      ? 0.46
      : body.bodyType === "soft"
      ? 0.48
      : 0.42;
  const torsoHeight =
    body.bodyType === "stocky"
      ? 0.54
      : body.bodyType === "athletic"
      ? 0.62
      : body.bodyType === "soft"
      ? 0.56
      : 0.58;
  const shoulderWidth =
    body.shoulderWidth === "wide"
      ? torsoWidth + 0.26
      : body.shoulderWidth === "narrow"
      ? torsoWidth + 0.04
      : torsoWidth + 0.14;
  const legLength = body.legLength === "long" ? 0.64 : body.legLength === "short" ? 0.4 : 0.52;
  const armLength = body.armLength === "long" ? 0.7 : body.armLength === "short" ? 0.46 : 0.58;
  const stanceOffset = body.stance === "heroic" ? 0.05 : body.stance === "reserved" ? -0.03 : 0;
  const stanceArmX = body.stance === "heroic" ? 0.035 : body.stance === "reserved" ? -0.02 : 0;
  const legSpread = body.stance === "heroic" ? 0.07 : body.stance === "reserved" ? 0.02 : 0.045;
  const heightNudge =
    body.bodyHeight === "short"
      ? -0.03
      : body.bodyHeight === "tall"
      ? 0.035
      : body.bodyHeight === "very_tall"
      ? 0.07
      : 0;
  return {
    torsoWidth,
    torsoHeight: torsoHeight + heightNudge * 0.5,
    shoulderWidth,
    armLength,
    legLength: legLength + heightNudge,
    torsoY: legLength + torsoHeight / 2 + stanceOffset + heightNudge * 0.5,
    shoulderY: legLength + torsoHeight * 0.74 + stanceOffset + heightNudge * 0.5,
    hipY: legLength + 0.08 + stanceOffset,
    legSpread,
    stanceOffset,
    stanceArmX,
    headWidth: 0.46,
    headDepth: 0.34,
  };
}

function harthmerePlayerClothingTargetSize(
  slot: HarthmereClothingSlot,
  item: HarthmereClothingItem,
  metrics: HarthmerePlayerClothingFitMetrics,
): THREE.Vector3 | undefined {
  const fitScale = item.fitScale ?? 1;
  if (item.fitMode === "none") {
    return undefined;
  }
  if (slot === "torso") {
    const robe = /robe|shroud/i.test(item.id);
    return new THREE.Vector3(
      (metrics.torsoWidth + 0.16) * fitScale,
      (metrics.torsoHeight + (robe ? metrics.legLength * 0.55 : 0.1)) * fitScale,
      0.36 * fitScale,
    );
  }
  if (slot === "legs") {
    return new THREE.Vector3(
      (metrics.torsoWidth + 0.18) * fitScale,
      Math.max(0.34, metrics.legLength * 0.95) * fitScale,
      0.26 * fitScale,
    );
  }
  if (slot === "feet") {
    return new THREE.Vector3(
      (metrics.torsoWidth + 0.18) * fitScale,
      0.14 * fitScale,
      0.26 * fitScale,
    );
  }
  if (slot === "hands") {
    return new THREE.Vector3(
      (metrics.shoulderWidth + 0.2) * fitScale,
      Math.max(0.14, metrics.armLength * 0.34) * fitScale,
      0.18 * fitScale,
    );
  }
  if (slot === "belt") {
    return new THREE.Vector3((metrics.torsoWidth + 0.18) * fitScale, 0.08 * fitScale, 0.36 * fitScale);
  }
  if (slot === "head" || slot === "hair") {
    return new THREE.Vector3((metrics.headWidth + 0.14) * fitScale, 0.24 * fitScale, (metrics.headDepth + 0.1) * fitScale);
  }
  if (slot === "face") {
    return new THREE.Vector3(0.32 * fitScale, 0.16 * fitScale, 0.08 * fitScale);
  }
  if (slot === "back") {
    return new THREE.Vector3(0.32 * fitScale, 0.48 * fitScale, 0.18 * fitScale);
  }
  if (slot === "weapon") {
    return new THREE.Vector3(0.08 * fitScale, 0.74 * fitScale, 0.08 * fitScale);
  }
  if (slot === "shield") {
    return new THREE.Vector3(0.28 * fitScale, 0.38 * fitScale, 0.08 * fitScale);
  }
  return undefined;
}

function fitHarthmerePlayerClothingObjectToBody(
  object: THREE.Object3D,
  item: HarthmereClothingItem,
  metrics: HarthmerePlayerClothingFitMetrics,
): void {
  const target = harthmerePlayerClothingTargetSize(item.slot, item, metrics);
  if (!target) {
    return;
  }
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const current = new THREE.Vector3();
  box.getSize(current);
  if (current.x <= 0 || current.y <= 0 || current.z <= 0) {
    return;
  }
  // Use uniform scale for GLB clothing so authored proportions stay intact.
  // The smallest required axis wins, which prevents wide/stocky bodies from
  // clipping while avoiding comically stretched helmets or weapons.
  const scale = Math.min(
    target.x / current.x,
    target.y / current.y,
    target.z / current.z,
  );
  const safeScale = Math.max(0.05, Math.min(20, scale));
  object.scale.multiplyScalar(safeScale);
  object.userData.harthmereClothingBodyFitVersion = "harthmere-clothing-body-fit-v16-polished-threejs-catalog";
  object.userData.harthmereClothingBodyFitTarget = target.toArray();
}

function addHarthmerePlayerProceduralClothingProxy(
  group: THREE.Group,
  slot: HarthmereClothingSlot,
  item: HarthmereClothingItem,
  appearance: HarthmereCharacterAppearance,
  metrics: HarthmerePlayerClothingFitMetrics,
  anchorKind: HarthmereRuntimeClothingAnchor,
) {
  const palette = harthmerePlayerClothingPalette(appearance);
  const name = `harthmere-player-clothing-${slot}-${item.id}`;
  const variant = item.threeJsVariant ?? item.id;
  group.userData.harthmereThreeJsClothingRenderer =
    "harthmere-threejs-clothing-v16-polished-catalog-body-fit";
  group.userData.harthmereClothingBodyFitMetrics = metrics;
  group.userData.harthmereThreeJsClothingVariant = variant;
  group.userData.harthmereClothingAnchorKind = anchorKind;

  const addTrimPair = (
    prefix: string,
    y: number,
    frontZ: number,
    width = metrics.torsoWidth + 0.18,
  ) => {
    addHarthmerePlayerClothingBox(group, `${name}-${prefix}-front`, [width, 0.035, 0.045], [0, y, frontZ], palette.trim);
    addHarthmerePlayerClothingBox(group, `${name}-${prefix}-back`, [width * 0.94, 0.03, 0.04], [0, y, 0.14], palette.dark);
  };

  if (slot === "head" || slot === "hair") {
    if (/helmet|guard_helmet/i.test(variant)) {
      addHarthmerePlayerClothingBox(group, `${name}-helmet-bowl`, [metrics.headWidth + 0.14, 0.13, metrics.headDepth + 0.14], [0, 0.08, 0], palette.metal);
      addHarthmerePlayerClothingBox(group, `${name}-helmet-brow`, [metrics.headWidth + 0.2, 0.04, 0.075], [0, 0.015, -metrics.headDepth / 2 - 0.055], palette.dark);
      addHarthmerePlayerClothingBox(group, `${name}-helmet-left-cheek`, [0.04, 0.18, 0.07], [-(metrics.headWidth / 2 + 0.055), -0.035, -metrics.headDepth / 2 + 0.02], palette.metal);
      addHarthmerePlayerClothingBox(group, `${name}-helmet-right-cheek`, [0.04, 0.18, 0.07], [metrics.headWidth / 2 + 0.055, -0.035, -metrics.headDepth / 2 + 0.02], palette.metal);
      addHarthmerePlayerClothingBox(group, `${name}-crest`, [0.07, 0.22, 0.08], [0, 0.25, 0], palette.accent);
    } else if (/hood/i.test(variant)) {
      addHarthmerePlayerClothingBox(group, `${name}-hood-cap`, [metrics.headWidth + 0.18, 0.18, metrics.headDepth + 0.18], [0, 0.07, 0.02], palette.dark);
      addHarthmerePlayerClothingBox(group, `${name}-hood-brow-shadow`, [metrics.headWidth + 0.12, 0.05, 0.05], [0, 0.005, -metrics.headDepth / 2 - 0.06], palette.trim);
      addHarthmerePlayerClothingBox(group, `${name}-hood-drape`, [metrics.headWidth + 0.12, 0.22, 0.05], [0, -0.13, 0.12], palette.dark);
    } else if (/hat|cap|wide_brim|soft_cap/i.test(variant)) {
      const brimDepth = /wide_brim|straw/i.test(variant) ? metrics.headDepth + 0.28 : metrics.headDepth + 0.14;
      addHarthmerePlayerClothingBox(group, `${name}-brim`, [metrics.headWidth + 0.28, 0.04, brimDepth], [0, 0.035, -0.01], palette.trim);
      addHarthmerePlayerClothingBox(group, `${name}-crown`, [metrics.headWidth * 0.62, 0.14, metrics.headDepth * 0.7], [0, 0.145, 0], palette.cloth);
      addHarthmerePlayerClothingBox(group, `${name}-hat-band`, [metrics.headWidth * 0.7, 0.035, metrics.headDepth * 0.76], [0, 0.09, -0.005], palette.dark);
    }
    return;
  }

  if (slot === "face" && /mask/i.test(variant)) {
    addHarthmerePlayerClothingBox(group, `${name}-mask-main`, [metrics.headWidth * 0.58, 0.075, 0.04], [0, -0.02, -metrics.headDepth / 2 - 0.04], palette.dark);
    addHarthmerePlayerClothingBox(group, `${name}-mask-left-tie`, [0.08, 0.035, 0.035], [-(metrics.headWidth * 0.36), -0.015, -metrics.headDepth / 2 - 0.025], palette.trim);
    addHarthmerePlayerClothingBox(group, `${name}-mask-right-tie`, [0.08, 0.035, 0.035], [metrics.headWidth * 0.36, -0.015, -metrics.headDepth / 2 - 0.025], palette.trim);
    return;
  }

  if (slot === "torso") {
    const robe = /robe|shroud|robe_skirt|long_robe/i.test(variant);
    const armor = /armor|guard|scale_vest/i.test(variant);
    const apron = /apron/i.test(variant);
    const merchant = /merchant|noble|doublet/i.test(variant);
    const hunter = /hunter|jerkin/i.test(variant);
    const torn = /torn|scrap|patched/i.test(variant);
    const torsoHeight = metrics.torsoHeight + (robe ? metrics.legLength * 0.58 : 0.08);
    const torsoY = metrics.torsoY - (robe ? metrics.legLength * 0.23 : 0);
    const chestColor = armor ? palette.metal : hunter ? palette.leather : palette.cloth;
    addHarthmerePlayerClothingBox(group, `${name}-front-panel`, [metrics.torsoWidth + 0.14, torsoHeight, 0.065], [0, torsoY, -0.175], chestColor);
    addHarthmerePlayerClothingBox(group, `${name}-back-panel`, [metrics.torsoWidth + 0.12, torsoHeight * 0.93, 0.055], [0, torsoY, 0.15], palette.dark);
    addHarthmerePlayerClothingBox(group, `${name}-left-side-panel`, [0.06, torsoHeight * 0.92, 0.31], [-(metrics.torsoWidth / 2 + 0.06), torsoY, -0.01], chestColor);
    addHarthmerePlayerClothingBox(group, `${name}-right-side-panel`, [0.06, torsoHeight * 0.92, 0.31], [metrics.torsoWidth / 2 + 0.06, torsoY, -0.01], chestColor);
    addTrimPair("collar", metrics.torsoY + metrics.torsoHeight * 0.5, -0.205);
    addTrimPair("hem", torsoY - torsoHeight * 0.5, -0.2, metrics.torsoWidth + 0.2);

    if (armor) {
      addHarthmerePlayerClothingBox(group, `${name}-left-pauldron`, [0.18, 0.08, 0.24], [-(metrics.shoulderWidth / 2 + 0.02), metrics.shoulderY + 0.02, -0.035], palette.metal);
      addHarthmerePlayerClothingBox(group, `${name}-right-pauldron`, [0.18, 0.08, 0.24], [metrics.shoulderWidth / 2 + 0.02, metrics.shoulderY + 0.02, -0.035], palette.metal);
      addHarthmerePlayerClothingBox(group, `${name}-tabard-stripe`, [0.12, torsoHeight * 0.92, 0.075], [0, torsoY, -0.235], palette.accent);
      addHarthmerePlayerClothingBox(group, `${name}-chest-emblem`, [0.16, 0.13, 0.08], [0, metrics.torsoY + metrics.torsoHeight * 0.18, -0.27], palette.trim);
      if (/scale_vest/i.test(variant)) {
        for (let row = 0; row < 3; row += 1) {
          addHarthmerePlayerClothingBox(group, `${name}-scale-row-${row}`, [metrics.torsoWidth + 0.05 - row * 0.03, 0.035, 0.08], [0, metrics.torsoY + 0.15 - row * 0.12, -0.255], palette.dark);
        }
      }
    }
    if (hunter) {
      addHarthmerePlayerClothingBox(group, `${name}-diagonal-strap`, [0.07, torsoHeight * 1.04, 0.075], [-0.08, torsoY, -0.235], palette.leather, [0, 0, -0.32]);
      addHarthmerePlayerClothingBox(group, `${name}-fur-collar`, [metrics.torsoWidth + 0.16, 0.08, 0.34], [0, metrics.torsoY + metrics.torsoHeight * 0.5, -0.02], palette.trim);
    }
    if (robe || /mage/i.test(variant)) {
      addHarthmerePlayerClothingBox(group, `${name}-robe-sash`, [0.075, torsoHeight * 1.04, 0.08], [-0.13, torsoY, -0.235], palette.accent, [0, 0, -0.16]);
      addHarthmerePlayerClothingBox(group, `${name}-robe-center-fold`, [0.045, torsoHeight * 0.95, 0.075], [0.08, torsoY - 0.02, -0.24], palette.trim);
    }
    if (apron) {
      addHarthmerePlayerClothingBox(group, `${name}-apron`, [metrics.torsoWidth * 0.76, torsoHeight * 0.86, 0.075], [0, torsoY - 0.02, -0.245], palette.leather);
      addHarthmerePlayerClothingBox(group, `${name}-apron-pocket`, [0.16, 0.1, 0.08], [0.12, metrics.hipY + 0.08, -0.295], palette.dark);
    }
    if (merchant) {
      addHarthmerePlayerClothingBox(group, `${name}-left-lapel`, [0.08, torsoHeight * 0.68, 0.075], [-0.13, torsoY + 0.04, -0.245], palette.trim, [0, 0, -0.08]);
      addHarthmerePlayerClothingBox(group, `${name}-right-lapel`, [0.08, torsoHeight * 0.68, 0.075], [0.13, torsoY + 0.04, -0.245], palette.trim, [0, 0, 0.08]);
      addHarthmerePlayerClothingBox(group, `${name}-coat-button-top`, [0.045, 0.045, 0.08], [0, metrics.torsoY + 0.14, -0.285], palette.metal);
      addHarthmerePlayerClothingBox(group, `${name}-coat-button-bottom`, [0.045, 0.045, 0.08], [0, metrics.torsoY - 0.04, -0.285], palette.metal);
    }
    if (torn) {
      addHarthmerePlayerClothingBox(group, `${name}-torn-left-patch`, [0.14, 0.12, 0.08], [-(metrics.torsoWidth * 0.24), metrics.torsoY - 0.03, -0.275], palette.trim, [0, 0, -0.12]);
      addHarthmerePlayerClothingBox(group, `${name}-torn-right-patch`, [0.12, 0.11, 0.08], [metrics.torsoWidth * 0.26, metrics.torsoY + 0.11, -0.275], palette.dark, [0, 0, 0.16]);
    }
    return;
  }

  if (slot === "legs") {
    const leftX = -(metrics.torsoWidth / 4 + metrics.legSpread);
    const rightX = metrics.torsoWidth / 4 + metrics.legSpread;
    const legY = metrics.legLength * 0.52;
    const armored = /guard|greaves/i.test(variant);
    const patched = /patched|torn/i.test(variant);
    const robe = /robe|skirt/i.test(variant);
    if (robe) {
      addHarthmerePlayerClothingBox(group, `${name}-robe-skirt-front`, [metrics.torsoWidth + 0.12, metrics.legLength * 0.86, 0.06], [0, legY, -0.15], palette.cloth);
      addHarthmerePlayerClothingBox(group, `${name}-robe-skirt-back`, [metrics.torsoWidth + 0.08, metrics.legLength * 0.82, 0.05], [0, legY, 0.12], palette.dark);
      addHarthmerePlayerClothingBox(group, `${name}-robe-split`, [0.035, metrics.legLength * 0.72, 0.075], [0, legY - 0.05, -0.205], palette.trim);
      return;
    }
    addHarthmerePlayerClothingBox(group, `${name}-left-trouser-front`, [0.18, metrics.legLength * 0.9, 0.07], [leftX, legY, -0.13], armored ? palette.metal : palette.dark);
    addHarthmerePlayerClothingBox(group, `${name}-right-trouser-front`, [0.18, metrics.legLength * 0.9, 0.07], [rightX, legY, -0.13], armored ? palette.metal : palette.dark);
    addHarthmerePlayerClothingBox(group, `${name}-left-trouser-back`, [0.16, metrics.legLength * 0.85, 0.05], [leftX, legY, 0.11], palette.cloth);
    addHarthmerePlayerClothingBox(group, `${name}-right-trouser-back`, [0.16, metrics.legLength * 0.85, 0.05], [rightX, legY, 0.11], palette.cloth);
    addHarthmerePlayerClothingBox(group, `${name}-left-knee-detail`, [0.19, 0.055, 0.08], [leftX, legY + metrics.legLength * 0.08, -0.18], armored ? palette.dark : palette.trim);
    addHarthmerePlayerClothingBox(group, `${name}-right-knee-detail`, [0.19, 0.055, 0.08], [rightX, legY + metrics.legLength * 0.08, -0.18], armored ? palette.dark : palette.trim);
    if (patched) {
      addHarthmerePlayerClothingBox(group, `${name}-left-patch`, [0.11, 0.1, 0.075], [leftX - 0.02, legY - 0.12, -0.19], palette.trim);
      addHarthmerePlayerClothingBox(group, `${name}-right-patch`, [0.12, 0.09, 0.075], [rightX + 0.02, legY + 0.07, -0.19], palette.leather);
    }
    return;
  }

  if (slot === "feet") {
    const leftX = -(metrics.torsoWidth / 4 + metrics.legSpread);
    const rightX = metrics.torsoWidth / 4 + metrics.legSpread;
    const heavy = /guard|mud|boot/i.test(variant);
    const soleColor = heavy ? 0x111111 : palette.dark;
    addHarthmerePlayerClothingBox(group, `${name}-left-boot`, [heavy ? 0.21 : 0.18, 0.12, heavy ? 0.2 : 0.17], [leftX, 0.08, -0.035], soleColor);
    addHarthmerePlayerClothingBox(group, `${name}-right-boot`, [heavy ? 0.21 : 0.18, 0.12, heavy ? 0.2 : 0.17], [rightX, 0.08, -0.035], soleColor);
    addHarthmerePlayerClothingBox(group, `${name}-left-toe`, [heavy ? 0.22 : 0.18, 0.05, 0.08], [leftX, 0.055, -0.16], palette.leather);
    addHarthmerePlayerClothingBox(group, `${name}-right-toe`, [heavy ? 0.22 : 0.18, 0.05, 0.08], [rightX, 0.055, -0.16], palette.leather);
    addHarthmerePlayerClothingBox(group, `${name}-left-cuff`, [heavy ? 0.22 : 0.18, 0.055, 0.18], [leftX, 0.18, -0.02], palette.trim);
    addHarthmerePlayerClothingBox(group, `${name}-right-cuff`, [heavy ? 0.22 : 0.18, 0.055, 0.18], [rightX, 0.18, -0.02], palette.trim);
    return;
  }

  if (slot === "hands") {
    const rightX = metrics.shoulderWidth / 2 + 0.06 + metrics.stanceArmX;
    const leftX = -rightX;
    const y = metrics.shoulderY - metrics.armLength * 0.45;
    addHarthmerePlayerClothingBox(group, `${name}-right-glove`, [0.13, 0.14, 0.13], [rightX, y, -0.04], palette.leather);
    addHarthmerePlayerClothingBox(group, `${name}-left-glove`, [0.13, 0.14, 0.13], [leftX, y, -0.04], palette.leather);
    addHarthmerePlayerClothingBox(group, `${name}-right-cuff`, [0.15, 0.045, 0.14], [rightX, y + 0.09, -0.035], palette.trim);
    addHarthmerePlayerClothingBox(group, `${name}-left-cuff`, [0.15, 0.045, 0.14], [leftX, y + 0.09, -0.035], palette.trim);
    if (/guard|braced/i.test(variant)) {
      addHarthmerePlayerClothingBox(group, `${name}-right-bracer`, [0.16, 0.08, 0.15], [rightX, y + 0.16, -0.035], palette.metal);
      addHarthmerePlayerClothingBox(group, `${name}-left-bracer`, [0.16, 0.08, 0.15], [leftX, y + 0.16, -0.035], palette.metal);
    }
    return;
  }

  if (slot === "belt") {
    addHarthmerePlayerClothingBox(group, `${name}-belt-front`, [metrics.torsoWidth + 0.2, 0.06, 0.075], [0, metrics.hipY, -0.18], palette.leather);
    addHarthmerePlayerClothingBox(group, `${name}-belt-back`, [metrics.torsoWidth + 0.16, 0.05, 0.065], [0, metrics.hipY, 0.15], palette.leather);
    addHarthmerePlayerClothingBox(group, `${name}-buckle`, [0.095, 0.075, 0.04], [0, metrics.hipY, -0.235], palette.metal);
    if (/knife/i.test(variant)) {
      const knife = addHarthmerePlayerClothingBox(group, `${name}-belt-knife`, [0.045, 0.3, 0.055], [metrics.torsoWidth / 2 + 0.08, metrics.hipY - 0.04, -0.04], palette.metal, [0, 0, -0.28]);
      knife.userData.harthmereRigidWeaponProxy = item.id;
    }
    if (/ledger/i.test(variant)) {
      addHarthmerePlayerClothingBox(group, `${name}-ledger`, [0.15, 0.13, 0.045], [-(metrics.torsoWidth / 2 + 0.06), metrics.hipY - 0.03, -0.09], palette.trim);
    }
    if (/tool|rope/i.test(variant)) {
      addHarthmerePlayerClothingBox(group, `${name}-side-pouch`, [0.13, 0.12, 0.06], [metrics.torsoWidth / 2 + 0.08, metrics.hipY - 0.04, -0.1], palette.dark);
      addHarthmerePlayerClothingBox(group, `${name}-hanging-loop`, [0.045, 0.2, 0.045], [-(metrics.torsoWidth / 2 + 0.07), metrics.hipY - 0.08, -0.06], palette.leather);
    }
    return;
  }

  if (slot === "back") {
    if (/quiver|bedroll/i.test(variant)) {
      addHarthmerePlayerClothingBox(group, `${name}-quiver`, [0.16, 0.45, 0.12], [0.14, 0, 0.1], palette.leather, [0, 0, -0.18]);
      addHarthmerePlayerClothingBox(group, `${name}-bedroll`, [0.32, 0.14, 0.14], [-0.04, -0.26, 0.13], palette.trim, [0, 0, 0.08]);
      addHarthmerePlayerClothingBox(group, `${name}-strap`, [0.06, 0.62, 0.05], [-0.1, 0, 0.04], palette.dark, [0, 0, 0.28]);
      addHarthmerePlayerClothingBox(group, `${name}-fletching`, [0.22, 0.06, 0.09], [0.12, 0.25, 0.12], palette.trim);
    } else if (/cape|shroud/i.test(variant)) {
      const ragged = /ragged|shroud/i.test(variant);
      addHarthmerePlayerClothingBox(group, `${name}-cape`, [metrics.torsoWidth + 0.18, metrics.torsoHeight + metrics.legLength * 0.58, 0.055], [0, -0.1, 0.15], ragged ? palette.dark : palette.cloth);
      addHarthmerePlayerClothingBox(group, `${name}-cape-left-notch`, [0.12, 0.16, 0.06], [-(metrics.torsoWidth * 0.28), -0.55, 0.16], ragged ? 0x1f1f1f : palette.dark, [0, 0, -0.12]);
      addHarthmerePlayerClothingBox(group, `${name}-cape-clasp`, [0.19, 0.07, 0.065], [0, 0.32, 0.1], palette.metal);
    } else if (/satchel/i.test(variant)) {
      addHarthmerePlayerClothingBox(group, `${name}-satchel`, [0.28, 0.24, 0.12], [0.18, -0.1, 0.14], palette.leather);
      addHarthmerePlayerClothingBox(group, `${name}-satchel-flap`, [0.29, 0.07, 0.13], [0.18, 0.03, 0.12], palette.trim);
      addHarthmerePlayerClothingBox(group, `${name}-satchel-strap`, [0.055, 0.58, 0.05], [-0.05, 0.05, 0.04], palette.dark, [0, 0, -0.34]);
    } else {
      addHarthmerePlayerClothingBox(group, `${name}-pack`, [0.32, 0.42, 0.16], [0, 0, 0.12], palette.leather);
      addHarthmerePlayerClothingBox(group, `${name}-pack-flap`, [0.34, 0.08, 0.17], [0, 0.12, 0.1], palette.trim);
    }
    return;
  }

  if (slot === "weapon") {
    const short = /dagger/i.test(variant);
    const bow = /bow/i.test(variant);
    if (bow) {
      const upper = addHarthmerePlayerClothingBox(group, `${name}-bow-upper`, [0.045, 0.42, 0.045], [0.02, 0.03, -0.02], palette.leather, [0, 0, 0.22]);
      upper.userData.harthmereRigidWeaponProxy = item.id;
      addHarthmerePlayerClothingBox(group, `${name}-bow-lower`, [0.045, 0.42, 0.045], [0.02, -0.28, -0.02], palette.leather, [0, 0, -0.22]);
      addHarthmerePlayerClothingBox(group, `${name}-bow-string`, [0.02, 0.64, 0.02], [0.08, -0.12, -0.02], palette.trim);
    } else {
      const weapon = addHarthmerePlayerClothingBox(group, `${name}-blade`, [short ? 0.05 : 0.055, short ? 0.34 : 0.68, 0.055], [0.02, short ? -0.08 : -0.22, -0.02], palette.metal, [0, 0, -0.18]);
      weapon.userData.harthmereRigidWeaponProxy = item.id;
      addHarthmerePlayerClothingBox(group, `${name}-hilt`, [0.14, 0.045, 0.055], [0.02, short ? -0.26 : -0.56, -0.02], palette.trim, [0, 0, -0.18]);
    }
    return;
  }

  if (slot === "shield") {
    addHarthmerePlayerClothingBox(group, `${name}-shield`, [0.3, 0.4, 0.08], [-0.02, -0.04, -0.1], palette.metal);
    addHarthmerePlayerClothingBox(group, `${name}-shield-rim-top`, [0.24, 0.045, 0.09], [-0.02, 0.18, -0.14], palette.dark);
    addHarthmerePlayerClothingBox(group, `${name}-shield-rim-bottom`, [0.24, 0.045, 0.09], [-0.02, -0.26, -0.14], palette.dark);
    addHarthmerePlayerClothingBox(group, `${name}-shield-boss`, [0.105, 0.105, 0.09], [-0.02, -0.04, -0.16], palette.accent);
    return;
  }

  group.userData.harthmereUnhandledThreeJsClothingSlot = { slot, item, anchorKind };
}

function harthmereFindFirstSkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh | undefined {
  let found: THREE.SkinnedMesh | undefined;
  root.traverse((child) => {
    if (!found && child instanceof THREE.SkinnedMesh) {
      found = child;
    }
  });
  return found;
}

function bindHarthmereSkinnedClothingToBodySkeleton(
  bodyRoot: THREE.Object3D,
  clothingRoot: THREE.Object3D,
) {
  const bodySkinnedMesh = harthmereFindFirstSkinnedMesh(bodyRoot);
  if (!bodySkinnedMesh) {
    return false;
  }
  let boundAny = false;
  clothingRoot.traverse((child) => {
    if (!(child instanceof THREE.SkinnedMesh)) {
      return;
    }
    // Production GLB clothing must be exported against the same skeleton/bind
    // pose. Rebinding to the live body skeleton makes the garment follow walk,
    // run, attack, and ride animations from the player's AnimationMixer.
    child.bind(bodySkinnedMesh.skeleton, bodySkinnedMesh.bindMatrix);
    child.frustumCulled = false;
    child.userData.harthmereSkinnedClothingBoundToBodySkeleton = true;
    boundAny = true;
  });
  return boundAny;
}

async function loadHarthmerePlayerClothingModel(
  item: HarthmereClothingItem,
): Promise<THREE.Object3D | undefined> {
  if (!item.modelUrl) {
    return undefined;
  }
  try {
    const gltf = await loadGltf(item.modelUrl);
    const object = SkeletonUtils.clone(gltfToThree(gltf));
    object.name = `harthmere-player-clothing-model-${item.slot}-${item.id}`;
    object.userData.harthmereClothingItem = item;
    object.userData.harthmereModularClothingRuntime =
      HARTHMERE_PLAYER_MODULAR_CLOTHING_RUNTIME_VERSION;
    return object;
  } catch (error) {
    log.warn("Failed to load Harthmere modular clothing GLB; using procedural proxy", {
      itemId: item.id,
      slot: item.slot,
      modelUrl: item.modelUrl,
      error,
    });
    return undefined;
  }
}

async function addHarthmerePlayerModularClothingRuntime(
  root: THREE.Object3D,
  appearance: HarthmereCharacterAppearance,
) {
  const clothing: HarthmereCharacterClothing = appearance.clothing;
  const metrics = harthmerePlayerClothingFitMetrics(appearance);
  const hiddenZones = new Set<string>();
  const attachedSlots: string[] = [];
  const fittedSlots: string[] = [];
  const gltfSlots: string[] = [];
  const threeJsSlots: string[] = [];
  for (const slot of Object.keys(clothing) as HarthmereClothingSlot[]) {
    const item = clothing[slot];
    if (!item) {
      continue;
    }
    for (const zone of item.hidesBodyZones ?? []) {
      hiddenZones.add(zone);
    }
    const renderMode = harthmerePlayerClothingRenderMode(item);
    const bodyFittedThreeJs = renderMode === "threejs" && item.fitMode !== "anchor" && item.fitMode !== "none";
    const anchorKind = bodyFittedThreeJs
      ? "root"
      : (item.attachBone as HarthmereRuntimeClothingAnchor | undefined) ??
        HARTHMERE_PLAYER_CLOTHING_SLOT_ANCHORS[slot] ??
        "root";
    const anchor = harthmerePlayerClothingAnchor(root, anchorKind);
    const group = new THREE.Group();
    group.name = `harthmere-player-modular-clothing-${slot}`;
    group.userData.harthmereClothingItem = item;
    group.userData.harthmereClothingRenderMode = renderMode;
    group.userData.harthmereClothingAnchorKind = anchorKind;
    group.userData.harthmereModularClothingRuntime =
      HARTHMERE_PLAYER_MODULAR_CLOTHING_RUNTIME_VERSION;
    anchor.add(group);

    let clothingModel: THREE.Object3D | undefined;
    if (renderMode !== "threejs") {
      clothingModel = await loadHarthmerePlayerClothingModel(item);
    }

    if (clothingModel) {
      fitHarthmerePlayerClothingObjectToBody(clothingModel, item, metrics);
      const skinned = bindHarthmereSkinnedClothingToBodySkeleton(root, clothingModel);
      if (!skinned) {
        // Rigid GLB accessories still follow the selected bone/anchor even if
        // they are not skinned. This is correct for helmets, weapons, shields,
        // packs, belts, and other solid items.
        clothingModel.userData.harthmereRigidClothingAttachedToAnchor = anchorKind;
      }
      clothingModel.userData.harthmereClothingBodyCustomization = appearance.body;
      group.add(clothingModel);
      gltfSlots.push(slot);
    } else {
      addHarthmerePlayerProceduralClothingProxy(group, slot, item, appearance, metrics, anchorKind);
      threeJsSlots.push(slot);
    }
    attachedSlots.push(slot);
    if (item.fitMode === "body" || bodyFittedThreeJs) {
      fittedSlots.push(slot);
    }
  }
  root.userData.harthmereModularClothingRuntime =
    HARTHMERE_PLAYER_MODULAR_CLOTHING_RUNTIME_VERSION;
  root.userData.harthmereClothingSlots = attachedSlots;
  root.userData.harthmereBodyFittedClothingSlots = fittedSlots;
  root.userData.harthmereGltfClothingSlots = gltfSlots;
  root.userData.harthmereThreeJsClothingSlots = threeJsSlots;
  root.userData.harthmereClothingFitMetrics = metrics;
  root.userData.harthmereHiddenBodyZones = [...hiddenZones];
}

function addLocalDevPlayerVoxelFaceParts(
  group: THREE.Group,
  face: LocalDevPlayerVoxelFaceSpec,
) {
  const headWidth = face.headSize[0];
  const headHeight = face.headSize[1];
  const headDepth = face.headSize[2];
  const faceFrontZ = face.leftEyePosition[2];
  const anchoredYOffset = face.headPosition[1] - LOCAL_DEV_PLAYER_VOXEL_FACE.headPosition[1];
  const fy = (value: number) => value + anchoredYOffset;
  const headBottomY = face.headPosition[1] - headHeight / 2;
  const headTopY = face.headPosition[1] + headHeight / 2;

  const addBox = (
    name: string,
    size: [number, number, number],
    position: [number, number, number],
    color: number,
    rotationZ = 0,
  ) => {
    const box = localDevBoltHeadBox(name, size, position, color);
    if (rotationZ !== 0) {
      box.rotation.z = rotationZ;
    }
    rememberHarthmerePlayerFacePartNeutralTransform(box);
    group.add(box);
    return box;
  };
  const addHair = (name: string, size: [number, number, number], position: [number, number, number]) => {
    addBox(name, size, position, face.hair);
  };
  const hairHighlight = harthmereVoxelColorLighten(face.hair, 0.22);
  const hairShadow = harthmereVoxelColorDarken(face.hair, 0.22);
  const skinHighlight = harthmereVoxelColorLighten(face.skin, 0.12);
  const sideProfile = face.sideProfile ?? HARTHMERE_SYMMETRIC_PLAYER_FACE_SIDE_PROFILE;
  const leftSideColor = sideProfile.highlightSide === "left" ? skinHighlight : face.skinShadow;
  const rightSideColor = sideProfile.highlightSide === "right" ? skinHighlight : face.skinShadow;
  const sideHairAccent = harthmereVoxelColorLighten(face.hair, 0.1);

  group.add(
    localDevBoltHeadBox("local-dev-bolt-head", face.headSize, face.headPosition, face.skin),
    localDevBoltHeadBox(
      "local-dev-bolt-skin-shadow",
      [headWidth, 0.055, headDepth],
      [0, headBottomY + 0.03, -0.01],
      face.skinShadow,
    ),
  );
  // Voxel polish: add tiny planes/boxes that read as cheekbones, forehead light,
  // and jaw shadow from the normal gameplay camera. This keeps the art blocky
  // but avoids the flat sticker-face look.
  addBox("local-dev-bolt-forehead-light", [headWidth * 0.52, 0.03, 0.018], [0, face.leftBrowPosition[1] + 0.115, faceFrontZ - 0.014], skinHighlight);
  addBox("local-dev-bolt-jaw-shadow", [headWidth * 0.62, 0.035, 0.018], [0, headBottomY + 0.072, faceFrontZ - 0.014], face.skinShadow);

  // V11: side-specific head sculpting. This keeps the Bolt voxel style while
  // making each side of the head read differently from gameplay camera angles.
  addBox(
    "local-dev-bolt-left-side-plane-asym",
    [0.026 * sideProfile.leftWidthScale, headHeight * 0.54 * sideProfile.leftHeightScale, Math.max(0.08, headDepth * 0.72 + sideProfile.leftZOffset)],
    [-headWidth / 2 - 0.016, face.headPosition[1] + sideProfile.leftYOffset, -0.004 + sideProfile.leftZOffset],
    leftSideColor,
  );
  addBox(
    "local-dev-bolt-right-side-plane-asym",
    [0.026 * sideProfile.rightWidthScale, headHeight * 0.54 * sideProfile.rightHeightScale, Math.max(0.08, headDepth * 0.72 + sideProfile.rightZOffset)],
    [headWidth / 2 + 0.016, face.headPosition[1] + sideProfile.rightYOffset, -0.004 + sideProfile.rightZOffset],
    rightSideColor,
  );
  if (sideProfile.jawNotchSide === "left") {
    addBox("local-dev-bolt-left-jaw-notch-asym", [0.038, 0.07, 0.022], [-headWidth / 2 + 0.024, headBottomY + 0.105, faceFrontZ - 0.014], face.skinShadow, -0.14);
  } else if (sideProfile.jawNotchSide === "right") {
    addBox("local-dev-bolt-right-jaw-notch-asym", [0.038, 0.07, 0.022], [headWidth / 2 - 0.024, headBottomY + 0.105, faceFrontZ - 0.014], face.skinShadow, 0.14);
  }
  if (sideProfile.markSide === "left") {
    addBox("local-dev-bolt-left-face-mark-asym", [0.022, 0.022, 0.014], [-headWidth * 0.29, face.mouthPosition[1] + 0.065, faceFrontZ - 0.03], face.mouth);
  } else if (sideProfile.markSide === "right") {
    addBox("local-dev-bolt-right-face-mark-asym", [0.022, 0.022, 0.014], [headWidth * 0.29, face.mouthPosition[1] + 0.065, faceFrontZ - 0.03], face.mouth);
  }
  if (sideProfile.hairLockSide === "left") {
    addBox("local-dev-bolt-left-side-hair-lock-asym", [0.045, 0.18, 0.05], [-headWidth / 2 - 0.038, face.leftBrowPosition[1] - 0.025, faceFrontZ + 0.018], sideHairAccent, -0.08);
  } else if (sideProfile.hairLockSide === "right") {
    addBox("local-dev-bolt-right-side-hair-lock-asym", [0.045, 0.18, 0.05], [headWidth / 2 + 0.038, face.rightBrowPosition[1] - 0.025, faceFrontZ + 0.018], sideHairAccent, 0.08);
  }

  switch (face.hairStyle) {
    case "shaved":
      addHair("local-dev-bolt-shaved-top", [headWidth + 0.03, 0.03, headDepth + 0.03], [0, face.headPosition[1] + headHeight / 2 + 0.02, -0.01]);
      addHair("local-dev-bolt-shaved-front-line", [headWidth + 0.02, 0.022, 0.05], [0, face.leftBrowPosition[1] + 0.05, faceFrontZ - 0.025]);
      break;
    case "balding":
      addHair("local-dev-bolt-balding-back", [headWidth + 0.04, 0.07, headDepth + 0.04], [0, face.headPosition[1] + headHeight / 2 + 0.04, 0.06]);
      addHair("local-dev-bolt-balding-left", [0.075, 0.24, headDepth + 0.04], [-headWidth / 2 - 0.018, fy(1.61), -0.005]);
      addHair("local-dev-bolt-balding-right", [0.075, 0.24, headDepth + 0.04], [headWidth / 2 + 0.018, fy(1.61), -0.005]);
      break;
    case "side_part":
      addHair("local-dev-bolt-sidepart-top", [headWidth + 0.06, 0.12, headDepth + 0.05], [0, face.hairPosition[1], -0.01]);
      addHair("local-dev-bolt-sidepart-sweep", [headWidth * 0.76, 0.075, 0.075], [-headWidth * 0.12, face.leftBrowPosition[1] + 0.058, faceFrontZ - 0.03]);
      addBox("local-dev-bolt-sidepart-line", [0.024, 0.145, 0.08], [headWidth * 0.18, face.hairPosition[1] - 0.035, faceFrontZ - 0.025], 0x0f0c0a);
      break;
    case "short_crown":
      addHair("local-dev-bolt-crown-top", [headWidth + 0.07, 0.17, headDepth + 0.07], [0, face.hairPosition[1] + 0.035, -0.01]);
      addHair("local-dev-bolt-crown-front", [headWidth + 0.03, 0.08, 0.08], [0, face.leftBrowPosition[1] + 0.062, faceFrontZ - 0.03]);
      addHair("local-dev-bolt-crown-left-side", [0.05, 0.14, 0.08], [-headWidth / 2, fy(1.63), faceFrontZ - 0.02]);
      break;
    case "curly":
      addHair("local-dev-bolt-curly-top", [headWidth + 0.08, 0.14, headDepth + 0.07], [0, face.hairPosition[1] + 0.025, -0.01]);
      for (let i = 0; i < 6; i += 1) {
        addHair(`local-dev-bolt-curl-${i}`, [0.09, 0.095, 0.08], [-headWidth / 2 + 0.045 + i * (headWidth / 5), face.leftBrowPosition[1] + (i % 2 ? 0.04 : 0.075), faceFrontZ - 0.035]);
      }
      break;
    case "braids":
      addHair("local-dev-bolt-braids-top", [headWidth + 0.05, 0.11, headDepth + 0.045], [0, face.hairPosition[1], -0.01]);
      addHair("local-dev-bolt-left-braid", [0.075, 0.44, 0.09], [-headWidth / 2 - 0.05, fy(1.46), faceFrontZ + 0.02]);
      addHair("local-dev-bolt-right-braid", [0.075, 0.44, 0.09], [headWidth / 2 + 0.05, fy(1.46), faceFrontZ + 0.02]);
      addBox("local-dev-bolt-left-braid-tie", [0.09, 0.035, 0.09], [-headWidth / 2 - 0.05, fy(1.22), faceFrontZ + 0.02], 0xd6a632);
      addBox("local-dev-bolt-right-braid-tie", [0.09, 0.035, 0.09], [headWidth / 2 + 0.05, fy(1.22), faceFrontZ + 0.02], 0xd6a632);
      break;
    case "bob":
      addHair("local-dev-bolt-bob-top", [headWidth + 0.06, 0.12, headDepth + 0.06], [0, headTopY + 0.055, -0.01]);
      addHair("local-dev-bolt-bob-left", [0.105, 0.34, headDepth + 0.05], [-headWidth / 2 - 0.035, fy(1.5), -0.005]);
      addHair("local-dev-bolt-bob-right", [0.105, 0.34, headDepth + 0.05], [headWidth / 2 + 0.035, fy(1.5), -0.005]);
      addHair("local-dev-bolt-bob-bangs", [headWidth + 0.02, 0.07, 0.08], [0, face.leftBrowPosition[1] + 0.06, faceFrontZ - 0.035]);
      break;
    case "long":
      addHair("local-dev-bolt-long-top", [headWidth + 0.06, 0.12, headDepth + 0.06], [0, headTopY + 0.055, -0.01]);
      addHair("local-dev-bolt-long-back", [headWidth + 0.08, 0.62, 0.1], [0, fy(1.38), headDepth / 2 + 0.025]);
      addHair("local-dev-bolt-long-left", [0.105, 0.55, 0.095], [-headWidth / 2 - 0.045, fy(1.38), faceFrontZ + 0.035]);
      addHair("local-dev-bolt-long-right", [0.105, 0.55, 0.095], [headWidth / 2 + 0.045, fy(1.38), faceFrontZ + 0.035]);
      break;
    case "bun":
      addHair("local-dev-bolt-bun-top", [headWidth + 0.05, 0.095, headDepth + 0.05], [0, headTopY + 0.045, -0.01]);
      addHair("local-dev-bolt-bun-back", [0.24, 0.24, 0.16], [0, headTopY + 0.03, headDepth / 2 + 0.08]);
      addHair("local-dev-bolt-bun-front", [headWidth * 0.7, 0.045, 0.06], [-0.03, face.leftBrowPosition[1] + 0.055, faceFrontZ - 0.03]);
      break;
    case "pigtails":
      addHair("local-dev-bolt-pigtails-top", [headWidth + 0.05, 0.1, headDepth + 0.04], [0, headTopY + 0.05, -0.01]);
      addHair("local-dev-bolt-left-pigtail", [0.13, 0.35, 0.12], [-headWidth / 2 - 0.12, fy(1.42), -0.01]);
      addHair("local-dev-bolt-right-pigtail", [0.13, 0.35, 0.12], [headWidth / 2 + 0.12, fy(1.42), -0.01]);
      addBox("local-dev-bolt-left-pigtail-tie", [0.15, 0.035, 0.12], [-headWidth / 2 - 0.12, fy(1.58), -0.01], 0xd6a632);
      addBox("local-dev-bolt-right-pigtail-tie", [0.15, 0.035, 0.12], [headWidth / 2 + 0.12, fy(1.58), -0.01], 0xd6a632);
      break;
    case "wavy":
      addHair("local-dev-bolt-wavy-top", [headWidth + 0.08, 0.13, headDepth + 0.06], [0, headTopY + 0.055, -0.01]);
      addHair("local-dev-bolt-wavy-left", [0.095, 0.32, 0.09], [-headWidth / 2 - 0.035, fy(1.49), -0.02]);
      addHair("local-dev-bolt-wavy-right", [0.095, 0.32, 0.09], [headWidth / 2 + 0.035, fy(1.49), -0.02]);
      for (let i = 0; i < 4; i += 1) {
        addHair(`local-dev-bolt-wave-${i}`, [0.095, 0.065, 0.075], [-headWidth / 2 + 0.06 + i * (headWidth / 3), face.leftBrowPosition[1] + (i % 2 ? 0.035 : 0.065), faceFrontZ - 0.035]);
      }
      break;
    case "hood":
      addHair("local-dev-bolt-hood-back", [headWidth + 0.2, headHeight + 0.18, headDepth + 0.18], [0, fy(1.57), 0.04]);
      addHair("local-dev-bolt-hood-top", [headWidth + 0.16, 0.13, headDepth + 0.16], [0, face.hairPosition[1], -0.01]);
      addHair("local-dev-bolt-hood-rim", [headWidth + 0.12, 0.08, 0.08], [0, face.leftBrowPosition[1] + 0.055, faceFrontZ - 0.035]);
      break;
    case "cap":
      addHair("local-dev-bolt-cap", [headWidth + 0.12, 0.12, headDepth + 0.08], [0, face.hairPosition[1] + 0.01, -0.01]);
      addHair("local-dev-bolt-cap-brim-front", [headWidth + 0.22, 0.045, 0.13], [0, face.leftBrowPosition[1] + 0.055, faceFrontZ - 0.052]);
      break;
    case "flat":
    default:
      addHair("local-dev-bolt-hair", face.hairSize, face.hairPosition);
      addHair("local-dev-bolt-left-sideburn", face.leftSideburnSize, face.leftSideburnPosition);
      addHair("local-dev-bolt-right-sideburn", face.rightSideburnSize, face.rightSideburnPosition);
      addHair("local-dev-bolt-front-fringe", [headWidth + 0.02, 0.055, 0.065], [0, face.leftBrowPosition[1] + 0.055, faceFrontZ - 0.028]);
      break;
  }

  // Hair silhouette polish. These extra voxels act like highlights, shadow
  // breaks, and strands without leaving the authored voxel style.
  if (face.hairStyle !== "shaved" && face.hairStyle !== "balding") {
    addBox("local-dev-bolt-hair-front-highlight", [headWidth * 0.56, 0.028, 0.032], [-headWidth * 0.08, face.leftBrowPosition[1] + 0.077, faceFrontZ - 0.042], hairHighlight);
    addBox("local-dev-bolt-hair-back-shadow", [headWidth * 0.62, 0.036, 0.03], [headWidth * 0.04, headTopY + 0.025, headDepth / 2 - 0.02], hairShadow);
  }
  if (face.hairStyle === "curly" || face.hairStyle === "wavy") {
    addBox("local-dev-bolt-hair-extra-curl-left", [0.075, 0.07, 0.055], [-headWidth / 2 + 0.035, face.leftBrowPosition[1] + 0.02, faceFrontZ - 0.026], hairHighlight);
    addBox("local-dev-bolt-hair-extra-curl-right", [0.075, 0.07, 0.055], [headWidth / 2 - 0.035, face.leftBrowPosition[1] + 0.036, faceFrontZ - 0.026], hairShadow);
  }

  const leftEyeRotation = face.eyeShape === "sharp" ? 0.18 : 0;
  const rightEyeRotation = face.eyeShape === "sharp" ? -0.18 : 0;
  addBox("local-dev-bolt-left-eye", face.leftEyeSize, face.leftEyePosition, face.eye, leftEyeRotation);
  addBox("local-dev-bolt-right-eye", face.rightEyeSize, face.rightEyePosition, face.eye, rightEyeRotation);
  addBox("local-dev-bolt-left-eye-glint", [0.016, 0.014, 0.012], [face.leftEyePosition[0] - 0.012, face.leftEyePosition[1] + 0.012, face.leftEyePosition[2] - 0.018], 0xf5f1dc);
  addBox("local-dev-bolt-right-eye-glint", [0.016, 0.014, 0.012], [face.rightEyePosition[0] - 0.012, face.rightEyePosition[1] + 0.012, face.rightEyePosition[2] - 0.018], 0xf5f1dc);
  if (face.eyeShape === "sleepy") {
    addBox("local-dev-bolt-left-sleepy-lid", [face.leftEyeSize[0] + 0.018, 0.014, 0.014], [face.leftEyePosition[0], face.leftEyePosition[1] + 0.02, face.leftEyePosition[2] - 0.018], face.skinShadow);
    addBox("local-dev-bolt-right-sleepy-lid", [face.rightEyeSize[0] + 0.018, 0.014, 0.014], [face.rightEyePosition[0], face.rightEyePosition[1] + 0.02, face.rightEyePosition[2] - 0.018], face.skinShadow);
  }

  const leftBrowRotation =
    face.browStyle === "arched" ? 0.22 : face.browStyle === "stern" ? -0.2 : 0;
  const rightBrowRotation =
    face.browStyle === "arched" ? -0.22 : face.browStyle === "stern" ? 0.2 : 0;
  addBox("local-dev-bolt-left-brow", face.browSize, face.leftBrowPosition, face.hair, leftBrowRotation);
  addBox("local-dev-bolt-right-brow", face.browSize, face.rightBrowPosition, face.hair, rightBrowRotation);
  addBox("local-dev-bolt-left-brow-shadow", [face.browSize[0] * 0.88, 0.012, 0.012], [face.leftBrowPosition[0], face.leftBrowPosition[1] - 0.026, face.leftBrowPosition[2] - 0.012], hairShadow, leftBrowRotation);
  addBox("local-dev-bolt-right-brow-shadow", [face.browSize[0] * 0.88, 0.012, 0.012], [face.rightBrowPosition[0], face.rightBrowPosition[1] - 0.026, face.rightBrowPosition[2] - 0.012], hairShadow, rightBrowRotation);
  if (face.browStyle === "scarred") {
    addBox("local-dev-bolt-brow-scar-1", [0.024, 0.1, 0.016], [face.leftBrowPosition[0] + 0.05, face.leftBrowPosition[1] - 0.015, faceFrontZ - 0.02], 0xf1d0b8, -0.38);
  }

  addBox("local-dev-bolt-nose", face.noseSize, face.nosePosition, face.skinShadow);
  if (face.noseStyle === "button") {
    addBox("local-dev-bolt-button-nose-tip", [0.105, 0.032, 0.034], [0, face.nosePosition[1] - 0.045, face.nosePosition[2] - 0.025], face.skinShadow);
  } else if (face.noseStyle === "wide") {
    addBox("local-dev-bolt-wide-nose-bridge", [0.03, 0.045, 0.03], [0, face.nosePosition[1] + 0.04, face.nosePosition[2] - 0.02], face.skinShadow);
  }

  addBox("local-dev-bolt-mouth", face.mouthSize, face.mouthPosition, face.mouth);
  if (face.mouthStyle === "smile") {
    addBox("local-dev-bolt-smile-left", [0.045, 0.026, 0.024], [face.mouthPosition[0] - face.mouthSize[0] / 2, face.mouthPosition[1] + 0.02, face.mouthPosition[2]], face.mouth, 0.35);
    addBox("local-dev-bolt-smile-right", [0.045, 0.026, 0.024], [face.mouthPosition[0] + face.mouthSize[0] / 2, face.mouthPosition[1] + 0.02, face.mouthPosition[2]], face.mouth, -0.35);
  } else if (face.mouthStyle === "frown") {
    addBox("local-dev-bolt-frown-left", [0.045, 0.026, 0.024], [face.mouthPosition[0] - face.mouthSize[0] / 2, face.mouthPosition[1] - 0.02, face.mouthPosition[2]], face.mouth, -0.35);
    addBox("local-dev-bolt-frown-right", [0.045, 0.026, 0.024], [face.mouthPosition[0] + face.mouthSize[0] / 2, face.mouthPosition[1] - 0.02, face.mouthPosition[2]], face.mouth, 0.35);
  } else if (face.mouthStyle === "open") {
    addBox("local-dev-bolt-open-mouth-teeth", [face.mouthSize[0] * 0.82, 0.018, 0.028], [face.mouthPosition[0], face.mouthPosition[1] + 0.02, face.mouthPosition[2] - 0.004], 0xf6e6d0);
  } else if (face.mouthStyle === "stern") {
    addBox("local-dev-bolt-stern-mouth-shadow", [face.mouthSize[0] + 0.04, 0.014, 0.02], [face.mouthPosition[0], face.mouthPosition[1] - 0.025, face.mouthPosition[2]], 0x140b08);
  } else if (face.mouthStyle === "smirk") {
    addBox("local-dev-bolt-smirk-corner", [0.05, 0.024, 0.024], [face.mouthPosition[0] + face.mouthSize[0] / 2, face.mouthPosition[1] + 0.02, face.mouthPosition[2]], face.mouth, -0.32);
  }

  addBox("local-dev-bolt-mouth-lower-pixel", [Math.max(0.045, face.mouthSize[0] * 0.38), 0.012, 0.012], [face.mouthPosition[0], face.mouthPosition[1] - 0.035, face.mouthPosition[2] - 0.016], face.mouth === 0x6b2f33 ? 0x3f1718 : face.skinShadow);
  if (face.mouthStyle === "open") {
    addBox("local-dev-bolt-open-mouth-bottom-shadow", [face.mouthSize[0] * 0.72, 0.015, 0.014], [face.mouthPosition[0], face.mouthPosition[1] - 0.02, face.mouthPosition[2] - 0.018], 0x2a0d10);
  }

  if (face.cheekStyle && face.cheekStyle !== "none") {
    const cheekSize: [number, number, number] =
      face.cheekStyle === "strong" ? [0.09, 0.07, 0.026] : [0.065, 0.045, 0.024];
    const cheekY = face.cheekStyle === "strong" ? fy(1.49) : fy(1.51);
    addBox("local-dev-bolt-left-cheek", cheekSize, [-0.18, cheekY, face.mouthPosition[2] - 0.024], face.cheek);
    addBox("local-dev-bolt-right-cheek", cheekSize, [0.18, cheekY, face.mouthPosition[2] - 0.024], face.cheek);
    if (face.cheekStyle === "freckled") {
      addBox("local-dev-bolt-freckle-1", [0.018, 0.018, 0.012], [-0.13, fy(1.525), face.mouthPosition[2] - 0.04], face.mouth);
      addBox("local-dev-bolt-freckle-2", [0.018, 0.018, 0.012], [0.13, fy(1.525), face.mouthPosition[2] - 0.04], face.mouth);
      addBox("local-dev-bolt-freckle-3", [0.016, 0.016, 0.012], [-0.21, fy(1.505), face.mouthPosition[2] - 0.04], face.mouth);
    }
  }

  switch (face.facialHair) {
    case "mustache":
      addBox("local-dev-bolt-mustache", [0.18, 0.04, 0.028], [0, fy(1.49), face.mouthPosition[2] - 0.02], face.hair);
      break;
    case "goatee":
      addBox("local-dev-bolt-goatee-mustache", [0.15, 0.03, 0.028], [0, fy(1.49), face.mouthPosition[2] - 0.02], face.hair);
      addBox("local-dev-bolt-goatee-chin", [0.09, 0.08, 0.028], [0, fy(1.385), face.mouthPosition[2] - 0.016], face.hair);
      break;
    case "short_beard":
      addBox("local-dev-bolt-short-beard", [0.22, 0.085, 0.028], [0, fy(1.385), face.mouthPosition[2] - 0.016], face.hair);
      break;
    case "full_beard":
      addBox("local-dev-bolt-full-beard", [0.25, 0.17, 0.032], [0, fy(1.365), face.mouthPosition[2] - 0.018], face.hair);
      addBox("local-dev-bolt-full-mustache", [0.18, 0.04, 0.03], [0, fy(1.49), face.mouthPosition[2] - 0.024], face.hair);
      addBox("local-dev-bolt-left-beard-side", [0.055, 0.18, 0.028], [-headWidth / 2 - 0.002, fy(1.42), face.mouthPosition[2] - 0.012], face.hair);
      addBox("local-dev-bolt-right-beard-side", [0.055, 0.18, 0.028], [headWidth / 2 + 0.002, fy(1.42), face.mouthPosition[2] - 0.012], face.hair);
      break;
    case "none":
    default:
      break;
  }

  if (face.accessory === "cap" && face.hairStyle !== "cap") {
    addBox("local-dev-bolt-accessory-cap", [headWidth + 0.14, 0.1, headDepth + 0.08], [0, face.headPosition[1] + headHeight / 2 + 0.07, -0.01], 0x38405a);
    addBox("local-dev-bolt-accessory-cap-brim", [headWidth + 0.22, 0.04, 0.12], [0, face.leftBrowPosition[1] + 0.06, faceFrontZ - 0.05], 0x38405a);
  } else if (face.accessory === "hood" && face.hairStyle !== "hood") {
    addBox("local-dev-bolt-accessory-hood-back", [headWidth + 0.18, headHeight + 0.16, headDepth + 0.16], [0, fy(1.57), 0.04], 0x32343f);
    addBox("local-dev-bolt-accessory-hood-rim", [headWidth + 0.12, 0.075, 0.08], [0, face.leftBrowPosition[1] + 0.058, faceFrontZ - 0.035], 0x32343f);
  } else if (face.accessory === "headband") {
    addBox("local-dev-bolt-headband", [headWidth + 0.1, 0.045, 0.045], [0, face.leftBrowPosition[1] + 0.045, faceFrontZ - 0.018], 0xd6a632);
  } else if (face.accessory === "spectacles") {
    addBox("local-dev-bolt-left-spectacles-top", [0.105, 0.012, 0.012], [face.leftEyePosition[0], face.leftEyePosition[1] + 0.036, face.leftEyePosition[2] - 0.01], 0xd8d3c1);
    addBox("local-dev-bolt-left-spectacles-bottom", [0.105, 0.012, 0.012], [face.leftEyePosition[0], face.leftEyePosition[1] - 0.036, face.leftEyePosition[2] - 0.01], 0xd8d3c1);
    addBox("local-dev-bolt-right-spectacles-top", [0.105, 0.012, 0.012], [face.rightEyePosition[0], face.rightEyePosition[1] + 0.036, face.rightEyePosition[2] - 0.01], 0xd8d3c1);
    addBox("local-dev-bolt-right-spectacles-bottom", [0.105, 0.012, 0.012], [face.rightEyePosition[0], face.rightEyePosition[1] - 0.036, face.rightEyePosition[2] - 0.01], 0xd8d3c1);
    addBox("local-dev-bolt-spectacles-bridge", [0.05, 0.012, 0.012], [0, face.leftEyePosition[1], face.leftEyePosition[2] - 0.01], 0xd8d3c1);
  }
}

const HARTHMERE_PLAYER_BODY_OUTFIT_COLORS = {
  earth: 0x7a5538,
  forest: 0x2f5f43,
  river: 0x315b78,
  ember: 0x88432e,
  royal: 0x5b3d83,
  ash: 0x5d646b,
} as const;

const HARTHMERE_PLAYER_BODY_OUTFIT_ACCENT_COLORS = {
  earth: 0xb89652,
  forest: 0x92a95a,
  river: 0x84aac2,
  ember: 0xd16a3c,
  royal: 0xd6a632,
  ash: 0xb8b2a4,
} as const;

const HARTHMERE_PLAYER_BODY_OUTFIT_TRIM_COLORS = {
  earth: 0x3f2d20,
  forest: 0x203b2b,
  river: 0x1d384d,
  ember: 0x4f2419,
  royal: 0x2c1f3a,
  ash: 0x30343a,
} as const;

type HarthmerePlayerBodyPolishMetrics = {
  torsoWidth: number;
  torsoHeight: number;
  shoulderWidth: number;
  armLength: number;
  legLength: number;
  torsoY: number;
  shoulderY: number;
  legSpread: number;
  stanceOffset: number;
};

function addLocalDevPlayerEquipmentPolish(
  group: THREE.Group,
  appearance: HarthmereCharacterAppearance,
  metrics: HarthmerePlayerBodyPolishMetrics,
): void {
  const equipment = appearance.equipment;
  const leather = 0x3b2418;
  const darkLeather = 0x221915;
  const metal = 0xb8b2a4;
  // Draw lightweight voxel proxies for equipment now; these share the same
  // slot strings as NPC/runtime gear and can be replaced by GLTF attachments
  // later without changing saved appearance data.
  if (equipment.hip || /sword|dagger|knife/i.test(equipment.mainHand ?? "")) {
    const sheath = localDevBoltHeadBox("local-dev-player-hip-sheath-polish", [0.055, 0.42, 0.075], [metrics.torsoWidth / 2 + 0.08, 0.52, 0.07], darkLeather);
    sheath.rotation.z = -0.24;
    group.add(sheath);
    group.add(localDevBoltHeadBox("local-dev-player-hip-sheath-cap-polish", [0.07, 0.035, 0.085], [metrics.torsoWidth / 2 + 0.035, 0.34, 0.07], metal));
  }
  if (/shield/i.test(equipment.offHand ?? "")) {
    group.add(localDevBoltHeadBox("local-dev-player-left-arm-shield-polish", [0.18, 0.26, 0.055], [-(metrics.shoulderWidth / 2 + 0.115), 0.86, -0.085], metal));
    group.add(localDevBoltHeadBox("local-dev-player-left-arm-shield-boss-polish", [0.075, 0.075, 0.065], [-(metrics.shoulderWidth / 2 + 0.115), 0.86, -0.13], 0xd6a632));
  }
  if (/quiver|bow/i.test(equipment.back ?? "") || /bow/i.test(equipment.mainHand ?? "")) {
    const quiver = localDevBoltHeadBox("local-dev-player-back-quiver-polish", [0.12, 0.42, 0.09], [metrics.torsoWidth / 2 + 0.05, metrics.torsoY + 0.05, 0.18], leather);
    quiver.rotation.z = -0.18;
    group.add(quiver);
    group.add(localDevBoltHeadBox("local-dev-player-quiver-fletching-polish", [0.14, 0.06, 0.1], [metrics.torsoWidth / 2 + 0.0, metrics.torsoY + 0.27, 0.2], 0xf0e6d2));
  }
  if (/staff|wand/i.test(equipment.mainHand ?? "")) {
    const staff = localDevBoltHeadBox("local-dev-player-right-hand-staff-polish", [0.035, 0.78, 0.035], [metrics.shoulderWidth / 2 + 0.18, 0.82, -0.04], leather);
    staff.rotation.z = -0.08;
    group.add(staff);
    group.add(localDevBoltHeadBox("local-dev-player-staff-cap-polish", [0.07, 0.07, 0.07], [metrics.shoulderWidth / 2 + 0.15, 1.2, -0.04], 0x6f5ca8));
  }
}

function harthmereBodyVisualScales(body: HarthmereVoxelBodyConfig) {
  const heightScale =
    body.bodyHeight === "short"
      ? 0.94
      : body.bodyHeight === "tall"
      ? 1.06
      : body.bodyHeight === "very_tall"
      ? 1.13
      : 1;
  const widthScale =
    body.bodyType === "slim"
      ? 0.9
      : body.bodyType === "broad"
      ? 1.14
      : body.bodyType === "stocky"
      ? 1.2
      : body.bodyType === "athletic"
      ? 1.08
      : body.bodyType === "soft"
      ? 1.05
      : 1;
  const depthScale = body.bodyType === "stocky" ? 1.1 : body.bodyType === "soft" ? 1.08 : 1;
  const armScale = body.armLength === "long" ? 1.16 : body.armLength === "short" ? 0.86 : 1;
  const legScale = body.legLength === "long" ? 1.15 : body.legLength === "short" ? 0.86 : 1;
  const shoulderScale = body.shoulderWidth === "wide" ? 1.16 : body.shoulderWidth === "narrow" ? 0.9 : 1;
  const torsoWidthScale =
    body.bodyType === "slim"
      ? 0.88
      : body.bodyType === "broad"
      ? 1.12
      : body.bodyType === "stocky"
      ? 1.16
      : body.bodyType === "athletic"
      ? 1.08
      : body.bodyType === "soft"
      ? 1.06
      : 1;
  const torsoHeightScale = body.bodyType === "stocky" ? 0.96 : body.bodyType === "athletic" ? 1.04 : 1;
  return {
    heightScale,
    widthScale,
    depthScale,
    armScale,
    legScale,
    shoulderScale,
    torsoWidthScale,
    torsoHeightScale,
  };
}

function applyLocalDevPlayerInnerBodyConfig(
  root: THREE.Object3D,
  body: HarthmereVoxelBodyConfig,
  baseScale = 1,
): void {
  const scales = harthmereBodyVisualScales(body);

  // This changes the animated/skinned player body itself. The voxel shell below
  // is only the readable Harthmere overlay; these transforms are applied to the
  // actual GLTF skeleton/nodes so walking, running, attacking, and idling use the
  // selected proportions too. Node names vary between exported meshes, so match
  // the common Biomes/Rig names and safely no-op on unknown meshes.
  root.scale.set(
    scales.widthScale * baseScale,
    scales.heightScale * baseScale,
    scales.depthScale * baseScale
  );
  root.traverse((object) => {
    const name = object.name.toLowerCase();
    if (name.includes("local-dev-")) {
      return;
    }

    if (/(^|[_ -])(spine|chest|torso|body|hips|pelvis)([_ -]|$)/i.test(object.name)) {
      object.scale.x *= scales.torsoWidthScale * scales.shoulderScale;
      object.scale.y *= scales.torsoHeightScale;
      object.scale.z *= scales.depthScale;
    } else if (/(^|[_ -])(l|left)[_ -]?(arm|forearm|hand|shoulder)([_ -]|$)/i.test(object.name)) {
      object.scale.y *= scales.armScale;
      object.scale.x *= body.shoulderWidth === "wide" ? 1.08 : body.shoulderWidth === "narrow" ? 0.94 : 1;
    } else if (/(^|[_ -])(r|right)[_ -]?(arm|forearm|hand|shoulder)([_ -]|$)/i.test(object.name)) {
      object.scale.y *= scales.armScale;
      object.scale.x *= body.shoulderWidth === "wide" ? 1.08 : body.shoulderWidth === "narrow" ? 0.94 : 1;
    } else if (/(^|[_ -])(l|left)[_ -]?(leg|thigh|shin|foot)([_ -]|$)/i.test(object.name)) {
      object.scale.y *= scales.legScale;
    } else if (/(^|[_ -])(r|right)[_ -]?(leg|thigh|shin|foot)([_ -]|$)/i.test(object.name)) {
      object.scale.y *= scales.legScale;
    }
  });

  if (body.stance === "heroic") {
    root.rotation.x = -0.025;
  } else if (body.stance === "reserved") {
    root.rotation.x = 0.025;
  }
}

function normalizeHarthmereVariantAnimations(gltf: GLTF) {
  const sourceAnimations = [...gltf.animations];
  const sourceAnimationNames = new Set(sourceAnimations.map((clip) => clip.name));
  const normalized: THREE.AnimationClip[] = [];

  for (const clip of sourceAnimations) {
    if (clip.name === "Walk") {
      const clone = clip.clone();
      clone.name = "Walking";
      normalized.push(clone);
    } else if (clip.name === "Run") {
      const clone = clip.clone();
      clone.name = "Running";
      normalized.push(clone);
    } else {
      normalized.push(clip);
    }
  }

  const normalizedAnimationNames = new Set(normalized.map((clip) => clip.name));

  // Do not create Attack2 from Attack when the asset already has a distinct
  // Attack2 or HeavyAttack clip. THREE's AnimationSystem picks the first clip
  // with a matching name, so the old unconditional clone made attack2 look
  // identical to the regular Attack on Harthmere variants.
  if (!normalizedAnimationNames.has("Attack2")) {
    const heavyAttack = sourceAnimations.find((clip) => clip.name === "HeavyAttack");
    const regularAttack = sourceAnimations.find((clip) => clip.name === "Attack");
    const fallback = heavyAttack ?? regularAttack;
    if (fallback) {
      const attack2Alias = fallback.clone();
      attack2Alias.name = "Attack2";
      normalized.push(attack2Alias);
    }
  }

  // Keep HeavyAttack available as its own named clip when the asset shipped it.
  // The player animation system now prefers HeavyAttack for attack2 and only
  // falls back to Attack2 on older/default assets.
  if (
    !normalizedAnimationNames.has("HeavyAttack") &&
    sourceAnimationNames.has("Attack2")
  ) {
    const attack2 = sourceAnimations.find((clip) => clip.name === "Attack2");
    if (attack2) {
      const heavyAttackAlias = attack2.clone();
      heavyAttackAlias.name = "HeavyAttack";
      normalized.push(heavyAttackAlias);
    }
  }

  gltf.animations.length = 0;
  gltf.animations.push(...normalized);
}

function hideHarthmereVariantBuiltInHead(root: THREE.Object3D) {
  const headNames = new Set([
    "Head",
    "HairCap",
    "LeftEye",
    "RightEye",
    "Nose",
    "Mouth",
  ]);
  root.traverse((object) => {
    if (headNames.has(object.name)) {
      object.visible = false;
      object.traverse((child) => {
        child.visible = false;
      });
    }
  });
}

function addLocalDevPlayerBodyShellToObject(
  root: THREE.Object3D,
  userId?: BiomesId,
): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  removeLocalDevFaceObject(root, "local-dev-player-body-shell");

  const appearance = userId ? loadHarthmerePlayerAppearanceConfig(userId) : undefined;
  const body = appearance?.body;
  if (!body) {
    return;
  }
  root.userData.harthmereAppearance = appearance;
  root.userData.harthmereForwardAxis = appearance.forwardAxis;

  applyLocalDevPlayerInnerBodyConfig(root, body);

  const color = HARTHMERE_PLAYER_BODY_OUTFIT_COLORS[body.outfitColor];
  const torsoWidth =
    body.bodyType === "slim"
      ? 0.34
      : body.bodyType === "broad"
      ? 0.5
      : body.bodyType === "stocky"
      ? 0.54
      : body.bodyType === "athletic"
      ? 0.46
      : body.bodyType === "soft"
      ? 0.48
      : 0.42;
  const torsoHeight =
    body.bodyType === "stocky"
      ? 0.54
      : body.bodyType === "athletic"
      ? 0.62
      : body.bodyType === "soft"
      ? 0.56
      : 0.58;
  const shoulderWidth =
    body.shoulderWidth === "wide"
      ? torsoWidth + 0.26
      : body.shoulderWidth === "narrow"
      ? torsoWidth + 0.04
      : torsoWidth + 0.14;
  const legLength = body.legLength === "long" ? 0.64 : body.legLength === "short" ? 0.4 : 0.52;
  const armLength = body.armLength === "long" ? 0.7 : body.armLength === "short" ? 0.46 : 0.58;
  const stanceOffset = body.stance === "heroic" ? 0.05 : body.stance === "reserved" ? -0.03 : 0;
  const stanceArmX = body.stance === "heroic" ? 0.035 : body.stance === "reserved" ? -0.02 : 0;
  const legSpread = body.stance === "heroic" ? 0.07 : body.stance === "reserved" ? 0.02 : 0.045;

  const group = new THREE.Group();
  group.name = "local-dev-player-body-shell";
  group.renderOrder = 18;
  group.add(
    localDevBoltHeadBox("local-dev-body-shoulders", [shoulderWidth, 0.08, 0.24], [0, 1.18, -0.005], color),
    localDevBoltHeadBox("local-dev-body-torso", [torsoWidth, torsoHeight, 0.27], [0, 0.9 + stanceOffset, 0], color),
    localDevBoltHeadBox("local-dev-body-belt", [torsoWidth + 0.055, 0.06, 0.29], [0, 0.58 + stanceOffset, 0], 0x221915),
    localDevBoltHeadBox("local-dev-body-left-arm", [0.105, armLength, 0.12], [-shoulderWidth / 2 - 0.055 - stanceArmX, 0.92, 0], color),
    localDevBoltHeadBox("local-dev-body-right-arm", [0.105, armLength, 0.12], [shoulderWidth / 2 + 0.055 + stanceArmX, 0.92, 0], color),
    localDevBoltHeadBox("local-dev-body-left-leg", [0.13, legLength, 0.13], [-torsoWidth / 4 - legSpread, 0.26, 0], 0x2c2b2f),
    localDevBoltHeadBox("local-dev-body-right-leg", [0.13, legLength, 0.13], [torsoWidth / 4 + legSpread, 0.26, 0], 0x2c2b2f),
  );
  const accentColor = HARTHMERE_PLAYER_BODY_OUTFIT_ACCENT_COLORS[body.outfitColor];
  const trimColor = HARTHMERE_PLAYER_BODY_OUTFIT_TRIM_COLORS[body.outfitColor];
  // Outfit polish stays in voxel primitives: collar, cuffs, hem, boot tops,
  // lacing, and role/equipment trim. This is cheaper and more consistent than
  // importing a dependency for procedural human styling.
  group.add(
    localDevBoltHeadBox("local-dev-body-collar-polish", [torsoWidth + 0.05, 0.04, 0.305], [0, 1.2 + stanceOffset, -0.024], accentColor),
    localDevBoltHeadBox("local-dev-body-hem-polish", [torsoWidth + 0.09, 0.04, 0.305], [0, 0.66 + stanceOffset, -0.024], accentColor),
    localDevBoltHeadBox("local-dev-body-left-cuff-polish", [0.13, 0.045, 0.135], [-shoulderWidth / 2 - 0.055 - stanceArmX, 0.62, -0.02], trimColor),
    localDevBoltHeadBox("local-dev-body-right-cuff-polish", [0.13, 0.045, 0.135], [shoulderWidth / 2 + 0.055 + stanceArmX, 0.62, -0.02], trimColor),
    localDevBoltHeadBox("local-dev-body-left-boot-polish", [0.15, 0.1, 0.15], [-torsoWidth / 4 - legSpread, 0.07, -0.02], 0x151515),
    localDevBoltHeadBox("local-dev-body-right-boot-polish", [0.15, 0.1, 0.15], [torsoWidth / 4 + legSpread, 0.07, -0.02], 0x151515),
    localDevBoltHeadBox("local-dev-body-lacing-1-polish", [0.035, 0.035, 0.02], [0, 1.04 + stanceOffset, -0.16], trimColor),
    localDevBoltHeadBox("local-dev-body-lacing-2-polish", [0.035, 0.035, 0.02], [0, 0.94 + stanceOffset, -0.16], trimColor),
    localDevBoltHeadBox("local-dev-body-lacing-3-polish", [0.035, 0.035, 0.02], [0, 0.84 + stanceOffset, -0.16], trimColor),
  );
  const leftArm = group.getObjectByName("local-dev-body-left-arm");
  const rightArm = group.getObjectByName("local-dev-body-right-arm");
  const leftLeg = group.getObjectByName("local-dev-body-left-leg");
  const rightLeg = group.getObjectByName("local-dev-body-right-leg");
  if (body.stance === "heroic") {
    leftArm?.rotation.set(0, 0, 0.08);
    rightArm?.rotation.set(0, 0, -0.08);
    leftLeg?.rotation.set(0, 0, -0.035);
    rightLeg?.rotation.set(0, 0, 0.035);
  } else if (body.stance === "reserved") {
    leftArm?.rotation.set(0, 0, -0.05);
    rightArm?.rotation.set(0, 0, 0.05);
    leftLeg?.rotation.set(0, 0, 0.015);
    rightLeg?.rotation.set(0, 0, -0.015);
  } else if (body.stance === "upright") {
    leftArm?.rotation.set(0, 0, 0.025);
    rightArm?.rotation.set(0, 0, -0.025);
  }
  addLocalDevPlayerEquipmentPolish(group, appearance, {
    torsoWidth,
    torsoHeight,
    shoulderWidth,
    armLength,
    legLength,
    torsoY: 0.9 + stanceOffset,
    shoulderY: 1.18,
    legSpread,
    stanceOffset,
  });
  if (body.bodyType === "athletic") {
    group.add(localDevBoltHeadBox("local-dev-body-athletic-chest", [torsoWidth + 0.08, 0.08, 0.285], [0, 1.06 + stanceOffset, -0.02], 0xffffff));
  } else if (body.bodyType === "soft") {
    group.add(localDevBoltHeadBox("local-dev-body-soft-waist", [torsoWidth + 0.09, 0.09, 0.285], [0, 0.7 + stanceOffset, -0.02], 0xffffff));
  }
  if (body.stance === "heroic") {
    group.add(localDevBoltHeadBox("local-dev-body-hero-sash", [torsoWidth + 0.08, 0.055, 0.3], [0, 1.05, -0.025], 0xd6a632));
  } else if (body.stance === "reserved") {
    group.add(localDevBoltHeadBox("local-dev-body-reserved-line", [0.035, 0.46, 0.3], [0, 0.92, -0.025], 0x111111));
  } else if (body.stance === "upright") {
    group.add(localDevBoltHeadBox("local-dev-body-upright-collar", [torsoWidth + 0.04, 0.045, 0.295], [0, 1.2, -0.022], 0xf6e6d0));
  }
  root.add(group);
}

function addLocalDevBoltHeadShellToObject(
  root: THREE.Object3D,
  userId?: BiomesId,
): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  removeLocalDevFaceObject(root, "local-dev-bolt-head-shell");
  removeLocalDevFaceObject(root, "local-dev-voxel-face");
  removeLocalDevFaceObject(root, "local-dev-detailed-face");

  // Match the simple block head used by Bolt / the local-dev Harthmere
  // townspeople. For the Harthmere body-variant GLTFs, attach the custom
  // head to the Neck node instead of the root. The generated GLTF bodies are
  // around 2.3 units tall before the root scale is applied, so the old root
  // y=1.58 placement landed visually in the chest. Anchoring to Neck keeps
  // the head on the shoulders while walking/running/attacking.
  const group = new THREE.Group();
  group.name = "local-dev-bolt-head-shell";
  group.renderOrder = 19;
  group.userData.harthmerePlayerFaceExpressionRoot = true;

  const appearance: HarthmereCharacterAppearance | undefined = userId
    ? loadHarthmerePlayerAppearanceConfig(userId)
    : undefined;
  if (appearance) {
    root.userData.harthmereAppearance = appearance;
    root.userData.harthmereForwardAxis = appearance.forwardAxis;
  }
  const baseFace = appearance
    ? localDevPlayerVoxelFaceFromConfig(appearance.face)
    : LOCAL_DEV_PLAYER_VOXEL_FACE;
  const variantAnchor = harthmereVariantHeadAnchor(
    root,
    appearance?.anchors ?? HARTHMERE_DEFAULT_HUMAN_ANCHORS,
  );
  const variantBuiltInHead = root.getObjectByName("Head");
  const face = variantAnchor
    ? shiftLocalDevPlayerVoxelFaceSpecY(
        baseFace,
        (variantBuiltInHead?.position.y ?? 0.34) - baseFace.headPosition[1],
      )
    : baseFace;

  addLocalDevPlayerVoxelFaceParts(group, face);
  (variantAnchor ?? root).add(group);
}

function addLocalDevSimpleFaceToObject(
  root: THREE.Object3D,
  userId?: BiomesId,
): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  addLocalDevBoltHeadShellToObject(root, userId);
}

function addLocalDevSimpleFace(gltf: GLTF): void {
  addLocalDevSimpleFaceToObject(gltfToThree(gltf));
}

export function setFrustumCulling(gltf: GLTF, frustumCulling: boolean) {
  const scene = gltfToThree(gltf);
  scene.traverse((object) => {
    object.frustumCulled = frustumCulling;
  });
  scene.frustumCulled = frustumCulling;
}

async function genFetchPlayerMeshGLTF(deps: ClientResourceDeps, url: string) {
  const isHarthmereVariantMesh = isHarthmerePlayerBodyVariantUrl(url);
  const mesh = await loadGltf(url);
  const hash = url;

  if (isHarthmereVariantMesh) {
    normalizeHarthmereVariantAnimations(mesh);
    return { mesh, url, hash };
  }

  const animations = await deps.get("/scene/player/animations");
  mergeAnimations(mesh, animations);

  replaceWithPlayerMaterial(mesh);
  addLocalDevSimpleFace(mesh);

  return { mesh, url, hash };
}

export function makeECSWearablesUrl(
  deps: ClientResourceDeps,
  id: BiomesId
): string {
  const wearables = deps.get("/ecs/c/wearing", id);
  const appearance = deps.get("/ecs/c/appearance_component", id);
  return playerMeshUrlForId(id, wearables?.items, appearance?.appearance);
}

export async function fetchPlayerMeshGLTF(
  deps: ClientResourceDeps,
  wearables?: ReadonlyItemAssignment,
  appearance?: ReadonlyAppearance,
  id?: BiomesId
): Promise<PlayerWearingMeshGltf> {
  const url = playerMeshUrlForId(id, wearables, appearance);
  const templateGltf = await deps.get("/scene/player/wearing_mesh_gltf", url);

  // Clone the mesh so that different contexts that work with the same mesh
  // template (e.g. the same URL) get different three object instances.
  const cloned = SkeletonUtils.clone(gltfToThree(templateGltf.mesh));
  const clonedScene = new THREE.Group();
  clonedScene.add(cloned);

  return {
    ...templateGltf,
    mesh: {
      ...templateGltf.mesh,
      scene: clonedScene,
      scenes: [clonedScene],
    },
  };
}

function mergeAnimations(gltf: GLTF, animations: GLTF) {
  gltf.animations.push(...animations.animations);
}

function tweaksParams(deps: ClientResourceDeps) {
  return deps.get("/tweaks").characterAnimationTiming;
}

// Resources shared by all player types.
export interface PlayerCommonEffects {
  healingParticleMaterials: ParticleSystemMaterials;
  warpParticleMaterials: ParticleSystemMaterials;
  placeParticleTexture: Texture;
}

async function makePlayerCommonEffects(
  deps: ClientResourceDeps
): Promise<PlayerCommonEffects> {
  return {
    healingParticleMaterials: await playerHealingParticleMaterials(),
    warpParticleMaterials: await warpPoofParticleMaterials(),
    placeParticleTexture: await blockPlaceParticleTexture(deps),
  };
}

async function makePlayerBuffEffects(
  context: ClientContext,
  deps: ClientResourceDeps,
  buffId: BiomesId
): Promise<Optional<ParticleSystemMaterials>> {
  const particleIcon = anItem(buffId)?.particleIcon;
  if (!particleIcon) {
    return;
  }
  const material = await playerBuffParticleMaterials(particleIcon);
  if (!material) {
    log.warn(`Could not find particle asset for: ${particleIcon} (${buffId})`);
    return;
  }
  return material;
}

export async function makePlayerLikeAppearanceMesh(
  deps: ClientResourceDeps,
  id: BiomesId
): Promise<GLTF> {
  const wearing = deps.get("/ecs/c/wearing", id);
  const appearance = deps.get("/ecs/c/appearance_component", id);
  const { mesh } = await fetchPlayerMeshGLTF(
    deps,
    wearing?.items,
    appearance?.appearance,
    id
  );
  return mesh;
}


// SNAPSHOT_RICH_NPC_APPEARANCE_V69:
// Snapshot NPCs were meant to use the upstream player-like wearable mesh
// generator: /api/assets/player_mesh.glb?top=...&bottoms=...&sc=...&ec=...&hc=...
// The Harthmere/Glitch local player body override is intentionally kept for
// actual players and Harthmere local-dev NPCs, but snapshot town/merchant NPCs
// must bypass harthmerePlayerBodyVariantUrl(id) so their Bikkie wearables,
// head_id, skin, hair, and eye palettes can render like the original snapshot.
const SNAPSHOT_RICH_NPC_APPEARANCE_VERSION_V69 =
  "snapshot-rich-npc-appearance-v69";

function snapshotRichNpcPickV69<T>(items: readonly T[], id: BiomesId, salt: number): T {
  const numericId = Number(id) || 1;
  const value = Math.abs(Math.sin(numericId * (salt + 11.731)) * 1000003);
  return items[Math.floor(value) % items.length]!;
}

function snapshotRichNpcHasUsefulAppearanceV69(
  appearance?: ReadonlyAppearance
): boolean {
  return !!(
    appearance?.skin_color_id ||
    appearance?.eye_color_id ||
    appearance?.hair_color_id ||
    appearance?.head_id
  );
}

function snapshotRichNpcHasUsefulWearablesV69(
  wearables?: ReadonlyItemAssignment
): boolean {
  return !!wearables && Array.from(wearables.values()).some(Boolean);
}

function snapshotRichNpcFallbackAppearanceV69(id: BiomesId): ReadonlyAppearance {
  return {
    skin_color_id: snapshotRichNpcPickV69(
      [
        "skin_color_0",
        "skin_color_1",
        "skin_color_2",
        "skin_color_3",
        "skin_color_4",
        "skin_color_5",
        "skin_color_6",
        "skin_color_7",
        "skin_color_8",
        "skin_color_9",
        "skin_color_10",
        "skin_color_11",
      ],
      id,
      1
    ),
    eye_color_id: snapshotRichNpcPickV69(
      ["eye_color_0", "eye_color_1", "eye_color_2", "eye_color_3", "eye_color_4"],
      id,
      2
    ),
    hair_color_id: snapshotRichNpcPickV69(
      [
        "hair_color_0",
        "hair_color_1",
        "hair_color_2",
        "hair_color_3",
        "hair_color_4",
        "hair_color_5",
        "hair_color_6",
        "hair_color_7",
        "hair_color_8",
      ],
      id,
      3
    ),
    head_id: BikkieIds.androgenous,
  };
}

function snapshotRichNpcFallbackWearablesV69(id: BiomesId): ReadonlyItemAssignment {
  const items = new Map<BiomesId, Item>();
  const add = (slot: BiomesId, itemId: BiomesId) => {
    try {
      items.set(slot, anItem(itemId));
    } catch (error) {
      log.warn("SNAPSHOT_RICH_NPC_APPEARANCE_V69 could not resolve fallback wearable", {
        slot,
        itemId,
        error,
      });
    }
  };

  add(
    BikkieIds.top,
    snapshotRichNpcPickV69(
      [BikkieIds.tatteredTop, BikkieIds.grassyTop, BikkieIds.pjTop, BikkieIds.ogTShirt],
      id,
      4
    )
  );
  add(
    BikkieIds.bottoms,
    snapshotRichNpcPickV69(
      [BikkieIds.tatteredSkirt, BikkieIds.grassyBottom, BikkieIds.pjBottoms, BikkieIds.bellBottoms],
      id,
      5
    )
  );
  add(BikkieIds.feet, BikkieIds.boots);

  const hat = snapshotRichNpcPickV69(
    [undefined, BikkieIds.flowerCrown, BikkieIds.sombrero, BikkieIds.aviatorHat],
    id,
    6
  );
  if (hat) {
    add(BikkieIds.hat, hat);
  }

  const outerwear = snapshotRichNpcPickV69(
    [undefined, undefined, BikkieIds.poncho],
    id,
    7
  );
  if (outerwear) {
    add(BikkieIds.outerwear, outerwear);
  }

  return items;
}

export async function makeSnapshotPlayerLikeAppearanceMesh(
  deps: ClientResourceDeps,
  id: BiomesId
): Promise<GLTF> {
  const wearing = deps.get("/ecs/c/wearing", id);
  const appearance = deps.get("/ecs/c/appearance_component", id);
  const wearables = snapshotRichNpcHasUsefulWearablesV69(wearing?.items)
    ? wearing?.items
    : snapshotRichNpcFallbackWearablesV69(id);
  const finalAppearance = snapshotRichNpcHasUsefulAppearanceV69(appearance?.appearance)
    ? appearance?.appearance
    : snapshotRichNpcFallbackAppearanceV69(id);

  const { mesh, url } = await fetchPlayerMeshGLTF(
    deps,
    wearables,
    finalAppearance,
    // Undefined id is intentional: playerMeshUrlForId(id, ...) uses the
    // Harthmere static body variant in dev. Snapshot NPCs need the upstream
    // wearable/appearance URL instead.
    undefined
  );
  mesh.scene.userData.snapshotRichNpcAppearanceVersion =
    SNAPSHOT_RICH_NPC_APPEARANCE_VERSION_V69;
  mesh.scene.userData.snapshotRichNpcAppearanceUrl = url;
  return mesh;
}

export async function addPlayerMeshResources(
  loader: RegistryLoader<ClientContext>,
  builder: ClientResourcesBuilder
) {
  builder.addGlobal("/scene/player/animations", fetchPlayerAnimationsGLTF());
  builder.add("/scene/player/wearing_mesh_gltf", genFetchPlayerMeshGLTF);
  builder.addDynamic(
    "/scene/player/mesh",
    loader.provide(makePlayerMesh),
    loader.provide(updatePlayerMesh)
  );

  builder.addDynamic(
    "/player/preview",
    loader.provide(({ userId }) => ({
      userId,
    })),
    (_deps: ClientResourceDeps, resource: any) => resource
  );

  builder.add("/scene/player/mesh_preview", makePlayerPreviewMesh);
  builder.add("/scene/player/common_effects", makePlayerCommonEffects);
  builder.add(
    "/scene/player/buff_effects",
    loader.provide(makePlayerBuffEffects)
  );
}
