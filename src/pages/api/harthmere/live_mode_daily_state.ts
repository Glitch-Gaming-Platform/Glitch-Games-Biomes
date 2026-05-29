import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereCareLoopClientSnapshotFromBackendV1,
  harthmereLiveModePlayerStateKeyV1,
  parseHarthmereLiveModeBackendStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
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

const globalForHarthmereLiveModeDailyState =
  globalThis as typeof globalThis & {
    __harthmereLiveModeDailyStateRedisV1?: ReturnType<typeof connectToRedis>;
  };

function liveModeDailyStateRedisV1() {
  return (globalForHarthmereLiveModeDailyState.__harthmereLiveModeDailyStateRedisV1 ??=
    connectToRedis("firehose"));
}

export async function readHarthmereLiveModeDailyStateForActorV1(input: {
  redis: { primary: { get: (key: string) => Promise<string | null> } };
  actorId: string;
  nowMs: number;
}) {
  const rawState = await input.redis.primary.get(harthmereLiveModePlayerStateKeyV1(input.actorId));
  const state = parseHarthmereLiveModeBackendStateV1(rawState, input.actorId, input.nowMs);
  state.updatedAtMs = input.nowMs;
  return createHarthmereCareLoopClientSnapshotFromBackendV1(state, input.nowMs);
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "GET",
    response: zHarthmereLiveModeDailyStateResponse,
  },
  async ({ auth: { userId } }) => {
    const actorId = String(userId);
    const redis = await liveModeDailyStateRedisV1();
    const nowMs = Date.now();
    return {
      ok: true,
      dailyState: await readHarthmereLiveModeDailyStateForActorV1({
        redis,
        actorId,
        nowMs,
      }),
    };
  }
);
