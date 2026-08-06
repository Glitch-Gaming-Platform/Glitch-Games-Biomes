// Load Bikkie's runtime first so the historical farming/Bikkie CommonJS cycle
// is initialized in the same order as the server bootstrap.
import "@/shared/bikkie/active";
import {
  countGrowthStage,
  countTensorBuffer,
  diffGrowthStage,
  diffTensorBuffers,
  joinGrowthStage,
  joinTensorBuffers,
  mapGrowthStage,
  translateGrowthStage,
  withDirt,
  withTilledSoil,
} from "@/server/gaia/simulations/farming/growth_helpers";
import {
  VOLUME_TENSOR_ROOT,
  VOLUME_TENSOR_SHAPE,
  packFarmingFlags,
  plantGrowthStage,
  plantGrowthStageFromGroup,
  plantGrowthStageFromGroupBlob,
  plantGrowthStageLog,
  plantGrowthStageSimple,
  unpackFarmingFlags,
} from "@/server/gaia/simulations/farming/growth_specs";
import {
  applyFertilizerBuffs,
  clearPlayerActions,
  farmLocalToTensor,
  farmTensorToLocal,
  farmTensorToWorld,
  farmWorldToTensor,
  handleFertilizer,
  handlePlayerAction,
  handleWaterActions,
  wiltAndProgress,
} from "@/server/gaia/simulations/farming/plant_ticker";
import { countPermutations } from "@/server/gaia/simulations/farming/crossbreeding";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import { getTerrainID } from "@/shared/asset_defs/terrain";
import { using } from "@/shared/deletable";
import { FarmingPlantComponent } from "@/shared/ecs/gen/components";
import type { FarmingPlayerAction } from "@/shared/ecs/gen/types";
import type { BiomesId } from "@/shared/ids";
import { toBlockId } from "@/shared/game/ids";
import { Tensor } from "@/shared/wasm/tensors";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";

function tensorValue(
  voxeloo: VoxelooModule,
  buffer: Uint8Array | undefined,
  position: [number, number, number]
) {
  return using(Tensor.make(voxeloo, VOLUME_TENSOR_SHAPE, "U32"), (tensor) => {
    tensor.load(buffer);
    return tensor.get(...position);
  });
}

describe("Gaia farming growth-stage helpers", () => {
  let voxeloo: VoxelooModule;

  before(async () => {
    voxeloo = await loadVoxeloo();
  });

  it("round-trips all farming flags and quantizes progress percentages", () => {
    const flags = {
      required: true,
      dropBlock: false,
      writeGrowthProgress: true,
      removeWhenDestroyed: false,
      startProgress: 0.129,
      endProgress: 0.987,
    };

    assert.deepEqual(unpackFarmingFlags(packFarmingFlags(flags)), {
      ...flags,
      startProgress: 0.12,
      endProgress: 0.98,
    });
  });

  it("encodes blocks, shapes, default flags, logs, and leaves at tensor-root coordinates", () => {
    const dirt = getTerrainID("dirt");
    const grass = getTerrainID("grass");
    const stage = plantGrowthStage(voxeloo, [
      [[0, 0, 0], { block: dirt, shape: 7 }],
      [[1, 2, 3], { block: grass, flags: { required: true } }],
    ]);
    assert.equal(
      tensorValue(voxeloo, stage.blockBuffer, VOLUME_TENSOR_ROOT),
      dirt
    );
    assert.equal(
      tensorValue(voxeloo, stage.shapeBuffer, VOLUME_TENSOR_ROOT),
      7
    );
    assert.equal(tensorValue(voxeloo, stage.blockBuffer, [17, 3, 19]), grass);
    assert.equal(
      unpackFarmingFlags(
        tensorValue(voxeloo, stage.flagBuffer, [17, 3, 19]) ?? 0
      ).required,
      true
    );

    const log = plantGrowthStageLog(voxeloo, dirt, grass, 2, 5);
    assert.equal(countGrowthStage(voxeloo, log), 3);
    assert.equal(tensorValue(voxeloo, log.shapeBuffer, VOLUME_TENSOR_ROOT), 5);
    assert.equal(tensorValue(voxeloo, log.blockBuffer, [16, 3, 16]), grass);
  });

  it("maps, translates, joins, diffs, and counts growth tensors", () => {
    const dirt = getTerrainID("dirt");
    const grass = getTerrainID("grass");
    const first = plantGrowthStageSimple(voxeloo, dirt, 2, {
      startProgress: 0.25,
    });
    const second = plantGrowthStage(voxeloo, [
      [[1, 0, 0], { block: grass, shape: 3 }],
    ]);

    const mapped = mapGrowthStage(voxeloo, first, (pos, value) => [
      [pos[0], pos[1] + 2, pos[2]],
      { ...value, block: grass },
    ]);
    assert.equal(tensorValue(voxeloo, mapped.blockBuffer, [16, 3, 16]), grass);
    assert.equal(tensorValue(voxeloo, mapped.shapeBuffer, [16, 3, 16]), 2);

    const translated = translateGrowthStage(voxeloo, first, [1, 0, 0]);
    assert.equal(
      tensorValue(voxeloo, translated.blockBuffer, [17, 1, 16]),
      dirt
    );

    const joined = joinGrowthStage(voxeloo, first, second);
    assert.equal(countGrowthStage(voxeloo, joined), 2);
    assert.equal(countTensorBuffer(voxeloo, joined.blockBuffer), 2);

    const diff = diffGrowthStage(voxeloo, first, joined);
    assert.equal(countGrowthStage(voxeloo, diff), 1);
    assert.strictEqual(diffGrowthStage(voxeloo, undefined, first), first);
    assert.strictEqual(diffGrowthStage(voxeloo, first, undefined), first);
    assert.throws(
      () => diffGrowthStage(voxeloo, undefined, undefined),
      /Cannot diff undefined growth stages/
    );
  });

  it("handles every optional tensor join branch and detects additions, removals, and replacements", () => {
    const dirt = plantGrowthStageSimple(voxeloo, getTerrainID("dirt"));
    const grass = plantGrowthStageSimple(voxeloo, getTerrainID("grass"));
    assert.strictEqual(
      joinTensorBuffers(voxeloo, dirt.blockBuffer, undefined),
      dirt.blockBuffer
    );
    assert.strictEqual(
      joinTensorBuffers(voxeloo, undefined, grass.blockBuffer),
      grass.blockBuffer
    );
    assert.equal(joinTensorBuffers(voxeloo, undefined, undefined), undefined);
    assert.equal(
      countTensorBuffer(
        voxeloo,
        diffTensorBuffers(voxeloo, dirt.blockBuffer, grass.blockBuffer)
      ),
      1
    );
    assert.equal(
      countTensorBuffer(
        voxeloo,
        diffTensorBuffers(voxeloo, dirt.blockBuffer, undefined)
      ),
      1
    );
    assert.equal(
      countTensorBuffer(
        voxeloo,
        diffTensorBuffers(voxeloo, undefined, grass.blockBuffer)
      ),
      1
    );
  });

  it("adds supporting soil and shifts an existing plant one voxel upward", () => {
    const plant = plantGrowthStageSimple(voxeloo, getTerrainID("grass"));
    const tilled = withTilledSoil(voxeloo, plant);
    const dirt = withDirt(voxeloo, plant);

    assert.equal(countGrowthStage(voxeloo, tilled), 2);
    assert.equal(
      tensorValue(voxeloo, tilled.blockBuffer, VOLUME_TENSOR_ROOT),
      getTerrainID("soil")
    );
    assert.equal(
      tensorValue(voxeloo, tilled.blockBuffer, [16, 2, 16]),
      getTerrainID("grass")
    );
    assert.equal(
      tensorValue(voxeloo, dirt.blockBuffer, VOLUME_TENSOR_ROOT),
      getTerrainID("dirt")
    );
    assert.equal(countGrowthStage(voxeloo, withTilledSoil(voxeloo)), 1);
    assert.equal(countGrowthStage(voxeloo, withDirt(voxeloo)), 1);
    assert.throws(() => joinGrowthStage(voxeloo), /AssertionError/);
  });

  it("converts stored group tensors with automatic and explicit anchors", () => {
    const terrain = getTerrainID("dirt");
    const blob = using(new voxeloo.GroupTensorBuilder(), (builder) => {
      builder.setBlock([0, 0, 0], toBlockId(terrain), 1, 0, 0);
      builder.setBlock([1, 0, 0], toBlockId(terrain), 2, 0, 0);
      builder.setBlock([2, 0, 0], toBlockId(terrain), 3, 0, 0);
      return using(builder.build(), (tensor) => tensor.save());
    });

    const automatic = plantGrowthStageFromGroupBlob(voxeloo, blob);
    assert.equal(countGrowthStage(voxeloo, automatic), 3);
    assert.equal(
      tensorValue(voxeloo, automatic.blockBuffer, VOLUME_TENSOR_ROOT),
      terrain
    );
    assert.equal(
      tensorValue(voxeloo, automatic.shapeBuffer, VOLUME_TENSOR_ROOT),
      2
    );

    const explicit = plantGrowthStageFromGroupBlob(voxeloo, blob, [0, 0, 0], {
      required: true,
    });
    assert.equal(
      tensorValue(voxeloo, explicit.shapeBuffer, VOLUME_TENSOR_ROOT),
      1
    );
    assert.equal(
      unpackFarmingFlags(
        tensorValue(voxeloo, explicit.flagBuffer, VOLUME_TENSOR_ROOT) ?? 0
      ).required,
      true
    );

    const fromTable = plantGrowthStageFromGroup(
      voxeloo,
      { get: () => ({ group_component: { tensor: blob } }) } as any,
      1 as BiomesId,
      [0, 0, 0]
    );
    assert.equal(countGrowthStage(voxeloo, fromTable), 3);
    const missing = plantGrowthStageFromGroup(
      voxeloo,
      { get: () => undefined } as any,
      2 as BiomesId
    );
    assert.equal(countGrowthStage(voxeloo, missing), 0);
  });

  it("rejects group voxels outside the fixed farming growth tensor", () => {
    const blob = using(new voxeloo.GroupTensorBuilder(), (builder) => {
      builder.setBlock([40, 0, 0], toBlockId(getTerrainID("dirt")), 0, 0, 0);
      return using(builder.build(), (tensor) => tensor.save());
    });
    assert.throws(
      () => plantGrowthStageFromGroupBlob(voxeloo, blob, [0, 0, 0]),
      /too large/
    );
  });
});

describe("Gaia farming action and progress helpers", () => {
  function action(kind: FarmingPlayerAction["kind"], values = {}) {
    return { kind, timestamp: 1, ...values } as FarmingPlayerAction;
  }

  it("handles and clears only the requested player-action kind", () => {
    const plant = FarmingPlantComponent.create({
      player_actions: [
        action("water", { amount: 0.25 }),
        action("harvest"),
        action("water", { amount: 0.5 }),
      ],
    });
    const amounts = handlePlayerAction(plant, "water", (actions) =>
      actions.map((entry) => entry.amount)
    );
    assert.deepEqual(amounts, [0.25, 0.5]);
    assert.deepEqual(
      plant.player_actions.map((entry) => entry.kind),
      ["harvest"]
    );
    assert.equal(
      handlePlayerAction(plant, "poke", () => true),
      undefined
    );
    clearPlayerActions(plant);
    assert.deepEqual(plant.player_actions, []);
  });

  it("extracts matching fertilizer effects and leaves all other actions", () => {
    const waterFertilizer = {
      id: 1 as BiomesId,
      fertilizerEffect: { kind: "water", timeMs: 500 },
    } as any;
    const timeFertilizer = {
      id: 2 as BiomesId,
      fertilizerEffect: { kind: "time", timeMs: 1000 },
    } as any;
    const plant = FarmingPlantComponent.create({
      player_actions: [
        action("fertilize", { fertilizer: waterFertilizer }),
        action("fertilize", { fertilizer: timeFertilizer }),
        action("harvest"),
      ],
    });

    assert.equal(
      handleFertilizer(plant, "water", (effects) => effects[0].timeMs),
      500
    );
    assert.deepEqual(
      plant.player_actions.map((entry) => entry.kind),
      ["fertilize", "harvest"]
    );
    assert.equal(
      handleFertilizer(plant, "buff", () => 1),
      undefined
    );
  });

  it("applies fertilizer buffs and combines clamped watering with fertilizer water", () => {
    const buffId = 77 as BiomesId;
    const plant = FarmingPlantComponent.create({
      water_level: 0.5,
      player_actions: [
        action("water", { amount: 0.8 }),
        action("water", { amount: -1 }),
        action("fertilize", {
          fertilizer: {
            id: 1,
            fertilizerEffect: { kind: "water", timeMs: 500 },
          },
        }),
        action("fertilize", {
          fertilizer: {
            id: 2,
            fertilizerEffect: { kind: "buff", buffs: [[buffId, 1]] },
          },
        }),
      ],
    });

    handleWaterActions(plant, 1000, true);
    assert.equal(plant.water_level, 1.5);
    applyFertilizerBuffs(plant);
    assert.deepEqual(plant.buffs, [buffId]);
    assert.deepEqual(plant.player_actions, []);

    plant.water_level = 0;
    handleWaterActions(plant, 1000, false);
    assert.equal(plant.water_level, 1);
  });

  it("advances growth, records water deadlines, applies wilt, and returns excess progress", () => {
    const plant = FarmingPlantComponent.create({
      water_level: 1,
      stage_progress: 0.25,
      wilt: 0,
      buffs: [],
    });
    assert.equal(
      wiltAndProgress(plant, 10_000, 500, 1000, 1000, 2000, 1000),
      0
    );
    assert.equal(plant.water_level, 0.5);
    assert.equal(plant.stage_progress, 0.75);
    assert.equal(plant.wilt, 0);
    assert.equal(plant.water_at, 10.5);
    assert.equal(plant.next_stage_at, 10.25);
    assert.equal(plant.fully_grown_at, 11.25);

    plant.water_level = 0.1;
    plant.stage_progress = 0.95;
    const excess = wiltAndProgress(plant, 20_000, 500, 100, 100, 1000);
    assert.ok(excess > 0);
    assert.equal(plant.stage_progress, 1);
    assert.equal(plant.wilt, 0.49);

    plant.water_level = 0;
    plant.stage_progress = 0;
    wiltAndProgress(plant, 30_000, 500, undefined, 1000);
    assert.equal(plant.water_level, 0.9);
    assert.equal(plant.water_at, undefined);
  });

  it("applies the server-authored Farming growth multiplier inside Gaia", () => {
    const normal = FarmingPlantComponent.create({
      water_level: 1,
      stage_progress: 0,
      wilt: 0,
      buffs: [],
    });
    const skilled = FarmingPlantComponent.create({
      water_level: 1,
      stage_progress: 0,
      wilt: 0,
      buffs: [],
      skill_growth_time_multiplier: 0.8,
    });

    wiltAndProgress(normal, 10_000, 500, undefined, 1000);
    wiltAndProgress(
      skilled,
      10_000,
      500,
      undefined,
      1000,
      undefined,
      undefined,
      0.8
    );

    assert.equal(normal.stage_progress, 0.5);
    assert.equal(skilled.stage_progress, 0.625);
    assert.ok(skilled.fully_grown_at! < normal.fully_grown_at!);
  });

  it("converts consistently among world, local, and tensor coordinates", () => {
    assert.deepEqual(farmWorldToTensor([12, 15, 20], [10, 10, 10]), [2, 5, 10]);
    assert.deepEqual(farmTensorToWorld([2, 5, 10], [10, 10, 10]), [12, 15, 20]);
    assert.deepEqual(farmLocalToTensor([-1, 2, 3], [16, 1, 16]), [15, 3, 19]);
    assert.deepEqual(farmTensorToLocal([15, 3, 19], [16, 1, 16]), [-1, 2, 3]);
  });

  it("counts crossbreed permutations with duplicates and early exits", () => {
    const one = 1 as BiomesId;
    const two = 2 as BiomesId;
    const three = 3 as BiomesId;
    assert.equal(countPermutations([one, two], [one, two]), 1);
    assert.equal(countPermutations([one, two, two, two], [one, two]), 3);
    assert.equal(countPermutations([one, two], []), 1);
    assert.equal(countPermutations([], [one]), 0);
    assert.equal(countPermutations([three, one, two], [one, two]), 0);
  });
});
