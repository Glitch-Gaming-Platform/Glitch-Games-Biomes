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
}

export interface HarthmereEconomyBusinessSpecificMutationResultV1 {
  handled: boolean;
  economy: HarthmereProductionEconomyStateV1;
  inventoryGoldDelta: number;
  inventoryItemDeltas: Record<string, number>;
  warnings: string[];
  touchedModels: string[];
  sharedStateKeys: string[];
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
    case "validate_economy_balance": runBalanceValidation(next, request, typedContext, warnings, touched); break;
  }

  // Kept for future personal-item delta business modules. No-op in v1 because
  // business-specific systems operate against business/world state.
  for (const [itemId, delta] of Object.entries(itemDeltas)) recordDelta(itemDeltas, itemId, delta);

  return {
    handled: true,
    economy: next,
    inventoryGoldDelta: goldDelta.value,
    inventoryItemDeltas: itemDeltas,
    warnings,
    touchedModels: [...touched],
    sharedStateKeys: [...shared],
  };
}
