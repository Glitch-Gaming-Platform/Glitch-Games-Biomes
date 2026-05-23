import {
  AssetExportsServerImpl,
  InvalidAssetExportServer,
  LazyAssetExportsServer,
} from "@/galois/interface/asset_server/exports";
import { registerAskApi } from "@/server/ask/api";
import { createCameraClient } from "@/server/camera/api";
import { registerLogicApi } from "@/server/shared/api/logic";
import { OobServer } from "@/server/oob/oob";
import { registerBakery } from "@/server/shared/bikkie/registry";
import { registerChatApi } from "@/server/shared/chat/register";
import { sharedServerContext } from "@/server/shared/context";
import { numCpus } from "@/server/shared/cpu";
import { registerDiscordBot } from "@/server/shared/discord";
import { registerFirehose } from "@/server/shared/firehose/register";
import { registerIdGenerator } from "@/server/shared/ids/generator";
import { runServer } from "@/server/shared/main";
import { registerServerMods } from "@/server/shared/minigames/server_bootstrap";
import { registerServerTaskProcessor } from "@/server/shared/tasks/server_tasks/server_task_processor";
import { registerTwitchBot } from "@/server/shared/twitch/twitch";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import { registerWorldApi } from "@/server/shared/world/register";
import { registerApp } from "@/server/web/app";
import { registerBigQueryClient } from "@/server/web/bigquery";
import { registerWebServerConfig } from "@/server/web/config";
import type { WebServerContext } from "@/server/web/context";
import { registerSessionStore } from "@/server/web/db/sessions";
import { registerCacheClient } from "@/server/web/server_cache";
import { SourceMapCache } from "@/server/web/source_maps";
import { log } from "@/shared/logging";
import type { RegistryLoader } from "@/shared/registry";
import { RegistryBuilder } from "@/shared/registry";
import { sleep } from "@/shared/util/async";

function isGlitchRuntimeForWeb() {
  return (
    process.env.GLITCH_RUNTIME === "1" ||
    process.env.GLITCH_DISABLE_GCP === "1" ||
    !!process.env.GLITCH_TITLE_ID
  );
}

function createGlitchNoopDiscordBot() {
  log.info("GLITCH_WEB_NOOP_DISCORD_BOT: Discord disabled for Glitch/local runtime.");

  const noop = async () => undefined;

  return new Proxy({} as any, {
    get(_target, prop) {
      // Critical: do not look promise-like. If `then` exists, `await` will
      // treat this no-op object as a thenable and registry startup hangs.
      if (prop === "then") {
        return undefined;
      }

      if (prop === Symbol.toStringTag) {
        return "GlitchNoopDiscordBot";
      }

      return noop;
    },
  });
}

function traceWebRegistryBind<C extends WebServerContext, T>(
  name: string,
  register: (loader: RegistryLoader<C>) => Promise<T> | T
) {
  return async (loader: RegistryLoader<C>): Promise<T> => {
    const started = Date.now();
    log.info(`GLITCH_WEB_BIND_START ${name}`);

    const interval = setInterval(() => {
      log.warn(
        `GLITCH_WEB_BIND_WAITING ${name} ${Date.now() - started}ms`
      );
    }, 5000);

    try {
      const value = await register(loader);
      log.info(`GLITCH_WEB_BIND_DONE ${name} ${Date.now() - started}ms`);
      return value;
    } catch (error) {
      log.error(`GLITCH_WEB_BIND_ERROR ${name}`, { error });
      throw error;
    } finally {
      clearInterval(interval);
    }
  };
}


function installGlitchSameOriginOobProxy(context: WebServerContext) {
  if (
    process.env.GLITCH_RUNTIME !== "1" &&
    process.env.GLITCH_DISABLE_GCP !== "1" &&
    !process.env.GLITCH_TITLE_ID
  ) {
    return;
  }

  if ((context.app as any).__glitchSameOriginOobProxyInstalled) {
    return;
  }
  (context.app as any).__glitchSameOriginOobProxyInstalled = true;

  // GLITCH_SAME_ORIGIN_OOB_PROXY_V118
  // In the Glitch/Harthmere one-container runtime the browser is served from
  // the web process at /, while the OOB service normally lives in a separate
  // process. The production client uses same-origin /sync/oob so cookies are
  // sent and no CORS preflight is required. Without this web-side interceptor,
  // Next.js serves its 404 page for /sync/oob and the client logs
  // "/sync/oob: Bad JSON" even though login and sync auth succeeded.
  new OobServer(context.sessionStore, context.app.http, context.worldApi);
  log.info("GLITCH_SAME_ORIGIN_OOB_PROXY_V118 installed /sync/oob on web");
}

async function registerAssetServer<C extends WebServerContext>(
  loader: RegistryLoader<C>
) {
  const config = await loader.get("config");

  const createAssetServer = async () => {
    // In production we're running the asset server as its own service
    // so we want to use all the CPUs available to it.
    const workerPoolSize =
      process.env.NODE_ENV === "production"
        ? numCpus()
        : Math.max(1, numCpus() - 1);
    log.info(`Initializing asset server with ${workerPoolSize} workers.`);
    const bakery = await loader.get("bakery");
    return new AssetExportsServerImpl(bakery.binaries, workerPoolSize);
  };

  if (process.env.GLITCH_DISABLE_ASSET_EXPORT_SERVER === "1") {
    log.warn(
      "GLITCH_DISABLE_ASSET_EXPORT_SERVER: asset export server explicitly disabled."
    );
    return new InvalidAssetExportServer();
  }

  // GLITCH_PLAYER_MESH_PROXY_V121
  // The Glitch/Harthmere packaged runtime should not block login/playboot on
  // the Python/Galois local mesh builder. By default the player mesh endpoint
  // uses the existing proxy path in /api/assets/player_mesh.glb. Local exports
  // remain available only when explicitly requested.
  if (isGlitchRuntimeForWeb() && config.assetServerMode === "proxy") {
    log.info(
      "GLITCH_PLAYER_MESH_PROXY_V121: using proxy player mesh mode; local asset exports are not started."
    );
    return new InvalidAssetExportServer();
  }

  if (
    process.env.GLITCH_PLAYER_MESH_MODE === "local" ||
    process.env.GLITCH_FORCE_LOCAL_ASSET_EXPORTS === "1"
  ) {
    log.info(
      "GLITCH_PLAYER_MESH_LOCAL_EXPORTS_V121: enabling lazy local asset exports for generated meshes."
    );
    return new LazyAssetExportsServer(createAssetServer);
  }

  switch (config.assetServerMode) {
    case "local":
      return createAssetServer();
    case "lazy":
      return new LazyAssetExportsServer(createAssetServer);
    case "none":
    case "proxy":
      return new InvalidAssetExportServer();
  }
}

export async function webServerContext(signal?: AbortSignal) {
  return new RegistryBuilder<WebServerContext>()
    .install(sharedServerContext)
    .bind("app", traceWebRegistryBind("app", registerApp))
    .bind("askApi", traceWebRegistryBind("askApi", registerAskApi))
    .bind("assetExportsServer", traceWebRegistryBind("assetExportsServer", registerAssetServer))
    .bind("bakery", traceWebRegistryBind("bakery", registerBakery))
    .bind("bigQuery", async (loader) => isGlitchRuntimeForWeb() ? undefined as any : registerBigQueryClient(loader as any))
    .bind("cameraClient", traceWebRegistryBind("cameraClient", async () => createCameraClient()))
    .bind("chatApi", traceWebRegistryBind("chatApi", registerChatApi))
    .bind("config", traceWebRegistryBind("config", registerWebServerConfig))
    .bind(
      "discordBot",
      traceWebRegistryBind("discordBot", async (loader) =>
        isGlitchRuntimeForWeb() || process.env.GLITCH_DISABLE_DISCORD === "1"
          ? createGlitchNoopDiscordBot()
          : registerDiscordBot(loader as any)
      )
    )
    .bind("firehose", traceWebRegistryBind("firehose", registerFirehose))
    .bind("idGenerator", traceWebRegistryBind("idGenerator", registerIdGenerator))
    .bind("serverMods", async () => isGlitchRuntimeForWeb() ? undefined as any : registerServerMods())
    .bind("logicApi", traceWebRegistryBind("logicApi", registerLogicApi))
    .bind("serverCache", traceWebRegistryBind("serverCache", registerCacheClient))
    .bind("serverTaskProcessor", async (loader) => isGlitchRuntimeForWeb() ? undefined as any : registerServerTaskProcessor(loader as any))
    .bind("sessionStore", traceWebRegistryBind("sessionStore", registerSessionStore))
    .bind("sourceMapCache", traceWebRegistryBind("sourceMapCache", async () => new SourceMapCache()))
    .bind("twitchBot", async (loader) => isGlitchRuntimeForWeb() ? undefined as any : registerTwitchBot(loader as any))
    .bind("worldApi", traceWebRegistryBind("worldApi", registerWorldApi({ signal })))
    .bind("voxeloo", traceWebRegistryBind("voxeloo", async () => loadVoxeloo()))
    .build();
}

void runServer("web", webServerContext, async (context) => {
  installGlitchSameOriginOobProxy(context);
  await context.app.start(context);
  return {
    readyHook: async () => {
      if (CONFIG.disableGame) {
        return true;
      }
      return context.worldApi.healthy();
    },
    shutdownHook: async () => {
      await sleep(CONFIG.webServerLameDuckMs);
      await context.app.stop();
    },
  };
});
