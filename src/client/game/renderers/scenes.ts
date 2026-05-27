// Base: BasePass outputting color, normal, depth.
// Secondary: Includes Three and Translucent:
//    Three: For use with any default THREE materials, outputting color, depth
//    Translucent: Any translucent materials, outputting only color
// (These are shared since they have the same outputs)
// Currently, we can't re-use the same color texture map for multiple three webglrendertargets,
// so there is a cost to composite all of these passes together.
// In the future, consider modifying three to allow this, and that will save us some buffers
// and composite perf

import { BasePassMaterial } from "@/client/game/renderers/base_pass_material";
import { PunchthroughMaterial } from "@/client/game/renderers/punchthrough_material";
import { CSS3DObject } from "@/client/game/renderers/three_ext/css3d";
import { log } from "@/shared/logging";
import * as THREE from "three";

export const SCENE_TYPES = [
  "base",
  "three",
  "translucent",
  "water",
  "punchthrough",
  "css",
];
const namedDependencies = [
  "color",
  "baseDepth",
  "viewportSize",
  "normalTexture",
  "fogStart",
  "fogEnd",
  "cameraNear",
  "cameraFar",
  "time",
];
export const dependencyUniforms = [...namedDependencies];
export type DependencyUniform = (typeof dependencyUniforms)[number];

export type SceneDependencies = THREE.Scene & {
  materialDependencies: Map<DependencyUniform, Set<THREE.RawShaderMaterial>>;
};

export type SceneType = (typeof SCENE_TYPES)[number];

export type Scenes = {
  [key in SceneType]: SceneDependencies;
};

export const sceneForMaterial = (material: THREE.Material): SceneType => {
  if ((material as any).sceneType) {
    return (material as any).sceneType as SceneType;
  } else if (material instanceof BasePassMaterial) {
    return "base";
  } else if (material instanceof PunchthroughMaterial) {
    return "punchthrough";
  } else if (material.transparent) {
    return "translucent";
  } else {
    return "three";
  }
};

const materialsForMeshV156 = (mesh: THREE.Mesh): THREE.Material[] => {
  // HARTHMERE_SCENES_MULTI_MATERIAL_ARRAY_V156
  // Production player/avatar wearables and generated item meshes can use
  // THREE.Material[] on one mesh. The previous scene classifier treated that
  // array object like one material, which fell through to "three" even when
  // every contained material was a BasePassMaterial. That routes base-pass
  // shaders into the wrong framebuffer and Chrome reports:
  //   GL_INVALID_OPERATION: glDrawElements: Mismatch between texture format
  //   and sampler type
  const material = mesh.material;
  return Array.isArray(material) ? material : material ? [material] : [];
};

// TODO cache/memoize
export const scenesForObject = (object: THREE.Object3D): Set<SceneType> => {
  const seenScenes = new Set<SceneType>();
  if ((object as any).sceneType) {
    return new Set([(object as any).sceneType]);
  }
  object &&
    object.traverse((child) => {
      if (child instanceof CSS3DObject) {
        seenScenes.add("css");
      }
      if (child instanceof THREE.Mesh) {
        for (const material of materialsForMeshV156(child)) {
          seenScenes.add(sceneForMaterial(material));
        }
      }
    });
  return seenScenes;
};

const addMaterialDependency = (
  scene: SceneDependencies,
  name: DependencyUniform,
  material: THREE.RawShaderMaterial
) => {
  if (!scene.materialDependencies.has(name)) {
    scene.materialDependencies.set(name, new Set());
  }
  scene.materialDependencies.get(name)!.add(material);
};

export const addMaterialDependencies = (
  scene: SceneDependencies,
  object: THREE.Object3D
) => {
  object &&
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        for (const material of materialsForMeshV156(child)) {
          if (material instanceof THREE.RawShaderMaterial) {
            for (const name of namedDependencies) {
              if (name in material.uniforms) {
                addMaterialDependency(scene, name, material);
              }
            }
          }
        }
      }
    });
};

export const sceneForObject = (object: THREE.Object3D): SceneType => {
  const seenScenes = scenesForObject(object);
  if (seenScenes.size === 0) {
    return "three";
  } else if (seenScenes.size === 1) {
    return [...seenScenes][0];
  } else {
    log.error(`Object has multiple scenes: ${object.name}`);
    return "three";
  }
};

export const createNewScene = (): SceneDependencies => {
  const scene = new THREE.Scene() as SceneDependencies;
  scene.materialDependencies = new Map();
  return scene;
};

export const createNewScenes = (): Scenes => {
  return {
    base: createNewScene(),
    three: createNewScene(),
    translucent: createNewScene(),
    water: createNewScene(),
    punchthrough: createNewScene(),
    css: createNewScene(),
  };
};

export const combineScenes = (...scenes: SceneDependencies[]) => {
  if (scenes.length === 1) {
    return scenes[0];
  }
  const scene = createNewScene();
  scene.children.push(...scenes);
  for (const childScene of scenes) {
    for (const [name, materials] of childScene.materialDependencies.entries()) {
      if (!scene.materialDependencies.has(name)) {
        scene.materialDependencies.set(name, new Set());
      }
      for (const material of materials) {
        scene.materialDependencies.get(name)!.add(material);
      }
    }
  }
  return scene;
};

// Harthmere local-dev assets can combine opaque, translucent, and base-pass
// children under one root object. That is worth warning about once, but logging
// it every frame hides useful renderer diagnostics and makes DevTools look like
// the game is broken.
const mixedSceneTypeWarningUuids = new Set<string>();
const mixedSceneTypeDebugLimit = 80;

type HarthmereSceneDebugEntry = {
  uuid: string;
  name: string;
  chosenScene: SceneType;
  sceneTypes: SceneType[];
  materialTypes: string[];
  materialNames: string[];
  playerBasePassVersion?: string;
  playerBasePassConverted?: number;
};

declare global {
  interface Window {
    __harthmereSceneDebug?: HarthmereSceneDebugEntry[];
  }
}

const sceneDebugMaterialInfo = (object: THREE.Object3D) => {
  const materialTypes = new Set<string>();
  const materialNames = new Set<string>();
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) {
      return;
    }
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const material of materials) {
      materialTypes.add(
        (material as THREE.Material & { type?: string }).type ??
          material.constructor.name
      );
      if (material.name) {
        materialNames.add(material.name);
      }
    }
  });
  return {
    materialTypes: [...materialTypes].sort(),
    materialNames: [...materialNames].sort().slice(0, 20),
  };
};

const rememberSceneDebug = (
  object: THREE.Object3D,
  chosenScene: SceneType,
  sceneTypes: Set<SceneType>
) => {
  if (typeof window === "undefined") {
    return;
  }
  const entries = (window.__harthmereSceneDebug ??= []);
  if (entries.length >= mixedSceneTypeDebugLimit) {
    return;
  }
  const { materialTypes, materialNames } = sceneDebugMaterialInfo(object);
  entries.push({
    uuid: object.uuid,
    name: object.name,
    chosenScene,
    sceneTypes: [...sceneTypes].sort() as SceneType[],
    materialTypes,
    materialNames,
    playerBasePassVersion:
      object.userData?.harthmerePlayerAvatarBasePassMaterialsVersion,
    playerBasePassConverted:
      object.userData?.harthmerePlayerAvatarBasePassMaterialsConverted,
  });
};

const isBasePassCoercedPlayerRoot = (object: THREE.Object3D) =>
  object.userData?.harthmerePlayerAvatarBasePassMaterialsVersion ===
  "harthmere-player-avatar-base-pass-materials-v153";

const chooseMixedSceneFallbackV155 = (
  object: THREE.Object3D,
  objScenes: Set<SceneType>
): SceneType => {
  // HARTHMERE_MIXED_SCENE_TYPE_PROD_SAFE_FALLBACK_V155
  // The earlier broad "mixed root => base" fallback fixed one player-avatar
  // path but broke production when ordinary Harthmere roots containing stock
  // Three.js materials were sent to SceneBasePass. SceneBasePass renders into
  // an MRT target, and stock Three.js shaders do not write every active output,
  // producing:
  //   GL_INVALID_OPERATION: glDrawArrays: Active draw buffers with missing
  //   fragment shader outputs
  // Player avatars are now explicitly coerced to base-pass materials in
  // player_mesh.ts, so a healthy avatar root should arrive as a single "base"
  // scene. If a marked player root is still mixed, keep the previous base
  // fallback as an emergency guard. For every other mixed root, preserve stock
  // Three.js compatibility by routing it through the secondary/three pass.
  if (isBasePassCoercedPlayerRoot(object) && objScenes.has("base")) {
    return "base";
  }
  return "three";
};

export const addToScene = (
  scene: SceneDependencies,
  object: THREE.Object3D
) => {
  scene.add(object);
  addMaterialDependencies(scene, object);
};

export const addToScenes = (scenes: Scenes, object: THREE.Object3D) => {
  const objScenes = scenesForObject(object);
  let sceneName: SceneType = "three";

  if (objScenes.size === 1) {
    sceneName = [...objScenes][0];
  } else if (objScenes.size > 1) {
    sceneName = chooseMixedSceneFallbackV155(object, objScenes);
    rememberSceneDebug(object, sceneName, objScenes);
    if (!mixedSceneTypeWarningUuids.has(object.uuid)) {
      mixedSceneTypeWarningUuids.add(object.uuid);
      const { materialTypes } = sceneDebugMaterialInfo(object);
      log.error(
        `Found mesh with mix of scene types ${object.uuid}: ${[
          ...objScenes,
        ]}. Defaulting to ${sceneName}. materials=${materialTypes.join(",")}`
      );
    }
  }
  addMaterialDependencies(scenes[sceneName], object);
  scenes[sceneName].add(object);
};
