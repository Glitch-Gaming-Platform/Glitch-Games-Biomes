import {
  downHarthmerePlayerFromSystem,
  endHarthmereRespawnProtection,
  releaseHarthmerePlayerSpirit,
  respawnHarthmerePlayer,
  reviveHarthmerePlayer,
  useHarthmereCombatState,
} from "@/client/components/challenges/LocalDevHarthmereCombat";
import {
  describeHarthmereDeathInterface,
  harthmereRespawnDisabledReason,
} from "@/client/components/challenges/harthmereCombatDeathInterfaceRules";
import {
  HARTHMERE_DEATH_SCREEN_VERSION,
  HarthmereDeathScreenOverlayView,
} from "@/client/components/challenges/HarthmereDeathScreenOverlayView";
import {
  isHarthmereWakeUpScreenActive,
  restoreHarthmereFoodStaminaToFullForRespawn,
} from "@/client/components/challenges/LocalDevHarthmereFoodStaminaSystem";
import {
  appendHarthmereDeathLog as appendDeathLog,
  dispatchHarthmereDeathStateChanged as deathEvent,
  HARTHMERE_DEATH_EVENT,
  HARTHMERE_DEATH_STATE_KEY,
  readHarthmereDeathState,
  writeHarthmereDeathState,
  type HarthmereDeathRecord,
  type HarthmereDeathState,
  type HarthmereDeathStateName,
} from "@/client/components/challenges/harthmereDeathStateStore";
import {
  BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT,
  type BiomesUIPlayerStatusSnapshot,
  useBiomesUIPlayerStatusState,
} from "@/client/components/biomes_ui/adapters/playerStatusAdapter";
import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import { fireAndForget } from "@/shared/util/async";
import React, { useEffect, useMemo, useState } from "react";

export {
  HARTHMERE_DEATH_EVENT,
  HARTHMERE_DEATH_STATE_KEY,
  readHarthmereDeathState,
  writeHarthmereDeathState,
};
export type {
  HarthmereDeathRecord,
  HarthmereDeathState,
  HarthmereDeathStateName,
};

// Cloud-save guardrails scan this owning file for the literal save key:
// biomes.localDev.harthmere.deathState
export const HARTHMERE_DEATH_MOVEMENT_LOCK_VERSION =
  "harthmere-death-movement-lock" as const;
export const HARTHMERE_PLAYER_DEATH_POSE_EVENT =
  "biomes:harthmere-player-death-pose" as const;

export { HARTHMERE_DEATH_SCREEN_VERSION };
export const HARTHMERE_GROVE_RESPAWN_TELEPORT_TARGET = {
  x: 496,
  y: 70,
  z: -126,
  label: "The Grove",
  reason: "harthmere_death_respawn_to_grove",
} as const;
export const HARTHMERE_GROVE_RESPAWN_TELEPORT_STORAGE_KEY =
  "biomes.localDev.harthmere.teleportTarget" as const;

interface HarthmereGroveTeleportResult {
  ok: boolean;
  teleported: boolean;
  stored: boolean;
  target: typeof HARTHMERE_GROVE_RESPAWN_TELEPORT_TARGET;
  source: string;
  error?: string;
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
    hpPercent: 1,
    sicknessSeconds: 75,
  },
  temple_green: {
    label: "Temple Green Shrine",
    description:
      "Safe healer respawn inside town. Applies light recovery sickness.",
    hpPercent: 1,
    sicknessSeconds: 90,
  },
  north_gate: {
    label: "North Gate Checkpoint",
    description: "Useful if you fell near the road or fought outside town.",
    hpPercent: 1,
    sicknessSeconds: 120,
  },
  player_house: {
    label: "Player House",
    description: "A quiet bind-style recovery point with safer protection.",
    hpPercent: 1,
    sicknessSeconds: 60,
  },
};

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
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
      detail
    )
  );
}

export function requestHarthmereGroveRespawnTeleport(): HarthmereGroveTeleportResult {
  const target = HARTHMERE_GROVE_RESPAWN_TELEPORT_TARGET;
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
    const liveDebug = (
      window as typeof window & {
        __harthmereLivePlayerDebug?: {
          teleportTo?: (
            target: Record<string, unknown>
          ) => Record<string, unknown>;
        };
      }
    ).__harthmereLivePlayerDebug;
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
      HARTHMERE_GROVE_RESPAWN_TELEPORT_STORAGE_KEY,
      JSON.stringify(target)
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

async function submitHarthmereLiveModeGroveRespawn() {
  const requestId = `harthmere_grove_respawn_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const response = await defaultHarthmereLiveFetch("/api/harthmere/live_mode", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId,
      idempotencyKey: requestId,
      actionKind: "request_respawn",
      subsystem: "combat",
      actorEntityVersion: 1,
      zoneId: "the_grove",
      payload: {
        respawnPointId: "the_grove",
        protectionMs: 10_000,
      },
      clientClaims: {},
      includeSnapshots: ["combatState", "playerStatusState"],
    }),
  });
  const body = await response.json().catch(() => undefined);
  if (
    body?.ok === true &&
    body?.playerStatusState &&
    typeof window !== "undefined"
  ) {
    window.dispatchEvent(
      new CustomEvent(BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT, {
        detail: body.playerStatusState,
      })
    );
  }
  return body;
}

export function respawnHarthmerePlayerAtGrove(
  deathStateOverride?: HarthmereDeathState
) {
  const state = deathStateOverride ?? readHarthmereDeathState();
  const blockedReason = harthmereRespawnDisabledReason(state, "the_grove");
  if (blockedReason) {
    writeHarthmereDeathState(
      appendDeathLog(state, "Respawn Blocked", blockedReason)
    );
    return {
      ok: false,
      teleported: false,
      stored: false,
      target: HARTHMERE_GROVE_RESPAWN_TELEPORT_TARGET,
      source: "respawn_rules_blocked",
      error: blockedReason,
    };
  }
  const teleportResult = requestHarthmereGroveRespawnTeleport();
  fireAndForget(
    submitHarthmereLiveModeGroveRespawn().catch((error) => {
      writeHarthmereDeathState(
        appendDeathLog(
          readHarthmereDeathState(),
          "Live Respawn Pending",
          error instanceof Error ? error.message : String(error)
        )
      );
    })
  );
  respawnHarthmerePlayer("the_grove");
  restoreHarthmereFoodStaminaToFullForRespawn(
    "Respawned at The Grove with a full stamina bar."
  );
  deathEvent();
  return teleportResult;
}

export function useHarthmereDeathState() {
  const [state, setState] = useState<HarthmereDeathState>(() =>
    readHarthmereDeathState()
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

const HARTHMERE_DEATH_LOCKED_STATES: ReadonlySet<HarthmereDeathStateName> =
  new Set([
    "downed",
    "dead",
    "reviving",
    "respawning",
    "ghost",
    "captured",
    "unconscious",
  ]);

const HARTHMERE_DEATH_MOVEMENT_KEYS = new Set([
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

export function harthmereLocalCombatLooksDeadForTest(input: {
  hp?: number;
  combatState?: unknown;
}) {
  return (
    Number(input.hp) <= 0 ||
    ["downed", "dead", "respawning"].includes(String(input.combatState ?? ""))
  );
}

export function harthmereShouldClearLiveAliveDeathLockForTest(input: {
  deathState: HarthmereDeathStateName;
  hp?: number;
  combatState?: unknown;
}) {
  return (
    HARTHMERE_DEATH_LOCKED_STATES.has(input.deathState) &&
    !harthmereLocalCombatLooksDeadForTest(input)
  );
}

export function harthmereDeathMovementShouldLockForTest(input: {
  deathState: HarthmereDeathStateName;
  hp?: number;
  combatState?: unknown;
  wakeUpActive?: boolean;
}) {
  const deathActive =
    HARTHMERE_DEATH_LOCKED_STATES.has(input.deathState) ||
    harthmereLocalCombatLooksDeadForTest(input);
  if (!deathActive) {
    return false;
  }
  return true;
}

export function harthmereActiveRespawnProtectionSuppressesDeathSyncForTest(input: {
  deathState: HarthmereDeathStateName;
  protectionUntil?: number;
  nowMs?: number;
}) {
  if (input.deathState !== "protected_after_respawn") {
    return false;
  }
  const protectionUntil = Number(input.protectionUntil);
  return (
    !Number.isFinite(protectionUntil) ||
    protectionUntil > (input.nowMs ?? Date.now())
  );
}

export function harthmereDeathScreenShouldRenderForTest(input: {
  death: HarthmereDeathState;
  effectiveDeath: HarthmereDeathState;
  wakeUpActive?: boolean;
}) {
  return (
    HARTHMERE_DEATH_LOCKED_STATES.has(input.effectiveDeath.state) ||
    input.effectiveDeath !== input.death
  );
}

export function harthmereLivePlayerDeathSyncSummaryForTest(
  status: BiomesUIPlayerStatusSnapshot | undefined
) {
  const rawHp = Number(status?.combat?.hp);
  const liveHp = Number.isFinite(rawHp) ? rawHp : undefined;
  const liveDeathState = String(status?.combat?.deathState ?? "alive")
    .trim()
    .toLowerCase();
  const dead =
    liveDeathState === "dead" ||
    liveDeathState === "downed" ||
    (liveHp !== undefined && liveHp <= 0);
  const alive =
    !dead &&
    liveHp !== undefined &&
    liveHp > 0 &&
    ["alive", "idle", "ready", "protected_after_respawn"].includes(
      liveDeathState
    );
  return {
    hp: liveHp,
    deathState: liveDeathState,
    dead,
    alive,
  };
}

export type HarthmereDeathSyncAction =
  | { kind: "none" }
  | { kind: "clear"; detail: string }
  | { kind: "pose"; state: HarthmereDeathStateName }
  | {
      kind: "down";
      cause: string;
      killerName: string;
      abilityName: string;
      damage: number;
      damageType: string;
      detail: string;
    };

function normalizedLiveDeathCause(status?: BiomesUIPlayerStatusSnapshot) {
  return String(status?.combat?.lastDeath?.cause ?? "")
    .trim()
    .toLowerCase();
}

function liveDeathSyncDownActionForStatus(input: {
  status?: BiomesUIPlayerStatusSnapshot;
  liveDeathState: string;
  localHp?: number;
  localMaxHp?: number;
}): Extract<HarthmereDeathSyncAction, { kind: "down" }> {
  const cause = normalizedLiveDeathCause(input.status);
  const liveHp = finiteNumberOrUndefined(input.status?.combat?.hp);
  const maxHp = Math.max(1, Math.round(Number(input.localMaxHp) || 100));
  const remainingHp = liveHp ?? (Number(input.localHp) || 0);
  const damage = Math.max(1, Math.round(maxHp - Math.max(0, remainingHp)));

  if (cause === "fall_damage" || cause === "fall") {
    return {
      kind: "down",
      cause: "fall_damage",
      killerName: "The Fall",
      abilityName: "Fall Damage",
      damage,
      damageType: "survival",
      detail:
        "You hit the ground hard. Respawn at The Grove to recover movement.",
    };
  }

  if (cause === "drowning") {
    return {
      kind: "down",
      cause: "drowning",
      killerName: "Deep Water",
      abilityName: "Drowning",
      damage,
      damageType: "survival",
      detail:
        "You ran out of breath and drowned. Respawn at The Grove to recover movement.",
    };
  }

  if (cause === "stamina_depleted" || cause === "exhaustion") {
    return {
      kind: "down",
      cause: "Stamina reached zero",
      killerName: "Starvation and exhaustion",
      abilityName: "Stamina Depletion",
      damage,
      damageType: "survival",
      detail:
        "You ran out of stamina. Eat food to keep your body going after respawning.",
    };
  }

  return {
    kind: "down",
    cause:
      input.liveDeathState === "downed"
        ? "Live player status is downed"
        : "Live player status is dead",
    killerName: "Mucker or Hex",
    abilityName: "Live Entity Attack",
    damage,
    damageType: "combat",
    detail:
      "Live Harthmere status says you are downed or dead. Respawn at The Grove to recover movement.",
  };
}

export function harthmereLivePlayerDeathSyncActionForTest(input: {
  status?: BiomesUIPlayerStatusSnapshot;
  currentDeathState: HarthmereDeathStateName;
  currentProtectionUntil?: number;
  nowMs?: number;
  localHp?: number;
  localMaxHp?: number;
  localCombatState?: unknown;
}): HarthmereDeathSyncAction {
  const live = harthmereLivePlayerDeathSyncSummaryForTest(input.status);
  const localCombatDead = harthmereLocalCombatLooksDeadForTest({
    hp: input.localHp,
    combatState: input.localCombatState,
  });
  if (
    harthmereActiveRespawnProtectionSuppressesDeathSyncForTest({
      deathState: input.currentDeathState,
      protectionUntil: input.currentProtectionUntil,
      nowMs: input.nowMs,
    })
  ) {
    return { kind: "none" };
  }

  if (live.alive) {
    if (localCombatDead) {
      if (HARTHMERE_DEATH_LOCKED_STATES.has(input.currentDeathState)) {
        return { kind: "pose", state: input.currentDeathState };
      }
      return {
        kind: "down",
        cause: "HP reached zero",
        killerName: "Combat",
        abilityName: "HP Zero Death Check",
        damage: Math.max(1, Math.trunc(Number(input.localMaxHp ?? 100))),
        damageType: "combat",
        detail:
          "Your HP reached zero. Respawn at The Grove or wait for a revive.",
      };
    }

    if (
      harthmereShouldClearLiveAliveDeathLockForTest({
        deathState: input.currentDeathState,
        hp: input.localHp,
        combatState: input.localCombatState,
      })
    ) {
      return {
        kind: "clear",
        detail: "Live player status recovered; clearing stale movement lock.",
      };
    }

    return { kind: "none" };
  }

  if (!live.dead) {
    return { kind: "none" };
  }

  if (HARTHMERE_DEATH_LOCKED_STATES.has(input.currentDeathState)) {
    return { kind: "pose", state: input.currentDeathState };
  }

  return liveDeathSyncDownActionForStatus({
    status: input.status,
    liveDeathState: live.deathState,
    localHp: input.localHp,
    localMaxHp: input.localMaxHp,
  });
}

const HARTHMERE_EFFECTIVE_DEATH_STATES = new Set([
  "downed",
  "dead",
  "respawning",
  "ghost",
  "captured",
  "unconscious",
]);

const HARTHMERE_EFFECTIVE_DEATH_RESPAWNS = [
  "the_grove",
  "temple_green",
  "north_gate",
  "player_house",
];

export interface HarthmereEffectiveDeathInput {
  death: HarthmereDeathState;
  combatHp?: number;
  combatMaxHp?: number;
  combatState?: string;
  liveHp?: number;
  liveDeathState?: string;
  nowMs?: number;
}

function finiteNumberOrUndefined(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function effectiveHarthmereDeathStateForRespawn({
  death,
  combatHp,
  combatMaxHp,
  combatState,
  liveHp,
  liveDeathState,
  nowMs,
}: HarthmereEffectiveDeathInput): HarthmereDeathState {
  if (HARTHMERE_DEATH_LOCKED_STATES.has(death.state)) {
    return death;
  }

  const normalizedCombatState = String(combatState ?? "")
    .trim()
    .toLowerCase();
  const normalizedLiveDeathState = String(liveDeathState ?? "")
    .trim()
    .toLowerCase();
  const localHp = finiteNumberOrUndefined(combatHp);
  const remoteHp = finiteNumberOrUndefined(liveHp);
  const localRespawnProtected =
    death.state === "protected_after_respawn" ||
    normalizedCombatState === "protected_after_respawn";
  if (localRespawnProtected && localHp !== undefined && localHp > 0) {
    // Respawn is client-immediate so the player can return to The Grove without
    // waiting on the live-mode POST. Ignore a stale remote 0/dead snapshot until
    // the next successful live status read catches up.
    return death;
  }
  const zeroHp =
    (localHp !== undefined && localHp <= 0) ||
    (remoteHp !== undefined && remoteHp <= 0);
  const deadState =
    HARTHMERE_EFFECTIVE_DEATH_STATES.has(normalizedCombatState) ||
    HARTHMERE_EFFECTIVE_DEATH_STATES.has(normalizedLiveDeathState);

  if (!zeroHp && !deadState) {
    return death;
  }

  const now = nowMs ?? Date.now();
  const effectiveState =
    normalizedCombatState === "downed" || normalizedLiveDeathState === "downed"
      ? "downed"
      : "dead";
  const maxHp = Math.max(1, Math.round(Number(combatMaxHp) || 240));
  const cause = zeroHp
    ? "HP reached zero"
    : normalizedLiveDeathState
    ? `Live player status is ${normalizedLiveDeathState}`
    : `Combat state is ${normalizedCombatState}`;
  const currentDeath =
    death.currentDeath ??
    ({
      deathId: `hm-effective-death-${now}`,
      state: effectiveState,
      zone: "Harthmere",
      position: [496, 70, -126],
      cause,
      killerType: "environment",
      killerName: "Combat",
      damageSummary: [
        {
          source: "Combat",
          ability: zeroHp ? "HP Zero Death Check" : "Death State Sync",
          damage: Math.max(0, maxHp - Math.max(0, localHp ?? remoteHp ?? 0)),
          type: "combat",
        },
      ],
      durabilityLossPercent: 0,
      xpDebt: 0,
      corpsePosition: [496, 70, -126],
      availableRespawns: HARTHMERE_EFFECTIVE_DEATH_RESPAWNS,
      createdAt: now,
    } satisfies HarthmereDeathRecord);

  return {
    ...death,
    state: effectiveState,
    currentDeath,
    downedUntil:
      effectiveState === "downed"
        ? death.downedUntil ?? now + 45_000
        : undefined,
    forcedRespawnAt: death.forcedRespawnAt ?? now + 5 * 60_000,
    protectionUntil: undefined,
  };
}

function shouldLockHarthmereDeathMovement(
  death: HarthmereDeathState,
  combat: ReturnType<typeof useHarthmereCombatState>
) {
  return harthmereDeathMovementShouldLockForTest({
    deathState: death.state,
    hp: combat.player.hp,
    combatState: combat.player.combatState,
    wakeUpActive: isHarthmereWakeUpScreenActive(),
  });
}

function dispatchHarthmerePlayerDeathPose(active: boolean, state: string) {
  if (!isBrowser()) {
    return;
  }
  if (active) {
    document.documentElement.dataset.harthmereDeathMovementLocked =
      HARTHMERE_DEATH_MOVEMENT_LOCK_VERSION;
  } else {
    delete document.documentElement.dataset.harthmereDeathMovementLocked;
  }
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_PLAYER_DEATH_POSE_EVENT, {
      detail: {
        active,
        state,
        version: HARTHMERE_DEATH_MOVEMENT_LOCK_VERSION,
      },
    })
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
      className="rounded-lg border-rose-300/35 pointer-events-none w-[21rem] border bg-black/75 p-2 text-white shadow-lg"
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-rose-200 text-sm font-semibold uppercase tracking-wide">
            Death & Respawn
          </div>
          <div className="text-xs capitalize text-white/80">
            {stateLabel(death.state)} · HP {combat.player.hp}/
            {combat.player.maxHp}
          </div>
        </div>
        <div className="rounded bg-rose-300/20 px-1.5 py-0.5 text-rose-100 text-xs font-semibold">
          {death.state === "downed"
            ? `${downedSeconds}s`
            : protection ?? "Status"}
        </div>
      </div>
      <div className="mt-1 text-xs leading-snug text-white/80">
        {death.currentDeath ? (
          <>
            <span className="text-rose-100 font-semibold">Cause:</span>{" "}
            {death.currentDeath.cause} by {death.currentDeath.killerName}.
          </>
        ) : (
          protection ?? sickness ?? "You are recovering from a recent death."
        )}
      </div>
    </div>
  );
};

export const HarthmereDeathRuntimeController: React.FunctionComponent<{}> =
  () => {
    const death = useHarthmereDeathState();
    const combat = useHarthmereCombatState();
    const liveStatus = useBiomesUIPlayerStatusState();

    const syncLivePlayerStatusToDeath = React.useCallback(
      (status: BiomesUIPlayerStatusSnapshot | undefined) => {
        const latest = readHarthmereDeathState();
        const action = harthmereLivePlayerDeathSyncActionForTest({
          status,
          currentDeathState: latest.state,
          currentProtectionUntil: latest.protectionUntil,
          localHp: combat.player.hp,
          localMaxHp: combat.player.maxHp,
          localCombatState: combat.player.combatState,
        });

        if (action.kind === "down") {
          downHarthmerePlayerFromSystem({
            cause: action.cause,
            killerName: action.killerName,
            abilityName: action.abilityName,
            damage: action.damage,
            damageType: action.damageType,
            detail: action.detail,
          });
        } else if (action.kind === "clear") {
          clearHarthmereDeathState(action.detail);
          dispatchHarthmerePlayerDeathPose(false, "alive");
        } else if (action.kind === "pose") {
          dispatchHarthmerePlayerDeathPose(true, action.state);
        }
      },
      [combat.player.combatState, combat.player.hp, combat.player.maxHp]
    );

    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }
      const onLivePlayerStatus = (event: Event) => {
        const status = (event as CustomEvent<BiomesUIPlayerStatusSnapshot>)
          .detail;
        syncLivePlayerStatusToDeath(status);
      };
      window.addEventListener(
        BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT,
        onLivePlayerStatus
      );
      return () =>
        window.removeEventListener(
          BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT,
          onLivePlayerStatus
        );
    }, [syncLivePlayerStatusToDeath]);

    useEffect(() => {
      syncLivePlayerStatusToDeath(liveStatus);
    }, [liveStatus, syncLivePlayerStatusToDeath]);

    useEffect(() => {
      const tick = () => {
        const latest = readHarthmereDeathState();
        const now = Date.now();
        const combatDead =
          Number(combat.player.hp) <= 0 ||
          ["downed", "dead"].includes(String(combat.player.combatState ?? ""));
        const suppressStaleRespawnDeath =
          harthmereActiveRespawnProtectionSuppressesDeathSyncForTest({
            deathState: latest.state,
            protectionUntil: latest.protectionUntil,
            nowMs: now,
          });
        if (
          combatDead &&
          !suppressStaleRespawnDeath &&
          !HARTHMERE_DEATH_LOCKED_STATES.has(latest.state)
        ) {
          downHarthmerePlayerFromSystem({
            cause: "HP reached zero",
            killerName: "Combat",
            abilityName: "HP Zero Death Check",
            damage: Math.max(0, Number(combat.player.hp) || 0),
            damageType: "combat",
            detail:
              "Your HP reached zero. Respawn at The Grove or wait for a revive.",
          });
          return;
        }
        if (
          latest.state === "downed" &&
          latest.downedUntil &&
          now >= latest.downedUntil
        ) {
          releaseHarthmerePlayerSpirit();
          return;
        }
        if (
          ["dead", "ghost"].includes(latest.state) &&
          latest.forcedRespawnAt &&
          now >= latest.forcedRespawnAt
        ) {
          respawnHarthmerePlayer("temple_green");
          restoreHarthmereFoodStaminaToFullForRespawn(
            "Forced respawn restored stamina."
          );
          return;
        }
        if (
          latest.state === "protected_after_respawn" &&
          latest.protectionUntil &&
          now >= latest.protectionUntil
        ) {
          endHarthmereRespawnProtection("Respawn protection timer expired.");
        }
      };
      tick();
      const interval = window.setInterval(tick, 1000);
      return () => window.clearInterval(interval);
    }, [
      combat.player.combatState,
      combat.player.hp,
      death.state,
      death.downedUntil,
      death.forcedRespawnAt,
      death.protectionUntil,
    ]);

    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }
      const locked = shouldLockHarthmereDeathMovement(death, combat);
      dispatchHarthmerePlayerDeathPose(locked, death.state);

      if (!locked) {
        delete document.documentElement.dataset.harthmereDeathMovementLocked;
        return;
      }

      try {
        document.exitPointerLock?.();
      } catch {}

      const preventMovement = (event: KeyboardEvent) => {
        if (!HARTHMERE_DEATH_MOVEMENT_KEYS.has(event.code)) {
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
        if (
          target?.closest?.("button,a,input,textarea,select,[role='button']")
        ) {
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
        dispatchHarthmerePlayerDeathPose(false, "alive");
      };
    }, [combat.player.combatState, combat.player.hp, death.state]);

    return null;
  };

export const HarthmereDeathScreenOverlay: React.FunctionComponent<{}> = () => {
  const death = useHarthmereDeathState();
  const combat = useHarthmereCombatState();
  const liveStatus = useBiomesUIPlayerStatusState();
  const live = harthmereLivePlayerDeathSyncSummaryForTest(liveStatus);
  const effectiveDeath = effectiveHarthmereDeathStateForRespawn({
    death,
    combatHp: combat.player.hp,
    combatMaxHp: combat.player.maxHp,
    combatState: combat.player.combatState,
    liveHp: live.hp,
    liveDeathState: live.deathState,
  });
  const downedSeconds = secondsRemaining(effectiveDeath.downedUntil);
  const active = harthmereDeathScreenShouldRenderForTest({
    death,
    effectiveDeath,
    wakeUpActive: isHarthmereWakeUpScreenActive(),
  });

  if (!active) {
    return <></>;
  }

  const cause = effectiveDeath.currentDeath
    ? effectiveDeath.currentDeath.cause.toLowerCase().includes("stamina")
      ? "You are gone too soon from exhaustion..."
      : `You are gone too soon. ${effectiveDeath.currentDeath.cause}.`
    : `You are gone too soon. HP ${combat.player.hp}/${combat.player.maxHp}.`;
  const consequence = effectiveDeath.currentDeath?.killerName
    ? `and were claimed by ${effectiveDeath.currentDeath.killerName}`
    : "and need to return to safety";
  const groveRespawnBlock = harthmereRespawnDisabledReason(
    effectiveDeath,
    "the_grove"
  );

  return (
    <HarthmereDeathScreenOverlayView
      cause={cause}
      consequence={consequence}
      downedSeconds={downedSeconds}
      groveRespawnBlock={groveRespawnBlock}
      onRespawn={() => respawnHarthmerePlayerAtGrove(effectiveDeath)}
    />
  );
};

export const HarthmereDeathMenuPanel: React.FunctionComponent<{}> = () => {
  const death = useHarthmereDeathState();
  const combat = useHarthmereCombatState();
  const downedSeconds = secondsRemaining(death.downedUntil);
  const protection = protectionLabel(death);
  const sickness = sicknessLabel(death);
  const damageSummary = death.currentDeath?.damageSummary ?? [];
  const interfaceRules = describeHarthmereDeathInterface(death);

  const respawnChoices = useMemo(() => Object.entries(RESPAWN_POINTS), []);

  return (
    <div className="rounded-lg border-rose-300/25 bg-black/85 pointer-events-auto mb-2 max-h-[65vh] w-[31rem] overflow-y-auto border p-3 text-white shadow-xl">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-base text-rose-200 font-bold">
            Biomes Death & Respawn
          </div>
          <div className="text-xs text-white/70">
            Downed state, revive, respawn choices, protection, death recap,
            durability loss, and fair recovery rules. Rule refs: Harthmere Town
            Design Bible §14.1 respawn pacing, MMO_RULES progression fairness,
            and Wilds readable danger escalation.
          </div>
        </div>
        <div className="rounded bg-white/10 px-2 py-1 text-xs capitalize text-white/80">
          {stateLabel(death.state)}
        </div>
      </div>

      <div className="rounded mb-2 grid grid-cols-2 gap-2 border border-white/10 bg-white/5 p-2 text-xs">
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
          <div className="text-white/70">{interfaceRules.penaltySummary}</div>
        </div>
      </div>

      {death.currentDeath ? (
        <div className="rounded border-rose-300/20 bg-rose-950/20 mb-2 border p-2 text-xs">
          <div className="text-rose-100 font-semibold">Death Recap</div>
          <div className="text-white/75">
            {death.currentDeath.cause} · {death.currentDeath.killerName} ·{" "}
            {new Date(death.currentDeath.createdAt).toLocaleTimeString()}
          </div>
          <div className="mt-1 text-white/70">
            {death.currentDeath.killerType} · {death.currentDeath.zone} · mode{" "}
            {interfaceRules.mode.replaceAll("_", " ")}
          </div>
          <div className="mt-1 text-white/75">
            Durability loss: {death.currentDeath.durabilityLossPercent}% · XP
            debt: {death.currentDeath.xpDebt}
          </div>
          {death.currentDeath.inventoryDropPolicy && (
            <div className="mt-1 text-white/70">
              Drop policy:{" "}
              {death.currentDeath.inventoryDropPolicy.replaceAll("_", " ")}
            </div>
          )}
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
          disabled={Boolean(interfaceRules.reviveDisabledReason)}
          onClick={() => {
            reviveHarthmerePlayer("Field Revive");
            restoreHarthmereFoodStaminaToFullForRespawn(
              "Field revive restored stamina."
            );
          }}
          title={interfaceRules.reviveDisabledReason}
        >
          Revive Here
        </button>
        <button
          className="rounded bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={Boolean(interfaceRules.releaseDisabledReason)}
          onClick={() => releaseHarthmerePlayerSpirit()}
          title={interfaceRules.releaseDisabledReason}
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
        {respawnChoices.map(([id, point]) => {
          const respawnBlock = harthmereRespawnDisabledReason(death, id);
          return (
            <div
              key={id}
              className="rounded flex items-start justify-between gap-2 border border-white/10 bg-white/5 p-2 text-xs"
            >
              <div>
                <div className="font-semibold text-white">{point.label}</div>
                <div className="text-white/65">{point.description}</div>
                <div className="text-white/55">
                  Returns at full HP · sickness {point.sicknessSeconds}s
                </div>
                {respawnBlock && (
                  <div className="text-rose-100 mt-1">{respawnBlock}</div>
                )}
              </div>
              <button
                className="rounded bg-rose-300 hover:bg-rose-200 shrink-0 px-2 py-1 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
                disabled={Boolean(respawnBlock)}
                onClick={() =>
                  id === "the_grove"
                    ? respawnHarthmerePlayerAtGrove()
                    : (() => {
                        respawnHarthmerePlayer(id);
                        restoreHarthmereFoodStaminaToFullForRespawn(
                          `Respawned at ${point.label} with a full stamina bar.`
                        );
                      })()
                }
                title={respawnBlock}
              >
                Respawn
              </button>
            </div>
          );
        })}
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
