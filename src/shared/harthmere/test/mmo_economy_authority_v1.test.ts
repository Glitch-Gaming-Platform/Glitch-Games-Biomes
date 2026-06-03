import assert from "assert";
import {
  HARTHMERE_ECONOMY_BUSINESS_TYPES_V1,
  defaultHarthmereProductionEconomyStateV1,
  economyPriceForItemV1,
  reduceHarthmereEconomyMutationV1,
  type HarthmereEconomyMutationContextV1,
  type HarthmereEconomyMutationRequestV1,
  type HarthmereProductionEconomyStateV1,
} from "../mmo_economy_authority_v1";
import {
  createHarthmereProductionEconomyClientSnapshotFromBackendV1,
  defaultHarthmereLiveModeBackendStateV1,
  reduceHarthmereLiveModeBackendStateV1,
} from "../live_mode_backend_v1";
import { HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1 } from "../business_customer_simulator_v1";
import { normalizeHarthmereEconomyBusinessSystemsStateV1 } from "../mmo_economy_business_systems_v1";
import type {
  HarthmereLiveModeActionKindV1,
  HarthmereLiveModeAuthorityEnvelopeV1,
} from "../live_mode_readiness_v1";

const NOW_MS = 1_760_000_000_000;
const ACTOR = "economy_player_1";

function ctx(overrides: Partial<HarthmereEconomyMutationContextV1> = {}): HarthmereEconomyMutationContextV1 {
  return {
    actorGold: 20_000,
    actorInventoryItems: {},
    canManageGuildBusiness: () => false,
    canManageTownBusiness: () => false,
    allowNpcAdministration: false,
    ...overrides,
  };
}

function req(operation: string, payload: Partial<HarthmereEconomyMutationRequestV1> = {}): HarthmereEconomyMutationRequestV1 {
  return {
    requestId: `economy-test-${operation}-${Math.random()}`,
    actorId: ACTOR,
    nowMs: NOW_MS,
    operation,
    ...payload,
  };
}

function mutate(
  state: HarthmereProductionEconomyStateV1,
  operation: string,
  payload: Partial<HarthmereEconomyMutationRequestV1> = {},
  context: HarthmereEconomyMutationContextV1 = ctx(),
) {
  return reduceHarthmereEconomyMutationV1(state, req(operation, payload), context);
}

function createBusiness(
  state = defaultHarthmereProductionEconomyStateV1(),
  type: HarthmereEconomyMutationRequestV1["businessType"] = "food_service_restaurant",
  name = "Grove Hearth",
) {
  const before = new Set(Object.keys(state.businesses));
  const result = mutate(state, "register_business", { businessType: type, name }, ctx({ actorGold: 50_000 }));
  assert.deepStrictEqual(result.warnings, []);
  const businessId = Object.keys(result.economy.businesses).find((id) => !before.has(id));
  assert.ok(businessId, "expected a new business id");
  return { state: result.economy, businessId, result };
}

function licenseAndOpen(
  state: HarthmereProductionEconomyStateV1,
  businessId: string,
  licenseLevel = 1,
  townId = "harthmere_grove",
) {
  let result = mutate(state, "issue_license", { businessId, licenseLevel }, ctx({ actorGold: 50_000 }));
  assert.deepStrictEqual(result.warnings, []);
  result = mutate(result.economy, "open_business", { businessId, propertyId: `property_${businessId}`, townId }, ctx({ actorGold: 50_000 }));
  assert.deepStrictEqual(result.warnings, []);
  return result.economy;
}

function env(
  actionKind: HarthmereLiveModeActionKindV1,
  actorId: string,
  payload: Record<string, unknown> = {},
  overrides: Partial<HarthmereLiveModeAuthorityEnvelopeV1> = {},
): HarthmereLiveModeAuthorityEnvelopeV1 {
  return {
    requestId: `live-economy-${actionKind}-${Math.random()}`,
    idempotencyKey: `idem-${Math.random()}`,
    actorId,
    actionKind,
    subsystem: "economy",
    source: "client_request",
    clientSentAtMs: NOW_MS,
    serverReceivedAtMs: NOW_MS,
    serverTick: NOW_MS,
    actorEntityVersion: 1,
    zoneId: "harthmere_grove",
    payload,
    ...overrides,
  };
}

describe("mmo_economy_authority_v1 — catalog and lifecycle", () => {
  it("starts with no runtime businesses/contracts but exposes the full economy business catalog", () => {
    const state = defaultHarthmereProductionEconomyStateV1();
    assert.strictEqual(Object.keys(state.businesses).length, 0);
    assert.strictEqual(Object.keys(state.contracts).length, 0);
    assert.strictEqual(Object.keys(HARTHMERE_ECONOMY_BUSINESS_TYPES_V1).length, 19);
    assert.ok(HARTHMERE_ECONOMY_BUSINESS_TYPES_V1.exotic_matter_refinery.startCostGold > 0);
    assert.ok(
      HARTHMERE_ECONOMY_BUSINESS_TYPES_V1.exotic_matter_refinery.inputItemFamilies.includes(
        "antihydrogen_block"
      )
    );
    assert.ok(
      HARTHMERE_ECONOMY_BUSINESS_TYPES_V1.exotic_matter_refinery.outputItemFamilies.includes(
        "alcubierre_drive_core"
      )
    );
    assert.ok(HARTHMERE_ECONOMY_BUSINESS_TYPES_V1.courier.startCostGold > 0);
  });

  it("registers, licenses, and opens a real player business while rejecting invalid and duplicate creation", () => {
    let state = defaultHarthmereProductionEconomyStateV1();
    let result = mutate(state, "register_business", { businessType: "not_real" as any, name: "Bad" });
    assert.ok(result.warnings.includes("economy_rejected:unknown_business_type"));

    result = mutate(state, "register_business", { businessType: "portal_transit_company", name: "Portal Co" }, ctx({ actorGold: 100 }));
    assert.ok(result.warnings.includes("economy_rejected:insufficient_gold_for_startup"));

    result = mutate(state, "register_business", { businessType: "food_service_restaurant", name: "Grove Hearth" }, ctx({ actorGold: 50_000 }));
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual(result.inventoryGoldDelta, -250);
    state = result.economy;
    const businessId = Object.keys(state.businesses)[0];

    result = mutate(state, "register_business", { businessType: "food_service_restaurant", name: "Grove Hearth" }, ctx({ actorGold: 50_000 }));
    assert.ok(result.warnings.includes("economy_rejected:duplicate_business_name_for_owner"));

    result = mutate(state, "open_business", { businessId, propertyId: "property_1", townId: "harthmere_grove" });
    assert.ok(result.warnings.includes("economy_rejected:license_level_too_low"));

    state = licenseAndOpen(state, businessId, 1);
    assert.strictEqual(state.businesses[businessId].status, "open");
    assert.strictEqual(state.businesses[businessId].townId, "harthmere_grove");
    assert.ok(state.towns.harthmere_grove);
  });

  it("enforces guild, town, and NPC ownership permissions", () => {
    let state = defaultHarthmereProductionEconomyStateV1();
    let result = mutate(state, "register_business", {
      businessType: "general_trader",
      name: "Guild Market",
      ownerKind: "guild",
      ownerId: "guild_1",
    });
    assert.ok(result.warnings.includes("economy_rejected:guild_business_permission_required"));

    result = mutate(state, "register_business", {
      businessType: "general_trader",
      name: "Guild Market",
      ownerKind: "guild",
      ownerId: "guild_1",
    }, ctx({ canManageGuildBusiness: (guildId) => guildId === "guild_1" }));
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.strictEqual(state.businesses.econ_business_1.ownerKind, "guild");

    result = mutate(state, "register_npc_business", {
      businessType: "courier",
      name: "NPC Courier",
      employeeNpcId: "npc_courier_owner",
    });
    assert.ok(result.warnings.includes("economy_rejected:npc_business_requires_admin_context"));

    result = mutate(state, "register_npc_business", {
      businessType: "courier",
      name: "NPC Courier",
      employeeNpcId: "npc_courier_owner",
    }, ctx({ allowNpcAdministration: true }));
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual(result.economy.businesses.econ_business_2.ownerKind, "npc");
  });
});

describe("mmo_economy_authority_v1 — inventory, pricing, taxes, and sales", () => {
  it("moves real player inventory into and out of business storage with slot checks", () => {
    const setup = createBusiness();
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    let result = mutate(state, "deposit_business_inventory", {
      businessId: setup.businessId,
      itemId: "worker_meal",
      count: 3,
    }, ctx({ actorInventoryItems: { worker_meal: 2 } }));
    assert.ok(result.warnings.includes("economy_rejected:item_not_available_for_deposit"));

    result = mutate(state, "deposit_business_inventory", {
      businessId: setup.businessId,
      itemId: "worker_meal",
      count: 3,
    }, ctx({ actorInventoryItems: { worker_meal: 3 } }));
    assert.deepStrictEqual(result.warnings, []);
    assert.deepStrictEqual(result.inventoryItemDeltas, { worker_meal: -3 });
    state = result.economy;
    assert.strictEqual(state.businesses[setup.businessId].inventory.worker_meal.count, 3);

    result = mutate(state, "withdraw_business_inventory", {
      businessId: setup.businessId,
      itemId: "worker_meal",
      count: 2,
    });
    assert.deepStrictEqual(result.warnings, []);
    assert.deepStrictEqual(result.inventoryItemDeltas, { worker_meal: 2 });
    assert.strictEqual(result.economy.businesses[setup.businessId].inventory.worker_meal.count, 1);

    const fullState = result.economy;
    fullState.businesses[setup.businessId].storageMaxSlots = 1;
    result = mutate(fullState, "deposit_business_inventory", {
      businessId: setup.businessId,
      itemId: "clean_water",
      count: 1,
    }, ctx({ actorInventoryItems: { clean_water: 1 } }));
    assert.ok(result.warnings.includes("economy_rejected:business_storage_full"));
  });

  it("records customer shop purchases, charges buyers, applies town tax, and uses supply-demand pricing", () => {
    const setup = createBusiness();
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    state.businesses[setup.businessId].inventory.worker_meal = { itemId: "worker_meal", count: 5 };
    state.regions.harthmere_grove_region.itemDemand.worker_meal = 100;
    state.regions.harthmere_grove_region.itemSupply.worker_meal = 10;
    const price = economyPriceForItemV1({
      state,
      regionId: "harthmere_grove_region",
      townId: "harthmere_grove",
      itemId: "worker_meal",
      business: state.businesses[setup.businessId],
    });
    assert.ok(price > 8);

    const result = mutate(state, "record_customer_sale", {
      actorId: "customer_1",
      businessId: setup.businessId,
      itemId: "worker_meal",
      count: 2,
      serviceNeed: "food",
    }, ctx({ actorGold: price * 2 }));
    assert.deepStrictEqual(result.warnings, []);
    assert.deepStrictEqual(result.inventoryItemDeltas, { worker_meal: 2 });
    assert.strictEqual(result.inventoryGoldDelta, -(price * 2));
    const business = result.economy.businesses[setup.businessId];
    assert.strictEqual(business.inventory.worker_meal.count, 3);
    assert.ok(business.balanceGold > 0);
    assert.ok(result.economy.towns.harthmere_grove.publicBudgetGold > 0);
  });

  it("rejects customer purchase edge cases without moving gold or stock", () => {
    const setup = createBusiness();
    const state = licenseAndOpen(setup.state, setup.businessId, 1);
    state.businesses[setup.businessId].inventory.worker_meal = { itemId: "worker_meal", count: 1 };

    let result = mutate(state, "record_customer_sale", {
      actorId: "customer_1",
      businessId: setup.businessId,
      itemId: "worker_meal",
      count: 2,
    }, ctx({ actorGold: 20_000 }));
    assert.ok(result.warnings.includes("economy_rejected:sale_inventory_insufficient"));
    assert.deepStrictEqual(result.inventoryItemDeltas, {});
    assert.strictEqual(result.inventoryGoldDelta, 0);
    assert.strictEqual(result.economy.businesses[setup.businessId].inventory.worker_meal.count, 1);

    result = mutate(state, "record_customer_sale", {
      actorId: "customer_1",
      businessId: setup.businessId,
      itemId: "worker_meal",
      count: 1,
      amountGold: 1,
    }, ctx({ actorGold: 1 }));
    assert.ok(result.warnings.includes("economy_rejected:insufficient_customer_gold_for_sale"));
    assert.deepStrictEqual(result.inventoryItemDeltas, {});
    assert.strictEqual(result.inventoryGoldDelta, 0);
    assert.strictEqual(result.economy.businesses[setup.businessId].inventory.worker_meal.count, 1);

    const closed = JSON.parse(JSON.stringify(state)) as HarthmereProductionEconomyStateV1;
    closed.businesses[setup.businessId].status = "paused";
    result = mutate(closed, "record_customer_sale", {
      actorId: "customer_1",
      businessId: setup.businessId,
      itemId: "worker_meal",
      count: 1,
    }, ctx({ actorGold: 20_000 }));
    assert.ok(result.warnings.includes("economy_rejected:business_not_open"));
    assert.deepStrictEqual(result.inventoryItemDeltas, {});
    assert.strictEqual(result.inventoryGoldDelta, 0);
    assert.strictEqual(result.economy.businesses[setup.businessId].inventory.worker_meal.count, 1);
  });
});

describe("mmo_economy_authority_v1 — contracts and town demand", () => {
  it("creates escrowed contracts, accepts them, fulfills requirements, and rejects missing goods", () => {
    const setup = createBusiness();
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    let result = mutate(state, "create_contract", {
      title: "Feed the watch",
      requirements: [{ itemId: "worker_meal", count: 4 }],
      rewardGold: 120,
      businessType: "food_service_restaurant",
      deadlineAtMs: NOW_MS + 2 * 86_400_000,
    }, ctx({ actorGold: 500 }));
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual(result.inventoryGoldDelta, -120);
    state = result.economy;
    const contractId = Object.keys(state.contracts)[0];

    result = mutate(state, "accept_contract", { businessId: setup.businessId, contractId });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;

    result = mutate(state, "fulfill_contract", { businessId: setup.businessId, contractId });
    assert.ok(result.warnings.includes("economy_rejected:contract_missing_item:worker_meal"));

    state.businesses[setup.businessId].inventory.worker_meal = { itemId: "worker_meal", count: 4 };
    result = mutate(state, "fulfill_contract", { businessId: setup.businessId, contractId });
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual(result.economy.contracts[contractId].status, "fulfilled");
    assert.strictEqual(result.economy.businesses[setup.businessId].balanceGold, 120);
  });

  it("generates town contracts from real town need shortages and refuses overlong deadlines", () => {
    let state = defaultHarthmereProductionEconomyStateV1();
    let result = mutate(state, "create_contract", {
      requirements: [{ serviceNeed: "food", serviceUnits: 1 }],
      rewardGold: 10,
      deadlineAtMs: NOW_MS + 90 * 86_400_000,
    }, ctx({ actorGold: 1000 }));
    assert.ok(result.warnings.includes("economy_rejected:invalid_contract_deadline"));

    result = mutate(state, "run_town_tick", { townId: "harthmere_grove", days: 30 });
    state = result.economy;
    state.towns.harthmere_grove.publicBudgetGold = 1000;
    state.towns.harthmere_grove.needs.food.value = 20;
    result = mutate(state, "generate_town_contracts", { townId: "harthmere_grove", count: 2 });
    assert.deepStrictEqual(result.warnings, []);
    assert.ok(Object.values(result.economy.contracts).some((contract) => contract.issuerKind === "town"));
    assert.ok(result.economy.towns.harthmere_grove.publicBudgetGold < 1000);
  });
});

describe("mmo_economy_authority_v1 — production, workers, payroll, and upkeep", () => {
  it("requires recipe inputs, license, worker skill, and business funds before production", () => {
    const setup = createBusiness(defaultHarthmereProductionEconomyStateV1(), "food_service_restaurant", "Meal Works");
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    state.businesses[setup.businessId].balanceGold = 50;
    let result = mutate(state, "produce_recipe", { businessId: setup.businessId, recipeId: "cook_worker_meals" });
    assert.ok(result.warnings.includes("economy_rejected:recipe_missing_input:crop_bundle") || result.warnings.includes("economy_rejected:recipe_skill_requirement_not_met"));

    result = mutate(state, "hire_worker", {
      businessId: setup.businessId,
      employeeNpcId: "npc_chef_1",
      role: "chef",
      skill: 3,
      wageGoldPerDay: 9,
    });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    state.businesses[setup.businessId].inventory.crop_bundle = { itemId: "crop_bundle", count: 2 };
    state.businesses[setup.businessId].inventory.wild_meat = { itemId: "wild_meat", count: 1 };
    state.businesses[setup.businessId].inventory.clean_water = { itemId: "clean_water", count: 1 };
    result = mutate(state, "produce_recipe", { businessId: setup.businessId, recipeId: "cook_worker_meals" });
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual(result.economy.businesses[setup.businessId].inventory.worker_meal.count, 4);
  });

  it("pays payroll, trains workers, and suspends businesses that cannot fund upkeep", () => {
    const setup = createBusiness();
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    state.businesses[setup.businessId].balanceGold = 200;
    let result = mutate(state, "hire_worker", {
      businessId: setup.businessId,
      role: "server",
      skill: 1,
      wageGoldPerDay: 10,
    });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    const employeeId = Object.keys(state.employees)[0];
    assert.ok(state.employees[employeeId].npcId?.startsWith("generated_worker:"));

    result = mutate(state, "assign_worker", {
      businessId: setup.businessId,
      employeeId,
      assignedTask: "front_counter",
    });
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual(result.economy.employees[employeeId].assignedTask, "front_counter");
    state = result.economy;

    result = mutate(state, "train_worker", { businessId: setup.businessId, employeeId });
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual(result.economy.employees[employeeId].skill, 2);
    state = result.economy;

    result = mutate(state, "pay_payroll", { businessId: setup.businessId, nowMs: NOW_MS + 2 * 86_400_000 } as any);
    assert.deepStrictEqual(result.warnings, []);
    assert.ok(result.economy.businesses[setup.businessId].balanceGold < 200);

    state = result.economy;
    state.businesses[setup.businessId].balanceGold = 0;
    result = mutate(state, "run_upkeep_tick", { businessId: setup.businessId, days: 1 });
    assert.ok(result.warnings.includes("economy_rejected:business_upkeep_insufficient"));
    assert.strictEqual(result.economy.businesses[setup.businessId].status, "suspended");
  });

  it("fires workers and keeps wage totals consistent", () => {
    const setup = createBusiness();
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    let result = mutate(state, "hire_worker", {
      businessId: setup.businessId,
      employeeId: "employee_fire_me",
      role: "server",
      skill: 2,
      wageGoldPerDay: 14,
    });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.ok(state.businesses[setup.businessId].employees.includes("employee_fire_me"));
    assert.strictEqual(state.businesses[setup.businessId].wageGoldPerDay, 14);

    result = mutate(state, "fire_worker", { businessId: setup.businessId, employeeId: "employee_fire_me" });
    assert.deepStrictEqual(result.warnings, []);
    assert.equal(result.economy.employees.employee_fire_me, undefined);
    assert.equal(result.economy.businesses[setup.businessId].employees.includes("employee_fire_me"), false);
    assert.strictEqual(result.economy.businesses[setup.businessId].wageGoldPerDay, 0);
  });

  it("rejects duplicate and invalid employee hiring and assignment edge cases", () => {
    const setup = createBusiness();
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    let result = mutate(state, "hire_worker", {
      businessId: setup.businessId,
      employeeId: "employee_unique",
      employeeNpcId: "npc_unique_worker",
      role: "server",
      skill: 2,
      wageGoldPerDay: 12,
    });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;

    result = mutate(state, "hire_worker", {
      businessId: setup.businessId,
      employeeId: "employee_unique",
      role: "server",
      skill: 2,
      wageGoldPerDay: 12,
    });
    assert.ok(result.warnings.includes("economy_rejected:employee_already_exists"));

    result = mutate(state, "hire_worker", {
      businessId: setup.businessId,
      employeeNpcId: "npc_unique_worker",
      role: "server",
      skill: 2,
      wageGoldPerDay: 12,
    });
    assert.ok(result.warnings.includes("economy_rejected:employee_npc_already_hired"));

    result = mutate(state, "hire_worker", {
      businessId: setup.businessId,
      role: "",
      skill: 2,
      wageGoldPerDay: 12,
    });
    assert.ok(result.warnings.includes("economy_rejected:invalid_worker_role"));

    result = mutate(state, "hire_worker", {
      businessId: setup.businessId,
      role: "server",
      skill: Number.NaN,
      wageGoldPerDay: 12,
    });
    assert.ok(result.warnings.includes("economy_rejected:invalid_worker_skill"));

    result = mutate(state, "hire_worker", {
      businessId: setup.businessId,
      role: "server",
      skill: 2,
      wageGoldPerDay: Number.POSITIVE_INFINITY,
    });
    assert.ok(result.warnings.includes("economy_rejected:invalid_worker_wage"));

    result = mutate(state, "assign_worker", {
      businessId: setup.businessId,
      employeeId: "employee_unique",
      assignedTask: "not a real task",
    });
    assert.ok(result.warnings.includes("economy_rejected:invalid_business_employee_task"));

    result = mutate(state, "assign_worker", {
      businessId: setup.businessId,
      employeeId: "employee_unique",
      assignedTask: "kitchen",
    });
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual(result.economy.employees.employee_unique.assignedTask, "production_station");
  });
});

describe("mmo_economy_authority_v1 — banking, loans, insurance, and failures", () => {
  it("issues capped business loans, records repayment, and rejects over-cap loans", () => {
    const setup = createBusiness();
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    let result = mutate(state, "take_business_loan", { businessId: setup.businessId, principalGold: 10_000 });
    assert.ok(result.warnings.includes("economy_rejected:business_loan_principal_invalid"));

    result = mutate(state, "take_business_loan", { businessId: setup.businessId, principalGold: 500 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    const loanId = Object.keys(state.loans)[0];
    assert.strictEqual(state.businesses[setup.businessId].balanceGold, 500);

    result = mutate(state, "pay_business_loan", { businessId: setup.businessId, loanId, amountGold: 100 });
    assert.deepStrictEqual(result.warnings, []);
    assert.ok(result.economy.loans[loanId].principalRemaining < 500);
  });

  it("records failures, pays covered insurance claims once, and resolves failures with real business funds", () => {
    const setup = createBusiness();
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    state.businesses[setup.businessId].balanceGold = 500;
    let result = mutate(state, "buy_insurance", {
      businessId: setup.businessId,
      coverageKind: "all_risk",
      coverageGold: 300,
      deductibleGold: 50,
      premiumGoldPerDay: 10,
    });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    const policyId = Object.keys(state.insurancePolicies)[0];

    result = mutate(state, "record_failure_event", {
      businessId: setup.businessId,
      failureKind: "kitchen_fire",
      severity: 8,
      cause: "unchecked_stove",
      repairCostGold: 200,
    });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    const failureId = Object.keys(state.failures)[0];
    assert.strictEqual(state.businesses[setup.businessId].status, "suspended");

    result = mutate(state, "file_insurance_claim", { businessId: setup.businessId, policyId, failureId });
    assert.deepStrictEqual(result.warnings, []);
    assert.ok(result.economy.businesses[setup.businessId].balanceGold > state.businesses[setup.businessId].balanceGold);

    state = result.economy;
    result = mutate(state, "file_insurance_claim", { businessId: setup.businessId, policyId, failureId });
    assert.ok(result.warnings.includes("economy_rejected:failure_claim_already_filed"));

    result = mutate(state, "resolve_failure_event", { businessId: setup.businessId, failureId });
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual(result.economy.failures[failureId].resolvedAtMs, NOW_MS);
  });
});

describe("mmo_economy_authority_v1 — money-conservation edge cases (audit hardening)", () => {
  it("does not burn gold when a loan is overpaid beyond its outstanding balance", () => {
    const setup = createBusiness();
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    let result = mutate(state, "take_business_loan", { businessId: setup.businessId, principalGold: 500 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    const loanId = Object.keys(state.loans)[0];
    // Same nowMs => zero accrued interest => totalRemaining === 500.
    state.businesses[setup.businessId].balanceGold = 2000;
    result = mutate(state, "pay_business_loan", { businessId: setup.businessId, loanId, amountGold: 800 });
    assert.deepStrictEqual(result.warnings, []);
    const after = result.economy.businesses[setup.businessId];
    // Only the 500 outstanding may be deducted; the 300 overpayment must not vanish.
    assert.strictEqual(after.balanceGold, 1500);
    assert.strictEqual(result.economy.loans[loanId].principalRemaining, 0);
    assert.strictEqual(result.economy.loans[loanId].status, "paid");
    assert.strictEqual(after.debtGold, 0);
  });

  it("charges insurance premium for the full coverage term, not a single day", () => {
    const setup = createBusiness();
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    state.businesses[setup.businessId].balanceGold = 500;
    const result = mutate(state, "buy_insurance", {
      businessId: setup.businessId,
      coverageKind: "all_risk",
      coverageGold: 300,
      deductibleGold: 50,
      premiumGoldPerDay: 10,
    });
    assert.deepStrictEqual(result.warnings, []);
    // 10/day across the 30-day term => 300 charged up front (500 - 300 = 200).
    assert.strictEqual(result.economy.businesses[setup.businessId].balanceGold, 200);
  });

  it("rejects insurance when the business cannot fund the full-term premium", () => {
    const setup = createBusiness();
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    // Enough for a single day's premium (10) but not the full 300 term.
    state.businesses[setup.businessId].balanceGold = 100;
    const result = mutate(state, "buy_insurance", {
      businessId: setup.businessId,
      coverageKind: "all_risk",
      coverageGold: 300,
      deductibleGold: 50,
      premiumGoldPerDay: 10,
    });
    assert.ok(result.warnings.includes("economy_rejected:insurance_premium_unfunded"));
  });

  it("rejects new loans once existing debt fully consumes borrowing capacity", () => {
    const setup = createBusiness();
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    // licenseLevel 1 capacity ~1500; pile on debt beyond it.
    state.businesses[setup.businessId].debtGold = 5000;
    const result = mutate(state, "take_business_loan", { businessId: setup.businessId, principalGold: 200 });
    assert.ok(result.warnings.includes("economy_rejected:business_loan_principal_invalid"));
  });

  it("settles the defaulted loan and clears business debt when collateral is seized", () => {
    const setup = createBusiness(defaultHarthmereProductionEconomyStateV1(), "general_trader", "Foreclosed Books");
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    let result = mutate(state, "link_business_property", { businessId: setup.businessId, propertyId: "rental_shop", rentGoldPerDay: 5 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    result = mutate(state, "take_business_loan", { businessId: setup.businessId, principalGold: 1000, dailyInterestRate: 0.02, dueAtMs: NOW_MS + 1000 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    const loanId = Object.keys(state.loans)[0];
    assert.ok(state.businesses[setup.businessId].debtGold >= 1000);
    result = mutate(state, "run_loan_default_tick", { nowMs: NOW_MS + 10_000 } as any);
    state = result.economy;
    assert.strictEqual((state.loans as any)[loanId].status, "defaulted");
    result = mutate(state, "seize_loan_collateral", { loanId }, ctx({ allowNpcAdministration: true }));
    assert.deepStrictEqual(result.warnings, []);
    const settled = result.economy;
    assert.strictEqual((settled.loans as any)[loanId].status, "paid");
    assert.strictEqual((settled.loans as any)[loanId].principalRemaining, 0);
    assert.strictEqual(settled.businesses[setup.businessId].debtGold, 0);
    assert.strictEqual((settled as any).businessSystems.propertyIntegrations.rental_shop.ownerKind, "town");
  });

  it("settles outstanding loans from liquidation proceeds before crediting the owner", () => {
    const setup = createBusiness(defaultHarthmereProductionEconomyStateV1(), "general_trader", "Liquidation Books");
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    const result0 = mutate(state, "take_business_loan", { businessId: setup.businessId, principalGold: 1000, dailyInterestRate: 0.02 });
    assert.deepStrictEqual(result0.warnings, []);
    state = result0.economy;
    const loanId = Object.keys(state.loans)[0];
    state.businesses[setup.businessId].inventory = { scrap: { itemId: "scrap", count: 100 } }; // worth 100*2 = 200
    state.businesses[setup.businessId].balanceGold = 0;
    state.businesses[setup.businessId].status = "bankrupt";
    const result = mutate(state, "liquidate_bankrupt_business", { businessId: setup.businessId });
    assert.deepStrictEqual(result.warnings, []);
    const after = result.economy;
    // Proceeds (200) pay down the 1000 loan first; nothing left for the owner.
    assert.strictEqual((after.loans as any)[loanId].principalRemaining, 800);
    assert.strictEqual(after.businesses[setup.businessId].balanceGold, 0);
    assert.strictEqual(after.businesses[setup.businessId].debtGold, 800);
    assert.strictEqual(after.businesses[setup.businessId].status, "closed");
  });
});

describe("mmo_economy_authority_v1 — logistics, market, town simulation, and NPC competition", () => {
  it("ships goods only over safe funded routes and creates a failure on unsafe routes", () => {
    const seller = createBusiness(defaultHarthmereProductionEconomyStateV1(), "general_trader", "Sender Shop");
    let state = licenseAndOpen(seller.state, seller.businessId, 1, "town_a");
    const buyerSetup = createBusiness(state, "general_trader", "Receiver Shop");
    state = licenseAndOpen(buyerSetup.state, buyerSetup.businessId, 1, "town_b");
    state.businesses[seller.businessId].inventory.iron_ingot = { itemId: "iron_ingot", count: 5 };
    state.businesses[seller.businessId].balanceGold = 100;

    let result = mutate(state, "register_trade_route", {
      originTownId: "town_a",
      destinationTownId: "town_b",
      distanceUnits: 3,
      safetyRating: 10,
      transitFeeGold: 2,
    }, ctx({ actorGold: 1000 }));
    state = result.economy;
    const unsafeRoute = Object.keys(state.tradeRoutes)[0];
    result = mutate(state, "ship_goods", {
      businessId: seller.businessId,
      toBusinessId: buyerSetup.businessId,
      routeId: unsafeRoute,
      itemId: "iron_ingot",
      count: 2,
    });
    assert.ok(result.warnings.includes("economy_rejected:shipment_route_too_unsafe"));

    result = mutate(state, "register_trade_route", {
      originTownId: "town_a",
      destinationTownId: "town_b",
      distanceUnits: 3,
      safetyRating: 80,
      transitFeeGold: 2,
    }, ctx({ actorGold: 1000 }));
    state = result.economy;
    const routeIds = Object.keys(state.tradeRoutes);
    const safeRoute = routeIds[routeIds.length - 1];
    result = mutate(state, "ship_goods", {
      businessId: seller.businessId,
      toBusinessId: buyerSetup.businessId,
      routeId: safeRoute,
      itemId: "iron_ingot",
      count: 2,
    });
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual(result.economy.businesses[buyerSetup.businessId].inventory.iron_ingot.count, 2);
  });

  it("supports market sell orders and settlement between real businesses", () => {
    const seller = createBusiness(defaultHarthmereProductionEconomyStateV1(), "general_trader", "Seller Shop");
    let state = licenseAndOpen(seller.state, seller.businessId, 1);
    const buyer = createBusiness(state, "general_trader", "Buyer Shop");
    state = licenseAndOpen(buyer.state, buyer.businessId, 1);
    state.businesses[seller.businessId].inventory.wood_plank = { itemId: "wood_plank", count: 5 };
    state.businesses[buyer.businessId].balanceGold = 200;

    let result = mutate(state, "post_market_order", {
      businessId: seller.businessId,
      orderKind: "sell",
      itemId: "wood_plank",
      count: 3,
      unitPriceGold: 10,
    });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    const orderId = Object.keys(state.marketOrders)[0];
    result = mutate(state, "settle_market_order", { businessId: buyer.businessId, orderId });
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual(result.economy.marketOrders[orderId].status, "filled");
    assert.strictEqual(result.economy.businesses[buyer.businessId].inventory.wood_plank.count, 3);
  });

  it("runs town demand ticks using stocked open businesses and explicit NPC competitors", () => {
    const setup = createBusiness(defaultHarthmereProductionEconomyStateV1(), "food_service_restaurant", "Soup Loop");
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    state.businesses[setup.businessId].inventory.worker_meal = { itemId: "worker_meal", count: 5 };
    state.towns.harthmere_grove.needs.food.value = 10;
    let result = mutate(state, "run_town_tick", { townId: "harthmere_grove", days: 1 });
    assert.deepStrictEqual(result.warnings, []);
    assert.ok(result.economy.towns.harthmere_grove.needs.food.value > 10);
    assert.ok(result.economy.businesses[setup.businessId].balanceGold > 0);

    state = result.economy;
    result = mutate(state, "register_npc_business", {
      businessType: "courier",
      name: "NPC Runners",
      employeeNpcId: "npc_runner_owner",
      regionId: "harthmere_grove_region",
    }, ctx({ allowNpcAdministration: true }));
    state = result.economy;
    const npcBusinessId = Object.keys(state.businesses).find((id) => state.businesses[id].ownerKind === "npc")!;
    state.businesses[npcBusinessId].licenseLevel = 1;
    state.businesses[npcBusinessId].propertyId = "npc_property";
    state.businesses[npcBusinessId].townId = "harthmere_grove";
    state.businesses[npcBusinessId].status = "open";
    result = mutate(state, "run_npc_competition_tick", { regionId: "harthmere_grove_region" });
    assert.deepStrictEqual(result.warnings, []);
    assert.ok(result.economy.regions.harthmere_grove_region.itemSupply.delivery > 0);
  });
});

describe("live_mode_backend_v1 — production economy integration", () => {
  it("persists economy mutations through request_economy_mutation and returns a client snapshot", () => {
    const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    state.inventory.gold = 1000;
    const beforeBusinessIds = new Set(
      Object.keys(state.economy.production.businesses)
    );
    const reduced = reduceHarthmereLiveModeBackendStateV1(
      state,
      env("request_economy_mutation", ACTOR, {
        operation: "register_business",
        businessType: "courier",
        name: "Fast Grove Courier",
      }),
      NOW_MS,
    );
    assert.deepStrictEqual(reduced.summary.warnings, []);
    assert.ok(reduced.summary.touchedModels.includes("economy_production_state"));
    assert.strictEqual(reduced.state.inventory.gold, 850);
    const newBusinessIds = Object.keys(
      reduced.state.economy.production.businesses
    ).filter((id) => !beforeBusinessIds.has(id));
    assert.strictEqual(newBusinessIds.length, 1);
    assert.strictEqual(
      reduced.state.economy.production.businesses[newBusinessIds[0]]
        .ownerId,
      ACTOR
    );
    const snapshot = createHarthmereProductionEconomyClientSnapshotFromBackendV1(reduced.state) as any;
    assert.strictEqual(snapshot.myBusinesses.length, 1);
    assert.strictEqual(snapshot.businessTypes.courier.startCostGold, 150);
  });

  it("builds production economy snapshots when Redis contains a legacy outpost record", () => {
    const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    const legacyRecord = JSON.parse(JSON.stringify(
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1.outpost_restaurant_redpot
    ));
    legacyRecord.outpostId = "legacy_redpot_without_validation_arrays";
    legacyRecord.buildingId = "legacy_redpot_without_validation_arrays";
    delete legacyRecord.buildingStyleKit.styleNotes;
    delete legacyRecord.interiorFixtures;
    delete legacyRecord.materializationPlan.edits;
    (state.economy.production.businessSystems as any).outpostBuildings[
      legacyRecord.outpostId
    ] = legacyRecord;

    const snapshot = createHarthmereProductionEconomyClientSnapshotFromBackendV1(
      state
    ) as any;
    assert.ok(snapshot.balanceWarnings.some((warning: string) =>
      warning.includes("legacy_redpot_without_validation_arrays") &&
      warning.includes("outpost_style_kit_missing_style_notes")
    ));
  });

  it("replaces stale persisted business outpost records with the canonical backend voxel plans", () => {
    const canonical = HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1.outpost_restaurant_redpot;
    const staleRecord = JSON.parse(JSON.stringify(canonical));
    staleRecord.blueprint.footprint.width = 8;
    staleRecord.blueprint.footprint.depth = 8;
    staleRecord.interiorFixtures = [];
    staleRecord.materializationPlan.edits = [];
    staleRecord.materializationPlan.inWorldMarkers = [];
    const normalized = normalizeHarthmereEconomyBusinessSystemsStateV1({
      outpostBuildings: {
        [canonical.outpostId]: staleRecord,
      },
    });
    const restored = normalized.outpostBuildings[canonical.outpostId];
    assert.equal(restored.blueprint.footprint.width, canonical.blueprint.footprint.width);
    assert.equal(restored.blueprint.footprint.depth, canonical.blueprint.footprint.depth);
    assert.equal(restored.materializationPlan.edits.length, canonical.materializationPlan.edits.length);
    assert.ok(restored.materializationPlan.inWorldMarkers?.some((marker) => marker.markerId === `${canonical.outpostId}:customer-dashboard`));
    assert.ok(restored.materializationPlan.edits.some((edit) => edit.label === "business_marker"));
  });

  it("moves real player inventory into business storage through the live reducer", () => {
    let state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
    state.inventory.gold = 5000;
    state.inventory.items.worker_meal = 5;
    let reduced = reduceHarthmereLiveModeBackendStateV1(
      state,
      env("request_economy_mutation", ACTOR, {
        operation: "register_business",
        businessType: "food_service_restaurant",
        name: "Live Meal Shop",
      }),
      NOW_MS,
    );
    state = reduced.state;
    const business = Object.values(state.economy.production.businesses).find(
      (entry) =>
        entry.ownerKind === "player" &&
        entry.ownerId === ACTOR &&
        entry.name === "Live Meal Shop"
    );
    assert.ok(business, "expected the live reducer to create a player business");
    const businessId = business.businessId;
    state.building.inWorldMarkers[`${businessId}:marker`] = {
      markerId: `${businessId}:marker`,
      plotId: `plot_${businessId}`,
      kind: "business_marker",
      position: [100, 65, 100],
      label: "Live Meal Shop",
      createdAtMs: NOW_MS,
    };
    reduced = reduceHarthmereLiveModeBackendStateV1(
      state,
      env("request_economy_mutation", ACTOR, {
        operation: "deposit_business_inventory",
        businessId,
        itemId: "worker_meal",
        count: 2,
      }, {
        serverActorPosition: { x: 100, y: 65, z: 100 },
      }),
      NOW_MS + 1,
    );
    assert.deepStrictEqual(reduced.summary.warnings, []);
    assert.strictEqual(reduced.state.inventory.items.worker_meal, 3);
    assert.strictEqual(reduced.state.economy.production.businesses[businessId].inventory.worker_meal.count, 2);
  });
});

describe("mmo_economy_authority_v1 — business-specific production systems", () => {
  function createOpenBusiness(
    type: HarthmereEconomyMutationRequestV1["businessType"],
    name: string,
    licenseLevel = 1,
  ) {
    const setup = createBusiness(defaultHarthmereProductionEconomyStateV1(), type, name);
    const state = licenseAndOpen(setup.state, setup.businessId, licenseLevel);
    return { state, businessId: setup.businessId };
  }

  it("runs Exotic Matter refinery stabilization, certification, and containment failure hooks", () => {
    const setup = createOpenBusiness("exotic_matter_refinery", "Grove Refinery", 2);
    let state = setup.state;
    Object.assign(state.businesses[setup.businessId].inventory, {
      raw_exotic_matter: { itemId: "raw_exotic_matter", count: 2 },
      stabilizing_crystal: { itemId: "stabilizing_crystal", count: 1 },
      coolant: { itemId: "coolant", count: 1 },
      containment_filter: { itemId: "containment_filter", count: 1 },
    });
    let result = mutate(state, "run_exotic_refinery_cycle", { businessId: setup.businessId, containmentRating: 85 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.strictEqual(state.businesses[setup.businessId].inventory.stabilized_exotic_matter.count, 1);
    assert.strictEqual(state.businesses[setup.businessId].inventory.portal_fuel.count, 1);

    result = mutate(state, "certify_portal_fuel", { businessId: setup.businessId, count: 1 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.strictEqual(state.businesses[setup.businessId].inventory.certified_portal_fuel.count, 1);

    Object.assign(state.businesses[setup.businessId].inventory, {
      raw_exotic_matter: { itemId: "raw_exotic_matter", count: 2 },
      stabilizing_crystal: { itemId: "stabilizing_crystal", count: 1 },
      coolant: { itemId: "coolant", count: 1 },
      containment_filter: { itemId: "containment_filter", count: 1 },
    });
    result = mutate(state, "run_exotic_refinery_cycle", { businessId: setup.businessId, containmentRating: 20 });
    assert.ok(result.warnings.includes("economy_warning:containment_failure_created_contamination"));
    assert.strictEqual(Object.keys((result.economy as any).businessSystems.contaminationSites).length, 1);
  });

  it("decays real Biome anchors and lets maintenance companies repair weather failure and anchor drift", () => {
    const dev = createOpenBusiness("custom_home_property_development", "Grove Builders", 1);
    let state = dev.state;
    state.businesses[dev.businessId].inventory = {
      wood_plank: { itemId: "wood_plank", count: 10 },
      stone_block: { itemId: "stone_block", count: 10 },
      iron_ingot: { itemId: "iron_ingot", count: 5 },
      utility_core: { itemId: "utility_core", count: 1 },
    };
    let result = mutate(state, "start_property_project", { businessId: dev.businessId, propertyId: "home_1", buildingType: "house" });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    result = mutate(state, "advance_property_project", { businessId: dev.businessId, propertyId: "home_1", progress: 100 });
    state = result.economy;

    result = mutate(state, "run_biome_decay_tick", { days: 25 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    const anchorId = Object.keys((state as any).businessSystems.biomeAnchors)[0];
    assert.ok((state as any).businessSystems.biomeAnchors[anchorId].weatherFailure);

    const maint = createBusiness(state, "biome_maintenance_repair", "Anchor Fixers");
    state = licenseAndOpen(maint.state, maint.businessId, 1);
    state.businesses[maint.businessId].inventory = {
      repair_kit: { itemId: "repair_kit", count: 1 },
      stabilized_exotic_matter: { itemId: "stabilized_exotic_matter", count: 1 },
    };
    result = mutate(state, "perform_biome_maintenance", { businessId: maint.businessId, propertyId: "home_1", amountGold: 100 });
    assert.deepStrictEqual(result.warnings, []);
    assert.ok((result.economy as any).businessSystems.biomeAnchors[anchorId].condition >= 60);
  });

  it("connects design studios and property developers to real property value, beauty, staged construction, and housing needs", () => {
    const dev = createOpenBusiness("custom_home_property_development", "Stone & Sky", 1);
    let state = dev.state;
    state.businesses[dev.businessId].inventory = {
      wood_plank: { itemId: "wood_plank", count: 12 },
      stone_block: { itemId: "stone_block", count: 12 },
      iron_ingot: { itemId: "iron_ingot", count: 2 },
      utility_core: { itemId: "utility_core", count: 1 },
    };
    let result = mutate(state, "start_property_project", { businessId: dev.businessId, propertyId: "shop_1", propertyValueGold: 1000 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    result = mutate(state, "advance_property_project", { businessId: dev.businessId, propertyId: "shop_1", progress: 100 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.strictEqual((state as any).businessSystems.propertyIntegrations.shop_1.constructionComplete, true);

    const studio = createBusiness(state, "biome_design_studio", "Vivid Rooms");
    state = licenseAndOpen(studio.state, studio.businessId, 1);
    state.businesses[studio.businessId].inventory = {
      decor_pack: { itemId: "decor_pack", count: 1 },
      lighting_system: { itemId: "lighting_system", count: 1 },
      terrain_template: { itemId: "terrain_template", count: 1 },
    };
    result = mutate(state, "install_biome_design", { businessId: studio.businessId, propertyId: "shop_1", amountGold: 400 });
    assert.deepStrictEqual(result.warnings, []);
    assert.ok((result.economy as any).businessSystems.propertyIntegrations.shop_1.beauty > 50);
    assert.ok((result.economy as any).businessSystems.propertyIntegrations.shop_1.valueGold > 1000);
  });

  it("enforces property development edge cases before rent, duplicate projects, or invalid progress can leak through", () => {
    const setup = createBusiness(defaultHarthmereProductionEconomyStateV1(), "custom_home_property_development", "Permit Lock Builders");
    let state = setup.state;
    state.businesses[setup.businessId].inventory = {
      wood_plank: { itemId: "wood_plank", count: 20 },
      stone_block: { itemId: "stone_block", count: 20 },
      iron_ingot: { itemId: "iron_ingot", count: 6 },
      utility_core: { itemId: "utility_core", count: 2 },
    };

    let result = mutate(state, "start_property_project", { businessId: setup.businessId, propertyId: "draft_home" });
    assert.ok(result.warnings.includes("economy_rejected:business_not_open"));

    state = licenseAndOpen(state, setup.businessId, 1);
    state.businesses[setup.businessId].inventory = {
      wood_plank: { itemId: "wood_plank", count: 20 },
      stone_block: { itemId: "stone_block", count: 20 },
      iron_ingot: { itemId: "iron_ingot", count: 6 },
      utility_core: { itemId: "utility_core", count: 2 },
    };
    state.businesses[setup.businessId].balanceGold = 100;
    result = mutate(state, "start_property_project", {
      businessId: setup.businessId,
      propertyId: "edge_home",
      rentGoldPerDay: 40,
    });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.ok((state as any).businessSystems.propertyIntegrations.edge_home.permits.includes("tax_account"));

    result = mutate(state, "run_business_rent_tick", { days: 2 });
    assert.ok(result.warnings.includes("economy_warning:no_business_rent_due"));
    assert.strictEqual(result.economy.businesses[setup.businessId].balanceGold, 100);
    state = result.economy;

    result = mutate(state, "start_property_project", { businessId: setup.businessId, propertyId: "edge_home" });
    assert.ok(result.warnings.includes("economy_rejected:property_project_already_active"));

    result = mutate(state, "advance_property_project", {
      businessId: setup.businessId,
      propertyId: "edge_home",
      progress: 0,
    });
    assert.ok(result.warnings.includes("economy_rejected:invalid_property_project_progress"));

    result = mutate(state, "advance_property_project", {
      businessId: setup.businessId,
      propertyId: "edge_home",
      progress: 100,
    });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.strictEqual((state as any).businessSystems.propertyIntegrations.edge_home.constructionComplete, true);

    state.businesses[setup.businessId].balanceGold = 50;
    result = mutate(state, "run_business_rent_tick", { days: 2 });
    assert.ok(result.warnings.includes("economy_warning:business_suspended_for_unpaid_rent"));
    assert.strictEqual(result.economy.businesses[setup.businessId].status, "suspended");
  });

  it("ties security contractors to real world threats and rejects resolution without combat gear", () => {
    const sec = createOpenBusiness("security_defense_contractor", "Lantern Watch", 1);
    let state = sec.state;
    let result = mutate(state, "create_security_threat", { townId: "harthmere_grove", threatKind: "viking_raiders", severity: 4, rewardGold: 250 }, ctx({ allowNpcAdministration: true }));
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    const threatId = Object.keys((state as any).businessSystems.threats)[0];
    result = mutate(state, "resolve_security_threat", { businessId: sec.businessId, threatId });
    assert.ok(result.warnings.includes("economy_rejected:security_contract_requires_gear"));

    state.businesses[sec.businessId].inventory = { iron_sword: { itemId: "iron_sword", count: 1 } };
    result = mutate(state, "resolve_security_threat", { businessId: sec.businessId, threatId });
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual((result.economy as any).businessSystems.threats[threatId].status, "contained");
    assert.ok(result.economy.businesses[sec.businessId].balanceGold >= 250);
  });

  it("runs portal and teleport ownership with real endpoints, access keys, fuel, fares, and destabilization", () => {
    const portal = createOpenBusiness("portal_transit_company", "Grove Gates", 3);
    let state = portal.state;
    state.businesses[portal.businessId].inventory = {
      anchor_core: { itemId: "anchor_core", count: 1 },
      destination_crystal: { itemId: "destination_crystal", count: 1 },
      certified_portal_fuel: { itemId: "certified_portal_fuel", count: 2 },
    };
    let result = mutate(state, "build_portal_endpoint", { businessId: portal.businessId, originTownId: "harthmere_grove", destinationTownId: "market" });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    const endpointId = Object.keys((state as any).businessSystems.portalEndpoints)[0];
    result = mutate(state, "run_portal_transit", { businessId: portal.businessId, endpointId, passengers: 3, cargoUnits: 1, passengerFeeGold: 10, cargoFeeGold: 6 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.strictEqual((state as any).businessSystems.portalEndpoints[endpointId].fuelUnits, 1);

    const tele = createBusiness(state, "teleport_owner", "Blink Pad");
    state = licenseAndOpen(tele.state, tele.businessId, 2);
    state.businesses[tele.businessId].inventory = {
      teleport_fuel: { itemId: "teleport_fuel", count: 2 },
      destination_crystal: { itemId: "destination_crystal", count: 1 },
      pad_part: { itemId: "pad_part", count: 2 },
    };
    result = mutate(state, "build_teleport_pad", { businessId: tele.businessId, locationId: "grove", destinationId: "clinic" });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    const padId = Object.keys((state as any).businessSystems.teleportPads)[0];
    result = mutate(state, "use_teleport_pad", { padId, amountGold: 12 });
    assert.ok(result.warnings.includes("economy_rejected:teleport_access_key_required"));
    result = mutate(state, "issue_teleport_access_key", { businessId: tele.businessId, padId, targetActorId: ACTOR });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    result = mutate(state, "use_teleport_pad", { padId, amountGold: 12 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    result = mutate(state, "run_teleport_destabilization_tick", { days: 2 });
    assert.deepStrictEqual(result.warnings, []);
    assert.ok((result.economy as any).businessSystems.teleportPads[padId].stability < 95);
  });

  it("runs farming growth, climate mismatch penalties, harvests, and spoilage", () => {
    const farm = createOpenBusiness("biome_farming_rare_foods", "Rare Rows", 1);
    let state = farm.state;
    state.businesses[farm.businessId].inventory = {
      rare_seed: { itemId: "rare_seed", count: 1 },
      clean_water: { itemId: "clean_water", count: 1 },
      fertilizer: { itemId: "fertilizer", count: 1 },
    };
    let result = mutate(state, "plant_crop_node", { businessId: farm.businessId, cropItemId: "sunberry", climate: "desert" });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    const cropId = Object.keys((state as any).businessSystems.cropNodes)[0];
    result = mutate(state, "run_crop_growth_tick", { days: 3, climate: "desert" });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.strictEqual((state as any).businessSystems.cropNodes[cropId].growth, 100);
    result = mutate(state, "harvest_crop_node", { businessId: farm.businessId, cropId });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.ok(state.businesses[farm.businessId].inventory.sunberry.count > 0);
    result = mutate(state, "run_spoilage_tick", { nowMs: NOW_MS + 10 * 24 * 60 * 60 * 1000 } as any);
    assert.deepStrictEqual(result.warnings, []);
    assert.ok(result.economy.businesses[farm.businessId].inventory.spoiled_food_waste.count > 0);
  });

  it("runs tools, magic goods, exploration, hunting, medicine, sanitation, repair, restaurant, courier, and hospitality systems", function () {
    this.timeout(60000);
    let state = defaultHarthmereProductionEconomyStateV1();

    let tools = createBusiness(state, "weapons_tools", "Forge One");
    state = licenseAndOpen(tools.state, tools.businessId, 2);
    state.businesses[tools.businessId].inventory = {
      repair_tool: { itemId: "repair_tool", count: 1 },
      iron_ingot: { itemId: "iron_ingot", count: 5 },
      upgrade_crystal: { itemId: "upgrade_crystal", count: 1 },
    };
    let result = mutate(state, "register_durable_item", { itemId: "iron_sword", condition: 30, quality: 1, restricted: true });
    state = result.economy;
    const durableItemId = Object.keys((state as any).businessSystems.durableItems)[0];
    result = mutate(state, "repair_durable_item", { businessId: tools.businessId, durableItemId });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    result = mutate(state, "upgrade_durable_item", { businessId: tools.businessId, durableItemId });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.strictEqual((state as any).businessSystems.durableItems[durableItemId].upgraded, true);

    let magic = createBusiness(state, "magic_goods", "Wardworks");
    state = licenseAndOpen(magic.state, magic.businessId, 2);
    state.businesses[magic.businessId].inventory = {
      stabilized_exotic_matter: { itemId: "stabilized_exotic_matter", count: 1 },
      herb_bundle: { itemId: "herb_bundle", count: 1 },
      relic_fragment: { itemId: "relic_fragment", count: 1 },
      anomaly_reagent: { itemId: "anomaly_reagent", count: 1 },
    };
    result = mutate(state, "link_business_property", { businessId: magic.businessId, propertyId: "ward_property" });
    state = result.economy;
    result = mutate(state, "craft_magic_good", { businessId: magic.businessId, itemId: "protective_ward_charm" });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    result = mutate(state, "install_ward", { businessId: magic.businessId, propertyId: "ward_property" });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    result = mutate(state, "accumulate_waste", { townId: "harthmere_grove", severity: 3, kind: "anomaly" }, ctx({ allowNpcAdministration: true }));
    state = result.economy;
    const anomalySiteId = Object.keys((state as any).businessSystems.contaminationSites)[0];
    result = mutate(state, "remove_anomaly", { businessId: magic.businessId, siteId: anomalySiteId });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;

    let guide = createBusiness(state, "exploration_guide", "Map Light");
    state = licenseAndOpen(guide.state, guide.businessId, 1);
    state.businesses[guide.businessId].inventory = {
      field_kit: { itemId: "field_kit", count: 1 },
      ration_pack: { itemId: "ration_pack", count: 1 },
    };
    result = mutate(state, "discover_exploration_route", { businessId: guide.businessId, destinationId: "dino_ruins", safetyRating: 80 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    const routeId = Object.keys((state as any).businessSystems.explorationRoutes)[0];
    result = mutate(state, "lead_expedition", { businessId: guide.businessId, routeId, difficulty: 120, rewardGold: 100 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    result = mutate(state, "run_map_aging_tick", { days: 10 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    result = mutate(state, "lead_expedition", { businessId: guide.businessId, routeId, difficulty: 120, rewardGold: 100 });
    assert.ok(result.warnings.includes("economy_rejected:map_too_stale_for_expedition"));

    let hunter = createBusiness(state, "hunter_wild_meat", "Wild Cuts");
    state = licenseAndOpen(hunter.state, hunter.businessId, 1);
    result = mutate(state, "hunt_wildlife", { businessId: hunter.businessId, populationId: "muckernut_pop", species: "muckernut", populationCount: 20, count: 4 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.strictEqual(state.businesses[hunter.businessId].inventory.wild_meat.count, 8);

    let medical = createBusiness(state, "medical_doctor", "Grove Clinic");
    state = licenseAndOpen(medical.state, medical.businessId, 2);
    state.businesses[medical.businessId].inventory = {
      field_medkit: { itemId: "field_medkit", count: 1 },
      medicine: { itemId: "medicine", count: 1 },
    };
    result = mutate(state, "register_patient", { conditionKind: "time_sickness", severity: 3 }, ctx({ allowNpcAdministration: true }));
    state = result.economy;
    const patientId = Object.keys((state as any).businessSystems.patients)[0];
    result = mutate(state, "treat_patient", { businessId: medical.businessId, patientId, treatmentSkill: 3 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.strictEqual((state as any).businessSystems.patients[patientId].status, "treated");

    let sanitation = createBusiness(state, "waste_sanitation_cleanup", "Clean Grove");
    state = licenseAndOpen(sanitation.state, sanitation.businessId, 1);
    state.businesses[sanitation.businessId].inventory = {
      cleaning_reagent: { itemId: "cleaning_reagent", count: 1 },
      containment_barrel: { itemId: "containment_barrel", count: 1 },
    };
    result = mutate(state, "accumulate_waste", { townId: "harthmere_grove", severity: 4 }, ctx({ allowNpcAdministration: true }));
    state = result.economy;
    const wasteSiteId = Object.keys((state as any).businessSystems.contaminationSites).find((id) => (state as any).businessSystems.contaminationSites[id].status === "active")!;
    result = mutate(state, "cleanup_contamination_site", { businessId: sanitation.businessId, siteId: wasteSiteId });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;

    let repair = createBusiness(state, "repair_maintenance_person", "Fix It Fast");
    state = licenseAndOpen(repair.state, repair.businessId, 1);
    state.businesses[repair.businessId].inventory = {
      nails: { itemId: "nails", count: 1 },
      metal_part: { itemId: "metal_part", count: 1 },
      repair_tool: { itemId: "repair_tool", count: 1 },
    };
    result = mutate(state, "link_business_property", { businessId: repair.businessId, propertyId: "fix_property", propertyCondition: 25 });
    state = result.economy;
    result = mutate(state, "repair_fixture", { businessId: repair.businessId, propertyId: "fix_property" });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.ok((state as any).businessSystems.propertyIntegrations.fix_property.condition > 25);

    let restaurant = createBusiness(state, "food_service_restaurant", "Meal House");
    state = licenseAndOpen(restaurant.state, restaurant.businessId, 1);
    state.businesses[restaurant.businessId].inventory = { worker_meal: { itemId: "worker_meal", count: 3 } };
    result = mutate(state, "set_restaurant_menu", { businessId: restaurant.businessId, menuItems: ["worker_meal"] });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    result = mutate(state, "serve_restaurant_day", { businessId: restaurant.businessId, unitPriceGold: 9, sanitationRating: 80 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;

    let courier = createBusiness(state, "courier", "Fleetfoot");
    state = licenseAndOpen(courier.state, courier.businessId, 1);
    state.businesses[courier.businessId].inventory = { medicine: { itemId: "medicine", count: 1 } };
    result = mutate(state, "create_delivery", { businessId: courier.businessId, itemId: "medicine", count: 1, rewardGold: 30, deadlineAtMs: NOW_MS + 1000 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    const deliveryId = Object.keys((state as any).businessSystems.deliveries)[0];
    result = mutate(state, "complete_delivery", { businessId: courier.businessId, deliveryId });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.strictEqual((state as any).businessSystems.deliveries[deliveryId].status, "delivered");

    let hotel = createBusiness(state, "hospitality_inn_hotel_shelter", "Safe Beds");
    state = licenseAndOpen(hotel.state, hotel.businessId, 1);
    state.businesses[hotel.businessId].inventory = {
      worker_meal: { itemId: "worker_meal", count: 4 },
      linen: { itemId: "linen", count: 1 },
      cleaning_reagent: { itemId: "cleaning_reagent", count: 1 },
    };
    result = mutate(state, "create_hospitality_state", { businessId: hotel.businessId, rooms: 4, shelterBeds: 2, cleanliness: 80, safetyRating: 80 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    result = mutate(state, "run_hospitality_day", { businessId: hotel.businessId, guestDemand: 4, roomRateGold: 20 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    result = mutate(state, "clean_hospitality_rooms", { businessId: hotel.businessId });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    result = mutate(state, "create_shelter_contract", { businessId: hotel.businessId, rewardGold: 80 });
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual((Object.values((result.economy as any).businessSystems.hospitality)[0] as any).refugeeContractActive, true);
  });
});

describe("mmo_economy_authority_v1 — business banks, permissions, and balance guards", () => {
  it("creates business bank accounts, supports owner transfers, audit logs, and permission-scoped accountants", () => {
    const setup = createBusiness(defaultHarthmereProductionEconomyStateV1(), "general_trader", "Ledger Market");
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    let result = mutate(state, "create_business_bank_account", { businessId: setup.businessId });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    const accountId = Object.keys((state as any).businessSystems.bankAccounts)[0];
    result = mutate(state, "transfer_personal_to_business_bank", { businessId: setup.businessId, amountGold: 500 }, ctx({ actorGold: 200 }));
    assert.ok(result.warnings.includes("economy_rejected:insufficient_personal_gold_for_transfer"));
    result = mutate(state, "transfer_personal_to_business_bank", { businessId: setup.businessId, amountGold: 500 }, ctx({ actorGold: 1000 }));
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual(result.inventoryGoldDelta, -500);
    state = result.economy;
    assert.strictEqual((state as any).businessSystems.bankAccounts[accountId].balanceGold, 500);

    result = mutate(state, "grant_business_permission", { businessId: setup.businessId, targetActorId: "accountant_1", permission: "accountant" });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    result = mutate(state, "grant_business_permission", {
      businessId: setup.businessId,
      targetActorId: "ops_1",
      permissions: ["inventory_manager", "price_manager"],
    } as any);
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.deepStrictEqual(
      (state as any).businessSystems.permissions[setup.businessId].ops_1,
      ["inventory_manager", "price_manager"]
    );
    result = reduceHarthmereEconomyMutationV1(state, req("transfer_business_to_personal_bank", { businessId: setup.businessId, amountGold: 100, actorId: "accountant_1" } as any), ctx({ actorGold: 0, businessPermissions: { [`${setup.businessId}:accountant_1`]: ["accountant"] } as any }) as any);
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual(result.inventoryGoldDelta, 100);
    assert.ok((result.economy as any).businessSystems.bankAccounts[accountId].audit.length >= 3);
  });

  it("lets the owner withdraw EARNED revenue (not just prior deposits) to personal gold", () => {
    // Regression for the trapped-revenue P0: revenue from sales accrues to
    // business.balanceGold but the bank account stays at 0, so withdrawal used
    // to reject with business_bank_funds_insufficient even though the business
    // was flush.
    const setup = createBusiness(defaultHarthmereProductionEconomyStateV1(), "food_service_restaurant", "Grove Hearth");
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    state.businesses[setup.businessId].inventory.worker_meal = { itemId: "worker_meal", count: 5 };
    state.regions.harthmere_grove_region.itemDemand.worker_meal = 100;
    state.regions.harthmere_grove_region.itemSupply.worker_meal = 10;
    state = mutate(state, "create_business_bank_account", { businessId: setup.businessId }).economy;
    const accountId = Object.keys((state as any).businessSystems.bankAccounts)[0];

    // Earn revenue from a real customer sale (credits balanceGold, NOT the bank account).
    const price = economyPriceForItemV1({
      state,
      regionId: "harthmere_grove_region",
      townId: "harthmere_grove",
      itemId: "worker_meal",
      business: state.businesses[setup.businessId],
    });
    state = mutate(state, "record_customer_sale", {
      actorId: "customer_1",
      businessId: setup.businessId,
      itemId: "worker_meal",
      count: 2,
      serviceNeed: "food",
    }, ctx({ actorGold: price * 2 })).economy;

    const earned = state.businesses[setup.businessId].balanceGold;
    assert.ok(earned > 0, "business should have earned revenue");
    assert.strictEqual((state as any).businessSystems.bankAccounts[accountId].balanceGold, 0, "bank account holds no deposits");

    // The owner can now withdraw earned revenue straight to personal gold.
    const withdraw = Math.min(earned, 50);
    const result = mutate(state, "transfer_business_to_personal_bank", { businessId: setup.businessId, amountGold: withdraw }, ctx({ actorGold: 0 }));
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual(result.inventoryGoldDelta, withdraw);
    assert.strictEqual(result.economy.businesses[setup.businessId].balanceGold, earned - withdraw);
  });

  it("supports guild and town business operation permissions without giving every actor full ownership", () => {
    let state = defaultHarthmereProductionEconomyStateV1();
    let result = mutate(state, "register_business", {
      businessType: "general_trader",
      name: "Guild Quartermaster",
      ownerKind: "guild",
      ownerId: "guild_econ",
    }, ctx({ canManageGuildBusiness: (guildId) => guildId === "guild_econ" }));
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    const businessId = Object.keys(state.businesses)[0];
    result = mutate(state, "issue_license", { businessId, licenseLevel: 1 }, ctx({ canManageGuildBusiness: (guildId) => guildId === "guild_econ" }));
    assert.deepStrictEqual(result.warnings, []);
    result = mutate(result.economy, "open_business", { businessId, propertyId: `property_${businessId}`, townId: "harthmere_grove" }, ctx({ canManageGuildBusiness: (guildId) => guildId === "guild_econ" }));
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    result = reduceHarthmereEconomyMutationV1(state, req("refresh_trader_inventory", { businessId, amountGold: 50, actorId: "guild_worker" } as any), ctx({ actorGold: 0 }) as any);
    assert.ok(result.warnings.includes("economy_rejected:business_permission_required:inventory_manager"));
    state.businesses[businessId].balanceGold = 100;
    result = reduceHarthmereEconomyMutationV1(state, req("refresh_trader_inventory", { businessId, amountGold: 50, actorId: "guild_worker" } as any), ctx({ actorGold: 0, actorGuildPermissions: { guild_econ: ["inventory_manager"] } as any }) as any);
    assert.deepStrictEqual(result.warnings, []);

    state = result.economy;
    result = mutate(state, "register_business", {
      businessType: "waste_sanitation_cleanup",
      name: "Town Sanitation",
      ownerKind: "town",
      ownerId: "harthmere_grove",
    }, ctx({ canManageTownBusiness: (townId) => townId === "harthmere_grove" }));
    assert.deepStrictEqual(result.warnings, []);
    const townBusinessId = Object.keys(result.economy.businesses).find((id) => id !== businessId)!;
    result = mutate(result.economy, "issue_license", { businessId: townBusinessId, licenseLevel: 1 }, ctx({ canManageTownBusiness: (townId) => townId === "harthmere_grove" }));
    assert.deepStrictEqual(result.warnings, []);
    result = mutate(result.economy, "open_business", { businessId: townBusinessId, propertyId: `property_${townBusinessId}`, townId: "harthmere_grove" }, ctx({ canManageTownBusiness: (townId) => townId === "harthmere_grove" }));
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    state.businesses[townBusinessId].inventory = {
      cleaning_reagent: { itemId: "cleaning_reagent", count: 1 },
      containment_barrel: { itemId: "containment_barrel", count: 1 },
    };
    result = mutate(state, "accumulate_waste", { townId: "harthmere_grove", severity: 2 }, ctx({ allowNpcAdministration: true }));
    state = result.economy;
    const siteId = Object.keys((state as any).businessSystems.contaminationSites)[0];
    result = reduceHarthmereEconomyMutationV1(state, req("cleanup_contamination_site", { businessId: townBusinessId, siteId, actorId: "town_worker" } as any), ctx({ actorGold: 0, actorTownPermissions: { harthmere_grove: ["world_operator"] } as any }) as any);
    assert.deepStrictEqual(result.warnings, []);
  });

  it("handles rent, loan defaults, collateral seizure, bankruptcy liquidation, and balance sanity warnings", () => {
    const setup = createBusiness(defaultHarthmereProductionEconomyStateV1(), "general_trader", "Risky Books");
    let state = licenseAndOpen(setup.state, setup.businessId, 1);
    state.businesses[setup.businessId].balanceGold = 50;
    let result = mutate(state, "link_business_property", { businessId: setup.businessId, propertyId: "rental_shop", rentGoldPerDay: 40 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    result = mutate(state, "run_business_rent_tick", { days: 2 });
    assert.ok(result.warnings.includes("economy_warning:business_suspended_for_unpaid_rent"));
    state = result.economy;

    result = mutate(state, "take_business_loan", { businessId: setup.businessId, principalGold: 1000, dailyInterestRate: 0.02, dueAtMs: NOW_MS + 1000 });
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    const loanId = Object.keys(state.loans)[0];
    (state as any).businessSystems.propertyIntegrations.rental_shop.collateralLoanId = loanId;
    result = mutate(state, "run_loan_default_tick", { nowMs: NOW_MS + 10_000 } as any);
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.strictEqual((state.loans as any)[loanId].status, "defaulted");
    result = mutate(state, "seize_loan_collateral", { loanId }, ctx({ allowNpcAdministration: true }));
    assert.deepStrictEqual(result.warnings, []);
    state = result.economy;
    assert.strictEqual((state as any).businessSystems.propertyIntegrations.rental_shop.ownerKind, "town");

    state.businesses[setup.businessId].inventory = { strange_duplication_item: { itemId: "strange_duplication_item", count: 200000 } };
    state.businesses[setup.businessId].salesTaxRate = 0.5;
    result = mutate(state, "validate_economy_balance", { businessId: setup.businessId });
    assert.ok(result.warnings.some((warning) => warning.includes("balance:tax_rate_too_high")));
    assert.ok(result.warnings.some((warning) => warning.includes("balance:inventory_duplication_risk")));

    state = result.economy;
    state.businesses[setup.businessId].status = "bankrupt";
    result = mutate(state, "liquidate_bankrupt_business", { businessId: setup.businessId });
    assert.deepStrictEqual(result.warnings, []);
    assert.strictEqual(result.economy.businesses[setup.businessId].status, "closed");
  });
});
