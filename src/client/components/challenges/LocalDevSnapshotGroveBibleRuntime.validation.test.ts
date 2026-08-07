import assert from "assert";

import {
  SNAPSHOT_GROVE_QUEST_STATE_KEY,
  activeSnapshotGroveQuestMarkerIds,
  doesSnapshotGroveEventAdvanceQuestForTest,
  grantSnapshotGroveWorldObjectPickupItemForTest,
  mostRecentlyCompletedSnapshotGroveQuestForNpcForTest,
  readSnapshotGroveQuestState,
  requestSnapshotGroveLandmarkOnMapForBiomesUI,
  selectSnapshotGroveQuest,
  snapshotGroveActiveMapPinForQuestStepForTest,
  snapshotGroveObjectiveIsCompletionTurnInForTest,
  snapshotGroveObjectiveIndexForQuest,
  snapshotGrovePracticeItemForObjectiveForTest,
  snapshotGroveNpcIdForEntityForTest,
  snapshotGroveQuestEventFromWorldObjectInteractionForTest,
  snapshotGroveTutorNavLabelsForObjectiveForTest,
  type SnapshotGroveQuestState,
  validateSnapshotGroveQuestEventContext,
  visibleSnapshotGroveQuestOffersForNpcForTest,
} from "@/client/components/challenges/LocalDevSnapshotGroveBibleRuntime";
import {
  BIOMES_UI_ACTIVE_MAP_PIN_STORAGE_KEY,
  BIOMES_UI_LOCATE_ON_MAP_EVENT,
} from "@/client/components/biomes_ui/adapters/mapPinnedDestination";
import { CURSOR_INSPECTION_SHORTCUT_KEYS_FOR_TEST } from "@/client/components/overlays/inspected/inspectionShortcutKeys";
import { harthmereInventoryCountByItemId } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  HARTHMERE_LOCAL_COMBAT_NPC_DAMAGE_EVENT,
  dispatchHarthmereLocalCombatNpcDamage,
} from "@/client/components/challenges/harthmereEvents";
import { selectNearestHarthmereWorldObjectInspectable } from "@/shared/harthmere/harthmere_world_object_inspectable";
import { harthmereObjectUsesContainerFlow } from "@/shared/harthmere/object_interaction_semantics";
import {
  SNAPSHOT_GROVE_NPCS,
  SNAPSHOT_GROVE_QUESTS,
  snapshotGroveLandmarkById,
  snapshotGroveNpcEntityId,
} from "@/shared/harthmere/snapshot_grove_content";
import {
  snapshotGroveObjectiveCompletionFixture,
  snapshotGroveObjectiveMarkerIdForProgress,
  snapshotGroveObjectiveTargetMarkerIds,
} from "@/shared/harthmere/snapshot_grove_trigger_contract";
import { groveQuest } from "@/shared/harthmere/grove/grove_quest_catalog";
import { SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS } from "@/shared/harthmere/snapshot_grove_ids";
import { HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST } from "@/shared/harthmere/harthmere_native_quest_manifest";

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
  // RESOLVE THE MARKER, do not read the shipped row.
  //
  // The fixture models what the player actually does, so it has to talk to the
  // NPC the objective now points at. Reading `quest.markerIds` raw built a
  // "talk to Jackie" event for the four fountain lessons that moved to Rosalyn,
  // because the retired array still names `npc_jackie` on their opening and
  // closing objectives while the catalog — and therefore the runtime — names
  // Rosalyn. That made this audit assert the OLD behaviour: it would have gone
  // green precisely when the player was sent to the wrong NPC.
  const marker = snapshotGroveLandmarkById(
    snapshotGroveObjectiveTargetMarkerIds(quest, objectiveIndex)[0] ??
      quest.markerIds[objectiveIndex]
  );
  // Same reason for the fallback: the catalog giver, not the retired row's.
  const npcId =
    marker?.npcId ?? groveQuest(quest.id)?.start.giverNpcId ?? quest.giverNpcId;
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
    (globalThis as any).CustomEvent = class CustomEvent<T = unknown> extends (
      Event
    ) {
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
      const markerId = snapshotGroveObjectiveMarkerIdForProgress(
        quest,
        objectiveIndex,
        0
      );
      const marker = markerId ? snapshotGroveLandmarkById(markerId) : undefined;
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
  it("lights only HUD controls that perform the current objective", () => {
    assert.deepEqual(
      snapshotGroveTutorNavLabelsForObjectiveForTest(
        "open_tab",
        "Open the storage, mail, or recovery panel from the HUD."
      ),
      ["Mail"]
    );
    assert.deepEqual(
      snapshotGroveTutorNavLabelsForObjectiveForTest(
        "collect",
        "Collect one clean root sample at the muck edge."
      ),
      [],
      "a world pickup must not keep pulsing Bag"
    );
    assert.deepEqual(
      snapshotGroveTutorNavLabelsForObjectiveForTest(
        "inventory_change",
        "Equip the camera Dimmi loans you."
      ),
      ["Bag"]
    );
    assert.deepEqual(
      snapshotGroveTutorNavLabelsForObjectiveForTest(
        "craft",
        "Cook the skewers at Carlo's Campfire inside the house."
      ),
      ["Craft"]
    );
  });

  it("opens all reported onboarding return visits with completion dialogue", () => {
    for (const questId of [
      "fountain_buttons_first",
      "tools_before_treasure",
      "road_ready_bag_check",
    ]) {
      const quest = questById(questId);
      assert.equal(
        snapshotGroveObjectiveIsCompletionTurnInForTest(
          quest,
          quest.objectives.length - 1
        ),
        true,
        `${quest.title} must turn in on its final giver conversation`
      );
    }
  });

  it("acknowledges the latest completed lesson before offering another lesson", () => {
    // Completion acknowledgement follows the authoritative typed-catalog
    // giver reassignment, not the retired array's stale Jackie id.
    const rosalynCompleted =
      mostRecentlyCompletedSnapshotGroveQuestForNpcForTest("rosalyn", [
        "read-the-jobs-board",
        "fountain_buttons_first",
      ]);
    const jackieCompleted =
      mostRecentlyCompletedSnapshotGroveQuestForNpcForTest("jackie", [
        "read-the-jobs-board",
        "fountain_buttons_first",
      ]);

    assert.equal(rosalynCompleted?.id, "fountain_buttons_first");
    assert.equal(jackieCompleted?.id, "read-the-jobs-board");
  });

  it("shows at most two Rosalyn offers while exposing the next queued lesson", () => {
    const base: SnapshotGroveQuestState = {
      acceptedQuestIds: [],
      activeObjectiveIndex: 0,
      objectiveIndexByQuestId: {},
      objectiveProgressByQuestId: {},
      completedQuestIds: [],
      completedObjectiveIds: [],
      rewards: [],
    };
    const first = visibleSnapshotGroveQuestOffersForNpcForTest("rosalyn", base);
    assert.equal(first.length, 2);

    const second = visibleSnapshotGroveQuestOffersForNpcForTest("rosalyn", {
      ...base,
      completedQuestIds: [first[0].id],
    });
    assert.equal(second.length, 2);
    assert.ok(!second.some((quest) => quest.id === first[0].id));
    assert.ok(
      second.some(
        (quest) => !first.some((original) => original.id === quest.id)
      ),
      "finishing one visible offer should reveal a queued lesson"
    );
  });

  it("keeps the Jobs Board in Jackie's first two readable offers", () => {
    const offers = visibleSnapshotGroveQuestOffersForNpcForTest("jackie", {
      acceptedQuestIds: [],
      activeObjectiveIndex: 0,
      objectiveIndexByQuestId: {},
      objectiveProgressByQuestId: {},
      completedQuestIds: [],
      completedObjectiveIds: [],
      rewards: [],
    });
    assert.ok(offers.length <= 2);
    assert.ok(
      offers.some((quest) => quest.id === "read-the-jobs-board"),
      "Jackie's readable offer queue should expose the Jobs Board immediately"
    );
  });

  it("maps retained legacy Grove actors back to their canonical dialogue profiles", () => {
    assert.equal(
      snapshotGroveNpcIdForEntityForTest({
        entityId: SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS.jackie,
      }),
      "jackie"
    );
    assert.equal(
      snapshotGroveNpcIdForEntityForTest({
        entityId: SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS.taye,
      }),
      "taye"
    );
  });

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

  it("builds an owned automatic pin for Taye's current real objective", () => {
    const quest = questById("painted_path_language");
    const pin = snapshotGroveActiveMapPinForQuestStepForTest(quest, 1);
    assert.equal(pin?.markerId, "paint_pot");
    assert.equal(pin?.ownerQuestId, quest.id);
    assert.equal(pin?.ownerStepId, "painted_path_language_obj_02");
    assert.ok(pin?.worldPosition.every(Number.isFinite));
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
            `${quest.id}[${objectiveIndex}]: fixture did not advance ${quest.triggers[objectiveIndex]}`
          );
        }
      }
    }

    assert.deepEqual(failures, []);
  });

  it("gives every Grove objective an exact finite current-step map pin", () => {
    const failures: string[] = [];
    for (const quest of SNAPSHOT_GROVE_QUESTS) {
      for (
        let objectiveIndex = 0;
        objectiveIndex < quest.objectives.length;
        objectiveIndex += 1
      ) {
        const expectedMarkerId = snapshotGroveObjectiveMarkerIdForProgress(
          quest,
          objectiveIndex,
          0
        );
        const pin = snapshotGroveActiveMapPinForQuestStepForTest(
          quest,
          objectiveIndex
        );
        if (
          !expectedMarkerId ||
          pin?.markerId !== expectedMarkerId ||
          pin.ownerQuestId !== quest.id ||
          !pin.worldPosition.every(Number.isFinite)
        ) {
          failures.push(
            `${quest.id}[${objectiveIndex}]: expected ${expectedMarkerId}, received ${pin?.markerId}`
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
      markerId: "muckwad_pigment_clump_west",
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

  it("does not complete Taye's paint inspection from collision alone", () => {
    const quest = questById("painted_path_language");
    const collision = {
      kind: "start_collide_entity",
      questId: quest.id,
      objectiveIndex: 1,
      trigger: "interact",
      markerId: "paint_pot",
    };
    const inspection = { ...collision, kind: "inspect_frame" };

    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(collision as any, quest, 1),
      false
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(inspection as any, quest, 1),
      true
    );
  });

  it("publishes a resolved local weapon hit through the canonical Grove combat bridge", () => {
    const restore = installBrowserStorageShim();
    try {
      const target = new EventTarget();
      let received: unknown;
      target.addEventListener(
        HARTHMERE_LOCAL_COMBAT_NPC_DAMAGE_EVENT,
        (event) => {
          received = (event as CustomEvent).detail;
        }
      );
      assert.equal(
        dispatchHarthmereLocalCombatNpcDamage(
          {
            targetOffset: 9015,
            targetId: 9015,
            targetName: "Softwood Practice Dummy",
            damage: 7,
            ability: "basic",
            targetDead: false,
          },
          target
        ),
        true
      );
      assert.deepEqual(received, {
        targetOffset: 9015,
        targetId: 9015,
        targetName: "Softwood Practice Dummy",
        damage: 7,
        ability: "basic",
        targetDead: false,
      });
    } finally {
      restore();
    }
  });

  it("advances Sparring only from the exact dummy and supports both a real hit and the F fallback", () => {
    const quest = questById("safe_sparring_not_pvp");
    const practice = snapshotGroveQuestEventFromWorldObjectInteractionForTest(
      {
        label: "Softwood Practice Dummy",
        kind: "practice",
        title: "Practice",
      },
      quest,
      3
    );
    assert.ok(practice);
    assert.equal((practice as any).kind, "npc_damage");
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(practice as any, quest, 3),
      true
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(
        {
          kind: "npc_damage",
          targetId: 9015,
          targetName: "Softwood Practice Dummy",
          markerId: "grove_combat_practice_dummy",
        } as any,
        quest,
        3
      ),
      true
    );
    assert.equal(
      snapshotGroveQuestEventFromWorldObjectInteractionForTest(
        {
          label: "Consent Sparring Ring",
          kind: "practice",
          title: "Practice",
        },
        quest,
        3
      ),
      undefined,
      "the nearby ring must not count as hitting the dummy"
    );
  });

  it("keeps the combat target beyond the protected Grove boundary marker", () => {
    const ring = snapshotGroveLandmarkById("grove_sparring_boundary");
    const dummy = snapshotGroveLandmarkById("grove_combat_practice_dummy");
    const boundary = snapshotGroveLandmarkById("grove_safe_wild_boundary");
    assert.ok(ring && dummy && boundary);
    assert.equal(ring!.area, "old_grove_road");
    assert.equal(dummy!.area, "old_grove_road");
    assert.ok(
      dummy!.position[0] > boundary!.position[0] &&
        dummy!.position[2] < boundary!.position[2],
      "dummy should sit on the Wilds side of both boundary axes"
    );
    assert.ok(
      Math.hypot(
        dummy!.position[0] - ring!.position[0],
        dummy!.position[2] - ring!.position[2]
      ) >= 5,
      "the ring arrival must not immediately overlap the strike target"
    );
  });

  it("uses three distinct mapped sample props for Doc's clean, mucked, and sealed objectives", () => {
    const cases = [
      ["sticky_medicine", 0, "doc_clean_root_sample", "Clean Root Sample"],
      ["sticky_medicine", 1, "doc_mucked_root_sample", "Mucked Root Sample"],
      [
        "samples_for_the_chapel",
        0,
        "doc_sealed_muck_sample",
        "Sealed Muck Sample",
      ],
    ] as const;
    const positions: Array<readonly [number, number, number]> = [];
    for (const [questId, objectiveIndex, markerId, itemLabel] of cases) {
      const quest = questById(questId);
      assert.equal(quest.markerIds[objectiveIndex], markerId);
      const marker = snapshotGroveLandmarkById(markerId);
      assert.ok(marker);
      positions.push(marker!.position as readonly [number, number, number]);
      assert.equal(
        snapshotGrovePracticeItemForObjectiveForTest(quest, objectiveIndex)
          ?.label,
        itemLabel
      );
      const pin = snapshotGroveActiveMapPinForQuestStepForTest(
        quest,
        objectiveIndex
      );
      assert.equal(pin?.markerId, markerId);
    }
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        assert.ok(
          Math.hypot(
            positions[i]![0] - positions[j]![0],
            positions[i]![2] - positions[j]![2]
          ) >= 5,
          "sample objectives must not be stacked on the same world column"
        );
      }
    }
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

  it("accepts either highlighted storage panel for Nothing Useful Stays Lost", () => {
    const quest = questById("lost_found_and_mail");
    for (const tab of ["inbox", "banking"]) {
      assert.equal(
        doesSnapshotGroveEventAdvanceQuestForTest(
          { kind: "open_tab", tab } as any,
          quest,
          1
        ),
        true,
        tab
      );
    }
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(
        { kind: "open_tab", tab: "options" } as any,
        quest,
        1
      ),
      false
    );
  });

  it("lets native connector NPC talks progress Grove while Chapter 1 keeps the visible dialogue", () => {
    const quest = questById("samples_for_the_chapel");
    const chapelStone = snapshotGroveLandmarkById("harthmere_chapel_stone");
    assert.equal(chapelStone?.npcId, "father_aldren_mell");
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(
        {
          kind: "talk_npc",
          npcId:
            HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST.father_aldren_mell.entityId,
        } as any,
        quest,
        1
      ),
      true
    );
  });

  it("advances only the exact real chat action for each chat lesson step", () => {
    const quest = questById("fountain_chat_channels");
    const event = (objectiveIndex: number, practiceAction: string) => ({
      kind: "snapshot_grove_practice_action",
      questId: quest.id,
      objectiveIndex,
      trigger: "interact",
      markerId: quest.markerIds[objectiveIndex],
      practiceAction,
    });

    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(
        event(2, "chat_say") as any,
        quest,
        2
      ),
      true
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(
        event(3, "chat_whisper") as any,
        quest,
        3
      ),
      true
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(
        event(3, "chat_say") as any,
        quest,
        3
      ),
      false
    );

    const tools = questById("tools_before_treasure");
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(
        {
          kind: "snapshot_grove_practice_action",
          questId: tools.id,
          objectiveIndex: 1,
          trigger: "interact",
          markerId: tools.markerIds[1],
          practiceAction: "chat_say",
        } as any,
        tools,
        1
      ),
      false,
      "chat support must not re-enable synthetic completion for other interactions"
    );
  });

  it("requires the exact Road-Ready clothing item and slot", () => {
    const quest = questById("road_ready_not_fancy");

    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(
        {
          kind: "equip",
          operation: "equip",
          slot: "chest",
          itemId: "baker_apron",
          itemName: "Travel Top Apron",
        } as any,
        quest,
        1
      ),
      true
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(
        {
          kind: "equip",
          operation: "equip",
          slot: "legs",
          itemId: "field_trousers",
          itemName: "Travel Bottoms",
        } as any,
        quest,
        2
      ),
      true
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(
        { kind: "inventory_change" } as any,
        quest,
        1
      ),
      false
    );
    assert.equal(
      doesSnapshotGroveEventAdvanceQuestForTest(
        {
          kind: "equip",
          operation: "equip",
          slot: "chest",
          itemId: "iron_sword",
        } as any,
        quest,
        1
      ),
      false
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
          kind: "inspect" as const,
          title: "Inspect Guild Crate",
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

  it("routes every lightweight Grove objective prop through signed world-object receipts, never the native ECS container API", () => {
    const markerIds = new Set(
      SNAPSHOT_GROVE_QUESTS.flatMap((quest) => quest.markerIds)
    );
    const offenders = [...markerIds]
      .map((id) => snapshotGroveLandmarkById(id))
      .filter((marker) => marker && marker.kind !== "npc")
      .filter((marker) =>
        harthmereObjectUsesContainerFlow({ label: marker!.label })
      )
      .map((marker) => `${marker!.id}:${marker!.label}`);
    assert.deepEqual(
      offenders,
      [],
      "procedural Grove props have no ECS container entity and must not call /native_container"
    );
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

  it("migrates the legacy single objective index without losing per-quest progress", () => {
    const restoreBrowserStorage = installBrowserStorageShim();
    localStorageMock.clear();

    try {
      localStorageMock.setItem(
        SNAPSHOT_GROVE_QUEST_STATE_KEY,
        JSON.stringify({
          acceptedQuestIds: [
            "fountain_buttons_first",
            "color_that_still_points_home",
          ],
          activeQuestId: "color_that_still_points_home",
          activeObjectiveIndex: 1,
          completedQuestIds: [],
          completedObjectiveIds: [],
          rewards: [],
        })
      );

      const migrated = readSnapshotGroveQuestState();
      assert.equal(
        snapshotGroveObjectiveIndexForQuest(
          migrated,
          "color_that_still_points_home"
        ),
        1
      );
      assert.equal(
        snapshotGroveObjectiveIndexForQuest(migrated, "fountain_buttons_first"),
        0
      );

      assert.equal(selectSnapshotGroveQuest("fountain_buttons_first"), true);
      const selected = readSnapshotGroveQuestState();
      assert.equal(selected.activeQuestId, "fountain_buttons_first");
      assert.equal(selected.activeObjectiveIndex, 0);
      assert.equal(
        snapshotGroveObjectiveIndexForQuest(
          selected,
          "color_that_still_points_home"
        ),
        1,
        "changing the selected quest must not rewind another active quest"
      );
    } finally {
      restoreBrowserStorage();
    }
  });

  it("keeps one current physical target visible for every accepted quest", () => {
    const markerIds = activeSnapshotGroveQuestMarkerIds({
      acceptedQuestIds: [
        "color_that_still_points_home",
        "moss_that_went_quiet",
      ],
      activeQuestId: "color_that_still_points_home",
      activeObjectiveIndex: 1,
      objectiveIndexByQuestId: {
        color_that_still_points_home: 1,
        moss_that_went_quiet: 2,
      },
      objectiveProgressByQuestId: {
        color_that_still_points_home: {
          objectiveIndex: 1,
          count: 1,
          evidenceKeys: ["muckwad_pigment_clump_west"],
        },
        moss_that_went_quiet: {
          objectiveIndex: 2,
          count: 1,
          evidenceKeys: ["mosslawn_warning_moss_west"],
        },
      },
      completedQuestIds: [],
      completedObjectiveIds: [],
      rewards: [],
    });

    assert.deepEqual([...markerIds].sort(), [
      "mosslawn_warning_moss_center",
      "muckwad_pigment_clump_east",
    ]);
  });
});
