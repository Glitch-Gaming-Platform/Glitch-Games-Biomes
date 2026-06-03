/// <reference types="mocha" />
import assert from "assert";
import { resolveHarthmereLiveModeActorIdV1 } from "@/server/harthmere/live_mode_actor_resolution_v1";
import {
  harthmereLiveModeInstallLinkKeyV1,
} from "@/shared/harthmere/live_mode_actor_identity_v1";
import { harthmereLiveModePlayerStateKeyV1 } from "@/shared/harthmere/live_mode_backend_v1";

// In-memory Redis stand-in that records gets/sets so we can assert on the
// install/user healing side effects.
function fakeRedisV1(seed: Record<string, string> = {}) {
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

describe("resolveHarthmereLiveModeActorIdV1 (server healing)", () => {
  it("authed first sighting adopts a stranded install blob into the empty user key", async () => {
    const installId = "25f687dd";
    const userId = "5542414781262472";
    const installKey = harthmereLiveModePlayerStateKeyV1(`install:${installId}`);
    const userKey = harthmereLiveModePlayerStateKeyV1(userId);
    const strandedBlob = '{"level":7,"gold":999,"actorId":"install:25f687dd"}';
    const redis = fakeRedisV1({ [installKey]: strandedBlob });

    const actorId = await resolveHarthmereLiveModeActorIdV1(
      redis,
      {
        auth: { userId: 5542414781262472 },
        unsafeRequest: { query: { install_id: installId } },
      },
      ANON
    );

    assert.strictEqual(actorId, userId);
    // Stranded save recovered into the user key, verbatim.
    assert.strictEqual(redis.store.get(userKey), strandedBlob);
    // install -> user link persisted.
    assert.strictEqual(
      redis.store.get(harthmereLiveModeInstallLinkKeyV1(installId)),
      userId
    );
  });

  it("authed first sighting NEVER overwrites an existing user blob", async () => {
    const installId = "i1";
    const userId = "u1";
    const installKey = harthmereLiveModePlayerStateKeyV1(`install:${installId}`);
    const userKey = harthmereLiveModePlayerStateKeyV1(userId);
    const realUserBlob = '{"level":42,"gold":1}';
    const redis = fakeRedisV1({
      [installKey]: '{"level":7}',
      [userKey]: realUserBlob,
    });

    const actorId = await resolveHarthmereLiveModeActorIdV1(
      redis,
      {
        auth: { userId: "u1" },
        unsafeRequest: { query: { install_id: installId } },
      },
      ANON
    );

    assert.strictEqual(actorId, userId);
    // User's real progress is untouched.
    assert.strictEqual(redis.store.get(userKey), realUserBlob);
    // Link still recorded.
    assert.strictEqual(
      redis.store.get(harthmereLiveModeInstallLinkKeyV1(installId)),
      userId
    );
  });

  it("install-only request converges onto the user key once the link exists", async () => {
    const installId = "i1";
    const userId = "u1";
    const redis = fakeRedisV1({
      [harthmereLiveModeInstallLinkKeyV1(installId)]: userId,
    });

    const actorId = await resolveHarthmereLiveModeActorIdV1(
      redis,
      { unsafeRequest: { query: { install_id: installId } } },
      ANON
    );

    // Pre-cookie request now reads the SAME blob the authed session writes.
    assert.strictEqual(actorId, userId);
    // Read path should not write anything.
    assert.deepStrictEqual(redis.sets, []);
  });

  it("install-only request with no link falls back to the install bucket", async () => {
    const installId = "i1";
    const redis = fakeRedisV1();

    const actorId = await resolveHarthmereLiveModeActorIdV1(
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
    const redis = fakeRedisV1({
      [harthmereLiveModeInstallLinkKeyV1(installId)]: userId,
    });

    const actorId = await resolveHarthmereLiveModeActorIdV1(
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
    const redis = fakeRedisV1();
    const actorId = await resolveHarthmereLiveModeActorIdV1(
      redis,
      { unsafeRequest: {} },
      ANON
    );
    assert.strictEqual(actorId, ANON);
  });
});
