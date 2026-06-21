import assert from "assert";
import { shouldApplyHarthmereCloudSave } from "@/client/game/glitch/harthmere_cloud_save_restore_policy";

describe("Harthmere Cloud Save restore policy current", () => {
  it("imports a returned Glitch cloud slot as durable player truth", () => {
    assert.equal(
      shouldApplyHarthmereCloudSave({
        latestCloudVersion: 7,
        hasMeaningfulLocalProgress: true,
      }),
      true
    );
  });

  it("does not let backend runtime state block cloud restore", () => {
    assert.equal(
      shouldApplyHarthmereCloudSave({
        latestCloudVersion: 7,
        hasMeaningfulLocalProgress: false,
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

  it("restores the cloud save on boot even when local has progress", () => {
    assert.equal(
      shouldApplyHarthmereCloudSave({
        latestCloudVersion: 1422,
        hasMeaningfulLocalProgress: true,
      }),
      true
    );
  });

  it("force restore wins without consulting backend runtime state", () => {
    assert.equal(
      shouldApplyHarthmereCloudSave({
        latestCloudVersion: 1422,
        hasMeaningfulLocalProgress: true,
        forceCloudRestore: true,
      }),
      true
    );
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
