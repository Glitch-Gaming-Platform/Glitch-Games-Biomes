import {
  buildHarthmereInstallRecoveryUrl,
  harthmereInstallIdFromSearch,
} from "@/shared/util/harthmere_auth_session";
import assert from "assert";

describe("Harthmere install session recovery", () => {
  it("reads both supported install-id query spellings", () => {
    assert.equal(
      harthmereInstallIdFromSearch("?install_id=install-one"),
      "install-one"
    );
    assert.equal(
      harthmereInstallIdFromSearch("?installId=install-two"),
      "install-two"
    );
    assert.equal(
      harthmereInstallIdFromSearch("?install_id=local-test"),
      undefined
    );
  });

  it("recovers a temporary player slug through the canonical install route", () => {
    const recovered = new URL(
      buildHarthmereInstallRecoveryUrl(
        "https://www.glitch.fun/at/Guest%20User?installId=old&anon=1&chapter=1",
        "install-real"
      )
    );
    assert.equal(recovered.pathname, "/at");
    assert.equal(recovered.searchParams.get("install_id"), "install-real");
    assert.equal(recovered.searchParams.get("installId"), null);
    assert.equal(recovered.searchParams.get("anon"), null);
    assert.equal(recovered.searchParams.get("glitch_auto_play"), "1");
    assert.equal(recovered.searchParams.get("chapter"), "1");
  });

  it("preserves non-game routes while retaining install identity", () => {
    const recovered = new URL(
      buildHarthmereInstallRecoveryUrl(
        "https://www.glitch.fun/account/settings?tab=profile",
        "install-real"
      )
    );
    assert.equal(recovered.pathname, "/account/settings");
    assert.equal(recovered.searchParams.get("install_id"), "install-real");
  });
});
