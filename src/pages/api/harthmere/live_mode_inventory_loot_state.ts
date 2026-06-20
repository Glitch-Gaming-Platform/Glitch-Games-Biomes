import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { readHarthmereRedisStrings } from "@/server/harthmere/live_mode_state_read_helpers";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import {
  createHarthmereInventoryLootClientSnapshotFromBackend,
  harthmereLiveModePlayerStateKey,
  parseHarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import { z } from "zod";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeInventoryLootStateResponse = z.object({
  ok: z.boolean(),
  inventoryLootState: zJsonRecord,
});

const globalForHarthmereLiveModeInventoryLootState =
  globalThis as typeof globalThis & {
    __harthmereLiveModeInventoryLootStateRedis?: ReturnType<
      typeof connectToRedis
    >;
  };

export interface HarthmereLiveModeInventoryLootStateRedis {
  primary: {
    get: (key: string) => Promise<string | null>;
    mget?: (...keys: string[]) => Promise<Array<string | null>>;
  };
}

function liveModeInventoryLootStateRedis() {
  return (globalForHarthmereLiveModeInventoryLootState.__harthmereLiveModeInventoryLootStateRedis ??=
    connectToRedis("firehose"));
}

export async function readHarthmereLiveModeInventoryLootStateForActor(input: {
  redis: HarthmereLiveModeInventoryLootStateRedis;
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
  return createHarthmereInventoryLootClientSnapshotFromBackend(state);
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
    const redis = await liveModeInventoryLootStateRedis();
    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { auth, unsafeRequest },
      "anonymous:inventory-loot-reader",
      {
        allowIdentityWrites: false,
        allowStateAdoptionPlan: false,
      }
    );
    return {
      ok: true,
      inventoryLootState: await readHarthmereLiveModeInventoryLootStateForActor(
        {
          redis,
          actorId,
          nowMs: Date.now(),
        }
      ),
    };
  }
);
