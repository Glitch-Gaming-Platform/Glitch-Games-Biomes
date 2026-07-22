#!/usr/bin/env node
/*
 * Builds a visible, walkable route from the Grove's Selfie Overlook to
 * Harthmere's west gate against the terrain that is actually installed.
 *
 * Safety is intentionally fail-closed:
 *   - A* only crosses columns with a one-block maximum step.
 *   - Placeables, grouped structures, occupied voxels, water, crops, trees,
 *     and non-natural surface materials are treated as blocked.
 *   - Every destructive edit is revalidated before any Redis write begins.
 *   - Existing building/group entities are never changed or deleted.
 *
 * Dry-run production Redis:
 *   REDIS_HOST=10.0.0.12 node scripts/harthmere/materialize-harthmere-connector-route.cjs
 * Apply:
 *   REDIS_HOST=10.0.0.12 APPLY=1 node scripts/harthmere/materialize-harthmere-connector-route.cjs
 * Dry-run the packaged snapshot without Redis:
 *   SNAPSHOT_PATH=snapshot_backup.json node scripts/harthmere/materialize-harthmere-connector-route.cjs
 */

if (process.env.HARTHMERE_BUNDLED_MATERIALIZER !== "1") {
  require("ts-node/register/transpile-only");
  require("tsconfig-paths/register");
}
process.env.IS_SERVER = process.env.IS_SERVER || "1";

const path = require("path");
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
const { iterBackupEntitiesFromFile } = require("../../src/server/backup/serde");
const { loadTerrain, loadWater } = require("../../src/shared/game/terrain");
const {
  getTerrainID,
  safeGetTerrainName,
} = require("../../src/shared/asset_defs/terrain");
const {
  terrainCollides,
} = require("../../src/shared/asset_defs/quirk_helpers");
const {
  SHARD_SHAPE,
  blockPos,
  voxelShard,
} = require("../../src/shared/game/shard");
const {
  loadBlockWrapper,
  saveBlockWrapper,
} = require("../../src/shared/wasm/biomes");
const { Tensor } = require("../../src/shared/wasm/tensors");
const {
  HARTHMERE_CONNECTOR_MIN_HEADROOM,
  HARTHMERE_CONNECTOR_DESCENT_LANDING,
  HARTHMERE_CONNECTOR_DESCENT_LANDING_Y,
  HARTHMERE_CONNECTOR_ROUTE_BOUNDS,
  HARTHMERE_CONNECTOR_ROUTE_VERSION,
  HARTHMERE_CONNECTOR_TOWN_ENTRANCE,
  planHarthmereConnectorRoute,
  validateHarthmereConnectorRoutePlan,
} = require("../../src/shared/harthmere/harthmere_connector_route");

const REDIS_HOST =
  process.env.REDIS_HOST || process.env.GLITCH_REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number.parseInt(
  process.env.REDIS_PORT || process.env.GLITCH_REDIS_PORT || "6379",
  10
);
const APPLY = process.env.APPLY === "1";
const SNAPSHOT_PATH = process.env.SNAPSHOT_PATH
  ? path.resolve(process.env.SNAPSHOT_PATH)
  : undefined;
const SCAN_COUNT = Number.parseInt(process.env.SCAN_COUNT || "5000", 10);
const APPLY_SHARD_BATCH_SIZE = Math.max(
  1,
  Number.parseInt(process.env.APPLY_SHARD_BATCH_SIZE || "4", 10)
);
const ANCHOR_SEARCH_RADIUS = Math.max(
  12,
  Number.parseInt(process.env.ANCHOR_SEARCH_RADIUS || "48", 10)
);
const PRINT_ROUTE_PROFILE = process.env.PRINT_ROUTE_PROFILE === "1";
const FORCE_ALLOW_EXISTING_CONNECTOR_CAPS =
  process.env.ALLOW_EXISTING_CONNECTOR_CAPS === "1";
const PROBE_MIN_Y = 32;
const PROBE_MAX_Y = 96;
const STRUCTURE_PADDING = 1;

const SAFE_SURFACE_NAMES = new Set([
  "grass",
  "dirt",
  "stone",
  "limestone",
  "clay",
  "gravel",
  "moss",
  "soil",
  "sand",
  "muckwad",
  "splintered_muck",
  "switch_grass",
  "fescue_grass",
  "moss_grass",
  "cobblestone",
]);
const SAFE_EDIT_NAMES = new Set(SAFE_SURFACE_NAMES);
const SAFE_TRAVERSABLE_NAMES = new Set([
  ...SAFE_EDIT_NAMES,
  "stone_brick",
  "stone_polished",
  "cobblestone_brick",
  "cobblestone_polished",
  "limestone_brick",
  "limestone_polished",
]);
const ROAD_CENTER_ID = getTerrainID("cobblestone");
const ROAD_SHOULDER_ID = getTerrainID("gravel");
const APPROACH_CAP_ID = getTerrainID("stone_brick");

function isExistingConnectorCapColumn(x, z) {
  return (
    (x >= 718 && x <= 734 && z >= -212 && z <= -196) ||
    (x >= 894 && x <= 989 && z >= -210 && z <= -204) ||
    // The generated additive road owns the exact old/new-world boundary.
    // Reusing its stone-brick lane lets the protected transition stair meet
    // the extension without treating the West Gate road as a building.
    (x === 1792 && z >= -214 && z <= -204)
  );
}

function component(entity, field, method) {
  if (typeof entity?.[method] === "function") return entity[method]();
  return entity?.[field];
}

function hasComponent(entity, field, method) {
  const hasMethod = `has${method[0].toUpperCase()}${method.slice(1)}`;
  if (typeof entity?.[hasMethod] === "function") return entity[hasMethod]();
  return entity?.[field] !== undefined;
}

function normalizedTerrainEntity(entity) {
  return {
    shard_seed: component(entity, "shard_seed", "shardSeed"),
    shard_diff: component(entity, "shard_diff", "shardDiff"),
  };
}

function targetShardIds() {
  const shards = new Set();
  for (
    let x = HARTHMERE_CONNECTOR_ROUTE_BOUNDS.minX - 16;
    x <= HARTHMERE_CONNECTOR_ROUTE_BOUNDS.maxX + 16;
    x += 16
  ) {
    for (
      let z = HARTHMERE_CONNECTOR_ROUTE_BOUNDS.minZ - 16;
      z <= HARTHMERE_CONNECTOR_ROUTE_BOUNDS.maxZ + 16;
      z += 16
    ) {
      for (let y = PROBE_MIN_Y; y <= PROBE_MAX_Y; y += 16) {
        shards.add(voxelShard(x, y, z));
      }
    }
  }
  return shards;
}

function overlapsConnectorBounds(box) {
  return !(
    box.x1 < HARTHMERE_CONNECTOR_ROUTE_BOUNDS.minX - 4 ||
    box.x0 > HARTHMERE_CONNECTOR_ROUTE_BOUNDS.maxX + 4 ||
    box.z1 < HARTHMERE_CONNECTOR_ROUTE_BOUNDS.minZ - 4 ||
    box.z0 > HARTHMERE_CONNECTOR_ROUTE_BOUNDS.maxZ + 4 ||
    box.y1 < PROBE_MIN_Y ||
    box.y0 > PROBE_MAX_Y + HARTHMERE_CONNECTOR_MIN_HEADROOM
  );
}

function entityStructureBox(entity) {
  const structural =
    hasComponent(entity, "placeable_component", "placeableComponent") ||
    hasComponent(entity, "group_component", "groupComponent") ||
    hasComponent(entity, "grouped_entities", "groupedEntities");
  if (!structural) return undefined;

  const box = component(entity, "box", "box");
  if (box?.v0 && box?.v1) {
    return {
      x0: Math.floor(box.v0[0]) - STRUCTURE_PADDING,
      y0: Math.floor(box.v0[1]) - STRUCTURE_PADDING,
      z0: Math.floor(box.v0[2]) - STRUCTURE_PADDING,
      x1: Math.ceil(box.v1[0]) + STRUCTURE_PADDING,
      y1: Math.ceil(box.v1[1]) + STRUCTURE_PADDING,
      z1: Math.ceil(box.v1[2]) + STRUCTURE_PADDING,
    };
  }
  const position = component(entity, "position", "position")?.v;
  const size = component(entity, "size", "size")?.v;
  if (!position) return undefined;
  const sx = Math.max(1, Number(size?.[0] ?? 1));
  const sy = Math.max(1, Number(size?.[1] ?? 1));
  const sz = Math.max(1, Number(size?.[2] ?? 1));
  return {
    x0: Math.floor(position[0] - STRUCTURE_PADDING),
    y0: Math.floor(position[1] - STRUCTURE_PADDING),
    z0: Math.floor(position[2] - STRUCTURE_PADDING),
    x1: Math.ceil(position[0] + sx + STRUCTURE_PADDING),
    y1: Math.ceil(position[1] + sy + STRUCTURE_PADDING),
    z1: Math.ceil(position[2] + sz + STRUCTURE_PADDING),
  };
}

function loadOccupancy(voxeloo, entity) {
  const occupancy = component(entity, "shard_occupancy", "shardOccupancy");
  if (!occupancy?.buffer) return undefined;
  const tensor = Tensor.make(voxeloo, SHARD_SHAPE, "F64");
  tensor.load(occupancy.buffer);
  return tensor;
}

async function scanWorld(voxeloo, wantedShards) {
  const found = new Map();
  const structureBoxes = [];
  let scanned = 0;

  const consume = (tick, entity) => {
    scanned += 1;
    const box = component(entity, "box", "box");
    const seed = component(entity, "shard_seed", "shardSeed");
    if (box?.v0 && seed) {
      const shardId = voxelShard(...box.v0);
      if (wantedShards.has(shardId)) {
        const current = found.get(shardId);
        if (!current || current.tick < tick) {
          let terrain;
          let water;
          let occupancy;
          try {
            terrain = loadTerrain(voxeloo, normalizedTerrainEntity(entity));
            const waterComponent = component(
              entity,
              "shard_water",
              "shardWater"
            );
            water = waterComponent
              ? loadWater(voxeloo, { shard_water: waterComponent })
              : undefined;
            occupancy = loadOccupancy(voxeloo, entity);
          } catch {
            terrain?.delete?.();
            water?.delete?.();
            occupancy?.delete?.();
            return;
          }
          current?.terrain?.delete?.();
          current?.water?.delete?.();
          current?.occupancy?.delete?.();
          found.set(shardId, {
            id: entity.id,
            tick,
            terrain,
            water,
            occupancy,
          });
        }
      }
    }
    const structure = entityStructureBox(entity);
    if (structure && overlapsConnectorBounds(structure))
      structureBoxes.push(structure);
  };

  if (SNAPSHOT_PATH) {
    for await (const [tick, entity] of iterBackupEntitiesFromFile(
      SNAPSHOT_PATH
    )) {
      consume(Number(tick), entity);
    }
    return { found, structureBoxes, scanned };
  }

  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    lazyConnect: true,
  });
  await redis.connect();
  let cursor = "0";
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
      if (!keys.length) continue;
      const values = await redis.mgetBuffer(keys);
      for (let index = 0; index < values.length; index += 1) {
        const raw = values[index];
        if (!raw) continue;
        const id = Number(keys[index].slice(2));
        if (!Number.isFinite(id)) continue;
        try {
          unpackFromRedis(raw);
          const [tick, entity] = deserializeRedisEntityState(id, raw);
          if (entity) consume(Number(tick), entity);
        } catch {
          // Non-ECS or malformed values are irrelevant to route planning.
        }
      }
    } while (cursor !== "0");
  } finally {
    redis.disconnect();
  }
  return { found, structureBoxes, scanned };
}

function makeStructureIndex(structureBoxes) {
  const buckets = new Map();
  for (const box of structureBoxes) {
    for (
      let x = Math.floor(box.x0 / 16);
      x <= Math.floor(box.x1 / 16);
      x += 1
    ) {
      for (
        let z = Math.floor(box.z0 / 16);
        z <= Math.floor(box.z1 / 16);
        z += 1
      ) {
        const key = `${x},${z}`;
        const list = buckets.get(key) || [];
        list.push(box);
        buckets.set(key, list);
      }
    }
  }
  return {
    blocked(x, y0, y1, z) {
      const boxes =
        buckets.get(`${Math.floor(x / 16)},${Math.floor(z / 16)}`) || [];
      return boxes.some(
        (box) =>
          x >= box.x0 &&
          x <= box.x1 &&
          z >= box.z0 &&
          z <= box.z1 &&
          y1 >= box.y0 &&
          y0 <= box.y1
      );
    },
  };
}

function makeTerrainSamplers(
  found,
  structureIndex,
  allowExistingConnectorCaps = false
) {
  const shardFor = (x, y, z) => found.get(voxelShard(x, y, z));
  const terrainIdAt = (x, y, z) => {
    const shard = shardFor(x, y, z);
    return shard?.terrain ? Number(shard.terrain.get(...blockPos(x, y, z))) : 0;
  };
  const occupancyAt = (x, y, z) => {
    const shard = shardFor(x, y, z);
    return shard?.occupancy
      ? Number(shard.occupancy.get(...blockPos(x, y, z)))
      : 0;
  };
  const waterAt = (x, y, z) => {
    const shard = shardFor(x, y, z);
    return shard?.water ? Number(shard.water.get(...blockPos(x, y, z))) : 0;
  };
  const cache = new Map();
  const sample = (x, z) => {
    const key = `${x},${z}`;
    if (cache.has(key)) return cache.get(key);
    let surfaceY;
    let surfaceId = 0;
    for (let y = PROBE_MAX_Y; y >= PROBE_MIN_Y; y -= 1) {
      const id = terrainIdAt(x, y, z);
      if (id !== 0 && terrainCollides(id)) {
        surfaceY = y;
        surfaceId = id;
        break;
      }
    }
    if (surfaceY === undefined) {
      const missing = {
        surfaceY: undefined,
        blocked: true,
        canTraverse: false,
        canResurface: false,
      };
      cache.set(key, missing);
      return missing;
    }
    const terrainName = safeGetTerrainName(surfaceId);
    let blocked = structureIndex.blocked(
      x,
      surfaceY - 2,
      surfaceY + HARTHMERE_CONNECTOR_MIN_HEADROOM + 1,
      z
    );
    for (
      let y = surfaceY - 1;
      !blocked && y <= surfaceY + HARTHMERE_CONNECTOR_MIN_HEADROOM;
      y += 1
    ) {
      blocked = occupancyAt(x, y, z) !== 0;
    }
    const value = {
      surfaceY,
      surfaceId,
      terrainName,
      isWater: waterAt(x, surfaceY + 1, z) > 0,
      blocked,
      canTraverse: terrainName
        ? SAFE_TRAVERSABLE_NAMES.has(terrainName)
        : false,
      canResurface: terrainName
        ? SAFE_SURFACE_NAMES.has(terrainName) ||
          (allowExistingConnectorCaps &&
            terrainName === "stone_brick" &&
            isExistingConnectorCapColumn(x, z))
        : false,
    };
    cache.set(key, value);
    return value;
  };
  return { sample, terrainIdAt, occupancyAt, waterAt };
}

function validateEdits(
  edits,
  samplers,
  structureIndex,
  allowExistingConnectorCaps = false
) {
  const failures = [];
  for (const edit of edits) {
    const [x, y, z] = edit.position;
    const current = samplers.terrainIdAt(x, y, z);
    const currentName = safeGetTerrainName(current);
    if (structureIndex.blocked(x, y, y + HARTHMERE_CONNECTOR_MIN_HEADROOM, z)) {
      failures.push(`${edit.label}@${x},${y},${z}:protected_structure`);
      continue;
    }
    if (samplers.occupancyAt(x, y, z) !== 0) {
      failures.push(`${edit.label}@${x},${y},${z}:occupied_voxel`);
      continue;
    }
    if (edit.label === "approach_fill") {
      // Surface probing intentionally ignores non-colliding flora. Supported
      // causeway fill may replace that natural decoration, but never a solid
      // block, occupied voxel, or protected structure.
      if (current !== 0 && terrainCollides(current))
        failures.push(`${edit.label}@${x},${y},${z}:fill_not_clear`);
      continue;
    }
    if (
      currentName === "stone_brick" &&
      allowExistingConnectorCaps &&
      isExistingConnectorCapColumn(x, z)
    ) {
      continue;
    }
    if (edit.label === "passage_clearance") {
      if (current === 0) continue;
      if (!currentName || !SAFE_EDIT_NAMES.has(currentName)) {
        failures.push(
          `${edit.label}@${x},${y},${z}:unsafe_${currentName || current}`
        );
      }
      continue;
    }
    if (current !== 0 && (!currentName || !SAFE_EDIT_NAMES.has(currentName))) {
      failures.push(
        `${edit.label}@${x},${y},${z}:unsafe_${currentName || current}`
      );
    }
  }
  return failures;
}

function dedupeEdits(edits) {
  const byPosition = new Map();
  for (const edit of edits) {
    const key = edit.position.join(":");
    const previous = byPosition.get(key);
    // The engineered town approach is the final authority where the surface
    // road meets its causeway/tunnel floor.
    if (!previous || edit.label.startsWith("approach_"))
      byPosition.set(key, edit);
  }
  return [...byPosition.values()];
}

function validatePostEditTraversal(plan, edits, samplers, structureIndex) {
  const failures = [];
  const overlay = new Map(
    edits.map((edit) => [edit.position.join(":"), Number(edit.value)])
  );
  const terrainAfter = (x, y, z) =>
    overlay.has(`${x}:${y}:${z}`)
      ? overlay.get(`${x}:${y}:${z}`)
      : samplers.terrainIdAt(x, y, z);

  for (const [x, y, z] of plan.traversal) {
    const floorId = terrainAfter(x, y, z);
    if (!floorId || !terrainCollides(floorId)) {
      failures.push(`traversal@${x},${y},${z}:missing_collidable_floor`);
    }
    if (structureIndex.blocked(x, y, y + HARTHMERE_CONNECTOR_MIN_HEADROOM, z)) {
      failures.push(`traversal@${x},${y},${z}:protected_structure`);
    }
    for (
      let headY = y + 1;
      headY <= y + HARTHMERE_CONNECTOR_MIN_HEADROOM;
      headY += 1
    ) {
      const headId = terrainAfter(x, headY, z);
      if (headId && terrainCollides(headId)) {
        failures.push(`traversal@${x},${headY},${z}:blocked_headroom`);
      }
      if (samplers.occupancyAt(x, headY, z) !== 0) {
        failures.push(`traversal@${x},${headY},${z}:occupied_headroom`);
      }
    }
  }

  const last = plan.traversal.at(-1);
  if (
    last?.[0] !== HARTHMERE_CONNECTOR_TOWN_ENTRANCE[0] ||
    last?.[2] !== HARTHMERE_CONNECTOR_TOWN_ENTRANCE[1]
  ) {
    failures.push("traversal_does_not_reach_marked_town_entrance");
  }
  return failures;
}

function countBy(items, keyFor) {
  const counts = {};
  for (const item of items) {
    const key = keyFor(item);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

async function applyEdits(voxeloo, found, editsByShard) {
  const world = new RedisWorld(await connectToRedisWithLua("ecs"));
  const shardEntries = [...editsByShard.entries()].sort(([a], [b]) =>
    String(a).localeCompare(String(b))
  );
  let appliedEditCount = 0;
  try {
    await world.waitForHealthy();
    for (
      let start = 0;
      start < shardEntries.length;
      start += APPLY_SHARD_BATCH_SIZE
    ) {
      const batch = shardEntries.slice(start, start + APPLY_SHARD_BATCH_SIZE);
      const editor = world.edit();
      const terrainIds = batch.map(([shardId]) => found.get(shardId).id);
      const entities = await editor.get(terrainIds);
      for (let index = 0; index < batch.length; index += 1) {
        const [, edits] = batch[index];
        const entity = entities[index];
        if (!entity)
          throw new Error(`terrain entity missing: ${terrainIds[index]}`);
        const seed = new voxeloo.VolumeBlock_U32();
        const diff = new voxeloo.SparseBlock_U32();
        try {
          loadBlockWrapper(voxeloo, seed, entity.shardSeed());
          loadBlockWrapper(voxeloo, diff, entity.shardDiff());
          for (const edit of edits) {
            const local = blockPos(...edit.position);
            if (edit.value === 0) {
              if (seed.get(...local) === 0) diff.del(...local);
              else diff.set(...local, 0);
            } else {
              diff.set(...local, Number(edit.value));
            }
            appliedEditCount += 1;
          }
          entity.mutableShardDiff().buffer = saveBlockWrapper(
            voxeloo,
            diff
          ).buffer;
        } finally {
          seed.delete();
          diff.delete();
        }
      }
      await editor.commit();
      console.error(
        JSON.stringify({
          phase: "applyConnectorRouteBatch",
          batch: Math.floor(start / APPLY_SHARD_BATCH_SIZE) + 1,
          batches: Math.ceil(shardEntries.length / APPLY_SHARD_BATCH_SIZE),
          appliedEditCount,
        })
      );
    }
  } finally {
    await world.stop?.();
  }
  return appliedEditCount;
}

async function main() {
  if (SNAPSHOT_PATH && APPLY) {
    throw new Error(
      "APPLY=1 is not supported with SNAPSHOT_PATH; apply against Redis"
    );
  }
  const voxeloo = await loadVoxeloo();
  const wantedShards = targetShardIds();
  const { found, structureBoxes, scanned } = await scanWorld(
    voxeloo,
    wantedShards
  );
  try {
    const structureIndex = makeStructureIndex(structureBoxes);
    let allowExistingConnectorCaps = FORCE_ALLOW_EXISTING_CONNECTOR_CAPS;
    let samplers = makeTerrainSamplers(
      found,
      structureIndex,
      allowExistingConnectorCaps
    );
    let plan = planHarthmereConnectorRoute({
      sample: samplers.sample,
      anchorSearchRadius: ANCHOR_SEARCH_RADIUS,
    });
    if (!allowExistingConnectorCaps && plan.failures.length > 0) {
      const retrySamplers = makeTerrainSamplers(found, structureIndex, true);
      const retryPlan = planHarthmereConnectorRoute({
        sample: retrySamplers.sample,
        anchorSearchRadius: ANCHOR_SEARCH_RADIUS,
      });
      if (retryPlan.failures.length === 0) {
        allowExistingConnectorCaps = true;
        samplers = retrySamplers;
        plan = retryPlan;
      }
    }
    const contractFailures = validateHarthmereConnectorRoutePlan(
      plan,
      samplers.sample
    );
    const edits = dedupeEdits(plan.edits);
    const editFailures = validateEdits(
      edits,
      samplers,
      structureIndex,
      allowExistingConnectorCaps
    );
    const traversalFailures = validatePostEditTraversal(
      plan,
      edits,
      samplers,
      structureIndex
    );
    const failures = [
      ...new Set([...contractFailures, ...editFailures, ...traversalFailures]),
    ];

    const editsByShard = new Map();
    for (const edit of edits) {
      const shardId = voxelShard(...edit.position);
      const list = editsByShard.get(shardId) || [];
      list.push(edit);
      editsByShard.set(shardId, list);
    }
    const missingEditedShards = [...editsByShard.keys()].filter(
      (shardId) => !found.has(shardId)
    );
    if (missingEditedShards.length > 0) {
      failures.push(
        `missing ${missingEditedShards.length} edited terrain shards`
      );
    }

    const pathHeights = plan.path
      .map(([x, z]) => samplers.sample(x, z).surfaceY)
      .filter((y) => y !== undefined);
    console.log(
      JSON.stringify(
        {
          version: HARTHMERE_CONNECTOR_ROUTE_VERSION,
          apply: APPLY,
          source: SNAPSHOT_PATH || `${REDIS_HOST}:${REDIS_PORT}`,
          scannedEntities: scanned,
          resolvedTerrainShards: found.size,
          protectedStructureBoxes: structureBoxes.length,
          resolvedAnchors: plan.resolvedAnchors,
          markedTownEntrance: HARTHMERE_CONNECTOR_TOWN_ENTRANCE,
          confirmedLowerFloorLanding: [
            ...HARTHMERE_CONNECTOR_DESCENT_LANDING,
            HARTHMERE_CONNECTOR_DESCENT_LANDING_Y,
          ],
          reusedExistingConnectorCaps: allowExistingConnectorCaps,
          pathColumns: plan.path.length,
          traversalStart: plan.traversal.at(0),
          traversalEnd: plan.traversal.at(-1),
          pathHeightRange: pathHeights.length
            ? [Math.min(...pathHeights), Math.max(...pathHeights)]
            : undefined,
          editCount: edits.length,
          editCountsByLabel: countBy(edits, (edit) => edit.label),
          editedShardCount: editsByShard.size,
          materialIds: {
            roadCenter: ROAD_CENTER_ID,
            roadShoulder: ROAD_SHOULDER_ID,
            approachCap: APPROACH_CAP_ID,
          },
          ...(PRINT_ROUTE_PROFILE
            ? {
                routeProfile: plan.traversal.map(([x, y, z]) => [
                  x,
                  y,
                  z,
                  samplers.sample(x, z).surfaceY,
                ]),
                approachProtectedBoxes: structureBoxes.filter(
                  (box) =>
                    box.x1 >= 888 &&
                    box.x0 <= 952 &&
                    box.z1 >= -232 &&
                    box.z0 <= -188
                ),
              }
            : {}),
          failures,
        },
        null,
        2
      )
    );
    if (failures.length > 0) {
      throw new Error(
        `connector route safety validation failed (${failures.length})`
      );
    }
    if (!APPLY) {
      console.log(
        "Dry run only. Re-run with APPLY=1 to write the protected route."
      );
      return;
    }
    const appliedEditCount = await applyEdits(voxeloo, found, editsByShard);
    console.log(JSON.stringify({ done: true, appliedEditCount }, null, 2));
  } finally {
    for (const shard of found.values()) {
      shard.terrain?.delete?.();
      shard.water?.delete?.();
      shard.occupancy?.delete?.();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
