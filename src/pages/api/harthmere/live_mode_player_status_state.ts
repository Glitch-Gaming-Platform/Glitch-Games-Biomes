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

function playerStatusStaminaWriteThrottleMs() {
  const raw = Number(
    process.env.HARTHMERE_PLAYER_STATUS_STAMINA_WRITE_THROTTLE_MS
  );
  return Number.isFinite(raw) && raw >= 0
    ? Math.trunc(raw)
    : DEFAULT_PLAYER_STATUS_STAMINA_WRITE_THROTTLE_MS;
}

function playerStatusStaminaMeaningfulDelta() {
  const raw = Number(
    process.env.HARTHMERE_PLAYER_STATUS_STAMINA_MEANINGFUL_DELTA
  );
  return Number.isFinite(raw) && raw >= 0
    ? raw
    : DEFAULT_PLAYER_STATUS_STAMINA_MEANINGFUL_DELTA;
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
      set?: (key: string, value: string) => Promise<unknown>;
      watch?: (...keys: string[]) => Promise<unknown>;
      unwatch?: () => Promise<unknown>;
      multi?: () => {
        set: (key: string, value: string) => unknown;
        exec: () => Promise<unknown[] | null>;
      };
    };
  };
  actorId: string;
  nowMs: number;
  gameplayActive?: boolean;
  staminaWriteThrottleMs?: number;
  staminaMeaningfulDelta?: number;
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
  const previousUpdatedAtMs = Number(state.updatedAtMs);
  const previousStamina = Number(state.combat.resources.stamina ?? 0);
  const previousDeadFromStaminaAtMs = Number.isFinite(
    Number(state.combat.deadFromStaminaAtMs)
  )
    ? Number(state.combat.deadFromStaminaAtMs)
    : undefined;
  const statusReadRepair = repairHarthmereStatusReadStaminaDeath(state, {
    nowMs: input.nowMs,
  });
  const staminaTick = tickHarthmereLiveModeStaminaForGameplay(state, {
    nowMs: input.nowMs,
    gameplayActive: input.gameplayActive === true,
    allowDeathFromStamina: false,
  });
  const nextStamina = Number(state.combat.resources.stamina ?? 0);
  const nextDeadFromStaminaAtMs = Number.isFinite(
    Number(state.combat.deadFromStaminaAtMs)
  )
    ? Number(state.combat.deadFromStaminaAtMs)
    : undefined;
  if (
    shouldPersistHarthmerePlayerStatusStaminaTick({
      changed: staminaTick.changed || statusReadRepair.changed,
      deathTriggered: staminaTick.deathTriggered,
      previousDeadFromStaminaAtMs,
      nextDeadFromStaminaAtMs,
      previousStamina,
      nextStamina,
      previousUpdatedAtMs,
      nowMs: input.nowMs,
      throttleMs:
        input.staminaWriteThrottleMs ?? playerStatusStaminaWriteThrottleMs(),
      meaningfulDelta:
        input.staminaMeaningfulDelta ?? playerStatusStaminaMeaningfulDelta(),
    }) &&
    input.redis.primary.set
  ) {
    const supportsWatch =
      typeof input.redis.primary.watch === "function" &&
      typeof input.redis.primary.multi === "function";
    if (supportsWatch) {
      await input.redis.primary.watch?.(stateKey);
      try {
        const latestRawState = await input.redis.primary.get(stateKey);
        const latestState = parseHarthmereLiveModeBackendState(
          latestRawState,
          input.actorId,
          input.nowMs
        );
        const latestPreviousUpdatedAtMs = Number(latestState.updatedAtMs);
        const latestPreviousStamina = Number(
          latestState.combat.resources.stamina ?? 0
        );
        const latestPreviousDeadFromStaminaAtMs = Number.isFinite(
          Number(latestState.combat.deadFromStaminaAtMs)
        )
          ? Number(latestState.combat.deadFromStaminaAtMs)
          : undefined;
        const latestStatusReadRepair = repairHarthmereStatusReadStaminaDeath(
          latestState,
          {
            nowMs: input.nowMs,
          }
        );
        const latestStaminaTick = tickHarthmereLiveModeStaminaForGameplay(
          latestState,
          {
            nowMs: input.nowMs,
            gameplayActive: input.gameplayActive === true,
            allowDeathFromStamina: false,
          }
        );
        const latestNextStamina = Number(
          latestState.combat.resources.stamina ?? 0
        );
        const latestNextDeadFromStaminaAtMs = Number.isFinite(
          Number(latestState.combat.deadFromStaminaAtMs)
        )
          ? Number(latestState.combat.deadFromStaminaAtMs)
          : undefined;
        if (
          shouldPersistHarthmerePlayerStatusStaminaTick({
            changed:
              latestStaminaTick.changed || latestStatusReadRepair.changed,
            deathTriggered: latestStaminaTick.deathTriggered,
            previousDeadFromStaminaAtMs: latestPreviousDeadFromStaminaAtMs,
            nextDeadFromStaminaAtMs: latestNextDeadFromStaminaAtMs,
            previousStamina: latestPreviousStamina,
            nextStamina: latestNextStamina,
            previousUpdatedAtMs: latestPreviousUpdatedAtMs,
            nowMs: input.nowMs,
            throttleMs:
              input.staminaWriteThrottleMs ??
              playerStatusStaminaWriteThrottleMs(),
            meaningfulDelta:
              input.staminaMeaningfulDelta ??
              playerStatusStaminaMeaningfulDelta(),
          })
        ) {
          latestState.updatedAtMs = input.nowMs;
          const tx = input.redis.primary.multi?.();
          tx?.set(stateKey, JSON.stringify(latestState));
          await tx?.exec();
        } else {
          await input.redis.primary.unwatch?.();
        }
      } catch (error) {
        await input.redis.primary.unwatch?.();
        throw error;
      }
    } else {
      state.updatedAtMs = input.nowMs;
      await input.redis.primary.set(stateKey, JSON.stringify(state));
    }
  }
  return createHarthmereLiveModePlayerStatusClientSnapshot(state);
}

function playerStatusGameplayActive(input: {
  unsafeRequest: { query?: Record<string, unknown> };
}) {
  const raw =
    firstPlayerStatusReadString(
      input.unsafeRequest.query?.gameplay_active
    ) ??
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
      "anonymous:player-status-reader"
    );
    return {
      ok: true,
      playerStatusState: await readHarthmereLiveModePlayerStatusStateForActor(
        {
          redis,
          actorId,
          nowMs: Date.now(),
          gameplayActive: playerStatusGameplayActive({ unsafeRequest }),
        }
      ),
    };
  }
);
