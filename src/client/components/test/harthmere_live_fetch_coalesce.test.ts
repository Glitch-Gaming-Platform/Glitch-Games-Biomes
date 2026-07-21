/// <reference types="mocha" />
import assert from "assert";
import {
  coalescedHarthmereLiveFetch,
  isHarthmereLiveFetchAbortError,
  planHarthmereLiveFetchCache,
  prepareHarthmereLiveFetchRequest,
  resetHarthmereLiveFetchCache,
  resetHarthmereLiveMutationLocksForTest,
  runHarthmereLiveMutationOnce,
  runHarthmereLiveMutationSerially,
  resetHarthmereLiveInstallIdForTest,
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

const originalWindow = (globalThis as any).window;

function setFakeWindow(
  search: string,
  storedInstallId?: string,
  biomesSession?: { userId: string; sessionId: string }
) {
  (globalThis as any).window = {
    location: {
      href: `https://www.glitch.fun/games/test/play${search}`,
      origin: "https://www.glitch.fun",
      search,
    },
    __HARTHMERE_BIOMES_AUTH_SESSION: biomesSession,
    localStorage: {
      getItem(key: string) {
        return key === "biomes.glitch.installId"
          ? storedInstallId ?? null
          : null;
      },
    },
  };
}

describe("harthmere live fetch coalescing", () => {
  beforeEach(() => {
    resetHarthmereLiveFetchCache();
    resetHarthmereLiveMutationLocksForTest();
    // The sticky install-id cache is module-global; without this reset an
    // earlier test's install id leaks into later cache-key assertions.
    resetHarthmereLiveInstallIdForTest();
  });

  it("deduplicates semantic mutations until the first request settles", async () => {
    let calls = 0;
    const gate = deferred<string>();
    const operation = () => {
      calls += 1;
      return gate.promise;
    };
    const first = runHarthmereLiveMutationOnce("equipment:chest", operation);
    const second = runHarthmereLiveMutationOnce("equipment:chest", operation);
    assert.equal(first, second);
    assert.equal(calls, 1);
    gate.resolve("equipped");
    assert.equal(await second, "equipped");

    assert.equal(
      await runHarthmereLiveMutationOnce("equipment:chest", async () => {
        calls += 1;
        return "unequipped";
      }),
      "unequipped"
    );
    assert.equal(calls, 2);
  });

  it("serializes crate, equipment, and drop mutations in player action order", async () => {
    const firstGate = deferred<void>();
    const order: string[] = [];
    const first = runHarthmereLiveMutationSerially(
      "inventory-equipment",
      async () => {
        order.push("crate:start");
        await firstGate.promise;
        order.push("crate:end");
        return "crate";
      }
    );
    const second = runHarthmereLiveMutationSerially(
      "inventory-equipment",
      async () => {
        order.push("equip");
        return "equip";
      }
    );
    const third = runHarthmereLiveMutationSerially(
      "inventory-equipment",
      async () => {
        order.push("drop");
        return "drop";
      }
    );

    await Promise.resolve();
    assert.deepEqual(order, ["crate:start"]);
    firstGate.resolve();
    assert.deepEqual(await Promise.all([first, second, third]), [
      "crate",
      "equip",
      "drop",
    ]);
    assert.deepEqual(order, ["crate:start", "crate:end", "equip", "drop"]);
  });
  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  });

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

  it("keeps a slow pending GET coalesced after the response TTL expires", async () => {
    let calls = 0;
    const gate = deferred<Response>();
    const fetchImpl = (async () => {
      calls += 1;
      return gate.promise;
    }) as unknown as typeof fetch;

    let clock = 1_000;
    const nowMs = () => clock;
    const url = "/api/harthmere/live_mode_inventory_loot_state";
    const first = coalescedHarthmereLiveFetch(
      fetchImpl,
      url,
      {},
      {
        nowMs,
        ttlMs: 1_000,
      }
    );
    clock = 21_000;
    const second = coalescedHarthmereLiveFetch(
      fetchImpl,
      url,
      {},
      {
        nowMs,
        ttlMs: 1_000,
      }
    );

    assert.equal(calls, 1, "pending work must not age out of coalescing");
    gate.resolve(fakeResponse("slow-server"));
    const [a, b] = await Promise.all([first, second]);
    assert.equal((a as any)._tag, "slow-server");
    assert.equal((b as any)._tag, "slow-server");
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

  it("attaches the stable install id to bare Harthmere live mutations", async () => {
    setFakeWindow("?install_id=install with spaces");
    let capturedUrl = "";
    let capturedHeaders: Headers | undefined;
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : (input as Request).url;
      capturedHeaders = new Headers(init?.headers);
      return fakeResponse("server-install");
    }) as unknown as typeof fetch;

    await coalescedHarthmereLiveFetch(fetchImpl, "/api/harthmere/live_mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    assert.equal(
      capturedUrl,
      "/api/harthmere/live_mode?install_id=install+with+spaces"
    );
    assert.equal(
      capturedHeaders?.get("X-Glitch-Install-Id"),
      "install with spaces"
    );
    assert.equal(capturedHeaders?.get("Content-Type"), "application/json");
  });

  it("attaches the authenticated Biomes session to native ECS requests", () => {
    setFakeWindow("?install_id=glitch-install", "glitch-install", {
      userId: "4626616310484863",
      sessionId: "biomes-session",
    });
    const prepared = prepareHarthmereLiveFetchRequest(
      "/api/harthmere/native_container",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }
    );
    const headers = new Headers(prepared.init.headers);

    assert.equal(headers.get("X-Biomes-User-Id"), "4626616310484863");
    assert.equal(headers.get("X-Biomes-Session-Id"), "biomes-session");
    assert.equal(headers.get("X-Glitch-Install-Id"), null);
    assert.equal(prepared.input, "/api/harthmere/native_container");
  });

  it("keeps Glitch install and Biomes session identities distinct on live mode", () => {
    setFakeWindow("?install_id=glitch-install", "glitch-install", {
      userId: "8889894099659013",
      sessionId: "biomes-session",
    });
    const prepared = prepareHarthmereLiveFetchRequest(
      "/api/harthmere/live_mode",
      { method: "POST" }
    );
    const headers = new Headers(prepared.init.headers);

    assert.equal(headers.get("X-Glitch-Install-Id"), "glitch-install");
    assert.equal(headers.get("X-Biomes-User-Id"), "8889894099659013");
    assert.equal(headers.get("X-Biomes-Session-Id"), "biomes-session");
  });

  it("never sends Harthmere identity headers cross-origin", () => {
    setFakeWindow("?install_id=glitch-install", "glitch-install", {
      userId: "8889894099659013",
      sessionId: "biomes-session",
    });
    const prepared = prepareHarthmereLiveFetchRequest(
      "https://example.test/api/harthmere/live_mode",
      { method: "POST" }
    );
    const headers = new Headers(prepared.init.headers);

    assert.equal(headers.get("X-Glitch-Install-Id"), null);
    assert.equal(headers.get("X-Biomes-User-Id"), null);
    assert.equal(headers.get("X-Biomes-Session-Id"), null);
    assert.equal(
      prepared.input,
      "https://example.test/api/harthmere/live_mode"
    );
  });

  it("does not duplicate existing live-mode install query params", () => {
    setFakeWindow("?install_id=window-install", "stored-install");
    const prepared = prepareHarthmereLiveFetchRequest(
      "/api/harthmere/live_mode_player_status_state?install_id=url-install",
      {}
    );
    assert.equal(
      prepared.input,
      "/api/harthmere/live_mode_player_status_state?install_id=url-install"
    );
    assert.equal(
      new Headers(prepared.init.headers).get("X-Glitch-Install-Id"),
      "url-install"
    );
  });

  it("bypasses browser HTTP cache for live-state GETs while keeping request coalescing", () => {
    const prepared = prepareHarthmereLiveFetchRequest(
      "/api/harthmere/live_mode_daily_state",
      { method: "GET" }
    );

    assert.equal(prepared.init.cache, "no-store");
    assert.deepStrictEqual(
      planHarthmereLiveFetchCache({
        method: prepared.init.method,
        hasCustomSignal: Boolean(prepared.init.signal),
        url: String(prepared.input),
      }),
      { cacheable: true, key: "GET /api/harthmere/live_mode_daily_state" }
    );
  });

  it("strips conditional validators and overrides caller cache mode on live-state GETs", () => {
    const prepared = prepareHarthmereLiveFetchRequest(
      "/api/harthmere/live_mode_inventory_loot_state",
      {
        method: "GET",
        cache: "force-cache",
        headers: {
          "If-None-Match": '"stale-etag"',
          "If-Modified-Since": "Mon, 01 Jan 2024 00:00:00 GMT",
          "If-Range": '"stale-range"',
        },
      }
    );
    const headers = new Headers(prepared.init.headers);

    assert.equal(prepared.init.cache, "no-store");
    assert.equal(headers.has("If-None-Match"), false);
    assert.equal(headers.has("If-Modified-Since"), false);
    assert.equal(headers.has("If-Range"), false);
    assert.equal(headers.get("Cache-Control"), "no-cache");
    assert.equal(headers.get("Pragma"), "no-cache");
  });

  it("clears coalesced live-state reads when a live mutation is sent", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return fakeResponse(`server-${calls}`);
    }) as unknown as typeof fetch;
    let clock = 1_000;
    const opts = { nowMs: () => clock, ttlMs: 5_000 };
    const readUrl = "/api/harthmere/live_mode_inventory_loot_state";

    await coalescedHarthmereLiveFetch(fetchImpl, readUrl, {}, opts);
    clock = 1_100;
    await coalescedHarthmereLiveFetch(fetchImpl, readUrl, {}, opts);
    assert.equal(calls, 1, "pre-mutation reads should still coalesce");

    await coalescedHarthmereLiveFetch(
      fetchImpl,
      "/api/harthmere/live_mode",
      { method: "POST" },
      opts
    );
    assert.equal(calls, 2, "the mutation itself must reach the backend");

    clock = 1_200;
    await coalescedHarthmereLiveFetch(fetchImpl, readUrl, {}, opts);
    assert.equal(
      calls,
      3,
      "post-mutation reads must not reuse a stale pre-mutation snapshot"
    );
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
    const second = await coalescedHarthmereLiveFetch(fetchImpl, url, {}, opts);
    assert.strictEqual(calls, 2, "a non-ok response is not reused");
    assert.strictEqual((second as any).ok, true);
  });

  it("retries a failed GET once, then recovers transparently", async () => {
    // HARTHMERE_LIVE_FETCH_TIMEOUT_RETRY: reads are idempotent, so a single
    // network failure is retried in place and the caller never sees it.
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("network");
      }
      return fakeResponse("server-ok");
    }) as unknown as typeof fetch;
    const url = "/api/harthmere/live_mode_building_state";
    const ok = await coalescedHarthmereLiveFetch(fetchImpl, url, {});
    assert.strictEqual(calls, 2);
    assert.strictEqual((ok as any)._tag, "server-ok");
  });

  it("evicts a rejected fetch (all attempts failed) so the next call retries", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      // Exhaust both GET attempts of the first fetch.
      if (calls <= 2) {
        throw new Error("network");
      }
      return fakeResponse("server-ok");
    }) as unknown as typeof fetch;
    const url = "/api/harthmere/live_mode_building_state";
    await assert.rejects(coalescedHarthmereLiveFetch(fetchImpl, url, {}));
    const ok = await coalescedHarthmereLiveFetch(fetchImpl, url, {});
    assert.strictEqual(calls, 3);
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
      attempts: 2,
    });
    // HARTHMERE_LIVE_FETCH_TIMEOUT_RETRY: a timed-out GET is retried once
    // before the synthesized 504 is returned.
    assert.equal(calls, 2);
  });

  it("does not cache a timeout response, so the next poll can recover immediately", async () => {
    let calls = 0;
    const fetchImpl = (async (
      _input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      calls += 1;
      // Exhaust both GET attempts of the first fetch with timeouts.
      if (calls <= 2) {
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
    assert.equal(calls, 3);
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
