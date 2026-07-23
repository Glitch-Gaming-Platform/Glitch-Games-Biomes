import assert from "assert";
import {
  buildHarthmereLiveEntityProductionSeedChanges,
  buildHarthmereLiveEntityProductionSeedProposedChanges,
  harthmereLiveEntityProductionSeedIds,
} from "../live_entity_ecs_seed";
import {
  buildHarthmereGroveRaceMinigameSeedChanges,
  buildHarthmereGroveRaceMinigameSeedProposedChanges,
  harthmereGroveRaceMinigameSeedIds,
} from "../grove_race_minigame_ecs_seed";
import {
  readOrSeedHarthmereLiveModeRobotProtectionSharedState,
  runHarthmereLiveModeRobotEnergySchedulerTick,
  syncHarthmereRobotEnergyStateToEcs,
} from "../live_mode_robot_energy_scheduler";
import {
  createHarthmereServerMuckCombatEntitySnapshots,
  createHarthmereLiveModeSharedWorldState,
  defaultHarthmereLiveModeBackendState,
  harthmereLiveModeSharedWorldStateKey,
  parseHarthmereLiveModeSharedWorldState,
} from "@/shared/harthmere/live_mode_backend";
import {
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS,
  liveEntityRobotDefaultRobotIdForArea,
} from "@/shared/harthmere/live_entity_robot_energy_protection";
import {
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS,
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT,
  HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS,
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS,
  validateHarthmereLiveEntityProductionSeeds,
} from "@/shared/harthmere/live_entity_production_seed";
import {
  HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS,
  HARTHMERE_GROVE_RACE_MINIGAME_ID,
  HARTHMERE_GROVE_RACE_MINIGAME_LABEL,
  HARTHMERE_GROVE_RACE_MINIGAME_SEED_IDS,
  HARTHMERE_GROVE_RACE_START_POSITION,
  validateHarthmereGroveRaceMinigameSeeds,
} from "@/shared/harthmere/grove_race_minigame_seed";
import { BikkieIds } from "@/shared/bikkie/ids";
import { muckMonsterAreaForPosition } from "@/shared/harthmere/muck_monster_aggression_ai";
import { InMemoryWorld } from "@/server/shared/world/shim/in_memory_world";
import { ShimWorldApi } from "@/server/shared/world/shim/api";
import { harthmereNativeNpcCombatProfileForSeed } from "@/shared/harthmere/harthmere_native_combat";

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
    assert.deepEqual(validateHarthmereLiveEntityProductionSeeds(), []);
    assert.equal(
      HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS.length,
      LIVE_ENTITY_ROBOT_PROTECTION_AREAS.length
    );
    assert.equal(
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.length,
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT
    );
    assert.ok(
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.some(
        (seed) => seed.combatKind === "hex"
      ),
      "production hostile seed manifest should include Hexes"
    );
    assert.equal(
      new Set(harthmereLiveEntityProductionSeedIds()).size,
      HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS.length
    );
    for (const seed of HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS) {
      assert.ok(
        muckMonsterAreaForPosition(seed.position, 1.5),
        `${seed.displayName} should be inside an authored Muck territory`
      );
    }
    for (const area of LIVE_ENTITY_ROBOT_PROTECTION_AREAS) {
      assert.ok(
        HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.some(
          (seed) => seed.areaId === area.areaId
        ),
        `${area.areaId} should have at least one server hostile seed`
      );
    }
  });

  it("seeds server combat snapshots for Muck territory Muckers, Hexes, and passive wildlife", () => {
    const snapshots = createHarthmereServerMuckCombatEntitySnapshots(NOW_MS);
    const entries = Object.entries(snapshots);
    const muckEntries = entries.filter(
      ([, snapshot]) =>
        snapshot.entityKind === "mux" || snapshot.entityKind === "hex"
    );
    const animalEntries = entries.filter(
      ([, snapshot]) => snapshot.entityKind === "animal"
    );

    // Every authored Muck monster is present, plus the wildlife herd.
    assert.equal(
      muckEntries.length,
      HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.length
    );
    assert.ok(animalEntries.length >= 16, "expected the wildlife herd");
    assert.equal(entries.length, muckEntries.length + animalEntries.length);
    assert.ok(entries.some(([, snapshot]) => snapshot.entityKind === "mux"));
    assert.ok(entries.some(([, snapshot]) => snapshot.entityKind === "hex"));

    for (const [entityId, snapshot] of entries) {
      assert.ok(entityId.startsWith("server-muck-combat:"));
      assert.ok(snapshot.isAttackable);
      assert.ok(snapshot.aiEnabled);
      assert.ok(
        muckMonsterAreaForPosition(
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

    const defaultState = defaultHarthmereLiveModeBackendState(
      "server-muck-combat-test",
      NOW_MS
    );
    assert.equal(
      Object.keys(defaultState.combat.entitySnapshots).length,
      entries.length
    );
  });

  it("builds ECS robots, creatures, wildlife, and bandits for snapshot bootstrap", () => {
    const changes = buildHarthmereLiveEntityProductionSeedChanges({
      tick: 77,
      nowSeconds: 1234,
      existingIds: new Set(),
    });
    assert.equal(changes.length, HARTHMERE_LIVE_ENTITY_PRODUCTION_SEEDS.length);
    for (const change of changes) {
      assert.notEqual(change.kind, "delete");
      if (change.kind === "delete") continue;
      assert.ok(
        change.entity.position?.v.every(Number.isFinite),
        `seed ${change.entity.id} needs a finite authoritative position`
      );
      if (!change.entity.robot_component) {
        assert.deepEqual(
          change.entity.npc_metadata?.spawn_position,
          change.entity.position?.v,
          `creature ${change.entity.id} must respawn at its exact grounded anchor`
        );
      }
    }
    const robotChange = changes.find(
      (change) =>
        change.kind !== "delete" &&
        change.entity.id ===
          HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS[0].entityId
    );
    assert.ok(robotChange && robotChange.kind !== "delete");
    assert.equal(robotChange.tick, 77);
    assert.equal(
      robotChange.entity.npc_metadata?.type_id,
      harthmereNativeNpcCombatProfileForSeed(
        HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS[0]
      ).id
    );
    assert.equal(
      robotChange.entity.robot_component?.internal_battery_charge,
      100
    );
    assert.equal(
      robotChange.entity.entity_description?.text.includes("_"),
      false
    );

    const proposed = buildHarthmereLiveEntityProductionSeedProposedChanges({
      nowSeconds: 1234,
      existingIds: new Set([
        HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS[0].entityId,
      ]),
    });
    assert.equal(proposed[0].kind, "update");
  });

  it("syncs scheduled robot energy into native ECS robot components", async () => {
    const world = new InMemoryWorld();
    world.writeableTable.apply(
      buildHarthmereLiveEntityProductionSeedChanges({
        tick: world.table.tick,
        nowSeconds: NOW_MS / 1000,
        existingIds: new Set(),
      })
    );
    const state = defaultHarthmereLiveModeBackendState(
      "robot-ecs-sync",
      NOW_MS
    ).robotProtection;
    const seed = HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS[0];
    state.robots[seed.robotId].energy = 37;
    state.robots[seed.robotId].status = "low";

    const synced = await syncHarthmereRobotEnergyStateToEcs({
      worldApi: ShimWorldApi.createForWorld(world),
      robotProtection: state,
      nowMs: NOW_MS + 1_000,
    });
    assert.ok(synced.includes(seed.robotId));
    assert.equal(
      world.table.get(seed.entityId)?.robot_component?.internal_battery_charge,
      37
    );
  });
});

describe("Harthmere Grove race minigame seed", () => {
  it("builds a ready simple race at the requested Grove coordinate", () => {
    assert.deepEqual(validateHarthmereGroveRaceMinigameSeeds(), []);
    assert.equal(
      new Set(harthmereGroveRaceMinigameSeedIds()).size,
      HARTHMERE_GROVE_RACE_MINIGAME_SEED_IDS.length
    );

    const changes = buildHarthmereGroveRaceMinigameSeedChanges({
      tick: 88,
      nowSeconds: 1234,
      existingIds: new Set(),
    });
    assert.equal(changes.length, HARTHMERE_GROVE_RACE_MINIGAME_SEED_IDS.length);

    const minigameChange = changes.find(
      (change) =>
        change.kind !== "delete" &&
        change.entity.id === HARTHMERE_GROVE_RACE_MINIGAME_ID
    );
    assert.ok(minigameChange && minigameChange.kind !== "delete");
    assert.equal(minigameChange.tick, 88);
    assert.equal(
      minigameChange.entity.label?.text,
      HARTHMERE_GROVE_RACE_MINIGAME_LABEL
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

    const startSeed = HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS.find(
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
      HARTHMERE_GROVE_RACE_START_POSITION
    );
    assert.equal(
      startChange.entity.placeable_component?.item_id,
      BikkieIds.simpleRaceStart
    );
    assert.equal(
      startChange.entity.minigame_element?.minigame_id,
      HARTHMERE_GROVE_RACE_MINIGAME_ID
    );

    for (const seed of HARTHMERE_GROVE_RACE_MINIGAME_ELEMENTS) {
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
        HARTHMERE_GROVE_RACE_MINIGAME_ID
      );
    }

    const proposed = buildHarthmereGroveRaceMinigameSeedProposedChanges({
      nowSeconds: 1234,
      existingIds: new Set([HARTHMERE_GROVE_RACE_MINIGAME_ID]),
    });
    assert.equal(proposed[0].kind, "update");
  });
});

describe("Harthmere robot energy scheduler", () => {
  it("requires transactional Redis writes for backend authority state", async () => {
    const redis = {
      primary: {
        get: async () => null,
      },
    } as any;

    await assert.rejects(
      () =>
        readOrSeedHarthmereLiveModeRobotProtectionSharedState({
          redis,
          nowMs: NOW_MS,
        }),
      /requires Redis WATCH\/MULTI/
    );
    await assert.rejects(
      () =>
        runHarthmereLiveModeRobotEnergySchedulerTick({
          redis,
          nowMs: NOW_MS,
        }),
      /requires Redis WATCH\/MULTI/
    );
  });

  it("bootstraps robot protection into shared Redis when no world state exists", async () => {
    const redis = { primary: new FakeRedisPrimary() };
    const result = await readOrSeedHarthmereLiveModeRobotProtectionSharedState({
      redis,
      nowMs: NOW_MS,
    });

    assert.equal(result.seededSharedState, true);
    assert.equal(
      result.sharedWorldStateKey,
      harthmereLiveModeSharedWorldStateKey()
    );
    assert.deepEqual(redis.primary.watched, [
      [harthmereLiveModeSharedWorldStateKey()],
    ]);
    assert.equal(redis.primary.writes.length, 1);
    for (const area of LIVE_ENTITY_ROBOT_PROTECTION_AREAS) {
      assert.equal(
        result.robotProtection.areas[area.areaId].safeFromMuck,
        true
      );
    }
  });

  it("drains shared robot energy on the server schedule and persists Muck state", async () => {
    const redis = { primary: new FakeRedisPrimary() };
    const area = LIVE_ENTITY_ROBOT_PROTECTION_AREAS[1];
    const robotId = liveEntityRobotDefaultRobotIdForArea(area.areaId);
    const sharedSource = defaultHarthmereLiveModeBackendState(
      "shared_robot_source",
      NOW_MS - 3_600_000
    );
    sharedSource.robotProtection.robots[robotId].lastTickAtMs =
      NOW_MS - 3_600_000;
    redis.primary.store.set(
      harthmereLiveModeSharedWorldStateKey(),
      JSON.stringify(
        createHarthmereLiveModeSharedWorldState(
          sharedSource,
          NOW_MS - 3_600_000
        )
      )
    );

    const result = await runHarthmereLiveModeRobotEnergySchedulerTick({
      redis,
      nowMs: NOW_MS,
      drainPerHour: 100,
    });

    assert.equal(result.seededSharedState, false);
    assert.deepEqual(redis.primary.watched, [
      [harthmereLiveModeSharedWorldStateKey()],
    ]);
    assert.ok(result.changedRobotIds.includes(robotId));
    assert.ok(result.changedAreaIds.includes(area.areaId));
    assert.equal(result.robotProtection.robots[robotId].energy, 0);
    assert.equal(result.robotProtection.areas[area.areaId].status, "mucked");
    assert.equal(
      result.summary.touchedModels.includes("robot_protection"),
      true
    );

    const persisted = parseHarthmereLiveModeSharedWorldState(
      redis.primary.store.get(harthmereLiveModeSharedWorldStateKey()),
      NOW_MS
    );
    assert.equal(persisted?.robotProtection.robots[robotId].energy, 0);
    assert.equal(
      persisted?.robotProtection.areas[area.areaId].safeFromMuck,
      false
    );
  });
});
