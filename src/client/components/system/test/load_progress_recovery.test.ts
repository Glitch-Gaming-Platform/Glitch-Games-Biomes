import type { LoadProgress } from "@/client/game/load_progress";
import { emptyChannelStats } from "@/shared/zrpc/core";
import assert from "assert";
import { shouldAutoReloadForPartialTerrainRecovery } from "../load_progress_recovery";

function progress(overrides: Partial<LoadProgress> = {}): LoadProgress {
  return {
    startedLoading: true,
    earlyContextLoader: { loaded: true } as any,
    channelStats: { ...emptyChannelStats(), status: "ready" },
    bootstrapped: true,
    entitiesLoaded: 1200,
    playerMeshLoaded: true,
    terrainMeshLoaded: false,
    sceneRendered: 0,
    ...overrides,
  };
}

describe("partial terrain load recovery", () => {
  it("reloads a stale bootstrapped client that never meshed terrain", () => {
    assert.equal(
      shouldAutoReloadForPartialTerrainRecovery({
        progress: progress(),
        alreadyReloaded: false,
      }),
      true
    );
  });

  it("does not reload before bootstrap/player mesh or after a recovery reload", () => {
    assert.equal(
      shouldAutoReloadForPartialTerrainRecovery({
        progress: progress({ bootstrapped: false }),
      }),
      false
    );
    assert.equal(
      shouldAutoReloadForPartialTerrainRecovery({
        progress: progress({ playerMeshLoaded: false }),
      }),
      false
    );
    assert.equal(
      shouldAutoReloadForPartialTerrainRecovery({
        progress: progress(),
        alreadyReloaded: true,
      }),
      false
    );
  });
});
