/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS,
  createLiveEntityRobotEnergyState,
  canLiveEntityRobotMove,
  isLiveEntityRobotProtectionAnchorGrounded,
  liveEntityRobotEnergyDisplay,
  liveEntityRobotDefaultRobotIdForArea,
  liveEntityRobotProtectionAreaForPosition,
  liveEntityRobotProtectionBuildingMarker,
  liveEntityRobotRechargeRewardText,
  rechargeLiveEntityRobotEnergy,
  tickLiveEntityRobotEnergy,
  validateLiveEntityRobotProtectionAreas,
} from "../live_entity_robot_energy_protection";
import {
  isLiveEntityHelperPositionInMuckBreachArea,
  isLiveEntityHelperQuestExcludedPosition,
} from "../live_entity_helper_quests";
import {
  SNAPSHOT_DANGER_AREAS,
  SNAPSHOT_HARTHMERE_MUCK_ZONES,
  authoredSnapshotAreaForPoint,
} from "../snapshot_runtime_rules";

const NOW_MS = 1_700_000_000_000;
const ONE_HOUR_MS = 3_600_000;

function knownMuckOrDangerAreaForPosition(position: [number, number, number]) {
  return (
    authoredSnapshotAreaForPoint(position, SNAPSHOT_HARTHMERE_MUCK_ZONES) ??
    authoredSnapshotAreaForPoint(position, SNAPSHOT_DANGER_AREAS) ??
    (isLiveEntityHelperPositionInMuckBreachArea(position)
      ? { id: "west_muck_breach" }
      : undefined)
  );
}

describe("live_entity_robot_energy_protection", () => {
  it("maps grounded robot protection boundaries outside the Grove and Harthmere", () => {
    assert.deepEqual(validateLiveEntityRobotProtectionAreas(), []);
    assert.equal(LIVE_ENTITY_ROBOT_PROTECTION_AREAS.length, 4);
    for (const area of LIVE_ENTITY_ROBOT_PROTECTION_AREAS) {
      assert.equal(
        isLiveEntityHelperQuestExcludedPosition(area.anchor),
        false,
        `${area.areaId} must not be inside the Grove or shifted Harthmere`
      );
      assert.ok(
        knownMuckOrDangerAreaForPosition(area.anchor),
        `${area.areaId} should sit on an authored Muck or danger area`
      );
      assert.equal(
        isLiveEntityRobotProtectionAnchorGrounded(area),
        true,
        `${area.areaId} marker must be grounded on the authored terrain`
      );
      assert.equal(
        liveEntityRobotProtectionAreaForPosition(area.anchor)?.areaId,
        area.areaId
      );
    }
  });

  it("starts each protected area with a charged robot and safe-zone marker", () => {
    const state = createLiveEntityRobotEnergyState(NOW_MS);
    for (const area of LIVE_ENTITY_ROBOT_PROTECTION_AREAS) {
      const robotId = liveEntityRobotDefaultRobotIdForArea(area.areaId);
      const robot = state.robots[robotId];
      assert.ok(robot, `${area.areaId} should have a sentinel robot`);
      assert.equal(robot.energy, robot.maxEnergy);
      assert.equal(robot.status, "charged");
      assert.equal(state.areas[area.areaId].safeFromMuck, true);
      const marker = liveEntityRobotProtectionBuildingMarker(
        area,
        state,
        NOW_MS
      );
      assert.equal(marker.kind, "safe_zone");
      assert.equal(marker.markerId, area.protectedMarkerId);
      assert.deepEqual(marker.position, area.anchor);
      assert.equal(marker.label.includes("_"), false);
    }
  });

  it("depletes robot energy and turns its area into Muck", () => {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS[0];
    const robotId = liveEntityRobotDefaultRobotIdForArea(area.areaId);
    const initial = createLiveEntityRobotEnergyState(NOW_MS);
    const result = tickLiveEntityRobotEnergy(initial, {
      nowMs: NOW_MS + ONE_HOUR_MS,
      drainPerHour: 100,
      robotIds: [robotId],
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.state.robots[robotId].energy, 0);
    assert.equal(result.state.robots[robotId].status, "depleted");
    assert.equal(canLiveEntityRobotMove(result.state, robotId), false);
    assert.equal(
      liveEntityRobotEnergyDisplay(result.state, robotId)
        ?.needsRechargeText,
      "Needs 1 Stabilized Exotic Matter to restore protection."
    );
    assert.equal(
      liveEntityRobotEnergyDisplay(result.state, robotId)?.rewardText,
      "Reward: 90 XP, 1 Black Anvil Repair Voucher, 2 Minor Healing Salves."
    );
    assert.equal(result.state.areas[area.areaId].status, "mucked");
    assert.equal(result.state.areas[area.areaId].safeFromMuck, false);
    const marker = liveEntityRobotProtectionBuildingMarker(
      area,
      result.state,
      NOW_MS + ONE_HOUR_MS
    );
    assert.equal(marker.kind, "muck_boundary");
    assert.equal(marker.markerId, area.muckMarkerId);
    assert.deepEqual(marker.position, area.anchor);
  });

  it("recharges a depleted robot and restores protection", () => {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS[0];
    const robotId = liveEntityRobotDefaultRobotIdForArea(area.areaId);
    const depleted = tickLiveEntityRobotEnergy(
      createLiveEntityRobotEnergyState(NOW_MS),
      {
        nowMs: NOW_MS + ONE_HOUR_MS,
        drainPerHour: 100,
        robotIds: [robotId],
      }
    ).state;
    const result = rechargeLiveEntityRobotEnergy(depleted, {
      robotId,
      areaId: area.areaId,
      nowMs: NOW_MS + ONE_HOUR_MS + 1_000,
      amount: 40,
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.state.robots[robotId].energy, 40);
    assert.equal(result.state.robots[robotId].status, "charged");
    assert.equal(canLiveEntityRobotMove(result.state, robotId), true);
    assert.match(
      liveEntityRobotEnergyDisplay(result.state, robotId)?.statusText ?? "",
      /40\/100 energy/
    );
    assert.equal(result.state.areas[area.areaId].status, "protected");
    assert.equal(result.state.areas[area.areaId].safeFromMuck, true);
    const marker = liveEntityRobotProtectionBuildingMarker(
      area,
      result.state,
      NOW_MS + ONE_HOUR_MS + 1_000
    );
    assert.equal(marker.kind, "safe_zone");
    assert.equal(marker.markerId, area.protectedMarkerId);
  });

  it("keeps an area protected until every robot assigned there is depleted", () => {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS[1];
    const defaultRobotId = liveEntityRobotDefaultRobotIdForArea(area.areaId);
    const secondRobotId = "field-robot-watchtower-backup";
    const withBackup = rechargeLiveEntityRobotEnergy(
      createLiveEntityRobotEnergyState(NOW_MS),
      {
        robotId: secondRobotId,
        areaId: area.areaId,
        nowMs: NOW_MS,
        amount: 40,
        displayName: "Watchtower Backup Robot",
      }
    ).state;
    const defaultDepleted = tickLiveEntityRobotEnergy(withBackup, {
      nowMs: NOW_MS + ONE_HOUR_MS,
      drainPerHour: 100,
      robotIds: [defaultRobotId],
    }).state;
    assert.equal(defaultDepleted.areas[area.areaId].safeFromMuck, true);
    const allDepleted = tickLiveEntityRobotEnergy(defaultDepleted, {
      nowMs: NOW_MS + ONE_HOUR_MS * 2,
      drainPerHour: 100,
      robotIds: [secondRobotId],
    }).state;
    assert.equal(allDepleted.areas[area.areaId].safeFromMuck, false);
  });

  it("handles boundary edges without leaking into nearby settlements", () => {
    for (const area of LIVE_ENTITY_ROBOT_PROTECTION_AREAS) {
      assert.equal(
        liveEntityRobotProtectionAreaForPosition([
          area.bounds.minX,
          area.groundY,
          area.bounds.minZ,
        ])?.areaId,
        area.areaId
      );
      assert.equal(
        liveEntityRobotProtectionAreaForPosition([
          area.bounds.maxX,
          area.groundY,
          area.bounds.maxZ,
        ])?.areaId,
        area.areaId
      );
      assert.equal(
        liveEntityRobotProtectionAreaForPosition([
          area.bounds.maxX + 0.1,
          area.groundY,
          area.bounds.maxZ + 0.1,
        ]),
        undefined
      );
    }
  });

  it("rejects recharge without a known robot area and clamps overfill", () => {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS[2];
    const robotId = liveEntityRobotDefaultRobotIdForArea(area.areaId);
    const full = createLiveEntityRobotEnergyState(NOW_MS);
    const rejected = rechargeLiveEntityRobotEnergy(full, {
      robotId: "unknown-robot",
      nowMs: NOW_MS,
      amount: 40,
    });
    assert.deepEqual(rejected.warnings, [
      "live_entity_robot_rejected:known_area_required",
    ]);
    assert.equal(rejected.state, full);

    const depleted = tickLiveEntityRobotEnergy(full, {
      nowMs: NOW_MS + ONE_HOUR_MS,
      drainPerHour: 100,
      robotIds: [robotId],
    }).state;
    const overfilled = rechargeLiveEntityRobotEnergy(depleted, {
      robotId,
      areaId: area.areaId,
      nowMs: NOW_MS + ONE_HOUR_MS + 1_000,
      amount: 500,
    }).state;
    assert.equal(
      overfilled.robots[robotId].energy,
      overfilled.robots[robotId].maxEnergy
    );
  });

  it("uses player-facing reward copy without internal item casing", () => {
    const text = liveEntityRobotRechargeRewardText();
    assert.equal(
      text,
      "Reward: 90 XP, 1 Black Anvil Repair Voucher, 2 Minor Healing Salves."
    );
    assert.equal(/repair_voucher|minor_healing_salve|debug|developer|server/i.test(text), false);
  });
});
