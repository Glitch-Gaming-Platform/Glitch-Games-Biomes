import { connectToRedis } from "@/server/shared/redis/connection";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { disableHarthmereLiveModeHttpCaching } from "@/server/harthmere/live_mode_http_cache";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereLiveModeGuildClientSnapshotFromBackend,
  harthmereLiveModePlayerStateKey,
  harthmereLiveModeSharedWorldStateKey,
  mergeHarthmereLiveModeSharedWorldStateIntoBackend,
  parseHarthmereLiveModeBackendState,
  parseHarthmereLiveModeSharedWorldState,
} from "@/shared/harthmere/live_mode_backend";
import { z } from "zod";
import { readHarthmerePlayerAndSharedStateStrings } from "@/server/harthmere/live_mode_state_read_helpers";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeGuildStateResponse = z.object({
  ok: z.boolean(),
  guildState: zJsonRecord,
});

const globalForHarthmereLiveModeGuildState = globalThis as typeof globalThis & {
  __harthmereLiveModeGuildStateRedis?: ReturnType<typeof connectToRedis>;
};

function liveModeGuildStateRedis() {
  return (globalForHarthmereLiveModeGuildState.__harthmereLiveModeGuildStateRedis ??=
    connectToRedis("firehose"));
}

export async function readHarthmereLiveModeGuildStateForActor(input: {
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
  return createHarthmereLiveModeGuildClientSnapshotFromBackend(state);
}

export default biomesApiHandler(
  {
    auth: "optional",
    method: "GET",
    response: zHarthmereLiveModeGuildStateResponse,
  },
  async ({ auth, unsafeRequest, unsafeResponse }) => {
    disableHarthmereLiveModeHttpCaching(unsafeResponse);
    const redis = await liveModeGuildStateRedis();
    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { auth, unsafeRequest },
      "anonymous:guild-state-reader",
      {
        allowIdentityWrites: false,
        allowStateAdoptionPlan: false,
      }
    );
    const nowMs = Date.now();
    return {
      ok: true,
      guildState: await readHarthmereLiveModeGuildStateForActor({ redis, actorId, nowMs }),
    };
  }
);
