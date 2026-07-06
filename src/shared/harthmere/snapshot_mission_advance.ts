// HARTHMERE_SNAPSHOT_MISSION_ADVANCE (2026-07-02)
//
// Order-independent, self-accepting advancement for the snapshot missions (the
// Road Ahead tutorial chain and the Grove quests).
//
// The previous event handler in LocalDevSnapshotCompletePort only advanced when
// an event matched the CURRENT step, in strict order, and only after the mission
// had been accepted. Because step 0 of Road Ahead is "Meet Jackie" (talk_npc),
// any out-of-order action — or a "Meet Jackie" talk event that never fired — left
// the mission stuck at step 0, unaccepted, forever. Live state confirmed this:
// the player had broken muckwad and reached the road post (recorded as raw
// `clearedMuckIds`) yet `acceptedMissionIds: []`, `activeStepIndex: 0`,
// `completedStepIds: []`.
//
// These pure helpers instead let ANY matching action complete its corresponding
// (earliest incomplete) step and auto-accept the mission, so the chain always
// makes progress regardless of the order the player does things in. They are
// dependency-free and unit-tested (see __tests__/snapshot_mission_advance.test.ts).

/** The mutable progress fields these helpers read/update (a subset of the store). */
export interface SnapshotMissionProgress {
  acceptedMissionIds: string[];
  activeMissionId?: string;
  activeStepIndex: number;
  completedStepIds: string[];
  completedMissionIds: string[];
  grantedItemIds?: string[];
  grantedRewardIds: string[];
}

/** The fields of a mission test-case/step these helpers need. */
export interface SnapshotMissionStep {
  id: string;
  questId: string;
  stepIndex: number;
  trigger: string;
  markerId?: string;
  expectedInventoryItems?: string[];
  expectedRewardIds?: string[];
}

export interface SnapshotMissionAdvance<S> {
  state: S;
  chosen: SnapshotMissionStep;
  completedMission: boolean;
  nextStepIndex: number;
}

export interface SnapshotMissionChooseOptions {
  canImplicitlyAcceptQuest?: (questId: string) => boolean;
}

function uniq<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/**
 * Pick the single best step to complete for an event, given a trigger matcher.
 * Preference order: (1) a step in the currently-active mission, (2) a step whose
 * markerId matches the event's marker, then (3) the earliest step index. Only
 * INCOMPLETE steps are considered, so repeating a "destroy" advances the next
 * uncompleted destroy step instead of re-completing an old one.
 */
export function chooseSnapshotMissionStep<T extends SnapshotMissionStep>(
  progress: Pick<
    SnapshotMissionProgress,
    "acceptedMissionIds" | "activeMissionId" | "completedStepIds"
  >,
  tests: readonly T[],
  matches: (test: T) => boolean,
  eventMarkerId?: string,
  options: SnapshotMissionChooseOptions = {}
): T | undefined {
  const done = new Set(progress.completedStepIds);
  const accepted = new Set(progress.acceptedMissionIds);
  const canImplicitlyAcceptQuest =
    options.canImplicitlyAcceptQuest ?? (() => true);
  const candidates = tests.filter((test) => {
    if (done.has(test.id) || !matches(test)) {
      return false;
    }
    return (
      test.questId === progress.activeMissionId ||
      accepted.has(test.questId) ||
      canImplicitlyAcceptQuest(test.questId)
    );
  });
  if (candidates.length === 0) {
    return undefined;
  }
  const score = (test: T): number =>
    (progress.activeMissionId && test.questId === progress.activeMissionId
      ? -1_000_000
      : 0) +
    (eventMarkerId && String(test.markerId) === String(eventMarkerId)
      ? -1_000
      : 0) +
    test.stepIndex;
  return candidates.slice().sort((a, b) => score(a) - score(b))[0];
}

/**
 * Apply completion of `chosen` to `progress`: mark the step complete, auto-accept
 * its mission, and move `activeStepIndex` to the first still-incomplete step of
 * that mission (completing the mission when none remain). Preserves every other
 * field on the state object (clearedMuckIds, audio log, etc.).
 */
export function advanceSnapshotMissionProgress<
  S extends SnapshotMissionProgress,
  T extends SnapshotMissionStep
>(progress: S, tests: readonly T[], chosen: T): SnapshotMissionAdvance<S> {
  const completedStepIds = uniq([...progress.completedStepIds, chosen.id]);
  const done = new Set(completedStepIds);
  const missionTests = tests
    .filter((test) => test.questId === chosen.questId)
    .slice()
    .sort((a, b) => a.stepIndex - b.stepIndex);
  const firstIncompleteIdx = missionTests.findIndex(
    (test) => !done.has(test.id)
  );
  const completedMission = firstIncompleteIdx < 0;
  const nextStepIndex = completedMission ? 0 : firstIncompleteIdx;
  const state: S = {
    ...progress,
    acceptedMissionIds: uniq([...progress.acceptedMissionIds, chosen.questId]),
    activeMissionId: completedMission ? undefined : chosen.questId,
    activeStepIndex: nextStepIndex,
    completedStepIds,
    completedMissionIds: completedMission
      ? uniq([...progress.completedMissionIds, chosen.questId])
      : progress.completedMissionIds,
    grantedItemIds: uniq([
      ...(progress.grantedItemIds ?? []),
      ...(chosen.expectedInventoryItems ?? []),
    ]),
    grantedRewardIds: uniq([
      ...progress.grantedRewardIds,
      ...(chosen.expectedRewardIds ?? []),
    ]),
  };
  return { state, chosen, completedMission, nextStepIndex };
}
