import { terrainReadyForStartup } from "@/client/game/mobile_startup_terrain";
import assert from "assert";

describe("mobile startup terrain readiness", () => {
  it("lets low-memory mobile start from loaded collision terrain", () => {
    assert.equal(
      terrainReadyForStartup({
        lowMemory: true,
        playerShardsLoaded: true,
        playerShardsMeshed: false,
      }),
      true
    );
  });

  it("does not weaken the desktop combined-mesh startup gate", () => {
    assert.equal(
      terrainReadyForStartup({
        lowMemory: false,
        playerShardsLoaded: true,
        playerShardsMeshed: false,
      }),
      false
    );
    assert.equal(
      terrainReadyForStartup({
        lowMemory: false,
        playerShardsLoaded: true,
        playerShardsMeshed: true,
      }),
      true
    );
  });
});
