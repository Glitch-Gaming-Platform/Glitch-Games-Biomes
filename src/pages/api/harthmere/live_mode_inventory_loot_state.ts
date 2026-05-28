import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereInventoryLootClientSnapshotFromBackendV1,
  harthmereLiveModePlayerStateKeyV1,
  parseHarthmereLiveModeBackendStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import { z } from "zod";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeInventoryLootStateResponse = z.object({
  ok: z.boolean(),
  inventoryLootState: zJsonRecord,
});

const globalForHarthmereLiveModeInventoryLootState = globalThis as typeof globalThis & {
  __harthmereLiveModeInventoryLootStateRedisV1?: ReturnType<typeof connectToRedis>;
};

function liveModeInventoryLootStateRedisV1() {
  return (globalForHarthmereLiveModeInventoryLootState.__harthmereLiveModeInventoryLootStateRedisV1 ??=
    connectToRedis("firehose"));
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "GET",
    response: zHarthmereLiveModeInventoryLootStateResponse,
  },
  async ({ auth: { userId } }) => {
    const actorId = String(userId);
    const redis = await liveModeInventoryLootStateRedisV1();
    const rawState = await redis.primary.get(harthmereLiveModePlayerStateKeyV1(actorId));
    const nowMs = Date.now();
    const state = parseHarthmereLiveModeBackendStateV1(rawState, actorId, nowMs);
    state.updatedAtMs = nowMs;
    return {
      ok: true,
      inventoryLootState: createHarthmereInventoryLootClientSnapshotFromBackendV1(state),
    };
  },
);
