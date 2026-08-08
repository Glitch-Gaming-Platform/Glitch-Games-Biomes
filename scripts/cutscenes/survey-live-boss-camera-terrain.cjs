#!/usr/bin/env node
"use strict";

/**
 * Read-only retained-world terrain/ambient survey for ordinary-map boss stills.
 *
 * It never writes Redis. It ranks nearby stage + camera pairs by:
 *   - a flat, open boss-sized support footprint;
 *   - a collision-free eased dolly;
 *   - clear lower/middle/upper silhouette rays;
 *   - distance from nearby ECS NPCs/animals and from the original stage.
 */

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");
process.env.IS_SERVER = process.env.IS_SERVER || "1";

const fs = require("fs");
const path = require("path");
const { Redis } = require("ioredis");
const {
  deserializeRedisEntityState,
} = require("../../src/server/shared/world/lua/serde");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const { loadTerrain } = require("../../src/shared/game/terrain");
const {
  terrainCollides,
} = require("../../src/shared/asset_defs/quirk_helpers");
const { blockPos, voxelShard } = require("../../src/shared/game/shard");
const {
  HARTHMERE_BOSS_PROMO_SPECS,
} = require("../../src/shared/cutscene/promo_scenes");
const {
  HARTHMERE_BOSS_VISUAL_ASSETS,
} = require("../../src/shared/harthmere/boss_visual_assets");
const {
  promoCameraDollySamples,
  promoCameraSightlineSamples,
} = require("../../src/shared/cutscene/promo_terrain_view");
const { samplePolyline } = require("../../src/shared/cutscene/math");

const ROOT = path.resolve(__dirname, "../..");
const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number(process.env.REDIS_PORT || 6493);
const SCAN_COUNT = Number(process.env.SCAN_COUNT || 3000);
const SURVEY_RADIUS = Number(process.env.BOSS_CAMERA_SURVEY_RADIUS || 72);
const STAGE_SURVEY_RADIUS = Number(
  process.env.BOSS_STAGE_SURVEY_RADIUS || 24
);

function parseArgs(argv) {
  const out = { bosses: [], output: undefined, limit: 20, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--boss") out.bosses.push(argv[++index]);
    else if (arg === "--output") out.output = argv[++index];
    else if (arg === "--limit") out.limit = Number(argv[++index]);
    else if (arg === "--json") out.json = true;
    else if (arg === "--help") {
      console.log(
        "Usage: survey-live-boss-camera-terrain.cjs --boss ID " +
          "[--boss ID] [--output report.json] [--limit 20] [--json]\n" +
          "Environment: REDIS_HOST=127.0.0.1 REDIS_PORT=6493"
      );
      process.exit(0);
    }
  }
  return out;
}

function normalizeBossId(value) {
  return value.replace(/^boss-/, "").replaceAll("-", "_");
}

function distance2d(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function terrainShardIntersects(box, centers) {
  return centers.some(
    (center) =>
      box.v1[0] >= center[0] - SURVEY_RADIUS &&
      box.v0[0] <= center[0] + SURVEY_RADIUS &&
      box.v1[2] >= center[2] - SURVEY_RADIUS &&
      box.v0[2] <= center[2] + SURVEY_RADIUS &&
      box.v1[1] >= center[1] - 64 &&
      box.v0[1] <= center[1] + 96
  );
}

async function readWorld(voxeloo, centers) {
  const redis = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    lazyConnect: true,
  });
  await redis.connect();
  const terrain = new Map();
  const ambient = [];
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
        let tick;
        let entity;
        try {
          [tick, entity] = deserializeRedisEntityState(id, raw);
        } catch {
          continue;
        }
        if (entity?.hasBox?.() && entity?.hasShardSeed?.()) {
          const box = entity.box();
          if (!terrainShardIntersects(box, centers)) continue;
          const shard = voxelShard(...box.v0);
          const existing = terrain.get(shard);
          if (existing && existing.tick >= tick) continue;
          let tensor;
          try {
            tensor = loadTerrain(voxeloo, {
              shard_seed: entity.shardSeed(),
              shard_diff: entity.hasShardDiff?.()
                ? entity.shardDiff()
                : undefined,
            });
          } catch {
            continue;
          }
          existing?.tensor?.delete?.();
          terrain.set(shard, { tick, tensor });
          continue;
        }
        if (!entity?.hasPosition?.()) continue;
        const position = entity.position()?.v;
        if (
          !position ||
          !centers.some(
            (center) => distance2d(position, center) <= SURVEY_RADIUS
          )
        ) {
          continue;
        }
        if (!entity.hasNpcMetadata?.() && !entity.hasLabel?.()) continue;
        ambient.push({
          id,
          label: entity.hasLabel?.()
            ? (entity.label()?.text ?? `entity-${id}`)
            : `entity-${id}`,
          position: [...position],
          npc: Boolean(entity.hasNpcMetadata?.()),
        });
      }
    } while (cursor !== "0");
  } finally {
    redis.disconnect();
  }
  return { terrain, ambient, scanned };
}

function samplers(terrain) {
  const loaded = (x, y, z) => terrain.has(voxelShard(x, y, z));
  const solid = (x, y, z) => {
    const shard = terrain.get(voxelShard(x, y, z));
    if (!shard?.tensor) return false;
    const id = shard.tensor.get(...blockPos(x, y, z));
    return id !== undefined && id !== 0 && terrainCollides(Number(id));
  };
  return { loaded, solid };
}

function surfaceFeetY(solid, x, z, hintY) {
  for (
    let feetY = Math.ceil(hintY + 36);
    feetY >= Math.floor(hintY - 48);
    feetY -= 1
  ) {
    if (
      solid(x, feetY - 1, z) &&
      !solid(x, feetY, z) &&
      !solid(x, feetY + 1, z)
    ) {
      return feetY;
    }
  }
  return undefined;
}

function stageFootprint(solid, spec, visual, x, z) {
  const radius = Math.max(
    0.75,
    Math.max(visual.worldSize[0], visual.worldSize[2]) / 2
  );
  const offsets = [
    [0, 0],
    [radius * 0.65, 0],
    [-radius * 0.65, 0],
    [0, radius * 0.65],
    [0, -radius * 0.65],
    [radius * 0.45, radius * 0.45],
    [radius * 0.45, -radius * 0.45],
    [-radius * 0.45, radius * 0.45],
    [-radius * 0.45, -radius * 0.45],
  ];
  const surfaces = offsets.map(([dx, dz]) =>
    surfaceFeetY(solid, Math.round(x + dx), Math.round(z + dz), spec.stage[1])
  );
  if (surfaces.some((value) => value === undefined)) return undefined;
  const min = Math.min(...surfaces);
  const max = Math.max(...surfaces);
  if (max - min > 1) return undefined;
  // Stage on the highest support under the complete footprint. Using only the
  // center sample can sink a wide boss into an adjacent one-block rise even
  // though the center itself looks grounded.
  const feetY = max;
  const height = Math.ceil(visual.worldSize[1]);
  for (const [dx, dz] of offsets) {
    for (let y = feetY; y <= feetY + height; y += 1) {
      if (solid(Math.round(x + dx), y, Math.round(z + dz))) return undefined;
    }
  }
  return { feetY, spread: max - min, radius };
}

const CAMERA_OFFSETS = [
  [0, 0, 0],
  [0.35, 0, 0],
  [-0.35, 0, 0],
  [0, 0.35, 0],
  [0, -0.35, 0],
  [0, 0, 0.35],
  [0, 0, -0.35],
];

function cameraTerrainClear(solid, clearance) {
  for (const position of promoCameraDollySamples(clearance)) {
    for (const offset of CAMERA_OFFSETS) {
      const point = add(position, offset).map(Math.floor);
      if (solid(...point)) return false;
    }
  }
  for (const {
    camera,
    target,
    distance,
    checkUntil,
  } of promoCameraSightlineSamples(clearance)) {
    for (let along = 0.5; along < checkUntil; along += 0.25) {
      const t = along / distance;
      const point = camera.map((value, axis) =>
        Math.floor(value + (target[axis] - value) * t)
      );
      if (solid(...point)) return false;
    }
  }
  return true;
}

function nearestAmbient(ambient, stage) {
  return ambient
    .map((entry) => ({ ...entry, distance: distance2d(entry.position, stage) }))
    .sort((a, b) => a.distance - b.distance);
}

function framedNpcClutter(ambient, camera, stage, verticalFov, bodyRadius) {
  const dx = stage[0] - camera[0];
  const dz = stage[2] - camera[2];
  const targetDistance = Math.hypot(dx, dz);
  if (targetDistance < 0.001) return [];
  const forward = [dx / targetDistance, dz / targetDistance];
  const horizontalFov =
    2 * Math.atan(Math.tan((verticalFov * Math.PI) / 360) * (16 / 9));
  return ambient
    .filter((entry) => entry.npc)
    .flatMap((entry) => {
      const rx = entry.position[0] - camera[0];
      const rz = entry.position[2] - camera[2];
      const along = rx * forward[0] + rz * forward[1];
      if (along <= 0 || along > targetDistance + bodyRadius * 1.5) return [];
      const perpendicular = Math.abs(rx * forward[1] - rz * forward[0]);
      const halfWidth = Math.max(0.8, Math.tan(horizontalFov / 2) * along);
      const edgePadding = 0.9;
      if (perpendicular > halfWidth + edgePadding) return [];
      const centrality = Math.max(
        0,
        1 - perpendicular / (halfWidth + edgePadding)
      );
      const depthWeight =
        along < targetDistance - bodyRadius
          ? 2
          : along <= targetDistance + bodyRadius
            ? 1.5
            : 0.75;
      return [
        {
          ...entry,
          along: Number(along.toFixed(3)),
          perpendicular: Number(perpendicular.toFixed(3)),
          obstruction: Number((centrality * depthWeight).toFixed(3)),
        },
      ];
    })
    .sort((a, b) => b.obstruction - a.obstruction);
}

function surveyBoss(spec, visual, solid, ambient, limit) {
  const rows = [];
  const maxStageOffset = Math.max(
    spec.id === "hex_wraith" ? 20 : 16,
    STAGE_SURVEY_RADIUS
  );
  const stageStep = 4;
  for (let dx = -maxStageOffset; dx <= maxStageOffset; dx += stageStep) {
    for (let dz = -maxStageOffset; dz <= maxStageOffset; dz += stageStep) {
      const x = spec.stage[0] + dx;
      const z = spec.stage[2] + dz;
      if (
        distance2d([x, spec.stage[1], z], spec.stage) > STAGE_SURVEY_RADIUS
      ) {
        continue;
      }
      const support = stageFootprint(solid, spec, visual, x, z);
      if (!support) continue;
      const stage = [x, support.feetY + 0.05, z];
      const nearby = nearestAmbient(ambient, stage);
      const nearbyNpcs = nearby.filter((entry) => entry.npc);
      const ambientClearance = nearbyNpcs[0]?.distance ?? 999;
      const bodyRadius = Math.hypot(...visual.worldSize) / 2;
      for (const degrees of Array.from({ length: 16 }, (_, i) => i * 22.5)) {
        const radians = (degrees * Math.PI) / 180;
        for (const farRadius of [
          Math.max(10, bodyRadius * 2),
          Math.max(14, bodyRadius * 2.6),
          Math.max(18, bodyRadius * 3.2),
        ]) {
          const nearRadius = Math.max(bodyRadius * 1.55, farRadius - 4);
          const rise = Math.max(3.8, visual.worldSize[1] * 0.9);
          const cameraFar = [
            stage[0] + Math.cos(radians) * farRadius,
            stage[1] + rise,
            stage[2] + Math.sin(radians) * farRadius,
          ];
          const cameraNear = [
            stage[0] + Math.cos(radians) * nearRadius,
            stage[1] + rise - 1.2,
            stage[2] + Math.sin(radians) * nearRadius,
          ];
          const target = [
            stage[0],
            stage[1] + visual.worldSize[1] * 0.5,
            stage[2],
          ];
          const fov =
            visual.worldSize[1] > 10 ? 44 : visual.worldSize[0] > 6 ? 40 : 35;
          const clearance = {
            cameraFar,
            cameraNear,
            target,
            sightlineTargets: [0.12, 0.5, 0.88].map((fraction) => [
              stage[0],
              stage[1] + visual.worldSize[1] * fraction,
              stage[2],
            ]),
            bossBodyRadius: bodyRadius,
          };
          if (!cameraTerrainClear(solid, clearance)) continue;
          // The registered boss still captures at 2.05s in a 4.5s shot. Rank
          // clutter from that exact eased camera position, rather than either
          // endpoint, so the offline recommendation matches the saved frame.
          const capturePosition = samplePolyline(
            [cameraFar, cameraNear],
            2.05 / 4.5,
            "easeInOut"
          ).position;
          const framedAmbient = framedNpcClutter(
            ambient,
            capturePosition,
            stage,
            fov,
            bodyRadius
          );
          const framedObstruction = framedAmbient.reduce(
            (sum, entry) => sum + entry.obstruction,
            0
          );
          const stageDistance = distance2d(stage, spec.stage);
          const score =
            ambientClearance * 4 -
            stageDistance -
            Math.abs(farRadius - bodyRadius * 2.5) -
            framedObstruction * 24 -
            support.spread * 8;
          rows.push({
            score: Number(score.toFixed(3)),
            stage: stage.map((value) => Number(value.toFixed(3))),
            cameraFar: cameraFar.map((value) => Number(value.toFixed(3))),
            cameraNear: cameraNear.map((value) => Number(value.toFixed(3))),
            capturePosition: capturePosition.map((value) =>
              Number(value.toFixed(3))
            ),
            orbitDegrees: degrees,
            fov,
            footprintSpread: support.spread,
            ambientClearance: Number(ambientClearance.toFixed(3)),
            framedObstruction: Number(framedObstruction.toFixed(3)),
            framedAmbient: framedAmbient.slice(0, 5),
            nearestAmbient: nearbyNpcs.slice(0, 5).map((entry) => ({
              id: entry.id,
              label: entry.label,
              position: entry.position,
              distance: Number(entry.distance.toFixed(3)),
            })),
          });
        }
      }
    }
  }
  return rows.sort((a, b) => b.score - a.score).slice(0, limit);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.bosses.length) throw new Error("at least one --boss is required");
  const specs = args.bosses.map((value) => {
    const id = normalizeBossId(value);
    const spec = HARTHMERE_BOSS_PROMO_SPECS.find(
      (candidate) => candidate.id === id
    );
    if (!spec) throw new Error(`unknown boss ${value}`);
    if (spec.dungeonId) {
      throw new Error(
        `${id} uses canonical dungeon preflight, not retained-world survey`
      );
    }
    const visual = HARTHMERE_BOSS_VISUAL_ASSETS.find(
      (candidate) => candidate.id === id
    );
    if (!visual) throw new Error(`missing visual bounds for ${id}`);
    return { spec, visual };
  });
  const voxeloo = await loadVoxeloo();
  const world = await readWorld(
    voxeloo,
    specs.map(({ spec }) => spec.stage)
  );
  const { solid } = samplers(world.terrain);
  const bosses = specs.map(({ spec, visual }) => ({
    bossId: spec.id,
    originalStage: spec.stage,
    worldSize: visual.worldSize,
    nearbyAmbient: nearestAmbient(world.ambient, spec.stage).slice(0, 20),
    candidates: surveyBoss(spec, visual, solid, world.ambient, args.limit),
  }));
  const report = {
    generatedAt: new Date().toISOString(),
    kind: "read-only-retained-world-boss-camera-survey",
    redis: { host: REDIS_HOST, port: REDIS_PORT },
    scannedRedisEntities: world.scanned,
    terrainShardsLoaded: world.terrain.size,
    bosses,
  };
  for (const { tensor } of world.terrain.values()) tensor?.delete?.();
  const encoded = `${JSON.stringify(report, null, 2)}\n`;
  if (args.output) {
    const output = path.resolve(ROOT, args.output);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, encoded);
    console.log(`wrote ${path.relative(ROOT, output)}`);
  }
  if (args.json || !args.output) {
    console.log(encoded);
  } else {
    for (const boss of bosses) {
      const best = boss.candidates[0];
      console.log(
        `${boss.bossId}: stage=${best?.stage.join(",") ?? "none"} ` +
          `orbit=${best?.orbitDegrees ?? "none"} ` +
          `framedNpcObstruction=${best?.framedObstruction ?? "none"} ` +
          `ambientClearance=${best?.ambientClearance ?? "none"}`
      );
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
