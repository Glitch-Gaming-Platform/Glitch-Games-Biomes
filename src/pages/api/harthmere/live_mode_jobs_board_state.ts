import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereJobsBoardClientSnapshotFromBackendV1,
  harthmereLiveModePlayerStateKeyV1,
  parseHarthmereLiveModeBackendStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import { z } from "zod";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeJobsBoardStateResponse = z.object({
  ok: z.boolean(),
  jobsBoardState: zJsonRecord,
});

const globalForHarthmereLiveModeJobsBoardState = globalThis as typeof globalThis & {
  __harthmereLiveModeJobsBoardStateRedisV1?: ReturnType<typeof connectToRedis>;
};

function liveModeJobsBoardStateRedisV1() {
  return (globalForHarthmereLiveModeJobsBoardState.__harthmereLiveModeJobsBoardStateRedisV1 ??=
    connectToRedis("firehose"));
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "GET",
    response: zHarthmereLiveModeJobsBoardStateResponse,
  },
  async ({ auth: { userId } }) => {
    const actorId = String(userId);
    const redis = await liveModeJobsBoardStateRedisV1();
    const rawState = await redis.primary.get(harthmereLiveModePlayerStateKeyV1(actorId));
    const nowMs = Date.now();
    const state = parseHarthmereLiveModeBackendStateV1(rawState, actorId, nowMs);
    state.updatedAtMs = nowMs;
    return {
      ok: true,
      jobsBoardState: createHarthmereJobsBoardClientSnapshotFromBackendV1(state),
    };
  }
);
