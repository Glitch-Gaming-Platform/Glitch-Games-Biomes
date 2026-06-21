/// <reference types="mocha" />
import assert from "assert";

import {
  questDetailItemSourceMarkerCandidates,
  questDetailToolShopMarkerCandidates,
} from "../questDetailToolSource";

describe("questDetailToolShopMarkerCandidates", () => {
  it("prefers the per-todo tool-source landmark, then the vendor marker", () => {
    const candidates = questDetailToolShopMarkerCandidates({
      questId: "jobs_board:repair_todo_1",
      toolSource: {
        action: "repair",
        toolName: "Repair Mallet",
        vendorName: "Fixer Tomas Hinge",
        vendorMarkerId: "harthmere_owner:npc_outpost_hingehall_fixer",
        hint: "Buy it from the marked shop.",
      },
    });
    assert.deepEqual(candidates, [
      "jobs_board_tool_source:repair_todo_1",
      "harthmere_owner:npc_outpost_hingehall_fixer",
    ]);
  });

  it("returns the vendor marker only when the quest id is not a jobs-board id", () => {
    const candidates = questDetailToolShopMarkerCandidates({
      questId: "some_other_quest",
      toolSource: {
        action: "cleanup",
        toolName: "Muck Rake",
        vendorName: "Boss Greta Clearbarrel",
        vendorMarkerId: "harthmere_owner:npc_outpost_clearbarrel_boss",
        hint: "Buy it from the marked shop.",
      },
    });
    assert.deepEqual(candidates, [
      "harthmere_owner:npc_outpost_clearbarrel_boss",
    ]);
  });

  it("returns only the landmark id when there is no tool source", () => {
    const candidates = questDetailToolShopMarkerCandidates({
      questId: "jobs_board:hunt_todo_9",
      toolSource: undefined,
    });
    assert.deepEqual(candidates, ["jobs_board_tool_source:hunt_todo_9"]);
  });

  it("returns nothing to locate for a non-jobs-board quest with no tool source", () => {
    assert.deepEqual(
      questDetailToolShopMarkerCandidates({
        questId: "snapshot_quest_road_ahead",
        toolSource: undefined,
      }),
      []
    );
  });
});

describe("questDetailItemSourceMarkerCandidates", () => {
  it("prefers the per-todo item-source landmark, then the source marker", () => {
    const candidates = questDetailItemSourceMarkerCandidates({
      questId: "jobs_board:repair_todo_1",
      itemSource: {
        itemId: "softwood_log",
        itemName: "Softwood Log",
        sourceName: "Orchard Softwood Branches",
        markerId: "harthmere_orchard_softwood",
        hint: "Gather it at the orchard.",
        missingCount: 2,
      },
    });
    assert.deepEqual(candidates, [
      "jobs_board_item_source:repair_todo_1",
      "harthmere_orchard_softwood",
    ]);
  });

  it("returns nothing to locate for a non-jobs-board quest with no item source", () => {
    assert.deepEqual(
      questDetailItemSourceMarkerCandidates({
        questId: "snapshot_quest_road_ahead",
        itemSource: undefined,
      }),
      []
    );
  });
});
