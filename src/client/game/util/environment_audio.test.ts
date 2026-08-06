import {
  CAVE_OVERBURDEN_MIN_SOLID_BLOCKS,
  HARTHMERE_CAVE_MUSIC_FALLBACK_BELOW_Y,
  WORLD_CAVE_MUSIC_FALLBACK_BELOW_Y,
  caveMusicFallbackBelowY,
  hasThickCaveOverburden,
  isCaveAudioEnvironment,
  isMountainTopAudioEnvironment,
  knownHarthmereCaveAt,
} from "@/client/game/util/environment_audio";
import { getTerrainID } from "@/shared/asset_defs/terrain";
import { blockPos, voxelShard } from "@/shared/game/shard";
import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_EXTENSION_WORLD_BOUNDS,
} from "@/shared/harthmere/world_extension";
import assert from "assert";

function tensor(values: Map<string, number>) {
  return {
    get(x: number, y: number, z: number) {
      return values.get(`${x}|${y}|${z}`) ?? 0;
    },
  };
}

function deps(input: {
  terrain?: Map<string, number>;
  sky?: Map<string, number>;
}) {
  const terrain = tensor(input.terrain ?? new Map());
  const sky = tensor(input.sky ?? new Map());
  return {
    get(path: string, shard: string) {
      void shard;
      if (path === "/terrain/tensor") return terrain;
      if (path === "/lighting/sky_occlusion") return sky;
      throw new Error(`Unexpected path ${path}`);
    },
  };
}

function setWorld(
  values: Map<string, number>,
  position: readonly [number, number, number],
  value: number
) {
  const shard = voxelShard(...position);
  void shard;
  values.set(blockPos(...position).join("|"), value);
}

describe("environment audio terrain classification", () => {
  it("recognizes every position inside an authored cave bound", () => {
    assert.equal(
      knownHarthmereCaveAt([689.481, 47, -89.532])?.caveId,
      "mossglass_survey_cave"
    );
    assert.equal(knownHarthmereCaveAt([689.481, 60, -89.532]), undefined);
  });

  it("recognizes authored caves after the additive-world X transform", () => {
    assert.equal(
      knownHarthmereCaveAt([HARTHMERE_ADDITIVE_TOWN_OFFSET_X + 400, 48, -240])
        ?.caveId,
      "old_well_descent_room"
    );
    assert.equal(
      knownHarthmereCaveAt([HARTHMERE_ADDITIVE_TOWN_OFFSET_X + 210, -32, -369])
        ?.caveId,
      "deep_spindle_massive_cave"
    );
  });

  it("uses separate Harthmere and broader-world Y cutoffs", () => {
    const harthmerePosition: [number, number, number] = [
      HARTHMERE_EXTENSION_WORLD_BOUNDS.minX + 500,
      HARTHMERE_CAVE_MUSIC_FALLBACK_BELOW_Y - 1,
      0,
    ];
    const worldPosition: [number, number, number] = [
      0,
      WORLD_CAVE_MUSIC_FALLBACK_BELOW_Y - 1,
      0,
    ];
    assert.equal(
      caveMusicFallbackBelowY(harthmerePosition),
      HARTHMERE_CAVE_MUSIC_FALLBACK_BELOW_Y
    );
    assert.equal(
      caveMusicFallbackBelowY(worldPosition),
      WORLD_CAVE_MUSIC_FALLBACK_BELOW_Y
    );
    assert.equal(isCaveAudioEnvironment(deps({}), harthmerePosition), true);
    assert.equal(
      isCaveAudioEnvironment(deps({}), [
        harthmerePosition[0],
        HARTHMERE_CAVE_MUSIC_FALLBACK_BELOW_Y,
        harthmerePosition[2],
      ]),
      false
    );
    assert.equal(isCaveAudioEnvironment(deps({}), worldPosition), true);
    assert.equal(
      isCaveAudioEnvironment(deps({}), [
        worldPosition[0],
        WORLD_CAVE_MUSIC_FALLBACK_BELOW_Y,
        worldPosition[2],
      ]),
      false
    );
  });

  it("requires thick terrain instead of treating a one-block roof as a cave", () => {
    const roof = new Set<number>([5]);
    const cave = new Set<number>();
    for (let i = 5; i < 5 + CAVE_OVERBURDEN_MIN_SOLID_BLOCKS; i += 1) {
      cave.add(i);
    }
    const sample = (solid: Set<number>) =>
      hasThickCaveOverburden((_x, y) => solid.has(y - 51), [0, 50, 0]);
    assert.equal(sample(roof), false);
    assert.equal(sample(cave), true);
  });

  it("uses sky occlusion plus thick overburden for unregistered caves", () => {
    const terrain = new Map<string, number>();
    const sky = new Map<string, number>();
    setWorld(sky, [10, 51, 20], 12);
    for (let y = 54; y <= 57; y += 1) {
      setWorld(terrain, [10, y, 20], 1);
    }
    assert.equal(
      isCaveAudioEnvironment(deps({ terrain, sky }), [10.2, 50, 20.2]),
      true
    );

    const thinRoof = new Map<string, number>();
    setWorld(thinRoof, [10, 54, 20], 1);
    assert.equal(
      isCaveAudioEnvironment(
        deps({ terrain: thinRoof, sky }),
        [10.2, 50, 20.2]
      ),
      false
    );
  });

  it("plays summit wind on open-sky snow but not under a cave ceiling", () => {
    const terrain = new Map<string, number>();
    const sky = new Map<string, number>();
    setWorld(terrain, [10, 104, 20], getTerrainID("snow"));
    setWorld(sky, [10, 106, 20], 0);
    const resources = deps({ terrain, sky });

    assert.equal(
      isMountainTopAudioEnvironment(resources, [10.2, 105, 20.2]),
      true
    );
    assert.equal(
      isMountainTopAudioEnvironment(resources, [10.2, 105, 20.2], true),
      false
    );
  });

  it("rejects sea-level snow and unsupported high-altitude air", () => {
    const lowTerrain = new Map<string, number>();
    const lowSky = new Map<string, number>();
    setWorld(lowTerrain, [0, 49, 0], getTerrainID("snow"));
    setWorld(lowSky, [0, 51, 0], 0);
    assert.equal(
      isMountainTopAudioEnvironment(
        deps({ terrain: lowTerrain, sky: lowSky }),
        [0, 50, 0]
      ),
      false
    );

    const highSky = new Map<string, number>();
    setWorld(highSky, [0, 121, 0], 0);
    assert.equal(
      isMountainTopAudioEnvironment(deps({ sky: highSky }), [0, 120, 0]),
      false
    );
  });
});
