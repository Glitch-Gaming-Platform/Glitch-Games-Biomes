import type * as THREE from "three";
import { Mesh } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import {
  coalescedPlayerMeshGltfArrayBufferFetch,
  shouldCoalescePlayerMeshGltfFetch,
} from "@/client/game/util/gltf_fetch_coalescing";

const loader = new GLTFLoader();

export function loadGltf(url: string) {
  return loader.loadAsync(url);
}

export async function loadGltfWithRetry(
  url: string,
  options: {
    attempts?: number;
    delayMs?: number;
    load?: (url: string) => Promise<GLTF>;
  } = {}
) {
  const attempts = Math.max(1, Math.trunc(options.attempts ?? 2));
  const load = options.load ?? loadGltf;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await load(url);
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts && (options.delayMs ?? 250) > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, options.delayMs ?? 250);
        });
      }
    }
  }
  throw lastError;
}

async function defaultPlayerMeshGltfArrayBufferFetch(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load GLTF ${url}: ${response.status}`);
  }
  return response.arrayBuffer();
}

export async function loadGltfWithCoalescedNetworkFetch(url: string) {
  if (!shouldCoalescePlayerMeshGltfFetch(url)) {
    return loadGltf(url);
  }

  const data = await coalescedPlayerMeshGltfArrayBufferFetch(
    url,
    defaultPlayerMeshGltfArrayBufferFetch
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
