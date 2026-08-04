#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

process.env.IS_SERVER = process.env.IS_SERVER || "1";

const assert = require("assert");
const { Redis } = require("ioredis");
const {
  deserializeRedisEntityState,
} = require("../../src/server/shared/world/lua/serde");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const { safeGetTerrainName } = require("../../src/shared/asset_defs/terrain");
const { blockPos } = require("../../src/shared/game/shard");
const { loadSeed, loadWater } = require("../../src/shared/game/terrain");
const {
  HARTHMERE_BUILDINGS,
} = require("../../src/shared/harthmere/harthmere_town_buildings");
const {
  harthmereBuildingRoofBlockAt,
  harthmereBuildingRoofMaterial,
  harthmereBuildingRoofRise,
} = require("../../src/shared/harthmere/harthmere_building_style");
const {
  HARTHMERE_RETIRED_GENERIC_TOWNSPERSON_IDS,
} = require("../../src/shared/harthmere/harthmere_npc_population_policy");
const {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_ADDITIVE_TOWN_OFFSET_Z,
  HARTHMERE_EXTENSION_GROUND_Y,
  harthmereExtensionTerrainEntityIdForShard,
} = require("../../src/shared/harthmere/world_extension");

const REDIS_HOST =
  process.env.REDIS_HOST ||
  process.env.GLITCH_REDIS_HOST ||
  process.env.LOCAL_REDIS_HOST ||
  "127.0.0.1";
const REDIS_PORT = Number.parseInt(
  process.env.REDIS_PORT || process.env.GLITCH_REDIS_PORT || "6379",
  10
);
const SCAN_COUNT = Math.max(
  100,
  Number.parseInt(process.env.HARTHMERE_TOWN_REPAIR_SCAN_COUNT || "5000", 10)
);
const SKIP_WATER = process.env.HARTHMERE_TOWN_REPAIR_SKIP_WATER === "1";

const OLD_FLAT_ROOF_NAMES = new Set([
  "black_wool",
  "blue_wool",
  "green_wool",
  "red_wool",
  "white_wool",
  "yellow_wool",
]);

function decodeEntity(id, raw) {
  if (!raw) return undefined;
  try {
    return deserializeRedisEntityState(id, raw)[1];
  } catch {
    return undefined;
  }
}

function inBuildingFootprint(x, z) {
  return HARTHMERE_BUILDINGS.some(
    (building) =>
      x >= building.x0 &&
      x <= building.x1 &&
      z >= building.z0 &&
      z <= building.z1
  );
}

function storyHeight(building) {
  return building.profile === "slum" ? 4 : 5;
}

function floorCount(building) {
  return Math.max(1, building.floors ?? (building.upper ? 2 : 1));
}

function expectedTerrainName(material) {
  const names = {
    stoneShingles: "stone_shingles",
    thatch: "thatch",
  };
  return names[material] || material;
}

class AuthoredShardSampler {
  constructor(redis, voxeloo) {
    this.redis = redis;
    this.voxeloo = voxeloo;
    this.cache = new Map();
  }

  async shardFor(worldX, worldY, worldZ) {
    const shardX = Math.floor(worldX / 32);
    const shardY = Math.floor(worldY / 32);
    const shardZ = Math.floor(worldZ / 32);
    const key = `${shardX}:${shardY}:${shardZ}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const id = harthmereExtensionTerrainEntityIdForShard(
      shardX,
      shardY,
      shardZ
    );
    assert.notStrictEqual(id, undefined, `No stable terrain id for ${key}`);
    const entity = decodeEntity(id, await this.redis.getBuffer(`b:${id}`));
    assert(entity, `Missing Harthmere terrain entity ${id} for ${key}`);
    const seed = loadSeed(this.voxeloo, { shard_seed: entity.shardSeed() });
    assert(seed, `Unreadable Harthmere shard_seed for ${id}`);
    const water = entity.hasShardWater?.()
      ? loadWater(this.voxeloo, { shard_water: entity.shardWater() })
      : undefined;
    const row = { id, seed, water };
    this.cache.set(key, row);
    return row;
  }

  async terrainNameAt(worldX, worldY, worldZ) {
    const shard = await this.shardFor(worldX, worldY, worldZ);
    const id = Number(shard.seed.get(...blockPos(worldX, worldY, worldZ)));
    return safeGetTerrainName(id) || (id === 0 ? "air" : `unknown:${id}`);
  }

  async waterLevelAt(worldX, worldY, worldZ) {
    const shard = await this.shardFor(worldX, worldY, worldZ);
    return shard.water
      ? Number(shard.water.get(...blockPos(worldX, worldY, worldZ)))
      : 0;
  }

  delete() {
    for (const { seed, water } of this.cache.values()) {
      seed.delete?.();
      water?.delete?.();
    }
    this.cache.clear();
  }
}

async function auditTownSurface(sampler) {
  const counts = new Map();
  let total = 0;
  for (let authoredX = 500; authoredX <= 570; authoredX += 1) {
    for (let authoredZ = -242; authoredZ <= -180; authoredZ += 1) {
      if (inBuildingFootprint(authoredX, authoredZ)) continue;
      const name = await sampler.terrainNameAt(
        authoredX + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
        HARTHMERE_EXTENSION_GROUND_Y,
        authoredZ + HARTHMERE_ADDITIVE_TOWN_OFFSET_Z
      );
      counts.set(name, (counts.get(name) || 0) + 1);
      total += 1;
    }
  }

  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const grassRatio = (counts.get("grass") || 0) / total;
  const stoneBrickRatio = (counts.get("stone_brick") || 0) / total;
  const maxMaterialRatio = (rows[0]?.[1] || 0) / total;
  assert(total > 1000, `Town surface audit sampled only ${total} columns`);
  assert(
    counts.size >= 5,
    `Player Services/Copper Kettle still lacks material variety: ${JSON.stringify(rows)}`
  );
  assert(
    grassRatio >= 0.3,
    `Player Services/Copper Kettle still reads as a filled slab: grassRatio=${grassRatio}`
  );
  assert(
    stoneBrickRatio <= 0.35,
    `Player Services/Copper Kettle is still dominated by stone brick: ${stoneBrickRatio}`
  );
  assert(
    maxMaterialRatio <= 0.6,
    `One material still dominates the town repair: ${JSON.stringify(rows[0])}`
  );
  return { total, grassRatio, stoneBrickRatio, maxMaterialRatio, counts: rows };
}

async function auditBuildingRoofs(sampler) {
  const names = [
    "brass_scale_bank",
    "black_anvil_smithy",
    "copper_kettle_inn",
    "mail_post_house",
  ];
  const results = [];
  for (const name of names) {
    const building = HARTHMERE_BUILDINGS.find(
      (candidate) => candidate.name === name
    );
    assert(building, `Missing audited building ${name}`);
    const shellTopRelY = floorCount(building) * storyHeight(building);
    const roofRise = harthmereBuildingRoofRise(building);
    const expectedName = expectedTerrainName(
      harthmereBuildingRoofMaterial(building)
    );
    let verified = 0;
    let oldFlatRoofBlocks = 0;
    for (let x = building.x0 - 1; x <= building.x1 + 1; x += 1) {
      for (let z = building.z0 - 1; z <= building.z1 + 1; z += 1) {
        for (
          let relY = shellTopRelY + 1;
          relY <= shellTopRelY + roofRise;
          relY += 1
        ) {
          const actualName = await sampler.terrainNameAt(
            x + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
            HARTHMERE_EXTENSION_GROUND_Y + relY,
            z + HARTHMERE_ADDITIVE_TOWN_OFFSET_Z
          );
          if (OLD_FLAT_ROOF_NAMES.has(actualName)) oldFlatRoofBlocks += 1;
          const expected = harthmereBuildingRoofBlockAt(
            building,
            x,
            relY,
            z,
            shellTopRelY
          );
          if (
            !expected ||
            (building.chimney &&
              x === building.chimney[0] &&
              z === building.chimney[1])
          ) {
            continue;
          }
          assert.strictEqual(
            actualName,
            expectedName,
            `${name} roof mismatch at ${x},${relY},${z}`
          );
          verified += 1;
        }
      }
    }
    assert(
      verified > 50,
      `${name} exposed only ${verified} verified roof blocks`
    );
    assert.strictEqual(
      oldFlatRoofBlocks,
      0,
      `${name} still contains ${oldFlatRoofBlocks} colored-wool roof blocks`
    );
    results.push({ name, expectedName, verified, oldFlatRoofBlocks });
  }
  return results;
}

async function auditNpcRetirements(redis) {
  const genericKeys = HARTHMERE_RETIRED_GENERIC_TOWNSPERSON_IDS.map(
    (id) => `b:${Number(id)}`
  );
  const genericValues = await redis.mgetBuffer(genericKeys);
  const remainingGenericIds = genericValues
    .map((value, index) => (value ? genericKeys[index].slice(2) : undefined))
    .filter(Boolean);

  const genericLabelKeys = [];
  let cursor = "0";
  let scanned = 0;
  do {
    const [next, keys] = await redis.scan(
      cursor,
      "MATCH",
      "b:*",
      "COUNT",
      SCAN_COUNT
    );
    cursor = next;
    scanned += keys.length;
    if (!keys.length) continue;
    const values = await redis.mgetBuffer(keys);
    for (let index = 0; index < keys.length; index += 1) {
      const raw = values[index];
      if (
        raw &&
        (raw.includes(Buffer.from("Local Dev Townsperson")) ||
          raw.includes(Buffer.from("Local Dev Walking Townsperson")))
      ) {
        genericLabelKeys.push(keys[index]);
      }
    }
  } while (cursor !== "0");

  assert.deepStrictEqual(
    remainingGenericIds,
    [],
    `Audited generic townspeople remain: ${remainingGenericIds.join(",")}`
  );
  assert.deepStrictEqual(
    genericLabelKeys,
    [],
    `Generic local-dev townsperson labels remain in Redis: ${genericLabelKeys.join(",")}`
  );
  return {
    scanned,
    auditedGenericIds: genericKeys.length,
    persistentBusinessCustomersAreAllowed: true,
  };
}

async function main() {
  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    lazyConnect: true,
  });
  await redis.connect();
  const voxeloo = await loadVoxeloo();
  const sampler = new AuthoredShardSampler(redis, voxeloo);
  try {
    const townSurface = await auditTownSurface(sampler);
    const buildingRoofs = await auditBuildingRoofs(sampler);
    const riverWaterLevel = SKIP_WATER
      ? "skipped"
      : await sampler.waterLevelAt(2214, 51, -174);
    if (!SKIP_WATER) {
      assert.strictEqual(
        riverWaterLevel,
        15,
        `Brell canonical source voxel is level ${riverWaterLevel}, expected 15`
      );
    }
    const npcRetirements = await auditNpcRetirements(redis);
    console.log(
      JSON.stringify(
        { townSurface, buildingRoofs, riverWaterLevel, npcRetirements },
        null,
        2
      )
    );
    console.log(
      `HARTHMERE_TOWN_REPAIR_READY redis=${REDIS_HOST}:${REDIS_PORT} water=${riverWaterLevel}`
    );
  } finally {
    sampler.delete();
    redis.disconnect();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
