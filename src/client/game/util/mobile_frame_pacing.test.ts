/// <reference types="mocha" />
// HARTHMERE_MOBILE_FRAME_CAP (2026-08-04 mobile audit, item 4).
import {
  MOBILE_RENDER_FPS_CAP,
  renderFpsCapForDevice,
  shouldRenderFrame,
} from "@/client/game/util/mobile_frame_pacing";
import assert from "assert";

describe("mobile frame pacing", () => {
  it("never caps a non-mobile client", () => {
    assert.equal(renderFpsCapForDevice(false), undefined);
    assert.equal(renderFpsCapForDevice(true), MOBILE_RENDER_FPS_CAP);
  });

  it("renders every frame when there is no cap", () => {
    // This is the desktop path and must be indistinguishable from the previous
    // unconditional `renderFrame()` call.
    for (const elapsed of [0, 1, 8, 16, 1000]) {
      assert.ok(
        shouldRenderFrame({
          nowMs: elapsed,
          lastRenderAtMs: 0,
          targetFps: undefined,
        })
      );
    }
  });

  it("renders the first frame and after a loop restart", () => {
    assert.ok(
      shouldRenderFrame({ nowMs: 0, lastRenderAtMs: undefined, targetFps: 30 })
    );
  });

  it("yields every other frame on a 60Hz display", () => {
    // The slack exists precisely for this: a strict `>= 33.33` test rejects the
    // 33.34ms frame on some clocks and degenerates a 30 FPS cap into 20 FPS.
    const cap = MOBILE_RENDER_FPS_CAP;
    assert.equal(
      shouldRenderFrame({ nowMs: 16.67, lastRenderAtMs: 0, targetFps: cap }),
      false
    );
    assert.ok(
      shouldRenderFrame({ nowMs: 33.34, lastRenderAtMs: 0, targetFps: cap })
    );
  });

  it("does not admit two frames inside one interval on a 120Hz display", () => {
    const cap = MOBILE_RENDER_FPS_CAP;
    for (const nowMs of [8.33, 16.67, 25.0]) {
      assert.equal(
        shouldRenderFrame({ nowMs, lastRenderAtMs: 0, targetFps: cap }),
        false,
        `${nowMs}ms is inside the 33.3ms interval`
      );
    }
    assert.ok(
      shouldRenderFrame({ nowMs: 33.33, lastRenderAtMs: 0, targetFps: cap })
    );
  });

  it("recovers from a non-monotonic clock instead of stalling", () => {
    assert.ok(
      shouldRenderFrame({ nowMs: 5, lastRenderAtMs: 1000, targetFps: 30 })
    );
  });

  it("treats a nonsense target as uncapped", () => {
    for (const targetFps of [0, -1, NaN, Infinity]) {
      assert.ok(
        shouldRenderFrame({ nowMs: 1, lastRenderAtMs: 0, targetFps }),
        `${targetFps} should not gate rendering`
      );
    }
  });
});
