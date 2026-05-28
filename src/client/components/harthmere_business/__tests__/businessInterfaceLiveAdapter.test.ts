/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  HARTHMERE_BUSINESS_SERVICE_ACTIONS_V1,
  HARTHMERE_BUSINESS_TYPE_ORDER_V1,
  createHarthmereBusinessInterfaceAdapterV1,
  fetchHarthmereBusinessEconomyStateV1,
  getHarthmereBusinessCompliancePanelV1,
  getHarthmereBusinessFieldServiceSpecV1,
  getHarthmereBusinessFinancePanelV1,
  getHarthmereBusinessInteractionPromptV1,
  getHarthmereBusinessOperationScreenV1,
  getHarthmereBusinessServiceQuestsV1,
  getHarthmereBusinessShopfrontV1,
  getHarthmereBusinessStaffPanelV1,
  getHarthmereContractBoardV1,
  getHarthmereGuildBusinessPanelV1,
  getHarthmereMarketplacePanelV1,
  getHarthmereOwnerDashboardV1,
  getHarthmereTownHallPanelV1,
  requiresHarthmereFieldServiceQuestV1,
  getHarthmereBusinessActorModeV1,
  getHarthmereBusinessServiceActionsV1,
  getHarthmereCustomerOrdersV1,
  getHarthmereVisibleBusinessInventoryV1,
  isHarthmereBusinessInterfaceAvailableV1,
  normalizeHarthmereBusinessEconomySnapshotV1,
  submitHarthmereBusinessEconomyMutationV1,
  type HarthmereBusinessEconomySnapshotV1,
  type HarthmereBusinessTypeIdV1,
} from "../businessInterfaceLiveAdapter";

function businessType(typeId: HarthmereBusinessTypeIdV1) {
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

function business(id: string, typeId: HarthmereBusinessTypeIdV1, ownerId = "player_a") {
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
      rare_seed: { itemId: "rare_seed", count: 2, expiresAtMs: 1_900_000_000_000 },
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

function sampleSnapshot(): HarthmereBusinessEconomySnapshotV1 {
  const businessTypes = Object.fromEntries(HARTHMERE_BUSINESS_TYPE_ORDER_V1.map((typeId) => [typeId, businessType(typeId)])) as any;
  const owned = business("business_food", "food_service_restaurant", "player_a");
  const other = business("business_clinic", "medical_doctor", "player_b");
  const guild = { ...business("business_guild_forge", "weapons_tools", "guild_1"), ownerKind: "guild" as const, ownerId: "guild_1" };
  return normalizeHarthmereBusinessEconomySnapshotV1({
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
      return { ok: true, json: async () => ({ ok: true, economyState: sampleSnapshot() }) };
    }) as any;
    const state = await fetchHarthmereBusinessEconomyStateV1(fetchImpl);
    assert.equal(calls[0].url, "/api/harthmere/live_mode_economy_state");
    assert.equal(calls[0].init.method, "GET");
    assert.equal(calls[0].init.credentials, "same-origin");
    assert.equal(state.businesses.business_food.name, "food_service_restaurant Shop");
  });

  it("posts every interface write through request_economy_mutation", async () => {
    const calls: any[] = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init });
      return { ok: true, json: async () => ({ ok: true, economyState: sampleSnapshot() }) };
    }) as any;
    await submitHarthmereBusinessEconomyMutationV1("deposit_business_inventory", { businessId: "business_food", itemId: "worker_meal", count: 2 }, { fetchImpl, requestId: "fixed_business_request" });
    assert.equal(calls[0].url, "/api/harthmere/live_mode");
    assert.equal(calls[0].init.method, "POST");
    const envelope = JSON.parse(calls[0].init.body);
    assert.equal(envelope.requestId, "fixed_business_request");
    assert.equal(envelope.idempotencyKey, "fixed_business_request");
    assert.equal(envelope.actionKind, "request_economy_mutation");
    assert.equal(envelope.subsystem, "economy");
    assert.equal(envelope.payload.operation, "deposit_business_inventory");
    assert.equal(envelope.payload.businessId, "business_food");
  });

  it("throws when the backend rejects a business reducer operation", async () => {
    const fetchImpl = (async () => ({ ok: true, json: async () => ({ backendMutation: { warnings: ["economy_rejected:business_permission_required"] } }) })) as any;
    await assert.rejects(
      () => submitHarthmereBusinessEconomyMutationV1("withdraw_business_inventory", { businessId: "business_food", itemId: "worker_meal", count: 1 }, { fetchImpl, requestId: "fixed" }),
      /business_permission_required/,
    );
  });

  it("only exposes the interface while the world says the player is inside a real business", () => {
    const state = sampleSnapshot();
    assert.equal(isHarthmereBusinessInterfaceAvailableV1(state, undefined), false);
    assert.equal(isHarthmereBusinessInterfaceAvailableV1(state, "missing_business"), false);
    assert.equal(isHarthmereBusinessInterfaceAvailableV1(state, "business_food"), true);
  });

  it("derives owner mode for owned and permission-scoped businesses and customer mode for other businesses", () => {
    const state = sampleSnapshot();
    assert.equal(getHarthmereBusinessActorModeV1(state, "business_food"), "owner");
    assert.equal(getHarthmereBusinessActorModeV1(state, "business_guild_forge"), "owner");
    assert.equal(getHarthmereBusinessActorModeV1(state, "business_clinic"), "customer");
  });

  it("normalizes dashboard data for money, todos, visible inventory, employees, and customer order status", () => {
    const state = sampleSnapshot();
    const inventory = getHarthmereVisibleBusinessInventoryV1(state, "business_food");
    assert.equal(inventory.find((item) => item.itemId === "worker_meal")?.priceGold, 30);
    const customerOrders = getHarthmereCustomerOrdersV1(state, "business_clinic");
    assert.equal(customerOrders[0].contractId, "contract_customer_open");

    const adapter = createHarthmereBusinessInterfaceAdapterV1({ state, hydrated: true, refresh: async () => state, submit: async () => ({ ok: true, economyState: state }) });
    assert.equal(adapter.isAvailable("business_food"), true);
    assert.equal(adapter.getMoneySummary("business_food").bankBalanceGold, 900);
    assert.equal(adapter.getEmployees("business_food")[0].role, "cook");
    assert.equal(adapter.getTodos("business_food").some((todo) => todo.id === "active_orders"), true);
    assert.equal(adapter.getInventory("business_food").length, 2);
  });

  it("maps owner management controls to exact backend economy operations", async () => {
    const operations: Array<{ operation: string; payload: Record<string, unknown> }> = [];
    const state = sampleSnapshot();
    const adapter = createHarthmereBusinessInterfaceAdapterV1({
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
    await adapter.openBusiness("business_food", "property_business_food", "harthmere_grove");
    await adapter.hireWorker("business_food", "cook", 12, 3);
    await adapter.assignWorker("business_food", "employee_1", "kitchen");
    await adapter.payPayroll("business_food");
    await adapter.acceptContract("business_food", "contract_1");
    await adapter.fulfillContract("business_food", "contract_2");
    await adapter.grantPermission("business_food", "player_b", ["accountant"]);

    assert.deepEqual(operations.map((entry) => entry.operation), [
      "create_business_bank_account",
      "transfer_personal_to_business_bank",
      "transfer_business_to_personal_bank",
      "deposit_business_inventory",
      "withdraw_business_inventory",
      "set_business_prices",
      "open_business",
      "hire_worker",
      "assign_worker",
      "pay_payroll",
      "accept_contract",
      "fulfill_contract",
      "grant_business_permission",
    ]);
    assert.deepEqual(operations[5].payload.priceModifiers, { worker_meal: 1.25 });
    assert.equal(operations[12].payload.targetActorId, "player_b");
  });

  it("maps customer service requests to escrowed backend contracts", async () => {
    const operations: Array<{ operation: string; payload: Record<string, unknown> }> = [];
    const state = sampleSnapshot();
    const adapter = createHarthmereBusinessInterfaceAdapterV1({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async (operation, payload) => {
        operations.push({ operation, payload });
        return { ok: true, economyState: state };
      },
    });
    await adapter.requestCustomerService("business_clinic", "request_care", { rewardGold: 175 });
    assert.equal(operations[0].operation, "create_contract");
    assert.equal(operations[0].payload.businessType, "medical_doctor");
    assert.equal(operations[0].payload.ownerKind, "player");
    assert.equal(operations[0].payload.rewardGold, 175);
    assert.deepEqual(operations[0].payload.requirements, [{ serviceNeed: "health", serviceUnits: 1 }]);
  });

  it("defines owner and customer service actions for every production business type", () => {
    assert.equal(HARTHMERE_BUSINESS_TYPE_ORDER_V1.length, 19);
    for (const typeId of HARTHMERE_BUSINESS_TYPE_ORDER_V1) {
      const actions = HARTHMERE_BUSINESS_SERVICE_ACTIONS_V1[typeId];
      assert.ok(actions?.length >= 2, `${typeId} should have several interface actions`);
      assert.ok(actions.some((action) => action.audience === "owner" || action.audience === "both"), `${typeId} missing owner action`);
      assert.ok(actions.some((action) => action.audience === "customer" || action.audience === "both"), `${typeId} missing customer action`);
      for (const action of actions) {
        assert.ok(action.actionId);
        assert.ok(action.label);
        assert.ok(action.operation);
        assert.ok(action.description.length > 10);
      }
    }
  });

  it("executes representative business-specific owner actions through the backend operation registry", async () => {
    const state = sampleSnapshot();
    const operations: string[] = [];
    const adapter = createHarthmereBusinessInterfaceAdapterV1({
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
    assert.deepEqual(operations, ["set_restaurant_menu", "serve_restaurant_day"]);
    assert.deepEqual(adapter.getServiceActions("missing_business"), []);
  });
});

describe("Harthmere in-world business interface v2 screens", () => {
  it("builds world interaction prompts only while the player is inside a real business", () => {
    const state = sampleSnapshot();
    const missing = getHarthmereBusinessInteractionPromptV1(state, { insideBusiness: false, nearbyBusinessId: "business_food" });
    assert.equal(missing.visible, false);
    const ownerPrompt = getHarthmereBusinessInteractionPromptV1(state, { insideBusiness: true, nearbyBusinessId: "business_food", interactionKeyLabel: "E" });
    assert.equal(ownerPrompt.visible, true);
    assert.equal(ownerPrompt.mode, "owner");
    assert.match(ownerPrompt.label, /Press E to manage/);
    const customerPrompt = getHarthmereBusinessInteractionPromptV1(state, { insideBusiness: true, nearbyBusinessId: "business_clinic", interactionKeyLabel: "F" });
    assert.equal(customerPrompt.mode, "customer");
    assert.match(customerPrompt.label, /Press F to use/);
  });

  it("derives owner dashboard, shopfront, contract board, finance, staff, and compliance panels from backend data", () => {
    const state = sampleSnapshot();
    const dashboard = getHarthmereOwnerDashboardV1(state, "business_food");
    assert.equal(dashboard.metrics.length, 4);
    assert.ok(dashboard.todos.some((todo) => todo.id === "active_orders"));
    const shopfront = getHarthmereBusinessShopfrontV1(state, "business_food");
    assert.equal(shopfront.inventory.find((item) => item.itemId === "worker_meal")?.priceGold, 30);
    const board = getHarthmereContractBoardV1(state, "business_food");
    assert.equal(board.open[0].contractId, "contract_1");
    assert.equal(board.active[0].contractId, "contract_2");
    const finance = getHarthmereBusinessFinancePanelV1(state, "business_food");
    assert.equal(finance.summary.bankBalanceGold, 900);
    const staff = getHarthmereBusinessStaffPanelV1(state, "business_food");
    assert.equal(staff.payrollDueGold, 12);
    assert.equal(staff.canHire, true);
    const compliance = getHarthmereBusinessCompliancePanelV1(state, "business_food");
    assert.equal(compliance.licenseLevel, 2);
    assert.deepEqual(compliance.warnings, []);
  });

  it("builds tailored operation screens for every business type without dummy runtime records", () => {
    const state = sampleSnapshot();
    for (const typeId of HARTHMERE_BUSINESS_TYPE_ORDER_V1) {
      const id = `screen_${typeId}`;
      state.businesses[id] = business(id, typeId, "player_a") as any;
      const screen = getHarthmereBusinessOperationScreenV1(state, id);
      assert.equal(screen.typeId, typeId);
      assert.ok(screen.ownerActions.length > 0, `${typeId} should expose owner actions`);
      assert.ok(screen.customerActions.length > 0, `${typeId} should expose customer actions`);
      assert.ok(Object.keys(screen.systemRecords).includes("serviceQuests"));
    }
  });

  it("builds town hall, marketplace, and guild business interfaces from real snapshot records", () => {
    const state = sampleSnapshot();
    state.towns.harthmere_grove = { townId: "harthmere_grove", publicBudgetGold: 1200, needs: {}, regionId: "harthmere_grove_region" } as any;
    state.marketOrders.order_1 = { orderId: "order_1", kind: "sell", businessId: "business_food", itemId: "worker_meal", count: 2, unitPriceGold: 30, status: "open" } as any;
    const townHall = getHarthmereTownHallPanelV1(state);
    assert.equal(townHall.towns.length, 1);
    const market = getHarthmereMarketplacePanelV1(state);
    assert.equal(market.openOrders[0].orderId, "order_1");
    assert.equal(market.regionalPrices.worker_meal, 20);
    const guild = getHarthmereGuildBusinessPanelV1(state, "guild_1");
    assert.equal(guild.guildBusinesses[0].businessId, "business_guild_forge");
    assert.deepEqual(guild.permissions.business_guild_forge, ["accountant", "inventory_manager"]);
  });

  it("marks field-service customer orders so accepting them can create map and quest-board todos", async () => {
    const state = sampleSnapshot();
    const action = getHarthmereBusinessServiceActionsV1("medical_doctor", "customer").find((entry) => entry.actionId === "request_care")!;
    assert.equal(requiresHarthmereFieldServiceQuestV1(action), true);
    const spec = getHarthmereBusinessFieldServiceSpecV1(state.businesses.business_clinic, action, { targetId: "patient_home_1" });
    assert.equal(spec?.required, true);
    assert.equal(spec?.targetId, "patient_home_1");

    const operations: Array<{ operation: string; payload: Record<string, unknown> }> = [];
    const adapter = createHarthmereBusinessInterfaceAdapterV1({
      state,
      hydrated: true,
      refresh: async () => state,
      submit: async (operation, payload) => {
        operations.push({ operation, payload });
        return { ok: true, economyState: state };
      },
    });
    await adapter.requestCustomerService("business_clinic", "request_care", { targetId: "patient_home_1", rewardGold: 225 });
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
    const quests = getHarthmereBusinessServiceQuestsV1(state, "business_food");
    assert.equal(quests.length, 1);
    assert.equal(quests[0].mapMarkerId, "inn_room_2");
    const adapter = createHarthmereBusinessInterfaceAdapterV1({ state, hydrated: true, refresh: async () => state, submit: async () => ({ ok: true, economyState: state }) });
    assert.equal(adapter.getServiceQuests("business_food")[0].questBoardTodo, true);
    assert.equal(adapter.getOwnerDashboard("business_food").metrics.some((metric) => metric.id === "orders"), true);
  });
});

describe("Harthmere business interface backend quest handoff", () => {
  it("creates a backend service quest when a field-service contract is accepted", () => {
    const authority = require("../../../../shared/harthmere/mmo_economy_authority_v1");
    let economy = authority.defaultHarthmereProductionEconomyStateV1();
    const context = { actorGold: 5000, actorInventoryItems: {}, allowNpcAdministration: true };
    let result = authority.reduceHarthmereEconomyMutationV1(economy, {
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
    }, context);
    economy = result.economy;
    const businessId = Object.keys(economy.businesses)[0];
    result = authority.reduceHarthmereEconomyMutationV1(economy, {
      requestId: "issue_repair_license",
      actorId: "owner_1",
      nowMs: 1100,
      operation: "issue_license",
      businessId,
      licenseClass: "basic_trade",
      licenseLevel: 1,
    }, context);
    economy = result.economy;
    result = authority.reduceHarthmereEconomyMutationV1(economy, {
      requestId: "open_repair_business",
      actorId: "owner_1",
      nowMs: 1200,
      operation: "open_business",
      businessId,
      propertyId: "repair_shop_property",
      townId: "harthmere_grove",
    }, context);
    economy = result.economy;
    result = authority.reduceHarthmereEconomyMutationV1(economy, {
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
    }, { actorGold: 500, actorInventoryItems: {} });
    economy = result.economy;
    const contractId = Object.keys(economy.contracts)[0];
    result = authority.reduceHarthmereEconomyMutationV1(economy, {
      requestId: "accept_repair_order",
      actorId: "owner_1",
      nowMs: 1400,
      operation: "accept_contract",
      businessId,
      contractId,
      createQuestOnAccept: true,
    }, context);
    assert.deepEqual(result.warnings, []);
    const quests = Object.values((result.economy.businessSystems as any).serviceQuests ?? {}) as any[];
    assert.equal(quests.length, 1);
    assert.equal(quests[0].contractId, contractId);
    assert.equal(quests[0].businessId, businessId);
    assert.equal(quests[0].mapMarkerId, "cottage_door_3");
    assert.equal(quests[0].questBoardTodo, true);
    assert.ok(result.sharedStateKeys.includes(`harthmere:economy:business_service_quest:${quests[0].questId}`));
  });
});
