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

function localDevTerrainHeight(worldX: number, worldZ: number) {
  // Keep the authored town flat and below every configured local/dev player
  // start. The previous patch could make the grass surface y=56..59 while new
  // players started at y=53..55, which put them inside/under the land.
  const townDx = worldX - STARTER_TOWN_SPAWN[0];
  const townDz = worldZ - STARTER_TOWN_SPAWN[2];
  const townDistance = Math.hypot(townDx, townDz);
  if (townDistance <= 90) {
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

function starterTownSurfaceMaterial(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldZ: number,
  current: TerrainID
): TerrainID {
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
    for (let shardX = 12; shardX <= 18; shardX += 1) {
      for (let shardZ = -9; shardZ <= -3; shardZ += 1) {
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

function starterTownNpcs(): StarterNpc[] {
  const y = STARTER_TOWN_GROUND_Y + 1;
  return [
    starterNpc(
      1,
      "Mira, Town Guide",
      [488, y, -205],
      [0, 3.15],
      "Welcome to Harthmere. The old world snapshot is missing, so this town was built as a safe starting point. Start at your two-level house, then visit the bakery, bank, shops, tavern, farm, workshop, archive, and watchtower.",
      "The guide for the local-dev starter town."
    ),
    starterNpc(
      2,
      "Bolt, Archive Robot",
      [505, y, -190],
      [0, 4.7],
      "Archive note: the original terrain, NPC, and story data were not included in the public snapshot. Harthmere is our replacement intro settlement, built from local terrain and safe fallback assets.",
      "A robot archivist explaining the story setup."
    ),
    starterNpc(
      3,
      "Toma, Builder",
      [504, y, -221],
      [0, 3.0],
      "The workshop is open. If something from the production asset set is missing, the town should now fall back instead of crashing. Keep testing every door, shop, and road.",
      "The builder standing by the workshop."
    ),
    starterNpc(
      4,
      "Pip, Harbor Mascot",
      [441, y, -202],
      [0, 1.5],
      "The chickens are real enough for local dev. Please do not ask them for directions; they mostly know where the grain is.",
      "A friendly town mascot near the market stalls."
    ),
    starterNpc(
      5,
      "Marlo, Baker",
      [428, y, -192],
      [0, 1.55],
      "Fresh bread is ready. Harthmere runs on three things: warm loaves, stable sync, and not crashing when an optional mesh is missing.",
      "The bakery owner."
    ),
    starterNpc(
      6,
      "Vera, Bank Teller",
      [552, y, -222],
      [0, 4.7],
      "Welcome to the bank. Your valuables are safe here, though the economy is still a local-dev stub until the full world data is restored.",
      "The bank teller."
    ),
    starterNpc(
      7,
      "Brann, Weapons Teller",
      [530, y, -228],
      [0, 3.15],
      "Blades, bows, and bug reports. I can only sell the third one today, but the shop is ready for a real inventory later.",
      "The weapons shopkeeper."
    ),
    starterNpc(
      8,
      "Luma, Healer",
      [456, y, -176],
      [0, 1.55],
      "Rest here if the world feels unstable. Harthmere was made to be a safe recovery point for new players.",
      "The healing shop NPC."
    ),
    starterNpc(
      9,
      "Orin, Magic Supplier",
      [514, y, -168],
      [0, 4.7],
      "Magic is mostly careful engineering with better lighting. I keep the sparkly things in the tower-facing cabinet.",
      "The magic shop supplier."
    ),
    starterNpc(
      10,
      "Nessa, Farm Keeper",
      [444, y, -236],
      [0, 0.1],
      "The farm is small, but it proves crops, fences, chickens, and open terrain can all live together in the local starter world.",
      "The farmer watching the chicken yard."
    ),
    starterNpc(
      11,
      "Garrick, Bartender",
      [540, y, -194],
      [0, 4.7],
      "Welcome to the tavern. First round is on the house if you managed to get past the loading screen.",
      "The tavern bartender."
    ),
    starterNpc(
      12,
      "Jori, Dockhand",
      [550, y, -198],
      [0, 2.4],
      "The harbor is quiet today, but the roads are open. I saw ten townsfolk walking loops around the plaza.",
      "A tavern patron."
    ),
    starterNpc(
      13,
      "Bela, Storyteller",
      [554, y, -190],
      [0, 3.4],
      "They say Harthmere appeared overnight, block by block, after the old world vanished. Sounds like a patch note to me.",
      "A tavern patron with local lore."
    ),
    starterNpc(
      14,
      "Kip, Card Player",
      [546, y, -186],
      [0, 0.5],
      "I would deal you in, but the cards are still imaginary. The table, at least, is very real.",
      "A tavern patron."
    ),
    starterNpc(
      15,
      "Sola, Traveler",
      [538, y, -186],
      [0, 5.5],
      "I came here looking for the old Biomes trails. The new town is smaller, but it has heart.",
      "A tavern traveler."
    ),
    starterNpc(
      16,
      "Mern, Tavern Bard",
      [558, y, -200],
      [0, 3.8],
      "I know one song: 'Ninety-eight shards on the wall.' It is longer than you think.",
      "A bard in the tavern."
    ),
    starterNpc(
      17,
      "Rowan, Walker",
      [486, y, -238],
      [0, 0.0],
      "I patrol the north road. If I stop moving, assume I found a good view.",
      "A walking town NPC.",
      [0.35, 0, 0]
    ),
    starterNpc(
      18,
      "Iva, Walker",
      [470, y, -210],
      [0, 1.57],
      "The plaza connects every important shop. That was deliberate; nobody likes getting lost during a smoke test.",
      "A walking town NPC.",
      [0, 0, 0.35]
    ),
    starterNpc(
      19,
      "Cade, Walker",
      [520, y, -210],
      [0, 4.71],
      "I walk between the bank and the weapons shop to make the town feel less empty.",
      "A walking town NPC.",
      [0, 0, -0.35]
    ),
    starterNpc(
      20,
      "Sera, Walker",
      [486, y, -178],
      [0, 3.14],
      "The healing shop and magic shop are both open. One fixes mistakes; the other causes them carefully.",
      "A walking town NPC.",
      [-0.35, 0, 0]
    ),
    starterNpc(
      21,
      "Tess, Walker",
      [438, y, -210],
      [0, 1.2],
      "The bakery smells better than the archive. Do not tell Bolt I said that.",
      "A walking town NPC.",
      [0.25, 0, 0.25]
    ),
    starterNpc(
      22,
      "Niko, Walker",
      [558, y, -210],
      [0, 4.2],
      "The bank is new. The vault is mostly stone, optimism, and a very serious teller.",
      "A walking town NPC.",
      [-0.25, 0, -0.25]
    ),
    starterNpc(
      23,
      "Pera, Walker",
      [462, y, -250],
      [0, 0.8],
      "That two-level house is yours. Upstairs is for looking important; downstairs is for finding the door.",
      "A walking town NPC.",
      [0.2, 0, 0.3]
    ),
    starterNpc(
      24,
      "Olan, Walker",
      [532, y, -170],
      [0, 5.4],
      "The magic shop roof glows because someone insisted the town needed a landmark besides the tower.",
      "A walking town NPC.",
      [-0.2, 0, -0.3]
    ),
    starterNpc(
      25,
      "Rin, Walker",
      [452, y, -232],
      [0, 2.1],
      "The chickens are near the farm. They are small, loud, and highly committed to their role.",
      "A walking town NPC.",
      [0.3, 0, -0.2]
    ),
    starterNpc(
      26,
      "Dax, Walker",
      [512, y, -236],
      [0, 0.2],
      "The weapons shop is south of the bank. The tavern is where everyone goes after pretending to work.",
      "A walking town NPC.",
      [-0.3, 0, 0.2]
    ),
    starterNpc(
      27,
      "Sergeant Bram Holt",
      [486, y, -277],
      [0, 3.14],
      "State your business and keep your hands where I can see them. Harthmere opens its gate, but it does not lower its guard.",
      "A stern north-gate guard who knows every regular traveler."
    ),
    starterNpc(
      28,
      "Mara Thistle",
      [440, y, -200],
      [0, 1.2],
      "Buy two onions and I might tell you who crossed the bridge after midnight. The market hears more truth than the hall does.",
      "A market vendor with a perfect memory for gossip."
    ),
    starterNpc(
      29,
      "Master Osric Vale",
      [506, y, -220],
      [0, 4.7],
      "Iron remembers the hand that shapes it. I repair plows by day and ask fewer questions about blades by night.",
      "The blacksmith of Craftsman Row."
    ),
    starterNpc(
      30,
      "Elowen Pike",
      [545, y, -192],
      [0, 4.7],
      "You can bleed outside or pay for a room. The Copper Kettle keeps a hearth for travelers and secrets for those who earn them.",
      "The tavern keeper, warm until crossed."
    ),
    starterNpc(
      31,
      "Father Aldren",
      [477, y, -139],
      [0, 3.14],
      "Faith is not the absence of fear. It is what remains when the old bell rings and nobody admits they heard it.",
      "The priest of Saint Verena's chapel."
    ),
    starterNpc(
      32,
      "Reeve Caldus Merrow",
      [564, y, -262],
      [0, 3.14],
      "Order is expensive. People who complain about taxes rarely understand what chaos costs.",
      "The polished, calculating ruler of Harthmere."
    ),
    starterNpc(
      33,
      "Nessa Crowe",
      [404, y, -160],
      [0, 1.57],
      "You walk like someone who has never been chased by three dogs and a landlord. I know the drain tunnels, but trust is not free.",
      "A sharp Mudden Ward rat-catcher and guide."
    ),
    starterNpc(
      34,
      "Tovin Reed",
      [579, y, -183],
      [0, 1.57],
      "Nothing enters Harthmere by river unless I know its weight, smell, and lie.",
      "The dockmaster with flexible morals."
    ),
    starterNpc(
      35,
      "Lysa, Cloth Merchant",
      [532, y, -202],
      [0, 2.0],
      "Burgundy cloth for market days, gray wool for honest work, and a hood if you would rather not be noticed.",
      "A merchant selling cloth and rumors."
    ),
    starterNpc(
      36,
      "Perrin, Moneylender",
      [556, y, -226],
      [0, 4.2],
      "Debt is only frightening to those who pretend promises are lighter than iron.",
      "A moneylender watching the bank door."
    ),
    starterNpc(
      37,
      "Old Jory",
      [431, y, -112],
      [0, 0.6],
      "Apples grow sweeter near old trouble. The orchard remembers the bridge tax riot better than the reeve does.",
      "A farmer from the apple fields."
    ),
    starterNpc(
      38,
      "Mirel, Gravekeeper",
      [518, y, -137],
      [0, 3.8],
      "The dead do not mind visitors. They mind thieves, liars, and people who whistle near the crypt wall.",
      "The quiet keeper of the chapel graveyard."
    ),
    starterNpc(
      39,
      "Rusk, Toll Clerk",
      [482, y, -280],
      [0, 0.0],
      "One copper to cross, two if your cart wheel squeaks, and nothing if Sergeant Holt is glaring at me.",
      "A nervous toll clerk beneath the north gate."
    ),
    starterNpc(
      40,
      "Sable, Smuggler",
      [399, y, -235],
      [0, 1.57],
      "The underways are just drains to honest folk. To everyone else, they are doors without hinges.",
      "A suspicious figure near the old drain tunnel."
    ),
  ];
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
    terrainShards: terrainUpdates.length,
    npcs: npcUpdates.length,
    spawn: STARTER_TOWN_SPAWN,
    groundY: STARTER_TOWN_GROUND_Y,
    x: [384, 608],
    y: [32, 96],
    z: [-288, -64],
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
