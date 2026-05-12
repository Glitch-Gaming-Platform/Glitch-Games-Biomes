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
import { getTerrainID } from "@/shared/asset_defs/terrain";
import { getBiscuits } from "@/shared/bikkie/active";
import { using } from "@/shared/deletable";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import {
  Box,
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

function shouldSeedLocalDevTerrain() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.BIOMES_CREATE_LOCAL_DEV_TERRAIN !== "0"
  );
}

function hasTerrainShard(service: ShimWorldService) {
  for (const entity of service.table.contents()) {
    if (
      entity.box &&
      entity.shard_seed &&
      entity.shard_diff &&
      entity.shard_shapes
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

function localDevTerrainHeight(worldX: number, worldZ: number) {
  // A tiny authored island around the default Biomes spawn and starter warp
  // coordinates. This is intentionally deterministic so local/dev machines all
  // get the same playable world without needing the old production snapshot.
  const spawnDx = worldX - 486;
  const spawnDz = worldZ + 209;
  const warpDx = worldX - 497;
  const warpDz = worldZ + 132;
  const spawnHill = Math.max(0, 1 - Math.hypot(spawnDx, spawnDz) / 55);
  const warpHill = Math.max(0, 1 - Math.hypot(warpDx, warpDz) / 45);
  const ridge = Math.max(0, 1 - Math.abs(worldX - 492) / 22);
  const wave = Math.sin(worldX / 13) * 1.5 + Math.cos(worldZ / 17) * 1.5;
  return Math.round(51 + spawnHill * 5 + warpHill * 8 + ridge * 2 + wave);
}

function makeLocalDevTerrainShard(
  voxeloo: VoxelooModule,
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

  const dirt = getTerrainID("dirt");
  const grass = getTerrainID("grass");
  const stone = getTerrainID("stone");

  const buffer = using(new voxeloo.VolumeBlock_U32(), (seedBlock) => {
    // The public/local snapshot no longer contains the historical terrain
    // shards. Generate a small but real island so the player has blocks,
    // collision, meshing input, and a place to stand.
    for (let z = 0; z < SHARD_DIM; z += 1) {
      for (let x = 0; x < SHARD_DIM; x += 1) {
        const worldX = v0[0] + x;
        const worldZ = v0[2] + z;
        const topY = localDevTerrainHeight(worldX, worldZ);
        for (let y = 0; y < SHARD_DIM; y += 1) {
          const worldY = v0[1] + y;
          if (worldY > topY) {
            continue;
          }
          const depth = topY - worldY;
          seedBlock.set(x, y, z, depth === 0 ? grass : depth > 6 ? stone : dirt);
        }
      }
    }
    return saveBlock(voxeloo, seedBlock);
  });

  return {
    kind: "create",
    tick,
    entity: {
      id,
      box: Box.create({ v0, v1 }),
      shard_seed: ShardSeed.create({ buffer }),
      shard_diff: ShardDiff.create(),
      shard_shapes: ShardShapes.create(),
    },
  };
}

function makeLocalDevMiniWorldChanges(voxeloo: VoxelooModule, tick: number) {
  const changes: Change[] = [];
  let idOffset = 0;

  // Covers both the default new-player spawn area around [477..491, 53..55,
  // -211..-205] and the starter warp points around [485..508, 70, -133..-125].
  // x: 416..576, y: 32..64, z: -256..-96.
  for (let shardX = 13; shardX <= 17; shardX += 1) {
    for (let shardZ = -8; shardZ <= -4; shardZ += 1) {
      changes.push(
        makeLocalDevTerrainShard(
          voxeloo,
          (LOCAL_DEV_TERRAIN_ID_BASE + idOffset++) as BiomesId,
          shardX,
          1,
          shardZ,
          tick
        )
      );
    }
  }

  return changes;
}

async function seedLocalDevTerrainIfMissing(
  service: ShimWorldService | undefined,
  worldApi: WorldApi
) {
  if (!shouldSeedLocalDevTerrain()) {
    return;
  }

  if (service && hasTerrainShard(service)) {
    return;
  }

  const existingSeedShard = await worldApi.has(LOCAL_DEV_TERRAIN_ID_BASE);
  if (existingSeedShard !== undefined) {
    return;
  }

  const voxeloo = await loadVoxeloo();
  const tick = service ? service.table.tick + 1 : 1;
  const changes = makeLocalDevMiniWorldChanges(voxeloo, tick);

  if (service) {
    service.writeableTable.apply(changes);
  } else {
    const applied = await worldApi.apply({
      changes: changes.map(toProposedChange),
    });
    if (applied.outcome !== "success") {
      log.warn("Local dev mini-world terrain transaction did not apply", {
        outcome: applied.outcome,
      });
      return;
    }
  }

  log.warn("Seeded local dev mini-world terrain", {
    shards: changes.length,
    x: [416, 576],
    y: [32, 64],
    z: [-256, -96],
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
