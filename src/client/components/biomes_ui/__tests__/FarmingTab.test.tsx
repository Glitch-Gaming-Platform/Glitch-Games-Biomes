import { FarmingTab } from "@/client/components/biomes_ui/tabs/FarmingTab";
import { buildNativeFarmingInterfaceModel } from "@/client/components/biomes_ui/adapters/nativeFarmingInterfaceAdapter";
import { FarmingPlantComponent, Position } from "@/shared/ecs/gen/components";
import { generateTestId } from "@/shared/test_helpers";
import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

describe("FarmingTab", () => {
  it("renders the physical voxel farming loop and live native crop state", () => {
    const userId = generateTestId();
    const otherUserId = generateTestId();
    const seedId = 4537020877769703 as any;
    const ownedPlantId = generateTestId();
    const otherPlantId = generateTestId();
    const model = buildNativeFarmingInterfaceModel({
      userId,
      inventory: {
        hotbar: [
          { item: { id: 7539420629350046, action: "till" }, count: 1n },
          { item: { id: seedId, isSeed: true, action: "plant" }, count: 1n },
          {
            item: {
              id: 7539420629350045,
              action: "waterPlant",
              waterAmount: 5,
            },
            count: 1n,
          },
        ],
      },
      playerPosition: [10, 64, 10],
      entities: [
        {
          id: ownedPlantId,
          position: Position.create({ v: [12, 64, 10] }),
          farming_plant_component: FarmingPlantComponent.create({
            planter: userId,
            seed: seedId,
            status: "growing",
            stage: 1,
            stage_progress: 0.4,
            water_level: 0.7,
            wilt: 0,
            fully_grown_at: Date.now() / 1000 + 600,
          }),
        },
        {
          id: otherPlantId,
          position: Position.create({ v: [11, 64, 10] }),
          farming_plant_component: FarmingPlantComponent.create({
            planter: otherUserId,
            seed: seedId,
            status: "fully_grown",
            stage: 3,
            stage_progress: 1,
            water_level: 1,
            wilt: 0,
          }),
        },
      ],
    });

    const html = renderToStaticMarkup(
      <FarmingTab adapter={{ getModel: () => model }} />
    );
    assert.match(html, /Work the land/);
    assert.match(html, /How to farm/);
    assert.match(html, /dirt or grass voxel/);
    assert.match(html, /Gaia advances stages/);
    assert.match(html, /Native path: JavaScript interaction/);
    assert.match(html, /Stage 2/);
    assert.equal(model.hasHoe, true);
    assert.equal(model.hasWateringCan, true);
    assert.equal(model.seedCount, 1);
    assert.deepEqual(
      model.plants.map((plant) => plant.id),
      [ownedPlantId]
    );
    assert.ok(html.includes(`data-native-plant-id="${String(ownedPlantId)}"`));
    assert.ok(!html.includes(`data-native-plant-id="${String(otherPlantId)}"`));
  });

  it("offers the one-time hoe guide only while the player needs it", () => {
    const missingTools = {
      ...EMPTY_FARMING_MODEL,
      hasHoe: false,
    };
    const availableHtml = renderToStaticMarkup(
      <FarmingTab
        adapter={{
          getModel: () => missingTools,
          getHoeQuestState: () => "available",
        }}
      />
    );
    assert.match(availableHtml, /farming-buy-hoe-quest/);
    assert.match(availableHtml, />Buy A Hoe</);

    const activeHtml = renderToStaticMarkup(
      <FarmingTab
        adapter={{
          getModel: () => missingTools,
          getHoeQuestState: () => "active",
        }}
      />
    );
    assert.match(activeHtml, /Buy A Hoe Quest Added/);

    const completedHtml = renderToStaticMarkup(
      <FarmingTab
        adapter={{
          getModel: () => ({ ...missingTools, hasHoe: true }),
          getHoeQuestState: () => "completed",
        }}
      />
    );
    assert.ok(!completedHtml.includes("farming-buy-hoe-quest"));
  });
});

const EMPTY_FARMING_MODEL = {
  supplies: [],
  plants: [],
  seedCount: 0,
  hasHoe: false,
  hasWateringCan: false,
};
