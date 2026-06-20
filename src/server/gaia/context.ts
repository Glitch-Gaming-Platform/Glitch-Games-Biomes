import type { Pipeline } from "@/server/gaia/pipeline";
import type { GaiaServer } from "@/server/gaia/server";
import type { Sharder } from "@/server/gaia/sharder";
import type {
  Simulation,
  SimulationName,
} from "@/server/gaia/simulations/api";
import type { GaiaReplica } from "@/server/gaia/table";
import type { TerrainEmitter } from "@/server/gaia/terrain/emitter";
import type { TerrainSync } from "@/server/gaia/terrain/sync";
import type { Clock } from "@/server/gaia/util/clock";
import type { GaiaPubSub } from "@/server/gaia/util/pubsub";
import type { Cleanup } from "@/server/shared/cleanup";
import type { SharedServerContext } from "@/server/shared/context";
import type { BaseServerConfig } from "@/server/shared/server_config";
import type { WorldApi } from "@/server/shared/world/api";
import type { VoxelooModule } from "@/shared/wasm/types";
import type { GaiaTerrainMap } from "@/shared/wasm/types/gaia";
import type { IdGenerator } from "@/server/shared/ids/generator";

export interface GaiaConfig extends BaseServerConfig {
  simulations: SimulationName[];
}
export interface GaiaServerContext extends SharedServerContext {
  cleanup: Cleanup;
  clock: Clock;
  config: GaiaConfig;
  idGenerator: IdGenerator;
  pipeline: Pipeline;
  pubsub: GaiaPubSub;
  replica: GaiaReplica;
  server: GaiaServer;
  sharder: Sharder;
  simulations: Simulation[];
  terrainEmitter: TerrainEmitter;
  terrainMap: GaiaTerrainMap;
  terrainSync: TerrainSync;
  worldApi: WorldApi;
  voxeloo: VoxelooModule;
}
