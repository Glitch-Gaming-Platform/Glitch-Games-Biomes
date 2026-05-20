import { BACKUP_BIKKIE_TRAY_ID } from "@/server/backup/serde";
import { resetPlayerDelta } from "@/server/logic/utils/players";
import { parseArgs, stringLiteralCtor } from "@/server/shared/args";
import { encodeNames } from "@/server/shared/bikkie/bakery";
import {
  loadBakedTrayFromProd,
  loadTrayDefinitionFromProd,
} from "@/server/shared/bikkie/dev";
import {
  ExposeBikkieStorageService,
  zShimBikkieStorageService,
} from "@/server/shared/bikkie/storage/shim";
import type {
  Bootstrap,
  BootstrapMode,
} from "@/server/shared/bootstrap/bootstrap";
import { registerBootstrap } from "@/server/shared/bootstrap/bootstrap";
import type { ChatApi } from "@/server/shared/chat/api";
import { InMemoryChatApi } from "@/server/shared/chat/memory";
import type { PlayerSpatialObserver } from "@/server/shared/chat/player_observer";
import { registerPlayerSpatialObserver } from "@/server/shared/chat/player_observer";
import { ExposeChatService, zChatService } from "@/server/shared/chat/remote";
import type { SharedServerContext } from "@/server/shared/context";
import { sharedServerContext } from "@/server/shared/context";
import { createShimServiceDiscovery } from "@/server/shared/discovery/discovery";
import { zServiceDiscoveryService } from "@/server/shared/discovery/remote";
import {
  ShimNotifierService,
  zShimNotifierService,
} from "@/server/shared/distributed_notifier/shim";
import type { Firehose } from "@/server/shared/firehose/api";
import { InMemoryFirehose } from "@/server/shared/firehose/memory";
import {
  ExposeFirehoseService,
  zRemoteFirehoseService,
} from "@/server/shared/firehose/remote";
import { runServer } from "@/server/shared/main";
import { HostPort } from "@/server/shared/ports";
import {
  ShimPubSubService,
  zShimPubSubService,
} from "@/server/shared/pubsub/shim";
import type { BaseServerConfig } from "@/server/shared/server_config";
import { applyGlitchRuntimeDefaults, baseServerArgumentConfig } from "@/server/shared/server_config";
import type { BDB } from "@/server/shared/storage";
import { registerBiomesStorage } from "@/server/shared/storage";
import {
  ExposeStorageService,
  zRemoteStorageService,
} from "@/server/shared/storage/remote";
import type { WorldApi } from "@/server/shared/world/api";
import { npcEntity } from "@/server/spawn/spawn_npc";
import { registerWorldApi } from "@/server/shared/world/register";
import {
  ShimWorldApi,
  ShimWorldService,
  zWorldService,
} from "@/server/shared/world/shim/api";
import { InMemoryWorld } from "@/server/shared/world/shim/in_memory_world";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import type { ZrpcServer } from "@/server/shared/zrpc/server";
import { registerRpcServer } from "@/server/shared/zrpc/server";
import {
  getTerrainID,
  safeGetTerrainId,
  type TerrainID,
} from "@/shared/asset_defs/terrain";
import { getBiscuits } from "@/shared/bikkie/active";
import { BikkieIds } from "@/shared/bikkie/ids";
import { using } from "@/shared/deletable";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import {
  Box,
  EntityDescription,
  QuestGiver,
  ShardDiff,
  ShardSeed,
  ShardShapes,
} from "@/shared/ecs/gen/components";
import { isPlayer } from "@/shared/game/players";
import { SHARD_DIM, shardToVoxelPos } from "@/shared/game/shard";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import type { RegistryLoader } from "@/shared/registry";
import type { VoxelooModule } from "@/shared/wasm/types";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID, isNpcTypeId } from "@/shared/npc/bikkie";
import type { Vec2, Vec3 } from "@/shared/math/types";
import { saveBlock } from "@/shared/wasm/biomes";
import { RegistryBuilder } from "@/shared/registry";
import {
  makeHarthmereNpcBodyConfig,
  makeHarthmereNpcFaceConfig,
  withHarthmereBodyAndFaceMarkers,
  type HarthmereVoxelBodyConfig,
  type HarthmereVoxelFaceConfig,
} from "@/shared/harthmere/voxel_faces";
import {
  SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS_V74,
  SNAPSHOT_HARTHMERE_MUCK_ZONES_V74,
  isAuthoredPointInSnapshotMuckZoneV74,
} from "@/shared/harthmere/snapshot_runtime_rules_v74";

export interface ShimServerConfig extends BaseServerConfig {
  bootstrapMode: BootstrapMode;
}

export async function registerShimServerConfig(): Promise<ShimServerConfig> {
  const config = await parseArgs<ShimServerConfig>({
    ...baseServerArgumentConfig,
    bootstrapMode: {
      type: stringLiteralCtor("sync", "empty"),
      defaultValue: "sync",
    },
  });
  return applyGlitchRuntimeDefaults(config);
}

async function registerShimWorldService(
  loader: RegistryLoader<ShimServerContext>,
) {
  const config = await loader.get("config");
  if (config.worldApiMode !== "shim") {
    return;
  }
  const firehose = await loader.get("firehose");
  return new ShimWorldService(new InMemoryWorld(true, firehose));
}

const LOCAL_DEV_TERRAIN_ID_BASE = 8_810_000_000_000_000 as BiomesId;
const LOCAL_DEV_NPC_ID_BASE = 8_810_000_000_010_000 as BiomesId;
const LOCAL_DEV_TERRAIN_ID_LIMIT = 8_810_000_000_010_000;
const LOCAL_DEV_NPC_ID_LIMIT = 8_810_000_000_020_000;

const STARTER_TOWN_GROUND_Y = 52;
const STARTER_TOWN_SPAWN: Vec3 = [486, STARTER_TOWN_GROUND_Y + 1, -209];

// HARTHMERE_CONNECTED_MAP_ROAD_VERSION_V66:
// Harthmere is no longer treated as a hidden far-away local-dev island.
// The authored road below connects the snapshot edge to Harthmere's west
// approach when the default +512 x offset is active:
//   authored [128, -209] -> [392, -209]
//   shifted  [640, -209] -> [904, -209]
// Keep this shard-aligned and close enough that players can follow the road.
const HARTHMERE_CONNECTED_MAP_ROAD_VERSION_V66 = "harthmere-snapshot-connected-road-v66";
const HARTHMERE_CONNECTED_MAP_DEFAULT_OFFSET_X_V66 = 512;
const HARTHMERE_CONNECTED_MAP_DEFAULT_OFFSET_Z_V66 = 0;
const HARTHMERE_SNAPSHOT_EDGE_ROAD_AUTHORED_START_X_V66 = 128;
const HARTHMERE_SNAPSHOT_EDGE_ROAD_AUTHORED_Z_V66 = -209;
const HARTHMERE_WEST_GATE_AUTHORED_X_V66 = 392;

// HARTHMERE_EXTRA_TOWN_OFFSET_V1:
// In snapshot-merge mode, Harthmere becomes a shifted extra town instead of
// the base spawn world. The default offset is shard-aligned: 512 / 32 = 16.
const HARTHMERE_EXTRA_TOWN_OFFSET_X_V1 = Number.parseInt(
  process.env.BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X ?? "512",
  10,
);
const HARTHMERE_EXTRA_TOWN_OFFSET_Z_V1 = Number.parseInt(
  process.env.BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z ?? "0",
  10,
);
function shouldUseHarthmereExtraTownOffsetV1() {
  // HARTHMERE_GROVE_SEPARATION_V72:
  // With the production snapshot installed, BIOMES_FORCE_LOCAL_DEV_TOWN means
  // "seed Harthmere as the connected extra town". It must never paint the
  // Harthmere terrain/NPC layer directly over The Grove. Use
  // BIOMES_HARTHMERE_STANDALONE_TOWN=1 only for legacy unshifted tests.
  if (
    process.env.BIOMES_DISABLE_HARTHMERE_EXTRA_TOWN_OFFSET === "1" ||
    process.env.BIOMES_HARTHMERE_STANDALONE_TOWN === "1"
  ) {
    return false;
  }
  return (
    process.env.BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN === "1" ||
    process.env.BIOMES_FORCE_LOCAL_DEV_TOWN === "1"
  );
}
function harthmereExtraTownOffsetXV1() {
  return shouldUseHarthmereExtraTownOffsetV1() ? HARTHMERE_EXTRA_TOWN_OFFSET_X_V1 : 0;
}
function harthmereExtraTownOffsetZV1() {
  return shouldUseHarthmereExtraTownOffsetV1() ? HARTHMERE_EXTRA_TOWN_OFFSET_Z_V1 : 0;
}
function harthmereExtraTownShardOffsetXV1() {
  return Math.trunc(harthmereExtraTownOffsetXV1() / SHARD_DIM);
}
function harthmereExtraTownShardOffsetZV1() {
  return Math.trunc(harthmereExtraTownOffsetZV1() / SHARD_DIM);
}
function harthmereAuthoredWorldXV1(worldX: number) {
  return worldX - harthmereExtraTownOffsetXV1();
}
function harthmereAuthoredWorldZV1(worldZ: number) {
  return worldZ - harthmereExtraTownOffsetZV1();
}
function harthmereWorldPositionV1(position: Vec3): Vec3 {
  return [
    position[0] + harthmereExtraTownOffsetXV1(),
    position[1],
    position[2] + harthmereExtraTownOffsetZV1(),
  ];
}


// HARTHMERE_NPC_GROUNDING_VERSION_V67
// Harthmere NPCs are authored to stand on server terrain. Never preserve stale
// Y values from old local-dev placements after snapshot/extra-town shifting.
const HARTHMERE_NPC_GROUNDING_VERSION_V67 = "harthmere-npc-grounding-v67";
function harthmereGroundedNpcWorldPositionV67(position: Vec3): Vec3 {
  const shifted = harthmereWorldPositionV1(position);
  return [shifted[0], STARTER_TOWN_GROUND_Y + 1, shifted[2]];
}

const STARTER_TOWN_SAFE_X0 = 352;
const STARTER_TOWN_SAFE_X1 = 640;
const STARTER_TOWN_SAFE_Z0 = -320;
const STARTER_TOWN_SAFE_Z1 = -32;

// Harthmere local-dev terrain performance profile.
// The previous full wilds seed created 2209 terrain shards and 11k+ harvestable
// blocks even when testing inside the town, which showed up in logs as ~19s of
// terrain seeding and poor frame pacing. Default to the town + near-wilds band;
// set BIOMES_HARTHMERE_PERF_PROFILE=full for long-distance world screenshots.
const HARTHMERE_LOCAL_DEV_PERF_PROFILE_V3 = process.env.BIOMES_HARTHMERE_PERF_PROFILE === "full" ? "full" : "optimized";
const HARTHMERE_FULL_WILDS_SHARD_X0 = -8;
const HARTHMERE_FULL_WILDS_SHARD_X1 = 38;
const HARTHMERE_FULL_WILDS_SHARD_Z0 = -31;
const HARTHMERE_FULL_WILDS_SHARD_Z1 = 15;
const HARTHMERE_OPTIMIZED_WILDS_SHARD_X0 = 6;
const HARTHMERE_OPTIMIZED_WILDS_SHARD_X1 = 23;
const HARTHMERE_OPTIMIZED_WILDS_SHARD_Z0 = -16;
const HARTHMERE_OPTIMIZED_WILDS_SHARD_Z1 = 5;
const STARTER_TOWN_WILDS_SHARD_X0 = HARTHMERE_LOCAL_DEV_PERF_PROFILE_V3 === "full" ? HARTHMERE_FULL_WILDS_SHARD_X0 : HARTHMERE_OPTIMIZED_WILDS_SHARD_X0;
const STARTER_TOWN_WILDS_SHARD_X1 = HARTHMERE_LOCAL_DEV_PERF_PROFILE_V3 === "full" ? HARTHMERE_FULL_WILDS_SHARD_X1 : HARTHMERE_OPTIMIZED_WILDS_SHARD_X1;
const STARTER_TOWN_WILDS_SHARD_Z0 = HARTHMERE_LOCAL_DEV_PERF_PROFILE_V3 === "full" ? HARTHMERE_FULL_WILDS_SHARD_Z0 : HARTHMERE_OPTIMIZED_WILDS_SHARD_Z0;
const STARTER_TOWN_WILDS_SHARD_Z1 = HARTHMERE_LOCAL_DEV_PERF_PROFILE_V3 === "full" ? HARTHMERE_FULL_WILDS_SHARD_Z1 : HARTHMERE_OPTIMIZED_WILDS_SHARD_Z1;
const STARTER_TOWN_WILDS_X0 = STARTER_TOWN_WILDS_SHARD_X0 * SHARD_DIM;
const STARTER_TOWN_WILDS_X1 = (STARTER_TOWN_WILDS_SHARD_X1 + 1) * SHARD_DIM;
const STARTER_TOWN_WILDS_Z0 = STARTER_TOWN_WILDS_SHARD_Z0 * SHARD_DIM;
const STARTER_TOWN_WILDS_Z1 = (STARTER_TOWN_WILDS_SHARD_Z1 + 1) * SHARD_DIM;
const HARTHMERE_LEGACY_LOCAL_DEV_TERRAIN_SHARD_COUNT_V3 =
  (HARTHMERE_FULL_WILDS_SHARD_X1 - HARTHMERE_FULL_WILDS_SHARD_X0 + 1) *
  (HARTHMERE_FULL_WILDS_SHARD_Z1 - HARTHMERE_FULL_WILDS_SHARD_Z0 + 1);

function isHarthmereLocalDevTerrainShardEnabledForWorldV3(worldX: number, worldZ: number) {
  const shardX = Math.floor(worldX / SHARD_DIM);
  const shardZ = Math.floor(worldZ / SHARD_DIM);
  return shardX >= STARTER_TOWN_WILDS_SHARD_X0 && shardX <= STARTER_TOWN_WILDS_SHARD_X1 &&
    shardZ >= STARTER_TOWN_WILDS_SHARD_Z0 && shardZ <= STARTER_TOWN_WILDS_SHARD_Z1;
}

function shouldSeedLocalDevTerrain() {
  // Snapshot merge extra-town v1: legacy local-dev mode still requires
  // BIOMES_FORCE_LOCAL_DEV_TOWN=1, but snapshot merge can now opt into a
  // shifted Harthmere town with BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1.
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.BIOMES_FORCE_LOCAL_DEV_TOWN === "1" ||
      process.env.BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN === "1") &&
    process.env.BIOMES_CREATE_LOCAL_DEV_TERRAIN !== "0"
  );
}

function isLocalDevStarterWorldEntityId(id: BiomesId) {
  return (
    (id >= LOCAL_DEV_TERRAIN_ID_BASE && id < LOCAL_DEV_TERRAIN_ID_LIMIT) ||
    (id >= LOCAL_DEV_NPC_ID_BASE && id < LOCAL_DEV_NPC_ID_LIMIT)
  );
}

function hasNonLocalTerrainShard(service: ShimWorldService) {
  for (const entity of service.table.contents()) {
    if (
      entity.box &&
      entity.shard_seed &&
      entity.shard_diff &&
      entity.shard_shapes &&
      !isLocalDevStarterWorldEntityId(entity.id)
    ) {
      return true;
    }
  }
  return false;
}

function toProposedChange(change: Change): ProposedChange {
  switch (change.kind) {
    case "create":
      return { kind: "create", entity: change.entity };
    case "update":
      return { kind: "update", entity: change.entity };
    case "delete":
      return { kind: "delete", id: change.id };
  }
}

function terrainId(name: string, fallback: TerrainID): TerrainID {
  return safeGetTerrainId(name) ?? fallback;
}

function inRange(value: number, min: number, max: number) {
  return value >= min && value <= max;
}

function inRect(
  worldX: number,
  worldZ: number,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  pad = 0,
) {
  return (
    inRange(worldX, x0 - pad, x1 + pad) && inRange(worldZ, z0 - pad, z1 + pad)
  );
}

function isStarterTownSafeFlatZone(worldX: number, worldZ: number) {
  return (
    inRect(
      worldX,
      worldZ,
      STARTER_TOWN_SAFE_X0,
      STARTER_TOWN_SAFE_X1,
      STARTER_TOWN_SAFE_Z0,
      STARTER_TOWN_SAFE_Z1,
    ) ||
    Math.hypot(
      worldX - STARTER_TOWN_SPAWN[0],
      worldZ - STARTER_TOWN_SPAWN[2],
    ) <= 128
  );
}

function localDevTerrainHeight(worldX: number, worldZ: number) {
  // Keep the entire authored local-dev Harthmere map flat and walkable.
  // Earlier terrain waves made the town edge and forest edge feel like a hard
  // cliff: players could step out of the seeded town footprint and get caught
  // against missing or uneven shards. Visual variation now comes from material
  // tiles, road/forest props, and sparse block landmarks, not dangerous height
  // changes. Keep the surface exactly one block below NPC/player feet.
  void worldX;
  void worldZ;
  return STARTER_TOWN_GROUND_Y;
}

type StarterBuilding = {
  name: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  height: number;
  floor: TerrainID;
  wall: TerrainID;
  roof: TerrainID;
  doorSide: "north" | "south" | "east" | "west";
};

function starterBuildings(materials: ReturnType<typeof localDevMaterials>) {
  return [
    {
      name: "Welcome Hall",
      x0: 462,
      x1: 478,
      z0: -232,
      z1: -218,
      height: 7,
      floor: materials.stonePolished,
      wall: materials.oakLumber,
      roof: materials.stoneShingles,
      doorSide: "south",
    },
    {
      name: "Player House",
      x0: 448,
      x1: 466,
      z0: -268,
      z1: -246,
      height: 10,
      floor: materials.oakLumber,
      wall: materials.oakLumber,
      roof: materials.thatch,
      doorSide: "south",
    },
    {
      name: "Bakery",
      x0: 420,
      x1: 438,
      z0: -200,
      z1: -184,
      height: 6,
      floor: materials.stonePolished,
      wall: materials.limestoneBrick,
      roof: materials.thatch,
      doorSide: "east",
    },
    {
      name: "Bank",
      x0: 544,
      x1: 562,
      z0: -232,
      z1: -214,
      height: 8,
      floor: materials.stonePolished,
      wall: materials.stoneBrick,
      roof: materials.stoneShingles,
      doorSide: "west",
    },
    {
      name: "Weapons Shop",
      x0: 520,
      x1: 540,
      z0: -238,
      z1: -220,
      height: 7,
      floor: materials.cobblestone,
      wall: materials.oakLumber,
      roof: materials.stoneShingles,
      doorSide: "south",
    },
    {
      name: "Healing Shop",
      x0: 448,
      x1: 464,
      z0: -184,
      z1: -168,
      height: 6,
      floor: materials.stonePolished,
      wall: materials.limestoneBrick,
      roof: materials.thatch,
      doorSide: "east",
    },
    {
      name: "Magic Shop",
      x0: 506,
      x1: 524,
      z0: -176,
      z1: -158,
      height: 8,
      floor: materials.stonePolished,
      wall: materials.stoneBrick,
      roof: materials.led,
      doorSide: "west",
    },
    {
      name: "Tavern",
      x0: 532,
      x1: 562,
      z0: -206,
      z1: -180,
      height: 7,
      floor: materials.oakLumber,
      wall: materials.oakLumber,
      roof: materials.thatch,
      doorSide: "west",
    },
    {
      name: "Chapel of Saint Verena",
      x0: 462,
      x1: 492,
      z0: -150,
      z1: -128,
      height: 8,
      floor: materials.stonePolished,
      wall: materials.limestoneBrick,
      roof: materials.stoneShingles,
      doorSide: "south",
    },
    {
      name: "Reeve Hall",
      x0: 548,
      x1: 580,
      z0: -274,
      z1: -250,
      height: 9,
      floor: materials.stonePolished,
      wall: materials.limestoneBrick,
      roof: materials.stoneShingles,
      doorSide: "south",
    },
    {
      name: "Guard Yard Office",
      x0: 500,
      x1: 522,
      z0: -274,
      z1: -258,
      height: 6,
      floor: materials.cobblestone,
      wall: materials.stoneBrick,
      roof: materials.stoneShingles,
      doorSide: "south",
    },
    {
      name: "Dockmaster Shed",
      x0: 572,
      x1: 586,
      z0: -190,
      z1: -176,
      height: 5,
      floor: materials.oakLumber,
      wall: materials.oakLumber,
      roof: materials.thatch,
      doorSide: "east",
    },
    {
      name: "Mudden Ward Home",
      x0: 398,
      x1: 412,
      z0: -168,
      z1: -154,
      height: 5,
      floor: materials.dirt,
      wall: materials.oakLumber,
      roof: materials.thatch,
      doorSide: "east",
    },
    {
      name: "Mudden Ward Laundry House",
      x0: 416,
      x1: 430,
      z0: -158,
      z1: -144,
      height: 5,
      floor: materials.dirt,
      wall: materials.oakLumber,
      roof: materials.thatch,
      doorSide: "east",
    },
    {
      name: "Watermill",
      x0: 414,
      x1: 436,
      z0: -120,
      z1: -104,
      height: 7,
      floor: materials.oakLumber,
      wall: materials.oakLumber,
      roof: materials.thatch,
      doorSide: "north",
    },
    {
      name: "Workshop",
      x0: 498,
      x1: 514,
      z0: -228,
      z1: -212,
      height: 6,
      floor: materials.cobblestone,
      wall: materials.oakLumber,
      roof: materials.thatch,
      doorSide: "west",
    },
    {
      name: "Inn",
      x0: 452,
      x1: 468,
      z0: -196,
      z1: -180,
      height: 7,
      floor: materials.oakLumber,
      wall: materials.oakLumber,
      roof: materials.thatch,
      doorSide: "east",
    },
    {
      name: "Archive House",
      x0: 501,
      x1: 516,
      z0: -196,
      z1: -181,
      height: 6,
      floor: materials.stonePolished,
      wall: materials.limestoneBrick,
      roof: materials.stoneShingles,
      doorSide: "west",
    },
  ] satisfies StarterBuilding[];
}

function localDevMaterials() {
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
    // Use block-like substitutes in the synthetic local world. Some flora
    // terrain IDs exist only as flora, and deletion paths expect block terrain.
    wheat: terrainId("hay", dirt),
    carrot: terrainId("yellow_wool", dirt),
    rose: terrainId("red_wool", grass),
    dandelion: terrainId("yellow_wool", grass),
    sunflower: terrainId("yellow_wool", grass),
    switchGrass: terrainId("moss", grass),
    woodCrate: terrainId("wood_crate", dirt),
    led: terrainId("led", stone),
    moss: terrainId("moss", grass),
    muckwad: terrainId("muckwad", terrainId("moss", grass)),
    sand: terrainId("sand", dirt),
    whiteWool: terrainId("white_wool", stone),
    yellowWool: terrainId("yellow_wool", dirt),
    redWool: terrainId("red_wool", dirt),
    blueWool: terrainId("blue_wool", stone),
    blackWool: terrainId("black_wool", stone),
    greenWool: terrainId("green_wool", grass),
    coal: terrainId("coal", stone),
    ironOre: terrainId("iron_ore", terrainId("coal", stone)),
    silverOre: terrainId("silver_ore", stone),
    goldOre: terrainId("gold_ore", stone),
    diamondOre: terrainId("diamond_ore", stone),
    water: terrainId("water", terrainId("blue_wool", stone)),
  };
}

function isStarterTownRoad(worldX: number, worldZ: number) {
  return (
    inRect(worldX, worldZ, 482, 490, -270, -156) ||
    inRect(worldX, worldZ, 416, 566, -214, -206) ||
    inRect(worldX, worldZ, 476, 500, -222, -196) ||
    inRect(worldX, worldZ, 448, 468, -256, -250) ||
    inRect(worldX, worldZ, 420, 486, -194, -188) ||
    inRect(worldX, worldZ, 542, 564, -224, -218) ||
    inRect(worldX, worldZ, 520, 542, -230, -224) ||
    inRect(worldX, worldZ, 448, 486, -180, -174) ||
    inRect(worldX, worldZ, 506, 526, -170, -164) ||
    inRect(worldX, worldZ, 532, 564, -196, -190) ||
    inRect(worldX, worldZ, 432, 460, -236, -230) ||
    inRect(worldX, worldZ, 482, 490, -286, -104) ||
    inRect(worldX, worldZ, 404, 586, -150, -142) ||
    inRect(worldX, worldZ, 560, 590, -262, -256) ||
    inRect(worldX, worldZ, 570, 604, -186, -180) ||
    inRect(worldX, worldZ, 396, 436, -162, -156) ||
    inRect(worldX, worldZ, 420, 488, -112, -106)
  );
}

function isStarterTownPlaza(worldX: number, worldZ: number) {
  return inRect(worldX, worldZ, 474, 498, -222, -196);
}

function isStarterTownFarm(worldX: number, worldZ: number) {
  return (
    inRect(worldX, worldZ, 432, 458, -246, -224) ||
    inRect(worldX, worldZ, 438, 474, -122, -106)
  );
}

function doorCenter(building: StarterBuilding): [number, number] {
  const midX = Math.floor((building.x0 + building.x1) / 2);
  const midZ = Math.floor((building.z0 + building.z1) / 2);
  switch (building.doorSide) {
    case "north":
      return [midX, building.z0];
    case "south":
      return [midX, building.z1];
    case "east":
      return [building.x1, midZ];
    case "west":
      return [building.x0, midZ];
  }
}

function isDoorOpening(
  building: StarterBuilding,
  worldX: number,
  worldY: number,
  worldZ: number,
) {
  if (!inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 3)) {
    return false;
  }
  const [doorX, doorZ] = doorCenter(building);
  if (building.doorSide === "north" || building.doorSide === "south") {
    return worldZ === doorZ && Math.abs(worldX - doorX) <= 1;
  }
  return worldX === doorX && Math.abs(worldZ - doorZ) <= 1;
}

function buildingBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  for (const building of starterBuildings(materials)) {
    const inside = inRect(
      worldX,
      worldZ,
      building.x0,
      building.x1,
      building.z0,
      building.z1,
    );
    const onOuterWall =
      inside &&
      (worldX === building.x0 ||
        worldX === building.x1 ||
        worldZ === building.z0 ||
        worldZ === building.z1);

    if (inside && worldY === STARTER_TOWN_GROUND_Y) {
      return building.floor;
    }

    if (
      building.name === "Player House" &&
      inside &&
      worldY === STARTER_TOWN_GROUND_Y + 5
    ) {
      const stairVoid =
        worldX >= building.x0 + 2 &&
        worldX <= building.x0 + 5 &&
        worldZ >= building.z1 - 4 &&
        worldZ <= building.z1 - 2;
      return stairVoid ? undefined : building.floor;
    }

    if (
      building.name === "Player House" &&
      worldX >= building.x0 + 2 &&
      worldX <= building.x0 + 5 &&
      worldZ === building.z1 - 3 &&
      worldY === STARTER_TOWN_GROUND_Y + (worldX - building.x0)
    ) {
      return materials.oakLumber;
    }

    if (
      onOuterWall &&
      inRange(
        worldY,
        STARTER_TOWN_GROUND_Y + 1,
        STARTER_TOWN_GROUND_Y + building.height - 1,
      )
    ) {
      if (isDoorOpening(building, worldX, worldY, worldZ)) {
        return undefined;
      }
      const isCorner =
        (worldX === building.x0 || worldX === building.x1) &&
        (worldZ === building.z0 || worldZ === building.z1);
      if (isCorner) {
        return materials.oakLog;
      }
      const windowBand =
        worldY === STARTER_TOWN_GROUND_Y + 3 && (worldX + worldZ) % 4 === 0;
      return windowBand ? materials.simpleGlass : building.wall;
    }

    if (
      inRect(
        worldX,
        worldZ,
        building.x0,
        building.x1,
        building.z0,
        building.z1,
        1,
      ) &&
      worldY === STARTER_TOWN_GROUND_Y + building.height
    ) {
      return building.roof;
    }

    if (
      building.name === "Workshop" &&
      inRect(
        worldX,
        worldZ,
        building.x1 - 3,
        building.x1 - 2,
        building.z0 + 2,
        building.z0 + 3,
      ) &&
      inRange(
        worldY,
        STARTER_TOWN_GROUND_Y + building.height + 1,
        STARTER_TOWN_GROUND_Y + building.height + 4,
      )
    ) {
      return materials.stoneBrick;
    }
  }

  return undefined;
}

function towerBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const x0 = 520;
  const x1 = 529;
  const z0 = -254;
  const z1 = -245;
  if (!inRect(worldX, worldZ, x0, x1, z0, z1, 1)) {
    return undefined;
  }

  const inside = inRect(worldX, worldZ, x0, x1, z0, z1);
  const wall =
    inside &&
    (worldX === x0 || worldX === x1 || worldZ === z0 || worldZ === z1);
  if (inside && worldY === STARTER_TOWN_GROUND_Y) {
    return materials.stonePolished;
  }
  if (
    wall &&
    inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 15)
  ) {
    const door =
      worldZ === z1 &&
      Math.abs(worldX - Math.floor((x0 + x1) / 2)) <= 1 &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 3);
    if (door) {
      return undefined;
    }
    const window =
      [
        STARTER_TOWN_GROUND_Y + 6,
        STARTER_TOWN_GROUND_Y + 10,
        STARTER_TOWN_GROUND_Y + 14,
      ].includes(worldY) && (worldX + worldZ) % 3 === 0;
    return window ? materials.simpleGlass : materials.stoneBrick;
  }
  if (
    inRect(worldX, worldZ, x0, x1, z0, z1, 1) &&
    worldY === STARTER_TOWN_GROUND_Y + 16
  ) {
    return materials.led;
  }
  return undefined;
}

function marketBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const stalls = [
    [526, 533, -205, -199],
    [526, 533, -194, -188],
    [438, 445, -203, -197],
  ] as const;
  for (const [x0, x1, z0, z1] of stalls) {
    if (!inRect(worldX, worldZ, x0, x1, z0, z1)) {
      continue;
    }
    const post =
      (worldX === x0 || worldX === x1) && (worldZ === z0 || worldZ === z1);
    if (
      post &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 4)
    ) {
      return materials.oakLog;
    }
    if (worldY === STARTER_TOWN_GROUND_Y + 5) {
      return materials.hay;
    }
    if (
      worldY === STARTER_TOWN_GROUND_Y + 1 &&
      inRect(worldX, worldZ, x0 + 2, x1 - 2, z0 + 2, z1 - 2)
    ) {
      return materials.woodCrate;
    }
  }
  return undefined;
}

function treeBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const trees = [
    [431, -187],
    [444, -260],
    [463, -253],
    [533, -232],
    [545, -180],
    [414, -217],
    [559, -211],
  ] as const;
  for (const [tx, tz] of trees) {
    const dx = Math.abs(worldX - tx);
    const dz = Math.abs(worldZ - tz);
    if (
      dx === 0 &&
      dz === 0 &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 6)
    ) {
      return materials.oakLog;
    }
    const leafY = worldY - (STARTER_TOWN_GROUND_Y + 6);
    if (leafY >= -1 && leafY <= 3 && dx + dz + Math.abs(leafY - 1) <= 5) {
      return materials.oakLeaf;
    }
  }
  return undefined;
}

function wellBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const dx = Math.abs(worldX - 486);
  const dz = Math.abs(worldZ + 190);
  if (dx <= 2 && dz <= 2) {
    if (worldY === STARTER_TOWN_GROUND_Y + 1 && (dx === 2 || dz === 2)) {
      return materials.cobblestone;
    }
    if ((dx === 2 && dz === 0) || (dx === 0 && dz === 2)) {
      if (
        inRange(worldY, STARTER_TOWN_GROUND_Y + 2, STARTER_TOWN_GROUND_Y + 4)
      ) {
        return materials.oakLog;
      }
    }
    if (worldY === STARTER_TOWN_GROUND_Y + 5 && dz <= 2) {
      return materials.oakLumber;
    }
  }
  return undefined;
}

function blockRange(
  worldX: number,
  worldY: number,
  worldZ: number,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y0: number,
  y1 = y0,
) {
  return (
    inRect(worldX, worldZ, x0, x1, z0, z1) &&
    inRange(worldY, STARTER_TOWN_GROUND_Y + y0, STARTER_TOWN_GROUND_Y + y1)
  );
}

function starterTownDenseInteriorBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  // Disabled by default. Dense block-built interiors create real terrain
  // collision and can trap players in doors, shop lanes, and interior paths.
  // Keep this as an emergency fallback only.
  if (process.env.BIOMES_LOCAL_DEV_BLOCK_INTERIORS !== "1") {
    return undefined;
  }

  // Dense, block-built interiors and exterior shop identity props. These use only
  // terrain blocks from the local snapshot so they cannot 404 like production
  // meshes, icons, or decals.

  // --- Player House: real home base, not an empty shell ---
  if (blockRange(worldX, worldY, worldZ, 451, 455, -263, -261, 1)) {
    return worldZ === -261 ? materials.whiteWool : materials.redWool; // downstairs bed.
  }
  if (blockRange(worldX, worldY, worldZ, 458, 462, -257, -255, 1)) {
    return materials.oakLumber; // dining table.
  }
  if (
    blockRange(worldX, worldY, worldZ, 457, 457, -258, -254, 1) ||
    blockRange(worldX, worldY, worldZ, 463, 463, -258, -254, 1)
  ) {
    return materials.oakLumber; // chairs/benches.
  }
  if (blockRange(worldX, worldY, worldZ, 463, 464, -252, -250, 1, 3)) {
    return worldY === STARTER_TOWN_GROUND_Y + 1
      ? materials.coal
      : materials.stoneBrick; // hearth/chimney base.
  }
  if (blockRange(worldX, worldY, worldZ, 450, 450, -256, -250, 1, 4)) {
    return (worldY + worldZ) % 2 === 0
      ? materials.oakLumber
      : materials.yellowWool; // books/shelves.
  }
  if (blockRange(worldX, worldY, worldZ, 456, 459, -250, -249, 1)) {
    return materials.woodCrate; // storage chest cluster.
  }
  if (blockRange(worldX, worldY, worldZ, 458, 460, -261, -259, 1)) {
    return materials.blueWool; // rug and starter journal corner.
  }
  if (blockRange(worldX, worldY, worldZ, 452, 456, -263, -261, 6)) {
    return worldZ === -261 ? materials.whiteWool : materials.blueWool; // upstairs bed.
  }
  if (blockRange(worldX, worldY, worldZ, 459, 463, -257, -255, 6)) {
    return materials.oakLumber; // upstairs desk.
  }
  if (blockRange(worldX, worldY, worldZ, 450, 450, -263, -255, 6, 8)) {
    return materials.oakLumber; // upstairs shelf wall.
  }
  if (blockRange(worldX, worldY, worldZ, 456, 462, -249, -248, 6)) {
    return materials.redWool; // upstairs rug.
  }

  // --- Dawn Loaf Bakery: oven, racks, sacks, counter, exterior bread display ---
  if (blockRange(worldX, worldY, worldZ, 422, 426, -198, -194, 1, 4)) {
    if (
      worldY === STARTER_TOWN_GROUND_Y + 2 &&
      inRect(worldX, worldZ, 423, 425, -197, -195)
    ) {
      return materials.coal;
    }
    return materials.stoneBrick;
  }
  if (blockRange(worldX, worldY, worldZ, 424, 424, -196, -196, 5, 8)) {
    return materials.stoneBrick; // oven chimney.
  }
  if (blockRange(worldX, worldY, worldZ, 434, 436, -197, -187, 1, 2)) {
    return materials.oakLumber; // long sales counter.
  }
  if (blockRange(worldX, worldY, worldZ, 421, 421, -192, -186, 1, 4)) {
    return (worldY + worldZ) % 2 === 0 ? materials.hay : materials.yellowWool; // bread racks.
  }
  if (blockRange(worldX, worldY, worldZ, 427, 431, -188, -186, 1)) {
    return materials.whiteWool; // flour sacks.
  }
  if (blockRange(worldX, worldY, worldZ, 428, 432, -193, -191, 1)) {
    return materials.oakLumber; // kneading table.
  }
  if (blockRange(worldX, worldY, worldZ, 439, 442, -197, -193, 1)) {
    return (worldX + worldZ) % 2 === 0 ? materials.hay : materials.yellowWool; // outside bread baskets.
  }

  // --- Harthmere Bank: vault, queue, ledgers, lockboxes, coins ---
  if (blockRange(worldX, worldY, worldZ, 546, 548, -230, -216, 1, 3)) {
    return materials.oakLumber; // teller counter.
  }
  if (blockRange(worldX, worldY, worldZ, 559, 561, -228, -218, 1, 6)) {
    return worldY === STARTER_TOWN_GROUND_Y + 3
      ? materials.coal
      : materials.stoneBrick; // vault door wall.
  }
  if (blockRange(worldX, worldY, worldZ, 551, 555, -229, -226, 1, 2)) {
    return materials.woodCrate; // lockboxes.
  }
  if (blockRange(worldX, worldY, worldZ, 552, 556, -218, -216, 1)) {
    return materials.yellowWool; // coin table.
  }
  if (
    blockRange(worldX, worldY, worldZ, 550, 550, -222, -216, 1, 2) ||
    blockRange(worldX, worldY, worldZ, 556, 556, -222, -216, 1, 2)
  ) {
    return materials.oakLog; // queue rails.
  }
  if (blockRange(worldX, worldY, worldZ, 563, 566, -224, -220, 1)) {
    return materials.stoneBrick; // exterior vault sign/display.
  }

  // --- Black Anvil / Weapons Shop: weapons, forge, shield wall, armor display ---
  if (blockRange(worldX, worldY, worldZ, 522, 526, -236, -232, 1, 4)) {
    return worldY === STARTER_TOWN_GROUND_Y + 2
      ? materials.coal
      : materials.stoneBrick; // forge.
  }
  if (blockRange(worldX, worldY, worldZ, 528, 531, -235, -233, 1)) {
    return materials.coal; // anvil.
  }
  if (blockRange(worldX, worldY, worldZ, 537, 538, -236, -222, 1, 4)) {
    return (worldY + worldZ) % 2 === 0
      ? materials.oakLumber
      : materials.stoneBrick; // weapon racks.
  }
  if (blockRange(worldX, worldY, worldZ, 524, 527, -222, -221, 1)) {
    return materials.blueWool; // water trough.
  }
  if (blockRange(worldX, worldY, worldZ, 532, 535, -223, -221, 1, 3)) {
    return (worldX + worldY + worldZ) % 2 === 0
      ? materials.redWool
      : materials.blackWool; // shield wall.
  }
  if (blockRange(worldX, worldY, worldZ, 540, 543, -231, -227, 1, 3)) {
    return worldY === STARTER_TOWN_GROUND_Y + 1
      ? materials.oakLumber
      : materials.stoneBrick; // exterior armor stand / sign.
  }

  // --- Green Mortar Healing Shop: treatment bed, herb shelves, bottles, mortar ---
  if (blockRange(worldX, worldY, worldZ, 450, 454, -181, -179, 1)) {
    return worldZ === -179 ? materials.whiteWool : materials.greenWool;
  }
  if (blockRange(worldX, worldY, worldZ, 461, 462, -182, -170, 1, 4)) {
    return (worldY + worldZ) % 2 === 0
      ? materials.greenWool
      : materials.yellowWool; // herb/potion shelves.
  }
  if (blockRange(worldX, worldY, worldZ, 455, 459, -172, -170, 1)) {
    return materials.stonePolished; // mortar table.
  }
  if (blockRange(worldX, worldY, worldZ, 451, 451, -174, -170, 1, 4)) {
    return materials.moss; // hanging herbs.
  }
  if (blockRange(worldX, worldY, worldZ, 464, 467, -180, -176, 1)) {
    return (worldX + worldZ) % 2 === 0
      ? materials.greenWool
      : materials.whiteWool; // outside remedy display.
  }

  // --- Wyrm & Candle Magic Supply: books, scrolls, candles, crystal, locked room ---
  if (blockRange(worldX, worldY, worldZ, 508, 508, -173, -161, 1, 5)) {
    return (worldY + worldZ) % 2 === 0
      ? materials.blueWool
      : materials.blackWool; // book wall.
  }
  if (blockRange(worldX, worldY, worldZ, 520, 522, -173, -161, 1, 5)) {
    return (worldY + worldZ) % 2 === 0
      ? materials.blackWool
      : materials.whiteWool; // scroll shelves.
  }
  if (blockRange(worldX, worldY, worldZ, 513, 517, -169, -165, 1)) {
    return materials.stonePolished; // arcane table.
  }
  if (blockRange(worldX, worldY, worldZ, 515, 515, -167, -167, 2, 5)) {
    return materials.led; // glowing crystal.
  }
  if (blockRange(worldX, worldY, worldZ, 512, 518, -164, -160, 1)) {
    return materials.redWool; // ritual rug.
  }
  if (blockRange(worldX, worldY, worldZ, 523, 526, -170, -166, 1, 4)) {
    return materials.led; // exterior magic sign / beacon.
  }
  const candleSpots = [
    [511, -172],
    [519, -172],
    [511, -162],
    [519, -162],
    [514, -165],
    [516, -169],
  ] as const;
  for (const [cx, cz] of candleSpots) {
    if (
      worldX === cx &&
      worldZ === cz &&
      worldY === STARTER_TOWN_GROUND_Y + 1
    ) {
      return materials.yellowWool;
    }
  }

  // --- Copper Kettle Tavern: bar, tables, chairs, stage, hearth, kegs, kitchen ---
  if (blockRange(worldX, worldY, worldZ, 534, 536, -204, -183, 1, 2)) {
    return materials.oakLumber; // long bar.
  }
  if (blockRange(worldX, worldY, worldZ, 537, 537, -202, -184, 3, 4)) {
    return (worldY + worldZ) % 2 === 0 ? materials.hay : materials.yellowWool; // bottle shelves.
  }
  if (blockRange(worldX, worldY, worldZ, 555, 560, -204, -198, 1)) {
    return materials.oakLumber; // stage.
  }
  if (blockRange(worldX, worldY, worldZ, 558, 561, -186, -182, 1, 3)) {
    return worldY === STARTER_TOWN_GROUND_Y + 1
      ? materials.coal
      : materials.stoneBrick; // hearth.
  }
  const tavernTables = [
    [542, -198],
    [550, -198],
    [544, -190],
    [552, -190],
    [546, -184],
  ] as const;
  for (const [tx, tz] of tavernTables) {
    if (blockRange(worldX, worldY, worldZ, tx - 1, tx + 1, tz - 1, tz + 1, 1)) {
      return materials.oakLumber;
    }
    if (
      worldY === STARTER_TOWN_GROUND_Y + 1 &&
      Math.abs(worldX - tx) + Math.abs(worldZ - tz) === 3
    ) {
      return materials.oakLumber; // chairs.
    }
  }
  if (blockRange(worldX, worldY, worldZ, 532, 533, -204, -198, 1, 2)) {
    return materials.hay; // kegs.
  }
  if (blockRange(worldX, worldY, worldZ, 563, 566, -198, -192, 1)) {
    return materials.yellowWool; // exterior kettle sign.
  }

  // --- Chapel, Reeve Hall, Guard Yard, Docks, Mudden Ward, Farm details ---
  if (blockRange(worldX, worldY, worldZ, 468, 486, -147, -147, 1, 2)) {
    return materials.oakLumber; // pews.
  }
  if (blockRange(worldX, worldY, worldZ, 475, 479, -131, -130, 1, 3)) {
    return materials.stonePolished; // altar.
  }
  if (blockRange(worldX, worldY, worldZ, 478, 478, -129, -129, 4, 7)) {
    return worldY === STARTER_TOWN_GROUND_Y + 7
      ? materials.blackWool
      : materials.oakLog; // empty bell frame.
  }
  if (blockRange(worldX, worldY, worldZ, 552, 576, -252, -252, 1, 3)) {
    return materials.redWool; // Reeve Hall red banner rail.
  }
  if (blockRange(worldX, worldY, worldZ, 552, 558, -264, -260, 1)) {
    return materials.oakLumber; // tax clerk desks.
  }
  if (blockRange(worldX, worldY, worldZ, 562, 570, -264, -260, 1)) {
    return materials.yellowWool; // permit/ledger table.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRange(worldX, 505, 518) &&
    [-266, -262].includes(worldZ)
  ) {
    return materials.oakLumber; // training rails.
  }
  if (
    blockRange(worldX, worldY, worldZ, 508, 508, -269, -269, 1, 4) ||
    blockRange(worldX, worldY, worldZ, 516, 516, -269, -269, 1, 4)
  ) {
    return materials.hay; // practice dummies.
  }
  if (blockRange(worldX, worldY, worldZ, 578, 584, -186, -178, 1, 2)) {
    return materials.woodCrate; // cargo stack.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRange(worldX, 592, 604) &&
    [-189, -177, -165].includes(worldZ)
  ) {
    return materials.oakLumber; // dock tables.
  }
  if (blockRange(worldX, worldY, worldZ, 596, 599, -181, -179, 1, 3)) {
    return materials.blackWool; // suspicious crate.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 3 &&
    inRange(worldX, 400, 430) &&
    [-158, -150].includes(worldZ)
  ) {
    return materials.whiteWool; // laundry lines.
  }
  if (blockRange(worldX, worldY, worldZ, 402, 407, -166, -164, 1)) {
    return materials.hay; // patched bedding.
  }
  if (blockRange(worldX, worldY, worldZ, 420, 426, -156, -154, 1)) {
    return materials.blueWool; // wash tubs.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRect(worldX, worldZ, 431, 459, -247, -223) &&
    (worldX === 431 || worldX === 459 || worldZ === -247 || worldZ === -223)
  ) {
    return materials.oakLog; // chicken-yard fence.
  }
  if (blockRange(worldX, worldY, worldZ, 435, 442, -224, -222, 1, 2)) {
    return materials.hay; // hay bales.
  }
  if (blockRange(worldX, worldY, worldZ, 455, 457, -245, -241, 1)) {
    return materials.blueWool; // water trough.
  }
  if (blockRange(worldX, worldY, worldZ, 443, 445, -242, -242, 4)) {
    return materials.hay; // scarecrow arms.
  }
  if (blockRange(worldX, worldY, worldZ, 444, 444, -242, -242, 1, 5)) {
    return worldY === STARTER_TOWN_GROUND_Y + 5
      ? materials.yellowWool
      : materials.oakLog;
  }

  return undefined;
}

function starterTownInteriorAndStoryBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  // --- New-player signpost and Market Board / quest hub ---
  // These are deliberately block-built so they never 404 on missing sign or UI assets.
  if (blockRange(worldX, worldY, worldZ, 482, 490, -268, -268, 1, 4)) {
    return worldX === 486 && worldY === STARTER_TOWN_GROUND_Y + 4
      ? materials.yellowWool
      : materials.oakLumber;
  }
  if (blockRange(worldX, worldY, worldZ, 500, 506, -211, -211, 1, 5)) {
    if (
      (worldX === 500 || worldX === 506) &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 5)
    ) {
      return materials.oakLog;
    }
    if (worldY === STARTER_TOWN_GROUND_Y + 5 && worldX === 503) {
      return materials.yellowWool; // visible quest marker above the Market Board.
    }
    if (worldY === STARTER_TOWN_GROUND_Y + 4 && worldX === 503) {
      return materials.blackWool;
    }
    return materials.oakLumber;
  }
  // Colored direction signs around the square: inn, bank, smithy, chapel, docks, farm, guard yard.
  const signs = [
    [492, -205, materials.redWool],
    [494, -216, materials.blueWool],
    [478, -205, materials.greenWool],
    [480, -216, materials.yellowWool],
    [486, -224, materials.redWool],
    [486, -195, materials.blueWool],
    [474, -211, materials.yellowWool],
  ] as const;
  for (const [sx, sz, mat] of signs) {
    if (
      worldX === sx &&
      worldZ === sz &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 2)
    ) {
      return materials.oakLog;
    }
    if (
      Math.abs(worldX - sx) <= 1 &&
      worldZ === sz &&
      worldY === STARTER_TOWN_GROUND_Y + 3
    ) {
      return mat;
    }
  }

  // Keep the local-dev town playable by default. Dense furniture, counters,
  // racks, beds, and shop clutter are now rendered as visual-only curated
  // GLB/OBJ/FBX props in the Harthmere runtime asset renderer. Block-built
  // furniture is useful as an emergency fallback, but it creates real terrain
  // collision and was forcing players to dig through interiors and door lanes.
  if (process.env.BIOMES_LOCAL_DEV_BLOCK_INTERIORS !== "1") {
    return undefined;
  }

  // --- Player House: two levels with home-base details ---
  if (blockRange(worldX, worldY, worldZ, 451, 455, -263, -261, 1)) {
    return worldZ === -261 ? materials.whiteWool : materials.redWool; // downstairs bed.
  }
  if (blockRange(worldX, worldY, worldZ, 458, 461, -255, -253, 1)) {
    return materials.oakLumber; // table.
  }
  if (blockRange(worldX, worldY, worldZ, 463, 464, -252, -250, 1, 2)) {
    return worldY === STARTER_TOWN_GROUND_Y + 1
      ? materials.coal
      : materials.stoneBrick; // hearth.
  }
  if (blockRange(worldX, worldY, worldZ, 450, 450, -256, -250, 1, 3)) {
    return materials.oakLumber; // shelves.
  }
  if (blockRange(worldX, worldY, worldZ, 457, 458, -249, -248, 1)) {
    return materials.blueWool; // starter journal / welcome note.
  }
  if (blockRange(worldX, worldY, worldZ, 452, 456, -263, -261, 6)) {
    return worldZ === -261 ? materials.whiteWool : materials.blueWool; // upstairs bed.
  }
  if (blockRange(worldX, worldY, worldZ, 460, 463, -257, -255, 6)) {
    return materials.oakLumber; // upstairs desk.
  }
  if (blockRange(worldX, worldY, worldZ, 449, 465, -247, -247, 6)) {
    return materials.redWool; // upstairs rug edge.
  }

  // --- Dawn Loaf Bakery ---
  if (blockRange(worldX, worldY, worldZ, 422, 425, -198, -195, 1, 3)) {
    return worldY === STARTER_TOWN_GROUND_Y + 2 &&
      inRect(worldX, worldZ, 423, 424, -197, -196)
      ? materials.coal
      : materials.stoneBrick; // oven.
  }
  if (blockRange(worldX, worldY, worldZ, 434, 436, -197, -187, 1)) {
    return materials.oakLumber; // counter.
  }
  if (blockRange(worldX, worldY, worldZ, 421, 421, -191, -186, 1, 3)) {
    return (worldY + worldZ) % 2 === 0 ? materials.hay : materials.yellowWool; // bread shelves.
  }
  if (blockRange(worldX, worldY, worldZ, 427, 430, -188, -186, 1)) {
    return materials.whiteWool; // flour sacks.
  }

  // --- Harthmere Bank ---
  if (blockRange(worldX, worldY, worldZ, 546, 548, -230, -216, 1, 2)) {
    return materials.oakLumber; // teller counter.
  }
  if (blockRange(worldX, worldY, worldZ, 559, 561, -228, -218, 1, 5)) {
    return worldY === STARTER_TOWN_GROUND_Y + 3
      ? materials.coal
      : materials.stoneBrick; // vault door / wall.
  }
  if (blockRange(worldX, worldY, worldZ, 551, 555, -229, -226, 1)) {
    return materials.woodCrate; // lockboxes.
  }
  if (blockRange(worldX, worldY, worldZ, 552, 556, -218, -216, 1)) {
    return materials.yellowWool; // coin ledger table.
  }

  // --- Black Anvil / Weapons Shop ---
  if (blockRange(worldX, worldY, worldZ, 522, 525, -236, -233, 1, 3)) {
    return worldY === STARTER_TOWN_GROUND_Y + 2
      ? materials.coal
      : materials.stoneBrick; // forge.
  }
  if (blockRange(worldX, worldY, worldZ, 528, 531, -235, -233, 1)) {
    return materials.coal; // anvil.
  }
  if (blockRange(worldX, worldY, worldZ, 537, 538, -236, -222, 1, 3)) {
    return (worldY + worldZ) % 2 === 0
      ? materials.oakLumber
      : materials.stoneBrick; // weapon racks.
  }
  if (blockRange(worldX, worldY, worldZ, 524, 527, -222, -221, 1)) {
    return materials.blueWool; // water trough.
  }
  if (blockRange(worldX, worldY, worldZ, 532, 534, -223, -221, 1, 2)) {
    return materials.redWool; // shield display.
  }

  // --- Green Mortar Healing Shop ---
  if (blockRange(worldX, worldY, worldZ, 450, 454, -181, -179, 1)) {
    return worldZ === -179 ? materials.whiteWool : materials.greenWool; // treatment bed.
  }
  if (blockRange(worldX, worldY, worldZ, 461, 462, -182, -170, 1, 3)) {
    return (worldY + worldZ) % 2 === 0
      ? materials.greenWool
      : materials.yellowWool; // herb/potion shelves.
  }
  if (blockRange(worldX, worldY, worldZ, 455, 458, -172, -170, 1)) {
    return materials.stonePolished; // mortar table.
  }
  if (blockRange(worldX, worldY, worldZ, 451, 451, -173, -170, 1, 3)) {
    return materials.moss; // hanging herbs.
  }

  // --- Wyrm & Candle Magic Supply ---
  if (blockRange(worldX, worldY, worldZ, 508, 508, -173, -161, 1, 4)) {
    return materials.blueWool; // book wall.
  }
  if (blockRange(worldX, worldY, worldZ, 520, 522, -173, -161, 1, 4)) {
    return materials.blackWool; // scroll/book shelves.
  }
  if (blockRange(worldX, worldY, worldZ, 514, 516, -168, -166, 1)) {
    return materials.stonePolished; // arcane desk.
  }
  if (blockRange(worldX, worldY, worldZ, 515, 515, -167, -167, 2, 4)) {
    return materials.led; // glowing crystal.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    Math.abs(worldX - 515) + Math.abs(worldZ + 167) === 4
  ) {
    return materials.yellowWool; // candle circle.
  }

  // --- Copper Kettle Tavern ---
  if (blockRange(worldX, worldY, worldZ, 534, 536, -203, -183, 1, 2)) {
    return materials.oakLumber; // bar counter.
  }
  if (blockRange(worldX, worldY, worldZ, 558, 561, -203, -198, 1)) {
    return materials.redWool; // bard stage.
  }
  if (blockRange(worldX, worldY, worldZ, 553, 557, -185, -181, 1, 3)) {
    return worldY === STARTER_TOWN_GROUND_Y + 2
      ? materials.coal
      : materials.stoneBrick; // hearth.
  }
  const tavernTables = [
    [543, -199],
    [551, -199],
    [543, -190],
    [551, -190],
    [547, -185],
  ] as const;
  for (const [tx, tz] of tavernTables) {
    if (blockRange(worldX, worldY, worldZ, tx - 1, tx + 1, tz - 1, tz + 1, 1)) {
      return worldX === tx && worldZ === tz
        ? materials.oakLumber
        : materials.hay;
    }
  }
  if (blockRange(worldX, worldY, worldZ, 537, 538, -183, -181, 1, 3)) {
    return materials.yellowWool; // drink/food shelves.
  }

  // --- Chapel, grave story, and missing bell clue ---
  if (blockRange(worldX, worldY, worldZ, 474, 480, -132, -130, 1, 2)) {
    return materials.whiteWool; // altar.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRange(worldX, 466, 488) &&
    [-142, -138, -134].includes(worldZ)
  ) {
    return materials.oakLumber; // pew rows.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRect(worldX, worldZ, 468, 486, -148, -148) &&
    worldX % 3 === 0
  ) {
    return materials.yellowWool; // chapel candles.
  }
  if (blockRange(worldX, worldY, worldZ, 477, 481, -150, -150, 2, 5)) {
    return worldY === STARTER_TOWN_GROUND_Y + 5
      ? materials.blackWool
      : materials.oakLog; // empty bell frame.
  }

  // --- Guard yard and Reeve Hall ---
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRange(worldX, 505, 518) &&
    [-266, -262].includes(worldZ)
  ) {
    return materials.oakLumber; // training rails.
  }
  if (
    blockRange(worldX, worldY, worldZ, 508, 508, -269, -269, 1, 3) ||
    blockRange(worldX, worldY, worldZ, 516, 516, -269, -269, 1, 3)
  ) {
    return materials.hay; // practice dummies.
  }
  if (blockRange(worldX, worldY, worldZ, 552, 576, -252, -252, 1, 2)) {
    return materials.redWool; // Reeve Hall red banner rail.
  }
  if (blockRange(worldX, worldY, worldZ, 552, 556, -264, -260, 1)) {
    return materials.oakLumber; // tax clerk desks.
  }

  // --- Docks and Mudden Ward details ---
  if (blockRange(worldX, worldY, worldZ, 578, 584, -186, -178, 1)) {
    return materials.woodCrate; // cargo stack in dockmaster shed.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRange(worldX, 592, 604) &&
    [-189, -177, -165].includes(worldZ)
  ) {
    return materials.oakLumber; // dock benches / fish tables.
  }
  if (blockRange(worldX, worldY, worldZ, 596, 598, -181, -179, 1, 2)) {
    return materials.blackWool; // suspicious whispering crate.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 3 &&
    inRange(worldX, 400, 430) &&
    [-158, -150].includes(worldZ)
  ) {
    return materials.whiteWool; // laundry lines.
  }
  if (blockRange(worldX, worldY, worldZ, 402, 406, -166, -164, 1)) {
    return materials.hay; // patched bed / poor-home detail.
  }
  if (blockRange(worldX, worldY, worldZ, 420, 426, -156, -154, 1)) {
    return materials.blueWool; // wash tubs / water detail.
  }

  // --- Farm and orchard details ---
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRect(worldX, worldZ, 431, 459, -247, -223) &&
    (worldX === 431 || worldX === 459 || worldZ === -247 || worldZ === -223)
  ) {
    return materials.oakLog; // chicken-yard fence.
  }
  if (blockRange(worldX, worldY, worldZ, 435, 440, -224, -222, 1, 2)) {
    return materials.hay; // hay bales.
  }
  if (blockRange(worldX, worldY, worldZ, 455, 457, -245, -241, 1)) {
    return materials.blueWool; // water trough.
  }
  if (blockRange(worldX, worldY, worldZ, 444, 444, -242, -242, 1, 4)) {
    return materials.oakLog; // scarecrow post.
  }
  if (blockRange(worldX, worldY, worldZ, 443, 445, -242, -242, 4)) {
    return materials.hay; // scarecrow arms.
  }
  if (blockRange(worldX, worldY, worldZ, 444, 444, -242, -242, 5)) {
    return materials.yellowWool; // scarecrow head.
  }

  return undefined;
}

// HARTHMERE_CLEAN_TOWN_REBUILD_V6_START

// HARTHMERE_SERVER_VOXEL_ALL_BUILDINGS_DUNGEONS_V64
// Server-side terrain is now the owner for structural buildings, town walls,
// bridge parapets, watchtowers, and the Old Well/Underways dungeon. Runtime
// GLB assets may still decorate rooms, but walls/floors/ceilings/stairs are
// real voxel terrain blocks seeded by the shim.
const HARTHMERE_SERVER_VOXEL_ALL_BUILDINGS_DUNGEONS_VERSION_V64 =
  "harthmere-server-voxel-all-buildings-dungeons-v64";

// Preserve the V6 names because starterTownSurfaceMaterial() and
// starterTownAboveGroundBlockAt() already call these functions.
type HarthmereV6Mat = keyof ReturnType<typeof localDevMaterials>;
type HarthmereV6DoorSide = "north" | "south" | "east" | "west";
type HarthmereV64Profile =
  | "house"
  | "service"
  | "apartment"
  | "slum"
  | "gatehouse"
  | "tower"
  | "bridge"
  | "dungeon";

type HarthmereV64Stairs = {
  x0: number;
  z0: number;
  width: number;
  length: number;
  direction: "east" | "west" | "north" | "south";
};

type HarthmereV64Balcony = {
  side: "north" | "south" | "east" | "west";
  start: number;
  end: number;
  depth: number;
  floor: number;
  material?: HarthmereV6Mat;
};

type HarthmereV6Building = {
  name: string;
  district: string;
  profile?: HarthmereV64Profile;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  wall: HarthmereV6Mat;
  roof: HarthmereV6Mat;
  floor: HarthmereV6Mat;
  trim?: HarthmereV6Mat;
  doorSide: HarthmereV6DoorSide;
  doorCenter: number;
  floors?: number;
  upper?: boolean;
  stairs?: HarthmereV64Stairs;
  balcony?: HarthmereV64Balcony;
  chimney?: [number, number];
};

function harthmereV64StairsFor(
  x0: number,
  z0: number,
  direction: HarthmereV64Stairs["direction"] = "east",
  length = 5,
  width = 2,
): HarthmereV64Stairs {
  return { x0, z0, direction, length, width };
}

const HARTHMERE_V6_BUILDINGS: HarthmereV6Building[] = [
  // --- North Gate / walls / guard structures ---
  { name: "north_gate_west_gatehouse", district: "North Gate", profile: "gatehouse", x0: 462, x1: 476, z0: -288, z1: -270, wall: "stoneBrick", roof: "stoneShingles", floor: "stonePolished", trim: "coal", doorSide: "south", doorCenter: 469, floors: 2, stairs: harthmereV64StairsFor(465, -276, "east"), chimney: [464, -285] },
  { name: "north_gate_east_gatehouse", district: "North Gate", profile: "gatehouse", x0: 498, x1: 512, z0: -288, z1: -270, wall: "stoneBrick", roof: "stoneShingles", floor: "stonePolished", trim: "coal", doorSide: "south", doorCenter: 505, floors: 2, stairs: harthmereV64StairsFor(501, -276, "east"), chimney: [510, -285] },
  { name: "north_gate_toll_booth", district: "North Gate", profile: "service", x0: 478, x1: 492, z0: -272, z1: -258, wall: "stoneBrick", roof: "redWool", floor: "stonePolished", trim: "yellowWool", doorSide: "south", doorCenter: 485, floors: 1 },
  { name: "harthmere_stables", district: "North Gate", profile: "service", x0: 440, x1: 458, z0: -276, z1: -254, wall: "stoneBrick", roof: "hay", floor: "dirt", trim: "yellowWool", doorSide: "east", doorCenter: -265, floors: 1 },
  { name: "guard_yard_office", district: "Guard District", profile: "service", x0: 500, x1: 524, z0: -278, z1: -258, wall: "stoneBrick", roof: "redWool", floor: "stonePolished", trim: "blackWool", doorSide: "south", doorCenter: 512, floors: 1, chimney: [522, -275] },
  { name: "guard_barracks_bunkhouse", district: "Guard District", profile: "service", x0: 526, x1: 548, z0: -278, z1: -258, wall: "stoneBrick", roof: "redWool", floor: "stonePolished", trim: "blackWool", doorSide: "south", doorCenter: 537, floors: 2, stairs: harthmereV64StairsFor(530, -272, "east") },

  // --- Residential / player / noble rise ---
  { name: "traveler_hearth_player_house", district: "Residential District", profile: "house", x0: 448, x1: 466, z0: -266, z1: -246, wall: "stoneBrick", roof: "blueWool", floor: "stonePolished", trim: "whiteWool", doorSide: "east", doorCenter: -256, floors: 2, upper: true, stairs: harthmereV64StairsFor(452, -260, "east"), balcony: { side: "east", start: -262, end: -252, depth: 3, floor: 2, material: "stonePolished" }, chimney: [450, -263] },
  { name: "mara_thistle_two_story_house", district: "Residential District", profile: "house", x0: 470, x1: 490, z0: -246, z1: -226, wall: "stoneBrick", roof: "greenWool", floor: "stonePolished", trim: "whiteWool", doorSide: "south", doorCenter: 480, floors: 2, stairs: harthmereV64StairsFor(474, -240, "east"), balcony: { side: "south", start: 475, end: 486, depth: 3, floor: 2, material: "stonePolished" }, chimney: [488, -242] },
  { name: "reeve_hall", district: "Noble Rise", profile: "service", x0: 550, x1: 582, z0: -272, z1: -250, wall: "stonePolished", roof: "redWool", floor: "stoneBrick", trim: "greenWool", doorSide: "south", doorCenter: 566, floors: 2, upper: true, stairs: harthmereV64StairsFor(554, -266, "east"), balcony: { side: "south", start: 558, end: 574, depth: 3, floor: 2, material: "stoneBrick" }, chimney: [579, -269] },
  { name: "edrik_vane_noble_rise_estate", district: "Noble Rise", profile: "service", x0: 586, x1: 622, z0: -276, z1: -248, wall: "stonePolished", roof: "redWool", floor: "stoneBrick", trim: "goldOre", doorSide: "west", doorCenter: -262, floors: 2, stairs: harthmereV64StairsFor(592, -270, "east"), balcony: { side: "west", start: -270, end: -256, depth: 3, floor: 2, material: "stoneBrick" }, chimney: [618, -272] },

  // --- Market / services / crafting ---
  { name: "dawn_loaf_bakery", district: "Market District", profile: "service", x0: 418, x1: 442, z0: -204, z1: -184, wall: "stoneBrick", roof: "yellowWool", floor: "stoneBrick", trim: "hay", doorSide: "east", doorCenter: -194, floors: 1, chimney: [421, -201] },
  { name: "brindle_provision_house", district: "Market District", profile: "service", x0: 444, x1: 464, z0: -226, z1: -208, wall: "stoneBrick", roof: "greenWool", floor: "stoneBrick", trim: "yellowWool", doorSide: "south", doorCenter: 454, floors: 1 },
  { name: "market_auction_office", district: "Player Services Plaza", profile: "service", x0: 500, x1: 518, z0: -226, z1: -208, wall: "stonePolished", roof: "greenWool", floor: "stoneBrick", trim: "yellowWool", doorSide: "west", doorCenter: -217, floors: 1 },
  { name: "brass_scale_bank", district: "Player Services Plaza", profile: "service", x0: 546, x1: 568, z0: -236, z1: -214, wall: "stonePolished", roof: "greenWool", floor: "stoneBrick", trim: "goldOre", doorSide: "west", doorCenter: -225, floors: 1, chimney: [565, -233] },
  { name: "black_anvil_smithy", district: "Craftsman Row", profile: "service", x0: 520, x1: 544, z0: -242, z1: -220, wall: "stoneBrick", roof: "blackWool", floor: "stonePolished", trim: "coal", doorSide: "south", doorCenter: 532, floors: 1, chimney: [523, -238] },
  { name: "crafters_workshop", district: "Craftsman Row", profile: "service", x0: 494, x1: 514, z0: -238, z1: -220, wall: "stoneBrick", roof: "thatch", floor: "stoneBrick", trim: "hay", doorSide: "south", doorCenter: 504, floors: 1, chimney: [512, -235] },
  { name: "green_mortar_apothecary", district: "Temple Market Edge", profile: "service", x0: 448, x1: 466, z0: -184, z1: -168, wall: "stoneBrick", roof: "greenWool", floor: "stoneBrick", trim: "whiteWool", doorSide: "east", doorCenter: -176, floors: 1 },
  { name: "wyrm_and_candle_magic_shop", district: "Temple Market Edge", profile: "service", x0: 508, x1: 528, z0: -178, z1: -158, wall: "stoneBrick", roof: "blueWool", floor: "stonePolished", trim: "diamondOre", doorSide: "south", doorCenter: 518, floors: 2, stairs: harthmereV64StairsFor(512, -172, "east") },
  { name: "copper_kettle_inn", district: "Entertainment District", profile: "service", x0: 532, x1: 566, z0: -208, z1: -180, wall: "stoneBrick", roof: "redWool", floor: "stonePolished", trim: "yellowWool", doorSide: "west", doorCenter: -194, floors: 2, upper: true, stairs: harthmereV64StairsFor(536, -202, "east"), balcony: { side: "west", start: -202, end: -188, depth: 3, floor: 2, material: "stonePolished" }, chimney: [562, -184] },

  // --- Temple / docks / outskirts ---
  { name: "saint_verena_chapel", district: "Temple Green", profile: "service", x0: 466, x1: 494, z0: -150, z1: -128, wall: "stonePolished", roof: "blueWool", floor: "stoneBrick", trim: "whiteWool", doorSide: "south", doorCenter: 480, floors: 1 },
  { name: "brother_vance_chapel_cottage", district: "Temple Green", profile: "house", x0: 438, x1: 458, z0: -148, z1: -130, wall: "stoneBrick", roof: "blueWool", floor: "stonePolished", trim: "whiteWool", doorSide: "east", doorCenter: -139, floors: 1, chimney: [441, -145] },
  { name: "river_dock_supply", district: "River Docks", profile: "service", x0: 574, x1: 602, z0: -196, z1: -176, wall: "stoneBrick", roof: "blackWool", floor: "stonePolished", trim: "blueWool", doorSide: "west", doorCenter: -186, floors: 1 },
  { name: "dock_warehouse", district: "River Docks", profile: "service", x0: 574, x1: 600, z0: -170, z1: -150, wall: "stoneBrick", roof: "blackWool", floor: "stonePolished", trim: "blueWool", doorSide: "west", doorCenter: -160, floors: 1 },
  { name: "harthmere_watermill", district: "Farm Outskirts", profile: "service", x0: 418, x1: 440, z0: -122, z1: -104, wall: "stoneBrick", roof: "thatch", floor: "stonePolished", trim: "hay", doorSide: "south", doorCenter: 429, floors: 1, chimney: [421, -119] },

  // --- Mudden Ward / poorer housing ---
  { name: "mudden_ward_shelter", district: "Mudden Ward", profile: "slum", x0: 398, x1: 426, z0: -170, z1: -148, wall: "stoneBrick", roof: "blackWool", floor: "stonePolished", trim: "coal", doorSide: "east", doorCenter: -158, floors: 2, stairs: harthmereV64StairsFor(402, -164, "east"), chimney: [401, -166] },
  { name: "mudden_laundry_house", district: "Mudden Ward", profile: "slum", x0: 398, x1: 418, z0: -144, z1: -130, wall: "stoneBrick", roof: "blackWool", floor: "stonePolished", trim: "coal", doorSide: "east", doorCenter: -137, floors: 2, stairs: harthmereV64StairsFor(402, -140, "east") },

  // --- Expanded residential apartments outside the wall. These replace the
  // transparent/prop shells with real collision and walkable upper floors. ---
  { name: "rosewall_house", district: "Residential District", profile: "apartment", x0: 340, x1: 360, z0: -326, z1: -310, wall: "stoneBrick", roof: "blueWool", floor: "stonePolished", trim: "whiteWool", doorSide: "south", doorCenter: 350, floors: 2, stairs: harthmereV64StairsFor(344, -322, "east"), balcony: { side: "south", start: 344, end: 356, depth: 3, floor: 2, material: "stonePolished" } },
  { name: "sunbeam_house", district: "Residential District", profile: "apartment", x0: 368, x1: 388, z0: -326, z1: -310, wall: "stoneBrick", roof: "yellowWool", floor: "stonePolished", trim: "whiteWool", doorSide: "south", doorCenter: 378, floors: 2, stairs: harthmereV64StairsFor(372, -322, "east"), balcony: { side: "south", start: 372, end: 384, depth: 3, floor: 2, material: "stonePolished" } },
  { name: "blue_shutter_house", district: "Residential District", profile: "apartment", x0: 396, x1: 416, z0: -326, z1: -310, wall: "stoneBrick", roof: "blueWool", floor: "stonePolished", trim: "whiteWool", doorSide: "south", doorCenter: 406, floors: 2, stairs: harthmereV64StairsFor(400, -322, "east"), balcony: { side: "south", start: 400, end: 412, depth: 3, floor: 2, material: "stonePolished" } },
  { name: "chimneybend_house", district: "Residential District", profile: "apartment", x0: 424, x1: 444, z0: -326, z1: -310, wall: "stoneBrick", roof: "redWool", floor: "stonePolished", trim: "whiteWool", doorSide: "south", doorCenter: 434, floors: 2, stairs: harthmereV64StairsFor(428, -322, "east"), balcony: { side: "south", start: 428, end: 440, depth: 3, floor: 2, material: "stonePolished" } },
  { name: "lavender_lane_house", district: "Residential District", profile: "apartment", x0: 452, x1: 472, z0: -326, z1: -310, wall: "stoneBrick", roof: "greenWool", floor: "stonePolished", trim: "whiteWool", doorSide: "south", doorCenter: 462, floors: 2, stairs: harthmereV64StairsFor(456, -322, "east"), balcony: { side: "south", start: 456, end: 468, depth: 3, floor: 2, material: "stonePolished" } },
  { name: "brass_knocker_house", district: "Residential District", profile: "apartment", x0: 340, x1: 360, z0: -362, z1: -346, wall: "stoneBrick", roof: "blueWool", floor: "stonePolished", trim: "whiteWool", doorSide: "north", doorCenter: 350, floors: 2, stairs: harthmereV64StairsFor(344, -358, "east"), balcony: { side: "north", start: 344, end: 356, depth: 3, floor: 2, material: "stonePolished" } },
  { name: "appleblossom_house", district: "Residential District", profile: "apartment", x0: 368, x1: 388, z0: -362, z1: -346, wall: "stoneBrick", roof: "greenWool", floor: "stonePolished", trim: "whiteWool", doorSide: "north", doorCenter: 378, floors: 2, stairs: harthmereV64StairsFor(372, -358, "east"), balcony: { side: "north", start: 372, end: 384, depth: 3, floor: 2, material: "stonePolished" } },
  { name: "wheatgold_house", district: "Residential District", profile: "apartment", x0: 396, x1: 416, z0: -362, z1: -346, wall: "stoneBrick", roof: "yellowWool", floor: "stonePolished", trim: "whiteWool", doorSide: "north", doorCenter: 406, floors: 2, stairs: harthmereV64StairsFor(400, -358, "east"), balcony: { side: "north", start: 400, end: 412, depth: 3, floor: 2, material: "stonePolished" } },
  { name: "canalview_house", district: "Residential District", profile: "apartment", x0: 424, x1: 444, z0: -362, z1: -346, wall: "stoneBrick", roof: "blueWool", floor: "stonePolished", trim: "whiteWool", doorSide: "north", doorCenter: 434, floors: 2, stairs: harthmereV64StairsFor(428, -358, "east"), balcony: { side: "north", start: 428, end: 440, depth: 3, floor: 2, material: "stonePolished" } },
  { name: "millers_rest_house", district: "Residential District", profile: "apartment", x0: 452, x1: 472, z0: -362, z1: -346, wall: "stoneBrick", roof: "redWool", floor: "stonePolished", trim: "whiteWool", doorSide: "north", doorCenter: 462, floors: 2, stairs: harthmereV64StairsFor(456, -358, "east"), balcony: { side: "north", start: 456, end: 468, depth: 3, floor: 2, material: "stonePolished" } },

  // --- Four/five story Mudden Ward stacks; stairs and slabs are real terrain. ---
  { name: "tangle_stairs_stack", district: "Mudden Ward", profile: "slum", x0: 366, x1: 382, z0: -134, z1: -118, wall: "stoneBrick", roof: "blackWool", floor: "stonePolished", trim: "coal", doorSide: "east", doorCenter: -126, floors: 5, stairs: harthmereV64StairsFor(369, -130, "east"), balcony: { side: "east", start: -131, end: -122, depth: 3, floor: 3, material: "stonePolished" } },
  { name: "soot_ladder_stack", district: "Mudden Ward", profile: "slum", x0: 394, x1: 410, z0: -112, z1: -96, wall: "stoneBrick", roof: "blackWool", floor: "stonePolished", trim: "coal", doorSide: "south", doorCenter: 402, floors: 5, stairs: harthmereV64StairsFor(397, -108, "east"), balcony: { side: "south", start: 397, end: 407, depth: 3, floor: 3, material: "stonePolished" } },
  { name: "dripline_stack", district: "Mudden Ward", profile: "slum", x0: 422, x1: 438, z0: -134, z1: -118, wall: "stoneBrick", roof: "blackWool", floor: "stonePolished", trim: "coal", doorSide: "west", doorCenter: -126, floors: 4, stairs: harthmereV64StairsFor(425, -130, "east"), balcony: { side: "west", start: -131, end: -122, depth: 3, floor: 3, material: "stonePolished" } },
  { name: "washline_stack", district: "Mudden Ward", profile: "slum", x0: 450, x1: 466, z0: -112, z1: -96, wall: "stoneBrick", roof: "blackWool", floor: "stonePolished", trim: "coal", doorSide: "north", doorCenter: 458, floors: 4, stairs: harthmereV64StairsFor(453, -108, "east"), balcony: { side: "north", start: 453, end: 463, depth: 3, floor: 3, material: "stonePolished" } },

  // --- Surface-accessible dungeon buildings; below-ground rooms are carved by
  // HARTHMERE_V64_DUNGEON_AREAS and harthmereV6ShouldCarveDungeonAirBlockAt(). ---
  { name: "old_well_underways_entry_house", district: "Old Well Underways", profile: "dungeon", x0: 394, x1: 408, z0: -242, z1: -228, wall: "stoneBrick", roof: "blackWool", floor: "stonePolished", trim: "coal", doorSide: "east", doorCenter: -235, floors: 1 },
  { name: "rat_crown_drain_house", district: "Old Well Underways", profile: "dungeon", x0: 410, x1: 426, z0: -244, z1: -230, wall: "stoneBrick", roof: "blackWool", floor: "stonePolished", trim: "coal", doorSide: "west", doorCenter: -237, floors: 1 },
];

// HARTHMERE_SERVER_VOXEL_OCCUPANCY_STRUCTURES_V65_START
// HARTHMERE_SERVER_VOXEL_OCCUPANCY_STRUCTURES_VERSION_V65
// Extra server-owned structures that replace the remaining large runtime OBJ/GLB
// silhouettes: wilds houses, watch posts, watermill/windmill landmarks, dockside
// homes, and NPC trade/home annexes. These are terrain blocks, not prop shells.
const HARTHMERE_SERVER_VOXEL_OCCUPANCY_STRUCTURES_VERSION_V65 =
  "harthmere-server-voxel-occupancy-structures-v65";

const HARTHMERE_V65_ADDITIONAL_SERVER_STRUCTURES: HarthmereV6Building[] = [
  { name: "last_watch_post_bunkhouse", district: "Harthmere Wilds - Last Watch Post", profile: "tower", x0: 470, x1: 490, z0: -340, z1: -320, wall: "stoneBrick", roof: "redWool", floor: "stonePolished", trim: "coal", doorSide: "south", doorCenter: 480, floors: 2, stairs: harthmereV64StairsFor(474, -334, "east"), chimney: [488, -337] },
  { name: "miller_rest_watermill", district: "Harthmere Wilds - Mill Road", profile: "service", x0: 374, x1: 394, z0: -414, z1: -394, wall: "stoneBrick", roof: "thatch", floor: "stonePolished", trim: "oakLog", doorSide: "east", doorCenter: -404, floors: 2, stairs: harthmereV64StairsFor(378, -408, "east"), chimney: [377, -411] },
  { name: "mill_worker_cottage", district: "Harthmere Wilds - Mill Road", profile: "house", x0: 398, x1: 414, z0: -402, z1: -386, wall: "stoneBrick", roof: "yellowWool", floor: "stonePolished", trim: "whiteWool", doorSide: "south", doorCenter: 406, floors: 1, chimney: [401, -399] },
  { name: "northwest_ruined_watchtower", district: "Harthmere Wilds - Northwest Watchtower Ridge", profile: "tower", x0: 154, x1: 168, z0: -638, z1: -624, wall: "stoneBrick", roof: "blackWool", floor: "stonePolished", trim: "coal", doorSide: "south", doorCenter: 161, floors: 3, stairs: harthmereV64StairsFor(157, -634, "east") },
  { name: "southwest_orchard_windmill", district: "Harthmere Wilds - Southwest Orchardwood", profile: "tower", x0: 154, x1: 170, z0: 162, z1: 180, wall: "stoneBrick", roof: "yellowWool", floor: "stonePolished", trim: "oakLog", doorSide: "south", doorCenter: 162, floors: 3, stairs: harthmereV64StairsFor(158, 166, "east") },
  { name: "greenmere_edge_cabin", district: "Harthmere Wilds - Greenmere Edge", profile: "house", x0: 540, x1: 558, z0: -438, z1: -420, wall: "stoneBrick", roof: "greenWool", floor: "stonePolished", trim: "oakLog", doorSide: "south", doorCenter: 549, floors: 1, chimney: [555, -435] },
  { name: "charcoal_burners_camp", district: "Harthmere Wilds - Charcoal Camp", profile: "house", x0: 236, x1: 254, z0: -650, z1: -632, wall: "stoneBrick", roof: "blackWool", floor: "stonePolished", trim: "coal", doorSide: "south", doorCenter: 245, floors: 1, chimney: [239, -647] },
  { name: "briarfen_stilt_hut", district: "Harthmere Wilds - Briarfen", profile: "house", x0: 648, x1: 668, z0: -286, z1: -266, wall: "stoneBrick", roof: "greenWool", floor: "stonePolished", trim: "oakLog", doorSide: "west", doorCenter: -276, floors: 1, chimney: [665, -283] },
  { name: "grave_tender_caretaker_house", district: "Harthmere Wilds - Southeast Gravewood", profile: "house", x0: 748, x1: 768, z0: 202, z1: 222, wall: "stoneBrick", roof: "blackWool", floor: "stonePolished", trim: "whiteWool", doorSide: "north", doorCenter: 758, floors: 1, chimney: [765, 205] },
  { name: "deep_old_wood_glade_lodge", district: "Harthmere Wilds - Deep Old Wood", profile: "house", x0: 700, x1: 720, z0: -692, z1: -672, wall: "stoneBrick", roof: "greenWool", floor: "stonePolished", trim: "oakLog", doorSide: "south", doorCenter: 710, floors: 1, chimney: [717, -689] },
  { name: "thornbridge_crossing_shelter", district: "Harthmere Wilds - Thornbridge Crossing", profile: "service", x0: 342, x1: 356, z0: -506, z1: -490, wall: "stoneBrick", roof: "greenWool", floor: "stonePolished", trim: "oakLog", doorSide: "west", doorCenter: -498, floors: 1 },
  { name: "mail_post_house", district: "Player Services Plaza", profile: "service", x0: 520, x1: 534, z0: -224, z1: -210, wall: "stoneBrick", roof: "blueWool", floor: "stonePolished", trim: "whiteWool", doorSide: "south", doorCenter: 527, floors: 2, stairs: harthmereV64StairsFor(523, -220, "east") },
  { name: "tailor_loft_house", district: "Market District", profile: "service", x0: 468, x1: 486, z0: -184, z1: -168, wall: "stoneBrick", roof: "yellowWool", floor: "stonePolished", trim: "whiteWool", doorSide: "south", doorCenter: 477, floors: 2, stairs: harthmereV64StairsFor(472, -180, "east") },
  { name: "tannery_court_house", district: "Farm Outskirts", profile: "service", x0: 472, x1: 490, z0: -124, z1: -106, wall: "stoneBrick", roof: "thatch", floor: "stonePolished", trim: "oakLog", doorSide: "north", doorCenter: 481, floors: 1, chimney: [487, -121] },
  { name: "dockside_family_house", district: "River Docks", profile: "apartment", x0: 552, x1: 572, z0: -174, z1: -154, wall: "stoneBrick", roof: "blueWool", floor: "stonePolished", trim: "whiteWool", doorSide: "east", doorCenter: -164, floors: 2, stairs: harthmereV64StairsFor(556, -168, "east"), balcony: { side: "east", start: -170, end: -160, depth: 3, floor: 2, material: "stonePolished" }, chimney: [555, -171] },
];

HARTHMERE_V6_BUILDINGS.push(...HARTHMERE_V65_ADDITIONAL_SERVER_STRUCTURES);
// HARTHMERE_SERVER_VOXEL_OCCUPANCY_STRUCTURES_V65_END

const HARTHMERE_V64_DUNGEON_AREAS: ReadonlyArray<{
  readonly name: string;
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly y0: number;
  readonly y1: number;
}> = [
  { name: "old_well_descent_room", x0: 394, x1: 408, z0: -242, z1: -228, y0: -6, y1: -1 },
  { name: "underways_north_south_tunnel", x0: 399, x1: 403, z0: -270, z1: -226, y0: -5, y1: -1 },
  { name: "underways_east_west_tunnel", x0: 399, x1: 446, z0: -238, z1: -234, y0: -5, y1: -1 },
  { name: "rat_crowns_den", x0: 424, x1: 446, z0: -246, z1: -228, y0: -6, y1: -1 },
  { name: "smuggler_drain_vault", x0: 388, x1: 408, z0: -276, z1: -260, y0: -6, y1: -1 },
  { name: "crypt_rest_room", x0: 430, x1: 450, z0: -226, z1: -210, y0: -6, y1: -1 },
];

function harthmereV6Mat(
  materials: ReturnType<typeof localDevMaterials>,
  key: HarthmereV6Mat,
): TerrainID {
  return materials[key] as TerrainID;
}

function harthmereV64FloorCount(building: HarthmereV6Building): number {
  return Math.max(1, building.floors ?? (building.upper ? 2 : 1));
}

function harthmereV64StoryHeight(building: HarthmereV6Building): number {
  return building.profile === "slum" ? 4 : 5;
}

function harthmereV64TopRelY(building: HarthmereV6Building): number {
  return harthmereV64FloorCount(building) * harthmereV64StoryHeight(building);
}

function harthmereV6IsDoor(
  building: HarthmereV6Building,
  worldX: number,
  worldZ: number,
  relY: number,
) {
  const storyHeight = harthmereV64StoryHeight(building);
  if (relY < 1 || relY > Math.min(3, storyHeight - 1)) {
    return false;
  }

  if (building.doorSide === "north") {
    return worldZ === building.z0 && Math.abs(worldX - building.doorCenter) <= 1;
  }
  if (building.doorSide === "south") {
    return worldZ === building.z1 && Math.abs(worldX - building.doorCenter) <= 1;
  }
  if (building.doorSide === "west") {
    return worldX === building.x0 && Math.abs(worldZ - building.doorCenter) <= 1;
  }
  return worldX === building.x1 && Math.abs(worldZ - building.doorCenter) <= 1;
}

function harthmereV64BalconyBounds(building: HarthmereV6Building) {
  const b = building.balcony;
  if (!b) return undefined;
  if (b.side === "east") return [building.x1 + 1, building.x1 + b.depth, b.start, b.end] as const;
  if (b.side === "west") return [building.x0 - b.depth, building.x0 - 1, b.start, b.end] as const;
  if (b.side === "south") return [b.start, b.end, building.z1 + 1, building.z1 + b.depth] as const;
  return [b.start, b.end, building.z0 - b.depth, building.z0 - 1] as const;
}

function harthmereV64WithinBuildingExpandedBounds(
  building: HarthmereV6Building,
  worldX: number,
  worldZ: number,
) {
  let x0 = building.x0 - 1;
  let x1 = building.x1 + 1;
  let z0 = building.z0 - 1;
  let z1 = building.z1 + 1;
  const b = harthmereV64BalconyBounds(building);
  if (b) {
    x0 = Math.min(x0, b[0] - 1);
    x1 = Math.max(x1, b[1] + 1);
    z0 = Math.min(z0, b[2] - 1);
    z1 = Math.max(z1, b[3] + 1);
  }
  return inRect(worldX, worldZ, x0, x1, z0, z1);
}

const HARTHMERE_CLEAR_ROOF_STREET_AIR_VERSION_V1 = "harthmere-clear-roof-street-air-v1";
const HARTHMERE_CLEAR_STREET_RECTS_V1: ReadonlyArray<readonly [number, number, number, number]> = [
  [478, 496, -292, -214],
  [414, 606, -218, -202],
  [586, 612, -218, -176],
  [400, 434, -162, -146],
  [478, 492, -198, -126],
  [336, 476, -366, -306],
  [362, 470, -138, -92],
];

function harthmereV6IsInsideRectV1(
  worldX: number,
  worldZ: number,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  pad = 0,
) {
  return worldX >= x0 - pad && worldX <= x1 + pad && worldZ >= z0 - pad && worldZ <= z1 + pad;
}

function harthmereV6IsInsideAnyBuildingFootprintV1(worldX: number, worldZ: number, pad = 0) {
  return HARTHMERE_V6_BUILDINGS.some((building) => {
    if (harthmereV6IsInsideRectV1(worldX, worldZ, building.x0, building.x1, building.z0, building.z1, pad)) {
      return true;
    }
    const balcony = harthmereV64BalconyBounds(building);
    return balcony ? harthmereV6IsInsideRectV1(worldX, worldZ, balcony[0], balcony[1], balcony[2], balcony[3], pad) : false;
  });
}

function harthmereV6IsInsideClearStreetRectV1(worldX: number, worldZ: number) {
  return HARTHMERE_CLEAR_STREET_RECTS_V1.some(([x0, x1, z0, z1]) =>
    harthmereV6IsInsideRectV1(worldX, worldZ, x0, x1, z0, z1),
  );
}

function harthmereV6ShouldClearStreetAirBlockV1(worldX: number, worldY: number, worldZ: number) {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  if (relY < 1 || relY > 32) return false;
  if (!harthmereV6IsInsideClearStreetRectV1(worldX, worldZ)) return false;
  return !harthmereV6IsInsideAnyBuildingFootprintV1(worldX, worldZ, 0);
}

function harthmereV6ShouldClearRoofAirBlockV1(worldX: number, worldY: number, worldZ: number) {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  for (const building of HARTHMERE_V6_BUILDINGS) {
    if (!harthmereV64WithinBuildingExpandedBounds(building, worldX, worldZ)) continue;
    return relY > harthmereV64TopRelY(building) && relY <= 32;
  }
  return false;
}

function harthmereV6ShouldForceClearRoofStreetAirBlockV1(worldX: number, worldY: number, worldZ: number) {
  return (
    harthmereV6ShouldClearStreetAirBlockV1(worldX, worldY, worldZ) ||
    harthmereV6ShouldClearRoofAirBlockV1(worldX, worldY, worldZ)
  );
}

function harthmereV64IsInDungeonArea(worldX: number, worldZ: number, relY: number) {
  return HARTHMERE_V64_DUNGEON_AREAS.some((area) =>
    inRect(worldX, worldZ, area.x0, area.x1, area.z0, area.z1) && inRange(relY, area.y0, area.y1),
  );
}

function harthmereV64IsDungeonBoundary(worldX: number, worldZ: number, relY: number) {
  return HARTHMERE_V64_DUNGEON_AREAS.some((area) => {
    if (!inRange(relY, area.y0, area.y1)) return false;
    if (!inRect(worldX, worldZ, area.x0, area.x1, area.z0, area.z1)) return false;
    return worldX === area.x0 || worldX === area.x1 || worldZ === area.z0 || worldZ === area.z1;
  });
}

function harthmereV6ShouldCarveDungeonAirBlockAt(worldX: number, worldY: number, worldZ: number) {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  if (!harthmereV64IsInDungeonArea(worldX, worldZ, relY)) return false;
  if (harthmereV64IsDungeonBoundary(worldX, worldZ, relY)) return false;
  return relY >= -5 && relY <= -1;
}

function harthmereV64DungeonBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;

  for (const area of HARTHMERE_V64_DUNGEON_AREAS) {
    if (!inRect(worldX, worldZ, area.x0, area.x1, area.z0, area.z1)) continue;
    const boundary = worldX === area.x0 || worldX === area.x1 || worldZ === area.z0 || worldZ === area.z1;
    if (relY === area.y0 - 1) {
      return (worldX + worldZ) % 7 === 0 ? materials.coal : materials.stoneBrick;
    }
    if (boundary && inRange(relY, area.y0, area.y1)) {
      return (worldX + worldZ + relY) % 11 === 0 ? materials.ironOre : materials.stoneBrick;
    }
    if (relY === area.y1 + 1 && inRect(worldX, worldZ, area.x0, area.x1, area.z0, area.z1)) {
      return materials.stoneBrick;
    }
  }

  // Entry ladder/shaft under the old well. It is visible and carved from server terrain.
  if (worldX === 400 && worldZ === -235 && inRange(relY, -6, 1)) {
    return relY % 2 === 0 ? materials.oakLog : materials.coal;
  }

  return undefined;
}

function harthmereV6SurfaceMaterial(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldZ: number,
): TerrainID | undefined {
  const marketDistance = Math.hypot(worldX - 486, worldZ + 209);

  if (inRange(worldX, 604, 630) && inRange(worldZ, -206, -146)) return materials.water;

  if (marketDistance <= 34) return marketDistance <= 9 ? materials.stonePolished : materials.stoneBrick;

  // HARTHMERE_CONNECTED_ROAD_SURFACE_V67:
  // Explicit snapshot-edge connector road. This is authored pre-offset; when
  // BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1 and the default +512 x offset is used,
  // this becomes world x=640..904 at z=-209. That gives a real visible road from
  // the snapshot edge into Harthmere's west approach even when all GLB road
  // meshes are disabled by the snapshot-built runtime policy.
  if (inRange(worldX, 128, 392) && inRange(worldZ, -214, -204)) {
    if (inRange(worldZ, -211, -207)) return materials.stoneBrick;
    return materials.gravel;
  }

  // Primary town arteries.
  if (inRange(worldX, 478, 496) && inRange(worldZ, -292, -214)) return materials.stoneBrick;
  if (inRange(worldX, 414, 606) && inRange(worldZ, -218, -202)) return materials.stoneBrick;
  if (inRange(worldX, 586, 612) && inRange(worldZ, -218, -176)) return materials.stoneBrick;

  // District loops and courtyards.
  if (inRange(worldX, 444, 470) && inRange(worldZ, -272, -218)) return materials.stoneBrick;
  if (inRange(worldX, 498, 584) && inRange(worldZ, -280, -240)) return materials.stoneBrick;
  if (inRange(worldX, 500, 570) && inRange(worldZ, -242, -214)) return materials.stoneBrick;
  if (inRange(worldX, 444, 532) && inRange(worldZ, -186, -156)) return materials.stoneBrick;
  if (inRange(worldX, 472, 496) && inRange(worldZ, -210, -126)) return materials.stoneBrick;
  if (inRange(worldX, 500, 524) && inRange(worldZ, -276, -256)) return materials.gravel;
  if (inRange(worldX, 462, 504) && inRange(worldZ, -154, -124)) return materials.stonePolished;
  if (inRange(worldX, 548, 624) && inRange(worldZ, -280, -246)) return materials.stonePolished;

  // Expanded residential block and Mudden Ward/slums: explicit paths around the
  // outside houses so they are not isolated prop islands.
  if (inRange(worldX, 336, 476) && inRange(worldZ, -366, -306)) {
    return inRange(worldZ, -338, -330) || worldX % 28 <= 5 ? materials.stoneBrick : materials.grass;
  }
  if (inRange(worldX, 360, 470) && inRange(worldZ, -138, -92)) {
    return inRange(worldX, 386, 446) || inRange(worldZ, -118, -112) ? materials.dirt : materials.grass;
  }

  // Mudden Ward and secret routes are intentionally rougher but navigable.
  if (inRange(worldX, 394, 434) && inRange(worldZ, -176, -128)) return materials.dirt;
  if (inRange(worldX, 394, 410) && inRange(worldZ, -244, -160)) return materials.dirt;
  if (inRange(worldX, 408, 486) && inRange(worldZ, -154, -142)) return materials.dirt;
  if (inRange(worldX, 388, 450) && inRange(worldZ, -278, -210)) return materials.gravel;

  // Farms, orchard, and mill road.
  if (inRange(worldX, 430, 466) && inRange(worldZ, -250, -220)) return materials.dirt;
  if (inRange(worldX, 418, 478) && inRange(worldZ, -126, -98)) return materials.dirt;

  return undefined;
}

function harthmereV64StairStepFor(
  stair: HarthmereV64Stairs,
  worldX: number,
  worldZ: number,
): number | undefined {
  const inWidth =
    stair.direction === "east" || stair.direction === "west"
      ? worldZ >= stair.z0 && worldZ < stair.z0 + stair.width
      : worldX >= stair.x0 && worldX < stair.x0 + stair.width;
  if (!inWidth) return undefined;

  if (stair.direction === "east") {
    if (worldX < stair.x0 || worldX >= stair.x0 + stair.length) return undefined;
    return worldX - stair.x0;
  }
  if (stair.direction === "west") {
    if (worldX < stair.x0 || worldX >= stair.x0 + stair.length) return undefined;
    return stair.x0 + stair.length - 1 - worldX;
  }
  if (stair.direction === "south") {
    if (worldZ < stair.z0 || worldZ >= stair.z0 + stair.length) return undefined;
    return worldZ - stair.z0;
  }
  if (worldZ < stair.z0 || worldZ >= stair.z0 + stair.length) return undefined;
  return stair.z0 + stair.length - 1 - worldZ;
}

function harthmereV64IsStairOrLanding(
  building: HarthmereV6Building,
  worldX: number,
  worldZ: number,
) {
  const stair = building.stairs;
  if (!stair) return false;
  const step = harthmereV64StairStepFor(stair, worldX, worldZ);
  if (step !== undefined) return true;
  if (stair.direction === "east" || stair.direction === "west") {
    return worldZ >= stair.z0 && worldZ < stair.z0 + stair.width && worldX >= stair.x0 && worldX <= stair.x0 + stair.length + 1;
  }
  return worldX >= stair.x0 && worldX < stair.x0 + stair.width && worldZ >= stair.z0 && worldZ <= stair.z0 + stair.length + 1;
}

function harthmereV64BalconyDoor(
  building: HarthmereV6Building,
  worldX: number,
  worldZ: number,
  relY: number,
) {
  const b = building.balcony;
  if (!b) return false;
  const storyHeight = harthmereV64StoryHeight(building);
  const baseY = (b.floor - 1) * storyHeight;
  if (relY < baseY + 1 || relY > baseY + 3) return false;
  if (b.side === "east") return worldX === building.x1 && worldZ >= b.start + 1 && worldZ <= b.end - 1;
  if (b.side === "west") return worldX === building.x0 && worldZ >= b.start + 1 && worldZ <= b.end - 1;
  if (b.side === "south") return worldZ === building.z1 && worldX >= b.start + 1 && worldX <= b.end - 1;
  return worldZ === building.z0 && worldX >= b.start + 1 && worldX <= b.end - 1;
}

// HARTHMERE_AUTO_EXTERNAL_STAIRS_VERSION_V67
// Multi-floor buildings must have a physical voxel stair/landing. If a building
// definition forgets explicit `stairs`, generate a conservative exterior stair
// off the door side instead of leaving the upper floor as a floating box.
const HARTHMERE_AUTO_EXTERNAL_STAIRS_VERSION_V67 = "harthmere-auto-external-stairs-v67";

function harthmereV67DefaultStairsForBuilding(building: HarthmereV6Building): HarthmereV64Stairs | undefined {
  if (harthmereV64FloorCount(building) < 2 || building.stairs) return undefined;
  const centerX = Math.floor((building.x0 + building.x1) / 2);
  const centerZ = Math.floor((building.z0 + building.z1) / 2);
  if (building.doorSide === "south") return harthmereV64StairsFor(centerX - 2, building.z1 + 2, "east", 6, 2);
  if (building.doorSide === "north") return harthmereV64StairsFor(centerX - 2, building.z0 - 7, "east", 6, 2);
  if (building.doorSide === "east") return harthmereV64StairsFor(building.x1 + 2, centerZ - 2, "south", 6, 2);
  return harthmereV64StairsFor(building.x0 - 7, centerZ - 2, "south", 6, 2);
}

function harthmereV67AutoExternalStairBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  building: HarthmereV6Building,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const stair = harthmereV67DefaultStairsForBuilding(building);
  if (!stair) return undefined;
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  const storyHeight = harthmereV64StoryHeight(building);
  const step = harthmereV64StairStepFor(stair, worldX, worldZ);
  if (step !== undefined && relY === Math.min(storyHeight, step + 1)) {
    return building.floor ? harthmereV6Mat(materials, building.floor) : materials.stoneBrick;
  }
  // Landing outside upper doorway.
  if (stair.direction === "east" || stair.direction === "west") {
    const landingX = stair.direction === "east" ? stair.x0 + stair.length : stair.x0 - 1;
    if (inRange(worldX, landingX - 1, landingX + 1) && inRange(worldZ, stair.z0, stair.z0 + stair.width - 1) && relY === storyHeight) {
      return building.floor ? harthmereV6Mat(materials, building.floor) : materials.stoneBrick;
    }
  } else {
    const landingZ = stair.direction === "south" ? stair.z0 + stair.length : stair.z0 - 1;
    if (inRange(worldZ, landingZ - 1, landingZ + 1) && inRange(worldX, stair.x0, stair.x0 + stair.width - 1) && relY === storyHeight) {
      return building.floor ? harthmereV6Mat(materials, building.floor) : materials.stoneBrick;
    }
  }
  return undefined;
}


function harthmereV64BalconyBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  building: HarthmereV6Building,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const b = building.balcony;
  if (!b) return undefined;
  const bounds = harthmereV64BalconyBounds(building);
  if (!bounds || !inRect(worldX, worldZ, bounds[0], bounds[1], bounds[2], bounds[3])) return undefined;
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  const storyHeight = harthmereV64StoryHeight(building);
  const deckY = (b.floor - 1) * storyHeight;
  const edge = worldX === bounds[0] || worldX === bounds[1] || worldZ === bounds[2] || worldZ === bounds[3];

  if (relY === deckY) return harthmereV6Mat(materials, b.material ?? building.floor);
  if (edge && relY === deckY + 1) return building.trim ? harthmereV6Mat(materials, building.trim) : materials.stoneBrick;
  return undefined;
}

// HARTHMERE_SERVER_VOXEL_ROOM_PARTITIONS_V65_START
// HARTHMERE_SERVER_VOXEL_ROOM_PARTITIONS_VERSION_V65
// Adds interior rooms to the server-side voxel buildings. Furniture stays as
// runtime props, but rooms/walls/floors/ceilings remain real terrain.
const HARTHMERE_SERVER_VOXEL_ROOM_PARTITIONS_VERSION_V65 =
  "harthmere-server-voxel-room-partitions-v65";

function harthmereV65BuildingNeedsRooms(building: HarthmereV6Building) {
  const floors = harthmereV64FloorCount(building);
  const label = (building.name + " " + building.district + " " + (building.profile ?? "")).toLowerCase();
  return (
    floors >= 2 ||
    building.profile === "apartment" ||
    building.profile === "slum" ||
    building.profile === "house" ||
    /barracks|inn|hall|estate|cottage|shelter|stack|family|loft|bunkhouse|cabin|camp|hut|lodge|post|chapel|smithy|bakery|workshop|warehouse|apothecary/.test(label)
  );
}

function harthmereV65InteriorPartitionBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  building: HarthmereV6Building,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  if (!harthmereV65BuildingNeedsRooms(building)) return undefined;

  const relY = worldY - STARTER_TOWN_GROUND_Y;
  const floors = harthmereV64FloorCount(building);
  const storyHeight = harthmereV64StoryHeight(building);
  const inside = inRect(worldX, worldZ, building.x0 + 1, building.x1 - 1, building.z0 + 1, building.z1 - 1);
  if (!inside) return undefined;
  if (building.stairs && harthmereV64IsStairOrLanding(building, worldX, worldZ)) return undefined;

  const midX = Math.floor((building.x0 + building.x1) / 2);
  const midZ = Math.floor((building.z0 + building.z1) / 2);
  const width = building.x1 - building.x0 + 1;
  const depth = building.z1 - building.z0 + 1;
  if (width < 12 || depth < 12) return undefined;

  for (let floor = 0; floor < floors; floor += 1) {
    const baseY = floor * storyHeight;
    if (relY < baseY + 1 || relY > baseY + Math.min(3, storyHeight - 1)) continue;

    const verticalRoomWall = worldX === midX;
    const horizontalRoomWall = worldZ === midZ;
    const verticalDoorGap = verticalRoomWall && Math.abs(worldZ - midZ) <= 2 && relY <= baseY + 3;
    const horizontalDoorGap = horizontalRoomWall && Math.abs(worldX - midX) <= 2 && relY <= baseY + 3;
    const stairVoid = building.stairs &&
      Math.abs(worldX - building.stairs.x0) <= building.stairs.length + 2 &&
      Math.abs(worldZ - building.stairs.z0) <= building.stairs.width + 2;

    if ((verticalRoomWall && !verticalDoorGap && !stairVoid) || (horizontalRoomWall && !horizontalDoorGap && !stairVoid)) {
      return building.trim ? harthmereV6Mat(materials, building.trim) : harthmereV6Mat(materials, building.wall);
    }
  }

  return undefined;
}
// HARTHMERE_SERVER_VOXEL_ROOM_PARTITIONS_V65_END

function harthmereV6BuildingBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  building: HarthmereV6Building,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  if (!harthmereV64WithinBuildingExpandedBounds(building, worldX, worldZ)) return undefined;

  const relY = worldY - STARTER_TOWN_GROUND_Y;
  const floors = harthmereV64FloorCount(building);
  const storyHeight = harthmereV64StoryHeight(building);
  const inside = inRect(worldX, worldZ, building.x0, building.x1, building.z0, building.z1);
  const perimeter = inside && (worldX === building.x0 || worldX === building.x1 || worldZ === building.z0 || worldZ === building.z1);
  const corner = (worldX === building.x0 || worldX === building.x1) && (worldZ === building.z0 || worldZ === building.z1);

  const balconyBlock = harthmereV64BalconyBlockAt(materials, building, worldX, worldY, worldZ);
  if (balconyBlock !== undefined) return balconyBlock;

  const roomPartitionBlock = harthmereV65InteriorPartitionBlockAt(materials, building, worldX, worldY, worldZ);
  if (roomPartitionBlock !== undefined) return roomPartitionBlock;

  if (building.chimney) {
    const [cx, cz] = building.chimney;
    const top = floors * storyHeight;
    if (worldX === cx && worldZ === cz && inRange(relY, top + 1, top + 4)) return materials.stoneBrick;
    if (worldX === cx && worldZ === cz && relY === top + 5) return materials.coal;
  }

  for (let floor = 0; floor < floors; floor += 1) {
    const baseY = floor * storyHeight;
    const isTop = floor === floors - 1;

    if (building.stairs && floor < floors - 1) {
      const step = harthmereV64StairStepFor(building.stairs, worldX, worldZ);
      if (step !== undefined) {
        const stairY = baseY + 1 + Math.min(step, storyHeight - 1);
        if (relY === stairY) return harthmereV6Mat(materials, building.floor);
      }
    }

    if (relY === baseY && inside) return harthmereV6Mat(materials, building.floor);

    if (relY >= baseY + 1 && relY <= baseY + storyHeight - 1 && perimeter) {
      const groundDoor = floor === 0 && harthmereV6IsDoor(building, worldX, worldZ, relY);
      const balconyDoor = harthmereV64BalconyDoor(building, worldX, worldZ, relY);
      if (groundDoor || balconyDoor) return undefined;
      if (corner && building.trim) return harthmereV6Mat(materials, building.trim);
      const window = relY === baseY + Math.min(3, storyHeight - 1) && !corner && (worldX + worldZ + floor) % 5 === 0;
      return window ? materials.simpleGlass : harthmereV6Mat(materials, building.wall);
    }

    if (relY === baseY + storyHeight) {
      const roofPad = isTop ? 1 : 0;
      const onSlab = inRect(worldX, worldZ, building.x0 - roofPad, building.x1 + roofPad, building.z0 - roofPad, building.z1 + roofPad);
      if (!onSlab) continue;
      if (!isTop && building.stairs && harthmereV64IsStairOrLanding(building, worldX, worldZ)) return undefined;
      return harthmereV6Mat(materials, isTop ? building.roof : building.floor);
    }
  }

  return undefined;
}

// HARTHMERE_SERVER_VOXEL_WILDS_STRUCTURES_TREES_V65_START
// HARTHMERE_SERVER_VOXEL_WILDS_STRUCTURES_TREES_VERSION_V65
// Server-side replacements for remaining large wilds structures. The 5,000
// backend voxel tree field is present but env-gated because the earlier wilds
// seed was already a performance risk; turn it on only for profiling/screenshot
// passes with BIOMES_LOCAL_DEV_BACKEND_VOXEL_TREES_V65=1.
const HARTHMERE_SERVER_VOXEL_WILDS_STRUCTURES_TREES_VERSION_V65 =
  "harthmere-server-voxel-wilds-structures-trees-v65";
const HARTHMERE_V65_BACKEND_VOXEL_TREE_TARGET = 5000;
const HARTHMERE_V65_BACKEND_VOXEL_TREES_ENABLED =
  process.env.BIOMES_LOCAL_DEV_BACKEND_VOXEL_TREES_V65 === "1";

function harthmereV65Hash2(x: number, z: number) {
  let h = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(z ^ 0xc2b2ae35, 0x27d4eb2d);
  h ^= h >>> 15;
  return h >>> 0;
}

function harthmereV65VoxelTreeBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  if (!HARTHMERE_V65_BACKEND_VOXEL_TREES_ENABLED) return undefined;
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  if (relY < 1 || relY > 8) return undefined;
  if (worldX < 96 || worldX > 760 || worldZ < -724 || worldZ > -320) return undefined;
  if (worldX > 330 && worldX < 640 && worldZ > -370 && worldZ < -88) return undefined;

  const cell = 6;
  const cx = Math.floor(worldX / cell);
  const cz = Math.floor(worldZ / cell);
  const h = harthmereV65Hash2(cx, cz);
  if ((h % 100) >= 70) return undefined;
  const anchorX = cx * cell + 2 + (h % 3);
  const anchorZ = cz * cell + 2 + ((h >>> 8) % 3);
  const dx = Math.abs(worldX - anchorX);
  const dz = Math.abs(worldZ - anchorZ);

  if (dx === 0 && dz === 0 && relY >= 1 && relY <= 4) return materials.oakLog;
  const leafRadius = relY <= 5 ? 2 : relY <= 7 ? 1 : 0;
  if (relY >= 4 && relY <= 8 && dx + dz <= leafRadius + 1 && Math.max(dx, dz) <= leafRadius + 1) {
    return (h + relY) % 5 === 0 ? materials.greenWool : materials.oakLeaf;
  }
  return undefined;
}

function harthmereV65WildsServerStructureBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;

  // Thornbridge Crossing: real terrain bridge deck/parapets replacing obj_bridge_low_body.
  if (inRect(worldX, worldZ, 324, 352, -504, -492)) {
    if (relY === 0) return materials.stonePolished;
    const edge = worldZ === -504 || worldZ === -492 || worldX === 324 || worldX === 352;
    if (edge && inRange(relY, 1, 2)) return relY === 2 ? materials.moss : materials.stoneBrick;
  }

  // Last Watch low wall, now server-side instead of obj_wall_simple.
  if (inRect(worldX, worldZ, 468, 492, -340, -322)) {
    const edge = worldX === 468 || worldX === 492 || worldZ === -340 || worldZ === -322;
    const gate = worldZ === -322 && inRange(worldX, 478, 482);
    if (edge && !gate && inRange(relY, 1, 3)) return materials.stoneBrick;
  }

  // Watermill wheel and race marker, built from server blocks rather than arch_watermill/arch_wheel.
  const wheelD = Math.hypot(worldX - 374, worldZ + 404);
  if (wheelD >= 3.2 && wheelD <= 4.4 && inRange(relY, 1, 6)) return materials.oakLog;
  if (inRect(worldX, worldZ, 370, 378, -407, -401) && relY === 0) return materials.water;

  // Orchard windmill cross arms, terrain replacement for arch_windmill.
  if (worldZ === 171 && inRange(worldX, 150, 174) && relY === 13) return materials.oakLog;
  if (worldX === 162 && inRange(worldZ, 159, 183) && relY === 13) return materials.oakLog;
  if (worldX === 162 && worldZ === 171 && inRange(relY, 10, 15)) return materials.oakLog;

  // Gravewood fence: server-side cemetery perimeter instead of obj_church_grave_fence.
  if (inRect(worldX, worldZ, 752, 808, 206, 262)) {
    const edge = worldX === 752 || worldX === 808 || worldZ === 206 || worldZ === 262;
    const gate = worldZ === 206 && inRange(worldX, 776, 784);
    if (edge && !gate && inRange(relY, 1, 2)) return relY === 2 ? materials.blackWool : materials.stoneBrick;
  }

  return harthmereV65VoxelTreeBlockAt(materials, worldX, worldY, worldZ);
}
// HARTHMERE_SERVER_VOXEL_WILDS_STRUCTURES_TREES_V65_END

function harthmereV64PriorityStructureBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;

  const v65WildsServerBlock = harthmereV65WildsServerStructureBlockAt(materials, worldX, worldY, worldZ);
  if (v65WildsServerBlock !== undefined) return v65WildsServerBlock;

  // Large, obvious north-gate crossbar. It is before the street clear pass so
  // relY 7 survives while the walk-through gate lane stays empty below it.
  if (worldZ === -282 && inRange(worldX, 476, 498) && relY === 7) return materials.stoneBrick;
  if ((worldX === 476 || worldX === 498) && inRange(worldZ, -286, -278) && inRange(relY, 1, 8)) return materials.stoneBrick;
  if (worldZ === -286 && inRange(worldX, 472, 502) && relY === 8) return materials.stoneShingles;

  // Real walkable bridge with parapets; the center remains open.
  if (inRect(worldX, worldZ, 586, 612, -212, -200)) {
    if (relY === 0) return materials.stonePolished;
    const parapet = worldZ === -212 || worldZ === -200 || worldX === 586 || worldX === 612;
    if (parapet && inRange(relY, 1, 2)) return relY === 2 ? materials.stoneShingles : materials.stoneBrick;
  }

  return undefined;
}

function harthmereV6WallAndGateBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  const x0 = 392;
  const x1 = 590;
  const z0 = -282;
  const z1 = -112;
  const onWall = (worldX === x0 || worldX === x1 || worldZ === z0 || worldZ === z1) && inRect(worldX, worldZ, x0, x1, z0, z1);
  const northGateGap = worldZ === z0 && inRange(worldX, 477, 497);
  const bridgeGateGap = worldX === x1 && inRange(worldZ, -212, -198);
  const westGateGap = worldX === x0 && inRange(worldZ, -217, -201);
  const southGateGap = worldZ === z1 && inRange(worldX, 476, 496);

  if (onWall && !northGateGap && !bridgeGateGap && !westGateGap && !southGateGap && inRange(relY, 1, 7)) {
    return relY === 7 ? materials.stoneShingles : materials.stoneBrick;
  }

  // Watchtowers facing the wilds and bridge. They are terrain, not silhouettes.
  const towers = [
    [462, 476, -290, -276],
    [498, 512, -290, -276],
    [584, 596, -220, -208],
    [584, 596, -194, -182],
    [386, 398, -220, -206],
    [386, 398, -126, -112],
    [584, 596, -126, -112],
  ] as const;
  for (const [tx0, tx1, tz0, tz1] of towers) {
    const inside = inRect(worldX, worldZ, tx0, tx1, tz0, tz1);
    const edge = inside && (worldX === tx0 || worldX === tx1 || worldZ === tz0 || worldZ === tz1);
    if (inside && relY === 0) return materials.stonePolished;
    if (edge && inRange(relY, 1, 11)) return relY % 5 === 0 ? materials.stonePolished : materials.stoneBrick;
    if (inside && relY === 12) return materials.stoneShingles;
  }

  return undefined;
}

function harthmereV6FenceBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  if (relY !== 1 && relY !== 2) return undefined;

  if (inRect(worldX, worldZ, 430, 466, -250, -220)) {
    const edge = worldX === 430 || worldX === 466 || worldZ === -250 || worldZ === -220;
    const gate = inRange(worldX, 444, 450) && worldZ === -220;
    if (edge && !gate) return materials.oakLog;
  }
  if (inRect(worldX, worldZ, 500, 548, -278, -256)) {
    const edge = worldX === 500 || worldX === 548 || worldZ === -278 || worldZ === -256;
    const gate = inRange(worldX, 510, 514) && worldZ === -256;
    if (edge && !gate) return materials.oakLog;
  }
  if (inRect(worldX, worldZ, 546, 624, -280, -246)) {
    const edge = worldX === 546 || worldX === 624 || worldZ === -280;
    const gate = inRange(worldX, 560, 572) && worldZ === -246;
    if (edge && !gate) return materials.oakLog;
  }
  if ((worldX === 396 && inRange(worldZ, -172, -130)) || (worldZ === -130 && inRange(worldX, 396, 418))) return materials.oakLog;

  // Underways grate near Mudden Ward. It marks a dungeon entrance without trapping players.
  if (worldX === 402 && inRange(worldZ, -238, -234)) return relY === 1 ? materials.blackWool : materials.coal;

  return undefined;
}

function harthmereV6LandmarkBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;


// HARTHMERE_CONNECTED_ROAD_BLOCK_CUES_VERSION_V67:
// Block-built replacements for the removed GLB signs/lamps/banners on the
// snapshot-edge road. These are terrain blocks, so they cannot float, 404, or
// drift apart from the shifted town.
const roadPosts = [
  [128, -205, "yellowWool"],
  [184, -215, "whiteWool"],
  [280, -205, "yellowWool"],
  [392, -206, "redWool"],
] as const;
for (const [px, pz, cap] of roadPosts) {
  if (worldX === px && worldZ === pz && inRange(relY, 1, 3)) return materials.oakLog;
  if (Math.abs(worldX - px) <= 1 && worldZ === pz && relY === 4) {
    return harthmereV6Mat(materials, cap);
  }
}
const roadBannerPosts = [168, 224, 336] as const;
for (const px of roadBannerPosts) {
  if (worldX === px && worldZ === -214 && inRange(relY, 1, 4)) return materials.oakLog;
  if (Math.abs(worldX - px) <= 1 && worldZ === -214 && relY === 5) return materials.redWool;
  if (Math.abs(worldX - px) <= 1 && worldZ === -213 && relY === 5) return materials.blackWool;
}

  const wellD = Math.hypot(worldX - 400, worldZ + 235);
  if (wellD <= 4.25 && inRange(relY, 1, 3)) {
    if (relY === 1) return wellD <= 1.75 ? materials.blackWool : materials.stoneBrick;
    if (wellD >= 2.6 && wellD <= 4.25) return materials.stoneBrick;
  }

  if (inRect(worldX, worldZ, 482, 490, -213, -205)) {
    const d = Math.hypot(worldX - 486, worldZ + 209);
    if (relY === 1 && d <= 4.5) return d <= 2 ? materials.water : materials.stonePolished;
    if (relY === 2 && d <= 1.5) return materials.water;
  }

  const serviceSigns = [
    [502, -212, "yellowWool"], [446, -204, "yellowWool"], [520, -214, "greenWool"], [544, -218, "blackWool"],
    [486, -154, "whiteWool"], [584, -198, "blueWool"], [404, -176, "blackWool"], [510, -256, "redWool"],
    [566, -246, "greenWool"], [485, -282, "redWool"], [402, -235, "blackWool"],
  ] as const;
  for (const [sx, sz, mat] of serviceSigns) {
    if (worldX === sx && worldZ === sz && inRange(relY, 1, 2)) return materials.oakLog;
    if (Math.abs(worldX - sx) <= 1 && worldZ === sz && relY === 3) return harthmereV6Mat(materials, mat as HarthmereV6Mat);
  }

  const dockDecks =
    inRect(worldX, worldZ, 590, 608, -192, -184) ||
    inRect(worldX, worldZ, 590, 608, -180, -172) ||
    inRect(worldX, worldZ, 590, 608, -168, -160) ||
    inRect(worldX, worldZ, 590, 608, -156, -150);
  if (dockDecks && relY === 0) return materials.oakLumber;
  const dockPost = (worldX === 590 || worldX === 608) && [-192, -184, -180, -172, -168, -160, -156, -150].includes(worldZ);
  if (dockPost && inRange(relY, 1, 3)) return materials.oakLog;

  const graveStones = [[506, -145], [516, -139], [528, -147], [512, -132], [524, -134]] as const;
  for (const [gx, gz] of graveStones) {
    if (worldX === gx && worldZ === gz && inRange(relY, 1, 2)) return materials.stoneBrick;
    if (relY === 3 && worldZ === gz && Math.abs(worldX - gx) <= 1) return materials.stoneBrick;
  }

  if (inRect(worldX, worldZ, 435, 443, -224, -222) && inRange(relY, 1, 2)) return materials.hay;
  if (inRect(worldX, worldZ, 455, 459, -246, -242) && relY === 1) return materials.water;
  if (worldX === 444 && worldZ === -242 && inRange(relY, 1, 5)) return relY === 5 ? materials.yellowWool : materials.oakLog;
  if (inRange(worldX, 442, 446) && worldZ === -242 && relY === 4) return materials.hay;

  return undefined;
}

function harthmereV6FullTownBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const priorityBlock = harthmereV64PriorityStructureBlockAt(materials, worldX, worldY, worldZ);
  if (priorityBlock !== undefined) return priorityBlock;

  const dungeonBlock = harthmereV64DungeonBlockAt(materials, worldX, worldY, worldZ);
  if (dungeonBlock !== undefined) return dungeonBlock;

  if (harthmereV6ShouldForceClearRoofStreetAirBlockV1(worldX, worldY, worldZ)) return undefined;

  for (const building of HARTHMERE_V6_BUILDINGS) {
    const block = harthmereV6BuildingBlockAt(materials, building, worldX, worldY, worldZ);
    if (block !== undefined) return block;
  }

  return (
    harthmereV6WallAndGateBlockAt(materials, worldX, worldY, worldZ) ??
    harthmereV6FenceBlockAt(materials, worldX, worldY, worldZ) ??
    harthmereV6LandmarkBlockAt(materials, worldX, worldY, worldZ)
  );
}

// HARTHMERE_CLEAN_TOWN_REBUILD_V6_END

function distanceToSegment2D(
  worldX: number,
  worldZ: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
) {
  const abX = bx - ax;
  const abZ = bz - az;
  const apX = worldX - ax;
  const apZ = worldZ - az;
  const abLen2 = abX * abX + abZ * abZ;
  const t = abLen2 === 0 ? 0 : Math.max(0, Math.min(1, (apX * abX + apZ * abZ) / abLen2));
  const cx = ax + abX * t;
  const cz = az + abZ * t;
  return Math.hypot(worldX - cx, worldZ - cz);
}

function localDevWildsHash(worldX: number, worldZ: number, salt = 0) {
  const raw = Math.sin(worldX * 12.9898 + worldZ * 78.233 + salt * 37.719) * 43758.5453;
  return Math.abs(Math.floor(raw));
}

function isHarthmereWideWildsRoad(worldX: number, worldZ: number, width = 4) {
  const roads = [
    // HARTHMERE_CONNECTED_MAP_ROAD_V66: road from the snapshot edge into Harthmere's west approach.
    [
      HARTHMERE_SNAPSHOT_EDGE_ROAD_AUTHORED_START_X_V66,
      HARTHMERE_SNAPSHOT_EDGE_ROAD_AUTHORED_Z_V66,
      HARTHMERE_WEST_GATE_AUTHORED_X_V66,
      HARTHMERE_SNAPSHOT_EDGE_ROAD_AUTHORED_Z_V66,
    ],
    // North road out of the gate and into Greenmere.
    [486, -286, 486, STARTER_TOWN_WILDS_Z0 + 36],
    // South road through the new south gate into orchards and gravewood edge.
    [486, -112, 486, STARTER_TOWN_WILDS_Z1 - 36],
    // West trade road from market/west gate to Mill Road and Hunter's Track.
    [392, -209, STARTER_TOWN_WILDS_X0 + 36, -209],
    // East river road across the bridge into Briarfen.
    [590, -205, STARTER_TOWN_WILDS_X1 - 36, -205],
    // North-west hunter path.
    [430, -286, STARTER_TOWN_WILDS_X0 + 80, STARTER_TOWN_WILDS_Z0 + 110],
    // North-east wetland trail.
    [590, -250, STARTER_TOWN_WILDS_X1 - 110, STARTER_TOWN_WILDS_Z0 + 120],
    // South-west orchard lane.
    [430, -112, STARTER_TOWN_WILDS_X0 + 120, STARTER_TOWN_WILDS_Z1 - 120],
    // South-east gravewood lane.
    [560, -112, STARTER_TOWN_WILDS_X1 - 130, STARTER_TOWN_WILDS_Z1 - 130],
  ] as const;

  return roads.some(([ax, az, bx, bz]) => distanceToSegment2D(worldX, worldZ, ax, az, bx, bz) <= width);
}

function isInsideAuthoredHarthmereTown(worldX: number, worldZ: number, pad = 0) {
  return inRect(worldX, worldZ, 392, 590, -282, -112, pad);
}


function isHarthmereSnapshotMuckPatchV74(worldX: number, worldZ: number) {
  return isAuthoredPointInSnapshotMuckZoneV74([worldX, STARTER_TOWN_GROUND_Y + 1, worldZ], 0);
}

function harthmereWideWildsSurfaceMaterial(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldZ: number,
): TerrainID | undefined {
  const hash = localDevWildsHash(worldX, worldZ, 13);

  // SNAPSHOT_MUCK_TERRAIN_SURFACE_V74: source-visible muck/muckwad
  // tutorial areas are authored once in snapshot_runtime_rules_v74 and painted
  // as real terrain, not GLB decoration.
  if (isHarthmereSnapshotMuckPatchV74(worldX, worldZ)) {
    return materials.muckwad;
  }

  if (isHarthmereWideWildsRoad(worldX, worldZ, 3)) {
    return materials.gravel;
  }
  if (isHarthmereWideWildsRoad(worldX, worldZ, 7)) {
    return hash % 3 === 0 ? materials.dirt : materials.grass;
  }

  // HARTHMERE_CONNECTED_MAP_ROAD_SURFACE_V66:
  // The snapshot-edge road should read like the Wilds bible: packed dirt,
  // pale gravel, wagon ruts, grass shoulders, and signs of civilization before
  // the player reaches the safer town gate. The hard road lane is handled by
  // isHarthmereWideWildsRoad(); this paints the readable shoulder.
  if (
    distanceToSegment2D(
      worldX,
      worldZ,
      HARTHMERE_SNAPSHOT_EDGE_ROAD_AUTHORED_START_X_V66,
      HARTHMERE_SNAPSHOT_EDGE_ROAD_AUTHORED_Z_V66,
      HARTHMERE_WEST_GATE_AUTHORED_X_V66,
      HARTHMERE_SNAPSHOT_EDGE_ROAD_AUTHORED_Z_V66,
    ) <= 16
  ) {
    if (hash % 11 === 0) return materials.hay;
    if (hash % 5 === 0) return materials.dirt;
    return materials.grass;
  }

  // Do not repaint the authored town core. The town renderer owns that space.
  if (isInsideAuthoredHarthmereTown(worldX, worldZ, 10)) {
    return undefined;
  }

  // Gate Fields around all road exits: owned farms, grazing, and soft starter wilderness.
  const nearNorthGate = inRect(worldX, worldZ, 300, 680, -470, -286);
  const nearSouthGate = inRect(worldX, worldZ, 300, 680, -108, 210);
  const nearWestGate = inRect(worldX, worldZ, 80, 392, -300, -110);
  if (nearNorthGate || nearSouthGate || nearWestGate) {
    if (hash % 11 === 0) {
      return materials.soil;
    }
    if (hash % 7 === 0) {
      return materials.hay;
    }
    return materials.grass;
  }

  // Briarfen and river extension to the east/south-east.
  if (worldX > 630 && worldZ > -360 && worldZ < 180) {
    if (hash % 17 === 0) {
      return materials.water;
    }
    if (hash % 5 === 0) {
      return materials.moss;
    }
    if (hash % 7 === 0) {
      return materials.sand;
    }
    return materials.grass;
  }

  // Ruined Watchtower Ridge and quarry stone to the north-west.
  if (worldX < 350 && worldZ < -350) {
    if (hash % 5 === 0) {
      return materials.stone;
    }
    if (hash % 11 === 0) {
      return materials.coal;
    }
    return materials.grass;
  }

  // Gravewood to the south/south-east: colder ground, moss, old paths.
  if (worldZ > -80 && worldX > 420) {
    if (hash % 6 === 0) {
      return materials.moss;
    }
    if (hash % 19 === 0) {
      return materials.stoneBrick;
    }
    return materials.grass;
  }

  // Deep forest everywhere else.
  if (hash % 8 === 0) {
    return materials.moss;
  }
  if (hash % 37 === 0) {
    return materials.dandelion;
  }
  return materials.grass;
}

function isWideWildsTreeCenter(worldX: number, worldZ: number) {
  if (isInsideAuthoredHarthmereTown(worldX, worldZ, 22)) {
    return false;
  }
  if (isHarthmereWideWildsRoad(worldX, worldZ, 9)) {
    return false;
  }
  // Sparse block trees only. Dense visual forest lives in the runtime asset
  // renderer so collision remains playable and roads stay open.
  return localDevWildsHash(worldX, worldZ, 31) % 541 === 0;
}

type HarthmereHarvestableTreeKind = "oak" | "orchard" | "dead" | "pine" | "birch" | "willow";
type HarthmereHarvestableForageKind =
  | "mushroom"
  | "berry"
  | "herb"
  | "reed"
  | "clay"
  | "flax"
  | "root"
  | "flower"
  | "grave_moss"
  | "wild_garlic"
  | "honey";
type HarthmereHarvestableOreKind = "stone" | "coal" | "iron" | "silver" | "gold";

// These are actual voxel/block resources, not GLB decoration. The dense forest
// renderer makes the Wilds look alive, but the player can only harvest blocks
// that exist in terrain shards. Keep these away from roads/town so harvesting
// does not tear holes in buildings or create collision traps.
const HARTHMERE_HARVESTABLE_TREE_CENTERS = [
  // North / Greenmere: true timber groves beyond the gate road.
  [438, -366, "oak"], [470, -394, "birch"], [506, -382, "oak"], [524, -414, "oak"],
  [486, -448, "birch"], [552, -472, "pine"], [460, -520, "oak"], [580, -556, "pine"],
  [430, -610, "oak"], [508, -628, "birch"], [625, -662, "pine"], [700, -712, "pine"],
  [352, -706, "oak"], [602, -768, "pine"], [788, -824, "pine"],
  // West Old Wood and hunter track: dense, older, varied logging resources.
  [318, -300, "oak"], [250, -350, "birch"], [180, -260, "oak"], [112, -182, "oak"],
  [38, -104, "birch"], [-82, 28, "oak"], [-154, 166, "pine"], [208, 84, "oak"],
  [-178, -420, "pine"], [-90, -560, "oak"], [54, -660, "pine"], [210, -742, "birch"],
  [-188, -764, "pine"], [-188, 338, "oak"], [90, 394, "birch"],
  // South / orchard woods: apples near farms, then normal forest beyond.
  [370, -66, "orchard"], [408, -22, "orchard"], [432, 14, "orchard"], [512, 96, "oak"],
  [602, 178, "oak"], [682, 320, "dead"], [792, 382, "dead"], [382, 256, "oak"],
  [486, 336, "birch"], [588, 430, "oak"], [710, 452, "dead"], [926, 414, "dead"],
  // East Briarfen / wet forest: willow-like wetland timber and reeds around it.
  [700, -318, "willow"], [772, -412, "willow"], [872, -332, "oak"], [968, -244, "willow"],
  [1048, -128, "oak"], [1136, 34, "willow"], [1180, -620, "pine"], [1168, -462, "willow"],
  [1200, -196, "willow"], [1120, 210, "dead"], [1172, 420, "dead"],
  // Edge samples in every direction so long walks always find real trees.
  [-198, -620, "oak"], [-210, -890, "pine"], [96, -900, "pine"], [420, -902, "pine"],
  [934, -910, "pine"], [1180, -820, "pine"], [-180, 430, "oak"], [256, 468, "birch"],
] as const satisfies ReadonlyArray<readonly [number, number, HarthmereHarvestableTreeKind]>;

const HARTHMERE_HARVESTABLE_ORE_CENTERS = [
  // Watchtower ridge / quarry and bandit mine cuts.
  [292, -476, "stone"], [244, -532, "coal"], [178, -604, "iron"], [112, -696, "silver"],
  [326, -720, "coal"], [220, -820, "iron"], [64, -842, "coal"], [-116, -792, "silver"],
  // West old rocky cuts.
  [90, -338, "stone"], [-18, -258, "coal"], [-126, -146, "stone"], [-190, 92, "silver"],
  [-222, -432, "iron"], [-190, -610, "coal"], [-90, 332, "stone"], [132, 442, "coal"],
  // East Briarfen exposed stones and wet river cuts.
  [724, -396, "stone"], [836, -468, "coal"], [946, -364, "iron"], [1088, -236, "silver"],
  [1122, -518, "coal"], [1190, -318, "iron"], [1024, 12, "stone"], [1168, 240, "silver"],
  // South / Gravewood relic stones.
  [604, 118, "stone"], [710, 242, "coal"], [822, 344, "gold"], [1018, 388, "silver"],
  [496, 394, "iron"], [340, 372, "stone"], [940, 118, "coal"], [1098, 420, "gold"],
  // Far north samples so the extended woods stay useful.
  [420, -870, "iron"], [612, -878, "coal"], [790, -848, "silver"], [980, -824, "gold"],
] as const satisfies ReadonlyArray<readonly [number, number, HarthmereHarvestableOreKind]>;

const HARTHMERE_HARVESTABLE_FORAGE_CENTERS = [
  // Herbs, berries, mushrooms, flax, reeds, clay, and roots. These are small
  // voxel/block resources so harvesting has real gameplay, not just GLB scenery.
  [430, -350, "flax"], [450, -372, "herb"], [468, -398, "berry"], [394, -378, "honey"],
  [520, -398, "mushroom"], [546, -430, "berry"], [566, -462, "herb"], [586, -508, "root"],
  [420, -560, "mushroom"], [638, -620, "herb"], [720, -690, "berry"], [802, -760, "mushroom"],
  [250, -360, "wild_garlic"], [170, -280, "root"], [42, -138, "mushroom"], [-122, 24, "berry"],
  [-186, 188, "herb"], [-194, -620, "mushroom"], [88, -710, "root"], [240, -780, "berry"],
  [382, -54, "flower"], [420, 22, "berry"], [462, 74, "herb"], [536, 126, "mushroom"],
  [642, 220, "grave_moss"], [736, 314, "grave_moss"], [828, 386, "grave_moss"], [948, 444, "mushroom"],
  [650, -260, "reed"], [704, -320, "clay"], [780, -378, "reed"], [864, -286, "clay"],
  [930, -192, "reed"], [1016, -82, "reed"], [1110, 48, "clay"], [1184, 188, "reed"],
  [490, -840, "mushroom"], [620, -890, "berry"], [900, -860, "herb"], [1100, -720, "root"],
  [-170, -870, "mushroom"], [-210, 410, "herb"], [160, 460, "flower"], [1180, 420, "grave_moss"],
] as const satisfies ReadonlyArray<readonly [number, number, HarthmereHarvestableForageKind]>;

function harthmereResourceKey(x: number, z: number) {
  return `${x},${z}`;
}

const HARTHMERE_HARVESTABLE_TREE_CENTER_BY_COORD = new Map<
  string,
  HarthmereHarvestableTreeKind
>(
  HARTHMERE_HARVESTABLE_TREE_CENTERS.map(([x, z, kind]) => [
    harthmereResourceKey(x, z),
    kind,
  ]),
);

const HARTHMERE_HARVESTABLE_ORE_CENTER_BY_COORD = new Map<
  string,
  HarthmereHarvestableOreKind
>(
  HARTHMERE_HARVESTABLE_ORE_CENTERS.map(([x, z, kind]) => [
    harthmereResourceKey(x, z),
    kind,
  ]),
);

const HARTHMERE_HARVESTABLE_FORAGE_CENTER_BY_COORD = new Map<
  string,
  HarthmereHarvestableForageKind
>(
  HARTHMERE_HARVESTABLE_FORAGE_CENTERS.map(([x, z, kind]) => [
    harthmereResourceKey(x, z),
    kind,
  ]),
);

type HarthmereFastHarvestableMaterialName = keyof ReturnType<typeof localDevMaterials>;

function harthmereFastBlockKey(x: number, y: number, z: number) {
  return `${x},${y},${z}`;
}

function setHarthmereFastBlock(
  blocks: Map<string, HarthmereFastHarvestableMaterialName>,
  x: number,
  relY: number,
  z: number,
  materialName: HarthmereFastHarvestableMaterialName,
) {
  if (!isHarthmereLocalDevTerrainShardEnabledForWorldV3(x, z)) {
    return;
  }
  if (
    isInsideAuthoredHarthmereTown(x, z, 18) ||
    isHarthmereWideWildsRoad(x, z, 5)
  ) {
    return;
  }

  const y = STARTER_TOWN_GROUND_Y + relY;
  const key = harthmereFastBlockKey(x, y, z);
  if (!blocks.has(key)) {
    blocks.set(key, materialName);
  }
}

function buildHarthmereFastHarvestableBlockMap() {
  const blocks = new Map<string, HarthmereFastHarvestableMaterialName>();

  for (const [cx, cz, kind] of HARTHMERE_HARVESTABLE_TREE_CENTERS) {
    if (
      isInsideAuthoredHarthmereTown(cx, cz, 18) ||
      isHarthmereWideWildsRoad(cx, cz, 8)
    ) {
      continue;
    }

    const trunkHeight =
      kind === "orchard"
        ? 4
        : kind === "dead"
          ? 5
          : kind === "pine"
            ? 8
            : kind === "birch"
              ? 7
              : kind === "willow"
                ? 6
                : 6;

    for (let relY = 1; relY <= trunkHeight; relY += 1) {
      setHarthmereFastBlock(
        blocks,
        cx,
        relY,
        cz,
        kind === "birch" && relY % 2 === 0 ? "whiteWool" : "oakLog",
      );
    }

    if (kind !== "dead") {
      const branchY = trunkHeight - 1;
      for (let offset = -2; offset <= 2; offset += 1) {
        setHarthmereFastBlock(blocks, cx + offset, branchY, cz, "oakLog");
        setHarthmereFastBlock(blocks, cx, branchY, cz + offset, "oakLog");
      }
    } else {
      for (let offset = -2; offset <= 2; offset += 1) {
        setHarthmereFastBlock(blocks, cx + offset, trunkHeight, cz, "oakLog");
        setHarthmereFastBlock(blocks, cx, trunkHeight, cz + offset, "oakLog");
      }
      continue;
    }

    if (kind === "pine") {
      const canopyBottom = trunkHeight - 3;
      const canopyTop = trunkHeight + 3;
      for (let relY = canopyBottom; relY <= canopyTop; relY += 1) {
        const taper = Math.max(1, 5 - Math.max(0, relY - canopyBottom));
        for (let dx = -taper; dx <= taper; dx += 1) {
          for (let dz = -taper; dz <= taper; dz += 1) {
            if (Math.abs(dx) + Math.abs(dz) <= taper) {
              setHarthmereFastBlock(blocks, cx + dx, relY, cz + dz, "oakLeaf");
            }
          }
        }
      }
      continue;
    }

    const leafCenterY = kind === "willow" ? trunkHeight : trunkHeight + 1;
    const leafRadius = kind === "orchard" ? 3 : kind === "willow" ? 5 : 4;
    for (let relY = trunkHeight - 2; relY <= trunkHeight + 3; relY += 1) {
      const verticalPenalty = Math.max(0, Math.abs(relY - leafCenterY) - 1);
      for (let dx = -leafRadius; dx <= leafRadius; dx += 1) {
        for (let dz = -leafRadius; dz <= leafRadius; dz += 1) {
          if (Math.abs(dx) + Math.abs(dz) + verticalPenalty <= leafRadius) {
            setHarthmereFastBlock(
              blocks,
              cx + dx,
              relY,
              cz + dz,
              kind === "orchard" && relY === trunkHeight && (cx + dx + cz + dz) % 5 === 0
                ? "rose"
                : "oakLeaf",
            );
          }
        }
      }
    }
  }

  for (const [cx, cz, kind] of HARTHMERE_HARVESTABLE_ORE_CENTERS) {
    if (
      isInsideAuthoredHarthmereTown(cx, cz, 18) ||
      isHarthmereWideWildsRoad(cx, cz, 7)
    ) {
      continue;
    }

    const materialName: HarthmereFastHarvestableMaterialName =
      kind === "coal"
        ? "coal"
        : kind === "iron"
          ? "ironOre"
          : kind === "silver"
            ? "silverOre"
            : kind === "gold"
              ? "goldOre"
              : "stone";

    for (let dx = -4; dx <= 4; dx += 1) {
      for (let dz = -4; dz <= 4; dz += 1) {
        const horizontal = Math.abs(dx) + Math.abs(dz);
        if (horizontal <= 3) {
          setHarthmereFastBlock(blocks, cx + dx, 1, cz + dz, materialName);
        }
        if (horizontal <= 2) {
          setHarthmereFastBlock(blocks, cx + dx, 2, cz + dz, materialName);
        }
        if (horizontal <= 1) {
          setHarthmereFastBlock(blocks, cx + dx, 3, cz + dz, materialName);
        }
        if (kind !== "stone" && horizontal === 3 && (cx + dx + cz + dz) % 2 === 0) {
          setHarthmereFastBlock(blocks, cx + dx, 2, cz + dz, materialName);
        }
      }
    }
  }

  for (const [cx, cz, kind] of HARTHMERE_HARVESTABLE_FORAGE_CENTERS) {
    if (
      isInsideAuthoredHarthmereTown(cx, cz, 18) ||
      isHarthmereWideWildsRoad(cx, cz, 5)
    ) {
      continue;
    }

    for (let dx = -3; dx <= 3; dx += 1) {
      for (let dz = -3; dz <= 3; dz += 1) {
        const horizontal = Math.abs(dx) + Math.abs(dz);
        const x = cx + dx;
        const z = cz + dz;

        if (kind === "clay") {
          if (horizontal <= 2) {
            setHarthmereFastBlock(blocks, x, 1, z, (x + z) % 2 === 0 ? "soil" : "sand");
          }
          if (horizontal <= 1) {
            setHarthmereFastBlock(blocks, x, 2, z, (x + z) % 2 === 0 ? "soil" : "sand");
          }
          continue;
        }

        if (kind === "reed" || kind === "flax") {
          if (horizontal <= 1) {
            for (let relY = 1; relY <= (kind === "reed" ? 4 : 3); relY += 1) {
              setHarthmereFastBlock(blocks, x, relY, z, kind === "reed" ? "switchGrass" : "hay");
            }
          }
          continue;
        }

        if (kind === "root") {
          if (horizontal <= 2) {
            setHarthmereFastBlock(blocks, x, 1, z, "oakLog");
          }
          continue;
        }

        if (horizontal > 2) {
          continue;
        }

        switch (kind) {
          case "mushroom":
            setHarthmereFastBlock(blocks, x, 1, z, horizontal === 0 ? "redWool" : "moss");
            break;
          case "berry":
            setHarthmereFastBlock(blocks, x, 1, z, horizontal <= 1 ? "rose" : "oakLeaf");
            break;
          case "herb":
          case "wild_garlic":
            setHarthmereFastBlock(blocks, x, 1, z, "switchGrass");
            break;
          case "flower":
            setHarthmereFastBlock(blocks, x, 1, z, (x + z) % 2 === 0 ? "dandelion" : "rose");
            break;
          case "grave_moss":
            setHarthmereFastBlock(blocks, x, 1, z, horizontal === 0 ? "blackWool" : "moss");
            break;
          case "honey":
            setHarthmereFastBlock(blocks, x, 1, z, horizontal === 0 ? "yellowWool" : "oakLog");
            break;
          default:
            setHarthmereFastBlock(blocks, x, 1, z, "switchGrass");
            break;
        }
      }
    }
  }

  return blocks;
}

const HARTHMERE_FAST_HARVESTABLE_BLOCK_BY_COORD =
  buildHarthmereFastHarvestableBlockMap();

function harthmereFastHarvestableBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const materialName = HARTHMERE_FAST_HARVESTABLE_BLOCK_BY_COORD.get(
    harthmereFastBlockKey(worldX, worldY, worldZ),
  );
  return materialName ? materials[materialName] : undefined;
}


function harthmereHarvestableOreMaterial(
  materials: ReturnType<typeof localDevMaterials>,
  kind: HarthmereHarvestableOreKind,
) {
  switch (kind) {
    case "coal":
      return materials.coal;
    case "iron":
      return materials.ironOre;
    case "silver":
      return materials.silverOre;
    case "gold":
      return materials.goldOre;
    case "stone":
    default:
      return materials.stone;
  }
}

function harthmereHarvestableTreeCandidates(worldX: number, worldZ: number) {
  const candidates: Array<readonly [number, number, HarthmereHarvestableTreeKind]> = [];
  for (let dx = -6; dx <= 6; dx += 1) {
    for (let dz = -6; dz <= 6; dz += 1) {
      const cx = worldX - dx;
      const cz = worldZ - dz;
      const kind = HARTHMERE_HARVESTABLE_TREE_CENTER_BY_COORD.get(
        harthmereResourceKey(cx, cz),
      );
      if (kind) {
        candidates.push([cx, cz, kind]);
      }
    }
  }
  return candidates;
}

function harthmereHarvestableTreeBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  if (relY < 1 || relY > 12) {
    return undefined;
  }
  if (
    isInsideAuthoredHarthmereTown(worldX, worldZ, 18) ||
    isHarthmereWideWildsRoad(worldX, worldZ, 8)
  ) {
    return undefined;
  }

  for (const [cx, cz, kind] of harthmereHarvestableTreeCandidates(worldX, worldZ)) {
    const dx = worldX - cx;
    const dz = worldZ - cz;
    const adx = Math.abs(dx);
    const adz = Math.abs(dz);
    const trunkHeight =
      kind === "orchard"
        ? 4
        : kind === "dead"
          ? 5
          : kind === "pine"
            ? 8
            : kind === "birch"
              ? 7
              : kind === "willow"
                ? 6
                : 6;

    if (adx === 0 && adz === 0 && inRange(relY, 1, trunkHeight)) {
      return kind === "birch" && relY % 2 === 0 ? materials.whiteWool : materials.oakLog;
    }

    if (
      kind !== "dead" &&
      relY === trunkHeight - 1 &&
      ((adz === 0 && adx <= 2) || (adx === 0 && adz <= 2))
    ) {
      return materials.oakLog;
    }

    if (kind === "dead") {
      if (
        relY === trunkHeight &&
        ((adz === 0 && adx <= 2) || (adx === 0 && adz <= 2))
      ) {
        return materials.oakLog;
      }
      continue;
    }

    if (kind === "pine") {
      const canopyBottom = trunkHeight - 3;
      const canopyTop = trunkHeight + 3;
      if (relY >= canopyBottom && relY <= canopyTop) {
        const taper = Math.max(1, 5 - Math.max(0, relY - canopyBottom));
        if (adx + adz <= taper) {
          return materials.oakLeaf;
        }
      }
      continue;
    }

    const leafCenterY = kind === "willow" ? trunkHeight : trunkHeight + 1;
    const verticalPenalty = Math.max(0, Math.abs(relY - leafCenterY) - 1);
    const leafRadius = kind === "orchard" ? 3 : kind === "willow" ? 5 : 4;
    if (
      relY >= trunkHeight - 2 &&
      relY <= trunkHeight + 3 &&
      adx + adz + verticalPenalty <= leafRadius
    ) {
      if (
        kind === "orchard" &&
        relY === trunkHeight &&
        (worldX + worldZ) % 5 === 0
      ) {
        return materials.rose;
      }
      return materials.oakLeaf;
    }
  }

  return undefined;
}

function harthmereHarvestableOreCandidates(worldX: number, worldZ: number) {
  const candidates: Array<readonly [number, number, HarthmereHarvestableOreKind]> = [];
  for (let dx = -4; dx <= 4; dx += 1) {
    for (let dz = -4; dz <= 4; dz += 1) {
      const cx = worldX - dx;
      const cz = worldZ - dz;
      const kind = HARTHMERE_HARVESTABLE_ORE_CENTER_BY_COORD.get(
        harthmereResourceKey(cx, cz),
      );
      if (kind) {
        candidates.push([cx, cz, kind]);
      }
    }
  }
  return candidates;
}

function harthmereHarvestableOreBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  if (relY < 1 || relY > 4) {
    return undefined;
  }
  if (
    isInsideAuthoredHarthmereTown(worldX, worldZ, 18) ||
    isHarthmereWideWildsRoad(worldX, worldZ, 7)
  ) {
    return undefined;
  }

  for (const [cx, cz, kind] of harthmereHarvestableOreCandidates(worldX, worldZ)) {
    const adx = Math.abs(worldX - cx);
    const adz = Math.abs(worldZ - cz);
    const horizontal = adx + adz;
    const isBase = relY === 1 && horizontal <= 3;
    const isMiddle = relY === 2 && horizontal <= 2;
    const isCap = relY === 3 && horizontal <= 1;
    const isClusterChip =
      kind !== "stone" &&
      relY === 2 &&
      horizontal === 3 &&
      (worldX + worldZ) % 2 === 0;
    if (isBase || isMiddle || isCap || isClusterChip) {
      return harthmereHarvestableOreMaterial(materials, kind);
    }
  }

  return undefined;
}

function harthmereHarvestableForageCandidates(worldX: number, worldZ: number) {
  const candidates: Array<readonly [number, number, HarthmereHarvestableForageKind]> = [];
  for (let dx = -3; dx <= 3; dx += 1) {
    for (let dz = -3; dz <= 3; dz += 1) {
      const cx = worldX - dx;
      const cz = worldZ - dz;
      const kind = HARTHMERE_HARVESTABLE_FORAGE_CENTER_BY_COORD.get(
        harthmereResourceKey(cx, cz),
      );
      if (kind) {
        candidates.push([cx, cz, kind]);
      }
    }
  }
  return candidates;
}

function harthmereHarvestableForageBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  if (relY < 1 || relY > 4) {
    return undefined;
  }
  if (
    isInsideAuthoredHarthmereTown(worldX, worldZ, 18) ||
    isHarthmereWideWildsRoad(worldX, worldZ, 5)
  ) {
    return undefined;
  }

  for (const [cx, cz, kind] of harthmereHarvestableForageCandidates(worldX, worldZ)) {
    const adx = Math.abs(worldX - cx);
    const adz = Math.abs(worldZ - cz);
    const horizontal = adx + adz;
    if (kind === "clay") {
      if ((relY === 1 && horizontal <= 2) || (relY === 2 && horizontal <= 1)) {
        return (worldX + worldZ) % 2 === 0 ? materials.soil : materials.sand;
      }
      continue;
    }
    if (kind === "reed" || kind === "flax") {
      if (horizontal <= 1 && inRange(relY, 1, kind === "reed" ? 4 : 3)) {
        return kind === "reed" ? materials.switchGrass : materials.hay;
      }
      continue;
    }
    if (kind === "root") {
      if (relY === 1 && horizontal <= 2) {
        return materials.oakLog;
      }
      continue;
    }
    if (relY !== 1 || horizontal > 2) {
      continue;
    }
    switch (kind) {
      case "mushroom":
        return horizontal === 0 ? materials.redWool : materials.moss;
      case "berry":
        return horizontal <= 1 ? materials.rose : materials.oakLeaf;
      case "herb":
      case "wild_garlic":
        return materials.switchGrass;
      case "flower":
        return (worldX + worldZ) % 2 === 0 ? materials.dandelion : materials.rose;
      case "grave_moss":
        return horizontal === 0 ? materials.blackWool : materials.moss;
      case "honey":
        return horizontal === 0 ? materials.yellowWool : materials.oakLog;
      default:
        return materials.switchGrass;
    }
  }

  return undefined;
}

function harthmereWideWildsBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  if (relY < 1 || relY > 10) {
    return undefined;
  }
  if (isInsideAuthoredHarthmereTown(worldX, worldZ, 16)) {
    return undefined;
  }

  const harvestableResource = harthmereFastHarvestableBlockAt(
    materials,
    worldX,
    worldY,
    worldZ,
  );
  if (harvestableResource) {
    return harvestableResource;
  }

  // Waystones at the four new road exits and major wilderness bends. They are
  // deliberately off the centerline so they guide without blocking movement.
  const waystones = [
    [486, -344, "redWool"],
    [486, 36, "yellowWool"],
    [322, -209, "greenWool"],
    [660, -205, "blueWool"],
    [255, -410, "blackWool"],
    [720, -365, "blueWool"],
    [250, 120, "greenWool"],
    [720, 120, "whiteWool"],
  ] as const;
  for (const [sx, sz, mat] of waystones) {
    if (worldX === sx && worldZ === sz && inRange(relY, 1, 3)) {
      return relY === 3 ? harthmereV6Mat(materials, mat as HarthmereV6Mat) : materials.stoneBrick;
    }
  }

  // Forest density is handled by the runtime renderer using non-blocking props.
  // Do not generate voxel tree trunks/leaves here; doing so makes shim startup
  // scale badly and can create collision snags in the expanded Wilds.

  // Small wilderness harvest markers. These are sparse and never placed on the
  // road so the player can cross the whole map without getting wedged.
  if (relY === 1 && !isHarthmereWideWildsRoad(worldX, worldZ, 9)) {
    const hash = localDevWildsHash(worldX, worldZ, 47);
    if (hash % 863 === 0) {
      return materials.woodCrate;
    }
    if (hash % 431 === 0) {
      return materials.switchGrass;
    }
    if (hash % 389 === 0) {
      return materials.rose;
    }
  }

  return undefined;
}

function starterTownSurfaceMaterial(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldZ: number,
  current: TerrainID,
): TerrainID {
  const harthmereV6Surface = harthmereV6SurfaceMaterial(
    materials,
    worldX,
    worldZ,
  );
  const wideWildsSurface = harthmereWideWildsSurfaceMaterial(
    materials,
    worldX,
    worldZ,
  );
  return harthmereV6Surface ?? wideWildsSurface ?? current;
}

function chickenBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const chickens = [
    [439, -235],
    [444, -230],
    [451, -239],
    [455, -229],
    [436, -243],
  ] as const;
  for (const [cx, cz] of chickens) {
    const dx = worldX - cx;
    const dz = worldZ - cz;
    if (worldY === STARTER_TOWN_GROUND_Y + 1 && Math.abs(dx) <= 1 && dz === 0) {
      return materials.whiteWool;
    }
    if (worldY === STARTER_TOWN_GROUND_Y + 2 && dx === 0 && dz === 0) {
      return materials.whiteWool;
    }
    if (worldY === STARTER_TOWN_GROUND_Y + 2 && dx === 0 && dz === -1) {
      return materials.yellowWool;
    }
    if (
      worldY === STARTER_TOWN_GROUND_Y + 2 &&
      Math.abs(dx) === 1 &&
      dz === -1
    ) {
      return materials.coal;
    }
  }
  return undefined;
}

function townWallBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const x0 = 392;
  const x1 = 590;
  const z0 = -282;
  const z1 = -112;
  const onWall =
    (worldX === x0 || worldX === x1 || worldZ === z0 || worldZ === z1) &&
    inRect(worldX, worldZ, x0, x1, z0, z1);
  const northGateGap = worldZ === z0 && inRange(worldX, 477, 497);
  const bridgeGateGap = worldX === x1 && inRange(worldZ, -212, -198);
  if (
    onWall &&
    !northGateGap &&
    !bridgeGateGap &&
    inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 6)
  ) {
    return materials.stoneBrick;
  }

  const gateTowers = [
    [466, 474, -284, -276],
    [500, 508, -284, -276],
    [584, 592, -216, -208],
    [584, 592, -194, -186],
  ] as const;
  for (const [tx0, tx1, tz0, tz1] of gateTowers) {
    const inside = inRect(worldX, worldZ, tx0, tx1, tz0, tz1);
    const edge =
      inside &&
      (worldX === tx0 || worldX === tx1 || worldZ === tz0 || worldZ === tz1);
    if (inside && worldY === STARTER_TOWN_GROUND_Y) {
      return materials.stonePolished;
    }
    if (
      edge &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 10)
    ) {
      return materials.stoneBrick;
    }
    if (inside && worldY === STARTER_TOWN_GROUND_Y + 11) {
      return materials.stoneShingles;
    }
  }

  return undefined;
}

function bridgeDockBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  if (worldY === STARTER_TOWN_GROUND_Y) {
    if (inRect(worldX, worldZ, 586, 607, -210, -200)) {
      return materials.stonePolished;
    }
    const dockDecks =
      inRect(worldX, worldZ, 590, 606, -190, -184) ||
      inRect(worldX, worldZ, 590, 606, -178, -172) ||
      inRect(worldX, worldZ, 590, 606, -166, -160);
    if (dockDecks) {
      return materials.oakLumber;
    }
  }
  const dockPost =
    (worldX === 590 || worldX === 606) &&
    (worldZ === -190 ||
      worldZ === -184 ||
      worldZ === -178 ||
      worldZ === -172 ||
      worldZ === -166 ||
      worldZ === -160);
  if (
    dockPost &&
    inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 3)
  ) {
    return materials.oakLog;
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRect(worldX, worldZ, 594, 600, -188, -162) &&
    (worldX + worldZ) % 7 === 0
  ) {
    return materials.woodCrate;
  }
  return undefined;
}

function graveyardBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const stones = [
    [504, -144],
    [510, -140],
    [516, -146],
    [522, -138],
    [528, -148],
    [508, -130],
    [520, -128],
    [532, -134],
  ] as const;
  for (const [sx, sz] of stones) {
    if (
      worldX === sx &&
      worldZ === sz &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 3)
    ) {
      return materials.stoneBrick;
    }
    if (
      worldY === STARTER_TOWN_GROUND_Y + 3 &&
      worldZ === sz &&
      Math.abs(worldX - sx) <= 1
    ) {
      return materials.stoneBrick;
    }
  }
  return undefined;
}

function drainTunnelBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  if (!inRect(worldX, worldZ, 396, 404, -238, -232)) {
    return undefined;
  }
  const arch =
    (worldX === 396 || worldX === 404 || worldZ === -238 || worldZ === -232) &&
    inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 4);
  if (arch) {
    return materials.stoneBrick;
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y &&
    inRect(worldX, worldZ, 398, 402, -236, -234)
  ) {
    return materials.cobblestone;
  }
  return undefined;
}

function appleOrchardBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  const trees = [
    [448, -112],
    [460, -114],
    [472, -116],
    [446, -100],
    [458, -98],
    [470, -102],
  ] as const;
  for (const [tx, tz] of trees) {
    const dx = Math.abs(worldX - tx);
    const dz = Math.abs(worldZ - tz);
    if (
      dx === 0 &&
      dz === 0 &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 5)
    ) {
      return materials.oakLog;
    }
    const leafY = worldY - (STARTER_TOWN_GROUND_Y + 5);
    if (leafY >= -1 && leafY <= 3 && dx + dz + Math.abs(leafY - 1) <= 4) {
      if (leafY === 0 && (worldX + worldZ) % 5 === 0) {
        return materials.rose;
      }
      return materials.oakLeaf;
    }
  }
  return undefined;
}

function starterTownAboveGroundBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  return (
    harthmereV6FullTownBlockAt(materials, worldX, worldY, worldZ) ??
    harthmereWideWildsBlockAt(materials, worldX, worldY, worldZ)
  );
}

function starterTownDecorBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number,
): TerrainID | undefined {
  if (worldY !== STARTER_TOWN_GROUND_Y + 1) {
    return undefined;
  }

  if (isStarterTownFarm(worldX, worldZ)) {
    if ((worldX + worldZ) % 5 === 0) {
      return materials.carrot;
    }
    return (worldX + worldZ) % 2 === 0 ? materials.wheat : undefined;
  }

  if (isStarterTownRoad(worldX, worldZ) || isStarterTownPlaza(worldX, worldZ)) {
    return undefined;
  }

  const hash = Math.abs((worldX * 73856093) ^ (worldZ * 19349663));
  if (hash % 131 === 0) {
    return materials.sunflower;
  }
  if (hash % 97 === 0) {
    return materials.rose;
  }
  if (hash % 53 === 0) {
    return materials.dandelion;
  }
  if (hash % 17 === 0) {
    return materials.switchGrass;
  }
  return undefined;
}

function localDevTerrainShardSpecs() {
  const specs: Array<{
    id: BiomesId;
    shardX: number;
    shardY: number;
    shardZ: number;
  }> = [];
  let idOffset = 0;

  // Ground is y=52, so shardY=1 covers y=32..63. That includes the flat
  // surface, roads, walls, roofs, and low landmarks. A second empty air layer
  // is not needed and was the largest cause of the shim startup wait.
  for (let shardY = 1; shardY <= 1; shardY += 1) {
    for (
      let shardX = STARTER_TOWN_WILDS_SHARD_X0;
      shardX <= STARTER_TOWN_WILDS_SHARD_X1;
      shardX += 1
    ) {
      for (
        let shardZ = STARTER_TOWN_WILDS_SHARD_Z0;
        shardZ <= STARTER_TOWN_WILDS_SHARD_Z1;
        shardZ += 1
      ) {
        specs.push({
          id: (LOCAL_DEV_TERRAIN_ID_BASE + idOffset++) as BiomesId,
          shardX: shardX + harthmereExtraTownShardOffsetXV1(),
          shardY,
          shardZ: shardZ + harthmereExtraTownShardOffsetZV1(),
        });
      }
    }
  }
  return specs;
}

function localDevLegacyTerrainShardIdsV3() {
  return Array.from({ length: HARTHMERE_LEGACY_LOCAL_DEV_TERRAIN_SHARD_COUNT_V3 }, (_, offset) =>
    (LOCAL_DEV_TERRAIN_ID_BASE + offset) as BiomesId,
  );
}

function makeLocalDevStaleTerrainDeletesV3(
  tick: number,
  activeTerrainIds: Set<BiomesId>,
  existingIds: Set<BiomesId>,
): Change[] {
  if (HARTHMERE_LOCAL_DEV_PERF_PROFILE_V3 === "full") {
    return [];
  }
  const deletes: Change[] = [];
  for (const id of localDevLegacyTerrainShardIdsV3()) {
    if (!activeTerrainIds.has(id) && existingIds.has(id)) {
      deletes.push({ kind: "delete", tick, id });
    }
  }
  return deletes;
}

function makeLocalDevTerrainShard(
  voxeloo: VoxelooModule,
  kind: "create" | "update",
  id: BiomesId,
  shardX: number,
  shardY: number,
  shardZ: number,
  tick: number,
): Change {
  const v0 = shardToVoxelPos(shardX, shardY, shardZ);
  const v1 = [v0[0] + SHARD_DIM, v0[1] + SHARD_DIM, v0[2] + SHARD_DIM] as [
    number,
    number,
    number,
  ];

  const materials = localDevMaterials();

  const buffer = using(new voxeloo.VolumeBlock_U32(), (seedBlock) => {
    const groundLocalY = STARTER_TOWN_GROUND_Y - v0[1];
    const hasGroundInShard = groundLocalY >= 0 && groundLocalY < SHARD_DIM;

    // The Harthmere local-dev world is intentionally flat. Fill the ground and
    // underground material directly, then only check authored town/wilderness
    // structures for the few above-ground y values. This keeps the expanded
    // Wilds playable without blocking shim readiness for minutes.
    for (let z = 0; z < SHARD_DIM; z += 1) {
      for (let x = 0; x < SHARD_DIM; x += 1) {
        const worldX = v0[0] + x;
        const worldZ = v0[2] + z;
        const authoredWorldX = harthmereAuthoredWorldXV1(worldX);
        const authoredWorldZ = harthmereAuthoredWorldZV1(worldZ);

        if (hasGroundInShard) {
          for (let y = 0; y <= groundLocalY; y += 1) {
            const worldY = v0[1] + y;
            const depth = STARTER_TOWN_GROUND_Y - worldY;
            const base =
              depth === 0
                ? materials.grass
                : depth > 6
                  ? materials.stone
                  : materials.dirt;

            if (depth === 0) {
              const authoredGround = starterTownAboveGroundBlockAt(
                materials,
                authoredWorldX,
                worldY,
                authoredWorldZ,
              );
              seedBlock.set(
                x,
                y,
                z,
                authoredGround ??
                  starterTownSurfaceMaterial(materials, authoredWorldX, authoredWorldZ, base),
              );
            } else {
              const authoredUnderground = starterTownAboveGroundBlockAt(
                materials,
                authoredWorldX,
                worldY,
                authoredWorldZ,
              );
              if (authoredUnderground) {
                seedBlock.set(x, y, z, authoredUnderground);
              } else if (!harthmereV6ShouldCarveDungeonAirBlockAt(authoredWorldX, worldY, authoredWorldZ)) {
                seedBlock.set(x, y, z, base);
              }
            }
          }

          for (let y = groundLocalY + 1; y < SHARD_DIM; y += 1) {
            const worldY = v0[1] + y;
            const authoredBlock = starterTownAboveGroundBlockAt(
              materials,
              authoredWorldX,
              worldY,
              authoredWorldZ,
            );
            if (authoredBlock) {
              seedBlock.set(x, y, z, authoredBlock);
            }
          }
        } else if (v1[1] <= STARTER_TOWN_GROUND_Y) {
          for (let y = 0; y < SHARD_DIM; y += 1) {
            const worldY = v0[1] + y;
            const authoredUnderground = starterTownAboveGroundBlockAt(
              materials,
              authoredWorldX,
              worldY,
              authoredWorldZ,
            );
            if (authoredUnderground) {
              seedBlock.set(x, y, z, authoredUnderground);
            } else if (!harthmereV6ShouldCarveDungeonAirBlockAt(authoredWorldX, worldY, authoredWorldZ)) {
              seedBlock.set(x, y, z, materials.stone);
            }
          }
        } else {
          for (let y = 0; y < SHARD_DIM; y += 1) {
            const worldY = v0[1] + y;
            const authoredBlock = starterTownAboveGroundBlockAt(
              materials,
              authoredWorldX,
              worldY,
              authoredWorldZ,
            );
            if (authoredBlock) {
              seedBlock.set(x, y, z, authoredBlock);
            }
          }
        }
      }
    }
    return saveBlock(voxeloo, seedBlock);
  });

  const entity = {
    id,
    box: Box.create({ v0, v1 }),
    shard_seed: ShardSeed.create({ buffer }),
    shard_diff: ShardDiff.create(),
    shard_shapes: ShardShapes.create(),
  };

  return kind === "create" ? { kind, tick, entity } : { kind, tick, entity };
}

function resolveNpcTypeId(
  preferredNames: string[],
  fallbackIds: BiomesId[] = [],
): BiomesId | undefined {
  // Harthmere local-dev townspeople must use the synthetic local-dev human
  // type. The Bikkie tray may also contain a biscuit named local_dev_human,
  // but that path renders with the regular player-like head. Returning the
  // synthetic type here keeps every named/dialogue NPC on the same blocky
  // Bolt-style voxel renderer as the ambient townspeople.
  if (preferredNames.includes("local_dev_human")) {
    return LOCAL_DEV_HUMAN_NPC_TYPE_ID;
  }

  const preferred = getBiscuits("/npcs/types").find((biscuit) =>
    preferredNames.includes(biscuit.name),
  );
  if (preferred?.id && isNpcTypeId(preferred.id)) {
    return preferred.id;
  }
  return fallbackIds.find((id) => isNpcTypeId(id));
}

type StarterNpc = {
  id: BiomesId;
  preferredTypes: string[];
  fallbackTypes: BiomesId[];
  displayName: string;
  position: Vec3;
  orientation: Vec2;
  velocity?: Vec3;
  dialog: string;
  description: string;
  face: HarthmereVoxelFaceConfig;
  body: HarthmereVoxelBodyConfig;
};

function starterNpc(
  offset: number,
  displayName: string,
  position: Vec3,
  orientation: Vec2,
  dialog: string,
  description = "A local-dev Harthmere resident.",
  velocity?: Vec3,
): StarterNpc {
  return {
    id: (LOCAL_DEV_NPC_ID_BASE + offset) as BiomesId,
    preferredTypes: ["local_dev_human"],
    fallbackTypes: [LOCAL_DEV_HUMAN_NPC_TYPE_ID],
    displayName,
    position,
    orientation,
    velocity,
    dialog,
    description,
    face: makeHarthmereNpcFaceConfig({
      id: (LOCAL_DEV_NPC_ID_BASE + offset) as BiomesId,
      name: displayName,
      roleHint: description,
    }),
    body: makeHarthmereNpcBodyConfig({
      id: (LOCAL_DEV_NPC_ID_BASE + offset) as BiomesId,
      name: displayName,
      roleHint: description,
    }),
  };
}

function npcDialog(...lines: string[]) {
  return lines.map((line) => `<text>${line}</text>`).join("{break}");
}

function starterTownNpcs(): StarterNpc[] {
  // NPC feet should sit on the authored ground/floor block. The previous +2
  // offset made several townspeople float above roads, shop floors, and paths.
  const y = STARTER_TOWN_GROUND_Y + 1;
  return [
    starterNpc(
      1,
      "Mira, Town Guide",
      [488, y, -205],
      [0, 3.15],
      npcDialog(
        "Welcome to Harthmere, traveler. Start with the Market Board beside the fountain; it tells new arrivals what to do next.",
        "Your house is south-west of the square. It has a bed, storage, a hearth, and a starter journal upstairs.",
        "If you get lost, follow the colored signs: red for safety and law, blue for services, yellow for jobs, green for food and healing.",
        "The town is safe in the center, but the docks, drains, and old well are where the strange stories begin.",
      ),
      "The guide for the local-dev starter town.",
    ),
    starterNpc(
      2,
      "Bolt, Archive Robot",
      [505, y, -190],
      [0, 4.7],
      npcDialog(
        "Archive note: the original production world snapshot is missing, so Harthmere is the local-dev replacement starter town.",
        "Everything here is procedural or block-built on purpose. It should not fetch missing production meshes, icons, audio, or textures.",
        "If a cosmetic asset is unavailable, it must fail soft. Gameplay should continue.",
        "The Market Board includes the local-dev quest/objective test chain.",
      ),
      "A robot archivist explaining the local-dev setup.",
    ),
    starterNpc(
      3,
      "Toma, Builder",
      [504, y, -221],
      [0, 3.0],
      npcDialog(
        "Mind the roads. I flattened the town footprint so nobody should fall through holes or spawn under land.",
        "The important interiors now have props: counters, beds, shelves, barrels, vaults, hearths, and worktables.",
        "If you see anyone sinking, check their exact spawn height before blaming the renderer.",
        "The next good test is walking every shop, doorway, and sign from the Market Board.",
      ),
      "The builder standing by the workshop.",
    ),
    starterNpc(
      4,
      "Pip, Harbor Mascot",
      [441, y, -202],
      [0, 1.5],
      npcDialog(
        "Peep! I am not an official guide, but even I know the Market Board is where new work starts.",
        "The baker gives good crumbs. The banker does not.",
        "The chickens are near the farm. They have formed no government yet.",
        "If the old well rings, I was never here.",
      ),
      "A friendly town mascot near the market stalls.",
    ),
    starterNpc(
      5,
      "Maren Dawnloaf, Baker",
      [434, y, -192],
      [0, 1.55],
      npcDialog(
        "Fresh bread, warm enough to fog the window. Welcome to Dawn Loaf Bakery.",
        "New arrivals should read the Market Board before wandering into the docks or drains.",
        "Bring me apples from the orchard and I can bake road cakes for the guards.",
        "The chapel has ordered more mourning loaves lately. Father Aldren says nothing, which means something.",
      ),
      "The bakery owner.",
    ),
    starterNpc(
      6,
      "Banker Merl Voss",
      [550, y, -222],
      [0, 4.7],
      npcDialog(
        "Welcome to Harthmere Bank. Speak clearly, count twice, and do not lean on the vault door.",
        "Storage, ledgers, lockboxes, and guild deposits all pass through this counter.",
        "One lockbox went missing near Mudden Ward. I dislike mysteries involving my inventory.",
        "The Market Board posts bank errands when I require outside help.",
      ),
      "A cheerless bank teller and storage steward.",
    ),
    starterNpc(
      7,
      "Brann, Weapons Teller",
      [532, y, -228],
      [0, 3.15],
      npcDialog(
        "Blades, cudgels, spearheads, and repair work. The Black Anvil keeps the Watch armed.",
        "If you are new, start with a training blade and learn where the Guard Yard stands.",
        "Master Osric says every tool has a memory. I say every dull sword has a fee.",
        "There is a work order on the Market Board for cold iron and hot tempers.",
      ),
      "The weapons shopkeeper.",
    ),
    starterNpc(
      8,
      "Luma, Healer",
      [456, y, -176],
      [0, 1.55],
      npcDialog(
        "Breathe. Sit. Let the shaking stop before you call it courage.",
        "The Green Mortar keeps salves, bandages, fever tea, and honest advice.",
        "The road herbs are thin this week. If you see willow bark or mint, bring it here.",
        "The chapel candles burn strangely when the old bell is heard under the stones.",
      ),
      "The healing shop NPC.",
    ),
    starterNpc(
      9,
      "Edrin Starling, Magic Supplier",
      [514, y, -168],
      [0, 4.7],
      npcDialog(
        "Welcome to the Wyrm and Candle. Do not touch the glowing crystal unless it touches you first.",
        "I sell chalk, candles, scrolls, crystals, and explanations nobody believes until too late.",
        "The old bridge carvings match symbols under the well. That should bother more people.",
        "If the Market Board sends you here, ask about the Missing Bell and keep your voice down.",
      ),
      "The magic shop supplier.",
    ),
    starterNpc(
      10,
      "Tilda Fen, Farmer",
      [444, y, -236],
      [0, 0.1],
      npcDialog(
        "The chickens are loose again. That is not a metaphor, though this town deserves one.",
        "The farm feeds the bakery, the tavern, and half the complaints at the market.",
        "If you find eggs outside the fence, bring them back before Pip starts a feast.",
        "The orchard road is safe by day. By night, keep to the lanterns.",
      ),
      "The farmer watching the chicken yard.",
    ),
    starterNpc(
      11,
      "Garrick, Bartender",
      [538, y, -194],
      [0, 4.7],
      npcDialog(
        "Welcome to the Copper Kettle. If you can still stand, you can still order.",
        "The stage is open, the hearth is warm, and every table has heard a lie worth repeating.",
        "Ask three patrons for rumors and you will learn which roads are trouble.",
        "If you need a room, speak to Elowen. If you need a secret, pay first.",
      ),
      "The tavern bartender.",
    ),
    starterNpc(
      12,
      "Jori, Dockhand",
      [550, y, -198],
      [0, 2.4],
      npcDialog(
        "The river is quiet when it wants you careless.",
        "Tovin tracks every crate, except the ones he very carefully does not track.",
        "There is a black crate on the lower pier that whispers in damp weather.",
        "If the Market Board says dock work is available, bring boots.",
      ),
      "A tavern patron and dock worker.",
    ),
    starterNpc(
      13,
      "Bela, Storyteller",
      [554, y, -190],
      [0, 3.4],
      npcDialog(
        "They say Harthmere began as a toll bridge and became a town by accident.",
        "They also say the chapel bell was buried, not stolen. That is the version people dislike.",
        "The old well rings during storms. Not loudly. Personally.",
        "Stories are warnings wearing nicer clothes.",
      ),
      "A tavern patron with local lore.",
    ),
    starterNpc(
      14,
      "Kip, Card Player",
      [546, y, -186],
      [0, 0.5],
      npcDialog(
        "I would deal you in, but the cards keep finding better hands.",
        "If you want easy coin, try courier work. If you want interesting coin, try the docks.",
        "The banker hates dice because dice do not respect ledgers.",
        "Ask Elowen about the cellar if you enjoy being told no.",
      ),
      "A tavern card player.",
    ),
    starterNpc(
      15,
      "Sola, Traveler",
      [538, y, -186],
      [0, 5.5],
      npcDialog(
        "I came looking for the old Biomes trails. Harthmere is smaller, but at least it answers back.",
        "The north road is good for beginners. The drains are not, whatever Nessa says.",
        "The Market Board has the least bad directions in town.",
        "If you hear a bell underground, pretend you did not until someone pays you.",
      ),
      "A tavern traveler.",
    ),
    starterNpc(
      16,
      "Mern, Tavern Bard",
      [558, y, -200],
      [0, 3.8],
      npcDialog(
        "I know one song: Ninety-eight Shards on the Wall. It is longer than the siege and twice as educational.",
        "The Copper Kettle stage is where rumors become public facts.",
        "A bard hears taxes, love, treason, and bad rhyme before breakfast.",
        "Bring me a true rumor and I will make it prettier.",
      ),
      "A bard in the tavern.",
    ),
    starterNpc(
      17,
      "Rowan, Walker",
      [486, y, -238],
      [0, 0.0],
      npcDialog(
        "I patrol the north road. If I stop moving, assume I found a good view.",
        "The new signs help. Before them, everyone asked the chickens for directions.",
      ),
      "A walking town NPC.",
      [0.35, 0, 0],
    ),
    starterNpc(
      18,
      "Iva, Walker",
      [470, y, -210],
      [0, 1.57],
      npcDialog(
        "The plaza connects every important shop. That was deliberate; nobody likes getting lost during a smoke test.",
        "If you are new, read the Market Board before picking a road.",
      ),
      "A walking town NPC.",
      [0, 0, 0.35],
    ),
    starterNpc(
      19,
      "Cade, Walker",
      [520, y, -210],
      [0, 4.71],
      npcDialog(
        "I walk between the bank and the weapons shop to make the town feel less empty.",
        "The blacksmith has opinions about bad steel and worse politics.",
      ),
      "A walking town NPC.",
      [0, 0, -0.35],
    ),
    starterNpc(
      20,
      "Sera, Walker",
      [486, y, -178],
      [0, 3.14],
      npcDialog(
        "The healing shop and magic shop are both open. One fixes mistakes; the other causes them carefully.",
        "The chapel is quiet today. That usually means Aldren knows something.",
      ),
      "A walking town NPC.",
      [-0.35, 0, 0],
    ),
    starterNpc(
      21,
      "Tess, Walker",
      [438, y, -210],
      [0, 1.2],
      npcDialog(
        "The bakery smells better than the archive. Do not tell Bolt I said that.",
        "Market work pays small, but it teaches the town.",
      ),
      "A walking town NPC.",
      [0.25, 0, 0.25],
    ),
    starterNpc(
      22,
      "Niko, Walker",
      [558, y, -210],
      [0, 4.2],
      npcDialog(
        "The bank is mostly stone, optimism, and a very serious teller.",
        "Merl once frowned at a coin until it apologized.",
      ),
      "A walking town NPC.",
      [-0.25, 0, -0.25],
    ),
    starterNpc(
      23,
      "Pera, Walker",
      [462, y, -250],
      [0, 0.8],
      npcDialog(
        "That two-level house is yours. Upstairs is for looking important; downstairs is for finding the door.",
        "There is a starter journal inside. It points you back to the Market Board.",
      ),
      "A walking town NPC.",
      [0.2, 0, 0.3],
    ),
    starterNpc(
      24,
      "Olan, Walker",
      [532, y, -170],
      [0, 5.4],
      npcDialog(
        "The magic shop roof glows because someone insisted the town needed a landmark besides the tower.",
        "If the crystal hums, do not hum back.",
      ),
      "A walking town NPC.",
      [-0.2, 0, -0.3],
    ),
    starterNpc(
      25,
      "Rin, Walker",
      [452, y, -232],
      [0, 2.1],
      npcDialog(
        "The chickens are near the farm. They are small, loud, and committed to their role.",
        "Tilda pays in eggs and blunt wisdom.",
      ),
      "A walking town NPC.",
      [0.3, 0, -0.2],
    ),
    starterNpc(
      26,
      "Dax, Walker",
      [512, y, -236],
      [0, 0.2],
      npcDialog(
        "The weapons shop is south of the bank. The tavern is where everyone goes after pretending to work.",
        "The Guard Yard has dummies if you need to hit something legal.",
      ),
      "A walking town NPC.",
      [-0.3, 0, 0.2],
    ),
    starterNpc(
      27,
      "Sergeant Bram Holt",
      [486, y, -277],
      [0, 3.14],
      npcDialog(
        "State your business and keep your hands where I can see them. Harthmere opens its gate, but it does not lower its guard.",
        "New arrivals report to the Market Board after entering. The town is safer when people know where they are going.",
        "If you want honest work, read the Guard notice and visit the Yard.",
        "If you want dishonest work, I do not want to know why you are asking.",
      ),
      "A stern north-gate guard who knows every regular traveler.",
    ),
    starterNpc(
      28,
      "Mara Thistle",
      [440, y, -200],
      [0, 1.2],
      npcDialog(
        "Buy two onions and I might tell you who crossed the bridge after midnight.",
        "The market hears more truth than the hall does. Start at the board, then come back to me.",
        "Bread, bank, blade, blessing. Learn those four stops and Harthmere will open itself to you.",
        "The Missing Bell? Ask Aldren, then Nessa, then decide whether you still wanted the answer.",
      ),
      "A market vendor with a perfect memory for gossip.",
    ),
    starterNpc(
      29,
      "Master Osric Vale",
      [506, y, -220],
      [0, 4.7],
      npcDialog(
        "Iron remembers the hand that shapes it.",
        "I repair plows by day and ask fewer questions about blades by night.",
        "The Watch needs training weapons. The town needs hinges, nails, and fewer speeches from Reeve Hall.",
        "If the Market Board sends you for cold iron, bring patience too.",
      ),
      "The blacksmith of Craftsman Row.",
    ),
    starterNpc(
      30,
      "Elowen Pike",
      [545, y, -192],
      [0, 4.7],
      npcDialog(
        "You can bleed outside or pay for a room. The Copper Kettle keeps a hearth for travelers and secrets for those who earn them.",
        "Settle in, listen before speaking, and never trust the first version of a tavern rumor.",
        "Six patrons, six stories, one truth if you are lucky.",
        "The cellar is closed. That answer changes when I decide it changes.",
      ),
      "The tavern keeper, warm until crossed.",
    ),
    starterNpc(
      31,
      "Father Aldren",
      [477, y, -139],
      [0, 3.14],
      npcDialog(
        "Faith is not the absence of fear. It is what remains when the old bell rings and nobody admits they heard it.",
        "Light a candle before leaving town. The roads remember who travels humbly.",
        "The bell was not stolen by common hands. Some truths are buried because they still move.",
        "If Nessa says the drains speak, listen to her. Carefully.",
      ),
      "The priest of Saint Verena's chapel.",
    ),
    starterNpc(
      32,
      "Reeve Caldus Merrow",
      [564, y, -262],
      [0, 3.14],
      npcDialog(
        "Order is expensive. People who complain about taxes rarely understand what chaos costs.",
        "The bridge makes Harthmere valuable. My office makes it manageable.",
        "Rumors about bells, drains, and smuggling are often spread by people avoiding payment.",
        "If you want permits, speak to my clerk. If you want trouble, keep asking questions.",
      ),
      "The polished, calculating ruler of Harthmere.",
    ),
    starterNpc(
      33,
      "Nessa Crowe",
      [404, y, -160],
      [0, 1.57],
      npcDialog(
        "You walk like someone who has never been chased by three dogs and a landlord.",
        "I know the drain tunnels, but trust is not free.",
        "Children hear the old bell first because adults are better at lying to themselves.",
        "If the Market Board points you to the Old Well, bring a light and fewer assumptions.",
      ),
      "A sharp Mudden Ward rat-catcher and guide.",
    ),
    starterNpc(
      34,
      "Tovin Reed",
      [579, y, -183],
      [0, 1.57],
      npcDialog(
        "Nothing enters Harthmere by river unless I know its weight, smell, and lie.",
        "Cargo runs pay. Smuggling pays better. Getting caught pays nothing.",
        "That black crate is not mine, which is exactly what I would say if it were.",
        "If Bram asks, I said the docks are boring.",
      ),
      "The dockmaster with flexible morals.",
    ),
    starterNpc(
      35,
      "Lysa, Cloth Merchant",
      [532, y, -202],
      [0, 2.0],
      npcDialog(
        "Burgundy cloth for market days, gray wool for honest work, and a hood if you would rather not be noticed.",
        "The Merchant Compact loves rules until rules cost them money.",
        "If you need dye, check Craftsman Row. If you need gossip, stay here.",
      ),
      "A merchant selling cloth and rumors.",
    ),
    starterNpc(
      36,
      "Perrin, Moneylender",
      [556, y, -226],
      [0, 4.2],
      npcDialog(
        "Debt is only frightening to those who pretend promises are lighter than iron.",
        "The bank stores valuables. I store leverage.",
        "A missing lockbox is a tragedy. A missing ledger is an opportunity.",
      ),
      "A moneylender watching the bank door.",
    ),
    starterNpc(
      37,
      "Old Jory",
      [431, y, -112],
      [0, 0.6],
      npcDialog(
        "Apples grow sweeter near old trouble.",
        "The orchard remembers the bridge tax riot better than the reeve does.",
        "Bring the baker good apples and she will send you away heavier than you came.",
      ),
      "A farmer from the apple fields.",
    ),
    starterNpc(
      38,
      "Mirel, Gravekeeper",
      [518, y, -137],
      [0, 3.8],
      npcDialog(
        "The dead do not mind visitors. They mind thieves, liars, and people who whistle near the crypt wall.",
        "Someone has been leaving wet footprints near dry graves.",
        "A missing bell is bad. A buried bell is worse.",
      ),
      "The quiet keeper of the chapel graveyard.",
    ),
    starterNpc(
      39,
      "Rusk, Toll Clerk",
      [482, y, -280],
      [0, 0.0],
      npcDialog(
        "One copper to cross, two if your cart wheel squeaks, and nothing if Sergeant Holt is glaring at me.",
        "The bridge tax is legal. Popular is a different question.",
        "I just write the numbers. Please direct threats to the office with better curtains.",
      ),
      "A nervous toll clerk beneath the north gate.",
    ),
    starterNpc(
      40,
      "Sable, Smuggler",
      [399, y, -235],
      [0, 1.57],
      npcDialog(
        "The underways are just drains to honest folk. To everyone else, they are doors without hinges.",
        "If you want clean work, ask the Market Board. If you want useful work, ask quieter.",
        "The old well has bars for a reason. The reason is not safety.",
      ),
      "A suspicious figure near the old drain tunnel.",
    ),
    starterNpc(
      41,
      "Harthmere Market Board",
      [503, y, -209],
      [0, 3.14],
      npcDialog(
        "MARKET BOARD: New arrivals should begin with Welcome to Harthmere.",
        "Available work: bakery apples, missing lockbox, cold iron, fever tea, tavern rumors, loose chickens, whispering crate, and Missing Bell inquiry.",
        "Suggested path: North Gate, Market, Inn, Smithy, Bank, Chapel, Guard Yard, then choose Farms, Docks, or Old Drains.",
        "This board also drives the local-dev quest/objective test system.",
      ),
      "A quest board covered in notices, arrows, and beginner work.",
    ),
    starterNpc(
      42,
      "Town Crier Pell",
      [499, y, -207],
      [0, 3.14],
      npcDialog(
        "Hear ye, hear ye! Newcomers should read the Market Board before bothering the baker, banker, or birds.",
        "Daily writs are posted beside the fountain. Honest coin for honest confusion.",
        "The chapel bell remains missing. Reeve Hall insists this is not news.",
        "If you cannot find your next objective, come back to the board.",
      ),
      "A loud town crier standing beside the Market Board.",
    ),
    starterNpc(
      43,
      "Courier Anwen",
      [552, y, -216],
      [0, 4.7],
      npcDialog(
        "Mail for the bank, letters for the chapel, notices for the docks. I run because everyone else waits.",
        "Courier jobs teach the town faster than any map.",
        "If a package whispers, deliver it to Tovin and then forget my name.",
      ),
      "The courier for mail and delivery work.",
    ),
    starterNpc(
      44,
      "Drill Instructor Hal",
      [512, y, -266],
      [0, 3.14],
      npcDialog(
        "Feet apart. Eyes forward. Hit the dummy, not the quartermaster.",
        "The Guard Yard is where new players learn safe combat before the roads get opinions.",
        "Bram sends recruits here when they need discipline or distance.",
      ),
      "A guard trainer in the yard.",
    ),
    starterNpc(
      45,
      "Bounty Clerk Rowan",
      [518, y, -262],
      [0, 3.14],
      npcDialog(
        "Bounties are posted by threat, distance, and how likely you are to come back complaining.",
        "Rats count. Bandits count more. Grave robbers count only if they are still breathing.",
        "The first bounty is usually a lesson, not a fortune.",
      ),
      "The clerk for bounties and patrol work.",
    ),
    starterNpc(
      46,
      "Sister Maelle",
      [486, y, -136],
      [0, 3.14],
      npcDialog(
        "A candle is a small light, but small lights keep roads from becoming graves.",
        "Charity work is posted at the chapel and board. Food, bandages, candles, medicine.",
        "Father Aldren carries too much silence for one man.",
      ),
      "A chapel healer and charity organizer.",
    ),
    starterNpc(
      47,
      "Ysabet Fenlow",
      [458, y, -172],
      [0, 4.7],
      npcDialog(
        "The correct dose is the difference between remedy, poison, and paperwork.",
        "Fever tea needs willow bark, mint, and clean water. The clean water is somehow the hardest part.",
        "People call magic suspicious until they need medicine.",
      ),
      "The apothecary of the Green Mortar.",
    ),
    starterNpc(
      48,
      "Garrik Fen",
      [504, y, -216],
      [0, 4.7],
      npcDialog(
        "Wood bends before it breaks. People could learn from that.",
        "I build crates, handles, signs, and bridges nobody thanks until they fail.",
        "The Market Board needs repairs every time someone nails a complaint too hard.",
      ),
      "A carpenter in Craftsman Row.",
    ),
    starterNpc(
      49,
      "Helna Voss",
      [499, y, -225],
      [0, 3.14],
      npcDialog(
        "Boots, belts, straps, waterskins. Leather keeps the town moving when iron cannot.",
        "The stable owes me coin. The bank says it is a process. I say it is theft with chairs.",
        "Bring hides later and I will teach you which cuts survive rain.",
      ),
      "A leatherworker.",
    ),
    starterNpc(
      50,
      "Selka Weaver",
      [455, y, -194],
      [0, 1.57],
      npcDialog(
        "Cloth tells class before a mouth opens.",
        "I keep banners for guilds, aprons for bakers, and hoods for people with too much history.",
        "Red-and-black means Watch. Green shutters mean money. Mud means Mudden Ward got ignored again.",
      ),
      "A tailor and banner maker.",
    ),
    starterNpc(
      51,
      "Ferry Master Wren",
      [592, y, -184],
      [0, 1.57],
      npcDialog(
        "The ferry runs when the river allows it and when Tovin stops arguing with the manifest.",
        "Boat travel opens later. For now, learn the docks and keep your hands out of black water.",
        "Fog makes fools brave.",
      ),
      "The ferry master at the docks.",
    ),
    starterNpc(
      52,
      "Mudden Child Lio",
      [418, y, -156],
      [0, 1.57],
      npcDialog(
        "Nessa says not to talk to strangers unless they look lost enough to help.",
        "The drains have voices. The grown-ups call them echoes.",
        "If you find a red ribbon near the well, do not keep it.",
      ),
      "A child from Mudden Ward.",
    ),
    starterNpc(
      53,
      "Washerwoman Cale",
      [424, y, -152],
      [0, 1.57],
      npcDialog(
        "Laundry tells the truth. Blood, river mud, perfume, ash. Nobles pay extra to pretend it does not.",
        "The ward floods first and gets repaired last.",
        "If you want to help, bring soup, not speeches.",
      ),
      "A Mudden Ward washerwoman.",
    ),
    starterNpc(
      54,
      "Tax Clerk Iven",
      [555, y, -260],
      [0, 3.14],
      npcDialog(
        "Permits require a stamp, a fee, and patience measured in geologic time.",
        "The reeve is available never. I am available unfortunately.",
        "If your complaint concerns the bridge tax, take a number and lower your expectations.",
      ),
      "A clerk in Reeve Hall.",
    ),
    starterNpc(
      55,
      "Noble Servant Rose",
      [570, y, -258],
      [0, 3.14],
      npcDialog(
        "The gardens are trimmed, the brass is polished, and everyone downstairs is pretending not to hear the protests.",
        "Servants know which doors are locked and which locks are decorative.",
        "Reeve Hall has more windows than honesty.",
      ),
      "A servant in Noble Rise.",
    ),
    starterNpc(
      56,
      "Guard Quartermaster Tarrow",
      [504, y, -262],
      [0, 3.14],
      npcDialog(
        "If it has a point, edge, strap, or dent, I inventory it.",
        "Do not borrow Watch equipment unless you enjoy being counted as missing property.",
        "Osric repairs the serious damage. I assign blame for the rest.",
      ),
      "The Guard Yard quartermaster.",
    ),
    starterNpc(
      57,
      "Traveling Merchant Ossa",
      [528, y, -202],
      [0, 2.4],
      npcDialog(
        "Today I sell rope, maps, chalk, whistles, and optimism by the yard.",
        "Bridge Day brings better stock if the roads stay clear.",
        "If you cannot afford a compass, follow the loudest argument.",
      ),
      "A traveling market merchant.",
    ),
    starterNpc(
      58,
      "Food Vendor Marae",
      [443, y, -197],
      [0, 1.2],
      npcDialog(
        "Hot onions, seed cakes, and cider. Cheap enough to regret twice.",
        "The Market Board sends hungry travelers everywhere except lunch.",
        "A good meal is a minor blessing with better smell.",
      ),
      "A market food vendor.",
    ),
    starterNpc(
      59,
      "Guild Registrar Wyne",
      [550, y, -218],
      [0, 4.7],
      npcDialog(
        "Guild names must be legible, non-treasonous, and not already claimed by someone louder.",
        "Recruitment notices belong on the board wall, not nailed to my chair.",
        "Crests cost extra because artists eat too.",
      ),
      "The guild registrar in the services area.",
    ),
    starterNpc(
      60,
      "Auction Clerk Pellam",
      [556, y, -218],
      [0, 4.7],
      npcDialog(
        "Listing fees first. Complaints second. Regret is handled by appointment only.",
        "The market board teaches work. The auction board teaches consequences.",
        "Do not list haunted crates without disclosure.",
      ),
      "The auction and trade clerk.",
    ),
    starterNpc(
      61,
      "Rat Catcher Dima",
      [406, y, -162],
      [0, 1.57],
      npcDialog(
        "Rats are honest. They bite, steal, and run without inventing laws about it.",
        "Nessa knows the drains. I know which drains know back.",
        "Rat-catching is posted daily because rats are punctual criminals.",
      ),
      "A Mudden Ward rat-catcher.",
    ),
    starterNpc(
      62,
      "Bell-Witness Ora",
      [484, y, -188],
      [0, 3.14],
      npcDialog(
        "I heard the bell at dawn. Nobody believes an old woman until the stone starts singing under their own feet.",
        "The sound came from below the square, not the chapel.",
        "Read the board. Follow the candles. Do not go alone after the third ring.",
      ),
      "An old witness near the well.",
    ),
    starterNpc(
      63,
      "Apple Picker Ren",
      [462, y, -112],
      [0, 0.6],
      npcDialog(
        "The baker wants apples without wormholes, bruises, or ghost stories.",
        "The orchard road is pretty. That is how roads trick you.",
        "Old Jory says trees remember. I say they drop things on my head.",
      ),
      "An apple picker in the orchard.",
    ),
    starterNpc(
      64,
      "Stablehand Corin",
      [432, y, -260],
      [0, 0.6],
      npcDialog(
        "The stable is small today, but the travel system has ambitions.",
        "Feed the mule before judging it. Same advice works on guards.",
        "One day this yard will send players to farms, roads, and ferry routes.",
      ),
      "A stablehand near the south-west road.",
    ),
    starterNpc(
      65,
      "River Knots Lookout",
      [602, y, -176],
      [0, 4.7],
      npcDialog(
        "Pretty docks, ugly secrets.",
        "If Tovin says a crate is boring, count your fingers after touching it.",
        "Legal work is on the Market Board. Better stories are found after sunset.",
      ),
      "A suspicious dock lookout.",
    ),
    starterNpc(
      66,
      "Chapel Choir Child",
      [470, y, -134],
      [0, 3.14],
      npcDialog(
        "We sing softer since the bell went missing.",
        "Father says silence can be holy. I think he is scared of echoes.",
        "Sister Maelle lets me light candles if I do not drip wax on the floor.",
      ),
      "A child in the chapel choir.",
    ),
    starterNpc(
      67,
      "Forge Apprentice Luth",
      [526, y, -225],
      [0, 3.14],
      npcDialog(
        "Master Osric says I swing too hard. The anvil has not complained.",
        "The beginner work order is nails, hinges, and humility.",
        "If a sword glows without permission, call Edrin.",
      ),
      "A blacksmith apprentice.",
    ),
    starterNpc(
      68,
      "Bakery Apprentice Noll",
      [426, y, -188],
      [0, 1.55],
      npcDialog(
        "I burned the first batch, underbaked the second, and named the third progress.",
        "Maren says road bread should be hard enough to travel but soft enough to forgive.",
        "The apple quest is real. Please choose apples that have not fought back.",
      ),
      "A bakery apprentice.",
    ),
    starterNpc(
      69,
      "Market Guard Sen",
      [448, y, -206],
      [0, 1.2],
      npcDialog(
        "Keep the path clear. The square handles players, carts, stalls, and bad decisions.",
        "The board is watched. So are the pockets near it.",
        "If a riot starts, stand behind the fountain unless you are useful.",
      ),
      "A guard assigned to the market.",
    ),
    starterNpc(
      70,
      "Underways Echo",
      [402, y, -235],
      [0, 1.57],
      npcDialog(
        "The bars are new. The stones are not.",
        "Something below remembers the bell by name.",
        "This entrance should unlock through the Missing Bell chain, not by wandering in blind.",
      ),
      "A strange whisper near the sealed underways entrance.",
    ),
  ];
}


function makeLocalDevSnapshotCombatNpcChangesV74(
  tick: number,
  existingIds: Set<BiomesId>,
) {
  const now = secondsSinceEpoch();
  const changes: Change[] = [];
  const typeId = isNpcTypeId(BikkieIds.dMucker)
    ? BikkieIds.dMucker
    : LOCAL_DEV_HUMAN_NPC_TYPE_ID;

  for (const spawn of SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS_V74) {
    const id = (Number(LOCAL_DEV_NPC_ID_BASE) + spawn.idOffset) as BiomesId;
    const entity = npcEntity(
      {
        id,
        typeId,
        position: harthmereGroundedNpcWorldPositionV67(spawn.authoredPosition),
        orientation: [0, 0],
        velocity: [0, 0, 0],
        displayName: spawn.displayName,
        defaultDialog: spawn.defaultDialog,
      },
      now,
    );
    changes.push({
      kind: existingIds.has(id) ? "update" : "create",
      tick,
      entity: {
        ...entity,
        entity_description: EntityDescription.create({
          text: `SNAPSHOT_COMBAT_RUNTIME_V74 ${spawn.profile} ${spawn.areaId} leash=${spawn.leashRadius}`,
        }),
      },
    });
  }
  return changes;
}

function localDevSnapshotCombatNpcIdsV74() {
  return SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS_V74.map(
    (spawn) => (Number(LOCAL_DEV_NPC_ID_BASE) + spawn.idOffset) as BiomesId,
  );
}

function isLocalDevQuestGiverNpcId(id: BiomesId) {
  const offset = Number(id) - Number(LOCAL_DEV_NPC_ID_BASE);
  return new Set([
    1, 5, 6, 7, 8, 9, 10, 11, 27, 28, 29, 30, 31, 33, 34, 41, 42, 44, 46, 47,
    62, 70,
  ]).has(offset);
}
function makeLocalDevNpcChanges(tick: number, existingIds: Set<BiomesId>) {
  const now = secondsSinceEpoch();
  const changes: Change[] = [];
  for (const npc of starterTownNpcs()) {
    const typeId = resolveNpcTypeId(npc.preferredTypes, npc.fallbackTypes);
    if (!typeId) {
      log.warn("Could not find a usable local dev NPC type", {
        displayName: npc.displayName,
        preferredTypes: npc.preferredTypes,
      });
      continue;
    }

    const entity = {
      ...npcEntity(
        {
          id: npc.id,
          typeId,
          position: harthmereGroundedNpcWorldPositionV67(npc.position),
          orientation: npc.orientation,
          velocity: npc.velocity,
          displayName: npc.displayName,
          defaultDialog: npc.dialog,
        },
        now,
      ),
      entity_description: EntityDescription.create({
        text: withHarthmereBodyAndFaceMarkers(npc.description, npc.face, npc.body),
      }),
      ...(isLocalDevQuestGiverNpcId(npc.id)
        ? {
            quest_giver: QuestGiver.create({
              concurrent_quests: 1,
              concurrent_quest_dialog: npc.dialog,
            }),
          }
        : {}),
    };
    changes.push({
      kind: existingIds.has(npc.id) ? "update" : "create",
      tick,
      entity,
    });
  }
  return changes;
}


const LOCAL_DEV_SEED_APPLY_BATCH_SIZE = 400;

function localDevSeedChangeId(change: Change) {
  if (change.kind === "create" || change.kind === "update") {
    return change.entity.id;
  }
  return change.id;
}

function summarizeLocalDevSeedChanges(changes: Change[]) {
  let creates = 0;
  let updates = 0;
  let deletes = 0;
  let terrainShards = 0;
  let npcs = 0;
  let other = 0;

  for (const change of changes) {
    if (change.kind === "create") {
      creates += 1;
    } else if (change.kind === "update") {
      updates += 1;
    } else if (change.kind === "delete") {
      deletes += 1;
    }

    const id = localDevSeedChangeId(change);
    if (id >= LOCAL_DEV_TERRAIN_ID_BASE && id < LOCAL_DEV_TERRAIN_ID_LIMIT) {
      terrainShards += 1;
    } else if (id >= LOCAL_DEV_NPC_ID_BASE && id < LOCAL_DEV_NPC_ID_LIMIT) {
      npcs += 1;
    } else {
      other += 1;
    }
  }

  return {
    totalChanges: changes.length,
    creates,
    updates,
    deletes,
    terrainShards,
    npcs,
    other,
  };
}

function firstAndLastLocalDevSeedIds(changes: Change[]) {
  if (changes.length === 0) {
    return { firstId: undefined, lastId: undefined };
  }
  return {
    firstId: localDevSeedChangeId(changes[0]),
    lastId: localDevSeedChangeId(changes[changes.length - 1]),
  };
}

function localDevSeedChangeBatches(changes: Change[], batchSize: number) {
  const batches: Change[][] = [];
  for (let start = 0; start < changes.length; start += batchSize) {
    batches.push(changes.slice(start, start + batchSize));
  }
  return batches;
}

async function applyLocalDevSeedChangesInDebugBatches(
  worldApi: WorldApi,
  changes: Change[],
) {
  const batches = localDevSeedChangeBatches(
    changes,
    LOCAL_DEV_SEED_APPLY_BATCH_SIZE,
  );

  log.warn("Applying local dev starter town seed changes in batches", {
    reason:
      "Redis Lua apply has a max key count per transaction; Harthmere terrain + NPCs exceed that if applied at once.",
    maxBatchSize: LOCAL_DEV_SEED_APPLY_BATCH_SIZE,
    batchCount: batches.length,
    ...summarizeLocalDevSeedChanges(changes),
    ...firstAndLastLocalDevSeedIds(changes),
  });

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    log.warn("Applying local dev starter town seed batch", {
      batchNumber: index + 1,
      batchCount: batches.length,
      maxBatchSize: LOCAL_DEV_SEED_APPLY_BATCH_SIZE,
      ...summarizeLocalDevSeedChanges(batch),
      ...firstAndLastLocalDevSeedIds(batch),
    });

    const applied = await worldApi.apply({
      changes: batch.map(toProposedChange),
    });
    if (applied.outcome !== "success") {
      log.warn("Local dev starter town seed batch did not apply", {
        batchNumber: index + 1,
        batchCount: batches.length,
        outcome: applied.outcome,
        ...summarizeLocalDevSeedChanges(batch),
        ...firstAndLastLocalDevSeedIds(batch),
      });
      return false;
    }
  }

  return true;
}

function makeLocalDevObsoleteTerrainDeletionChanges(
  tick: number,
  existingIds: Set<BiomesId>,
) {
  const wantedTerrainIds = new Set(localDevTerrainShardSpecs().map((spec) => spec.id));
  const changes: Change[] = [];
  for (const id of existingIds) {
    if (
      id >= LOCAL_DEV_TERRAIN_ID_BASE &&
      id < LOCAL_DEV_TERRAIN_ID_LIMIT &&
      !wantedTerrainIds.has(id)
    ) {
      changes.push({ kind: "delete", tick, id });
    }
  }
  return changes;
}

function makeLocalDevMiniWorldChanges(
  voxeloo: VoxelooModule,
  tick: number,
  existingIds: Set<BiomesId>,
) {
  const changes: Change[] = [];
  const specs = localDevTerrainShardSpecs();
  const staleTerrainDeletes = makeLocalDevObsoleteTerrainDeletionChanges(tick, existingIds);
  if (staleTerrainDeletes.length) {
    changes.push(...staleTerrainDeletes);
    log.warn("Pruning obsolete local dev terrain shards", {
      version: HARTHMERE_LOCAL_DEV_TERRAIN_BOUNDS_VERSION_V4,
      count: staleTerrainDeletes.length,
    });
  }
  const startedAt = Date.now();

  log.warn("Building local dev starter town seed changes", {
    terrainShardSpecs: specs.length,
    existingLocalDevIds: existingIds.size,
    fastHarvestableBlocks: HARTHMERE_FAST_HARVESTABLE_BLOCK_BY_COORD.size,
    muckZones: SNAPSHOT_HARTHMERE_MUCK_ZONES_V74.length,
    harvestableTreeCenters: HARTHMERE_HARVESTABLE_TREE_CENTERS.length,
    harvestableOreClusters: HARTHMERE_HARVESTABLE_ORE_CENTERS.length,
    harvestableForageClusters: HARTHMERE_HARVESTABLE_FORAGE_CENTERS.length,
  });

  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    const shardStartedAt = Date.now();
    const terrainChange = makeLocalDevTerrainShard(
      voxeloo,
      existingIds.has(spec.id) ? "update" : "create",
      spec.id,
      spec.shardX,
      spec.shardY,
      spec.shardZ,
      tick,
    );
    changes.push(terrainChange);

    const shardElapsedMs = Date.now() - shardStartedAt;
    if (
      index === 0 ||
      (index + 1) % 128 === 0 ||
      index + 1 === specs.length ||
      shardElapsedMs > 750
    ) {
      log.warn("Built local dev terrain seed shard", {
        shardNumber: index + 1,
        terrainShardSpecs: specs.length,
        shardId: spec.id,
        shardX: spec.shardX,
        shardY: spec.shardY,
        shardZ: spec.shardZ,
        shardElapsedMs,
        totalElapsedMs: Date.now() - startedAt,
      });
    }
  }

  const npcStartedAt = Date.now();
  const npcChanges = makeLocalDevNpcChanges(tick, existingIds);
  const combatNpcChanges = makeLocalDevSnapshotCombatNpcChangesV74(tick, existingIds);
  changes.push(...npcChanges, ...combatNpcChanges);

  log.warn("Built local dev starter town seed changes", {
    terrainShards: specs.length,
    npcs: npcChanges.length,
    snapshotCombatNpcs: combatNpcChanges.length,
    totalChanges: changes.length,
    terrainElapsedMs: npcStartedAt - startedAt,
    npcElapsedMs: Date.now() - npcStartedAt,
    totalElapsedMs: Date.now() - startedAt,
  });

  return changes;
}

async function existingLocalDevIds(
  ids: BiomesId[],
  service: ShimWorldService | undefined,
  worldApi: WorldApi,
) {
  if (service) {
    return new Set(ids.filter((id) => service.table.get(id) !== undefined));
  }
  return new Set((await worldApi.has(ids)) as BiomesId[]);
}

async function seedLocalDevTerrainIfMissing(
  service: ShimWorldService | undefined,
  worldApi: WorldApi,
) {
  if (!shouldSeedLocalDevTerrain()) {
    return;
  }

  if (
    service &&
    hasNonLocalTerrainShard(service) &&
    process.env.BIOMES_FORCE_LOCAL_DEV_TOWN !== "1" &&
    process.env.BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN !== "1"
  ) {
    log.info(
      "Skipping local dev starter town because non-local terrain already exists.",
    );
    return;
  }

  const terrainIds = localDevTerrainShardSpecs().map((spec) => spec.id);
  const npcIds = starterTownNpcs().map((npc) => npc.id);
  const snapshotCombatNpcIds = localDevSnapshotCombatNpcIdsV74();
  const legacyTerrainIds = localDevLegacyTerrainShardIdsV3();
  const existingIds = await existingLocalDevIds(
    [...new Set([...terrainIds, ...npcIds, ...snapshotCombatNpcIds, ...legacyTerrainIds])],
    service,
    worldApi,
  );

  const voxeloo = await loadVoxeloo();
  log.warn("Seeding local dev starter town terrain", {
    contentPass: "harthmere-town-design-rebuild-v17-performance-bounded-terrain",
    performanceProfile: HARTHMERE_LOCAL_DEV_PERF_PROFILE_V3,
    terrainShardSpecs: terrainIds.length,
    harvestableTreeCenters: HARTHMERE_HARVESTABLE_TREE_CENTERS.length,
    harvestableOreClusters: HARTHMERE_HARVESTABLE_ORE_CENTERS.length,
    harvestableForageClusters: HARTHMERE_HARVESTABLE_FORAGE_CENTERS.length,
    fastHarvestableBlocks: HARTHMERE_FAST_HARVESTABLE_BLOCK_BY_COORD.size,
    x: [STARTER_TOWN_WILDS_X0 + harthmereExtraTownOffsetXV1(), STARTER_TOWN_WILDS_X1 + harthmereExtraTownOffsetXV1()],
    z: [STARTER_TOWN_WILDS_Z0 + harthmereExtraTownOffsetZV1(), STARTER_TOWN_WILDS_Z1 + harthmereExtraTownOffsetZV1()],
  });
  const tick = service ? service.table.tick + 1 : 1;
  const changes = makeLocalDevMiniWorldChanges(voxeloo, tick, existingIds);
  changes.push(...makeLocalDevStaleTerrainDeletesV3(tick, new Set(terrainIds), existingIds));

  if (service) {
    log.warn("Applying local dev starter town seed changes to shim table", {
      ...summarizeLocalDevSeedChanges(changes),
      ...firstAndLastLocalDevSeedIds(changes),
    });
    service.writeableTable.apply(changes);
  } else {
    const applied = await applyLocalDevSeedChangesInDebugBatches(
      worldApi,
      changes,
    );
    if (!applied) {
      return;
    }
  }

  const terrainUpdates = changes.filter(
    (change) =>
      (change.kind === "create" || change.kind === "update") &&
      change.entity.id >= LOCAL_DEV_TERRAIN_ID_BASE &&
      change.entity.id < LOCAL_DEV_TERRAIN_ID_LIMIT,
  );
  const npcUpdates = changes.filter(
    (change) =>
      (change.kind === "create" || change.kind === "update") &&
      change.entity.id >= LOCAL_DEV_NPC_ID_BASE &&
      change.entity.id < LOCAL_DEV_NPC_ID_LIMIT,
  );

  log.warn("Seeded local dev starter town", {
    contentPass: "harthmere-town-design-rebuild-v17-performance-bounded-terrain",
    performanceProfile: HARTHMERE_LOCAL_DEV_PERF_PROFILE_V3,
    terrainShards: terrainUpdates.length,
    npcs: npcUpdates.length,
    harvestableTreeCenters: HARTHMERE_HARVESTABLE_TREE_CENTERS.length,
    harvestableOreClusters: HARTHMERE_HARVESTABLE_ORE_CENTERS.length,
    harvestableForageClusters: HARTHMERE_HARVESTABLE_FORAGE_CENTERS.length,
    fastHarvestableBlocks: HARTHMERE_FAST_HARVESTABLE_BLOCK_BY_COORD.size,
    spawn: harthmereWorldPositionV1(STARTER_TOWN_SPAWN),
    groundY: STARTER_TOWN_GROUND_Y,
    x: [STARTER_TOWN_WILDS_X0 + harthmereExtraTownOffsetXV1(), STARTER_TOWN_WILDS_X1 + harthmereExtraTownOffsetXV1()],
    y: [32, 96],
    z: [STARTER_TOWN_WILDS_Z0 + harthmereExtraTownOffsetZV1(), STARTER_TOWN_WILDS_Z1 + harthmereExtraTownOffsetZV1()],
  });
}

export async function registerShimWorldApi<C extends ShimServerContext>(
  loader: RegistryLoader<C>,
) {
  const service = await loader.get("shimWorldService");
  if (service === undefined) {
    return registerWorldApi<C>({})(loader);
  }
  return ShimWorldApi.createForService(service);
}

export async function registerShimChatApi<C extends ShimServerContext>(
  loader: RegistryLoader<C>,
) {
  return new InMemoryChatApi(await loader.get("playerSpatialObserver"));
}
interface ShimServerContext extends SharedServerContext {
  bootstrap: Bootstrap;
  chatApi: ChatApi;
  config: ShimServerConfig;
  db: BDB;
  firehose: Firehose;
  notifierService: ShimNotifierService;
  pubsubService: ShimPubSubService;
  playerSpatialObserver: PlayerSpatialObserver;
  rpcServer: ZrpcServer;
  shimWorldService?: ShimWorldService;
  worldApi: WorldApi;
}

async function start({
  bikkieRefresher,
  bikkieStorage,
  bootstrap,
  chatApi,
  config,
  db,
  firehose,
  notifierService,
  pubsubService,
  playerSpatialObserver,
  rpcServer,
  shimWorldService,
  worldApi,
}: ShimServerContext) {
  // Bootstrap Bikkie for our clients.
  if (config.bootstrapMode !== "empty" && config.biscuitMode === "memory") {
    if (
      process.env.GLITCH_SKIP_PROD_TRAY === "1" ||
      process.env.GLITCH_DISABLE_GCP === "1" ||
      process.env.GLITCH_RUNTIME === "1" ||
      !!process.env.GLITCH_TITLE_ID
    ) {
      log.info("Skipping production tray definition load for Glitch/local runtime.");
    } else {
      await loadTrayDefinitionFromProd(bikkieStorage);
    }
    await bikkieStorage.save(await loadBakedTrayFromProd());
    // Force refresh of Bikkie in the Shim server itself.
    await bikkieRefresher.force();
  } else {
    // Set the fake Bikkie tray ID.
    notifierService.set("bikkie", String(BACKUP_BIKKIE_TRAY_ID));
    // Force refresh of Bikkie in the Shim server itself.
    await bikkieRefresher.force();
    // Force-set the names in the DB to match the active bikkie tray.
    await db
      .collection("bikkie")
      .doc("names")
      .set({
        idToName: encodeNames(getBiscuits().map((b) => [b.id, b.name])),
      });
  }

  // Start the player spatial observer, used for shim chat distribution.
  await playerSpatialObserver.start();

  // Bootstrap the world and chat.
  log.info("Bootstrapping shim world and chat...");
  const [changes, deliveries] = await bootstrap.load();
  if (chatApi instanceof InMemoryChatApi) {
    log.info(`Shim chat loaded ${deliveries.length}, ready to serve.`);
    chatApi.deliverAllForTest(deliveries);
  }
  if (shimWorldService) {
    shimWorldService.writeableTable.apply(changes);
    await seedLocalDevTerrainIfMissing(shimWorldService, worldApi);
    log.info(`Shim world loaded ${changes.length}, ready to serve.`);
    if (CONFIG.devResetAllPlayers) {
      log.info("Resetting all players...");
      for (const [
        _,
        [version, entity],
      ] of shimWorldService.table.deltaSince()) {
        if (!isPlayer(entity) || !entity.label?.text) {
          continue;
        }
        const delta = resetPlayerDelta(entity);
        // For shim, don't reset position or orientation.
        delta.position = undefined;
        delta.orientation = undefined;
        shimWorldService.writeableTable.apply([
          {
            kind: "update",
            tick: version.tick,
            entity: delta,
          },
        ]);
      }
    }
  }
  if (!shimWorldService) {
    await seedLocalDevTerrainIfMissing(undefined, worldApi);
  }

  // Expose all shim services.
  rpcServer.install(zShimNotifierService, notifierService);
  rpcServer.install(zServiceDiscoveryService, createShimServiceDiscovery());
  rpcServer.install(zShimPubSubService, pubsubService);
  rpcServer.install(
    zRemoteStorageService,
    new ExposeStorageService(db.backing),
  );
  rpcServer.install(
    zRemoteFirehoseService,
    new ExposeFirehoseService(firehose),
  );
  rpcServer.install(
    zShimBikkieStorageService,
    new ExposeBikkieStorageService(bikkieStorage),
  );
  rpcServer.install(zChatService, new ExposeChatService(chatApi));
  if (shimWorldService) {
    rpcServer.install(zWorldService, shimWorldService);
  }
  await rpcServer.start(HostPort.rpcPort);
}

void runServer(
  "shim",
  () =>
    new RegistryBuilder<ShimServerContext>()
      .install(sharedServerContext)
      .bind("bootstrap", registerBootstrap)
      .bind("config", registerShimServerConfig)
      .bind("db", registerBiomesStorage)
      .bind("worldApi", registerShimWorldApi)
      .bind(
        "firehose",
        async (loader) =>
          new InMemoryFirehose(loader.provide((context) => context.worldApi)),
      )
      .bind("rpcServer", () => registerRpcServer())
      .bind("shimWorldService", registerShimWorldService)
      .bind("notifierService", async () => new ShimNotifierService())
      .bind("pubsubService", async () => new ShimPubSubService())
      .bind("playerSpatialObserver", registerPlayerSpatialObserver)
      .bind("chatApi", registerShimChatApi)
      .build(),
  async (context) => {
    await start(context);
  },
);
