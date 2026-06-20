// Backend tests for the business daily check-in economy.

import {
  BUSINESS_CHECKIN_REWARD_GOLD,
  businessCheckInStatus,
  businessMissedDays,
  businessNeglectRevenueFactor,
  businessNeglectRevenueLost,
  initBusinessDailyCheckInState,
  processBusinessCheckIn,
} from "@/shared/harthmere/business_daily_checkin";
import assert from "assert";

const close = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `expected ${a} ~= ${b}`);

describe("business daily check-in: revenue factor", () => {
  it("is full revenue when not neglected", () => {
    assert.strictEqual(businessNeglectRevenueFactor(0), 1);
    assert.strictEqual(businessNeglectRevenueFactor(-3), 1);
  });

  it("drops by an accelerating amount each missed day", () => {
    close(businessNeglectRevenueFactor(1), 0.8); // -0.20
    close(businessNeglectRevenueFactor(2), 0.55); // -0.25 more
    close(businessNeglectRevenueFactor(3), 0.25); // -0.30 more
  });

  it("goes negative (accelerating losses) for prolonged neglect", () => {
    close(businessNeglectRevenueFactor(4), -0.1);
    close(businessNeglectRevenueFactor(5), -0.5);
    assert.ok(
      businessNeglectRevenueFactor(6) < businessNeglectRevenueFactor(5),
      "loss keeps growing"
    );
  });

  it("never falls below the floor", () => {
    assert.strictEqual(businessNeglectRevenueFactor(1000), -2.0);
  });

  it("each extra missed day loses MORE than the previous (acceleration)", () => {
    const f = businessNeglectRevenueFactor;
    const drop1 = f(0) - f(1); // 0.20
    const drop2 = f(1) - f(2); // 0.25
    const drop3 = f(2) - f(3); // 0.30
    assert.ok(drop2 > drop1 && drop3 > drop2, "per-day loss accelerates");
  });
});

describe("business daily check-in: revenue lost", () => {
  it("is zero with no missed days", () => {
    assert.strictEqual(businessNeglectRevenueLost(0, 1000), 0);
  });

  it("sums the per-day shortfall over the gap", () => {
    // day1: (1-0.8)=0.2, day2: (1-0.55)=0.45 -> 0.65 * 1000 = 650
    close(businessNeglectRevenueLost(2, 1000), 650);
  });

  it("counts loss days as more than 100% of base", () => {
    // day4 factor -0.1 -> shortfall 1.1 * base
    const lost4 = businessNeglectRevenueLost(4, 1000);
    const lost3 = businessNeglectRevenueLost(3, 1000);
    assert.ok(lost4 - lost3 > 1000, "a loss day costs more than one base day");
  });

  it("guards bad inputs", () => {
    assert.strictEqual(businessNeglectRevenueLost(3, 0), 0);
    assert.strictEqual(businessNeglectRevenueLost(NaN, 1000), 0);
    assert.strictEqual(businessNeglectRevenueLost(2, -5), 0);
  });
});

describe("business daily check-in: missed days", () => {
  it("is zero for a brand-new business and for next-day check-ins", () => {
    assert.strictEqual(businessMissedDays({ lastCheckInDay: undefined }, 10), 0);
    assert.strictEqual(businessMissedDays({ lastCheckInDay: 10 }, 11), 0);
    assert.strictEqual(businessMissedDays({ lastCheckInDay: 10 }, 10), 0);
  });

  it("counts full skipped days", () => {
    assert.strictEqual(businessMissedDays({ lastCheckInDay: 10 }, 12), 1);
    assert.strictEqual(businessMissedDays({ lastCheckInDay: 10 }, 15), 4);
  });
});

describe("business daily check-in: processing", () => {
  it("grants 500 gold and starts a streak on first check-in", () => {
    const r = processBusinessCheckIn(
      initBusinessDailyCheckInState(),
      100,
      1000
    );
    assert.strictEqual(r.checkedIn, true);
    assert.strictEqual(r.goldGranted, BUSINESS_CHECKIN_REWARD_GOLD);
    assert.strictEqual(r.revenueLostThisGap, 0);
    assert.strictEqual(r.streak, 1);
    assert.strictEqual(r.state.totalGoldFromCheckIns, 500);
  });

  it("is a no-op on a second check-in the same day", () => {
    let s = initBusinessDailyCheckInState();
    s = processBusinessCheckIn(s, 100, 1000).state;
    const again = processBusinessCheckIn(s, 100, 1000);
    assert.strictEqual(again.checkedIn, false);
    assert.strictEqual(again.goldGranted, 0);
    assert.strictEqual(again.state.totalGoldFromCheckIns, 500);
  });

  it("continues the streak on consecutive daily check-ins", () => {
    let s = initBusinessDailyCheckInState();
    s = processBusinessCheckIn(s, 100, 1000).state;
    s = processBusinessCheckIn(s, 101, 1000).state;
    const r = processBusinessCheckIn(s, 102, 1000);
    assert.strictEqual(r.streak, 3);
    assert.strictEqual(r.state.longestStreak, 3);
    assert.strictEqual(r.state.totalGoldFromCheckIns, 1500);
    assert.strictEqual(r.state.totalRevenueLostToNeglect, 0, "no neglect when daily");
  });

  it("resets the streak and banks the revenue lost after skipped days", () => {
    let s = initBusinessDailyCheckInState();
    s = processBusinessCheckIn(s, 100, 1000).state; // streak 1
    s = processBusinessCheckIn(s, 101, 1000).state; // streak 2
    // Skip days 102,103 -> check in on 104: missed = 2 days.
    const r = processBusinessCheckIn(s, 104, 1000);
    assert.strictEqual(r.missedDays, 2);
    assert.strictEqual(r.streak, 1, "streak resets after a miss");
    close(r.revenueLostThisGap, 650); // from the lost-revenue test
    assert.strictEqual(r.state.totalGoldFromCheckIns, 1500);
    close(r.state.totalRevenueLostToNeglect, 650);
    assert.strictEqual(r.state.longestStreak, 2, "longest streak preserved");
  });
});

describe("business daily check-in: status display", () => {
  it("reports made vs lost and the cost of skipping today", () => {
    let s = initBusinessDailyCheckInState();
    s = processBusinessCheckIn(s, 100, 1000).state;
    // Two days later (missed one full day, day 101).
    const status = businessCheckInStatus(s, 102, 1000);
    assert.strictEqual(status.checkedInToday, false);
    assert.strictEqual(status.missedDays, 1);
    close(status.currentRevenueFactor, 0.8);
    assert.strictEqual(status.totalGoldFromCheckIns, 500);
    // Skipping today (going from 1 missed to 2 missed) costs the day-2 shortfall.
    close(status.revenueLostIfSkipToday, (1 - 0.55) * 1000);
  });

  it("reports checkedInToday correctly right after a check-in", () => {
    let s = initBusinessDailyCheckInState();
    s = processBusinessCheckIn(s, 100, 1000).state;
    const status = businessCheckInStatus(s, 100, 1000);
    assert.strictEqual(status.checkedInToday, true);
    assert.strictEqual(status.missedDays, 0);
    assert.strictEqual(status.currentRevenueFactor, 1);
  });
});
