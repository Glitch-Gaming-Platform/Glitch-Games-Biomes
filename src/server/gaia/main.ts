import type { GaiaConfig, GaiaServerContext } from "@/server/gaia/context";
import { registerGaiaPipeline } from "@/server/gaia/pipeline";
import { registerGaiaServer } from "@/server/gaia/server";
import { registerGaiaSharder } from "@/server/gaia/sharder";
import { registerSimulations } from "@/server/gaia/simulations";
import { zSimulationName } from "@/server/gaia/simulations/api";
import { registerGaiaReplica } from "@/server/gaia/table";
import { registerTerrainEmitter } from "@/server/gaia/terrain/emitter";
import { registerTerrainSync } from "@/server/gaia/terrain/sync";
import { registerClock } from "@/server/gaia/util/clock";
import { registerGaiaPubSub } from "@/server/gaia/util/pubsub";
import { parseArgs, stringLiteralCtor } from "@/server/shared/args";
import { Cleanup } from "@/server/shared/cleanup";
import { sharedServerContext } from "@/server/shared/context";
import { runServer } from "@/server/shared/main";
import { baseServerArgumentConfig } from "@/server/shared/server_config";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import { registerWorldApi } from "@/server/shared/world/register";
import type { RegistryLoader } from "@/shared/registry";
import { RegistryBuilder } from "@/shared/registry";
import { registerIdGenerator } from "@/server/shared/ids/generator";

export async function registerGaiaConfig(): Promise<GaiaConfig> {
  return parseArgs<GaiaConfig>({
    ...baseServerArgumentConfig,
    simulations: {
      type: stringLiteralCtor(...zSimulationName.options),
      multiple: true,
      defaultValue: zSimulationName.options,
    },
  });
}

async function registerTerrainMap<C extends GaiaServerContext>(
  loader: RegistryLoader<C>
) {
  const [voxeloo, cleanup] = await Promise.all([
    loader.get("voxeloo"),
    loader.get("cleanup"),
  ]);
  const terrainMap = new voxeloo.GaiaTerrainMap();
  cleanup.add(() => terrainMap.delete());
  return terrainMap;
}

void runServer(
  "gaia",
  (signal) =>
    new RegistryBuilder<GaiaServerContext>()
      .install(sharedServerContext)
      .bind("cleanup", async () => new Cleanup())
      .bind("clock", registerClock)
      .bind("config", registerGaiaConfig)
      .bind("idGenerator", registerIdGenerator)
      .bind("pipeline", registerGaiaPipeline)
      .bind("pubsub", registerGaiaPubSub)
      .bind("replica", registerGaiaReplica)
      .bind("server", registerGaiaServer)
      .bind("sharder", registerGaiaSharder)
      .bind("simulations", registerSimulations)
      .bind("terrainEmitter", registerTerrainEmitter)
      .bind("terrainMap", registerTerrainMap)
      .bind("terrainSync", registerTerrainSync)
      .bind("worldApi", registerWorldApi({ signal }))
      .bind("voxeloo", loadVoxeloo)
      .build(),
  async (context) => {
    await context.server.start();
    return {
      shutdownHook: async () => context.server.stop(),
    };
  }
);
