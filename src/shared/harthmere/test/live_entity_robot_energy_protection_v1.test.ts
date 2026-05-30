/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1,
  createLiveEntityRobotEnergyStateV1,
  canLiveEntityRobotMoveV1,
  isLiveEntityRobotProtectionAnchorGroundedV1,
  liveEntityRobotEnergyDisplayV1,
  liveEntityRobotDefaultRobotIdForAreaV1,
  liveEntityRobotProtectionAreaForPositionV1,
  liveEntityRobotProtectionBuildingMarkerV1,
  liveEntityRobotRechargeRewardTextV1,
  rechargeLiveEntityRobotEnergyV1,
  tickLiveEntityRobotEnergyV1,
  validateLiveEntityRobotProtectionAreasV1,
} from "../live_entity_robot_energy_protection_v1";
import {
  isLiveEntityHelperPositionInMuckBreachAreaV1,
  isLiveEntityHelperQuestExcludedPositionV1,
} from "../live_entity_helper_quests_v1";
import {
  SNAPSHOT_DANGER_AREAS_V74,
  SNAPSHOT_HARTHMERE_MUCK_ZONES_V74,
  authoredSnapshotAreaForPointV74,
} from "../snapshot_runtime_rules_v74";

const NOW_MS = 1_700_000_000_000;
const ONE_HOUR_MS = 3_600_000;

function knownMuckOrDangerAreaForPosition(position: [number, number, number]) {
  return (
    authoredSnapshotAreaForPointV74(position, SNAPSHOT_HARTHMERE_MUCK_ZONES_V74) ??
    authoredSnapshotAreaForPointV74(position, SNAPSHOT_DANGER_AREAS_V74) ??
    (isLiveEntityHelperPositionInMuckBreachAreaV1(position)
      ? { id: "west_muck_breach" }
      : undefined)
  );
}

describe("live_entity_robot_energy_protection_v1", () => {
  it("maps grounded robot protection boundaries outside the Grove and Harthmere", () => {
    assert.deepEqual(validateLiveEntityRobotProtectionAreasV1(), []);
    assert.equal(LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1.length, 4);
    for (const area of LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1) {
      assert.equal(
        isLiveEntityHelperQuestExcludedPositionV1(area.anchor),
        false,
        `${area.areaId} must not be inside the Grove or shifted Harthmere`
      );
      assert.ok(
        knownMuckOrDangerAreaForPosition(area.anchor),
        `${area.areaId} should sit on an authored Muck or danger area`
      );
      assert.equal(
        isLiveEntityRobotProtectionAnchorGroundedV1(area),
        true,
        `${area.areaId} marker must be grounded on the authored terrain`
      );
      assert.equal(
        liveEntityRobotProtectionAreaForPositionV1(area.anchor)?.areaId,
        area.areaId
      );
    }
  });

  it("starts each protected area with a charged robot and safe-zone marker", () => {
    const state = createLiveEntityRobotEnergyStateV1(NOW_MS);
    for (const area of LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1) {
      const robotId = liveEntityRobotDefaultRobotIdForAreaV1(area.areaId);
      const robot = state.robots[robotId];
      assert.ok(robot, `${area.areaId} should have a sentinel robot`);
      assert.equal(robot.energy, robot.maxEnergy);
      assert.equal(robot.status, "charged");
      assert.equal(state.areas[area.areaId].safeFromMuck, true);
      const marker = liveEntityRobotProtectionBuildingMarkerV1(
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
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[0];
    const robotId = liveEntityRobotDefaultRobotIdForAreaV1(area.areaId);
    const initial = createLiveEntityRobotEnergyStateV1(NOW_MS);
    const result = tickLiveEntityRobotEnergyV1(initial, {
      nowMs: NOW_MS + ONE_HOUR_MS,
      drainPerHour: 100,
      robotIds: [robotId],
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.state.robots[robotId].energy, 0);
    assert.equal(result.state.robots[robotId].status, "depleted");
    assert.equal(canLiveEntityRobotMoveV1(result.state, robotId), false);
    assert.equal(
      liveEntityRobotEnergyDisplayV1(result.state, robotId)
        ?.needsRechargeText,
      "Needs 1 Stabilized Exotic Matter to restore protection."
    );
    assert.equal(
      liveEntityRobotEnergyDisplayV1(result.state, robotId)?.rewardText,
      "Reward: 90 XP, 1 Black Anvil Repair Voucher, 2 Minor Healing Salves."
    );
    assert.equal(result.state.areas[area.areaId].status, "mucked");
    assert.equal(result.state.areas[area.areaId].safeFromMuck, false);
    const marker = liveEntityRobotProtectionBuildingMarkerV1(
      area,
      result.state,
      NOW_MS + ONE_HOUR_MS
    );
    assert.equal(marker.kind, "muck_boundary");
    assert.equal(marker.markerId, area.muckMarkerId);
    assert.deepEqual(marker.position, area.anchor);
  });

  it("recharges a depleted robot and restores protection", () => {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[0];
    const robotId = liveEntityRobotDefaultRobotIdForAreaV1(area.areaId);
    const depleted = tickLiveEntityRobotEnergyV1(
      createLiveEntityRobotEnergyStateV1(NOW_MS),
      {
        nowMs: NOW_MS + ONE_HOUR_MS,
        drainPerHour: 100,
        robotIds: [robotId],
      }
    ).state;
    const result = rechargeLiveEntityRobotEnergyV1(depleted, {
      robotId,
      areaId: area.areaId,
      nowMs: NOW_MS + ONE_HOUR_MS + 1_000,
      amount: 40,
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.state.robots[robotId].energy, 40);
    assert.equal(result.state.robots[robotId].status, "charged");
    assert.equal(canLiveEntityRobotMoveV1(result.state, robotId), true);
    assert.match(
      liveEntityRobotEnergyDisplayV1(result.state, robotId)?.statusText ?? "",
      /40\/100 energy/
    );
    assert.equal(result.state.areas[area.areaId].status, "protected");
    assert.equal(result.state.areas[area.areaId].safeFromMuck, true);
    const marker = liveEntityRobotProtectionBuildingMarkerV1(
      area,
      result.state,
      NOW_MS + ONE_HOUR_MS + 1_000
    );
    assert.equal(marker.kind, "safe_zone");
    assert.equal(marker.markerId, area.protectedMarkerId);
  });

  it("keeps an area protected until every robot assigned there is depleted", () => {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[1];
    const defaultRobotId = liveEntityRobotDefaultRobotIdForAreaV1(area.areaId);
    const secondRobotId = "field-robot-watchtower-backup";
    const withBackup = rechargeLiveEntityRobotEnergyV1(
      createLiveEntityRobotEnergyStateV1(NOW_MS),
      {
        robotId: secondRobotId,
        areaId: area.areaId,
        nowMs: NOW_MS,
        amount: 40,
        displayName: "Watchtower Backup Robot",
      }
    ).state;
    const defaultDepleted = tickLiveEntityRobotEnergyV1(withBackup, {
      nowMs: NOW_MS + ONE_HOUR_MS,
      drainPerHour: 100,
      robotIds: [defaultRobotId],
    }).state;
    assert.equal(defaultDepleted.areas[area.areaId].safeFromMuck, true);
    const allDepleted = tickLiveEntityRobotEnergyV1(defaultDepleted, {
      nowMs: NOW_MS + ONE_HOUR_MS * 2,
      drainPerHour: 100,
      robotIds: [secondRobotId],
    }).state;
    assert.equal(allDepleted.areas[area.areaId].safeFromMuck, false);
  });

  it("handles boundary edges without leaking into nearby settlements", () => {
    for (const area of LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1) {
      assert.equal(
        liveEntityRobotProtectionAreaForPositionV1([
          area.bounds.minX,
          area.groundY,
          area.bounds.minZ,
        ])?.areaId,
        area.areaId
      );
      assert.equal(
        liveEntityRobotProtectionAreaForPositionV1([
          area.bounds.maxX,
          area.groundY,
          area.bounds.maxZ,
        ])?.areaId,
        area.areaId
      );
      assert.equal(
        liveEntityRobotProtectionAreaForPositionV1([
          area.bounds.maxX + 0.1,
          area.groundY,
          area.bounds.maxZ + 0.1,
        ]),
        undefined
      );
    }
  });

  it("rejects recharge without a known robot area and clamps overfill", () => {
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[2];
    const robotId = liveEntityRobotDefaultRobotIdForAreaV1(area.areaId);
    const full = createLiveEntityRobotEnergyStateV1(NOW_MS);
    const rejected = rechargeLiveEntityRobotEnergyV1(full, {
      robotId: "unknown-robot",
      nowMs: NOW_MS,
      amount: 40,
    });
    assert.deepEqual(rejected.warnings, [
      "live_entity_robot_rejected:known_area_required",
    ]);
    assert.equal(rejected.state, full);

    const depleted = tickLiveEntityRobotEnergyV1(full, {
      nowMs: NOW_MS + ONE_HOUR_MS,
      drainPerHour: 100,
      robotIds: [robotId],
    }).state;
    const overfilled = rechargeLiveEntityRobotEnergyV1(depleted, {
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
    const text = liveEntityRobotRechargeRewardTextV1();
    assert.equal(
      text,
      "Reward: 90 XP, 1 Black Anvil Repair Voucher, 2 Minor Healing Salves."
    );
    assert.equal(/repair_voucher|minor_healing_salve|debug|developer|server/i.test(text), false);
  });
});
