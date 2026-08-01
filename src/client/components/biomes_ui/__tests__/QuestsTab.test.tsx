import assert from "assert";
import fs from "fs";
import path from "path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HarthmereMaterialAcquisitionGuide } from "@/client/components/harthmere_materials/HarthmereMaterialAcquisitionGuide";
import type { MapTrackableQuest } from "../tabs/MapQuestsTab";
import { questObjectiveRowsForTest } from "../tabs/MapQuestsTab";
import {
  QuestsTab,
  questsTabMarkerForQuestForTest,
  questsTabObjectiveHeadingForTest,
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

  it("describes completed work as complete instead of an outstanding order", () => {
    assert.equal(questsTabObjectiveHeadingForTest("active"), "What to do next");
    assert.equal(
      questsTabObjectiveHeadingForTest("completed"),
      "Completed steps"
    );
    assert.doesNotMatch(
      questsTabObjectiveHeadingForTest("completed"),
      /must|to do/i
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

  it("marks authored objectives before the current objective as completed", () => {
    assert.deepEqual(
      questObjectiveRowsForTest({
        ...activeQuest,
        objective: "Build a Workbench using its blueprint.",
        objectives: [
          "Talk to Sophia.",
          "Place your Robot in the Muck.",
          "Build a Workbench using its blueprint.",
          "Craft 64 Lumber at your Workbench.",
        ],
      }),
      [
        { objective: "Talk to Sophia.", done: true, current: false },
        {
          objective: "Place your Robot in the Muck.",
          done: true,
          current: false,
        },
        {
          objective: "Build a Workbench using its blueprint.",
          done: false,
          current: true,
        },
        {
          objective: "Craft 64 Lumber at your Workbench.",
          done: false,
          current: false,
        },
      ]
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

  it("renders Chapter 1 gather, buy, and craft route choices in the quest detail", () => {
    const source = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/biomes_ui/tabs/QuestsTab.tsx"
      ),
      "utf8"
    );
    assert.match(source, /selected\.materialRequirements/);
    assert.match(source, /HarthmereMaterialAcquisitionGuide/);
    assert.match(source, /ownerQuestId=\{selected\.questId\}/);
    assert.match(source, /ownerStepId=\{selected\.currentStepId\}/);
    assert.match(source, /may go straight to Materials\s+storage/);
    assert.match(source, /They still count for this\s+objective/);
    const html = renderToStaticMarkup(
      <HarthmereMaterialAcquisitionGuide
        itemId="scrap_metal"
        itemName="Scrap Metal"
        count={4}
        ownerQuestId="8762000000000002"
        ownerStepId="8762100000000201"
      />
    );
    assert.match(html, /How to get 4 Scrap Metal/);
    assert.match(html, /data-material-route-kind="buy"/);
    assert.match(html, /data-material-route-kind="gather"/);
    assert.match(html, /Show on map/);
    assert.match(html, /data-material-guide-owner-quest="8762000000000002"/);
  });
});
