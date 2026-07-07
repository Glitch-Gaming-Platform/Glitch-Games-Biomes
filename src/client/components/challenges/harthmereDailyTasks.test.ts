/// <reference types="mocha" />
/// <reference types="node" />
//
// HARTHMERE_DAILY_TASK_HOT_PATH_THROTTLE tests.
// The fire-and-forget `completeHarthmereDailyTaskSoon` is wired to high-frequency
// gameplay events (every mined block, every placed voxel). On production the
// resulting `request_care_loop_action` mutations take 11-29s and contend with the
// triggering action's own inventory mutation, ballooning latency. These tests
// pin the throttle: a burst of hot-path fires results in AT MOST ONE network call
// per activity per day, debounced off the triggering action.
import assert from "assert";

// Minimal window + localStorage + timer shim installed before importing the SUT.
const globalAny = global as any;
if (typeof globalAny.window === "undefined") {
  globalAny.window = globalAny;
}
const storage = new Map<string, string>();
globalAny.window.localStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, String(value)),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
};
globalAny.window.dispatchEvent ??= () => true;

import {
  completeHarthmereDailyTask,
  completeHarthmereDailyTaskSoon,
  harthmereDailyTaskCompletedToday,
  resetHarthmereDailyTaskHotPathThrottleForTest,
} from "./harthmereDailyTasks";

function makeFetchCounter() {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return {
      ok: true,
      json: async () => ({ ok: true }),
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return {
    fetchImpl,
    get calls() {
      return calls;
    },
  };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("harthmere daily task hot-path throttle", () => {
  beforeEach(() => {
    storage.clear();
    resetHarthmereDailyTaskHotPathThrottleForTest();
  });

  it("collapses a burst of hot-path fires into a single debounced completion", async function () {
    this.timeout(15000);
    const counter = makeFetchCounter();
    // Patch global fetch since `...Soon` calls completeHarthmereDailyTask() with
    // no explicit fetchImpl.
    const originalFetch = globalAny.fetch;
    globalAny.fetch = counter.fetchImpl;
    try {
      // Simulate 25 placed voxels in quick succession.
      for (let i = 0; i < 25; i += 1) {
        completeHarthmereDailyTaskSoon("home_care");
      }
      assert.equal(counter.calls, 0, "must debounce (no immediate fire)");
      await delay(4200);
      assert.equal(counter.calls, 1, "burst collapses to exactly one call");
      assert.equal(harthmereDailyTaskCompletedToday("home_care"), true);

      // Further fires the same day are suppressed entirely.
      for (let i = 0; i < 10; i += 1) {
        completeHarthmereDailyTaskSoon("home_care");
      }
      await delay(4200);
      assert.equal(counter.calls, 1, "already-done-today fires nothing more");
    } finally {
      globalAny.fetch = originalFetch;
    }
  });

  it("does not throttle the awaitable jobs-board path (explicit completions)", async () => {
    const counter = makeFetchCounter();
    // The awaitable variant keeps exact prior behavior: each explicit call hits
    // the network (used by the jobs board), independent of the hot-path guard.
    await completeHarthmereDailyTask("jobs_board", {
      fetchImpl: counter.fetchImpl,
    });
    await completeHarthmereDailyTask("jobs_board", {
      fetchImpl: counter.fetchImpl,
    });
    assert.equal(counter.calls, 2);
  });
});
