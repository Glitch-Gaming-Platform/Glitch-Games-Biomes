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
        if (child.material) {
          seenScenes.add(sceneForMaterial(child.material));
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
        if (child.material instanceof THREE.RawShaderMaterial) {
          for (const name of namedDependencies) {
            if (name in child.material.uniforms) {
              addMaterialDependency(scene, name, child.material);
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

// Harthmere local-dev assets can combine opaque and translucent children under
// one root object. That is worth warning about once, but logging it every frame
// hides useful combat diagnostics and makes DevTools look like the game is broken.
const mixedSceneTypeWarningUuids = new Set<string>();

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
    if (!mixedSceneTypeWarningUuids.has(object.uuid)) {
      mixedSceneTypeWarningUuids.add(object.uuid);
      log.error(
        `Found mesh with mix of scene types ${object.uuid}: ${[
          ...objScenes,
        ]}. Defaulting to base`
      );
    }
    // HARTHMERE_MIXED_SCENE_TYPE_BASE_FALLBACK_V1
    // Previously this defaulted to "three", which caused BasePassMaterial
    // meshes (player skinned bodies) to render in the single-attachment
    // forward framebuffer instead of the MRT base pass. The fragment shader
    // writes to three layout locations; the single-attachment context only
    // has one → GL_INVALID_OPERATION: glDrawElements: Mismatch between
    // texture format and sampler type → completely broken player rendering.
    // Defaulting to "base" ensures any mesh that contains at least one
    // BasePassMaterial child is sent to SceneBasePass where the MRT context
    // is live.  Non-BasePassMaterial children (e.g. MeshToonMaterial voxel
    // shells) that reach the base pass write only to gl_FragColor (location 0)
    // and leave the normal/depth attachments undefined for those fragments,
    // which is acceptable — the skinned body geometry covers them.
    sceneName = "base";
  }
  addMaterialDependencies(scenes[sceneName], object);
  scenes[sceneName].add(object);
};
