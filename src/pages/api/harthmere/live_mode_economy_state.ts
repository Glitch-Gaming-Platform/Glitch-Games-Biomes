import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereProductionEconomyClientSnapshotFromBackend,
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

export const zHarthmereLiveModeEconomyStateResponse = z.object({
  ok: z.boolean(),
  economyState: zJsonRecord,
});

const globalForHarthmereLiveModeEconomyState =
  globalThis as typeof globalThis & {
    __harthmereLiveModeEconomyStateRedis?: ReturnType<typeof connectToRedis>;
  };

function liveModeEconomyStateRedis() {
  return (globalForHarthmereLiveModeEconomyState.__harthmereLiveModeEconomyStateRedis ??=
    connectToRedis("firehose"));
}

export async function readHarthmereLiveModeEconomyStateForActor(input: {
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
  const state = parseHarthmereLiveModeBackendState(
    rawState,
    input.actorId,
    input.nowMs
  );
  mergeHarthmereLiveModeSharedWorldStateIntoBackend(
    state,
    parseHarthmereLiveModeSharedWorldState(rawSharedState, input.nowMs),
    input.nowMs
  );
  state.updatedAtMs = input.nowMs;
  return createHarthmereProductionEconomyClientSnapshotFromBackend(state);
}

export default biomesApiHandler(
  {
    // HARTHMERE_BUSINESS_ANONYMOUS_ACCESS: the business interface (buying,
    // customer mini-games, browsing shops) must work for not-logged-in players
    // too. Like the other live_mode_*_state endpoints, resolve an install-scoped
    // actor when there is no user instead of returning 401, so anonymous players
    // get an economy snapshot, see the "open" prompt, and can transact.
    auth: "optional",
    method: "GET",
    response: zHarthmereLiveModeEconomyStateResponse,
  },
  async ({ auth, unsafeRequest }) => {
    const redis = await liveModeEconomyStateRedis();
    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { auth, unsafeRequest },
      "anonymous:economy-reader",
      {
        allowIdentityWrites: false,
        allowStateAdoptionPlan: false,
      }
    );
    const nowMs = Date.now();
    return {
      ok: true,
      economyState: await readHarthmereLiveModeEconomyStateForActor({
        redis,
        actorId,
        nowMs,
      }),
    };
  }
);
