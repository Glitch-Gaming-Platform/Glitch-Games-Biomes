/// <reference types="mocha" />
import {
  MAX_OVERLAY_OCCLUSION_MARCHES_PER_FRAME,
  OverlayOcclusionRefreshQueue,
  overlayProjectionsEqual,
} from "@/client/game/scripts/overlay_frame_budget";
import assert from "assert";

// HARTHMERE_OVERLAY_OCCLUSION_BUDGET / HARTHMERE_OVERLAY_PROJECTION_INVALIDATION
//
// `OverlayScript.tick` runs on every frame and rebuilds the whole overlay map.
// A captured production session (2026-08-03, Apple M1 Max, GPU benchmark 556
// FPS) ran at 2-14 FPS with a continuous stream of
// `[Violation] 'requestAnimationFrame' handler took <N>ms`, while the client
// table held 2932 positioned entities. The two costs that scaled with that
// count were an unbounded number of per-frame voxel raycasts and an
// unconditional React invalidation.
//
describe("overlay script frame budget", () => {
  it("drains dense overlay work fairly across frames without starvation", () => {
    const queue = new OverlayOcclusionRefreshQueue();
    for (let i = 0; i < 60; i += 1) {
      queue.request({
        key: `target:${i}`,
        camKey: "camera",
        pos: [i, 0, 0],
        camPos: [0, 0, 0],
        requestedAt: 0,
      });
    }

    const first = queue.take(MAX_OVERLAY_OCCLUSION_MARCHES_PER_FRAME);
    const second = queue.take(MAX_OVERLAY_OCCLUSION_MARCHES_PER_FRAME);
    const third = queue.take(MAX_OVERLAY_OCCLUSION_MARCHES_PER_FRAME);
    assert.deepEqual(
      first.map(({ key }) => key),
      Array.from({ length: 24 }, (_, i) => `target:${i}`)
    );
    assert.deepEqual(
      second.map(({ key }) => key),
      Array.from({ length: 24 }, (_, i) => `target:${i + 24}`)
    );
    assert.deepEqual(
      third.map(({ key }) => key),
      Array.from({ length: 12 }, (_, i) => `target:${i + 48}`)
    );
    assert.equal(queue.pendingCount, 0);
  });

  it("deduplicates a stale target while retaining its newest camera sample", () => {
    const queue = new OverlayOcclusionRefreshQueue();
    queue.request({
      key: "same",
      camKey: "old",
      pos: [1, 0, 0],
      camPos: [0, 0, 0],
      requestedAt: 1,
    });
    queue.request({
      key: "same",
      camKey: "new",
      pos: [2, 0, 0],
      camPos: [1, 0, 0],
      requestedAt: 2,
    });
    assert.equal(queue.pendingCount, 1);
    assert.deepEqual(queue.take(1)[0], {
      key: "same",
      camKey: "new",
      pos: [2, 0, 0],
      camPos: [1, 0, 0],
      requestedAt: 2,
    });
  });

  it("reuses a fresh cached answer and invalidates it when the camera moves", () => {
    const queue = new OverlayOcclusionRefreshQueue();
    const refresh = {
      key: "target",
      camKey: "camera-a",
      pos: [1, 0, 0] as const,
      camPos: [0, 0, 0] as const,
      requestedAt: 0,
    };
    queue.commit(refresh, true, 10);
    assert.deepEqual(queue.read("target", "camera-a", 50), {
      occluded: true,
      fresh: true,
    });
    assert.deepEqual(queue.read("target", "camera-b", 50), {
      occluded: true,
      fresh: false,
    });
  });

  it("does not republish projection changes below the visual threshold", () => {
    const before = new Map([
      ["npc", { loc: [100, 200, 0.2], proximity: 0.5 }],
    ]) as any;
    const subpixel = new Map([
      ["npc", { loc: [100.4, 199.7, 0.2], proximity: 0.505 }],
    ]) as any;
    const moved = new Map([
      ["npc", { loc: [101, 200, 0.2], proximity: 0.5 }],
    ]) as any;
    assert.equal(overlayProjectionsEqual(before, subpixel), true);
    assert.equal(overlayProjectionsEqual(before, moved), false);
  });
});
