// HARTHMERE_MOBILE_FRAME_CAP (2026-08-04 mobile audit, item 4).
//
// `Loop.tick()` renders on every `requestAnimationFrame` with no target-rate
// gate. On desktop that is correct: spare frames are free and a 144 Hz monitor
// should get 144 Hz. On a phone it is actively harmful.
//
// Every prior investigation (2026-08-01, 2026-08-02, and the 2026-08-03
// captured session) reached the same conclusion: the client is CPU/main-thread
// bound, not GPU bound. Rendering every rAF on a phone therefore:
//
//  - spends the whole main thread budget on frames the player cannot perceive
//    as smoother, because the frame rate is already unstable;
//  - drives sustained CPU load -- the physical iPhone runs recorded 124% and
//    191% CPU -- which triggers thermal throttling, at which point the device
//    gets *slower* than a capped one would have been;
//  - keeps memory churn (per-frame allocation, terrain re-mesh pressure) at
//    maximum rate inside a WebContent process that was being jetsam-killed.
//
// Capping to 30 FPS halves all of that. Simulation is unaffected: `Loop` already
// decouples it via `FixedRateTicker` in `advanceSimulation`, so input, physics
// and networking keep their own cadence and only *rendering* is paced.
//
// Perceptually a locked 30 reads better than an unlocked 22-45. Desktop is not
// capped at all -- `shouldRenderFrame` is only consulted when a target FPS is
// supplied, and the target is only supplied for `mobileDevice` clients.

/** Render target for phones. Simulation rate is unchanged. */
export const MOBILE_RENDER_FPS_CAP = 30;

// A rAF callback never lands exactly on the interval boundary. Without slack a
// 30 FPS cap on a 60 Hz display degenerates to 20 FPS: elapsed alternates
// 16.7 / 33.3 ms, and a strict `>= 33.33` test rejects the 33.3 ms frame by a
// fraction of a millisecond, so every third frame is dropped instead of every
// second one. 4 ms is comfortably under half a 120 Hz frame (8.3 ms), so it
// cannot accidentally admit two frames in one interval on a fast display.
export const FRAME_PACING_SLACK_MS = 4;

/**
 * Decide whether this animation frame should render.
 *
 * `targetFps` of `undefined` means "no cap" and always renders -- that is the
 * desktop path and it is bit-for-bit the previous behaviour.
 */
export function shouldRenderFrame({
  nowMs,
  lastRenderAtMs,
  targetFps,
}: {
  nowMs: number;
  lastRenderAtMs: number | undefined;
  targetFps: number | undefined;
}): boolean {
  if (targetFps === undefined || !Number.isFinite(targetFps) || targetFps <= 0) {
    return true;
  }
  // First frame of the session, or the loop was restarted.
  if (lastRenderAtMs === undefined || !Number.isFinite(lastRenderAtMs)) {
    return true;
  }
  const elapsedMs = nowMs - lastRenderAtMs;
  // A non-monotonic or reset clock must not stall rendering forever.
  if (elapsedMs < 0) {
    return true;
  }
  const intervalMs = 1000 / targetFps;
  return elapsedMs >= intervalMs - FRAME_PACING_SLACK_MS;
}

/**
 * The render FPS cap for this client, or `undefined` for "uncapped".
 *
 * Kept as a function rather than a constant so the mobile-only condition is
 * expressed in exactly one place and is trivially assertable in tests.
 */
export function renderFpsCapForDevice(mobileDevice: boolean) {
  return mobileDevice ? MOBILE_RENDER_FPS_CAP : undefined;
}
