import type { LoadProgress } from "@/client/game/load_progress";
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
