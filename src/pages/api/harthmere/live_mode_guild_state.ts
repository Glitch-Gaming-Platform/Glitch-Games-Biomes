import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereLiveModeGuildClientSnapshotFromBackendV1,
  harthmereLiveModePlayerStateKeyV1,
  harthmereLiveModeSharedWorldStateKeyV1,
  mergeHarthmereLiveModeSharedWorldStateIntoBackendV1,
  parseHarthmereLiveModeBackendStateV1,
  parseHarthmereLiveModeSharedWorldStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import { z } from "zod";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeGuildStateResponse = z.object({
  ok: z.boolean(),
  guildState: zJsonRecord,
});

const globalForHarthmereLiveModeGuildState = globalThis as typeof globalThis & {
  __harthmereLiveModeGuildStateRedisV1?: ReturnType<typeof connectToRedis>;
};

function liveModeGuildStateRedisV1() {
  return (globalForHarthmereLiveModeGuildState.__harthmereLiveModeGuildStateRedisV1 ??=
    connectToRedis("firehose"));
}

export async function readHarthmereLiveModeGuildStateForActorV1(input: {
  redis: { primary: { get: (key: string) => Promise<string | null> } };
  actorId: string;
  nowMs: number;
}) {
  const [rawState, rawSharedState] = await Promise.all([
    input.redis.primary.get(harthmereLiveModePlayerStateKeyV1(input.actorId)),
    input.redis.primary.get(harthmereLiveModeSharedWorldStateKeyV1()),
  ]);
  const state = parseHarthmereLiveModeBackendStateV1(rawState, input.actorId, input.nowMs);
  mergeHarthmereLiveModeSharedWorldStateIntoBackendV1(
    state,
    parseHarthmereLiveModeSharedWorldStateV1(rawSharedState, input.nowMs),
    input.nowMs
  );
  state.updatedAtMs = input.nowMs;
  return createHarthmereLiveModeGuildClientSnapshotFromBackendV1(state);
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "GET",
    response: zHarthmereLiveModeGuildStateResponse,
  },
  async ({ auth: { userId } }) => {
    const actorId = String(userId);
    const redis = await liveModeGuildStateRedisV1();
    const nowMs = Date.now();
    return {
      ok: true,
      guildState: await readHarthmereLiveModeGuildStateForActorV1({ redis, actorId, nowMs }),
    };
  }
);
