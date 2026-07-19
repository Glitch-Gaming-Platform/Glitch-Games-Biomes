import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { readHarthmereRedisStrings } from "@/server/harthmere/live_mode_state_read_helpers";
import { resolveHarthmereLiveModeActorId } from "@/server/harthmere/live_mode_actor_resolution";
import { disableHarthmereLiveModeHttpCaching } from "@/server/harthmere/live_mode_http_cache";
import {
  acquireHarthmereActorStateLock,
  compareAndSetHarthmereActorState,
  type HarthmereActorStateAuthorityRedis,
} from "@/server/harthmere/live_mode_actor_state_authority";
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

export async function readHarthmereLiveModePlayerStatusStateForActor<
  TPrimary extends {
    get: (key: string) => Promise<string | null>;
    mget?: (...keys: string[]) => Promise<Array<string | null>>;
  }
>(input: {
  redis: {
    primary: TPrimary;
  };
  actorId: string;
  nowMs: number;
  gameplayActive?: boolean;
}) {
  const stateKey = harthmereLiveModePlayerStateKey(input.actorId);
  const primary = input.redis.primary as TPrimary & {
    set?: (...args: any[]) => Promise<unknown>;
    eval?: (...args: any[]) => Promise<unknown>;
  };
  const canPersist = typeof primary.set === "function";
  const actorLock = canPersist
    ? await acquireHarthmereActorStateLock(
        primary as HarthmereActorStateAuthorityRedis,
        input.actorId,
        {
          // HUD polling must never queue behind a gameplay mutation. If the
          // actor is busy, return the latest durable projection immediately and
          // let the next poll advance stamina.
          waitMs: 75,
          ttlMs: 10_000,
          retryMs: 10,
        }
      )
    : {
        acquired: true,
        supported: false,
        waitedMs: 0,
        release: async () => {},
      };

  if (!actorLock.acquired) {
    const [rawState] = await readHarthmereRedisStrings(primary, [stateKey]);
    const state = parseHarthmereLiveModeBackendState(
      rawState,
      input.actorId,
      input.nowMs
    );
    return {
      ...createHarthmereLiveModePlayerStatusClientSnapshot(state),
      backendAuthority: {
        source: "harthmere-live-mode-redis",
        role: "backend-runtime-cache",
        persisted: rawState !== null,
        readOnlyProjection: true,
        actorLockWaitMs: actorLock.waitedMs,
        repairedForSnapshot: false,
        repairedZeroHpDeath: false,
        repairedPlayableZeroStamina: false,
        revivedStaminaDeathOnRecovery: false,
        staminaPersisted: false,
      },
    };
  }

  try {
    // The actor lock is the single-writer authority shared with live_mode POST
    // mutations. Read only after acquiring it so every field starts from the
    // newest inventory/equipment/quest/drop document.
    const [rawState] = await readHarthmereRedisStrings(primary, [stateKey]);
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
    const staminaRecoveredRevive =
      reviveStaleStaminaDeathWhenStaminaRecoveredForStatusRead(state, {
        nowMs: input.nowMs,
      });
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
      canPersist &&
      (statusReadRepair.changed ||
        rawStateNeedsZeroHpDeathPersistence ||
        zeroHpDeathRepair.changed ||
        playableZeroRepair.changed ||
        staminaRecoveredRevive.changed ||
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
    let staminaPersisted = false;
    let compareAndSetConflict = false;
    if (shouldPersist && rawState !== null) {
      state.updatedAtMs = input.nowMs;
      staminaPersisted = await compareAndSetHarthmereActorState(
        primary as HarthmereActorStateAuthorityRedis,
        stateKey,
        rawState,
        JSON.stringify(state)
      );
      if (!staminaPersisted) {
        // An old rolling-deploy replica may not honor the new actor lock. CAS
        // still guarantees this status poll cannot overwrite its newer
        // inventory/equipment/drop state.
        compareAndSetConflict = true;
        const latestRawState = await primary.get(stateKey);
        statusSnapshotState = parseHarthmereLiveModeBackendState(
          latestRawState,
          input.actorId,
          input.nowMs
        );
      }
    }
    return {
      ...createHarthmereLiveModePlayerStatusClientSnapshot(statusSnapshotState),
      backendAuthority: {
        source: "harthmere-live-mode-redis",
        role: "backend-runtime-cache",
        persisted: hasBackendRuntimeState,
        readOnlyProjection: false,
        actorLockSupported: actorLock.supported,
        actorLockWaitMs: actorLock.waitedMs,
        compareAndSetConflict,
        repairedForSnapshot: statusReadRepair.changed,
        repairedZeroHpDeath:
          rawStateNeedsZeroHpDeathPersistence || zeroHpDeathRepair.changed,
        repairedPlayableZeroStamina: playableZeroRepair.changed,
        revivedStaminaDeathOnRecovery: staminaRecoveredRevive.changed,
        staminaPersisted,
      },
    };
  } finally {
    await actorLock.release();
  }
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

function harthmereDeathRecordLooksStaminaCaused(
  deathId: string,
  record: { cause?: unknown } | undefined
) {
  const normalizedCause = String(record?.cause ?? "")
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  const normalizedDeathId = deathId.toLowerCase().replace(/[_-]+/g, " ");
  return (
    /\bstamina\b/.test(normalizedCause) || /\bstamina\b/.test(normalizedDeathId)
  );
}

// Inverse of the repair above. A player who was downed/killed PURELY by stamina
// depletion (deadFromStaminaAtMs is set) stays flagged dead (deathState="dead",
// hp=0) even after stamina fully regenerates; nothing clears the latch, so the
// client reads hp<=0 forever and loops death -> respawn -> death (the "randomly
// dying while stamina is full" report; player_status showed hp:0 / deathState
// "dead" / lastDeath "Stamina reached zero" with stamina at 107.8/108).
//
// When stamina has recovered to a playable level, auto-revive: restore hp,
// mark alive, and clear the stamina-death latch (deadFromStaminaAtMs + the
// stamina death records) so the client stops re-asserting death. This is the
// missing half that the `repairedPlayableZeroStamina` authority flag implies.
function reviveStaleStaminaDeathWhenStaminaRecoveredForStatusRead(
  state: HarthmereLiveModeBackendState,
  input: { nowMs: number }
) {
  const maxStamina = Math.max(
    1,
    Number(state.combat.maxResources?.stamina ?? 100)
  );
  const stamina = Number(state.combat.resources?.stamina ?? 0);
  const hp = Number(state.combat.hp ?? 0);
  const deathState = state.combat.deathState ?? "alive";
  const deadFromStamina = Number.isFinite(
    Number(state.combat.deadFromStaminaAtMs)
  );
  // Only touch deaths that were caused by stamina depletion. Combat / fall /
  // drowning deaths must still require an explicit respawn.
  if (!deadFromStamina) {
    return { changed: false };
  }
  const isDeadOrDowned =
    deathState === "dead" || deathState === "downed" || hp <= 0;
  if (!isDeadOrDowned) {
    return { changed: false };
  }
  const records = state.combat.deathRecords ?? {};
  const deathRecordEntries = Object.entries(records);
  const staminaDeathRecordIds = deathRecordEntries
    .filter(([deathId, record]) =>
      harthmereDeathRecordLooksStaminaCaused(deathId, record)
    )
    .map(([deathId]) => deathId);
  // The deadFromStaminaAtMs latch is the primary signal, but stale states can
  // carry mixed death records. When records exist, require at least one
  // stamina-caused record so a fall/combat death is not auto-revived just
  // because the old stamina latch was never cleared.
  if (deathRecordEntries.length > 0 && staminaDeathRecordIds.length === 0) {
    return { changed: false };
  }
  // Require a genuine recovery (>= 25% of max, matching the respawn baseline) so
  // a player hovering at zero stamina is not revived only to instantly re-die.
  const playableThreshold = Math.max(1, maxStamina * 0.25);
  if (stamina < playableThreshold) {
    return { changed: false };
  }
  const maxHp = Math.max(1, Number(state.combat.maxHp ?? 100));
  state.combat.hp = maxHp;
  state.combat.deathState = "alive";
  state.combat.deadFromStaminaAtMs = undefined;
  state.combat.lastStaminaTickMs = input.nowMs;
  state.combat.respawnProtectionUntilMs = Math.max(
    Number(state.combat.respawnProtectionUntilMs ?? 0),
    input.nowMs + 3_000
  );
  // Drop the stamina-caused death records so the client's derived `lastDeath`
  // no longer surfaces a stale "Stamina reached zero" downed state.
  for (const deathId of staminaDeathRecordIds) {
    delete records[deathId];
  }
  return { changed: true };
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
