/// <reference types="mocha" />

import assert from "assert";

import {
  applyHarthmereJobRewardToState,
  harthmereInventoryCanAcceptItems,
  readHarthmereInventoryState,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";

// HARTHMERE_JOB_REWARD_BRIDGE: jobs-board payout lands in the HUD wallet +
// inventory exactly once (no double-pay), with overflow reported and a fit guard
// the turn-in uses to avoid losing items.

describe("HARTHMERE_JOB_REWARD_BRIDGE — reward grant on turn-in", () => {
  it("grants gold + items into the HUD state once", () => {
    const base = readHarthmereInventoryState();
    const reward = {
      jobId: "job_a",
      rewardGold: 50,
      rewardItems: [{ itemId: "minor_healing_salve", count: 2 }],
    };
    const out = applyHarthmereJobRewardToState(base, new Set(), reward);
    assert.equal(out.result.granted, true);
    assert.equal(out.result.alreadyGranted, false);
    assert.equal(out.result.goldAdded, 50);
    assert.equal(out.result.itemsAdded, 2);
    assert.equal(out.result.overflow, 0);
    assert.equal(out.state.wallet.gold, base.wallet.gold + 50);
    assert.ok(out.granted.has("job_a"));
  });

  it("is idempotent per jobId — a re-fired turn-in never double-pays", () => {
    const base = readHarthmereInventoryState();
    const reward = { jobId: "job_b", rewardGold: 40, rewardItems: [] };
    const first = applyHarthmereJobRewardToState(base, new Set(), reward);
    const second = applyHarthmereJobRewardToState(
      first.state,
      first.granted,
      reward
    );
    assert.equal(second.result.granted, false);
    assert.equal(second.result.alreadyGranted, true);
    assert.equal(second.result.goldAdded, 0);
    // Gold is unchanged on the second application — no double-pay.
    assert.equal(second.state.wallet.gold, first.state.wallet.gold);
  });

  it("supports a gold-only reward (no items)", () => {
    const base = readHarthmereInventoryState();
    const out = applyHarthmereJobRewardToState(base, new Set(), {
      jobId: "job_c",
      rewardGold: 25,
    });
    assert.equal(out.result.goldAdded, 25);
    assert.equal(out.result.itemsAdded, 0);
  });

  it("skips unknown reward items (does not crash or mis-count)", () => {
    const base = readHarthmereInventoryState();
    const out = applyHarthmereJobRewardToState(base, new Set(), {
      jobId: "job_d",
      rewardItems: [{ itemId: "not_a_real_item_xyz", count: 3 }],
    });
    assert.equal(out.result.granted, true);
    assert.equal(out.result.itemsAdded, 0);
  });

  it("the fit guard the turn-in uses accepts a normal reward", () => {
    assert.equal(
      harthmereInventoryCanAcceptItems(
        [{ itemId: "minor_healing_salve", quantity: 1 }],
        readHarthmereInventoryState()
      ),
      true
    );
  });
});
