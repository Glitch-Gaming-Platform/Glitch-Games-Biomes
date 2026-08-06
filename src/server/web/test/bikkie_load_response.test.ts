/// <reference types="mocha" />
import type { BakedBiscuitTray } from "@/server/shared/bikkie/registry";
import {
  BikkieLoadResponseCache,
  shouldForceTrayRefresh,
  type BikkieLoadResponseData,
} from "@/server/web/bikkie_load_response";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";
import fs from "fs";
import path from "path";

// HARTHMERE_BIKKIE_LOAD_RESPONSE_CACHE (2026-08-04 asset loading audit)
//
// `/api/bikkie` is on every client's boot path. It rebuilt the whole response --
// a zRPC serialize per biscuit plus a conformsWith per (biscuit x schema) -- for
// every request, and forced a full Bikkie storage reload for every cold client.

const trayId = (n: number) => n as unknown as BiomesId;

function fakeTray(id: number): BakedBiscuitTray {
  return { id: trayId(id), contents: new Map() } as unknown as BakedBiscuitTray;
}

function countingEncoder() {
  const calls: BiomesId[] = [];
  const encode = (tray: BakedBiscuitTray): BikkieLoadResponseData => {
    calls.push(tray.id);
    return { trayId: tray.id, encoded: [], schemas: [] };
  };
  return { calls, encode };
}

describe("Bikkie load response cache", () => {
  it("encodes a tray once and reuses it", () => {
    const cache = new BikkieLoadResponseCache();
    const { calls, encode } = countingEncoder();
    const tray = fakeTray(1);

    const first = cache.encode(tray, encode);
    for (let i = 0; i < 50; i += 1) {
      assert.equal(cache.encode(tray, encode), first);
    }

    assert.deepEqual(calls, [trayId(1)]);
    assert.equal(cache.hits, 50);
    assert.equal(cache.misses, 1);
  });

  it("keeps two trays so a publish or rolling deploy cannot thrash", () => {
    // During a content publish, clients ask for the outgoing and incoming tray
    // at the same time. A single-slot cache would re-encode on every alternation.
    const cache = new BikkieLoadResponseCache();
    const { calls, encode } = countingEncoder();
    const outgoing = fakeTray(1);
    const incoming = fakeTray(2);

    for (let i = 0; i < 10; i += 1) {
      cache.encode(outgoing, encode);
      cache.encode(incoming, encode);
    }

    assert.deepEqual(calls, [trayId(1), trayId(2)]);
    assert.equal(cache.size, 2);
  });

  it("evicts the least recently used tray beyond its bound", () => {
    const cache = new BikkieLoadResponseCache(2);
    const { calls, encode } = countingEncoder();

    cache.encode(fakeTray(1), encode);
    cache.encode(fakeTray(2), encode);
    cache.encode(fakeTray(1), encode); // refreshes recency of tray 1
    cache.encode(fakeTray(3), encode); // evicts tray 2

    assert.equal(cache.size, 2);
    cache.encode(fakeTray(1), encode); // still cached
    cache.encode(fakeTray(2), encode); // re-encoded
    assert.deepEqual(calls, [trayId(1), trayId(2), trayId(3), trayId(2)]);
  });

  it("does not grow without bound", () => {
    const cache = new BikkieLoadResponseCache(2);
    const { encode } = countingEncoder();
    for (let i = 0; i < 100; i += 1) {
      cache.encode(fakeTray(i), encode);
    }
    assert.equal(cache.size, 2);
  });

  it("returns the same object identity, so callers must not mutate", () => {
    const cache = new BikkieLoadResponseCache();
    const { encode } = countingEncoder();
    const tray = fakeTray(7);
    assert.strictEqual(cache.encode(tray, encode), cache.encode(tray, encode));
  });
});

describe("Bikkie tray refresh policy", () => {
  it("does not force a storage reload for a cold client", () => {
    // The regression this replaces: `expectedTrayId !== currentTray.id` was true
    // for every first-ever load, so each one paid a full storage.load() and a
    // re-register of the shared BikkieRuntime.
    assert.equal(shouldForceTrayRefresh(undefined, trayId(5)), false);
  });

  it("does not force when the client already has the current tray", () => {
    assert.equal(shouldForceTrayRefresh(trayId(5), trayId(5)), false);
  });

  it("forces when the client names a tray this process does not have", () => {
    // This is the case the force exists for: our view is genuinely behind.
    assert.equal(shouldForceTrayRefresh(trayId(6), trayId(5)), true);
  });

  it("is what the API handler uses", () => {
    const handler = fs.readFileSync(
      path.join(process.cwd(), "src/pages/api/bikkie.ts"),
      "utf8"
    );
    assert.match(
      handler,
      /shouldForceTrayRefresh\(expectedTrayId, currentTray\.id\)/
    );
    assert.match(handler, /responseCache\.encode\(tray\)/);
    // The immutable cache header must still only be set when the client asked
    // for exactly this tray, or an unversioned response would be pinned forever.
    assert.match(
      handler,
      /if \(expectedTrayId === tray\.id\) \{[\s\S]*?immutable/
    );
  });
});
