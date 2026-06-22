import assert from "assert";

import {
  doesSnapshotGroveEventAdvanceQuestForTest,
  grantSnapshotGroveWorldObjectPickupItemForTest,
  requestSnapshotGroveLandmarkOnMapForBiomesUI,
  snapshotGrovePracticeItemForObjectiveForTest,
  snapshotGroveQuestEventFromWorldObjectInteractionForTest,
  validateSnapshotGroveQuestEventContext,
} from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import {
  BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY,
  BIOMES_UI_LOCATE_ON_MAP_EVENT,
} from "@/client/components/biomes_ui/adapters/mapPinnedDestination";
import { CURSOR_INSPECTION_SHORTCUT_KEYS_FOR_TEST } from "@/client/components/overlays/inspected/inspectionShortcutKeys";
import { harthmereInventoryCountByItemId } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import { selectNearestHarthmereWorldObjectInspectable } from "@/shared/harthmere/harthmere_world_object_inspectable";
import {
  SNAPSHOT_GROVE_NPCS,
  SNAPSHOT_GROVE_QUESTS,
  snapshotGroveLandmarkById,
  snapshotGroveNpcEntityId,
} from "@/shared/harthmere/snapshot_grove_content";
import { snapshotGroveObjectiveCompletionFixture } from "@/shared/harthmere/snapshot_grove_trigger_contract";

function questById(id: string) {
  const quest = SNAPSHOT_GROVE_QUESTS.find((entry) => entry.id === id);
  assert.ok(quest, `Expected Snapshot Grove quest ${id} to exist`);
  return quest;
}

function npcEntityId(id: string) {
  const npc = SNAPSHOT_GROVE_NPCS.find((entry) => entry.id === id);
  assert.ok(npc, `Expected Snapshot Grove NPC ${id} to exist`);
  return snapshotGroveNpcEntityId(npc);
}

function talkEventNpcId(id: string) {
  const npc = SNAPSHOT_GROVE_NPCS.find((entry) => entry.id === id);
  return npc ? snapshotGroveNpcEntityId(npc) : id;
}

function questStepCompletionEvent(quest: any, objectiveIndex: number) {
  const fixture = snapshotGroveObjectiveCompletionFixture(
    quest,
    objectiveIndex
  );
  if (!fixture) {
    return undefined;
  }
  if (fixture.kind !== "talk_npc") {
    return fixture;
  }
  const marker = snapshotGroveLandmarkById(quest.markerIds[objectiveIndex]);
  const npcId = marker?.npcId ?? quest.giverNpcId;
  return {
    ...fixture,
    npcId: talkEventNpcId(npcId),
  };
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
  const previousCustomEvent = (globalThis as any).CustomEvent;
  if (typeof previousCustomEvent === "undefined") {
    (globalThis as any).CustomEvent = class CustomEvent<T = unknown> extends Event {
      detail: T;

      constructor(type: string, init?: CustomEventInit<T>) {
        super(type, init);
        this.detail = init?.detail as T;
      }
    };
  }
  (globalThis as any).window = {
    localStorage: localStorageMock,
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    CustomEvent: (globalThis as any).CustomEvent,
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
    if (previousCustomEvent === undefined) {
      delete (globalThis as any).CustomEvent;
    } else {
      (globalThis as any).CustomEvent = previousCustomEvent;
    }
  };
}

const PHYSICAL_PICKUP_INTERACT_RE =
  /\b(take|pick up|collect|gather|retrieve|recover|dig)\b/i;
const NON_PICKUP_INTERACT_RE = /\bmirror check\b/i;

function snapshotGrovePhysicalPickupCases() {
  return SNAPSHOT_GROVE_QUESTS.flatMap((quest) =>
    quest.objectives.flatMap((objective, objectiveIndex) => {
      const trigger = quest.triggers[objectiveIndex];
      const item = snapshotGrovePracticeItemForObjectiveForTest(
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
      const marker = snapshotGroveLandmarkById(
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

describe("Snapshot Grove quest runtime validation current", () => {
  it("opens and centers BiomesUI map when a dialogue marker is shown on the map", () => {
    const restore = installBrowserStorageShim();
    try {
      const dispatched: Array<{ type: string; detail?: any }> = [];
      (globalThis as any).window.dispatchEvent = (event: Event) => {
        dispatched.push(event as any);
        return true;
      };
      const marker = snapshotGroveLandmarkById("npc_old_coop");
      assert.ok(marker, "Old Coop should have a Snapshot Grove map marker");

      const pin = requestSnapshotGroveLandmarkOnMapForBiomesUI(marker);

      assert.equal(pin?.markerId, "npc_old_coop");
      const stored = JSON.parse(
        localStorageValues.get(BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY) ?? "{}"
      );
      assert.equal(stored.markerId, "npc_old_coop");
      assert.ok(
        dispatched.some(
          (event) =>
            event.type === BIOMES_UI_LOCATE_ON_MAP_EVENT &&
            event.detail?.markerId === "npc_old_coop"
        ),
        "Show on map should ask BiomesUI to open and center the Map tab"
      );
    } finally {
      restore();
    }
  });

  it("audits every Snapshot Grove quest from accept through every objective fixture", () => {
    const failures: string[] = [];

    for (const quest of SNAPSHOT_GROVE_QUESTS) {
      for (
        let objectiveIndex = 0;
        objectiveIndex < quest.objectives.length;
        objectiveIndex += 1
      ) {
        const event = questStepCompletionEvent(quest, objectiveIndex);
        if (!event) {
          failures.push(`${quest.id}[${objectiveIndex}]: missing fixture`);
          continue;
        }
        if (
          !doesSnapshotGroveEventAdvanceQuestForTest(
            event as any,
            quest,
            objectiveIndex
          )
        ) {
          failures.push(
            `${quest.id}[${objectiveIndex}]: fixture did not advance ${
              quest.triggers[objectiveIndex]
            }`
          );
        }
      }
    }

    assert.deepEqual(failures, []);
  });

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
      validateSnapshotGroveQuestEventContext(event as any, quest, 1).ok,
      true
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(event as any, quest, 1),
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
      validateSnapshotGroveQuestEventContext(event as any, quest, 1),
      { ok: false, reason: "quest_id_mismatch" }
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(event as any, quest, 1),
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
      validateSnapshotGroveQuestEventContext(event as any, quest, 1),
      { ok: false, reason: "objective_index_mismatch" }
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(event as any, quest, 1),
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
      validateSnapshotGroveQuestEventContext(event as any, quest, 1),
      { ok: false, reason: "marker_id_mismatch" }
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(event as any, quest, 1),
      false
    );
  });

  it("keeps untagged legacy world events compatible", () => {
    const quest = questById("color_that_still_points_home");

    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(
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
      doesSnapshotGroveEventAdvanceQuestForTest(
        { kind: "open_tab", tab: "map" } as any,
        quest,
        0
      ),
      false
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(
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
      doesSnapshotGroveEventAdvanceQuestForTest(event as any, quest, 1),
      true
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(event as any, quest, 2),
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
          ? snapshotGroveQuestEventFromWorldObjectInteractionForTest(
              step.object!,
              quest,
              step.index
            )
          : step.event;
      assert.ok(event, `Expected Luis step ${step.index} to produce an event`);
      assert.equal(
        doesSnapshotGroveEventAdvanceQuestForTest(
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
          ? snapshotGroveQuestEventFromWorldObjectInteractionForTest(
              step.object!,
              quest,
              step.index
            )
          : step.event;
      assert.ok(event, `Expected Nia step ${step.index} to produce an event`);
      assert.equal(
        doesSnapshotGroveEventAdvanceQuestForTest(
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
      snapshotGroveQuestEventFromWorldObjectInteractionForTest(
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
      snapshotGroveQuestEventFromWorldObjectInteractionForTest(
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
      const selected = selectNearestHarthmereWorldObjectInspectable({
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

      const event = snapshotGroveQuestEventFromWorldObjectInteractionForTest(
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
        doesSnapshotGroveEventAdvanceQuestForTest(
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
        const before = harthmereInventoryCountByItemId(item.itemId);
        const granted = grantSnapshotGroveWorldObjectPickupItemForTest(
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
          harthmereInventoryCountByItemId(item.itemId),
          before + item.quantity,
          `${quest.id}[${objectiveIndex}] should put ${item.itemId} into inventory`
        );
      }
    } finally {
      restoreBrowserStorage();
    }
  });
});
