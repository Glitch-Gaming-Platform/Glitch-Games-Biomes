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
  getHarthmereCraftingStationV1,
  getHarthmereCraftingToolV1,
  registerHarthmereItemDefinitionV1,
  type HarthmereCraftingOutcomeV1,
  type HarthmereCraftingRecipeV1,
  type HarthmereItemDefinitionV1,
  type HarthmereInventorySnapshotV1,
  type HarthmereInventoryMutationRequestV1,
  type HarthmereInventoryMutationResultV1,
} from "./mmo_inventory_authority_v1";
import { ensureHarthmereProductionCraftingCatalogueV1 } from "./mmo_crafting_catalogue_v1";
import { ensureHarthmereProductionVendorCatalogV1 } from "./harthmere_vendor_catalog_v1";
import {
  defaultHarthmereHomeDecorationStateV1,
  normalizeHarthmereHomeDecorationStateV1,
  reduceHarthmereHomeDecorationMutationV1,
  type HarthmereHomeDecorationOperationV1,
  type HarthmereHomeDecorationStateV1,
} from "./home_decoration_authority_v1";
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
  HARTHMERE_ECONOMY_BASE_SALES_TAX_RATE_V1,
  HARTHMERE_ECONOMY_BUSINESS_TYPES_V1,
  HARTHMERE_ECONOMY_DEFAULT_REGION_ID_V1,
  HARTHMERE_ECONOMY_DEFAULT_TOWN_ID_V1,
  createHarthmereProductionEconomyClientSnapshotV1,
  defaultHarthmereProductionEconomyStateV1,
  normalizeHarthmereProductionEconomyStateV1,
  reduceHarthmereEconomyMutationV1,
  type HarthmereEconomyBusinessTypeIdV1,
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
import { harthmereJobsBoardQuestMarkerPositionForTodoV1 } from "./jobs_board_quest_marker_positions_v1";
import {
  HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS_V1,
  defaultHarthmereExoticMatterDepositStateV1,
  harthmereExoticMatterAcceptedJobDepositMarkersV1,
  harthmereExoticMatterDepositByIdV1,
  isHarthmereExoticMatterMaterialItemIdV1,
  mineHarthmereExoticMatterDepositV1,
  replenishHarthmereExoticMatterDepositsV1,
} from "./exotic_matter_caves_v1";
import {
  HARTHMERE_COOKING_RECIPES_V1,
  HARTHMERE_FOOD_DEFINITIONS_V1,
  HARTHMERE_SEED_DEFINITIONS_V1,
  collectHarthmereLivestockProductV1,
  cookHarthmereFoodV1,
  defaultHarthmereFoodStaminaStateV1,
  eatHarthmereFoodV1,
  feedHarthmereLivestockV1,
  forageHarthmereFoodSpawnV1,
  gatherHarthmereSeedV1,
  harvestHarthmereCropV1,
  huntHarthmereAnimalForFoodV1,
  plantHarthmereCropV1,
  tickHarthmereStaminaForGameplayV1,
  waterHarthmereCropV1,
  type HarthmereFarmingPlotV1,
  type HarthmereFoodStaminaStateV1,
  type HarthmereLivestockV1,
  type HarthmereWorldSpawnV1,
} from "./mmo_farming_food_stamina_v1";
import {
  defaultHarthmereMedicalHealthStateV1,
  receiveHarthmereDoctorTreatmentV1,
  useHarthmereMedicalItemV1,
  type HarthmereDoctorServiceSnapshotV1,
} from "./mmo_medical_health_v1";
import {
  HARTHMERE_INVENTORY_LOOT_DEFAULT_DROP_TTL_MS_V1,
  createHarthmereEmptyInventoryLootStateV1,
  createHarthmereInventoryLootActorV1,
  createHarthmereInventoryLootClientSnapshotV1,
  normalizeHarthmereInventoryLootStateV1,
  reduceHarthmereInventoryLootMutationV1,
  type HarthmereInventoryLootItemDefinitionV1,
  type HarthmereInventoryLootDropV1,
  type HarthmereInventoryLootStateV1,
} from "./mmo_inventory_loot_authority_v1";
import {
  applyHarthmereClassChoiceV1,
  applyHarthmereSpecializationChoiceV1,
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
  LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1,
  canCompleteLiveEntityHelperQuestV1,
  getLiveEntityHelperQuestForEntityV1,
  isLiveEntityHelperMuckBossSpawnMarkerV1,
  liveEntityHelperQuestDeltasV1,
  liveEntityHelperQuestItemCopyForIdV1,
  liveEntityHelperQuestTargetMarkerForKindV1,
  type LiveEntityHelperQuestEntityContextV1,
  type LiveEntityHelperQuestInstanceV1,
} from "./live_entity_helper_quests_v1";
import {
  createHarthmereNpcNavigationStateV1,
  resolveHarthmereNpcNavigationStepV1,
  type HarthmereNpcNavigationModeV1,
  type HarthmereNpcNavigationObstacleV1,
  type HarthmereNpcNavigationStateV1,
} from "./npc_navigation_guard_v1";
import {
  LIVE_ENTITY_ROBOT_RECHARGE_AMOUNT_V1,
  LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1,
  LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY_V1,
  LIVE_ENTITY_ROBOT_RECHARGE_REWARD_ITEMS_V1,
  LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP_V1,
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1,
  createLiveEntityRobotEnergyStateV1,
  liveEntityRobotProtectionAreaForPositionV1,
  liveEntityRobotProtectionBuildingMarkerV1,
  normalizeLiveEntityRobotEnergyStateV1,
  rechargeLiveEntityRobotEnergyV1,
  tickLiveEntityRobotEnergyV1,
  type LiveEntityRobotEnergyStateV1,
} from "./live_entity_robot_energy_protection_v1";
import { evaluateMuckMonsterAggressionV1 } from "./muck_monster_aggression_ai_v1";

import {
  buildingSystemBlueprintByIdV1,
  buildingSystemBlueprintByItemIdV1,
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
  createBuildingSystemHomeConsoleMarkerV1,
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
  createBuildingSystemMuckClaimMaterializationPlanV1,
  createBuildingSystemSafeGroundMaterializationPlanV1,
  createBuildingSystemStageMaterializationPlanV1,
  buildingSystemHomeConsoleMarkerIdV1,
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
import {
  createHarthmereBusinessOutpostRebuildMaterializationPlansV1,
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1,
  HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION_V1,
  isPointInsideHarthmereBusinessSafeSiteV1,
} from "./business_customer_simulator_v1";

export const HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1 =
  "harthmere-live-mode-backend-v1";

export const HARTHMERE_READ_JOBS_BOARD_QUEST_ID_V140 = "read-the-jobs-board";
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

export type HarthmereLiveEntityKindV1 =
  | "npc"
  | "human"
  | "monster"
  | "mux"
  | "hex"
  | "robot"
  | "undead"
  | "animal"
  | "construct"
  | "pet"
  | "summon"
  | "object"
  | "live_entity";

export type HarthmereLiveEntityAnimationStateV1 =
  | "idle"
  | "walk"
  | "run"
  | "flee"
  | "attack"
  | "hit"
  | "death";

export type HarthmereLiveEntityCombatProtectionV1 =
  | "protected_species"
  | "livestock"
  | "owned_pet"
  | "friendly_noncombatant"
  | "label_or_place"
  | "immobile_object";

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

export type HarthmereLiveModeCrimeKindV1 =
  | "theft"
  | "pickpocket"
  | "lockpicking"
  | "trespassing"
  | "assault"
  | "murder"
  | "smuggling"
  | "illegal_magic"
  | "bribery"
  | "arson";

export type HarthmereLiveModeGuardResponseLevelV1 =
  | "warning"
  | "questioning"
  | "fine"
  | "confiscation"
  | "arrest_attempt"
  | "combat"
  | "reinforcements"
  | "city_lockdown";

export interface HarthmereLiveModeCrimeRecordV1 {
  id: string;
  actorId: string;
  kind: HarthmereLiveModeCrimeKindV1;
  zoneId: string;
  factionId: string;
  locationId?: string;
  targetId?: string;
  restrictedAreaId?: string;
  resourceNodeId?: string;
  resourceOwnership?: string;
  itemIds: string[];
  severity: number;
  valueGold: number;
  witnessLevel: string;
  witnesses: number;
  detected: boolean;
  detectionScore: number;
  response: HarthmereLiveModeGuardResponseLevelV1;
  fineGold: number;
  bountyGold?: number;
  confiscatedItemIds: string[];
  evidenceExpiresAtMs: number;
  status:
    | "recorded"
    | "warned"
    | "fined"
    | "confiscated"
    | "arrest_pending"
    | "jailed"
    | "wanted";
  createdAtMs: number;
}

export interface HarthmereLiveModeGuardResponseRecordV1 {
  id: string;
  crimeId: string;
  actorId: string;
  zoneId: string;
  response: HarthmereLiveModeGuardResponseLevelV1;
  fineGold: number;
  confiscatedItemIds: string[];
  detentionUntilMs?: number;
  cityLockdown: boolean;
  createdAtMs: number;
}

export interface HarthmereLiveModeRestrictedTrespassRecordV1 {
  actorId: string;
  zoneId: string;
  areaId: string;
  enteredAtMs: number;
  lastCrimeId?: string;
  lastEscalatedAtMs?: number;
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

export type HarthmereLiveModeCraftingJobStatusV1 =
  | "active"
  | "completed"
  | "cancelled"
  | "failed";

export interface HarthmereLiveModeCraftingJobV1 {
  jobId: string;
  actorId: string;
  recipeId: string;
  count: number;
  stationId?: string;
  stationType?: string;
  toolItemIds: string[];
  optionalReagentItemIds: string[];
  targetItemId?: string;
  workflowStepIds: string[];
  qualitySeed?: number;
  startedAtMs: number;
  readyAtMs: number;
  status: HarthmereLiveModeCraftingJobStatusV1;
  reservedItemDeltas: Record<string, number>;
  reservedMaterialStorageDeltas: Record<string, number>;
  reservedGoldDelta: number;
  outcome?: HarthmereCraftingOutcomeV1;
}

export interface HarthmereLiveModeCraftingStateV1 {
  activeJobs: Record<string, HarthmereLiveModeCraftingJobV1>;
  history: HarthmereLiveModeCraftingJobV1[];
  nextJobNumber: number;
  /** Count-inventory bridge for crafting tool wear until durable item instances are authoritative everywhere. */
  toolDurability: Record<string, number>;
  /** Count-inventory bridge for repair/upgrade/enchant workflows until item instances back every crafted item. */
  itemDurability: Record<string, number>;
}

export interface HarthmereQuestInviteRecordV1 {
  inviteId: string;
  sharedQuestId: string;
  questId: string;
  questTitle: string;
  questArea: string;
  objectiveText: string;
  reward?: string;
  inviterActorId: string;
  inviteeActorId: string;
  status: "pending";
  createdAtMs: number;
  firstMarkerId?: string;
  markerWorldPosition?: [number, number, number];
}

export interface HarthmereSharedQuestPartyRecordV1 {
  sharedQuestId: string;
  questId: string;
  questTitle: string;
  questArea: string;
  objectiveText: string;
  reward?: string;
  memberActorIds: string[];
  inviteIds: string[];
  createdAtMs: number;
  updatedAtMs: number;
  firstMarkerId?: string;
  markerWorldPosition?: [number, number, number];
}

export interface HarthmereLiveModeQuestInviteStateV1 {
  invites: Record<string, HarthmereQuestInviteRecordV1>;
  sharedQuests: Record<string, HarthmereSharedQuestPartyRecordV1>;
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
  /** Server-owned timed crafting jobs and rich crafting outcome history. */
  crafting: HarthmereLiveModeCraftingStateV1;
  /** Server-owned home and business decoration placements with functional effects. */
  homeDecoration: HarthmereHomeDecorationStateV1;
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
    safeZones: Record<
      string,
      { safeFromMuck: boolean; activatedAtMs: number; area: string }
    >;
    /** Authoritative active/finished construction projects; local UI state is not truth. */
    activeProjects: Record<string, BuildingSystemProjectRecordV1>;
    /** In-world plot/deed/map/NPC marker records created by server-approved building actions. */
    inWorldMarkers: Record<string, BuildingSystemInWorldMarkerV1>;
    materializationPlans: Record<
      string,
      BuildingSystemAnyMaterializationPlanV1
    >;
    storageContainers: Record<string, BuildingSystemStorageContainerRecordV1>;
    doorLocks: Record<string, BuildingSystemDoorLockRecordV1>;
    // Tracks which revision of the business-outpost voxel plans has been
    // applied to the world. When this doesn't match
    // HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION_V1 the server auto-queues
    // a cleanup+rebuild on the next read_state so buildings always match the
    // current code without requiring an admin tool call.
    outpostBuildRevision?: string;
  };
  /** Robot power state that controls whether remote Muck edges stay protected. */
  robotProtection: LiveEntityRobotEnergyStateV1;
  guild: HarthmereLiveModeGuildStateV1;
  banking: HarthmereLiveModeBankingStateV1;
  law: {
    reputation: Record<string, number>;
    standing: Record<string, HarthmereLiveModeReputationStandingV1>;
    recentReputationEvents: HarthmereLiveModeReputationEventV1[];
    fines: Record<string, number>;
    flags: Record<string, boolean>;
    crimeLog: Array<{ id: string; kind: string; atMs: number; zoneId: string }>;
    crimeRecords: HarthmereLiveModeCrimeRecordV1[];
    guardResponses: HarthmereLiveModeGuardResponseRecordV1[];
    restrictedTrespass: Record<
      string,
      HarthmereLiveModeRestrictedTrespassRecordV1
    >;
    detentionUntilMs: Record<string, number>;
  };
  classMagic: {
    classId?: string;
    specializationId?: string;
    knownAbilities: string[];
    knownRecipes: string[];
    skills: Record<string, { xp: number; level: number }>;
    magicSchools: Record<
      string,
      { xp: number; level: number; illegal: boolean }
    >;
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
  questInvites: HarthmereLiveModeQuestInviteStateV1;
  property: {
    owned: Record<string, BuildingSystemPropertyRecordV1>;
    buildingProgress: Record<string, number>;
  };
  farming: {
    plots: Record<
      string,
      {
        cropId: string;
        seedItemId?: string;
        cropItemId?: string;
        plantedAtMs: number;
        wateredAtMs?: number;
        harvestReadyAtMs?: number;
        harvestedAtMs?: number;
        state: string;
      }
    >;
    harvests: Record<string, number>;
    livestock: Record<string, HarthmereLivestockV1>;
  };
  mail: {
    messages: Record<
      string,
      {
        mailId: string;
        recipientActorId: string;
        senderActorId?: string;
        status: "unread" | "read" | "claimed" | "deleted";
        attachments: Record<string, number>;
        createdAtMs: number;
        claimedAtMs?: number;
      }
    >;
  };
  careLoops: HarthmereCareLoopStateV1;
  combat: {
    hp: number;
    maxHp: number;
    resources: Partial<Record<HarthmereResourceKindV1, number>>;
    maxResources: Partial<Record<HarthmereResourceKindV1, number>>;
    lastStaminaTickMs?: number;
    deadFromStaminaAtMs?: number;
    cooldowns: Record<string, number>;
    deathState?: "alive" | "downed" | "dead";
    deathRecords: Record<
      string,
      {
        deathId: string;
        cause: string;
        zoneId: string;
        atMs: number;
        respawnAvailableAtMs: number;
      }
    >;
    respawnProtectionUntilMs?: number;
    threat: Record<string, number>;
    lootClaims: Record<string, number>;
    entitySnapshots: Record<
      string,
      {
        hp: number;
        maxHp: number;
        position: { x: number; y: number; z: number };
        isHostile: boolean;
        isAlive: boolean;
        isAttackable: boolean;
        isPlayer?: boolean;
        pvpFlagged?: boolean;
        zonePvPRule?: HarthmereZoneSnapshotV1["pvpRule"];
        isLivestock?: boolean;
        protectedSpecies?: boolean;
        ownerId?: string;
        species?: string;
        level?: number;
        entityKind?: HarthmereLiveEntityKindV1;
        homePosition?: { x: number; y: number; z: number };
        movementSpeed?: number;
        bodyRadius?: number;
        patrolRadius?: number;
        aggroRange?: number;
        leashRange?: number;
        requiresLineOfSight?: boolean;
        aiEnabled?: boolean;
        navigationObstacles?: HarthmereNpcNavigationObstacleV1[];
        animationState?: HarthmereLiveEntityAnimationStateV1;
        animationStartedAtMs?: number;
        animationMoving?: boolean;
        facingYaw?: number;
        resources?: Partial<Record<HarthmereResourceKindV1, number>>;
        maxResources?: Partial<Record<HarthmereResourceKindV1, number>>;
        cooldowns?: Record<string, number>;
        attackRange?: number;
        combatProtection?: HarthmereLiveEntityCombatProtectionV1;
        retaliatesWhenAttacked?: boolean;
        lastAttackerId?: string;
        lastAttackedAtMs?: number;
        lastDamageTaken?: number;
        lastAiAttackAtMs?: number;
        lastAiAttackDamage?: number;
        lastAiAttackTargetId?: string;
        lastAiAttackResourceKind?: HarthmereResourceKindV1;
        lastAiAttackResourceAfter?: number;
        killedByActorId?: string;
        defeatedAtMs?: number;
        lootDrops?: Record<string, number>;
        lootOwnerActorIds?: string[];
        lootDropId?: string;
      }
    >;
    npcAiTicks: Record<
      string,
      {
        tickId: string;
        atMs: number;
        decision: string;
        targetId?: string;
        entityKind?: HarthmereLiveEntityKindV1;
        movementMode?: HarthmereNpcNavigationModeV1;
        positionFrom?: { x: number; y: number; z: number };
        positionTo?: { x: number; y: number; z: number };
        velocity?: { x: number; y: number; z: number };
        facingYaw?: number;
        navigationResolution?: "direct" | "slide" | "sidestep" | "hold";
        navigationBlocked?: boolean;
        animationState?: HarthmereLiveEntityAnimationStateV1;
        animationMoving?: boolean;
        playerDamage?: number;
        playerHpBefore?: number;
        playerHpAfter?: number;
        playerDeathState?: "alive" | "downed" | "dead";
        attackBlockedReason?: string;
        nextThinkAtMs: number;
      }
    >;
    liveEntityNavigation: Record<string, HarthmereNpcNavigationStateV1>;
    bossTicks: Record<
      string,
      {
        tickId: string;
        atMs: number;
        phase: string;
        enrageLevel: number;
        nextMechanicAtMs: number;
      }
    >;
    partyRaidCredits: Record<
      string,
      {
        creditId: string;
        partyId?: string;
        raidId?: string;
        contribution: number;
        atMs: number;
        lockedOutUntilMs?: number;
      }
    >;
  };
}

export const HARTHMERE_LIVE_MODE_SHARED_WORLD_ID_V1 = "harthmere" as const;

export interface HarthmereLiveModeSharedLawStateV1 {
  reputation: Record<string, number>;
  standing: Record<string, HarthmereLiveModeReputationStandingV1>;
  recentReputationEvents: HarthmereLiveModeReputationEventV1[];
  fines: Record<string, number>;
  flags: Record<string, boolean>;
  crimeLog: Array<{ id: string; kind: string; atMs: number; zoneId: string }>;
  crimeRecords: HarthmereLiveModeCrimeRecordV1[];
  guardResponses: HarthmereLiveModeGuardResponseRecordV1[];
  restrictedTrespass: Record<
    string,
    HarthmereLiveModeRestrictedTrespassRecordV1
  >;
  detentionUntilMs: Record<string, number>;
}

export interface HarthmereLiveModeSharedWorldStateV1 {
  version: typeof HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1;
  worldId: typeof HARTHMERE_LIVE_MODE_SHARED_WORLD_ID_V1;
  updatedAtMs: number;
  economyProduction: HarthmereProductionEconomyStateV1;
  jobsBoard: HarthmereJobsBoardStateV1;
  building: HarthmereLiveModeSharedBuildingStateV1;
  law: HarthmereLiveModeSharedLawStateV1;
  guild: HarthmereLiveModeGuildStateV1;
  robotProtection: LiveEntityRobotEnergyStateV1;
  exoticMatterDepositClaims: Record<string, number>;
  questInvites: HarthmereLiveModeQuestInviteStateV1;
}

export interface HarthmereLiveModeSharedBuildingStateV1 {
  placedStructures: HarthmereLiveModeBackendStateV1["building"]["placedStructures"];
  safeZones: HarthmereLiveModeBackendStateV1["building"]["safeZones"];
  inWorldMarkers: HarthmereLiveModeBackendStateV1["building"]["inWorldMarkers"];
  materializationPlans: HarthmereLiveModeBackendStateV1["building"]["materializationPlans"];
  storageContainers: HarthmereLiveModeBackendStateV1["building"]["storageContainers"];
  doorLocks: HarthmereLiveModeBackendStateV1["building"]["doorLocks"];
}

function normalizeHarthmereLiveModeSharedBuildingStateV1(
  raw: unknown
): HarthmereLiveModeSharedBuildingStateV1 {
  const value = raw && typeof raw === "object" ? (raw as any) : {};
  return {
    placedStructures: { ...(value.placedStructures ?? {}) },
    safeZones: { ...(value.safeZones ?? {}) },
    inWorldMarkers: { ...(value.inWorldMarkers ?? {}) },
    materializationPlans: { ...(value.materializationPlans ?? {}) },
    storageContainers: { ...(value.storageContainers ?? {}) },
    doorLocks: { ...(value.doorLocks ?? {}) },
  };
}

function cleanQuestInviteTextV1(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 160)
    : fallback;
}

function cleanQuestInviteIdV1(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 160)
    : undefined;
}

function normalizeQuestInviteVec3V1(
  value: unknown
): [number, number, number] | undefined {
  if (!Array.isArray(value) || value.length < 3) return undefined;
  const x = Number(value[0]);
  const y = Number(value[1]);
  const z = Number(value[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return undefined;
  }
  return [x, y, z];
}

function uniqueQuestInviteActorIdsV1(values: unknown) {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .map((value) => cleanQuestInviteIdV1(value))
        .filter((value): value is string => Boolean(value))
    ),
  ].slice(0, 24);
}

function normalizeHarthmereQuestInviteStateV1(
  raw: unknown,
  nowMs: number
): HarthmereLiveModeQuestInviteStateV1 {
  const value = raw && typeof raw === "object" ? (raw as any) : {};
  const invites: Record<string, HarthmereQuestInviteRecordV1> = {};
  for (const [key, rawInvite] of Object.entries(
    (value.invites ?? {}) as Record<string, unknown>
  )) {
    if (!rawInvite || typeof rawInvite !== "object") continue;
    const invite = rawInvite as any;
    const inviteId = cleanQuestInviteIdV1(invite.inviteId) ?? key;
    const questId = cleanQuestInviteIdV1(invite.questId);
    const inviterActorId = cleanQuestInviteIdV1(invite.inviterActorId);
    const inviteeActorId = cleanQuestInviteIdV1(invite.inviteeActorId);
    if (!inviteId || !questId || !inviterActorId || !inviteeActorId) continue;
    if (invite.status && invite.status !== "pending") continue;
    invites[inviteId] = {
      inviteId,
      sharedQuestId:
        cleanQuestInviteIdV1(invite.sharedQuestId) ??
        `shared_quest:${questId}:${inviterActorId}`,
      questId,
      questTitle: cleanQuestInviteTextV1(invite.questTitle, questId),
      questArea: cleanQuestInviteTextV1(invite.questArea, "Quest"),
      objectiveText: cleanQuestInviteTextV1(
        invite.objectiveText,
        "Join this quest together."
      ),
      reward:
        typeof invite.reward === "string" && invite.reward.trim()
          ? invite.reward.trim().slice(0, 160)
          : undefined,
      inviterActorId,
      inviteeActorId,
      status: "pending",
      createdAtMs: Math.max(
        0,
        Math.trunc(Number(invite.createdAtMs ?? nowMs) || nowMs)
      ),
      firstMarkerId: cleanQuestInviteIdV1(invite.firstMarkerId),
      markerWorldPosition: normalizeQuestInviteVec3V1(
        invite.markerWorldPosition
      ),
    };
  }

  const sharedQuests: Record<string, HarthmereSharedQuestPartyRecordV1> = {};
  for (const [key, rawQuest] of Object.entries(
    (value.sharedQuests ?? {}) as Record<string, unknown>
  )) {
    if (!rawQuest || typeof rawQuest !== "object") continue;
    const quest = rawQuest as any;
    const sharedQuestId = cleanQuestInviteIdV1(quest.sharedQuestId) ?? key;
    const questId = cleanQuestInviteIdV1(quest.questId);
    if (!sharedQuestId || !questId) continue;
    const memberActorIds = uniqueQuestInviteActorIdsV1(quest.memberActorIds);
    if (memberActorIds.length === 0) continue;
    sharedQuests[sharedQuestId] = {
      sharedQuestId,
      questId,
      questTitle: cleanQuestInviteTextV1(quest.questTitle, questId),
      questArea: cleanQuestInviteTextV1(quest.questArea, "Quest"),
      objectiveText: cleanQuestInviteTextV1(
        quest.objectiveText,
        "Complete this quest together."
      ),
      reward:
        typeof quest.reward === "string" && quest.reward.trim()
          ? quest.reward.trim().slice(0, 160)
          : undefined,
      memberActorIds,
      inviteIds: uniqueQuestInviteActorIdsV1(quest.inviteIds),
      createdAtMs: Math.max(
        0,
        Math.trunc(Number(quest.createdAtMs ?? nowMs) || nowMs)
      ),
      updatedAtMs: Math.max(
        0,
        Math.trunc(Number(quest.updatedAtMs ?? nowMs) || nowMs)
      ),
      firstMarkerId: cleanQuestInviteIdV1(quest.firstMarkerId),
      markerWorldPosition: normalizeQuestInviteVec3V1(
        quest.markerWorldPosition
      ),
    };
  }
  return { invites, sharedQuests };
}

function isHarthmereLiveModePublicLawFlagV1(flagId: string) {
  return (
    flagId === "city_lockdown" ||
    flagId.endsWith("_lockdown") ||
    flagId.startsWith("zone_lockdown:")
  );
}

function publicLawFlagsV1(flags: Record<string, boolean>) {
  return Object.fromEntries(
    Object.entries(flags).filter(
      ([flagId, enabled]) =>
        enabled && isHarthmereLiveModePublicLawFlagV1(flagId)
    )
  );
}

function mergeByIdNewestFirstV1<T extends { id: string }>(
  local: T[],
  shared: T[],
  limit: number
) {
  const byId = new Map<string, T>();
  for (const entry of [...shared, ...local]) {
    if (!entry?.id || byId.has(entry.id)) continue;
    byId.set(entry.id, entry);
  }
  return [...byId.values()].slice(0, limit);
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

function recordDelta(
  target: Record<string, number>,
  key: string,
  delta: number
) {
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
  return Math.max(
    0,
    Math.max(Math.round(Number(value) || 0), Math.round(floor))
  );
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
    Math.round(
      standing.notorietyFloor + (delta.notorietyFloor ?? 0) * multiplier
    )
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
  const normalized = String(value ?? "mana")
    .trim()
    .toLowerCase();
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
      Math.min(max, Number.isFinite(rawResource) ? rawResource : max)
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
const HARTHMERE_LIVE_ENTITY_NPC_ATTACK_ABILITY_ID_V1 =
  "live_entity_npc_attack_v1";

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
      availableSpecializations: classDef.specializations,
      primaryResource: resourceKind,
      maxResourceByLevel: { 1: liveModeResourceMaxV1(resourceKind, 1) },
      hpPerLevel: 20,
      baseHp: 100,
      attackPowerPerLevel: [
        "mage",
        "priest",
        "druid",
        "necromancer",
        "bard",
      ].includes(classDef.id)
        ? 1
        : 3,
      spellPowerPerLevel: [
        "mage",
        "priest",
        "druid",
        "necromancer",
        "bard",
      ].includes(classDef.id)
        ? 4
        : 1,
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
      cooldownMs: Math.max(
        250,
        Math.trunc(Number(ability.cooldown) || 1) * 1000
      ),
      sharedCooldownCategory:
        ability.kind === "combat" ? "global_combat" : undefined,
      sharedCooldownMs: ability.kind === "combat" ? 750 : undefined,
      rangeUnits: isSupport ? 0 : ability.kind === "combat" ? 12 : 4,
      requiresLineOfSight: isOffensive,
      allowedInSafeZone: ability.kind !== "combat",
      allowedInPvP: ability.kind === "combat",
      baseDamage: isOffensive ? 12 : 0,
      baseHealing: isSupport ? 18 : 0,
      attackPowerScaling: isOffensive ? 0.8 : 0,
      spellPowerScaling:
        isSupport ||
        ["mage", "priest", "druid", "necromancer", "bard"].some((id) =>
          ability.classRequirements?.includes(id as any)
        )
          ? 0.7
          : 0,
      xpReward: isOffensive ? 20 : isSupport ? 8 : 0,
      castTimeMs: 0,
      interruptible: ability.kind === "combat",
      unlocksMilestones: [],
    });
  }
}

function ensureHarthmereLiveEntityNpcAttackAbilityV1() {
  if (getHarthmereAbilityV1(HARTHMERE_LIVE_ENTITY_NPC_ATTACK_ABILITY_ID_V1)) {
    return;
  }
  registerHarthmereAbilityV1({
    abilityId: HARTHMERE_LIVE_ENTITY_NPC_ATTACK_ABILITY_ID_V1,
    displayName: "Live Entity Attack",
    targetType: "single_enemy",
    classRestriction: [],
    specRestriction: [],
    levelRequirement: 1,
    requiredWeaponType: "any",
    resourceKind: "mana",
    resourceCost: 0,
    cooldownMs: 1_000,
    sharedCooldownCategory: undefined,
    sharedCooldownMs: undefined,
    rangeUnits: 3.5,
    requiresLineOfSight: false,
    allowedInSafeZone: true,
    allowedInPvP: true,
    baseDamage: 12,
    baseHealing: 0,
    attackPowerScaling: 0.8,
    spellPowerScaling: 0,
    xpReward: 0,
    castTimeMs: 0,
    interruptible: false,
    unlocksMilestones: [],
  });
}

function abilityResourceKindForLiveModeV1(
  abilityId: string | undefined,
  classId: string | undefined
): HarthmereResourceKindV1 {
  const registered = abilityId ? getHarthmereAbilityV1(abilityId) : undefined;
  if (registered) {
    return registered.resourceKind;
  }
  const ability = abilityId
    ? HARTHMERE_ABILITY_DEFINITIONS_V1[abilityId]
    : undefined;
  if (ability) {
    return normalizeHarthmereResourceKindV1(ability.resource);
  }
  const classDef = classId
    ? HARTHMERE_CLASS_DEFINITIONS_V1[
        classId as keyof typeof HARTHMERE_CLASS_DEFINITIONS_V1
      ]
    : undefined;
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
  const repeated = Math.max(
    0,
    Math.trunc(Number(input.repeatedFarmCount) || 0)
  );
  const samePlayer = Math.max(
    0,
    Math.trunc(Number(input.samePlayerKillCountWithinWindow) || 0)
  );
  const repeatedMultiplier =
    repeated <= 2 ? 1 : repeated <= 5 ? 0.5 : repeated <= 9 ? 0.25 : 0;
  const samePlayerMultiplier = samePlayer <= 1 ? 1 : samePlayer <= 2 ? 0.25 : 0;
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

function normalizeBankingStateV1(
  raw: Partial<HarthmereLiveModeBankingStateV1> | undefined
): HarthmereLiveModeBankingStateV1 {
  const defaults = defaultHarthmereLiveModeBankingStateV1();
  const next = {
    ...defaults,
    ...(raw ?? {}),
    accountBank: { ...defaults.accountBank, ...(raw?.accountBank ?? {}) },
    materialStorage: {
      ...defaults.materialStorage,
      ...(raw?.materialStorage ?? {}),
    },
    transactionLogs: Array.isArray(raw?.transactionLogs)
      ? raw!.transactionLogs.slice(-100)
      : [],
    loans: { ...defaults.loans, ...(raw?.loans ?? {}) },
  };
  next.personalBankMaxSlots = clampBankSlotLimitV1(
    next.personalBankMaxSlots,
    HARTHMERE_PERSONAL_BANK_BASE_SLOTS_V1
  );
  next.accountBankMaxSlots = clampBankSlotLimitV1(
    next.accountBankMaxSlots,
    HARTHMERE_ACCOUNT_BANK_BASE_SLOTS_V1
  );
  next.materialStorageMaxSlots = clampBankSlotLimitV1(
    next.materialStorageMaxSlots,
    HARTHMERE_MATERIAL_STORAGE_BASE_SLOTS_V1
  );
  next.nextLoanNumber = Math.max(
    1,
    Math.trunc(Number(next.nextLoanNumber) || 1)
  );
  return next;
}

export function defaultHarthmereLiveModeCraftingStateV1(): HarthmereLiveModeCraftingStateV1 {
  return {
    activeJobs: {},
    history: [],
    nextJobNumber: 1,
    toolDurability: {},
    itemDurability: {},
  };
}

function normalizeCraftingJobV1(
  raw: Partial<HarthmereLiveModeCraftingJobV1> | undefined,
  fallbackJobId: string
): HarthmereLiveModeCraftingJobV1 | undefined {
  if (!raw?.recipeId || !raw.actorId) return undefined;
  const status: HarthmereLiveModeCraftingJobStatusV1 =
    raw.status === "completed" ||
    raw.status === "cancelled" ||
    raw.status === "failed" ||
    raw.status === "active"
      ? raw.status
      : "active";
  return {
    jobId: raw.jobId ?? fallbackJobId,
    actorId: raw.actorId,
    recipeId: raw.recipeId,
    count: Math.max(1, Math.trunc(Number(raw.count) || 1)),
    stationId: raw.stationId,
    stationType: raw.stationType,
    toolItemIds: Array.isArray(raw.toolItemIds) ? raw.toolItemIds : [],
    optionalReagentItemIds: Array.isArray(raw.optionalReagentItemIds)
      ? raw.optionalReagentItemIds
      : [],
    targetItemId: raw.targetItemId,
    workflowStepIds: Array.isArray(raw.workflowStepIds)
      ? raw.workflowStepIds
      : [],
    qualitySeed: Number.isFinite(raw.qualitySeed)
      ? Math.trunc(Number(raw.qualitySeed))
      : undefined,
    startedAtMs: Math.max(0, Math.trunc(Number(raw.startedAtMs) || 0)),
    readyAtMs: Math.max(0, Math.trunc(Number(raw.readyAtMs) || 0)),
    status,
    reservedItemDeltas: { ...(raw.reservedItemDeltas ?? {}) },
    reservedMaterialStorageDeltas: {
      ...(raw.reservedMaterialStorageDeltas ?? {}),
    },
    reservedGoldDelta: Math.trunc(Number(raw.reservedGoldDelta) || 0),
    outcome: raw.outcome,
  };
}

function normalizeCraftingStateV1(
  raw: Partial<HarthmereLiveModeCraftingStateV1> | undefined
): HarthmereLiveModeCraftingStateV1 {
  const activeJobs: Record<string, HarthmereLiveModeCraftingJobV1> = {};
  for (const [jobId, rawJob] of Object.entries(raw?.activeJobs ?? {})) {
    const job = normalizeCraftingJobV1(rawJob, jobId);
    if (job && job.status === "active") activeJobs[job.jobId] = job;
  }
  const rawHistory = raw?.history;
  const history = Array.isArray(rawHistory)
    ? rawHistory
        .map((job, index) =>
          normalizeCraftingJobV1(job, (job as any)?.jobId ?? `history_${index}`)
        )
        .filter((job): job is HarthmereLiveModeCraftingJobV1 => Boolean(job))
        .slice(-100)
    : [];
  return {
    activeJobs,
    history,
    nextJobNumber: Math.max(1, Math.trunc(Number(raw?.nextJobNumber) || 1)),
    toolDurability: { ...(raw?.toolDurability ?? {}) },
    itemDurability: { ...(raw?.itemDurability ?? {}) },
  };
}

function clampBankSlotLimitV1(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(
    fallback,
    Math.min(HARTHMERE_BANK_MAX_SLOTS_V1, Math.trunc(value))
  );
}

function countOccupiedBankSlotsV1(record: Record<string, number>) {
  return Object.values(record).filter((count) => Number(count) > 0).length;
}

function bankRecordHasCapacityV1(
  record: Record<string, number>,
  itemId: string,
  maxSlots: number
) {
  return (
    (record[itemId] ?? 0) > 0 || countOccupiedBankSlotsV1(record) < maxSlots
  );
}

function applyBankRecordDeltaV1(
  record: Record<string, number>,
  itemId: string,
  delta: number
) {
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

function ensureProductionBusinessForPropertyBusinessV1(input: {
  state: HarthmereLiveModeBackendStateV1;
  business: BuildingSystemBusinessRecordV1;
  property: BuildingSystemPropertyRecordV1;
  nowMs: number;
  warnings: string[];
  touchedModels: Set<string>;
  sharedStateKeys: Set<string>;
}) {
  const typeId = input.business.type as HarthmereEconomyBusinessTypeIdV1;
  const def = HARTHMERE_ECONOMY_BUSINESS_TYPES_V1[typeId];
  if (!def) {
    input.warnings.push(
      "production_business_bridge_rejected:unknown_business_type"
    );
    input.touchedModels.add("economy_production_bridge_rejection");
    return false;
  }

  const existing =
    input.state.economy.production.businesses[input.business.businessId];
  if (existing) {
    if (
      existing.ownerKind !== "player" ||
      existing.ownerId !== input.business.ownerId ||
      existing.typeId !== typeId
    ) {
      input.warnings.push(
        "production_business_bridge_rejected:business_id_conflict"
      );
      input.touchedModels.add("economy_production_bridge_rejection");
      return false;
    }
    existing.propertyId = input.property.propertyId;
    existing.townId ??= HARTHMERE_ECONOMY_DEFAULT_TOWN_ID_V1;
    existing.regionId ||= HARTHMERE_ECONOMY_DEFAULT_REGION_ID_V1;
    existing.status =
      existing.status === "closed" || existing.status === "bankrupt"
        ? existing.status
        : "open";
    existing.licenseLevel = Math.max(
      existing.licenseLevel,
      def.minimumLicenseLevel
    );
    existing.updatedAtMs = input.nowMs;
    input.touchedModels.add("economy_production_business_linked");
    input.sharedStateKeys.add(
      `harthmere:economy:business:${existing.businessId}`
    );
    return true;
  }

  input.state.economy.production.businesses[input.business.businessId] = {
    businessId: input.business.businessId,
    ownerKind: "player",
    ownerId: input.business.ownerId,
    typeId,
    name: `${def.displayName} - ${input.property.propertyId
      .replace(/^property_/, "")
      .replaceAll("_", " ")}`,
    status: "open",
    licenseClass: def.requiredLicense,
    licenseLevel: Math.max(
      def.minimumLicenseLevel,
      input.business.licenseLevel
    ),
    propertyId: input.property.propertyId,
    townId: HARTHMERE_ECONOMY_DEFAULT_TOWN_ID_V1,
    regionId: HARTHMERE_ECONOMY_DEFAULT_REGION_ID_V1,
    inventory: {},
    storageMaxSlots: def.baseStorageSlots,
    employees: [],
    activeContracts: [],
    completedContracts: 0,
    reputation: input.business.reputation,
    customerSatisfaction: input.business.customerSatisfaction,
    sanitationRating: 65,
    safetyRating: 65,
    serviceRadius: Math.max(1, input.business.serviceRadius),
    priceModifiers: {},
    balanceGold: def.startCostGold,
    debtGold: 0,
    upkeepGoldPerDay: def.baseUpkeepGoldPerDay,
    rentGoldPerDay: 0,
    wageGoldPerDay: 0,
    salesTaxRate: Math.max(
      HARTHMERE_ECONOMY_BASE_SALES_TAX_RATE_V1,
      input.property.businessTaxRate || input.property.taxRate || 0
    ),
    lastTickAtMs: input.nowMs,
    createdAtMs: input.nowMs,
    updatedAtMs: input.nowMs,
    flags: {
      propertyHosted: true,
      productionBridge: true,
    },
  };
  input.state.economy.ledger.push({
    id: `${input.business.businessId}:production_bridge:${input.nowMs}`,
    kind: "production_business_linked",
    amount: 0,
    atMs: input.nowMs,
  });
  input.touchedModels.add("economy_production_business_linked");
  input.touchedModels.add("economy_production_state");
  input.touchedModels.add("economy_ledger");
  input.sharedStateKeys.add(
    `harthmere:economy:business:${input.business.businessId}`
  );
  return true;
}

function itemCategoryFromDefinitionV1(
  def: HarthmereItemDefinitionV1 | undefined,
  itemId: string
) {
  const text = `${itemId} ${def?.displayName ?? ""}`.toLowerCase();
  if (def?.isCurrency) return "currency";
  if (def?.isQuestItem || def?.binding === "quest") return "quest";
  if (def?.isCraftingMaterial || isLikelyBankingMaterialItemIdV1(itemId))
    return "materials";
  if (def?.isConsumable || /potion|food|ration|drink|meal|medicine/.test(text))
    return "consumables";
  if (
    /sword|axe|pickaxe|tool|hammer|bow|staff|wand|shield|armor|helm|boots|glove/.test(
      text
    )
  )
    return "tools";
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
      def?.stats?.mass
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
  count: number
) {
  if (!itemId || count <= 0) {
    return false;
  }
  const nextWeight =
    harthmereInventoryCarryWeightV1(items) +
    harthmereItemUnitWeightV1(itemId) * Math.max(1, Math.trunc(count));
  return nextWeight > HARTHMERE_CARRY_WEIGHT_LIMIT_V1;
}

function wouldStacksExceedCarryWeightV1(
  items: Record<string, number>,
  stacks: Record<string, number>
) {
  const projected = { ...items };
  for (const [itemId, count] of Object.entries(stacks)) {
    applyBankRecordDeltaV1(projected, itemId, Math.trunc(Number(count) || 0));
  }
  return (
    harthmereInventoryCarryWeightV1(projected) > HARTHMERE_CARRY_WEIGHT_LIMIT_V1
  );
}

function wouldCraftExceedCarryWeightV1(
  items: Record<string, number>,
  recipe: HarthmereCraftingRecipeV1 | undefined,
  craftCount = 1
) {
  if (!recipe) {
    return false;
  }
  const count = Math.max(1, Math.trunc(craftCount));
  const projected = { ...items };
  for (const input of recipe.inputs) {
    applyBankRecordDeltaV1(projected, input.itemId, -input.count * count);
  }
  applyBankRecordDeltaV1(
    projected,
    recipe.outputItemId,
    recipe.outputCount * count
  );
  return (
    harthmereInventoryCarryWeightV1(projected) > HARTHMERE_CARRY_WEIGHT_LIMIT_V1
  );
}

function wouldCraftCompletionExceedCarryWeightV1(
  items: Record<string, number>,
  recipe: HarthmereCraftingRecipeV1 | undefined,
  craftCount = 1,
  targetItemId?: string
) {
  if (!recipe) {
    return false;
  }
  const count = Math.max(1, Math.trunc(craftCount));
  const projected = { ...items };
  if (recipe.consumeTargetOnSuccess && targetItemId) {
    applyBankRecordDeltaV1(projected, targetItemId, -1);
  }
  applyBankRecordDeltaV1(
    projected,
    recipe.outputItemId,
    recipe.outputCount * count
  );
  return (
    harthmereInventoryCarryWeightV1(projected) > HARTHMERE_CARRY_WEIGHT_LIMIT_V1
  );
}

function selectedLiveCraftingToolItemIdsV1(
  snapshot: HarthmereInventorySnapshotV1,
  requestedToolItemIds: string[]
) {
  const requested = [...new Set(requestedToolItemIds)];
  if (requested.length > 0) return requested;
  return [
    ...new Set([
      ...Object.keys(snapshot.items ?? {}).filter(
        (itemId) =>
          (snapshot.items[itemId] ?? 0) > 0 &&
          Boolean(getHarthmereCraftingToolV1(itemId))
      ),
      ...Object.values(snapshot.equipment ?? {}).filter((itemId) =>
        Boolean(getHarthmereCraftingToolV1(itemId))
      ),
    ]),
  ];
}

function chargedCraftingToolItemIdsV1(
  recipe: HarthmereCraftingRecipeV1 | undefined,
  toolItemIds: string[]
) {
  if (!recipe || (recipe.toolDurabilityCost ?? 0) <= 0) return [];
  return [
    ...new Set(
      toolItemIds.filter((itemId) => {
        const tool = getHarthmereCraftingToolV1(itemId);
        return (
          recipe.requiredToolIds?.includes(itemId) ||
          (tool?.action !== undefined &&
            (recipe.requiredToolActions ?? []).includes(tool.action))
        );
      })
    ),
  ];
}

function currentCraftingToolDurabilityV1(
  state: HarthmereLiveModeBackendStateV1,
  itemId: string
) {
  const explicit = state.crafting.toolDurability[itemId];
  if (Number.isFinite(explicit)) {
    return Math.max(0, Math.trunc(Number(explicit)));
  }
  const tool = getHarthmereCraftingToolV1(itemId);
  const max = Math.trunc(Number(tool?.durabilityMax) || 0);
  return Math.max(0, max);
}

function craftingToolDurabilityRejectionV1(
  state: HarthmereLiveModeBackendStateV1,
  recipe: HarthmereCraftingRecipeV1 | undefined,
  toolItemIds: string[],
  craftCount = 1
) {
  const unitCost = Math.max(
    0,
    Math.trunc(Number(recipe?.toolDurabilityCost) || 0)
  );
  if (!recipe || unitCost <= 0) return undefined;
  const totalCost = unitCost * Math.max(1, Math.trunc(craftCount));
  for (const itemId of chargedCraftingToolItemIdsV1(recipe, toolItemIds)) {
    const max = Math.trunc(
      Number(getHarthmereCraftingToolV1(itemId)?.durabilityMax) || 0
    );
    if (max <= 0) continue;
    if (currentCraftingToolDurabilityV1(state, itemId) < totalCost) {
      return `tool_durability_depleted:${itemId}`;
    }
  }
  return undefined;
}

function applyCraftingOutcomeDurabilityV1(
  state: HarthmereLiveModeBackendStateV1,
  result: HarthmereInventoryMutationResultV1,
  touchedModels: Set<string>,
  options: { applyToolCosts: boolean }
) {
  const outcome = result.craftingOutcome;
  if (!outcome) return;
  const recipe = getHarthmereCraftingRecipeV1(outcome.recipeId);
  if (options.applyToolCosts) {
    for (const [itemId, rawCost] of Object.entries(
      outcome.toolDurabilityCosts
    )) {
      const cost = Math.max(0, Math.trunc(Number(rawCost) || 0));
      const max = Math.trunc(
        Number(getHarthmereCraftingToolV1(itemId)?.durabilityMax) || 0
      );
      if (cost <= 0 || max <= 0) continue;
      state.crafting.toolDurability[itemId] = Math.max(
        0,
        currentCraftingToolDurabilityV1(state, itemId) - cost
      );
      touchedModels.add("tool_durability");
    }
  }
  if (!outcome.success) return;
  if (recipe?.workflowKind === "repair" && outcome.targetItemId) {
    const targetDef = getHarthmereItemDefinitionV1(outcome.targetItemId);
    const max = Math.trunc(
      Number(targetDef?.durabilityMax ?? outcome.durabilityMax) || 0
    );
    if (max > 0) {
      state.crafting.itemDurability[outcome.targetItemId] = max;
      touchedModels.add("item_durability");
    }
    return;
  }
  if (recipe?.consumeTargetOnSuccess && outcome.targetItemId) {
    delete state.crafting.itemDurability[outcome.targetItemId];
    touchedModels.add("item_durability");
  }
  const outputMax = Math.trunc(Number(outcome.durabilityMax) || 0);
  if (outcome.outputCount > 0 && outputMax > 0) {
    state.crafting.itemDurability[outcome.outputItemId] = outputMax;
    touchedModels.add("item_durability");
  }
}

function refundCraftingJobToolDurabilityV1(
  state: HarthmereLiveModeBackendStateV1,
  job: HarthmereLiveModeCraftingJobV1,
  touchedModels: Set<string>
) {
  for (const [itemId, rawCost] of Object.entries(
    job.outcome?.toolDurabilityCosts ?? {}
  )) {
    const cost = Math.max(0, Math.trunc(Number(rawCost) || 0));
    const max = Math.trunc(
      Number(getHarthmereCraftingToolV1(itemId)?.durabilityMax) || 0
    );
    if (cost <= 0 || max <= 0) continue;
    state.crafting.toolDurability[itemId] = Math.min(
      max,
      currentCraftingToolDurabilityV1(state, itemId) + cost
    );
    touchedModels.add("tool_durability");
  }
}

function applyStartedCraftingFailureRefundV1(
  state: HarthmereLiveModeBackendStateV1,
  job: HarthmereLiveModeCraftingJobV1,
  recipe: HarthmereCraftingRecipeV1 | undefined,
  touchedModels: Set<string>
) {
  const refundPercent = Math.max(
    0,
    Math.min(1, recipe?.failureMaterialRefundPercent ?? 0)
  );
  if (refundPercent <= 0) return;
  for (const [itemId, delta] of Object.entries(job.reservedItemDeltas)) {
    if (delta >= 0) continue;
    const refund = Math.floor(Math.abs(delta) * refundPercent);
    if (refund <= 0) continue;
    applyBankRecordDeltaV1(state.inventory.items, itemId, refund);
    touchedModels.add("inventory_items");
  }
  for (const [itemId, delta] of Object.entries(
    job.reservedMaterialStorageDeltas
  )) {
    if (delta >= 0) continue;
    const refund = Math.floor(Math.abs(delta) * refundPercent);
    if (refund <= 0) continue;
    applyBankRecordDeltaV1(state.banking.materialStorage, itemId, refund);
    touchedModels.add("material_storage");
  }
}

function nextCraftingJobIdV1(state: HarthmereLiveModeBackendStateV1) {
  let jobId = "";
  do {
    jobId = `craft_${state.actorId}_${state.crafting.nextJobNumber++}`;
  } while (state.crafting.activeJobs[jobId]);
  return jobId;
}

function pushCarryWeightRejectionV1(
  warnings: string[],
  touchedModels: Set<string>,
  source: string
) {
  warnings.push(`${source}_rejected:carry_weight_limit_exceeded`);
  touchedModels.add("inventory_weight_rejection");
}

function clearBankCreditHoldIfSettledV1(
  state: HarthmereLiveModeBackendStateV1,
  nowMs: number
) {
  const hasUnpaidLoan = Object.values(state.banking.loans).some(
    (loan) =>
      (loan.status === "active" || loan.status === "defaulted") &&
      activeLoanBalanceV1(loan, nowMs).totalRemaining > 0
  );
  if (!hasUnpaidLoan) {
    delete state.law.flags[HARTHMERE_BANK_CREDIT_HOLD_FLAG_V1];
  }
}

export function applyHarthmereBankLoanConsequencesV1(
  state: HarthmereLiveModeBackendStateV1,
  nowMs: number
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
      Math.ceil(
        loan.principalRemaining * HARTHMERE_LOAN_DEFAULT_PENALTY_RATE_V1
      )
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
  entry: Omit<
    HarthmereBankingTransactionLogV1,
    "id" | "actorId" | "atMs" | "balanceAfter"
  >
) {
  const log: HarthmereBankingTransactionLogV1 = {
    id: `bank_log_${state.actorId}_${state.updatedAtMs}_${
      state.banking.transactionLogs.length + 1
    }`,
    actorId: state.actorId,
    atMs: state.updatedAtMs,
    balanceAfter: state.inventory.gold,
    ...entry,
  };
  state.banking.transactionLogs = [...state.banking.transactionLogs, log].slice(
    -100
  );
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
  const trimmed =
    tail.length > 24 ? `${tail.slice(0, 10)}…${tail.slice(-6)}` : tail;
  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function isLikelyBankingMaterialItemIdV1(itemId: string) {
  return /(ore|wood|log|stone|clay|fiber|hide|meat|herb|mushroom|ingot|shard|crystal|sand|salt|grain|cloth|coal|copper|iron|silver|gold|exotic|matter|resource|material)/i.test(
    itemId
  );
}

function ensureLiveModeItemDefinitionV1(
  itemId: string,
  snapshot: Pick<HarthmereInventorySnapshotV1, "items" | "bank">
): HarthmereItemDefinitionV1 | undefined {
  const existing = getHarthmereItemDefinitionV1(itemId);
  if (existing) return existing;
  const knownCount =
    (snapshot.items[itemId] ?? 0) + (snapshot.bank[itemId] ?? 0);
  if (knownCount <= 0) return undefined;
  const isSeed = !!HARTHMERE_SEED_DEFINITIONS_V1[itemId];
  const isFood = !!HARTHMERE_FOOD_DEFINITIONS_V1[itemId];
  const helperQuestItemCopy = liveEntityHelperQuestItemCopyForIdV1(itemId);
  const isMaterial = isSeed || isLikelyBankingMaterialItemIdV1(itemId);
  const def: HarthmereItemDefinitionV1 = {
    itemId,
    displayName:
      helperQuestItemCopy?.displayName ?? humanizeHarthmereItemIdV1(itemId),
    description: helperQuestItemCopy?.description,
    maxStackSize:
      helperQuestItemCopy?.maxStackSize ?? (isMaterial ? 9999 : 999),
    baseValue: helperQuestItemCopy?.baseValue ?? 0,
    binding: helperQuestItemCopy?.binding ?? "none",
    isQuestItem: helperQuestItemCopy?.isQuestItem ?? false,
    isCurrency: false,
    isConsumable: helperQuestItemCopy?.isConsumable ?? isFood,
    isCraftingMaterial: helperQuestItemCopy?.isCraftingMaterial ?? isMaterial,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: {},
    tradeable: helperQuestItemCopy?.tradeable ?? true,
  };
  registerHarthmereItemDefinitionV1(def);
  return def;
}

function liveModeGuildItemUnitGoldValueV1(
  itemId: string | undefined,
  snapshot: Pick<HarthmereInventorySnapshotV1, "items" | "bank">
) {
  if (!itemId) return undefined;
  const def =
    ensureLiveModeItemDefinitionV1(itemId, snapshot) ??
    getHarthmereItemDefinitionV1(itemId);
  return Math.max(1, Math.trunc(Number(def?.baseValue ?? 1)));
}

function bankUpgradeCostV1(
  kind: HarthmereBankingVaultKindV1,
  currentSlots: number
) {
  const base =
    kind === "materials"
      ? HARTHMERE_MATERIAL_STORAGE_BASE_SLOTS_V1
      : kind === "account"
      ? HARTHMERE_ACCOUNT_BANK_BASE_SLOTS_V1
      : HARTHMERE_PERSONAL_BANK_BASE_SLOTS_V1;
  const upgradeNumber = Math.max(
    0,
    Math.floor((currentSlots - base) / HARTHMERE_BANK_SLOT_UPGRADE_SIZE_V1)
  );
  return 100 + upgradeNumber * 75;
}

function normalizeBankVaultKindV1(
  value: string | undefined
): HarthmereBankingVaultKindV1 {
  if (value === "account") return "account";
  if (value === "materials" || value === "material") return "materials";
  return "personal";
}

function activeLoanBalanceV1(loan: HarthmereBankingLoanV1, nowMs: number) {
  const boundedRegularEndMs = Math.min(nowMs, loan.dueAtMs);
  const regularInterestDays = Math.max(
    0,
    Math.ceil(
      (boundedRegularEndMs - loan.openedAtMs) / HARTHMERE_LOAN_DAY_MS_V1
    )
  );
  const lateDays = Math.max(
    0,
    Math.ceil((nowMs - loan.dueAtMs) / HARTHMERE_LOAN_DAY_MS_V1)
  );
  const regularInterest = Math.ceil(
    loan.principalRemaining * loan.dailyInterestRate * regularInterestDays
  );
  const lateInterest = Math.ceil(
    loan.principalRemaining *
      loan.dailyInterestRate *
      HARTHMERE_LOAN_LATE_INTEREST_MULTIPLIER_V1 *
      lateDays
  );
  const interestRemaining = Math.max(
    0,
    regularInterest + lateInterest - (loan.interestPaid ?? 0)
  );
  const defaultPenaltyRemaining = Math.max(
    0,
    (loan.defaultPenaltyGold ?? 0) - (loan.penaltyPaid ?? 0)
  );
  return {
    elapsedDays: regularInterestDays + lateDays,
    regularInterestDays,
    lateDays,
    interestRemaining,
    defaultPenaltyRemaining,
    totalRemaining:
      loan.principalRemaining + interestRemaining + defaultPenaltyRemaining,
    overdue: nowMs > loan.dueAtMs,
    creditHold:
      loan.status === "defaulted" &&
      defaultPenaltyRemaining + loan.principalRemaining + interestRemaining > 0,
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
      overLimit:
        harthmereInventoryCarryWeightV1(state.inventory.items) >
        HARTHMERE_CARRY_WEIGHT_LIMIT_V1,
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
      personal: bankUpgradeCostV1(
        "personal",
        state.banking.personalBankMaxSlots
      ),
      account: bankUpgradeCostV1("account", state.banking.accountBankMaxSlots),
      materials: bankUpgradeCostV1(
        "materials",
        state.banking.materialStorageMaxSlots
      ),
    },
  };
}

export function createHarthmereProgressionClientSnapshotFromBackendV1(
  state: HarthmereLiveModeBackendStateV1
) {
  return {
    ...createHarthmereProgressionClientSnapshotV1({
      actorId: state.actorId,
      classMagic: state.classMagic,
      economy: state.economy.production,
      collections: state.collections,
    }),
    questState: createHarthmereLiveModeQuestClientSnapshotV1(state),
  };
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
  const combatHp = normalizedLiveModePlayerHpV1(state);
  const deathState = liveModePlayerDeathStateForHpV1(state);
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
      hp: combatHp,
      maxHp: Math.max(1, Math.trunc(Number(state.combat.maxHp ?? 1))),
      deathState,
      primaryResource,
      primaryResourceLabel: liveModeResourceLabelV1(primaryResource),
      resource: Math.max(
        0,
        Math.trunc(Number(pools.resources[primaryResource] ?? 0))
      ),
      maxResource: Math.max(
        1,
        Math.trunc(Number(pools.maxResources[primaryResource] ?? 1))
      ),
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
    recentReputationEvents: (state.law.recentReputationEvents ?? []).slice(
      0,
      10
    ),
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

function payloadStringOrNumberV1(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  key: string
) {
  const value = envelope.payload[key];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return undefined;
}

function payloadNumber(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  key: string
) {
  const value = envelope.payload[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
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

function payloadStringArray(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  key: string
) {
  const value = envelope.payload[key];
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) =>
      typeof entry === "string" && entry.length > 0 ? entry : undefined
    )
    .filter((entry): entry is string => Boolean(entry))
    .slice(0, 20);
}

function questInviteSharedWorldKeyV1() {
  return harthmereLiveModeSharedWorldStateKeyV1();
}

function questInvitePayloadWorldPositionV1(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1
): [number, number, number] | undefined {
  const record = payloadRecord(envelope, "markerWorldPosition");
  if (record) {
    const position = normalizeQuestInviteVec3V1([record.x, record.y, record.z]);
    if (position) return position;
  }
  const fromArray = normalizeQuestInviteVec3V1(
    envelope.payload.markerWorldPosition
  );
  if (fromArray) return fromArray;
  const x = payloadNumber(envelope, "markerX");
  const y = payloadNumber(envelope, "markerY");
  const z = payloadNumber(envelope, "markerZ");
  return x !== undefined && y !== undefined && z !== undefined
    ? [x, y, z]
    : undefined;
}

function slugQuestInvitePartV1(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

const QUEST_INVITE_MAX_DISTANCE_METERS_V1 = 16;

function reduceQuestInviteMutationV1(input: {
  state: HarthmereLiveModeBackendStateV1;
  envelope: HarthmereLiveModeAuthorityEnvelopeV1;
  nowMs: number;
  warnings: string[];
  touchedModels: Set<string>;
  sharedStateKeys: Set<string>;
}) {
  const { state, envelope, nowMs, warnings, touchedModels, sharedStateKeys } =
    input;
  const operation = payloadString(envelope, "operation");
  if (operation === "invite_to_quest") {
    const inviteeActorId =
      payloadString(envelope, "inviteeActorId") ?? envelope.targetId;
    const questId = payloadString(envelope, "questId");
    const questTitle = cleanQuestInviteTextV1(
      payloadString(envelope, "questTitle"),
      questId ?? ""
    );
    if (!inviteeActorId) {
      warnings.push("quest_invite_rejected:invitee_required");
      touchedModels.add("quest_invite_rejection");
      return true;
    }
    if (inviteeActorId === envelope.actorId) {
      warnings.push("quest_invite_rejected:self_invite");
      touchedModels.add("quest_invite_rejection");
      return true;
    }
    if (!questId || !questTitle) {
      warnings.push("quest_invite_rejected:quest_required");
      touchedModels.add("quest_invite_rejection");
      return true;
    }
    const actorPosition = actorWorldPositionFromAuthorityV1(envelope);
    if (!actorPosition || !envelope.serverTargetPosition) {
      warnings.push("quest_invite_rejected:proximity_unverified");
      touchedModels.add("quest_invite_rejection");
      return true;
    }
    if (
      distanceSq3V1(actorPosition, envelope.serverTargetPosition) >
      QUEST_INVITE_MAX_DISTANCE_METERS_V1 * QUEST_INVITE_MAX_DISTANCE_METERS_V1
    ) {
      warnings.push("quest_invite_rejected:not_nearby");
      touchedModels.add("quest_invite_rejection");
      return true;
    }
    if (state.quests.completed[questId] !== undefined) {
      warnings.push("quest_invite_rejected:quest_completed");
      touchedModels.add("quest_invite_rejection");
      return true;
    }
    const alreadyShared = Object.values(state.questInvites.sharedQuests).some(
      (quest) =>
        quest.questId === questId &&
        quest.memberActorIds.includes(envelope.actorId) &&
        quest.memberActorIds.includes(inviteeActorId)
    );
    if (alreadyShared) {
      warnings.push("quest_invite_rejected:already_shared");
      touchedModels.add("quest_invite_rejection");
      return true;
    }
    const duplicatePending = Object.values(state.questInvites.invites).some(
      (invite) =>
        invite.status === "pending" &&
        invite.questId === questId &&
        invite.inviterActorId === envelope.actorId &&
        invite.inviteeActorId === inviteeActorId
    );
    if (duplicatePending) {
      warnings.push("quest_invite_rejected:duplicate_pending");
      touchedModels.add("quest_invite_rejection");
      return true;
    }
    const sharedQuestId =
      payloadString(envelope, "sharedQuestId") ??
      `shared_quest:${slugQuestInvitePartV1(questId)}:${slugQuestInvitePartV1(
        envelope.actorId
      )}`;
    const inviteId =
      payloadString(envelope, "inviteId") ??
      `quest_invite:${slugQuestInvitePartV1(questId)}:${slugQuestInvitePartV1(
        envelope.actorId
      )}:${slugQuestInvitePartV1(inviteeActorId)}:${slugQuestInvitePartV1(
        envelope.requestId
      )}`;
    const questArea = cleanQuestInviteTextV1(
      payloadString(envelope, "questArea"),
      "Quest"
    );
    const objectiveText = cleanQuestInviteTextV1(
      payloadString(envelope, "objectiveText"),
      "Join this quest together."
    );
    const reward = payloadString(envelope, "reward");
    const firstMarkerId = payloadString(envelope, "firstMarkerId");
    const markerWorldPosition = questInvitePayloadWorldPositionV1(envelope);
    state.questInvites.invites[inviteId] = {
      inviteId,
      sharedQuestId,
      questId,
      questTitle,
      questArea,
      objectiveText,
      reward,
      inviterActorId: envelope.actorId,
      inviteeActorId,
      status: "pending",
      createdAtMs: nowMs,
      firstMarkerId,
      markerWorldPosition,
    };
    touchedModels.add("quest_invites");
    sharedStateKeys.add(questInviteSharedWorldKeyV1());
    return true;
  }

  if (operation === "respond_to_quest_invite") {
    const inviteId = payloadString(envelope, "inviteId");
    const response = payloadString(envelope, "response");
    if (!inviteId) {
      warnings.push("quest_invite_response_rejected:invite_required");
      touchedModels.add("quest_invite_rejection");
      return true;
    }
    const invite = state.questInvites.invites[inviteId];
    if (!invite) {
      warnings.push("quest_invite_response_rejected:not_found");
      touchedModels.add("quest_invite_rejection");
      return true;
    }
    if (invite.inviteeActorId !== envelope.actorId) {
      warnings.push("quest_invite_response_rejected:not_invitee");
      touchedModels.add("quest_invite_rejection");
      return true;
    }
    if (response !== "accept" && response !== "deny") {
      warnings.push("quest_invite_response_rejected:response_required");
      touchedModels.add("quest_invite_rejection");
      return true;
    }
    delete state.questInvites.invites[inviteId];
    const sharedQuest = state.questInvites.sharedQuests[invite.sharedQuestId];
    if (response === "deny") {
      if (sharedQuest && sharedQuest.memberActorIds.length <= 1) {
        delete state.questInvites.sharedQuests[invite.sharedQuestId];
      }
      touchedModels.add("quest_invites");
      sharedStateKeys.add(questInviteSharedWorldKeyV1());
      return true;
    }
    const nextSharedQuest =
      sharedQuest ??
      ({
        sharedQuestId: invite.sharedQuestId,
        questId: invite.questId,
        questTitle: invite.questTitle,
        questArea: invite.questArea,
        objectiveText: invite.objectiveText,
        reward: invite.reward,
        memberActorIds: [],
        inviteIds: [],
        createdAtMs: invite.createdAtMs,
        updatedAtMs: nowMs,
        firstMarkerId: invite.firstMarkerId,
        markerWorldPosition: invite.markerWorldPosition,
      } satisfies HarthmereSharedQuestPartyRecordV1);
    nextSharedQuest.memberActorIds = [
      ...new Set([
        ...nextSharedQuest.memberActorIds,
        invite.inviterActorId,
        invite.inviteeActorId,
      ]),
    ];
    nextSharedQuest.inviteIds = [
      ...new Set([...nextSharedQuest.inviteIds, inviteId]),
    ];
    nextSharedQuest.updatedAtMs = nowMs;
    state.questInvites.sharedQuests[invite.sharedQuestId] = nextSharedQuest;
    if (
      !state.quests.active[invite.questId] &&
      !state.quests.completed[invite.questId]
    ) {
      state.quests.active[invite.questId] = {
        stepId: invite.firstMarkerId ?? "shared_quest",
        progress: 0,
      };
    }
    touchedModels.add("quest_invites");
    touchedModels.add("quest_state");
    sharedStateKeys.add(questInviteSharedWorldKeyV1());
    return true;
  }

  return false;
}

const LIVE_ENTITY_HELPER_ACCEPTED_STEP_ID_V1 = "live_entity_helper:accepted";
const LIVE_ENTITY_HELPER_BOSS_DEFEATED_STEP_ID_V1 =
  "live_entity_helper:boss_defeated";

function isLiveEntityHelperQuestKindPayloadV1(
  value: string | undefined
): value is LiveEntityHelperQuestInstanceV1["kind"] {
  return (
    value === "exotic_matter" || value === "food_water" || value === "hard_boss"
  );
}

function liveEntityHelperQuestContextFromEnvelopeV1(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1
): LiveEntityHelperQuestEntityContextV1 | undefined {
  const entityId = payloadString(envelope, "entityId") ?? envelope.targetId;
  const x =
    payloadNumber(envelope, "entityX") ?? payloadNumber(envelope, "targetX");
  const y =
    payloadNumber(envelope, "entityY") ?? payloadNumber(envelope, "targetY");
  const z =
    payloadNumber(envelope, "entityZ") ?? payloadNumber(envelope, "targetZ");
  if (!entityId || x === undefined || y === undefined || z === undefined) {
    return undefined;
  }
  // V148: mirror the client-side classifier. The previous envelope
  // dropped `hasTalkableDialog`, `isMuckMonster`, and `isJobsBoard`, so
  // a Frogberry-style entity (label + default dialog only) that the
  // client UI accepted as a quest giver would be rejected by the server
  // with `live_entity_helper_rejected:ineligible_entity`. We also derive
  // `hasTalkableDialog` from the dialog/description strings the client
  // can send, so even legacy clients that only forward the label and a
  // dialog blob still pass the gate.
  const defaultDialog = payloadString(envelope, "defaultDialog");
  const entityDescription = payloadString(envelope, "entityDescription");
  const hasQuestGiver = payloadBoolean(envelope, "hasQuestGiver") === true;
  const hasTalkableDialogFromPayload = payloadBoolean(
    envelope,
    "hasTalkableDialog"
  );
  const hasTalkableDialog =
    hasTalkableDialogFromPayload === true ||
    Boolean(defaultDialog) ||
    Boolean(entityDescription) ||
    hasQuestGiver;
  return {
    entityId,
    label:
      payloadString(envelope, "entityLabel") ??
      payloadString(envelope, "giverName"),
    position: [x, y, z],
    hasRobotComponent: payloadBoolean(envelope, "hasRobotComponent") === true,
    hasAppearanceComponent:
      payloadBoolean(envelope, "hasAppearanceComponent") === true,
    hasNpcMetadata: payloadBoolean(envelope, "hasNpcMetadata") === true,
    hasPlayerStatus: payloadBoolean(envelope, "hasPlayerStatus") === true,
    hasTalkableDialog,
    isRobotLike: payloadBoolean(envelope, "isRobotLike") === true,
    iced: payloadBoolean(envelope, "iced") === true,
    isMuckMonster: payloadBoolean(envelope, "isMuckMonster") === true,
    isJobsBoard: payloadBoolean(envelope, "isJobsBoard") === true,
    isMountOnly: payloadBoolean(envelope, "isMountOnly") === true,
  };
}

function liveEntityHelperQuestFromEnvelopeV1(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  warnings: string[]
) {
  const context = liveEntityHelperQuestContextFromEnvelopeV1(envelope);
  if (!context) {
    warnings.push("live_entity_helper_rejected:server_entity_context_required");
    return undefined;
  }
  const quest = getLiveEntityHelperQuestForEntityV1(context);
  if (!quest) {
    warnings.push("live_entity_helper_rejected:ineligible_entity");
    return undefined;
  }
  const requestedKind = payloadString(envelope, "questKind");
  if (
    requestedKind &&
    (!isLiveEntityHelperQuestKindPayloadV1(requestedKind) ||
      requestedKind !== quest.kind)
  ) {
    warnings.push("live_entity_helper_rejected:quest_kind_mismatch");
    return undefined;
  }
  const requestedQuestId = payloadString(envelope, "questId");
  if (requestedQuestId && requestedQuestId !== quest.questId) {
    warnings.push("live_entity_helper_rejected:quest_id_mismatch");
    return undefined;
  }
  return quest;
}

function upsertLiveEntityHelperQuestMarkerV1(
  state: HarthmereLiveModeBackendStateV1,
  quest: LiveEntityHelperQuestInstanceV1,
  nowMs: number
) {
  const marker = liveEntityHelperQuestTargetMarkerForKindV1(quest.kind);
  if (!marker) {
    return undefined;
  }
  state.building.inWorldMarkers[marker.id] = {
    markerId: marker.id,
    plotId: `live_entity_helper:${quest.kind}`,
    kind: "map_marker",
    position: marker.position,
    label: marker.label,
    createdAtMs: nowMs,
  };
  return marker;
}

function removeLiveEntityHelperQuestMarkerV1(
  state: HarthmereLiveModeBackendStateV1,
  quest: LiveEntityHelperQuestInstanceV1
) {
  const marker = liveEntityHelperQuestTargetMarkerForKindV1(quest.kind);
  if (marker) {
    delete state.building.inWorldMarkers[marker.id];
  }
}

function hasLiveEntityHelperBossDefeatEvidenceV1(
  state: HarthmereLiveModeBackendStateV1,
  envelope: HarthmereLiveModeAuthorityEnvelopeV1
) {
  const bossEntityId =
    payloadString(envelope, "bossEntityId") ??
    LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1;
  const combatSnapshot = state.combat.entitySnapshots[bossEntityId];
  if (combatSnapshot) {
    if (combatSnapshot.isAlive || combatSnapshot.hp > 0) {
      return false;
    }
    return (
      combatSnapshot.killedByActorId === envelope.actorId ||
      combatSnapshot.lastAttackerId === envelope.actorId ||
      combatSnapshot.lootOwnerActorIds?.includes(envelope.actorId) === true
    );
  }
  const clientSawDefeat = payloadBoolean(envelope, "bossDefeated") === true;
  const clientKillCredit = payloadNumber(envelope, "bossKillCredit") ?? 0;
  return clientSawDefeat && clientKillCredit > 0;
}

function applyLiveEntityHelperQuestXpV1(
  state: HarthmereLiveModeBackendStateV1,
  quest: LiveEntityHelperQuestInstanceV1,
  warnings: string[],
  touchedModels: Set<string>
) {
  const actorLevel = state.classMagic.skills.character_level?.level ?? 1;
  const reward = computeHarthmereXpRewardV1({
    actorLevel,
    targetLevel: quest.rewards.sourceLevel,
    baseXp: quest.rewards.baseXp,
    contributionScore: 1,
    antiFarmMultiplier: 1,
    restedXpPool: 0,
  });
  const skillProgress = upsertSkill(
    state.classMagic.skills,
    "character_level",
    reward.xpReward
  );
  if (skillProgress.warning) {
    warnings.push(skillProgress.warning);
  }
  touchedModels.add("skill_xp");
}

function applyLiveEntityRobotRechargeRewardV1(
  state: HarthmereLiveModeBackendStateV1,
  warnings: string[],
  touchedModels: Set<string>
) {
  const actorLevel = state.classMagic.skills.character_level?.level ?? 1;
  const xp = computeHarthmereXpRewardV1({
    actorLevel,
    targetLevel: LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP_V1.sourceLevel,
    baseXp: LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP_V1.baseXp,
    contributionScore: 1,
    antiFarmMultiplier: 1,
    restedXpPool: 0,
  });
  const skillProgress = upsertSkill(
    state.classMagic.skills,
    "character_level",
    xp.xpReward
  );
  if (skillProgress.warning) {
    warnings.push(skillProgress.warning);
  }
  for (const item of LIVE_ENTITY_ROBOT_RECHARGE_REWARD_ITEMS_V1) {
    ensureLiveEntityHelperServerItemDefinitionV1(item.itemId);
    recordDelta(state.inventory.items, item.itemId, item.quantity);
  }
  touchedModels.add("skill_xp");
  touchedModels.add("inventory_items");
}

function ensureLiveEntityHelperServerItemDefinitionV1(itemId: string) {
  if (getHarthmereItemDefinitionV1(itemId)) {
    return;
  }
  const copy = liveEntityHelperQuestItemCopyForIdV1(itemId);
  if (!copy) {
    return;
  }
  registerHarthmereItemDefinitionV1({
    itemId,
    displayName: copy.displayName,
    description: copy.description,
    maxStackSize: copy.maxStackSize,
    baseValue: copy.baseValue,
    binding: copy.binding,
    isQuestItem: copy.isQuestItem,
    isCurrency: false,
    isConsumable: copy.isConsumable,
    isCraftingMaterial: copy.isCraftingMaterial,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: {},
    tradeable: copy.tradeable,
  });
}

function syncLiveEntityRobotProtectionToBuildingV1(
  state: HarthmereLiveModeBackendStateV1,
  nowMs: number
) {
  for (const area of LIVE_ENTITY_ROBOT_PROTECTION_AREAS_V1) {
    const marker = liveEntityRobotProtectionBuildingMarkerV1(
      area,
      state.robotProtection,
      nowMs
    );
    delete state.building.inWorldMarkers[area.protectedMarkerId];
    delete state.building.inWorldMarkers[area.muckMarkerId];
    state.building.inWorldMarkers[marker.markerId] = marker;
    state.building.safeZones[area.areaId] = {
      safeFromMuck:
        state.robotProtection.areas[area.areaId]?.safeFromMuck ?? false,
      activatedAtMs:
        state.robotProtection.areas[area.areaId]?.updatedAtMs ?? nowMs,
      area: area.label,
    };
  }
}

function isLiveEntityRobotProtectedPositionV1(
  state: HarthmereLiveModeBackendStateV1,
  position: readonly number[] | undefined
) {
  const area = liveEntityRobotProtectionAreaForPositionV1(position);
  return area
    ? state.robotProtection.areas[area.areaId]?.safeFromMuck === true
    : false;
}

function liveModePositionObjectToTupleV1(
  position: { x: number; y: number; z: number } | undefined
): [number, number, number] | undefined {
  if (!position) {
    return undefined;
  }
  const x = Number(position.x);
  const y = Number(position.y);
  const z = Number(position.z);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? [x, y, z]
    : undefined;
}

function isHarthmereLiveModeTownSafePositionV1(
  position: { x: number; y: number; z: number } | undefined
) {
  if (!position) return false;
  const x = Number(position.x);
  const z = Number(position.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  const inGroveAndTownCore = x >= 340 && x <= 650 && z >= -335 && z <= -70;
  const inGroveRespawnPoint =
    Math.hypot(x - 496, z - -126) <= 95 || Math.hypot(x - 612, z - -245) <= 95;
  // Every business outpost sits on a registered safe site (plot + garden ring):
  // muck monsters and Hexes stay non-aggressive there and are relocated to a
  // nearby muck area, so businesses outside the town core box are still safe.
  const inBusinessSafeSite = isPointInsideHarthmereBusinessSafeSiteV1({ x, z });
  return inGroveAndTownCore || inGroveRespawnPoint || inBusinessSafeSite;
}

function authoritativeCrimeItemValueGoldV1(
  state: HarthmereLiveModeBackendStateV1,
  itemIds: string[]
) {
  return itemIds.reduce((sum, itemId) => {
    if ((state.inventory.items[itemId] ?? 0) <= 0) return sum;
    const def = getHarthmereItemDefinitionV1(itemId);
    return sum + Math.max(0, Math.trunc(def?.baseValue ?? 0));
  }, 0);
}

const HARTHMERE_LIVE_MODE_CRIME_SEVERITY_V1: Record<
  HarthmereLiveModeCrimeKindV1,
  number
> = {
  theft: 120,
  pickpocket: 180,
  lockpicking: 130,
  trespassing: 80,
  assault: 350,
  murder: 1500,
  smuggling: 500,
  illegal_magic: 420,
  bribery: 250,
  arson: 1200,
};

const HARTHMERE_LIVE_MODE_CRIME_EVIDENCE_HOURS_V1: Record<
  HarthmereLiveModeCrimeKindV1,
  number
> = {
  theft: 48,
  pickpocket: 24,
  lockpicking: 24,
  trespassing: 6,
  assault: 72,
  murder: 240,
  smuggling: 72,
  illegal_magic: 96,
  bribery: 48,
  arson: 168,
};

function isHarthmereLiveModeCrimeKindV1(
  value: string | undefined
): value is HarthmereLiveModeCrimeKindV1 {
  return !!value && value in HARTHMERE_LIVE_MODE_CRIME_SEVERITY_V1;
}

function clampCrimeNumberV1(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Number(value)));
}

function crimeDetectionScoreV1(input: {
  kind: HarthmereLiveModeCrimeKindV1;
  witnesses: number;
  lineOfSight: boolean;
  noise: number;
  lighting: string;
  disguiseQuality: number;
  guardAlertness: number;
  crowdDensity: number;
  legalStanding: number;
  notoriety: number;
}) {
  const base = HARTHMERE_LIVE_MODE_CRIME_SEVERITY_V1[input.kind] / 20;
  const witness = input.witnesses * 15;
  const los = input.lineOfSight ? 25 : -20;
  const noise = clampCrimeNumberV1(input.noise, 0, 0, 100) * 0.35;
  const lighting =
    input.lighting === "bright"
      ? 20
      : input.lighting === "normal"
      ? 10
      : input.lighting === "dim"
      ? -5
      : -15;
  const disguise = -clampCrimeNumberV1(input.disguiseQuality, 0, 0, 100) * 0.35;
  const alertness = clampCrimeNumberV1(input.guardAlertness, 50, 0, 100) * 0.4;
  const crowd =
    input.crowdDensity > 70 && input.kind === "pickpocket"
      ? -10
      : clampCrimeNumberV1(input.crowdDensity, 0, 0, 100) * 0.05;
  const reputation =
    input.legalStanding < -500 ? 12 : input.legalStanding > 2000 ? -10 : 0;
  const notoriety = input.notoriety > 5000 ? 8 : 0;
  return Math.round(
    clampCrimeNumberV1(
      base +
        witness +
        los +
        noise +
        lighting +
        disguise +
        alertness +
        crowd +
        reputation +
        notoriety,
      0,
      0,
      100
    )
  );
}

function guardResponseForCrimeV1(input: {
  kind: HarthmereLiveModeCrimeKindV1;
  valueGold: number;
  legalStanding: number;
  notoriety: number;
  detectionScore: number;
}): HarthmereLiveModeGuardResponseLevelV1 {
  const seriousness =
    HARTHMERE_LIVE_MODE_CRIME_SEVERITY_V1[input.kind] +
    input.valueGold +
    Math.max(0, -input.legalStanding / 2) +
    input.notoriety / 10;
  if (input.legalStanding <= -8000 || seriousness > 5500)
    return "city_lockdown";
  if (seriousness > 3500) return "reinforcements";
  if (seriousness > 2200) return "combat";
  if (seriousness > 1200) return "arrest_attempt";
  if (input.valueGold > 250 || input.kind === "smuggling")
    return "confiscation";
  if (input.detectionScore > 45) return "fine";
  if (input.detectionScore > 25) return "questioning";
  return "warning";
}

function fineGoldForCrimeV1(input: {
  kind: HarthmereLiveModeCrimeKindV1;
  valueGold: number;
  legalStanding: number;
  notoriety: number;
}) {
  const repeatOffender =
    input.legalStanding < -5000 ? 2 : input.legalStanding < -2000 ? 1.5 : 1;
  const notoriety = 1 + Math.min(1, input.notoriety / 20_000);
  return Math.max(
    1,
    Math.ceil(
      ((HARTHMERE_LIVE_MODE_CRIME_SEVERITY_V1[input.kind] +
        input.valueGold * 0.75) *
        repeatOffender *
        notoriety) /
        10
    )
  );
}

function isServerAuthorityEnvelopeV1(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1
) {
  return envelope.source !== "client_request";
}

const HARTHMERE_CIVIL_LAW_FACTION_ID_V1 = "city_guard";

function activeBountyGoldForCivilPermitsV1(
  state: HarthmereLiveModeBackendStateV1,
  factionId = HARTHMERE_CIVIL_LAW_FACTION_ID_V1
) {
  return (state.law.crimeRecords ?? []).reduce((sum, record) => {
    if (record.factionId !== factionId) return sum;
    if (record.status !== "wanted" && record.status !== "arrest_pending")
      return sum;
    return sum + Math.max(0, Math.trunc(record.bountyGold ?? 0));
  }, 0);
}

function civilLegalAccessBlockersV1(input: {
  state: HarthmereLiveModeBackendStateV1;
  factionId?: string;
  minLegalStanding?: number;
  minTownReputation?: number;
}) {
  const factionId = input.factionId ?? HARTHMERE_CIVIL_LAW_FACTION_ID_V1;
  const standing = normalizeReputationStandingV1(
    input.state.law.standing[factionId]
  );
  const townReputation = input.state.law.reputation[factionId] ?? 0;
  const blockers: string[] = [];
  if (activeBountyGoldForCivilPermitsV1(input.state, factionId) > 0) {
    blockers.push("active_bounty");
  }
  if (standing.legal < (input.minLegalStanding ?? -500)) {
    blockers.push("legal_standing_too_low");
  }
  if (townReputation < (input.minTownReputation ?? -500)) {
    blockers.push("town_reputation_too_low");
  }
  return blockers;
}

function rejectForCivilLegalBlockersV1(input: {
  blockers: string[];
  warningPrefix: string;
  rejectionModel: string;
  warnings: string[];
  touchedModels: Set<string>;
}) {
  if (input.blockers.length === 0) return false;
  input.warnings.push(
    ...input.blockers.map((blocker) => `${input.warningPrefix}:${blocker}`)
  );
  input.touchedModels.add(input.rejectionModel);
  return true;
}

function actorWorldPositionFromAuthorityV1(
  envelope: HarthmereLiveModeAuthorityEnvelopeV1
) {
  if (envelope.serverActorPosition) {
    return envelope.serverActorPosition;
  }
  if (!isServerAuthorityEnvelopeV1(envelope)) {
    return undefined;
  }
  const x = payloadNumber(envelope, "actorX") ?? payloadNumber(envelope, "x");
  const y = payloadNumber(envelope, "actorY") ?? payloadNumber(envelope, "y");
  const z = payloadNumber(envelope, "actorZ") ?? payloadNumber(envelope, "z");
  return x === undefined || y === undefined || z === undefined
    ? undefined
    : { x, y, z };
}

function applyHarthmereLiveModeCrimeEventV1(input: {
  state: HarthmereLiveModeBackendStateV1;
  envelope: HarthmereLiveModeAuthorityEnvelopeV1;
  factionId: string;
  witnessLevel: string;
  witnessMultiplier: number;
  nowMs: number;
  likeabilityDelta: { value: number };
  legalDelta: { value: number };
  notorietyDelta: { value: number };
  fineDelta: { value: number };
  warnings: string[];
  touchedModels: Set<string>;
  sharedStateKeys: Set<string>;
}) {
  const explicitCrimeKind = payloadString(input.envelope, "crimeKind");
  let crimeKind = isHarthmereLiveModeCrimeKindV1(explicitCrimeKind)
    ? explicitCrimeKind
    : undefined;
  const resourceOwnership = payloadString(input.envelope, "resourceOwnership");
  if (!crimeKind && resourceOwnership) {
    crimeKind = ["owned", "protected", "temple", "town"].includes(
      resourceOwnership
    )
      ? "theft"
      : resourceOwnership === "illegal"
      ? "smuggling"
      : undefined;
  }
  if (!crimeKind) return undefined;

  const standing = normalizeReputationStandingV1(
    input.state.law.standing[input.factionId]
  );
  const witnesses = Math.max(
    0,
    Math.trunc(
      payloadNumber(input.envelope, "witnesses") ??
        (input.witnessLevel === "none" || input.witnessLevel === "no_witness"
          ? 0
          : 1)
    )
  );
  const itemIds = payloadStringArray(input.envelope, "itemIds");
  const payloadValueGold = Math.max(
    0,
    Math.trunc(
      payloadNumber(input.envelope, "valueGold") ??
        payloadNumber(input.envelope, "value") ??
        0
    )
  );
  const valueGold = Math.max(
    payloadValueGold,
    authoritativeCrimeItemValueGoldV1(input.state, itemIds)
  );
  const lineOfSight =
    payloadBoolean(input.envelope, "lineOfSight") ?? witnesses > 0;
  const noise = payloadNumber(input.envelope, "noise") ?? 0;
  const lighting = payloadString(input.envelope, "lighting") ?? "normal";
  const disguiseQuality = payloadNumber(input.envelope, "disguiseQuality") ?? 0;
  const guardAlertness = payloadNumber(input.envelope, "guardAlertness") ?? 60;
  const crowdDensity = payloadNumber(input.envelope, "crowdDensity") ?? 0;
  const detectionScore = crimeDetectionScoreV1({
    kind: crimeKind,
    witnesses,
    lineOfSight,
    noise,
    lighting,
    disguiseQuality,
    guardAlertness,
    crowdDensity,
    legalStanding: standing.legal,
    notoriety: standing.notoriety,
  });
  const clientDetectedOverride = payloadBoolean(input.envelope, "detected");
  if (
    !isServerAuthorityEnvelopeV1(input.envelope) &&
    clientDetectedOverride !== undefined
  ) {
    input.warnings.push("law_ignored_client_detected_override");
  }
  const detectedOverride = isServerAuthorityEnvelopeV1(input.envelope)
    ? clientDetectedOverride
    : undefined;
  const detected = detectedOverride ?? (detectionScore >= 35 || witnesses > 0);
  const response = detected
    ? guardResponseForCrimeV1({
        kind: crimeKind,
        valueGold,
        legalStanding: standing.legal,
        notoriety: standing.notoriety,
        detectionScore,
      })
    : "warning";
  const fineGold = detected
    ? fineGoldForCrimeV1({
        kind: crimeKind,
        valueGold,
        legalStanding: standing.legal,
        notoriety: standing.notoriety,
      })
    : 0;
  const shouldConfiscate =
    detected &&
    [
      "confiscation",
      "arrest_attempt",
      "combat",
      "reinforcements",
      "city_lockdown",
    ].includes(response);
  const confiscatedItemIds: string[] = [];
  if (shouldConfiscate) {
    for (const itemId of itemIds) {
      if ((input.state.inventory.items[itemId] ?? 0) <= 0) continue;
      applyBankRecordDeltaV1(input.state.inventory.items, itemId, -1);
      confiscatedItemIds.push(itemId);
    }
  }

  const severity = HARTHMERE_LIVE_MODE_CRIME_SEVERITY_V1[crimeKind];
  if (input.likeabilityDelta.value === 0) {
    input.likeabilityDelta.value = detected
      ? -Math.ceil(severity / 8)
      : -Math.ceil(severity / 30);
  }
  if (input.legalDelta.value === 0) {
    input.legalDelta.value = detected
      ? -Math.ceil(severity + valueGold * 0.5)
      : -Math.ceil(severity / 10);
  }
  if (input.notorietyDelta.value === 0) {
    input.notorietyDelta.value = detected
      ? Math.ceil(severity / 12 + valueGold / 50)
      : 0;
  }
  if (
    input.fineDelta.value === 0 &&
    fineGold > 0 &&
    [
      "fine",
      "confiscation",
      "arrest_attempt",
      "combat",
      "reinforcements",
      "city_lockdown",
    ].includes(response)
  ) {
    input.fineDelta.value = fineGold;
  }

  const crimeId = input.envelope.requestId;
  const evidenceExpiresAtMs =
    input.nowMs +
    HARTHMERE_LIVE_MODE_CRIME_EVIDENCE_HOURS_V1[crimeKind] * 60 * 60 * 1000;
  const detentionUntilMs = [
    "arrest_attempt",
    "combat",
    "reinforcements",
    "city_lockdown",
  ].includes(response)
    ? input.nowMs + Math.max(5, Math.ceil(severity / 100)) * 60 * 1000
    : undefined;
  const status: HarthmereLiveModeCrimeRecordV1["status"] =
    response === "city_lockdown" ||
    response === "reinforcements" ||
    response === "combat"
      ? "wanted"
      : response === "arrest_attempt"
      ? "arrest_pending"
      : response === "confiscation"
      ? "confiscated"
      : response === "fine"
      ? "fined"
      : response === "questioning"
      ? "warned"
      : "recorded";
  const record: HarthmereLiveModeCrimeRecordV1 = {
    id: crimeId,
    actorId: input.envelope.actorId,
    kind: crimeKind,
    zoneId: input.envelope.zoneId,
    factionId: input.factionId,
    locationId: payloadString(input.envelope, "locationId"),
    targetId:
      input.envelope.targetId ?? payloadString(input.envelope, "targetId"),
    restrictedAreaId: payloadString(input.envelope, "restrictedAreaId"),
    resourceNodeId: payloadString(input.envelope, "resourceNodeId"),
    resourceOwnership,
    itemIds,
    severity,
    valueGold,
    witnessLevel: input.witnessLevel,
    witnesses,
    detected,
    detectionScore,
    response,
    fineGold,
    bountyGold:
      response === "city_lockdown" ||
      crimeKind === "murder" ||
      crimeKind === "arson"
        ? Math.ceil(Math.max(fineGold, severity) * 1.5)
        : undefined,
    confiscatedItemIds,
    evidenceExpiresAtMs,
    status,
    createdAtMs: input.nowMs,
  };
  input.state.law.crimeRecords = [
    record,
    ...(input.state.law.crimeRecords ?? []),
  ].slice(0, 100);
  input.state.law.guardResponses = [
    {
      id: `${crimeId}:guard`,
      crimeId,
      actorId: input.envelope.actorId,
      zoneId: input.envelope.zoneId,
      response,
      fineGold,
      confiscatedItemIds,
      detentionUntilMs,
      cityLockdown: response === "city_lockdown",
      createdAtMs: input.nowMs,
    },
    ...(input.state.law.guardResponses ?? []),
  ].slice(0, 100);
  if (detentionUntilMs) {
    input.state.law.detentionUntilMs[input.factionId] = detentionUntilMs;
  }
  const restrictedAreaId = record.restrictedAreaId;
  if (crimeKind === "trespassing" && restrictedAreaId) {
    input.state.law.restrictedTrespass[
      `${input.envelope.actorId}:${input.envelope.zoneId}:${restrictedAreaId}`
    ] = {
      actorId: input.envelope.actorId,
      zoneId: input.envelope.zoneId,
      areaId: restrictedAreaId,
      enteredAtMs: input.nowMs,
      lastCrimeId: crimeId,
      lastEscalatedAtMs: input.nowMs,
    };
  }
  if (confiscatedItemIds.length > 0) {
    input.warnings.push(
      `law_confiscated_items:${confiscatedItemIds.join(",")}`
    );
    input.touchedModels.add("inventory_items");
  }
  if (!detected) {
    input.warnings.push(`crime_recorded_undetected:${crimeKind}`);
  }
  input.touchedModels.add("law_crime_records");
  input.touchedModels.add("law_guard_response");
  input.sharedStateKeys.add(
    harthmereLiveModeSharedStateKeyV1("zone_law", input.envelope.zoneId)
  );
  return record;
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

const HARTHMERE_EXOTIC_MATTER_DEPOSIT_CLAIM_PREFIX_V1 =
  "exotic_matter_deposit:";
const HARTHMERE_EXOTIC_MATTER_MINE_INTERACTION_RADIUS_V1 = 4;

function exoticMatterDepositClaimKeyV1(depositId: string) {
  return `${HARTHMERE_EXOTIC_MATTER_DEPOSIT_CLAIM_PREFIX_V1}${depositId}`;
}

function normalizeExoticMatterDepositClaimsV1(raw: unknown) {
  const value =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, minedAtMs]) =>
          key.startsWith(HARTHMERE_EXOTIC_MATTER_DEPOSIT_CLAIM_PREFIX_V1) &&
          Number.isFinite(Number(minedAtMs))
      )
      .map(([key, minedAtMs]) => [
        key,
        Math.max(0, Math.trunc(Number(minedAtMs))),
      ])
  );
}

function liveExoticMatterDepositStateFromClaimsV1(
  state: HarthmereLiveModeBackendStateV1,
  nowMs: number
) {
  const deposits = defaultHarthmereExoticMatterDepositStateV1();
  for (const entry of Object.values(deposits)) {
    const claimKey = exoticMatterDepositClaimKeyV1(entry.depositId);
    const minedAtMs = state.combat.lootClaims[claimKey];
    if (typeof minedAtMs !== "number") continue;
    const replenishesAtMs =
      minedAtMs + HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS_V1;
    if (replenishesAtMs > nowMs) {
      entry.available = false;
      entry.minedAtMs = minedAtMs;
      entry.replenishesAtMs = replenishesAtMs;
    } else {
      delete state.combat.lootClaims[claimKey];
    }
  }
  return replenishHarthmereExoticMatterDepositsV1({ state: deposits, nowMs });
}

const HARTHMERE_BUSINESS_IN_WORLD_INTERACTION_RADIUS_V1 = 18;
const HARTHMERE_HOME_CONSOLE_INTERACTION_RADIUS_V1 = 5;

function buildingMarkerPositionV1(marker: BuildingSystemInWorldMarkerV1) {
  return Array.isArray(marker.position) && marker.position.length >= 3
    ? {
        x: Number(marker.position[0]),
        y: Number(marker.position[1]),
        z: Number(marker.position[2]),
      }
    : undefined;
}

function propertyBusinessInteractionPositionV1(
  property: BuildingSystemPropertyRecordV1 | undefined
) {
  if (!property) return undefined;
  const plot = buildingSystemPlotByIdV1(property.plotId);
  const blueprint = buildingSystemBlueprintByIdV1(property.blueprintId);
  if (!plot || !blueprint) return undefined;
  const origin = buildingSystemDefaultOriginV1(plot, blueprint);
  return {
    x: origin.x + Math.floor(blueprint.footprint.width / 2),
    y: origin.y + 1,
    z:
      origin.z +
      Math.min(
        Math.max(3, Math.floor(blueprint.footprint.depth * 0.35)),
        Math.max(3, blueprint.footprint.depth - 2)
      ),
  };
}

function outpostBusinessInteractionPositionV1(outpostBuilding: any) {
  const counter = outpostBuilding?.serviceCounter;
  if (
    counter &&
    Number.isFinite(Number(counter.x)) &&
    Number.isFinite(Number(counter.y)) &&
    Number.isFinite(Number(counter.z))
  ) {
    return {
      x: Number(counter.x),
      y: Number(counter.y),
      z: Number(counter.z),
    };
  }
  return undefined;
}

function economyBusinessInteractionPositionsV1(
  state: HarthmereLiveModeBackendStateV1,
  envelope: HarthmereLiveModeAuthorityEnvelopeV1,
  businessId: string
) {
  const positions: Array<{ x: number; y: number; z: number }> = [];
  const marker = state.building.inWorldMarkers[`${businessId}:marker`];
  const markerPosition = marker ? buildingMarkerPositionV1(marker) : undefined;
  if (markerPosition) positions.push(markerPosition);

  const business = state.economy.production.businesses[businessId];
  const property = business?.propertyId
    ? state.property.owned[business.propertyId]
    : Object.values(state.property.owned).find(
        (record) => record.businessId === businessId
      );
  const propertyPosition = propertyBusinessInteractionPositionV1(property);
  if (propertyPosition) positions.push(propertyPosition);

  const systems = (state.economy.production as any).businessSystems ?? {};
  const branchId = payloadString(envelope, "branchId");
  const outpostId =
    payloadString(envelope, "outpostId") ??
    (branchId ? systems.empireBranches?.[branchId]?.outpostId : undefined);
  const outpostBuilding = outpostId
    ? systems.outpostBuildings?.[outpostId]
    : undefined;
  const outpostPosition = outpostBusinessInteractionPositionV1(outpostBuilding);
  if (outpostPosition) positions.push(outpostPosition);

  return positions.filter(
    (position) =>
      Number.isFinite(position.x) &&
      Number.isFinite(position.y) &&
      Number.isFinite(position.z)
  );
}

function rejectEconomyMutationOutsideBusinessV1(input: {
  state: HarthmereLiveModeBackendStateV1;
  envelope: HarthmereLiveModeAuthorityEnvelopeV1;
  warnings: string[];
  touchedModels: Set<string>;
}) {
  if (input.envelope.actionKind !== "request_economy_mutation") return false;
  if (isServerAuthorityEnvelopeV1(input.envelope)) return false;
  const businessId =
    payloadString(input.envelope, "businessId") ??
    payloadString(input.envelope, "interactionBusinessId") ??
    payloadString(input.envelope, "targetBusinessId");
  if (!businessId) return false;
  const business = input.state.economy.production.businesses[businessId];
  if (!business) return false;
  const actorPosition = actorWorldPositionFromAuthorityV1(input.envelope);
  if (!actorPosition) {
    input.warnings.push("economy_rejected:business_proximity_unverified");
    input.touchedModels.add("economy_business_proximity_rejection");
    return true;
  }
  const positions = economyBusinessInteractionPositionsV1(
    input.state,
    input.envelope,
    businessId
  );
  if (positions.length === 0) {
    input.warnings.push("economy_rejected:business_interaction_marker_missing");
    input.touchedModels.add("economy_business_proximity_rejection");
    return true;
  }
  const radius = Math.max(
    HARTHMERE_BUSINESS_IN_WORLD_INTERACTION_RADIUS_V1,
    Math.min(32, Math.max(1, business.serviceRadius ?? 1) * 5)
  );
  if (
    positions.some(
      (position) => distanceSq3V1(actorPosition, position) <= radius * radius
    )
  ) {
    return false;
  }
  input.warnings.push("economy_rejected:business_proximity_required");
  input.touchedModels.add("economy_business_proximity_rejection");
  return true;
}

function homeConsoleMarkerForPropertyV1(input: {
  state: HarthmereLiveModeBackendStateV1;
  property: BuildingSystemPropertyRecordV1;
  nowMs: number;
  touchedModels: Set<string>;
}) {
  const expectedId = buildingSystemHomeConsoleMarkerIdV1(
    input.property.propertyId
  );
  const existing =
    input.state.building.inWorldMarkers[expectedId] ??
    Object.values(input.state.building.inWorldMarkers).find(
      (marker) =>
        marker.kind === "home_console" &&
        marker.plotId === input.property.plotId
    );
  if (existing) return existing;
  const plot = buildingSystemPlotByIdV1(input.property.plotId);
  const blueprint = buildingSystemBlueprintByIdV1(input.property.blueprintId);
  if (!plot || !blueprint) return undefined;
  const marker = createBuildingSystemHomeConsoleMarkerV1({
    property: input.property,
    plot,
    blueprint,
    nowMs: input.nowMs,
  });
  input.state.building.inWorldMarkers[marker.markerId] = marker;
  input.touchedModels.add("building_state");
  return marker;
}

function rejectHomeDecorationOutsideConsoleV1(input: {
  state: HarthmereLiveModeBackendStateV1;
  envelope: HarthmereLiveModeAuthorityEnvelopeV1;
  nowMs: number;
  warnings: string[];
  touchedModels: Set<string>;
}) {
  if (input.envelope.actionKind !== "request_home_decoration") return false;
  if (isServerAuthorityEnvelopeV1(input.envelope)) return false;
  const decorationId = payloadString(input.envelope, "decorationId");
  const propertyId =
    payloadString(input.envelope, "propertyId") ??
    (decorationId
      ? input.state.homeDecoration.placed[decorationId]?.propertyId
      : undefined);
  if (!propertyId) return false;
  const property = input.state.property.owned[propertyId];
  if (!property || property.use !== "home") return false;
  const actorPosition = actorWorldPositionFromAuthorityV1(input.envelope);
  if (!actorPosition) {
    input.warnings.push(
      "home_decoration_rejected:console_proximity_unverified"
    );
    input.touchedModels.add("home_decoration_rejection");
    return true;
  }
  const marker = homeConsoleMarkerForPropertyV1({
    state: input.state,
    property,
    nowMs: input.nowMs,
    touchedModels: input.touchedModels,
  });
  const markerPosition = marker ? buildingMarkerPositionV1(marker) : undefined;
  if (!markerPosition) {
    input.warnings.push("home_decoration_rejected:console_marker_missing");
    input.touchedModels.add("home_decoration_rejection");
    return true;
  }
  if (
    distanceSq3V1(actorPosition, markerPosition) <=
    HARTHMERE_HOME_CONSOLE_INTERACTION_RADIUS_V1 *
      HARTHMERE_HOME_CONSOLE_INTERACTION_RADIUS_V1
  ) {
    return false;
  }
  input.warnings.push("home_decoration_rejected:console_proximity_required");
  input.touchedModels.add("home_decoration_rejection");
  return true;
}

function buildingProjectIdForPlotV1(plotId: string) {
  return `project_${plotId}`;
}

function buildingPropertyIdForPlotV1(plotId: string) {
  return `property_${plotId}`;
}

function isBuildingSystemStageV1(
  stage: string | undefined
): stage is BuildingSystemStageV1 {
  return BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1.includes(stage as any);
}

function nextBuildingSystemStageV1(
  stage: BuildingSystemStageV1
): BuildingSystemStageV1 {
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
  if (
    subject === "owner" ||
    subject === "friends_guests" ||
    subject === "guild_members" ||
    subject === "public"
  ) {
    return subject;
  }
  return undefined;
}

function normalizePermissionKeyV1(
  permission: string | undefined
): BuildingSystemPermissionKeyV1 | undefined {
  if (
    permission === "storage_access" ||
    permission === "build_edit" ||
    permission === "demolition" ||
    permission === "transfer_sale"
  ) {
    return permission;
  }
  return undefined;
}

function normalizeAccessModeV1(
  mode: string | undefined
): BuildingSystemAccessModeV1 | undefined {
  if (
    mode === "private" ||
    mode === "friends" ||
    mode === "guild" ||
    mode === "public"
  ) {
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
  const lifecycle = applyBuildingSystemPropertyLifecycleV1({
    property: raw,
    nowMs: input.nowMs,
  });
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

function buildingSystemPhysicalOriginForPropertyV1(
  state: HarthmereLiveModeBackendStateV1,
  property: BuildingSystemPropertyRecordV1
) {
  return Object.values(state.building.placedStructures).find(
    (structure) =>
      structure.plotId === property.plotId &&
      structure.blueprintId === property.blueprintId &&
      structure.use === property.use
  )?.origin;
}

function syncBuildingSystemPhysicalAccessRecordsV1(input: {
  state: HarthmereLiveModeBackendStateV1;
  property: BuildingSystemPropertyRecordV1;
  plotId?: string;
  origin?: { x: number; y: number; z: number };
  nowMs: number;
}) {
  const plot = buildingSystemPlotByIdV1(input.property.plotId ?? input.plotId);
  const blueprint = buildingSystemBlueprintByIdV1(input.property.blueprintId);
  if (!plot || !blueprint) return;
  const origin =
    input.origin ??
    buildingSystemPhysicalOriginForPropertyV1(input.state, input.property);
  const storage = createBuildingSystemStorageContainerV1({
    property: input.property,
    plot,
    blueprint,
    origin,
    nowMs: input.nowMs,
  });
  const door = createBuildingSystemDoorLockV1({
    property: input.property,
    plot,
    blueprint,
    origin,
    nowMs: input.nowMs,
  });
  input.state.building.storageContainers[storage.containerId] = storage;
  input.state.building.doorLocks[door.lockId] = door;
  input.state.building.inWorldMarkers[storage.containerId] = {
    markerId: storage.containerId,
    plotId: plot.plotId,
    kind: "storage_container",
    position: storage.position,
    label: `${blueprint.displayName} Storage`,
    createdAtMs: input.nowMs,
  };
  input.state.building.inWorldMarkers[door.lockId] = {
    markerId: door.lockId,
    plotId: plot.plotId,
    kind: "door_lock",
    position: door.position,
    label: `${blueprint.displayName} Door`,
    createdAtMs: input.nowMs,
  };
  if (input.property.use === "home") {
    const marker = createBuildingSystemHomeConsoleMarkerV1({
      property: input.property,
      plot,
      blueprint,
      origin,
      nowMs: input.nowMs,
    });
    input.state.building.inWorldMarkers[marker.markerId] = marker;
  } else {
    delete input.state.building.inWorldMarkers[
      buildingSystemHomeConsoleMarkerIdV1(input.property.propertyId)
    ];
  }
}

function removeBuildingSystemPhysicalAccessRecordsV1(input: {
  state: HarthmereLiveModeBackendStateV1;
  property: BuildingSystemPropertyRecordV1;
}) {
  if (input.property.storageContainerId) {
    delete input.state.building.storageContainers[
      input.property.storageContainerId
    ];
    delete input.state.building.inWorldMarkers[
      input.property.storageContainerId
    ];
  }
  if (input.property.doorLockId) {
    delete input.state.building.doorLocks[input.property.doorLockId];
    delete input.state.building.inWorldMarkers[input.property.doorLockId];
  }
  delete input.state.building.inWorldMarkers[
    buildingSystemHomeConsoleMarkerIdV1(input.property.propertyId)
  ];
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
  options: { includePrimaryItem: boolean }
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
  return (
    touched &&
    harthmereInventoryCarryWeightV1(projected) > HARTHMERE_CARRY_WEIGHT_LIMIT_V1
  );
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
        Math.max(
          Number(current.level ?? 1),
          harthmereSkillLevelFromTotalXpV1(skillId, xp)
        )
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

export function harthmereLiveModeSharedStateKeyV1(kind: string, id: string) {
  return `harthmere:live_mode:v1:${kind}:${id}`;
}

function defaultHarthmereBusinessOutpostBuildingStateV1(nowMs: number) {
  const placedStructures: HarthmereLiveModeBackendStateV1["building"]["placedStructures"] =
    {};
  const safeZones: HarthmereLiveModeBackendStateV1["building"]["safeZones"] =
    {};
  const inWorldMarkers: HarthmereLiveModeBackendStateV1["building"]["inWorldMarkers"] =
    {};
  const materializationPlans: HarthmereLiveModeBackendStateV1["building"]["materializationPlans"] =
    {};
  for (const record of Object.values(
    HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS_V1
  )) {
    const plan = record.materializationPlan;
    materializationPlans[plan.requestId] = plan;
    placedStructures[plan.requestId] = {
      structureTypeId: plan.structureTypeId,
      origin: plan.origin,
      placedAtMs: nowMs,
      plotId: plan.plotId,
      blueprintId: plan.blueprintId,
      use: plan.use,
      voxelEditCount: plan.edits.length,
      materializedInEcs: true,
    };
    if (plan.safeZone) {
      safeZones[plan.safeZone.plotId] = {
        safeFromMuck: plan.safeZone.safeFromMuck,
        activatedAtMs: plan.safeZone.activatedAtMs,
        area: plan.safeZone.area,
      };
    }
    for (const marker of plan.inWorldMarkers ?? []) {
      inWorldMarkers[marker.markerId] = {
        ...marker,
        createdAtMs: marker.createdAtMs || nowMs,
      };
    }
  }
  return { placedStructures, safeZones, inWorldMarkers, materializationPlans };
}

export function defaultHarthmereLiveModeBackendStateV1(
  actorId: string,
  nowMs: number
): HarthmereLiveModeBackendStateV1 {
  const businessOutpostBuildingState =
    defaultHarthmereBusinessOutpostBuildingStateV1(nowMs);
  const state: HarthmereLiveModeBackendStateV1 = {
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
    crafting: defaultHarthmereLiveModeCraftingStateV1(),
    homeDecoration: defaultHarthmereHomeDecorationStateV1(),
    respec: {
      count: 0,
    },
    talents: {
      nodes: [],
      pointsSpent: 0,
    },
    building: {
      placedStructures: businessOutpostBuildingState.placedStructures,
      ownedPlots: [],
      safeZones: businessOutpostBuildingState.safeZones,
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
        ...businessOutpostBuildingState.inWorldMarkers,
        harthmere_grove_market_jobs_board: {
          markerId: "harthmere_grove_market_jobs_board",
          plotId: "harthmere_market_posting_board",
          kind: "npc_board",
          position: [501.99486179104775, 70, -132.00350672753194],
          label: "Jobs Board",
          createdAtMs: nowMs,
        },
        harthmere_town_market_jobs_board: {
          markerId: "harthmere_town_market_jobs_board",
          plotId: "harthmere_town_market_posting_board",
          kind: "npc_board",
          position: [1046, 65, -202],
          label: "Harthmere Town Jobs Board",
          createdAtMs: nowMs,
        },
      },
      materializationPlans: businessOutpostBuildingState.materializationPlans,
      storageContainers: {},
      doorLocks: {},
    },
    robotProtection: createLiveEntityRobotEnergyStateV1(nowMs),
    guild: defaultHarthmereLiveModeGuildStateV1(),
    banking: defaultHarthmereLiveModeBankingStateV1(),
    law: {
      reputation: {},
      standing: {},
      recentReputationEvents: [],
      fines: {},
      flags: {},
      crimeLog: [],
      crimeRecords: [],
      guardResponses: [],
      restrictedTrespass: {},
      detentionUntilMs: {},
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
    questInvites: {
      invites: {},
      sharedQuests: {},
    },
    property: {
      owned: {},
      buildingProgress: {},
    },
    farming: {
      plots: {},
      harvests: {},
      livestock: {},
    },
    mail: {
      messages: {},
    },
    careLoops: defaultHarthmereCareLoopStateV1(actorId, nowMs),
    combat: {
      hp: 100,
      maxHp: 100,
      ...defaultCombatResourcePoolsV1(1),
      lastStaminaTickMs: nowMs,
      deadFromStaminaAtMs: undefined,
      cooldowns: {},
      deathState: "alive",
      deathRecords: {},
      respawnProtectionUntilMs: undefined,
      threat: {},
      lootClaims: {},
      entitySnapshots: {},
      npcAiTicks: {},
      liveEntityNavigation: {},
      bossTicks: {},
      partyRaidCredits: {},
    },
  };
  syncLiveEntityRobotProtectionToBuildingV1(state, nowMs);
  return state;
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
    const businessOutpostBuildingState =
      defaultHarthmereBusinessOutpostBuildingStateV1(nowMs);
    const state: HarthmereLiveModeBackendStateV1 = {
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
        production: normalizeHarthmereProductionEconomyStateV1(
          (parsed.economy as any)?.production
        ),
      },
      jobsBoard: normalizeHarthmereJobsBoardStateV1(
        (parsed as any).jobsBoard,
        nowMs
      ),
      inventoryLoot: normalizeHarthmereInventoryLootStateV1(
        (parsed as any).inventoryLoot
      ),
      crafting: normalizeCraftingStateV1((parsed as any).crafting),
      homeDecoration: normalizeHarthmereHomeDecorationStateV1(
        (parsed as any).homeDecoration
      ),
      guild: normalizeHarthmereLiveModeGuildStateV1(
        (parsed as any).guild,
        nowMs
      ),
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
            ...(((parsed.law as any)?.standing ?? {}) as Record<
              string,
              unknown
            >),
          }).map(([scopeId, raw]) => [
            scopeId,
            normalizeReputationStandingV1(
              raw as Partial<HarthmereLiveModeReputationStandingV1>
            ),
          ])
        ),
        recentReputationEvents: Array.isArray(
          (parsed.law as any)?.recentReputationEvents
        )
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
        crimeRecords: Array.isArray((parsed.law as any)?.crimeRecords)
          ? (parsed.law as any).crimeRecords.slice(-100)
          : [],
        guardResponses: Array.isArray((parsed.law as any)?.guardResponses)
          ? (parsed.law as any).guardResponses.slice(-100)
          : [],
        restrictedTrespass: {
          ...defaults.law.restrictedTrespass,
          ...((parsed.law as any)?.restrictedTrespass ?? {}),
        },
        detentionUntilMs: {
          ...defaults.law.detentionUntilMs,
          ...((parsed.law as any)?.detentionUntilMs ?? {}),
        },
      },
      classMagic: { ...defaults.classMagic, ...(parsed.classMagic ?? {}) },
      collections: normalizeHarthmereProgressionCollectionsStateV1(
        (parsed as any).collections
      ),
      quests: { ...defaults.quests, ...(parsed.quests ?? {}) },
      questInvites: normalizeHarthmereQuestInviteStateV1(
        (parsed as any).questInvites,
        nowMs
      ),
      property: {
        ...defaults.property,
        ...(parsed.property ?? {}),
        owned: Object.fromEntries(
          Object.entries({
            ...defaults.property.owned,
            ...(((parsed.property as any)?.owned ?? {}) as Record<
              string,
              unknown
            >),
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
      careLoops: normalizeHarthmereCareLoopStateV1(
        (parsed as any).careLoops,
        actorId,
        nowMs
      ),
      combat: {
        ...defaults.combat,
        ...(parsed.combat ?? {}),
        resources: {
          ...defaults.combat.resources,
          ...(((parsed.combat as any)?.resources ?? {}) as Record<
            string,
            number
          >),
        },
        maxResources: {
          ...defaults.combat.maxResources,
          ...(((parsed.combat as any)?.maxResources ?? {}) as Record<
            string,
            number
          >),
        },
        deathRecords: {
          ...defaults.combat.deathRecords,
          ...(((parsed.combat as any)?.deathRecords ?? {}) as Record<
            string,
            any
          >),
        },
        threat: {
          ...defaults.combat.threat,
          ...(((parsed.combat as any)?.threat ?? {}) as Record<string, number>),
        },
        lootClaims: {
          ...defaults.combat.lootClaims,
          ...(((parsed.combat as any)?.lootClaims ?? {}) as Record<
            string,
            number
          >),
        },
        entitySnapshots: {
          ...defaults.combat.entitySnapshots,
          ...(((parsed.combat as any)?.entitySnapshots ?? {}) as Record<
            string,
            any
          >),
        },
        npcAiTicks: {
          ...defaults.combat.npcAiTicks,
          ...(((parsed.combat as any)?.npcAiTicks ?? {}) as Record<
            string,
            any
          >),
        },
        liveEntityNavigation: {
          ...defaults.combat.liveEntityNavigation,
          ...(((parsed.combat as any)?.liveEntityNavigation ?? {}) as Record<
            string,
            any
          >),
        },
        bossTicks: {
          ...defaults.combat.bossTicks,
          ...(((parsed.combat as any)?.bossTicks ?? {}) as Record<string, any>),
        },
        partyRaidCredits: {
          ...defaults.combat.partyRaidCredits,
          ...(((parsed.combat as any)?.partyRaidCredits ?? {}) as Record<
            string,
            any
          >),
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
          ...businessOutpostBuildingState.placedStructures,
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
          ...businessOutpostBuildingState.safeZones,
        },
        activeProjects: {
          ...defaults.building.activeProjects,
          ...((parsed.building as any)?.activeProjects ?? {}),
        },
        inWorldMarkers: {
          ...defaults.building.inWorldMarkers,
          ...((parsed.building as any)?.inWorldMarkers ?? {}),
          ...businessOutpostBuildingState.inWorldMarkers,
        },
        materializationPlans: {
          ...defaults.building.materializationPlans,
          ...((parsed.building as any)?.materializationPlans ?? {}),
          ...businessOutpostBuildingState.materializationPlans,
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
      robotProtection: normalizeLiveEntityRobotEnergyStateV1(
        (parsed as any).robotProtection,
        nowMs
      ),
    };
    syncLiveEntityRobotProtectionToBuildingV1(state, nowMs);
    repairLiveModeZeroHpDeathStateV1(state, {
      nowMs,
      deathId: `zero_hp_repair:${actorId}`,
      zoneId: "harthmere_wilderness",
      cause: "hp_zero_state_repaired",
    });
    return state;
  } catch {
    return defaultHarthmereLiveModeBackendStateV1(actorId, nowMs);
  }
}

export function harthmereLiveModeSharedWorldStateKeyV1(
  worldId: string = HARTHMERE_LIVE_MODE_SHARED_WORLD_ID_V1
) {
  return harthmereLiveModeSharedStateKeyV1("world", worldId);
}

function createSharedLawStateFromBackendV1(
  state: HarthmereLiveModeBackendStateV1
): HarthmereLiveModeSharedLawStateV1 {
  return {
    reputation: {},
    standing: {},
    recentReputationEvents: [],
    fines: {},
    flags: publicLawFlagsV1(state.law.flags),
    crimeLog: (state.law.crimeLog ?? []).slice(-100),
    crimeRecords: (state.law.crimeRecords ?? []).slice(-100),
    guardResponses: (state.law.guardResponses ?? []).slice(-100),
    restrictedTrespass: { ...state.law.restrictedTrespass },
    detentionUntilMs: {},
  };
}

export function createHarthmereLiveModeSharedWorldStateV1(
  state: HarthmereLiveModeBackendStateV1,
  nowMs: number = state.updatedAtMs
): HarthmereLiveModeSharedWorldStateV1 {
  return {
    version: HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1,
    worldId: HARTHMERE_LIVE_MODE_SHARED_WORLD_ID_V1,
    updatedAtMs: nowMs,
    economyProduction: normalizeHarthmereProductionEconomyStateV1(
      state.economy.production
    ),
    jobsBoard: normalizeHarthmereJobsBoardStateV1(state.jobsBoard, nowMs),
    building: normalizeHarthmereLiveModeSharedBuildingStateV1(state.building),
    law: createSharedLawStateFromBackendV1(state),
    guild: normalizeHarthmereLiveModeGuildStateV1(state.guild, nowMs),
    robotProtection: normalizeLiveEntityRobotEnergyStateV1(
      state.robotProtection,
      nowMs
    ),
    exoticMatterDepositClaims: normalizeExoticMatterDepositClaimsV1(
      state.combat.lootClaims
    ),
    questInvites: normalizeHarthmereQuestInviteStateV1(
      state.questInvites,
      nowMs
    ),
  };
}

export function parseHarthmereLiveModeSharedWorldStateV1(
  raw: string | null | undefined,
  nowMs: number
): HarthmereLiveModeSharedWorldStateV1 | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(
      raw
    ) as Partial<HarthmereLiveModeSharedWorldStateV1>;
    const law = (parsed as any).law ?? {};
    return {
      version: HARTHMERE_LIVE_MODE_BACKEND_VERSION_V1,
      worldId: HARTHMERE_LIVE_MODE_SHARED_WORLD_ID_V1,
      updatedAtMs: Math.max(
        0,
        Math.trunc(Number(parsed.updatedAtMs ?? nowMs) || nowMs)
      ),
      economyProduction: normalizeHarthmereProductionEconomyStateV1(
        (parsed as any).economyProduction ?? (parsed as any).economy?.production
      ),
      jobsBoard: normalizeHarthmereJobsBoardStateV1(
        (parsed as any).jobsBoard,
        nowMs
      ),
      building: normalizeHarthmereLiveModeSharedBuildingStateV1(
        (parsed as any).building
      ),
      robotProtection: normalizeLiveEntityRobotEnergyStateV1(
        (parsed as any).robotProtection,
        nowMs
      ),
      law: {
        reputation: { ...(law.reputation ?? {}) },
        standing: Object.fromEntries(
          Object.entries((law.standing ?? {}) as Record<string, unknown>).map(
            ([scopeId, standing]) => [
              scopeId,
              normalizeReputationStandingV1(
                standing as Partial<HarthmereLiveModeReputationStandingV1>
              ),
            ]
          )
        ),
        recentReputationEvents: Array.isArray(law.recentReputationEvents)
          ? law.recentReputationEvents.slice(-50)
          : [],
        fines: { ...(law.fines ?? {}) },
        flags: { ...(law.flags ?? {}) },
        crimeLog: Array.isArray(law.crimeLog) ? law.crimeLog.slice(-100) : [],
        crimeRecords: Array.isArray(law.crimeRecords)
          ? law.crimeRecords.slice(-100)
          : [],
        guardResponses: Array.isArray(law.guardResponses)
          ? law.guardResponses.slice(-100)
          : [],
        restrictedTrespass: { ...(law.restrictedTrespass ?? {}) },
        detentionUntilMs: { ...(law.detentionUntilMs ?? {}) },
      },
      guild: normalizeHarthmereLiveModeGuildStateV1(
        (parsed as any).guild,
        nowMs
      ),
      exoticMatterDepositClaims: normalizeExoticMatterDepositClaimsV1(
        (parsed as any).exoticMatterDepositClaims
      ),
      questInvites: normalizeHarthmereQuestInviteStateV1(
        (parsed as any).questInvites,
        nowMs
      ),
    };
  } catch {
    return undefined;
  }
}

export function mergeHarthmereLiveModeSharedWorldStateIntoBackendV1(
  state: HarthmereLiveModeBackendStateV1,
  shared: HarthmereLiveModeSharedWorldStateV1 | undefined,
  nowMs: number
) {
  if (!shared) return state;
  state.economy.production = normalizeHarthmereProductionEconomyStateV1(
    shared.economyProduction
  );
  state.jobsBoard = normalizeHarthmereJobsBoardStateV1(shared.jobsBoard, nowMs);
  state.questInvites = normalizeHarthmereQuestInviteStateV1(
    shared.questInvites,
    nowMs
  );
  const sharedBuilding = normalizeHarthmereLiveModeSharedBuildingStateV1(
    shared.building
  );
  const businessOutpostBuildingState =
    defaultHarthmereBusinessOutpostBuildingStateV1(nowMs);
  state.building = {
    ...state.building,
    placedStructures: {
      ...state.building.placedStructures,
      ...sharedBuilding.placedStructures,
      ...businessOutpostBuildingState.placedStructures,
    },
    safeZones: {
      ...state.building.safeZones,
      ...sharedBuilding.safeZones,
      ...businessOutpostBuildingState.safeZones,
    },
    inWorldMarkers: {
      ...state.building.inWorldMarkers,
      ...sharedBuilding.inWorldMarkers,
      ...businessOutpostBuildingState.inWorldMarkers,
    },
    materializationPlans: {
      ...state.building.materializationPlans,
      ...sharedBuilding.materializationPlans,
      ...businessOutpostBuildingState.materializationPlans,
    },
    storageContainers: {
      ...state.building.storageContainers,
      ...sharedBuilding.storageContainers,
    },
    doorLocks: {
      ...state.building.doorLocks,
      ...sharedBuilding.doorLocks,
    },
  };
  state.robotProtection = normalizeLiveEntityRobotEnergyStateV1(
    shared.robotProtection,
    nowMs
  );
  const sharedExoticMatterDepositClaims = normalizeExoticMatterDepositClaimsV1(
    shared.exoticMatterDepositClaims
  );
  for (const [claimKey, minedAtMs] of Object.entries(
    sharedExoticMatterDepositClaims
  )) {
    state.combat.lootClaims[claimKey] = Math.max(
      state.combat.lootClaims[claimKey] ?? 0,
      minedAtMs
    );
  }
  syncLiveEntityRobotProtectionToBuildingV1(state, nowMs);
  state.law = {
    ...state.law,
    flags: {
      ...state.law.flags,
      ...publicLawFlagsV1(shared.law.flags),
    },
    crimeLog: mergeByIdNewestFirstV1(
      state.law.crimeLog,
      shared.law.crimeLog,
      100
    ),
    crimeRecords: mergeByIdNewestFirstV1(
      state.law.crimeRecords,
      shared.law.crimeRecords,
      100
    ),
    guardResponses: mergeByIdNewestFirstV1(
      state.law.guardResponses,
      shared.law.guardResponses,
      100
    ),
    restrictedTrespass: {
      ...state.law.restrictedTrespass,
      ...shared.law.restrictedTrespass,
    },
  };
  const previousMemberGuildId = state.guild.memberGuildId;
  const sharedGuild = normalizeHarthmereLiveModeGuildStateV1(
    shared.guild,
    nowMs
  );
  const derivedMemberGuildId =
    previousMemberGuildId ??
    Object.values(sharedGuild.guilds).find(
      (guild) => guild.members[state.actorId]?.status === "active"
    )?.guildId;
  state.guild = {
    ...sharedGuild,
    memberGuildId: derivedMemberGuildId,
    guildId: derivedMemberGuildId ?? sharedGuild.guildId,
    role: derivedMemberGuildId
      ? sharedGuild.guilds[derivedMemberGuildId]?.members[state.actorId]?.rankId
      : sharedGuild.role,
  };
  return state;
}

export function createHarthmereLiveModeGuildClientSnapshotFromBackendV1(
  state: HarthmereLiveModeBackendStateV1
) {
  return createHarthmereLiveModeGuildClientSnapshotV1(
    state.guild,
    state.actorId
  );
}

export function createHarthmereInventoryLootClientSnapshotFromBackendV1(
  state: HarthmereLiveModeBackendStateV1
) {
  if (!state.inventoryLoot.actors[state.actorId]) {
    state.inventoryLoot.actors[state.actorId] =
      createHarthmereInventoryLootActorV1(state.actorId, {
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
    ...createHarthmereInventoryLootClientSnapshotV1(
      state.inventoryLoot,
      state.actorId
    ),
    overflow: state.inventory.overflow.map((entry) => ({ ...entry })),
    materialStorage: {
      items: { ...state.banking.materialStorage },
      maxSlots: state.banking.materialStorageMaxSlots,
      usedSlots: countOccupiedBankSlotsV1(state.banking.materialStorage),
    },
  };
}

function normalizedLiveModePlayerHpV1(
  state: Pick<HarthmereLiveModeBackendStateV1, "combat">
) {
  return Math.max(0, Math.trunc(Number(state.combat.hp ?? 0)));
}

function liveModePlayerDeathStateForHpV1(
  state: Pick<HarthmereLiveModeBackendStateV1, "combat">
): NonNullable<HarthmereLiveModeBackendStateV1["combat"]["deathState"]> {
  const deathState = state.combat.deathState ?? "alive";
  return normalizedLiveModePlayerHpV1(state) <= 0 && deathState === "alive"
    ? "dead"
    : deathState;
}

function repairLiveModeZeroHpDeathStateV1(
  state: HarthmereLiveModeBackendStateV1,
  input: {
    nowMs: number;
    deathId: string;
    zoneId: string;
    cause: string;
    respawnDelayMs?: number;
    createDeathRecord?: boolean;
  }
) {
  const hp = normalizedLiveModePlayerHpV1(state);
  let changed = false;
  if (state.combat.hp !== hp) {
    state.combat.hp = hp;
    changed = true;
  }
  if (hp > 0 || (state.combat.deathState ?? "alive") !== "alive") {
    return changed;
  }

  state.combat.deathState = "dead";
  changed = true;
  if (
    input.createDeathRecord !== false &&
    !state.combat.deathRecords[input.deathId]
  ) {
    state.combat.deathRecords[input.deathId] = {
      deathId: input.deathId,
      cause: input.cause,
      zoneId: input.zoneId,
      atMs: input.nowMs,
      respawnAvailableAtMs:
        input.nowMs + Math.max(0, input.respawnDelayMs ?? 5_000),
    };
  }
  return changed;
}

export function createHarthmereLiveEntityCombatClientSnapshotV1(
  state: HarthmereLiveModeBackendStateV1
) {
  return {
    version: "harthmere-live-entity-combat-client-v1",
    actorId: state.actorId,
    updatedAtMs: state.updatedAtMs,
    entitySnapshots: Object.fromEntries(
      Object.entries(state.combat.entitySnapshots).map(([entityId, entity]) => [
        entityId,
        {
          entityKind: entity.entityKind,
          position: entity.position,
          isAlive: entity.isAlive,
          isAttackable: entity.isAttackable,
          animationState: entity.animationState,
          animationMoving: entity.animationMoving,
          facingYaw: entity.facingYaw,
          combatProtection: entity.combatProtection,
        },
      ])
    ),
    npcAiTicks: { ...state.combat.npcAiTicks },
  };
}

export function createHarthmereCraftingStationClientSnapshotFromBackendV1(
  state: HarthmereLiveModeBackendStateV1,
  stationId?: string,
  stationType?: string,
  nowMs: number = state.updatedAtMs
) {
  ensureHarthmereProductionCraftingCatalogueV1();
  const station = getHarthmereCraftingStationV1(stationId);
  return {
    actorId: state.actorId,
    stationId,
    stationType: stationType ?? station?.stationType,
    stationName: station?.displayName ?? "Crafting Station",
    gold: state.inventory.gold,
    inventoryItems: { ...state.inventory.items },
    materialStorage: { ...state.banking.materialStorage },
    knownRecipes: [...state.classMagic.knownRecipes],
    skills: { ...state.classMagic.skills },
    activeJobs: Object.values(state.crafting.activeJobs),
    history: state.crafting.history.slice(-50),
    nowMs,
  };
}

export function createHarthmereLiveModeFarmingFoodClientSnapshotV1(
  state: HarthmereLiveModeBackendStateV1
) {
  const pools = ensureCombatResourcePoolsV1(state);
  const nowMs = state.updatedAtMs;
  const availableCookingStations = new Set(["campfire"]);
  for (const business of Object.values(state.economy.businesses)) {
    if (
      business.ownerId === state.actorId &&
      business.type === "food_service_restaurant"
    ) {
      availableCookingStations.add("cookpot");
      availableCookingStations.add("oven");
    }
  }
  for (const business of Object.values(state.economy.production.businesses)) {
    if (
      business.ownerId === state.actorId &&
      business.typeId === "food_service_restaurant"
    ) {
      availableCookingStations.add("cookpot");
      availableCookingStations.add("oven");
    }
  }
  return {
    version: "harthmere-live-mode-farming-food-v1",
    actorId: state.actorId,
    stamina: Math.max(0, Math.trunc(Number(pools.resources.stamina ?? 0))),
    maxStamina: Math.max(
      1,
      Math.trunc(Number(pools.maxResources.stamina ?? 100))
    ),
    lastStaminaTickMs: state.combat.lastStaminaTickMs,
    deadFromStaminaAtMs: state.combat.deadFromStaminaAtMs,
    inventory: { ...state.inventory.items },
    foodDefinitions: HARTHMERE_FOOD_DEFINITIONS_V1,
    seedDefinitions: HARTHMERE_SEED_DEFINITIONS_V1,
    cookingRecipes: HARTHMERE_COOKING_RECIPES_V1,
    availableCookingStations: Array.from(availableCookingStations),
    plots: Object.entries(state.farming.plots).map(([plotId, plot]) => ({
      plotId,
      ...plot,
      ready: Number(plot.harvestReadyAtMs ?? Number.POSITIVE_INFINITY) <= nowMs,
    })),
    livestock: Object.values(state.farming.livestock).map((livestock) => ({
      ...livestock,
      productReady:
        Number(livestock.productReadyAtMs ?? Number.POSITIVE_INFINITY) <= nowMs,
    })),
    wildlife: Object.entries(state.combat.entitySnapshots)
      .filter(
        ([, entity]) =>
          entity.species || entity.isLivestock || entity.protectedSpecies
      )
      .map(([entityId, entity]) => ({
        animalId: entityId,
        species: entity.species ?? "animal",
        hp: entity.hp,
        maxHp: entity.maxHp,
        isAlive: entity.isAlive,
        isLivestock: entity.isLivestock === true,
        protectedSpecies: entity.protectedSpecies === true,
        harvestable:
          entity.hp <= 0 &&
          entity.isLivestock !== true &&
          entity.protectedSpecies !== true,
      })),
    harvests: { ...state.farming.harvests },
    updatedAtMs: state.updatedAtMs,
  };
}

export function tickHarthmereLiveModeStaminaForGameplayV1(
  state: HarthmereLiveModeBackendStateV1,
  input: { nowMs: number; gameplayActive: boolean }
) {
  const pools = ensureCombatResourcePoolsV1(state);
  const maxStamina = Math.max(1, Number(pools.maxResources.stamina ?? 100));
  const previousStamina = Math.max(
    0,
    Math.min(maxStamina, Number(pools.resources.stamina ?? maxStamina))
  );
  const previousLastTick = Number(state.combat.lastStaminaTickMs);
  const lastStaminaTickMs = Number.isFinite(previousLastTick)
    ? previousLastTick
    : input.nowMs;
  const previousDeadAt = Number(state.combat.deadFromStaminaAtMs);
  const deadFromStaminaAtMs = Number.isFinite(previousDeadAt)
    ? previousDeadAt
    : undefined;
  const authorityState = {
    ...defaultHarthmereFoodStaminaStateV1(state.actorId, input.nowMs),
    stamina: previousStamina,
    maxStamina,
    lastStaminaTickMs,
    deadFromStaminaAtMs,
    inventory: { ...state.inventory.items },
  };
  const result = tickHarthmereStaminaForGameplayV1(authorityState, input);
  const nextStamina = Math.max(
    0,
    Math.min(maxStamina, Number(result.state.stamina))
  );
  const previousStoredLastTick = state.combat.lastStaminaTickMs;
  const previousStoredDeadAt = state.combat.deadFromStaminaAtMs;

  pools.resources.stamina = nextStamina;
  state.combat.lastStaminaTickMs = result.state.lastStaminaTickMs;
  state.combat.deadFromStaminaAtMs = result.state.deadFromStaminaAtMs;

  if (result.deathTriggered) {
    state.combat.hp = 0;
    state.combat.deathState = "dead";
    const deathId = `stamina_depleted_${Math.trunc(input.nowMs)}`;
    state.combat.deathRecords[deathId] = {
      deathId,
      cause: "stamina_depleted",
      zoneId: "harthmere",
      atMs: input.nowMs,
      respawnAvailableAtMs: input.nowMs + 5_000,
    };
  }

  return {
    warnings: result.warnings,
    deathTriggered: result.deathTriggered,
    changed:
      Math.abs(nextStamina - previousStamina) > 0.0001 ||
      state.combat.lastStaminaTickMs !== previousStoredLastTick ||
      state.combat.deadFromStaminaAtMs !== previousStoredDeadAt ||
      result.deathTriggered,
  };
}

export function createHarthmereProductionEconomyClientSnapshotFromBackendV1(
  state: HarthmereLiveModeBackendStateV1
) {
  return createHarthmereProductionEconomyClientSnapshotV1(
    state.economy.production,
    state.actorId
  );
}

export function createHarthmereJobsBoardClientSnapshotFromBackendV1(
  state: HarthmereLiveModeBackendStateV1
) {
  const snapshot = createHarthmereJobsBoardClientSnapshotV1(
    state.jobsBoard,
    state.actorId
  );
  const myBusinesses = Object.values(state.economy.production.businesses)
    .filter(
      (business) =>
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
  nowMs: number = state.updatedAtMs
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
    homeDecoration: state.homeDecoration,
    inWorldMarkers: state.building.inWorldMarkers,
    storageContainers: state.building.storageContainers,
    doorLocks: state.building.doorLocks,
    businesses: state.economy.businesses,
    robotProtection: state.robotProtection,
  };
}

export function createHarthmereLiveModeQuestClientSnapshotV1(
  state: HarthmereLiveModeBackendStateV1
) {
  const questInvites = normalizeHarthmereQuestInviteStateV1(
    state.questInvites,
    state.updatedAtMs
  );
  const pendingReceivedInvites = Object.values(questInvites.invites)
    .filter(
      (invite) =>
        invite.inviteeActorId === state.actorId && invite.status === "pending"
    )
    .sort((left, right) => right.createdAtMs - left.createdAtMs);
  const sentPendingInvites = Object.values(questInvites.invites)
    .filter(
      (invite) =>
        invite.inviterActorId === state.actorId && invite.status === "pending"
    )
    .sort((left, right) => right.createdAtMs - left.createdAtMs);
  const sharedQuests = Object.values(questInvites.sharedQuests)
    .filter((quest) => quest.memberActorIds.includes(state.actorId))
    .sort((left, right) => right.updatedAtMs - left.updatedAtMs);
  return {
    version: "harthmere-live-mode-quest-state-v1",
    actorId: state.actorId,
    active: JSON.parse(JSON.stringify(state.quests.active)),
    completed: { ...state.quests.completed },
    pendingReceivedInvites,
    sentPendingInvites,
    sharedQuests,
    updatedAtMs: state.updatedAtMs,
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
  const buildingMaterializationPlans: BuildingSystemAnyMaterializationPlanV1[] =
    [];
  const playerStateKey = harthmereLiveModePlayerStateKeyV1(envelope.actorId);

  const loanConsequenceResult = applyHarthmereBankLoanConsequencesV1(
    next,
    nowMs
  );
  if (loanConsequenceResult.changed) {
    warnings.push(
      ...loanConsequenceResult.defaultedLoanIds.map(
        (loanId) => `bank_loan_defaulted:${loanId}`
      )
    );
    touchedModels.add("bank_loan_consequence");
    touchedModels.add("bank_transaction_log");
    touchedModels.add("law_flags");
    touchedModels.add("law_reputation");
  }

  ensureBuildingSystemStructureDefinitionsV1();
  ensureHarthmereLiveModeCombatCatalogueV1();
  ensureHarthmereProductionCraftingCatalogueV1();
  ensureHarthmereProductionVendorCatalogV1();
  ensureCombatResourcePoolsV1(next);

  function markLiveModePlayerDeadForZeroHpV1(input: {
    deathId: string;
    cause: string;
    respawnDelayMs?: number;
  }) {
    const previousDeathState = next.combat.deathState ?? "alive";
    const hadDeathRecord = Boolean(next.combat.deathRecords[input.deathId]);
    const changed = repairLiveModeZeroHpDeathStateV1(next, {
      nowMs,
      deathId: input.deathId,
      zoneId: envelope.zoneId,
      cause: input.cause,
      respawnDelayMs: input.respawnDelayMs,
    });
    if (!changed) {
      return false;
    }
    touchedModels.add("combat_state");
    touchedModels.add("player_status");
    if (previousDeathState === "alive" && next.combat.deathState === "dead") {
      touchedModels.add("death_state");
    }
    if (!hadDeathRecord && next.combat.deathRecords[input.deathId]) {
      touchedModels.add("death_record");
    }
    return true;
  }

  if (envelope.actionKind !== "request_death_transition") {
    markLiveModePlayerDeadForZeroHpV1({
      deathId: `${envelope.requestId}:player_zero_hp_repair`,
      cause: "hp_zero_state_repaired",
      respawnDelayMs: payloadNumber(envelope, "respawnDelayMs") ?? 5_000,
    });
  }

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
  function buildActorSnapshot(
    abilityId?: string
  ): HarthmereCombatActorSnapshotV1 {
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
      equippedAbilities: Object.values(next.classMagic.loadout).filter(
        Boolean
      ) as string[],
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
    const safeZones = [
      "the_grove",
      "harthmere_grove",
      "harthmere_town_square",
      "harthmere_temple",
      "harthmere_market",
      "temple_green",
      "safe_zone",
    ];
    const isSafe =
      safeZones.some((z) => envelope.zoneId.includes(z)) ||
      isHarthmereLiveModeTownSafePositionV1(
        actorWorldPositionFromAuthorityV1(envelope)
      );
    return {
      zoneId: envelope.zoneId,
      pvpRule: isSafe ? "safe_zone" : "contested",
      isSafeZone: isSafe,
      allowPvP: !isSafe,
      activeLegalSystem: true,
    };
  }

  function buildCombatTargetSnapshot(
    targetId: string,
    target: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string],
    zone: HarthmereZoneSnapshotV1
  ): HarthmereCombatTargetSnapshotV1 {
    const combatProtection = liveEntityCombatProtectionReasonV1(target);
    return {
      targetId,
      isHostile: target.isHostile,
      isAlive: target.isAlive,
      isAttackable: target.isAttackable && !combatProtection,
      hp: target.hp,
      maxHp: target.maxHp,
      position: target.position,
      pvpFlagged: target.pvpFlagged ?? false,
      isPlayer: target.isPlayer ?? false,
      zonePvPRule: target.zonePvPRule ?? zone.pvpRule,
    };
  }

  function buildLiveEntityAiActorSnapshotV1(
    npcId: string,
    npcSnapshot: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string],
    abilityId: string
  ): HarthmereCombatActorSnapshotV1 {
    const resourceKind = abilityResourceKindForLiveModeV1(abilityId, "warrior");
    const level = Math.max(1, Math.trunc(Number(npcSnapshot.level ?? 1)));
    const maxResource = Math.max(
      1,
      Math.trunc(
        Number(
          npcSnapshot.maxResources?.[resourceKind] ??
            liveModeResourceMaxV1(resourceKind, level)
        ) || 1
      )
    );
    const resource = Math.max(
      0,
      Math.min(
        maxResource,
        Math.trunc(Number(npcSnapshot.resources?.[resourceKind] ?? maxResource))
      )
    );
    const cooldowns = splitCombatCooldownsV1(npcSnapshot.cooldowns ?? {});
    return {
      actorId: npcId,
      classId: "warrior",
      specializationId: "none",
      level,
      hp: Math.max(0, Math.trunc(Number(npcSnapshot.hp ?? 0))),
      maxHp: Math.max(1, Math.trunc(Number(npcSnapshot.maxHp ?? 1))),
      resource,
      maxResource,
      resourceKind,
      cooldowns: cooldowns.individual,
      sharedCooldowns: cooldowns.shared,
      knownAbilities: [abilityId],
      equippedAbilities: [abilityId],
      activeTalentNodes: [],
      mainHandWeaponType: "unarmed",
      offHandWeaponType: "none",
      deathState: npcSnapshot.isAlive && npcSnapshot.hp > 0 ? "alive" : "dead",
      position: npcSnapshot.position,
      pvpFlagged: false,
      legalFlags: {},
    };
  }

  function buildLiveEntityAiPlayerTargetSnapshotV1(
    playerPosition: { x: number; y: number; z: number },
    zone: HarthmereZoneSnapshotV1
  ): HarthmereCombatTargetSnapshotV1 {
    return {
      targetId: next.actorId,
      isHostile: true,
      isAlive:
        (next.combat.deathState ?? "alive") === "alive" && next.combat.hp > 0,
      isAttackable: (next.combat.respawnProtectionUntilMs ?? 0) <= nowMs,
      hp: Math.max(0, Math.trunc(Number(next.combat.hp ?? 0))),
      maxHp: Math.max(1, Math.trunc(Number(next.combat.maxHp ?? 1))),
      position: playerPosition,
      pvpFlagged: false,
      // PvE NPC damage mutates the player, but it is not a player-vs-player
      // legality check. The NPC still goes through the same combat reducer.
      isPlayer: false,
      zonePvPRule: zone.pvpRule,
    };
  }

  function liveEntityAiCombatDistanceV1(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number }
  ) {
    return Math.sqrt(
      Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2)
    );
  }

  function liveEntityAiRequiresLineOfSightV1(
    npcSnapshot: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string]
  ) {
    return npcSnapshot.requiresLineOfSight !== false;
  }

  function liveEntityAiLineOfSightToPlayerV1(
    npcSnapshot: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string]
  ) {
    if (!liveEntityAiRequiresLineOfSightV1(npcSnapshot)) {
      return true;
    }
    return payloadString(envelope, "lineOfSight") === "false" ||
      payloadBoolean(envelope, "lineOfSight") === false
      ? false
      : true;
  }

  function liveEntityAiChaseRangeV1(
    npcId: string,
    npcSnapshot: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string]
  ) {
    const explicitLeash = Number(npcSnapshot.leashRange);
    if (Number.isFinite(explicitLeash) && explicitLeash > 0) {
      return Math.max(1, Math.min(80, explicitLeash));
    }
    const explicitAggro = Number(npcSnapshot.aggroRange);
    if (Number.isFinite(explicitAggro) && explicitAggro > 0) {
      return Math.max(1, Math.min(80, explicitAggro + 6));
    }
    const kind = liveEntityKindForSnapshotV1(npcId, npcSnapshot);
    if (kind === "mux" || kind === "hex") return 22;
    if (kind === "monster" || kind === "undead") return 24;
    if (kind === "robot" || kind === "construct") return 18;
    if (kind === "animal") return 14;
    return 16;
  }

  function liveEntityAiPlayerTargetBlockReasonV1(input: {
    npcId: string;
    npcSnapshot: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string];
    playerPosition?: { x: number; y: number; z: number };
  }) {
    if (
      (next.combat.deathState ?? "alive") !== "alive" ||
      next.combat.hp <= 0
    ) {
      return "player_not_alive";
    }
    if ((next.combat.respawnProtectionUntilMs ?? 0) > nowMs) {
      return "player_protected";
    }
    if (!input.playerPosition) {
      return "missing_player_position";
    }
    if (
      buildZoneSnapshot().isSafeZone ||
      isHarthmereLiveModeTownSafePositionV1(input.playerPosition)
    ) {
      return "safe_zone";
    }
    if (!liveEntityAiLineOfSightToPlayerV1(input.npcSnapshot)) {
      return "no_line_of_sight";
    }
    const distance = liveEntityAiCombatDistanceV1(
      input.npcSnapshot.position,
      input.playerPosition
    );
    if (distance > liveEntityAiChaseRangeV1(input.npcId, input.npcSnapshot)) {
      return "target_out_of_chase_range";
    }
    return undefined;
  }

  function applyLiveEntityAiPlayerAttackV1(input: {
    npcId: string;
    npcSnapshot:
      | HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string]
      | undefined;
    targetId?: string;
  }) {
    if (!input.npcSnapshot) {
      return { attackBlockedReason: "missing_npc_snapshot" };
    }
    if (input.targetId !== next.actorId) {
      return undefined;
    }
    const npcSnapshot = input.npcSnapshot;
    if (!npcSnapshot.isAlive || npcSnapshot.hp <= 0) {
      return { attackBlockedReason: "npc_not_alive" };
    }
    if (!npcSnapshot.isAttackable) {
      return { attackBlockedReason: "npc_not_attackable" };
    }
    if (
      (next.combat.deathState ?? "alive") !== "alive" ||
      next.combat.hp <= 0
    ) {
      return {
        attackBlockedReason: "player_not_alive",
        playerHpBefore: Math.max(0, Math.trunc(Number(next.combat.hp ?? 0))),
        playerHpAfter: Math.max(0, Math.trunc(Number(next.combat.hp ?? 0))),
        playerDeathState: next.combat.deathState ?? "dead",
      };
    }
    if ((next.combat.respawnProtectionUntilMs ?? 0) > nowMs) {
      return {
        attackBlockedReason: "player_protected",
        playerHpBefore: next.combat.hp,
        playerHpAfter: next.combat.hp,
        playerDeathState: next.combat.deathState ?? "alive",
      };
    }
    if (buildZoneSnapshot().isSafeZone) {
      return {
        attackBlockedReason: "safe_zone",
        playerHpBefore: next.combat.hp,
        playerHpAfter: next.combat.hp,
        playerDeathState: next.combat.deathState ?? "alive",
      };
    }
    const playerPosition = actorWorldPositionFromAuthorityV1(envelope);
    if (!playerPosition) {
      return {
        attackBlockedReason: "missing_player_position",
        playerHpBefore: next.combat.hp,
        playerHpAfter: next.combat.hp,
        playerDeathState: next.combat.deathState ?? "alive",
      };
    }
    if (isHarthmereLiveModeTownSafePositionV1(playerPosition)) {
      return {
        attackBlockedReason: "safe_zone",
        playerHpBefore: next.combat.hp,
        playerHpAfter: next.combat.hp,
        playerDeathState: next.combat.deathState ?? "alive",
      };
    }
    if (!liveEntityAiLineOfSightToPlayerV1(npcSnapshot)) {
      return {
        attackBlockedReason: "no_line_of_sight",
        playerHpBefore: next.combat.hp,
        playerHpAfter: next.combat.hp,
        playerDeathState: next.combat.deathState ?? "alive",
      };
    }

    const abilityId =
      payloadString(envelope, "npcAbilityId") ??
      HARTHMERE_LIVE_ENTITY_NPC_ATTACK_ABILITY_ID_V1;
    if (abilityId === HARTHMERE_LIVE_ENTITY_NPC_ATTACK_ABILITY_ID_V1) {
      ensureHarthmereLiveEntityNpcAttackAbilityV1();
    }
    const ability = getHarthmereAbilityV1(abilityId);
    if (!ability) {
      return { attackBlockedReason: "unknown_npc_ability" };
    }

    const range = Number.isFinite(npcSnapshot.attackRange)
      ? Math.max(0, Number(npcSnapshot.attackRange))
      : ability.rangeUnits;
    if (
      liveEntityAiCombatDistanceV1(npcSnapshot.position, playerPosition) > range
    ) {
      return {
        attackBlockedReason: "target_out_of_range",
        playerHpBefore: next.combat.hp,
        playerHpAfter: next.combat.hp,
        playerDeathState: next.combat.deathState ?? "alive",
      };
    }

    const playerHpBefore = Math.max(0, Math.trunc(Number(next.combat.hp ?? 0)));
    const combatResult = reduceHarthmereCombatActionV1(
      {
        requestId: `${envelope.requestId}:npc_attack`,
        kind: "ability_cast",
        actorId: input.npcId,
        targetId: next.actorId,
        abilityId,
        nowMs,
      },
      {
        actor: buildLiveEntityAiActorSnapshotV1(
          input.npcId,
          npcSnapshot,
          abilityId
        ),
        target: buildLiveEntityAiPlayerTargetSnapshotV1(
          playerPosition,
          buildZoneSnapshot()
        ),
        nearbyTargets: [],
        zone: buildZoneSnapshot(),
        respecCount: 0,
        actorGold: 0,
        talentPointsAvailable: 0,
      }
    );

    if (!combatResult.ok) {
      warnings.push(
        ...combatResult.errors.map((error) => `npc_combat_rejected:${error}`)
      );
      touchedModels.add("npc_combat_rejection");
      return {
        attackBlockedReason: combatResult.errors[0] ?? "combat_rejected",
        playerHpBefore,
        playerHpAfter: next.combat.hp,
        playerDeathState: next.combat.deathState ?? "alive",
      };
    }

    warnings.push(
      ...combatResult.warnings.map((warning) => `npc_combat:${warning}`)
    );
    npcSnapshot.cooldowns ??= {};
    for (const [key, expiresAt] of Object.entries(combatResult.newCooldowns)) {
      npcSnapshot.cooldowns[key] = expiresAt;
    }
    for (const [key, expiresAt] of Object.entries(
      combatResult.newSharedCooldowns
    )) {
      npcSnapshot.cooldowns[`shared:${key}`] = expiresAt;
    }

    const resourceKind = abilityResourceKindForLiveModeV1(abilityId, "warrior");
    npcSnapshot.resources ??= {};
    npcSnapshot.maxResources ??= {};
    npcSnapshot.maxResources[resourceKind] = Math.max(
      1,
      Number(npcSnapshot.maxResources[resourceKind]) ||
        liveModeResourceMaxV1(resourceKind, npcSnapshot.level ?? 1)
    );
    npcSnapshot.resources[resourceKind] = Math.max(
      0,
      combatResult.actorResourceAfter
    );

    const damage = Math.max(0, Math.trunc(Number(combatResult.damage ?? 0)));
    if (damage > 0) {
      next.combat.hp = Math.max(0, playerHpBefore - damage);
      npcSnapshot.lastAiAttackAtMs = nowMs;
      npcSnapshot.lastAiAttackDamage = damage;
      npcSnapshot.lastAiAttackTargetId = next.actorId;
      npcSnapshot.lastAiAttackResourceKind = resourceKind;
      npcSnapshot.lastAiAttackResourceAfter =
        npcSnapshot.resources[resourceKind];
      if (next.combat.hp <= 0) {
        markLiveModePlayerDeadForZeroHpV1({
          deathId: `${envelope.requestId}:npc_player_death`,
          cause: `killed_by:${input.npcId}`,
          respawnDelayMs: payloadNumber(envelope, "respawnDelayMs") ?? 5_000,
        });
      }
      touchedModels.add("player_status");
    }
    touchedModels.add("combat_state");
    touchedModels.add("combat_resources");
    touchedModels.add("npc_ai_attack");
    touchedModels.add("cooldown");

    return {
      playerDamage: damage,
      playerHpBefore,
      playerHpAfter: next.combat.hp,
      playerDeathState: next.combat.deathState ?? "alive",
    };
  }

  function liveEntityCombatProtectionReasonV1(
    target: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string]
  ): HarthmereLiveEntityCombatProtectionV1 | undefined {
    if (
      target.combatProtection &&
      liveEntityCombatProtectionBlocksDamageV1(target.combatProtection)
    ) {
      return target.combatProtection;
    }
    if (target.protectedSpecies) return "protected_species";
    if (
      target.entityKind === "object" &&
      target.aiEnabled === false &&
      !target.movementSpeed
    ) {
      return "immobile_object";
    }
    return undefined;
  }

  function liveEntityCombatProtectionBlocksDamageV1(
    protection: HarthmereLiveEntityCombatProtectionV1
  ) {
    return protection !== "livestock" && protection !== "owned_pet";
  }

  function liveEntityIsUnauthorizedOwnedAnimalKillV1(
    target: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string]
  ) {
    if (target.ownerId === next.actorId) return false;
    if (target.isLivestock) return true;
    if (
      target.ownerId &&
      (target.entityKind === "pet" ||
        target.entityKind === "summon" ||
        target.entityKind === "animal")
    ) {
      return true;
    }
    return target.entityKind === "pet" || target.entityKind === "summon";
  }

  function liveEntityOwnedAnimalKillValueGoldV1(
    target: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string]
  ) {
    const explicit = Number(
      (target as any).valueGold ??
        (target as any).marketValueGold ??
        (target as any).baseValueGold
    );
    if (Number.isFinite(explicit) && explicit > 0) {
      return Math.trunc(explicit);
    }
    if (target.entityKind === "pet" || target.entityKind === "summon") {
      return 500;
    }
    if (target.isLivestock) {
      return 250;
    }
    return 150;
  }

  function recordLiveEntityOwnedAnimalKillCrimeV1(
    targetId: string,
    target: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string]
  ) {
    if (!liveEntityIsUnauthorizedOwnedAnimalKillV1(target)) return;
    const factionId =
      payloadString(envelope, "factionId") ?? HARTHMERE_CIVIL_LAW_FACTION_ID_V1;
    const witnessLevel = payloadString(envelope, "witnessLevel") ?? "public";
    const witnessMultiplier = reputationWitnessMultiplierV1(witnessLevel);
    const likeabilityDeltaBox = { value: 0 };
    const legalDeltaBox = { value: 0 };
    const notorietyDeltaBox = { value: 0 };
    const fineDeltaBox = { value: 0 };
    const crimeEnvelope: HarthmereLiveModeAuthorityEnvelopeV1 = {
      ...envelope,
      requestId: `${envelope.requestId}:owned_animal_kill_crime`,
      actionKind: "request_law_reputation_mutation",
      subsystem: "law",
      targetId,
      payload: {
        factionId,
        crimeKind: "murder",
        valueGold: liveEntityOwnedAnimalKillValueGoldV1(target),
        witnesses: payloadNumber(envelope, "witnesses") ?? 1,
        lineOfSight: payloadBoolean(envelope, "lineOfSight") ?? true,
        noise: payloadNumber(envelope, "noise") ?? 50,
        locationId: payloadString(envelope, "locationId") ?? envelope.zoneId,
        resourceOwnership: "owned",
        reason: target.isLivestock
          ? "unauthorized_livestock_kill"
          : "unauthorized_pet_kill",
      },
    };
    const record = applyHarthmereLiveModeCrimeEventV1({
      state: next,
      envelope: crimeEnvelope,
      factionId,
      witnessLevel,
      witnessMultiplier,
      nowMs,
      likeabilityDelta: likeabilityDeltaBox,
      legalDelta: legalDeltaBox,
      notorietyDelta: notorietyDeltaBox,
      fineDelta: fineDeltaBox,
      warnings,
      touchedModels,
      sharedStateKeys,
    });
    if (!record) return;
    const before =
      next.law.standing[factionId] ?? defaultReputationStandingV1();
    const after = applyReputationStandingDeltaV1(
      before,
      {
        likeability: likeabilityDeltaBox.value,
        legal: legalDeltaBox.value,
        notoriety: notorietyDeltaBox.value,
      },
      witnessMultiplier
    );
    next.law.standing[factionId] = after;
    next.law.recentReputationEvents = [
      {
        id: crimeEnvelope.requestId,
        atMs: nowMs,
        scopeId: factionId,
        witnessLevel,
        likeabilityDelta: after.likeability - before.likeability,
        legalDelta: after.legal - before.legal,
        notorietyDelta: after.notoriety - before.notoriety,
        reason: crimeEnvelope.payload.reason as string,
      },
      ...(next.law.recentReputationEvents ?? []),
    ].slice(0, 50);
    if (fineDeltaBox.value !== 0) {
      recordDelta(next.law.fines, factionId, fineDeltaBox.value);
    }
    next.law.flags[record.kind] = true;
    next.law.crimeLog.push({
      id: crimeEnvelope.requestId,
      kind: record.kind,
      atMs: nowMs,
      zoneId: envelope.zoneId,
    });
    touchedModels.add("law_standing");
    touchedModels.add("law_reputation_events");
    touchedModels.add("law_reputation");
  }

  function normalizeLiveEntityLootStacksV1(
    target: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string]
  ) {
    const stacks: Record<string, number> = {};
    for (const [itemId, count] of Object.entries(target.lootDrops ?? {})) {
      const safeCount = Math.max(0, Math.trunc(Number(count) || 0));
      if (itemId && safeCount > 0) {
        stacks[itemId] = (stacks[itemId] ?? 0) + safeCount;
      }
    }
    if (
      liveEntityShouldDropDefaultRawMeatV1(target) &&
      !Object.keys(stacks).some(liveEntityLootItemIsMeatV1)
    ) {
      stacks.raw_meat = (stacks.raw_meat ?? 0) + 2;
    }
    return stacks;
  }

  function liveEntityLootItemIsMeatV1(itemId: string) {
    return /(^|[_-])(meat|venison)($|[_-])/i.test(itemId);
  }

  function liveEntityShouldDropDefaultRawMeatV1(
    target: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string]
  ) {
    if (
      target.protectedSpecies ||
      (target.combatProtection &&
        liveEntityCombatProtectionBlocksDamageV1(target.combatProtection)) ||
      target.entityKind === "pet" ||
      target.entityKind === "summon"
    ) {
      return false;
    }
    if (target.ownerId && !target.isLivestock) return false;
    if (target.entityKind === "animal") return true;
    const species = `${target.species ?? ""}`.toLowerCase();
    return /\b(wolf|bear|boar|deer|elk|moose|rabbit|hare|fox|snake|rat|stag|doe|buck)\b/.test(
      species
    );
  }

  function liveEntityLootSourceKindV1(
    target: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string]
  ) {
    return `live_entity:${target.entityKind ?? target.species ?? "unknown"}`;
  }

  function createLiveEntityDefeatLootDropV1(
    targetId: string,
    target: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string]
  ) {
    const itemStacks = normalizeLiveEntityLootStacksV1(target);
    if (Object.keys(itemStacks).length === 0) {
      return undefined;
    }
    const safeTargetId = targetId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const dropId = `hm_live_defeat_${safeTargetId}_${envelope.requestId}`;
    const existing = next.inventoryLoot.lootDrops[dropId];
    if (existing) {
      target.lootDropId = existing.dropId;
      return existing.dropId;
    }
    const drop: HarthmereInventoryLootDropV1 = {
      dropId,
      sourceKind: liveEntityLootSourceKindV1(target),
      sourceId: targetId,
      sourceLevel: target.level,
      position: target.position,
      itemStacks,
      instanceIds: [],
      ownerActorIds: [
        ...new Set(target.lootOwnerActorIds ?? [envelope.actorId]),
      ],
      pickupToken: `${dropId}:${envelope.requestId}:${nowMs}`,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + HARTHMERE_INVENTORY_LOOT_DEFAULT_DROP_TTL_MS_V1,
      status: "available",
      abuseFlags: [],
    };
    next.inventoryLoot.lootDrops[dropId] = drop;
    target.lootDropId = dropId;
    sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("loot_drop", dropId));
    touchedModels.add("inventory_loot_drops");
    return dropId;
  }

  function ensureInventoryLootActorSyncedV1() {
    const existing = next.inventoryLoot.actors[next.actorId];
    if (existing) {
      existing.gold = next.inventory.gold;
      existing.items = { ...next.inventory.items };
      existing.bank = { ...next.inventory.bank };
      existing.equipment = { ...next.inventory.equipment };
      return;
    }
    next.inventoryLoot.actors[next.actorId] =
      createHarthmereInventoryLootActorV1(next.actorId, {
        gold: next.inventory.gold,
        items: { ...next.inventory.items },
        bank: { ...next.inventory.bank },
        equipment: { ...next.inventory.equipment },
      });
  }

  function inventoryLootDefinitionFromLiveItemV1(
    itemId: string
  ): HarthmereInventoryLootItemDefinitionV1 | undefined {
    const def =
      getHarthmereItemDefinitionV1(itemId) ??
      generatedLiveModeLootItemDefinitionV1(itemId);
    if (!def) return undefined;
    const category = itemCategoryFromDefinitionV1(def, itemId);
    const lootCategory: HarthmereInventoryLootItemDefinitionV1["category"] =
      category === "currency"
        ? "currency"
        : category === "quest"
        ? "quest"
        : category === "materials"
        ? "material"
        : category === "consumables"
        ? "consumable"
        : category === "tools"
        ? /sword|bow|staff|wand|axe/.test(
            `${itemId} ${def.displayName}`.toLowerCase()
          )
          ? "weapon"
          : "tool"
        : "material";
    return {
      itemId,
      displayName: def.displayName,
      category: lootCategory,
      rarity: "common",
      maxStackSize: def.maxStackSize,
      baseValueGold: def.baseValue,
      weight: harthmereItemUnitWeightV1(itemId),
      volume: 1,
      binding: def.binding === "quest" ? "quest" : def.binding,
      tradeable: def.tradeable,
      legalClass: def.isQuestItem ? "quest_bound" : "common",
      allowedStorage: ["backpack", "bank", "business_warehouse", "guild_vault"],
      businessUses: [],
      jobUses: [],
      townNeeds: [],
      perishable: false,
      hazardLevel: 0,
      contaminationRisk: 0,
      durabilityMax: def.durabilityMax,
      repairable: def.repairable === true,
      salvageOutputs: def.salvageOutputs,
      lootTableTags: [],
      uniqueInstance: def.maxStackSize <= 1 || Boolean(def.durabilityMax),
      qualityFloor: def.qualityFloor,
    };
  }

  function generatedLiveModeLootItemDefinitionV1(
    itemId: string
  ): HarthmereItemDefinitionV1 | undefined {
    const existing = getHarthmereItemDefinitionV1(itemId);
    if (existing) return existing;
    const isSeed = !!HARTHMERE_SEED_DEFINITIONS_V1[itemId];
    const isFood = !!HARTHMERE_FOOD_DEFINITIONS_V1[itemId];
    const helperQuestItemCopy = liveEntityHelperQuestItemCopyForIdV1(itemId);
    const isMaterial = isSeed || isLikelyBankingMaterialItemIdV1(itemId);
    if (!isSeed && !isFood && !helperQuestItemCopy && !isMaterial) {
      return undefined;
    }
    const def: HarthmereItemDefinitionV1 = {
      itemId,
      displayName:
        helperQuestItemCopy?.displayName ?? humanizeHarthmereItemIdV1(itemId),
      description: helperQuestItemCopy?.description,
      maxStackSize:
        helperQuestItemCopy?.maxStackSize ?? (isMaterial ? 9999 : 999),
      baseValue: helperQuestItemCopy?.baseValue ?? 0,
      binding: helperQuestItemCopy?.binding ?? "none",
      isQuestItem: helperQuestItemCopy?.isQuestItem ?? false,
      isCurrency: false,
      isConsumable: helperQuestItemCopy?.isConsumable ?? isFood,
      isCraftingMaterial: helperQuestItemCopy?.isCraftingMaterial ?? isMaterial,
      isSpellTome: false,
      levelRequirement: 1,
      classRestriction: [],
      stats: {},
      tradeable: helperQuestItemCopy?.tradeable ?? true,
    };
    registerHarthmereItemDefinitionV1(def);
    return def;
  }

  function inventoryLootContextForDropV1(drop: HarthmereInventoryLootDropV1) {
    const itemDefinitions: Record<
      string,
      HarthmereInventoryLootItemDefinitionV1
    > = {};
    for (const itemId of Object.keys(drop.itemStacks)) {
      const def = inventoryLootDefinitionFromLiveItemV1(itemId);
      if (def) itemDefinitions[itemId] = def;
    }
    for (const instanceId of drop.instanceIds) {
      const instance = next.inventoryLoot.itemInstances[instanceId];
      if (!instance) continue;
      const def = inventoryLootDefinitionFromLiveItemV1(instance.itemId);
      if (def) itemDefinitions[instance.itemId] = def;
    }
    return { itemDefinitions, lootTables: {} };
  }

  function liveLootDropBackpackStacksForCarryV1(
    stacks: Record<string, number>
  ) {
    const backpackStacks: Record<string, number> = {};
    for (const [itemId, count] of Object.entries(stacks)) {
      const safeCount = Math.max(0, Math.trunc(Number(count) || 0));
      if (safeCount <= 0) continue;
      const def = getHarthmereItemDefinitionV1(itemId);
      const category = itemCategoryFromDefinitionV1(def, itemId);
      if (category === "currency") continue;
      if (
        category === "materials" &&
        bankRecordHasCapacityV1(
          next.banking.materialStorage,
          itemId,
          next.banking.materialStorageMaxSlots
        )
      ) {
        continue;
      }
      backpackStacks[itemId] = safeCount;
    }
    return backpackStacks;
  }

  function routeInventoryLootActorMaterialsToLiveStorageV1(
    stacks: Record<string, number>
  ) {
    const actor = next.inventoryLoot.actors[next.actorId];
    if (!actor) return;
    for (const [itemId, count] of Object.entries(stacks)) {
      const safeCount = Math.max(0, Math.trunc(Number(count) || 0));
      if (safeCount <= 0) continue;
      const def = getHarthmereItemDefinitionV1(itemId);
      if (itemCategoryFromDefinitionV1(def, itemId) !== "materials") continue;
      const actorCount = Math.max(0, Math.trunc(actor.items[itemId] ?? 0));
      const moveCount = Math.min(actorCount, safeCount);
      if (moveCount <= 0) continue;
      if (
        !bankRecordHasCapacityV1(
          next.banking.materialStorage,
          itemId,
          next.banking.materialStorageMaxSlots
        )
      ) {
        continue;
      }
      applyBankRecordDeltaV1(actor.items, itemId, -moveCount);
      applyBankRecordDeltaV1(next.banking.materialStorage, itemId, moveCount);
      touchedModels.add("material_storage");
    }
  }

  function syncInventoryLootActorToLiveInventoryV1() {
    const actor = next.inventoryLoot.actors[next.actorId];
    if (!actor) return;
    next.inventory.gold = Math.max(0, Math.trunc(actor.gold));
    next.inventory.items = { ...actor.items };
    next.inventory.bank = { ...actor.bank };
    next.inventory.equipment = { ...actor.equipment };
  }

  function liveEntityKindForSnapshotV1(
    entityId: string,
    target: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string]
  ): HarthmereLiveEntityKindV1 {
    if (target.entityKind) return target.entityKind;
    const text = `${entityId} ${target.species ?? ""}`.toLowerCase();
    if (target.isLivestock || target.protectedSpecies) return "animal";
    if (/robot|sentinel|construct/.test(text)) return "robot";
    if (/mux|muck|muckling|mucker/.test(text)) return "mux";
    if (/hex|hexer/.test(text)) return "hex";
    if (/undead|zombie|corpse|drowned|dead/.test(text)) return "undead";
    if (
      /animal|wolf|bear|boar|deer|snake|rat|fox|horse|cow|goat|sheep|pig/.test(
        text
      )
    ) {
      return "animal";
    }
    if (/monster|creature|wyrm|boss/.test(text)) return "monster";
    if (
      /human|guard|merchant|civilian|farmer|blacksmith|bandit|npc/.test(text)
    ) {
      return "human";
    }
    return "live_entity";
  }

  function liveEntityDefaultMovementSpeedV1(
    kind: HarthmereLiveEntityKindV1,
    target: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string]
  ) {
    if (
      Number.isFinite(target.movementSpeed) &&
      Number(target.movementSpeed) > 0
    ) {
      return Number(target.movementSpeed);
    }
    if (kind === "animal") return 4.6;
    if (kind === "robot" || kind === "construct") return 2.2;
    if (kind === "mux" || kind === "hex" || kind === "monster") return 3.8;
    if (kind === "undead") return 2.7;
    return 3.2;
  }

  function liveEntityCanMoveV1(
    kind: HarthmereLiveEntityKindV1,
    target: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string]
  ) {
    if (target.aiEnabled === false) return false;
    if (!target.isAlive || target.hp <= 0) return false;
    if (kind === "object" && !target.movementSpeed) return false;
    if (kind === "robot" || kind === "construct") {
      const area = liveEntityRobotProtectionAreaForPositionV1(
        liveEntityPositionFromObjectV1(target.position)
      );
      if (
        area &&
        next.robotProtection.areas[area.areaId]?.safeFromMuck === false
      ) {
        return false;
      }
    }
    return true;
  }

  function liveEntityPositionFromObjectV1(position: {
    x: number;
    y: number;
    z: number;
  }) {
    return [position.x, position.y, position.z] as [number, number, number];
  }

  function liveEntityObjectFromPositionV1(position: readonly number[]) {
    return {
      x: Number(position[0]) || 0,
      y: Number(position[1]) || 0,
      z: Number(position[2]) || 0,
    };
  }

  function liveEntityHashFloatV1(value: string) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return (Math.abs(hash) % 10_000) / 10_000;
  }

  function liveEntityTargetPositionForAiV1(targetId: string | undefined) {
    if (!targetId) return undefined;
    if (targetId === next.actorId) {
      return actorWorldPositionFromAuthorityV1(envelope);
    }
    return next.combat.entitySnapshots[targetId]?.position;
  }

  function liveEntitySteppedDesiredPositionV1(input: {
    entityId: string;
    current: { x: number; y: number; z: number };
    target: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string];
    decision: string;
    targetId?: string;
    thinkIntervalMs: number;
    kind: HarthmereLiveEntityKindV1;
  }) {
    const current = input.current;
    const speed = liveEntityDefaultMovementSpeedV1(input.kind, input.target);
    const maxStep = Math.max(
      0.05,
      Math.min(4, speed * Math.max(0.25, input.thinkIntervalMs / 1000))
    );
    const targetPosition = liveEntityTargetPositionForAiV1(input.targetId);
    const shouldChase =
      input.decision === "retaliate_to_recent_attacker" ||
      input.decision === "engage_highest_threat" ||
      input.decision.startsWith("muck_unprovoked:");
    if (shouldChase && targetPosition) {
      const dx = targetPosition.x - current.x;
      const dz = targetPosition.z - current.z;
      const distance = Math.hypot(dx, dz);
      const preferredRange =
        input.kind === "hex" ? 3.2 : input.kind === "robot" ? 2.4 : 1.9;
      if (distance <= preferredRange) {
        return current;
      }
      const step = Math.min(maxStep, Math.max(0, distance - preferredRange));
      const scale = distance > 0 ? step / distance : 0;
      return {
        x: current.x + dx * scale,
        y: current.y,
        z: current.z + dz * scale,
      };
    }

    const directX = isServerAuthorityEnvelopeV1(envelope)
      ? payloadNumber(envelope, "desiredX")
      : undefined;
    const directY = isServerAuthorityEnvelopeV1(envelope)
      ? payloadNumber(envelope, "desiredY")
      : undefined;
    const directZ = isServerAuthorityEnvelopeV1(envelope)
      ? payloadNumber(envelope, "desiredZ")
      : undefined;
    if (
      directX !== undefined &&
      directY !== undefined &&
      directZ !== undefined
    ) {
      return { x: directX, y: directY, z: directZ };
    }

    const home = input.target.homePosition ?? current;
    const radius = Math.max(0.4, Math.min(8, input.target.patrolRadius ?? 2.5));
    const phase =
      liveEntityHashFloatV1(input.entityId) * Math.PI * 2 +
      (nowMs / 1000) * 0.18;
    return {
      x: home.x + Math.cos(phase) * radius,
      y: home.y,
      z: home.z + Math.sin(phase) * radius,
    };
  }

  function liveEntityAnimationForMovementV1(input: {
    kind: HarthmereLiveEntityKindV1;
    decision: string;
    movementMode: HarthmereNpcNavigationModeV1;
    animationMoving: boolean;
    isAlive: boolean;
  }): HarthmereLiveEntityAnimationStateV1 {
    if (!input.isAlive) return "death";
    if (!input.animationMoving) return "idle";
    if (input.decision.includes("flee")) return "flee";
    if (input.movementMode === "combat_chase") {
      return input.kind === "animal" ||
        input.kind === "monster" ||
        input.kind === "mux" ||
        input.kind === "hex"
        ? "run"
        : "walk";
    }
    return "walk";
  }

  function applyLiveEntityAiMovementV1(input: {
    entityId: string;
    target: HarthmereLiveModeBackendStateV1["combat"]["entitySnapshots"][string];
    decision: string;
    targetId?: string;
    thinkIntervalMs: number;
  }) {
    const target = input.target;
    const kind = liveEntityKindForSnapshotV1(input.entityId, target);
    const from = { ...target.position };
    if (!liveEntityCanMoveV1(kind, target)) {
      const animationState: HarthmereLiveEntityAnimationStateV1 = target.isAlive
        ? "idle"
        : "death";
      target.entityKind = kind;
      target.animationState = animationState;
      target.animationMoving = false;
      target.animationStartedAtMs = nowMs;
      return {
        entityKind: kind,
        movementMode: undefined,
        positionFrom: from,
        positionTo: { ...target.position },
        velocity: { x: 0, y: 0, z: 0 },
        facingYaw: target.facingYaw,
        navigationResolution: "hold" as const,
        navigationBlocked: true,
        animationState,
        animationMoving: false,
      };
    }

    const movementMode: HarthmereNpcNavigationModeV1 =
      input.decision === "retaliate_to_recent_attacker" ||
      input.decision === "engage_highest_threat" ||
      input.decision.startsWith("muck_unprovoked:")
        ? "combat_chase"
        : "town_wander";
    const desired = liveEntitySteppedDesiredPositionV1({
      entityId: input.entityId,
      current: from,
      target,
      decision: input.decision,
      targetId: input.targetId,
      thinkIntervalMs: input.thinkIntervalMs,
      kind,
    });
    const navState =
      next.combat.liveEntityNavigation[input.entityId] ??
      createHarthmereNpcNavigationStateV1();
    if (!Number.isFinite(navState.stuckFrames)) {
      navState.stuckFrames = 0;
    }
    const nav = resolveHarthmereNpcNavigationStepV1({
      label: input.entityId,
      mode: movementMode,
      currentPosition: liveEntityPositionFromObjectV1(from),
      desiredPosition: liveEntityPositionFromObjectV1(desired),
      state: navState,
      obstacles: target.navigationObstacles,
      bodyRadius: target.bodyRadius,
    });
    next.combat.liveEntityNavigation[input.entityId] = navState;

    const to = liveEntityObjectFromPositionV1(nav.position);
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const facingYaw =
      Math.hypot(dx, dz) > 0.001 ? Math.atan2(dx, dz) : target.facingYaw;
    const animationState = liveEntityAnimationForMovementV1({
      kind,
      decision: input.decision,
      movementMode,
      animationMoving: nav.animationMoving,
      isAlive: target.isAlive,
    });
    target.position = to;
    target.entityKind = kind;
    target.animationState = animationState;
    target.animationMoving = nav.animationMoving;
    target.animationStartedAtMs = nowMs;
    target.facingYaw = facingYaw;
    target.movementSpeed = liveEntityDefaultMovementSpeedV1(kind, target);

    return {
      entityKind: kind,
      movementMode,
      positionFrom: from,
      positionTo: to,
      velocity: {
        x: dx / Math.max(0.001, input.thinkIntervalMs / 1000),
        y: (to.y - from.y) / Math.max(0.001, input.thinkIntervalMs / 1000),
        z: dz / Math.max(0.001, input.thinkIntervalMs / 1000),
      },
      facingYaw,
      navigationResolution: nav.resolution,
      navigationBlocked: nav.blocked,
      animationState,
      animationMoving: nav.animationMoving,
    };
  }

  function liveFarmingAuthorityStateV1(
    spawns: Record<string, HarthmereWorldSpawnV1> = {}
  ) {
    const pools = ensureCombatResourcePoolsV1(next);
    const plots: Record<string, HarthmereFarmingPlotV1> = {};
    for (const [plotId, plot] of Object.entries(next.farming.plots)) {
      if (!plot.seedItemId || !plot.harvestReadyAtMs) continue;
      plots[plotId] = {
        plotId,
        seedItemId: plot.seedItemId,
        cropItemId: plot.cropItemId ?? plot.cropId,
        plantedAtMs: plot.plantedAtMs,
        wateredAtMs: plot.wateredAtMs,
        harvestReadyAtMs: plot.harvestReadyAtMs,
        harvestedAtMs: plot.harvestedAtMs,
      };
    }
    return {
      ...defaultHarthmereFoodStaminaStateV1(next.actorId, nowMs),
      stamina: pools.resources.stamina ?? 0,
      maxStamina: pools.maxResources.stamina ?? 100,
      lastStaminaTickMs: nowMs,
      deadFromStaminaAtMs: Number.isFinite(next.combat.deadFromStaminaAtMs)
        ? next.combat.deadFromStaminaAtMs
        : undefined,
      inventory: { ...next.inventory.items },
      plots,
      spawns,
      livestock: { ...(next.farming.livestock ?? {}) },
    };
  }

  function applyLiveFarmingAuthorityResultV1(
    authorityState: HarthmereFoodStaminaStateV1
  ) {
    next.inventory.items = { ...authorityState.inventory };
    next.farming.plots = Object.fromEntries(
      Object.entries(authorityState.plots).map(([plotId, plot]) => [
        plotId,
        {
          cropId: plot.cropItemId,
          seedItemId: plot.seedItemId,
          cropItemId: plot.cropItemId,
          plantedAtMs: plot.plantedAtMs,
          wateredAtMs: plot.wateredAtMs,
          harvestReadyAtMs: plot.harvestReadyAtMs,
          harvestedAtMs: plot.harvestedAtMs,
          state: plot.harvestedAtMs
            ? "harvested"
            : plot.wateredAtMs
            ? "watered"
            : "planted",
        },
      ])
    );
    next.farming.livestock = { ...authorityState.livestock };
    if (Number.isFinite(authorityState.stamina)) {
      ensureCombatResourcePoolsV1(next).resources.stamina = Math.max(
        0,
        Math.min(
          ensureCombatResourcePoolsV1(next).maxResources.stamina ?? 100,
          Number(authorityState.stamina)
        )
      );
    }
    next.combat.lastStaminaTickMs = authorityState.lastStaminaTickMs;
    next.combat.deadFromStaminaAtMs = authorityState.deadFromStaminaAtMs;
    touchedModels.add("inventory_items");
    touchedModels.add("farming");
    touchedModels.add("combat_resources");
  }

  function liveMedicalAuthorityStateV1() {
    const doctorBusinesses: Record<string, HarthmereDoctorServiceSnapshotV1> =
      {};
    for (const [businessId, business] of Object.entries(
      next.economy.businesses
    )) {
      if (business.type !== "medical_doctor") continue;
      doctorBusinesses[businessId] = {
        businessId,
        type: "medical_doctor",
        licenseLevel: business.licenseLevel,
        inventory: { ...business.inventory },
        revenueBalanceGold: business.revenueBalanceGold,
        customerSatisfaction: business.customerSatisfaction,
        reputation: business.reputation,
      };
    }
    return {
      ...defaultHarthmereMedicalHealthStateV1(next.actorId),
      health: next.combat.hp,
      maxHealth: next.combat.maxHp,
      gold: next.inventory.gold,
      inventory: { ...next.inventory.items },
      consumableCooldowns: { ...(next.inventory.consumableCooldowns ?? {}) },
      doctorBusinesses,
    };
  }

  function applyLiveMedicalAuthorityResultV1(
    authorityState: ReturnType<typeof liveMedicalAuthorityStateV1>
  ) {
    next.combat.hp = Math.max(
      0,
      Math.min(next.combat.maxHp, authorityState.health)
    );
    next.inventory.items = { ...authorityState.inventory };
    next.inventory.gold = Math.max(0, Math.trunc(authorityState.gold));
    next.inventory.consumableCooldowns = {
      ...authorityState.consumableCooldowns,
    };
    for (const [businessId, doctor] of Object.entries(
      authorityState.doctorBusinesses
    )) {
      const business = next.economy.businesses[businessId];
      if (!business || business.type !== "medical_doctor") continue;
      business.inventory = { ...doctor.inventory };
      business.revenueBalanceGold = doctor.revenueBalanceGold;
      business.customerSatisfaction =
        doctor.customerSatisfaction ?? business.customerSatisfaction;
      business.reputation = doctor.reputation ?? business.reputation;
      business.updatedAtMs = nowMs;
      sharedStateKeys.add(
        harthmereLiveModeSharedStateKeyV1("business", businessId)
      );
    }
    touchedModels.add("combat_state");
    touchedModels.add("inventory_items");
    touchedModels.add("consumable_cooldown");
    touchedModels.add("wallet");
    touchedModels.add("business_state");
  }

  function recordEconomyBuildingMaterializationPlansV1(
    plans: BuildingSystemAnyMaterializationPlanV1[] | undefined
  ) {
    for (const plan of plans ?? []) {
      if (!plan?.requestId) continue;
      next.building.materializationPlans[plan.requestId] = plan;
      if (plan.materializesSolidVoxelBuilding) {
        next.building.placedStructures[plan.requestId] = {
          structureTypeId: plan.structureTypeId,
          origin: plan.origin,
          placedAtMs: nowMs,
          plotId: plan.plotId,
          blueprintId: plan.blueprintId,
          use: plan.use,
          voxelEditCount: plan.edits.length,
          materializedInEcs: true,
        };
        touchedModels.add("placed_structures");
      }
      if ("safeZone" in plan && plan.safeZone) {
        next.building.safeZones[plan.safeZone.plotId] = {
          safeFromMuck: plan.safeZone.safeFromMuck,
          activatedAtMs: plan.safeZone.activatedAtMs,
          area: plan.safeZone.area,
        };
      }
      for (const marker of "inWorldMarkers" in plan
        ? plan.inWorldMarkers ?? []
        : []) {
        next.building.inWorldMarkers[marker.markerId] = marker;
      }
      buildingMaterializationPlans.push(plan);
      touchedModels.add("business_outpost_materialization");
      touchedModels.add("terrain_materialization");
      sharedStateKeys.add(
        harthmereLiveModeSharedStateKeyV1(
          "building_materialization",
          plan.requestId
        )
      );
      sharedStateKeys.add(
        harthmereLiveModeSharedStateKeyV1("plot", plan.plotId)
      );
    }
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
    "request_home_decoration",
    "request_guild_mutation",
    "request_economy_mutation",
    "request_medical_action",
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
      const abilityId = payloadString(envelope, "abilityId") ?? "basic_strike";
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
          ? buildCombatTargetSnapshot(
              envelope.targetId,
              authoritativeTarget,
              zone
            )
          : undefined;
      const nearbyTargets = Object.entries(next.combat.entitySnapshots)
        .filter(([targetId]) => targetId !== envelope.targetId)
        .map(([targetId, snapshot]) =>
          buildCombatTargetSnapshot(targetId, snapshot, zone)
        );

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
        nearbyTargets,
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
        warnings.push(
          ...combatResult.errors.map((e) => `combat_rejected:${e}`)
        );
        touchedModels.add("combat_rejection");
        break;
      }
      warnings.push(
        ...combatResult.warnings.map((warning) => `combat:${warning}`)
      );

      const resolvedTargetId = combatResult.targetId;
      const resolvedTarget = resolvedTargetId
        ? next.combat.entitySnapshots[resolvedTargetId]
        : undefined;

      // Apply server-computed cooldowns
      for (const [key, expiresAt] of Object.entries(
        combatResult.newCooldowns
      )) {
        next.combat.cooldowns[key] = expiresAt;
      }
      for (const [key, expiresAt] of Object.entries(
        combatResult.newSharedCooldowns
      )) {
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

      if (resolvedTarget && combatResult.damage > 0) {
        const wasAliveBeforeDamage =
          resolvedTarget.isAlive && resolvedTarget.hp > 0;
        resolvedTarget.hp = Math.max(
          0,
          resolvedTarget.hp - combatResult.damage
        );
        resolvedTarget.lastAttackerId = envelope.actorId;
        resolvedTarget.lastAttackedAtMs = nowMs;
        resolvedTarget.lastDamageTaken = combatResult.damage;
        if (resolvedTarget.hp <= 0) {
          resolvedTarget.isAlive = false;
          resolvedTarget.isAttackable = false;
          resolvedTarget.killedByActorId = envelope.actorId;
          resolvedTarget.defeatedAtMs = nowMs;
          if (wasAliveBeforeDamage && resolvedTargetId) {
            recordLiveEntityOwnedAnimalKillCrimeV1(
              resolvedTargetId,
              resolvedTarget
            );
          }
        }
      }

      if (combatResult.healing > 0) {
        if (!resolvedTargetId || resolvedTargetId === next.actorId) {
          next.combat.hp = Math.min(
            next.combat.maxHp,
            next.combat.hp + combatResult.healing
          );
        } else if (resolvedTarget) {
          resolvedTarget.hp = Math.min(
            resolvedTarget.maxHp,
            resolvedTarget.hp + combatResult.healing
          );
          resolvedTarget.isAlive = resolvedTarget.hp > 0;
        }
      }

      // Threat. Keyed by the entity that was actually hit (the resolved target,
      // which may differ from the requested target on a stray hit), so the live
      // combat reducer can track per-entity threat / aggro accumulation.
      if (resolvedTargetId && resolvedTarget && combatResult.damage > 0) {
        next.combat.threat[resolvedTargetId] =
          (next.combat.threat[resolvedTargetId] ?? 0) + combatResult.damage;
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("entity_combat", resolvedTargetId)
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

      if (combatResult.killsTarget && resolvedTargetId) {
        const xp = computeHarthmereXpRewardV1({
          actorLevel: next.classMagic.skills["character_level"]?.level ?? 1,
          targetLevel: resolvedTarget?.level ?? 1,
          baseXp: combatResult.xpDelta,
          contributionScore: 1,
          antiFarmMultiplier: antiFarmRewardMultiplierV1({
            repeatedFarmCount: payloadNumber(envelope, "repeatedFarmCount"),
            samePlayerKillCountWithinWindow: payloadNumber(
              envelope,
              "samePlayerKillCountWithinWindow"
            ),
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
        if (resolvedTarget) {
          createLiveEntityDefeatLootDropV1(resolvedTargetId, resolvedTarget);
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
      const abilityId =
        payloadString(envelope, "abilityId") ?? "unknown_ability";
      const schoolId =
        payloadString(envelope, "magicSchoolId") ?? "general_magic";
      // Validate ability is known before crediting school XP
      if (!next.classMagic.knownAbilities.includes(abilityId)) {
        warnings.push("magic_progress_rejected:ability_not_known");
        touchedModels.add("magic_rejection");
        break;
      }
      const xpDelta = Math.max(
        0,
        Math.min(1000, payloadNumber(envelope, "skillXpDelta") ?? 1)
      );
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
      next.combat.cooldowns[abilityId] =
        nowMs + Math.max(250, payloadNumber(envelope, "cooldownMs") ?? 1000);
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
        const slotIndex = Number(normalizedSlot.replace("slot_", ""));
        const proposedLoadout = Array.from(
          { length: 8 },
          (_unused, index) => next.classMagic.loadout[`slot_${index}`]
        );
        proposedLoadout[slotIndex] = abilityId;
        const loadoutReq: HarthmereCombatActionRequestV1 = {
          requestId: envelope.requestId,
          kind: "loadout_change",
          actorId: envelope.actorId,
          nowMs,
          newLoadout: proposedLoadout.filter((entry): entry is string =>
            Boolean(entry)
          ),
        };
        const loadoutResult = reduceHarthmereCombatActionV1(loadoutReq, {
          actor: buildActorSnapshot(),
          zone: buildZoneSnapshot(),
          respecCount: next.respec?.count ?? 0,
          lastRespecAtMs: next.respec?.lastRespecAtMs,
          actorGold: next.inventory.gold,
          talentPointsAvailable: 0,
        });
        if (!loadoutResult.ok) {
          warnings.push(
            ...loadoutResult.errors.map((e) => `loadout_rejected:${e}`)
          );
          touchedModels.add("loadout_rejection");
          break;
        }
        next.classMagic.loadout = {};
        proposedLoadout.forEach((abilityId, index) => {
          if (abilityId) {
            next.classMagic.loadout[`slot_${index}`] = abilityId;
          }
        });
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
        warnings.push(
          ...loadoutResult.errors.map((e) => `loadout_rejected:${e}`)
        );
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
        (envelope.actionKind === "request_xp_reward"
          ? "character_level"
          : "combat");
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
        warnings.push(
          `${envelope.actionKind}_rejected:grey_content_no_progress`
        );
        touchedModels.add("skill_xp_rejection");
        break;
      }
      const contributionScore = Math.max(
        0,
        Math.min(1, payloadNumber(envelope, "contributionScore") ?? 1)
      );
      const difficulty = Math.max(
        1,
        payloadNumber(envelope, "difficulty") ?? 1
      );
      const successState = payloadString(envelope, "successState") ?? "success";
      if (baseXp === undefined && sourceLevel === undefined) {
        warnings.push(
          `${envelope.actionKind}_rejected:missing_server_reward_source`
        );
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
                samePlayerKillCountWithinWindow: payloadNumber(
                  envelope,
                  "samePlayerKillCountWithinWindow"
                ),
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
      const skillProgress = upsertSkill(
        next.classMagic.skills,
        skillId,
        xpDelta
      );
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
      const inventoryLootDropId =
        envelope.actionKind === "request_loot_claim"
          ? payloadString(envelope, "dropId")
          : undefined;
      if (inventoryLootDropId) {
        const drop = next.inventoryLoot.lootDrops[inventoryLootDropId];
        if (!drop) {
          warnings.push("loot_rejected:unknown_drop_id");
          touchedModels.add("loot_rejection");
          break;
        }
        const backpackStacks = liveLootDropBackpackStacksForCarryV1(
          drop.itemStacks
        );
        if (
          wouldStacksExceedCarryWeightV1(next.inventory.items, backpackStacks)
        ) {
          pushCarryWeightRejectionV1(warnings, touchedModels, "loot");
          break;
        }
        ensureInventoryLootActorSyncedV1();
        const lootResult = reduceHarthmereInventoryLootMutationV1(
          next.inventoryLoot,
          {
            requestId: envelope.requestId,
            actorId: envelope.actorId,
            nowMs,
            operation: "claim_loot_drop",
            dropId: inventoryLootDropId,
            pickupToken: payloadString(envelope, "pickupToken"),
          },
          inventoryLootContextForDropV1(drop)
        );
        if (!lootResult.ok) {
          warnings.push(
            ...lootResult.errors.map((error) => `loot_rejected:${error}`)
          );
          touchedModels.add("loot_rejection");
          break;
        }
        next.inventoryLoot = lootResult.state;
        routeInventoryLootActorMaterialsToLiveStorageV1(
          next.inventoryLoot.lootDrops[inventoryLootDropId]?.itemStacks ?? {}
        );
        syncInventoryLootActorToLiveInventoryV1();
        next.combat.lootClaims[envelope.requestId] = nowMs;
        touchedModels.add("inventory_items");
        touchedModels.add("inventory_loot_drops");
        touchedModels.add("loot_claims");
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("loot_drop", inventoryLootDropId)
        );
        break;
      }
      if (
        envelope.actionKind === "request_inventory_mutation" &&
        !isServerAuthorityEnvelopeV1(envelope)
      ) {
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
        warnings.push(
          `${
            envelope.actionKind === "request_inventory_mutation"
              ? "inventory"
              : "loot"
          }_rejected:invalid_count`
        );
        touchedModels.add(
          envelope.actionKind === "request_inventory_mutation"
            ? "inventory_rejection"
            : "loot_rejection"
        );
        break;
      }
      const snapshot = buildInventorySnapshot();
      const rewardSource =
        envelope.actionKind === "request_inventory_mutation"
          ? "inventory"
          : "loot";
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
          ? wouldDirectInventoryPayloadExceedCarryWeightV1(
              snapshot.items,
              envelope,
              { includePrimaryItem: true }
            )
          : wouldExceedCarryWeightV1(
              snapshot.items,
              invReq.itemId,
              invReq.count ?? 1
            )
      ) {
        pushCarryWeightRejectionV1(
          warnings,
          touchedModels,
          envelope.actionKind === "request_inventory_mutation"
            ? "inventory"
            : "loot"
        );
        break;
      }
      const invResult = reduceHarthmereInventoryMutationV1(invReq, {
        snapshot,
        playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
        playerSkills: next.classMagic.skills,
        reputation: next.law.reputation,
      });
      if (invResult.ok) {
        const updated = applyHarthmereInventoryMutationResultV1(
          snapshot,
          invResult
        );
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
          invResult.errors.some(
            (error) =>
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
        warnings.push(
          ...invResult.errors.map(
            (e) =>
              `${
                envelope.actionKind === "request_inventory_mutation"
                  ? "inventory"
                  : "loot"
              }_rejected:${e}`
          )
        );
        touchedModels.add(
          envelope.actionKind === "request_inventory_mutation"
            ? "inventory_rejection"
            : "loot_rejection"
        );
      }
      break;
    }

    // -----------------------------------------------------------------------
    // VENDOR — fully authority-validated via inventory module
    // -----------------------------------------------------------------------
    case "request_vendor_transaction": {
      const vendorId = payloadString(envelope, "vendorId") ?? "unknown_vendor";
      const transactionKind =
        payloadString(envelope, "transactionKind") ?? "buy";
      const vendorItemId = payloadString(envelope, "itemId");

      if (!vendorItemId) {
        const vendorGoldDelta =
          payloadNumber(envelope, "goldDelta") ??
          payloadNumber(envelope, "currencyDelta") ??
          0;
        if (vendorGoldDelta < 0) {
          next.inventory.gold = Math.max(
            0,
            next.inventory.gold + vendorGoldDelta
          );
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
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("vendor", vendorId)
        );
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
      if (
        transactionKind !== "sell" &&
        wouldExceedCarryWeightV1(snapshot.items, vendorItemId, vendorCount)
      ) {
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
        const updated = applyHarthmereInventoryMutationResultV1(
          snapshot,
          invResult
        );
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
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("vendor", vendorId)
        );
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
          (next.inventory.escrow[itemId] ?? 0) +
          auctionResult.sellerEscrowDelta;
        if (next.inventory.escrow[itemId] <= 0) {
          delete next.inventory.escrow[itemId];
        }
        next.inventory.gold = Math.max(
          0,
          next.inventory.gold + auctionResult.sellerGoldDelta
        );
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
        warnings.push(
          ...auctionResult.errors.map((e) => `auction_post_rejected:${e}`)
        );
        touchedModels.add("auction_post_rejection");
      }
      break;
    }

    // -----------------------------------------------------------------------
    // AUCTION SETTLE (buy) — fully authority-validated, atomic transfer
    // -----------------------------------------------------------------------
    case "request_auction_settle": {
      const listingId =
        payloadString(envelope, "listingId") ?? envelope.requestId;
      const currentListing = next.economy.auctionListings[listingId] as
        | HarthmereAuctionListingV1
        | undefined;
      const buyerSnapshot = buildInventorySnapshot();
      if (
        currentListing &&
        wouldExceedCarryWeightV1(
          buyerSnapshot.items,
          currentListing.itemId,
          currentListing.count
        )
      ) {
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
        next.inventory.gold = Math.max(
          0,
          next.inventory.gold + auctionResult.buyerGoldDelta
        );
        // House tax accumulates
        next.economy.houseTaxAccumulated =
          (next.economy.houseTaxAccumulated ?? 0) +
          auctionResult.houseTaxGoldDelta;
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
          harthmereLiveModeSharedStateKeyV1(
            "seller_account",
            auctionResult.listing.sellerId
          )
        );
        touchedModels.add("auction_listing");
        touchedModels.add("inventory_items");
        touchedModels.add("wallet");
        touchedModels.add("economy_ledger");
        touchedModels.add("house_tax");
        void itemCount; // referenced for completeness
      } else {
        warnings.push(
          ...auctionResult.errors.map((e) => `auction_settle_rejected:${e}`)
        );
        touchedModels.add("auction_settle_rejection");
      }
      break;
    }

    // -----------------------------------------------------------------------
    // BANK — authority-validated via inventory module
    // -----------------------------------------------------------------------
    case "request_bank_transaction": {
      const operation =
        payloadString(envelope, "operation") ??
        payloadString(envelope, "direction") ??
        "deposit";
      const itemId = payloadString(envelope, "itemId");
      const count = payloadPositiveWholeCountV1(envelope);
      const vaultKind = normalizeBankVaultKindV1(
        payloadString(envelope, "vaultKind")
      );
      sharedStateKeys.add(
        harthmereLiveModeSharedStateKeyV1("bank", next.actorId)
      );
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
        if (
          !isDeposit &&
          wouldExceedCarryWeightV1(next.inventory.items, itemId, count ?? 1)
        ) {
          pushCarryWeightRejectionV1(warnings, touchedModels, "bank_withdraw");
          break;
        }
        if (
          isDeposit &&
          itemId &&
          !bankRecordHasCapacityV1(
            next.inventory.bank,
            itemId,
            next.banking.personalBankMaxSlots
          )
        ) {
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
          const updated = applyHarthmereInventoryMutationResultV1(
            snapshot,
            bankResult
          );
          next.inventory.items = updated.items;
          next.inventory.bank = updated.bank;
          appendBankingLogV1(next, {
            kind: isDeposit
              ? "personal_bank_deposit"
              : "personal_bank_withdraw",
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
        const currentSlots =
          vaultKind === "account"
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
        if (vaultKind === "account")
          next.banking.accountBankMaxSlots +=
            HARTHMERE_BANK_SLOT_UPGRADE_SIZE_V1;
        else if (vaultKind === "materials")
          next.banking.materialStorageMaxSlots +=
            HARTHMERE_BANK_SLOT_UPGRADE_SIZE_V1;
        else
          next.banking.personalBankMaxSlots +=
            HARTHMERE_BANK_SLOT_UPGRADE_SIZE_V1;
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
          warnings.push(
            def
              ? "bank_rejected:cannot_account_bank_quest_item"
              : "bank_rejected:unknown_item_id"
          );
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
          if (
            !bankRecordHasCapacityV1(
              next.banking.accountBank,
              itemId,
              next.banking.accountBankMaxSlots
            )
          ) {
            warnings.push("bank_rejected:account_bank_full");
            touchedModels.add("bank_rejection");
            break;
          }
          applyBankRecordDeltaV1(next.inventory.items, itemId, -transferCount);
          applyBankRecordDeltaV1(
            next.banking.accountBank,
            itemId,
            transferCount
          );
        } else {
          if ((next.banking.accountBank[itemId] ?? 0) < transferCount) {
            warnings.push("bank_rejected:insufficient_account_bank_item_count");
            touchedModels.add("bank_rejection");
            break;
          }
          if (
            wouldExceedCarryWeightV1(
              next.inventory.items,
              itemId,
              transferCount
            )
          ) {
            pushCarryWeightRejectionV1(
              warnings,
              touchedModels,
              "account_bank_withdraw"
            );
            break;
          }
          applyBankRecordDeltaV1(
            next.banking.accountBank,
            itemId,
            -transferCount
          );
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

      if (
        operation === "material_deposit" ||
        operation === "material_withdraw"
      ) {
        if (!itemId) {
          warnings.push("bank_rejected:missing_item_id");
          touchedModels.add("bank_rejection");
          break;
        }
        const transferCount = count ?? 1;
        const snapshot = buildInventorySnapshot();
        const def = ensureLiveModeItemDefinitionV1(itemId, snapshot);
        const isMaterial =
          !!def?.isCraftingMaterial || isLikelyBankingMaterialItemIdV1(itemId);
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
          if (
            !bankRecordHasCapacityV1(
              next.banking.materialStorage,
              itemId,
              next.banking.materialStorageMaxSlots
            )
          ) {
            warnings.push("bank_rejected:material_storage_full");
            touchedModels.add("bank_rejection");
            break;
          }
          applyBankRecordDeltaV1(next.inventory.items, itemId, -transferCount);
          applyBankRecordDeltaV1(
            next.banking.materialStorage,
            itemId,
            transferCount
          );
        } else {
          if ((next.banking.materialStorage[itemId] ?? 0) < transferCount) {
            warnings.push(
              "bank_rejected:insufficient_material_storage_item_count"
            );
            touchedModels.add("bank_rejection");
            break;
          }
          if (
            wouldExceedCarryWeightV1(
              next.inventory.items,
              itemId,
              transferCount
            )
          ) {
            pushCarryWeightRejectionV1(
              warnings,
              touchedModels,
              "material_storage_withdraw"
            );
            break;
          }
          applyBankRecordDeltaV1(
            next.banking.materialStorage,
            itemId,
            -transferCount
          );
          applyBankRecordDeltaV1(next.inventory.items, itemId, transferCount);
        }
        appendBankingLogV1(next, {
          kind: isDeposit
            ? "material_storage_deposit"
            : "material_storage_withdraw",
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
        const amount = Math.max(
          1,
          Math.min(
            HARTHMERE_LOAN_MAX_PRINCIPAL_V1,
            Math.trunc(payloadNumber(envelope, "amount") ?? 0)
          )
        );
        const days = Math.max(
          1,
          Math.min(30, Math.trunc(payloadNumber(envelope, "days") ?? 7))
        );
        const unpaidLoan = Object.values(next.banking.loans).find(
          (loan) =>
            (loan.status === "active" || loan.status === "defaulted") &&
            activeLoanBalanceV1(loan, nowMs).totalRemaining > 0
        );
        if (
          amount <= 0 ||
          unpaidLoan ||
          next.law.flags[HARTHMERE_BANK_CREDIT_HOLD_FLAG_V1]
        ) {
          warnings.push(
            unpaidLoan?.status === "defaulted" ||
              next.law.flags[HARTHMERE_BANK_CREDIT_HOLD_FLAG_V1]
              ? "bank_rejected:credit_hold_until_defaulted_loan_paid"
              : unpaidLoan
              ? "bank_rejected:active_loan_exists"
              : "bank_rejected:invalid_loan_amount"
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
        const loanId =
          payloadString(envelope, "loanId") ??
          Object.values(next.banking.loans).find(
            (loan) => loan.status === "active" || loan.status === "defaulted"
          )?.loanId;
        const loan = loanId ? next.banking.loans[loanId] : undefined;
        if (
          !loan ||
          (loan.status !== "active" && loan.status !== "defaulted")
        ) {
          warnings.push("bank_rejected:no_active_loan");
          touchedModels.add("bank_rejection");
          break;
        }
        const requested = Math.max(
          1,
          Math.trunc(payloadNumber(envelope, "amount") ?? next.inventory.gold)
        );
        const balance = activeLoanBalanceV1(loan, nowMs);
        const payment = Math.min(
          next.inventory.gold,
          requested,
          balance.totalRemaining
        );
        if (payment <= 0) {
          warnings.push("bank_rejected:not_enough_gold_for_loan_payment");
          touchedModels.add("bank_rejection");
          break;
        }
        let remainingPayment = payment;
        const interestPaidNow = Math.min(
          balance.interestRemaining,
          remainingPayment
        );
        loan.interestPaid = (loan.interestPaid ?? 0) + interestPaidNow;
        remainingPayment -= interestPaidNow;
        const penaltyPaidNow = Math.min(
          balance.defaultPenaltyRemaining,
          remainingPayment
        );
        loan.penaltyPaid = (loan.penaltyPaid ?? 0) + penaltyPaidNow;
        remainingPayment -= penaltyPaidNow;
        const principalPaidNow = Math.min(
          loan.principalRemaining,
          remainingPayment
        );
        loan.principalRemaining -= principalPaidNow;
        next.inventory.gold -= payment;
        loan.lastPaymentAtMs = nowMs;
        if (
          loan.principalRemaining <= 0 &&
          activeLoanBalanceV1(loan, nowMs).totalRemaining <= 0
        ) {
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
          sharedStateKeys.add(
            harthmereLiveModeSharedStateKeyV1("mail", mailId)
          );
          touchedModels.add("mail_rejection");
          break;
        }
        const claimEntries = itemId
          ? [
              [
                itemId,
                Math.min(count ?? 1, mail.attachments[itemId] ?? 0),
              ] as const,
            ]
          : (Object.entries(mail.attachments) as Array<
              readonly [string, number]
            >);
        if (!claimEntries.some(([, entryCount]) => entryCount > 0)) {
          warnings.push("mail_claim_rejected:attachment_not_found");
          sharedStateKeys.add(
            harthmereLiveModeSharedStateKeyV1("mail", mailId)
          );
          touchedModels.add("mail_rejection");
          break;
        }
        const projectedItems = { ...next.inventory.items };
        for (const [attachmentItemId, attachmentCount] of claimEntries) {
          ensureLiveModeItemDefinitionV1(
            attachmentItemId,
            buildInventorySnapshot()
          );
          applyBankRecordDeltaV1(
            projectedItems,
            attachmentItemId,
            attachmentCount
          );
        }
        if (
          harthmereInventoryCarryWeightV1(projectedItems) >
          HARTHMERE_CARRY_WEIGHT_LIMIT_V1
        ) {
          pushCarryWeightRejectionV1(warnings, touchedModels, "mail_claim");
          sharedStateKeys.add(
            harthmereLiveModeSharedStateKeyV1("mail", mailId)
          );
          break;
        }
        for (const [attachmentItemId, attachmentCount] of claimEntries) {
          applyBankRecordDeltaV1(
            next.inventory.items,
            attachmentItemId,
            attachmentCount
          );
          applyBankRecordDeltaV1(
            mail.attachments,
            attachmentItemId,
            -attachmentCount
          );
        }
        if (
          !Object.values(mail.attachments).some(
            (attachmentCount) => attachmentCount > 0
          )
        ) {
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
      const operation =
        payloadString(envelope, "operation") ??
        payloadString(envelope, "subAction") ??
        "noop";
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
          dailyBankWithdrawLimitGoldValue: payloadNumber(
            envelope,
            "dailyBankWithdrawLimitGoldValue"
          ),
          itemId,
          count: payloadNumber(envelope, "count"),
          itemGoldValue: liveModeGuildItemUnitGoldValueV1(
            itemId,
            buildInventorySnapshot()
          ),
          amountGold:
            payloadNumber(envelope, "amountGold") ??
            payloadNumber(envelope, "gold") ??
            payloadNumber(envelope, "taxableGold"),
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
            const def = ensureLiveModeItemDefinitionV1(
              candidateItemId,
              buildInventorySnapshot()
            );
            return !(
              def?.isQuestItem ||
              def?.binding === "quest" ||
              def?.isCurrency
            );
          },
          canWithdrawToInventory: (candidateItemId, count) =>
            !wouldExceedCarryWeightV1(
              next.inventory.items,
              candidateItemId,
              count
            ),
          guildBankHasCapacity: (items, candidateItemId, maxSlots) =>
            bankRecordHasCapacityV1(items, candidateItemId, maxSlots),
          canLinkGuildHallProperty: ({ guildId, actorId, propertyId }) => {
            const property = next.property.owned[propertyId];
            if (!property || property.guildId !== guildId) return false;
            const blueprint = buildingSystemBlueprintByIdV1(
              property.blueprintId
            );
            if (property.use !== "guild" && blueprint?.use !== "guild")
              return false;
            return buildingSystemCanActorAccessPropertyV1({
              property,
              actorId,
              permission: "build_edit",
              guildId,
            });
          },
        }
      );
      next.guild = result.guild;
      next.inventory.gold = Math.max(
        0,
        next.inventory.gold + result.inventoryGoldDelta
      );
      for (const [deltaItemId, delta] of Object.entries(
        result.inventoryItemDeltas
      )) {
        applyBankRecordDeltaV1(next.inventory.items, deltaItemId, delta);
      }
      for (const warning of result.warnings) warnings.push(warning);
      for (const model of result.touchedModels) touchedModels.add(model);
      for (const guildId of result.sharedGuildIds) {
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("guild", guildId)
        );
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
      const operation =
        payloadString(envelope, "operation") ??
        payloadString(envelope, "subAction") ??
        "noop";
      const boardId =
        payloadString(envelope, "boardId") ??
        HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1;
      const actorPosition = actorWorldPositionFromAuthorityV1(envelope);
      const board = next.jobsBoard.boards[boardId];
      const nearbyBoardId =
        actorPosition && board
          ? distanceSq3V1(actorPosition, {
              x: board.location.x,
              y: board.location.y,
              z: board.location.z,
            }) <=
            board.location.radius * board.location.radius
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
            (business.ownerKind === "player" &&
              business.ownerId === envelope.actorId) ||
            (business.ownerKind === "guild" &&
              business.ownerId === next.guild.memberGuildId &&
              hasHarthmereGuildPermissionV1(
                next.guild.guilds[business.ownerId],
                envelope.actorId,
                "manage_treasury",
                nowMs
              )) ||
            (business.ownerKind === "town" &&
              (next.law.reputation[`town:${business.ownerId}:clerk`] >= 1 ||
                next.law.flags[`town_admin:${business.ownerId}`] === true)),
          canManageGuildJobs: (guildId: string) =>
            guildId === next.guild.memberGuildId &&
            hasHarthmereGuildPermissionV1(
              next.guild.guilds[guildId],
              envelope.actorId,
              "manage_treasury",
              nowMs
            ),
          canManageTownJobs: (townId: string) =>
            next.law.reputation[`town:${townId}:clerk`] >= 1 ||
            next.law.flags[`town_admin:${townId}`] === true,
          allowNpcJobPosting: next.law.flags.jobs_board_npc_admin === true,
        }
      );
      next.jobsBoard = result.jobsBoard;
      if (result.economy) next.economy.production = result.economy;
      next.inventory.gold = Math.max(
        0,
        next.inventory.gold + result.inventoryGoldDelta
      );
      for (const [itemId, delta] of Object.entries(
        result.inventoryItemDeltas
      )) {
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
            const board = next.jobsBoard.boards[todo.boardId];
            const marker = harthmereJobsBoardQuestMarkerPositionForTodoV1({
              mapMarkerId: todo.mapMarkerId,
              targetId: todo.targetId,
              fallbackPosition: board
                ? [board.location.x, board.location.y + 1, board.location.z]
                : [501.99486179104775, 71, -132.00350672753194],
            });
            next.building.inWorldMarkers[`jobs_board_marker:${todo.todoId}`] = {
              markerId: `jobs_board_marker:${todo.todoId}`,
              plotId: marker.markerId,
              kind: "map_marker",
              position: marker.position,
              label: `${todo.title}: ${marker.label}`,
              createdAtMs: todo.createdAtMs,
            };
          }
          const job = next.jobsBoard.postings[todo.jobId];
          const exoticRequirement = job?.requirements.find((requirement) =>
            isHarthmereExoticMatterMaterialItemIdV1(requirement.itemId)
          );
          if (exoticRequirement) {
            const targetDeposit = harthmereExoticMatterDepositByIdV1(
              exoticRequirement.mapMarkerId ?? job.mapMarkerId
            );
            const requirementCount = Math.trunc(
              Number(exoticRequirement.count ?? 1)
            );
            const markers = harthmereExoticMatterAcceptedJobDepositMarkersV1({
              jobId: todo.jobId,
              todoId: todo.todoId,
              itemId: exoticRequirement.itemId,
              targetCaveId: targetDeposit?.caveId,
              count: Math.max(
                3,
                Math.min(
                  8,
                  (Number.isFinite(requirementCount) ? requirementCount : 1) + 2
                )
              ),
            });
            for (const marker of markers) {
              next.building.inWorldMarkers[
                `jobs_board_exotic_deposit:${todo.todoId}:${marker.depositId}`
              ] = {
                markerId: `jobs_board_exotic_deposit:${todo.todoId}:${marker.depositId}`,
                plotId: marker.markerId,
                kind: "map_marker",
                position: marker.position,
                label: `${todo.title}: ${marker.label}`,
                createdAtMs: todo.createdAtMs,
              };
            }
          }
        } else if (todo.status === "completed") {
          delete next.quests.active[questId];
          next.quests.completed[questId] = nowMs;
          delete next.building.inWorldMarkers[
            `jobs_board_marker:${todo.todoId}`
          ];
          for (const markerId of Object.keys(next.building.inWorldMarkers)) {
            if (
              markerId.startsWith(`jobs_board_exotic_deposit:${todo.todoId}:`)
            ) {
              delete next.building.inWorldMarkers[markerId];
            }
          }
          touchedModels.add("building_state");
        } else if (
          todo.status === "cancelled" ||
          todo.status === "failed" ||
          todo.status === "expired"
        ) {
          delete next.quests.active[questId];
          delete next.building.inWorldMarkers[
            `jobs_board_marker:${todo.todoId}`
          ];
          for (const markerId of Object.keys(next.building.inWorldMarkers)) {
            if (
              markerId.startsWith(`jobs_board_exotic_deposit:${todo.todoId}:`)
            ) {
              delete next.building.inWorldMarkers[markerId];
            }
          }
          touchedModels.add("building_state");
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
      if (
        rejectEconomyMutationOutsideBusinessV1({
          state: next,
          envelope,
          warnings,
          touchedModels,
        })
      ) {
        break;
      }
      const operation =
        payloadString(envelope, "operation") ??
        payloadString(envelope, "subAction") ??
        "noop";
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
            hasHarthmereGuildPermissionV1(
              next.guild.guilds[guildId],
              envelope.actorId,
              "manage_treasury",
              nowMs
            ),
          canManageTownBusiness: (townId: string) =>
            next.law.reputation[`town:${townId}:clerk`] >= 1 ||
            next.law.flags[`town_admin:${townId}`] === true,
          allowNpcAdministration: next.law.flags.economy_npc_admin === true,
        }
      );
      next.economy.production = result.economy;
      next.inventory.gold = Math.max(
        0,
        next.inventory.gold + result.inventoryGoldDelta
      );
      for (const [itemId, delta] of Object.entries(
        result.inventoryItemDeltas
      )) {
        applyBankRecordDeltaV1(next.inventory.items, itemId, Number(delta));
      }
      for (const warning of result.warnings) warnings.push(warning);
      for (const model of result.touchedModels) touchedModels.add(model);
      for (const key of result.sharedStateKeys) sharedStateKeys.add(key);
      recordEconomyBuildingMaterializationPlansV1(
        result.buildingMaterializationPlans
      );
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
      const witnessLevel =
        payloadString(envelope, "witnessLevel") ??
        (payloadBoolean(envelope, "publicEvent") === true
          ? "public_event"
          : "public");
      const witnessMultiplier = reputationWitnessMultiplierV1(witnessLevel);
      let likeabilityDelta = payloadNumber(envelope, "likeabilityDelta") ?? 0;
      let legalDelta = payloadNumber(envelope, "legalDelta") ?? 0;
      let notorietyDelta = payloadNumber(envelope, "notorietyDelta") ?? 0;
      const notorietyFloorDelta =
        payloadNumber(envelope, "notorietyFloorDelta") ?? 0;
      const requestedFineDelta = payloadNumber(envelope, "fineDelta") ?? 0;
      const fineDeltaBox = {
        value:
          !isServerAuthorityEnvelopeV1(envelope) && requestedFineDelta < 0
            ? 0
            : requestedFineDelta,
      };
      if (!isServerAuthorityEnvelopeV1(envelope) && requestedFineDelta < 0) {
        warnings.push("law_rejected:client_negative_fine_delta");
      }

      if (envelope.actionKind === "request_pvp_reward") {
        const actorLevel =
          payloadNumber(envelope, "actorLevel") ??
          next.classMagic.skills.character_level?.level ??
          1;
        const targetLevel =
          payloadNumber(envelope, "targetLevel") ?? actorLevel;
        const targetIsPlayer =
          payloadBoolean(envelope, "targetIsPlayer") !== false;
        if (targetIsPlayer && actorLevel - targetLevel >= 10) {
          if (notorietyDelta > 0) notorietyDelta = 0;
          likeabilityDelta = Math.min(likeabilityDelta, -500);
          legalDelta = Math.min(legalDelta, -500);
          warnings.push("pvp_reward_adjusted:low_level_target_no_notoriety");
        }
      }

      const likeabilityDeltaBox = { value: likeabilityDelta };
      const legalDeltaBox = { value: legalDelta };
      const notorietyDeltaBox = { value: notorietyDelta };
      applyHarthmereLiveModeCrimeEventV1({
        state: next,
        envelope,
        factionId,
        witnessLevel,
        witnessMultiplier,
        nowMs,
        likeabilityDelta: likeabilityDeltaBox,
        legalDelta: legalDeltaBox,
        notorietyDelta: notorietyDeltaBox,
        fineDelta: fineDeltaBox,
        warnings,
        touchedModels,
        sharedStateKeys,
      });
      likeabilityDelta = likeabilityDeltaBox.value;
      legalDelta = legalDeltaBox.value;
      notorietyDelta = notorietyDeltaBox.value;

      next.law.reputation[factionId] = clampSignedReputationV1(
        (next.law.reputation[factionId] ?? 0) +
          (payloadNumber(envelope, "reputationDelta") ?? 0) * witnessMultiplier
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
            reason:
              payloadString(envelope, "reason") ??
              payloadString(envelope, "crimeKind"),
          },
          ...(next.law.recentReputationEvents ?? []),
        ].slice(0, 50);
        touchedModels.add("law_standing");
        touchedModels.add("law_reputation_events");
      }
      const fineDelta = fineDeltaBox.value;
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
        const result = applyHarthmereClassChoiceV1(
          next.classMagic,
          classChoice
        );
        if (!result.ok) {
          warnings.push(result.warning ?? "class_rejected:unknown_class");
          touchedModels.add("class_choice_rejection");
          break;
        }
        touchedModels.add("class_choice");
        touchedModels.add("known_abilities");
        touchedModels.add("skill_xp");
      }
      const specializationChoice = payloadString(envelope, "specializationId");
      if (specializationChoice) {
        const result = applyHarthmereSpecializationChoiceV1(
          next.classMagic,
          specializationChoice
        );
        if (!result.ok) {
          warnings.push(result.warning ?? "specialization_rejected");
          touchedModels.add("specialization_rejection");
          break;
        }
        touchedModels.add("specialization");
        touchedModels.add("class_magic_progression");
      }
      const abilityId = payloadString(envelope, "abilityId");
      const recipeId = payloadString(envelope, "recipeId");
      if (recipeId && !getHarthmereCraftingRecipeV1(recipeId)) {
        warnings.push("recipe_rejected:unknown_recipe");
        touchedModels.add("known_recipes_rejection");
        break;
      }
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
        respecType:
          (payloadString(envelope, "respecType") as
            | "full"
            | "partial"
            | undefined) ?? "full",
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
        next.inventory.gold = Math.max(
          0,
          next.inventory.gold + respecResult.goldCost
        );
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
        warnings.push(
          ...respecResult.errors.map((e) => `respec_rejected:${e}`)
        );
        touchedModels.add("respec_rejection");
      }
      break;
    }
    case "request_quest_state_update": {
      const liveEntityHelperOperation = payloadString(envelope, "operation");
      if (
        reduceQuestInviteMutationV1({
          state: next,
          envelope,
          nowMs,
          warnings,
          touchedModels,
          sharedStateKeys,
        })
      ) {
        break;
      }
      if (liveEntityHelperOperation?.startsWith("live_entity_robot_")) {
        if (liveEntityHelperOperation === "live_entity_robot_energy_tick") {
          const robotId =
            payloadString(envelope, "robotId") ??
            payloadString(envelope, "entityId") ??
            envelope.targetId;
          const result = tickLiveEntityRobotEnergyV1(next.robotProtection, {
            nowMs,
            drainPerHour: payloadNumber(envelope, "drainPerHour"),
            robotIds: robotId ? [robotId] : undefined,
          });
          next.robotProtection = result.state;
          warnings.push(...result.warnings);
          syncLiveEntityRobotProtectionToBuildingV1(next, nowMs);
          touchedModels.add("robot_protection");
          touchedModels.add("building_state");
          break;
        }

        if (liveEntityHelperOperation === "live_entity_robot_energy_recharge") {
          const robotId =
            payloadString(envelope, "robotId") ??
            payloadString(envelope, "entityId") ??
            envelope.targetId;
          if (!robotId) {
            warnings.push("live_entity_robot_rejected:robot_required");
            touchedModels.add("robot_protection_rejection");
            break;
          }
          const position =
            payloadNumber(envelope, "entityX") !== undefined &&
            payloadNumber(envelope, "entityY") !== undefined &&
            payloadNumber(envelope, "entityZ") !== undefined
              ? ([
                  payloadNumber(envelope, "entityX")!,
                  payloadNumber(envelope, "entityY")!,
                  payloadNumber(envelope, "entityZ")!,
                ] as const)
              : undefined;
          const areaId =
            payloadString(envelope, "areaId") ??
            next.robotProtection.robots[robotId]?.areaId ??
            liveEntityRobotProtectionAreaForPositionV1(position)?.areaId;
          const result = rechargeLiveEntityRobotEnergyV1(next.robotProtection, {
            robotId,
            areaId,
            nowMs,
            amount:
              payloadNumber(envelope, "energyAmount") ??
              LIVE_ENTITY_ROBOT_RECHARGE_AMOUNT_V1,
            displayName:
              payloadString(envelope, "entityLabel") ??
              payloadString(envelope, "robotName"),
          });
          if (result.warnings.length > 0) {
            warnings.push(...result.warnings);
            touchedModels.add("robot_protection_rejection");
            break;
          }
          ensureLiveEntityHelperServerItemDefinitionV1(
            LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1
          );
          if (
            (next.inventory.items[LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1] ?? 0) <
            LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY_V1
          ) {
            warnings.push(
              `live_entity_robot_rejected:item_required:${LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1}`
            );
            touchedModels.add("robot_protection_rejection");
            break;
          }
          next.robotProtection = result.state;
          recordDelta(
            next.inventory.items,
            LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID_V1,
            -LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY_V1
          );
          applyLiveEntityRobotRechargeRewardV1(next, warnings, touchedModels);
          syncLiveEntityRobotProtectionToBuildingV1(next, nowMs);
          touchedModels.add("robot_protection");
          touchedModels.add("inventory_items");
          touchedModels.add("building_state");
          break;
        }

        warnings.push("live_entity_robot_rejected:unknown_operation");
        touchedModels.add("robot_protection_rejection");
        break;
      }

      if (liveEntityHelperOperation === "live_entity_helper_read_state") {
        touchedModels.add("quest_state");
        touchedModels.add("inventory_items");
        touchedModels.add("building_state");
        break;
      }

      if (liveEntityHelperOperation?.startsWith("live_entity_helper_")) {
        const quest = liveEntityHelperQuestFromEnvelopeV1(envelope, warnings);
        if (!quest) {
          touchedModels.add("quest_state_rejection");
          break;
        }

        if (liveEntityHelperOperation === "live_entity_helper_accept") {
          if (next.quests.completed[quest.questId] !== undefined) {
            warnings.push("live_entity_helper_rejected:already_completed");
            touchedModels.add("quest_state_rejection");
            break;
          }
          next.quests.active[quest.questId] = {
            stepId:
              liveEntityHelperQuestTargetMarkerForKindV1(quest.kind)?.id ??
              LIVE_ENTITY_HELPER_ACCEPTED_STEP_ID_V1,
            progress: 0,
          };
          upsertLiveEntityHelperQuestMarkerV1(next, quest, nowMs);
          touchedModels.add("quest_state");
          touchedModels.add("building_state");
          break;
        }

        if (
          liveEntityHelperOperation === "live_entity_helper_record_boss_defeat"
        ) {
          if (quest.kind !== "hard_boss") {
            warnings.push("live_entity_helper_rejected:not_a_boss_quest");
            touchedModels.add("quest_state_rejection");
            break;
          }
          const active = next.quests.active[quest.questId];
          const marker = liveEntityHelperQuestTargetMarkerForKindV1(quest.kind);
          if (
            !active ||
            !next.building.inWorldMarkers[
              LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID_V1
            ]
          ) {
            warnings.push("live_entity_helper_rejected:boss_not_spawned");
            touchedModels.add("quest_state_rejection");
            break;
          }
          if (!isLiveEntityHelperMuckBossSpawnMarkerV1(marker)) {
            warnings.push("live_entity_helper_rejected:boss_not_in_muck_area");
            touchedModels.add("quest_state_rejection");
            break;
          }
          if (!hasLiveEntityHelperBossDefeatEvidenceV1(next, envelope)) {
            warnings.push("live_entity_helper_rejected:boss_defeat_required");
            touchedModels.add("quest_state_rejection");
            break;
          }
          next.quests.active[quest.questId] = {
            ...active,
            stepId: LIVE_ENTITY_HELPER_BOSS_DEFEATED_STEP_ID_V1,
            progress: 1,
          };
          touchedModels.add("quest_state");
          break;
        }

        if (liveEntityHelperOperation === "live_entity_helper_complete") {
          const active = next.quests.active[quest.questId];
          if (!active) {
            warnings.push("live_entity_helper_rejected:active_quest_required");
            touchedModels.add("quest_state_rejection");
            break;
          }
          const completion = canCompleteLiveEntityHelperQuestV1(quest, {
            inventory: next.inventory.items,
            hardBossDefeats:
              quest.kind === "hard_boss" && active.progress >= 1 ? 1 : 0,
          });
          if (!completion.ok) {
            warnings.push(
              `live_entity_helper_rejected:missing:${completion.missing.join(
                ","
              )}`
            );
            touchedModels.add("quest_state_rejection");
            break;
          }
          const deltas = liveEntityHelperQuestDeltasV1(quest);
          for (const [itemId, quantity] of Object.entries(
            deltas.consumedItems
          )) {
            if ((next.inventory.items[itemId] ?? 0) < quantity) {
              warnings.push(
                `live_entity_helper_rejected:item_required:${itemId}`
              );
              touchedModels.add("quest_state_rejection");
              break;
            }
          }
          if (
            warnings.some((warning) =>
              warning.startsWith("live_entity_helper_rejected:")
            )
          ) {
            break;
          }
          for (const itemId of new Set([
            ...Object.keys(deltas.consumedItems),
            ...Object.keys(deltas.rewardItems),
          ])) {
            ensureLiveEntityHelperServerItemDefinitionV1(itemId);
          }
          for (const [itemId, quantity] of Object.entries(
            deltas.consumedItems
          )) {
            recordDelta(next.inventory.items, itemId, -quantity);
          }
          for (const [itemId, quantity] of Object.entries(deltas.rewardItems)) {
            recordDelta(next.inventory.items, itemId, quantity);
          }
          applyLiveEntityHelperQuestXpV1(next, quest, warnings, touchedModels);
          next.quests.completed[quest.questId] = nowMs;
          delete next.quests.active[quest.questId];
          removeLiveEntityHelperQuestMarkerV1(next, quest);
          touchedModels.add("quest_state");
          touchedModels.add("inventory_items");
          touchedModels.add("building_state");
          break;
        }

        warnings.push("live_entity_helper_rejected:unknown_operation");
        touchedModels.add("quest_state_rejection");
        break;
      }

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
                completionItemDeltas: (envelope.payload as any)
                  .completionItemDeltas,
              },
              {
                actorGold: next.inventory.gold,
                actorInventoryItems: next.inventory.items,
                actorCollectibles: next.collections.discovered,
                actorGuildId: next.guild.memberGuildId,
                economy: next.economy.production,
              }
            );
            next.jobsBoard = result.jobsBoard;
            if (result.economy) next.economy.production = result.economy;
            for (const [itemId, delta] of Object.entries(
              result.inventoryItemDeltas
            )) {
              applyBankRecordDeltaV1(
                next.inventory.items,
                itemId,
                Number(delta)
              );
            }
            for (const warning of result.warnings) warnings.push(warning);
            for (const model of result.touchedModels) touchedModels.add(model);
            for (const key of result.sharedStateKeys) sharedStateKeys.add(key);
            if (result.warnings.length === 0) {
              next.quests.completed[questId] = nowMs;
              delete next.quests.active[questId];
              delete next.building.inWorldMarkers[
                `jobs_board_marker:${todo.todoId}`
              ];
              for (const markerId of Object.keys(
                next.building.inWorldMarkers
              )) {
                if (
                  markerId.startsWith(
                    `jobs_board_exotic_deposit:${todo.todoId}:`
                  )
                ) {
                  delete next.building.inWorldMarkers[markerId];
                }
              }
              touchedModels.add("quest_state");
              touchedModels.add("building_state");
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
      const subAction =
        payloadString(envelope, "buildingAction") ??
        payloadString(envelope, "subAction") ??
        payloadString(envelope, "operation") ??
        "read_state";
      const requestedPlotId =
        payloadString(envelope, "plotId") ??
        payloadString(envelope, "propertyId");
      const plot = buildingSystemPlotByIdV1(requestedPlotId);

      if (subAction === "read_state") {
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("building_state", envelope.actorId)
        );
        touchedModels.add("building_state");
        // Auto-materialize business outpost voxel buildings when the stored
        // revision doesn't match the current code revision. This ensures the
        // 19 procedural block buildings (cobblestone walls, stone floor/roof,
        // woodenStepper stairs, oakLog door frame) are written into the world
        // automatically on first load and whenever the plans change, with no
        // admin tool call required.
        if (
          next.building.outpostBuildRevision !==
          HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION_V1
        ) {
          const outpostState =
            defaultHarthmereBusinessOutpostBuildingStateV1(nowMs);
          next.building.placedStructures = {
            ...next.building.placedStructures,
            ...outpostState.placedStructures,
          };
          next.building.safeZones = {
            ...next.building.safeZones,
            ...outpostState.safeZones,
          };
          next.building.inWorldMarkers = {
            ...next.building.inWorldMarkers,
            ...outpostState.inWorldMarkers,
          };
          next.building.materializationPlans = {
            ...next.building.materializationPlans,
            ...outpostState.materializationPlans,
          };
          next.building.outpostBuildRevision =
            HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION_V1;
          const rebuildPlans =
            createHarthmereBusinessOutpostRebuildMaterializationPlansV1();
          buildingMaterializationPlans.push(...rebuildPlans);
          warnings.push(
            `business_outpost_auto_rebuild:${HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION_V1}:plans:${rebuildPlans.length}`
          );
          touchedModels.add("business_outpost_voxel_rebuild");
          touchedModels.add("terrain_materialization");
          sharedStateKeys.add(harthmereLiveModeSharedWorldStateKeyV1());
        }
        break;
      }

      if (subAction === "rebuild_business_outposts") {
        // Admin-triggered explicit rebuild (e.g. to force a re-materialize
        // without waiting for a revision bump). Still requires admin_tool source.
        if (envelope.source !== "admin_tool") {
          warnings.push(
            "business_outpost_rebuild_rejected:admin_tool_required"
          );
          touchedModels.add("business_outpost_rebuild_rejection");
          break;
        }
        const businessOutpostBuildingState =
          defaultHarthmereBusinessOutpostBuildingStateV1(nowMs);
        next.building.placedStructures = {
          ...next.building.placedStructures,
          ...businessOutpostBuildingState.placedStructures,
        };
        next.building.safeZones = {
          ...next.building.safeZones,
          ...businessOutpostBuildingState.safeZones,
        };
        next.building.inWorldMarkers = {
          ...next.building.inWorldMarkers,
          ...businessOutpostBuildingState.inWorldMarkers,
        };
        next.building.materializationPlans = {
          ...next.building.materializationPlans,
          ...businessOutpostBuildingState.materializationPlans,
        };
        const rebuildPlans =
          createHarthmereBusinessOutpostRebuildMaterializationPlansV1();
        buildingMaterializationPlans.push(...rebuildPlans);
        // Stamp the revision so read_state won't auto-rebuild again.
        next.building.outpostBuildRevision =
          HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION_V1;
        warnings.push(
          `business_outpost_rebuild_queued:${HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION_V1}:plans:${rebuildPlans.length}`
        );
        touchedModels.add("business_outpost_voxel_rebuild");
        touchedModels.add("terrain_materialization");
        sharedStateKeys.add(harthmereLiveModeSharedWorldStateKeyV1());
        break;
      }

      if (
        subAction === "talk_to_steward" ||
        subAction === "complete_mira_intro"
      ) {
        next.quests.completed[BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1.questId] =
          nowMs;
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
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1(
            "quest",
            BUILDING_SYSTEM_MIRA_INTRO_QUEST_V1.questId
          )
        );
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
        if (
          rejectForCivilLegalBlockersV1({
            blockers: civilLegalAccessBlockersV1({ state: next }),
            warningPrefix: "plot_claim_rejected",
            rejectionModel: "building_rejection",
            warnings,
            touchedModels,
          })
        ) {
          break;
        }
        const claimPlot = toHarthmerePlotDefinitionV1(plot, "", true);
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
        next.building.inWorldMarkers[claimMiraMapMarker.markerId] =
          claimMiraMapMarker;
        touchedModels.add("mira_map_marker");
        if (plot.startsMucked) {
          next.building.safeZones[plot.plotId] = {
            safeFromMuck: false,
            activatedAtMs: nowMs,
            area: plot.area,
          };
          const muckClaimPlan =
            createBuildingSystemMuckClaimMaterializationPlanV1({
              requestId: envelope.requestId,
              actorId: envelope.actorId,
              plot,
              activatedAtMs: nowMs,
            });
          for (const marker of muckClaimPlan.inWorldMarkers ?? []) {
            next.building.inWorldMarkers[marker.markerId] = marker;
          }
          next.building.materializationPlans[
            `${envelope.requestId}:muck_deed`
          ] = muckClaimPlan;
          buildingMaterializationPlans.push(muckClaimPlan);
          touchedModels.add("muck_deed");
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
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("plot", plot.plotId)
        );
        touchedModels.add("wallet");
        touchedModels.add("owned_plots");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "terraform_plot") {
        if (!plot) {
          warnings.push("plot_terraform_rejected:plot_not_found");
          touchedModels.add("building_rejection");
          break;
        }
        if (!next.building.ownedPlots.includes(plot.plotId)) {
          warnings.push("plot_terraform_rejected:plot_not_owned_by_actor");
          touchedModels.add("building_rejection");
          break;
        }
        if (!plot.startsMucked) {
          warnings.push("plot_terraform_rejected:not_muck_designation_land");
          touchedModels.add("building_rejection");
          break;
        }
        if (next.building.safeZones[plot.plotId]?.safeFromMuck === true) {
          warnings.push("plot_terraform_rejected:already_terraformed");
          touchedModels.add("building_rejection");
          break;
        }
        const propertyIdForTerraform =
          payloadString(envelope, "propertyId") ??
          buildingPropertyIdForPlotV1(plot.plotId);
        const propertyForTerraform =
          next.property.owned[propertyIdForTerraform];
        if (
          !propertyForTerraform ||
          propertyForTerraform.plotId !== plot.plotId ||
          propertyForTerraform.ownerId !== envelope.actorId ||
          propertyForTerraform.abandoned
        ) {
          warnings.push(
            "plot_terraform_rejected:owned_home_or_business_required"
          );
          touchedModels.add("building_rejection");
          break;
        }
        if (
          propertyForTerraform.use !== "home" &&
          propertyForTerraform.use !== "business"
        ) {
          warnings.push("plot_terraform_rejected:home_or_business_required");
          touchedModels.add("building_rejection");
          break;
        }
        const actorPosition = actorWorldPositionFromAuthorityV1(envelope);
        if (actorPosition) {
          const accessMarkerKind =
            propertyForTerraform.use === "home"
              ? "home_console"
              : "business_marker";
          const accessMarkers = Object.values(next.building.inWorldMarkers)
            .filter(
              (marker) =>
                marker.plotId === propertyForTerraform.plotId &&
                marker.kind === accessMarkerKind
            )
            .map(buildingMarkerPositionV1)
            .filter(
              (position): position is { x: number; y: number; z: number } =>
                position !== undefined &&
                Number.isFinite(position.x) &&
                Number.isFinite(position.y) &&
                Number.isFinite(position.z)
            );
          const radius =
            propertyForTerraform.use === "home"
              ? HARTHMERE_HOME_CONSOLE_INTERACTION_RADIUS_V1
              : HARTHMERE_BUSINESS_IN_WORLD_INTERACTION_RADIUS_V1;
          if (
            accessMarkers.length > 0 &&
            accessMarkers.every(
              (position) =>
                distanceSq3V1(actorPosition, position) > radius * radius
            )
          ) {
            warnings.push("plot_terraform_rejected:property_ui_required");
            touchedModels.add("building_rejection");
            break;
          }
        }
        next.building.safeZones[plot.plotId] = {
          safeFromMuck: true,
          activatedAtMs: nowMs,
          area: plot.area,
        };
        const terraformPlan =
          createBuildingSystemSafeGroundMaterializationPlanV1({
            requestId: `${envelope.requestId}:terraform`,
            actorId: envelope.actorId,
            plot,
            activatedAtMs: nowMs,
            reason: "plot_terraform_safe_ground",
          });
        for (const marker of terraformPlan.inWorldMarkers ?? []) {
          next.building.inWorldMarkers[marker.markerId] = marker;
        }
        next.building.materializationPlans[terraformPlan.requestId] =
          terraformPlan;
        buildingMaterializationPlans.push(terraformPlan);
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("plot", plot.plotId)
        );
        touchedModels.add("muck_safe_zone");
        touchedModels.add("plot_terraform");
        touchedModels.add("map_marker");
        touchedModels.add("terrain_materialization");
        break;
      }

      const blueprintId = payloadString(envelope, "blueprintId");
      const blueprintItemId =
        payloadStringOrNumberV1(envelope, "blueprintItemId") ??
        payloadStringOrNumberV1(envelope, "bikkieBlueprintItemId");
      const structureTypeId = payloadString(envelope, "structureTypeId");
      const blueprintFromItem =
        buildingSystemBlueprintByItemIdV1(blueprintItemId);
      const blueprint =
        buildingSystemBlueprintByIdV1(blueprintId) ??
        blueprintFromItem ??
        buildingSystemBlueprintByStructureTypeV1(
          structureTypeId,
          plot?.plotType
        );
      const propertyId =
        payloadString(envelope, "propertyId") ??
        (plot ? buildingPropertyIdForPlotV1(plot.plotId) : envelope.requestId);
      const rejectBlueprintItemPayload = (warningPrefix: string) => {
        if (!blueprintItemId) {
          return false;
        }
        if (!blueprintFromItem) {
          warnings.push(`${warningPrefix}:unknown_blueprint_item`);
          touchedModels.add("building_rejection");
          return true;
        }
        if (
          blueprint &&
          blueprint.blueprintId !== blueprintFromItem.blueprintId
        ) {
          warnings.push(`${warningPrefix}:blueprint_item_mismatch`);
          touchedModels.add("building_rejection");
          return true;
        }
        return false;
      };
      const consumeBlueprintItemIfRequested = (warningPrefix: string) => {
        if (
          payloadBoolean(envelope, "consumeBlueprintItem") !== true &&
          payloadBoolean(envelope, "spendBlueprintItem") !== true
        ) {
          return false;
        }
        if (!blueprint?.blueprintItemId) {
          warnings.push(`${warningPrefix}:blueprint_item_not_bound`);
          touchedModels.add("building_rejection");
          return true;
        }
        if ((next.inventory.items[blueprint.blueprintItemId] ?? 0) < 1) {
          warnings.push(
            `${warningPrefix}:missing_blueprint_item:${blueprint.blueprintItemId}`
          );
          touchedModels.add("building_rejection");
          return true;
        }
        recordDelta(next.inventory.items, blueprint.blueprintItemId, -1);
        touchedModels.add("inventory_items");
        return false;
      };

      if (subAction === "start_construction") {
        if (!plot || !blueprint) {
          warnings.push(
            "building_project_rejected:missing_real_plot_or_blueprint"
          );
          touchedModels.add("building_rejection");
          break;
        }
        if (rejectBlueprintItemPayload("building_project_rejected")) {
          break;
        }
        if (!next.building.ownedPlots.includes(plot.plotId)) {
          warnings.push("building_project_rejected:plot_not_owned_by_actor");
          touchedModels.add("building_rejection");
          break;
        }
        if (!plot.allowedBlueprintIds.includes(blueprint.blueprintId)) {
          warnings.push(
            "building_project_rejected:blueprint_not_allowed_on_plot"
          );
          touchedModels.add("building_rejection");
          break;
        }
        if (
          rejectForCivilLegalBlockersV1({
            blockers: civilLegalAccessBlockersV1({ state: next }),
            warningPrefix: "building_project_rejected",
            rejectionModel: "building_rejection",
            warnings,
            touchedModels,
          })
        ) {
          break;
        }
        const projectId =
          payloadString(envelope, "projectId") ??
          buildingProjectIdForPlotV1(plot.plotId);
        const existingProject = next.building.activeProjects[projectId];
        if (existingProject && existingProject.status !== "cancelled") {
          warnings.push(
            "building_project_rejected:project_already_exists_for_plot"
          );
          touchedModels.add("building_rejection");
          break;
        }
        if (next.property.owned[propertyId]) {
          warnings.push(
            "building_project_rejected:property_already_completed_for_plot"
          );
          touchedModels.add("building_rejection");
          break;
        }
        const origin = {
          x:
            payloadNumber(envelope, "originX") ??
            buildingSystemDefaultOriginV1(plot, blueprint).x,
          y:
            payloadNumber(envelope, "originY") ??
            buildingSystemDefaultOriginV1(plot, blueprint).y,
          z:
            payloadNumber(envelope, "originZ") ??
            buildingSystemDefaultOriginV1(plot, blueprint).z,
        };
        const rotation = (payloadNumber(envelope, "rotationDegrees") ?? 0) as
          | 0
          | 90
          | 180
          | 270;
        const guidePreview = createBuildingSystemPlacementPreviewV1({
          plot,
          blueprint,
          origin,
          rotationDegrees: rotation,
          owned: true,
        });
        if (!guidePreview.valid) {
          warnings.push(
            ...guidePreview.warnings.map(
              (warning) => `building_project_rejected:${warning}`
            )
          );
          touchedModels.add("building_rejection");
          break;
        }
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
          currentCoveredAreaVoxels: Object.values(
            next.building.placedStructures
          )
            .filter((entry) => entry.plotId === plot.plotId)
            .reduce((acc, entry) => acc + (entry.voxelEditCount ?? 0), 0),
        });
        const placementResult = validateHarthmereBuildingPlacementV1(
          placementReq,
          placementCtx
        );
        if (!placementResult.ok) {
          warnings.push(
            ...placementResult.errors.map(
              (e) => `building_project_rejected:${e}`
            )
          );
          touchedModels.add("building_rejection");
          break;
        }
        if (next.inventory.gold < blueprint.goldCost) {
          warnings.push(
            "building_project_rejected:insufficient_gold_for_blueprint"
          );
          touchedModels.add("building_rejection");
          break;
        }
        if (consumeBlueprintItemIfRequested("building_project_rejected")) {
          break;
        }

        next.inventory.gold = Math.max(
          0,
          next.inventory.gold - blueprint.goldCost
        );
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
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("property", propertyId)
        );
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("plot", plot.plotId)
        );
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
        const projectId =
          payloadString(envelope, "projectId") ??
          buildingProjectIdForPlotV1(plot.plotId);
        const project = next.building.activeProjects[projectId];
        if (!project || project.status !== "active") {
          warnings.push("building_stage_rejected:active_project_not_found");
          touchedModels.add("building_rejection");
          break;
        }
        const projectBlueprint = buildingSystemBlueprintByIdV1(
          project.blueprintId
        );
        if (!projectBlueprint) {
          warnings.push("building_stage_rejected:blueprint_not_found");
          touchedModels.add("building_rejection");
          break;
        }
        const requestedStage =
          payloadString(envelope, "stage") ?? project.currentStage;
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
          contributeAll:
            payloadBoolean(envelope, "contributeAll") === true ||
            !requestedMaterials,
        });
        const missingSubmittedMaterials =
          materialRequest.lines.some((line) => line.remaining > 0) &&
          Object.keys(materialRequest.symbolicContributions).length === 0;
        if (missingSubmittedMaterials) {
          warnings.push("building_stage_rejected:missing_material_submission");
          touchedModels.add("building_rejection");
          break;
        }
        for (const [itemId, delta] of Object.entries(
          materialRequest.itemDeltas
        )) {
          const needed = Math.abs(delta);
          if ((next.inventory.items[itemId] ?? 0) < needed) {
            warnings.push(
              `building_stage_rejected:insufficient_material:${itemId}`
            );
            touchedModels.add("building_rejection");
            break;
          }
        }
        if (touchedModels.has("building_rejection")) {
          break;
        }

        for (const [itemId, delta] of Object.entries(
          materialRequest.itemDeltas
        )) {
          recordDelta(next.inventory.items, itemId, delta);
        }
        const nextMaterials = { ...currentProgress.materials };
        for (const [material, count] of Object.entries(
          materialRequest.symbolicContributions
        )) {
          nextMaterials[material] = (nextMaterials[material] ?? 0) + count;
        }
        const laborRequired = projectBlueprint.laborStages[requestedStage] ?? 0;
        const laborRemaining = Math.max(
          0,
          laborRequired - (currentProgress.labor ?? 0)
        );
        const requestedLabor = Math.max(
          0,
          Math.trunc(payloadNumber(envelope, "laborDelta") ?? laborRemaining)
        );
        const nextLabor = Math.min(
          laborRequired,
          (currentProgress.labor ?? 0) + requestedLabor
        );
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
            propertyId,
            stage: requestedStage,
            origin: project.origin,
            rotationDegrees: project.rotationDegrees,
            activatedAtMs: nowMs,
          });
          project.materializedStageRequestIds.push(envelope.requestId);
          next.building.materializationPlans[
            `${envelope.requestId}:${requestedStage}`
          ] = stagePlan;
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
              value: Math.max(
                projectBlueprint.goldCost,
                payloadNumber(envelope, "propertyValue") ??
                  projectBlueprint.goldCost
              ),
              origin: project.origin,
              rotationDegrees: project.rotationDegrees,
            });
            next.property.owned[propertyId] = completedProperty;
            syncBuildingSystemPhysicalAccessRecordsV1({
              state: next,
              property: completedProperty,
              plotId: plot.plotId,
              origin: project.origin,
              nowMs,
            });
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
                sharedStateKeys.add(
                  harthmereLiveModeSharedStateKeyV1(
                    "guild",
                    completedProperty.guildId
                  )
                );
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
              (project.completedStages.length /
                BUILDING_SYSTEM_CONSTRUCTION_STAGES_V1.length) *
                100
            );
          }
        }

        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("property", propertyId)
        );
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("plot", plot.plotId)
        );
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
        if (rejectBlueprintItemPayload("building_rejected")) {
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
        if (
          rejectForCivilLegalBlockersV1({
            blockers: civilLegalAccessBlockersV1({ state: next }),
            warningPrefix: "building_rejected",
            rejectionModel: "building_rejection",
            warnings,
            touchedModels,
          })
        ) {
          break;
        }
        const origin = {
          x:
            payloadNumber(envelope, "originX") ??
            buildingSystemDefaultOriginV1(plot, blueprint).x,
          y:
            payloadNumber(envelope, "originY") ??
            buildingSystemDefaultOriginV1(plot, blueprint).y,
          z:
            payloadNumber(envelope, "originZ") ??
            buildingSystemDefaultOriginV1(plot, blueprint).z,
        };
        const rotation = (payloadNumber(envelope, "rotationDegrees") ?? 0) as
          | 0
          | 90
          | 180
          | 270;
        const guidePreview = createBuildingSystemPlacementPreviewV1({
          plot,
          blueprint,
          origin,
          rotationDegrees: rotation,
          owned: true,
        });
        if (!guidePreview.valid) {
          warnings.push(
            ...guidePreview.warnings.map(
              (warning) => `building_rejected:${warning}`
            )
          );
          touchedModels.add("building_rejection");
          break;
        }
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
          currentCoveredAreaVoxels: Object.values(
            next.building.placedStructures
          )
            .filter((entry) => entry.plotId === plot.plotId)
            .reduce((acc, entry) => acc + (entry.voxelEditCount ?? 0), 0),
        });
        const placementResult = validateHarthmereBuildingPlacementV1(
          placementReq,
          placementCtx
        );
        if (!placementResult.ok) {
          warnings.push(
            ...placementResult.errors.map((e) => `building_rejected:${e}`)
          );
          touchedModels.add("building_rejection");
          break;
        }
        if (next.inventory.gold < blueprint.goldCost) {
          warnings.push("building_rejected:insufficient_gold_for_blueprint");
          touchedModels.add("building_rejection");
          break;
        }
        if (consumeBlueprintItemIfRequested("building_rejected")) {
          break;
        }

        next.inventory.gold = Math.max(
          0,
          next.inventory.gold - blueprint.goldCost
        );
        const plan = createBuildingSystemMaterializationPlanV1({
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          plot,
          blueprint,
          propertyId,
          origin,
          rotationDegrees: rotation,
          includeSafeGround: false,
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
          value: Math.max(
            blueprint.goldCost,
            payloadNumber(envelope, "propertyValue") ?? blueprint.goldCost
          ),
          origin,
          rotationDegrees: rotation,
        });
        next.property.owned[propertyId] = placedProperty;
        syncBuildingSystemPhysicalAccessRecordsV1({
          state: next,
          property: placedProperty,
          plotId: plot.plotId,
          origin,
          nowMs,
        });
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
            sharedStateKeys.add(
              harthmereLiveModeSharedStateKeyV1("guild", placedProperty.guildId)
            );
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
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("property", propertyId)
        );
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("plot", plot.plotId)
        );
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
          const propertyBlueprint = buildingSystemBlueprintByIdV1(
            property.blueprintId
          );
          if (
            propertyPlot &&
            propertyBlueprint &&
            property.condition <= 80 &&
            !property.visualDamageApplied
          ) {
            const damagePlan =
              createBuildingSystemRepairDamageMaterializationPlanV1({
                requestId: `${envelope.requestId}:visible_damage`,
                actorId: envelope.actorId,
                property,
                plot: propertyPlot,
                blueprint: propertyBlueprint,
                activatedAtMs: nowMs,
              });
            property.visualDamageApplied = true;
            next.property.owned[propertyId] = property;
            next.building.materializationPlans[damagePlan.requestId] =
              damagePlan;
            buildingMaterializationPlans.push(damagePlan);
            touchedModels.add("property_visible_decay");
            touchedModels.add("terrain_materialization");
          }
          syncBuildingSystemPhysicalAccessRecordsV1({
            state: next,
            property,
            plotId: property.plotId,
            nowMs,
          });
          sharedStateKeys.add(
            harthmereLiveModeSharedStateKeyV1("property", propertyId)
          );
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
        const accessMode = normalizeAccessModeV1(
          payloadString(envelope, "accessMode")
        );
        if (!property) break;
        if (!accessMode) {
          warnings.push("property_access_rejected:invalid_access_mode");
          touchedModels.add("property_rejection");
          break;
        }
        property.accessMode = accessMode;
        property.permissions =
          createBuildingSystemDefaultPermissionsV1(accessMode);
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({
          state: next,
          property,
          plotId: property.plotId,
          nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("property", propertyId)
        );
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
        const subject = normalizePermissionSubjectV1(
          payloadString(envelope, "subject")
        );
        const permission = normalizePermissionKeyV1(
          payloadString(envelope, "permission")
        );
        if (!property) break;
        if (!subject || !permission || subject === "owner") {
          warnings.push(
            "property_permission_rejected:invalid_subject_or_permission"
          );
          touchedModels.add("property_rejection");
          break;
        }
        property.permissions[subject][permission] =
          payloadBoolean(envelope, "enabled") === true;
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("property", propertyId)
        );
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
        if (
          subAction === "add_guest" &&
          !property.guestActorIds.includes(guestActorId)
        ) {
          property.guestActorIds.push(guestActorId);
        }
        if (subAction === "remove_guest") {
          property.guestActorIds = property.guestActorIds.filter(
            (id) => id !== guestActorId
          );
        }
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({
          state: next,
          property,
          plotId: property.plotId,
          nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("property", propertyId)
        );
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
        const payment = Math.min(
          property.taxBalanceGold,
          Math.max(
            0,
            Math.trunc(
              payloadNumber(envelope, "gold") ?? property.taxBalanceGold
            )
          )
        );
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
        property.taxBalanceGold = Math.max(
          0,
          property.taxBalanceGold - payment
        );
        if (property.taxBalanceGold === 0) {
          property.unpaidTaxSinceMs = undefined;
        }
        property.updatedAtMs = nowMs;
        next.economy.houseTaxAccumulated += payment;
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: "property_tax_paid",
          amount: -payment,
          atMs: nowMs,
        });
        next.property.owned[propertyId] = property;
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("property", propertyId)
        );
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
        const propertyBlueprint = buildingSystemBlueprintByIdV1(
          property.blueprintId
        );
        if (propertyPlot && propertyBlueprint) {
          const repairPlan =
            createBuildingSystemRepairRestoreMaterializationPlanV1({
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
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: "property_repaired",
          amount: -cost,
          atMs: nowMs,
        });
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({
          state: next,
          property,
          plotId: property.plotId,
          nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("property", propertyId)
        );
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
        if (
          !buildingSystemCanActorAccessPropertyV1({
            property,
            actorId: envelope.actorId,
            permission: "build_edit",
            guildId: next.guild.guildId,
          })
        ) {
          warnings.push(
            "property_upgrade_rejected:missing_build_edit_permission"
          );
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
        property.upgradedVoxelTier = Math.max(
          property.upgradedVoxelTier,
          property.tier
        );
        property.value = computePropertyTierValueV1(property);
        property.storageSlots += Math.max(
          4,
          Math.floor(property.storageSlots * 0.5)
        );
        property.condition = Math.min(100, property.condition + 10);
        property.updatedAtMs = nowMs;
        const propertyPlot = buildingSystemPlotByIdV1(property.plotId);
        const propertyBlueprint = buildingSystemBlueprintByIdV1(
          property.blueprintId
        );
        if (propertyPlot && propertyBlueprint) {
          const upgradePlan = createBuildingSystemUpgradeMaterializationPlanV1({
            requestId: `${envelope.requestId}:upgrade_tier_${property.tier}`,
            actorId: envelope.actorId,
            property,
            plot: propertyPlot,
            blueprint: propertyBlueprint,
            activatedAtMs: nowMs,
          });
          next.building.materializationPlans[upgradePlan.requestId] =
            upgradePlan;
          buildingMaterializationPlans.push(upgradePlan);
          touchedModels.add("property_visible_upgrade");
          touchedModels.add("terrain_materialization");
        }
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: "property_upgraded_tier_2",
          amount: -cost,
          atMs: nowMs,
        });
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({
          state: next,
          property,
          plotId: property.plotId,
          nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("property", propertyId)
        );
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
        property.storageItemCount = Math.max(
          0,
          Math.trunc(
            payloadNumber(envelope, "storageItemCount") ??
              property.storageItemCount
          )
        );
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({
          state: next,
          property,
          plotId: property.plotId,
          nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("property", propertyId)
        );
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
        if (
          !buildingSystemCanActorAccessPropertyV1({
            property,
            actorId: envelope.actorId,
            permission: "demolition",
            guildId: next.guild.guildId,
          })
        ) {
          warnings.push(
            "property_demolition_rejected:missing_demolition_permission"
          );
          touchedModels.add("property_rejection");
          break;
        }
        if (property.storageItemCount > 0) {
          warnings.push("property_demolition_rejected:storage_not_empty");
          touchedModels.add("property_rejection");
          break;
        }
        const refund =
          payloadBoolean(envelope, "refund") === false
            ? 0
            : buildingSystemDemolitionRefundGoldV1(property);
        next.inventory.gold += refund;
        property.status = "demolished";
        property.updatedAtMs = nowMs;
        const propertyPlot = buildingSystemPlotByIdV1(property.plotId);
        const propertyBlueprint = buildingSystemBlueprintByIdV1(
          property.blueprintId
        );
        if (propertyPlot && propertyBlueprint) {
          const demolitionPlan =
            createBuildingSystemDemolitionMaterializationPlanV1({
              requestId: `${envelope.requestId}:demolition_cleanup`,
              actorId: envelope.actorId,
              property,
              plot: propertyPlot,
              blueprint: propertyBlueprint,
              activatedAtMs: nowMs,
            });
          next.building.materializationPlans[demolitionPlan.requestId] =
            demolitionPlan;
          buildingMaterializationPlans.push(demolitionPlan);
          for (const markerId of Object.keys(next.building.inWorldMarkers)) {
            const marker = next.building.inWorldMarkers[markerId];
            if (
              marker.plotId === property.plotId &&
              (marker.kind === "deed_sign" ||
                marker.kind === "map_marker" ||
                marker.kind === "storage_container" ||
                marker.kind === "door_lock" ||
                marker.kind === "business_marker" ||
                marker.kind === "home_console")
            ) {
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
          next.building.ownedPlots = next.building.ownedPlots.filter(
            (id) => id !== plot.plotId
          );
          delete next.building.placedStructures[
            buildingProjectIdForPlotV1(plot.plotId)
          ];
          delete next.building.activeProjects[
            buildingProjectIdForPlotV1(plot.plotId)
          ];
        }
        next.property.buildingProgress[propertyId] = 0;
        next.economy.ledger.push({
          id: envelope.requestId,
          kind:
            refund > 0
              ? "property_demolished_refund"
              : "property_demolished_no_refund",
          amount: refund,
          atMs: nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("property", propertyId)
        );
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
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("property", propertyId)
        );
        touchedModels.add("property_abandonment");
        break;
      }

      if (
        subAction === "list_property_for_sale" ||
        subAction === "transfer_property"
      ) {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        if (
          !buildingSystemCanActorAccessPropertyV1({
            property,
            actorId: envelope.actorId,
            permission: "transfer_sale",
            guildId: next.guild.guildId,
          })
        ) {
          warnings.push(
            "property_transfer_rejected:missing_transfer_sale_permission"
          );
          touchedModels.add("property_rejection");
          break;
        }
        if (subAction === "list_property_for_sale") {
          property.listedForSale = true;
          property.salePriceGold = Math.max(
            1,
            Math.trunc(
              payloadNumber(envelope, "salePriceGold") ?? property.value
            )
          );
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
          if (
            property.businessId &&
            next.economy.businesses[property.businessId]
          ) {
            next.economy.businesses[property.businessId].ownerId = newOwnerId;
            next.economy.businesses[property.businessId].updatedAtMs = nowMs;
          }
        }
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecordsV1({
          state: next,
          property,
          plotId: property.plotId,
          nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("property", propertyId)
        );
        touchedModels.add("property_transfer_sale");
        break;
      }

      if (subAction === "preview_blueprint") {
        if (!plot || !blueprint) {
          warnings.push(
            "building_preview_rejected:missing_real_plot_or_blueprint"
          );
          touchedModels.add("building_rejection");
          break;
        }
        if (rejectBlueprintItemPayload("building_preview_rejected")) {
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
          label: preview.valid
            ? `${blueprint.displayName} ghost preview valid`
            : `${blueprint.displayName} ghost preview blocked`,
          createdAtMs: nowMs,
        };
        touchedModels.add("blueprint_ghost_preview");
        touchedModels.add(
          preview.valid
            ? "blueprint_preview_valid"
            : "blueprint_preview_blocked"
        );
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
        const allowed =
          subAction === "use_storage"
            ? buildingSystemCanActorAccessPropertyV1({
                property,
                actorId,
                permission: "storage_access",
                guildId: next.guild.guildId,
              })
            : property.accessMode === "public" ||
              buildingSystemCanActorAccessPropertyV1({
                property,
                actorId,
                permission: "storage_access",
                guildId: next.guild.guildId,
              }) ||
              buildingSystemCanActorAccessPropertyV1({
                property,
                actorId,
                permission: "build_edit",
                guildId: next.guild.guildId,
              });
        if (!allowed) {
          warnings.push(`${subAction}_rejected:physical_lock_denied`);
          touchedModels.add("physical_access_rejection");
          break;
        }
        touchedModels.add(
          subAction === "use_storage"
            ? "physical_storage_access"
            : "physical_door_access"
        );
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
        const businessType = payloadString(envelope, "businessType") as
          | BuildingSystemBusinessTypeV1
          | undefined;
        const businessDefinition =
          buildingSystemBusinessTypeByIdV1(businessType);
        if (!businessDefinition || !businessType) {
          warnings.push("business_rejected:unknown_business_type");
          touchedModels.add("business_rejection");
          break;
        }
        if (
          rejectForCivilLegalBlockersV1({
            blockers: civilLegalAccessBlockersV1({ state: next }),
            warningPrefix: "business_rejected",
            rejectionModel: "business_rejection",
            warnings,
            touchedModels,
          })
        ) {
          break;
        }
        if (next.inventory.gold < businessDefinition.startingCostGold) {
          warnings.push("business_rejected:insufficient_startup_gold");
          touchedModels.add("business_rejection");
          break;
        }
        const businessId =
          property.businessId ?? `business_${property.propertyId}`;
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
        const productionLinked = ensureProductionBusinessForPropertyBusinessV1({
          state: next,
          business,
          property,
          nowMs,
          warnings,
          touchedModels,
          sharedStateKeys,
        });
        next.building.inWorldMarkers[`${businessId}:marker`] = {
          markerId: `${businessId}:marker`,
          plotId: property.plotId,
          kind: "business_marker",
          position: [
            buildingSystemDefaultOriginV1(
              buildingSystemPlotByIdV1(property.plotId)!,
              buildingSystemBlueprintByIdV1(property.blueprintId)!
            ).x,
            buildingSystemDefaultOriginV1(
              buildingSystemPlotByIdV1(property.plotId)!,
              buildingSystemBlueprintByIdV1(property.blueprintId)!
            ).y + 2,
            buildingSystemDefaultOriginV1(
              buildingSystemPlotByIdV1(property.plotId)!,
              buildingSystemBlueprintByIdV1(property.blueprintId)!
            ).z,
          ],
          label: businessDefinition.displayName,
          createdAtMs: nowMs,
        };
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: `business_started_${businessType}`,
          amount: -businessDefinition.startingCostGold,
          atMs: nowMs,
        });
        if (productionLinked) {
          const jobSeed = reduceHarthmereJobsBoardMutationV1(
            next.jobsBoard,
            {
              requestId: `${envelope.requestId}:business_job_seed`,
              actorId: envelope.actorId,
              nowMs,
              operation: "economy_auto_seed_jobs",
              boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
            } as any,
            {
              actorGold: next.inventory.gold,
              actorInventoryItems: next.inventory.items,
              actorCollectibles: next.collections.discovered,
              actorGuildId: next.guild.memberGuildId,
              economy: next.economy.production,
            }
          );
          next.jobsBoard = jobSeed.jobsBoard;
          if (jobSeed.economy) next.economy.production = jobSeed.economy;
          for (const warning of jobSeed.warnings) warnings.push(warning);
          for (const model of jobSeed.touchedModels) touchedModels.add(model);
          for (const key of jobSeed.sharedStateKeys) sharedStateKeys.add(key);
        }
        touchedModels.add("business_started");
        touchedModels.add("business_marker");
        touchedModels.add("wallet");
        touchedModels.add("economy_ledger");
        break;
      }

      if (
        subAction === "run_business_cycle" ||
        subAction === "collect_business_revenue"
      ) {
        const property = getOwnedPropertyForMutationV1({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        const businessId =
          payloadString(envelope, "businessId") ?? property.businessId;
        const business = businessId
          ? next.economy.businesses[businessId]
          : undefined;
        if (!business) {
          warnings.push("business_rejected:not_found");
          touchedModels.add("business_rejection");
          break;
        }
        if (subAction === "run_business_cycle") {
          const result = runBuildingSystemBusinessRevenueCycleV1({
            business,
            nowMs,
            cycles: Math.max(
              1,
              Math.trunc(payloadNumber(envelope, "cycles") ?? 1)
            ),
          });
          next.economy.businesses[business.businessId] = result.business;
          next.economy.businessRevenueAccumulated += result.net;
          next.economy.ledger.push({
            id: envelope.requestId,
            kind: `business_revenue_${business.type}`,
            amount: result.net,
            atMs: nowMs,
          });
          touchedModels.add("business_revenue_cycle");
          touchedModels.add("economy_ledger");
        } else {
          const collection = Math.max(
            0,
            Math.trunc(business.revenueBalanceGold)
          );
          if (collection <= 0) {
            warnings.push("business_collect_rejected:no_revenue");
            touchedModels.add("business_rejection");
            break;
          }
          business.revenueBalanceGold = 0;
          business.updatedAtMs = nowMs;
          next.economy.businesses[business.businessId] = business;
          let actorCollection = collection;
          if (
            property.guildId &&
            next.guild.guilds[property.guildId]?.taxRate > 0
          ) {
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
                actorLevel:
                  next.classMagic.skills["character_level"]?.level ?? 1,
                trustedTaxCollection: true,
              }
            );
            next.guild = taxResult.guild;
            for (const guildId of taxResult.sharedGuildIds) {
              sharedStateKeys.add(
                harthmereLiveModeSharedStateKeyV1("guild", guildId)
              );
            }
            for (const model of taxResult.touchedModels)
              touchedModels.add(model);
            const guildRecord = next.guild.guilds[property.guildId];
            const taxLog =
              guildRecord?.treasuryLogs[guildRecord.treasuryLogs.length - 1];
            if (taxLog?.kind === "tax") {
              actorCollection = Math.max(0, collection - taxLog.amountGold);
            }
          }
          next.inventory.gold += actorCollection;
          next.economy.ledger.push({
            id: envelope.requestId,
            kind: `business_revenue_collected_${business.type}`,
            amount: actorCollection,
            atMs: nowMs,
          });
          touchedModels.add("business_revenue_collected");
          touchedModels.add("wallet");
          touchedModels.add("economy_ledger");
        }
        break;
      }

      // Generic property mutation (non-placement), retained for older callers but now normalized.
      const fallbackPlot = plot ?? buildingSystemPlotByIdV1(requestedPlotId);
      const fallbackBlueprint =
        blueprint ?? buildingSystemBlueprintByIdV1(blueprintId);
      if (fallbackPlot && fallbackBlueprint) {
        next.property.owned[propertyId] = createBuildingSystemPropertyRecordV1({
          propertyId,
          ownerId: envelope.actorId,
          plot: fallbackPlot,
          blueprint: fallbackBlueprint,
          nowMs,
          guildId: next.guild.guildId,
          value: Math.max(
            0,
            payloadNumber(envelope, "propertyValue") ??
              fallbackBlueprint.goldCost
          ),
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
    case "request_home_decoration": {
      if (
        rejectHomeDecorationOutsideConsoleV1({
          state: next,
          envelope,
          nowMs,
          warnings,
          touchedModels,
        })
      ) {
        break;
      }
      const operation = payloadString(envelope, "operation") as
        | HarthmereHomeDecorationOperationV1
        | undefined;
      const decorationId = payloadString(envelope, "decorationId");
      const existingDecorationPropertyId = decorationId
        ? next.homeDecoration.placed[decorationId]?.propertyId
        : undefined;
      if (!operation) {
        warnings.push("home_decoration_rejected:missing_operation");
        touchedModels.add("home_decoration_rejection");
        break;
      }
      const positionPayload = payloadRecord(envelope, "position");
      const result = reduceHarthmereHomeDecorationMutationV1(
        next.homeDecoration,
        {
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          operation,
          propertyId: payloadString(envelope, "propertyId"),
          decorationId,
          itemId: payloadStringOrNumberV1(envelope, "itemId"),
          seedItemId: payloadStringOrNumberV1(envelope, "seedItemId"),
          position: {
            x:
              typeof positionPayload?.x === "number"
                ? positionPayload.x
                : payloadNumber(envelope, "x"),
            y:
              typeof positionPayload?.y === "number"
                ? positionPayload.y
                : payloadNumber(envelope, "y"),
            z:
              typeof positionPayload?.z === "number"
                ? positionPayload.z
                : payloadNumber(envelope, "z"),
          },
          rotationDegrees: payloadNumber(envelope, "rotationDegrees"),
          nowMs,
        },
        {
          properties: next.property.owned,
          actorInventoryItems: next.inventory.items,
        }
      );
      if (!result.ok) {
        for (const error of result.errors) {
          warnings.push(`home_decoration_rejected:${error}`);
        }
        touchedModels.add("home_decoration_rejection");
        break;
      }
      next.homeDecoration = result.state;
      for (const [itemId, delta] of Object.entries(result.itemDeltas)) {
        applyBankRecordDeltaV1(next.inventory.items, itemId, delta);
      }
      for (const model of result.touchedModels) {
        touchedModels.add(model);
      }
      if (result.materializationPlans?.length) {
        for (const plan of result.materializationPlans) {
          next.building.materializationPlans[plan.requestId] = plan;
        }
        buildingMaterializationPlans.push(...result.materializationPlans);
        touchedModels.add("home_decoration_voxel_materialization");
        touchedModels.add("terrain_materialization");
        sharedStateKeys.add(harthmereLiveModeSharedWorldStateKeyV1());
      }
      if (Object.keys(result.itemDeltas).length > 0) {
        touchedModels.add("inventory_items");
      }
      const propertyId =
        payloadString(envelope, "propertyId") ?? existingDecorationPropertyId;
      if (propertyId) {
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("property", propertyId)
        );
      }
      break;
    }
    case "request_crafting": {
      const jobAction = payloadString(envelope, "jobAction") ?? "instant";
      if (jobAction === "cancel") {
        const jobId = payloadString(envelope, "craftingJobId");
        const job = jobId ? next.crafting.activeJobs[jobId] : undefined;
        if (!jobId || !job) {
          warnings.push("crafting_rejected:unknown_active_job");
          touchedModels.add("crafting_rejection");
          break;
        }
        if (job.actorId !== envelope.actorId) {
          warnings.push("crafting_rejected:job_actor_mismatch");
          touchedModels.add("crafting_rejection");
          break;
        }
        for (const [itemId, delta] of Object.entries(job.reservedItemDeltas)) {
          applyBankRecordDeltaV1(next.inventory.items, itemId, -delta);
        }
        for (const [itemId, delta] of Object.entries(
          job.reservedMaterialStorageDeltas
        )) {
          applyBankRecordDeltaV1(next.banking.materialStorage, itemId, -delta);
        }
        next.inventory.gold = Math.max(
          0,
          next.inventory.gold - job.reservedGoldDelta
        );
        refundCraftingJobToolDurabilityV1(next, job, touchedModels);
        delete next.crafting.activeJobs[jobId];
        const cancelledJob: HarthmereLiveModeCraftingJobV1 = {
          ...job,
          status: "cancelled",
        };
        next.crafting.history = [...next.crafting.history, cancelledJob].slice(
          -100
        );
        touchedModels.add("crafting_job");
        touchedModels.add("inventory_items");
        touchedModels.add("material_storage");
        touchedModels.add("wallet");
        break;
      }

      if (jobAction === "complete") {
        const jobId = payloadString(envelope, "craftingJobId");
        const job = jobId ? next.crafting.activeJobs[jobId] : undefined;
        if (!jobId || !job) {
          warnings.push("crafting_rejected:unknown_active_job");
          touchedModels.add("crafting_rejection");
          break;
        }
        if (job.actorId !== envelope.actorId) {
          warnings.push("crafting_rejected:job_actor_mismatch");
          touchedModels.add("crafting_rejection");
          break;
        }
        if (
          (next.combat.deathState ?? "alive") !== "alive" &&
          nowMs < job.readyAtMs
        ) {
          for (const [itemId, delta] of Object.entries(
            job.reservedItemDeltas
          )) {
            applyBankRecordDeltaV1(next.inventory.items, itemId, -delta);
          }
          for (const [itemId, delta] of Object.entries(
            job.reservedMaterialStorageDeltas
          )) {
            applyBankRecordDeltaV1(
              next.banking.materialStorage,
              itemId,
              -delta
            );
          }
          next.inventory.gold = Math.max(
            0,
            next.inventory.gold - job.reservedGoldDelta
          );
          refundCraftingJobToolDurabilityV1(next, job, touchedModels);
          delete next.crafting.activeJobs[jobId];
          const cancelledJob: HarthmereLiveModeCraftingJobV1 = {
            ...job,
            status: "cancelled",
          };
          next.crafting.history = [
            ...next.crafting.history,
            cancelledJob,
          ].slice(-100);
          warnings.push("crafting_rejected:job_cancelled_by_death");
          touchedModels.add("crafting_job");
          touchedModels.add("crafting_rejection");
          break;
        }
        if (nowMs < job.readyAtMs) {
          warnings.push("crafting_rejected:job_not_ready");
          touchedModels.add("crafting_rejection");
          break;
        }
        const snapshot = buildInventorySnapshot();
        const recipe = getHarthmereCraftingRecipeV1(job.recipeId);
        if (
          wouldCraftCompletionExceedCarryWeightV1(
            snapshot.items,
            recipe,
            job.count,
            job.targetItemId
          )
        ) {
          pushCarryWeightRejectionV1(warnings, touchedModels, "crafting");
          break;
        }
        const craftReq: HarthmereInventoryMutationRequestV1 = {
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          kind: "craft_item",
          nowMs,
          recipeId: job.recipeId,
          count: job.count,
          stationId: job.stationId,
          stationType: job.stationType,
          toolItemIds: job.toolItemIds,
          optionalReagentItemIds: job.optionalReagentItemIds,
          targetItemId: job.targetItemId,
          workflowStepIds: job.workflowStepIds,
          qualitySeed: job.qualitySeed,
          craftingPhase: "complete",
          craftingJobId: jobId,
          prepaidCraftingInputs: true,
        };
        const craftResult = reduceHarthmereInventoryMutationV1(craftReq, {
          snapshot,
          playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
          playerSkills: next.classMagic.skills,
          reputation: next.law.reputation,
          allowPrepaidCraftingInputs: true,
        });
        if (!craftResult.ok) {
          warnings.push(
            ...craftResult.errors.map((e) => `crafting_rejected:${e}`)
          );
          touchedModels.add("crafting_rejection");
          break;
        }
        const updated = applyHarthmereInventoryMutationResultV1(
          snapshot,
          craftResult
        );
        next.inventory.items = updated.items;
        next.inventory.gold = updated.gold;
        next.banking.materialStorage =
          updated.materialStorage ?? next.banking.materialStorage;
        next.classMagic.knownRecipes = updated.knownRecipes;
        if (craftResult.craftingOutcome?.success === false) {
          applyStartedCraftingFailureRefundV1(next, job, recipe, touchedModels);
        }
        applyCraftingOutcomeDurabilityV1(next, craftResult, touchedModels, {
          applyToolCosts: false,
        });
        if (craftResult.xpDelta > 0) {
          const skillId =
            craftResult.craftingOutcome?.professionId ?? "crafting";
          const skillProgress = upsertSkill(
            next.classMagic.skills,
            skillId,
            craftResult.xpDelta
          );
          if (skillProgress.warning) warnings.push(skillProgress.warning);
          if (skillId !== "crafting") {
            const genericProgress = upsertSkill(
              next.classMagic.skills,
              "crafting",
              Math.max(1, Math.floor(craftResult.xpDelta / 2))
            );
            if (genericProgress.warning) warnings.push(genericProgress.warning);
          }
        }
        delete next.crafting.activeJobs[jobId];
        const completedJob: HarthmereLiveModeCraftingJobV1 = {
          ...job,
          status:
            craftResult.craftingOutcome?.success === false
              ? "failed"
              : "completed",
          outcome: craftResult.craftingOutcome,
        };
        next.crafting.history = [...next.crafting.history, completedJob].slice(
          -100
        );
        if (craftResult.goldDelta !== 0 || craftResult.craftingOutcome) {
          next.economy.ledger.push({
            id: `craft_${envelope.requestId}`,
            kind:
              craftResult.craftingOutcome?.success === false
                ? "crafting_failed"
                : "crafting_completed",
            amount: craftResult.goldDelta,
            atMs: nowMs,
          });
        }
        touchedModels.add("crafting");
        touchedModels.add("crafting_job");
        touchedModels.add("inventory_items");
        if (Object.keys(craftResult.materialStorageDeltas).length > 0) {
          touchedModels.add("material_storage");
        }
        if (craftResult.goldDelta !== 0) touchedModels.add("wallet");
        break;
      }

      if (jobAction !== "instant" && jobAction !== "start") {
        warnings.push("crafting_rejected:invalid_job_action");
        touchedModels.add("crafting_rejection");
        break;
      }

      const recipeId = payloadString(envelope, "recipeId");
      if (!recipeId) {
        warnings.push("crafting_rejected:missing_recipe_id");
        touchedModels.add("crafting_rejection");
        break;
      }
      const snapshot = buildInventorySnapshot();
      const recipe = getHarthmereCraftingRecipeV1(recipeId);
      const craftCount = payloadNumber(envelope, "count") ?? 1;
      if (
        !Number.isFinite(craftCount) ||
        craftCount < 1 ||
        Math.trunc(craftCount) !== craftCount
      ) {
        warnings.push("crafting_rejected:invalid_count");
        touchedModels.add("crafting_rejection");
        break;
      }
      const requestedToolItemIds = payloadStringArray(envelope, "toolItemIds");
      const toolItemIds = selectedLiveCraftingToolItemIdsV1(
        snapshot,
        requestedToolItemIds
      );
      const toolDurabilityRejection = craftingToolDurabilityRejectionV1(
        next,
        recipe,
        toolItemIds,
        craftCount
      );
      if (toolDurabilityRejection) {
        warnings.push(`crafting_rejected:${toolDurabilityRejection}`);
        touchedModels.add("crafting_rejection");
        touchedModels.add("tool_durability");
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
        stationId: payloadStringOrNumberV1(envelope, "stationId"),
        stationType: payloadString(envelope, "stationType"),
        toolItemIds,
        optionalReagentItemIds: payloadStringArray(
          envelope,
          "optionalReagentItemIds"
        ),
        targetItemId: payloadString(envelope, "targetItemId"),
        workflowStepIds: payloadStringArray(envelope, "workflowStepIds"),
        qualitySeed: payloadNumber(envelope, "qualitySeed"),
        craftingPhase: jobAction === "start" ? "start" : "instant",
      };
      const craftResult = reduceHarthmereInventoryMutationV1(craftReq, {
        snapshot,
        playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
        playerSkills: next.classMagic.skills,
        reputation: next.law.reputation,
      });
      if (craftResult.ok) {
        const updated = applyHarthmereInventoryMutationResultV1(
          snapshot,
          craftResult
        );
        next.inventory.items = updated.items;
        next.inventory.gold = updated.gold;
        next.banking.materialStorage =
          updated.materialStorage ?? next.banking.materialStorage;
        next.classMagic.knownRecipes = updated.knownRecipes;
        applyCraftingOutcomeDurabilityV1(next, craftResult, touchedModels, {
          applyToolCosts: true,
        });
        if (craftResult.xpDelta > 0) {
          const skillId =
            craftResult.craftingOutcome?.professionId ?? "crafting";
          const skillProgress = upsertSkill(
            next.classMagic.skills,
            skillId,
            craftResult.xpDelta
          );
          if (skillProgress.warning) warnings.push(skillProgress.warning);
          if (skillId !== "crafting") {
            const genericProgress = upsertSkill(
              next.classMagic.skills,
              "crafting",
              Math.max(1, Math.floor(craftResult.xpDelta / 2))
            );
            if (genericProgress.warning) warnings.push(genericProgress.warning);
          }
        }
        if (jobAction === "start" && craftResult.craftingOutcome?.readyAtMs) {
          const jobId = nextCraftingJobIdV1(next);
          next.crafting.activeJobs[jobId] = {
            jobId,
            actorId: envelope.actorId,
            recipeId,
            count: craftCount,
            stationId: craftReq.stationId,
            stationType: craftReq.stationType,
            toolItemIds: craftReq.toolItemIds ?? [],
            optionalReagentItemIds: craftReq.optionalReagentItemIds ?? [],
            targetItemId: craftReq.targetItemId,
            workflowStepIds: craftReq.workflowStepIds ?? [],
            qualitySeed: craftReq.qualitySeed,
            startedAtMs: nowMs,
            readyAtMs: craftResult.craftingOutcome.readyAtMs,
            status: "active",
            reservedItemDeltas: craftResult.itemDeltas,
            reservedMaterialStorageDeltas: craftResult.materialStorageDeltas,
            reservedGoldDelta: craftResult.goldDelta,
            outcome: craftResult.craftingOutcome,
          };
          touchedModels.add("crafting_job");
        } else if (craftResult.craftingOutcome) {
          const immediateJob: HarthmereLiveModeCraftingJobV1 = {
            jobId: `craft_${envelope.requestId}`,
            actorId: envelope.actorId,
            recipeId,
            count: craftCount,
            stationId: craftReq.stationId,
            stationType: craftReq.stationType,
            toolItemIds: craftReq.toolItemIds ?? [],
            optionalReagentItemIds: craftReq.optionalReagentItemIds ?? [],
            targetItemId: craftReq.targetItemId,
            workflowStepIds: craftReq.workflowStepIds ?? [],
            qualitySeed: craftReq.qualitySeed,
            startedAtMs: nowMs,
            readyAtMs: nowMs,
            status: craftResult.craftingOutcome.success
              ? "completed"
              : "failed",
            reservedItemDeltas: craftResult.itemDeltas,
            reservedMaterialStorageDeltas: craftResult.materialStorageDeltas,
            reservedGoldDelta: craftResult.goldDelta,
            outcome: craftResult.craftingOutcome,
          };
          next.crafting.history = [
            ...next.crafting.history,
            immediateJob,
          ].slice(-100);
        }
        if (craftResult.goldDelta !== 0 || craftResult.craftingOutcome) {
          next.economy.ledger.push({
            id: `craft_${envelope.requestId}`,
            kind:
              jobAction === "start"
                ? "crafting_job_started"
                : craftResult.craftingOutcome?.success === false
                ? "crafting_failed"
                : "crafting_completed",
            amount: craftResult.goldDelta,
            atMs: nowMs,
          });
        }
        touchedModels.add("crafting");
        touchedModels.add("inventory_items");
        if (Object.keys(craftResult.materialStorageDeltas).length > 0) {
          touchedModels.add("material_storage");
        }
        if (craftResult.goldDelta !== 0) {
          touchedModels.add("wallet");
        }
      } else {
        warnings.push(
          ...craftResult.errors.map((e) => `crafting_rejected:${e}`)
        );
        touchedModels.add("crafting_rejection");
      }
      break;
    }
    case "request_farming_action": {
      const operation = payloadString(envelope, "operation");
      if (operation) {
        let authority = liveFarmingAuthorityStateV1();
        let authorityResult:
          | ReturnType<typeof plantHarthmereCropV1>
          | ReturnType<typeof waterHarthmereCropV1>
          | ReturnType<typeof harvestHarthmereCropV1>
          | ReturnType<typeof gatherHarthmereSeedV1>
          | ReturnType<typeof forageHarthmereFoodSpawnV1>
          | ReturnType<typeof huntHarthmereAnimalForFoodV1>
          | ReturnType<typeof cookHarthmereFoodV1>
          | ReturnType<typeof eatHarthmereFoodV1>
          | ReturnType<typeof feedHarthmereLivestockV1>
          | ReturnType<typeof collectHarthmereLivestockProductV1>
          | undefined;

        if (operation === "mine_exotic_matter_deposit") {
          const depositId =
            payloadString(envelope, "depositId") ?? envelope.targetId ?? "";
          const deposit = harthmereExoticMatterDepositByIdV1(depositId);
          if (!deposit) {
            warnings.push("exotic_matter_rejected:unknown_deposit");
            touchedModels.add("exotic_matter_rejection");
            break;
          }
          const actorPosition = actorWorldPositionFromAuthorityV1(envelope);
          if (!actorPosition) {
            warnings.push(
              "exotic_matter_rejected:deposit_proximity_unverified"
            );
            touchedModels.add("exotic_matter_rejection");
            break;
          }
          if (
            distanceSq3V1(actorPosition, {
              x: deposit.position[0],
              y: deposit.position[1],
              z: deposit.position[2],
            }) >
            HARTHMERE_EXOTIC_MATTER_MINE_INTERACTION_RADIUS_V1 *
              HARTHMERE_EXOTIC_MATTER_MINE_INTERACTION_RADIUS_V1
          ) {
            warnings.push("exotic_matter_rejected:deposit_proximity_required");
            touchedModels.add("exotic_matter_rejection");
            break;
          }
          const claimKey = exoticMatterDepositClaimKeyV1(deposit.depositId);
          const mineResult = mineHarthmereExoticMatterDepositV1({
            state: liveExoticMatterDepositStateFromClaimsV1(next, nowMs),
            depositId: deposit.depositId,
            nowMs,
          });
          if (mineResult.warnings.length > 0) {
            warnings.push(...mineResult.warnings);
            touchedModels.add("exotic_matter_rejection");
            break;
          }
          for (const [itemId, delta] of Object.entries(
            mineResult.inventoryItemDeltas
          )) {
            recordDelta(next.inventory.items, itemId, delta);
          }
          next.combat.lootClaims[claimKey] = nowMs;
          touchedModels.add("inventory_items");
          touchedModels.add("exotic_matter_deposits");
          touchedModels.add("loot_claims");
          sharedStateKeys.add(
            harthmereLiveModeSharedStateKeyV1(
              "exotic_matter_deposit",
              deposit.depositId
            )
          );
          break;
        } else if (operation === "gather_seed") {
          authorityResult = gatherHarthmereSeedV1(authority, {
            seedItemId: payloadString(envelope, "seedItemId") ?? "",
            source: (payloadString(envelope, "source") as any) ?? "world",
            nowMs,
          });
        } else if (operation === "plant") {
          authorityResult = plantHarthmereCropV1(authority, {
            plotId: payloadString(envelope, "plotId") ?? envelope.requestId,
            seedItemId: payloadString(envelope, "seedItemId") ?? "",
            nowMs,
          });
        } else if (operation === "water") {
          authorityResult = waterHarthmereCropV1(authority, {
            plotId: payloadString(envelope, "plotId") ?? "",
            nowMs,
          });
        } else if (operation === "harvest") {
          authorityResult = harvestHarthmereCropV1(authority, {
            plotId: payloadString(envelope, "plotId") ?? "",
            nowMs,
          });
        } else if (operation === "forage_food") {
          const spawnId =
            payloadString(envelope, "spawnId") ?? envelope.targetId ?? "";
          if (!spawnId) {
            warnings.push("forage_rejected:missing_spawn");
            touchedModels.add("farming_rejection");
            break;
          }
          authority = liveFarmingAuthorityStateV1({
            [spawnId]: {
              spawnId,
              kind: "food",
              itemId: payloadString(envelope, "itemId") ?? "wild_berries",
              depletedAtMs: next.combat.lootClaims[spawnId],
            },
          });
          authorityResult = forageHarthmereFoodSpawnV1(authority, {
            spawnId,
            nowMs,
          });
          if (authorityResult.warnings.length === 0) {
            next.combat.lootClaims[spawnId] = nowMs;
            touchedModels.add("loot_claims");
          }
        } else if (operation === "hunt_animal") {
          const animalId =
            payloadString(envelope, "animalId") ?? envelope.targetId ?? "";
          const animal = animalId
            ? next.combat.entitySnapshots[animalId]
            : undefined;
          if (!animal) {
            warnings.push("hunt_rejected:target_state_not_authoritative");
            touchedModels.add("farming_rejection");
            break;
          }
          authority = liveFarmingAuthorityStateV1({
            [animalId]: {
              spawnId: animalId,
              kind: "animal",
              hp: animal.hp,
              maxHp: animal.maxHp,
              species: animal.species,
              protected: animal.protectedSpecies,
              isLivestock: animal.isLivestock,
              ownerId: animal.ownerId,
              depletedAtMs: next.combat.lootClaims[animalId],
            },
          });
          authorityResult = huntHarthmereAnimalForFoodV1(authority, {
            animalId,
            nowMs,
          });
          if (authorityResult.warnings.length === 0) {
            next.combat.lootClaims[animalId] = nowMs;
            touchedModels.add("loot_claims");
          }
        } else if (operation === "cook_food") {
          authorityResult = cookHarthmereFoodV1(authority, {
            recipeId: payloadString(envelope, "recipeId"),
            rawItemId: payloadString(envelope, "rawItemId") ?? "",
            stationKind: payloadString(envelope, "stationKind") as any,
            count: payloadNumber(envelope, "count"),
            nowMs,
          });
        } else if (operation === "eat_food") {
          authorityResult = eatHarthmereFoodV1(authority, {
            itemId: payloadString(envelope, "itemId") ?? "",
            nowMs,
          });
        } else if (operation === "feed_livestock") {
          authorityResult = feedHarthmereLivestockV1(authority, {
            livestockId: payloadString(envelope, "livestockId") ?? "",
            feedItemId: payloadString(envelope, "feedItemId") ?? "",
            nowMs,
          });
        } else if (operation === "collect_livestock_product") {
          authorityResult = collectHarthmereLivestockProductV1(authority, {
            livestockId: payloadString(envelope, "livestockId") ?? "",
            nowMs,
          });
        } else {
          warnings.push("farming_rejected:unsupported_operation");
          touchedModels.add("farming_rejection");
          break;
        }

        warnings.push(...authorityResult.warnings);
        if (authorityResult.warnings.length > 0) {
          touchedModels.add("farming_rejection");
          break;
        }
        applyLiveFarmingAuthorityResultV1(authorityResult.state);
        for (const [plotId, plot] of Object.entries(
          authorityResult.state.plots
        )) {
          if (plot.harvestedAtMs) {
            next.farming.harvests[plotId] = plot.harvestedAtMs;
          }
        }
        if (Object.keys(authorityResult.inventoryDeltas).length > 0) {
          touchedModels.add("inventory_items");
        }
        if (
          operation === "harvest" ||
          operation === "plant" ||
          operation === "water"
        ) {
          upsertSkill(
            next.classMagic.skills,
            "farming",
            operation === "harvest" ? 30 : 8
          );
          touchedModels.add("skill_xp");
        }
        if (operation === "forage_food") {
          upsertSkill(next.classMagic.skills, "farming", 8);
          touchedModels.add("skill_xp");
        }
        if (operation === "hunt_animal") {
          upsertSkill(next.classMagic.skills, "tracking", 16);
          touchedModels.add("skill_xp");
        }
        if (operation === "cook_food" || operation === "eat_food") {
          const recipe =
            operation === "cook_food"
              ? HARTHMERE_COOKING_RECIPES_V1[
                  payloadString(envelope, "recipeId") ??
                    (payloadString(envelope, "rawItemId") === "raw_meat"
                      ? "grilled_meat"
                      : "")
                ]
              : undefined;
          const cookCount = Math.max(
            1,
            Math.trunc(payloadNumber(envelope, "count") ?? 1)
          );
          upsertSkill(
            next.classMagic.skills,
            "cooking",
            (recipe?.xp ?? 10) * cookCount
          );
          touchedModels.add("skill_xp");
        }
        break;
      }
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
    case "request_medical_action": {
      const operation =
        payloadString(envelope, "operation") ?? "use_medical_item";
      const authority = liveMedicalAuthorityStateV1();
      let authorityResult:
        | ReturnType<typeof useHarthmereMedicalItemV1>
        | ReturnType<typeof receiveHarthmereDoctorTreatmentV1>
        | undefined;

      if (operation === "use_medical_item" || operation === "use_item") {
        authorityResult = useHarthmereMedicalItemV1(authority, {
          itemId: payloadString(envelope, "itemId") ?? "",
          nowMs,
        });
      } else if (
        operation === "doctor_treatment" ||
        operation === "request_doctor_treatment"
      ) {
        authorityResult = receiveHarthmereDoctorTreatmentV1(authority, {
          businessId: payloadString(envelope, "businessId") ?? "",
          costGold: payloadNumber(envelope, "costGold"),
          nowMs,
        });
      } else {
        warnings.push("medical_rejected:unsupported_operation");
        touchedModels.add("medical_rejection");
        break;
      }

      warnings.push(...authorityResult.warnings);
      if (authorityResult.warnings.length > 0) {
        touchedModels.add("medical_rejection");
        break;
      }

      applyLiveMedicalAuthorityResultV1(authorityResult.state);
      if (authorityResult.goldDelta !== 0) {
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: `medical_${operation}`,
          amount: authorityResult.goldDelta,
          atMs: nowMs,
        });
        touchedModels.add("economy_ledger");
      }
      if (authorityResult.healthDelta > 0) {
        upsertSkill(
          next.classMagic.skills,
          "medicine",
          operation.includes("doctor") ? 18 : 8
        );
        touchedModels.add("skill_xp");
      }
      break;
    }
    case "request_care_loop_action": {
      const operation = payloadString(envelope, "operation") as
        | HarthmereCareLoopKindV1
        | undefined;
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
      next.inventory.gold = Math.max(
        0,
        next.inventory.gold + careResult.goldDelta
      );
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
        respawnAvailableAtMs:
          nowMs +
          Math.max(0, payloadNumber(envelope, "respawnDelayMs") ?? 5_000),
      };
      touchedModels.add("death_record");
      break;
    case "request_revive":
      if (
        next.combat.deathState !== "dead" &&
        next.combat.deathState !== "downed"
      ) {
        warnings.push("revive_rejected:not_dead_or_downed");
        touchedModels.add("revive_rejection");
        break;
      }
      next.combat.deathState = "alive";
      next.combat.hp = Math.max(1, Math.floor(next.combat.maxHp * 0.25));
      restoreCombatResourcesV1(next, 0.25);
      next.combat.respawnProtectionUntilMs =
        nowMs +
        Math.max(1_000, payloadNumber(envelope, "protectionMs") ?? 10_000);
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
      next.combat.respawnProtectionUntilMs =
        nowMs +
        Math.max(1_000, payloadNumber(envelope, "protectionMs") ?? 10_000);
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
      const highestThreat = Object.entries(next.combat.threat).sort(
        (a, b) => b[1] - a[1]
      )[0];
      const npcSnapshot = next.combat.entitySnapshots[npcId];
      const recentAttackerId =
        npcSnapshot?.retaliatesWhenAttacked === false
          ? undefined
          : npcSnapshot?.lastAttackerId;
      const hasStoredEntityThreat =
        npcSnapshot &&
        npcSnapshot.retaliatesWhenAttacked !== false &&
        npcSnapshot.isAlive &&
        npcSnapshot.isAttackable &&
        (next.combat.threat[npcId] ?? 0) > 0 &&
        npcSnapshot.lastAttackerId;
      const targetIdFromStoredEntityThreat = hasStoredEntityThreat
        ? npcSnapshot?.lastAttackerId
        : undefined;
      const targetIdFromActorThreat =
        npcSnapshot && highestThreat?.[0] === next.actorId
          ? next.actorId
          : undefined;
      const storedThreatTargetId = npcSnapshot
        ? targetIdFromStoredEntityThreat ?? targetIdFromActorThreat
        : highestThreat?.[0];
      const recentAttackerStillRelevant =
        Boolean(recentAttackerId) &&
        Boolean(npcSnapshot?.isAlive) &&
        Boolean(npcSnapshot?.isAttackable) &&
        nowMs - Number(npcSnapshot?.lastAttackedAtMs ?? 0) <= 60_000;
      let decision =
        npcSnapshot && !npcSnapshot.isAlive
          ? "dead"
          : recentAttackerStillRelevant
          ? "retaliate_to_recent_attacker"
          : storedThreatTargetId
          ? "engage_highest_threat"
          : "idle_patrol";
      let targetId = recentAttackerStillRelevant
        ? recentAttackerId
        : storedThreatTargetId;
      if (recentAttackerStillRelevant && recentAttackerId) {
        next.combat.threat[recentAttackerId] = Math.max(
          next.combat.threat[recentAttackerId] ?? 0,
          Math.max(1, Math.trunc(npcSnapshot?.lastDamageTaken ?? 1))
        );
      }
      if (decision === "idle_patrol" && npcSnapshot?.isAlive) {
        const npcPosition = liveModePositionObjectToTupleV1(
          npcSnapshot.position
        );
        const actorWorldPosition = actorWorldPositionFromAuthorityV1(envelope);
        const actorPosition =
          liveModePositionObjectToTupleV1(actorWorldPosition);
        const safeZone =
          isLiveEntityRobotProtectedPositionV1(next, npcPosition) ||
          isLiveEntityRobotProtectedPositionV1(next, actorPosition) ||
          isHarthmereLiveModeTownSafePositionV1(actorWorldPosition);
        const aggression = evaluateMuckMonsterAggressionV1({
          monsterId: npcId,
          monsterName:
            payloadString(envelope, "npcName") ??
            payloadString(envelope, "entityLabel") ??
            npcId,
          monsterPosition: npcPosition,
          playerId: envelope.actorId,
          playerPosition: actorPosition,
          nowMs,
          monsterHpPercent:
            npcSnapshot.maxHp > 0
              ? npcSnapshot.hp / npcSnapshot.maxHp
              : undefined,
          safeZone,
          spawnProtected: (next.combat.respawnProtectionUntilMs ?? 0) > nowMs,
          lineOfSight:
            payloadString(envelope, "lineOfSight") === "false" ? false : true,
        });
        if (aggression.aggressive) {
          decision = `muck_unprovoked:${
            aggression.decision?.selectedActionId ?? "engage"
          }`;
          targetId = envelope.actorId;
          next.combat.threat[envelope.actorId] = Math.max(
            next.combat.threat[envelope.actorId] ?? 0,
            1
          );
        }
      }
      const playerTargetBlockReason =
        npcSnapshot && targetId === next.actorId
          ? liveEntityAiPlayerTargetBlockReasonV1({
              npcId,
              npcSnapshot,
              playerPosition: actorWorldPositionFromAuthorityV1(envelope),
            })
          : undefined;
      if (playerTargetBlockReason) {
        targetId = undefined;
        decision =
          decision === "dead"
            ? decision
            : `idle_patrol:${playerTargetBlockReason}`;
        delete next.combat.threat[next.actorId];
        if (
          playerTargetBlockReason === "safe_zone" ||
          playerTargetBlockReason === "target_out_of_chase_range"
        ) {
          delete next.combat.threat[npcId];
          if (npcSnapshot?.lastAttackerId === next.actorId) {
            delete npcSnapshot.lastAttackerId;
            delete npcSnapshot.lastAttackedAtMs;
            delete npcSnapshot.lastDamageTaken;
          }
        }
      }
      const thinkIntervalMs = Math.max(
        500,
        payloadNumber(envelope, "thinkIntervalMs") ?? 2_000
      );
      const movement = npcSnapshot
        ? applyLiveEntityAiMovementV1({
            entityId: npcId,
            target: npcSnapshot,
            decision,
            targetId,
            thinkIntervalMs,
          })
        : undefined;
      const attack = applyLiveEntityAiPlayerAttackV1({
        npcId,
        npcSnapshot,
        targetId,
      });
      const attackSummary = playerTargetBlockReason
        ? {
            attackBlockedReason: playerTargetBlockReason,
            playerHpBefore: next.combat.hp,
            playerHpAfter: next.combat.hp,
            playerDeathState: next.combat.deathState ?? "alive",
          }
        : attack;
      next.combat.npcAiTicks[npcId] = {
        tickId: envelope.requestId,
        atMs: nowMs,
        decision,
        targetId,
        entityKind: movement?.entityKind,
        movementMode: movement?.movementMode,
        positionFrom: movement?.positionFrom,
        positionTo: movement?.positionTo,
        velocity: movement?.velocity,
        facingYaw: movement?.facingYaw,
        navigationResolution: movement?.navigationResolution,
        navigationBlocked: movement?.navigationBlocked,
        animationState: movement?.animationState,
        animationMoving: movement?.animationMoving,
        playerDamage: attackSummary?.playerDamage,
        playerHpBefore: attackSummary?.playerHpBefore,
        playerHpAfter: attackSummary?.playerHpAfter,
        playerDeathState: attackSummary?.playerDeathState,
        attackBlockedReason: attackSummary?.attackBlockedReason,
        nextThinkAtMs: nowMs + thinkIntervalMs,
      };
      touchedModels.add(envelope.subsystem);
      touchedModels.add("npc_ai_state");
      if (movement) {
        touchedModels.add("live_entity_movement");
        touchedModels.add("live_entity_animation");
      }
      if (npcId)
        sharedStateKeys.add(harthmereLiveModeSharedStateKeyV1("npc_ai", npcId));
      break;
    }
    case "request_boss_tick": {
      const bossId =
        envelope.encounterId ??
        envelope.targetId ??
        payloadString(envelope, "bossId");
      if (!bossId) {
        warnings.push("boss_tick_rejected:missing_boss_id");
        touchedModels.add("boss_rejection");
        break;
      }
      const previous = next.combat.bossTicks[bossId];
      const bossSnapshot = envelope.targetId
        ? next.combat.entitySnapshots[envelope.targetId]
        : undefined;
      const hpRatio =
        bossSnapshot && bossSnapshot.maxHp > 0
          ? bossSnapshot.hp / bossSnapshot.maxHp
          : 1;
      const enrageLevel = Math.min(
        10,
        (previous?.enrageLevel ?? 0) + (hpRatio <= 0.25 ? 1 : 0)
      );
      const phase =
        hpRatio <= 0.25 ? "enraged" : hpRatio <= 0.5 ? "phase_2" : "phase_1";
      next.combat.bossTicks[bossId] = {
        tickId: envelope.requestId,
        atMs: nowMs,
        phase,
        enrageLevel,
        nextMechanicAtMs:
          nowMs +
          Math.max(
            1_000,
            payloadNumber(envelope, "mechanicIntervalMs") ?? 8_000
          ),
      };
      touchedModels.add(envelope.subsystem);
      touchedModels.add("boss_encounter_state");
      sharedStateKeys.add(
        harthmereLiveModeSharedStateKeyV1("boss_encounter", bossId)
      );
      break;
    }
    case "request_party_raid_credit": {
      if (!envelope.partyId && !envelope.raidId) {
        warnings.push("party_raid_credit_rejected:missing_group_id");
        touchedModels.add("party_raid_rejection");
        break;
      }
      const contribution = Math.max(
        0,
        Math.min(1, payloadNumber(envelope, "contributionScore") ?? 0)
      );
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
        lockedOutUntilMs: envelope.raidId
          ? nowMs +
            Math.max(60_000, payloadNumber(envelope, "lockoutMs") ?? 86_400_000)
          : undefined,
      };
      touchedModels.add(envelope.subsystem);
      touchedModels.add("party_raid_credit");
      if (envelope.partyId)
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("party", envelope.partyId)
        );
      if (envelope.raidId)
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKeyV1("raid", envelope.raidId)
        );
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
