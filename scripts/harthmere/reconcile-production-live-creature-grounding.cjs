#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

process.env.IS_SERVER = process.env.IS_SERVER || "1";

const { chunk } = require("lodash");
const { execFileSync } = require("node:child_process");
const { Redis } = require("ioredis");
const {
  buildHarthmereLiveCreatureEntity,
} = require("../../src/server/harthmere/live_entity_ecs_seed");
const {
  connectToRedisWithLua,
} = require("../../src/server/shared/redis/connection");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const { RedisWorld } = require("../../src/server/shared/world/redis");
const {
  deserializeRedisEntityState,
  unpackFromRedis,
} = require("../../src/server/shared/world/lua/serde");
const {
  terrainCollides,
} = require("../../src/shared/asset_defs/quirk_helpers");
const {
  NpcMetadata,
  Position,
  Size,
} = require("../../src/shared/ecs/gen/components");
const { blockPos, voxelShard } = require("../../src/shared/game/shard");
const { loadTerrain } = require("../../src/shared/game/terrain");
const {
  harthmereLiveEntityIsTownLivestock,
  harthmereLiveEntityIsOpenWildsMixedGroup,
  harthmereLiveEntitySizeForSeed,
  harthmereMuckMonsterPositionIsInSafeZone,
  harthmereOpenWildsGroundingPositionIsValidForSeed,
  harthmereRespawningLiveCreatureSeeds,
} = require("../../src/shared/harthmere/live_entity_production_seed");
const {
  isPositionInsideHarthmereIndiswormCave,
} = require("../../src/shared/harthmere/indisworm_spawns");
const {
  muckMonsterAreaForPosition,
} = require("../../src/shared/harthmere/muck_monster_aggression_ai");
const {
  HARTHMERE_EXTENSION_FEET_Y,
  isHarthmereExtensionWorldPosition,
} = require("../../src/shared/harthmere/world_extension");

const APPLY = process.env.APPLY === "1";
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
  Number.parseInt(process.env.SCAN_COUNT || "3000", 10)
);
const APPLY_BATCH_SIZE = Math.max(
  1,
  Number.parseInt(
    process.env.HARTHMERE_CREATURE_GROUNDING_BATCH_SIZE || "100",
    10
  )
);
const PROBE_BOTTOM_Y = -16;
const PROBE_TOP_Y = 180;
const POSITION_TOLERANCE = 0.25;
const SIZE_TOLERANCE = 0.01;
const FRESH_READBACK_MARKER = "HARTHMERE_CREATURE_FRESH_READBACK=";
const SCOPED_SEED_IDS = new Set(
  String(process.env.HARTHMERE_CREATURE_GROUNDING_SEED_IDS || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
);

function redisOptions() {
  return { host: REDIS_HOST, port: REDIS_PORT, lazyConnect: true };
}

function distance3(a, b) {
  if (!a || !b) return Infinity;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function sameSize(a, b) {
  return (
    Boolean(a && b) &&
    a.length === 3 &&
    a.every((value, index) => Math.abs(value - b[index]) <= SIZE_TOLERANCE)
  );
}

function decodeEntity(id, raw) {
  if (!raw) return undefined;
  try {
    return deserializeRedisEntityState(id, raw)[1];
  } catch {
    return undefined;
  }
}

function creatureUsesFlatExtensionSurface(seed) {
  return (
    harthmereLiveEntityIsTownLivestock(seed) ||
    (seed.kind === "ambient_bandit" &&
      isHarthmereExtensionWorldPosition(seed.position))
  );
}

function creatureUsesAuthoredEncounterPosition(seed) {
  return (
    seed.caveId !== undefined || seed.areaId?.startsWith("remote_corner_apex_")
  );
}

function validCreatureXZ(seed, position) {
  if (!position) return false;
  if (seed.caveId !== undefined) {
    return isPositionInsideHarthmereIndiswormCave(seed.caveId, position);
  }
  if (creatureUsesFlatExtensionSurface(seed)) {
    return isHarthmereExtensionWorldPosition(position);
  }
  // Open-world groups deliberately live outside Muck containment. Their legal
  // contract is geometric: stay near the authored encounter, outside every
  // protected/business/building area, west of additive Harthmere, and away from
  // Muck territories occupied by the resident families. Requiring these seeds
  // to be inside Muck made the required deploy grounding pass reject every
  // relocation before it could probe terrain support.
  if (harthmereLiveEntityIsOpenWildsMixedGroup(seed)) {
    return harthmereOpenWildsGroundingPositionIsValidForSeed(seed, position);
  }
  if (seed.kind === "ambient_bandit") {
    return (
      !isHarthmereExtensionWorldPosition(position) &&
      Math.hypot(
        position[0] - seed.position[0],
        position[2] - seed.position[2]
      ) <= 24
    );
  }
  return (
    !isHarthmereExtensionWorldPosition(position) &&
    !harthmereMuckMonsterPositionIsInSafeZone(position) &&
    Boolean(muckMonsterAreaForPosition(position, 1.5))
  );
}

async function loadCreatureRows(redis, seeds) {
  const values = await redis.mgetBuffer(
    seeds.map((seed) => `b:${Number(seed.entityId)}`)
  );
  return seeds.map((seed, index) => {
    const raw = values[index];
    const entity = decodeEntity(Number(seed.entityId), raw);
    const current = entity?.hasPosition?.() ? entity.position()?.v : undefined;
    const spawn = entity?.hasNpcMetadata?.()
      ? entity.npcMetadata()?.spawn_position
      : undefined;
    const currentXZIsValid = validCreatureXZ(seed, current);
    const sourcePosition = currentXZIsValid ? current : seed.position;
    return {
      seed,
      rawExists: Boolean(raw),
      entity,
      current,
      spawn,
      size: entity?.hasSize?.() ? entity.size()?.v : undefined,
      hp: entity?.hasHealth?.() ? Number(entity.health()?.hp) : undefined,
      hasExpires: Boolean(entity?.hasExpires?.()),
      currentXZIsValid,
      sourcePosition,
    };
  });
}

function targetShardsForRows(rows) {
  const shards = new Set();
  for (const row of rows) {
    for (const position of [row.sourcePosition, row.seed.position]) {
      for (const [dx, dz] of [
        [0, 0],
        [-10, -10],
        [-10, 10],
        [10, -10],
        [10, 10],
      ]) {
        for (let y = PROBE_BOTTOM_Y; y <= PROBE_TOP_Y; y += 16) {
          shards.add(
            voxelShard(
              Math.floor(position[0] + dx),
              y,
              Math.floor(position[2] + dz)
            )
          );
        }
      }
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
        const previous = found.get(shardId);
        if (previous && previous.tick >= tick) continue;
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
        previous?.tensor?.delete?.();
        found.set(shardId, { tick, tensor });
      }
    } while (cursor !== "0");
  } finally {
    redis.disconnect();
  }
  console.error(
    JSON.stringify({
      phase: "creature_terrain_scan",
      scanned,
      targetShards: targetShards.size,
      resolvedShards: found.size,
    })
  );
  return found;
}

function makeSolidSampler(tensorByShard) {
  return (x, y, z) => {
    const shard = tensorByShard.get(voxelShard(x, y, z));
    if (!shard?.tensor) return false;
    const id = Number(shard.tensor.get(...blockPos(x, y, z)));
    return Boolean(id) && terrainCollides(id);
  };
}

function footprintColumns(position, size) {
  const halfX = Math.max(0, size[0] * 0.45);
  const halfZ = Math.max(0, size[2] * 0.45);
  const points = [
    [position[0], position[2]],
    [position[0] - halfX, position[2] - halfZ],
    [position[0] - halfX, position[2] + halfZ],
    [position[0] + halfX, position[2] - halfZ],
    [position[0] + halfX, position[2] + halfZ],
  ];
  return [
    ...new Map(
      points.map(([x, z]) => {
        const column = [Math.floor(x), Math.floor(z)];
        return [`${column[0]}:${column[1]}`, column];
      })
    ).values(),
  ];
}

function positionColumnKey(position) {
  return `${Math.floor(position[0])}:${Math.floor(position[2])}`;
}

function bodyCanStandAt(solid, position, feetY, size) {
  const bodyBlocks = Math.max(1, Math.ceil(size[1]));
  for (const [x, z] of footprintColumns(position, size)) {
    if (!solid(x, feetY - 1, z)) return false;
    for (let y = feetY; y < feetY + bodyBlocks; y += 1) {
      if (solid(x, y, z)) return false;
    }
  }
  return true;
}

function supportedSurfaceTargetNear(
  seed,
  position,
  size,
  solid,
  targetColumnIsAvailable
) {
  const offsets = [];
  for (let dx = -10; dx <= 10; dx += 1) {
    for (let dz = -10; dz <= 10; dz += 1) {
      offsets.push([dx, dz]);
    }
  }
  offsets.sort(
    ([ax, az], [bx, bz]) =>
      ax * ax + az * az - (bx * bx + bz * bz) || ax - bx || az - bz
  );
  for (const [dx, dz] of offsets) {
    const x = position[0] + dx;
    const z = position[2] + dz;
    if (creatureUsesFlatExtensionSurface(seed)) {
      const target = [x, HARTHMERE_EXTENSION_FEET_Y, z];
      if (
        validCreatureXZ(seed, target) &&
        targetColumnIsAvailable(target) &&
        bodyCanStandAt(solid, target, HARTHMERE_EXTENSION_FEET_Y, size)
      ) {
        return target;
      }
      continue;
    }

    // Original-map terrain is hilly and can contain caves below the surface.
    // Scan top-down so a creature is placed on the outdoor surface rather than
    // on a lower cave floor, then validate its whole body footprint and air.
    for (let feetY = PROBE_TOP_Y; feetY >= PROBE_BOTTOM_Y; feetY -= 1) {
      const target = [x, feetY, z];
      if (
        validCreatureXZ(seed, target) &&
        targetColumnIsAvailable(target) &&
        bodyCanStandAt(solid, target, feetY, size)
      ) {
        return target;
      }
    }
  }
  return undefined;
}

function resolveTarget(row, solid, targetColumnIsAvailable) {
  const size = harthmereLiveEntitySizeForSeed(row.seed);
  // Cavern Indisworms are authored inside enclosed underground encounter
  // volumes, and remote-corner apex bosses use audited production spawn
  // points outside the canonical terrain-shard domain. Neither class should
  // be projected onto the highest outdoor surface by this grounding repair.
  if (creatureUsesAuthoredEncounterPosition(row.seed)) {
    const target = [...row.seed.position];
    return {
      target: validCreatureXZ(row.seed, target) ? target : undefined,
      size,
      relocatedToCanonical: true,
    };
  }
  const candidates = [row.sourcePosition, row.seed.position];
  for (let index = 0; index < candidates.length; index += 1) {
    const target = supportedSurfaceTargetNear(
      row.seed,
      candidates[index],
      size,
      solid,
      targetColumnIsAvailable
    );
    if (target) {
      return {
        target,
        size,
        relocatedToCanonical: index > 0 || !row.currentXZIsValid,
      };
    }
  }
  return { target: undefined, size, relocatedToCanonical: false };
}

function repairReasons(row, resolution) {
  const reasons = [];
  if (!row.entity || !row.current) reasons.push("missing_or_unpositioned");
  if (row.hp === undefined || row.hp <= 0)
    reasons.push("dead_or_missing_health");
  if (!row.currentXZIsValid) reasons.push("outside_authored_creature_bounds");
  if (!resolution.target) reasons.push("no_supported_terrain");
  if (
    resolution.target &&
    distance3(row.current, resolution.target) > POSITION_TOLERANCE
  ) {
    reasons.push("floating_buried_or_wrong_xz");
  }
  if (
    resolution.target &&
    distance3(row.spawn, resolution.target) > POSITION_TOLERANCE
  ) {
    reasons.push("respawn_anchor_not_grounded");
  }
  if (!sameSize(row.size, resolution.size)) reasons.push("wrong_body_size");
  if (row.hasExpires && (row.hp ?? 0) > 0) reasons.push("live_entity_expiring");
  return reasons;
}

function changeForRepair(row, resolution, nowSeconds) {
  const target = resolution.target;
  const built = buildHarthmereLiveCreatureEntity(row.seed, nowSeconds);
  const metadata = built.npc_metadata;
  const entity = {
    ...built,
    position: Position.create({ v: target }),
    size: Size.create({ v: resolution.size }),
    npc_metadata: NpcMetadata.create({
      type_id: metadata?.type_id,
      spawn_position: target,
      spawn_orientation: metadata?.spawn_orientation,
      created_time: metadata?.created_time,
      spawn_event_id: metadata?.spawn_event_id,
      spawn_event_type_id: metadata?.spawn_event_type_id,
    }),
    expires: null,
  };
  return row.rawExists
    ? { kind: "update", entity }
    : { kind: "create", entity };
}

async function applyRepairs(rows, resolutions) {
  const repairPlans = rows
    .map((row, index) => ({
      row,
      resolution: resolutions[index],
      reasons: repairReasons(row, resolutions[index]),
    }))
    .filter((plan) => plan.reasons.length > 0);
  const impossible = repairPlans.filter((plan) => !plan.resolution.target);
  if (impossible.length) {
    throw new Error(
      `No supported terrain for ${impossible.length} creature(s): ${impossible
        .slice(0, 8)
        .map((plan) => plan.row.seed.seedId)
        .join(",")}`
    );
  }
  if (!APPLY || repairPlans.length === 0) {
    return { repairPlans, applied: 0 };
  }

  const world = new RedisWorld(await connectToRedisWithLua("ecs"));
  let applied = 0;
  try {
    await world.waitForHealthy();
    const nowSeconds = Math.floor(Date.now() / 1000);
    for (const batch of chunk(repairPlans, APPLY_BATCH_SIZE)) {
      await world.apply({
        changes: batch.map((plan) =>
          changeForRepair(plan.row, plan.resolution, nowSeconds)
        ),
      });
      applied += batch.length;
    }
  } finally {
    await world.stop?.();
  }
  return { repairPlans, applied };
}

async function emitFreshReadback() {
  const allSeeds = harthmereRespawningLiveCreatureSeeds();
  const seeds = SCOPED_SEED_IDS.size
    ? allSeeds.filter((seed) => SCOPED_SEED_IDS.has(Number(seed.entityId)))
    : allSeeds;
  const redis = new Redis(redisOptions());
  await redis.connect();
  try {
    const rows = await loadCreatureRows(redis, seeds);
    console.log(
      FRESH_READBACK_MARKER +
        JSON.stringify(
          rows.map((row) => ({
            id: Number(row.seed.entityId),
            entityExists: Boolean(row.entity),
            current: row.current,
            spawn: row.spawn,
            size: row.size,
            hp: row.hp,
            hasExpires: row.hasExpires,
          }))
        )
    );
  } finally {
    redis.disconnect();
  }
}

function loadFreshReadbackRows(seeds) {
  const output = execFileSync(process.execPath, [__filename], {
    encoding: "utf8",
    env: {
      ...process.env,
      HARTHMERE_CREATURE_GROUNDING_FRESH_READBACK: "1",
    },
    maxBuffer: 16 * 1024 * 1024,
  });
  const markerIndex = output.lastIndexOf(FRESH_READBACK_MARKER);
  if (markerIndex < 0) {
    throw new Error("Fresh creature readback subprocess returned no payload");
  }
  const rowsById = new Map(
    JSON.parse(
      output.slice(markerIndex + FRESH_READBACK_MARKER.length).trim()
    ).map((row) => [Number(row.id), row])
  );
  return seeds.map((seed) => ({
    seed,
    ...rowsById.get(Number(seed.entityId)),
    currentXZIsValid: validCreatureXZ(
      seed,
      rowsById.get(Number(seed.entityId))?.current
    ),
  }));
}

async function verifyReadbackOnce(seeds, targetById, solid) {
  // Decode fatal post-apply evidence in a fresh process. The exact-r2 fixture
  // exposed a process-local stale component view immediately after Lua apply:
  // HP/expiry were new while position/size were from the pre-repair entity.
  // A clean process read the same persisted key correctly. The deployment gate
  // must validate persisted Redis, not fail on that mixed in-process decode.
  const rows = loadFreshReadbackRows(seeds);
  const failures = [];
  for (const row of rows) {
    const target = targetById.get(Number(row.seed.entityId));
    const expectedSize = harthmereLiveEntitySizeForSeed(row.seed);
    if (
      !row.entityExists ||
      !row.current ||
      !target ||
      row.hp === undefined ||
      row.hp <= 0 ||
      distance3(row.current, target) > POSITION_TOLERANCE ||
      distance3(row.spawn, target) > POSITION_TOLERANCE ||
      !sameSize(row.size, expectedSize) ||
      !validCreatureXZ(row.seed, row.current) ||
      (!creatureUsesAuthoredEncounterPosition(row.seed) &&
        !bodyCanStandAt(solid, row.current, row.current[1], expectedSize)) ||
      row.hasExpires
    ) {
      failures.push({
        id: Number(row.seed.entityId),
        seedId: row.seed.seedId,
        expected: target,
        current: row.current,
        spawn: row.spawn,
        size: row.size,
        hp: row.hp,
        hasExpires: row.hasExpires,
      });
    }
  }
  return failures;
}

async function verifyReadback(seeds, targetById, solid) {
  return verifyReadbackOnce(seeds, targetById, solid);
}

async function main() {
  const allSeeds = harthmereRespawningLiveCreatureSeeds();
  const seeds = SCOPED_SEED_IDS.size
    ? allSeeds.filter((seed) => SCOPED_SEED_IDS.has(Number(seed.entityId)))
    : allSeeds;
  if (SCOPED_SEED_IDS.size && seeds.length !== SCOPED_SEED_IDS.size) {
    const found = new Set(seeds.map((seed) => Number(seed.entityId)));
    const missing = [...SCOPED_SEED_IDS].filter((id) => !found.has(id));
    throw new Error(`Unknown scoped creature seed ids: ${missing.join(",")}`);
  }
  if (SCOPED_SEED_IDS.size) {
    console.error(
      JSON.stringify({
        phase: "creature_grounding_scope",
        seedIds: seeds.map((seed) => Number(seed.entityId)),
      })
    );
  }
  const redis = new Redis(redisOptions());
  await redis.connect();
  const voxeloo = await loadVoxeloo();
  let terrainByShard;
  try {
    const rows = await loadCreatureRows(redis, seeds);
    terrainByShard = await buildTerrainTensorMap(
      voxeloo,
      targetShardsForRows(rows)
    );
    const solid = makeSolidSampler(terrainByShard);
    // Resolve in manifest order (all Muckers/Hexes before livestock) and reserve
    // their final columns as we go. A terrain probe may move a creature by a few
    // blocks to find complete body support, but that search must never move an
    // open-Wilds relocation onto a Mucker/Hexer column. The reverse reservation
    // also protects an earlier open-Wilds monster from a later hostile family.
    const hostileColumns = new Set();
    const openWildsColumns = new Set();
    const resolutions = [];
    for (const row of rows) {
      const isHostile = row.seed.kind === "ambient_muck_monster";
      const isOpenWilds = harthmereLiveEntityIsOpenWildsMixedGroup(row.seed);
      const resolution = resolveTarget(row, solid, (target) => {
        const column = positionColumnKey(target);
        return !(
          (isOpenWilds && hostileColumns.has(column)) ||
          (isHostile && openWildsColumns.has(column))
        );
      });
      resolutions.push(resolution);
      if (resolution.target) {
        const column = positionColumnKey(resolution.target);
        if (isHostile) hostileColumns.add(column);
        if (isOpenWilds) openWildsColumns.add(column);
      }
    }
    const targetById = new Map(
      rows.map((row, index) => [
        Number(row.seed.entityId),
        resolutions[index].target,
      ])
    );
    const result = await applyRepairs(rows, resolutions);
    const failures = await verifyReadback(seeds, targetById, solid);
    const byReason = {};
    for (const plan of result.repairPlans) {
      for (const reason of plan.reasons) {
        byReason[reason] = (byReason[reason] || 0) + 1;
      }
    }
    const hostileSeeds = seeds.filter(
      (seed) => seed.kind === "ambient_muck_monster"
    );
    const muckers = hostileSeeds.filter((seed) => seed.combatKind !== "hex");
    const hexes = hostileSeeds.filter((seed) => seed.combatKind === "hex");
    const animals = seeds.filter((seed) => seed.kind === "ambient_livestock");
    const bandits = seeds.filter((seed) => seed.kind === "ambient_bandit");
    const cavernIndisworms = seeds.filter((seed) => seed.caveId !== undefined);
    const townAnimals = animals.filter(harthmereLiveEntityIsTownLivestock);
    const wildAnimals = animals.filter(
      (seed) => !harthmereLiveEntityIsTownLivestock(seed)
    );
    const familyCounts = (plans) => ({
      cavernIndisworms: plans.filter(
        (entry) => (entry.row?.seed ?? entry.seed)?.caveId !== undefined
      ).length,
      otherCreatures: plans.filter(
        (entry) => (entry.row?.seed ?? entry.seed)?.caveId === undefined
      ).length,
    });
    console.log(
      JSON.stringify(
        {
          apply: APPLY,
          expected: {
            total: seeds.length,
            muckers: muckers.length,
            hexes: hexes.length,
            animals: animals.length,
            wildAnimals: wildAnimals.length,
            townAnimals: townAnimals.length,
            bandits: bandits.length,
            cavernIndisworms: cavernIndisworms.length,
          },
          repairPlanned: result.repairPlans.length,
          repairPlannedByFamily: familyCounts(result.repairPlans),
          repairApplied: result.applied,
          repairReasons: byReason,
          unresolvedAfterReadback: failures.length,
          unresolvedByFamily: familyCounts(
            failures.map((failure) => ({
              seed: seeds.find(
                (seed) => Number(seed.entityId) === Number(failure.id)
              ),
            }))
          ),
          failureSamples: failures.slice(0, 8),
        },
        null,
        2
      )
    );
    if (failures.length) {
      throw new Error(
        `${failures.length} Harthmere creature(s) remain missing, dead, floating, buried, wrongly sized, or outside their authored creature bounds`
      );
    }
    console.log(
      `OK all ${muckers.length + hexes.length} Muckers/Hexes, ${
        wildAnimals.length
      } original-map wildlife, ${
        townAnimals.length
      } Harthmere town animals, and ${
        bandits.length
      } bandits exist, are alive, body-supported, correctly sized, contained, and have grounded respawn anchors.`
    );
  } finally {
    for (const value of terrainByShard?.values?.() ?? []) {
      value.tensor?.delete?.();
    }
    redis.disconnect();
  }
}

const entrypoint =
  process.env.HARTHMERE_CREATURE_GROUNDING_FRESH_READBACK === "1"
    ? emitFreshReadback
    : main;

entrypoint().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
