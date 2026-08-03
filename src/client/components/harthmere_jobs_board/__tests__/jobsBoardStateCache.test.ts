/// <reference types="mocha" />

import assert from "assert";
import {
  HARTHMERE_JOBS_BOARD_STATE_CACHE_TTL_MS,
  cachedHarthmereJobsBoardState,
  fetchHarthmereJobsBoardState,
  resetHarthmereJobsBoardStateCacheForTest,
} from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";

function rawSnapshot(version: string) {
  return {
    version,
    actorId: "cache-test-player",
    boards: {},
    defaultBoardId: "harthmere_grove_market_jobs_board",
    openJobs: [],
    activeJobs: [],
    myPostedJobs: [],
    myAcceptedJobs: [],
    myTodos: [],
    audit: [],
    cooldown: { abuseScore: 0 },
    safety: {
      minRewardGold: 5,
      maxRewardGold: 5000,
      maxActivePostingsPerIssuer: 12,
      maxActiveAcceptedPerSeeker: 6,
      requiresPhysicalBoardInteraction: true,
    },
  };
}

describe("Harthmere jobs-board state cache", () => {
  it("coalesces duplicate in-flight reads and reuses the fresh snapshot", async () => {
    let resolveResponse!: (value: any) => void;
    const response = new Promise<any>((resolve) => {
      resolveResponse = resolve;
    });
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      return response;
    }) as typeof fetch;
    resetHarthmereJobsBoardStateCacheForTest(fetchImpl);

    const first = fetchHarthmereJobsBoardState(fetchImpl, { nowMs: 1000 });
    const duplicate = fetchHarthmereJobsBoardState(fetchImpl, { nowMs: 1000 });
    assert.equal(calls.length, 1);
    resolveResponse({
      ok: true,
      json: async () => ({ ok: true, jobsBoardState: rawSnapshot("first") }),
    });
    assert.strictEqual(await duplicate, await first);
    assert.equal(calls.length, 1);

    const cached = await fetchHarthmereJobsBoardState(fetchImpl, {
      nowMs: 1000 + HARTHMERE_JOBS_BOARD_STATE_CACHE_TTL_MS,
    });
    assert.equal(cached.version, "first");
    assert.strictEqual(cachedHarthmereJobsBoardState(fetchImpl), cached);
    assert.equal(calls.length, 1);
  });

  it("refreshes after TTL expiry and supports explicit force refresh", async () => {
    let version = 0;
    const calls: string[] = [];
    const fetchImpl = (async (url: string) => {
      calls.push(url);
      version += 1;
      return {
        ok: true,
        json: async () => ({
          ok: true,
          jobsBoardState: rawSnapshot(`version-${version}`),
        }),
      } as Response;
    }) as typeof fetch;
    resetHarthmereJobsBoardStateCacheForTest(fetchImpl);

    assert.equal(
      (await fetchHarthmereJobsBoardState(fetchImpl, { nowMs: 1000 })).version,
      "version-1"
    );
    assert.equal(
      (
        await fetchHarthmereJobsBoardState(fetchImpl, {
          nowMs: 1001,
          force: true,
        })
      ).version,
      "version-2"
    );
    assert.equal(
      (
        await fetchHarthmereJobsBoardState(fetchImpl, {
          nowMs: 1001 + HARTHMERE_JOBS_BOARD_STATE_CACHE_TTL_MS + 1,
        })
      ).version,
      "version-3"
    );
    assert.equal(calls.length, 3);
  });
});
