import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereProductionEconomyClientSnapshotFromBackendV1,
  harthmereLiveModePlayerStateKeyV1,
  parseHarthmereLiveModeBackendStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import { z } from "zod";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeEconomyStateResponse = z.object({
  ok: z.boolean(),
  economyState: zJsonRecord,
});

const globalForHarthmereLiveModeEconomyState = globalThis as typeof globalThis & {
  __harthmereLiveModeEconomyStateRedisV1?: ReturnType<typeof connectToRedis>;
};

function liveModeEconomyStateRedisV1() {
  return (globalForHarthmereLiveModeEconomyState.__harthmereLiveModeEconomyStateRedisV1 ??=
    connectToRedis("firehose"));
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "GET",
    response: zHarthmereLiveModeEconomyStateResponse,
  },
  async ({ auth: { userId } }) => {
    const actorId = String(userId);
    const redis = await liveModeEconomyStateRedisV1();
    const rawState = await redis.primary.get(harthmereLiveModePlayerStateKeyV1(actorId));
    const nowMs = Date.now();
    const state = parseHarthmereLiveModeBackendStateV1(rawState, actorId, nowMs);
    state.updatedAtMs = nowMs;
    return {
      ok: true,
      economyState: createHarthmereProductionEconomyClientSnapshotFromBackendV1(state),
    };
  }
);
