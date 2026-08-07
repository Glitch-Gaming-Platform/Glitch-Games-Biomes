import assert from "assert";
import {
  normalizeIdentity,
  shouldRecoverAuthedHarthmereInstallPage,
} from "@/client/game/glitch/harthmere_glitch_install_bootstrap";
import {
  identityFromResponse,
  type HarthmereGlitchRuntimeConfig,
} from "@/client/game/glitch/harthmere_glitch_bridge";

describe("harthmere Glitch Cloud Save identity normalization", () => {
  const installId = "25f687dd-9ebe-4c31-8810-719ddfafe66b";
  const titleId = "42de534c-600f-4228-af9e-b69faef94cce";

  const harIdentityResponse = {
    valid: true,
    title_id: titleId,
    install_id: installId,
    game_user_id: `install:${installId}`,
    user_id: "43af071c-9922-4e02-ba46-32ee2b7479a6",
    biomes_user_id: 2338109331446422,
    biomes_username: "Glitchinstall25fe66b",
    user_name: "blackmage",
    username: "blackmage",
  };

  it("bootstrap uses the stable Glitch user id over volatile Biomes ids", () => {
    const identity = normalizeIdentity(harIdentityResponse, installId);

    assert.equal(
      identity.gameUserId,
      "glitch:43af071c-9922-4e02-ba46-32ee2b7479a6"
    );
    assert.notEqual(identity.gameUserId, `install:${installId}`);
    assert.notEqual(identity.gameUserId, "biomes:2338109331446422");
  });

  it("bridge claim response uses the stable Glitch user id over volatile Biomes ids", () => {
    const config: HarthmereGlitchRuntimeConfig = {
      titleId,
      installId,
      launchedByGlitch: true,
      localOnly: false,
    };
    const identity = identityFromResponse(config, {
      ...harIdentityResponse,
      server_session_id: "server-session-test",
    });

    assert.equal(
      identity.gameUserId,
      "glitch:43af071c-9922-4e02-ba46-32ee2b7479a6"
    );
    assert.equal(identity.glitchUserId, "43af071c-9922-4e02-ba46-32ee2b7479a6");
    assert.equal(identity.biomesUserId, "2338109331446422");
    assert.notEqual(identity.gameUserId, `install:${installId}`);
    assert.notEqual(identity.gameUserId, "biomes:2338109331446422");
  });
});

describe("Harthmere install observer recovery", () => {
  it("reloads an authenticated install that SSR rendered anonymously", () => {
    assert.equal(
      shouldRecoverAuthedHarthmereInstallPage({
        initialAuthed: true,
        installId: "install-1",
        pathname: "/at",
        serverRenderedUserId: 0,
        serverRenderedObserverMode: { kind: "rotate" },
      }),
      true
    );
  });

  it("does not reload an already player-rendered install", () => {
    assert.equal(
      shouldRecoverAuthedHarthmereInstallPage({
        initialAuthed: true,
        installId: "install-1",
        pathname: "/at",
        serverRenderedUserId: 1234,
        serverRenderedObserverMode: null,
      }),
      false
    );
  });
});
