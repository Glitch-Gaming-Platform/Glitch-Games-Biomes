#!/usr/bin/env node
/*
 * Builds the production Harthmere placement map from live terrain.
 *
 * Read-only production behavior:
 * - uses `az account show` and `az containerapp show` to record the exact
 *   production revision being sampled;
 * - scans Redis terrain shard entities through mget only;
 * - writes local artifacts / generated TypeScript when --write is supplied.
 */

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");
process.env.IS_SERVER = process.env.IS_SERVER || "1";

const fs = require("fs");
const path = require("path");
const childProcess = require("child_process");
const { Redis } = require("ioredis");

const {
  deserializeRedisEntityState,
  unpackFromRedis,
} = require("../../src/server/shared/world/lua/serde");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const {
  blockPos,
  shardsForAABB,
  voxelShard,
} = require("../../src/shared/game/shard");
const { loadTerrain, loadWater } = require("../../src/shared/game/terrain");
const {
  terrainCollides,
} = require("../../src/shared/asset_defs/quirk_helpers");
const {
  BIBLE_QUEST_CATALOG: HARTHMERE_QUEST_CATALOG,
} = require("../../src/shared/harthmere/bible/bible_quest_catalog");
const {
  HARTHMERE_MAIN_QUEST_SPACES,
} = require("../../src/shared/harthmere/main_quest_spaces");
const {
  shiftHarthmereAuthoredPositionToWorld,
} = require("../../src/shared/harthmere/coordinate_transform");
const {
  harthmereJobsBoardQuestMarkerPositions,
} = require("../../src/shared/harthmere/jobs_board_quest_marker_positions");
const {
  HARTHMERE_BUSINESS_OWNER_NPC_SEEDS,
} = require("../../src/shared/harthmere/business_owner_npc_seed");
const {
  HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS,
} = require("../../src/shared/harthmere/business_customer_npc_seed");
const {
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS,
  harthmereGroundedLivestockSeedsInTerritory,
  harthmereGroundedMuckMonsterSeedsInTerritory,
} = require("../../src/shared/harthmere/live_entity_production_seed");
const {
  HARTHMERE_EXOTIC_MATTER_CAVES,
  harthmereExoticMatterDepositQuestMarkers,
} = require("../../src/shared/harthmere/exotic_matter_caves");
const {
  muckMonsterAreaForPosition,
} = require("../../src/shared/harthmere/muck_monster_aggression_ai");

const VERSION = "harthmere-production-terrain-placement-map";
const DEFAULT_RG = "openai-resource-group";
const DEFAULT_APP = "biomes-node-vnet";
const DEFAULT_REDIS_HOST = "20.127.78.175";
const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_SCAN_COUNT = 3000;
const DEFAULT_STRIDE = 4;
const DEFAULT_MARGIN = 96;
const DEFAULT_Y0 = -64;
const DEFAULT_Y1 = 160;
const SKY_SCAN_LIMIT = 96;
const CAVE_Y_TOLERANCE = 5;

function parseArgs(argv) {
  const args = {
    resourceGroup: process.env.AZURE_RESOURCE_GROUP || DEFAULT_RG,
    containerApp: process.env.AZURE_CONTAINER_APP || DEFAULT_APP,
    redisHost:
      process.env.HARTHMERE_WORLD_SYNC_REDIS_HOST ||
      process.env.PROD_REDIS_PUBLIC_HOST ||
      process.env.REDIS_HOST ||
      DEFAULT_REDIS_HOST,
    redisPort: Number(
      process.env.HARTHMERE_WORLD_SYNC_REDIS_PORT ||
        process.env.PROD_REDIS_PORT ||
        process.env.REDIS_PORT ||
        DEFAULT_REDIS_PORT
    ),
    scanCount: Number(process.env.SCAN_COUNT || DEFAULT_SCAN_COUNT),
    stride: Number(
      process.env.HARTHMERE_PLACEMENT_MAP_STRIDE || DEFAULT_STRIDE
    ),
    margin: Number(
      process.env.HARTHMERE_PLACEMENT_MAP_MARGIN || DEFAULT_MARGIN
    ),
    y0: Number(process.env.HARTHMERE_PLACEMENT_MAP_Y0 || DEFAULT_Y0),
    y1: Number(process.env.HARTHMERE_PLACEMENT_MAP_Y1 || DEFAULT_Y1),
    maxOutdoorSpawnPoints: 256,
    maxCaves: 48,
    maxSpawnPointsPerCave: 16,
    minCaveSamples: 4,
    write: false,
    artifactOut: path.join(
      process.cwd(),
      "artifacts/harthmere-production-placement-map/placement-map.json"
    ),
    tsOut: path.join(
      process.cwd(),
      "src/shared/harthmere/generated/production_terrain_placement_map.ts"
    ),
  };

  for (const raw of argv.slice(2)) {
    if (raw === "--write") {
      args.write = true;
      continue;
    }
    const [key, value] = raw.split("=", 2);
    switch (key) {
      case "--resource-group":
        args.resourceGroup = value;
        break;
      case "--container-app":
        args.containerApp = value;
        break;
      case "--redis-host":
        args.redisHost = value;
        break;
      case "--redis-port":
        args.redisPort = Number(value);
        break;
      case "--scan-count":
        args.scanCount = Number(value);
        break;
      case "--stride":
        args.stride = Number(value);
        break;
      case "--margin":
        args.margin = Number(value);
        break;
      case "--y0":
        args.y0 = Number(value);
        break;
      case "--y1":
        args.y1 = Number(value);
        break;
      case "--artifact-out":
        args.artifactOut = path.resolve(value);
        break;
      case "--ts-out":
        args.tsOut = path.resolve(value);
        break;
      case "--max-outdoor-spawn-points":
        args.maxOutdoorSpawnPoints = Number(value);
        break;
      case "--max-caves":
        args.maxCaves = Number(value);
        break;
      case "--max-spawn-points-per-cave":
        args.maxSpawnPointsPerCave = Number(value);
        break;
      case "--min-cave-samples":
        args.minCaveSamples = Number(value);
        break;
      case "--help":
        usage();
        process.exit(0);
      default:
        throw new Error(`Unknown option: ${raw}`);
    }
  }

  if (!Number.isFinite(args.redisPort)) throw new Error("Invalid Redis port");
  if (!Number.isFinite(args.scanCount) || args.scanCount <= 0) {
    throw new Error("Invalid scan count");
  }
  if (!Number.isFinite(args.stride) || args.stride <= 0) {
    throw new Error("Invalid stride");
  }
  if (
    !Number.isFinite(args.y0) ||
    !Number.isFinite(args.y1) ||
    args.y0 >= args.y1
  ) {
    throw new Error("Invalid y bounds");
  }
  return args;
}

function usage() {
  console.log(`Usage:
  node scripts/harthmere/build-production-terrain-placement-map.cjs --write

Options:
  --resource-group=openai-resource-group
  --container-app=biomes-node-vnet
  --redis-host=20.127.78.175
  --redis-port=6379
  --stride=4
  --margin=96
  --y0=-64 --y1=160
  --artifact-out=artifacts/harthmere-production-placement-map/placement-map.json
  --ts-out=src/shared/harthmere/generated/production_terrain_placement_map.ts`);
}

function round(n, places = 3) {
  if (!Number.isFinite(n)) return n;
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

function vec3(pos) {
  return [round(Number(pos[0])), round(Number(pos[1])), round(Number(pos[2]))];
}

function xzKey(x, z) {
  return `${x}|${z}`;
}

function nodeKey(node) {
  return `${node.x}|${node.z}|${node.floorFeetY}`;
}

function runAzJson(args) {
  const result = childProcess.spawnSync("az", args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    return {
      ok: false,
      error: (result.stderr || result.stdout || "az command failed").trim(),
    };
  }
  try {
    return { ok: true, value: JSON.parse(result.stdout) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function readProductionMetadata(options) {
  const account = runAzJson(["account", "show", "--output", "json"]);
  const app = runAzJson([
    "containerapp",
    "show",
    "--resource-group",
    options.resourceGroup,
    "--name",
    options.containerApp,
    "--query",
    "{name:name,latestRevision:properties.latestRevisionName,fqdn:properties.configuration.ingress.fqdn,image:properties.template.containers[0].image,env:properties.template.containers[0].env}",
    "--output",
    "json",
  ]);

  const env = app.ok && Array.isArray(app.value.env) ? app.value.env : [];
  const envValue = (name) =>
    env.find((entry) => entry && entry.name === name)?.value;

  return {
    subscriptionId: account.ok ? account.value.id ?? "unknown" : "unknown",
    resourceGroup: options.resourceGroup,
    containerApp: options.containerApp,
    revision: app.ok ? app.value.latestRevision ?? "unknown" : "unknown",
    image: app.ok ? app.value.image ?? "unknown" : "unknown",
    fqdn: app.ok ? app.value.fqdn ?? "unknown" : "unknown",
    containerRedisHost: envValue("REDIS_HOST") ?? "unknown",
    azWarnings: [account, app]
      .filter((result) => !result.ok)
      .map((result) => result.error),
  };
}

function purposeForObjective(objective) {
  switch (objective?.type) {
    case "combat":
      return "monster";
    case "collect":
    case "craft":
    case "read":
      return "quest_item";
    case "talk":
      return "npc";
    case "inspect":
    case "choice":
    case "escort":
      return "interactable";
    default:
      return "quest_marker";
  }
}

function collectAuthoredPlacements() {
  const placements = [];
  const add = (entry) => {
    const worldPosition = vec3(entry.worldPosition ?? entry.authoredPosition);
    placements.push({
      key: `${entry.source}:${entry.id}`,
      source: entry.source,
      id: String(entry.id),
      label: String(entry.label ?? entry.id),
      purpose: entry.purpose ?? "quest_marker",
      authoredPosition: vec3(entry.authoredPosition ?? worldPosition),
      worldPosition,
      modeHint: entry.modeHint ?? "outdoor",
      notes: entry.notes,
    });
  };

  for (const quest of HARTHMERE_QUEST_CATALOG) {
    if (quest.location?.waypoint) {
      add({
        source: "quest_location",
        id: quest.id,
        label: `${quest.code ?? quest.id}: ${quest.title}`,
        purpose: "quest_marker",
        authoredPosition: quest.location.waypoint,
        worldPosition: shiftHarthmereAuthoredPositionToWorld(
          quest.location.waypoint
        ),
        modeHint: "outdoor",
      });
    }
    for (const objective of quest.objectives ?? []) {
      if (!objective.location?.waypoint) continue;
      add({
        source: "quest_objective",
        id: `${quest.id}:${objective.id}`,
        label: `${quest.code ?? quest.id}: ${objective.label}`,
        purpose: purposeForObjective(objective),
        authoredPosition: objective.location.waypoint,
        worldPosition: shiftHarthmereAuthoredPositionToWorld(
          objective.location.waypoint
        ),
        modeHint: "outdoor",
      });
    }
  }

  for (const space of HARTHMERE_MAIN_QUEST_SPACES) {
    for (const which of ["entry", "exit"]) {
      const point = space[which];
      if (!point) continue;
      const authored = [point.x, 54 + Number(point.yOffset ?? 0), point.z];
      add({
        source: "main_quest_space",
        id: `${space.id}:${which}`,
        label: `${space.name} ${which}`,
        purpose: space.underground ? "monster" : "interactable",
        authoredPosition: authored,
        worldPosition: shiftHarthmereAuthoredPositionToWorld(authored),
        modeHint: space.underground ? "cave" : "outdoor",
        notes: `questIds=${(space.questIds ?? []).join(",")}`,
      });
    }
  }

  for (const marker of harthmereJobsBoardQuestMarkerPositions()) {
    add({
      source: "jobs_board_marker",
      id: marker.markerId,
      label: marker.label,
      purpose: "quest_marker",
      authoredPosition: marker.position,
      worldPosition: marker.position,
      modeHint: marker.source === "exotic_matter_deposit" ? "cave" : "outdoor",
      notes: `markerSource=${marker.source}`,
    });
  }

  for (const seed of HARTHMERE_BUSINESS_OWNER_NPC_SEEDS) {
    add({
      source: "business_owner",
      id: seed.ownerNpcId,
      label: seed.displayName,
      purpose: "npc",
      authoredPosition: seed.position,
      worldPosition: seed.position,
      modeHint: "indoor",
    });
  }

  for (const seed of HARTHMERE_BUSINESS_CUSTOMER_NPC_SEEDS) {
    add({
      source: "business_customer",
      id: seed.customerNpcId,
      label: seed.displayName,
      purpose: "npc",
      authoredPosition: seed.position,
      worldPosition: seed.position,
      modeHint: "indoor",
    });
  }

  for (const seed of HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS) {
    add({
      source: "live_robot_sentinel",
      id: seed.seedId,
      label: seed.displayName,
      purpose: "npc",
      authoredPosition: seed.position,
      worldPosition: seed.position,
      modeHint: "outdoor",
    });
  }

  for (const seed of harthmereGroundedMuckMonsterSeedsInTerritory({
    useProductionPlacementMap: false,
  })) {
    add({
      source: "live_muck_monster",
      id: seed.seedId,
      label: seed.displayName,
      purpose: "monster",
      authoredPosition: seed.position,
      worldPosition: seed.position,
      modeHint: "outdoor",
      notes: `areaId=${seed.areaId}`,
    });
  }

  for (const seed of harthmereGroundedLivestockSeedsInTerritory({
    useProductionPlacementMap: false,
  })) {
    add({
      source: "live_livestock",
      id: seed.seedId,
      label: seed.displayName,
      purpose: "monster",
      authoredPosition: seed.position,
      worldPosition: seed.position,
      modeHint: "outdoor",
      notes: `areaId=${seed.areaId}`,
    });
  }

  for (const marker of harthmereExoticMatterDepositQuestMarkers()) {
    add({
      source: "exotic_matter_deposit",
      id: marker.markerId,
      label: marker.label,
      purpose: "quest_item",
      authoredPosition: marker.position,
      worldPosition: marker.position,
      modeHint: "cave",
    });
  }

  for (const cave of HARTHMERE_EXOTIC_MATTER_CAVES) {
    add({
      source: "known_cave_anchor",
      id: cave.caveId,
      label: cave.label,
      purpose: "spawn_pool",
      authoredPosition: cave.entrancePosition,
      worldPosition: cave.entrancePosition,
      modeHint: "cave",
    });
  }

  const unique = new Map();
  for (const placement of placements) {
    unique.set(placement.key, placement);
  }
  return [...unique.values()];
}

function boundsFromPlacements(placements, options) {
  const xs = [];
  const zs = [];
  for (const placement of placements) {
    xs.push(placement.worldPosition[0]);
    zs.push(placement.worldPosition[2]);
  }
  for (const cave of HARTHMERE_EXOTIC_MATTER_CAVES) {
    xs.push(cave.bounds.x0, cave.bounds.x1);
    zs.push(cave.bounds.z0, cave.bounds.z1);
  }
  const margin = Math.max(0, options.margin);
  return {
    x0: Math.floor(Math.min(...xs) - margin),
    x1: Math.ceil(Math.max(...xs) + margin),
    y0: Math.floor(options.y0),
    y1: Math.ceil(options.y1),
    z0: Math.floor(Math.min(...zs) - margin),
    z1: Math.ceil(Math.max(...zs) + margin),
  };
}

async function buildTerrainTensorMap(voxeloo, targetShards, options) {
  const redis = new Redis({
    host: options.redisHost,
    port: options.redisPort,
    lazyConnect: true,
  });
  await redis.connect();
  const found = new Map();
  let cursor = "0";
  let scanned = 0;
  do {
    const [next, keys] = await redis.scan(
      cursor,
      "MATCH",
      "b:*",
      "COUNT",
      String(options.scanCount)
    );
    cursor = next;
    scanned += keys.length;
    if (!keys.length) continue;
    const values = await redis.mgetBuffer(keys);
    for (let i = 0; i < values.length; i += 1) {
      const raw = values[i];
      if (!raw) continue;
      const id = Number(keys[i].slice(2));
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
      let terrain;
      let water;
      try {
        terrain = loadTerrain(voxeloo, {
          shard_seed: entity.shardSeed(),
          shard_diff: entity.hasShardDiff?.() ? entity.shardDiff() : undefined,
        });
        if (entity.hasShardWater?.()) {
          water = loadWater(voxeloo, entity);
        }
      } catch {
        terrain = undefined;
        water = undefined;
      }
      if (!terrain) continue;
      if (current?.terrain) {
        try {
          current.terrain.delete();
        } catch {}
      }
      if (current?.water) {
        try {
          current.water.delete();
        } catch {}
      }
      found.set(shardId, { tick, terrain, water });
    }
  } while (cursor !== "0");
  redis.disconnect();
  return { tensorByShard: found, scanned };
}

function createSamplers(tensorByShard) {
  const shardFor = (x, y, z) => tensorByShard.get(voxelShard(x, y, z));
  const terrainSolid = (x, y, z) => {
    const shard = shardFor(x, y, z);
    if (!shard?.terrain) return null;
    const id = shard.terrain.get(...blockPos(x, y, z));
    return id !== 0 && terrainCollides(id);
  };
  const waterSupport = (x, y, z) => {
    const shard = shardFor(x, y, z);
    if (!shard?.terrain) return null;
    if (!shard.water) return false;
    return Number(shard.water.get(...blockPos(x, y, z))) > 0;
  };
  const support = (x, y, z) => {
    const solid = terrainSolid(x, y, z);
    if (solid === null) return null;
    if (solid) return true;
    return waterSupport(x, y, z) === true;
  };
  return { terrainSolid, waterSupport, support };
}

function firstTerrainCeilingY(samplers, x, z, feetY, bounds) {
  const maxY = Math.min(bounds.y1, feetY + SKY_SCAN_LIMIT);
  for (let y = feetY + 2; y <= maxY; y += 1) {
    const solid = samplers.terrainSolid(x, y, z);
    if (solid === true) return y;
  }
  return undefined;
}

function columnInfoAt(samplers, x, z, bounds) {
  let sawData = false;
  const surfaces = [];
  for (let feetY = bounds.y0 + 1; feetY <= bounds.y1 - 2; feetY += 1) {
    const below = samplers.support(x, feetY - 1, z);
    const at = samplers.support(x, feetY, z);
    const above = samplers.support(x, feetY + 1, z);
    if (below !== null || at !== null || above !== null) sawData = true;
    if (below === true && at === false && above === false) {
      const ceilingY = firstTerrainCeilingY(samplers, x, z, feetY, bounds);
      const openSky = ceilingY === undefined;
      surfaces.push({
        feetY,
        openSky,
        ceilingY,
        clearance:
          ceilingY === undefined
            ? Math.max(0, bounds.y1 - feetY)
            : Math.max(0, ceilingY - feetY - 1),
      });
    }
  }
  const openSkySurfaces = surfaces.filter((surface) => surface.openSky);
  const surfaceFeetY = openSkySurfaces.length
    ? Math.max(...openSkySurfaces.map((surface) => surface.feetY))
    : surfaces.length
    ? Math.max(...surfaces.map((surface) => surface.feetY))
    : undefined;
  const caveSurfaces = surfaces.filter(
    (surface) =>
      !surface.openSky &&
      surface.clearance >= 3 &&
      surface.feetY < (surfaceFeetY ?? Number.POSITIVE_INFINITY) - 2
  );
  return {
    x,
    z,
    sawData,
    surfaces,
    surfaceFeetY,
    caveSurfaces,
  };
}

function nearestSurfaceFeetY(column, hintY) {
  if (!column.surfaces.length) return undefined;
  return column.surfaces.slice().sort((a, b) => {
    const da = Math.abs(a.feetY - hintY);
    const db = Math.abs(b.feetY - hintY);
    return da - db || b.feetY - a.feetY;
  })[0].feetY;
}

function nearestCaveFeetY(column, hintY) {
  if (!column.caveSurfaces.length) return undefined;
  return column.caveSurfaces.slice().sort((a, b) => {
    const da = Math.abs(a.feetY - hintY);
    const db = Math.abs(b.feetY - hintY);
    return da - db || b.clearance - a.clearance;
  })[0].feetY;
}

function resolvePlacement(placement, column) {
  const hintY = placement.worldPosition[1];
  const surfaceFeetY = column.surfaceFeetY;
  const nearestFeetY = nearestSurfaceFeetY(column, hintY);
  const caveFeetY = nearestCaveFeetY(column, hintY);
  let feetY;
  let placementMode;
  if (placement.modeHint === "cave") {
    feetY = caveFeetY ?? nearestFeetY ?? surfaceFeetY;
    placementMode =
      caveFeetY !== undefined ? "cave_spawn" : "indoor_or_cave_floor";
  } else if (placement.modeHint === "indoor") {
    feetY = nearestFeetY ?? surfaceFeetY;
    placementMode = "indoor_or_cave_floor";
  } else {
    feetY = surfaceFeetY ?? nearestFeetY;
    placementMode =
      feetY === surfaceFeetY ? "outdoor_surface" : "fallback_authored_y";
  }
  if (feetY === undefined) {
    feetY = hintY;
    placementMode = "fallback_authored_y";
  }
  return {
    key: placement.key,
    source: placement.source,
    id: placement.id,
    label: placement.label,
    purpose: placement.purpose,
    authoredPosition: placement.authoredPosition,
    worldPosition: placement.worldPosition,
    recommendedPosition: vec3([
      placement.worldPosition[0],
      feetY,
      placement.worldPosition[2],
    ]),
    placementMode,
    surfaceFeetY,
    nearestFeetY,
    caveFeetYs: column.caveSurfaces.map((surface) => surface.feetY),
    deltaY: round(feetY - hintY),
    notes: placement.notes,
  };
}

function sampleColumns(samplers, bounds, stride) {
  const columns = new Map();
  const rows = [];
  const caveNodes = [];
  for (let z = bounds.z0; z <= bounds.z1; z += stride) {
    const row = [];
    for (let x = bounds.x0; x <= bounds.x1; x += stride) {
      const column = columnInfoAt(samplers, x, z, bounds);
      columns.set(xzKey(x, z), column);
      if (column.surfaceFeetY !== undefined) {
        row.push({
          x,
          y: column.surfaceFeetY,
          caveFloorCount: column.caveSurfaces.length,
        });
      }
      for (const surface of column.caveSurfaces) {
        caveNodes.push({
          x,
          z,
          floorFeetY: surface.feetY,
          ceilingY: surface.ceilingY,
          clearance: surface.clearance,
        });
      }
    }
    rows.push({ z, samples: row });
  }
  return { columns, rows, caveNodes };
}

function buildSurfaceRows(rows, stride) {
  return rows.map((row) => {
    const runs = [];
    let current;
    for (const sample of row.samples) {
      if (
        current &&
        current.y === sample.y &&
        current.caveFloorCount === sample.caveFloorCount &&
        current.x1 + stride === sample.x
      ) {
        current.x1 = sample.x;
      } else {
        current = {
          x0: sample.x,
          x1: sample.x,
          y: sample.y,
          caveFloorCount: sample.caveFloorCount,
        };
        runs.push(current);
      }
    }
    return { z: row.z, runs };
  });
}

function clusterCaveNodes(caveNodes, columns, stride, options) {
  const byPosition = new Map();
  for (const node of caveNodes) {
    const key = xzKey(node.x, node.z);
    const list = byPosition.get(key) ?? [];
    list.push(node);
    byPosition.set(key, list);
  }
  const seen = new Set();
  const components = [];
  for (const start of caveNodes) {
    const startKey = nodeKey(start);
    if (seen.has(startKey)) continue;
    const queue = [start];
    const nodes = [];
    seen.add(startKey);
    while (queue.length) {
      const node = queue.shift();
      nodes.push(node);
      const neighborPositions = [
        [node.x + stride, node.z],
        [node.x - stride, node.z],
        [node.x, node.z + stride],
        [node.x, node.z - stride],
        [node.x, node.z],
      ];
      for (const [nx, nz] of neighborPositions) {
        for (const candidate of byPosition.get(xzKey(nx, nz)) ?? []) {
          const key = nodeKey(candidate);
          if (seen.has(key)) continue;
          if (
            Math.abs(candidate.floorFeetY - node.floorFeetY) <= CAVE_Y_TOLERANCE
          ) {
            seen.add(key);
            queue.push(candidate);
          }
        }
      }
    }
    if (nodes.length >= options.minCaveSamples) {
      components.push(nodes);
    }
  }

  return components
    .map((nodes, index) =>
      caveRecordFromNodes(nodes, columns, stride, index, options)
    )
    .sort((a, b) => b.sampleCount - a.sampleCount)
    .slice(0, options.maxCaves)
    .map((cave, index) => ({
      ...cave,
      caveId: `production_cave_${String(index + 1).padStart(2, "0")}`,
      label: cave.label.replace(
        /^Production Cave \d+/,
        `Production Cave ${index + 1}`
      ),
    }));
}

function caveRecordFromNodes(nodes, columns, stride, index, options) {
  const xs = nodes.map((node) => node.x);
  const zs = nodes.map((node) => node.z);
  const floors = nodes.map((node) => node.floorFeetY);
  const ceilings = nodes
    .map((node) => node.ceilingY)
    .filter((y) => y !== undefined);
  const entranceCandidates = [];
  for (const node of nodes) {
    const neighbors = [
      columns.get(xzKey(node.x + stride, node.z)),
      columns.get(xzKey(node.x - stride, node.z)),
      columns.get(xzKey(node.x, node.z + stride)),
      columns.get(xzKey(node.x, node.z - stride)),
    ].filter(Boolean);
    if (
      neighbors.some(
        (column) =>
          column.surfaceFeetY !== undefined &&
          Math.abs(column.surfaceFeetY - node.floorFeetY) <= 10
      )
    ) {
      entranceCandidates.push(vec3([node.x, node.floorFeetY, node.z]));
    }
  }

  const centerX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
  const centerZ = zs.reduce((sum, z) => sum + z, 0) / zs.length;
  const spawnPoints = nodes
    .slice()
    .sort((a, b) => {
      const da = Math.hypot(a.x - centerX, a.z - centerZ);
      const db = Math.hypot(b.x - centerX, b.z - centerZ);
      const scoreA = a.clearance * 10 - Math.abs(da - stride * 2);
      const scoreB = b.clearance * 10 - Math.abs(db - stride * 2);
      return scoreB - scoreA;
    })
    .slice(0, options.maxSpawnPointsPerCave)
    .map((node, spawnIndex) => ({
      position: vec3([node.x, node.floorFeetY, node.z]),
      floorFeetY: node.floorFeetY,
      clearance: node.clearance,
      score: round(node.clearance * 10 + spawnIndex),
    }));

  return {
    caveId: `production_cave_${String(index + 1).padStart(2, "0")}`,
    label: `Production Cave ${index + 1} (${Math.round(centerX)}, ${Math.round(
      centerZ
    )})`,
    bounds: {
      x0: Math.min(...xs),
      x1: Math.max(...xs),
      y0: Math.min(...floors),
      y1: Math.max(...ceilings, ...floors),
      z0: Math.min(...zs),
      z1: Math.max(...zs),
    },
    sampleCount: nodes.length,
    floorYMin: Math.min(...floors),
    floorYMax: Math.max(...floors),
    ceilingYMin: ceilings.length ? Math.min(...ceilings) : Math.max(...floors),
    ceilingYMax: ceilings.length ? Math.max(...ceilings) : Math.max(...floors),
    entranceCandidates: entranceCandidates.slice(0, 8),
    spawnPoints,
  };
}

function buildOutdoorSpawnPoints(columns, maxPoints) {
  const candidates = [];
  for (const column of columns.values()) {
    if (column.surfaceFeetY === undefined) continue;
    if (column.caveSurfaces.length > 1) continue;
    const position = vec3([column.x, column.surfaceFeetY, column.z]);
    const area = muckMonsterAreaForPosition(position, 1.5);
    candidates.push({
      id: `outdoor_${column.x}_${column.z}`,
      position,
      areaId: area?.id,
      score: area ? 2 : 1,
    });
  }
  const step = Math.max(1, Math.floor(candidates.length / maxPoints));
  return candidates
    .filter((_, index) => index % step === 0)
    .slice(0, maxPoints);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeGeneratedTs(file, map) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const json = JSON.stringify(map, null, 2);
  const text = `// Auto-generated by scripts/harthmere/build-production-terrain-placement-map.cjs.
// Do not edit by hand.

import type { HarthmereProductionTerrainPlacementMap } from "@/shared/harthmere/production_terrain_placement_map";

export const HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP_GENERATED_AT =
  ${JSON.stringify(map.generatedAtIso)} as const;

export const HARTHMERE_PRODUCTION_TERRAIN_PLACEMENT_MAP = ${json} as const satisfies HarthmereProductionTerrainPlacementMap;
`;
  fs.writeFileSync(file, text);
}

async function main() {
  const options = parseArgs(process.argv);
  const production = readProductionMetadata(options);
  const authoredPlacements = collectAuthoredPlacements();
  const bounds = boundsFromPlacements(authoredPlacements, options);
  const targetShards = new Set(
    shardsForAABB(
      [bounds.x0, bounds.y0, bounds.z0],
      [bounds.x1 + 1, bounds.y1 + 1, bounds.z1 + 1]
    )
  );

  console.error(
    JSON.stringify({
      phase: "production_metadata",
      production,
      redis: { host: options.redisHost, port: options.redisPort },
      bounds,
      authoredPlacements: authoredPlacements.length,
      targetTerrainShards: targetShards.size,
      stride: options.stride,
    })
  );

  const voxeloo = await loadVoxeloo();
  const { tensorByShard, scanned } = await buildTerrainTensorMap(
    voxeloo,
    targetShards,
    options
  );
  console.error(
    JSON.stringify({
      phase: "terrain_scan_complete",
      scannedRedisKeys: scanned,
      resolvedTerrainShards: tensorByShard.size,
      targetTerrainShards: targetShards.size,
    })
  );

  const samplers = createSamplers(tensorByShard);
  const { columns, rows, caveNodes } = sampleColumns(
    samplers,
    bounds,
    Math.floor(options.stride)
  );
  const resolvedPlacements = authoredPlacements.map((placement) => {
    const column = columnInfoAt(
      samplers,
      Math.floor(placement.worldPosition[0]),
      Math.floor(placement.worldPosition[2]),
      bounds
    );
    return resolvePlacement(placement, column);
  });
  const caves = clusterCaveNodes(
    caveNodes,
    columns,
    Math.floor(options.stride),
    options
  );
  const outdoorSpawnPoints = buildOutdoorSpawnPoints(
    columns,
    options.maxOutdoorSpawnPoints
  );
  const generatedAtIso = new Date().toISOString();
  const generatedMap = {
    version: VERSION,
    generatedAtIso,
    production: {
      subscriptionId: production.subscriptionId,
      resourceGroup: production.resourceGroup,
      containerApp: production.containerApp,
      revision: production.revision,
      image: production.image,
      fqdn: production.fqdn,
    },
    scan: {
      bounds,
      stride: Math.floor(options.stride),
      scannedRedisKeys: scanned,
      resolvedTerrainShards: tensorByShard.size,
      targetTerrainShards: targetShards.size,
    },
    placements: resolvedPlacements,
    caves,
    outdoorSpawnPoints,
  };
  const artifact = {
    ...generatedMap,
    production: {
      ...generatedMap.production,
      containerRedisHost: production.containerRedisHost,
      azWarnings: production.azWarnings,
      sampledRedisHost: options.redisHost,
      sampledRedisPort: options.redisPort,
    },
    surfaceRows: buildSurfaceRows(rows, Math.floor(options.stride)),
    stats: {
      sampledColumns: columns.size,
      caveFloorSamples: caveNodes.length,
      placementCount: resolvedPlacements.length,
      caveCount: caves.length,
      outdoorSpawnPointCount: outdoorSpawnPoints.length,
      fallbackPlacements: resolvedPlacements.filter(
        (placement) => placement.placementMode === "fallback_authored_y"
      ).length,
    },
  };

  if (options.write) {
    writeJson(options.artifactOut, artifact);
    writeGeneratedTs(options.tsOut, generatedMap);
  }

  for (const shard of tensorByShard.values()) {
    try {
      shard.terrain?.delete();
    } catch {}
    try {
      shard.water?.delete();
    } catch {}
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        wrote: options.write
          ? { artifactOut: options.artifactOut, tsOut: options.tsOut }
          : undefined,
        stats: artifact.stats,
        production: generatedMap.production,
        scan: generatedMap.scan,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
