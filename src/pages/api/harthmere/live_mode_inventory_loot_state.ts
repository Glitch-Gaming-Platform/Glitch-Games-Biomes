import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { readHarthmereRedisStringsV1 } from "@/server/harthmere/live_mode_state_read_helpers";
import { resolveHarthmereLiveModeActorIdV1 } from "@/server/harthmere/live_mode_actor_resolution_v1";
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

const globalForHarthmereLiveModeInventoryLootState =
  globalThis as typeof globalThis & {
    __harthmereLiveModeInventoryLootStateRedisV1?: ReturnType<
      typeof connectToRedis
    >;
  };

export interface HarthmereLiveModeInventoryLootStateRedisV1 {
  primary: {
    get: (key: string) => Promise<string | null>;
    mget?: (...keys: string[]) => Promise<Array<string | null>>;
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
  const [rawState] = await readHarthmereRedisStringsV1(input.redis.primary, [
    harthmereLiveModePlayerStateKeyV1(input.actorId),
  ]);
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
    // Optional + install fallback to match its siblings (player_status, quest,
    // building). Previously auth:"required", which 401'd during the pre-cookie
    // window while siblings served install-keyed state -> inconsistent loads.
    auth: "optional",
    method: "GET",
    response: zHarthmereLiveModeInventoryLootStateResponse,
  },
  async ({ auth, unsafeRequest }) => {
    const redis = await liveModeInventoryLootStateRedisV1();
    const actorId = await resolveHarthmereLiveModeActorIdV1(
      redis,
      { auth, unsafeRequest },
      "anonymous:inventory-loot-reader"
    );
    return {
      ok: true,
      inventoryLootState:
        await readHarthmereLiveModeInventoryLootStateForActorV1({
          redis,
          actorId,
          nowMs: Date.now(),
        }),
    };
  }
);
