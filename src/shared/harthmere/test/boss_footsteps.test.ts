import {
  advanceHarthmereBossStomp,
  createHarthmereBossStompState,
  harthmereBossStompProfileForEntity,
} from "@/shared/harthmere/boss_footsteps";
import assert from "assert";
import fs from "fs";
import path from "path";

describe("Harthmere giant boss footsteps", () => {
  it("stomps from grounded Alpha Mucker travel, not from idle animation time", () => {
    const profile = harthmereBossStompProfileForEntity(
      "Old Wood Mucker 1",
      8_810_000_000_019_509
    );
    assert.ok(profile);
    const state = createHarthmereBossStompState();
    assert.equal(
      advanceHarthmereBossStomp(state, {
        profile,
        position: [0, 0, 0],
        moving: true,
        alive: true,
        nowSeconds: 0,
      }),
      false
    );
    assert.equal(
      advanceHarthmereBossStomp(state, {
        profile,
        position: [profile.strideMeters - 0.1, 0, 0],
        moving: true,
        alive: true,
        nowSeconds: 1,
      }),
      false
    );
    assert.equal(
      advanceHarthmereBossStomp(state, {
        profile,
        position: [profile.strideMeters + 0.1, 0, 0],
        moving: true,
        alive: true,
        nowSeconds: 1.1,
      }),
      true
    );
    assert.equal(
      advanceHarthmereBossStomp(state, {
        profile,
        position: [profile.strideMeters + 0.1, 0, 0],
        moving: false,
        alive: true,
        nowSeconds: 2,
      }),
      false
    );
  });

  it("does not stomp for hovering bosses and rejects teleport jumps", () => {
    assert.equal(
      harthmereBossStompProfileForEntity(
        "Gravewood Pale Hexer 7",
        8_810_000_000_019_543
      ),
      undefined
    );
    const profile = harthmereBossStompProfileForEntity("Alpha Mucker", 1);
    assert.ok(profile);
    const state = createHarthmereBossStompState();
    advanceHarthmereBossStomp(state, {
      profile,
      position: [0, 0, 0],
      moving: true,
      alive: true,
      nowSeconds: 0,
    });
    assert.equal(
      advanceHarthmereBossStomp(state, {
        profile,
        position: [profile.teleportResetMeters + 1, 0, 0],
        moving: true,
        alive: true,
        nowSeconds: 1,
      }),
      false
    );
    assert.equal(state.distanceSinceStomp, 0);
  });

  it("keeps giant stomps audible across a boss-sized combat arena", () => {
    const profile = harthmereBossStompProfileForEntity(
      "Muck-Scarred Helix",
      undefined
    );
    assert.ok(profile);
    assert.ok(profile.soundVolumeMultiplier >= 3);
    assert.ok(profile.soundRefDistance >= 8);
    assert.ok(profile.soundMaxDistance >= 96);
    assert.ok(profile.soundRolloffFactor > 0);
    assert.ok(profile.soundRolloffFactor <= 1);
  });

  it("routes assigned boss stomps through the gesture-safe sound queue", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/client/game/resources/npcs.ts"),
      "utf8"
    );
    assert.match(
      source,
      /emitHarthmereSoundEffect\(HARTHMERE_GIANT_BOSS_STOMP_SOUND_ID/
    );
    assert.match(source, /idempotent: true/);
    assert.match(source, /volumeMultiplier: profile\.soundVolumeMultiplier/);
    assert.match(source, /refDistance: profile\.soundRefDistance/);
    assert.match(source, /maxDistance: profile\.soundMaxDistance/);
  });
});
