// HARTHMERE_GLITCH_SERVER_STATE_CLOUD_SAVE
//
// Glitch Cloud Save historically stored the browser compatibility cache only.
// That cache is useful for appearance and legacy UI state, but the live game
// reads inventory, level, quest, banking, combat, and progression from the
// server-owned live-mode player record. If a rollout rebuilds that Redis record,
// copying the cloud payload back into localStorage does not restore gameplay.
//
// The save proxy now attaches the compact actor-owned live-mode record to slot
// 0 before it sends the payload to Glitch. On load, this module restores that
// signed/server-captured record only when the current actor record is missing or
// empty. Older production saves do not contain the server record, so the
// compatibility projector below recovers the core player-owned fields from the
// versioned/scoped localStorage keys that were actually shipped.

import { acquireHarthmereActorStateLock } from "@/server/harthmere/live_mode_actor_state_authority";
import {
  decideHarthmereRehydration,
  harthmereCloudSaveJsonRecords,
  harthmereServerPlayerStateHasMeaningfulProgress,
  isAcceptedHarthmereCloudSavePayloadVersion,
  type HarthmereRehydrationDecision,
  HARTHMERE_REHYDRATION_SOURCE_KEYS,
} from "@/shared/harthmere/harthmere_cloud_save_rehydration";
import {
  createHarthmereLiveModePlayerPersistenceState,
  defaultHarthmereLiveModeBackendState,
  harthmereLiveModePlayerStateKey,
  parseHarthmereLiveModeBackendState,
  stringifyHarthmereLiveModePlayerPersistenceState,
  type HarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";

export const HARTHMERE_GLITCH_SERVER_STATE_VERSION =
  "harthmere-glitch-server-player-state-v1" as const;

export interface HarthmereGlitchSaveRecord {
  version?: number;
  slot_index?: number;
  decoded_payload?: unknown;
}

export interface HarthmereCloudSaveRedisPrimary {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
}

export interface HarthmereCloudSaveRedis {
  primary: HarthmereCloudSaveRedisPrimary;
}

export type HarthmereActorStateAdoptionResult = {
  adopted: boolean;
  reason: string;
};

type ServerStateEnvelope = {
  version: typeof HARTHMERE_GLITCH_SERVER_STATE_VERSION;
  capturedAtMs: number;
  state: Record<string, unknown>;
};

type ParsedCloudPayload = {
  payloadVersion: string;
  schemaVersion?: string;
  storage: Readonly<Record<string, string>>;
  serverPlayerState?: Readonly<Record<string, unknown>>;
};

function jsonRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringRecord(value: unknown): Record<string, string> {
  const record = jsonRecord(value);
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}

export function parseHarthmereGlitchCloudPayload(
  value: unknown
): ParsedCloudPayload | undefined {
  const payload = jsonRecord(value);
  const payloadVersion = payload?.version;
  if (!isAcceptedHarthmereCloudSavePayloadVersion(payloadVersion)) {
    return undefined;
  }
  const serverEnvelope = jsonRecord(payload?.serverPlayerState);
  const serverPlayerState =
    serverEnvelope?.version === HARTHMERE_GLITCH_SERVER_STATE_VERSION
      ? jsonRecord(serverEnvelope.state)
      : undefined;
  return {
    payloadVersion,
    schemaVersion:
      typeof payload?.schemaAuditVersion === "string"
        ? payload.schemaAuditVersion
        : typeof payload?.schemaVersion === "string"
        ? payload.schemaVersion
        : undefined,
    storage: stringRecord(payload?.localStorage ?? payload?.storage),
    serverPlayerState,
  };
}

export function latestHarthmereGlitchCloudSave(
  saves: readonly HarthmereGlitchSaveRecord[]
) {
  return (
    saves
      // Slot versions are independent counters, so comparing version 12 in slot
      // 5 with version 11 in slot 0 is meaningless. Slot 0 is the authored player
      // snapshot; slot 90 is only the portable key/value compatibility blob.
      .filter(
        (save) =>
          (save.slot_index ?? 0) === 0 &&
          parseHarthmereGlitchCloudPayload(save.decoded_payload)
      )
      .slice()
      .sort(
        (left, right) => Number(right.version ?? 0) - Number(left.version ?? 0)
      )[0]
  );
}

function nonNegativeWhole(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : 0;
}

function recordCount(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value).length
    : 0;
}

function arrayCount(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function bestRecord(
  records: Array<{ key: string; value: Record<string, unknown> }>,
  score: (record: Record<string, unknown>) => number
) {
  return records
    .slice()
    .sort((left, right) => score(right.value) - score(left.value))[0]?.value;
}

function addItemRows(
  target: Record<string, number>,
  rows: unknown,
  equipment?: Record<string, string>,
  equipmentInstances?: Record<string, string>
) {
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    const item = jsonRecord(row);
    const itemId = typeof item?.itemId === "string" ? item.itemId : undefined;
    if (!itemId) continue;
    const count = Math.max(1, nonNegativeWhole(item?.quantity ?? 1));
    target[itemId] = (target[itemId] ?? 0) + count;
    const slot =
      typeof item?.equipmentSlot === "string" ? item.equipmentSlot : undefined;
    if (slot && equipment) {
      equipment[slot] = itemId;
      if (equipmentInstances && typeof item?.instanceId === "string") {
        equipmentInstances[slot] = item.instanceId;
      }
    }
  }
}

function addCompletedQuests(
  target: Record<string, number>,
  value: unknown,
  nowMs: number
) {
  if (Array.isArray(value)) {
    for (const questId of value) {
      if (typeof questId === "string" && questId) target[questId] = nowMs;
    }
    return;
  }
  const record = jsonRecord(value);
  if (!record) return;
  for (const [questId, completedAt] of Object.entries(record)) {
    target[questId] = Math.max(0, nonNegativeWhole(completedAt) || nowMs);
  }
}

function addActiveQuests(
  target: HarthmereLiveModeBackendState["quests"]["active"],
  value: unknown
) {
  const record = jsonRecord(value);
  if (!record) return;
  for (const [questId, raw] of Object.entries(record)) {
    const row = jsonRecord(raw);
    target[questId] = {
      progress: nonNegativeWhole(row?.progress ?? raw),
      ...(typeof row?.stepId === "string" ? { stepId: row.stepId } : {}),
      source: "glitch_cloud_save_legacy_projection",
    };
  }
}

/**
 * Recover core player-owned state from pre-server-snapshot saves. This is a
 * one-way migration, not a normal client-authority path: after the first
 * successful save, future restores use the exact compact server record.
 */
export function projectLegacyHarthmereCloudSaveToLiveModeState(input: {
  storage: Readonly<Record<string, string>>;
  actorId: string;
  nowMs: number;
}) {
  const state = defaultHarthmereLiveModeBackendState(
    input.actorId,
    input.nowMs
  );
  const keys = HARTHMERE_REHYDRATION_SOURCE_KEYS;

  const leveling = bestRecord(
    harthmereCloudSaveJsonRecords(input.storage, keys.levelingState),
    (record) =>
      nonNegativeWhole(record.level) * 1_000_000 +
      nonNegativeWhole(record.xpCurrent)
  );
  if (leveling) {
    const level = Math.max(1, nonNegativeWhole(leveling.level));
    const xp = nonNegativeWhole(leveling.xpCurrent);
    state.classMagic.skills.character_level = { level, xp };
    if (Array.isArray(leveling.unlockedAbilities)) {
      state.classMagic.knownAbilities = [
        ...new Set(
          leveling.unlockedAbilities.filter(
            (ability): ability is string => typeof ability === "string"
          )
        ),
      ];
    }
  }

  const inventory = bestRecord(
    harthmereCloudSaveJsonRecords(input.storage, keys.inventoryState),
    (record) => {
      const backpack = jsonRecord(record.backpack);
      const bank = jsonRecord(record.bank);
      const wallet = jsonRecord(record.wallet);
      return (
        arrayCount(backpack?.items) +
        arrayCount(record.questPouch) +
        arrayCount(bank?.items) +
        recordCount(record.materialStorage) +
        nonNegativeWhole(wallet?.gold)
      );
    }
  );
  if (inventory) {
    const backpack = jsonRecord(inventory.backpack);
    const bank = jsonRecord(inventory.bank);
    const wallet = jsonRecord(inventory.wallet);
    addItemRows(state.inventory.items, backpack?.items);
    addItemRows(state.inventory.items, inventory.questPouch);
    addItemRows(state.inventory.bank, bank?.items);
    const equipment = jsonRecord(inventory.equipment);
    for (const [slot, rawItem] of Object.entries(equipment ?? {})) {
      const item = jsonRecord(rawItem);
      if (typeof item?.itemId !== "string") continue;
      state.inventory.equipment[slot] = item.itemId;
      if (typeof item.instanceId === "string") {
        state.inventory.equipmentInstances[slot] = item.instanceId;
      }
    }
    state.inventory.gold = nonNegativeWhole(wallet?.gold);
    const materialStorage = jsonRecord(inventory.materialStorage);
    for (const [itemId, count] of Object.entries(materialStorage ?? {})) {
      const normalized = nonNegativeWhole(count);
      if (normalized > 0) state.banking.materialStorage[itemId] = normalized;
    }
    state.banking.personalBankMaxSlots = Math.max(
      state.banking.personalBankMaxSlots,
      nonNegativeWhole(bank?.maxSlots)
    );
  }

  const questState = bestRecord(
    harthmereCloudSaveJsonRecords(input.storage, keys.questState),
    (record) => recordCount(record.active) + arrayCount(record.completed)
  );
  if (questState) {
    addActiveQuests(state.quests.active, questState.active);
    addCompletedQuests(
      state.quests.completed,
      questState.completed,
      input.nowMs
    );
  }

  const grove = bestRecord(
    harthmereCloudSaveJsonRecords(input.storage, keys.snapshotGroveQuestState),
    (record) =>
      arrayCount(record.acceptedQuestIds) +
      arrayCount(record.completedQuestIds) +
      arrayCount(record.completedObjectiveIds)
  );
  if (grove) {
    for (const questId of Array.isArray(grove.acceptedQuestIds)
      ? grove.acceptedQuestIds
      : []) {
      if (typeof questId !== "string") continue;
      state.quests.active[questId] = {
        progress:
          grove.activeQuestId === questId
            ? nonNegativeWhole(grove.activeObjectiveIndex)
            : 0,
        source: "glitch_cloud_save_snapshot_grove",
      };
    }
    addCompletedQuests(
      state.quests.completed,
      grove.completedQuestIds,
      input.nowMs
    );
  }

  const mission = bestRecord(
    harthmereCloudSaveJsonRecords(input.storage, keys.snapshotMissionState),
    (record) =>
      recordCount(record.active) +
      arrayCount(record.completed) +
      arrayCount(record.completedStepIds)
  );
  if (mission) {
    addActiveQuests(state.quests.active, mission.active);
    addCompletedQuests(state.quests.completed, mission.completed, input.nowMs);
  }

  state.updatedAtMs = input.nowMs;
  return state;
}

export function enrichHarthmereGlitchSnapshotWithServerState(input: {
  snapshot: unknown;
  rawPlayerState: string | null | undefined;
  actorId: string;
  nowMs: number;
}) {
  const snapshot = jsonRecord(input.snapshot) ?? {};
  const state = parseHarthmereLiveModeBackendState(
    input.rawPlayerState,
    input.actorId,
    input.nowMs
  );
  const serverPlayerState: ServerStateEnvelope = {
    version: HARTHMERE_GLITCH_SERVER_STATE_VERSION,
    capturedAtMs: input.nowMs,
    state: createHarthmereLiveModePlayerPersistenceState(state),
  };
  return { ...snapshot, serverPlayerState };
}

/**
 * Move a pre-stable-identity player record onto the durable Glitch actor.
 *
 * Early builds wrote live progress under the numeric Biomes auth user while
 * current live-mode requests intentionally key on `glitch:<account>`. Cloud
 * Save can therefore contain a newer empty stable-actor snapshot even though
 * the numeric actor still owns the real inventory, levels, and quests. Copy
 * that source only when it has meaningful progress and the target does not.
 * The source is retained as a rollback copy; normal live-mode mutations may
 * remove it later through their transactional actor-adoption path.
 */
export async function adoptHarthmereActorStateIfTargetEmpty(input: {
  redis: HarthmereCloudSaveRedis;
  sourceActorId: string;
  targetActorId: string;
  nowMs: number;
}): Promise<HarthmereActorStateAdoptionResult> {
  if (
    !input.sourceActorId.trim() ||
    !input.targetActorId.trim() ||
    input.sourceActorId === input.targetActorId
  ) {
    return { adopted: false, reason: "actor ids do not require migration" };
  }

  const lock = await acquireHarthmereActorStateLock(
    input.redis.primary as any,
    input.targetActorId,
    { waitMs: 10_000, ttlMs: 30_000, retryMs: 20 }
  );
  if (!lock.acquired) {
    return { adopted: false, reason: "target actor authority lock timed out" };
  }

  try {
    const sourceKey = harthmereLiveModePlayerStateKey(input.sourceActorId);
    const targetKey = harthmereLiveModePlayerStateKey(input.targetActorId);
    const [sourceRaw, targetRaw] = await Promise.all([
      input.redis.primary.get(sourceKey),
      input.redis.primary.get(targetKey),
    ]);
    const targetState = parseHarthmereLiveModeBackendState(
      targetRaw,
      input.targetActorId,
      input.nowMs
    );
    if (
      harthmereServerPlayerStateHasMeaningfulProgress(
        createHarthmereLiveModePlayerPersistenceState(targetState)
      )
    ) {
      return {
        adopted: false,
        reason: "target actor has progress; target state always wins",
      };
    }

    const sourceState = parseHarthmereLiveModeBackendState(
      sourceRaw,
      input.sourceActorId,
      input.nowMs
    );
    if (
      !harthmereServerPlayerStateHasMeaningfulProgress(
        createHarthmereLiveModePlayerPersistenceState(sourceState)
      )
    ) {
      return {
        adopted: false,
        reason: "linked source actor has no meaningful progress",
      };
    }

    // Re-parse with the target actor id. This deliberately rewrites only the
    // player ownership identity; authored quest/challenge IDs remain exact
    // string keys and are never coerced to numbers or UUIDs.
    const adoptedState = parseHarthmereLiveModeBackendState(
      sourceRaw,
      input.targetActorId,
      input.nowMs
    );
    adoptedState.updatedAtMs = input.nowMs;
    await input.redis.primary.set(
      targetKey,
      stringifyHarthmereLiveModePlayerPersistenceState(adoptedState)
    );
    return { adopted: true, reason: "linked Biomes actor progress adopted" };
  } finally {
    await lock.release();
  }
}

export type HarthmereCloudRehydrationResult = {
  restored: boolean;
  source?: "server_player_state" | "legacy_browser_projection";
  saveVersion?: number;
  decision: HarthmereRehydrationDecision;
};

export async function rehydrateHarthmereActorFromGlitchSaves(input: {
  redis: HarthmereCloudSaveRedis;
  actorId: string;
  saves: readonly HarthmereGlitchSaveRecord[];
  nowMs: number;
}): Promise<HarthmereCloudRehydrationResult> {
  const latest = latestHarthmereGlitchCloudSave(input.saves);
  const payload = parseHarthmereGlitchCloudPayload(latest?.decoded_payload);
  if (!latest || !payload) {
    return {
      restored: false,
      decision: { rehydrate: false, reason: "no valid cloud save available" },
    };
  }

  const lock = await acquireHarthmereActorStateLock(
    input.redis.primary as any,
    input.actorId,
    { waitMs: 10_000, ttlMs: 30_000, retryMs: 20 }
  );
  if (!lock.acquired) {
    return {
      restored: false,
      decision: { rehydrate: false, reason: "actor authority lock timed out" },
    };
  }

  try {
    const playerStateKey = harthmereLiveModePlayerStateKey(input.actorId);
    const currentRaw = await input.redis.primary.get(playerStateKey);
    const currentState = parseHarthmereLiveModeBackendState(
      currentRaw,
      input.actorId,
      input.nowMs
    );
    const currentCompact =
      createHarthmereLiveModePlayerPersistenceState(currentState);
    const alreadyRehydratedFromVersion = nonNegativeWhole(
      (currentCompact as any).rehydratedFromCloudSaveVersion
    );
    const fallbackState = payload.serverPlayerState
      ? undefined
      : projectLegacyHarthmereCloudSaveToLiveModeState({
          storage: payload.storage,
          actorId: input.actorId,
          nowMs: input.nowMs,
        });
    const restoredState = payload.serverPlayerState
      ? parseHarthmereLiveModeBackendState(
          JSON.stringify(payload.serverPlayerState),
          input.actorId,
          input.nowMs
        )
      : fallbackState!;
    const restoredCompact =
      createHarthmereLiveModePlayerPersistenceState(restoredState);
    const saveVersion = nonNegativeWhole(latest.version);
    const decision = decideHarthmereRehydration({
      playerRecordExists: currentRaw !== null,
      playerRecordHasProgress:
        harthmereServerPlayerStateHasMeaningfulProgress(currentCompact),
      isGuest: false,
      cloudSave: {
        version: saveVersion,
        payloadVersion: payload.payloadVersion,
        schemaVersion: payload.schemaVersion,
        storage: payload.storage,
        serverPlayerState: restoredCompact,
      },
      alreadyRehydratedFromVersion:
        alreadyRehydratedFromVersion > 0
          ? alreadyRehydratedFromVersion
          : undefined,
    });
    if (!decision.rehydrate) {
      return { restored: false, saveVersion, decision };
    }

    (restoredState as any).rehydratedFromCloudSaveVersion = saveVersion;
    (restoredState as any).rehydratedAtMs = input.nowMs;
    restoredState.updatedAtMs = input.nowMs;
    await input.redis.primary.set(
      playerStateKey,
      stringifyHarthmereLiveModePlayerPersistenceState(restoredState)
    );
    return {
      restored: true,
      source: payload.serverPlayerState
        ? "server_player_state"
        : "legacy_browser_projection",
      saveVersion,
      decision,
    };
  } finally {
    await lock.release();
  }
}
