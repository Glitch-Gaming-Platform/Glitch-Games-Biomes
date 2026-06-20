import assert from "assert";
import { shouldApplyHarthmereCloudSave } from "@/client/game/glitch/harthmere_cloud_save_restore_policy";

describe("Harthmere Cloud Save restore policy current", () => {
  it("uses a returned Glitch cloud slot as the source of truth over local progress", () => {
    assert.equal(
      shouldApplyHarthmereCloudSave({
        latestCloudVersion: 7,
        hasMeaningfulLocalProgress: true,
      }),
      true
    );
  });

  it("does not overwrite meaningful local progress when Glitch has no save slot", () => {
    assert.equal(
      shouldApplyHarthmereCloudSave({
        latestCloudVersion: undefined,
        hasMeaningfulLocalProgress: true,
      }),
      false
    );
  });

  it("allows an empty local profile to attempt first cloud restore", () => {
    assert.equal(
      shouldApplyHarthmereCloudSave({
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
      shouldApplyHarthmereCloudSave({
        latestCloudVersion: 1422,
        hasMeaningfulLocalProgress: true,
      }),
      true
    );
  });

  it("force restore always wins (a different account claimed this browser)", () => {
    assert.equal(
      shouldApplyHarthmereCloudSave({
        latestCloudVersion: 1422,
        hasMeaningfulLocalProgress: true,
        forceCloudRestore: true,
      }),
      true
    );
  });
});
