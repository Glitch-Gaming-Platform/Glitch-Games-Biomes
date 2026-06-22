import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { readHarthmereRedisStrings } from "@/server/harthmere/live_mode_state_read_helpers";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { disableHarthmereLiveModeHttpCaching } from "@/server/harthmere/live_mode_http_cache";
import {
  createHarthmereCareLoopClientSnapshotFromBackend,
  harthmereLiveModePlayerStateKey,
  parseHarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import { z } from "zod";

const zHarthmereCareLoopClientSnapshotResponse = z.object({
  actorId: z.string(),
  day: z.number(),
  streak: z.number(),
  claimedToday: z.record(z.number()),
  completedToday: z.record(z.number()),
  claimed: z.record(z.number()),
  completed: z.record(z.number()),
  townNeeds: z.record(z.number()),
  skills: z.record(z.object({ xp: z.number(), level: z.number() })),
  projects: z.record(z.unknown()),
});

export const zHarthmereLiveModeDailyStateResponse = z.object({
  ok: z.boolean(),
  dailyState: zHarthmereCareLoopClientSnapshotResponse,
});

const globalForHarthmereLiveModeDailyState = globalThis as typeof globalThis & {
  __harthmereLiveModeDailyStateRedis?: ReturnType<typeof connectToRedis>;
};

function liveModeDailyStateRedis() {
  return (globalForHarthmereLiveModeDailyState.__harthmereLiveModeDailyStateRedis ??=
    connectToRedis("firehose"));
}

export async function resolveHarthmereLiveModeDailyStateActorId(input: {
  redis: {
    primary: {
      get: (key: string) => Promise<string | null>;
    };
  };
  auth?: { userId?: unknown };
  unsafeRequest: {
    query?: Record<string, unknown>;
    headers?: Record<string, unknown>;
  };
}) {
  return resolveHarthmereLiveModeActorId(
    input.redis,
    { auth: input.auth, unsafeRequest: input.unsafeRequest },
    "anonymous:daily-state-reader",
    {
      allowIdentityWrites: false,
      allowStateAdoptionPlan: false,
    }
  );
}

export async function readHarthmereLiveModeDailyStateForActor(input: {
  redis: {
    primary: {
      get: (key: string) => Promise<string | null>;
      mget?: (...keys: string[]) => Promise<Array<string | null>>;
    };
  };
  actorId: string;
  nowMs: number;
}) {
  const [rawState] = await readHarthmereRedisStrings(input.redis.primary, [
    harthmereLiveModePlayerStateKey(input.actorId),
  ]);
  const state = parseHarthmereLiveModeBackendState(
    rawState,
    input.actorId,
    input.nowMs
  );
  state.updatedAtMs = input.nowMs;
  return createHarthmereCareLoopClientSnapshotFromBackend(state, input.nowMs);
}

export default biomesApiHandler(
  {
    auth: "optional",
    method: "GET",
    response: zHarthmereLiveModeDailyStateResponse,
  },
  async ({ auth, unsafeRequest, unsafeResponse }) => {
    disableHarthmereLiveModeHttpCaching(unsafeResponse);
    const redis = await liveModeDailyStateRedis();
    const actorId = await resolveHarthmereLiveModeDailyStateActorId({
      redis,
      auth,
      unsafeRequest,
    });
    const nowMs = Date.now();
    return {
      ok: true,
      dailyState: await readHarthmereLiveModeDailyStateForActor({
        redis,
        actorId,
        nowMs,
      }),
    };
  }
);
