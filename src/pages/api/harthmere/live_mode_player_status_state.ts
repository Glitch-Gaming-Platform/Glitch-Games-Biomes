import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereLiveModePlayerStatusClientSnapshotV1,
  harthmereLiveModePlayerStateKeyV1,
  parseHarthmereLiveModeBackendStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import { z } from "zod";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModePlayerStatusStateResponse = z.object({
  ok: z.boolean(),
  playerStatusState: zJsonRecord,
});

const globalForHarthmereLiveModePlayerStatusState =
  globalThis as typeof globalThis & {
    __harthmereLiveModePlayerStatusStateRedisV1?: ReturnType<
      typeof connectToRedis
    >;
  };

function liveModePlayerStatusStateRedisV1() {
  return (globalForHarthmereLiveModePlayerStatusState.__harthmereLiveModePlayerStatusStateRedisV1 ??=
    connectToRedis("firehose"));
}

export async function readHarthmereLiveModePlayerStatusStateForActorV1(input: {
  redis: { primary: { get: (key: string) => Promise<string | null> } };
  actorId: string;
  nowMs: number;
}) {
  const rawState = await input.redis.primary.get(
    harthmereLiveModePlayerStateKeyV1(input.actorId)
  );
  const state = parseHarthmereLiveModeBackendStateV1(
    rawState,
    input.actorId,
    input.nowMs
  );
  state.updatedAtMs = input.nowMs;
  return createHarthmereLiveModePlayerStatusClientSnapshotV1(state);
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "GET",
    response: zHarthmereLiveModePlayerStatusStateResponse,
  },
  async ({ auth: { userId } }) => {
    const actorId = String(userId);
    const redis = await liveModePlayerStatusStateRedisV1();
    return {
      ok: true,
      playerStatusState: await readHarthmereLiveModePlayerStatusStateForActorV1(
        {
          redis,
          actorId,
          nowMs: Date.now(),
        }
      ),
    };
  }
);
