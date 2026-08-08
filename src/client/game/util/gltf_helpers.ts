import type * as THREE from "three";
import { Mesh } from "three";
import { MeshoptDecoder } from "meshoptimizer/decoder";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import {
  coalescedPlayerMeshGltfArrayBufferFetch,
  shouldCoalescePlayerMeshGltfFetch,
} from "@/client/game/util/gltf_fetch_coalescing";
import { resolveHarthmereAssetUrl } from "@/shared/harthmere/galois_asset_paths";
import { log } from "@/shared/logging";

export const KTX2_TRANSCODER_PATH = "/three/basis/";

const managedLoaders = new Set<GLTFLoader>();
let ktx2Loader: KTX2Loader | undefined;

export function createGltfLoader(manager?: THREE.LoadingManager) {
  const loader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
  if (ktx2Loader) {
    loader.setKTX2Loader(ktx2Loader);
  }
  managedLoaders.add(loader);
  return loader;
}

// KTX2 support depends on renderer extension detection, so it cannot be
// initialized at module load time. The game renderer calls this immediately
// after its WebGL2 context is validated, before resource loading begins.
// Ordinary PNG/JPEG glTF textures continue to work if initialization fails.
export function configureGltfTextureTranscoding(renderer: THREE.WebGLRenderer) {
  if (ktx2Loader) {
    return true;
  }

  const candidate = new KTX2Loader()
    .setTranscoderPath(KTX2_TRANSCODER_PATH)
    .setWorkerLimit(2);
  try {
    candidate.detectSupport(renderer);
    ktx2Loader = candidate;
    for (const managedLoader of managedLoaders) {
      managedLoader.setKTX2Loader(candidate);
    }
    return true;
  } catch (error) {
    candidate.dispose();
    log.warn(
      "KTX2/Basis texture transcoding is unavailable; retaining standard GLTF texture loading",
      { error }
    );
    return false;
  }
}

const loader = createGltfLoader();

export function loadGltf(url: string) {
  return loader.loadAsync(resolveHarthmereAssetUrl(url));
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
  const resolvedUrl = resolveHarthmereAssetUrl(url);
  if (!shouldCoalescePlayerMeshGltfFetch(resolvedUrl)) {
    return loader.loadAsync(resolvedUrl);
  }

  const data = await coalescedPlayerMeshGltfArrayBufferFetch(
    resolvedUrl,
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
