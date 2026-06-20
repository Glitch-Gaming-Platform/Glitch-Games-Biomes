import assert from "assert";
import { shouldApplyHarthmereCloudSave } from "@/client/game/glitch/harthmere_cloud_save_restore_policy";

describe("Harthmere Cloud Save restore policy current", () => {
  it("imports a returned Glitch cloud slot only when no backend authority state exists", () => {
    assert.equal(
      shouldApplyHarthmereCloudSave({
        latestCloudVersion: 7,
        hasBackendAuthorityState: false,
        hasMeaningfulLocalProgress: true,
      }),
      true
    );
  });

  it("does not auto-restore cloud over an existing backend authority state", () => {
    assert.equal(
      shouldApplyHarthmereCloudSave({
        latestCloudVersion: 7,
        hasBackendAuthorityState: true,
        hasMeaningfulLocalProgress: false,
      }),
      false
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

  it("restores the cloud save on boot when local has progress but backend has no state", () => {
    assert.equal(
      shouldApplyHarthmereCloudSave({
        latestCloudVersion: 1422,
        hasBackendAuthorityState: false,
        hasMeaningfulLocalProgress: true,
      }),
      true
    );
  });

  it("force restore wins only when no backend authority state exists", () => {
    assert.equal(
      shouldApplyHarthmereCloudSave({
        latestCloudVersion: 1422,
        hasBackendAuthorityState: false,
        hasMeaningfulLocalProgress: true,
        forceCloudRestore: true,
      }),
      true
    );
    assert.equal(
      shouldApplyHarthmereCloudSave({
        latestCloudVersion: 1422,
        hasBackendAuthorityState: true,
        hasMeaningfulLocalProgress: true,
        forceCloudRestore: true,
      }),
      false
    );
  });
});
