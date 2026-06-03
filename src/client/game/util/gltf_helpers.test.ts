import assert from "assert";
import {
  coalescedPlayerMeshGltfArrayBufferFetchV1,
  shouldCoalescePlayerMeshGltfFetchV1,
} from "@/client/game/util/gltf_fetch_coalescing_v1";

describe("gltf_helpers player mesh fetch coalescing", () => {
  it("recognizes same-origin and absolute player mesh URLs", () => {
    assert.equal(
      shouldCoalescePlayerMeshGltfFetchV1("/api/assets/player_mesh.glb?top=1"),
      true
    );
    assert.equal(
      shouldCoalescePlayerMeshGltfFetchV1(
        "https://www.glitch.fun/api/assets/player_mesh.glb?top=1"
      ),
      true
    );
    assert.equal(
      shouldCoalescePlayerMeshGltfFetchV1("/assets/other.glb"),
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

    const first = coalescedPlayerMeshGltfArrayBufferFetchV1(
      "/api/assets/player_mesh.glb?sc=skin_color_0",
      fetchArrayBuffer
    );
    const second = coalescedPlayerMeshGltfArrayBufferFetchV1(
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
