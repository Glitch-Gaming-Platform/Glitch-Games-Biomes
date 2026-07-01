import { harthmereLocalStorage } from "@/client/util/storage";
import { harthmereUserScopedStorageKey } from "@/client/components/challenges/LocalDevHarthmereUserScope";

export const HARTHMERE_DEATH_STATE_KEY = "biomes.localDev.harthmere.deathState";
export const HARTHMERE_DEATH_EVENT = "biomes:harthmere-death-changed";

export type HarthmereDeathStateName =
  | "alive"
  | "downed"
  | "dead"
  | "reviving"
  | "respawning"
  | "ghost"
  | "protected_after_respawn"
  | "captured"
  | "unconscious";

export type HarthmereKillerType =
  | "npc"
  | "player"
  | "environment"
  | "guard"
  | "unknown";

export interface HarthmereDamageSummaryLine {
  source: string;
  ability: string;
  damage: number;
  type: string;
}

export interface HarthmereDeathRecord {
  deathId: string;
  state: HarthmereDeathStateName;
  zone: string;
  position: [number, number, number];
  cause: string;
  killerType: HarthmereKillerType;
  killerName: string;
  damageSummary: HarthmereDamageSummaryLine[];
  durabilityLossPercent: number;
  xpDebt: number;
  corpsePosition: [number, number, number];
  availableRespawns: string[];
  pvpMode?: "pve" | "duel" | "normal_pvp" | "hardcore_pvp";
  inventoryDropPolicy?: string;
  createdAt: number;
}

export interface HarthmereDeathLogEntry {
  id: string;
  at: number;
  label: string;
  detail: string;
}

export interface HarthmereDeathState {
  version: 1;
  state: HarthmereDeathStateName;
  currentDeath?: HarthmereDeathRecord;
  downedUntil?: number;
  forcedRespawnAt?: number;
  protectionUntil?: number;
  resurrectionSicknessUntil?: number;
  deathCount: number;
  recent: HarthmereDeathLogEntry[];
}

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

export function dispatchHarthmereDeathStateChanged() {
  if (!isBrowser()) {
    return;
  }
  window.dispatchEvent(new CustomEvent(HARTHMERE_DEATH_EVENT));
  window.dispatchEvent(new CustomEvent("biomes:harthmere-combat-changed"));
}

export function defaultHarthmereDeathState(): HarthmereDeathState {
  return {
    version: 1,
    state: "alive",
    deathCount: 0,
    recent: [
      {
        id: "death-system-ready",
        at: Date.now(),
        label: "Death System Ready",
        detail:
          "Downed state, revival, respawn choices, protection, death recap, and penalties are enabled for local-dev Harthmere.",
      },
    ],
  };
}

export function normalizeHarthmereDeathState(
  raw?: Partial<HarthmereDeathState>
): HarthmereDeathState {
  const fallback = defaultHarthmereDeathState();
  return {
    version: 1,
    state: raw?.state ?? fallback.state,
    currentDeath: raw?.currentDeath,
    downedUntil: raw?.downedUntil,
    forcedRespawnAt: raw?.forcedRespawnAt,
    protectionUntil: raw?.protectionUntil,
    resurrectionSicknessUntil: raw?.resurrectionSicknessUntil,
    deathCount: Math.max(0, raw?.deathCount ?? 0),
    recent: (raw?.recent ?? fallback.recent).slice(0, 12),
  };
}

export function readHarthmereDeathState(): HarthmereDeathState {
  if (!isBrowser()) {
    return defaultHarthmereDeathState();
  }
  try {
    const scopedRaw = harthmereLocalStorage.getItem(
      harthmereUserScopedStorageKey(HARTHMERE_DEATH_STATE_KEY)
    );
    const legacyRaw = harthmereLocalStorage.getItem(HARTHMERE_DEATH_STATE_KEY);
    const raw = scopedRaw ?? legacyRaw;
    if (!raw) {
      return defaultHarthmereDeathState();
    }
    return normalizeHarthmereDeathState(
      JSON.parse(raw) as Partial<HarthmereDeathState>
    );
  } catch {
    return defaultHarthmereDeathState();
  }
}

export function writeHarthmereDeathState(state: HarthmereDeathState) {
  if (!isBrowser()) {
    return;
  }
  harthmereLocalStorage.setItem(
    harthmereUserScopedStorageKey(HARTHMERE_DEATH_STATE_KEY),
    JSON.stringify(normalizeHarthmereDeathState(state))
  );
  dispatchHarthmereDeathStateChanged();
}

export function createHarthmereDeathLogEntry(
  label: string,
  detail: string
): HarthmereDeathLogEntry {
  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
    at: Date.now(),
    label,
    detail,
  };
}

export function appendHarthmereDeathLog(
  state: HarthmereDeathState,
  label: string,
  detail: string
): HarthmereDeathState {
  return {
    ...state,
    recent: [
      createHarthmereDeathLogEntry(label, detail),
      ...state.recent,
    ].slice(0, 12),
  };
}

export function markHarthmereDeathStateAlive(detail: string) {
  const current = readHarthmereDeathState();
  writeHarthmereDeathState(
    appendHarthmereDeathLog(
      {
        ...current,
        state: "alive",
        currentDeath: undefined,
        downedUntil: undefined,
        forcedRespawnAt: undefined,
        protectionUntil: undefined,
      },
      "Alive",
      detail
    )
  );
}

export function markHarthmereDeathStateProtected(input: {
  label: string;
  detail: string;
  protectionSeconds: number;
  sicknessSeconds: number;
}) {
  const current = readHarthmereDeathState();
  const now = Date.now();
  writeHarthmereDeathState(
    appendHarthmereDeathLog(
      {
        ...current,
        state: "protected_after_respawn",
        currentDeath: undefined,
        downedUntil: undefined,
        forcedRespawnAt: undefined,
        protectionUntil: now + input.protectionSeconds * 1000,
        resurrectionSicknessUntil:
          input.sicknessSeconds > 0
            ? now + input.sicknessSeconds * 1000
            : undefined,
      },
      input.label,
      input.detail
    )
  );
}

export function markHarthmerePlayerDownedDeathState(input: {
  record: HarthmereDeathRecord;
  detail: string;
  downedMs?: number;
  forcedRespawnMs?: number;
}) {
  const current = readHarthmereDeathState();
  const now = Date.now();
  writeHarthmereDeathState(
    appendHarthmereDeathLog(
      {
        ...current,
        state: "downed",
        currentDeath: input.record,
        downedUntil: now + (input.downedMs ?? 45_000),
        forcedRespawnAt: now + (input.forcedRespawnMs ?? 5 * 60_000),
        protectionUntil: undefined,
        deathCount: current.deathCount + 1,
      },
      "Downed",
      input.detail
    )
  );
}
