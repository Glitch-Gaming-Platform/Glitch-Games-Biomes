import assert from "assert";
import {
  jobsBoardPositionFromLiveModeBodyV151,
  liveModeActorIdentityFromRequestV151,
  persistHarthmereLiveModeResponseV1,
  readServerActorPositionForLiveModeV145,
} from "../live_mode";
import { HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1 } from "@/shared/harthmere/mmo_jobs_board_authority_v1";
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

const ACTOR = "player_live_api_persist_001";
const NOW_MS = 1_700_400_000_000;

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

function addOpenProductionBusiness(state: ReturnType<typeof defaultHarthmereLiveModeBackendStateV1>, businessId: string) {
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
  (state.economy.production.businessSystems as any).customerStats[businessId] = {
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

  it("uses WATCH/MULTI and records idempotency only with the state mutation", async () => {
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
  });

  it("hydrates public economy from shared world state before reducing actor mutations", async () => {
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
    const persisted = await persistHarthmereLiveModeResponseV1(env, response, {
      logicApi: {
        publish: async (...events: unknown[]) => {
          publishedEvents.push(...events);
        },
      } as any,
      userId: 1 as any,
    });

    assert.equal(persisted.backendMutation?.buildingMaterializationPlans?.length, 1);
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
      persisted.backendMutation?.warnings.some((warning) =>
        warning.startsWith("building_materialized:edit_events:")
      )
    );
    assert.ok(publishedEvents.length > 0);

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
});
