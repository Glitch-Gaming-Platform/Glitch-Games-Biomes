import * as React from "react";

export const BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT =
  "biomes:live-mode-player-status-updated";

export interface BiomesUIStandingStatusV1 {
  likeability: number;
  legal: number;
  notoriety: number;
  notorietyFloor?: number;
}

export interface BiomesUIPlayerStatusSnapshotV1 {
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
  };
  standing?: BiomesUIStandingStatusV1 & { scopeId?: string };
  gold?: number;
}

export interface BiomesUIVitalsDisplayStateV1 {
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
  standing?: BiomesUIStandingStatusV1;
  gold?: number;
}

function safeNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function safeWhole(value: unknown, fallback = 0): number {
  return Math.max(0, Math.trunc(safeNumber(value, fallback)));
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
  live: BiomesUIPlayerStatusSnapshotV1 | undefined,
  fallback: BiomesUIVitalsDisplayStateV1
): BiomesUIVitalsDisplayStateV1 {
  if (!live) return fallback;
  const resourceKind = live.combat?.primaryResource;
  const resourceLabel = formatBiomesResourceLabelForVitalsForTest(
    resourceKind,
    live.combat?.primaryResourceLabel
  );
  const level = Math.max(1, safeWhole(live.level, fallback.level ?? 1));
  const className = String(live.className || "").trim();
  return {
    ...fallback,
    hp: safeWhole(live.combat?.hp, fallback.hp),
    maxHp: Math.max(1, safeWhole(live.combat?.maxHp, fallback.maxHp)),
    combatState: String(live.combat?.deathState || fallback.combatState),
    resourceLabel,
    resourceValue: safeWhole(live.combat?.resource, fallback.resourceValue),
    resourceMax: Math.max(
      1,
      safeWhole(live.combat?.maxResource, fallback.resourceMax)
    ),
    classLine: className ? `${className} · Level ${level}` : fallback.classLine,
    level,
    xpCurrent: safeWhole(live.xp?.current, fallback.xpCurrent ?? 0),
    xpNext: Math.max(1, safeWhole(live.xp?.next, fallback.xpNext ?? 1)),
    standing: live.standing
      ? {
          likeability: Math.round(safeNumber(live.standing.likeability)),
          legal: Math.round(safeNumber(live.standing.legal)),
          notoriety: Math.round(safeNumber(live.standing.notoriety)),
          notorietyFloor: Math.round(
            safeNumber(live.standing.notorietyFloor)
          ),
        }
      : fallback.standing,
    gold: safeWhole(live.gold, fallback.gold ?? 0),
  };
}

export async function fetchBiomesUIPlayerStatusV1(
  fetchImpl: typeof fetch = fetch
): Promise<BiomesUIPlayerStatusSnapshotV1 | undefined> {
  const response = await fetchImpl("/api/harthmere/live_mode_player_status_state", {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) return undefined;
  const body = await response.json();
  return body?.playerStatusState;
}

export function useBiomesUIPlayerStatusStateV1() {
  const [status, setStatus] =
    React.useState<BiomesUIPlayerStatusSnapshotV1 | undefined>(undefined);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await fetchBiomesUIPlayerStatusV1();
        if (!cancelled) setStatus(next);
      } catch {
        if (!cancelled) setStatus(undefined);
      }
    };
    const onStatus = (event: Event) => {
      const next = (event as CustomEvent<BiomesUIPlayerStatusSnapshotV1>).detail;
      if (next && typeof next === "object") {
        setStatus(next);
      } else {
        void refresh();
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 5_000);
    window.addEventListener(BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT, onStatus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener(BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT, onStatus);
    };
  }, []);

  return status;
}
