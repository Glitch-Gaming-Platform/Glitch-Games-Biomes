import {
  plantGrowthProgress,
  plantGrowthStageDurationsMs,
  plantWaterProgress,
} from "@/client/components/overlays/inspected/plantInspectionProgress";
import type { ReadonlyFarmingPlantComponent } from "@/shared/ecs/gen/components";
import type { FarmSpec } from "@/shared/game/farming";
import assert from "assert";

const basicSpec = {
  kind: "basic",
  block: 1,
  timeMs: 1_000,
  hasGrowthStages: true,
} as FarmSpec;

function plant(
  fields: Partial<ReadonlyFarmingPlantComponent>
): ReadonlyFarmingPlantComponent {
  return {
    stage: 1,
    stage_progress: 0,
    status: "growing",
    water_level: 1,
    variant: undefined,
    ...fields,
  } as ReadonlyFarmingPlantComponent;
}

describe("plant inspection progress", () => {
  it("maps Gaia's two basic growth stages into one continuous meter", () => {
    assert.deepEqual(plantGrowthStageDurationsMs(basicSpec), [0, 500, 500, 0]);
    assert.equal(
      plantGrowthProgress(plant({ stage: 1, stage_progress: 0.5 }), basicSpec),
      0.25
    );
    assert.equal(
      plantGrowthProgress(plant({ stage: 2, stage_progress: 0.5 }), basicSpec),
      0.75
    );
  });

  it("uses the selected variant's authored stage durations", () => {
    const variantSpec = {
      kind: "variant",
      variants: [
        { chance: 0.5, def: basicSpec },
        {
          chance: 0.5,
          def: {
            kind: "tree",
            leafBlock: 2,
            logBlock: 3,
            stages: [
              { kind: "sapling", timeMs: 100 },
              { kind: "log", timeMs: 300, logs: 1 },
            ],
          },
        },
      ],
    } as FarmSpec;
    assert.equal(
      plantGrowthProgress(
        plant({ variant: 1, stage: 1, stage_progress: 0.5 }),
        variantSpec
      ),
      0.625
    );
  });

  it("clamps fully grown and overfilled water values", () => {
    assert.equal(
      plantGrowthProgress(plant({ status: "fully_grown" }), basicSpec),
      1
    );
    assert.equal(plantWaterProgress(plant({ water_level: 1.4 })), 1);
    assert.equal(plantWaterProgress(plant({ water_level: -0.2 })), 0);
  });
});
