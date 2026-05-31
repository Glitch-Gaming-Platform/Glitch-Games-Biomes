/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import {
  liveEntityRobotEnergyStateWithComponentOverrideV1,
} from "@/client/components/challenges/LocalDevLiveEntityRobotEnergyState";
import {
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1,
  createLiveEntityRobotEnergyStateV1,
  liveEntityRobotDefaultRobotIdForAreaV1,
  liveEntityRobotEnergyDisplayV1,
  rechargeLiveEntityRobotEnergyV1,
} from "@/shared/harthmere/live_entity_robot_energy_protection_v1";

const NOW_MS = 1_700_000_000_000;

describe("LocalDevLiveEntityRobotEnergyState", () => {
  it("treats a zero-energy ECS robot component as depleted for dialogue, overlays, movement, and Muck state", () => {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[0];
    const robotId = liveEntityRobotDefaultRobotIdForAreaV1(area.areaId);
    const base = createLiveEntityRobotEnergyStateV1(NOW_MS);

    const overridden = liveEntityRobotEnergyStateWithComponentOverrideV1({
      state: base,
      position: area.anchor,
      robotComponent: {
        internal_battery_charge: 0,
        internal_battery_capacity: 100,
        last_update: NOW_MS / 1000,
      },
      displayName: "West Breach Sentinel",
      nowMs: NOW_MS,
      hasStoredState: false,
    });

    assert.equal(overridden.robots[robotId].energy, 0);
    assert.equal(overridden.robots[robotId].status, "depleted");
    assert.equal(overridden.areas[area.areaId].status, "mucked");
    assert.equal(overridden.areas[area.areaId].safeFromMuck, false);
    assert.equal(
      liveEntityRobotEnergyDisplayV1(overridden, robotId)?.needsRechargeText,
      "Needs 1 Stabilized Exotic Matter to restore protection."
    );
    assert.equal(
      liveEntityRobotEnergyDisplayV1(overridden, robotId)?.movementAllowed,
      false
    );
  });

  it("does not let a stale zero-energy component erase a newer local recharge", () => {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[0];
    const robotId = liveEntityRobotDefaultRobotIdForAreaV1(area.areaId);
    const depleted = liveEntityRobotEnergyStateWithComponentOverrideV1({
      state: createLiveEntityRobotEnergyStateV1(NOW_MS),
      position: area.anchor,
      robotComponent: {
        internal_battery_charge: 0,
        internal_battery_capacity: 100,
        last_update: NOW_MS / 1000,
      },
      nowMs: NOW_MS,
      hasStoredState: false,
    });
    const recharged = rechargeLiveEntityRobotEnergyV1(depleted, {
      robotId,
      areaId: area.areaId,
      nowMs: NOW_MS + 10_000,
      amount: 40,
    }).state;

    const staleComponent = liveEntityRobotEnergyStateWithComponentOverrideV1({
      state: recharged,
      position: area.anchor,
      robotComponent: {
        internal_battery_charge: 0,
        internal_battery_capacity: 100,
        last_update: NOW_MS / 1000,
      },
      nowMs: NOW_MS + 10_000,
      hasStoredState: true,
    });

    assert.equal(staleComponent.robots[robotId].energy, 40);
    assert.equal(staleComponent.areas[area.areaId].safeFromMuck, true);
  });
});
