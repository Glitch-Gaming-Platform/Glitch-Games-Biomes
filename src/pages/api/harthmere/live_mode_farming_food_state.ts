import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { readHarthmereRedisStrings } from "@/server/harthmere/live_mode_state_read_helpers";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { disableHarthmereLiveModeHttpCaching } from "@/server/harthmere/live_mode_http_cache";
import {
  createHarthmereLiveModeFarmingFoodClientSnapshot,
  harthmereLiveModePlayerStateKey,
  parseHarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import { z } from "zod";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeFarmingFoodStateResponse = z.object({
  ok: z.boolean(),
  farmingFoodState: zJsonRecord,
});

const globalForHarthmereLiveModeFarmingFoodState =
  globalThis as typeof globalThis & {
    __harthmereLiveModeFarmingFoodStateRedis?: ReturnType<
      typeof connectToRedis
    >;
  };

function liveModeFarmingFoodStateRedis() {
  return (globalForHarthmereLiveModeFarmingFoodState.__harthmereLiveModeFarmingFoodStateRedis ??=
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
  async ({ auth, unsafeRequest, unsafeResponse }) => {
    disableHarthmereLiveModeHttpCaching(unsafeResponse);
    const redis = await liveModeFarmingFoodStateRedis();
    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { auth, unsafeRequest },
      "anonymous:farming-food-reader",
      {
        allowIdentityWrites: false,
        allowStateAdoptionPlan: false,
      }
    );
    const [rawState] = await readHarthmereRedisStrings(redis.primary, [
      harthmereLiveModePlayerStateKey(actorId),
    ]);
    const nowMs = Date.now();
    const state = parseHarthmereLiveModeBackendState(rawState, actorId, nowMs);
    state.updatedAtMs = nowMs;
    return {
      ok: true,
      farmingFoodState: createHarthmereLiveModeFarmingFoodClientSnapshot(state),
    };
  }
);
