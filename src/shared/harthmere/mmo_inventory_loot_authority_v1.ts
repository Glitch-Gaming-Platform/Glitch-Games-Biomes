/*
 * mmo_inventory_loot_authority_v1.ts
 *
 * Server-authoritative inventory + loot extension for Harthmere/Biomes.
 *
 * This module covers the production rules that do not fit a simple
 * itemId -> count backpack:
 *   1. world loot lifecycle and anti-dupe pickup claims
 *   2. item instances for gear, packages, quest objects, spoilables, and legal flags
 *   3. item metadata used by jobs, laws, businesses, storage, repair, and town demand
 *   4. legal carry/store/sell validation
 *   5. business/warehouse/cold/hazard/guild inventory
 *   6. perishability, contamination, and decay ticks
 *   7. durability, repair, breakage, and salvage
 *   8. jobs-board escrow and delivery packages
 *   9. source-specific loot tables
 *   10. guild loot rules, project vaults, loans, and protected claim windows
 *   11. town-demand signals generated from real inventory supply
 *
 * Runtime state starts empty. Test data is registered only by tests. Production
 * should load the item catalogue and loot tables from canonical server config/DB.
 */

export const HARTHMERE_INVENTORY_LOOT_AUTHORITY_VERSION_V1 =
  "harthmere-inventory-loot-authority-v1" as const;

export const HARTHMERE_INVENTORY_LOOT_MAX_AUDIT_V1 = 500;
export const HARTHMERE_INVENTORY_LOOT_DEFAULT_DROP_TTL_MS_V1 = 10 * 60 * 1000;
export const HARTHMERE_INVENTORY_LOOT_GUILD_PROTECTED_CLAIM_MS_V1 = 5 * 60 * 1000;
export const HARTHMERE_INVENTORY_LOOT_DEFAULT_ACTOR_SLOTS_V1 = 40;
export const HARTHMERE_INVENTORY_LOOT_DEFAULT_BANK_SLOTS_V1 = 80;
export const HARTHMERE_INVENTORY_LOOT_DEFAULT_BUSINESS_SLOTS_V1 = 240;
export const HARTHMERE_INVENTORY_LOOT_DEFAULT_GUILD_SLOTS_V1 = 320;

export type HarthmereInventoryLootBusinessTypeIdV1 =
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

export type HarthmereInventoryLootNeedIdV1 =
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

export type HarthmereInventoryLootCategoryV1 =
  | "material"
  | "gear"
  | "tool"
  | "weapon"
  | "armor"
  | "consumable"
  | "food"
  | "medicine"
  | "fuel"
  | "waste"
  | "quest"
  | "document"
  | "package"
  | "decor"
  | "currency"
  | "relic";

export type HarthmereInventoryLootStorageClassV1 =
  | "backpack"
  | "bank"
  | "business_warehouse"
  | "cold_storage"
  | "hazard_containment"
  | "medical_cabinet"
  | "weapon_locker"
  | "courier_lockbox"
  | "guild_vault"
  | "evidence_locker"
  | "waste_bin";

export type HarthmereInventoryLootLegalClassV1 =
  | "common"
  | "restricted"
  | "contraband"
  | "stolen"
  | "license_required"
  | "quest_bound"
  | "evidence";

export type HarthmereInventoryLootBindingV1 = "none" | "on_pickup" | "on_equip" | "quest" | "guild_project";
export type HarthmereInventoryLootRarityV1 = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type HarthmereInventoryLootOwnerKindV1 = "actor" | "business" | "guild" | "town" | "system";
export type HarthmereInventoryLootLocationKindV1 =
  | "actor_inventory"
  | "actor_bank"
  | "actor_equipment"
  | "business_inventory"
  | "business_storage"
  | "guild_vault"
  | "job_escrow"
  | "loot_drop"
  | "destroyed"
  | "world";

export interface HarthmereInventoryLootItemDefinitionV1 {
  itemId: string;
  displayName: string;
  category: HarthmereInventoryLootCategoryV1;
  rarity: HarthmereInventoryLootRarityV1;
  maxStackSize: number;
  baseValueGold: number;
  weight: number;
  volume: number;
  binding: HarthmereInventoryLootBindingV1;
  tradeable: boolean;
  legalClass: HarthmereInventoryLootLegalClassV1;
  requiredPermit?: string;
  requiredLicense?: string;
  requiredLicenseLevel?: number;
  allowedStorage: HarthmereInventoryLootStorageClassV1[];
  businessUses: HarthmereInventoryLootBusinessTypeIdV1[];
  jobUses: string[];
  townNeeds: HarthmereInventoryLootNeedIdV1[];
  perishable: boolean;
  expiresAfterMs?: number;
  hazardLevel: number;
  contaminationRisk: number;
  durabilityMax?: number;
  repairable: boolean;
  repairInputs?: Array<{ itemId: string; count: number }>;
  salvageOutputs?: Array<{ itemId: string; count: number }>;
  lootTableTags: string[];
  uniqueInstance: boolean;
  qualityFloor?: number;
}

export interface HarthmereInventoryLootItemInstanceV1 {
  instanceId: string;
  itemId: string;
  quantity: number;
  ownerKind: HarthmereInventoryLootOwnerKindV1;
  ownerId: string;
  location: HarthmereInventoryLootLocationKindV1;
  containerId?: string;
  slot?: string;
  createdAtMs: number;
  updatedAtMs: number;
  expiresAtMs?: number;
  condition: number;
  durability?: number;
  durabilityMax?: number;
  quality: number;
  legalFlags: HarthmereInventoryLootLegalClassV1[];
  boundToActorId?: string;
  craftedByActorId?: string;
  upgradedLevel: number;
  enchantments: string[];
  sourceKind?: string;
  sourceId?: string;
  jobId?: string;
  deliveryId?: string;
  guildId?: string;
  loanedToActorId?: string;
  contaminated: boolean;
  broken: boolean;
  audit: Array<{ atMs: number; kind: string; actorId?: string; reason?: string }>;
}

export interface HarthmereInventoryLootActorInventoryV1 {
  actorId: string;
  gold: number;
  items: Record<string, number>;
  bank: Record<string, number>;
  equipment: Record<string, string>;
  instanceIds: string[];
  escrow: Record<string, number>;
  licenses: Record<string, number>;
  permits: string[];
  guildId?: string;
  partyId?: string;
  maxInventorySlots: number;
  maxBankSlots: number;
  reputation: Record<string, number>;
  legalViolations: Array<{ id: string; atMs: number; itemId: string; code: string }>;
}

export interface HarthmereInventoryLootBusinessInventoryV1 {
  businessId: string;
  ownerKind: HarthmereInventoryLootOwnerKindV1;
  ownerId: string;
  typeId: HarthmereInventoryLootBusinessTypeIdV1;
  townId: string;
  regionId: string;
  inventory: Record<string, number>;
  storage: Partial<Record<HarthmereInventoryLootStorageClassV1, Record<string, number>>>;
  instanceIds: string[];
  licenses: Record<string, number>;
  permits: string[];
  maxSlots: number;
  sanitationRating: number;
  safetyRating: number;
  reputation: number;
  balanceGold: number;
  audit: Array<{ atMs: number; actorId: string; kind: string; itemId?: string; count?: number }>;
}

export type HarthmereInventoryLootGuildRuleV1 = "personal_loot" | "round_robin" | "guild_project" | "need_greed";

export interface HarthmereInventoryLootGuildStateV1 {
  guildId: string;
  vault: Record<string, number>;
  instanceIds: string[];
  maxSlots: number;
  lootRule: HarthmereInventoryLootGuildRuleV1;
  projectItemTags: string[];
  members: Record<string, { joinedAtMs: number; kickedAtMs?: number }>;
  roundRobinIndex: number;
  protectedClaimUntilMs: Record<string, number>;
  loans: Record<string, { instanceId: string; actorId: string; dueAtMs: number; returnedAtMs?: number }>;
  history: Array<{ atMs: number; kind: string; actorId?: string; itemId?: string; instanceId?: string; dropId?: string }>;
}

export interface HarthmereInventoryLootDropV1 {
  dropId: string;
  sourceKind: string;
  sourceId: string;
  sourceLevel?: number;
  townId?: string;
  regionId?: string;
  position?: { x: number; y: number; z: number };
  itemStacks: Record<string, number>;
  instanceIds: string[];
  ownerActorIds: string[];
  partyId?: string;
  guildId?: string;
  pickupToken: string;
  createdAtMs: number;
  expiresAtMs: number;
  status: "available" | "claimed" | "expired" | "destroyed";
  claimedByActorId?: string;
  claimedAtMs?: number;
  abuseFlags: string[];
  firstTimeTags?: string[];
}

export interface HarthmereInventoryLootTableEntryV1 {
  itemId: string;
  minCount: number;
  maxCount: number;
  weight: number;
  chance?: number;
  legalFlags?: HarthmereInventoryLootLegalClassV1[];
  instance?: boolean;
  quality?: number;
  firstTimeTag?: string;
  businessSupplyTags?: string[];
}

export interface HarthmereInventoryLootTableV1 {
  tableId: string;
  sourceTypes: string[];
  tags: string[];
  rolls: number;
  guaranteedDrops: HarthmereInventoryLootTableEntryV1[];
  weightedDrops: HarthmereInventoryLootTableEntryV1[];
  rareDrops: HarthmereInventoryLootTableEntryV1[];
  questDrops: HarthmereInventoryLootTableEntryV1[];
}

export interface HarthmereInventoryLootLedgerEntryV1 {
  id: string;
  atMs: number;
  kind: string;
  actorId?: string;
  itemId?: string;
  count?: number;
  instanceId?: string;
  dropId?: string;
  sourceKind?: string;
  sourceId?: string;
  jobId?: string;
  guildId?: string;
  reason?: string;
}

export interface HarthmereInventoryLootJobEscrowV1 {
  escrowId: string;
  jobId: string;
  boardId?: string;
  issuerId: string;
  seekerId?: string;
  status: "open" | "active" | "delivered" | "cancelled" | "expired" | "failed";
  requiredItems: Array<{ itemId: string; count: number; minQuality?: number; freshnessRequired?: boolean }>;
  escrowedStacks: Record<string, number>;
  packageInstanceIds: string[];
  rewardGold: number;
  deadlineAtMs: number;
  targetOwnerKind: HarthmereInventoryLootOwnerKindV1;
  targetOwnerId: string;
  abuseFlags: string[];
  logs: string[];
  createdAtMs: number;
  completedAtMs?: number;
}

export interface HarthmereInventoryLootTownDemandStateV1 {
  townId: string;
  regionId: string;
  needs: Record<HarthmereInventoryLootNeedIdV1, { value: number; demandWeight: number; lastUpdatedAtMs: number }>;
  signals: Record<string, number>;
  lastUpdatedAtMs: number;
}

export interface HarthmereInventoryLootStateV1 {
  version: typeof HARTHMERE_INVENTORY_LOOT_AUTHORITY_VERSION_V1;
  actors: Record<string, HarthmereInventoryLootActorInventoryV1>;
  businesses: Record<string, HarthmereInventoryLootBusinessInventoryV1>;
  guilds: Record<string, HarthmereInventoryLootGuildStateV1>;
  itemInstances: Record<string, HarthmereInventoryLootItemInstanceV1>;
  lootDrops: Record<string, HarthmereInventoryLootDropV1>;
  lootLedger: HarthmereInventoryLootLedgerEntryV1[];
  jobEscrows: Record<string, HarthmereInventoryLootJobEscrowV1>;
  townDemand: Record<string, HarthmereInventoryLootTownDemandStateV1>;
  usedPickupTokens: Record<string, number>;
  actorLootTags: Record<string, string[]>;
  nextDropNumber: number;
  nextInstanceNumber: number;
  nextEscrowNumber: number;
  nextLedgerNumber: number;
}

export interface HarthmereInventoryLootMutationRequestV1 {
  requestId: string;
  actorId: string;
  nowMs: number;
  operation:
    | "register_actor"
    | "register_business"
    | "register_guild"
    | "grant_stack"
    | "create_item_instance"
    | "create_loot_drop"
    | "claim_loot_drop"
    | "expire_loot_drops"
    | "drop_item"
    | "move_to_business_inventory"
    | "move_from_business_inventory"
    | "validate_legal_inventory"
    | "damage_item_instance"
    | "repair_item_instance"
    | "salvage_item_instance"
    | "tick_decay"
    | "create_job_item_escrow"
    | "complete_job_item_escrow"
    | "cancel_job_item_escrow"
    | "assign_guild_loot"
    | "loan_guild_item"
    | "return_guild_loan"
    | "update_town_demand";
  itemId?: string;
  count?: number;
  instanceId?: string;
  dropId?: string;
  pickupToken?: string;
  sourceKind?: string;
  sourceId?: string;
  sourceLevel?: number;
  lootTableId?: string;
  rngSeed?: number;
  ownerActorIds?: string[];
  partyId?: string;
  guildId?: string;
  businessId?: string;
  businessTypeId?: HarthmereInventoryLootBusinessTypeIdV1;
  townId?: string;
  regionId?: string;
  storageClass?: HarthmereInventoryLootStorageClassV1;
  targetOwnerKind?: HarthmereInventoryLootOwnerKindV1;
  targetOwnerId?: string;
  jobId?: string;
  boardId?: string;
  requiredItems?: HarthmereInventoryLootJobEscrowV1["requiredItems"];
  rewardGold?: number;
  deadlineAtMs?: number;
  damageAmount?: number;
  repairMaterials?: Record<string, number>;
  legalFlags?: HarthmereInventoryLootLegalClassV1[];
  quality?: number;
  position?: { x: number; y: number; z: number };
}

export interface HarthmereInventoryLootMutationContextV1 {
  itemDefinitions: Record<string, HarthmereInventoryLootItemDefinitionV1>;
  lootTables: Record<string, HarthmereInventoryLootTableV1>;
  serverActorId?: string;
}

export interface HarthmereInventoryLootMutationResultV1 {
  ok: boolean;
  requestId: string;
  operation: HarthmereInventoryLootMutationRequestV1["operation"];
  actorId: string;
  state: HarthmereInventoryLootStateV1;
  errors: string[];
  warnings: string[];
  touchedModels: string[];
  sharedStateKeys: string[];
}

const ALL_NEEDS_V1: HarthmereInventoryLootNeedIdV1[] = [
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

export function createHarthmereEmptyInventoryLootStateV1(): HarthmereInventoryLootStateV1 {
  return {
    version: HARTHMERE_INVENTORY_LOOT_AUTHORITY_VERSION_V1,
    actors: {},
    businesses: {},
    guilds: {},
    itemInstances: {},
    lootDrops: {},
    lootLedger: [],
    jobEscrows: {},
    townDemand: {},
    usedPickupTokens: {},
    actorLootTags: {},
    nextDropNumber: 1,
    nextInstanceNumber: 1,
    nextEscrowNumber: 1,
    nextLedgerNumber: 1,
  };
}

export function createHarthmereInventoryLootActorV1(
  actorId: string,
  overrides: Partial<HarthmereInventoryLootActorInventoryV1> = {}
): HarthmereInventoryLootActorInventoryV1 {
  return {
    actorId,
    gold: 0,
    items: {},
    bank: {},
    equipment: {},
    instanceIds: [],
    escrow: {},
    licenses: {},
    permits: [],
    maxInventorySlots: HARTHMERE_INVENTORY_LOOT_DEFAULT_ACTOR_SLOTS_V1,
    maxBankSlots: HARTHMERE_INVENTORY_LOOT_DEFAULT_BANK_SLOTS_V1,
    reputation: {},
    legalViolations: [],
    ...overrides,
  };
}

export function createHarthmereInventoryLootBusinessV1(
  businessId: string,
  typeId: HarthmereInventoryLootBusinessTypeIdV1,
  ownerId: string,
  townId = "harthmere_grove",
  regionId = "harthmere_grove_region",
  overrides: Partial<HarthmereInventoryLootBusinessInventoryV1> = {}
): HarthmereInventoryLootBusinessInventoryV1 {
  return {
    businessId,
    ownerKind: "actor",
    ownerId,
    typeId,
    townId,
    regionId,
    inventory: {},
    storage: {},
    instanceIds: [],
    licenses: {},
    permits: [],
    maxSlots: HARTHMERE_INVENTORY_LOOT_DEFAULT_BUSINESS_SLOTS_V1,
    sanitationRating: 100,
    safetyRating: 100,
    reputation: 0,
    balanceGold: 0,
    audit: [],
    ...overrides,
  };
}

export function createHarthmereInventoryLootGuildV1(
  guildId: string,
  members: string[] = [],
  overrides: Partial<HarthmereInventoryLootGuildStateV1> = {}
): HarthmereInventoryLootGuildStateV1 {
  const now = 0;
  return {
    guildId,
    vault: {},
    instanceIds: [],
    maxSlots: HARTHMERE_INVENTORY_LOOT_DEFAULT_GUILD_SLOTS_V1,
    lootRule: "personal_loot",
    projectItemTags: [],
    members: Object.fromEntries(members.map((actorId) => [actorId, { joinedAtMs: now }])),
    roundRobinIndex: 0,
    protectedClaimUntilMs: {},
    loans: {},
    history: [],
    ...overrides,
  };
}

export function normalizeHarthmereInventoryLootStateV1(raw: unknown): HarthmereInventoryLootStateV1 {
  const base = createHarthmereEmptyInventoryLootStateV1();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<HarthmereInventoryLootStateV1>;
  return {
    ...base,
    ...r,
    version: HARTHMERE_INVENTORY_LOOT_AUTHORITY_VERSION_V1,
    actors: { ...(r.actors ?? {}) },
    businesses: { ...(r.businesses ?? {}) },
    guilds: { ...(r.guilds ?? {}) },
    itemInstances: { ...(r.itemInstances ?? {}) },
    lootDrops: { ...(r.lootDrops ?? {}) },
    lootLedger: [...(r.lootLedger ?? [])].slice(-HARTHMERE_INVENTORY_LOOT_MAX_AUDIT_V1),
    jobEscrows: { ...(r.jobEscrows ?? {}) },
    townDemand: { ...(r.townDemand ?? {}) },
    usedPickupTokens: { ...(r.usedPickupTokens ?? {}) },
    actorLootTags: { ...(r.actorLootTags ?? {}) },
    nextDropNumber: Math.max(1, Math.trunc(Number(r.nextDropNumber) || 1)),
    nextInstanceNumber: Math.max(1, Math.trunc(Number(r.nextInstanceNumber) || 1)),
    nextEscrowNumber: Math.max(1, Math.trunc(Number(r.nextEscrowNumber) || 1)),
    nextLedgerNumber: Math.max(1, Math.trunc(Number(r.nextLedgerNumber) || 1)),
  };
}

function cloneState(state: HarthmereInventoryLootStateV1): HarthmereInventoryLootStateV1 {
  return normalizeHarthmereInventoryLootStateV1(JSON.parse(JSON.stringify(state)));
}

function result(
  ok: boolean,
  req: HarthmereInventoryLootMutationRequestV1,
  state: HarthmereInventoryLootStateV1,
  errors: string[] = [],
  warnings: string[] = [],
  touchedModels: string[] = [],
  sharedStateKeys: string[] = []
): HarthmereInventoryLootMutationResultV1 {
  return { ok, requestId: req.requestId, operation: req.operation, actorId: req.actorId, state, errors, warnings, touchedModels, sharedStateKeys };
}

function getDef(ctx: HarthmereInventoryLootMutationContextV1, itemId: string | undefined) {
  if (!itemId) return undefined;
  return ctx.itemDefinitions[itemId];
}

function addAudit(
  state: HarthmereInventoryLootStateV1,
  req: HarthmereInventoryLootMutationRequestV1,
  entry: Omit<HarthmereInventoryLootLedgerEntryV1, "id" | "atMs">
) {
  const id = `loot_ledger_${state.nextLedgerNumber++}`;
  state.lootLedger.push({ id, atMs: req.nowMs, ...entry });
  state.lootLedger = state.lootLedger.slice(-HARTHMERE_INVENTORY_LOOT_MAX_AUDIT_V1);
}

function addCount(target: Record<string, number>, itemId: string, delta: number) {
  const next = Math.max(0, Math.trunc((target[itemId] ?? 0) + delta));
  if (next <= 0) delete target[itemId];
  else target[itemId] = next;
}

function slotCount(items: Record<string, number>) {
  return Object.keys(items).filter((itemId) => (items[itemId] ?? 0) > 0).length;
}

function positiveWholeCount(value: number | undefined, fallback = 1) {
  const count = value ?? fallback;
  if (!Number.isFinite(count) || count < 1 || Math.trunc(count) !== count) return undefined;
  return count;
}

function actorUsedSlots(actor: HarthmereInventoryLootActorInventoryV1) {
  return slotCount(actor.items) + actor.instanceIds.length;
}

function guildUsedSlots(guild: HarthmereInventoryLootGuildStateV1) {
  return slotCount(guild.vault) + guild.instanceIds.length;
}

function wouldExceedStack(
  ctx: HarthmereInventoryLootMutationContextV1,
  items: Record<string, number>,
  itemId: string,
  count: number
) {
  const def = getDef(ctx, itemId);
  if (!def) return true;
  return (items[itemId] ?? 0) + count > def.maxStackSize;
}

function hasActorItem(actor: HarthmereInventoryLootActorInventoryV1, itemId: string, count: number) {
  return (actor.items[itemId] ?? 0) - (actor.escrow[itemId] ?? 0) >= count;
}

function actorHasLicenseOrPermit(
  actor: HarthmereInventoryLootActorInventoryV1,
  def: HarthmereInventoryLootItemDefinitionV1,
  instance?: HarthmereInventoryLootItemInstanceV1
) {
  const flags = new Set([def.legalClass, ...(instance?.legalFlags ?? [])]);
  if (flags.has("contraband")) return false;
  if (def.requiredPermit && !actor.permits.includes(def.requiredPermit)) return false;
  if (def.requiredLicense) {
    const level = actor.licenses[def.requiredLicense] ?? 0;
    if (level < (def.requiredLicenseLevel ?? 1)) return false;
  }
  return true;
}

function businessCanStoreItem(
  business: HarthmereInventoryLootBusinessInventoryV1,
  def: HarthmereInventoryLootItemDefinitionV1,
  storageClass: HarthmereInventoryLootStorageClassV1 | undefined
) {
  const targetStorage = storageClass ?? "business_warehouse";
  if (!def.allowedStorage.includes(targetStorage)) return false;
  if (def.businessUses.length > 0 && !def.businessUses.includes(business.typeId)) return false;
  if (def.requiredPermit && !business.permits.includes(def.requiredPermit)) return false;
  if (def.requiredLicense) {
    const level = business.licenses[def.requiredLicense] ?? 0;
    if (level < (def.requiredLicenseLevel ?? 1)) return false;
  }
  if (def.legalClass === "contraband" && business.typeId !== "general_trader") return false;
  return true;
}

function actorHasInventoryCapacity(
  actor: HarthmereInventoryLootActorInventoryV1,
  itemId: string, count: number, ctx: HarthmereInventoryLootMutationContextV1
) {
  const def = getDef(ctx, itemId);
  if (def?.category === "currency") return true;
  if (wouldExceedStack(ctx, actor.items, itemId, count)) return false;
  if ((actor.items[itemId] ?? 0) <= 0 && actorUsedSlots(actor) >= actor.maxInventorySlots) return false;
  return true;
}

function actorCanReceiveStacksAndInstances(
  actor: HarthmereInventoryLootActorInventoryV1,
  stacks: Record<string, number>,
  instanceCount: number,
  ctx: HarthmereInventoryLootMutationContextV1
) {
  const projected = { ...actor.items };
  for (const [itemId, count] of Object.entries(stacks)) {
    const def = getDef(ctx, itemId);
    if (!def) return false;
    if (def.category === "currency") continue;
    if (wouldExceedStack(ctx, projected, itemId, count)) return false;
    addCount(projected, itemId, count);
  }
  return slotCount(projected) + actor.instanceIds.length + instanceCount <= actor.maxInventorySlots;
}

function guildCanReceiveStacksAndInstances(
  guild: HarthmereInventoryLootGuildStateV1,
  stacks: Record<string, number>,
  instanceCount: number,
  ctx: HarthmereInventoryLootMutationContextV1
) {
  const projected = { ...guild.vault };
  for (const [itemId, count] of Object.entries(stacks)) {
    const def = getDef(ctx, itemId);
    if (!def) return false;
    if (def.category === "currency") continue;
    if (wouldExceedStack(ctx, projected, itemId, count)) return false;
    addCount(projected, itemId, count);
  }
  return slotCount(projected) + guild.instanceIds.length + instanceCount <= guild.maxSlots;
}

function businessHasInventoryCapacity(
  business: HarthmereInventoryLootBusinessInventoryV1,
  itemId: string,
  count: number,
  ctx: HarthmereInventoryLootMutationContextV1
) {
  if (wouldExceedStack(ctx, business.inventory, itemId, count)) return false;
  if ((business.inventory[itemId] ?? 0) <= 0 && slotCount(business.inventory) >= business.maxSlots) return false;
  return true;
}

function isActiveGuildMember(guild: HarthmereInventoryLootGuildStateV1, actorId: string, nowMs: number) {
  const member = guild.members[actorId];
  return !!member && (member.kickedAtMs === undefined || member.kickedAtMs > nowMs);
}

function createInstance(
  state: HarthmereInventoryLootStateV1,
  ctx: HarthmereInventoryLootMutationContextV1,
  req: HarthmereInventoryLootMutationRequestV1,
  args: {
    itemId: string;
    quantity?: number;
    ownerKind: HarthmereInventoryLootOwnerKindV1;
    ownerId: string;
    location: HarthmereInventoryLootLocationKindV1;
    containerId?: string;
    legalFlags?: HarthmereInventoryLootLegalClassV1[];
    quality?: number;
    sourceKind?: string;
    sourceId?: string;
    guildId?: string;
    jobId?: string;
    deliveryId?: string;
  }
) {
  const def = getDef(ctx, args.itemId);
  if (!def) throw new Error(`unknown_item_id:${args.itemId}`);
  const now = req.nowMs;
  const id = `hm_item_${state.nextInstanceNumber++}`;
  const durabilityMax = def.durabilityMax;
  const instance: HarthmereInventoryLootItemInstanceV1 = {
    instanceId: id,
    itemId: args.itemId,
    quantity: Math.max(1, Math.trunc(args.quantity ?? 1)),
    ownerKind: args.ownerKind,
    ownerId: args.ownerId,
    location: args.location,
    containerId: args.containerId,
    createdAtMs: now,
    updatedAtMs: now,
    expiresAtMs: def.perishable && def.expiresAfterMs ? now + def.expiresAfterMs : undefined,
    condition: 100,
    durability: durabilityMax,
    durabilityMax,
    quality: Math.max(def.qualityFloor ?? 1, Math.min(100, Math.trunc(args.quality ?? 50))),
    legalFlags: [...new Set([...(args.legalFlags ?? []), ...(def.legalClass === "common" ? [] : [def.legalClass])])],
    boundToActorId: def.binding === "on_pickup" || def.binding === "quest" ? args.ownerId : undefined,
    craftedByActorId: req.actorId,
    upgradedLevel: 0,
    enchantments: [],
    sourceKind: args.sourceKind,
    sourceId: args.sourceId,
    jobId: args.jobId,
    deliveryId: args.deliveryId,
    guildId: args.guildId,
    loanedToActorId: undefined,
    contaminated: def.contaminationRisk > 0 && (args.legalFlags ?? []).includes("evidence"),
    broken: false,
    audit: [{ atMs: now, kind: "created", actorId: req.actorId, reason: args.sourceKind }],
  };
  state.itemInstances[id] = instance;
  return instance;
}

function deterministicRandom(seed: number) {
  let value = Math.trunc(seed || 1) % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

export function rollHarthmereInventoryLootTableV1(
  table: HarthmereInventoryLootTableV1,
  ctx: HarthmereInventoryLootMutationContextV1,
  seed = 1,
  actorLootTags: string[] = []
): Array<HarthmereInventoryLootTableEntryV1 & { count: number }> {
  const rand = deterministicRandom(seed);
  const out: Array<HarthmereInventoryLootTableEntryV1 & { count: number }> = [];
  const addEntry = (entry: HarthmereInventoryLootTableEntryV1) => {
    if (!ctx.itemDefinitions[entry.itemId]) return;
    if (entry.firstTimeTag && actorLootTags.includes(entry.firstTimeTag)) return;
    const chance = entry.chance ?? 1;
    if (chance < 1 && rand() > chance) return;
    const spread = Math.max(0, entry.maxCount - entry.minCount);
    const count = entry.minCount + Math.floor(rand() * (spread + 1));
    if (count > 0) out.push({ ...entry, count });
  };
  for (const entry of table.guaranteedDrops) addEntry(entry);
  for (const entry of table.questDrops) addEntry(entry);
  for (let i = 0; i < table.rolls; i++) {
    const total = table.weightedDrops.reduce((sum, e) => sum + Math.max(0, e.weight), 0);
    if (total <= 0) break;
    let pick = rand() * total;
    for (const entry of table.weightedDrops) {
      const weight = Math.max(0, entry.weight);
      // Skip zero/negative-weight ("disabled") entries entirely. Otherwise a roll where
      // rand() returns exactly 0 yields pick=0 and the `pick <= 0` boundary would select
      // a leading zero-weight entry that is supposed to be impossible to drop.
      if (weight <= 0) continue;
      pick -= weight;
      if (pick <= 0) {
        addEntry(entry);
        break;
      }
    }
  }
  for (const entry of table.rareDrops) addEntry(entry);
  return out;
}

function createLootDropFromEntries(
  state: HarthmereInventoryLootStateV1,
  ctx: HarthmereInventoryLootMutationContextV1,
  req: HarthmereInventoryLootMutationRequestV1,
  entries: Array<HarthmereInventoryLootTableEntryV1 & { count: number }>
) {
  const dropId = `hm_drop_${state.nextDropNumber++}`;
  const stacks: Record<string, number> = {};
  const instanceIds: string[] = [];
  for (const entry of entries) {
    const def = getDef(ctx, entry.itemId);
    if (!def) continue;
    if (entry.instance || def.uniqueInstance || def.perishable || def.durabilityMax || entry.legalFlags?.length) {
      const inst = createInstance(state, ctx, req, {
        itemId: entry.itemId,
        quantity: entry.count,
        ownerKind: "system",
        ownerId: dropId,
        location: "loot_drop",
        containerId: dropId,
        legalFlags: entry.legalFlags,
        quality: entry.quality,
        sourceKind: req.sourceKind,
        sourceId: req.sourceId,
        guildId: req.guildId,
      });
      instanceIds.push(inst.instanceId);
    } else {
      addCount(stacks, entry.itemId, entry.count);
    }
  }
  const ttl = HARTHMERE_INVENTORY_LOOT_DEFAULT_DROP_TTL_MS_V1;
  const pickupToken = `${dropId}:${req.requestId}:${req.nowMs}`;
  const firstTimeTags = [
    ...new Set(entries.map((entry) => entry.firstTimeTag).filter((tag): tag is string => !!tag)),
  ];
  const drop: HarthmereInventoryLootDropV1 = {
    dropId,
    sourceKind: req.sourceKind ?? "unknown",
    sourceId: req.sourceId ?? "unknown",
    sourceLevel: req.sourceLevel,
    townId: req.townId,
    regionId: req.regionId,
    position: req.position,
    itemStacks: stacks,
    instanceIds,
    ownerActorIds: [...new Set(req.ownerActorIds ?? [req.actorId])],
    partyId: req.partyId,
    guildId: req.guildId,
    pickupToken,
    createdAtMs: req.nowMs,
    expiresAtMs: req.nowMs + ttl,
    status: "available",
    abuseFlags: [],
    firstTimeTags,
  };
  state.lootDrops[dropId] = drop;
  addAudit(state, req, { kind: "loot_drop_created", actorId: req.actorId, dropId, sourceKind: drop.sourceKind, sourceId: drop.sourceId });
  return drop;
}

function legalViolationsForActor(
  actor: HarthmereInventoryLootActorInventoryV1,
  state: HarthmereInventoryLootStateV1,
  ctx: HarthmereInventoryLootMutationContextV1,
  nowMs: number
) {
  const violations: Array<{ id: string; atMs: number; itemId: string; code: string }> = [];
  const inspect = (itemId: string, instance?: HarthmereInventoryLootItemInstanceV1) => {
    const def = getDef(ctx, itemId);
    if (!def) return;
    const flags = new Set([def.legalClass, ...(instance?.legalFlags ?? [])]);
    if (flags.has("contraband")) {
      violations.push({ id: `legal_${actor.actorId}_${violations.length + 1}`, atMs: nowMs, itemId, code: "contraband_item_carried" });
    }
    if (flags.has("stolen")) {
      violations.push({ id: `legal_${actor.actorId}_${violations.length + 1}`, atMs: nowMs, itemId, code: "stolen_goods_carried" });
    }
    if (!actorHasLicenseOrPermit(actor, def, instance)) {
      violations.push({ id: `legal_${actor.actorId}_${violations.length + 1}`, atMs: nowMs, itemId, code: "missing_required_license_or_permit" });
    }
  };
  for (const itemId of Object.keys(actor.items)) inspect(itemId);
  for (const id of actor.instanceIds) {
    const inst = state.itemInstances[id];
    if (inst && inst.ownerKind === "actor" && inst.ownerId === actor.actorId && inst.location !== "destroyed") {
      inspect(inst.itemId, inst);
    }
  }
  return violations;
}

function touchBusinessAudit(
  business: HarthmereInventoryLootBusinessInventoryV1,
  req: HarthmereInventoryLootMutationRequestV1,
  kind: string,
  itemId?: string,
  count?: number
) {
  business.audit.push({ atMs: req.nowMs, actorId: req.actorId, kind, itemId, count });
  business.audit = business.audit.slice(-200);
}

function updateTownDemandFromInventories(
  state: HarthmereInventoryLootStateV1,
  ctx: HarthmereInventoryLootMutationContextV1,
  req: HarthmereInventoryLootMutationRequestV1,
  townId: string,
  regionId: string
) {
  const supply: Record<HarthmereInventoryLootNeedIdV1, number> = Object.fromEntries(ALL_NEEDS_V1.map((n) => [n, 0])) as Record<HarthmereInventoryLootNeedIdV1, number>;
  for (const business of Object.values(state.businesses)) {
    if (business.townId !== townId) continue;
    for (const [itemId, count] of Object.entries(business.inventory)) {
      const def = getDef(ctx, itemId);
      if (!def) continue;
      for (const need of def.townNeeds) supply[need] += Math.max(0, count);
    }
    if (business.sanitationRating < 50) supply.sanitation -= 25;
    if (business.safetyRating < 50) supply.safety -= 25;
  }
  const existing = state.townDemand[townId];
  const needs: HarthmereInventoryLootTownDemandStateV1["needs"] = existing?.needs ?? Object.fromEntries(
    ALL_NEEDS_V1.map((need) => [need, { value: 75, demandWeight: 1, lastUpdatedAtMs: req.nowMs }])
  ) as HarthmereInventoryLootTownDemandStateV1["needs"];
  for (const need of ALL_NEEDS_V1) {
    const baseline = need === "food" || need === "health" || need === "sanitation" || need === "safety" ? 30 : 15;
    const value = Math.max(0, Math.min(100, 100 - Math.max(0, supply[need]) / baseline * 100));
    needs[need] = {
      value,
      demandWeight: Math.max(0.1, Math.min(5, value / 20)),
      lastUpdatedAtMs: req.nowMs,
    };
  }
  state.townDemand[townId] = { townId, regionId, needs, signals: { ...supply }, lastUpdatedAtMs: req.nowMs };
}

export function reduceHarthmereInventoryLootMutationV1(
  stateIn: HarthmereInventoryLootStateV1,
  req: HarthmereInventoryLootMutationRequestV1,
  ctx: HarthmereInventoryLootMutationContextV1
): HarthmereInventoryLootMutationResultV1 {
  const state = cloneState(stateIn);
  const errors: string[] = [];
  const warnings: string[] = [];
  const touched = new Set<string>();
  const shared = new Set<string>();
  const actor = state.actors[req.actorId];

  const fail = (...codes: string[]) => result(false, req, stateIn, codes, warnings, [...touched], [...shared]);

  try {
    switch (req.operation) {
      case "register_actor": {
        if (!state.actors[req.actorId]) {
          state.actors[req.actorId] = createHarthmereInventoryLootActorV1(req.actorId);
        }
        touched.add("inventory_actor");
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "register_business": {
        if (!req.businessId) return fail("missing_business_id");
        if (!req.businessTypeId) return fail("missing_business_type_id");
        state.businesses[req.businessId] = createHarthmereInventoryLootBusinessV1(
          req.businessId,
          req.businessTypeId,
          req.actorId,
          req.townId,
          req.regionId
        );
        touched.add("business_inventory");
        shared.add(`business:${req.businessId}`);
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "register_guild": {
        if (!req.guildId) return fail("missing_guild_id");
        state.guilds[req.guildId] = createHarthmereInventoryLootGuildV1(req.guildId, [req.actorId]);
        state.actors[req.actorId] = state.actors[req.actorId] ?? createHarthmereInventoryLootActorV1(req.actorId);
        state.actors[req.actorId].guildId = req.guildId;
        touched.add("guild_inventory");
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "grant_stack": {
        const a = actor ?? (state.actors[req.actorId] = createHarthmereInventoryLootActorV1(req.actorId));
        const def = getDef(ctx, req.itemId);
        const count = positiveWholeCount(req.count);
        if (!def) return fail("unknown_item_id");
        if (count === undefined) return fail("invalid_count");
        if (def.category === "currency") {
          a.gold += count;
          addAudit(state, req, { kind: "grant_currency", actorId: req.actorId, itemId: def.itemId, count });
          touched.add("wallet");
          return result(true, req, state, [], warnings, [...touched], [...shared]);
        }
        if (!actorHasInventoryCapacity(a, def.itemId, count, ctx)) return fail("inventory_full_or_stack_exceeded");
        addCount(a.items, def.itemId, count);
        addAudit(state, req, { kind: "grant_stack", actorId: req.actorId, itemId: def.itemId, count });
        touched.add("inventory_items");
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "create_item_instance": {
        const a = actor ?? (state.actors[req.actorId] = createHarthmereInventoryLootActorV1(req.actorId));
        const def = getDef(ctx, req.itemId);
        if (!def) return fail("unknown_item_id");
        if (!actorHasLicenseOrPermit(a, def)) return fail("missing_required_license_or_permit");
        if (actorUsedSlots(a) >= a.maxInventorySlots) return fail("inventory_full");
        const inst = createInstance(state, ctx, req, {
          itemId: def.itemId,
          ownerKind: "actor",
          ownerId: req.actorId,
          location: "actor_inventory",
          legalFlags: req.legalFlags,
          quality: req.quality,
          sourceKind: req.sourceKind ?? "server_grant",
          sourceId: req.sourceId ?? req.requestId,
        });
        a.instanceIds.push(inst.instanceId);
        touched.add("item_instances");
        addAudit(state, req, { kind: "item_instance_created", actorId: req.actorId, itemId: def.itemId, instanceId: inst.instanceId });
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "create_loot_drop": {
        let entries: Array<HarthmereInventoryLootTableEntryV1 & { count: number }> = [];
        if (req.lootTableId) {
          const table = ctx.lootTables[req.lootTableId];
          if (!table) return fail("unknown_loot_table_id");
          entries = rollHarthmereInventoryLootTableV1(table, ctx, req.rngSeed ?? req.nowMs, state.actorLootTags[req.actorId] ?? []);
        } else {
          const def = getDef(ctx, req.itemId);
          const count = positiveWholeCount(req.count);
          if (!def) return fail("unknown_item_id");
          if (count === undefined) return fail("invalid_count");
          entries = [{ itemId: def.itemId, minCount: count, maxCount: count, weight: 1, count, legalFlags: req.legalFlags }];
        }
        if (entries.length === 0) return fail("loot_table_empty_or_all_entries_filtered");
        const drop = createLootDropFromEntries(state, ctx, req, entries);
        touched.add("loot_drops");
        shared.add(`loot_drop:${drop.dropId}`);
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "claim_loot_drop": {
        const a = actor;
        if (!a) return fail("unknown_actor");
        if (!req.dropId) return fail("missing_drop_id");
        const drop = state.lootDrops[req.dropId];
        if (!drop) return fail("unknown_drop_id");
        if (drop.status !== "available") return fail("loot_drop_not_available");
        if (req.nowMs > drop.expiresAtMs) return fail("loot_drop_expired");
        if (!req.pickupToken || req.pickupToken !== drop.pickupToken) return fail("invalid_pickup_token");
        if (state.usedPickupTokens[req.pickupToken]) return fail("pickup_token_already_used");
        const eligible = drop.ownerActorIds.includes(req.actorId) || (!!drop.partyId && drop.partyId === a.partyId) || (!!drop.guildId && drop.guildId === a.guildId);
        if (!eligible) return fail("actor_not_eligible_for_loot");
        for (const [itemId, count] of Object.entries(drop.itemStacks)) {
          const def = getDef(ctx, itemId);
          if (!def) return fail(`unknown_item_id:${itemId}`);
          if (def.category !== "currency" && !actorHasLicenseOrPermit(a, def)) return fail(`missing_required_license_or_permit:${itemId}`);
        }
        for (const instanceId of drop.instanceIds) {
          const inst = state.itemInstances[instanceId];
          const def = inst ? getDef(ctx, inst.itemId) : undefined;
          if (!inst || !def) return fail(`unknown_instance_id:${instanceId}`);
          if (!actorHasLicenseOrPermit(a, def, inst)) return fail(`missing_required_license_or_permit:${inst.itemId}`);
        }
        const guild = drop.guildId ? state.guilds[drop.guildId] : undefined;
        if (guild && guild.lootRule === "guild_project") {
          if (!isActiveGuildMember(guild, req.actorId, req.nowMs)) return fail("actor_not_active_guild_member");
          if (!guildCanReceiveStacksAndInstances(guild, drop.itemStacks, drop.instanceIds.length, ctx)) return fail("guild_vault_full_or_stack_exceeded");
          for (const [itemId, count] of Object.entries(drop.itemStacks)) {
            const def = getDef(ctx, itemId);
            if (def?.category === "currency") a.gold += count;
            else addCount(guild.vault, itemId, count);
          }
          for (const instanceId of drop.instanceIds) {
            const inst = state.itemInstances[instanceId];
            inst.ownerKind = "guild";
            inst.ownerId = guild.guildId;
            inst.location = "guild_vault";
            inst.guildId = guild.guildId;
            guild.instanceIds.push(instanceId);
          }
          guild.protectedClaimUntilMs[drop.dropId] = req.nowMs + HARTHMERE_INVENTORY_LOOT_GUILD_PROTECTED_CLAIM_MS_V1;
          guild.history.push({ atMs: req.nowMs, kind: "guild_project_loot_claimed", actorId: req.actorId, dropId: drop.dropId });
          touched.add("guild_loot");
        } else {
          if (!actorCanReceiveStacksAndInstances(a, drop.itemStacks, drop.instanceIds.length, ctx)) return fail("inventory_full_or_stack_exceeded");
          for (const [itemId, count] of Object.entries(drop.itemStacks)) {
            const def = getDef(ctx, itemId);
            if (def?.category === "currency") a.gold += count;
            else addCount(a.items, itemId, count);
          }
          for (const instanceId of drop.instanceIds) {
            const inst = state.itemInstances[instanceId];
            inst.ownerKind = "actor";
            inst.ownerId = req.actorId;
            inst.location = "actor_inventory";
            inst.containerId = undefined;
            if (inst.boundToActorId === undefined && getDef(ctx, inst.itemId)?.binding === "on_pickup") inst.boundToActorId = req.actorId;
            a.instanceIds.push(instanceId);
          }
          touched.add("inventory_items");
          touched.add("item_instances");
        }
        drop.status = "claimed";
        drop.claimedByActorId = req.actorId;
        drop.claimedAtMs = req.nowMs;
        state.usedPickupTokens[req.pickupToken] = req.nowMs;
        const tags = state.actorLootTags[req.actorId] ?? [];
        for (const tag of drop.firstTimeTags ?? []) {
          if (!tags.includes(tag)) tags.push(tag);
        }
        for (const instanceId of drop.instanceIds) {
          const inst = state.itemInstances[instanceId];
          const tableEntries = Object.values(ctx.lootTables).flatMap((t) => [...t.questDrops, ...t.guaranteedDrops, ...t.weightedDrops, ...t.rareDrops]);
          for (const e of tableEntries) if (e.itemId === inst.itemId && e.firstTimeTag && !tags.includes(e.firstTimeTag)) tags.push(e.firstTimeTag);
        }
        state.actorLootTags[req.actorId] = tags;
        addAudit(state, req, { kind: "loot_drop_claimed", actorId: req.actorId, dropId: drop.dropId, guildId: drop.guildId });
        touched.add("loot_claims");
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "expire_loot_drops": {
        for (const drop of Object.values(state.lootDrops)) {
          if (drop.status === "available" && req.nowMs > drop.expiresAtMs) {
            drop.status = "expired";
            for (const instanceId of drop.instanceIds) {
              const inst = state.itemInstances[instanceId];
              if (inst) inst.location = "destroyed";
            }
            addAudit(state, req, { kind: "loot_drop_expired", actorId: req.actorId, dropId: drop.dropId });
          }
        }
        touched.add("loot_drops");
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "drop_item": {
        const a = actor;
        if (!a) return fail("unknown_actor");
        const def = getDef(ctx, req.itemId);
        const count = positiveWholeCount(req.count);
        if (!def) return fail("unknown_item_id");
        if (count === undefined) return fail("invalid_count");
        if (def.binding === "quest" || def.legalClass === "quest_bound") return fail("cannot_drop_quest_item");
        if (!hasActorItem(a, def.itemId, count)) return fail("insufficient_item_count");
        addCount(a.items, def.itemId, -count);
        const drop = createLootDropFromEntries(state, ctx, req, [{ itemId: def.itemId, minCount: count, maxCount: count, weight: 1, count }]);
        drop.sourceKind = "actor_drop";
        drop.sourceId = req.actorId;
        touched.add("inventory_items");
        touched.add("loot_drops");
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "move_to_business_inventory": {
        const a = actor;
        if (!a) return fail("unknown_actor");
        if (!req.businessId) return fail("missing_business_id");
        const business = state.businesses[req.businessId];
        if (!business) return fail("unknown_business_id");
        const def = getDef(ctx, req.itemId);
        const count = positiveWholeCount(req.count);
        if (!def) return fail("unknown_item_id");
        if (count === undefined) return fail("invalid_count");
        if (!hasActorItem(a, def.itemId, count)) return fail("insufficient_item_count");
        if (!businessCanStoreItem(business, def, req.storageClass)) return fail("business_cannot_store_item");
        if (!businessHasInventoryCapacity(business, def.itemId, count, ctx)) return fail("business_inventory_full_or_stack_exceeded");
        addCount(a.items, def.itemId, -count);
        addCount(business.inventory, def.itemId, count);
        if (req.storageClass) {
          business.storage[req.storageClass] = business.storage[req.storageClass] ?? {};
          addCount(business.storage[req.storageClass]!, def.itemId, count);
        }
        touchBusinessAudit(business, req, "deposit", def.itemId, count);
        addAudit(state, req, { kind: "business_inventory_deposit", actorId: req.actorId, itemId: def.itemId, count });
        touched.add("business_inventory");
        touched.add("inventory_items");
        shared.add(`business:${business.businessId}`);
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "move_from_business_inventory": {
        const a = actor;
        if (!a) return fail("unknown_actor");
        if (!req.businessId) return fail("missing_business_id");
        const business = state.businesses[req.businessId];
        if (!business) return fail("unknown_business_id");
        const def = getDef(ctx, req.itemId);
        const count = positiveWholeCount(req.count);
        if (!def) return fail("unknown_item_id");
        if (count === undefined) return fail("invalid_count");
        if ((business.inventory[def.itemId] ?? 0) < count) return fail("insufficient_business_item_count");
        if (req.storageClass && (business.storage[req.storageClass]?.[def.itemId] ?? 0) < count) return fail("insufficient_business_storage_item_count");
        if (!actorHasInventoryCapacity(a, def.itemId, count, ctx)) return fail("inventory_full_or_stack_exceeded");
        addCount(business.inventory, def.itemId, -count);
        if (req.storageClass && business.storage[req.storageClass]) addCount(business.storage[req.storageClass]!, def.itemId, -count);
        addCount(a.items, def.itemId, count);
        touchBusinessAudit(business, req, "withdraw", def.itemId, count);
        touched.add("business_inventory");
        touched.add("inventory_items");
        shared.add(`business:${business.businessId}`);
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "validate_legal_inventory": {
        const a = actor;
        if (!a) return fail("unknown_actor");
        const violations = legalViolationsForActor(a, state, ctx, req.nowMs);
        a.legalViolations.push(...violations);
        if (violations.length) warnings.push(...violations.map((v) => `legal_violation:${v.code}:${v.itemId}`));
        touched.add("law_inventory");
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "damage_item_instance": {
        const inst = req.instanceId ? state.itemInstances[req.instanceId] : undefined;
        if (!inst) return fail("unknown_instance_id");
        if (inst.ownerKind !== "actor" || inst.ownerId !== req.actorId) return fail("actor_does_not_own_instance");
        const amount = Math.max(1, Math.trunc(req.damageAmount ?? 1));
        inst.durability = Math.max(0, (inst.durability ?? inst.durabilityMax ?? 100) - amount);
        inst.condition = Math.max(0, inst.condition - amount);
        inst.updatedAtMs = req.nowMs;
        if (inst.durability <= 0 || inst.condition <= 0) inst.broken = true;
        inst.audit.push({ atMs: req.nowMs, kind: "damaged", actorId: req.actorId, reason: String(amount) });
        addAudit(state, req, { kind: "item_instance_damaged", actorId: req.actorId, itemId: inst.itemId, instanceId: inst.instanceId });
        touched.add("item_instances");
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "repair_item_instance": {
        const a = actor;
        if (!a) return fail("unknown_actor");
        const inst = req.instanceId ? state.itemInstances[req.instanceId] : undefined;
        if (!inst) return fail("unknown_instance_id");
        if (inst.ownerKind !== "actor" || inst.ownerId !== req.actorId) return fail("actor_does_not_own_instance");
        const def = getDef(ctx, inst.itemId);
        if (!def) return fail("unknown_item_id");
        if (!def.repairable) return fail("item_not_repairable");
        if ((inst.condition >= 100 && (inst.durability ?? 100) >= (inst.durabilityMax ?? 100))) return fail("item_already_fully_repaired");
        const inputs = req.repairMaterials ?? Object.fromEntries((def.repairInputs ?? []).map((i) => [i.itemId, i.count]));
        for (const [itemId, count] of Object.entries(inputs)) {
          if (!hasActorItem(a, itemId, count)) return fail(`insufficient_repair_material:${itemId}`);
        }
        for (const [itemId, count] of Object.entries(inputs)) addCount(a.items, itemId, -count);
        inst.condition = 100;
        if (inst.durabilityMax) inst.durability = inst.durabilityMax;
        inst.broken = false;
        inst.updatedAtMs = req.nowMs;
        inst.audit.push({ atMs: req.nowMs, kind: "repaired", actorId: req.actorId });
        addAudit(state, req, { kind: "item_instance_repaired", actorId: req.actorId, itemId: inst.itemId, instanceId: inst.instanceId });
        touched.add("item_instances");
        touched.add("inventory_items");
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "salvage_item_instance": {
        const a = actor;
        if (!a) return fail("unknown_actor");
        const inst = req.instanceId ? state.itemInstances[req.instanceId] : undefined;
        if (!inst) return fail("unknown_instance_id");
        if (inst.ownerKind !== "actor" || inst.ownerId !== req.actorId) return fail("actor_does_not_own_instance");
        if (inst.loanedToActorId) return fail("cannot_salvage_loaned_guild_item");
        const def = getDef(ctx, inst.itemId);
        if (!def) return fail("unknown_item_id");
        const outputs = def.salvageOutputs ?? [];
        for (const output of outputs) {
          if (!actorHasInventoryCapacity(a, output.itemId, output.count, ctx)) return fail(`inventory_full_or_stack_exceeded:${output.itemId}`);
        }
        inst.location = "destroyed";
        inst.updatedAtMs = req.nowMs;
        a.instanceIds = a.instanceIds.filter((id) => id !== inst.instanceId);
        for (const output of outputs) addCount(a.items, output.itemId, output.count);
        addAudit(state, req, { kind: "item_instance_salvaged", actorId: req.actorId, itemId: inst.itemId, instanceId: inst.instanceId });
        touched.add("item_instances");
        touched.add("inventory_items");
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "tick_decay": {
        for (const inst of Object.values(state.itemInstances)) {
          if (inst.location === "destroyed" || !inst.expiresAtMs) continue;
          if (req.nowMs <= inst.expiresAtMs) continue;
          const def = getDef(ctx, inst.itemId);
          if (!def?.perishable) continue;
          inst.contaminated = inst.contaminated || def.contaminationRisk > 0;
          inst.condition = 0;
          inst.broken = true;
          inst.updatedAtMs = req.nowMs;
          inst.audit.push({ atMs: req.nowMs, kind: "expired_spoiled", actorId: req.actorId });
          addAudit(state, req, { kind: "perishable_item_spoiled", actorId: inst.ownerKind === "actor" ? inst.ownerId : req.actorId, itemId: inst.itemId, instanceId: inst.instanceId });
        }
        for (const business of Object.values(state.businesses)) {
          let hazard = 0;
          for (const [itemId, count] of Object.entries(business.inventory)) {
            const def = getDef(ctx, itemId);
            if (!def) continue;
            hazard += def.hazardLevel * count + def.contaminationRisk * count;
          }
          if (hazard > 0 && !business.permits.includes("hazardous_material")) {
            business.sanitationRating = Math.max(0, business.sanitationRating - Math.ceil(hazard / 10));
          }
        }
        touched.add("item_decay");
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "create_job_item_escrow": {
        const a = actor;
        if (!a) return fail("unknown_actor");
        if (!req.jobId) return fail("missing_job_id");
        if (!req.deadlineAtMs || req.deadlineAtMs <= req.nowMs) return fail("invalid_deadline");
        const requiredItems = req.requiredItems ?? [];
        if (requiredItems.length === 0) return fail("missing_required_items");
        for (const requirement of requiredItems) {
          const def = getDef(ctx, requirement.itemId);
          const count = positiveWholeCount(requirement.count);
          if (!def) return fail(`unknown_item_id:${requirement.itemId}`);
          if (count === undefined) return fail(`invalid_required_count:${requirement.itemId}`);
          if (!hasActorItem(a, def.itemId, count)) return fail(`insufficient_item_count:${def.itemId}`);
          if (requirement.freshnessRequired) {
            const fresh = a.instanceIds.some((id) => {
              const inst = state.itemInstances[id];
              return inst?.itemId === def.itemId && !inst.broken && (!inst.expiresAtMs || inst.expiresAtMs > req.nowMs);
            });
            if (!fresh && def.perishable) return fail(`fresh_item_required:${def.itemId}`);
          }
        }
        const escrowId = `hm_job_escrow_${state.nextEscrowNumber++}`;
        const stacks: Record<string, number> = {};
        for (const requirement of requiredItems) {
          const count = positiveWholeCount(requirement.count)!;
          addCount(a.items, requirement.itemId, -count);
          addCount(a.escrow, requirement.itemId, count);
          addCount(stacks, requirement.itemId, count);
        }
        const escrow: HarthmereInventoryLootJobEscrowV1 = {
          escrowId,
          jobId: req.jobId,
          boardId: req.boardId,
          issuerId: req.targetOwnerId ?? "unknown_issuer",
          seekerId: req.actorId,
          status: "active",
          requiredItems,
          escrowedStacks: stacks,
          packageInstanceIds: [],
          rewardGold: Math.max(0, Math.trunc(req.rewardGold ?? 0)),
          deadlineAtMs: req.deadlineAtMs,
          targetOwnerKind: req.targetOwnerKind ?? "business",
          targetOwnerId: req.targetOwnerId ?? "unknown_target",
          abuseFlags: [],
          logs: [`created:${req.nowMs}`],
          createdAtMs: req.nowMs,
        };
        state.jobEscrows[escrowId] = escrow;
        addAudit(state, req, { kind: "job_item_escrow_created", actorId: req.actorId, jobId: req.jobId });
        touched.add("job_item_escrow");
        touched.add("inventory_items");
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "complete_job_item_escrow": {
        const escrow = req.jobId ? Object.values(state.jobEscrows).find((e) => e.jobId === req.jobId && e.status === "active") : undefined;
        if (!escrow) return fail("unknown_active_job_escrow");
        if (req.nowMs > escrow.deadlineAtMs) return fail("job_escrow_deadline_expired");
        const seeker = state.actors[escrow.seekerId ?? ""];
        if (!seeker) return fail("unknown_seeker");
        if (escrow.targetOwnerKind === "business") {
          const business = state.businesses[escrow.targetOwnerId];
          if (!business) return fail("unknown_target_business");
          for (const [itemId, count] of Object.entries(escrow.escrowedStacks)) {
            const def = getDef(ctx, itemId);
            if (!def) return fail(`unknown_item_id:${itemId}`);
            if (!businessCanStoreItem(business, def, def.allowedStorage.includes("business_warehouse") ? "business_warehouse" : def.allowedStorage[0])) return fail(`business_cannot_store_item:${itemId}`);
            if (!businessHasInventoryCapacity(business, itemId, count, ctx)) return fail(`business_inventory_full_or_stack_exceeded:${itemId}`);
            addCount(seeker.escrow, itemId, -count);
            addCount(business.inventory, itemId, count);
            touchBusinessAudit(business, req, "job_delivery", itemId, count);
          }
        } else if (escrow.targetOwnerKind === "actor") {
          const target = state.actors[escrow.targetOwnerId];
          if (!target) return fail("unknown_target_actor");
          for (const [itemId, count] of Object.entries(escrow.escrowedStacks)) {
            if (!actorHasInventoryCapacity(target, itemId, count, ctx)) return fail(`target_inventory_full:${itemId}`);
            addCount(seeker.escrow, itemId, -count);
            addCount(target.items, itemId, count);
          }
        }
        if (escrow.rewardGold > 0) seeker.gold += escrow.rewardGold;
        escrow.status = "delivered";
        escrow.completedAtMs = req.nowMs;
        escrow.logs.push(`completed:${req.nowMs}`);
        addAudit(state, req, { kind: "job_item_escrow_completed", actorId: req.actorId, jobId: escrow.jobId });
        touched.add("job_item_escrow");
        touched.add("inventory_items");
        touched.add("business_inventory");
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "cancel_job_item_escrow": {
        const escrow = req.jobId ? Object.values(state.jobEscrows).find((e) => e.jobId === req.jobId && e.status === "active") : undefined;
        if (!escrow) return fail("unknown_active_job_escrow");
        const seeker = state.actors[escrow.seekerId ?? ""];
        if (!seeker) return fail("unknown_seeker");
        for (const [itemId, count] of Object.entries(escrow.escrowedStacks)) {
          addCount(seeker.escrow, itemId, -count);
          addCount(seeker.items, itemId, count);
        }
        escrow.status = req.nowMs > escrow.deadlineAtMs ? "expired" : "cancelled";
        escrow.logs.push(`${escrow.status}:${req.nowMs}`);
        touched.add("job_item_escrow");
        touched.add("inventory_items");
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "assign_guild_loot": {
        if (!req.guildId) return fail("missing_guild_id");
        const guild = state.guilds[req.guildId];
        if (!guild) return fail("unknown_guild_id");
        if (!isActiveGuildMember(guild, req.actorId, req.nowMs)) return fail("actor_not_active_guild_member");
        if (req.dropId && guild.protectedClaimUntilMs[req.dropId] && req.nowMs > guild.protectedClaimUntilMs[req.dropId]) {
          return fail("guild_protected_claim_window_expired");
        }
        const targetActorId = req.targetOwnerId ?? req.actorId;
        const target = state.actors[targetActorId];
        if (!target) return fail("unknown_target_actor");
        if (!isActiveGuildMember(guild, targetActorId, req.nowMs)) return fail("target_not_active_guild_member");
        const def = getDef(ctx, req.itemId);
        const count = positiveWholeCount(req.count);
        if (!def) return fail("unknown_item_id");
        if (count === undefined) return fail("invalid_count");
        if ((guild.vault[def.itemId] ?? 0) < count) return fail("insufficient_guild_vault_item_count");
        if (!actorHasInventoryCapacity(target, def.itemId, count, ctx)) return fail("target_inventory_full_or_stack_exceeded");
        addCount(guild.vault, def.itemId, -count);
        addCount(target.items, def.itemId, count);
        guild.history.push({ atMs: req.nowMs, kind: "guild_loot_assigned", actorId: targetActorId, itemId: def.itemId, dropId: req.dropId });
        touched.add("guild_loot");
        touched.add("inventory_items");
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "loan_guild_item": {
        if (!req.guildId) return fail("missing_guild_id");
        const guild = state.guilds[req.guildId];
        if (!guild) return fail("unknown_guild_id");
        if (!isActiveGuildMember(guild, req.actorId, req.nowMs)) return fail("actor_not_active_guild_member");
        const targetActorId = req.targetOwnerId ?? req.actorId;
        const target = state.actors[targetActorId];
        if (!target) return fail("unknown_target_actor");
        if (!isActiveGuildMember(guild, targetActorId, req.nowMs)) return fail("target_not_active_guild_member");
        const inst = req.instanceId ? state.itemInstances[req.instanceId] : undefined;
        if (!inst || inst.ownerKind !== "guild" || inst.ownerId !== guild.guildId) return fail("unknown_guild_instance");
        if (inst.loanedToActorId) return fail("item_already_loaned");
        if (actorUsedSlots(target) >= target.maxInventorySlots) return fail("target_inventory_full");
        inst.loanedToActorId = targetActorId;
        inst.ownerKind = "actor";
        inst.ownerId = targetActorId;
        inst.location = "actor_inventory";
        guild.instanceIds = guild.instanceIds.filter((id) => id !== inst.instanceId);
        target.instanceIds.push(inst.instanceId);
        guild.loans[inst.instanceId] = { instanceId: inst.instanceId, actorId: targetActorId, dueAtMs: req.deadlineAtMs ?? req.nowMs + 7 * 24 * 60 * 60 * 1000 };
        guild.history.push({ atMs: req.nowMs, kind: "guild_item_loaned", actorId: targetActorId, instanceId: inst.instanceId });
        touched.add("guild_loans");
        touched.add("item_instances");
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "return_guild_loan": {
        if (!req.guildId) return fail("missing_guild_id");
        const guild = state.guilds[req.guildId];
        if (!guild) return fail("unknown_guild_id");
        const inst = req.instanceId ? state.itemInstances[req.instanceId] : undefined;
        if (!inst || inst.loanedToActorId !== req.actorId) return fail("unknown_actor_loaned_instance");
        const loan = guild.loans[inst.instanceId];
        if (!loan || loan.actorId !== req.actorId) return fail("unknown_guild_loan");
        if (guildUsedSlots(guild) >= guild.maxSlots) return fail("guild_vault_full");
        const a = actor;
        if (!a) return fail("unknown_actor");
        a.instanceIds = a.instanceIds.filter((id) => id !== inst.instanceId);
        inst.ownerKind = "guild";
        inst.ownerId = guild.guildId;
        inst.location = "guild_vault";
        inst.loanedToActorId = undefined;
        guild.instanceIds.push(inst.instanceId);
        if (guild.loans[inst.instanceId]) guild.loans[inst.instanceId].returnedAtMs = req.nowMs;
        guild.history.push({ atMs: req.nowMs, kind: "guild_item_returned", actorId: req.actorId, instanceId: inst.instanceId });
        touched.add("guild_loans");
        touched.add("item_instances");
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      case "update_town_demand": {
        const townId = req.townId ?? "harthmere_grove";
        const regionId = req.regionId ?? "harthmere_grove_region";
        updateTownDemandFromInventories(state, ctx, req, townId, regionId);
        touched.add("town_demand");
        shared.add(`town:${townId}`);
        return result(true, req, state, [], warnings, [...touched], [...shared]);
      }

      default:
        return fail(`unsupported_operation:${(req as { operation: string }).operation}`);
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return result(false, req, stateIn, errors, warnings, [...touched], [...shared]);
  }
}

export function createHarthmereInventoryLootClientSnapshotV1(
  state: HarthmereInventoryLootStateV1,
  actorId: string
) {
  const actor = state.actors[actorId];
  const guild = actor?.guildId ? state.guilds[actor.guildId] : undefined;
  const availableLootDrops = Object.values(state.lootDrops).filter((drop) =>
    drop.status === "available" &&
    (drop.ownerActorIds.includes(actorId) || (!!actor?.partyId && drop.partyId === actor.partyId) || (!!actor?.guildId && drop.guildId === actor.guildId))
  );
  const activeJobEscrows = Object.values(state.jobEscrows).filter((escrow) => escrow.seekerId === actorId && escrow.status === "active");
  const visibleInstanceIds = new Set<string>([
    ...(actor?.instanceIds ?? []),
    ...(guild?.instanceIds ?? []),
    ...availableLootDrops.flatMap((drop) => drop.instanceIds),
    ...activeJobEscrows.flatMap((escrow) => escrow.packageInstanceIds),
  ]);
  const itemInstances = Object.fromEntries(
    [...visibleInstanceIds]
      .map((id) => [id, state.itemInstances[id]] as const)
      .filter(([, instance]) => !!instance),
  );
  const ownedBusinessInventories = Object.fromEntries(
    Object.entries(state.businesses).filter(([, business]) =>
      business.ownerId === actorId || business.ownerId === actor?.guildId,
    ),
  );

  return {
    version: state.version,
    actor: actor
      ? {
          actorId,
          gold: actor.gold,
          items: actor.items,
          bank: actor.bank,
          equipment: actor.equipment,
          escrow: actor.escrow,
          instanceIds: actor.instanceIds,
          legalViolations: actor.legalViolations.slice(-20),
          licenses: actor.licenses,
          permits: actor.permits,
          maxInventorySlots: actor.maxInventorySlots,
          maxBankSlots: actor.maxBankSlots,
        }
      : undefined,
    availableLootDrops,
    recentLootLedger: state.lootLedger.filter((entry) => entry.actorId === actorId || entry.guildId === actor?.guildId).slice(-30),
    activeJobEscrows,
    guildVault: guild ? { guildId: guild.guildId, vault: guild.vault, instanceIds: guild.instanceIds, lootRule: guild.lootRule } : undefined,
    itemInstances,
    businessInventories: ownedBusinessInventories,
    townDemand: state.townDemand,
  };
}
