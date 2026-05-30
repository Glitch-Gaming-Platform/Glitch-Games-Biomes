import { harthmereUserScopedStorageKey } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import {
  LIVE_ENTITY_ROBOT_DEFAULT_DRAIN_PER_HOUR_V1,
  LIVE_ENTITY_ROBOT_ENERGY_PROTECTION_VERSION_V1,
  canLiveEntityRobotMoveV1,
  createLiveEntityRobotEnergyStateV1,
  liveEntityRobotDefaultRobotIdForAreaV1,
  liveEntityRobotEnergyDisplayV1,
  liveEntityRobotProtectionAreaForPositionV1,
  normalizeLiveEntityRobotEnergyStateV1,
  rechargeLiveEntityRobotEnergyV1,
  tickLiveEntityRobotEnergyV1,
  type LiveEntityRobotEnergyDisplayV1,
  type LiveEntityRobotEnergyStateV1,
} from "@/shared/harthmere/live_entity_robot_energy_protection_v1";

export const LIVE_ENTITY_ROBOT_ENERGY_STATE_KEY_V1 =
  "biomes.localDev.liveEntityRobotEnergy.v1";
export const LIVE_ENTITY_ROBOT_ENERGY_EVENT_V1 =
  "biomes:live-entity-robot-energy-v1";

export function isLiveEntityRobotEnergyBrowserV1() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function storageKeyV1() {
  return harthmereUserScopedStorageKey(
    LIVE_ENTITY_ROBOT_ENERGY_STATE_KEY_V1
  );
}

function dispatchRobotEnergyChangedV1() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LIVE_ENTITY_ROBOT_ENERGY_EVENT_V1));
  }
}

export function readLiveEntityRobotEnergyStateV1(
  nowMs = Date.now()
): LiveEntityRobotEnergyStateV1 {
  if (!isLiveEntityRobotEnergyBrowserV1()) {
    return createLiveEntityRobotEnergyStateV1(nowMs);
  }
  try {
    const raw = window.localStorage.getItem(storageKeyV1());
    return normalizeLiveEntityRobotEnergyStateV1(
      raw ? JSON.parse(raw) : undefined,
      nowMs
    );
  } catch {
    return createLiveEntityRobotEnergyStateV1(nowMs);
  }
}

export function writeLiveEntityRobotEnergyStateV1(
  state: LiveEntityRobotEnergyStateV1
) {
  if (!isLiveEntityRobotEnergyBrowserV1()) {
    return;
  }
  window.localStorage.setItem(
    storageKeyV1(),
    JSON.stringify({
      ...state,
      version: LIVE_ENTITY_ROBOT_ENERGY_PROTECTION_VERSION_V1,
    })
  );
  dispatchRobotEnergyChangedV1();
}

export function readAndTickLiveEntityRobotEnergyStateV1(
  nowMs = Date.now()
): LiveEntityRobotEnergyStateV1 {
  const state = readLiveEntityRobotEnergyStateV1(nowMs);
  const oldestTickAtMs = Math.min(
    ...Object.values(state.robots).map((robot) => robot.lastTickAtMs)
  );
  if (Number.isFinite(oldestTickAtMs) && nowMs - oldestTickAtMs < 5_000) {
    return state;
  }
  const ticked = tickLiveEntityRobotEnergyV1(state, {
    nowMs,
    drainPerHour: LIVE_ENTITY_ROBOT_DEFAULT_DRAIN_PER_HOUR_V1,
  });
  if (ticked.changedRobotIds.length > 0) {
    writeLiveEntityRobotEnergyStateV1(ticked.state);
  }
  return ticked.state;
}

export function localDevLiveEntityRobotIdForPositionV1(
  position: readonly number[] | undefined
) {
  const area = liveEntityRobotProtectionAreaForPositionV1(position);
  return area ? liveEntityRobotDefaultRobotIdForAreaV1(area.areaId) : undefined;
}

export function liveEntityRobotEnergyDisplayForPositionV1(
  position: readonly number[] | undefined,
  state = readAndTickLiveEntityRobotEnergyStateV1()
): LiveEntityRobotEnergyDisplayV1 | undefined {
  return liveEntityRobotEnergyDisplayV1(
    state,
    localDevLiveEntityRobotIdForPositionV1(position)
  );
}

export function canLocalDevLiveEntityRobotMoveForAreaV1(
  areaId: string | undefined,
  state = readAndTickLiveEntityRobotEnergyStateV1()
) {
  return canLiveEntityRobotMoveV1(
    state,
    areaId ? liveEntityRobotDefaultRobotIdForAreaV1(areaId) : undefined
  );
}

export function isLocalDevLiveEntityRobotProtectionAreaSafeForPositionV1(
  position: readonly number[] | undefined,
  state = readAndTickLiveEntityRobotEnergyStateV1()
) {
  const area = liveEntityRobotProtectionAreaForPositionV1(position);
  return area ? state.areas[area.areaId]?.safeFromMuck === true : false;
}

export function rechargeLocalDevLiveEntityRobotForPositionV1(
  position: readonly number[] | undefined,
  nowMs = Date.now()
) {
  const state = readAndTickLiveEntityRobotEnergyStateV1(nowMs);
  const area = liveEntityRobotProtectionAreaForPositionV1(position);
  const robotId = area
    ? liveEntityRobotDefaultRobotIdForAreaV1(area.areaId)
    : undefined;
  if (!area || !robotId) {
    return {
      state,
      warnings: ["live_entity_robot_rejected:known_area_required"],
    };
  }
  const result = rechargeLiveEntityRobotEnergyV1(state, {
    robotId,
    areaId: area.areaId,
    nowMs,
  });
  if (result.warnings.length === 0) {
    writeLiveEntityRobotEnergyStateV1(result.state);
  }
  return result;
}
