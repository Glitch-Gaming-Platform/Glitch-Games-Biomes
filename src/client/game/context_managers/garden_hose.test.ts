import { shouldPublishChallengeStepCompletionForTest } from "@/client/game/context_managers/garden_hose";
import assert from "assert";

describe("challenge step notification lifecycle", () => {
  it("publishes only the active step's first crossing of completion", () => {
    assert.equal(
      shouldPublishChallengeStepCompletionForTest(0.75, 1, false, true),
      true
    );
    assert.equal(
      shouldPublishChallengeStepCompletionForTest(1, 4.125, false, false),
      false,
      "extra Muckwad after completion must not replay Objective Complete"
    );
    assert.equal(
      shouldPublishChallengeStepCompletionForTest(0, 4.125, false, false),
      false,
      "a future inactive inventory objective must not complete early"
    );
  });
});
