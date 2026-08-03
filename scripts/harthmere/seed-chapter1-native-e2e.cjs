#!/usr/bin/env node

/**
 * Focused, idempotent Chapter 1 native ECS installer.
 *
 * The full local-dev terrain bootstrap owns thousands of unrelated Harthmere
 * shards and is intentionally too broad for the browser-test inner loop. This
 * maintenance entry point installs only the two Elsewhen dungeon shard sets,
 * the Chapter 1 cast, all required encounter enemies, canonical testimony
 * NPCs, and shared Grove dependencies in bounded batches while the production
 * stack stays warm. It is safe to rerun after an interrupted seed: existing
 * rows are updated, missing rows are created, and retired duplicate Grove
 * identities are deleted without ever selecting a player.
 *
 * Elsewhen stays outside ordinary WorldMetadata. The only metadata mutation
 * this script may perform is repairing the retired X=3648 boundary back to the
 * real Harthmere edge at X=2560; dungeon access remains fracture-gate-only.
 *
 * Run inside the production test image so Voxeloo, Redis configuration, and the
 * baked Bikkie tray exactly match the browser under test:
 *
 *   APPLY=1 node scripts/harthmere/seed-chapter1-native-e2e.cjs
 *
 * Without APPLY=1 the script performs a read-only inventory and prints the
 * number of rows that would be created or updated.
 */

process.env.IS_SERVER ??= "true";
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const {
  RedisBikkieStorage,
} = require("../../src/server/shared/bikkie/storage/redis");
const {
  connectToRedis,
  connectToRedisWithLua,
} = require("../../src/server/shared/redis/connection");
const { scriptInit } = require("../../src/server/shared/script_init");
const { loadVoxeloo } = require("../../src/server/shared/voxeloo");
const { RedisWorld } = require("../../src/server/shared/world/redis");
const { npcEntity } = require("../../src/server/spawn/spawn_npc");
const {
  prepareHarthmerePlayerLikeNpcForUniqueAppearance,
} = require("../../src/server/harthmere/player_like_npc_cosmetics");
const {
  buildHarthmereSnapshotGroveNpcSeedProposedChanges,
  harthmereObsoleteSnapshotGroveNpcIds,
  harthmereSnapshotGroveNpcSeedIds,
} = require("../../src/server/harthmere/snapshot_grove_npc_ecs_seed");
const {
  getTerrainID,
  safeGetTerrainId,
} = require("../../src/shared/asset_defs/terrain");
const {
  BikkieRuntime,
  getBiscuits,
} = require("../../src/shared/bikkie/active");
const { BikkieIds } = require("../../src/shared/bikkie/ids");
const { using } = require("../../src/shared/deletable");
const { secondsSinceEpoch } = require("../../src/shared/ecs/config");
const {
  Box,
  EntityDescription,
  Health,
  QuestGiver,
  ShardDiff,
  ShardMuck,
  ShardSeed,
  ShardShapes,
  ShardWater,
  Size,
  WorldMetadata,
} = require("../../src/shared/ecs/gen/components");
const { WorldMetadataId } = require("../../src/shared/ecs/ids");
const { SHARD_DIM, shardToVoxelPos } = require("../../src/shared/game/shard");
const {
  CH1_RECLAIMED_CAST,
  CH1_SEEDED_CAST,
} = require("../../src/shared/harthmere/ch1_cast");
const {
  CH1_RETURNING_NPC_SEED_VERSION,
  CH1_SERGEANT_HOLT,
} = require("../../src/shared/harthmere/ch1_returning_npcs");
const {
  CH1_RETIRED_DUPLICATE_TESTIMONY_NPC_IDS,
  CH1_TESTIMONY_NPC_SEEDS,
  CH1_TESTIMONY_NPC_SEED_VERSION,
} = require("../../src/shared/harthmere/ch1_testimony_npcs");
const {
  CH1_DUNGEON_ENCOUNTER_NPCS,
} = require("../../src/shared/harthmere/ch1_dungeon_encounters");
const {
  CH1_DUNGEON_TERRAIN_VERSION,
  ch1DungeonAuthoredToWorld,
  ch1DungeonBlockAt,
  ch1DungeonShardSpecs,
  ch1DungeonWaterAt,
  ch1DungeonWorldToAuthored,
} = require("../../src/shared/harthmere/ch1_dungeon_terrain");
const {
  CH1_ELSEWHEN_BAND_START_X,
  CH1_ELSEWHEN_BAND_END_X,
  ch1NormalizeOrdinaryWorldEastEdge,
  ch1ElsewhenTerrainEntityIdForShard,
} = require("../../src/shared/harthmere/ch1_elsewhen_region");
const {
  HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X,
} = require("../../src/shared/harthmere/world_extension");
const {
  resolveHarthmereProductionMarkerPosition,
} = require("../../src/shared/harthmere/production_terrain_placement_map");
const {
  SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS,
} = require("../../src/shared/harthmere/snapshot_grove_ids");
const {
  LOCAL_DEV_HUMAN_NPC_TYPE_ID,
  LOCAL_DEV_WALKER_NPC_TYPE_ID,
  isNpcTypeId,
} = require("../../src/shared/npc/bikkie");
const { Sparse3 } = require("../../src/shared/util/sparse");
const { saveBlock } = require("../../src/shared/wasm/biomes");
const { Tensor } = require("../../src/shared/wasm/tensors");

const APPLY = process.env.APPLY === "1";
// Terrain-only is the fast art-iteration path. It avoids touching already
// validated quest/NPC entities and, critically, never invokes the legacy
// appearance generator while a landscape/camera pass is being reseeded.
const TERRAIN_ONLY = process.env.CH1_SEED_TERRAIN_ONLY === "1";
const CAST_ONLY = process.env.CH1_SEED_CAST_ONLY === "1";
if (TERRAIN_ONLY && CAST_ONLY) {
  throw new Error(
    "CH1_SEED_TERRAIN_ONLY and CH1_SEED_CAST_ONLY are mutually exclusive"
  );
}
const APPLY_BATCH_SIZE = Math.max(
  1,
  Number.parseInt(process.env.CH1_SEED_BATCH_SIZE ?? "8", 10) || 8
);
const DUNGEON_IDS = ["ch1_dungeon_desert", "ch1_dungeon_winter"];

function terrainId(name, fallback) {
  return safeGetTerrainId(name) ?? fallback;
}

/** Keep this palette aligned with localDevMaterials() in server/shim/main.ts. */
function chapter1Materials() {
  const grass = getTerrainID("grass");
  const dirt = getTerrainID("dirt");
  const stone = getTerrainID("stone");
  return {
    grass,
    dirt,
    stone,
    gravel: terrainId("gravel", stone),
    cobblestone: terrainId("cobblestone", stone),
    cobblestoneBrick: terrainId("cobblestone_brick", stone),
    oakLog: terrainId("oak_log", stone),
    oakLumber: terrainId("oak_lumber", dirt),
    oakLeaf: terrainId("oak_leaf", grass),
    stoneBrick: terrainId("stone_brick", stone),
    stonePolished: terrainId("stone_polished", stone),
    stoneShingles: terrainId("stone_shingles", stone),
    limestoneBrick: terrainId("limestone_brick", stone),
    simpleGlass: terrainId("simple_glass", stone),
    hay: terrainId("hay", dirt),
    thatch: terrainId("thatch", dirt),
    soil: terrainId("soil", dirt),
    woodCrate: terrainId("wood_crate", dirt),
    led: terrainId("led", stone),
    moss: terrainId("moss", grass),
    muckwad: terrainId("muckwad", terrainId("moss", grass)),
    sand: terrainId("sand", dirt),
    snow: terrainId("snow", stone),
    ice: terrainId("ice", terrainId("simple_glass", stone)),
    whiteWool: terrainId("white_wool", stone),
    yellowWool: terrainId("yellow_wool", dirt),
    redWool: terrainId("red_wool", dirt),
    blueWool: terrainId("blue_wool", stone),
    blackWool: terrainId("black_wool", stone),
    greenWool: terrainId("green_wool", grass),
    coal: terrainId("coal", stone),
    copperOre: terrainId("copper_ore", terrainId("iron_ore", stone)),
    ironOre: terrainId("iron_ore", terrainId("coal", stone)),
    silverOre: terrainId("silver_ore", stone),
    goldOre: terrainId("gold_ore", stone),
    diamondOre: terrainId("diamond_ore", stone),
    water: terrainId("water", terrainId("blue_wool", stone)),
  };
}

/**
 * Build a unique, stable terrain plan once. Attaching dungeonId to each shard
 * here avoids calling ch1ElsewhenSlotAt() for every voxel (millions of map
 * lookups in a full install).
 */
function chapter1TerrainPlan() {
  const specs = new Map();
  for (const dungeonId of DUNGEON_IDS) {
    for (const spec of ch1DungeonShardSpecs(dungeonId, SHARD_DIM)) {
      const id = ch1ElsewhenTerrainEntityIdForShard(
        spec.shardX,
        spec.shardY,
        spec.shardZ
      );
      if (id === undefined) {
        throw new Error(
          `Chapter 1 shard outside stable Elsewhen id grid: ${spec.shardX}:${spec.shardY}:${spec.shardZ}`
        );
      }
      const key = `${spec.shardX}:${spec.shardY}:${spec.shardZ}`;
      const prior = specs.get(key);
      if (prior && prior.dungeonId !== dungeonId) {
        throw new Error(`Chapter 1 dungeons overlap at shard ${key}`);
      }
      specs.set(key, { id, dungeonId, ...spec });
    }
  }
  return [...specs.values()].sort(
    (a, b) => a.shardX - b.shardX || a.shardY - b.shardY || a.shardZ - b.shardZ
  );
}

function buildTerrainEntity(voxeloo, spec, materials) {
  const { id, dungeonId, shardX, shardY, shardZ } = spec;
  const v0 = shardToVoxelPos(shardX, shardY, shardZ);
  const v1 = [v0[0] + SHARD_DIM, v0[1] + SHARD_DIM, v0[2] + SHARD_DIM];

  const buffer = using(new voxeloo.VolumeBlock_U32(), (seedBlock) => {
    for (let z = 0; z < SHARD_DIM; z += 1) {
      for (let x = 0; x < SHARD_DIM; x += 1) {
        const worldX = v0[0] + x;
        const worldZ = v0[2] + z;
        for (let y = 0; y < SHARD_DIM; y += 1) {
          const local = ch1DungeonWorldToAuthored(dungeonId, [
            worldX,
            v0[1] + y,
            worldZ,
          ]);
          const materialName = ch1DungeonBlockAt(
            dungeonId,
            local.x,
            local.y,
            local.z
          );
          if (!materialName) {
            continue;
          }
          const material = materials[materialName];
          if (!material) {
            throw new Error(
              `Unknown Chapter 1 terrain material: ${materialName}`
            );
          }
          seedBlock.set(x, y, z, material);
        }
      }
    }
    return saveBlock(voxeloo, seedBlock);
  });

  const shardWater = using(
    Tensor.make(voxeloo, [SHARD_DIM, SHARD_DIM, SHARD_DIM], "U8"),
    (water) => {
      const values = new Sparse3([SHARD_DIM, SHARD_DIM, SHARD_DIM]);
      for (let z = 0; z < SHARD_DIM; z += 1) {
        for (let x = 0; x < SHARD_DIM; x += 1) {
          const worldX = v0[0] + x;
          const worldZ = v0[2] + z;
          for (let y = 0; y < SHARD_DIM; y += 1) {
            const local = ch1DungeonWorldToAuthored(dungeonId, [
              worldX,
              v0[1] + y,
              worldZ,
            ]);
            if (ch1DungeonWaterAt(dungeonId, local.x, local.y, local.z)) {
              values.set([x, y, z], 15);
            }
          }
        }
      }
      water.assign(values);
      return ShardWater.create(water.saveWrapped());
    }
  );
  const muckBuffer = using(
    Tensor.make(voxeloo, [SHARD_DIM, SHARD_DIM, SHARD_DIM], "U8"),
    (muck) => muck.save()
  );
  return {
    id,
    box: Box.create({ v0, v1 }),
    shard_seed: ShardSeed.create({ buffer }),
    shard_diff: ShardDiff.create(),
    shard_shapes: ShardShapes.create(),
    shard_muck: ShardMuck.create({ buffer: muckBuffer }),
    shard_water: shardWater,
  };
}

function npcDialog(line) {
  return `<text>${line}</text>`;
}

function chapter1SeedPlacement(member) {
  if (member.placement) {
    return [...member.placement];
  }
  switch (member.key) {
    case "iris_fen":
      return ch1DungeonAuthoredToWorld("ch1_dungeon_desert", {
        x: 386,
        y: -20,
        z: -56,
      });
    case "marrow":
      return ch1DungeonAuthoredToWorld("ch1_dungeon_desert", {
        x: 391,
        y: -20,
        z: -52,
      });
    case "nadia_sorrel":
      return ch1DungeonAuthoredToWorld("ch1_dungeon_winter", {
        x: 308,
        y: 1,
        z: -88,
      });
    case "hallr_ironmouth":
      return ch1DungeonAuthoredToWorld("ch1_dungeon_winter", {
        x: 384,
        y: 1,
        z: -88,
      });
    default:
      throw new Error(`Chapter 1 NPC ${member.key} has no seed placement`);
  }
}

function resolveNpcTypeId(member) {
  const preferredNames =
    member.key === "augur9"
      ? ["biomesRobot", "dRobot"]
      : member.key === "marrow"
        ? ["dog", "wolf", "rabbit"]
        : ["local_dev_human"];
  if (preferredNames.includes("local_dev_human")) {
    return LOCAL_DEV_HUMAN_NPC_TYPE_ID;
  }
  const preferred = getBiscuits("/npcs/types").find((biscuit) =>
    preferredNames.includes(biscuit.name)
  );
  if (preferred?.id && isNpcTypeId(preferred.id)) {
    return preferred.id;
  }
  if (member.key === "augur9" && isNpcTypeId(BikkieIds.biomesRobot)) {
    return BikkieIds.biomesRobot;
  }
  return LOCAL_DEV_HUMAN_NPC_TYPE_ID;
}

function buildNpcEntity(member, kind, nowSeconds) {
  const typeId = resolveNpcTypeId(member);
  let base = npcEntity(
    {
      id: member.entityId,
      typeId,
      position: chapter1SeedPlacement(member),
      orientation: [0, Math.PI],
      velocity: [0, 0, 0],
      displayName: member.displayName,
      defaultDialog: npcDialog(member.sampleLine || member.role),
    },
    nowSeconds
  );
  if (typeId === LOCAL_DEV_HUMAN_NPC_TYPE_ID) {
    base = prepareHarthmerePlayerLikeNpcForUniqueAppearance(base, kind);
  }
  return {
    ...base,
    entity_description: EntityDescription.create({
      // Human Chapter 1 identities intentionally carry no Harthmere voxel-face
      // marker. Their local_dev_human type renders through the snapshot
      // player-like mesh pipeline, with per-id cosmetics activated above.
      text: `${CH1_DUNGEON_TERRAIN_VERSION} ${member.faction} ${member.role}`,
    }),
    quest_giver: QuestGiver.create({
      concurrent_quests: 1,
      concurrent_quest_dialog: npcDialog(member.sampleLine || member.role),
    }),
  };
}

function buildTestimonyNpcEntity(seed, kind, nowSeconds) {
  let base = npcEntity(
    {
      id: seed.entityId,
      typeId: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
      position: [...seed.position],
      orientation: [0, Math.PI],
      velocity: [0, 0, 0],
      displayName: seed.displayName,
      defaultDialog: npcDialog(seed.line),
      spawnPositionJitterRadius: 0,
    },
    nowSeconds
  );
  if (!seed.preserveSnapshotAppearance) {
    base = prepareHarthmerePlayerLikeNpcForUniqueAppearance(base, kind);
  }
  return {
    ...base,
    entity_description: EntityDescription.create({
      text: `${CH1_TESTIMONY_NPC_SEED_VERSION} grove witness ${seed.role}`,
    }),
    ...(seed.questGiver
      ? {
          quest_giver: QuestGiver.create({
            concurrent_quests: 1,
            concurrent_quest_dialog: npcDialog(seed.line),
          }),
        }
      : {}),
  };
}

function buildEncounterNpcEntity(encounter, nowSeconds) {
  const typeId = isNpcTypeId(BikkieIds.dMucker)
    ? BikkieIds.dMucker
    : LOCAL_DEV_WALKER_NPC_TYPE_ID;
  const base = npcEntity(
    {
      id: encounter.entityId,
      typeId,
      position: [...encounter.position],
      orientation: [0, Math.PI],
      velocity: [0, 0, 0],
      displayName: encounter.displayName,
      defaultDialog: npcDialog("It does not answer."),
    },
    nowSeconds
  );
  return {
    ...base,
    health: Health.create({
      hp: encounter.maxHp,
      maxHp: encounter.maxHp,
    }),
    ...(encounter.size ? { size: Size.create({ v: encounter.size }) } : {}),
    entity_description: EntityDescription.create({
      text: `${CH1_DUNGEON_TERRAIN_VERSION} CH1_ENCOUNTER ${encounter.dungeonId} ${encounter.encounterId} ${encounter.objectiveId}`,
    }),
  };
}

function buildReturningNpcEntity(kind, nowSeconds) {
  const homePosition = resolveHarthmereProductionMarkerPosition({
    markerId: "sergeant_bram_holt",
    fallback: [486, 58, -277],
  });
  let base = npcEntity(
    {
      id: CH1_SERGEANT_HOLT.entityId,
      typeId: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
      position: homePosition,
      orientation: [0, Math.PI],
      velocity: [0, 0, 0],
      displayName: CH1_SERGEANT_HOLT.displayName,
      defaultDialog: npcDialog(
        "State your name and your business and I will write you into the ledger."
      ),
    },
    nowSeconds
  );
  base = prepareHarthmerePlayerLikeNpcForUniqueAppearance(base, kind);
  return {
    ...base,
    entity_description: EntityDescription.create({
      text: `${CH1_RETURNING_NPC_SEED_VERSION} ${CH1_SERGEANT_HOLT.role}`,
    }),
    quest_giver: QuestGiver.create({
      concurrent_quests: 1,
      concurrent_quest_dialog: npcDialog(
        "State your name and your business and I will write you into the ledger."
      ),
    }),
  };
}

async function registerBakedBikkie() {
  const storage = new RedisBikkieStorage(await connectToRedis("bikkie"));
  try {
    const baked = await storage.load();
    BikkieRuntime.get().registerBiscuits(baked.contents);
    return baked.contents.size;
  } finally {
    await storage.stop();
  }
}

async function applyChanges(world, changes) {
  for (let start = 0; start < changes.length; start += APPLY_BATCH_SIZE) {
    const batch = changes.slice(start, start + APPLY_BATCH_SIZE);
    const result = await world.apply({ changes: batch });
    if (result.outcome !== "success") {
      throw new Error(
        `Chapter 1 seed batch ${start + 1}-${start + batch.length} failed: ${result.outcome}`
      );
    }
    console.log(
      `Applied ${Math.min(start + batch.length, changes.length)}/${
        changes.length
      } changes`
    );
  }
}

async function chapter1WorldBoundaryPlan(world) {
  const metadataEntity = await world.get(WorldMetadataId);
  const metadata = metadataEntity?.worldMetadata();
  if (!metadata) {
    throw new Error(
      "Chapter 1 native seed requires an existing WorldMetadata entity"
    );
  }
  const currentEastEdge = metadata.aabb.v1[0];
  const effectiveEastEdge = ch1NormalizeOrdinaryWorldEastEdge(currentEastEdge);
  if (effectiveEastEdge === currentEastEdge) {
    return { currentEastEdge, effectiveEastEdge, change: undefined };
  }
  const aabb = {
    v0: [...metadata.aabb.v0],
    v1: [...metadata.aabb.v1],
  };
  aabb.v1[0] = effectiveEastEdge;
  return {
    currentEastEdge,
    effectiveEastEdge,
    change: {
      kind: "update",
      entity: {
        id: WorldMetadataId,
        world_metadata: WorldMetadata.create({ aabb }),
      },
    },
  };
}

async function main() {
  const startedAt = Date.now();
  await scriptInit();
  const bikkieCount = await registerBakedBikkie();
  const terrainPlan = CAST_ONLY ? [] : chapter1TerrainPlan();
  const targetIds = [
    ...terrainPlan.map((spec) => spec.id),
    ...(TERRAIN_ONLY ? [] : CH1_SEEDED_CAST.map((member) => member.entityId)),
    ...(TERRAIN_ONLY
      ? []
      : CH1_DUNGEON_ENCOUNTER_NPCS.map((encounter) => encounter.entityId)),
    ...(TERRAIN_ONLY ? [] : [CH1_SERGEANT_HOLT.entityId]),
    ...(TERRAIN_ONLY
      ? []
      : CH1_TESTIMONY_NPC_SEEDS.map((seed) => seed.entityId)),
    ...(TERRAIN_ONLY ? [] : harthmereSnapshotGroveNpcSeedIds()),
    ...(TERRAIN_ONLY ? [] : CH1_RETIRED_DUPLICATE_TESTIMONY_NPC_IDS),
  ];
  const world = new RedisWorld(await connectToRedisWithLua("ecs"));
  await world.waitForHealthy();
  try {
    const boundary = await chapter1WorldBoundaryPlan(world);
    const existingIds = new Set(await world.has(targetIds));
    const terrainByDungeon = Object.fromEntries(
      DUNGEON_IDS.map((dungeonId) => {
        const specs = terrainPlan.filter(
          (spec) => spec.dungeonId === dungeonId
        );
        const existing = specs.filter((spec) =>
          existingIds.has(spec.id)
        ).length;
        return [
          dungeonId,
          {
            terrainShards: specs.length,
            existing,
            missing: specs.length - existing,
          },
        ];
      })
    );
    const summary = {
      apply: APPLY,
      bikkieCount,
      terrainOnly: TERRAIN_ONLY,
      castOnly: CAST_ONLY,
      terrainShards: terrainPlan.length,
      castMembers: TERRAIN_ONLY ? 0 : CH1_SEEDED_CAST.length,
      encounterNpcs: TERRAIN_ONLY ? 0 : CH1_DUNGEON_ENCOUNTER_NPCS.length,
      returningNpcs: TERRAIN_ONLY ? 0 : 1,
      testimonyNpcs: TERRAIN_ONLY ? 0 : CH1_TESTIMONY_NPC_SEEDS.length,
      sharedGroveNpcs: TERRAIN_ONLY
        ? 0
        : harthmereSnapshotGroveNpcSeedIds().length,
      worldBoundaryEast: boundary.currentEastEdge,
      effectiveWorldBoundaryEast: boundary.effectiveEastEdge,
      expectedOrdinaryWorldBoundaryEast: HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X,
      elsewhenBandStart: CH1_ELSEWHEN_BAND_START_X,
      elsewhenBandEnd: CH1_ELSEWHEN_BAND_END_X,
      portalOnlyWorldBoundary:
        boundary.effectiveEastEdge <= HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X,
      repairRetiredElsewhenBoundary: Boolean(boundary.change),
      terrainByDungeon,
      create: targetIds.length - existingIds.size,
      update: existingIds.size,
      batchSize: APPLY_BATCH_SIZE,
    };
    console.log(JSON.stringify(summary, undefined, 2));
    if (!APPLY) {
      console.log("Read-only inventory complete. Set APPLY=1 to install.");
      return;
    }

    if (boundary.change) {
      await applyChanges(world, [boundary.change]);
    }

    const voxeloo = await loadVoxeloo();
    const materials = chapter1Materials();
    const terrainChanges = [];
    for (const [index, spec] of terrainPlan.entries()) {
      const kind = existingIds.has(spec.id) ? "update" : "create";
      const shardStartedAt = Date.now();
      terrainChanges.push({
        kind,
        entity: buildTerrainEntity(voxeloo, spec, materials),
      });
      if (
        terrainChanges.length >= APPLY_BATCH_SIZE ||
        index === terrainPlan.length - 1
      ) {
        await applyChanges(world, terrainChanges.splice(0));
      }
      console.log(
        `Built Chapter 1 terrain ${index + 1}/${terrainPlan.length} in ${
          Date.now() - shardStartedAt
        }ms`
      );
    }

    if (!TERRAIN_ONLY) {
      const nowSeconds = secondsSinceEpoch();
      const reclaimedExistingIds = new Set(
        CH1_RECLAIMED_CAST.filter((member) =>
          existingIds.has(member.entityId)
        ).map((member) => member.entityId)
      );
      if (reclaimedExistingIds.size > 0) {
        await applyChanges(
          world,
          [...reclaimedExistingIds].map((id) => ({ kind: "delete", id }))
        );
      }
      const retiredTestimonyDuplicates =
        CH1_RETIRED_DUPLICATE_TESTIMONY_NPC_IDS.filter((id) =>
          existingIds.has(id)
        );
      if (retiredTestimonyDuplicates.length > 0) {
        await applyChanges(
          world,
          retiredTestimonyDuplicates.map((id) => ({ kind: "delete", id }))
        );
      }
      const npcChanges = CH1_SEEDED_CAST.map((member) => {
        const kind =
          existingIds.has(member.entityId) &&
          !reclaimedExistingIds.has(member.entityId)
            ? "update"
            : "create";
        return {
          kind,
          entity: buildNpcEntity(member, kind, nowSeconds),
        };
      });
      await applyChanges(world, npcChanges);
      const encounterChanges = CH1_DUNGEON_ENCOUNTER_NPCS.map((encounter) => ({
        kind: existingIds.has(encounter.entityId) ? "update" : "create",
        entity: buildEncounterNpcEntity(encounter, nowSeconds),
      }));
      await applyChanges(world, encounterChanges);
      const returningKind = existingIds.has(CH1_SERGEANT_HOLT.entityId)
        ? "update"
        : "create";
      await applyChanges(world, [
        {
          kind: returningKind,
          entity: buildReturningNpcEntity(returningKind, nowSeconds),
        },
      ]);
      const testimonyChanges = CH1_TESTIMONY_NPC_SEEDS.map((seed) => {
        const kind = existingIds.has(seed.entityId) ? "update" : "create";
        return {
          kind,
          entity: buildTestimonyNpcEntity(seed, kind, nowSeconds),
        };
      });
      await applyChanges(world, testimonyChanges);

      await applyChanges(
        world,
        buildHarthmereSnapshotGroveNpcSeedProposedChanges({
          nowSeconds,
          existingIds,
        })
      );
      const legacyGroveNpcEntities = await Promise.all(
        Object.values(SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS).map((id) =>
          world.get(id)
        )
      );
      const retiredGroveNpcIds = harthmereObsoleteSnapshotGroveNpcIds(
        legacyGroveNpcEntities.flatMap((entity) =>
          entity
            ? [
                {
                  id: entity.id,
                  label: entity.label()?.text,
                  hasNpcMetadata: Boolean(entity.npcMetadata()),
                  hasPlayerStatus: Boolean(entity.playerStatus()),
                  hasRemoteConnection: Boolean(entity.remoteConnection()),
                },
              ]
            : []
        )
      );
      if (retiredGroveNpcIds.length > 0) {
        await applyChanges(
          world,
          retiredGroveNpcIds.map((id) => ({ kind: "delete", id }))
        );
      }
    }
    console.log(
      `Chapter 1 native seed complete in ${(
        (Date.now() - startedAt) /
        1000
      ).toFixed(1)}s`
    );
  } finally {
    await world.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
