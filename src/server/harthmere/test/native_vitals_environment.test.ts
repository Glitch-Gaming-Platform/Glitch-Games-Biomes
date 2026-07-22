import {
  resetHarthmereUnderwaterCacheForTest,
  serverDerivedHarthmereUnderwater,
} from "@/server/harthmere/native_vitals_environment";
import assert from "assert";

describe("serverDerivedHarthmereUnderwater", () => {
  beforeEach(() => resetHarthmereUnderwaterCacheForTest());

  it("coalesces repeated lookups for the same head block", async () => {
    let scans = 0;
    const askApi = {
      scanForExport: async function* () {
        scans += 1;
      },
    };
    const input = {
      askApi,
      voxeloo: {} as any,
      position: [10, 20, 30] as const,
      nowMs: 1_000,
      cacheTtlMs: 1_500,
    };

    assert.equal(await serverDerivedHarthmereUnderwater(input), false);
    assert.equal(await serverDerivedHarthmereUnderwater(input), false);
    assert.equal(scans, 1);
    assert.equal(
      await serverDerivedHarthmereUnderwater({ ...input, nowMs: 2_501 }),
      false
    );
    assert.equal(scans, 2);
  });
});
