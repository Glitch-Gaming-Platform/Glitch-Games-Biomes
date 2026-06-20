import { connectToRedis } from "@/server/shared/redis/connection";
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
  const consequences = applyHarthmereBankLoanConsequences(
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
        const latestState = parseHarthmereLiveModeBackendState(
          latestRawState,
          input.actorId,
          input.nowMs
        );
        latestState.updatedAtMs = input.nowMs;
        const latestConsequences = applyHarthmereBankLoanConsequences(
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
  return createHarthmereLiveModeBankingClientSnapshot(state);
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "GET",
    response: zHarthmereLiveModeBankStateResponse,
  },
  async ({ auth: { userId } }) => {
    const actorId = String(userId);
    const redis = await liveModeBankStateRedis();
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
