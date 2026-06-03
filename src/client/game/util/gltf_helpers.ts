import type * as THREE from "three";
import { Mesh } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import {
  coalescedPlayerMeshGltfArrayBufferFetchV1,
  shouldCoalescePlayerMeshGltfFetchV1,
} from "@/client/game/util/gltf_fetch_coalescing_v1";

const loader = new GLTFLoader();

export function loadGltf(url: string) {
  return loader.loadAsync(url);
}

async function defaultPlayerMeshGltfArrayBufferFetchV1(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load GLTF ${url}: ${response.status}`);
  }
  return response.arrayBuffer();
}

export async function loadGltfWithCoalescedNetworkFetchV1(url: string) {
  if (!shouldCoalescePlayerMeshGltfFetchV1(url)) {
    return loadGltf(url);
  }

  const data = await coalescedPlayerMeshGltfArrayBufferFetchV1(
    url,
    defaultPlayerMeshGltfArrayBufferFetchV1
  );
  return parseGltf(data.slice(0));
}

export function parseGltf(data: string | ArrayBuffer) {
  return loader.parseAsync(data, "/");
}

export function gltfToThree(gltf: GLTF): THREE.Group {
  return gltf.scene || gltf.scenes[0];
}

function disposeGroup(group: THREE.Group) {
  group.traverse((x) => {
    if (x instanceof Mesh) {
      if (x.geometry) {
        x.geometry.dispose();
      }
      if (x.material) {
        x.material.dispose();
      }
    }
  });
}

export function gltfDispose(gltf: GLTF) {
  disposeGroup(gltf.scene);
  for (const scene of gltf.scenes) {
    disposeGroup(scene);
  }
}

export const WORLD_TO_VOX_SCALE = 16.0;
