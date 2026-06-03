const playerMeshGltfFetchInflight = new Map<string, Promise<ArrayBuffer>>();

export function shouldCoalescePlayerMeshGltfFetchV1(url: string) {
  try {
    const parsed =
      typeof window === "undefined"
        ? new URL(url, "https://biomes.local")
        : new URL(url, window.location.href);
    return parsed.pathname === "/api/assets/player_mesh.glb";
  } catch {
    return url.startsWith("/api/assets/player_mesh.glb");
  }
}

export async function coalescedPlayerMeshGltfArrayBufferFetchV1(
  url: string,
  fetchArrayBuffer: (url: string) => Promise<ArrayBuffer>
) {
  let inflight = playerMeshGltfFetchInflight.get(url);
  if (!inflight) {
    inflight = fetchArrayBuffer(url);
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
