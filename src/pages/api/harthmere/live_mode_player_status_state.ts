import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import {
  createHarthmereLiveModePlayerStatusClientSnapshotV1,
  harthmereLiveModePlayerStateKeyV1,
  parseHarthmereLiveModeBackendStateV1,
  tickHarthmereLiveModeStaminaForGameplayV1,
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

function firstPlayerStatusReadStringV146(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : undefined;
}

function playerStatusReadActorIdV146(input: {
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
    firstPlayerStatusReadStringV146(input.unsafeRequest.query?.install_id) ??
    firstPlayerStatusReadStringV146(input.unsafeRequest.query?.installId) ??
    firstPlayerStatusReadStringV146(input.unsafeRequest.headers?.["x-glitch-install-id"]);
  return installId ? `install:${installId}` : "anonymous:player-status-reader";
}

export async function readHarthmereLiveModePlayerStatusStateForActorV1(input: {
  redis: {
    primary: {
      get: (key: string) => Promise<string | null>;
      set?: (key: string, value: string) => Promise<unknown>;
    };
  };
  actorId: string;
  nowMs: number;
  gameplayActive?: boolean;
}) {
  const stateKey = harthmereLiveModePlayerStateKeyV1(input.actorId);
  const rawState = await input.redis.primary.get(stateKey);
  const state = parseHarthmereLiveModeBackendStateV1(
    rawState,
    input.actorId,
    input.nowMs
  );
  const staminaTick = tickHarthmereLiveModeStaminaForGameplayV1(state, {
    nowMs: input.nowMs,
    gameplayActive: input.gameplayActive === true,
  });
  state.updatedAtMs = input.nowMs;
  if (staminaTick.changed && input.redis.primary.set) {
    await input.redis.primary.set(stateKey, JSON.stringify(state));
  }
  return createHarthmereLiveModePlayerStatusClientSnapshotV1(state);
}

function playerStatusGameplayActiveV146(input: {
  unsafeRequest: { query?: Record<string, unknown> };
}) {
  const raw =
    firstPlayerStatusReadStringV146(input.unsafeRequest.query?.gameplay_active) ??
    firstPlayerStatusReadStringV146(input.unsafeRequest.query?.gameplayActive);
  return /^(1|true|yes)$/i.test(raw ?? "");
}

export default biomesApiHandler(
  {
    auth: "optional",
    method: "GET",
    response: zHarthmereLiveModePlayerStatusStateResponse,
  },
  async ({ auth, unsafeRequest }) => {
    const actorId = playerStatusReadActorIdV146({ auth, unsafeRequest });
    const redis = await liveModePlayerStatusStateRedisV1();
    return {
      ok: true,
      playerStatusState: await readHarthmereLiveModePlayerStatusStateForActorV1(
        {
          redis,
          actorId,
          nowMs: Date.now(),
          gameplayActive: playerStatusGameplayActiveV146({ unsafeRequest }),
        }
      ),
    };
  }
);
