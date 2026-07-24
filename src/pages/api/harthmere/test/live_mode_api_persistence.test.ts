import assert from "assert";
import {
  HARTHMERE_BUILDING_MATERIALIZATION_ECS_PUBLISH_CHUNK_SIZE,
  buildingSystemMaterializationWorldPositionForTest,
  combatActorPositionFromInstallLiveModeBody,
  harthmereLiveModeMutationSnapshotKeys,
  harthmereMutationMayChangeSharedWorldForTest,
  jobsBoardPositionFromLiveModeBody,
  liveModeActorIdentityFromRequest,
  markBuildingMaterializationPlansAppliedForTest,
  materializeBuildingSystemMaterializationPlansToTerrain,
  materializeHarthmereNativeEcsPlans,
  nativeEcsOwnsHarthmereLiveModeActionForTest,
  nativeEcsPhysicalDropNeedsAuthenticatedActorForTest,
  nativeEcsRejectsLegacyFarmingRequestForTest,
  persistHarthmereLiveModeResponse,
  preserveFreshHarthmereLiveModeStatusChannelsForTest,
  publishBuildingSystemMaterializationPlansToEcs,
  readServerActorNativeContextForLiveMode,
  readServerActorPositionForLiveMode,
} from "../live_mode";
import { createEmptyTerrainShard } from "@/server/test/test_helpers";
import { InMemoryWorld } from "@/server/shared/world/shim/in_memory_world";
import { ShimWorldApi } from "@/server/shared/world/shim/api";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import { HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID } from "@/shared/harthmere/mmo_jobs_board_authority";
import { HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS } from "@/shared/harthmere/business_customer_simulator";
import { SHARD_DIM, blockPos, shardAlign } from "@/shared/game/shard";
import {
  createHarthmereLiveModeSharedWorldState,
  bindHarthmereNativeEcsMaterializationPlansToActorForTest,
  harthmereLiveModePlayerStateKey,
  harthmereLiveModeSharedWorldStateKey,
  mergeHarthmereLiveModeSharedWorldStateIntoBackend,
  parseHarthmereLiveModeBackendState,
  defaultHarthmereLiveModeBackendState,
  parseHarthmereLiveModeSharedWorldState,
} from "@/shared/harthmere/live_mode_backend";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";
import {
  buildHarthmereLiveModePersistenceMutationPlan,
  createHarthmereLiveModeEvent,
  createHarthmereLiveModeUiEvent,
  type HarthmereLiveModeAuthorityEnvelope,
} from "@/shared/harthmere/live_mode_readiness";
import { loadBlockWrapper } from "@/shared/wasm/biomes";
import { harthmereJobsBoardQuestMarkerRuntimePositionForId } from "@/shared/harthmere/jobs_board_quest_marker_positions";
import { harthmereItemIdToBiomesId } from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import { Challenges, Inventory, Wearing } from "@/shared/ecs/gen/components";
import { BikkieIds } from "@/shared/bikkie/ids";
import { countOf, createBag } from "@/shared/game/items";
import {
  harthmereNativeQuestId,
  harthmereNativeQuestStepId,
} from "@/shared/harthmere/harthmere_native_quests";

const ACTOR = "player_live_api_persist_001";
const NOW_MS = 1_700_400_000_000;

async function withFullLiveModeMutationSnapshotsForTest(
  fn: () => Promise<void>
) {
  const previous = process.env.HARTHMERE_LIVE_MODE_FULL_MUTATION_SNAPSHOTS;
  process.env.HARTHMERE_LIVE_MODE_FULL_MUTATION_SNAPSHOTS = "1";
  try {
    await fn();
  } finally {
    if (previous === undefined) {
      delete process.env.HARTHMERE_LIVE_MODE_FULL_MUTATION_SNAPSHOTS;
    } else {
      process.env.HARTHMERE_LIVE_MODE_FULL_MUTATION_SNAPSHOTS = previous;
    }
  }
}

function fakeTerrainEntityForPosition(
  id: number,
  position: [number, number, number]
) {
  const shardOrigin = shardAlign(...position);
  return {
    id,
    hasShardSeed: () => true,
    hasBox: () => true,
    box: () => ({
      v0: shardOrigin,
      v1: [
        shardOrigin[0] + SHARD_DIM,
        shardOrigin[1] + SHARD_DIM,
        shardOrigin[2] + SHARD_DIM,
      ],
    }),
  };
}

class FakeRedisPrimary {
  readonly store = new Map<string, string>();
  readonly watched: string[][] = [];
  readonly txOps: string[][] = [];

  async watch(...keys: string[]) {
    this.watched.push(keys);
  }

  async unwatch() {}

  async get(key: string) {
    return this.store.get(key) ?? null;
  }

  multi() {
    const ops: Array<() => void> = [];
    return {
      set: (key: string, value: string) => {
        this.txOps.push(["set", key]);
        ops.push(() => this.store.set(key, value));
        return this;
      },
      del: (key: string) => {
        this.txOps.push(["del", key]);
        ops.push(() => this.store.delete(key));
        return this;
      },
      xadd: (key: string) => {
        this.txOps.push(["xadd", key]);
        ops.push(() => {});
        return this;
      },
      exec: async () => {
        for (const op of ops) op();
        return [];
      },
    };
  }

  async set(key: string, value: string, ...args: unknown[]) {
    if (args.includes("NX") && this.store.has(key)) {
      return null;
    }
    if (!key.includes(":actor_lock:")) {
      this.txOps.push(["direct_set", key]);
    }
    this.store.set(key, value);
    return "OK";
  }

  async eval(
    _script: string,
    _numberOfKeys: number,
    key: string,
    expected: string,
    replacement?: string
  ) {
    if (this.store.get(key) !== expected) return 0;
    if (replacement === undefined) {
      this.store.delete(key);
    } else {
      this.store.set(key, replacement);
    }
    return 1;
  }

  async xadd() {
    return "1-0";
  }
}

function readMergedPersistedState(
  redis: FakeRedisPrimary,
  actorId: string = ACTOR
) {
  const actor = parseHarthmereLiveModeBackendState(
    redis.store.get(harthmereLiveModePlayerStateKey(actorId)),
    actorId,
    NOW_MS
  );
  const shared = parseHarthmereLiveModeSharedWorldState(
    redis.store.get(harthmereLiveModeSharedWorldStateKey()),
    NOW_MS
  );
  return mergeHarthmereLiveModeSharedWorldStateIntoBackend(
    actor,
    shared,
    NOW_MS
  );
}

function envelope(): HarthmereLiveModeAuthorityEnvelope {
  return {
    requestId: "live-api-persist-req-1",
    idempotencyKey: "live-api-persist-idem-1",
    actorId: ACTOR,
    actionKind: "request_xp_reward",
    subsystem: "leveling",
    source: "server_scheduled_tick",
    serverReceivedAtMs: NOW_MS,
    serverTick: 1,
    actorEntityVersion: 1,
    zoneId: "harthmere_wilderness",
    payload: {
      skillId: "combat",
      baseXp: 100,
      sourceLevel: 1,
      contributionScore: 1,
    },
  };
}

function addOpenProductionBusiness(
  state: ReturnType<typeof defaultHarthmereLiveModeBackendState>,
  businessId: string
) {
  state.economy.production.businesses[businessId] = {
    businessId,
    ownerKind: "player",
    ownerId: ACTOR,
    typeId: "food_service_restaurant",
    name: "Persisted Branch Cafe",
    status: "open",
    licenseClass: "basic_trade",
    licenseLevel: 1,
    propertyId: `property_${businessId}`,
    townId: "harthmere_grove",
    regionId: "harthmere_grove_region",
    inventory: {},
    storageMaxSlots: 12,
    employees: [],
    activeContracts: [],
    completedContracts: 0,
    reputation: 20,
    customerSatisfaction: 80,
    sanitationRating: 80,
    safetyRating: 80,
    serviceRadius: 2,
    priceModifiers: {},
    balanceGold: 5_000,
    debtGold: 0,
    upkeepGoldPerDay: 1,
    rentGoldPerDay: 0,
    wageGoldPerDay: 0,
    salesTaxRate: 0.06,
    lastTickAtMs: NOW_MS,
    createdAtMs: NOW_MS,
    updatedAtMs: NOW_MS,
    flags: {},
  } as any;
  state.building.inWorldMarkers[`${businessId}:marker`] = {
    markerId: `${businessId}:marker`,
    plotId: `plot_${businessId}`,
    kind: "business_marker",
    position: [100, 65, 100],
    label: "Persisted Branch Cafe",
    createdAtMs: NOW_MS,
  };
  (state.economy.production.businessSystems as any).customerStats[businessId] =
    {
      businessId,
      totalServed: 55,
      totalFailed: 1,
      lifetimeGold: 2_500,
      bestStreak: 6,
      currentTier: 3,
    };
}

function gameplayMutationWarnings(warnings: string[] | undefined) {
  return (warnings ?? []).filter(
    (warning) =>
      !warning.startsWith("escort_companion_materialization_deferred:")
  );
}

describe("live_mode API Redis persistence", () => {
  it("materializes exact native drops once across retries and deletion", async () => {
    const redisPrimary = new FakeRedisPrimary();
    const world = new InMemoryWorld();
    const worldApi = ShimWorldApi.createForWorld(world);
    let allocations = 0;
    const idGenerator = {
      next: async () => {
        allocations += 1;
        return 8_700_000_000_000_001 as any;
      },
      batch: async (count: number) => {
        allocations += count;
        return Array.from(
          { length: count },
          (_, index) => (8_700_000_000_000_001 + index) as any
        );
      },
    };
    const plans = [
      {
        kind: "drop" as const,
        materializationKey: "gather:test-node:actor:1234:1700400000000",
        position: { x: 10, y: 20, z: 30 },
        itemStacks: { iron_ore: 2, rough_stone: 3 },
        ownerActorIds: ["1234"],
        expiresAtMs: NOW_MS + 60_000,
        mined: true,
        sourceKind: "gathering_node",
      },
    ];

    const first = await materializeHarthmereNativeEcsPlans({
      redisPrimary,
      worldApi,
      idGenerator,
      plans,
    });
    assert.deepEqual(first, { created: 1, alreadyMaterialized: 0 });
    assert.equal(allocations, 1);

    const entityId = 8_700_000_000_000_001 as any;
    const entity = world.table.get(entityId);
    assert.ok(entity?.grab_bag);
    const contents = [...entity.grab_bag.slots.values()];
    assert.deepEqual(
      new Map(contents.map((entry) => [entry.item.id, Number(entry.count)])),
      new Map([
        [harthmereItemIdToBiomesId("iron_ore")!, 2],
        [harthmereItemIdToBiomesId("rough_stone")!, 3],
      ])
    );
    assert.equal(entity.grab_bag.filter?.kind, "only");
    assert.equal(entity.grab_bag.filter?.entity_ids.has(1234 as any), true);

    const replay = await materializeHarthmereNativeEcsPlans({
      redisPrimary,
      worldApi,
      idGenerator,
      plans,
    });
    assert.deepEqual(replay, { created: 0, alreadyMaterialized: 1 });
    assert.equal(allocations, 1);

    world.applyChanges([{ kind: "delete", id: entityId }]);
    const afterAcquisition = await materializeHarthmereNativeEcsPlans({
      redisPrimary,
      worldApi,
      idGenerator,
      plans,
    });
    assert.deepEqual(afterAcquisition, {
      created: 0,
      alreadyMaterialized: 1,
    });
    assert.equal(world.table.get(entityId), undefined);
  });

  it("never turns an unresolved install-owned drop into public loot", async () => {
    const redisPrimary = new FakeRedisPrimary();
    const world = new InMemoryWorld();
    const worldApi = ShimWorldApi.createForWorld(world);
    await assert.rejects(
      materializeHarthmereNativeEcsPlans({
        redisPrimary,
        worldApi,
        idGenerator: {
          next: async () => 8_700_000_000_000_002 as any,
          batch: async () => [8_700_000_000_000_002 as any],
        },
        plans: [
          {
            kind: "drop",
            materializationKey: "install-owned-private-drop",
            position: { x: 1, y: 2, z: 3 },
            itemStacks: { rough_stone: 1 },
            ownerActorIds: ["install:pre-auth"],
            expiresAtMs: NOW_MS + 60_000,
            mined: false,
            sourceKind: "test",
          },
        ],
      }),
      /unresolved owner/
    );
    assert.equal(world.table.get(8_700_000_000_000_002 as any), undefined);
  });

  it("reallocates a stale materialization id instead of accepting an unrelated ECS entity", async () => {
    const redisPrimary = new FakeRedisPrimary();
    const world = new InMemoryWorld();
    const worldApi = ShimWorldApi.createForWorld(world);
    const occupied = 8_700_000_000_000_003 as any;
    const replacement = 8_700_000_000_000_004 as any;
    world.applyChanges([
      {
        kind: "create",
        entity: { id: occupied, label: { text: "unrelated terrain marker" } },
      },
    ]);
    const ids = [occupied, replacement];
    const result = await materializeHarthmereNativeEcsPlans({
      redisPrimary,
      worldApi,
      idGenerator: {
        next: async () => ids.shift()!,
        batch: async (count: number) => ids.splice(0, count),
      },
      plans: [
        {
          kind: "drop",
          materializationKey: "drop-stale-id-collision",
          position: { x: 1, y: 2, z: 3 },
          itemStacks: { rough_stone: 1 },
          ownerActorIds: ["1234"],
          expiresAtMs: NOW_MS + 60_000,
          mined: true,
          sourceKind: "test",
        },
      ],
    });
    assert.deepEqual(result, { created: 1, alreadyMaterialized: 0 });
    assert.equal(
      world.table.get(occupied)?.label?.text,
      "unrelated terrain marker"
    );
    assert.ok(world.table.get(replacement)?.grab_bag);
  });

  it("publishes one replay-safe native inventory transaction for a job exchange", async () => {
    const redisPrimary = new FakeRedisPrimary();
    const world = new InMemoryWorld();
    const worldApi = ShimWorldApi.createForWorld(world);
    const actorId = 1234 as any;
    const consumedId = harthmereItemIdToBiomesId("rough_stone")!;
    world.applyChanges([
      {
        kind: "create",
        entity: {
          id: actorId,
          inventory: Inventory.create({
            items: [countOf(consumedId, 1n)],
          }),
        },
      },
    ]);
    const idGenerator = {
      next: async () => {
        throw new Error("inventory exchange must not allocate a receipt/drop");
      },
      batch: async () => {
        throw new Error("inventory exchange must not allocate a receipt/drop");
      },
    };
    const published: any[] = [];
    const logicApi = {
      publish: async (...events: any[]) => {
        published.push(...events);
      },
    };
    const plans = [
      {
        kind: "inventory_exchange" as const,
        materializationKey: "jobs:1234:repair:1",
        actorId: String(actorId),
        position: { x: 10, y: 20, z: 30 },
        consumeItemStacks: { rough_stone: 1 },
        rewardItemStacks: { iron_ore: 2 },
        expiresAtMs: NOW_MS + 60_000,
        sourceKind: "jobs_test",
      },
    ];
    assert.deepEqual(
      await materializeHarthmereNativeEcsPlans({
        redisPrimary,
        worldApi,
        idGenerator,
        logicApi,
        plans,
      }),
      { created: 1, alreadyMaterialized: 0 }
    );
    assert.equal(published.length, 1);
    assert.equal(published[0].userId, actorId);
    assert.equal(Number([...published[0].event.take.values()][0].count), 1);
    assert.equal(Number([...published[0].event.give.values()][0].count), 2);
    assert.ok(published[0].event.authorization);

    assert.deepEqual(
      await materializeHarthmereNativeEcsPlans({
        redisPrimary,
        worldApi,
        idGenerator,
        logicApi,
        plans,
      }),
      { created: 0, alreadyMaterialized: 1 }
    );
    assert.equal(published.length, 1);
    assert.equal(world.table.get(actorId)!.inventory!.items[0]?.count, 1n);
  });

  it("materializes a server-approved visible-giver Grove quest without a replica race", async () => {
    const redisPrimary = new FakeRedisPrimary();
    const world = new InMemoryWorld();
    const worldApi = ShimWorldApi.createForWorld(world);
    const actorId = 8_242_300_534_462_318 as any;
    const giverEntityId = 8_810_000_000_019_301 as any;
    const challengeId = harthmereNativeQuestId(
      "grove",
      "fountain_buttons_first"
    )!;
    world.applyChanges([
      {
        kind: "create",
        entity: {
          id: actorId,
          challenges: Challenges.create(),
        },
      },
      { kind: "create", entity: { id: giverEntityId } },
    ]);
    let published = 0;
    const result = await materializeHarthmereNativeEcsPlans({
      redisPrimary,
      worldApi,
      idGenerator: {
        next: async () => {
          throw new Error("quest acceptance must not allocate an id");
        },
        batch: async () => [],
      },
      logicApi: {
        publish: async (...events: any[]) => {
          published += events.length;
        },
      },
      plans: [
        {
          kind: "quest_accept",
          materializationKey: `quest_accept:${actorId}:grove:fountain_buttons_first`,
          actorId: String(actorId),
          questSource: "grove",
          questId: "fountain_buttons_first",
          giverEntityId: String(giverEntityId),
          sourceKind: "test",
        },
      ],
    });
    assert.deepEqual(result, { created: 1, alreadyMaterialized: 0 });
    // Reducer-approved authored quests are written directly to Challenges so
    // an asynchronous logic replica cannot observe stale availability.
    assert.equal(published, 0);
    assert.equal(
      world.table.get(actorId)!.challenges!.in_progress.has(challengeId),
      true
    );
  });

  it("repairs missing acceptance while materializing approved quest progress", async () => {
    const redisPrimary = new FakeRedisPrimary();
    const world = new InMemoryWorld();
    const worldApi = ShimWorldApi.createForWorld(world);
    const actorId = 8_242_300_534_462_319 as any;
    const challengeId = harthmereNativeQuestId(
      "grove",
      "fountain_buttons_first"
    )!;
    const stepId = harthmereNativeQuestStepId(
      "grove",
      "fountain_buttons_first",
      0
    )!;
    world.applyChanges([
      {
        kind: "create",
        entity: { id: actorId, challenges: Challenges.create() },
      },
    ]);
    let published = 0;
    const materializationKey = `quest_progress:${actorId}:grove:fountain_buttons_first:0`;
    assert.deepEqual(
      await materializeHarthmereNativeEcsPlans({
        redisPrimary,
        worldApi,
        idGenerator: {
          next: async () => {
            throw new Error("quest progress must not allocate an id");
          },
          batch: async () => [],
        },
        logicApi: {
          publish: async (...events: any[]) => {
            published += events.length;
          },
        },
        plans: [
          {
            kind: "quest_progress",
            materializationKey,
            actorId: String(actorId),
            questSource: "grove",
            questId: "fountain_buttons_first",
            objectiveIdOrIndex: 0,
            sourceKind: "test",
          },
        ],
      }),
      { created: 1, alreadyMaterialized: 0 }
    );
    assert.equal(published, 0);
    assert.equal(
      await redisPrimary.get(
        `harthmere:native_ecs_materialization:${materializationKey}:done`
      ),
      "1"
    );
    const actor = world.table.get(actorId)!;
    assert.equal(actor.challenges!.in_progress.has(challengeId), true);
    assert.equal(
      actor.trigger_state!.by_root.get(challengeId)?.has(stepId),
      true
    );
    assert.ok(challengeId);
    assert.ok(stepId);
  });

  it("binds an install-owned parcel pickup to native ECS and materializes the checked-in parcel", async () => {
    const redisPrimary = new FakeRedisPrimary();
    const world = new InMemoryWorld();
    const worldApi = ShimWorldApi.createForWorld(world);
    const actorId = 8290811499731977 as any;
    const durableActorId = "install:e4c81804-d210-40c2-8186-0690ada7e1e3";
    const published: any[] = [];
    const plans = bindHarthmereNativeEcsMaterializationPlansToActorForTest(
      [
        {
          kind: "inventory_exchange",
          materializationKey: `jobs_board:${durableActorId}:pickup:parcel`,
          actorId: durableActorId,
          position: { x: 503, y: 70, z: -133 },
          consumeItemStacks: {},
          rewardItemStacks: { sealed_package: 1 },
          expiresAtMs: NOW_MS + 60_000,
          sourceKind: "harthmere_jobs_board_pickup_delivery_parcel",
        },
      ],
      durableActorId,
      actorId
    );
    assert.equal((plans[0] as any).actorId, String(actorId));
    await materializeHarthmereNativeEcsPlans({
      redisPrimary,
      worldApi,
      idGenerator: {
        next: async () => {
          throw new Error("parcel inventory exchange must not allocate an id");
        },
        batch: async () => [],
      },
      logicApi: {
        publish: async (...events: any[]) => {
          published.push(...events);
        },
      },
      plans,
    });
    assert.equal(published.length, 1);
    assert.equal(published[0].userId, actorId);
    assert.equal(
      [...published[0].event.give.values()][0].item.id,
      harthmereNativeBiomesIdForItemId("sealed_package")
    );
  });
  it("keeps authenticated combat, death, AI, and respawn on native ECS", () => {
    for (const action of [
      "request_attack",
      "request_ability_cast",
      "request_death_transition",
      "request_environment_damage",
      "request_revive",
      "request_respawn",
      "request_npc_ai_tick",
      "request_boss_tick",
      "request_loot_roll",
    ] as const) {
      assert.equal(nativeEcsOwnsHarthmereLiveModeActionForTest(action), true);
    }
    assert.equal(
      nativeEcsOwnsHarthmereLiveModeActionForTest(
        "request_jobs_board_mutation"
      ),
      false
    );
    assert.equal(
      nativeEcsPhysicalDropNeedsAuthenticatedActorForTest({
        actionKind: "request_jobs_board_mutation",
        payload: { operation: "complete_job_quest" },
      }),
      true
    );
  });

  it("rejects browser-authored legacy farming while leaving native drop operations open", () => {
    for (const operation of [
      "plant",
      "water",
      "harvest",
      "forage_food",
      "hunt_animal",
      "cook_food",
      "eat_food",
      "feed_livestock",
      "collect_livestock_product",
    ]) {
      assert.equal(
        nativeEcsRejectsLegacyFarmingRequestForTest({
          actionKind: "request_farming_action",
          payload: { operation },
        }),
        true,
        operation
      );
    }
    for (const operation of [
      "gather_node",
      "mine_exotic_matter_deposit",
      "cook_enqueue",
      "cook_collect",
      "cook_cancel",
    ]) {
      assert.equal(
        nativeEcsRejectsLegacyFarmingRequestForTest({
          actionKind: "request_farming_action",
          payload: { operation },
        }),
        false,
        operation
      );
    }
  });

  it("requires a numeric authenticated ECS actor before creating private native drops", () => {
    assert.equal(
      nativeEcsPhysicalDropNeedsAuthenticatedActorForTest({
        actionKind: "request_farming_action",
        payload: { operation: "gather_node" },
      }),
      true
    );
    assert.equal(
      nativeEcsPhysicalDropNeedsAuthenticatedActorForTest({
        actionKind: "request_inventory_item_action",
        payload: { operation: "drop_item" },
      }),
      true
    );
    assert.equal(
      nativeEcsPhysicalDropNeedsAuthenticatedActorForTest({
        actionKind: "request_farming_action",
        payload: { operation: "cook_enqueue" },
      }),
      true
    );
  });

  it("serializes positioned drops but skips genuinely actor-only mutations", function () {
    const sharedWorldStateKey = harthmereLiveModeSharedWorldStateKey();
    assert.equal(
      harthmereMutationMayChangeSharedWorldForTest({
        sharedWorldStateKey,
        sharedStateKeys: [
          "harthmere:live_mode:current:loot_drop:drop_actor_only",
        ],
        touchedModels: ["inventory_items", "inventory_loot_drops"],
      }),
      true
    );
    assert.equal(
      harthmereMutationMayChangeSharedWorldForTest({
        sharedWorldStateKey,
        touchedModels: ["equipment_slots"],
      }),
      false
    );
    assert.equal(
      harthmereMutationMayChangeSharedWorldForTest({
        sharedWorldStateKey,
        sharedStateKeys: ["harthmere:jobs_board:job:repair_road"],
        touchedModels: ["jobs_board_quest_todo"],
      }),
      true
    );
    assert.equal(
      harthmereMutationMayChangeSharedWorldForTest({
        sharedWorldStateKey,
        touchedModels: ["robot_protection"],
      }),
      true
    );
  });

  it("uses Glitch install ids as live-mode actors when Biomes auth is absent", () => {
    assert.deepEqual(
      liveModeActorIdentityFromRequest({
        unsafeRequest: {
          query: { install_id: "install-abc" },
          headers: {},
        },
      }),
      {
        actorId: "install:install-abc",
        userId: undefined,
        installId: "install-abc",
      }
    );
    assert.deepEqual(
      liveModeActorIdentityFromRequest({
        auth: { userId: 123 },
        unsafeRequest: {
          query: { install_id: "install-abc" },
          headers: {},
        },
      }),
      {
        actorId: "123",
        userId: 123,
        installId: undefined,
      }
    );
    assert.equal(
      liveModeActorIdentityFromRequest({
        unsafeRequest: {
          query: {},
          headers: { "x-glitch-install-id": "header-install" },
        },
      }).actorId,
      "install:header-install"
    );
  });

  it("derives server-side jobs board proximity from known board ids only", () => {
    assert.deepEqual(
      jobsBoardPositionFromLiveModeBody({
        requestId: "jobs-board-pos",
        idempotencyKey: "jobs-board-pos",
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        actionKind: "request_jobs_board_mutation",
        subsystem: "jobs",
        actorEntityVersion: 1,
        targetEntityVersion: 1,
        zoneId: "harthmere_grove",
        payload: {
          operation: "accept_job",
          boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        },
      } as any),
      { x: 501.99486179104775, y: 70, z: -132.00350672753194 }
    );
    assert.equal(
      jobsBoardPositionFromLiveModeBody({
        requestId: "unknown-board-pos",
        idempotencyKey: "unknown-board-pos",
        targetId: "unknown_board",
        actionKind: "request_jobs_board_mutation",
        subsystem: "jobs",
        actorEntityVersion: 1,
        zoneId: "harthmere_grove",
        payload: { boardId: "unknown_board" },
      } as any),
      undefined
    );
    assert.equal(
      jobsBoardPositionFromLiveModeBody({
        requestId: "not-jobs",
        idempotencyKey: "not-jobs",
        actionKind: "request_inventory_mutation",
        subsystem: "inventory",
        actorEntityVersion: 1,
        zoneId: "harthmere_grove",
        payload: { boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID },
      } as any),
      undefined
    );
  });

  it("derives install-only combat actor position for attacks and NPC AI ticks", () => {
    assert.deepEqual(
      combatActorPositionFromInstallLiveModeBody({
        requestId: "combat-pos",
        idempotencyKey: "combat-pos",
        targetId: "server-muck-combat:old-wood-mucker-8:1308",
        actionKind: "request_attack",
        subsystem: "combat",
        actorEntityVersion: 1,
        zoneId: "harthmere_wilderness",
        payload: { abilityId: "basic_strike" },
        clientClaims: { runtimePosition: [496, 53, -126] },
      } as any),
      { x: 496, y: 53, z: -126 }
    );
    assert.deepEqual(
      combatActorPositionFromInstallLiveModeBody({
        requestId: "npc-ai-pos",
        idempotencyKey: "npc-ai-pos",
        targetId: "server-muck-combat:old-wood-mucker-8:1308",
        actionKind: "request_npc_ai_tick",
        subsystem: "combat",
        actorEntityVersion: 1,
        zoneId: "harthmere_wilderness",
        payload: {
          npcId: "server-muck-combat:old-wood-mucker-8:1308",
        },
        clientClaims: { runtimePosition: [501, 53, -130] },
      } as any),
      { x: 501, y: 53, z: -130 }
    );
    assert.deepEqual(
      combatActorPositionFromInstallLiveModeBody({
        requestId: "npc-ai-pos-npc-subsystem",
        idempotencyKey: "npc-ai-pos-npc-subsystem",
        targetId: "server-muck-combat:old-wood-mucker-8:1308",
        actionKind: "request_npc_ai_tick",
        subsystem: "npc_ai",
        actorEntityVersion: 1,
        zoneId: "harthmere_wilderness",
        payload: {
          npcId: "server-muck-combat:old-wood-mucker-8:1308",
        },
        clientClaims: { actorPosition: { x: 502, y: 54, z: -131 } },
      } as any),
      { x: 502, y: 54, z: -131 }
    );
    assert.equal(
      combatActorPositionFromInstallLiveModeBody({
        requestId: "combat-pos-bad",
        idempotencyKey: "combat-pos-bad",
        actionKind: "request_attack",
        subsystem: "combat",
        actorEntityVersion: 1,
        zoneId: "harthmere_wilderness",
        payload: { abilityId: "basic_strike" },
        clientClaims: { runtimePosition: [496, "nope", -126] },
      } as any),
      undefined
    );
    assert.equal(
      combatActorPositionFromInstallLiveModeBody({
        requestId: "not-combat-pos",
        idempotencyKey: "not-combat-pos",
        actionKind: "request_inventory_mutation",
        subsystem: "inventory",
        actorEntityVersion: 1,
        zoneId: "harthmere_wilderness",
        payload: {},
        clientClaims: { runtimePosition: [496, 53, -126] },
      } as any),
      undefined
    );
  });

  it("derives install-only home console position from runtime claims", () => {
    assert.deepEqual(
      combatActorPositionFromInstallLiveModeBody({
        requestId: "home-console-pos",
        idempotencyKey: "home-console-pos",
        actionKind: "request_home_decoration",
        subsystem: "home_decoration",
        actorEntityVersion: 1,
        zoneId: "harthmere_grove",
        payload: {
          operation: "place_decoration",
          propertyId: "property_grove_muckstead_cottage_lot",
        },
        clientClaims: { runtimePosition: [252, 56, -196] },
      } as any),
      { x: 252, y: 56, z: -196 }
    );
  });

  it("reads the server-side actor position for jobs board proximity without trusting client claims", async () => {
    const position = await readServerActorPositionForLiveMode(
      {
        get: async () => ({
          position: () => ({
            v: [501.99486179104775, 70, -132.00350672753194],
          }),
        }),
      } as any,
      1 as any
    );
    assert.deepEqual(position, {
      x: 501.99486179104775,
      y: 70,
      z: -132.00350672753194,
    });

    const missing = await readServerActorPositionForLiveMode(
      {
        get: async () => ({
          position: () => ({ v: [Number.NaN, 70, -132.00350672753194] }),
        }),
      } as any,
      1 as any
    );
    assert.equal(missing, undefined);
  });

  it("reads gathering position and exact selected/worn tool ids in one ECS lookup", async () => {
    const selectedTool = harthmereItemIdToBiomesId("rusty_pickaxe")!;
    const wornTool = harthmereItemIdToBiomesId("repair_mallet")!;
    const inventory = Inventory.create({
      hotbar: [countOf(selectedTool, 1n)],
      selected: { kind: "hotbar", idx: 0 },
      currencies: createBag(countOf(BikkieIds.bling, 114n)),
    });
    const wearing = Wearing.create({
      items: new Map([[BikkieIds.hands, countOf(wornTool, 1n).item]]),
    });
    let reads = 0;
    const context = await readServerActorNativeContextForLiveMode(
      {
        get: async () => {
          reads += 1;
          return {
            position: () => ({ v: [503, 53, -270] }),
            inventory: () => inventory,
            wearing: () => wearing,
          };
        },
      } as any,
      1 as any,
      true
    );

    assert.equal(reads, 1);
    assert.deepEqual(context.position, { x: 503, y: 53, z: -270 });
    assert.deepEqual(
      new Set(context.itemIds),
      new Set([selectedTool, wornTool])
    );
    assert.deepEqual(
      new Set(context.equippedItemKeys),
      new Set(["rusty_pickaxe", "repair_mallet"])
    );
    assert.deepEqual(context.itemCounts, {
      rusty_pickaxe: 1,
    });
    assert.equal(context.gold, 114);
    assert.deepEqual(context.equipment, {
      main_hand: "rusty_pickaxe",
      hands: "repair_mallet",
    });
  });

  it("keeps jobs-board mutation snapshots slim without cutting building snapshots from building actions", () => {
    assert.deepEqual(
      harthmereLiveModeMutationSnapshotKeys({
        actionKind: "request_jobs_board_mutation",
        subsystem: "jobs",
        touchedModels: ["jobs_board_posting", "jobs_board_quest_todo"],
      }).sort(),
      [
        "inventoryLootState",
        "jobsBoardState",
        "playerStatusState",
        "questState",
      ]
    );
    assert.ok(
      harthmereLiveModeMutationSnapshotKeys({
        actionKind: "request_property_building_mutation",
        subsystem: "building",
        touchedModels: ["building_state", "property"],
      }).includes("buildingState"),
      "building mutations must still return buildingState"
    );
    assert.deepEqual(
      harthmereLiveModeMutationSnapshotKeys({
        actionKind: "request_boss_tick",
        subsystem: "boss_encounter",
        touchedModels: ["boss_encounter_state"],
      }).sort(),
      ["combatState", "playerStatusState"],
      "boss ticks should hydrate the combat/status snapshots instead of falling back to status only"
    );
  });

  it("uses WATCH/MULTI and records idempotency only with the state mutation", async () =>
    withFullLiveModeMutationSnapshotsForTest(async () => {
      const redisPrimary = new FakeRedisPrimary();
      (globalThis as any).__harthmereLiveModeRedis = {
        primary: redisPrimary,
      };

      const env = envelope();
      const mutationPlan = buildHarthmereLiveModePersistenceMutationPlan(env);
      const response = {
        ok: true,
        version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE" as const,
        actorId: ACTOR,
        duplicate: false,
        replayed: false,
        persisted: true,
        validation: {
          ok: true,
          errors: [],
          warnings: [],
          rejectedClientClaims: [],
        },
        mutationPlan,
        events: [
          createHarthmereLiveModeEvent({
            kind: "xp_reward_resolved",
            envelope: env,
          }),
        ],
        uiEvents: [
          createHarthmereLiveModeUiEvent({
            kind: "level_up_toast",
            envelope: env,
          }),
        ],
      };

      const persisted = await persistHarthmereLiveModeResponse(env, response, {
        logicApi: { publish: async () => {} } as any,
        userId: 1 as any,
      });

      const playerKey = harthmereLiveModePlayerStateKey(ACTOR);
      const sharedWorldKey = harthmereLiveModeSharedWorldStateKey();
      // HARTHMERE_LIVE_MODE_SCOPED_WATCH (audit fix, 2026-07-13): a
      // player-only mutation (XP reward) must neither WATCH nor rewrite the
      // global shared-world key — that always-on WATCH/write was the main
      // cross-player EXEC contention source behind multi-second mutations.
      assert.deepEqual(redisPrimary.watched[0], [
        "harthmere:live_mode:current:idempotency:player_live_api_persist_001:live-api-persist-idem-1",
        playerKey,
      ]);
      assert.ok(
        redisPrimary.watched.every((keys) => !keys.includes(sharedWorldKey)),
        "player-only mutation must never watch the shared world key"
      );
      const firstSet = redisPrimary.txOps.find((op) => op[0] === "set");
      assert.equal(firstSet?.[1], playerKey);
      assert.equal(
        redisPrimary.txOps.some(
          (op) => op[0] === "set" && op[1] === sharedWorldKey
        ),
        false,
        "player-only mutation must not rewrite the shared world blob"
      );
      assert.equal(
        redisPrimary.txOps.some((op) => op[0] === "direct_set"),
        false
      );
      const idempotencyKey =
        "harthmere:live_mode:current:idempotency:player_live_api_persist_001:live-api-persist-idem-1";
      const storedIdempotency = JSON.parse(
        redisPrimary.store.get(idempotencyKey) ?? "{}"
      );
      assert.deepEqual(storedIdempotency.includedSnapshots, [
        "buildingState",
        "bankingState",
        "guildState",
        "economyState",
        "jobsBoardState",
        "dailyState",
        "farmingFoodState",
        "craftingState",
        "inventoryLootState",
        "combatState",
        "playerStatusState",
        "questState",
      ]);
      assert.equal(storedIdempotency.buildingState, undefined);
      assert.equal(storedIdempotency.economyState, undefined);
      assert.equal(storedIdempotency.farmingFoodState, undefined);
      assert.equal(storedIdempotency.playerStatusState, undefined);
      assert.equal(persisted.backendMutation?.warnings.length, 0);
      assert.equal((persisted.playerStatusState as any)?.combat?.hp, 100);
      assert.equal((persisted.playerStatusState as any)?.level, 1);
      assert.equal(
        (persisted.farmingFoodState as any)?.stamina,
        (persisted.farmingFoodState as any)?.maxStamina
      );
      assert.ok((persisted.farmingFoodState as any)?.maxStamina >= 100);
      assert.equal(
        typeof (persisted.farmingFoodState as any)?.inventory,
        "object"
      );
      assert.equal(
        (persisted.farmingFoodState as any)?.foodDefinitions?.road_ration
          ?.staminaRestore,
        24
      );
      assert.equal(
        (persisted.farmingFoodState as any)?.cookingRecipes?.grilled_meat
          ?.outputs?.grilled_meat,
        1
      );
      assert.ok(
        (persisted.farmingFoodState as any)?.availableCookingStations?.includes(
          "campfire"
        )
      );

      const rawState = redisPrimary.store.get(playerKey);
      const state = parseHarthmereLiveModeBackendState(rawState, ACTOR, NOW_MS);
      assert.equal(state.classMagic.skills.combat?.xp, 100);

      const replay = await persistHarthmereLiveModeResponse(env, response, {
        logicApi: { publish: async () => {} } as any,
        userId: 1 as any,
      });
      assert.equal(replay.duplicate, true);
      assert.equal(replay.replayed, true);
      assert.ok(replay.includedSnapshots?.includes("inventoryLootState"));
      assert.ok(replay.includedSnapshots?.includes("playerStatusState"));
      assert.ok(replay.inventoryLootState);
      assert.ok(replay.playerStatusState);
    }));

  // HARTHMERE_LIVE_MODE_SCOPED_WATCH (audit fix, 2026-07-13): a mutation that
  // DOES change shared world state (quest invite → shared quest-invite
  // channel) must escalate — re-WATCH including the shared world key — and
  // then persist the shared blob, so cross-player data is still transactional.
  it("escalates the WATCH set and persists shared state for shared-touching mutations", async () => {
    const redisPrimary = new FakeRedisPrimary();
    (globalThis as any).__harthmereLiveModeRedis = {
      primary: redisPrimary,
    };

    const env: HarthmereLiveModeAuthorityEnvelope = {
      requestId: "live-api-persist-shared-req-1",
      idempotencyKey: "live-api-persist-shared-idem-1",
      actorId: ACTOR,
      targetId: "player_live_api_persist_invitee",
      actionKind: "request_quest_state_update",
      subsystem: "quest",
      source: "client_request",
      serverActorPosition: { x: 496, y: 70, z: -126 },
      serverTargetPosition: { x: 497, y: 70, z: -126 },
      serverReceivedAtMs: NOW_MS,
      serverTick: 2,
      actorEntityVersion: 1,
      zoneId: "harthmere",
      payload: {
        operation: "invite_to_quest",
        inviteeActorId: "player_live_api_persist_invitee",
        questId: "grove_buttons",
        questTitle: "Buttons Before the Road",
        questArea: "The Grove",
        objectiveText: "Talk to Jackie and find the jobs board.",
        reward: "25 XP",
      },
      clientClaims: {},
    };
    const mutationPlan = buildHarthmereLiveModePersistenceMutationPlan(env);
    const response = {
      ok: true,
      version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE" as const,
      actorId: ACTOR,
      duplicate: false,
      replayed: false,
      persisted: true,
      validation: {
        ok: true,
        errors: [],
        warnings: [],
        rejectedClientClaims: [],
      },
      mutationPlan,
      events: [],
      uiEvents: [],
    };

    await persistHarthmereLiveModeResponse(env, response, {
      logicApi: { publish: async () => {} } as any,
      userId: 1 as any,
    });

    const sharedWorldKey = harthmereLiveModeSharedWorldStateKey();
    // First (optimistic) WATCH is scoped: no shared world key.
    assert.ok(
      !redisPrimary.watched[0]?.includes(sharedWorldKey),
      "first watch attempt must not include the shared world key"
    );
    // Escalation re-WATCH must cover the shared world key before writing it.
    assert.ok(
      redisPrimary.watched.some((keys) => keys.includes(sharedWorldKey)),
      "shared-touching mutation must escalate to watching the shared world key"
    );
    assert.ok(
      redisPrimary.txOps.some(
        (op) => op[0] === "set" && op[1] === sharedWorldKey
      ),
      "shared-touching mutation must persist the shared world blob"
    );
    const sharedBlob = JSON.parse(
      redisPrimary.store.get(sharedWorldKey) ?? "{}"
    );
    const invites = Object.values(
      (sharedBlob.questInvites?.invites ?? {}) as Record<string, any>
    );
    assert.equal(invites.length, 1);
    assert.equal(invites[0]?.questId, "grove_buttons");
  });

  it("returns helper read snapshots without rewriting actor or shared state", async () => {
    const redisPrimary = new FakeRedisPrimary();
    (globalThis as any).__harthmereLiveModeRedis = {
      primary: redisPrimary,
    };

    const env: HarthmereLiveModeAuthorityEnvelope = {
      ...envelope(),
      requestId: "live-api-persist-helper-read",
      idempotencyKey: "live-api-persist-helper-read",
      actionKind: "request_quest_state_update",
      subsystem: "quest",
      source: "client_request",
      targetId: "live_entity_helper_state",
      payload: { operation: "live_entity_helper_read_state" },
    };
    const mutationPlan = buildHarthmereLiveModePersistenceMutationPlan(env);
    const response = {
      ok: true,
      version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE" as const,
      actorId: ACTOR,
      duplicate: false,
      replayed: false,
      persisted: true,
      validation: {
        ok: true,
        errors: [],
        warnings: [],
        rejectedClientClaims: [],
      },
      mutationPlan,
      events: [],
      uiEvents: [],
    };

    const persisted = await persistHarthmereLiveModeResponse(env, response, {
      logicApi: { publish: async () => {} } as any,
      userId: 1 as any,
    });

    const playerKey = harthmereLiveModePlayerStateKey(ACTOR);
    const sharedWorldKey = harthmereLiveModeSharedWorldStateKey();
    assert.equal(persisted.persisted, false);
    assert.ok(persisted.questState, "read response should include questState");
    assert.ok(
      persisted.inventoryLootState,
      "read response should include inventory snapshot"
    );
    assert.ok(
      persisted.buildingState,
      "read response should include building snapshot"
    );
    assert.equal(
      redisPrimary.txOps.some((op) => op[0] === "set" && op[1] === playerKey),
      false
    );
    assert.equal(
      redisPrimary.txOps.some(
        (op) => op[0] === "set" && op[1] === sharedWorldKey
      ),
      false
    );
    assert.equal(redisPrimary.store.get(playerKey), undefined);
    assert.equal(redisPrimary.store.get(sharedWorldKey), undefined);
    assert.deepEqual(redisPrimary.watched, []);
    assert.deepEqual(redisPrimary.txOps, []);
  });

  it("serves legacy bible reads without entering transactional persistence", async () => {
    const redisPrimary = new FakeRedisPrimary();
    (globalThis as any).__harthmereLiveModeRedis = {
      primary: redisPrimary,
    };
    const env: HarthmereLiveModeAuthorityEnvelope = {
      ...envelope(),
      requestId: "legacy-bible-read",
      idempotencyKey: "legacy-bible-read",
      actionKind: "request_quest_state_update",
      subsystem: "quest",
      source: "client_request",
      payload: { operation: "bible_quest_read" },
    };
    const persisted = await persistHarthmereLiveModeResponse(
      env,
      {
        ok: true,
        version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE" as const,
        actorId: ACTOR,
        duplicate: false,
        replayed: false,
        persisted: true,
        validation: {
          ok: true,
          errors: [],
          warnings: [],
          rejectedClientClaims: [],
        },
        mutationPlan: buildHarthmereLiveModePersistenceMutationPlan(env),
        events: [],
        uiEvents: [],
      },
      { logicApi: { publish: async () => {} } as any, userId: 1 as any }
    );

    assert.equal(persisted.persisted, false);
    assert.ok(persisted.questState);
    assert.deepEqual(redisPrimary.watched, []);
    assert.deepEqual(redisPrimary.txOps, []);
  });

  it("preserves fresher status channels when a non-status mutation reduces stale state", () => {
    const current = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    current.updatedAtMs = NOW_MS;
    current.combat.hp = 80;
    current.combat.resources.mana = 110;
    current.combat.resources.stamina = 94;
    current.combat.lastStaminaTickMs = NOW_MS - 5_000;
    current.law.standing.harthmere = {
      likeability: 0,
      legal: 0,
      notoriety: 0,
      notorietyFloor: 0,
    };

    const reduced = parseHarthmereLiveModeBackendState(
      JSON.stringify(current),
      ACTOR,
      NOW_MS
    );
    reduced.quests.completed.some_quest = NOW_MS + 1;

    const latest = parseHarthmereLiveModeBackendState(
      JSON.stringify(current),
      ACTOR,
      NOW_MS
    );
    latest.updatedAtMs = NOW_MS + 2_000;
    latest.combat.hp = 70;
    latest.combat.resources.mana = 42;
    latest.combat.resources.stamina = 88;
    latest.combat.lastStaminaTickMs = NOW_MS + 1_000;
    latest.law.standing.harthmere = {
      likeability: 18,
      legal: -4,
      notoriety: 9,
      notorietyFloor: 3,
    };

    const result = preserveFreshHarthmereLiveModeStatusChannelsForTest({
      currentState: current,
      reducedState: reduced,
      latestRawState: JSON.stringify(latest),
      actorId: ACTOR,
      nowMs: NOW_MS + 3_000,
    });

    assert.deepEqual(result.channels.sort(), [
      "health",
      "resources",
      "standing",
    ]);
    assert.equal(reduced.combat.hp, 70);
    assert.equal(reduced.combat.resources.mana, 42);
    assert.equal(reduced.combat.resources.stamina, 88);
    assert.deepEqual(reduced.law.standing.harthmere, {
      likeability: 18,
      legal: -4,
      notoriety: 9,
      notorietyFloor: 3,
    });
    assert.ok(reduced.quests.completed.some_quest);
  });

  it("adopts duplicate install actor state inside the live-mode transaction", async () => {
    const redisPrimary = new FakeRedisPrimary();
    (globalThis as any).__harthmereLiveModeRedis = {
      primary: redisPrimary,
    };

    const sourceActorId = "install:install-abc";
    const sourceKey = harthmereLiveModePlayerStateKey(sourceActorId);
    const targetKey = harthmereLiveModePlayerStateKey(ACTOR);
    const sourceState = defaultHarthmereLiveModeBackendState(
      sourceActorId,
      NOW_MS
    );
    sourceState.inventory.gold = 321;
    redisPrimary.store.set(sourceKey, JSON.stringify(sourceState));

    const env = envelope();
    const mutationPlan = buildHarthmereLiveModePersistenceMutationPlan(env);
    const response = {
      ok: true,
      version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE" as const,
      actorId: ACTOR,
      duplicate: false,
      replayed: false,
      persisted: true,
      validation: {
        ok: true,
        errors: [],
        warnings: [],
        rejectedClientClaims: [],
      },
      mutationPlan,
      events: [],
      uiEvents: [],
    };

    const persisted = await persistHarthmereLiveModeResponse(env, response, {
      logicApi: { publish: async () => {} } as any,
      userId: 1 as any,
      stateAdoption: {
        fromActorId: sourceActorId,
        fromStateKey: sourceKey,
        toActorId: ACTOR,
        toStateKey: targetKey,
        reason: "install_orphan",
      },
    });

    // HARTHMERE_LIVE_MODE_SCOPED_WATCH (audit fix, 2026-07-13): adoption is a
    // player-state concern, so the first WATCH covers idempotency + target +
    // adoption source — the global shared-world key is only escalated into the
    // WATCH set when a mutation actually changes shared state.
    assert.deepEqual(redisPrimary.watched[0], [
      "harthmere:live_mode:current:idempotency:player_live_api_persist_001:live-api-persist-idem-1",
      targetKey,
      sourceKey,
    ]);
    assert.ok(
      persisted.backendMutation?.warnings.includes(
        `actor_state_adopted:install_orphan:${sourceActorId}->${ACTOR}`
      )
    );
    assert.ok(
      redisPrimary.txOps.some((op) => op[0] === "del" && op[1] === sourceKey)
    );
    assert.equal(redisPrimary.store.has(sourceKey), false);

    const targetState = parseHarthmereLiveModeBackendState(
      redisPrimary.store.get(targetKey),
      ACTOR,
      NOW_MS
    );
    assert.equal(targetState.inventory.gold, 321);
    assert.equal(targetState.classMagic.skills.combat?.xp, 100);
  });

  it("adopts a linked game-user source when the stable actor only has a default shell", async () => {
    const redisPrimary = new FakeRedisPrimary();
    (globalThis as any).__harthmereLiveModeRedis = {
      primary: redisPrimary,
    };

    const sourceActorId = "1358212051954288";
    const sourceKey = harthmereLiveModePlayerStateKey(sourceActorId);
    const targetKey = harthmereLiveModePlayerStateKey(ACTOR);
    const sourceState = defaultHarthmereLiveModeBackendState(
      sourceActorId,
      NOW_MS
    );
    sourceState.inventory.gold = 68;
    redisPrimary.store.set(sourceKey, JSON.stringify(sourceState));
    redisPrimary.store.set(
      targetKey,
      JSON.stringify(defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS))
    );

    const env = envelope();
    env.requestId = "live-api-persist-linked-game-user-adopt";
    env.idempotencyKey = "live-api-persist-linked-game-user-adopt";
    const response = {
      ok: true,
      version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE" as const,
      actorId: ACTOR,
      duplicate: false,
      replayed: false,
      persisted: true,
      validation: {
        ok: true,
        errors: [],
        warnings: [],
        rejectedClientClaims: [],
      },
      mutationPlan: buildHarthmereLiveModePersistenceMutationPlan(env),
      events: [],
      uiEvents: [],
    };

    const persisted = await persistHarthmereLiveModeResponse(env, response, {
      logicApi: { publish: async () => {} } as any,
      userId: 1 as any,
      stateAdoption: {
        fromActorId: sourceActorId,
        fromStateKey: sourceKey,
        toActorId: ACTOR,
        toStateKey: targetKey,
        reason: "linked_game_user",
      },
    });

    assert.ok(
      persisted.backendMutation?.warnings.includes(
        `actor_state_adopted:linked_game_user:${sourceActorId}->${ACTOR}`
      )
    );
    assert.equal(redisPrimary.store.has(sourceKey), false);
    const targetState = parseHarthmereLiveModeBackendState(
      redisPrimary.store.get(targetKey),
      ACTOR,
      NOW_MS
    );
    assert.equal(targetState.inventory.gold, 68);
    assert.equal(targetState.classMagic.skills.combat?.xp, 100);
  });

  it("hydrates public economy from shared world state before reducing actor mutations", async () =>
    withFullLiveModeMutationSnapshotsForTest(async () => {
      const redisPrimary = new FakeRedisPrimary();
      (globalThis as any).__harthmereLiveModeRedis = {
        primary: redisPrimary,
      };

      const sharedSource = defaultHarthmereLiveModeBackendState(
        "shared_actor",
        NOW_MS
      );
      sharedSource.economy.production.businesses.shared_shop = {
        businessId: "shared_shop",
        ownerKind: "player",
        ownerId: "merchant",
        typeId: "general_trader",
        name: "Shared Shop",
        status: "open",
        licenseClass: "basic_trade",
        licenseLevel: 1,
        propertyId: "property_shared_shop",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        inventory: {},
        storageMaxSlots: 12,
        employees: [],
        activeContracts: [],
        completedContracts: 0,
        reputation: 0,
        customerSatisfaction: 70,
        sanitationRating: 70,
        safetyRating: 70,
        serviceRadius: 2,
        priceModifiers: {},
        balanceGold: 500,
        debtGold: 0,
        upkeepGoldPerDay: 1,
        rentGoldPerDay: 0,
        wageGoldPerDay: 0,
        salesTaxRate: 0.06,
        lastTickAtMs: NOW_MS,
        createdAtMs: NOW_MS,
        updatedAtMs: NOW_MS,
        flags: {},
      } as any;
      redisPrimary.store.set(
        harthmereLiveModeSharedWorldStateKey(),
        JSON.stringify(
          createHarthmereLiveModeSharedWorldState(sharedSource, NOW_MS)
        )
      );

      const env = envelope();
      env.requestId = "live-api-persist-req-shared";
      env.idempotencyKey = "live-api-persist-idem-shared";
      const mutationPlan = buildHarthmereLiveModePersistenceMutationPlan(env);
      const response = {
        ok: true,
        version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE" as const,
        actorId: ACTOR,
        duplicate: false,
        replayed: false,
        persisted: true,
        validation: {
          ok: true,
          errors: [],
          warnings: [],
          rejectedClientClaims: [],
        },
        mutationPlan,
        events: [
          createHarthmereLiveModeEvent({
            kind: "xp_reward_resolved",
            envelope: env,
          }),
        ],
        uiEvents: [],
      };

      const persisted = await persistHarthmereLiveModeResponse(env, response, {
        logicApi: { publish: async () => {} } as any,
        userId: 1 as any,
      });

      assert.ok((persisted.economyState as any).businesses.shared_shop);
      const actorState = readMergedPersistedState(redisPrimary);
      assert.ok(actorState.economy.production.businesses.shared_shop);
    }));

  it("persists accepted jobs board jobs as actor quests with map markers", async function () {
    this.timeout(45_000);

    const redisPrimary = new FakeRedisPrimary();
    (globalThis as any).__harthmereLiveModeRedis = { primary: redisPrimary };

    const actorState = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    const sharedSource = defaultHarthmereLiveModeBackendState(
      "shared_board",
      NOW_MS
    );
    const deadlineAtMs = Date.now() + 86_400_000;
    sharedSource.jobsBoard.postings.job_accept_chain = {
      jobId: "job_accept_chain",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      issuerKind: "town",
      issuerId: "harthmere_grove",
      title: "Clear the Muckwad Patch",
      description: "Verify the accepted job reaches quests and map markers.",
      kind: "hunt",
      requirements: [
        {
          targetId: "mucker_elite",
          targetName: "Elite Mucker",
          mapMarkerId: "muckwad_patch",
        },
      ],
      rewardGold: 1200,
      escrowGold: 1200,
      reputationDelta: 12,
      status: "open",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      createdAtMs: NOW_MS,
      deadlineAtMs,
      failurePenaltyGold: 120,
      requiresFieldWork: true,
      mapMarkerId: "muckwad_patch",
      targetId: "mucker_elite",
      abuseFlags: [],
      logs: [],
      autoPosted: true,
      source: "economy_auto_seed",
    } as any;

    redisPrimary.store.set(
      harthmereLiveModePlayerStateKey(ACTOR),
      JSON.stringify(actorState)
    );
    redisPrimary.store.set(
      harthmereLiveModeSharedWorldStateKey(),
      JSON.stringify(
        createHarthmereLiveModeSharedWorldState(sharedSource, NOW_MS)
      )
    );

    const persistEnvelope = async (
      requestEnv: HarthmereLiveModeAuthorityEnvelope
    ) => {
      const mutationPlan =
        buildHarthmereLiveModePersistenceMutationPlan(requestEnv);
      return persistHarthmereLiveModeResponse(
        requestEnv,
        {
          ok: true,
          version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE" as const,
          actorId: ACTOR,
          duplicate: false,
          replayed: false,
          persisted: true,
          validation: {
            ok: true,
            errors: [],
            warnings: [],
            rejectedClientClaims: [],
          },
          mutationPlan,
          events: [
            createHarthmereLiveModeEvent({
              kind: "audit_log_appended",
              envelope: requestEnv,
            }),
          ],
          uiEvents: [],
        },
        {
          logicApi: { publish: async () => {} } as any,
          userId: 1 as any,
        }
      );
    };

    const env = envelope();
    env.requestId = "live-api-persist-jobs-board-accept";
    env.idempotencyKey = "live-api-persist-jobs-board-accept";
    env.actionKind = "request_jobs_board_mutation";
    env.subsystem = "jobs";
    env.source = "client_request";
    env.targetId = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID;
    env.zoneId = "harthmere_grove";
    env.serverActorPosition = {
      x: 501.99486179104775,
      y: 70,
      z: -132.00350672753194,
    };
    env.payload = {
      operation: "accept_job",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      jobId: "job_accept_chain",
    };
    const persisted = await persistEnvelope(env);

    assert.deepEqual(
      gameplayMutationWarnings(persisted.backendMutation?.warnings),
      []
    );
    assert.deepEqual(redisPrimary.watched, [
      [
        "harthmere:live_mode:current:idempotency:player_live_api_persist_001:live-api-persist-jobs-board-accept",
        harthmereLiveModePlayerStateKey(ACTOR),
        harthmereLiveModeSharedWorldStateKey(),
      ],
    ]);
    assert.equal(persisted.snapshotMode, "changed");
    assert.deepEqual(persisted.includedSnapshots?.sort(), [
      "buildingState",
      "inventoryLootState",
      "jobsBoardState",
      "playerStatusState",
      "questState",
    ]);
    assert.equal(persisted.economyState, undefined);
    assert.ok(
      (persisted.buildingState as any)?.inWorldMarkers,
      "accepted jobs should return the building-backed map marker snapshot"
    );
    const jobsBoardState = persisted.jobsBoardState as any;
    assert.ok(
      jobsBoardState.myAcceptedJobs.some(
        (job: any) =>
          job.jobId === "job_accept_chain" && job.status === "active"
      )
    );
    const todo = jobsBoardState.myTodos.find(
      (entry: any) => entry.jobId === "job_accept_chain"
    );
    assert.ok(todo, "accepted job should be returned as a quest-board todo");
    const markerId = `jobs_board_marker:${todo.todoId}`;

    assert.equal(
      todo.mapMarkerId,
      "muckwad_patch",
      "accepted job marker data should ride on the jobs-board todo"
    );

    const acceptReplay = await persistEnvelope(env);
    assert.equal(acceptReplay.duplicate, true);
    assert.equal(acceptReplay.replayed, true);
    assert.deepEqual(acceptReplay.includedSnapshots?.sort(), [
      "buildingState",
      "inventoryLootState",
      "jobsBoardState",
      "playerStatusState",
      "questState",
    ]);
    assert.ok(acceptReplay.jobsBoardState);
    assert.ok(acceptReplay.questState);
    assert.ok(acceptReplay.inventoryLootState);
    assert.ok(acceptReplay.playerStatusState);
    assert.ok(acceptReplay.buildingState);

    let persistedActorState = readMergedPersistedState(redisPrimary);
    assert.deepEqual(
      persistedActorState.quests.active[`jobs_board:${todo.todoId}`],
      { stepId: "job_accept_chain", progress: 0 }
    );
    assert.ok(persistedActorState.building.inWorldMarkers[markerId]);

    const questEnv = envelope();
    questEnv.requestId = "live-api-persist-jobs-board-quest-complete";
    questEnv.idempotencyKey = "live-api-persist-jobs-board-quest-complete";
    questEnv.actionKind = "request_quest_state_update";
    questEnv.subsystem = "quest";
    questEnv.source = "client_request";
    questEnv.targetId = todo.todoId;
    questEnv.zoneId = "harthmere_grove";
    const questMarker =
      harthmereJobsBoardQuestMarkerRuntimePositionForId("muckwad_patch")!;
    questEnv.serverActorPosition = {
      x: questMarker.position[0],
      y: questMarker.position[1],
      z: questMarker.position[2],
    };
    questEnv.payload = {
      questId: `jobs_board:${todo.todoId}`,
      completed: true,
      completedTargetId: "mucker_elite",
    };
    const questPersisted = await persistEnvelope(questEnv);

    assert.deepEqual(
      gameplayMutationWarnings(questPersisted.backendMutation?.warnings),
      []
    );
    persistedActorState = readMergedPersistedState(redisPrimary);
    assert.equal(
      persistedActorState.quests.active[`jobs_board:${todo.todoId}`],
      undefined
    );
    assert.ok(
      persistedActorState.quests.completed[`jobs_board:${todo.todoId}`]
    );
    assert.equal(
      persistedActorState.jobsBoard.todos[todo.todoId].status,
      "completed"
    );
    assert.equal(
      persistedActorState.building.inWorldMarkers[markerId],
      undefined,
      "accepted target marker should clear after the quest objective is complete"
    );

    const turnInEnv = envelope();
    turnInEnv.requestId = "live-api-persist-jobs-board-turn-in";
    turnInEnv.idempotencyKey = "live-api-persist-jobs-board-turn-in";
    turnInEnv.actionKind = "request_jobs_board_mutation";
    turnInEnv.subsystem = "jobs";
    turnInEnv.source = "client_request";
    turnInEnv.targetId = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID;
    turnInEnv.zoneId = "harthmere_grove";
    turnInEnv.serverActorPosition = {
      x: 501.99486179104775,
      y: 70,
      z: -132.00350672753194,
    };
    turnInEnv.payload = {
      operation: "complete_job",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      jobId: "job_accept_chain",
    };
    const turnInPersisted = await persistEnvelope(turnInEnv);

    assert.deepEqual(
      gameplayMutationWarnings(turnInPersisted.backendMutation?.warnings),
      []
    );
    persistedActorState = readMergedPersistedState(redisPrimary);
    assert.equal(
      persistedActorState.inventory.gold,
      1200,
      "turning in the completed accepted job should pay the escrowed reward"
    );
    assert.equal((turnInPersisted.playerStatusState as any)?.gold, 1200);
    assert.equal(
      persistedActorState.jobsBoard.postings.job_accept_chain.status,
      "completed"
    );
    assert.equal(
      persistedActorState.jobsBoard.postings.job_accept_chain.escrowGold,
      0
    );
    assert.equal(
      persistedActorState.building.inWorldMarkers[markerId],
      undefined
    );
  });

  it("seeds missing auto jobs during accept so read-only board polling stays consistent", async () => {
    const redisPrimary = new FakeRedisPrimary();
    (globalThis as any).__harthmereLiveModeRedis = { primary: redisPrimary };

    redisPrimary.store.set(
      harthmereLiveModePlayerStateKey(ACTOR),
      JSON.stringify(defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS))
    );

    const env = envelope();
    env.requestId = "live-api-persist-jobs-board-accept-seeds";
    env.idempotencyKey = "live-api-persist-jobs-board-accept-seeds";
    env.actionKind = "request_jobs_board_mutation";
    env.subsystem = "jobs";
    env.source = "client_request";
    env.targetId = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID;
    env.zoneId = "harthmere_grove";
    env.serverActorPosition = {
      x: 501.99486179104775,
      y: 70,
      z: -132.00350672753194,
    };
    env.payload = {
      operation: "accept_job",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      jobId: "harthmere_auto_1",
    };

    const mutationPlan = buildHarthmereLiveModePersistenceMutationPlan(env);
    const persisted = await persistHarthmereLiveModeResponse(
      env,
      {
        ok: true,
        version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE" as const,
        actorId: ACTOR,
        duplicate: false,
        replayed: false,
        persisted: true,
        validation: {
          ok: true,
          errors: [],
          warnings: [],
          rejectedClientClaims: [],
        },
        mutationPlan,
        events: [
          createHarthmereLiveModeEvent({
            kind: "audit_log_appended",
            envelope: env,
          }),
        ],
        uiEvents: [],
      },
      {
        logicApi: { publish: async () => {} } as any,
        userId: 1 as any,
      }
    );

    assert.deepEqual(
      gameplayMutationWarnings(persisted.backendMutation?.warnings),
      []
    );
    assert.ok(
      (persisted.jobsBoardState as any).myAcceptedJobs.some(
        (job: any) =>
          job.jobId === "harthmere_auto_1" && job.status === "active"
      ),
      "accept should persist and activate jobs that were seeded by a read-only board snapshot"
    );
    const persistedActorState = readMergedPersistedState(redisPrimary);
    assert.equal(
      persistedActorState.jobsBoard.postings.harthmere_auto_1.status,
      "active"
    );
  });

  it("persists branch outpost voxel materialization and publishes ECS edits after commit", async () => {
    const redisPrimary = new FakeRedisPrimary();
    (globalThis as any).__harthmereLiveModeRedis = { primary: redisPrimary };

    const startingState = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    addOpenProductionBusiness(startingState, "business_branch_persist");
    redisPrimary.store.set(
      harthmereLiveModePlayerStateKey(ACTOR),
      JSON.stringify(startingState)
    );

    const env = envelope();
    env.requestId = "live-api-persist-branch-materialization";
    env.idempotencyKey = "live-api-persist-branch-materialization";
    env.actionKind = "request_economy_mutation";
    env.subsystem = "economy";
    env.source = "client_request";
    env.serverActorPosition = { x: 100, y: 65, z: 100 };
    env.payload = {
      operation: "open_business_branch",
      businessId: "business_branch_persist",
      outpostId: "outpost_restaurant_redpot",
    };
    const mutationPlan = buildHarthmereLiveModePersistenceMutationPlan(env);
    const response = {
      ok: true,
      version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE" as const,
      actorId: ACTOR,
      duplicate: false,
      replayed: false,
      persisted: true,
      validation: {
        ok: true,
        errors: [],
        warnings: [],
        rejectedClientClaims: [],
      },
      mutationPlan,
      events: [
        createHarthmereLiveModeEvent({
          kind: "audit_log_appended",
          envelope: env,
        }),
      ],
      uiEvents: [],
    };
    const publishedEvents: unknown[] = [];
    const publishedBatchSizes: number[] = [];
    const persisted = await persistHarthmereLiveModeResponse(env, response, {
      logicApi: {
        publish: async (...events: unknown[]) => {
          publishedBatchSizes.push(events.length);
          publishedEvents.push(...events);
        },
      } as any,
      userId: 1 as any,
    });

    assert.equal(
      persisted.backendMutation?.buildingMaterializationPlans?.length,
      1
    );
    assert.equal(
      persisted.backendMutation?.buildingMaterializationPlans?.[0]?.requestId,
      "outpost_restaurant_redpot_backend_materialization"
    );
    assert.ok(
      persisted.backendMutation?.touchedModels.includes(
        "business_outpost_materialization"
      )
    );
    assert.ok(
      persisted.backendMutation?.warnings.some(
        (warning) =>
          warning.startsWith("building_materialized:edit_events:") &&
          warning.includes(":publish_batches:")
      )
    );
    assert.ok(publishedEvents.length > 0);
    assert.ok(publishedBatchSizes.length > 1);
    assert.ok(
      publishedBatchSizes.every(
        (size) =>
          size <= HARTHMERE_BUILDING_MATERIALIZATION_ECS_PUBLISH_CHUNK_SIZE
      )
    );

    const rawActor = redisPrimary.store.get(
      harthmereLiveModePlayerStateKey(ACTOR)
    );
    const actorState = parseHarthmereLiveModeBackendState(
      rawActor,
      ACTOR,
      NOW_MS
    );
    assert.ok(
      actorState.building.materializationPlans
        .outpost_restaurant_redpot_backend_materialization
    );
    assert.ok(
      actorState.building.placedStructures
        .outpost_restaurant_redpot_backend_materialization
    );

    const shared = parseHarthmereLiveModeSharedWorldState(
      redisPrimary.store.get(harthmereLiveModeSharedWorldStateKey()),
      NOW_MS
    );
    assert.ok(shared);
    assert.ok(
      shared.building.materializationPlans
        .outpost_restaurant_redpot_backend_materialization
    );
  });

  it("returns committed live-mode responses when post-commit materialization fails", async () => {
    const redisPrimary = new FakeRedisPrimary();
    (globalThis as any).__harthmereLiveModeRedis = { primary: redisPrimary };

    const startingState = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    addOpenProductionBusiness(startingState, "business_branch_deferred");
    redisPrimary.store.set(
      harthmereLiveModePlayerStateKey(ACTOR),
      JSON.stringify(startingState)
    );

    const env = envelope();
    env.requestId = "live-api-persist-branch-materialization-deferred";
    env.idempotencyKey = "live-api-persist-branch-materialization-deferred";
    env.actionKind = "request_economy_mutation";
    env.subsystem = "economy";
    env.source = "client_request";
    env.serverActorPosition = { x: 100, y: 65, z: 100 };
    env.payload = {
      operation: "open_business_branch",
      businessId: "business_branch_deferred",
      outpostId: "outpost_restaurant_redpot",
    };
    const mutationPlan = buildHarthmereLiveModePersistenceMutationPlan(env);
    const response = {
      ok: true,
      version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE" as const,
      actorId: ACTOR,
      duplicate: false,
      replayed: false,
      persisted: true,
      validation: {
        ok: true,
        errors: [],
        warnings: [],
        rejectedClientClaims: [],
      },
      mutationPlan,
      events: [
        createHarthmereLiveModeEvent({
          kind: "audit_log_appended",
          envelope: env,
        }),
      ],
      uiEvents: [],
    };

    const persisted = await persistHarthmereLiveModeResponse(env, response, {
      logicApi: {
        publish: async () => {
          throw new Error("simulated ECS publish outage");
        },
      } as any,
      userId: 1 as any,
    });

    assert.equal(persisted.ok, true);
    assert.equal(persisted.persisted, true);
    assert.ok(
      persisted.backendMutation?.warnings.some((warning) =>
        warning.includes(
          "building_materialization_deferred:simulated ECS publish outage"
        )
      )
    );
    const actorState = parseHarthmereLiveModeBackendState(
      redisPrimary.store.get(harthmereLiveModePlayerStateKey(ACTOR)),
      ACTOR,
      NOW_MS
    );
    assert.ok(
      actorState.building.materializationPlans
        .outpost_restaurant_redpot_backend_materialization
    );
  });

  it("keeps production-coordinate Harthmere outpost voxel edits and resolves real terrain entity ids", async () => {
    const plan =
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS.outpost_refinery_ashline
        .materializationPlan;
    const authoredPosition = plan.edits.find(
      (edit) => edit.label === "floor"
    )!.position;
    const worldPosition = buildingSystemMaterializationWorldPositionForTest(
      plan,
      authoredPosition
    );
    assert.equal(worldPosition[0], authoredPosition[0]);
    assert.equal(worldPosition[1], authoredPosition[1]);
    assert.equal(worldPosition[2], authoredPosition[2]);

    const publishedEvents: any[] = [];
    const counts = await publishBuildingSystemMaterializationPlansToEcs({
      askApi: {
        scanForExport: async function* () {
          yield [
            7,
            fakeTerrainEntityForPosition(1234567, worldPosition),
          ] as any;
        },
      },
      logicApi: {
        publish: async (...events: any[]) => {
          publishedEvents.push(...events);
        },
      } as any,
      userId: 1 as any,
      plans: [
        {
          ...plan,
          edits: [
            {
              ...plan.edits.find((edit) => edit.label === "floor")!,
              position: authoredPosition,
            },
          ],
        },
      ],
    });

    assert.equal(counts.editEventCount, 1);
    assert.equal(counts.shiftedOutpostEditEventCount, 0);
    assert.equal(counts.missingTerrainShardCount, 0);
    assert.equal(publishedEvents.length, 1);
    assert.deepEqual(publishedEvents[0].event.position, worldPosition);
    assert.equal(publishedEvents[0].event.id, 1234567);
  });

  it("writes approved outpost materialization directly to terrain shard diffs idempotently", async () => {
    const voxeloo = await loadVoxeloo();
    const world = new InMemoryWorld();
    const worldApi = ShimWorldApi.createForWorld(world);
    const plan =
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS.outpost_refinery_ashline
        .materializationPlan;
    const floorEdit = plan.edits.find((edit) => edit.label === "floor")!;
    const worldPosition = buildingSystemMaterializationWorldPositionForTest(
      plan,
      floorEdit.position
    );
    const terrainId = createEmptyTerrainShard(
      world,
      shardAlign(...worldPosition)
    );
    const askApi = {
      scanForExport: async function* () {
        yield [
          7,
          fakeTerrainEntityForPosition(terrainId, worldPosition),
        ] as any;
      },
    };
    const oneEditPlan = {
      ...plan,
      edits: [floorEdit],
    };

    const first = await materializeBuildingSystemMaterializationPlansToTerrain({
      askApi,
      userId: 1 as any,
      worldApi,
      plans: [oneEditPlan],
    });
    const second = await materializeBuildingSystemMaterializationPlansToTerrain(
      {
        askApi,
        userId: 1 as any,
        worldApi,
        plans: [oneEditPlan],
      }
    );

    assert.equal(first.directTerrainEditCount, 1);
    assert.equal(first.directTerrainShardCount, 1);
    assert.equal(second.directTerrainEditCount, 1);
    assert.equal(second.directTerrainShardCount, 1);
    const terrain = world.table.get(terrainId);
    assert.ok(terrain?.shard_diff);
    const diff = new voxeloo.SparseBlock_U32();
    const placer = new voxeloo.SparseBlock_U32();
    try {
      loadBlockWrapper(voxeloo, diff, terrain.shard_diff);
      loadBlockWrapper(voxeloo, placer, terrain.shard_placer);
      assert.equal(diff.get(...blockPos(...worldPosition)), floorEdit.value);
      assert.equal(placer.get(...blockPos(...worldPosition)), 1);
    } finally {
      diff.delete();
      placer.delete();
    }
  });

  it("refuses to overwrite a concurrently occupied terrain value", async () => {
    const world = new InMemoryWorld();
    const worldApi = ShimWorldApi.createForWorld(world);
    const plan =
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS.outpost_refinery_ashline
        .materializationPlan;
    const floorEdit = plan.edits.find((edit) => edit.label === "floor")!;
    const worldPosition = buildingSystemMaterializationWorldPositionForTest(
      plan,
      floorEdit.position
    );
    const terrainId = createEmptyTerrainShard(
      world,
      shardAlign(...worldPosition)
    );
    const askApi = {
      scanForExport: async function* () {
        yield [
          7,
          fakeTerrainEntityForPosition(terrainId, worldPosition),
        ] as any;
      },
    };
    await materializeBuildingSystemMaterializationPlansToTerrain({
      askApi,
      userId: 1 as any,
      worldApi,
      plans: [{ ...plan, edits: [floorEdit] }],
    });

    await assert.rejects(
      materializeBuildingSystemMaterializationPlansToTerrain({
        askApi,
        userId: 2 as any,
        worldApi,
        plans: [
          {
            ...plan,
            actorId: "2",
            edits: [{ ...floorEdit, value: (floorEdit.value + 1) as any }],
          },
        ],
      }),
      /would overwrite terrain/
    );
  });

  it("acknowledges a structure only after successful ECS materialization", async () => {
    const redis = new FakeRedisPrimary();
    const state = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    const plan =
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS.outpost_refinery_ashline
        .materializationPlan;
    state.building.placedStructures[plan.requestId] = {
      ...state.building.placedStructures[plan.requestId],
      materializedInEcs: false,
    };
    const sharedKey = harthmereLiveModeSharedWorldStateKey();
    redis.store.set(
      sharedKey,
      JSON.stringify(createHarthmereLiveModeSharedWorldState(state, NOW_MS))
    );

    const count = await markBuildingMaterializationPlansAppliedForTest({
      redisPrimary: redis as any,
      sharedWorldStateKey: sharedKey,
      plans: [plan],
      nowMs: NOW_MS + 1,
    });
    assert.equal(count, 1);
    const shared = parseHarthmereLiveModeSharedWorldState(
      redis.store.get(sharedKey),
      NOW_MS + 1
    );
    assert.equal(
      shared?.building.placedStructures[plan.requestId].materializedInEcs,
      true
    );
  });

  it("publishes outpost voxel materialization for install actors without Biomes auth", async () => {
    const redisPrimary = new FakeRedisPrimary();
    (globalThis as any).__harthmereLiveModeRedis = { primary: redisPrimary };

    const startingState = defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
    addOpenProductionBusiness(startingState, "business_branch_install");
    redisPrimary.store.set(
      harthmereLiveModePlayerStateKey(ACTOR),
      JSON.stringify(startingState)
    );

    const env = envelope();
    env.requestId = "live-api-persist-install-branch-materialization";
    env.idempotencyKey = "live-api-persist-install-branch-materialization";
    env.actionKind = "request_economy_mutation";
    env.subsystem = "economy";
    env.source = "client_request";
    env.serverActorPosition = { x: 100, y: 65, z: 100 };
    env.payload = {
      operation: "open_business_branch",
      businessId: "business_branch_install",
      outpostId: "outpost_restaurant_redpot",
    };
    const mutationPlan = buildHarthmereLiveModePersistenceMutationPlan(env);
    const response = {
      ok: true,
      version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE" as const,
      actorId: ACTOR,
      duplicate: false,
      replayed: false,
      persisted: true,
      validation: {
        ok: true,
        errors: [],
        warnings: [],
        rejectedClientClaims: [],
      },
      mutationPlan,
      events: [
        createHarthmereLiveModeEvent({
          kind: "audit_log_appended",
          envelope: env,
        }),
      ],
      uiEvents: [],
    };
    const publishedEvents: unknown[] = [];
    const publishedBatchSizes: number[] = [];
    const persisted = await persistHarthmereLiveModeResponse(env, response, {
      logicApi: {
        publish: async (...events: unknown[]) => {
          publishedBatchSizes.push(events.length);
          publishedEvents.push(...events);
        },
      } as any,
    });

    assert.equal(
      persisted.backendMutation?.buildingMaterializationPlans?.length,
      1
    );
    assert.ok(
      persisted.backendMutation?.warnings.some(
        (warning) =>
          warning.startsWith("building_materialized:edit_events:") &&
          warning.includes(":publish_batches:")
      )
    );
    assert.ok(
      persisted.backendMutation?.warnings.includes(
        "building_materialized_with_world_materializer_user"
      )
    );
    assert.equal(
      persisted.backendMutation?.warnings.includes(
        "building_materialization_skipped:missing_authenticated_user"
      ),
      false
    );
    assert.ok(publishedEvents.length > 0);
    assert.ok(publishedBatchSizes.length > 1);
    assert.ok(
      publishedBatchSizes.every(
        (size) =>
          size <= HARTHMERE_BUILDING_MATERIALIZATION_ECS_PUBLISH_CHUNK_SIZE
      )
    );
    assert.ok(
      publishedEvents.every((event) => (event as any).userId !== undefined)
    );
  });
});
