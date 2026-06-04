// Frontend test for the business adapter's daily check-in wiring: getCheckInStatus
// reads the per-business state, and checkInDaily submits the backend op.

import { createHarthmereBusinessInterfaceAdapterV1 } from "@/client/components/harthmere_business/businessInterfaceLiveAdapter";
import assert from "assert";

function snapshotWithCheckIn(dailyCheckIn: any): any {
  return {
    actorId: "player_1",
    businesses: {
      biz_1: {
        businessId: "biz_1",
        ownerKind: "player",
        ownerId: "player_1",
        dailyCheckIn,
      },
    },
  };
}

describe("business adapter daily check-in wiring", () => {
  it("getCheckInStatus surfaces streak + made/lost from the record", () => {
    const adapter = createHarthmereBusinessInterfaceAdapterV1({
      state: snapshotWithCheckIn({
        lastCheckInDay: 0,
        currentStreak: 2,
        longestStreak: 3,
        totalGoldFromCheckIns: 1500,
        totalRevenueLostToNeglect: 650,
      }),
      hydrated: true,
    });
    const status = adapter.getCheckInStatus("biz_1");
    assert.ok(status, "status resolved");
    assert.strictEqual(status!.currentStreak, 2);
    assert.strictEqual(status!.longestStreak, 3);
    assert.strictEqual(status!.totalGoldFromCheckIns, 1500);
    assert.strictEqual(status!.totalRevenueLostToNeglect, 650);
  });

  it("getCheckInStatus defaults a business with no check-in state", () => {
    const adapter = createHarthmereBusinessInterfaceAdapterV1({
      state: snapshotWithCheckIn(undefined),
      hydrated: true,
    });
    const status = adapter.getCheckInStatus("biz_1");
    assert.ok(status);
    assert.strictEqual(status!.currentStreak, 0);
    assert.strictEqual(status!.totalGoldFromCheckIns, 0);
  });

  it("getCheckInStatus returns undefined for an unknown business", () => {
    const adapter = createHarthmereBusinessInterfaceAdapterV1({
      state: snapshotWithCheckIn(undefined),
      hydrated: true,
    });
    assert.strictEqual(adapter.getCheckInStatus("missing"), undefined);
  });

  it("checkInDaily submits the business_daily_check_in op for the business", async () => {
    const calls: Array<{ op: string; payload: Record<string, unknown> }> = [];
    const adapter = createHarthmereBusinessInterfaceAdapterV1({
      state: snapshotWithCheckIn(undefined),
      hydrated: true,
      submit: async (op, payload) => {
        calls.push({ op, payload });
        return {} as any;
      },
    });
    await adapter.checkInDaily("biz_1");
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].op, "business_daily_check_in");
    assert.deepStrictEqual(calls[0].payload, { businessId: "biz_1" });
  });
});
