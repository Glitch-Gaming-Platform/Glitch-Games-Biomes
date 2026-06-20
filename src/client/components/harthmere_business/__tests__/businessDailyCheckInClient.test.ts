// Frontend tests for the business daily check-in client glue (day index + the
// streak / made-vs-lost display model).

import {
  businessCheckInDisplayModel,
  harthmereDayIndex,
} from "@/client/components/harthmere_business/businessDailyCheckInClient";
import {
  businessCheckInStatus,
  initBusinessDailyCheckInState,
  processBusinessCheckIn,
} from "@/shared/harthmere/business_daily_checkin";
import assert from "assert";

describe("business check-in client: day index", () => {
  it("maps timestamps within the same UTC day to one index, next day to the next", () => {
    const day0 = harthmereDayIndex(0);
    const sameDay = harthmereDayIndex(86_400_000 - 1);
    const nextDay = harthmereDayIndex(86_400_000);
    assert.strictEqual(sameDay, day0);
    assert.strictEqual(nextDay, day0 + 1);
  });

  it("guards non-finite input", () => {
    assert.strictEqual(harthmereDayIndex(NaN), 0);
  });
});

describe("business check-in client: display model", () => {
  function statusAfter(
    checkInDays: number[],
    todayDay: number,
    baseRevenue = 1000
  ) {
    let s = initBusinessDailyCheckInState();
    for (const d of checkInDays) {
      s = processBusinessCheckIn(s, d, baseRevenue).state;
    }
    return businessCheckInStatus(s, todayDay, baseRevenue);
  }

  it("shows a 'checked in today' call to action and full revenue", () => {
    const m = businessCheckInDisplayModel(statusAfter([100], 100));
    assert.strictEqual(m.checkedInToday, true);
    assert.strictEqual(m.inLosses, false);
    assert.ok(/Revenue at 100%/.test(m.revenueLabel));
    assert.ok(/Checked in today/.test(m.callToAction));
    assert.ok(/Made by checking in: 500 gold/.test(m.madeLabel));
  });

  it("prompts a check-in and warns about the skip cost when neglected", () => {
    // Checked in day 100, now day 102 -> 1 missed day, revenue 80%.
    const m = businessCheckInDisplayModel(statusAfter([100], 102));
    assert.strictEqual(m.checkedInToday, false);
    assert.ok(/Revenue at 80%/.test(m.revenueLabel));
    assert.ok(/Check in for 500 gold/.test(m.callToAction));
    assert.ok(/Skipping today costs about \d+ more gold/.test(m.callToAction));
  });

  it("flags when the business has slid into losses", () => {
    // Checked in day 100, now day 105 -> 4 missed days -> factor -0.1.
    const m = businessCheckInDisplayModel(statusAfter([100], 105));
    assert.strictEqual(m.inLosses, true);
    assert.ok(/losing money/.test(m.revenueLabel));
  });

  it("surfaces the streak and the made-vs-lost totals", () => {
    // 100,101,102 daily (streak 3), then skip to 105 (missed 2) and check in.
    let s = initBusinessDailyCheckInState();
    for (const d of [100, 101, 102]) {
      s = processBusinessCheckIn(s, d, 1000).state;
    }
    s = processBusinessCheckIn(s, 105, 1000).state; // streak resets to 1
    const m = businessCheckInDisplayModel(
      businessCheckInStatus(s, 105, 1000)
    );
    assert.ok(/1-day check-in streak \(best 3\)/.test(m.streakLabel));
    assert.ok(/Made by checking in: 2000 gold/.test(m.madeLabel)); // 4 check-ins
    assert.ok(/Lost by not checking in: 650 gold/.test(m.lostLabel));
  });
});
