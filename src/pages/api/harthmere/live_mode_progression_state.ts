import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereProgressionClientSnapshotFromBackendV1,
  harthmereLiveModePlayerStateKeyV1,
  parseHarthmereLiveModeBackendStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import { z } from "zod";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeProgressionStateResponse = z.object({
  ok: z.boolean(),
  progressionState: zJsonRecord,
});

const globalForHarthmereLiveModeProgressionState =
  globalThis as typeof globalThis & {
    __harthmereLiveModeProgressionStateRedisV1?: ReturnType<typeof connectToRedis>;
  };

function liveModeProgressionStateRedisV1() {
  return (globalForHarthmereLiveModeProgressionState.__harthmereLiveModeProgressionStateRedisV1 ??=
    connectToRedis("firehose"));
}

export async function readHarthmereLiveModeProgressionStateForActorV1(input: {
  redis: { primary: { get: (key: string) => Promise<string | null> } };
  actorId: string;
  nowMs: number;
}) {
  const rawState = await input.redis.primary.get(harthmereLiveModePlayerStateKeyV1(input.actorId));
  const state = parseHarthmereLiveModeBackendStateV1(rawState, input.actorId, input.nowMs);
  state.updatedAtMs = input.nowMs;
  return createHarthmereProgressionClientSnapshotFromBackendV1(state);
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "GET",
    response: zHarthmereLiveModeProgressionStateResponse,
  },
  async ({ auth: { userId } }) => {
    const actorId = String(userId);
    const redis = await liveModeProgressionStateRedisV1();
    const nowMs = Date.now();
    return {
      ok: true,
      progressionState: await readHarthmereLiveModeProgressionStateForActorV1({
        redis,
        actorId,
        nowMs,
      }),
    };
  }
);
