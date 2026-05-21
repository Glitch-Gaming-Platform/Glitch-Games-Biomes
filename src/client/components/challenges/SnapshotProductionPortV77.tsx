import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { GardenHoseEvent } from "@/client/events/api";
import type { Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_AUDIO_FILE_BINDINGS_V77,
  SNAPSHOT_CANONICAL_MUCK_MUTATIONS_V77,
  SNAPSHOT_DUAL_MODE_STATE_BACKEND_VERSION_V77,
  SNAPSHOT_FINAL_BIKKIE_REWARD_BINDING_VERSION_V77,
  SNAPSHOT_GROVE_NPC_BOUNDS_PASS_VERSION_V77,
  SNAPSHOT_GROVE_NPC_VISUAL_BOUNDS_V77,
  SNAPSHOT_GROVE_PLAYER_BUILDER_UI_VERSION_V77,
  SNAPSHOT_PRODUCTION_PORT_VERSION_V77,
  SNAPSHOT_STATE_BACKEND_RULES_V77,
  SNAPSHOT_STATE_ENDPOINT_V77,
  snapshotResolveRewardItemsV77,
  type SnapshotBackendIdentityV77,
  type SnapshotProgressMutationV77,
  type SnapshotStateBackendModeV77,
} from "@/shared/harthmere/snapshot_production_port_v77";
import {
  SNAPSHOT_AUDIO_CUES_V76,
  SNAPSHOT_COMPLETE_PORT_EVENT_V76,
  SNAPSHOT_STRUCTURED_REWARDS_V76,
} from "@/shared/harthmere/snapshot_complete_port_v76";
import {
  readSnapshotCompletePortStateV76,
  SNAPSHOT_CLEARED_MUCK_KEY_V76,
  SNAPSHOT_COMPLETE_PORT_STATE_KEY_V76,
  SNAPSHOT_PHOTO_PROOFS_KEY_V76,
  writeSnapshotCompletePortStateV76,
  snapshotPlayerScopedStorageKeyV78,
} from "@/client/components/challenges/LocalDevSnapshotCompletePortV76";
import React, { useEffect, useMemo, useState } from "react";

export const SNAPSHOT_PRODUCTION_PORT_EVENT_V77 =
  "biomes:snapshot-production-port-v77";
export const SNAPSHOT_PRODUCTION_PENDING_KEY_V77 =
  "biomes.snapshot.pendingMutations.v77";
export const SNAPSHOT_BACKEND_LAST_SYNC_KEY_V77 =
  "biomes.snapshot.lastBackendSync.v77";

type SnapshotBackendSyncResultV77 = {
  ok: boolean;
  mode: SnapshotStateBackendModeV77 | string;
  durable: boolean;
  state?: any;
  error?: string;
};

function browserV77() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function uniqueV77<T>(items: T[]): T[] {
  return [...new Set(items.filter((item) => item !== undefined && item !== null))];
}

function readJsonLocalV77<T>(key: string, fallback: T): T {
  if (!browserV77()) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonLocalV77(key: string, value: unknown) {
  if (!browserV77()) {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readJsonScopedLocalV77<T>(key: string, fallback: T): T {
  return readJsonLocalV77(snapshotPlayerScopedStorageKeyV78(key), fallback);
}

function writeJsonScopedLocalV77(key: string, value: unknown) {
  writeJsonLocalV77(snapshotPlayerScopedStorageKeyV78(key), value);
}

function removeJsonScopedLocalV77(key: string) {
  if (!browserV77()) return;
  window.localStorage.removeItem(snapshotPlayerScopedStorageKeyV78(key));
  window.localStorage.removeItem(key);
}

function queryValueV77(names: string[]) {
  if (!browserV77()) {
    return undefined;
  }
  const params = new URLSearchParams(window.location.search);
  for (const name of names) {
    const fromQuery = params.get(name);
    if (fromQuery?.trim()) {
      return fromQuery.trim();
    }
    const fromStorage = window.localStorage.getItem(name);
    if (fromStorage?.trim()) {
      return fromStorage.trim();
    }
  }
  return undefined;
}

export function snapshotBackendIdentityV77(): SnapshotBackendIdentityV77 {
  return {
    installId: queryValueV77([
      "install_id",
      "glitch_install_id",
      "GLITCH_INSTALL_ID",
      "GLITCH_USER_INSTALL_ID",
      "biomes.glitch.installId",
    ]),
    gameUserId: queryValueV77([
      "game_user_id",
      "glitch_game_user_id",
      "GLITCH_GAME_USER_ID",
      "biomes.glitch.gameUserId",
    ]),
    sessionId: queryValueV77([
      "session_id",
      "glitch_session_id",
      "GLITCH_SESSION_ID",
      "biomes.glitch.sessionId",
    ]),
    titleId: queryValueV77([
      "title_id",
      "glitch_title_id",
      "GLITCH_TITLE_ID",
      "biomes.glitch.titleId",
    ]),
  };
}

export function snapshotBackendModeV77(): SnapshotStateBackendModeV77 {
  if (!browserV77()) {
    return "auto";
  }
  const explicit = window.localStorage.getItem(
    SNAPSHOT_STATE_BACKEND_RULES_V77.localStorageModeKey,
  ) as SnapshotStateBackendModeV77 | null;
  if (
    explicit === "local_dev" ||
    explicit === "production_api" ||
    explicit === "production_api_with_local_fallback"
  ) {
    return explicit;
  }
  const host = window.location.hostname;
  const identity = snapshotBackendIdentityV77();
  if (host === "localhost" || host === "127.0.0.1") {
    return identity.installId ? "production_api_with_local_fallback" : "local_dev";
  }
  return "production_api_with_local_fallback";
}

function pendingMutationsV77(): SnapshotProgressMutationV77[] {
  return readJsonScopedLocalV77(SNAPSHOT_PRODUCTION_PENDING_KEY_V77, []);
}

function savePendingMutationsV77(mutations: SnapshotProgressMutationV77[]) {
  writeJsonScopedLocalV77(SNAPSHOT_PRODUCTION_PENDING_KEY_V77, mutations.slice(-100));
}

function queueMutationV77(mutation: SnapshotProgressMutationV77) {
  savePendingMutationsV77([...pendingMutationsV77(), mutation]);
}

function mutationFromEventV77(event: GardenHoseEvent): SnapshotProgressMutationV77 | undefined {
  const anyEvent = event as any;
  const kind = anyEvent.kind as string | undefined;
  const state = readSnapshotCompletePortStateV76();
  const base = {
    missionId: state.activeMissionId,
    stepId: state.completedStepIds[state.completedStepIds.length - 1],
    occurredAtMs: Date.now(),
  };
  if (kind === "clear_muck" || kind === "destroy") {
    return {
      ...base,
      kind: "clear_muck",
      markerId: String(anyEvent.markerId ?? state.lastMarkerId ?? "muckwad_patch"),
      position: (Array.isArray(anyEvent.position) ? anyEvent.position : state.lastMarkerPosition) as Vec3 | undefined,
      audioCue: SNAPSHOT_AUDIO_CUES_V76.muckClear,
    };
  }
  if (kind === "photo_post_attempt" || kind === "photo_post" || kind === "show_post_capture") {
    return {
      ...base,
      kind: "photo_proof",
      proofId: String(anyEvent.postId ?? anyEvent.photoId ?? `photo_${Date.now()}`),
      markerId: String(state.lastMarkerId ?? "shutter_cove_marker"),
      audioCue: SNAPSHOT_AUDIO_CUES_V76.cameraShutter,
    };
  }
  if (kind === "fishing_catch") {
    return {
      ...base,
      kind: "fishing_catch",
      catchId: String(anyEvent.catchId ?? anyEvent.itemId ?? `fish_${Date.now()}`),
      markerId: String(state.lastMarkerId ?? "shutter_cove_marker"),
      audioCue: SNAPSHOT_AUDIO_CUES_V76.fishingCatch,
    };
  }
  return undefined;
}

function mutationsFromStateDeltaV77(state: any): SnapshotProgressMutationV77[] {
  const at = Date.now();
  const mutations: SnapshotProgressMutationV77[] = [];
  for (const completedMissionId of state.completedMissionIds ?? []) {
    mutations.push({ kind: "complete_mission", missionId: completedMissionId, occurredAtMs: at });
  }
  for (const completedStepId of state.completedStepIds ?? []) {
    mutations.push({ kind: "complete_step", stepId: completedStepId, missionId: state.activeMissionId, occurredAtMs: at });
  }
  for (const rewardId of state.grantedRewardIds ?? []) {
    const reward = SNAPSHOT_STRUCTURED_REWARDS_V76.find((entry) => entry.id === rewardId);
    mutations.push({
      kind: "grant_reward",
      rewardId,
      missionId: reward?.questId,
      itemSymbols: reward ? [...reward.items, ...reward.recipes, ...reward.codex] : [],
      audioCue: reward?.audioCue ?? SNAPSHOT_AUDIO_CUES_V76.reward,
      occurredAtMs: at,
    });
  }
  for (const markerId of state.clearedMuckIds ?? []) {
    mutations.push({ kind: "clear_muck", markerId, occurredAtMs: at });
  }
  for (const proofId of state.photoProofIds ?? []) {
    mutations.push({ kind: "photo_proof", proofId, occurredAtMs: at });
  }
  for (const catchId of state.fishingCatchIds ?? []) {
    mutations.push({ kind: "fishing_catch", catchId, occurredAtMs: at });
  }
  return mutations;
}

function compactMutationsV77(mutations: SnapshotProgressMutationV77[]) {
  const seen = new Set<string>();
  const compacted: SnapshotProgressMutationV77[] = [];
  for (const mutation of mutations) {
    const key = [
      mutation.kind,
      mutation.missionId ?? "",
      mutation.stepId ?? "",
      mutation.markerId ?? "",
      mutation.rewardId ?? "",
      mutation.proofId ?? "",
      mutation.catchId ?? "",
    ].join(":");
    if (!seen.has(key)) {
      seen.add(key);
      compacted.push(mutation);
    }
  }
  return compacted.slice(-100);
}

async function postSnapshotProgressV77(input: {
  mutation?: SnapshotProgressMutationV77;
  state?: any;
  reason: string;
}): Promise<SnapshotBackendSyncResultV77> {
  const mode = snapshotBackendModeV77();
  const state = input.state ?? readSnapshotCompletePortStateV76();
  const mutations = compactMutationsV77([
    ...pendingMutationsV77(),
    ...(input.mutation ? [input.mutation] : []),
    ...mutationsFromStateDeltaV77(state),
  ]);

  if (mode === "local_dev" && !snapshotBackendIdentityV77().installId) {
    queueMutationV77({
      kind: "sync_state",
      state,
      occurredAtMs: Date.now(),
    });
    return { ok: true, mode, durable: false, state };
  }

  try {
    const response = await fetch(SNAPSHOT_STATE_ENDPOINT_V77, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: SNAPSHOT_PRODUCTION_PORT_VERSION_V77,
        mode,
        reason: input.reason,
        identity: snapshotBackendIdentityV77(),
        state,
        mutations,
      }),
    });
    const json = await response.json().catch(() => undefined);
    if (!response.ok || json?.ok === false) {
      throw new Error(json?.error ?? `snapshot progress backend ${response.status}`);
    }
    savePendingMutationsV77([]);
    writeJsonScopedLocalV77(SNAPSHOT_BACKEND_LAST_SYNC_KEY_V77, {
      at: Date.now(),
      mode: json?.mode ?? mode,
      durable: Boolean(json?.durable),
      mutationCount: mutations.length,
    });
    window.dispatchEvent(new Event(SNAPSHOT_PRODUCTION_PORT_EVENT_V77));
    return { ok: true, mode: json?.mode ?? mode, durable: Boolean(json?.durable), state: json?.state };
  } catch (error: any) {
    savePendingMutationsV77(mutations);
    if (mode === "production_api") {
      return { ok: false, mode, durable: false, error: error?.message ?? String(error) };
    }
    return { ok: true, mode: "production_api_with_local_fallback", durable: false, state, error: error?.message ?? String(error) };
  }
}

async function pullSnapshotProgressV77(): Promise<SnapshotBackendSyncResultV77> {
  const mode = snapshotBackendModeV77();
  if (mode === "local_dev" && !snapshotBackendIdentityV77().installId) {
    return { ok: true, mode, durable: false, state: readSnapshotCompletePortStateV76() };
  }
  const identity = snapshotBackendIdentityV77();
  const params = new URLSearchParams();
  params.set("mode", mode);
  if (identity.installId) params.set("install_id", identity.installId);
  if (identity.gameUserId) params.set("game_user_id", identity.gameUserId);
  if (identity.sessionId) params.set("session_id", identity.sessionId);
  if (identity.titleId) params.set("title_id", identity.titleId);
  const response = await fetch(`${SNAPSHOT_STATE_ENDPOINT_V77}?${params.toString()}`);
  const json = await response.json().catch(() => undefined);
  if (!response.ok || json?.ok === false) {
    return { ok: false, mode, durable: false, error: json?.error ?? `snapshot progress backend ${response.status}` };
  }
  return { ok: true, mode: json?.mode ?? mode, durable: Boolean(json?.durable), state: json?.state };
}

function mergeBackendStateIntoV76LocalV77(serverState: any) {
  if (!serverState) return;
  const local = readSnapshotCompletePortStateV76();
  const merged = {
    ...local,
    acceptedMissionIds: uniqueV77([...(local.acceptedMissionIds ?? []), ...(serverState.acceptedMissionIds ?? [])]),
    activeMissionId: local.activeMissionId ?? serverState.activeMissionId,
    activeStepIndex: Math.max(Number(local.activeStepIndex ?? 0), Number(serverState.activeStepIndex ?? 0)),
    completedMissionIds: uniqueV77([...(local.completedMissionIds ?? []), ...(serverState.completedMissionIds ?? [])]),
    completedStepIds: uniqueV77([...(local.completedStepIds ?? []), ...(serverState.completedStepIds ?? [])]),
    grantedRewardIds: uniqueV77([...(local.grantedRewardIds ?? []), ...(serverState.grantedRewardIds ?? [])]),
    grantedItemIds: uniqueV77([...(local.grantedItemIds ?? []), ...(serverState.grantedItemSymbols ?? [])]),
    xp: Math.max(Number(local.xp ?? 0), Number(serverState.xp ?? 0)),
    bling: Math.max(Number(local.bling ?? 0), Number(serverState.bling ?? 0)),
    audioLog: uniqueV77([...(local.audioLog ?? []), ...(serverState.audioCueIds ?? [])]).slice(0, 40),
    photoProofIds: uniqueV77([...(local.photoProofIds ?? []), ...(serverState.photoProofIds ?? [])]),
    fishingCatchIds: uniqueV77([...(local.fishingCatchIds ?? []), ...(serverState.fishingCatchIds ?? [])]),
    clearedMuckIds: uniqueV77([...(local.clearedMuckIds ?? []), ...(serverState.clearedMuckIds ?? [])]),
  };
  writeSnapshotCompletePortStateV76(merged as any);
}

export function runSnapshotProductionAuditV77() {
  const state = readSnapshotCompletePortStateV76();
  const rewards = SNAPSHOT_STRUCTURED_REWARDS_V76.flatMap((reward) => [
    ...reward.items,
    ...reward.recipes,
    ...reward.codex,
  ]);
  const unresolvedRewardSymbols = uniqueV77(rewards).filter(
    (symbol) => symbol.startsWith("codex_") ? false : !snapshotResolveRewardItemsV77([symbol]).length,
  );
  const missingAudioFiles = SNAPSHOT_AUDIO_FILE_BINDINGS_V77.filter(
    (binding) => !binding.staticPath.includes("/assets/asset_data/audio/"),
  );
  return {
    version: SNAPSHOT_PRODUCTION_PORT_VERSION_V77,
    backend: SNAPSHOT_DUAL_MODE_STATE_BACKEND_VERSION_V77,
    bikkieRewards: SNAPSHOT_FINAL_BIKKIE_REWARD_BINDING_VERSION_V77,
    playerBuilder: SNAPSHOT_GROVE_PLAYER_BUILDER_UI_VERSION_V77,
    muckMutation: SNAPSHOT_CANONICAL_MUCK_MUTATIONS_V77.version,
    mode: snapshotBackendModeV77(),
    identity: snapshotBackendIdentityV77(),
    pendingMutations: pendingMutationsV77().length,
    completedMissions: state.completedMissionIds.length,
    clearedMuck: state.clearedMuckIds.length,
    photoProofs: state.photoProofIds.length,
    fishingCatches: state.fishingCatchIds.length,
    unresolvedRewardSymbols,
    missingAudioFiles,
    boundsRecords: SNAPSHOT_GROVE_NPC_VISUAL_BOUNDS_V77.length,
    pass: unresolvedRewardSymbols.length === 0 && missingAudioFiles.length === 0,
  };
}

export const SnapshotProductionPortRuntimeControllerV77: React.FunctionComponent<{}> = () => {
  const { gardenHose } = useClientContext();

  useEffect(() => {
    let disposed = false;
    const sync = async (reason: string) => {
      const result = await postSnapshotProgressV77({ reason });
      if (!disposed && result.state) {
        mergeBackendStateIntoV76LocalV77(result.state);
      }
    };
    const timeout = window.setTimeout(() => void sync("mount"), 1200);
    const interval = window.setInterval(() => void sync("interval"), 20_000);
    const onV76 = () => void sync("v76_state_changed");
    window.addEventListener(SNAPSHOT_COMPLETE_PORT_EVENT_V76, onV76);
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      window.removeEventListener(SNAPSHOT_COMPLETE_PORT_EVENT_V76, onV76);
    };
  }, []);

  useEffect(() => {
    // BIOMES_SNAPSHOT_PROGRESS_DEBOUNCE_V89
    // Garden hose can emit many pickup/progress events per second while the
    // imported snapshot systems are active. Calling the backend route once per
    // event flooded the web/logic logs and amplified stale pickup retries. Queue
    // mutations immediately, then flush them as one compacted sync.
    let disposed = false;
    let flushTimer: number | undefined;
    const pendingReasons = new Set<string>();
    const flush = () => {
      flushTimer = undefined;
      if (disposed) return;
      const reason = pendingReasons.size
        ? `garden_hose_batch_${[...pendingReasons].slice(0, 6).join("_")}`
        : "garden_hose_batch";
      pendingReasons.clear();
      void postSnapshotProgressV77({ reason });
    };
    const scheduleFlush = (reason: string) => {
      pendingReasons.add(reason);
      if (flushTimer !== undefined) return;
      flushTimer = window.setTimeout(flush, 1500);
    };
    const handler = (event: GardenHoseEvent) => {
      const mutation = mutationFromEventV77(event);
      if (mutation) {
        queueMutationV77(mutation);
        scheduleFlush(String((event as any).kind ?? "event"));
      }
    };
    gardenHose.on("anyEvent", handler);
    return () => {
      disposed = true;
      if (flushTimer !== undefined) window.clearTimeout(flushTimer);
      gardenHose.off("anyEvent", handler);
    };
  }, [gardenHose]);

  useEffect(() => {
    if (!browserV77()) {
      return;
    }
    const win = window as typeof window & { __snapshotV77?: unknown };
    win.__snapshotV77 = {
      version: SNAPSHOT_PRODUCTION_PORT_VERSION_V77,
      backendRules: SNAPSHOT_STATE_BACKEND_RULES_V77,
      mode: snapshotBackendModeV77,
      setMode: (mode: SnapshotStateBackendModeV77) => {
        window.localStorage.setItem(SNAPSHOT_STATE_BACKEND_RULES_V77.localStorageModeKey, mode);
        window.dispatchEvent(new Event(SNAPSHOT_PRODUCTION_PORT_EVENT_V77));
      },
      identity: snapshotBackendIdentityV77,
      sync: (reason = "debug") => postSnapshotProgressV77({ reason }),
      pull: async () => {
        const result = await pullSnapshotProgressV77();
        if (result.state) mergeBackendStateIntoV76LocalV77(result.state);
        return result;
      },
      pending: pendingMutationsV77,
      audit: runSnapshotProductionAuditV77,
      rewardBindings: SNAPSHOT_FINAL_BIKKIE_REWARD_BINDING_VERSION_V77,
      audioBindings: SNAPSHOT_AUDIO_FILE_BINDINGS_V77,
      resolveRewards: snapshotResolveRewardItemsV77,
      npcBounds: SNAPSHOT_GROVE_NPC_VISUAL_BOUNDS_V77,
      clearLocalOnlyMirrors: () => {
        window.localStorage.removeItem(SNAPSHOT_CLEARED_MUCK_KEY_V76);
        window.localStorage.removeItem(SNAPSHOT_PHOTO_PROOFS_KEY_V76);
        removeJsonScopedLocalV77(SNAPSHOT_PRODUCTION_PENDING_KEY_V77);
        window.dispatchEvent(new Event(SNAPSHOT_PRODUCTION_PORT_EVENT_V77));
      },
    };
  }, []);

  return null;
};

export const SnapshotProductionPortStatusPanelV77: React.FunctionComponent<{}> = () => {
  const [audit, setAudit] = useState(() => runSnapshotProductionAuditV77());
  const [lastSync, setLastSync] = useState<any>(() => readJsonScopedLocalV77(SNAPSHOT_BACKEND_LAST_SYNC_KEY_V77, undefined));

  useEffect(() => {
    const refresh = () => {
      setAudit(runSnapshotProductionAuditV77());
      setLastSync(readJsonScopedLocalV77(SNAPSHOT_BACKEND_LAST_SYNC_KEY_V77, undefined));
    };
    refresh();
    const interval = window.setInterval(refresh, 1500);
    window.addEventListener(SNAPSHOT_PRODUCTION_PORT_EVENT_V77, refresh);
    window.addEventListener(SNAPSHOT_COMPLETE_PORT_EVENT_V76, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(SNAPSHOT_PRODUCTION_PORT_EVENT_V77, refresh);
      window.removeEventListener(SNAPSHOT_COMPLETE_PORT_EVENT_V76, refresh);
    };
  }, []);

  const modeLabel = audit.mode.replace(/_/g, " ");
  return (
    <div className="rounded border border-emerald-200/20 bg-emerald-950/30 p-2 text-white">
      <div className="text-sm font-semibold">Snapshot Production Port</div>
      <div className="text-[10px] uppercase tracking-wide text-emerald-100/80">
        {SNAPSHOT_PRODUCTION_PORT_VERSION_V77}
      </div>
      <div className="mt-1 text-xs text-white/75">
        Mode: {modeLabel} · Pending backend writes: {audit.pendingMutations}
      </div>
      <div className="mt-1 text-[11px] text-white/60">
        Completed: {audit.completedMissions} · Cleared muck: {audit.clearedMuck} · Photos: {audit.photoProofs} · Fish: {audit.fishingCatches}
      </div>
      <div className="mt-1 text-[11px] text-white/60">
        Reward ids: {SNAPSHOT_FINAL_BIKKIE_REWARD_BINDING_VERSION_V77} · Audio files: {SNAPSHOT_AUDIO_FILE_BINDINGS_V77.length} · Bounds: {SNAPSHOT_GROVE_NPC_VISUAL_BOUNDS_V77.length}
      </div>
      {lastSync && (
        <div className="mt-1 text-[11px] text-white/55">
          Last sync: {lastSync.durable ? "durable" : "local/fallback"} · {lastSync.mutationCount ?? 0} mutations
        </div>
      )}
      {!audit.pass && (
        <div className="mt-1 rounded bg-red-500/20 p-1 text-[11px] text-red-100">
          Audit: {audit.unresolvedRewardSymbols.length} unresolved reward symbols, {audit.missingAudioFiles.length} missing audio bindings.
        </div>
      )}
    </div>
  );
};

export const SnapshotProductionPortFactsV77: React.FunctionComponent<{}> = () => {
  const rewardCount = useMemo(
    () => Object.keys(snapshotResolveRewardItemsV77(["practice_muck_buster", "camera", "fish"])).length,
    [],
  );
  return (
    <span className="hidden" data-snapshot-production-port-v77={SNAPSHOT_PRODUCTION_PORT_VERSION_V77}>
      {SNAPSHOT_FINAL_BIKKIE_REWARD_BINDING_VERSION_V77}
      {SNAPSHOT_GROVE_PLAYER_BUILDER_UI_VERSION_V77}
      {SNAPSHOT_GROVE_NPC_BOUNDS_PASS_VERSION_V77}
      {SNAPSHOT_CANONICAL_MUCK_MUTATIONS_V77.version}
      {rewardCount}
    </span>
  );
};
