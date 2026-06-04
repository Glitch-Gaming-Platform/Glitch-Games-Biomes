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

  it("always restores the cloud save on boot, even when local also has progress (deploy / new device)", () => {
    // Cloud is the source of truth on load: the player's previous progress must
    // be applied after a redeploy regardless of whatever sits in local storage.
    assert.equal(
      shouldApplyHarthmereCloudSaveV153({
        latestCloudVersion: 1422,
        hasMeaningfulLocalProgress: true,
      }),
      true
    );
  });

  it("force restore always wins (a different account claimed this browser)", () => {
    assert.equal(
      shouldApplyHarthmereCloudSaveV153({
        latestCloudVersion: 1422,
        hasMeaningfulLocalProgress: true,
        forceCloudRestore: true,
      }),
      true
    );
  });
});
