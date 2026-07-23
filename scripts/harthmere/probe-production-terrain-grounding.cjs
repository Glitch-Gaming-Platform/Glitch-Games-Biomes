#!/usr/bin/env node
// Production grounding gate for every deterministic Harthmere/Grove actor and
// seeded object. It intentionally uses two coordinate contracts:
//
//   1. Additive Harthmere outdoor content, including the separate town-animal
//      herd and guarded prisoner, is flat and must stand at feet Y=53 inside
//      the east extension.
//   2. Original snapshot/Grove content, including all Muckers/Hexes and
//      Muck-area wildlife plus road/camp bandits, is hilly. Its real outdoor or
//      indoor floor is resolved from production terrain at the entity's X/Z.
//
// APPLY=1 repairs ECS position (and NPC spawn_position) before verifying the
// persisted result. Player positions and player-authored placeables are never
// included; their Y is intentional.
//
//   REDIS_HOST=10.0.0.12 GLITCH_REDIS_HOST=10.0.0.12 IS_SERVER=1 \
//   APPLY=1 node scripts/harthmere/probe-production-terrain-grounding.cjs
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");
process.env.IS_SERVER = process.env.IS_SERVER || "1";

const { Redis } = require("ioredis");
const {
  deserializeRedisEntityState,
  unpackFromRedis,
} = require("../../src/server/shared/world/lua/serde");
const {
  connectToRedisWithLua,
} = require("../../src/server/shared/redis/connection");
const { RedisWorld } = require("../../src/server/shared/world/redis");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const { voxelShard, blockPos } = require("../../src/shared/game/shard");
const { loadTerrain } = require("../../src/shared/game/terrain");
const {
  terrainCollides,
} = require("../../src/shared/asset_defs/quirk_helpers");
const {
  Position,
  NpcMetadata,
} = require("../../src/shared/ecs/gen/components");
const {
  findHarthmereGroundFeetY,
  harthmereCanStandAt,
  HARTHMERE_GROUND_SCAN_DOWN_DEFAULT,
  HARTHMERE_GROUND_SCAN_UP_DEFAULT,
} = require("../../src/shared/harthmere/harthmere_entity_grounding");
const {
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS,
  harthmereGroundedLivestockSeedsInTerritory,
  harthmereGroundedMuckMonsterSeedsInTerritory,
  harthmereLiveEntityIsTownLivestock,
} = require("../../src/shared/harthmere/live_entity_production_seed");
const {
  HARTHMERE_NATIVE_BANDIT_SEEDS,
} = require("../../src/shared/harthmere/bandit_production_seed");
const {
  SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE,
  SNAPSHOT_GROVE_NPCS,
  snapshotGroveGroundedPosition,
  snapshotGroveNpcEntityId,
} = require("../../src/shared/harthmere/snapshot_grove_content");
const {
  SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS,
  hostileWorldPosition,
  snapshotHostileEntityId,
} = require("../../src/shared/harthmere/snapshot_runtime_rules");
const {
  HARTHMERE_BUSINESS_OWNER_NPC_SEEDS,
} = require("../../src/shared/harthmere/business_owner_npc_seed");
const {
  HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS,
} = require("../../src/shared/harthmere/business_customer_npc_seed");
const {
  HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS,
} = require("../../src/shared/harthmere/business_crafting_station_seed");
const {
  HARTHMERE_EXTENSION_FEET_Y,
  HARTHMERE_EXTENSION_WORLD_BOUNDS,
  isHarthmereExtensionWorldPosition,
} = require("../../src/shared/harthmere/world_extension");

const APPLY = process.env.APPLY === "1";
const REDIS_HOST =
  process.env.REDIS_HOST || process.env.GLITCH_REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number.parseInt(process.env.REDIS_PORT || "6379", 10);
const SCAN_COUNT = Number.parseInt(process.env.SCAN_COUNT || "3000", 10);
const PROBE_TOP_Y = 180;
const PROBE_BOTTOM_Y = -16;
const POSITION_TOLERANCE = 0.25;

function redisOptions() {
  return { host: REDIS_HOST, port: REDIS_PORT, lazyConnect: true };
}

function extensionItem(family, tag, entityId, position) {
  return {
    family,
    tag: String(tag),
    entityId: Number(entityId),
    position: [...position],
    placementMode: "extension_flat",
  };
}

function originalOutdoorItem(family, tag, entityId, position) {
  return {
    family,
    tag: String(tag),
    entityId: Number(entityId),
    position: [...position],
    placementMode: "original_outdoor",
  };
}

function originalIndoorItem(family, tag, entityId, position) {
  return {
    family,
    tag: String(tag),
    entityId: Number(entityId),
    position: [...position],
    placementMode: "original_indoor",
  };
}

async function loadExistingAdditiveTownNpcItems() {
  const redis = new Redis(redisOptions());
  await redis.connect();
  try {
    // Town offsets 1..70 include named NPCs, walkers, boards, and town service
    // actors. The server runtime-content marker owns their canonical X/Z; this
    // gate reads those persisted coordinates and enforces the flat Y contract.
    const ids = Array.from(
      { length: 70 },
      (_, index) => Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + index + 1
    );
    const values = await redis.mgetBuffer(ids.map((id) => `b:${id}`));
    const items = [];
    for (let index = 0; index < ids.length; index += 1) {
      const raw = values[index];
      if (!raw) continue;
      let entity;
      try {
        [, entity] = deserializeRedisEntityState(ids[index], raw);
      } catch {
        entity = undefined;
      }
      const position = entity?.hasPosition?.()
        ? entity.position()?.v
        : undefined;
      if (!position) continue;
      // A legacy standalone town may still use this id band on the original
      // map. Never flatten it unless it has actually migrated into the extension.
      if (!isHarthmereExtensionWorldPosition(position)) continue;
      items.push(
        extensionItem(
          "additive_town_npcs",
          `town-offset-${index + 1}`,
          ids[index],
          position
        )
      );
    }
    return items;
  } finally {
    redis.disconnect();
  }
}

async function productionProbeItems() {
  const townNpcs = await loadExistingAdditiveTownNpcItems();
  return [
    ...townNpcs,
    ...HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS.map((seed) =>
      extensionItem(
        "additive_robot_sentinels",
        seed.seedId,
        seed.entityId,
        seed.position
      )
    ),
    ...harthmereGroundedMuckMonsterSeedsInTerritory().map((seed) =>
      originalOutdoorItem(
        "original_muckers_hexers",
        seed.seedId,
        seed.entityId,
        seed.position
      )
    ),
    ...harthmereGroundedLivestockSeedsInTerritory().map((seed) =>
      harthmereLiveEntityIsTownLivestock(seed)
        ? extensionItem(
            "additive_town_animals",
            seed.seedId,
            seed.entityId,
            seed.position
          )
        : originalOutdoorItem(
            "original_muck_area_animals",
            seed.seedId,
            seed.entityId,
            seed.position
          )
    ),
    ...HARTHMERE_NATIVE_BANDIT_SEEDS.map((seed) =>
      isHarthmereExtensionWorldPosition(seed.position)
        ? extensionItem(
            "additive_town_bandits",
            seed.seedId,
            seed.entityId,
            seed.position
          )
        : originalOutdoorItem(
            "original_road_camp_bandits",
            seed.seedId,
            seed.entityId,
            seed.position
          )
    ),
    ...SNAPSHOT_GROVE_NPCS.filter((npc) => npc.seedServerNpc).map((npc) =>
      originalOutdoorItem(
        "original_grove_npcs",
        npc.id,
        snapshotGroveNpcEntityId(npc),
        snapshotGroveGroundedPosition(npc.authoredPosition)
      )
    ),
    ...SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS.map((spawn) =>
      originalOutdoorItem(
        "original_snapshot_hostiles",
        spawn.key,
        snapshotHostileEntityId(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE, spawn),
        hostileWorldPosition(spawn)
      )
    ),
    ...HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.map((seed) =>
      originalIndoorItem(
        "original_business_owners",
        seed.ownerNpcId,
        seed.entityId,
        seed.position
      )
    ),
    ...HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS.map((seed) =>
      originalIndoorItem(
        "original_business_customers",
        seed.customerNpcId,
        seed.entityId,
        seed.position
      )
    ),
    ...HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS.map((seed) =>
      originalIndoorItem(
        "original_business_objects",
        seed.stationSeedId,
        seed.entityId,
        seed.position
      )
    ),
  ];
}

function targetShardsForColumns(positions) {
  const shards = new Set();
  for (const [x, , z] of positions) {
    for (let y = PROBE_BOTTOM_Y; y <= PROBE_TOP_Y; y += 1) {
      shards.add(voxelShard(Math.floor(x), y, Math.floor(z)));
    }
  }
  return shards;
}

async function buildTerrainTensorMap(voxeloo, targetShards) {
  const redis = new Redis(redisOptions());
  await redis.connect();
  const found = new Map();
  let cursor = "0";
  let scanned = 0;
  try {
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
      for (let index = 0; index < values.length; index += 1) {
        const raw = values[index];
        if (!raw) continue;
        const id = Number(keys[index].slice(2));
        if (!Number.isFinite(id)) continue;
        let unpacked;
        try {
          unpacked = unpackFromRedis(raw);
        } catch {
          continue;
        }
        const encoded = unpacked?.[2];
        if (!encoded?.["33"] || !encoded?.["34"]) continue;
        const [tick, entity] = deserializeRedisEntityState(id, raw);
        if (!entity?.hasBox?.() || !entity?.hasShardSeed?.()) continue;
        const shardId = voxelShard(...entity.box().v0);
        if (!targetShards.has(shardId)) continue;
        const current = found.get(shardId);
        if (current && current.tick >= tick) continue;
        let tensor;
        try {
          tensor = loadTerrain(voxeloo, {
            shard_seed: entity.shardSeed(),
            shard_diff: entity.hasShardDiff?.()
              ? entity.shardDiff()
              : undefined,
          });
        } catch {
          tensor = undefined;
        }
        if (!tensor) continue;
        if (current?.tensor) {
          try {
            current.tensor.delete();
          } catch {}
        }
        found.set(shardId, { tick, tensor });
      }
    } while (cursor !== "0");
  } finally {
    redis.disconnect();
  }
  console.error(
    JSON.stringify({
      phase: "scan_complete",
      scanned,
      resolvedShards: found.size,
      targetShards: targetShards.size,
    })
  );
  return found;
}

function makeTerrainSamplers(tensorByShard) {
  const loaded = (x, y, z) =>
    Boolean(tensorByShard.get(voxelShard(x, y, z))?.tensor);
  const solid = (x, y, z) => {
    const shard = tensorByShard.get(voxelShard(x, y, z));
    if (!shard?.tensor) return false;
    const id = shard.tensor.get(...blockPos(x, y, z));
    return id !== 0 && terrainCollides(id);
  };
  return { loaded, solid };
}

function columnHasTerrainData(loaded, x, z) {
  for (let y = PROBE_BOTTOM_Y; y <= PROBE_TOP_Y; y += 16) {
    if (loaded(x, y, z)) return true;
  }
  return loaded(x, PROBE_TOP_Y, z);
}

function resolveProbeRow(item, samplers) {
  const [x, hintY, z] = item.position;
  const hasTerrainData = columnHasTerrainData(samplers.loaded, x, z);
  let resolvedFeetY;
  let extensionSurfaceSupported = true;

  if (hasTerrainData && item.placementMode === "extension_flat") {
    extensionSurfaceSupported = harthmereCanStandAt(
      samplers.solid,
      Math.floor(x),
      HARTHMERE_EXTENSION_FEET_Y,
      Math.floor(z)
    );
    resolvedFeetY = extensionSurfaceSupported
      ? HARTHMERE_EXTENSION_FEET_Y
      : findHarthmereGroundFeetY(samplers.solid, Math.floor(x), Math.floor(z), {
          hintY: HARTHMERE_EXTENSION_FEET_Y,
          requireOpenSky: false,
        });
  } else if (hasTerrainData) {
    resolvedFeetY = findHarthmereGroundFeetY(
      samplers.solid,
      Math.floor(x),
      Math.floor(z),
      {
        hintY,
        requireOpenSky: item.placementMode === "original_outdoor",
      }
    );
  }

  const offGround =
    resolvedFeetY !== undefined &&
    Math.abs(Number(hintY) - resolvedFeetY) > POSITION_TOLERANCE;
  return {
    ...item,
    x,
    z,
    hintY,
    hasTerrainData,
    resolvedFeetY,
    extensionSurfaceSupported,
    offGround,
  };
}

function summarizeFamily(family, rows) {
  const grounded = rows.filter((row) => row.resolvedFeetY !== undefined);
  const heights = grounded.map((row) => row.resolvedFeetY);
  const deltas = grounded.map((row) => row.resolvedFeetY - row.hintY);
  const min = (values) => (values.length ? Math.min(...values) : null);
  const max = (values) => (values.length ? Math.max(...values) : null);
  const summary = {
    family,
    positions: rows.length,
    positionsWithTerrain: rows.filter((row) => row.hasTerrainData).length,
    positionsWithSurface: grounded.length,
    offGround: rows.filter((row) => row.offGround).length,
    unsupportedExtensionSurface: rows.filter(
      (row) =>
        row.placementMode === "extension_flat" && !row.extensionSurfaceSupported
    ).length,
    groundFeetY: {
      min: min(heights),
      max: max(heights),
      spread: heights.length ? max(heights) - min(heights) : null,
    },
    deltaGroundMinusSeedY: {
      min: min(deltas),
      max: max(deltas),
      maxAbs: deltas.length
        ? max(deltas.map((delta) => Math.abs(delta)))
        : null,
    },
  };
  console.log(JSON.stringify(summary));
  for (const row of rows
    .filter((candidate) => candidate.offGround)
    .slice(0, 5)) {
    console.log(
      `  OFF GROUND ${row.tag} [${row.x},${row.z}] seedY=${row.hintY} terrainFeetY=${row.resolvedFeetY}`
    );
  }
  return summary;
}

async function applyGroundingRepairs(rows) {
  const repairRows = rows.filter(
    (row) =>
      row.offGround &&
      row.resolvedFeetY !== undefined &&
      row.extensionSurfaceSupported
  );
  if (!APPLY || repairRows.length === 0) {
    return { attempted: repairRows.length, applied: 0, unresolved: repairRows };
  }

  const redis = new Redis(redisOptions());
  await redis.connect();
  const world = new RedisWorld(await connectToRedisWithLua("ecs"));
  let applied = 0;
  const unresolved = [];
  try {
    await world.waitForHealthy();
    for (const row of repairRows) {
      const raw = await redis.getBuffer(`b:${row.entityId}`);
      let entity;
      if (raw) {
        try {
          [, entity] = deserializeRedisEntityState(row.entityId, raw);
        } catch {
          entity = undefined;
        }
      }
      const current = entity?.hasPosition?.()
        ? entity.position()?.v
        : undefined;
      if (!entity || !current) {
        unresolved.push({ ...row, reason: "missing_ecs_entity" });
        continue;
      }
      const target = [current[0], row.resolvedFeetY, current[2]];
      const update = {
        id: row.entityId,
        position: Position.create({ v: target }),
      };
      if (entity.hasNpcMetadata?.()) {
        const metadata = entity.npcMetadata();
        update.npc_metadata = NpcMetadata.create({
          type_id: metadata?.type_id,
          spawn_position: target,
          spawn_orientation: metadata?.spawn_orientation,
          created_time: metadata?.created_time,
          spawn_event_id: metadata?.spawn_event_id,
          spawn_event_type_id: metadata?.spawn_event_type_id,
        });
      }
      await world.apply({ changes: [{ kind: "update", entity: update }] });
      applied += 1;
    }

    for (const row of repairRows) {
      const raw = await redis.getBuffer(`b:${row.entityId}`);
      let entity;
      if (raw) {
        try {
          [, entity] = deserializeRedisEntityState(row.entityId, raw);
        } catch {
          entity = undefined;
        }
      }
      const current = entity?.hasPosition?.()
        ? entity.position()?.v
        : undefined;
      const spawn = entity?.hasNpcMetadata?.()
        ? entity.npcMetadata()?.spawn_position
        : undefined;
      if (
        !current ||
        Math.abs(current[1] - row.resolvedFeetY) > POSITION_TOLERANCE ||
        (spawn && Math.abs(spawn[1] - row.resolvedFeetY) > POSITION_TOLERANCE)
      ) {
        unresolved.push({
          ...row,
          reason: "readback_mismatch",
          current,
          spawn,
        });
      }
    }
  } finally {
    redis.disconnect();
    await world.stop?.();
  }
  return { attempted: repairRows.length, applied, unresolved };
}

async function main() {
  const items = await productionProbeItems();
  const duplicateIds = items.filter(
    (item, index) =>
      items.findIndex((candidate) => candidate.entityId === item.entityId) !==
      index
  );
  if (duplicateIds.length) {
    throw new Error(
      `Duplicate grounding probe entity ids: ${duplicateIds
        .slice(0, 8)
        .map((item) => item.entityId)
        .join(",")}`
    );
  }

  const extensionOutsideBounds = items.filter(
    (item) =>
      item.placementMode === "extension_flat" &&
      !isHarthmereExtensionWorldPosition(item.position)
  );
  if (extensionOutsideBounds.length) {
    throw new Error(
      `Extension seed outside additive bounds: ${extensionOutsideBounds
        .slice(0, 8)
        .map((item) => `${item.tag}:${item.position.join(",")}`)
        .join(" | ")}`
    );
  }

  const voxeloo = await loadVoxeloo();
  const tensorByShard = await buildTerrainTensorMap(
    voxeloo,
    targetShardsForColumns(items.map((item) => item.position))
  );
  const samplers = makeTerrainSamplers(tensorByShard);
  const rows = items.map((item) => resolveProbeRow(item, samplers));

  console.log(
    JSON.stringify({
      phase: "grounding_probe_start",
      apply: APPLY,
      positions: rows.length,
      scanBudget: {
        down: HARTHMERE_GROUND_SCAN_DOWN_DEFAULT,
        up: HARTHMERE_GROUND_SCAN_UP_DEFAULT,
      },
      extensionBounds: HARTHMERE_EXTENSION_WORLD_BOUNDS,
      extensionFeetY: HARTHMERE_EXTENSION_FEET_Y,
    })
  );

  const byFamily = new Map();
  for (const row of rows) {
    if (!byFamily.has(row.family)) byFamily.set(row.family, []);
    byFamily.get(row.family).push(row);
  }
  for (const [family, familyRows] of byFamily) {
    summarizeFamily(family, familyRows);
  }

  const noTerrainData = rows.filter((row) => !row.hasTerrainData);
  const noSurface = rows.filter(
    (row) => row.hasTerrainData && row.resolvedFeetY === undefined
  );
  const unsupportedExtensionSurface = rows.filter(
    (row) =>
      row.placementMode === "extension_flat" && !row.extensionSurfaceSupported
  );
  const repairResult = await applyGroundingRepairs(rows);

  for (const { tensor } of tensorByShard.values()) {
    try {
      tensor.delete();
    } catch {}
  }

  const uncorrectedOffGround = APPLY
    ? repairResult.unresolved
    : rows.filter((row) => row.offGround);
  console.log(
    JSON.stringify({
      phase: "grounding_probe_result",
      positions: rows.length,
      noTerrainData: noTerrainData.length,
      noSurface: noSurface.length,
      unsupportedExtensionSurface: unsupportedExtensionSurface.length,
      offGroundBeforeRepair: rows.filter((row) => row.offGround).length,
      repairAttempted: repairResult.attempted,
      repairApplied: repairResult.applied,
      unresolvedAfterRepair: uncorrectedOffGround.length,
    })
  );

  if (
    noTerrainData.length ||
    noSurface.length ||
    unsupportedExtensionSurface.length ||
    uncorrectedOffGround.length
  ) {
    console.error(
      "FAIL: deterministic Harthmere/Grove actors or objects are floating, buried, outside loaded terrain, or not persisted at the resolved floor."
    );
    process.exit(1);
  }
  console.log(
    "PASS: all deterministic NPCs, Muckers, Hexers, animals, robots, business occupants, and seeded business objects are grounded."
  );
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
