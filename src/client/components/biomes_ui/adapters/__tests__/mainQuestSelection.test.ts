import assert from "assert";
import {
  biomesUIMainQuestSelectionFromQuestForTest,
  mainQuestFromTrackableQuestsForTest,
} from "../mainQuestSelection";
import type { MapTrackableQuest } from "../../tabs/MapQuestsTab";

describe("Biomes UI main quest selection", () => {
  it("captures the actionable objective and map marker for a selected quest", () => {
    const quest: MapTrackableQuest = {
      questId: "muck_breach_boss",
      title: "Muck Breach Boss",
      area: "West Muck Breach",
      status: "active",
      firstMarkerId: "live_helper_muck_scarred_helix",
      objective:
        "Defeat the Muck-Scarred Helix at the West Muck Breach.",
      objectives: [
        "Travel to the West Muck Breach.",
        "Defeat the Muck-Scarred Helix at the West Muck Breach.",
      ],
    };

    const selection = biomesUIMainQuestSelectionFromQuestForTest(
      quest,
      1234
    );

    assert.deepEqual(selection, {
      questId: "muck_breach_boss",
      title: "Muck Breach Boss",
      firstMarkerId: "live_helper_muck_scarred_helix",
      objective:
        "Defeat the Muck-Scarred Helix at the West Muck Breach.",
      setAtMs: 1234,
    });
  });

  it("resolves only live incomplete quests from a stored selection", () => {
    const quest: MapTrackableQuest = {
      questId: "road_ahead",
      title: "Road Ahead",
      area: "The Grove",
      status: "active",
      objective: "Speak with Jackie in the Grove.",
    };
    const selection = biomesUIMainQuestSelectionFromQuestForTest(
      quest,
      2000
    );

    assert.equal(
      mainQuestFromTrackableQuestsForTest([quest], selection)?.questId,
      "road_ahead"
    );
    assert.equal(
      mainQuestFromTrackableQuestsForTest(
        [{ ...quest, status: "completed" }],
        selection
      ),
      undefined
    );
    assert.equal(mainQuestFromTrackableQuestsForTest([], selection), undefined);
  });
});
