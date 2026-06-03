/// <reference types="mocha" />
import assert from "assert";
import {
  coalescedHarthmereLiveFetchV1,
  planHarthmereLiveFetchCacheV1,
  resetHarthmereLiveFetchCacheV1,
} from "@/client/components/harthmere_live_fetch";

// HARTHMERE_LIVE_FETCH_COALESCE_V1
// Locks the invariant that duplicate, near-simultaneous GETs of the same
// idempotent live_mode_*_state endpoint collapse to a single network call,
// while POSTs and signal-bearing requests always pass through untouched and
// every caller still receives an independently-readable response.

function fakeResponse(tag: string, ok = true): Response {
  // A minimal Response stand-in: clone() hands out a fresh independently
  // "readable" object, mirroring real Response semantics.
  return {
    ok,
    _tag: tag,
    clone() {
      return { ok, _tag: tag, cloned: true } as unknown as Response;
    },
  } as unknown as Response;
}

// Deferred promise helper so we can hold a fetch "in flight".
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("harthmere live fetch coalescing", () => {
  beforeEach(() => resetHarthmereLiveFetchCacheV1());

  describe("planHarthmereLiveFetchCacheV1", () => {
    it("caches idempotent GETs by url", () => {
      assert.deepStrictEqual(
        planHarthmereLiveFetchCacheV1({ url: "/api/harthmere/live_mode_building_state" }),
        { cacheable: true, key: "GET /api/harthmere/live_mode_building_state" }
      );
    });

    it("never caches POSTs", () => {
      assert.deepStrictEqual(
        planHarthmereLiveFetchCacheV1({ method: "POST", url: "/api/harthmere/live_mode" }),
        { cacheable: false }
      );
    });

    it("never caches requests carrying a caller signal", () => {
      assert.deepStrictEqual(
        planHarthmereLiveFetchCacheV1({ url: "/x", hasCustomSignal: true }),
        { cacheable: false }
      );
    });
  });

  it("coalesces concurrent identical GETs into ONE network call", async () => {
    let calls = 0;
    const gate = deferred<Response>();
    const fetchImpl = (async () => {
      calls += 1;
      return gate.promise;
    }) as unknown as typeof fetch;

    const url = "/api/harthmere/live_mode_building_state";
    const a = coalescedHarthmereLiveFetchV1(fetchImpl, url, {});
    const b = coalescedHarthmereLiveFetchV1(fetchImpl, url, {});
    gate.resolve(fakeResponse("server-1"));
    const [ra, rb] = await Promise.all([a, b]);

    assert.strictEqual(calls, 1, "the second concurrent GET must reuse the first");
    // Both callers get an independently-readable clone of the same payload.
    assert.strictEqual((ra as any)._tag, "server-1");
    assert.strictEqual((rb as any)._tag, "server-1");
    assert.strictEqual((ra as any).cloned, true);
    assert.strictEqual((rb as any).cloned, true);
  });

  it("serves a second GET from the short TTL window, then refetches after it expires", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return fakeResponse(`server-${calls}`);
    }) as unknown as typeof fetch;

    let clock = 1_000;
    const nowMs = () => clock;
    const url = "/api/harthmere/live_mode_player_status_state";
    const opts = { nowMs, ttlMs: 1_000 };

    await coalescedHarthmereLiveFetchV1(fetchImpl, url, {}, opts);
    clock = 1_500; // within TTL
    await coalescedHarthmereLiveFetchV1(fetchImpl, url, {}, opts);
    assert.strictEqual(calls, 1, "a GET within the TTL window reuses the cached response");

    clock = 2_600; // past TTL
    await coalescedHarthmereLiveFetchV1(fetchImpl, url, {}, opts);
    assert.strictEqual(calls, 2, "after the TTL expires the endpoint is fetched again");
  });

  it("does NOT coalesce different urls", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return fakeResponse(`server-${calls}`);
    }) as unknown as typeof fetch;
    await coalescedHarthmereLiveFetchV1(fetchImpl, "/api/harthmere/live_mode_quest_state", {});
    await coalescedHarthmereLiveFetchV1(fetchImpl, "/api/harthmere/live_mode_building_state", {});
    assert.strictEqual(calls, 2);
  });

  it("does NOT coalesce POST mutations", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return fakeResponse(`server-${calls}`);
    }) as unknown as typeof fetch;
    const url = "/api/harthmere/live_mode";
    await coalescedHarthmereLiveFetchV1(fetchImpl, url, { method: "POST" });
    await coalescedHarthmereLiveFetchV1(fetchImpl, url, { method: "POST" });
    assert.strictEqual(calls, 2, "every mutation must reach the server");
  });

  it("evicts an error response so the next call retries immediately", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return fakeResponse(`server-${calls}`, calls === 1 ? false : true);
    }) as unknown as typeof fetch;
    let clock = 1_000;
    const opts = { nowMs: () => clock, ttlMs: 5_000 };
    const url = "/api/harthmere/live_mode_quest_state";

    const first = await coalescedHarthmereLiveFetchV1(fetchImpl, url, {}, opts);
    assert.strictEqual((first as any).ok, false);
    // Still within TTL, but the failed response must NOT be cached.
    clock = 1_100;
    const second = await coalescedHarthmereLiveFetchV1(fetchImpl, url, {}, opts);
    assert.strictEqual(calls, 2, "a non-ok response is not reused");
    assert.strictEqual((second as any).ok, true);
  });

  it("evicts a rejected fetch so the next call retries", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("network");
      }
      return fakeResponse("server-ok");
    }) as unknown as typeof fetch;
    const url = "/api/harthmere/live_mode_building_state";
    await assert.rejects(coalescedHarthmereLiveFetchV1(fetchImpl, url, {}));
    const ok = await coalescedHarthmereLiveFetchV1(fetchImpl, url, {});
    assert.strictEqual(calls, 2);
    assert.strictEqual((ok as any)._tag, "server-ok");
  });
});
