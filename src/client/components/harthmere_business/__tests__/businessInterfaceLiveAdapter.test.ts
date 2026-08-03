/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import { build } from "esbuild";
import { existsSync, statSync } from "fs";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { HarthmereBusinessInteractionPrompt } from "../HarthmereBusinessInteractionPrompt";
import { HarthmereBusinessInterfacePanel } from "../HarthmereBusinessInterfacePanel";
import {
  HarthmereBusinessLiveContainer,
  mergeHarthmereBusinessWorldContext,
} from "../HarthmereBusinessLiveContainer";
import { harthmereBusinessDynamicWorldBoards } from "../HarthmereBusinessWorldInteraction";
import {
  beginPointerLockUnlockWhileOpen,
  endPointerLockUnlockWhileOpen,
} from "@/client/components/contexts/pointerLockModalPolicy";
import {
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS,
  HARTHMERE_BUSINESS_OUTPOSTS,
  harthmereBusinessOutpostBusinessId,
} from "../../../../shared/harthmere/business_customer_simulator";
import {
  HARTHMERE_BUSINESS_SERVICE_ACTIONS,
  HARTHMERE_BUSINESS_TYPE_ORDER,
  canCustomerUseHarthmereBusiness,
  createHarthmereBusinessInterfaceAdapter,
  fetchHarthmereBusinessEconomyState,
  formatHarthmereBusinessPlayerWarning,
  getHarthmereBusinessCompliancePanel,
  getHarthmereBusinessCustomerMiniGame,
  getHarthmereBusinessFieldServiceSpec,
  getHarthmereBusinessFinancePanel,
  getHarthmereBusinessEmpirePanel,
  getHarthmereBusinessGrowthReport,
  getHarthmereBusinessInteractionPrompt,
  getHarthmereBusinessOperationScreen,
  getHarthmereBusinessServiceQuests,
  getHarthmereBusinessShopfront,
  getHarthmereBusinessStaffPanel,
  getHarthmereContractBoard,
  getHarthmereGuildBusinessPanel,
  getHarthmereMarketplacePanel,
  getHarthmereOwnerDashboard,
  getHarthmereTownHallPanel,
  requiresHarthmereFieldServiceQuest,
  getHarthmereBusinessActorMode,
  getHarthmereBusinessServiceActions,
  getHarthmereCustomerOrders,
  getHarthmereVisibleBusinessInventory,
  harthmereBusinessServicePriceGold,
  harthmereBusinessWorldContextPayload,
  isHarthmereBusinessInterfaceAvailable,
  nearestHarthmereBusinessDashboardWorldContext,
  normalizeHarthmereBusinessEconomySnapshot,
  submitHarthmereBusinessEconomyMutation,
  type HarthmereBusinessEconomySnapshot,
  type HarthmereBusinessTypeId,
} from "../businessInterfaceLiveAdapter";
import { HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT } from "@/client/components/challenges/harthmereEvents";
import type { BiomesId } from "@/shared/ids";

function resolveRepoAliasForEsbuild(importPath: string) {
  const basePath = path.join(process.cwd(), "src", importPath.slice(2));
  for (const candidate of [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.json`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
    basePath,
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return basePath;
}

function visibleTextFromStaticMarkup(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function businessType(typeId: HarthmereBusinessTypeId) {
  return {
    typeId,
    displayName: typeId.replace(/_/g, " "),
    category: "test",
    startCostGold: 100,
    materialNeed: "medium",
    baseStorageSlots: 12,
    baseUpkeepGoldPerDay: 5,
    requiredLicense: "basic_trade",
    minimumLicenseLevel: 1,
    serviceNeeds: ["food"],
    inputItemFamilies: [],
    outputItemFamilies: [],
    riskLevel: 1,
    civicImportance: 1,
  };
}

function business(
  id: string,
  typeId: HarthmereBusinessTypeId,
  ownerId = "player_a"
) {
  return {
    businessId: id,
    ownerKind: "player" as const,
    ownerId,
    typeId,
    name: `${typeId} Shop`,
    status: "open" as const,
    licenseClass: "basic_trade",
    licenseLevel: 2,
    propertyId: `property_${id}`,
    townId: "harthmere_grove",
    regionId: "harthmere_grove_region",
    inventory: {
      worker_meal: { itemId: "worker_meal", count: 6 },
      rare_seed: {
        itemId: "rare_seed",
        count: 2,
        expiresAtMs: 1_900_000_000_000,
      },
    },
    storageMaxSlots: 12,
    employees: ["employee_1"],
    activeContracts: ["contract_2"],
    completedContracts: 3,
    reputation: 12,
    customerSatisfaction: 76,
    sanitationRating: 70,
    safetyRating: 68,
    serviceRadius: 2,
    priceModifiers: { worker_meal: 1.5 },
    balanceGold: 450,
    debtGold: 75,
    upkeepGoldPerDay: 5,
    rentGoldPerDay: 3,
    wageGoldPerDay: 12,
    salesTaxRate: 0.06,
    lastTickAtMs: 1_800_000_000_000,
    createdAtMs: 1_800_000_000_000,
    updatedAtMs: 1_800_000_000_000,
    flags: {},
  };
}

function sampleSnapshot(): HarthmereBusinessEconomySnapshot {
  const businessTypes = Object.fromEntries(
    HARTHMERE_BUSINESS_TYPE_ORDER.map((typeId) => [
      typeId,
      businessType(typeId),
    ])
  ) as any;
  const owned = business(
    "business_food",
    "food_service_restaurant",
    "player_a"
  );
  const other = business("business_clinic", "medical_doctor", "player_b");
  const guild = {
    ...business("business_guild_forge", "weapons_tools", "guild_1"),
    ownerKind: "guild" as const,
    ownerId: "guild_1",
  };
  return normalizeHarthmereBusinessEconomySnapshot({
    version: "test",
    actorId: "player_a",
    businessTypes,
    businesses: {
      [owned.businessId]: owned,
      [other.businessId]: other,
      [guild.businessId]: guild,
    },
    myBusinesses: [owned],
    openContracts: [
      {
        contractId: "contract_1",
        issuerKind: "player",
        issuerId: "customer_1",
        title: "Catering order",
        businessType: "food_service_restaurant",
        requirements: [{ serviceNeed: "food", serviceUnits: 1 }],
        rewardGold: 80,
        reputationDelta: 5,
        status: "open",
        regionId: "harthmere_grove_region",
        createdAtMs: 1,
        deadlineAtMs: Date.now() + 10000,
        failurePenaltyGold: 10,
        escrowGold: 80,
        logs: [],
      },
      {
        contractId: "contract_customer_open",
        issuerKind: "player",
        issuerId: "player_a",
        title: "My appointment",
        businessType: "medical_doctor",
        requirements: [{ serviceNeed: "health", serviceUnits: 1 }],
        rewardGold: 120,
        reputationDelta: 5,
        status: "open",
        regionId: "harthmere_grove_region",
        createdAtMs: 1,
        deadlineAtMs: Date.now() + 10000,
        failurePenaltyGold: 10,
        escrowGold: 120,
        logs: [],
      },
    ],
    activeContracts: [
      {
        contractId: "contract_2",
        issuerKind: "player",
        issuerId: "customer_2",
        title: "Active meal order",
        businessType: "food_service_restaurant",
        requirements: [{ itemId: "worker_meal", count: 1 }],
        rewardGold: 100,
        reputationDelta: 5,
        status: "active",
        acceptedByBusinessId: "business_food",
        acceptedByActorId: "player_a",
        regionId: "harthmere_grove_region",
        createdAtMs: 1,
        deadlineAtMs: Date.now() + 10000,
        failurePenaltyGold: 10,
        escrowGold: 100,
        logs: [],
      },
    ],
    employees: {
      employee_1: {
        employeeId: "employee_1",
        businessId: "business_food",
        npcId: "npc_worker",
        role: "cook",
        skill: 3,
        wageGoldPerDay: 12,
        morale: 70,
        loyalty: 60,
        hiredAtMs: 1,
        lastPaidAtMs: 1,
      },
    },
    loans: {},
    insurancePolicies: {},
    tradeRoutes: {},
    failures: {},
    marketOrders: {},
    towns: {},
    regions: {
      harthmere_grove_region: {
        regionId: "harthmere_grove_region",
        priceIndex: { worker_meal: 20, rare_seed: 7 },
      },
    },
    businessSystems: {
      permissions: {
        business_guild_forge: {
          player_a: ["accountant", "inventory_manager"],
        },
      },
      bankAccounts: {
        account_1: {
          accountId: "account_1",
          businessId: "business_food",
          ownerKind: "player",
          ownerId: "player_a",
          balanceGold: 900,
          status: "active",
          createdAtMs: 1,
          audit: [],
        },
      },
    },
    balanceWarnings: [],
    ledger: [],
  });
}

describe("Harthmere in-world business interface live adapter", () => {
  it("fetches the production economy snapshot from the dedicated backend endpoint", async () => {
    const calls: any[] = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({ ok: true, economyState: sampleSnapshot() }),
      };
    }) as any;
    const state = await fetchHarthmereBusinessEconomyState(fetchImpl);
    assert.equal(
      new URL(calls[0].url, "https://test.local").pathname,
      "/api/harthmere/live_mode_economy_state"
    );
    assert.equal(calls[0].init.method, "GET");
    assert.equal(calls[0].init.credentials, "same-origin");
    assert.equal(
      state.businesses.business_food.name,
      "food_service_restaurant Shop"
    );
  });

  it("posts every interface write through request_economy_mutation", async () => {
    const calls: any[] = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({ ok: true, economyState: sampleSnapshot() }),
      };
    }) as any;
    await submitHarthmereBusinessEconomyMutation(
      "deposit_business_inventory",
      { businessId: "business_food", itemId: "worker_meal", count: 2 },
      { fetchImpl, requestId: "fixed_business_request" }
    );
    assert.equal(
      new URL(calls[0].url, "https://test.local").pathname,
      "/api/harthmere/live_mode"
    );
    assert.equal(calls[0].init.method, "POST");
    const envelope = JSON.parse(calls[0].init.body);
    assert.equal(envelope.requestId, "fixed_business_request");
    assert.equal(envelope.idempotencyKey, "fixed_business_request");
    assert.equal(envelope.actionKind, "request_economy_mutation");
    assert.equal(envelope.subsystem, "economy");
    assert.equal(envelope.actorEntityVersion, 1);
    assert.equal(typeof envelope.clientSentAtMs, "number");
    assert.equal(envelope.payload.operation, "deposit_business_inventory");
    assert.equal(envelope.payload.businessId, "business_food");
  });

  it("broadcasts inventory loot updates from business mutations for HUD wallet refreshes", async () => {
    const originalWindow = (globalThis as any).window;
    const originalCustomEvent = (globalThis as any).CustomEvent;
    const events: any[] = [];
    class TestCustomEvent {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    }
    (globalThis as any).CustomEvent = TestCustomEvent;
    (globalThis as any).window = {
      dispatchEvent: (event: any) => {
        events.push(event);
        return true;
      },
    };
    try {
      const state = sampleSnapshot();
      const inventoryLootState = { actor: { gold: 225 } };
      const playerStatusState = { health: 88 };
      const adapter = createHarthmereBusinessInterfaceAdapter({
        state,
        hydrated: true,
        refresh: async () => state,
        submit: async () => ({
          ok: true,
          economyState: state,
          inventoryLootState,
          playerStatusState,
        }),
      });

      await adapter.serveCustomer(
        "business_food",
        "serve_worker_meal",
        "customer_shift_1",
        "customer_ticket_1"
      );

      assert.equal(events.length, 1);
      assert.equal(
        events[0].type,
        HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT
      );
      assert.deepEqual(events[0].detail.inventoryLootState, inventoryLootState);
      assert.deepEqual(events[0].detail.playerStatusState, playerStatusState);
    } finally {
      (globalThis as any).window = originalWindow;
      (globalThis as any).CustomEvent = originalCustomEvent;
    }
  });

  it("posts every production business minigame start and serve mutation with the required live-mode envelope", async () => {
    const calls: any[] = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({ ok: true, economyState: sampleSnapshot() }),
      };
    }) as any;

    for (const typeId of HARTHMERE_BUSINESS_TYPE_ORDER) {
      const businessId = `matrix_${typeId}`;
      await submitHarthmereBusinessEconomyMutation(
        "start_business_customer_session",
        { businessId, count: 1 },
        { fetchImpl, requestId: `start_${typeId}` }
      );
      await submitHarthmereBusinessEconomyMutation(
        "serve_business_customer",
        {
          businessId,
          offerId: `offer_${typeId}`,
          sessionId: `session_${typeId}`,
          ticketId: `ticket_${typeId}`,
        },
        { fetchImpl, requestId: `serve_${typeId}` }
      );
    }

    assert.equal(calls.length, HARTHMERE_BUSINESS_TYPE_ORDER.length * 2);
    for (const { url, init } of calls) {
      assert.equal(
        new URL(url, "https://test.local").pathname,
        "/api/harthmere/live_mode"
      );
      const envelope = JSON.parse(init.body);
      assert.equal(envelope.actionKind, "request_economy_mutation");
      assert.equal(envelope.subsystem, "economy");
      assert.equal(envelope.actorEntityVersion, 1);
      assert.equal(typeof envelope.clientSentAtMs, "number");
      assert.equal(envelope.zoneId, "the_grove");
      assert.ok(
        envelope.payload.operation === "start_business_customer_session" ||
          envelope.payload.operation === "serve_business_customer"
      );
      assert.ok(envelope.payload.businessId.startsWith("matrix_"));
    }
  });

  it("throws when the backend rejects a business reducer operation", async () => {
    const fetchImpl = (async () => ({
      ok: true,
      json: async () => ({
        backendMutation: {
          warnings: ["economy_rejected:business_permission_required"],
        },
      }),
    })) as any;
    await assert.rejects(
      () =>
        submitHarthmereBusinessEconomyMutation(
          "withdraw_business_inventory",
          { businessId: "business_food", itemId: "worker_meal", count: 1 },
          { fetchImpl, requestId: "fixed" }
        ),
      /business_permission_required/
    );
  });

  it("throws when live mode returns a failed native validation body", async () => {
    const fetchImpl = (async () => ({
      ok: true,
      json: async () => ({
        ok: false,
        persisted: false,
        validation: {
          ok: false,
          errors: ["native_ecs_authority_required:request_loot_roll"],
        },
      }),
    })) as any;
    await assert.rejects(
      () =>
        submitHarthmereBusinessEconomyMutation(
          "buy_business_tool",
          {
            businessId: "business_clinic",
            itemId: "field_surgeon_kit",
            count: 1,
          },
          { fetchImpl, requestId: "failed_native_tool_purchase" }
        ),
      /native_ecs_authority_required/
    );
  });

  it("only exposes the interface while the world says the player is inside a real business", () => {
    const state = sampleSnapshot();
    assert.equal(
      isHarthmereBusinessInterfaceAvailable(state, undefined),
      false
    );
    assert.equal(
      isHarthmereBusinessInterfaceAvailable(state, "missing_business"),
      false
    );
    assert.equal(
      isHarthmereBusinessInterfaceAvailable(state, "business_food"),
      true
    );
  });

  it("keeps closed businesses manageable by owners but unavailable to customers", () => {
    const state = sampleSnapshot();
    state.businesses.business_clinic.status = "paused";
    assert.equal(
      canCustomerUseHarthmereBusiness(state.businesses.business_clinic),
      false
    );
    assert.equal(
      isHarthmereBusinessInterfaceAvailable(state, "business_clinic"),
      false
    );
    assert.equal(
      getHarthmereBusinessInteractionPrompt(state, {
        insideBusiness: true,
        nearbyBusinessId: "business_clinic",
      }).visible,
      false
    );
    assert.equal(
      getHarthmereBusinessOperationScreen(state, "business_clinic")
        .customerActions.length,
      0
    );

    state.businesses.business_food.status = "draft";
    assert.equal(
      isHarthmereBusinessInterfaceAvailable(state, "business_food"),
      true
    );
    assert.ok(
      getHarthmereBusinessOperationScreen(state, "business_food").ownerActions
        .length > 0
    );
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async () => ({ ok: true, economyState: state }),
    });
    assert.equal(adapter.getShopfront("business_food").inventory.length, 2);
    assert.equal(
      adapter.getServiceActions("business_clinic", "customer").length,
      0
    );
  });

  it("derives owner mode for owned and permission-scoped businesses and customer mode for other businesses", () => {
    const state = sampleSnapshot();
    assert.equal(
      getHarthmereBusinessActorMode(state, "business_food"),
      "owner"
    );
    assert.equal(
      getHarthmereBusinessActorMode(state, "business_guild_forge"),
      "owner"
    );
    assert.equal(
      getHarthmereBusinessActorMode(state, "business_clinic"),
      "customer"
    );
  });

  it("normalizes dashboard data for money, todos, visible inventory, employees, and customer order status", () => {
    const state = sampleSnapshot();
    const inventory = getHarthmereVisibleBusinessInventory(
      state,
      "business_food"
    );
    assert.equal(
      inventory.find((item) => item.itemId === "worker_meal")?.priceGold,
      30
    );
    const customerOrders = getHarthmereCustomerOrders(state, "business_clinic");
    assert.equal(customerOrders[0].contractId, "contract_customer_open");

    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async () => ({ ok: true, economyState: state }),
    });
    assert.equal(adapter.isAvailable("business_food"), true);
    assert.equal(adapter.getMoneySummary("business_food").bankBalanceGold, 900);
    assert.equal(adapter.getEmployees("business_food")[0].role, "cook");
    assert.equal(
      adapter
        .getTodos("business_food")
        .some((todo) => todo.id === "active_orders"),
      true
    );
    assert.equal(adapter.getInventory("business_food").length, 2);
  });

  it("derives and renders the owner customer mini-game from live customer sessions", () => {
    const state = sampleSnapshot();
    state.businessSystems.customerSessions = {
      customer_shift_1: {
        sessionId: "customer_shift_1",
        businessId: "business_food",
        typeId: "food_service_restaurant",
        actorId: "player_a",
        status: "active",
        startedAtMs: 1_800_000_000_000,
        expiresAtMs: 1_800_003_600_000,
        currentTicketId: "customer_ticket_1",
        queue: [
          {
            ticketId: "customer_ticket_1",
            entityId: 90_001 as BiomesId,
            npcId: "customer_jessa_mint",
            askId: "hot_meal",
            requestedOfferId: "serve_worker_meal",
            askLine: "I need something hot before my shift starts.",
            status: "waiting",
            arrivedAtMs: 1_800_000_000_000,
            patience: 46,
            patienceRemaining: 46,
            difficulty: 1,
            rewardGold: 40,
            reputationDelta: 1,
            needDelta: 3,
            navGoal: "counterNodeId",
            spatialPhase: "queued",
            reaction: "neutral",
            queueIndex: 0,
          },
        ],
        servedTicketIds: [],
        failedTicketIds: [],
        streak: 0,
        satisfaction: 50,
        earnedGold: 0,
        progressPoints: 0,
        dailyBonusGold: 15,
        notes: ["Jessa Mint walked from queue to counter."],
      },
    };
    state.businessSystems.customerStats = {
      business_food: {
        businessId: "business_food",
        totalServed: 7,
        totalFailed: 1,
        lifetimeGold: 310,
        bestStreak: 4,
        currentTier: 2,
        serviceXp: 0,
        likeability: 0,
        friendshipPointsByNpcId: {},
        favoriteCustomerNpcIds: [],
        repeatCustomerMemories: [],
        thankYouNotes: [],
        collectiblesEarned: [],
        decorationUnlocks: [],
        badges: [],
      },
    };

    const miniGame = getHarthmereBusinessCustomerMiniGame(
      state,
      "business_food"
    );
    assert.equal(miniGame.definition.typeId, "food_service_restaurant");
    assert.equal(miniGame.currentNpc?.displayName, "Jessa Mint");
    assert.equal(miniGame.currentTicket?.requestedOfferId, "serve_worker_meal");
    assert.ok(
      miniGame.customerPool.some((npc) => npc.npcId === "customer_jessa_mint")
    );
    assert.ok(
      miniGame.offers.some((offer) => offer.offerId === "serve_worker_meal")
    );
    assert.equal(
      miniGame.definition.mechanicSpec.gameTitle,
      "Buff Economy Service Line"
    );
    assert.ok(
      miniGame.definition.mechanicSpec.uiElements.some(
        (element) => element.elementId === "service_line_panel"
      )
    );
    assert.ok(miniGame.progressPath.length >= 4);
    assert.ok(miniGame.dailyReturnTriggers.length >= 3);
    assert.ok(
      miniGame.bikkieGraphics.some(
        (graphic) => graphic.bikkieName === "Kitchen"
      )
    );
    assert.ok(
      miniGame.bikkieGraphics.some(
        (graphic) => graphic.bikkieName === "Angler's Table"
      )
    );

    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async () => ({ ok: true, economyState: state }),
    });
    assert.deepEqual(
      adapter.getBikkieGraphics("business_food"),
      miniGame.bikkieGraphics
    );
    const html = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter,
        nearbyBusinessId: "business_food",
        compact: true,
        initialTab: "customers",
      })
    );
    assert.ok(html.includes("In-world customer shift"));
    assert.ok(html.includes("Shift live: 0/1"));
    assert.ok(html.includes("End safely"));
    assert.equal(html.includes('data-business-minigame-arena="true"'), false);
  });

  it("derives and renders branch empire data from backend building, branch, and automation records", () => {
    const state = sampleSnapshot();
    state.businesses.business_food.balanceGold = 2_000;
    const outpost = Object.values(
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS
    ).find((record) => record.businessType === "food_service_restaurant")!;
    state.businessSystems.customerStats = {
      business_food: {
        businessId: "business_food",
        totalServed: 55,
        totalFailed: 2,
        lifetimeGold: 2_100,
        bestStreak: 6,
        currentTier: 3,
        serviceXp: 0,
        likeability: 0,
        friendshipPointsByNpcId: {},
        favoriteCustomerNpcIds: [],
        repeatCustomerMemories: [],
        thankYouNotes: [],
        collectiblesEarned: [],
        decorationUnlocks: [],
        badges: [],
      },
    };
    state.businessSystems.outpostBuildings = { [outpost.outpostId]: outpost };
    state.businessSystems.empireBranches = {
      branch_1: {
        branchId: "branch_1",
        parentBusinessId: "business_food",
        businessType: "food_service_restaurant",
        outpostId: outpost.outpostId,
        outpostBuildingId: outpost.buildingId,
        townId: "harthmere_town",
        regionId: "harthmere_region",
        status: "active",
        openedAtMs: 1,
        staffSlots: 5,
        automationSlots: 2,
        dailyRevenueGold: 180,
        dailyUpkeepGold: 55,
        queueCapacityBonus: 5,
        reputationShare: 1,
        lastSettlementAtMs: 1,
        lifetimeProfitGold: 420,
        regionalManagerEmployeeId: "employee_1",
        warehouseSlots: 10,
        warehouseInventory: { worker_meal: 4 },
        scheduledStaffIds: ["employee_1"],
        regionalDemandMultiplier: 1.12,
        competitorPressure: 4,
        lastDashboardAtMs: 2,
        branchNotes: ["Daily branch report: steady."],
      },
    };
    state.businessSystems.branchDashboards = {
      branch_1: {
        dashboardId: "dashboard_branch_1",
        branchId: "branch_1",
        parentBusinessId: "business_food",
        atMs: 2,
        dailyProfitGold: 188,
        stockUnits: 4,
        staffCoverage: 0.6,
        demandMultiplier: 1.12,
        competitorPressure: 4,
        managerAssigned: true,
        alerts: ["Branch steady"],
        recommendedActions: [],
      },
    };
    state.businessSystems.automationAssignments = {
      automation_1: {
        automationId: "automation_1",
        businessId: "business_food",
        branchId: "branch_1",
        role: "branch_manager",
        level: 3,
        active: true,
        dailyUpkeepGold: 28,
        serviceCapacityBonus: 4,
        passiveProfitGoldPerDay: 21,
        failureRisk: 6,
        createdAtMs: 1,
      },
    };
    const panel = getHarthmereBusinessEmpirePanel(state, "business_food");
    assert.equal(panel.openBranchEligible, true);
    assert.equal(panel.branches.length, 1);
    assert.equal(panel.dashboards.length, 1);
    assert.equal(panel.automations.length, 1);
    assert.equal(panel.outpostBuildings.length, 1);
    assert.equal(panel.dailyRevenueGold, 180);
    assert.equal(panel.dailyUpkeepGold, 83);

    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async () => ({ ok: true, economyState: state }),
    });
    const html = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter,
        nearbyBusinessId: "business_food",
        compact: true,
        initialTab: "empire",
      })
    );
    assert.ok(html.includes("Empire Controls"));
    assert.ok(html.includes("Open Branch"));
    assert.ok(html.includes("Assign Manager"));
    assert.ok(html.includes("Set Regional Manager"));
    assert.ok(html.includes("Route Stock"));
    assert.ok(html.includes("Branch Dashboard"));
    assert.ok(html.includes("Warehouse 4/10"));
    assert.ok(html.includes("Collect Day"));
  });

  it("maps owner management controls to exact backend economy operations", async () => {
    const operations: Array<{
      operation: string;
      payload: Record<string, unknown>;
    }> = [];
    const state = sampleSnapshot();
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async (operation, payload) => {
        operations.push({ operation, payload });
        return { ok: true, economyState: state };
      },
    });

    await adapter.createBankAccount("business_food");
    await adapter.transferPersonalToBusinessBank("business_food", 100);
    await adapter.transferBusinessToPersonalBank("business_food", 25);
    await adapter.depositInventory("business_food", "worker_meal", 2);
    await adapter.withdrawInventory("business_food", "worker_meal", 1);
    await adapter.setPrices("business_food", { worker_meal: 1.25 });
    await adapter.openBusiness(
      "business_food",
      "property_business_food",
      "harthmere_grove"
    );
    await adapter.hireWorker("business_food", "cook", 12, 3);
    await adapter.assignWorker("business_food", "employee_1", "kitchen");
    await adapter.trainWorker("business_food", "employee_1");
    await adapter.promoteWorker("business_food", "employee_1", "quality_check");
    await adapter.runEmployeeTask(
      "business_food",
      "employee_1",
      "quality_check",
      "serve_worker_meal"
    );
    await adapter.runEmployeeMoraleTick("business_food", 1);
    await adapter.refreshEmployeeCandidates("business_food", 3);
    await adapter.interviewEmployeeCandidate(
      "business_food",
      "candidate_1",
      "friendly"
    );
    await adapter.negotiateEmployeeCandidate(
      "business_food",
      "candidate_1",
      14
    );
    await adapter.hireEmployeeCandidate("business_food", "candidate_1");
    await adapter.payPayroll("business_food");
    await adapter.acceptContract("business_food", "contract_1");
    await adapter.fulfillContract("business_food", "contract_2");
    await adapter.grantPermission("business_food", "player_b", ["accountant"]);
    await adapter.startCustomerSession("business_food", 3);
    await adapter.serveCustomer(
      "business_food",
      "serve_worker_meal",
      "customer_shift_1",
      "customer_ticket_1"
    );
    await adapter.openBranch("business_food", "outpost_restaurant_redpot");
    await adapter.assignAutomation(
      "business_food",
      "branch_manager",
      "branch_1",
      "employee_1"
    );
    await adapter.assignBranchManager(
      "business_food",
      "branch_1",
      "employee_1"
    );
    await adapter.routeBranchStock(
      "business_food",
      "branch_1",
      "worker_meal",
      2
    );
    await adapter.scheduleBranchStaff("business_food", "branch_1", [
      "employee_1",
    ]);
    await adapter.closeBranch("business_food", "branch_1");
    await adapter.settleEmpireDay("business_food", 1);
    await adapter.fireWorker("business_food", "employee_1");

    assert.deepEqual(
      operations.map((entry) => entry.operation),
      [
        "create_business_bank_account",
        "transfer_personal_to_business_bank",
        "transfer_business_to_personal_bank",
        "deposit_business_inventory",
        "withdraw_business_inventory",
        "set_business_prices",
        "open_business",
        "hire_worker",
        "assign_worker",
        "train_worker",
        "promote_business_employee",
        "run_business_employee_task",
        "run_business_employee_morale_tick",
        "refresh_business_employee_candidates",
        "interview_business_employee_candidate",
        "negotiate_business_employee_candidate",
        "hire_business_employee_candidate",
        "pay_payroll",
        "accept_contract",
        "fulfill_contract",
        "grant_business_permission",
        "start_business_customer_session",
        "serve_business_customer",
        "open_business_branch",
        "assign_business_automation",
        "assign_business_branch_manager",
        "route_business_branch_stock",
        "schedule_business_branch_staff",
        "close_business_branch",
        "run_business_empire_day",
        "fire_worker",
      ]
    );
    assert.deepEqual(operations[5].payload.priceModifiers, {
      worker_meal: 1.25,
    });
    assert.deepEqual(operations[10].payload, {
      businessId: "business_food",
      employeeId: "employee_1",
      assignedTask: "quality_check",
    });
    assert.deepEqual(operations[11].payload, {
      businessId: "business_food",
      employeeId: "employee_1",
      assignedTask: "quality_check",
      offerId: "serve_worker_meal",
    });
    assert.deepEqual(operations[13].payload, {
      businessId: "business_food",
      count: 3,
    });
    assert.deepEqual(operations[14].payload, {
      businessId: "business_food",
      candidateId: "candidate_1",
      interviewStyle: "friendly",
    });
    assert.deepEqual(operations[15].payload, {
      businessId: "business_food",
      candidateId: "candidate_1",
      wageGoldPerDay: 14,
    });
    assert.deepEqual(operations[16].payload, {
      businessId: "business_food",
      candidateId: "candidate_1",
    });
    assert.equal(operations[20].payload.targetActorId, "player_b");
    assert.deepEqual(operations[21].payload, {
      businessId: "business_food",
      count: 3,
    });
    assert.deepEqual(operations[22].payload, {
      businessId: "business_food",
      offerId: "serve_worker_meal",
      sessionId: "customer_shift_1",
      ticketId: "customer_ticket_1",
    });
    assert.deepEqual(operations[23].payload, {
      businessId: "business_food",
      outpostId: "outpost_restaurant_redpot",
    });
    assert.deepEqual(operations[24].payload, {
      businessId: "business_food",
      role: "branch_manager",
      branchId: "branch_1",
      employeeId: "employee_1",
    });
    assert.deepEqual(operations[25].payload, {
      businessId: "business_food",
      branchId: "branch_1",
      employeeId: "employee_1",
    });
    assert.deepEqual(operations[26].payload, {
      businessId: "business_food",
      branchId: "branch_1",
      itemId: "worker_meal",
      count: 2,
    });
    assert.deepEqual(operations[27].payload, {
      businessId: "business_food",
      branchId: "branch_1",
      employeeIds: ["employee_1"],
    });
    assert.deepEqual(operations[28].payload, {
      businessId: "business_food",
      branchId: "branch_1",
    });
    assert.deepEqual(operations[29].payload, {
      businessId: "business_food",
      days: 1,
    });
    assert.deepEqual(operations[30].payload, {
      businessId: "business_food",
      employeeId: "employee_1",
    });
  });

  it("maps customer service requests to escrowed backend contracts", async () => {
    const operations: Array<{
      operation: string;
      payload: Record<string, unknown>;
    }> = [];
    const state = sampleSnapshot();
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async (operation, payload) => {
        operations.push({ operation, payload });
        return { ok: true, economyState: state };
      },
    });
    await adapter.requestCustomerService("business_clinic", "request_care", {
      rewardGold: 175,
    });
    assert.equal(operations[0].operation, "create_contract");
    assert.equal(operations[0].payload.businessType, "medical_doctor");
    assert.equal(operations[0].payload.ownerKind, "player");
    assert.equal(
      operations[0].payload.interactionBusinessId,
      "business_clinic"
    );
    assert.equal(operations[0].payload.targetBusinessId, "business_clinic");
    assert.equal(operations[0].payload.rewardGold, 175);
    assert.equal(operations[0].payload.amountGold, 175);
    assert.equal(operations[0].payload.priceGold, 175);
    assert.equal(operations[0].payload.customerPriceGold, 175);
    assert.deepEqual(operations[0].payload.requirements, [
      { serviceNeed: "health", serviceUnits: 1 },
    ]);
  });

  it("maps exploration guide customer actions to bookings instead of owner expedition execution", async () => {
    const operations: Array<{
      operation: string;
      payload: Record<string, unknown>;
    }> = [];
    const state = sampleSnapshot();
    state.businesses.business_guide = business(
      "business_guide",
      "exploration_guide",
      "player_b"
    ) as any;
    const customerActions = getHarthmereBusinessServiceActions(
      "exploration_guide",
      "customer"
    );
    assert.equal(
      customerActions.some((action) => action.actionId === "lead_expedition"),
      false
    );
    assert.equal(
      customerActions.some((action) => action.actionId === "book_expedition"),
      true
    );
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async (operation, payload) => {
        operations.push({ operation, payload });
        return { ok: true, economyState: state };
      },
    });
    await adapter.requestCustomerService("business_guide", "book_expedition", {
      targetId: "rift_route_7",
    });
    assert.equal(operations[0].operation, "create_contract");
    assert.equal(operations[0].payload.businessType, "exploration_guide");
    assert.equal(operations[0].payload.interactionBusinessId, "business_guide");
    assert.equal(operations[0].payload.targetBusinessId, "business_guide");
    assert.deepEqual(operations[0].payload.requirements, [
      { serviceNeed: "knowledge", serviceUnits: 1 },
    ]);
    assert.equal(
      (operations[0].payload as any).fieldService.targetId,
      "rift_route_7"
    );
  });

  it("maps customer shop purchases to real customer-sale mutations", async () => {
    const operations: Array<{
      operation: string;
      payload: Record<string, unknown>;
    }> = [];
    const state = sampleSnapshot();
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async (operation, payload) => {
        operations.push({ operation, payload });
        return { ok: true, economyState: state };
      },
    });
    await adapter.purchaseShopItem("business_clinic", "worker_meal", 2);
    assert.deepEqual(operations[0], {
      operation: "record_customer_sale",
      payload: {
        businessId: "business_clinic",
        itemId: "worker_meal",
        count: 2,
      },
    });

    await adapter.buyBusinessTool("business_clinic", "field_surgeon_kit");
    assert.deepEqual(operations[1], {
      operation: "buy_business_tool",
      payload: {
        businessId: "business_clinic",
        itemId: "field_surgeon_kit",
        count: 1,
      },
    });

    state.businesses.business_clinic.status = "closed";
    await assert.rejects(
      () => adapter.purchaseShopItem("business_clinic", "worker_meal", 1),
      /business_not_open/
    );
    await assert.rejects(
      () => adapter.requestCustomerService("business_clinic", "request_care"),
      /business_not_open/
    );
  });

  it("defines owner and customer service actions for every production business type", () => {
    assert.equal(HARTHMERE_BUSINESS_TYPE_ORDER.length, 19);
    for (const typeId of HARTHMERE_BUSINESS_TYPE_ORDER) {
      const actions = HARTHMERE_BUSINESS_SERVICE_ACTIONS[typeId];
      assert.ok(
        actions?.length >= 2,
        `${typeId} should have several interface actions`
      );
      assert.ok(
        actions.some(
          (action) => action.audience === "owner" || action.audience === "both"
        ),
        `${typeId} missing owner action`
      );
      assert.ok(
        actions.some(
          (action) =>
            action.audience === "customer" || action.audience === "both"
        ),
        `${typeId} missing customer action`
      );
      for (const action of actions) {
        assert.ok(action.actionId);
        assert.ok(action.label);
        if (action.audience === "customer" || action.audience === "both") {
          assert.ok(
            harthmereBusinessServicePriceGold(action) > 0,
            `${typeId}:${action.actionId} should have a customer service price`
          );
        }
        assert.ok(action.operation);
        assert.ok(action.description.length > 10);
      }
    }
  });

  it("executes representative business-specific owner actions through the backend operation registry", async () => {
    const state = sampleSnapshot();
    const operations: string[] = [];
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async (operation) => {
        operations.push(operation);
        return { ok: true, economyState: state };
      },
    });
    await adapter.runServiceAction("business_food", "set_menu");
    await adapter.runServiceAction("business_food", "serve_day");
    assert.deepEqual(operations, [
      "set_restaurant_menu",
      "serve_restaurant_day",
    ]);
    assert.deepEqual(adapter.getServiceActions("missing_business"), []);
  });
});

describe("Harthmere in-world business interface current screens", () => {
  it("builds world interaction prompts only while the player is inside a real business", () => {
    const state = sampleSnapshot();
    const missing = getHarthmereBusinessInteractionPrompt(state, {
      insideBusiness: false,
      nearbyBusinessId: "business_food",
    });
    assert.equal(missing.visible, false);
    const ownerPrompt = getHarthmereBusinessInteractionPrompt(state, {
      insideBusiness: true,
      nearbyBusinessId: "business_food",
      interactionKeyLabel: "E",
    });
    assert.equal(ownerPrompt.visible, true);
    assert.equal(ownerPrompt.mode, "owner");
    assert.match(ownerPrompt.label, /Press E to use .* service counter/);
    assert.match(ownerPrompt.helper, /Start an in-world shift/);
    const customerPrompt = getHarthmereBusinessInteractionPrompt(state, {
      insideBusiness: true,
      nearbyBusinessId: "business_clinic",
      interactionKeyLabel: "F",
    });
    assert.equal(customerPrompt.mode, "customer");
    assert.match(customerPrompt.label, /Press F to use .* service counter/);
    assert.match(customerPrompt.helper, /Buy goods or request a service/);
  });

  it("resolves canonical outpost dashboard coordinates to the matching business prompt", () => {
    const state = sampleSnapshot();
    const outpost =
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS.outpost_restaurant_redpot;
    const outpostMetadata = HARTHMERE_BUSINESS_OUTPOSTS.find(
      (entry) => entry.outpostId === outpost.outpostId
    )!;
    const businessId = harthmereBusinessOutpostBusinessId(outpost.outpostId);
    state.businesses[businessId] = {
      ...business(businessId, outpost.businessType, outpostMetadata.ownerNpcId),
      ownerKind: "npc",
      ownerId: outpostMetadata.ownerNpcId,
      name: outpost.displayName,
    };
    state.businessSystems.outpostBuildings = {
      ...state.businessSystems.outpostBuildings,
      [outpost.outpostId]: outpost,
    };
    const context = nearestHarthmereBusinessDashboardWorldContext(
      state,
      outpost.dashboardAccessPoint.position,
      6
    );
    assert.equal(context.insideBusiness, true);
    assert.equal(context.nearbyBusinessId, businessId);
    assert.equal(context.interactionKeyLabel, "F");
    assert.equal(context.outpostId, outpost.outpostId);
    assert.equal(
      context.businessInteractionMarkerId,
      outpost.dashboardAccessPoint.markerId
    );
    assert.deepEqual(
      harthmereBusinessWorldContextPayload(context).businessInteractionPosition,
      outpost.dashboardAccessPoint.position
    );
    const prompt = getHarthmereBusinessInteractionPrompt(state, context);
    assert.equal(prompt.visible, true);
    assert.match(prompt.label, /Press F to use .* service counter/);
  });

  it("enriches sparse HUD business context with nearby outpost marker proof", () => {
    const state = sampleSnapshot();
    const outpost =
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS.outpost_restaurant_redpot;
    const outpostMetadata = HARTHMERE_BUSINESS_OUTPOSTS.find(
      (entry) => entry.outpostId === outpost.outpostId
    )!;
    const businessId = harthmereBusinessOutpostBusinessId(outpost.outpostId);
    state.businesses[businessId] = {
      ...business(businessId, outpost.businessType, outpostMetadata.ownerNpcId),
      ownerKind: "npc",
      ownerId: outpostMetadata.ownerNpcId,
      name: outpost.displayName,
    };
    state.businessSystems.outpostBuildings = {
      ...state.businessSystems.outpostBuildings,
      [outpost.outpostId]: outpost,
    };
    const inferred = nearestHarthmereBusinessDashboardWorldContext(
      state,
      outpost.dashboardAccessPoint.position,
      6
    );
    const context = mergeHarthmereBusinessWorldContext(
      {
        insideBusiness: true,
        nearbyBusinessId: businessId,
        interactionKeyLabel: "F",
      },
      inferred
    );

    assert.equal(context.nearbyBusinessId, businessId);
    assert.equal(
      context.businessInteractionMarkerId,
      outpost.dashboardAccessPoint.markerId
    );
    assert.deepEqual(
      harthmereBusinessWorldContextPayload(context).businessInteractionPosition,
      outpost.dashboardAccessPoint.position
    );
  });

  it("keeps business prompts and branch panels working with slim client outpost payloads", () => {
    const state = sampleSnapshot();
    const outpost = JSON.parse(
      JSON.stringify(
        HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS.outpost_restaurant_redpot
      )
    );
    const outpostMetadata = HARTHMERE_BUSINESS_OUTPOSTS.find(
      (entry) => entry.outpostId === outpost.outpostId
    )!;
    const businessId = harthmereBusinessOutpostBusinessId(outpost.outpostId);
    const originalEditCount = outpost.materializationPlan.edits.length;
    outpost.materializationPlan = {
      ...outpost.materializationPlan,
      edits: [],
      editCount: originalEditCount,
    };
    state.businesses[businessId] = {
      ...business(businessId, outpost.businessType, outpostMetadata.ownerNpcId),
      ownerKind: "npc",
      ownerId: outpostMetadata.ownerNpcId,
      name: outpost.displayName,
    };
    assert.ok(state.businessSystems.customerStats);
    state.businessSystems.customerStats[businessId] = {
      businessId,
      totalServed: 60,
      totalFailed: 0,
      lifetimeGold: 2_000,
      bestStreak: 8,
      currentTier: 4,
      serviceXp: 0,
      likeability: 0,
      friendshipPointsByNpcId: {},
      favoriteCustomerNpcIds: [],
      repeatCustomerMemories: [],
      thankYouNotes: [],
      collectiblesEarned: [],
      decorationUnlocks: [],
      badges: [],
    };
    state.businesses[businessId].balanceGold = 5_000;
    state.businessSystems.outpostBuildings = {
      [outpost.outpostId]: outpost,
    };

    const context = nearestHarthmereBusinessDashboardWorldContext(
      state,
      outpost.dashboardAccessPoint.position,
      6
    );
    assert.equal(context.insideBusiness, true);
    assert.equal(context.nearbyBusinessId, businessId);

    const panel = getHarthmereBusinessEmpirePanel(state, businessId);
    assert.equal(panel.outpostBuildings.length, 1);
    assert.equal(
      (panel.outpostBuildings[0] as any).materializationPlan.editCount,
      originalEditCount
    );
    assert.equal(panel.openBranchEligible, true);
  });

  it("resolves player-owned business owner markers into dynamic in-world access boards", () => {
    const boards = harthmereBusinessDynamicWorldBoards({
      "business_player_shop:owner-npc": {
        markerId: "business_player_shop:owner-npc",
        plotId: "grove_crossroads_shop_lot",
        kind: "npc_board",
        position: [12, 54, -18],
        label: "Crossroads Shop owner",
        createdAtMs: 1,
      },
      "business_player_shop:marker": {
        markerId: "business_player_shop:marker",
        plotId: "grove_crossroads_shop_lot",
        kind: "business_marker",
        position: [10, 54, -20],
        label: "Crossroads Shop",
        createdAtMs: 1,
      },
      unrelated_npc_board: {
        markerId: "unrelated_npc_board",
        plotId: "grove_crossroads_shop_lot",
        kind: "npc_board",
        position: [12, 54, -18],
        label: "Town notice",
        createdAtMs: 1,
      },
      "business_player_shop:deed": {
        markerId: "business_player_shop:deed",
        plotId: "grove_crossroads_shop_lot",
        kind: "deed_sign",
        position: [12, 54, -18],
        label: "Deed",
        createdAtMs: 1,
      },
    });
    assert.deepEqual(boards.map((board) => board.markerId).sort(), [
      "business_player_shop:marker",
      "business_player_shop:owner-npc",
    ]);
    assert.deepEqual(boards[0].position, { x: 12, y: 54, z: -18 });
    assert.equal(boards[0].businessId, "business_player_shop");
  });

  it("renders the business prompt and panel as an obvious in-business UI with keyboard and pointer affordances", () => {
    const state = sampleSnapshot();
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async () => ({ ok: true, economyState: state }),
    });
    const hiddenHtml = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInteractionPrompt, {
        adapter,
        context: { insideBusiness: false, nearbyBusinessId: "business_food" },
      })
    );
    assert.equal(hiddenHtml, "");
    const promptHtml = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInteractionPrompt, {
        adapter,
        context: {
          insideBusiness: true,
          nearbyBusinessId: "business_food",
          interactionKeyLabel: "F",
        },
      })
    );
    assert.ok(promptHtml.includes('data-harthmere-business-prompt="true"'));
    assert.ok(
      promptHtml.includes('data-harthmere-interface-access-point="true"')
    );
    assert.ok(promptHtml.includes('data-access-point-polish="production"'));
    assert.ok(
      promptHtml.includes('data-access-point-visible-target="bottom-center"')
    );
    assert.ok(promptHtml.includes('data-access-point-min-height="82"'));
    assert.ok(promptHtml.includes('data-access-point-key-size="46"'));
    assert.ok(promptHtml.includes("Business owner access"));
    assert.ok(promptHtml.includes("Press F to use"));
    assert.ok(promptHtml.includes("service counter"));
    assert.ok(
      promptHtml.includes("Start an in-world shift or manage this business")
    );
    assert.ok(promptHtml.includes("min-height:82px"));
    assert.ok(promptHtml.includes("width:min(calc(100vw - 24px), 590px)"));

    const panelHtml = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter,
        nearbyBusinessId: "business_food",
        context: { insideBusiness: true, nearbyBusinessId: "business_food" },
        initialTab: "dashboard",
      })
    );
    assert.ok(panelHtml.includes('data-harthmere-business-interface="true"'));
    assert.ok(
      panelHtml.includes('data-business-interface-scope="inside-business-only"')
    );
    assert.ok(
      panelHtml.includes('data-pointer-lock-policy="unlock-while-open"')
    );
    assert.ok(panelHtml.includes('data-mouse-policy="show-while-open"'));
    assert.ok(panelHtml.includes('aria-label="Business interface sections"'));
    assert.ok(panelHtml.includes("Close business interface"));
  });

  it("can suppress the world F business prompt while keeping the open business panel available", () => {
    const state = sampleSnapshot();
    const suppressedHtml = renderToStaticMarkup(
      React.createElement(HarthmereBusinessLiveContainer, {
        initialState: state,
        showPrompt: false,
        open: false,
        worldContext: {
          insideBusiness: true,
          nearbyBusinessId: "business_food",
          interactionKeyLabel: "F",
        },
      })
    );
    assert.equal(
      suppressedHtml.includes('data-harthmere-business-prompt="true"'),
      false
    );
    assert.equal(suppressedHtml.includes("Press F to open"), false);

    const openHtml = renderToStaticMarkup(
      React.createElement(HarthmereBusinessLiveContainer, {
        initialState: state,
        showPrompt: false,
        open: true,
        worldContext: {
          insideBusiness: true,
          nearbyBusinessId: "business_food",
          interactionKeyLabel: "F",
        },
      })
    );
    assert.equal(
      openHtml.includes('data-harthmere-business-prompt="true"'),
      false
    );
    assert.ok(openHtml.includes('data-harthmere-business-interface="true"'));
  });

  it("hides the world F business prompt while another UI owns input", () => {
    const state = sampleSnapshot();
    beginPointerLockUnlockWhileOpen();
    try {
      const html = renderToStaticMarkup(
        React.createElement(HarthmereBusinessLiveContainer, {
          initialState: state,
          showPrompt: true,
          open: false,
          worldContext: {
            insideBusiness: true,
            nearbyBusinessId: "business_food",
            interactionKeyLabel: "F",
          },
        })
      );
      assert.equal(
        html.includes('data-harthmere-business-prompt="true"'),
        false
      );
      assert.equal(html.includes("Press F to open"), false);
    } finally {
      endPointerLockUnlockWhileOpen();
    }
  });

  it("renders the in-world shift control as an accessible customer tab", () => {
    const state = sampleSnapshot();
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async () => ({ ok: true, economyState: state }),
    });
    const html = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter,
        nearbyBusinessId: "business_clinic",
        initialTab: "customers",
        compact: true,
      })
    );
    assert.ok(html.includes("In-World Shift"));
    assert.ok(html.includes("In-world customer shift"));
    assert.ok(html.includes("Start shift at counter"));
    assert.ok(html.includes('data-business-mode="customer"'));
  });

  it("SSR-renders a startable customer minigame tab for every production business type", () => {
    const state = sampleSnapshot();
    for (const typeId of HARTHMERE_BUSINESS_TYPE_ORDER) {
      const businessId = `customer_ui_${typeId}`;
      state.businesses[businessId] = business(
        businessId,
        typeId,
        "player_b"
      ) as any;
    }
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async () => ({ ok: true, economyState: state }),
    });

    for (const typeId of HARTHMERE_BUSINESS_TYPE_ORDER) {
      const businessId = `customer_ui_${typeId}`;
      const html = renderToStaticMarkup(
        React.createElement(HarthmereBusinessInterfacePanel, {
          adapter,
          nearbyBusinessId: businessId,
          initialTab: "customers",
          compact: true,
        })
      );
      assert.ok(
        html.includes('data-business-mode="customer"'),
        `${typeId} should render as customer mode`
      );
      assert.ok(
        html.includes('data-harthmere-business-in-world-shift-control="true"'),
        `${typeId} should render the spatial shift control`
      );
      assert.ok(
        html.includes("Start shift at counter"),
        `${typeId} should render a start control`
      );
      assert.equal(html.includes('data-business-minigame-arena="true"'), false);
      const visibleText = visibleTextFromStaticMarkup(html);
      assert.equal(
        /[a-z]+_[a-z]+/.test(visibleText),
        false,
        `${typeId} should not expose snake case in SSR-visible minigame text: ${visibleText}`
      );
      assert.equal(
        /[a-z][A-Z][a-z]/.test(visibleText),
        false,
        `${typeId} should not expose camel case in SSR-visible minigame text: ${visibleText}`
      );
    }
  });

  it("keeps the detached card arena retired for every business type", () => {
    const state = sampleSnapshot();
    for (const typeId of HARTHMERE_BUSINESS_TYPE_ORDER) {
      const businessId = `arena_ui_${typeId}`;
      state.businesses[businessId] = business(
        businessId,
        typeId,
        "player_b"
      ) as any;
    }
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async () => ({ ok: true, economyState: state }),
    });
    for (const typeId of HARTHMERE_BUSINESS_TYPE_ORDER) {
      const businessId = `arena_ui_${typeId}`;
      const html = renderToStaticMarkup(
        React.createElement(HarthmereBusinessInterfacePanel, {
          adapter,
          nearbyBusinessId: businessId,
          initialTab: "customers",
          compact: true,
        })
      );
      assert.ok(
        html.includes('data-harthmere-business-in-world-shift-control="true"'),
        `${typeId} should render the in-world shift control`
      );
      assert.equal(html.includes('data-business-minigame-arena="true"'), false);
      assert.equal(html.includes('data-business-minigame-howto="true"'), false);
      assert.equal(html.includes("Service Board"), false);
      assert.equal(html.includes("Current Customer"), false);
      const visibleText = visibleTextFromStaticMarkup(html);
      assert.equal(
        /[a-z]+_[a-z]+/.test(visibleText),
        false,
        `${typeId} shift control leaks snake case: ${visibleText}`
      );
      assert.equal(
        /[a-z][A-Z][a-z]/.test(visibleText),
        false,
        `${typeId} shift control leaks camel case: ${visibleText}`
      );
    }
  });

  it("renders only safe live-shift controls while service stays in the spatial HUD", () => {
    const state = sampleSnapshot();
    state.businessSystems.customerSessions = {
      customer_shift_live: {
        sessionId: "customer_shift_live",
        businessId: "business_food",
        typeId: "food_service_restaurant",
        actorId: "player_a",
        status: "active",
        startedAtMs: Date.now(),
        expiresAtMs: Date.now() + 120_000,
        currentTicketId: "live_ticket_1",
        queue: [
          {
            ticketId: "live_ticket_1",
            entityId: 90_002 as BiomesId,
            npcId: "customer_jessa_mint",
            askId: "hot_meal",
            requestedOfferId: "serve_worker_meal",
            askLine: "I need something hot before my shift starts.",
            status: "waiting",
            arrivedAtMs: Date.now(),
            patience: 46,
            patienceRemaining: 46,
            difficulty: 2,
            rewardGold: 40,
            reputationDelta: 1,
            needDelta: 3,
            navGoal: "counterNodeId",
            spatialPhase: "queued",
            reaction: "neutral",
            queueIndex: 0,
          },
        ],
        servedTicketIds: [],
        failedTicketIds: [],
        streak: 3,
        satisfaction: 64,
        earnedGold: 120,
        progressPoints: 0,
        dailyBonusGold: 15,
        notes: ["Jessa Mint walked from queue to counter."],
      },
    };
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async () => ({ ok: true, economyState: state }),
    });
    const html = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter,
        nearbyBusinessId: "business_food",
        initialTab: "customers",
        compact: true,
      })
    );
    assert.ok(html.includes("In-world customer shift"));
    assert.ok(html.includes("Shift live: 0/1"));
    assert.ok(html.includes("End safely"));
    assert.equal(html.includes("Patience 46/46"), false);
    assert.equal(html.includes("Serve worker meal"), false);
    assert.equal(html.includes('data-business-minigame-arena="true"'), false);
  });

  it("keeps a completed active session on the safe end-shift control", () => {
    const state = sampleSnapshot();
    state.businessSystems.customerSessions = {
      customer_shift_done: {
        sessionId: "customer_shift_done",
        businessId: "business_food",
        typeId: "food_service_restaurant",
        actorId: "player_a",
        status: "active",
        startedAtMs: Date.now(),
        expiresAtMs: Date.now() + 120_000,
        currentTicketId: undefined,
        queue: [
          {
            ticketId: "done_ticket_1",
            entityId: 90_003 as BiomesId,
            npcId: "customer_jessa_mint",
            askId: "hot_meal",
            requestedOfferId: "serve_worker_meal",
            askLine: "I need something hot before my shift starts.",
            status: "served",
            arrivedAtMs: Date.now(),
            patience: 46,
            patienceRemaining: 0,
            difficulty: 1,
            rewardGold: 40,
            reputationDelta: 1,
            needDelta: 3,
            navGoal: "counterNodeId",
            spatialPhase: "departing",
            reaction: "success",
            queueIndex: 0,
          },
        ],
        servedTicketIds: ["done_ticket_1"],
        failedTicketIds: [],
        streak: 1,
        satisfaction: 70,
        earnedGold: 40,
        progressPoints: 0,
        dailyBonusGold: 15,
        notes: [],
      },
    };
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async () => ({ ok: true, economyState: state }),
    });
    const html = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter,
        nearbyBusinessId: "business_food",
        initialTab: "customers",
        compact: true,
      })
    );
    assert.ok(html.includes("Shift live: 1/1"));
    assert.ok(html.includes("End safely"));
    assert.equal(html.includes('data-business-minigame-summary="true"'), false);
    assert.equal(html.includes("Start New Shift"), false);
  });

  it("starts the spatial shift without restoring detached offer cards in the browser", async function () {
    this.timeout(60_000);

    const tempDir = await mkdtemp(
      path.join(tmpdir(), "biomes-business-minigame-")
    );
    const entryPath = path.join(tempDir, "entry.tsx");
    const bundlePath = path.join(tempDir, "bundle.js");
    const tsconfigPath = path.join(tempDir, "tsconfig.json");
    const panelPath = path
      .join(
        process.cwd(),
        "src/client/components/harthmere_business/HarthmereBusinessInterfacePanel.tsx"
      )
      .replace(/\\/g, "/");
    const initialState = sampleSnapshot();
    const initialAdapter = createHarthmereBusinessInterfaceAdapter({
      state: initialState,
      hydrated: true,
      refresh: async () => initialState,
      submit: async () => ({ ok: true, economyState: initialState }),
    });
    const businessJson = JSON.stringify(
      initialAdapter.getBusiness("business_clinic")
    );
    const businessTypeJson = JSON.stringify(
      initialAdapter.getBusinessType("business_clinic")
    );
    const miniGameJson = JSON.stringify(
      initialAdapter.getCustomerMiniGame("business_clinic")
    );
    const shopfrontJson = JSON.stringify(
      initialAdapter.getShopfront("business_clinic")
    );
    const activeState = sampleSnapshot();
    const firstOfferId =
      initialAdapter.getCustomerMiniGame("business_clinic").offers[0]?.offerId;
    assert.ok(firstOfferId);
    activeState.businessSystems.customerSessions = {
      customer_shift_1: {
        sessionId: "customer_shift_1",
        businessId: "business_clinic",
        typeId: "medical_doctor",
        actorId: "player_a",
        status: "active",
        startedAtMs: Date.now(),
        expiresAtMs: Date.now() + 60_000,
        currentTicketId: "customer_ticket_1",
        queue: [
          {
            ticketId: "customer_ticket_1",
            npcId: "customer_jessa_mint",
            askId: "urgent_checkup",
            requestedOfferId: firstOfferId,
            askLine: "I need a checkup before the road gets worse.",
            status: "waiting",
            arrivedAtMs: Date.now(),
            patience: 46,
            patienceRemaining: 46,
            difficulty: 1,
            rewardGold: 40,
            reputationDelta: 1,
            needDelta: 3,
            navGoal: "counterNodeId",
          },
        ],
        servedTicketIds: [],
        failedTicketIds: [],
        streak: 0,
        satisfaction: 50,
        earnedGold: 0,
        notes: [],
      },
    } as any;
    const activeAdapter = createHarthmereBusinessInterfaceAdapter({
      state: activeState,
      hydrated: true,
      refresh: async () => activeState,
      submit: async () => ({ ok: true, economyState: activeState }),
    });
    const activeMiniGameJson = JSON.stringify(
      activeAdapter.getCustomerMiniGame("business_clinic")
    );
    const firstOfferLabel =
      activeAdapter.getCustomerMiniGame("business_clinic").offers[0]?.label;
    assert.ok(firstOfferLabel);

    await writeFile(
      entryPath,
      `
        import * as React from "react";
        import { createRoot } from "react-dom/client";
        import { HarthmereBusinessInterfacePanel } from "${panelPath}";

        const business = ${businessJson};
        const businessType = ${businessTypeJson};
        const miniGame = ${miniGameJson};
        const activeMiniGame = ${activeMiniGameJson};
        const shopfront = ${shopfrontJson};
        window.__businessOperations = [];
        window.__businessInventory = {};

        function Harness() {
          const [ready, setReady] = React.useState(false);
          const [currentMiniGame, setCurrentMiniGame] = React.useState(miniGame);
          React.useEffect(() => {
            const timer = window.setTimeout(() => setReady(true), 20);
            return () => window.clearTimeout(timer);
          }, []);
          const adapter = React.useMemo(() => {
            return {
              isHydrated: () => ready,
              isAvailable: (businessId) => ready && businessId === "business_clinic",
              getBusiness: (businessId) => businessId === "business_clinic" ? business : undefined,
              getBusinessType: (businessId) => businessId === "business_clinic" ? businessType : undefined,
              getMode: () => "customer",
              getCustomerMiniGame: () => currentMiniGame,
              getShopfront: () => shopfront,
              getBikkieGraphics: () => [],
              startCustomerSession: async (businessId) => {
                window.__businessOperations.push({
                  operation: "start_business_customer_session",
                  payload: { businessId },
                });
                await new Promise((resolve) => window.setTimeout(resolve, 5));
                setCurrentMiniGame(activeMiniGame);
              },
              serveCustomer: async (businessId, offerId, sessionId, ticketId) => {
                window.__businessOperations.push({
                  operation: "serve_customer",
                  payload: { businessId, offerId, sessionId, ticketId },
                });
                await new Promise((resolve) => window.setTimeout(resolve, 5));
                throw new Error("economy_rejected:business_customer_session_not_active");
              },
              buyBusinessTool: async (businessId, itemId) => {
                window.__businessOperations.push({
                  operation: "buy_business_tool",
                  payload: { businessId, itemId, count: 1 },
                });
                await new Promise((resolve) => window.setTimeout(resolve, 5));
                window.__businessInventory[itemId] =
                  (window.__businessInventory[itemId] ?? 0) + 1;
              },
            };
          }, [ready, currentMiniGame]);
          return (
            <HarthmereBusinessInterfacePanel
              adapter={adapter}
              nearbyBusinessId="business_clinic"
              initialTab="customers"
              compact={true}
            />
          );
        }

        createRoot(document.getElementById("root")).render(<Harness />);
      `
    );
    await writeFile(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: {
          jsx: "react",
        },
      })
    );

    await build({
      entryPoints: [entryPath],
      outfile: bundlePath,
      bundle: true,
      absWorkingDir: process.cwd(),
      nodePaths: [path.join(process.cwd(), "node_modules")],
      platform: "browser",
      format: "iife",
      banner: {
        js: "var process = { env: {}, argv: [], platform: 'test' }; var Buffer = { from: () => ({ toString: () => '' }) }; var global = globalThis;",
      },
      jsx: "transform",
      jsxFactory: "React.createElement",
      jsxFragment: "React.Fragment",
      loader: { ".tsx": "tsx", ".ts": "ts" },
      tsconfig: tsconfigPath,
      plugins: [
        {
          name: "business-panel-browser-stubs",
          setup(pluginBuild) {
            pluginBuild.onResolve(
              { filter: /business_customer_simulator$/ },
              () => ({
                path: "business-customer-simulator",
                namespace: "business-panel-test",
              })
            );
            pluginBuild.onResolve(
              { filter: /@\/galois\/assets\/audio$/ },
              () => ({
                path: "galois-audio",
                namespace: "business-panel-test",
              })
            );
            pluginBuild.onResolve(
              { filter: /@\/galois\/interface\/asset_paths$/ },
              () => ({
                path: "galois-asset-paths",
                namespace: "business-panel-test",
              })
            );
            pluginBuild.onResolve(
              { filter: /@\/galois\/assets\/shapes$/ },
              () => ({
                path: "galois-shapes",
                namespace: "business-panel-test",
              })
            );
            pluginBuild.onResolve({ filter: /@\/shared\/logging$/ }, () => ({
              path: "shared-logging",
              namespace: "business-panel-test",
            }));
            pluginBuild.onResolve(
              { filter: /@\/shared\/zrpc\/serde$/ },
              () => ({
                path: "zrpc-serde",
                namespace: "business-panel-test",
              })
            );
            pluginBuild.onResolve({ filter: /^@\// }, (args) => ({
              path: resolveRepoAliasForEsbuild(args.path),
            }));
            pluginBuild.onResolve(
              { filter: /^(async_hooks|perf_hooks|crypto|process|os)$/ },
              (args) => ({
                path: args.path,
                namespace: "business-panel-node-stub",
              })
            );
            pluginBuild.onResolve(
              { filter: /^\/public\/.*\.(png|jpg|jpeg|webp)$/ },
              (args) => ({
                path: args.path,
                namespace: "business-panel-asset-stub",
              })
            );
            pluginBuild.onResolve(
              { filter: /^three\/examples\/jsm\// },
              (args) => ({
                path: args.path,
                namespace: "business-panel-three-stub",
              })
            );
            pluginBuild.onResolve({ filter: /^three$/ }, () => ({
              path: "three",
              namespace: "business-panel-three-stub",
            }));
            pluginBuild.onResolve({ filter: /PointerLockContext$/ }, () => ({
              path: "pointer-lock-context",
              namespace: "business-panel-test",
            }));
            pluginBuild.onResolve(
              { filter: /pointerLockModalPolicy$/ },
              () => ({
                path: "pointer-lock-policy",
                namespace: "business-panel-test",
              })
            );
            pluginBuild.onResolve(
              { filter: /harthmereBikkieVisualRendering$/ },
              () => ({
                path: "bikkie-visual-rendering",
                namespace: "business-panel-test",
              })
            );
            pluginBuild.onResolve(
              { filter: /businessInterfaceLiveAdapter$/ },
              () => ({
                path: "business-interface-adapter",
                namespace: "business-panel-test",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /pointer-lock-context/,
                namespace: "business-panel-test",
              },
              () => ({
                contents:
                  "export function usePointerLockManager() { return {}; }",
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /pointer-lock-policy/,
                namespace: "business-panel-test",
              },
              () => ({
                contents: [
                  "export function openPointerLockUnlockWhileOpen() {}",
                  "export function closePointerLockUnlockWhileOpen() {}",
                ].join("\n"),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /bikkie-visual-rendering/,
                namespace: "business-panel-test",
              },
              () => ({
                contents: [
                  "export const harthmereBikkieVisualGlyphStyle = {};",
                  "export const harthmereBikkieVisualImageStyle = {};",
                  "export function harthmereBikkieVisualImageUrl() { return undefined; }",
                  "export function harthmereBikkieVisualTileStyle() { return {}; }",
                ].join("\n"),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /business-customer-simulator/,
                namespace: "business-panel-test",
              },
              () => ({
                contents: [
                  "export const HARTHMERE_BUSINESS_OUTPOSTS = [];",
                  "export const HARTHMERE_BUSINESS_OUTPOST_SAFE_SITES = [];",
                  "export function isPointInsideHarthmereBusinessSafeSite() { return false; }",
                  "export function createHarthmereBusinessMiniGameDecisionForOffer(offer) { return { actionId: offer?.actionId ?? 'test_action' }; }",
                ].join("\n"),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /galois-shapes/,
                namespace: "business-panel-test",
              },
              () => ({
                contents:
                  "export const shapeIDs = { full: 1, step: 2, table: 3 };",
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /business-interface-adapter/,
                namespace: "business-panel-test",
              },
              () => ({
                contents: [
                  "export function formatHarthmereBusinessPlayerWarning(value) { return String(value ?? '').replace(/[_:-]+/g, ' '); }",
                  "export function harthmereBusinessServicePriceGold(service) { return Number(service?.priceGold ?? service?.rewardGold ?? 0); }",
                ].join("\n"),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /.*/,
                namespace: "business-panel-node-stub",
              },
              (args) => {
                if (args.path === "async_hooks") {
                  return {
                    contents:
                      "export class AsyncLocalStorage { getStore() { return undefined; } run(_store, callback, ...args) { return callback(...args); } enterWith() {} }",
                    loader: "js",
                  };
                }
                if (args.path === "perf_hooks") {
                  return {
                    contents:
                      "export const performance = globalThis.performance ?? { now: () => Date.now() };",
                    loader: "js",
                  };
                }
                if (args.path === "process") {
                  return {
                    contents: "export const env = {}; export default { env };",
                    loader: "js",
                  };
                }
                if (args.path === "os") {
                  return {
                    contents:
                      "export function release() { return ''; } export function type() { return ''; } export default { release, type };",
                    loader: "js",
                  };
                }
                return {
                  contents:
                    "export function randomBytes(size) { return new Uint8Array(size); } export const webcrypto = globalThis.crypto; export default { randomBytes, webcrypto };",
                  loader: "js",
                };
              }
            );
            pluginBuild.onLoad(
              {
                filter: /.*/,
                namespace: "business-panel-asset-stub",
              },
              () => ({
                contents: "export default 'data:image/png;base64,';",
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /.*/,
                namespace: "business-panel-three-stub",
              },
              () => ({
                contents: [
                  "export class Vector3 {",
                  "  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }",
                  "  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }",
                  "  copy(value) { return this.set(value.x, value.y, value.z); }",
                  "  clone() { return new Vector3(this.x, this.y, this.z); }",
                  "  setFromSpherical(value) {",
                  "    const sinPhiRadius = Math.sin(value.phi) * value.radius;",
                  "    return this.set(sinPhiRadius * Math.sin(value.theta), Math.cos(value.phi) * value.radius, sinPhiRadius * Math.cos(value.theta));",
                  "  }",
                  "}",
                  "export class Matrix4 {}",
                  "export class Quaternion {}",
                  "export class Object3D {}",
                  "export class OrthographicCamera extends Object3D {}",
                  "export class PerspectiveCamera extends Object3D {}",
                  "export class BufferGeometry {}",
                  "export class Mesh extends Object3D {}",
                  "export class SkinnedMesh extends Mesh {}",
                  "export class DataTexture {}",
                  "export class TextureLoader {}",
                  "export class KTX2Loader {",
                  "  setTranscoderPath() { return this; }",
                  "  setWorkerLimit() { return this; }",
                  "  detectSupport() { return this; }",
                  "  dispose() {}",
                  "}",
                  "export class Spherical {",
                  "  constructor(radius = 1, phi = 0, theta = 0) { this.radius = radius; this.phi = phi; this.theta = theta; }",
                  "}",
                  "export const DoubleSide = 2;",
                  "export const LinearFilter = 1006;",
                  "export const RGBAFormat = 1023;",
                  "export const MathUtils = {",
                  "  clamp: (value, min, max) => Math.min(max, Math.max(min, value)),",
                  "  degToRad: (degrees) => degrees * Math.PI / 180,",
                  "  radToDeg: (radians) => radians * 180 / Math.PI,",
                  "};",
                  "export class GLTFLoader {",
                  "  setMeshoptDecoder() { return this; }",
                  "  setKTX2Loader() { return this; }",
                  "  loadAsync() { return Promise.resolve({ scene: new Object3D(), scenes: [] }); }",
                  "  parseAsync() { return Promise.resolve({ scene: new Object3D(), scenes: [] }); }",
                  "}",
                  "export class OrbitControls {}",
                  "export class RoundedBoxGeometry {}",
                  "export class SMAAPass {}",
                  "export class FullScreenQuad {}",
                  "export default {};",
                ].join("\n"),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /galois-audio/,
                namespace: "business-panel-test",
              },
              () => ({
                contents: "export function getAudioAssetPaths() { return []; }",
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /galois-asset-paths/,
                namespace: "business-panel-test",
              },
              () => ({
                contents: [
                  "export function assetPaths() { return []; }",
                  "export function resolveAssetUrl(path) { return String(path ?? ''); }",
                  "export function resolveAssetUrlUntyped(path) { return String(path ?? ''); }",
                ].join("\n"),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /shared-logging/,
                namespace: "business-panel-test",
              },
              () => ({
                contents: [
                  "export const log = { debug() {}, info() {}, warn() {}, error() {}, child() { return log; } };",
                  "export function addSink() {}",
                  "export function removeSink() {}",
                  "export function addToLogContext() {}",
                  "export function withLogContext(_context, callback) { return callback(); }",
                  "export function setVoxelooForExceptionReporting() {}",
                  "export default log;",
                ].join("\n"),
                loader: "js",
              })
            );
            pluginBuild.onLoad(
              {
                filter: /zrpc-serde/,
                namespace: "business-panel-test",
              },
              () => ({
                contents: [
                  "export function prepare(value) { return value; }",
                  "export function zrpcSerialize(value) { return value; }",
                  "export function zrpcDeserialize(value) { return value; }",
                  "export function zrpcWebSerialize(value) { return JSON.stringify(value); }",
                  "export function zrpcWebDeserialize(value) { return typeof value === 'string' ? JSON.parse(value) : value; }",
                ].join("\n"),
                loader: "js",
              })
            );
          },
        },
      ],
    });

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 820 },
      });
      const browserErrors: string[] = [];
      page.on("pageerror", (error) =>
        browserErrors.push(error.stack ?? error.message)
      );
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
      });
      const html = `
        <html>
          <head>
            <style>
              body { margin: 0; background: #07101d; color: #e5eefb; font-family: sans-serif; }
              #root { width: 1260px; min-height: 800px; padding: 12px; }
            </style>
          </head>
          <body><div id="root"></div></body>
        </html>
      `;
      await page.route("https://business-panel.test/", (route) =>
        route.fulfill({ contentType: "text/html", body: html })
      );
      await page.goto("https://business-panel.test/");
      await page.addScriptTag({ content: await readFile(bundlePath, "utf8") });
      const startShiftButton = page.getByRole("button", {
        name: /start shift/i,
      });
      try {
        await startShiftButton.waitFor({
          timeout: 15_000,
        });
      } catch (error) {
        const bodyText = await page.locator("body").innerText();
        throw new Error(
          `Start Shift button did not appear. Browser errors: ${browserErrors.join(
            "\n"
          )}. Body: ${bodyText}`,
          { cause: error }
        );
      }
      assert.deepEqual(browserErrors, []);
      await startShiftButton.click();
      await page.waitForFunction(
        () => (window as any).__businessOperations?.length === 1
      );
      assert.deepEqual(browserErrors, []);
      assert.deepEqual(
        await page.evaluate(() => (window as any).__businessOperations),
        [
          {
            operation: "start_business_customer_session",
            payload: { businessId: "business_clinic" },
          },
        ]
      );
      await page.getByRole("button", { name: "End safely" }).waitFor({
        timeout: 15_000,
      });
      assert.deepEqual(browserErrors, []);
      assert.equal(
        await page.getByRole("button", { name: firstOfferLabel }).count(),
        0,
        "offer choices belong to the projected spatial HUD, not this panel"
      );
      await page.getByRole("button", { name: "Shopfront" }).click();
      const buySurgeonKit = page.getByRole("button", {
        name: "Buy Field Surgeon's Kit",
      });
      await buySurgeonKit.waitFor({ timeout: 15_000 });
      await buySurgeonKit.click();
      await page
        .getByText("Field Surgeon's Kit was added to your inventory.")
        .waitFor({ timeout: 15_000 });
      assert.equal(
        await page.evaluate(
          () => (window as any).__businessInventory.field_surgeon_kit
        ),
        1
      );
      assert.deepEqual(
        await page.evaluate(() =>
          (window as any).__businessOperations.find(
            (row: any) => row.operation === "buy_business_tool"
          )
        ),
        {
          operation: "buy_business_tool",
          payload: {
            businessId: "business_clinic",
            itemId: "field_surgeon_kit",
            count: 1,
          },
        }
      );
      await page.screenshot({
        path: path.join(tmpdir(), "biomes-field-surgeon-kit-purchase.png"),
        fullPage: true,
      });
      assert.deepEqual(browserErrors, []);
    } finally {
      await browser.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("formats backend warnings into player-facing text without snake case or camel case", () => {
    const messages = [
      formatHarthmereBusinessPlayerWarning(
        "economy_rejected:business_item_required:worker_meal"
      ),
      formatHarthmereBusinessPlayerWarning(
        "economy_rejected:business_branch_requires_tier_3"
      ),
      formatHarthmereBusinessPlayerWarning(
        "economy_warning:employee_morale_failure:rest_required"
      ),
      formatHarthmereBusinessPlayerWarning(
        "jobs_board_rejected:unknown_requirement_item:repair_part"
      ),
    ];
    for (const message of messages) {
      assert.equal(message.includes("_"), false);
      assert.equal(/:[a-z]/.test(message), false);
      assert.equal(/[a-z][A-Z]/.test(message), false);
      assert.ok(message.length > 8);
    }
    assert.equal(
      formatHarthmereBusinessPlayerWarning(
        "economy_rejected:insufficient_customer_gold_for_sale"
      ),
      "You do not have enough gold for that purchase."
    );
    assert.equal(
      formatHarthmereBusinessPlayerWarning(
        "economy_rejected:business_tool_already_owned"
      ),
      "You already own this tool."
    );
    assert.equal(
      formatHarthmereBusinessPlayerWarning(
        "native_ecs_materialization_deferred:inventory_full"
      ),
      "Your backpack is full. Free a backpack slot and try again."
    );
    assert.equal(
      formatHarthmereBusinessPlayerWarning(
        "economy_rejected:business_storage_full_for_recipe_output"
      ),
      "The business needs storage space for the finished goods before production can start."
    );
    assert.equal(
      formatHarthmereBusinessPlayerWarning(
        "economy_rejected:business_branch_automation_slots_full"
      ),
      "This branch has no open automation slots. Remove an automation or unlock another slot."
    );
  });

  it("derives owner dashboard, shopfront, contract board, finance, staff, and compliance panels from backend data", () => {
    const state = sampleSnapshot();
    (state.businessSystems.employeeCandidates as any).candidate_1 = {
      candidateId: "candidate_1",
      businessId: "business_food",
      typeId: "food_service_restaurant",
      displayName: "Mira Button",
      role: "Line Cook",
      skill: 2,
      wageAskGoldPerDay: 18,
      personality: "warm",
      schedule: "morning",
      workplacePreference: "Production Station with morning shifts",
      preferredTaskId: "production_station",
      status: "available",
      negotiationRounds: 0,
      generatedAtMs: 1,
      expiresAtMs: 9,
      notes: [],
    } as any;
    (state.businessSystems.employeeTaskRuns as any).task_1 = {
      taskRunId: "task_1",
      businessId: "business_food",
      typeId: "food_service_restaurant",
      employeeId: "employee_1",
      employeeRole: "cook",
      offerId: "serve_worker_meal",
      offerLabel: "Serve worker meal",
      taskKind: "production_station",
      status: "completed",
      animationFamily: "counter_handoff",
      employeePath: [{ x: 1, y: 1 }],
      createdAtMs: 2,
    } as any;
    const dashboard = getHarthmereOwnerDashboard(state, "business_food");
    assert.equal(dashboard.metrics.length, 4);
    assert.ok(dashboard.todos.some((todo) => todo.id === "active_orders"));
    const shopfront = getHarthmereBusinessShopfront(state, "business_food");
    assert.equal(
      shopfront.inventory.find((item) => item.itemId === "worker_meal")
        ?.priceGold,
      30
    );
    const board = getHarthmereContractBoard(state, "business_food");
    assert.equal(board.open[0].contractId, "contract_1");
    assert.equal(board.active[0].contractId, "contract_2");
    const finance = getHarthmereBusinessFinancePanel(state, "business_food");
    assert.equal(finance.summary.bankBalanceGold, 900);
    const staff = getHarthmereBusinessStaffPanel(state, "business_food");
    assert.equal(staff.payrollDueGold, 12);
    assert.equal(staff.canHire, true);
    assert.equal(staff.candidates[0].candidateId, "candidate_1");
    assert.equal(staff.recentTaskRuns[0].taskRunId, "task_1");
    const compliance = getHarthmereBusinessCompliancePanel(
      state,
      "business_food"
    );
    assert.equal(compliance.licenseLevel, 2);
    assert.deepEqual(compliance.warnings, []);
  });

  it("renders owner open controls and customer buy controls in the business panel", () => {
    const ownerState = sampleSnapshot();
    ownerState.businesses.business_food.status = "draft";
    const ownerAdapter = createHarthmereBusinessInterfaceAdapter({
      state: ownerState,
      hydrated: true,
      refresh: async () => ownerState,
      submit: async () => ({ ok: true, economyState: ownerState }),
    });
    const ownerHtml = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter: ownerAdapter,
        nearbyBusinessId: "business_food",
        compact: true,
      })
    );
    assert.ok(ownerHtml.includes("Open Business"));
    const staffHtml = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter: ownerAdapter,
        nearbyBusinessId: "business_food",
        compact: true,
        initialTab: "staff",
      })
    );
    assert.ok(staffHtml.includes("Find Help"));
    assert.ok(staffHtml.includes("Run Task"));
    assert.ok(staffHtml.includes("Train"));
    assert.ok(staffHtml.includes("Fire"));

    const customerState = sampleSnapshot();
    const customerAdapter = createHarthmereBusinessInterfaceAdapter({
      state: customerState,
      hydrated: true,
      refresh: async () => customerState,
      submit: async () => ({ ok: true, economyState: customerState }),
    });
    const customerHtml = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter: customerAdapter,
        nearbyBusinessId: "business_clinic",
        compact: true,
        initialTab: "shopfront",
      })
    );
    assert.ok(customerHtml.includes('aria-label="Quantity for Worker Meal"'));
    assert.ok(customerHtml.includes('aria-label="Buy Worker Meal"'));

    const statusHtml = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter: customerAdapter,
        nearbyBusinessId: "business_clinic",
        compact: true,
        initialTab: "status",
      })
    );
    assert.ok(statusHtml.includes("Next Step"));
    assert.ok(statusHtml.includes("Business Trust"));
    assert.ok(statusHtml.includes("Your Requests"));

    const servicesHtml = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter: customerAdapter,
        nearbyBusinessId: "business_clinic",
        compact: true,
        initialTab: "services",
      })
    );
    assert.ok(servicesHtml.includes("Choose a paid service"));
    assert.ok(servicesHtml.includes("Buy Service"));
    assert.ok(servicesHtml.includes("Request Care"));
    assert.ok(servicesHtml.includes("120 gold"));
    assert.ok(
      servicesHtml.includes('aria-label="Buy service: Request Care, 120 gold"')
    );
    assert.ok(servicesHtml.includes('data-business-service-price-gold="120"'));
  });

  it("builds tailored operation screens for every business type without dummy runtime records", () => {
    const state = sampleSnapshot();
    for (const typeId of HARTHMERE_BUSINESS_TYPE_ORDER) {
      const id = `screen_${typeId}`;
      state.businesses[id] = business(id, typeId, "player_a") as any;
      const screen = getHarthmereBusinessOperationScreen(state, id);
      assert.equal(screen.typeId, typeId);
      assert.ok(
        screen.ownerActions.length > 0,
        `${typeId} should expose owner actions`
      );
      assert.ok(
        screen.customerActions.length > 0,
        `${typeId} should expose customer actions`
      );
      assert.ok(Object.keys(screen.systemRecords).includes("serviceQuests"));
      const miniGame = getHarthmereBusinessCustomerMiniGame(state, id);
      assert.equal(miniGame.typeId, typeId);
      assert.ok(
        miniGame.offers.length >= 3,
        `${typeId} should expose customer service offers`
      );
      assert.ok(
        miniGame.bikkieGraphics.length >= 3,
        `${typeId} should expose Bikkie graphics`
      );
      assert.ok(
        miniGame.progressPath.length >= 4,
        `${typeId} should expose a scale path`
      );
      const report = getHarthmereBusinessGrowthReport(state, id);
      assert.equal(report.typeId, typeId);
      assert.ok(
        report.bottleneck.length > 10,
        `${typeId} should expose a growth bottleneck`
      );
      assert.ok(
        report.rewardLayers.length,
        `${typeId} should expose non-money reward layers`
      );
      assert.equal(report.bottleneck.includes("_"), false);
    }
  });

  it("renders PDF-aligned daily report, bottleneck, and customer-specific overview copy", () => {
    const state = sampleSnapshot();
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async () => ({ ok: true, economyState: state }),
    });
    const dashboardHtml = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter,
        nearbyBusinessId: "business_food",
        compact: true,
        initialTab: "dashboard",
      })
    );
    assert.ok(dashboardHtml.includes("Daily Report"));
    assert.ok(dashboardHtml.includes("Growth Bottleneck"));
    assert.ok(dashboardHtml.includes("Rewards Beyond Gold"));
    assert.ok(dashboardHtml.includes("Lunch rush"));
    assert.ok(dashboardHtml.includes("Service Fixtures"));
    assert.ok(dashboardHtml.includes("Kitchen"));
    assert.ok(dashboardHtml.includes("data-bikkie-id"));
    assert.ok(dashboardHtml.includes('data-bikkie-visual="true"'));
    assert.ok(dashboardHtml.includes('data-visual-source="galois_icon"'));
    assert.ok(dashboardHtml.includes('data-bikkie-visual-img="true"'));
    assert.ok(
      dashboardHtml.includes(
        "/buckets/biomes-static/asset_data/icons/placeables/crafting_stations/oak_kitchen"
      )
    );

    const customerHtml = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter,
        nearbyBusinessId: "business_clinic",
        compact: true,
        initialTab: "overview",
      })
    );
    assert.ok(
      customerHtml.includes("Customers need triage, medicine, and treatment")
    );
    assert.ok(customerHtml.includes("Morning triage queue"));
    assert.ok(customerHtml.includes("Thermolite"));
  });

  it("builds town hall, marketplace, and guild business interfaces from real snapshot records", () => {
    const state = sampleSnapshot();
    state.towns.harthmere_grove = {
      townId: "harthmere_grove",
      publicBudgetGold: 1200,
      needs: {},
      regionId: "harthmere_grove_region",
    } as any;
    state.marketOrders.order_1 = {
      orderId: "order_1",
      kind: "sell",
      businessId: "business_food",
      itemId: "worker_meal",
      count: 2,
      unitPriceGold: 30,
      status: "open",
    } as any;
    const townHall = getHarthmereTownHallPanel(state);
    assert.equal(townHall.towns.length, 1);
    const market = getHarthmereMarketplacePanel(state);
    assert.equal(market.openOrders[0].orderId, "order_1");
    assert.equal(market.regionalPrices.worker_meal, 20);
    const guild = getHarthmereGuildBusinessPanel(state, "guild_1");
    assert.equal(guild.guildBusinesses[0].businessId, "business_guild_forge");
    assert.deepEqual(guild.permissions.business_guild_forge, [
      "accountant",
      "inventory_manager",
    ]);

    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async () => ({ ok: true, economyState: state }),
    });
    const guildHtml = renderToStaticMarkup(
      React.createElement(HarthmereBusinessInterfacePanel, {
        adapter,
        nearbyBusinessId: "business_food",
        context: { actorGuildId: "guild_1" },
        compact: true,
        initialTab: "guild",
      })
    );
    assert.ok(guildHtml.includes("Guild Businesses"));
    assert.ok(guildHtml.includes("Guild Contracts"));
    assert.ok(guildHtml.includes("Your Permissions"));
  });

  it("marks field-service customer orders so accepting them can create map and quest-board todos", async () => {
    const state = sampleSnapshot();
    const action = getHarthmereBusinessServiceActions(
      "medical_doctor",
      "customer"
    ).find((entry) => entry.actionId === "request_care")!;
    assert.equal(requiresHarthmereFieldServiceQuest(action), true);
    const spec = getHarthmereBusinessFieldServiceSpec(
      state.businesses.business_clinic,
      action,
      { targetId: "patient_home_1" }
    );
    assert.equal(spec?.required, true);
    assert.equal(spec?.targetId, "patient_home_1");

    const operations: Array<{
      operation: string;
      payload: Record<string, unknown>;
    }> = [];
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async (operation, payload) => {
        operations.push({ operation, payload });
        return { ok: true, economyState: state };
      },
    });
    await adapter.requestCustomerService("business_clinic", "request_care", {
      targetId: "patient_home_1",
      rewardGold: 225,
    });
    assert.equal(operations[0].operation, "create_contract");
    assert.deepEqual((operations[0].payload as any).fieldService, {
      required: true,
      serviceKind: "health",
      targetId: "patient_home_1",
      mapMarkerId: "patient_home_1",
      questTitle: "medical_doctor Shop: Request Care",
      todoText: "Request Care for medical_doctor Shop",
    });
    await adapter.acceptContract("business_food", "contract_1");
    assert.equal(operations[1].operation, "accept_contract");
    assert.equal(operations[1].payload.createQuestOnAccept, true);
  });

  it("normalizes accepted field-service quests for owner dashboards, map markers, and quest boards", () => {
    const state = sampleSnapshot();
    (state.businessSystems as any).serviceQuests = {
      quest_1: {
        questId: "quest_1",
        contractId: "contract_2",
        businessId: "business_food",
        acceptedByActorId: "player_a",
        title: "Repair the rental door",
        todoText: "Go to the inn and repair the rental door.",
        status: "active",
        serviceKind: "maintenance",
        targetId: "inn_room_2",
        regionId: "harthmere_grove_region",
        mapMarkerId: "inn_room_2",
        questBoardTodo: true,
        createdAtMs: 1,
        acceptedAtMs: 1,
        dueAtMs: 999,
      },
    };
    const quests = getHarthmereBusinessServiceQuests(state, "business_food");
    assert.equal(quests.length, 1);
    assert.equal(quests[0].mapMarkerId, "inn_room_2");
    const adapter = createHarthmereBusinessInterfaceAdapter({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async () => ({ ok: true, economyState: state }),
    });
    assert.equal(
      adapter.getServiceQuests("business_food")[0].questBoardTodo,
      true
    );
    assert.equal(
      adapter
        .getOwnerDashboard("business_food")
        .metrics.some((metric) => metric.id === "orders"),
      true
    );
  });
});

describe("Harthmere business interface backend quest handoff", () => {
  it("creates a backend service quest when a field-service contract is accepted", function () {
    this.timeout(20_000);
    const authority = require("../../../../shared/harthmere/mmo_economy_authority");
    let economy = authority.defaultHarthmereProductionEconomyState();
    const context = {
      actorGold: 5000,
      actorInventoryItems: {},
      allowNpcAdministration: true,
    };
    let result = authority.reduceHarthmereEconomyMutation(
      economy,
      {
        requestId: "register_repair_business",
        actorId: "owner_1",
        nowMs: 1000,
        operation: "register_business",
        businessType: "repair_maintenance_person",
        name: "Grove Repair",
        ownerKind: "player",
        ownerId: "owner_1",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
      },
      context
    );
    economy = result.economy;
    const businessId = Object.keys(economy.businesses)[0];
    result = authority.reduceHarthmereEconomyMutation(
      economy,
      {
        requestId: "issue_repair_license",
        actorId: "owner_1",
        nowMs: 1100,
        operation: "issue_license",
        businessId,
        licenseClass: "basic_trade",
        licenseLevel: 1,
      },
      context
    );
    economy = result.economy;
    result = authority.reduceHarthmereEconomyMutation(
      economy,
      {
        requestId: "open_repair_business",
        actorId: "owner_1",
        nowMs: 1200,
        operation: "open_business",
        businessId,
        propertyId: "repair_shop_property",
        townId: "harthmere_grove",
      },
      context
    );
    economy = result.economy;
    result = authority.reduceHarthmereEconomyMutation(
      economy,
      {
        requestId: "create_repair_order",
        actorId: "customer_1",
        nowMs: 1300,
        operation: "create_contract",
        ownerKind: "player",
        ownerId: "customer_1",
        actorGold: 500,
        businessType: "repair_maintenance_person",
        title: "Repair damaged cottage door",
        rewardGold: 90,
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        deadlineAtMs: 1300 + 7 * 24 * 60 * 60 * 1000,
        requirements: [{ serviceNeed: "maintenance", serviceUnits: 1 }],
        fieldService: {
          required: true,
          serviceKind: "maintenance",
          targetId: "cottage_door_3",
          mapMarkerId: "cottage_door_3",
          questTitle: "Repair cottage door",
          todoText: "Go repair the damaged cottage door.",
        },
      },
      { actorGold: 500, actorInventoryItems: {} }
    );
    economy = result.economy;
    const contractId = Object.keys(economy.contracts)[0];
    result = authority.reduceHarthmereEconomyMutation(
      economy,
      {
        requestId: "accept_repair_order",
        actorId: "owner_1",
        nowMs: 1400,
        operation: "accept_contract",
        businessId,
        contractId,
        createQuestOnAccept: true,
      },
      context
    );
    assert.deepEqual(result.warnings, []);
    const quests = Object.values(
      (result.economy.businessSystems as any).serviceQuests ?? {}
    ) as any[];
    assert.equal(quests.length, 1);
    assert.equal(quests[0].contractId, contractId);
    assert.equal(quests[0].businessId, businessId);
    assert.equal(quests[0].mapMarkerId, "cottage_door_3");
    assert.equal(quests[0].questBoardTodo, true);
    assert.ok(
      result.sharedStateKeys.includes(
        `harthmere:economy:business_service_quest:${quests[0].questId}`
      )
    );
  });
});
