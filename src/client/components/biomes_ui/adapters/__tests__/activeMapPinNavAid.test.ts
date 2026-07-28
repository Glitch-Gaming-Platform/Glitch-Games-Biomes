/// <reference types="mocha" />
import assert from "assert";
import {
  automaticQuestDestinationMarkerForTest,
  biomesUIActiveMapPinNavigationAidKindForTest,
} from "@/client/components/biomes_ui/adapters/mapPinnedDestination";
import { biomesUIActiveMiniMapPinDistanceLabelForTest } from "@/client/components/map/markers/biomes_ui_active_minimap_pin";
import {
  isQuestNavigationAidKind,
  navigationAidDistanceLabelForTest,
  navigationAidShowsOnCircle,
  navigationAidShowsPrecisionOverlay,
  type NavigationAid,
} from "@/client/game/helpers/navigation_aids";

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

  it("automatically pins a newly active native story destination", () => {
    assert.deepEqual(
      automaticQuestDestinationMarkerForTest({
        quest: mossyQuest,
        markers: [mossyMarker],
      }),
      mossyMarker
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
      mossyMarker
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
