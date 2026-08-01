import assert from "assert";
import {
  automaticMainQuestSelectionForTest,
  biomesUIMainQuestClearedSelectionForTest,
  biomesUIMainQuestSelectionFromQuestForTest,
  defaultMainQuestFromTrackableQuestsForTest,
  mainQuestFromTrackableQuestsForTest,
} from "../mainQuestSelection";
import type { MapTrackableQuest } from "../../tabs/MapQuestsTab";
import { ch1NativeQuestId } from "@/shared/harthmere/ch1_native_quests";
import { CH1_QUESTS } from "@/shared/harthmere/ch1_quests";

describe("Biomes UI main quest selection", () => {
  it("captures the actionable objective and map marker for a selected quest", () => {
    const quest: MapTrackableQuest = {
      questId: "muck_breach_boss",
      title: "Muck Breach Boss",
      area: "West Muck Breach",
      status: "active",
      firstMarkerId: "live_helper_muck_scarred_helix",
      objective: "Defeat the Muck-Scarred Helix at the West Muck Breach.",
      objectives: [
        "Travel to the West Muck Breach.",
        "Defeat the Muck-Scarred Helix at the West Muck Breach.",
      ],
    };

    const selection = biomesUIMainQuestSelectionFromQuestForTest(quest, 1234);

    assert.deepEqual(selection, {
      questId: "muck_breach_boss",
      title: "Muck Breach Boss",
      firstMarkerId: "live_helper_muck_scarred_helix",
      objective: "Defeat the Muck-Scarred Helix at the West Muck Breach.",
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
    const selection = biomesUIMainQuestSelectionFromQuestForTest(quest, 2000);

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

  it("uses the active Road Ahead as the default main quest", () => {
    const sideQuest: MapTrackableQuest = {
      questId: "buried_bell",
      title: "The Buried Bell",
      area: "Biomes",
      status: "active",
    };
    const roadAhead: MapTrackableQuest = {
      questId: "native_road_ahead",
      title: "The Road Ahead",
      area: "Biomes",
      status: "active",
      kindLabel: "Story Quest",
    };

    assert.equal(
      defaultMainQuestFromTrackableQuestsForTest([sideQuest, roadAhead])
        ?.questId,
      "native_road_ahead"
    );
    assert.equal(
      mainQuestFromTrackableQuestsForTest([sideQuest, roadAhead], undefined)
        ?.questId,
      "native_road_ahead"
    );
  });

  it("does not reselect the story after the player explicitly clears tracking", () => {
    const busted: MapTrackableQuest = {
      questId: "7405046529843322",
      title: "Busted",
      area: "Biomes",
      status: "active",
      kindLabel: "Story Quest",
    };

    assert.equal(
      mainQuestFromTrackableQuestsForTest(
        [busted],
        biomesUIMainQuestClearedSelectionForTest(4000)
      ),
      undefined
    );
  });

  it("automatically carries the main selection through the robot story chapters", () => {
    const completedRoadAhead: MapTrackableQuest = {
      questId: "6193612340426932",
      title: "The Road Ahead",
      area: "Biomes",
      status: "completed",
      kindLabel: "Story Quest",
    };
    const busted: MapTrackableQuest = {
      questId: "7405046529843322",
      title: "Busted",
      area: "Biomes",
      status: "active",
      kindLabel: "Story Quest",
    };
    const unrelated: MapTrackableQuest = {
      questId: "buried_bell",
      title: "The Buried Bell",
      area: "Biomes",
      status: "active",
    };
    const selection = biomesUIMainQuestSelectionFromQuestForTest(
      completedRoadAhead,
      3000
    );

    assert.equal(
      mainQuestFromTrackableQuestsForTest(
        [unrelated, completedRoadAhead, busted],
        selection
      )?.questId,
      busted.questId
    );
    assert.equal(
      defaultMainQuestFromTrackableQuestsForTest([
        unrelated,
        completedRoadAhead,
        busted,
      ])?.questId,
      busted.questId
    );
  });

  it("persists every Chapter 1 quest boundary as the new main quest", () => {
    for (let index = 0; index < CH1_QUESTS.length - 1; index += 1) {
      const current = CH1_QUESTS[index];
      const next = CH1_QUESTS[index + 1];
      const currentQuest: MapTrackableQuest = {
        questId: String(ch1NativeQuestId(current.id)),
        title: current.title,
        area: current.district,
        status: "completed",
        kindLabel: "Story Quest",
      };
      const nextQuest: MapTrackableQuest = {
        questId: String(ch1NativeQuestId(next.id)),
        title: next.title,
        area: next.district,
        status: "active",
        kindLabel: "Story Quest",
        objective: next.steps[0].objective,
      };
      const selection = automaticMainQuestSelectionForTest(
        [currentQuest, nextQuest],
        biomesUIMainQuestSelectionFromQuestForTest(currentQuest, 1000),
        2000
      );
      assert.equal(
        selection?.questId,
        nextQuest.questId,
        `${current.title} did not hand tracking to ${next.title}`
      );
      assert.equal(selection?.objective, next.steps[0].objective);
    }
  });

  it("never overrides an explicit clear or a completed side-quest choice", () => {
    const chapter1: MapTrackableQuest = {
      questId: String(ch1NativeQuestId(CH1_QUESTS[0].id)),
      title: CH1_QUESTS[0].title,
      area: CH1_QUESTS[0].district,
      status: "active",
      kindLabel: "Story Quest",
    };
    assert.equal(
      automaticMainQuestSelectionForTest(
        [chapter1],
        biomesUIMainQuestClearedSelectionForTest(1000),
        2000
      ),
      undefined
    );
    const side: MapTrackableQuest = {
      questId: "side-complete",
      title: "A Finished Errand",
      area: "The Grove",
      status: "completed",
    };
    assert.equal(
      automaticMainQuestSelectionForTest(
        [side, chapter1],
        biomesUIMainQuestSelectionFromQuestForTest(side, 1000),
        2000
      ),
      undefined
    );
  });

  it("moves stale earlier-story tracking to an active Chapter 1 quest", () => {
    const completedMuckVsMachine: MapTrackableQuest = {
      questId: "5739496793885069",
      title: "Muck vs. Machine",
      area: "Biomes",
      status: "completed",
      kindLabel: "Story Quest",
    };
    const gimmeShelter: MapTrackableQuest = {
      questId: "3741112749915015",
      title: "Gimme Shelter",
      area: "Biomes",
      status: "active",
      objective: "Place your Robot in the Muck",
      kindLabel: "Story Quest",
    };
    const chapter1: MapTrackableQuest = {
      questId: "8762000000000000",
      title: "The Morning After",
      area: "Biomes",
      status: "active",
      kindLabel: "Story Quest",
    };
    const selection = biomesUIMainQuestSelectionFromQuestForTest(
      completedMuckVsMachine,
      5000
    );

    assert.equal(
      mainQuestFromTrackableQuestsForTest(
        [completedMuckVsMachine, chapter1, gimmeShelter],
        selection
      )?.questId,
      chapter1.questId
    );
    assert.equal(
      defaultMainQuestFromTrackableQuestsForTest([
        completedMuckVsMachine,
        chapter1,
        gimmeShelter,
      ])?.questId,
      chapter1.questId
    );
    assert.equal(
      mainQuestFromTrackableQuestsForTest(
        [{ ...gimmeShelter, status: "completed" }, chapter1],
        biomesUIMainQuestSelectionFromQuestForTest(gimmeShelter, 6000)
      )?.questId,
      chapter1.questId
    );
  });

  /**
   * Battery Not Included is the first post-Gimme snapshot quest the tray marks
   * `main`, so it becomes available in parallel with an already-running Chapter
   * 1. It must be selectable and must carry forward like the rest of the main
   * story, but it must never displace Chapter 1 automatically.
   */
  describe("Battery Not Included alongside Chapter 1", () => {
    const chapter1: MapTrackableQuest = {
      questId: "8801000000000001",
      title: "The Morning After",
      area: "Biomes",
      status: "active",
      kindLabel: "Story Quest",
    };
    const batteryNotIncluded: MapTrackableQuest = {
      questId: "4902242789258042",
      title: "Battery Not Included",
      area: "The Grove",
      status: "available",
      kindLabel: "Story Quest",
    };

    it("leaves an in-progress Chapter 1 as the automatic default", () => {
      assert.equal(
        defaultMainQuestFromTrackableQuestsForTest([
          batteryNotIncluded,
          chapter1,
        ])?.questId,
        chapter1.questId
      );
    });

    it("honours an explicit player selection of Battery Not Included", () => {
      const selection = biomesUIMainQuestSelectionFromQuestForTest(
        batteryNotIncluded,
        7000
      );
      assert.equal(
        mainQuestFromTrackableQuestsForTest(
          [chapter1, batteryNotIncluded],
          selection
        )?.questId,
        batteryNotIncluded.questId
      );
    });

    it("carries tracking forward once Battery Not Included is finished", () => {
      const selection = biomesUIMainQuestSelectionFromQuestForTest(
        batteryNotIncluded,
        8000
      );
      assert.equal(
        mainQuestFromTrackableQuestsForTest(
          [{ ...batteryNotIncluded, status: "completed" }, chapter1],
          selection
        )?.questId,
        chapter1.questId
      );
    });

    it("becomes the default only when no story quest is left ahead of it", () => {
      assert.equal(
        defaultMainQuestFromTrackableQuestsForTest([
          { ...chapter1, status: "completed" },
          batteryNotIncluded,
        ])?.questId,
        batteryNotIncluded.questId
      );
    });
  });
});
