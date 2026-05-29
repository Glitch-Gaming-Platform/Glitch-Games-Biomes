import {
  endHarthmereRespawnProtection,
  releaseHarthmerePlayerSpirit,
  respawnHarthmerePlayer,
  reviveHarthmerePlayer,
  useHarthmereCombatState,
} from "@/client/components/challenges/LocalDevHarthmereCombat";
import { harthmereUserScopedStorageKey } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import React, { useEffect, useMemo, useState } from "react";

export const HARTHMERE_DEATH_STATE_KEY =
  "biomes.localDev.harthmere.deathState.v1";
export const HARTHMERE_DEATH_EVENT = "biomes:harthmere-death-changed";
export const HARTHMERE_DEATH_MOVEMENT_LOCK_VERSION_V135 =
  "harthmere-death-movement-lock-v135" as const;
export const HARTHMERE_PLAYER_DEATH_POSE_EVENT_V135 =
  "biomes:harthmere-player-death-pose-v135" as const;

export const HARTHMERE_DEATH_SCREEN_VERSION_V139 =
  "harthmere-death-screen-grove-respawn-v139" as const;
export const HARTHMERE_GROVE_RESPAWN_TELEPORT_TARGET_V139 = {
  x: 496,
  y: 70,
  z: -126,
  label: "The Grove",
  reason: "harthmere_death_respawn_to_grove_v139",
} as const;
export const HARTHMERE_GROVE_RESPAWN_TELEPORT_STORAGE_KEY_V139 =
  "biomes.localDev.harthmere.teleportTarget" as const;

interface HarthmereGroveTeleportResultV139 {
  ok: boolean;
  teleported: boolean;
  stored: boolean;
  target: typeof HARTHMERE_GROVE_RESPAWN_TELEPORT_TARGET_V139;
  source: string;
  error?: string;
}

type HarthmereDeathStateName =
  | "alive"
  | "downed"
  | "dead"
  | "reviving"
  | "respawning"
  | "ghost"
  | "protected_after_respawn"
  | "captured"
  | "unconscious";

type HarthmereKillerType =
  | "npc"
  | "player"
  | "environment"
  | "guard"
  | "unknown";

interface HarthmereDamageSummaryLine {
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
  createdAt: number;
}

interface HarthmereDeathLogEntry {
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

const RESPAWN_POINTS: Record<
  string,
  {
    label: string;
    description: string;
    hpPercent: number;
    sicknessSeconds: number;
  }
> = {
  the_grove: {
    label: "The Grove",
    description: "Main Grove recovery point near the starter fountain.",
    hpPercent: 0.65,
    sicknessSeconds: 75,
  },
  temple_green: {
    label: "Temple Green Shrine",
    description:
      "Safe healer respawn inside town. Applies light recovery sickness.",
    hpPercent: 0.55,
    sicknessSeconds: 90,
  },
  north_gate: {
    label: "North Gate Checkpoint",
    description: "Useful if you fell near the road or fought outside town.",
    hpPercent: 0.45,
    sicknessSeconds: 120,
  },
  player_house: {
    label: "Player House",
    description: "A quiet bind-style recovery point with safer protection.",
    hpPercent: 0.7,
    sicknessSeconds: 60,
  },
};

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function deathEvent() {
  if (!isBrowser()) {
    return;
  }
  window.dispatchEvent(new CustomEvent(HARTHMERE_DEATH_EVENT));
  window.dispatchEvent(new CustomEvent("biomes:harthmere-combat-changed"));
}

function defaultDeathState(): HarthmereDeathState {
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

function normalizeState(
  raw?: Partial<HarthmereDeathState>,
): HarthmereDeathState {
  const fallback = defaultDeathState();
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
    return defaultDeathState();
  }
  try {
    const scopedRaw = window.localStorage.getItem(
      harthmereUserScopedStorageKey(HARTHMERE_DEATH_STATE_KEY),
    );
    const legacyRaw = window.localStorage.getItem(HARTHMERE_DEATH_STATE_KEY);
    const raw = scopedRaw ?? legacyRaw;
    if (!raw) {
      return defaultDeathState();
    }
    return normalizeState(JSON.parse(raw) as Partial<HarthmereDeathState>);
  } catch {
    return defaultDeathState();
  }
}

export function writeHarthmereDeathState(state: HarthmereDeathState) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(
    harthmereUserScopedStorageKey(HARTHMERE_DEATH_STATE_KEY),
    JSON.stringify(normalizeState(state)),
  );
  deathEvent();
}

function appendDeathLog(
  state: HarthmereDeathState,
  label: string,
  detail: string,
): HarthmereDeathState {
  return {
    ...state,
    recent: [
      {
        id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        at: Date.now(),
        label,
        detail,
      },
      ...state.recent,
    ].slice(0, 12),
  };
}

export function clearHarthmereDeathState(detail = "Death state cleared.") {
  const state = readHarthmereDeathState();
  writeHarthmereDeathState(
    appendDeathLog(
      {
        ...state,
        state: "alive",
        currentDeath: undefined,
        downedUntil: undefined,
        forcedRespawnAt: undefined,
        protectionUntil: undefined,
      },
      "Alive",
      detail,
    ),
  );
}

export function requestHarthmereGroveRespawnTeleportV139(): HarthmereGroveTeleportResultV139 {
  const target = HARTHMERE_GROVE_RESPAWN_TELEPORT_TARGET_V139;
  if (!isBrowser()) {
    return {
      ok: false,
      teleported: false,
      stored: false,
      target,
      source: "server_or_non_browser",
    };
  }

  try {
    const liveDebug = (window as typeof window & {
      __harthmereLivePlayerDebug?: {
        teleportTo?: (target: Record<string, unknown>) => Record<string, unknown>;
      };
    }).__harthmereLivePlayerDebug;
    const liveResult = liveDebug?.teleportTo?.(target);
    if (liveResult?.teleported === true || liveResult?.ok === true) {
      return {
        ok: true,
        teleported: true,
        stored: false,
        target,
        source: "live_player_debug_teleport",
      };
    }
  } catch (error) {
    // Keep going. A failed live hook must not block the respawn button.
    void error;
  }

  try {
    window.localStorage.setItem(
      HARTHMERE_GROVE_RESPAWN_TELEPORT_STORAGE_KEY_V139,
      JSON.stringify(target),
    );
    return {
      ok: true,
      teleported: false,
      stored: true,
      target,
      source: "stored_player_teleport_request",
    };
  } catch (error) {
    return {
      ok: false,
      teleported: false,
      stored: false,
      target,
      source: "stored_player_teleport_failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function respawnHarthmerePlayerAtGroveV139() {
  const teleportResult = requestHarthmereGroveRespawnTeleportV139();
  respawnHarthmerePlayer("the_grove");
  deathEvent();
  return teleportResult;
}

export function useHarthmereDeathState() {
  const [state, setState] = useState<HarthmereDeathState>(() =>
    readHarthmereDeathState(),
  );

  useEffect(() => {
    const refresh = () => setState(readHarthmereDeathState());
    const interval = window.setInterval(refresh, 500);
    window.addEventListener("storage", refresh);
    window.addEventListener(HARTHMERE_DEATH_EVENT, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(HARTHMERE_DEATH_EVENT, refresh);
    };
  }, []);

  return state;
}


const HARTHMERE_DEATH_LOCKED_STATES_V135: ReadonlySet<HarthmereDeathStateName> =
  new Set(["downed", "dead", "reviving", "respawning", "ghost", "captured", "unconscious"]);

const HARTHMERE_DEATH_MOVEMENT_KEYS_V135 = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "Mouse0",
]);

function shouldLockHarthmereDeathMovementV135(
  death: HarthmereDeathState,
  combat: ReturnType<typeof useHarthmereCombatState>,
) {
  return (
    HARTHMERE_DEATH_LOCKED_STATES_V135.has(death.state) ||
    Number(combat.player.hp) <= 0 ||
    ["downed", "dead", "respawning"].includes(String(combat.player.combatState ?? ""))
  );
}

function dispatchHarthmerePlayerDeathPoseV135(active: boolean, state: string) {
  if (!isBrowser()) {
    return;
  }
  if (active) {
    document.documentElement.dataset.harthmereDeathMovementLocked =
      HARTHMERE_DEATH_MOVEMENT_LOCK_VERSION_V135;
  } else {
    delete document.documentElement.dataset.harthmereDeathMovementLocked;
  }
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_PLAYER_DEATH_POSE_EVENT_V135, {
      detail: { active, state, version: HARTHMERE_DEATH_MOVEMENT_LOCK_VERSION_V135 },
    }),
  );
}

function secondsRemaining(until?: number) {
  if (!until) {
    return 0;
  }
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

function stateLabel(state: HarthmereDeathStateName) {
  return state.replaceAll("_", " ");
}

function protectionLabel(state: HarthmereDeathState) {
  const seconds = secondsRemaining(state.protectionUntil);
  if (seconds <= 0) {
    return undefined;
  }
  return `${seconds}s protected`;
}

function sicknessLabel(state: HarthmereDeathState) {
  const seconds = secondsRemaining(state.resurrectionSicknessUntil);
  if (seconds <= 0) {
    return undefined;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")} resurrection sickness`;
}

export const HarthmereDeathHUD: React.FunctionComponent<{}> = () => {
  const death = useHarthmereDeathState();
  const combat = useHarthmereCombatState();
  const protection = protectionLabel(death);
  const sickness = sicknessLabel(death);
  const downedSeconds = secondsRemaining(death.downedUntil);

  if (death.state === "alive" && !protection && !sickness) {
    return <></>;
  }

  return (
    <div
      className="pointer-events-none w-[21rem] rounded-lg border border-rose-300/35 bg-black/75 p-2 text-white shadow-lg"
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-rose-200">
            Death & Respawn
          </div>
          <div className="text-xs capitalize text-white/80">
            {stateLabel(death.state)} · HP {combat.player.hp}/
            {combat.player.maxHp}
          </div>
        </div>
        <div className="rounded bg-rose-300/20 px-1.5 py-0.5 text-xs font-semibold text-rose-100">
          {death.state === "downed"
            ? `${downedSeconds}s`
            : (protection ?? "Status")}
        </div>
      </div>
      <div className="mt-1 text-xs leading-snug text-white/80">
        {death.currentDeath ? (
          <>
            <span className="font-semibold text-rose-100">Cause:</span>{" "}
            {death.currentDeath.cause} by {death.currentDeath.killerName}.
          </>
        ) : (
          (protection ?? sickness ?? "You are recovering from a recent death.")
        )}
      </div>
    </div>
  );
};


export const HarthmereDeathRuntimeController: React.FunctionComponent<{}> = () => {
  const death = useHarthmereDeathState();
  const combat = useHarthmereCombatState();

  useEffect(() => {
    const tick = () => {
      const latest = readHarthmereDeathState();
      const now = Date.now();
      if (latest.state === "downed" && latest.downedUntil && now >= latest.downedUntil) {
        releaseHarthmerePlayerSpirit();
        return;
      }
      if (["dead", "ghost"].includes(latest.state) && latest.forcedRespawnAt && now >= latest.forcedRespawnAt) {
        respawnHarthmerePlayer("temple_green");
        return;
      }
      if (latest.state === "protected_after_respawn" && latest.protectionUntil && now >= latest.protectionUntil) {
        endHarthmereRespawnProtection("Respawn protection timer expired.");
      }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [death.state, death.downedUntil, death.forcedRespawnAt, death.protectionUntil]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const locked = shouldLockHarthmereDeathMovementV135(death, combat);
    dispatchHarthmerePlayerDeathPoseV135(locked, death.state);

    if (!locked) {
      delete document.documentElement.dataset.harthmereDeathMovementLocked;
      return;
    }

    try {
      document.exitPointerLock?.();
    } catch {}

    const preventMovement = (event: KeyboardEvent) => {
      if (!HARTHMERE_DEATH_MOVEMENT_KEYS_V135.has(event.code)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    const preventPointerMovement = (event: MouseEvent) => {
      // Let UI buttons and respawn panels remain clickable. Only suppress
      // gameplay movement/attack events while the death state is active.
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("button,a,input,textarea,select,[role='button']")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    window.addEventListener("keydown", preventMovement, true);
    window.addEventListener("keyup", preventMovement, true);
    window.addEventListener("mousedown", preventPointerMovement, true);
    window.addEventListener("mouseup", preventPointerMovement, true);
    window.addEventListener("click", preventPointerMovement, true);
    return () => {
      window.removeEventListener("keydown", preventMovement, true);
      window.removeEventListener("keyup", preventMovement, true);
      window.removeEventListener("mousedown", preventPointerMovement, true);
      window.removeEventListener("mouseup", preventPointerMovement, true);
      window.removeEventListener("click", preventPointerMovement, true);
      dispatchHarthmerePlayerDeathPoseV135(false, "alive");
    };
  }, [combat.player.combatState, combat.player.hp, death.state]);

  return null;
};

export const HarthmereDeathScreenOverlayV139: React.FunctionComponent<{}> = () => {
  const death = useHarthmereDeathState();
  const combat = useHarthmereCombatState();
  const downedSeconds = secondsRemaining(death.downedUntil);
  const active =
    HARTHMERE_DEATH_LOCKED_STATES_V135.has(death.state) ||
    Number(combat.player.hp) <= 0 ||
    ["downed", "dead", "respawning"].includes(
      String(combat.player.combatState ?? ""),
    );

  if (!active) {
    return <></>;
  }

  const cause = death.currentDeath
    ? death.currentDeath.cause.toLowerCase().includes("stamina")
      ? "You are gone too soon from exhaustion..."
      : `You are gone too soon. ${death.currentDeath.cause}.`
    : `You are gone too soon. HP ${combat.player.hp}/${combat.player.maxHp}.`;
  const consequence = death.currentDeath?.killerName
    ? `and were claimed by ${death.currentDeath.killerName}`
    : "and need to return to safety";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-black/45 text-white grayscale"
      data-harthmere-death-screen-version={HARTHMERE_DEATH_SCREEN_VERSION_V139}
      style={{
        textShadow: "0 2px 5px rgba(0,0,0,0.95)",
        backdropFilter: "grayscale(1) brightness(0.72)",
      }}
    >
      <div className="pointer-events-auto w-[min(24rem,calc(100vw-2rem))] text-center">
        <div className="text-lg font-black tracking-tight text-white">
          {cause}
        </div>
        <div className="mx-auto mt-1 max-w-[22rem] text-base font-bold leading-snug text-white/55">
          {consequence}
        </div>
        {downedSeconds > 0 && (
          <div className="mt-2 text-xs font-semibold text-white/60">
            Forced spirit release in {downedSeconds}s.
          </div>
        )}
        <div className="mt-4 flex flex-col items-center justify-center gap-2">
          <button
            className="min-w-[19rem] rounded-lg border-2 border-white/75 bg-violet-500 px-5 py-3 text-base font-black text-white shadow-[0_3px_0_rgba(0,0,0,0.55),0_0_22px_rgba(139,92,246,0.55)] outline outline-1 outline-black/60 hover:bg-violet-400 focus-visible:ring-2 focus-visible:ring-white"
            data-harthmere-death-respawn-grove-v139="true"
            onClick={() => respawnHarthmerePlayerAtGroveV139()}
          >
            Resurrect at The Grove Safe Point
          </button>
          <div className="text-[11px] font-bold text-white/70">
            Return to the safe respawn marker and recover control.
          </div>
        </div>
      </div>
    </div>
  );
};

export const HarthmereDeathMenuPanel: React.FunctionComponent<{}> = () => {
  const death = useHarthmereDeathState();
  const combat = useHarthmereCombatState();
  const downedSeconds = secondsRemaining(death.downedUntil);
  const protection = protectionLabel(death);
  const sickness = sicknessLabel(death);
  const damageSummary = death.currentDeath?.damageSummary ?? [];

  const respawnChoices = useMemo(() => Object.entries(RESPAWN_POINTS), []);

  return (
    <div className="pointer-events-auto mb-2 max-h-[65vh] w-[31rem] overflow-y-auto rounded-lg border border-rose-300/25 bg-black/85 p-3 text-white shadow-xl">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-bold text-rose-200">
            Biomes Death & Respawn
          </div>
          <div className="text-xs text-white/70">
            Downed state, revive, respawn choices, protection, death recap,
            durability loss, and fair recovery rules. Rule refs: Harthmere Town Design Bible §14.1 respawn pacing, MMO_RULES progression fairness, and Wilds readable danger escalation.
          </div>
        </div>
        <div className="rounded bg-white/10 px-2 py-1 text-xs capitalize text-white/80">
          {stateLabel(death.state)}
        </div>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2 rounded border border-white/10 bg-white/5 p-2 text-xs">
        <div>
          <div className="font-semibold text-white">Current State</div>
          <div className="capitalize text-white/75">
            {stateLabel(death.state)}
          </div>
          <div className="text-white/75">
            HP {combat.player.hp}/{combat.player.maxHp}
          </div>
          {downedSeconds > 0 && (
            <div className="text-rose-100">Downed timer: {downedSeconds}s</div>
          )}
          {protection && <div className="text-sky-100">{protection}</div>}
          {sickness && <div className="text-amber-100">{sickness}</div>}
        </div>
        <div>
          <div className="font-semibold text-white">Penalty Rules</div>
          <div className="text-white/70">
            Normal local-dev death uses durability loss, safe respawn, and short
            recovery sickness. No XP loss or permanent item loss.
          </div>
        </div>
      </div>

      {death.currentDeath ? (
        <div className="mb-2 rounded border border-rose-300/20 bg-rose-950/20 p-2 text-xs">
          <div className="font-semibold text-rose-100">Death Recap</div>
          <div className="text-white/75">
            {death.currentDeath.cause} · {death.currentDeath.killerName} ·{" "}
            {new Date(death.currentDeath.createdAt).toLocaleTimeString()}
          </div>
          <div className="mt-1 text-white/75">
            Durability loss: {death.currentDeath.durabilityLossPercent}% · XP
            debt: {death.currentDeath.xpDebt}
          </div>
          <div className="mt-2 space-y-1">
            {damageSummary.length ? (
              damageSummary.slice(0, 6).map((line, index) => (
                <div
                  key={`${line.source}-${line.ability}-${index}`}
                  className="rounded bg-black/30 px-2 py-1 text-white/75"
                >
                  {line.source} — {line.ability}: {line.damage} {line.type}
                </div>
              ))
            ) : (
              <div className="text-white/60">No detailed damage lines yet.</div>
            )}
          </div>
        </div>
      ) : null}

      <div className="mb-2 flex flex-wrap gap-2">
        <button
          className="rounded bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!["downed", "dead"].includes(death.state)}
          onClick={() => reviveHarthmerePlayer("Field Revive")}
        >
          Revive Here
        </button>
        <button
          className="rounded bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={death.state !== "downed"}
          onClick={() => releaseHarthmerePlayerSpirit()}
        >
          Release Spirit
        </button>
        <button
          className="rounded bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20"
          onClick={() =>
            clearHarthmereDeathState("Local-dev death state manually cleared.")
          }
        >
          Clear Death State
        </button>
      </div>

      <div className="mb-2 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
          Respawn Options
        </div>
        {respawnChoices.map(([id, point]) => (
          <div
            key={id}
            className="flex items-start justify-between gap-2 rounded border border-white/10 bg-white/5 p-2 text-xs"
          >
            <div>
              <div className="font-semibold text-white">{point.label}</div>
              <div className="text-white/65">{point.description}</div>
              <div className="text-white/55">
                Returns at {Math.round(point.hpPercent * 100)}% HP · sickness{" "}
                {point.sicknessSeconds}s
              </div>
            </div>
            <button
              className="shrink-0 rounded bg-rose-300 px-2 py-1 font-semibold text-black hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!["downed", "dead", "ghost"].includes(death.state)}
              onClick={() =>
                id === "the_grove"
                  ? respawnHarthmerePlayerAtGroveV139()
                  : respawnHarthmerePlayer(id)
              }
            >
              Respawn
            </button>
          </div>
        ))}
      </div>

      <div className="rounded border border-white/10 bg-white/5 p-2 text-xs leading-snug text-white/75">
        <div className="mb-1 font-semibold text-white">
          Implementation Notes
        </div>
        <div>
          Player death uses a recoverable downed state first. Respawn points
          must be safe, valid, and protected. Attacking after respawn ends
          protection. NPC deaths still grant combat credit, quest progress, XP,
          reputation, and legal consequences through the existing Harthmere
          systems.
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {death.recent.slice(0, 5).map((event) => (
          <div
            key={event.id}
            className="rounded border border-white/10 bg-black/20 p-2 text-xs"
          >
            <div className="font-semibold text-white">{event.label}</div>
            <div className="text-white/70">{event.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
