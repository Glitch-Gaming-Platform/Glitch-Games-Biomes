import {
  ASSET_EXPORTS_SERVER_VERSION,
  makePlayerMeshQueryString,
  parsePlayerMeshUrl,
} from "@/shared/api/assets";
import assert from "assert";
import {
  isPlayerMeshWarmupRequestV1,
  playerMeshSemanticCacheKeyV1,
  shouldRefreshPlayerMeshCacheV1,
  shouldQueuePlayerMeshComputeV1,
  shouldSkipPlayerMeshWarmupV1,
} from "../player_mesh.glb";

describe("player mesh resource guards", () => {
  it("uses the same semantic cache key for bare and explicit starter wearables", () => {
    const bare = parsePlayerMeshUrl(
      `/api/assets/player_mesh.glb?aev=${ASSET_EXPORTS_SERVER_VERSION}`
    );
    const explicit = parsePlayerMeshUrl(
      `/api/assets/player_mesh.glb${makePlayerMeshQueryString([])}`
    );
    assert.equal(bare.kind, "SlotToWearableMapResults");
    assert.equal(explicit.kind, "SlotToWearableMapResults");
    if (
      bare.kind !== "SlotToWearableMapResults" ||
      explicit.kind !== "SlotToWearableMapResults"
    ) {
      throw new Error("unreachable");
    }
    assert.equal(
      playerMeshSemanticCacheKeyV1(bare),
      playerMeshSemanticCacheKeyV1(explicit)
    );
  });

  it("allows omitted cosmetic color params on default mesh requests", () => {
    const bare = parsePlayerMeshUrl(
      `/api/assets/player_mesh.glb?aev=${ASSET_EXPORTS_SERVER_VERSION}`
    );
    assert.equal(bare.kind, "SlotToWearableMapResults");
    if (bare.kind !== "SlotToWearableMapResults") {
      throw new Error("unreachable");
    }
    assert.equal(bare.skinColorId, undefined);
    assert.equal(bare.eyeColorId, undefined);
    assert.equal(bare.hairColorId, undefined);
  });

  it("detects warmup requests", () => {
    assert.equal(isPlayerMeshWarmupRequestV1("Biomes Warmup"), true);
    assert.equal(isPlayerMeshWarmupRequestV1(["Other", "Biomes Warmup"]), true);
    assert.equal(isPlayerMeshWarmupRequestV1("Mozilla"), false);
  });

  it("skips only uncached warmup requests when generation is already busy", () => {
    assert.equal(
      shouldSkipPlayerMeshWarmupV1({
        isWarmup: true,
        hasCached: false,
        activeComputes: 1,
        maxActiveComputes: 1,
      }),
      true
    );
    assert.equal(
      shouldSkipPlayerMeshWarmupV1({
        isWarmup: true,
        hasCached: true,
        activeComputes: 1,
        maxActiveComputes: 1,
      }),
      false
    );
    assert.equal(
      shouldSkipPlayerMeshWarmupV1({
        isWarmup: false,
        hasCached: false,
        activeComputes: 1,
        maxActiveComputes: 1,
      }),
      false
    );
  });

  it("queues uncached mesh generation once the active compute cap is reached", () => {
    assert.equal(
      shouldQueuePlayerMeshComputeV1({
        activeComputes: 2,
        maxActiveComputes: 2,
      }),
      true
    );
    assert.equal(
      shouldQueuePlayerMeshComputeV1({
        activeComputes: 1,
        maxActiveComputes: 2,
      }),
      false
    );
    assert.equal(
      shouldQueuePlayerMeshComputeV1({
        activeComputes: 0,
        maxActiveComputes: 0,
      }),
      false
    );
  });

  it("refreshes cached meshes only when stale or from an old asset export version", () => {
    const cached = {
      assetExportVersion: 10,
      computedAt: 1000,
    };
    assert.equal(
      shouldRefreshPlayerMeshCacheV1({
        cached,
        nowMs: 1500,
        assetExportVersion: 10,
        recomputeIntervalMs: 1000,
      }),
      false
    );
    assert.equal(
      shouldRefreshPlayerMeshCacheV1({
        cached,
        nowMs: 2501,
        assetExportVersion: 10,
        recomputeIntervalMs: 1000,
      }),
      true
    );
    assert.equal(
      shouldRefreshPlayerMeshCacheV1({
        cached,
        nowMs: 1500,
        assetExportVersion: 11,
        recomputeIntervalMs: 1000,
      }),
      true
    );
  });
});
