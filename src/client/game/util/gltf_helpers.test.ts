import assert from "assert";
import {
  coalescedPlayerMeshGltfArrayBufferFetch,
  shouldCoalescePlayerMeshGltfFetch,
} from "@/client/game/util/gltf_fetch_coalescing";

describe("gltf_helpers player mesh fetch coalescing", () => {
  it("recognizes same-origin and absolute player mesh URLs", () => {
    assert.equal(
      shouldCoalescePlayerMeshGltfFetch("/api/assets/player_mesh.glb?top=1"),
      true
    );
    assert.equal(
      shouldCoalescePlayerMeshGltfFetch(
        "https://www.glitch.fun/api/assets/player_mesh.glb?top=1"
      ),
      true
    );
    assert.equal(
      shouldCoalescePlayerMeshGltfFetch("/assets/other.glb"),
      false
    );
  });

  it("coalesces concurrent player mesh ArrayBuffer fetches", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let fetchCount = 0;
    const fetchArrayBuffer = async () => {
      fetchCount += 1;
      await gate;
      return new Uint8Array([1, 2, 3]).buffer;
    };

    const first = coalescedPlayerMeshGltfArrayBufferFetch(
      "/api/assets/player_mesh.glb?sc=skin_color_0",
      fetchArrayBuffer
    );
    const second = coalescedPlayerMeshGltfArrayBufferFetch(
      "/api/assets/player_mesh.glb?sc=skin_color_0",
      fetchArrayBuffer
    );
    release?.();

    const [firstBuffer, secondBuffer] = await Promise.all([first, second]);
    assert.equal(fetchCount, 1);
    assert.deepEqual(Array.from(new Uint8Array(firstBuffer)), [1, 2, 3]);
    assert.deepEqual(Array.from(new Uint8Array(secondBuffer)), [1, 2, 3]);
  });
});
