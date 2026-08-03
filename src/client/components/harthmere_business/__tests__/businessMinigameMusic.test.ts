import {
  HARTHMERE_BUSINESS_MINIGAME_MUSIC_OVERRIDE_OWNER,
  harthmereBusinessMinigameMusicTrack,
} from "../businessMinigameMusic";
import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  harthmereBusinessOutpostBusinessId,
} from "@/shared/harthmere/business_customer_simulator";
import assert from "assert";

describe("Harthmere business minigame music", () => {
  it("selects the fast loop for an active shift inside every business", () => {
    assert.equal(HARTHMERE_BUSINESS_OUTPOSTS.length, 19);
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
      assert.equal(
        harthmereBusinessMinigameMusicTrack({
          businessId: harthmereBusinessOutpostBusinessId(outpost.outpostId),
          insideBusiness: true,
          sessionStatus: "active",
        }),
        "business_minigame_music",
        outpost.outpostId
      );
    }
  });

  it("stops when the shift ends", () => {
    for (const sessionStatus of [
      undefined,
      "completed",
      "ended",
      "expired",
      "cancelled",
    ]) {
      assert.equal(
        harthmereBusinessMinigameMusicTrack({
          businessId: "business_outpost_refinery_ashline",
          insideBusiness: true,
          sessionStatus,
        }),
        undefined
      );
    }
  });

  it("stops when the player leaves the active business", () => {
    assert.equal(
      harthmereBusinessMinigameMusicTrack({
        businessId: "business_outpost_refinery_ashline",
        insideBusiness: false,
        sessionStatus: "active",
      }),
      undefined
    );
    assert.equal(
      HARTHMERE_BUSINESS_MINIGAME_MUSIC_OVERRIDE_OWNER,
      "harthmere_business_minigame"
    );
  });
});
