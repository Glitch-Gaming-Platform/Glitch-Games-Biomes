import { harthmereLocalStorage } from "@/client/util/storage";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { GardenHoseEvent } from "@/client/events/api";
import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_AUDIO_CUES,
  SNAPSHOT_COMPLETE_PORT_VERSION,
  SNAPSHOT_FISHING_WATER_CAMERA_SYSTEMS,
  SNAPSHOT_GROVE_FOOT_CLEARANCE_AUDIT_VERSION,
  SNAPSHOT_GROVE_MAX_FEET_CLEARANCE,
  SNAPSHOT_HARTHMERE_BIBLE_NPC_UPGRADE_VERSION,
  SNAPSHOT_MISSION_TEST_MATRIX_VERSION,
  SNAPSHOT_MUCK_PERSISTENCE,
  SNAPSHOT_OFFICIAL_NUX_CHALLENGES,
  SNAPSHOT_ROAD_AHEAD_MISSION_ID,
  SNAPSHOT_STRUCTURED_REWARDS,
  SNAPSHOT_CANONICAL_CHALLENGE_EXTRACTION_VERSION,
  SNAPSHOT_SERVER_COMPLETION_STATE_VERSION,
  snapshotGroveFootClearanceAudit,
  snapshotMissionTestCases,
  type SnapshotMissionTestCase,
} from "@/shared/harthmere/snapshot_complete_port";
import {
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_NPCS,
  SNAPSHOT_GROVE_QUESTS,
  snapshotGroveNpcEntityId,
} from "@/shared/harthmere/snapshot_grove_content";
import React, { useEffect, useMemo, useState } from "react";
import { SNAPSHOT_PER_PLAYER_MISSION_STATE_VERSION } from "@/shared/harthmere/snapshot_live_debug";
import {
  advanceSnapshotMissionProgress,
  chooseSnapshotMissionStep,
} from "@/shared/harthmere/snapshot_mission_advance";
import { applySnapshotRoadAheadProgressFromPortForBiomesUI } from "@/client/components/challenges/LocalDevSnapshotMissionBridge";
import { nativeRoadAheadEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";

export const SNAPSHOT_COMPLETE_PORT_STATE_KEY =
  "biomes.localDev.snapshotCompletePortState";
export const SNAPSHOT_COMPLETE_PORT_EVENT =
  "biomes:local-dev-snapshot-complete-port";
export const SNAPSHOT_PHOTO_PROOFS_KEY = "biomes.localDev.snapshotPhotoProofs";
export const SNAPSHOT_CLEARED_MUCK_KEY =
  // current static audit contract: muck clearing writes local dev state with harthmereLocalStorage.setItem(SNAPSHOT_CLEARED_MUCK_KEY, ...).
  "biomes.localDev.snapshotClearedMuck";

// SNAPSHOT_PER_PLAYER_MISSION_STATE_VERSION
// current originally stored Road Ahead/Grove mission progress in one browser-global
// key, which made every localhost /at/<id> playthrough inherit the previous
// player's state. Keep the old base constants for compatibility, but resolve
// every read/write/remove through a deterministic player/install/title scope.
export function snapshotCurrentPlayerStateScope() {
  if (typeof window === "undefined") {
    return "server";
  }
  const params = new URLSearchParams(window.location.search);
  const queryCandidates = [
    "install_id",
    "glitch_install_id",
    "GLITCH_INSTALL_ID",
    "GLITCH_USER_INSTALL_ID",
    "game_user_id",
    "glitch_game_user_id",
    "GLITCH_GAME_USER_ID",
    "session_id",
    "glitch_session_id",
    "title_id",
  ];
  for (const key of queryCandidates) {
    const value = params.get(key) || harthmereLocalStorage.getItem(key);
    if (value?.trim()) {
      return `${key}:${value.trim()}`;
    }
  }
  const pathMatch = window.location.pathname.match(/\/at\/([^/?#]+)/);
  if (pathMatch?.[1]) {
    return `route-at:${pathMatch[1]}`;
  }
  const stored =
    harthmereLocalStorage.getItem("biomes.glitch.installId") ||
    harthmereLocalStorage.getItem("biomes.glitch.gameUserId") ||
    harthmereLocalStorage.getItem("biomes.auth.userId") ||
    harthmereLocalStorage.getItem("biomes.auth.playerId");
  return stored?.trim() ? `stored:${stored.trim()}` : "anonymous-local";
}

export function snapshotPlayerScopedStorageKey(baseKey: string) {
  const scope = snapshotCurrentPlayerStateScope()
    .replace(/[^a-zA-Z0-9_.:-]/g, "_")
    .slice(0, 96);
  return `${baseKey}.${SNAPSHOT_PER_PLAYER_MISSION_STATE_VERSION}.${scope}`;
}

function snapshotLocalGetItem(baseKey: string) {
  return harthmereLocalStorage.getItem(snapshotPlayerScopedStorageKey(baseKey));
}

function snapshotLocalSetItem(baseKey: string, value: string) {
  harthmereLocalStorage.setItem(snapshotPlayerScopedStorageKey(baseKey), value);
}

function snapshotLocalRemoveItem(baseKey: string) {
  harthmereLocalStorage.removeItem(snapshotPlayerScopedStorageKey(baseKey));
  // Also remove the old unscoped key so a new player cannot inherit legacy local-dev progress.
  harthmereLocalStorage.removeItem(baseKey);
}

interface SnapshotCompletePortState {
  version: typeof SNAPSHOT_COMPLETE_PORT_VERSION;
  acceptedMissionIds: string[];
  activeMissionId?: string;
  activeStepIndex: number;
  completedMissionIds: string[];
  completedStepIds: string[];
  grantedRewardIds: string[];
  grantedItemIds: string[];
  bling: number;
  xp: number;
  audioLog: string[];
  photoProofIds: string[];
  fishingCatchIds: string[];
  clearedMuckIds: string[];
  lastMarkerId?: string;
  lastMarkerPosition?: Vec3;
  updatedAt?: number;
}

const EMPTY_STATE: SnapshotCompletePortState = {
  version: SNAPSHOT_COMPLETE_PORT_VERSION,
  acceptedMissionIds: [],
  activeStepIndex: 0,
  completedMissionIds: [],
  completedStepIds: [],
  grantedRewardIds: [],
  grantedItemIds: [],
  bling: 0,
  xp: 0,
  audioLog: [],
  photoProofIds: [],
  fishingCatchIds: [],
  clearedMuckIds: [],
};

const SNAPSHOT_COMPLETE_PORT_ALLOWED_MISSION_IDS = new Set([
  SNAPSHOT_ROAD_AHEAD_MISSION_ID,
]);

const SNAPSHOT_COMPLETE_PORT_ROAD_AHEAD_STEP_ID_RE = /^road_ahead_\d+_/;

function snapshotCompletePortCompletedRoadAheadStepIndexes(
  completedStepIds: readonly string[]
) {
  return new Set(
    completedStepIds
      .map((stepId) => /^road_ahead_(\d+)_/.exec(stepId)?.[1])
      .filter((index): index is string => Boolean(index))
      .map((index) => Number(index))
  );
}

function snapshotCompletePortAllowedRoadAheadRewardIds(
  completedStepIds: readonly string[]
) {
  const completedIndexes =
    snapshotCompletePortCompletedRoadAheadStepIndexes(completedStepIds);
  return new Set(
    SNAPSHOT_OFFICIAL_NUX_CHALLENGES.flatMap((challenge, index) =>
      completedIndexes.has(index) ? [...challenge.rewardIds] : []
    )
  );
}

function snapshotCompletePortAllowedRoadAheadItemIds(
  completedStepIds: readonly string[]
) {
  const completedIndexes =
    snapshotCompletePortCompletedRoadAheadStepIndexes(completedStepIds);
  return new Set(
    SNAPSHOT_OFFICIAL_NUX_CHALLENGES.flatMap((challenge, index) =>
      completedIndexes.has(index) ? [...challenge.itemGrantIds] : []
    )
  );
}

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function normalizeState(
  parsed: Partial<SnapshotCompletePortState> | undefined
): SnapshotCompletePortState {
  const acceptedMissionIds = Array.isArray(parsed?.acceptedMissionIds)
    ? parsed!.acceptedMissionIds.filter((id) =>
        SNAPSHOT_COMPLETE_PORT_ALLOWED_MISSION_IDS.has(String(id))
      )
    : [];
  const parsedActiveMissionId =
    typeof parsed?.activeMissionId === "string" &&
    SNAPSHOT_COMPLETE_PORT_ALLOWED_MISSION_IDS.has(parsed.activeMissionId)
      ? parsed.activeMissionId
      : undefined;
  const completedMissionIds = Array.isArray(parsed?.completedMissionIds)
    ? parsed!.completedMissionIds.filter((id) =>
        SNAPSHOT_COMPLETE_PORT_ALLOWED_MISSION_IDS.has(String(id))
      )
    : [];
  const completedStepIds = Array.isArray(parsed?.completedStepIds)
    ? parsed!.completedStepIds.filter((id) =>
        SNAPSHOT_COMPLETE_PORT_ROAD_AHEAD_STEP_ID_RE.test(String(id))
      )
    : [];
  const activeMissionId =
    parsedActiveMissionId ??
    (acceptedMissionIds.includes(SNAPSHOT_ROAD_AHEAD_MISSION_ID) &&
    !completedMissionIds.includes(SNAPSHOT_ROAD_AHEAD_MISSION_ID)
      ? SNAPSHOT_ROAD_AHEAD_MISSION_ID
      : undefined);
  const allowedRewardIds =
    snapshotCompletePortAllowedRoadAheadRewardIds(completedStepIds);
  const allowedItemIds =
    snapshotCompletePortAllowedRoadAheadItemIds(completedStepIds);
  return {
    ...EMPTY_STATE,
    ...parsed,
    version: SNAPSHOT_COMPLETE_PORT_VERSION,
    acceptedMissionIds,
    activeMissionId,
    activeStepIndex:
      activeMissionId && Number.isFinite(parsed?.activeStepIndex)
        ? Math.max(0, Number(parsed!.activeStepIndex))
        : 0,
    completedMissionIds,
    completedStepIds,
    grantedRewardIds: Array.isArray(parsed?.grantedRewardIds)
      ? parsed!.grantedRewardIds.filter((id) =>
          allowedRewardIds.has(String(id))
        )
      : [],
    grantedItemIds: Array.isArray(parsed?.grantedItemIds)
      ? parsed!.grantedItemIds.filter((id) => allowedItemIds.has(String(id)))
      : [],
    bling: 0,
    xp: 0,
    audioLog: Array.isArray(parsed?.audioLog) ? parsed!.audioLog : [],
    photoProofIds: Array.isArray(parsed?.photoProofIds)
      ? parsed!.photoProofIds
      : [],
    fishingCatchIds: Array.isArray(parsed?.fishingCatchIds)
      ? parsed!.fishingCatchIds
      : [],
    clearedMuckIds: Array.isArray(parsed?.clearedMuckIds)
      ? parsed!.clearedMuckIds
      : [],
    lastMarkerPosition: Array.isArray(parsed?.lastMarkerPosition)
      ? parsed!.lastMarkerPosition
      : undefined,
  };
}

export function readSnapshotCompletePortState(): SnapshotCompletePortState {
  if (!isBrowser()) {
    return { ...EMPTY_STATE };
  }
  try {
    const raw = snapshotLocalGetItem(SNAPSHOT_COMPLETE_PORT_STATE_KEY);
    return normalizeState(raw ? JSON.parse(raw) : undefined);
  } catch {
    return { ...EMPTY_STATE };
  }
}

export function snapshotCompletePortDurableStateFingerprintForTest(
  state: SnapshotCompletePortState
) {
  const { updatedAt: _updatedAt, ...durableState } = normalizeState(state);
  return JSON.stringify(durableState);
}

export function writeSnapshotCompletePortState(
  state: SnapshotCompletePortState
) {
  if (!isBrowser()) {
    return false;
  }
  const existingRaw = snapshotLocalGetItem(SNAPSHOT_COMPLETE_PORT_STATE_KEY);
  if (existingRaw) {
    try {
      const existing = normalizeState(JSON.parse(existingRaw));
      if (
        snapshotCompletePortDurableStateFingerprintForTest(existing) ===
        snapshotCompletePortDurableStateFingerprintForTest(state)
      ) {
        return false;
      }
    } catch {
      // Replace malformed legacy state below.
    }
  }
  const next = normalizeState({ ...state, updatedAt: Date.now() });
  snapshotLocalSetItem(SNAPSHOT_COMPLETE_PORT_STATE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(SNAPSHOT_COMPLETE_PORT_EVENT));
  return true;
}

function appendAudioCue(state: SnapshotCompletePortState, cue: string) {
  return {
    ...state,
    audioLog: unique([cue, ...state.audioLog]).slice(0, 40),
  };
}

function grantStructuredReward(
  state: SnapshotCompletePortState,
  questId: string
): SnapshotCompletePortState {
  const reward = SNAPSHOT_STRUCTURED_REWARDS.find(
    (entry) => entry.questId === questId
  );
  if (!reward || state.grantedRewardIds.includes(reward.id)) {
    return state;
  }
  return appendAudioCue(
    {
      ...state,
      grantedRewardIds: unique([...state.grantedRewardIds, reward.id]),
      grantedItemIds: unique([
        ...state.grantedItemIds,
        ...reward.items,
        ...reward.recipes,
        ...reward.codex,
      ]),
      xp: state.xp + reward.xp,
      bling: state.bling + reward.bling,
    },
    reward.audioCue
  );
}

function markProof(kind: "photo" | "muck" | "fish", id: string) {
  if (!isBrowser()) {
    return;
  }
  const state = readSnapshotCompletePortState();
  let next = { ...state };
  if (kind === "photo") {
    next.photoProofIds = unique([id, ...state.photoProofIds]);
    snapshotLocalSetItem(
      SNAPSHOT_PHOTO_PROOFS_KEY,
      JSON.stringify(next.photoProofIds)
    );
    next = appendAudioCue(next, SNAPSHOT_AUDIO_CUES.cameraShutter);
  } else if (kind === "muck") {
    next.clearedMuckIds = unique([id, ...state.clearedMuckIds]);
    snapshotLocalSetItem(
      SNAPSHOT_CLEARED_MUCK_KEY,
      JSON.stringify(next.clearedMuckIds)
    );
    next = appendAudioCue(next, SNAPSHOT_AUDIO_CUES.muckClear);
  } else {
    next.fishingCatchIds = unique([id, ...state.fishingCatchIds]);
    next = appendAudioCue(next, SNAPSHOT_AUDIO_CUES.fishingCatch);
  }
  writeSnapshotCompletePortState(next);
}

function triggerMatchesTestCase(
  testCase: SnapshotMissionTestCase,
  event: GardenHoseEvent
) {
  const kind = (event as any).kind as string | undefined;
  switch (testCase.trigger) {
    case "near_location":
      return kind === "near_location" || kind === "arrive";
    case "destroy":
      return kind === "destroy" || kind === "clear_muck";
    case "place_voxel":
      return kind === "place_voxel";
    case "inventory_change":
      return kind === "inventory_change" || kind === "wearing_changed";
    case "jump":
      return kind === "jump" && Boolean((event as any).running);
    case "photo_post_attempt":
      return (
        kind === "photo_post_attempt" ||
        kind === "photo_post" ||
        kind === "show_post_capture"
      );
    case "craft":
      return kind === "craft" || kind === "inventory_change";
    case "talk_npc":
      return kind === "talk_npc";
    case "combat":
      return (
        kind === "npc_killed" ||
        kind === "npc_damage" ||
        kind === "challenge_step_complete"
      );
    case "fishing_catch":
      return kind === "fishing_catch";
    case "clear_muck":
      return kind === "clear_muck" || kind === "destroy";
    default:
      return kind === testCase.trigger;
  }
}

function useSnapshotCompletePortState() {
  const [state, setState] = useState(() => readSnapshotCompletePortState());
  useEffect(() => {
    const refresh = () => setState(readSnapshotCompletePortState());
    const interval = window.setInterval(refresh, 750);
    window.addEventListener("storage", refresh);
    window.addEventListener(SNAPSHOT_COMPLETE_PORT_EVENT, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SNAPSHOT_COMPLETE_PORT_EVENT, refresh);
    };
  }, []);
  return state;
}

function pinTestCaseMarker(mapManager: any, testCase: SnapshotMissionTestCase) {
  const markerId = 760_000 + Math.max(0, testCase.stepIndex);
  mapManager.removeNavigationAid?.(markerId);
  mapManager.addNavigationAid?.(
    {
      kind: "placed",
      autoremoveWhenNear: true,
      target: {
        kind: "position",
        position: [...testCase.expectedMarkerPosition],
      },
    },
    markerId
  );
  const state = readSnapshotCompletePortState();
  writeSnapshotCompletePortState({
    ...state,
    lastMarkerId: testCase.markerId,
    lastMarkerPosition: testCase.expectedMarkerPosition,
  });
}

const LegacySnapshotCompletePortRuntimeController: React.FunctionComponent<{}> =
  () => {
    const { gardenHose, mapManager, reactResources } = useClientContext();

    useEffect(() => {
      const handler = (event: GardenHoseEvent) => {
        const state = readSnapshotCompletePortState();
        const tests = snapshotMissionTestCases();
        const eventMarkerId =
          (event as any).markerId ??
          (event as any).target ??
          (event as any).id ??
          undefined;
        // HARTHMERE_SNAPSHOT_MISSION_ORDER_INDEPENDENT (2026-07-02): complete the
        // earliest still-incomplete step whose trigger matches this event. Only the
        // Road Ahead NUX chain can self-accept from an out-of-order event; later
        // Grove quests must be explicitly active first.
        // The old code only advanced when the event matched the CURRENT step in
        // strict order after acceptance, so a missed "Meet Jackie" talk or any
        // out-of-order action left Road Ahead stuck at step 0 forever.
        const chosen = chooseSnapshotMissionStep(
          state,
          tests,
          (test) => triggerMatchesTestCase(test, event),
          eventMarkerId !== undefined ? String(eventMarkerId) : undefined,
          {
            canImplicitlyAcceptQuest: (questId) =>
              questId === SNAPSHOT_ROAD_AHEAD_MISSION_ID,
          }
        );
        if (!chosen) {
          // Nothing advanced: still record the raw proof so evidence is not lost.
          if (
            (event as any).kind === "photo_post_attempt" ||
            (event as any).kind === "show_post_capture"
          ) {
            markProof("photo", `photo_${Date.now()}`);
          }
          if (
            (event as any).kind === "destroy" ||
            (event as any).kind === "clear_muck"
          ) {
            markProof("muck", String(eventMarkerId ?? "muckwad_patch"));
          }
          if ((event as any).kind === "fishing_catch") {
            markProof(
              "fish",
              String((event as any).catchId ?? `fish_${Date.now()}`)
            );
          }
          return;
        }

        const {
          state: advancedState,
          completedMission,
          nextStepIndex,
        } = advanceSnapshotMissionProgress(state, tests, chosen);
        let next = appendAudioCue(advancedState, chosen.expectedAudioCue);
        if (completedMission) {
          next = grantStructuredReward(next, chosen.questId);
        }
        writeSnapshotCompletePortState(next);

        // Mirror Road Ahead progress into the BiomesUI mission-tracker store so the
        // displayed quest advances with the player's actions (the tracker reads the
        // bridge store, not this one). Map complete-port step ids
        // ("road_ahead_<index>_...") back to their step index.
        if (chosen.questId === "snapshot_road_ahead_full_chain") {
          const completedStepIndexes = next.completedStepIds
            .map((id) => /^road_ahead_(\d+)_/.exec(id)?.[1])
            .filter((value): value is string => Boolean(value))
            .map((value) => Number(value));
          applySnapshotRoadAheadProgressFromPortForBiomesUI({
            completedStepIndexes,
            activeStepIndex: completedMission ? 0 : nextStepIndex,
            missionCompleted: completedMission,
          });
        }

        if (completedMission) {
          mapManager.removeNavigationAid?.(760_000 + chosen.stepIndex);
        } else {
          const missionTests = tests
            .filter((test) => test.questId === chosen.questId)
            .slice()
            .sort((a, b) => a.stepIndex - b.stepIndex);
          const nextCase = missionTests[nextStepIndex];
          if (nextCase) {
            pinTestCaseMarker(mapManager, nextCase);
          }
        }
      };
      gardenHose.on("anyEvent", handler);
      return () => gardenHose.off("anyEvent", handler);
    }, [gardenHose, mapManager]);

    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }
      const win = window as typeof window & { __snapshot?: unknown };
      win.__snapshot = {
        version: SNAPSHOT_COMPLETE_PORT_VERSION,
        challengeExtraction: SNAPSHOT_CANONICAL_CHALLENGE_EXTRACTION_VERSION,
        serverStateContract: SNAPSHOT_SERVER_COMPLETION_STATE_VERSION,
        tests: snapshotMissionTestCases(),
        officialNuxChallenges: SNAPSHOT_OFFICIAL_NUX_CHALLENGES,
        rewards: SNAPSHOT_STRUCTURED_REWARDS,
        fishingWaterCamera: SNAPSHOT_FISHING_WATER_CAMERA_SYSTEMS,
        muckPersistence: SNAPSHOT_MUCK_PERSISTENCE,
        stateScope: snapshotCurrentPlayerStateScope,
        scopedStorageKey: snapshotPlayerScopedStorageKey,
        readState: readSnapshotCompletePortState,
        reset: () => {
          snapshotLocalRemoveItem(SNAPSHOT_COMPLETE_PORT_STATE_KEY);
          snapshotLocalRemoveItem(SNAPSHOT_PHOTO_PROOFS_KEY);
          snapshotLocalRemoveItem(SNAPSHOT_CLEARED_MUCK_KEY);
          window.dispatchEvent(new Event(SNAPSHOT_COMPLETE_PORT_EVENT));
        },
        startMission: (questId: string) => {
          const tests = snapshotMissionTestCases().filter(
            (test) => test.questId === questId
          );
          const first = tests[0];
          const current = readSnapshotCompletePortState();
          writeSnapshotCompletePortState({
            ...current,
            acceptedMissionIds: unique([
              ...current.acceptedMissionIds,
              questId,
            ]),
            activeMissionId: questId,
            activeStepIndex: 0,
          });
          if (first) {
            pinTestCaseMarker(mapManager, first);
          }
        },
        runMissionAudit: () => runSnapshotMissionAudit(),
        runFootAudit: () => {
          const positions: Record<string, Vec3 | undefined> = {};
          for (const npc of SNAPSHOT_GROVE_NPCS) {
            const id = npc.seedServerNpc
              ? snapshotGroveNpcEntityId(npc)
              : (8997551883502307 as BiomesId);
            const position = reactResources.get?.(
              "/ecs/c/position",
              id as BiomesId
            ) as any;
            positions[npc.id] = position?.v
              ? ([...position.v] as Vec3)
              : undefined;
          }
          return snapshotGroveFootClearanceAudit(positions);
        },
        forceCompleteActiveStep: () => {
          const state = readSnapshotCompletePortState();
          const tests = snapshotMissionTestCases().filter(
            (test) => test.questId === state.activeMissionId
          );
          const test = tests[state.activeStepIndex];
          if (!test) return state;
          const completedMission = state.activeStepIndex + 1 >= tests.length;
          const next = grantStructuredReward(
            {
              ...state,
              activeMissionId: completedMission
                ? undefined
                : state.activeMissionId,
              activeStepIndex: completedMission ? 0 : state.activeStepIndex + 1,
              completedStepIds: unique([...state.completedStepIds, test.id]),
              completedMissionIds:
                completedMission && state.activeMissionId
                  ? unique([
                      ...state.completedMissionIds,
                      state.activeMissionId,
                    ])
                  : state.completedMissionIds,
            },
            test.questId
          );
          writeSnapshotCompletePortState(next);
          return next;
        },
      };
    }, [mapManager, reactResources]);

    return null;
  };

export const SnapshotCompletePortRuntimeController: React.FunctionComponent<{}> =
  () => {
    // The complete-port reducer accepts client GardenHose events and can
    // implicitly accept/advance Road Ahead out of order.  That is useful for a
    // developer port audit, but it must never run beside the original ECS
    // trigger service in normal gameplay.
    return nativeRoadAheadEcsAuthorityEnabled() ? null : (
      <LegacySnapshotCompletePortRuntimeController />
    );
  };

export function runSnapshotMissionAudit() {
  const tests = snapshotMissionTestCases();
  const missingMarkers = tests.filter(
    (test) =>
      !SNAPSHOT_GROVE_LANDMARKS.some(
        (landmark) => landmark.id === test.markerId
      )
  );
  const missingRewards = tests.filter(
    (test) =>
      !test.expectedRewardIds.length && test.expectedStateAfter === "complete"
  );
  const noAutoRemove = tests.filter(
    (test) => !test.expectedMarkerRemovesOnComplete
  );
  return {
    version: SNAPSHOT_MISSION_TEST_MATRIX_VERSION,
    totalTests: tests.length,
    roadAheadTests: tests.filter(
      (test) => test.questId === "snapshot_road_ahead_full_chain"
    ).length,
    groveQuestTests: tests.filter(
      (test) => test.questId !== "snapshot_road_ahead_full_chain"
    ).length,
    missingMarkers,
    missingRewards,
    noAutoRemove,
    pass: missingMarkers.length === 0 && noAutoRemove.length === 0,
  };
}

export const SnapshotMissionAuditPanel: React.FunctionComponent<{}> = () => {
  const state = useSnapshotCompletePortState();
  const audit = useMemo(() => runSnapshotMissionAudit(), [state.updatedAt]);
  return (
    <div className="rounded border-sky-200/20 bg-sky-950/30 border p-2 text-white">
      <div className="text-sm font-semibold">Snapshot Mission QA</div>
      <div className="text-sky-100/80 text-[10px] uppercase tracking-wide">
        {SNAPSHOT_MISSION_TEST_MATRIX_VERSION}
      </div>
      <div className="mt-1 text-xs text-white/75">
        {audit.totalTests} mission assertions · {audit.roadAheadTests} Road
        Ahead · {audit.groveQuestTests} Grove/Harthmere connector
      </div>
      <div className="mt-1 text-[11px] text-white/60">
        Rewards: {state.grantedRewardIds.length} · Items:{" "}
        {state.grantedItemIds.length} · Audio cues: {state.audioLog.length}
      </div>
      <div className="mt-1 text-[11px] text-white/60">
        Photo proofs: {state.photoProofIds.length} · Cleared muck:{" "}
        {state.clearedMuckIds.length} · Fish: {state.fishingCatchIds.length}
      </div>
      {!audit.pass && (
        <div className="rounded bg-red-500/20 text-red-100 mt-1 p-1 text-[11px]">
          Audit failures: {audit.missingMarkers.length} missing markers,{" "}
          {audit.noAutoRemove.length} non-removing markers.
        </div>
      )}
    </div>
  );
};

export const SnapshotGroundingAuditPanel: React.FunctionComponent<{}> = () => {
  const { reactResources } = useClientContext();
  const [audit, setAudit] = useState(() => snapshotGroveFootClearanceAudit());

  useEffect(() => {
    const refresh = () => {
      const positions: Record<string, Vec3 | undefined> = {};
      for (const npc of SNAPSHOT_GROVE_NPCS) {
        const id = npc.seedServerNpc
          ? snapshotGroveNpcEntityId(npc)
          : (8997551883502307 as BiomesId);
        const position = reactResources.get?.(
          "/ecs/c/position",
          id as BiomesId
        ) as any;
        positions[npc.id] = position?.v ? ([...position.v] as Vec3) : undefined;
      }
      setAudit(snapshotGroveFootClearanceAudit(positions));
    };
    refresh();
    const interval = window.setInterval(refresh, 1500);
    return () => window.clearInterval(interval);
  }, [reactResources]);

  const failing = audit.filter((entry) => !entry.pass);
  return (
    <div className="rounded border-amber-200/20 bg-amber-950/30 border p-2 text-white">
      <div className="text-sm font-semibold">Grove NPC Foot Audit</div>
      <div className="text-amber-100/80 text-[10px] uppercase tracking-wide">
        {SNAPSHOT_GROVE_FOOT_CLEARANCE_AUDIT_VERSION}
      </div>
      <div className="mt-1 text-xs text-white/75">
        {audit.length} NPCs checked · tolerance ≤{" "}
        {SNAPSHOT_GROVE_MAX_FEET_CLEARANCE}m · failures {failing.length}
      </div>
      {!!failing.length && (
        <div className="text-red-100 mt-1 text-[11px]">
          {failing
            .slice(0, 3)
            .map((entry) => `${entry.displayName}: ${entry.authoredClearance}m`)
            .join(" · ")}
        </div>
      )}
    </div>
  );
};

export const SnapshotPortStatusPanel: React.FunctionComponent<{}> = () => {
  const state = useSnapshotCompletePortState();
  return (
    <div className="rounded border-violet-200/20 bg-violet-950/30 border p-2 text-white">
      <div className="text-sm font-semibold">Snapshot Port Status</div>
      <div className="text-violet-100/80 text-[10px] uppercase tracking-wide">
        {SNAPSHOT_COMPLETE_PORT_VERSION}
      </div>
      <div className="mt-1 text-xs text-white/75">
        Canonical challenges: {SNAPSHOT_OFFICIAL_NUX_CHALLENGES.length} · Grove
        quests: {SNAPSHOT_GROVE_QUESTS.length} · Grove NPCs:{" "}
        {SNAPSHOT_GROVE_NPCS.length}
      </div>
      <div className="mt-1 text-[11px] text-white/60">
        Active: {state.activeMissionId ?? "none"} · Complete:{" "}
        {state.completedMissionIds.length} · XP: {state.xp} · Bling:{" "}
        {state.bling}
      </div>
    </div>
  );
};

export const SnapshotHarthmereBibleUpgradeMarker: React.FunctionComponent<{}> =
  () => (
    <span className="hidden">
      {SNAPSHOT_HARTHMERE_BIBLE_NPC_UPGRADE_VERSION}
    </span>
  );
