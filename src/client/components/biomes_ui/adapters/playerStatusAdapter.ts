import * as React from "react";
import { fetchHarthmereLiveWithTimeout } from "@/client/components/harthmere_live_fetch";

export const BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT =
  "biomes:live-mode-player-status-updated";

export interface BiomesUIStandingStatus {
  likeability: number;
  legal: number;
  notoriety: number;
  notorietyFloor?: number;
}

export interface BiomesUIPlayerStatusSnapshot {
  actorId?: string;
  classId?: string;
  className?: string;
  level?: number;
  xp?: { total?: number; current?: number; next?: number };
  combat?: {
    hp?: number;
    maxHp?: number;
    deathState?: string;
    primaryResource?: string;
    primaryResourceLabel?: string;
    resource?: number;
    maxResource?: number;
    resources?: Record<string, number>;
    maxResources?: Record<string, number>;
  };
  standing?: BiomesUIStandingStatus & { scopeId?: string };
  gold?: number;
}

export interface BiomesUIVitalsDisplayState {
  hp: number;
  maxHp: number;
  combatState: string;
  resourceLabel: string;
  resourceValue: number;
  resourceMax: number;
  classLine?: string;
  level?: number;
  xpCurrent?: number;
  xpNext?: number;
  standing?: BiomesUIStandingStatus;
  gold?: number;
}

export interface BiomesUIVitalsResourceDisplayState {
  resourceLabel: string;
  resourceValue: number;
  resourceMax: number;
}

function safeNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function safeWhole(value: unknown, fallback = 0): number {
  return Math.max(0, Math.trunc(safeNumber(value, fallback)));
}

function normalizeCombatState(value: unknown, fallback = "ready") {
  const normalized = String(value || fallback || "ready")
    .trim()
    .toLowerCase();
  return normalized || fallback;
}

function isUrgentFallbackCombatState(value: unknown) {
  return [
    "dead",
    "downed",
    "respawning",
    "protected_after_respawn",
    "in_combat",
  ].includes(normalizeCombatState(value));
}

function shouldPreferFallbackCombatVitals(
  live: BiomesUIPlayerStatusSnapshot,
  fallback: BiomesUIVitalsDisplayState
) {
  if (!live.combat) return false;
  const liveHp = safeWhole(live.combat.hp, fallback.hp);
  const liveMaxHp = Math.max(1, safeWhole(live.combat.maxHp, fallback.maxHp));
  const liveCombatState = normalizeCombatState(
    live.combat.deathState,
    "alive"
  );
  const fallbackDamagedOrDown =
    fallback.hp < fallback.maxHp ||
    fallback.hp <= 0 ||
    isUrgentFallbackCombatState(fallback.combatState);
  const liveLooksDefaultAlive =
    liveHp >= liveMaxHp && ["alive", "idle", "ready"].includes(liveCombatState);
  const fallbackIsDown =
    fallback.hp <= 0 ||
    ["dead", "downed", "respawning"].includes(
      normalizeCombatState(fallback.combatState)
    );
  const liveContradictsLocalDownState = fallbackIsDown && liveHp > fallback.hp;
  return (
    (liveLooksDefaultAlive && fallbackDamagedOrDown) ||
    liveContradictsLocalDownState
  );
}

export function formatBiomesResourceLabelForVitalsForTest(
  kind: string | undefined,
  explicit?: string
): string {
  const raw = String(explicit || kind || "mana").trim();
  if (!raw) return "Mana";
  return raw
    .replace(/_/g, " ")
    .split(/\s+/)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export function biomesUIVitalsDisplayFromLiveStatusForTest(
  live: BiomesUIPlayerStatusSnapshot | undefined,
  fallback: BiomesUIVitalsDisplayState
): BiomesUIVitalsDisplayState {
  if (!live) return fallback;
  const resourceKind = live.combat?.primaryResource;
  const resourceLabel = formatBiomesResourceLabelForVitalsForTest(
    resourceKind,
    live.combat?.primaryResourceLabel
  );
  const level = Math.max(1, safeWhole(live.level, fallback.level ?? 1));
  const className = String(live.className || "").trim();
  const preferFallbackCombat = shouldPreferFallbackCombatVitals(
    live,
    fallback
  );
  const hp = preferFallbackCombat
    ? fallback.hp
    : safeWhole(live.combat?.hp, fallback.hp);
  const maxHp = preferFallbackCombat
    ? Math.max(1, fallback.maxHp)
    : Math.max(1, safeWhole(live.combat?.maxHp, fallback.maxHp));
  const combatState = preferFallbackCombat
    ? fallback.combatState
    : String(live.combat?.deathState || fallback.combatState);
  const resourceValue = preferFallbackCombat
    ? fallback.resourceValue
    : safeWhole(live.combat?.resource, fallback.resourceValue);
  const resourceMax = preferFallbackCombat
    ? Math.max(1, fallback.resourceMax)
    : Math.max(1, safeWhole(live.combat?.maxResource, fallback.resourceMax));
  return {
    ...fallback,
    hp,
    maxHp,
    combatState,
    resourceLabel,
    resourceValue,
    resourceMax,
    classLine: className ? `${className} · Level ${level}` : fallback.classLine,
    level,
    xpCurrent: safeWhole(live.xp?.current, fallback.xpCurrent ?? 0),
    xpNext: Math.max(1, safeWhole(live.xp?.next, fallback.xpNext ?? 1)),
    standing: live.standing
      ? {
          likeability: Math.round(safeNumber(live.standing.likeability)),
          legal: Math.round(safeNumber(live.standing.legal)),
          notoriety: Math.round(safeNumber(live.standing.notoriety)),
          notorietyFloor: Math.round(safeNumber(live.standing.notorietyFloor)),
        }
      : fallback.standing,
    gold: safeWhole(live.gold, fallback.gold ?? 0),
  };
}

export function biomesUIVitalsCombatResourceDisplayForTest(
  live: BiomesUIPlayerStatusSnapshot | undefined,
  fallback: BiomesUIVitalsResourceDisplayState
): BiomesUIVitalsResourceDisplayState {
  const primaryResource = String(live?.combat?.primaryResource ?? "")
    .trim()
    .toLowerCase();
  if (primaryResource !== "stamina") {
    return fallback;
  }
  const mana = live?.combat?.resources?.mana;
  const maxMana = live?.combat?.maxResources?.mana;
  return {
    resourceLabel: "Mana",
    resourceValue: safeWhole(mana, fallback.resourceValue),
    resourceMax: Math.max(1, safeWhole(maxMana, fallback.resourceMax)),
  };
}

export function biomesUIPlayerStatusEndpoint(
  search?: string,
  options?: { gameplayActive?: boolean }
): string {
  const rawSearch =
    search ?? (typeof window !== "undefined" ? window.location.search : "");
  const params = new URLSearchParams(rawSearch);
  const installId = params.get("install_id") ?? params.get("installId");
  const output: string[] = [];
  if (installId) output.push(`install_id=${encodeURIComponent(installId)}`);
  if (options?.gameplayActive) output.push("gameplay_active=1");
  return (
    "/api/harthmere/live_mode_player_status_state" +
    (output.length ? `?${output.join("&")}` : "")
  );
}

function biomesUIPlayerStatusGameplayActive() {
  if (typeof document === "undefined") return false;
  if (document.visibilityState !== "visible") return false;
  if (document.documentElement.dataset.harthmereWakeUpActive === "true") {
    return false;
  }
  return true;
}

function biomesUIPlayerStatusRefreshDelayMs() {
  return biomesUIPlayerStatusGameplayActive() ? 5_000 : 15_000;
}

export function biomesUIPlayerStatusGameplayActiveForTest() {
  return biomesUIPlayerStatusGameplayActive();
}

export async function fetchBiomesUIPlayerStatus(
  fetchImpl: typeof fetch = fetch
): Promise<BiomesUIPlayerStatusSnapshot | undefined> {
  const response = await fetchHarthmereLiveWithTimeout(
    fetchImpl,
    biomesUIPlayerStatusEndpoint(undefined, {
      gameplayActive: biomesUIPlayerStatusGameplayActive(),
    }),
    {
      method: "GET",
      credentials: "same-origin",
    }
  );
  if (!response.ok) return undefined;
  const body = await response.json();
  return body?.playerStatusState;
}

export function useBiomesUIPlayerStatusState() {
  const [status, setStatus] = React.useState<
    BiomesUIPlayerStatusSnapshot | undefined
  >(undefined);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    let refreshInFlight = false;
    let timer: number | undefined;
    const schedule = () => {
      if (cancelled) return;
      timer = window.setTimeout(
        refresh,
        biomesUIPlayerStatusRefreshDelayMs()
      );
    };
    const refresh = async () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      try {
        const next = await fetchBiomesUIPlayerStatus();
        if (!cancelled) setStatus(next);
      } catch {
        if (!cancelled) setStatus(undefined);
      } finally {
        refreshInFlight = false;
        schedule();
      }
    };
    const onStatus = (event: Event) => {
      const next = (event as CustomEvent<BiomesUIPlayerStatusSnapshot>)
        .detail;
      if (next && typeof next === "object") {
        setStatus(next);
      } else {
        void refresh();
      }
    };
    void refresh();
    window.addEventListener(BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT, onStatus);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener(
        BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT,
        onStatus
      );
    };
  }, []);

  return status;
}
