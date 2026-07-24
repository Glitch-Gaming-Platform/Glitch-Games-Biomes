const playerMeshGltfFetchInflight = new Map<string, Promise<ArrayBuffer>>();
const PLAYER_MESH_GLTF_MAX_ACTIVE_FETCHES = 4;
let playerMeshGltfActiveFetches = 0;
const playerMeshGltfFetchWaiters: Array<() => void> = [];

export async function retryPlayerMeshGltfLoad<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; delayMs?: number } = {}
) {
  const attempts = Math.max(1, Math.trunc(options.attempts ?? 3));
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts && (options.delayMs ?? 150) > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, options.delayMs ?? 150);
        });
      }
    }
  }
  throw lastError;
}

async function withPlayerMeshGltfFetchSlot<T>(operation: () => Promise<T>) {
  if (playerMeshGltfActiveFetches >= PLAYER_MESH_GLTF_MAX_ACTIVE_FETCHES) {
    await new Promise<void>((resolve) => {
      playerMeshGltfFetchWaiters.push(resolve);
    });
  }
  playerMeshGltfActiveFetches += 1;
  try {
    return await operation();
  } finally {
    playerMeshGltfActiveFetches = Math.max(0, playerMeshGltfActiveFetches - 1);
    playerMeshGltfFetchWaiters.shift()?.();
  }
}

export function shouldCoalescePlayerMeshGltfFetch(url: string) {
  try {
    const base =
      typeof window !== "undefined" && typeof window.location?.href === "string"
        ? window.location.href
        : "https://biomes.local";
    const parsed = new URL(url, base);
    return parsed.pathname === "/api/assets/player_mesh.glb";
  } catch {
    return url.startsWith("/api/assets/player_mesh.glb");
  }
}

export async function coalescedPlayerMeshGltfArrayBufferFetch(
  url: string,
  fetchArrayBuffer: (url: string) => Promise<ArrayBuffer>
) {
  let inflight = playerMeshGltfFetchInflight.get(url);
  if (!inflight) {
    // The HAR showed 70 distinct generated NPC/player meshes starting together.
    // Each local mesh build is CPU-heavy; allowing the browser to flood all of
    // them at once starved terrain meshing and even the sync keepalive. Keep a
    // small client queue while still coalescing identical semantic mesh URLs.
    inflight = withPlayerMeshGltfFetchSlot(() => fetchArrayBuffer(url));
    playerMeshGltfFetchInflight.set(url, inflight);
    void inflight.then(
      () => {
        if (playerMeshGltfFetchInflight.get(url) === inflight) {
          playerMeshGltfFetchInflight.delete(url);
        }
      },
      () => {
        if (playerMeshGltfFetchInflight.get(url) === inflight) {
          playerMeshGltfFetchInflight.delete(url);
        }
      }
    );
  }

  return inflight;
}

export function resetPlayerMeshGltfFetchStateForTest() {
  playerMeshGltfFetchInflight.clear();
  playerMeshGltfActiveFetches = 0;
  playerMeshGltfFetchWaiters.splice(0);
}
