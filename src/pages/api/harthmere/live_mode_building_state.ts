import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereLiveModeBuildingClientSnapshot,
  harthmereLiveModePlayerStateKey,
  harthmereLiveModeSharedWorldStateKey,
  mergeHarthmereLiveModeSharedWorldStateIntoBackend,
  parseHarthmereLiveModeBackendState,
  parseHarthmereLiveModeSharedWorldState,
} from "@/shared/harthmere/live_mode_backend";
import { z } from "zod";
import { readHarthmerePlayerAndSharedStateStrings } from "@/server/harthmere/live_mode_state_read_helpers";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeBuildingStateResponse = z.object({
  ok: z.boolean(),
  buildingState: zJsonRecord,
});

const globalForHarthmereLiveModeBuildingState =
  globalThis as typeof globalThis & {
    __harthmereLiveModeBuildingStateRedis?: ReturnType<typeof connectToRedis>;
  };

function liveModeBuildingStateRedis() {
  return (globalForHarthmereLiveModeBuildingState.__harthmereLiveModeBuildingStateRedis ??=
    connectToRedis("firehose"));
}

export default biomesApiHandler(
  {
    auth: "optional",
    method: "GET",
    response: zHarthmereLiveModeBuildingStateResponse,
  },
  async ({ auth, unsafeRequest }) => {
    const redis = await liveModeBuildingStateRedis();
    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { auth, unsafeRequest },
      "anonymous:building-reader",
      {
        allowIdentityWrites: false,
        allowStateAdoptionPlan: false,
      }
    );
    const nowMs = Date.now();
    const { rawState, rawSharedState } =
      await readHarthmerePlayerAndSharedStateStrings(
        redis.primary,
        harthmereLiveModePlayerStateKey(actorId),
        harthmereLiveModeSharedWorldStateKey()
      );
    const state = parseHarthmereLiveModeBackendState(rawState, actorId, nowMs);
    mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      state,
      parseHarthmereLiveModeSharedWorldState(rawSharedState, nowMs),
      nowMs
    );
    state.updatedAtMs = nowMs;
    return {
      ok: true,
      buildingState: createHarthmereLiveModeBuildingClientSnapshot(state),
    };
  }
);
