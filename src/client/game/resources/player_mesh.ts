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
  const url = ecsWearablesToUrl(wearing?.items, appearance?.appearance);
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
    appearance
  );
  setFrustumCulling(mesh, frustumCulling);

  const animationTimings = tweaksParams(deps);

  const playerAnimatedMesh = loadPlayerAnimatedMesh(mesh, animationTimings);
  addLocalDevSimpleFaceToObject(playerAnimatedMesh.three);

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
function addLocalDevSimpleFaceToObject(root: THREE.Object3D): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  if (
    root.getObjectByName("local-dev-voxel-face") ||
    root.getObjectByName("local-dev-detailed-face")
  ) {
    return;
  }

  // The sparse local/dev player mesh can render without visible facial features
  // when the generated asset pipeline is incomplete. Add one forward-facing,
  // blocky voxel face. Do not add a back face: that caused the earlier
  // four-eyes/front-and-back-head bug.
  const texture = makeLocalDevFaceTexture(localDevFaceSeed(root));
  if (!texture) {
    return;
  }

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), material);
  face.name = "local-dev-voxel-face";
  face.renderOrder = 20;
  // In the generated Biomes player mesh, forward is the negative-Z side. Keeping
  // this one-sided prevents eyes/mouth from rendering through the back of heads.
  face.position.set(0, 1.58, -0.395);
  root.add(face);
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
  const [animations, mesh, hash] = await Promise.all([
    deps.get("/scene/player/animations"),
    loadGltf(url),
    url,
  ]);

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
  return ecsWearablesToUrl(wearables?.items, appearance?.appearance);
}

export async function fetchPlayerMeshGLTF(
  deps: ClientResourceDeps,
  wearables?: ReadonlyItemAssignment,
  appearance?: ReadonlyAppearance
): Promise<PlayerWearingMeshGltf> {
  const url = ecsWearablesToUrl(wearables, appearance);
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
    appearance?.appearance
  );
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
