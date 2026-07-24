import assert from "assert";
import {
  coalescedPlayerMeshGltfArrayBufferFetch,
  resetPlayerMeshGltfFetchStateForTest,
  retryPlayerMeshGltfLoad,
  shouldCoalescePlayerMeshGltfFetch,
} from "@/client/game/util/gltf_fetch_coalescing";

describe("gltf_helpers player mesh fetch coalescing", () => {
  beforeEach(() => resetPlayerMeshGltfFetchStateForTest());

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
    assert.equal(shouldCoalescePlayerMeshGltfFetch("/assets/other.glb"), false);
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

  it("limits distinct player mesh requests so terrain and sync work keep CPU time", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let active = 0;
    let maxActive = 0;
    const fetchArrayBuffer = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await gate;
      active -= 1;
      return new ArrayBuffer(0);
    };
    const requests = Array.from({ length: 8 }, (_unused, index) =>
      coalescedPlayerMeshGltfArrayBufferFetch(
        `/api/assets/player_mesh.glb?npc=${index}`,
        fetchArrayBuffer
      )
    );
    await Promise.resolve();
    assert.equal(active, 4);
    assert.equal(maxActive, 4);

    release?.();
    await Promise.all(requests);
    assert.equal(maxActive, 4);
  });

  it("retries transient player mesh load and parse failures", async () => {
    let attempts = 0;
    const expected = { scene: {} } as any;
    const loaded = await retryPlayerMeshGltfLoad(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error("transient GLB failure");
        }
        return expected;
      },
      { attempts: 3, delayMs: 0 }
    );

    assert.equal(attempts, 3);
    assert.equal(loaded, expected);
  });
});
