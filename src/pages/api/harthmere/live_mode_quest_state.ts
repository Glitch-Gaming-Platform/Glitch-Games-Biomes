import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereLiveModeQuestClientSnapshotV1,
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

export const zHarthmereLiveModeQuestStateResponse = z.object({
  ok: z.boolean(),
  questState: zJsonRecord,
});

const globalForHarthmereLiveModeQuestState = globalThis as typeof globalThis & {
  __harthmereLiveModeQuestStateRedisV1?: ReturnType<typeof connectToRedis>;
};

function liveModeQuestStateRedisV1() {
  return (globalForHarthmereLiveModeQuestState.__harthmereLiveModeQuestStateRedisV1 ??=
    connectToRedis("firehose"));
}

export async function readHarthmereLiveModeQuestStateForActorV1(input: {
  redis: {
    primary: {
      get: (key: string) => Promise<string | null>;
      mget?: (...keys: string[]) => Promise<Array<string | null>>;
    };
  };
  actorId: string;
  nowMs: number;
}) {
  const stateKey = harthmereLiveModePlayerStateKeyV1(input.actorId);
  const sharedStateKey = harthmereLiveModeSharedWorldStateKeyV1();
  const { rawState, rawSharedState } =
    await readHarthmerePlayerAndSharedStateStringsV1(
      input.redis.primary,
      stateKey,
      sharedStateKey
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
  return createHarthmereLiveModeQuestClientSnapshotV1(state);
}

export default biomesApiHandler(
  {
    auth: "optional",
    method: "GET",
    response: zHarthmereLiveModeQuestStateResponse,
  },
  async ({ auth, unsafeRequest }) => {
    const redis = await liveModeQuestStateRedisV1();
    const actorId = await resolveHarthmereLiveModeActorIdV1(
      redis,
      { auth, unsafeRequest },
      "anonymous:quest-state-reader"
    );
    const nowMs = Date.now();
    return {
      ok: true,
      questState: await readHarthmereLiveModeQuestStateForActorV1({
        redis,
        actorId,
        nowMs,
      }),
    };
  }
);
