import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MapQuestsTab,
  preventCancelableMapWheelDefaultForTest,
  questMapMarkerCandidatesForTest,
} from "../tabs/MapQuestsTab";
import { biomesUIMainQuestSelectionFromQuestForTest } from "../adapters/mainQuestSelection";
import type { MapTrackableQuest } from "../tabs/MapQuestsTab";

describe("MapQuestsTab main quest controls", () => {
  it("renders set-main and center controls for trackable quests", () => {
    const quest: MapTrackableQuest = {
      questId: "muck_breach_boss",
      title: "Muck Breach Boss",
      area: "West Muck Breach",
      status: "active",
      firstMarkerId: "helix_marker",
      objective:
        "Defeat the Muck-Scarred Helix at the West Muck Breach.",
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
