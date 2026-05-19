import { HostPort } from "@/server/shared/ports";
import type { ZrpcServer } from "@/server/shared/zrpc/server";
import type { WebSocketZrpcServerLike } from "@/server/shared/zrpc/websocket/api";
import { zInternalSyncService } from "@/server/sync/api";
import type { ClientTable } from "@/server/sync/client_table";
import type { SyncServerContext } from "@/server/sync/context";
import type { SyncService } from "@/server/sync/service";
import type { SyncIndex } from "@/server/sync/subscription/sync_index";
import { zSyncService } from "@/shared/api/sync";
import type { RegistryLoader } from "@/shared/registry";
import { fireAndForget } from "@/shared/util/async";

export class SyncServer {
  constructor(
    private readonly syncIndex: SyncIndex,
    private readonly syncService: SyncService,
    private readonly wsRpcServer: WebSocketZrpcServerLike,
    private readonly rpcServer: ZrpcServer,
    private readonly clientTable: ClientTable
  ) {
    CONFIG_EVENTS.on("changed", () => {
      if (CONFIG.disableGame) {
        fireAndForget(this.wsRpcServer.forceReloadClients());
      }
    });
  }

  async start() {
    console.log("GLITCH_SYNC_SERVER_TRACE_V95 start enter", {
      host: process.env.HOST,
      basePort: process.env.BASE_PORT,
      rpcPort: process.env.RPC_PORT,
      syncPort: process.env.SYNC_PORT,
    });
    await this.syncIndex.start();
    this.clientTable.start();
    this.wsRpcServer.install(zSyncService, this.syncService);
    this.rpcServer.install(zInternalSyncService, this.syncService);
    await this.wsRpcServer.start(HostPort.forSync().port);
    // TODO: Cleanup hardcoding.
    // Is a large change now as things assume a service can only have a singular
    // port, sync actually has two.
    console.log("GLITCH_SYNC_SERVER_TRACE_V95 before rpcServer.start", HostPort.rpcPort);
    await this.rpcServer.start(HostPort.rpcPort);
    console.log("GLITCH_SYNC_SERVER_TRACE_V95 after rpcServer.start", HostPort.rpcPort);
  }

  async dump() {
    return this.clientTable.dump();
  }

  get ready() {
    return this.wsRpcServer.ready;
  }

  async lameDuck() {
    await this.wsRpcServer.lameDuck();
  }

  async stop() {
    await this.wsRpcServer.stop();
    await Promise.all([
      this.rpcServer.stop(),
      this.syncIndex.stop(),
      this.clientTable.stop(),
      this.syncService.stop(),
    ]);
  }
}

async function glitchTraceGet<C>(
  loader: RegistryLoader<C>,
  key: string
): Promise<any> {
  const start = Date.now();
  console.log("GLITCH_SYNC_REGISTER_SERVER_TRACE_V96 get:start", key);
  try {
    const value = await loader.get(key as any);
    console.log("GLITCH_SYNC_REGISTER_SERVER_TRACE_V96 get:done", key, `${Date.now() - start}ms`);
    return value;
  } catch (error) {
    console.error("GLITCH_SYNC_REGISTER_SERVER_TRACE_V96 get:error", key, error);
    throw error;
  }
}

export async function registerSyncServer<C extends SyncServerContext>(
  loader: RegistryLoader<C>
) {
  console.log("GLITCH_SYNC_REGISTER_SERVER_TRACE_V96 registerSyncServer:start");
  const syncIndex = await glitchTraceGet(loader, "syncIndex");
  const syncService = await glitchTraceGet(loader, "syncService");
  const wsRpcServer = await glitchTraceGet(loader, "wsRpcServer");
  const rpcServer = await glitchTraceGet(loader, "rpcServer");
  const clients = await glitchTraceGet(loader, "clients");
  console.log("GLITCH_SYNC_REGISTER_SERVER_TRACE_V96 registerSyncServer:construct");
  console.log("GLITCH_SYNC_REGISTER_SERVER_TRACE_V97 before new SyncServer");
  const server = new SyncServer(
    syncIndex,
    syncService,
    wsRpcServer,
    rpcServer,
    clients
  );
  console.log("GLITCH_SYNC_REGISTER_SERVER_TRACE_V97 after new SyncServer");
  return server;
}
