import assert from "assert";
import { shouldApplyHarthmereCloudSaveV153 } from "@/client/game/glitch/harthmere_cloud_save_restore_policy_v153";

describe("Harthmere Cloud Save restore policy v153", () => {
  it("uses a returned Glitch cloud slot as the source of truth over local progress", () => {
    assert.equal(
      shouldApplyHarthmereCloudSaveV153({
        latestCloudVersion: 7,
        hasMeaningfulLocalProgress: true,
      }),
      true
    );
  });

  it("does not overwrite meaningful local progress when Glitch has no save slot", () => {
    assert.equal(
      shouldApplyHarthmereCloudSaveV153({
        latestCloudVersion: undefined,
        hasMeaningfulLocalProgress: true,
      }),
      false
    );
  });

  it("allows an empty local profile to attempt first cloud restore", () => {
    assert.equal(
      shouldApplyHarthmereCloudSaveV153({
        latestCloudVersion: undefined,
        hasMeaningfulLocalProgress: false,
      }),
      true
    );
  });
});
