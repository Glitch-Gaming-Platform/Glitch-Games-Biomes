import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereLiveModeSharedWorldStateV1,
  createHarthmereJobsBoardClientSnapshotFromBackendV1,
  harthmereLiveModePlayerStateKeyV1,
  harthmereLiveModeSharedWorldStateKeyV1,
  mergeHarthmereLiveModeSharedWorldStateIntoBackendV1,
  parseHarthmereLiveModeBackendStateV1,
  parseHarthmereLiveModeSharedWorldStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141,
  reduceHarthmereJobsBoardMutationV1,
} from "@/shared/harthmere/mmo_jobs_board_authority_v1";
import { z } from "zod";
import { readHarthmerePlayerAndSharedStateStringsV1 } from "@/server/harthmere/live_mode_state_read_helpers";
import { resolveHarthmereLiveModeActorIdV1 } from "@/server/harthmere/live_mode_actor_resolution_v1";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeJobsBoardStateResponse = z.object({
  ok: z.boolean(),
  jobsBoardState: zJsonRecord,
});

const globalForHarthmereLiveModeJobsBoardState = globalThis as typeof globalThis & {
  __harthmereLiveModeJobsBoardStateRedisV1?: ReturnType<typeof connectToRedis>;
};

function liveModeJobsBoardStateRedisV1() {
  return (globalForHarthmereLiveModeJobsBoardState.__harthmereLiveModeJobsBoardStateRedisV1 ??=
    connectToRedis("firehose"));
}

export async function readHarthmereLiveModeJobsBoardStateForActorV1(input: {
  redis: {
    primary: {
      get: (key: string) => Promise<string | null>;
      mget?: (...keys: string[]) => Promise<Array<string | null>>;
      set?: (key: string, value: string) => Promise<unknown>;
    };
  };
  actorId: string;
  nowMs: number;
  persistReadSideEffects?: boolean;
}) {
  const stateKey = harthmereLiveModePlayerStateKeyV1(input.actorId);
  const sharedStateKey = harthmereLiveModeSharedWorldStateKeyV1();
  const { rawState, rawSharedState } =
    await readHarthmerePlayerAndSharedStateStringsV1(
      input.redis.primary,
      stateKey,
      sharedStateKey
    );
  const state = parseHarthmereLiveModeBackendStateV1(rawState, input.actorId, input.nowMs);
  mergeHarthmereLiveModeSharedWorldStateIntoBackendV1(
    state,
    parseHarthmereLiveModeSharedWorldStateV1(rawSharedState, input.nowMs),
    input.nowMs
  );
  state.updatedAtMs = input.nowMs;
  let changed = false;
  for (const boardId of [
    HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
    HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141,
  ]) {
    const result = reduceHarthmereJobsBoardMutationV1(
      state.jobsBoard,
      {
        requestId: `jobs_board_read_seed:${boardId}:${input.nowMs}`,
        actorId: input.actorId,
        nowMs: input.nowMs,
        operation: "economy_auto_seed_jobs",
        boardId,
      },
      {
        actorGold: state.inventory.gold,
        actorInventoryItems: state.inventory.items,
        actorGuildId: state.guild.memberGuildId,
        economy: state.economy.production,
      },
    );
    state.jobsBoard = result.jobsBoard;
    if (result.economy) {
      state.economy.production = result.economy;
    }
    changed ||= result.touchedModels.includes("jobs_board_auto_seeded")
      || result.sharedStateKeys.length > 0;
  }
  if (changed && input.persistReadSideEffects && input.redis.primary.set) {
    await input.redis.primary.set(
      sharedStateKey,
      JSON.stringify(createHarthmereLiveModeSharedWorldStateV1(state, input.nowMs))
    );
  }
  return createHarthmereJobsBoardClientSnapshotFromBackendV1(state);
}

export default biomesApiHandler(
  {
    auth: "optional",
    method: "GET",
    response: zHarthmereLiveModeJobsBoardStateResponse,
  },
  async ({ auth, unsafeRequest }) => {
    const redis = await liveModeJobsBoardStateRedisV1();
    const actorId = await resolveHarthmereLiveModeActorIdV1(
      redis,
      { auth, unsafeRequest },
      "anonymous:jobs-board-reader"
    );
    const nowMs = Date.now();
    return {
      ok: true,
      jobsBoardState: await readHarthmereLiveModeJobsBoardStateForActorV1({ redis, actorId, nowMs }),
    };
  }
);
