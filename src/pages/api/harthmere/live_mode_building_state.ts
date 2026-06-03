import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereLiveModeBuildingClientSnapshotV1,
  harthmereLiveModePlayerStateKeyV1,
  harthmereLiveModeSharedWorldStateKeyV1,
  mergeHarthmereLiveModeSharedWorldStateIntoBackendV1,
  parseHarthmereLiveModeBackendStateV1,
  parseHarthmereLiveModeSharedWorldStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import { z } from "zod";
import { readHarthmerePlayerAndSharedStateStringsV1 } from "@/server/harthmere/live_mode_state_read_helpers";
import { resolveHarthmereLiveModeActorIdV1 } from "@/server/harthmere/live_mode_actor_resolution_v1";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeBuildingStateResponse = z.object({
  ok: z.boolean(),
  buildingState: zJsonRecord,
});

const globalForHarthmereLiveModeBuildingState = globalThis as typeof globalThis & {
  __harthmereLiveModeBuildingStateRedisV1?: ReturnType<typeof connectToRedis>;
};

function liveModeBuildingStateRedisV1() {
  return (globalForHarthmereLiveModeBuildingState.__harthmereLiveModeBuildingStateRedisV1 ??=
    connectToRedis("firehose"));
}

export default biomesApiHandler(
  {
    auth: "optional",
    method: "GET",
    response: zHarthmereLiveModeBuildingStateResponse,
  },
  async ({ auth, unsafeRequest }) => {
    const redis = await liveModeBuildingStateRedisV1();
    const actorId = await resolveHarthmereLiveModeActorIdV1(
      redis,
      { auth, unsafeRequest },
      "anonymous:building-reader"
    );
    const nowMs = Date.now();
    const { rawState, rawSharedState } =
      await readHarthmerePlayerAndSharedStateStringsV1(
        redis.primary,
        harthmereLiveModePlayerStateKeyV1(actorId),
        harthmereLiveModeSharedWorldStateKeyV1()
      );
    const state = parseHarthmereLiveModeBackendStateV1(
      rawState,
      actorId,
      nowMs
    );
    mergeHarthmereLiveModeSharedWorldStateIntoBackendV1(
      state,
      parseHarthmereLiveModeSharedWorldStateV1(rawSharedState, nowMs),
      nowMs
    );
    state.updatedAtMs = nowMs;
    return {
      ok: true,
      buildingState: createHarthmereLiveModeBuildingClientSnapshotV1(state),
    };
  }
);
