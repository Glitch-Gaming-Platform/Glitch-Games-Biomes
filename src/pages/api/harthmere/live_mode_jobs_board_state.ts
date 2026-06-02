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

function firstJobsBoardReadStringV146(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : undefined;
}

function jobsBoardReadActorIdV146(input: {
  auth?: { userId?: unknown };
  unsafeRequest: {
    query?: Record<string, unknown>;
    headers?: Record<string, unknown>;
  };
}) {
  if (input.auth?.userId !== undefined) {
    return String(input.auth.userId);
  }
  const installId =
    firstJobsBoardReadStringV146(input.unsafeRequest.query?.install_id) ??
    firstJobsBoardReadStringV146(input.unsafeRequest.query?.installId) ??
    firstJobsBoardReadStringV146(input.unsafeRequest.headers?.["x-glitch-install-id"]);
  return installId ? `install:${installId}` : "anonymous:jobs-board-reader";
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
  const sharedStateKey = harthmereLiveModeSharedWorldStateKeyV1();
  const [rawState, rawSharedState] = await Promise.all([
    input.redis.primary.get(stateKey),
    input.redis.primary.get(sharedStateKey),
  ]);
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
  if (changed && input.redis.primary.set) {
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
    const actorId = jobsBoardReadActorIdV146({ auth, unsafeRequest });
    const redis = await liveModeJobsBoardStateRedisV1();
    const nowMs = Date.now();
    return {
      ok: true,
      jobsBoardState: await readHarthmereLiveModeJobsBoardStateForActorV1({ redis, actorId, nowMs }),
    };
  }
);
