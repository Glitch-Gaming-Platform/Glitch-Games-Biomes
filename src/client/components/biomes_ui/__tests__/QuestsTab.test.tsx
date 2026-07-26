import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MapTrackableQuest } from "../tabs/MapQuestsTab";
import {
  QuestsTab,
  questsTabMarkerForQuestForTest,
  questsTabStatusCountsForTest,
  questsTabVisibleQuestsForTest,
} from "../tabs/QuestsTab";

const activeQuest: MapTrackableQuest = {
  questId: "active",
  title: "Active Work",
  area: "The Grove",
  status: "active",
  firstMarkerId: "active-marker",
  objective: "Finish the active objective.",
};

const availableQuest: MapTrackableQuest = {
  questId: "available",
  title: "Available Work",
  area: "Mosslawn",
  status: "available",
  firstMarkerId: "available-marker",
};

const failedQuest: MapTrackableQuest = {
  questId: "failed",
  title: "Failed Work",
  area: "Shutter Cove",
  status: "failed",
};

describe("QuestsTab", () => {
  it("counts failed quests instead of hiding them inside All", () => {
    assert.deepEqual(
      questsTabStatusCountsForTest([activeQuest, availableQuest, failedQuest]),
      { all: 3, active: 1, available: 1, failed: 1, completed: 0 }
    );
  });

  it("keeps the selected main quest first, then uses stable status ordering", () => {
    assert.deepEqual(
      questsTabVisibleQuestsForTest({
        quests: [failedQuest, availableQuest, activeQuest],
        filter: "all",
        mainQuestId: availableQuest.questId,
      }).map((quest) => quest.questId),
      ["available", "active", "failed"]
    );
  });

  it("uses item/tool marker fallbacks when the current quest marker is absent", () => {
    const quest: MapTrackableQuest = {
      ...activeQuest,
      firstMarkerId: "missing-current-marker",
      toolSource: {
        action: "buy_tool",
        toolName: "Containment Tongs",
        vendorName: "Ashline Containment Works",
        vendorMarkerId: "tool-shop",
        hint: "Buy the tongs.",
      },
    };
    assert.equal(
      questsTabMarkerForQuestForTest(quest, [
        {
          id: "tool-shop",
          label: "Ashline Containment Works",
          x: 0.5,
          y: 0.5,
          kind: "store",
          worldPosition: [500, 70, -150],
        },
      ])?.id,
      "tool-shop"
    );
  });

  it("renders a dedicated no-map quest surface with every status filter", () => {
    const html = renderToStaticMarkup(
      <QuestsTab
        adapter={{
          getTrackableQuests: () => [activeQuest, availableQuest, failedQuest],
          getMissionTitle: () => "Active Work",
          getMissionSteps: () => [
            {
              id: "step",
              title: "Current step",
              objective: "Finish the active objective.",
              done: false,
            },
          ],
        }}
        onOpenMap={() => undefined}
      />
    );
    assert.ok(html.includes('data-testid="biomes-ui-quests-tab"'));
    assert.ok(html.includes("Failed (1)"));
    assert.ok(html.includes("Active Work"));
    assert.ok(!html.includes("Live world map"));
  });
});
