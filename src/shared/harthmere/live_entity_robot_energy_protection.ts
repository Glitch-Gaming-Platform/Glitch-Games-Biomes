import type { BuildingSystemInWorldMarker } from "./building_system";
import {
  LIVE_ENTITY_HELPER_GROVE_EXCLUSION_BOUNDS,
  LIVE_ENTITY_HELPER_HARTHMERE_EXCLUSION_BOUNDS,
  isPositionInsideLiveEntityHelperBounds,
  type LiveEntityHelperBounds,
} from "./live_entity_helper_quests";

export const LIVE_ENTITY_ROBOT_ENERGY_PROTECTION_VERSION =
  "live-entity-robot-energy-protection" as const;

export const LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY = 100;
export const LIVE_ENTITY_ROBOT_LOW_ENERGY_THRESHOLD = 25;
export const LIVE_ENTITY_ROBOT_DEFAULT_DRAIN_PER_HOUR = 12;
export const LIVE_ENTITY_ROBOT_RECHARGE_AMOUNT = 40;
export const LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID =
  "stabilized_exotic_matter" as const;
export const LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY = 1;
export const LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP = {
  baseXp: 90,
  sourceLevel: 4,
  difficulty: "normal" as const,
};
export const LIVE_ENTITY_ROBOT_RECHARGE_REWARD_ITEMS = [
  {
    itemId: "repair_voucher",
    itemName: "Black Anvil Repair Voucher",
    quantity: 1,
  },
  {
    itemId: "minor_healing_salve",
    itemName: "Minor Healing Salve",
    quantity: 2,
  },
] as const;

export function liveEntityRobotRechargeRewardText() {
  const itemText = LIVE_ENTITY_ROBOT_RECHARGE_REWARD_ITEMS.map(
    (item) =>
      `${item.quantity} ${
        item.quantity === 1 ? item.itemName : `${item.itemName}s`
      }`
  ).join(", ");
  return `Reward: ${LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP.baseXp} XP, ${itemText}.`;
}

export type LiveEntityRobotEnergyStatus = "charged" | "low" | "depleted";
export type LiveEntityRobotProtectionStatus = "protected" | "mucked";

export interface LiveEntityRobotProtectionArea {
  areaId: string;
  label: string;
  bounds: LiveEntityHelperBounds;
  anchor: [number, number, number];
  groundY: number;
  protectedMarkerId: string;
  muckMarkerId: string;
  protectedLabel: string;
  muckLabel: string;
  description: string;
}

export interface LiveEntityRobotEnergyRecord {
  robotId: string;
  areaId: string;
  displayName: string;
  energy: number;
  maxEnergy: number;
  status: LiveEntityRobotEnergyStatus;
  lastTickAtMs: number;
  depletedAtMs?: number;
}

export interface LiveEntityRobotProtectionAreaState {
  areaId: string;
  status: LiveEntityRobotProtectionStatus;
  safeFromMuck: boolean;
  activeMarkerId: string;
  updatedAtMs: number;
}

export interface LiveEntityRobotEnergyState {
  version: typeof LIVE_ENTITY_ROBOT_ENERGY_PROTECTION_VERSION;
  robots: Record<string, LiveEntityRobotEnergyRecord>;
  areas: Record<string, LiveEntityRobotProtectionAreaState>;
}

export interface LiveEntityRobotEnergyMutationResult {
  state: LiveEntityRobotEnergyState;
  warnings: string[];
  changedRobotIds: string[];
  changedAreaIds: string[];
}

export interface LiveEntityRobotEnergyDisplay {
  robotId: string;
  areaId: string;
  displayName: string;
  energy: number;
  maxEnergy: number;
  percent: number;
  status: LiveEntityRobotEnergyStatus;
  barText: string;
  statusText: string;
  needsRechargeText?: string;
  rewardText?: string;
  movementAllowed: boolean;
}

const AUTHORED_LIVE_ENTITY_ROBOT_PROTECTION_AREAS: readonly LiveEntityRobotProtectionArea[] =
  [
    {
      areaId: "west_muck_breach",
      label: "West Muck Breach",
      bounds: { minX: 180, maxX: 292, minZ: -560, maxZ: -460 },
      anchor: [232, 32, -506],
      groundY: 32,
      protectedMarkerId: "robot_shield_west_muck_breach",
      muckMarkerId: "robot_muck_west_muck_breach",
      protectedLabel: "West Breach Shield",
      muckLabel: "West Breach Muck Surge",
      description:
        "A robot shield line keeps the western breach from spreading toward nearby Biomes.",
    },
    {
      areaId: "watchtower_muck_clearing",
      label: "Watchtower Muck Clearing",
      bounds: { minX: 316, maxX: 348, minZ: -406, maxZ: -374 },
      anchor: [332, 38, -390],
      groundY: 38,
      protectedMarkerId: "robot_shield_watchtower_clearing",
      muckMarkerId: "robot_muck_watchtower_clearing",
      protectedLabel: "Watchtower Shield",
      muckLabel: "Watchtower Muck Surge",
      description:
        "A field robot keeps the old watchtower clearing passable for remote travelers.",
    },
    {
      areaId: "old_wood_mucker_copse",
      label: "Old Wood Mucker Copse",
      bounds: { minX: 600, maxX: 688, minZ: -495, maxZ: -415 },
      anchor: [640, 57, -455],
      groundY: 57,
      protectedMarkerId: "robot_shield_old_wood_copse",
      muckMarkerId: "robot_muck_old_wood_copse",
      protectedLabel: "Old Wood Shield",
      muckLabel: "Old Wood Muck Surge",
      description:
        "A robot patrol suppresses Muck growth where the Old Wood path narrows.",
    },
    {
      areaId: "gravewood_pale_muck",
      label: "Gravewood Pale Muck",
      bounds: { minX: 598, maxX: 682, minZ: 78, maxZ: 162 },
      anchor: [640, 46, 120],
      groundY: 46,
      protectedMarkerId: "robot_shield_gravewood",
      muckMarkerId: "robot_muck_gravewood",
      protectedLabel: "Gravewood Shield",
      muckLabel: "Gravewood Muck Surge",
      description:
        "A robot beacon holds back the pale Muck south of the abandoned road.",
    },
  ];

// HILLY_WORLD_ROBOT_AREAS:
// These danger areas belong to the original scanned wilderness, not the flat
// additive Harthmere town. Keep their original X/Z and each sentinel's measured
// surface Y so the ECS body, recharge prompt, safe-zone marker, and Mucker AI
// all refer to the same reachable terrain column.
export const LIVE_ENTITY_ROBOT_PROTECTION_AREAS: readonly LiveEntityRobotProtectionArea[] =
  AUTHORED_LIVE_ENTITY_ROBOT_PROTECTION_AREAS;

function areaById(areaId: string | undefined) {
  return LIVE_ENTITY_ROBOT_PROTECTION_AREAS.find(
    (area) => area.areaId === areaId
  );
}

export function liveEntityRobotDefaultRobotIdForArea(areaId: string) {
  return `sentinel-robot:${areaId}`;
}

function defaultRobotNameForArea(area: LiveEntityRobotProtectionArea) {
  return `${area.label} Sentinel`;
}

function clampEnergy(energy: number, maxEnergy: number) {
  if (!Number.isFinite(energy)) {
    return 0;
  }
  return Math.max(0, Math.min(maxEnergy, energy));
}

export function liveEntityRobotEnergyStatus(
  energy: number,
  maxEnergy: number
): LiveEntityRobotEnergyStatus {
  if (energy <= 0) {
    return "depleted";
  }
  return energy <= maxEnergy * (LIVE_ENTITY_ROBOT_LOW_ENERGY_THRESHOLD / 100)
    ? "low"
    : "charged";
}

export function canLiveEntityRobotMove(
  state: LiveEntityRobotEnergyState,
  robotId: string | undefined
) {
  if (!robotId) {
    return true;
  }
  const robot = state.robots[robotId];
  return !robot || robot.energy > 0;
}

export function liveEntityRobotEnergyDisplay(
  state: LiveEntityRobotEnergyState,
  robotId: string | undefined
): LiveEntityRobotEnergyDisplay | undefined {
  if (!robotId) {
    return undefined;
  }
  const robot = state.robots[robotId];
  if (!robot) {
    return undefined;
  }
  const area = areaById(robot.areaId);
  const percent =
    robot.maxEnergy > 0
      ? Math.max(0, Math.min(100, (robot.energy / robot.maxEnergy) * 100))
      : 0;
  const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
  const barText = `${"#".repeat(filled)}${"-".repeat(10 - filled)}`;
  const energyLabel = `${Math.round(robot.energy)}/${Math.round(
    robot.maxEnergy
  )}`;
  if (robot.energy <= 0) {
    return {
      robotId: robot.robotId,
      areaId: robot.areaId,
      displayName: robot.displayName,
      energy: robot.energy,
      maxEnergy: robot.maxEnergy,
      percent,
      status: "depleted",
      barText,
      statusText: `${robot.displayName} is out of power. ${
        area?.label ?? "This area"
      } is no longer protected.`,
      needsRechargeText: `Needs ${LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY} Stabilized Exotic Matter to restore protection.`,
      rewardText: liveEntityRobotRechargeRewardText(),
      movementAllowed: false,
    };
  }
  if (robot.status === "low") {
    return {
      robotId: robot.robotId,
      areaId: robot.areaId,
      displayName: robot.displayName,
      energy: robot.energy,
      maxEnergy: robot.maxEnergy,
      percent,
      status: "low",
      barText,
      statusText: `${robot.displayName} is running low: ${energyLabel} energy.`,
      needsRechargeText: `Can use ${LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY} Stabilized Exotic Matter before protection fails.`,
      rewardText: liveEntityRobotRechargeRewardText(),
      movementAllowed: true,
    };
  }
  return {
    robotId: robot.robotId,
    areaId: robot.areaId,
    displayName: robot.displayName,
    energy: robot.energy,
    maxEnergy: robot.maxEnergy,
    percent,
    status: "charged",
    barText,
    statusText: `${robot.displayName} is holding the line: ${energyLabel} energy.`,
    movementAllowed: true,
  };
}

function normalizeRobotRecord(
  raw: Partial<LiveEntityRobotEnergyRecord>,
  nowMs: number
): LiveEntityRobotEnergyRecord | undefined {
  const robotId =
    typeof raw.robotId === "string" && raw.robotId.length > 0
      ? raw.robotId
      : undefined;
  const area = areaById(raw.areaId);
  if (!robotId || !area) {
    return undefined;
  }
  const maxEnergy =
    typeof raw.maxEnergy === "number" && raw.maxEnergy > 0
      ? raw.maxEnergy
      : LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY;
  const energy = clampEnergy(
    typeof raw.energy === "number" ? raw.energy : maxEnergy,
    maxEnergy
  );
  return {
    robotId,
    areaId: area.areaId,
    displayName:
      typeof raw.displayName === "string" && raw.displayName.length > 0
        ? raw.displayName
        : defaultRobotNameForArea(area),
    energy,
    maxEnergy,
    status: liveEntityRobotEnergyStatus(energy, maxEnergy),
    lastTickAtMs:
      typeof raw.lastTickAtMs === "number" && Number.isFinite(raw.lastTickAtMs)
        ? raw.lastTickAtMs
        : nowMs,
    depletedAtMs:
      typeof raw.depletedAtMs === "number" && energy <= 0
        ? raw.depletedAtMs
        : energy <= 0
        ? nowMs
        : undefined,
  };
}

function defaultRobotRecordForArea(
  area: LiveEntityRobotProtectionArea,
  nowMs: number
): LiveEntityRobotEnergyRecord {
  const maxEnergy = LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY;
  return {
    robotId: liveEntityRobotDefaultRobotIdForArea(area.areaId),
    areaId: area.areaId,
    displayName: defaultRobotNameForArea(area),
    energy: maxEnergy,
    maxEnergy,
    status: "charged",
    lastTickAtMs: nowMs,
  };
}

function recomputeAreaState(
  area: LiveEntityRobotProtectionArea,
  robots: Record<string, LiveEntityRobotEnergyRecord>,
  nowMs: number
): LiveEntityRobotProtectionAreaState {
  const areaRobots = Object.values(robots).filter(
    (robot) => robot.areaId === area.areaId
  );
  const protectedByRobot = areaRobots.some((robot) => robot.energy > 0);
  return {
    areaId: area.areaId,
    status: protectedByRobot ? "protected" : "mucked",
    safeFromMuck: protectedByRobot,
    activeMarkerId: protectedByRobot
      ? area.protectedMarkerId
      : area.muckMarkerId,
    updatedAtMs: nowMs,
  };
}

function recomputeAllAreaStates(
  robots: Record<string, LiveEntityRobotEnergyRecord>,
  nowMs: number
) {
  return Object.fromEntries(
    LIVE_ENTITY_ROBOT_PROTECTION_AREAS.map((area) => [
      area.areaId,
      recomputeAreaState(area, robots, nowMs),
    ])
  );
}

function cloneState(state: LiveEntityRobotEnergyState) {
  return {
    version: LIVE_ENTITY_ROBOT_ENERGY_PROTECTION_VERSION,
    robots: Object.fromEntries(
      Object.entries(state.robots).map(([robotId, robot]) => [
        robotId,
        { ...robot },
      ])
    ),
    areas: Object.fromEntries(
      Object.entries(state.areas).map(([areaId, area]) => [areaId, { ...area }])
    ),
  } satisfies LiveEntityRobotEnergyState;
}

export function createLiveEntityRobotEnergyState(
  nowMs: number
): LiveEntityRobotEnergyState {
  const robots = Object.fromEntries(
    LIVE_ENTITY_ROBOT_PROTECTION_AREAS.map((area) => {
      const robot = defaultRobotRecordForArea(area, nowMs);
      return [robot.robotId, robot];
    })
  );
  return {
    version: LIVE_ENTITY_ROBOT_ENERGY_PROTECTION_VERSION,
    robots,
    areas: recomputeAllAreaStates(robots, nowMs),
  };
}

export function normalizeLiveEntityRobotEnergyState(
  raw: unknown,
  nowMs: number
): LiveEntityRobotEnergyState {
  const defaults = createLiveEntityRobotEnergyState(nowMs);
  if (!raw || typeof raw !== "object") {
    return defaults;
  }
  const rawRobots = (raw as any).robots;
  const robots = { ...defaults.robots };
  if (rawRobots && typeof rawRobots === "object") {
    for (const value of Object.values(rawRobots)) {
      const record = normalizeRobotRecord(
        value as Partial<LiveEntityRobotEnergyRecord>,
        nowMs
      );
      if (record) {
        robots[record.robotId] = record;
      }
    }
  }
  return {
    version: LIVE_ENTITY_ROBOT_ENERGY_PROTECTION_VERSION,
    robots,
    areas: recomputeAllAreaStates(robots, nowMs),
  };
}

export function liveEntityRobotProtectionAreaForPosition(
  position: readonly number[] | undefined
) {
  return LIVE_ENTITY_ROBOT_PROTECTION_AREAS.find((area) =>
    isPositionInsideLiveEntityHelperBounds(position, area.bounds)
  );
}

export function isLiveEntityRobotProtectionAnchorGrounded(
  area: LiveEntityRobotProtectionArea
) {
  const clearance = area.anchor[1] - area.groundY;
  return clearance >= 0 && clearance <= 0.5;
}

function boundsOverlap(
  left: LiveEntityHelperBounds,
  right: LiveEntityHelperBounds
) {
  return !(
    left.maxX < right.minX ||
    left.minX > right.maxX ||
    left.maxZ < right.minZ ||
    left.minZ > right.maxZ
  );
}

export function validateLiveEntityRobotProtectionAreas() {
  const errors: string[] = [];
  for (const area of LIVE_ENTITY_ROBOT_PROTECTION_AREAS) {
    if (area.bounds.minX >= area.bounds.maxX) {
      errors.push(`${area.areaId}:invalid_x_bounds`);
    }
    if (area.bounds.minZ >= area.bounds.maxZ) {
      errors.push(`${area.areaId}:invalid_z_bounds`);
    }
    if (!isPositionInsideLiveEntityHelperBounds(area.anchor, area.bounds)) {
      errors.push(`${area.areaId}:anchor_outside_bounds`);
    }
    if (
      isPositionInsideLiveEntityHelperBounds(
        area.anchor,
        LIVE_ENTITY_HELPER_GROVE_EXCLUSION_BOUNDS
      ) ||
      isPositionInsideLiveEntityHelperBounds(
        area.anchor,
        LIVE_ENTITY_HELPER_HARTHMERE_EXCLUSION_BOUNDS
      )
    ) {
      errors.push(`${area.areaId}:anchor_inside_excluded_settlement`);
    }
    if (boundsOverlap(area.bounds, LIVE_ENTITY_HELPER_GROVE_EXCLUSION_BOUNDS)) {
      errors.push(`${area.areaId}:bounds_overlap_grove`);
    }
    if (
      boundsOverlap(area.bounds, LIVE_ENTITY_HELPER_HARTHMERE_EXCLUSION_BOUNDS)
    ) {
      errors.push(`${area.areaId}:bounds_overlap_harthmere`);
    }
    if (!isLiveEntityRobotProtectionAnchorGrounded(area)) {
      errors.push(`${area.areaId}:anchor_not_grounded`);
    }
    if (area.protectedLabel.includes("_") || area.muckLabel.includes("_")) {
      errors.push(`${area.areaId}:player_label_contains_internal_case`);
    }
    if (
      /debug|developer|server|local-dev|snakecase|camelcase/i.test(
        `${area.label} ${area.protectedLabel} ${area.muckLabel} ${area.description}`
      )
    ) {
      errors.push(`${area.areaId}:player_copy_contains_non_player_text`);
    }
  }
  for (
    let index = 0;
    index < LIVE_ENTITY_ROBOT_PROTECTION_AREAS.length;
    index += 1
  ) {
    for (
      let otherIndex = index + 1;
      otherIndex < LIVE_ENTITY_ROBOT_PROTECTION_AREAS.length;
      otherIndex += 1
    ) {
      const left = LIVE_ENTITY_ROBOT_PROTECTION_AREAS[index];
      const right = LIVE_ENTITY_ROBOT_PROTECTION_AREAS[otherIndex];
      if (boundsOverlap(left.bounds, right.bounds)) {
        errors.push(`${left.areaId}:overlaps:${right.areaId}`);
      }
    }
  }
  return errors;
}

export function tickLiveEntityRobotEnergy(
  state: LiveEntityRobotEnergyState,
  input: {
    nowMs: number;
    drainPerHour?: number;
    robotIds?: readonly string[];
  }
): LiveEntityRobotEnergyMutationResult {
  const next = cloneState(state);
  const drainPerHour = Math.max(
    0,
    input.drainPerHour ?? LIVE_ENTITY_ROBOT_DEFAULT_DRAIN_PER_HOUR
  );
  const targetRobotIds = input.robotIds?.length
    ? input.robotIds
    : Object.keys(next.robots);
  const changedRobotIds: string[] = [];
  const changedAreas = new Set<string>();
  const warnings: string[] = [];

  for (const robotId of targetRobotIds) {
    const robot = next.robots[robotId];
    if (!robot) {
      warnings.push(`live_entity_robot_rejected:unknown_robot:${robotId}`);
      continue;
    }
    const previousEnergy = robot.energy;
    const elapsedMs = Math.max(0, input.nowMs - robot.lastTickAtMs);
    const drain = (elapsedMs / 3_600_000) * drainPerHour;
    const energy = clampEnergy(previousEnergy - drain, robot.maxEnergy);
    robot.energy = Number(energy.toFixed(3));
    robot.status = liveEntityRobotEnergyStatus(robot.energy, robot.maxEnergy);
    robot.lastTickAtMs = input.nowMs;
    if (robot.energy <= 0 && previousEnergy > 0) {
      robot.depletedAtMs = input.nowMs;
    }
    if (robot.energy > 0) {
      delete robot.depletedAtMs;
    }
    if (previousEnergy !== robot.energy) {
      changedRobotIds.push(robot.robotId);
      changedAreas.add(robot.areaId);
    }
  }

  next.areas = recomputeAllAreaStates(next.robots, input.nowMs);
  return {
    state: next,
    warnings,
    changedRobotIds,
    changedAreaIds: [...changedAreas],
  };
}

export function rechargeLiveEntityRobotEnergy(
  state: LiveEntityRobotEnergyState,
  input: {
    robotId: string;
    nowMs: number;
    amount?: number;
    areaId?: string;
    displayName?: string;
  }
): LiveEntityRobotEnergyMutationResult {
  const next = cloneState(state);
  const warnings: string[] = [];
  let robot = next.robots[input.robotId];
  const area = areaById(robot?.areaId ?? input.areaId);
  if (!area) {
    return {
      state,
      warnings: ["live_entity_robot_rejected:known_area_required"],
      changedRobotIds: [],
      changedAreaIds: [],
    };
  }
  if (!robot) {
    robot = {
      robotId: input.robotId,
      areaId: area.areaId,
      displayName:
        input.displayName && input.displayName.length > 0
          ? input.displayName
          : defaultRobotNameForArea(area),
      energy: 0,
      maxEnergy: LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY,
      status: "depleted",
      lastTickAtMs: input.nowMs,
      depletedAtMs: input.nowMs,
    };
    next.robots[robot.robotId] = robot;
  }
  if (robot.energy >= robot.maxEnergy) {
    return {
      state,
      warnings: ["live_entity_robot_rejected:already_full"],
      changedRobotIds: [],
      changedAreaIds: [],
    };
  }
  const previousEnergy = robot.energy;
  robot.energy = clampEnergy(
    previousEnergy + (input.amount ?? LIVE_ENTITY_ROBOT_RECHARGE_AMOUNT),
    robot.maxEnergy
  );
  robot.energy = Number(robot.energy.toFixed(3));
  robot.status = liveEntityRobotEnergyStatus(robot.energy, robot.maxEnergy);
  robot.lastTickAtMs = input.nowMs;
  if (robot.energy > 0) {
    delete robot.depletedAtMs;
  }
  next.areas = recomputeAllAreaStates(next.robots, input.nowMs);
  return {
    state: next,
    warnings,
    changedRobotIds: [robot.robotId],
    changedAreaIds: [robot.areaId],
  };
}

export function liveEntityRobotProtectionBuildingMarker(
  area: LiveEntityRobotProtectionArea,
  state: LiveEntityRobotEnergyState,
  nowMs: number
): BuildingSystemInWorldMarker {
  const areaState =
    state.areas[area.areaId] ?? recomputeAreaState(area, state.robots, nowMs);
  const protectedArea = areaState.safeFromMuck;
  return {
    markerId: protectedArea ? area.protectedMarkerId : area.muckMarkerId,
    plotId: `robot_protection:${area.areaId}`,
    kind: protectedArea ? "safe_zone" : "muck_boundary",
    position: area.anchor,
    label: protectedArea ? area.protectedLabel : area.muckLabel,
    createdAtMs: areaState.updatedAtMs || nowMs,
  };
}

export function liveEntityRobotProtectionBuildingMarkers(
  state: LiveEntityRobotEnergyState,
  nowMs: number
) {
  return LIVE_ENTITY_ROBOT_PROTECTION_AREAS.map((area) =>
    liveEntityRobotProtectionBuildingMarker(area, state, nowMs)
  );
}
