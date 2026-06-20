import { getOwnedItems } from "@/client/components/inventory/helpers";
import { awardHarthmereQuestXp } from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import { HARTHMERE_COMBAT_EFFECT_EVENT } from "@/client/components/challenges/LocalDevHarthmereCombat";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { GardenHoseEvent } from "@/client/events/api";
import { isFloraId } from "@/shared/game/ids";
import { matchingItemRefs } from "@/shared/game/inventory";
import type { BiomesId } from "@/shared/ids";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_COMBAT_PRIMER_STEPS,
  SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS,
  SNAPSHOT_HARTHMERE_MUCK_ZONES,
  SNAPSHOT_PORT_COVERAGE,
  SNAPSHOT_RUNTIME_RULES_VERSION,
  combatStepWorldPosition,
} from "@/shared/harthmere/snapshot_runtime_rules";
import React, { useEffect, useMemo, useState } from "react";

export const SNAPSHOT_COMBAT_RUNTIME_VERSION =
  "snapshot-combat-muck-runtime";

const SNAPSHOT_COMBAT_STATE_KEY =
  "biomes.localDev.snapshotCombatState";
const SNAPSHOT_COMBAT_STATE_EVENT =
  "biomes:local-dev-snapshot-combat-state";
const SNAPSHOT_COMBAT_NAV_AID_ID = 710_174;
const SNAPSHOT_COMBAT_XP_ID = "snapshot-combat-primer";

interface SnapshotCombatState {
  accepted: boolean;
  currentStepIndex: number;
  completedStepIds: string[];
  completed: boolean;
  rewards: string[];
  kills: Record<string, number>;
  lastEvent?: string;
  updatedAt?: number;
}

const EMPTY_COMBAT_STATE: SnapshotCombatState = {
  accepted: true,
  currentStepIndex: 0,
  completedStepIds: [],
  completed: false,
  rewards: [],
  kills: {},
};

type HarthmereCombatEffectDetail = {
  target?: string;
  targetOffset?: number;
  finalDamage?: number;
  targetHpBefore?: number;
  targetHpAfter?: number;
  result?: string;
  detail?: string;
};

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeCombatState(
  state: Partial<SnapshotCombatState> | undefined,
): SnapshotCombatState {
  if (!state) {
    return { ...EMPTY_COMBAT_STATE };
  }
  return {
    accepted: state.accepted !== false,
    currentStepIndex: Math.max(
      0,
      Math.min(
        SNAPSHOT_COMBAT_PRIMER_STEPS.length - 1,
        Number.isFinite(state.currentStepIndex) ? Number(state.currentStepIndex) : 0,
      ),
    ),
    completedStepIds: Array.isArray(state.completedStepIds) ? state.completedStepIds : [],
    completed: Boolean(state.completed),
    rewards: Array.isArray(state.rewards) ? state.rewards : [],
    kills: state.kills ?? {},
    lastEvent: state.lastEvent,
    updatedAt: state.updatedAt,
  };
}

export function readSnapshotCombatState(): SnapshotCombatState {
  if (!isBrowser()) {
    return { ...EMPTY_COMBAT_STATE };
  }
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_COMBAT_STATE_KEY);
    return normalizeCombatState(raw ? JSON.parse(raw) : undefined);
  } catch {
    return { ...EMPTY_COMBAT_STATE };
  }
}

function writeSnapshotCombatState(state: SnapshotCombatState) {
  if (!isBrowser()) {
    return;
  }
  const next = normalizeCombatState({ ...state, updatedAt: Date.now() });
  window.localStorage.setItem(SNAPSHOT_COMBAT_STATE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(SNAPSHOT_COMBAT_STATE_EVENT));
}

function currentCombatStep(state: SnapshotCombatState) {
  return SNAPSHOT_COMBAT_PRIMER_STEPS[
    Math.max(0, Math.min(state.currentStepIndex, SNAPSHOT_COMBAT_PRIMER_STEPS.length - 1))
  ];
}

function markReward(state: SnapshotCombatState, reward: string) {
  return [...new Set([...state.rewards, reward])];
}

function advanceCombatStep(reason: string) {
  const state = readSnapshotCombatState();
  if (state.completed) {
    return;
  }
  const step = currentCombatStep(state);
  if (!step || state.completedStepIds.includes(step.id)) {
    return;
  }
  const nextCompleted = [...new Set([...state.completedStepIds, step.id])];
  const atEnd = state.currentStepIndex >= SNAPSHOT_COMBAT_PRIMER_STEPS.length - 1;
  awardHarthmereQuestXp(SNAPSHOT_COMBAT_XP_ID, "Wilds Combat Primer", atEnd);
  writeSnapshotCombatState({
    ...state,
    currentStepIndex: atEnd ? state.currentStepIndex : state.currentStepIndex + 1,
    completedStepIds: nextCompleted,
    completed: atEnd,
    rewards: markReward(state, step.reward),
    lastEvent: `${step.title}: ${reason}`,
  });
}

function distance2D(a: ReadonlyVec3, b: ReadonlyVec3) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function pinSnapshotCombatTarget(
  mapManager: {
    addNavigationAid: (aid: any, id?: number) => number;
    removeNavigationAid?: (id: number) => void;
  },
  targetPos: ReadonlyVec3,
) {
  mapManager.removeNavigationAid?.(SNAPSHOT_COMBAT_NAV_AID_ID);
  return mapManager.addNavigationAid(
    {
      kind: "placed",
      autoremoveWhenNear: false,
      target: {
        kind: "position",
        position: [...targetPos],
      },
    },
    SNAPSHOT_COMBAT_NAV_AID_ID,
  );
}

function isSnapshotHostileCombatOffset(offset: number | undefined) {
  if (offset === undefined) {
    return false;
  }
  return SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS.some((spawn) => spawn.idOffset === offset);
}

function isSnapshotHostileName(name: string | undefined) {
  if (!name) {
    return false;
  }
  const lower = name.toLowerCase();
  return lower.includes("muckling") || lower.includes("mucker");
}

export const SnapshotCombatRuntimeController: React.FunctionComponent<{}> = () => {
  const { gardenHose, mapManager, reactResources, resources, userId } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player");
  const inventory = reactResources.use("/ecs/c/inventory", userId);
  const [state, setState] = useState<SnapshotCombatState>(() => readSnapshotCombatState());

  useEffect(() => {
    const refresh = () => setState(readSnapshotCombatState());
    window.addEventListener("storage", refresh);
    window.addEventListener(SNAPSHOT_COMBAT_STATE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SNAPSHOT_COMBAT_STATE_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    if (!isBrowser()) {
      return;
    }
    const win = window as typeof window & {
      __snapshotPort?: Record<string, unknown>;
    };
    win.__snapshotPort = {
      version: SNAPSHOT_RUNTIME_RULES_VERSION,
      coverage: SNAPSHOT_PORT_COVERAGE,
      readCombatState: readSnapshotCombatState,
      resetCombatState: () => writeSnapshotCombatState({ ...EMPTY_COMBAT_STATE }),
      completeCombatStep: (reason = "manual developer completion") => advanceCombatStep(reason),
      hostiles: SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS,
      muckZones: SNAPSHOT_HARTHMERE_MUCK_ZONES,
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<HarthmereCombatEffectDetail>).detail;
      const current = readSnapshotCombatState();
      if (current.completed) {
        return;
      }
      const step = currentCombatStep(current);
      const isSnapshotHostile =
        isSnapshotHostileCombatOffset(detail?.targetOffset) ||
        isSnapshotHostileName(detail?.target);
      if (!isSnapshotHostile) {
        return;
      }
      if (step.trigger === "damage_hostile" && (detail?.finalDamage ?? 0) > 0) {
        advanceCombatStep(`hit ${detail.target ?? "hostile"}`);
      }
      if (
        step.trigger === "defeat_hostile" &&
        ((detail?.result === "dead" || (detail?.targetHpAfter ?? 1) <= 0) &&
          (detail?.targetHpBefore ?? 0) >= 0)
      ) {
        advanceCombatStep(`defeated ${detail.target ?? "hostile"}`);
      }
    };
    window.addEventListener(HARTHMERE_COMBAT_EFFECT_EVENT, handler);
    return () => window.removeEventListener(HARTHMERE_COMBAT_EFFECT_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = (event: GardenHoseEvent) => {
      const current = readSnapshotCombatState();
      if (current.completed) {
        return;
      }
      const step = currentCombatStep(current);
      if (step.trigger === "destroy_muck" && event.kind === "destroy" && event.terrainId && !isFloraId(event.terrainId)) {
        advanceCombatStep("cleared muck or loose terrain");
      }
    };
    gardenHose.on("anyEvent", handler);
    return () => gardenHose.off("anyEvent", handler);
  }, [gardenHose]);

  useEffect(() => {
    const current = readSnapshotCombatState();
    if (current.completed) {
      return;
    }
    const step = currentCombatStep(current);
    if (step.trigger !== "location") {
      return;
    }
    const playerPos = localPlayer.player.position as Vec3;
    const targetPos = combatStepWorldPosition(step);
    if (distance2D(playerPos, targetPos) <= (step.radius ?? 10)) {
      advanceCombatStep("entered the marked danger area");
    }
  }, [localPlayer.player.position, state.currentStepIndex, state.completed]);

  useEffect(() => {
    const current = readSnapshotCombatState();
    if (current.completed) {
      return;
    }
    const step = currentCombatStep(current);
    if (step.trigger !== "craft_muck_buster") {
      return;
    }
    const ownedItems = getOwnedItems(resources, userId);
    const hasMuckBuster =
      matchingItemRefs(ownedItems, (entry) => Boolean(entry?.item.unmuck)).length > 0;
    if (hasMuckBuster) {
      advanceCombatStep("muck-clearing tool ready");
    }
  }, [inventory, resources, state.currentStepIndex, state.completed, userId]);

  useEffect(() => {
    const current = readSnapshotCombatState();
    if (current.completed) {
      return;
    }
    const step = currentCombatStep(current);
    if (step.trigger !== "defeat_hostile") {
      return;
    }
    // Real snapshot-style NPCs are server entities. Poll their health so a native
    // UpdateNpcHealthEvent kill advances the same reusable combat primer even if
    // it did not pass through the local Harthmere visual-combat event bridge.
    const interval = window.setInterval(() => {
      for (const spawn of SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS) {
        const entityId = (8_810_000_000_010_000 + spawn.idOffset) as BiomesId;
        const health = reactResources.get("/ecs/c/health", entityId);
        if (health && health.hp <= 0) {
          advanceCombatStep(`defeated ${spawn.displayName}`);
          return;
        }
      }
    }, 750);
    return () => window.clearInterval(interval);
  }, [reactResources, state.currentStepIndex, state.completed]);

  useEffect(() => {
    const step = currentCombatStep(state);
    if (!step || state.completed) {
      return;
    }
    pinSnapshotCombatTarget(mapManager, combatStepWorldPosition(step));
  }, [mapManager, state.currentStepIndex, state.completed]);

  return null;
};

function useSnapshotCombatState() {
  const [state, setState] = useState<SnapshotCombatState>(() => readSnapshotCombatState());
  useEffect(() => {
    const refresh = () => setState(readSnapshotCombatState());
    const interval = window.setInterval(refresh, 500);
    window.addEventListener("storage", refresh);
    window.addEventListener(SNAPSHOT_COMBAT_STATE_EVENT, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SNAPSHOT_COMBAT_STATE_EVENT, refresh);
    };
  }, []);
  return state;
}

function compassDirection(dx: number, dz: number) {
  const absX = Math.abs(dx);
  const absZ = Math.abs(dz);
  if (absX < 4 && absZ < 4) return "here";
  const eastWest = dx > 0 ? "east" : "west";
  const northSouth = dz > 0 ? "south" : "north";
  if (absX > absZ * 1.7) return eastWest;
  if (absZ > absX * 1.7) return northSouth;
  return `${northSouth}-${eastWest}`;
}

export const SnapshotCombatMapHUD: React.FunctionComponent<{}> = () => {
  const { reactResources, mapManager } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player");
  const state = useSnapshotCombatState();
  const step = currentCombatStep(state);
  const targetPos = combatStepWorldPosition(step);
  const playerPos = localPlayer.player.position as Vec3;
  const dx = targetPos[0] - playerPos[0];
  const dz = targetPos[2] - playerPos[2];
  const distance = Math.round(Math.hypot(dx, dz));
  const direction = compassDirection(dx, dz);

  return (
    <div className="rounded-xl border border-red-200/20 bg-red-950/35 p-2 text-white shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold uppercase tracking-wide text-red-100">
            Wilds Combat Primer
          </div>
          <div className="text-xs text-white/70">
            Snapshot Combat · {state.completed ? "Completed" : `Step ${state.currentStepIndex + 1}/${SNAPSHOT_COMBAT_PRIMER_STEPS.length}`}
          </div>
        </div>
        {!state.completed && (
          <div className="rounded bg-red-300/20 px-1.5 py-0.5 text-xs font-semibold text-red-100">
            {distance}m {direction}
          </div>
        )}
      </div>
      <div className="mt-1 text-xs leading-snug text-white/85">
        <span className="font-semibold text-red-100">
          {state.completed ? "Done:" : `${step.title}:`}
        </span>{" "}
        {state.completed ? "You can fight, survive, clear muck, and carry the right tool." : step.objective}
      </div>
      {!state.completed && (
        <div className="mt-1 text-[11px] leading-snug text-white/65">
          {step.mapHint}
        </div>
      )}
      <button
        className="mt-2 rounded bg-red-300/20 px-2 py-1 text-[11px] font-semibold text-red-100 hover:bg-red-300/30"
        onClick={() => pinSnapshotCombatTarget(mapManager, targetPos)}
      >
        Mark combat objective
      </button>
    </div>
  );
};

export const SnapshotCombatJournalPanel: React.FunctionComponent<{}> = () => {
  const state = useSnapshotCombatState();
  const step = currentCombatStep(state);
  const hostileNames = useMemo(
    () => SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS.map((spawn) => spawn.displayName).join(", "),
    [],
  );

  return (
    <div className="rounded border border-red-200/20 bg-red-950/30 p-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">Wilds Combat Primer</div>
          <div className="text-[10px] uppercase tracking-wide text-red-100/80">
            Snapshot Combat · Reusable Runtime
          </div>
        </div>
        <div className="text-xs font-semibold text-red-100">
          {state.completed ? "Completed" : `In Progress · ${state.currentStepIndex + 1}/${SNAPSHOT_COMBAT_PRIMER_STEPS.length}`}
        </div>
      </div>
      <div className="mt-1 text-xs leading-snug text-white/85">
        {state.completed ? "The first combat and muck-clearing pass is complete." : step.objective}
      </div>
      {!state.completed && (
        <>
          <div className="mt-1 text-[11px] leading-snug text-white/60">
            <span className="font-semibold text-white/75">Target:</span> {step.targetLabel}
          </div>
          <div className="mt-1 text-[11px] leading-snug text-white/60">
            <span className="font-semibold text-white/75">Reward:</span> {step.reward}
          </div>
        </>
      )}
      <div className="mt-2 rounded bg-black/20 p-1.5 text-[11px] leading-snug text-white/65">
        <div className="font-semibold text-red-100">Seeded hostiles</div>
        {hostileNames}
      </div>
      {state.lastEvent && (
        <div className="mt-2 text-[10px] leading-snug text-white/50">
          Latest: {state.lastEvent}
        </div>
      )}
    </div>
  );
};
