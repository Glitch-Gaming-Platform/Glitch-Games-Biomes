/// <reference types="mocha" />
import assert from "assert";
import {
  resolveHarthmereLiveModeActorContext,
  resolveHarthmereLiveModeActorId,
} from "@/server/harthmere/live_mode_actor_resolution";
import {
  harthmereLiveModeInstallGameUserLinkKey,
  harthmereLiveModeInstallLinkKey,
} from "@/shared/harthmere/live_mode_actor_identity";
import { harthmereLiveModePlayerStateKey } from "@/shared/harthmere/live_mode_backend";

// In-memory Redis stand-in that records gets/sets so we can assert on the
// install/user healing side effects.
function fakeRedis(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  const sets: Array<{ key: string; value: string }> = [];
  return {
    store,
    sets,
    primary: {
      async get(key: string) {
        return store.has(key) ? store.get(key)! : null;
      },
      async set(key: string, value: string) {
        store.set(key, value);
        sets.push({ key, value });
        return "OK";
      },
    },
  };
}

const ANON = "anonymous:test-reader";

describe("resolveHarthmereLiveModeActorId (server healing)", () => {
  it("authed first sighting plans stranded install adoption without writing gameplay state", async () => {
    const installId = "25f687dd";
    const userId = "5542414781262472";
    const installKey = harthmereLiveModePlayerStateKey(`install:${installId}`);
    const userKey = harthmereLiveModePlayerStateKey(userId);
    const strandedBlob = '{"level":7,"gold":999,"actorId":"install:25f687dd"}';
    const redis = fakeRedis({ [installKey]: strandedBlob });

    const context = await resolveHarthmereLiveModeActorContext(
      redis,
      {
        auth: { userId: 5542414781262472 },
        unsafeRequest: { query: { install_id: installId } },
      },
      ANON
    );

    assert.strictEqual(context.actorId, userId);
    assert.deepStrictEqual(context.stateAdoption, {
      fromActorId: `install:${installId}`,
      fromStateKey: installKey,
      toActorId: userId,
      toStateKey: userKey,
      reason: "install_orphan",
    });
    // The resolver no longer copies gameplay state; the live-mode writer adopts
    // and deletes duplicate state in its WATCH/MULTI transaction.
    assert.strictEqual(redis.store.get(userKey), undefined);
    assert.strictEqual(redis.store.get(installKey), strandedBlob);
    // install -> user link persisted.
    assert.strictEqual(
      redis.store.get(harthmereLiveModeInstallLinkKey(installId)),
      userId
    );
  });

  it("authed first sighting NEVER overwrites an existing user blob", async () => {
    const installId = "i1";
    const userId = "u1";
    const installKey = harthmereLiveModePlayerStateKey(`install:${installId}`);
    const userKey = harthmereLiveModePlayerStateKey(userId);
    const realUserBlob = '{"level":42,"gold":1}';
    const redis = fakeRedis({
      [installKey]: '{"level":7}',
      [userKey]: realUserBlob,
    });

    const context = await resolveHarthmereLiveModeActorContext(
      redis,
      {
        auth: { userId: "u1" },
        unsafeRequest: { query: { install_id: installId } },
      },
      ANON
    );

    assert.strictEqual(context.actorId, userId);
    assert.deepStrictEqual(context.stateAdoption, {
      fromActorId: `install:${installId}`,
      fromStateKey: installKey,
      toActorId: userId,
      toStateKey: userKey,
      reason: "install_orphan",
    });
    // User's real progress is untouched.
    assert.strictEqual(redis.store.get(userKey), realUserBlob);
    // Link still recorded.
    assert.strictEqual(
      redis.store.get(harthmereLiveModeInstallLinkKey(installId)),
      userId
    );
  });

  it("install-only request converges onto the user key once the link exists", async () => {
    const installId = "i1";
    const userId = "u1";
    const redis = fakeRedis({
      [harthmereLiveModeInstallLinkKey(installId)]: userId,
    });

    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { unsafeRequest: { query: { install_id: installId } } },
      ANON
    );

    // Pre-cookie request now reads the SAME blob the authed session writes.
    assert.strictEqual(actorId, userId);
    // Read path should not write anything.
    assert.deepStrictEqual(redis.sets, []);
  });

  it("read-only resolution never writes links or state-adoption plans", async () => {
    const installId = "i1";
    const userId = "u1";
    const redis = fakeRedis();

    const context = await resolveHarthmereLiveModeActorContext(
      redis,
      {
        auth: { userId },
        unsafeRequest: { query: { install_id: installId } },
      },
      ANON,
      {
        allowIdentityWrites: false,
        allowStateAdoptionPlan: false,
      }
    );

    assert.strictEqual(context.actorId, userId);
    assert.strictEqual(context.stateAdoption, undefined);
    assert.deepStrictEqual(redis.sets, []);
    assert.strictEqual(
      redis.store.get(harthmereLiveModeInstallLinkKey(installId)),
      undefined
    );
  });

  it("stable Glitch game-user link wins after deploy and plans old live blob adoption", async () => {
    const installId = "25f687dd";
    const oldUserId = "8711576235822475";
    const newUserId = "7804034240681026";
    const gameUserId = "glitch:43af071c-9922-4e02-ba46-32ee2b7479a6";
    const oldUserStateKey = harthmereLiveModePlayerStateKey(oldUserId);
    const gameUserStateKey = harthmereLiveModePlayerStateKey(gameUserId);
    const oldUserBlob = '{"level":1,"gold":96,"actorId":"8711576235822475"}';
    const redis = fakeRedis({
      [harthmereLiveModeInstallLinkKey(installId)]: oldUserId,
      [harthmereLiveModeInstallGameUserLinkKey(installId)]: gameUserId,
      [oldUserStateKey]: oldUserBlob,
    });

    const context = await resolveHarthmereLiveModeActorContext(
      redis,
      {
        auth: { userId: newUserId },
        unsafeRequest: { query: { install_id: installId } },
      },
      ANON
    );

    assert.strictEqual(context.actorId, gameUserId);
    assert.deepStrictEqual(context.stateAdoption, {
      fromActorId: oldUserId,
      fromStateKey: oldUserStateKey,
      toActorId: gameUserId,
      toStateKey: gameUserStateKey,
      reason: "linked_game_user",
    });
    assert.strictEqual(redis.store.get(gameUserStateKey), undefined);
    assert.strictEqual(redis.store.get(oldUserStateKey), oldUserBlob);
  });

  it("install-only request with no link falls back to the install bucket", async () => {
    const installId = "i1";
    const redis = fakeRedis();

    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { unsafeRequest: { query: { install_id: installId } } },
      ANON
    );

    assert.strictEqual(actorId, "install:i1");
    assert.deepStrictEqual(redis.sets, []);
  });

  it("already-linked authed request takes the fast path (no link rewrite, no orphan read)", async () => {
    const installId = "i1";
    const userId = "u1";
    const redis = fakeRedis({
      [harthmereLiveModeInstallLinkKey(installId)]: userId,
    });

    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      {
        auth: { userId: "u1" },
        unsafeRequest: { query: { install_id: installId } },
      },
      ANON
    );

    assert.strictEqual(actorId, userId);
    // Authed path does not read the link (it knows its user id); since the link
    // already matches, the plan does no writes.
    assert.deepStrictEqual(redis.sets, []);
  });

  it("anonymous request resolves to the provided fallback", async () => {
    const redis = fakeRedis();
    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { unsafeRequest: {} },
      ANON
    );
    assert.strictEqual(actorId, ANON);
  });
});
