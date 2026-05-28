import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  applyHarthmereBankLoanConsequencesV1,
  createHarthmereLiveModeBankingClientSnapshotV1,
  harthmereLiveModePlayerStateKeyV1,
  parseHarthmereLiveModeBackendStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import { z } from "zod";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeBankStateResponse = z.object({
  ok: z.boolean(),
  bankingState: zJsonRecord,
});

const globalForHarthmereLiveModeBankState = globalThis as typeof globalThis & {
  __harthmereLiveModeBankStateRedisV1?: ReturnType<typeof connectToRedis>;
};

function liveModeBankStateRedisV1() {
  return (globalForHarthmereLiveModeBankState.__harthmereLiveModeBankStateRedisV1 ??=
    connectToRedis("firehose"));
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "GET",
    response: zHarthmereLiveModeBankStateResponse,
  },
  async ({ auth: { userId } }) => {
    const actorId = String(userId);
    const redis = await liveModeBankStateRedisV1();
    const rawState = await redis.primary.get(harthmereLiveModePlayerStateKeyV1(actorId));
    const nowMs = Date.now();
    const state = parseHarthmereLiveModeBackendStateV1(rawState, actorId, nowMs);
    state.updatedAtMs = nowMs;
    const consequences = applyHarthmereBankLoanConsequencesV1(state, nowMs);
    if (consequences.changed) {
      await redis.primary.set(harthmereLiveModePlayerStateKeyV1(actorId), JSON.stringify(state));
    }
    return {
      ok: true,
      bankingState: createHarthmereLiveModeBankingClientSnapshotV1(state),
    };
  }
);
