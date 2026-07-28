import {
  ExistingEntityAwareIdGenerator,
  type IdGenerator,
} from "@/server/shared/ids/generator";
import type { WorldApi } from "@/server/shared/world/api";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { zBiomesId } from "@/shared/ids";

export function ecsCollisionSafeIdGenerator(
  idGenerator: IdGenerator,
  worldApi: Pick<WorldApi, "has">
) {
  return new ExistingEntityAwareIdGenerator(idGenerator, (candidates) =>
    worldApi.has([...candidates])
  );
}

export default biomesApiHandler(
  {
    auth: "admin",
    response: zBiomesId,
  },
  async ({ context: { idGenerator, worldApi } }) => {
    return ecsCollisionSafeIdGenerator(idGenerator, worldApi).next();
  }
);
