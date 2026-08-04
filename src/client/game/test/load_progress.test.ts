import type { LoadProgress } from "@/client/game/load_progress";
import {
  hasLocalDevStarterTerrain,
  LOCAL_DEV_TERRAIN_ID_BASE,
  localDevStarterTerrainIdsNearPositionForTest,
} from "@/client/game/local_dev_starter_terrain";
import {
  REQUIRED_FRAMES,
  progressSummary,
} from "@/client/game/load_progress_summary";
import { emptyChannelStats } from "@/shared/zrpc/core";
import assert from "assert";

function progress(overrides: Partial<LoadProgress> = {}): LoadProgress {
  return {
    startedLoading: true,
    earlyContextLoader: { loaded: true } as any,
    channelStats: { ...emptyChannelStats(), status: "ready" },
    bootstrapped: true,
    entitiesLoaded: 1000,
    playerMeshLoaded: true,
    terrainMeshLoaded: true,
    sceneRendered: REQUIRED_FRAMES,
    ...overrides,
  };
}

describe("load progress", () => {
  it("recognizes local starter terrain in an exact production build", () => {
    const context = {
      table: {
        has: (id: number) => id === LOCAL_DEV_TERRAIN_ID_BASE,
      },
    } as any;
    assert.equal(hasLocalDevStarterTerrain(context), true);
    assert.equal(
      hasLocalDevStarterTerrain({ table: { has: () => false } } as any),
      false
    );
  });

  it("recognizes the current or retired additive terrain shard under the player", () => {
    const position = [2103, 53, -270] as const;
    const nearbyIds = localDevStarterTerrainIdsNearPositionForTest(position);
    assert.ok(nearbyIds.length >= 2);
    for (const terrainId of nearbyIds) {
      assert.equal(
        hasLocalDevStarterTerrain({
          table: { has: (id) => id === terrainId },
          playerPosition: position,
        }),
        true,
        `expected nearby additive terrain id ${terrainId} to unblock startup`
      );
    }
  });

  it("does not scan unrelated additive terrain when the player is outside its bounds", () => {
    assert.deepEqual(
      localDevStarterTerrainIdsNearPositionForTest([500, 53, -200]),
      []
    );
  });

  it("does not keep a bootstrapped rendered client on the loading screen for a quiet socket", () => {
    assert.equal(
      progressSummary(
        progress({
          channelStats: { ...emptyChannelStats(), status: "unhealthy" },
        })
      ),
      "ready"
    );
  });

  it("still treats unhealthy sockets as connection trouble before bootstrap", () => {
    assert.equal(
      progressSummary(
        progress({
          channelStats: { ...emptyChannelStats(), status: "unhealthy" },
          bootstrapped: false,
        })
      ),
      "problems_connecting"
    );
  });

  it("continues normal load gates after bootstrap when the socket is quiet", () => {
    assert.equal(
      progressSummary(
        progress({
          channelStats: { ...emptyChannelStats(), status: "unhealthy" },
          terrainMeshLoaded: false,
        })
      ),
      "terrain_meshing"
    );
  });
});
