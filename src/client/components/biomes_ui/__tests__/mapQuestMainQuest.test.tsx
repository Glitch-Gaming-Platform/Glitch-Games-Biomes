import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MapQuestsTab,
  mapPanelTabForMarkerForTest,
  preventCancelableMapWheelDefaultForTest,
  questMapMarkerCandidatesForTest,
} from "../tabs/MapQuestsTab";
import { biomesUIMainQuestSelectionFromQuestForTest } from "../adapters/mainQuestSelection";
import type { MapTrackableQuest } from "../tabs/MapQuestsTab";

describe("MapQuestsTab main quest controls", () => {
  it("offers My Crops as an off-by-default personal map layer", () => {
    const html = renderToStaticMarkup(
      <MapQuestsTab
        adapter={{
          getMarkers: () => [
            {
              id: "farming:crop:1",
              label: "Carrot",
              x: 0.4,
              y: 0.6,
              kind: "crop",
              worldPosition: [401, 54, -155],
            },
          ],
        }}
      />
    );
    assert.ok(html.includes("My Crops"));
    assert.ok(
      html.includes('aria-checked="false" aria-label="Toggle My Crops layer"')
    );
    assert.deepEqual(mapPanelTabForMarkerForTest({ kind: "crop" }), ["crops"]);
  });

  it("renders set-main and center controls for trackable quests", () => {
    const quest: MapTrackableQuest = {
      questId: "muck_breach_boss",
      title: "Muck Breach Boss",
      area: "West Muck Breach",
      status: "active",
      firstMarkerId: "helix_marker",
      objective: "Defeat the Muck-Scarred Helix at the West Muck Breach.",
    };

    const html = renderToStaticMarkup(
      <MapQuestsTab
        adapter={{
          getMarkers: () => [
            {
              id: "helix_marker",
              label: "Muck-Scarred Helix",
              x: 0.6,
              y: 0.4,
              kind: "objective",
              active: true,
              worldPosition: [520, 70, -150],
            },
          ],
          getTrackableQuests: () => [quest],
          getMainQuestSelection: () =>
            biomesUIMainQuestSelectionFromQuestForTest(quest, 5000),
        }}
      />
    );

    assert.ok(html.includes("biomes-map-quest-set-main-muck_breach_boss"));
    assert.ok(html.includes("biomes-map-quest-center-muck_breach_boss"));
    assert.ok(html.includes("Main Quest"));
    assert.ok(html.includes("West Muck Breach"));
  });

  it("shows time limits for timed quests without adding one to untimed quests", () => {
    const timedQuest: MapTrackableQuest = {
      questId: "patch_fence",
      title: "Patch the Safe-Zone Fence",
      area: "The Grove",
      status: "active",
      firstMarkerId: "fence_marker",
      objective: "Repair the marked fence before the job timer expires.",
      reward: "99 gold",
      timeRemaining: "8h 18m left",
    };
    const untimedQuest: MapTrackableQuest = {
      questId: "road_ahead",
      title: "Road Ahead",
      area: "The Grove",
      status: "available",
      firstMarkerId: "road_marker",
      objective: "Speak with Jackie in The Grove.",
      reward: "Road Ready milestone",
    };

    const html = renderToStaticMarkup(
      <MapQuestsTab
        adapter={{
          getMarkers: () => [
            {
              id: "fence_marker",
              label: "Patch the Safe-Zone Fence",
              x: 0.6,
              y: 0.4,
              kind: "objective",
              active: true,
              worldPosition: [520, 70, -150],
            },
            {
              id: "road_marker",
              label: "Old Grove Road Post",
              x: 0.4,
              y: 0.4,
              kind: "objective",
              worldPosition: [490, 70, -140],
            },
          ],
          getTrackableQuests: () => [timedQuest, untimedQuest],
        }}
      />
    );

    assert.ok(html.includes('data-testid="biomes-map-quest-time-patch_fence"'));
    assert.ok(html.includes("Time limit: 8h 18m left"));
    assert.equal(
      html.includes('data-testid="biomes-map-quest-time-road_ahead"'),
      false
    );
  });

  it("resolves a quest's current marker before tool-source marker fallbacks", () => {
    assert.deepEqual(
      questMapMarkerCandidatesForTest({
        questId: "repair_filter",
        title: "Repair Filter",
        area: "Ashline",
        status: "active",
        firstMarkerId: "broken_filter",
        toolSource: {
          action: "buy_tool",
          toolName: "Containment Tongs",
          vendorName: "Ashline Containment Works",
          vendorMarkerId: "ashline_containment_shop",
          hint: "Buy Containment Tongs at Ashline Containment Works.",
        },
      }),
      ["broken_filter", "ashline_containment_shop"]
    );
  });

  it("does not call preventDefault for passive/non-cancelable map wheel events", () => {
    let preventDefaultCalls = 0;
    assert.equal(
      preventCancelableMapWheelDefaultForTest({
        cancelable: false,
        preventDefault: () => {
          preventDefaultCalls += 1;
        },
      }),
      false
    );
    assert.equal(preventDefaultCalls, 0);

    assert.equal(
      preventCancelableMapWheelDefaultForTest({
        cancelable: true,
        preventDefault: () => {
          preventDefaultCalls += 1;
        },
      }),
      true
    );
    assert.equal(preventDefaultCalls, 1);
  });
});
