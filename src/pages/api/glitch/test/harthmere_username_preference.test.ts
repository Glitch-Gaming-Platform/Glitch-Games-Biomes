import assert from "assert";
import {
  isGeneratedPlaceholderUsername,
  preferredGlitchDisplayUsername,
} from "@/server/web/util/username";

// HARTHMERE_GLITCH_DISPLAY_USERNAME: the on-screen username must be the real
// name the Glitch API returned (user_name), never an id-derived placeholder.

describe("preferredGlitchDisplayUsername", () => {
  it("uses the real API user_name", () => {
    assert.equal(
      preferredGlitchDisplayUsername({ userName: "blackmage", guest: false }),
      "blackmage"
    );
  });

  it("sanitizes spaces and symbols into a valid biomes username", () => {
    assert.equal(
      preferredGlitchDisplayUsername({ userName: "Black Mage!", guest: false }),
      "Black.Mage"
    );
  });

  it("rejects guests, guest-like, and unusable names", () => {
    assert.equal(
      preferredGlitchDisplayUsername({ userName: "blackmage", guest: true }),
      undefined
    );
    assert.equal(
      preferredGlitchDisplayUsername({ userName: "Guest Player", guest: false }),
      undefined
    );
    assert.equal(
      preferredGlitchDisplayUsername({ userName: "", guest: false }),
      undefined
    );
    assert.equal(
      preferredGlitchDisplayUsername({ userName: "ab", guest: false }),
      undefined
    );
  });

  it("caps at 20 characters without a trailing dot", () => {
    const long = preferredGlitchDisplayUsername({
      userName: "A Very Long Glitch Display Name Indeed",
      guest: false,
    });
    assert.ok(long && long.length <= 20, String(long));
    assert.ok(!long!.endsWith("."));
  });
});

describe("isGeneratedPlaceholderUsername", () => {
  it("detects backend-generated placeholders", () => {
    assert.equal(isGeneratedPlaceholderUsername("Glitch43af071c9979a6"), true);
    assert.equal(isGeneratedPlaceholderUsername("NewPlayerABCD"), true);
    assert.equal(isGeneratedPlaceholderUsername("GuestA1B2"), true);
    assert.equal(isGeneratedPlaceholderUsername("user-8248502415978091"), true);
    assert.equal(isGeneratedPlaceholderUsername(""), true);
    assert.equal(isGeneratedPlaceholderUsername(undefined), true);
  });

  it("keeps real user-chosen names", () => {
    assert.equal(isGeneratedPlaceholderUsername("blackmage"), false);
    assert.equal(isGeneratedPlaceholderUsername("Dragon.Slayer99"), false);
  });
});
