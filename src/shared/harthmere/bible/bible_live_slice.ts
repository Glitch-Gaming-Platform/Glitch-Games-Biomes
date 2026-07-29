// BIBLE_LIVE_SLICE
//
// Everything about a Bible quest that native ECS has no model for — and
// nothing else.
//
// The retired `HarthmereBibleQuestLiveSlice` carried a full parallel state
// machine: per-quest `runtime` records with their own state enum, per-objective
// progress counters, and a `grantedRewardIds` ledger. All three now live in
// native `Challenges` / `TriggerState`, so all three are gone from here.
//
// WHAT REMAINS, AND WHY EACH ONE CANNOT BE ECS
//   reputation   faction standing has no ECS component
//   cadence      "when did this player last finish this daily" is per-player
//                 metadata about a shared quest definition
//   choices      branch selection is narrative state, not world state
//   flags        story unlocks granted by rewards, consumed by the gate
//   titles       display-only, additive
//   thaedryn     per-player boss phase against a SHARED entity; writing it to
//                 the entity would leak one player's encounter into everyone's
//
// This list is mirrored in `BIBLE_NON_ECS_OWNED` and asserted by
// `bible_engine_contracts.test.ts`, so the slice cannot quietly grow back into
// a second state machine.

import type { HarthmereThaedrynBossState } from "@/shared/harthmere/thaedryn_boss";

export const BIBLE_LIVE_SLICE_VERSION = 1 as const;

/** Bumped when the migration reader below changes shape. */
export const BIBLE_SLICE_MIGRATION_VERSION = 1 as const;

/**
 * The real boss state, not a narrowed copy.
 *
 * `thaedryn_boss.ts` has ZERO imports, so taking the authoritative type costs
 * nothing in graph weight and removes a whole class of drift: an invented
 * narrower shape here silently loses `chainsRemaining`, `wakeAttackThreshold`
 * and `completed` on every round-trip through the slice, which would break the
 * wake-collapse rule after a single save/load.
 */
export type BibleThaedrynPhaseState = HarthmereThaedrynBossState;

export interface BibleLiveSlice {
  /** Faction -> accumulated standing. */
  reputation: Record<string, number>;
  /** questId -> completion time (ms). Read by the gate's cadence check. */
  lastCompletedAtMs: Record<string, number>;
  /** questId -> chosen branch id. */
  choices: Record<string, string>;
  /** Story flags from `rewards.unlocks`, consumed by `gate.requiredFlags`. */
  flags: string[];
  titles: string[];
  thaedryn?: BibleThaedrynPhaseState;
  /** Post-encounter town phase, once resolved. */
  townPhase?: string;
  /** Stamp so the one-time migration reader is idempotent. */
  migratedVersion?: number;
}

export function defaultBibleLiveSlice(): BibleLiveSlice {
  return {
    reputation: {},
    lastCompletedAtMs: {},
    choices: {},
    flags: [],
    titles: [],
  };
}

// ---------------------------------------------------------------------------
// Defensive deserializer.
//
// Old blobs predate this shape and a buggy or hostile client can post anything
// into it, so every field is re-validated rather than cast. Retained from the
// previous implementation, which had this right.
// ---------------------------------------------------------------------------

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberRecord(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== "object") return out;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const numeric = Number(raw);
    if (Number.isFinite(numeric)) out[key] = numeric;
  }
  return out;
}

function stringRecord(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!value || typeof value !== "object") return out;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "string") out[key] = raw;
  }
  return out;
}

export function normalizeBibleLiveSlice(raw: unknown): BibleLiveSlice {
  const defaults = defaultBibleLiveSlice();
  if (!raw || typeof raw !== "object") return defaults;
  const record = raw as Record<string, unknown>;
  const thaedryn =
    record.thaedryn && typeof record.thaedryn === "object"
      ? (record.thaedryn as BibleThaedrynPhaseState)
      : undefined;
  return {
    reputation: numberRecord(record.reputation),
    lastCompletedAtMs: numberRecord(record.lastCompletedAtMs),
    choices: stringRecord(record.choices),
    flags: stringArray(record.flags),
    titles: stringArray(record.titles),
    ...(thaedryn ? { thaedryn } : {}),
    ...(typeof record.townPhase === "string"
      ? { townPhase: record.townPhase }
      : {}),
    ...(Number.isFinite(Number(record.migratedVersion))
      ? { migratedVersion: Number(record.migratedVersion) }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// One-time migration from the retired Redis runtime.
//
// Reads the old `quests.bible` blob and produces (a) the new slice and (b) the
// native challenge/trigger state that has to be written alongside it. Ids do
// not move (see `bible_quest_id_pins.ts`), so this is a shape change only — no
// player loses progress.
//
// Idempotent behind `migratedVersion`. Safe to run on every load.
// ---------------------------------------------------------------------------

export interface BibleNativeProgressSeed {
  /** Quest ids to place in `challenges.complete`. */
  readonly completedQuestIds: readonly string[];
  /** Quest ids to place in `challenges.in_progress`. */
  readonly inProgressQuestIds: readonly string[];
  /** questId -> step ids already fired, for `trigger_state.by_root`. */
  readonly firedStepIdsByQuestId: Readonly<Record<string, readonly string[]>>;
}

export interface BibleSliceMigrationResult {
  readonly slice: BibleLiveSlice;
  readonly nativeProgress: BibleNativeProgressSeed;
  readonly migrated: boolean;
}

/**
 * `failed` and `abandoned` both collapse to "not started".
 *
 * Neither is observable to a player as a distinct state: the retired runtime
 * let both be re-accepted from scratch, and no authored quest can enter
 * `failed` at all (migration doc section 9.3). Dropping them loses nothing and
 * removes two states from the model.
 */
export function migrateRetiredBibleQuestState(
  rawLegacySlice: unknown,
  nowMs: number
): BibleSliceMigrationResult {
  const slice = normalizeBibleLiveSlice(rawLegacySlice);
  if (slice.migratedVersion === BIBLE_SLICE_MIGRATION_VERSION) {
    return {
      slice,
      nativeProgress: {
        completedQuestIds: [],
        inProgressQuestIds: [],
        firedStepIdsByQuestId: {},
      },
      migrated: false,
    };
  }

  const legacy = (rawLegacySlice ?? {}) as Record<string, unknown>;
  const runtime = (legacy.runtime ?? {}) as Record<string, any>;
  const completedQuestIds: string[] = [];
  const inProgressQuestIds: string[] = [];
  const firedStepIdsByQuestId: Record<string, string[]> = {};

  for (const [questId, record] of Object.entries(runtime)) {
    if (!record || typeof record !== "object") continue;
    const fired = Object.entries(record.objectiveProgress ?? {})
      .filter(([, progress]) => (progress as any)?.completed === true)
      .map(([stepId]) => stepId);
    switch (record.state) {
      case "completed":
        completedQuestIds.push(questId);
        break;
      case "active":
      case "ready_to_complete":
        inProgressQuestIds.push(questId);
        if (fired.length > 0) firedStepIdsByQuestId[questId] = fired;
        break;
      default:
        // locked / available / failed / abandoned -> nothing to seed.
        break;
    }
    if (record.chosenPath && typeof record.chosenPath === "string") {
      slice.choices[questId] = record.chosenPath;
    }
  }

  // Legacy completion stamps become the cadence ledger the gate now reads.
  // Repeatables previously had NO cooldown enforcement, so a legacy stamp is
  // the first one a player has ever had.
  for (const [questId, atMs] of Object.entries(
    numberRecord(legacy.completedAtMs)
  )) {
    slice.lastCompletedAtMs[questId] ??= atMs;
  }
  for (const questId of completedQuestIds) {
    slice.lastCompletedAtMs[questId] ??= nowMs;
  }

  slice.flags = [...new Set([...slice.flags, ...stringArray(legacy.flags)])];
  slice.titles = [...new Set([...slice.titles, ...stringArray(legacy.titles)])];
  if (!slice.thaedryn && legacy.thaedryn && typeof legacy.thaedryn === "object") {
    slice.thaedryn = legacy.thaedryn as BibleThaedrynPhaseState;
  }
  if (!slice.townPhase && typeof legacy.townPhase === "string") {
    slice.townPhase = legacy.townPhase;
  }
  slice.migratedVersion = BIBLE_SLICE_MIGRATION_VERSION;

  // `grantedRewardIds` is intentionally NOT carried. Native step completion is
  // idempotent by construction — `TriggerState.by_root` records a step id once,
  // so a re-submit sets a value that is already set and the completion branch
  // does not re-fire. A completed challenge already means "granted".
  return {
    slice,
    nativeProgress: {
      completedQuestIds,
      inProgressQuestIds,
      firedStepIdsByQuestId,
    },
    migrated: true,
  };
}
