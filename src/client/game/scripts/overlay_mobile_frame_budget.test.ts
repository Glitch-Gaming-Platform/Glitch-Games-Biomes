import {
  MOBILE_OVERLAY_EMERGENCY_REFRESH_INTERVAL_MS,
  MOBILE_OVERLAY_REFRESH_INTERVAL_MS,
  mobileOverlayRefreshIntervalForFrameGap,
  shouldRefreshOverlayFrame,
} from "@/client/game/scripts/overlay_frame_budget";
import assert from "assert";

describe("mobile overlay frame budget", () => {
  it("leaves desktop overlay refreshes unthrottled", () => {
    assert.equal(
      shouldRefreshOverlayFrame({
        mobileDevice: false,
        nowMs: 1,
        lastRefreshAtMs: 1,
      }),
      true
    );
  });

  it("bounds complete mobile overlay rebuilds to the documented cadence", () => {
    assert.equal(
      shouldRefreshOverlayFrame({
        mobileDevice: true,
        nowMs: 1_000,
        lastRefreshAtMs: undefined,
      }),
      true
    );
    assert.equal(
      shouldRefreshOverlayFrame({
        mobileDevice: true,
        nowMs: 1_000 + MOBILE_OVERLAY_REFRESH_INTERVAL_MS - 1,
        lastRefreshAtMs: 1_000,
      }),
      false
    );
    assert.equal(
      shouldRefreshOverlayFrame({
        mobileDevice: true,
        nowMs: 1_000 + MOBILE_OVERLAY_REFRESH_INTERVAL_MS,
        lastRefreshAtMs: 1_000,
      }),
      true
    );
  });

  it("recovers immediately from a reset or invalid clock", () => {
    for (const nowMs of [900, Number.NaN]) {
      assert.equal(
        shouldRefreshOverlayFrame({
          mobileDevice: true,
          nowMs,
          lastRefreshAtMs: 1_000,
        }),
        true
      );
    }
  });

  it("uses a slower emergency cadence only after severe frame collapse", () => {
    assert.equal(
      mobileOverlayRefreshIntervalForFrameGap(33),
      MOBILE_OVERLAY_REFRESH_INTERVAL_MS
    );
    assert.equal(
      mobileOverlayRefreshIntervalForFrameGap(100),
      MOBILE_OVERLAY_EMERGENCY_REFRESH_INTERVAL_MS
    );
    assert.equal(
      shouldRefreshOverlayFrame({
        mobileDevice: true,
        nowMs: 1_150,
        lastRefreshAtMs: 1_000,
        refreshIntervalMs: MOBILE_OVERLAY_EMERGENCY_REFRESH_INTERVAL_MS,
      }),
      false
    );
  });
});
