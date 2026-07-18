import assert from "assert";
import { cloudSaveContentFingerprint } from "@/client/game/glitch/harthmere_glitch_bridge";

describe("Harthmere Glitch cloud save content deduplication", () => {
  it("is stable across storage iteration order", () => {
    const left = cloudSaveContentFingerprint({
      "biomes.localDev.harthmere.inventoryState": '{"items":{"grass":1}}',
      "biomes.localDev.harthmere.questState": '{"active":[]}',
    });
    const right = cloudSaveContentFingerprint({
      "biomes.localDev.harthmere.questState": '{"active":[]}',
      "biomes.localDev.harthmere.inventoryState": '{"items":{"grass":1}}',
    });

    assert.equal(left, right);
  });

  it("ignores bridge, install, and session identity churn", () => {
    const durable = {
      "biomes.localDev.harthmere.inventoryState": '{"items":{"grass":1}}',
    };
    const before = cloudSaveContentFingerprint({
      ...durable,
      "biomes.localDev.harthmere.glitchBridgeState":
        '{"lastAutosaveAt":"before"}',
      "biomes.localDev.harthmere.localInstallId": "install-before",
      "biomes.localDev.harthmere.glitchIdentity":
        '{"serverSessionId":"session-before"}',
    });
    const after = cloudSaveContentFingerprint({
      ...durable,
      "biomes.localDev.harthmere.glitchBridgeState":
        '{"lastAutosaveAt":"after"}',
      "biomes.localDev.harthmere.localInstallId": "install-after",
      "biomes.localDev.harthmere.glitchIdentity":
        '{"serverSessionId":"session-after"}',
    });

    assert.equal(before, after);
  });

  it("changes when authoritative gameplay state changes", () => {
    const before = cloudSaveContentFingerprint({
      "biomes.localDev.harthmere.inventoryState": '{"items":{"grass":1}}',
    });
    const after = cloudSaveContentFingerprint({
      "biomes.localDev.harthmere.inventoryState": '{"items":{"grass":2}}',
    });

    assert.notEqual(before, after);
  });
});
