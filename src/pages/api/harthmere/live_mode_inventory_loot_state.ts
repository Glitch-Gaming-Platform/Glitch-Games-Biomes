import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereInventoryLootClientSnapshotFromBackendV1,
  harthmereLiveModePlayerStateKeyV1,
  parseHarthmereLiveModeBackendStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import { z } from "zod";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeInventoryLootStateResponse = z.object({
  ok: z.boolean(),
  inventoryLootState: zJsonRecord,
});

const globalForHarthmereLiveModeInventoryLootState = globalThis as typeof globalThis & {
  __harthmereLiveModeInventoryLootStateRedisV1?: ReturnType<typeof connectToRedis>;
};

export interface HarthmereLiveModeInventoryLootStateRedisV1 {
  primary: {
    get: (key: string) => Promise<string | null>;
  };
}

function liveModeInventoryLootStateRedisV1() {
  return (globalForHarthmereLiveModeInventoryLootState.__harthmereLiveModeInventoryLootStateRedisV1 ??=
    connectToRedis("firehose"));
}

export async function readHarthmereLiveModeInventoryLootStateForActorV1(input: {
  redis: HarthmereLiveModeInventoryLootStateRedisV1;
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
  return createHarthmereInventoryLootClientSnapshotFromBackendV1(state);
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "GET",
    response: zHarthmereLiveModeInventoryLootStateResponse,
  },
  async ({ auth: { userId } }) => {
    const actorId = String(userId);
    const redis = await liveModeInventoryLootStateRedisV1();
    return {
      ok: true,
      inventoryLootState: await readHarthmereLiveModeInventoryLootStateForActorV1({
        redis,
        actorId,
        nowMs: Date.now(),
      }),
    };
  },
);
