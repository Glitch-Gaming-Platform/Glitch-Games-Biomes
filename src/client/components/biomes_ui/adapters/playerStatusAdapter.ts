import * as React from "react";
import { fetchHarthmereLiveWithTimeout } from "@/client/components/harthmere_live_fetch";
import { markHarthmereLiveSnapshotSeen } from "@/client/components/challenges/harthmereLiveAuthoritySignal";

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
    lastDeath?: {
      deathId?: string;
      cause?: string;
      zoneId?: string;
      atMs?: number;
      respawnAvailableAtMs?: number;
    };
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

export interface BiomesUIVitalsStaminaDisplayState {
  staminaValue: number;
  staminaMax: number;
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
  const liveCombatState = normalizeCombatState(live.combat.deathState, "alive");
  const fallbackHp = safeWhole(fallback.hp, liveHp);
  const fallbackMaxHp = Math.max(1, safeWhole(fallback.maxHp, liveMaxHp));
  const fallbackCombatState = normalizeCombatState(fallback.combatState);
  const fallbackDamagedOrDown =
    fallbackHp < fallbackMaxHp ||
    fallbackHp <= 0 ||
    isUrgentFallbackCombatState(fallbackCombatState);
  const liveLooksDefaultAlive =
    liveHp >= liveMaxHp && ["alive", "idle", "ready"].includes(liveCombatState);
  const fallbackIsDown =
    fallbackHp <= 0 ||
    ["dead", "downed", "respawning"].includes(fallbackCombatState);
  const fallbackIsProtectedRespawn =
    fallbackHp > 0 && fallbackCombatState === "protected_after_respawn";
  const liveLooksStaleDead =
    liveHp <= 0 || ["dead", "downed"].includes(liveCombatState);
  const liveContradictsLocalDownState = fallbackIsDown && liveHp > fallbackHp;
  const liveLooksStaleAboveLocalDamage =
    ["alive", "idle", "ready", "in_combat"].includes(liveCombatState) &&
    !fallbackIsDown &&
    fallbackHp > 0 &&
    fallbackHp < fallbackMaxHp &&
    fallbackHp < liveHp;
  return (
    (liveLooksDefaultAlive && fallbackDamagedOrDown) ||
    (fallbackIsProtectedRespawn && liveLooksStaleDead) ||
    liveContradictsLocalDownState ||
    liveLooksStaleAboveLocalDamage
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
  const preferFallbackCombat = shouldPreferFallbackCombatVitals(live, fallback);
  // maxHp / maxResource must be STABLE across the alive↔in-combat transition,
  // otherwise the health bar visibly rescales when combat starts (the server's
  // leveled max, e.g. 108, vs the local sim's base max, e.g. 100). We therefore
  // always take the server's max when it is present — even while we take the
  // *current* hp from the local fallback for fresh damage feedback — and clamp
  // hp into that stable range. This makes the bar identical whether alive or in
  // combat, and is consistent with the server being the source of truth.
  const liveMaxHp = safeWhole(live.combat?.maxHp, 0);
  const maxHp = Math.max(
    1,
    liveMaxHp > 0 ? liveMaxHp : Math.max(1, fallback.maxHp)
  );
  const rawHp = preferFallbackCombat
    ? fallback.hp
    : safeWhole(live.combat?.hp, fallback.hp);
  const hp = Math.min(maxHp, Math.max(0, rawHp));
  const combatState = preferFallbackCombat
    ? fallback.combatState
    : String(live.combat?.deathState || fallback.combatState);
  const liveMaxResource = safeWhole(live.combat?.maxResource, 0);
  const resourceMax = Math.max(
    1,
    liveMaxResource > 0 ? liveMaxResource : Math.max(1, fallback.resourceMax)
  );
  const rawResourceValue = preferFallbackCombat
    ? fallback.resourceValue
    : safeWhole(live.combat?.resource, fallback.resourceValue);
  const resourceValue = Math.min(resourceMax, Math.max(0, rawResourceValue));
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

export function biomesUIVitalsStaminaDisplayForTest(
  live: BiomesUIPlayerStatusSnapshot | undefined,
  fallback: BiomesUIVitalsStaminaDisplayState
): BiomesUIVitalsStaminaDisplayState {
  const resourceStamina = safeNumber(live?.combat?.resources?.stamina, NaN);
  const primaryStamina =
    String(live?.combat?.primaryResource ?? "").toLowerCase() === "stamina"
      ? safeNumber(live?.combat?.resource, NaN)
      : NaN;
  const liveStamina = Number.isFinite(resourceStamina)
    ? resourceStamina
    : primaryStamina;
  const resourceMax = safeNumber(live?.combat?.maxResources?.stamina, NaN);
  const primaryMax =
    String(live?.combat?.primaryResource ?? "").toLowerCase() === "stamina"
      ? safeNumber(live?.combat?.maxResource, NaN)
      : NaN;
  const liveMax = Number.isFinite(resourceMax) ? resourceMax : primaryMax;
  if (!Number.isFinite(liveStamina) || !Number.isFinite(liveMax)) {
    return fallback;
  }
  return {
    staminaValue: Math.max(0, liveStamina),
    staminaMax: Math.max(1, Math.round(liveMax)),
  };
}

export function biomesUIPlayerStatusEndpoint(
  search?: string,
  options?: { gameplayActive?: boolean }
): string {
  const rawSearch =
    search ??
    (typeof window !== "undefined" && window.location
      ? window.location.search
      : "");
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
      cache: "no-store",
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
      timer = window.setTimeout(refresh, biomesUIPlayerStatusRefreshDelayMs());
    };
    const refresh = async () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      try {
        const next = await fetchBiomesUIPlayerStatus();
        // HARTHMERE_HUD_STATUS_LAST_KNOWN_GOOD (2026-07-05): the live_mode
        // server can take 10s+ per request, so individual polls time out even
        // when the server is healthy. Clearing the status on a failed poll
        // dropped the HUD back onto the local combat sim (different HP/stamina
        // scale) — "HUD stats change depending on if the user is in combat".
        // Keep the last-known-good server snapshot; the next successful poll
        // replaces it.
        if (!cancelled) setStatus((prev) => next ?? prev);
        if (next) {
          // A server snapshot exists → the server is the authority for runtime
          // values. Record it so client simulations (stamina drain/death,
          // campfire heal, ...) defer to the server and stop double-owning them.
          markHarthmereLiveSnapshotSeen();
        }
      } catch {
        // Transient poll failure: retain the last-known-good server snapshot
        // rather than flipping the HUD back to the local simulation.
      } finally {
        refreshInFlight = false;
        schedule();
      }
    };
    const onStatus = (event: Event) => {
      const next = (event as CustomEvent<BiomesUIPlayerStatusSnapshot>).detail;
      if (next && typeof next === "object") {
        // The client-side combat simulation re-broadcasts the player's HP into
        // this same status channel on every local write (damage, regen, motion).
        // When a live server is authoritative, that flooded the polled server
        // snapshot and made the HUD HP flip-flop between the two sources
        // ("health jumping up and down"). The HUD already reflects local combat
        // HP through its combat-state fallback, so we never let the local
        // simulation's `combat` block overwrite the server-authoritative one;
        // we only merge its identity fields (class/level) so local-dev (which has
        // no server poll) still shows them. This gives the HUD reconciliation a
        // single, stable combat authority to compare against.
        if (
          (next as { version?: string }).version ===
          "harthmere-local-combat-player-status"
        ) {
          setStatus((prev) => {
            const merged: BiomesUIPlayerStatusSnapshot = { ...(prev ?? {}) };
            if (next.className) merged.className = next.className;
            if (Number.isFinite(next.level)) merged.level = next.level;
            // Intentionally keep prev.combat (server authority), or leave it
            // undefined in local-dev so the HUD falls back to local combat HP.
            return merged;
          });
          return;
        }
        // Server-fed status event (poll response, live-mode action response,
        // environment damage, respawn, dialogue) → server authority is present.
        markHarthmereLiveSnapshotSeen();
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
