/// <reference types="mocha" />
import {
  bottleneck,
  dynamicPerformanceSampleMode,
  type PerformanceStats,
  type PerformanceTargets,
} from "@/client/game/resources/dynamic_settings_updater";
import assert from "assert";

// The `reduce` row for a sub-24 FPS client. Matches PERFORMANCE_TARGETS[0].
const STRUGGLING_TARGETS: PerformanceTargets = {
  cpuBudgetMs: 24,
  gpuBudgetMs: 24,
  renderScale: 0.3,
  drawDistance: 64,
};

function stats(partial: Partial<PerformanceStats>): PerformanceStats {
  return {
    renderIntervalMs: 16,
    cpuTimeMs: 8,
    gpuTimeMs: undefined,
    ...partial,
  };
}

describe("dynamic settings: bottleneck attribution", () => {
  it("enters reduction-only emergency mode quickly after battle collapses FPS", () => {
    assert.equal(
      dynamicPerformanceSampleMode({
        cpuCount: 24,
        gpuCount: 24,
        renderCount: 24,
        renderIntervalMs: 72,
      }),
      "emergency-reduce"
    );
    assert.equal(
      dynamicPerformanceSampleMode({
        cpuCount: 23,
        gpuCount: 23,
        renderCount: 23,
        renderIntervalMs: 500,
      }),
      "wait"
    );
  });

  it("never uses the short sample window to increase quality", () => {
    assert.equal(
      dynamicPerformanceSampleMode({
        cpuCount: 40,
        renderCount: 40,
        renderIntervalMs: 16.7,
      }),
      "wait"
    );
    assert.equal(
      dynamicPerformanceSampleMode({
        cpuCount: 110,
        renderCount: 110,
        renderIntervalMs: 16.7,
      }),
      "normal"
    );
  });

  it("prefers the measured GPU timer whenever it is available", () => {
    assert.equal(
      bottleneck(
        stats({ renderIntervalMs: 70, cpuTimeMs: 40, gpuTimeMs: 10 }),
        STRUGGLING_TARGETS
      ),
      "cpu"
    );
    assert.equal(
      bottleneck(
        stats({ renderIntervalMs: 70, cpuTimeMs: 10, gpuTimeMs: 40 }),
        STRUGGLING_TARGETS
      ),
      "gpu"
    );
  });

  // HARTHMERE_DYNAMIC_RENDER_SCALE_WITHOUT_GPU_TIMER: without
  // EXT_disjoint_timer_query_webgl2 this used to unconditionally return "cpu",
  // which made `tryReduceQuality` for renderScale unreachable and left a
  // struggling client pinned at its starting resolution for the whole session.
  it("infers a GPU bottleneck from unaccounted frame time when no timer exists", () => {
    // A 70ms frame (about 14 FPS) with only 6ms of our own CPU work. The other
    // 64ms is not ours to optimise away by drawing fewer entities.
    assert.equal(
      bottleneck(
        stats({ renderIntervalMs: 70, cpuTimeMs: 6, gpuTimeMs: undefined }),
        STRUGGLING_TARGETS
      ),
      "gpu"
    );
  });

  it("still calls it CPU-bound when our own work dominates the frame", () => {
    assert.equal(
      bottleneck(
        stats({ renderIntervalMs: 70, cpuTimeMs: 55, gpuTimeMs: undefined }),
        STRUGGLING_TARGETS
      ),
      "cpu"
    );
  });

  it("does not chase a healthy frame that is merely vsync limited", () => {
    // 60 FPS with 2ms of CPU work: mostly idle waiting on the display, which
    // must not be read as GPU pressure or the client would degrade itself while
    // hitting its target frame rate.
    assert.equal(
      bottleneck(
        stats({ renderIntervalMs: 16.7, cpuTimeMs: 2, gpuTimeMs: undefined }),
        STRUGGLING_TARGETS
      ),
      "cpu"
    );
  });
});
