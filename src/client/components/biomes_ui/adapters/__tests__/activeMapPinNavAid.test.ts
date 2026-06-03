/// <reference types="mocha" />
import assert from "assert";
import { biomesUIActiveMapPinNavigationAidKindForTest } from "@/client/components/biomes_ui/adapters/mapPinnedDestination";
import {
  isQuestNavigationAidKind,
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
});
