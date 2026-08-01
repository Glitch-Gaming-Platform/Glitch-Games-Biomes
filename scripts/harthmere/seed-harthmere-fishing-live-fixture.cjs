#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

process.env.IS_SERVER = process.env.IS_SERVER || "1";

const assert = require("assert");
const { Redis } = require("ioredis");
const {
  getTerrainID,
  safeGetTerrainId,
} = require("../../src/shared/asset_defs/terrain");
const { using } = require("../../src/shared/deletable");
const {
  Box,
  ShardDiff,
  ShardMuck,
  ShardSeed,
  ShardShapes,
  ShardWater,
} = require("../../src/shared/ecs/gen/components");
const { SerializeForServer } = require("../../src/shared/ecs/gen/json_serde");
const { ChangeSerde } = require("../../src/shared/ecs/serde");
const { SHARD_DIM, shardToVoxelPos } = require("../../src/shared/game/shard");
const {
  harthmereRiverBedMaterialAt,
  harthmereRiverCarvesAirAt,
  harthmereRiverContains,
  harthmereRiverCrossingDeckAt,
  harthmereRiverWaterLevelAt,
} = require("../../src/shared/harthmere/harthmere_river");
const {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_ADDITIVE_TOWN_OFFSET_Z,
  HARTHMERE_EXTENSION_GROUND_Y,
  harthmereExtensionTerrainEntityIdForShard,
} = require("../../src/shared/harthmere/world_extension");
const { loadSeed, loadWater } = require("../../src/shared/game/terrain");
const {
  deserializeRedisEntityState,
} = require("../../src/server/shared/world/lua/serde");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const { Sparse3 } = require("../../src/shared/util/sparse");
const { saveBlock } = require("../../src/shared/wasm/biomes");
const { Tensor } = require("../../src/shared/wasm/tensors");
const { zrpcWebSerialize } = require("../../src/shared/zrpc/serde");

const BASE_URL = process.env.HARTHMERE_E2E_BASE_URL || "http://127.0.0.1:3047";
const CONTROL_TOKEN = process.env.HARTHMERE_E2E_CONTROL_TOKEN || "";
const USERNAME = process.env.HARTHMERE_E2E_USERNAME || "NativeECS-A-1050377428";
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number.parseInt(process.env.REDIS_PORT || "6392", 10);
const VERIFY_ONLY =
  process.env.HARTHMERE_FISHING_FIXTURE_VERIFY_ONLY === "1";
const TARGET_SHARD_X = 69;
const TARGET_SHARD_Z = -6;
const TARGET_SHARD_Y = 1;

if (!VERIFY_ONLY) {
  assert(CONTROL_TOKEN, "HARTHMERE_E2E_CONTROL_TOKEN is required");
}

function terrainId(name, fallback) {
  return Number(safeGetTerrainId(name) ?? fallback);
}

function materials() {
  const grass = Number(getTerrainID("grass"));
  const dirt = Number(getTerrainID("dirt"));
  const stone = Number(getTerrainID("stone"));
  return {
    grass,
    dirt,
    stone,
    gravel: terrainId("gravel", stone),
    sand: terrainId("sand", dirt),
    moss: terrainId("moss", grass),
    stoneBrick: terrainId("stone_brick", stone),
    oakLumber: terrainId("oak_lumber", dirt),
  };
}

function materialForRiver(value, all) {
  return all[value] ?? all.stone;
}

function fixtureShardSpecs() {
  const specs = [];
  for (
    let shardZ = TARGET_SHARD_Z - 1;
    shardZ <= TARGET_SHARD_Z + 1;
    shardZ += 1
  ) {
    for (
      let shardX = TARGET_SHARD_X - 1;
      shardX <= TARGET_SHARD_X + 1;
      shardX += 1
    ) {
      const id = harthmereExtensionTerrainEntityIdForShard(
        shardX,
        TARGET_SHARD_Y,
        shardZ
      );
      assert(id, `No stable Harthmere terrain id for ${shardX}:1:${shardZ}`);
      specs.push({ id, shardX, shardY: TARGET_SHARD_Y, shardZ });
    }
  }
  return specs;
}

function makeShard(voxeloo, spec) {
  const v0 = shardToVoxelPos(spec.shardX, spec.shardY, spec.shardZ);
  const v1 = [v0[0] + SHARD_DIM, v0[1] + SHARD_DIM, v0[2] + SHARD_DIM];
  const all = materials();
  const seedBuffer = using(new voxeloo.VolumeBlock_U32(), (seed) => {
    const groundLocalY = HARTHMERE_EXTENSION_GROUND_Y - v0[1];
    for (let z = 0; z < SHARD_DIM; z += 1) {
      for (let x = 0; x < SHARD_DIM; x += 1) {
        const authoredX = v0[0] + x - HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
        const authoredZ = v0[2] + z - HARTHMERE_ADDITIVE_TOWN_OFFSET_Z;
        for (let y = 0; y <= groundLocalY; y += 1) {
          const worldY = v0[1] + y;
          const depth = HARTHMERE_EXTENSION_GROUND_Y - worldY;
          const relY = worldY - HARTHMERE_EXTENSION_GROUND_Y;
          const riverBed = harthmereRiverBedMaterialAt(
            authoredX,
            relY,
            authoredZ
          );
          if (riverBed) {
            seed.set(x, y, z, materialForRiver(riverBed, all));
            continue;
          }
          if (harthmereRiverCarvesAirAt(authoredX, relY, authoredZ)) {
            continue;
          }
          if (depth === 0) {
            const deck = harthmereRiverCrossingDeckAt(
              authoredX,
              relY,
              authoredZ
            );
            seed.set(x, y, z, deck ? materialForRiver(deck, all) : all.grass);
          } else {
            seed.set(x, y, z, depth > 6 ? all.stone : all.dirt);
          }
        }
      }
    }
    return saveBlock(voxeloo, seed);
  });
  const muckBuffer = using(
    Tensor.make(voxeloo, [SHARD_DIM, SHARD_DIM, SHARD_DIM], "U8"),
    (muck) => muck.save()
  );
  const shardWater = using(
    Tensor.make(voxeloo, [SHARD_DIM, SHARD_DIM, SHARD_DIM], "U8"),
    (water) => {
      const values = new Sparse3([SHARD_DIM, SHARD_DIM, SHARD_DIM]);
      for (let z = 0; z < SHARD_DIM; z += 1) {
        for (let x = 0; x < SHARD_DIM; x += 1) {
          const authoredX = v0[0] + x - HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
          const authoredZ = v0[2] + z - HARTHMERE_ADDITIVE_TOWN_OFFSET_Z;
          if (!harthmereRiverContains(authoredX, authoredZ)) {
            continue;
          }
          for (let y = 0; y < SHARD_DIM; y += 1) {
            const relY = v0[1] + y - HARTHMERE_EXTENSION_GROUND_Y;
            const level = harthmereRiverWaterLevelAt(
              authoredX,
              relY,
              authoredZ
            );
            if (level > 0) {
              values.set([x, y, z], level);
            }
          }
        }
      }
      water.assign(values);
      return ShardWater.create(water.saveWrapped());
    }
  );
  return {
    id: spec.id,
    box: Box.create({ v0, v1 }),
    shard_seed: ShardSeed.create({ buffer: seedBuffer }),
    shard_diff: ShardDiff.create(),
    shard_shapes: ShardShapes.create(),
    shard_muck: ShardMuck.create({ buffer: muckBuffer }),
    shard_water: shardWater,
  };
}

function serializedChange(change) {
  return ChangeSerde.serializeProposed(SerializeForServer, change);
}

async function authenticate() {
  const url = new URL("/api/harthmere/visual_test_auth", BASE_URL);
  url.searchParams.set("usernameOrId", USERNAME);
  url.searchParams.set("e2eAdmin", "1");
  const response = await fetch(url, {
    headers: { "x-harthmere-e2e-token": CONTROL_TOKEN },
  });
  if (!response.ok) {
    throw new Error(
      `Visual auth failed HTTP ${response.status}: ${await response.text()}`
    );
  }
  const auth = await response.json();
  assert.equal(auth.e2eAdmin, true, "Visual auth did not grant E2E admin");
  assert(auth.userId && auth.sessionId, "Visual auth did not return a session");
  return `BUID=${auth.userId}; BSID=${auth.sessionId}`;
}

async function applyChanges(cookie, changes) {
  const response = await fetch(
    new URL("/api/admin/apply_ecs_changes", BASE_URL),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        z: zrpcWebSerialize(changes.map(serializedChange)),
      }),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Terrain fixture apply failed HTTP ${
        response.status
      }: ${await response.text()}`
    );
  }
}

async function verify(redis, voxeloo, specs) {
  const deadline = Date.now() + 15_000;
  let entities;
  while (Date.now() < deadline) {
    const rows = await redis.mgetBuffer(specs.map(({ id }) => `b:${id}`));
    if (rows.every(Boolean)) {
      entities = rows.map(
        (row, index) => deserializeRedisEntityState(specs[index].id, row)[1]
      );
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(entities, "Timed out waiting for all fishing fixture shards in Redis");

  const targetIndex = specs.findIndex(
    ({ shardX, shardZ }) =>
      shardX === TARGET_SHARD_X && shardZ === TARGET_SHARD_Z
  );
  const entity = entities[targetIndex];
  const seed = loadSeed(voxeloo, {
    shard_seed: entity.shardSeed(),
  });
  const water = loadWater(voxeloo, {
    shard_water: entity.shardWater(),
  });
  assert(
    seed && water,
    "Canonical quay shard did not decode terrain and water"
  );
  try {
    const bank = [2213 - 2208, 52 - 32, -174 - -192];
    const river = [2214 - 2208, 51 - 32, -174 - -192];
    assert.notEqual(seed.get(...bank), 0, "Fishing Board bank is not solid");
    assert.equal(
      water.get(...river),
      15,
      "Brell river is not source-level water"
    );
    return {
      bankTerrainId: seed.get(...bank),
      riverWaterLevel: water.get(...river),
    };
  } finally {
    seed.delete();
    water.delete();
  }
}

async function main() {
  const specs = fixtureShardSpecs();
  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    lazyConnect: true,
  });
  const voxeloo = await loadVoxeloo();
  await redis.connect();
  try {
    const existing = new Set();
    const presence = await redis.mgetBuffer(specs.map(({ id }) => `b:${id}`));
    presence.forEach((value, index) => {
      if (value) existing.add(specs[index].id);
    });
    const startedAt = Date.now();
    if (VERIFY_ONLY) {
      assert.equal(
        existing.size,
        specs.length,
        `Fishing fixture is incomplete: ${existing.size}/${specs.length} shards exist`
      );
    } else {
      const changes = specs.map((spec) => ({
        kind: existing.has(spec.id) ? "update" : "create",
        entity: makeShard(voxeloo, spec),
      }));
      const cookie = await authenticate();
      await applyChanges(cookie, changes);
    }
    const verified = await verify(redis, voxeloo, specs);
    console.log(
      JSON.stringify(
        {
          ok: true,
          version: "harthmere-fishing-live-fixture-v2",
          mode: VERIFY_ONLY ? "verify-only" : "seed-and-verify",
          shards: specs.length,
          created: VERIFY_ONLY ? 0 : specs.length - existing.size,
          updated: VERIFY_ONLY ? 0 : existing.size,
          elapsedMs: Date.now() - startedAt,
          ...verified,
        },
        null,
        2
      )
    );
  } finally {
    await redis.quit();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
