import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { readHarthmereRedisStringsV1 } from "@/server/harthmere/live_mode_state_read_helpers";
import { resolveHarthmereLiveModeActorIdV1 } from "@/server/harthmere/live_mode_actor_resolution_v1";
import {
  createHarthmereLiveModeFarmingFoodClientSnapshotV1,
  harthmereLiveModePlayerStateKeyV1,
  parseHarthmereLiveModeBackendStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import { z } from "zod";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeFarmingFoodStateResponse = z.object({
  ok: z.boolean(),
  farmingFoodState: zJsonRecord,
});

const globalForHarthmereLiveModeFarmingFoodState =
  globalThis as typeof globalThis & {
    __harthmereLiveModeFarmingFoodStateRedisV1?: ReturnType<
      typeof connectToRedis
    >;
  };

function liveModeFarmingFoodStateRedisV1() {
  return (globalForHarthmereLiveModeFarmingFoodState.__harthmereLiveModeFarmingFoodStateRedisV1 ??=
    connectToRedis("firehose"));
}

export default biomesApiHandler(
  {
    // Optional + install fallback to match its siblings (player_status, quest,
    // building). Previously auth:"required", which 401'd during the pre-cookie
    // window while siblings served install-keyed state -> inconsistent loads.
    auth: "optional",
    method: "GET",
    response: zHarthmereLiveModeFarmingFoodStateResponse,
  },
  async ({ auth, unsafeRequest }) => {
    const redis = await liveModeFarmingFoodStateRedisV1();
    const actorId = await resolveHarthmereLiveModeActorIdV1(
      redis,
      { auth, unsafeRequest },
      "anonymous:farming-food-reader"
    );
    const [rawState] = await readHarthmereRedisStringsV1(redis.primary, [
      harthmereLiveModePlayerStateKeyV1(actorId),
    ]);
    const nowMs = Date.now();
    const state = parseHarthmereLiveModeBackendStateV1(
      rawState,
      actorId,
      nowMs
    );
    state.updatedAtMs = nowMs;
    return {
      ok: true,
      farmingFoodState:
        createHarthmereLiveModeFarmingFoodClientSnapshotV1(state),
    };
  }
);
