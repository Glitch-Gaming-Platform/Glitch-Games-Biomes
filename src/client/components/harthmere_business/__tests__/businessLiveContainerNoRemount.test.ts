/// <reference types="mocha" />
import assert from "assert";
import { readFileSync } from "fs";
import { planHarthmereBusinessRefreshLoading } from "../HarthmereBusinessLiveContainer";

// HARTHMERE_BUSINESS_NO_REMOUNT_ON_ACTION
// Locks the invariant behind the bug where clicking a mini-game answer made the
// whole BusinessUI collapse to the board and re-open: every refresh fired after
// the first hydration must be silent (never flips the blocking `loading` flag),
// so the panel stays mounted and animates in place instead of remounting.
describe("Harthmere business live container refresh loading plan", () => {
  it("shows the blocking loading board only on the very first hydration", () => {
    const initial = planHarthmereBusinessRefreshLoading(false);
    assert.strictEqual(initial.showLoadingAtStart, true);
    assert.strictEqual(initial.clearLoadingWhenSettled, true);
    assert.strictEqual(initial.hasLoadedAfter, true);
  });

  it("keeps post-mutation refreshes silent so the panel never remounts", () => {
    const afterLoaded = planHarthmereBusinessRefreshLoading(true);
    assert.strictEqual(
      afterLoaded.showLoadingAtStart,
      false,
      "a serve/owner-action refresh must not raise the loading flag"
    );
    assert.strictEqual(
      afterLoaded.clearLoadingWhenSettled,
      false,
      "a silent refresh must not toggle loading at settle time either"
    );
    assert.strictEqual(afterLoaded.hasLoadedAfter, true);
  });

  it("only the first refresh in a serve sequence blocks the UI", () => {
    let hasLoaded = false;
    const loadingEvents: boolean[] = [];
    // Simulate the real lifecycle: one initial hydration followed by several
    // serve/answer mutations that each trigger a background refresh.
    for (let i = 0; i < 5; i++) {
      const plan = planHarthmereBusinessRefreshLoading(hasLoaded);
      loadingEvents.push(plan.showLoadingAtStart);
      hasLoaded = plan.hasLoadedAfter;
    }
    assert.deepStrictEqual(loadingEvents, [true, false, false, false, false]);
  });

  it("opens the physical counter directly on the in-world shift control", () => {
    const source = readFileSync(
      "src/client/components/harthmere_business/HarthmereBusinessLiveContainer.tsx",
      "utf8"
    );
    assert.match(source, /initialTab="customers"/);
    assert.doesNotMatch(source, /initialTab="overview"/);
  });
});
