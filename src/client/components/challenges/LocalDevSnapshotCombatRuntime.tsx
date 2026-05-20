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
  SNAPSHOT_COMBAT_PRIMER_STEPS_V74,
  SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS_V74,
  SNAPSHOT_HARTHMERE_MUCK_ZONES_V74,
  SNAPSHOT_PORT_COVERAGE_V74,
  SNAPSHOT_RUNTIME_RULES_VERSION_V74,
  combatStepWorldPositionV74,
} from "@/shared/harthmere/snapshot_runtime_rules_v74";
import React, { useEffect, useMemo, useState } from "react";

export const SNAPSHOT_COMBAT_RUNTIME_VERSION_V74 =
  "snapshot-combat-muck-runtime-v74";

const SNAPSHOT_COMBAT_STATE_KEY_V74 =
  "biomes.localDev.snapshotCombatState.v74";
const SNAPSHOT_COMBAT_STATE_EVENT_V74 =
  "biomes:local-dev-snapshot-combat-state-v74";
const SNAPSHOT_COMBAT_NAV_AID_ID_V74 = 710_174;
const SNAPSHOT_COMBAT_XP_ID_V74 = "snapshot-combat-primer-v74";

interface SnapshotCombatStateV74 {
  accepted: boolean;
  currentStepIndex: number;
  completedStepIds: string[];
  completed: boolean;
  rewards: string[];
  kills: Record<string, number>;
  lastEvent?: string;
  updatedAt?: number;
}

const EMPTY_COMBAT_STATE_V74: SnapshotCombatStateV74 = {
  accepted: true,
  currentStepIndex: 0,
  completedStepIds: [],
  completed: false,
  rewards: [],
  kills: {},
};

type HarthmereCombatEffectDetailV74 = {
  target?: string;
  targetOffset?: number;
  finalDamage?: number;
  targetHpBefore?: number;
  targetHpAfter?: number;
  result?: string;
  detail?: string;
};

function isBrowserV74() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeCombatStateV74(
  state: Partial<SnapshotCombatStateV74> | undefined,
): SnapshotCombatStateV74 {
  if (!state) {
    return { ...EMPTY_COMBAT_STATE_V74 };
  }
  return {
    accepted: state.accepted !== false,
    currentStepIndex: Math.max(
      0,
      Math.min(
        SNAPSHOT_COMBAT_PRIMER_STEPS_V74.length - 1,
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

export function readSnapshotCombatStateV74(): SnapshotCombatStateV74 {
  if (!isBrowserV74()) {
    return { ...EMPTY_COMBAT_STATE_V74 };
  }
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_COMBAT_STATE_KEY_V74);
    return normalizeCombatStateV74(raw ? JSON.parse(raw) : undefined);
  } catch {
    return { ...EMPTY_COMBAT_STATE_V74 };
  }
}

function writeSnapshotCombatStateV74(state: SnapshotCombatStateV74) {
  if (!isBrowserV74()) {
    return;
  }
  const next = normalizeCombatStateV74({ ...state, updatedAt: Date.now() });
  window.localStorage.setItem(SNAPSHOT_COMBAT_STATE_KEY_V74, JSON.stringify(next));
  window.dispatchEvent(new Event(SNAPSHOT_COMBAT_STATE_EVENT_V74));
}

function currentCombatStepV74(state: SnapshotCombatStateV74) {
  return SNAPSHOT_COMBAT_PRIMER_STEPS_V74[
    Math.max(0, Math.min(state.currentStepIndex, SNAPSHOT_COMBAT_PRIMER_STEPS_V74.length - 1))
  ];
}

function markRewardV74(state: SnapshotCombatStateV74, reward: string) {
  return [...new Set([...state.rewards, reward])];
}

function advanceCombatStepV74(reason: string) {
  const state = readSnapshotCombatStateV74();
  if (state.completed) {
    return;
  }
  const step = currentCombatStepV74(state);
  if (!step || state.completedStepIds.includes(step.id)) {
    return;
  }
  const nextCompleted = [...new Set([...state.completedStepIds, step.id])];
  const atEnd = state.currentStepIndex >= SNAPSHOT_COMBAT_PRIMER_STEPS_V74.length - 1;
  awardHarthmereQuestXp(SNAPSHOT_COMBAT_XP_ID_V74, "Wilds Combat Primer", atEnd);
  writeSnapshotCombatStateV74({
    ...state,
    currentStepIndex: atEnd ? state.currentStepIndex : state.currentStepIndex + 1,
    completedStepIds: nextCompleted,
    completed: atEnd,
    rewards: markRewardV74(state, step.reward),
    lastEvent: `${step.title}: ${reason}`,
  });
}

function distance2D(a: ReadonlyVec3, b: ReadonlyVec3) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function pinSnapshotCombatTargetV74(
  mapManager: {
    addNavigationAid: (aid: any, id?: number) => number;
    removeNavigationAid?: (id: number) => void;
  },
  targetPos: ReadonlyVec3,
) {
  mapManager.removeNavigationAid?.(SNAPSHOT_COMBAT_NAV_AID_ID_V74);
  return mapManager.addNavigationAid(
    {
      kind: "placed",
      autoremoveWhenNear: false,
      target: {
        kind: "position",
        position: [...targetPos],
      },
    },
    SNAPSHOT_COMBAT_NAV_AID_ID_V74,
  );
}

function isSnapshotHostileCombatOffsetV74(offset: number | undefined) {
  if (offset === undefined) {
    return false;
  }
  return SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS_V74.some((spawn) => spawn.idOffset === offset);
}

function isSnapshotHostileNameV74(name: string | undefined) {
  if (!name) {
    return false;
  }
  const lower = name.toLowerCase();
  return lower.includes("muckling") || lower.includes("mucker");
}

export const SnapshotCombatRuntimeControllerV74: React.FunctionComponent<{}> = () => {
  const { gardenHose, mapManager, reactResources, resources, userId } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player");
  const inventory = reactResources.use("/ecs/c/inventory", userId);
  const [state, setState] = useState<SnapshotCombatStateV74>(() => readSnapshotCombatStateV74());

  useEffect(() => {
    const refresh = () => setState(readSnapshotCombatStateV74());
    window.addEventListener("storage", refresh);
    window.addEventListener(SNAPSHOT_COMBAT_STATE_EVENT_V74, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SNAPSHOT_COMBAT_STATE_EVENT_V74, refresh);
    };
  }, []);

  useEffect(() => {
    if (!isBrowserV74()) {
      return;
    }
    const win = window as typeof window & {
      __snapshotPortV74?: Record<string, unknown>;
    };
    win.__snapshotPortV74 = {
      version: SNAPSHOT_RUNTIME_RULES_VERSION_V74,
      coverage: SNAPSHOT_PORT_COVERAGE_V74,
      readCombatState: readSnapshotCombatStateV74,
      resetCombatState: () => writeSnapshotCombatStateV74({ ...EMPTY_COMBAT_STATE_V74 }),
      completeCombatStep: (reason = "manual developer completion") => advanceCombatStepV74(reason),
      hostiles: SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS_V74,
      muckZones: SNAPSHOT_HARTHMERE_MUCK_ZONES_V74,
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<HarthmereCombatEffectDetailV74>).detail;
      const current = readSnapshotCombatStateV74();
      if (current.completed) {
        return;
      }
      const step = currentCombatStepV74(current);
      const isSnapshotHostile =
        isSnapshotHostileCombatOffsetV74(detail?.targetOffset) ||
        isSnapshotHostileNameV74(detail?.target);
      if (!isSnapshotHostile) {
        return;
      }
      if (step.trigger === "damage_hostile" && (detail?.finalDamage ?? 0) > 0) {
        advanceCombatStepV74(`hit ${detail.target ?? "hostile"}`);
      }
      if (
        step.trigger === "defeat_hostile" &&
        ((detail?.result === "dead" || (detail?.targetHpAfter ?? 1) <= 0) &&
          (detail?.targetHpBefore ?? 0) >= 0)
      ) {
        advanceCombatStepV74(`defeated ${detail.target ?? "hostile"}`);
      }
    };
    window.addEventListener(HARTHMERE_COMBAT_EFFECT_EVENT, handler);
    return () => window.removeEventListener(HARTHMERE_COMBAT_EFFECT_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = (event: GardenHoseEvent) => {
      const current = readSnapshotCombatStateV74();
      if (current.completed) {
        return;
      }
      const step = currentCombatStepV74(current);
      if (step.trigger === "destroy_muck" && event.kind === "destroy" && event.terrainId && !isFloraId(event.terrainId)) {
        advanceCombatStepV74("cleared muck or loose terrain");
      }
    };
    gardenHose.on("anyEvent", handler);
    return () => gardenHose.off("anyEvent", handler);
  }, [gardenHose]);

  useEffect(() => {
    const current = readSnapshotCombatStateV74();
    if (current.completed) {
      return;
    }
    const step = currentCombatStepV74(current);
    if (step.trigger !== "location") {
      return;
    }
    const playerPos = localPlayer.player.position as Vec3;
    const targetPos = combatStepWorldPositionV74(step);
    if (distance2D(playerPos, targetPos) <= (step.radius ?? 10)) {
      advanceCombatStepV74("entered the marked danger area");
    }
  }, [localPlayer.player.position, state.currentStepIndex, state.completed]);

  useEffect(() => {
    const current = readSnapshotCombatStateV74();
    if (current.completed) {
      return;
    }
    const step = currentCombatStepV74(current);
    if (step.trigger !== "craft_muck_buster") {
      return;
    }
    const ownedItems = getOwnedItems(resources, userId);
    const hasMuckBuster =
      matchingItemRefs(ownedItems, (entry) => Boolean(entry?.item.unmuck)).length > 0;
    if (hasMuckBuster) {
      advanceCombatStepV74("muck-clearing tool ready");
    }
  }, [inventory, resources, state.currentStepIndex, state.completed, userId]);

  useEffect(() => {
    const current = readSnapshotCombatStateV74();
    if (current.completed) {
      return;
    }
    const step = currentCombatStepV74(current);
    if (step.trigger !== "defeat_hostile") {
      return;
    }
    // Real snapshot-style NPCs are server entities. Poll their health so a native
    // UpdateNpcHealthEvent kill advances the same reusable combat primer even if
    // it did not pass through the local Harthmere visual-combat event bridge.
    const interval = window.setInterval(() => {
      for (const spawn of SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS_V74) {
        const entityId = (8_810_000_000_010_000 + spawn.idOffset) as BiomesId;
        const health = reactResources.get("/ecs/c/health", entityId);
        if (health && health.hp <= 0) {
          advanceCombatStepV74(`defeated ${spawn.displayName}`);
          return;
        }
      }
    }, 750);
    return () => window.clearInterval(interval);
  }, [reactResources, state.currentStepIndex, state.completed]);

  useEffect(() => {
    const step = currentCombatStepV74(state);
    if (!step || state.completed) {
      return;
    }
    pinSnapshotCombatTargetV74(mapManager, combatStepWorldPositionV74(step));
  }, [mapManager, state.currentStepIndex, state.completed]);

  return null;
};

function useSnapshotCombatStateV74() {
  const [state, setState] = useState<SnapshotCombatStateV74>(() => readSnapshotCombatStateV74());
  useEffect(() => {
    const refresh = () => setState(readSnapshotCombatStateV74());
    const interval = window.setInterval(refresh, 500);
    window.addEventListener("storage", refresh);
    window.addEventListener(SNAPSHOT_COMBAT_STATE_EVENT_V74, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(SNAPSHOT_COMBAT_STATE_EVENT_V74, refresh);
    };
  }, []);
  return state;
}

function compassDirectionV74(dx: number, dz: number) {
  const absX = Math.abs(dx);
  const absZ = Math.abs(dz);
  if (absX < 4 && absZ < 4) return "here";
  const eastWest = dx > 0 ? "east" : "west";
  const northSouth = dz > 0 ? "south" : "north";
  if (absX > absZ * 1.7) return eastWest;
  if (absZ > absX * 1.7) return northSouth;
  return `${northSouth}-${eastWest}`;
}

export const SnapshotCombatMapHUDV74: React.FunctionComponent<{}> = () => {
  const { reactResources, mapManager } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player");
  const state = useSnapshotCombatStateV74();
  const step = currentCombatStepV74(state);
  const targetPos = combatStepWorldPositionV74(step);
  const playerPos = localPlayer.player.position as Vec3;
  const dx = targetPos[0] - playerPos[0];
  const dz = targetPos[2] - playerPos[2];
  const distance = Math.round(Math.hypot(dx, dz));
  const direction = compassDirectionV74(dx, dz);

  return (
    <div className="rounded-xl border border-red-200/20 bg-red-950/35 p-2 text-white shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-bold uppercase tracking-wide text-red-100">
            Wilds Combat Primer
          </div>
          <div className="text-xs text-white/70">
            Snapshot Combat · {state.completed ? "Completed" : `Step ${state.currentStepIndex + 1}/${SNAPSHOT_COMBAT_PRIMER_STEPS_V74.length}`}
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
        onClick={() => pinSnapshotCombatTargetV74(mapManager, targetPos)}
      >
        Mark combat objective
      </button>
    </div>
  );
};

export const SnapshotCombatJournalPanelV74: React.FunctionComponent<{}> = () => {
  const state = useSnapshotCombatStateV74();
  const step = currentCombatStepV74(state);
  const hostileNames = useMemo(
    () => SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS_V74.map((spawn) => spawn.displayName).join(", "),
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
          {state.completed ? "Completed" : `In Progress · ${state.currentStepIndex + 1}/${SNAPSHOT_COMBAT_PRIMER_STEPS_V74.length}`}
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
