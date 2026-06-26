const playerMeshGltfFetchInflight = new Map<string, Promise<ArrayBuffer>>();

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
