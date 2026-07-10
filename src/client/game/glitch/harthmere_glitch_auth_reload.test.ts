import assert from "assert";
import { shouldReloadHarthmereGlitchAuth } from "./harthmere_glitch_auth_reload";

describe("Harthmere Glitch auth reload policy", () => {
  it("allows the initial auth handoff reload", () => {
    assert.equal(
      shouldReloadHarthmereGlitchAuth({
        isAfterReload: false,
        serverGateWaiting: false,
      }),
      true
    );
  });

  it("does not reload an already-mounted game a second time", () => {
    assert.equal(
      shouldReloadHarthmereGlitchAuth({
        isAfterReload: true,
        serverGateWaiting: false,
      }),
      false
    );
  });

  it("allows a follow-up reload only while SSR still shows the auth gate", () => {
    assert.equal(
      shouldReloadHarthmereGlitchAuth({
        isAfterReload: true,
        serverGateWaiting: true,
      }),
      true
    );
  });
});
