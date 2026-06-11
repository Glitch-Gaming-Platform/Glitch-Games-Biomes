import assert from "assert";

import {
  doesSnapshotGroveEventAdvanceQuestForTestV132,
  grantSnapshotGroveWorldObjectPickupItemForTestV1,
  snapshotGrovePracticeItemForObjectiveForTestV110,
  snapshotGroveQuestEventFromWorldObjectInteractionForTestV1,
  validateSnapshotGroveQuestEventContextV132,
} from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import { CURSOR_INSPECTION_SHORTCUT_KEYS_FOR_TEST } from "@/client/components/overlays/inspected/inspectionShortcutKeys";
import { harthmereInventoryCountByItemIdV141 } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { selectNearestHarthmereWorldObjectInspectableV1 } from "@/shared/harthmere/harthmere_world_object_inspectable_v1";
import {
  SNAPSHOT_GROVE_NPCS_V75,
  SNAPSHOT_GROVE_QUESTS_V75,
  snapshotGroveLandmarkByIdV75,
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

const localStorageValues = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) =>
    localStorageValues.has(key) ? localStorageValues.get(key)! : null,
  setItem: (key: string, value: string) => {
    localStorageValues.set(key, String(value));
  },
  removeItem: (key: string) => {
    localStorageValues.delete(key);
  },
  clear: () => {
    localStorageValues.clear();
  },
};

function installBrowserStorageShim() {
  const previousWindow = (globalThis as any).window;
  const previousLocalStorage = (globalThis as any).localStorage;
  (globalThis as any).window = {
    localStorage: localStorageMock,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  (globalThis as any).localStorage = localStorageMock;
  return () => {
    if (previousWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = previousWindow;
    }
    if (previousLocalStorage === undefined) {
      delete (globalThis as any).localStorage;
    } else {
      (globalThis as any).localStorage = previousLocalStorage;
    }
  };
}

const PHYSICAL_PICKUP_INTERACT_RE =
  /\b(take|pick up|collect|gather|retrieve|recover|dig)\b/i;
const NON_PICKUP_INTERACT_RE = /\bmirror check\b/i;

function snapshotGrovePhysicalPickupCases() {
  return SNAPSHOT_GROVE_QUESTS_V75.flatMap((quest) =>
    quest.objectives.flatMap((objective, objectiveIndex) => {
      const trigger = quest.triggers[objectiveIndex];
      const item = snapshotGrovePracticeItemForObjectiveForTestV110(
        quest,
        objectiveIndex
      );
      const isPickupTrigger =
        trigger === "collect" ||
        trigger === "item_grant" ||
        (trigger === "interact" &&
          PHYSICAL_PICKUP_INTERACT_RE.test(objective) &&
          !NON_PICKUP_INTERACT_RE.test(objective));
      if (!isPickupTrigger) {
        return [];
      }
      const marker = snapshotGroveLandmarkByIdV75(
        quest.markerIds[objectiveIndex]
      );
      if (
        !marker ||
        marker.kind === "npc" ||
        marker.kind === "danger" ||
        marker.id.startsWith("npc_")
      ) {
        return [];
      }
      return [{ quest, objectiveIndex, objective, trigger, marker, item }];
    })
  );
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

  it("keeps Road-Ready clothing objectives completable from inventory changes", () => {
    const quest = questById("road_ready_not_fancy");
    const event = { kind: "inventory_change" };

    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTestV132(event as any, quest, 1),
      true
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTestV132(event as any, quest, 2),
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
              step.object!,
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
              step.object!,
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

  it("shows an F prompt for every physical pickup objective and routes F into quest progress", () => {
    const cases = snapshotGrovePhysicalPickupCases();
    assert.ok(cases.length >= 20, "expected data-driven pickup coverage");
    assert.equal(CURSOR_INSPECTION_SHORTCUT_KEYS_FOR_TEST[0].key, "F");
    assert.deepEqual(
      cases
        .filter(({ item }) => !item)
        .map(
          ({ quest, objectiveIndex, objective }) =>
            `${quest.id}[${objectiveIndex}]: ${objective}`
        ),
      [],
      "every physical pickup objective should map to an inventory item"
    );

    for (const { quest, objectiveIndex, trigger, marker } of cases) {
      const selected = selectNearestHarthmereWorldObjectInspectableV1({
        playerPosition: [
          marker.position[0] - 1,
          marker.position[1],
          marker.position[2],
        ],
        facingView: [1, 0, 0],
        candidates: [
          {
            id: marker.id,
            label: marker.label,
            position: marker.position,
          },
        ],
      });
      assert.ok(
        selected,
        `${quest.id}[${objectiveIndex}] should show a world-object F prompt for ${marker.label}`
      );

      const event = snapshotGroveQuestEventFromWorldObjectInteractionForTestV1(
        {
          label: marker.label,
          kind: selected!.interaction.kind,
          title: selected!.interaction.title,
        },
        quest,
        objectiveIndex
      );
      assert.ok(
        event,
        `${quest.id}[${objectiveIndex}] ${trigger} should produce a quest event from F`
      );
      assert.equal(
        doesSnapshotGroveEventAdvanceQuestForTestV132(
          event as any,
          quest,
          objectiveIndex
        ),
        true,
        `${quest.id}[${objectiveIndex}] F event should advance the active objective`
      );
    }
  });

  it("puts every physical pickup objective's item into inventory on the same F interaction path", () => {
    const restoreBrowserStorage = installBrowserStorageShim();
    localStorageMock.clear();

    try {
      for (const {
        quest,
        objectiveIndex,
        trigger,
        item,
        marker,
      } of snapshotGrovePhysicalPickupCases()) {
        assert.ok(
          item,
          `${quest.id}[${objectiveIndex}] should map ${marker.label} to an inventory item`
        );
        const before = harthmereInventoryCountByItemIdV141(item.itemId);
        const granted = grantSnapshotGroveWorldObjectPickupItemForTestV1(
          quest,
          objectiveIndex,
          trigger
        );
        assert.ok(
          granted,
          `${quest.id}[${objectiveIndex}] should grant ${item.itemId} from ${marker.label}`
        );
        assert.equal(granted!.itemId, item.itemId);
        assert.equal(
          harthmereInventoryCountByItemIdV141(item.itemId),
          before + item.quantity,
          `${quest.id}[${objectiveIndex}] should put ${item.itemId} into inventory`
        );
      }
    } finally {
      restoreBrowserStorage();
    }
  });
});
