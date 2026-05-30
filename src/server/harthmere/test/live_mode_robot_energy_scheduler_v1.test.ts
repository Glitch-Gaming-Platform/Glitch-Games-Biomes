import assert from "assert";
import {
  buildHarthmereLiveEntityProductionSeedChangesV1,
  buildHarthmereLiveEntityProductionSeedProposedChangesV1,
  harthmereLiveEntityProductionSeedIdsV1,
} from "../live_entity_ecs_seed_v1";
import {
  readOrSeedHarthmereLiveModeRobotProtectionSharedStateV1,
  runHarthmereLiveModeRobotEnergySchedulerTickV1,
} from "../live_mode_robot_energy_scheduler_v1";
import {
  createHarthmereLiveModeSharedWorldStateV1,
  defaultHarthmereLiveModeBackendStateV1,
  harthmereLiveModeSharedWorldStateKeyV1,
  parseHarthmereLiveModeSharedWorldStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import {
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1,
  liveEntityRobotDefaultRobotIdForAreaV1,
} from "@/shared/harthmere/live_entity_robot_energy_protection_v1";
import {
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1,
  HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS_V1,
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1,
  validateHarthmereLiveEntityProductionSeedsV1,
} from "@/shared/harthmere/live_entity_production_seed_v1";
import { muckMonsterAreaForPositionV1 } from "@/shared/harthmere/muck_monster_aggression_ai_v1";

const NOW_MS = 1_700_600_000_000;

class FakeRedisPrimary {
  readonly store = new Map<string, string>();
  readonly writes: Array<{ key: string; value: string }> = [];

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.writes.push({ key, value });
    this.store.set(key, value);
    return "OK";
  }
}

describe("Harthmere live entity production seeds", () => {
  it("validates robot sentinels and ambient Muck monsters for production seeding", () => {
    assert.deepEqual(validateHarthmereLiveEntityProductionSeedsV1(), []);
    assert.equal(
      HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1.length,
      LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1.length
    );
    assert.equal(
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.length,
      LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1.length
    );
    assert.equal(
      new Set(harthmereLiveEntityProductionSeedIdsV1()).size,
      HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS_V1.length
    );
    for (const seed of HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1) {
      assert.ok(
        muckMonsterAreaForPositionV1(seed.position, 1.5),
        `${seed.displayName} should be inside an authored Muck territory`
      );
    }
  });

  it("builds ECS robot components and Muck entities for snapshot bootstrap", () => {
    const changes = buildHarthmereLiveEntityProductionSeedChangesV1({
      tick: 77,
      nowSeconds: 1234,
      existingIds: new Set(),
    });
    assert.equal(
      changes.length,
      HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS_V1.length
    );
    const robotChange = changes.find(
      (change) =>
        change.kind !== "delete" &&
        change.entity.id === HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1[0].entityId
    );
    assert.ok(robotChange && robotChange.kind !== "delete");
    assert.equal(robotChange.tick, 77);
    assert.equal(robotChange.entity.robot_component?.internal_battery_charge, 100);
    assert.equal(robotChange.entity.entity_description?.text.includes("_"), false);

    const proposed = buildHarthmereLiveEntityProductionSeedProposedChangesV1({
      nowSeconds: 1234,
      existingIds: new Set([HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1[0].entityId]),
    });
    assert.equal(proposed[0].kind, "update");
  });
});

describe("Harthmere robot energy scheduler", () => {
  it("bootstraps robot protection into shared Redis when no world state exists", async () => {
    const redis = { primary: new FakeRedisPrimary() };
    const result = await readOrSeedHarthmereLiveModeRobotProtectionSharedStateV1({
      redis,
      nowMs: NOW_MS,
    });

    assert.equal(result.seededSharedState, true);
    assert.equal(result.sharedWorldStateKey, harthmereLiveModeSharedWorldStateKeyV1());
    assert.equal(redis.primary.writes.length, 1);
    for (const area of LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1) {
      assert.equal(result.robotProtection.areas[area.areaId].safeFromMuck, true);
    }
  });

  it("drains shared robot energy on the server schedule and persists Muck state", async () => {
    const redis = { primary: new FakeRedisPrimary() };
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1[1];
    const robotId = liveEntityRobotDefaultRobotIdForAreaV1(area.areaId);
    const sharedSource = defaultHarthmereLiveModeBackendStateV1(
      "shared_robot_source",
      NOW_MS - 3_600_000
    );
    sharedSource.robotProtection.robots[robotId].lastTickAtMs =
      NOW_MS - 3_600_000;
    redis.primary.store.set(
      harthmereLiveModeSharedWorldStateKeyV1(),
      JSON.stringify(
        createHarthmereLiveModeSharedWorldStateV1(
          sharedSource,
          NOW_MS - 3_600_000
        )
      )
    );

    const result = await runHarthmereLiveModeRobotEnergySchedulerTickV1({
      redis,
      nowMs: NOW_MS,
      drainPerHour: 100,
    });

    assert.equal(result.seededSharedState, false);
    assert.ok(result.changedRobotIds.includes(robotId));
    assert.ok(result.changedAreaIds.includes(area.areaId));
    assert.equal(result.robotProtection.robots[robotId].energy, 0);
    assert.equal(result.robotProtection.areas[area.areaId].status, "mucked");
    assert.equal(result.summary.touchedModels.includes("robot_protection"), true);

    const persisted = parseHarthmereLiveModeSharedWorldStateV1(
      redis.primary.store.get(harthmereLiveModeSharedWorldStateKeyV1()),
      NOW_MS
    );
    assert.equal(persisted?.robotProtection.robots[robotId].energy, 0);
    assert.equal(persisted?.robotProtection.areas[area.areaId].safeFromMuck, false);
  });
});
