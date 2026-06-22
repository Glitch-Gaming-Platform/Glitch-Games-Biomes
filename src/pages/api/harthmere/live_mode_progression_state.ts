import { connectToRedis } from "@/server/shared/redis/connection";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { disableHarthmereLiveModeHttpCaching } from "@/server/harthmere/live_mode_http_cache";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereProgressionClientSnapshotFromBackend,
  harthmereLiveModePlayerStateKey,
  harthmereLiveModeSharedWorldStateKey,
  mergeHarthmereLiveModeSharedWorldStateIntoBackend,
  parseHarthmereLiveModeBackendState,
  parseHarthmereLiveModeSharedWorldState,
} from "@/shared/harthmere/live_mode_backend";
import { z } from "zod";
import { readHarthmerePlayerAndSharedStateStrings } from "@/server/harthmere/live_mode_state_read_helpers";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeProgressionStateResponse = z.object({
  ok: z.boolean(),
  progressionState: zJsonRecord,
});

const globalForHarthmereLiveModeProgressionState =
  globalThis as typeof globalThis & {
    __harthmereLiveModeProgressionStateRedis?: ReturnType<typeof connectToRedis>;
  };

function liveModeProgressionStateRedis() {
  return (globalForHarthmereLiveModeProgressionState.__harthmereLiveModeProgressionStateRedis ??=
    connectToRedis("firehose"));
}

export async function readHarthmereLiveModeProgressionStateForActor(input: {
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
    await readHarthmerePlayerAndSharedStateStrings(
      input.redis.primary,
      harthmereLiveModePlayerStateKey(input.actorId),
      harthmereLiveModeSharedWorldStateKey()
    );
  const state = parseHarthmereLiveModeBackendState(rawState, input.actorId, input.nowMs);
  mergeHarthmereLiveModeSharedWorldStateIntoBackend(
    state,
    parseHarthmereLiveModeSharedWorldState(rawSharedState, input.nowMs),
    input.nowMs
  );
  state.updatedAtMs = input.nowMs;
  return createHarthmereProgressionClientSnapshotFromBackend(state);
}

export default biomesApiHandler(
  {
    auth: "optional",
    method: "GET",
    response: zHarthmereLiveModeProgressionStateResponse,
  },
  async ({ auth, unsafeRequest, unsafeResponse }) => {
    disableHarthmereLiveModeHttpCaching(unsafeResponse);
    const redis = await liveModeProgressionStateRedis();
    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { auth, unsafeRequest },
      "anonymous:progression-state-reader",
      {
        allowIdentityWrites: false,
        allowStateAdoptionPlan: false,
      }
    );
    const nowMs = Date.now();
    return {
      ok: true,
      progressionState: await readHarthmereLiveModeProgressionStateForActor({
        redis,
        actorId,
        nowMs,
      }),
    };
  }
);
