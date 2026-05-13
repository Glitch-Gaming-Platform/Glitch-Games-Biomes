import {
  releaseHarthmerePlayerSpirit,
  respawnHarthmerePlayer,
  reviveHarthmerePlayer,
  useHarthmereCombatState,
} from "@/client/components/challenges/LocalDevHarthmereCombat";
import React, { useEffect, useMemo, useState } from "react";

export const HARTHMERE_DEATH_STATE_KEY =
  "biomes.localDev.harthmere.deathState.v1";
export const HARTHMERE_DEATH_EVENT = "biomes:harthmere-death-changed";

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
    const raw = window.localStorage.getItem(HARTHMERE_DEATH_STATE_KEY);
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
    HARTHMERE_DEATH_STATE_KEY,
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
            Harthmere Death & Respawn
          </div>
          <div className="text-xs text-white/70">
            Downed state, revive, respawn choices, protection, death recap,
            durability loss, and fair recovery rules.
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
              onClick={() => respawnHarthmerePlayer(id)}
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
