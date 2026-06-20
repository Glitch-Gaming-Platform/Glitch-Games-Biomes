import { harthmereUserScopedStorageKey } from "@/client/components/challenges/LocalDevHarthmereUserScope";
import {
  LIVE_ENTITY_ROBOT_DEFAULT_DRAIN_PER_HOUR,
  LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY,
  LIVE_ENTITY_ROBOT_ENERGY_PROTECTION_VERSION,
  canLiveEntityRobotMove,
  createLiveEntityRobotEnergyState,
  liveEntityRobotDefaultRobotIdForArea,
  liveEntityRobotEnergyDisplay,
  liveEntityRobotProtectionAreaForPosition,
  normalizeLiveEntityRobotEnergyState,
  rechargeLiveEntityRobotEnergy,
  tickLiveEntityRobotEnergy,
  type LiveEntityRobotEnergyDisplay,
  type LiveEntityRobotEnergyState,
} from "@/shared/harthmere/live_entity_robot_energy_protection";

export const LIVE_ENTITY_ROBOT_ENERGY_STATE_KEY =
  "biomes.localDev.liveEntityRobotEnergy";
export const LIVE_ENTITY_ROBOT_ENERGY_EVENT =
  "biomes:live-entity-robot-energy";

export function isLiveEntityRobotEnergyBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function storageKey() {
  return harthmereUserScopedStorageKey(
    LIVE_ENTITY_ROBOT_ENERGY_STATE_KEY
  );
}

function dispatchRobotEnergyChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LIVE_ENTITY_ROBOT_ENERGY_EVENT));
  }
}

function hasStoredLiveEntityRobotEnergyState() {
  if (!isLiveEntityRobotEnergyBrowser()) {
    return false;
  }
  return window.localStorage.getItem(storageKey()) !== null;
}

function finiteRobotNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function robotComponentUpdatedAtMs(value: unknown) {
  const raw = finiteRobotNumber(value);
  if (raw === undefined || raw <= 0) {
    return 0;
  }
  return raw < 10_000_000_000 ? raw * 1000 : raw;
}

function robotComponentEnergySnapshot(
  robotComponent: unknown,
  fallbackMaxEnergy = LIVE_ENTITY_ROBOT_DEFAULT_MAX_ENERGY
) {
  if (!robotComponent || typeof robotComponent !== "object") {
    return undefined;
  }
  const record = robotComponent as Record<string, unknown>;
  const energy = finiteRobotNumber(record.internal_battery_charge);
  if (energy === undefined) {
    return undefined;
  }
  const maxEnergy = Math.max(
    1,
    finiteRobotNumber(record.internal_battery_capacity) ??
      fallbackMaxEnergy
  );
  return {
    energy: Math.max(0, Math.min(maxEnergy, energy)),
    maxEnergy,
    updatedAtMs: robotComponentUpdatedAtMs(record.last_update),
  };
}

export function readLiveEntityRobotEnergyState(
  nowMs = Date.now()
): LiveEntityRobotEnergyState {
  if (!isLiveEntityRobotEnergyBrowser()) {
    return createLiveEntityRobotEnergyState(nowMs);
  }
  try {
    const raw = window.localStorage.getItem(storageKey());
    return normalizeLiveEntityRobotEnergyState(
      raw ? JSON.parse(raw) : undefined,
      nowMs
    );
  } catch {
    return createLiveEntityRobotEnergyState(nowMs);
  }
}

export function writeLiveEntityRobotEnergyState(
  state: LiveEntityRobotEnergyState
) {
  if (!isLiveEntityRobotEnergyBrowser()) {
    return;
  }
  window.localStorage.setItem(
    storageKey(),
    JSON.stringify({
      ...state,
      version: LIVE_ENTITY_ROBOT_ENERGY_PROTECTION_VERSION,
    })
  );
  dispatchRobotEnergyChanged();
}

export function readAndTickLiveEntityRobotEnergyState(
  nowMs = Date.now()
): LiveEntityRobotEnergyState {
  const state = readLiveEntityRobotEnergyState(nowMs);
  const oldestTickAtMs = Math.min(
    ...Object.values(state.robots).map((robot) => robot.lastTickAtMs)
  );
  if (Number.isFinite(oldestTickAtMs) && nowMs - oldestTickAtMs < 5_000) {
    return state;
  }
  const ticked = tickLiveEntityRobotEnergy(state, {
    nowMs,
    drainPerHour: LIVE_ENTITY_ROBOT_DEFAULT_DRAIN_PER_HOUR,
  });
  if (ticked.changedRobotIds.length > 0) {
    writeLiveEntityRobotEnergyState(ticked.state);
  }
  return ticked.state;
}

export function localDevLiveEntityRobotIdForPosition(
  position: readonly number[] | undefined
) {
  const area = liveEntityRobotProtectionAreaForPosition(position);
  return area ? liveEntityRobotDefaultRobotIdForArea(area.areaId) : undefined;
}

export function liveEntityRobotEnergyDisplayForPosition(
  position: readonly number[] | undefined,
  state = readAndTickLiveEntityRobotEnergyState()
): LiveEntityRobotEnergyDisplay | undefined {
  return liveEntityRobotEnergyDisplay(
    state,
    localDevLiveEntityRobotIdForPosition(position)
  );
}

export function liveEntityRobotEnergyStateWithComponentOverride(input: {
  state: LiveEntityRobotEnergyState;
  position: readonly number[] | undefined;
  robotComponent: unknown;
  displayName?: string;
  nowMs?: number;
  hasStoredState?: boolean;
}) {
  const area = liveEntityRobotProtectionAreaForPosition(input.position);
  if (!area) {
    return input.state;
  }
  const robotId = liveEntityRobotDefaultRobotIdForArea(area.areaId);
  const existing = input.state.robots[robotId];
  const snapshot = robotComponentEnergySnapshot(
    input.robotComponent,
    existing?.maxEnergy
  );
  if (!snapshot) {
    return input.state;
  }
  const hasStoredState =
    input.hasStoredState ?? hasStoredLiveEntityRobotEnergyState();
  const sourceUpdatedAtMs = snapshot.updatedAtMs;
  const existingUpdatedAtMs = existing?.lastTickAtMs ?? 0;
  const shouldUseComponent =
    !hasStoredState ||
    (sourceUpdatedAtMs > 0 && sourceUpdatedAtMs >= existingUpdatedAtMs);
  if (!shouldUseComponent) {
    return input.state;
  }
  return normalizeLiveEntityRobotEnergyState(
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

export function syncLocalDevLiveEntityRobotEnergyFromComponent(input: {
  position: readonly number[] | undefined;
  robotComponent: unknown;
  displayName?: string;
  nowMs?: number;
}) {
  const nowMs = input.nowMs ?? Date.now();
  const state = readAndTickLiveEntityRobotEnergyState(nowMs);
  const next = liveEntityRobotEnergyStateWithComponentOverride({
    state,
    position: input.position,
    robotComponent: input.robotComponent,
    displayName: input.displayName,
    nowMs,
  });
  if (next !== state) {
    writeLiveEntityRobotEnergyState(next);
  }
  return next;
}

export function liveEntityRobotEnergyDisplayForEntity(
  position: readonly number[] | undefined,
  robotComponent: unknown,
  displayName?: string,
  state = readAndTickLiveEntityRobotEnergyState()
): LiveEntityRobotEnergyDisplay | undefined {
  const effectiveState = liveEntityRobotEnergyStateWithComponentOverride({
    state,
    position,
    robotComponent,
    displayName,
  });
  return liveEntityRobotEnergyDisplayForPosition(position, effectiveState);
}

export function canLocalDevLiveEntityRobotMoveForArea(
  areaId: string | undefined,
  state = readAndTickLiveEntityRobotEnergyState()
) {
  return canLiveEntityRobotMove(
    state,
    areaId ? liveEntityRobotDefaultRobotIdForArea(areaId) : undefined
  );
}

export function isLocalDevLiveEntityRobotProtectionAreaSafeForPosition(
  position: readonly number[] | undefined,
  state = readAndTickLiveEntityRobotEnergyState()
) {
  const area = liveEntityRobotProtectionAreaForPosition(position);
  return area ? state.areas[area.areaId]?.safeFromMuck === true : false;
}

export function rechargeLocalDevLiveEntityRobotForPosition(
  position: readonly number[] | undefined,
  nowMs = Date.now()
) {
  const state = readAndTickLiveEntityRobotEnergyState(nowMs);
  const area = liveEntityRobotProtectionAreaForPosition(position);
  const robotId = area
    ? liveEntityRobotDefaultRobotIdForArea(area.areaId)
    : undefined;
  if (!area || !robotId) {
    return {
      state,
      warnings: ["live_entity_robot_rejected:known_area_required"],
    };
  }
  const result = rechargeLiveEntityRobotEnergy(state, {
    robotId,
    areaId: area.areaId,
    nowMs,
  });
  if (result.warnings.length === 0) {
    writeLiveEntityRobotEnergyState(result.state);
  }
  return result;
}
