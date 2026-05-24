import {
  connectToRedis,
  connectToRedisWithLua,
} from "@/server/shared/redis/connection";
import type { WorldApi } from "@/server/shared/world/api";
import { HfcWorldApi } from "@/server/shared/world/hfc/hfc";
import { HybridWorldApi } from "@/server/shared/world/hfc/hybrid";
import { RedisWorld } from "@/server/shared/world/redis";
import { ShimWorldApi } from "@/server/shared/world/shim/api";
import { log } from "@/shared/logging";
import { RegistryLoader } from "@/shared/registry";
import { ok } from "assert";

export type WorldApiMode = "shim" | "redis" | "hfc-hybrid";

export function registerWorldApi<
  C extends {
    config: {
      worldApiMode: WorldApiMode;
    };
  }
>({
  signal,
}: {
  signal?: AbortSignal;
}): (loader: RegistryLoader<C>) => Promise<WorldApi> {
  ok(
    !(signal instanceof RegistryLoader),
    "Make sure to pass config to registerWorldApi"
  );
  return async (loader) => {
    console.log(
      "GLITCH_STARTUP_TRACE_V2 registerWorldApi:enter pid=" + process.pid
    );
    const config = await loader.get("config");
    console.log(
      `GLITCH_STARTUP_TRACE_V2 registerWorldApi:got-config mode=${config.worldApiMode}`
    );
    let client: WorldApi =
      config.worldApiMode !== "shim"
        ? new RedisWorld(await connectToRedisWithLua("ecs"))
        : new ShimWorldApi();
    console.log(
      `GLITCH_STARTUP_TRACE_V2 registerWorldApi:client-constructed kind=${client.constructor.name}`
    );
    if (config.worldApiMode === "hfc-hybrid") {
      client = new HybridWorldApi(
        client,
        new HfcWorldApi(await connectToRedis("ecs-hfc"))
      );
      console.log(
        "GLITCH_STARTUP_TRACE_V2 registerWorldApi:wrapped-as-hfc-hybrid"
      );
    }
    if (!CONFIG.disableGame) {
      // GLITCH_WORLD_API_WAIT_HEALTHY_FIX_V1:
      // In shim mode the worldApi client is local to the same container, so
      // it should come up within seconds — but `waitForHealthy(Infinity)`
      // blocks the registry build, and the call site here is reached from
      // `sharedServerContext`'s bikkieRefresher load path. If shim's gRPC
      // client gets stuck in TRANSIENT_FAILURE for any reason (cold-start
      // race vs. shim's RPC bind, IPv6/IPv4 mismatch on 127.0.0.1, etc.),
      // the server hangs in `creatingContext` forever and Container Apps
      // kills the pod at the 3-minute wait_tcp window. For shim mode, use
      // a bounded timeout and let the gRPC retry machinery handle later
      // reconnects in the background. A warn is emitted so a degraded
      // state is still visible in logs. Other modes (redis / hfc-hybrid)
      // keep the original strict behavior.
      const waitTimeoutMs =
        config.worldApiMode === "shim" ? 60_000 : Infinity;
      console.log(
        "GLITCH_STARTUP_TRACE_V2 registerWorldApi:before-waitForHealthy" +
          ` mode=${config.worldApiMode} timeoutMs=${waitTimeoutMs}`
      );
      const waitStart = Date.now();
      const healthy = await client.waitForHealthy(waitTimeoutMs, signal);
      console.log(
        "GLITCH_STARTUP_TRACE_V2 registerWorldApi:after-waitForHealthy" +
          ` healthy=${healthy} elapsedMs=${Date.now() - waitStart}`
      );
      if (!healthy) {
        log.warn("World is not healthy on startup");
        // GLITCH_WORLD_API_WAIT_HEALTHY_FIX_V1: only fail-fast in production
        // when not using shim mode. Shim mode is expected to be best-effort
        // co-located; the gRPC client will keep trying in background.
        if (
          !CONFIG.disableGame &&
          process.env.NODE_ENV === "production" &&
          config.worldApiMode !== "shim"
        ) {
          throw new Error("World is not healthy on startup!");
        }
      }
    }
    console.log("GLITCH_STARTUP_TRACE_V2 registerWorldApi:done");
    return client;
  };
}
