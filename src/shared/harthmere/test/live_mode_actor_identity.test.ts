/// <reference types="mocha" />
import assert from "assert";
import {
  harthmereLiveModeInstallActorId,
  harthmereLiveModeInstallGameUserLinkKey,
  harthmereLiveModeInstallIdFromRequest,
  harthmereLiveModeInstallLinkKey,
  planHarthmereLiveModeActorKey,
  resolveHarthmereLiveModeActorIdentity,
  shouldAdoptHarthmereInstallOrphan,
} from "../live_mode_actor_identity";

// HARTHMERE_LIVE_MODE_ACTOR_IDENTITY
// Locks the invariant behind the save/load split-brain bug: the same physical
// player must resolve to ONE player_state key, and progress stranded under an
// `install:` bucket must be recoverable without ever overwriting real data.
describe("Harthmere live-mode actor identity resolution", () => {
  describe("install id extraction", () => {
    it("reads install_id / installId from query and the header", () => {
      assert.strictEqual(
        harthmereLiveModeInstallIdFromRequest({
          query: { install_id: "abc" },
        }),
        "abc"
      );
      assert.strictEqual(
        harthmereLiveModeInstallIdFromRequest({
          query: { installId: "def" },
        }),
        "def"
      );
      assert.strictEqual(
        harthmereLiveModeInstallIdFromRequest({
          headers: { "x-glitch-install-id": "ghi" },
        }),
        "ghi"
      );
    });

    it("trims and unwraps array-valued query params", () => {
      assert.strictEqual(
        harthmereLiveModeInstallIdFromRequest({
          query: { install_id: ["  spaced  ", "second"] },
        }),
        "spaced"
      );
    });

    it("returns undefined when nothing usable is present", () => {
      assert.strictEqual(
        harthmereLiveModeInstallIdFromRequest({
          query: { install_id: "   " },
        }),
        undefined
      );
      assert.strictEqual(
        harthmereLiveModeInstallIdFromRequest({}),
        undefined
      );
    });
  });

  describe("identity resolution keeps the install id even when authed", () => {
    it("captures userId AND installId together for an authed request", () => {
      assert.deepStrictEqual(
        resolveHarthmereLiveModeActorIdentity({
          auth: { userId: 5542414781262472 },
          unsafeRequest: { query: { install_id: "25f687dd" } },
        }),
        { userId: "5542414781262472", installId: "25f687dd" }
      );
    });

    it("treats userId 0 as authed (defined, not falsy-dropped)", () => {
      // BiomesId is a branded number; auth.userId === 0 must still count as authed.
      assert.deepStrictEqual(
        resolveHarthmereLiveModeActorIdentity({
          auth: { userId: 0 },
          unsafeRequest: {},
        }),
        { userId: "0", installId: undefined }
      );
    });

    it("install-only request has no userId", () => {
      assert.deepStrictEqual(
        resolveHarthmereLiveModeActorIdentity({
          unsafeRequest: { query: { install_id: "25f687dd" } },
        }),
        { userId: undefined, installId: "25f687dd" }
      );
    });
  });

  describe("key planning + convergence", () => {
    const fallback = "anonymous:reader";

    it("authed with no install id -> user key, no bookkeeping", () => {
      const plan = planHarthmereLiveModeActorKey({
        userId: "u1",
        anonymousFallback: fallback,
      });
      assert.strictEqual(plan.actorId, "u1");
      assert.strictEqual(plan.writeInstallLink, undefined);
      assert.strictEqual(plan.considerInstallOrphan, undefined);
    });

    it("first authed sighting of an install -> user key + writes link + checks for orphan", () => {
      const plan = planHarthmereLiveModeActorKey({
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
      const plan = planHarthmereLiveModeActorKey({
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
      const plan = planHarthmereLiveModeActorKey({
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
      const plan = planHarthmereLiveModeActorKey({
        installId: "i1",
        anonymousFallback: fallback,
      });
      assert.strictEqual(plan.actorId, harthmereLiveModeInstallActorId("i1"));
      assert.strictEqual(plan.actorId, "install:i1");
    });

    it("install-only WITH a known link converges onto the user key", () => {
      // This is the core fix: a pre-cookie request now reads the SAME blob the
      // authed request writes, instead of forking install:i1.
      const plan = planHarthmereLiveModeActorKey({
        installId: "i1",
        linkedUserId: "u1",
        anonymousFallback: fallback,
      });
      assert.strictEqual(plan.actorId, "u1");
    });

    it("stable Glitch game-user link beats a freshly-minted numeric auth user", () => {
      const plan = planHarthmereLiveModeActorKey({
        userId: "7804034240681026",
        installId: "i1",
        linkedUserId: "8711576235822475",
        linkedGameUserId: "glitch:43af071c-9922-4e02-ba46-32ee2b7479a6",
        anonymousFallback: fallback,
      });
      assert.strictEqual(
        plan.actorId,
        "glitch:43af071c-9922-4e02-ba46-32ee2b7479a6"
      );
      assert.strictEqual(plan.writeInstallLink, undefined);
      assert.strictEqual(plan.considerInstallOrphan, undefined);
    });

    it("no userId and no installId -> anonymous fallback", () => {
      const plan = planHarthmereLiveModeActorKey({
        anonymousFallback: fallback,
      });
      assert.strictEqual(plan.actorId, fallback);
    });

    it("blank-string ids are ignored like missing ones", () => {
      const plan = planHarthmereLiveModeActorKey({
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
        shouldAdoptHarthmereInstallOrphan({
          userStateRaw: null,
          installStateRaw: '{"level":7,"gold":999}',
        }),
        true
      );
    });

    it("does NOT adopt when the user already has a blob", () => {
      assert.strictEqual(
        shouldAdoptHarthmereInstallOrphan({
          userStateRaw: '{"level":1}',
          installStateRaw: '{"level":7}',
        }),
        false
      );
    });

    it("does NOT adopt when there is no install blob to adopt", () => {
      assert.strictEqual(
        shouldAdoptHarthmereInstallOrphan({
          userStateRaw: null,
          installStateRaw: null,
        }),
        false
      );
    });

    it("treats whitespace-only blobs as empty on both sides", () => {
      assert.strictEqual(
        shouldAdoptHarthmereInstallOrphan({
          userStateRaw: "   ",
          installStateRaw: "   ",
        }),
        false
      );
      assert.strictEqual(
        shouldAdoptHarthmereInstallOrphan({
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
        harthmereLiveModeInstallLinkKey("i1"),
        "harthmere:live_mode:current:install_user_link:i1"
      );
    });

    it("install game-user link key is namespaced and stable", () => {
      assert.strictEqual(
        harthmereLiveModeInstallGameUserLinkKey("i1"),
        "harthmere:live_mode:current:install_game_user_link:i1"
      );
    });
  });
});
