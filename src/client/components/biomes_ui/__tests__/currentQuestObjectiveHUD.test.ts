import assert from "assert";
import { currentQuestObjectiveForHUDForTest } from "../CurrentQuestObjectiveHUD";
import {
  biomesUIMainQuestClearedSelectionForTest,
  biomesUIMainQuestSelectionFromQuestForTest,
} from "../adapters/mainQuestSelection";
import type { MapTrackableQuest } from "../tabs/MapQuestsTab";

describe("CurrentQuestObjectiveHUD", () => {
  it("prioritizes an explicit active destination over the selected main quest", () => {
    const mainQuest: MapTrackableQuest = {
      questId: "muck_breach_boss",
      title: "Muck Breach Boss",
      area: "West Muck Breach",
      status: "active",
      firstMarkerId: "helix_marker",
      objective: "Defeat the Muck-Scarred Helix at the West Muck Breach.",
    };
    const pinnedQuest: MapTrackableQuest = {
      questId: "road_ahead",
      title: "Road Ahead",
      area: "The Grove",
      status: "active",
      firstMarkerId: "jackie",
      objective: "Speak with Jackie in the Grove.",
    };

    assert.equal(
      currentQuestObjectiveForHUDForTest({
        quests: [pinnedQuest, mainQuest],
        mainQuestSelection:
          biomesUIMainQuestSelectionFromQuestForTest(mainQuest),
        activeMapPin: {
          markerId: "jackie",
          label: "Jackie",
          kind: "objective",
          worldPosition: [496, 70, -126],
          setAtMs: 3000,
        },
      }),
      "Speak with Jackie in the Grove."
    );
  });

  it("uses the stored objective only while quest data is still hydrating", () => {
    const quest: MapTrackableQuest = {
      questId: "road_ahead",
      title: "Road Ahead",
      area: "The Grove",
      status: "completed",
      objective: "Speak with Jackie in the Grove.",
    };
    const selection = biomesUIMainQuestSelectionFromQuestForTest(quest);

    assert.equal(
      currentQuestObjectiveForHUDForTest({
        quests: [],
        mainQuestSelection: selection,
      }),
      "Speak with Jackie in the Grove."
    );
    assert.equal(
      currentQuestObjectiveForHUDForTest({
        quests: [quest],
        mainQuestSelection: selection,
      }),
      undefined
    );
  });

  it("hides automatic story guidance after the player stops tracking quests", () => {
    const busted: MapTrackableQuest = {
      questId: "7405046529843322",
      title: "Busted",
      area: "Biomes",
      status: "active",
      objective: "Talk to Jackie",
    };

    assert.equal(
      currentQuestObjectiveForHUDForTest({
        quests: [busted],
        mainQuestSelection: biomesUIMainQuestClearedSelectionForTest(),
      }),
      undefined
    );
  });

  it("shows item-source guidance when the active pin is a jobs-board item source", () => {
    const quest: MapTrackableQuest = {
      questId: "jobs_board:repair_todo_1",
      title: "Patch the Safe-Zone Fence",
      area: "The Grove",
      status: "active",
      firstMarkerId: "jobs_board_item_source:repair_todo_1",
      objective: "Repair the marked fence.",
      itemSource: {
        itemId: "softwood_log",
        itemName: "Softwood Log",
        sourceName: "Orchard Softwood Branches",
        markerId: "harthmere_orchard_softwood",
        hint: "Gather 2 Softwood Logs from fallen branches at the Orchard Softwood Branches.",
        missingCount: 2,
      },
    };

    assert.equal(
      currentQuestObjectiveForHUDForTest({
        quests: [quest],
        activeMapPin: {
          markerId: "jobs_board_item_source:repair_todo_1",
          label: "Get Softwood Log",
          kind: "objective",
          worldPosition: [468, 53, -118],
          setAtMs: 3000,
        },
      }),
      "Gather 2 Softwood Logs from fallen branches at the Orchard Softwood Branches."
    );
  });

  it("lets an explicitly pinned jobs-board quest override Road Ahead", () => {
    const deliveryJob: MapTrackableQuest = {
      questId: "jobs_board:harthmere_job_todo_4",
      title: "Courier Run",
      area: "The Grove",
      status: "active",
      firstMarkerId: "jobs_board_marker:harthmere_job_todo_4",
      objective: "Deliver the sealed package to the marked drop-off.",
    };
    const roadAhead: MapTrackableQuest = {
      questId: "snapshot_road_ahead_full_chain",
      title: "Road Ahead",
      area: "The Grove",
      status: "active",
      firstMarkerId: "building_spot",
      kind: "snapshot_nux_challenge_bridge",
      kindLabel: "Story Quest",
      objective: "Equip any block and place it on the ground.",
    };

    assert.equal(
      currentQuestObjectiveForHUDForTest({
        quests: [deliveryJob, roadAhead],
        activeMapPin: {
          markerId: "jobs_board_marker:harthmere_job_todo_4",
          label: "Drop off package",
          kind: "objective",
          worldPosition: [520, 70, -140],
          setAtMs: 3000,
        },
      }),
      "Deliver the sealed package to the marked drop-off."
    );
  });
});
