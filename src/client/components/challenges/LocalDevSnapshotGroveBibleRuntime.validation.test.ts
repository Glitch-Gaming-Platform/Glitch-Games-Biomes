import assert from "assert";

import {
  doesSnapshotGroveEventAdvanceQuestForTestV132,
  snapshotGroveQuestEventFromWorldObjectInteractionForTestV1,
  validateSnapshotGroveQuestEventContextV132,
} from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import {
  SNAPSHOT_GROVE_NPCS_V75,
  SNAPSHOT_GROVE_QUESTS_V75,
  snapshotGroveNpcEntityIdV75,
} from "@/shared/harthmere/snapshot_grove_content_v75";

function questById(id: string) {
  const quest = SNAPSHOT_GROVE_QUESTS_V75.find((entry) => entry.id === id);
  assert.ok(quest, `Expected Snapshot Grove quest ${id} to exist`);
  return quest;
}

function npcEntityId(id: string) {
  const npc = SNAPSHOT_GROVE_NPCS_V75.find((entry) => entry.id === id);
  assert.ok(npc, `Expected Snapshot Grove NPC ${id} to exist`);
  return snapshotGroveNpcEntityIdV75(npc);
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

  it("Luis's Patch, Claim, Build chain has a completable event for every step", () => {
    const quest = questById("build_repair_claim_lesson");
    const steps = [
      {
        index: 0,
        event: { kind: "talk_npc", npcId: npcEntityId("luis") },
      },
      {
        index: 1,
        object: {
          label: "Grove Practice Claim Stakes",
          kind: "practice" as const,
          title: "Practice",
        },
      },
      {
        index: 2,
        object: {
          label: "Muckwad Patch",
          kind: "gather" as const,
          title: "Gather",
        },
      },
      {
        index: 3,
        event: {
          kind: "place_voxel",
          questId: quest.id,
          objectiveIndex: 3,
          trigger: "place_voxel",
          markerId: "building_practice_spot",
        },
      },
      {
        index: 4,
        object: {
          label: "Broken Safe-Zone Fence",
          kind: "repair" as const,
          title: "Repair",
        },
      },
      {
        index: 5,
        object: {
          label: "Practice Land Ledger",
          kind: "read" as const,
          title: "Read",
        },
      },
      {
        index: 6,
        object: {
          label: "Safe-Zone Boundary Stones",
          kind: "inspect" as const,
          title: "Inspect",
        },
      },
      {
        index: 7,
        event: { kind: "talk_npc", npcId: npcEntityId("luis") },
      },
    ];

    for (const step of steps) {
      const event =
        "object" in step
          ? snapshotGroveQuestEventFromWorldObjectInteractionForTestV1(
              step.object,
              quest,
              step.index
            )
          : step.event;
      assert.ok(event, `Expected Luis step ${step.index} to produce an event`);
      assert.equal(
        doesSnapshotGroveEventAdvanceQuestForTestV132(
          event as any,
          quest,
          step.index
        ),
        true,
        `Expected Luis step ${step.index} to advance`
      );
    }
  });

  it("Nia's Guilds Are Promises chain has a completable event for every step", () => {
    const quest = questById("guilds_are_promises");
    const steps = [
      {
        index: 0,
        event: {
          kind: "talk_npc",
          npcId: npcEntityId("guild_clerk_nia"),
        },
      },
      {
        index: 1,
        object: {
          label: "Grove Guild Charter Board",
          kind: "read" as const,
          title: "Read",
        },
      },
      {
        index: 2,
        object: {
          label: "Grove Guild Charter Board",
          kind: "read" as const,
          title: "Read",
        },
      },
      {
        index: 3,
        object: {
          label: "Practice Guild Bank Crate",
          kind: "open_container" as const,
          title: "Open Container",
        },
      },
      {
        index: 4,
        object: {
          label: "Guild Project Table",
          kind: "use" as const,
          title: "Use Table",
        },
      },
      {
        index: 5,
        object: {
          label: "Safe-Zone Boundary Stones",
          kind: "inspect" as const,
          title: "Inspect",
        },
      },
      {
        index: 6,
        object: {
          label: "Grove Guild Charter Board",
          kind: "read" as const,
          title: "Read",
        },
      },
      {
        index: 7,
        event: {
          kind: "talk_npc",
          npcId: npcEntityId("guild_clerk_nia"),
        },
      },
    ];

    for (const step of steps) {
      const event =
        "object" in step
          ? snapshotGroveQuestEventFromWorldObjectInteractionForTestV1(
              step.object,
              quest,
              step.index
            )
          : step.event;
      assert.ok(event, `Expected Nia step ${step.index} to produce an event`);
      assert.equal(
        doesSnapshotGroveEventAdvanceQuestForTestV132(
          event as any,
          quest,
          step.index
        ),
        true,
        `Expected Nia step ${step.index} to advance`
      );
    }
  });

  it("does not let a different world object satisfy Luis or Nia's active marker", () => {
    const luis = questById("build_repair_claim_lesson");
    const nia = questById("guilds_are_promises");

    assert.equal(
      snapshotGroveQuestEventFromWorldObjectInteractionForTestV1(
        {
          label: "Practice Land Ledger",
          kind: "read",
          title: "Read",
        },
        luis,
        4
      ),
      undefined
    );
    assert.equal(
      snapshotGroveQuestEventFromWorldObjectInteractionForTestV1(
        {
          label: "Guild Project Table",
          kind: "use",
          title: "Use Table",
        },
        nia,
        3
      ),
      undefined
    );
  });
});
