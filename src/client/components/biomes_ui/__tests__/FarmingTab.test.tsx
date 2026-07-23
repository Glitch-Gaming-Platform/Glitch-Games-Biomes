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
    const seedId = 4537020877769703 as any;
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
          id: generateTestId(),
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
  });
});
