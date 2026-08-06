import {
  HARTHMERE_BOSS_ACTION_EASE_IN_SECS,
  HARTHMERE_BOSS_ACTION_EASE_OUT_SECS,
  HARTHMERE_BOSS_ANIMATION_POLISH_VERSION,
  harthmereBossSpecialAnimationBlendWeight,
} from "@/shared/harthmere/boss_animation_polish";
import assert from "assert";

describe("Harthmere boss animation polish", () => {
  it("uses a stable version and asymmetric combat recovery blend", () => {
    assert.equal(
      HARTHMERE_BOSS_ANIMATION_POLISH_VERSION,
      "harthmere-boss-animation-polish-v1"
    );
    assert.ok(HARTHMERE_BOSS_ACTION_EASE_IN_SECS > 0);
    assert.ok(
      HARTHMERE_BOSS_ACTION_EASE_OUT_SECS > HARTHMERE_BOSS_ACTION_EASE_IN_SECS
    );
  });

  it("fades bespoke clips in, holds their authored middle, and fades out", () => {
    const durationSecs = 1.6;
    const start = harthmereBossSpecialAnimationBlendWeight({
      elapsedSecs: 0,
      durationSecs,
    });
    const entering = harthmereBossSpecialAnimationBlendWeight({
      elapsedSecs: 0.07,
      durationSecs,
    });
    const middle = harthmereBossSpecialAnimationBlendWeight({
      elapsedSecs: 0.8,
      durationSecs,
    });
    const leaving = harthmereBossSpecialAnimationBlendWeight({
      elapsedSecs: 1.5,
      durationSecs,
    });
    const ended = harthmereBossSpecialAnimationBlendWeight({
      elapsedSecs: durationSecs,
      durationSecs,
    });
    assert.equal(start, 0);
    assert.ok(entering > start && entering < middle);
    assert.equal(middle, 1);
    assert.ok(leaving > ended && leaving < middle);
    assert.equal(ended, 0);
  });
});
