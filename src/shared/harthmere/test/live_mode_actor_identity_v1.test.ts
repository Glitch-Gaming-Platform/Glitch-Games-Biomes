/// <reference types="mocha" />
import assert from "assert";
import {
  harthmereLiveModeInstallActorIdV1,
  harthmereLiveModeInstallIdFromRequestV1,
  harthmereLiveModeInstallLinkKeyV1,
  planHarthmereLiveModeActorKeyV1,
  resolveHarthmereLiveModeActorIdentityV1,
  shouldAdoptHarthmereInstallOrphanV1,
} from "../live_mode_actor_identity_v1";

// HARTHMERE_LIVE_MODE_ACTOR_IDENTITY_V1
// Locks the invariant behind the save/load split-brain bug: the same physical
// player must resolve to ONE player_state key, and progress stranded under an
// `install:` bucket must be recoverable without ever overwriting real data.
describe("Harthmere live-mode actor identity resolution", () => {
  describe("install id extraction", () => {
    it("reads install_id / installId from query and the header", () => {
      assert.strictEqual(
        harthmereLiveModeInstallIdFromRequestV1({ query: { install_id: "abc" } }),
        "abc"
      );
      assert.strictEqual(
        harthmereLiveModeInstallIdFromRequestV1({ query: { installId: "def" } }),
        "def"
      );
      assert.strictEqual(
        harthmereLiveModeInstallIdFromRequestV1({
          headers: { "x-glitch-install-id": "ghi" },
        }),
        "ghi"
      );
    });

    it("trims and unwraps array-valued query params", () => {
      assert.strictEqual(
        harthmereLiveModeInstallIdFromRequestV1({
          query: { install_id: ["  spaced  ", "second"] },
        }),
        "spaced"
      );
    });

    it("returns undefined when nothing usable is present", () => {
      assert.strictEqual(
        harthmereLiveModeInstallIdFromRequestV1({ query: { install_id: "   " } }),
        undefined
      );
      assert.strictEqual(
        harthmereLiveModeInstallIdFromRequestV1({}),
        undefined
      );
    });
  });

  describe("identity resolution keeps the install id even when authed", () => {
    it("captures userId AND installId together for an authed request", () => {
      assert.deepStrictEqual(
        resolveHarthmereLiveModeActorIdentityV1({
          auth: { userId: 5542414781262472 },
          unsafeRequest: { query: { install_id: "25f687dd" } },
        }),
        { userId: "5542414781262472", installId: "25f687dd" }
      );
    });

    it("treats userId 0 as authed (defined, not falsy-dropped)", () => {
      // BiomesId is a branded number; auth.userId === 0 must still count as authed.
      assert.deepStrictEqual(
        resolveHarthmereLiveModeActorIdentityV1({
          auth: { userId: 0 },
          unsafeRequest: {},
        }),
        { userId: "0", installId: undefined }
      );
    });

    it("install-only request has no userId", () => {
      assert.deepStrictEqual(
        resolveHarthmereLiveModeActorIdentityV1({
          unsafeRequest: { query: { install_id: "25f687dd" } },
        }),
        { userId: undefined, installId: "25f687dd" }
      );
    });
  });

  describe("key planning + convergence", () => {
    const fallback = "anonymous:reader";

    it("authed with no install id -> user key, no bookkeeping", () => {
      const plan = planHarthmereLiveModeActorKeyV1({
        userId: "u1",
        anonymousFallback: fallback,
      });
      assert.strictEqual(plan.actorId, "u1");
      assert.strictEqual(plan.writeInstallLink, undefined);
      assert.strictEqual(plan.considerInstallOrphan, undefined);
    });

    it("first authed sighting of an install -> user key + writes link + checks for orphan", () => {
      const plan = planHarthmereLiveModeActorKeyV1({
        userId: "u1",
        installId: "i1",
        anonymousFallback: fallback,
      });
      assert.strictEqual(plan.actorId, "u1");
      assert.deepStrictEqual(plan.writeInstallLink, {
        installId: "i1",
        userId: "u1",
      });
      assert.deepStrictEqual(plan.considerInstallOrphan, {
        installId: "i1",
        userId: "u1",
      });
    });

    it("already-linked authed request stays on the fast path (no link write, no orphan check)", () => {
      const plan = planHarthmereLiveModeActorKeyV1({
        userId: "u1",
        installId: "i1",
        linkedUserId: "u1",
        anonymousFallback: fallback,
      });
      assert.strictEqual(plan.actorId, "u1");
      assert.strictEqual(plan.writeInstallLink, undefined);
      assert.strictEqual(plan.considerInstallOrphan, undefined);
    });

    it("stale link pointing elsewhere is re-pointed but NEVER adopts the other user's blob", () => {
      const plan = planHarthmereLiveModeActorKeyV1({
        userId: "u2",
        installId: "i1",
        linkedUserId: "u1",
        anonymousFallback: fallback,
      });
      assert.strictEqual(plan.actorId, "u2");
      assert.deepStrictEqual(plan.writeInstallLink, {
        installId: "i1",
        userId: "u2",
      });
      // Critical safety invariant: the install:i1 blob belongs to u1, so it must
      // NOT be copied into u2 even though u2 may be empty.
      assert.strictEqual(
        plan.considerInstallOrphan,
        undefined,
        "must not bleed a previously-linked user's save into a different user"
      );
    });

    it("install-only WITHOUT a known link falls back to the per-install bucket", () => {
      const plan = planHarthmereLiveModeActorKeyV1({
        installId: "i1",
        anonymousFallback: fallback,
      });
      assert.strictEqual(plan.actorId, harthmereLiveModeInstallActorIdV1("i1"));
      assert.strictEqual(plan.actorId, "install:i1");
    });

    it("install-only WITH a known link converges onto the user key", () => {
      // This is the core fix: a pre-cookie request now reads the SAME blob the
      // authed request writes, instead of forking install:i1.
      const plan = planHarthmereLiveModeActorKeyV1({
        installId: "i1",
        linkedUserId: "u1",
        anonymousFallback: fallback,
      });
      assert.strictEqual(plan.actorId, "u1");
    });

    it("no userId and no installId -> anonymous fallback", () => {
      const plan = planHarthmereLiveModeActorKeyV1({
        anonymousFallback: fallback,
      });
      assert.strictEqual(plan.actorId, fallback);
    });

    it("blank-string ids are ignored like missing ones", () => {
      const plan = planHarthmereLiveModeActorKeyV1({
        userId: "   ",
        installId: "   ",
        anonymousFallback: fallback,
      });
      assert.strictEqual(plan.actorId, fallback);
    });
  });

  describe("orphan adoption guard (never loses data)", () => {
    it("adopts when the user has no blob but the install does", () => {
      assert.strictEqual(
        shouldAdoptHarthmereInstallOrphanV1({
          userStateRaw: null,
          installStateRaw: '{"level":7,"gold":999}',
        }),
        true
      );
    });

    it("does NOT adopt when the user already has a blob", () => {
      assert.strictEqual(
        shouldAdoptHarthmereInstallOrphanV1({
          userStateRaw: '{"level":1}',
          installStateRaw: '{"level":7}',
        }),
        false
      );
    });

    it("does NOT adopt when there is no install blob to adopt", () => {
      assert.strictEqual(
        shouldAdoptHarthmereInstallOrphanV1({
          userStateRaw: null,
          installStateRaw: null,
        }),
        false
      );
    });

    it("treats whitespace-only blobs as empty on both sides", () => {
      assert.strictEqual(
        shouldAdoptHarthmereInstallOrphanV1({
          userStateRaw: "   ",
          installStateRaw: "   ",
        }),
        false
      );
      assert.strictEqual(
        shouldAdoptHarthmereInstallOrphanV1({
          userStateRaw: "   ",
          installStateRaw: '{"level":7}',
        }),
        true
      );
    });
  });

  describe("key helpers", () => {
    it("install link key is namespaced and stable", () => {
      assert.strictEqual(
        harthmereLiveModeInstallLinkKeyV1("i1"),
        "harthmere:live_mode:v1:install_user_link:i1"
      );
    });
  });
});
