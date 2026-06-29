import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { readHarthmereRedisStrings } from "@/server/harthmere/live_mode_state_read_helpers";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { disableHarthmereLiveModeHttpCaching } from "@/server/harthmere/live_mode_http_cache";
import {
  createHarthmereLiveModePlayerStatusClientSnapshot,
  harthmereLiveModePlayerStateKey,
  parseHarthmereLiveModeBackendState,
  tickHarthmereLiveModeStaminaForGameplay,
  type HarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import { z } from "zod";

const zJsonRecord = z.record(z.unknown());
const DEFAULT_PLAYER_STATUS_STAMINA_WRITE_THROTTLE_MS = 5_000;
const DEFAULT_PLAYER_STATUS_STAMINA_MEANINGFUL_DELTA = 1;
const STALE_ACTIVE_STAMINA_BACKFILL_MS = 30_000;

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

function cloneStatusChannelValue<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

export function mergeFreshHarthmerePlayerStatusReadStateForTest(input: {
  state: HarthmereLiveModeBackendState;
  latestRawState: string | null | undefined;
  actorId: string;
  nowMs: number;
  rawUpdatedAtMs?: number;
  allowHealthWrite?: boolean;
}) {
  if (!input.latestRawState) return input.state;
  let latest: HarthmereLiveModeBackendState;
  try {
    latest = parseHarthmereLiveModeBackendState(
      input.latestRawState,
      input.actorId,
      input.nowMs
    );
  } catch {
    return input.state;
  }

  input.state.combat.resources ??= {};
  input.state.combat.maxResources ??= {};
  latest.combat.resources ??= {};
  latest.combat.maxResources ??= {};

  const latestUpdatedAtMs = Number(latest.updatedAtMs);
  const rawUpdatedAtMs = Number(input.rawUpdatedAtMs);
  const latestIsNewerThanRead =
    Number.isFinite(latestUpdatedAtMs) &&
    Number.isFinite(rawUpdatedAtMs) &&
    latestUpdatedAtMs > rawUpdatedAtMs;
  const healthWriteAllowed =
    input.allowHealthWrite === true && !latestIsNewerThanRead;
  const nextResources = input.state.combat.resources;
  const latestLastTick = Number(latest.combat.lastStaminaTickMs);
  const nextLastTick = Number(input.state.combat.lastStaminaTickMs);
  const statusStaminaIsFresh =
    healthWriteAllowed ||
    !Number.isFinite(latestLastTick) ||
    (Number.isFinite(nextLastTick) && nextLastTick >= latestLastTick);

  if (!healthWriteAllowed) {
    input.state.combat.hp = latest.combat.hp;
    input.state.combat.maxHp = latest.combat.maxHp;
    input.state.combat.deathState = latest.combat.deathState;
    input.state.combat.deathRecords = cloneStatusChannelValue(
      latest.combat.deathRecords ?? {}
    );
    input.state.combat.respawnProtectionUntilMs =
      latest.combat.respawnProtectionUntilMs;
  }

  input.state.combat.resources = cloneStatusChannelValue(
    latest.combat.resources ?? {}
  );
  if (statusStaminaIsFresh && Number.isFinite(Number(nextResources.stamina))) {
    input.state.combat.resources.stamina = nextResources.stamina;
  }
  input.state.combat.maxResources = cloneStatusChannelValue(
    latest.combat.maxResources ?? input.state.combat.maxResources ?? {}
  );
  if (!statusStaminaIsFresh) {
    input.state.combat.lastStaminaTickMs = latest.combat.lastStaminaTickMs;
    input.state.combat.deadFromStaminaAtMs = latest.combat.deadFromStaminaAtMs;
  }

  input.state.law.standing = cloneStatusChannelValue(
    latest.law.standing ?? input.state.law.standing ?? {}
  );
  input.state.law.reputation = cloneStatusChannelValue(
    latest.law.reputation ?? input.state.law.reputation ?? {}
  );
  input.state.law.recentReputationEvents = cloneStatusChannelValue(
    latest.law.recentReputationEvents ??
      input.state.law.recentReputationEvents ??
      []
  );

  return input.state;
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
      set?: (key: string, value: string) => Promise<unknown>;
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
  const rawStateNeedsZeroHpDeathPersistence =
    rawHarthmereStatusStateHasZeroHpAlive(rawState);
  const state = parseHarthmereLiveModeBackendState(
    rawState,
    input.actorId,
    input.nowMs
  );
  const hasBackendRuntimeState = rawState !== null;
  const previousStamina = Number(state.combat.resources?.stamina ?? 0);
  const previousDeadFromStaminaAtMs = Number.isFinite(
    Number(state.combat.deadFromStaminaAtMs)
  )
    ? Number(state.combat.deadFromStaminaAtMs)
    : undefined;
  const previousUpdatedAtMs = state.updatedAtMs;
  const statusReadRepair = { changed: false };
  const zeroHpDeathRepair = repairZeroHpAliveDeathForStatusRead(state, {
    nowMs: input.nowMs,
  });
  const playableZeroRepair = repairStalePlayableZeroStaminaForStatusRead(
    state,
    { nowMs: input.nowMs }
  );
  const backfillWindowReset =
    resetOfflineStaminaBackfillWindowForActiveStatusRead(state, {
      nowMs: input.nowMs,
      gameplayActive: input.gameplayActive === true,
    });
  const staminaTick = tickHarthmereLiveModeStaminaForGameplay(state, {
    nowMs: input.nowMs,
    gameplayActive: input.gameplayActive === true,
    allowDeathFromStamina: true,
  });
  const nextStamina = Number(state.combat.resources?.stamina ?? 0);
  const shouldPersist =
    hasBackendRuntimeState &&
    typeof input.redis.primary.set === "function" &&
    (statusReadRepair.changed ||
      rawStateNeedsZeroHpDeathPersistence ||
      zeroHpDeathRepair.changed ||
      playableZeroRepair.changed ||
      backfillWindowReset.changed ||
      shouldPersistHarthmerePlayerStatusStaminaTick({
        changed: staminaTick.changed,
        deathTriggered: staminaTick.deathTriggered,
        previousDeadFromStaminaAtMs,
        nextDeadFromStaminaAtMs: Number.isFinite(
          Number(state.combat.deadFromStaminaAtMs)
        )
          ? Number(state.combat.deadFromStaminaAtMs)
          : undefined,
        previousStamina,
        nextStamina,
        previousUpdatedAtMs,
        nowMs: input.nowMs,
      }));
  let statusSnapshotState = state;
  if (shouldPersist) {
    // Status polling is the only reader with enough cadence to make stamina feel
    // alive in the HUD. Keep the write narrowly scoped to this actor key and
    // throttle it so normal polling does not contend with reducer transactions.
    state.updatedAtMs = input.nowMs;
    const latestRawStateForStatusWrite =
      typeof input.redis.primary.get === "function"
        ? await input.redis.primary.get(stateKey)
        : rawState;
    statusSnapshotState = mergeFreshHarthmerePlayerStatusReadStateForTest({
      state,
      latestRawState: latestRawStateForStatusWrite,
      actorId: input.actorId,
      nowMs: input.nowMs,
      rawUpdatedAtMs: previousUpdatedAtMs,
      allowHealthWrite:
        rawStateNeedsZeroHpDeathPersistence ||
        zeroHpDeathRepair.changed ||
        playableZeroRepair.changed ||
        staminaTick.deathTriggered,
    });
    await input.redis.primary.set!(
      stateKey,
      JSON.stringify(statusSnapshotState)
    );
  }
  return {
    ...createHarthmereLiveModePlayerStatusClientSnapshot(statusSnapshotState),
    backendAuthority: {
      source: "harthmere-live-mode-redis",
      role: "backend-runtime-cache",
      persisted: hasBackendRuntimeState,
      readOnlyProjection: false,
      repairedForSnapshot: statusReadRepair.changed,
      repairedZeroHpDeath:
        rawStateNeedsZeroHpDeathPersistence || zeroHpDeathRepair.changed,
      repairedPlayableZeroStamina: playableZeroRepair.changed,
      staminaPersisted: shouldPersist,
    },
  };
}

function rawHarthmereStatusStateHasZeroHpAlive(rawState: string | null) {
  if (!rawState) {
    return false;
  }
  try {
    const parsed = JSON.parse(rawState) as {
      combat?: { hp?: unknown; deathState?: unknown };
    };
    const rawHp = Number(parsed.combat?.hp);
    if (!Number.isFinite(rawHp)) {
      return false;
    }
    const deathState = String(parsed.combat?.deathState ?? "alive");
    return Math.max(0, Math.trunc(rawHp)) <= 0 && deathState === "alive";
  } catch {
    return false;
  }
}

function repairZeroHpAliveDeathForStatusRead(
  state: HarthmereLiveModeBackendState,
  input: { nowMs: number }
) {
  const hp = Math.max(0, Math.trunc(Number(state.combat.hp ?? 0)));
  const normalizedHpChanged = state.combat.hp !== hp;
  if (normalizedHpChanged) {
    state.combat.hp = hp;
  }
  if (hp > 0 || (state.combat.deathState ?? "alive") !== "alive") {
    return { changed: normalizedHpChanged };
  }

  state.combat.deathState = "dead";
  const deathId = `status_zero_hp_${Math.trunc(input.nowMs)}`;
  state.combat.deathRecords[deathId] ??= {
    deathId,
    cause: "zero_hp_status_repair",
    zoneId: "harthmere",
    atMs: input.nowMs,
    respawnAvailableAtMs: input.nowMs + 5_000,
  };
  return { changed: true };
}

function repairStalePlayableZeroStaminaForStatusRead(
  state: HarthmereLiveModeBackendState,
  input: { nowMs: number }
) {
  const maxStamina = Math.max(
    1,
    Number(state.combat.maxResources?.stamina ?? 100)
  );
  const stamina = Number(state.combat.resources?.stamina ?? maxStamina);
  const hp = Number(state.combat.hp ?? 0);
  if (
    hp > 0 &&
    (state.combat.deathState ?? "alive") === "alive" &&
    stamina < 1 &&
    !Number.isFinite(Number(state.combat.deadFromStaminaAtMs))
  ) {
    state.combat.resources ??= {};
    state.combat.maxResources ??= {};
    state.combat.maxResources.stamina = maxStamina;
    state.combat.resources.stamina = 0;
    state.combat.hp = 0;
    state.combat.deathState = "dead";
    state.combat.deadFromStaminaAtMs = input.nowMs;
    state.combat.lastStaminaTickMs = input.nowMs;
    const deathId = `stamina_depleted_${Math.trunc(input.nowMs)}`;
    state.combat.deathRecords[deathId] ??= {
      deathId,
      cause: "stamina_depleted",
      zoneId: "harthmere",
      atMs: input.nowMs,
      respawnAvailableAtMs: input.nowMs + 5_000,
    };
    return { changed: true };
  }
  return { changed: false };
}

function resetOfflineStaminaBackfillWindowForActiveStatusRead(
  state: HarthmereLiveModeBackendState,
  input: { nowMs: number; gameplayActive: boolean }
) {
  if (!input.gameplayActive) {
    return { changed: false };
  }
  const lastTick = Number(state.combat.lastStaminaTickMs);
  if (
    !Number.isFinite(lastTick) ||
    input.nowMs - lastTick <= STALE_ACTIVE_STAMINA_BACKFILL_MS
  ) {
    return { changed: false };
  }
  state.combat.lastStaminaTickMs = input.nowMs;
  return { changed: true };
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
  async ({ auth, unsafeRequest, unsafeResponse }) => {
    disableHarthmereLiveModeHttpCaching(unsafeResponse);
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
