/*
 * businessInterfaceLiveAdapter.ts
 *
 * Live adapter for the in-world Harthmere business interface. This is not a
 * BiomesUI tab. The world/combat/interact system should pass a nearby
 * businessId only while the player is physically inside or interacting with a
 * business property. Runtime state is fetched from the production economy
 * backend and all writes are posted through request_economy_mutation.
 */

export type HarthmereBusinessActorModeV1 = "owner" | "customer";
export type HarthmereBusinessPanelTabV1 =
  | "overview"
  | "orders"
  | "money"
  | "inventory"
  | "staff"
  | "services"
  | "status";

export type HarthmereBusinessTypeIdV1 =
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

export interface HarthmereBusinessTypeDefinitionV1 {
  typeId: HarthmereBusinessTypeIdV1;
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

export interface HarthmereBusinessInventoryStackV1 {
  itemId: string;
  count: number;
  expiresAtMs?: number;
  condition?: number;
  contaminated?: boolean;
}

export interface HarthmereBusinessRecordV1 {
  businessId: string;
  ownerKind: "player" | "npc" | "guild" | "town";
  ownerId: string;
  typeId: HarthmereBusinessTypeIdV1;
  name: string;
  status: "draft" | "open" | "paused" | "suspended" | "bankrupt" | "closed";
  licenseClass: string;
  licenseLevel: number;
  propertyId?: string;
  townId?: string;
  regionId: string;
  inventory: Record<string, HarthmereBusinessInventoryStackV1>;
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
}

export interface HarthmereBusinessContractV1 {
  contractId: string;
  issuerKind: string;
  issuerId: string;
  townId?: string;
  regionId: string;
  title: string;
  businessType?: HarthmereBusinessTypeIdV1;
  requirements: Array<{ itemId?: string; count?: number; serviceNeed?: string; serviceUnits?: number }>;
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

export interface HarthmereBusinessEmployeeV1 {
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

export interface HarthmereBusinessBankAccountV1 {
  accountId: string;
  businessId: string;
  ownerKind: string;
  ownerId: string;
  balanceGold: number;
  status: "active" | "frozen" | "closed";
  createdAtMs: number;
  audit: Array<{ auditId: string; atMs: number; actorId: string; kind: string; amountGold?: number; reason?: string }>;
}

export interface HarthmereBusinessSystemsSnapshotV1 {
  permissions: Record<string, Record<string, string[]>>;
  bankAccounts: Record<string, HarthmereBusinessBankAccountV1>;
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
  balanceReports: string[];
}

export interface HarthmereBusinessEconomySnapshotV1 {
  version?: string;
  actorId: string;
  businessTypes: Record<HarthmereBusinessTypeIdV1, HarthmereBusinessTypeDefinitionV1>;
  recipeCatalog?: Record<string, any>;
  businesses: Record<string, HarthmereBusinessRecordV1>;
  myBusinesses: HarthmereBusinessRecordV1[];
  openContracts: HarthmereBusinessContractV1[];
  activeContracts: HarthmereBusinessContractV1[];
  customerContracts?: HarthmereBusinessContractV1[];
  employees: Record<string, HarthmereBusinessEmployeeV1>;
  loans: Record<string, any>;
  insurancePolicies: Record<string, any>;
  tradeRoutes: Record<string, any>;
  failures: Record<string, any>;
  marketOrders: Record<string, any>;
  towns: Record<string, any>;
  regions: Record<string, any>;
  businessSystems: Partial<HarthmereBusinessSystemsSnapshotV1>;
  balanceWarnings: string[];
  ledger: Array<{ id: string; atMs: number; actorId?: string; kind: string; businessId?: string; amountGold?: number; reason?: string }>;
}

export interface HarthmereBusinessInterfaceResponseV1 {
  ok?: boolean;
  economyState?: HarthmereBusinessEconomySnapshotV1;
  backendMutation?: { warnings?: string[] };
}

export interface HarthmereBusinessVisibleInventoryItemV1 {
  itemId: string;
  count: number;
  priceGold: number;
  condition?: number;
  expiresAtMs?: number;
  contaminated?: boolean;
}

export interface HarthmereBusinessMoneySummaryV1 {
  balanceGold: number;
  bankBalanceGold: number;
  debtGold: number;
  dailyUpkeepGold: number;
  dailyRentGold: number;
  dailyWagesGold: number;
  salesTaxRate: number;
}

export interface HarthmereBusinessTodoV1 {
  id: string;
  severity: "info" | "warning" | "danger";
  label: string;
  description: string;
}

export interface HarthmereBusinessServiceActionV1 {
  actionId: string;
  label: string;
  description: string;
  audience: "owner" | "customer" | "both";
  operation: string;
  defaultPayload?: Record<string, unknown>;
  serviceNeed?: string;
  rewardGold?: number;
  requiresWorldService?: boolean;
  fieldServiceKind?: string;
  defaultTargetId?: string;
}

export const HARTHMERE_BUSINESS_TYPE_ORDER_V1: HarthmereBusinessTypeIdV1[] = [
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

export const HARTHMERE_BUSINESS_SERVICE_ACTIONS_V1: Record<HarthmereBusinessTypeIdV1, HarthmereBusinessServiceActionV1[]> = {
  exotic_matter_refinery: [
    { actionId: "refine", label: "Stabilize Matter", description: "Convert raw Exotic Matter into safe industrial stock.", audience: "owner", operation: "run_exotic_refinery_cycle", defaultPayload: { itemId: "raw_exotic_matter", count: 1 } },
    { actionId: "certify_fuel", label: "Certify Portal Fuel", description: "Certify stabilized fuel for portal and teleport operators.", audience: "owner", operation: "certify_portal_fuel", defaultPayload: { itemId: "portal_fuel", count: 1 } },
    { actionId: "request_fuel", label: "Request Fuel Order", description: "Place an escrowed order for certified portal fuel.", audience: "customer", operation: "create_contract", serviceNeed: "energy", rewardGold: 160 },
  ],
  biome_maintenance_repair: [
    { actionId: "repair_biome", label: "Repair Biome Anchor", description: "Fix weather failure, anchor drift, and timeline leakage.", audience: "owner", operation: "perform_biome_maintenance" },
    { actionId: "inspect_biome", label: "Request Inspection", description: "Ask for a property inspection or emergency repair visit.", audience: "customer", operation: "create_contract", serviceNeed: "maintenance", rewardGold: 110 },
  ],
  biome_design_studio: [
    { actionId: "install_theme", label: "Install Design Package", description: "Install decor/theme work that raises beauty and property value.", audience: "owner", operation: "install_biome_design", defaultPayload: { amountGold: 120 } },
    { actionId: "request_redesign", label: "Request Redesign", description: "Commission decor, terrain, lighting, or theme work.", audience: "customer", operation: "create_contract", serviceNeed: "identity", rewardGold: 130 },
  ],
  security_defense_contractor: [
    { actionId: "resolve_threat", label: "Resolve Threat", description: "Clear a world threat using real combat gear.", audience: "owner", operation: "resolve_security_threat" },
    { actionId: "hire_guard", label: "Hire Protection", description: "Request guards, monster removal, patrols, or escort work.", audience: "customer", operation: "create_contract", serviceNeed: "safety", rewardGold: 150 },
  ],
  portal_transit_company: [
    { actionId: "build_portal", label: "Build Endpoint", description: "Build a route endpoint and establish portal ownership.", audience: "owner", operation: "build_portal_endpoint", defaultPayload: { originTownId: "harthmere_grove", destinationTownId: "harthmere_outskirts", amountGold: 35 } },
    { actionId: "run_transit", label: "Run Transit", description: "Operate passenger or cargo transit and collect fares.", audience: "both", operation: "run_portal_transit", defaultPayload: { count: 1 } },
  ],
  biome_farming_rare_foods: [
    { actionId: "plant_crop", label: "Plant Crop", description: "Plant a climate-dependent crop node.", audience: "owner", operation: "plant_crop_node", defaultPayload: { itemId: "rare_seed", count: 1 } },
    { actionId: "harvest", label: "Harvest Crops", description: "Harvest grown crops into business inventory.", audience: "owner", operation: "harvest_crop_node" },
    { actionId: "order_produce", label: "Order Produce", description: "Order crops, herbs, or rare food supply.", audience: "customer", operation: "create_contract", serviceNeed: "food", rewardGold: 90 },
  ],
  weapons_tools: [
    { actionId: "repair_item", label: "Repair Item", description: "Repair durable tools, weapons, or work equipment.", audience: "owner", operation: "repair_durable_item" },
    { actionId: "upgrade_item", label: "Upgrade Gear", description: "Upgrade eligible tools or weapons with permit checks.", audience: "owner", operation: "upgrade_durable_item" },
    { actionId: "request_repair", label: "Request Repair", description: "Submit a repair or equipment commission.", audience: "customer", operation: "create_contract", serviceNeed: "maintenance", rewardGold: 85 },
  ],
  magic_goods: [
    { actionId: "craft_magic", label: "Craft Magic Good", description: "Craft unstable consumables, charms, or wards.", audience: "owner", operation: "craft_magic_good", defaultPayload: { itemId: "unstable_charm", count: 1 } },
    { actionId: "install_ward", label: "Install Ward", description: "Install a protective ward on a property.", audience: "owner", operation: "install_ward", defaultPayload: { amountGold: 110 } },
    { actionId: "request_ward", label: "Request Ward", description: "Commission wards, charms, potions, or anomaly help.", audience: "customer", operation: "create_contract", serviceNeed: "timeline_stability", rewardGold: 140 },
  ],
  exploration_guide: [
    { actionId: "discover_route", label: "Discover Route", description: "Discover or register a route through unstable terrain.", audience: "owner", operation: "discover_exploration_route", defaultPayload: { originTownId: "harthmere_grove", destinationTownId: "rift_field", safetyRating: 65 } },
    { actionId: "lead_expedition", label: "Lead Expedition", description: "Guide clients on a risk-managed expedition.", audience: "both", operation: "lead_expedition" },
  ],
  custom_home_property_development: [
    { actionId: "start_project", label: "Start Project", description: "Start staged construction tied to real property state.", audience: "owner", operation: "start_property_project", defaultPayload: { amountGold: 300 } },
    { actionId: "advance_project", label: "Advance Build", description: "Advance construction stages using funds and materials.", audience: "owner", operation: "advance_property_project", defaultPayload: { amountGold: 250 } },
    { actionId: "request_build", label: "Request Build", description: "Commission construction, renovation, or demolition.", audience: "customer", operation: "create_contract", serviceNeed: "housing", rewardGold: 350 },
  ],
  general_trader: [
    { actionId: "refresh_inventory", label: "Refresh Stock", description: "Restock inventory from wholesale and trade networks.", audience: "owner", operation: "refresh_trader_inventory", defaultPayload: { amountGold: 75 } },
    { actionId: "arbitrage", label: "Run Arbitrage", description: "Move goods between regions for price spread profit.", audience: "owner", operation: "perform_regional_arbitrage", defaultPayload: { itemId: "trade_goods", count: 4 } },
    { actionId: "request_goods", label: "Request Goods", description: "Place an order for common goods or brokerage.", audience: "customer", operation: "create_contract", serviceNeed: "logistics", rewardGold: 75 },
  ],
  hunter_wild_meat: [
    { actionId: "hunt", label: "Hunt Wildlife", description: "Hunt from a real wildlife population with protected-species checks.", audience: "owner", operation: "hunt_wildlife" },
    { actionId: "order_meat", label: "Order Meat", description: "Order wild meat, hides, bones, or pest control.", audience: "customer", operation: "create_contract", serviceNeed: "food", rewardGold: 95 },
  ],
  medical_doctor: [
    { actionId: "register_patient", label: "Register Patient", description: "Record a patient illness or injury state.", audience: "owner", operation: "register_patient", defaultPayload: { severity: 3, cause: "walk_in" } },
    { actionId: "treat_patient", label: "Treat Patient", description: "Treat patient illness or injury with success/failure outcomes.", audience: "owner", operation: "treat_patient" },
    { actionId: "request_care", label: "Request Care", description: "Request treatment, checkup, medicine, or emergency care.", audience: "customer", operation: "create_contract", serviceNeed: "health", rewardGold: 120 },
  ],
  teleport_owner: [
    { actionId: "build_pad", label: "Build Pad", description: "Register a teleport pad and destination.", audience: "owner", operation: "build_teleport_pad", defaultPayload: { locationId: "business_front", destinationTownId: "harthmere_grove", amountGold: 40 } },
    { actionId: "issue_key", label: "Issue Access Key", description: "Grant destination access to a customer or guildmate.", audience: "owner", operation: "issue_teleport_access_key" },
    { actionId: "use_pad", label: "Use Teleport", description: "Use a fuel-backed teleport pad.", audience: "both", operation: "use_teleport_pad" },
  ],
  waste_sanitation_cleanup: [
    { actionId: "accumulate_waste", label: "Record Waste", description: "Record accumulated waste or contamination at a site.", audience: "owner", operation: "accumulate_waste", defaultPayload: { severity: 3, cause: "business_waste" } },
    { actionId: "cleanup", label: "Clean Site", description: "Clean contamination and lower outbreak risk.", audience: "owner", operation: "cleanup_contamination_site" },
    { actionId: "request_cleanup", label: "Request Cleanup", description: "Request trash pickup, cleanup, compost, or decontamination.", audience: "customer", operation: "create_contract", serviceNeed: "sanitation", rewardGold: 100 },
  ],
  repair_maintenance_person: [
    { actionId: "repair_fixture", label: "Repair Fixture", description: "Repair object, furniture, tool, or building fixture state.", audience: "owner", operation: "repair_fixture", defaultPayload: { itemId: "broken_fixture", amountGold: 40 } },
    { actionId: "request_maintenance", label: "Request Maintenance", description: "Request repair of items, furniture, fixtures, or facilities.", audience: "customer", operation: "create_contract", serviceNeed: "maintenance", rewardGold: 70 },
  ],
  food_service_restaurant: [
    { actionId: "set_menu", label: "Set Menu", description: "Rotate menus and published meal offerings.", audience: "owner", operation: "set_restaurant_menu", defaultPayload: { inventoryItemDeltas: { worker_meal: 1 } } },
    { actionId: "serve_day", label: "Serve Day", description: "Serve customers using ingredients, sanitation, and freshness.", audience: "owner", operation: "serve_restaurant_day", defaultPayload: { count: 8 } },
    { actionId: "order_meal", label: "Order Meal", description: "Order meals, rations, catering, or buff food.", audience: "customer", operation: "create_contract", serviceNeed: "food", rewardGold: 55 },
  ],
  courier: [
    { actionId: "create_delivery", label: "Create Delivery", description: "Create an escrow-backed package delivery.", audience: "both", operation: "create_delivery", defaultPayload: { itemId: "parcel", count: 1, rewardGold: 45 } },
    { actionId: "complete_delivery", label: "Complete Delivery", description: "Complete active delivery and release escrow.", audience: "owner", operation: "complete_delivery" },
    { actionId: "request_delivery", label: "Request Courier", description: "Request mail, package, medicine, or food delivery.", audience: "customer", operation: "create_contract", serviceNeed: "logistics", rewardGold: 65 },
  ],
  hospitality_inn_hotel_shelter: [
    { actionId: "create_rooms", label: "Create Rooms", description: "Create lodging state for rooms, shelter beds, and occupancy.", audience: "owner", operation: "create_hospitality_state", defaultPayload: { count: 4 } },
    { actionId: "run_day", label: "Run Hospitality Day", description: "Update occupancy, guest safety, revenue, and cleanliness.", audience: "owner", operation: "run_hospitality_day" },
    { actionId: "clean_rooms", label: "Clean Rooms", description: "Clean rooms and improve lodging quality.", audience: "owner", operation: "clean_hospitality_rooms" },
    { actionId: "book_room", label: "Book Room / Shelter", description: "Request lodging, shelter beds, meeting room, or safehouse stay.", audience: "customer", operation: "create_contract", serviceNeed: "housing", rewardGold: 80 },
  ],
};

function jsonRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function normalizeSystems(raw: unknown): HarthmereBusinessSystemsSnapshotV1 {
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
    balanceReports: Array.isArray(r.balanceReports) ? r.balanceReports : [],
  };
}

export function normalizeHarthmereBusinessEconomySnapshotV1(raw: any): HarthmereBusinessEconomySnapshotV1 {
  const snapshot = jsonRecord(raw);
  const businesses = jsonRecord(snapshot.businesses) as Record<string, HarthmereBusinessRecordV1>;
  const actorId = String(snapshot.actorId ?? "");
  const myBusinesses = Array.isArray(snapshot.myBusinesses)
    ? snapshot.myBusinesses
    : Object.values(businesses).filter((business) => business.ownerKind === "player" && business.ownerId === actorId);
  return {
    version: typeof snapshot.version === "string" ? snapshot.version : undefined,
    actorId,
    businessTypes: jsonRecord(snapshot.businessTypes) as any,
    recipeCatalog: jsonRecord(snapshot.recipeCatalog),
    businesses,
    myBusinesses,
    openContracts: Array.isArray(snapshot.openContracts) ? snapshot.openContracts : [],
    activeContracts: Array.isArray(snapshot.activeContracts) ? snapshot.activeContracts : [],
    customerContracts: Array.isArray(snapshot.customerContracts) ? snapshot.customerContracts : undefined,
    employees: jsonRecord(snapshot.employees) as any,
    loans: jsonRecord(snapshot.loans),
    insurancePolicies: jsonRecord(snapshot.insurancePolicies),
    tradeRoutes: jsonRecord(snapshot.tradeRoutes),
    failures: jsonRecord(snapshot.failures),
    marketOrders: jsonRecord(snapshot.marketOrders),
    towns: jsonRecord(snapshot.towns),
    regions: jsonRecord(snapshot.regions),
    businessSystems: normalizeSystems(snapshot.businessSystems),
    balanceWarnings: Array.isArray(snapshot.balanceWarnings) ? snapshot.balanceWarnings : [],
    ledger: Array.isArray(snapshot.ledger) ? snapshot.ledger : [],
  };
}

export async function fetchHarthmereBusinessEconomyStateV1(fetchImpl: typeof fetch = fetch): Promise<HarthmereBusinessEconomySnapshotV1> {
  const response = await fetchImpl("/api/harthmere/live_mode_economy_state", {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  } as any);
  if (!response.ok) throw new Error(`business_economy_state_http_${response.status}`);
  const body = await response.json();
  return normalizeHarthmereBusinessEconomySnapshotV1(body.economyState ?? body);
}

export async function submitHarthmereBusinessEconomyMutationV1(
  operation: string,
  payload: Record<string, unknown>,
  options: { fetchImpl?: typeof fetch; requestId?: string; zoneId?: string } = {},
): Promise<HarthmereBusinessInterfaceResponseV1> {
  const requestId = options.requestId ?? `business_ui_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl("/api/harthmere/live_mode", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      requestId,
      idempotencyKey: requestId,
      actionKind: "request_economy_mutation",
      subsystem: "economy",
      zoneId: options.zoneId ?? "the_grove",
      payload: { operation, ...payload },
    }),
  } as any);
  if (!response.ok) throw new Error(`business_economy_mutation_http_${response.status}`);
  const body = await response.json();
  const warnings: string[] = body.backendMutation?.warnings ?? body.warnings ?? [];
  const rejection = warnings.find((warning) => String(warning).includes("economy_rejected:"));
  if (rejection) throw new Error(rejection);
  return body;
}

export function isHarthmereBusinessInterfaceAvailableV1(state: HarthmereBusinessEconomySnapshotV1 | undefined, nearbyBusinessId?: string | null): boolean {
  return Boolean(state && nearbyBusinessId && state.businesses[nearbyBusinessId]);
}

export function getHarthmereBusinessActorModeV1(state: HarthmereBusinessEconomySnapshotV1, businessId: string): HarthmereBusinessActorModeV1 {
  const business = state.businesses[businessId];
  const permissions = (state.businessSystems.permissions ?? {})[businessId]?.[state.actorId] ?? [];
  if (!business) return "customer";
  if (business.ownerKind === "player" && business.ownerId === state.actorId) return "owner";
  if (permissions.includes("owner_admin") || permissions.length > 0) return "owner";
  return "customer";
}

function itemPrice(state: HarthmereBusinessEconomySnapshotV1, business: HarthmereBusinessRecordV1, itemId: string): number {
  const region = business.regionId ? state.regions[business.regionId] : undefined;
  const base = Number(region?.priceIndex?.[itemId] ?? 10);
  const modifier = Number(business.priceModifiers?.[itemId] ?? 1);
  return Math.max(1, Math.round(base * modifier));
}

export function getHarthmereVisibleBusinessInventoryV1(state: HarthmereBusinessEconomySnapshotV1, businessId: string): HarthmereBusinessVisibleInventoryItemV1[] {
  const business = state.businesses[businessId];
  if (!business) return [];
  return Object.values(business.inventory ?? {})
    .filter((stack) => stack.count > 0)
    .map((stack) => ({ ...stack, priceGold: itemPrice(state, business, stack.itemId) }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
}

export function getHarthmereBusinessBankAccountV1(state: HarthmereBusinessEconomySnapshotV1, businessId: string): HarthmereBusinessBankAccountV1 | undefined {
  return Object.values(state.businessSystems.bankAccounts ?? {}).find((account) => account.businessId === businessId);
}

export function getHarthmereBusinessMoneySummaryV1(state: HarthmereBusinessEconomySnapshotV1, businessId: string): HarthmereBusinessMoneySummaryV1 {
  const business = state.businesses[businessId];
  const bank = getHarthmereBusinessBankAccountV1(state, businessId);
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

export function getHarthmereBusinessContractsV1(state: HarthmereBusinessEconomySnapshotV1, businessId: string): HarthmereBusinessContractV1[] {
  const fromOpen = state.openContracts.filter((contract) => contract.acceptedByBusinessId === businessId || contract.businessType === state.businesses[businessId]?.typeId);
  const fromActive = state.activeContracts.filter((contract) => contract.acceptedByBusinessId === businessId);
  const seen = new Set<string>();
  return [...fromActive, ...fromOpen].filter((contract) => {
    if (seen.has(contract.contractId)) return false;
    seen.add(contract.contractId);
    return true;
  });
}

export function getHarthmereCustomerOrdersV1(state: HarthmereBusinessEconomySnapshotV1, businessId: string): HarthmereBusinessContractV1[] {
  const businessType = state.businesses[businessId]?.typeId;
  const all = [...(state.customerContracts ?? []), ...state.openContracts, ...state.activeContracts];
  const seen = new Set<string>();
  return all.filter((contract) => {
    if (seen.has(contract.contractId)) return false;
    seen.add(contract.contractId);
    return contract.issuerKind === "player" && contract.issuerId === state.actorId && (!contract.businessType || contract.businessType === businessType || contract.acceptedByBusinessId === businessId);
  });
}

export function getHarthmereBusinessTodosV1(state: HarthmereBusinessEconomySnapshotV1, businessId: string): HarthmereBusinessTodoV1[] {
  const business = state.businesses[businessId];
  if (!business) return [];
  const todos: HarthmereBusinessTodoV1[] = [];
  if (business.status !== "open") todos.push({ id: "open_business", severity: "warning", label: "Open business", description: "This business is not open yet. Add property, license, and open it before customers can use it." });
  if (!getHarthmereBusinessBankAccountV1(state, businessId)) todos.push({ id: "bank_account", severity: "info", label: "Create bank account", description: "Create a business bank account for safe deposits, withdrawals, logs, and permissions." });
  if (business.balanceGold < business.upkeepGoldPerDay + business.wageGoldPerDay) todos.push({ id: "funds_low", severity: "danger", label: "Funds low", description: "Business funds are below one day of upkeep and wages." });
  if (business.sanitationRating < 45) todos.push({ id: "sanitation_low", severity: "warning", label: "Sanitation risk", description: "Low sanitation can reduce satisfaction and trigger failures." });
  if (business.safetyRating < 45) todos.push({ id: "safety_low", severity: "warning", label: "Safety risk", description: "Low safety can reduce customers and create emergency work." });
  if (getHarthmereBusinessContractsV1(state, businessId).some((contract) => contract.status === "active")) todos.push({ id: "active_orders", severity: "info", label: "Fulfill active orders", description: "Accepted orders are waiting for delivery or service completion." });
  return todos;
}

export function getHarthmereBusinessServiceActionsV1(typeId: HarthmereBusinessTypeIdV1, mode: HarthmereBusinessActorModeV1): HarthmereBusinessServiceActionV1[] {
  return (HARTHMERE_BUSINESS_SERVICE_ACTIONS_V1[typeId] ?? []).filter((action) => action.audience === mode || action.audience === "both");
}

export interface HarthmereBusinessWorldContextV1 {
  nearbyBusinessId?: string | null;
  insideBusiness?: boolean;
  insideTownHall?: boolean;
  insideMarketplace?: boolean;
  actorGuildId?: string;
  interactionKeyLabel?: string;
}

export interface HarthmereBusinessInteractionPromptV1 {
  visible: boolean;
  businessId?: string;
  mode?: HarthmereBusinessActorModeV1;
  label: string;
  helper: string;
  keyLabel: string;
}

export interface HarthmereBusinessDashboardV1 {
  title: string;
  metrics: Array<{ id: string; label: string; value: string; hint: string }>;
  todos: HarthmereBusinessTodoV1[];
  criticalCount: number;
}

export interface HarthmereBusinessShopfrontV1 {
  businessId: string;
  inventory: HarthmereBusinessVisibleInventoryItemV1[];
  acceptsCustomOrders: boolean;
  emptyLabel: string;
}

export interface HarthmereBusinessContractBoardV1 {
  open: HarthmereBusinessContractV1[];
  active: HarthmereBusinessContractV1[];
  fulfilled: HarthmereBusinessContractV1[];
  customer: HarthmereBusinessContractV1[];
}

export interface HarthmereBusinessFinancePanelV1 {
  summary: HarthmereBusinessMoneySummaryV1;
  account?: HarthmereBusinessBankAccountV1;
  loans: any[];
  insurancePolicies: any[];
  audit: Array<{ auditId?: string; atMs: number; actorId: string; kind: string; amountGold?: number; reason?: string }>;
}

export interface HarthmereBusinessStaffPanelV1 {
  employees: HarthmereBusinessEmployeeV1[];
  canHire: boolean;
  payrollDueGold: number;
  moraleWarnings: HarthmereBusinessEmployeeV1[];
}

export interface HarthmereBusinessCompliancePanelV1 {
  licenseClass: string;
  licenseLevel: number;
  requiredLicense?: string;
  minimumLicenseLevel?: number;
  sanitationRating: number;
  safetyRating: number;
  warnings: string[];
}

export interface HarthmereBusinessOperationScreenV1 {
  businessId: string;
  typeId: HarthmereBusinessTypeIdV1;
  title: string;
  ownerActions: HarthmereBusinessServiceActionV1[];
  customerActions: HarthmereBusinessServiceActionV1[];
  systemRecords: Record<string, any[]>;
}

export interface HarthmereBusinessTownHallPanelV1 {
  towns: any[];
  publicContracts: HarthmereBusinessContractV1[];
  townBusinesses: HarthmereBusinessRecordV1[];
}

export interface HarthmereBusinessMarketplacePanelV1 {
  openOrders: any[];
  regionalPrices: Record<string, number>;
  marketWarnings: string[];
}

export interface HarthmereBusinessGuildPanelV1 {
  guildBusinesses: HarthmereBusinessRecordV1[];
  guildContracts: HarthmereBusinessContractV1[];
  permissions: Record<string, string[]>;
}

export interface HarthmereBusinessServiceQuestV1 {
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

const FIELD_SERVICE_ACTION_IDS_V1 = new Set([
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

const FIELD_SERVICE_NEEDS_V1 = new Set(["maintenance", "safety", "health", "sanitation", "logistics", "housing", "identity", "knowledge", "property_condition"]);

export function requiresHarthmereFieldServiceQuestV1(action: HarthmereBusinessServiceActionV1): boolean {
  if (action.requiresWorldService === true) return true;
  if (FIELD_SERVICE_ACTION_IDS_V1.has(action.actionId)) return true;
  if (action.serviceNeed && FIELD_SERVICE_NEEDS_V1.has(action.serviceNeed)) return true;
  return false;
}

export function getHarthmereBusinessFieldServiceSpecV1(business: HarthmereBusinessRecordV1, action: HarthmereBusinessServiceActionV1, overrides: Record<string, unknown> = {}) {
  if (!requiresHarthmereFieldServiceQuestV1(action) && overrides.fieldService !== true) return undefined;
  const serviceKind = String(overrides.serviceKind ?? action.fieldServiceKind ?? action.serviceNeed ?? action.actionId);
  const targetId = String(overrides.targetId ?? action.defaultTargetId ?? business.propertyId ?? business.townId ?? business.businessId);
  return {
    required: true,
    serviceKind,
    targetId,
    mapMarkerId: String(overrides.mapMarkerId ?? targetId),
    questTitle: String(overrides.questTitle ?? `${business.name}: ${action.label}`),
    todoText: String(overrides.todoText ?? `${action.label} for ${business.name}`),
  };
}

export function getHarthmereBusinessInteractionPromptV1(state: HarthmereBusinessEconomySnapshotV1 | undefined, context: HarthmereBusinessWorldContextV1): HarthmereBusinessInteractionPromptV1 {
  const keyLabel = context.interactionKeyLabel ?? "E";
  if (!state || !context.insideBusiness || !context.nearbyBusinessId || !state.businesses[context.nearbyBusinessId]) {
    return { visible: false, label: "", helper: "", keyLabel };
  }
  const business = state.businesses[context.nearbyBusinessId];
  const mode = getHarthmereBusinessActorModeV1(state, business.businessId);
  return {
    visible: true,
    businessId: business.businessId,
    mode,
    keyLabel,
    label: `Press ${keyLabel} to ${mode === "owner" ? "manage" : "use"} ${business.name}`,
    helper: mode === "owner" ? "Clients, orders, money, staff, licenses, and todos" : "Order services, check status, and browse inventory",
  };
}

export function getHarthmereOwnerDashboardV1(state: HarthmereBusinessEconomySnapshotV1, businessId: string): HarthmereBusinessDashboardV1 {
  const business = state.businesses[businessId];
  const money = getHarthmereBusinessMoneySummaryV1(state, businessId);
  const todos = getHarthmereBusinessTodosV1(state, businessId);
  const activeOrders = getHarthmereBusinessContractsV1(state, businessId).filter((contract) => contract.status === "active").length;
  return {
    title: `${business?.name ?? "Business"} Dashboard`,
    metrics: [
      { id: "balance", label: "Cash", value: `${money.balanceGold}`, hint: `Bank ${money.bankBalanceGold} · Debt ${money.debtGold}` },
      { id: "orders", label: "Active Orders", value: `${activeOrders}`, hint: `${business?.completedContracts ?? 0} completed` },
      { id: "ratings", label: "Ratings", value: `${business?.customerSatisfaction ?? 0}/100`, hint: `Safety ${business?.safetyRating ?? 0} · Sanitation ${business?.sanitationRating ?? 0}` },
      { id: "upkeep", label: "Daily Costs", value: `${money.dailyUpkeepGold + money.dailyRentGold + money.dailyWagesGold}`, hint: "upkeep + rent + wages" },
    ],
    todos,
    criticalCount: todos.filter((todo) => todo.severity === "danger").length,
  };
}

export function getHarthmereBusinessShopfrontV1(state: HarthmereBusinessEconomySnapshotV1, businessId: string): HarthmereBusinessShopfrontV1 {
  const inventory = getHarthmereVisibleBusinessInventoryV1(state, businessId);
  return { businessId, inventory, acceptsCustomOrders: Boolean(state.businesses[businessId]), emptyLabel: inventory.length ? "" : "No public inventory is stocked yet." };
}

export function getHarthmereContractBoardV1(state: HarthmereBusinessEconomySnapshotV1, businessId: string): HarthmereBusinessContractBoardV1 {
  const byId: Record<string, HarthmereBusinessContractV1> = {};
  for (const contract of [...(state.openContracts ?? []), ...(state.activeContracts ?? []), ...(state.customerContracts ?? [])]) byId[contract.contractId] = contract;
  const all = Object.values(byId);
  return {
    open: all.filter((contract) => contract.status === "open" && (!contract.businessType || contract.businessType === state.businesses[businessId]?.typeId)),
    active: all.filter((contract) => contract.status === "active" && contract.acceptedByBusinessId === businessId),
    fulfilled: all.filter((contract) => contract.status === "fulfilled" && contract.acceptedByBusinessId === businessId),
    customer: getHarthmereCustomerOrdersV1(state, businessId),
  };
}

export function getHarthmereBusinessFinancePanelV1(state: HarthmereBusinessEconomySnapshotV1, businessId: string): HarthmereBusinessFinancePanelV1 {
  const account = getHarthmereBusinessBankAccountV1(state, businessId);
  return {
    summary: getHarthmereBusinessMoneySummaryV1(state, businessId),
    account,
    loans: Object.values(state.loans ?? {}).filter((loan: any) => loan.businessId === businessId),
    insurancePolicies: Object.values(state.insurancePolicies ?? {}).filter((policy: any) => policy.businessId === businessId),
    audit: account?.audit ?? [],
  };
}

export function getHarthmereBusinessStaffPanelV1(state: HarthmereBusinessEconomySnapshotV1, businessId: string): HarthmereBusinessStaffPanelV1 {
  const employees = Object.values(state.employees ?? {}).filter((employee) => employee.businessId === businessId);
  return {
    employees,
    canHire: getHarthmereBusinessActorModeV1(state, businessId) === "owner",
    payrollDueGold: employees.reduce((sum, employee) => sum + employee.wageGoldPerDay, 0),
    moraleWarnings: employees.filter((employee) => employee.morale < 35),
  };
}

export function getHarthmereBusinessCompliancePanelV1(state: HarthmereBusinessEconomySnapshotV1, businessId: string): HarthmereBusinessCompliancePanelV1 {
  const business = state.businesses[businessId];
  const type = business ? state.businessTypes[business.typeId] : undefined;
  const warnings: string[] = [];
  if (business && type && business.licenseLevel < type.minimumLicenseLevel) warnings.push("license_level_below_business_minimum");
  if (business?.sanitationRating !== undefined && business.sanitationRating < 50) warnings.push("sanitation_inspection_risk");
  if (business?.safetyRating !== undefined && business.safetyRating < 50) warnings.push("safety_inspection_risk");
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

function recordsForBusiness(source: Record<string, any> | undefined, businessId: string): any[] {
  return Object.values(source ?? {}).filter((entry: any) => entry.businessId === businessId || entry.courierBusinessId === businessId || entry.ownerBusinessId === businessId);
}

export function getHarthmereBusinessOperationScreenV1(state: HarthmereBusinessEconomySnapshotV1, businessId: string): HarthmereBusinessOperationScreenV1 {
  const business = state.businesses[businessId];
  const typeId = business?.typeId ?? "general_trader";
  const systems = state.businessSystems ?? {};
  return {
    businessId,
    typeId,
    title: state.businessTypes[typeId]?.displayName ?? typeId,
    ownerActions: getHarthmereBusinessServiceActionsV1(typeId, "owner"),
    customerActions: getHarthmereBusinessServiceActionsV1(typeId, "customer"),
    systemRecords: {
      anchors: recordsForBusiness(systems.biomeAnchors as any, businessId),
      threats: recordsForBusiness(systems.threats as any, businessId),
      portals: recordsForBusiness(systems.portalEndpoints as any, businessId),
      teleports: recordsForBusiness(systems.teleportPads as any, businessId),
      crops: recordsForBusiness(systems.cropNodes as any, businessId),
      animals: recordsForBusiness(systems.animalPopulations as any, businessId),
      contamination: recordsForBusiness(systems.contaminationSites as any, businessId),
      patients: recordsForBusiness(systems.patients as any, businessId),
      durableItems: recordsForBusiness(systems.durableItems as any, businessId),
      routes: recordsForBusiness(systems.explorationRoutes as any, businessId),
      deliveries: recordsForBusiness(systems.deliveries as any, businessId),
      hospitality: recordsForBusiness(systems.hospitality as any, businessId),
      serviceQuests: recordsForBusiness((systems as any).serviceQuests, businessId),
    },
  };
}

export function getHarthmereTownHallPanelV1(state: HarthmereBusinessEconomySnapshotV1): HarthmereBusinessTownHallPanelV1 {
  return {
    towns: Object.values(state.towns ?? {}),
    publicContracts: (state.openContracts ?? []).filter((contract) => contract.issuerKind === "town" || Boolean(contract.townId)),
    townBusinesses: Object.values(state.businesses ?? {}).filter((business) => business.ownerKind === "town"),
  };
}

export function getHarthmereMarketplacePanelV1(state: HarthmereBusinessEconomySnapshotV1): HarthmereBusinessMarketplacePanelV1 {
  const firstRegion = Object.values(state.regions ?? {})[0] as any;
  return {
    openOrders: Object.values(state.marketOrders ?? {}).filter((order: any) => order.status === "open"),
    regionalPrices: firstRegion?.priceIndex ?? {},
    marketWarnings: state.balanceWarnings ?? [],
  };
}

export function getHarthmereGuildBusinessPanelV1(state: HarthmereBusinessEconomySnapshotV1, guildId?: string): HarthmereBusinessGuildPanelV1 {
  const guildBusinesses = Object.values(state.businesses ?? {}).filter((business) => business.ownerKind === "guild" && (!guildId || business.ownerId === guildId));
  const guildBusinessIds = new Set(guildBusinesses.map((business) => business.businessId));
  const permissions: Record<string, string[]> = {};
  for (const business of guildBusinesses) {
    permissions[business.businessId] = ((state.businessSystems?.permissions as any)?.[business.businessId]?.[state.actorId] ?? []).slice();
  }
  return {
    guildBusinesses,
    guildContracts: [...(state.openContracts ?? []), ...(state.activeContracts ?? [])].filter((contract) => guildBusinessIds.has(contract.acceptedByBusinessId ?? "") || contract.issuerKind === "guild"),
    permissions,
  };
}

export function getHarthmereBusinessServiceQuestsV1(state: HarthmereBusinessEconomySnapshotV1, businessId?: string): HarthmereBusinessServiceQuestV1[] {
  return Object.values(((state.businessSystems as any)?.serviceQuests ?? {}) as Record<string, HarthmereBusinessServiceQuestV1>).filter((quest) => !businessId || quest.businessId === businessId);
}

function serviceContractPayload(state: HarthmereBusinessEconomySnapshotV1, business: HarthmereBusinessRecordV1, action: HarthmereBusinessServiceActionV1, overrides: Record<string, unknown>) {
  const rewardGold = Number(overrides.rewardGold ?? action.rewardGold ?? 75);
  return {
    ownerKind: "player",
    ownerId: state.actorId,
    businessType: business.typeId,
    title: `${business.name}: ${action.label}`,
    rewardGold,
    townId: business.townId,
    regionId: business.regionId,
    deadlineAtMs: Number(overrides.deadlineAtMs ?? Date.now() + 7 * 24 * 60 * 60 * 1000),
    requirements: overrides.requirements ?? [{ serviceNeed: action.serviceNeed ?? "logistics", serviceUnits: 1 }],
    fieldService: getHarthmereBusinessFieldServiceSpecV1(business, action, overrides),
  };
}

export interface HarthmereBusinessInterfaceAdapterV1 {
  isHydrated(): boolean;
  getState(): HarthmereBusinessEconomySnapshotV1 | undefined;
  refresh(): Promise<void>;
  isAvailable(nearbyBusinessId?: string | null): boolean;
  getMode(businessId: string): HarthmereBusinessActorModeV1;
  getBusiness(businessId: string): HarthmereBusinessRecordV1 | undefined;
  getBusinessType(businessId: string): HarthmereBusinessTypeDefinitionV1 | undefined;
  getInventory(businessId: string): HarthmereBusinessVisibleInventoryItemV1[];
  getMoneySummary(businessId: string): HarthmereBusinessMoneySummaryV1;
  getEmployees(businessId: string): HarthmereBusinessEmployeeV1[];
  getContracts(businessId: string): HarthmereBusinessContractV1[];
  getCustomerOrders(businessId: string): HarthmereBusinessContractV1[];
  getTodos(businessId: string): HarthmereBusinessTodoV1[];
  getServiceActions(businessId: string, mode?: HarthmereBusinessActorModeV1): HarthmereBusinessServiceActionV1[];
  getInteractionPrompt(context: HarthmereBusinessWorldContextV1): HarthmereBusinessInteractionPromptV1;
  getOwnerDashboard(businessId: string): HarthmereBusinessDashboardV1;
  getShopfront(businessId: string): HarthmereBusinessShopfrontV1;
  getContractBoard(businessId: string): HarthmereBusinessContractBoardV1;
  getFinancePanel(businessId: string): HarthmereBusinessFinancePanelV1;
  getStaffPanel(businessId: string): HarthmereBusinessStaffPanelV1;
  getCompliancePanel(businessId: string): HarthmereBusinessCompliancePanelV1;
  getOperationScreen(businessId: string): HarthmereBusinessOperationScreenV1;
  getTownHallPanel(): HarthmereBusinessTownHallPanelV1;
  getMarketplacePanel(): HarthmereBusinessMarketplacePanelV1;
  getGuildBusinessPanel(guildId?: string): HarthmereBusinessGuildPanelV1;
  getServiceQuests(businessId?: string): HarthmereBusinessServiceQuestV1[];
  submitOperation(operation: string, payload: Record<string, unknown>): Promise<void>;
  createBankAccount(businessId: string): Promise<void>;
  transferPersonalToBusinessBank(businessId: string, amountGold: number): Promise<void>;
  transferBusinessToPersonalBank(businessId: string, amountGold: number): Promise<void>;
  depositInventory(businessId: string, itemId: string, count: number): Promise<void>;
  withdrawInventory(businessId: string, itemId: string, count: number): Promise<void>;
  setPrices(businessId: string, priceModifiers: Record<string, number>): Promise<void>;
  openBusiness(businessId: string, propertyId?: string, townId?: string): Promise<void>;
  hireWorker(businessId: string, role: string, wageGoldPerDay: number, skill?: number): Promise<void>;
  assignWorker(businessId: string, employeeId: string, assignedTask: string): Promise<void>;
  payPayroll(businessId: string): Promise<void>;
  acceptContract(businessId: string, contractId: string): Promise<void>;
  fulfillContract(businessId: string, contractId: string): Promise<void>;
  grantPermission(businessId: string, targetActorId: string, permissions: string[]): Promise<void>;
  runServiceAction(businessId: string, actionId: string, overrides?: Record<string, unknown>): Promise<void>;
  requestCustomerService(businessId: string, actionId: string, overrides?: Record<string, unknown>): Promise<void>;
}

export function createHarthmereBusinessInterfaceAdapterV1(options: {
  state?: HarthmereBusinessEconomySnapshotV1;
  hydrated?: boolean;
  setState?: (next: HarthmereBusinessEconomySnapshotV1 | undefined) => void;
  refresh?: () => Promise<HarthmereBusinessEconomySnapshotV1 | undefined>;
  submit?: (operation: string, payload: Record<string, unknown>) => Promise<HarthmereBusinessInterfaceResponseV1>;
}): HarthmereBusinessInterfaceAdapterV1 {
  let current = options.state;
  const setCurrent = (next: HarthmereBusinessEconomySnapshotV1 | undefined) => {
    current = next;
    options.setState?.(next);
  };
  const refresh = async () => {
    const next = await options.refresh?.();
    if (next) setCurrent(next);
  };
  const submit = async (operation: string, payload: Record<string, unknown>) => {
    const response = await options.submit?.(operation, payload);
    if (response?.economyState) setCurrent(normalizeHarthmereBusinessEconomySnapshotV1(response.economyState));
    await refresh();
  };

  const requireState = () => {
    if (!current) throw new Error("business_interface_state_not_hydrated");
    return current;
  };

  return {
    isHydrated: () => options.hydrated !== false && Boolean(current),
    getState: () => current,
    refresh,
    isAvailable: (nearbyBusinessId) => isHarthmereBusinessInterfaceAvailableV1(current, nearbyBusinessId),
    getMode: (businessId) => getHarthmereBusinessActorModeV1(requireState(), businessId),
    getBusiness: (businessId) => current?.businesses[businessId],
    getBusinessType: (businessId) => {
      const state = requireState();
      const business = state.businesses[businessId];
      return business ? state.businessTypes[business.typeId] : undefined;
    },
    getInventory: (businessId) => getHarthmereVisibleBusinessInventoryV1(requireState(), businessId),
    getMoneySummary: (businessId) => getHarthmereBusinessMoneySummaryV1(requireState(), businessId),
    getEmployees: (businessId) => Object.values(requireState().employees).filter((employee) => employee.businessId === businessId),
    getContracts: (businessId) => getHarthmereBusinessContractsV1(requireState(), businessId),
    getCustomerOrders: (businessId) => getHarthmereCustomerOrdersV1(requireState(), businessId),
    getTodos: (businessId) => getHarthmereBusinessTodosV1(requireState(), businessId),
    getServiceActions: (businessId, mode) => {
      const state = requireState();
      const business = state.businesses[businessId];
      if (!business) return [];
      return getHarthmereBusinessServiceActionsV1(business.typeId, mode ?? getHarthmereBusinessActorModeV1(state, businessId));
    },
    getInteractionPrompt: (context) => getHarthmereBusinessInteractionPromptV1(requireState(), context),
    getOwnerDashboard: (businessId) => getHarthmereOwnerDashboardV1(requireState(), businessId),
    getShopfront: (businessId) => getHarthmereBusinessShopfrontV1(requireState(), businessId),
    getContractBoard: (businessId) => getHarthmereContractBoardV1(requireState(), businessId),
    getFinancePanel: (businessId) => getHarthmereBusinessFinancePanelV1(requireState(), businessId),
    getStaffPanel: (businessId) => getHarthmereBusinessStaffPanelV1(requireState(), businessId),
    getCompliancePanel: (businessId) => getHarthmereBusinessCompliancePanelV1(requireState(), businessId),
    getOperationScreen: (businessId) => getHarthmereBusinessOperationScreenV1(requireState(), businessId),
    getTownHallPanel: () => getHarthmereTownHallPanelV1(requireState()),
    getMarketplacePanel: () => getHarthmereMarketplacePanelV1(requireState()),
    getGuildBusinessPanel: (guildId) => getHarthmereGuildBusinessPanelV1(requireState(), guildId),
    getServiceQuests: (businessId) => getHarthmereBusinessServiceQuestsV1(requireState(), businessId),
    submitOperation: submit,
    createBankAccount: (businessId) => submit("create_business_bank_account", { businessId }),
    transferPersonalToBusinessBank: (businessId, amountGold) => submit("transfer_personal_to_business_bank", { businessId, amountGold }),
    transferBusinessToPersonalBank: (businessId, amountGold) => submit("transfer_business_to_personal_bank", { businessId, amountGold }),
    depositInventory: (businessId, itemId, count) => submit("deposit_business_inventory", { businessId, itemId, count }),
    withdrawInventory: (businessId, itemId, count) => submit("withdraw_business_inventory", { businessId, itemId, count }),
    setPrices: (businessId, priceModifiers) => submit("set_business_prices", { businessId, priceModifiers }),
    openBusiness: (businessId, propertyId, townId) => submit("open_business", { businessId, propertyId, townId }),
    hireWorker: (businessId, role, wageGoldPerDay, skill = 1) => submit("hire_worker", { businessId, role, wageGoldPerDay, skill }),
    assignWorker: (businessId, employeeId, assignedTask) => submit("assign_worker", { businessId, employeeId, assignedTask }),
    payPayroll: (businessId) => submit("pay_payroll", { businessId }),
    acceptContract: (businessId, contractId) => submit("accept_contract", { businessId, contractId, createQuestOnAccept: true }),
    fulfillContract: (businessId, contractId) => submit("fulfill_contract", { businessId, contractId }),
    grantPermission: (businessId, targetActorId, permissions) => submit("grant_business_permission", { businessId, targetActorId, permissions }),
    runServiceAction: async (businessId, actionId, overrides = {}) => {
      const state = requireState();
      const business = state.businesses[businessId];
      if (!business) throw new Error("business_not_found");
      const action = getHarthmereBusinessServiceActionsV1(business.typeId, "owner").find((entry) => entry.actionId === actionId);
      if (!action) throw new Error(`business_action_not_available:${actionId}`);
      await submit(action.operation, { businessId, ...(action.defaultPayload ?? {}), ...overrides });
    },
    requestCustomerService: async (businessId, actionId, overrides = {}) => {
      const state = requireState();
      const business = state.businesses[businessId];
      if (!business) throw new Error("business_not_found");
      const action = getHarthmereBusinessServiceActionsV1(business.typeId, "customer").find((entry) => entry.actionId === actionId);
      if (!action) throw new Error(`business_customer_action_not_available:${actionId}`);
      if (action.operation === "create_contract") {
        await submit("create_contract", serviceContractPayload(state, business, action, overrides));
      } else {
        await submit(action.operation, { businessId, ...(action.defaultPayload ?? {}), ...overrides });
      }
    },
  };
}
