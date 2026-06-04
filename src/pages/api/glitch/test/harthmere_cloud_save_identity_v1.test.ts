import assert from "assert";
import {
  harthmereCloudSaveForeignAuthCandidateIdsV1,
  harthmereCloudSaveForeignAuthPrimaryIdV1,
  isStableHarthmereGlitchUserIdV1,
  isStableHarthmereUserNameV1,
  normalizeHarthmereUserNameSlugV1,
} from "@/server/shared/glitch/harthmere_cloud_save_identity_v1";

const TITLE = "42de534c-600f-4228-af9e-b69faef94cce";
const INSTALL = "25f687dd-9ebe-4c31-8810-719ddfafe66b";

describe("harthmere cloud save identity (stable scope)", () => {
  describe("isStableHarthmereUserNameV1", () => {
    it("accepts real account names", () => {
      assert.equal(isStableHarthmereUserNameV1("blackmage"), true);
      assert.equal(isStableHarthmereUserNameV1("  Maitê  "), true);
    });
    it("rejects empty / guest / install-derived names", () => {
      assert.equal(isStableHarthmereUserNameV1(""), false);
      assert.equal(isStableHarthmereUserNameV1("   "), false);
      assert.equal(isStableHarthmereUserNameV1(undefined), false);
      assert.equal(isStableHarthmereUserNameV1(null), false);
      assert.equal(isStableHarthmereUserNameV1("Guest"), false);
      assert.equal(isStableHarthmereUserNameV1("guest user"), false);
      // install-minted display names must not be treated as a stable account
      assert.equal(isStableHarthmereUserNameV1("Glitchinstall25fe66b"), false);
      assert.equal(isStableHarthmereUserNameV1("Local1a2b3c"), false);
    });
  });

  describe("isStableHarthmereGlitchUserIdV1", () => {
    it("accepts a real id, rejects guest/empty", () => {
      assert.equal(isStableHarthmereGlitchUserIdV1("abc-123"), true);
      assert.equal(isStableHarthmereGlitchUserIdV1(""), false);
      assert.equal(isStableHarthmereGlitchUserIdV1(null), false);
      assert.equal(isStableHarthmereGlitchUserIdV1("guest"), false);
    });
  });

  describe("normalizeHarthmereUserNameSlugV1", () => {
    it("lowercases, slugs and trims", () => {
      assert.equal(normalizeHarthmereUserNameSlugV1("BlackMage"), "blackmage");
      assert.equal(normalizeHarthmereUserNameSlugV1("  A B!c "), "a-b-c");
      assert.equal(normalizeHarthmereUserNameSlugV1("Maitê"), "mait");
    });
  });

  describe("primary id is STABLE across the volatile-glitch-id flip", () => {
    // This is the core regression: the SAME human (same install, same userName)
    // must resolve to the SAME primary key whether or not the Glitch response
    // includes a (volatile) glitch user id this call.
    const withId: Parameters<typeof harthmereCloudSaveForeignAuthPrimaryIdV1>[0] =
      {
        titleId: TITLE,
        installId: INSTALL,
        userName: "blackmage",
        glitchUserId: "stable-glitch-uid",
      };
    const withoutId = { ...withId, glitchUserId: undefined };

    it("prefers the glitch user id when present", () => {
      assert.equal(
        harthmereCloudSaveForeignAuthPrimaryIdV1(withId),
        `glitch:${TITLE}:glitch:stable-glitch-uid`
      );
    });

    it("falls back to the stable userName when the id is absent", () => {
      assert.equal(
        harthmereCloudSaveForeignAuthPrimaryIdV1(withoutId),
        `glitch:${TITLE}:user:blackmage`
      );
    });

    it("a userName session can ALWAYS resolve a prior id-session link via candidates", () => {
      // Session A created the link under the glitch-id form.
      const created = harthmereCloudSaveForeignAuthPrimaryIdV1(withId);
      // Session B (no glitch id) must list a candidate set; since the glitch-id
      // form is unavailable, the userName form must be present so future logins
      // converge — and crucially the userName candidate is identical in BOTH
      // sessions, which is what guarantees convergence after one backfill.
      const candidatesA = harthmereCloudSaveForeignAuthCandidateIdsV1(withId);
      const candidatesB = harthmereCloudSaveForeignAuthCandidateIdsV1(withoutId);
      assert.ok(candidatesA.includes(created));
      const userForm = `glitch:${TITLE}:user:blackmage`;
      assert.ok(candidatesA.includes(userForm));
      assert.ok(candidatesB.includes(userForm));
    });

    it("uses install id only when neither id nor a stable name exist", () => {
      assert.equal(
        harthmereCloudSaveForeignAuthPrimaryIdV1({
          titleId: TITLE,
          installId: INSTALL,
          userName: "Glitchinstall25fe66b",
          glitchUserId: undefined,
        }),
        `glitch:${TITLE}:install:${INSTALL}`
      );
    });
  });

  describe("live Glitch validate response (verified 2026-06-04)", () => {
    // The exact shape the Glitch /installs/{id}/validate endpoint now returns
    // after the title was updated to include a stable account id:
    //   { valid:true, user_id:"43af071c-…", user_email:"…", user_name:"blackmage",
    //     license_type:"purchased" }
    // The server maps user_id -> glitchUserId -> gameUserId "glitch:<user_id>".
    const LIVE_GLITCH_USER_ID = "43af071c-9922-4e02-ba46-32ee2b7479a6";
    const LIVE_INSTALL = "f7f602be-8d32-4fd6-9eba-2d3b7e6dafd7";
    const live = {
      titleId: TITLE,
      installId: LIVE_INSTALL,
      userName: "blackmage",
      glitchUserId: LIVE_GLITCH_USER_ID,
    };

    it("scopes the save to the stable Glitch account id, not the install", () => {
      assert.equal(
        harthmereCloudSaveForeignAuthPrimaryIdV1(live),
        `glitch:${TITLE}:glitch:${LIVE_GLITCH_USER_ID}`
      );
    });

    it("migrates a pre-update session (no account id) to the same player", () => {
      // Before the Glitch update this player could only be keyed by userName.
      // The post-update session lists the glitch-id form FIRST but still includes
      // the userName form, so the lookup finds the legacy link and back-fills the
      // stable id form — same biomes user, no orphaned progress.
      const preUpdate = { ...live, glitchUserId: undefined };
      const legacyKey = harthmereCloudSaveForeignAuthPrimaryIdV1(preUpdate);
      assert.equal(legacyKey, `glitch:${TITLE}:user:blackmage`);
      const postUpdateCandidates =
        harthmereCloudSaveForeignAuthCandidateIdsV1(live);
      assert.equal(
        postUpdateCandidates[0],
        `glitch:${TITLE}:glitch:${LIVE_GLITCH_USER_ID}`
      );
      assert.ok(
        postUpdateCandidates.includes(legacyKey),
        "post-update session must still find the legacy userName link to migrate it"
      );
    });
  });

  describe("candidate ids", () => {
    it("dedupe and ordering: glitch id, userName, install", () => {
      const ids = harthmereCloudSaveForeignAuthCandidateIdsV1({
        titleId: TITLE,
        installId: INSTALL,
        userName: "blackmage",
        glitchUserId: "gid",
      });
      assert.deepEqual(ids, [
        `glitch:${TITLE}:glitch:gid`,
        `glitch:${TITLE}:user:blackmage`,
        `glitch:${TITLE}:install:${INSTALL}`,
      ]);
    });

    it("guest-only identity collapses to the install candidate", () => {
      const ids = harthmereCloudSaveForeignAuthCandidateIdsV1({
        titleId: TITLE,
        installId: INSTALL,
        userName: "Guest",
        glitchUserId: null,
      });
      assert.deepEqual(ids, [`glitch:${TITLE}:install:${INSTALL}`]);
    });

    it("the install candidate is always present (the anti-flip guarantee)", () => {
      for (const glitchUserId of [undefined, "gid"]) {
        for (const userName of ["blackmage", "Guest", undefined]) {
          const ids = harthmereCloudSaveForeignAuthCandidateIdsV1({
            titleId: TITLE,
            installId: INSTALL,
            userName,
            glitchUserId,
          });
          assert.ok(
            ids.includes(`glitch:${TITLE}:install:${INSTALL}`),
            `install candidate missing for glitchUserId=${glitchUserId} userName=${userName}`
          );
        }
      }
    });
  });
});
