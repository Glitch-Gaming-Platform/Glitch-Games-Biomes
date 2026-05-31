import { harthmereUserScopedStorageKey } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import {
  LIVE_ENTITY_ROBOT_DEFAULT_DRAIN_PER_HOUR_V1,
  LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY_V1,
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

function hasStoredLiveEntityRobotEnergyStateV1() {
  if (!isLiveEntityRobotEnergyBrowserV1()) {
    return false;
  }
  return window.localStorage.getItem(storageKeyV1()) !== null;
}

function finiteRobotNumberV1(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function robotComponentUpdatedAtMsV1(value: unknown) {
  const raw = finiteRobotNumberV1(value);
  if (raw === undefined || raw <= 0) {
    return 0;
  }
  return raw < 10_000_000_000 ? raw * 1000 : raw;
}

function robotComponentEnergySnapshotV1(
  robotComponent: unknown,
  fallbackMaxEnergy = LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY_V1
) {
  if (!robotComponent || typeof robotComponent !== "object") {
    return undefined;
  }
  const record = robotComponent as Record<string, unknown>;
  const energy = finiteRobotNumberV1(record.internal_battery_charge);
  if (energy === undefined) {
    return undefined;
  }
  const maxEnergy = Math.max(
    1,
    finiteRobotNumberV1(record.internal_battery_capacity) ??
      fallbackMaxEnergy
  );
  return {
    energy: Math.max(0, Math.min(maxEnergy, energy)),
    maxEnergy,
    updatedAtMs: robotComponentUpdatedAtMsV1(record.last_update),
  };
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

export function liveEntityRobotEnergyStateWithComponentOverrideV1(input: {
  state: LiveEntityRobotEnergyStateV1;
  position: readonly number[] | undefined;
  robotComponent: unknown;
  displayName?: string;
  nowMs?: number;
  hasStoredState?: boolean;
}) {
  const area = liveEntityRobotProtectionAreaForPositionV1(input.position);
  if (!area) {
    return input.state;
  }
  const robotId = liveEntityRobotDefaultRobotIdForAreaV1(area.areaId);
  const existing = input.state.robots[robotId];
  const snapshot = robotComponentEnergySnapshotV1(
    input.robotComponent,
    existing?.maxEnergy
  );
  if (!snapshot) {
    return input.state;
  }
  const hasStoredState =
    input.hasStoredState ?? hasStoredLiveEntityRobotEnergyStateV1();
  const sourceUpdatedAtMs = snapshot.updatedAtMs;
  const existingUpdatedAtMs = existing?.lastTickAtMs ?? 0;
  const shouldUseComponent =
    !hasStoredState ||
    (sourceUpdatedAtMs > 0 && sourceUpdatedAtMs >= existingUpdatedAtMs);
  if (!shouldUseComponent) {
    return input.state;
  }
  return normalizeLiveEntityRobotEnergyStateV1(
    {
      ...input.state,
      robots: {
        ...input.state.robots,
        [robotId]: {
          ...(existing ?? {}),
          robotId,
          areaId: area.areaId,
          displayName:
            input.displayName?.trim() ||
            existing?.displayName ||
            `${area.label} Sentinel`,
          energy: snapshot.energy,
          maxEnergy: snapshot.maxEnergy,
          lastTickAtMs: sourceUpdatedAtMs || input.nowMs || Date.now(),
        },
      },
    },
    input.nowMs ?? Date.now()
  );
}

export function syncLocalDevLiveEntityRobotEnergyFromComponentV1(input: {
  position: readonly number[] | undefined;
  robotComponent: unknown;
  displayName?: string;
  nowMs?: number;
}) {
  const nowMs = input.nowMs ?? Date.now();
  const state = readAndTickLiveEntityRobotEnergyStateV1(nowMs);
  const next = liveEntityRobotEnergyStateWithComponentOverrideV1({
    state,
    position: input.position,
    robotComponent: input.robotComponent,
    displayName: input.displayName,
    nowMs,
  });
  if (next !== state) {
    writeLiveEntityRobotEnergyStateV1(next);
  }
  return next;
}

export function liveEntityRobotEnergyDisplayForEntityV1(
  position: readonly number[] | undefined,
  robotComponent: unknown,
  displayName?: string,
  state = readAndTickLiveEntityRobotEnergyStateV1()
): LiveEntityRobotEnergyDisplayV1 | undefined {
  const effectiveState = liveEntityRobotEnergyStateWithComponentOverrideV1({
    state,
    position,
    robotComponent,
    displayName,
  });
  return liveEntityRobotEnergyDisplayForPositionV1(position, effectiveState);
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
