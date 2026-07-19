import { harthmereLocalStorage } from "@/client/util/storage";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { GardenHoseEvent } from "@/client/events/api";
import type { Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_AUDIO_FILE_BINDINGS,
  SNAPSHOT_CANONICAL_MUCK_MUTATIONS,
  SNAPSHOT_DUAL_MODE_STATE_BACKEND_VERSION,
  SNAPSHOT_FINAL_BIKKIE_REWARD_BINDING_VERSION,
  SNAPSHOT_GROVE_NPC_BOUNDS_PASS_VERSION,
  SNAPSHOT_GROVE_NPC_VISUAL_BOUNDS,
  SNAPSHOT_GROVE_PLAYER_BUILDER_UI_VERSION,
  SNAPSHOT_PRODUCTION_PORT_VERSION,
  SNAPSHOT_STATE_BACKEND_RULES,
  SNAPSHOT_STATE_ENDPOINT,
  snapshotResolveRewardItems,
  type SnapshotBackendIdentity,
  type SnapshotProgressMutation,
  type SnapshotStateBackendMode,
} from "@/shared/harthmere/snapshot_production_port";
import {
  SNAPSHOT_AUDIO_CUES,
  SNAPSHOT_STRUCTURED_REWARDS,
} from "@/shared/harthmere/snapshot_complete_port";
import {
  resolveSnapshotBackendEnvironment,
  resolveSnapshotProgressEndpoint,
} from "@/shared/harthmere/snapshot_backend_resolver";
import {
  readSnapshotCompletePortState,
  SNAPSHOT_CLEARED_MUCK_KEY,
  SNAPSHOT_COMPLETE_PORT_EVENT,
  SNAPSHOT_COMPLETE_PORT_STATE_KEY,
  SNAPSHOT_PHOTO_PROOFS_KEY,
  writeSnapshotCompletePortState,
  snapshotCompletePortDurableStateFingerprintForTest,
  snapshotPlayerScopedStorageKey,
} from "@/client/components/challenges/LocalDevSnapshotCompletePort";
import React, { useEffect, useMemo, useState } from "react";

export const SNAPSHOT_PRODUCTION_PORT_EVENT = "biomes:snapshot-production-port";
export const SNAPSHOT_PRODUCTION_PENDING_KEY =
  "biomes.snapshot.pendingMutations";
export const SNAPSHOT_BACKEND_LAST_SYNC_KEY = "biomes.snapshot.lastBackendSync";

type SnapshotBackendSyncResult = {
  ok: boolean;
  mode: SnapshotStateBackendMode | string;
  durable: boolean;
  state?: any;
  error?: string;
};

function browser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function unique<T>(items: T[]): T[] {
  return [
    ...new Set(items.filter((item) => item !== undefined && item !== null)),
  ];
}

function readJsonLocal<T>(key: string, fallback: T): T {
  if (!browser()) {
    return fallback;
  }
  try {
    const raw = harthmereLocalStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonLocal(key: string, value: unknown) {
  if (!browser()) {
    return;
  }
  harthmereLocalStorage.setItem(key, JSON.stringify(value));
}

function readJsonScopedLocal<T>(key: string, fallback: T): T {
  return readJsonLocal(snapshotPlayerScopedStorageKey(key), fallback);
}

function writeJsonScopedLocal(key: string, value: unknown) {
  writeJsonLocal(snapshotPlayerScopedStorageKey(key), value);
}

function removeJsonScopedLocal(key: string) {
  if (!browser()) return;
  harthmereLocalStorage.removeItem(snapshotPlayerScopedStorageKey(key));
  harthmereLocalStorage.removeItem(key);
}

function queryValue(names: string[]) {
  if (!browser()) {
    return undefined;
  }
  const params = new URLSearchParams(window.location.search);
  for (const name of names) {
    const fromQuery = params.get(name);
    if (fromQuery?.trim()) {
      return fromQuery.trim();
    }
    const fromStorage = harthmereLocalStorage.getItem(name);
    if (fromStorage?.trim()) {
      return fromStorage.trim();
    }
  }
  return undefined;
}

export function snapshotBackendIdentity(): SnapshotBackendIdentity {
  return {
    installId: queryValue([
      "install_id",
      "glitch_install_id",
      "GLITCH_INSTALL_ID",
      "GLITCH_USER_INSTALL_ID",
      "biomes.glitch.installId",
    ]),
    gameUserId: queryValue([
      "game_user_id",
      "glitch_game_user_id",
      "GLITCH_GAME_USER_ID",
      "biomes.glitch.gameUserId",
    ]),
    sessionId: queryValue([
      "session_id",
      "glitch_session_id",
      "GLITCH_SESSION_ID",
      "biomes.glitch.sessionId",
    ]),
    titleId: queryValue([
      "title_id",
      "glitch_title_id",
      "GLITCH_TITLE_ID",
      "biomes.glitch.titleId",
    ]),
  };
}

export function snapshotBackendMode(): SnapshotStateBackendMode {
  if (!browser()) {
    return "auto";
  }
  const explicit = harthmereLocalStorage.getItem(
    SNAPSHOT_STATE_BACKEND_RULES.localStorageModeKey
  ) as SnapshotStateBackendMode | null;
  if (
    explicit === "local_dev" ||
    explicit === "production_api" ||
    explicit === "production_api_with_local_fallback"
  ) {
    return explicit;
  }
  const host = window.location.hostname;
  const identity = snapshotBackendIdentity();
  if (host === "localhost" || host === "127.0.0.1") {
    return identity.installId
      ? "production_api_with_local_fallback"
      : "local_dev";
  }
  return "production_api_with_local_fallback";
}

// Resolved snapshot progress endpoint. Per patch 04, this routes mission /
// quest / snapshot state through the current resolver so production can swap the
// backing service (Laravel, bespoke microservice, anything compatible) by
// setting GLITCH_SNAPSHOT_BACKEND_MODE / GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL
// at deploy time. Glitch-specific endpoints (install validation, save sync,
// achievements, leaderboards) stay hard-wired at /api/glitch/harthmere and
// do not go through this helper.
function resolveSnapshotProgressEndpointForRuntime(): string {
  const env = (typeof process !== "undefined" && (process as any).env) || {};
  const browserEnv =
    browser() && typeof window !== "undefined"
      ? ((window as any).__GLITCH_RUNTIME_ENV__ as
          | Record<string, string | undefined>
          | undefined)
      : undefined;
  const resolved = resolveSnapshotBackendEnvironment({
    NODE_ENV: env.NODE_ENV ?? browserEnv?.NODE_ENV,
    GLITCH_SNAPSHOT_BACKEND_MODE:
      env.NEXT_PUBLIC_GLITCH_SNAPSHOT_BACKEND_MODE ??
      env.GLITCH_SNAPSHOT_BACKEND_MODE ??
      browserEnv?.GLITCH_SNAPSHOT_BACKEND_MODE,
    GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL:
      env.NEXT_PUBLIC_GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL ??
      env.GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL ??
      browserEnv?.GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL,
    GLITCH_SNAPSHOT_PROGRESS_ENDPOINT:
      env.NEXT_PUBLIC_GLITCH_SNAPSHOT_PROGRESS_ENDPOINT ??
      env.GLITCH_SNAPSHOT_PROGRESS_ENDPOINT ??
      browserEnv?.GLITCH_SNAPSHOT_PROGRESS_ENDPOINT,
    GLITCH_SNAPSHOT_HEALTH_ENDPOINT:
      env.NEXT_PUBLIC_GLITCH_SNAPSHOT_HEALTH_ENDPOINT ??
      env.GLITCH_SNAPSHOT_HEALTH_ENDPOINT ??
      browserEnv?.GLITCH_SNAPSHOT_HEALTH_ENDPOINT,
  });
  return resolveSnapshotProgressEndpoint(resolved) || SNAPSHOT_STATE_ENDPOINT;
}

function pendingMutations(): SnapshotProgressMutation[] {
  return readJsonScopedLocal(SNAPSHOT_PRODUCTION_PENDING_KEY, []);
}

function savePendingMutations(mutations: SnapshotProgressMutation[]) {
  writeJsonScopedLocal(SNAPSHOT_PRODUCTION_PENDING_KEY, mutations.slice(-100));
}

function queueMutation(mutation: SnapshotProgressMutation) {
  savePendingMutations([...pendingMutations(), mutation]);
}

function mutationFromEvent(
  event: GardenHoseEvent
): SnapshotProgressMutation | undefined {
  const anyEvent = event as any;
  const kind = anyEvent.kind as string | undefined;
  const state = readSnapshotCompletePortState();
  const base = {
    missionId: state.activeMissionId,
    stepId: state.completedStepIds[state.completedStepIds.length - 1],
    occurredAtMs: Date.now(),
  };
  if (kind === "clear_muck" || kind === "destroy") {
    return {
      ...base,
      kind: "clear_muck",
      markerId: String(
        anyEvent.markerId ?? state.lastMarkerId ?? "muckwad_patch"
      ),
      position: (Array.isArray(anyEvent.position)
        ? anyEvent.position
        : state.lastMarkerPosition) as Vec3 | undefined,
      audioCue: SNAPSHOT_AUDIO_CUES.muckClear,
    };
  }
  if (
    kind === "photo_post_attempt" ||
    kind === "photo_post" ||
    kind === "show_post_capture"
  ) {
    return {
      ...base,
      kind: "photo_proof",
      proofId: String(
        anyEvent.postId ?? anyEvent.photoId ?? `photo_${Date.now()}`
      ),
      markerId: String(state.lastMarkerId ?? "shutter_cove_marker"),
      audioCue: SNAPSHOT_AUDIO_CUES.cameraShutter,
    };
  }
  if (kind === "fishing_catch") {
    return {
      ...base,
      kind: "fishing_catch",
      catchId: String(
        anyEvent.catchId ?? anyEvent.itemId ?? `fish_${Date.now()}`
      ),
      markerId: String(state.lastMarkerId ?? "shutter_cove_marker"),
      audioCue: SNAPSHOT_AUDIO_CUES.fishingCatch,
    };
  }
  return undefined;
}

function compactMutations(mutations: SnapshotProgressMutation[]) {
  const seen = new Set<string>();
  const compacted: SnapshotProgressMutation[] = [];
  for (const mutation of mutations) {
    const key = snapshotProgressMutationKey(mutation);
    if (!seen.has(key)) {
      seen.add(key);
      compacted.push(mutation);
    }
  }
  return compacted.slice(-100);
}

function snapshotProgressMutationKey(mutation: SnapshotProgressMutation) {
  return [
    mutation.kind,
    mutation.missionId ?? "",
    mutation.stepId ?? "",
    mutation.markerId ?? "",
    mutation.rewardId ?? "",
    mutation.proofId ?? "",
    mutation.catchId ?? "",
  ].join(":");
}

let snapshotProgressInFlight: Promise<SnapshotBackendSyncResult> | undefined;
let snapshotProgressFollowupRequested = false;
let snapshotProgressInFlightStateFingerprint: string | undefined;
let snapshotProgressInFlightMutationKeys = new Set<string>();

function snapshotProgressStateFingerprint(state: any) {
  return snapshotCompletePortDurableStateFingerprintForTest(state);
}

async function postSnapshotProgressOnce(input: {
  mutation?: SnapshotProgressMutation;
  state?: any;
  reason: string;
}): Promise<SnapshotBackendSyncResult> {
  const mode = snapshotBackendMode();
  const state = input.state ?? readSnapshotCompletePortState();
  const capturedPendingMutations = pendingMutations();
  const mutations = compactMutations([
    ...capturedPendingMutations,
    ...(input.mutation ? [input.mutation] : []),
  ]);

  if (mode === "local_dev" && !snapshotBackendIdentity().installId) {
    queueMutation({
      kind: "sync_state",
      state,
      occurredAtMs: Date.now(),
    });
    return { ok: true, mode, durable: false, state };
  }

  try {
    const endpoint = resolveSnapshotProgressEndpointForRuntime();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: SNAPSHOT_PRODUCTION_PORT_VERSION,
        mode,
        reason: input.reason,
        identity: snapshotBackendIdentity(),
        state,
        mutations,
      }),
    });
    const json = await response.json().catch(() => undefined);
    if (!response.ok || json?.ok === false) {
      throw new Error(
        json?.error ?? `snapshot progress backend ${response.status}`
      );
    }
    const capturedKeys = new Set(
      capturedPendingMutations.map(snapshotProgressMutationKey)
    );
    savePendingMutations(
      pendingMutations().filter(
        (mutation) => !capturedKeys.has(snapshotProgressMutationKey(mutation))
      )
    );
    writeJsonScopedLocal(SNAPSHOT_BACKEND_LAST_SYNC_KEY, {
      at: Date.now(),
      mode: json?.mode ?? mode,
      durable: Boolean(json?.durable),
      mutationCount: mutations.length,
    });
    window.dispatchEvent(new Event(SNAPSHOT_PRODUCTION_PORT_EVENT));
    return {
      ok: true,
      mode: json?.mode ?? mode,
      durable: Boolean(json?.durable),
      state: json?.state,
    };
  } catch (error: any) {
    // A request can fail after new events were queued. Preserve both the
    // attempted batch and those newer events; overwriting with `mutations`
    // would silently lose progress recorded while the request was in flight.
    savePendingMutations(
      compactMutations([...pendingMutations(), ...mutations])
    );
    if (mode === "production_api") {
      return {
        ok: false,
        mode,
        durable: false,
        error: error?.message ?? String(error),
      };
    }
    return {
      ok: true,
      mode: "production_api_with_local_fallback",
      durable: false,
      state,
      error: error?.message ?? String(error),
    };
  }
}

async function postSnapshotProgress(input: {
  mutation?: SnapshotProgressMutation;
  state?: any;
  reason: string;
}): Promise<SnapshotBackendSyncResult> {
  const state = input.state ?? readSnapshotCompletePortState();
  const stateFingerprint = snapshotProgressStateFingerprint(state);
  const pendingKeys = new Set(
    pendingMutations().map(snapshotProgressMutationKey)
  );
  if (input.mutation) {
    pendingKeys.add(snapshotProgressMutationKey(input.mutation));
  }
  if (snapshotProgressInFlight) {
    snapshotProgressFollowupRequested ||=
      stateFingerprint !== snapshotProgressInFlightStateFingerprint ||
      [...pendingKeys].some(
        (key) => !snapshotProgressInFlightMutationKeys.has(key)
      );
    return snapshotProgressInFlight;
  }
  snapshotProgressInFlightStateFingerprint = stateFingerprint;
  snapshotProgressInFlightMutationKeys = pendingKeys;
  snapshotProgressInFlight = postSnapshotProgressOnce({
    ...input,
    state,
  }).finally(() => {
    const completedFingerprint = snapshotProgressInFlightStateFingerprint;
    const completedMutationKeys = snapshotProgressInFlightMutationKeys;
    snapshotProgressInFlight = undefined;
    snapshotProgressInFlightStateFingerprint = undefined;
    snapshotProgressInFlightMutationKeys = new Set<string>();
    if (snapshotProgressFollowupRequested) {
      snapshotProgressFollowupRequested = false;
      const nextState = readSnapshotCompletePortState();
      const nextPendingKeys = pendingMutations().map(
        snapshotProgressMutationKey
      );
      const hasNewDurableWork =
        snapshotProgressStateFingerprint(nextState) !== completedFingerprint ||
        nextPendingKeys.some((key) => !completedMutationKeys.has(key));
      if (hasNewDurableWork) {
        void postSnapshotProgress({
          reason: "coalesced_followup",
          state: nextState,
        });
      }
    }
  });
  return snapshotProgressInFlight;
}

async function pullSnapshotProgress(): Promise<SnapshotBackendSyncResult> {
  const mode = snapshotBackendMode();
  if (mode === "local_dev" && !snapshotBackendIdentity().installId) {
    return {
      ok: true,
      mode,
      durable: false,
      state: readSnapshotCompletePortState(),
    };
  }
  const identity = snapshotBackendIdentity();
  const params = new URLSearchParams();
  params.set("mode", mode);
  if (identity.installId) params.set("install_id", identity.installId);
  if (identity.gameUserId) params.set("game_user_id", identity.gameUserId);
  if (identity.sessionId) params.set("session_id", identity.sessionId);
  if (identity.titleId) params.set("title_id", identity.titleId);
  const response = await fetch(
    `${resolveSnapshotProgressEndpointForRuntime()}?${params.toString()}`
  );
  const json = await response.json().catch(() => undefined);
  if (!response.ok || json?.ok === false) {
    return {
      ok: false,
      mode,
      durable: false,
      error: json?.error ?? `snapshot progress backend ${response.status}`,
    };
  }
  return {
    ok: true,
    mode: json?.mode ?? mode,
    durable: Boolean(json?.durable),
    state: json?.state,
  };
}

function mergeBackendStateIntoLocalSnapshot(serverState: any) {
  if (!serverState) return;
  const local = readSnapshotCompletePortState();
  const merged = {
    ...local,
    acceptedMissionIds: unique([
      ...(local.acceptedMissionIds ?? []),
      ...(serverState.acceptedMissionIds ?? []),
    ]),
    activeMissionId: local.activeMissionId ?? serverState.activeMissionId,
    activeStepIndex: Math.max(
      Number(local.activeStepIndex ?? 0),
      Number(serverState.activeStepIndex ?? 0)
    ),
    completedMissionIds: unique([
      ...(local.completedMissionIds ?? []),
      ...(serverState.completedMissionIds ?? []),
    ]),
    completedStepIds: unique([
      ...(local.completedStepIds ?? []),
      ...(serverState.completedStepIds ?? []),
    ]),
    grantedRewardIds: unique([
      ...(local.grantedRewardIds ?? []),
      ...(serverState.grantedRewardIds ?? []),
    ]),
    grantedItemIds: unique([
      ...(local.grantedItemIds ?? []),
      ...(serverState.grantedItemSymbols ?? []),
    ]),
    xp: Math.max(Number(local.xp ?? 0), Number(serverState.xp ?? 0)),
    bling: Math.max(Number(local.bling ?? 0), Number(serverState.bling ?? 0)),
    audioLog: unique([
      ...(local.audioLog ?? []),
      ...(serverState.audioCueIds ?? []),
    ]).slice(0, 40),
    photoProofIds: unique([
      ...(local.photoProofIds ?? []),
      ...(serverState.photoProofIds ?? []),
    ]),
    fishingCatchIds: unique([
      ...(local.fishingCatchIds ?? []),
      ...(serverState.fishingCatchIds ?? []),
    ]),
    clearedMuckIds: unique([
      ...(local.clearedMuckIds ?? []),
      ...(serverState.clearedMuckIds ?? []),
    ]),
  };
  writeSnapshotCompletePortState(merged as any);
}

export function runSnapshotProductionAudit() {
  const state = readSnapshotCompletePortState();
  const rewards = SNAPSHOT_STRUCTURED_REWARDS.flatMap((reward) => [
    ...reward.items,
    ...reward.recipes,
    ...reward.codex,
  ]);
  const unresolvedRewardSymbols = unique(rewards).filter((symbol) =>
    symbol.startsWith("codex_")
      ? false
      : !snapshotResolveRewardItems([symbol]).length
  );
  const missingAudioFiles = SNAPSHOT_AUDIO_FILE_BINDINGS.filter(
    (binding) => !binding.staticPath.includes("/assets/asset_data/audio/")
  );
  return {
    version: SNAPSHOT_PRODUCTION_PORT_VERSION,
    backend: SNAPSHOT_DUAL_MODE_STATE_BACKEND_VERSION,
    bikkieRewards: SNAPSHOT_FINAL_BIKKIE_REWARD_BINDING_VERSION,
    playerBuilder: SNAPSHOT_GROVE_PLAYER_BUILDER_UI_VERSION,
    muckMutation: SNAPSHOT_CANONICAL_MUCK_MUTATIONS.version,
    mode: snapshotBackendMode(),
    identity: snapshotBackendIdentity(),
    pendingMutations: pendingMutations().length,
    completedMissions: state.completedMissionIds.length,
    clearedMuck: state.clearedMuckIds.length,
    photoProofs: state.photoProofIds.length,
    fishingCatches: state.fishingCatchIds.length,
    unresolvedRewardSymbols,
    missingAudioFiles,
    boundsRecords: SNAPSHOT_GROVE_NPC_VISUAL_BOUNDS.length,
    pass:
      unresolvedRewardSymbols.length === 0 && missingAudioFiles.length === 0,
  };
}

export const SnapshotProductionPortRuntimeController: React.FunctionComponent<{}> =
  () => {
    const { gardenHose } = useClientContext();

    useEffect(() => {
      let disposed = false;
      let stateChangeTimer: number | undefined;
      const sync = async (reason: string, mergeBackendState = true) => {
        const result = await postSnapshotProgress({ reason });
        if (!disposed && mergeBackendState && result.state) {
          mergeBackendStateIntoLocalSnapshot(result.state);
        }
      };
      const timeout = window.setTimeout(() => void sync("mount"), 1200);
      const interval = window.setInterval(() => void sync("interval"), 20_000);
      // A current local state write already dispatched this event. Push it to the
      // backend, but do not merge the echoed backend state immediately, because
      // mergeBackendStateIntoLocalSnapshot writes current state again and re-fires this
      // event. That feedback loop floods /api/glitch/snapshot_progress locally.
      const on = () => {
        if (stateChangeTimer !== undefined) return;
        stateChangeTimer = window.setTimeout(() => {
          stateChangeTimer = undefined;
          if (!disposed) void sync("snapshot_state_changed", false);
        }, 1_000);
      };
      window.addEventListener(SNAPSHOT_COMPLETE_PORT_EVENT, on);
      return () => {
        disposed = true;
        window.clearTimeout(timeout);
        if (stateChangeTimer !== undefined)
          window.clearTimeout(stateChangeTimer);
        window.clearInterval(interval);
        window.removeEventListener(SNAPSHOT_COMPLETE_PORT_EVENT, on);
      };
    }, []);

    useEffect(() => {
      // BIOMES_SNAPSHOT_PROGRESS_DEBOUNCE
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
        void postSnapshotProgress({ reason });
      };
      const scheduleFlush = (reason: string) => {
        pendingReasons.add(reason);
        if (flushTimer !== undefined) return;
        flushTimer = window.setTimeout(flush, 1500);
      };
      const handler = (event: GardenHoseEvent) => {
        const mutation = mutationFromEvent(event);
        if (mutation) {
          queueMutation(mutation);
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
      if (!browser()) {
        return;
      }
      const win = window as typeof window & { __snapshot?: unknown };
      win.__snapshot = {
        version: SNAPSHOT_PRODUCTION_PORT_VERSION,
        backendRules: SNAPSHOT_STATE_BACKEND_RULES,
        mode: snapshotBackendMode,
        setMode: (mode: SnapshotStateBackendMode) => {
          harthmereLocalStorage.setItem(
            SNAPSHOT_STATE_BACKEND_RULES.localStorageModeKey,
            mode
          );
          window.dispatchEvent(new Event(SNAPSHOT_PRODUCTION_PORT_EVENT));
        },
        identity: snapshotBackendIdentity,
        sync: (reason = "debug") => postSnapshotProgress({ reason }),
        pull: async () => {
          const result = await pullSnapshotProgress();
          if (result.state) mergeBackendStateIntoLocalSnapshot(result.state);
          return result;
        },
        pending: pendingMutations,
        audit: runSnapshotProductionAudit,
        rewardBindings: SNAPSHOT_FINAL_BIKKIE_REWARD_BINDING_VERSION,
        audioBindings: SNAPSHOT_AUDIO_FILE_BINDINGS,
        resolveRewards: snapshotResolveRewardItems,
        npcBounds: SNAPSHOT_GROVE_NPC_VISUAL_BOUNDS,
        clearLocalOnlyMirrors: () => {
          harthmereLocalStorage.removeItem(SNAPSHOT_CLEARED_MUCK_KEY);
          harthmereLocalStorage.removeItem(SNAPSHOT_PHOTO_PROOFS_KEY);
          removeJsonScopedLocal(SNAPSHOT_PRODUCTION_PENDING_KEY);
          window.dispatchEvent(new Event(SNAPSHOT_PRODUCTION_PORT_EVENT));
        },
      };
    }, []);

    return null;
  };

export const SnapshotProductionPortStatusPanel: React.FunctionComponent<{}> =
  () => {
    const [audit, setAudit] = useState(() => runSnapshotProductionAudit());
    const [lastSync, setLastSync] = useState<any>(() =>
      readJsonScopedLocal(SNAPSHOT_BACKEND_LAST_SYNC_KEY, undefined)
    );

    useEffect(() => {
      const refresh = () => {
        setAudit(runSnapshotProductionAudit());
        setLastSync(
          readJsonScopedLocal(SNAPSHOT_BACKEND_LAST_SYNC_KEY, undefined)
        );
      };
      refresh();
      const interval = window.setInterval(refresh, 1500);
      window.addEventListener(SNAPSHOT_PRODUCTION_PORT_EVENT, refresh);
      window.addEventListener(SNAPSHOT_COMPLETE_PORT_EVENT, refresh);
      return () => {
        window.clearInterval(interval);
        window.removeEventListener(SNAPSHOT_PRODUCTION_PORT_EVENT, refresh);
        window.removeEventListener(SNAPSHOT_COMPLETE_PORT_EVENT, refresh);
      };
    }, []);

    const modeLabel = audit.mode.replace(/_/g, " ");
    return (
      <div className="rounded border-emerald-200/20 bg-emerald-950/30 border p-2 text-white">
        <div className="text-sm font-semibold">Snapshot Production Port</div>
        <div className="text-emerald-100/80 text-[10px] uppercase tracking-wide">
          {SNAPSHOT_PRODUCTION_PORT_VERSION}
        </div>
        <div className="mt-1 text-xs text-white/75">
          Mode: {modeLabel} · Pending backend writes: {audit.pendingMutations}
        </div>
        <div className="mt-1 text-[11px] text-white/60">
          Completed: {audit.completedMissions} · Cleared muck:{" "}
          {audit.clearedMuck} · Photos: {audit.photoProofs} · Fish:{" "}
          {audit.fishingCatches}
        </div>
        <div className="mt-1 text-[11px] text-white/60">
          Reward ids: {SNAPSHOT_FINAL_BIKKIE_REWARD_BINDING_VERSION} · Audio
          files: {SNAPSHOT_AUDIO_FILE_BINDINGS.length} · Bounds:{" "}
          {SNAPSHOT_GROVE_NPC_VISUAL_BOUNDS.length}
        </div>
        {lastSync && (
          <div className="text-white/55 mt-1 text-[11px]">
            Last sync: {lastSync.durable ? "durable" : "local/fallback"} ·{" "}
            {lastSync.mutationCount ?? 0} mutations
          </div>
        )}
        {!audit.pass && (
          <div className="rounded bg-red-500/20 text-red-100 mt-1 p-1 text-[11px]">
            Audit: {audit.unresolvedRewardSymbols.length} unresolved reward
            symbols, {audit.missingAudioFiles.length} missing audio bindings.
          </div>
        )}
      </div>
    );
  };

export const SnapshotProductionPortFacts: React.FunctionComponent<{}> = () => {
  const rewardCount = useMemo(
    () =>
      Object.keys(
        snapshotResolveRewardItems(["practice_muck_buster", "camera", "fish"])
      ).length,
    []
  );
  return (
    <span
      className="hidden"
      data-snapshot-production-port={SNAPSHOT_PRODUCTION_PORT_VERSION}
    >
      {SNAPSHOT_FINAL_BIKKIE_REWARD_BINDING_VERSION}
      {SNAPSHOT_GROVE_PLAYER_BUILDER_UI_VERSION}
      {SNAPSHOT_GROVE_NPC_BOUNDS_PASS_VERSION}
      {SNAPSHOT_CANONICAL_MUCK_MUTATIONS.version}
      {rewardCount}
    </span>
  );
};
