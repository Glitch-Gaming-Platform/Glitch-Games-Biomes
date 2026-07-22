import { isDayTime, sunInclination } from "@/shared/game/sun_moon_position";
import {
  chooseHarthmereCombatAIDecision,
  type HarthmereCombatAIArchetypeId,
} from "./third_party_combat_ai";
import { isLiveEntityHelperPositionInMuckBreachArea } from "./live_entity_helper_quests";
import {
  shiftHarthmereAuthoredPositionToWorld,
  unshiftHarthmereWorldPositionToAuthored,
} from "./coordinate_transform";
import {
  SNAPSHOT_DANGER_AREAS,
  SNAPSHOT_HARTHMERE_MUCK_ZONES,
  authoredSnapshotAreaForPoint,
} from "./snapshot_runtime_rules";
import { HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X } from "./world_extension";

export const MUCK_MONSTER_AGGRESSION_AI_VERSION =
  "muck-monster-aggression-ai" as const;
export const MUCK_MONSTER_UNPROVOKED_AGGRO_RADIUS = 10.5;
export const MUCK_MONSTER_UNPROVOKED_WARNING_RADIUS = 16;
// HARTHMERE_MUCK_LEASH_REASONABLE (2026-07-07): a muck monster gives up the
// chase past this distance from the player. 34 let a creature run a player down
// from across the field ("hit from ~34 units"); 18 keeps encounters escapable
// while still allowing a short, fair pursuit past the 10.5 aggro radius.
export const MUCK_MONSTER_UNPROVOKED_LEASH_RADIUS = 18;

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
  let muck =
    authoredSnapshotAreaForPoint(pos, SNAPSHOT_HARTHMERE_MUCK_ZONES, pad) ??
    authoredSnapshotAreaForPoint(pos, SNAPSHOT_DANGER_AREAS, pad);
  if (!muck && pos[0] >= HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X) {
    const authored = unshiftHarthmereWorldPositionToAuthored(pos);
    muck =
      authoredSnapshotAreaForPoint(
        authored,
        SNAPSHOT_HARTHMERE_MUCK_ZONES,
        pad
      ) ?? authoredSnapshotAreaForPoint(authored, SNAPSHOT_DANGER_AREAS, pad);
  }
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
  // Placement builders and validation tests still operate on authored seeds.
  // Check their transformed point against the now-world-space breach bounds.
  if (
    pos[0] < HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X &&
    isLiveEntityHelperPositionInMuckBreachArea(
      shiftHarthmereAuthoredPositionToWorld(pos)
    )
  ) {
    return {
      id: "west_muck_breach",
      label: "West Muck Breach",
      type: "muck",
    };
  }
  return undefined;
}

// HARTHMERE_TUTORIAL_MUCK_PATCH_SAFE (2026-07-07): the Road Ahead tutorial's
// "break the muckwad" step sends brand-new, effectively unarmed players to break
// terrain inside the starter muck patch. Hostiles are now authored outside the
// Grove, but keep this hard rule so a wandering or stale production Mucker can
// never attack a new player during the Road Ahead training step.
const TUTORIAL_UNPROVOKED_SAFE_MUCK_ZONE_IDS = new Set(["road_muckwad_patch"]);

function isInTutorialUnprovokedSafeMuckZone(
  position: readonly number[] | undefined
) {
  const pos = asVec3(position);
  if (!pos) return false;
  return SNAPSHOT_HARTHMERE_MUCK_ZONES.some(
    (zone) =>
      TUTORIAL_UNPROVOKED_SAFE_MUCK_ZONE_IDS.has(zone.id) &&
      distance2d(zone.authoredCenter, pos) <= zone.radius + 2
  );
}

export function evaluateMuckMonsterAggression(
  input: MuckMonsterAggressionInput
): MuckMonsterAggressionDecision {
  const monsterPosition = asVec3(input.monsterPosition);
  const playerPosition = asVec3(input.playerPosition);
  const aggroRadius = input.aggroRadius ?? MUCK_MONSTER_UNPROVOKED_AGGRO_RADIUS;
  const warningRadius =
    input.warningRadius ?? MUCK_MONSTER_UNPROVOKED_WARNING_RADIUS;
  const leashRadius = input.leashRadius ?? MUCK_MONSTER_UNPROVOKED_LEASH_RADIUS;
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
  if (
    isInTutorialUnprovokedSafeMuckZone(playerPosition) ||
    isInTutorialUnprovokedSafeMuckZone(monsterPosition)
  ) {
    return {
      ...base,
      reason: "tutorial_patch_blocks_unprovoked_muck_aggression",
      territoryId: territory.id,
      territoryLabel: territory.label,
      distanceToPlayer,
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
