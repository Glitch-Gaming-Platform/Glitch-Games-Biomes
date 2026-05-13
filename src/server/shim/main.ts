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
import { baseServerArgumentConfig } from "@/server/shared/server_config";
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

export interface ShimServerConfig extends BaseServerConfig {
  bootstrapMode: BootstrapMode;
}

export async function registerShimServerConfig(): Promise<ShimServerConfig> {
  return parseArgs<ShimServerConfig>({
    ...baseServerArgumentConfig,
    bootstrapMode: {
      type: stringLiteralCtor("sync", "empty"),
      defaultValue: "sync",
    },
  });
}

async function registerShimWorldService(
  loader: RegistryLoader<ShimServerContext>
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
const STARTER_TOWN_SPAWN: Vec3 = [486, 54, -209];

const STARTER_TOWN_SAFE_X0 = 352;
const STARTER_TOWN_SAFE_X1 = 640;
const STARTER_TOWN_SAFE_Z0 = -320;
const STARTER_TOWN_SAFE_Z1 = -32;


function shouldSeedLocalDevTerrain() {
  return (
    process.env.NODE_ENV !== "production" &&
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
  pad = 0
) {
  return (
    inRange(worldX, x0 - pad, x1 + pad) &&
    inRange(worldZ, z0 - pad, z1 + pad)
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
      STARTER_TOWN_SAFE_Z1
    ) ||
    Math.hypot(worldX - STARTER_TOWN_SPAWN[0], worldZ - STARTER_TOWN_SPAWN[2]) <= 128
  );
}

function localDevTerrainHeight(worldX: number, worldZ: number) {
  // Keep the authored town flat and below every configured local/dev player
  // start. The previous patch could make the grass surface y=56..59 while new
  // players started at y=53..55, which put them inside/under the land.
  const townDx = worldX - STARTER_TOWN_SPAWN[0];
  const townDz = worldZ - STARTER_TOWN_SPAWN[2];
  const townDistance = Math.hypot(townDx, townDz);
  if (isStarterTownSafeFlatZone(worldX, worldZ)) {
    return STARTER_TOWN_GROUND_Y;
  }

  const outskirts = Math.max(0, 1 - (townDistance - 90) / 100);
  const wave = Math.sin(worldX / 14) * 1.25 + Math.cos(worldZ / 19) * 1.25;
  return Math.round(48 + outskirts * 3 + wave);
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
    sand: terrainId("sand", dirt),
    whiteWool: terrainId("white_wool", stone),
    yellowWool: terrainId("yellow_wool", dirt),
    redWool: terrainId("red_wool", dirt),
    blueWool: terrainId("blue_wool", stone),
    blackWool: terrainId("black_wool", stone),
    greenWool: terrainId("green_wool", grass),
    coal: terrainId("coal", stone),
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
  return inRect(worldX, worldZ, 432, 458, -246, -224) || inRect(worldX, worldZ, 438, 474, -122, -106);
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
  worldZ: number
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
  worldZ: number
): TerrainID | undefined {
  for (const building of starterBuildings(materials)) {
    const inside = inRect(worldX, worldZ, building.x0, building.x1, building.z0, building.z1);
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

    if (onOuterWall && inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + building.height - 1)) {
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
        worldY === STARTER_TOWN_GROUND_Y + 3 &&
        (worldX + worldZ) % 4 === 0;
      return windowBand ? materials.simpleGlass : building.wall;
    }

    if (
      inRect(worldX, worldZ, building.x0, building.x1, building.z0, building.z1, 1) &&
      worldY === STARTER_TOWN_GROUND_Y + building.height
    ) {
      return building.roof;
    }

    if (
      building.name === "Workshop" &&
      inRect(worldX, worldZ, building.x1 - 3, building.x1 - 2, building.z0 + 2, building.z0 + 3) &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + building.height + 1, STARTER_TOWN_GROUND_Y + building.height + 4)
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
  worldZ: number
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
    inside && (worldX === x0 || worldX === x1 || worldZ === z0 || worldZ === z1);
  if (inside && worldY === STARTER_TOWN_GROUND_Y) {
    return materials.stonePolished;
  }
  if (wall && inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 15)) {
    const door =
      worldZ === z1 &&
      Math.abs(worldX - Math.floor((x0 + x1) / 2)) <= 1 &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 3);
    if (door) {
      return undefined;
    }
    const window =
      [STARTER_TOWN_GROUND_Y + 6, STARTER_TOWN_GROUND_Y + 10, STARTER_TOWN_GROUND_Y + 14].includes(worldY) &&
      (worldX + worldZ) % 3 === 0;
    return window ? materials.simpleGlass : materials.stoneBrick;
  }
  if (inRect(worldX, worldZ, x0, x1, z0, z1, 1) && worldY === STARTER_TOWN_GROUND_Y + 16) {
    return materials.led;
  }
  return undefined;
}

function marketBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
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
    if (post && inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 4)) {
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
  worldZ: number
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
    if (dx === 0 && dz === 0 && inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 6)) {
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
  worldZ: number
): TerrainID | undefined {
  const dx = Math.abs(worldX - 486);
  const dz = Math.abs(worldZ + 190);
  if (dx <= 2 && dz <= 2) {
    if (worldY === STARTER_TOWN_GROUND_Y + 1 && (dx === 2 || dz === 2)) {
      return materials.cobblestone;
    }
    if ((dx === 2 && dz === 0) || (dx === 0 && dz === 2)) {
      if (inRange(worldY, STARTER_TOWN_GROUND_Y + 2, STARTER_TOWN_GROUND_Y + 4)) {
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
  y1 = y0
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
  worldZ: number
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
  if (blockRange(worldX, worldY, worldZ, 457, 457, -258, -254, 1) || blockRange(worldX, worldY, worldZ, 463, 463, -258, -254, 1)) {
    return materials.oakLumber; // chairs/benches.
  }
  if (blockRange(worldX, worldY, worldZ, 463, 464, -252, -250, 1, 3)) {
    return worldY === STARTER_TOWN_GROUND_Y + 1 ? materials.coal : materials.stoneBrick; // hearth/chimney base.
  }
  if (blockRange(worldX, worldY, worldZ, 450, 450, -256, -250, 1, 4)) {
    return (worldY + worldZ) % 2 === 0 ? materials.oakLumber : materials.yellowWool; // books/shelves.
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
    if (worldY === STARTER_TOWN_GROUND_Y + 2 && inRect(worldX, worldZ, 423, 425, -197, -195)) {
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
    return worldY === STARTER_TOWN_GROUND_Y + 3 ? materials.coal : materials.stoneBrick; // vault door wall.
  }
  if (blockRange(worldX, worldY, worldZ, 551, 555, -229, -226, 1, 2)) {
    return materials.woodCrate; // lockboxes.
  }
  if (blockRange(worldX, worldY, worldZ, 552, 556, -218, -216, 1)) {
    return materials.yellowWool; // coin table.
  }
  if (blockRange(worldX, worldY, worldZ, 550, 550, -222, -216, 1, 2) || blockRange(worldX, worldY, worldZ, 556, 556, -222, -216, 1, 2)) {
    return materials.oakLog; // queue rails.
  }
  if (blockRange(worldX, worldY, worldZ, 563, 566, -224, -220, 1)) {
    return materials.stoneBrick; // exterior vault sign/display.
  }

  // --- Black Anvil / Weapons Shop: weapons, forge, shield wall, armor display ---
  if (blockRange(worldX, worldY, worldZ, 522, 526, -236, -232, 1, 4)) {
    return worldY === STARTER_TOWN_GROUND_Y + 2 ? materials.coal : materials.stoneBrick; // forge.
  }
  if (blockRange(worldX, worldY, worldZ, 528, 531, -235, -233, 1)) {
    return materials.coal; // anvil.
  }
  if (blockRange(worldX, worldY, worldZ, 537, 538, -236, -222, 1, 4)) {
    return (worldY + worldZ) % 2 === 0 ? materials.oakLumber : materials.stoneBrick; // weapon racks.
  }
  if (blockRange(worldX, worldY, worldZ, 524, 527, -222, -221, 1)) {
    return materials.blueWool; // water trough.
  }
  if (blockRange(worldX, worldY, worldZ, 532, 535, -223, -221, 1, 3)) {
    return (worldX + worldY + worldZ) % 2 === 0 ? materials.redWool : materials.blackWool; // shield wall.
  }
  if (blockRange(worldX, worldY, worldZ, 540, 543, -231, -227, 1, 3)) {
    return worldY === STARTER_TOWN_GROUND_Y + 1 ? materials.oakLumber : materials.stoneBrick; // exterior armor stand / sign.
  }

  // --- Green Mortar Healing Shop: treatment bed, herb shelves, bottles, mortar ---
  if (blockRange(worldX, worldY, worldZ, 450, 454, -181, -179, 1)) {
    return worldZ === -179 ? materials.whiteWool : materials.greenWool;
  }
  if (blockRange(worldX, worldY, worldZ, 461, 462, -182, -170, 1, 4)) {
    return (worldY + worldZ) % 2 === 0 ? materials.greenWool : materials.yellowWool; // herb/potion shelves.
  }
  if (blockRange(worldX, worldY, worldZ, 455, 459, -172, -170, 1)) {
    return materials.stonePolished; // mortar table.
  }
  if (blockRange(worldX, worldY, worldZ, 451, 451, -174, -170, 1, 4)) {
    return materials.moss; // hanging herbs.
  }
  if (blockRange(worldX, worldY, worldZ, 464, 467, -180, -176, 1)) {
    return (worldX + worldZ) % 2 === 0 ? materials.greenWool : materials.whiteWool; // outside remedy display.
  }

  // --- Wyrm & Candle Magic Supply: books, scrolls, candles, crystal, locked room ---
  if (blockRange(worldX, worldY, worldZ, 508, 508, -173, -161, 1, 5)) {
    return (worldY + worldZ) % 2 === 0 ? materials.blueWool : materials.blackWool; // book wall.
  }
  if (blockRange(worldX, worldY, worldZ, 520, 522, -173, -161, 1, 5)) {
    return (worldY + worldZ) % 2 === 0 ? materials.blackWool : materials.whiteWool; // scroll shelves.
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
    [511, -172], [519, -172], [511, -162], [519, -162], [514, -165], [516, -169],
  ] as const;
  for (const [cx, cz] of candleSpots) {
    if (worldX === cx && worldZ === cz && worldY === STARTER_TOWN_GROUND_Y + 1) {
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
    return worldY === STARTER_TOWN_GROUND_Y + 1 ? materials.coal : materials.stoneBrick; // hearth.
  }
  const tavernTables = [
    [542, -198], [550, -198], [544, -190], [552, -190], [546, -184]
  ] as const;
  for (const [tx, tz] of tavernTables) {
    if (blockRange(worldX, worldY, worldZ, tx - 1, tx + 1, tz - 1, tz + 1, 1)) {
      return materials.oakLumber;
    }
    if (worldY === STARTER_TOWN_GROUND_Y + 1 && Math.abs(worldX - tx) + Math.abs(worldZ - tz) === 3) {
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
    return worldY === STARTER_TOWN_GROUND_Y + 7 ? materials.blackWool : materials.oakLog; // empty bell frame.
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
  if (worldY === STARTER_TOWN_GROUND_Y + 1 && inRange(worldX, 505, 518) && [-266, -262].includes(worldZ)) {
    return materials.oakLumber; // training rails.
  }
  if (blockRange(worldX, worldY, worldZ, 508, 508, -269, -269, 1, 4) || blockRange(worldX, worldY, worldZ, 516, 516, -269, -269, 1, 4)) {
    return materials.hay; // practice dummies.
  }
  if (blockRange(worldX, worldY, worldZ, 578, 584, -186, -178, 1, 2)) {
    return materials.woodCrate; // cargo stack.
  }
  if (worldY === STARTER_TOWN_GROUND_Y + 1 && inRange(worldX, 592, 604) && [-189, -177, -165].includes(worldZ)) {
    return materials.oakLumber; // dock tables.
  }
  if (blockRange(worldX, worldY, worldZ, 596, 599, -181, -179, 1, 3)) {
    return materials.blackWool; // suspicious crate.
  }
  if (worldY === STARTER_TOWN_GROUND_Y + 3 && inRange(worldX, 400, 430) && [-158, -150].includes(worldZ)) {
    return materials.whiteWool; // laundry lines.
  }
  if (blockRange(worldX, worldY, worldZ, 402, 407, -166, -164, 1)) {
    return materials.hay; // patched bedding.
  }
  if (blockRange(worldX, worldY, worldZ, 420, 426, -156, -154, 1)) {
    return materials.blueWool; // wash tubs.
  }
  if (worldY === STARTER_TOWN_GROUND_Y + 1 && inRect(worldX, worldZ, 431, 459, -247, -223) && (worldX === 431 || worldX === 459 || worldZ === -247 || worldZ === -223)) {
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
    return worldY === STARTER_TOWN_GROUND_Y + 5 ? materials.yellowWool : materials.oakLog;
  }

  return undefined;
}

function starterTownInteriorAndStoryBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  // --- New-player signpost and Market Board / quest hub ---
  // These are deliberately block-built so they never 404 on missing sign or UI assets.
  if (blockRange(worldX, worldY, worldZ, 482, 490, -268, -268, 1, 4)) {
    return worldX === 486 && worldY === STARTER_TOWN_GROUND_Y + 4
      ? materials.yellowWool
      : materials.oakLumber;
  }
  if (blockRange(worldX, worldY, worldZ, 500, 506, -211, -211, 1, 5)) {
    if ((worldX === 500 || worldX === 506) && inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 5)) {
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
    if (worldX === sx && worldZ === sz && inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 2)) {
      return materials.oakLog;
    }
    if (Math.abs(worldX - sx) <= 1 && worldZ === sz && worldY === STARTER_TOWN_GROUND_Y + 3) {
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
    return worldY === STARTER_TOWN_GROUND_Y + 1 ? materials.coal : materials.stoneBrick; // hearth.
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
    return worldY === STARTER_TOWN_GROUND_Y + 2 && inRect(worldX, worldZ, 423, 424, -197, -196)
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
    return worldY === STARTER_TOWN_GROUND_Y + 3 ? materials.coal : materials.stoneBrick; // vault door / wall.
  }
  if (blockRange(worldX, worldY, worldZ, 551, 555, -229, -226, 1)) {
    return materials.woodCrate; // lockboxes.
  }
  if (blockRange(worldX, worldY, worldZ, 552, 556, -218, -216, 1)) {
    return materials.yellowWool; // coin ledger table.
  }

  // --- Black Anvil / Weapons Shop ---
  if (blockRange(worldX, worldY, worldZ, 522, 525, -236, -233, 1, 3)) {
    return worldY === STARTER_TOWN_GROUND_Y + 2 ? materials.coal : materials.stoneBrick; // forge.
  }
  if (blockRange(worldX, worldY, worldZ, 528, 531, -235, -233, 1)) {
    return materials.coal; // anvil.
  }
  if (blockRange(worldX, worldY, worldZ, 537, 538, -236, -222, 1, 3)) {
    return (worldY + worldZ) % 2 === 0 ? materials.oakLumber : materials.stoneBrick; // weapon racks.
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
    return (worldY + worldZ) % 2 === 0 ? materials.greenWool : materials.yellowWool; // herb/potion shelves.
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
  if (worldY === STARTER_TOWN_GROUND_Y + 1 && Math.abs(worldX - 515) + Math.abs(worldZ + 167) === 4) {
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
    return worldY === STARTER_TOWN_GROUND_Y + 2 ? materials.coal : materials.stoneBrick; // hearth.
  }
  const tavernTables = [
    [543, -199], [551, -199], [543, -190], [551, -190], [547, -185],
  ] as const;
  for (const [tx, tz] of tavernTables) {
    if (blockRange(worldX, worldY, worldZ, tx - 1, tx + 1, tz - 1, tz + 1, 1)) {
      return worldX === tx && worldZ === tz ? materials.oakLumber : materials.hay;
    }
  }
  if (blockRange(worldX, worldY, worldZ, 537, 538, -183, -181, 1, 3)) {
    return materials.yellowWool; // drink/food shelves.
  }

  // --- Chapel, grave story, and missing bell clue ---
  if (blockRange(worldX, worldY, worldZ, 474, 480, -132, -130, 1, 2)) {
    return materials.whiteWool; // altar.
  }
  if (worldY === STARTER_TOWN_GROUND_Y + 1 && inRange(worldX, 466, 488) && [-142, -138, -134].includes(worldZ)) {
    return materials.oakLumber; // pew rows.
  }
  if (worldY === STARTER_TOWN_GROUND_Y + 1 && inRect(worldX, worldZ, 468, 486, -148, -148) && worldX % 3 === 0) {
    return materials.yellowWool; // chapel candles.
  }
  if (blockRange(worldX, worldY, worldZ, 477, 481, -150, -150, 2, 5)) {
    return worldY === STARTER_TOWN_GROUND_Y + 5 ? materials.blackWool : materials.oakLog; // empty bell frame.
  }

  // --- Guard yard and Reeve Hall ---
  if (worldY === STARTER_TOWN_GROUND_Y + 1 && inRange(worldX, 505, 518) && [-266, -262].includes(worldZ)) {
    return materials.oakLumber; // training rails.
  }
  if (blockRange(worldX, worldY, worldZ, 508, 508, -269, -269, 1, 3) || blockRange(worldX, worldY, worldZ, 516, 516, -269, -269, 1, 3)) {
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
  if (worldY === STARTER_TOWN_GROUND_Y + 1 && inRange(worldX, 592, 604) && [-189, -177, -165].includes(worldZ)) {
    return materials.oakLumber; // dock benches / fish tables.
  }
  if (blockRange(worldX, worldY, worldZ, 596, 598, -181, -179, 1, 2)) {
    return materials.blackWool; // suspicious whispering crate.
  }
  if (worldY === STARTER_TOWN_GROUND_Y + 3 && inRange(worldX, 400, 430) && [-158, -150].includes(worldZ)) {
    return materials.whiteWool; // laundry lines.
  }
  if (blockRange(worldX, worldY, worldZ, 402, 406, -166, -164, 1)) {
    return materials.hay; // patched bed / poor-home detail.
  }
  if (blockRange(worldX, worldY, worldZ, 420, 426, -156, -154, 1)) {
    return materials.blueWool; // wash tubs / water detail.
  }

  // --- Farm and orchard details ---
  if (worldY === STARTER_TOWN_GROUND_Y + 1 && inRect(worldX, worldZ, 431, 459, -247, -223) && (worldX === 431 || worldX === 459 || worldZ === -247 || worldZ === -223)) {
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


// HARTHMERE_FULL_TOWN_REBUILD_V5_START

type HarthmereV5Mat = keyof ReturnType<typeof localDevMaterials>;
type HarthmereV5DoorSide = "north" | "south" | "east" | "west";

type HarthmereV5Building = {
  name: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  wall: HarthmereV5Mat;
  roof: HarthmereV5Mat;
  floor: HarthmereV5Mat;
  trim?: HarthmereV5Mat;
  doorSide: HarthmereV5DoorSide;
  doorCenter: number;
  secondStory?: boolean;
};

const HARTHMERE_V5_BUILDINGS: HarthmereV5Building[] = [
  {
    name: "player_house",
    x0: 448,
    x1: 466,
    z0: -266,
    z1: -246,
    wall: "oakLumber",
    roof: "blueWool",
    floor: "oakLumber",
    trim: "whiteWool",
    doorSide: "south",
    doorCenter: 457,
    secondStory: true,
  },
  {
    name: "dawn_loaf_bakery",
    x0: 418,
    x1: 442,
    z0: -202,
    z1: -184,
    wall: "oakLumber",
    roof: "yellowWool",
    floor: "stoneBrick",
    trim: "hay",
    doorSide: "east",
    doorCenter: -193,
  },
  {
    name: "black_anvil_smithy",
    x0: 520,
    x1: 542,
    z0: -240,
    z1: -220,
    wall: "stoneBrick",
    roof: "blackWool",
    floor: "stonePolished",
    trim: "coal",
    doorSide: "west",
    doorCenter: -230,
  },
  {
    name: "brass_scale_bank",
    x0: 546,
    x1: 566,
    z0: -234,
    z1: -214,
    wall: "stonePolished",
    roof: "greenWool",
    floor: "stoneBrick",
    trim: "yellowWool",
    doorSide: "west",
    doorCenter: -224,
  },
  {
    name: "green_mortar_apothecary",
    x0: 448,
    x1: 466,
    z0: -184,
    z1: -168,
    wall: "oakLumber",
    roof: "greenWool",
    floor: "stoneBrick",
    trim: "whiteWool",
    doorSide: "east",
    doorCenter: -176,
  },
  {
    name: "wyrm_and_candle_magic_shop",
    x0: 508,
    x1: 528,
    z0: -178,
    z1: -158,
    wall: "stoneBrick",
    roof: "blueWool",
    floor: "stonePolished",
    trim: "yellowWool",
    doorSide: "west",
    doorCenter: -168,
  },
  {
    name: "copper_kettle_inn",
    x0: 532,
    x1: 566,
    z0: -208,
    z1: -180,
    wall: "oakLumber",
    roof: "redWool",
    floor: "oakLumber",
    trim: "yellowWool",
    doorSide: "west",
    doorCenter: -194,
    secondStory: true,
  },
  {
    name: "saint_verena_chapel",
    x0: 466,
    x1: 492,
    z0: -150,
    z1: -128,
    wall: "stonePolished",
    roof: "blueWool",
    floor: "stoneBrick",
    trim: "whiteWool",
    doorSide: "south",
    doorCenter: 479,
  },
  {
    name: "reeve_hall",
    x0: 550,
    x1: 580,
    z0: -270,
    z1: -250,
    wall: "stonePolished",
    roof: "redWool",
    floor: "stoneBrick",
    trim: "greenWool",
    doorSide: "south",
    doorCenter: 565,
    secondStory: true,
  },
  {
    name: "river_dock_supply",
    x0: 578,
    x1: 602,
    z0: -194,
    z1: -174,
    wall: "oakLumber",
    roof: "blackWool",
    floor: "oakLumber",
    trim: "blueWool",
    doorSide: "east",
    doorCenter: -184,
  },
  {
    name: "mudden_ward_shelter",
    x0: 398,
    x1: 428,
    z0: -170,
    z1: -148,
    wall: "dirt",
    roof: "blackWool",
    floor: "oakLumber",
    trim: "hay",
    doorSide: "east",
    doorCenter: -158,
  },
];

function harthmereV5Mat(
  materials: ReturnType<typeof localDevMaterials>,
  key: HarthmereV5Mat
): TerrainID {
  return materials[key] as TerrainID;
}

function harthmereV5IsDoor(
  building: HarthmereV5Building,
  worldX: number,
  worldZ: number,
  relY: number
) {
  if (relY < 1 || relY > 3) {
    return false;
  }

  if (building.doorSide === "south") {
    return worldZ === building.z0 && Math.abs(worldX - building.doorCenter) <= 1;
  }

  if (building.doorSide === "north") {
    return worldZ === building.z1 && Math.abs(worldX - building.doorCenter) <= 1;
  }

  if (building.doorSide === "west") {
    return worldX === building.x0 && Math.abs(worldZ - building.doorCenter) <= 1;
  }

  return worldX === building.x1 && Math.abs(worldZ - building.doorCenter) <= 1;
}

function harthmereV5SurfaceMaterial(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldZ: number
): TerrainID | undefined {
  const dx = worldX - 486;
  const dz = worldZ + 209;
  const marketDistance = Math.hypot(dx, dz);

  // Market Square: wide, readable, player-social center.
  if (marketDistance <= 25) {
    return marketDistance <= 8 ? materials.stonePolished : materials.stoneBrick;
  }

  // North Gate -> Market -> Temple/Old Well breadcrumb road.
  if (inRange(worldX, 480, 492) && inRange(worldZ, -292, -126)) {
    return materials.stoneBrick;
  }

  // Main east/west trade road through services, smithy, bank, market, bakery.
  if (inRange(worldZ, -216, -204) && inRange(worldX, 410, 572)) {
    return materials.stoneBrick;
  }

  // South-west player house / farm road.
  if (inRange(worldX, 444, 468) && inRange(worldZ, -270, -220)) {
    return materials.stoneBrick;
  }

  // Craftsman Row / Reeve Hall / Guard Yard road.
  if (inRange(worldX, 500, 576) && inRange(worldZ, -276, -244)) {
    return materials.stoneBrick;
  }

  // Inn, bank, dock road.
  if (inRange(worldX, 532, 612) && inRange(worldZ, -204, -176)) {
    return materials.stoneBrick;
  }

  // Apothecary / magic / chapel road.
  if (inRange(worldX, 446, 530) && inRange(worldZ, -184, -154)) {
    return materials.stoneBrick;
  }

  // Mudden Ward road.
  if (inRange(worldX, 396, 434) && inRange(worldZ, -172, -148)) {
    return materials.dirt;
  }

  // Farm and orchard dirt lanes.
  if (inRange(worldX, 430, 466) && inRange(worldZ, -250, -220)) {
    return materials.dirt;
  }

  if (inRange(worldX, 420, 470) && inRange(worldZ, -126, -100)) {
    return materials.dirt;
  }

  // River / dock edge identity.
  if (inRange(worldX, 604, 628) && inRange(worldZ, -204, -150)) {
    return materials.water;
  }

  return undefined;
}

function harthmereV5BuildingBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  building: HarthmereV5Building,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  if (!inRect(worldX, worldZ, building.x0 - 1, building.x1 + 1, building.z0 - 1, building.z1 + 1)) {
    return undefined;
  }

  const relY = worldY - STARTER_TOWN_GROUND_Y;
  const inside = inRect(worldX, worldZ, building.x0, building.x1, building.z0, building.z1);
  const perimeter =
    inside &&
    (worldX === building.x0 ||
      worldX === building.x1 ||
      worldZ === building.z0 ||
      worldZ === building.z1);

  // Safe real floor, not dense furniture.
  if (relY === 0 && inside) {
    return harthmereV5Mat(materials, building.floor);
  }

  // Walls with 3-block clear doors.
  if (relY >= 1 && relY <= 4 && perimeter) {
    if (harthmereV5IsDoor(building, worldX, worldZ, relY)) {
      return undefined;
    }

    const corner =
      (worldX === building.x0 || worldX === building.x1) &&
      (worldZ === building.z0 || worldZ === building.z1);

    if (corner && building.trim) {
      return harthmereV5Mat(materials, building.trim);
    }

    return harthmereV5Mat(materials, building.wall);
  }

  // Roof slab, slightly overhanging.
  if (relY === 5 && inRect(worldX, worldZ, building.x0 - 1, building.x1 + 1, building.z0 - 1, building.z1 + 1)) {
    return harthmereV5Mat(materials, building.roof);
  }

  // Second-story silhouette without stuffing collision into the walkable interior.
  if (building.secondStory && relY >= 6 && relY <= 9) {
    const upperX0 = building.x0 + 3;
    const upperX1 = building.x1 - 3;
    const upperZ0 = building.z0 + 3;
    const upperZ1 = building.z1 - 3;
    const upperInside = inRect(worldX, worldZ, upperX0, upperX1, upperZ0, upperZ1);
    const upperPerimeter =
      upperInside &&
      (worldX === upperX0 || worldX === upperX1 || worldZ === upperZ0 || worldZ === upperZ1);

    if (relY >= 6 && relY <= 8 && upperPerimeter) {
      return harthmereV5Mat(materials, building.wall);
    }

    if (relY === 9 && inRect(worldX, worldZ, upperX0 - 1, upperX1 + 1, upperZ0 - 1, upperZ1 + 1)) {
      return harthmereV5Mat(materials, building.roof);
    }
  }

  return undefined;
}

function harthmereV5FenceBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  if (relY !== 1 && relY !== 2) {
    return undefined;
  }

  // Farm / chicken yard fence. Clear gate at market-side road.
  if (inRect(worldX, worldZ, 430, 462, -250, -220)) {
    const edge = worldX === 430 || worldX === 462 || worldZ === -250 || worldZ === -220;
    const gate = worldX >= 443 && worldX <= 449 && worldZ === -220;
    if (edge && !gate) {
      return materials.oakLog;
    }
  }

  // Guard Yard sparring boundary, clear front gate.
  if (inRect(worldX, worldZ, 500, 522, -276, -256)) {
    const edge = worldX === 500 || worldX === 522 || worldZ === -276 || worldZ === -256;
    const gate = worldX >= 510 && worldX <= 514 && worldZ === -256;
    if (edge && !gate) {
      return materials.oakLog;
    }
  }

  // Mudden Ward drain / Underways locked entrance.
  if (inRect(worldX, worldZ, 394, 402, -240, -232)) {
    const bars = worldX === 402 && inRange(worldZ, -238, -234);
    if (bars) {
      return relY === 1 ? materials.blackWool : materials.coal;
    }
  }

  return undefined;
}

function harthmereV5LandmarkBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;

  // Market fountain: visible social landmark, leaves wide plaza open.
  if (inRect(worldX, worldZ, 482, 490, -213, -205)) {
    const d = Math.hypot(worldX - 486, worldZ + 209);
    if (relY === 1 && d <= 4.5) {
      return d <= 2 ? materials.water : materials.stonePolished;
    }
    if (relY === 2 && d <= 1.5) {
      return materials.water;
    }
  }

  // Market board + starter objective marker.
  if (inRect(worldX, worldZ, 500, 506, -211, -211)) {
    if (relY >= 1 && relY <= 5) {
      if ((worldX === 500 || worldX === 506) && relY <= 5) {
        return materials.oakLog;
      }
      if (relY === 5 && worldX === 503) {
        return materials.yellowWool;
      }
      return relY === 4 ? materials.blackWool : materials.oakLumber;
    }
  }

  // North Gate marker.
  if (inRect(worldX, worldZ, 478, 494, -292, -284)) {
    const wall = worldZ === -292 || worldZ === -284 || worldX === 478 || worldX === 494;
    const gateGap = inRange(worldX, 483, 489) && worldZ === -284;
    if (wall && !gateGap && relY >= 1 && relY <= 7) {
      return relY === 7 ? materials.redWool : materials.stoneBrick;
    }
  }

  // Large spawn signpost pointing to board.
  if (worldX === 486 && worldZ === -268 && relY >= 1 && relY <= 4) {
    return relY === 4 ? materials.yellowWool : materials.oakLog;
  }
  if (inRange(worldX, 482, 490) && worldZ === -268 && relY === 3) {
    return materials.oakLumber;
  }

  // Old Well / Missing Bell story landmark.
  if (inRect(worldX, worldZ, 481, 491, -192, -182)) {
    const d = Math.hypot(worldX - 486, worldZ + 187);
    if (relY === 1 && d <= 5) {
      return d <= 2 ? materials.blackWool : materials.stoneBrick;
    }
    if (relY === 2 && d <= 3 && d >= 2) {
      return materials.oakLog;
    }
  }

  // Chapel graveyard markers, kept outside main path.
  if (relY >= 1 && relY <= 3 && inRange(worldX, 500, 528) && inRange(worldZ, -150, -126)) {
    if ((worldX + worldZ) % 7 === 0) {
      return relY === 3 ? materials.whiteWool : materials.stonePolished;
    }
  }

  // Farm: hay, trough, scarecrow.
  if (inRect(worldX, worldZ, 435, 442, -224, -222) && relY >= 1 && relY <= 2) {
    return materials.hay;
  }
  if (inRect(worldX, worldZ, 455, 458, -246, -242) && relY === 1) {
    return materials.water;
  }
  if (worldX === 444 && worldZ === -242 && relY >= 1 && relY <= 5) {
    return relY === 5 ? materials.yellowWool : materials.oakLog;
  }
  if (inRange(worldX, 442, 446) && worldZ === -242 && relY === 4) {
    return materials.hay;
  }

  // Docks: safe wooden piers into water.
  if (relY === 1 && inRange(worldX, 588, 616) && [-190, -178, -166].includes(worldZ)) {
    return materials.oakLumber;
  }
  if (relY === 1 && inRange(worldZ, -190, -166) && [588, 600, 612].includes(worldX)) {
    return materials.oakLumber;
  }

  // Reeve Hall / Noble Rise visual banners.
  if (relY >= 1 && relY <= 4 && inRange(worldX, 554, 576) && worldZ === -249 && worldX % 4 === 0) {
    return relY === 4 ? materials.redWool : materials.oakLog;
  }

  // Direction signs around market ring.
  const signs = [
    [492, -205, "redWool"],
    [494, -216, "blueWool"],
    [478, -205, "greenWool"],
    [480, -216, "yellowWool"],
    [486, -224, "redWool"],
    [486, -195, "blueWool"],
    [474, -211, "yellowWool"],
    [503, -221, "greenWool"],
  ] as const;

  for (const [sx, sz, mat] of signs) {
    if (worldX === sx && worldZ === sz && relY >= 1 && relY <= 2) {
      return materials.oakLog;
    }
    if (Math.abs(worldX - sx) <= 1 && worldZ === sz && relY === 3) {
      return harthmereV5Mat(materials, mat as HarthmereV5Mat);
    }
  }

  return undefined;
}

function harthmereV5FullTownBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  // Real collision only for buildings, roads, fences, and landmarks.
  // Dense interiors stay visual-only in the client asset layer.
  for (const building of HARTHMERE_V5_BUILDINGS) {
    const block = harthmereV5BuildingBlockAt(materials, building, worldX, worldY, worldZ);
    if (block !== undefined) {
      return block;
    }
  }

  return (
    harthmereV5FenceBlockAt(materials, worldX, worldY, worldZ) ??
    harthmereV5LandmarkBlockAt(materials, worldX, worldY, worldZ)
  );
}

// HARTHMERE_FULL_TOWN_REBUILD_V5_END


function starterTownSurfaceMaterial(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldZ: number,
  current: TerrainID
): TerrainID {
  const harthmereV5Surface = harthmereV5SurfaceMaterial(materials, worldX, worldZ);
  if (harthmereV5Surface !== undefined) {
    return harthmereV5Surface;
  }

  if (isStarterTownPlaza(worldX, worldZ)) {
    return materials.stonePolished;
  }
  if (isStarterTownRoad(worldX, worldZ)) {
    return materials.gravel;
  }
  if (isStarterTownFarm(worldX, worldZ)) {
    return materials.soil;
  }
  return current;
}

function chickenBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
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
    if (worldY === STARTER_TOWN_GROUND_Y + 2 && Math.abs(dx) === 1 && dz === -1) {
      return materials.coal;
    }
  }
  return undefined;
}

function townWallBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
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
  if (onWall && !northGateGap && !bridgeGateGap && inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 6)) {
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
    const edge = inside && (worldX === tx0 || worldX === tx1 || worldZ === tz0 || worldZ === tz1);
    if (inside && worldY === STARTER_TOWN_GROUND_Y) {
      return materials.stonePolished;
    }
    if (edge && inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 10)) {
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
  worldZ: number
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
    (worldZ === -190 || worldZ === -184 || worldZ === -178 || worldZ === -172 || worldZ === -166 || worldZ === -160);
  if (dockPost && inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 3)) {
    return materials.oakLog;
  }
  if (worldY === STARTER_TOWN_GROUND_Y + 1 && inRect(worldX, worldZ, 594, 600, -188, -162) && (worldX + worldZ) % 7 === 0) {
    return materials.woodCrate;
  }
  return undefined;
}

function graveyardBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const stones = [
    [504, -144], [510, -140], [516, -146], [522, -138], [528, -148],
    [508, -130], [520, -128], [532, -134],
  ] as const;
  for (const [sx, sz] of stones) {
    if (worldX === sx && worldZ === sz && inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 3)) {
      return materials.stoneBrick;
    }
    if (worldY === STARTER_TOWN_GROUND_Y + 3 && worldZ === sz && Math.abs(worldX - sx) <= 1) {
      return materials.stoneBrick;
    }
  }
  return undefined;
}

function drainTunnelBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
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
  if (worldY === STARTER_TOWN_GROUND_Y && inRect(worldX, worldZ, 398, 402, -236, -234)) {
    return materials.cobblestone;
  }
  return undefined;
}

function appleOrchardBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const trees = [
    [448, -112], [460, -114], [472, -116], [446, -100], [458, -98], [470, -102],
  ] as const;
  for (const [tx, tz] of trees) {
    const dx = Math.abs(worldX - tx);
    const dz = Math.abs(worldZ - tz);
    if (dx === 0 && dz === 0 && inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 5)) {
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
  worldZ: number
): TerrainID | undefined {
  const harthmereV5Block = harthmereV5FullTownBlockAt(materials, worldX, worldY, worldZ);
  if (harthmereV5Block !== undefined) {
    return harthmereV5Block;
  }

  return (
    townWallBlockAt(materials, worldX, worldY, worldZ) ??
    bridgeDockBlockAt(materials, worldX, worldY, worldZ) ??
    towerBlockAt(materials, worldX, worldY, worldZ) ??
    buildingBlockAt(materials, worldX, worldY, worldZ) ??
    marketBlockAt(materials, worldX, worldY, worldZ) ??
    graveyardBlockAt(materials, worldX, worldY, worldZ) ??
    drainTunnelBlockAt(materials, worldX, worldY, worldZ) ??
    wellBlockAt(materials, worldX, worldY, worldZ) ??
    treeBlockAt(materials, worldX, worldY, worldZ) ??
    appleOrchardBlockAt(materials, worldX, worldY, worldZ) ??
    chickenBlockAt(materials, worldX, worldY, worldZ) ??
    starterTownDenseInteriorBlockAt(materials, worldX, worldY, worldZ) ??
    starterTownInteriorAndStoryBlockAt(materials, worldX, worldY, worldZ) ??
    starterTownDecorBlockAt(materials, worldX, worldY, worldZ)
  );
}

function starterTownDecorBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
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

  // 224m x 224m starter area, two vertical shard layers. The second y layer is
  // needed for the lighthouse/watchtower and rooflines.
  for (let shardY = 1; shardY <= 2; shardY += 1) {
    for (let shardX = 11; shardX <= 19; shardX += 1) {
      for (let shardZ = -10; shardZ <= -2; shardZ += 1) {
        specs.push({
          id: (LOCAL_DEV_TERRAIN_ID_BASE + idOffset++) as BiomesId,
          shardX,
          shardY,
          shardZ,
        });
      }
    }
  }
  return specs;
}

function makeLocalDevTerrainShard(
  voxeloo: VoxelooModule,
  kind: "create" | "update",
  id: BiomesId,
  shardX: number,
  shardY: number,
  shardZ: number,
  tick: number
): Change {
  const v0 = shardToVoxelPos(shardX, shardY, shardZ);
  const v1 = [v0[0] + SHARD_DIM, v0[1] + SHARD_DIM, v0[2] + SHARD_DIM] as [
    number,
    number,
    number,
  ];

  const materials = localDevMaterials();

  const buffer = using(new voxeloo.VolumeBlock_U32(), (seedBlock) => {
    for (let z = 0; z < SHARD_DIM; z += 1) {
      for (let x = 0; x < SHARD_DIM; x += 1) {
        const worldX = v0[0] + x;
        const worldZ = v0[2] + z;
        const topY = localDevTerrainHeight(worldX, worldZ);
        for (let y = 0; y < SHARD_DIM; y += 1) {
          const worldY = v0[1] + y;
          const authoredBlock = starterTownAboveGroundBlockAt(
            materials,
            worldX,
            worldY,
            worldZ
          );
          if (authoredBlock) {
            seedBlock.set(x, y, z, authoredBlock);
            continue;
          }

          if (worldY > topY) {
            continue;
          }
          const depth = topY - worldY;
          const base = depth === 0 ? materials.grass : depth > 6 ? materials.stone : materials.dirt;
          seedBlock.set(
            x,
            y,
            z,
            depth === 0
              ? starterTownSurfaceMaterial(materials, worldX, worldZ, base)
              : base
          );
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

  return kind === "create"
    ? { kind, tick, entity }
    : { kind, tick, entity };
}

function resolveNpcTypeId(
  preferredNames: string[],
  fallbackIds: BiomesId[] = []
): BiomesId | undefined {
  const preferred = getBiscuits("/npcs/types").find((biscuit) =>
    preferredNames.includes(biscuit.name)
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
};

function starterNpc(
  offset: number,
  displayName: string,
  position: Vec3,
  orientation: Vec2,
  dialog: string,
  description = "A local-dev Harthmere resident.",
  velocity?: Vec3
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
  };
}

function npcDialog(...lines: string[]) {
  return lines.map((line) => `<text>${line}</text>`).join("{break}");
}

function starterTownNpcs(): StarterNpc[] {
  // NPC anchors render better one block higher than the raw terrain surface in this sparse local-dev mesh set.
  const y = STARTER_TOWN_GROUND_Y + 2;
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
      "The guide for the local-dev starter town."
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
      "A robot archivist explaining the local-dev setup."
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
      "The builder standing by the workshop."
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
      "A friendly town mascot near the market stalls."
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
      "The bakery owner."
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
      "A cheerless bank teller and storage steward."
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
      "The weapons shopkeeper."
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
      "The healing shop NPC."
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
      "The magic shop supplier."
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
      "The farmer watching the chicken yard."
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
      "The tavern bartender."
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
      "A tavern patron and dock worker."
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
      "A tavern patron with local lore."
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
      "A tavern card player."
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
      "A tavern traveler."
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
      "A bard in the tavern."
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
      [0.35, 0, 0]
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
      [0, 0, 0.35]
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
      [0, 0, -0.35]
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
      [-0.35, 0, 0]
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
      [0.25, 0, 0.25]
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
      [-0.25, 0, -0.25]
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
      [0.2, 0, 0.3]
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
      [-0.2, 0, -0.3]
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
      [0.3, 0, -0.2]
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
      [-0.3, 0, 0.2]
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
      "A stern north-gate guard who knows every regular traveler."
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
      "A market vendor with a perfect memory for gossip."
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
      "The blacksmith of Craftsman Row."
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
      "The tavern keeper, warm until crossed."
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
      "The priest of Saint Verena's chapel."
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
      "The polished, calculating ruler of Harthmere."
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
      "A sharp Mudden Ward rat-catcher and guide."
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
      "The dockmaster with flexible morals."
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
      "A merchant selling cloth and rumors."
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
      "A moneylender watching the bank door."
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
      "A farmer from the apple fields."
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
      "The quiet keeper of the chapel graveyard."
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
      "A nervous toll clerk beneath the north gate."
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
      "A suspicious figure near the old drain tunnel."
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
      "A quest board covered in notices, arrows, and beginner work."
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
      "A loud town crier standing beside the Market Board."
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
      "The courier for mail and delivery work."
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
      "A guard trainer in the yard."
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
      "The clerk for bounties and patrol work."
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
      "A chapel healer and charity organizer."
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
      "The apothecary of the Green Mortar."
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
      "A carpenter in Craftsman Row."
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
      "A leatherworker."
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
      "A tailor and banner maker."
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
      "The ferry master at the docks."
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
      "A child from Mudden Ward."
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
      "A Mudden Ward washerwoman."
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
      "A clerk in Reeve Hall."
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
      "A servant in Noble Rise."
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
      "The Guard Yard quartermaster."
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
      "A traveling market merchant."
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
      "A market food vendor."
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
      "The guild registrar in the services area."
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
      "The auction and trade clerk."
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
      "A Mudden Ward rat-catcher."
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
      "An old witness near the well."
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
      "An apple picker in the orchard."
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
      "A stablehand near the south-west road."
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
      "A suspicious dock lookout."
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
      "A child in the chapel choir."
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
      "A blacksmith apprentice."
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
      "A bakery apprentice."
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
      "A guard assigned to the market."
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
      "A strange whisper near the sealed underways entrance."
    ),
  ];
}

function isLocalDevQuestGiverNpcId(id: BiomesId) {
  const offset = Number(id) - Number(LOCAL_DEV_NPC_ID_BASE);
  return new Set([
    1, 5, 6, 7, 8, 9, 10, 11, 27, 28, 29, 30, 31, 33, 34, 41, 42, 44, 46, 47, 62, 70,
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
          position: npc.position,
          orientation: npc.orientation,
          velocity: npc.velocity,
          displayName: npc.displayName,
          defaultDialog: npc.dialog,
        },
        now
      ),
      entity_description: EntityDescription.create({
        text: npc.description,
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

function makeLocalDevMiniWorldChanges(
  voxeloo: VoxelooModule,
  tick: number,
  existingIds: Set<BiomesId>
) {
  const changes: Change[] = [];

  for (const spec of localDevTerrainShardSpecs()) {
    changes.push(
      makeLocalDevTerrainShard(
        voxeloo,
        existingIds.has(spec.id) ? "update" : "create",
        spec.id,
        spec.shardX,
        spec.shardY,
        spec.shardZ,
        tick
      )
    );
  }

  changes.push(...makeLocalDevNpcChanges(tick, existingIds));
  return changes;
}

async function existingLocalDevIds(
  ids: BiomesId[],
  service: ShimWorldService | undefined,
  worldApi: WorldApi
) {
  if (service) {
    return new Set(ids.filter((id) => service.table.get(id) !== undefined));
  }
  return new Set((await worldApi.has(ids)) as BiomesId[]);
}

async function seedLocalDevTerrainIfMissing(
  service: ShimWorldService | undefined,
  worldApi: WorldApi
) {
  if (!shouldSeedLocalDevTerrain()) {
    return;
  }

  if (
    service &&
    hasNonLocalTerrainShard(service) &&
    process.env.BIOMES_FORCE_LOCAL_DEV_TOWN !== "1"
  ) {
    log.info("Skipping local dev starter town because non-local terrain already exists.");
    return;
  }

  const terrainIds = localDevTerrainShardSpecs().map((spec) => spec.id);
  const npcIds = starterTownNpcs().map((npc) => npc.id);
  const existingIds = await existingLocalDevIds(
    [...terrainIds, ...npcIds],
    service,
    worldApi
  );

  const voxeloo = await loadVoxeloo();
  const tick = service ? service.table.tick + 1 : 1;
  const changes = makeLocalDevMiniWorldChanges(voxeloo, tick, existingIds);

  if (service) {
    service.writeableTable.apply(changes);
  } else {
    const applied = await worldApi.apply({
      changes: changes.map(toProposedChange),
    });
    if (applied.outcome !== "success") {
      log.warn("Local dev starter town transaction did not apply", {
        outcome: applied.outcome,
      });
      return;
    }
  }

  const terrainUpdates = changes.filter(
    (change) =>
      (change.kind === "create" || change.kind === "update") &&
      change.entity.id >= LOCAL_DEV_TERRAIN_ID_BASE &&
      change.entity.id < LOCAL_DEV_TERRAIN_ID_LIMIT
  );
  const npcUpdates = changes.filter(
    (change) =>
      (change.kind === "create" || change.kind === "update") &&
      change.entity.id >= LOCAL_DEV_NPC_ID_BASE &&
      change.entity.id < LOCAL_DEV_NPC_ID_LIMIT
  );

  log.warn("Seeded local dev starter town", {
    contentPass: "harthmere-full-town-layout-asset-map-v5",
    terrainShards: terrainUpdates.length,
    npcs: npcUpdates.length,
    spawn: STARTER_TOWN_SPAWN,
    groundY: STARTER_TOWN_GROUND_Y,
    x: [STARTER_TOWN_SAFE_X0, STARTER_TOWN_SAFE_X1],
    y: [32, 96],
    z: [STARTER_TOWN_SAFE_Z0, STARTER_TOWN_SAFE_Z1],
  });
}

export async function registerShimWorldApi<C extends ShimServerContext>(
  loader: RegistryLoader<C>
) {
  const service = await loader.get("shimWorldService");
  if (service === undefined) {
    return registerWorldApi<C>({})(loader);
  }
  return ShimWorldApi.createForService(service);
}

export async function registerShimChatApi<C extends ShimServerContext>(
  loader: RegistryLoader<C>
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
    await loadTrayDefinitionFromProd(bikkieStorage);
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
    new ExposeStorageService(db.backing)
  );
  rpcServer.install(
    zRemoteFirehoseService,
    new ExposeFirehoseService(firehose)
  );
  rpcServer.install(
    zShimBikkieStorageService,
    new ExposeBikkieStorageService(bikkieStorage)
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
          new InMemoryFirehose(loader.provide((context) => context.worldApi))
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
  }
);
