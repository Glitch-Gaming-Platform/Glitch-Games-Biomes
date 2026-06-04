/// <reference types="mocha" />

import assert from "assert";

import { resolveHarthmereEscortFollowStepV151 } from "@/shared/harthmere/harthmere_escort_follower_v151";

const flatGround = (_x: number, _z: number, y: number) => 53;

describe("resolveHarthmereEscortFollowStepV151 — escort follower AI", () => {
  it("steps toward the player when too far behind, capped by stepMax", () => {
    const out = resolveHarthmereEscortFollowStepV151({
      followerPosition: [0, 53, 0],
      playerPosition: [10, 53, 0],
      destination: [100, 53, 0],
      stepMaxMeters: 0.5,
      groundYAt: flatGround,
    });
    assert.equal(out.phase, "following");
    // moved ~0.5m toward the player along +x
    assert.ok(out.position[0] > 0.4 && out.position[0] < 0.6, `${out.position[0]}`);
    assert.equal(out.arrived, false);
  });

  it("holds position when already within follow distance", () => {
    const out = resolveHarthmereEscortFollowStepV151({
      followerPosition: [9, 53, 0],
      playerPosition: [10, 53, 0],
      destination: [100, 53, 0],
      followDistance: 2.2,
      groundYAt: flatGround,
    });
    assert.equal(out.position[0], 9);
    assert.equal(out.teleported, false);
  });

  it("arrives (and stops) once within the destination radius — even if the player is far", () => {
    const out = resolveHarthmereEscortFollowStepV151({
      followerPosition: [99, 53, 0],
      playerPosition: [10, 53, 0],
      destination: [100, 53, 0],
      arriveRadius: 2.5,
      groundYAt: flatGround,
    });
    assert.equal(out.phase, "arrived");
    assert.equal(out.arrived, true);
    assert.deepEqual(out.position, [100, 53, 0]);
  });

  it("leash-catches-up when the player outruns the follower", () => {
    const out = resolveHarthmereEscortFollowStepV151({
      followerPosition: [0, 53, 0],
      playerPosition: [200, 53, 0],
      destination: [500, 53, 0],
      leashRadius: 24,
      followDistance: 2.2,
      groundYAt: flatGround,
    });
    assert.equal(out.teleported, true);
    // Caught up to ~followDistance behind the player (player at x=200).
    assert.ok(out.distanceToPlayer <= 2.5, `${out.distanceToPlayer}`);
  });

  it("grounds the follower to the real surface (never floating/buried)", () => {
    const out = resolveHarthmereEscortFollowStepV151({
      followerPosition: [0, 99, 0], // authored high (floating)
      playerPosition: [10, 14, 0],
      destination: [100, 14, 0],
      groundYAt: (_x, _z, _y) => 14, // real surface in the breach
    });
    assert.equal(out.position[1], 14, "follower snapped to the real surface Y");
  });

  it("keeps the previous Y when terrain is not loaded (sampler returns undefined)", () => {
    const out = resolveHarthmereEscortFollowStepV151({
      followerPosition: [0, 53, 0],
      playerPosition: [10, 53, 0],
      destination: [100, 53, 0],
      groundYAt: () => undefined,
    });
    assert.equal(out.position[1], 53);
  });

  it("fails when the escorted NPC is killed", () => {
    const out = resolveHarthmereEscortFollowStepV151({
      followerPosition: [5, 53, 5],
      playerPosition: [10, 53, 0],
      destination: [100, 53, 0],
      escortedNpcDefeated: true,
      groundYAt: flatGround,
    });
    assert.equal(out.phase, "failed");
    assert.equal(out.failed, true);
    assert.equal(out.arrived, false);
  });

  it("holds and reports idle on non-finite inputs (no NaN)", () => {
    const out = resolveHarthmereEscortFollowStepV151({
      followerPosition: [5, 53, 5],
      playerPosition: [Number.NaN, 53, 0],
      destination: [100, 53, 0],
    });
    assert.equal(out.phase, "idle");
    assert.deepEqual(out.position, [5, 53, 5]);
    assert.ok(Number.isFinite(out.position[0]));
  });
});
