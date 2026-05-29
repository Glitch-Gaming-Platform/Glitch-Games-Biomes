import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereJobsBoardClientSnapshotFromBackendV1,
  harthmereLiveModePlayerStateKeyV1,
  parseHarthmereLiveModeBackendStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141,
  reduceHarthmereJobsBoardMutationV1,
} from "@/shared/harthmere/mmo_jobs_board_authority_v1";
import { z } from "zod";

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
      set?: (key: string, value: string) => Promise<unknown>;
    };
  };
  actorId: string;
  nowMs: number;
}) {
  const stateKey = harthmereLiveModePlayerStateKeyV1(input.actorId);
  const rawState = await input.redis.primary.get(stateKey);
  const state = parseHarthmereLiveModeBackendStateV1(rawState, input.actorId, input.nowMs);
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
    changed ||= result.touchedModels.includes("jobs_board_auto_seeded");
  }
  if (changed && input.redis.primary.set) {
    await input.redis.primary.set(stateKey, JSON.stringify(state));
  }
  return createHarthmereJobsBoardClientSnapshotFromBackendV1(state);
}

export default biomesApiHandler(
  {
    auth: "required",
    method: "GET",
    response: zHarthmereLiveModeJobsBoardStateResponse,
  },
  async ({ auth: { userId } }) => {
    const actorId = String(userId);
    const redis = await liveModeJobsBoardStateRedisV1();
    const nowMs = Date.now();
    return {
      ok: true,
      jobsBoardState: await readHarthmereLiveModeJobsBoardStateForActorV1({ redis, actorId, nowMs }),
    };
  }
);
