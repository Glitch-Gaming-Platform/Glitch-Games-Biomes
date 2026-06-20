import { isDayTime, sunInclination } from "@/shared/game/sun_moon_position";
import {
  chooseHarthmereCombatAIDecision,
  type HarthmereCombatAIArchetypeId,
} from "./third_party_combat_ai";
import { isLiveEntityHelperPositionInMuckBreachArea } from "./live_entity_helper_quests";
import {
  SNAPSHOT_DANGER_AREAS,
  SNAPSHOT_HARTHMERE_MUCK_ZONES,
  authoredSnapshotAreaForPoint,
} from "./snapshot_runtime_rules";

export const MUCK_MONSTER_AGGRESSION_AI_VERSION =
  "muck-monster-aggression-ai" as const;
export const MUCK_MONSTER_UNPROVOKED_AGGRO_RADIUS = 10.5;
export const MUCK_MONSTER_UNPROVOKED_WARNING_RADIUS = 16;
export const MUCK_MONSTER_UNPROVOKED_LEASH_RADIUS = 34;

export interface MuckMonsterAggressionInput {
  monsterId: string;
  monsterName: string;
  monsterPosition?: readonly number[];
  playerId?: string;
  playerPosition?: readonly number[];
  nowMs?: number;
  monsterHpPercent?: number;
  safeZone?: boolean;
  spawnProtected?: boolean;
  lineOfSight?: boolean;
  muckExposureForcesAggression?: boolean;
  alliesNearby?: number;
  enemiesNearby?: number;
  aggroRadius?: number;
  warningRadius?: number;
  leashRadius?: number;
}

export interface MuckMonsterAggressionDecision {
  version: typeof MUCK_MONSTER_AGGRESSION_AI_VERSION;
  aggressive: boolean;
  reason: string;
  monsterId: string;
  monsterName: string;
  territoryId?: string;
  territoryLabel?: string;
  distanceToPlayer?: number;
  warning: boolean;
  archetypeId?: HarthmereCombatAIArchetypeId;
  decision?: ReturnType<typeof chooseHarthmereCombatAIDecision>;
}

function asVec3(value: readonly number[] | undefined) {
  if (!Array.isArray(value) || value.length < 3) {
    return undefined;
  }
  const x = Number(value[0]);
  const y = Number(value[1]);
  const z = Number(value[2]);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? ([x, y, z] as const)
    : undefined;
}

function distance2d(left: readonly number[], right: readonly number[]) {
  return Math.hypot(
    Number(left[0]) - Number(right[0]),
    Number(left[2]) - Number(right[2])
  );
}

export function isNightForMuckMonsterAggression(nowMs: number | undefined) {
  return !isDayTime(sunInclination((nowMs ?? 0) / 1000));
}

export function isMuckMonsterName(name: string | undefined) {
  const text = String(name ?? "").toLowerCase();
  if (
    /robot|bot|sentinel|sentential|sentiental|shield|beacon|board|voucher|ration|matter/.test(
      text
    )
  ) {
    return false;
  }
  return /muck[-\s]scarred|muckling|mucker|muckwad|muck\b|helix|hex|hexer|pale\s+muck/.test(
    text
  );
}

export function muckMonsterCombatArchetype(
  monsterName: string | undefined
): HarthmereCombatAIArchetypeId {
  const text = String(monsterName ?? "").toLowerCase();
  if (/helix|scarred|boss|greater|ancient/.test(text)) {
    return "boss_phase_controller";
  }
  return "pack_wolf";
}

export function muckMonsterAreaForPosition(
  position: readonly number[] | undefined,
  pad = 0
) {
  const pos = asVec3(position);
  if (!pos) {
    return undefined;
  }
  const muck =
    authoredSnapshotAreaForPoint(
      pos,
      SNAPSHOT_HARTHMERE_MUCK_ZONES,
      pad
    ) ?? authoredSnapshotAreaForPoint(pos, SNAPSHOT_DANGER_AREAS, pad);
  if (muck) {
    return {
      id: muck.id,
      label: muck.label,
      type: muck.type,
    };
  }
  if (isLiveEntityHelperPositionInMuckBreachArea(pos)) {
    return {
      id: "west_muck_breach",
      label: "West Muck Breach",
      type: "muck",
    };
  }
  return undefined;
}

export function evaluateMuckMonsterAggression(
  input: MuckMonsterAggressionInput
): MuckMonsterAggressionDecision {
  const monsterPosition = asVec3(input.monsterPosition);
  const playerPosition = asVec3(input.playerPosition);
  const aggroRadius =
    input.aggroRadius ?? MUCK_MONSTER_UNPROVOKED_AGGRO_RADIUS;
  const warningRadius =
    input.warningRadius ?? MUCK_MONSTER_UNPROVOKED_WARNING_RADIUS;
  const leashRadius =
    input.leashRadius ?? MUCK_MONSTER_UNPROVOKED_LEASH_RADIUS;
  const base: MuckMonsterAggressionDecision = {
    version: MUCK_MONSTER_AGGRESSION_AI_VERSION,
    aggressive: false,
    reason: "not_evaluated",
    monsterId: input.monsterId,
    monsterName: input.monsterName,
    warning: false,
  };

  if (!isMuckMonsterName(input.monsterName)) {
    return { ...base, reason: "not_muck_monster" };
  }
  if (!monsterPosition || !playerPosition) {
    return { ...base, reason: "missing_positions" };
  }

  const territory = muckMonsterAreaForPosition(monsterPosition, 1.5);
  if (!territory) {
    return { ...base, reason: "monster_outside_muck_territory" };
  }
  const distanceToPlayer = distance2d(monsterPosition, playerPosition);
  if (!Number.isFinite(distanceToPlayer)) {
    return {
      ...base,
      reason: "invalid_distance",
      territoryId: territory.id,
      territoryLabel: territory.label,
    };
  }
  if (input.safeZone) {
    return {
      ...base,
      reason: "protected_area_blocks_muck_aggression",
      territoryId: territory.id,
      territoryLabel: territory.label,
      distanceToPlayer,
    };
  }
  if (input.spawnProtected) {
    return {
      ...base,
      reason: "spawn_protection_blocks_muck_aggression",
      territoryId: territory.id,
      territoryLabel: territory.label,
      distanceToPlayer,
    };
  }
  if (
    !input.muckExposureForcesAggression &&
    !isNightForMuckMonsterAggression(input.nowMs)
  ) {
    return {
      ...base,
      reason: "daylight_blocks_unprovoked_muck_aggression",
      territoryId: territory.id,
      territoryLabel: territory.label,
      distanceToPlayer,
      warning: false,
    };
  }
  if (distanceToPlayer > leashRadius) {
    return {
      ...base,
      reason: "outside_leash",
      territoryId: territory.id,
      territoryLabel: territory.label,
      distanceToPlayer,
    };
  }
  if (distanceToPlayer > aggroRadius) {
    return {
      ...base,
      reason: "outside_unprovoked_aggro_radius",
      territoryId: territory.id,
      territoryLabel: territory.label,
      distanceToPlayer,
      warning: distanceToPlayer <= warningRadius,
    };
  }
  if (input.lineOfSight === false) {
    return {
      ...base,
      reason: "line_of_sight_required",
      territoryId: territory.id,
      territoryLabel: territory.label,
      distanceToPlayer,
      warning: distanceToPlayer <= warningRadius,
    };
  }

  const targetId = input.playerId ?? "player";
  const archetypeId = muckMonsterCombatArchetype(input.monsterName);
  const decision = chooseHarthmereCombatAIDecision({
    actorId: input.monsterId,
    targetId,
    archetypeId,
    nowMs: input.nowMs ?? 0,
    distanceToTarget: distanceToPlayer,
    lineOfSight: true,
    facingTarget: true,
    healthPercent: input.monsterHpPercent ?? 1,
    staminaPercent: 1,
    manaPercent: /helix|scarred/i.test(input.monsterName) ? 0.55 : 0,
    targetHealthPercent: 1,
    alliesNearby: input.alliesNearby ?? 0,
    enemiesNearby: input.enemiesNearby ?? 1,
    legalTargets: [targetId],
    safeZone: false,
    spawnProtected: false,
    pvpAllowed: true,
    bossPhase:
      archetypeId === "boss_phase_controller" &&
      (input.monsterHpPercent ?? 1) < 0.5
        ? 2
        : 1,
    enrageTimerSeconds: 90,
    position: {
      x: monsterPosition[0],
      y: monsterPosition[1],
      z: monsterPosition[2],
    },
    targetPosition: {
      x: playerPosition[0],
      y: playerPosition[1],
      z: playerPosition[2],
    },
    deterministicSeed:
      Math.round(monsterPosition[0] * 17 + monsterPosition[2] * 31) || 1,
  });

  return {
    ...base,
    aggressive: decision.selectedActionId !== "idle_watch",
    reason:
      decision.selectedActionId === "idle_watch"
        ? "ai_selected_idle"
        : "player_entered_muck_territory",
    territoryId: territory.id,
    territoryLabel: territory.label,
    distanceToPlayer,
    warning: true,
    archetypeId,
    decision,
  };
}
