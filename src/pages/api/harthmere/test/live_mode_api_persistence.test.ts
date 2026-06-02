import assert from "assert";
import {
  HARTHMERE_BUILDING_MATERIALIZATION_ECS_PUBLISH_CHUNK_SIZE_V1,
  buildingSystemMaterializationWorldPositionForTestV1,
  harthmereLiveModeMutationSnapshotKeysV1,
  jobsBoardPositionFromLiveModeBodyV151,
  liveModeActorIdentityFromRequestV151,
  materializeBuildingSystemMaterializationPlansToTerrainV1,
  persistHarthmereLiveModeResponseV1,
  publishBuildingSystemMaterializationPlansToEcsV1,
  readServerActorPositionForLiveModeV145,
} from "../live_mode";
import { createEmptyTerrainShard } from "@/server/test/test_helpers";
import { InMemoryWorld } from "@/server/shared/world/shim/in_memory_world";
import { ShimWorldApi } from "@/server/shared/world/shim/api";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import { HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1 } from "@/shared/harthmere/mmo_jobs_board_authority_v1";
import { HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1 } from "@/shared/harthmere/business_customer_simulator_v1";
import { SHARD_DIM, blockPos, shardAlign } from "@/shared/game/shard";
import {
  createHarthmereLiveModeSharedWorldStateV1,
  harthmereLiveModePlayerStateKeyV1,
  harthmereLiveModeSharedWorldStateKeyV1,
  parseHarthmereLiveModeBackendStateV1,
  defaultHarthmereLiveModeBackendStateV1,
  parseHarthmereLiveModeSharedWorldStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";
import {
  buildHarthmereLiveModePersistenceMutationPlanV1,
  createHarthmereLiveModeEventV1,
  createHarthmereLiveModeUiEventV1,
  type HarthmereLiveModeAuthorityEnvelopeV1,
} from "@/shared/harthmere/live_mode_readiness_v1";
import { loadBlockWrapper } from "@/shared/wasm/biomes";

const ACTOR = "player_live_api_persist_001";
const NOW_MS = 1_700_400_000_000;

async function withFullLiveModeMutationSnapshotsForTestV1(
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
  const v0 = shardAlign(...position);
  return {
    id,
    hasShardSeed: () => true,
    hasBox: () => true,
    box: () => ({
      v0,
      v1: [v0[0] + SHARD_DIM, v0[1] + SHARD_DIM, v0[2] + SHARD_DIM],
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

  async set(key: string, value: string) {
    this.txOps.push(["direct_set", key]);
    this.store.set(key, value);
    return "OK";
  }

  async xadd() {
    return "1-0";
  }
}

function envelope(): HarthmereLiveModeAuthorityEnvelopeV1 {
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
  state: ReturnType<typeof defaultHarthmereLiveModeBackendStateV1>,
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

describe("live_mode API Redis persistence", () => {
  it("uses Glitch install ids as live-mode actors when Biomes auth is absent", () => {
    assert.deepEqual(
      liveModeActorIdentityFromRequestV151({
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
      liveModeActorIdentityFromRequestV151({
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
      liveModeActorIdentityFromRequestV151({
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
      jobsBoardPositionFromLiveModeBodyV151({
        requestId: "jobs-board-pos",
        idempotencyKey: "jobs-board-pos",
        targetId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        actionKind: "request_jobs_board_mutation",
        subsystem: "jobs",
        actorEntityVersion: 1,
        targetEntityVersion: 1,
        zoneId: "harthmere_grove",
        payload: {
          operation: "accept_job",
          boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
        },
      } as any),
      { x: 501.99486179104775, y: 70, z: -132.00350672753194 }
    );
    assert.equal(
      jobsBoardPositionFromLiveModeBodyV151({
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
      jobsBoardPositionFromLiveModeBodyV151({
        requestId: "not-jobs",
        idempotencyKey: "not-jobs",
        actionKind: "request_inventory_mutation",
        subsystem: "inventory",
        actorEntityVersion: 1,
        zoneId: "harthmere_grove",
        payload: { boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1 },
      } as any),
      undefined
    );
  });

  it("reads the server-side actor position for jobs board proximity without trusting client claims", async () => {
    const position = await readServerActorPositionForLiveModeV145(
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

    const missing = await readServerActorPositionForLiveModeV145(
      {
        get: async () => ({
          position: () => ({ v: [Number.NaN, 70, -132.00350672753194] }),
        }),
      } as any,
      1 as any
    );
    assert.equal(missing, undefined);
  });

  it("keeps jobs-board mutation snapshots slim without cutting building snapshots from building actions", () => {
    assert.deepEqual(
      harthmereLiveModeMutationSnapshotKeysV1({
        actionKind: "request_jobs_board_mutation",
        subsystem: "jobs",
        touchedModels: ["jobs_board_posting", "jobs_board_quest_todo"],
      }).sort(),
      [
        "inventoryLootState",
        "jobsBoardState",
        "playerStatusState",
        "questState",
      ],
    );
    assert.ok(
      harthmereLiveModeMutationSnapshotKeysV1({
        actionKind: "request_property_building_mutation",
        subsystem: "building",
        touchedModels: ["building_state", "property"],
      }).includes("buildingState"),
      "building mutations must still return buildingState",
    );
  });

  it("uses WATCH/MULTI and records idempotency only with the state mutation", async () =>
    withFullLiveModeMutationSnapshotsForTestV1(async () => {
    const redisPrimary = new FakeRedisPrimary();
    (globalThis as any).__harthmereLiveModeRedisV1 = { primary: redisPrimary };

    const env = envelope();
    const mutationPlan = buildHarthmereLiveModePersistenceMutationPlanV1(env);
    const response = {
      ok: true,
      version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE_V1" as const,
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
        createHarthmereLiveModeEventV1({
          kind: "xp_reward_resolved",
          envelope: env,
        }),
      ],
      uiEvents: [
        createHarthmereLiveModeUiEventV1({
          kind: "level_up_toast",
          envelope: env,
        }),
      ],
    };

    const persisted = await persistHarthmereLiveModeResponseV1(env, response, {
      logicApi: { publish: async () => {} } as any,
      userId: 1 as any,
    });

    const playerKey = harthmereLiveModePlayerStateKeyV1(ACTOR);
    const sharedWorldKey = harthmereLiveModeSharedWorldStateKeyV1();
    assert.deepEqual(redisPrimary.watched[0], [
      "harthmere:live_mode:v1:idempotency:player_live_api_persist_001:live-api-persist-idem-1",
      playerKey,
      sharedWorldKey,
    ]);
    const firstSet = redisPrimary.txOps.find((op) => op[0] === "set");
    assert.equal(firstSet?.[1], playerKey);
    assert.ok(
      redisPrimary.txOps.some(
        (op) => op[0] === "set" && op[1] === sharedWorldKey
      )
    );
    assert.equal(
      redisPrimary.txOps.some((op) => op[0] === "direct_set"),
      false
    );
    const idempotencyKey =
      "harthmere:live_mode:v1:idempotency:player_live_api_persist_001:live-api-persist-idem-1";
    const storedIdempotency = JSON.parse(
      redisPrimary.store.get(idempotencyKey) ?? "{}"
    );
    assert.deepEqual(storedIdempotency.includedSnapshots, []);
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
      (persisted.farmingFoodState as any)?.cookingRecipes?.grilled_meat?.outputs
        ?.grilled_meat,
      1
    );
    assert.ok(
      (persisted.farmingFoodState as any)?.availableCookingStations?.includes(
        "campfire"
      )
    );

    const rawState = redisPrimary.store.get(playerKey);
    const state = parseHarthmereLiveModeBackendStateV1(rawState, ACTOR, NOW_MS);
    assert.equal(state.classMagic.skills.combat?.xp, 100);

    const replay = await persistHarthmereLiveModeResponseV1(env, response, {
      logicApi: { publish: async () => {} } as any,
      userId: 1 as any,
    });
    assert.equal(replay.duplicate, true);
    assert.equal(replay.replayed, true);
    assert.deepEqual(replay.includedSnapshots, []);
    assert.equal(replay.playerStatusState, undefined);
    }));

  it("hydrates public economy from shared world state before reducing actor mutations", async () =>
    withFullLiveModeMutationSnapshotsForTestV1(async () => {
    const redisPrimary = new FakeRedisPrimary();
    (globalThis as any).__harthmereLiveModeRedisV1 = { primary: redisPrimary };

    const sharedSource = defaultHarthmereLiveModeBackendStateV1(
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
      harthmereLiveModeSharedWorldStateKeyV1(),
      JSON.stringify(
        createHarthmereLiveModeSharedWorldStateV1(sharedSource, NOW_MS)
      )
    );

    const env = envelope();
    env.requestId = "live-api-persist-req-shared";
    env.idempotencyKey = "live-api-persist-idem-shared";
    const mutationPlan = buildHarthmereLiveModePersistenceMutationPlanV1(env);
    const response = {
      ok: true,
      version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE_V1" as const,
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
        createHarthmereLiveModeEventV1({
          kind: "xp_reward_resolved",
          envelope: env,
        }),
      ],
      uiEvents: [],
    };

    const persisted = await persistHarthmereLiveModeResponseV1(env, response, {
      logicApi: { publish: async () => {} } as any,
      userId: 1 as any,
    });

    assert.ok((persisted.economyState as any).businesses.shared_shop);
    const rawActor = redisPrimary.store.get(
      harthmereLiveModePlayerStateKeyV1(ACTOR)
    );
    const actorState = parseHarthmereLiveModeBackendStateV1(
      rawActor,
      ACTOR,
      NOW_MS
    );
      assert.ok(actorState.economy.production.businesses.shared_shop);
    }));

  it("persists accepted jobs board jobs as actor quests with map markers", async () => {
    const redisPrimary = new FakeRedisPrimary();
    (globalThis as any).__harthmereLiveModeRedisV1 = { primary: redisPrimary };

    const actorState = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    const sharedSource = defaultHarthmereLiveModeBackendStateV1(
      "shared_board",
      NOW_MS
    );
    const deadlineAtMs = Date.now() + 86_400_000;
    sharedSource.jobsBoard.postings.job_accept_chain = {
      jobId: "job_accept_chain",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
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
      harthmereLiveModePlayerStateKeyV1(ACTOR),
      JSON.stringify(actorState)
    );
    redisPrimary.store.set(
      harthmereLiveModeSharedWorldStateKeyV1(),
      JSON.stringify(
        createHarthmereLiveModeSharedWorldStateV1(sharedSource, NOW_MS)
      )
    );

    const persistEnvelope = async (
      requestEnv: HarthmereLiveModeAuthorityEnvelopeV1
    ) => {
      const mutationPlan =
        buildHarthmereLiveModePersistenceMutationPlanV1(requestEnv);
      return persistHarthmereLiveModeResponseV1(
        requestEnv,
        {
          ok: true,
          version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE_V1" as const,
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
            createHarthmereLiveModeEventV1({
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
    env.targetId = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1;
    env.zoneId = "harthmere_grove";
    env.serverActorPosition = {
      x: 501.99486179104775,
      y: 70,
      z: -132.00350672753194,
    };
    env.payload = {
      operation: "accept_job",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      jobId: "job_accept_chain",
    };
    const persisted = await persistEnvelope(env);

    assert.deepEqual(persisted.backendMutation?.warnings, []);
    assert.equal(persisted.snapshotMode, "changed");
    assert.deepEqual(persisted.includedSnapshots?.sort(), [
      "inventoryLootState",
      "jobsBoardState",
      "playerStatusState",
      "questState",
    ]);
    assert.equal(persisted.economyState, undefined);
    assert.equal(
      persisted.buildingState,
      undefined,
      "jobs-board accepts should not return the unrelated building snapshot"
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
    assert.deepEqual(acceptReplay.includedSnapshots, []);
    assert.equal(acceptReplay.jobsBoardState, undefined);
    assert.equal(acceptReplay.questState, undefined);
    assert.equal(acceptReplay.inventoryLootState, undefined);
    assert.equal(acceptReplay.playerStatusState, undefined);
    assert.equal(acceptReplay.buildingState, undefined);

    let rawActor = redisPrimary.store.get(
      harthmereLiveModePlayerStateKeyV1(ACTOR)
    );
    let persistedActorState = parseHarthmereLiveModeBackendStateV1(
      rawActor,
      ACTOR,
      NOW_MS
    );
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
    questEnv.payload = {
      questId: `jobs_board:${todo.todoId}`,
      completed: true,
      completedTargetId: "mucker_elite",
    };
    const questPersisted = await persistEnvelope(questEnv);

    assert.deepEqual(questPersisted.backendMutation?.warnings, []);
    rawActor = redisPrimary.store.get(harthmereLiveModePlayerStateKeyV1(ACTOR));
    persistedActorState = parseHarthmereLiveModeBackendStateV1(
      rawActor,
      ACTOR,
      NOW_MS
    );
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
    turnInEnv.targetId = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1;
    turnInEnv.zoneId = "harthmere_grove";
    turnInEnv.serverActorPosition = {
      x: 501.99486179104775,
      y: 70,
      z: -132.00350672753194,
    };
    turnInEnv.payload = {
      operation: "complete_job",
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      jobId: "job_accept_chain",
    };
    const turnInPersisted = await persistEnvelope(turnInEnv);

    assert.deepEqual(turnInPersisted.backendMutation?.warnings, []);
    rawActor = redisPrimary.store.get(harthmereLiveModePlayerStateKeyV1(ACTOR));
    persistedActorState = parseHarthmereLiveModeBackendStateV1(
      rawActor,
      ACTOR,
      NOW_MS
    );
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

  it("persists branch outpost voxel materialization and publishes ECS edits after commit", async () => {
    const redisPrimary = new FakeRedisPrimary();
    (globalThis as any).__harthmereLiveModeRedisV1 = { primary: redisPrimary };

    const startingState = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    addOpenProductionBusiness(startingState, "business_branch_persist");
    redisPrimary.store.set(
      harthmereLiveModePlayerStateKeyV1(ACTOR),
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
    const mutationPlan = buildHarthmereLiveModePersistenceMutationPlanV1(env);
    const response = {
      ok: true,
      version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE_V1" as const,
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
        createHarthmereLiveModeEventV1({
          kind: "audit_log_appended",
          envelope: env,
        }),
      ],
      uiEvents: [],
    };
    const publishedEvents: unknown[] = [];
    const publishedBatchSizes: number[] = [];
    const persisted = await persistHarthmereLiveModeResponseV1(env, response, {
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
          size <= HARTHMERE_BUILDING_MATERIALIZATION_ECS_PUBLISH_CHUNK_SIZE_V1
      )
    );

    const rawActor = redisPrimary.store.get(
      harthmereLiveModePlayerStateKeyV1(ACTOR)
    );
    const actorState = parseHarthmereLiveModeBackendStateV1(
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

    const shared = parseHarthmereLiveModeSharedWorldStateV1(
      redisPrimary.store.get(harthmereLiveModeSharedWorldStateKeyV1()),
      NOW_MS
    );
    assert.ok(shared);
    assert.ok(
      shared.building.materializationPlans
        .outpost_restaurant_redpot_backend_materialization
    );
  });

  it("keeps production-coordinate Harthmere outpost voxel edits and resolves real terrain entity ids", async () => {
    const plan =
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1
        .outpost_refinery_ashline.materializationPlan;
    const authoredPosition = plan.edits.find(
      (edit) => edit.label === "floor"
    )!.position;
    const worldPosition = buildingSystemMaterializationWorldPositionForTestV1(
      plan,
      authoredPosition
    );
    assert.equal(worldPosition[0], authoredPosition[0]);
    assert.equal(worldPosition[1], authoredPosition[1]);
    assert.equal(worldPosition[2], authoredPosition[2]);

    const publishedEvents: any[] = [];
    const counts = await publishBuildingSystemMaterializationPlansToEcsV1({
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
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1
        .outpost_refinery_ashline.materializationPlan;
    const floorEdit = plan.edits.find((edit) => edit.label === "floor")!;
    const worldPosition = buildingSystemMaterializationWorldPositionForTestV1(
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

    const first =
      await materializeBuildingSystemMaterializationPlansToTerrainV1({
        askApi,
        userId: 1 as any,
        worldApi,
        plans: [oneEditPlan],
      });
    const second =
      await materializeBuildingSystemMaterializationPlansToTerrainV1({
        askApi,
        userId: 1 as any,
        worldApi,
        plans: [oneEditPlan],
      });

    assert.equal(first.directTerrainEditCount, 1);
    assert.equal(first.directTerrainShardCount, 1);
    assert.equal(second.directTerrainEditCount, 1);
    assert.equal(second.directTerrainShardCount, 1);
    const terrain = world.table.get(terrainId);
    assert.ok(terrain?.shard_diff);
    const diff = new voxeloo.SparseBlock_U32();
    try {
      loadBlockWrapper(voxeloo, diff, terrain.shard_diff);
      assert.equal(diff.get(...blockPos(...worldPosition)), floorEdit.value);
    } finally {
      diff.delete();
    }
  });

  it("publishes outpost voxel materialization for install actors without Biomes auth", async () => {
    const redisPrimary = new FakeRedisPrimary();
    (globalThis as any).__harthmereLiveModeRedisV1 = { primary: redisPrimary };

    const startingState = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    addOpenProductionBusiness(startingState, "business_branch_install");
    redisPrimary.store.set(
      harthmereLiveModePlayerStateKeyV1(ACTOR),
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
    const mutationPlan = buildHarthmereLiveModePersistenceMutationPlanV1(env);
    const response = {
      ok: true,
      version: "HARTHMERE_LIVE_MODE_SERVER_ROUTE_V1" as const,
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
        createHarthmereLiveModeEventV1({
          kind: "audit_log_appended",
          envelope: env,
        }),
      ],
      uiEvents: [],
    };
    const publishedEvents: unknown[] = [];
    const publishedBatchSizes: number[] = [];
    const persisted = await persistHarthmereLiveModeResponseV1(env, response, {
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
          size <= HARTHMERE_BUILDING_MATERIALIZATION_ECS_PUBLISH_CHUNK_SIZE_V1
      )
    );
    assert.ok(
      publishedEvents.every((event) => (event as any).userId !== undefined)
    );
  });
});
