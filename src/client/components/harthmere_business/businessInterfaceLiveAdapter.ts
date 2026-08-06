/*
 * businessInterfaceLiveAdapter.ts
 *
 * Live adapter for the in-world Harthmere business interface. This is not a
 * BiomesUI tab. The world/combat/interact system should pass a nearby
 * businessId only while the player is physically inside or interacting with a
 * business property. Runtime state is fetched from the production economy
 * backend and all writes are posted through request_economy_mutation.
 */

import { harthmerePlayerCapacityMessage } from "@/client/components/harthmere_capacity_messages";
import { harthmereBusinessToolForType } from "@/shared/harthmere/harthmere_business_tool_shop";
import { harthmereBusinessStorefrontListingsForType } from "@/shared/harthmere/harthmere_business_storefront_goods";
import {
  harthmereResolveBikkieVisual,
  type HarthmereResolvedBikkieVisual,
} from "@/shared/harthmere/bikkie_visual_resolver";
import { getHarthmereItemDefinition } from "@/shared/harthmere/mmo_inventory_authority";
import {
  harthmereNativeBiomesIdForItemId,
  harthmereNativeItemIdForBiomesId,
} from "@/shared/harthmere/harthmere_native_item_ids";
import {
  HARTHMERE_FOOD_DEFINITIONS,
  HARTHMERE_SEED_DEFINITIONS,
} from "@/shared/harthmere/mmo_farming_food_stamina";
import { HARTHMERE_MEDICAL_ITEM_DEFINITIONS } from "@/shared/harthmere/mmo_medical_health";
import {
  HARTHMERE_BUSINESS_CUSTOMER_NPCS,
  harthmereBusinessOutpostBusinessId,
  activeHarthmereBusinessCustomerTicket,
  findHarthmereBusinessCustomerNpc,
  getHarthmereBusinessBikkieGraphics,
  getHarthmereBusinessMiniGameDefinition,
  getHarthmereBusinessServiceItemDefinition,
  normalizeHarthmereBusinessCustomerStats,
  type HarthmereBusinessMiniGameDecision,
  type HarthmereBusinessBikkieGraphic,
  type HarthmereBusinessCustomerNpc,
  type HarthmereBusinessCustomerSession,
  type HarthmereBusinessCustomerStats,
  type HarthmereBusinessCustomerTicket,
  type HarthmereBusinessMiniGameDefinition,
  type HarthmereBusinessOutpostProceduralBuildingRecord,
  type HarthmereBusinessServiceOffer,
} from "../../../shared/harthmere/business_customer_simulator";
import {
  businessCheckInStatus,
  initBusinessDailyCheckInState,
  type BusinessCheckInStatus,
  type BusinessDailyCheckInState,
} from "@/shared/harthmere/business_daily_checkin";
import { harthmereDayIndex } from "@/client/components/harthmere_business/businessDailyCheckInClient";
import type {
  HarthmereBusinessEmployeeAssignableTaskId,
  HarthmereBusinessEmployeeCandidate,
  HarthmereBusinessEmployeeTaskRun,
} from "../../../shared/harthmere/business_employee_ai";
import {
  fetchHarthmereLiveWithTimeout,
  runHarthmereLiveMutationSerially,
} from "@/client/components/harthmere_live_fetch";
import { HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT } from "@/client/components/challenges/harthmereEvents";

export type {
  HarthmereBusinessBikkieGraphic,
  HarthmereBusinessCustomerNpc,
  HarthmereBusinessCustomerSession,
  HarthmereBusinessCustomerStats,
  HarthmereBusinessCustomerTicket,
  HarthmereBusinessMiniGameDefinition,
  HarthmereBusinessMiniGameDecision,
  HarthmereBusinessOutpostProceduralBuildingRecord,
  HarthmereBusinessServiceOffer,
} from "../../../shared/harthmere/business_customer_simulator";
export type {
  HarthmereBusinessEmployeeAssignableTaskId,
  HarthmereBusinessEmployeeCandidate,
  HarthmereBusinessEmployeeTaskRun,
} from "../../../shared/harthmere/business_employee_ai";

export type HarthmereBusinessActorMode = "owner" | "customer";
export type HarthmereBusinessPanelTab =
  | "overview"
  | "orders"
  | "money"
  | "inventory"
  | "staff"
  | "services"
  | "status";

export type HarthmereBusinessTypeId =
  | "exotic_matter_refinery"
  | "biome_maintenance_repair"
  | "biome_design_studio"
  | "security_defense_contractor"
  | "portal_transit_company"
  | "biome_farming_rare_foods"
  | "weapons_tools"
  | "magic_goods"
  | "exploration_guide"
  | "custom_home_property_development"
  | "general_trader"
  | "hunter_wild_meat"
  | "medical_doctor"
  | "teleport_owner"
  | "waste_sanitation_cleanup"
  | "repair_maintenance_person"
  | "food_service_restaurant"
  | "courier"
  | "hospitality_inn_hotel_shelter";

export interface HarthmereBusinessTypeDefinition {
  typeId: HarthmereBusinessTypeId;
  displayName: string;
  category: string;
  startCostGold: number;
  materialNeed: string;
  baseStorageSlots: number;
  baseUpkeepGoldPerDay: number;
  requiredLicense: string;
  minimumLicenseLevel: number;
  serviceNeeds: string[];
  inputItemFamilies: string[];
  outputItemFamilies: string[];
  riskLevel: number;
  civicImportance: number;
}

export interface HarthmereBusinessInventoryStack {
  itemId: string;
  count: number;
  expiresAtMs?: number;
  condition?: number;
  contaminated?: boolean;
}

export interface HarthmereBusinessRecord {
  businessId: string;
  ownerKind: "player" | "npc" | "guild" | "town";
  ownerId: string;
  typeId: HarthmereBusinessTypeId;
  name: string;
  status: "draft" | "open" | "paused" | "suspended" | "bankrupt" | "closed";
  licenseClass: string;
  licenseLevel: number;
  propertyId?: string;
  townId?: string;
  regionId: string;
  inventory: Record<string, HarthmereBusinessInventoryStack>;
  storageMaxSlots: number;
  employees: string[];
  activeContracts: string[];
  completedContracts: number;
  reputation: number;
  customerSatisfaction: number;
  sanitationRating: number;
  safetyRating: number;
  serviceRadius: number;
  priceModifiers: Record<string, number>;
  balanceGold: number;
  debtGold: number;
  upkeepGoldPerDay: number;
  rentGoldPerDay: number;
  wageGoldPerDay: number;
  salesTaxRate: number;
  lastTickAtMs: number;
  createdAtMs: number;
  updatedAtMs: number;
  flags: Record<string, boolean>;
  // Owner daily check-in state (streak / made / lost). Provided by the backend.
  dailyCheckIn?: BusinessDailyCheckInState;
}

export interface HarthmereBusinessContract {
  contractId: string;
  issuerKind: string;
  issuerId: string;
  townId?: string;
  regionId: string;
  title: string;
  businessType?: HarthmereBusinessTypeId;
  requirements: Array<{
    itemId?: string;
    count?: number;
    serviceNeed?: string;
    serviceUnits?: number;
  }>;
  rewardGold: number;
  reputationDelta: number;
  status: "open" | "active" | "fulfilled" | "failed" | "cancelled" | "expired";
  acceptedByBusinessId?: string;
  acceptedByActorId?: string;
  createdAtMs: number;
  deadlineAtMs: number;
  completedAtMs?: number;
  failurePenaltyGold: number;
  escrowGold: number;
  logs: string[];
}

export interface HarthmereBusinessEmployee {
  employeeId: string;
  businessId: string;
  actorId?: string;
  npcId?: string;
  role: string;
  skill: number;
  wageGoldPerDay: number;
  morale: number;
  loyalty: number;
  assignedTask?: string;
  hiredAtMs: number;
  lastPaidAtMs: number;
  injuredUntilMs?: number;
}

export interface HarthmereBusinessBankAccount {
  accountId: string;
  businessId: string;
  ownerKind: string;
  ownerId: string;
  balanceGold: number;
  status: "active" | "frozen" | "closed";
  createdAtMs: number;
  audit: Array<{
    auditId: string;
    atMs: number;
    actorId: string;
    kind: string;
    amountGold?: number;
    reason?: string;
  }>;
}

export type HarthmereBusinessAutomationRole =
  | "front_counter"
  | "branch_manager"
  | "courier_dispatch"
  | "purchasing_manager"
  | "quality_inspector";

export interface HarthmereBusinessBranch {
  branchId: string;
  parentBusinessId: string;
  businessType: HarthmereBusinessTypeId;
  outpostId: string;
  outpostBuildingId: string;
  townId: string;
  regionId: string;
  status: "active" | "paused" | "closed";
  openedAtMs: number;
  staffSlots: number;
  automationSlots: number;
  dailyRevenueGold: number;
  dailyUpkeepGold: number;
  queueCapacityBonus: number;
  reputationShare: number;
  lastSettlementAtMs: number;
  lifetimeProfitGold: number;
  regionalManagerEmployeeId?: string;
  warehouseSlots?: number;
  warehouseInventory?: Record<string, number>;
  scheduledStaffIds?: string[];
  regionalDemandMultiplier?: number;
  competitorPressure?: number;
  lastDashboardAtMs?: number;
  branchNotes?: string[];
}

export interface HarthmereBusinessBranchDashboard {
  dashboardId: string;
  branchId: string;
  parentBusinessId: string;
  atMs: number;
  dailyProfitGold: number;
  stockUnits: number;
  staffCoverage: number;
  demandMultiplier: number;
  competitorPressure: number;
  managerAssigned: boolean;
  alerts: string[];
  recommendedActions: string[];
}

export interface HarthmereBusinessAutomation {
  automationId: string;
  businessId: string;
  branchId?: string;
  role: HarthmereBusinessAutomationRole;
  level: number;
  assignedEmployeeId?: string;
  active: boolean;
  dailyUpkeepGold: number;
  serviceCapacityBonus: number;
  passiveProfitGoldPerDay: number;
  failureRisk: number;
  createdAtMs: number;
  lastRunAtMs?: number;
}

export interface HarthmereBusinessSystemsSnapshot {
  permissions: Record<string, Record<string, string[]>>;
  bankAccounts: Record<string, HarthmereBusinessBankAccount>;
  propertyIntegrations: Record<string, any>;
  biomeAnchors: Record<string, any>;
  threats: Record<string, any>;
  portalEndpoints: Record<string, any>;
  teleportPads: Record<string, any>;
  cropNodes: Record<string, any>;
  animalPopulations: Record<string, any>;
  contaminationSites: Record<string, any>;
  patients: Record<string, any>;
  durableItems: Record<string, any>;
  explorationRoutes: Record<string, any>;
  deliveries: Record<string, any>;
  hospitality: Record<string, any>;
  menuByBusiness: Record<string, string[]>;
  unstableMagicItems: Record<string, any>;
  serviceQuests: Record<string, any>;
  customerSessions: Record<string, HarthmereBusinessCustomerSession>;
  customerStats: Record<string, HarthmereBusinessCustomerStats>;
  outpostBuildings: Record<
    string,
    HarthmereBusinessOutpostProceduralBuildingRecord
  >;
  empireBranches: Record<string, HarthmereBusinessBranch>;
  branchDashboards: Record<string, HarthmereBusinessBranchDashboard>;
  automationAssignments: Record<string, HarthmereBusinessAutomation>;
  employeeCandidates: Record<string, HarthmereBusinessEmployeeCandidate>;
  employeeTaskRuns: Record<string, HarthmereBusinessEmployeeTaskRun>;
  balanceReports: string[];
}

export interface HarthmereBusinessEconomySnapshot {
  version?: string;
  actorId: string;
  actorKnownRecipes?: string[];
  businessTypes: Record<
    HarthmereBusinessTypeId,
    HarthmereBusinessTypeDefinition
  >;
  recipeCatalog?: Record<string, any>;
  businesses: Record<string, HarthmereBusinessRecord>;
  myBusinesses: HarthmereBusinessRecord[];
  openContracts: HarthmereBusinessContract[];
  activeContracts: HarthmereBusinessContract[];
  customerContracts?: HarthmereBusinessContract[];
  employees: Record<string, HarthmereBusinessEmployee>;
  loans: Record<string, any>;
  insurancePolicies: Record<string, any>;
  tradeRoutes: Record<string, any>;
  failures: Record<string, any>;
  marketOrders: Record<string, any>;
  towns: Record<string, any>;
  regions: Record<string, any>;
  businessSystems: Partial<HarthmereBusinessSystemsSnapshot>;
  balanceWarnings: string[];
  ledger: Array<{
    id: string;
    atMs: number;
    actorId?: string;
    kind: string;
    businessId?: string;
    amountGold?: number;
    reason?: string;
  }>;
}

export interface HarthmereBusinessInterfaceResponse {
  ok?: boolean;
  economyState?: HarthmereBusinessEconomySnapshot;
  inventoryLootState?: unknown;
  playerStatusState?: unknown;
  backendMutation?: { warnings?: string[] };
}

function dispatchHarthmereBusinessInventoryLootUpdated(
  response: HarthmereBusinessInterfaceResponse | undefined
) {
  if (
    typeof window === "undefined" ||
    !response?.inventoryLootState ||
    typeof CustomEvent === "undefined"
  ) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT, {
      detail: {
        body: response,
        inventoryLootState: response.inventoryLootState,
        playerStatusState: response.playerStatusState,
      },
    })
  );
}

export interface HarthmereBusinessVisibleInventoryItem {
  itemId: string;
  displayName?: string;
  count: number;
  priceGold: number;
  condition?: number;
  expiresAtMs?: number;
  contaminated?: boolean;
  visual?: HarthmereResolvedBikkieVisual;
}

export interface HarthmereBusinessMoneySummary {
  balanceGold: number;
  bankBalanceGold: number;
  debtGold: number;
  dailyUpkeepGold: number;
  dailyRentGold: number;
  dailyWagesGold: number;
  salesTaxRate: number;
}

export interface HarthmereBusinessTodo {
  id: string;
  severity: "info" | "warning" | "danger";
  label: string;
  description: string;
}

export interface HarthmereBusinessServiceAction {
  actionId: string;
  label: string;
  description: string;
  audience: "owner" | "customer" | "both";
  operation: string;
  defaultPayload?: Record<string, unknown>;
  serviceNeed?: string;
  rewardGold?: number;
  priceGold?: number;
  requiresWorldService?: boolean;
  fieldServiceKind?: string;
  defaultTargetId?: string;
}

export const HARTHMERE_BUSINESS_TYPE_ORDER: HarthmereBusinessTypeId[] = [
  "exotic_matter_refinery",
  "biome_maintenance_repair",
  "biome_design_studio",
  "security_defense_contractor",
  "portal_transit_company",
  "biome_farming_rare_foods",
  "weapons_tools",
  "magic_goods",
  "exploration_guide",
  "custom_home_property_development",
  "general_trader",
  "hunter_wild_meat",
  "medical_doctor",
  "teleport_owner",
  "waste_sanitation_cleanup",
  "repair_maintenance_person",
  "food_service_restaurant",
  "courier",
  "hospitality_inn_hotel_shelter",
];

export const HARTHMERE_BUSINESS_SERVICE_ACTIONS: Record<
  HarthmereBusinessTypeId,
  HarthmereBusinessServiceAction[]
> = {
  exotic_matter_refinery: [
    {
      actionId: "refine",
      label: "Stabilize Matter",
      description: "Convert raw Exotic Matter into safe industrial stock.",
      audience: "owner",
      operation: "run_exotic_refinery_cycle",
      defaultPayload: { itemId: "raw_exotic_matter", count: 1 },
    },
    {
      actionId: "certify_fuel",
      label: "Certify Portal Fuel",
      description: "Certify stabilized fuel for portal and teleport operators.",
      audience: "owner",
      operation: "certify_portal_fuel",
      defaultPayload: { itemId: "portal_fuel", count: 1 },
    },
    {
      actionId: "request_fuel",
      label: "Request Fuel Order",
      description: "Place an escrowed order for certified portal fuel.",
      audience: "customer",
      operation: "create_contract",
      serviceNeed: "energy",
      rewardGold: 160,
    },
  ],
  biome_maintenance_repair: [
    {
      actionId: "repair_biome",
      label: "Repair Biome Anchor",
      description: "Fix weather failure, anchor drift, and timeline leakage.",
      audience: "owner",
      operation: "perform_biome_maintenance",
    },
    {
      actionId: "inspect_biome",
      label: "Request Inspection",
      description: "Ask for a property inspection or emergency repair visit.",
      audience: "customer",
      operation: "create_contract",
      serviceNeed: "maintenance",
      rewardGold: 110,
    },
  ],
  biome_design_studio: [
    {
      actionId: "install_theme",
      label: "Install Design Package",
      description:
        "Install decor/theme work that raises beauty and property value.",
      audience: "owner",
      operation: "install_biome_design",
      defaultPayload: { amountGold: 120 },
    },
    {
      actionId: "request_redesign",
      label: "Request Redesign",
      description: "Commission decor, terrain, lighting, or theme work.",
      audience: "customer",
      operation: "create_contract",
      serviceNeed: "identity",
      rewardGold: 130,
    },
  ],
  security_defense_contractor: [
    {
      actionId: "resolve_threat",
      label: "Resolve Threat",
      description: "Clear a world threat using real combat gear.",
      audience: "owner",
      operation: "resolve_security_threat",
    },
    {
      actionId: "hire_guard",
      label: "Hire Protection",
      description: "Request guards, monster removal, patrols, or escort work.",
      audience: "customer",
      operation: "create_contract",
      serviceNeed: "safety",
      rewardGold: 150,
    },
  ],
  portal_transit_company: [
    {
      actionId: "build_portal",
      label: "Build Endpoint",
      description: "Build a route endpoint and establish portal ownership.",
      audience: "owner",
      operation: "build_portal_endpoint",
      defaultPayload: {
        originTownId: "harthmere_grove",
        destinationTownId: "harthmere_outskirts",
        amountGold: 35,
      },
    },
    {
      actionId: "run_transit",
      label: "Run Transit",
      description: "Operate passenger or cargo transit and collect fares.",
      audience: "both",
      operation: "run_portal_transit",
      defaultPayload: { count: 1 },
    },
  ],
  biome_farming_rare_foods: [
    {
      actionId: "plant_crop",
      label: "Plant Crop",
      description: "Plant a climate-dependent crop node.",
      audience: "owner",
      operation: "plant_crop_node",
      defaultPayload: { itemId: "rare_seed", count: 1 },
    },
    {
      actionId: "harvest",
      label: "Harvest Crops",
      description: "Harvest grown crops into business inventory.",
      audience: "owner",
      operation: "harvest_crop_node",
    },
    {
      actionId: "order_produce",
      label: "Order Produce",
      description: "Order crops, herbs, or rare food supply.",
      audience: "customer",
      operation: "create_contract",
      serviceNeed: "food",
      rewardGold: 90,
    },
  ],
  weapons_tools: [
    {
      actionId: "repair_item",
      label: "Repair Item",
      description: "Repair durable tools, weapons, or work equipment.",
      audience: "owner",
      operation: "repair_durable_item",
    },
    {
      actionId: "upgrade_item",
      label: "Upgrade Gear",
      description: "Upgrade eligible tools or weapons with permit checks.",
      audience: "owner",
      operation: "upgrade_durable_item",
    },
    {
      actionId: "request_repair",
      label: "Request Repair",
      description: "Submit a repair or equipment commission.",
      audience: "customer",
      operation: "create_contract",
      serviceNeed: "maintenance",
      rewardGold: 85,
    },
  ],
  magic_goods: [
    {
      actionId: "craft_magic",
      label: "Craft Magic Good",
      description: "Craft unstable consumables, charms, or wards.",
      audience: "owner",
      operation: "craft_magic_good",
      defaultPayload: { itemId: "unstable_charm", count: 1 },
    },
    {
      actionId: "install_ward",
      label: "Install Ward",
      description: "Install a protective ward on a property.",
      audience: "owner",
      operation: "install_ward",
      defaultPayload: { amountGold: 110 },
    },
    {
      actionId: "request_ward",
      label: "Request Ward",
      description: "Commission wards, charms, potions, or anomaly help.",
      audience: "customer",
      operation: "create_contract",
      serviceNeed: "timeline_stability",
      rewardGold: 140,
    },
  ],
  exploration_guide: [
    {
      actionId: "discover_route",
      label: "Discover Route",
      description: "Discover or register a route through unstable terrain.",
      audience: "owner",
      operation: "discover_exploration_route",
      defaultPayload: {
        originTownId: "harthmere_grove",
        destinationTownId: "rift_field",
        safetyRating: 65,
      },
    },
    {
      actionId: "lead_expedition",
      label: "Lead Expedition",
      description: "Guide clients on a risk-managed expedition.",
      audience: "owner",
      operation: "lead_expedition",
    },
    {
      actionId: "book_expedition",
      label: "Book Expedition",
      description: "Request route advice, a guided trip, or a danger read.",
      audience: "customer",
      operation: "create_contract",
      serviceNeed: "knowledge",
      rewardGold: 125,
    },
  ],
  custom_home_property_development: [
    {
      actionId: "start_project",
      label: "Start Project",
      description: "Start staged construction tied to real property state.",
      audience: "owner",
      operation: "start_property_project",
      defaultPayload: { amountGold: 300 },
    },
    {
      actionId: "advance_project",
      label: "Advance Build",
      description: "Advance construction stages using funds and materials.",
      audience: "owner",
      operation: "advance_property_project",
      defaultPayload: { amountGold: 250 },
    },
    {
      actionId: "request_build",
      label: "Request Build",
      description: "Commission construction, renovation, or demolition.",
      audience: "customer",
      operation: "create_contract",
      serviceNeed: "housing",
      rewardGold: 350,
    },
  ],
  general_trader: [
    {
      actionId: "refresh_inventory",
      label: "Refresh Stock",
      description: "Restock inventory from wholesale and trade networks.",
      audience: "owner",
      operation: "refresh_trader_inventory",
      defaultPayload: { amountGold: 75 },
    },
    {
      actionId: "arbitrage",
      label: "Run Arbitrage",
      description: "Move goods between regions for price spread profit.",
      audience: "owner",
      operation: "perform_regional_arbitrage",
      defaultPayload: { itemId: "trade_goods", count: 4 },
    },
    {
      actionId: "request_goods",
      label: "Request Goods",
      description: "Place an order for common goods or brokerage.",
      audience: "customer",
      operation: "create_contract",
      serviceNeed: "logistics",
      rewardGold: 75,
    },
  ],
  hunter_wild_meat: [
    {
      actionId: "hunt",
      label: "Hunt Wildlife",
      description:
        "Hunt from a real wildlife population with protected-species checks.",
      audience: "owner",
      operation: "hunt_wildlife",
    },
    {
      actionId: "order_meat",
      label: "Order Meat",
      description: "Order wild meat, hides, bones, or pest control.",
      audience: "customer",
      operation: "create_contract",
      serviceNeed: "food",
      rewardGold: 95,
    },
  ],
  medical_doctor: [
    {
      actionId: "register_patient",
      label: "Register Patient",
      description: "Record a patient illness or injury state.",
      audience: "owner",
      operation: "register_patient",
      defaultPayload: { severity: 3, cause: "walk_in" },
    },
    {
      actionId: "treat_patient",
      label: "Treat Patient",
      description:
        "Treat patient illness or injury with success/failure outcomes.",
      audience: "owner",
      operation: "treat_patient",
    },
    {
      actionId: "request_care",
      label: "Request Care",
      description: "Request treatment, checkup, medicine, or emergency care.",
      audience: "customer",
      operation: "create_contract",
      serviceNeed: "health",
      rewardGold: 120,
    },
  ],
  teleport_owner: [
    {
      actionId: "build_pad",
      label: "Build Pad",
      description: "Register a teleport pad and destination.",
      audience: "owner",
      operation: "build_teleport_pad",
      defaultPayload: {
        locationId: "business_front",
        destinationTownId: "harthmere_grove",
        amountGold: 40,
      },
    },
    {
      actionId: "issue_key",
      label: "Issue Access Key",
      description: "Grant destination access to a customer or guildmate.",
      audience: "owner",
      operation: "issue_teleport_access_key",
    },
    {
      actionId: "use_pad",
      label: "Use Teleport",
      description: "Use a fuel-backed teleport pad.",
      audience: "both",
      operation: "use_teleport_pad",
    },
  ],
  waste_sanitation_cleanup: [
    {
      actionId: "accumulate_waste",
      label: "Record Waste",
      description: "Record accumulated waste or contamination at a site.",
      audience: "owner",
      operation: "accumulate_waste",
      defaultPayload: { severity: 3, cause: "business_waste" },
    },
    {
      actionId: "cleanup",
      label: "Clean Site",
      description: "Clean contamination and lower outbreak risk.",
      audience: "owner",
      operation: "cleanup_contamination_site",
    },
    {
      actionId: "request_cleanup",
      label: "Request Cleanup",
      description:
        "Request trash pickup, cleanup, compost, or decontamination.",
      audience: "customer",
      operation: "create_contract",
      serviceNeed: "sanitation",
      rewardGold: 100,
    },
  ],
  repair_maintenance_person: [
    {
      actionId: "repair_fixture",
      label: "Repair Fixture",
      description: "Repair object, furniture, tool, or building fixture state.",
      audience: "owner",
      operation: "repair_fixture",
      defaultPayload: { itemId: "broken_fixture", amountGold: 40 },
    },
    {
      actionId: "request_maintenance",
      label: "Request Maintenance",
      description:
        "Request repair of items, furniture, fixtures, or facilities.",
      audience: "customer",
      operation: "create_contract",
      serviceNeed: "maintenance",
      rewardGold: 70,
    },
  ],
  food_service_restaurant: [
    {
      actionId: "set_menu",
      label: "Set Menu",
      description: "Rotate menus and published meal offerings.",
      audience: "owner",
      operation: "set_restaurant_menu",
      defaultPayload: { inventoryItemDeltas: { worker_meal: 1 } },
    },
    {
      actionId: "serve_day",
      label: "Serve Day",
      description:
        "Serve customers using ingredients, sanitation, and freshness.",
      audience: "owner",
      operation: "serve_restaurant_day",
      defaultPayload: { count: 8 },
    },
    {
      actionId: "order_meal",
      label: "Order Meal",
      description: "Order meals, rations, catering, or buff food.",
      audience: "customer",
      operation: "create_contract",
      serviceNeed: "food",
      rewardGold: 55,
    },
  ],
  courier: [
    {
      actionId: "create_delivery",
      label: "Create Delivery",
      description: "Create an escrow-backed package delivery.",
      audience: "both",
      operation: "create_delivery",
      defaultPayload: { itemId: "parcel", count: 1, rewardGold: 45 },
    },
    {
      actionId: "complete_delivery",
      label: "Complete Delivery",
      description: "Complete active delivery and release escrow.",
      audience: "owner",
      operation: "complete_delivery",
    },
    {
      actionId: "request_delivery",
      label: "Request Courier",
      description: "Request mail, package, medicine, or food delivery.",
      audience: "customer",
      operation: "create_contract",
      serviceNeed: "logistics",
      rewardGold: 65,
    },
  ],
  hospitality_inn_hotel_shelter: [
    {
      actionId: "create_rooms",
      label: "Create Rooms",
      description:
        "Create lodging state for rooms, shelter beds, and occupancy.",
      audience: "owner",
      operation: "create_hospitality_state",
      defaultPayload: { count: 4 },
    },
    {
      actionId: "run_day",
      label: "Run Hospitality Day",
      description: "Update occupancy, guest safety, revenue, and cleanliness.",
      audience: "owner",
      operation: "run_hospitality_day",
    },
    {
      actionId: "clean_rooms",
      label: "Clean Rooms",
      description: "Clean rooms and improve lodging quality.",
      audience: "owner",
      operation: "clean_hospitality_rooms",
    },
    {
      actionId: "book_room",
      label: "Book Room / Shelter",
      description:
        "Request lodging, shelter beds, meeting room, or safehouse stay.",
      audience: "customer",
      operation: "create_contract",
      serviceNeed: "housing",
      rewardGold: 80,
    },
  ],
};

function jsonRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function titleCaseBusinessText(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_:./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatHarthmereBusinessPlayerWarning(
  rawWarning: string | undefined
): string {
  const warning = String(rawWarning ?? "").trim();
  if (!warning) return "Something needs attention.";
  const capacityMessage = harthmerePlayerCapacityMessage(warning);
  if (capacityMessage) return capacityMessage;
  if (warning.includes("insufficient_customer_gold_for_sale")) {
    return "You do not have enough gold for that purchase.";
  }
  if (warning.includes("business_not_open")) {
    return "This shop is currently closed.";
  }
  if (warning.includes("business_not_found")) {
    return "This shop is no longer available.";
  }
  if (warning.includes("sale_inventory_insufficient")) {
    return "The shop does not have enough of that item in stock.";
  }
  if (warning.includes("business_tool_already_owned")) {
    return "You already own this tool.";
  }
  if (warning.includes("business_tool_not_available")) {
    return "This shop does not currently sell a tool.";
  }
  if (warning.includes("business_tool_listing_mismatch")) {
    return "That tool listing changed. Reopen the shop and try again.";
  }
  if (warning.includes("business_tool_single_purchase_only")) {
    return "Tools are sold one at a time.";
  }
  if (warning.includes("business_permission_required")) {
    return "You do not have permission to manage that part of the business.";
  }
  if (warning.includes("item_not_in_storefront")) {
    return "That item is no longer sold by this shop.";
  }
  if (warning.includes("item_not_purchasable")) {
    return "That item is temporarily unavailable. Your gold and the listing were left unchanged.";
  }
  if (warning.includes("recipe_book_already_learned")) {
    return "You already know every recipe in that book.";
  }
  if (warning.includes("recipe_book_single_purchase_only")) {
    return "Recipe books are purchased one at a time.";
  }
  if (warning.includes("business_economy_mutation_http_"))
    return "The business service could not be reached. Try again in a moment.";
  if (warning.includes("native_ecs_materialization"))
    return "The world is still synchronizing this business. Wait a moment and try again.";
  if (warning.includes("business_item_required:")) {
    const item = warning.split(":").pop() ?? "stock";
    return `Stock is missing ${titleCaseBusinessText(item)}.`;
  }
  if (warning.includes("business_customer_session_already_active"))
    return "A customer shift is already running at this business. Wait for it to finish before starting yours.";
  if (warning.includes("business_customer_session_expired"))
    return "That customer shift has ended. Start a new shift from the business board.";
  if (warning.includes("business_customer_session_not_active"))
    return "That customer shift has ended. Start a new shift from the business board.";
  if (warning.includes("business_customer_session_not_owned"))
    return "That customer shift belongs to another player. Start your own shift from the business board.";
  if (warning.includes("business_staff_side_required"))
    return "Stand behind the service counter before helping the next customer.";
  if (
    warning.includes("business_proximity_required") ||
    warning.includes("business_proximity_unverified")
  )
    return "Move closer to this business's service area and try again.";
  if (warning.includes("business_interaction_marker_missing"))
    return "This business counter is not ready right now. Try again in a moment.";
  if (warning.includes("business_customer_left_waiting"))
    return "A customer left after waiting too long.";
  if (warning.includes("business_customer_not_at_counter"))
    return "The customer is still walking to the counter.";
  if (warning.includes("business_customer_ticket_not_current"))
    return "That customer is no longer at the front of the line.";
  if (warning.includes("business_customer_offer_not_found"))
    return "That service choice is no longer available. Talk to the customer again.";
  if (warning.includes("business_customer_minigame_action_invalid"))
    return "That choice does not fit what this customer asked for. Read their request and try another service.";
  if (warning.includes("business_customer_minigame_missing"))
    return "This customer interaction is not ready. Close the conversation and try again.";
  if (warning.includes("business_customer_item_not_in_catalog"))
    return "This service item is not available at the counter right now.";
  if (warning.includes("business_branch_requires_tier_3"))
    return "Serve more customers before opening a branch.";
  if (warning.includes("business_branch_funds_insufficient"))
    return "The business needs more funds before opening that branch.";
  if (warning.includes("business_branch_outpost_already_claimed"))
    return "That branch site is already claimed.";
  if (warning.includes("active_business_branch_required"))
    return "Choose an active branch first.";
  if (warning.includes("employee_morale"))
    return "A worker needs rest before service quality drops.";
  if (warning.includes("employee_resigned"))
    return "A worker resigned after morale stayed too low.";
  if (
    warning.includes("business_economy_state_http_") ||
    warning.includes("business_economy_mutation_not_confirmed")
  )
    return "The business service could not be reached. Try again in a moment.";
  if (warning.includes("native_ecs_authority_required"))
    return "The world is still synchronizing this business. Wait a moment and try again.";
  const alreadyReadable =
    /\s/.test(warning) && !/[_:]/.test(warning) && !/[a-z][A-Z]/.test(warning);
  if (alreadyReadable) {
    return /[.!?]$/.test(warning) ? warning : `${warning}.`;
  }
  const cleaned =
    warning
      .replace(/^economy_(rejected|warning):/g, "")
      .replace(/^jobs_board_rejected:/g, "")
      .split(":")
      .filter(Boolean)
      .pop() ?? warning;
  const readable = titleCaseBusinessText(cleaned);
  return readable.endsWith(".") ? readable : `${readable}.`;
}

function normalizeSystems(raw: unknown): HarthmereBusinessSystemsSnapshot {
  const r = jsonRecord(raw);
  return {
    permissions: jsonRecord(r.permissions) as any,
    bankAccounts: jsonRecord(r.bankAccounts) as any,
    propertyIntegrations: jsonRecord(r.propertyIntegrations) as any,
    biomeAnchors: jsonRecord(r.biomeAnchors) as any,
    threats: jsonRecord(r.threats) as any,
    portalEndpoints: jsonRecord(r.portalEndpoints) as any,
    teleportPads: jsonRecord(r.teleportPads) as any,
    cropNodes: jsonRecord(r.cropNodes) as any,
    animalPopulations: jsonRecord(r.animalPopulations) as any,
    contaminationSites: jsonRecord(r.contaminationSites) as any,
    patients: jsonRecord(r.patients) as any,
    durableItems: jsonRecord(r.durableItems) as any,
    explorationRoutes: jsonRecord(r.explorationRoutes) as any,
    deliveries: jsonRecord(r.deliveries) as any,
    hospitality: jsonRecord(r.hospitality) as any,
    menuByBusiness: jsonRecord(r.menuByBusiness) as any,
    unstableMagicItems: jsonRecord(r.unstableMagicItems) as any,
    serviceQuests: jsonRecord(r.serviceQuests) as any,
    customerSessions: jsonRecord(r.customerSessions) as any,
    customerStats: Object.fromEntries(
      Object.entries(jsonRecord(r.customerStats)).map(([businessId, stats]) => [
        businessId,
        normalizeHarthmereBusinessCustomerStats(stats, businessId),
      ])
    ) as any,
    outpostBuildings: jsonRecord(r.outpostBuildings) as any,
    empireBranches: jsonRecord(r.empireBranches) as any,
    branchDashboards: jsonRecord(r.branchDashboards) as any,
    automationAssignments: jsonRecord(r.automationAssignments) as any,
    employeeCandidates: jsonRecord(r.employeeCandidates) as any,
    employeeTaskRuns: jsonRecord(r.employeeTaskRuns) as any,
    balanceReports: Array.isArray(r.balanceReports) ? r.balanceReports : [],
  };
}

export function normalizeHarthmereBusinessEconomySnapshot(
  raw: any
): HarthmereBusinessEconomySnapshot {
  const snapshot = jsonRecord(raw);
  const businesses = jsonRecord(snapshot.businesses) as Record<
    string,
    HarthmereBusinessRecord
  >;
  const actorId = String(snapshot.actorId ?? "");
  const myBusinesses = Array.isArray(snapshot.myBusinesses)
    ? snapshot.myBusinesses
    : Object.values(businesses).filter(
        (business) =>
          business.ownerKind === "player" && business.ownerId === actorId
      );
  return {
    version:
      typeof snapshot.version === "string" ? snapshot.version : undefined,
    actorId,
    actorKnownRecipes: Array.isArray(snapshot.actorKnownRecipes)
      ? snapshot.actorKnownRecipes.filter(
          (entry): entry is string => typeof entry === "string"
        )
      : [],
    businessTypes: jsonRecord(snapshot.businessTypes) as any,
    recipeCatalog: jsonRecord(snapshot.recipeCatalog),
    businesses,
    myBusinesses,
    openContracts: Array.isArray(snapshot.openContracts)
      ? snapshot.openContracts
      : [],
    activeContracts: Array.isArray(snapshot.activeContracts)
      ? snapshot.activeContracts
      : [],
    customerContracts: Array.isArray(snapshot.customerContracts)
      ? snapshot.customerContracts
      : undefined,
    employees: jsonRecord(snapshot.employees) as any,
    loans: jsonRecord(snapshot.loans),
    insurancePolicies: jsonRecord(snapshot.insurancePolicies),
    tradeRoutes: jsonRecord(snapshot.tradeRoutes),
    failures: jsonRecord(snapshot.failures),
    marketOrders: jsonRecord(snapshot.marketOrders),
    towns: jsonRecord(snapshot.towns),
    regions: jsonRecord(snapshot.regions),
    businessSystems: normalizeSystems(snapshot.businessSystems),
    balanceWarnings: Array.isArray(snapshot.balanceWarnings)
      ? snapshot.balanceWarnings
      : [],
    ledger: Array.isArray(snapshot.ledger) ? snapshot.ledger : [],
  };
}

export async function fetchHarthmereBusinessEconomyState(
  fetchImpl: typeof fetch = fetch
): Promise<HarthmereBusinessEconomySnapshot> {
  const response = await fetchHarthmereLiveWithTimeout(
    fetchImpl,
    "/api/harthmere/live_mode_economy_state",
    {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    }
  );
  if (!response.ok) {
    throw new Error(
      formatHarthmereBusinessPlayerWarning(
        `business_economy_state_http_${response.status}`
      )
    );
  }
  const body = await response.json();
  return normalizeHarthmereBusinessEconomySnapshot(body.economyState ?? body);
}

export async function submitHarthmereBusinessEconomyMutation(
  operation: string,
  payload: Record<string, unknown>,
  options: {
    fetchImpl?: typeof fetch;
    requestId?: string;
    zoneId?: string;
    timeoutMs?: number;
  } = {}
): Promise<HarthmereBusinessInterfaceResponse> {
  const requestId =
    options.requestId ??
    `business_ui_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const backgroundTick = operation === "tick_business_customer_session";
  const timeoutMs =
    options.timeoutMs ??
    (backgroundTick
      ? HARTHMERE_BUSINESS_BACKGROUND_TICK_TIMEOUT_MS
      : operation === "serve_business_customer"
        ? HARTHMERE_BUSINESS_PLAYER_SERVICE_TIMEOUT_MS
        : HARTHMERE_BUSINESS_DEFAULT_MUTATION_TIMEOUT_MS);
  // Background reconciliation must never own the foreground action queue. A
  // production tick remained unsent for 30 seconds and stranded the player's
  // service selection on "Working…" behind it. HarthmereBusinessShiftHUD
  // already permits only one tick in flight, while the server actor lock keeps
  // the two bounded request classes authoritative.
  const queueScope = backgroundTick
    ? "business-economy-background"
    : "business-economy";
  return runHarthmereLiveMutationSerially(queueScope, async () => {
    const fetchImpl = options.fetchImpl ?? fetch;
    const controller =
      typeof AbortController === "undefined"
        ? undefined
        : new AbortController();
    const timeout = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;
    let response: Response;
    try {
      response = await fetchHarthmereLiveWithTimeout(
        fetchImpl,
        "/api/harthmere/live_mode",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            requestId,
            idempotencyKey: requestId,
            actionKind: "request_economy_mutation",
            subsystem: "economy",
            clientSentAtMs: Date.now(),
            actorEntityVersion: 1,
            zoneId: options.zoneId ?? "the_grove",
            payload: { operation, ...payload },
            includeSnapshots: [
              "economyState",
              "inventoryLootState",
              "playerStatusState",
            ],
          }),
          // A caller-owned signal makes this one bounded attempt instead of
          // three long retries. The stable request/idempotency key still makes
          // a deliberate player retry safe after a readable timeout message.
          ...(controller ? { signal: controller.signal } : { timeoutMs }),
        }
      );
    } catch (error) {
      if (controller?.signal.aborted) {
        throw new Error(
          formatHarthmereBusinessPlayerWarning(
            "business_economy_mutation_http_504"
          )
        );
      }
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
    if (!response.ok) {
      throw new Error(
        formatHarthmereBusinessPlayerWarning(
          `business_economy_mutation_http_${response.status}`
        )
      );
    }
    const body = await response.json();
    const warnings: string[] =
      body.backendMutation?.warnings ?? body.warnings ?? [];
    const rejection = warnings.find((warning) =>
      String(warning).includes("economy_rejected:")
    );
    if (rejection) {
      throw new Error(formatHarthmereBusinessPlayerWarning(rejection));
    }
    const validationError = body.validation?.errors?.[0];
    if (body.ok === false || validationError) {
      throw new Error(
        formatHarthmereBusinessPlayerWarning(
          String(validationError ?? "business_economy_mutation_not_confirmed")
        )
      );
    }
    const nativeMaterializationFailure = warnings.find((warning) =>
      String(warning).includes("native_ecs_materialization_deferred:")
    );
    if (nativeMaterializationFailure) {
      throw new Error(
        formatHarthmereBusinessPlayerWarning(
          String(nativeMaterializationFailure)
        )
      );
    }
    return body;
  });
}

export const HARTHMERE_BUSINESS_BACKGROUND_TICK_TIMEOUT_MS = 5_000;
export const HARTHMERE_BUSINESS_PLAYER_SERVICE_TIMEOUT_MS = 8_000;
export const HARTHMERE_BUSINESS_DEFAULT_MUTATION_TIMEOUT_MS = 30_000;

export function isHarthmereBusinessInterfaceAvailable(
  state: HarthmereBusinessEconomySnapshot | undefined,
  nearbyBusinessId?: string | null
): boolean {
  if (!state || !nearbyBusinessId) return false;
  const business = state.businesses[nearbyBusinessId];
  if (!business) return false;
  const mode = getHarthmereBusinessActorMode(state, nearbyBusinessId);
  return mode === "owner" || canCustomerUseHarthmereBusiness(business);
}

export function getHarthmereBusinessActorMode(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string
): HarthmereBusinessActorMode {
  const business = state.businesses[businessId];
  const permissions =
    (state.businessSystems.permissions ?? {})[businessId]?.[state.actorId] ??
    [];
  if (!business) return "customer";
  if (business.ownerKind === "player" && business.ownerId === state.actorId)
    return "owner";
  if (permissions.includes("owner_admin") || permissions.length > 0)
    return "owner";
  return "customer";
}

export function canCustomerUseHarthmereBusiness(
  business: HarthmereBusinessRecord | undefined
): boolean {
  return business?.status === "open";
}

export function harthmereBusinessItemDisplayName(
  itemId: string,
  fallback?: string
): string {
  const nativeText = itemId.replace(/^b:/, "");
  const semanticItemId = /^\d+$/.test(nativeText)
    ? (harthmereNativeItemIdForBiomesId(Number(nativeText)) ?? itemId)
    : itemId;
  const generatedFallback = /^(?:b:)?\d+$/.test(semanticItemId)
    ? "Unknown Item"
    : titleCaseBusinessText(semanticItemId);
  return (
    getHarthmereItemDefinition(semanticItemId)?.displayName ??
    HARTHMERE_FOOD_DEFINITIONS[semanticItemId]?.displayName ??
    HARTHMERE_SEED_DEFINITIONS[semanticItemId]?.displayName ??
    HARTHMERE_MEDICAL_ITEM_DEFINITIONS[semanticItemId]?.displayName ??
    getHarthmereBusinessServiceItemDefinition(semanticItemId)?.displayName ??
    (fallback ? titleCaseBusinessText(fallback) : generatedFallback)
  );
}

export function isHarthmereBusinessInventoryItemPurchasable(
  itemId: string
): boolean {
  return harthmereNativeBiomesIdForItemId(itemId) !== undefined;
}

function harthmereBusinessItemKindHint(
  itemId: string,
  fallback?: string
): string | undefined {
  if (getHarthmereItemDefinition(itemId)?.category) {
    return getHarthmereItemDefinition(itemId)?.category;
  }
  if (HARTHMERE_FOOD_DEFINITIONS[itemId]) return "food";
  if (HARTHMERE_SEED_DEFINITIONS[itemId]) return "seed";
  if (HARTHMERE_MEDICAL_ITEM_DEFINITIONS[itemId]) return "medical utility";
  return fallback;
}

export function getHarthmereBusinessItemVisual(
  itemId: string,
  fallbackLabel?: string,
  kindHint?: string
): HarthmereResolvedBikkieVisual | undefined {
  const definition = getHarthmereItemDefinition(itemId);
  const displayName = harthmereBusinessItemDisplayName(itemId, fallbackLabel);
  if (!definition && !displayName) return undefined;
  return harthmereResolveBikkieVisual({
    id: itemId,
    bikkieId: harthmereNativeBiomesIdForItemId(itemId),
    label: displayName,
    kind:
      definition?.category ?? harthmereBusinessItemKindHint(itemId, kindHint),
    description: definition?.description,
    objectMetadata: definition?.objectMetadata,
  });
}

function itemPrice(
  state: HarthmereBusinessEconomySnapshot,
  business: HarthmereBusinessRecord,
  itemId: string
): number {
  const region = business.regionId
    ? state.regions[business.regionId]
    : undefined;
  const base = Number(region?.priceIndex?.[itemId] ?? 10);
  const modifier = Number(business.priceModifiers?.[itemId] ?? 1);
  return Math.max(1, Math.round(base * modifier));
}

export function harthmereBusinessServicePriceGold(
  action: HarthmereBusinessServiceAction
): number {
  const explicit = Number(action.priceGold);
  if (Number.isFinite(explicit) && explicit > 0) {
    return Math.max(1, Math.round(explicit));
  }
  const reward = Number(action.rewardGold ?? action.defaultPayload?.rewardGold);
  if (Number.isFinite(reward) && reward > 0) {
    return Math.max(1, Math.round(reward));
  }
  const operationCost = Number(action.defaultPayload?.amountGold);
  if (Number.isFinite(operationCost) && operationCost > 0) {
    return Math.max(1, Math.round(operationCost));
  }
  return 15;
}

export function getHarthmereVisibleBusinessInventory(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string,
  purchasableOnly = false
): HarthmereBusinessVisibleInventoryItem[] {
  const business = state.businesses[businessId];
  if (!business) return [];
  return Object.values(business.inventory ?? {})
    .filter(
      (stack) =>
        stack.count > 0 &&
        (!purchasableOnly ||
          isHarthmereBusinessInventoryItemPurchasable(stack.itemId))
    )
    .map((stack) => ({
      ...stack,
      displayName: harthmereBusinessItemDisplayName(stack.itemId),
      priceGold: itemPrice(state, business, stack.itemId),
      visual: getHarthmereBusinessItemVisual(stack.itemId),
    }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
}

export function getHarthmereBusinessBankAccount(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string
): HarthmereBusinessBankAccount | undefined {
  return Object.values(state.businessSystems.bankAccounts ?? {}).find(
    (account) => account.businessId === businessId
  );
}

export function getHarthmereBusinessMoneySummary(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string
): HarthmereBusinessMoneySummary {
  const business = state.businesses[businessId];
  const bank = getHarthmereBusinessBankAccount(state, businessId);
  return {
    balanceGold: business?.balanceGold ?? 0,
    bankBalanceGold: bank?.balanceGold ?? 0,
    debtGold: business?.debtGold ?? 0,
    dailyUpkeepGold: business?.upkeepGoldPerDay ?? 0,
    dailyRentGold: business?.rentGoldPerDay ?? 0,
    dailyWagesGold: business?.wageGoldPerDay ?? 0,
    salesTaxRate: business?.salesTaxRate ?? 0,
  };
}

export function getHarthmereBusinessContracts(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string
): HarthmereBusinessContract[] {
  const fromOpen = state.openContracts.filter(
    (contract) =>
      contract.acceptedByBusinessId === businessId ||
      contract.businessType === state.businesses[businessId]?.typeId
  );
  const fromActive = state.activeContracts.filter(
    (contract) => contract.acceptedByBusinessId === businessId
  );
  const seen = new Set<string>();
  return [...fromActive, ...fromOpen].filter((contract) => {
    if (seen.has(contract.contractId)) return false;
    seen.add(contract.contractId);
    return true;
  });
}

export function getHarthmereCustomerOrders(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string
): HarthmereBusinessContract[] {
  const businessType = state.businesses[businessId]?.typeId;
  const all = [
    ...(state.customerContracts ?? []),
    ...state.openContracts,
    ...state.activeContracts,
  ];
  const seen = new Set<string>();
  return all.filter((contract) => {
    if (seen.has(contract.contractId)) return false;
    seen.add(contract.contractId);
    return (
      contract.issuerKind === "player" &&
      contract.issuerId === state.actorId &&
      (!contract.businessType ||
        contract.businessType === businessType ||
        contract.acceptedByBusinessId === businessId)
    );
  });
}

export function getHarthmereBusinessTodos(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string
): HarthmereBusinessTodo[] {
  const business = state.businesses[businessId];
  if (!business) return [];
  const todos: HarthmereBusinessTodo[] = [];
  if (business.status !== "open")
    todos.push({
      id: "open_business",
      severity: "warning",
      label: "Open business",
      description:
        "This business is not open yet. Add property, license, and open it before customers can use it.",
    });
  if (!getHarthmereBusinessBankAccount(state, businessId))
    todos.push({
      id: "bank_account",
      severity: "info",
      label: "Create bank account",
      description:
        "Create a business bank account for safe deposits, withdrawals, logs, and permissions.",
    });
  if (
    business.balanceGold <
    business.upkeepGoldPerDay + business.wageGoldPerDay
  )
    todos.push({
      id: "funds_low",
      severity: "danger",
      label: "Funds low",
      description: "Business funds are below one day of upkeep and wages.",
    });
  if (business.sanitationRating < 45)
    todos.push({
      id: "sanitation_low",
      severity: "warning",
      label: "Sanitation risk",
      description:
        "Low sanitation can reduce satisfaction and trigger failures.",
    });
  if (business.safetyRating < 45)
    todos.push({
      id: "safety_low",
      severity: "warning",
      label: "Safety risk",
      description: "Low safety can reduce customers and create emergency work.",
    });
  if (
    getHarthmereBusinessContracts(state, businessId).some(
      (contract) => contract.status === "active"
    )
  )
    todos.push({
      id: "active_orders",
      severity: "info",
      label: "Fulfill active orders",
      description:
        "Accepted orders are waiting for delivery or service completion.",
    });
  return todos;
}

export function getHarthmereBusinessServiceActions(
  typeId: HarthmereBusinessTypeId,
  mode: HarthmereBusinessActorMode
): HarthmereBusinessServiceAction[] {
  const actions = (HARTHMERE_BUSINESS_SERVICE_ACTIONS[typeId] ?? []).filter(
    (action) => action.audience === mode || action.audience === "both"
  );
  return mode === "customer"
    ? actions.map((action) => ({
        ...action,
        priceGold: harthmereBusinessServicePriceGold(action),
      }))
    : actions;
}

export interface HarthmereBusinessWorldContext {
  nearbyBusinessId?: string | null;
  insideBusiness?: boolean;
  insideTownHall?: boolean;
  insideMarketplace?: boolean;
  actorGuildId?: string;
  interactionKeyLabel?: string;
  outpostId?: string;
  businessInteractionMarkerId?: string;
  businessInteractionPosition?: HarthmereBusinessWorldPoint;
}

export interface HarthmereBusinessWorldPoint {
  x: number;
  y?: number;
  z: number;
}

export function nearestHarthmereBusinessDashboardWorldContext(
  state: HarthmereBusinessEconomySnapshot | undefined,
  playerPosition: HarthmereBusinessWorldPoint | undefined,
  radius = 4.25
): HarthmereBusinessWorldContext {
  if (!state || !playerPosition) return {};
  let nearest:
    | {
        businessId: string;
        outpostId: string;
        distance: number;
        markerId?: string;
        point: HarthmereBusinessWorldPoint;
      }
    | undefined;
  for (const record of Object.values(
    state.businessSystems.outpostBuildings ?? {}
  )) {
    const point =
      record.dashboardAccessPoint?.position ?? record.serviceCounter;
    if (!point) continue;
    const dx = playerPosition.x - point.x;
    const dy = (playerPosition.y ?? point.y) - point.y;
    const dz = playerPosition.z - point.z;
    const horizontal = Math.hypot(dx, dz);
    if (horizontal > radius || Math.abs(dy) > 5) continue;
    const distance = Math.hypot(dx, dy, dz);
    if (nearest && nearest.distance <= distance) continue;
    const businessId = harthmereBusinessOutpostBusinessId(record.outpostId);
    if (!state.businesses[businessId]) continue;
    nearest = {
      businessId,
      outpostId: record.outpostId,
      distance,
      markerId: record.dashboardAccessPoint?.markerId,
      point,
    };
  }
  if (!nearest) return {};
  return {
    nearbyBusinessId: nearest.businessId,
    insideBusiness: true,
    interactionKeyLabel: "F",
    outpostId: nearest.outpostId,
    businessInteractionMarkerId: nearest.markerId,
    businessInteractionPosition: nearest.point,
  };
}

export function harthmereBusinessWorldContextPayload(
  context: HarthmereBusinessWorldContext | undefined
): Record<string, unknown> {
  if (!context?.nearbyBusinessId) return {};
  const point = context.businessInteractionPosition;
  return {
    interactionBusinessId: context.nearbyBusinessId,
    targetBusinessId: context.nearbyBusinessId,
    ...(context.outpostId ? { outpostId: context.outpostId } : {}),
    ...(context.businessInteractionMarkerId
      ? { businessInteractionMarkerId: context.businessInteractionMarkerId }
      : {}),
    ...(point
      ? {
          businessInteractionPosition: {
            x: point.x,
            y: point.y ?? 0,
            z: point.z,
          },
        }
      : {}),
  };
}

export interface HarthmereBusinessInteractionPromptModel {
  visible: boolean;
  businessId?: string;
  mode?: HarthmereBusinessActorMode;
  label: string;
  helper: string;
  keyLabel: string;
}

export interface HarthmereBusinessDashboard {
  title: string;
  metrics: Array<{ id: string; label: string; value: string; hint: string }>;
  todos: HarthmereBusinessTodo[];
  criticalCount: number;
}

export interface HarthmereBusinessGrowthReport {
  businessId: string;
  typeId: HarthmereBusinessTypeId;
  earnedToday: string;
  costsToday: string;
  completedToday: string;
  failedOrDecayed: string;
  expiringSoon: string;
  bottleneck: string;
  nextUpgrade: string;
  activeWork: string;
  inventoryFocus: string;
  reputationFocus: string;
  rewardLayers: string[];
}

export interface HarthmereBusinessShopfront {
  businessId: string;
  businessType?: string;
  inventory: HarthmereBusinessVisibleInventoryItem[];
  acceptsCustomOrders: boolean;
  emptyLabel: string;
  // HARTHMERE_BUSINESS_TOOL_SHOP: the one tool this business sells to the
  // player (each of the 19 businesses sells a distinct tool). The panel shows a
  // "Buy" button for it; the purchase deposits the tool into the player's
  // inventory so a tool-gated job's redirect leads to a real purchase.
  toolForSale?: {
    toolItemId: string;
    toolName: string;
    priceGold: number;
    visual?: HarthmereResolvedBikkieVisual;
  };
  // HARTHMERE_BUSINESS_STOREFRONT_GOODS: the business's themed building
  // materials + interior furnishings (5 blocks + 4 interior items), in addition
  // to its normal inventory + tool. Unlimited supply — bought via the server
  // buy_storefront_good economy op (no business-inventory deduction).
  storefrontGoods?: Array<{
    itemId: string;
    displayName?: string;
    kind: "block" | "interior" | "material" | "recipe_book" | "weapon";
    priceGold: number;
    recipeIds?: readonly string[];
    learned?: boolean;
    visual?: HarthmereResolvedBikkieVisual;
  }>;
}

export interface HarthmereBusinessContractBoard {
  open: HarthmereBusinessContract[];
  active: HarthmereBusinessContract[];
  fulfilled: HarthmereBusinessContract[];
  customer: HarthmereBusinessContract[];
}

export interface HarthmereBusinessFinancePanel {
  summary: HarthmereBusinessMoneySummary;
  account?: HarthmereBusinessBankAccount;
  loans: any[];
  insurancePolicies: any[];
  audit: Array<{
    auditId?: string;
    atMs: number;
    actorId: string;
    kind: string;
    amountGold?: number;
    reason?: string;
  }>;
}

export interface HarthmereBusinessStaffPanel {
  employees: HarthmereBusinessEmployee[];
  candidates: HarthmereBusinessEmployeeCandidate[];
  recentTaskRuns: HarthmereBusinessEmployeeTaskRun[];
  canHire: boolean;
  payrollDueGold: number;
  moraleWarnings: HarthmereBusinessEmployee[];
}

export interface HarthmereBusinessCompliancePanel {
  licenseClass: string;
  licenseLevel: number;
  requiredLicense?: string;
  minimumLicenseLevel?: number;
  sanitationRating: number;
  safetyRating: number;
  warnings: string[];
}

export interface HarthmereBusinessOperationScreen {
  businessId: string;
  typeId: HarthmereBusinessTypeId;
  title: string;
  ownerActions: HarthmereBusinessServiceAction[];
  customerActions: HarthmereBusinessServiceAction[];
  systemRecords: Record<string, any[]>;
}

export interface HarthmereBusinessCustomerMiniGamePanel {
  businessId: string;
  typeId: HarthmereBusinessTypeId;
  definition: HarthmereBusinessMiniGameDefinition;
  bikkieGraphics: readonly HarthmereBusinessBikkieGraphic[];
  customerPool: readonly HarthmereBusinessCustomerNpc[];
  stats: HarthmereBusinessCustomerStats;
  activeSession?: HarthmereBusinessCustomerSession;
  currentTicket?: HarthmereBusinessCustomerTicket;
  currentNpc?: HarthmereBusinessCustomerNpc;
  offers: readonly HarthmereBusinessServiceOffer[];
  progressPath: string[];
  dailyReturnTriggers: string[];
  challengeGrowth: string[];
  empireReinforcement: string[];
  gapsClosed: string[];
}

export interface HarthmereBusinessEmpirePanel {
  businessId: string;
  branches: HarthmereBusinessBranch[];
  dashboards: HarthmereBusinessBranchDashboard[];
  automations: HarthmereBusinessAutomation[];
  outpostBuildings: HarthmereBusinessOutpostProceduralBuildingRecord[];
  dailyRevenueGold: number;
  dailyUpkeepGold: number;
  lifetimeProfitGold: number;
  openBranchEligible: boolean;
  warnings: string[];
}

export interface HarthmereBusinessTownHallPanel {
  towns: any[];
  publicContracts: HarthmereBusinessContract[];
  townBusinesses: HarthmereBusinessRecord[];
}

export interface HarthmereBusinessMarketplacePanel {
  openOrders: any[];
  regionalPrices: Record<string, number>;
  marketWarnings: string[];
}

export interface HarthmereBusinessGuildPanel {
  guildBusinesses: HarthmereBusinessRecord[];
  guildContracts: HarthmereBusinessContract[];
  permissions: Record<string, string[]>;
}

export interface HarthmereBusinessServiceQuest {
  questId: string;
  contractId: string;
  businessId: string;
  acceptedByActorId: string;
  title: string;
  todoText: string;
  status: "active" | "completed" | "failed" | "cancelled";
  serviceKind: string;
  targetId?: string;
  townId?: string;
  regionId: string;
  mapMarkerId?: string;
  questBoardTodo: boolean;
  createdAtMs: number;
  acceptedAtMs: number;
  dueAtMs: number;
}

const FIELD_SERVICE_ACTION_IDS = new Set([
  "inspect_biome",
  "request_redesign",
  "hire_guard",
  "request_repair",
  "request_ward",
  "book_expedition",
  "request_build",
  "request_care",
  "request_cleanup",
  "request_maintenance",
  "request_delivery",
  "book_room",
]);

const FIELD_SERVICE_NEEDS = new Set([
  "maintenance",
  "safety",
  "health",
  "sanitation",
  "logistics",
  "housing",
  "identity",
  "knowledge",
  "property_condition",
]);

export function requiresHarthmereFieldServiceQuest(
  action: HarthmereBusinessServiceAction
): boolean {
  if (action.requiresWorldService === true) return true;
  if (FIELD_SERVICE_ACTION_IDS.has(action.actionId)) return true;
  if (action.serviceNeed && FIELD_SERVICE_NEEDS.has(action.serviceNeed))
    return true;
  return false;
}

export function getHarthmereBusinessFieldServiceSpec(
  business: HarthmereBusinessRecord,
  action: HarthmereBusinessServiceAction,
  overrides: Record<string, unknown> = {}
) {
  if (
    !requiresHarthmereFieldServiceQuest(action) &&
    overrides.fieldService !== true
  )
    return undefined;
  const serviceKind = String(
    overrides.serviceKind ??
      action.fieldServiceKind ??
      action.serviceNeed ??
      action.actionId
  );
  const targetId = String(
    overrides.targetId ??
      action.defaultTargetId ??
      business.propertyId ??
      business.townId ??
      business.businessId
  );
  return {
    required: true,
    serviceKind,
    targetId,
    mapMarkerId: String(overrides.mapMarkerId ?? targetId),
    questTitle: String(
      overrides.questTitle ?? `${business.name}: ${action.label}`
    ),
    todoText: String(
      overrides.todoText ?? `${action.label} for ${business.name}`
    ),
  };
}

export function getHarthmereBusinessInteractionPrompt(
  state: HarthmereBusinessEconomySnapshot | undefined,
  context: HarthmereBusinessWorldContext
): HarthmereBusinessInteractionPromptModel {
  const keyLabel = context.interactionKeyLabel ?? "F";
  if (
    !state ||
    !context.insideBusiness ||
    !context.nearbyBusinessId ||
    !state.businesses[context.nearbyBusinessId]
  ) {
    return { visible: false, label: "", helper: "", keyLabel };
  }
  const business = state.businesses[context.nearbyBusinessId];
  const mode = getHarthmereBusinessActorMode(state, business.businessId);
  if (mode === "customer" && !canCustomerUseHarthmereBusiness(business))
    return { visible: false, label: "", helper: "", keyLabel };
  return {
    visible: true,
    businessId: business.businessId,
    mode,
    keyLabel,
    label: `Press ${keyLabel} to use ${business.name} service counter`,
    helper:
      mode === "owner"
        ? "Start an in-world shift or manage this business"
        : "Buy goods or request a service at the real counter",
  };
}

function soonestContractLabel(contracts: HarthmereBusinessContract[]) {
  const active = contracts
    .filter(
      (contract) => contract.status === "active" || contract.status === "open"
    )
    .sort((a, b) => a.deadlineAtMs - b.deadlineAtMs)[0];
  if (!active) return "No order deadline is pressing right now.";
  return `${active.title} is due ${new Date(
    active.deadlineAtMs
  ).toLocaleDateString()}.`;
}

function requiredStockLabel(definition: HarthmereBusinessMiniGameDefinition) {
  const requiredItems = Array.from(
    new Set(
      definition.offers.flatMap((offer) => Object.keys(offer.requiredItems))
    )
  );
  if (!requiredItems.length) return "No service stock is required yet.";
  return requiredItems.slice(0, 4).map(titleCaseBusinessText).join(", ");
}

// HARTHMERE_BUSINESS_CLIENT_SESSION_EXPIRY_GUARD
// The backend stamps each customer session with an `expiresAtMs` and only
// treats a session as active when `status === "active" && expiresAtMs > now`
// (see activeCustomerSessionForBusiness in mmo_economy_business_systems.ts).
// The economy snapshot the server ships to the client keeps stale sessions
// verbatim (status still "active" with an elapsed expiresAtMs) until the next
// mutation flips them to "expired". If the client only checks `status` it will
// surface a dead session: the "Start Shift" button is disabled and every
// `serve_business_customer` call is rejected with
// `economy_rejected:business_customer_session_not_active`, which looks like the
// mini-game is stuck spinning on the current customer. Mirror the backend's
// time check here so the UI matches authoritative state.
export function activeHarthmereBusinessClientCustomerSession(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string,
  nowMs: number = Date.now()
): HarthmereBusinessCustomerSession | undefined {
  return Object.values(
    (state.businessSystems.customerSessions ?? {}) as Record<
      string,
      HarthmereBusinessCustomerSession
    >
  ).find(
    (session) =>
      session.businessId === businessId &&
      session.actorId === state.actorId &&
      session.status === "active" &&
      session.expiresAtMs > nowMs
  );
}

export function getHarthmereBusinessGrowthReport(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string
): HarthmereBusinessGrowthReport {
  const business = state.businesses[businessId];
  const typeId = business?.typeId ?? "general_trader";
  const definition = getHarthmereBusinessMiniGameDefinition(typeId);
  const stats = normalizeHarthmereBusinessCustomerStats(
    state.businessSystems.customerStats?.[businessId],
    businessId
  );
  const contracts = getHarthmereBusinessContracts(state, businessId);
  const activeOrders = contracts.filter(
    (contract) => contract.status === "active"
  ).length;
  const todos = getHarthmereBusinessTodos(state, businessId);
  const blockers = todos.filter((todo) => todo.severity !== "info");
  const nextUpgrade =
    definition.scalePath[
      Math.min(stats.currentTier, definition.scalePath.length - 1)
    ] ??
    definition.scalePath[definition.scalePath.length - 1] ??
    "Keep improving service quality.";
  const session = activeHarthmereBusinessClientCustomerSession(
    state,
    businessId
  );
  const activeWork = session
    ? `${
        session.queue.length -
        session.servedTicketIds.length -
        session.failedTicketIds.length
      } customers still need service.`
    : activeOrders > 0
      ? `${activeOrders} accepted order${
          activeOrders === 1 ? "" : "s"
        } need work.`
      : "No active queue is blocking the floor.";
  const missed = stats.totalFailed + (session?.failedTicketIds.length ?? 0);
  const warning =
    blockers[0]?.description ??
    definition.challengeGrowth[0] ??
    "Watch the next customer bottleneck.";
  return {
    businessId,
    typeId,
    earnedToday: `${business?.balanceGold ?? 0} gold available; ${
      stats.lifetimeGold
    } gold earned from customer service.`,
    costsToday: `${
      (business?.upkeepGoldPerDay ?? 0) +
      (business?.rentGoldPerDay ?? 0) +
      (business?.wageGoldPerDay ?? 0)
    } gold in daily upkeep, rent, and wages.`,
    completedToday: `${
      business?.completedContracts ?? 0
    } contracts completed; ${stats.totalServed} customers served.`,
    failedOrDecayed:
      missed > 0
        ? `${missed} missed customers or service failures need recovery.`
        : "No customer misses are recorded.",
    expiringSoon: soonestContractLabel(contracts),
    bottleneck: warning,
    nextUpgrade,
    activeWork,
    inventoryFocus: requiredStockLabel(definition),
    reputationFocus: `${
      business?.customerSatisfaction ?? 0
    }/100 satisfaction, ${business?.safetyRating ?? 0} safety, ${
      business?.sanitationRating ?? 0
    } sanitation.`,
    rewardLayers: [
      `Money: ${
        definition.dailyReturnTriggers[0] ??
        "Daily demand keeps revenue moving."
      }`,
      `Reputation: ${
        definition.challengeGrowth[0] ?? "Service quality changes trust."
      }`,
      `Capability: unlock ${nextUpgrade}.`,
      `Town impact: ${
        definition.empireReinforcement[0] ??
        "This business supports the local economy."
      }`,
    ],
  };
}

export function getHarthmereOwnerDashboard(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string
): HarthmereBusinessDashboard {
  const business = state.businesses[businessId];
  const money = getHarthmereBusinessMoneySummary(state, businessId);
  const todos = getHarthmereBusinessTodos(state, businessId);
  const activeOrders = getHarthmereBusinessContracts(state, businessId).filter(
    (contract) => contract.status === "active"
  ).length;
  return {
    title: `${business?.name ?? "Business"} Dashboard`,
    metrics: [
      {
        id: "balance",
        label: "Cash",
        value: `${money.balanceGold}`,
        hint: `Bank ${money.bankBalanceGold} · Debt ${money.debtGold}`,
      },
      {
        id: "orders",
        label: "Active Orders",
        value: `${activeOrders}`,
        hint: `${business?.completedContracts ?? 0} completed`,
      },
      {
        id: "ratings",
        label: "Ratings",
        value: `${business?.customerSatisfaction ?? 0}/100`,
        hint: `Safety ${business?.safetyRating ?? 0} · Sanitation ${
          business?.sanitationRating ?? 0
        }`,
      },
      {
        id: "upkeep",
        label: "Daily Costs",
        value: `${
          money.dailyUpkeepGold + money.dailyRentGold + money.dailyWagesGold
        }`,
        hint: "upkeep + rent + wages",
      },
    ],
    todos,
    criticalCount: todos.filter((todo) => todo.severity === "danger").length,
  };
}

export function getHarthmereBusinessShopfront(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string,
  mode: HarthmereBusinessActorMode = "customer"
): HarthmereBusinessShopfront {
  const business = state.businesses[businessId];
  if (
    !business ||
    (mode === "customer" && !canCustomerUseHarthmereBusiness(business))
  ) {
    return {
      businessId,
      inventory: [],
      acceptsCustomOrders: false,
      emptyLabel: "This business is not open to customers.",
    };
  }
  // Canonical NPC outpost inventory powers the customer-service mini-game; it
  // is not a public vendor catalogue. Showing it produced the `metal_part`
  // card from the production report and let customers deplete service inputs.
  // Player/guild/town businesses may still sell their managed inventory, but
  // only when the signed ECS purchase can grant the selected item.
  const inventory =
    mode === "customer" && business.flags.canonical_outpost_business
      ? []
      : getHarthmereVisibleBusinessInventory(
          state,
          businessId,
          mode === "customer"
        );
  const toolListing = harthmereBusinessToolForType(business.typeId);
  return {
    businessId,
    businessType: business.typeId,
    inventory,
    acceptsCustomOrders:
      mode === "customer" && canCustomerUseHarthmereBusiness(business),
    emptyLabel: inventory.length ? "" : "No public inventory is stocked yet.",
    toolForSale: toolListing
      ? {
          toolItemId: toolListing.toolItemId,
          toolName: toolListing.toolName,
          priceGold: toolListing.priceGold,
          visual: getHarthmereBusinessItemVisual(
            toolListing.toolItemId,
            toolListing.toolName,
            "tool"
          ),
        }
      : undefined,
    storefrontGoods:
      mode === "customer"
        ? harthmereBusinessStorefrontListingsForType(business.typeId).map(
            (listing) => ({
              itemId: listing.itemId,
              displayName: harthmereBusinessItemDisplayName(listing.itemId),
              kind: listing.kind,
              priceGold: listing.buyPrice,
              recipeIds: listing.recipeIds,
              learned:
                listing.kind === "recipe_book"
                  ? (listing.recipeIds ?? []).every((recipeId) =>
                      (state.actorKnownRecipes ?? []).includes(recipeId)
                    )
                  : undefined,
              visual: getHarthmereBusinessItemVisual(
                listing.itemId,
                undefined,
                listing.kind === "block"
                  ? "block"
                  : listing.kind === "recipe_book"
                    ? "document"
                    : listing.kind === "material"
                      ? "crafting material"
                      : listing.kind === "weapon"
                        ? "weapon"
                        : "furnishing"
              ),
            })
          )
        : undefined,
  };
}

export function getHarthmereContractBoard(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string
): HarthmereBusinessContractBoard {
  const byId: Record<string, HarthmereBusinessContract> = {};
  for (const contract of [
    ...(state.openContracts ?? []),
    ...(state.activeContracts ?? []),
    ...(state.customerContracts ?? []),
  ])
    byId[contract.contractId] = contract;
  const all = Object.values(byId);
  return {
    open: all.filter(
      (contract) =>
        contract.status === "open" &&
        (!contract.businessType ||
          contract.businessType === state.businesses[businessId]?.typeId)
    ),
    active: all.filter(
      (contract) =>
        contract.status === "active" &&
        contract.acceptedByBusinessId === businessId
    ),
    fulfilled: all.filter(
      (contract) =>
        contract.status === "fulfilled" &&
        contract.acceptedByBusinessId === businessId
    ),
    customer: getHarthmereCustomerOrders(state, businessId),
  };
}

export function getHarthmereBusinessFinancePanel(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string
): HarthmereBusinessFinancePanel {
  const account = getHarthmereBusinessBankAccount(state, businessId);
  return {
    summary: getHarthmereBusinessMoneySummary(state, businessId),
    account,
    loans: Object.values(state.loans ?? {}).filter(
      (loan: any) => loan.businessId === businessId
    ),
    insurancePolicies: Object.values(state.insurancePolicies ?? {}).filter(
      (policy: any) => policy.businessId === businessId
    ),
    audit: account?.audit ?? [],
  };
}

export function getHarthmereBusinessStaffPanel(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string
): HarthmereBusinessStaffPanel {
  const employees = Object.values(state.employees ?? {}).filter(
    (employee) => employee.businessId === businessId
  );
  const candidates = Object.values(
    state.businessSystems.employeeCandidates ?? {}
  )
    .filter(
      (candidate) =>
        candidate.businessId === businessId &&
        candidate.status !== "hired" &&
        candidate.status !== "withdrawn"
    )
    .sort((a, b) => a.generatedAtMs - b.generatedAtMs);
  const recentTaskRuns = Object.values(
    state.businessSystems.employeeTaskRuns ?? {}
  )
    .filter((run) => run.businessId === businessId)
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .slice(0, 6);
  return {
    employees,
    candidates,
    recentTaskRuns,
    canHire: getHarthmereBusinessActorMode(state, businessId) === "owner",
    payrollDueGold: employees.reduce(
      (sum, employee) => sum + employee.wageGoldPerDay,
      0
    ),
    moraleWarnings: employees.filter((employee) => employee.morale < 35),
  };
}

export function getHarthmereBusinessCompliancePanel(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string
): HarthmereBusinessCompliancePanel {
  const business = state.businesses[businessId];
  const type = business ? state.businessTypes[business.typeId] : undefined;
  const warnings: string[] = [];
  if (business && type && business.licenseLevel < type.minimumLicenseLevel)
    warnings.push("license_level_below_business_minimum");
  if (
    business?.sanitationRating !== undefined &&
    business.sanitationRating < 50
  )
    warnings.push("sanitation_inspection_risk");
  if (business?.safetyRating !== undefined && business.safetyRating < 50)
    warnings.push("safety_inspection_risk");
  return {
    licenseClass: business?.licenseClass ?? "unknown",
    licenseLevel: business?.licenseLevel ?? 0,
    requiredLicense: type?.requiredLicense,
    minimumLicenseLevel: type?.minimumLicenseLevel,
    sanitationRating: business?.sanitationRating ?? 0,
    safetyRating: business?.safetyRating ?? 0,
    warnings,
  };
}

function recordsForBusiness(
  source: Record<string, any> | undefined,
  businessId: string
): any[] {
  return Object.values(source ?? {}).filter(
    (entry: any) =>
      entry.businessId === businessId ||
      entry.courierBusinessId === businessId ||
      entry.ownerBusinessId === businessId
  );
}

export function getHarthmereBusinessOperationScreen(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string
): HarthmereBusinessOperationScreen {
  const business = state.businesses[businessId];
  const typeId = business?.typeId ?? "general_trader";
  const systems = state.businessSystems ?? {};
  return {
    businessId,
    typeId,
    title: state.businessTypes[typeId]?.displayName ?? typeId,
    ownerActions: getHarthmereBusinessServiceActions(typeId, "owner"),
    customerActions: canCustomerUseHarthmereBusiness(business)
      ? getHarthmereBusinessServiceActions(typeId, "customer")
      : [],
    systemRecords: {
      anchors: recordsForBusiness(systems.biomeAnchors as any, businessId),
      threats: recordsForBusiness(systems.threats as any, businessId),
      portals: recordsForBusiness(systems.portalEndpoints as any, businessId),
      teleports: recordsForBusiness(systems.teleportPads as any, businessId),
      crops: recordsForBusiness(systems.cropNodes as any, businessId),
      animals: recordsForBusiness(systems.animalPopulations as any, businessId),
      contamination: recordsForBusiness(
        systems.contaminationSites as any,
        businessId
      ),
      patients: recordsForBusiness(systems.patients as any, businessId),
      durableItems: recordsForBusiness(systems.durableItems as any, businessId),
      routes: recordsForBusiness(systems.explorationRoutes as any, businessId),
      deliveries: recordsForBusiness(systems.deliveries as any, businessId),
      hospitality: recordsForBusiness(systems.hospitality as any, businessId),
      serviceQuests: recordsForBusiness(
        (systems as any).serviceQuests,
        businessId
      ),
    },
  };
}

export function getHarthmereBusinessCustomerMiniGame(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string,
  nowMs: number = Date.now()
): HarthmereBusinessCustomerMiniGamePanel {
  const business = state.businesses[businessId];
  const typeId = business?.typeId ?? "general_trader";
  const definition = getHarthmereBusinessMiniGameDefinition(typeId as any);
  const activeSession = activeHarthmereBusinessClientCustomerSession(
    state,
    businessId,
    nowMs
  );
  const currentTicket = activeHarthmereBusinessCustomerTicket(activeSession);
  const currentNpc = findHarthmereBusinessCustomerNpc(currentTicket?.npcId);
  const stats = normalizeHarthmereBusinessCustomerStats(
    state.businessSystems.customerStats?.[businessId],
    businessId
  );
  return {
    businessId,
    typeId,
    definition,
    bikkieGraphics: definition.bikkieGraphics,
    customerPool: HARTHMERE_BUSINESS_CUSTOMER_NPCS.filter((npc) =>
      npc.businessPreferences.includes(typeId as any)
    ),
    stats,
    activeSession,
    currentTicket,
    currentNpc,
    offers: definition.offers,
    progressPath: definition.scalePath,
    dailyReturnTriggers: definition.dailyReturnTriggers,
    challengeGrowth: definition.challengeGrowth,
    empireReinforcement: definition.empireReinforcement,
    gapsClosed: definition.implementationGapsClosed,
  };
}

export function getHarthmereBusinessEmpirePanel(
  state: HarthmereBusinessEconomySnapshot,
  businessId: string
): HarthmereBusinessEmpirePanel {
  const business = state.businesses[businessId];
  const typeId = business?.typeId ?? "general_trader";
  const branches = Object.values(
    state.businessSystems.empireBranches ?? {}
  ).filter((branch) => branch.parentBusinessId === businessId);
  const dashboards = Object.values(
    state.businessSystems.branchDashboards ?? {}
  ).filter((dashboard) => dashboard.parentBusinessId === businessId);
  const automations = Object.values(
    state.businessSystems.automationAssignments ?? {}
  ).filter((automation) => automation.businessId === businessId);
  const outpostBuildings = Object.values(
    state.businessSystems.outpostBuildings ?? {}
  ).filter((building) => building.businessType === typeId);
  const stats = normalizeHarthmereBusinessCustomerStats(
    state.businessSystems.customerStats?.[businessId],
    businessId
  );
  const branchOpenCostGold = 600 + Math.max(3, stats.currentTier) * 150;
  const warnings: string[] = [];
  if (stats.currentTier < 3 && stats.totalServed < 50)
    warnings.push("Serve more customers to unlock branches.");
  if (!outpostBuildings.length)
    warnings.push(
      "No backend-generated outpost building is available for this business type."
    );
  if (business && business.balanceGold < branchOpenCostGold)
    warnings.push("Branch opening needs stronger business funds.");
  return {
    businessId,
    branches,
    dashboards,
    automations,
    outpostBuildings,
    dailyRevenueGold: branches.reduce(
      (sum, branch) => sum + branch.dailyRevenueGold,
      0
    ),
    dailyUpkeepGold:
      branches.reduce((sum, branch) => sum + branch.dailyUpkeepGold, 0) +
      automations.reduce(
        (sum, automation) => sum + automation.dailyUpkeepGold,
        0
      ),
    lifetimeProfitGold: branches.reduce(
      (sum, branch) => sum + branch.lifetimeProfitGold,
      0
    ),
    openBranchEligible: Boolean(
      business?.status === "open" &&
      outpostBuildings.length &&
      stats.currentTier >= 3 &&
      business.balanceGold >= branchOpenCostGold
    ),
    warnings,
  };
}

export function getHarthmereTownHallPanel(
  state: HarthmereBusinessEconomySnapshot
): HarthmereBusinessTownHallPanel {
  return {
    towns: Object.values(state.towns ?? {}),
    publicContracts: (state.openContracts ?? []).filter(
      (contract) => contract.issuerKind === "town" || Boolean(contract.townId)
    ),
    townBusinesses: Object.values(state.businesses ?? {}).filter(
      (business) => business.ownerKind === "town"
    ),
  };
}

export function getHarthmereMarketplacePanel(
  state: HarthmereBusinessEconomySnapshot
): HarthmereBusinessMarketplacePanel {
  const firstRegion = Object.values(state.regions ?? {})[0] as any;
  return {
    openOrders: Object.values(state.marketOrders ?? {}).filter(
      (order: any) => order.status === "open"
    ),
    regionalPrices: firstRegion?.priceIndex ?? {},
    marketWarnings: state.balanceWarnings ?? [],
  };
}

export function getHarthmereGuildBusinessPanel(
  state: HarthmereBusinessEconomySnapshot,
  guildId?: string
): HarthmereBusinessGuildPanel {
  const guildBusinesses = Object.values(state.businesses ?? {}).filter(
    (business) =>
      business.ownerKind === "guild" &&
      (!guildId || business.ownerId === guildId)
  );
  const guildBusinessIds = new Set(
    guildBusinesses.map((business) => business.businessId)
  );
  const permissions: Record<string, string[]> = {};
  for (const business of guildBusinesses) {
    permissions[business.businessId] = (
      (state.businessSystems?.permissions as any)?.[business.businessId]?.[
        state.actorId
      ] ?? []
    ).slice();
  }
  return {
    guildBusinesses,
    guildContracts: [
      ...(state.openContracts ?? []),
      ...(state.activeContracts ?? []),
    ].filter(
      (contract) =>
        guildBusinessIds.has(contract.acceptedByBusinessId ?? "") ||
        contract.issuerKind === "guild"
    ),
    permissions,
  };
}

export function getHarthmereBusinessServiceQuests(
  state: HarthmereBusinessEconomySnapshot,
  businessId?: string
): HarthmereBusinessServiceQuest[] {
  return Object.values(
    ((state.businessSystems as any)?.serviceQuests ?? {}) as Record<
      string,
      HarthmereBusinessServiceQuest
    >
  ).filter((quest) => !businessId || quest.businessId === businessId);
}

function serviceContractPayload(
  state: HarthmereBusinessEconomySnapshot,
  business: HarthmereBusinessRecord,
  action: HarthmereBusinessServiceAction,
  overrides: Record<string, unknown>
) {
  const priceGold = Number(
    overrides.priceGold ??
      overrides.amountGold ??
      overrides.rewardGold ??
      harthmereBusinessServicePriceGold(action)
  );
  const rewardGold = priceGold;
  return {
    ownerKind: "player",
    ownerId: state.actorId,
    interactionBusinessId: business.businessId,
    targetBusinessId: business.businessId,
    businessType: business.typeId,
    title: `${business.name}: ${action.label}`,
    rewardGold,
    townId: business.townId,
    regionId: business.regionId,
    amountGold: priceGold,
    priceGold,
    customerPriceGold: priceGold,
    deadlineAtMs: Number(
      overrides.deadlineAtMs ?? Date.now() + 7 * 24 * 60 * 60 * 1000
    ),
    requirements: overrides.requirements ?? [
      { serviceNeed: action.serviceNeed ?? "logistics", serviceUnits: 1 },
    ],
    fieldService: getHarthmereBusinessFieldServiceSpec(
      business,
      action,
      overrides
    ),
  };
}

export interface HarthmereBusinessInterfaceAdapter {
  isHydrated(): boolean;
  getState(): HarthmereBusinessEconomySnapshot | undefined;
  refresh(): Promise<void>;
  isAvailable(nearbyBusinessId?: string | null): boolean;
  getMode(businessId: string): HarthmereBusinessActorMode;
  getBusiness(businessId: string): HarthmereBusinessRecord | undefined;
  getBusinessType(
    businessId: string
  ): HarthmereBusinessTypeDefinition | undefined;
  getBikkieGraphics(
    businessId: string
  ): readonly HarthmereBusinessBikkieGraphic[];
  getInventory(businessId: string): HarthmereBusinessVisibleInventoryItem[];
  getMoneySummary(businessId: string): HarthmereBusinessMoneySummary;
  getEmployees(businessId: string): HarthmereBusinessEmployee[];
  getContracts(businessId: string): HarthmereBusinessContract[];
  getCustomerOrders(businessId: string): HarthmereBusinessContract[];
  getTodos(businessId: string): HarthmereBusinessTodo[];
  getServiceActions(
    businessId: string,
    mode?: HarthmereBusinessActorMode
  ): HarthmereBusinessServiceAction[];
  getInteractionPrompt(
    context: HarthmereBusinessWorldContext
  ): HarthmereBusinessInteractionPromptModel;
  getOwnerDashboard(businessId: string): HarthmereBusinessDashboard;
  getCheckInStatus(businessId: string): BusinessCheckInStatus | undefined;
  getGrowthReport(businessId: string): HarthmereBusinessGrowthReport;
  getShopfront(businessId: string): HarthmereBusinessShopfront;
  getContractBoard(businessId: string): HarthmereBusinessContractBoard;
  getFinancePanel(businessId: string): HarthmereBusinessFinancePanel;
  getStaffPanel(businessId: string): HarthmereBusinessStaffPanel;
  getCompliancePanel(businessId: string): HarthmereBusinessCompliancePanel;
  getOperationScreen(businessId: string): HarthmereBusinessOperationScreen;
  getCustomerMiniGame(
    businessId: string
  ): HarthmereBusinessCustomerMiniGamePanel;
  getEmpirePanel(businessId: string): HarthmereBusinessEmpirePanel;
  getTownHallPanel(): HarthmereBusinessTownHallPanel;
  getMarketplacePanel(): HarthmereBusinessMarketplacePanel;
  getGuildBusinessPanel(guildId?: string): HarthmereBusinessGuildPanel;
  getServiceQuests(businessId?: string): HarthmereBusinessServiceQuest[];
  submitOperation(
    operation: string,
    payload: Record<string, unknown>
  ): Promise<void>;
  createBankAccount(businessId: string): Promise<void>;
  transferPersonalToBusinessBank(
    businessId: string,
    amountGold: number
  ): Promise<void>;
  transferBusinessToPersonalBank(
    businessId: string,
    amountGold: number
  ): Promise<void>;
  depositInventory(
    businessId: string,
    itemId: string,
    count: number
  ): Promise<void>;
  withdrawInventory(
    businessId: string,
    itemId: string,
    count: number
  ): Promise<void>;
  setPrices(
    businessId: string,
    priceModifiers: Record<string, number>
  ): Promise<void>;
  openBusiness(
    businessId: string,
    propertyId?: string,
    townId?: string
  ): Promise<void>;
  hireWorker(
    businessId: string,
    role: string,
    wageGoldPerDay: number,
    skill?: number
  ): Promise<void>;
  assignWorker(
    businessId: string,
    employeeId: string,
    assignedTask: string
  ): Promise<void>;
  fireWorker(businessId: string, employeeId: string): Promise<void>;
  trainWorker(businessId: string, employeeId: string): Promise<void>;
  promoteWorker(
    businessId: string,
    employeeId: string,
    assignedTask?: HarthmereBusinessEmployeeAssignableTaskId
  ): Promise<void>;
  payPayroll(businessId: string): Promise<void>;
  checkInDaily(businessId: string): Promise<void>;
  refreshEmployeeCandidates(businessId: string, count?: number): Promise<void>;
  interviewEmployeeCandidate(
    businessId: string,
    candidateId: string,
    interviewStyle?: string
  ): Promise<void>;
  negotiateEmployeeCandidate(
    businessId: string,
    candidateId: string,
    wageGoldPerDay: number
  ): Promise<void>;
  hireEmployeeCandidate(businessId: string, candidateId: string): Promise<void>;
  runEmployeeTask(
    businessId: string,
    employeeId: string,
    assignedTask?: string,
    offerId?: string
  ): Promise<void>;
  runEmployeeMoraleTick(businessId: string, days?: number): Promise<void>;
  acceptContract(businessId: string, contractId: string): Promise<void>;
  fulfillContract(businessId: string, contractId: string): Promise<void>;
  grantPermission(
    businessId: string,
    targetActorId: string,
    permissions: string[]
  ): Promise<void>;
  buyBusinessTool(businessId: string, itemId: string): Promise<void>;
  purchaseShopItem(
    businessId: string,
    itemId: string,
    count: number
  ): Promise<void>;
  buyStorefrontGood(
    businessId: string,
    itemId: string,
    count: number
  ): Promise<void>;
  runServiceAction(
    businessId: string,
    actionId: string,
    overrides?: Record<string, unknown>
  ): Promise<void>;
  requestCustomerService(
    businessId: string,
    actionId: string,
    overrides?: Record<string, unknown>
  ): Promise<void>;
  startCustomerSession(businessId: string, count?: number): Promise<void>;
  tickCustomerSession(businessId: string, sessionId?: string): Promise<void>;
  endCustomerSession(businessId: string, sessionId?: string): Promise<void>;
  serveCustomer(
    businessId: string,
    offerId: string,
    sessionId?: string,
    ticketId?: string,
    minigameAction?: HarthmereBusinessMiniGameDecision
  ): Promise<void>;
  openBranch(businessId: string, outpostId?: string): Promise<void>;
  assignAutomation(
    businessId: string,
    role: HarthmereBusinessAutomationRole,
    branchId?: string,
    employeeId?: string
  ): Promise<void>;
  assignBranchManager(
    businessId: string,
    branchId: string,
    employeeId: string
  ): Promise<void>;
  routeBranchStock(
    businessId: string,
    branchId: string,
    itemId: string,
    count: number
  ): Promise<void>;
  scheduleBranchStaff(
    businessId: string,
    branchId: string,
    employeeIds: string[]
  ): Promise<void>;
  closeBranch(businessId: string, branchId: string): Promise<void>;
  settleEmpireDay(businessId: string, days?: number): Promise<void>;
}

export function createHarthmereBusinessInterfaceAdapter(options: {
  state?: HarthmereBusinessEconomySnapshot;
  hydrated?: boolean;
  setState?: (next: HarthmereBusinessEconomySnapshot | undefined) => void;
  refresh?: () => Promise<HarthmereBusinessEconomySnapshot | undefined>;
  submit?: (
    operation: string,
    payload: Record<string, unknown>
  ) => Promise<HarthmereBusinessInterfaceResponse>;
}): HarthmereBusinessInterfaceAdapter {
  let current = options.state;
  const setCurrent = (next: HarthmereBusinessEconomySnapshot | undefined) => {
    current = next;
    options.setState?.(next);
  };
  const refresh = async () => {
    const next = await options.refresh?.();
    if (next) setCurrent(next);
  };
  const submit = async (
    operation: string,
    payload: Record<string, unknown>
  ) => {
    try {
      const response = await options.submit?.(operation, payload);
      dispatchHarthmereBusinessInventoryLootUpdated(response);
      if (response?.economyState)
        setCurrent(
          normalizeHarthmereBusinessEconomySnapshot(response.economyState)
        );
      await refresh();
    } catch (error) {
      // HARTHMERE_BUSINESS_CLIENT_SESSION_EXPIRY_GUARD
      // A rejected mutation (e.g. serving a customer whose session has expired
      // server-side) throws before we can apply the response, which would leave
      // the client showing the now-invalid session forever. Re-pull
      // authoritative state so the UI recovers (the dead session is dropped and
      // "Start Shift" re-enables) instead of getting stuck on a stale customer.
      await refresh();
      throw error;
    }
  };

  const requireState = () => {
    if (!current) throw new Error("business_interface_state_not_hydrated");
    return current;
  };

  return {
    isHydrated: () => options.hydrated !== false && Boolean(current),
    getState: () => current,
    refresh,
    isAvailable: (nearbyBusinessId) =>
      isHarthmereBusinessInterfaceAvailable(current, nearbyBusinessId),
    getMode: (businessId) =>
      getHarthmereBusinessActorMode(requireState(), businessId),
    getBusiness: (businessId) => current?.businesses[businessId],
    getBusinessType: (businessId) => {
      const state = requireState();
      const business = state.businesses[businessId];
      return business ? state.businessTypes[business.typeId] : undefined;
    },
    getBikkieGraphics: (businessId) => {
      const state = requireState();
      const business = state.businesses[businessId];
      return business
        ? getHarthmereBusinessBikkieGraphics(business.typeId as any)
        : [];
    },
    getInventory: (businessId) =>
      getHarthmereVisibleBusinessInventory(requireState(), businessId),
    getMoneySummary: (businessId) =>
      getHarthmereBusinessMoneySummary(requireState(), businessId),
    getEmployees: (businessId) =>
      Object.values(requireState().employees).filter(
        (employee) => employee.businessId === businessId
      ),
    getContracts: (businessId) =>
      getHarthmereBusinessContracts(requireState(), businessId),
    getCustomerOrders: (businessId) =>
      getHarthmereCustomerOrders(requireState(), businessId),
    getTodos: (businessId) =>
      getHarthmereBusinessTodos(requireState(), businessId),
    getServiceActions: (businessId, mode) => {
      const state = requireState();
      const business = state.businesses[businessId];
      if (!business) return [];
      const actorMode =
        mode ?? getHarthmereBusinessActorMode(state, businessId);
      if (
        actorMode === "customer" &&
        !canCustomerUseHarthmereBusiness(business)
      )
        return [];
      return getHarthmereBusinessServiceActions(business.typeId, actorMode);
    },
    getInteractionPrompt: (context) =>
      getHarthmereBusinessInteractionPrompt(requireState(), context),
    getOwnerDashboard: (businessId) =>
      getHarthmereOwnerDashboard(requireState(), businessId),
    getCheckInStatus: (businessId) => {
      const business = requireState().businesses[businessId];
      if (!business) {
        return undefined;
      }
      // The "lost by not checking in" total is accumulated server-side from
      // actual reduced sales, so the client passes baseDailyRevenue 0 here — the
      // status surfaces the real made/lost totals + streak from the record.
      return businessCheckInStatus(
        business.dailyCheckIn ?? initBusinessDailyCheckInState(),
        harthmereDayIndex(Date.now()),
        0
      );
    },
    getGrowthReport: (businessId) =>
      getHarthmereBusinessGrowthReport(requireState(), businessId),
    getShopfront: (businessId) => {
      const state = requireState();
      return getHarthmereBusinessShopfront(
        state,
        businessId,
        getHarthmereBusinessActorMode(state, businessId)
      );
    },
    getContractBoard: (businessId) =>
      getHarthmereContractBoard(requireState(), businessId),
    getFinancePanel: (businessId) =>
      getHarthmereBusinessFinancePanel(requireState(), businessId),
    getStaffPanel: (businessId) =>
      getHarthmereBusinessStaffPanel(requireState(), businessId),
    getCompliancePanel: (businessId) =>
      getHarthmereBusinessCompliancePanel(requireState(), businessId),
    getOperationScreen: (businessId) =>
      getHarthmereBusinessOperationScreen(requireState(), businessId),
    getCustomerMiniGame: (businessId) =>
      getHarthmereBusinessCustomerMiniGame(requireState(), businessId),
    getEmpirePanel: (businessId) =>
      getHarthmereBusinessEmpirePanel(requireState(), businessId),
    getTownHallPanel: () => getHarthmereTownHallPanel(requireState()),
    getMarketplacePanel: () => getHarthmereMarketplacePanel(requireState()),
    getGuildBusinessPanel: (guildId) =>
      getHarthmereGuildBusinessPanel(requireState(), guildId),
    getServiceQuests: (businessId) =>
      getHarthmereBusinessServiceQuests(requireState(), businessId),
    submitOperation: submit,
    createBankAccount: (businessId) =>
      submit("create_business_bank_account", { businessId }),
    transferPersonalToBusinessBank: (businessId, amountGold) =>
      submit("transfer_personal_to_business_bank", { businessId, amountGold }),
    transferBusinessToPersonalBank: (businessId, amountGold) =>
      submit("transfer_business_to_personal_bank", { businessId, amountGold }),
    depositInventory: (businessId, itemId, count) =>
      submit("deposit_business_inventory", { businessId, itemId, count }),
    withdrawInventory: (businessId, itemId, count) =>
      submit("withdraw_business_inventory", { businessId, itemId, count }),
    setPrices: (businessId, priceModifiers) =>
      submit("set_business_prices", { businessId, priceModifiers }),
    openBusiness: (businessId, propertyId, townId) =>
      submit("open_business", { businessId, propertyId, townId }),
    hireWorker: (businessId, role, wageGoldPerDay, skill = 1) =>
      submit("hire_worker", { businessId, role, wageGoldPerDay, skill }),
    assignWorker: (businessId, employeeId, assignedTask) =>
      submit("assign_worker", { businessId, employeeId, assignedTask }),
    fireWorker: (businessId, employeeId) =>
      submit("fire_worker", { businessId, employeeId }),
    trainWorker: (businessId, employeeId) =>
      submit("train_worker", { businessId, employeeId }),
    promoteWorker: (businessId, employeeId, assignedTask) =>
      submit("promote_business_employee", {
        businessId,
        employeeId,
        ...(assignedTask ? { assignedTask } : {}),
      }),
    payPayroll: (businessId) => submit("pay_payroll", { businessId }),
    checkInDaily: (businessId) =>
      submit("business_daily_check_in", { businessId }),
    refreshEmployeeCandidates: (businessId, count = 3) =>
      submit("refresh_business_employee_candidates", { businessId, count }),
    interviewEmployeeCandidate: (
      businessId,
      candidateId,
      interviewStyle = "friendly"
    ) =>
      submit("interview_business_employee_candidate", {
        businessId,
        candidateId,
        interviewStyle,
      }),
    negotiateEmployeeCandidate: (businessId, candidateId, wageGoldPerDay) =>
      submit("negotiate_business_employee_candidate", {
        businessId,
        candidateId,
        wageGoldPerDay,
      }),
    hireEmployeeCandidate: (businessId, candidateId) =>
      submit("hire_business_employee_candidate", { businessId, candidateId }),
    runEmployeeTask: (businessId, employeeId, assignedTask, offerId) =>
      submit("run_business_employee_task", {
        businessId,
        employeeId,
        ...(assignedTask ? { assignedTask } : {}),
        ...(offerId ? { offerId } : {}),
      }),
    runEmployeeMoraleTick: (businessId, days = 1) =>
      submit("run_business_employee_morale_tick", { businessId, days }),
    acceptContract: (businessId, contractId) =>
      submit("accept_contract", {
        businessId,
        contractId,
        createQuestOnAccept: true,
      }),
    fulfillContract: (businessId, contractId) =>
      submit("fulfill_contract", { businessId, contractId }),
    grantPermission: (businessId, targetActorId, permissions) =>
      submit("grant_business_permission", {
        businessId,
        targetActorId,
        permissions,
      }),
    buyBusinessTool: async (businessId, itemId) => {
      const business = requireState().businesses[businessId];
      if (!business) throw new Error("economy_rejected:business_not_found");
      if (!canCustomerUseHarthmereBusiness(business)) {
        throw new Error("economy_rejected:business_not_open");
      }
      const listing = harthmereBusinessToolForType(business.typeId);
      if (!listing) {
        throw new Error("economy_rejected:business_tool_not_available");
      }
      if (listing.toolItemId !== itemId) {
        throw new Error("economy_rejected:business_tool_listing_mismatch");
      }
      await submit("buy_business_tool", {
        businessId,
        itemId,
        count: 1,
      });
    },
    purchaseShopItem: async (businessId, itemId, count) => {
      const business = requireState().businesses[businessId];
      if (!business) throw new Error("business_not_found");
      if (!canCustomerUseHarthmereBusiness(business))
        throw new Error("business_not_open");
      await submit("record_customer_sale", { businessId, itemId, count });
    },
    buyStorefrontGood: async (businessId, itemId, count) => {
      const business = requireState().businesses[businessId];
      if (!business) throw new Error("business_not_found");
      if (!canCustomerUseHarthmereBusiness(business))
        throw new Error("business_not_open");
      await submit("buy_storefront_good", { businessId, itemId, count });
    },
    runServiceAction: async (businessId, actionId, overrides = {}) => {
      const state = requireState();
      const business = state.businesses[businessId];
      if (!business) throw new Error("business_not_found");
      const action = getHarthmereBusinessServiceActions(
        business.typeId,
        "owner"
      ).find((entry) => entry.actionId === actionId);
      if (!action) throw new Error(`business_action_not_available:${actionId}`);
      await submit(action.operation, {
        businessId,
        ...(action.defaultPayload ?? {}),
        ...overrides,
      });
    },
    requestCustomerService: async (businessId, actionId, overrides = {}) => {
      const state = requireState();
      const business = state.businesses[businessId];
      if (!business) throw new Error("business_not_found");
      if (!canCustomerUseHarthmereBusiness(business))
        throw new Error("business_not_open");
      const action = getHarthmereBusinessServiceActions(
        business.typeId,
        "customer"
      ).find((entry) => entry.actionId === actionId);
      if (!action)
        throw new Error(`business_customer_action_not_available:${actionId}`);
      if (action.operation === "create_contract") {
        await submit(
          "create_contract",
          serviceContractPayload(state, business, action, overrides)
        );
      } else {
        const priceGold = Number(
          overrides.priceGold ??
            overrides.amountGold ??
            action.priceGold ??
            harthmereBusinessServicePriceGold(action)
        );
        await submit(action.operation, {
          businessId,
          amountGold: priceGold,
          priceGold,
          ...(action.defaultPayload ?? {}),
          ...overrides,
        });
      }
    },
    startCustomerSession: (businessId, count) =>
      submit("start_business_customer_session", {
        businessId,
        ...(count ? { count } : {}),
      }),
    serveCustomer: (
      businessId,
      offerId,
      sessionId,
      ticketId,
      minigameAction
    ) => {
      const customerEntityId = ticketId
        ? current?.businessSystems.customerSessions?.[
            sessionId ?? ""
          ]?.queue.find((ticket) => ticket.ticketId === ticketId)?.entityId
        : undefined;
      return submit("serve_business_customer", {
        businessId,
        offerId,
        ...(sessionId ? { sessionId } : {}),
        ...(ticketId ? { ticketId } : {}),
        ...(customerEntityId ? { customerEntityId } : {}),
        ...(minigameAction ? { minigameAction } : {}),
      });
    },
    tickCustomerSession: (businessId, sessionId) => {
      const session = sessionId
        ? current?.businessSystems.customerSessions?.[sessionId]
        : undefined;
      const ticket = session?.queue.find(
        (candidate) => candidate.ticketId === session.currentTicketId
      );
      return submit("tick_business_customer_session", {
        businessId,
        ...(sessionId ? { sessionId } : {}),
        ...(ticket?.ticketId ? { ticketId: ticket.ticketId } : {}),
        ...(ticket?.entityId ? { customerEntityId: ticket.entityId } : {}),
      });
    },
    endCustomerSession: (businessId, sessionId) =>
      submit("end_business_customer_session", {
        businessId,
        ...(sessionId ? { sessionId } : {}),
      }),
    openBranch: (businessId, outpostId) =>
      submit("open_business_branch", {
        businessId,
        ...(outpostId ? { outpostId } : {}),
      }),
    assignAutomation: (businessId, role, branchId, employeeId) =>
      submit("assign_business_automation", {
        businessId,
        role,
        ...(branchId ? { branchId } : {}),
        ...(employeeId ? { employeeId } : {}),
      }),
    assignBranchManager: (businessId, branchId, employeeId) =>
      submit("assign_business_branch_manager", {
        businessId,
        branchId,
        employeeId,
      }),
    routeBranchStock: (businessId, branchId, itemId, count) =>
      submit("route_business_branch_stock", {
        businessId,
        branchId,
        itemId,
        count,
      }),
    scheduleBranchStaff: (businessId, branchId, employeeIds) =>
      submit("schedule_business_branch_staff", {
        businessId,
        branchId,
        employeeIds,
      }),
    closeBranch: (businessId, branchId) =>
      submit("close_business_branch", { businessId, branchId }),
    settleEmpireDay: (businessId, days) =>
      submit("run_business_empire_day", {
        businessId,
        ...(days ? { days } : {}),
      }),
  };
}
