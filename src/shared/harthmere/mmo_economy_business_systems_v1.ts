/*
 * mmo_economy_business_systems_v1.ts
 *
 * Business-specific production simulation layer for Harthmere's economy.
 * Runtime state starts empty. Every object here is created by an explicit
 * backend mutation: properties, accounts, crops, threats, patients, routes,
 * portals, sanitation sites, delivery escrows, hotel rooms, and permissions.
 */

import type {
  HarthmereEconomyBusinessRecordV1,
  HarthmereEconomyBusinessTypeIdV1,
  HarthmereEconomyInventoryRecordV1,
  HarthmereEconomyMutationContextV1,
  HarthmereEconomyMutationRequestV1,
  HarthmereProductionEconomyStateV1,
} from "./mmo_economy_authority_v1";
import type { BuildingSystemAnyMaterializationPlanV1 } from "./building_system_v1";
import {
  applyHarthmereBusinessCozyServiceRewardV1,
  activeHarthmereBusinessCustomerTicketV1,
  createHarthmereBusinessCozyServiceRewardV1,
  createHarthmereBusinessCustomerQueueV1,
  defaultHarthmereBusinessCustomerStatsV1,
  findHarthmereBusinessCustomerNpcV1,
  getHarthmereBusinessMiniGameDefinitionV1,
  getHarthmereBusinessServiceItemDefinitionV1,
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1,
  harthmereBusinessCustomerTierForStatsV1,
  normalizeHarthmereBusinessCustomerStatsV1,
  validateHarthmereBusinessOutpostLiveWorldNavigationV1,
  validateHarthmereBusinessOutpostPassabilityV1,
  validateHarthmereBusinessServiceItemReferencesV1,
  type HarthmereBusinessCustomerSessionV1,
  type HarthmereBusinessCustomerStatsV1,
  type HarthmereBusinessOutpostProceduralBuildingRecordV1,
} from "./business_customer_simulator_v1";
import {
  generateHarthmereBusinessEmployeeCandidatesV1,
  interviewHarthmereBusinessEmployeeCandidateV1,
  negotiateHarthmereBusinessEmployeeCandidateV1,
  simulateHarthmereBusinessEmployeeTaskRunV1,
  validateHarthmereBusinessEmployeeAssignedTaskV1,
  type HarthmereBusinessEmployeeAssignableTaskIdV1,
  type HarthmereBusinessEmployeeAutomationRoleV1,
  type HarthmereBusinessEmployeeCandidateV1,
  type HarthmereBusinessEmployeeInterviewStyleV1,
  type HarthmereBusinessEmployeeTaskRunV1,
} from "./business_employee_ai_v1";

export const HARTHMERE_ECONOMY_BUSINESS_SYSTEMS_VERSION_V1 =
  "harthmere-economy-business-systems-v1" as const;

export type HarthmereEconomyBusinessPermissionV1 =
  | "employee_manager"
  | "accountant"
  | "inventory_manager"
  | "contract_manager"
  | "route_manager"
  | "price_manager"
  | "world_operator"
  | "owner_admin";

export interface HarthmereEconomyBusinessBankAccountV1 {
  accountId: string;
  businessId: string;
  ownerKind: string;
  ownerId: string;
  balanceGold: number;
  status: "active" | "frozen" | "closed";
  createdAtMs: number;
  audit: HarthmereEconomyBusinessAuditEntryV1[];
}

export interface HarthmereEconomyBusinessAuditEntryV1 {
  auditId: string;
  atMs: number;
  actorId: string;
  businessId?: string;
  kind: string;
  amountGold?: number;
  itemDeltas?: Record<string, number>;
  before?: number;
  after?: number;
  reason?: string;
}

export interface HarthmereEconomyPropertyIntegrationV1 {
  propertyId: string;
  businessId?: string;
  ownerKind?: string;
  ownerId?: string;
  buildingType?: string;
  valueGold: number;
  condition: number;
  cleanliness: number;
  beauty: number;
  rentGoldPerDay: number;
  constructionStage: number;
  constructionComplete: boolean;
  permits: string[];
  collateralLoanId?: string;
  lastRentPaidAtMs?: number;
}

export interface HarthmereEconomyBiomeAnchorStateV1 {
  anchorId: string;
  propertyId: string;
  condition: number;
  climateStability: number;
  weatherFailure: boolean;
  timelineLeak: number;
  lastMaintainedAtMs: number;
}

export interface HarthmereEconomyThreatStateV1 {
  threatId: string;
  townId: string;
  kind: string;
  severity: number;
  status: "active" | "contained" | "failed";
  bountyGold: number;
  assignedBusinessId?: string;
  createdAtMs: number;
  resolvedAtMs?: number;
}

export interface HarthmereEconomyPortalEndpointV1 {
  endpointId: string;
  businessId: string;
  originTownId: string;
  destinationTownId: string;
  fuelUnits: number;
  uptime: number;
  active: boolean;
  safetyRating: number;
  passengerFeesGold: number;
  cargoFeesGold: number;
}

export interface HarthmereEconomyTeleportPadV1 {
  padId: string;
  businessId: string;
  locationId: string;
  linkedDestinationId: string;
  fuelUnits: number;
  stability: number;
  accessKeys: Record<string, { actorId: string; expiresAtMs: number }>;
  usesToday: number;
}

export interface HarthmereEconomyCropNodeV1 {
  cropId: string;
  businessId: string;
  townId: string;
  cropItemId: string;
  climate: string;
  plantedAtMs: number;
  growth: number;
  health: number;
  spoiledAtMs?: number;
  harvested: boolean;
}

export interface HarthmereEconomyAnimalPopulationV1 {
  populationId: string;
  townId: string;
  species: string;
  count: number;
  protected: boolean;
  overhuntedUntilMs?: number;
}

export interface HarthmereEconomyContaminationSiteV1 {
  siteId: string;
  townId: string;
  severity: number;
  kind: string;
  outbreakRisk: number;
  status: "active" | "contained" | "clean";
  createdAtMs: number;
  cleanedAtMs?: number;
}

export interface HarthmereEconomyPatientStateV1 {
  patientId: string;
  actorId?: string;
  townId: string;
  conditionKind: string;
  severity: number;
  status: "sick" | "treated" | "failed";
  createdAtMs: number;
  treatedAtMs?: number;
}

export interface HarthmereEconomyDurableItemStateV1 {
  durableItemId: string;
  ownerId: string;
  itemId: string;
  condition: number;
  quality: number;
  restricted: boolean;
  upgraded: boolean;
}

export interface HarthmereEconomyExplorationRouteV1 {
  routeId: string;
  businessId: string;
  originTownId: string;
  destinationId: string;
  safetyRating: number;
  mapFreshness: number;
  discoveredAtMs: number;
  lastSurveyedAtMs: number;
}

export interface HarthmereEconomyDeliveryStateV1 {
  deliveryId: string;
  courierBusinessId: string;
  fromBusinessId?: string;
  toBusinessId?: string;
  itemId: string;
  count: number;
  escrowGold: number;
  deadlineAtMs: number;
  condition: number;
  status: "active" | "delivered" | "lost" | "damaged" | "expired";
}

export interface HarthmereEconomyHospitalityStateV1 {
  hospitalityId: string;
  businessId: string;
  rooms: number;
  occupiedRooms: number;
  cleanliness: number;
  safety: number;
  shelterBeds: number;
  refugeeContractActive: boolean;
}

export interface HarthmereEconomyBusinessServiceQuestV1 {
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
  completedAtMs?: number;
}

export type HarthmereEconomyBusinessAutomationRoleV1 =
  | "front_counter"
  | "branch_manager"
  | "courier_dispatch"
  | "purchasing_manager"
  | "quality_inspector";

export interface HarthmereEconomyBusinessBranchV1 {
  branchId: string;
  parentBusinessId: string;
  businessType: HarthmereEconomyBusinessTypeIdV1;
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
  warehouseSlots: number;
  warehouseInventory: Record<string, number>;
  scheduledStaffIds: string[];
  regionalDemandMultiplier: number;
  competitorPressure: number;
  lastDashboardAtMs?: number;
  branchNotes: string[];
}

export interface HarthmereEconomyBusinessBranchDashboardV1 {
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

export interface HarthmereEconomyBusinessAutomationV1 {
  automationId: string;
  businessId: string;
  branchId?: string;
  role: HarthmereEconomyBusinessAutomationRoleV1;
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

export interface HarthmereEconomyBusinessSystemsStateV1 {
  version: typeof HARTHMERE_ECONOMY_BUSINESS_SYSTEMS_VERSION_V1;
  permissions: Record<string, Record<string, HarthmereEconomyBusinessPermissionV1[]>>;
  bankAccounts: Record<string, HarthmereEconomyBusinessBankAccountV1>;
  propertyIntegrations: Record<string, HarthmereEconomyPropertyIntegrationV1>;
  biomeAnchors: Record<string, HarthmereEconomyBiomeAnchorStateV1>;
  threats: Record<string, HarthmereEconomyThreatStateV1>;
  portalEndpoints: Record<string, HarthmereEconomyPortalEndpointV1>;
  teleportPads: Record<string, HarthmereEconomyTeleportPadV1>;
  cropNodes: Record<string, HarthmereEconomyCropNodeV1>;
  animalPopulations: Record<string, HarthmereEconomyAnimalPopulationV1>;
  contaminationSites: Record<string, HarthmereEconomyContaminationSiteV1>;
  patients: Record<string, HarthmereEconomyPatientStateV1>;
  durableItems: Record<string, HarthmereEconomyDurableItemStateV1>;
  explorationRoutes: Record<string, HarthmereEconomyExplorationRouteV1>;
  deliveries: Record<string, HarthmereEconomyDeliveryStateV1>;
  hospitality: Record<string, HarthmereEconomyHospitalityStateV1>;
  menuByBusiness: Record<string, string[]>;
  unstableMagicItems: Record<string, { businessId: string; itemId: string; expiresAtMs: number; stability: number }>;
  serviceQuests: Record<string, HarthmereEconomyBusinessServiceQuestV1>;
  customerSessions: Record<string, HarthmereBusinessCustomerSessionV1>;
  customerStats: Record<string, HarthmereBusinessCustomerStatsV1>;
  outpostBuildings: Record<string, HarthmereBusinessOutpostProceduralBuildingRecordV1>;
  empireBranches: Record<string, HarthmereEconomyBusinessBranchV1>;
  branchDashboards: Record<string, HarthmereEconomyBusinessBranchDashboardV1>;
  automationAssignments: Record<string, HarthmereEconomyBusinessAutomationV1>;
  employeeCandidates: Record<string, HarthmereBusinessEmployeeCandidateV1>;
  employeeTaskRuns: Record<string, HarthmereBusinessEmployeeTaskRunV1>;
  balanceReports: string[];
  nextAccountNumber: number;
  nextPropertyNumber: number;
  nextAnchorNumber: number;
  nextThreatNumber: number;
  nextPortalNumber: number;
  nextTeleportNumber: number;
  nextCropNumber: number;
  nextAnimalPopulationNumber: number;
  nextContaminationNumber: number;
  nextPatientNumber: number;
  nextDurableItemNumber: number;
  nextRouteNumber: number;
  nextDeliveryNumber: number;
  nextHospitalityNumber: number;
  nextMagicNumber: number;
  nextAuditNumber: number;
  nextServiceQuestNumber: number;
  nextCustomerSessionNumber: number;
  nextCustomerTicketNumber: number;
  nextBranchNumber: number;
  nextAutomationNumber: number;
  nextEmployeeCandidateNumber: number;
  nextEmployeeTaskRunNumber: number;
}

export interface HarthmereEconomyBusinessSpecificMutationResultV1 {
  handled: boolean;
  economy: HarthmereProductionEconomyStateV1;
  inventoryGoldDelta: number;
  inventoryItemDeltas: Record<string, number>;
  warnings: string[];
  touchedModels: string[];
  sharedStateKeys: string[];
  buildingMaterializationPlans?: BuildingSystemAnyMaterializationPlanV1[];
}

type BusinessSystemsEconomyState = HarthmereProductionEconomyStateV1 & {
  businessSystems?: HarthmereEconomyBusinessSystemsStateV1;
};

type BusinessSystemsContext = HarthmereEconomyMutationContextV1 & {
  businessPermissions?: Record<string, HarthmereEconomyBusinessPermissionV1[]>;
  actorGuildPermissions?: Record<string, HarthmereEconomyBusinessPermissionV1[]>;
  actorTownPermissions?: Record<string, HarthmereEconomyBusinessPermissionV1[]>;
  actorBankAccountPermissions?: Record<string, HarthmereEconomyBusinessPermissionV1[]>;
};

function defaultBusinessSystemsState(nowMs = 0): HarthmereEconomyBusinessSystemsStateV1 {
  void nowMs;
  return {
    version: HARTHMERE_ECONOMY_BUSINESS_SYSTEMS_VERSION_V1,
    permissions: {},
    bankAccounts: {},
    propertyIntegrations: {},
    biomeAnchors: {},
    threats: {},
    portalEndpoints: {},
    teleportPads: {},
    cropNodes: {},
    animalPopulations: {},
    contaminationSites: {},
    patients: {},
    durableItems: {},
    explorationRoutes: {},
    deliveries: {},
    hospitality: {},
    menuByBusiness: {},
    unstableMagicItems: {},
    serviceQuests: {},
    customerSessions: {},
    customerStats: {},
    outpostBuildings: { ...HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1 },
    empireBranches: {},
    branchDashboards: {},
    automationAssignments: {},
    employeeCandidates: {},
    employeeTaskRuns: {},
    balanceReports: [],
    nextAccountNumber: 1,
    nextPropertyNumber: 1,
    nextAnchorNumber: 1,
    nextThreatNumber: 1,
    nextPortalNumber: 1,
    nextTeleportNumber: 1,
    nextCropNumber: 1,
    nextAnimalPopulationNumber: 1,
    nextContaminationNumber: 1,
    nextPatientNumber: 1,
    nextDurableItemNumber: 1,
    nextRouteNumber: 1,
    nextDeliveryNumber: 1,
    nextHospitalityNumber: 1,
    nextMagicNumber: 1,
    nextAuditNumber: 1,
    nextServiceQuestNumber: 1,
    nextCustomerSessionNumber: 1,
    nextCustomerTicketNumber: 1,
    nextBranchNumber: 1,
    nextAutomationNumber: 1,
    nextEmployeeCandidateNumber: 1,
    nextEmployeeTaskRunNumber: 1,
  };
}

export function normalizeHarthmereEconomyBusinessSystemsStateV1(raw: unknown): HarthmereEconomyBusinessSystemsStateV1 {
  const defaults = defaultBusinessSystemsState();
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<HarthmereEconomyBusinessSystemsStateV1>;
  return {
    ...defaults,
    ...value,
    version: HARTHMERE_ECONOMY_BUSINESS_SYSTEMS_VERSION_V1,
    permissions: { ...(value.permissions ?? {}) },
    bankAccounts: { ...(value.bankAccounts ?? {}) },
    propertyIntegrations: { ...(value.propertyIntegrations ?? {}) },
    biomeAnchors: { ...(value.biomeAnchors ?? {}) },
    threats: { ...(value.threats ?? {}) },
    portalEndpoints: { ...(value.portalEndpoints ?? {}) },
    teleportPads: { ...(value.teleportPads ?? {}) },
    cropNodes: { ...(value.cropNodes ?? {}) },
    animalPopulations: { ...(value.animalPopulations ?? {}) },
    contaminationSites: { ...(value.contaminationSites ?? {}) },
    patients: { ...(value.patients ?? {}) },
    durableItems: { ...(value.durableItems ?? {}) },
    explorationRoutes: { ...(value.explorationRoutes ?? {}) },
    deliveries: { ...(value.deliveries ?? {}) },
    hospitality: { ...(value.hospitality ?? {}) },
    menuByBusiness: { ...(value.menuByBusiness ?? {}) },
    unstableMagicItems: { ...(value.unstableMagicItems ?? {}) },
    serviceQuests: { ...((value as any).serviceQuests ?? {}) },
    customerSessions: { ...((value as any).customerSessions ?? {}) },
    customerStats: Object.fromEntries(
      Object.entries(((value as any).customerStats ?? {}) as Record<string, unknown>).map(
        ([businessId, stats]) => [businessId, normalizeHarthmereBusinessCustomerStatsV1(stats, businessId)],
      ),
    ),
    outpostBuildings: {
      ...HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1,
      ...((value as any).outpostBuildings ?? {}),
    },
    empireBranches: { ...((value as any).empireBranches ?? {}) },
    branchDashboards: { ...((value as any).branchDashboards ?? {}) },
    automationAssignments: { ...((value as any).automationAssignments ?? {}) },
    employeeCandidates: { ...((value as any).employeeCandidates ?? {}) },
    employeeTaskRuns: { ...((value as any).employeeTaskRuns ?? {}) },
    balanceReports: Array.isArray(value.balanceReports) ? value.balanceReports.slice(-50) : [],
  };
}

function cloneState(state: HarthmereProductionEconomyStateV1): BusinessSystemsEconomyState {
  const cloned = JSON.parse(JSON.stringify(state ?? {})) as BusinessSystemsEconomyState;
  cloned.businessSystems = normalizeHarthmereEconomyBusinessSystemsStateV1(cloned.businessSystems);
  return cloned;
}

function clamp(value: unknown, min: number, max: number, fallback = min) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function int(value: unknown, fallback = 0) {
  return Math.max(0, Math.trunc(Number(value) || fallback));
}

function str(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function recordDelta(target: Record<string, number>, itemId: string, delta: number) {
  const next = (target[itemId] ?? 0) + Math.trunc(delta);
  if (next === 0) delete target[itemId];
  else target[itemId] = next;
}

function itemCount(inventory: HarthmereEconomyInventoryRecordV1, itemId: string) {
  return Math.max(0, inventory[itemId]?.count ?? 0);
}

function applyItem(inventory: HarthmereEconomyInventoryRecordV1, itemId: string, delta: number, extras: Partial<{ expiresAtMs: number; condition: number; contaminated: boolean }> = {}) {
  const current = inventory[itemId];
  const next = (current?.count ?? 0) + Math.trunc(delta);
  if (next <= 0) delete inventory[itemId];
  else inventory[itemId] = { ...(current ?? { itemId, count: 0 }), ...extras, itemId, count: next };
}

function businessSharedKey(businessId: string) {
  return `harthmere:live_mode:v1:economy_business:${businessId}`;
}

function townSharedKey(townId: string) {
  return `harthmere:live_mode:v1:economy_town:${townId}`;
}

function systemsSharedKey(kind: string, id: string) {
  return `harthmere:live_mode:v1:economy_business_system:${kind}:${id}`;
}

function business(state: BusinessSystemsEconomyState, businessId?: string) {
  return businessId ? state.businesses[businessId] : undefined;
}

function reject(warnings: string[], touched: Set<string>, warning: string) {
  warnings.push(warning);
  touched.add("economy_business_system_rejection");
}

function businessIsType(b: HarthmereEconomyBusinessRecordV1, typeId: HarthmereEconomyBusinessTypeIdV1) {
  return b.typeId === typeId;
}

function canManageBusinessSpecific(
  b: HarthmereEconomyBusinessRecordV1,
  request: HarthmereEconomyMutationRequestV1,
  context: BusinessSystemsContext,
  permission: HarthmereEconomyBusinessPermissionV1,
) {
  if (b.ownerKind === "player" && b.ownerId === request.actorId) return true;
  if (b.ownerKind === "npc" && context.allowNpcAdministration === true) return true;
  if (b.ownerKind === "guild") {
    if (context.canManageGuildBusiness?.(b.ownerId) === true) return true;
    if ((context.actorGuildPermissions?.[b.ownerId] ?? []).includes(permission)) return true;
  }
  if (b.ownerKind === "town") {
    if (context.canManageTownBusiness?.(b.ownerId) === true) return true;
    if ((context.actorTownPermissions?.[b.ownerId] ?? []).includes(permission)) return true;
  }
  const direct = context.businessPermissions?.[`${b.businessId}:${request.actorId}`] ?? [];
  return direct.includes(permission) || direct.includes("owner_admin");
}

function requireBusiness(
  state: BusinessSystemsEconomyState,
  request: HarthmereEconomyMutationRequestV1,
  context: BusinessSystemsContext,
  warnings: string[],
  touched: Set<string>,
  permission: HarthmereEconomyBusinessPermissionV1,
  typeId?: HarthmereEconomyBusinessTypeIdV1,
) {
  const b = business(state, request.businessId);
  if (!b) {
    reject(warnings, touched, "economy_rejected:business_not_found");
    return undefined;
  }
  if (typeId && !businessIsType(b, typeId)) {
    reject(warnings, touched, `economy_rejected:business_type_required:${typeId}`);
    return undefined;
  }
  if (!canManageBusinessSpecific(b, request, context, permission)) {
    reject(warnings, touched, `economy_rejected:business_permission_required:${permission}`);
    return undefined;
  }
  return b;
}

function requireOpenBusinessStatus(
  b: HarthmereEconomyBusinessRecordV1,
  warnings: string[],
  touched: Set<string>,
) {
  if (b.status === "open") return true;
  reject(warnings, touched, "economy_rejected:business_not_open");
  return false;
}

function ensureTown(state: BusinessSystemsEconomyState, townId: string, regionId: string, nowMs: number) {
  if (!state.regions[regionId]) {
    state.regions[regionId] = { regionId, towns: [], priceIndex: {}, itemSupply: {}, itemDemand: {}, routeSafety: {}, lastTickAtMs: nowMs } as any;
  }
  if (!state.towns[townId]) {
    const needs = Object.fromEntries([
      "food", "housing", "health", "safety", "sanitation", "travel", "energy", "property_condition", "tourism", "logistics", "maintenance", "identity", "knowledge", "timeline_stability",
    ].map((need) => [need, { value: 65, demandWeight: 1, lastUpdatedAtMs: nowMs }]));
    state.towns[townId] = {
      townId,
      regionId,
      needs: needs as any,
      population: 100,
      publicBudgetGold: 0,
      cleanlinessRating: 65,
      safetyRating: 65,
      happiness: 65,
      timelineInstability: 25,
      taxRevenueGold: 0,
      serviceCoverage: Object.fromEntries(Object.keys(needs).map((need) => [need, 0])) as any,
      lastTickAtMs: nowMs,
    };
  }
  if (!state.regions[regionId].towns.includes(townId)) state.regions[regionId].towns.push(townId);
  return state.towns[townId] as any;
}

function addNeed(state: BusinessSystemsEconomyState, businessRecord: HarthmereEconomyBusinessRecordV1, need: string, delta: number, nowMs: number) {
  const townId = businessRecord.townId ?? str((businessRecord as any).townId, "harthmere_grove");
  const town = ensureTown(state, townId, businessRecord.regionId, nowMs);
  const current = town.needs[need] ?? { value: 65, demandWeight: 1, lastUpdatedAtMs: nowMs };
  town.needs[need] = { ...current, value: clamp(current.value + delta, 0, 100, current.value), lastUpdatedAtMs: nowMs };
  town.cleanlinessRating = town.needs.sanitation?.value ?? town.cleanlinessRating;
  town.safetyRating = town.needs.safety?.value ?? town.safetyRating;
  town.happiness = Math.round(((town.needs.food?.value ?? 65) + (town.needs.housing?.value ?? 65) + (town.needs.health?.value ?? 65) + (town.needs.safety?.value ?? 65) + (town.needs.tourism?.value ?? 65)) / 5);
  return town;
}

function audit(systems: HarthmereEconomyBusinessSystemsStateV1, account: HarthmereEconomyBusinessBankAccountV1 | undefined, request: HarthmereEconomyMutationRequestV1, kind: string, values: Partial<HarthmereEconomyBusinessAuditEntryV1>) {
  const entry: HarthmereEconomyBusinessAuditEntryV1 = {
    auditId: `econ_audit_${systems.nextAuditNumber++}`,
    atMs: request.nowMs,
    actorId: request.actorId,
    kind,
    ...values,
  };
  if (account) account.audit.push(entry);
  return entry;
}

function accountForBusiness(systems: HarthmereEconomyBusinessSystemsStateV1, businessId: string) {
  return Object.values(systems.bankAccounts).find((account) => account.businessId === businessId && account.status === "active");
}

function createBankAccount(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "accountant");
  if (!b) return;
  const systems = state.businessSystems!;
  if (accountForBusiness(systems, b.businessId)) return reject(warnings, touched, "economy_rejected:business_bank_account_already_exists");
  const accountId = `econ_business_account_${systems.nextAccountNumber++}`;
  systems.bankAccounts[accountId] = {
    accountId,
    businessId: b.businessId,
    ownerKind: b.ownerKind,
    ownerId: b.ownerId,
    balanceGold: 0,
    status: "active",
    createdAtMs: request.nowMs,
    audit: [],
  };
  (b as any).bankAccountId = accountId;
  audit(systems, systems.bankAccounts[accountId], request, "create_business_bank_account", { businessId: b.businessId, after: 0 });
  touched.add("economy_business_bank_account");
  shared.add(businessSharedKey(b.businessId));
}

function transferPersonalToBusinessBank(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, goldDelta: { value: number }, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "accountant");
  if (!b) return;
  const systems = state.businessSystems!;
  const account = accountForBusiness(systems, b.businessId);
  if (!account) return reject(warnings, touched, "economy_rejected:business_bank_account_required");
  const amount = int(request.amountGold, 0);
  if (amount <= 0) return reject(warnings, touched, "economy_rejected:invalid_bank_transfer_amount");
  if ((context.actorGold ?? 0) < amount) return reject(warnings, touched, "economy_rejected:insufficient_personal_gold_for_transfer");
  const before = account.balanceGold;
  account.balanceGold += amount;
  b.balanceGold += amount;
  goldDelta.value -= amount;
  audit(systems, account, request, "personal_to_business_bank", { businessId: b.businessId, amountGold: amount, before, after: account.balanceGold });
  touched.add("economy_business_bank_account");
  shared.add(businessSharedKey(b.businessId));
}

function transferBusinessToPersonalBank(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, goldDelta: { value: number }, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "accountant");
  if (!b) return;
  const systems = state.businessSystems!;
  const account = accountForBusiness(systems, b.businessId);
  if (!account) return reject(warnings, touched, "economy_rejected:business_bank_account_required");
  const amount = int(request.amountGold, 0);
  if (amount <= 0) return reject(warnings, touched, "economy_rejected:invalid_bank_transfer_amount");
  if (account.balanceGold < amount || b.balanceGold < amount) return reject(warnings, touched, "economy_rejected:business_bank_funds_insufficient");
  const before = account.balanceGold;
  account.balanceGold -= amount;
  b.balanceGold -= amount;
  goldDelta.value += amount;
  audit(systems, account, request, "business_to_personal_bank", { businessId: b.businessId, amountGold: -amount, before, after: account.balanceGold });
  touched.add("economy_business_bank_account");
  shared.add(businessSharedKey(b.businessId));
}

function grantBusinessPermission(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "owner_admin");
  if (!b) return;
  const targetActorId = str(request.targetActorId, "");
  const requestedPermissions = Array.isArray(request.permissions)
    ? request.permissions.map((permission) => str(permission, ""))
    : [str(request.permission, "")];
  const valid = ["employee_manager", "accountant", "inventory_manager", "contract_manager", "route_manager", "price_manager", "world_operator", "owner_admin"];
  const permissions = [...new Set(requestedPermissions)].filter(Boolean) as HarthmereEconomyBusinessPermissionV1[];
  if (!targetActorId || permissions.length === 0 || permissions.some((permission) => !valid.includes(permission))) return reject(warnings, touched, "economy_rejected:invalid_business_permission_grant");
  const systems = state.businessSystems!;
  systems.permissions[b.businessId] ??= {};
  systems.permissions[b.businessId][targetActorId] ??= [];
  for (const permission of permissions) {
    if (!systems.permissions[b.businessId][targetActorId].includes(permission)) systems.permissions[b.businessId][targetActorId].push(permission);
  }
  touched.add("economy_business_permissions");
  shared.add(businessSharedKey(b.businessId));
}

function adjustBusinessFunds(b: HarthmereEconomyBusinessRecordV1, amount: number) {
  b.balanceGold = Math.max(0, b.balanceGold + Math.trunc(amount));
}

function requireInventory(b: HarthmereEconomyBusinessRecordV1, warnings: string[], touched: Set<string>, items: Record<string, number>) {
  for (const [itemId, count] of Object.entries(items)) {
    if (itemCount(b.inventory, itemId) < count) {
      reject(warnings, touched, `economy_rejected:business_item_required:${itemId}`);
      return false;
    }
  }
  return true;
}

function consumeInventory(b: HarthmereEconomyBusinessRecordV1, items: Record<string, number>) {
  for (const [itemId, count] of Object.entries(items)) applyItem(b.inventory, itemId, -count);
}

function produceInventory(b: HarthmereEconomyBusinessRecordV1, items: Record<string, number>, extras: Partial<{ expiresAtMs: number; condition: number; contaminated: boolean }> = {}) {
  for (const [itemId, count] of Object.entries(items)) applyItem(b.inventory, itemId, count, extras);
}

const HARTHMERE_BUSINESS_CUSTOMER_SESSION_MS_V1 = 2 * 60 * 60 * 1000;
const HARTHMERE_BUSINESS_CUSTOMER_DAY_MS_V1 = 24 * 60 * 60 * 1000;
const HARTHMERE_BUSINESS_CUSTOMER_PATIENCE_STEP_MS_V1 = 1000;

function customerDay(nowMs: number) {
  return Math.floor(nowMs / HARTHMERE_BUSINESS_CUSTOMER_DAY_MS_V1);
}

function statsForCustomerBusiness(systems: HarthmereEconomyBusinessSystemsStateV1, businessId: string) {
  systems.customerStats[businessId] = normalizeHarthmereBusinessCustomerStatsV1(
    systems.customerStats[businessId] ?? defaultHarthmereBusinessCustomerStatsV1(businessId),
    businessId,
  );
  return systems.customerStats[businessId];
}

const HARTHMERE_BUSINESS_AUTOMATION_ROLES_V1 = new Set<HarthmereEconomyBusinessAutomationRoleV1>([
  "front_counter",
  "branch_manager",
  "courier_dispatch",
  "purchasing_manager",
  "quality_inspector",
]);

function isBusinessAutomationRoleV1(role: string): role is HarthmereEconomyBusinessAutomationRoleV1 {
  return HARTHMERE_BUSINESS_AUTOMATION_ROLES_V1.has(role as HarthmereEconomyBusinessAutomationRoleV1);
}

function businessBranchForOutpost(
  systems: HarthmereEconomyBusinessSystemsStateV1,
  outpostId: string,
) {
  return Object.values(systems.empireBranches).find(
    (branch) => branch.outpostId === outpostId && branch.status !== "closed",
  );
}

function automationsForBranch(
  systems: HarthmereEconomyBusinessSystemsStateV1,
  branchId: string | undefined,
) {
  return Object.values(systems.automationAssignments).filter(
    (automation) => automation.active && automation.branchId === branchId,
  );
}

function activeBranchForBusiness(
  systems: HarthmereEconomyBusinessSystemsStateV1,
  businessId: string,
  branchId: string,
) {
  const branch = systems.empireBranches[branchId];
  return branch && branch.parentBusinessId === businessId && branch.status === "active" ? branch : undefined;
}

function branchWarehouseUnits(branch: HarthmereEconomyBusinessBranchV1) {
  return Object.values(branch.warehouseInventory ?? {}).reduce((sum, count) => sum + Math.max(0, Math.trunc(count)), 0);
}

function createBranchDashboardV1(
  branch: HarthmereEconomyBusinessBranchV1,
  dailyProfitGold: number,
  nowMs: number,
): HarthmereEconomyBusinessBranchDashboardV1 {
  const stockUnits = branchWarehouseUnits(branch);
  const staffCoverage = Math.min(1, branch.scheduledStaffIds.length / Math.max(1, branch.staffSlots));
  const alerts: string[] = [];
  const recommendedActions: string[] = [];
  if (!branch.regionalManagerEmployeeId) {
    alerts.push("Manager needed");
    recommendedActions.push("Assign a regional manager");
  }
  if (stockUnits <= 0) {
    alerts.push("Warehouse empty");
    recommendedActions.push("Route stock from the parent business");
  }
  if (staffCoverage < 0.5) {
    alerts.push("Low staff coverage");
    recommendedActions.push("Schedule more trained staff");
  }
  if (branch.competitorPressure >= 12) {
    alerts.push("Competitor pressure rising");
    recommendedActions.push("Improve service quality or add local promotions");
  }
  if (!alerts.length) alerts.push("Branch steady");
  return {
    dashboardId: `branch_dashboard_${branch.branchId}_${nowMs}`,
    branchId: branch.branchId,
    parentBusinessId: branch.parentBusinessId,
    atMs: nowMs,
    dailyProfitGold,
    stockUnits,
    staffCoverage: Number(staffCoverage.toFixed(2)),
    demandMultiplier: branch.regionalDemandMultiplier,
    competitorPressure: branch.competitorPressure,
    managerAssigned: Boolean(branch.regionalManagerEmployeeId),
    alerts,
    recommendedActions,
  };
}

function openBusinessBranch(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "owner_admin");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const systems = state.businessSystems!;
  const stats = statsForCustomerBusiness(systems, b.businessId);
  const tier = harthmereBusinessCustomerTierForStatsV1(stats);
  stats.currentTier = tier;
  if (tier < 3) return reject(warnings, touched, "economy_rejected:business_branch_requires_tier_3");
  const requestedOutpostId = str((request as any).outpostId, "");
  const outpostBuilding = Object.values(systems.outpostBuildings).find(
    (building) =>
      building.businessType === b.typeId &&
      (!requestedOutpostId || building.outpostId === requestedOutpostId),
  );
  if (!outpostBuilding) return reject(warnings, touched, "economy_rejected:business_outpost_building_required");
  const passabilityAudit = validateHarthmereBusinessOutpostPassabilityV1(outpostBuilding);
  if (!passabilityAudit.ok) {
    return reject(warnings, touched, `economy_rejected:business_outpost_passability_failed:${passabilityAudit.errors[0] ?? "unknown"}`);
  }
  const liveNavigationAudit = validateHarthmereBusinessOutpostLiveWorldNavigationV1(outpostBuilding);
  if (!liveNavigationAudit.ok) {
    return reject(warnings, touched, `economy_rejected:business_outpost_live_navigation_failed:${liveNavigationAudit.unreachableRoutes[0] ?? liveNavigationAudit.unresolvedCollisions[0] ?? "unknown"}`);
  }
  const existing = businessBranchForOutpost(systems, outpostBuilding.outpostId);
  if (existing) return reject(warnings, touched, "economy_rejected:business_branch_outpost_already_claimed");
  const baseOpenCostGold = 600 + tier * 150;
  const openCostGold = Math.max(baseOpenCostGold, int(request.amountGold, baseOpenCostGold));
  if (b.balanceGold < openCostGold) return reject(warnings, touched, "economy_rejected:business_branch_funds_insufficient");
  const branchId = str((request as any).branchId, "") || `business_branch_${systems.nextBranchNumber++}`;
  if (systems.empireBranches[branchId]) return reject(warnings, touched, "economy_rejected:business_branch_id_exists");
  b.balanceGold -= openCostGold;
  systems.empireBranches[branchId] = {
    branchId,
    parentBusinessId: b.businessId,
    businessType: b.typeId,
    outpostId: outpostBuilding.outpostId,
    outpostBuildingId: outpostBuilding.buildingId,
    townId: outpostBuilding.plot.area === "harthmere" ? "harthmere_town" : "harthmere_grove",
    regionId: b.regionId,
    status: "active",
    openedAtMs: request.nowMs,
    staffSlots: 2 + tier,
    automationSlots: 1 + Math.max(0, tier - 2),
    dailyRevenueGold: Math.max(90, 70 + b.reputation * 2 + tier * 35),
    dailyUpkeepGold: Math.max(35, Math.round(b.upkeepGoldPerDay * 0.55) + tier * 12),
    queueCapacityBonus: 2 + tier,
    reputationShare: Math.max(1, Math.floor(tier / 2)),
    lastSettlementAtMs: request.nowMs,
    lifetimeProfitGold: 0,
    warehouseSlots: 8 + tier * 2,
    warehouseInventory: {},
    scheduledStaffIds: [],
    regionalDemandMultiplier: Number((1 + tier * 0.04).toFixed(2)),
    competitorPressure: Math.max(0, 12 - tier * 2),
    lastDashboardAtMs: request.nowMs,
    branchNotes: ["Branch opened with an empty warehouse and no regional manager assigned."],
  };
  b.serviceRadius += 1;
  b.flags.empire_branch_opened = true;
  touched.add("economy_business_empire_branch");
  touched.add("economy_business_outpost_materialization");
  shared.add(businessSharedKey(b.businessId));
  shared.add(systemsSharedKey("empire_branch", branchId));
  shared.add(systemsSharedKey("outpost_building", outpostBuilding.outpostId));
  (state as any).__buildingMaterializationPlans ??= [];
  (state as any).__buildingMaterializationPlans.push(outpostBuilding.materializationPlan);
}

function assignBusinessAutomation(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "employee_manager");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const systems = state.businessSystems!;
  const role = str(request.role, "");
  if (!isBusinessAutomationRoleV1(role)) return reject(warnings, touched, "economy_rejected:invalid_business_automation_role");
  const branchId = str((request as any).branchId, "");
  const branch = branchId ? systems.empireBranches[branchId] : undefined;
  if (branchId && (!branch || branch.parentBusinessId !== b.businessId || branch.status !== "active")) {
    return reject(warnings, touched, "economy_rejected:active_business_branch_required");
  }
  if (branch && automationsForBranch(systems, branch.branchId).length >= branch.automationSlots) {
    return reject(warnings, touched, "economy_rejected:business_branch_automation_slots_full");
  }
  const employeeId = str(request.employeeId, "");
  const employee = employeeId ? state.employees[employeeId] : undefined;
  if (employeeId && (!employee || employee.businessId !== b.businessId)) {
    return reject(warnings, touched, "economy_rejected:business_employee_required_for_automation");
  }
  const level = Math.max(1, Math.min(5, int(request.skill, employee?.skill ?? 1)));
  const automationId = str((request as any).automationId, "") || `business_automation_${systems.nextAutomationNumber++}`;
  if (systems.automationAssignments[automationId]) return reject(warnings, touched, "economy_rejected:business_automation_id_exists");
  systems.automationAssignments[automationId] = {
    automationId,
    businessId: b.businessId,
    branchId: branch?.branchId,
    role,
    level,
    assignedEmployeeId: employeeId || undefined,
    active: true,
    dailyUpkeepGold: Math.max(8, 10 + level * 6),
    serviceCapacityBonus: role === "front_counter" || role === "branch_manager" ? 1 + level : Math.max(1, Math.floor(level / 2)),
    passiveProfitGoldPerDay: role === "purchasing_manager" ? level * 12 : role === "courier_dispatch" ? level * 10 : level * 7,
    failureRisk: Math.max(1, 12 - level * 2),
    createdAtMs: request.nowMs,
  };
  b.flags.business_automation_assigned = true;
  touched.add("economy_business_empire_automation");
  shared.add(businessSharedKey(b.businessId));
  shared.add(systemsSharedKey("business_automation", automationId));
}

function assignBusinessBranchManager(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "employee_manager");
  if (!b) return;
  const systems = state.businessSystems!;
  const branchId = str((request as any).branchId, "");
  const branch = activeBranchForBusiness(systems, b.businessId, branchId);
  if (!branch) return reject(warnings, touched, "economy_rejected:active_business_branch_required");
  const employeeId = str(request.employeeId, "");
  const employee = employeeId ? state.employees[employeeId] : undefined;
  if (!employee || employee.businessId !== b.businessId) return reject(warnings, touched, "economy_rejected:business_employee_required_for_branch_manager");
  if (employee.skill < 3) return reject(warnings, touched, "economy_rejected:branch_manager_skill_too_low");
  branch.regionalManagerEmployeeId = employee.employeeId;
  branch.regionalDemandMultiplier = Number(Math.min(1.5, (branch.regionalDemandMultiplier || 1) + 0.08 + employee.skill * 0.01).toFixed(2));
  branch.competitorPressure = Math.max(0, branch.competitorPressure - 3);
  branch.branchNotes = [...(branch.branchNotes ?? []), `${employee.role} assigned as regional manager.`].slice(-20);
  employee.assignedTask = "branch_manager" satisfies HarthmereBusinessEmployeeAssignableTaskIdV1;
  employee.loyalty = clamp(employee.loyalty + 3, 0, 100, employee.loyalty);
  touched.add("economy_business_empire_branch_manager");
  shared.add(businessSharedKey(b.businessId));
  shared.add(systemsSharedKey("empire_branch", branch.branchId));
}

function routeBusinessBranchStock(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "inventory_manager");
  if (!b) return;
  const systems = state.businessSystems!;
  const branchId = str((request as any).branchId, "");
  const branch = activeBranchForBusiness(systems, b.businessId, branchId);
  if (!branch) return reject(warnings, touched, "economy_rejected:active_business_branch_required");
  const itemId = str(request.itemId, "");
  const count = Math.max(1, int(request.count, 1));
  if (!itemId) return reject(warnings, touched, "economy_rejected:branch_stock_item_required");
  if (itemCount(b.inventory, itemId) < count) return reject(warnings, touched, `economy_rejected:business_item_required:${itemId}`);
  branch.warehouseSlots = branch.warehouseSlots || 8;
  if (branchWarehouseUnits(branch) + count > branch.warehouseSlots) return reject(warnings, touched, "economy_rejected:branch_warehouse_full");
  consumeInventory(b, { [itemId]: count });
  branch.warehouseInventory = branch.warehouseInventory ?? {};
  branch.warehouseInventory[itemId] = (branch.warehouseInventory[itemId] ?? 0) + count;
  branch.branchNotes = [...(branch.branchNotes ?? []), `Routed ${count} ${itemId.replace(/_/g, " ")} to the branch warehouse.`].slice(-20);
  touched.add("economy_business_empire_branch_stock");
  touched.add("economy_business_inventory");
  shared.add(businessSharedKey(b.businessId));
  shared.add(systemsSharedKey("empire_branch", branch.branchId));
}

function scheduleBusinessBranchStaff(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "employee_manager");
  if (!b) return;
  const systems = state.businessSystems!;
  const branchId = str((request as any).branchId, "");
  const branch = activeBranchForBusiness(systems, b.businessId, branchId);
  if (!branch) return reject(warnings, touched, "economy_rejected:active_business_branch_required");
  const requested: unknown[] = Array.isArray((request as any).employeeIds)
    ? (request as any).employeeIds
    : str(request.employeeId, "") ? [str(request.employeeId, "")] : [];
  const employeeIds: string[] = Array.from(new Set(requested.filter((id): id is string => typeof id === "string" && id.trim().length > 0)));
  if (!employeeIds.length) return reject(warnings, touched, "economy_rejected:branch_staff_required");
  if (employeeIds.length > branch.staffSlots) return reject(warnings, touched, "economy_rejected:branch_staff_slots_full");
  for (const employeeId of employeeIds) {
    const employee = state.employees[employeeId];
    if (!employee || employee.businessId !== b.businessId) return reject(warnings, touched, "economy_rejected:business_employee_required_for_branch_schedule");
    if (employee.injuredUntilMs && employee.injuredUntilMs > request.nowMs) return reject(warnings, touched, "economy_rejected:branch_staff_unavailable");
  }
  branch.scheduledStaffIds = employeeIds;
  branch.branchNotes = [...(branch.branchNotes ?? []), `Scheduled ${employeeIds.length} staff for the next branch day.`].slice(-20);
  touched.add("economy_business_empire_branch_schedule");
  shared.add(businessSharedKey(b.businessId));
  shared.add(systemsSharedKey("empire_branch", branch.branchId));
}

function runBusinessEmpireDay(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "accountant");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const systems = state.businessSystems!;
  const branches = Object.values(systems.empireBranches).filter(
    (branch) => branch.parentBusinessId === b.businessId && branch.status === "active",
  );
  if (branches.length === 0) return reject(warnings, touched, "economy_rejected:business_branch_required_for_empire_settlement");
  const requestedDays = int((request as any).days, int(request.count, 0));
  const stats = statsForCustomerBusiness(systems, b.businessId);
  let totalProfit = 0;
  let totalCapacity = 0;
  for (const branch of branches) {
    const elapsedDays = Math.max(1, Math.floor((request.nowMs - branch.lastSettlementAtMs) / HARTHMERE_BUSINESS_CUSTOMER_DAY_MS_V1));
    const days = Math.max(1, Math.min(30, requestedDays || elapsedDays));
    const branchAutomations = automationsForBranch(systems, branch.branchId);
    const activeAutomationProfit = branchAutomations.reduce((sum, automation) => sum + automation.passiveProfitGoldPerDay, 0);
    const activeAutomationUpkeep = branchAutomations.reduce((sum, automation) => sum + automation.dailyUpkeepGold, 0);
    const capacityBonus = branchAutomations.reduce((sum, automation) => sum + automation.serviceCapacityBonus, 0);
    const stockUnits = branchWarehouseUnits(branch);
    const stockBonus = Math.min(60, stockUnits * 6);
    const staffCoverage = Math.min(1, (branch.scheduledStaffIds?.length ?? 0) / Math.max(1, branch.staffSlots));
    const managerBonus = branch.regionalManagerEmployeeId ? 30 : 0;
    const demandMultiplier = Math.max(0.65, Math.min(1.6, branch.regionalDemandMultiplier || 1));
    const competitorPenalty = Math.max(0, branch.competitorPressure || 0) * 3;
    const dayProfit = Math.round(
      (branch.dailyRevenueGold + activeAutomationProfit + (branch.queueCapacityBonus + capacityBonus) * 5 + stockBonus + managerBonus) *
      demandMultiplier *
      (0.75 + staffCoverage * 0.25) -
      branch.dailyUpkeepGold -
      activeAutomationUpkeep -
      competitorPenalty,
    );
    const branchProfit = Math.trunc(dayProfit * days);
    totalProfit += branchProfit;
    totalCapacity += Math.max(0, branch.queueCapacityBonus + capacityBonus) * days;
    branch.lifetimeProfitGold += branchProfit;
    branch.lastSettlementAtMs = request.nowMs;
    branch.lastDashboardAtMs = request.nowMs;
    branch.competitorPressure = Math.max(0, Math.min(25, (branch.competitorPressure ?? 0) + (branchProfit > 0 ? -1 : 2) - (branch.regionalManagerEmployeeId ? 1 : 0)));
    branch.regionalDemandMultiplier = Number(Math.max(0.7, Math.min(1.6, (branch.regionalDemandMultiplier ?? 1) + (branchProfit > 0 ? 0.01 : -0.03))).toFixed(2));
    const firstStockItem = Object.keys(branch.warehouseInventory ?? {}).find((itemId) => (branch.warehouseInventory[itemId] ?? 0) > 0);
    if (firstStockItem) {
      branch.warehouseInventory[firstStockItem] = Math.max(0, (branch.warehouseInventory[firstStockItem] ?? 0) - Math.min(days, branch.warehouseInventory[firstStockItem] ?? 0));
      if (branch.warehouseInventory[firstStockItem] <= 0) delete branch.warehouseInventory[firstStockItem];
    }
    const dashboard = createBranchDashboardV1(branch, dayProfit, request.nowMs);
    systems.branchDashboards[branch.branchId] = dashboard;
    branch.branchNotes = [...(branch.branchNotes ?? []), `Daily branch report: ${dayProfit} gold, ${dashboard.stockUnits} stock units, ${Math.round(dashboard.staffCoverage * 100)}% staff coverage.`].slice(-20);
    for (const automation of branchAutomations) automation.lastRunAtMs = request.nowMs;
    shared.add(systemsSharedKey("empire_branch", branch.branchId));
    shared.add(systemsSharedKey("branch_dashboard", branch.branchId));
  }
  const standaloneAutomations = Object.values(systems.automationAssignments).filter(
    (automation) => automation.businessId === b.businessId && automation.active && !automation.branchId,
  );
  const standaloneProfit = standaloneAutomations.reduce(
    (sum, automation) => sum + automation.passiveProfitGoldPerDay - automation.dailyUpkeepGold,
    0,
  );
  totalProfit += standaloneProfit;
  for (const automation of standaloneAutomations) automation.lastRunAtMs = request.nowMs;
  adjustBusinessFunds(b, totalProfit);
  stats.totalServed += Math.max(0, Math.trunc(totalCapacity));
  stats.lifetimeGold += Math.max(0, totalProfit);
  stats.currentTier = harthmereBusinessCustomerTierForStatsV1(stats);
  b.reputation += Math.max(0, Math.floor(branches.length / 2));
  if (totalProfit < 0 && b.balanceGold === 0) {
    b.status = "paused";
    b.flags.empire_branch_cashflow_paused = true;
  }
  touched.add("economy_business_empire_settlement");
  touched.add("economy_business_empire_dashboard");
  shared.add(businessSharedKey(b.businessId));
}

function closeBusinessBranch(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "owner_admin");
  if (!b) return;
  const systems = state.businessSystems!;
  const branchId = str((request as any).branchId, "");
  const branch = systems.empireBranches[branchId];
  if (!branch || branch.parentBusinessId !== b.businessId) return reject(warnings, touched, "economy_rejected:business_branch_not_found");
  if (branch.status === "closed") return reject(warnings, touched, "economy_rejected:business_branch_already_closed");
  const stockRefund = Math.floor(branchWarehouseUnits(branch) * 3);
  const saleValue = Math.max(50, Math.floor((branch.dailyRevenueGold + branch.queueCapacityBonus * 10) * 0.4) + stockRefund);
  branch.status = "closed";
  branch.scheduledStaffIds = [];
  branch.branchNotes = [...(branch.branchNotes ?? []), `Branch closed and assets recovered for ${saleValue} gold.`].slice(-20);
  for (const automation of Object.values(systems.automationAssignments)) {
    if (automation.branchId === branch.branchId) automation.active = false;
  }
  adjustBusinessFunds(b, saleValue);
  touched.add("economy_business_empire_branch_closed");
  shared.add(businessSharedKey(b.businessId));
  shared.add(systemsSharedKey("empire_branch", branch.branchId));
}

function activeCustomerSessionForBusiness(systems: HarthmereEconomyBusinessSystemsStateV1, businessId: string, nowMs: number) {
  return Object.values(systems.customerSessions).find(
    (session) => session.businessId === businessId && session.status === "active" && session.expiresAtMs > nowMs,
  );
}

function expireCustomerSessionsForBusiness(systems: HarthmereEconomyBusinessSystemsStateV1, businessId: string, nowMs: number) {
  const expired: HarthmereBusinessCustomerSessionV1[] = [];
  for (const session of Object.values(systems.customerSessions)) {
    if (session.businessId === businessId && session.status === "active" && session.expiresAtMs <= nowMs) {
      session.status = "expired";
      expired.push(session);
    }
  }
  return expired;
}

function requestBlockedCells(request: HarthmereEconomyMutationRequestV1) {
  const raw = Array.isArray(request.blockedCells) ? request.blockedCells : [];
  return raw.flatMap((cell: any) => {
    const x = Number(cell?.x);
    const y = Number(cell?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    return [{ x: Math.trunc(x), y: Math.trunc(y), reason: str(cell?.reason, "blocked") }];
  });
}

function refreshBusinessEmployeeCandidates(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "employee_manager");
  if (!b) return;
  const systems = state.businessSystems!;
  for (const candidate of Object.values(systems.employeeCandidates)) {
    if (candidate.businessId === b.businessId && candidate.status !== "hired") {
      candidate.status = "withdrawn";
    }
  }
  const generated = generateHarthmereBusinessEmployeeCandidatesV1({
    businessId: b.businessId,
    typeId: b.typeId,
    nowMs: request.nowMs,
    count: int(request.count, 3),
    businessReputation: b.reputation,
  });
  for (const candidate of generated) {
    const candidateId = `business_candidate_${systems.nextEmployeeCandidateNumber++}`;
    systems.employeeCandidates[candidateId] = { ...candidate, candidateId };
    shared.add(systemsSharedKey("employee_candidate", candidateId));
  }
  touched.add("economy_business_employee_candidate");
  shared.add(businessSharedKey(b.businessId));
}

function requireEmployeeCandidate(
  systems: HarthmereEconomyBusinessSystemsStateV1,
  businessId: string,
  candidateId: string,
  request: HarthmereEconomyMutationRequestV1,
  warnings: string[],
  touched: Set<string>,
) {
  const candidate = systems.employeeCandidates[candidateId];
  if (!candidate || candidate.businessId !== businessId) {
    reject(warnings, touched, "economy_rejected:business_employee_candidate_not_found");
    return undefined;
  }
  if (candidate.expiresAtMs <= request.nowMs && candidate.status !== "hired") {
    candidate.status = "withdrawn";
    reject(warnings, touched, "economy_rejected:business_employee_candidate_expired");
    return undefined;
  }
  return candidate;
}

function interviewBusinessEmployeeCandidate(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "employee_manager");
  if (!b) return;
  const systems = state.businessSystems!;
  const candidateId = str(request.candidateId, "");
  const candidate = requireEmployeeCandidate(systems, b.businessId, candidateId, request, warnings, touched);
  if (!candidate) return;
  if (candidate.status === "hired" || candidate.status === "withdrawn") {
    return reject(warnings, touched, "economy_rejected:business_employee_candidate_unavailable");
  }
  const style = str(request.interviewStyle, "friendly") as HarthmereBusinessEmployeeInterviewStyleV1;
  systems.employeeCandidates[candidateId] = interviewHarthmereBusinessEmployeeCandidateV1(candidate, style);
  touched.add("economy_business_employee_candidate");
  shared.add(systemsSharedKey("employee_candidate", candidateId));
}

function negotiateBusinessEmployeeCandidate(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "employee_manager");
  if (!b) return;
  const systems = state.businessSystems!;
  const candidateId = str(request.candidateId, "");
  const candidate = requireEmployeeCandidate(systems, b.businessId, candidateId, request, warnings, touched);
  if (!candidate) return;
  if (candidate.status !== "interviewed" && candidate.status !== "declined" && candidate.status !== "available") {
    return reject(warnings, touched, "economy_rejected:business_employee_candidate_not_negotiable");
  }
  const result = negotiateHarthmereBusinessEmployeeCandidateV1(
    candidate,
    int(request.wageGoldPerDay, candidate.wageAskGoldPerDay),
  );
  systems.employeeCandidates[candidateId] = result.candidate;
  if (result.warning) warnings.push(`economy_warning:${result.warning}`);
  touched.add("economy_business_employee_candidate");
  shared.add(systemsSharedKey("employee_candidate", candidateId));
}

function hireBusinessEmployeeCandidate(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "employee_manager");
  if (!b) return;
  const systems = state.businessSystems!;
  const candidateId = str(request.candidateId, "");
  const candidate = requireEmployeeCandidate(systems, b.businessId, candidateId, request, warnings, touched);
  if (!candidate) return;
  if (candidate.status !== "offer_made" || !candidate.acceptedWageGoldPerDay) {
    return reject(warnings, touched, "economy_rejected:business_employee_candidate_offer_required");
  }
  if (b.employees.length >= 30) return reject(warnings, touched, "economy_rejected:business_employee_capacity_full");
  const employeeId = str(request.employeeId, "") || `econ_employee_${state.nextEmployeeNumber++}`;
  if (state.employees[employeeId]) return reject(warnings, touched, "economy_rejected:employee_already_exists");
  state.employees[employeeId] = {
    employeeId,
    businessId: b.businessId,
    npcId: `generated_candidate:${candidate.candidateId}`,
    role: candidate.role,
    skill: candidate.skill,
    wageGoldPerDay: candidate.acceptedWageGoldPerDay,
    morale: Math.max(50, Math.min(85, 45 + Math.floor((candidate.interviewScore ?? 50) / 3))),
    loyalty: Math.max(40, Math.min(80, 35 + (candidate.status === "offer_made" ? 15 : 0))),
    assignedTask: candidate.preferredTaskId,
    hiredAtMs: request.nowMs,
    lastPaidAtMs: request.nowMs,
  };
  b.employees.push(employeeId);
  b.wageGoldPerDay += candidate.acceptedWageGoldPerDay;
  systems.employeeCandidates[candidateId] = {
    ...candidate,
    status: "hired",
    notes: [...candidate.notes, `Hired as ${candidate.role}.`],
  };
  touched.add("economy_employee");
  touched.add("economy_business_employee_candidate");
  shared.add(businessSharedKey(b.businessId));
  shared.add(systemsSharedKey("employee_candidate", candidateId));
}

function promoteBusinessEmployee(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "employee_manager");
  if (!b) return;
  const employeeId = str(request.employeeId, "");
  const employee = employeeId ? state.employees[employeeId] : undefined;
  if (!employee || employee.businessId !== b.businessId) return reject(warnings, touched, "economy_rejected:employee_not_found");
  const cost = Math.max(40, employee.skill * 35);
  if (b.balanceGold < cost) return reject(warnings, touched, "economy_rejected:business_employee_promotion_unfunded");
  const task = validateHarthmereBusinessEmployeeAssignedTaskV1(str(request.assignedTask, employee.assignedTask ?? ""));
  if (request.assignedTask && !task) return reject(warnings, touched, "economy_rejected:invalid_business_employee_task");
  adjustBusinessFunds(b, -cost);
  const previousWage = employee.wageGoldPerDay;
  employee.skill = Math.min(10, employee.skill + 1);
  employee.wageGoldPerDay += Math.max(2, Math.floor(employee.skill / 2));
  employee.morale = clamp(employee.morale + 8, 0, 100, employee.morale);
  employee.loyalty = clamp(employee.loyalty + 10, 0, 100, employee.loyalty);
  if (task) employee.assignedTask = task.taskId;
  b.wageGoldPerDay += employee.wageGoldPerDay - previousWage;
  b.flags.employee_promoted = true;
  touched.add("economy_employee");
  shared.add(businessSharedKey(b.businessId));
}

function runBusinessEmployeeTask(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "employee_manager");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const systems = state.businessSystems!;
  const requestedEmployeeId = str(request.employeeId, "");
  const employeeId = requestedEmployeeId || b.employees.find((id) => state.employees[id]) || "";
  const employee = employeeId ? state.employees[employeeId] : undefined;
  if (!employee || employee.businessId !== b.businessId) return reject(warnings, touched, "economy_rejected:employee_not_found");
  const task = validateHarthmereBusinessEmployeeAssignedTaskV1(str(request.assignedTask, employee.assignedTask ?? "front_counter"));
  if (!task) return reject(warnings, touched, "economy_rejected:invalid_business_employee_task");
  const role = str(request.role, "");
  const automationRole = isBusinessAutomationRoleV1(role) ? role as HarthmereBusinessEmployeeAutomationRoleV1 : undefined;
  const taskRunId = str(request.taskRunId, "") || `business_employee_task_${systems.nextEmployeeTaskRunNumber++}`;
  if (systems.employeeTaskRuns[taskRunId]) return reject(warnings, touched, "economy_rejected:business_employee_task_id_exists");
  const activeSession = activeCustomerSessionForBusiness(systems, b.businessId, request.nowMs);
  const activeTicket = activeHarthmereBusinessCustomerTicketV1(activeSession);
  const run = simulateHarthmereBusinessEmployeeTaskRunV1({
    taskRunId,
    businessId: b.businessId,
    typeId: b.typeId,
    employee,
    offerId: str(request.offerId, activeTicket?.requestedOfferId ?? ""),
    automationRole,
    nowMs: request.nowMs,
    blockedCells: requestBlockedCells(request),
    forceSharedServiceLane: request.forceSharedServiceLane === true,
  });
  systems.employeeTaskRuns[taskRunId] = run;
  const allRuns = Object.values(systems.employeeTaskRuns).sort((a, bRun) => a.createdAtMs - bRun.createdAtMs);
  while (allRuns.length > 60) {
    const old = allRuns.shift();
    if (old) delete systems.employeeTaskRuns[old.taskRunId];
  }
  employee.morale = run.moraleAfter;
  if (run.status === "completed") {
    employee.loyalty = clamp(employee.loyalty + 1, 0, 100, employee.loyalty);
    b.customerSatisfaction = clamp(b.customerSatisfaction + 1, 0, 100, b.customerSatisfaction);
  } else if (run.status === "recovered") {
    b.flags.employee_stuck_recovery_used = run.pathAudit.sidestepCount > 0 || run.pathAudit.repathCount > 0 || run.pathAudit.fallbackExitUsed;
  } else {
    employee.loyalty = clamp(employee.loyalty - 2, 0, 100, employee.loyalty);
    b.customerSatisfaction = clamp(b.customerSatisfaction - 3, 0, 100, b.customerSatisfaction);
    b.reputation = Math.max(0, b.reputation - 1);
    if (run.failureReason === "employee_morale_too_low") b.flags.employee_morale_failure = true;
  }
  for (const warning of run.warnings) warnings.push(`economy_warning:${warning}`);
  touched.add("economy_business_employee_task");
  touched.add("economy_employee");
  shared.add(businessSharedKey(b.businessId));
  shared.add(systemsSharedKey("employee_task", taskRunId));
}

function runBusinessEmployeeMoraleTick(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "employee_manager");
  if (!b) return;
  const days = Math.max(1, Math.min(14, int(request.days, 1)));
  for (const employeeId of [...b.employees]) {
    const employee = state.employees[employeeId];
    if (!employee) continue;
    const unpaidDays = Math.max(0, Math.floor((request.nowMs - employee.lastPaidAtMs) / HARTHMERE_BUSINESS_CUSTOMER_DAY_MS_V1) - 1);
    employee.morale = clamp(employee.morale - days - unpaidDays * 4, 0, 100, employee.morale);
    if (employee.morale < 12 && employee.loyalty < 25) {
      b.employees = b.employees.filter((id) => id !== employeeId);
      b.wageGoldPerDay = Math.max(0, b.wageGoldPerDay - employee.wageGoldPerDay);
      delete state.employees[employeeId];
      b.flags.employee_resigned = true;
      warnings.push(`economy_warning:employee_resigned:${employeeId}`);
      continue;
    }
    if (employee.morale < 25) {
      employee.assignedTask = "rest_required" satisfies HarthmereBusinessEmployeeAssignableTaskIdV1;
      b.customerSatisfaction = clamp(b.customerSatisfaction - 2, 0, 100, b.customerSatisfaction);
      b.flags.employee_absence_reported = true;
      warnings.push(`economy_warning:employee_absent_or_mistake:${employeeId}`);
    }
    if (employee.loyalty < 15 && b.balanceGold > 0) {
      const loss = Math.min(b.balanceGold, 5 * days);
      adjustBusinessFunds(b, -loss);
      b.flags.employee_theft_risk_loss = true;
      warnings.push(`economy_warning:employee_theft_risk_loss:${employeeId}:${loss}`);
    }
  }
  touched.add("economy_employee");
  shared.add(businessSharedKey(b.businessId));
}

function advanceCustomerSession(session: HarthmereBusinessCustomerSessionV1, nowMs?: number) {
  const next = session.queue.find((ticket) => ticket.status === "waiting");
  session.currentTicketId = next?.ticketId;
  if (!next) {
    session.status = "completed";
    return true;
  }
  if (typeof nowMs === "number") {
    next.arrivedAtMs = nowMs;
    next.patienceRemaining = next.patience;
  }
  return false;
}

function expireImpatientCustomerTickets(
  session: HarthmereBusinessCustomerSessionV1,
  business: HarthmereEconomyBusinessRecordV1,
  stats: HarthmereBusinessCustomerStatsV1,
  nowMs: number,
) {
  const leftTicketIds: string[] = [];
  while (session.status === "active") {
    const ticket = activeHarthmereBusinessCustomerTicketV1(session);
    if (!ticket) {
      advanceCustomerSession(session, nowMs);
      break;
    }
    const elapsedPatience = Math.max(0, Math.floor((nowMs - ticket.arrivedAtMs) / HARTHMERE_BUSINESS_CUSTOMER_PATIENCE_STEP_MS_V1));
    ticket.patienceRemaining = Math.max(0, ticket.patience - elapsedPatience);
    if (ticket.patienceRemaining > 0) break;

    ticket.status = "left";
    leftTicketIds.push(ticket.ticketId);
    session.failedTicketIds.push(ticket.ticketId);
    session.streak = 0;
    session.satisfaction = clamp(session.satisfaction - 10, 0, 100, session.satisfaction);
    stats.totalFailed += 1;
    business.customerSatisfaction = clamp(business.customerSatisfaction - 5, 0, 100, business.customerSatisfaction);
    business.reputation = Math.max(0, business.reputation - 1);
    const npc = findHarthmereBusinessCustomerNpcV1(ticket.npcId);
    session.notes.push(`${npc?.displayName ?? "A customer"} left after waiting too long.`);
    if (advanceCustomerSession(session, nowMs)) break;
  }
  return leftTicketIds;
}

function startBusinessCustomerSession(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "contract_manager");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const definition = getHarthmereBusinessMiniGameDefinitionV1(b.typeId);
  if (!definition) return reject(warnings, touched, `economy_rejected:business_customer_minigame_missing:${b.typeId}`);
  const systems = state.businessSystems!;
  const expired = expireCustomerSessionsForBusiness(systems, b.businessId, request.nowMs);
  const existing = activeCustomerSessionForBusiness(systems, b.businessId, request.nowMs);
  if (existing) return reject(warnings, touched, "economy_rejected:business_customer_session_already_active");
  const stats = statsForCustomerBusiness(systems, b.businessId);
  const tier = harthmereBusinessCustomerTierForStatsV1(stats);
  stats.currentTier = tier;
  stats.lastSessionAtMs = request.nowMs;
  const requestedCount = Math.max(1, Math.min(12, int(request.count, 3 + tier + Math.min(3, b.employees.length))));
  const requestedSessionId = str(request.sessionId, "");
  const sessionId = requestedSessionId || `business_customer_session_${systems.nextCustomerSessionNumber++}`;
  if (systems.customerSessions[sessionId]) return reject(warnings, touched, "economy_rejected:business_customer_session_id_exists");
  const queueResult = createHarthmereBusinessCustomerQueueV1({
    businessId: b.businessId,
    typeId: b.typeId,
    sessionId,
    nowMs: request.nowMs,
    count: requestedCount,
    nextTicketNumber: systems.nextCustomerTicketNumber,
    stats,
  });
  systems.nextCustomerTicketNumber = queueResult.nextTicketNumber;
  const firstTicket = queueResult.queue[0];
  const today = customerDay(request.nowMs);
  const dailyBonusGold = stats.lastDailyServedDay === today ? 0 : 10 + tier * 5;
  systems.customerSessions[sessionId] = {
    sessionId,
    businessId: b.businessId,
    typeId: b.typeId,
    actorId: request.actorId,
    status: "active",
    startedAtMs: request.nowMs,
    expiresAtMs: request.nowMs + HARTHMERE_BUSINESS_CUSTOMER_SESSION_MS_V1,
    currentTicketId: firstTicket?.ticketId,
    queue: queueResult.queue,
    servedTicketIds: [],
    failedTicketIds: [],
    streak: 0,
    satisfaction: 50,
    earnedGold: 0,
    progressPoints: 0,
    dailyBonusGold,
    notes: [
      `${definition.interfaceTitle}: ${definition.ownerFunLoop}`,
      `Customers are guided from the entrance to the queue, then to the counter, then back out after service.`,
      `Today: ${definition.dailyReturnTriggers[today % definition.dailyReturnTriggers.length]}`,
    ],
  };
  b.flags.customer_service_shift_started = true;
  touched.add("economy_business_customer_session");
  shared.add(businessSharedKey(b.businessId));
  shared.add(systemsSharedKey("customer_session", sessionId));
  for (const session of expired) shared.add(systemsSharedKey("customer_session", session.sessionId));
}

function serveBusinessCustomer(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "contract_manager");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const systems = state.businessSystems!;
  const sessionId = str(request.sessionId, "");
  const session = sessionId
    ? systems.customerSessions[sessionId]
    : activeCustomerSessionForBusiness(systems, b.businessId, request.nowMs);
  if (!session || session.businessId !== b.businessId) return reject(warnings, touched, "economy_rejected:active_business_customer_session_not_found");
  if (session.status !== "active") return reject(warnings, touched, "economy_rejected:business_customer_session_not_active");
  if (session.expiresAtMs <= request.nowMs) {
    session.status = "expired";
    touched.add("economy_business_customer_session");
    shared.add(systemsSharedKey("customer_session", session.sessionId));
    return reject(warnings, touched, "economy_rejected:business_customer_session_expired");
  }
  const stats = statsForCustomerBusiness(systems, b.businessId);
  const leftTicketIds = expireImpatientCustomerTickets(session, b, stats, request.nowMs);
  if (leftTicketIds.length) {
    touched.add("economy_business_customer_session");
    shared.add(businessSharedKey(b.businessId));
    shared.add(systemsSharedKey("customer_session", session.sessionId));
  }
  if (session.status !== "active") {
    b.flags.customer_service_shift_completed = true;
    return reject(warnings, touched, "economy_rejected:business_customer_left_waiting");
  }

  const definition = getHarthmereBusinessMiniGameDefinitionV1(b.typeId);
  const currentTicketId = session.currentTicketId ?? activeHarthmereBusinessCustomerTicketV1(session)?.ticketId;
  const ticketId = str(request.ticketId, session.currentTicketId ?? "");
  if (ticketId && currentTicketId && ticketId !== currentTicketId) return reject(warnings, touched, "economy_rejected:business_customer_ticket_not_current");
  const ticket = ticketId
    ? session.queue.find((entry) => entry.ticketId === ticketId)
    : activeHarthmereBusinessCustomerTicketV1(session);
  if (!ticket || ticket.status !== "waiting") return reject(warnings, touched, "economy_rejected:waiting_business_customer_not_found");
  const offerId = str(request.offerId, ticket.requestedOfferId);
  const offer = definition.offers.find((entry) => entry.offerId === offerId);
  if (!offer) return reject(warnings, touched, "economy_rejected:business_customer_offer_not_found");
  for (const itemId of Object.keys({ ...offer.requiredItems, ...(offer.producedItems ?? {}) })) {
    if (!getHarthmereBusinessServiceItemDefinitionV1(itemId)) {
      return reject(warnings, touched, `economy_rejected:business_customer_item_not_in_catalog:${itemId}`);
    }
  }

  const npc = findHarthmereBusinessCustomerNpcV1(ticket.npcId);
  const matched = offer.offerId === ticket.requestedOfferId;
  if (!matched) {
    ticket.status = "failed";
    ticket.patienceRemaining = Math.max(0, ticket.patienceRemaining - 20);
    session.failedTicketIds.push(ticket.ticketId);
    session.streak = 0;
    session.satisfaction = clamp(session.satisfaction - 8, 0, 100, session.satisfaction);
    stats.totalFailed += 1;
    b.customerSatisfaction = clamp(b.customerSatisfaction - 4, 0, 100, b.customerSatisfaction);
    b.reputation = Math.max(0, b.reputation - 1);
    session.notes.push(`${npc?.displayName ?? "A customer"} left unhappy after receiving the wrong service.`);
    const completed = advanceCustomerSession(session, request.nowMs);
    if (completed) b.flags.customer_service_shift_completed = true;
    touched.add("economy_business_customer_session");
    shared.add(businessSharedKey(b.businessId));
    shared.add(systemsSharedKey("customer_session", session.sessionId));
    return;
  }

  if (!requireInventory(b, warnings, touched, offer.requiredItems)) return;
  consumeInventory(b, offer.requiredItems);
  if (offer.producedItems) produceInventory(b, offer.producedItems);
  const today = customerDay(request.nowMs);
  const dailyBonus = stats.lastDailyServedDay === today ? 0 : session.dailyBonusGold;
  const rewardGold = Math.max(ticket.rewardGold, offer.rewardGold) + dailyBonus;
  adjustBusinessFunds(b, rewardGold);
  addNeed(state, b, offer.serviceNeed, ticket.needDelta, request.nowMs);
  ticket.status = "served";
  session.servedTicketIds.push(ticket.ticketId);
  session.streak += 1;
  session.earnedGold += rewardGold;
  session.progressPoints += 1 + ticket.difficulty;
  session.satisfaction = clamp(session.satisfaction + offer.satisfactionDelta, 0, 100, session.satisfaction);
  stats.totalServed += 1;
  stats.lifetimeGold += rewardGold;
  stats.bestStreak = Math.max(stats.bestStreak, session.streak);
  stats.lastDailyServedDay = today;
  stats.currentTier = harthmereBusinessCustomerTierForStatsV1(stats);
  const cozyReward = createHarthmereBusinessCozyServiceRewardV1({
    businessId: b.businessId,
    typeId: b.typeId,
    npcId: ticket.npcId,
    npcDisplayName: npc?.displayName ?? "Customer",
    offer,
    ticket,
    streak: session.streak,
    dailyBonusGold: dailyBonus,
    stats,
  });
  applyHarthmereBusinessCozyServiceRewardV1(stats, ticket.npcId, cozyReward);
  b.customerSatisfaction = clamp(b.customerSatisfaction + offer.satisfactionDelta, 0, 100, b.customerSatisfaction);
  b.reputation += ticket.reputationDelta;
  b.flags.customer_service_daily_bonus_claimed = dailyBonus > 0 || b.flags.customer_service_daily_bonus_claimed === true;
  session.notes.push(`${npc?.displayName ?? "Customer"}: ${offer.interactionVerb} complete for ${rewardGold} gold.`);
  session.notes.push(`Cozy reward: +${cozyReward.serviceXp} service XP, +${cozyReward.likeabilityDelta} likeability.`);
  if (cozyReward.collectibleId) session.notes.push(`Collectible earned: ${cozyReward.collectibleId.replace(/_/g, " ")}.`);
  if (cozyReward.decorationUnlockId) session.notes.push(`Decor unlocked: ${cozyReward.decorationUnlockId.replace(/_/g, " ")}.`);
  if (cozyReward.badgeId) session.notes.push(`Badge earned: ${cozyReward.badgeId.replace(/_/g, " ")}.`);
  const completed = advanceCustomerSession(session, request.nowMs);
  if (completed) b.flags.customer_service_shift_completed = true;
  touched.add("economy_business_customer_session");
  touched.add("economy_business_inventory");
  shared.add(businessSharedKey(b.businessId));
  shared.add(systemsSharedKey("customer_session", session.sessionId));
}

function runExoticRefinery(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "exotic_matter_refinery");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  if (b.licenseLevel < 2) return reject(warnings, touched, "economy_rejected:hazardous_refinery_license_required");
  if (!requireInventory(b, warnings, touched, { raw_exotic_matter: 2, stabilizing_crystal: 1, coolant: 1, containment_filter: 1 })) return;
  consumeInventory(b, { raw_exotic_matter: 2, stabilizing_crystal: 1, coolant: 1, containment_filter: 1 });
  produceInventory(b, { stabilized_exotic_matter: 1, portal_fuel: 1, spent_filter: 1 });
  const containment = clamp(request.containmentRating, 0, 100, 80);
  if (containment < 40) createContamination(state, b, request, "exotic_matter_spill", Math.ceil((40 - containment) / 10), warnings, touched, shared);
  addNeed(state, b, "energy", 3, request.nowMs);
  touched.add("economy_exotic_refinery");
  shared.add(businessSharedKey(b.businessId));
}

function certifyPortalFuel(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "exotic_matter_refinery");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const count = int(request.count, 1);
  if (!requireInventory(b, warnings, touched, { portal_fuel: count })) return;
  if (b.licenseLevel < 2) return reject(warnings, touched, "economy_rejected:fuel_certification_license_required");
  consumeInventory(b, { portal_fuel: count });
  produceInventory(b, { certified_portal_fuel: count });
  touched.add("economy_exotic_refinery");
  shared.add(businessSharedKey(b.businessId));
}

function createContamination(state: BusinessSystemsEconomyState, b: HarthmereEconomyBusinessRecordV1, request: HarthmereEconomyMutationRequestV1, kind: string, severity: number, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const systems = state.businessSystems!;
  const siteId = `econ_contamination_${systems.nextContaminationNumber++}`;
  const townId = b.townId ?? "harthmere_grove";
  systems.contaminationSites[siteId] = { siteId, townId, kind, severity: clamp(severity, 1, 10, 1), outbreakRisk: clamp(severity * 10, 0, 100, 10), status: "active", createdAtMs: request.nowMs };
  addNeed(state, b, "sanitation", -severity * 4, request.nowMs);
  addNeed(state, b, "timeline_stability", -severity * 3, request.nowMs);
  reject(warnings, touched, "economy_warning:containment_failure_created_contamination");
  shared.add(systemsSharedKey("contamination", siteId));
}

function runBiomeDecayTick(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, _context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const systems = state.businessSystems!;
  const days = Math.max(1, int(request.days, 1));
  let processed = 0;
  for (const property of Object.values(systems.propertyIntegrations)) {
    if (!property.constructionComplete) continue;
    const anchorId = Object.values(systems.biomeAnchors).find((anchor) => anchor.propertyId === property.propertyId)?.anchorId ?? `econ_anchor_${systems.nextAnchorNumber++}`;
    const anchor = systems.biomeAnchors[anchorId] ?? {
      anchorId,
      propertyId: property.propertyId,
      condition: property.condition,
      climateStability: 75,
      weatherFailure: false,
      timelineLeak: 0,
      lastMaintainedAtMs: request.nowMs,
    };
    anchor.condition = clamp(anchor.condition - days * 2, 0, 100, anchor.condition);
    anchor.climateStability = clamp(anchor.climateStability - days * 1.5, 0, 100, anchor.climateStability);
    anchor.timelineLeak = clamp(anchor.timelineLeak + days, 0, 100, anchor.timelineLeak);
    anchor.weatherFailure = anchor.climateStability < 45;
    systems.biomeAnchors[anchorId] = anchor;
    property.condition = Math.min(property.condition, anchor.condition);
    processed++;
    shared.add(systemsSharedKey("biome_anchor", anchorId));
  }
  if (processed === 0) reject(warnings, touched, "economy_warning:no_biome_properties_to_decay");
  touched.add("economy_biome_decay");
}

function performBiomeMaintenance(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "biome_maintenance_repair");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const propertyId = str(request.propertyId, "");
  const anchor = Object.values(state.businessSystems!.biomeAnchors).find((a) => a.propertyId === propertyId);
  if (!propertyId || !anchor) return reject(warnings, touched, "economy_rejected:biome_anchor_not_found");
  if (!requireInventory(b, warnings, touched, { repair_kit: 1, stabilized_exotic_matter: 1 })) return;
  consumeInventory(b, { repair_kit: 1, stabilized_exotic_matter: 1 });
  anchor.condition = clamp(anchor.condition + 45, 0, 100, anchor.condition);
  anchor.climateStability = clamp(anchor.climateStability + 30, 0, 100, anchor.climateStability);
  anchor.timelineLeak = clamp(anchor.timelineLeak - 25, 0, 100, anchor.timelineLeak);
  anchor.weatherFailure = anchor.climateStability < 45;
  anchor.lastMaintainedAtMs = request.nowMs;
  const property = state.businessSystems!.propertyIntegrations[propertyId];
  if (property) property.condition = Math.max(property.condition, anchor.condition);
  adjustBusinessFunds(b, int(request.amountGold, 120));
  addNeed(state, b, "property_condition", 8, request.nowMs);
  touched.add("economy_biome_maintenance");
  shared.add(systemsSharedKey("biome_anchor", anchor.anchorId));
}

function linkBusinessProperty(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator");
  if (!b) return;
  const systems = state.businessSystems!;
  const propertyId = str(request.propertyId, `econ_property_${systems.nextPropertyNumber++}`);
  systems.propertyIntegrations[propertyId] = {
    propertyId,
    businessId: b.businessId,
    ownerKind: b.ownerKind,
    ownerId: b.ownerId,
    buildingType: str(request.buildingType, b.typeId),
    valueGold: int(request.propertyValueGold, Math.max(500, b.balanceGold + 500)),
    condition: clamp(request.propertyCondition, 0, 100, 80),
    cleanliness: clamp(request.cleanliness, 0, 100, 75),
    beauty: clamp(request.beauty, 0, 100, 50),
    rentGoldPerDay: int(request.rentGoldPerDay, 15),
    constructionStage: clamp(request.constructionStage, 0, 100, 100),
    constructionComplete: request.constructionComplete !== false,
    permits: Array.isArray(request.permits) ? request.permits.map(String) : [b.licenseClass],
    lastRentPaidAtMs: request.nowMs,
  };
  b.propertyId = propertyId;
  touched.add("economy_property_integration");
  shared.add(systemsSharedKey("property", propertyId));
  shared.add(businessSharedKey(b.businessId));
}

function installBiomeDesign(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "contract_manager", "biome_design_studio");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const propertyId = str(request.propertyId, "");
  const property = state.businessSystems!.propertyIntegrations[propertyId];
  if (!property) return reject(warnings, touched, "economy_rejected:property_not_found_for_design_install");
  if (!requireInventory(b, warnings, touched, { decor_pack: 1, lighting_system: 1, terrain_template: 1 })) return;
  consumeInventory(b, { decor_pack: 1, lighting_system: 1, terrain_template: 1 });
  property.beauty = clamp(property.beauty + 25, 0, 100, property.beauty);
  property.valueGold += int(request.amountGold, 350);
  adjustBusinessFunds(b, int(request.amountGold, 350));
  addNeed(state, b, "identity", 6, request.nowMs);
  addNeed(state, b, "tourism", 4, request.nowMs);
  touched.add("economy_biome_design");
  shared.add(systemsSharedKey("property", propertyId));
}

function createSecurityThreat(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  if (!context.allowNpcAdministration && !(context as any).allowWorldAdministration) return reject(warnings, touched, "economy_rejected:world_admin_required_for_threat_creation");
  const systems = state.businessSystems!;
  const threatId = `econ_threat_${systems.nextThreatNumber++}`;
  systems.threats[threatId] = {
    threatId,
    townId: str(request.townId, "harthmere_grove"),
    kind: str(request.threatKind, "timeline_raider"),
    severity: clamp(request.severity, 1, 10, 3),
    status: "active",
    bountyGold: int(request.rewardGold, 100),
    createdAtMs: request.nowMs,
  };
  const town = ensureTown(state, systems.threats[threatId].townId, str(request.regionId, "harthmere_grove_region"), request.nowMs);
  town.needs.safety.value = clamp(town.needs.safety.value - systems.threats[threatId].severity * 3, 0, 100, town.needs.safety.value);
  touched.add("economy_security_threat");
  shared.add(systemsSharedKey("threat", threatId));
}

function resolveSecurityThreat(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "contract_manager", "security_defense_contractor");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const systems = state.businessSystems!;
  const threatId = str(request.threatId, "");
  const threat = systems.threats[threatId];
  if (!threat || threat.status !== "active") return reject(warnings, touched, "economy_rejected:active_threat_not_found");
  const hasGear = Object.keys(b.inventory).some((item) => /weapon|sword|armor|trap|ration/i.test(item));
  if (!hasGear) return reject(warnings, touched, "economy_rejected:security_contract_requires_gear");
  threat.status = "contained";
  threat.assignedBusinessId = b.businessId;
  threat.resolvedAtMs = request.nowMs;
  adjustBusinessFunds(b, threat.bountyGold);
  b.reputation += Math.max(1, threat.severity);
  addNeed(state, b, "safety", threat.severity * 5, request.nowMs);
  touched.add("economy_security_threat");
  shared.add(systemsSharedKey("threat", threatId));
}

function buildPortalEndpoint(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "route_manager", "portal_transit_company");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  if (b.licenseLevel < 3) return reject(warnings, touched, "economy_rejected:portal_transit_license_required");
  if (!requireInventory(b, warnings, touched, { anchor_core: 1, destination_crystal: 1, certified_portal_fuel: 2 })) return;
  consumeInventory(b, { anchor_core: 1, destination_crystal: 1, certified_portal_fuel: 2 });
  const systems = state.businessSystems!;
  const endpointId = `econ_portal_${systems.nextPortalNumber++}`;
  systems.portalEndpoints[endpointId] = {
    endpointId,
    businessId: b.businessId,
    originTownId: str(request.originTownId, b.townId ?? "harthmere_grove"),
    destinationTownId: str(request.destinationTownId, "harthmere_market"),
    fuelUnits: 2,
    uptime: 100,
    active: true,
    safetyRating: clamp(request.safetyRating, 0, 100, 80),
    passengerFeesGold: 0,
    cargoFeesGold: 0,
  };
  addNeed(state, b, "travel", 10, request.nowMs);
  touched.add("economy_portal_transit");
  shared.add(systemsSharedKey("portal", endpointId));
}

function runPortalTransit(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "route_manager", "portal_transit_company");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const endpoint = state.businessSystems!.portalEndpoints[str(request.endpointId, "")];
  if (!endpoint || endpoint.businessId !== b.businessId || !endpoint.active) return reject(warnings, touched, "economy_rejected:active_portal_endpoint_not_found");
  const passengers = int(request.passengers, 1);
  const cargoUnits = int(request.cargoUnits, 0);
  const fuelNeeded = Math.max(1, Math.ceil((passengers + cargoUnits) / 5));
  if (endpoint.fuelUnits < fuelNeeded) return reject(warnings, touched, "economy_rejected:portal_fuel_insufficient");
  endpoint.fuelUnits -= fuelNeeded;
  endpoint.uptime = clamp(endpoint.uptime - fuelNeeded, 0, 100, endpoint.uptime);
  const fare = passengers * int(request.passengerFeeGold, 12) + cargoUnits * int(request.cargoFeeGold, 5);
  endpoint.passengerFeesGold += passengers * int(request.passengerFeeGold, 12);
  endpoint.cargoFeesGold += cargoUnits * int(request.cargoFeeGold, 5);
  adjustBusinessFunds(b, fare);
  addNeed(state, b, "logistics", 4, request.nowMs);
  touched.add("economy_portal_transit");
  shared.add(systemsSharedKey("portal", endpoint.endpointId));
}

function plantCropNode(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "biome_farming_rare_foods");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const seedId = str(request.seedItemId, "rare_seed");
  if (!requireInventory(b, warnings, touched, { [seedId]: 1, clean_water: 1, fertilizer: 1 })) return;
  consumeInventory(b, { [seedId]: 1, clean_water: 1, fertilizer: 1 });
  const systems = state.businessSystems!;
  const cropId = `econ_crop_${systems.nextCropNumber++}`;
  systems.cropNodes[cropId] = {
    cropId,
    businessId: b.businessId,
    townId: b.townId ?? "harthmere_grove",
    cropItemId: str(request.cropItemId, "rare_crop"),
    climate: str(request.climate, "temperate"),
    plantedAtMs: request.nowMs,
    growth: 0,
    health: 100,
    harvested: false,
  };
  touched.add("economy_farming");
  shared.add(systemsSharedKey("crop", cropId));
}

function runCropGrowthTick(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, _context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const systems = state.businessSystems!;
  const days = Math.max(1, int(request.days, 1));
  let changed = 0;
  for (const crop of Object.values(systems.cropNodes)) {
    if (crop.harvested) continue;
    const climateMatch = !request.climate || request.climate === crop.climate;
    crop.growth = clamp(crop.growth + days * (climateMatch ? 35 : 12), 0, 100, crop.growth);
    crop.health = clamp(crop.health - days * (climateMatch ? 1 : 8), 0, 100, crop.health);
    if (crop.health <= 10) crop.spoiledAtMs = request.nowMs;
    changed++;
    shared.add(systemsSharedKey("crop", crop.cropId));
  }
  if (changed === 0) reject(warnings, touched, "economy_warning:no_crops_to_grow");
  touched.add("economy_farming");
}

function harvestCropNode(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "biome_farming_rare_foods");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const crop = state.businessSystems!.cropNodes[str(request.cropId, "")];
  if (!crop || crop.businessId !== b.businessId || crop.harvested) return reject(warnings, touched, "economy_rejected:harvestable_crop_not_found");
  if (crop.growth < 100 || crop.spoiledAtMs) return reject(warnings, touched, "economy_rejected:crop_not_ready_or_spoiled");
  crop.harvested = true;
  const count = Math.max(1, Math.round(crop.health / 25));
  produceInventory(b, { [crop.cropItemId]: count }, { expiresAtMs: request.nowMs + 5 * 24 * 60 * 60 * 1000 });
  addNeed(state, b, "food", count * 2, request.nowMs);
  touched.add("economy_farming");
  shared.add(businessSharedKey(b.businessId));
}

function runSpoilageTick(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, _context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  let spoiled = 0;
  for (const b of Object.values(state.businesses)) {
    for (const [itemId, stack] of Object.entries(b.inventory)) {
      if (stack.expiresAtMs && stack.expiresAtMs <= request.nowMs) {
        delete b.inventory[itemId];
        applyItem(b.inventory, "spoiled_food_waste", stack.count);
        spoiled += stack.count;
        shared.add(businessSharedKey(b.businessId));
      }
    }
  }
  if (spoiled === 0) reject(warnings, touched, "economy_warning:no_spoilage_found");
  touched.add("economy_spoilage");
}

function repairDurableItem(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "weapons_tools");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const systems = state.businessSystems!;
  const itemId = str(request.durableItemId, "");
  const item = systems.durableItems[itemId];
  if (!item) return reject(warnings, touched, "economy_rejected:durable_item_not_found");
  if (!requireInventory(b, warnings, touched, { repair_tool: 1, iron_ingot: 1 })) return;
  consumeInventory(b, { iron_ingot: 1 });
  item.condition = clamp(item.condition + 45, 0, 100, item.condition);
  adjustBusinessFunds(b, int(request.amountGold, 45));
  touched.add("economy_weapons_tools");
  shared.add(systemsSharedKey("durable_item", itemId));
}

function upgradeDurableItem(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "weapons_tools");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const item = state.businessSystems!.durableItems[str(request.durableItemId, "")];
  if (!item) return reject(warnings, touched, "economy_rejected:durable_item_not_found");
  if (item.restricted && b.licenseLevel < 2) return reject(warnings, touched, "economy_rejected:restricted_weapon_permit_required");
  if (!requireInventory(b, warnings, touched, { upgrade_crystal: 1, iron_ingot: 2 })) return;
  consumeInventory(b, { upgrade_crystal: 1, iron_ingot: 2 });
  item.quality = clamp(item.quality + 1, 1, 10, item.quality);
  item.upgraded = true;
  touched.add("economy_weapons_tools");
  shared.add(systemsSharedKey("durable_item", item.durableItemId));
}

function registerDurableItem(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, _context: BusinessSystemsContext, _warnings: string[], touched: Set<string>, shared: Set<string>) {
  const systems = state.businessSystems!;
  const durableItemId = `econ_durable_${systems.nextDurableItemNumber++}`;
  systems.durableItems[durableItemId] = {
    durableItemId,
    ownerId: str(request.ownerId, request.actorId),
    itemId: str(request.itemId, "tool"),
    condition: clamp(request.condition, 0, 100, 50),
    quality: clamp(request.quality, 1, 10, 1),
    restricted: request.restricted === true,
    upgraded: false,
  };
  touched.add("economy_durable_item");
  shared.add(systemsSharedKey("durable_item", durableItemId));
}

function craftMagicGood(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "magic_goods");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  if (b.licenseLevel < 2) return reject(warnings, touched, "economy_rejected:magic_goods_license_required");
  if (!requireInventory(b, warnings, touched, { stabilized_exotic_matter: 1, herb_bundle: 1, relic_fragment: 1 })) return;
  consumeInventory(b, { stabilized_exotic_matter: 1, herb_bundle: 1, relic_fragment: 1 });
  const itemId = str(request.itemId, "protective_ward_charm");
  produceInventory(b, { [itemId]: 1 }, { expiresAtMs: request.nowMs + 3 * 24 * 60 * 60 * 1000 });
  const magicId = `econ_magic_${state.businessSystems!.nextMagicNumber++}`;
  state.businessSystems!.unstableMagicItems[magicId] = { businessId: b.businessId, itemId, expiresAtMs: request.nowMs + 3 * 24 * 60 * 60 * 1000, stability: clamp(request.stability, 0, 100, 70) };
  touched.add("economy_magic_goods");
  shared.add(businessSharedKey(b.businessId));
}

function installWard(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "magic_goods");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const property = state.businessSystems!.propertyIntegrations[str(request.propertyId, "")];
  if (!property) return reject(warnings, touched, "economy_rejected:ward_property_not_found");
  if (!requireInventory(b, warnings, touched, { protective_ward_charm: 1 })) return;
  consumeInventory(b, { protective_ward_charm: 1 });
  property.condition = clamp(property.condition + 10, 0, 100, property.condition);
  property.permits.push("warded");
  addNeed(state, b, "timeline_stability", 6, request.nowMs);
  touched.add("economy_magic_goods");
  shared.add(systemsSharedKey("property", property.propertyId));
}

function runUnstableMagicTick(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, _context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  let expired = 0;
  for (const [magicId, magic] of Object.entries(state.businessSystems!.unstableMagicItems)) {
    magic.stability = clamp(magic.stability - int(request.days, 1) * 20, 0, 100, magic.stability);
    if (magic.expiresAtMs <= request.nowMs || magic.stability <= 0) {
      const b = state.businesses[magic.businessId];
      if (b) applyItem(b.inventory, magic.itemId, -itemCount(b.inventory, magic.itemId));
      delete state.businessSystems!.unstableMagicItems[magicId];
      expired++;
      shared.add(businessSharedKey(magic.businessId));
    }
  }
  if (expired === 0) reject(warnings, touched, "economy_warning:no_unstable_magic_expired");
  touched.add("economy_magic_goods");
}

function removeAnomaly(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "magic_goods");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const site = state.businessSystems!.contaminationSites[str(request.siteId, "")];
  if (!site || site.status !== "active") return reject(warnings, touched, "economy_rejected:active_anomaly_not_found");
  if (!requireInventory(b, warnings, touched, { anomaly_reagent: 1 })) return;
  consumeInventory(b, { anomaly_reagent: 1 });
  site.status = "contained";
  site.severity = clamp(site.severity - 3, 0, 10, site.severity);
  addNeed(state, b, "timeline_stability", 8, request.nowMs);
  touched.add("economy_magic_goods");
  shared.add(systemsSharedKey("contamination", site.siteId));
}

function discoverRoute(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "route_manager", "exploration_guide");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  if (!requireInventory(b, warnings, touched, { field_kit: 1, ration_pack: 1 })) return;
  consumeInventory(b, { ration_pack: 1 });
  const systems = state.businessSystems!;
  const routeId = `econ_exploration_route_${systems.nextRouteNumber++}`;
  systems.explorationRoutes[routeId] = { routeId, businessId: b.businessId, originTownId: str(request.originTownId, b.townId ?? "harthmere_grove"), destinationId: str(request.destinationId, "unknown_ruins"), safetyRating: clamp(request.safetyRating, 0, 100, 60), mapFreshness: 100, discoveredAtMs: request.nowMs, lastSurveyedAtMs: request.nowMs };
  addNeed(state, b, "knowledge", 6, request.nowMs);
  touched.add("economy_exploration");
  shared.add(systemsSharedKey("exploration_route", routeId));
}

function runMapAgingTick(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, _context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  let aged = 0;
  const days = int(request.days, 1);
  for (const route of Object.values(state.businessSystems!.explorationRoutes)) {
    route.mapFreshness = clamp(route.mapFreshness - days * 7, 0, 100, route.mapFreshness);
    aged++;
    shared.add(systemsSharedKey("exploration_route", route.routeId));
  }
  if (aged === 0) reject(warnings, touched, "economy_warning:no_maps_to_age");
  touched.add("economy_exploration");
}

function leadExpedition(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "contract_manager", "exploration_guide");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const route = state.businessSystems!.explorationRoutes[str(request.routeId, "")];
  if (!route || route.businessId !== b.businessId) return reject(warnings, touched, "economy_rejected:exploration_route_not_found");
  if (route.mapFreshness < 35) return reject(warnings, touched, "economy_rejected:map_too_stale_for_expedition");
  const success = route.safetyRating + route.mapFreshness >= clamp(request.difficulty, 1, 200, 100);
  if (!success) {
    route.safetyRating = clamp(route.safetyRating - 10, 0, 100, route.safetyRating);
    return reject(warnings, touched, "economy_warning:expedition_failed_route_became_riskier");
  }
  adjustBusinessFunds(b, int(request.rewardGold, 150));
  b.reputation += 2;
  addNeed(state, b, "knowledge", 5, request.nowMs);
  touched.add("economy_exploration");
  shared.add(systemsSharedKey("exploration_route", route.routeId));
}

function startPropertyProject(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "custom_home_property_development");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const systems = state.businessSystems!;
  const propertyId = str(request.propertyId, `econ_property_${systems.nextPropertyNumber++}`);
  const existing = systems.propertyIntegrations[propertyId];
  if (existing && existing.businessId !== b.businessId) return reject(warnings, touched, "economy_rejected:property_already_claimed");
  if (existing?.constructionComplete) return reject(warnings, touched, "economy_rejected:property_already_completed");
  if (existing && !existing.constructionComplete) return reject(warnings, touched, "economy_rejected:property_project_already_active");
  const projectInputs = { wood_plank: 4, stone_block: 4, iron_ingot: 2, utility_core: 1 };
  if (!requireInventory(b, warnings, touched, projectInputs)) return;
  consumeInventory(b, projectInputs);
  const permits = new Set(Array.isArray(request.permits) ? request.permits.map(String) : []);
  permits.add("construction");
  permits.add("tax_account");
  permits.add(b.licenseClass);
  systems.propertyIntegrations[propertyId] = { propertyId, businessId: b.businessId, ownerKind: b.ownerKind, ownerId: b.ownerId, buildingType: str(request.buildingType, "shop"), valueGold: int(request.propertyValueGold, 1000), condition: 50, cleanliness: 50, beauty: 35, rentGoldPerDay: int(request.rentGoldPerDay, 25), constructionStage: 10, constructionComplete: false, permits: [...permits] };
  touched.add("economy_property_development");
  shared.add(systemsSharedKey("property", propertyId));
}

function advancePropertyProject(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "custom_home_property_development");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const property = state.businessSystems!.propertyIntegrations[str(request.propertyId, "")];
  if (!property || property.businessId !== b.businessId) return reject(warnings, touched, "economy_rejected:property_project_not_found");
  if (property.constructionComplete) return reject(warnings, touched, "economy_rejected:property_project_already_complete");
  const requestedProgress = request.progress === undefined ? 35 : Number(request.progress);
  if (!Number.isFinite(requestedProgress) || requestedProgress <= 0) return reject(warnings, touched, "economy_rejected:invalid_property_project_progress");
  if (!requireInventory(b, warnings, touched, { wood_plank: 2, stone_block: 2 })) return;
  consumeInventory(b, { wood_plank: 2, stone_block: 2 });
  property.constructionStage = clamp(property.constructionStage + Math.trunc(requestedProgress), 0, 100, property.constructionStage);
  property.constructionComplete = property.constructionStage >= 100;
  property.condition = clamp(property.condition + 15, 0, 100, property.condition);
  if (property.constructionComplete) addNeed(state, b, "housing", 10, request.nowMs);
  touched.add("economy_property_development");
  shared.add(systemsSharedKey("property", property.propertyId));
}

function refreshTraderInventory(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "inventory_manager", "general_trader");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const budget = int(request.amountGold, 100);
  if (b.balanceGold < budget) return reject(warnings, touched, "economy_rejected:trader_refresh_funds_insufficient");
  b.balanceGold -= budget;
  produceInventory(b, { clean_water: 10, worker_meal: 5, repair_kit: 2, field_medkit: 1 });
  const region = state.regions[b.regionId] ?? (state.regions[b.regionId] = { regionId: b.regionId, towns: [], priceIndex: {}, itemSupply: {}, itemDemand: {}, routeSafety: {}, lastTickAtMs: request.nowMs } as any);
  for (const item of ["clean_water", "worker_meal", "repair_kit", "field_medkit"]) region.itemSupply[item] = (region.itemSupply[item] ?? 0) + 1;
  touched.add("economy_general_trader");
  shared.add(businessSharedKey(b.businessId));
}

function performRegionalArbitrage(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "price_manager", "general_trader");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const itemId = str(request.itemId, "worker_meal");
  const count = int(request.count, 1);
  if (itemCount(b.inventory, itemId) < count) return reject(warnings, touched, "economy_rejected:arbitrage_inventory_insufficient");
  const originPrice = clamp(request.originUnitPriceGold, 1, 10000, 5);
  const destinationPrice = clamp(request.destinationUnitPriceGold, 1, 10000, 10);
  if (destinationPrice <= originPrice) return reject(warnings, touched, "economy_rejected:arbitrage_not_profitable");
  applyItem(b.inventory, itemId, -count);
  adjustBusinessFunds(b, Math.round((destinationPrice - originPrice) * count));
  touched.add("economy_general_trader");
  shared.add(businessSharedKey(b.businessId));
}

function ensureAnimalPopulation(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1) {
  const systems = state.businessSystems!;
  const populationId = str(request.populationId, `econ_animal_population_${systems.nextAnimalPopulationNumber++}`);
  systems.animalPopulations[populationId] ??= { populationId, townId: str(request.townId, "harthmere_grove"), species: str(request.species, "muckernut"), count: int(request.populationCount, 20), protected: request.protected === true };
  return systems.animalPopulations[populationId];
}

function huntWildlife(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "hunter_wild_meat");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const population = ensureAnimalPopulation(state, request);
  const count = int(request.count, 1);
  if (population.protected && b.licenseLevel < 2) return reject(warnings, touched, "economy_rejected:protected_species_permit_required");
  if (population.count < count || population.count - count < 3) return reject(warnings, touched, "economy_rejected:wildlife_population_too_low");
  population.count -= count;
  if (population.count < 8) population.overhuntedUntilMs = request.nowMs + 7 * 24 * 60 * 60 * 1000;
  produceInventory(b, { wild_meat: count * 2, hide: count });
  addNeed(state, b, "food", count, request.nowMs);
  touched.add("economy_hunter");
  shared.add(systemsSharedKey("animal_population", population.populationId));
}

function runWildlifeTick(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, _context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  let changed = 0;
  for (const population of Object.values(state.businessSystems!.animalPopulations)) {
    if (population.overhuntedUntilMs && population.overhuntedUntilMs > request.nowMs) {
      changed++;
      continue;
    }
    population.count = Math.min(80, population.count + int(request.days, 1) * 2);
    changed++;
    shared.add(systemsSharedKey("animal_population", population.populationId));
  }
  if (changed === 0) reject(warnings, touched, "economy_warning:no_wildlife_populations_to_tick");
  touched.add("economy_hunter");
}

function registerPatient(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  if (!context.allowNpcAdministration && !(context as any).allowWorldAdministration) return reject(warnings, touched, "economy_rejected:world_admin_required_for_patient_creation");
  const systems = state.businessSystems!;
  const patientId = `econ_patient_${systems.nextPatientNumber++}`;
  systems.patients[patientId] = { patientId, actorId: str(request.patientActorId, ""), townId: str(request.townId, "harthmere_grove"), conditionKind: str(request.conditionKind, "injury"), severity: clamp(request.severity, 1, 10, 3), status: "sick", createdAtMs: request.nowMs };
  touched.add("economy_medical");
  shared.add(systemsSharedKey("patient", patientId));
}

function treatPatient(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "medical_doctor");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  if (b.licenseLevel < 2) return reject(warnings, touched, "economy_rejected:medical_license_required");
  const patient = state.businessSystems!.patients[str(request.patientId, "")];
  if (!patient || patient.status !== "sick") return reject(warnings, touched, "economy_rejected:sick_patient_not_found");
  if (!requireInventory(b, warnings, touched, { field_medkit: 1, medicine: 1 })) return;
  consumeInventory(b, { field_medkit: 1, medicine: 1 });
  const skill = clamp(request.treatmentSkill, 0, 10, b.licenseLevel);
  const success = skill + b.licenseLevel >= patient.severity;
  patient.status = success ? "treated" : "failed";
  patient.treatedAtMs = request.nowMs;
  if (success) {
    adjustBusinessFunds(b, int(request.amountGold, 90));
    addNeed(state, b, "health", patient.severity * 4, request.nowMs);
  } else {
    b.reputation = Math.max(0, b.reputation - patient.severity);
    reject(warnings, touched, "economy_warning:treatment_failed");
  }
  touched.add("economy_medical");
  shared.add(systemsSharedKey("patient", patient.patientId));
}

function buildTeleportPad(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "route_manager", "teleport_owner");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  if (b.licenseLevel < 2) return reject(warnings, touched, "economy_rejected:teleport_license_required");
  if (!requireInventory(b, warnings, touched, { teleport_fuel: 2, destination_crystal: 1, pad_part: 2 })) return;
  consumeInventory(b, { teleport_fuel: 2, destination_crystal: 1, pad_part: 2 });
  const systems = state.businessSystems!;
  const padId = `econ_teleport_${systems.nextTeleportNumber++}`;
  systems.teleportPads[padId] = { padId, businessId: b.businessId, locationId: str(request.locationId, b.townId ?? "harthmere_grove"), linkedDestinationId: str(request.destinationId, "home"), fuelUnits: 2, stability: 100, accessKeys: {}, usesToday: 0 };
  addNeed(state, b, "travel", 5, request.nowMs);
  touched.add("economy_teleport");
  shared.add(systemsSharedKey("teleport", padId));
}

function issueTeleportAccessKey(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "route_manager", "teleport_owner");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const pad = state.businessSystems!.teleportPads[str(request.padId, "")];
  if (!pad || pad.businessId !== b.businessId) return reject(warnings, touched, "economy_rejected:teleport_pad_not_found");
  const keyId = `teleport_key_${Object.keys(pad.accessKeys).length + 1}`;
  pad.accessKeys[keyId] = { actorId: str(request.targetActorId, request.actorId), expiresAtMs: Number(request.expiresAtMs ?? request.nowMs + 7 * 24 * 60 * 60 * 1000) };
  touched.add("economy_teleport");
  shared.add(systemsSharedKey("teleport", pad.padId));
}

function useTeleportPad(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, _context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const pad = state.businessSystems!.teleportPads[str(request.padId, "")];
  if (!pad) return reject(warnings, touched, "economy_rejected:teleport_pad_not_found");
  const b = state.businesses[pad.businessId];
  if (!b || b.status !== "open") return reject(warnings, touched, "economy_rejected:business_not_open");
  const hasAccess = Object.values(pad.accessKeys).some((key) => key.actorId === request.actorId && key.expiresAtMs > request.nowMs);
  if (!hasAccess) return reject(warnings, touched, "economy_rejected:teleport_access_key_required");
  if (pad.fuelUnits <= 0 || pad.stability < 25) return reject(warnings, touched, "economy_rejected:teleport_pad_unstable_or_unfueled");
  pad.fuelUnits -= 1;
  pad.usesToday += 1;
  pad.stability = clamp(pad.stability - 5, 0, 100, pad.stability);
  if (b) adjustBusinessFunds(b, int(request.amountGold, 18));
  touched.add("economy_teleport");
  shared.add(systemsSharedKey("teleport", pad.padId));
}

function runTeleportDestabilizationTick(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, _context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  let changed = 0;
  for (const pad of Object.values(state.businessSystems!.teleportPads)) {
    pad.stability = clamp(pad.stability - int(request.days, 1) * (2 + pad.usesToday), 0, 100, pad.stability);
    pad.usesToday = 0;
    changed++;
    shared.add(systemsSharedKey("teleport", pad.padId));
  }
  if (changed === 0) reject(warnings, touched, "economy_warning:no_teleport_pads_to_tick");
  touched.add("economy_teleport");
}

function accumulateWaste(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  if (!context.allowNpcAdministration && !(context as any).allowWorldAdministration) return reject(warnings, touched, "economy_rejected:world_admin_required_for_waste_accumulation");
  const systems = state.businessSystems!;
  const siteId = `econ_contamination_${systems.nextContaminationNumber++}`;
  const severity = clamp(request.severity, 1, 10, 2);
  systems.contaminationSites[siteId] = { siteId, townId: str(request.townId, "harthmere_grove"), severity, kind: str(request.kind, "waste_overflow"), outbreakRisk: severity * 8, status: "active", createdAtMs: request.nowMs };
  const town = ensureTown(state, systems.contaminationSites[siteId].townId, str(request.regionId, "harthmere_grove_region"), request.nowMs);
  town.needs.sanitation.value = clamp(town.needs.sanitation.value - severity * 5, 0, 100, town.needs.sanitation.value);
  touched.add("economy_sanitation");
  shared.add(systemsSharedKey("contamination", siteId));
}

function cleanupContaminationSite(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "waste_sanitation_cleanup");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const site = state.businessSystems!.contaminationSites[str(request.siteId, "")];
  if (!site || site.status === "clean") return reject(warnings, touched, "economy_rejected:contamination_site_not_found");
  if (!requireInventory(b, warnings, touched, { cleaning_reagent: 1, containment_barrel: 1 })) return;
  consumeInventory(b, { cleaning_reagent: 1, containment_barrel: 1 });
  site.status = "clean";
  site.cleanedAtMs = request.nowMs;
  site.outbreakRisk = 0;
  adjustBusinessFunds(b, int(request.amountGold, 80));
  addNeed(state, b, "sanitation", site.severity * 6, request.nowMs);
  addNeed(state, b, "health", site.severity * 2, request.nowMs);
  touched.add("economy_sanitation");
  shared.add(systemsSharedKey("contamination", site.siteId));
}

function runOutbreakPreventionTick(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, _context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  let activeRisk = 0;
  for (const site of Object.values(state.businessSystems!.contaminationSites)) if (site.status === "active") activeRisk += site.outbreakRisk;
  if (activeRisk <= 0) return reject(warnings, touched, "economy_warning:no_outbreak_risk_present");
  for (const town of Object.values(state.towns) as any[]) {
    town.needs.health.value = clamp(town.needs.health.value - Math.ceil(activeRisk / 50), 0, 100, town.needs.health.value);
    shared.add(townSharedKey(town.townId));
  }
  touched.add("economy_sanitation");
}

function repairFixture(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "repair_maintenance_person");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const property = state.businessSystems!.propertyIntegrations[str(request.propertyId, "")];
  const durable = state.businessSystems!.durableItems[str(request.durableItemId, "")];
  if (!property && !durable) return reject(warnings, touched, "economy_rejected:repair_target_not_found");
  if (!requireInventory(b, warnings, touched, { nails: 1, metal_part: 1, repair_tool: 1 })) return;
  consumeInventory(b, { nails: 1, metal_part: 1 });
  if (property) property.condition = clamp(property.condition + 25, 0, 100, property.condition);
  if (durable) durable.condition = clamp(durable.condition + 30, 0, 100, durable.condition);
  adjustBusinessFunds(b, int(request.amountGold, 35));
  addNeed(state, b, "maintenance", 4, request.nowMs);
  touched.add("economy_repair_maintenance");
  shared.add(businessSharedKey(b.businessId));
}

function setRestaurantMenu(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "price_manager", "food_service_restaurant");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const menu = Array.isArray(request.menuItems) ? request.menuItems.map(String).slice(0, 12) : [];
  if (menu.length === 0) return reject(warnings, touched, "economy_rejected:restaurant_menu_required");
  state.businessSystems!.menuByBusiness[b.businessId] = menu;
  touched.add("economy_restaurant");
  shared.add(businessSharedKey(b.businessId));
}

function serveRestaurantDay(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "contract_manager", "food_service_restaurant");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const menu = state.businessSystems!.menuByBusiness[b.businessId] ?? [];
  if (menu.length === 0) return reject(warnings, touched, "economy_rejected:restaurant_menu_required");
  const sanitation = clamp(request.sanitationRating, 0, 100, b.sanitationRating);
  if (sanitation < 35) return reject(warnings, touched, "economy_rejected:restaurant_sanitation_too_low");
  let mealsServed = 0;
  for (const itemId of menu) {
    if (itemCount(b.inventory, itemId) > 0) {
      applyItem(b.inventory, itemId, -1);
      mealsServed++;
    }
  }
  if (mealsServed === 0) return reject(warnings, touched, "economy_rejected:restaurant_out_of_menu_stock");
  adjustBusinessFunds(b, mealsServed * int(request.unitPriceGold, 10));
  b.customerSatisfaction = clamp(b.customerSatisfaction + mealsServed + (sanitation > 70 ? 2 : -2), 0, 100, b.customerSatisfaction);
  addNeed(state, b, "food", mealsServed * 2, request.nowMs);
  addNeed(state, b, "tourism", 2, request.nowMs);
  touched.add("economy_restaurant");
  shared.add(businessSharedKey(b.businessId));
}

function createDelivery(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "contract_manager", "courier");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const itemId = str(request.itemId, "");
  const count = int(request.count, 1);
  if (!itemId || itemCount(b.inventory, itemId) < count) return reject(warnings, touched, "economy_rejected:courier_delivery_inventory_required");
  applyItem(b.inventory, itemId, -count);
  const systems = state.businessSystems!;
  const deliveryId = `econ_delivery_${systems.nextDeliveryNumber++}`;
  systems.deliveries[deliveryId] = { deliveryId, courierBusinessId: b.businessId, fromBusinessId: str(request.fromBusinessId, ""), toBusinessId: str(request.toBusinessId, ""), itemId, count, escrowGold: int(request.rewardGold, 30), deadlineAtMs: Number(request.deadlineAtMs ?? request.nowMs + 24 * 60 * 60 * 1000), condition: clamp(request.condition, 0, 100, 100), status: "active" };
  touched.add("economy_courier");
  shared.add(systemsSharedKey("delivery", deliveryId));
}

function completeDelivery(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "contract_manager", "courier");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const delivery = state.businessSystems!.deliveries[str(request.deliveryId, "")];
  if (!delivery || delivery.courierBusinessId !== b.businessId || delivery.status !== "active") return reject(warnings, touched, "economy_rejected:active_delivery_not_found");
  if (delivery.deadlineAtMs < request.nowMs) {
    delivery.status = "expired";
    return reject(warnings, touched, "economy_rejected:delivery_deadline_missed");
  }
  delivery.condition = clamp(delivery.condition - int(request.damage, 0), 0, 100, delivery.condition);
  if (delivery.condition < 50) delivery.status = "damaged";
  else delivery.status = "delivered";
  if (delivery.status === "delivered") adjustBusinessFunds(b, delivery.escrowGold);
  else b.reputation = Math.max(0, b.reputation - 3);
  addNeed(state, b, "logistics", 3, request.nowMs);
  touched.add("economy_courier");
  shared.add(systemsSharedKey("delivery", delivery.deliveryId));
}

function runDeliveryDeadlineTick(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, _context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  let expired = 0;
  for (const delivery of Object.values(state.businessSystems!.deliveries)) {
    if (delivery.status === "active" && delivery.deadlineAtMs < request.nowMs) {
      delivery.status = "expired";
      expired++;
      shared.add(systemsSharedKey("delivery", delivery.deliveryId));
    }
  }
  if (expired === 0) reject(warnings, touched, "economy_warning:no_deliveries_expired");
  touched.add("economy_courier");
}

function createHospitalityState(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "hospitality_inn_hotel_shelter");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const systems = state.businessSystems!;
  const hospitalityId = `econ_hospitality_${systems.nextHospitalityNumber++}`;
  systems.hospitality[hospitalityId] = { hospitalityId, businessId: b.businessId, rooms: int(request.rooms, 4), occupiedRooms: 0, cleanliness: clamp(request.cleanliness, 0, 100, 70), safety: clamp(request.safetyRating, 0, 100, 70), shelterBeds: int(request.shelterBeds, 0), refugeeContractActive: false };
  touched.add("economy_hospitality");
  shared.add(systemsSharedKey("hospitality", hospitalityId));
}

function runHospitalityDay(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "contract_manager", "hospitality_inn_hotel_shelter");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const hosp = Object.values(state.businessSystems!.hospitality).find((entry) => entry.businessId === b.businessId);
  if (!hosp) return reject(warnings, touched, "economy_rejected:hospitality_state_required");
  if (hosp.cleanliness < 35 || hosp.safety < 35) return reject(warnings, touched, "economy_rejected:hospitality_cleanliness_or_safety_too_low");
  const demand = int(request.guestDemand, Math.ceil(hosp.rooms / 2));
  hosp.occupiedRooms = Math.min(hosp.rooms, demand);
  const foodConsumed = Math.min(hosp.occupiedRooms, itemCount(b.inventory, "worker_meal"));
  if (foodConsumed < Math.ceil(hosp.occupiedRooms / 2)) return reject(warnings, touched, "economy_rejected:hospitality_food_supply_required");
  applyItem(b.inventory, "worker_meal", -foodConsumed);
  adjustBusinessFunds(b, hosp.occupiedRooms * int(request.roomRateGold, 35));
  hosp.cleanliness = clamp(hosp.cleanliness - hosp.occupiedRooms * 2, 0, 100, hosp.cleanliness);
  addNeed(state, b, "housing", hosp.occupiedRooms, request.nowMs);
  addNeed(state, b, "tourism", hosp.occupiedRooms, request.nowMs);
  touched.add("economy_hospitality");
  shared.add(systemsSharedKey("hospitality", hosp.hospitalityId));
}

function cleanHospitalityRooms(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "world_operator", "hospitality_inn_hotel_shelter");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const hosp = Object.values(state.businessSystems!.hospitality).find((entry) => entry.businessId === b.businessId);
  if (!hosp) return reject(warnings, touched, "economy_rejected:hospitality_state_required");
  if (!requireInventory(b, warnings, touched, { linen: 1, cleaning_reagent: 1 })) return;
  consumeInventory(b, { linen: 1, cleaning_reagent: 1 });
  hosp.cleanliness = clamp(hosp.cleanliness + 35, 0, 100, hosp.cleanliness);
  touched.add("economy_hospitality");
  shared.add(systemsSharedKey("hospitality", hosp.hospitalityId));
}

function createShelterContract(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "contract_manager", "hospitality_inn_hotel_shelter");
  if (!b) return;
  if (!requireOpenBusinessStatus(b, warnings, touched)) return;
  const hosp = Object.values(state.businessSystems!.hospitality).find((entry) => entry.businessId === b.businessId);
  if (!hosp || hosp.shelterBeds <= 0) return reject(warnings, touched, "economy_rejected:shelter_beds_required");
  hosp.refugeeContractActive = true;
  adjustBusinessFunds(b, int(request.rewardGold, hosp.shelterBeds * 10));
  addNeed(state, b, "housing", hosp.shelterBeds, request.nowMs);
  touched.add("economy_hospitality");
  shared.add(systemsSharedKey("hospitality", hosp.hospitalityId));
}

function runRentTick(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, _context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const systems = state.businessSystems!;
  const days = int(request.days, 1);
  let processed = 0;
  for (const property of Object.values(systems.propertyIntegrations)) {
    if (!property.businessId || property.rentGoldPerDay <= 0 || !property.constructionComplete) continue;
    const b = state.businesses[property.businessId];
    if (!b) continue;
    const rent = property.rentGoldPerDay * days;
    if (b.balanceGold < rent) {
      b.status = "suspended";
      reject(warnings, touched, "economy_warning:business_suspended_for_unpaid_rent");
    } else {
      b.balanceGold -= rent;
      property.lastRentPaidAtMs = request.nowMs;
    }
    processed++;
    shared.add(systemsSharedKey("property", property.propertyId));
  }
  if (processed === 0) reject(warnings, touched, "economy_warning:no_business_rent_due");
  touched.add("economy_property_rent");
}

function runLoanDefaultTick(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, _context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  let defaults = 0;
  for (const loan of Object.values(state.loans) as any[]) {
    if (loan.status === "active" && loan.dueAtMs < request.nowMs && loan.principalRemaining > 0) {
      loan.status = "defaulted";
      loan.defaultedAtMs = request.nowMs;
      const b = state.businesses[loan.businessId];
      if (b) b.status = "suspended";
      defaults++;
      shared.add(businessSharedKey(loan.businessId));
    }
  }
  if (defaults === 0) reject(warnings, touched, "economy_warning:no_defaulted_business_loans");
  touched.add("economy_business_loans");
}

function seizeLoanCollateral(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  if (!context.allowNpcAdministration && !(context as any).allowBankAdministration) return reject(warnings, touched, "economy_rejected:bank_admin_required_for_collateral_seizure");
  const loan = request.loanId ? (state.loans as any)[request.loanId] : undefined;
  if (!loan || loan.status !== "defaulted") return reject(warnings, touched, "economy_rejected:defaulted_loan_required_for_collateral_seizure");
  const systems = state.businessSystems!;
  const property = Object.values(systems.propertyIntegrations).find((p) => p.businessId === loan.businessId || p.collateralLoanId === loan.loanId);
  if (!property) return reject(warnings, touched, "economy_rejected:loan_collateral_not_found");
  property.ownerKind = "town";
  property.ownerId = "foreclosure_authority";
  property.businessId = undefined;
  const b = state.businesses[loan.businessId];
  if (b) b.status = "bankrupt";
  touched.add("economy_business_loans");
  shared.add(systemsSharedKey("property", property.propertyId));
}

function liquidateBankruptBusiness(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, context: BusinessSystemsContext, warnings: string[], touched: Set<string>, shared: Set<string>) {
  const b = requireBusiness(state, request, context, warnings, touched, "owner_admin");
  if (!b) return;
  if (b.status !== "bankrupt" && b.status !== "suspended") return reject(warnings, touched, "economy_rejected:business_not_eligible_for_liquidation");
  const liquidationValue = Object.values(b.inventory).reduce((sum, stack) => sum + stack.count * 2, 0) + Math.round(b.balanceGold * 0.5);
  b.inventory = {};
  b.balanceGold = liquidationValue;
  b.status = "closed";
  touched.add("economy_business_bankruptcy");
  shared.add(businessSharedKey(b.businessId));
}

export function validateHarthmereEconomyBalanceV1(state: HarthmereProductionEconomyStateV1): string[] {
  const warnings: string[] = [];
  for (const type of Object.values((state as any).businessTypes ?? {})) void type;
  for (const business of Object.values(state.businesses)) {
    if (business.salesTaxRate > 0.18) warnings.push(`balance:tax_rate_too_high:${business.businessId}`);
    if (business.upkeepGoldPerDay > Math.max(250, business.balanceGold + business.reputation * 10)) warnings.push(`balance:upkeep_pressure_extreme:${business.businessId}`);
    if (business.balanceGold < 0) warnings.push(`balance:negative_business_balance:${business.businessId}`);
    for (const stack of Object.values(business.inventory)) {
      if (stack.count < 0) warnings.push(`balance:negative_inventory:${business.businessId}:${stack.itemId}`);
      if (stack.count > 100000) warnings.push(`balance:inventory_duplication_risk:${business.businessId}:${stack.itemId}`);
    }
  }
  for (const contract of Object.values(state.contracts)) {
    if (contract.rewardGold > 50000) warnings.push(`balance:contract_payout_too_high:${contract.contractId}`);
    if (contract.rewardGold < 0 || contract.escrowGold < 0) warnings.push(`balance:negative_contract_money:${contract.contractId}`);
  }
  for (const loan of Object.values(state.loans) as any[]) {
    const b = state.businesses[loan.businessId];
    if (b && loan.principalOriginal > Math.max(1000, b.balanceGold * 20 + 10000)) warnings.push(`balance:loan_cap_too_high:${loan.loanId}`);
  }
  const systems = normalizeHarthmereEconomyBusinessSystemsStateV1((state as BusinessSystemsEconomyState).businessSystems);
  const serviceCatalogValidation = validateHarthmereBusinessServiceItemReferencesV1();
  for (const itemId of serviceCatalogValidation.missingRequiredItems) warnings.push(`balance:business_customer_missing_required_item_catalog:${itemId}`);
  for (const itemId of serviceCatalogValidation.missingProducedItems) warnings.push(`balance:business_customer_missing_produced_item_catalog:${itemId}`);
  const openMarketOrders = Object.values(state.marketOrders).filter((order) => order.status === "open").length;
  if (openMarketOrders > Math.max(200, Object.keys(state.businesses).length * 100)) warnings.push("balance:npc_or_market_order_flood_risk");
  for (const town of Object.values(state.towns) as any[]) {
    for (const [needId, need] of Object.entries(town.needs ?? {}) as any[]) {
      if (need.value < 0 || need.value > 100) warnings.push(`balance:town_need_out_of_bounds:${town.townId}:${needId}`);
    }
  }
  for (const account of Object.values(systems.bankAccounts)) {
    if (account.balanceGold < 0) warnings.push(`balance:negative_bank_account:${account.accountId}`);
  }
  for (const outpostBuilding of Object.values(systems.outpostBuildings)) {
    const audit = validateHarthmereBusinessOutpostPassabilityV1(outpostBuilding);
    for (const error of audit.errors) warnings.push(`balance:outpost_passability:${outpostBuilding.outpostId}:${error}`);
    const liveAudit = validateHarthmereBusinessOutpostLiveWorldNavigationV1(outpostBuilding);
    for (const route of liveAudit.unreachableRoutes) warnings.push(`balance:outpost_live_navigation_unreachable:${outpostBuilding.outpostId}:${route}`);
    for (const collision of liveAudit.unresolvedCollisions) warnings.push(`balance:outpost_live_navigation_collision:${outpostBuilding.outpostId}:${collision}`);
  }
  for (const branch of Object.values(systems.empireBranches)) {
    if (!systems.outpostBuildings[branch.outpostId]) warnings.push(`balance:branch_missing_outpost_building:${branch.branchId}`);
    if (branch.dailyRevenueGold < 0 || branch.dailyUpkeepGold < 0) warnings.push(`balance:branch_money_negative:${branch.branchId}`);
    if (branch.status === "active" && !state.businesses[branch.parentBusinessId]) warnings.push(`balance:branch_missing_parent_business:${branch.branchId}`);
    if (branchWarehouseUnits(branch) > branch.warehouseSlots) warnings.push(`balance:branch_warehouse_over_capacity:${branch.branchId}`);
    if ((branch.scheduledStaffIds ?? []).length > branch.staffSlots) warnings.push(`balance:branch_staff_over_capacity:${branch.branchId}`);
    if (branch.regionalManagerEmployeeId && !state.employees[branch.regionalManagerEmployeeId]) warnings.push(`balance:branch_manager_missing_employee:${branch.branchId}`);
    if (branch.competitorPressure < 0 || branch.competitorPressure > 25) warnings.push(`balance:branch_competitor_pressure_out_of_bounds:${branch.branchId}`);
  }
  for (const automation of Object.values(systems.automationAssignments)) {
    if (!state.businesses[automation.businessId]) warnings.push(`balance:automation_missing_business:${automation.automationId}`);
    if (automation.branchId && !systems.empireBranches[automation.branchId]) warnings.push(`balance:automation_missing_branch:${automation.automationId}`);
    if (automation.dailyUpkeepGold < 0 || automation.passiveProfitGoldPerDay < 0) warnings.push(`balance:automation_money_negative:${automation.automationId}`);
  }
  return warnings;
}

function runBalanceValidation(state: BusinessSystemsEconomyState, request: HarthmereEconomyMutationRequestV1, _context: BusinessSystemsContext, warnings: string[], touched: Set<string>) {
  const report = validateHarthmereEconomyBalanceV1(state);
  state.businessSystems!.balanceReports = report;
  for (const warning of report) warnings.push(warning);
  touched.add("economy_balance_validation");
  void request;
}

export function reduceHarthmereEconomyBusinessSpecificMutationV1(
  state: HarthmereProductionEconomyStateV1,
  request: HarthmereEconomyMutationRequestV1,
  context: HarthmereEconomyMutationContextV1,
): HarthmereEconomyBusinessSpecificMutationResultV1 {
  const handledOperations = new Set([
    "grant_business_permission",
    "create_business_bank_account",
    "transfer_personal_to_business_bank",
    "transfer_business_to_personal_bank",
    "link_business_property",
    "run_business_rent_tick",
    "run_loan_default_tick",
    "seize_loan_collateral",
    "liquidate_bankrupt_business",
    "run_exotic_refinery_cycle",
    "certify_portal_fuel",
    "run_biome_decay_tick",
    "perform_biome_maintenance",
    "install_biome_design",
    "create_security_threat",
    "resolve_security_threat",
    "build_portal_endpoint",
    "run_portal_transit",
    "plant_crop_node",
    "run_crop_growth_tick",
    "harvest_crop_node",
    "run_spoilage_tick",
    "register_durable_item",
    "repair_durable_item",
    "upgrade_durable_item",
    "craft_magic_good",
    "install_ward",
    "remove_anomaly",
    "run_unstable_magic_tick",
    "discover_exploration_route",
    "run_map_aging_tick",
    "lead_expedition",
    "start_property_project",
    "advance_property_project",
    "refresh_trader_inventory",
    "perform_regional_arbitrage",
    "hunt_wildlife",
    "run_wildlife_tick",
    "register_patient",
    "treat_patient",
    "build_teleport_pad",
    "issue_teleport_access_key",
    "use_teleport_pad",
    "run_teleport_destabilization_tick",
    "accumulate_waste",
    "cleanup_contamination_site",
    "run_outbreak_prevention_tick",
    "repair_fixture",
    "set_restaurant_menu",
    "serve_restaurant_day",
    "create_delivery",
    "complete_delivery",
    "run_delivery_deadline_tick",
    "create_hospitality_state",
    "run_hospitality_day",
    "clean_hospitality_rooms",
    "create_shelter_contract",
    "start_business_customer_session",
    "serve_business_customer",
    "open_business_branch",
    "assign_business_automation",
    "assign_business_branch_manager",
    "route_business_branch_stock",
    "schedule_business_branch_staff",
    "close_business_branch",
    "run_business_empire_day",
    "refresh_business_employee_candidates",
    "interview_business_employee_candidate",
    "negotiate_business_employee_candidate",
    "hire_business_employee_candidate",
    "promote_business_employee",
    "run_business_employee_task",
    "run_business_employee_morale_tick",
    "validate_economy_balance",
  ]);
  if (!handledOperations.has(request.operation)) {
    return { handled: false, economy: state, inventoryGoldDelta: 0, inventoryItemDeltas: {}, warnings: [], touchedModels: [], sharedStateKeys: [] };
  }
  const next = cloneState(state);
  const typedContext = context as BusinessSystemsContext;
  const warnings: string[] = [];
  const touched = new Set<string>();
  const shared = new Set<string>();
  const goldDelta = { value: 0 };
  const itemDeltas: Record<string, number> = {};

  switch (request.operation) {
    case "grant_business_permission": grantBusinessPermission(next, request, typedContext, warnings, touched, shared); break;
    case "create_business_bank_account": createBankAccount(next, request, typedContext, warnings, touched, shared); break;
    case "transfer_personal_to_business_bank": transferPersonalToBusinessBank(next, request, typedContext, goldDelta, warnings, touched, shared); break;
    case "transfer_business_to_personal_bank": transferBusinessToPersonalBank(next, request, typedContext, goldDelta, warnings, touched, shared); break;
    case "link_business_property": linkBusinessProperty(next, request, typedContext, warnings, touched, shared); break;
    case "run_business_rent_tick": runRentTick(next, request, typedContext, warnings, touched, shared); break;
    case "run_loan_default_tick": runLoanDefaultTick(next, request, typedContext, warnings, touched, shared); break;
    case "seize_loan_collateral": seizeLoanCollateral(next, request, typedContext, warnings, touched, shared); break;
    case "liquidate_bankrupt_business": liquidateBankruptBusiness(next, request, typedContext, warnings, touched, shared); break;
    case "run_exotic_refinery_cycle": runExoticRefinery(next, request, typedContext, warnings, touched, shared); break;
    case "certify_portal_fuel": certifyPortalFuel(next, request, typedContext, warnings, touched, shared); break;
    case "run_biome_decay_tick": runBiomeDecayTick(next, request, typedContext, warnings, touched, shared); break;
    case "perform_biome_maintenance": performBiomeMaintenance(next, request, typedContext, warnings, touched, shared); break;
    case "install_biome_design": installBiomeDesign(next, request, typedContext, warnings, touched, shared); break;
    case "create_security_threat": createSecurityThreat(next, request, typedContext, warnings, touched, shared); break;
    case "resolve_security_threat": resolveSecurityThreat(next, request, typedContext, warnings, touched, shared); break;
    case "build_portal_endpoint": buildPortalEndpoint(next, request, typedContext, warnings, touched, shared); break;
    case "run_portal_transit": runPortalTransit(next, request, typedContext, warnings, touched, shared); break;
    case "plant_crop_node": plantCropNode(next, request, typedContext, warnings, touched, shared); break;
    case "run_crop_growth_tick": runCropGrowthTick(next, request, typedContext, warnings, touched, shared); break;
    case "harvest_crop_node": harvestCropNode(next, request, typedContext, warnings, touched, shared); break;
    case "run_spoilage_tick": runSpoilageTick(next, request, typedContext, warnings, touched, shared); break;
    case "register_durable_item": registerDurableItem(next, request, typedContext, warnings, touched, shared); break;
    case "repair_durable_item": repairDurableItem(next, request, typedContext, warnings, touched, shared); break;
    case "upgrade_durable_item": upgradeDurableItem(next, request, typedContext, warnings, touched, shared); break;
    case "craft_magic_good": craftMagicGood(next, request, typedContext, warnings, touched, shared); break;
    case "install_ward": installWard(next, request, typedContext, warnings, touched, shared); break;
    case "remove_anomaly": removeAnomaly(next, request, typedContext, warnings, touched, shared); break;
    case "run_unstable_magic_tick": runUnstableMagicTick(next, request, typedContext, warnings, touched, shared); break;
    case "discover_exploration_route": discoverRoute(next, request, typedContext, warnings, touched, shared); break;
    case "run_map_aging_tick": runMapAgingTick(next, request, typedContext, warnings, touched, shared); break;
    case "lead_expedition": leadExpedition(next, request, typedContext, warnings, touched, shared); break;
    case "start_property_project": startPropertyProject(next, request, typedContext, warnings, touched, shared); break;
    case "advance_property_project": advancePropertyProject(next, request, typedContext, warnings, touched, shared); break;
    case "refresh_trader_inventory": refreshTraderInventory(next, request, typedContext, warnings, touched, shared); break;
    case "perform_regional_arbitrage": performRegionalArbitrage(next, request, typedContext, warnings, touched, shared); break;
    case "hunt_wildlife": huntWildlife(next, request, typedContext, warnings, touched, shared); break;
    case "run_wildlife_tick": runWildlifeTick(next, request, typedContext, warnings, touched, shared); break;
    case "register_patient": registerPatient(next, request, typedContext, warnings, touched, shared); break;
    case "treat_patient": treatPatient(next, request, typedContext, warnings, touched, shared); break;
    case "build_teleport_pad": buildTeleportPad(next, request, typedContext, warnings, touched, shared); break;
    case "issue_teleport_access_key": issueTeleportAccessKey(next, request, typedContext, warnings, touched, shared); break;
    case "use_teleport_pad": useTeleportPad(next, request, typedContext, warnings, touched, shared); break;
    case "run_teleport_destabilization_tick": runTeleportDestabilizationTick(next, request, typedContext, warnings, touched, shared); break;
    case "accumulate_waste": accumulateWaste(next, request, typedContext, warnings, touched, shared); break;
    case "cleanup_contamination_site": cleanupContaminationSite(next, request, typedContext, warnings, touched, shared); break;
    case "run_outbreak_prevention_tick": runOutbreakPreventionTick(next, request, typedContext, warnings, touched, shared); break;
    case "repair_fixture": repairFixture(next, request, typedContext, warnings, touched, shared); break;
    case "set_restaurant_menu": setRestaurantMenu(next, request, typedContext, warnings, touched, shared); break;
    case "serve_restaurant_day": serveRestaurantDay(next, request, typedContext, warnings, touched, shared); break;
    case "create_delivery": createDelivery(next, request, typedContext, warnings, touched, shared); break;
    case "complete_delivery": completeDelivery(next, request, typedContext, warnings, touched, shared); break;
    case "run_delivery_deadline_tick": runDeliveryDeadlineTick(next, request, typedContext, warnings, touched, shared); break;
    case "create_hospitality_state": createHospitalityState(next, request, typedContext, warnings, touched, shared); break;
    case "run_hospitality_day": runHospitalityDay(next, request, typedContext, warnings, touched, shared); break;
    case "clean_hospitality_rooms": cleanHospitalityRooms(next, request, typedContext, warnings, touched, shared); break;
    case "create_shelter_contract": createShelterContract(next, request, typedContext, warnings, touched, shared); break;
    case "start_business_customer_session": startBusinessCustomerSession(next, request, typedContext, warnings, touched, shared); break;
    case "serve_business_customer": serveBusinessCustomer(next, request, typedContext, warnings, touched, shared); break;
    case "open_business_branch": openBusinessBranch(next, request, typedContext, warnings, touched, shared); break;
    case "assign_business_automation": assignBusinessAutomation(next, request, typedContext, warnings, touched, shared); break;
    case "assign_business_branch_manager": assignBusinessBranchManager(next, request, typedContext, warnings, touched, shared); break;
    case "route_business_branch_stock": routeBusinessBranchStock(next, request, typedContext, warnings, touched, shared); break;
    case "schedule_business_branch_staff": scheduleBusinessBranchStaff(next, request, typedContext, warnings, touched, shared); break;
    case "close_business_branch": closeBusinessBranch(next, request, typedContext, warnings, touched, shared); break;
    case "run_business_empire_day": runBusinessEmpireDay(next, request, typedContext, warnings, touched, shared); break;
    case "refresh_business_employee_candidates": refreshBusinessEmployeeCandidates(next, request, typedContext, warnings, touched, shared); break;
    case "interview_business_employee_candidate": interviewBusinessEmployeeCandidate(next, request, typedContext, warnings, touched, shared); break;
    case "negotiate_business_employee_candidate": negotiateBusinessEmployeeCandidate(next, request, typedContext, warnings, touched, shared); break;
    case "hire_business_employee_candidate": hireBusinessEmployeeCandidate(next, request, typedContext, warnings, touched, shared); break;
    case "promote_business_employee": promoteBusinessEmployee(next, request, typedContext, warnings, touched, shared); break;
    case "run_business_employee_task": runBusinessEmployeeTask(next, request, typedContext, warnings, touched, shared); break;
    case "run_business_employee_morale_tick": runBusinessEmployeeMoraleTick(next, request, typedContext, warnings, touched, shared); break;
    case "validate_economy_balance": runBalanceValidation(next, request, typedContext, warnings, touched); break;
  }

  // Kept for future personal-item delta business modules. No-op in v1 because
  // business-specific systems operate against business/world state.
  for (const [itemId, delta] of Object.entries(itemDeltas)) recordDelta(itemDeltas, itemId, delta);

  const buildingMaterializationPlans = Array.isArray((next as any).__buildingMaterializationPlans)
    ? (next as any).__buildingMaterializationPlans
    : undefined;
  delete (next as any).__buildingMaterializationPlans;

  return {
    handled: true,
    economy: next,
    inventoryGoldDelta: goldDelta.value,
    inventoryItemDeltas: itemDeltas,
    warnings,
    touchedModels: [...touched],
    sharedStateKeys: [...shared],
    buildingMaterializationPlans,
  };
}
