/// <reference types="mocha" />
import { HarthmereLiveCreatureRespawnRegistryV1 } from "@/shared/harthmere/live_creature_respawn_registry_v1";
import { HARTHMERE_LIVE_CREATURE_RESPAWN_MIN_MS_V1 } from "@/shared/harthmere/live_creature_render_v1";
import assert from "assert";

describe("HarthmereLiveCreatureRespawnRegistryV1", () => {
  it("suppresses a killed creature until its respawn time", () => {
    const reg = new HarthmereLiveCreatureRespawnRegistryV1<number>();
    const now = 1_000_000;
    const respawnAt = reg.recordKill(7, now, () => 0); // min delay
    assert.equal(respawnAt, now + HARTHMERE_LIVE_CREATURE_RESPAWN_MIN_MS_V1);
    assert.equal(reg.isSuppressed(7, now), true);
    assert.equal(reg.isSuppressed(7, respawnAt - 1), true);
  });

  it("lets a creature respawn once the window elapses and forgets it", () => {
    const reg = new HarthmereLiveCreatureRespawnRegistryV1<number>();
    const now = 0;
    const respawnAt = reg.recordKill(3, now, () => 0);
    assert.equal(reg.isSuppressed(3, respawnAt), false);
    assert.equal(reg.size, 0, "record cleared after respawn");
    assert.equal(reg.isSuppressed(3, respawnAt + 5), false);
  });

  it("never suppresses creatures that were not killed", () => {
    const reg = new HarthmereLiveCreatureRespawnRegistryV1<number>();
    assert.equal(reg.isSuppressed(99, 12345), false);
  });

  it("reports the suppressed id set and prunes elapsed ones", () => {
    const reg = new HarthmereLiveCreatureRespawnRegistryV1<number>();
    reg.recordKill(1, 0, () => 0); // respawn at +30min
    reg.recordKill(2, 0, () => 1); // respawn at +60min
    const at40min = 40 * 60 * 1000;
    assert.deepEqual(reg.suppressedIds(at40min), [2]);
    reg.pruneElapsed(at40min);
    assert.equal(reg.size, 1);
  });

  it("can force-clear a creature back to life", () => {
    const reg = new HarthmereLiveCreatureRespawnRegistryV1<number>();
    reg.recordKill(5, 0, () => 0);
    reg.clear(5);
    assert.equal(reg.isSuppressed(5, 1), false);
  });
});
