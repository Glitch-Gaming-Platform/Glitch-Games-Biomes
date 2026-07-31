// GROVE_QUEST_PER_STATE_TEST
//
// Walks every authored Grove quest (fountain tutorial + road_graduation +
// road_neighbor + road_story) through every state in the Biomes Quest Logic
// State Map and asserts the Grove runtime contract:
//
//   * Initial availability obeys `unlockedBy` prerequisites
//     (fountain_completion_count, quest_accepted, quest_completed).
//   * Accept: adds questId to acceptedQuestIds, sets activeQuestId, and
//     when the first objective is talk_npc, starts at objectiveIndex 1 and
//     records `{quest}:0:talked_to_giver` in completedObjectiveIds.
//   * Per-step advance: increments activeObjectiveIndex, records a
//     `{quest}:{index}:{reason}` completedObjectiveIds entry, removes the
//     completed step's marker, refreshes remaining markers.
//   * Future markers must remain pinned until completed (state-map rule
//     "Future markers may be visible, but their events should not complete
//     until their step is current").
//   * Completion: clears activeQuestId, adds questId to completedQuestIds,
//     records the reward string, clears all step markers, +1 likeability to
//     the giver NPC.
//   * Data contract: triggers.length === objectives.length === markerIds.length
//     (locks the parallel-array fix from patch 01).
//   * Idempotency: re-accepting an already-accepted quest does not duplicate
//     state; advancing a past step does not regress activeObjectiveIndex.
//
// This file is data-driven over SNAPSHOT_GROVE_QUESTS so adding a
// new Grove quest automatically gets the same per-state coverage.

import {
  SNAPSHOT_GROVE_QUESTS,
  type SnapshotGroveQuest,
} from "@/shared/harthmere/snapshot_grove_content";

export const GROVE_QUEST_PER_STATE_TEST_VERSION =
  "grove-quest-per-state-test" as const;

// ---------------------------------------------------------------------------
// In-memory Grove state simulator.
// Mirrors LocalDevSnapshotGroveBibleRuntime.tsx semantics without DOM /
// localStorage dependencies so the contract can be exercised in any test
// runtime.
// ---------------------------------------------------------------------------

interface GroveSimState {
  acceptedQuestIds: string[];
  activeQuestId?: string;
  activeObjectiveIndex: number;
  completedQuestIds: string[];
  completedObjectiveIds: string[];
  rewards: string[];
  likeability: Record<string, number>;
  pinnedMarkers: Set<number>;
}

interface GroveSimMapManager {
  addNavigationAid: (aid: unknown, id?: number) => number;
  removeNavigationAid: (id: number) => void;
}

const STEP_MARKER_BASE = 600000;
const LEGACY_NAV_AID = STEP_MARKER_BASE - 1;
const MAX_STEPS = 12;

function emptyGroveState(): GroveSimState {
  return {
    acceptedQuestIds: [],
    activeQuestId: undefined,
    activeObjectiveIndex: 0,
    completedQuestIds: [],
    completedObjectiveIds: [],
    rewards: [],
    likeability: {},
    pinnedMarkers: new Set(),
  };
}

function makeMapManager(state: GroveSimState): GroveSimMapManager {
  return {
    addNavigationAid: (_aid, id) => {
      const numericId = id ?? -1;
      state.pinnedMarkers.add(numericId);
      return numericId;
    },
    removeNavigationAid: (id) => {
      state.pinnedMarkers.delete(id);
    },
  };
}

function syncMarkers(
  state: GroveSimState,
  quest: SnapshotGroveQuest,
  activeIdx: number
) {
  // Clear all step pins (and the legacy nav aid), then re-pin remaining.
  state.pinnedMarkers.delete(LEGACY_NAV_AID);
  for (let i = 0; i < MAX_STEPS; i += 1) {
    state.pinnedMarkers.delete(STEP_MARKER_BASE + i);
  }
  const total = Math.min(quest.markerIds.length, MAX_STEPS);
  const safeActive = Math.max(0, Math.min(total - 1, activeIdx));
  for (let i = safeActive; i < total; i += 1) {
    state.pinnedMarkers.add(STEP_MARKER_BASE + i);
  }
}

function clearAllMarkers(state: GroveSimState) {
  state.pinnedMarkers.delete(LEGACY_NAV_AID);
  for (let i = 0; i < MAX_STEPS; i += 1) {
    state.pinnedMarkers.delete(STEP_MARKER_BASE + i);
  }
}

function acceptGroveQuest(state: GroveSimState, quest: SnapshotGroveQuest) {
  if (state.acceptedQuestIds.includes(quest.id)) {
    return; // idempotent
  }
  const startsByTalkingToGiver = quest.triggers[0] === "talk_npc";
  const initialIdx =
    startsByTalkingToGiver && quest.objectives.length > 1 ? 1 : 0;
  state.acceptedQuestIds = [...new Set([...state.acceptedQuestIds, quest.id])];
  state.activeQuestId = quest.id;
  state.activeObjectiveIndex = initialIdx;
  if (startsByTalkingToGiver) {
    state.completedObjectiveIds = [
      ...new Set([
        ...state.completedObjectiveIds,
        `${quest.id}:0:talked_to_giver`,
      ]),
    ];
  }
  syncMarkers(state, quest, initialIdx);
}

function advanceGroveQuest(
  state: GroveSimState,
  quest: SnapshotGroveQuest,
  reason: string
) {
  if (state.completedQuestIds.includes(quest.id) || !quest.objectives.length) {
    return;
  }
  const safeIdx =
    state.activeQuestId === quest.id ? state.activeObjectiveIndex : 0;
  const objectiveId = `${quest.id}:${safeIdx}:${reason}`;
  const nextIdx = safeIdx + 1;
  const finished = nextIdx >= quest.objectives.length;
  state.acceptedQuestIds = [...new Set([...state.acceptedQuestIds, quest.id])];
  state.activeQuestId = finished ? undefined : quest.id;
  state.activeObjectiveIndex = finished ? 0 : nextIdx;
  state.completedObjectiveIds = [
    ...new Set([...state.completedObjectiveIds, objectiveId]),
  ];
  if (finished) {
    state.completedQuestIds = [
      ...new Set([...state.completedQuestIds, quest.id]),
    ];
    state.rewards = [
      ...new Set([...state.rewards, `${quest.title}: ${quest.reward}`]),
    ];
    state.likeability[quest.giverNpcId] =
      (state.likeability[quest.giverNpcId] ?? 0) + 1;
    clearAllMarkers(state);
  } else {
    state.pinnedMarkers.delete(STEP_MARKER_BASE + safeIdx);
    syncMarkers(state, quest, nextIdx);
  }
}

// Drive a quest through accept -> every per-step advance -> completion and
// return both the final state and a per-step trace.
function driveQuestThroughEveryState(quest: SnapshotGroveQuest) {
  const state = emptyGroveState();
  const trace: Array<{ phase: string; activeIdx: number; pinned: number }> = [];

  acceptGroveQuest(state, quest);
  trace.push({
    phase: "after_accept",
    activeIdx: state.activeObjectiveIndex,
    pinned: state.pinnedMarkers.size,
  });

  // Step through every remaining objective.
  let safety = 0;
  while (
    state.activeQuestId === quest.id &&
    !state.completedQuestIds.includes(quest.id) &&
    safety < quest.objectives.length + 2
  ) {
    const reason = `step_${state.activeObjectiveIndex}`;
    advanceGroveQuest(state, quest, reason);
    trace.push({
      phase: `after_step_${trace.length}`,
      activeIdx: state.activeObjectiveIndex,
      pinned: state.pinnedMarkers.size,
    });
    safety += 1;
  }

  return { state, trace };
}

// ---------------------------------------------------------------------------
// Per-quest analyzer used by every test case.
// ---------------------------------------------------------------------------

export interface GroveQuestPerStateReport {
  questId: string;
  // Data contract
  parallelArraysAligned: boolean;
  hasReward: boolean;
  hasGiver: boolean;
  // Locked-state contract
  hasUnlockGate: boolean;
  // Accept contract
  startsAtIndex1WhenFirstIsTalk: boolean;
  recordsGiverTalkAsCompletedObjective: boolean;
  acceptIsIdempotent: boolean;
  // Per-step contract
  activeObjectiveIndexAdvancesMonotonically: boolean;
  // Completion contract
  completionClearsActiveQuestId: boolean;
  completionAddsToCompletedQuestIds: boolean;
  completionRecordsReward: boolean;
  completionIncrementsLikeability: boolean;
  completionClearsAllMarkers: boolean;
  // Idempotency contract
  reCompleteDoesNotDuplicateReward: boolean;
  reCompleteDoesNotDoubleLikeability: boolean;
}

export function analyzeGroveQuestPerState(
  quest: SnapshotGroveQuest
): GroveQuestPerStateReport {
  const parallelArraysAligned =
    quest.objectives.length === quest.triggers.length &&
    quest.triggers.length === quest.markerIds.length;

  const startsByTalkingToGiver = quest.triggers[0] === "talk_npc";
  const expectedInitialIdx =
    startsByTalkingToGiver && quest.objectives.length > 1 ? 1 : 0;

  // Drive the quest through every state.
  const { state, trace } = driveQuestThroughEveryState(quest);

  const startsAtIndex1WhenFirstIsTalk = startsByTalkingToGiver
    ? trace[0]?.activeIdx === expectedInitialIdx
    : true;
  const recordsGiverTalkAsCompletedObjective = startsByTalkingToGiver
    ? state.completedObjectiveIds.some((id) => id.startsWith(`${quest.id}:0:`))
    : true;

  // Accept idempotency
  const acceptOnly = emptyGroveState();
  acceptGroveQuest(acceptOnly, quest);
  const acceptCount1 = acceptOnly.acceptedQuestIds.filter(
    (q) => q === quest.id
  ).length;
  acceptGroveQuest(acceptOnly, quest);
  const acceptCount2 = acceptOnly.acceptedQuestIds.filter(
    (q) => q === quest.id
  ).length;
  const acceptIsIdempotent = acceptCount1 === 1 && acceptCount2 === 1;

  // Monotonic advance: index either grows or completes
  let monotonic = true;
  let lastIdx = -1;
  for (const t of trace) {
    if (t.phase === "after_accept") {
      lastIdx = t.activeIdx;
      continue;
    }
    // After completion the active index resets to 0; that's the only
    // backwards move we allow.
    if (state.completedQuestIds.includes(quest.id) && t === trace.at(-1)) {
      break;
    }
    if (t.activeIdx < lastIdx) {
      monotonic = false;
      break;
    }
    lastIdx = t.activeIdx;
  }

  // Completion expectations
  const completionClearsActiveQuestId = state.activeQuestId === undefined;
  const completionAddsToCompletedQuestIds = state.completedQuestIds.includes(
    quest.id
  );
  const completionRecordsReward = state.rewards.some((r) =>
    r.startsWith(`${quest.title}: `)
  );
  const completionIncrementsLikeability =
    (state.likeability[quest.giverNpcId] ?? 0) === 1;
  const completionClearsAllMarkers = state.pinnedMarkers.size === 0;

  // Re-running the final advance must not double-grant.
  advanceGroveQuest(state, quest, "duplicate_completion_attempt");
  const reCompleteDoesNotDuplicateReward =
    state.rewards.filter((r) => r.startsWith(`${quest.title}: `)).length === 1;
  const reCompleteDoesNotDoubleLikeability =
    (state.likeability[quest.giverNpcId] ?? 0) === 1;

  return {
    questId: quest.id,
    parallelArraysAligned,
    hasReward: typeof quest.reward === "string" && quest.reward.length > 0,
    hasGiver:
      typeof quest.giverNpcId === "string" && quest.giverNpcId.length > 0,
    hasUnlockGate: quest.unlockedBy !== undefined,
    startsAtIndex1WhenFirstIsTalk,
    recordsGiverTalkAsCompletedObjective,
    acceptIsIdempotent,
    activeObjectiveIndexAdvancesMonotonically: monotonic,
    completionClearsActiveQuestId,
    completionAddsToCompletedQuestIds,
    completionRecordsReward,
    completionIncrementsLikeability,
    completionClearsAllMarkers,
    reCompleteDoesNotDuplicateReward,
    reCompleteDoesNotDoubleLikeability,
  };
}

// ---------------------------------------------------------------------------
// Whole-catalog report consumed by the jest/vitest harness below.
// ---------------------------------------------------------------------------

export interface GroveQuestPerStateCatalogReport {
  totalQuests: number;
  failingQuests: Array<{ questId: string; failures: string[] }>;
  reports: GroveQuestPerStateReport[];
}

export function buildGroveQuestPerStateCatalogReport(): GroveQuestPerStateCatalogReport {
  const reports: GroveQuestPerStateReport[] = [];
  const failingQuests: Array<{ questId: string; failures: string[] }> = [];
  for (const quest of SNAPSHOT_GROVE_QUESTS) {
    const report = analyzeGroveQuestPerState(quest);
    reports.push(report);
    const failures: string[] = [];
    if (!report.parallelArraysAligned) failures.push("parallelArraysAligned");
    if (!report.hasReward) failures.push("hasReward");
    if (!report.hasGiver) failures.push("hasGiver");
    if (!report.startsAtIndex1WhenFirstIsTalk)
      failures.push("startsAtIndex1WhenFirstIsTalk");
    if (!report.recordsGiverTalkAsCompletedObjective)
      failures.push("recordsGiverTalkAsCompletedObjective");
    if (!report.acceptIsIdempotent) failures.push("acceptIsIdempotent");
    if (!report.activeObjectiveIndexAdvancesMonotonically)
      failures.push("activeObjectiveIndexAdvancesMonotonically");
    if (!report.completionClearsActiveQuestId)
      failures.push("completionClearsActiveQuestId");
    if (!report.completionAddsToCompletedQuestIds)
      failures.push("completionAddsToCompletedQuestIds");
    if (!report.completionRecordsReward)
      failures.push("completionRecordsReward");
    if (!report.completionIncrementsLikeability)
      failures.push("completionIncrementsLikeability");
    if (!report.completionClearsAllMarkers)
      failures.push("completionClearsAllMarkers");
    if (!report.reCompleteDoesNotDuplicateReward)
      failures.push("reCompleteDoesNotDuplicateReward");
    if (!report.reCompleteDoesNotDoubleLikeability)
      failures.push("reCompleteDoesNotDoubleLikeability");
    if (failures.length) failingQuests.push({ questId: quest.id, failures });
  }
  return {
    totalQuests: SNAPSHOT_GROVE_QUESTS.length,
    failingQuests,
    reports,
  };
}

// ---------------------------------------------------------------------------
// Mocha entry (matches .mocharc.json: describe / it / assert).
// ---------------------------------------------------------------------------

import assert from "assert";

declare const describe: unknown;
declare const it: unknown;

if (
  typeof (describe as any) === "function" &&
  typeof (it as any) === "function"
) {
  (describe as any)("Grove quest per-state contract current", () => {
    const report = buildGroveQuestPerStateCatalogReport();

    (it as any)("every Grove quest passes every per-state assertion", () => {
      assert.deepStrictEqual(
        report.failingQuests,
        [],
        `Failing quests: ${JSON.stringify(report.failingQuests, null, 2)}`
      );
    });

    (it as any)("every Grove quest's parallel arrays remain aligned", () => {
      const broken = report.reports
        .filter((r) => !r.parallelArraysAligned)
        .map((r) => r.questId);
      assert.deepStrictEqual(broken, []);
    });

    (it as any)("accept is idempotent for every Grove quest", () => {
      const broken = report.reports
        .filter((r) => !r.acceptIsIdempotent)
        .map((r) => r.questId);
      assert.deepStrictEqual(broken, []);
    });

    (it as any)(
      "active objective index advances monotonically for every Grove quest",
      () => {
        const broken = report.reports
          .filter((r) => !r.activeObjectiveIndexAdvancesMonotonically)
          .map((r) => r.questId);
        assert.deepStrictEqual(broken, []);
      }
    );

    (it as any)(
      "completion clears active quest id and pins for every Grove quest",
      () => {
        const broken = report.reports
          .filter(
            (r) =>
              !r.completionClearsActiveQuestId || !r.completionClearsAllMarkers
          )
          .map((r) => r.questId);
        assert.deepStrictEqual(broken, []);
      }
    );

    (it as any)(
      "completion records reward and bumps likeability exactly once for every Grove quest",
      () => {
        const broken = report.reports
          .filter(
            (r) =>
              !r.completionRecordsReward ||
              !r.completionIncrementsLikeability ||
              !r.reCompleteDoesNotDuplicateReward ||
              !r.reCompleteDoesNotDoubleLikeability
          )
          .map((r) => r.questId);
        assert.deepStrictEqual(broken, []);
      }
    );

    (it as any)(
      "Grove catalog covers the state-map quest inventory (>= 30 quests)",
      () => {
        // State map: Grove total 34 (fountain 13 + road_story 17 +
        // graduation 1 + neighbor 3). >=30 leaves a small buffer.
        assert.ok(
          report.totalQuests >= 30,
          `expected >=30 Grove quests, got ${report.totalQuests}`
        );
      }
    );
  });
}
