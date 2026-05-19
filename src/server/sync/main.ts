import { registerAskApi } from "@/server/ask/api";
import { registerEventHandlerMap } from "@/server/logic/events/all";
import { registerLogicApi } from "@/server/shared/api/logic";
import { registerChatApi } from "@/server/shared/chat/register";
import { sharedServerContext } from "@/server/shared/context";
import { registerDiscordBot } from "@/server/shared/discord";
import { registerFirehose } from "@/server/shared/firehose/register";
import { runServer } from "@/server/shared/main";
import { registerServerMods } from "@/server/shared/minigames/server_bootstrap";
import { registerWorldApi } from "@/server/shared/world/register";
import { registerRpcServer } from "@/server/shared/zrpc/server";
import type { WebSocketZrpcServerLike } from "@/server/shared/zrpc/websocket/api";
import { WebSocketZrpcServer } from "@/server/shared/zrpc/websocket/server";
import { registerClients } from "@/server/sync/client_table";
import type { SyncServerContext } from "@/server/sync/context";
import { registerCrossClientEventBatcher } from "@/server/sync/events/cross_client";
import { registerSyncServer } from "@/server/sync/server";
import { SyncService } from "@/server/sync/service";
import { registerSyncIndex } from "@/server/sync/subscription/sync_index";
import { registerSessionStore } from "@/server/web/db/sessions";
import { registerCacheClient } from "@/server/web/server_cache";
import type { RegistryLoader } from "@/shared/registry";
import { RegistryBuilder } from "@/shared/registry";
import { sleep } from "@/shared/util/async";

function isGlitchRuntimeForSync() {
  return (
    process.env.GLITCH_RUNTIME === "1" ||
    process.env.GLITCH_DISABLE_DISCORD === "1" ||
    process.env.GLITCH_DISABLE_GCP === "1" ||
    !!process.env.GLITCH_TITLE_ID
  );
}

function createGlitchSyncNoopDiscordBot() {
  console.log("GLITCH_SYNC_NOOP_DISCORD_BOT_V99 skipping Discord bot for sync Glitch/local runtime.");

  const noop = async () => undefined;

  return new Proxy({} as any, {
    get(_target, prop) {
      if (prop === "then") {
        return undefined;
      }

      if (prop === Symbol.toStringTag) {
        return "GlitchSyncNoopDiscordBot";
      }

      return noop;
    },
  });
}

async function registerSyncDiscordBot<C extends SyncServerContext>(
  loader: RegistryLoader<C>
) {
  if (isGlitchRuntimeForSync()) {
    return createGlitchSyncNoopDiscordBot();
  }

  return registerDiscordBot(loader as any);
}


async function glitchTraceGet<C>(
  loader: RegistryLoader<C>,
  key: string
): Promise<any> {
  const start = Date.now();
  console.log("GLITCH_SYNC_REGISTRY_TRACE_V96 get:start", key);
  try {
    const value = await loader.get(key as any);
    console.log("GLITCH_SYNC_REGISTRY_TRACE_V96 get:done", key, `${Date.now() - start}ms`);
    return value;
  } catch (error) {
    console.error("GLITCH_SYNC_REGISTRY_TRACE_V96 get:error", key, error);
    throw error;
  }
}


async function registerWsRpcServer<C extends SyncServerContext>(
  loader: RegistryLoader<C>
): Promise<WebSocketZrpcServerLike> {
  console.log("GLITCH_SYNC_REGISTRY_TRACE_V96 registerWsRpcServer:start");
  const sessionStore = await glitchTraceGet(loader, "sessionStore");
  console.log("GLITCH_SYNC_REGISTRY_TRACE_V96 registerWsRpcServer:construct");
  return new WebSocketZrpcServer(
    sessionStore,
    ["/sync", "/beta-sync", "/ro-sync"],
    {
      maxConnections: CONFIG.syncMaxClients,
      maxInflightRequestsPerClient: CONFIG.syncMaxInflightRequestsPerClient,
      permitAnonymous: Boolean(
        process.env.NODE_ENV !== "production" || process.env.RO_SYNC
      ),
    }
  );
}

export async function registerSyncService<C extends SyncServerContext>(
  loader: RegistryLoader<C>
) {
  console.log("GLITCH_SYNC_REGISTRY_TRACE_V96 registerSyncService:start");
  const db = await glitchTraceGet(loader, "db");
  const clients = await glitchTraceGet(loader, "clients");
  const syncIndex = await glitchTraceGet(loader, "syncIndex");
  const worldApi = await glitchTraceGet(loader, "worldApi");
  const askApi = await glitchTraceGet(loader, "askApi");
  const chatApi = await glitchTraceGet(loader, "chatApi");
  const firehose = await glitchTraceGet(loader, "firehose");
  console.log("GLITCH_SYNC_REGISTRY_TRACE_V96 registerSyncService:construct");
  return new SyncService(
    db,
    clients,
    syncIndex,
    worldApi,
    askApi,
    chatApi,
    firehose
  );
}

void runServer(
  "sync",
  (signal) =>
    new RegistryBuilder<SyncServerContext>()
      .install(sharedServerContext)
      .bind("askApi", registerAskApi)
      .bind("chatApi", registerChatApi)
      .bind("clients", registerClients)
      .bind("crossClientEventBatcher", registerCrossClientEventBatcher)
      .bind("eventHandlerMap", registerEventHandlerMap)
      .bind("firehose", registerFirehose)
      .bind("logicApi", registerLogicApi)
      .bind("serverMods", registerServerMods)
      .bind("serverCache", registerCacheClient)
      .bind("sessionStore", registerSessionStore)
      .bind("syncIndex", registerSyncIndex)
      .bind("syncServer", registerSyncServer)
      .bind("syncService", registerSyncService)
      .bind("worldApi", registerWorldApi({ signal }))
      .bind("wsRpcServer", registerWsRpcServer)
      .bind("rpcServer", () => registerRpcServer())
      .bind("discord", registerSyncDiscordBot)
      .build(),
  async (context) => {
    console.log("GLITCH_SYNC_RUNSERVER_TRACE_V97 callback enter");
    console.log("GLITCH_SYNC_RUNSERVER_TRACE_V97 before context.syncServer.start");
    await context.syncServer.start();
    console.log("GLITCH_SYNC_RUNSERVER_TRACE_V97 after context.syncServer.start");
    return {
      readyHook: async () =>
        context.syncServer.ready && (await context.worldApi.healthy()),
      shutdownHook: async () => {
        await context.syncServer.lameDuck();
        await sleep(CONFIG.webServerLameDuckMs);
        await context.syncServer.stop();
      },
      dumpHook: async () => {
        return {
          sync: await context.syncServer.dump(),
        };
      },
    };
  }
);
