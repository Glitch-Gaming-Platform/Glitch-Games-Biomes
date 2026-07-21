import {
  ExistingEntityAwareIdGenerator,
  type IdGenerator,
} from "@/server/shared/ids/generator";
import { IdPoolGenerator } from "@/server/shared/ids/pool";
import type { WorldApi } from "@/server/shared/world/api";
import type { RegistryLoader } from "@/shared/registry";

export async function registerEventIdPool<
  C extends { idGenerator: IdGenerator; worldApi: WorldApi }
>(loader: RegistryLoader<C>) {
  const [idGenerator, worldApi] = await Promise.all([
    loader.get("idGenerator"),
    loader.get("worldApi"),
  ]);
  return new IdPoolGenerator(
    new ExistingEntityAwareIdGenerator(idGenerator, async (candidates) =>
      worldApi.has([...candidates])
    ),
    () => CONFIG.logicIdPoolBatchSize
  );
}
