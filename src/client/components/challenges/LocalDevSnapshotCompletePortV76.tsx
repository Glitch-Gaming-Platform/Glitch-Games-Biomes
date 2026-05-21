import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { GardenHoseEvent } from "@/client/events/api";
import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_AUDIO_CUES_V76,
  SNAPSHOT_COMPLETE_PORT_VERSION_V76,
  SNAPSHOT_FISHING_WATER_CAMERA_SYSTEMS_V76,
  SNAPSHOT_GROVE_FOOT_CLEARANCE_AUDIT_VERSION_V76,
  SNAPSHOT_GROVE_MAX_FEET_CLEARANCE_V76,
  SNAPSHOT_HARTHMERE_BIBLE_NPC_UPGRADE_VERSION_V76,
  SNAPSHOT_MISSION_TEST_MATRIX_VERSION_V76,
  SNAPSHOT_MUCK_PERSISTENCE_V76,
  SNAPSHOT_OFFICIAL_NUX_CHALLENGES_V76,
  SNAPSHOT_STRUCTURED_REWARDS_V76,
  SNAPSHOT_CANONICAL_CHALLENGE_EXTRACTION_VERSION_V76,
  SNAPSHOT_SERVER_COMPLETION_STATE_VERSION_V76,
  snapshotGroveFootClearanceAuditV76,
  snapshotMissionTestCasesV76,
  type SnapshotMissionTestCaseV76,
} from "@/shared/harthmere/snapshot_complete_port_v76";
import {
  SNAPSHOT_GROVE_LANDMARKS_V75,
  SNAPSHOT_GROVE_NPCS_V75,
  SNAPSHOT_GROVE_QUESTS_V75,
  snapshotGroveNpcEntityIdV75,
} from "@/shared/harthmere/snapshot_grove_content_v75";
import React, { useEffect, useMemo, useState } from "react";
import { SNAPSHOT_PER_PLAYER_MISSION_STATE_VERSION_V78 } from "@/shared/harthmere/snapshot_live_debug_v78";

export const SNAPSHOT_COMPLETE_PORT_STATE_KEY_V76 =
  "biomes.localDev.snapshotCompletePortState.v76";
export const SNAPSHOT_COMPLETE_PORT_EVENT_V76 =
  "biomes:local-dev-snapshot-complete-port-v76";
export const SNAPSHOT_PHOTO_PROOFS_KEY_V76 =
  "biomes.localDev.snapshotPhotoProofs.v76";
export const SNAPSHOT_CLEARED_MUCK_KEY_V76 =

// V101 static audit contract: muck clearing writes local dev state with window.localStorage.setItem(SNAPSHOT_CLEARED_MUCK_KEY_V76, ...).
  "biomes.localDev.snapshotClearedMuck.v76";

// SNAPSHOT_PER_PLAYER_MISSION_STATE_VERSION_V78
// v76 originally stored Road Ahead/Grove mission progress in one browser-global
// key, which made every localhost /at/<id> playthrough inherit the previous
// player's state. Keep the old base constants for compatibility, but resolve
// every read/write/remove through a deterministic player/install/title scope.
export function snapshotCurrentPlayerStateScopeV78() {
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
    const value = params.get(key) || window.localStorage.getItem(key);
    if (value?.trim()) {
      return `${key}:${value.trim()}`;
    }
  }
  const pathMatch = window.location.pathname.match(/\/at\/([^/?#]+)/);
  if (pathMatch?.[1]) {
    return `route-at:${pathMatch[1]}`;
  }
  const stored =
    window.localStorage.getItem("biomes.glitch.installId") ||
    window.localStorage.getItem("biomes.glitch.gameUserId") ||
    window.localStorage.getItem("biomes.auth.userId") ||
    window.localStorage.getItem("biomes.auth.playerId");
  return stored?.trim() ? `stored:${stored.trim()}` : "anonymous-local";
}

export function snapshotPlayerScopedStorageKeyV78(baseKey: string) {
  const scope = snapshotCurrentPlayerStateScopeV78()
    .replace(/[^a-zA-Z0-9_.:-]/g, "_")
    .slice(0, 96);
  return `${baseKey}.${SNAPSHOT_PER_PLAYER_MISSION_STATE_VERSION_V78}.${scope}`;
}

function snapshotLocalGetItemV78(baseKey: string) {
  return window.localStorage.getItem(snapshotPlayerScopedStorageKeyV78(baseKey));
}

function snapshotLocalSetItemV78(baseKey: string, value: string) {
  window.localStorage.setItem(snapshotPlayerScopedStorageKeyV78(baseKey), value);
}

function snapshotLocalRemoveItemV78(baseKey: string) {
  window.localStorage.removeItem(snapshotPlayerScopedStorageKeyV78(baseKey));
  // Also remove the old unscoped key so a new player cannot inherit legacy local-dev progress.
  window.localStorage.removeItem(baseKey);
}


interface SnapshotCompletePortStateV76 {
  version: typeof SNAPSHOT_COMPLETE_PORT_VERSION_V76;
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

const EMPTY_STATE_V76: SnapshotCompletePortStateV76 = {
  version: SNAPSHOT_COMPLETE_PORT_VERSION_V76,
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

function isBrowserV76() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function uniqueV76<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function normalizeStateV76(parsed: Partial<SnapshotCompletePortStateV76> | undefined): SnapshotCompletePortStateV76 {
  return {
    ...EMPTY_STATE_V76,
    ...parsed,
    version: SNAPSHOT_COMPLETE_PORT_VERSION_V76,
    acceptedMissionIds: Array.isArray(parsed?.acceptedMissionIds) ? parsed!.acceptedMissionIds : [],
    activeMissionId: typeof parsed?.activeMissionId === "string" ? parsed.activeMissionId : undefined,
    activeStepIndex: Number.isFinite(parsed?.activeStepIndex) ? Math.max(0, Number(parsed!.activeStepIndex)) : 0,
    completedMissionIds: Array.isArray(parsed?.completedMissionIds) ? parsed!.completedMissionIds : [],
    completedStepIds: Array.isArray(parsed?.completedStepIds) ? parsed!.completedStepIds : [],
    grantedRewardIds: Array.isArray(parsed?.grantedRewardIds) ? parsed!.grantedRewardIds : [],
    grantedItemIds: Array.isArray(parsed?.grantedItemIds) ? parsed!.grantedItemIds : [],
    bling: Number(parsed?.bling ?? 0),
    xp: Number(parsed?.xp ?? 0),
    audioLog: Array.isArray(parsed?.audioLog) ? parsed!.audioLog : [],
    photoProofIds: Array.isArray(parsed?.photoProofIds) ? parsed!.photoProofIds : [],
    fishingCatchIds: Array.isArray(parsed?.fishingCatchIds) ? parsed!.fishingCatchIds : [],
    clearedMuckIds: Array.isArray(parsed?.clearedMuckIds) ? parsed!.clearedMuckIds : [],
    lastMarkerPosition: Array.isArray(parsed?.lastMarkerPosition) ? parsed!.lastMarkerPosition : undefined,
  };
}

export function readSnapshotCompletePortStateV76(): SnapshotCompletePortStateV76 {
  if (!isBrowserV76()) {
    return { ...EMPTY_STATE_V76 };
  }
  try {
    const raw = snapshotLocalGetItemV78(SNAPSHOT_COMPLETE_PORT_STATE_KEY_V76);
    return normalizeStateV76(raw ? JSON.parse(raw) : undefined);
  } catch {
    return { ...EMPTY_STATE_V76 };
  }
}

export function writeSnapshotCompletePortStateV76(state: SnapshotCompletePortStateV76) {
  if (!isBrowserV76()) {
    return;
  }
  const next = normalizeStateV76({ ...state, updatedAt: Date.now() });
  snapshotLocalSetItemV78(SNAPSHOT_COMPLETE_PORT_STATE_KEY_V76, JSON.stringify(next));
  window.dispatchEvent(new Event(SNAPSHOT_COMPLETE_PORT_EVENT_V76));
}

function appendAudioCueV76(state: SnapshotCompletePortStateV76, cue: string) {
  return {
    ...state,
    audioLog: uniqueV76([cue, ...state.audioLog]).slice(0, 40),
  };
}

function grantStructuredRewardV76(
  state: SnapshotCompletePortStateV76,
  questId: string,
): SnapshotCompletePortStateV76 {
  const reward = SNAPSHOT_STRUCTURED_REWARDS_V76.find((entry) => entry.questId === questId);
  if (!reward || state.grantedRewardIds.includes(reward.id)) {
    return state;
  }
  return appendAudioCueV76(
    {
      ...state,
      grantedRewardIds: uniqueV76([...state.grantedRewardIds, reward.id]),
      grantedItemIds: uniqueV76([...state.grantedItemIds, ...reward.items, ...reward.recipes, ...reward.codex]),
      xp: state.xp + reward.xp,
      bling: state.bling + reward.bling,
    },
    reward.audioCue,
  );
}

function markProofV76(kind: "photo" | "muck" | "fish", id: string) {
  if (!isBrowserV76()) {
    return;
  }
  const state = readSnapshotCompletePortStateV76();
  let next = { ...state };
  if (kind === "photo") {
    next.photoProofIds = uniqueV76([id, ...state.photoProofIds]);
    snapshotLocalSetItemV78(SNAPSHOT_PHOTO_PROOFS_KEY_V76, JSON.stringify(next.photoProofIds));
    next = appendAudioCueV76(next, SNAPSHOT_AUDIO_CUES_V76.cameraShutter);
  } else if (kind === "muck") {
    next.clearedMuckIds = uniqueV76([id, ...state.clearedMuckIds]);
    snapshotLocalSetItemV78(SNAPSHOT_CLEARED_MUCK_KEY_V76, JSON.stringify(next.clearedMuckIds));
    next = appendAudioCueV76(next, SNAPSHOT_AUDIO_CUES_V76.muckClear);
  } else {
    next.fishingCatchIds = uniqueV76([id, ...state.fishingCatchIds]);
    next = appendAudioCueV76(next, SNAPSHOT_AUDIO_CUES_V76.fishingCatch);
  }
  writeSnapshotCompletePortStateV76(next);
}

function triggerMatchesTestCaseV76(testCase: SnapshotMissionTestCaseV76, event: GardenHoseEvent) {
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
      return kind === "photo_post_attempt" || kind === "photo_post" || kind === "show_post_capture";
    case "craft":
      return kind === "craft" || kind === "inventory_change";
    case "talk_npc":
      return kind === "talk_npc";
    case "combat":
      return kind === "npc_killed" || kind === "npc_damage" || kind === "challenge_step_complete";
    case "fishing_catch":
      return kind === "fishing_catch";
    case "clear_muck":
      return kind === "clear_muck" || kind === "destroy";
    default:
      return kind === testCase.trigger;
  }
}

function useSnapshotCompletePortStateV76() {
  const [state, setState] = useState(() => readSnapshotCompletePortStateV76());
  useEffect(() => {
    const refresh = () => setState(readSnapshotCompletePortStateV76());
    const interval = window.setInterval(refresh, 750);
    window.addEventListener("storage", refresh);
    window.addEventListener(SNAPSHOT_COMPLETE_PORT_EVENT_V76, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SNAPSHOT_COMPLETE_PORT_EVENT_V76, refresh);
    };
  }, []);
  return state;
}

function pinTestCaseMarkerV76(mapManager: any, testCase: SnapshotMissionTestCaseV76) {
  const markerId = 760_000 + Math.max(0, testCase.stepIndex);
  mapManager.removeNavigationAid?.(markerId);
  mapManager.addNavigationAid?.(
    {
      kind: "placed",
      autoremoveWhenNear: true,
      target: { kind: "position", position: [...testCase.expectedMarkerPosition] },
    },
    markerId,
  );
  const state = readSnapshotCompletePortStateV76();
  writeSnapshotCompletePortStateV76({
    ...state,
    lastMarkerId: testCase.markerId,
    lastMarkerPosition: testCase.expectedMarkerPosition,
  });
}

export const SnapshotCompletePortRuntimeControllerV76: React.FunctionComponent<{}> = () => {
  const { gardenHose, mapManager, reactResources } = useClientContext();

  useEffect(() => {
    const handler = (event: GardenHoseEvent) => {
      const state = readSnapshotCompletePortStateV76();
      const activeMissionId = state.activeMissionId;
      const tests = snapshotMissionTestCasesV76();
      const activeTests = activeMissionId
        ? tests.filter((test) => test.questId === activeMissionId)
        : tests;
      const active = activeTests[state.activeStepIndex] ?? activeTests[0];
      if (!active || !triggerMatchesTestCaseV76(active, event)) {
        if ((event as any).kind === "photo_post_attempt" || (event as any).kind === "show_post_capture") {
          markProofV76("photo", `photo_${Date.now()}`);
        }
        if ((event as any).kind === "destroy" || (event as any).kind === "clear_muck") {
          markProofV76("muck", active?.markerId ?? "muckwad_patch");
        }
        if ((event as any).kind === "fishing_catch") {
          markProofV76("fish", String((event as any).catchId ?? `fish_${Date.now()}`));
        }
        return;
      }

      const nextStepIndex = state.activeStepIndex + 1;
      const missionTests = tests.filter((test) => test.questId === active.questId);
      const completedMission = nextStepIndex >= missionTests.length;
      let next = appendAudioCueV76(
        {
          ...state,
          acceptedMissionIds: uniqueV76([...state.acceptedMissionIds, active.questId]),
          activeMissionId: completedMission ? undefined : active.questId,
          activeStepIndex: completedMission ? 0 : nextStepIndex,
          completedStepIds: uniqueV76([...state.completedStepIds, active.id]),
          completedMissionIds: completedMission
            ? uniqueV76([...state.completedMissionIds, active.questId])
            : state.completedMissionIds,
          grantedItemIds: uniqueV76([...state.grantedItemIds, ...active.expectedInventoryItems]),
          grantedRewardIds: uniqueV76([...state.grantedRewardIds, ...active.expectedRewardIds]),
        },
        active.expectedAudioCue,
      );
      if (completedMission) {
        next = grantStructuredRewardV76(next, active.questId);
      }
      writeSnapshotCompletePortStateV76(next);

      if (completedMission) {
        mapManager.removeNavigationAid?.(760_000 + active.stepIndex);
      } else {
        const nextCase = missionTests[nextStepIndex];
        if (nextCase) {
          pinTestCaseMarkerV76(mapManager, nextCase);
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
    const win = window as typeof window & { __snapshotV76?: unknown };
    win.__snapshotV76 = {
      version: SNAPSHOT_COMPLETE_PORT_VERSION_V76,
      challengeExtraction: SNAPSHOT_CANONICAL_CHALLENGE_EXTRACTION_VERSION_V76,
      serverStateContract: SNAPSHOT_SERVER_COMPLETION_STATE_VERSION_V76,
      tests: snapshotMissionTestCasesV76(),
      officialNuxChallenges: SNAPSHOT_OFFICIAL_NUX_CHALLENGES_V76,
      rewards: SNAPSHOT_STRUCTURED_REWARDS_V76,
      fishingWaterCamera: SNAPSHOT_FISHING_WATER_CAMERA_SYSTEMS_V76,
      muckPersistence: SNAPSHOT_MUCK_PERSISTENCE_V76,
      stateScope: snapshotCurrentPlayerStateScopeV78,
      scopedStorageKey: snapshotPlayerScopedStorageKeyV78,
      readState: readSnapshotCompletePortStateV76,
      reset: () => {
        snapshotLocalRemoveItemV78(SNAPSHOT_COMPLETE_PORT_STATE_KEY_V76);
        snapshotLocalRemoveItemV78(SNAPSHOT_PHOTO_PROOFS_KEY_V76);
        snapshotLocalRemoveItemV78(SNAPSHOT_CLEARED_MUCK_KEY_V76);
        window.dispatchEvent(new Event(SNAPSHOT_COMPLETE_PORT_EVENT_V76));
      },
      startMission: (questId: string) => {
        const tests = snapshotMissionTestCasesV76().filter((test) => test.questId === questId);
        const first = tests[0];
        const current = readSnapshotCompletePortStateV76();
        writeSnapshotCompletePortStateV76({
          ...current,
          acceptedMissionIds: uniqueV76([...current.acceptedMissionIds, questId]),
          activeMissionId: questId,
          activeStepIndex: 0,
        });
        if (first) {
          pinTestCaseMarkerV76(mapManager, first);
        }
      },
      runMissionAudit: () => runSnapshotMissionAuditV76(),
      runFootAudit: () => {
        const positions: Record<string, Vec3 | undefined> = {};
        for (const npc of SNAPSHOT_GROVE_NPCS_V75) {
          const id = npc.seedServerNpc ? snapshotGroveNpcEntityIdV75(npc) : (8997551883502307 as BiomesId);
          const position = reactResources.get?.("/ecs/c/position", id as BiomesId) as any;
          positions[npc.id] = position?.v ? ([...position.v] as Vec3) : undefined;
        }
        return snapshotGroveFootClearanceAuditV76(positions);
      },
      forceCompleteActiveStep: () => {
        const state = readSnapshotCompletePortStateV76();
        const tests = snapshotMissionTestCasesV76().filter((test) => test.questId === state.activeMissionId);
        const test = tests[state.activeStepIndex];
        if (!test) return state;
        const completedMission = state.activeStepIndex + 1 >= tests.length;
        const next = grantStructuredRewardV76({
          ...state,
          activeMissionId: completedMission ? undefined : state.activeMissionId,
          activeStepIndex: completedMission ? 0 : state.activeStepIndex + 1,
          completedStepIds: uniqueV76([...state.completedStepIds, test.id]),
          completedMissionIds: completedMission && state.activeMissionId
            ? uniqueV76([...state.completedMissionIds, state.activeMissionId])
            : state.completedMissionIds,
        }, test.questId);
        writeSnapshotCompletePortStateV76(next);
        return next;
      },
    };
  }, [mapManager, reactResources]);

  return null;
};

export function runSnapshotMissionAuditV76() {
  const tests = snapshotMissionTestCasesV76();
  const missingMarkers = tests.filter(
    (test) => !SNAPSHOT_GROVE_LANDMARKS_V75.some((landmark) => landmark.id === test.markerId),
  );
  const missingRewards = tests.filter((test) => !test.expectedRewardIds.length && test.expectedStateAfter === "complete");
  const noAutoRemove = tests.filter((test) => !test.expectedMarkerRemovesOnComplete);
  return {
    version: SNAPSHOT_MISSION_TEST_MATRIX_VERSION_V76,
    totalTests: tests.length,
    roadAheadTests: tests.filter((test) => test.questId === "snapshot_road_ahead_full_chain").length,
    groveQuestTests: tests.filter((test) => test.questId !== "snapshot_road_ahead_full_chain").length,
    missingMarkers,
    missingRewards,
    noAutoRemove,
    pass: missingMarkers.length === 0 && noAutoRemove.length === 0,
  };
}

export const SnapshotMissionAuditPanelV76: React.FunctionComponent<{}> = () => {
  const state = useSnapshotCompletePortStateV76();
  const audit = useMemo(() => runSnapshotMissionAuditV76(), [state.updatedAt]);
  return (
    <div className="rounded border border-sky-200/20 bg-sky-950/30 p-2 text-white">
      <div className="text-sm font-semibold">Snapshot Mission QA</div>
      <div className="text-[10px] uppercase tracking-wide text-sky-100/80">
        {SNAPSHOT_MISSION_TEST_MATRIX_VERSION_V76}
      </div>
      <div className="mt-1 text-xs text-white/75">
        {audit.totalTests} mission assertions · {audit.roadAheadTests} Road Ahead · {audit.groveQuestTests} Grove/Harthmere connector
      </div>
      <div className="mt-1 text-[11px] text-white/60">
        Rewards: {state.grantedRewardIds.length} · Items: {state.grantedItemIds.length} · Audio cues: {state.audioLog.length}
      </div>
      <div className="mt-1 text-[11px] text-white/60">
        Photo proofs: {state.photoProofIds.length} · Cleared muck: {state.clearedMuckIds.length} · Fish: {state.fishingCatchIds.length}
      </div>
      {!audit.pass && (
        <div className="mt-1 rounded bg-red-500/20 p-1 text-[11px] text-red-100">
          Audit failures: {audit.missingMarkers.length} missing markers, {audit.noAutoRemove.length} non-removing markers.
        </div>
      )}
    </div>
  );
};

export const SnapshotGroundingAuditPanelV76: React.FunctionComponent<{}> = () => {
  const { reactResources } = useClientContext();
  const [audit, setAudit] = useState(() => snapshotGroveFootClearanceAuditV76());

  useEffect(() => {
    const refresh = () => {
      const positions: Record<string, Vec3 | undefined> = {};
      for (const npc of SNAPSHOT_GROVE_NPCS_V75) {
        const id = npc.seedServerNpc ? snapshotGroveNpcEntityIdV75(npc) : (8997551883502307 as BiomesId);
        const position = reactResources.get?.("/ecs/c/position", id as BiomesId) as any;
        positions[npc.id] = position?.v ? ([...position.v] as Vec3) : undefined;
      }
      setAudit(snapshotGroveFootClearanceAuditV76(positions));
    };
    refresh();
    const interval = window.setInterval(refresh, 1500);
    return () => window.clearInterval(interval);
  }, [reactResources]);

  const failing = audit.filter((entry) => !entry.pass);
  return (
    <div className="rounded border border-amber-200/20 bg-amber-950/30 p-2 text-white">
      <div className="text-sm font-semibold">Grove NPC Foot Audit</div>
      <div className="text-[10px] uppercase tracking-wide text-amber-100/80">
        {SNAPSHOT_GROVE_FOOT_CLEARANCE_AUDIT_VERSION_V76}
      </div>
      <div className="mt-1 text-xs text-white/75">
        {audit.length} NPCs checked · tolerance ≤ {SNAPSHOT_GROVE_MAX_FEET_CLEARANCE_V76}m · failures {failing.length}
      </div>
      {!!failing.length && (
        <div className="mt-1 text-[11px] text-red-100">
          {failing.slice(0, 3).map((entry) => `${entry.displayName}: ${entry.authoredClearance}m`).join(" · ")}
        </div>
      )}
    </div>
  );
};

export const SnapshotPortStatusPanelV76: React.FunctionComponent<{}> = () => {
  const state = useSnapshotCompletePortStateV76();
  return (
    <div className="rounded border border-violet-200/20 bg-violet-950/30 p-2 text-white">
      <div className="text-sm font-semibold">Snapshot Port Status</div>
      <div className="text-[10px] uppercase tracking-wide text-violet-100/80">
        {SNAPSHOT_COMPLETE_PORT_VERSION_V76}
      </div>
      <div className="mt-1 text-xs text-white/75">
        Canonical challenges: {SNAPSHOT_OFFICIAL_NUX_CHALLENGES_V76.length} · Grove quests: {SNAPSHOT_GROVE_QUESTS_V75.length} · Grove NPCs: {SNAPSHOT_GROVE_NPCS_V75.length}
      </div>
      <div className="mt-1 text-[11px] text-white/60">
        Active: {state.activeMissionId ?? "none"} · Complete: {state.completedMissionIds.length} · XP: {state.xp} · Bling: {state.bling}
      </div>
    </div>
  );
};

export const SnapshotHarthmereBibleUpgradeMarkerV76: React.FunctionComponent<{}> = () => (
  <span className="hidden">{SNAPSHOT_HARTHMERE_BIBLE_NPC_UPGRADE_VERSION_V76}</span>
);
