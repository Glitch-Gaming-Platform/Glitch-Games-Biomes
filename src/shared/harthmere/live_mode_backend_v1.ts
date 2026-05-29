import type {
  HarthmereLiveModeActionKindV1,
  HarthmereLiveModeAnySubsystemV1,
  HarthmereLiveModeAuthorityEnvelopeV1,
} from "./live_mode_readiness_v1";
import {
  reduceHarthmereInventoryMutationV1,
  applyHarthmereInventoryMutationResultV1,
  getHarthmereItemDefinitionV1,
  getHarthmereCraftingRecipeV1,
  registerHarthmereItemDefinitionV1,
  type HarthmereCraftingRecipeV1,
  type HarthmereItemDefinitionV1,
  type HarthmereInventorySnapshotV1,
  type HarthmereInventoryMutationRequestV1,
} from "./mmo_inventory_authority_v1";
import {
  reduceHarthmereCombatActionV1,
  computeHarthmereXpRewardV1,
  getHarthmereAbilityV1,
  getHarthmereClassDefinitionV1,
  registerHarthmereAbilityV1,
  registerHarthmereClassDefinitionV1,
  type HarthmereCombatActorSnapshotV1,
  type HarthmereCombatTargetSnapshotV1,
  type HarthmereZoneSnapshotV1,
  type HarthmereCombatActionRequestV1,
  type HarthmereResourceKindV1,
} from "./mmo_combat_authority_v1";
import {
  reduceHarthmereAuctionMutationV1,
  type HarthmereAuctionListingV1,
  type HarthmereAuctionMutationRequestV1,
} from "./mmo_auction_authority_v1";
import {
  validateHarthmereBuildingPlacementV1,
  validateHarthmerePlotClaimV1,
  type HarthmereBuildingPlacementRequestV1,
} from "./mmo_building_authority_v1";
import {
  createHarthmereLiveModeGuildClientSnapshotV1,
  defaultHarthmereLiveModeGuildStateV1,
  hasHarthmereGuildPermissionV1,
  linkHarthmereGuildHallPropertyV1,
  normalizeHarthmereLiveModeGuildStateV1,
  reduceHarthmereGuildMutationV1,
  type HarthmereLiveModeGuildStateV1,
} from "./mmo_guild_authority_v1";
import {
  createHarthmereProductionEconomyClientSnapshotV1,
  defaultHarthmereProductionEconomyStateV1,
  normalizeHarthmereProductionEconomyStateV1,
  reduceHarthmereEconomyMutationV1,
  type HarthmereProductionEconomyStateV1,
} from "./mmo_economy_authority_v1";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  createHarthmereJobsBoardClientSnapshotV1,
  defaultHarthmereJobsBoardStateV1,
  normalizeHarthmereJobsBoardStateV1,
  reduceHarthmereJobsBoardMutationV1,
  type HarthmereJobsBoardStateV1,
} from "./mmo_jobs_board_authority_v1";
import {
  HARTHMERE_FOOD_DEFINITIONS_V1,
  HARTHMERE_SEED_DEFINITIONS_V1,
} from "./mmo_farming_food_stamina_v1";
import {
  createHarthmereEmptyInventoryLootStateV1,
  createHarthmereInventoryLootActorV1,
  createHarthmereInventoryLootClientSnapshotV1,
  normalizeHarthmereInventoryLootStateV1,
  type HarthmereInventoryLootStateV1,
} from "./mmo_inventory_loot_authority_v1";
import {
  applyHarthmereClassChoiceV1,
  canLearnHarthmereAbilityV1,
  createHarthmereProgressionClientSnapshotV1,
  defaultHarthmereProgressionCollectionsStateV1,
  HARTHMERE_COLLECTIBLE_DEFINITIONS_V1,
  HARTHMERE_ABILITY_DEFINITIONS_V1,
  HARTHMERE_CLASS_DEFINITIONS_V1,
  HARTHMERE_SKILL_DEFINITIONS_V1,
  harthmereSkillLevelFromTotalXpV1,
  harthmereSkillProgressFromTotalXpV1,
  harthmereSkillTotalXpCapV1,
  knownHarthmereAbilityIdsV1,
  normalizeHarthmereProgressionCollectionsStateV1,
  type HarthmereProgressionCollectionsStateV1,
} from "./mmo_class_ability_collectibles_v1";
import {
  createHarthmereCareLoopClientSnapshotV1,
  defaultHarthmereCareLoopStateV1,
  normalizeHarthmereCareLoopStateV1,
  reduceHarthmereCareLoopV1,
  type HarthmereCareLoopClientSnapshotV1,
  type HarthmereCareLoopKindV1,
  type HarthmereCareLoopStateV1,
} from "./mmo_care_loops_v1";

import {
  buildingSystemBlueprintByIdV1,
  buildingSystemBlueprintByStructureTypeV1,
  BUILDING_SYSTEM_ABANDON_AFTER_UNPAID_TAX_MS_V1,
  BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1,
  BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1,
  buildingSystemCanActorAccessPropertyV1,
  buildingSystemDefaultOriginV1,
  buildingSystemDemolitionRefundGoldV1,
  buildingSystemPlotByIdV1,
  buildingSystemRemainingMaterialItemDeltasV1,
  buildingSystemRepairCostGoldV1,
  buildingSystemUpgradeCostGoldV1,
  createBuildingSystemDefaultPermissionsV1,
  createBuildingSystemDemolitionMaterializationPlanV1,
  createBuildingSystemDoorLockV1,
  createBuildingSystemMiraMapMarkerV1,
  createBuildingSystemPlacementPreviewV1,
  createBuildingSystemRepairDamageMaterializationPlanV1,
  createBuildingSystemRepairRestoreMaterializationPlanV1,
  createBuildingSystemStorageContainerV1,
  createBuildingSystemUpgradeMaterializationPlanV1,
  createBuildingSystemBusinessRecordV1,
  runBuildingSystemBusinessRevenueCycleV1,
  buildingSystemBusinessTypeByIdV1,
  createBuildingSystemMaterializationPlanV1,
  createBuildingSystemPlacementContextV1,
  createBuildingSystemPropertyRecordV1,
  createBuildingSystemSafeGroundMaterializationPlanV1,
  createBuildingSystemStageMaterializationPlanV1,
  ensureBuildingSystemStructureDefinitionsV1,
  normalizeBuildingSystemPropertyRecordV1,
  applyBuildingSystemPropertyLifecycleV1,
  toHarthmerePlotDefinitionV1,
  type BuildingSystemAccessModeV1,
  type BuildingSystemAnyMaterializationPlanV1,
  type BuildingSystemBusinessRecordV1,
  type BuildingSystemBusinessTypeV1,
  type BuildingSystemDoorLockRecordV1,
  type BuildingSystemInWorldMarkerV1,
  type BuildingSystemStorageContainerRecordV1,
  type BuildingSystemPermissionKeyV1,
  type BuildingSystemPermissionSubjectV1,
  type BuildingSystemProjectRecordV1,
  type BuildingSystemPropertyRecordV1,
  type BuildingSystemStageV1,
} from "./building_system_v1";

export const HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1 =
  "harthmere-live-mode-backend-v1";

export const HARTHMERE_READ_JOBS_BOARD_QUEST_ID_V140 =
  "read-the-jobs-board";
export const HARTHMERE_READ_JOBS_BOARD_STEP_ID_V140 =
  "read_harthmere_grove_jobs_board";

export const HARTHMERE_LIVE_MODE_BACKEND_SAFETY_CAP_V195 = 250;


export const HARTHMERE_PERSONAL_BANK_BASE_SLOTS_V1 = 24;
export const HARTHMERE_ACCOUNT_BANK_BASE_SLOTS_V1 = 16;
export const HARTHMERE_MATERIAL_STORAGE_BASE_SLOTS_V1 = 32;
export const HARTHMERE_BANK_SLOT_UPGRADE_SIZE_V1 = 4;
export const HARTHMERE_BANK_MAX_SLOTS_V1 = 120;
export const HARTHMERE_LOAN_MAX_PRINCIPAL_V1 = 250;
export const HARTHMERE_LOAN_DAILY_INTEREST_RATE_V1 = 0.015;
export const HARTHMERE_LOAN_DAY_MS_V1 = 24 * 60 * 60 * 1000;
export const HARTHMERE_CARRY_WEIGHT_LIMIT_V1 = 25;
export const HARTHMERE_LOAN_LATE_INTEREST_MULTIPLIER_V1 = 2;
export const HARTHMERE_LOAN_DEFAULT_PENALTY_RATE_V1 = 0.2;
export const HARTHMERE_BANK_CREDIT_HOLD_FLAG_V1 = "bank_credit_hold";

export type HarthmereBankingVaultKindV1 = "personal" | "account" | "materials";
export type HarthmereBankingLoanStatusV1 = "active" | "paid" | "defaulted";

export interface HarthmereBankingTransactionLogV1 {
  id: string;
  actorId: string;
  kind: string;
  vault: HarthmereBankingVaultKindV1 | "loan";
  itemId?: string;
  count?: number;
  goldDelta?: number;
  loanId?: string;
  atMs: number;
  balanceAfter?: number;
}

export interface HarthmereBankingLoanV1 {
  loanId: string;
  actorId: string;
  principalOriginal: number;
  principalRemaining: number;
  interestPaid: number;
  dailyInterestRate: number;
  openedAtMs: number;
  dueAtMs: number;
  status: HarthmereBankingLoanStatusV1;
  lastPaymentAtMs?: number;
  defaultedAtMs?: number;
  defaultPenaltyGold?: number;
  penaltyPaid?: number;
  creditPenaltyApplied?: boolean;
}

export interface HarthmereLiveModeReputationStandingV1 {
  likeability: number;
  legal: number;
  notoriety: number;
  notorietyFloor: number;
}

export interface HarthmereLiveModeReputationEventV1 {
  id: string;
  atMs: number;
  scopeId: string;
  witnessLevel: string;
  likeabilityDelta: number;
  legalDelta: number;
  notorietyDelta: number;
  reason?: string;
}

export interface HarthmereLiveModeBankingStateV1 {
  accountBank: Record<string, number>;
  materialStorage: Record<string, number>;
  personalBankMaxSlots: number;
  accountBankMaxSlots: number;
  materialStorageMaxSlots: number;
  transactionLogs: HarthmereBankingTransactionLogV1[];
  loans: Record<string, HarthmereBankingLoanV1>;
  nextLoanNumber: number;
}

export interface HarthmereLiveModeBackendStateV1 {
  version: typeof HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1;
  actorId: string;
  updatedAtMs: number;
  inventory: {
    items: Record<string, number>;
    bank: Record<string, number>;
    equipment: Record<string, string>;
    overflow: Array<{ itemId: string; count: number; reason: string }>;
    gold: number;
    /** Items held in auction escrow — cannot be traded, equipped, or double-listed */
    escrow: Record<string, number>;
    /** Consumable shared-cooldown categories → expires-at ms (server clock) */
    consumableCooldowns: Record<string, number>;
  };
  economy: {
    ledger: Array<{ id: string; kind: string; amount: number; atMs: number }>;
    vendorTransactions: Record<string, number>;
    /** listingId → full AH listing record (server-owned, not client summary) */
    auctionListings: Record<string, HarthmereAuctionListingV1>;
    /** Tax collected this session for the economy sink */
    houseTaxAccumulated: number;
    /** Property-hosted businesses that earn recurring revenue from town needs. */
    businesses: Record<string, BuildingSystemBusinessRecordV1>;
    businessRevenueAccumulated: number;
    /** Production-ready society economy: business ownership, contracts, town demand, staff, loans, insurance, markets. */
    production: HarthmereProductionEconomyStateV1;
  };
  /** Physical Grove jobs board: public work postings, accepted seeker todos, anti-abuse state. */
  jobsBoard: HarthmereJobsBoardStateV1;
  /** Production MMO inventory/loot authority: item instances, loot drops, legal flags, business stock, job escrow, guild loot. */
  inventoryLoot: HarthmereInventoryLootStateV1;
  /** Respec metadata for cooldown/cost enforcement */
  respec: {
    count: number;
    lastRespecAtMs?: number;
  };
  /** Per-talent-tree purchased node ids */
  talents: {
    nodes: string[];
    pointsSpent: number;
  };
  /** Building placement audit records */
  building: {
    placedStructures: Record<
      string,
      {
        structureTypeId: string;
        origin: { x: number; y: number; z: number };
        placedAtMs: number;
        plotId?: string;
        blueprintId?: string;
        use?: string;
        voxelEditCount?: number;
        materializedInEcs?: boolean;
      }
    >;
    ownedPlots: string[];
    safeZones: Record<string, { safeFromMuck: boolean; activatedAtMs: number; area: string }>;
    /** Authoritative active/finished construction projects; local UI state is not truth. */
    activeProjects: Record<string, BuildingSystemProjectRecordV1>;
    /** In-world plot/deed/map/NPC marker records created by server-approved building actions. */
    inWorldMarkers: Record<string, BuildingSystemInWorldMarkerV1>;
    materializationPlans: Record<string, BuildingSystemAnyMaterializationPlanV1>;
    storageContainers: Record<string, BuildingSystemStorageContainerRecordV1>;
    doorLocks: Record<string, BuildingSystemDoorLockRecordV1>;
  };
  guild: HarthmereLiveModeGuildStateV1;
  banking: HarthmereLiveModeBankingStateV1;
  law: {
    reputation: Record<string, number>;
    standing: Record<string, HarthmereLiveModeReputationStandingV1>;
    recentReputationEvents: HarthmereLiveModeReputationEventV1[];
    fines: Record<string, number>;
    flags: Record<string, boolean>;
    crimeLog: Array<{ id: string; kind: string; atMs: number; zoneId: string }>;
  };
  classMagic: {
    classId?: string;
    specializationId?: string;
    knownAbilities: string[];
    knownRecipes: string[];
    skills: Record<string, { xp: number; level: number }>;
    magicSchools: Record<string, { xp: number; level: number; illegal: boolean }>;
    loadout: Record<string, string>;
    faith: Record<string, number>;
    /** @deprecated use top-level `respec.count` — kept for backward compat */
    respecCount: number;
  };
  collections: HarthmereProgressionCollectionsStateV1;
  quests: {
    active: Record<string, { stepId?: string; progress: number }>;
    completed: Record<string, number>;
  };
  property: {
    owned: Record<string, BuildingSystemPropertyRecordV1>;
    buildingProgress: Record<string, number>;
  };
  farming: {
    plots: Record<string, { cropId: string; plantedAtMs: number; state: string }>;
    harvests: Record<string, number>;
  };
  mail: {
    messages: Record<string, {
      mailId: string;
      recipientActorId: string;
      senderActorId?: string;
      status: "unread" | "read" | "claimed" | "deleted";
      attachments: Record<string, number>;
      createdAtMs: number;
      claimedAtMs?: number;
    }>;
  };
  careLoops: HarthmereCareLoopStateV1;
  combat: {
    hp: number;
    maxHp: number;
    resources: Partial<Record<HarthmereResourceKindV1, number>>;
    maxResources: Partial<Record<HarthmereResourceKindV1, number>>;
    cooldowns: Record<string, number>;
    deathState?: "alive" | "downed" | "dead";
    deathRecords: Record<string, { deathId: string; cause: string; zoneId: string; atMs: number; respawnAvailableAtMs: number }>;
    respawnProtectionUntilMs?: number;
    threat: Record<string, number>;
    lootClaims: Record<string, number>;
    entitySnapshots: Record<string, {
      hp: number;
      maxHp: number;
      position: { x: number; y: number; z: number };
      isHostile: boolean;
      isAlive: boolean;
      isAttackable: boolean;
      isPlayer?: boolean;
      pvpFlagged?: boolean;
      zonePvPRule?: HarthmereZoneSnapshotV1["pvpRule"];
      level?: number;
    }>;
    npcAiTicks: Record<string, { tickId: string; atMs: number; decision: string; targetId?: string; nextThinkAtMs: number }>;
    bossTicks: Record<string, { tickId: string; atMs: number; phase: string; enrageLevel: number; nextMechanicAtMs: number }>;
    partyRaidCredits: Record<string, { creditId: string; partyId?: string; raidId?: string; contribution: number; atMs: number; lockedOutUntilMs?: number }>;
  };
}

export interface HarthmereLiveModeBackendMutationSummaryV1 {
  version: typeof HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1;
  applied: boolean;
  actionKind: HarthmereLiveModeActionKindV1;
  subsystem: HarthmereLiveModeAnySubsystemV1;
  actorId: string;
  targetId?: string;
  playerStateKey: string;
  sharedStateKeys: string[];
  warnings: string[];
  touchedModels: string[];
  buildingMaterializationPlans?: BuildingSystemAnyMaterializationPlanV1[];
}

function recordDelta(target: Record<string, number>, key: string, delta: number) {
  const safeDelta = clampLiveModeMutationDeltaV195(delta);
  target[key] = Math.max(0, (target[key] ?? 0) + safeDelta);
  if (target[key] === 0) {
    delete target[key];
  }
}

const HARTHMERE_LIVE_MODE_RESOURCE_KINDS_V1: HarthmereResourceKindV1[] = [
  "mana",
  "energy",
  "rage",
  "focus",
  "faith",
  "stamina",
  "conviction",
  "souls",
  "inspiration",
];

function clampSignedReputationV1(value: number) {
  return Math.max(-10_000, Math.min(10_000, Math.round(Number(value) || 0)));
}

function clampNotorietyV1(value: number, floor = 0) {
  return Math.max(0, Math.max(Math.round(Number(value) || 0), Math.round(floor)));
}

function defaultReputationStandingV1(): HarthmereLiveModeReputationStandingV1 {
  return { likeability: 0, legal: 0, notoriety: 0, notorietyFloor: 0 };
}

function normalizeReputationStandingV1(
  raw: Partial<HarthmereLiveModeReputationStandingV1> | undefined
): HarthmereLiveModeReputationStandingV1 {
  const floor = Math.max(0, Math.round(Number(raw?.notorietyFloor) || 0));
  return {
    likeability: clampSignedReputationV1(raw?.likeability ?? 0),
    legal: clampSignedReputationV1(raw?.legal ?? 0),
    notoriety: clampNotorietyV1(raw?.notoriety ?? 0, floor),
    notorietyFloor: floor,
  };
}

function reputationWitnessMultiplierV1(value: string | undefined) {
  switch (value) {
    case "none":
    case "no_witness":
      return 0.1;
    case "private":
      return 0.3;
    case "group":
      return 0.75;
    case "public":
    case "public_event":
      return 1;
    case "legal_record":
    case "magical_record":
      return 1.25;
    default:
      return 1;
  }
}

function applyReputationStandingDeltaV1(
  standing: HarthmereLiveModeReputationStandingV1,
  delta: {
    likeability?: number;
    legal?: number;
    notoriety?: number;
    notorietyFloor?: number;
  },
  multiplier: number
): HarthmereLiveModeReputationStandingV1 {
  const floor = Math.max(
    0,
    Math.round(standing.notorietyFloor + (delta.notorietyFloor ?? 0) * multiplier)
  );
  return {
    likeability: clampSignedReputationV1(
      standing.likeability + (delta.likeability ?? 0) * multiplier
    ),
    legal: clampSignedReputationV1(
      standing.legal + (delta.legal ?? 0) * multiplier
    ),
    notoriety: clampNotorietyV1(
      standing.notoriety + (delta.notoriety ?? 0) * multiplier,
      floor
    ),
    notorietyFloor: floor,
  };
}

function normalizeHarthmereResourceKindV1(
  value: string | undefined
): HarthmereResourceKindV1 {
  const normalized = String(value ?? "mana").trim().toLowerCase();
  if (normalized === "stamina") return "stamina";
  if (normalized === "energy") return "energy";
  if (normalized === "rage") return "rage";
  if (normalized === "focus") return "focus";
  if (normalized === "faith") return "faith";
  if (normalized === "conviction") return "conviction";
  if (normalized === "soul" || normalized === "souls") return "souls";
  if (normalized === "inspiration") return "inspiration";
  return "mana";
}

function liveModeResourceMaxV1(kind: HarthmereResourceKindV1, level: number) {
  const safeLevel = Math.max(1, Math.trunc(Number(level) || 1));
  switch (kind) {
    case "stamina":
      return 100 + safeLevel * 8;
    case "energy":
      return 100;
    case "rage":
      return 100;
    case "focus":
      return 80 + safeLevel * 5;
    case "faith":
    case "conviction":
    case "inspiration":
      return 80 + safeLevel * 8;
    case "souls":
      return 5 + Math.floor(safeLevel / 5);
    case "mana":
    default:
      return 100 + safeLevel * 10;
  }
}

function defaultCombatResourcePoolsV1(level = 1) {
  const resources: Partial<Record<HarthmereResourceKindV1, number>> = {};
  const maxResources: Partial<Record<HarthmereResourceKindV1, number>> = {};
  for (const kind of HARTHMERE_LIVE_MODE_RESOURCE_KINDS_V1) {
    const max = liveModeResourceMaxV1(kind, level);
    maxResources[kind] = max;
    resources[kind] = max;
  }
  return { resources, maxResources };
}

function ensureCombatResourcePoolsV1(state: HarthmereLiveModeBackendStateV1) {
  const level = state.classMagic.skills.character_level?.level ?? 1;
  state.combat.resources ??= {};
  state.combat.maxResources ??= {};
  for (const kind of HARTHMERE_LIVE_MODE_RESOURCE_KINDS_V1) {
    const derivedMax = liveModeResourceMaxV1(kind, level);
    const rawMax = Number(state.combat.maxResources[kind]);
    const max = Math.max(
      1,
      Number.isFinite(rawMax) && rawMax > 0 ? Math.trunc(rawMax) : derivedMax,
      derivedMax
    );
    const rawResource = Number(state.combat.resources[kind]);
    state.combat.maxResources[kind] = max;
    state.combat.resources[kind] = Math.max(
      0,
      Math.min(
        max,
        Number.isFinite(rawResource) ? Math.trunc(rawResource) : max
      )
    );
  }
  return {
    resources: state.combat.resources,
    maxResources: state.combat.maxResources,
  };
}

function restoreCombatResourcesV1(
  state: HarthmereLiveModeBackendStateV1,
  ratio: number
) {
  const pools = ensureCombatResourcePoolsV1(state);
  for (const kind of HARTHMERE_LIVE_MODE_RESOURCE_KINDS_V1) {
    const max = pools.maxResources[kind] ?? liveModeResourceMaxV1(kind, 1);
    pools.resources[kind] = Math.max(0, Math.min(max, Math.round(max * ratio)));
  }
}

let liveModeCombatCatalogueRegisteredV1 = false;

function ensureHarthmereLiveModeCombatCatalogueV1() {
  if (liveModeCombatCatalogueRegisteredV1) {
    return;
  }
  liveModeCombatCatalogueRegisteredV1 = true;

  for (const classDef of Object.values(HARTHMERE_CLASS_DEFINITIONS_V1)) {
    if (getHarthmereClassDefinitionV1(classDef.id)) {
      continue;
    }
    const resourceKind = normalizeHarthmereResourceKindV1(classDef.resource);
    registerHarthmereClassDefinitionV1({
      classId: classDef.id,
      displayName: classDef.name,
      availableSpecializations: [],
      primaryResource: resourceKind,
      maxResourceByLevel: { 1: liveModeResourceMaxV1(resourceKind, 1) },
      hpPerLevel: 20,
      baseHp: 100,
      attackPowerPerLevel: ["mage", "priest", "druid", "necromancer", "bard"].includes(classDef.id) ? 1 : 3,
      spellPowerPerLevel: ["mage", "priest", "druid", "necromancer", "bard"].includes(classDef.id) ? 4 : 1,
    });
  }

  for (const ability of Object.values(HARTHMERE_ABILITY_DEFINITIONS_V1)) {
    if (getHarthmereAbilityV1(ability.id)) {
      continue;
    }
    const resourceKind = normalizeHarthmereResourceKindV1(ability.resource);
    const isSupport =
      /heal|rejuvenation|blessing|cleanse|shield|guard|block/i.test(
        `${ability.id} ${ability.name}`
      ) && ability.kind !== "business";
    const isOffensive = ability.kind === "combat" && !isSupport;
    registerHarthmereAbilityV1({
      abilityId: ability.id,
      displayName: ability.name,
      targetType: isSupport ? "self" : isOffensive ? "single_enemy" : "self",
      classRestriction: ability.classRequirements ?? [],
      specRestriction: [],
      levelRequirement: 1,
      requiredWeaponType: "any",
      resourceKind,
      resourceCost: Math.max(0, Math.trunc(Number(ability.cost) || 0)),
      cooldownMs: Math.max(250, Math.trunc(Number(ability.cooldown) || 1) * 1000),
      sharedCooldownCategory: ability.kind === "combat" ? "global_combat" : undefined,
      sharedCooldownMs: ability.kind === "combat" ? 750 : undefined,
      rangeUnits: isSupport ? 0 : ability.kind === "combat" ? 12 : 4,
      requiresLineOfSight: isOffensive,
      allowedInSafeZone: ability.kind !== "combat",
      allowedInPvP: ability.kind === "combat",
      baseDamage: isOffensive ? 12 : 0,
      baseHealing: isSupport ? 18 : 0,
      attackPowerScaling: isOffensive ? 0.8 : 0,
      spellPowerScaling: isSupport || ["mage", "priest", "druid", "necromancer", "bard"].some((id) => ability.classRequirements?.includes(id as any)) ? 0.7 : 0,
      xpReward: isOffensive ? 20 : isSupport ? 8 : 0,
      castTimeMs: 0,
      interruptible: ability.kind === "combat",
      unlocksMilestones: [],
    });
  }
}

function abilityResourceKindForLiveModeV1(
  abilityId: string | undefined,
  classId: string | undefined
): HarthmereResourceKindV1 {
  const registered = abilityId ? getHarthmereAbilityV1(abilityId) : undefined;
  if (registered) {
    return registered.resourceKind;
  }
  const ability = abilityId ? HARTHMERE_ABILITY_DEFINITIONS_V1[abilityId] : undefined;
  if (ability) {
    return normalizeHarthmereResourceKindV1(ability.resource);
  }
  const classDef = classId ? HARTHMERE_CLASS_DEFINITIONS_V1[classId as keyof typeof HARTHMERE_CLASS_DEFINITIONS_V1] : undefined;
  return normalizeHarthmereResourceKindV1(classDef?.resource);
}

function splitCombatCooldownsV1(cooldowns: Record<string, number>) {
  const individual: Record<string, number> = {};
  const shared: Record<string, number> = {};
  for (const [key, value] of Object.entries(cooldowns ?? {})) {
    if (key.startsWith("shared:")) {
      shared[key.slice("shared:".length)] = value;
    } else {
      individual[key] = value;
    }
  }
  return { individual, shared };
}

function antiFarmRewardMultiplierV1(input: {
  repeatedFarmCount?: number;
  samePlayerKillCountWithinWindow?: number;
}) {
  const repeated = Math.max(0, Math.trunc(Number(input.repeatedFarmCount) || 0));
  const samePlayer = Math.max(0, Math.trunc(Number(input.samePlayerKillCountWithinWindow) || 0));
  const repeatedMultiplier =
    repeated <= 2 ? 1 : repeated <= 5 ? 0.5 : repeated <= 9 ? 0.25 : 0;
  const samePlayerMultiplier =
    samePlayer <= 1 ? 1 : samePlayer <= 2 ? 0.25 : 0;
  return Math.min(repeatedMultiplier, samePlayerMultiplier);
}


export function defaultHarthmereLiveModeBankingStateV1(): HarthmereLiveModeBankingStateV1 {
  return {
    accountBank: {},
    materialStorage: {},
    personalBankMaxSlots: HARTHMERE_PERSONAL_BANK_BASE_SLOTS_V1,
    accountBankMaxSlots: HARTHMERE_ACCOUNT_BANK_BASE_SLOTS_V1,
    materialStorageMaxSlots: HARTHMERE_MATERIAL_STORAGE_BASE_SLOTS_V1,
    transactionLogs: [],
    loans: {},
    nextLoanNumber: 1,
  };
}

function normalizeBankingStateV1(raw: Partial<HarthmereLiveModeBankingStateV1> | undefined): HarthmereLiveModeBankingStateV1 {
  const defaults = defaultHarthmereLiveModeBankingStateV1();
  const next = {
    ...defaults,
    ...(raw ?? {}),
    accountBank: { ...defaults.accountBank, ...(raw?.accountBank ?? {}) },
    materialStorage: { ...defaults.materialStorage, ...(raw?.materialStorage ?? {}) },
    transactionLogs: Array.isArray(raw?.transactionLogs) ? raw!.transactionLogs.slice(-100) : [],
    loans: { ...defaults.loans, ...(raw?.loans ?? {}) },
  };
  next.personalBankMaxSlots = clampBankSlotLimitV1(next.personalBankMaxSlots, HARTHMERE_PERSONAL_BANK_BASE_SLOTS_V1);
  next.accountBankMaxSlots = clampBankSlotLimitV1(next.accountBankMaxSlots, HARTHMERE_ACCOUNT_BANK_BASE_SLOTS_V1);
  next.materialStorageMaxSlots = clampBankSlotLimitV1(next.materialStorageMaxSlots, HARTHMERE_MATERIAL_STORAGE_BASE_SLOTS_V1);
  next.nextLoanNumber = Math.max(1, Math.trunc(Number(next.nextLoanNumber) || 1));
  return next;
}

function clampBankSlotLimitV1(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(fallback, Math.min(HARTHMERE_BANK_MAX_SLOTS_V1, Math.trunc(value)));
}

function countOccupiedBankSlotsV1(record: Record<string, number>) {
  return Object.values(record).filter((count) => Number(count) > 0).length;
}

function bankRecordHasCapacityV1(record: Record<string, number>, itemId: string, maxSlots: number) {
  return (record[itemId] ?? 0) > 0 || countOccupiedBankSlotsV1(record) < maxSlots;
}

function applyBankRecordDeltaV1(record: Record<string, number>, itemId: string, delta: number) {
  const nextCount = Math.max(0, (record[itemId] ?? 0) + Math.trunc(delta));
  if (nextCount <= 0) {
    delete record[itemId];
  } else {
    record[itemId] = nextCount;
  }
}

function routeLiveModeRewardOutsideBackpackV1(
  state: HarthmereLiveModeBackendStateV1,
  itemId: string | undefined,
  count: number,
  source: string,
  warnings: string[],
  touchedModels: Set<string>
) {
  if (!itemId || count <= 0) return false;
  const def = getHarthmereItemDefinitionV1(itemId);
  const category = itemCategoryFromDefinitionV1(def, itemId);
  if (category === "currency") {
    state.inventory.gold = Math.max(0, state.inventory.gold + count);
    state.economy.ledger.push({
      id: `${state.updatedAtMs}:${source}:${itemId}`,
      kind: `${source}_currency_reward`,
      amount: count,
      atMs: state.updatedAtMs,
    });
    touchedModels.add("wallet");
    touchedModels.add("economy_ledger");
    return true;
  }
  if (
    category === "materials" &&
    bankRecordHasCapacityV1(
      state.banking.materialStorage,
      itemId,
      state.banking.materialStorageMaxSlots
    )
  ) {
    applyBankRecordDeltaV1(state.banking.materialStorage, itemId, count);
    appendBankingLogV1(state, {
      kind: `${source}_material_storage_deposit`,
      vault: "materials",
      itemId,
      count,
    });
    warnings.push(`${source}_sent_to_material_storage:${itemId}`);
    touchedModels.add("material_storage");
    touchedModels.add("bank_transaction_log");
    return true;
  }
  return false;
}

function sendLiveModeRewardToOverflowV1(
  state: HarthmereLiveModeBackendStateV1,
  itemId: string | undefined,
  count: number,
  reason: string,
  warnings: string[],
  touchedModels: Set<string>
) {
  if (!itemId || count <= 0) return false;
  state.inventory.overflow.push({ itemId, count, reason });
  warnings.push(`${reason}:${itemId}`);
  touchedModels.add("inventory_overflow");
  return true;
}


function itemCategoryFromDefinitionV1(def: HarthmereItemDefinitionV1 | undefined, itemId: string) {
  const text = `${itemId} ${def?.displayName ?? ""}`.toLowerCase();
  if (def?.isCurrency) return "currency";
  if (def?.isQuestItem || def?.binding === "quest") return "quest";
  if (def?.isCraftingMaterial || isLikelyBankingMaterialItemIdV1(itemId)) return "materials";
  if (def?.isConsumable || /potion|food|ration|drink|meal|medicine/.test(text)) return "consumables";
  if (/sword|axe|pickaxe|tool|hammer|bow|staff|wand|shield|armor|helm|boots|glove/.test(text)) return "tools";
  return "item";
}

export function harthmereItemUnitWeightV1(itemId: string) {
  const def = getHarthmereItemDefinitionV1(itemId);
  const explicit = Number(
    (def as any)?.weight ??
      (def as any)?.carryWeight ??
      (def as any)?.mass ??
      def?.stats?.weight ??
      def?.stats?.carryWeight ??
      def?.stats?.mass,
  );
  if (Number.isFinite(explicit) && explicit >= 0) {
    return explicit;
  }
  const category = itemCategoryFromDefinitionV1(def, itemId);
  if (category === "currency") return 0;
  if (category === "quest") return 0.5;
  if (category === "materials") return 2;
  if (category === "tools") return 5;
  if (category === "consumables") return 1;
  return 1;
}

export function harthmereInventoryCarryWeightV1(items: Record<string, number>) {
  return Object.entries(items ?? {}).reduce((sum, [itemId, count]) => {
    const safeCount = Math.max(0, Math.trunc(Number(count) || 0));
    return sum + harthmereItemUnitWeightV1(itemId) * safeCount;
  }, 0);
}

function wouldExceedCarryWeightV1(
  items: Record<string, number>,
  itemId: string | undefined,
  count: number,
) {
  if (!itemId || count <= 0) {
    return false;
  }
  const nextWeight = harthmereInventoryCarryWeightV1(items) + harthmereItemUnitWeightV1(itemId) * Math.max(1, Math.trunc(count));
  return nextWeight > HARTHMERE_CARRY_WEIGHT_LIMIT_V1;
}

function wouldCraftExceedCarryWeightV1(
  items: Record<string, number>,
  recipe: HarthmereCraftingRecipeV1 | undefined,
  craftCount = 1,
) {
  if (!recipe) {
    return false;
  }
  const count = Math.max(1, Math.trunc(craftCount));
  const projected = { ...items };
  for (const input of recipe.inputs) {
    applyBankRecordDeltaV1(projected, input.itemId, -input.count * count);
  }
  applyBankRecordDeltaV1(projected, recipe.outputItemId, recipe.outputCount * count);
  return harthmereInventoryCarryWeightV1(projected) > HARTHMERE_CARRY_WEIGHT_LIMIT_V1;
}

function pushCarryWeightRejectionV1(
  warnings: string[],
  touchedModels: Set<string>,
  source: string,
) {
  warnings.push(`${source}_rejected:carry_weight_limit_exceeded`);
  touchedModels.add("inventory_weight_rejection");
}

function clearBankCreditHoldIfSettledV1(state: HarthmereLiveModeBackendStateV1, nowMs: number) {
  const hasUnpaidLoan = Object.values(state.banking.loans).some((loan) =>
    (loan.status === "active" || loan.status === "defaulted") &&
      activeLoanBalanceV1(loan, nowMs).totalRemaining > 0,
  );
  if (!hasUnpaidLoan) {
    delete state.law.flags[HARTHMERE_BANK_CREDIT_HOLD_FLAG_V1];
  }
}

export function applyHarthmereBankLoanConsequencesV1(
  state: HarthmereLiveModeBackendStateV1,
  nowMs: number,
): { changed: boolean; defaultedLoanIds: string[] } {
  let changed = false;
  const defaultedLoanIds: string[] = [];
  for (const loan of Object.values(state.banking.loans)) {
    if (loan.status !== "active") {
      continue;
    }
    const balance = activeLoanBalanceV1(loan, nowMs);
    if (!balance.overdue || balance.totalRemaining <= 0) {
      continue;
    }
    loan.status = "defaulted";
    loan.defaultedAtMs = loan.defaultedAtMs ?? nowMs;
    loan.defaultPenaltyGold = Math.max(
      loan.defaultPenaltyGold ?? 0,
      Math.ceil(loan.principalRemaining * HARTHMERE_LOAN_DEFAULT_PENALTY_RATE_V1),
    );
    loan.penaltyPaid = loan.penaltyPaid ?? 0;
    if (!loan.creditPenaltyApplied) {
      loan.creditPenaltyApplied = true;
      state.law.flags[HARTHMERE_BANK_CREDIT_HOLD_FLAG_V1] = true;
      state.law.reputation["harthmere_bank_credit"] =
        (state.law.reputation["harthmere_bank_credit"] ?? 0) - 100;
      appendBankingLogV1(state, {
        kind: "bank_loan_defaulted",
        vault: "loan",
        loanId: loan.loanId,
        goldDelta: -(loan.defaultPenaltyGold ?? 0),
      });
    }
    defaultedLoanIds.push(loan.loanId);
    changed = true;
  }
  return { changed, defaultedLoanIds };
}

function appendBankingLogV1(
  state: HarthmereLiveModeBackendStateV1,
  entry: Omit<HarthmereBankingTransactionLogV1, "id" | "actorId" | "atMs" | "balanceAfter">
) {
  const log: HarthmereBankingTransactionLogV1 = {
    id: `bank_log_${state.actorId}_${state.updatedAtMs}_${state.banking.transactionLogs.length + 1}`,
    actorId: state.actorId,
    atMs: state.updatedAtMs,
    balanceAfter: state.inventory.gold,
    ...entry,
  };
  state.banking.transactionLogs = [...state.banking.transactionLogs, log].slice(-100);
  state.economy.ledger.push({
    id: log.id,
    kind: log.kind,
    amount: log.goldDelta ?? 0,
    atMs: log.atMs,
  });
}

function humanizeHarthmereItemIdV1(itemId: string) {
  const foodName = HARTHMERE_FOOD_DEFINITIONS_V1[itemId]?.displayName;
  if (foodName) return foodName;
  const seedName = HARTHMERE_SEED_DEFINITIONS_V1[itemId]?.displayName;
  if (seedName) return seedName;
  const tail = itemId.split("/").filter(Boolean).pop() ?? itemId;
  const trimmed = tail.length > 24 ? `${tail.slice(0, 10)}…${tail.slice(-6)}` : tail;
  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function isLikelyBankingMaterialItemIdV1(itemId: string) {
  return /(ore|wood|log|stone|clay|fiber|hide|meat|herb|mushroom|ingot|shard|crystal|sand|salt|grain|cloth|coal|copper|iron|silver|gold|exotic|matter|resource|material)/i.test(itemId);
}

function ensureLiveModeItemDefinitionV1(
  itemId: string,
  snapshot: Pick<HarthmereInventorySnapshotV1, "items" | "bank">
): HarthmereItemDefinitionV1 | undefined {
  const existing = getHarthmereItemDefinitionV1(itemId);
  if (existing) return existing;
  const knownCount = (snapshot.items[itemId] ?? 0) + (snapshot.bank[itemId] ?? 0);
  if (knownCount <= 0) return undefined;
  const isSeed = !!HARTHMERE_SEED_DEFINITIONS_V1[itemId];
  const isFood = !!HARTHMERE_FOOD_DEFINITIONS_V1[itemId];
  const isMaterial = isSeed || isLikelyBankingMaterialItemIdV1(itemId);
  const def: HarthmereItemDefinitionV1 = {
    itemId,
    displayName: humanizeHarthmereItemIdV1(itemId),
    maxStackSize: isMaterial ? 9999 : 999,
    baseValue: 0,
    binding: "none",
    isQuestItem: false,
    isCurrency: false,
    isConsumable: isFood,
    isCraftingMaterial: isMaterial,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: {},
    tradeable: true,
  };
  registerHarthmereItemDefinitionV1(def);
  return def;
}

function liveModeGuildItemUnitGoldValueV1(
  itemId: string | undefined,
  snapshot: Pick<HarthmereInventorySnapshotV1, "items" | "bank">
) {
  if (!itemId) return undefined;
  const def = ensureLiveModeItemDefinitionV1(itemId, snapshot) ?? getHarthmereItemDefinitionV1(itemId);
  return Math.max(1, Math.trunc(Number(def?.baseValue ?? 1)));
}

function bankUpgradeCostV1(kind: HarthmereBankingVaultKindV1, currentSlots: number) {
  const base = kind === "materials"
    ? HARTHMERE_MATERIAL_STORAGE_BASE_SLOTS_V1
    : kind === "account"
      ? HARTHMERE_ACCOUNT_BANK_BASE_SLOTS_V1
      : HARTHMERE_PERSONAL_BANK_BASE_SLOTS_V1;
  const upgradeNumber = Math.max(0, Math.floor((currentSlots - base) / HARTHMERE_BANK_SLOT_UPGRADE_SIZE_V1));
  return 100 + upgradeNumber * 75;
}

function normalizeBankVaultKindV1(value: string | undefined): HarthmereBankingVaultKindV1 {
  if (value === "account") return "account";
  if (value === "materials" || value === "material") return "materials";
  return "personal";
}

function activeLoanBalanceV1(loan: HarthmereBankingLoanV1, nowMs: number) {
  const boundedRegularEndMs = Math.min(nowMs, loan.dueAtMs);
  const regularInterestDays = Math.max(
    0,
    Math.ceil((boundedRegularEndMs - loan.openedAtMs) / HARTHMERE_LOAN_DAY_MS_V1),
  );
  const lateDays = Math.max(
    0,
    Math.ceil((nowMs - loan.dueAtMs) / HARTHMERE_LOAN_DAY_MS_V1),
  );
  const regularInterest = Math.ceil(
    loan.principalRemaining * loan.dailyInterestRate * regularInterestDays,
  );
  const lateInterest = Math.ceil(
    loan.principalRemaining *
      loan.dailyInterestRate *
      HARTHMERE_LOAN_LATE_INTEREST_MULTIPLIER_V1 *
      lateDays,
  );
  const interestRemaining = Math.max(
    0,
    regularInterest + lateInterest - (loan.interestPaid ?? 0),
  );
  const defaultPenaltyRemaining = Math.max(
    0,
    (loan.defaultPenaltyGold ?? 0) - (loan.penaltyPaid ?? 0),
  );
  return {
    elapsedDays: regularInterestDays + lateDays,
    regularInterestDays,
    lateDays,
    interestRemaining,
    defaultPenaltyRemaining,
    totalRemaining: loan.principalRemaining + interestRemaining + defaultPenaltyRemaining,
    overdue: nowMs > loan.dueAtMs,
    creditHold: loan.status === "defaulted" && defaultPenaltyRemaining + loan.principalRemaining + interestRemaining > 0,
  };
}

export function createHarthmereLiveModeBankingClientSnapshotV1(
  state: HarthmereLiveModeBackendStateV1
) {
  const activeLoans = Object.values(state.banking.loans).map((loan) => ({
    ...loan,
    balance: activeLoanBalanceV1(loan, state.updatedAtMs),
  }));
  return {
    actorId: state.actorId,
    gold: state.inventory.gold,
    carryWeight: {
      current: harthmereInventoryCarryWeightV1(state.inventory.items),
      max: HARTHMERE_CARRY_WEIGHT_LIMIT_V1,
      overLimit: harthmereInventoryCarryWeightV1(state.inventory.items) > HARTHMERE_CARRY_WEIGHT_LIMIT_V1,
    },
    creditHold: !!state.law.flags[HARTHMERE_BANK_CREDIT_HOLD_FLAG_V1],
    personalVault: {
      items: state.inventory.bank,
      maxSlots: state.banking.personalBankMaxSlots,
      usedSlots: countOccupiedBankSlotsV1(state.inventory.bank),
    },
    accountVault: {
      items: state.banking.accountBank,
      maxSlots: state.banking.accountBankMaxSlots,
      usedSlots: countOccupiedBankSlotsV1(state.banking.accountBank),
    },
    materialStorage: {
      items: state.banking.materialStorage,
      maxSlots: state.banking.materialStorageMaxSlots,
      usedSlots: countOccupiedBankSlotsV1(state.banking.materialStorage),
    },
    loans: activeLoans,
    transactionLogs: state.banking.transactionLogs.slice(-50),
    nextUpgradeCosts: {
      personal: bankUpgradeCostV1("personal", state.banking.personalBankMaxSlots),
      account: bankUpgradeCostV1("account", state.banking.accountBankMaxSlots),
      materials: bankUpgradeCostV1("materials", state.banking.materialStorageMaxSlots),
    },
  };
}

export function createHarthmereProgressionClientSnapshotFromBackendV1(
  state: HarthmereLiveModeBackendStateV1
) {
  return createHarthmereProgressionClientSnapshotV1({
    actorId: state.actorId,
    classMagic: state.classMagic,
    economy: state.economy.production,
    collections: state.collections,
  });
}

function liveModeResourceLabelV1(kind: HarthmereResourceKindV1) {
  return kind
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function liveModePrimaryStandingV1(state: HarthmereLiveModeBackendStateV1) {
  const candidates = [
    "harthmere",
    "harthmere_grove",
    "the_grove",
    "harthmere_wilderness",
  ];
  const scopeId =
    candidates.find((id) => state.law.standing[id] !== undefined) ??
    Object.keys(state.law.standing)[0] ??
    "harthmere";
  return {
    scopeId,
    standing: normalizeReputationStandingV1(state.law.standing[scopeId]),
  };
}

export function createHarthmereLiveModePlayerStatusClientSnapshotV1(
  state: HarthmereLiveModeBackendStateV1
) {
  const pools = ensureCombatResourcePoolsV1(state);
  const classId = state.classMagic.classId ?? "warrior";
  const classDef =
    HARTHMERE_CLASS_DEFINITIONS_V1[
      classId as keyof typeof HARTHMERE_CLASS_DEFINITIONS_V1
    ];
  const primaryResource = abilityResourceKindForLiveModeV1(undefined, classId);
  const characterLevel = state.classMagic.skills.character_level ?? {
    xp: 0,
    level: 1,
  };
  const characterProgress = harthmereSkillProgressFromTotalXpV1(
    "character_level",
    characterLevel.xp
  );
  const standing = liveModePrimaryStandingV1(state);
  return {
    version: "harthmere-live-mode-player-status-v1",
    actorId: state.actorId,
    classId,
    className: classDef?.name ?? classId,
    level: Math.max(
      characterProgress.level,
      Math.trunc(Number(characterLevel.level ?? 1))
    ),
    xp: {
      total: Math.max(0, Math.trunc(Number(characterLevel.xp ?? 0))),
      current: characterProgress.xp,
      next: characterProgress.nextLevel,
    },
    combat: {
      hp: Math.max(0, Math.trunc(Number(state.combat.hp ?? 0))),
      maxHp: Math.max(1, Math.trunc(Number(state.combat.maxHp ?? 1))),
      deathState: state.combat.deathState ?? "alive",
      primaryResource,
      primaryResourceLabel: liveModeResourceLabelV1(primaryResource),
      resource: Math.max(0, Math.trunc(Number(pools.resources[primaryResource] ?? 0))),
      maxResource: Math.max(1, Math.trunc(Number(pools.maxResources[primaryResource] ?? 1))),
      resources: { ...pools.resources },
      maxResources: { ...pools.maxResources },
    },
    standing: {
      scopeId: standing.scopeId,
      ...standing.standing,
      legacyReputation: clampSignedReputationV1(
        state.law.reputation[standing.scopeId] ??
          state.law.reputation.harthmere ??
          0
      ),
    },
    recentReputationEvents: (state.law.recentReputationEvents ?? []).slice(0, 10),
    gold: Math.max(0, Math.trunc(Number(state.inventory.gold ?? 0))),
    updatedAtMs: state.updatedAtMs,
  };
}

function payloadString(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  key: string
) {
  const value = envelope.payload[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function payloadNumber(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  key: string
) {
  const value = envelope.payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function payloadPositiveWholeCountV1(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  key = "count",
  fallback = 1
) {
  const value = payloadNumber(envelope, key);
  if (value === undefined) {
    return fallback;
  }
  if (value < 1 || Math.trunc(value) !== value) {
    return undefined;
  }
  return value;
}

function clampLiveModeMutationDeltaV195(delta: number) {
  if (!Number.isFinite(delta)) {
    return 0;
  }
  const wholeDelta = Math.trunc(delta);
  return Math.max(-250, Math.min(250, wholeDelta));
}

function payloadRecord(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  key: string
) {
  const value = envelope.payload[key];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function payloadBoolean(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  key: string
) {
  const value = envelope.payload[key];
  return typeof value === "boolean" ? value : undefined;
}

function isServerAuthorityEnvelopeV1(envelope: HarthmereLiveModeAuthorityEnvelopeV1) {
  return envelope.source !== "client_request";
}

function actorWorldPositionFromAuthorityV1(envelope: HarthmereLiveModeAuthorityEnvelopeV1) {
  if (envelope.serverActorPosition) {
    return envelope.serverActorPosition;
  }
  if (!isServerAuthorityEnvelopeV1(envelope)) {
    return undefined;
  }
  const x = payloadNumber(envelope, "actorX") ?? payloadNumber(envelope, "x");
  const y = payloadNumber(envelope, "actorY") ?? payloadNumber(envelope, "y");
  const z = payloadNumber(envelope, "actorZ") ?? payloadNumber(envelope, "z");
  return x === undefined || y === undefined || z === undefined ? undefined : { x, y, z };
}

function distanceSq3V1(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function buildingProjectIdForPlotV1(plotId: string) {
  return `project_${plotId}`;
}

function buildingPropertyIdForPlotV1(plotId: string) {
  return `property_${plotId}`;
}

function isBuildingSystemStageV1(stage: string | undefined): stage is BuildingSystemStageV1 {
  return BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1.includes(stage as any);
}

function nextBuildingSystemStageV1(stage: BuildingSystemStageV1): BuildingSystemStageV1 {
  const index = BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1.indexOf(stage as any);
  if (index < 0) {
    return "completed";
  }
  return BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1[index + 1] ?? "completed";
}

function normalizeMaterialContributionPayloadV1(
  record: Record<string, unknown> | undefined
): Record<string, number> | undefined {
  if (!record) {
    return undefined;
  }
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(record)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      out[key] = Math.trunc(numeric);
    }
  }
  return out;
}

function allBuildingMaterialsCompleteV1(
  required: Record<string, number> | undefined,
  contributed: Record<string, number>
) {
  return Object.entries(required ?? {}).every(
    ([material, count]) => (contributed[material] ?? 0) >= count
  );
}

function normalizePermissionSubjectV1(
  subject: string | undefined
): BuildingSystemPermissionSubjectV1 | undefined {
  if (subject === "owner" || subject === "friends_guests" || subject === "guild_members" || subject === "public") {
    return subject;
  }
  return undefined;
}

function normalizePermissionKeyV1(
  permission: string | undefined
): BuildingSystemPermissionKeyV1 | undefined {
  if (permission === "storage_access" || permission === "build_edit" || permission === "demolition" || permission === "transfer_sale") {
    return permission;
  }
  return undefined;
}

function normalizeAccessModeV1(mode: string | undefined): BuildingSystemAccessModeV1 | undefined {
  if (mode === "private" || mode === "friends" || mode === "guild" || mode === "public") {
    return mode;
  }
  return undefined;
}

function getOwnedPropertyForMutationV1(input: {
  properties: Record<string, BuildingSystemPropertyRecordV1>;
  propertyId: string;
  actorId: string;
  nowMs: number;
  warnings: string[];
  touchedModels: Set<string>;
}) {
  const raw = input.properties[input.propertyId];
  if (!raw) {
    input.warnings.push("property_rejected:not_found");
    input.touchedModels.add("property_rejection");
    return undefined;
  }
  const lifecycle = applyBuildingSystemPropertyLifecycleV1({ property: raw, nowMs: input.nowMs });
  input.properties[input.propertyId] = lifecycle.property;
  for (const warning of lifecycle.warnings) {
    input.warnings.push(warning);
  }
  if (lifecycle.taxDeltaGold > 0) {
    input.touchedModels.add("property_tax");
  }
  if (lifecycle.repairDecayDelta > 0) {
    input.touchedModels.add("property_repair_decay");
  }
  if (lifecycle.property.ownerId !== input.actorId) {
    input.warnings.push("property_rejected:not_owner");
    input.touchedModels.add("property_rejection");
    return undefined;
  }
  if (lifecycle.property.abandoned) {
    input.warnings.push("property_rejected:abandoned");
    input.touchedModels.add("property_rejection");
    return undefined;
  }
  return lifecycle.property;
}

function computePropertyTierValueV1(property: BuildingSystemPropertyRecordV1) {
  return Math.max(property.value + 25, Math.floor(property.value * 1.5));
}



function syncBuildingSystemPhysicalAccessRecordsV1(input: {
  state: HarthmereLiveModeBackendStateV1;
  property: BuildingSystemPropertyRecordV1;
  plotId?: string;
  nowMs: number;
}) {
  const plot = buildingSystemPlotByIdV1(input.property.plotId ?? input.plotId);
  const blueprint = buildingSystemBlueprintByIdV1(input.property.blueprintId);
  if (!plot || !blueprint) return;
  const storage = createBuildingSystemStorageContainerV1({
    property: input.property,
    plot,
    blueprint,
    nowMs: input.nowMs,
  });
  const door = createBuildingSystemDoorLockV1({
    property: input.property,
    plot,
    blueprint,
    nowMs: input.nowMs,
  });
  input.state.building.storageContainers[storage.containerId] = storage;
  input.state.building.doorLocks[door.lockId] = door;
  input.state.building.inWorldMarkers[storage.containerId] = {
    markerId: storage.containerId,
    plotId: plot.plotId,
    kind: "storage_container",
    position: storage.position,
    label: `${input.property.propertyId} storage`,
    createdAtMs: input.nowMs,
  };
  input.state.building.inWorldMarkers[door.lockId] = {
    markerId: door.lockId,
    plotId: plot.plotId,
    kind: "door_lock",
    position: door.position,
    label: `${input.property.propertyId} door lock`,
    createdAtMs: input.nowMs,
  };
}

function removeBuildingSystemPhysicalAccessRecordsV1(input: {
  state: HarthmereLiveModeBackendStateV1;
  property: BuildingSystemPropertyRecordV1;
}) {
  if (input.property.storageContainerId) {
    delete input.state.building.storageContainers[input.property.storageContainerId];
    delete input.state.building.inWorldMarkers[input.property.storageContainerId];
  }
  if (input.property.doorLockId) {
    delete input.state.building.doorLocks[input.property.doorLockId];
    delete input.state.building.inWorldMarkers[input.property.doorLockId];
  }
}

function applyItemDeltas(
  target: Record<string, number>,
  deltas: Record<string, unknown> | undefined
) {
  if (!deltas) {
    return;
  }
  for (const [itemId, rawDelta] of Object.entries(deltas)) {
    if (typeof rawDelta === "number" && Number.isFinite(rawDelta)) {
      recordDelta(target, itemId, rawDelta);
    }
  }
}

function applyDirectInventoryItemPayloadV148(
  target: Record<string, number>,
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  options: { includePrimaryItem: boolean }
) {
  let applied = false;

  if (options.includePrimaryItem) {
    const itemId = payloadString(envelope, "itemId");
    const count = payloadPositiveWholeCountV1(envelope);
    if (itemId && count !== undefined) {
      recordDelta(target, itemId, count);
      applied = true;
    }
  }

  const itemDeltas = payloadRecord(envelope, "itemDeltas");
  if (itemDeltas) {
    for (const rawDelta of Object.values(itemDeltas)) {
      if (typeof rawDelta === "number" && Number.isFinite(rawDelta)) {
        applied = true;
        break;
      }
    }
    applyItemDeltas(target, itemDeltas);
  }

  return applied;
}


function wouldDirectInventoryPayloadExceedCarryWeightV1(
  items: Record<string, number>,
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  options: { includePrimaryItem: boolean },
) {
  const projected = { ...items };
  let touched = false;
  if (options.includePrimaryItem) {
    const itemId = payloadString(envelope, "itemId");
    const count = payloadPositiveWholeCountV1(envelope);
    if (itemId && count !== undefined) {
      applyBankRecordDeltaV1(projected, itemId, count);
      touched = true;
    }
  }
  const itemDeltas = payloadRecord(envelope, "itemDeltas");
  if (itemDeltas) {
    for (const [itemId, rawDelta] of Object.entries(itemDeltas)) {
      if (typeof rawDelta === "number" && Number.isFinite(rawDelta)) {
        applyBankRecordDeltaV1(projected, itemId, rawDelta);
        touched = true;
      }
    }
  }
  return touched && harthmereInventoryCarryWeightV1(projected) > HARTHMERE_CARRY_WEIGHT_LIMIT_V1;
}

function upsertSkill(
  target: Record<string, { xp: number; level: number }>,
  skillId: string,
  xpDelta: number
) {
  const def = HARTHMERE_SKILL_DEFINITIONS_V1[skillId];
  if (!def) {
    return { ok: false, warning: `skill_xp_rejected:unknown_skill:${skillId}` };
  }
  const current = target[skillId] ?? { xp: 0, level: 1 };
  if (!Number.isFinite(xpDelta) || xpDelta <= 0) {
    return { ok: false, warning: "skill_xp_rejected:invalid_xp_delta" };
  }
  const xp = Math.min(
    harthmereSkillTotalXpCapV1(skillId),
    Math.max(0, Math.trunc(Number(current.xp ?? 0)) + Math.trunc(xpDelta))
  );
  target[skillId] = {
    xp,
    level: Math.max(
      1,
      Math.min(
        def.maxLevel,
        Math.max(Number(current.level ?? 1), harthmereSkillLevelFromTotalXpV1(skillId, xp))
      )
    ),
  };
  if (target[skillId].level >= def.maxLevel && xpDelta > 0) {
    return { ok: true, warning: `skill_xp_capped:max_level:${skillId}` };
  }
  return { ok: true };
}

export function harthmereLiveModePlayerStateKeyV1(actorId: string) {
  return `harthmere:live_mode:v1:player_state:${actorId}`;
}

export function harthmereLiveModeLedgerStreamKeyV1(actorId: string) {
  return `harthmere:live_mode:v1:ledger:${actorId}`;
}

export function harthmereLiveModeSharedStateKeyV1(
  kind: string,
  id: string
) {
  return `harthmere:live_mode:v1:${kind}:${id}`;
}

export function defaultHarthmereLiveModeBackendStateV1(
  actorId: string,
  nowMs: number
): HarthmereLiveModeBackendStateV1 {
  return {
    version: HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1,
    actorId,
    updatedAtMs: nowMs,
    inventory: {
      items: {},
      bank: {},
      equipment: {},
      overflow: [],
      gold: 0,
      escrow: {},
      consumableCooldowns: {},
    },
    economy: {
      ledger: [],
      vendorTransactions: {},
      auctionListings: {},
      houseTaxAccumulated: 0,
      businesses: {},
      businessRevenueAccumulated: 0,
      production: defaultHarthmereProductionEconomyStateV1(),
    },
    jobsBoard: defaultHarthmereJobsBoardStateV1(nowMs),
    inventoryLoot: createHarthmereEmptyInventoryLootStateV1(),
    respec: {
      count: 0,
    },
    talents: {
      nodes: [],
      pointsSpent: 0,
    },
    building: {
      placedStructures: {},
      ownedPlots: [],
      safeZones: {},
      activeProjects: {},
      // HARTHMERE_JOBS_BOARD_GROVE_PLACEMENT_V141:
      // The Grove fountain center is [496, ~70, -126]; (4, 6) lands the
      // posting board on the east edge of the plaza, on the same tile as the
      // Jobs Board voxel kiosk placement in the client. Keeping
      // the live backend marker position aligned with the client landmark
      // means the server-authoritative "is the player near the board?"
      // proximity check uses the same coordinate the player sees.
      //
      // HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN_V141:
      // Second posting board lives in Harthmere's market district near the
      // Harthmere Market Office landmark. Same kiosk asset, different
      // townId/regionId so the proximity check and jobs-board mutations
      // route to the correct board.
      inWorldMarkers: {
        harthmere_grove_market_jobs_board: {
          markerId: "harthmere_grove_market_jobs_board",
          plotId: "harthmere_market_posting_board",
          kind: "npc_board",
          position: [501.59, 70, -133.35],
          label: "Jobs Board",
          createdAtMs: nowMs,
        },
        harthmere_town_market_jobs_board: {
          markerId: "harthmere_town_market_jobs_board",
          plotId: "harthmere_town_market_posting_board",
          kind: "npc_board",
          position: [1046, 66, -202],
          label: "Harthmere Town Jobs Board",
          createdAtMs: nowMs,
        },
      },
      materializationPlans: {},
      storageContainers: {},
      doorLocks: {},
    },
    guild: defaultHarthmereLiveModeGuildStateV1(),
    banking: defaultHarthmereLiveModeBankingStateV1(),
    law: {
      reputation: {},
      standing: {},
      recentReputationEvents: [],
      fines: {},
      flags: {},
      crimeLog: [],
    },
    classMagic: {
      knownAbilities: [],
      knownRecipes: [],
      skills: {},
      magicSchools: {},
      loadout: {},
      faith: {},
      respecCount: 0,
    },
    collections: defaultHarthmereProgressionCollectionsStateV1(),
    quests: {
      active: {
        [HARTHMERE_READ_JOBS_BOARD_QUEST_ID_V140]: {
          stepId: HARTHMERE_READ_JOBS_BOARD_STEP_ID_V140,
          progress: 0,
        },
        [BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1.questId]: {
          stepId: BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1.stepId,
          progress: 0,
        },
      },
      completed: {},
    },
    property: {
      owned: {},
      buildingProgress: {},
    },
    farming: {
      plots: {},
      harvests: {},
    },
    mail: {
      messages: {},
    },
    careLoops: defaultHarthmereCareLoopStateV1(actorId, nowMs),
    combat: {
      hp: 100,
      maxHp: 100,
      ...defaultCombatResourcePoolsV1(1),
      cooldowns: {},
      deathState: "alive",
      deathRecords: {},
      respawnProtectionUntilMs: undefined,
      threat: {},
      lootClaims: {},
      entitySnapshots: {},
      npcAiTicks: {},
      bossTicks: {},
      partyRaidCredits: {},
    },
  };
}

export function parseHarthmereLiveModeBackendStateV1(
  raw: string | null | undefined,
  actorId: string,
  nowMs: number
): HarthmereLiveModeBackendStateV1 {
  if (!raw) {
    return defaultHarthmereLiveModeBackendStateV1(actorId, nowMs);
  }
  try {
    const parsed = JSON.parse(raw) as HarthmereLiveModeBackendStateV1;
    const defaults = defaultHarthmereLiveModeBackendStateV1(actorId, nowMs);
    return {
      ...defaults,
      ...parsed,
      actorId,
      version: HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1,
      inventory: { ...defaults.inventory, ...(parsed.inventory ?? {}) },
      economy: {
        ...defaults.economy,
        ...(parsed.economy ?? {}),
        businesses: {
          ...defaults.economy.businesses,
          ...((parsed.economy as any)?.businesses ?? {}),
        },
        production: normalizeHarthmereProductionEconomyStateV1((parsed.economy as any)?.production),
      },
      jobsBoard: normalizeHarthmereJobsBoardStateV1((parsed as any).jobsBoard, nowMs),
      inventoryLoot: normalizeHarthmereInventoryLootStateV1((parsed as any).inventoryLoot),
      guild: normalizeHarthmereLiveModeGuildStateV1((parsed as any).guild, nowMs),
      banking: normalizeBankingStateV1((parsed as any).banking),
      law: {
        ...defaults.law,
        ...(parsed.law ?? {}),
        reputation: {
          ...defaults.law.reputation,
          ...((parsed.law as any)?.reputation ?? {}),
        },
        standing: Object.fromEntries(
          Object.entries({
            ...defaults.law.standing,
            ...(((parsed.law as any)?.standing ?? {}) as Record<string, unknown>),
          }).map(([scopeId, raw]) => [
            scopeId,
            normalizeReputationStandingV1(raw as Partial<HarthmereLiveModeReputationStandingV1>),
          ])
        ),
        recentReputationEvents: Array.isArray((parsed.law as any)?.recentReputationEvents)
          ? (parsed.law as any).recentReputationEvents.slice(-50)
          : [],
        fines: {
          ...defaults.law.fines,
          ...((parsed.law as any)?.fines ?? {}),
        },
        flags: {
          ...defaults.law.flags,
          ...((parsed.law as any)?.flags ?? {}),
        },
        crimeLog: Array.isArray((parsed.law as any)?.crimeLog)
          ? (parsed.law as any).crimeLog.slice(-100)
          : [],
      },
      classMagic: { ...defaults.classMagic, ...(parsed.classMagic ?? {}) },
      collections: normalizeHarthmereProgressionCollectionsStateV1((parsed as any).collections),
      quests: { ...defaults.quests, ...(parsed.quests ?? {}) },
      property: {
        ...defaults.property,
        ...(parsed.property ?? {}),
        owned: Object.fromEntries(
          Object.entries({
            ...defaults.property.owned,
            ...(((parsed.property as any)?.owned ?? {}) as Record<string, unknown>),
          }).map(([propertyId, raw]) => [
            propertyId,
            normalizeBuildingSystemPropertyRecordV1({
              propertyId,
              raw,
              ownerId: actorId,
              nowMs,
            }),
          ])
        ),
        buildingProgress: {
          ...defaults.property.buildingProgress,
          ...((parsed.property as any)?.buildingProgress ?? {}),
        },
      },
      farming: { ...defaults.farming, ...(parsed.farming ?? {}) },
      mail: {
        ...defaults.mail,
        ...((parsed as any).mail ?? {}),
        messages: {
          ...defaults.mail.messages,
          ...(((parsed as any).mail?.messages ?? {}) as Record<string, any>),
        },
      },
      careLoops: normalizeHarthmereCareLoopStateV1((parsed as any).careLoops, actorId, nowMs),
      combat: {
        ...defaults.combat,
        ...(parsed.combat ?? {}),
        resources: {
          ...defaults.combat.resources,
          ...(((parsed.combat as any)?.resources ?? {}) as Record<string, number>),
        },
        maxResources: {
          ...defaults.combat.maxResources,
          ...(((parsed.combat as any)?.maxResources ?? {}) as Record<string, number>),
        },
        deathRecords: {
          ...defaults.combat.deathRecords,
          ...(((parsed.combat as any)?.deathRecords ?? {}) as Record<string, any>),
        },
        threat: {
          ...defaults.combat.threat,
          ...(((parsed.combat as any)?.threat ?? {}) as Record<string, number>),
        },
        lootClaims: {
          ...defaults.combat.lootClaims,
          ...(((parsed.combat as any)?.lootClaims ?? {}) as Record<string, number>),
        },
        entitySnapshots: {
          ...defaults.combat.entitySnapshots,
          ...(((parsed.combat as any)?.entitySnapshots ?? {}) as Record<string, any>),
        },
        npcAiTicks: {
          ...defaults.combat.npcAiTicks,
          ...(((parsed.combat as any)?.npcAiTicks ?? {}) as Record<string, any>),
        },
        bossTicks: {
          ...defaults.combat.bossTicks,
          ...(((parsed.combat as any)?.bossTicks ?? {}) as Record<string, any>),
        },
        partyRaidCredits: {
          ...defaults.combat.partyRaidCredits,
          ...(((parsed.combat as any)?.partyRaidCredits ?? {}) as Record<string, any>),
        },
      },
      respec: { ...defaults.respec, ...(parsed.respec ?? {}) },
      talents: { ...defaults.talents, ...(parsed.talents ?? {}) },
      building: {
        ...defaults.building,
        ...(parsed.building ?? {}),
        placedStructures: {
          ...defaults.building.placedStructures,
          ...((parsed.building as any)?.placedStructures ?? {}),
        },
        ownedPlots: [
          ...new Set([
            ...defaults.building.ownedPlots,
            ...(((parsed.building as any)?.ownedPlots ?? []) as string[]),
          ]),
        ],
        safeZones: {
          ...defaults.building.safeZones,
          ...((parsed.building as any)?.safeZones ?? {}),
        },
        activeProjects: {
          ...defaults.building.activeProjects,
          ...((parsed.building as any)?.activeProjects ?? {}),
        },
        inWorldMarkers: {
          ...defaults.building.inWorldMarkers,
          ...((parsed.building as any)?.inWorldMarkers ?? {}),
        },
        materializationPlans: {
          ...defaults.building.materializationPlans,
          ...((parsed.building as any)?.materializationPlans ?? {}),
        },
        storageContainers: {
          ...defaults.building.storageContainers,
          ...((parsed.building as any)?.storageContainers ?? {}),
        },
        doorLocks: {
          ...defaults.building.doorLocks,
          ...((parsed.building as any)?.doorLocks ?? {}),
        },
      },
    };
  } catch {
    return defaultHarthmereLiveModeBackendStateV1(actorId, nowMs);
  }
}

export function createHarthmereLiveModeGuildClientSnapshotFromBackendV1(
  state: HarthmereLiveModeBackendStateV1
) {
  return createHarthmereLiveModeGuildClientSnapshotV1(state.guild, state.actorId);
}

export function createHarthmereInventoryLootClientSnapshotFromBackendV1(
  state: HarthmereLiveModeBackendStateV1
) {
  if (!state.inventoryLoot.actors[state.actorId]) {
    state.inventoryLoot.actors[state.actorId] = createHarthmereInventoryLootActorV1(state.actorId, {
      gold: state.inventory.gold,
      items: { ...state.inventory.items },
      bank: { ...state.inventory.bank },
      equipment: { ...state.inventory.equipment },
    });
  } else {
    const actor = state.inventoryLoot.actors[state.actorId];
    actor.gold = state.inventory.gold;
    actor.items = { ...state.inventory.items };
    actor.bank = { ...state.inventory.bank };
    actor.equipment = { ...state.inventory.equipment };
  }
  return {
    ...createHarthmereInventoryLootClientSnapshotV1(state.inventoryLoot, state.actorId),
    overflow: state.inventory.overflow.map((entry) => ({ ...entry })),
    materialStorage: {
      items: { ...state.banking.materialStorage },
      maxSlots: state.banking.materialStorageMaxSlots,
      usedSlots: countOccupiedBankSlotsV1(state.banking.materialStorage),
    },
  };
}

export function createHarthmereProductionEconomyClientSnapshotFromBackendV1(
  state: HarthmereLiveModeBackendStateV1
) {
  return createHarthmereProductionEconomyClientSnapshotV1(
    state.economy.production,
    state.actorId,
  );
}

export function createHarthmereJobsBoardClientSnapshotFromBackendV1(
  state: HarthmereLiveModeBackendStateV1
) {
  const snapshot = createHarthmereJobsBoardClientSnapshotV1(state.jobsBoard, state.actorId);
  const myBusinesses = Object.values(state.economy.production.businesses)
    .filter((business) =>
      business.ownerKind === "player" && business.ownerId === state.actorId
    )
    .map((business) => ({
      businessId: business.businessId,
      typeId: business.typeId,
      name: business.name,
      balanceGold: business.balanceGold,
      inventory: business.inventory,
    }));
  return {
    ...snapshot,
    walletGold: state.inventory.gold,
    inventoryItems: state.inventory.items,
    discoveredCollectibles: state.collections.discovered,
    myBusinesses,
  };
}

export function createHarthmereCareLoopClientSnapshotFromBackendV1(
  state: HarthmereLiveModeBackendStateV1,
  nowMs: number = state.updatedAtMs,
): HarthmereCareLoopClientSnapshotV1 {
  return createHarthmereCareLoopClientSnapshotV1(state.careLoops, nowMs);
}

export function createHarthmereLiveModeBuildingClientSnapshotV1(
  state: HarthmereLiveModeBackendStateV1
) {
  return {
    actorId: state.actorId,
    gold: state.inventory.gold,
    inventoryItems: state.inventory.items,
    ownedPlotIds: state.building.ownedPlots,
    safeZones: state.building.safeZones,
    activeProjects: state.building.activeProjects,
    placedStructureIds: Object.values(state.building.placedStructures)
      .map((entry) => entry.plotId)
      .filter((plotId): plotId is string => typeof plotId === "string"),
    placedStructures: state.building.placedStructures,
    completedProperties: state.property.owned,
    buildingProgress: state.property.buildingProgress,
    inWorldMarkers: state.building.inWorldMarkers,
    storageContainers: state.building.storageContainers,
    doorLocks: state.building.doorLocks,
    businesses: state.economy.businesses,
  };
}

export function reduceHarthmereLiveModeBackendStateV1(
  state: HarthmereLiveModeBackendStateV1,
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  nowMs: number
): {
  state: HarthmereLiveModeBackendStateV1;
  summary: HarthmereLiveModeBackendMutationSummaryV1;
} {
  const next: HarthmereLiveModeBackendStateV1 = JSON.parse(
    JSON.stringify(state)
  );
  next.updatedAtMs = nowMs;
  const touchedModels = new Set<string>();
  const sharedStateKeys = new Set<string>();
  const warnings: string[] = [];
  const buildingMaterializationPlans: BuildingSystemAnyMaterializationPlanV1[] = [];
  const playerStateKey = harthmereLiveModePlayerStateKeyV1(envelope.actorId);

  const loanConsequenceResult = applyHarthmereBankLoanConsequencesV1(next, nowMs);
  if (loanConsequenceResult.changed) {
    warnings.push(...loanConsequenceResult.defaultedLoanIds.map((loanId) => `bank_loan_defaulted:${loanId}`));
    touchedModels.add("bank_loan_consequence");
    touchedModels.add("bank_transaction_log");
    touchedModels.add("law_flags");
    touchedModels.add("law_reputation");
  }

  ensureBuildingSystemStructureDefinitionsV1();
  ensureHarthmereLiveModeCombatCatalogueV1();
  ensureCombatResourcePoolsV1(next);

  // ---------------------------------------------------------------------------
  // Inventory snapshot helper — project current state into the authority type
  // ---------------------------------------------------------------------------
  function buildInventorySnapshot(): HarthmereInventorySnapshotV1 {
    return {
      actorId: next.actorId,
      gold: next.inventory.gold,
      equipment: { ...next.inventory.equipment },
      items: { ...next.inventory.items },
      bank: { ...next.inventory.bank },
      materialStorage: { ...next.banking.materialStorage },
      escrow: { ...(next.inventory.escrow ?? {}) },
      consumableCooldowns: { ...(next.inventory.consumableCooldowns ?? {}) },
      knownAbilities: [...next.classMagic.knownAbilities],
      knownRecipes: [...next.classMagic.knownRecipes],
    };
  }

  // ---------------------------------------------------------------------------
  // Combat actor snapshot helper
  // ---------------------------------------------------------------------------
  function buildActorSnapshot(abilityId?: string): HarthmereCombatActorSnapshotV1 {
    const resourceKind = abilityResourceKindForLiveModeV1(
      abilityId,
      next.classMagic.classId
    );
    const pools = ensureCombatResourcePoolsV1(next);
    const cooldowns = splitCombatCooldownsV1(next.combat.cooldowns);
    return {
      actorId: next.actorId,
      classId: next.classMagic.classId ?? "warrior",
      specializationId: next.classMagic.specializationId ?? "none",
      level: next.classMagic.skills["character_level"]?.level ?? 1,
      hp: next.combat.hp,
      maxHp: next.combat.maxHp,
      resource: pools.resources[resourceKind] ?? 0,
      maxResource: pools.maxResources[resourceKind] ?? 1,
      resourceKind,
      cooldowns: cooldowns.individual,
      sharedCooldowns: cooldowns.shared,
      knownAbilities: Array.from(knownHarthmereAbilityIdsV1(next.classMagic)),
      equippedAbilities: Object.values(next.classMagic.loadout).filter(Boolean) as string[],
      activeTalentNodes: [...(next.talents?.nodes ?? [])],
      mainHandWeaponType: "sword",
      offHandWeaponType: "none",
      deathState: next.combat.deathState ?? "alive",
      position: { x: 0, y: 0, z: 0 },
      pvpFlagged: next.law.flags["pvp_flagged"] ?? false,
      legalFlags: { ...next.law.flags },
    };
  }

  // ---------------------------------------------------------------------------
  // Zone snapshot helper — resolves from envelope.zoneId
  // ---------------------------------------------------------------------------
  function buildZoneSnapshot(): HarthmereZoneSnapshotV1 {
    const safeZones = ["harthmere_town_square", "harthmere_temple", "harthmere_market"];
    const isSafe = safeZones.some((z) => envelope.zoneId.includes(z));
    return {
      zoneId: envelope.zoneId,
      pvpRule: isSafe ? "safe_zone" : "contested",
      isSafeZone: isSafe,
      allowPvP: !isSafe,
      activeLegalSystem: true,
    };
  }

  // ---------------------------------------------------------------------------
  // Legacy goldDelta — kept for non-authority mutations only
  // (authority mutations compute their own gold deltas via the authority modules)
  // ---------------------------------------------------------------------------
  const AUTHORITY_ACTION_KINDS = new Set<string>([
    "request_attack",
    "request_ability_cast",
    "request_vendor_transaction",
    "request_auction_post",
    "request_auction_settle",
    "request_bank_transaction",
    "request_crafting",
    "request_inventory_mutation",
    "request_respec",
    "request_loadout_change",
    "request_property_building_mutation",
    "request_guild_mutation",
    "request_economy_mutation",
  ]);

  if (!AUTHORITY_ACTION_KINDS.has(envelope.actionKind)) {
    const goldDelta =
      payloadNumber(envelope, "goldDelta") ??
      payloadNumber(envelope, "currencyDelta") ??
      0;
    if (goldDelta !== 0) {
      next.inventory.gold = Math.max(0, next.inventory.gold + goldDelta);
      next.economy.ledger.push({
        id: envelope.requestId,
        kind: envelope.actionKind,
        amount: goldDelta,
        atMs: nowMs,
      });
      touchedModels.add("wallet");
      touchedModels.add("economy_ledger");
    }
  }

  switch (envelope.actionKind) {
    // -----------------------------------------------------------------------
    // COMBAT — fully server-authoritative via mmo_combat_authority_v1
    // -----------------------------------------------------------------------
    case "request_attack":
    case "request_ability_cast": {
      const abilityId =
        payloadString(envelope, "abilityId") ?? "basic_strike";
      const actor = buildActorSnapshot(abilityId);
      const zone = buildZoneSnapshot();

      const authoritativeTarget = envelope.targetId
        ? next.combat.entitySnapshots[envelope.targetId]
        : undefined;
      if (envelope.targetId && !authoritativeTarget) {
        warnings.push("combat_rejected:target_state_not_authoritative");
        touchedModels.add("combat_rejection");
        break;
      }

      const target: HarthmereCombatTargetSnapshotV1 | undefined =
        envelope.targetId && authoritativeTarget
          ? {
              targetId: envelope.targetId,
              isHostile: authoritativeTarget.isHostile,
              isAlive: authoritativeTarget.isAlive,
              isAttackable: authoritativeTarget.isAttackable,
              hp: authoritativeTarget.hp,
              maxHp: authoritativeTarget.maxHp,
              position: authoritativeTarget.position,
              pvpFlagged: authoritativeTarget.pvpFlagged ?? false,
              isPlayer: authoritativeTarget.isPlayer ?? false,
              zonePvPRule: authoritativeTarget.zonePvPRule ?? zone.pvpRule,
            }
          : undefined;

      const combatReq: HarthmereCombatActionRequestV1 = {
        requestId: envelope.requestId,
        kind: "ability_cast",
        actorId: envelope.actorId,
        targetId: envelope.targetId,
        abilityId,
        nowMs,
      };

      const combatResult = reduceHarthmereCombatActionV1(combatReq, {
        actor,
        target,
        zone,
        respecCount: next.respec?.count ?? 0,
        lastRespecAtMs: next.respec?.lastRespecAtMs,
        actorGold: next.inventory.gold,
        talentPointsAvailable: Math.max(
          0,
          (next.classMagic.skills["character_level"]?.level ?? 1) -
            1 -
            (next.talents?.pointsSpent ?? 0)
        ),
      });

      if (!combatResult.ok) {
        warnings.push(...combatResult.errors.map((e) => `combat_rejected:${e}`));
        touchedModels.add("combat_rejection");
        break;
      }

      // Apply server-computed cooldowns
      for (const [key, expiresAt] of Object.entries(combatResult.newCooldowns)) {
        next.combat.cooldowns[key] = expiresAt;
      }
      for (const [key, expiresAt] of Object.entries(combatResult.newSharedCooldowns)) {
        next.combat.cooldowns[`shared:${key}`] = expiresAt;
      }

      // Resource cost. Health is not a casting resource.
      const resourceKind = abilityResourceKindForLiveModeV1(
        abilityId,
        next.classMagic.classId
      );
      ensureCombatResourcePoolsV1(next).resources[resourceKind] = Math.max(
        0,
        combatResult.actorResourceAfter
      );

      if (authoritativeTarget && combatResult.damage > 0) {
        authoritativeTarget.hp = Math.max(
          0,
          authoritativeTarget.hp - combatResult.damage
        );
        if (authoritativeTarget.hp <= 0) {
          authoritativeTarget.isAlive = false;
        }
      }

      if (combatResult.healing > 0) {
        if (!envelope.targetId || envelope.targetId === next.actorId) {
          next.combat.hp = Math.min(
            next.combat.maxHp,
            next.combat.hp + combatResult.healing
          );
        } else if (authoritativeTarget) {
          authoritativeTarget.hp = Math.min(
            authoritativeTarget.maxHp,
            authoritativeTarget.hp + combatResult.healing
          );
          authoritativeTarget.isAlive = authoritativeTarget.hp > 0;
        }
      }

      // Threat
      if (envelope.targetId && combatResult.damage > 0) {
        next.combat.threat[envelope.targetId] =
          (next.combat.threat[envelope.targetId] ?? 0) + combatResult.damage;
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("entity_combat", envelope.targetId)
        );
      }

      // Skill XP rewards meaningful participation, while kill XP rewards the
      // target defeat through the character-level path below.
      if (combatResult.damage > 0 || combatResult.healing > 0) {
        const skillProgress = upsertSkill(
          next.classMagic.skills,
          "combat",
          Math.max(1, combatResult.skillXpDelta)
        );
        if (skillProgress.warning) warnings.push(skillProgress.warning);
      }

      if (combatResult.killsTarget && envelope.targetId) {
        const xp = computeHarthmereXpRewardV1({
          actorLevel: next.classMagic.skills["character_level"]?.level ?? 1,
          targetLevel: authoritativeTarget?.level ?? 1,
          baseXp: combatResult.xpDelta,
          contributionScore: 1,
          antiFarmMultiplier: antiFarmRewardMultiplierV1({
            repeatedFarmCount: payloadNumber(envelope, "repeatedFarmCount"),
            samePlayerKillCountWithinWindow: payloadNumber(envelope, "samePlayerKillCountWithinWindow"),
          }),
          restedXpPool: 0,
        });
        if (xp.xpReward > 0) {
          const levelProgress = upsertSkill(
            next.classMagic.skills,
            "character_level",
            xp.xpReward
          );
          if (levelProgress.warning) warnings.push(levelProgress.warning);
        } else {
          warnings.push("combat_xp_suppressed:anti_farm_or_grey_content");
        }
      }

      touchedModels.add("combat_state");
      touchedModels.add("combat_resources");
      touchedModels.add("threat");
      touchedModels.add("cooldown");
      break;
    }

    // -----------------------------------------------------------------------
    // MAGIC progress (separate from ability cast — for spell school leveling)
    // -----------------------------------------------------------------------
    case "request_magic_progress": {
      const abilityId = payloadString(envelope, "abilityId") ?? "unknown_ability";
      const schoolId = payloadString(envelope, "magicSchoolId") ?? "general_magic";
      // Validate ability is known before crediting school XP
      if (!next.classMagic.knownAbilities.includes(abilityId)) {
        warnings.push("magic_progress_rejected:ability_not_known");
        touchedModels.add("magic_rejection");
        break;
      }
      const xpDelta = Math.max(0, Math.min(1000, payloadNumber(envelope, "skillXpDelta") ?? 1));
      const school = next.classMagic.magicSchools[schoolId] ?? {
        xp: 0,
        level: 1,
        illegal: false,
      };
      school.xp += xpDelta;
      school.level = Math.max(school.level, 1 + Math.floor(school.xp / 1000));
      school.illegal =
        school.illegal || payloadString(envelope, "legalStatus") === "illegal";
      next.classMagic.magicSchools[schoolId] = school;
      next.combat.cooldowns[abilityId] = nowMs + Math.max(250, payloadNumber(envelope, "cooldownMs") ?? 1000);
      touchedModels.add("magic_progression");
      touchedModels.add("cooldown");
      break;
    }

    // -----------------------------------------------------------------------
    // EQUIPMENT change — authority-validated
    // -----------------------------------------------------------------------
    case "request_equipment_change": {
      const slot = payloadString(envelope, "slot") ?? "main_hand";
      const itemId = payloadString(envelope, "itemId");
      if (itemId) {
        // Ownership check: item must be in inventory (server verifies)
        if (next.inventory.items[itemId] === undefined) {
          warnings.push("equipment_rejected:item_not_in_inventory");
          touchedModels.add("equipment_rejection");
        } else {
          next.inventory.equipment[slot] = itemId;
          next.classMagic.loadout[slot] = itemId;
          touchedModels.add("equipment_slots");
          touchedModels.add("loadout");
        }
      } else {
        warnings.push("equipment_request_missing_item_id");
      }
      break;
    }

    // -----------------------------------------------------------------------
    // LOADOUT change — authority-validated via combat module
    // -----------------------------------------------------------------------
    case "request_loadout_change": {
      const slot = payloadString(envelope, "slot");
      const abilityId = payloadString(envelope, "abilityId");
      if (slot && abilityId) {
        if (!HARTHMERE_ABILITY_DEFINITIONS_V1[abilityId]) {
          warnings.push("loadout_rejected:unknown_ability");
          touchedModels.add("loadout_rejection");
          break;
        }
        if (!knownHarthmereAbilityIdsV1(next.classMagic).has(abilityId)) {
          warnings.push("loadout_rejected:ability_not_known");
          touchedModels.add("loadout_rejection");
          break;
        }
        const numericSlot = /^[0-7]$/.test(slot) ? `slot_${slot}` : undefined;
        const normalizedSlot = /^slot_[0-7]$/.test(slot) ? slot : numericSlot;
        if (!normalizedSlot) {
          warnings.push("loadout_rejected:malformed_slot");
          touchedModels.add("loadout_rejection");
          break;
        }
        next.classMagic.loadout[normalizedSlot] = abilityId;
        touchedModels.add("loadout");
        break;
      }
      const newLoadout = envelope.payload.newLoadout as string[] | undefined;
      if (!Array.isArray(newLoadout)) {
        warnings.push("loadout_rejected:missing_new_loadout_array");
        touchedModels.add("loadout_rejection");
        break;
      }
      const actor = buildActorSnapshot();
      const loadoutReq: HarthmereCombatActionRequestV1 = {
        requestId: envelope.requestId,
        kind: "loadout_change",
        actorId: envelope.actorId,
        nowMs,
        newLoadout,
      };
      const loadoutResult = reduceHarthmereCombatActionV1(loadoutReq, {
        actor,
        zone: buildZoneSnapshot(),
        respecCount: next.respec?.count ?? 0,
        lastRespecAtMs: next.respec?.lastRespecAtMs,
        actorGold: next.inventory.gold,
        talentPointsAvailable: 0,
      });
      if (!loadoutResult.ok) {
        warnings.push(...loadoutResult.errors.map((e) => `loadout_rejected:${e}`));
        touchedModels.add("loadout_rejection");
        break;
      }
      next.classMagic.loadout = {};
      loadoutResult.newEquippedAbilities
        .slice(0, 8)
        .forEach((abilityId, index) => {
          next.classMagic.loadout[`slot_${index}`] = abilityId;
        });
      touchedModels.add("loadout");
      break;
    }

    // -----------------------------------------------------------------------
    // XP / skill progress
    // -----------------------------------------------------------------------
    case "request_xp_reward":
    case "request_skill_progress": {
      const skillId =
        payloadString(envelope, "skillId") ??
        (envelope.actionKind === "request_xp_reward" ? "character_level" : "combat");
      if (!HARTHMERE_SKILL_DEFINITIONS_V1[skillId]) {
        warnings.push(`skill_xp_rejected:unknown_skill:${skillId}`);
        touchedModels.add("skill_xp_rejection");
        break;
      }
      if (payloadBoolean(envelope, "isAfk") === true) {
        warnings.push(`${envelope.actionKind}_rejected:afk_loop`);
        touchedModels.add("skill_xp_rejection");
        break;
      }
      const baseXp = payloadNumber(envelope, "baseXp");
      const sourceLevel = payloadNumber(envelope, "sourceLevel");
      const actorLevel = next.classMagic.skills.character_level?.level ?? 1;
      if (
        sourceLevel !== undefined &&
        actorLevel - Math.max(1, Math.trunc(sourceLevel)) >= 10
      ) {
        warnings.push(`${envelope.actionKind}_rejected:grey_content_no_progress`);
        touchedModels.add("skill_xp_rejection");
        break;
      }
      const contributionScore = Math.max(
        0,
        Math.min(1, payloadNumber(envelope, "contributionScore") ?? 1)
      );
      const difficulty = Math.max(1, payloadNumber(envelope, "difficulty") ?? 1);
      const successState = payloadString(envelope, "successState") ?? "success";
      if (baseXp === undefined && sourceLevel === undefined) {
        warnings.push(`${envelope.actionKind}_rejected:missing_server_reward_source`);
        touchedModels.add("skill_xp_rejection");
        break;
      }
      const boundedBaseXp = Math.max(
        0,
        Math.min(1000, Math.trunc(baseXp ?? difficulty * 10))
      );
      const xpDelta =
        envelope.actionKind === "request_xp_reward"
          ? computeHarthmereXpRewardV1({
              actorLevel,
              targetLevel: Math.max(1, Math.trunc(sourceLevel ?? 1)),
              baseXp: boundedBaseXp,
              contributionScore,
              antiFarmMultiplier: antiFarmRewardMultiplierV1({
                repeatedFarmCount: payloadNumber(envelope, "repeatedFarmCount"),
                samePlayerKillCountWithinWindow: payloadNumber(envelope, "samePlayerKillCountWithinWindow"),
              }),
              restedXpPool: 0,
            }).xpReward
          : Math.round(
              boundedBaseXp *
                contributionScore *
                (successState === "success" ? 1 : 0.25)
            );
      if (xpDelta <= 0) {
        warnings.push(`${envelope.actionKind}_rejected:no_progress_to_award`);
        touchedModels.add("skill_xp_rejection");
        break;
      }
      const skillProgress = upsertSkill(next.classMagic.skills, skillId, xpDelta);
      if (!skillProgress.ok) {
        warnings.push(skillProgress.warning ?? "skill_xp_rejected");
        touchedModels.add("skill_xp_rejection");
        break;
      }
      if (skillProgress.warning) warnings.push(skillProgress.warning);
      touchedModels.add("skill_xp");
      break;
    }

    // -----------------------------------------------------------------------
    // LOOT — server grants items (contribution validated by loot pipeline)
    // -----------------------------------------------------------------------
    case "request_loot_claim":
    case "request_loot_roll":
    case "request_inventory_mutation": {
      if (envelope.actionKind === "request_inventory_mutation" && !isServerAuthorityEnvelopeV1(envelope)) {
        warnings.push("inventory_rejected:admin_authority_required");
        touchedModels.add("inventory_rejection");
        break;
      }
      const invReq: HarthmereInventoryMutationRequestV1 = {
        requestId: envelope.requestId,
        actorId: envelope.actorId,
        kind:
          envelope.actionKind === "request_inventory_mutation"
            ? "admin_grant"
            : "pickup_item",
        nowMs,
        itemId: payloadString(envelope, "itemId"),
        count: payloadPositiveWholeCountV1(envelope),
      };
      if (invReq.itemId && invReq.count === undefined) {
        warnings.push(`${envelope.actionKind === "request_inventory_mutation" ? "inventory" : "loot"}_rejected:invalid_count`);
        touchedModels.add(envelope.actionKind === "request_inventory_mutation" ? "inventory_rejection" : "loot_rejection");
        break;
      }
      const snapshot = buildInventorySnapshot();
      const rewardSource = envelope.actionKind === "request_inventory_mutation" ? "inventory" : "loot";
      const hasDirectItemDeltas = !!payloadRecord(envelope, "itemDeltas");
      if (
        invReq.itemId &&
        !hasDirectItemDeltas &&
        routeLiveModeRewardOutsideBackpackV1(
          next,
          invReq.itemId,
          invReq.count ?? 1,
          rewardSource,
          warnings,
          touchedModels
        )
      ) {
        next.combat.lootClaims[envelope.requestId] = nowMs;
        touchedModels.add("loot_claims");
        break;
      }
      if (
        envelope.actionKind === "request_inventory_mutation"
          ? wouldDirectInventoryPayloadExceedCarryWeightV1(snapshot.items, envelope, { includePrimaryItem: true })
          : wouldExceedCarryWeightV1(snapshot.items, invReq.itemId, invReq.count ?? 1)
      ) {
        pushCarryWeightRejectionV1(warnings, touchedModels, envelope.actionKind === "request_inventory_mutation" ? "inventory" : "loot");
        break;
      }
      const invResult = reduceHarthmereInventoryMutationV1(invReq, {
        snapshot,
        playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
        playerSkills: next.classMagic.skills,
        reputation: next.law.reputation,
      });
      if (invResult.ok) {
        const updated = applyHarthmereInventoryMutationResultV1(snapshot, invResult);
        next.inventory.items = updated.items;
        next.inventory.gold = updated.gold;
        next.inventory.escrow = updated.escrow;
        next.inventory.consumableCooldowns = updated.consumableCooldowns;
        if (
          envelope.actionKind === "request_inventory_mutation" &&
          applyDirectInventoryItemPayloadV148(next.inventory.items, envelope, {
            includePrimaryItem: false,
          })
        ) {
          touchedModels.add("inventory_items");
        }
        next.combat.lootClaims[envelope.requestId] = nowMs;
        touchedModels.add("inventory_items");
        touchedModels.add("loot_claims");
      } else {
        if (
          invResult.errors.some((error) =>
            error === "inventory_full" ||
            error === "stack_size_exceeded" ||
            error === "inventory_full_or_stack_exceeded"
          ) &&
          sendLiveModeRewardToOverflowV1(
            next,
            invReq.itemId,
            invReq.count ?? 1,
            `${rewardSource}_sent_to_overflow`,
            warnings,
            touchedModels
          )
        ) {
          next.combat.lootClaims[envelope.requestId] = nowMs;
          touchedModels.add("loot_claims");
          break;
        }
        warnings.push(...invResult.errors.map((e) => `${envelope.actionKind === "request_inventory_mutation" ? "inventory" : "loot"}_rejected:${e}`));
        touchedModels.add(envelope.actionKind === "request_inventory_mutation" ? "inventory_rejection" : "loot_rejection");
      }
      break;
    }

    // -----------------------------------------------------------------------
    // VENDOR — fully authority-validated via inventory module
    // -----------------------------------------------------------------------
    case "request_vendor_transaction": {
      const vendorId = payloadString(envelope, "vendorId") ?? "unknown_vendor";
      const transactionKind = payloadString(envelope, "transactionKind") ?? "buy";
      const vendorItemId = payloadString(envelope, "itemId");

      if (!vendorItemId) {
        const vendorGoldDelta =
          payloadNumber(envelope, "goldDelta") ??
          payloadNumber(envelope, "currencyDelta") ??
          0;
        if (vendorGoldDelta < 0) {
          next.inventory.gold = Math.max(0, next.inventory.gold + vendorGoldDelta);
          next.economy.ledger.push({
            id: envelope.requestId,
            kind: `vendor_${transactionKind}`,
            amount: vendorGoldDelta,
            atMs: nowMs,
          });
          touchedModels.add("wallet");
          touchedModels.add("economy_ledger");
        }
        next.economy.vendorTransactions[vendorId] =
          (next.economy.vendorTransactions[vendorId] ?? 0) + 1;
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("vendor", vendorId));
        touchedModels.add("vendor_stock");
        warnings.push("vendor_transaction_recorded_without_item_id");
        break;
      }

      const snapshot = buildInventorySnapshot();
      const vendorCount = payloadPositiveWholeCountV1(envelope);
      if (vendorCount === undefined) {
        warnings.push("vendor_rejected:invalid_count");
        touchedModels.add("vendor_rejection");
        break;
      }
      if (transactionKind !== "sell" && wouldExceedCarryWeightV1(snapshot.items, vendorItemId, vendorCount)) {
        pushCarryWeightRejectionV1(warnings, touchedModels, "vendor");
        break;
      }
      const invReq: HarthmereInventoryMutationRequestV1 = {
        requestId: envelope.requestId,
        actorId: envelope.actorId,
        kind: transactionKind === "sell" ? "sell_to_vendor" : "buy_from_vendor",
        nowMs,
        itemId: vendorItemId,
        count: vendorCount,
        vendorId,
      };
      const invResult = reduceHarthmereInventoryMutationV1(invReq, {
        snapshot,
        playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
        playerSkills: next.classMagic.skills,
        reputation: next.law.reputation,
      });
      if (invResult.ok) {
        const updated = applyHarthmereInventoryMutationResultV1(snapshot, invResult);
        next.inventory.items = updated.items;
        next.inventory.gold = updated.gold;
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: `vendor_${transactionKind}`,
          amount: invResult.goldDelta,
          atMs: nowMs,
        });
        next.economy.vendorTransactions[vendorId] =
          (next.economy.vendorTransactions[vendorId] ?? 0) + 1;
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("vendor", vendorId));
        touchedModels.add("vendor_stock");
        touchedModels.add("wallet");
        touchedModels.add("inventory_items");
      } else {
        warnings.push(...invResult.errors.map((e) => `vendor_rejected:${e}`));
        touchedModels.add("vendor_rejection");
      }
      break;
    }

    // -----------------------------------------------------------------------
    // AUCTION POST — fully authority-validated with escrow
    // -----------------------------------------------------------------------
    case "request_auction_post": {
      const snapshot = buildInventorySnapshot();
      const auctionReq: HarthmereAuctionMutationRequestV1 = {
        requestId: envelope.requestId,
        kind: "post_listing",
        actorId: envelope.actorId,
        nowMs,
        itemId: payloadString(envelope, "itemId"),
        count: payloadPositiveWholeCountV1(envelope),
        suggestedUnitPrice: payloadNumber(envelope, "unitPrice") ?? undefined,
      };
      if (auctionReq.itemId && auctionReq.count === undefined) {
        warnings.push("auction_post_rejected:invalid_count");
        touchedModels.add("auction_post_rejection");
        break;
      }
      const auctionResult = reduceHarthmereAuctionMutationV1(auctionReq, {
        actorSnapshot: snapshot,
      });
      if (auctionResult.ok && auctionResult.listing) {
        // Apply escrow and fee
        const listingId = auctionResult.listing.listingId;
        next.economy.auctionListings[listingId] = auctionResult.listing;
        next.inventory.escrow = { ...next.inventory.escrow };
        const itemId = auctionResult.listing.itemId;
        next.inventory.escrow[itemId] =
          (next.inventory.escrow[itemId] ?? 0) + auctionResult.sellerEscrowDelta;
        if (next.inventory.escrow[itemId] <= 0) {
          delete next.inventory.escrow[itemId];
        }
        next.inventory.gold = Math.max(0, next.inventory.gold + auctionResult.sellerGoldDelta);
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: "auction_listing_fee",
          amount: auctionResult.sellerGoldDelta,
          atMs: nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("auction_listing", listingId)
        );
        touchedModels.add("auction_listing");
        touchedModels.add("inventory_escrow");
        touchedModels.add("wallet");
      } else {
        warnings.push(...auctionResult.errors.map((e) => `auction_post_rejected:${e}`));
        touchedModels.add("auction_post_rejection");
      }
      break;
    }

    // -----------------------------------------------------------------------
    // AUCTION SETTLE (buy) — fully authority-validated, atomic transfer
    // -----------------------------------------------------------------------
    case "request_auction_settle": {
      const listingId = payloadString(envelope, "listingId") ?? envelope.requestId;
      const currentListing = next.economy.auctionListings[listingId] as HarthmereAuctionListingV1 | undefined;
      const buyerSnapshot = buildInventorySnapshot();
      if (currentListing && wouldExceedCarryWeightV1(buyerSnapshot.items, currentListing.itemId, currentListing.count)) {
        pushCarryWeightRejectionV1(warnings, touchedModels, "auction_settle");
        break;
      }
      const auctionReq: HarthmereAuctionMutationRequestV1 = {
        requestId: envelope.requestId,
        kind: "buy_listing",
        actorId: envelope.actorId,
        nowMs,
        listingId,
      };
      const auctionResult = reduceHarthmereAuctionMutationV1(auctionReq, {
        actorSnapshot: buyerSnapshot,
        buyerSnapshot,
        currentListing,
        buyerInventorySlots: Object.keys(buyerSnapshot.items).length,
      });
      if (auctionResult.ok && auctionResult.listing) {
        next.economy.auctionListings[listingId] = auctionResult.listing;
        // Buyer receives item
        const itemId = auctionResult.listing.itemId;
        const itemCount = auctionResult.listing.count;
        recordDelta(next.inventory.items, itemId, auctionResult.buyerItemDelta);
        next.inventory.gold = Math.max(0, next.inventory.gold + auctionResult.buyerGoldDelta);
        // House tax accumulates
        next.economy.houseTaxAccumulated =
          (next.economy.houseTaxAccumulated ?? 0) + auctionResult.houseTaxGoldDelta;
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: "auction_sale",
          amount: auctionResult.buyerGoldDelta,
          atMs: nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("auction_listing", listingId)
        );
        // Seller's escrow release is a shared-state write (handled via event)
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("seller_account", auctionResult.listing.sellerId)
        );
        touchedModels.add("auction_listing");
        touchedModels.add("inventory_items");
        touchedModels.add("wallet");
        touchedModels.add("economy_ledger");
        touchedModels.add("house_tax");
        void itemCount; // referenced for completeness
      } else {
        warnings.push(...auctionResult.errors.map((e) => `auction_settle_rejected:${e}`));
        touchedModels.add("auction_settle_rejection");
      }
      break;
    }

    // -----------------------------------------------------------------------
    // BANK — authority-validated via inventory module
    // -----------------------------------------------------------------------
    case "request_bank_transaction": {
      const operation = payloadString(envelope, "operation") ?? payloadString(envelope, "direction") ?? "deposit";
      const itemId = payloadString(envelope, "itemId");
      const count = payloadPositiveWholeCountV1(envelope);
      const vaultKind = normalizeBankVaultKindV1(payloadString(envelope, "vaultKind"));
      sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("bank", next.actorId));
      if (itemId && count === undefined) {
        warnings.push("bank_rejected:invalid_count");
        touchedModels.add("bank_rejection");
        break;
      }

      if (operation === "deposit" || operation === "withdraw") {
        const snapshot = buildInventorySnapshot();
        if (itemId) {
          ensureLiveModeItemDefinitionV1(itemId, snapshot);
        }
        const isDeposit = operation !== "withdraw";
        if (!isDeposit && wouldExceedCarryWeightV1(next.inventory.items, itemId, count ?? 1)) {
          pushCarryWeightRejectionV1(warnings, touchedModels, "bank_withdraw");
          break;
        }
        if (isDeposit && itemId && !bankRecordHasCapacityV1(next.inventory.bank, itemId, next.banking.personalBankMaxSlots)) {
          warnings.push("bank_rejected:bank_full");
          touchedModels.add("bank_rejection");
          break;
        }
        const bankReq: HarthmereInventoryMutationRequestV1 = {
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          kind: isDeposit ? "transfer_to_bank" : "withdraw_from_bank",
          nowMs,
          bankItemId: itemId,
          bankCount: count ?? 1,
        };
        const bankResult = reduceHarthmereInventoryMutationV1(bankReq, {
          snapshot,
          playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
          playerSkills: next.classMagic.skills,
          reputation: next.law.reputation,
        });
        if (bankResult.ok) {
          const updated = applyHarthmereInventoryMutationResultV1(snapshot, bankResult);
          next.inventory.items = updated.items;
          next.inventory.bank = updated.bank;
          appendBankingLogV1(next, {
            kind: isDeposit ? "personal_bank_deposit" : "personal_bank_withdraw",
            vault: "personal",
            itemId,
            count: count ?? 1,
          });
          touchedModels.add("bank_storage");
          touchedModels.add("inventory_items");
          touchedModels.add("bank_transaction_log");
        } else {
          warnings.push(...bankResult.errors.map((e) => `bank_rejected:${e}`));
          touchedModels.add("bank_rejection");
        }
        break;
      }

      if (operation === "upgrade_slots") {
        const currentSlots = vaultKind === "account"
          ? next.banking.accountBankMaxSlots
          : vaultKind === "materials"
            ? next.banking.materialStorageMaxSlots
            : next.banking.personalBankMaxSlots;
        if (currentSlots >= HARTHMERE_BANK_MAX_SLOTS_V1) {
          warnings.push("bank_rejected:max_slots_reached");
          touchedModels.add("bank_rejection");
          break;
        }
        const cost = bankUpgradeCostV1(vaultKind, currentSlots);
        if (next.inventory.gold < cost) {
          warnings.push("bank_rejected:not_enough_gold_for_slot_upgrade");
          touchedModels.add("bank_rejection");
          break;
        }
        next.inventory.gold -= cost;
        if (vaultKind === "account") next.banking.accountBankMaxSlots += HARTHMERE_BANK_SLOT_UPGRADE_SIZE_V1;
        else if (vaultKind === "materials") next.banking.materialStorageMaxSlots += HARTHMERE_BANK_SLOT_UPGRADE_SIZE_V1;
        else next.banking.personalBankMaxSlots += HARTHMERE_BANK_SLOT_UPGRADE_SIZE_V1;
        appendBankingLogV1(next, {
          kind: "bank_slot_upgrade",
          vault: vaultKind,
          goldDelta: -cost,
        });
        touchedModels.add("bank_slots");
        touchedModels.add("wallet");
        touchedModels.add("bank_transaction_log");
        break;
      }

      if (operation === "account_deposit" || operation === "account_withdraw") {
        if (!itemId) {
          warnings.push("bank_rejected:missing_item_id");
          touchedModels.add("bank_rejection");
          break;
        }
        const transferCount = count ?? 1;
        const snapshot = buildInventorySnapshot();
        const def = ensureLiveModeItemDefinitionV1(itemId, snapshot);
        if (!def || def.isQuestItem || def.binding === "quest") {
          warnings.push(def ? "bank_rejected:cannot_account_bank_quest_item" : "bank_rejected:unknown_item_id");
          touchedModels.add("bank_rejection");
          break;
        }
        const isDeposit = operation === "account_deposit";
        if (isDeposit) {
          if ((next.inventory.items[itemId] ?? 0) < transferCount) {
            warnings.push("bank_rejected:insufficient_item_count");
            touchedModels.add("bank_rejection");
            break;
          }
          if (!bankRecordHasCapacityV1(next.banking.accountBank, itemId, next.banking.accountBankMaxSlots)) {
            warnings.push("bank_rejected:account_bank_full");
            touchedModels.add("bank_rejection");
            break;
          }
          applyBankRecordDeltaV1(next.inventory.items, itemId, -transferCount);
          applyBankRecordDeltaV1(next.banking.accountBank, itemId, transferCount);
        } else {
          if ((next.banking.accountBank[itemId] ?? 0) < transferCount) {
            warnings.push("bank_rejected:insufficient_account_bank_item_count");
            touchedModels.add("bank_rejection");
            break;
          }
          if (wouldExceedCarryWeightV1(next.inventory.items, itemId, transferCount)) {
            pushCarryWeightRejectionV1(warnings, touchedModels, "account_bank_withdraw");
            break;
          }
          applyBankRecordDeltaV1(next.banking.accountBank, itemId, -transferCount);
          applyBankRecordDeltaV1(next.inventory.items, itemId, transferCount);
        }
        appendBankingLogV1(next, {
          kind: isDeposit ? "account_bank_deposit" : "account_bank_withdraw",
          vault: "account",
          itemId,
          count: transferCount,
        });
        touchedModels.add("account_bank_storage");
        touchedModels.add("inventory_items");
        touchedModels.add("bank_transaction_log");
        break;
      }

      if (operation === "material_deposit" || operation === "material_withdraw") {
        if (!itemId) {
          warnings.push("bank_rejected:missing_item_id");
          touchedModels.add("bank_rejection");
          break;
        }
        const transferCount = count ?? 1;
        const snapshot = buildInventorySnapshot();
        const def = ensureLiveModeItemDefinitionV1(itemId, snapshot);
        const isMaterial = !!def?.isCraftingMaterial || isLikelyBankingMaterialItemIdV1(itemId);
        if (!isMaterial) {
          warnings.push("bank_rejected:not_material_item");
          touchedModels.add("bank_rejection");
          break;
        }
        const isDeposit = operation === "material_deposit";
        if (isDeposit) {
          if ((next.inventory.items[itemId] ?? 0) < transferCount) {
            warnings.push("bank_rejected:insufficient_item_count");
            touchedModels.add("bank_rejection");
            break;
          }
          if (!bankRecordHasCapacityV1(next.banking.materialStorage, itemId, next.banking.materialStorageMaxSlots)) {
            warnings.push("bank_rejected:material_storage_full");
            touchedModels.add("bank_rejection");
            break;
          }
          applyBankRecordDeltaV1(next.inventory.items, itemId, -transferCount);
          applyBankRecordDeltaV1(next.banking.materialStorage, itemId, transferCount);
        } else {
          if ((next.banking.materialStorage[itemId] ?? 0) < transferCount) {
            warnings.push("bank_rejected:insufficient_material_storage_item_count");
            touchedModels.add("bank_rejection");
            break;
          }
          if (wouldExceedCarryWeightV1(next.inventory.items, itemId, transferCount)) {
            pushCarryWeightRejectionV1(warnings, touchedModels, "material_storage_withdraw");
            break;
          }
          applyBankRecordDeltaV1(next.banking.materialStorage, itemId, -transferCount);
          applyBankRecordDeltaV1(next.inventory.items, itemId, transferCount);
        }
        appendBankingLogV1(next, {
          kind: isDeposit ? "material_storage_deposit" : "material_storage_withdraw",
          vault: "materials",
          itemId,
          count: transferCount,
        });
        touchedModels.add("material_storage");
        touchedModels.add("inventory_items");
        touchedModels.add("bank_transaction_log");
        break;
      }

      if (operation === "take_loan") {
        const amount = Math.max(1, Math.min(HARTHMERE_LOAN_MAX_PRINCIPAL_V1, Math.trunc(payloadNumber(envelope, "amount") ?? 0)));
        const days = Math.max(1, Math.min(30, Math.trunc(payloadNumber(envelope, "days") ?? 7)));
        const unpaidLoan = Object.values(next.banking.loans).find((loan) =>
          (loan.status === "active" || loan.status === "defaulted") &&
            activeLoanBalanceV1(loan, nowMs).totalRemaining > 0,
        );
        if (amount <= 0 || unpaidLoan || next.law.flags[HARTHMERE_BANK_CREDIT_HOLD_FLAG_V1]) {
          warnings.push(
            unpaidLoan?.status === "defaulted" || next.law.flags[HARTHMERE_BANK_CREDIT_HOLD_FLAG_V1]
              ? "bank_rejected:credit_hold_until_defaulted_loan_paid"
              : unpaidLoan
                ? "bank_rejected:active_loan_exists"
                : "bank_rejected:invalid_loan_amount",
          );
          touchedModels.add("bank_rejection");
          break;
        }
        const loanId = `loan_${next.actorId}_${next.banking.nextLoanNumber++}`;
        next.banking.loans[loanId] = {
          loanId,
          actorId: next.actorId,
          principalOriginal: amount,
          principalRemaining: amount,
          interestPaid: 0,
          dailyInterestRate: HARTHMERE_LOAN_DAILY_INTEREST_RATE_V1,
          openedAtMs: nowMs,
          dueAtMs: nowMs + days * HARTHMERE_LOAN_DAY_MS_V1,
          status: "active",
        };
        next.inventory.gold += amount;
        appendBankingLogV1(next, {
          kind: "bank_loan_taken",
          vault: "loan",
          goldDelta: amount,
          loanId,
        });
        touchedModels.add("bank_loan");
        touchedModels.add("wallet");
        touchedModels.add("bank_transaction_log");
        break;
      }

      if (operation === "repay_loan") {
        const loanId = payloadString(envelope, "loanId") ?? Object.values(next.banking.loans).find((loan) => loan.status === "active" || loan.status === "defaulted")?.loanId;
        const loan = loanId ? next.banking.loans[loanId] : undefined;
        if (!loan || (loan.status !== "active" && loan.status !== "defaulted")) {
          warnings.push("bank_rejected:no_active_loan");
          touchedModels.add("bank_rejection");
          break;
        }
        const requested = Math.max(1, Math.trunc(payloadNumber(envelope, "amount") ?? next.inventory.gold));
        const balance = activeLoanBalanceV1(loan, nowMs);
        const payment = Math.min(next.inventory.gold, requested, balance.totalRemaining);
        if (payment <= 0) {
          warnings.push("bank_rejected:not_enough_gold_for_loan_payment");
          touchedModels.add("bank_rejection");
          break;
        }
        let remainingPayment = payment;
        const interestPaidNow = Math.min(balance.interestRemaining, remainingPayment);
        loan.interestPaid = (loan.interestPaid ?? 0) + interestPaidNow;
        remainingPayment -= interestPaidNow;
        const penaltyPaidNow = Math.min(balance.defaultPenaltyRemaining, remainingPayment);
        loan.penaltyPaid = (loan.penaltyPaid ?? 0) + penaltyPaidNow;
        remainingPayment -= penaltyPaidNow;
        const principalPaidNow = Math.min(loan.principalRemaining, remainingPayment);
        loan.principalRemaining -= principalPaidNow;
        next.inventory.gold -= payment;
        loan.lastPaymentAtMs = nowMs;
        if (loan.principalRemaining <= 0 && activeLoanBalanceV1(loan, nowMs).totalRemaining <= 0) {
          loan.status = "paid";
          clearBankCreditHoldIfSettledV1(next, nowMs);
        }
        appendBankingLogV1(next, {
          kind: "bank_loan_payment",
          vault: "loan",
          goldDelta: -payment,
          loanId: loan.loanId,
        });
        touchedModels.add("bank_loan");
        touchedModels.add("wallet");
        touchedModels.add("bank_transaction_log");
        break;
      }

      warnings.push(`bank_rejected:unsupported_operation:${operation}`);
      touchedModels.add("bank_rejection");
      break;
    }
    case "request_mail_transaction": {
      const mailId = payloadString(envelope, "mailId") ?? envelope.requestId;
      const operation = payloadString(envelope, "operation") ?? "read";
      const itemId = payloadString(envelope, "itemId");
      const count = payloadPositiveWholeCountV1(envelope);
      if (itemId && count === undefined) {
        warnings.push("mail_rejected:invalid_count");
        touchedModels.add("mail_rejection");
        break;
      }
      const mail = next.mail.messages[mailId];
      if (!mail || mail.recipientActorId !== envelope.actorId) {
        warnings.push("mail_rejected:not_found");
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("mail", mailId));
        touchedModels.add("mail_rejection");
        break;
      }
      if (mail.status === "deleted") {
        warnings.push("mail_rejected:deleted");
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("mail", mailId));
        touchedModels.add("mail_rejection");
        break;
      }
      if (operation === "claim_attachment") {
        if (mail.status === "claimed") {
          warnings.push("mail_claim_rejected:already_claimed");
          sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("mail", mailId));
          touchedModels.add("mail_rejection");
          break;
        }
        const claimEntries = itemId
          ? [[itemId, Math.min(count ?? 1, mail.attachments[itemId] ?? 0)] as const]
          : (Object.entries(mail.attachments) as Array<readonly [string, number]>);
        if (!claimEntries.some(([, entryCount]) => entryCount > 0)) {
          warnings.push("mail_claim_rejected:attachment_not_found");
          sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("mail", mailId));
          touchedModels.add("mail_rejection");
          break;
        }
        const projectedItems = { ...next.inventory.items };
        for (const [attachmentItemId, attachmentCount] of claimEntries) {
          ensureLiveModeItemDefinitionV1(attachmentItemId, buildInventorySnapshot());
          applyBankRecordDeltaV1(projectedItems, attachmentItemId, attachmentCount);
        }
        if (harthmereInventoryCarryWeightV1(projectedItems) > HARTHMERE_CARRY_WEIGHT_LIMIT_V1) {
          pushCarryWeightRejectionV1(warnings, touchedModels, "mail_claim");
          sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("mail", mailId));
          break;
        }
        for (const [attachmentItemId, attachmentCount] of claimEntries) {
          applyBankRecordDeltaV1(next.inventory.items, attachmentItemId, attachmentCount);
          applyBankRecordDeltaV1(mail.attachments, attachmentItemId, -attachmentCount);
        }
        if (!Object.values(mail.attachments).some((attachmentCount) => attachmentCount > 0)) {
          mail.status = "claimed";
          mail.claimedAtMs = nowMs;
        } else {
          mail.status = "read";
        }
        touchedModels.add("inventory_items");
      } else if (operation === "read") {
        mail.status = mail.status === "unread" ? "read" : mail.status;
      } else {
        warnings.push(`mail_rejected:unsupported_operation:${operation}`);
        touchedModels.add("mail_rejection");
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("mail", mailId));
        break;
      }
      sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("mail", mailId));
      touchedModels.add("mail");
      break;
    }
    case "request_guild_mutation": {
      const operation = payloadString(envelope, "operation") ?? payloadString(envelope, "subAction") ?? "noop";
      const itemId = payloadString(envelope, "itemId");
      if (itemId) {
        ensureLiveModeItemDefinitionV1(itemId, buildInventorySnapshot());
      }
      const result = reduceHarthmereGuildMutationV1(
        next.guild,
        {
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          nowMs,
          operation,
          guildId: payloadString(envelope, "guildId"),
          name: payloadString(envelope, "name"),
          tag: payloadString(envelope, "tag"),
          description: payloadString(envelope, "description"),
          guildType: payloadString(envelope, "guildType") as any,
          recruitment: payloadString(envelope, "recruitment") as any,
          targetActorId: payloadString(envelope, "targetActorId"),
          displayName: payloadString(envelope, "displayName"),
          applicationId: payloadString(envelope, "applicationId"),
          inviteId: payloadString(envelope, "inviteId"),
          rankId: payloadString(envelope, "rankId"),
          rankName: payloadString(envelope, "rankName"),
          permissions: payloadRecord(envelope, "permissions") as any,
          dailyBankWithdrawLimitGoldValue: payloadNumber(envelope, "dailyBankWithdrawLimitGoldValue"),
          itemId,
          count: payloadNumber(envelope, "count"),
          itemGoldValue: liveModeGuildItemUnitGoldValueV1(itemId, buildInventorySnapshot()),
          amountGold: payloadNumber(envelope, "amountGold") ?? payloadNumber(envelope, "gold") ?? payloadNumber(envelope, "taxableGold"),
          taxRate: payloadNumber(envelope, "taxRate"),
          xpDelta: payloadNumber(envelope, "xpDelta"),
          message: payloadString(envelope, "message"),
          channel: payloadString(envelope, "channel") as any,
          propertyId: payloadString(envelope, "propertyId"),
          plotId: payloadString(envelope, "plotId"),
          blueprintId: payloadString(envelope, "blueprintId"),
          reason: payloadString(envelope, "reason"),
        },
        {
          actorGold: next.inventory.gold,
          actorInventoryItems: next.inventory.items,
          actorLevel: next.classMagic.skills["character_level"]?.level ?? 1,
          canDepositItem: (candidateItemId) => {
            const def = ensureLiveModeItemDefinitionV1(candidateItemId, buildInventorySnapshot());
            return !(def?.isQuestItem || def?.binding === "quest" || def?.isCurrency);
          },
          canWithdrawToInventory: (candidateItemId, count) => !wouldExceedCarryWeightV1(next.inventory.items, candidateItemId, count),
          guildBankHasCapacity: (items, candidateItemId, maxSlots) => bankRecordHasCapacityV1(items, candidateItemId, maxSlots),
          canLinkGuildHallProperty: ({ guildId, actorId, propertyId }) => {
            const property = next.property.owned[propertyId];
            if (!property || property.guildId !== guildId) return false;
            const blueprint = buildingSystemBlueprintByIdV1(property.blueprintId);
            if (property.use !== "guild" && blueprint?.use !== "guild") return false;
            return buildingSystemCanActorAccessPropertyV1({
              property,
              actorId,
              permission: "build_edit",
              guildId,
            });
          },
        },
      );
      next.guild = result.guild;
      next.inventory.gold = Math.max(0, next.inventory.gold + result.inventoryGoldDelta);
      for (const [deltaItemId, delta] of Object.entries(result.inventoryItemDeltas)) {
        applyBankRecordDeltaV1(next.inventory.items, deltaItemId, delta);
      }
      for (const warning of result.warnings) warnings.push(warning);
      for (const model of result.touchedModels) touchedModels.add(model);
      for (const guildId of result.sharedGuildIds) {
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("guild", guildId));
      }
      if (result.inventoryGoldDelta !== 0) {
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: `guild_${operation}`,
          amount: result.inventoryGoldDelta,
          atMs: nowMs,
        });
        touchedModels.add("economy_ledger");
      }
      break;
    }
    case "request_jobs_board_mutation": {
      const operation = payloadString(envelope, "operation") ?? payloadString(envelope, "subAction") ?? "noop";
      const boardId = payloadString(envelope, "boardId") ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1;
      const actorPosition = actorWorldPositionFromAuthorityV1(envelope);
      const board = next.jobsBoard.boards[boardId];
      const nearbyBoardId =
        actorPosition && board
          ? distanceSq3V1(actorPosition, {
              x: board.location.x,
              y: board.location.y,
              z: board.location.z,
            }) <= board.location.radius * board.location.radius
            ? boardId
            : undefined
          : undefined;
      const result = reduceHarthmereJobsBoardMutationV1(
        next.jobsBoard,
        {
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          nowMs,
          operation,
          ...(envelope.payload as Record<string, unknown>),
        } as any,
        {
          actorGold: next.inventory.gold,
          actorInventoryItems: next.inventory.items,
          actorCollectibles: next.collections.discovered,
          actorGuildId: next.guild.memberGuildId,
          actorPosition,
          nearbyBoardId,
          economy: next.economy.production,
          canManageBusinessJobs: (business: any) =>
            (business.ownerKind === "player" && business.ownerId === envelope.actorId) ||
            (business.ownerKind === "guild" && business.ownerId === next.guild.memberGuildId &&
              hasHarthmereGuildPermissionV1(next.guild.guilds[business.ownerId], envelope.actorId, "manage_treasury", nowMs)) ||
            (business.ownerKind === "town" && (next.law.reputation[`town:${business.ownerId}:clerk`] >= 1 || next.law.flags[`town_admin:${business.ownerId}`] === true)),
          canManageGuildJobs: (guildId: string) =>
            guildId === next.guild.memberGuildId &&
            hasHarthmereGuildPermissionV1(next.guild.guilds[guildId], envelope.actorId, "manage_treasury", nowMs),
          canManageTownJobs: (townId: string) =>
            next.law.reputation[`town:${townId}:clerk`] >= 1 ||
            next.law.flags[`town_admin:${townId}`] === true,
          allowNpcJobPosting: next.law.flags.jobs_board_npc_admin === true,
        },
      );
      next.jobsBoard = result.jobsBoard;
      if (result.economy) next.economy.production = result.economy;
      next.inventory.gold = Math.max(0, next.inventory.gold + result.inventoryGoldDelta);
      for (const [itemId, delta] of Object.entries(result.inventoryItemDeltas)) {
        applyBankRecordDeltaV1(next.inventory.items, itemId, Number(delta));
      }
      for (const collectibleId of result.collectibleRewardIds ?? []) {
        if (HARTHMERE_COLLECTIBLE_DEFINITIONS_V1[collectibleId]) {
          if (next.collections.discovered[collectibleId] === undefined) {
            next.collections.discovered[collectibleId] = nowMs;
            touchedModels.add("collections");
          }
        }
      }
      for (const todo of Object.values(next.jobsBoard.todos)) {
        if (todo.actorId !== envelope.actorId) continue;
        const questId = `jobs_board:${todo.todoId}`;
        if (todo.status === "active") {
          next.quests.active[questId] = { stepId: todo.jobId, progress: 0 };
          if (todo.mapMarkerId) {
            next.building.inWorldMarkers[`jobs_board_marker:${todo.todoId}`] = {
              markerId: `jobs_board_marker:${todo.todoId}`,
              plotId: todo.targetId ?? todo.mapMarkerId,
              kind: "map_marker",
              position: [482, 66, -198],
              label: todo.title,
              createdAtMs: todo.createdAtMs,
            };
          }
        } else if (todo.status === "completed") {
          delete next.quests.active[questId];
          next.quests.completed[questId] = nowMs;
        } else if (todo.status === "cancelled" || todo.status === "failed" || todo.status === "expired") {
          delete next.quests.active[questId];
        }
      }
      for (const warning of result.warnings) warnings.push(warning);
      for (const model of result.touchedModels) touchedModels.add(model);
      for (const key of result.sharedStateKeys) sharedStateKeys.add(key);
      if (result.inventoryGoldDelta !== 0) {
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: `jobs_board_${operation}`,
          amount: result.inventoryGoldDelta,
          atMs: nowMs,
        });
        touchedModels.add("economy_ledger");
      }
      break;
    }
    case "request_economy_mutation": {
      const operation = payloadString(envelope, "operation") ?? payloadString(envelope, "subAction") ?? "noop";
      const result = reduceHarthmereEconomyMutationV1(
        next.economy.production,
        {
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          nowMs,
          operation,
          ...(envelope.payload as Record<string, unknown>),
        } as any,
        {
          actorGold: next.inventory.gold,
          actorInventoryItems: next.inventory.items,
          actorGuildId: next.guild.memberGuildId,
          canManageGuildBusiness: (guildId: string) =>
            guildId === next.guild.memberGuildId &&
            hasHarthmereGuildPermissionV1(next.guild.guilds[guildId], envelope.actorId, "manage_treasury", nowMs),
          canManageTownBusiness: (townId: string) =>
            next.law.reputation[`town:${townId}:clerk`] >= 1 ||
            next.law.flags[`town_admin:${townId}`] === true,
          allowNpcAdministration: next.law.flags.economy_npc_admin === true,
        },
      );
      next.economy.production = result.economy;
      next.inventory.gold = Math.max(0, next.inventory.gold + result.inventoryGoldDelta);
      for (const [itemId, delta] of Object.entries(result.inventoryItemDeltas)) {
        applyBankRecordDeltaV1(next.inventory.items, itemId, Number(delta));
      }
      for (const warning of result.warnings) warnings.push(warning);
      for (const model of result.touchedModels) touchedModels.add(model);
      for (const key of result.sharedStateKeys) sharedStateKeys.add(key);
      if (result.inventoryGoldDelta !== 0) {
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: `economy_${operation}`,
          amount: result.inventoryGoldDelta,
          atMs: nowMs,
        });
        touchedModels.add("economy_ledger");
      }
      touchedModels.add("economy_production_state");
      break;
    }
    case "request_law_reputation_mutation":
    case "request_pvp_flag_change":
    case "request_pvp_reward": {
      const factionId = payloadString(envelope, "factionId") ?? envelope.zoneId;
      const witnessLevel = payloadString(envelope, "witnessLevel") ?? (
        payloadBoolean(envelope, "publicEvent") === true ? "public_event" : "public"
      );
      const witnessMultiplier = reputationWitnessMultiplierV1(witnessLevel);
      let likeabilityDelta = payloadNumber(envelope, "likeabilityDelta") ?? 0;
      let legalDelta = payloadNumber(envelope, "legalDelta") ?? 0;
      let notorietyDelta = payloadNumber(envelope, "notorietyDelta") ?? 0;
      const notorietyFloorDelta = payloadNumber(envelope, "notorietyFloorDelta") ?? 0;

      if (envelope.actionKind === "request_pvp_reward") {
        const actorLevel = payloadNumber(envelope, "actorLevel") ??
          next.classMagic.skills.character_level?.level ??
          1;
        const targetLevel = payloadNumber(envelope, "targetLevel") ?? actorLevel;
        const targetIsPlayer = payloadBoolean(envelope, "targetIsPlayer") !== false;
        if (targetIsPlayer && actorLevel - targetLevel >= 10) {
          if (notorietyDelta > 0) notorietyDelta = 0;
          likeabilityDelta = Math.min(likeabilityDelta, -500);
          legalDelta = Math.min(legalDelta, -500);
          warnings.push("pvp_reward_adjusted:low_level_target_no_notoriety");
        }
      }

      next.law.reputation[factionId] =
        clampSignedReputationV1(
          (next.law.reputation[factionId] ?? 0) +
            (payloadNumber(envelope, "reputationDelta") ?? 0) *
              witnessMultiplier
        );
      if (
        likeabilityDelta !== 0 ||
        legalDelta !== 0 ||
        notorietyDelta !== 0 ||
        notorietyFloorDelta !== 0
      ) {
        const before =
          next.law.standing[factionId] ?? defaultReputationStandingV1();
        const after = applyReputationStandingDeltaV1(
          before,
          {
            likeability: likeabilityDelta,
            legal: legalDelta,
            notoriety: notorietyDelta,
            notorietyFloor: notorietyFloorDelta,
          },
          witnessMultiplier
        );
        next.law.standing[factionId] = after;
        next.law.recentReputationEvents = [
          {
            id: envelope.requestId,
            atMs: nowMs,
            scopeId: factionId,
            witnessLevel,
            likeabilityDelta: after.likeability - before.likeability,
            legalDelta: after.legal - before.legal,
            notorietyDelta: after.notoriety - before.notoriety,
            reason: payloadString(envelope, "reason") ?? payloadString(envelope, "crimeKind"),
          },
          ...(next.law.recentReputationEvents ?? []),
        ].slice(0, 50);
        touchedModels.add("law_standing");
        touchedModels.add("law_reputation_events");
      }
      const fineDelta = payloadNumber(envelope, "fineDelta") ?? 0;
      if (fineDelta !== 0) {
        recordDelta(next.law.fines, factionId, fineDelta);
      }
      const crimeKind = payloadString(envelope, "crimeKind");
      if (crimeKind) {
        next.law.flags[crimeKind] = true;
        next.law.crimeLog.push({
          id: envelope.requestId,
          kind: crimeKind,
          atMs: nowMs,
          zoneId: envelope.zoneId,
        });
      }
      sharedStateKeys.add(
        harthmereLiveModeSharedStateKeyV1("zone_law", envelope.zoneId)
      );
      touchedModels.add("law_reputation");
      break;
    }
    case "request_trainer_unlock":
    case "request_skill_book_use": {
      // Trainer unlock / skill book: server validates access before granting
      const classChoice = payloadString(envelope, "classId");
      if (classChoice) {
        const result = applyHarthmereClassChoiceV1(next.classMagic, classChoice);
        if (!result.ok) {
          warnings.push(result.warning ?? "class_rejected:unknown_class");
          touchedModels.add("class_choice_rejection");
          break;
        }
        touchedModels.add("class_choice");
        touchedModels.add("known_abilities");
        touchedModels.add("skill_xp");
      }
      const abilityId = payloadString(envelope, "abilityId");
      const recipeId = payloadString(envelope, "recipeId");
      if (abilityId && !next.classMagic.knownAbilities.includes(abilityId)) {
        const learnResult = canLearnHarthmereAbilityV1({
          classMagic: next.classMagic,
          economy: next.economy.production,
          actorId: next.actorId,
          abilityId,
        });
        if (!learnResult.ok) {
          warnings.push(learnResult.warning ?? "ability_rejected");
          touchedModels.add("known_abilities_rejection");
          break;
        }
        next.classMagic.knownAbilities.push(abilityId);
        touchedModels.add("known_abilities");
      }
      if (recipeId && !next.classMagic.knownRecipes.includes(recipeId)) {
        next.classMagic.knownRecipes.push(recipeId);
        touchedModels.add("known_recipes");
      }
      touchedModels.add("class_magic_progression");
      break;
    }
    case "request_respec": {
      const actor = buildActorSnapshot();
      const respecReq: HarthmereCombatActionRequestV1 = {
        requestId: envelope.requestId,
        kind: "respec",
        actorId: envelope.actorId,
        nowMs,
        respecType: (payloadString(envelope, "respecType") as "full" | "partial" | undefined) ?? "full",
      };
      const respecResult = reduceHarthmereCombatActionV1(respecReq, {
        actor,
        zone: buildZoneSnapshot(),
        respecCount: next.respec?.count ?? 0,
        lastRespecAtMs: next.respec?.lastRespecAtMs,
        actorGold: next.inventory.gold,
        talentPointsAvailable: 0,
      });
      if (respecResult.ok) {
        // reduceHarthmereCombatActionV1 returns a negative goldCost for respec
        // because it represents a wallet delta, not a positive price. Apply it
        // as a delta so respec can never accidentally award gold.
        next.inventory.gold = Math.max(0, next.inventory.gold + respecResult.goldCost);
        next.respec = {
          count: (next.respec?.count ?? 0) + 1,
          lastRespecAtMs: nowMs,
        };
        // Clear all talent nodes on full respec
        if ((payloadString(envelope, "respecType") ?? "full") === "full") {
          next.talents = { nodes: [], pointsSpent: 0 };
        }
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: "respec_fee",
          amount: respecResult.goldCost,
          atMs: nowMs,
        });
        touchedModels.add("class_magic_progression");
        touchedModels.add("talents");
        touchedModels.add("wallet");
        touchedModels.add("economy_ledger");
      } else {
        warnings.push(...respecResult.errors.map((e) => `respec_rejected:${e}`));
        touchedModels.add("respec_rejection");
      }
      break;
    }
    case "request_quest_state_update": {
      const questId = payloadString(envelope, "questId");
      if (questId) {
        const completed = envelope.payload.completed === true;
        if (completed && questId.startsWith("jobs_board:")) {
          const todoId = questId.slice("jobs_board:".length);
          const todo = next.jobsBoard.todos[todoId];
          if (!todo || todo.actorId !== envelope.actorId) {
            warnings.push("jobs_board_rejected:quest_todo_required");
            touchedModels.add("jobs_board_rejection");
          } else {
            const result = reduceHarthmereJobsBoardMutationV1(
              next.jobsBoard,
              {
                requestId: envelope.requestId,
                actorId: envelope.actorId,
                nowMs,
                operation: "complete_job_quest",
                jobId: todo.jobId,
                questTodoId: todo.todoId,
                completedTargetId: payloadString(envelope, "completedTargetId"),
                completionNote: payloadString(envelope, "completionNote"),
                completionItemDeltas: (envelope.payload as any).completionItemDeltas,
              },
              {
                actorGold: next.inventory.gold,
                actorInventoryItems: next.inventory.items,
                actorCollectibles: next.collections.discovered,
                actorGuildId: next.guild.memberGuildId,
                economy: next.economy.production,
              },
            );
            next.jobsBoard = result.jobsBoard;
            if (result.economy) next.economy.production = result.economy;
            for (const [itemId, delta] of Object.entries(result.inventoryItemDeltas)) {
              applyBankRecordDeltaV1(next.inventory.items, itemId, Number(delta));
            }
            for (const warning of result.warnings) warnings.push(warning);
            for (const model of result.touchedModels) touchedModels.add(model);
            for (const key of result.sharedStateKeys) sharedStateKeys.add(key);
            if (result.warnings.length === 0) {
              next.quests.completed[questId] = nowMs;
              delete next.quests.active[questId];
              touchedModels.add("quest_state");
            }
          }
        } else if (completed) {
          next.quests.completed[questId] = nowMs;
          delete next.quests.active[questId];
        } else {
          next.quests.active[questId] = {
            stepId: payloadString(envelope, "stepId"),
            progress: Math.max(0, payloadNumber(envelope, "progress") ?? 1),
          };
        }
        touchedModels.add("quest_state");
      }
      const collectibleId = payloadString(envelope, "collectibleId");
      if (collectibleId) {
        if (HARTHMERE_COLLECTIBLE_DEFINITIONS_V1[collectibleId]) {
          if (next.collections.discovered[collectibleId] === undefined) {
            next.collections.discovered[collectibleId] = nowMs;
            touchedModels.add("collections");
          }
        } else {
          warnings.push("collectible_rejected:unknown_collectible");
          touchedModels.add("collections_rejection");
        }
      }
      break;
    }
    case "request_property_building_mutation": {
      const subAction = payloadString(envelope, "buildingAction") ?? payloadString(envelope, "subAction") ?? payloadString(envelope, "operation") ?? "read_state";
      const requestedPlotId =
        payloadString(envelope, "plotId") ?? payloadString(envelope, "propertyId");
      const plot = buildingSystemPlotByIdV1(requestedPlotId);

      if (subAction === "read_state") {
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("building_state", envelope.actorId));
        touchedModels.add("building_state");
        break;
      }

      if (subAction === "talk_to_steward" || subAction === "complete_mira_intro") {
        next.quests.completed[BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1.questId] = nowMs;
        delete next.quests.active[BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1.questId];
        next.building.inWorldMarkers["mira_grove_land_steward_board_marker"] = {
          markerId: "mira_grove_land_steward_board_marker",
          plotId: "the_grove",
          kind: "npc_board",
          position: [501, 53, -132],
          label: "Mira Thatch · Building System",
          createdAtMs: nowMs,
        };
        const miraMapMarker = createBuildingSystemMiraMapMarkerV1(nowMs);
        next.building.inWorldMarkers[miraMapMarker.markerId] = miraMapMarker;
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("quest", BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1.questId));
        touchedModels.add("quest_state");
        touchedModels.add("building_steward_intro");
        break;
      }

      if (subAction === "claim_plot") {
        if (!plot) {
          warnings.push("plot_claim_rejected:plot_not_found");
          touchedModels.add("building_rejection");
          break;
        }
        if (next.building.ownedPlots.includes(plot.plotId)) {
          warnings.push("plot_claim_rejected:plot_already_owned_by_actor");
          touchedModels.add("building_rejection");
          break;
        }
        const claimPlot = toHarthmerePlotDefinitionV1(
          plot,
          "",
          true
        );
        const claim = validateHarthmerePlotClaimV1(
          {
            requestId: envelope.requestId,
            actorId: envelope.actorId,
            plotId: plot.plotId,
            nowMs,
          },
          {
            plot: claimPlot,
            claimPriceGold: plot.claimPriceGold,
            actorGold: next.inventory.gold,
            actorOwnedPlotCount: next.building.ownedPlots.length,
            maxPlotsPerActor: 5,
          }
        );
        if (!claim.ok) {
          warnings.push(...claim.errors.map((e) => `plot_claim_rejected:${e}`));
          touchedModels.add("building_rejection");
          break;
        }

        next.inventory.gold = Math.max(0, next.inventory.gold - claim.goldCost);
        if (!next.building.ownedPlots.includes(plot.plotId)) {
          next.building.ownedPlots.push(plot.plotId);
        }
        const claimMiraMapMarker = createBuildingSystemMiraMapMarkerV1(nowMs);
        next.building.inWorldMarkers[claimMiraMapMarker.markerId] = claimMiraMapMarker;
        touchedModels.add("mira_map_marker");
        if (plot.safeAfterPurchase) {
          next.building.safeZones[plot.plotId] = {
            safeFromMuck: true,
            activatedAtMs: nowMs,
            area: plot.area,
          };
          const safePlan = createBuildingSystemSafeGroundMaterializationPlanV1({
            requestId: envelope.requestId,
            actorId: envelope.actorId,
            plot,
            activatedAtMs: nowMs,
          });
          for (const marker of safePlan.inWorldMarkers ?? []) {
            next.building.inWorldMarkers[marker.markerId] = marker;
          }
          next.building.materializationPlans[`${envelope.requestId}:safe_ground`] = safePlan;
          buildingMaterializationPlans.push(safePlan);
          touchedModels.add("muck_safe_zone");
          touchedModels.add("plot_boundary_markers");
          touchedModels.add("deed_marker");
          touchedModels.add("map_marker");
          touchedModels.add("terrain_materialization");
        }
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: "plot_claim",
          amount: -claim.goldCost,
          atMs: nowMs,
        });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("plot", plot.plotId));
        touchedModels.add("wallet");
        touchedModels.add("owned_plots");
        touchedModels.add("economy_ledger");
        break;
      }

      const blueprintId = payloadString(envelope, "blueprintId");
      const structureTypeId = payloadString(envelope, "structureTypeId");
      const blueprint =
        buildingSystemBlueprintByIdV1(blueprintId) ??
        buildingSystemBlueprintByStructureTypeV1(structureTypeId, plot?.plotType);
      const propertyId =
        payloadString(envelope, "propertyId") ??
        (plot ? buildingPropertyIdForPlotV1(plot.plotId) : envelope.requestId);

      if (subAction === "start_construction") {
        if (!plot || !blueprint) {
          warnings.push("building_project_rejected:missing_real_plot_or_blueprint");
          touchedModels.add("building_rejection");
          break;
        }
        if (!next.building.ownedPlots.includes(plot.plotId)) {
          warnings.push("building_project_rejected:plot_not_owned_by_actor");
          touchedModels.add("building_rejection");
          break;
        }
        if (!plot.allowedBlueprintIds.includes(blueprint.blueprintId)) {
          warnings.push("building_project_rejected:blueprint_not_allowed_on_plot");
          touchedModels.add("building_rejection");
          break;
        }
        const projectId = payloadString(envelope, "projectId") ?? buildingProjectIdForPlotV1(plot.plotId);
        const existingProject = next.building.activeProjects[projectId];
        if (existingProject && existingProject.status !== "cancelled") {
          warnings.push("building_project_rejected:project_already_exists_for_plot");
          touchedModels.add("building_rejection");
          break;
        }
        if (next.property.owned[propertyId]) {
          warnings.push("building_project_rejected:property_already_completed_for_plot");
          touchedModels.add("building_rejection");
          break;
        }
        const origin = {
          x: payloadNumber(envelope, "originX") ?? buildingSystemDefaultOriginV1(plot, blueprint).x,
          y: payloadNumber(envelope, "originY") ?? buildingSystemDefaultOriginV1(plot, blueprint).y,
          z: payloadNumber(envelope, "originZ") ?? buildingSystemDefaultOriginV1(plot, blueprint).z,
        };
        const rotation = (payloadNumber(envelope, "rotationDegrees") ?? 0) as 0 | 90 | 180 | 270;
        const placementReq: HarthmereBuildingPlacementRequestV1 = {
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          structureTypeId: blueprint.structureTypeId,
          origin,
          rotationDegrees: rotation,
          plotId: plot.plotId,
          nowMs,
        };
        const placementCtx = createBuildingSystemPlacementContextV1({
          actorId: envelope.actorId,
          plot,
          blueprint,
          origin,
          owned: true,
          currentCoveredAreaVoxels: Object.values(next.building.placedStructures)
            .filter((entry) => entry.plotId === plot.plotId)
            .reduce((acc, entry) => acc + (entry.voxelEditCount ?? 0), 0),
        });
        const placementResult = validateHarthmereBuildingPlacementV1(
          placementReq,
          placementCtx
        );
        if (!placementResult.ok) {
          warnings.push(...placementResult.errors.map((e) => `building_project_rejected:${e}`));
          touchedModels.add("building_rejection");
          break;
        }
        if (next.inventory.gold < blueprint.goldCost) {
          warnings.push("building_project_rejected:insufficient_gold_for_blueprint");
          touchedModels.add("building_rejection");
          break;
        }

        next.inventory.gold = Math.max(0, next.inventory.gold - blueprint.goldCost);
        next.building.activeProjects[projectId] = {
          projectId,
          actorId: envelope.actorId,
          plotId: plot.plotId,
          blueprintId: blueprint.blueprintId,
          origin,
          rotationDegrees: rotation,
          currentStage: "site_preparation",
          completedStages: [],
          stageProgress: {},
          startedAtMs: nowMs,
          updatedAtMs: nowMs,
          status: "active",
          materializedStageRequestIds: [],
          storageUnlocked: false,
        };
        next.property.buildingProgress[propertyId] = 0;
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: `building_project_started_${blueprint.use}`,
          amount: -blueprint.goldCost,
          atMs: nowMs,
        });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("plot", plot.plotId));
        touchedModels.add("wallet");
        touchedModels.add("building_project");
        touchedModels.add("construction_stage_state");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "contribute_stage") {
        if (!plot) {
          warnings.push("building_stage_rejected:plot_not_found");
          touchedModels.add("building_rejection");
          break;
        }
        const projectId = payloadString(envelope, "projectId") ?? buildingProjectIdForPlotV1(plot.plotId);
        const project = next.building.activeProjects[projectId];
        if (!project || project.status !== "active") {
          warnings.push("building_stage_rejected:active_project_not_found");
          touchedModels.add("building_rejection");
          break;
        }
        const projectBlueprint = buildingSystemBlueprintByIdV1(project.blueprintId);
        if (!projectBlueprint) {
          warnings.push("building_stage_rejected:blueprint_not_found");
          touchedModels.add("building_rejection");
          break;
        }
        const requestedStage = payloadString(envelope, "stage") ?? project.currentStage;
        if (!isBuildingSystemStageV1(requestedStage)) {
          warnings.push("building_stage_rejected:invalid_stage");
          touchedModels.add("building_rejection");
          break;
        }
        if (project.completedStages.includes(requestedStage)) {
          warnings.push("building_stage_rejected:duplicate_stage_contribution");
          touchedModels.add("building_rejection");
          break;
        }
        if (requestedStage !== project.currentStage) {
          warnings.push("building_stage_rejected:stage_out_of_order");
          touchedModels.add("building_rejection");
          break;
        }

        const currentProgress = project.stageProgress[requestedStage] ?? {
          materials: {},
          labor: 0,
        };
        const requestedMaterials = normalizeMaterialContributionPayloadV1(
          payloadRecord(envelope, "materials")
        );
        const materialRequest = buildingSystemRemainingMaterialItemDeltasV1({
          blueprint: projectBlueprint,
          stage: requestedStage,
          contributed: currentProgress.materials,
          requestedMaterials,
          contributeAll: payloadBoolean(envelope, "contributeAll") === true || !requestedMaterials,
        });
        const missingSubmittedMaterials = materialRequest.lines.some((line) => line.remaining > 0) &&
          Object.keys(materialRequest.symbolicContributions).length === 0;
        if (missingSubmittedMaterials) {
          warnings.push("building_stage_rejected:missing_material_submission");
          touchedModels.add("building_rejection");
          break;
        }
        for (const [itemId, delta] of Object.entries(materialRequest.itemDeltas)) {
          const needed = Math.abs(delta);
          if ((next.inventory.items[itemId] ?? 0) < needed) {
            warnings.push(`building_stage_rejected:insufficient_material:${itemId}`);
            touchedModels.add("building_rejection");
            break;
          }
        }
        if (touchedModels.has("building_rejection")) {
          break;
        }

        for (const [itemId, delta] of Object.entries(materialRequest.itemDeltas)) {
          recordDelta(next.inventory.items, itemId, delta);
        }
        const nextMaterials = { ...currentProgress.materials };
        for (const [material, count] of Object.entries(materialRequest.symbolicContributions)) {
          nextMaterials[material] = (nextMaterials[material] ?? 0) + count;
        }
        const laborRequired = projectBlueprint.laborStages[requestedStage] ?? 0;
        const laborRemaining = Math.max(0, laborRequired - (currentProgress.labor ?? 0));
        const requestedLabor = Math.max(
          0,
          Math.trunc(payloadNumber(envelope, "laborDelta") ?? laborRemaining)
        );
        const nextLabor = Math.min(laborRequired, (currentProgress.labor ?? 0) + requestedLabor);
        const updatedProgress = {
          materials: nextMaterials,
          labor: nextLabor,
        };
        project.stageProgress[requestedStage] = updatedProgress;
        project.updatedAtMs = nowMs;

        const materialsComplete = allBuildingMaterialsCompleteV1(
          projectBlueprint.materialStages[requestedStage],
          nextMaterials
        );
        const laborComplete = nextLabor >= laborRequired;
        const stageComplete = materialsComplete && laborComplete;
        if (stageComplete) {
          project.stageProgress[requestedStage] = {
            ...updatedProgress,
            completedAtMs: nowMs,
          };
          project.completedStages.push(requestedStage);
          project.currentStage = nextBuildingSystemStageV1(requestedStage);
          const stagePlan = createBuildingSystemStageMaterializationPlanV1({
            requestId: envelope.requestId,
            actorId: envelope.actorId,
            projectId: project.projectId,
            plot,
            blueprint: projectBlueprint,
            stage: requestedStage,
            origin: project.origin,
            rotationDegrees: project.rotationDegrees,
            activatedAtMs: nowMs,
          });
          project.materializedStageRequestIds.push(envelope.requestId);
          next.building.materializationPlans[`${envelope.requestId}:${requestedStage}`] = stagePlan;
          buildingMaterializationPlans.push(stagePlan);
          touchedModels.add("terrain_materialization");

          if (project.currentStage === "completed") {
            project.status = "completed";
            project.storageUnlocked = true;
            const completedProperty = createBuildingSystemPropertyRecordV1({
              propertyId,
              ownerId: envelope.actorId,
              plot,
              blueprint: projectBlueprint,
              nowMs,
              guildId: next.guild.guildId,
              value: Math.max(projectBlueprint.goldCost, payloadNumber(envelope, "propertyValue") ?? projectBlueprint.goldCost),
            });
            next.property.owned[propertyId] = completedProperty;
            syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property: completedProperty, plotId: plot.plotId, nowMs });
            if (projectBlueprint.use === "guild" && completedProperty.guildId) {
              const guildHallLink = linkHarthmereGuildHallPropertyV1({
                state: next.guild,
                guildId: completedProperty.guildId,
                actorId: envelope.actorId,
                propertyId,
                plotId: plot.plotId,
                blueprintId: projectBlueprint.blueprintId,
                nowMs,
              });
              next.guild = guildHallLink.state;
              if (guildHallLink.changed) {
                sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("guild", completedProperty.guildId));
                touchedModels.add("guild_hall");
              }
            }
            next.property.buildingProgress[propertyId] = 100;
            next.building.placedStructures[project.projectId] = {
              structureTypeId: projectBlueprint.structureTypeId,
              origin: project.origin,
              placedAtMs: nowMs,
              plotId: plot.plotId,
              blueprintId: projectBlueprint.blueprintId,
              use: projectBlueprint.use,
              voxelEditCount: project.completedStages.length,
              materializedInEcs: true,
            };
            touchedModels.add("property_building");
            touchedModels.add("placed_structures");
            touchedModels.add("storage_unlocked");
          } else {
            next.property.buildingProgress[propertyId] = Math.floor(
              (project.completedStages.length / BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1.length) * 100
            );
          }
        }

        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("plot", plot.plotId));
        touchedModels.add("inventory_items");
        touchedModels.add("building_project");
        touchedModels.add("construction_stage_state");
        break;
      }

      if (subAction === "place") {
        if (!plot || !blueprint) {
          warnings.push("building_rejected:missing_real_plot_or_blueprint");
          touchedModels.add("building_rejection");
          break;
        }
        if (!next.building.ownedPlots.includes(plot.plotId)) {
          warnings.push("building_rejected:plot_not_owned_by_actor");
          touchedModels.add("building_rejection");
          break;
        }
        if (!plot.allowedBlueprintIds.includes(blueprint.blueprintId)) {
          warnings.push("building_rejected:blueprint_not_allowed_on_plot");
          touchedModels.add("building_rejection");
          break;
        }
        const origin = {
          x: payloadNumber(envelope, "originX") ?? buildingSystemDefaultOriginV1(plot, blueprint).x,
          y: payloadNumber(envelope, "originY") ?? buildingSystemDefaultOriginV1(plot, blueprint).y,
          z: payloadNumber(envelope, "originZ") ?? buildingSystemDefaultOriginV1(plot, blueprint).z,
        };
        const rotation = (payloadNumber(envelope, "rotationDegrees") ?? 0) as 0 | 90 | 180 | 270;
        const placementReq: HarthmereBuildingPlacementRequestV1 = {
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          structureTypeId: blueprint.structureTypeId,
          origin,
          rotationDegrees: rotation,
          plotId: plot.plotId,
          nowMs,
        };
        const placementCtx = createBuildingSystemPlacementContextV1({
          actorId: envelope.actorId,
          plot,
          blueprint,
          origin,
          owned: true,
          currentCoveredAreaVoxels: Object.values(next.building.placedStructures)
            .filter((entry) => entry.plotId === plot.plotId)
            .reduce((acc, entry) => acc + (entry.voxelEditCount ?? 0), 0),
        });
        const placementResult = validateHarthmereBuildingPlacementV1(
          placementReq,
          placementCtx
        );
        if (!placementResult.ok) {
          warnings.push(...placementResult.errors.map((e) => `building_rejected:${e}`));
          touchedModels.add("building_rejection");
          break;
        }
        if (next.inventory.gold < blueprint.goldCost) {
          warnings.push("building_rejected:insufficient_gold_for_blueprint");
          touchedModels.add("building_rejection");
          break;
        }

        next.inventory.gold = Math.max(0, next.inventory.gold - blueprint.goldCost);
        const plan = createBuildingSystemMaterializationPlanV1({
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          plot,
          blueprint,
          origin,
          rotationDegrees: rotation,
          includeSafeGround: plot.safeAfterPurchase && !next.building.safeZones[plot.plotId]?.safeFromMuck,
          activatedAtMs: nowMs,
        });
        next.building.placedStructures[envelope.requestId] = {
          structureTypeId: blueprint.structureTypeId,
          origin,
          placedAtMs: nowMs,
          plotId: plot.plotId,
          blueprintId: blueprint.blueprintId,
          use: blueprint.use,
          voxelEditCount: plan.edits.length,
          materializedInEcs: true,
        };
        next.building.materializationPlans[envelope.requestId] = plan;
        if (plan.safeZone) {
          next.building.safeZones[plot.plotId] = {
            safeFromMuck: true,
            activatedAtMs: plan.safeZone.activatedAtMs,
            area: plan.safeZone.area,
          };
        }
        const placedProperty = createBuildingSystemPropertyRecordV1({
          propertyId,
          ownerId: envelope.actorId,
          plot,
          blueprint,
          nowMs,
          guildId: next.guild.guildId,
          value: Math.max(blueprint.goldCost, payloadNumber(envelope, "propertyValue") ?? blueprint.goldCost),
        });
        next.property.owned[propertyId] = placedProperty;
        syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property: placedProperty, plotId: plot.plotId, nowMs });
        if (blueprint.use === "guild" && placedProperty.guildId) {
          const guildHallLink = linkHarthmereGuildHallPropertyV1({
            state: next.guild,
            guildId: placedProperty.guildId,
            actorId: envelope.actorId,
            propertyId,
            plotId: plot.plotId,
            blueprintId: blueprint.blueprintId,
            nowMs,
          });
          next.guild = guildHallLink.state;
          if (guildHallLink.changed) {
            sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("guild", placedProperty.guildId));
            touchedModels.add("guild_hall");
          }
        }
        next.property.buildingProgress[propertyId] = 100;
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: `building_${blueprint.use}`,
          amount: -blueprint.goldCost,
          atMs: nowMs,
        });
        buildingMaterializationPlans.push(plan);
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("plot", plot.plotId));
        touchedModels.add("wallet");
        touchedModels.add("property_building");
        touchedModels.add("placed_structures");
        touchedModels.add("terrain_materialization");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "manage_property" || subAction === "assess_property") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (property) {
          const propertyPlot = buildingSystemPlotByIdV1(property.plotId);
          const propertyBlueprint = buildingSystemBlueprintByIdV1(property.blueprintId);
          if (propertyPlot && propertyBlueprint && property.condition <= 80 && !property.visualDamageApplied) {
            const damagePlan = createBuildingSystemRepairDamageMaterializationPlanV1({
              requestId: `${envelope.requestId}:visible_damage`,
              actorId: envelope.actorId,
              property,
              plot: propertyPlot,
              blueprint: propertyBlueprint,
              activatedAtMs: nowMs,
            });
            property.visualDamageApplied = true;
            next.property.owned[propertyId] = property;
            next.building.materializationPlans[damagePlan.requestId] = damagePlan;
            buildingMaterializationPlans.push(damagePlan);
            touchedModels.add("property_visible_decay");
            touchedModels.add("terrain_materialization");
          }
          syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property, plotId: property.plotId, nowMs });
          sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
          touchedModels.add("property_building");
          touchedModels.add("property_lifecycle");
        }
        break;
      }

      if (subAction === "set_access_mode") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        const accessMode = normalizeAccessModeV1(payloadString(envelope, "accessMode"));
        if (!property) break;
        if (!accessMode) {
          warnings.push("property_access_rejected:invalid_access_mode");
          touchedModels.add("property_rejection");
          break;
        }
        property.accessMode = accessMode;
        property.permissions = createBuildingSystemDefaultPermissionsV1(accessMode);
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property, plotId: property.plotId, nowMs });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("physical_access_controls");
        touchedModels.add("property_permissions");
        break;
      }

      if (subAction === "set_permission") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        const subject = normalizePermissionSubjectV1(payloadString(envelope, "subject"));
        const permission = normalizePermissionKeyV1(payloadString(envelope, "permission"));
        if (!property) break;
        if (!subject || !permission || subject === "owner") {
          warnings.push("property_permission_rejected:invalid_subject_or_permission");
          touchedModels.add("property_rejection");
          break;
        }
        property.permissions[subject][permission] = payloadBoolean(envelope, "enabled") === true;
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("property_permissions");
        break;
      }

      if (subAction === "add_guest" || subAction === "remove_guest") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        const guestActorId = payloadString(envelope, "guestActorId");
        if (!property) break;
        if (!guestActorId) {
          warnings.push("property_guest_rejected:missing_guest_actor_id");
          touchedModels.add("property_rejection");
          break;
        }
        if (subAction === "add_guest" && !property.guestActorIds.includes(guestActorId)) {
          property.guestActorIds.push(guestActorId);
        }
        if (subAction === "remove_guest") {
          property.guestActorIds = property.guestActorIds.filter((id) => id !== guestActorId);
        }
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property, plotId: property.plotId, nowMs });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("physical_access_controls");
        touchedModels.add("property_permissions");
        break;
      }

      if (subAction === "pay_property_tax") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        const payment = Math.min(property.taxBalanceGold, Math.max(0, Math.trunc(payloadNumber(envelope, "gold") ?? property.taxBalanceGold)));
        if (payment <= 0) {
          warnings.push("property_tax_rejected:no_tax_due");
          touchedModels.add("property_rejection");
          break;
        }
        if (next.inventory.gold < payment) {
          warnings.push("property_tax_rejected:insufficient_gold");
          touchedModels.add("property_rejection");
          break;
        }
        next.inventory.gold -= payment;
        property.taxBalanceGold = Math.max(0, property.taxBalanceGold - payment);
        if (property.taxBalanceGold === 0) {
          property.unpaidTaxSinceMs = undefined;
        }
        property.updatedAtMs = nowMs;
        next.economy.houseTaxAccumulated += payment;
        next.economy.ledger.push({ id: envelope.requestId, kind: "property_tax_paid", amount: -payment, atMs: nowMs });
        next.property.owned[propertyId] = property;
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("wallet");
        touchedModels.add("property_tax");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "repair_property") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        const cost = buildingSystemRepairCostGoldV1(property);
        if (cost <= 0) {
          warnings.push("property_repair_rejected:no_damage");
          touchedModels.add("property_rejection");
          break;
        }
        if (next.inventory.gold < cost) {
          warnings.push("property_repair_rejected:insufficient_gold");
          touchedModels.add("property_rejection");
          break;
        }
        next.inventory.gold -= cost;
        property.condition = 100;
        property.repairDebtGold = 0;
        property.lastRepairDecayAtMs = nowMs;
        property.visualDamageApplied = false;
        property.updatedAtMs = nowMs;
        const propertyPlot = buildingSystemPlotByIdV1(property.plotId);
        const propertyBlueprint = buildingSystemBlueprintByIdV1(property.blueprintId);
        if (propertyPlot && propertyBlueprint) {
          const repairPlan = createBuildingSystemRepairRestoreMaterializationPlanV1({
            requestId: `${envelope.requestId}:repair_restore`,
            actorId: envelope.actorId,
            property,
            plot: propertyPlot,
            blueprint: propertyBlueprint,
            activatedAtMs: nowMs,
          });
          next.building.materializationPlans[repairPlan.requestId] = repairPlan;
          buildingMaterializationPlans.push(repairPlan);
          touchedModels.add("property_visible_repair");
          touchedModels.add("terrain_materialization");
        }
        next.economy.ledger.push({ id: envelope.requestId, kind: "property_repaired", amount: -cost, atMs: nowMs });
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property, plotId: property.plotId, nowMs });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("wallet");
        touchedModels.add("property_repair");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "upgrade_property") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        if (!buildingSystemCanActorAccessPropertyV1({ property, actorId: envelope.actorId, permission: "build_edit", guildId: next.guild.guildId })) {
          warnings.push("property_upgrade_rejected:missing_build_edit_permission");
          touchedModels.add("property_rejection");
          break;
        }
        if (property.tier >= 2) {
          warnings.push("property_upgrade_rejected:max_tier_reached");
          touchedModels.add("property_rejection");
          break;
        }
        const cost = buildingSystemUpgradeCostGoldV1(property);
        if (next.inventory.gold < cost) {
          warnings.push("property_upgrade_rejected:insufficient_gold");
          touchedModels.add("property_rejection");
          break;
        }
        next.inventory.gold -= cost;
        property.tier += 1;
        property.upgradedVoxelTier = Math.max(property.upgradedVoxelTier, property.tier);
        property.value = computePropertyTierValueV1(property);
        property.storageSlots += Math.max(4, Math.floor(property.storageSlots * 0.5));
        property.condition = Math.min(100, property.condition + 10);
        property.updatedAtMs = nowMs;
        const propertyPlot = buildingSystemPlotByIdV1(property.plotId);
        const propertyBlueprint = buildingSystemBlueprintByIdV1(property.blueprintId);
        if (propertyPlot && propertyBlueprint) {
          const upgradePlan = createBuildingSystemUpgradeMaterializationPlanV1({
            requestId: `${envelope.requestId}:upgrade_tier_${property.tier}`,
            actorId: envelope.actorId,
            property,
            plot: propertyPlot,
            blueprint: propertyBlueprint,
            activatedAtMs: nowMs,
          });
          next.building.materializationPlans[upgradePlan.requestId] = upgradePlan;
          buildingMaterializationPlans.push(upgradePlan);
          touchedModels.add("property_visible_upgrade");
          touchedModels.add("terrain_materialization");
        }
        next.economy.ledger.push({ id: envelope.requestId, kind: "property_upgraded_tier_2", amount: -cost, atMs: nowMs });
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property, plotId: property.plotId, nowMs });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("wallet");
        touchedModels.add("property_upgrade");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "set_storage_item_count") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        property.storageItemCount = Math.max(0, Math.trunc(payloadNumber(envelope, "storageItemCount") ?? property.storageItemCount));
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property, plotId: property.plotId, nowMs });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("physical_storage_container");
        touchedModels.add("property_storage");
        break;
      }

      if (subAction === "demolish_property") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        if (!buildingSystemCanActorAccessPropertyV1({ property, actorId: envelope.actorId, permission: "demolition", guildId: next.guild.guildId })) {
          warnings.push("property_demolition_rejected:missing_demolition_permission");
          touchedModels.add("property_rejection");
          break;
        }
        if (property.storageItemCount > 0) {
          warnings.push("property_demolition_rejected:storage_not_empty");
          touchedModels.add("property_rejection");
          break;
        }
        const refund = payloadBoolean(envelope, "refund") === false ? 0 : buildingSystemDemolitionRefundGoldV1(property);
        next.inventory.gold += refund;
        property.status = "demolished";
        property.updatedAtMs = nowMs;
        const propertyPlot = buildingSystemPlotByIdV1(property.plotId);
        const propertyBlueprint = buildingSystemBlueprintByIdV1(property.blueprintId);
        if (propertyPlot && propertyBlueprint) {
          const demolitionPlan = createBuildingSystemDemolitionMaterializationPlanV1({
            requestId: `${envelope.requestId}:demolition_cleanup`,
            actorId: envelope.actorId,
            property,
            plot: propertyPlot,
            blueprint: propertyBlueprint,
            activatedAtMs: nowMs,
          });
          next.building.materializationPlans[demolitionPlan.requestId] = demolitionPlan;
          buildingMaterializationPlans.push(demolitionPlan);
          for (const markerId of Object.keys(next.building.inWorldMarkers)) {
            const marker = next.building.inWorldMarkers[markerId];
            if (marker.plotId === property.plotId && (marker.kind === "deed_sign" || marker.kind === "map_marker" || marker.kind === "storage_container" || marker.kind === "door_lock" || marker.kind === "business_marker")) {
              delete next.building.inWorldMarkers[markerId];
            }
          }
          touchedModels.add("demolition_voxel_cleanup");
          touchedModels.add("terrain_materialization");
        }
        removeBuildingSystemPhysicalAccessRecordsV1({ state: next, property });
        if (property.businessId) {
          delete next.economy.businesses[property.businessId];
        }
        delete next.property.owned[propertyId];
        if (plot) {
          next.building.ownedPlots = next.building.ownedPlots.filter((id) => id !== plot.plotId);
          delete next.building.placedStructures[buildingProjectIdForPlotV1(plot.plotId)];
          delete next.building.activeProjects[buildingProjectIdForPlotV1(plot.plotId)];
        }
        next.property.buildingProgress[propertyId] = 0;
        next.economy.ledger.push({ id: envelope.requestId, kind: refund > 0 ? "property_demolished_refund" : "property_demolished_no_refund", amount: refund, atMs: nowMs });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("property_demolition");
        touchedModels.add("owned_plots");
        touchedModels.add("wallet");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "abandon_property") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        property.status = "abandoned";
        property.abandoned = true;
        property.abandonedAtMs = nowMs;
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("property_abandonment");
        break;
      }

      if (subAction === "list_property_for_sale" || subAction === "transfer_property") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        if (!buildingSystemCanActorAccessPropertyV1({ property, actorId: envelope.actorId, permission: "transfer_sale", guildId: next.guild.guildId })) {
          warnings.push("property_transfer_rejected:missing_transfer_sale_permission");
          touchedModels.add("property_rejection");
          break;
        }
        if (subAction === "list_property_for_sale") {
          property.listedForSale = true;
          property.salePriceGold = Math.max(1, Math.trunc(payloadNumber(envelope, "salePriceGold") ?? property.value));
          property.status = "for_sale";
        } else {
          const newOwnerId = payloadString(envelope, "newOwnerId");
          if (!newOwnerId) {
            warnings.push("property_transfer_rejected:missing_new_owner");
            touchedModels.add("property_rejection");
            break;
          }
          property.ownerId = newOwnerId;
          property.listedForSale = false;
          property.salePriceGold = undefined;
          if (property.businessId && next.economy.businesses[property.businessId]) {
            next.economy.businesses[property.businessId].ownerId = newOwnerId;
            next.economy.businesses[property.businessId].updatedAtMs = nowMs;
          }
        }
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({ state: next, property, plotId: property.plotId, nowMs });
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("property", propertyId));
        touchedModels.add("property_transfer_sale");
        break;
      }


      if (subAction === "preview_blueprint") {
        if (!plot || !blueprint) {
          warnings.push("building_preview_rejected:missing_real_plot_or_blueprint");
          touchedModels.add("building_rejection");
          break;
        }
        const preview = createBuildingSystemPlacementPreviewV1({
          plot,
          blueprint,
          owned: next.building.ownedPlots.includes(plot.plotId),
        });
        next.building.inWorldMarkers[`${plot.plotId}:preview`] = {
          markerId: `${plot.plotId}:preview`,
          plotId: plot.plotId,
          kind: "map_marker",
          position: [preview.origin.x, preview.origin.y, preview.origin.z],
          label: preview.valid ? `${blueprint.displayName} ghost preview valid` : `${blueprint.displayName} ghost preview blocked`,
          createdAtMs: nowMs,
        };
        touchedModels.add("blueprint_ghost_preview");
        touchedModels.add(preview.valid ? "blueprint_preview_valid" : "blueprint_preview_blocked");
        break;
      }

      if (subAction === "open_door" || subAction === "use_storage") {
        const property = next.property.owned[propertyId];
        if (!property) {
          warnings.push("property_access_rejected:not_found");
          touchedModels.add("property_rejection");
          break;
        }
        const actorId = payloadString(envelope, "actorId") ?? envelope.actorId;
        const allowed = subAction === "use_storage"
          ? buildingSystemCanActorAccessPropertyV1({ property, actorId, permission: "storage_access", guildId: next.guild.guildId })
          : (property.accessMode === "public" || buildingSystemCanActorAccessPropertyV1({ property, actorId, permission: "storage_access", guildId: next.guild.guildId }) || buildingSystemCanActorAccessPropertyV1({ property, actorId, permission: "build_edit", guildId: next.guild.guildId }));
        if (!allowed) {
          warnings.push(`${subAction}_rejected:physical_lock_denied`);
          touchedModels.add("physical_access_rejection");
          break;
        }
        touchedModels.add(subAction === "use_storage" ? "physical_storage_access" : "physical_door_access");
        break;
      }

      if (subAction === "start_business") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        if (property.use !== "business") {
          warnings.push("business_rejected:property_not_business_use");
          touchedModels.add("business_rejection");
          break;
        }
        const businessType = payloadString(envelope, "businessType") as BuildingSystemBusinessTypeV1 | undefined;
        const businessDefinition = buildingSystemBusinessTypeByIdV1(businessType);
        if (!businessDefinition || !businessType) {
          warnings.push("business_rejected:unknown_business_type");
          touchedModels.add("business_rejection");
          break;
        }
        if (next.inventory.gold < businessDefinition.startingCostGold) {
          warnings.push("business_rejected:insufficient_startup_gold");
          touchedModels.add("business_rejection");
          break;
        }
        const businessId = property.businessId ?? `business_${property.propertyId}`;
        if (next.economy.businesses[businessId]) {
          warnings.push("business_rejected:already_started");
          touchedModels.add("business_rejection");
          break;
        }
        next.inventory.gold -= businessDefinition.startingCostGold;
        const business = createBuildingSystemBusinessRecordV1({
          businessId,
          ownerId: envelope.actorId,
          propertyId,
          businessType,
          nowMs,
        });
        next.economy.businesses[businessId] = business;
        property.businessId = businessId;
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        next.building.inWorldMarkers[`${businessId}:marker`] = {
          markerId: `${businessId}:marker`,
          plotId: property.plotId,
          kind: "business_marker",
          position: [buildingSystemDefaultOriginV1(buildingSystemPlotByIdV1(property.plotId)!, buildingSystemBlueprintByIdV1(property.blueprintId)!).x, buildingSystemDefaultOriginV1(buildingSystemPlotByIdV1(property.plotId)!, buildingSystemBlueprintByIdV1(property.blueprintId)!).y + 2, buildingSystemDefaultOriginV1(buildingSystemPlotByIdV1(property.plotId)!, buildingSystemBlueprintByIdV1(property.blueprintId)!).z],
          label: businessDefinition.displayName,
          createdAtMs: nowMs,
        };
        next.economy.ledger.push({ id: envelope.requestId, kind: `business_started_${businessType}`, amount: -businessDefinition.startingCostGold, atMs: nowMs });
        touchedModels.add("business_started");
        touchedModels.add("business_marker");
        touchedModels.add("wallet");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "run_business_cycle" || subAction === "collect_business_revenue") {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        const businessId = payloadString(envelope, "businessId") ?? property.businessId;
        const business = businessId ? next.economy.businesses[businessId] : undefined;
        if (!business) {
          warnings.push("business_rejected:not_found");
          touchedModels.add("business_rejection");
          break;
        }
        if (subAction === "run_business_cycle") {
          const result = runBuildingSystemBusinessRevenueCycleV1({
            business,
            nowMs,
            cycles: Math.max(1, Math.trunc(payloadNumber(envelope, "cycles") ?? 1)),
          });
          next.economy.businesses[business.businessId] = result.business;
          next.economy.businessRevenueAccumulated += result.net;
          next.economy.ledger.push({ id: envelope.requestId, kind: `business_revenue_${business.type}`, amount: result.net, atMs: nowMs });
          touchedModels.add("business_revenue_cycle");
          touchedModels.add("economy_ledger");
        } else {
          const collection = Math.max(0, Math.trunc(business.revenueBalanceGold));
          if (collection <= 0) {
            warnings.push("business_collect_rejected:no_revenue");
            touchedModels.add("business_rejection");
            break;
          }
          business.revenueBalanceGold = 0;
          business.updatedAtMs = nowMs;
          next.economy.businesses[business.businessId] = business;
          let actorCollection = collection;
          if (property.guildId && next.guild.guilds[property.guildId]?.taxRate > 0) {
            const taxResult = reduceHarthmereGuildMutationV1(
              next.guild,
              {
                requestId: `${envelope.requestId}:guild_tax`,
                actorId: envelope.actorId,
                nowMs,
                operation: "collect_tax",
                guildId: property.guildId,
                amountGold: collection,
                reason: `business_revenue:${business.type}`,
              },
              {
                actorGold: next.inventory.gold,
                actorInventoryItems: next.inventory.items,
                actorLevel: next.classMagic.skills["character_level"]?.level ?? 1,
                trustedTaxCollection: true,
              },
            );
            next.guild = taxResult.guild;
            for (const guildId of taxResult.sharedGuildIds) {
              sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("guild", guildId));
            }
            for (const model of taxResult.touchedModels) touchedModels.add(model);
            const guildRecord = next.guild.guilds[property.guildId];
            const taxLog = guildRecord?.treasuryLogs[guildRecord.treasuryLogs.length - 1];
            if (taxLog?.kind === "tax") {
              actorCollection = Math.max(0, collection - taxLog.amountGold);
            }
          }
          next.inventory.gold += actorCollection;
          next.economy.ledger.push({ id: envelope.requestId, kind: `business_revenue_collected_${business.type}`, amount: actorCollection, atMs: nowMs });
          touchedModels.add("business_revenue_collected");
          touchedModels.add("wallet");
          touchedModels.add("economy_ledger");
        }
        break;
      }

      // Generic property mutation (non-placement), retained for older callers but now normalized.
      const fallbackPlot = plot ?? buildingSystemPlotByIdV1(requestedPlotId);
      const fallbackBlueprint = blueprint ?? buildingSystemBlueprintByIdV1(blueprintId);
      if (fallbackPlot && fallbackBlueprint) {
        next.property.owned[propertyId] = createBuildingSystemPropertyRecordV1({
          propertyId,
          ownerId: envelope.actorId,
          plot: fallbackPlot,
          blueprint: fallbackBlueprint,
          nowMs,
          guildId: next.guild.guildId,
          value: Math.max(0, payloadNumber(envelope, "propertyValue") ?? fallbackBlueprint.goldCost),
        });
      } else {
        warnings.push("property_rejected:missing_real_plot_or_blueprint");
        touchedModels.add("property_rejection");
        break;
      }
      recordDelta(
        next.property.buildingProgress,
        propertyId,
        payloadNumber(envelope, "buildingProgressDelta") ?? 0
      );
      sharedStateKeys.add(
        harthmereLiveModeSharedStateKeyV1("property", propertyId)
      );
      touchedModels.add("property_building");
      break;
    }
    case "request_crafting": {
      const recipeId = payloadString(envelope, "recipeId");
      if (!recipeId) {
        warnings.push("crafting_rejected:missing_recipe_id");
        touchedModels.add("crafting_rejection");
        break;
      }
      const snapshot = buildInventorySnapshot();
      const recipe = getHarthmereCraftingRecipeV1(recipeId);
      const craftCount = payloadNumber(envelope, "count") ?? 1;
      if (!Number.isFinite(craftCount) || craftCount < 1 || Math.trunc(craftCount) !== craftCount) {
        warnings.push("crafting_rejected:invalid_count");
        touchedModels.add("crafting_rejection");
        break;
      }
      if (wouldCraftExceedCarryWeightV1(snapshot.items, recipe, craftCount)) {
        pushCarryWeightRejectionV1(warnings, touchedModels, "crafting");
        break;
      }
      const craftReq: HarthmereInventoryMutationRequestV1 = {
        requestId: envelope.requestId,
        actorId: envelope.actorId,
        kind: "craft_item",
        nowMs,
        recipeId,
        count: craftCount,
      };
      const craftResult = reduceHarthmereInventoryMutationV1(craftReq, {
        snapshot,
        playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
        playerSkills: next.classMagic.skills,
        reputation: next.law.reputation,
      });
      if (craftResult.ok) {
        const updated = applyHarthmereInventoryMutationResultV1(snapshot, craftResult);
        next.inventory.items = updated.items;
        next.banking.materialStorage = updated.materialStorage ?? next.banking.materialStorage;
        if (craftResult.xpDelta > 0) {
          upsertSkill(next.classMagic.skills, "crafting", craftResult.xpDelta);
        }
        touchedModels.add("crafting");
        touchedModels.add("inventory_items");
        if (Object.keys(craftResult.materialStorageDeltas).length > 0) {
          touchedModels.add("material_storage");
        }
      } else {
        warnings.push(...craftResult.errors.map((e) => `crafting_rejected:${e}`));
        touchedModels.add("crafting_rejection");
      }
      break;
    }
    case "request_farming_action": {
      const plotId = payloadString(envelope, "plotId") ?? envelope.requestId;
      const cropId = payloadString(envelope, "cropId") ?? "unknown_crop";
      next.farming.plots[plotId] = {
        cropId,
        plantedAtMs: nowMs,
        state: payloadString(envelope, "farmingState") ?? "planted",
      };
      touchedModels.add("farming");
      break;
    }
    case "request_care_loop_action": {
      const operation = payloadString(envelope, "operation") as HarthmereCareLoopKindV1 | undefined;
      if (!operation) {
        warnings.push("care_rejected:missing_operation");
        touchedModels.add("care_loop_rejection");
        break;
      }
      const careResult = reduceHarthmereCareLoopV1(next.careLoops, {
        requestId: envelope.requestId,
        actorId: envelope.actorId,
        operation,
        nowMs,
        targetId: payloadString(envelope, "targetId"),
        itemId: payloadString(envelope, "itemId"),
        count: payloadNumber(envelope, "count"),
        season: payloadString(envelope, "season") as any,
        inventory: next.inventory.items,
      });
      next.careLoops = careResult.care;
      warnings.push(...careResult.warnings);
      for (const [itemId, delta] of Object.entries(careResult.itemDeltas)) {
        recordDelta(next.inventory.items, itemId, delta);
      }
      next.inventory.gold = Math.max(0, next.inventory.gold + careResult.goldDelta);
      if (careResult.xpDelta > 0) {
        upsertSkill(next.classMagic.skills, "care", careResult.xpDelta);
      }
      touchedModels.add("care_loops");
      careResult.touchedModels.forEach((model) => touchedModels.add(model));
      if (careResult.unlocked.length > 0) {
        touchedModels.add("care_unlocks");
      }
      break;
    }
    case "request_death_transition":
      if (next.combat.deathState === "dead") {
        warnings.push("death_transition_ignored:already_dead");
        touchedModels.add("death_rejection");
        break;
      }
      next.combat.deathState = "dead";
      next.combat.hp = 0;
      next.combat.deathRecords[envelope.requestId] = {
        deathId: envelope.requestId,
        cause: payloadString(envelope, "cause") ?? "unknown",
        zoneId: envelope.zoneId,
        atMs: nowMs,
        respawnAvailableAtMs: nowMs + Math.max(0, payloadNumber(envelope, "respawnDelayMs") ?? 5_000),
      };
      touchedModels.add("death_record");
      break;
    case "request_revive":
      if (next.combat.deathState !== "dead" && next.combat.deathState !== "downed") {
        warnings.push("revive_rejected:not_dead_or_downed");
        touchedModels.add("revive_rejection");
        break;
      }
      next.combat.deathState = "alive";
      next.combat.hp = Math.max(1, Math.floor(next.combat.maxHp * 0.25));
      restoreCombatResourcesV1(next, 0.25);
      next.combat.respawnProtectionUntilMs = nowMs + Math.max(1_000, payloadNumber(envelope, "protectionMs") ?? 10_000);
      touchedModels.add("revive_state");
      touchedModels.add("combat_resources");
      break;
    case "request_respawn":
      if (next.combat.deathState !== "dead") {
        warnings.push("respawn_rejected:not_dead");
        touchedModels.add("respawn_rejection");
        break;
      }
      next.combat.deathState = "alive";
      next.combat.hp = next.combat.maxHp;
      restoreCombatResourcesV1(next, 1);
      next.combat.respawnProtectionUntilMs = nowMs + Math.max(1_000, payloadNumber(envelope, "protectionMs") ?? 10_000);
      touchedModels.add("respawn_state");
      touchedModels.add("combat_resources");
      break;
    case "request_npc_ai_tick": {
      const npcId = envelope.targetId ?? payloadString(envelope, "npcId");
      if (!npcId) {
        warnings.push("npc_ai_rejected:missing_npc_id");
        touchedModels.add("npc_ai_rejection");
        break;
      }
      const highestThreat = Object.entries(next.combat.threat)
        .sort((a, b) => b[1] - a[1])[0];
      const npcSnapshot = next.combat.entitySnapshots[npcId];
      const decision =
        npcSnapshot && !npcSnapshot.isAlive
          ? "dead"
          : highestThreat
            ? "engage_highest_threat"
            : "idle_patrol";
      next.combat.npcAiTicks[npcId] = {
        tickId: envelope.requestId,
        atMs: nowMs,
        decision,
        targetId: highestThreat?.[0],
        nextThinkAtMs: nowMs + Math.max(500, payloadNumber(envelope, "thinkIntervalMs") ?? 2_000),
      };
      touchedModels.add(envelope.subsystem);
      touchedModels.add("npc_ai_state");
      if (npcId) sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("npc_ai", npcId));
      break;
    }
    case "request_boss_tick": {
      const bossId = envelope.encounterId ?? envelope.targetId ?? payloadString(envelope, "bossId");
      if (!bossId) {
        warnings.push("boss_tick_rejected:missing_boss_id");
        touchedModels.add("boss_rejection");
        break;
      }
      const previous = next.combat.bossTicks[bossId];
      const bossSnapshot = envelope.targetId ? next.combat.entitySnapshots[envelope.targetId] : undefined;
      const hpRatio = bossSnapshot && bossSnapshot.maxHp > 0 ? bossSnapshot.hp / bossSnapshot.maxHp : 1;
      const enrageLevel = Math.min(10, (previous?.enrageLevel ?? 0) + (hpRatio <= 0.25 ? 1 : 0));
      const phase = hpRatio <= 0.25 ? "enraged" : hpRatio <= 0.5 ? "phase_2" : "phase_1";
      next.combat.bossTicks[bossId] = {
        tickId: envelope.requestId,
        atMs: nowMs,
        phase,
        enrageLevel,
        nextMechanicAtMs: nowMs + Math.max(1_000, payloadNumber(envelope, "mechanicIntervalMs") ?? 8_000),
      };
      touchedModels.add(envelope.subsystem);
      touchedModels.add("boss_encounter_state");
      sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("boss_encounter", bossId));
      break;
    }
    case "request_party_raid_credit": {
      if (!envelope.partyId && !envelope.raidId) {
        warnings.push("party_raid_credit_rejected:missing_group_id");
        touchedModels.add("party_raid_rejection");
        break;
      }
      const contribution = Math.max(0, Math.min(1, payloadNumber(envelope, "contributionScore") ?? 0));
      if (contribution <= 0) {
        warnings.push("party_raid_credit_rejected:no_contribution");
        touchedModels.add("party_raid_rejection");
        break;
      }
      next.combat.partyRaidCredits[envelope.requestId] = {
        creditId: envelope.requestId,
        partyId: envelope.partyId,
        raidId: envelope.raidId,
        contribution,
        atMs: nowMs,
        lockedOutUntilMs: envelope.raidId ? nowMs + Math.max(60_000, payloadNumber(envelope, "lockoutMs") ?? 86_400_000) : undefined,
      };
      touchedModels.add(envelope.subsystem);
      touchedModels.add("party_raid_credit");
      if (envelope.partyId) sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("party", envelope.partyId));
      if (envelope.raidId) sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("raid", envelope.raidId));
      break;
    }
  }

  return {
    state: next,
    summary: {
      version: HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1,
      applied: true,
      actionKind: envelope.actionKind,
      subsystem: envelope.subsystem,
      actorId: envelope.actorId,
      targetId: envelope.targetId,
      playerStateKey,
      sharedStateKeys: [...sharedStateKeys],
      warnings,
      touchedModels: [...touchedModels],
      buildingMaterializationPlans: buildingMaterializationPlans.length
        ? buildingMaterializationPlans
        : undefined,
    },
  };
}
