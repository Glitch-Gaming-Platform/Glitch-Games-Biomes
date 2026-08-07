/// <reference types="mocha" />
import assert from "assert";
import {
  automaticQuestDestinationMarkerForTest,
  biomesUIActiveMapPinNavigationAidKindForTest,
  shouldBlockNativeQuestPinDuringGroveQuestForTest,
  shouldPreserveExactChapter1RoutePinForTest,
  shouldPreserveExactGroveRoutePinForTest,
  shouldClearOwnedQuestMapPinForTest,
} from "@/client/components/biomes_ui/adapters/mapPinnedDestination";
import { biomesUIActiveMiniMapPinDistanceLabelForTest } from "@/client/components/map/markers/biomes_ui_active_minimap_pin";
import {
  isQuestNavigationAidKind,
  navigationAidDistanceLabelForTest,
  navigationAidShowsOnCircle,
  navigationAidShowsPrecisionOverlay,
  type NavigationAid,
} from "@/client/game/helpers/navigation_aids";
import { ch1NativeQuestId } from "@/shared/harthmere/ch1_native_quests";
import { ch1ObjectiveUsesDynamicRouteDestination } from "@/shared/harthmere/ch1_interaction_surfaces";
import { groveNativeQuestId } from "@/shared/harthmere/grove/grove_quest_ids";

// HARTHMERE active-pin directional indicator
// Locks the P0 fix: a user-set destination pin must show its directional
// indicator WITHOUT requiring the player to be tracking a quest.
function navAid(kind: any): NavigationAid {
  return {
    id: 14_200_147,
    pos: [100, 50, 100],
    target: { kind: "position", position: [100, 50, 100] },
    kind,
    autoremoveWhenNear: false,
  };
}

describe("active map pin navigation aid", () => {
  const mossyMarker = {
    id: "native_quest:817959262145055:4794743509650569",
    label: "Defeat 0/6 Mossy Mucklings with your Whacker",
    kind: "objective",
    worldPosition: [531, 68, -33] as [number, number, number],
  };
  const mossyQuest = {
    questId: "817959262145055",
    status: "active",
    firstMarkerId: mossyMarker.id,
  };

  it("uses authenticated moving targets for every multi-person Chapter 1 route", () => {
    for (const stepId of [
      "collect_testimonies",
      "the_three_answers",
      "meet_the_suppliers",
    ]) {
      assert.equal(ch1ObjectiveUsesDynamicRouteDestination(stepId), true);
    }
    assert.equal(ch1ObjectiveUsesDynamicRouteDestination("take_jobs"), false);
  });

  it("does not replace an exact current Chapter 1 route stop with the generic step anchor", () => {
    const questId = String(ch1NativeQuestId("ch1_a2_q02_work_the_board"));
    const stepId = "8762100000000602";
    assert.equal(
      automaticQuestDestinationMarkerForTest({
        existingPin: {
          markerId: `chapter1_route:${questId}:${stepId}:rin`,
          label: "Rin the Forager",
          ownerQuestId: questId,
          ownerStepId: stepId,
          worldPosition: [515, 62, -171],
        },
        quest: {
          questId,
          status: "active",
          currentStepId: stepId,
          firstMarkerId: `native_quest:${questId}:${stepId}`,
        },
        markers: [
          {
            id: `native_quest:${questId}:${stepId}`,
            label: "Meet the Suppliers",
            kind: "objective",
            worldPosition: [510, 73, -155],
          },
        ],
      }),
      undefined
    );
  });

  it("guards the stored exact Chapter 1 route pin from a late generic-anchor write", () => {
    const questId = String(ch1NativeQuestId("ch1_a2_q02_work_the_board"));
    const stepId = "8762100000000602";
    assert.equal(
      shouldPreserveExactChapter1RoutePinForTest({
        current: {
          markerId: `chapter1_route:${questId}:${stepId}:rin`,
          ownerQuestId: questId,
          ownerStepId: stepId,
        },
        next: {
          markerId: `native_quest:${questId}:${stepId}`,
          ownerQuestId: questId,
          ownerStepId: stepId,
        },
      }),
      true
    );
  });

  it("preserves an exact Grove landmark pin over the same quest's generic native fallback", () => {
    const authoredQuestId = "painted_path_language";
    const nativeQuestId = String(groveNativeQuestId(authoredQuestId));
    const current = {
      markerId: "grove_painted_route_flags",
      label: "Painted Route Flags",
      ownerQuestId: authoredQuestId,
      ownerStepId: "painted_path_language_obj_03",
      worldPosition: [516, 71, -131] as [number, number, number],
    };
    assert.equal(
      shouldBlockNativeQuestPinDuringGroveQuestForTest({
        nextMarkerId: "native_quest:6193612340426932:6193612340426932",
        activeGroveQuestId: authoredQuestId,
      }),
      true
    );
    assert.equal(
      shouldPreserveExactGroveRoutePinForTest({
        current,
        nextQuestId: "6193612340426932",
      }),
      true
    );
    assert.equal(
      automaticQuestDestinationMarkerForTest({
        existingPin: current,
        quest: {
          questId: "6193612340426932",
          status: "active",
          currentStepId: "6193612340426932",
          firstMarkerId: "native_quest:6193612340426932:6193612340426932",
        },
        markers: [
          {
            id: "native_quest:6193612340426932:6193612340426932",
            label: "Talk to Jackie",
            kind: "npc",
            worldPosition: [496, 71, -126],
          },
        ],
      }),
      undefined
    );
    assert.equal(
      shouldClearOwnedQuestMapPinForTest({
        pin: current,
        quests: [
          {
            questId: nativeQuestId,
            status: "active",
            currentStepId: nativeQuestId,
          },
        ],
      }),
      false
    );
  });

  it("automatically pins a newly active native story destination", () => {
    assert.deepEqual(
      automaticQuestDestinationMarkerForTest({
        quest: mossyQuest,
        markers: [mossyMarker],
      }),
      {
        ...mossyMarker,
        ownerQuestId: mossyQuest.questId,
        ownerStepId: undefined,
      }
    );
  });

  it("refreshes a reused quest anchor when the active objective changes", () => {
    const questId = String(
      ch1NativeQuestId("ch1_a3_d1_the_sand_that_remembers")
    );
    const marker = {
      id: `native_quest:${questId}:${questId}`,
      label: "The Salt-Cured Muckers block the bazaar route forward.",
      kind: "objective",
      worldPosition: [2692.5, 81, -307.5] as [number, number, number],
    };
    assert.deepEqual(
      automaticQuestDestinationMarkerForTest({
        existingPin: {
          markerId: marker.id,
          label: "Cross the Dunes",
          ownerQuestId: questId,
          ownerStepId: "8762100000001201",
        },
        quest: {
          questId,
          status: "active",
          currentStepId: "8762100000001202",
          firstMarkerId: marker.id,
        },
        markers: [marker],
      }),
      {
        ...marker,
        ownerQuestId: questId,
        ownerStepId: "8762100000001202",
      }
    );
  });

  it("refreshes a reused quest anchor when its async destination resolves", () => {
    const questId = String(
      ch1NativeQuestId("ch1_a3_d1_the_sand_that_remembers")
    );
    const marker = {
      id: `native_quest:${questId}:${questId}`,
      label: "The Long Walk",
      kind: "objective",
      worldPosition: [2672, 83, -320] as [number, number, number],
    };
    assert.deepEqual(
      automaticQuestDestinationMarkerForTest({
        existingPin: {
          markerId: marker.id,
          label: marker.label,
          worldPosition: [474, -130.5, -136.3],
          ownerQuestId: questId,
          ownerStepId: "8762100000001208",
        },
        quest: {
          questId,
          status: "active",
          currentStepId: "8762100000001208",
          firstMarkerId: marker.id,
        },
        markers: [marker],
      }),
      {
        ...marker,
        ownerQuestId: questId,
        ownerStepId: "8762100000001208",
      }
    );
  });

  it("advances an old quest-step pin but preserves a valid manual destination", () => {
    assert.deepEqual(
      automaticQuestDestinationMarkerForTest({
        existingPin: {
          markerId: "native_quest:817959262145055:previous-step",
        },
        quest: mossyQuest,
        markers: [mossyMarker],
      }),
      {
        ...mossyMarker,
        ownerQuestId: mossyQuest.questId,
        ownerStepId: undefined,
      }
    );
    assert.equal(
      automaticQuestDestinationMarkerForTest({
        existingPin: { markerId: "player-chosen-market" },
        quest: mossyQuest,
        markers: [
          mossyMarker,
          {
            id: "player-chosen-market",
            label: "Market",
            kind: "store",
            worldPosition: [600, 54, -220],
          },
        ],
      }),
      undefined
    );
  });

  it("advances a retained robot-story destination into Chapter 1", () => {
    const chapter1Marker = {
      id: "native_quest:8762000000000000:8762100000000001",
      label: "Wake up and go downstairs for breakfast",
      kind: "objective",
      worldPosition: [488, 72, -144] as [number, number, number],
    };
    assert.deepEqual(
      automaticQuestDestinationMarkerForTest({
        existingPin: {
          markerId: "native_quest:6193612340426932:3960245896803219",
        },
        quest: {
          questId: "8762000000000000",
          status: "active",
          firstMarkerId: chapter1Marker.id,
        },
        markers: [chapter1Marker],
      }),
      {
        ...chapter1Marker,
        ownerQuestId: "8762000000000000",
        ownerStepId: undefined,
      }
    );
  });

  it("replaces an unrelated destination at a Chapter 1 objective handoff", () => {
    const chapter1QuestId = String(ch1NativeQuestId("ch1_a1_q03_stand_him_up"));
    const chapter1Marker = {
      id: `native_quest:${chapter1QuestId}:seat_the_core`,
      label: "Return to AUGUR-9 and install the Core Cell",
      kind: "objective",
      worldPosition: [524, 69, -154] as [number, number, number],
    };
    assert.deepEqual(
      automaticQuestDestinationMarkerForTest({
        existingPin: { markerId: "player-chosen-market" },
        quest: {
          questId: chapter1QuestId,
          status: "active",
          currentStepId: "seat_the_core",
          firstMarkerId: chapter1Marker.id,
        },
        markers: [chapter1Marker],
      }),
      {
        ...chapter1Marker,
        ownerQuestId: chapter1QuestId,
        ownerStepId: "seat_the_core",
      }
    );
  });

  it("replaces a material-source pin when its owning quest objective advances", () => {
    assert.deepEqual(
      automaticQuestDestinationMarkerForTest({
        existingPin: {
          markerId: "harthmere_business_outpost_tools_cinderlane",
          ownerQuestId: "8762000000000002",
          ownerStepId: "8762100000000201",
        },
        quest: {
          questId: "8762000000000003",
          status: "active",
          currentStepId: "8762100000000301",
          firstMarkerId: mossyMarker.id,
        },
        markers: [mossyMarker],
      }),
      {
        ...mossyMarker,
        ownerQuestId: "8762000000000003",
        ownerStepId: "8762100000000301",
      }
    );
    assert.equal(
      shouldClearOwnedQuestMapPinForTest({
        pin: {
          ownerQuestId: "8762000000000002",
          ownerStepId: "8762100000000201",
        },
        quests: [
          {
            questId: "8762000000000003",
            status: "active",
            currentStepId: "8762100000000301",
          },
        ],
      }),
      true
    );
  });

  it("preserves a selected material route while its exact objective is active", () => {
    assert.equal(
      shouldClearOwnedQuestMapPinForTest({
        pin: {
          ownerQuestId: mossyQuest.questId,
          ownerStepId: "current-step",
        },
        quests: [{ ...mossyQuest, currentStepId: "current-step" }],
      }),
      false
    );
  });

  it("maps any active map pin to the non-quest 'map_pin' kind", () => {
    assert.strictEqual(
      biomesUIActiveMapPinNavigationAidKindForTest("resource"),
      "map_pin"
    );
    assert.strictEqual(
      biomesUIActiveMapPinNavigationAidKindForTest("objective"),
      "map_pin"
    );
    assert.strictEqual(isQuestNavigationAidKind("map_pin" as any), false);
  });

  it("shows the on-circle arrow and on-screen overlay when NOT tracking a quest", () => {
    const aid = navAid("map_pin");
    assert.strictEqual(navigationAidShowsOnCircle(aid, false, 100), true);
    assert.strictEqual(
      navigationAidShowsPrecisionOverlay(aid, false, 100),
      true
    );
  });

  it("(regression) a quest-kind aid is suppressed when not tracking — the old broken behavior", () => {
    const questAid = navAid("puzzle");
    assert.strictEqual(navigationAidShowsOnCircle(questAid, false, 100), false);
    assert.strictEqual(
      navigationAidShowsPrecisionOverlay(questAid, false, 100),
      false
    );
  });

  it("still respects the close-range minimum distance for position targets", () => {
    const aid = navAid("map_pin");
    assert.strictEqual(navigationAidShowsOnCircle(aid, false, 5), false);
  });

  it("formats active minimap destination distance from the player's XZ position", () => {
    assert.equal(
      biomesUIActiveMiniMapPinDistanceLabelForTest(
        [103, 70, 104],
        [100, 70, 100]
      ),
      "5m"
    );
    assert.equal(
      biomesUIActiveMiniMapPinDistanceLabelForTest(
        [Number.NaN, 70, 104],
        [100, 70, 100]
      ),
      undefined
    );
  });

  it("formats on-screen navigation aid distance labels in meters", () => {
    assert.equal(navigationAidDistanceLabelForTest(4.3), "4m");
    assert.equal(navigationAidDistanceLabelForTest(153.7), "154m");
    assert.equal(navigationAidDistanceLabelForTest(Number.NaN), "");
  });
});
