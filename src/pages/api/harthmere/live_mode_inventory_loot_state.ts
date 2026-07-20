import { connectToRedis } from "@/server/shared/redis/connection";
import { materializeHarthmereNativeEcsPlans } from "@/server/harthmere/native_ecs_drop_materialization";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { readHarthmereRedisStrings } from "@/server/harthmere/live_mode_state_read_helpers";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { disableHarthmereLiveModeHttpCaching } from "@/server/harthmere/live_mode_http_cache";
import {
  createHarthmereInventoryLootClientSnapshotFromBackend,
  harthmereNativeEcsPlansForAvailableInventoryLoot,
  harthmereLiveModePlayerStateKey,
  harthmereLiveModeSharedWorldStateKey,
  mergeHarthmereLiveModeSharedWorldStateIntoBackend,
  parseHarthmereLiveModeBackendState,
  parseHarthmereLiveModeSharedWorldState,
} from "@/shared/harthmere/live_mode_backend";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import { log } from "@/shared/logging";
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
  const state = await readHarthmereLiveModeInventoryLootBackendStateForActor(
    input
  );
  return createHarthmereInventoryLootClientSnapshotFromBackend(state);
}

export async function readHarthmereLiveModeInventoryLootBackendStateForActor(input: {
  redis: HarthmereLiveModeInventoryLootStateRedis;
  actorId: string;
  nowMs: number;
}) {
  const [rawState, rawSharedState] = await readHarthmereRedisStrings(
    input.redis.primary,
    [
      harthmereLiveModePlayerStateKey(input.actorId),
      harthmereLiveModeSharedWorldStateKey(),
    ]
  );
  const state = parseHarthmereLiveModeBackendState(
    rawState,
    input.actorId,
    input.nowMs
  );
  mergeHarthmereLiveModeSharedWorldStateIntoBackend(
    state,
    parseHarthmereLiveModeSharedWorldState(rawSharedState, input.nowMs),
    input.nowMs
  );
  state.updatedAtMs = input.nowMs;
  return state;
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
  async ({
    context: { idGenerator, worldApi },
    auth,
    unsafeRequest,
    unsafeResponse,
  }) => {
    disableHarthmereLiveModeHttpCaching(unsafeResponse);
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
    const nowMs = Date.now();
    const state = await readHarthmereLiveModeInventoryLootBackendStateForActor({
      redis,
      actorId,
      nowMs,
    });
    if (nativeBiomesEcsAuthorityEnabled() && idGenerator && worldApi) {
      try {
        await materializeHarthmereNativeEcsPlans({
          redisPrimary: redis.primary as any,
          idGenerator,
          worldApi,
          plans: harthmereNativeEcsPlansForAvailableInventoryLoot(state, nowMs),
        });
      } catch (error) {
        // The read still returns inventory state; a later read/mutation retries
        // the durable plan with the same Redis allocation key.
        log.warn("Deferred native ECS loot reconciliation on inventory read", {
          actorId,
          error,
        });
      }
    }
    return {
      ok: true,
      inventoryLootState:
        createHarthmereInventoryLootClientSnapshotFromBackend(state),
    };
  }
);
