import assert from "assert";
import { normalizeIdentity } from "@/client/game/glitch/harthmere_glitch_install_bootstrap";
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
    biomes_user_id: 2338109331446422,
    biomes_username: "Glitchinstall25fe66b",
    user_name: "blackmage",
    username: "blackmage",
  };

  it("bootstrap uses biomes_user_id over install-scoped game_user_id", () => {
    const identity = normalizeIdentity(harIdentityResponse, installId);

    assert.equal(identity.gameUserId, "biomes:2338109331446422");
    assert.notEqual(identity.gameUserId, `install:${installId}`);
  });

  it("bridge claim response uses biomes_user_id over install-scoped game_user_id", () => {
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

    assert.equal(identity.gameUserId, "biomes:2338109331446422");
    assert.notEqual(identity.gameUserId, `install:${installId}`);
  });
});
