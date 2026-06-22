import { connectToRedis } from "@/server/shared/redis/connection";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { disableHarthmereLiveModeHttpCaching } from "@/server/harthmere/live_mode_http_cache";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  applyHarthmereBankLoanConsequences,
  createHarthmereLiveModeBankingClientSnapshot,
  harthmereLiveModePlayerStateKey,
  parseHarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import { z } from "zod";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeBankStateResponse = z.object({
  ok: z.boolean(),
  bankingState: zJsonRecord,
});

export interface HarthmereLiveModeBankStateRedis {
  primary: {
    get: (key: string) => Promise<string | null>;
  };
}

const globalForHarthmereLiveModeBankState = globalThis as typeof globalThis & {
  __harthmereLiveModeBankStateRedis?: ReturnType<typeof connectToRedis>;
};

function liveModeBankStateRedis() {
  return (globalForHarthmereLiveModeBankState.__harthmereLiveModeBankStateRedis ??=
    connectToRedis("firehose"));
}

export async function readHarthmereLiveModeBankStateForActor(input: {
  redis: HarthmereLiveModeBankStateRedis;
  actorId: string;
  nowMs: number;
}) {
  const stateKey = harthmereLiveModePlayerStateKey(input.actorId);
  const rawState = await input.redis.primary.get(stateKey);
  const state = parseHarthmereLiveModeBackendState(
    rawState,
    input.actorId,
    input.nowMs
  );
  state.updatedAtMs = input.nowMs;
  // GET endpoints are read-only projections. Loan consequence mutations must go
  // through the live-mode reducer path so Redis has one durable backend writer.
  applyHarthmereBankLoanConsequences(state, input.nowMs);
  return createHarthmereLiveModeBankingClientSnapshot(state);
}

export default biomesApiHandler(
  {
    auth: "optional",
    method: "GET",
    response: zHarthmereLiveModeBankStateResponse,
  },
  async ({ auth, unsafeRequest, unsafeResponse }) => {
    disableHarthmereLiveModeHttpCaching(unsafeResponse);
    const redis = await liveModeBankStateRedis();
    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { auth, unsafeRequest },
      "anonymous:bank-state-reader",
      {
        allowIdentityWrites: false,
        allowStateAdoptionPlan: false,
      }
    );
    return {
      ok: true,
      bankingState: await readHarthmereLiveModeBankStateForActor({
        redis,
        actorId,
        nowMs: Date.now(),
      }),
    };
  }
);
