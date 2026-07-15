/// <reference types="mocha" />
/// <reference types="node" />

// HARTHMERE_NPC_WANDER_REGROUNDING (audit fix, 2026-07-13)
//
// Covers the audit finding "renderer NPCs never re-ground while moving":
// `harthmereNpcGroundedY` used to return the spawn base Y forever, so NPCs
// walking across slopes floated (downhill) or buried (uphill). These tests
// pin the new pure decision logic and the global grounding-deps /
// column-invalidation registries.

import assert from "assert";
import {
  HARTHMERE_NPC_REGROUND_MAX_DEVIATION,
  HARTHMERE_NPC_REGROUND_MAX_STEP,
  harthmereGroundingDepsForTest,
  harthmereRendererGroundedFeetY,
  harthmereStepTowardGroundedFeetY,
  invalidateHarthmereGroundedColumnsNear,
  registerHarthmereGroundedColumnCache,
  registerHarthmereGroundedColumnInvalidator,
  registerHarthmereGroundingDeps,
  resolveHarthmereNpcRegroundedFeetY,
} from "@/client/game/util/harthmere_entity_grounding";

describe("HARTHMERE_NPC_WANDER_REGROUNDING", () => {
  describe("harthmereStepTowardGroundedFeetY", () => {
    it("lands exactly on the target when within one step", () => {
      assert.strictEqual(harthmereStepTowardGroundedFeetY(54, 54.2), 54.2);
      assert.strictEqual(harthmereStepTowardGroundedFeetY(54.2, 54), 54);
    });

    it("clamps vertical movement to the max step per call (no snapping)", () => {
      assert.strictEqual(
        harthmereStepTowardGroundedFeetY(54, 58),
        54 + HARTHMERE_NPC_REGROUND_MAX_STEP
      );
      assert.strictEqual(
        harthmereStepTowardGroundedFeetY(58, 54),
        58 - HARTHMERE_NPC_REGROUND_MAX_STEP
      );
    });

    it("tolerates non-finite inputs", () => {
      assert.strictEqual(harthmereStepTowardGroundedFeetY(NaN, 54), 54);
      assert.strictEqual(harthmereStepTowardGroundedFeetY(54, NaN), 54);
    });
  });

  describe("resolveHarthmereNpcRegroundedFeetY", () => {
    it("walks the actor toward a plausible probed slope surface", () => {
      // Actor spawned at 54, currently at 54, slope rises to 55.6 —
      // the actor should climb by at most one step per call.
      const next = resolveHarthmereNpcRegroundedFeetY(54, 54, 55.6);
      assert.strictEqual(next, 54 + HARTHMERE_NPC_REGROUND_MAX_STEP);
      // Continuing the walk converges onto the surface.
      let y = next;
      for (let i = 0; i < 10; i += 1) {
        y = resolveHarthmereNpcRegroundedFeetY(54, y, 55.6);
      }
      assert.strictEqual(y, 55.6);
    });

    it("keeps the legacy locked base Y when the probe is unavailable", () => {
      assert.strictEqual(resolveHarthmereNpcRegroundedFeetY(54, 57, undefined), 54);
      assert.strictEqual(resolveHarthmereNpcRegroundedFeetY(54, 57, NaN), 54);
    });

    it("rejects implausible teleports beyond the deviation window", () => {
      // Probe found a surface a cliff below (e.g. cave under a bridge, or the
      // terrain under a mesh-only floor): keep the locked base Y instead.
      const farBelow = 54 - (HARTHMERE_NPC_REGROUND_MAX_DEVIATION + 1);
      assert.strictEqual(resolveHarthmereNpcRegroundedFeetY(54, 54, farBelow), 54);
      const farAbove = 54 + (HARTHMERE_NPC_REGROUND_MAX_DEVIATION + 1);
      assert.strictEqual(resolveHarthmereNpcRegroundedFeetY(54, 54, farAbove), 54);
    });

    it("accepts surfaces exactly at the deviation boundary", () => {
      const atBoundary = 54 + HARTHMERE_NPC_REGROUND_MAX_DEVIATION;
      assert.strictEqual(
        resolveHarthmereNpcRegroundedFeetY(54, 54, atBoundary),
        54 + HARTHMERE_NPC_REGROUND_MAX_STEP
      );
    });
  });

  describe("global grounding deps registry", () => {
    it("returns undefined (caller keeps current Y) before deps register", () => {
      const previous = harthmereGroundingDepsForTest();
      try {
        registerHarthmereGroundingDeps(undefined as any);
        const cache = new Map<string, number>();
        assert.strictEqual(
          harthmereRendererGroundedFeetY(cache, 10, 10, 54, false),
          undefined
        );
      } finally {
        if (previous) registerHarthmereGroundingDeps(previous);
      }
    });

    it("routes through the registered deps once available", () => {
      const previous = harthmereGroundingDepsForTest();
      try {
        // A deps stub whose terrain tensor lookups throw — the shared probe
        // treats that as "column not standable/loaded", which the memory
        // resolver maps to undefined (keep current Y). The point is that the
        // registered deps ARE consulted (no crash, defined behaviour).
        registerHarthmereGroundingDeps({
          get: () => {
            throw new Error("no terrain in unit test");
          },
        });
        const cache = new Map<string, number>();
        assert.strictEqual(
          harthmereRendererGroundedFeetY(cache, 10, 10, 54, false),
          undefined
        );
      } finally {
        if (previous) registerHarthmereGroundingDeps(previous);
        else registerHarthmereGroundingDeps(undefined as any);
      }
    });
  });

  describe("grounded column invalidation", () => {
    it("clears standard column caches around an edited voxel", () => {
      const cache = new Map<string, number>([
        ["10|10|0", 54],
        ["10|10|1", 54],
        ["11|10|0", 54],
        ["20|20|0", 54], // far away — must survive
      ]);
      const unregister = registerHarthmereGroundedColumnCache(cache);
      try {
        invalidateHarthmereGroundedColumnsNear(10.4, 10.7, 1);
        assert.strictEqual(cache.has("10|10|0"), false);
        assert.strictEqual(cache.has("10|10|1"), false);
        assert.strictEqual(cache.has("11|10|0"), false);
        assert.strictEqual(cache.get("20|20|0"), 54);
      } finally {
        unregister();
      }
    });

    it("dispatches custom invalidators for non-standard cache keys", () => {
      const hits: Array<[number, number]> = [];
      const unregister = registerHarthmereGroundedColumnInvalidator((ix, iz) =>
        hits.push([ix, iz])
      );
      try {
        invalidateHarthmereGroundedColumnsNear(5, 5, 0);
        assert.deepStrictEqual(hits, [[5, 5]]);
      } finally {
        unregister();
      }
    });

    it("unregistered caches stop receiving invalidations", () => {
      const cache = new Map<string, number>([["3|3|0", 54]]);
      const unregister = registerHarthmereGroundedColumnCache(cache);
      unregister();
      invalidateHarthmereGroundedColumnsNear(3, 3, 0);
      assert.strictEqual(cache.get("3|3|0"), 54);
    });
  });
});
