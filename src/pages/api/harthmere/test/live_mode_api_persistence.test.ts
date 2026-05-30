import assert from "assert";
import {
  persistHarthmereLiveModeResponseV1,
  readServerActorPositionForLiveModeV145,
} from "../live_mode";
import {
  createHarthmereLiveModeSharedWorldStateV1,
  harthmereLiveModePlayerStateKeyV1,
  harthmereLiveModeSharedWorldStateKeyV1,
  parseHarthmereLiveModeBackendStateV1,
  defaultHarthmereLiveModeBackendStateV1,
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

describe("live_mode API Redis persistence", () => {
  it("reads the server-side actor position for jobs board proximity without trusting client claims", async () => {
    const position = await readServerActorPositionForLiveModeV145(
      {
        get: async () => ({
          position: () => ({ v: [501.99486179104775, 70, -132.00350672753194] }),
        }),
      } as any,
      1 as any,
    );
    assert.deepEqual(position, { x: 501.99486179104775, y: 70, z: -132.00350672753194 });

    const missing = await readServerActorPositionForLiveModeV145(
      { get: async () => ({ position: () => ({ v: [Number.NaN, 70, -132.00350672753194] }) }) } as any,
      1 as any,
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
      validation: { ok: true, errors: [], warnings: [], rejectedClientClaims: [] },
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
    assert.ok(redisPrimary.txOps.some((op) => op[0] === "set" && op[1] === sharedWorldKey));
    assert.equal(redisPrimary.txOps.some((op) => op[0] === "direct_set"), false);
    assert.equal(persisted.backendMutation?.warnings.length, 0);
    assert.equal((persisted.playerStatusState as any)?.combat?.hp, 100);
    assert.equal((persisted.playerStatusState as any)?.level, 1);
    assert.equal(
      (persisted.farmingFoodState as any)?.stamina,
      (persisted.farmingFoodState as any)?.maxStamina
    );
    assert.ok((persisted.farmingFoodState as any)?.maxStamina >= 100);
    assert.equal(typeof (persisted.farmingFoodState as any)?.inventory, "object");
    assert.equal(
      (persisted.farmingFoodState as any)?.foodDefinitions?.road_ration?.staminaRestore,
      24
    );
    assert.equal(
      (persisted.farmingFoodState as any)?.cookingRecipes?.grilled_meat?.outputs?.grilled_meat,
      1
    );
    assert.ok((persisted.farmingFoodState as any)?.availableCookingStations?.includes("campfire"));

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

    const sharedSource = defaultHarthmereLiveModeBackendStateV1("shared_actor", NOW_MS);
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
      JSON.stringify(createHarthmereLiveModeSharedWorldStateV1(sharedSource, NOW_MS)),
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
      validation: { ok: true, errors: [], warnings: [], rejectedClientClaims: [] },
      mutationPlan,
      events: [createHarthmereLiveModeEventV1({ kind: "xp_reward_resolved", envelope: env })],
      uiEvents: [],
    };

    const persisted = await persistHarthmereLiveModeResponseV1(env, response, {
      logicApi: { publish: async () => {} } as any,
      userId: 1 as any,
    });

    assert.ok((persisted.economyState as any).businesses.shared_shop);
    const rawActor = redisPrimary.store.get(harthmereLiveModePlayerStateKeyV1(ACTOR));
    const actorState = parseHarthmereLiveModeBackendStateV1(rawActor, ACTOR, NOW_MS);
    assert.ok(actorState.economy.production.businesses.shared_shop);
  });
});
