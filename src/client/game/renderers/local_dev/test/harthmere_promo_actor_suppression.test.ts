import assert from "assert";
import { isBossPromoCaptureSearch } from "@/client/game/cutscene/boss_promo_visibility";

describe("Harthmere boss promo actor suppression", () => {
  it("suppresses ordinary runtime life for single and batch boss captures", () => {
    assert.equal(
      isBossPromoCaptureSearch("?cutscenePromo=boss-ninth-winter"),
      true
    );
    assert.equal(
      isBossPromoCaptureSearch("?cutscenePromoBatch=boss-marketing"),
      true
    );
  });

  it("preserves runtime life for gameplay and non-boss cutscenes", () => {
    assert.equal(
      isBossPromoCaptureSearch("?cutscenePromo=ch1-first-gate"),
      false
    );
    assert.equal(isBossPromoCaptureSearch(""), false);
  });
});
