import type { ClientContext } from "@/client/game/context";
import {
  HARTHMERE_GLITCH_IDENTITY_KEY,
  HARTHMERE_GLITCH_IDENTITY_CHANGED_EVENT,
  HARTHMERE_GLITCH_SESSION_DISCONNECTED_EVENT,
  type HarthmereGlitchIdentity,
  readHarthmereGlitchIdentity,
  writeHarthmereGlitchIdentity,
} from "@/client/game/glitch/harthmere_glitch_identity";
import { useEffect, useRef } from "react";
import {
  HARTHMERE_GLITCH_BEHAVIOR_EVENT_NAME,
  type HarthmereGlitchBehaviorEvent,
} from "@/client/game/glitch/harthmere_glitch_behavior_events";
import {
  resolveHarthmereGlitchEventText,
  type HarthmereGlitchEventText,
} from "@/client/game/glitch/harthmere_glitch_event_catalog";
import { shouldApplyHarthmereCloudSave } from "@/client/game/glitch/harthmere_cloud_save_restore_policy";
import { HARTHMERE_INVENTORY_EVENT } from "@/client/components/challenges/harthmereEvents";

import { BIOMES_GAME_NAME } from "@/shared/biomes/display_names";
const DEFAULT_HARTHMERE_TITLE_ID = "42de534c-600f-4228-af9e-b69faef94cce";
const HARTHMERE_GLITCH_BRIDGE_FETCH_TIMEOUT_MS = 15_000;
const HARTHMERE_STORAGE_PREFIX = "biomes.localDev.harthmere.";
export const HARTHMERE_GLITCH_SAVE_SCHEMA_VERSION =
  "harthmere-glitch-save-all-state" as const;
export const HARTHMERE_GLITCH_REQUIRED_SAVE_KEYS = [
  "biomes.localDev.harthmere.activeUserScope",
  "biomes.localDev.harthmere.levelingState",
  "biomes.localDev.harthmere.questState",
  "biomes.localDev.snapshotGroveQuestState",
  "biomes.localDev.snapshotGroveLikeability",
  "biomes.localDev.snapshotMissionState",
  "biomes.localDev.snapshotMissionEvents",
  "biomes.localDev.snapshotMissionRewards",
  "biomes.localDev.harthmere.trackedMissions",
  "biomes.localDev.harthmere.missionEvents",
  "biomes.localDev.harthmere.inventoryState",
  "biomes.localDev.harthmere.combatState",
  "biomes.localDev.harthmere.deathState",
  "biomes.localDev.harthmere.classSkillState",
  "biomes.localDev.harthmere.buildingState",
  "biomes.localDev.harthmere.economyState",
  "biomes.localDev.harthmere.gatheringState",
  "biomes.localDev.harthmere.guildState",
  "biomes.localDev.harthmere.questEconomyState",
  "biomes.localDev.harthmere.reputation",
  "biomes.localDev.harthmere.reputationState",
  "biomes.localDev.harthmere.vendorStockState",
  "biomes.localDev.harthmere.storageMailRecoveryState",
  "biomes.localDev.harthmere.tradeAuctionState",
  "biomes.localDev.harthmere.mountPetCollection",
  "biomes.localDev.harthmere.mountPetCollection.recent",
  "biomes.localDev.harthmere.multiplayerCombatState",
  "biomes.localDev.harthmere.dialogueMemory",
  "biomes.localDev.harthmere.dialogueSafety",
  "biomes.localDev.harthmere.foodStaminaState",
  "biomes.localDev.harthmere.rapidEconomyActions",
  "biomes.localDev.harthmere.pendingVendorTrade",
  "biomes.localDev.harthmere.npcAi.memory",
  "biomes.localDev.harthmere.npcAi.decisionLog",
  "biomes.localDev.harthmere.npcAi.debug",
  "biomes.localDev.liveEntityRobotEnergy",
  "biomes.localDev.liveEntityHelperQuests",
  "biomes.localDev.snapshotCombatState",
] as const;
export const HARTHMERE_GLITCH_REQUIRED_SAVE_KEY_PREFIXES = [
  "biomes.localDev.harthmere.playerFace.user.",
  "biomes.localDev.harthmere.playerBody.user.",
  "biomes.localDev.harthmere.playerClothing.user.",
  "biomes.localDev.harthmere.playerBody.user.",
  "biomes.localDev.harthmere.objectContainerContents.user.",
  "biomes.localDev.harthmere.foodStaminaState.user.",
  "biomes.localDev.liveEntityRobotEnergy.user.",
  "biomes.localDev.liveEntityHelperQuests.user.",
  "biomes.localDev.snapshotCompletePortState.snapshot-per-player-mission-state.",
  "biomes.localDev.snapshotPhotoProofs.snapshot-per-player-mission-state.",
  "biomes.localDev.snapshotClearedMuck.snapshot-per-player-mission-state.",
  "biomes.snapshot.pendingMutations.snapshot-per-player-mission-state.",
  "biomes.snapshot.lastBackendSync.snapshot-per-player-mission-state.",
] as const;
export const HARTHMERE_GLITCH_RESTORE_EVENTS = [
  "biomes:harthmere-glitch-cloud-save-restored",
  "biomes:local-dev-snapshot-grove-quest-state",
  "biomes:local-dev-snapshot-mission-state",
  "biomes:local-dev-snapshot-combat-state",
  "biomes:local-dev-snapshot-complete-port",
  "biomes:snapshot-production-port",
  "biomes:harthmere-leveling-changed",
  "biomes:harthmere-combat-changed",
  "biomes:harthmere-death-changed",
  HARTHMERE_INVENTORY_EVENT,
  "biomes:harthmere-quest-changed",
  "biomes:harthmere-quest-state-changed",
  "biomes:harthmere-mission-event",
  "biomes:harthmere-mission-tracking-changed",
  "biomes:harthmere-class-skill-changed",
  "biomes:harthmere-building-changed",
  "biomes:harthmere-economy-changed",
  "biomes:harthmere-gathering-changed",
  "biomes:harthmere-guild-changed",
  "biomes:harthmere-quest-economy-changed",
  "biomes:harthmere-reputation-changed",
  "biomes:harthmere-storage-mail-recovery-changed",
  "biomes:harthmere-trade-auction-changed",
  "biomes:harthmere-dialogue-changed",
  "biomes:harthmere-multiplayer-combat-changed",
  "biomes:harthmere-food-stamina-changed",
  "biomes:live-entity-robot-energy",
  "biomes:live-entity-helper-quest",
  // Avatar/appearance refresh: after a cloud restore writes the player's
  // face/body/clothing keys, the live avatar must re-read them so the restored
  // character design actually shows (otherwise it only applied on a hard
  // reload). These are the same events the customization UI fires on edit.
  "biomes:harthmere-face-changed",
  "biomes:harthmere-body-changed",
  "biomes:harthmere-clothing-changed",
  "biomes:harthmere-appearance-changed",
] as const;
const HARTHMERE_GLITCH_STATE_CHANGE_SAVE_EVENTS = [
  "biomes:local-dev-snapshot-combat-state",
  "biomes:local-dev-snapshot-complete-port",
  "biomes:snapshot-production-port",
  "biomes:harthmere-leveling-changed",
  "biomes:harthmere-combat-changed",
  "biomes:harthmere-death-changed",
  HARTHMERE_INVENTORY_EVENT,
  "biomes:harthmere-quest-changed",
  "biomes:harthmere-quest-state-changed",
  "biomes:harthmere-mission-event",
  "biomes:harthmere-mission-tracking-changed",
  "biomes:harthmere-class-skill-changed",
  "biomes:harthmere-building-changed",
  "biomes:harthmere-economy-changed",
  "biomes:harthmere-gathering-changed",
  "biomes:harthmere-guild-changed",
  "biomes:harthmere-quest-economy-changed",
  "biomes:harthmere-reputation-changed",
  "biomes:harthmere-storage-mail-recovery-changed",
  "biomes:harthmere-trade-auction-changed",
  "biomes:harthmere-dialogue-changed",
  "biomes:harthmere-multiplayer-combat-changed",
  "biomes:harthmere-food-stamina-changed",
  "biomes:live-entity-robot-energy",
  "biomes:live-entity-helper-quest",
] as const;
const BRIDGE_STATE_KEY = "biomes.localDev.harthmere.glitchBridgeState";
const CLOUD_SAVE_VERSION_KEY_PREFIX = "glitch.harthmere.cloudSaveVersion";
const LOCAL_INSTALL_ID_KEY = "biomes.localDev.harthmere.localInstallId";
const ACTIVE_USER_SCOPE_KEY = "biomes.localDev.harthmere.activeUserScope";
const GLITCH_EVENT = "biomes:harthmere-glitch-changed";
const SESSION_CHANNEL_NAME = "biomes:harthmere-glitch-session";
const CLOUD_SAVE_SLOT_INDEX = 0;
const AUTOSAVE_INTERVAL_MS = 60_000;
const STATE_CHANGE_AUTOSAVE_DELAY_MS = 1_500;
const STATE_CHANGE_AUTOSAVE_MIN_INTERVAL_MS = 15_000;
const PROGRESSION_INTERVAL_MS = 60_000;
const SESSION_HEARTBEAT_INTERVAL_MS = 15_000;
const GLITCH_INSTALL_HEARTBEAT_INTERVAL_MS = 60_000;
const AEGIS_BRIDGE_SCRIPT_URL = "https://api.glitch.fun/js/aegis-bridge.js";
const HARTHMERE_GLITCH_BEHAVIOR_BATCH_INTERVAL_MS = 30_000;
const HARTHMERE_GLITCH_BEHAVIOR_MAX_BATCH = 25;
const HARTHMERE_GLITCH_BEHAVIOR_THROTTLE_MS = 12_000;
const HARTHMERE_GLITCH_BEHAVIOR_SCHEMA =
  "harthmere-glitch-funnel-schema" as const;
const HARTHMERE_GLITCH_VOLATILE_SAVE_KEYS = new Set<string>([
  BRIDGE_STATE_KEY,
  LOCAL_INSTALL_ID_KEY,
  HARTHMERE_GLITCH_IDENTITY_KEY,
]);

export const HARTHMERE_GLITCH_STANDARD_FUNNEL_EVENTS = [
  { step_key: "game_boot", action_key: "start" },
  { step_key: "glitch_auth", action_key: "start" },
  { step_key: "glitch_auth", action_key: "success" },
  { step_key: "glitch_auth", action_key: "fail" },
  { step_key: "loading", action_key: "start" },
  { step_key: "loading", action_key: "complete" },
  { step_key: "onboarding_intro", action_key: "screen_view" },
  { step_key: "onboarding_name", action_key: "submit" },
  { step_key: "onboarding_name", action_key: "success" },
  { step_key: "character_builder", action_key: "screen_view" },
  { step_key: "character_builder", action_key: "change_field" },
  { step_key: "character_builder", action_key: "complete" },
  { step_key: "onboarding_wakeup", action_key: "complete" },
  { step_key: "gameplay", action_key: "entered_world" },
  { step_key: "biomes_ui", action_key: "open_tab" },
  { step_key: "biomes_ui", action_key: "close" },
  { step_key: "inventory", action_key: "state_changed" },
  { step_key: "banking", action_key: "action_click" },
  { step_key: "dialogue", action_key: "state_changed" },
  { step_key: "quest", action_key: "state_changed" },
  { step_key: "mission", action_key: "progress" },
  { step_key: "combat", action_key: "state_changed" },
  { step_key: "combat", action_key: "death" },
  { step_key: "session", action_key: "hidden" },
  { step_key: "session", action_key: "pagehide" },
] as const;

export type HarthmereGlitchRuntimeConfig = {
  titleId: string;
  installId?: string;
  sessionId?: string;
  fingerprintId?: string;
  launchedByGlitch: boolean;
  localOnly: boolean;
};

type HarthmereGlitchStatus = {
  version: 2;
  mode: "local" | "glitch" | "guest" | "invalid" | "disconnected";
  valid: boolean;
  titleId: string;
  installId?: string;
  serverSessionId?: string;
  gameUserId?: string;
  glitchUserId?: string;
  biomesUserId?: string;
  userName?: string;
  licenseType?: string;
  lastValidationAt?: string;
  lastValidationError?: string;
  lastHeartbeatAt?: string;
  lastInstallHeartbeatAt?: string;
  disconnectedReason?: string;
  lastAutosaveAt?: string;
  lastProgressionAt?: string;
  lastCloudSaveVersion?: number;
  cloudSaveConflict?: boolean;
  lastCloudSaveConflictAt?: string;
  lastCloudSaveConflictId?: string;
  lastCloudSaveServerVersion?: number;
  lastCloudSaveConflictMessage?: string;
  lastError?: string;
  playtimeSeconds: number;
};

type HarthmereSnapshotMetadata = {
  level: number;
  xpCurrent: number;
  completedQuestCount: number;
  gold: number;
  inventoryItems: number;
  defeatedEnemies: number;
  playtimeSeconds: number;
  storageKeyCount: number;
  storageAuthority: "glitchCloudSave";
};

type HarthmereGlitchSnapshot = {
  version: "harthmere-glitch-save";
  schemaAuditVersion: typeof HARTHMERE_GLITCH_SAVE_SCHEMA_VERSION;
  savedAt: string;
  titleId: string;
  installId?: string;
  identity?: HarthmereGlitchIdentity;
  metadata: HarthmereSnapshotMetadata;
  localStorage: Record<string, string>;
};

declare global {
  interface Window {
    __GLITCH_GAME_CONFIG__?: Partial<{
      titleId: string;
      installId: string;
      sessionId: string;
      fingerprintId: string;
    }>;
    AEGIS_CONFIG?: Record<string, unknown>;
    __harthmereGlitchTelemetry?: {
      status: () => Record<string, unknown>;
      flush: (reason?: string) => Promise<void>;
      standardEvents: typeof HARTHMERE_GLITCH_STANDARD_FUNNEL_EVENTS;
    };
    __harthmereGlitchBehaviorBacklog?: HarthmereGlitchBehaviorEvent[];
    __harthmereGlitch?: {
      status: () => HarthmereGlitchStatus;
      identity: () => HarthmereGlitchIdentity | undefined;
      saveNow: () => Promise<void>;
      submitNow: () => Promise<void>;
      heartbeatNow: () => Promise<void>;
      heartbeatInstallNow: () => Promise<void>;
      listSaves: () => Promise<unknown>;
      restoreLatest: () => Promise<boolean>;
      leaderboard: (apiKey?: string) => Promise<unknown>;
      achievements: () => Promise<unknown>;
    };
  }
}

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function safeJsonParse<T = any>(
  raw: string | null | undefined,
  fallback: T
): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function dispatchBridgeEvent() {
  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent(GLITCH_EVENT));
  }
}

function readStatus(): HarthmereGlitchStatus | undefined {
  if (!isBrowser()) return undefined;
  return safeJsonParse<HarthmereGlitchStatus | undefined>(
    window.localStorage.getItem(BRIDGE_STATE_KEY),
    undefined
  );
}

function writeStatus(patch: Partial<HarthmereGlitchStatus>) {
  if (!isBrowser()) return;
  const previous = readStatus();
  const next: HarthmereGlitchStatus = {
    version: 2,
    mode: "local",
    valid: false,
    titleId: DEFAULT_HARTHMERE_TITLE_ID,
    playtimeSeconds: 0,
    ...(previous ?? {}),
    ...patch,
  };
  // Force the schema version after spreads in case `patch` carries an older
  // value through from a stale storage read.
  next.version = 2;
  window.localStorage.setItem(BRIDGE_STATE_KEY, JSON.stringify(next));
  dispatchBridgeEvent();
}

function normalizeCloudSaveVersion(value: unknown) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && !value.trim()) return undefined;
  const version = Number(value);
  if (!Number.isFinite(version) || version < 0) return undefined;
  return Math.floor(version);
}

function cloudSaveVersionStorageKey(
  config: HarthmereGlitchRuntimeConfig,
  slotIndex = CLOUD_SAVE_SLOT_INDEX
) {
  if (!config.installId) return undefined;
  return `${CLOUD_SAVE_VERSION_KEY_PREFIX}.${config.titleId}.${config.installId}.${slotIndex}`;
}

function readStoredCloudSaveVersion(
  config: HarthmereGlitchRuntimeConfig,
  slotIndex = CLOUD_SAVE_SLOT_INDEX
) {
  if (!isBrowser()) return undefined;
  const key = cloudSaveVersionStorageKey(config, slotIndex);
  if (!key) return undefined;
  return normalizeCloudSaveVersion(window.localStorage.getItem(key));
}

function writeStoredCloudSaveVersion(
  config: HarthmereGlitchRuntimeConfig,
  version: number,
  slotIndex = CLOUD_SAVE_SLOT_INDEX
) {
  if (!isBrowser()) return;
  const key = cloudSaveVersionStorageKey(config, slotIndex);
  if (!key) return;
  window.localStorage.setItem(key, String(version));
}

function getParam(params: URLSearchParams, names: string[]) {
  for (const name of names) {
    const value = params.get(name);
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function getLocalStorageFirst(keys: string[]) {
  if (!isBrowser()) return undefined;
  for (const key of keys) {
    const value = window.localStorage.getItem(key);
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function isLocalGeneratedInstallId(installId: string | undefined) {
  return typeof installId === "string" && installId.startsWith("local-");
}

function getOrCreateLocalInstallId() {
  if (!isBrowser()) return undefined;
  const existing = window.localStorage.getItem(LOCAL_INSTALL_ID_KEY);
  if (existing) return existing;
  const id = `local-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  window.localStorage.setItem(LOCAL_INSTALL_ID_KEY, id);
  return id;
}

function readRuntimeConfig(): HarthmereGlitchRuntimeConfig {
  if (!isBrowser()) {
    return {
      titleId: DEFAULT_HARTHMERE_TITLE_ID,
      launchedByGlitch: false,
      localOnly: true,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const injected = window.__GLITCH_GAME_CONFIG__ ?? {};
  const titleId =
    injected.titleId ??
    getParam(params, ["glitch_title_id", "title_id", "titleId"]) ??
    getLocalStorageFirst(["glitch.title.id", "glitch_title_id"]) ??
    process.env.NEXT_PUBLIC_GLITCH_TITLE_ID ??
    DEFAULT_HARTHMERE_TITLE_ID;

  const rawExternalInstallId =
    injected.installId ??
    getParam(params, ["install_id", "installId"]) ??
    getLocalStorageFirst(["glitch.install.id", LOCAL_INSTALL_ID_KEY]);

  const externalInstallId = isLocalGeneratedInstallId(rawExternalInstallId)
    ? undefined
    : rawExternalInstallId;

  const sessionId =
    injected.sessionId ??
    getParam(params, ["glitch_session_id", "session_id", "sessionId"]) ??
    getLocalStorageFirst(["glitch.session.id", "glitch_session_id"]);

  const fingerprintId =
    injected.fingerprintId ??
    getParam(params, [
      "fingerprint_id",
      "fingerprintId",
      "glitch_fingerprint_id",
    ]) ??
    getLocalStorageFirst(["glitch.fingerprint.id", "fingerprint_id"]);

  const installId = externalInstallId ?? getOrCreateLocalInstallId();
  const launchedByGlitch = Boolean(externalInstallId);

  if (externalInstallId) {
    window.localStorage.setItem("glitch.title.id", titleId);
    window.localStorage.setItem("glitch.install.id", externalInstallId);
    if (sessionId) window.localStorage.setItem("glitch.session.id", sessionId);
    if (fingerprintId)
      window.localStorage.setItem("glitch.fingerprint.id", fingerprintId);
  }

  return {
    titleId,
    installId,
    sessionId,
    fingerprintId,
    launchedByGlitch,
    localOnly: !launchedByGlitch,
  };
}

async function requestGlitch<T = any>(
  op: string,
  body: Record<string, any>,
  options: { keepalive?: boolean } = {}
): Promise<T> {
  const controller =
    typeof AbortController !== "undefined" && options.keepalive !== true
      ? new AbortController()
      : undefined;
  const timeout =
    controller && typeof window !== "undefined"
      ? window.setTimeout(
          () => controller.abort(),
          HARTHMERE_GLITCH_BRIDGE_FETCH_TIMEOUT_MS
        )
      : undefined;
  let response: Response;
  try {
    response = await fetch("/api/glitch/harthmere", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ op, ...body }),
      keepalive: options.keepalive === true,
      signal: controller?.signal,
    });
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      json?.error ??
      json?.message ??
      `Glitch ${op} failed with ${response.status}`;
    const error = new Error(`${message} (${response.status})`) as Error & {
      op?: string;
      response?: unknown;
      status?: number;
    };
    error.op = op;
    error.response = json;
    error.status = response.status;
    throw error;
  }
  return json as T;
}

function collectHarthmereStorage() {
  const result: Record<string, string> = {};
  if (!isBrowser()) return result;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !isHarthmereCloudSaveStorageKey(key)) continue;
    const value = window.localStorage.getItem(key);
    if (value === null) continue;
    result[key] = value;
  }
  return result;
}

function parseStoredObject(storage: Record<string, string>, exactKey: string) {
  const direct = storage[exactKey];
  if (direct) return safeJsonParse<any>(direct, {});
  const scopedEntry = Object.entries(storage).find(([key]) =>
    key.startsWith(`${exactKey}.user.`)
  );
  return scopedEntry ? safeJsonParse<any>(scopedEntry[1], {}) : {};
}

function numberValue(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function sumQuantities(rows: any[]) {
  return rows.reduce(
    (sum, row) => sum + Math.max(0, Math.floor(numberValue(row?.quantity, 1))),
    0
  );
}

function isHarthmereCloudSaveStorageKey(key: string) {
  if (HARTHMERE_GLITCH_VOLATILE_SAVE_KEYS.has(key)) return false;
  return (
    key.startsWith(HARTHMERE_STORAGE_PREFIX) ||
    (HARTHMERE_GLITCH_REQUIRED_SAVE_KEYS as readonly string[]).includes(key) ||
    HARTHMERE_GLITCH_REQUIRED_SAVE_KEY_PREFIXES.some((prefix) =>
      key.startsWith(prefix)
    )
  );
}

export function cloudSaveContentFingerprint(storage: Record<string, string>) {
  return JSON.stringify(
    Object.entries(storage)
      .filter(([key]) => isHarthmereCloudSaveStorageKey(key))
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function hasSnapshotMissionProgress(storage: Record<string, string>) {
  const snapshotGrove = parseStoredObject(
    storage,
    "biomes.localDev.snapshotGroveQuestState"
  );
  const snapshotMission = parseStoredObject(
    storage,
    "biomes.localDev.snapshotMissionState"
  );
  return (
    (Array.isArray(snapshotGrove?.acceptedQuestIds) &&
      snapshotGrove.acceptedQuestIds.length > 0) ||
    typeof snapshotGrove?.activeQuestId === "string" ||
    (Array.isArray(snapshotGrove?.completedQuestIds) &&
      snapshotGrove.completedQuestIds.length > 0) ||
    snapshotMission?.accepted === true ||
    Object.keys(snapshotMission?.active ?? {}).length > 0 ||
    (Array.isArray(snapshotMission?.completed) &&
      snapshotMission.completed.length > 0) ||
    numberValue(snapshotMission?.currentStepIndex, 0) > 0
  );
}

function deriveMetadata(
  storage: Record<string, string>,
  playtimeSeconds: number
): HarthmereSnapshotMetadata {
  const leveling = parseStoredObject(
    storage,
    "biomes.localDev.harthmere.levelingState"
  );
  const quests = parseStoredObject(
    storage,
    "biomes.localDev.harthmere.questState"
  );
  const snapshotGrove = parseStoredObject(
    storage,
    "biomes.localDev.snapshotGroveQuestState"
  );
  const snapshotMission = parseStoredObject(
    storage,
    "biomes.localDev.snapshotMissionState"
  );
  const inventory = parseStoredObject(
    storage,
    "biomes.localDev.harthmere.inventoryState"
  );
  const combat = parseStoredObject(
    storage,
    "biomes.localDev.harthmere.combatState"
  );

  const backpackCount = sumQuantities(
    Array.isArray(inventory?.backpack?.items) ? inventory.backpack.items : []
  );
  const questPouchCount = sumQuantities(
    Array.isArray(inventory?.questPouch) ? inventory.questPouch : []
  );
  const materialCount = Object.values(inventory?.materialStorage ?? {}).reduce(
    (sum: number, value) => sum + Math.max(0, Math.floor(numberValue(value))),
    0
  );
  const gold = numberValue(
    inventory?.wallet?.gold ?? inventory?.wallet?.coins ?? 0
  );
  const completedQuestCount = Array.isArray(quests?.completed)
    ? quests.completed.length
    : 0;
  const completedSnapshotGroveQuestCount = Array.isArray(
    snapshotGrove?.completedQuestIds
  )
    ? snapshotGrove.completedQuestIds.length
    : 0;
  const completedSnapshotMissionCount = Array.isArray(
    snapshotMission?.completed
  )
    ? snapshotMission.completed.length
    : 0;
  const defeatedEnemies = Object.keys(combat?.killCredit ?? {}).length;

  return {
    level: Math.max(1, Math.floor(numberValue(leveling?.level, 1))),
    xpCurrent: Math.max(0, Math.floor(numberValue(leveling?.xpCurrent, 0))),
    completedQuestCount:
      completedQuestCount +
      completedSnapshotGroveQuestCount +
      completedSnapshotMissionCount,
    gold,
    inventoryItems: backpackCount + questPouchCount + materialCount,
    defeatedEnemies,
    playtimeSeconds,
    storageKeyCount: Object.keys(storage).length,
    storageAuthority: "glitchCloudSave",
  };
}

function createSnapshot(
  config: HarthmereGlitchRuntimeConfig,
  playtimeSeconds: number
): HarthmereGlitchSnapshot {
  const localStorage = collectHarthmereStorage();
  return {
    version: "harthmere-glitch-save",
    schemaAuditVersion: HARTHMERE_GLITCH_SAVE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    titleId: config.titleId,
    installId: config.installId,
    identity: readHarthmereGlitchIdentity(),
    metadata: deriveMetadata(localStorage, playtimeSeconds),
    localStorage,
  };
}

type HarthmereCloudRestoreDetail = {
  restoredKeyCount: number;
  migratedKeyCount: number;
  hasCharacterCustomization: boolean;
  cloudSaveVersion?: number;
};

function dispatchHarthmereCloudRestoreEvents(
  detail: HarthmereCloudRestoreDetail
) {
  if (!isBrowser()) return;
  for (const eventName of HARTHMERE_GLITCH_RESTORE_EVENTS) {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

function currentCloudSaveRestoreScope() {
  return readHarthmereGlitchIdentity()?.gameUserId;
}

function currentCloudSaveCustomizationScope() {
  const scope = currentCloudSaveRestoreScope();
  if (!scope) return undefined;
  if (scope.startsWith("biomes:")) {
    const numeric = scope.slice("biomes:".length).trim();
    if (numeric) return numeric;
  }
  return scope;
}

function migrateCloudSaveStorageKeyToCurrentScope(key: string) {
  const scope = currentCloudSaveRestoreScope();
  if (!scope) return undefined;
  for (const prefix of HARTHMERE_GLITCH_REQUIRED_SAVE_KEY_PREFIXES) {
    if (!prefix.endsWith(".user.") || !key.startsWith(prefix)) continue;
    const nextScope =
      prefix === "biomes.localDev.harthmere.playerFace.user." ||
      prefix === "biomes.localDev.harthmere.playerBody.user." ||
      prefix === "biomes.localDev.harthmere.playerClothing.user."
        ? currentCloudSaveCustomizationScope() ?? scope
        : scope;
    const previousScope = key.slice(prefix.length);
    if (!previousScope || previousScope === nextScope) return undefined;
    return `${prefix}${nextScope}`;
  }
  return undefined;
}

function applySnapshot(snapshot: unknown, cloudSaveVersion?: number) {
  if (!isBrowser()) return false;
  const parsed = snapshot as Partial<HarthmereGlitchSnapshot> | undefined;
  if (
    !parsed ||
    parsed.version !== "harthmere-glitch-save" ||
    !parsed.localStorage
  ) {
    return false;
  }
  let restoredKeyCount = 0;
  let migratedKeyCount = 0;
  let hasCharacterCustomization = false;
  for (const [key, value] of Object.entries(parsed.localStorage)) {
    if (isHarthmereCloudSaveStorageKey(key) && typeof value === "string") {
      restoredKeyCount += 1;
      if (
        key.startsWith("biomes.localDev.harthmere.playerFace.user.") ||
        key.startsWith("biomes.localDev.harthmere.playerBody.user.") ||
        key.startsWith("biomes.localDev.harthmere.playerClothing.user.") ||
        key.startsWith("biomes.localDev.harthmere.playerBody.user.")
      ) {
        hasCharacterCustomization = true;
      }
      window.localStorage.setItem(
        key,
        key === ACTIVE_USER_SCOPE_KEY
          ? currentCloudSaveRestoreScope() ?? value
          : value
      );
      const migratedKey = migrateCloudSaveStorageKeyToCurrentScope(key);
      if (migratedKey) {
        migratedKeyCount += 1;
        window.localStorage.setItem(migratedKey, value);
      }
    }
  }
  dispatchHarthmereCloudRestoreEvents({
    restoredKeyCount,
    migratedKeyCount,
    hasCharacterCustomization,
    cloudSaveVersion,
  });
  return true;
}

function hasMeaningfulLocalProgress(storage: Record<string, string>) {
  const metadata = deriveMetadata(storage, 0);
  return (
    metadata.level > 1 ||
    metadata.xpCurrent > 0 ||
    metadata.completedQuestCount > 0 ||
    metadata.gold > 0 ||
    metadata.inventoryItems > 0 ||
    metadata.defeatedEnemies > 0 ||
    hasSnapshotMissionProgress(storage)
  );
}

function progressionPayloadFromSnapshot(
  snapshot: HarthmereGlitchSnapshot,
  playtimeDeltaSeconds: number
) {
  const meta = snapshot.metadata;
  const identity = snapshot.identity;
  return {
    stats: {
      harthmere_playtime_seconds: Math.max(0, Math.floor(playtimeDeltaSeconds)),
      harthmere_player_level: meta.level,
      harthmere_xp_current: meta.xpCurrent,
      harthmere_gold: meta.gold,
      harthmere_completed_quests: meta.completedQuestCount,
      harthmere_inventory_items: meta.inventoryItems,
      harthmere_enemies_defeated: meta.defeatedEnemies,
    },
    scores: {
      harthmere_highest_level: meta.level,
      harthmere_richest_traveler: meta.gold,
      harthmere_quest_completion_score: meta.completedQuestCount,
      harthmere_playtime_score: meta.playtimeSeconds,
    },
    metadata: {
      source: "harthmere-glitch-bridge",
      saved_at: snapshot.savedAt,
      storage_key_count: meta.storageKeyCount,
      game_user_id: identity?.gameUserId,
      glitch_user_id: identity?.glitchUserId,
      biomes_user_id: identity?.biomesUserId,
      user_name: identity?.userName,
    },
  };
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
  }
  return undefined;
}

export function identityFromResponse(
  config: HarthmereGlitchRuntimeConfig,
  response: any
): HarthmereGlitchIdentity {
  const glitchUserId = firstString(
    response?.glitch_user_id,
    response?.user_id,
    response?.userId,
    response?.user?.id
  );
  const userName =
    firstString(
      response?.user_name,
      response?.username,
      response?.user?.username,
      response?.user?.name
    ) ??
    (glitchUserId
      ? `glitch-${glitchUserId}`
      : `install-${config.installId?.slice(0, 8) ?? "local"}`);
  const biomesUserId = firstString(response?.biomes_user_id);
  const gameUserId =
    (glitchUserId ? `glitch:${glitchUserId}` : undefined) ??
    firstString(response?.game_user_id) ??
    (biomesUserId ? `biomes:${biomesUserId}` : undefined) ??
    `install:${config.installId}`;

  return {
    source: "glitch",
    titleId: config.titleId,
    installId: config.installId,
    sessionId: config.sessionId,
    serverSessionId: firstString(response?.server_session_id),
    gameUserId,
    glitchUserId,
    biomesUserId,
    userName,
    validatedAt: new Date().toISOString(),
  };
}

function isCloudSaveEligibleIdentity(
  identity: HarthmereGlitchIdentity | undefined
) {
  if (!identity?.gameUserId) return false;
  if (identity.glitchUserId) return true;
  return (
    !identity.gameUserId.startsWith("install:") &&
    !identity.gameUserId.startsWith("local:") &&
    identity.gameUserId !== "guest" &&
    identity.gameUserId !== "anonymous"
  );
}

function localIdentity(
  config: HarthmereGlitchRuntimeConfig
): HarthmereGlitchIdentity {
  const installId = config.installId ?? "local";
  return {
    source: "local",
    titleId: config.titleId,
    installId,
    sessionId: config.sessionId,
    gameUserId: `local:${installId}`,
    userName: `Local ${BIOMES_GAME_NAME} Player`,
    validatedAt: new Date().toISOString(),
  };
}

function applyIdentityToLocalScope(identity: HarthmereGlitchIdentity) {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACTIVE_USER_SCOPE_KEY, identity.gameUserId);
  window.sessionStorage?.setItem(ACTIVE_USER_SCOPE_KEY, identity.gameUserId);
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_GLITCH_IDENTITY_CHANGED_EVENT)
  );
  window.dispatchEvent(new CustomEvent("biomes:harthmere-leveling-changed"));
  window.dispatchEvent(new CustomEvent("biomes:harthmere-combat-changed"));
  window.dispatchEvent(new CustomEvent(HARTHMERE_INVENTORY_EVENT));
}

function applyIdentityToGameContext(
  context: ClientContext | undefined,
  identity: HarthmereGlitchIdentity | undefined
) {
  if (!context || !identity?.userName) return;
  try {
    const anyContext = context as any;
    const userId = anyContext.userId;
    const userName = identity.userName;
    const localPlayer = anyContext.resources?.get?.("/scene/local_player");
    if (localPlayer?.player) {
      localPlayer.player.username = userName;
    }
    const simPlayer = userId
      ? anyContext.resources?.get?.("/sim/player", userId)
      : undefined;
    if (simPlayer) {
      simPlayer.username = userName;
    }
    const label = userId
      ? anyContext.reactResources?.get?.("/ecs/c/label", userId)
      : undefined;
    if (label && typeof label === "object") {
      label.text = userName;
    }
  } catch {
    // Best-effort local display override only. The real Glitch identity is stored separately.
  }
}

function shouldSuppressDisconnectedOverlay(reason: string) {
  return (
    reason === "session_not_found" ||
    reason === "session_not_found_recovered" ||
    reason === "finished" ||
    reason === "lame_duck_handover"
  );
}

function isLocalBrowserHost() {
  if (!isBrowser()) return true;
  const host = window.location.hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".test")
  );
}

function isProductionGlitchRuntime(config: HarthmereGlitchRuntimeConfig) {
  if (!isBrowser()) return false;
  return Boolean(
    config.launchedByGlitch &&
      config.installId &&
      !config.localOnly &&
      !isLocalBrowserHost()
  );
}

function ensureAegisBridgeBestEffort(config: HarthmereGlitchRuntimeConfig) {
  if (!isProductionGlitchRuntime(config)) {
    return { injected: false, skipped: "not_production_glitch_runtime" };
  }

  try {
    window.AEGIS_CONFIG = {
      ...(window.AEGIS_CONFIG ?? {}),
      ...(window.__GLITCH_GAME_CONFIG__ ?? {}),
      titleId: config.titleId,
      title_id: config.titleId,
      installId: config.installId,
      install_id: config.installId,
      sessionId: config.sessionId,
      session_id: config.sessionId,
      fingerprintId: config.fingerprintId,
      fingerprint_id: config.fingerprintId,
      source: "harthmere-biomes",
    };

    const existing = document.querySelector(
      `script[src="${AEGIS_BRIDGE_SCRIPT_URL}"]`
    );
    if (existing) {
      return { injected: false, skipped: "already_present" };
    }

    const script = document.createElement("script");
    script.src = AEGIS_BRIDGE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.dataset.harthmereAegisBridge = "current";
    script.onerror = () => {
      console.warn("HARTHMERE_AEGIS_BRIDGE_LOAD_FAILED", {
        src: AEGIS_BRIDGE_SCRIPT_URL,
      });
    };
    document.head.appendChild(script);
    return { injected: true, skipped: undefined };
  } catch (error) {
    console.warn("HARTHMERE_AEGIS_BRIDGE_INJECTION_FAILED", error);
    return { injected: false, skipped: "exception" };
  }
}

function safeBehaviorMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata || typeof metadata !== "object") return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata).slice(0, 24)) {
    if (value === undefined || typeof value === "function") continue;
    if (typeof value === "string") out[key] = value.slice(0, 160);
    else if (
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    )
      out[key] = value;
    else if (Array.isArray(value)) out[key] = value.slice(0, 12);
    else {
      try {
        out[key] = JSON.parse(JSON.stringify(value));
      } catch {
        out[key] = String(value).slice(0, 120);
      }
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function behaviorEventPayload(
  config: HarthmereGlitchRuntimeConfig,
  event: HarthmereGlitchBehaviorEvent
) {
  return {
    game_install_id: config.installId,
    step_key: event.step_key,
    step_label: event.step_label,
    step_description: event.step_description,
    action_key: event.action_key,
    event_label: event.event_label,
    event_description: event.event_description,
    previous_step_key: event.previous_step_key,
    event_timestamp: event.event_timestamp,
    metadata: safeBehaviorMetadata({
      ...(event.metadata ?? {}),
      schema: HARTHMERE_GLITCH_BEHAVIOR_SCHEMA,
      source: "harthmere-biomes",
      title_id: config.titleId,
      session_id: config.sessionId,
    }),
  };
}

function closestTelemetryButtonLabel(target: EventTarget | null) {
  if (!target || !(target instanceof Element)) return undefined;
  const el = target.closest(
    "[data-harthmere-track-step],button,[role='button'],.biomes-ui-tab"
  );
  if (!el) return undefined;
  const label =
    el.getAttribute("aria-label") ??
    el.getAttribute("title") ??
    (el.textContent ?? "").replace(/\s+/g, " ").trim();
  return {
    label: label ? label.slice(0, 80) : undefined,
    tag: el.tagName.toLowerCase(),
    className:
      typeof (el as HTMLElement).className === "string"
        ? (el as HTMLElement).className.slice(0, 80)
        : undefined,
    step: el.getAttribute("data-harthmere-track-step") ?? undefined,
    action: el.getAttribute("data-harthmere-track-action") ?? undefined,
  };
}

function showDisconnectedOverlay(reason: string) {
  if (shouldSuppressDisconnectedOverlay(reason)) {
    console.warn("HARTHMERE_SUPPRESS_DUPLICATE_DISCONNECT_OVERLAY", {
      reason,
    });
    return;
  }
  if (
    !isBrowser() ||
    document.getElementById("harthmere-glitch-disconnected-overlay")
  )
    return;
  const overlay = document.createElement("div");
  overlay.id = "harthmere-glitch-disconnected-overlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "2147483647";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.background = "rgba(0,0,0,0.72)";
  overlay.style.color = "white";
  overlay.style.fontFamily =
    "system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  overlay.innerHTML = `
    <div style="max-width:520px;margin:20px;padding:24px;border:1px solid rgba(255,255,255,.18);border-radius:18px;background:rgba(14,14,18,.96);box-shadow:0 18px 60px rgba(0,0,0,.45)">
      <div style="font-size:20px;font-weight:800;margin-bottom:8px">${BIOMES_GAME_NAME} session disconnected</div>
      <div style="font-size:14px;line-height:1.45;color:rgba(255,255,255,.78);margin-bottom:16px">A newer Glitch session is now active for this account. This older session stopped syncing saves, playtime, achievements, and leaderboards.</div>
      <div style="font-size:12px;color:rgba(255,255,255,.52);margin-bottom:16px">Reason: ${reason.replace(
        /[<>&"]/g,
        ""
      )}</div>
      <button id="harthmere-glitch-disconnected-reload" style="appearance:none;border:0;border-radius:999px;background:white;color:black;font-weight:700;padding:10px 14px;cursor:pointer">Reload this session</button>
    </div>`;
  document.body.appendChild(overlay);
  document
    .getElementById("harthmere-glitch-disconnected-reload")
    ?.addEventListener("click", () => {
      window.location.reload();
    });
}

// Best-effort extraction of an HTTP status code from a thrown error. The
// underlying transport stringifies non-2xx responses in a few different ways
// depending on whether the request went via requestGlitch, so we look for any 3-digit code in the message.
function extractHttpStatusFromError(error: unknown): number | undefined {
  if (!error) return undefined;
  const candidate =
    (error as { status?: number; statusCode?: number }).status ??
    (error as { statusCode?: number }).statusCode;
  if (typeof candidate === "number") return candidate;
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = message.match(/\b(401|403|404|409|429|5\d\d)\b/);
  return match ? Number(match[1]) : undefined;
}

function cloudSaveVersionFromResponse(response: any) {
  return (
    normalizeCloudSaveVersion(response?.version) ??
    normalizeCloudSaveVersion(response?.data?.version) ??
    normalizeCloudSaveVersion(response?.data?.data?.version)
  );
}

function cloudSaveConflictFromError(error: unknown) {
  if (extractHttpStatusFromError(error) !== 409) return undefined;
  const body = (error as { response?: any })?.response ?? {};
  const conflictBody =
    body?.status === "conflict" || body?.conflict_id || body?.server_version
      ? body
      : body?.data && typeof body.data === "object"
      ? body.data
      : body?.error && typeof body.error === "object"
      ? body.error
      : body;
  return {
    conflictId: firstString(conflictBody?.conflict_id, conflictBody?.id),
    serverVersion: normalizeCloudSaveVersion(conflictBody?.server_version),
    message:
      firstString(conflictBody?.message, conflictBody?.error) ??
      "A newer cloud save version exists on the server.",
  };
}

class HarthmereGlitchBridgeController {
  private readonly config = readRuntimeConfig();
  private autosaveTimer?: number;
  private progressionTimer?: number;
  private heartbeatTimer?: number;
  private installHeartbeatTimer?: number;
  private stateChangeSaveTimer?: number;
  private valid = false;
  // True when the player has no stable Glitch account: they can play the entire
  // game, but cloud save/restore is never run for them (Glitch rejects guest
  // saves with GUEST_NOT_ALLOWED, and there is nothing durable to scope to).
  private guest = false;
  private baseVersion = 0;
  private startedAt = Date.now();
  private lastProgressionFlushAt = Date.now();
  private stopped = false;
  private disconnected = false;
  private identity?: HarthmereGlitchIdentity;
  private channel?: BroadcastChannel;
  private behaviorTimer?: number;
  private behaviorQueue: ReturnType<typeof behaviorEventPayload>[] = [];
  private readonly behaviorThrottle = new Map<string, number>();
  private behaviorInstalled = false;
  private readonly behaviorCleanup: Array<() => void> = [];
  private progressionInFlight = false;
  private sessionHeartbeatInFlight = false;
  private installHeartbeatInFlight = false;
  private behaviorFlushInFlight = false;
  // Single-flight guard for saveNow so concurrent calls (autosave interval,
  // visibilitychange, builder queue) coalesce instead of racing each other
  // with stale base_version values and triggering 409 Conflict storms.
  private saveInFlight?: Promise<void>;
  private savePending = false;
  private lastSavedContentFingerprint?: string;
  private lastSuccessfulCloudSaveAt = 0;
  private cloudSaveConflictPaused = false;
  private readonly previousActiveUserScope = isBrowser()
    ? window.localStorage.getItem(ACTIVE_USER_SCOPE_KEY) ?? undefined
    : undefined;
  // Circuit breaker for behavior-event flushing. The aegis bridge endpoint
  // returns 401 when the install token is invalid; previously every interval
  // tick plus every visibilitychange plus every clicked button retried,
  // producing a wall of 401s in the console. After N consecutive auth
  // failures we back off and stop spamming until something resets us.
  private behaviorAuthFailures = 0;
  private behaviorAuthBackoffUntil = 0;
  private previousBehaviorStepKey?: string;

  constructor(private readonly clientContext?: ClientContext) {
    const status = readStatus();
    const statusMatchesConfig =
      status?.titleId === this.config.titleId &&
      status?.installId === this.config.installId;
    const storedVersion = readStoredCloudSaveVersion(this.config);
    const statusVersion = statusMatchesConfig
      ? normalizeCloudSaveVersion(status?.lastCloudSaveVersion)
      : undefined;
    this.baseVersion = Math.max(storedVersion ?? 0, statusVersion ?? 0);
    this.cloudSaveConflictPaused =
      statusMatchesConfig && status?.cloudSaveConflict === true;
  }

  async start() {
    writeStatus({
      mode: this.config.localOnly ? "local" : "glitch",
      valid: false,
      titleId: this.config.titleId,
      installId: this.config.installId,
      playtimeSeconds: this.currentPlaytimeSeconds(),
    });

    this.installDebugApi();
    this.installLocalSessionChannel();
    this.installAegisBridge();
    this.installBehaviorTelemetry();
    this.enqueueBehaviorEvent("game_boot", "start", {
      launched_by_glitch: this.config.launchedByGlitch,
      local_only: this.config.localOnly,
    });

    if (!this.config.launchedByGlitch || !this.config.installId) {
      const identity = localIdentity(this.config);
      this.identity = identity;
      writeHarthmereGlitchIdentity(identity);
      applyIdentityToLocalScope(identity);
      applyIdentityToGameContext(this.clientContext, identity);
      this.startLocalTimers();
      return;
    }

    this.enqueueBehaviorEvent("glitch_auth", "start");
    await this.validateAndClaimInstall();

    // Guests play the full game with an ephemeral session: no cloud restore, no
    // autosave, no heartbeats. Run only a local playtime timer and stop here.
    if (this.guest) {
      this.enqueueBehaviorEvent("glitch_auth", "guest");
      this.startLocalTimers();
      return;
    }

    if (!this.valid) {
      this.enqueueBehaviorEvent("glitch_auth", "fail", {
        reason: readStatus()?.lastValidationError ?? "invalid",
      });
      void this.flushBehaviorEvents("auth_fail").catch(() => undefined);

      return;
    }

    this.enqueueBehaviorEvent("glitch_auth", "success", {
      user_name_present: Boolean(this.identity?.userName),
      server_session: Boolean(this.identity?.serverSessionId),
    });
    this.enqueueBehaviorEvent("gameplay", "entered_world");

    const forceCloudRestoreForUserSwitch = Boolean(
      this.previousActiveUserScope &&
        this.identity?.gameUserId &&
        this.previousActiveUserScope !== this.identity.gameUserId
    );
    await this.restoreLatestIfEmpty(forceCloudRestoreForUserSwitch).catch(
      (error) => {
        this.recordError(error);
      }
    );
    this.startCloudTimers();
    await this.heartbeatInstall("start").catch((error) => {
      this.recordError(error);
    });
    await this.heartbeatSession("start").catch((error) => {
      this.recordError(error);
    });
    await this.submitProgression("start").catch((error) => {
      this.recordError(error);
    });
  }

  stop() {
    if (this.autosaveTimer) window.clearInterval(this.autosaveTimer);
    if (this.progressionTimer) window.clearInterval(this.progressionTimer);
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    if (this.installHeartbeatTimer)
      window.clearInterval(this.installHeartbeatTimer);
    if (this.behaviorTimer) window.clearInterval(this.behaviorTimer);
    if (this.stateChangeSaveTimer)
      window.clearTimeout(this.stateChangeSaveTimer);
    window.removeEventListener("visibilitychange", this.visibilityHandler);
    window.removeEventListener("pagehide", this.pageHideHandler);
    for (const eventName of HARTHMERE_GLITCH_STATE_CHANGE_SAVE_EVENTS) {
      window.removeEventListener(eventName, this.stateChangeSaveHandler);
    }
    for (const cleanup of this.behaviorCleanup.splice(0)) cleanup();
    this.channel?.close();
    this.enqueueBehaviorEvent("session", "stop");
    void this.flushBehaviorEvents("stop").catch(() => undefined);
    if (!this.disconnected) {
      void this.submitProgression("stop").catch(() => undefined);
      void this.saveNow("stop").catch(() => undefined);
      void this.releaseSession("stop").catch(() => undefined);
    }
    this.stopped = true;
  }

  private currentPlaytimeSeconds() {
    return Math.max(0, Math.floor((Date.now() - this.startedAt) / 1000));
  }

  private async validateAndClaimInstall() {
    try {
      const claim = await requestGlitch<any>("claimSession", {
        title_id: this.config.titleId,
        install_id: this.config.installId,
        session_id: this.config.sessionId,
        fingerprint_id: this.config.fingerprintId,
        device_id: this.config.installId,
        platform: "web",
      });

      if (claim?.disabled) {
        writeStatus({
          mode: "local",
          valid: false,
          lastValidationError: claim.reason ?? "server_not_configured",
          playtimeSeconds: this.currentPlaytimeSeconds(),
        });
        return;
      }

      this.valid = claim?.valid === true;
      // The server marks guests explicitly (guest / cloud_save:false). Build the
      // identity whenever we have a valid OR guest session so guests still get a
      // playable in-world identity.
      const serverGuest = claim?.guest === true || claim?.cloud_save === false;
      const identity =
        this.valid || serverGuest
          ? identityFromResponse(this.config, claim)
          : undefined;
      // A guest is anyone without a stable Glitch account. Trust the server flag,
      // but also fall back to the local eligibility check so an older server
      // (mid-deploy) that omits the flag still routes install-only sessions to the
      // guest path instead of a misleading "invalid" error.
      const guest =
        serverGuest ||
        Boolean(identity && !isCloudSaveEligibleIdentity(identity));
      if (guest) {
        // Guests CAN play — they just never cloud-save. Establish the identity and
        // a "guest" status (not an error), then skip all cloud restore/save.
        this.guest = true;
        this.valid = false;
        this.identity = identity;
        if (identity) {
          writeHarthmereGlitchIdentity(identity);
          applyIdentityToLocalScope(identity);
          applyIdentityToGameContext(this.clientContext, identity);
        }
        writeStatus({
          mode: "guest",
          valid: false,
          titleId: this.config.titleId,
          installId: this.config.installId,
          serverSessionId: identity?.serverSessionId,
          gameUserId: identity?.gameUserId,
          glitchUserId: identity?.glitchUserId,
          biomesUserId: identity?.biomesUserId,
          userName: identity?.userName,
          licenseType: claim?.license_type,
          lastValidationAt: new Date().toISOString(),
          lastValidationError: undefined,
          playtimeSeconds: this.currentPlaytimeSeconds(),
        });
        return;
      }
      this.identity = identity;
      if (identity) {
        writeHarthmereGlitchIdentity(identity);
        applyIdentityToLocalScope(identity);
        applyIdentityToGameContext(this.clientContext, identity);
        this.broadcastSessionClaim(identity);
      }

      writeStatus({
        mode: this.valid ? "glitch" : "invalid",
        valid: this.valid,
        titleId: this.config.titleId,
        installId: this.config.installId,
        serverSessionId: identity?.serverSessionId,
        gameUserId: identity?.gameUserId,
        glitchUserId: identity?.glitchUserId,
        biomesUserId: identity?.biomesUserId,
        userName: identity?.userName,
        licenseType: claim?.license_type,
        lastValidationAt: new Date().toISOString(),
        lastValidationError: this.valid
          ? undefined
          : claim?.reason ?? "INVALID_INSTALL",
        playtimeSeconds: this.currentPlaytimeSeconds(),
      });
    } catch (error: any) {
      this.valid = false;
      writeStatus({
        mode: "invalid",
        valid: false,
        lastValidationError: error?.message ?? String(error),
        playtimeSeconds: this.currentPlaytimeSeconds(),
      });
    }
  }

  private startLocalTimers() {
    this.progressionTimer = window.setInterval(() => {
      applyIdentityToGameContext(this.clientContext, this.identity);
      writeStatus({ playtimeSeconds: this.currentPlaytimeSeconds() });
    }, PROGRESSION_INTERVAL_MS);
  }

  private startCloudTimers() {
    this.progressionTimer = window.setInterval(() => {
      applyIdentityToGameContext(this.clientContext, this.identity);
      void this.submitProgression("interval").catch((error) =>
        this.recordError(error)
      );
    }, PROGRESSION_INTERVAL_MS);
    this.autosaveTimer = window.setInterval(() => {
      void this.saveNow("interval").catch((error) => this.recordError(error));
    }, AUTOSAVE_INTERVAL_MS);
    this.heartbeatTimer = window.setInterval(() => {
      void this.heartbeatSession("interval").catch((error) =>
        this.recordError(error)
      );
    }, SESSION_HEARTBEAT_INTERVAL_MS);
    this.installHeartbeatTimer = window.setInterval(() => {
      void this.heartbeatInstall("interval").catch((error) =>
        this.recordError(error)
      );
    }, GLITCH_INSTALL_HEARTBEAT_INTERVAL_MS);

    window.addEventListener("visibilitychange", this.visibilityHandler);
    window.addEventListener("pagehide", this.pageHideHandler);
    for (const eventName of HARTHMERE_GLITCH_STATE_CHANGE_SAVE_EVENTS) {
      window.addEventListener(eventName, this.stateChangeSaveHandler);
    }
  }

  private readonly stateChangeSaveHandler = () => {
    if (
      this.stopped ||
      this.disconnected ||
      !this.valid ||
      !this.config.installId
    ) {
      return;
    }
    if (this.stateChangeSaveTimer) {
      window.clearTimeout(this.stateChangeSaveTimer);
    }
    const nextAllowedSaveAt =
      this.lastSuccessfulCloudSaveAt + STATE_CHANGE_AUTOSAVE_MIN_INTERVAL_MS;
    const delayMs = Math.max(
      STATE_CHANGE_AUTOSAVE_DELAY_MS,
      nextAllowedSaveAt - Date.now()
    );
    this.stateChangeSaveTimer = window.setTimeout(() => {
      this.stateChangeSaveTimer = undefined;
      void this.saveNow("state_changed").catch((error) =>
        this.recordError(error)
      );
    }, delayMs);
  };

  private readonly visibilityHandler = () => {
    if (document.visibilityState === "hidden") {
      this.enqueueBehaviorEvent("session", "hidden", {
        playtime_seconds: this.currentPlaytimeSeconds(),
      });
      void this.flushBehaviorEvents("hidden").catch(() => undefined);
      void this.submitProgression("hidden").catch(() => undefined);
      void this.saveNow("hidden").catch(() => undefined);
      void this.heartbeatInstall("hidden").catch(() => undefined);
      void this.heartbeatSession("hidden").catch(() => undefined);
    } else if (document.visibilityState === "visible") {
      this.enqueueBehaviorEvent("session", "visible", {
        playtime_seconds: this.currentPlaytimeSeconds(),
      });
      void this.heartbeatInstall("visible").catch(() => undefined);
      void this.heartbeatSession("visible").catch(() => undefined);
      applyIdentityToGameContext(this.clientContext, this.identity);
    }
  };

  private readonly pageHideHandler = () => {
    this.enqueueBehaviorEvent("session", "pagehide", {
      playtime_seconds: this.currentPlaytimeSeconds(),
    });
    void this.flushBehaviorEvents("pagehide").catch(() => undefined);
    void this.submitProgression("pagehide").catch(() => undefined);
    void this.saveNow("pagehide").catch(() => undefined);
    void this.releaseSession("pagehide").catch(() => undefined);
  };

  private recordError(error: unknown) {
    writeStatus({
      lastError: error instanceof Error ? error.message : String(error),
    });
  }

  private rememberCloudSaveVersion(
    version: unknown,
    patch: Partial<HarthmereGlitchStatus> = {}
  ) {
    const nextVersion = normalizeCloudSaveVersion(version);
    if (nextVersion === undefined) {
      return false;
    }
    this.baseVersion = nextVersion;
    this.cloudSaveConflictPaused = false;
    writeStoredCloudSaveVersion(this.config, nextVersion);
    writeStatus({
      ...patch,
      lastCloudSaveVersion: nextVersion,
      cloudSaveConflict: false,
      lastCloudSaveConflictAt: undefined,
      lastCloudSaveConflictId: undefined,
      lastCloudSaveServerVersion: undefined,
      lastCloudSaveConflictMessage: undefined,
      lastError: undefined,
    });
    return true;
  }

  private pauseCloudSavesForConflict(
    conflict: ReturnType<typeof cloudSaveConflictFromError>,
    reason: string
  ) {
    if (!conflict) return;
    this.cloudSaveConflictPaused = true;
    this.savePending = false;
    const message = conflict.message;
    writeStatus({
      cloudSaveConflict: true,
      lastCloudSaveConflictAt: new Date().toISOString(),
      lastCloudSaveConflictId: conflict.conflictId,
      lastCloudSaveServerVersion: conflict.serverVersion,
      lastCloudSaveConflictMessage: message,
      lastError: `Cloud save conflict: ${message}`,
      playtimeSeconds: this.currentPlaytimeSeconds(),
    });
    // eslint-disable-next-line no-console
    console.warn("HARTHMERE_GLITCH_CLOUD_SAVE_CONFLICT", {
      reason,
      conflictId: conflict.conflictId,
      serverVersion: conflict.serverVersion,
      baseVersion: this.baseVersion,
      message,
      nextStep:
        "Autosave is paused. Restore the latest cloud save or resolve the conflict before uploading again.",
    });
  }

  private installLocalSessionChannel() {
    if (!isBrowser() || typeof BroadcastChannel === "undefined") return;
    this.channel = new BroadcastChannel(SESSION_CHANNEL_NAME);
    this.channel.onmessage = (event) => {
      const message = event.data;
      if (!message || message.kind !== "harthmere-session-claimed") return;
      if (!this.identity || !this.valid || this.disconnected) return;
      if (message.gameUserId !== this.identity.gameUserId) return;
      if (message.serverSessionId === this.identity.serverSessionId) return;
      this.disconnectForNewSession("newer_local_session_claimed");
    };
  }

  private broadcastSessionClaim(identity: HarthmereGlitchIdentity) {
    this.channel?.postMessage({
      kind: "harthmere-session-claimed",
      gameUserId: identity.gameUserId,
      serverSessionId: identity.serverSessionId,
      claimedAt: Date.now(),
    });
  }

  private disconnectForNewSession(reason: string) {
    if (this.disconnected) return;
    this.disconnected = true;
    this.valid = false;
    if (this.autosaveTimer) window.clearInterval(this.autosaveTimer);
    if (this.progressionTimer) window.clearInterval(this.progressionTimer);
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    if (this.installHeartbeatTimer)
      window.clearInterval(this.installHeartbeatTimer);
    writeStatus({
      mode: "disconnected",
      valid: false,
      disconnectedReason: reason,
      playtimeSeconds: this.currentPlaytimeSeconds(),
    });
    window.dispatchEvent(
      new CustomEvent(HARTHMERE_GLITCH_SESSION_DISCONNECTED_EVENT, {
        detail: { reason },
      })
    );
    showDisconnectedOverlay(reason);
  }

  async heartbeatInstall(reason = "manual") {
    if (
      this.stopped ||
      this.disconnected ||
      !this.valid ||
      !this.config.installId
    ) {
      return;
    }
    if (this.installHeartbeatInFlight) return;
    this.installHeartbeatInFlight = true;
    try {
      await requestGlitch<any>(
        "heartbeatInstall",
        {
          title_id: this.config.titleId,
          install_id: this.config.installId,
          session_id: this.config.sessionId ?? this.identity?.serverSessionId,
          analytics_session_id: this.config.sessionId,
          fingerprint_id: this.config.fingerprintId,
          device_id: this.config.installId,
          platform: "web",
          game_version: "harthmere-glitch",
          reason,
        },
        {
          keepalive: reason === "hidden" || reason === "pagehide",
        }
      );
      writeStatus({
        lastInstallHeartbeatAt: new Date().toISOString(),
        playtimeSeconds: this.currentPlaytimeSeconds(),
      });
    } finally {
      this.installHeartbeatInFlight = false;
    }
  }

  async heartbeatSession(reason = "manual") {
    if (
      this.stopped ||
      this.disconnected ||
      !this.valid ||
      !this.identity?.serverSessionId
    )
      return;
    if (this.sessionHeartbeatInFlight) return;
    this.sessionHeartbeatInFlight = true;
    try {
      const response = await requestGlitch<any>(
        "heartbeatSession",
        {
          title_id: this.config.titleId,
          install_id: this.config.installId,
          server_session_id: this.identity.serverSessionId,
          reason,
        },
        {
          keepalive: reason === "hidden" || reason === "pagehide",
        }
      );
      if (response?.revoked) {
        if (response.reason === "session_not_found") {
          await this.reclaimMissingSession(reason);
          return;
        }
        this.disconnectForNewSession(response.reason ?? "session_revoked");
        return;
      }
      if (response?.server_session_id && this.identity) {
        this.identity.serverSessionId = firstString(response.server_session_id);
        writeHarthmereGlitchIdentity(this.identity);
      }
      writeStatus({
        lastHeartbeatAt: new Date().toISOString(),
        playtimeSeconds: this.currentPlaytimeSeconds(),
      });
    } finally {
      this.sessionHeartbeatInFlight = false;
    }
  }

  private async reclaimMissingSession(reason = "heartbeat") {
    if (this.stopped || this.disconnected || !this.config.installId) return;
    const previousSessionId = this.identity?.serverSessionId;
    await this.validateAndClaimInstall();
    if (!this.valid || !this.identity?.serverSessionId) {
      this.recordError(
        `Unable to reclaim missing Glitch session after ${reason}`
      );
      return;
    }
    writeStatus({
      lastHeartbeatAt: new Date().toISOString(),
      lastError: undefined,
      playtimeSeconds: this.currentPlaytimeSeconds(),
    });
    // eslint-disable-next-line no-console
    console.warn("HARTHMERE_GLITCH_SESSION_RECLAIMED", {
      reason,
      previousSessionId,
      serverSessionId: this.identity.serverSessionId,
    });
  }

  private async releaseSession(reason = "manual") {
    if (!this.identity?.serverSessionId) return;
    await requestGlitch<any>(
      "releaseSession",
      {
        title_id: this.config.titleId,
        install_id: this.config.installId,
        server_session_id: this.identity.serverSessionId,
        reason,
      },
      {
        keepalive: reason === "pagehide",
      }
    );
  }

  async listSaves() {
    if (!this.config.installId)
      return { ok: false, error: "missing install id" };
    if (!isCloudSaveEligibleIdentity(this.identity)) {
      return { ok: false, error: "GUEST_NOT_ALLOWED", saves: [] };
    }
    return requestGlitch<any>("listSaves", {
      title_id: this.config.titleId,
      install_id: this.config.installId,
    });
  }

  async restoreLatestIfEmpty(forceCloudRestoreForUserSwitch = false) {
    const response = await this.listSaves();
    const saves = Array.isArray(response?.saves) ? response.saves : [];
    const latest = this.latestHarthmereSave(saves);
    if (!latest?.decoded_payload) {
      return false;
    }
    const localStorage = collectHarthmereStorage();
    const latestVersion = normalizeCloudSaveVersion(latest.version);
    // Glitch Cloud Save is the durable source of truth for player information.
    // Redis/backend state is a live runtime cache and may reset, so it must not
    // block importing the latest valid cloud snapshot on boot.
    if (
      !shouldApplyHarthmereCloudSave({
        latestCloudVersion: latestVersion,
        hasMeaningfulLocalProgress: hasMeaningfulLocalProgress(localStorage),
        forceCloudRestore: forceCloudRestoreForUserSwitch,
      })
    ) {
      return false;
    }
    const applied = applySnapshot(latest.decoded_payload, latestVersion);
    if (applied) {
      this.rememberCloudSaveVersion(latest.version, {
        lastAutosaveAt:
          latest.updated_at ??
          latest.client_timestamp ??
          new Date().toISOString(),
      });
    }
    return applied;
  }

  async restoreLatest() {
    const response = await this.listSaves();
    const saves = Array.isArray(response?.saves) ? response.saves : [];
    const latest = this.latestHarthmereSave(saves);
    if (!latest?.decoded_payload) {
      return false;
    }
    const applied = applySnapshot(
      latest.decoded_payload,
      normalizeCloudSaveVersion(latest.version)
    );
    if (applied) {
      this.rememberCloudSaveVersion(latest.version, {
        lastAutosaveAt:
          latest.updated_at ??
          latest.client_timestamp ??
          new Date().toISOString(),
      });
    }
    return applied;
  }

  private latestHarthmereSave(saves: any[]) {
    return saves
      .filter(
        (save: any) =>
          save?.decoded_payload?.version === "harthmere-glitch-save"
      )
      .sort(
        (a: any, b: any) => Number(b.version ?? 0) - Number(a.version ?? 0)
      )[0];
  }

  async saveNow(reason = "manual"): Promise<void> {
    // Coalesce concurrent saves. If a save is already in flight, mark that
    // another one is requested and return the existing promise — when the
    // current save finishes we'll fire exactly one follow-up using the
    // updated `baseVersion`. This eliminated the 409 Conflict loop where
    // autosave / visibilitychange / builder queue all fired storeSave at
    // once with the same stale base_version.
    if (this.saveInFlight) {
      this.savePending = true;
      return this.saveInFlight;
    }
    const run = async () => {
      try {
        await this.performSave(reason);
      } finally {
        this.saveInFlight = undefined;
      }
      if (this.savePending) {
        this.savePending = false;
        // Re-enter through saveNow so any further requests that arrive while
        // this follow-up runs also coalesce.
        await this.saveNow(`${reason}:followup`);
      }
    };
    this.saveInFlight = run();
    return this.saveInFlight;
  }

  private async performSave(reason: string) {
    if (
      this.stopped ||
      this.disconnected ||
      !this.valid ||
      !this.config.installId
    )
      return;
    const playtimeSeconds = this.currentPlaytimeSeconds();
    if (!isCloudSaveEligibleIdentity(this.identity)) {
      writeStatus({
        lastError:
          "Cloud Save requires a real Glitch user. Guest/install-only saves are blocked.",
        playtimeSeconds,
      });
      return;
    }
    if (this.cloudSaveConflictPaused) {
      writeStatus({
        lastError:
          "Cloud save conflict is paused until the latest cloud save is restored or the conflict is resolved.",
        playtimeSeconds,
      });
      return;
    }
    const snapshot = createSnapshot(this.config, playtimeSeconds);
    const contentFingerprint = cloudSaveContentFingerprint(
      snapshot.localStorage
    );
    if (
      reason !== "manual" &&
      contentFingerprint === this.lastSavedContentFingerprint
    ) {
      writeStatus({ playtimeSeconds });
      return;
    }
    let response: any;
    try {
      response = await requestGlitch<any>("storeSave", {
        title_id: this.config.titleId,
        install_id: this.config.installId,
        snapshot,
        metadata: {
          ...snapshot.metadata,
          game_user_id: this.identity?.gameUserId,
          glitch_user_id: this.identity?.glitchUserId,
          biomes_user_id: this.identity?.biomesUserId,
          user_name: this.identity?.userName,
        },
        base_version: this.baseVersion,
        play_duration_seconds: playtimeSeconds,
        save_type: reason === "manual" ? "manual" : "auto",
        slot_index: CLOUD_SAVE_SLOT_INDEX,
        slot_name: `${BIOMES_GAME_NAME} Autosave`,
        platform: "web",
        game_version: "harthmere-glitch",
      });
    } catch (error) {
      const conflict = cloudSaveConflictFromError(error);
      if (conflict) {
        this.pauseCloudSavesForConflict(conflict, reason);
        return;
      }
      throw error;
    }
    const responseVersion = cloudSaveVersionFromResponse(response);
    const didRememberVersion = this.rememberCloudSaveVersion(responseVersion, {
      lastAutosaveAt: new Date().toISOString(),
      playtimeSeconds,
    });
    if (!didRememberVersion) {
      writeStatus({
        lastAutosaveAt: new Date().toISOString(),
        playtimeSeconds,
      });
    }
    this.lastSavedContentFingerprint = contentFingerprint;
    this.lastSuccessfulCloudSaveAt = Date.now();
  }

  async submitProgression(reason = "manual") {
    if (
      this.stopped ||
      this.disconnected ||
      !this.valid ||
      !this.config.installId
    )
      return;
    const now = Date.now();
    const deltaSeconds = Math.max(
      0,
      Math.floor((now - this.lastProgressionFlushAt) / 1000)
    );
    if (reason !== "manual" && deltaSeconds <= 0) return;
    if (this.progressionInFlight) return;
    this.progressionInFlight = true;

    const snapshot = createSnapshot(this.config, this.currentPlaytimeSeconds());
    const payload = progressionPayloadFromSnapshot(snapshot, deltaSeconds);
    try {
      await requestGlitch<any>("submitProgression", {
        title_id: this.config.titleId,
        install_id: this.config.installId,
        idempotency_key: `${this.config.installId}:${
          this.identity?.serverSessionId ?? "no-session"
        }:${reason}:${now}`,
        payload,
        trust_level: "client",
        platform: "web",
      });
      writeStatus({
        lastProgressionAt: new Date().toISOString(),
        playtimeSeconds: this.currentPlaytimeSeconds(),
      });
      this.lastProgressionFlushAt = now;
    } catch (error) {
      // Glitch dashboard stat/leaderboard configuration can lag behind the
      // deployed game. That should not reject startup or freeze the client
      // after the player enters their name. Record it and keep gameplay alive.
      this.recordError(error);
    } finally {
      this.progressionInFlight = false;
    }
  }

  async leaderboard(apiKey = "harthmere_highest_level") {
    if (!this.config.installId)
      return { ok: false, error: "missing install id" };
    return requestGlitch<any>("leaderboard", {
      title_id: this.config.titleId,
      install_id: this.config.installId,
      api_key: apiKey,
    });
  }

  async achievements() {
    if (!this.config.installId)
      return { ok: false, error: "missing install id" };
    return requestGlitch<any>("playerAchievements", {
      title_id: this.config.titleId,
      install_id: this.config.installId,
    });
  }

  private installAegisBridge() {
    const result = ensureAegisBridgeBestEffort(this.config);
    if (isBrowser()) {
      try {
        window.localStorage.setItem(
          "biomes.localDev.harthmere.aegisBridge",
          JSON.stringify({ at: new Date().toISOString(), ...result })
        );
      } catch {
        // Ignore localStorage failures.
      }
    }
  }

  private shouldSendBehaviorEvents() {
    return (
      isProductionGlitchRuntime(this.config) && Boolean(this.config.installId)
    );
  }

  private enqueueBehaviorEvent(
    stepKey: string,
    actionKey = "event",
    metadata?: Record<string, unknown>,
    options: {
      throttleKey?: string;
      throttleMs?: number;
      text?: Partial<HarthmereGlitchEventText>;
      previousStepKey?: string;
    } = {}
  ) {
    if (
      !this.config.launchedByGlitch ||
      !this.config.installId ||
      this.stopped
    ) {
      return;
    }
    const throttleKey = options.throttleKey;
    if (throttleKey) {
      const now = Date.now();
      const previous = this.behaviorThrottle.get(throttleKey) ?? 0;
      if (
        now - previous <
        (options.throttleMs ?? HARTHMERE_GLITCH_BEHAVIOR_THROTTLE_MS)
      ) {
        return;
      }
      this.behaviorThrottle.set(throttleKey, now);
    }
    const text = resolveHarthmereGlitchEventText(
      stepKey,
      actionKey,
      options.text
    );
    const previousStepKey =
      options.previousStepKey ??
      (this.previousBehaviorStepKey !== stepKey
        ? this.previousBehaviorStepKey
        : undefined);
    this.previousBehaviorStepKey = stepKey;
    const event: HarthmereGlitchBehaviorEvent = {
      version: "harthmere-glitch-behavior-events",
      step_key: stepKey,
      action_key: actionKey,
      ...text,
      previous_step_key: previousStepKey,
      metadata: safeBehaviorMetadata(metadata),
      event_timestamp: new Date().toISOString(),
    };
    const payload = behaviorEventPayload(this.config, event);
    this.behaviorQueue.push(payload);
    if (this.behaviorQueue.length >= HARTHMERE_GLITCH_BEHAVIOR_MAX_BATCH) {
      void this.flushBehaviorEvents("batch_full").catch(() => undefined);
    }
  }

  private enqueueCustomBehaviorEvent(event: HarthmereGlitchBehaviorEvent) {
    this.enqueueBehaviorEvent(
      event.step_key,
      event.action_key,
      event.metadata,
      {
        previousStepKey: event.previous_step_key,
        text: {
          step_label: event.step_label,
          step_description: event.step_description,
          event_label: event.event_label,
          event_description: event.event_description,
        },
      }
    );
  }

  private installBehaviorTelemetry() {
    if (
      !isBrowser() ||
      this.behaviorInstalled ||
      !this.config.launchedByGlitch ||
      !this.config.installId
    ) {
      return;
    }
    this.behaviorInstalled = true;
    window.__harthmereGlitchBehaviorListenerReady = true;

    const customHandler = (event: Event) => {
      const detail = (event as CustomEvent<HarthmereGlitchBehaviorEvent>)
        .detail;
      if (!detail?.step_key) return;
      this.enqueueCustomBehaviorEvent(detail);
    };
    window.addEventListener(
      HARTHMERE_GLITCH_BEHAVIOR_EVENT_NAME,
      customHandler as EventListener
    );
    this.behaviorCleanup.push(() => {
      window.removeEventListener(
        HARTHMERE_GLITCH_BEHAVIOR_EVENT_NAME,
        customHandler as EventListener
      );
      window.__harthmereGlitchBehaviorListenerReady = false;
    });

    const backlog = window.__harthmereGlitchBehaviorBacklog ?? [];
    window.__harthmereGlitchBehaviorBacklog = [];
    for (const event of backlog) {
      if (event?.step_key) this.enqueueCustomBehaviorEvent(event);
    }

    const addThrottled = (name: string, step: string, action: string) => {
      const handler = () =>
        this.enqueueBehaviorEvent(step, action, undefined, {
          throttleKey: `${step}:${action}`,
        });
      window.addEventListener(name, handler);
      this.behaviorCleanup.push(() =>
        window.removeEventListener(name, handler)
      );
    };

    addThrottled(HARTHMERE_INVENTORY_EVENT, "inventory", "state_changed");
    addThrottled(
      "biomes:harthmere-economy-changed",
      "economy",
      "state_changed"
    );
    addThrottled(
      "biomes:harthmere-dialogue-changed",
      "dialogue",
      "state_changed"
    );
    addThrottled(
      "biomes:harthmere-quest-state-changed",
      "quest",
      "state_changed"
    );
    addThrottled("biomes:harthmere-mission-event", "mission", "progress");
    addThrottled("biomes:harthmere-combat-changed", "combat", "state_changed");
    addThrottled("biomes:harthmere-death-changed", "combat", "death");
    addThrottled(
      "biomes:harthmere-leveling-changed",
      "progression",
      "leveling_changed"
    );

    const gardenHose = this.clientContext?.gardenHose;
    const addGardenHoseEvent = (
      eventName: string,
      stepKey: string,
      actionKey: string,
      metadata: (event: any) => Record<string, unknown> | undefined = () =>
        undefined,
      once = false
    ) => {
      if (!gardenHose) return;
      const handler = (event: any) => {
        this.enqueueBehaviorEvent(stepKey, actionKey, metadata(event));
        if (once) gardenHose.off(eventName as any, handler);
      };
      gardenHose.on(eventName as any, handler);
      this.behaviorCleanup.push(() =>
        gardenHose.off(eventName as any, handler)
      );
    };

    addGardenHoseEvent("move", "first_movement", "complete", undefined, true);
    addGardenHoseEvent("talk_npc", "npc_dialogue", "start", (event) => ({
      npc_id: event?.npcId,
    }));
    addGardenHoseEvent(
      "challenge_unlock",
      "quest_active",
      "accepted",
      (event) => ({ quest_id: event?.id })
    );
    addGardenHoseEvent(
      "challenge_step_complete",
      "quest_objective",
      "complete",
      (event) => ({ step_id: event?.stepId })
    );
    addGardenHoseEvent(
      "challenge_complete",
      "quest_reward",
      "complete",
      (event) => ({ quest_id: event?.id })
    );
    addGardenHoseEvent(
      "challenge_abandon",
      "quest_abandon",
      "complete",
      (event) => ({ quest_id: event?.id })
    );
    addGardenHoseEvent("open_shop", "vendor_open", "screen_view");
    addGardenHoseEvent("open_station", "crafting_station", "screen_view");
    addGardenHoseEvent("craft", "crafting_complete", "complete");
    addGardenHoseEvent("equip", "equipment_change", "success", (event) => ({
      hotbar_index: event?.hotbarIndex,
    }));
    addGardenHoseEvent(
      "inventory_overflow_item_received",
      "inventory_capacity",
      "overflow"
    );
    addGardenHoseEvent(
      "mail_received",
      "mail_received",
      "complete",
      (event) => ({
        initial_bootstrap: event?.initialBootstrap === true,
        message_count: Array.isArray(event?.mail)
          ? event.mail.length
          : undefined,
      })
    );
    addGardenHoseEvent(
      "minigame_simple_race_finish",
      "minigame_complete",
      "complete",
      (event) => ({ minigame_id: event?.minigameId })
    );
    addGardenHoseEvent("minigame_quit", "minigame_exit", "quit", (event) => ({
      minigame_id: event?.minigameId,
    }));

    const clickHandler = (event: MouseEvent) => {
      const info = closestTelemetryButtonLabel(event.target);
      if (!info?.label && !info?.step) return;
      this.enqueueBehaviorEvent(
        info.step ?? "interface",
        info.action ?? "click",
        {
          label: info.label,
          tag: info.tag,
          class_name: info.className,
        }
      );
    };
    window.addEventListener("click", clickHandler, {
      capture: true,
      passive: true,
    });
    this.behaviorCleanup.push(() =>
      window.removeEventListener("click", clickHandler, {
        capture: true,
      } as any)
    );

    this.behaviorTimer = window.setInterval(() => {
      void this.flushBehaviorEvents("interval").catch(() => undefined);
    }, HARTHMERE_GLITCH_BEHAVIOR_BATCH_INTERVAL_MS);
  }

  async flushBehaviorEvents(reason = "manual") {
    if (!this.behaviorQueue.length) return;
    if (!this.shouldSendBehaviorEvents()) return;
    if (this.behaviorFlushInFlight) return;
    // Circuit-breaker: if we've been getting 401s, hold off until the backoff
    // window elapses instead of firing on every interval + click + visibility
    // change. The events stay in the queue and will flush once auth recovers.
    if (
      this.behaviorAuthBackoffUntil &&
      Date.now() < this.behaviorAuthBackoffUntil
    ) {
      // Cap queue size while backed off so memory doesn't grow forever.
      if (this.behaviorQueue.length > 100) {
        this.behaviorQueue = this.behaviorQueue.slice(-100);
      }
      return;
    }
    const events = this.behaviorQueue.splice(
      0,
      HARTHMERE_GLITCH_BEHAVIOR_MAX_BATCH
    );
    this.behaviorFlushInFlight = true;
    try {
      // Keep behavioral telemetry behind the server proxy so the Title Token
      // stays server-side. The public Glitch SDK path can run without the
      // required title-token auth and silently leave production funnels empty.
      await requestGlitch<any>("recordEvents", {
        title_id: this.config.titleId,
        install_id: this.config.installId,
        reason,
        events,
      });
      // Reset the breaker on any success.
      this.behaviorAuthFailures = 0;
      this.behaviorAuthBackoffUntil = 0;
      writeStatus({ playtimeSeconds: this.currentPlaytimeSeconds() });
    } catch (error) {
      // Behavioral analytics must never interrupt gameplay. Requeue only a tiny
      // amount so a transient failure does not grow memory forever.
      this.behaviorQueue = [...events.slice(-5), ...this.behaviorQueue].slice(
        0,
        50
      );
      // If this looks like an auth failure (401/403), open the circuit so we
      // stop hammering the endpoint with predictable failures. Exponential
      // backoff capped at 5 minutes.
      const status = extractHttpStatusFromError(error);
      if (status === 401 || status === 403) {
        this.behaviorAuthFailures += 1;
        if (this.behaviorAuthFailures >= 2) {
          const backoffMs = Math.min(
            5 * 60_000,
            5_000 * 2 ** (this.behaviorAuthFailures - 2)
          );
          this.behaviorAuthBackoffUntil = Date.now() + backoffMs;
        }
      }
      this.recordError(error);
    } finally {
      this.behaviorFlushInFlight = false;
    }
  }

  private installDebugApi() {
    if (!isBrowser()) return;
    window.__harthmereGlitch = {
      status: () =>
        readStatus() ?? {
          version: 2,
          mode: "local",
          valid: false,
          titleId: this.config.titleId,
          installId: this.config.installId,
          playtimeSeconds: this.currentPlaytimeSeconds(),
        },
      identity: () => readHarthmereGlitchIdentity(),
      saveNow: () => this.saveNow("manual"),
      submitNow: () => this.submitProgression("manual"),
      heartbeatNow: () => this.heartbeatSession("manual"),
      heartbeatInstallNow: () => this.heartbeatInstall("manual"),
      listSaves: () => this.listSaves(),
      restoreLatest: () => this.restoreLatest(),
      leaderboard: (apiKey?: string) => this.leaderboard(apiKey),
      achievements: () => this.achievements(),
    };
    window.__harthmereGlitchTelemetry = {
      status: () => ({
        version: HARTHMERE_GLITCH_BEHAVIOR_SCHEMA,
        productionRuntime: isProductionGlitchRuntime(this.config),
        launchedByGlitch: this.config.launchedByGlitch,
        queueLength: this.behaviorQueue.length,
        standardEvents: HARTHMERE_GLITCH_STANDARD_FUNNEL_EVENTS.length,
      }),
      flush: (reason = "debug") => this.flushBehaviorEvents(reason),
      standardEvents: HARTHMERE_GLITCH_STANDARD_FUNNEL_EVENTS,
    };
  }
}

export function useHarthmereGlitchBridge(
  gameReady: boolean,
  clientContext?: ClientContext | null
) {
  const controllerRef = useRef<HarthmereGlitchBridgeController | undefined>();

  useEffect(() => {
    if (!gameReady || !isBrowser()) {
      return;
    }
    const controller = new HarthmereGlitchBridgeController(
      clientContext ?? undefined
    );
    controllerRef.current = controller;
    void controller.start();
    return () => {
      controller.stop();
      controllerRef.current = undefined;
    };
  }, [gameReady, clientContext]);
}
