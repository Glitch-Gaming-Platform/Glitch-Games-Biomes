import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  applyHarthmereBankLoanConsequencesV1,
  createHarthmereLiveModeBankingClientSnapshotV1,
  harthmereLiveModePlayerStateKeyV1,
  parseHarthmereLiveModeBackendStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import { z } from "zod";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeBankStateResponse = z.object({
  ok: z.boolean(),
  bankingState: zJsonRecord,
});

export interface HarthmereLiveModeBankStateRedisV1 {
  primary: {
    get: (key: string) => Promise<string | null>;
    set?: (key: string, value: string) => Promise<unknown>;
    watch?: (...keys: string[]) => Promise<unknown>;
    unwatch?: () => Promise<unknown>;
    multi?: () => {
      set: (key: string, value: string) => unknown;
      exec: () => Promise<unknown[] | null>;
    };
  };
}

const globalForHarthmereLiveModeBankState = globalThis as typeof globalThis & {
  __harthmereLiveModeBankStateRedisV1?: ReturnType<typeof connectToRedis>;
};

function liveModeBankStateRedisV1() {
  return (globalForHarthmereLiveModeBankState.__harthmereLiveModeBankStateRedisV1 ??=
    connectToRedis("firehose"));
}

export async function readHarthmereLiveModeBankStateForActorV1(input: {
  redis: HarthmereLiveModeBankStateRedisV1;
  actorId: string;
  nowMs: number;
}) {
  const stateKey = harthmereLiveModePlayerStateKeyV1(input.actorId);
  const rawState = await input.redis.primary.get(stateKey);
  const state = parseHarthmereLiveModeBackendStateV1(
    rawState,
    input.actorId,
    input.nowMs
  );
  state.updatedAtMs = input.nowMs;
  const consequences = applyHarthmereBankLoanConsequencesV1(
    state,
    input.nowMs
  );
  if (consequences.changed && input.redis.primary.set) {
    const supportsWatch =
      typeof input.redis.primary.watch === "function" &&
      typeof input.redis.primary.multi === "function";
    if (supportsWatch) {
      await input.redis.primary.watch?.(stateKey);
      try {
        const latestRawState = await input.redis.primary.get(stateKey);
        const latestState = parseHarthmereLiveModeBackendStateV1(
          latestRawState,
          input.actorId,
          input.nowMs
        );
        latestState.updatedAtMs = input.nowMs;
        const latestConsequences = applyHarthmereBankLoanConsequencesV1(
          latestState,
          input.nowMs
        );
        if (latestConsequences.changed) {
          const tx = input.redis.primary.multi?.();
          tx?.set(stateKey, JSON.stringify(latestState));
          await tx?.exec();
        } else {
          await input.redis.primary.unwatch?.();
        }
      } catch (error) {
        await input.redis.primary.unwatch?.();
        throw error;
      }
    } else {
      await input.redis.primary.set(stateKey, JSON.stringify(state));
    }
  }
  return createHarthmereLiveModeBankingClientSnapshotV1(state);
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "GET",
    response: zHarthmereLiveModeBankStateResponse,
  },
  async ({ auth: { userId } }) => {
    const actorId = String(userId);
    const redis = await liveModeBankStateRedisV1();
    return {
      ok: true,
      bankingState: await readHarthmereLiveModeBankStateForActorV1({
        redis,
        actorId,
        nowMs: Date.now(),
      }),
    };
  }
);
