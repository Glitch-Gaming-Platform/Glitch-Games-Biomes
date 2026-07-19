/// <reference types="mocha" />
import assert from "assert";
import {
  acquireHarthmereActorStateLock,
  compareAndSetHarthmereActorState,
  harthmereLiveModeActorLockKey,
} from "@/server/harthmere/live_mode_actor_state_authority";

function fakeAuthorityRedis(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  return {
    store,
    redis: {
      async get(key: string) {
        return store.get(key) ?? null;
      },
      async set(key: string, value: string, ...args: unknown[]) {
        if (args.includes("NX") && store.has(key)) return null;
        store.set(key, value);
        return "OK";
      },
      async eval(
        _script: string,
        _numberOfKeys: number,
        ...args: Array<string | number>
      ) {
        const key = String(args[0]);
        const expected = String(args[1]);
        const replacement =
          args[2] === undefined ? undefined : String(args[2]);
        if (store.get(key) !== expected) return 0;
        if (replacement === undefined) store.delete(key);
        else store.set(key, replacement);
        return 1;
      },
    },
  };
}

describe("Harthmere actor state authority", () => {
  it("allows only one cross-request writer for an actor at a time", async () => {
    const { redis, store } = fakeAuthorityRedis();
    const first = await acquireHarthmereActorStateLock(redis, "player-1", {
      waitMs: 0,
    });
    const blocked = await acquireHarthmereActorStateLock(redis, "player-1", {
      waitMs: 0,
    });

    assert.equal(first.acquired, true);
    assert.equal(blocked.acquired, false);

    await first.release();
    assert.equal(store.has(harthmereLiveModeActorLockKey("player-1")), false);

    const next = await acquireHarthmereActorStateLock(redis, "player-1", {
      waitMs: 0,
    });
    assert.equal(next.acquired, true);
    await next.release();
  });

  it("never lets an expired holder release a newer actor lock", async () => {
    const { redis, store } = fakeAuthorityRedis();
    const lock = await acquireHarthmereActorStateLock(redis, "player-2", {
      waitMs: 0,
    });
    const key = harthmereLiveModeActorLockKey("player-2");
    store.set(key, "newer-holder-token");

    await lock.release();

    assert.equal(store.get(key), "newer-holder-token");
  });

  it("rejects a stale status replacement after a newer mutation commits", async () => {
    const key = "harthmere:live_mode:current:player:player-3";
    const original = JSON.stringify({ stamina: 100, items: {} });
    const newer = JSON.stringify({ stamina: 100, items: { baker_apron: 1 } });
    const staleStatus = JSON.stringify({ stamina: 99, items: {} });
    const { redis, store } = fakeAuthorityRedis({ [key]: original });

    store.set(key, newer);
    const persisted = await compareAndSetHarthmereActorState(
      redis,
      key,
      original,
      staleStatus
    );

    assert.equal(persisted, false);
    assert.equal(store.get(key), newer);
  });
});
