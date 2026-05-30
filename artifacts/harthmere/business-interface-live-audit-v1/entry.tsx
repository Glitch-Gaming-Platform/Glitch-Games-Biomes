
import * as React from "react";
import { createRoot } from "react-dom/client";
import { HarthmereBusinessInterfacePanel } from "../../../src/client/components/harthmere_business/HarthmereBusinessInterfacePanel";
import {
  HARTHMERE_BUSINESS_TYPE_ORDER_V1,
  createHarthmereBusinessInterfaceAdapterV1,
  normalizeHarthmereBusinessEconomySnapshotV1,
  type HarthmereBusinessEconomySnapshotV1,
  type HarthmereBusinessTypeIdV1,
} from "../../../src/client/components/harthmere_business/businessInterfaceLiveAdapter";
import {
  HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1,
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1,
  getHarthmereBusinessMiniGameDefinitionV1,
} from "../../../src/shared/harthmere/business_customer_simulator_v1";

const businessLabels: Record<HarthmereBusinessTypeIdV1, string> = {
  exotic_matter_refinery: "Exotic Matter Refinery",
  biome_maintenance_repair: "Biome Maintenance & Repair",
  biome_design_studio: "Biome Design Studio",
  security_defense_contractor: "Security & Defense Contractor",
  portal_transit_company: "Portal Transit Company",
  biome_farming_rare_foods: "Biome Farming & Rare Foods",
  weapons_tools: "Weapons & Tools",
  magic_goods: "Magic Goods",
  exploration_guide: "Exploration Guide",
  custom_home_property_development: "Custom Home & Property Development",
  general_trader: "General Trader",
  hunter_wild_meat: "Hunter For Wild Meat",
  medical_doctor: "Medical Clinic",
  teleport_owner: "Teleport Owner",
  waste_sanitation_cleanup: "Waste & Sanitation Cleanup",
  repair_maintenance_person: "Repair & Maintenance",
  food_service_restaurant: "Food Service Restaurant",
  courier: "Courier",
  hospitality_inn_hotel_shelter: "Hospitality Inn & Shelter",
};

function businessType(typeId: HarthmereBusinessTypeIdV1) {
  return {
    typeId,
    displayName: businessLabels[typeId],
    category: "business",
    startCostGold: 100,
    materialNeed: "medium",
    baseStorageSlots: 24,
    baseUpkeepGoldPerDay: 8,
    requiredLicense: "basic trade",
    minimumLicenseLevel: 1,
    serviceNeeds: ["food", "maintenance", "logistics"],
    inputItemFamilies: ["service stock"],
    outputItemFamilies: ["customer service"],
    riskLevel: 2,
    civicImportance: 2,
  };
}

const allServiceItems = [
  "worker_meal", "rare_seed", "road_ration", "repair_part", "trade_goods", "certified_portal_fuel",
  "stabilized_exotic_matter", "containment_filter", "portal_fuel", "anchor_part", "repair_kit", "decor",
  "design_pack", "lighting_kit", "guard_contract", "route_map", "ration_pack", "signal_flare", "lockbox",
  "destination_crystal", "crop_bundle", "herb_bundle", "rare_food", "clean_water", "repair_tool", "metal_part",
  "iron_ingot", "whetstone", "crystal_lens", "charm", "potion", "ward", "relic_fragment", "field_kit",
  "blueprint", "permit_form", "wood_plank", "stone_block", "wild_meat", "hide", "bandage", "field_medkit",
  "medicine", "teleport_token", "emergency_return", "teleport_fuel", "containment_barrel", "cleaning_reagent",
  "clean_certificate", "nails", "parcel", "sealed_package", "linen"
];

function inventory() {
  return Object.fromEntries(allServiceItems.map((itemId, index) => [itemId, { itemId, count: 6 + (index % 4) }])) as any;
}

function business(id: string, typeId: HarthmereBusinessTypeIdV1, ownerId: string) {
  return {
    businessId: id,
    ownerKind: "player" as const,
    ownerId,
    typeId,
    name: businessLabels[typeId],
    status: "open" as const,
    licenseClass: "basic trade",
    licenseLevel: 3,
    propertyId: "property_" + id,
    townId: "harthmere_grove",
    regionId: "harthmere_grove_region",
    inventory: inventory(),
    storageMaxSlots: 64,
    employees: ["employee_" + id],
    activeContracts: ["active_contract_" + id],
    completedContracts: 14,
    reputation: 32,
    customerSatisfaction: 84,
    sanitationRating: 72,
    safetyRating: 76,
    serviceRadius: 4,
    priceModifiers: { worker_meal: 1.2, repair_part: 1.1 },
    balanceGold: 6200,
    debtGold: 0,
    upkeepGoldPerDay: 8,
    rentGoldPerDay: 6,
    wageGoldPerDay: 16,
    salesTaxRate: 0.06,
    lastTickAtMs: Date.now() - 60_000,
    createdAtMs: Date.now() - 86_400_000,
    updatedAtMs: Date.now(),
    flags: {},
  };
}

function buildSnapshot(): HarthmereBusinessEconomySnapshotV1 {
  const businesses: Record<string, any> = {};
  const employees: Record<string, any> = {};
  const employeeCandidates: Record<string, any> = {};
  const employeeTaskRuns: Record<string, any> = {};
  const customerSessions: Record<string, any> = {};
  const customerStats: Record<string, any> = {};
  const openContracts: any[] = [];
  const activeContracts: any[] = [];
  for (const typeId of HARTHMERE_BUSINESS_TYPE_ORDER_V1) {
    for (const mode of ["owner", "customer"] as const) {
      const id = mode + "_" + typeId;
      businesses[id] = business(id, typeId, mode === "owner" ? "player_a" : "player_b");
    }
    const ownerBusinessId = "owner_" + typeId;
    const employeeId = "employee_" + ownerBusinessId;
    employees[employeeId] = {
      employeeId,
      businessId: ownerBusinessId,
      npcId: "npc_" + typeId,
      role: "Floor Specialist",
      skill: 4,
      wageGoldPerDay: 16,
      morale: 72,
      loyalty: 66,
      assignedTask: "front_counter",
      hiredAtMs: 1,
      lastPaidAtMs: 1,
    };
    employeeCandidates["candidate_" + typeId] = {
      candidateId: "candidate_" + typeId,
      businessId: ownerBusinessId,
      typeId,
      displayName: businessLabels[typeId] + " Helper",
      role: "Assistant",
      skill: 3,
      wageAskGoldPerDay: 18,
      personality: "steady",
      schedule: "flex",
      workplacePreference: "front counter",
      preferredTaskId: "front_counter",
      status: "available",
      negotiationRounds: 0,
      generatedAtMs: 1,
      expiresAtMs: Date.now() + 86_400_000,
      notes: [],
    };
    const definition = getHarthmereBusinessMiniGameDefinitionV1(typeId);
    employeeTaskRuns["task_" + typeId] = {
      taskRunId: "task_" + typeId,
      businessId: ownerBusinessId,
      typeId,
      employeeId,
      employeeRole: "Floor Specialist",
      offerId: definition.offers[0].offerId,
      offerLabel: definition.offers[0].label,
      taskKind: "counter_service",
      status: "completed",
      animationFamily: "counter_handoff",
      employeePath: [{ x: 1, y: 1 }, { x: 2, y: 1 }],
      createdAtMs: Date.now(),
    };
    const ask = definition.askTemplates[0];
    const npc = HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1.find((candidate) => candidate.businessPreferences.includes(typeId)) ?? HARTHMERE_BUSINESS_CUSTOMER_NPCS_V1[0];
    customerSessions["session_" + typeId] = {
      sessionId: "session_" + typeId,
      businessId: ownerBusinessId,
      typeId,
      actorId: "player_a",
      status: "active",
      startedAtMs: Date.now() - 10_000,
      expiresAtMs: Date.now() + 3_600_000,
      currentTicketId: "ticket_" + typeId,
      queue: [{
        ticketId: "ticket_" + typeId,
        npcId: npc.npcId,
        askId: ask.askId,
        requestedOfferId: ask.desiredOfferId,
        askLine: ask.line,
        status: "waiting",
        arrivedAtMs: Date.now() - 5_000,
        patience: ask.patience,
        patienceRemaining: ask.patience,
        difficulty: ask.difficulty,
        rewardGold: ask.rewardGold,
        reputationDelta: ask.reputationDelta,
        needDelta: ask.needDelta,
        navGoal: ask.navGoal,
      }],
      servedTicketIds: [],
      failedTicketIds: [],
      streak: 2,
      satisfaction: 72,
      earnedGold: 0,
      progressPoints: 0,
      dailyBonusGold: 18,
      notes: [npc.displayName + " walked from queue to counter."],
    };
    customerStats[ownerBusinessId] = {
      businessId: ownerBusinessId,
      totalServed: 64,
      totalFailed: 2,
      lifetimeGold: 2400,
      bestStreak: 8,
      currentTier: 3,
      serviceXp: 820,
      likeability: 34,
      friendshipPointsByNpcId: { [npc.npcId]: 8 },
      favoriteCustomerNpcIds: [npc.npcId],
      repeatCustomerMemories: [npc.displayName + " remembers a fast counter visit."],
      thankYouNotes: [npc.displayName + " left a thank-you note."],
      collectiblesEarned: [typeId + " customer stamp"],
      decorationUnlocks: [typeId + " counter keepsake"],
      badges: [typeId + " trusted service"],
    };
    openContracts.push({
      contractId: "open_" + typeId,
      issuerKind: "player",
      issuerId: "customer_a",
      title: businessLabels[typeId] + " request",
      businessType: typeId,
      requirements: [{ serviceNeed: definition.offers[0].serviceNeed, serviceUnits: 1 }],
      rewardGold: 120,
      reputationDelta: 2,
      status: "open",
      regionId: "harthmere_grove_region",
      createdAtMs: 1,
      deadlineAtMs: Date.now() + 86_400_000,
      failurePenaltyGold: 10,
      escrowGold: 120,
      logs: [],
    });
    activeContracts.push({
      contractId: "active_" + typeId,
      issuerKind: "player",
      issuerId: "customer_b",
      title: businessLabels[typeId] + " active order",
      businessType: typeId,
      requirements: [{ itemId: Object.keys(definition.offers[0].requiredItems)[0], count: 1 }],
      rewardGold: 150,
      reputationDelta: 3,
      status: "active",
      acceptedByBusinessId: ownerBusinessId,
      acceptedByActorId: "player_a",
      regionId: "harthmere_grove_region",
      createdAtMs: 1,
      deadlineAtMs: Date.now() + 43_200_000,
      failurePenaltyGold: 15,
      escrowGold: 150,
      logs: [],
    });
  }
  return normalizeHarthmereBusinessEconomySnapshotV1({
    actorId: "player_a",
    version: "business-interface-live-audit-v1",
    businessTypes: Object.fromEntries(HARTHMERE_BUSINESS_TYPE_ORDER_V1.map((typeId) => [typeId, businessType(typeId)])),
    businesses,
    myBusinesses: Object.values(businesses).filter((entry: any) => entry.ownerId === "player_a"),
    openContracts,
    activeContracts,
    customerContracts: [],
    employees,
    loans: {},
    insurancePolicies: {},
    tradeRoutes: {},
    failures: {},
    marketOrders: { order_worker_meal: { orderId: "order_worker_meal", kind: "sell", itemId: "worker_meal", count: 4, unitPriceGold: 28, status: "open" } },
    towns: { harthmere_grove: { townId: "harthmere_grove", publicBudgetGold: 2000, needs: {} } },
    regions: { harthmere_grove_region: { regionId: "harthmere_grove_region", priceIndex: Object.fromEntries(allServiceItems.map((itemId, index) => [itemId, 10 + (index % 7)])) } },
    businessSystems: {
      permissions: {},
      bankAccounts: {},
      outpostBuildings: HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1,
      empireBranches: {},
      branchDashboards: {},
      automationAssignments: {},
      employeeCandidates,
      employeeTaskRuns,
      customerSessions,
      customerStats,
      serviceQuests: {},
    },
    balanceWarnings: [],
    ledger: [],
  });
}

const auditState = buildSnapshot();
const operations: Array<{ operation: string; payload: Record<string, unknown> }> = [];
const adapter = createHarthmereBusinessInterfaceAdapterV1({
  state: auditState,
  hydrated: true,
  refresh: async () => auditState,
  submit: async (operation, payload) => {
    operations.push({ operation, payload });
    return { ok: true, economyState: auditState } as any;
  },
});

function AuditApp() {
  const [typeId, setTypeId] = React.useState<HarthmereBusinessTypeIdV1>("food_service_restaurant");
  const [mode, setMode] = React.useState<"owner" | "customer">("owner");
  const activeBusinessId = mode + "_" + typeId;
  React.useEffect(() => {
    (window as any).__businessAudit = {
      select: (nextTypeId: HarthmereBusinessTypeIdV1, nextMode: "owner" | "customer") => { setTypeId(nextTypeId); setMode(nextMode); },
      operations,
      clearOperations: () => { operations.splice(0, operations.length); },
      activeBusinessId: () => activeBusinessId,
      typeIds: HARTHMERE_BUSINESS_TYPE_ORDER_V1,
    };
  }, [activeBusinessId]);
  return <main>
    <div className="audit-toolbar" data-testid="audit-toolbar">
      <label>Business <select aria-label="Audit business" value={typeId} onChange={(event) => setTypeId(event.currentTarget.value as HarthmereBusinessTypeIdV1)}>{HARTHMERE_BUSINESS_TYPE_ORDER_V1.map((id) => <option key={id} value={id}>{businessLabels[id]}</option>)}</select></label>
      <button type="button" aria-pressed={mode === "owner"} onClick={() => setMode("owner")}>Owner</button>
      <button type="button" aria-pressed={mode === "customer"} onClick={() => setMode("customer")}>Customer</button>
      <span>{businessLabels[typeId]} · {mode}</span>
    </div>
    <HarthmereBusinessInterfacePanel adapter={adapter} nearbyBusinessId={activeBusinessId} context={{ insideBusiness: true, nearbyBusinessId: activeBusinessId, actorGuildId: "guild_1" }} compact />
  </main>;
}

createRoot(document.getElementById("root")!).render(<AuditApp />);
