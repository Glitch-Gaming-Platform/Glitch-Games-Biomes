import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereLiveModeSharedWorldState,
  createHarthmereJobsBoardClientSnapshotFromBackend,
  harthmereLiveModePlayerStateKey,
  harthmereLiveModeSharedWorldStateKey,
  mergeHarthmereLiveModeSharedWorldStateIntoBackend,
  parseHarthmereLiveModeBackendState,
  parseHarthmereLiveModeSharedWorldState,
} from "@/shared/harthmere/live_mode_backend";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
  reduceHarthmereJobsBoardMutation,
} from "@/shared/harthmere/mmo_jobs_board_authority";
import { z } from "zod";
import { readHarthmerePlayerAndSharedStateStrings } from "@/server/harthmere/live_mode_state_read_helpers";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";

const zJsonRecord = z.record(z.unknown());

export const zHarthmereLiveModeJobsBoardStateResponse = z.object({
  ok: z.boolean(),
  jobsBoardState: zJsonRecord,
});

const globalForHarthmereLiveModeJobsBoardState = globalThis as typeof globalThis & {
  __harthmereLiveModeJobsBoardStateRedis?: ReturnType<typeof connectToRedis>;
};

function liveModeJobsBoardStateRedis() {
  return (globalForHarthmereLiveModeJobsBoardState.__harthmereLiveModeJobsBoardStateRedis ??=
    connectToRedis("firehose"));
}

export async function readHarthmereLiveModeJobsBoardStateForActor(input: {
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
  const stateKey = harthmereLiveModePlayerStateKey(input.actorId);
  const sharedStateKey = harthmereLiveModeSharedWorldStateKey();
  const { rawState, rawSharedState } =
    await readHarthmerePlayerAndSharedStateStrings(
      input.redis.primary,
      stateKey,
      sharedStateKey
    );
  const state = parseHarthmereLiveModeBackendState(rawState, input.actorId, input.nowMs);
  mergeHarthmereLiveModeSharedWorldStateIntoBackend(
    state,
    parseHarthmereLiveModeSharedWorldState(rawSharedState, input.nowMs),
    input.nowMs
  );
  state.updatedAtMs = input.nowMs;
  let changed = false;
  for (const boardId of [
    HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
    HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
  ]) {
    const result = reduceHarthmereJobsBoardMutation(
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
      JSON.stringify(createHarthmereLiveModeSharedWorldState(state, input.nowMs))
    );
  }
  return createHarthmereJobsBoardClientSnapshotFromBackend(state);
}

export default biomesApiHandler(
  {
    auth: "optional",
    method: "GET",
    response: zHarthmereLiveModeJobsBoardStateResponse,
  },
  async ({ auth, unsafeRequest }) => {
    const redis = await liveModeJobsBoardStateRedis();
    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { auth, unsafeRequest },
      "anonymous:jobs-board-reader"
    );
    const nowMs = Date.now();
    return {
      ok: true,
      jobsBoardState: await readHarthmereLiveModeJobsBoardStateForActor({ redis, actorId, nowMs }),
    };
  }
);
