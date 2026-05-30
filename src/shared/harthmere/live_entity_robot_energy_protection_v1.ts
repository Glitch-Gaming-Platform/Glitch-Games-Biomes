import type { BuildingSystemInWorldMarkerV1 } from "./building_system_v1";
import {
  LIVE_ENTITY_HELPER_GROVE_EXCLUSION_BOUNDS_V1,
  LIVE_ENTITY_HELPER_HARTHMERE_EXCLUSION_BOUNDS_V1,
  isPositionInsideLiveEntityHelperBoundsV1,
  type LiveEntityHelperBoundsV1,
} from "./live_entity_helper_quests_v1";

export const LIVE_ENTITY_ROBOT_ENERGY_PROTECTION_VERSION_V1 =
  "live-entity-robot-energy-protection-v1" as const;

export const LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY_V1 = 100;
export const LIVE_ENTITY_ROBOT_LOW_ENERGY_THRESHOLD_V1 = 25;
export const LIVE_ENTITY_ROBOT_DEFAULT_DRAIN_PER_HOUR_V1 = 12;
export const LIVE_ENTITY_ROBOT_RECHARGE_AMOUNT_V1 = 40;
export const LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1 =
  "stabilized_exotic_matter" as const;
export const LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY_V1 = 1;
export const LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP_V1 = {
  baseXp: 90,
  sourceLevel: 4,
  difficulty: "normal" as const,
};
export const LIVE_ENTITY_ROBOT_RECHARGE_REWARD_ITEMS_V1 = [
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

export function liveEntityRobotRechargeRewardTextV1() {
  const itemText = LIVE_ENTITY_ROBOT_RECHARGE_REWARD_ITEMS_V1.map(
    (item) =>
      `${item.quantity} ${
        item.quantity === 1 ? item.itemName : `${item.itemName}s`
      }`
  ).join(", ");
  return `Reward: ${LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP_V1.baseXp} XP, ${itemText}.`;
}

export type LiveEntityRobotEnergyStatusV1 = "charged" | "low" | "depleted";
export type LiveEntityRobotProtectionStatusV1 = "protected" | "mucked";

export interface LiveEntityRobotProtectionAreaV1 {
  areaId: string;
  label: string;
  bounds: LiveEntityHelperBoundsV1;
  anchor: [number, number, number];
  groundY: number;
  protectedMarkerId: string;
  muckMarkerId: string;
  protectedLabel: string;
  muckLabel: string;
  description: string;
}

export interface LiveEntityRobotEnergyRecordV1 {
  robotId: string;
  areaId: string;
  displayName: string;
  energy: number;
  maxEnergy: number;
  status: LiveEntityRobotEnergyStatusV1;
  lastTickAtMs: number;
  depletedAtMs?: number;
}

export interface LiveEntityRobotProtectionAreaStateV1 {
  areaId: string;
  status: LiveEntityRobotProtectionStatusV1;
  safeFromMuck: boolean;
  activeMarkerId: string;
  updatedAtMs: number;
}

export interface LiveEntityRobotEnergyStateV1 {
  version: typeof LIVE_ENTITY_ROBOT_ENERGY_PROTECTION_VERSION_V1;
  robots: Record<string, LiveEntityRobotEnergyRecordV1>;
  areas: Record<string, LiveEntityRobotProtectionAreaStateV1>;
}

export interface LiveEntityRobotEnergyMutationResultV1 {
  state: LiveEntityRobotEnergyStateV1;
  warnings: string[];
  changedRobotIds: string[];
  changedAreaIds: string[];
}

export interface LiveEntityRobotEnergyDisplayV1 {
  robotId: string;
  areaId: string;
  displayName: string;
  energy: number;
  maxEnergy: number;
  percent: number;
  status: LiveEntityRobotEnergyStatusV1;
  barText: string;
  statusText: string;
  needsRechargeText?: string;
  rewardText?: string;
  movementAllowed: boolean;
}

export const LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1: readonly LiveEntityRobotProtectionAreaV1[] =
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

function areaByIdV1(areaId: string | undefined) {
  return LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1.find(
    (area) => area.areaId === areaId
  );
}

export function liveEntityRobotDefaultRobotIdForAreaV1(areaId: string) {
  return `sentinel-robot:${areaId}`;
}

function defaultRobotNameForAreaV1(area: LiveEntityRobotProtectionAreaV1) {
  return `${area.label} Sentinel`;
}

function clampEnergyV1(energy: number, maxEnergy: number) {
  if (!Number.isFinite(energy)) {
    return 0;
  }
  return Math.max(0, Math.min(maxEnergy, energy));
}

export function liveEntityRobotEnergyStatusV1(
  energy: number,
  maxEnergy: number
): LiveEntityRobotEnergyStatusV1 {
  if (energy <= 0) {
    return "depleted";
  }
  return energy <= maxEnergy * (LIVE_ENTITY_ROBOT_LOW_ENERGY_THRESHOLD_V1 / 100)
    ? "low"
    : "charged";
}

export function canLiveEntityRobotMoveV1(
  state: LiveEntityRobotEnergyStateV1,
  robotId: string | undefined
) {
  if (!robotId) {
    return true;
  }
  const robot = state.robots[robotId];
  return !robot || robot.energy > 0;
}

export function liveEntityRobotEnergyDisplayV1(
  state: LiveEntityRobotEnergyStateV1,
  robotId: string | undefined
): LiveEntityRobotEnergyDisplayV1 | undefined {
  if (!robotId) {
    return undefined;
  }
  const robot = state.robots[robotId];
  if (!robot) {
    return undefined;
  }
  const area = areaByIdV1(robot.areaId);
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
      statusText: `${robot.displayName} is out of power. ${area?.label ?? "This area"} is no longer protected.`,
      needsRechargeText: `Needs ${LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY_V1} Stabilized Exotic Matter to restore protection.`,
      rewardText: liveEntityRobotRechargeRewardTextV1(),
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
      needsRechargeText: `Can use ${LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY_V1} Stabilized Exotic Matter before protection fails.`,
      rewardText: liveEntityRobotRechargeRewardTextV1(),
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

function normalizeRobotRecordV1(
  raw: Partial<LiveEntityRobotEnergyRecordV1>,
  nowMs: number
): LiveEntityRobotEnergyRecordV1 | undefined {
  const robotId =
    typeof raw.robotId === "string" && raw.robotId.length > 0
      ? raw.robotId
      : undefined;
  const area = areaByIdV1(raw.areaId);
  if (!robotId || !area) {
    return undefined;
  }
  const maxEnergy =
    typeof raw.maxEnergy === "number" && raw.maxEnergy > 0
      ? raw.maxEnergy
      : LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY_V1;
  const energy = clampEnergyV1(
    typeof raw.energy === "number" ? raw.energy : maxEnergy,
    maxEnergy
  );
  return {
    robotId,
    areaId: area.areaId,
    displayName:
      typeof raw.displayName === "string" && raw.displayName.length > 0
        ? raw.displayName
        : defaultRobotNameForAreaV1(area),
    energy,
    maxEnergy,
    status: liveEntityRobotEnergyStatusV1(energy, maxEnergy),
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

function defaultRobotRecordForAreaV1(
  area: LiveEntityRobotProtectionAreaV1,
  nowMs: number
): LiveEntityRobotEnergyRecordV1 {
  const maxEnergy = LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY_V1;
  return {
    robotId: liveEntityRobotDefaultRobotIdForAreaV1(area.areaId),
    areaId: area.areaId,
    displayName: defaultRobotNameForAreaV1(area),
    energy: maxEnergy,
    maxEnergy,
    status: "charged",
    lastTickAtMs: nowMs,
  };
}

function recomputeAreaStateV1(
  area: LiveEntityRobotProtectionAreaV1,
  robots: Record<string, LiveEntityRobotEnergyRecordV1>,
  nowMs: number
): LiveEntityRobotProtectionAreaStateV1 {
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

function recomputeAllAreaStatesV1(
  robots: Record<string, LiveEntityRobotEnergyRecordV1>,
  nowMs: number
) {
  return Object.fromEntries(
    LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1.map((area) => [
      area.areaId,
      recomputeAreaStateV1(area, robots, nowMs),
    ])
  );
}

function cloneStateV1(state: LiveEntityRobotEnergyStateV1) {
  return {
    version: LIVE_ENTITY_ROBOT_ENERGY_PROTECTION_VERSION_V1,
    robots: Object.fromEntries(
      Object.entries(state.robots).map(([robotId, robot]) => [
        robotId,
        { ...robot },
      ])
    ),
    areas: Object.fromEntries(
      Object.entries(state.areas).map(([areaId, area]) => [
        areaId,
        { ...area },
      ])
    ),
  } satisfies LiveEntityRobotEnergyStateV1;
}

export function createLiveEntityRobotEnergyStateV1(
  nowMs: number
): LiveEntityRobotEnergyStateV1 {
  const robots = Object.fromEntries(
    LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1.map((area) => {
      const robot = defaultRobotRecordForAreaV1(area, nowMs);
      return [robot.robotId, robot];
    })
  );
  return {
    version: LIVE_ENTITY_ROBOT_ENERGY_PROTECTION_VERSION_V1,
    robots,
    areas: recomputeAllAreaStatesV1(robots, nowMs),
  };
}

export function normalizeLiveEntityRobotEnergyStateV1(
  raw: unknown,
  nowMs: number
): LiveEntityRobotEnergyStateV1 {
  const defaults = createLiveEntityRobotEnergyStateV1(nowMs);
  if (!raw || typeof raw !== "object") {
    return defaults;
  }
  const rawRobots = (raw as any).robots;
  const robots = { ...defaults.robots };
  if (rawRobots && typeof rawRobots === "object") {
    for (const value of Object.values(rawRobots)) {
      const record = normalizeRobotRecordV1(
        value as Partial<LiveEntityRobotEnergyRecordV1>,
        nowMs
      );
      if (record) {
        robots[record.robotId] = record;
      }
    }
  }
  return {
    version: LIVE_ENTITY_ROBOT_ENERGY_PROTECTION_VERSION_V1,
    robots,
    areas: recomputeAllAreaStatesV1(robots, nowMs),
  };
}

export function liveEntityRobotProtectionAreaForPositionV1(
  position: readonly number[] | undefined
) {
  return LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1.find((area) =>
    isPositionInsideLiveEntityHelperBoundsV1(position, area.bounds)
  );
}

export function isLiveEntityRobotProtectionAnchorGroundedV1(
  area: LiveEntityRobotProtectionAreaV1
) {
  const clearance = area.anchor[1] - area.groundY;
  return clearance >= 0 && clearance <= 0.5;
}

function boundsOverlapV1(
  left: LiveEntityHelperBoundsV1,
  right: LiveEntityHelperBoundsV1
) {
  return !(
    left.maxX < right.minX ||
    left.minX > right.maxX ||
    left.maxZ < right.minZ ||
    left.minZ > right.maxZ
  );
}

export function validateLiveEntityRobotProtectionAreasV1() {
  const errors: string[] = [];
  for (const area of LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1) {
    if (area.bounds.minX >= area.bounds.maxX) {
      errors.push(`${area.areaId}:invalid_x_bounds`);
    }
    if (area.bounds.minZ >= area.bounds.maxZ) {
      errors.push(`${area.areaId}:invalid_z_bounds`);
    }
    if (!isPositionInsideLiveEntityHelperBoundsV1(area.anchor, area.bounds)) {
      errors.push(`${area.areaId}:anchor_outside_bounds`);
    }
    if (
      isPositionInsideLiveEntityHelperBoundsV1(
        area.anchor,
        LIVE_ENTITY_HELPER_GROVE_EXCLUSION_BOUNDS_V1
      ) ||
      isPositionInsideLiveEntityHelperBoundsV1(
        area.anchor,
        LIVE_ENTITY_HELPER_HARTHMERE_EXCLUSION_BOUNDS_V1
      )
    ) {
      errors.push(`${area.areaId}:anchor_inside_excluded_settlement`);
    }
    if (
      boundsOverlapV1(area.bounds, LIVE_ENTITY_HELPER_GROVE_EXCLUSION_BOUNDS_V1)
    ) {
      errors.push(`${area.areaId}:bounds_overlap_grove`);
    }
    if (
      boundsOverlapV1(
        area.bounds,
        LIVE_ENTITY_HELPER_HARTHMERE_EXCLUSION_BOUNDS_V1
      )
    ) {
      errors.push(`${area.areaId}:bounds_overlap_harthmere`);
    }
    if (!isLiveEntityRobotProtectionAnchorGroundedV1(area)) {
      errors.push(`${area.areaId}:anchor_not_grounded`);
    }
    if (area.protectedLabel.includes("_") || area.muckLabel.includes("_")) {
      errors.push(`${area.areaId}:player_label_contains_internal_case`);
    }
    if (/debug|developer|server|local-dev|snakecase|camelcase/i.test(
      `${area.label} ${area.protectedLabel} ${area.muckLabel} ${area.description}`
    )) {
      errors.push(`${area.areaId}:player_copy_contains_non_player_text`);
    }
  }
  for (let index = 0; index < LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1.length; index += 1) {
    for (
      let otherIndex = index + 1;
      otherIndex < LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1.length;
      otherIndex += 1
    ) {
      const left = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[index];
      const right = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[otherIndex];
      if (boundsOverlapV1(left.bounds, right.bounds)) {
        errors.push(`${left.areaId}:overlaps:${right.areaId}`);
      }
    }
  }
  return errors;
}

export function tickLiveEntityRobotEnergyV1(
  state: LiveEntityRobotEnergyStateV1,
  input: {
    nowMs: number;
    drainPerHour?: number;
    robotIds?: readonly string[];
  }
): LiveEntityRobotEnergyMutationResultV1 {
  const next = cloneStateV1(state);
  const drainPerHour = Math.max(
    0,
    input.drainPerHour ?? LIVE_ENTITY_ROBOT_DEFAULT_DRAIN_PER_HOUR_V1
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
    const energy = clampEnergyV1(previousEnergy - drain, robot.maxEnergy);
    robot.energy = Number(energy.toFixed(3));
    robot.status = liveEntityRobotEnergyStatusV1(
      robot.energy,
      robot.maxEnergy
    );
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

  next.areas = recomputeAllAreaStatesV1(next.robots, input.nowMs);
  return {
    state: next,
    warnings,
    changedRobotIds,
    changedAreaIds: [...changedAreas],
  };
}

export function rechargeLiveEntityRobotEnergyV1(
  state: LiveEntityRobotEnergyStateV1,
  input: {
    robotId: string;
    nowMs: number;
    amount?: number;
    areaId?: string;
    displayName?: string;
  }
): LiveEntityRobotEnergyMutationResultV1 {
  const next = cloneStateV1(state);
  const warnings: string[] = [];
  let robot = next.robots[input.robotId];
  const area = areaByIdV1(robot?.areaId ?? input.areaId);
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
          : defaultRobotNameForAreaV1(area),
      energy: 0,
      maxEnergy: LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY_V1,
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
  robot.energy = clampEnergyV1(
    previousEnergy + (input.amount ?? LIVE_ENTITY_ROBOT_RECHARGE_AMOUNT_V1),
    robot.maxEnergy
  );
  robot.energy = Number(robot.energy.toFixed(3));
  robot.status = liveEntityRobotEnergyStatusV1(robot.energy, robot.maxEnergy);
  robot.lastTickAtMs = input.nowMs;
  if (robot.energy > 0) {
    delete robot.depletedAtMs;
  }
  next.areas = recomputeAllAreaStatesV1(next.robots, input.nowMs);
  return {
    state: next,
    warnings,
    changedRobotIds: [robot.robotId],
    changedAreaIds: [robot.areaId],
  };
}

export function liveEntityRobotProtectionBuildingMarkerV1(
  area: LiveEntityRobotProtectionAreaV1,
  state: LiveEntityRobotEnergyStateV1,
  nowMs: number
): BuildingSystemInWorldMarkerV1 {
  const areaState =
    state.areas[area.areaId] ?? recomputeAreaStateV1(area, state.robots, nowMs);
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

export function liveEntityRobotProtectionBuildingMarkersV1(
  state: LiveEntityRobotEnergyStateV1,
  nowMs: number
) {
  return LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1.map((area) =>
    liveEntityRobotProtectionBuildingMarkerV1(area, state, nowMs)
  );
}
