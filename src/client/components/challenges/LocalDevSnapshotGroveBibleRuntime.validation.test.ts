import assert from "assert";

import {
  doesSnapshotGroveEventAdvanceQuestForTestV132,
  validateSnapshotGroveQuestEventContextV132,
} from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import { SNAPSHOT_GROVE_QUESTS_V75 } from "@/shared/harthmere/snapshot_grove_content_v75";

function questById(id: string) {
  const quest = SNAPSHOT_GROVE_QUESTS_V75.find((entry) => entry.id === id);
  assert.ok(quest, `Expected Snapshot Grove quest ${id} to exist`);
  return quest;
}

describe("Snapshot Grove quest runtime validation v132", () => {
  it("accepts a tagged world event for the current objective", () => {
    const quest = questById("color_that_still_points_home");
    const event = {
      kind: "destroy",
      questId: quest.id,
      objectiveIndex: 1,
      trigger: "destroy",
      markerId: "muckwad_patch",
    };

    assert.equal(
      validateSnapshotGroveQuestEventContextV132(event as any, quest, 1).ok,
      true
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTestV132(event as any, quest, 1),
      true
    );
  });

  it("rejects tagged events for a different quest", () => {
    const quest = questById("color_that_still_points_home");
    const event = {
      kind: "snapshot_grove_practice_action",
      questId: "cart_that_forgot_its_wheel",
      objectiveIndex: 1,
      trigger: "destroy",
      markerId: "muckwad_patch",
    };

    assert.deepEqual(
      validateSnapshotGroveQuestEventContextV132(event as any, quest, 1),
      { ok: false, reason: "quest_id_mismatch" }
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTestV132(event as any, quest, 1),
      false
    );
  });

  it("rejects tagged events for a different objective", () => {
    const quest = questById("color_that_still_points_home");
    const event = {
      kind: "snapshot_grove_practice_action",
      questId: quest.id,
      objectiveIndex: 2,
      trigger: "destroy",
      markerId: "muckwad_patch",
    };

    assert.deepEqual(
      validateSnapshotGroveQuestEventContextV132(event as any, quest, 1),
      { ok: false, reason: "objective_index_mismatch" }
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTestV132(event as any, quest, 1),
      false
    );
  });

  it("rejects tagged events for a different marker", () => {
    const quest = questById("color_that_still_points_home");
    const event = {
      kind: "destroy",
      questId: quest.id,
      objectiveIndex: 1,
      trigger: "destroy",
      markerId: "paint_pot",
    };

    assert.deepEqual(
      validateSnapshotGroveQuestEventContextV132(event as any, quest, 1),
      { ok: false, reason: "marker_id_mismatch" }
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTestV132(event as any, quest, 1),
      false
    );
  });

  it("keeps untagged legacy world events compatible", () => {
    const quest = questById("color_that_still_points_home");

    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTestV132(
        { kind: "destroy" } as any,
        quest,
        1
      ),
      true
    );
  });

  it("keeps authored tab validation strict", () => {
    const quest = questById("road_ready_not_fancy");

    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTestV132(
        { kind: "open_tab", tab: "map" } as any,
        quest,
        0
      ),
      false
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTestV132(
        { kind: "open_tab", tab: "inventory" } as any,
        quest,
        0
      ),
      true
    );
  });
});
