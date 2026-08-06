import {
  reduceHarthmereEconomyBusinessSpecificMutation,
  normalizeHarthmereEconomyBusinessSystemsState,
  validateHarthmereEconomyBalance,
} from "./mmo_economy_business_systems";
import {
  harthmereBusinessStorefrontLearnableRecipeIds,
  harthmereBusinessStorefrontListingsForType,
  harthmereBusinessStorefrontRecipeBookForItem,
} from "./harthmere_business_storefront_goods";
import { harthmereBusinessToolForType } from "./harthmere_business_tool_shop";
import { harthmereNativeBiomesIdForItemId } from "./harthmere_native_item_ids";
import type { BuildingSystemAnyMaterializationPlan } from "./building_system";
import {
  businessMissedDays,
  businessNeglectRevenueFactor,
  initBusinessDailyCheckInState,
  processBusinessCheckIn,
  type BusinessDailyCheckInState,
} from "./business_daily_checkin";
import {
  harthmereLoanTermsForPersuasion,
  harthmereSublevelProgress,
} from "./harthmere_sublevel_benefits";

// UTC day index, matching harthmereCareDay / the client's harthmereDayIndex.
// Inlined (not imported from mmo_care_loops) to avoid a circular import.
const HARTHMERE_ECONOMY_CHECK_IN_DAY_MS = 24 * 60 * 60 * 1000;
function harthmereEconomyDayIndex(nowMs: number): number {
  return Math.floor(nowMs / HARTHMERE_ECONOMY_CHECK_IN_DAY_MS);
}
/*
 * mmo_economy_authority.ts
 *
 * Server-authoritative production economy model for Harthmere/Biomes.
 * This module owns businesses, licenses, contracts, town demand, production,
 * pricing, staff, upkeep/taxes/rent/wages, reputation, customer satisfaction,
 * business banking/loans/insurance, logistics, failures/disasters, guild-owned
 * businesses, NPC competition, and marketplace orders.
 *
 * It intentionally contains no React, browser, or localStorage assumptions.
 * Static catalogs are configuration; runtime state starts empty and is only
 * populated by backend mutations.
 */

export const HARTHMERE_ECONOMY_AUTHORITY_VERSION =
  "harthmere-economy-authority" as const;

export const HARTHMERE_ECONOMY_MAX_LOGS = 300;
export const HARTHMERE_ECONOMY_MAX_BUSINESS_INVENTORY_SLOTS = 240;
export const HARTHMERE_ECONOMY_MAX_CONTRACT_DURATION_MS =
  45 * 24 * 60 * 60 * 1000;
export const HARTHMERE_ECONOMY_DAY_MS = 24 * 60 * 60 * 1000;
export const HARTHMERE_ECONOMY_INSURANCE_TERM_DAYS = 30;
export const HARTHMERE_ECONOMY_BASE_SALES_TAX_RATE = 0.06;
export const HARTHMERE_ECONOMY_MAX_SALES_TAX_RATE = 0.18;
export const HARTHMERE_ECONOMY_MARKET_FEE_RATE = 0.025;
export const HARTHMERE_ECONOMY_DEFAULT_REGION_ID = "harthmere_grove_region";
export const HARTHMERE_ECONOMY_DEFAULT_TOWN_ID = "harthmere_grove";

export type HarthmereEconomyOwnerKind = "player" | "npc" | "guild" | "town";
export type HarthmereEconomyBusinessStatus =
  | "draft"
  | "open"
  | "paused"
  | "suspended"
  | "bankrupt"
  | "closed";
export type HarthmereEconomyContractStatus =
  | "open"
  | "active"
  | "fulfilled"
  | "failed"
  | "cancelled"
  | "expired";
export type HarthmereEconomyLoanStatus = "active" | "paid" | "defaulted";
export type HarthmereEconomyInsurancePolicyStatus =
  | "active"
  | "cancelled"
  | "expired";
export type HarthmereEconomyMarketOrderKind = "buy" | "sell";
export type HarthmereEconomyMarketOrderStatus =
  | "open"
  | "filled"
  | "cancelled"
  | "expired";

export type HarthmereEconomyNeedId =
  | "food"
  | "housing"
  | "health"
  | "safety"
  | "sanitation"
  | "travel"
  | "energy"
  | "property_condition"
  | "tourism"
  | "logistics"
  | "maintenance"
  | "identity"
  | "knowledge"
  | "timeline_stability";

export type HarthmereEconomyBusinessTypeId =
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

export type HarthmereEconomyLicenseClass =
  | "basic_trade"
  | "food_service"
  | "medical"
  | "security"
  | "hazardous_material"
  | "portal_transit"
  | "property_development"
  | "magic_goods"
  | "sanitation"
  | "logistics";

export interface HarthmereEconomyBusinessTypeDefinition {
  typeId: HarthmereEconomyBusinessTypeId;
  displayName: string;
  category: string;
  startCostGold: number;
  materialNeed: "light" | "medium" | "heavy" | "rare";
  baseStorageSlots: number;
  baseUpkeepGoldPerDay: number;
  requiredLicense: HarthmereEconomyLicenseClass;
  minimumLicenseLevel: number;
  serviceNeeds: HarthmereEconomyNeedId[];
  inputItemFamilies: string[];
  outputItemFamilies: string[];
  riskLevel: number;
  civicImportance: number;
}

export interface HarthmereEconomyInventoryStack {
  itemId: string;
  count: number;
  expiresAtMs?: number;
  condition?: number;
  contaminated?: boolean;
}

export type HarthmereEconomyInventoryRecord = Record<
  string,
  HarthmereEconomyInventoryStack
>;

export interface HarthmereEconomyBusinessRecord {
  businessId: string;
  ownerKind: HarthmereEconomyOwnerKind;
  ownerId: string;
  typeId: HarthmereEconomyBusinessTypeId;
  name: string;
  status: HarthmereEconomyBusinessStatus;
  licenseClass: HarthmereEconomyLicenseClass;
  licenseLevel: number;
  propertyId?: string;
  townId?: string;
  regionId: string;
  inventory: HarthmereEconomyInventoryRecord;
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
  // Owner daily check-in state (streak, gold earned from check-ins, revenue lost
  // to neglect). Optional for backward compatibility with persisted records.
  dailyCheckIn?: BusinessDailyCheckInState;
}

export interface HarthmereEconomyLicenseRecord {
  licenseId: string;
  ownerKind: HarthmereEconomyOwnerKind;
  ownerId: string;
  licenseClass: HarthmereEconomyLicenseClass;
  level: number;
  issuedAtMs: number;
  expiresAtMs?: number;
  suspended: boolean;
  violations: number;
}

export interface HarthmereEconomyContractRequirement {
  itemId?: string;
  count?: number;
  serviceNeed?: HarthmereEconomyNeedId;
  serviceUnits?: number;
}

export interface HarthmereEconomyFieldServiceSpec {
  required: boolean;
  serviceKind: string;
  targetId?: string;
  mapMarkerId?: string;
  questTitle?: string;
  todoText?: string;
}

export interface HarthmereEconomyContractRecord {
  contractId: string;
  issuerKind: HarthmereEconomyOwnerKind | "business";
  issuerId: string;
  townId?: string;
  regionId: string;
  title: string;
  businessType?: HarthmereEconomyBusinessTypeId;
  fieldService?: HarthmereEconomyFieldServiceSpec;
  requirements: HarthmereEconomyContractRequirement[];
  rewardGold: number;
  reputationDelta: number;
  status: HarthmereEconomyContractStatus;
  acceptedByBusinessId?: string;
  acceptedByActorId?: string;
  createdAtMs: number;
  deadlineAtMs: number;
  completedAtMs?: number;
  failurePenaltyGold: number;
  escrowGold: number;
  logs: string[];
}

export interface HarthmereEconomyTownNeedState {
  value: number;
  demandWeight: number;
  lastUpdatedAtMs: number;
}

export interface HarthmereEconomyTownState {
  townId: string;
  regionId: string;
  needs: Record<HarthmereEconomyNeedId, HarthmereEconomyTownNeedState>;
  population: number;
  publicBudgetGold: number;
  cleanlinessRating: number;
  safetyRating: number;
  happiness: number;
  timelineInstability: number;
  taxRevenueGold: number;
  serviceCoverage: Record<HarthmereEconomyNeedId, number>;
  lastTickAtMs: number;
}

export interface HarthmereEconomyRegionState {
  regionId: string;
  towns: string[];
  priceIndex: Record<string, number>;
  itemSupply: Record<string, number>;
  itemDemand: Record<string, number>;
  routeSafety: Record<string, number>;
  lastTickAtMs: number;
}

export interface HarthmereEconomyEmployeeRecord {
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

export interface HarthmereEconomyProductionRecipe {
  recipeId: string;
  businessType: HarthmereEconomyBusinessTypeId;
  displayName: string;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  craftTimeMs: number;
  minimumLicenseLevel: number;
  skillRequirement: number;
  energyCostGold: number;
  wasteOutputs?: Record<string, number>;
  riskLevel: number;
}

export interface HarthmereEconomyLoanRecord {
  loanId: string;
  businessId: string;
  principalOriginal: number;
  principalRemaining: number;
  interestPaid: number;
  dailyInterestRate: number;
  openedAtMs: number;
  dueAtMs: number;
  status: HarthmereEconomyLoanStatus;
  defaultedAtMs?: number;
}

export interface HarthmereEconomyInsurancePolicyRecord {
  policyId: string;
  businessId: string;
  coverageKind: string;
  coverageGold: number;
  deductibleGold: number;
  premiumGoldPerDay: number;
  status: HarthmereEconomyInsurancePolicyStatus;
  purchasedAtMs: number;
  expiresAtMs: number;
  lastPremiumPaidAtMs: number;
  claimsPaidGold: number;
}

export interface HarthmereEconomyTradeRouteRecord {
  routeId: string;
  ownerKind: HarthmereEconomyOwnerKind | "business";
  ownerId: string;
  originTownId: string;
  destinationTownId: string;
  distanceUnits: number;
  safetyRating: number;
  transitFeeGold: number;
  createdAtMs: number;
  active: boolean;
}

export interface HarthmereEconomyFailureEventRecord {
  failureId: string;
  businessId: string;
  kind: string;
  severity: number;
  cause: string;
  createdAtMs: number;
  resolvedAtMs?: number;
  repairCostGold: number;
  insuranceClaimId?: string;
}

export interface HarthmereEconomyMarketOrderRecord {
  orderId: string;
  kind: HarthmereEconomyMarketOrderKind;
  businessId: string;
  itemId: string;
  count: number;
  unitPriceGold: number;
  status: HarthmereEconomyMarketOrderStatus;
  createdAtMs: number;
  expiresAtMs: number;
  escrowGold: number;
  escrowItems: number;
}

export interface HarthmereEconomyLedgerEntry {
  id: string;
  atMs: number;
  actorId: string;
  kind: string;
  businessId?: string;
  contractId?: string;
  amountGold?: number;
  itemDeltas?: Record<string, number>;
  townId?: string;
  reason?: string;
}

export interface HarthmereProductionEconomyState {
  [key: string]: any;
  version: typeof HARTHMERE_ECONOMY_AUTHORITY_VERSION;
  businesses: Record<string, HarthmereEconomyBusinessRecord>;
  licenses: Record<string, HarthmereEconomyLicenseRecord>;
  contracts: Record<string, HarthmereEconomyContractRecord>;
  towns: Record<string, HarthmereEconomyTownState>;
  regions: Record<string, HarthmereEconomyRegionState>;
  employees: Record<string, HarthmereEconomyEmployeeRecord>;
  recipes: Record<string, HarthmereEconomyProductionRecipe>;
  loans: Record<string, HarthmereEconomyLoanRecord>;
  insurancePolicies: Record<string, HarthmereEconomyInsurancePolicyRecord>;
  tradeRoutes: Record<string, HarthmereEconomyTradeRouteRecord>;
  failures: Record<string, HarthmereEconomyFailureEventRecord>;
  marketOrders: Record<string, HarthmereEconomyMarketOrderRecord>;
  ledger: HarthmereEconomyLedgerEntry[];
  nextBusinessNumber: number;
  nextContractNumber: number;
  nextEmployeeNumber: number;
  nextLoanNumber: number;
  nextPolicyNumber: number;
  nextRouteNumber: number;
  nextFailureNumber: number;
  nextMarketOrderNumber: number;
}

export interface HarthmereEconomyMutationRequest {
  [key: string]: any;
  requestId: string;
  actorId: string;
  nowMs: number;
  operation: string;
  businessId?: string;
  businessType?: HarthmereEconomyBusinessTypeId;
  ownerKind?: HarthmereEconomyOwnerKind;
  ownerId?: string;
  name?: string;
  propertyId?: string;
  townId?: string;
  regionId?: string;
  licenseClass?: HarthmereEconomyLicenseClass;
  licenseLevel?: number;
  itemId?: string;
  count?: number;
  inventoryItemDeltas?: Record<string, number>;
  priceModifiers?: Record<string, number>;
  amountGold?: number;
  rewardGold?: number;
  title?: string;
  contractId?: string;
  requirements?: HarthmereEconomyContractRequirement[];
  deadlineAtMs?: number;
  serviceNeed?: HarthmereEconomyNeedId;
  recipeId?: string;
  employeeId?: string;
  employeeActorId?: string;
  employeeNpcId?: string;
  role?: string;
  assignedTask?: string;
  skill?: number;
  wageGoldPerDay?: number;
  principalGold?: number;
  dailyInterestRate?: number;
  dueAtMs?: number;
  coverageKind?: string;
  coverageGold?: number;
  deductibleGold?: number;
  premiumGoldPerDay?: number;
  policyId?: string;
  loanId?: string;
  originTownId?: string;
  destinationTownId?: string;
  distanceUnits?: number;
  safetyRating?: number;
  transitFeeGold?: number;
  routeId?: string;
  toBusinessId?: string;
  failureId?: string;
  failureKind?: string;
  severity?: number;
  cause?: string;
  repairCostGold?: number;
  orderId?: string;
  orderKind?: HarthmereEconomyMarketOrderKind;
  unitPriceGold?: number;
  salesTaxRate?: number;
  days?: number;
  fieldService?: HarthmereEconomyFieldServiceSpec;
  createQuestOnAccept?: boolean;
}

export interface HarthmereEconomyMutationContext {
  [key: string]: any;
  actorGold: number;
  actorInventoryItems: Record<string, number>;
  actorKnownRecipes?: string[];
  actorGuildId?: string;
  actorTownIds?: string[];
  allowNpcAdministration?: boolean;
  canManageGuildBusiness?: (guildId: string) => boolean;
  canManageTownBusiness?: (townId: string) => boolean;
  maxBusinessCount?: number;
  actorSkillLevels?: Record<string, number | undefined>;
}

export interface HarthmereEconomyMutationResult {
  economy: HarthmereProductionEconomyState;
  inventoryGoldDelta: number;
  inventoryItemDeltas: Record<string, number>;
  newRecipeIds: string[];
  warnings: string[];
  touchedModels: string[];
  sharedStateKeys: string[];
  buildingMaterializationPlans?: BuildingSystemAnyMaterializationPlan[];
}

type MutableResult = {
  next: HarthmereProductionEconomyState;
  goldDelta: number;
  itemDeltas: Record<string, number>;
  newRecipeIds: string[];
  warnings: string[];
  touched: Set<string>;
  shared: Set<string>;
  buildingMaterializationPlans: BuildingSystemAnyMaterializationPlan[];
};

const NEEDS: HarthmereEconomyNeedId[] = [
  "food",
  "housing",
  "health",
  "safety",
  "sanitation",
  "travel",
  "energy",
  "property_condition",
  "tourism",
  "logistics",
  "maintenance",
  "identity",
  "knowledge",
  "timeline_stability",
];

export const HARTHMERE_ECONOMY_BUSINESS_TYPES: Record<
  HarthmereEconomyBusinessTypeId,
  HarthmereEconomyBusinessTypeDefinition
> = {
  exotic_matter_refinery: {
    typeId: "exotic_matter_refinery",
    displayName: "Exotic Matter Refinery",
    category: "Industrial / Infrastructure",
    startCostGold: 1200,
    materialNeed: "heavy",
    baseStorageSlots: 48,
    baseUpkeepGoldPerDay: 35,
    requiredLicense: "hazardous_material",
    minimumLicenseLevel: 2,
    serviceNeeds: ["energy", "travel", "timeline_stability"],
    inputItemFamilies: [
      "antiproton_capsule",
      "positron_capsule",
      "antineutron_capsule",
      "antihydrogen_block",
      "antihelium_block",
      "antiboron_block",
      "raw_exotic_matter",
      "stabilizing_crystal",
      "coolant",
      "containment_filter",
    ],
    outputItemFamilies: [
      "raw_exotic_matter",
      "stabilized_exotic_matter",
      "exotic_matter_power_cell",
      "portal_fuel",
      "certified_portal_fuel",
      "teleport_fuel",
      "anchor_core",
      "utility_core",
      "alcubierre_drive_core",
      "spent_filter",
    ],
    riskLevel: 5,
    civicImportance: 5,
  },
  biome_maintenance_repair: {
    typeId: "biome_maintenance_repair",
    displayName: "Biome Maintenance & Repair Company",
    category: "Technical Service",
    startCostGold: 700,
    materialNeed: "medium",
    baseStorageSlots: 36,
    baseUpkeepGoldPerDay: 18,
    requiredLicense: "basic_trade",
    minimumLicenseLevel: 1,
    serviceNeeds: ["property_condition", "maintenance", "timeline_stability"],
    inputItemFamilies: [
      "repair_kit",
      "stabilized_exotic_matter",
      "anchor_part",
    ],
    outputItemFamilies: ["inspection", "repair", "safety_certificate"],
    riskLevel: 3,
    civicImportance: 5,
  },
  biome_design_studio: {
    typeId: "biome_design_studio",
    displayName: "Biome Design Studio",
    category: "Creative / Property Service",
    startCostGold: 500,
    materialNeed: "medium",
    baseStorageSlots: 32,
    baseUpkeepGoldPerDay: 12,
    requiredLicense: "basic_trade",
    minimumLicenseLevel: 1,
    serviceNeeds: ["identity", "tourism", "housing"],
    inputItemFamilies: ["decor", "lighting", "blueprint"],
    outputItemFamilies: ["design_pack", "terrain_template"],
    riskLevel: 1,
    civicImportance: 3,
  },
  security_defense_contractor: {
    typeId: "security_defense_contractor",
    displayName: "Security & Defense Contractor",
    category: "Protection / Combat Service",
    startCostGold: 600,
    materialNeed: "medium",
    baseStorageSlots: 36,
    baseUpkeepGoldPerDay: 24,
    requiredLicense: "security",
    minimumLicenseLevel: 1,
    serviceNeeds: ["safety", "travel", "tourism"],
    inputItemFamilies: ["weapon", "armor", "ration", "medical_kit"],
    outputItemFamilies: ["guard_contract", "bounty_completion"],
    riskLevel: 4,
    civicImportance: 5,
  },
  portal_transit_company: {
    typeId: "portal_transit_company",
    displayName: "Portal Transit Company",
    category: "Infrastructure / Transportation",
    startCostGold: 5000,
    materialNeed: "heavy",
    baseStorageSlots: 64,
    baseUpkeepGoldPerDay: 75,
    requiredLicense: "portal_transit",
    minimumLicenseLevel: 3,
    serviceNeeds: ["travel", "logistics", "energy"],
    inputItemFamilies: ["portal_fuel", "anchor_core", "destination_crystal"],
    outputItemFamilies: ["passenger_route", "cargo_route"],
    riskLevel: 5,
    civicImportance: 5,
  },
  biome_farming_rare_foods: {
    typeId: "biome_farming_rare_foods",
    displayName: "Biome Farming & Rare Foods",
    category: "Agriculture / Food Supply",
    startCostGold: 300,
    materialNeed: "heavy",
    baseStorageSlots: 56,
    baseUpkeepGoldPerDay: 10,
    requiredLicense: "basic_trade",
    minimumLicenseLevel: 1,
    serviceNeeds: ["food", "health", "tourism"],
    inputItemFamilies: ["seed", "water", "fertilizer"],
    outputItemFamilies: ["crop", "herb", "rare_food"],
    riskLevel: 2,
    civicImportance: 5,
  },
  weapons_tools: {
    typeId: "weapons_tools",
    displayName: "Weapons & Tools",
    category: "Crafting / Equipment",
    startCostGold: 500,
    materialNeed: "heavy",
    baseStorageSlots: 42,
    baseUpkeepGoldPerDay: 14,
    requiredLicense: "basic_trade",
    minimumLicenseLevel: 1,
    serviceNeeds: ["safety", "maintenance", "property_condition"],
    inputItemFamilies: ["wood", "stone", "metal", "crystal"],
    outputItemFamilies: ["weapon", "tool", "scanner"],
    riskLevel: 3,
    civicImportance: 4,
  },
  magic_goods: {
    typeId: "magic_goods",
    displayName: "Magic Goods",
    category: "Exotic / Consumable Crafting",
    startCostGold: 800,
    materialNeed: "rare",
    baseStorageSlots: 34,
    baseUpkeepGoldPerDay: 20,
    requiredLicense: "magic_goods",
    minimumLicenseLevel: 2,
    serviceNeeds: ["health", "safety", "timeline_stability"],
    inputItemFamilies: ["exotic_matter", "crystal", "herb", "relic_fragment"],
    outputItemFamilies: ["charm", "potion", "ward"],
    riskLevel: 4,
    civicImportance: 4,
  },
  exploration_guide: {
    typeId: "exploration_guide",
    displayName: "Exploration Guide",
    category: "Knowledge / Travel Service",
    startCostGold: 400,
    materialNeed: "light",
    baseStorageSlots: 24,
    baseUpkeepGoldPerDay: 8,
    requiredLicense: "basic_trade",
    minimumLicenseLevel: 1,
    serviceNeeds: ["knowledge", "travel", "safety"],
    inputItemFamilies: ["map", "ration", "field_kit"],
    outputItemFamilies: ["survey", "map", "expedition"],
    riskLevel: 3,
    civicImportance: 3,
  },
  custom_home_property_development: {
    typeId: "custom_home_property_development",
    displayName: "Custom Home & Property Development",
    category: "Construction / Real Estate",
    startCostGold: 1000,
    materialNeed: "heavy",
    baseStorageSlots: 64,
    baseUpkeepGoldPerDay: 26,
    requiredLicense: "property_development",
    minimumLicenseLevel: 1,
    serviceNeeds: ["housing", "property_condition", "maintenance"],
    inputItemFamilies: ["wood", "stone", "metal", "furniture"],
    outputItemFamilies: ["house", "shop", "guild_hall"],
    riskLevel: 3,
    civicImportance: 5,
  },
  general_trader: {
    typeId: "general_trader",
    displayName: "General Trader",
    category: "Retail / Brokerage",
    startCostGold: 300,
    materialNeed: "medium",
    baseStorageSlots: 48,
    baseUpkeepGoldPerDay: 9,
    requiredLicense: "basic_trade",
    minimumLicenseLevel: 1,
    serviceNeeds: ["logistics", "food", "maintenance"],
    inputItemFamilies: ["inventory", "storage", "credits"],
    outputItemFamilies: ["retail_goods", "brokerage"],
    riskLevel: 1,
    civicImportance: 4,
  },
  hunter_wild_meat: {
    typeId: "hunter_wild_meat",
    displayName: "Hunter for Wild Meat",
    category: "Food / Wildlife Control",
    startCostGold: 300,
    materialNeed: "medium",
    baseStorageSlots: 32,
    baseUpkeepGoldPerDay: 9,
    requiredLicense: "basic_trade",
    minimumLicenseLevel: 1,
    serviceNeeds: ["food", "safety", "health"],
    inputItemFamilies: ["weapon", "trap", "bait"],
    outputItemFamilies: ["wild_meat", "hide", "bone"],
    riskLevel: 3,
    civicImportance: 4,
  },
  medical_doctor: {
    typeId: "medical_doctor",
    displayName: "Medical / Doctor",
    category: "Healthcare / Public Service",
    startCostGold: 500,
    materialNeed: "medium",
    baseStorageSlots: 36,
    baseUpkeepGoldPerDay: 18,
    requiredLicense: "medical",
    minimumLicenseLevel: 2,
    serviceNeeds: ["health", "sanitation", "timeline_stability"],
    inputItemFamilies: ["herb", "bandage", "medicine", "scanner"],
    outputItemFamilies: ["treatment", "medkit", "antidote"],
    riskLevel: 3,
    civicImportance: 5,
  },
  teleport_owner: {
    typeId: "teleport_owner",
    displayName: "Teleport Owner",
    category: "Local Transportation / Access Control",
    startCostGold: 2500,
    materialNeed: "heavy",
    baseStorageSlots: 44,
    baseUpkeepGoldPerDay: 38,
    requiredLicense: "portal_transit",
    minimumLicenseLevel: 2,
    serviceNeeds: ["travel", "logistics", "health"],
    inputItemFamilies: ["teleport_fuel", "destination_crystal", "pad_part"],
    outputItemFamilies: ["teleport_token", "emergency_return"],
    riskLevel: 4,
    civicImportance: 4,
  },
  waste_sanitation_cleanup: {
    typeId: "waste_sanitation_cleanup",
    displayName: "Waste, Sanitation & Contamination Cleanup",
    category: "Public Health / Hazard Service",
    startCostGold: 400,
    materialNeed: "medium",
    baseStorageSlots: 42,
    baseUpkeepGoldPerDay: 12,
    requiredLicense: "sanitation",
    minimumLicenseLevel: 1,
    serviceNeeds: ["sanitation", "health", "timeline_stability"],
    inputItemFamilies: ["filter", "reagent", "containment_barrel"],
    outputItemFamilies: ["recycling", "compost", "clean_certificate"],
    riskLevel: 3,
    civicImportance: 5,
  },
  repair_maintenance_person: {
    typeId: "repair_maintenance_person",
    displayName: "Repair People / Maintenance Person",
    category: "Everyday Repair / Facilities",
    startCostGold: 250,
    materialNeed: "light",
    baseStorageSlots: 30,
    baseUpkeepGoldPerDay: 8,
    requiredLicense: "basic_trade",
    minimumLicenseLevel: 1,
    serviceNeeds: ["maintenance", "property_condition", "housing"],
    inputItemFamilies: ["nails", "bolts", "wood", "metal_part"],
    outputItemFamilies: ["repair", "installation"],
    riskLevel: 1,
    civicImportance: 4,
  },
  food_service_restaurant: {
    typeId: "food_service_restaurant",
    displayName: "Food Service / Restaurant / Cook",
    category: "Food / Hospitality / Buffs",
    startCostGold: 250,
    materialNeed: "heavy",
    baseStorageSlots: 36,
    baseUpkeepGoldPerDay: 11,
    requiredLicense: "food_service",
    minimumLicenseLevel: 1,
    serviceNeeds: ["food", "tourism", "health"],
    inputItemFamilies: ["crop", "wild_meat", "spice", "water"],
    outputItemFamilies: ["meal", "ration", "healing_soup"],
    riskLevel: 2,
    civicImportance: 5,
  },
  courier: {
    typeId: "courier",
    displayName: "Courier",
    category: "Logistics / Trust Service",
    startCostGold: 150,
    materialNeed: "light",
    baseStorageSlots: 24,
    baseUpkeepGoldPerDay: 6,
    requiredLicense: "logistics",
    minimumLicenseLevel: 1,
    serviceNeeds: ["logistics", "travel", "health"],
    inputItemFamilies: ["satchel", "map", "lockbox"],
    outputItemFamilies: ["delivery", "escrow_delivery"],
    riskLevel: 2,
    civicImportance: 4,
  },
  hospitality_inn_hotel_shelter: {
    typeId: "hospitality_inn_hotel_shelter",
    displayName: "Hospitality / Inn / Hotel / Shelter",
    category: "Housing / Tourism / Emergency Relief",
    startCostGold: 700,
    materialNeed: "heavy",
    baseStorageSlots: 48,
    baseUpkeepGoldPerDay: 22,
    requiredLicense: "basic_trade",
    minimumLicenseLevel: 1,
    serviceNeeds: ["housing", "tourism", "food", "safety"],
    inputItemFamilies: ["bed", "food", "clean_water", "linen"],
    outputItemFamilies: ["room_rental", "shelter_bed", "tour_package"],
    riskLevel: 2,
    civicImportance: 4,
  },
};

export const HARTHMERE_ECONOMY_RECIPE_CATALOG: Record<
  string,
  HarthmereEconomyProductionRecipe
> = {
  stabilize_exotic_matter: {
    recipeId: "stabilize_exotic_matter",
    businessType: "exotic_matter_refinery",
    displayName: "Stabilize Exotic Matter",
    inputs: { raw_exotic_matter: 2, stabilizing_crystal: 1, coolant: 1 },
    outputs: { stabilized_exotic_matter: 1 },
    craftTimeMs: 10 * 60 * 1000,
    minimumLicenseLevel: 2,
    skillRequirement: 2,
    energyCostGold: 8,
    wasteOutputs: { spent_filter: 1 },
    riskLevel: 4,
  },
  cook_worker_meals: {
    recipeId: "cook_worker_meals",
    businessType: "food_service_restaurant",
    displayName: "Cook Worker Meals",
    inputs: { crop_bundle: 2, wild_meat: 1, clean_water: 1 },
    outputs: { worker_meal: 4 },
    craftTimeMs: 5 * 60 * 1000,
    minimumLicenseLevel: 1,
    skillRequirement: 1,
    energyCostGold: 2,
    riskLevel: 1,
  },
  prepare_medkits: {
    recipeId: "prepare_medkits",
    businessType: "medical_doctor",
    displayName: "Prepare Field Medkits",
    inputs: { herb_bundle: 2, bandage: 3, clean_water: 1 },
    outputs: { field_medkit: 2 },
    craftTimeMs: 6 * 60 * 1000,
    minimumLicenseLevel: 2,
    skillRequirement: 2,
    energyCostGold: 3,
    riskLevel: 2,
  },
  forge_repair_tools: {
    recipeId: "forge_repair_tools",
    businessType: "weapons_tools",
    displayName: "Forge Repair Tools",
    inputs: { iron_ingot: 2, wood_plank: 1 },
    outputs: { repair_tool: 1 },
    craftTimeMs: 8 * 60 * 1000,
    minimumLicenseLevel: 1,
    skillRequirement: 1,
    energyCostGold: 4,
    riskLevel: 2,
  },
  sort_recycling: {
    recipeId: "sort_recycling",
    businessType: "waste_sanitation_cleanup",
    displayName: "Sort Recyclables",
    inputs: { mixed_waste: 3, cleaning_reagent: 1 },
    outputs: { recycled_material: 2, compost: 1 },
    craftTimeMs: 7 * 60 * 1000,
    minimumLicenseLevel: 1,
    skillRequirement: 1,
    energyCostGold: 2,
    riskLevel: 2,
  },
};

export function defaultHarthmereProductionEconomyState(): HarthmereProductionEconomyState {
  return {
    version: HARTHMERE_ECONOMY_AUTHORITY_VERSION,
    businesses: {},
    licenses: {},
    contracts: {},
    towns: {},
    regions: {},
    employees: {},
    recipes: { ...HARTHMERE_ECONOMY_RECIPE_CATALOG },
    loans: {},
    insurancePolicies: {},
    tradeRoutes: {},
    failures: {},
    marketOrders: {},
    businessSystems: normalizeHarthmereEconomyBusinessSystemsState(undefined),
    ledger: [],
    nextBusinessNumber: 1,
    nextContractNumber: 1,
    nextEmployeeNumber: 1,
    nextLoanNumber: 1,
    nextPolicyNumber: 1,
    nextRouteNumber: 1,
    nextFailureNumber: 1,
    nextMarketOrderNumber: 1,
  };
}

export function normalizeHarthmereProductionEconomyState(
  raw: unknown
): HarthmereProductionEconomyState {
  const defaults = defaultHarthmereProductionEconomyState();
  const value = (
    raw && typeof raw === "object" ? raw : {}
  ) as Partial<HarthmereProductionEconomyState>;
  return {
    ...defaults,
    ...value,
    version: HARTHMERE_ECONOMY_AUTHORITY_VERSION,
    businesses: { ...(value.businesses ?? {}) },
    licenses: { ...(value.licenses ?? {}) },
    contracts: { ...(value.contracts ?? {}) },
    towns: { ...(value.towns ?? {}) },
    regions: { ...(value.regions ?? {}) },
    employees: { ...(value.employees ?? {}) },
    recipes: { ...defaults.recipes, ...(value.recipes ?? {}) },
    loans: { ...(value.loans ?? {}) },
    insurancePolicies: { ...(value.insurancePolicies ?? {}) },
    tradeRoutes: { ...(value.tradeRoutes ?? {}) },
    failures: { ...(value.failures ?? {}) },
    marketOrders: { ...(value.marketOrders ?? {}) },
    businessSystems: normalizeHarthmereEconomyBusinessSystemsState(
      (value as any).businessSystems
    ),
    ledger: Array.isArray(value.ledger)
      ? value.ledger.slice(-HARTHMERE_ECONOMY_MAX_LOGS)
      : [],
  };
}

function cloneEconomyState(
  state: HarthmereProductionEconomyState
): HarthmereProductionEconomyState {
  return normalizeHarthmereProductionEconomyState(
    JSON.parse(JSON.stringify(state))
  );
}

function clampNumber(value: unknown, min: number, max: number, fallback = min) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function positiveInt(value: unknown, fallback = 0) {
  return Math.max(0, Math.trunc(Number(value) || fallback));
}

function recordItemDelta(
  target: Record<string, number>,
  itemId: string,
  delta: number
) {
  const next = (target[itemId] ?? 0) + Math.trunc(delta);
  if (next === 0) delete target[itemId];
  else target[itemId] = next;
}

function applyInventoryDelta(
  inventory: HarthmereEconomyInventoryRecord,
  itemId: string,
  delta: number
) {
  const current = inventory[itemId]?.count ?? 0;
  const next = current + Math.trunc(delta);
  if (next <= 0) delete inventory[itemId];
  else
    inventory[itemId] = {
      ...(inventory[itemId] ?? { itemId, count: 0 }),
      itemId,
      count: next,
    };
}

function inventoryCount(
  inventory: HarthmereEconomyInventoryRecord,
  itemId: string
) {
  return Math.max(0, inventory[itemId]?.count ?? 0);
}

function occupiedInventorySlots(inventory: HarthmereEconomyInventoryRecord) {
  return Object.values(inventory).filter((stack) => stack.count > 0).length;
}

function inventoryHasCapacity(
  inventory: HarthmereEconomyInventoryRecord,
  itemId: string,
  maxSlots: number
) {
  return (
    inventoryCount(inventory, itemId) > 0 ||
    occupiedInventorySlots(inventory) < maxSlots
  );
}

function businessType(typeId: HarthmereEconomyBusinessTypeId | undefined) {
  return typeId ? HARTHMERE_ECONOMY_BUSINESS_TYPES[typeId] : undefined;
}

function ownerKey(
  ownerKind: HarthmereEconomyOwnerKind,
  ownerId: string,
  licenseClass: HarthmereEconomyLicenseClass
) {
  return `${ownerKind}:${ownerId}:${licenseClass}`;
}

function businessSharedKey(businessId: string) {
  return `harthmere:live_mode:current:economy_business:${businessId}`;
}

function townSharedKey(townId: string) {
  return `harthmere:live_mode:current:economy_town:${townId}`;
}

function contractSharedKey(contractId: string) {
  return `harthmere:live_mode:current:economy_contract:${contractId}`;
}

function pushLedger(
  result: MutableResult,
  entry: Omit<HarthmereEconomyLedgerEntry, "atMs" | "actorId">,
  request: HarthmereEconomyMutationRequest
) {
  result.next.ledger.push({
    atMs: request.nowMs,
    actorId: request.actorId,
    ...entry,
  });
  result.next.ledger = result.next.ledger.slice(-HARTHMERE_ECONOMY_MAX_LOGS);
  result.touched.add("economy_ledger");
}

function reject(
  result: MutableResult,
  warning: string,
  model = "economy_rejection"
) {
  result.warnings.push(warning);
  result.touched.add(model);
}

function rejectUnmappablePurchasedItem(
  result: MutableResult,
  itemId: string
): boolean {
  if (harthmereNativeBiomesIdForItemId(itemId) !== undefined) return false;
  reject(result, "economy_rejected:item_not_purchasable");
  return true;
}

function ensureRegion(
  state: HarthmereProductionEconomyState,
  regionId: string,
  nowMs: number
) {
  if (!state.regions[regionId]) {
    state.regions[regionId] = {
      regionId,
      towns: [],
      priceIndex: {},
      itemSupply: {},
      itemDemand: {},
      routeSafety: {},
      lastTickAtMs: nowMs,
    };
  }
  return state.regions[regionId];
}

function defaultTownNeeds(
  nowMs: number
): Record<HarthmereEconomyNeedId, HarthmereEconomyTownNeedState> {
  const out = {} as Record<
    HarthmereEconomyNeedId,
    HarthmereEconomyTownNeedState
  >;
  for (const need of NEEDS) {
    out[need] = {
      value: 65,
      demandWeight:
        need === "food" ||
        need === "health" ||
        need === "safety" ||
        need === "sanitation"
          ? 1.25
          : 1,
      lastUpdatedAtMs: nowMs,
    };
  }
  return out;
}

function ensureTown(
  state: HarthmereProductionEconomyState,
  townId: string,
  regionId: string,
  nowMs: number
) {
  const region = ensureRegion(state, regionId, nowMs);
  if (!state.towns[townId]) {
    state.towns[townId] = {
      townId,
      regionId,
      needs: defaultTownNeeds(nowMs),
      population: 100,
      publicBudgetGold: 0,
      cleanlinessRating: 65,
      safetyRating: 65,
      happiness: 65,
      timelineInstability: 25,
      taxRevenueGold: 0,
      serviceCoverage: Object.fromEntries(
        NEEDS.map((need) => [need, 0])
      ) as Record<HarthmereEconomyNeedId, number>,
      lastTickAtMs: nowMs,
    };
  }
  if (!region.towns.includes(townId)) region.towns.push(townId);
  return state.towns[townId];
}

function getBusiness(result: MutableResult, businessId: string | undefined) {
  if (!businessId) return undefined;
  return result.next.businesses[businessId];
}

function canManageBusiness(
  business: HarthmereEconomyBusinessRecord,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  if (business.ownerKind === "player")
    return business.ownerId === request.actorId;
  if (business.ownerKind === "npc")
    return context.allowNpcAdministration === true;
  if (business.ownerKind === "guild")
    return context.canManageGuildBusiness?.(business.ownerId) === true;
  if (business.ownerKind === "town")
    return context.canManageTownBusiness?.(business.ownerId) === true;
  return false;
}

function validateOwner(
  result: MutableResult,
  ownerKind: HarthmereEconomyOwnerKind,
  ownerId: string,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  if (ownerKind === "player" && ownerId !== request.actorId) {
    reject(result, "economy_rejected:cannot_register_for_other_player");
    return false;
  }
  if (ownerKind === "npc" && context.allowNpcAdministration !== true) {
    reject(result, "economy_rejected:npc_business_requires_admin_context");
    return false;
  }
  if (
    ownerKind === "guild" &&
    context.canManageGuildBusiness?.(ownerId) !== true
  ) {
    reject(result, "economy_rejected:guild_business_permission_required");
    return false;
  }
  if (
    ownerKind === "town" &&
    context.canManageTownBusiness?.(ownerId) !== true
  ) {
    reject(result, "economy_rejected:town_business_permission_required");
    return false;
  }
  return true;
}

function activeBusinessCountForOwner(
  state: HarthmereProductionEconomyState,
  ownerKind: HarthmereEconomyOwnerKind,
  ownerId: string
) {
  return Object.values(state.businesses).filter(
    (business) =>
      business.ownerKind === ownerKind &&
      business.ownerId === ownerId &&
      business.status !== "closed" &&
      business.status !== "bankrupt"
  ).length;
}

function licenseForBusiness(
  state: HarthmereProductionEconomyState,
  business: HarthmereEconomyBusinessRecord
) {
  const key = ownerKey(
    business.ownerKind,
    business.ownerId,
    business.licenseClass
  );
  return state.licenses[key];
}

function ensureBusinessLicenseLevel(
  state: HarthmereProductionEconomyState,
  business: HarthmereEconomyBusinessRecord
) {
  const license = licenseForBusiness(state, business);
  if (license && !license.suspended) {
    business.licenseLevel = Math.max(business.licenseLevel, license.level);
  }
}

export function economyBasePriceForItem(itemId: string) {
  const text = itemId.toLowerCase();
  if (
    /raw_exotic|anchor_core|portal_fuel|teleport_fuel|destination_crystal/.test(
      text
    )
  )
    return 80;
  if (/stabilized_exotic|crystal|relic|ward|potion|antidote/.test(text))
    return 45;
  if (/weapon|sword|armor|scanner|repair_tool|field_medkit/.test(text))
    return 35;
  if (/meal|meat|crop|herb|food|water|ration/.test(text)) return 8;
  if (/wood|stone|iron|metal|plank|ingot|ore/.test(text)) return 12;
  if (/waste|compost|spent_filter/.test(text)) return 2;
  return 10;
}

export function economyPriceForItem(input: {
  state: HarthmereProductionEconomyState;
  regionId: string;
  townId?: string;
  itemId: string;
  business?: HarthmereEconomyBusinessRecord;
}) {
  const base = economyBasePriceForItem(input.itemId);
  const region = input.state.regions[input.regionId];
  const supply = Math.max(0, region?.itemSupply[input.itemId] ?? 0);
  const demand = Math.max(0, region?.itemDemand[input.itemId] ?? 0);
  const scarcity = clampNumber((demand + 20) / (supply + 20), 0.5, 3, 1);
  const regionalIndex = clampNumber(
    region?.priceIndex[input.itemId] ?? 1,
    0.4,
    4,
    1
  );
  const modifier = clampNumber(
    input.business?.priceModifiers[input.itemId] ?? 1,
    0.25,
    5,
    1
  );
  return Math.max(1, Math.round(base * scarcity * regionalIndex * modifier));
}

function addTownNeed(
  town: HarthmereEconomyTownState,
  need: HarthmereEconomyNeedId,
  delta: number,
  nowMs: number
) {
  const current = town.needs[need] ?? {
    value: 65,
    demandWeight: 1,
    lastUpdatedAtMs: nowMs,
  };
  town.needs[need] = {
    ...current,
    value: clampNumber(current.value + delta, 0, 100, current.value),
    lastUpdatedAtMs: nowMs,
  };
}

function degradeTownNeeds(
  town: HarthmereEconomyTownState,
  days: number,
  nowMs: number
) {
  for (const need of NEEDS) {
    const baseDecay =
      need === "timeline_stability"
        ? 1.2
        : need === "sanitation" || need === "food"
        ? 1.4
        : 0.9;
    addTownNeed(
      town,
      need,
      -baseDecay * days * town.needs[need].demandWeight,
      nowMs
    );
  }
  town.cleanlinessRating = town.needs.sanitation.value;
  town.safetyRating = town.needs.safety.value;
  town.happiness = Math.round(
    (town.needs.food.value +
      town.needs.housing.value +
      town.needs.safety.value +
      town.needs.health.value +
      town.needs.tourism.value) /
      5
  );
  town.timelineInstability = clampNumber(
    100 - town.needs.timeline_stability.value,
    0,
    100,
    0
  );
}

function serviceCapacityForBusiness(
  state: HarthmereProductionEconomyState,
  business: HarthmereEconomyBusinessRecord
) {
  const workers = business.employees
    .map((id) => state.employees[id])
    .filter(Boolean);
  const avgSkill = workers.length
    ? workers.reduce((sum, worker) => sum + worker.skill, 0) / workers.length
    : 1;
  return Math.max(
    1,
    Math.round(3 + workers.length * 3 + avgSkill + business.reputation / 40)
  );
}

function businessHasConsumableStockForNeed(
  business: HarthmereEconomyBusinessRecord,
  need: HarthmereEconomyNeedId
) {
  if (need === "food")
    return Object.keys(business.inventory).some((itemId) =>
      /meal|food|meat|crop|ration|soup/i.test(itemId)
    );
  if (need === "health")
    return Object.keys(business.inventory).some((itemId) =>
      /medicine|medkit|antidote|herb|bandage|tonic/i.test(itemId)
    );
  if (need === "energy" || need === "travel")
    return Object.keys(business.inventory).some((itemId) =>
      /fuel|crystal|anchor|exotic/i.test(itemId)
    );
  if (need === "maintenance" || need === "property_condition")
    return Object.keys(business.inventory).some((itemId) =>
      /repair|tool|wood|stone|metal|parts|plank|ingot/i.test(itemId)
    );
  if (need === "sanitation")
    return Object.keys(business.inventory).some((itemId) =>
      /reagent|filter|barrel|waste|clean/i.test(itemId)
    );
  return true;
}

function consumeOneRelevantStockForNeed(
  business: HarthmereEconomyBusinessRecord,
  need: HarthmereEconomyNeedId
) {
  const candidates = Object.keys(business.inventory).filter((itemId) => {
    if (need === "food") return /meal|food|meat|crop|ration|soup/i.test(itemId);
    if (need === "health")
      return /medicine|medkit|antidote|herb|bandage|tonic/i.test(itemId);
    if (need === "energy" || need === "travel")
      return /fuel|crystal|anchor|exotic/i.test(itemId);
    if (need === "maintenance" || need === "property_condition")
      return /repair|tool|wood|stone|metal|parts|plank|ingot/i.test(itemId);
    if (need === "sanitation")
      return /reagent|filter|barrel|clean/i.test(itemId);
    return false;
  });
  const itemId = candidates[0];
  if (itemId) applyInventoryDelta(business.inventory, itemId, -1);
  return itemId;
}

function collectSalesTax(
  town: HarthmereEconomyTownState,
  grossGold: number,
  taxRate: number
) {
  const tax = Math.max(
    0,
    Math.round(
      grossGold *
        clampNumber(
          taxRate,
          0,
          HARTHMERE_ECONOMY_MAX_SALES_TAX_RATE,
          HARTHMERE_ECONOMY_BASE_SALES_TAX_RATE
        )
    )
  );
  town.publicBudgetGold += tax;
  town.taxRevenueGold += tax;
  return tax;
}

function licenseFeeGold(
  licenseClass: HarthmereEconomyLicenseClass,
  level: number
) {
  const risky =
    licenseClass === "hazardous_material" ||
    licenseClass === "portal_transit" ||
    licenseClass === "medical" ||
    licenseClass === "security" ||
    licenseClass === "magic_goods";
  return Math.max(25, Math.round(level * level * (risky ? 120 : 60)));
}

function calculateLoanBalance(loan: HarthmereEconomyLoanRecord, nowMs: number) {
  const days = Math.max(
    0,
    Math.ceil((nowMs - loan.openedAtMs) / HARTHMERE_ECONOMY_DAY_MS)
  );
  const interestAccrued = Math.ceil(
    loan.principalRemaining * loan.dailyInterestRate * days
  );
  const interestRemaining = Math.max(0, interestAccrued - loan.interestPaid);
  return {
    days,
    interestRemaining,
    totalRemaining: loan.principalRemaining + interestRemaining,
    overdue: nowMs > loan.dueAtMs,
  };
}

function makeResult(state: HarthmereProductionEconomyState): MutableResult {
  return {
    next: cloneEconomyState(state),
    goldDelta: 0,
    itemDeltas: {},
    newRecipeIds: [],
    warnings: [],
    touched: new Set<string>(),
    shared: new Set<string>(),
    buildingMaterializationPlans: [],
  };
}

function finalizeResult(result: MutableResult): HarthmereEconomyMutationResult {
  return {
    economy: normalizeHarthmereProductionEconomyState(result.next),
    inventoryGoldDelta: result.goldDelta,
    inventoryItemDeltas: { ...result.itemDeltas },
    newRecipeIds: [...result.newRecipeIds],
    warnings: result.warnings,
    touchedModels: [...result.touched],
    sharedStateKeys: [...result.shared],
    buildingMaterializationPlans: result.buildingMaterializationPlans.length
      ? result.buildingMaterializationPlans
      : undefined,
  };
}

function requireBusinessManager(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = getBusiness(result, request.businessId);
  if (!business) {
    reject(result, "economy_rejected:business_not_found");
    return undefined;
  }
  if (!canManageBusiness(business, request, context)) {
    reject(result, "economy_rejected:business_permission_required");
    return undefined;
  }
  return business;
}

function registerBusiness(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const def = businessType(request.businessType);
  if (!def) return reject(result, "economy_rejected:unknown_business_type");
  const name = (request.name ?? "").trim();
  if (name.length < 3 || name.length > 80)
    return reject(result, "economy_rejected:invalid_business_name");
  const ownerKind = request.ownerKind ?? "player";
  const ownerId = request.ownerId ?? request.actorId;
  if (!validateOwner(result, ownerKind, ownerId, request, context)) return;
  const maxBusinessCount = context.maxBusinessCount ?? 10;
  if (
    activeBusinessCountForOwner(result.next, ownerKind, ownerId) >=
    maxBusinessCount
  ) {
    return reject(result, "economy_rejected:owner_business_limit_reached");
  }
  if (ownerKind === "player" && context.actorGold < def.startCostGold) {
    return reject(result, "economy_rejected:insufficient_gold_for_startup");
  }
  const duplicate = Object.values(result.next.businesses).find(
    (business) =>
      business.ownerKind === ownerKind &&
      business.ownerId === ownerId &&
      business.name.toLowerCase() === name.toLowerCase() &&
      business.status !== "closed"
  );
  if (duplicate)
    return reject(result, "economy_rejected:duplicate_business_name_for_owner");
  const businessId = `econ_business_${result.next.nextBusinessNumber++}`;
  const regionId = request.regionId ?? HARTHMERE_ECONOMY_DEFAULT_REGION_ID;
  const nowMs = request.nowMs;
  result.next.businesses[businessId] = {
    businessId,
    ownerKind,
    ownerId,
    typeId: def.typeId,
    name,
    status: "draft",
    licenseClass: def.requiredLicense,
    licenseLevel: 0,
    propertyId: request.propertyId,
    townId: request.townId,
    regionId,
    inventory: {},
    storageMaxSlots: def.baseStorageSlots,
    employees: [],
    activeContracts: [],
    completedContracts: 0,
    reputation: 0,
    customerSatisfaction: 50,
    sanitationRating: 65,
    safetyRating: 65,
    serviceRadius: 1,
    priceModifiers: {},
    balanceGold: 0,
    debtGold: 0,
    upkeepGoldPerDay: def.baseUpkeepGoldPerDay,
    rentGoldPerDay: 0,
    wageGoldPerDay: 0,
    salesTaxRate: HARTHMERE_ECONOMY_BASE_SALES_TAX_RATE,
    lastTickAtMs: nowMs,
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    flags: {},
  };
  if (ownerKind === "player") result.goldDelta -= def.startCostGold;
  ensureRegion(result.next, regionId, nowMs);
  if (request.townId) ensureTown(result.next, request.townId, regionId, nowMs);
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "business_registered",
      businessId,
      amountGold: -def.startCostGold,
    },
    request
  );
  result.touched.add("economy_business");
  result.shared.add(businessSharedKey(businessId));
}

function issueLicense(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business) return;
  const level = Math.max(1, Math.min(4, positiveInt(request.licenseLevel, 1)));
  const licenseClass = request.licenseClass ?? business.licenseClass;
  if (licenseClass !== business.licenseClass)
    return reject(result, "economy_rejected:license_class_mismatch");
  const fee = licenseFeeGold(licenseClass, level);
  if (
    business.ownerKind === "player" &&
    context.actorGold + result.goldDelta < fee
  )
    return reject(result, "economy_rejected:insufficient_gold_for_license");
  const key = ownerKey(business.ownerKind, business.ownerId, licenseClass);
  result.next.licenses[key] = {
    licenseId: key,
    ownerKind: business.ownerKind,
    ownerId: business.ownerId,
    licenseClass,
    level: Math.max(level, result.next.licenses[key]?.level ?? 0),
    issuedAtMs: request.nowMs,
    suspended: false,
    violations: result.next.licenses[key]?.violations ?? 0,
  };
  business.licenseLevel = result.next.licenses[key].level;
  business.updatedAtMs = request.nowMs;
  if (business.ownerKind === "player") result.goldDelta -= fee;
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "license_issued",
      businessId: business.businessId,
      amountGold: -fee,
    },
    request
  );
  result.touched.add("economy_license");
  result.shared.add(businessSharedKey(business.businessId));
}

function openBusiness(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business) return;
  const def = HARTHMERE_ECONOMY_BUSINESS_TYPES[business.typeId];
  ensureBusinessLicenseLevel(result.next, business);
  if (business.licenseLevel < def.minimumLicenseLevel)
    return reject(result, "economy_rejected:license_level_too_low");
  const propertyId = request.propertyId ?? business.propertyId;
  const townId = request.townId ?? business.townId;
  if (!propertyId)
    return reject(result, "economy_rejected:property_required_to_open");
  if (!townId) return reject(result, "economy_rejected:town_required_to_open");
  const regionId = request.regionId ?? business.regionId;
  business.propertyId = propertyId;
  business.townId = townId;
  business.regionId = regionId;
  business.status = "open";
  business.updatedAtMs = request.nowMs;
  ensureTown(result.next, townId, regionId, request.nowMs);
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "business_opened",
      businessId: business.businessId,
      townId,
    },
    request
  );
  result.touched.add("economy_business");
  result.shared.add(businessSharedKey(business.businessId));
  result.shared.add(townSharedKey(townId));
}

function setBusinessPrices(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business) return;
  for (const [key, rawValue] of Object.entries(request.priceModifiers ?? {})) {
    business.priceModifiers[key] = clampNumber(rawValue, 0.25, 5, 1);
  }
  business.updatedAtMs = request.nowMs;
  result.touched.add("economy_pricing");
  result.shared.add(businessSharedKey(business.businessId));
}

// Owner daily check-in: grants a flat gold bonus once per day, keeps the streak
// going, and resets the neglect clock (so revenue returns to 100%). The revenue
// penalty + the "lost by not checking in" accounting are applied at sale time in
// recordCustomerSale; here we pass baseDailyRevenue 0 so the check-in itself does
// gold + streak + reset only.
function businessDailyCheckIn(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business) return;
  const today = harthmereEconomyDayIndex(request.nowMs);
  const checkIn = processBusinessCheckIn(
    business.dailyCheckIn ?? initBusinessDailyCheckInState(),
    today,
    0
  );
  if (!checkIn.checkedIn) {
    reject(result, "economy_rejected:business_already_checked_in_today");
    return;
  }
  business.dailyCheckIn = checkIn.state;
  business.updatedAtMs = request.nowMs;
  result.shared.add(businessSharedKey(business.businessId));
  result.goldDelta += checkIn.goldGranted;
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "business_daily_check_in",
      businessId: business.businessId,
      amountGold: checkIn.goldGranted,
    },
    request
  );
  result.touched.add("wallet");
  result.touched.add("economy_business_check_in");
}

function setBusinessTax(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business) return;
  const rate = clampNumber(
    request.salesTaxRate,
    0,
    HARTHMERE_ECONOMY_MAX_SALES_TAX_RATE,
    business.salesTaxRate
  );
  business.salesTaxRate = rate;
  business.updatedAtMs = request.nowMs;
  result.touched.add("economy_tax");
  result.shared.add(businessSharedKey(business.businessId));
}

function depositBusinessInventory(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business) return;
  const itemId = request.itemId;
  const count = positiveInt(request.count, 1);
  if (!itemId || count <= 0)
    return reject(result, "economy_rejected:invalid_deposit_item");
  if (
    (context.actorInventoryItems[itemId] ?? 0) +
      (result.itemDeltas[itemId] ?? 0) <
    count
  )
    return reject(result, "economy_rejected:item_not_available_for_deposit");
  if (
    !inventoryHasCapacity(business.inventory, itemId, business.storageMaxSlots)
  )
    return reject(result, "economy_rejected:business_storage_full");
  applyInventoryDelta(business.inventory, itemId, count);
  recordItemDelta(result.itemDeltas, itemId, -count);
  business.updatedAtMs = request.nowMs;
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "business_inventory_deposited",
      businessId: business.businessId,
      itemDeltas: { [itemId]: count },
    },
    request
  );
  result.touched.add("economy_business_inventory");
  result.shared.add(businessSharedKey(business.businessId));
}

function withdrawBusinessInventory(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business) return;
  const itemId = request.itemId;
  const count = positiveInt(request.count, 1);
  if (!itemId || count <= 0)
    return reject(result, "economy_rejected:invalid_withdraw_item");
  if (inventoryCount(business.inventory, itemId) < count)
    return reject(result, "economy_rejected:business_inventory_insufficient");
  applyInventoryDelta(business.inventory, itemId, -count);
  recordItemDelta(result.itemDeltas, itemId, count);
  business.updatedAtMs = request.nowMs;
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "business_inventory_withdrawn",
      businessId: business.businessId,
      itemDeltas: { [itemId]: -count },
    },
    request
  );
  result.touched.add("economy_business_inventory");
  result.shared.add(businessSharedKey(business.businessId));
}

function recordCustomerSale(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = getBusiness(result, request.businessId);
  if (!business) return reject(result, "economy_rejected:business_not_found");
  if (business.status !== "open")
    return reject(result, "economy_rejected:business_not_open");
  const itemId = request.itemId;
  const count = positiveInt(request.count, 1);
  let gross = positiveInt(request.amountGold, 0);
  if (itemId) {
    if (inventoryCount(business.inventory, itemId) < count)
      return reject(result, "economy_rejected:sale_inventory_insufficient");
    if (rejectUnmappablePurchasedItem(result, itemId)) return;
    const listedGross =
      economyPriceForItem({
        state: result.next,
        regionId: business.regionId,
        townId: business.townId,
        itemId,
        business,
      }) * count;
    gross = Math.max(gross, listedGross);
  }
  if (gross <= 0) return reject(result, "economy_rejected:invalid_sale_amount");
  if (context.actorGold + result.goldDelta < gross)
    return reject(
      result,
      "economy_rejected:insufficient_customer_gold_for_sale"
    );
  if (itemId) {
    applyInventoryDelta(business.inventory, itemId, -count);
    recordItemDelta(result.itemDeltas, itemId, count);
  }
  result.goldDelta -= gross;
  const town = ensureTown(
    result.next,
    business.townId ?? HARTHMERE_ECONOMY_DEFAULT_TOWN_ID,
    business.regionId,
    request.nowMs
  );
  const tax = collectSalesTax(town, gross, business.salesTaxRate);
  // Daily-check-in neglect: a player-owned business earns full revenue only while
  // the owner checks in. Each missed day applies an accelerating revenue factor
  // (eventually negative -> the business operates at a loss). The actual gold lost
  // is banked on the check-in state so the owner can be shown how much neglect has
  // cost them. NPC/town/guild businesses are unaffected.
  const fullEarning = gross - tax;
  let earning = fullEarning;
  if (business.ownerKind === "player") {
    const missedDays = businessMissedDays(
      business.dailyCheckIn ?? initBusinessDailyCheckInState(),
      harthmereEconomyDayIndex(request.nowMs)
    );
    if (missedDays > 0) {
      const factor = businessNeglectRevenueFactor(missedDays);
      earning = fullEarning * factor;
      const checkIn = business.dailyCheckIn ?? initBusinessDailyCheckInState();
      business.dailyCheckIn = {
        ...checkIn,
        totalRevenueLostToNeglect:
          checkIn.totalRevenueLostToNeglect + fullEarning * (1 - factor),
      };
    }
  }
  business.balanceGold += earning;
  business.customerSatisfaction = clampNumber(
    business.customerSatisfaction + (business.sanitationRating >= 50 ? 1 : -2),
    0,
    100,
    business.customerSatisfaction
  );
  business.reputation += business.customerSatisfaction >= 65 ? 1 : 0;
  if (request.serviceNeed)
    addTownNeed(town, request.serviceNeed, Math.min(4, count), request.nowMs);
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "customer_sale_recorded",
      businessId: business.businessId,
      amountGold: gross,
      townId: town.townId,
    },
    request
  );
  result.touched.add("economy_sale");
  result.touched.add("economy_tax");
  result.shared.add(businessSharedKey(business.businessId));
  result.shared.add(townSharedKey(town.townId));
}

// Business tool listings are catalog stock, like storefront materials, but
// they are single-copy equipment. Keep the gold debit and item grant in the
// economy mutation so native mode turns both into one signed ECS exchange.
// The former client-only path deducted gold first and then attempted an
// unauthorized request_loot_roll, which is how the Field Surgeon's Kit could
// charge 38 gold without ever entering the player's native inventory.
function buyBusinessTool(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = getBusiness(result, request.businessId);
  if (!business) return reject(result, "economy_rejected:business_not_found");
  if (business.status !== "open") {
    return reject(result, "economy_rejected:business_not_open");
  }
  const listing = harthmereBusinessToolForType(business.typeId);
  if (!listing) {
    return reject(result, "economy_rejected:business_tool_not_available");
  }
  if (request.itemId && request.itemId !== listing.toolItemId) {
    return reject(result, "economy_rejected:business_tool_listing_mismatch");
  }
  if (rejectUnmappablePurchasedItem(result, listing.toolItemId)) return;
  const count = positiveInt(request.count, 1);
  if (count !== 1) {
    return reject(
      result,
      "economy_rejected:business_tool_single_purchase_only"
    );
  }
  if ((context.actorInventoryItems[listing.toolItemId] ?? 0) > 0) {
    return reject(result, "economy_rejected:business_tool_already_owned");
  }
  if (context.actorGold + result.goldDelta < listing.priceGold) {
    return reject(
      result,
      "economy_rejected:insufficient_customer_gold_for_sale"
    );
  }

  recordItemDelta(result.itemDeltas, listing.toolItemId, 1);
  result.goldDelta -= listing.priceGold;
  const town = ensureTown(
    result.next,
    business.townId ?? HARTHMERE_ECONOMY_DEFAULT_TOWN_ID,
    business.regionId,
    request.nowMs
  );
  const tax = collectSalesTax(town, listing.priceGold, business.salesTaxRate);
  business.balanceGold += listing.priceGold - tax;
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "business_tool_purchased",
      businessId: business.businessId,
      amountGold: listing.priceGold,
      itemDeltas: { [listing.toolItemId]: 1 },
      townId: town.townId,
    },
    request
  );
  result.touched.add("economy_sale");
  result.touched.add("economy_tax");
  result.touched.add("economy_business_tool_purchase");
  result.shared.add(businessSharedKey(business.businessId));
  result.shared.add(townSharedKey(town.townId));
}

// HARTHMERE_BUSINESS_STOREFRONT_GOODS: a customer buys one of the business's
// themed catalog goods (5 blocks + 4 interior items). Unlike record_customer_sale
// this is CATALOG-driven, not stocked from business.inventory — so supply is
// unlimited / self-replenishing no matter how many players buy. Price is server-
// authoritative (the storefront listing). The buyer pays gold + receives the item;
// the business still earns the revenue. Does not touch the normal inventory/tool.
function buyStorefrontGood(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = getBusiness(result, request.businessId);
  if (!business) return reject(result, "economy_rejected:business_not_found");
  if (business.status !== "open")
    return reject(result, "economy_rejected:business_not_open");
  const itemId = request.itemId;
  if (!itemId)
    return reject(result, "economy_rejected:missing_storefront_item");
  const listing = harthmereBusinessStorefrontListingsForType(
    business.typeId
  ).find((entry) => entry.itemId === itemId);
  const recipeBook = harthmereBusinessStorefrontRecipeBookForItem(itemId);
  const inCatalog = Boolean(listing);
  if (!inCatalog)
    return reject(result, "economy_rejected:item_not_in_storefront");
  const count = positiveInt(request.count, 1);
  if (listing?.kind === "recipe_book" && count !== 1) {
    return reject(result, "economy_rejected:recipe_book_single_purchase_only");
  }
  if (
    listing?.kind !== "recipe_book" &&
    rejectUnmappablePurchasedItem(result, itemId)
  ) {
    return;
  }
  const unitPrice = positiveInt(listing?.buyPrice, 0);
  const gross = unitPrice * count;
  if (gross <= 0) return reject(result, "economy_rejected:invalid_sale_amount");
  if (context.actorGold + result.goldDelta < gross) {
    return reject(
      result,
      "economy_rejected:insufficient_customer_gold_for_sale"
    );
  }
  if (listing?.kind === "recipe_book") {
    if (!recipeBook) {
      return reject(result, "economy_rejected:unknown_recipe_book");
    }
    const learnableRecipeIds = harthmereBusinessStorefrontLearnableRecipeIds(
      itemId,
      context.actorKnownRecipes ?? []
    );
    if (learnableRecipeIds.length === 0) {
      return reject(result, "economy_rejected:recipe_book_already_learned");
    }
    result.newRecipeIds.push(...learnableRecipeIds);
  } else {
    // Buyer receives the item (positive itemDelta) and pays gold — NO business
    // inventory deduction (the catalog is an unlimited supply).
    recordItemDelta(result.itemDeltas, itemId, count);
  }
  result.goldDelta -= gross;
  const town = ensureTown(
    result.next,
    business.townId ?? HARTHMERE_ECONOMY_DEFAULT_TOWN_ID,
    business.regionId,
    request.nowMs
  );
  const tax = collectSalesTax(town, gross, business.salesTaxRate);
  business.balanceGold += gross - tax;
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "customer_sale_recorded",
      businessId: business.businessId,
      amountGold: gross,
      townId: town.townId,
    },
    request
  );
  result.touched.add("economy_sale");
  result.touched.add("economy_tax");
  if (listing?.kind === "recipe_book") result.touched.add("known_recipes");
  result.shared.add(businessSharedKey(business.businessId));
  result.shared.add(townSharedKey(town.townId));
}

function normalizeFieldServiceSpec(
  request: HarthmereEconomyMutationRequest
): HarthmereEconomyFieldServiceSpec | undefined {
  const raw = request.fieldService;
  if (!raw || raw.required !== true) return undefined;
  const serviceKind =
    typeof raw.serviceKind === "string" && raw.serviceKind.trim()
      ? raw.serviceKind.trim().slice(0, 80)
      : "field_service";
  return {
    required: true,
    serviceKind,
    targetId:
      typeof raw.targetId === "string" && raw.targetId.trim()
        ? raw.targetId.trim().slice(0, 120)
        : undefined,
    mapMarkerId:
      typeof raw.mapMarkerId === "string" && raw.mapMarkerId.trim()
        ? raw.mapMarkerId.trim().slice(0, 120)
        : undefined,
    questTitle:
      typeof raw.questTitle === "string" && raw.questTitle.trim()
        ? raw.questTitle.trim().slice(0, 120)
        : undefined,
    todoText:
      typeof raw.todoText === "string" && raw.todoText.trim()
        ? raw.todoText.trim().slice(0, 180)
        : undefined,
  };
}

function ensureBusinessServiceQuestForContract(
  result: MutableResult,
  business: HarthmereEconomyBusinessRecord,
  contract: HarthmereEconomyContractRecord,
  request: HarthmereEconomyMutationRequest
) {
  const fieldService = contract.fieldService;
  if (!fieldService?.required) return;
  const systems = normalizeHarthmereEconomyBusinessSystemsState(
    (result.next as any).businessSystems
  );
  (result.next as any).businessSystems = systems;
  const existing = Object.values((systems as any).serviceQuests ?? {}).find(
    (quest: any) => quest.contractId === contract.contractId
  );
  if (existing) return;
  const questNumber =
    (systems as any).nextServiceQuestNumber ??
    Object.keys((systems as any).serviceQuests ?? {}).length + 1;
  const questId = `business_service_quest_${questNumber}`;
  (systems as any).nextServiceQuestNumber = questNumber + 1;
  (systems as any).serviceQuests = {
    ...((systems as any).serviceQuests ?? {}),
  };
  (systems as any).serviceQuests[questId] = {
    questId,
    contractId: contract.contractId,
    businessId: business.businessId,
    acceptedByActorId: request.actorId,
    title: fieldService.questTitle ?? contract.title,
    todoText:
      fieldService.todoText ?? `Complete field service for ${contract.title}`,
    status: "active",
    serviceKind: fieldService.serviceKind,
    targetId: fieldService.targetId,
    townId: contract.townId ?? business.townId,
    regionId: contract.regionId ?? business.regionId,
    mapMarkerId: fieldService.mapMarkerId ?? fieldService.targetId,
    questBoardTodo: true,
    createdAtMs: request.nowMs,
    acceptedAtMs: request.nowMs,
    dueAtMs: contract.deadlineAtMs,
  };
  contract.logs.push(`service_quest_created:${questId}:${request.nowMs}`);
  pushLedger(
    result,
    {
      id: `${request.requestId}:service_quest`,
      kind: "business_service_quest_created",
      businessId: business.businessId,
      contractId: contract.contractId,
    },
    request
  );
  result.touched.add("economy_business_service_quest");
  result.shared.add(`harthmere:economy:business_service_quest:${questId}`);
}

function createContract(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const requirements = request.requirements ?? [];
  if (!requirements.length)
    return reject(result, "economy_rejected:contract_requirements_required");
  const rewardGold = positiveInt(request.rewardGold, 0);
  if (rewardGold <= 0)
    return reject(result, "economy_rejected:contract_reward_required");
  const deadlineAtMs =
    request.deadlineAtMs ?? request.nowMs + 7 * HARTHMERE_ECONOMY_DAY_MS;
  if (
    deadlineAtMs <= request.nowMs ||
    deadlineAtMs - request.nowMs > HARTHMERE_ECONOMY_MAX_CONTRACT_DURATION_MS
  ) {
    return reject(result, "economy_rejected:invalid_contract_deadline");
  }
  let issuerKind: HarthmereEconomyContractRecord["issuerKind"] =
    request.ownerKind ?? "player";
  let issuerId = request.ownerId ?? request.actorId;
  let escrowGold = rewardGold;
  if (request.businessId) {
    const business = requireBusinessManager(result, request, context);
    if (!business) return;
    issuerKind = "business";
    issuerId = business.businessId;
    if (business.balanceGold < rewardGold)
      return reject(
        result,
        "economy_rejected:business_contract_escrow_insufficient"
      );
    business.balanceGold -= rewardGold;
  } else if (issuerKind === "player") {
    if (context.actorGold + result.goldDelta < rewardGold)
      return reject(result, "economy_rejected:contract_escrow_insufficient");
    result.goldDelta -= rewardGold;
  } else if (!validateOwner(result, issuerKind, issuerId, request, context)) {
    return;
  }
  const contractId = `econ_contract_${result.next.nextContractNumber++}`;
  const regionId = request.regionId ?? HARTHMERE_ECONOMY_DEFAULT_REGION_ID;
  result.next.contracts[contractId] = {
    contractId,
    issuerKind,
    issuerId,
    townId: request.townId,
    regionId,
    title: (request.title ?? "Contract").slice(0, 120),
    businessType: request.businessType,
    fieldService: normalizeFieldServiceSpec(request),
    requirements,
    rewardGold,
    reputationDelta: 5,
    status: "open",
    createdAtMs: request.nowMs,
    deadlineAtMs,
    failurePenaltyGold: Math.round(rewardGold * 0.15),
    escrowGold,
    logs: [`created:${request.actorId}:${request.nowMs}`],
  };
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "contract_created",
      contractId,
      amountGold: -escrowGold,
    },
    request
  );
  result.touched.add("economy_contract");
  result.shared.add(contractSharedKey(contractId));
}

function acceptContract(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const contract = request.contractId
    ? result.next.contracts[request.contractId]
    : undefined;
  if (!contract) return reject(result, "economy_rejected:contract_not_found");
  if (contract.status !== "open")
    return reject(result, "economy_rejected:contract_not_open");
  if (contract.deadlineAtMs <= request.nowMs)
    return reject(result, "economy_rejected:contract_expired");
  const business = requireBusinessManager(result, request, context);
  if (!business) return;
  if (contract.businessType && contract.businessType !== business.typeId)
    return reject(result, "economy_rejected:wrong_business_type_for_contract");
  contract.status = "active";
  contract.acceptedByBusinessId = business.businessId;
  contract.acceptedByActorId = request.actorId;
  contract.logs.push(`accepted:${business.businessId}:${request.nowMs}`);
  if (!business.activeContracts.includes(contract.contractId))
    business.activeContracts.push(contract.contractId);
  if (request.createQuestOnAccept !== false)
    ensureBusinessServiceQuestForContract(result, business, contract, request);
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "contract_accepted",
      businessId: business.businessId,
      contractId: contract.contractId,
    },
    request
  );
  result.touched.add("economy_contract");
  result.shared.add(contractSharedKey(contract.contractId));
  result.shared.add(businessSharedKey(business.businessId));
}

function fulfillContract(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const contract = request.contractId
    ? result.next.contracts[request.contractId]
    : undefined;
  if (!contract) return reject(result, "economy_rejected:contract_not_found");
  if (contract.status !== "active")
    return reject(result, "economy_rejected:contract_not_active");
  if (contract.deadlineAtMs <= request.nowMs) {
    contract.status = "expired";
    return reject(result, "economy_rejected:contract_expired");
  }
  const business = requireBusinessManager(result, request, context);
  if (!business || contract.acceptedByBusinessId !== business.businessId)
    return reject(result, "economy_rejected:contract_not_accepted_by_business");
  for (const req of contract.requirements) {
    if (
      req.itemId &&
      inventoryCount(business.inventory, req.itemId) < positiveInt(req.count, 1)
    ) {
      return reject(
        result,
        `economy_rejected:contract_missing_item:${req.itemId}`
      );
    }
  }
  for (const req of contract.requirements) {
    if (req.itemId)
      applyInventoryDelta(
        business.inventory,
        req.itemId,
        -positiveInt(req.count, 1)
      );
    if (req.serviceNeed && contract.townId) {
      const town = ensureTown(
        result.next,
        contract.townId,
        contract.regionId,
        request.nowMs
      );
      addTownNeed(
        town,
        req.serviceNeed,
        positiveInt(req.serviceUnits, 1),
        request.nowMs
      );
      result.shared.add(townSharedKey(town.townId));
    }
  }
  business.balanceGold += contract.escrowGold;
  business.reputation += contract.reputationDelta;
  business.completedContracts += 1;
  business.activeContracts = business.activeContracts.filter(
    (id) => id !== contract.contractId
  );
  contract.status = "fulfilled";
  contract.completedAtMs = request.nowMs;
  contract.escrowGold = 0;
  contract.logs.push(`fulfilled:${business.businessId}:${request.nowMs}`);
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "contract_fulfilled",
      businessId: business.businessId,
      contractId: contract.contractId,
      amountGold: contract.rewardGold,
    },
    request
  );
  result.touched.add("economy_contract");
  result.touched.add("economy_business_inventory");
  result.shared.add(contractSharedKey(contract.contractId));
  result.shared.add(businessSharedKey(business.businessId));
}

function cancelContract(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const contract = request.contractId
    ? result.next.contracts[request.contractId]
    : undefined;
  if (!contract) return reject(result, "economy_rejected:contract_not_found");
  if (contract.status === "fulfilled")
    return reject(result, "economy_rejected:cannot_cancel_fulfilled_contract");
  const issuerIsActor =
    contract.issuerKind === "player" && contract.issuerId === request.actorId;
  let issuerBusiness: HarthmereEconomyBusinessRecord | undefined;
  if (contract.issuerKind === "business") {
    issuerBusiness = result.next.businesses[contract.issuerId];
  }
  if (
    !issuerIsActor &&
    !(issuerBusiness && canManageBusiness(issuerBusiness, request, context))
  ) {
    return reject(
      result,
      "economy_rejected:contract_cancel_permission_required"
    );
  }
  contract.status = "cancelled";
  if (contract.escrowGold > 0) {
    if (contract.issuerKind === "player")
      result.goldDelta += contract.escrowGold;
    if (issuerBusiness) issuerBusiness.balanceGold += contract.escrowGold;
  }
  contract.escrowGold = 0;
  result.touched.add("economy_contract");
  result.shared.add(contractSharedKey(contract.contractId));
}

function generateTownContracts(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const townId = request.townId ?? HARTHMERE_ECONOMY_DEFAULT_TOWN_ID;
  const regionId = request.regionId ?? HARTHMERE_ECONOMY_DEFAULT_REGION_ID;
  const town = ensureTown(result.next, townId, regionId, request.nowMs);
  const maxContracts = Math.max(1, Math.min(5, positiveInt(request.count, 3)));
  const needs = NEEDS.map((need) => ({
    need,
    shortage: 100 - town.needs[need].value,
    weight: town.needs[need].demandWeight,
  }))
    .filter((row) => row.shortage >= 25)
    .sort((a, b) => b.shortage * b.weight - a.shortage * a.weight)
    .slice(0, maxContracts);
  if (!needs.length)
    return reject(
      result,
      "economy_rejected:town_has_no_contract_shortage",
      "economy_contract_generation"
    );
  for (const row of needs) {
    const reward = Math.max(25, Math.round(row.shortage * row.weight * 4));
    if (town.publicBudgetGold < reward) {
      result.warnings.push(
        `economy_warning:town_budget_insufficient_for_need:${row.need}`
      );
      continue;
    }
    town.publicBudgetGold -= reward;
    const contractId = `econ_contract_${result.next.nextContractNumber++}`;
    const businessType = Object.values(HARTHMERE_ECONOMY_BUSINESS_TYPES).find(
      (def) => def.serviceNeeds.includes(row.need)
    )?.typeId;
    result.next.contracts[contractId] = {
      contractId,
      issuerKind: "town",
      issuerId: townId,
      townId,
      regionId,
      title: `Town need: ${row.need.replace(/_/g, " ")}`,
      businessType,
      requirements: [
        { serviceNeed: row.need, serviceUnits: Math.ceil(row.shortage / 5) },
      ],
      rewardGold: reward,
      reputationDelta: 5,
      status: "open",
      createdAtMs: request.nowMs,
      deadlineAtMs: request.nowMs + 7 * HARTHMERE_ECONOMY_DAY_MS,
      failurePenaltyGold: Math.round(reward * 0.15),
      escrowGold: reward,
      logs: [`town_generated:${row.need}:${request.nowMs}`],
    };
    result.shared.add(contractSharedKey(contractId));
  }
  result.touched.add("economy_contract_generation");
  result.shared.add(townSharedKey(townId));
}

function produceRecipe(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business) return;
  if (business.status !== "open")
    return reject(result, "economy_rejected:business_not_open");
  const recipe = request.recipeId
    ? result.next.recipes[request.recipeId]
    : undefined;
  if (!recipe) return reject(result, "economy_rejected:recipe_not_found");
  if (recipe.businessType !== business.typeId)
    return reject(result, "economy_rejected:recipe_wrong_business_type");
  if (business.licenseLevel < recipe.minimumLicenseLevel)
    return reject(result, "economy_rejected:recipe_license_level_too_low");
  if (business.balanceGold < recipe.energyCostGold)
    return reject(result, "economy_rejected:recipe_energy_cost_unfunded");
  const avgSkill = business.employees.length
    ? business.employees.reduce(
        (sum, id) => sum + (result.next.employees[id]?.skill ?? 0),
        0
      ) / business.employees.length
    : 1;
  if (avgSkill < recipe.skillRequirement)
    return reject(result, "economy_rejected:recipe_skill_requirement_not_met");
  for (const [itemId, count] of Object.entries(recipe.inputs)) {
    if (inventoryCount(business.inventory, itemId) < count)
      return reject(result, `economy_rejected:recipe_missing_input:${itemId}`);
  }
  for (const itemId of Object.keys({
    ...recipe.outputs,
    ...(recipe.wasteOutputs ?? {}),
  })) {
    if (
      !inventoryHasCapacity(
        business.inventory,
        itemId,
        business.storageMaxSlots
      )
    )
      return reject(
        result,
        "economy_rejected:business_storage_full_for_recipe_output"
      );
  }
  for (const [itemId, count] of Object.entries(recipe.inputs))
    applyInventoryDelta(business.inventory, itemId, -count);
  for (const [itemId, count] of Object.entries(recipe.outputs))
    applyInventoryDelta(business.inventory, itemId, count);
  for (const [itemId, count] of Object.entries(recipe.wasteOutputs ?? {}))
    applyInventoryDelta(business.inventory, itemId, count);
  business.balanceGold -= recipe.energyCostGold;
  business.reputation +=
    recipe.riskLevel >= 4 && business.safetyRating < 50 ? -2 : 1;
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "recipe_produced",
      businessId: business.businessId,
      amountGold: -recipe.energyCostGold,
    },
    request
  );
  result.touched.add("economy_production");
  result.shared.add(businessSharedKey(business.businessId));
}

const HARTHMERE_ECONOMY_EMPLOYEE_TASK_ALIASES: Record<string, string> = {
  counter: "front_counter",
  front: "front_counter",
  front_counter: "front_counter",
  service_counter: "front_counter",
  stock: "stock_runner",
  stock_fetch: "stock_runner",
  stock_runner: "stock_runner",
  kitchen: "production_station",
  oven: "production_station",
  prep: "production_station",
  production: "production_station",
  production_station: "production_station",
  quality: "quality_check",
  quality_check: "quality_check",
  inspector: "quality_check",
  cleanup: "cleanup_route",
  cleanup_route: "cleanup_route",
  cleaning: "cleanup_route",
  dispatch: "dispatch_runner",
  route: "dispatch_runner",
  dispatch_runner: "dispatch_runner",
  branch: "branch_manager",
  manager: "branch_manager",
  branch_manager: "branch_manager",
  rest: "rest_required",
  rest_required: "rest_required",
};

function normalizeEmployeeAssignedTask(value: string | undefined) {
  const key = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return key ? HARTHMERE_ECONOMY_EMPLOYEE_TASK_ALIASES[key] : undefined;
}

function hireWorker(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business) return;
  if (business.employees.length >= 30)
    return reject(result, "economy_rejected:business_employee_capacity_full");
  const employeeId =
    request.employeeId ?? `econ_employee_${result.next.nextEmployeeNumber++}`;
  const employeeNpcId =
    request.employeeNpcId ??
    (request.employeeActorId
      ? undefined
      : `generated_worker:${business.businessId}:${employeeId}`);
  if (!request.employeeActorId && !employeeNpcId)
    return reject(result, "economy_rejected:worker_identity_required");
  const role = (request.role ?? "worker").trim().slice(0, 40);
  if (!role || /[<>]/.test(role))
    return reject(result, "economy_rejected:invalid_worker_role");
  const wageNumber = Number(request.wageGoldPerDay ?? 1);
  if (!Number.isFinite(wageNumber) || wageNumber < 1 || wageNumber > 10_000)
    return reject(result, "economy_rejected:invalid_worker_wage");
  const skillNumber = Number(request.skill ?? 1);
  if (!Number.isFinite(skillNumber) || skillNumber < 1 || skillNumber > 10)
    return reject(result, "economy_rejected:invalid_worker_skill");
  if (
    request.employeeActorId &&
    Object.values(result.next.employees).some(
      (employee) => employee.actorId === request.employeeActorId
    )
  ) {
    return reject(result, "economy_rejected:employee_actor_already_hired");
  }
  if (
    employeeNpcId &&
    Object.values(result.next.employees).some(
      (employee) => employee.npcId === employeeNpcId
    )
  ) {
    return reject(result, "economy_rejected:employee_npc_already_hired");
  }
  const wage = Math.max(1, positiveInt(wageNumber, 1));
  if (result.next.employees[employeeId])
    return reject(result, "economy_rejected:employee_already_exists");
  result.next.employees[employeeId] = {
    employeeId,
    businessId: business.businessId,
    actorId: request.employeeActorId,
    npcId: employeeNpcId,
    role,
    skill: clampNumber(skillNumber, 1, 10, 1),
    wageGoldPerDay: wage,
    morale: 65,
    loyalty: 50,
    hiredAtMs: request.nowMs,
    lastPaidAtMs: request.nowMs,
  };
  business.employees.push(employeeId);
  business.wageGoldPerDay += wage;
  business.updatedAtMs = request.nowMs;
  result.touched.add("economy_employee");
  result.shared.add(businessSharedKey(business.businessId));
}

function fireWorker(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business || !request.employeeId) return;
  const employee = result.next.employees[request.employeeId];
  if (!employee || employee.businessId !== business.businessId)
    return reject(result, "economy_rejected:employee_not_found");
  business.employees = business.employees.filter(
    (id) => id !== employee.employeeId
  );
  business.wageGoldPerDay = Math.max(
    0,
    business.wageGoldPerDay - employee.wageGoldPerDay
  );
  delete result.next.employees[employee.employeeId];
  result.touched.add("economy_employee");
  result.shared.add(businessSharedKey(business.businessId));
}

function assignWorker(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business || !request.employeeId) return;
  const employee = result.next.employees[request.employeeId];
  if (!employee || employee.businessId !== business.businessId)
    return reject(result, "economy_rejected:employee_not_found");
  const task = normalizeEmployeeAssignedTask(
    request.assignedTask ?? request.role ?? employee.assignedTask
  );
  if (!task)
    return reject(result, "economy_rejected:invalid_business_employee_task");
  employee.assignedTask = task;
  result.touched.add("economy_employee");
  result.shared.add(businessSharedKey(business.businessId));
}

function payPayroll(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business) return;
  let due = 0;
  for (const employeeId of business.employees) {
    const employee = result.next.employees[employeeId];
    if (!employee) continue;
    const days = Math.max(
      1,
      Math.ceil(
        (request.nowMs - employee.lastPaidAtMs) / HARTHMERE_ECONOMY_DAY_MS
      )
    );
    due += employee.wageGoldPerDay * days;
  }
  if (due <= 0)
    return reject(result, "economy_rejected:no_payroll_due", "economy_payroll");
  if (business.balanceGold < due) {
    for (const employeeId of business.employees) {
      const employee = result.next.employees[employeeId];
      if (employee)
        employee.morale = clampNumber(
          employee.morale - 15,
          0,
          100,
          employee.morale
        );
    }
    business.status = "suspended";
    return reject(result, "economy_rejected:business_payroll_insufficient");
  }
  business.balanceGold -= due;
  for (const employeeId of business.employees) {
    const employee = result.next.employees[employeeId];
    if (employee) {
      employee.lastPaidAtMs = request.nowMs;
      employee.morale = clampNumber(
        employee.morale + 3,
        0,
        100,
        employee.morale
      );
      employee.loyalty = clampNumber(
        employee.loyalty + 1,
        0,
        100,
        employee.loyalty
      );
    }
  }
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "payroll_paid",
      businessId: business.businessId,
      amountGold: -due,
    },
    request
  );
  result.touched.add("economy_payroll");
  result.shared.add(businessSharedKey(business.businessId));
}

function trainWorker(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business || !request.employeeId) return;
  const employee = result.next.employees[request.employeeId];
  if (!employee || employee.businessId !== business.businessId)
    return reject(result, "economy_rejected:employee_not_found");
  const cost = Math.max(20, Math.round(employee.skill * 25));
  if (business.balanceGold < cost)
    return reject(result, "economy_rejected:training_cost_unfunded");
  business.balanceGold -= cost;
  employee.skill = clampNumber(employee.skill + 1, 1, 10, employee.skill);
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "worker_trained",
      businessId: business.businessId,
      amountGold: -cost,
    },
    request
  );
  result.touched.add("economy_employee");
  result.shared.add(businessSharedKey(business.businessId));
}

function runTownTick(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest
) {
  const townId = request.townId ?? HARTHMERE_ECONOMY_DEFAULT_TOWN_ID;
  const regionId = request.regionId ?? HARTHMERE_ECONOMY_DEFAULT_REGION_ID;
  const town = ensureTown(result.next, townId, regionId, request.nowMs);
  const days = Math.max(
    1,
    Math.min(
      30,
      positiveInt(
        request.days,
        Math.ceil(
          (request.nowMs - town.lastTickAtMs) / HARTHMERE_ECONOMY_DAY_MS
        ) || 1
      )
    )
  );
  degradeTownNeeds(town, days, request.nowMs);
  town.serviceCoverage = Object.fromEntries(
    NEEDS.map((need) => [need, 0])
  ) as Record<HarthmereEconomyNeedId, number>;
  for (const business of Object.values(result.next.businesses)) {
    if (business.status !== "open" || business.townId !== townId) continue;
    const def = HARTHMERE_ECONOMY_BUSINESS_TYPES[business.typeId];
    const capacity = serviceCapacityForBusiness(result.next, business);
    for (const need of def.serviceNeeds) {
      if (!businessHasConsumableStockForNeed(business, need)) continue;
      const consumed = consumeOneRelevantStockForNeed(business, need);
      const before = town.needs[need].value;
      const lift = Math.min(capacity, 100 - before);
      if (lift <= 0) continue;
      addTownNeed(town, need, lift, request.nowMs);
      town.serviceCoverage[need] += lift;
      const gross = Math.max(
        2,
        Math.round(lift * (1 + def.civicImportance / 10))
      );
      const tax = collectSalesTax(town, gross, business.salesTaxRate);
      business.balanceGold += gross - tax;
      business.customerSatisfaction = clampNumber(
        business.customerSatisfaction + 1,
        0,
        100,
        business.customerSatisfaction
      );
      if (consumed) {
        const region = ensureRegion(
          result.next,
          business.regionId,
          request.nowMs
        );
        region.itemDemand[consumed] = (region.itemDemand[consumed] ?? 0) + 1;
      }
      result.shared.add(businessSharedKey(business.businessId));
    }
  }
  town.lastTickAtMs = request.nowMs;
  result.touched.add("economy_town_demand");
  result.shared.add(townSharedKey(townId));
}

function runUpkeepTick(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business) return;
  const days = Math.max(
    1,
    Math.min(
      30,
      positiveInt(
        request.days,
        Math.ceil(
          (request.nowMs - business.lastTickAtMs) / HARTHMERE_ECONOMY_DAY_MS
        ) || 1
      )
    )
  );
  const due = Math.round(
    (business.upkeepGoldPerDay + business.rentGoldPerDay) * days
  );
  if (business.balanceGold < due) {
    business.status = business.status === "bankrupt" ? "bankrupt" : "suspended";
    business.customerSatisfaction = clampNumber(
      business.customerSatisfaction - 10,
      0,
      100,
      business.customerSatisfaction
    );
    return reject(result, "economy_rejected:business_upkeep_insufficient");
  }
  business.balanceGold -= due;
  business.lastTickAtMs = request.nowMs;
  if (business.status === "suspended") business.status = "open";
  business.customerSatisfaction = clampNumber(
    business.customerSatisfaction + 1,
    0,
    100,
    business.customerSatisfaction
  );
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "business_upkeep_paid",
      businessId: business.businessId,
      amountGold: -due,
    },
    request
  );
  result.touched.add("economy_upkeep");
  result.shared.add(businessSharedKey(business.businessId));
}

function takeBusinessLoan(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business) return;
  const principal = positiveInt(request.principalGold, 0);
  // Existing debt reduces borrowing capacity. When debt fully consumes capacity the
  // business cannot borrow at all — the 250 floor must not resurrect capacity for a
  // business that is already over-leveraged.
  const rawCap =
    500 +
    business.licenseLevel * 1000 +
    Math.max(0, business.reputation) * 10 -
    business.debtGold;
  const businessOperationsProgress = harthmereSublevelProgress(
    context.actorSkillLevels?.business_operations ?? 1
  );
  const cap = Math.floor(
    Math.max(250, rawCap) * (1 + 0.25 * businessOperationsProgress)
  );
  if (principal <= 0 || rawCap <= 0 || principal > cap)
    return reject(result, "economy_rejected:business_loan_principal_invalid");
  const loanId = `econ_loan_${result.next.nextLoanNumber++}`;
  const baseRate = clampNumber(
    request.dailyInterestRate,
    0.005,
    0.08,
    0.015
  );
  const persuasionTerms = harthmereLoanTermsForPersuasion({
    persuasionLevel: context.actorSkillLevels?.persuasion ?? 1,
    basePrincipal: cap,
    baseDailyInterestRate: baseRate,
    baseDays: 14,
  });
  const dueAtMs = request.dueAtMs
    ? Math.max(
        request.nowMs + 1,
        Math.min(
          request.dueAtMs,
          request.nowMs +
            persuasionTerms.maxDays * HARTHMERE_ECONOMY_DAY_MS
        )
      )
    : request.nowMs + 14 * HARTHMERE_ECONOMY_DAY_MS;
  result.next.loans[loanId] = {
    loanId,
    businessId: business.businessId,
    principalOriginal: principal,
    principalRemaining: principal,
    interestPaid: 0,
    dailyInterestRate: persuasionTerms.dailyInterestRate,
    openedAtMs: request.nowMs,
    dueAtMs,
    status: "active",
  };
  business.balanceGold += principal;
  business.debtGold += principal;
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "business_loan_issued",
      businessId: business.businessId,
      amountGold: principal,
    },
    request
  );
  result.touched.add("economy_loan");
  result.shared.add(businessSharedKey(business.businessId));
}

function payBusinessLoan(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business) return;
  const found = request.loanId ? result.next.loans[request.loanId] : undefined;
  if (!found || found.businessId !== business.businessId)
    return reject(result, "economy_rejected:business_loan_not_found");
  if (found.status === "paid")
    return reject(result, "economy_rejected:business_loan_already_paid");
  const amount = positiveInt(request.amountGold, 0);
  if (amount <= 0)
    return reject(result, "economy_rejected:invalid_loan_payment");
  if (business.balanceGold < amount)
    return reject(
      result,
      "economy_rejected:business_balance_insufficient_for_loan_payment"
    );
  const balance = calculateLoanBalance(found, request.nowMs);
  // Only charge the borrower for what actually goes toward the loan; an overpayment
  // beyond the outstanding balance must not be silently burned.
  const applied = Math.min(amount, balance.totalRemaining);
  let remaining = applied;
  const interestPaid = Math.min(balance.interestRemaining, remaining);
  found.interestPaid += interestPaid;
  remaining -= interestPaid;
  const principalPaid = Math.min(found.principalRemaining, remaining);
  found.principalRemaining -= principalPaid;
  business.debtGold = Math.max(0, business.debtGold - principalPaid);
  business.balanceGold -= applied;
  if (
    found.principalRemaining <= 0 &&
    calculateLoanBalance(found, request.nowMs).interestRemaining <= 0
  )
    found.status = "paid";
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "business_loan_payment",
      businessId: business.businessId,
      amountGold: -applied,
    },
    request
  );
  result.touched.add("economy_loan");
  result.shared.add(businessSharedKey(business.businessId));
}

function buyInsurance(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business) return;
  const coverage = positiveInt(request.coverageGold, 0);
  const premium = positiveInt(
    request.premiumGoldPerDay,
    Math.ceil(coverage * 0.01)
  );
  const deductible = positiveInt(
    request.deductibleGold,
    Math.ceil(coverage * 0.1)
  );
  if (!request.coverageKind || coverage <= 0)
    return reject(result, "economy_rejected:invalid_insurance_policy");
  // The policy grants a full term of coverage up front, so the premium owed is the
  // per-day rate across the whole term. Charging a single day's premium for 30 days of
  // claimable coverage is a money-printing exploit (pay 1% of coverage, claim up to 100%).
  const termPremium = premium * HARTHMERE_ECONOMY_INSURANCE_TERM_DAYS;
  if (business.balanceGold < termPremium)
    return reject(result, "economy_rejected:insurance_premium_unfunded");
  const policyId = `econ_policy_${result.next.nextPolicyNumber++}`;
  business.balanceGold -= termPremium;
  result.next.insurancePolicies[policyId] = {
    policyId,
    businessId: business.businessId,
    coverageKind: request.coverageKind,
    coverageGold: coverage,
    deductibleGold: deductible,
    premiumGoldPerDay: premium,
    status: "active",
    purchasedAtMs: request.nowMs,
    expiresAtMs:
      request.nowMs +
      HARTHMERE_ECONOMY_INSURANCE_TERM_DAYS * HARTHMERE_ECONOMY_DAY_MS,
    lastPremiumPaidAtMs: request.nowMs,
    claimsPaidGold: 0,
  };
  result.touched.add("economy_insurance");
  result.shared.add(businessSharedKey(business.businessId));
}

function recordFailureEvent(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business) return;
  const severity = clampNumber(request.severity, 1, 10, 1);
  const failureId = `econ_failure_${result.next.nextFailureNumber++}`;
  result.next.failures[failureId] = {
    failureId,
    businessId: business.businessId,
    kind: request.failureKind ?? "operational_failure",
    severity,
    cause: (request.cause ?? "unspecified").slice(0, 120),
    createdAtMs: request.nowMs,
    repairCostGold: positiveInt(
      request.repairCostGold,
      Math.round(severity * 25)
    ),
  };
  business.customerSatisfaction = clampNumber(
    business.customerSatisfaction - severity * 3,
    0,
    100,
    business.customerSatisfaction
  );
  business.reputation -= Math.round(severity / 2);
  if (severity >= 7) business.status = "suspended";
  result.touched.add("economy_failure");
  result.shared.add(businessSharedKey(business.businessId));
}

function resolveFailureEvent(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business || !request.failureId) return;
  const failure = result.next.failures[request.failureId];
  if (!failure || failure.businessId !== business.businessId)
    return reject(result, "economy_rejected:failure_not_found");
  if (failure.resolvedAtMs)
    return reject(result, "economy_rejected:failure_already_resolved");
  if (business.balanceGold < failure.repairCostGold)
    return reject(result, "economy_rejected:failure_repair_unfunded");
  business.balanceGold -= failure.repairCostGold;
  failure.resolvedAtMs = request.nowMs;
  if (business.status === "suspended") business.status = "open";
  business.customerSatisfaction = clampNumber(
    business.customerSatisfaction + 5,
    0,
    100,
    business.customerSatisfaction
  );
  result.touched.add("economy_failure");
  result.shared.add(businessSharedKey(business.businessId));
}

function fileInsuranceClaim(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business || !request.policyId || !request.failureId) return;
  const policy = result.next.insurancePolicies[request.policyId];
  const failure = result.next.failures[request.failureId];
  if (
    !policy ||
    policy.businessId !== business.businessId ||
    policy.status !== "active"
  )
    return reject(result, "economy_rejected:insurance_policy_not_active");
  if (!failure || failure.businessId !== business.businessId)
    return reject(result, "economy_rejected:failure_not_found");
  if (failure.insuranceClaimId)
    return reject(result, "economy_rejected:failure_claim_already_filed");
  if (policy.expiresAtMs <= request.nowMs)
    return reject(result, "economy_rejected:insurance_policy_expired");
  if (
    policy.coverageKind !== failure.kind &&
    policy.coverageKind !== "all_risk"
  )
    return reject(result, "economy_rejected:insurance_coverage_mismatch");
  const payout = Math.max(
    0,
    Math.min(
      policy.coverageGold - policy.claimsPaidGold,
      failure.repairCostGold - policy.deductibleGold
    )
  );
  if (payout <= 0)
    return reject(result, "economy_rejected:insurance_claim_below_deductible");
  business.balanceGold += payout;
  policy.claimsPaidGold += payout;
  failure.insuranceClaimId = `claim:${policy.policyId}:${failure.failureId}`;
  pushLedger(
    result,
    {
      id: request.requestId,
      kind: "insurance_claim_paid",
      businessId: business.businessId,
      amountGold: payout,
    },
    request
  );
  result.touched.add("economy_insurance");
  result.shared.add(businessSharedKey(business.businessId));
}

function registerTradeRoute(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const ownerKind = request.ownerKind ?? "player";
  const ownerId = request.ownerId ?? request.actorId;
  if (!validateOwner(result, ownerKind, ownerId, request, context)) return;
  const origin = request.originTownId;
  const destination = request.destinationTownId;
  if (!origin || !destination || origin === destination)
    return reject(result, "economy_rejected:invalid_trade_route_towns");
  const distance = Math.max(1, positiveInt(request.distanceUnits, 1));
  const cost = Math.round(distance * 20);
  if (ownerKind === "player" && context.actorGold + result.goldDelta < cost)
    return reject(result, "economy_rejected:trade_route_setup_unfunded");
  const routeId = `econ_route_${result.next.nextRouteNumber++}`;
  result.next.tradeRoutes[routeId] = {
    routeId,
    ownerKind,
    ownerId,
    originTownId: origin,
    destinationTownId: destination,
    distanceUnits: distance,
    safetyRating: clampNumber(request.safetyRating, 0, 100, 50),
    transitFeeGold: positiveInt(
      request.transitFeeGold,
      Math.round(distance * 3)
    ),
    createdAtMs: request.nowMs,
    active: true,
  };
  if (ownerKind === "player") result.goldDelta -= cost;
  ensureTown(
    result.next,
    origin,
    request.regionId ?? HARTHMERE_ECONOMY_DEFAULT_REGION_ID,
    request.nowMs
  );
  ensureTown(
    result.next,
    destination,
    request.regionId ?? HARTHMERE_ECONOMY_DEFAULT_REGION_ID,
    request.nowMs
  );
  result.touched.add("economy_logistics");
}

function shipGoods(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const from = requireBusinessManager(result, request, context);
  const to = request.toBusinessId
    ? result.next.businesses[request.toBusinessId]
    : undefined;
  const route = request.routeId
    ? result.next.tradeRoutes[request.routeId]
    : undefined;
  const itemId = request.itemId;
  const count = positiveInt(request.count, 1);
  if (!from || !to || !route || !itemId)
    return reject(result, "economy_rejected:invalid_shipment");
  if (!route.active)
    return reject(result, "economy_rejected:trade_route_inactive");
  if (inventoryCount(from.inventory, itemId) < count)
    return reject(result, "economy_rejected:shipment_inventory_insufficient");
  if (!inventoryHasCapacity(to.inventory, itemId, to.storageMaxSlots))
    return reject(result, "economy_rejected:destination_storage_full");
  const fee = route.transitFeeGold * count;
  if (from.balanceGold < fee)
    return reject(result, "economy_rejected:shipment_fee_unfunded");
  if (route.safetyRating < 25) {
    const failureId = `econ_failure_${result.next.nextFailureNumber++}`;
    result.next.failures[failureId] = {
      failureId,
      businessId: from.businessId,
      kind: "shipment_loss",
      severity: 5,
      cause: "unsafe_route",
      createdAtMs: request.nowMs,
      repairCostGold: Math.round(fee * 1.5),
    };
    return reject(
      result,
      "economy_rejected:shipment_route_too_unsafe",
      "economy_logistics"
    );
  }
  from.balanceGold -= fee;
  applyInventoryDelta(from.inventory, itemId, -count);
  applyInventoryDelta(to.inventory, itemId, count);
  const region = ensureRegion(result.next, from.regionId, request.nowMs);
  region.itemSupply[itemId] = (region.itemSupply[itemId] ?? 0) + count;
  result.touched.add("economy_logistics");
  result.shared.add(businessSharedKey(from.businessId));
  result.shared.add(businessSharedKey(to.businessId));
}

function registerNpcBusiness(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  if (!context.allowNpcAdministration)
    return reject(
      result,
      "economy_rejected:npc_business_requires_admin_context"
    );
  return registerBusiness(
    result,
    {
      ...request,
      ownerKind: "npc",
      ownerId: request.ownerId ?? request.employeeNpcId ?? "npc_owner",
      name: request.name ?? "NPC Business",
    },
    context
  );
}

function runNpcCompetitionTick(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest
) {
  const regionId = request.regionId ?? HARTHMERE_ECONOMY_DEFAULT_REGION_ID;
  const region = ensureRegion(result.next, regionId, request.nowMs);
  for (const business of Object.values(result.next.businesses)) {
    if (
      business.ownerKind !== "npc" ||
      business.status !== "open" ||
      business.regionId !== regionId
    )
      continue;
    const def = HARTHMERE_ECONOMY_BUSINESS_TYPES[business.typeId];
    for (const family of def.outputItemFamilies) {
      region.itemSupply[family] =
        (region.itemSupply[family] ?? 0) + Math.max(1, business.licenseLevel);
      region.priceIndex[family] = clampNumber(
        (region.priceIndex[family] ?? 1) * 0.98,
        0.4,
        4,
        1
      );
    }
  }
  region.lastTickAtMs = request.nowMs;
  result.touched.add("economy_npc_competition");
}

function postMarketOrder(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const business = requireBusinessManager(result, request, context);
  if (!business || !request.itemId || !request.orderKind) return;
  const count = positiveInt(request.count, 1);
  const unitPrice = positiveInt(
    request.unitPriceGold,
    economyBasePriceForItem(request.itemId)
  );
  if (count <= 0 || unitPrice <= 0)
    return reject(result, "economy_rejected:invalid_market_order");
  let escrowGold = 0;
  let escrowItems = 0;
  if (request.orderKind === "sell") {
    if (inventoryCount(business.inventory, request.itemId) < count)
      return reject(
        result,
        "economy_rejected:market_sell_inventory_insufficient"
      );
    applyInventoryDelta(business.inventory, request.itemId, -count);
    escrowItems = count;
  } else {
    escrowGold = count * unitPrice;
    if (business.balanceGold < escrowGold)
      return reject(result, "economy_rejected:market_buy_escrow_insufficient");
    business.balanceGold -= escrowGold;
  }
  const orderId = `econ_market_${result.next.nextMarketOrderNumber++}`;
  result.next.marketOrders[orderId] = {
    orderId,
    kind: request.orderKind,
    businessId: business.businessId,
    itemId: request.itemId,
    count,
    unitPriceGold: unitPrice,
    status: "open",
    createdAtMs: request.nowMs,
    expiresAtMs:
      request.deadlineAtMs ?? request.nowMs + 7 * HARTHMERE_ECONOMY_DAY_MS,
    escrowGold,
    escrowItems,
  };
  result.touched.add("economy_market");
  result.shared.add(businessSharedKey(business.businessId));
}

function settleMarketOrder(
  result: MutableResult,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
) {
  const order = request.orderId
    ? result.next.marketOrders[request.orderId]
    : undefined;
  const business = requireBusinessManager(result, request, context);
  if (!order || !business) return;
  if (order.status !== "open")
    return reject(result, "economy_rejected:market_order_not_open");
  if (order.expiresAtMs <= request.nowMs) {
    order.status = "expired";
    return reject(result, "economy_rejected:market_order_expired");
  }
  const ownerBusiness = result.next.businesses[order.businessId];
  if (!ownerBusiness)
    return reject(result, "economy_rejected:market_order_owner_missing");
  const total = order.count * order.unitPriceGold;
  const fee = Math.round(total * HARTHMERE_ECONOMY_MARKET_FEE_RATE);
  if (order.kind === "sell") {
    if (business.balanceGold < total)
      return reject(result, "economy_rejected:market_buyer_funds_insufficient");
    if (
      !inventoryHasCapacity(
        business.inventory,
        order.itemId,
        business.storageMaxSlots
      )
    )
      return reject(result, "economy_rejected:market_buyer_storage_full");
    business.balanceGold -= total;
    ownerBusiness.balanceGold += Math.max(0, total - fee);
    applyInventoryDelta(business.inventory, order.itemId, order.count);
    order.escrowItems = 0;
  } else {
    if (inventoryCount(business.inventory, order.itemId) < order.count)
      return reject(
        result,
        "economy_rejected:market_seller_inventory_insufficient"
      );
    applyInventoryDelta(business.inventory, order.itemId, -order.count);
    applyInventoryDelta(ownerBusiness.inventory, order.itemId, order.count);
    business.balanceGold += Math.max(0, total - fee);
    order.escrowGold = 0;
  }
  order.status = "filled";
  const town = ownerBusiness.townId
    ? ensureTown(
        result.next,
        ownerBusiness.townId,
        ownerBusiness.regionId,
        request.nowMs
      )
    : undefined;
  if (town) town.publicBudgetGold += fee;
  result.touched.add("economy_market");
  result.shared.add(businessSharedKey(business.businessId));
  result.shared.add(businessSharedKey(ownerBusiness.businessId));
}

export function reduceHarthmereEconomyMutation(
  state: HarthmereProductionEconomyState,
  request: HarthmereEconomyMutationRequest,
  context: HarthmereEconomyMutationContext
): HarthmereEconomyMutationResult {
  const result = makeResult(state);
  switch (request.operation) {
    case "register_business":
      registerBusiness(result, request, context);
      break;
    case "register_npc_business":
      registerNpcBusiness(result, request, context);
      break;
    case "issue_license":
      issueLicense(result, request, context);
      break;
    case "open_business":
      openBusiness(result, request, context);
      break;
    case "set_business_prices":
      setBusinessPrices(result, request, context);
      break;
    case "business_daily_check_in":
      businessDailyCheckIn(result, request, context);
      break;
    case "set_business_tax":
      setBusinessTax(result, request, context);
      break;
    case "deposit_business_inventory":
      depositBusinessInventory(result, request, context);
      break;
    case "withdraw_business_inventory":
      withdrawBusinessInventory(result, request, context);
      break;
    case "record_customer_sale":
      recordCustomerSale(result, request, context);
      break;
    case "buy_business_tool":
      buyBusinessTool(result, request, context);
      break;
    case "buy_storefront_good":
      buyStorefrontGood(result, request, context);
      break;
    case "create_contract":
      createContract(result, request, context);
      break;
    case "accept_contract":
      acceptContract(result, request, context);
      break;
    case "fulfill_contract":
      fulfillContract(result, request, context);
      break;
    case "cancel_contract":
      cancelContract(result, request, context);
      break;
    case "generate_town_contracts":
      generateTownContracts(result, request, context);
      break;
    case "produce_recipe":
      produceRecipe(result, request, context);
      break;
    case "hire_worker":
      hireWorker(result, request, context);
      break;
    case "fire_worker":
      fireWorker(result, request, context);
      break;
    case "assign_worker":
      assignWorker(result, request, context);
      break;
    case "train_worker":
      trainWorker(result, request, context);
      break;
    case "pay_payroll":
      payPayroll(result, request, context);
      break;
    case "run_town_tick":
      runTownTick(result, request);
      break;
    case "run_upkeep_tick":
      runUpkeepTick(result, request, context);
      break;
    case "take_business_loan":
      takeBusinessLoan(result, request, context);
      break;
    case "pay_business_loan":
      payBusinessLoan(result, request, context);
      break;
    case "buy_insurance":
      buyInsurance(result, request, context);
      break;
    case "record_failure_event":
      recordFailureEvent(result, request, context);
      break;
    case "resolve_failure_event":
      resolveFailureEvent(result, request, context);
      break;
    case "file_insurance_claim":
      fileInsuranceClaim(result, request, context);
      break;
    case "register_trade_route":
      registerTradeRoute(result, request, context);
      break;
    case "ship_goods":
      shipGoods(result, request, context);
      break;
    case "run_npc_competition_tick":
      runNpcCompetitionTick(result, request);
      break;
    case "post_market_order":
      postMarketOrder(result, request, context);
      break;
    case "settle_market_order":
      settleMarketOrder(result, request, context);
      break;
    default: {
      const businessSpecific = reduceHarthmereEconomyBusinessSpecificMutation(
        result.next,
        request,
        context
      );
      if (!businessSpecific.handled) {
        reject(
          result,
          `economy_rejected:unsupported_operation:${request.operation}`
        );
        break;
      }
      result.next = businessSpecific.economy;
      result.goldDelta += businessSpecific.inventoryGoldDelta;
      for (const [itemId, delta] of Object.entries(
        businessSpecific.inventoryItemDeltas
      )) {
        recordItemDelta(result.itemDeltas, itemId, delta);
      }
      for (const warning of businessSpecific.warnings)
        result.warnings.push(warning);
      for (const model of businessSpecific.touchedModels)
        result.touched.add(model);
      for (const key of businessSpecific.sharedStateKeys)
        result.shared.add(key);
      for (const plan of businessSpecific.buildingMaterializationPlans ?? []) {
        result.buildingMaterializationPlans.push(plan);
      }
      break;
    }
  }
  return finalizeResult(result);
}

export function createHarthmereProductionEconomyClientSnapshot(
  state: HarthmereProductionEconomyState,
  actorId: string,
  actorKnownRecipes: readonly string[] = []
) {
  const actorBusinesses = Object.values(state.businesses).filter(
    (business) =>
      business.ownerKind === "player" && business.ownerId === actorId
  );
  const openContracts = Object.values(state.contracts).filter(
    (contract) => contract.status === "open"
  );
  const activeContracts = Object.values(state.contracts).filter(
    (contract) =>
      contract.status === "active" &&
      actorBusinesses.some(
        (business) => business.businessId === contract.acceptedByBusinessId
      )
  );
  return {
    version: state.version,
    actorId,
    actorKnownRecipes: [...actorKnownRecipes],
    businessTypes: HARTHMERE_ECONOMY_BUSINESS_TYPES,
    recipeCatalog: state.recipes,
    businesses: state.businesses,
    myBusinesses: actorBusinesses,
    licenses: state.licenses,
    towns: state.towns,
    regions: state.regions,
    openContracts,
    activeContracts,
    employees: state.employees,
    loans: state.loans,
    insurancePolicies: state.insurancePolicies,
    tradeRoutes: state.tradeRoutes,
    failures: state.failures,
    marketOrders: state.marketOrders,
    businessSystems:
      createHarthmereProductionEconomyBusinessSystemsClientSnapshot(
        (state as any).businessSystems,
        actorId
      ),
    balanceWarnings: validateHarthmereEconomyBalance(state),
    ledger: state.ledger.slice(-100),
  };
}

export function createHarthmereProductionEconomyBusinessSystemsClientSnapshot(
  raw: unknown,
  actorId: string
) {
  const systems = normalizeHarthmereEconomyBusinessSystemsState(raw);
  const outpostBuildings = Object.fromEntries(
    Object.entries(systems.outpostBuildings).map(([outpostId, building]) => {
      const materializationPlan = (building as any).materializationPlan;
      const edits = Array.isArray(materializationPlan?.edits)
        ? materializationPlan.edits
        : [];
      return [
        outpostId,
        {
          ...building,
          materializationPlan: materializationPlan
            ? {
                ...materializationPlan,
                edits: [],
                editCount: edits.length,
              }
            : materializationPlan,
        },
      ];
    })
  );
  return {
    ...systems,
    customerSessions: Object.fromEntries(
      Object.entries(systems.customerSessions).filter(
        ([, session]) => session.actorId === actorId
      )
    ),
    outpostBuildings,
  };
}
