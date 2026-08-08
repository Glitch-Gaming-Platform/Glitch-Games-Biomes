import assert from "assert";
import { isBossPromoCaptureSearch } from "@/client/game/cutscene/boss_promo_visibility";

describe("boss promo NPC suppression", () => {
  it("suppresses retained-world NPCs for a single boss still", () => {
    assert.equal(
      isBossPromoCaptureSearch(
        "?cutscenePromo=boss-ninth-winter&cameraPreset=baseline"
      ),
      true
    );
  });

  it("suppresses retained-world NPCs for the boss marketing batch", () => {
    assert.equal(
      isBossPromoCaptureSearch(
        "?cutscenePromoBatch=boss-marketing&bossCameraPlan=recommended"
      ),
      true
    );
  });

  it("preserves NPCs outside boss marketing capture", () => {
    assert.equal(
      isBossPromoCaptureSearch("?cutscenePromo=ch1-first-gate"),
      false
    );
    assert.equal(isBossPromoCaptureSearch("?hideChrome=1"), false);
  });
});
