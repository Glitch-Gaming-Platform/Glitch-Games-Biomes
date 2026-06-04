import assert from "assert";
import {
  buildHarthmereLiveEntityProductionSeedChangesV1,
  buildHarthmereLiveEntityProductionSeedProposedChangesV1,
  harthmereLiveEntityProductionSeedIdsV1,
} from "../live_entity_ecs_seed_v1";
import {
  buildHarthmereGroveRaceMinigameSeedChangesV1,
  buildHarthmereGroveRaceMinigameSeedProposedChangesV1,
  harthmereGroveRaceMinigameSeedIdsV1,
} from "../grove_race_minigame_ecs_seed_v1";
import {
  readOrSeedHarthmereLiveModeRobotProtectionSharedStateV1,
  runHarthmereLiveModeRobotEnergySchedulerTickV1,
} from "../live_mode_robot_energy_scheduler_v1";
import {
  createHarthmereServerMuckCombatEntitySnapshotsV1,
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
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT_V1,
  HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS_V1,
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS_V1,
  validateHarthmereLiveEntityProductionSeedsV1,
} from "@/shared/harthmere/live_entity_production_seed_v1";
import {
  HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS_V1,
  HARTHMERE_GROVE_RACE_MINIGAME_ID_V1,
  HARTHMERE_GROVE_RACE_MINIGAME_LABEL_V1,
  HARTHMERE_GROVE_RACE_MINIGAME_SEED_IDS_V1,
  HARTHMERE_GROVE_RACE_START_POSITION_V1,
  validateHarthmereGroveRaceMinigameSeedsV1,
} from "@/shared/harthmere/grove_race_minigame_seed_v1";
import { BikkieIds } from "@/shared/bikkie/ids";
import { muckMonsterAreaForPositionV1 } from "@/shared/harthmere/muck_monster_aggression_ai_v1";

const NOW_MS = 1_700_600_000_000;

class FakeRedisPrimary {
  readonly store = new Map<string, string>();
  readonly writes: Array<{ key: string; value: string }> = [];
  readonly watched: string[][] = [];

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.writes.push({ key, value });
    this.store.set(key, value);
    return "OK";
  }

  async watch(...keys: string[]) {
    this.watched.push(keys);
  }

  async unwatch() {}

  multi() {
    const ops: Array<() => void> = [];
    return {
      set: (key: string, value: string) => {
        ops.push(() => {
          this.writes.push({ key, value });
          this.store.set(key, value);
        });
        return this;
      },
      exec: async () => {
        for (const op of ops) op();
        return [];
      },
    };
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
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT_V1
    );
    assert.ok(
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.some(
        (seed) => seed.combatKind === "hex"
      ),
      "production hostile seed manifest should include Hexes"
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
    for (const area of LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1) {
      assert.ok(
        HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.some(
          (seed) => seed.areaId === area.areaId
        ),
        `${area.areaId} should have at least one server hostile seed`
      );
    }
  });

  it("seeds server combat snapshots for Muck territory Muckers, Hexes, and passive wildlife", () => {
    const snapshots = createHarthmereServerMuckCombatEntitySnapshotsV1(NOW_MS);
    const entries = Object.entries(snapshots);
    const muckEntries = entries.filter(
      ([, snapshot]) =>
        snapshot.entityKind === "mux" || snapshot.entityKind === "hex"
    );
    const animalEntries = entries.filter(
      ([, snapshot]) => snapshot.entityKind === "animal"
    );

    // Every authored Muck monster is present, plus the wildlife herd.
    assert.equal(muckEntries.length, HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS_V1.length);
    assert.ok(animalEntries.length >= 16, "expected the wildlife herd");
    assert.equal(entries.length, muckEntries.length + animalEntries.length);
    assert.ok(entries.some(([, snapshot]) => snapshot.entityKind === "mux"));
    assert.ok(entries.some(([, snapshot]) => snapshot.entityKind === "hex"));

    for (const [entityId, snapshot] of entries) {
      assert.ok(entityId.startsWith("server-muck-combat:"));
      assert.ok(snapshot.isAttackable);
      assert.ok(snapshot.aiEnabled);
      assert.ok(
        muckMonsterAreaForPositionV1(
          [snapshot.position.x, snapshot.position.y, snapshot.position.z],
          1.5
        ),
        `${entityId} should be inside an authored Muck territory`
      );
    }

    // Muckers and hexes are hostile; wildlife is passive but retaliates and
    // drops meat when hunted.
    for (const [, snapshot] of muckEntries) {
      assert.ok(snapshot.isHostile);
    }
    for (const [, snapshot] of animalEntries) {
      assert.equal(snapshot.isHostile, false);
      assert.equal(snapshot.retaliatesWhenAttacked, true);
      assert.ok(Number((snapshot as any).lootDrops?.raw_meat ?? 0) >= 1);
    }

    const defaultState = defaultHarthmereLiveModeBackendStateV1(
      "server-muck-combat-test",
      NOW_MS
    );
    assert.equal(
      Object.keys(defaultState.combat.entitySnapshots).length,
      entries.length
    );
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

describe("Harthmere Grove race minigame seed", () => {
  it("builds a ready simple race at the requested Grove coordinate", () => {
    assert.deepEqual(validateHarthmereGroveRaceMinigameSeedsV1(), []);
    assert.equal(
      new Set(harthmereGroveRaceMinigameSeedIdsV1()).size,
      HARTHMERE_GROVE_RACE_MINIGAME_SEED_IDS_V1.length
    );

    const changes = buildHarthmereGroveRaceMinigameSeedChangesV1({
      tick: 88,
      nowSeconds: 1234,
      existingIds: new Set(),
    });
    assert.equal(
      changes.length,
      HARTHMERE_GROVE_RACE_MINIGAME_SEED_IDS_V1.length
    );

    const minigameChange = changes.find(
      (change) =>
        change.kind !== "delete" &&
        change.entity.id === HARTHMERE_GROVE_RACE_MINIGAME_ID_V1
    );
    assert.ok(minigameChange && minigameChange.kind !== "delete");
    assert.equal(minigameChange.tick, 88);
    assert.equal(
      minigameChange.entity.label?.text,
      HARTHMERE_GROVE_RACE_MINIGAME_LABEL_V1
    );
    assert.equal(minigameChange.entity.minigame_component?.ready, true);
    assert.equal(
      minigameChange.entity.minigame_component?.metadata.kind,
      "simple_race"
    );
    assert.equal(
      minigameChange.entity.minigame_component?.metadata.kind === "simple_race"
        ? minigameChange.entity.minigame_component.metadata.checkpoint_ids.size
        : 0,
      2
    );

    const startSeed = HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS_V1.find(
      (seed) => seed.kind === "start"
    );
    assert.ok(startSeed);
    const startChange = changes.find(
      (change) =>
        change.kind !== "delete" && change.entity.id === startSeed.entityId
    );
    assert.ok(startChange && startChange.kind !== "delete");
    assert.deepEqual(
      startChange.entity.position?.v,
      HARTHMERE_GROVE_RACE_START_POSITION_V1
    );
    assert.equal(
      startChange.entity.placeable_component?.item_id,
      BikkieIds.simpleRaceStart
    );
    assert.equal(
      startChange.entity.minigame_element?.minigame_id,
      HARTHMERE_GROVE_RACE_MINIGAME_ID_V1
    );

    for (const seed of HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS_V1) {
      const elementChange = changes.find(
        (change) =>
          change.kind !== "delete" && change.entity.id === seed.entityId
      );
      assert.ok(elementChange && elementChange.kind !== "delete");
      assert.equal(
        elementChange.entity.placeable_component?.item_id,
        seed.itemId
      );
      assert.equal(
        elementChange.entity.minigame_element?.minigame_id,
        HARTHMERE_GROVE_RACE_MINIGAME_ID_V1
      );
    }

    const proposed = buildHarthmereGroveRaceMinigameSeedProposedChangesV1({
      nowSeconds: 1234,
      existingIds: new Set([HARTHMERE_GROVE_RACE_MINIGAME_ID_V1]),
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
    assert.deepEqual(redis.primary.watched, [
      [harthmereLiveModeSharedWorldStateKeyV1()],
    ]);
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
    assert.deepEqual(redis.primary.watched, [
      [harthmereLiveModeSharedWorldStateKeyV1()],
    ]);
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
