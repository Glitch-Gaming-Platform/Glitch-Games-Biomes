import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { readHarthmereRedisStrings } from "@/server/harthmere/live_mode_state_read_helpers";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import {
  createHarthmereLiveModePlayerStatusClientSnapshot,
  harthmereLiveModePlayerStateKey,
  parseHarthmereLiveModeBackendState,
  repairHarthmereStatusReadStaminaDeath,
  tickHarthmereLiveModeStaminaForGameplay,
} from "@/shared/harthmere/live_mode_backend";
import { z } from "zod";

const zJsonRecord = z.record(z.unknown());
const DEFAULT_PLAYER_STATUS_STAMINA_WRITE_THROTTLE_MS = 5_000;
const DEFAULT_PLAYER_STATUS_STAMINA_MEANINGFUL_DELTA = 1;

export const zHarthmereLiveModePlayerStatusStateResponse = z.object({
  ok: z.boolean(),
  playerStatusState: zJsonRecord,
});

const globalForHarthmereLiveModePlayerStatusState =
  globalThis as typeof globalThis & {
    __harthmereLiveModePlayerStatusStateRedis?: ReturnType<
      typeof connectToRedis
    >;
  };

function liveModePlayerStatusStateRedis() {
  return (globalForHarthmereLiveModePlayerStatusState.__harthmereLiveModePlayerStatusStateRedis ??=
    connectToRedis("firehose"));
}

function firstPlayerStatusReadString(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : undefined;
}

export function shouldPersistHarthmerePlayerStatusStaminaTick(input: {
  changed: boolean;
  deathTriggered: boolean;
  previousDeadFromStaminaAtMs?: number;
  nextDeadFromStaminaAtMs?: number;
  previousStamina: number;
  nextStamina: number;
  previousUpdatedAtMs?: number;
  nowMs: number;
  throttleMs?: number;
  meaningfulDelta?: number;
}) {
  if (!input.changed) {
    return false;
  }
  if (
    input.deathTriggered ||
    input.nextStamina <= 0 ||
    input.previousDeadFromStaminaAtMs !== input.nextDeadFromStaminaAtMs
  ) {
    return true;
  }
  if (
    Math.abs(input.previousStamina - input.nextStamina) >=
    (input.meaningfulDelta ?? DEFAULT_PLAYER_STATUS_STAMINA_MEANINGFUL_DELTA)
  ) {
    return true;
  }
  const previousUpdatedAtMs = Number(input.previousUpdatedAtMs);
  if (!Number.isFinite(previousUpdatedAtMs)) {
    return true;
  }
  return (
    input.nowMs - previousUpdatedAtMs >=
    (input.throttleMs ?? DEFAULT_PLAYER_STATUS_STAMINA_WRITE_THROTTLE_MS)
  );
}

export async function readHarthmereLiveModePlayerStatusStateForActor(input: {
  redis: {
    primary: {
      get: (key: string) => Promise<string | null>;
      mget?: (...keys: string[]) => Promise<Array<string | null>>;
    };
  };
  actorId: string;
  nowMs: number;
  gameplayActive?: boolean;
}) {
  const stateKey = harthmereLiveModePlayerStateKey(input.actorId);
  const [rawState] = await readHarthmereRedisStrings(input.redis.primary, [
    stateKey,
  ]);
  const state = parseHarthmereLiveModeBackendState(
    rawState,
    input.actorId,
    input.nowMs
  );
  const hasBackendRuntimeState = rawState !== null;
  // GET endpoints are read-only projections. Stamina/death repairs can be shown
  // in the returned snapshot, but durable state changes must flow through the
  // live-mode reducer transaction so Redis has one backend writer.
  const statusReadRepair = repairHarthmereStatusReadStaminaDeath(state, {
    nowMs: input.nowMs,
  });
  tickHarthmereLiveModeStaminaForGameplay(state, {
    nowMs: input.nowMs,
    gameplayActive: input.gameplayActive === true,
    allowDeathFromStamina: false,
  });
  return {
    ...createHarthmereLiveModePlayerStatusClientSnapshot(state),
    backendAuthority: {
      source: "harthmere-live-mode-redis",
      role: "backend-runtime-cache",
      persisted: hasBackendRuntimeState,
      readOnlyProjection: true,
      repairedForSnapshot: statusReadRepair.changed,
    },
  };
}

function playerStatusGameplayActive(input: {
  unsafeRequest: { query?: Record<string, unknown> };
}) {
  const raw =
    firstPlayerStatusReadString(input.unsafeRequest.query?.gameplay_active) ??
    firstPlayerStatusReadString(input.unsafeRequest.query?.gameplayActive);
  return /^(1|true|yes)$/i.test(raw ?? "");
}

export default biomesApiHandler(
  {
    auth: "optional",
    method: "GET",
    response: zHarthmereLiveModePlayerStatusStateResponse,
  },
  async ({ auth, unsafeRequest }) => {
    const redis = await liveModePlayerStatusStateRedis();
    const actorId = await resolveHarthmereLiveModeActorId(
      redis,
      { auth, unsafeRequest },
      "anonymous:player-status-reader",
      {
        allowIdentityWrites: false,
        allowStateAdoptionPlan: false,
      }
    );
    return {
      ok: true,
      playerStatusState: await readHarthmereLiveModePlayerStatusStateForActor({
        redis,
        actorId,
        nowMs: Date.now(),
        gameplayActive: playerStatusGameplayActive({ unsafeRequest }),
      }),
    };
  }
);
