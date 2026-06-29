import assert from "assert";
import {
  HARTHMERE_BUILDING_MATERIALIZATION_ECS_PUBLISH_CHUNK_SIZE,
  buildingSystemMaterializationWorldPositionForTest,
  combatActorPositionFromInstallLiveModeBody,
  harthmereLiveModeMutationSnapshotKeys,
  jobsBoardPositionFromLiveModeBody,
  liveModeActorIdentityFromRequest,
  materializeBuildingSystemMaterializationPlansToTerrain,
  persistHarthmereLiveModeResponse,
  preserveFreshHarthmereLiveModeStatusChannelsForTest,
  publishBuildingSystemMaterializationPlansToEcs,
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
  harthmereLiveModePlayerStateKey,
  harthmereLiveModeSharedWorldStateKey,
  parseHarthmereLiveModeBackendState,
  defaultHarthmereLiveModeBackendState,
  parseHarthmereLiveModeSharedWorldState,
} from "@/shared/harthmere/live_mode_backend";
import {
  buildHarthmereLiveModePersistenceMutationPlan,
  createHarthmereLiveModeEvent,
  createHarthmereLiveModeUiEvent,
  type HarthmereLiveModeAuthorityEnvelope,
} from "@/shared/harthmere/live_mode_readiness";
import { loadBlockWrapper } from "@/shared/wasm/biomes";

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

  async set(key: string, value: string) {
    this.txOps.push(["direct_set", key]);
    this.store.set(key, value);
    return "OK";
  }

  async xadd() {
    return "1-0";
  }
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
      assert.deepEqual(redisPrimary.watched[0], [
        "harthmere:live_mode:current:idempotency:player_live_api_persist_001:live-api-persist-idem-1",
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
        "harthmere:live_mode:current:idempotency:player_live_api_persist_001:live-api-persist-idem-1";
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
      assert.deepEqual(replay.includedSnapshots, []);
      assert.equal(replay.playerStatusState, undefined);
    }));

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
    assert.deepEqual(persisted.backendMutation?.touchedModels?.sort(), [
      "building_state",
      "inventory_items",
      "quest_state",
    ]);
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
    assert.ok(
      redisPrimary.txOps.some(
        (op) =>
          op[0] === "set" &&
          op[1] ===
            "harthmere:live_mode:current:idempotency:player_live_api_persist_001:live-api-persist-helper-read"
      ),
      "read response should still write idempotency inside the transaction"
    );
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

    assert.deepEqual(redisPrimary.watched[0], [
      "harthmere:live_mode:current:idempotency:player_live_api_persist_001:live-api-persist-idem-1",
      targetKey,
      harthmereLiveModeSharedWorldStateKey(),
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
      const rawActor = redisPrimary.store.get(
        harthmereLiveModePlayerStateKey(ACTOR)
      );
      const actorState = parseHarthmereLiveModeBackendState(
        rawActor,
        ACTOR,
        NOW_MS
      );
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
    assert.deepEqual(acceptReplay.includedSnapshots, []);
    assert.equal(acceptReplay.jobsBoardState, undefined);
    assert.equal(acceptReplay.questState, undefined);
    assert.equal(acceptReplay.inventoryLootState, undefined);
    assert.equal(acceptReplay.playerStatusState, undefined);
    assert.equal(acceptReplay.buildingState, undefined);

    let rawActor = redisPrimary.store.get(
      harthmereLiveModePlayerStateKey(ACTOR)
    );
    let persistedActorState = parseHarthmereLiveModeBackendState(
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

    assert.deepEqual(
      gameplayMutationWarnings(questPersisted.backendMutation?.warnings),
      []
    );
    rawActor = redisPrimary.store.get(harthmereLiveModePlayerStateKey(ACTOR));
    persistedActorState = parseHarthmereLiveModeBackendState(
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
    rawActor = redisPrimary.store.get(harthmereLiveModePlayerStateKey(ACTOR));
    persistedActorState = parseHarthmereLiveModeBackendState(
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
    const rawActor = redisPrimary.store.get(
      harthmereLiveModePlayerStateKey(ACTOR)
    );
    const persistedActorState = parseHarthmereLiveModeBackendState(
      rawActor,
      ACTOR,
      NOW_MS
    );
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
    try {
      loadBlockWrapper(voxeloo, diff, terrain.shard_diff);
      assert.equal(diff.get(...blockPos(...worldPosition)), floorEdit.value);
    } finally {
      diff.delete();
    }
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
