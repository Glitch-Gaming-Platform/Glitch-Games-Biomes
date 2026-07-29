import type { LoadProgress } from "@/client/game/load_progress";
import {
  armPartialTerrainRecovery,
  clearPartialTerrainRecoveryMarker,
  hasPartialTerrainRecoveryMarker,
  shouldAutoReloadForPartialTerrainRecovery,
} from "@/client/components/system/load_progress_recovery";
import { emptyChannelStats } from "@/shared/zrpc/core";
import assert from "assert";

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

  it("arms once per tab and clears the marker after a successful load", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };

    assert.equal(hasPartialTerrainRecoveryMarker(storage), false);
    assert.equal(armPartialTerrainRecovery(storage), true);
    assert.equal(hasPartialTerrainRecoveryMarker(storage), true);
    assert.equal(armPartialTerrainRecovery(storage), false);
    clearPartialTerrainRecoveryMarker(storage);
    assert.equal(hasPartialTerrainRecoveryMarker(storage), false);
  });

  it("fails closed when an embedded browser blocks session storage", () => {
    const blockedStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };

    assert.equal(hasPartialTerrainRecoveryMarker(blockedStorage), false);
    assert.equal(armPartialTerrainRecovery(blockedStorage), false);
    assert.doesNotThrow(() =>
      clearPartialTerrainRecoveryMarker(blockedStorage)
    );
  });
});
