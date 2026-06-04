import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereProductionEconomyClientSnapshotFromBackendV1,
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

export async function readHarthmereLiveModeEconomyStateForActorV1(input: {
  redis: {
    primary: {
      get: (key: string) => Promise<string | null>;
      mget?: (...keys: string[]) => Promise<Array<string | null>>;
    };
  };
  actorId: string;
  nowMs: number;
}) {
  const { rawState, rawSharedState } =
    await readHarthmerePlayerAndSharedStateStringsV1(
      input.redis.primary,
      harthmereLiveModePlayerStateKeyV1(input.actorId),
      harthmereLiveModeSharedWorldStateKeyV1()
    );
  const state = parseHarthmereLiveModeBackendStateV1(
    rawState,
    input.actorId,
    input.nowMs
  );
  mergeHarthmereLiveModeSharedWorldStateIntoBackendV1(
    state,
    parseHarthmereLiveModeSharedWorldStateV1(rawSharedState, input.nowMs),
    input.nowMs
  );
  state.updatedAtMs = input.nowMs;
  return createHarthmereProductionEconomyClientSnapshotFromBackendV1(state);
}

export default biomesApiHandler(
  {
    // HARTHMERE_BUSINESS_ANONYMOUS_ACCESS_V1: the business interface (buying,
    // customer mini-games, browsing shops) must work for not-logged-in players
    // too. Like the other live_mode_*_state endpoints, resolve an install-scoped
    // actor when there is no user instead of returning 401, so anonymous players
    // get an economy snapshot, see the "open" prompt, and can transact.
    auth: "optional",
    method: "GET",
    response: zHarthmereLiveModeEconomyStateResponse,
  },
  async ({ auth, unsafeRequest }) => {
    const redis = await liveModeEconomyStateRedisV1();
    const actorId = await resolveHarthmereLiveModeActorIdV1(
      redis,
      { auth, unsafeRequest },
      "anonymous:economy-reader"
    );
    const nowMs = Date.now();
    return {
      ok: true,
      economyState: await readHarthmereLiveModeEconomyStateForActorV1({
        redis,
        actorId,
        nowMs,
      }),
    };
  }
);
