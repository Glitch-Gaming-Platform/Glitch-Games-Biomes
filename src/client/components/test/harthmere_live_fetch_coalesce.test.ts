/// <reference types="mocha" />
import assert from "assert";
import {
  coalescedHarthmereLiveFetch,
  isHarthmereLiveFetchAbortError,
  planHarthmereLiveFetchCache,
  resetHarthmereLiveFetchCache,
} from "@/client/components/harthmere_live_fetch";

// HARTHMERE_LIVE_FETCH_COALESCE
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
  beforeEach(() => resetHarthmereLiveFetchCache());

  describe("planHarthmereLiveFetchCache", () => {
    it("caches idempotent GETs by url", () => {
      assert.deepStrictEqual(
        planHarthmereLiveFetchCache({
          url: "/api/harthmere/live_mode_building_state",
        }),
        { cacheable: true, key: "GET /api/harthmere/live_mode_building_state" }
      );
    });

    it("never caches POSTs", () => {
      assert.deepStrictEqual(
        planHarthmereLiveFetchCache({
          method: "POST",
          url: "/api/harthmere/live_mode",
        }),
        { cacheable: false }
      );
    });

    it("never caches requests carrying a caller signal", () => {
      assert.deepStrictEqual(
        planHarthmereLiveFetchCache({ url: "/x", hasCustomSignal: true }),
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
    const a = coalescedHarthmereLiveFetch(fetchImpl, url, {});
    const b = coalescedHarthmereLiveFetch(fetchImpl, url, {});
    gate.resolve(fakeResponse("server-1"));
    const [ra, rb] = await Promise.all([a, b]);

    assert.strictEqual(
      calls,
      1,
      "the second concurrent GET must reuse the first"
    );
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

    await coalescedHarthmereLiveFetch(fetchImpl, url, {}, opts);
    clock = 1_500; // within TTL
    await coalescedHarthmereLiveFetch(fetchImpl, url, {}, opts);
    assert.strictEqual(
      calls,
      1,
      "a GET within the TTL window reuses the cached response"
    );

    clock = 2_600; // past TTL
    await coalescedHarthmereLiveFetch(fetchImpl, url, {}, opts);
    assert.strictEqual(
      calls,
      2,
      "after the TTL expires the endpoint is fetched again"
    );
  });

  it("does NOT coalesce different urls", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return fakeResponse(`server-${calls}`);
    }) as unknown as typeof fetch;
    await coalescedHarthmereLiveFetch(
      fetchImpl,
      "/api/harthmere/live_mode_quest_state",
      {}
    );
    await coalescedHarthmereLiveFetch(
      fetchImpl,
      "/api/harthmere/live_mode_building_state",
      {}
    );
    assert.strictEqual(calls, 2);
  });

  it("does NOT coalesce POST mutations", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return fakeResponse(`server-${calls}`);
    }) as unknown as typeof fetch;
    const url = "/api/harthmere/live_mode";
    await coalescedHarthmereLiveFetch(fetchImpl, url, { method: "POST" });
    await coalescedHarthmereLiveFetch(fetchImpl, url, { method: "POST" });
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

    const first = await coalescedHarthmereLiveFetch(fetchImpl, url, {}, opts);
    assert.strictEqual((first as any).ok, false);
    // Still within TTL, but the failed response must NOT be cached.
    clock = 1_100;
    const second = await coalescedHarthmereLiveFetch(
      fetchImpl,
      url,
      {},
      opts
    );
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
    await assert.rejects(coalescedHarthmereLiveFetch(fetchImpl, url, {}));
    const ok = await coalescedHarthmereLiveFetch(fetchImpl, url, {});
    assert.strictEqual(calls, 2);
    assert.strictEqual((ok as any)._tag, "server-ok");
  });

  it("turns its own timeout abort into a non-ok response instead of an uncaught page error", async () => {
    let calls = 0;
    const fetchImpl = (async (
      _input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      calls += 1;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(
            new DOMException("signal is aborted without reason", "AbortError")
          );
        });
      });
    }) as unknown as typeof fetch;

    const response = await coalescedHarthmereLiveFetch(
      fetchImpl,
      "/api/harthmere/live_mode_player_status_state",
      { timeoutMs: 1 }
    );
    assert.equal(response.ok, false);
    assert.equal(response.status, 504);
    assert.deepEqual(await response.json(), {
      error: "harthmere_live_fetch_timeout",
      timeoutMs: 1,
    });
    assert.equal(calls, 1);
  });

  it("does not cache a timeout response, so the next poll can recover immediately", async () => {
    let calls = 0;
    const fetchImpl = (async (
      _input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      calls += 1;
      if (calls === 1) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(
              new DOMException("signal is aborted without reason", "AbortError")
            );
          });
        });
      }
      return fakeResponse("recovered");
    }) as unknown as typeof fetch;

    const url = "/api/harthmere/live_mode_player_status_state";
    const first = await coalescedHarthmereLiveFetch(fetchImpl, url, {
      timeoutMs: 1,
    });
    assert.equal(first.ok, false);
    const second = await coalescedHarthmereLiveFetch(fetchImpl, url, {});
    assert.equal(calls, 2);
    assert.equal((second as any)._tag, "recovered");
  });

  it("recognizes the browser abort errors produced by timed out fetches", () => {
    assert.equal(
      isHarthmereLiveFetchAbortError(
        new DOMException("signal is aborted without reason", "AbortError")
      ),
      true
    );
    const abort = new Error("The operation was aborted.");
    abort.name = "AbortError";
    assert.equal(isHarthmereLiveFetchAbortError(abort), true);
    assert.equal(isHarthmereLiveFetchAbortError(new Error("network")), false);
  });
});
