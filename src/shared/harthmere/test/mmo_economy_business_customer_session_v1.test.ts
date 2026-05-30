/// <reference types="mocha" />

import assert from "assert";
import {
  defaultHarthmereProductionEconomyStateV1,
  reduceHarthmereEconomyMutationV1,
  type HarthmereEconomyMutationContextV1,
  type HarthmereEconomyMutationRequestV1,
  type HarthmereEconomyBusinessTypeIdV1,
  type HarthmereProductionEconomyStateV1,
} from "../mmo_economy_authority_v1";
import {
  validateHarthmereBusinessOutpostLiveWorldNavigationV1,
  type HarthmereBusinessCustomerSessionV1,
} from "../business_customer_simulator_v1";

const ACTOR = "business_customer_owner";
const NOW_MS = 1_800_000_000_000;

function ctx(overrides: Partial<HarthmereEconomyMutationContextV1> = {}): HarthmereEconomyMutationContextV1 {
  return {
    actorGold: 50_000,
    actorInventoryItems: {},
    allowNpcAdministration: false,
    ...overrides,
  };
}

function req(operation: string, payload: Partial<HarthmereEconomyMutationRequestV1> = {}): HarthmereEconomyMutationRequestV1 {
  return {
    requestId: `business-customer-${operation}-${Math.random()}`,
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

function createOpenBusiness(typeId: HarthmereEconomyBusinessTypeIdV1 = "food_service_restaurant") {
  let state = defaultHarthmereProductionEconomyStateV1();
  let result = mutate(state, "register_business", { businessType: typeId, name: `${typeId} Test Shop` });
  assert.deepEqual(result.warnings, []);
  state = result.economy;
  const businessId = Object.keys(state.businesses)[0];
  const minLicense = typeId === "exotic_matter_refinery" || typeId === "portal_transit_company" ? 3 : typeId === "medical_doctor" || typeId === "magic_goods" || typeId === "teleport_owner" ? 2 : 1;
  result = mutate(state, "issue_license", { businessId, licenseLevel: minLicense });
  assert.deepEqual(result.warnings, []);
  state = result.economy;
  result = mutate(state, "open_business", { businessId, propertyId: `property_${businessId}`, townId: "harthmere_grove" });
  assert.deepEqual(result.warnings, []);
  return { state: result.economy, businessId };
}

function sessions(state: HarthmereProductionEconomyStateV1) {
  return Object.values((state.businessSystems as any).customerSessions ?? {}) as HarthmereBusinessCustomerSessionV1[];
}

describe("mmo economy business customer sessions", () => {
  it("starts an owner-run customer shift with queued customer-only NPC tickets", () => {
    const setup = createOpenBusiness();
    const result = mutate(setup.state, "start_business_customer_session", { businessId: setup.businessId, count: 4 });
    assert.deepEqual(result.warnings, []);
    const session = sessions(result.economy)[0];
    assert.equal(session.businessId, setup.businessId);
    assert.equal(session.typeId, "food_service_restaurant");
    assert.equal(session.queue.length, 4);
    assert.equal(session.status, "active");
    assert.ok(session.currentTicketId);
    assert.ok(session.dailyBonusGold > 0);

    const duplicate = mutate(result.economy, "start_business_customer_session", { businessId: setup.businessId });
    assert.ok(duplicate.warnings.includes("economy_rejected:business_customer_session_already_active"));
  });

  it("serves a matching customer ask, consumes stock, rewards the business, and records stats", () => {
    const setup = createOpenBusiness();
    setup.state.businesses[setup.businessId].inventory.worker_meal = { itemId: "worker_meal", count: 2 };
    let result = mutate(setup.state, "start_business_customer_session", { businessId: setup.businessId, count: 1 });
    const session = sessions(result.economy)[0];
    const beforeGold = result.economy.businesses[setup.businessId].balanceGold;
    result = mutate(result.economy, "serve_business_customer", {
      businessId: setup.businessId,
      sessionId: session.sessionId,
      ticketId: session.currentTicketId,
      offerId: "serve_worker_meal",
    });
    assert.deepEqual(result.warnings, []);
    const business = result.economy.businesses[setup.businessId];
    assert.equal(business.inventory.worker_meal.count, 1);
    assert.ok(business.balanceGold > beforeGold);
    assert.ok(business.reputation > 0);
    const finished = sessions(result.economy)[0];
    assert.equal(finished.status, "completed");
    assert.equal(finished.servedTicketIds.length, 1);
    const stats = (result.economy.businessSystems as any).customerStats[setup.businessId];
    assert.equal(stats.totalServed, 1);
    assert.ok(stats.serviceXp > 0);
    assert.ok(stats.likeability > 0);
    assert.ok(Object.keys(stats.friendshipPointsByNpcId).length > 0);
    assert.ok(stats.thankYouNotes.length > 0);
    assert.ok(finished.notes.some((note) => note.includes("service XP")));
    assert.equal(business.flags.customer_service_shift_completed, true);
  });

  it("rejects missing stock without losing the waiting customer", () => {
    const setup = createOpenBusiness();
    let result = mutate(setup.state, "start_business_customer_session", { businessId: setup.businessId, count: 1 });
    const session = sessions(result.economy)[0];
    result = mutate(result.economy, "serve_business_customer", {
      businessId: setup.businessId,
      sessionId: session.sessionId,
      offerId: "serve_worker_meal",
    });
    assert.ok(result.warnings.includes("economy_rejected:business_item_required:worker_meal"));
    const stillWaiting = sessions(result.economy)[0];
    assert.equal(stillWaiting.queue[0].status, "waiting");
    assert.equal(stillWaiting.servedTicketIds.length, 0);
  });

  it("marks wrong service choices as failed customer interactions", () => {
    const setup = createOpenBusiness();
    let result = mutate(setup.state, "start_business_customer_session", { businessId: setup.businessId, count: 1 });
    const session = sessions(result.economy)[0];
    result = mutate(result.economy, "serve_business_customer", {
      businessId: setup.businessId,
      sessionId: session.sessionId,
      ticketId: session.currentTicketId,
      offerId: "pack_road_ration",
    });
    assert.deepEqual(result.warnings, []);
    const failed = sessions(result.economy)[0];
    assert.equal(failed.status, "completed");
    assert.equal(failed.failedTicketIds.length, 1);
    assert.equal((result.economy.businessSystems as any).customerStats[setup.businessId].totalFailed, 1);
    assert.ok(result.economy.businesses[setup.businessId].customerSatisfaction < 50);
    assert.equal(result.economy.businesses[setup.businessId].flags.customer_service_shift_completed, true);
  });

  it("lets customers leave when real patience time runs out", () => {
    const setup = createOpenBusiness();
    setup.state.businesses[setup.businessId].inventory.worker_meal = { itemId: "worker_meal", count: 2 };
    let result = mutate(setup.state, "start_business_customer_session", { businessId: setup.businessId, count: 1 });
    const session = sessions(result.economy)[0];
    const ticket = session.queue[0];

    result = reduceHarthmereEconomyMutationV1(result.economy, {
      requestId: "business-customer-patience-expired",
      actorId: ACTOR,
      nowMs: NOW_MS + (ticket.patience + 1) * 1000,
      operation: "serve_business_customer",
      businessId: setup.businessId,
      sessionId: session.sessionId,
      ticketId: ticket.ticketId,
      offerId: ticket.requestedOfferId,
    }, ctx());

    assert.ok(result.warnings.includes("economy_rejected:business_customer_left_waiting"));
    const expired = sessions(result.economy)[0];
    assert.equal(expired.status, "completed");
    assert.equal(expired.queue[0].status, "left");
    assert.equal(expired.queue[0].patienceRemaining, 0);
    assert.equal(expired.failedTicketIds.length, 1);
    assert.equal((result.economy.businessSystems as any).customerStats[setup.businessId].totalFailed, 1);
    assert.equal(result.economy.businesses[setup.businessId].flags.customer_service_shift_completed, true);
  });

  it("rejects out-of-order ticket service so customers cannot be skipped", () => {
    const setup = createOpenBusiness();
    setup.state.businesses[setup.businessId].inventory.worker_meal = { itemId: "worker_meal", count: 4 };
    let result = mutate(setup.state, "start_business_customer_session", { businessId: setup.businessId, count: 2 });
    const session = sessions(result.economy)[0];
    const nextTicket = session.queue.find((ticket) => ticket.ticketId !== session.currentTicketId)!;
    result = mutate(result.economy, "serve_business_customer", {
      businessId: setup.businessId,
      sessionId: session.sessionId,
      ticketId: nextTicket.ticketId,
      offerId: nextTicket.requestedOfferId,
    });
    assert.ok(result.warnings.includes("economy_rejected:business_customer_ticket_not_current"));
    const unchanged = sessions(result.economy)[0];
    assert.equal(unchanged.currentTicketId, session.currentTicketId);
    assert.equal(unchanged.servedTicketIds.length, 0);
  });

  it("expires stale shifts before starting a new one and rejects duplicate session ids", () => {
    const setup = createOpenBusiness();
    let result = mutate(setup.state, "start_business_customer_session", { businessId: setup.businessId, count: 1, sessionId: "shift_fixed" });
    assert.deepEqual(result.warnings, []);

    const duplicate = mutate(result.economy, "start_business_customer_session", { businessId: setup.businessId, sessionId: "shift_fixed" }, ctx());
    assert.ok(duplicate.warnings.includes("economy_rejected:business_customer_session_already_active"));

    const laterRequest = {
      requestId: "business-customer-later-shift",
      actorId: ACTOR,
      nowMs: NOW_MS + 3 * 60 * 60 * 1000,
      operation: "start_business_customer_session",
      businessId: setup.businessId,
      sessionId: "shift_after_expiry",
    };
    result = reduceHarthmereEconomyMutationV1(result.economy, laterRequest as any, ctx());
    assert.deepEqual(result.warnings, []);
    const allSessions = sessions(result.economy);
    assert.equal(allSessions.find((session) => session.sessionId === "shift_fixed")?.status, "expired");
    assert.equal(allSessions.find((session) => session.sessionId === "shift_after_expiry")?.status, "active");

    const idCollision = reduceHarthmereEconomyMutationV1(result.economy, {
      ...laterRequest,
      requestId: "business-customer-id-collision",
      nowMs: NOW_MS + 6 * 60 * 60 * 1000,
      sessionId: "shift_fixed",
    } as any, ctx());
    assert.ok(idCollision.warnings.includes("economy_rejected:business_customer_session_id_exists"));
  });

  it("opens branches, assigns staff automation, and routes branch profit back to the parent business", () => {
    const setup = createOpenBusiness("food_service_restaurant");
    setup.state.businesses[setup.businessId].balanceGold = 5_000;
    (setup.state.businessSystems as any).customerStats[setup.businessId] = {
      businessId: setup.businessId,
      totalServed: 55,
      totalFailed: 1,
      lifetimeGold: 2_500,
      bestStreak: 6,
      currentTier: 3,
    };

    let result = mutate(setup.state, "open_business_branch", {
      businessId: setup.businessId,
      outpostId: "outpost_restaurant_redpot",
    });
    assert.deepEqual(result.warnings, []);
    const branches = Object.values((result.economy.businessSystems as any).empireBranches ?? {}) as any[];
    assert.equal(branches.length, 1);
    assert.equal(branches[0].outpostId, "outpost_restaurant_redpot");
    assert.equal(branches[0].outpostBuildingId, "outpost_restaurant_redpot_backend_voxel_building");
    assert.equal(result.economy.businesses[setup.businessId].flags.empire_branch_opened, true);
    assert.equal(result.buildingMaterializationPlans?.length, 1);
    assert.equal(result.buildingMaterializationPlans?.[0]?.requestId, "outpost_restaurant_redpot_backend_materialization");
    assert.equal(validateHarthmereBusinessOutpostLiveWorldNavigationV1(
      (result.economy.businessSystems as any).outpostBuildings.outpost_restaurant_redpot,
    ).ok, true);

    result = mutate(result.economy, "assign_business_automation", {
      businessId: setup.businessId,
      branchId: branches[0].branchId,
      role: "branch_manager",
      skill: 3,
    });
    assert.deepEqual(result.warnings, []);
    const automations = Object.values((result.economy.businessSystems as any).automationAssignments ?? {}) as any[];
    assert.equal(automations.length, 1);
    assert.equal(automations[0].role, "branch_manager");
    assert.equal(automations[0].branchId, branches[0].branchId);

    result = mutate(result.economy, "hire_worker", {
      businessId: setup.businessId,
      employeeId: "employee_regional_manager",
      role: "Regional Host",
      skill: 4,
      wageGoldPerDay: 16,
    });
    assert.deepEqual(result.warnings, []);
    result = mutate(result.economy, "assign_business_branch_manager", {
      businessId: setup.businessId,
      branchId: branches[0].branchId,
      employeeId: "employee_regional_manager",
    });
    assert.deepEqual(result.warnings, []);
    result.economy.businesses[setup.businessId].inventory.worker_meal = { itemId: "worker_meal", count: 4 };
    result = mutate(result.economy, "route_business_branch_stock", {
      businessId: setup.businessId,
      branchId: branches[0].branchId,
      itemId: "worker_meal",
      count: 3,
    });
    assert.deepEqual(result.warnings, []);
    result = mutate(result.economy, "schedule_business_branch_staff", {
      businessId: setup.businessId,
      branchId: branches[0].branchId,
      employeeIds: ["employee_regional_manager"],
    } as any);
    assert.deepEqual(result.warnings, []);
    const preparedBranch = (result.economy.businessSystems as any).empireBranches[branches[0].branchId];
    assert.equal(preparedBranch.regionalManagerEmployeeId, "employee_regional_manager");
    assert.equal(preparedBranch.warehouseInventory.worker_meal, 3);
    assert.deepEqual(preparedBranch.scheduledStaffIds, ["employee_regional_manager"]);

    const beforeGold = result.economy.businesses[setup.businessId].balanceGold;
    result = reduceHarthmereEconomyMutationV1(result.economy, {
      requestId: "business-empire-settlement",
      actorId: ACTOR,
      nowMs: NOW_MS + 24 * 60 * 60 * 1000,
      operation: "run_business_empire_day",
      businessId: setup.businessId,
      days: 1,
    } as any, ctx());
    assert.deepEqual(result.warnings, []);
    assert.ok(result.economy.businesses[setup.businessId].balanceGold > beforeGold);
    const settledBranch = Object.values((result.economy.businessSystems as any).empireBranches ?? {})[0] as any;
    assert.ok(settledBranch.lifetimeProfitGold > 0);
    assert.ok(settledBranch.warehouseInventory.worker_meal < 3);
    assert.ok(settledBranch.regionalDemandMultiplier >= 1);
    const dashboard = (result.economy.businessSystems as any).branchDashboards[settledBranch.branchId];
    assert.ok(dashboard);
    assert.equal(dashboard.managerAssigned, true);
    assert.ok(dashboard.stockUnits >= 0);
    assert.ok(dashboard.staffCoverage > 0);
    assert.equal(automations[0].lastRunAtMs, undefined);
    const settledAutomation = Object.values((result.economy.businessSystems as any).automationAssignments ?? {})[0] as any;
    assert.equal(settledAutomation.lastRunAtMs, NOW_MS + 24 * 60 * 60 * 1000);
    result = mutate(result.economy, "validate_economy_balance");
    assert.deepEqual(result.warnings.filter((warning) => warning.startsWith("balance:outpost_passability")), []);
    assert.deepEqual(result.warnings.filter((warning) => warning.startsWith("balance:outpost_live_navigation")), []);
    assert.deepEqual(result.warnings.filter((warning) => warning.startsWith("balance:business_customer_missing")), []);
  });

  it("assigns every automation role with visible staff AI behavior", () => {
    const setup = createOpenBusiness("food_service_restaurant");
    setup.state.businesses[setup.businessId].balanceGold = 5_000;
    (setup.state.businessSystems as any).customerStats[setup.businessId] = {
      businessId: setup.businessId,
      totalServed: 55,
      totalFailed: 0,
      lifetimeGold: 2_500,
      bestStreak: 6,
      currentTier: 3,
    };
    let result = mutate(setup.state, "open_business_branch", {
      businessId: setup.businessId,
      outpostId: "outpost_restaurant_redpot",
    });
    assert.deepEqual(result.warnings, []);
    const roles = [
      "front_counter",
      "branch_manager",
      "courier_dispatch",
      "purchasing_manager",
      "quality_inspector",
    ];
    for (const role of roles) {
      result = mutate(result.economy, "assign_business_automation", {
        businessId: setup.businessId,
        role,
        skill: 5,
      });
      assert.deepEqual(result.warnings, []);
      result = mutate(result.economy, "hire_worker", {
        businessId: setup.businessId,
        employeeId: `employee_${role}`,
        role,
        skill: 5,
        wageGoldPerDay: 10,
      });
      assert.deepEqual(result.warnings, []);
      result = mutate(result.economy, "run_business_employee_task", {
        businessId: setup.businessId,
        employeeId: `employee_${role}`,
        role,
        assignedTask: role === "branch_manager" ? "branch_manager" : role === "courier_dispatch" ? "dispatch_runner" : role === "purchasing_manager" ? "stock_runner" : role === "quality_inspector" ? "quality_check" : "front_counter",
      });
      assert.deepEqual(result.warnings.filter((warning) => warning.includes("rejected")), []);
      const runs = Object.values((result.economy.businessSystems as any).employeeTaskRuns ?? {}) as any[];
      assert.equal(runs[runs.length - 1].automationRole, role);
      assert.notEqual(runs[runs.length - 1].status, "failed");
    }
  });

  it("supports candidate market, interviews, negotiation, hiring, and promotion", () => {
    const setup = createOpenBusiness("food_service_restaurant");
    setup.state.businesses[setup.businessId].balanceGold = 1_000;
    let result = mutate(setup.state, "refresh_business_employee_candidates", {
      businessId: setup.businessId,
      count: 3,
    });
    assert.deepEqual(result.warnings, []);
    let candidates = Object.values((result.economy.businessSystems as any).employeeCandidates ?? {}) as any[];
    assert.equal(candidates.length, 3);
    const candidateId = candidates[0].candidateId;

    result = mutate(result.economy, "interview_business_employee_candidate", {
      businessId: setup.businessId,
      candidateId,
      interviewStyle: "friendly",
    });
    assert.deepEqual(result.warnings, []);
    candidates = Object.values((result.economy.businessSystems as any).employeeCandidates ?? {}) as any[];
    assert.equal(candidates.find((candidate) => candidate.candidateId === candidateId).status, "interviewed");

    const wage = candidates.find((candidate) => candidate.candidateId === candidateId).wageAskGoldPerDay;
    result = mutate(result.economy, "negotiate_business_employee_candidate", {
      businessId: setup.businessId,
      candidateId,
      wageGoldPerDay: wage,
    });
    assert.deepEqual(result.warnings, []);
    result = mutate(result.economy, "hire_business_employee_candidate", {
      businessId: setup.businessId,
      candidateId,
    });
    assert.deepEqual(result.warnings, []);
    const employeeId = result.economy.businesses[setup.businessId].employees[0];
    assert.ok(result.economy.employees[employeeId]);

    const beforeSkill = result.economy.employees[employeeId].skill;
    result = mutate(result.economy, "promote_business_employee", {
      businessId: setup.businessId,
      employeeId,
      assignedTask: "quality_check",
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.economy.employees[employeeId].skill, beforeSkill + 1);
    assert.equal(result.economy.employees[employeeId].assignedTask, "quality_check");
  });

  it("runs employee pathing, animation, collision recovery, and morale failure through backend state", () => {
    const setup = createOpenBusiness("food_service_restaurant");
    let result = mutate(setup.state, "hire_worker", {
      businessId: setup.businessId,
      employeeId: "employee_pathing",
      role: "Line Cook",
      skill: 3,
      wageGoldPerDay: 10,
    });
    assert.deepEqual(result.warnings, []);
    result = mutate(result.economy, "run_business_employee_task", {
      businessId: setup.businessId,
      employeeId: "employee_pathing",
      assignedTask: "production_station",
      offerId: "serve_worker_meal",
      forceSharedServiceLane: true,
    });
    assert.deepEqual(result.warnings.filter((warning) => warning.includes("rejected")), []);
    let runs = Object.values((result.economy.businessSystems as any).employeeTaskRuns ?? {}) as any[];
    const run = runs[0];
    assert.equal(run.animationCue, "procedural_plate_slide_counter");
    assert.ok(run.employeePath.length > 0);
    assert.ok(run.collisionAudit.resolvedCollisions > 0);
    assert.equal(result.economy.businesses[setup.businessId].flags.employee_stuck_recovery_used, true);

    result.economy.employees.employee_pathing.morale = 8;
    result = mutate(result.economy, "run_business_employee_task", {
      businessId: setup.businessId,
      employeeId: "employee_pathing",
      assignedTask: "front_counter",
      offerId: "serve_worker_meal",
    });
    runs = Object.values((result.economy.businessSystems as any).employeeTaskRuns ?? {}) as any[];
    const failed = runs.find((entry) => entry.failureReason === "employee_morale_too_low");
    assert.ok(failed);
    assert.equal(result.economy.businesses[setup.businessId].flags.employee_morale_failure, true);
  });

  it("drives morale into absence, theft-risk loss, and resignation during staff lifecycle ticks", () => {
    const setup = createOpenBusiness("food_service_restaurant");
    let result = mutate(setup.state, "hire_worker", {
      businessId: setup.businessId,
      employeeId: "employee_low_morale",
      role: "Server",
      skill: 2,
      wageGoldPerDay: 10,
    });
    assert.deepEqual(result.warnings, []);
    result.economy.businesses[setup.businessId].balanceGold = 100;
    result.economy.employees.employee_low_morale.morale = 20;
    result.economy.employees.employee_low_morale.loyalty = 10;
    result = mutate(result.economy, "run_business_employee_morale_tick", {
      businessId: setup.businessId,
      days: 1,
    });
    assert.ok(result.warnings.some((warning) => warning.includes("employee_absent_or_mistake")));
    assert.ok(result.warnings.some((warning) => warning.includes("employee_theft_risk_loss")));
    assert.equal(result.economy.employees.employee_low_morale.assignedTask, "rest_required");

    result.economy.employees.employee_low_morale.morale = 5;
    result.economy.employees.employee_low_morale.loyalty = 5;
    result = mutate(result.economy, "run_business_employee_morale_tick", {
      businessId: setup.businessId,
      days: 1,
    });
    assert.ok(result.warnings.some((warning) => warning.includes("employee_resigned")));
    assert.equal(result.economy.employees.employee_low_morale, undefined);
  });

  it("rejects branch expansion until the customer business has earned tier three", () => {
    const setup = createOpenBusiness("food_service_restaurant");
    setup.state.businesses[setup.businessId].balanceGold = 5_000;
    (setup.state.businessSystems as any).customerStats[setup.businessId] = {
      businessId: setup.businessId,
      totalServed: 12,
      totalFailed: 0,
      lifetimeGold: 300,
      bestStreak: 2,
      currentTier: 1,
    };
    const result = mutate(setup.state, "open_business_branch", {
      businessId: setup.businessId,
      outpostId: "outpost_restaurant_redpot",
    });
    assert.ok(result.warnings.includes("economy_rejected:business_branch_requires_tier_3"));
    assert.equal(Object.keys((result.economy.businessSystems as any).empireBranches ?? {}).length, 0);
  });

  it("closes branches cleanly and rejects double closure", () => {
    const setup = createOpenBusiness("food_service_restaurant");
    setup.state.businesses[setup.businessId].balanceGold = 5_000;
    (setup.state.businessSystems as any).customerStats[setup.businessId] = {
      businessId: setup.businessId,
      totalServed: 55,
      totalFailed: 0,
      lifetimeGold: 2_500,
      bestStreak: 6,
      currentTier: 3,
    };
    let result = mutate(setup.state, "open_business_branch", {
      businessId: setup.businessId,
      outpostId: "outpost_restaurant_redpot",
    });
    assert.deepEqual(result.warnings, []);
    const branch = Object.values((result.economy.businessSystems as any).empireBranches)[0] as any;
    result = mutate(result.economy, "assign_business_automation", {
      businessId: setup.businessId,
      branchId: branch.branchId,
      role: "branch_manager",
      skill: 3,
    });
    assert.deepEqual(result.warnings, []);
    const beforeCloseGold = result.economy.businesses[setup.businessId].balanceGold;
    result = mutate(result.economy, "close_business_branch", {
      businessId: setup.businessId,
      branchId: branch.branchId,
    });
    assert.deepEqual(result.warnings, []);
    const closedBranch = (result.economy.businessSystems as any).empireBranches[branch.branchId];
    assert.equal(closedBranch.status, "closed");
    assert.ok(result.economy.businesses[setup.businessId].balanceGold > beforeCloseGold);
    assert.equal((Object.values((result.economy.businessSystems as any).automationAssignments) as any[])[0].active, false);
    const duplicate = mutate(result.economy, "close_business_branch", {
      businessId: setup.businessId,
      branchId: branch.branchId,
    });
    assert.ok(duplicate.warnings.includes("economy_rejected:business_branch_already_closed"));
  });

  it("requires an open managed business for customer shifts", () => {
    let state = defaultHarthmereProductionEconomyStateV1();
    let result = mutate(state, "register_business", { businessType: "general_trader", name: "Closed Counter" });
    state = result.economy;
    const businessId = Object.keys(state.businesses)[0];
    result = mutate(state, "start_business_customer_session", { businessId });
    assert.ok(result.warnings.includes("economy_rejected:business_not_open"));

    const otherActor = reduceHarthmereEconomyMutationV1(state, {
      requestId: "other_actor_customer_shift",
      actorId: "not_owner",
      nowMs: NOW_MS,
      operation: "start_business_customer_session",
      businessId,
    }, ctx());
    assert.ok(otherActor.warnings.some((warning) => warning.startsWith("economy_rejected:business_permission_required")));
  });
});
