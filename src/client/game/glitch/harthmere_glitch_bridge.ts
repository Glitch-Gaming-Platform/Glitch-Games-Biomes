import type { ClientContext } from "@/client/game/context";
import {
  HARTHMERE_GLITCH_IDENTITY_CHANGED_EVENT,
  HARTHMERE_GLITCH_SESSION_DISCONNECTED_EVENT,
  type HarthmereGlitchIdentity,
  readHarthmereGlitchIdentity,
  writeHarthmereGlitchIdentity,
} from "@/client/game/glitch/harthmere_glitch_identity";
import { useEffect, useRef } from "react";

const DEFAULT_HARTHMERE_TITLE_ID = "42de534c-600f-4228-af9e-b69faef94cce";
const HARTHMERE_STORAGE_PREFIX = "biomes.localDev.harthmere.";
const BRIDGE_STATE_KEY = "biomes.localDev.harthmere.glitchBridgeState.v1";
const LOCAL_INSTALL_ID_KEY = "biomes.localDev.harthmere.localInstallId.v1";
const ACTIVE_USER_SCOPE_KEY = "biomes.localDev.harthmere.activeUserScope.v1";
const GLITCH_EVENT = "biomes:harthmere-glitch-changed";
const SESSION_CHANNEL_NAME = "biomes:harthmere-glitch-session-v70";
const AUTOSAVE_INTERVAL_MS = 60_000;
const PROGRESSION_INTERVAL_MS = 30_000;
const SESSION_HEARTBEAT_INTERVAL_MS = 15_000;

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
  mode: "local" | "glitch" | "invalid" | "disconnected";
  valid: boolean;
  titleId: string;
  installId?: string;
  serverSessionId?: string;
  gameUserId?: string;
  glitchUserId?: string;
  userName?: string;
  licenseType?: string;
  lastValidationAt?: string;
  lastValidationError?: string;
  lastHeartbeatAt?: string;
  disconnectedReason?: string;
  lastAutosaveAt?: string;
  lastProgressionAt?: string;
  lastCloudSaveVersion?: number;
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
};

type HarthmereGlitchSnapshot = {
  version: "harthmere-glitch-save-v1";
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
    __harthmereGlitch?: {
      status: () => HarthmereGlitchStatus;
      identity: () => HarthmereGlitchIdentity | undefined;
      saveNow: () => Promise<void>;
      submitNow: () => Promise<void>;
      heartbeatNow: () => Promise<void>;
      listSaves: () => Promise<unknown>;
      restoreLatest: () => Promise<boolean>;
      leaderboard: (apiKey?: string) => Promise<unknown>;
      achievements: () => Promise<unknown>;
    };
  }
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeJsonParse<T = any>(raw: string | null | undefined, fallback: T): T {
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
    undefined,
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
    version: 2,
  };
  window.localStorage.setItem(BRIDGE_STATE_KEY, JSON.stringify(next));
  dispatchBridgeEvent();
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

  const externalInstallId =
    injected.installId ??
    getParam(params, ["glitch_install_id", "install_id", "installId", "game_install_id"]) ??
    getLocalStorageFirst(["glitch.install.id", "glitch_install_id", "game_install_id"]);

  const sessionId =
    injected.sessionId ??
    getParam(params, ["glitch_session_id", "session_id", "sessionId"]) ??
    getLocalStorageFirst(["glitch.session.id", "glitch_session_id"]);

  const fingerprintId =
    injected.fingerprintId ??
    getParam(params, ["fingerprint_id", "fingerprintId", "glitch_fingerprint_id"]) ??
    getLocalStorageFirst(["glitch.fingerprint.id", "fingerprint_id"]);

  const installId = externalInstallId ?? getOrCreateLocalInstallId();
  const launchedByGlitch = Boolean(externalInstallId);

  if (externalInstallId) {
    window.localStorage.setItem("glitch.title.id", titleId);
    window.localStorage.setItem("glitch.install.id", externalInstallId);
    if (sessionId) window.localStorage.setItem("glitch.session.id", sessionId);
    if (fingerprintId) window.localStorage.setItem("glitch.fingerprint.id", fingerprintId);
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

async function requestGlitch<T = any>(op: string, body: Record<string, any>): Promise<T> {
  const response = await fetch("/api/glitch/harthmere", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ op, ...body }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.error ?? json?.message ?? `Glitch ${op} failed with ${response.status}`;
    throw new Error(message);
  }
  return json as T;
}

function collectHarthmereStorage() {
  const result: Record<string, string> = {};
  if (!isBrowser()) return result;
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(HARTHMERE_STORAGE_PREFIX)) continue;
    const value = window.localStorage.getItem(key);
    if (value === null) continue;
    result[key] = value;
  }
  return result;
}

function parseStoredObject(storage: Record<string, string>, exactKey: string) {
  const direct = storage[exactKey];
  if (direct) return safeJsonParse<any>(direct, {});
  const scopedEntry = Object.entries(storage).find(([key]) => key.startsWith(`${exactKey}.user.`));
  return scopedEntry ? safeJsonParse<any>(scopedEntry[1], {}) : {};
}

function numberValue(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function sumQuantities(rows: any[]) {
  return rows.reduce((sum, row) => sum + Math.max(0, Math.floor(numberValue(row?.quantity, 1))), 0);
}

function deriveMetadata(storage: Record<string, string>, playtimeSeconds: number): HarthmereSnapshotMetadata {
  const leveling = parseStoredObject(storage, "biomes.localDev.harthmere.levelingState.v1");
  const quests = parseStoredObject(storage, "biomes.localDev.harthmere.questState.v1");
  const inventory = parseStoredObject(storage, "biomes.localDev.harthmere.inventoryState.v1");
  const combat = parseStoredObject(storage, "biomes.localDev.harthmere.combatState.v1");

  const backpackCount = sumQuantities(Array.isArray(inventory?.backpack?.items) ? inventory.backpack.items : []);
  const questPouchCount = sumQuantities(Array.isArray(inventory?.questPouch) ? inventory.questPouch : []);
  const materialCount = Object.values(inventory?.materialStorage ?? {}).reduce(
    (sum: number, value) => sum + Math.max(0, Math.floor(numberValue(value))),
    0,
  );
  const gold = numberValue(inventory?.wallet?.gold ?? inventory?.wallet?.coins ?? 0);
  const completedQuestCount = Array.isArray(quests?.completed) ? quests.completed.length : 0;
  const defeatedEnemies = Object.keys(combat?.killCredit ?? {}).length;

  return {
    level: Math.max(1, Math.floor(numberValue(leveling?.level, 1))),
    xpCurrent: Math.max(0, Math.floor(numberValue(leveling?.xpCurrent, 0))),
    completedQuestCount,
    gold,
    inventoryItems: backpackCount + questPouchCount + materialCount,
    defeatedEnemies,
    playtimeSeconds,
    storageKeyCount: Object.keys(storage).length,
  };
}

function createSnapshot(config: HarthmereGlitchRuntimeConfig, playtimeSeconds: number): HarthmereGlitchSnapshot {
  const localStorage = collectHarthmereStorage();
  return {
    version: "harthmere-glitch-save-v1",
    savedAt: new Date().toISOString(),
    titleId: config.titleId,
    installId: config.installId,
    identity: readHarthmereGlitchIdentity(),
    metadata: deriveMetadata(localStorage, playtimeSeconds),
    localStorage,
  };
}

function applySnapshot(snapshot: unknown) {
  if (!isBrowser()) return false;
  const parsed = snapshot as Partial<HarthmereGlitchSnapshot> | undefined;
  if (!parsed || parsed.version !== "harthmere-glitch-save-v1" || !parsed.localStorage) {
    return false;
  }
  for (const [key, value] of Object.entries(parsed.localStorage)) {
    if (key.startsWith(HARTHMERE_STORAGE_PREFIX) && typeof value === "string") {
      window.localStorage.setItem(key, value);
    }
  }
  window.dispatchEvent(new CustomEvent("biomes:harthmere-leveling-changed"));
  window.dispatchEvent(new CustomEvent("biomes:harthmere-combat-changed"));
  window.dispatchEvent(new CustomEvent("biomes:harthmere-inventory-changed"));
  window.dispatchEvent(new CustomEvent("biomes:harthmere-quest-changed"));
  window.dispatchEvent(new CustomEvent("biomes:harthmere-mission-event"));
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
    metadata.defeatedEnemies > 0
  );
}

function progressionPayloadFromSnapshot(snapshot: HarthmereGlitchSnapshot, playtimeDeltaSeconds: number) {
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
      source: "harthmere-glitch-bridge-v70",
      saved_at: snapshot.savedAt,
      storage_key_count: meta.storageKeyCount,
      game_user_id: identity?.gameUserId,
      glitch_user_id: identity?.glitchUserId,
      user_name: identity?.userName,
    },
  };
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function identityFromResponse(config: HarthmereGlitchRuntimeConfig, response: any): HarthmereGlitchIdentity {
  const glitchUserId = firstString(response?.glitch_user_id, response?.user_id, response?.userId, response?.user?.id);
  const userName =
    firstString(response?.user_name, response?.username, response?.user?.username, response?.user?.name) ??
    (glitchUserId ? `glitch-${glitchUserId}` : `install-${config.installId?.slice(0, 8) ?? "local"}`);
  const gameUserId = firstString(response?.game_user_id) ?? (glitchUserId ? `glitch:${glitchUserId}` : `install:${config.installId}`);

  return {
    source: "glitch",
    titleId: config.titleId,
    installId: config.installId,
    sessionId: config.sessionId,
    serverSessionId: firstString(response?.server_session_id),
    gameUserId,
    glitchUserId,
    userName,
    validatedAt: new Date().toISOString(),
  };
}

function localIdentity(config: HarthmereGlitchRuntimeConfig): HarthmereGlitchIdentity {
  const installId = config.installId ?? "local";
  return {
    source: "local",
    titleId: config.titleId,
    installId,
    sessionId: config.sessionId,
    gameUserId: `local:${installId}`,
    userName: "Local Harthmere Player",
    validatedAt: new Date().toISOString(),
  };
}

function applyIdentityToLocalScope(identity: HarthmereGlitchIdentity) {
  if (!isBrowser()) return;
  window.localStorage.setItem(ACTIVE_USER_SCOPE_KEY, identity.gameUserId);
  window.sessionStorage?.setItem(ACTIVE_USER_SCOPE_KEY, identity.gameUserId);
  window.dispatchEvent(new CustomEvent(HARTHMERE_GLITCH_IDENTITY_CHANGED_EVENT));
  window.dispatchEvent(new CustomEvent("biomes:harthmere-leveling-changed"));
  window.dispatchEvent(new CustomEvent("biomes:harthmere-combat-changed"));
  window.dispatchEvent(new CustomEvent("biomes:harthmere-inventory-changed"));
}

function applyIdentityToGameContext(context: ClientContext | undefined, identity: HarthmereGlitchIdentity | undefined) {
  if (!context || !identity?.userName) return;
  try {
    const anyContext = context as any;
    const userId = anyContext.userId;
    const userName = identity.userName;
    const localPlayer = anyContext.resources?.get?.("/scene/local_player");
    if (localPlayer?.player) {
      localPlayer.player.username = userName;
    }
    const simPlayer = userId ? anyContext.resources?.get?.("/sim/player", userId) : undefined;
    if (simPlayer) {
      simPlayer.username = userName;
    }
    const label = userId ? anyContext.reactResources?.get?.("/ecs/c/label", userId) : undefined;
    if (label && typeof label === "object") {
      label.text = userName;
    }
  } catch {
    // Best-effort local display override only. The real Glitch identity is stored separately.
  }
}

function showDisconnectedOverlay(reason: string) {
  if (!isBrowser() || document.getElementById("harthmere-glitch-disconnected-overlay")) return;
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
  overlay.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  overlay.innerHTML = `
    <div style="max-width:520px;margin:20px;padding:24px;border:1px solid rgba(255,255,255,.18);border-radius:18px;background:rgba(14,14,18,.96);box-shadow:0 18px 60px rgba(0,0,0,.45)">
      <div style="font-size:20px;font-weight:800;margin-bottom:8px">Harthmere session disconnected</div>
      <div style="font-size:14px;line-height:1.45;color:rgba(255,255,255,.78);margin-bottom:16px">A newer Glitch session is now active for this account. This older session stopped syncing saves, playtime, achievements, and leaderboards.</div>
      <div style="font-size:12px;color:rgba(255,255,255,.52);margin-bottom:16px">Reason: ${reason.replace(/[<>&"]/g, "")}</div>
      <button id="harthmere-glitch-disconnected-reload" style="appearance:none;border:0;border-radius:999px;background:white;color:black;font-weight:700;padding:10px 14px;cursor:pointer">Reload this session</button>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById("harthmere-glitch-disconnected-reload")?.addEventListener("click", () => {
    window.location.reload();
  });
}

class HarthmereGlitchBridgeController {
  private readonly config = readRuntimeConfig();
  private autosaveTimer?: number;
  private progressionTimer?: number;
  private heartbeatTimer?: number;
  private valid = false;
  private baseVersion = 0;
  private startedAt = Date.now();
  private lastProgressionFlushAt = Date.now();
  private stopped = false;
  private disconnected = false;
  private identity?: HarthmereGlitchIdentity;
  private channel?: BroadcastChannel;

  constructor(private readonly clientContext?: ClientContext) {}

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

    if (!this.config.launchedByGlitch || !this.config.installId) {
      const identity = localIdentity(this.config);
      this.identity = identity;
      writeHarthmereGlitchIdentity(identity);
      applyIdentityToLocalScope(identity);
      applyIdentityToGameContext(this.clientContext, identity);
      this.startLocalTimers();
      return;
    }

    await this.validateAndClaimInstall();

    if (!this.valid) {
      return;
    }

    await this.restoreLatestIfEmpty();
    this.startCloudTimers();
    await this.heartbeatSession("start");
    await this.submitProgression("start");
  }

  stop() {
    if (this.autosaveTimer) window.clearInterval(this.autosaveTimer);
    if (this.progressionTimer) window.clearInterval(this.progressionTimer);
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer);
    window.removeEventListener("visibilitychange", this.visibilityHandler);
    window.removeEventListener("pagehide", this.pageHideHandler);
    this.channel?.close();
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
      const identity = this.valid ? identityFromResponse(this.config, claim) : undefined;
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
        userName: identity?.userName,
        licenseType: claim?.license_type,
        lastValidationAt: new Date().toISOString(),
        lastValidationError: this.valid ? undefined : claim?.reason ?? "INVALID_INSTALL",
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
      void this.submitProgression("interval").catch((error) => this.recordError(error));
    }, PROGRESSION_INTERVAL_MS);
    this.autosaveTimer = window.setInterval(() => {
      void this.saveNow("interval").catch((error) => this.recordError(error));
    }, AUTOSAVE_INTERVAL_MS);
    this.heartbeatTimer = window.setInterval(() => {
      void this.heartbeatSession("interval").catch((error) => this.recordError(error));
    }, SESSION_HEARTBEAT_INTERVAL_MS);

    window.addEventListener("visibilitychange", this.visibilityHandler);
    window.addEventListener("pagehide", this.pageHideHandler);
  }

  private readonly visibilityHandler = () => {
    if (document.visibilityState === "hidden") {
      void this.submitProgression("hidden").catch(() => undefined);
      void this.saveNow("hidden").catch(() => undefined);
      void this.heartbeatSession("hidden").catch(() => undefined);
    } else if (document.visibilityState === "visible") {
      void this.heartbeatSession("visible").catch(() => undefined);
      applyIdentityToGameContext(this.clientContext, this.identity);
    }
  };

  private readonly pageHideHandler = () => {
    void this.submitProgression("pagehide").catch(() => undefined);
    void this.releaseSession("pagehide").catch(() => undefined);
  };

  private recordError(error: unknown) {
    writeStatus({ lastError: error instanceof Error ? error.message : String(error) });
  }

  private installLocalSessionChannel() {
    if (!isBrowser() || typeof BroadcastChannel === "undefined") return;
    this.channel = new BroadcastChannel(SESSION_CHANNEL_NAME);
    this.channel.onmessage = (event) => {
      const message = event.data;
      if (!message || message.kind !== "harthmere-session-claimed-v70") return;
      if (!this.identity || !this.valid || this.disconnected) return;
      if (message.gameUserId !== this.identity.gameUserId) return;
      if (message.serverSessionId === this.identity.serverSessionId) return;
      this.disconnectForNewSession("newer_local_session_claimed");
    };
  }

  private broadcastSessionClaim(identity: HarthmereGlitchIdentity) {
    this.channel?.postMessage({
      kind: "harthmere-session-claimed-v70",
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
    writeStatus({
      mode: "disconnected",
      valid: false,
      disconnectedReason: reason,
      playtimeSeconds: this.currentPlaytimeSeconds(),
    });
    window.dispatchEvent(new CustomEvent(HARTHMERE_GLITCH_SESSION_DISCONNECTED_EVENT, { detail: { reason } }));
    showDisconnectedOverlay(reason);
  }

  async heartbeatSession(reason = "manual") {
    if (this.stopped || this.disconnected || !this.valid || !this.identity?.serverSessionId) return;
    const response = await requestGlitch<any>("heartbeatSession", {
      title_id: this.config.titleId,
      install_id: this.config.installId,
      server_session_id: this.identity.serverSessionId,
      reason,
    });
    if (response?.revoked) {
      this.disconnectForNewSession(response.reason ?? "session_revoked");
      return;
    }
    writeStatus({
      lastHeartbeatAt: new Date().toISOString(),
      playtimeSeconds: this.currentPlaytimeSeconds(),
    });
  }

  private async releaseSession(reason = "manual") {
    if (!this.identity?.serverSessionId) return;
    await requestGlitch<any>("releaseSession", {
      title_id: this.config.titleId,
      install_id: this.config.installId,
      server_session_id: this.identity.serverSessionId,
      reason,
    });
  }

  async listSaves() {
    if (!this.config.installId) return { ok: false, error: "missing install id" };
    return requestGlitch<any>("listSaves", {
      title_id: this.config.titleId,
      install_id: this.config.installId,
    });
  }

  async restoreLatestIfEmpty() {
    const localStorage = collectHarthmereStorage();
    if (hasMeaningfulLocalProgress(localStorage)) {
      return false;
    }
    return this.restoreLatest();
  }

  async restoreLatest() {
    const response = await this.listSaves();
    const saves = Array.isArray(response?.saves) ? response.saves : [];
    const latest = saves
      .filter((save: any) => save?.decoded_payload?.version === "harthmere-glitch-save-v1")
      .sort((a: any, b: any) => Number(b.version ?? 0) - Number(a.version ?? 0))[0];
    if (!latest?.decoded_payload) {
      return false;
    }
    const applied = applySnapshot(latest.decoded_payload);
    if (applied) {
      this.baseVersion = Math.max(this.baseVersion, Number(latest.version ?? 0));
      writeStatus({
        lastCloudSaveVersion: this.baseVersion,
        lastAutosaveAt: latest.updated_at ?? latest.client_timestamp ?? new Date().toISOString(),
      });
    }
    return applied;
  }

  async saveNow(reason = "manual") {
    if (this.stopped || this.disconnected || !this.valid || !this.config.installId) return;
    const playtimeSeconds = this.currentPlaytimeSeconds();
    const snapshot = createSnapshot(this.config, playtimeSeconds);
    const response = await requestGlitch<any>("storeSave", {
      title_id: this.config.titleId,
      install_id: this.config.installId,
      snapshot,
      metadata: {
        ...snapshot.metadata,
        game_user_id: this.identity?.gameUserId,
        glitch_user_id: this.identity?.glitchUserId,
        user_name: this.identity?.userName,
      },
      base_version: this.baseVersion,
      play_duration_seconds: playtimeSeconds,
      save_type: reason === "manual" ? "manual" : "auto",
      slot_index: 0,
      slot_name: "Harthmere Autosave",
      platform: "web",
      game_version: "harthmere-glitch-v70",
    });
    if (Number.isFinite(Number(response?.version))) {
      this.baseVersion = Number(response.version);
    } else if (Number.isFinite(Number(response?.data?.version))) {
      this.baseVersion = Number(response.data.version);
    }
    writeStatus({
      lastAutosaveAt: new Date().toISOString(),
      lastCloudSaveVersion: this.baseVersion,
      playtimeSeconds,
    });
  }

  async submitProgression(reason = "manual") {
    if (this.stopped || this.disconnected || !this.valid || !this.config.installId) return;
    const now = Date.now();
    const deltaSeconds = Math.max(0, Math.floor((now - this.lastProgressionFlushAt) / 1000));
    if (reason !== "manual" && deltaSeconds <= 0) return;
    this.lastProgressionFlushAt = now;

    const snapshot = createSnapshot(this.config, this.currentPlaytimeSeconds());
    const payload = progressionPayloadFromSnapshot(snapshot, deltaSeconds);
    await requestGlitch<any>("submitProgression", {
      title_id: this.config.titleId,
      install_id: this.config.installId,
      idempotency_key: `${this.config.installId}:${this.identity?.serverSessionId ?? "no-session"}:${reason}:${now}`,
      payload,
      trust_level: "client",
      platform: "web",
    });
    writeStatus({
      lastProgressionAt: new Date().toISOString(),
      playtimeSeconds: this.currentPlaytimeSeconds(),
    });
  }

  async leaderboard(apiKey = "harthmere_highest_level") {
    if (!this.config.installId) return { ok: false, error: "missing install id" };
    return requestGlitch<any>("leaderboard", {
      title_id: this.config.titleId,
      install_id: this.config.installId,
      api_key: apiKey,
    });
  }

  async achievements() {
    if (!this.config.installId) return { ok: false, error: "missing install id" };
    return requestGlitch<any>("playerAchievements", {
      title_id: this.config.titleId,
      install_id: this.config.installId,
    });
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
      listSaves: () => this.listSaves(),
      restoreLatest: () => this.restoreLatest(),
      leaderboard: (apiKey?: string) => this.leaderboard(apiKey),
      achievements: () => this.achievements(),
    };
  }
}

export function useHarthmereGlitchBridge(gameReady: boolean, clientContext?: ClientContext | null) {
  const controllerRef = useRef<HarthmereGlitchBridgeController | undefined>();

  useEffect(() => {
    if (!gameReady || !isBrowser()) {
      return;
    }
    const controller = new HarthmereGlitchBridgeController(clientContext ?? undefined);
    controllerRef.current = controller;
    void controller.start();
    return () => {
      controller.stop();
      controllerRef.current = undefined;
    };
  }, [gameReady, clientContext]);
}
