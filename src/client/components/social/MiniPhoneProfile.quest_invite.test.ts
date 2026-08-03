import { groveNativeQuestId } from "@/shared/harthmere/grove/grove_quest_ids";
import assert from "assert";
import { questInviteOptionsFromChallengeBundles } from "./questInviteChallengeOptions";

describe("profile quest invite options", () => {
  it("offers only Harthmere quests the inviter already has in progress", () => {
    const nativeQuestId = groveNativeQuestId("fountain_buttons_first")!;
    const options = questInviteOptionsFromChallengeBundles([
      {
        state: "available",
        biscuit: {
          id: nativeQuestId,
          displayName: "Available but not accepted",
        },
      },
      {
        state: "in_progress",
        biscuit: {
          id: nativeQuestId,
          displayName: "Buttons Before the Road",
        },
        progress: { progressString: "Open the tracker." },
      },
      {
        state: "in_progress",
        biscuit: { id: 1, displayName: "Unrelated native quest" },
      },
    ]);
    assert.deepEqual(options, [
      {
        questId: "fountain_buttons_first",
        title: "Buttons Before the Road",
        area: "Quest",
        objectiveText: "Open the tracker.",
        reward: undefined,
        firstMarkerId: undefined,
        markerWorldPosition: undefined,
      },
    ]);
  });
});
