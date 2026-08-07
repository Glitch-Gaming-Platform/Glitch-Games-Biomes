import {
  buildGlitchInstallRedirectDestination,
  preserveGlitchInstallIdentityOnAtRedirect,
} from "@/server/web/glitch_install_redirect";
import assert from "assert";

describe("Glitch install redirect query forwarding", () => {
  it("preserves ordinary game parameters through the /at redirect", () => {
    const destination = buildGlitchInstallRedirectDestination({
      install_id: "install-1",
      id: "133",
      mode: "story",
    });

    assert.ok(destination);
    const url = new URL(destination, "https://game.example");
    assert.equal(url.pathname, "/at");
    assert.equal(url.searchParams.get("install_id"), "install-1");
    assert.equal(url.searchParams.get("glitch_auto_play"), "1");
    assert.equal(url.searchParams.get("id"), "133");
    assert.equal(url.searchParams.get("mode"), "story");
  });

  it("does not replace redirect-owned parameters and preserves repeated values", () => {
    const destination = buildGlitchInstallRedirectDestination({
      install_id: "trusted-install",
      InstallId: "untrusted-install",
      glitch_auto_play: "0",
      tag: ["one", "two"],
    });

    assert.ok(destination);
    const url = new URL(destination, "https://game.example");
    assert.deepEqual(url.searchParams.getAll("install_id"), [
      "trusted-install",
    ]);
    assert.equal(url.searchParams.get("glitch_auto_play"), "1");
    assert.deepEqual(url.searchParams.getAll("tag"), ["one", "two"]);
  });

  it("drops authentication, session, and redirect-control parameters", () => {
    const destination = buildGlitchInstallRedirectDestination({
      install_id: "install-1",
      id: "133",
      loginToken: "one-time-secret",
      access_token: "oauth-secret",
      session_id: "forged-session",
      customJwt: "signed-secret",
      redirect: "https://untrusted.example",
    });

    assert.ok(destination);
    const url = new URL(destination, "https://game.example");
    assert.equal(url.searchParams.get("id"), "133");
    assert.equal(url.searchParams.has("loginToken"), false);
    assert.equal(url.searchParams.has("access_token"), false);
    assert.equal(url.searchParams.has("session_id"), false);
    assert.equal(url.searchParams.has("customJwt"), false);
    assert.equal(url.searchParams.has("redirect"), false);
  });

  it("does not redirect without an install identifier", () => {
    assert.equal(
      buildGlitchInstallRedirectDestination({ id: "133" }),
      undefined
    );
  });

  it("keeps install identity when an invalid player slug falls back to /at", () => {
    const destination = preserveGlitchInstallIdentityOnAtRedirect("/at", {
      install_id: "install-1",
      glitch_auto_play: "1",
    });
    const url = new URL(destination, "https://game.example");
    assert.equal(url.pathname, "/at");
    assert.equal(url.searchParams.get("install_id"), "install-1");
    assert.equal(url.searchParams.get("glitch_auto_play"), "1");
  });

  it("does not rewrite unrelated redirects", () => {
    assert.equal(
      preserveGlitchInstallIdentityOnAtRedirect("/sorry", {
        install_id: "install-1",
      }),
      "/sorry"
    );
  });
});
