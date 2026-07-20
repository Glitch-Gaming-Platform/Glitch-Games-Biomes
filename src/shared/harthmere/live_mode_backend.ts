import type {
  HarthmereLiveModeActionKind,
  HarthmereLiveModeAnySubsystem,
  HarthmereLiveModeAuthorityEnvelope,
} from "./live_mode_readiness";
import { fallDamageForBlocks } from "@/shared/game/fall_damage";
import { anItem } from "@/shared/game/item";
import { BikkieIds } from "@/shared/bikkie/ids";
import { safeParseBiomesId } from "@/shared/ids";
import { nativeBiomesEcsAuthorityEnabled } from "./native_road_ahead_contract";
import {
  harthmereGatheringAuthorityNode,
  resolveHarthmereGatheringAuthorityAttempt,
} from "./gathering_node_authority";
import {
  reduceHarthmereInventoryMutation,
  applyHarthmereInventoryMutationResult,
  getHarthmereItemDefinition,
  getHarthmereCraftingRecipe,
  getHarthmereCraftingStation,
  getHarthmereCraftingTool,
  harthmereCleanupToolGate,
  harthmereRepairToolGate,
  normalizeHarthmereCraftingStationId,
  registerHarthmereItemDefinition,
  type HarthmereCraftingOutcome,
  type HarthmereCraftingRecipe,
  type HarthmereItemDefinition,
  type HarthmereInventorySnapshot,
  type HarthmereInventoryMutationRequest,
  type HarthmereInventoryMutationResult,
} from "./mmo_inventory_authority";
import {
  HARTHMERE_CRAFTING_STATION_RECIPE_IDS,
  HARTHMERE_HOME_DECORATION_RECIPE_IDS,
  ensureHarthmereProductionCraftingCatalogue,
} from "./mmo_crafting_catalogue";
import { ensureHarthmereProductionVendorCatalog } from "./harthmere_vendor_catalog";
import {
  defaultHarthmereHomeDecorationState,
  getHarthmereHomeDecorationDefinition,
  normalizeHarthmereHomeDecorationState,
  reduceHarthmereHomeDecorationMutation,
  type HarthmereHomeDecorationOperation,
  type HarthmereHomeDecorationState,
} from "./home_decoration_authority";
import {
  defaultHarthmerePlaceableWorldState,
  getHarthmerePlaceableDecorSpec,
  normalizeHarthmerePlaceableWorldState,
  reduceHarthmerePlaceableWorldMutation,
  type HarthmerePlaceableWorldOperation,
  type HarthmerePlaceableWorldState,
} from "./mmo_placeable_decor_catalogue";
import {
  reduceHarthmereCombatAction,
  computeHarthmereXpReward,
  getHarthmereAbility,
  getHarthmereClassDefinition,
  HARTHMERE_SERVER_LOS_MAX_DISTANCE,
  harthmereServerCheckLineOfSight,
  registerHarthmereAbility,
  registerHarthmereClassDefinition,
  type HarthmereCombatActorSnapshot,
  type HarthmereCombatTargetSnapshot,
  type HarthmereZoneSnapshot,
  type HarthmereCombatActionRequest,
  type HarthmereResourceKind,
} from "./mmo_combat_authority";
import {
  harthmereMainHandWeaponType,
  harthmereOffHandWeaponType,
} from "./harthmere_equipped_weapon_type";
import {
  reduceHarthmereAuctionMutation,
  type HarthmereAuctionListing,
  type HarthmereAuctionMutationRequest,
} from "./mmo_auction_authority";
import {
  validateHarthmereBuildingPlacement,
  validateHarthmerePlotClaim,
  type HarthmereBuildingPlacementContext,
  type HarthmereBuildingPlacementRequest,
} from "./mmo_building_authority";
import {
  createHarthmereLiveModeGuildClientSnapshot,
  defaultHarthmereLiveModeGuildState,
  hasHarthmereGuildPermission,
  linkHarthmereGuildHallProperty,
  normalizeHarthmereLiveModeGuildState,
  reduceHarthmereGuildMutation,
  type HarthmereLiveModeGuildState,
} from "./mmo_guild_authority";
import {
  HARTHMERE_ECONOMY_BASE_SALES_TAX_RATE,
  HARTHMERE_ECONOMY_BUSINESS_TYPES,
  HARTHMERE_ECONOMY_DEFAULT_REGION_ID,
  HARTHMERE_ECONOMY_DEFAULT_TOWN_ID,
  createHarthmereProductionEconomyClientSnapshot,
  defaultHarthmereProductionEconomyState,
  normalizeHarthmereProductionEconomyState,
  reduceHarthmereEconomyMutation,
  type HarthmereEconomyBusinessRecord,
  type HarthmereEconomyBusinessTypeId,
  type HarthmereEconomyInventoryRecord,
  type HarthmereProductionEconomyState,
} from "./mmo_economy_authority";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_MARKER_ID,
  createHarthmereJobsBoardClientSnapshotAtTime,
  defaultHarthmereJobsBoardState,
  normalizeHarthmereJobsBoardState,
  reduceHarthmereJobsBoardMutation,
  type HarthmereEscortCompanion,
  type HarthmereJobsBoardPosting,
  type HarthmereJobsBoardState,
} from "./mmo_jobs_board_authority";
import { isKnownHarthmereJobsBoardExecutableItemId } from "./jobs_board_business_templates";
import { SNAPSHOT_GROVE_QUESTS } from "./snapshot_grove_content";
import {
  snapshotGroveCollectEventMatchesObjective,
  snapshotGroveInventoryEventMatchesObjective,
  snapshotGroveItemUseEventMatchesObjective,
  snapshotGroveTutorialInventoryGrantsForQuest,
} from "./snapshot_grove_trigger_contract";
// HARTHMERE_BIBLE_QUEST_WIRING (bible-wiring fix, 2026-07-14): the seam that
// makes the 85-quest bible catalog (Q1–Q12 dragon arc + side quests) playable
// through live mode, and drives the Thaedryn encounter. See the header of
// bible_quest_live_authority.ts for the full design rationale.
import {
  HARTHMERE_BIBLE_QUEST_OPERATION_PREFIX,
  HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID,
  defaultHarthmereBibleQuestLiveSlice,
  harthmereBibleRewardItemDefinition,
  harthmereBibleObjectiveItemDefinition,
  harthmereThaedrynCombatSnapshot,
  harthmereThaedrynDamageEventsForAttack,
  normalizeHarthmereBibleQuestLiveSlice,
  reduceHarthmereBibleQuestOperation,
  type HarthmereBibleQuestRewardInstructions,
} from "./bible_quest_live_authority";
import { applyThaedrynBossEvent } from "./thaedryn_boss";
import { harthmereJobsBoardQuestMarkerRuntimePositionForTodo } from "./jobs_board_quest_marker_positions";
import {
  harthmereJobMarkerPlan,
  type HarthmereJobProgress,
} from "./harthmere_job_objective";
import {
  HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS,
  defaultHarthmereExoticMatterDepositState,
  harthmereExoticMatterAcceptedJobDepositMarkers,
  harthmereExoticMatterDepositById,
  isHarthmereExoticMatterMaterialItemId,
  mineHarthmereExoticMatterDeposit,
  replenishHarthmereExoticMatterDeposits,
} from "./exotic_matter_caves";
import { resolveHarthmereProductionMarkerPosition } from "./production_terrain_placement_map";
import {
  HARTHMERE_COOKING_RECIPES,
  HARTHMERE_FOOD_DEFINITIONS,
  HARTHMERE_HALF_DAY_MS,
  HARTHMERE_SEED_DEFINITIONS,
  collectHarthmereLivestockProduct,
  cookHarthmereFood,
  cancelHarthmereCook,
  collectHarthmereCook,
  defaultHarthmereFoodStaminaState,
  eatHarthmereFood,
  enqueueHarthmereCook,
  feedHarthmereLivestock,
  forageHarthmereFoodSpawn,
  gatherHarthmereSeed,
  harvestHarthmereCrop,
  huntHarthmereAnimalForFood,
  plantHarthmereCrop,
  tickHarthmereCooking,
  tickHarthmereStaminaForGameplay,
  waterHarthmereCrop,
  type HarthmereCookingStationState,
  type HarthmereFarmingPlot,
  type HarthmereFoodStaminaState,
  type HarthmereLivestock,
  type HarthmereWorldSpawn,
} from "./mmo_farming_food_stamina";
import {
  HARTHMERE_CARRY_WEIGHT_LIMIT,
  harthmereInventoryCarryWeight,
  harthmereItemUnitWeight,
  isLikelyBankingMaterialItemId,
  itemCategoryFromDefinition,
} from "./mmo_carry_weight";
export {
  HARTHMERE_CARRY_WEIGHT_LIMIT,
  harthmereInventoryCarryWeight,
  harthmereItemUnitWeight,
} from "./mmo_carry_weight";
import {
  defaultHarthmereMedicalHealthState,
  receiveHarthmereDoctorTreatment,
  useHarthmereMedicalItem,
  type HarthmereDoctorServiceSnapshot,
} from "./mmo_medical_health";
import {
  HARTHMERE_INVENTORY_LOOT_DEFAULT_DROP_TTL_MS,
  createHarthmereDebitedWorldDrop,
  createHarthmereEmptyInventoryLootState,
  createHarthmereInventoryLootActor,
  createHarthmereInventoryLootClientSnapshot,
  normalizeHarthmereInventoryLootState,
  reduceHarthmereInventoryLootMutation,
  type HarthmereInventoryLootItemDefinition,
  type HarthmereInventoryLootDrop,
  type HarthmereInventoryLootItemInstance,
  type HarthmereInventoryLootState,
} from "./mmo_inventory_loot_authority";
import {
  applyHarthmereClassChoice,
  applyHarthmereSpecializationChoice,
  canLearnHarthmereAbility,
  createHarthmereProgressionClientSnapshot,
  defaultHarthmereProgressionCollectionsState,
  HARTHMERE_COLLECTIBLE_DEFINITIONS,
  HARTHMERE_ABILITY_DEFINITIONS,
  HARTHMERE_CLASS_DEFINITIONS,
  HARTHMERE_SKILL_DEFINITIONS,
  harthmereSkillLevelFromTotalXp,
  harthmereSkillProgressFromTotalXp,
  harthmereSkillTotalXpCap,
  knownHarthmereAbilityIds,
  normalizeHarthmereProgressionCollectionsState,
  type HarthmereProgressionCollectionsState,
} from "./mmo_class_ability_collectibles";
import { HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS } from "./combat_reach";
import {
  createHarthmereCareLoopClientSnapshot,
  defaultHarthmereCareLoopState,
  normalizeHarthmereCareLoopState,
  reduceHarthmereCareLoop,
  type HarthmereCareLoopClientSnapshot,
  type HarthmereCareLoopKind,
  type HarthmereCareLoopState,
} from "./mmo_care_loops";

import {
  LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID,
  canCompleteLiveEntityHelperQuest,
  getLiveEntityHelperQuestForEntity,
  isLiveEntityHelperMuckBossSpawnMarker,
  liveEntityHelperQuestDeltas,
  liveEntityHelperQuestItemCopyForId,
  liveEntityHelperQuestTargetMarkerForKind,
  type LiveEntityHelperQuestEntityContext,
  type LiveEntityHelperQuestInstance,
} from "./live_entity_helper_quests";
import {
  createHarthmereNpcNavigationState,
  resolveHarthmereNpcNavigationStep,
  type HarthmereNpcNavigationMode,
  type HarthmereNpcNavigationObstacle,
  type HarthmereNpcNavigationState,
} from "./npc_navigation_guard";
import {
  LIVE_ENTITY_ROBOT_RECHARGE_AMOUNT,
  LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID,
  LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY,
  LIVE_ENTITY_ROBOT_RECHARGE_REWARD_ITEMS,
  LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP,
  LIVE_ENTITY_ROBOT_PROTECTION_AREAS,
  createLiveEntityRobotEnergyState,
  liveEntityRobotProtectionAreaForPosition,
  liveEntityRobotProtectionBuildingMarker,
  normalizeLiveEntityRobotEnergyState,
  rechargeLiveEntityRobotEnergy,
  tickLiveEntityRobotEnergy,
  type LiveEntityRobotEnergyState,
} from "./live_entity_robot_energy_protection";
import {
  evaluateMuckMonsterAggression,
  muckMonsterAreaForPosition,
} from "./muck_monster_aggression_ai";
import {
  harthmereCombatAttackDamageForLiveEntitySeed,
  harthmereCombatHpForLiveEntitySeed,
  harthmereGroundedLivestockSeedsInTerritory,
  harthmereGroundedMuckMonsterSeedsInTerritory,
} from "./live_entity_production_seed";

import {
  buildingSystemBlueprintById,
  buildingSystemBlueprintByItemId,
  buildingSystemBlueprintByStructureType,
  BUILDING_SYSTEM_ABANDON_AFTER_UNPAID_TAX_MS,
  BUILDING_SYSTEM_CONSTRUCTION_STAGES,
  BUILDING_SYSTEM_MATERIAL_CATALOG,
  BUILDING_SYSTEM_PLOTS,
  BUILDING_SYSTEM_MIRA_INTRO_QUEST,
  buildingSystemCanActorAccessProperty,
  buildingSystemDefaultOrigin,
  buildingSystemDemolitionRefundGold,
  buildingSystemPlotBoundsOverlap,
  buildingSystemPlotById,
  buildingSystemRemainingMaterialItemDeltas,
  buildingSystemRepairCostGold,
  buildingSystemUpgradeCostGold,
  createBuildingSystemDefaultPermissions,
  createBuildingSystemDemolitionMaterializationPlan,
  createBuildingSystemDoorLock,
  createBuildingSystemHomeConsoleMarker,
  createBuildingSystemMiraMapMarker,
  createBuildingSystemMuckAreaPlotDefinition,
  createBuildingSystemPlacementPreview,
  createBuildingSystemRepairDamageMaterializationPlan,
  createBuildingSystemRepairRestoreMaterializationPlan,
  createBuildingSystemStorageContainer,
  createBuildingSystemUpgradeMaterializationPlan,
  createBuildingSystemBusinessRecord,
  runBuildingSystemBusinessRevenueCycle,
  buildingSystemBusinessTypeById,
  createBuildingSystemMaterializationPlan,
  buildingSystemPlotBoundsById,
  isPositionInsideBuildingSystemPlotBounds,
  createBuildingSystemPlacementContext,
  createBuildingSystemPropertyRecord,
  createBuildingSystemMuckClaimMaterializationPlan,
  createBuildingSystemSafeGroundMaterializationPlan,
  createBuildingSystemStageMaterializationPlan,
  buildingSystemHomeConsoleMarkerId,
  ensureBuildingSystemStructureDefinitions,
  normalizeBuildingSystemPropertyRecord,
  applyBuildingSystemPropertyLifecycle,
  toHarthmerePlotDefinition,
  type BuildingSystemAccessMode,
  type BuildingSystemAnyMaterializationPlan,
  type BuildingSystemBusinessRecord,
  type BuildingSystemBusinessType,
  type BuildingSystemDoorLockRecord,
  type BuildingSystemInWorldMarker,
  type BuildingSystemMaterialRequirementLine,
  type BuildingSystemPlotDefinition,
  type BuildingSystemStorageContainerRecord,
  type BuildingSystemPermissionKey,
  type BuildingSystemPermissionSubject,
  type BuildingSystemProjectRecord,
  type BuildingSystemPropertyRecord,
  type BuildingSystemStage,
} from "./building_system";
import {
  createHarthmereBusinessOutpostRebuildMaterializationPlans,
  getHarthmereBusinessMiniGameDefinition,
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS,
  HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION,
  HARTHMERE_BUSINESS_OUTPOSTS,
  harthmereBusinessOutpostBusinessId,
  isPointInsideHarthmereBusinessSafeSite,
} from "./business_customer_simulator";

export const HARTHMERE_LIVE_MODE_BACKEND_VERSION =
  "harthmere-live-mode-backend";

export const HARTHMERE_READ_JOBS_BOARD_QUEST_ID = "read-the-jobs-board";
export const HARTHMERE_READ_JOBS_BOARD_STEP_ID =
  "read_harthmere_grove_jobs_board";

export const HARTHMERE_LIVE_MODE_BACKEND_SAFETY_CAP = 250;

export const HARTHMERE_PERSONAL_BANK_BASE_SLOTS = 24;
export const HARTHMERE_ACCOUNT_BANK_BASE_SLOTS = 16;
export const HARTHMERE_MATERIAL_STORAGE_BASE_SLOTS = 32;
export const HARTHMERE_BANK_SLOT_UPGRADE_SIZE = 4;
export const HARTHMERE_BANK_MAX_SLOTS = 120;
export const HARTHMERE_LOAN_MAX_PRINCIPAL = 250;
export const HARTHMERE_LOAN_DAILY_INTEREST_RATE = 0.015;
export const HARTHMERE_LOAN_DAY_MS = 24 * 60 * 60 * 1000;
export const HARTHMERE_LOAN_LATE_INTEREST_MULTIPLIER = 2;
export const HARTHMERE_LOAN_DEFAULT_PENALTY_RATE = 0.2;
export const HARTHMERE_BANK_CREDIT_HOLD_FLAG = "bank_credit_hold";

function harthmereBusinessOutpostStarterInventory(
  typeId: HarthmereEconomyBusinessTypeId
): HarthmereEconomyInventoryRecord {
  const definition = getHarthmereBusinessMiniGameDefinition(typeId);
  const counts = new Map<string, number>();
  for (const offer of definition.offers.slice(0, 4)) {
    for (const [itemId, count] of Object.entries(offer.requiredItems)) {
      counts.set(itemId, Math.max(counts.get(itemId) ?? 0, Number(count) * 6));
    }
    for (const [itemId, count] of Object.entries(offer.producedItems ?? {})) {
      counts.set(itemId, Math.max(counts.get(itemId) ?? 0, Number(count) * 4));
    }
  }
  return Object.fromEntries(
    [...counts.entries()]
      .slice(0, 8)
      .map(([itemId, count]) => [
        itemId,
        { itemId, count: Math.max(1, Math.floor(count)) },
      ])
  );
}

export function ensureHarthmereBusinessOutpostEconomyRecords(
  economy: HarthmereProductionEconomyState,
  nowMs: number
) {
  for (const record of Object.values(
    HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS
  )) {
    const outpost = HARTHMERE_BUSINESS_OUTPOSTS.find(
      (entry) => entry.outpostId === record.outpostId
    );
    const ownerId = outpost?.ownerNpcId ?? `${record.outpostId}:npc_owner`;
    const townId = outpost?.townId ?? HARTHMERE_ECONOMY_DEFAULT_TOWN_ID;
    const regionId = outpost?.regionId ?? HARTHMERE_ECONOMY_DEFAULT_REGION_ID;
    const businessId = harthmereBusinessOutpostBusinessId(record.outpostId);
    const existing = economy.businesses[businessId];
    if (existing) {
      existing.status = existing.status === "draft" ? "open" : existing.status;
      existing.propertyId ??= record.plot.plotId;
      existing.townId ??= townId;
      existing.regionId ||= regionId;
      existing.flags = {
        ...(existing.flags ?? {}),
        canonical_outpost_business: true,
        [`outpost:${record.outpostId}`]: true,
      };
      if (!Object.keys(existing.inventory ?? {}).length) {
        existing.inventory = harthmereBusinessOutpostStarterInventory(
          existing.typeId
        );
      }
      continue;
    }
    const businessType = HARTHMERE_ECONOMY_BUSINESS_TYPES[record.businessType];
    economy.businesses[businessId] = {
      businessId,
      ownerKind: "npc",
      ownerId,
      typeId: record.businessType,
      name: record.displayName,
      status: "open",
      licenseClass: businessType.requiredLicense,
      licenseLevel: Math.max(1, businessType.minimumLicenseLevel),
      propertyId: record.plot.plotId,
      townId,
      regionId,
      inventory: harthmereBusinessOutpostStarterInventory(record.businessType),
      storageMaxSlots: Math.max(24, businessType.baseStorageSlots),
      employees: [],
      activeContracts: [],
      completedContracts: 0,
      reputation: 65,
      customerSatisfaction: 76,
      sanitationRating: 82,
      safetyRating: 84,
      serviceRadius: 36,
      priceModifiers: {},
      balanceGold: 500,
      debtGold: 0,
      upkeepGoldPerDay: businessType.baseUpkeepGoldPerDay,
      rentGoldPerDay: 0,
      wageGoldPerDay: 0,
      salesTaxRate: HARTHMERE_ECONOMY_BASE_SALES_TAX_RATE,
      lastTickAtMs: nowMs,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
      flags: {
        canonical_outpost_business: true,
        [`outpost:${record.outpostId}`]: true,
      },
    } satisfies HarthmereEconomyBusinessRecord;
  }
  return economy;
}

export type HarthmereLiveEntityKind =
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

export type HarthmereLiveEntityAnimationState =
  | "idle"
  | "walk"
  | "run"
  | "flee"
  | "attack"
  | "hit"
  | "death";

export type HarthmereLiveEntityCombatProtection =
  | "protected_species"
  | "livestock"
  | "owned_pet"
  | "friendly_noncombatant"
  | "label_or_place"
  | "immobile_object";

export const HARTHMERE_SERVER_MUCK_COMBAT_ENTITY_SEED_VERSION =
  "harthmere-server-muck-combat-entity-seed" as const;

export const HARTHMERE_MUCK_HEX_STRENGTH_MULTIPLIER = 5 as const;
const HARTHMERE_LIVE_ENTITY_DEFEAT_POSITION_LIFT = 2.0;
const HARTHMERE_LIVE_ENTITY_LOOT_DROP_POSITION_LIFT = 1.2;
const HARTHMERE_LIVE_ENTITY_RETALIATION_CHASE_RANGE = 80;

type HarthmereLiveCombatEntitySnapshot =
  HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string];

function positionObjectFromVec3(position: readonly number[]) {
  return {
    x: Number(position[0]),
    y: Number(position[1]),
    z: Number(position[2]),
  };
}

function resolveLiveEntityProductionSeedPosition(
  seed: {
    seedId: string;
    position: readonly number[];
  },
  source: "live_muck_monster" | "live_livestock"
) {
  return resolveHarthmereProductionMarkerPosition({
    source,
    markerId: seed.seedId,
    fallback: [seed.position[0], seed.position[1], seed.position[2]] as [
      number,
      number,
      number
    ],
  });
}

function boostedMuckHexHp(baseHp: number, entityKind: "mux" | "hex") {
  return Math.max(
    1,
    Math.trunc(
      baseHp *
        (entityKind === "mux" || entityKind === "hex"
          ? HARTHMERE_MUCK_HEX_STRENGTH_MULTIPLIER
          : 1)
    )
  );
}

function boostedMuckHexAttackDamage(input: {
  entityKind: "mux" | "hex";
  combatLevel?: number;
}) {
  const level = Math.max(1, Math.trunc(Number(input.combatLevel ?? 1)));
  const base =
    input.entityKind === "hex" ? (level >= 4 ? 24 : 18) : level >= 3 ? 16 : 14;
  return Math.max(1, Math.trunc(base * HARTHMERE_MUCK_HEX_STRENGTH_MULTIPLIER));
}

function liveEntityLiftedPosition(
  position: { x: number; y: number; z: number },
  lift: number
) {
  return {
    x: Number(position.x),
    y: Number(position.y) + lift,
    z: Number(position.z),
  };
}

function liveEntitySafeRestingBasePosition(
  target: HarthmereLiveCombatEntitySnapshot
) {
  const current = target.position;
  const home = target.homePosition ?? current;
  const highestGroundY = Math.max(
    Number.isFinite(Number(current?.y)) ? Number(current.y) : -Infinity,
    Number.isFinite(Number(home?.y)) ? Number(home.y) : -Infinity,
    0
  );
  return {
    x: Number(current?.x ?? home?.x ?? 0),
    y: highestGroundY,
    z: Number(current?.z ?? home?.z ?? 0),
  };
}

function liveEntityDefeatRestingPosition(
  target: HarthmereLiveCombatEntitySnapshot
) {
  return liveEntityLiftedPosition(
    liveEntitySafeRestingBasePosition(target),
    HARTHMERE_LIVE_ENTITY_DEFEAT_POSITION_LIFT
  );
}

function liveEntityLootDropPosition(target: HarthmereLiveCombatEntitySnapshot) {
  return liveEntityLiftedPosition(
    liveEntitySafeRestingBasePosition(target),
    HARTHMERE_LIVE_ENTITY_LOOT_DROP_POSITION_LIFT
  );
}

export function createHarthmereServerMuckCombatEntitySnapshots(
  nowMs: number
): HarthmereLiveModeBackendState["combat"]["entitySnapshots"] {
  // Use the SAME grounded/redistributed positions as the seeded ECS entities so
  // the combat AI never tracks a hostile somewhere a player won't see one (and
  // never inside the Grove safe zone).
  const monsterEntries = harthmereGroundedMuckMonsterSeedsInTerritory().flatMap(
    (seed) => {
      const territory = muckMonsterAreaForPosition(seed.position, 1.5);
      if (!territory) {
        return [];
      }
      const entityKind = seed.combatKind ?? "mux";
      const hp = harthmereCombatHpForLiveEntitySeed(seed);
      const position = positionObjectFromVec3(
        resolveLiveEntityProductionSeedPosition(seed, "live_muck_monster")
      );
      return [
        [
          `server-muck-combat:${seed.seedId}:${seed.idOffset}`,
          {
            hp,
            maxHp: hp,
            position,
            homePosition: position,
            isHostile: true,
            isAlive: true,
            isAttackable: true,
            level: Math.max(1, Math.trunc(seed.combatLevel ?? 2)),
            entityKind,
            movementSpeed: entityKind === "hex" ? 3.4 : 3.1,
            bodyRadius: entityKind === "hex" ? 0.75 : 0.9,
            patrolRadius: 8,
            aggroRange: entityKind === "hex" ? 12 : 10.5,
            leashRange: 34,
            requiresLineOfSight: true,
            aiEnabled: true,
            retaliatesWhenAttacked: true,
            animationState: "idle",
            animationStartedAtMs: nowMs,
            animationMoving: false,
            facingYaw: Number(seed.orientation[1] ?? 0),
            resources: entityKind === "hex" ? { mana: 60 } : undefined,
            maxResources: entityKind === "hex" ? { mana: 60 } : undefined,
            attackRange: entityKind === "hex" ? 6.5 : 2.4,
            attackDamage: harthmereCombatAttackDamageForLiveEntitySeed(seed),
          } satisfies HarthmereLiveCombatEntitySnapshot,
        ],
      ];
    }
  );

  // Wildlife (cows, sheep, rabbits): passive but attackable. Not hostile (no
  // unprovoked aggression — see the idle-patrol gate below), but
  // `retaliatesWhenAttacked`, so they ignore players until struck and then fight
  // back. Explicit `lootDrops` give meat on defeat, scaled by size: larger
  // animals carry more HP and drop more meat. Body size also scales with tier so
  // a rabbit isn't a cow-sized hitbox.
  const livestockBodyRadius = (tier: string | undefined) =>
    tier === "large" ? 1 : tier === "medium" ? 0.7 : 0.45;
  const livestockMovementSpeed = (tier: string | undefined) =>
    tier === "small" ? 3.2 : tier === "medium" ? 2.5 : 2;
  const livestockEntries = harthmereGroundedLivestockSeedsInTerritory().flatMap(
    (seed) => {
      if (!muckMonsterAreaForPosition(seed.position, 1.5)) {
        return [];
      }
      const hp = harthmereCombatHpForLiveEntitySeed(seed);
      const meatUnits = Math.max(1, Math.trunc(seed.meatUnits ?? 1));
      const position = positionObjectFromVec3(
        resolveLiveEntityProductionSeedPosition(seed, "live_livestock")
      );
      return [
        [
          `server-muck-combat:${seed.seedId}:${seed.idOffset}`,
          {
            hp,
            maxHp: hp,
            position,
            homePosition: position,
            isHostile: false,
            isAlive: true,
            isAttackable: true,
            isLivestock: false,
            species: seed.species ?? "cow",
            level: Math.max(1, Math.trunc(seed.combatLevel ?? 1)),
            entityKind: "animal",
            movementSpeed: livestockMovementSpeed(seed.sizeTier),
            bodyRadius: livestockBodyRadius(seed.sizeTier),
            patrolRadius: 6,
            aggroRange: 0,
            leashRange: 16,
            requiresLineOfSight: true,
            aiEnabled: true,
            retaliatesWhenAttacked: true,
            // Hunting any of them yields meat; larger animals drop more.
            lootDrops: { raw_meat: meatUnits },
            // Size-scaled flat hit + kill XP (cow > sheep > rabbit).
            attackDamage: harthmereCombatAttackDamageForLiveEntitySeed(seed),
            killXp: seed.killXp,
            animationState: "idle",
            animationStartedAtMs: nowMs,
            animationMoving: false,
            facingYaw: Number(seed.orientation[1] ?? 0),
            attackRange: 2,
          } satisfies HarthmereLiveCombatEntitySnapshot,
        ],
      ];
    }
  );

  return Object.fromEntries([...monsterEntries, ...livestockEntries]);
}

function cloneHarthmereLiveCombatPosition(
  position: HarthmereLiveCombatEntitySnapshot["position"] | undefined
) {
  if (!position) {
    return undefined;
  }
  return {
    x: Number(position.x),
    y: Number(position.y),
    z: Number(position.z),
  };
}

export function harthmereNormalizeSeededCombatEntitySnapshots(
  entitySnapshots: HarthmereLiveModeBackendState["combat"]["entitySnapshots"],
  nowMs: number
): void {
  const canonicalSnapshots =
    createHarthmereServerMuckCombatEntitySnapshots(nowMs);
  for (const [entityId, canonical] of Object.entries(canonicalSnapshots)) {
    const existing = entitySnapshots[entityId];
    if (!existing) {
      entitySnapshots[entityId] = {
        ...canonical,
        position:
          cloneHarthmereLiveCombatPosition(canonical.position) ??
          canonical.position,
        homePosition: cloneHarthmereLiveCombatPosition(canonical.homePosition),
      };
      continue;
    }

    const previousMaxHp = Math.max(
      1,
      Math.trunc(Number(existing.maxHp ?? canonical.maxHp ?? 1) || 1)
    );
    const previousHp = Math.max(
      0,
      Math.trunc(Number(existing.hp ?? previousMaxHp) || 0)
    );
    const nextMaxHp = Math.max(
      1,
      Math.trunc(Number(canonical.maxHp ?? previousMaxHp) || previousMaxHp)
    );
    const defeated = existing.isAlive === false || previousHp <= 0;
    const nextHp = defeated
      ? 0
      : Math.max(
          1,
          Math.min(
            nextMaxHp,
            Math.round((previousHp / previousMaxHp) * nextMaxHp)
          )
        );
    const position =
      cloneHarthmereLiveCombatPosition(existing.position) ??
      cloneHarthmereLiveCombatPosition(canonical.position) ??
      canonical.position;
    const homePosition =
      cloneHarthmereLiveCombatPosition(canonical.homePosition) ??
      cloneHarthmereLiveCombatPosition(existing.homePosition);

    entitySnapshots[entityId] = {
      ...canonical,
      position,
      homePosition,
      hp: nextHp,
      maxHp: nextMaxHp,
      isAlive: !defeated,
      isAttackable: defeated ? false : canonical.isAttackable !== false,
      defeatedAtMs: defeated ? existing.defeatedAtMs : undefined,
      killedByActorId: defeated ? existing.killedByActorId : undefined,
      lastAttackerId: existing.lastAttackerId,
      lastAttackedAtMs: existing.lastAttackedAtMs,
      lastDamageTaken: existing.lastDamageTaken,
      lootDropId: defeated ? existing.lootDropId : undefined,
      animationState: existing.animationState ?? canonical.animationState,
      animationStartedAtMs:
        existing.animationStartedAtMs ?? canonical.animationStartedAtMs,
      animationMoving: existing.animationMoving ?? canonical.animationMoving,
      facingYaw: existing.facingYaw ?? canonical.facingYaw,
    };
  }
}

// Seeded muck wildlife (muckers, hexers, cattle) respawn after being hunted.
// Defeat is recorded on the entity snapshot (`defeatedAtMs`); once the respawn
// delay elapses we restore the entity to full health at its home. This is
// deterministic from `defeatedAtMs` + `nowMs`, so it works whether or not the
// caller persists the revived state.
export const HARTHMERE_SERVER_MUCK_COMBAT_RESPAWN_MS = 60 * 60 * 1000;

export function harthmereReviveDefeatedSeededCombatEntities(
  entitySnapshots: HarthmereLiveModeBackendState["combat"]["entitySnapshots"],
  nowMs: number,
  lootClaims?: HarthmereLiveModeBackendState["combat"]["lootClaims"]
): void {
  for (const [entityId, entity] of Object.entries(entitySnapshots)) {
    if (!entityId.startsWith("server-muck-combat:")) {
      continue;
    }
    if (entity.isAlive || !entity.defeatedAtMs) {
      continue;
    }
    if (nowMs - entity.defeatedAtMs < HARTHMERE_SERVER_MUCK_COMBAT_RESPAWN_MS) {
      continue;
    }
    entity.hp = entity.maxHp;
    entity.isAlive = true;
    entity.isAttackable = true;
    entity.defeatedAtMs = undefined;
    entity.killedByActorId = undefined;
    entity.lastAttackerId = undefined;
    entity.lastAttackedAtMs = undefined;
    entity.lastDamageTaken = undefined;
    const lootDropId = entity.lootDropId;
    entity.lootDropId = undefined;
    delete lootClaims?.[entityId];
    if (lootDropId) {
      delete lootClaims?.[lootDropId];
    }
    if (entity.homePosition) {
      entity.position = { ...entity.homePosition };
    }
  }
}

export type HarthmereBankingVaultKind = "personal" | "account" | "materials";
export type HarthmereBankingLoanStatus = "active" | "paid" | "defaulted";

export interface HarthmereBankingTransactionLog {
  id: string;
  actorId: string;
  kind: string;
  vault: HarthmereBankingVaultKind | "loan";
  itemId?: string;
  count?: number;
  goldDelta?: number;
  loanId?: string;
  atMs: number;
  balanceAfter?: number;
}

export interface HarthmereBankingLoan {
  loanId: string;
  actorId: string;
  principalOriginal: number;
  principalRemaining: number;
  interestPaid: number;
  dailyInterestRate: number;
  openedAtMs: number;
  dueAtMs: number;
  status: HarthmereBankingLoanStatus;
  lastPaymentAtMs?: number;
  defaultedAtMs?: number;
  defaultPenaltyGold?: number;
  penaltyPaid?: number;
  creditPenaltyApplied?: boolean;
}

export interface HarthmereLiveModeReputationStanding {
  likeability: number;
  legal: number;
  notoriety: number;
  notorietyFloor: number;
}

export interface HarthmereLiveModeReputationEvent {
  id: string;
  atMs: number;
  scopeId: string;
  witnessLevel: string;
  likeabilityDelta: number;
  legalDelta: number;
  notorietyDelta: number;
  reason?: string;
}

export type HarthmereLiveModeCrimeKind =
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

export type HarthmereLiveModeGuardResponseLevel =
  | "warning"
  | "questioning"
  | "fine"
  | "confiscation"
  | "arrest_attempt"
  | "combat"
  | "reinforcements"
  | "city_lockdown";

export interface HarthmereLiveModeCrimeRecord {
  id: string;
  actorId: string;
  kind: HarthmereLiveModeCrimeKind;
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
  response: HarthmereLiveModeGuardResponseLevel;
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
    | "wanted"
    | "served";
  createdAtMs: number;
}

export interface HarthmereLiveModeGuardResponseRecord {
  id: string;
  crimeId: string;
  actorId: string;
  zoneId: string;
  response: HarthmereLiveModeGuardResponseLevel;
  fineGold: number;
  confiscatedItemIds: string[];
  detentionUntilMs?: number;
  cityLockdown: boolean;
  createdAtMs: number;
}

export interface HarthmereLiveModeRestrictedTrespassRecord {
  actorId: string;
  zoneId: string;
  areaId: string;
  enteredAtMs: number;
  lastCrimeId?: string;
  lastEscalatedAtMs?: number;
}

export interface HarthmereLiveModeBankingState {
  accountBank: Record<string, number>;
  materialStorage: Record<string, number>;
  personalBankMaxSlots: number;
  accountBankMaxSlots: number;
  materialStorageMaxSlots: number;
  transactionLogs: HarthmereBankingTransactionLog[];
  loans: Record<string, HarthmereBankingLoan>;
  nextLoanNumber: number;
}

export type HarthmereLiveModeCraftingJobStatus =
  | "active"
  | "completed"
  | "cancelled"
  | "failed";

export interface HarthmereLiveModeCraftingJob {
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
  status: HarthmereLiveModeCraftingJobStatus;
  reservedItemDeltas: Record<string, number>;
  reservedMaterialStorageDeltas: Record<string, number>;
  reservedGoldDelta: number;
  outcome?: HarthmereCraftingOutcome;
}

export interface HarthmereLiveModeCraftingState {
  activeJobs: Record<string, HarthmereLiveModeCraftingJob>;
  history: HarthmereLiveModeCraftingJob[];
  nextJobNumber: number;
  /** Count-inventory bridge for crafting tool wear until durable item instances are authoritative everywhere. */
  toolDurability: Record<string, number>;
  /** Count-inventory bridge for repair/upgrade/enchant workflows until item instances back every crafted item. */
  itemDurability: Record<string, number>;
}

export interface HarthmereQuestInviteRecord {
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

export interface HarthmereSharedQuestPartyRecord {
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

export interface HarthmereLiveModeQuestInviteState {
  invites: Record<string, HarthmereQuestInviteRecord>;
  sharedQuests: Record<string, HarthmereSharedQuestPartyRecord>;
}

/** A completed auction sale's proceeds, queued for the seller to collect on next sync. */
export interface HarthmereAuctionSellerPayout {
  listingId: string;
  /** Net gold owed to the seller (sale price minus house tax). */
  goldNet: number;
  /** The sold item — removed from the seller's escrow + inventory when collected. */
  itemId: string;
  count: number;
  soldAtMs: number;
}

export interface HarthmereLiveModeBackendState {
  version: typeof HARTHMERE_LIVE_MODE_BACKEND_VERSION;
  actorId: string;
  updatedAtMs: number;
  inventory: {
    items: Record<string, number>;
    bank: Record<string, number>;
    equipment: Record<string, string>;
    equipmentInstances: Record<string, string>;
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
    auctionListings: Record<string, HarthmereAuctionListing>;
    /** Tax collected this session for the economy sink */
    houseTaxAccumulated: number;
    /** Property-hosted businesses that earn recurring revenue from town needs. */
    businesses: Record<string, BuildingSystemBusinessRecord>;
    businessRevenueAccumulated: number;
    /** Production-ready society economy: business ownership, contracts, town demand, staff, loans, insurance, markets. */
    production: HarthmereProductionEconomyState;
    /** Cross-actor auction sale proceeds owed to sellers (sellerId -> queued payouts).
     *  The buyer queues these on settle; the seller drains them on their next sync. */
    auctionSellerPayouts: Record<string, HarthmereAuctionSellerPayout[]>;
    /** Auction payout listingIds this actor has already collected — makes payout delivery
     *  exactly-once even though the shared blob is last-write-wins and can re-deliver. */
    claimedAuctionPayoutIds: Record<string, number>;
  };
  /** Physical Grove jobs board: public work postings, accepted seeker todos, anti-abuse state. */
  jobsBoard: HarthmereJobsBoardState;
  /** Production MMO inventory/loot authority: item instances, loot drops, legal flags, business stock, job escrow, guild loot. */
  inventoryLoot: HarthmereInventoryLootState;
  /** Server-owned timed crafting jobs and rich crafting outcome history. */
  crafting: HarthmereLiveModeCraftingState;
  /** Server-owned home and business decoration placements with functional effects. */
  homeDecoration: HarthmereHomeDecorationState;
  /** Free-world placeable objects (custom builds/decor placed anywhere on the
   *  terrain, no property-ownership gate). */
  placeableWorld: HarthmerePlaceableWorldState;
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
        ownerActorId?: string;
      }
    >;
    ownedPlots: string[];
    /** Shared ownership ledger; `ownedPlots` is this actor's read projection. */
    plotOwners: Record<string, string>;
    /** Server-generated muck-area claims. These make buildable land unbounded by the authored demo plots. */
    customPlots: Record<string, BuildingSystemPlotDefinition>;
    safeZones: Record<
      string,
      { safeFromMuck: boolean; activatedAtMs: number; area: string }
    >;
    /** Authoritative active/finished construction projects; local UI state is not truth. */
    activeProjects: Record<string, BuildingSystemProjectRecord>;
    /** In-world plot/deed/map/NPC marker records created by server-approved building actions. */
    inWorldMarkers: Record<string, BuildingSystemInWorldMarker>;
    materializationPlans: Record<string, BuildingSystemAnyMaterializationPlan>;
    storageContainers: Record<string, BuildingSystemStorageContainerRecord>;
    doorLocks: Record<string, BuildingSystemDoorLockRecord>;
    // Tracks which revision of the business-outpost voxel plans has been
    // applied to the world. When this doesn't match
    // HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION the server auto-queues
    // a cleanup+rebuild on the next read_state so buildings always match the
    // current code without requiring an admin tool call.
    outpostBuildRevision?: string;
  };
  /** Robot power state that controls whether remote Muck edges stay protected. */
  robotProtection: LiveEntityRobotEnergyState;
  guild: HarthmereLiveModeGuildState;
  banking: HarthmereLiveModeBankingState;
  law: {
    reputation: Record<string, number>;
    standing: Record<string, HarthmereLiveModeReputationStanding>;
    recentReputationEvents: HarthmereLiveModeReputationEvent[];
    fines: Record<string, number>;
    flags: Record<string, boolean>;
    crimeLog: Array<{ id: string; kind: string; atMs: number; zoneId: string }>;
    crimeRecords: HarthmereLiveModeCrimeRecord[];
    guardResponses: HarthmereLiveModeGuardResponseRecord[];
    restrictedTrespass: Record<
      string,
      HarthmereLiveModeRestrictedTrespassRecord
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
  collections: HarthmereProgressionCollectionsState;
  quests: {
    active: Record<
      string,
      {
        stepId?: string;
        progress: number;
        source?: string;
        title?: string;
        questKind?: string;
        entityId?: string;
        giverName?: string;
        giverPosition?: [number, number, number];
      }
    >;
    completed: Record<string, number>;
    /**
     * HARTHMERE_BIBLE_QUEST_WIRING (bible-wiring fix, 2026-07-14): the
     * per-player runtime for the 85-quest bible catalog (records, reward
     * ledger, flags/titles, and the Thaedryn encounter machine). Absent in
     * pre-fix blobs — normalizeHarthmereBibleQuestLiveSlice fills defaults.
     */
    bible: ReturnType<typeof defaultHarthmereBibleQuestLiveSlice>;
  };
  questInvites: HarthmereLiveModeQuestInviteState;
  property: {
    owned: Record<string, BuildingSystemPropertyRecord>;
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
    livestock: Record<string, HarthmereLivestock>;
    cooking: Record<string, HarthmereCookingStationState>;
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
  careLoops: HarthmereCareLoopState;
  combat: {
    hp: number;
    maxHp: number;
    resources: Partial<Record<HarthmereResourceKind, number>>;
    maxResources: Partial<Record<HarthmereResourceKind, number>>;
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
        zonePvPRule?: HarthmereZoneSnapshot["pvpRule"];
        isLivestock?: boolean;
        protectedSpecies?: boolean;
        ownerId?: string;
        species?: string;
        level?: number;
        entityKind?: HarthmereLiveEntityKind;
        homePosition?: { x: number; y: number; z: number };
        movementSpeed?: number;
        bodyRadius?: number;
        patrolRadius?: number;
        aggroRange?: number;
        leashRange?: number;
        requiresLineOfSight?: boolean;
        aiEnabled?: boolean;
        navigationObstacles?: HarthmereNpcNavigationObstacle[];
        animationState?: HarthmereLiveEntityAnimationState;
        animationStartedAtMs?: number;
        animationMoving?: boolean;
        facingYaw?: number;
        resources?: Partial<Record<HarthmereResourceKind, number>>;
        maxResources?: Partial<Record<HarthmereResourceKind, number>>;
        cooldowns?: Record<string, number>;
        attackRange?: number;
        combatProtection?: HarthmereLiveEntityCombatProtection;
        retaliatesWhenAttacked?: boolean;
        lastAttackerId?: string;
        lastAttackedAtMs?: number;
        lastDamageTaken?: number;
        lastAiAttackAtMs?: number;
        lastAiAttackDamage?: number;
        lastAiAttackTargetId?: string;
        lastAiAttackResourceKind?: HarthmereResourceKind;
        lastAiAttackResourceAfter?: number;
        killedByActorId?: string;
        defeatedAtMs?: number;
        lootDrops?: Record<string, number>;
        lootOwnerActorIds?: string[];
        lootDropId?: string;
        /** Flat per-hit damage for ambient wildlife (overrides the level formula). */
        attackDamage?: number;
        /** Flat kill XP for ambient wildlife (overrides the ability xp). */
        killXp?: number;
        escortJobId?: string;
        escortActorId?: string;
        escortCompanionId?: string;
        escortDisplayName?: string;
        escortDestination?: { x: number; y: number; z: number };
        escortDestinationTargetId?: string;
        escortDestinationMarkerId?: string;
        escortStatus?: HarthmereEscortCompanion["status"];
      }
    >;
    npcAiTicks: Record<
      string,
      {
        tickId: string;
        atMs: number;
        decision: string;
        targetId?: string;
        entityKind?: HarthmereLiveEntityKind;
        movementMode?: HarthmereNpcNavigationMode;
        positionFrom?: { x: number; y: number; z: number };
        positionTo?: { x: number; y: number; z: number };
        velocity?: { x: number; y: number; z: number };
        facingYaw?: number;
        navigationResolution?: "direct" | "slide" | "sidestep" | "hold";
        navigationBlocked?: boolean;
        animationState?: HarthmereLiveEntityAnimationState;
        animationMoving?: boolean;
        playerDamage?: number;
        playerHpBefore?: number;
        playerHpAfter?: number;
        playerDeathState?: "alive" | "downed" | "dead";
        attackBlockedReason?: string;
        nextThinkAtMs: number;
      }
    >;
    liveEntityNavigation: Record<string, HarthmereNpcNavigationState>;
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

export const HARTHMERE_LIVE_MODE_SHARED_WORLD_ID = "harthmere" as const;

export interface HarthmereLiveModeSharedLawState {
  reputation: Record<string, number>;
  standing: Record<string, HarthmereLiveModeReputationStanding>;
  recentReputationEvents: HarthmereLiveModeReputationEvent[];
  fines: Record<string, number>;
  flags: Record<string, boolean>;
  crimeLog: Array<{ id: string; kind: string; atMs: number; zoneId: string }>;
  crimeRecords: HarthmereLiveModeCrimeRecord[];
  guardResponses: HarthmereLiveModeGuardResponseRecord[];
  restrictedTrespass: Record<string, HarthmereLiveModeRestrictedTrespassRecord>;
  detentionUntilMs: Record<string, number>;
}

export interface HarthmereLiveModeSharedWorldState {
  version: typeof HARTHMERE_LIVE_MODE_BACKEND_VERSION;
  /**
   * Version 2 makes properties, decorations, placeables, and positioned drops
   * authoritative in this record. Older records are merged once for migration;
   * version-2 records replace actor copies so deleted world objects stay gone.
   */
  sharedAuthoritySchemaVersion: number;
  worldId: typeof HARTHMERE_LIVE_MODE_SHARED_WORLD_ID;
  updatedAtMs: number;
  economyProduction: HarthmereProductionEconomyState;
  jobsBoard: HarthmereJobsBoardState;
  /**
   * Durable source metadata for positioned rewards. In native mode the client
   * never claims this compatibility projection: the API materializes exact
   * item ids as ECS GrabBags and the normal inventory/firehose path owns pickup.
   */
  inventoryLootWorld: HarthmereLiveModeSharedInventoryLootWorldState;
  building: HarthmereLiveModeSharedBuildingState;
  /** Property decorations are physical world state, not private actor UI state. */
  homeDecoration: HarthmereHomeDecorationState;
  /** Free-world placeables must be visible and collide consistently for everyone. */
  placeableWorld: HarthmerePlaceableWorldState;
  law: HarthmereLiveModeSharedLawState;
  guild: HarthmereLiveModeGuildState;
  robotProtection: LiveEntityRobotEnergyState;
  exoticMatterDepositClaims: Record<string, number>;
  // (foraging fix F-E, 2026-07-14): wild forage-bush / hunted-animal depletion
  // claims (keyed `wild_spawn:<id>` -> claimedAtMs). Shared across all actors so
  // the same bush/animal is not an independent per-account scratch-off; expires
  // via the 12h respawn window on read (see wildSpawnActiveClaimAtMs).
  wildSpawnClaims: Record<string, number>;
  /** Absolute respawn timestamps for server-authored gathering nodes. */
  gatheringNodeRespawnAtMs: Record<string, number>;
  questInvites: HarthmereLiveModeQuestInviteState;
  /** Shared auction marketplace so a buyer can see and settle another player's listing. */
  auctionListings: Record<string, HarthmereAuctionListing>;
  /** Sale proceeds owed to sellers (sellerId -> queued payouts), collected on the seller's sync. */
  auctionSellerPayouts: Record<string, HarthmereAuctionSellerPayout[]>;
}

export interface HarthmereLiveModeSharedInventoryLootWorldState {
  lootDrops: Record<string, HarthmereInventoryLootDrop>;
  dropItemInstances: Record<string, HarthmereInventoryLootItemInstance>;
  usedPickupTokens: Record<string, number>;
  nextDropNumber: number;
  nextInstanceNumber: number;
}

export interface HarthmereLiveModeSharedBuildingState {
  placedStructures: HarthmereLiveModeBackendState["building"]["placedStructures"];
  customPlots: HarthmereLiveModeBackendState["building"]["customPlots"];
  safeZones: HarthmereLiveModeBackendState["building"]["safeZones"];
  inWorldMarkers: HarthmereLiveModeBackendState["building"]["inWorldMarkers"];
  materializationPlans: HarthmereLiveModeBackendState["building"]["materializationPlans"];
  storageContainers: HarthmereLiveModeBackendState["building"]["storageContainers"];
  doorLocks: HarthmereLiveModeBackendState["building"]["doorLocks"];
  /** A plot has exactly one owner across every actor and server replica. */
  plotOwners: Record<string, string>;
  /** Construction is world state; sharing it prevents overlapping projects. */
  activeProjects: HarthmereLiveModeBackendState["building"]["activeProjects"];
  /** Completed properties remain global so transfers are visible to the recipient. */
  propertyRecords: Record<string, BuildingSystemPropertyRecord>;
  propertyBuildingProgress: Record<string, number>;
}

function normalizeHarthmereLiveModeSharedInventoryLootWorldState(
  raw: unknown
): HarthmereLiveModeSharedInventoryLootWorldState {
  const value = raw && typeof raw === "object" ? (raw as any) : {};
  const normalized = normalizeHarthmereInventoryLootState({
    lootDrops: value.lootDrops,
    itemInstances: value.dropItemInstances,
    usedPickupTokens: value.usedPickupTokens,
    nextDropNumber: value.nextDropNumber,
    nextInstanceNumber: value.nextInstanceNumber,
  });
  return {
    lootDrops: normalized.lootDrops,
    dropItemInstances: Object.fromEntries(
      Object.entries(normalized.itemInstances).filter(
        ([, instance]) => instance.location === "loot_drop"
      )
    ),
    usedPickupTokens: normalized.usedPickupTokens,
    nextDropNumber: normalized.nextDropNumber,
    nextInstanceNumber: normalized.nextInstanceNumber,
  };
}

function normalizeHarthmereLiveModeSharedBuildingState(
  raw: unknown,
  nowMs: number
): HarthmereLiveModeSharedBuildingState {
  const value = raw && typeof raw === "object" ? (raw as any) : {};
  return {
    placedStructures: { ...(value.placedStructures ?? {}) },
    customPlots: { ...(value.customPlots ?? {}) },
    safeZones: { ...(value.safeZones ?? {}) },
    inWorldMarkers: publicSharedInWorldMarkers(value.inWorldMarkers ?? {}),
    materializationPlans: { ...(value.materializationPlans ?? {}) },
    storageContainers: { ...(value.storageContainers ?? {}) },
    doorLocks: { ...(value.doorLocks ?? {}) },
    plotOwners: { ...(value.plotOwners ?? {}) },
    activeProjects: { ...(value.activeProjects ?? {}) },
    propertyRecords: Object.fromEntries(
      Object.entries(
        (value.propertyRecords ?? {}) as Record<string, unknown>
      ).map(([propertyId, property]) => [
        propertyId,
        normalizeBuildingSystemPropertyRecord({
          propertyId,
          raw: property,
          ownerId: String((property as any)?.ownerId ?? ""),
          nowMs,
        }),
      ])
    ),
    propertyBuildingProgress: { ...(value.propertyBuildingProgress ?? {}) },
  };
}

function isHarthmereActorJobMarkerId(markerId: string) {
  return (
    markerId.startsWith("jobs_board_marker:") ||
    markerId.startsWith("jobs_board_exotic_deposit:")
  );
}

function jobsBoardTodoIdFromActorMarker(markerId: string) {
  if (markerId.startsWith("jobs_board_marker:")) {
    return markerId.slice("jobs_board_marker:".length);
  }
  if (markerId.startsWith("jobs_board_exotic_deposit:")) {
    return markerId.slice("jobs_board_exotic_deposit:".length).split(":")[0];
  }
  return undefined;
}

function harthmereJobsBoardTodoIsClaimable(
  state: HarthmereLiveModeBackendState,
  todo: HarthmereLiveModeBackendState["jobsBoard"]["todos"][string]
) {
  return (
    todo.status === "completed" &&
    state.jobsBoard.postings[todo.jobId]?.status === "active"
  );
}

function harthmereJobsBoardTodoIsActiveOrClaimable(
  state: HarthmereLiveModeBackendState,
  todo: HarthmereLiveModeBackendState["jobsBoard"]["todos"][string]
) {
  return (
    todo.status === "active" || harthmereJobsBoardTodoIsClaimable(state, todo)
  );
}

function harthmereJobsBoardFirstRequirementCount(
  job: HarthmereJobsBoardPosting | undefined
) {
  const req = job?.requirements.find(
    (entry) => entry.itemId || entry.serviceKind || entry.targetId
  );
  return Math.max(1, Math.floor(Number(req?.count ?? req?.serviceUnits ?? 1)));
}

function harthmereJobsBoardCompletedTodoProgress(
  kind: string | undefined,
  job: HarthmereJobsBoardPosting | undefined
): HarthmereJobProgress {
  const completedCount = harthmereJobsBoardFirstRequirementCount(job);
  if (kind === "delivery") return { deliveredToRecipient: true };
  if (kind === "gather") return { gatheredCount: completedCount };
  if (kind === "cleanup") return { cleanedCount: completedCount };
  if (kind === "repair") return { repaired: true };
  if (kind === "escort") return { escortArrived: true };
  return { inventoryRequirementsSatisfied: true };
}

function harthmereJobsBoardFirstRequirementItemCount(
  job: HarthmereJobsBoardPosting | undefined,
  inventoryItems: Record<string, number> | undefined
) {
  const req = job?.requirements.find((entry) => entry.itemId);
  if (!req?.itemId) return undefined;
  return Math.max(0, Math.floor(Number(inventoryItems?.[req.itemId] ?? 0)));
}

function harthmereJobsBoardItemRequirementsSatisfied(
  job: HarthmereJobsBoardPosting | undefined,
  inventoryItems: Record<string, number> | undefined
) {
  const itemRequirements = (job?.requirements ?? []).filter(
    (entry) => entry.itemId
  );
  return (
    itemRequirements.length > 0 &&
    itemRequirements.every((req) => {
      const needed = Math.max(1, Math.floor(Number(req.count ?? 1)));
      return (
        Math.max(
          0,
          Math.floor(Number(inventoryItems?.[req.itemId ?? ""] ?? 0))
        ) >= needed
      );
    })
  );
}

function harthmereJobsBoardTodoProgress(
  state: HarthmereLiveModeBackendState,
  todo: HarthmereLiveModeBackendState["jobsBoard"]["todos"][string],
  job: HarthmereJobsBoardPosting | undefined
): HarthmereJobProgress {
  const kind = todo.kind ?? job?.kind;
  if (harthmereJobsBoardTodoIsClaimable(state, todo)) {
    return harthmereJobsBoardCompletedTodoProgress(kind, job);
  }
  const progress: HarthmereJobProgress = {};
  const itemCount = harthmereJobsBoardFirstRequirementItemCount(
    job,
    state.inventory.items
  );
  if (kind === "gather" && itemCount !== undefined) {
    progress.gatheredCount = itemCount;
  }
  if (kind === "delivery" && itemCount !== undefined) {
    progress.hasParcel = itemCount > 0;
  }
  if (kind === "escort" && job?.escortCompanion?.status === "arrived") {
    progress.escortArrived = true;
  }
  if (
    job?.requiresFieldWork === false &&
    harthmereJobsBoardItemRequirementsSatisfied(job, state.inventory.items)
  ) {
    progress.inventoryRequirementsSatisfied = true;
  }
  return progress;
}

function harthmereJobsBoardTodoFallbackPosition(
  state: HarthmereLiveModeBackendState,
  todo: HarthmereLiveModeBackendState["jobsBoard"]["todos"][string]
) {
  const board =
    state.jobsBoard.boards[todo.boardId] ??
    state.jobsBoard.boards[(state.jobsBoard as any).defaultBoardId] ??
    state.jobsBoard.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID];
  return board
    ? ([board.location.x, board.location.y + 1, board.location.z] as [
        number,
        number,
        number
      ])
    : ([501.99486179104775, 71, -132.00350672753194] as [
        number,
        number,
        number
      ]);
}

function harthmereJobsBoardTodoBoardMarkerId(
  state: HarthmereLiveModeBackendState,
  todo: HarthmereLiveModeBackendState["jobsBoard"]["todos"][string]
) {
  const board =
    state.jobsBoard.boards[todo.boardId] ??
    state.jobsBoard.boards[(state.jobsBoard as any).defaultBoardId] ??
    state.jobsBoard.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID];
  return (
    board?.markerId ??
    board?.location?.landmarkId ??
    HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_MARKER_ID
  );
}

function publicSharedInWorldMarkers(
  markers: HarthmereLiveModeBackendState["building"]["inWorldMarkers"]
) {
  return Object.fromEntries(
    Object.entries(markers).filter(
      ([markerId]) => !isHarthmereActorJobMarkerId(markerId)
    )
  );
}

function activeQuestEntriesForActor(state: HarthmereLiveModeBackendState) {
  return Object.fromEntries(
    Object.entries(state.quests.active).filter(([questId]) => {
      if (!questId.startsWith("jobs_board:")) return true;
      const todoId = questId.slice("jobs_board:".length);
      const todo = state.jobsBoard.todos[todoId];
      return (
        todo?.actorId === state.actorId &&
        harthmereJobsBoardTodoIsActiveOrClaimable(state, todo)
      );
    })
  );
}

function inWorldMarkersForActor(state: HarthmereLiveModeBackendState) {
  return Object.fromEntries(
    Object.entries(state.building.inWorldMarkers).filter(([markerId]) => {
      const todoId = jobsBoardTodoIdFromActorMarker(markerId);
      if (!todoId) return true;
      const todo = state.jobsBoard.todos[todoId];
      return (
        todo?.actorId === state.actorId &&
        harthmereJobsBoardTodoIsActiveOrClaimable(state, todo)
      );
    })
  );
}

function cleanQuestInviteText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 160)
    : fallback;
}

function cleanQuestInviteId(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 160)
    : undefined;
}

function normalizeQuestInviteVec3(
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

function uniqueQuestInviteActorIds(values: unknown) {
  if (!Array.isArray(values)) return [];
  return [
    ...new Set(
      values
        .map((value) => cleanQuestInviteId(value))
        .filter((value): value is string => Boolean(value))
    ),
  ].slice(0, 24);
}

function normalizeHarthmereQuestInviteState(
  raw: unknown,
  nowMs: number
): HarthmereLiveModeQuestInviteState {
  const value = raw && typeof raw === "object" ? (raw as any) : {};
  const invites: Record<string, HarthmereQuestInviteRecord> = {};
  for (const [key, rawInvite] of Object.entries(
    (value.invites ?? {}) as Record<string, unknown>
  )) {
    if (!rawInvite || typeof rawInvite !== "object") continue;
    const invite = rawInvite as any;
    const inviteId = cleanQuestInviteId(invite.inviteId) ?? key;
    const questId = cleanQuestInviteId(invite.questId);
    const inviterActorId = cleanQuestInviteId(invite.inviterActorId);
    const inviteeActorId = cleanQuestInviteId(invite.inviteeActorId);
    if (!inviteId || !questId || !inviterActorId || !inviteeActorId) continue;
    if (invite.status && invite.status !== "pending") continue;
    invites[inviteId] = {
      inviteId,
      sharedQuestId:
        cleanQuestInviteId(invite.sharedQuestId) ??
        `shared_quest:${questId}:${inviterActorId}`,
      questId,
      questTitle: cleanQuestInviteText(invite.questTitle, questId),
      questArea: cleanQuestInviteText(invite.questArea, "Quest"),
      objectiveText: cleanQuestInviteText(
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
      firstMarkerId: cleanQuestInviteId(invite.firstMarkerId),
      markerWorldPosition: normalizeQuestInviteVec3(invite.markerWorldPosition),
    };
  }

  const sharedQuests: Record<string, HarthmereSharedQuestPartyRecord> = {};
  for (const [key, rawQuest] of Object.entries(
    (value.sharedQuests ?? {}) as Record<string, unknown>
  )) {
    if (!rawQuest || typeof rawQuest !== "object") continue;
    const quest = rawQuest as any;
    const sharedQuestId = cleanQuestInviteId(quest.sharedQuestId) ?? key;
    const questId = cleanQuestInviteId(quest.questId);
    if (!sharedQuestId || !questId) continue;
    const memberActorIds = uniqueQuestInviteActorIds(quest.memberActorIds);
    if (memberActorIds.length === 0) continue;
    sharedQuests[sharedQuestId] = {
      sharedQuestId,
      questId,
      questTitle: cleanQuestInviteText(quest.questTitle, questId),
      questArea: cleanQuestInviteText(quest.questArea, "Quest"),
      objectiveText: cleanQuestInviteText(
        quest.objectiveText,
        "Complete this quest together."
      ),
      reward:
        typeof quest.reward === "string" && quest.reward.trim()
          ? quest.reward.trim().slice(0, 160)
          : undefined,
      memberActorIds,
      inviteIds: uniqueQuestInviteActorIds(quest.inviteIds),
      createdAtMs: Math.max(
        0,
        Math.trunc(Number(quest.createdAtMs ?? nowMs) || nowMs)
      ),
      updatedAtMs: Math.max(
        0,
        Math.trunc(Number(quest.updatedAtMs ?? nowMs) || nowMs)
      ),
      firstMarkerId: cleanQuestInviteId(quest.firstMarkerId),
      markerWorldPosition: normalizeQuestInviteVec3(quest.markerWorldPosition),
    };
  }
  return { invites, sharedQuests };
}

function isHarthmereLiveModePublicLawFlag(flagId: string) {
  return (
    flagId === "city_lockdown" ||
    flagId.endsWith("_lockdown") ||
    flagId.startsWith("zone_lockdown:")
  );
}

function publicLawFlags(flags: Record<string, boolean>) {
  return Object.fromEntries(
    Object.entries(flags).filter(
      ([flagId, enabled]) => enabled && isHarthmereLiveModePublicLawFlag(flagId)
    )
  );
}

function mergeByIdNewestFirst<T extends { id: string }>(
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

export interface HarthmereLiveModeBackendMutationSummary {
  version: typeof HARTHMERE_LIVE_MODE_BACKEND_VERSION;
  applied: boolean;
  actionKind: HarthmereLiveModeActionKind;
  subsystem: HarthmereLiveModeAnySubsystem;
  actorId: string;
  targetId?: string;
  playerStateKey: string;
  sharedStateKeys: string[];
  warnings: string[];
  touchedModels: string[];
  buildingMaterializationPlans?: BuildingSystemAnyMaterializationPlan[];
  nativeEcsMaterializationPlans?: HarthmereNativeEcsMaterializationPlan[];
}

/**
 * Durable reducer output for physical items that must enter the world through
 * native ECS. Redis may still own cooldown/economy metadata, but it never adds
 * these stacks to a second player inventory.
 */
export interface HarthmereNativeEcsDropMaterializationPlan {
  kind: "drop";
  materializationKey: string;
  position: { x: number; y: number; z: number };
  itemStacks: Record<string, number>;
  ownerActorIds: string[];
  expiresAtMs: number;
  mined: boolean;
  sourceKind: string;
}

export type HarthmereNativeEcsMaterializationPlan =
  HarthmereNativeEcsDropMaterializationPlan;

function recordDelta(
  target: Record<string, number>,
  key: string,
  delta: number
) {
  const safeDelta = clampLiveModeMutationDelta(delta);
  target[key] = Math.max(0, (target[key] ?? 0) + safeDelta);
  if (target[key] === 0) {
    delete target[key];
  }
}

/**
 * Enforce a levied law fine: charge what the offender can pay from their wallet now and
 * carry only the unpayable remainder as outstanding law-fine debt. Returns the gold paid.
 */
function chargeEnforcedLawFine(
  state: HarthmereLiveModeBackendState,
  factionId: string,
  rawFine: number
): number {
  const fineOwed = Math.max(0, Math.trunc(rawFine));
  if (fineOwed <= 0) return 0;
  const paidNow = Math.min(Math.max(0, state.inventory.gold), fineOwed);
  state.inventory.gold = Math.max(0, state.inventory.gold - paidNow);
  const remainder = fineOwed - paidNow;
  if (remainder > 0) recordDelta(state.law.fines, factionId, remainder);
  return paidNow;
}

const HARTHMERE_LIVE_MODE_RESOURCE_KINDS: HarthmereResourceKind[] = [
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

function clampSignedReputation(value: number) {
  return Math.max(-10_000, Math.min(10_000, Math.round(Number(value) || 0)));
}

function clampNotoriety(value: number, floor = 0) {
  return Math.max(
    0,
    Math.max(Math.round(Number(value) || 0), Math.round(floor))
  );
}

function defaultReputationStanding(): HarthmereLiveModeReputationStanding {
  return { likeability: 0, legal: 0, notoriety: 0, notorietyFloor: 0 };
}

function normalizeReputationStanding(
  raw: Partial<HarthmereLiveModeReputationStanding> | undefined
): HarthmereLiveModeReputationStanding {
  const floor = Math.max(0, Math.round(Number(raw?.notorietyFloor) || 0));
  return {
    likeability: clampSignedReputation(raw?.likeability ?? 0),
    legal: clampSignedReputation(raw?.legal ?? 0),
    notoriety: clampNotoriety(raw?.notoriety ?? 0, floor),
    notorietyFloor: floor,
  };
}

function reputationWitnessMultiplier(value: string | undefined) {
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

function applyReputationStandingDelta(
  standing: HarthmereLiveModeReputationStanding,
  delta: {
    likeability?: number;
    legal?: number;
    notoriety?: number;
    notorietyFloor?: number;
  },
  multiplier: number
): HarthmereLiveModeReputationStanding {
  const floor = Math.max(
    0,
    Math.round(
      standing.notorietyFloor + (delta.notorietyFloor ?? 0) * multiplier
    )
  );
  return {
    likeability: clampSignedReputation(
      standing.likeability + (delta.likeability ?? 0) * multiplier
    ),
    legal: clampSignedReputation(
      standing.legal + (delta.legal ?? 0) * multiplier
    ),
    notoriety: clampNotoriety(
      standing.notoriety + (delta.notoriety ?? 0) * multiplier,
      floor
    ),
    notorietyFloor: floor,
  };
}

function normalizeHarthmereResourceKind(
  value: string | undefined
): HarthmereResourceKind {
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

function liveModeResourceMax(kind: HarthmereResourceKind, level: number) {
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

function defaultCombatResourcePools(level = 1) {
  const resources: Partial<Record<HarthmereResourceKind, number>> = {};
  const maxResources: Partial<Record<HarthmereResourceKind, number>> = {};
  for (const kind of HARTHMERE_LIVE_MODE_RESOURCE_KINDS) {
    const max = liveModeResourceMax(kind, level);
    maxResources[kind] = max;
    resources[kind] = max;
  }
  return { resources, maxResources };
}

function ensureCombatResourcePools(state: HarthmereLiveModeBackendState) {
  const level = state.classMagic.skills.character_level?.level ?? 1;
  state.combat.resources ??= {};
  state.combat.maxResources ??= {};
  for (const kind of HARTHMERE_LIVE_MODE_RESOURCE_KINDS) {
    const derivedMax = liveModeResourceMax(kind, level);
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

function restoreCombatResources(
  state: HarthmereLiveModeBackendState,
  ratio: number,
  nowMs?: number
) {
  const pools = ensureCombatResourcePools(state);
  for (const kind of HARTHMERE_LIVE_MODE_RESOURCE_KINDS) {
    const max = pools.maxResources[kind] ?? liveModeResourceMax(kind, 1);
    pools.resources[kind] = Math.max(0, Math.min(max, Math.round(max * ratio)));
  }
  if (Number.isFinite(nowMs)) {
    // Restoring stamina starts a fresh active-play drain window. Without this,
    // a respawn can immediately re-drain from the stale pre-death tick time.
    state.combat.lastStaminaTickMs = nowMs;
  }
}

let liveModeCombatCatalogueRegistered = false;
const HARTHMERE_LIVE_ENTITY_NPC_ATTACK_ABILITY_ID = "live_entity_npc_attack";

// (combat fix C-3, 2026-07-14): the SINGLE validated ceiling for how far any
// live NPC melee attack can reach. Previously this lived as a local magic
// constant inside the incoming-attack path, next to a second range check inside
// the combat authority — two overlapping clamps where only the buried constant
// stood between a stale/aggro-seeded `attackRange` and the "killed from ~34
// units away" bug. Hoisted to module scope and exported so there is exactly one
// number to reason about, and so snapshots can be clamped to it at seed/merge
// time as well (defence in depth). The largest legitimate reach (the Hex caster
// at 6.5, and the Q12 boss at 8) still fits at or under the ceiling.
export const HARTHMERE_MAX_NPC_ATTACK_RANGE_UNITS = 8;

/**
 * The one authoritative NPC melee reach for a snapshot: the snapshot's own
 * `attackRange` when finite, else the ability's range, always clamped to the
 * shared ceiling. Used by the incoming-attack range gate so no future snapshot
 * change can reopen the ranged-kill bug.
 */
function harthmereValidatedLiveEntityAttackReach(
  attackRange: number | undefined,
  abilityRangeUnits: number
): number {
  const raw = Number.isFinite(attackRange)
    ? Math.max(0, Number(attackRange))
    : abilityRangeUnits;
  return Math.min(raw, HARTHMERE_MAX_NPC_ATTACK_RANGE_UNITS);
}

function ensureHarthmereLiveModeCombatCatalogue() {
  if (liveModeCombatCatalogueRegistered) {
    return;
  }
  liveModeCombatCatalogueRegistered = true;

  for (const classDef of Object.values(HARTHMERE_CLASS_DEFINITIONS)) {
    if (getHarthmereClassDefinition(classDef.id)) {
      continue;
    }
    const resourceKind = normalizeHarthmereResourceKind(classDef.resource);
    registerHarthmereClassDefinition({
      classId: classDef.id,
      displayName: classDef.name,
      availableSpecializations: classDef.specializations,
      primaryResource: resourceKind,
      maxResourceByLevel: { 1: liveModeResourceMax(resourceKind, 1) },
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

  for (const ability of Object.values(HARTHMERE_ABILITY_DEFINITIONS)) {
    if (getHarthmereAbility(ability.id)) {
      continue;
    }
    const resourceKind = normalizeHarthmereResourceKind(ability.resource);
    const isSupport =
      /heal|rejuvenation|blessing|cleanse|shield|guard|block/i.test(
        `${ability.id} ${ability.name}`
      ) && ability.kind !== "business";
    const isOffensive = ability.kind === "combat" && !isSupport;
    registerHarthmereAbility({
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
      rangeUnits: isSupport
        ? 0
        : ability.kind === "combat"
        ? HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS
        : 4,
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

function ensureHarthmereLiveEntityNpcAttackAbility() {
  if (getHarthmereAbility(HARTHMERE_LIVE_ENTITY_NPC_ATTACK_ABILITY_ID)) {
    return;
  }
  registerHarthmereAbility({
    abilityId: HARTHMERE_LIVE_ENTITY_NPC_ATTACK_ABILITY_ID,
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

function abilityResourceKindForLiveMode(
  abilityId: string | undefined,
  classId: string | undefined
): HarthmereResourceKind {
  const registered = abilityId ? getHarthmereAbility(abilityId) : undefined;
  if (registered) {
    return registered.resourceKind;
  }
  const ability = abilityId
    ? HARTHMERE_ABILITY_DEFINITIONS[abilityId]
    : undefined;
  if (ability) {
    return normalizeHarthmereResourceKind(ability.resource);
  }
  const classDef = classId
    ? HARTHMERE_CLASS_DEFINITIONS[
        classId as keyof typeof HARTHMERE_CLASS_DEFINITIONS
      ]
    : undefined;
  return normalizeHarthmereResourceKind(classDef?.resource);
}

function splitCombatCooldowns(cooldowns: Record<string, number>) {
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

function antiFarmRewardMultiplier(input: {
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

export function defaultHarthmereLiveModeBankingState(): HarthmereLiveModeBankingState {
  return {
    accountBank: {},
    materialStorage: {},
    personalBankMaxSlots: HARTHMERE_PERSONAL_BANK_BASE_SLOTS,
    accountBankMaxSlots: HARTHMERE_ACCOUNT_BANK_BASE_SLOTS,
    materialStorageMaxSlots: HARTHMERE_MATERIAL_STORAGE_BASE_SLOTS,
    transactionLogs: [],
    loans: {},
    nextLoanNumber: 1,
  };
}

function normalizeBankingState(
  raw: Partial<HarthmereLiveModeBankingState> | undefined
): HarthmereLiveModeBankingState {
  const defaults = defaultHarthmereLiveModeBankingState();
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
  next.personalBankMaxSlots = clampBankSlotLimit(
    next.personalBankMaxSlots,
    HARTHMERE_PERSONAL_BANK_BASE_SLOTS
  );
  next.accountBankMaxSlots = clampBankSlotLimit(
    next.accountBankMaxSlots,
    HARTHMERE_ACCOUNT_BANK_BASE_SLOTS
  );
  next.materialStorageMaxSlots = clampBankSlotLimit(
    next.materialStorageMaxSlots,
    HARTHMERE_MATERIAL_STORAGE_BASE_SLOTS
  );
  next.nextLoanNumber = Math.max(
    1,
    Math.trunc(Number(next.nextLoanNumber) || 1)
  );
  return next;
}

export function defaultHarthmereLiveModeCraftingState(): HarthmereLiveModeCraftingState {
  return {
    activeJobs: {},
    history: [],
    nextJobNumber: 1,
    toolDurability: {},
    itemDurability: {},
  };
}

function normalizeCraftingJob(
  raw: Partial<HarthmereLiveModeCraftingJob> | undefined,
  fallbackJobId: string
): HarthmereLiveModeCraftingJob | undefined {
  if (!raw?.recipeId || !raw.actorId) return undefined;
  const status: HarthmereLiveModeCraftingJobStatus =
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

function normalizeCraftingState(
  raw: Partial<HarthmereLiveModeCraftingState> | undefined
): HarthmereLiveModeCraftingState {
  const activeJobs: Record<string, HarthmereLiveModeCraftingJob> = {};
  for (const [jobId, rawJob] of Object.entries(raw?.activeJobs ?? {})) {
    const job = normalizeCraftingJob(rawJob, jobId);
    if (job && job.status === "active") activeJobs[job.jobId] = job;
  }
  const rawHistory = raw?.history;
  const history = Array.isArray(rawHistory)
    ? rawHistory
        .map((job, index) =>
          normalizeCraftingJob(job, (job as any)?.jobId ?? `history_${index}`)
        )
        .filter((job): job is HarthmereLiveModeCraftingJob => Boolean(job))
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

function clampBankSlotLimit(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(
    fallback,
    Math.min(HARTHMERE_BANK_MAX_SLOTS, Math.trunc(value))
  );
}

function countOccupiedBankSlots(record: Record<string, number>) {
  return Object.values(record).filter((count) => Number(count) > 0).length;
}

function bankRecordHasCapacity(
  record: Record<string, number>,
  itemId: string,
  maxSlots: number
) {
  return (record[itemId] ?? 0) > 0 || countOccupiedBankSlots(record) < maxSlots;
}

function applyBankRecordDelta(
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

function combinedBackpackAndMaterialStorageItems(
  state: HarthmereLiveModeBackendState
) {
  const items: Record<string, number> = { ...state.inventory.items };
  const rawMaterialStorage = state.banking.materialStorage as
    | Record<string, number>
    | { items?: Record<string, number> };
  const materialStorageItems =
    "items" in rawMaterialStorage &&
    rawMaterialStorage.items &&
    typeof rawMaterialStorage.items === "object"
      ? rawMaterialStorage.items
      : (rawMaterialStorage as Record<string, number>);
  for (const [itemId, count] of Object.entries(materialStorageItems)) {
    const wholeCount = Math.trunc(Number(count) || 0);
    if (wholeCount <= 0) continue;
    items[itemId] = (items[itemId] ?? 0) + wholeCount;
  }
  return items;
}

function applyJobsBoardInventoryItemDelta(
  state: HarthmereLiveModeBackendState,
  itemId: string,
  rawDelta: number,
  touchedModels: Set<string>
) {
  const delta = Math.trunc(Number(rawDelta) || 0);
  if (delta === 0) return;
  if (delta > 0) {
    applyBankRecordDelta(state.inventory.items, itemId, delta);
    touchedModels.add("inventory_items");
    return;
  }

  let remaining = -delta;
  const fromBackpack = Math.min(state.inventory.items[itemId] ?? 0, remaining);
  if (fromBackpack > 0) {
    applyBankRecordDelta(state.inventory.items, itemId, -fromBackpack);
    touchedModels.add("inventory_items");
    remaining -= fromBackpack;
  }
  if (remaining > 0) {
    const rawMaterialStorage = state.banking.materialStorage as
      | Record<string, number>
      | { items?: Record<string, number> };
    const materialStorageItems =
      "items" in rawMaterialStorage &&
      rawMaterialStorage.items &&
      typeof rawMaterialStorage.items === "object"
        ? rawMaterialStorage.items
        : (rawMaterialStorage as Record<string, number>);
    applyBankRecordDelta(materialStorageItems, itemId, -remaining);
    touchedModels.add("material_storage");
  }
}

function routeLiveModeRewardOutsideBackpack(
  state: HarthmereLiveModeBackendState,
  itemId: string | undefined,
  count: number,
  source: string,
  warnings: string[],
  touchedModels: Set<string>
) {
  if (!itemId || count <= 0) return false;
  const def = getHarthmereItemDefinition(itemId);
  const category = itemCategoryFromDefinition(def, itemId);
  const isBuildingSystemMaterial = itemId in BUILDING_SYSTEM_MATERIAL_CATALOG;
  const isPlaceableDecoration =
    getHarthmereHomeDecorationDefinition(itemId) !== undefined;
  const isVoxelBlock =
    def?.objectMetadata?.physicalForm === "block" ||
    (safeParseBiomesId(itemId) != null &&
      anItem(safeParseBiomesId(itemId)!)?.isBlock === true) ||
    /muckwad|voxel|block/i.test(`${itemId} ${def?.displayName ?? ""}`);
  if (category === "currency" && !isBuildingSystemMaterial) {
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
    (category === "materials" || isBuildingSystemMaterial) &&
    !isVoxelBlock &&
    !isPlaceableDecoration &&
    bankRecordHasCapacity(
      state.banking.materialStorage,
      itemId,
      state.banking.materialStorageMaxSlots
    )
  ) {
    applyBankRecordDelta(state.banking.materialStorage, itemId, count);
    appendBankingLog(state, {
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

function liveModeItemShouldRouteToMaterialStorage(itemId: string | undefined) {
  if (!itemId) return false;
  const def = getHarthmereItemDefinition(itemId);
  const category = itemCategoryFromDefinition(def, itemId);
  const isBuildingSystemMaterial = itemId in BUILDING_SYSTEM_MATERIAL_CATALOG;
  const isPlaceableDecoration =
    getHarthmereHomeDecorationDefinition(itemId) !== undefined;
  const isVoxelBlock =
    def?.objectMetadata?.physicalForm === "block" ||
    (safeParseBiomesId(itemId) != null &&
      anItem(safeParseBiomesId(itemId)!)?.isBlock === true) ||
    /muckwad|voxel|block/i.test(`${itemId} ${def?.displayName ?? ""}`);
  return (
    (category === "materials" || isBuildingSystemMaterial) &&
    !isVoxelBlock &&
    !isPlaceableDecoration
  );
}

function isHarthmereNativeHarvestTreeSeed(
  seed: (typeof HARTHMERE_SEED_DEFINITIONS)[string] | undefined,
  envelope?: HarthmereLiveModeAuthorityEnvelope
) {
  const farmingKind =
    envelope &&
    (payloadString(envelope, "farmingKind") ??
      payloadString(envelope, "plantKind"));
  if (farmingKind === "tree") {
    return true;
  }
  const text = [
    seed?.displayName,
    seed?.cropDisplayName,
    seed?.cropItemId,
    seed?.metadata?.category,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /\btree\b|\b(oak|birch|rubber|sakura)\b/.test(text);
}

function nativePlantHarvestSeedDefinition(
  envelope: HarthmereLiveModeAuthorityEnvelope
) {
  const seedItemId =
    payloadStringOrNumber(envelope, "seedItemId") ??
    payloadStringOrNumber(envelope, "seedId");
  if (seedItemId && HARTHMERE_SEED_DEFINITIONS[seedItemId]) {
    return HARTHMERE_SEED_DEFINITIONS[seedItemId];
  }

  const cropItemId = payloadStringOrNumber(envelope, "cropItemId");
  const yieldItemId = payloadStringOrNumber(envelope, "yieldItemId");
  const plantLabel = payloadString(envelope, "plantLabel")?.toLowerCase();
  return Object.values(HARTHMERE_SEED_DEFINITIONS).find((seed) => {
    if (cropItemId && seed.cropItemId === cropItemId) return true;
    if (yieldItemId && seed.yieldItemId === yieldItemId) return true;
    if (
      plantLabel &&
      [seed.displayName, seed.cropDisplayName, seed.cropItemId]
        .filter(Boolean)
        .some((value) => plantLabel.includes(String(value).toLowerCase()))
    ) {
      return true;
    }
    return false;
  });
}

function sendLiveModeRewardToOverflow(
  state: HarthmereLiveModeBackendState,
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

function ensureProductionBusinessForPropertyBusiness(input: {
  state: HarthmereLiveModeBackendState;
  business: BuildingSystemBusinessRecord;
  property: BuildingSystemPropertyRecord;
  nowMs: number;
  warnings: string[];
  touchedModels: Set<string>;
  sharedStateKeys: Set<string>;
}) {
  const typeId = input.business.type as HarthmereEconomyBusinessTypeId;
  const def = HARTHMERE_ECONOMY_BUSINESS_TYPES[typeId];
  if (!def) {
    input.warnings.push(
      "production_business_bridge_rejected:unknown_business_type"
    );
    input.touchedModels.add("economy_production_bridge_rejection");
    return false;
  }

  let existing: HarthmereEconomyBusinessRecord | undefined =
    input.state.economy.production.businesses[input.business.businessId];
  const existingIsStalePropertyHostedBridge =
    existing &&
    existing.ownerKind === "player" &&
    existing.propertyId === input.property.propertyId &&
    (existing.flags?.propertyHosted === true ||
      existing.flags?.productionBridge === true);
  if (
    existingIsStalePropertyHostedBridge &&
    (existing.ownerId !== input.business.ownerId || existing.typeId !== typeId)
  ) {
    delete input.state.economy.production.businesses[input.business.businessId];
    input.warnings.push(
      "production_business_bridge_replaced:stale_property_type"
    );
    input.touchedModels.add("economy_production_business_replaced");
    input.touchedModels.add("economy_production_state");
    input.sharedStateKeys.add(
      `harthmere:economy:business:${input.business.businessId}`
    );
    existing = undefined;
  }
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
    existing.townId ??= HARTHMERE_ECONOMY_DEFAULT_TOWN_ID;
    existing.regionId ||= HARTHMERE_ECONOMY_DEFAULT_REGION_ID;
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
    townId: HARTHMERE_ECONOMY_DEFAULT_TOWN_ID,
    regionId: HARTHMERE_ECONOMY_DEFAULT_REGION_ID,
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
      HARTHMERE_ECONOMY_BASE_SALES_TAX_RATE,
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

function playerOwnedBusinessOwnerNpcMarker(input: {
  state: HarthmereLiveModeBackendState;
  business: BuildingSystemBusinessRecord;
  property: BuildingSystemPropertyRecord;
  nowMs: number;
}): BuildingSystemInWorldMarker | undefined {
  if (input.property.use !== "business") {
    return undefined;
  }
  const plot = buildingSystemPlotFromState(input.state, input.property.plotId);
  const blueprint = buildingSystemBlueprintById(input.property.blueprintId);
  if (!blueprint) {
    return undefined;
  }
  const origin =
    input.property.origin ??
    (plot ? buildingSystemDefaultOrigin(plot, blueprint) : undefined);
  if (!origin) return undefined;
  const xMax = plot?.bounds.xMax ?? origin.x + blueprint.footprint.width + 1;
  const zMax = plot?.bounds.zMax ?? origin.z + blueprint.footprint.depth + 1;
  return {
    markerId: `${input.business.businessId}:owner-npc`,
    plotId: input.property.plotId,
    kind: "npc_board",
    position: [
      Math.min(
        xMax - 1,
        origin.x + Math.max(2, Math.floor(blueprint.footprint.width * 0.65))
      ),
      origin.y + 1,
      Math.min(
        zMax - 1,
        origin.z + Math.max(3, Math.floor(blueprint.footprint.depth * 0.6))
      ),
    ],
    label: `${input.property.propertyId
      .replace(/^property_/, "")
      .replaceAll("_", " ")} owner`,
    createdAtMs: input.nowMs,
  };
}

function ensurePlayerOwnedBusinessOwnerNpcMarkers(
  state: HarthmereLiveModeBackendState,
  nowMs: number
) {
  for (const business of Object.values(state.economy.businesses)) {
    const property = state.property.owned[business.propertyId];
    if (!property || property.ownerId !== business.ownerId) {
      continue;
    }
    const marker = playerOwnedBusinessOwnerNpcMarker({
      state,
      business,
      property,
      nowMs,
    });
    if (!marker) {
      continue;
    }
    state.building.inWorldMarkers[marker.markerId] = {
      ...marker,
      createdAtMs:
        state.building.inWorldMarkers[marker.markerId]?.createdAtMs ?? nowMs,
    };
  }
}

function wouldExceedCarryWeight(
  items: Record<string, number>,
  itemId: string | undefined,
  count: number
) {
  if (!itemId || count <= 0) {
    return false;
  }
  const nextWeight =
    harthmereInventoryCarryWeight(items) +
    harthmereItemUnitWeight(itemId) * Math.max(1, Math.trunc(count));
  return nextWeight > HARTHMERE_CARRY_WEIGHT_LIMIT;
}

function wouldStacksExceedCarryWeight(
  items: Record<string, number>,
  stacks: Record<string, number>
) {
  const projected = { ...items };
  for (const [itemId, count] of Object.entries(stacks)) {
    applyBankRecordDelta(projected, itemId, Math.trunc(Number(count) || 0));
  }
  return (
    harthmereInventoryCarryWeight(projected) > HARTHMERE_CARRY_WEIGHT_LIMIT
  );
}

function wouldCraftExceedCarryWeight(
  items: Record<string, number>,
  recipe: HarthmereCraftingRecipe | undefined,
  craftCount = 1
) {
  if (!recipe) {
    return false;
  }
  const count = Math.max(1, Math.trunc(craftCount));
  const projected = { ...items };
  for (const input of recipe.inputs) {
    applyBankRecordDelta(projected, input.itemId, -input.count * count);
  }
  applyBankRecordDelta(
    projected,
    recipe.outputItemId,
    recipe.outputCount * count
  );
  return (
    harthmereInventoryCarryWeight(projected) > HARTHMERE_CARRY_WEIGHT_LIMIT
  );
}

function wouldCraftCompletionExceedCarryWeight(
  items: Record<string, number>,
  recipe: HarthmereCraftingRecipe | undefined,
  craftCount = 1,
  targetItemId?: string
) {
  if (!recipe) {
    return false;
  }
  const count = Math.max(1, Math.trunc(craftCount));
  const projected = { ...items };
  if (recipe.consumeTargetOnSuccess && targetItemId) {
    applyBankRecordDelta(projected, targetItemId, -1);
  }
  applyBankRecordDelta(
    projected,
    recipe.outputItemId,
    recipe.outputCount * count
  );
  return (
    harthmereInventoryCarryWeight(projected) > HARTHMERE_CARRY_WEIGHT_LIMIT
  );
}

function carriedItemsForWeight(
  items: Record<string, number>,
  materialStorage: Record<string, number> | undefined
) {
  const carried = { ...items };
  for (const [itemId, count] of Object.entries(materialStorage ?? {})) {
    applyBankRecordDelta(carried, itemId, Math.trunc(Number(count) || 0));
  }
  return carried;
}

function selectedLiveCraftingToolItemIds(
  snapshot: HarthmereInventorySnapshot,
  requestedToolItemIds: string[]
) {
  const requested = [...new Set(requestedToolItemIds)];
  if (requested.length > 0) return requested;
  return [
    ...new Set([
      ...Object.keys(snapshot.items ?? {}).filter(
        (itemId) =>
          (snapshot.items[itemId] ?? 0) > 0 &&
          Boolean(getHarthmereCraftingTool(itemId))
      ),
      ...Object.values(snapshot.equipment ?? {}).filter((itemId) =>
        Boolean(getHarthmereCraftingTool(itemId))
      ),
    ]),
  ];
}

function chargedCraftingToolItemIds(
  recipe: HarthmereCraftingRecipe | undefined,
  toolItemIds: string[]
) {
  if (!recipe || (recipe.toolDurabilityCost ?? 0) <= 0) return [];
  return [
    ...new Set(
      toolItemIds.filter((itemId) => {
        const tool = getHarthmereCraftingTool(itemId);
        return (
          recipe.requiredToolIds?.includes(itemId) ||
          (tool?.action !== undefined &&
            (recipe.requiredToolActions ?? []).includes(tool.action))
        );
      })
    ),
  ];
}

function currentCraftingToolDurability(
  state: HarthmereLiveModeBackendState,
  itemId: string
) {
  const explicit = state.crafting.toolDurability[itemId];
  if (Number.isFinite(explicit)) {
    return Math.max(0, Math.trunc(Number(explicit)));
  }
  const tool = getHarthmereCraftingTool(itemId);
  const max = Math.trunc(Number(tool?.durabilityMax) || 0);
  return Math.max(0, max);
}

function craftingToolDurabilityRejection(
  state: HarthmereLiveModeBackendState,
  recipe: HarthmereCraftingRecipe | undefined,
  toolItemIds: string[],
  craftCount = 1
) {
  const unitCost = Math.max(
    0,
    Math.trunc(Number(recipe?.toolDurabilityCost) || 0)
  );
  if (!recipe || unitCost <= 0) return undefined;
  const totalCost = unitCost * Math.max(1, Math.trunc(craftCount));
  for (const itemId of chargedCraftingToolItemIds(recipe, toolItemIds)) {
    const max = Math.trunc(
      Number(getHarthmereCraftingTool(itemId)?.durabilityMax) || 0
    );
    if (max <= 0) continue;
    if (currentCraftingToolDurability(state, itemId) < totalCost) {
      return `tool_durability_depleted:${itemId}`;
    }
  }
  return undefined;
}

function applyCraftingOutcomeDurability(
  state: HarthmereLiveModeBackendState,
  result: HarthmereInventoryMutationResult,
  touchedModels: Set<string>,
  options: { applyToolCosts: boolean }
) {
  const outcome = result.craftingOutcome;
  if (!outcome) return;
  const recipe = getHarthmereCraftingRecipe(outcome.recipeId);
  if (options.applyToolCosts) {
    for (const [itemId, rawCost] of Object.entries(
      outcome.toolDurabilityCosts
    )) {
      const cost = Math.max(0, Math.trunc(Number(rawCost) || 0));
      const max = Math.trunc(
        Number(getHarthmereCraftingTool(itemId)?.durabilityMax) || 0
      );
      if (cost <= 0 || max <= 0) continue;
      state.crafting.toolDurability[itemId] = Math.max(
        0,
        currentCraftingToolDurability(state, itemId) - cost
      );
      touchedModels.add("tool_durability");
    }
  }
  if (!outcome.success) return;
  if (recipe?.workflowKind === "repair" && outcome.targetItemId) {
    const targetDef = getHarthmereItemDefinition(outcome.targetItemId);
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

function refundCraftingJobToolDurability(
  state: HarthmereLiveModeBackendState,
  job: HarthmereLiveModeCraftingJob,
  touchedModels: Set<string>
) {
  for (const [itemId, rawCost] of Object.entries(
    job.outcome?.toolDurabilityCosts ?? {}
  )) {
    const cost = Math.max(0, Math.trunc(Number(rawCost) || 0));
    const max = Math.trunc(
      Number(getHarthmereCraftingTool(itemId)?.durabilityMax) || 0
    );
    if (cost <= 0 || max <= 0) continue;
    state.crafting.toolDurability[itemId] = Math.min(
      max,
      currentCraftingToolDurability(state, itemId) + cost
    );
    touchedModels.add("tool_durability");
  }
}

function applyStartedCraftingFailureRefund(
  state: HarthmereLiveModeBackendState,
  job: HarthmereLiveModeCraftingJob,
  recipe: HarthmereCraftingRecipe | undefined,
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
    applyBankRecordDelta(state.inventory.items, itemId, refund);
    touchedModels.add("inventory_items");
  }
  for (const [itemId, delta] of Object.entries(
    job.reservedMaterialStorageDeltas
  )) {
    if (delta >= 0) continue;
    const refund = Math.floor(Math.abs(delta) * refundPercent);
    if (refund <= 0) continue;
    applyBankRecordDelta(state.banking.materialStorage, itemId, refund);
    touchedModels.add("material_storage");
  }
}

function nextCraftingJobId(state: HarthmereLiveModeBackendState) {
  let jobId = "";
  do {
    jobId = `craft_${state.actorId}_${state.crafting.nextJobNumber++}`;
  } while (state.crafting.activeJobs[jobId]);
  return jobId;
}

function pushCarryWeightRejection(
  warnings: string[],
  touchedModels: Set<string>,
  source: string
) {
  warnings.push(`${source}_rejected:carry_weight_limit_exceeded`);
  touchedModels.add("inventory_weight_rejection");
}

function clearBankCreditHoldIfSettled(
  state: HarthmereLiveModeBackendState,
  nowMs: number
) {
  const hasUnpaidLoan = Object.values(state.banking.loans).some(
    (loan) =>
      (loan.status === "active" || loan.status === "defaulted") &&
      activeLoanBalance(loan, nowMs).totalRemaining > 0
  );
  if (!hasUnpaidLoan) {
    delete state.law.flags[HARTHMERE_BANK_CREDIT_HOLD_FLAG];
  }
}

export function applyHarthmereBankLoanConsequences(
  state: HarthmereLiveModeBackendState,
  nowMs: number
): { changed: boolean; defaultedLoanIds: string[] } {
  let changed = false;
  const defaultedLoanIds: string[] = [];
  for (const loan of Object.values(state.banking.loans)) {
    if (loan.status !== "active") {
      continue;
    }
    const balance = activeLoanBalance(loan, nowMs);
    if (!balance.overdue || balance.totalRemaining <= 0) {
      continue;
    }
    loan.status = "defaulted";
    loan.defaultedAtMs = loan.defaultedAtMs ?? nowMs;
    loan.defaultPenaltyGold = Math.max(
      loan.defaultPenaltyGold ?? 0,
      Math.ceil(loan.principalRemaining * HARTHMERE_LOAN_DEFAULT_PENALTY_RATE)
    );
    loan.penaltyPaid = loan.penaltyPaid ?? 0;
    if (!loan.creditPenaltyApplied) {
      loan.creditPenaltyApplied = true;
      state.law.flags[HARTHMERE_BANK_CREDIT_HOLD_FLAG] = true;
      state.law.reputation["harthmere_bank_credit"] =
        (state.law.reputation["harthmere_bank_credit"] ?? 0) - 100;
      appendBankingLog(state, {
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

function appendBankingLog(
  state: HarthmereLiveModeBackendState,
  entry: Omit<
    HarthmereBankingTransactionLog,
    "id" | "actorId" | "atMs" | "balanceAfter"
  >
) {
  const log: HarthmereBankingTransactionLog = {
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

function humanizeHarthmereItemId(itemId: string) {
  const foodName = HARTHMERE_FOOD_DEFINITIONS[itemId]?.displayName;
  if (foodName) return foodName;
  const seedName = HARTHMERE_SEED_DEFINITIONS[itemId]?.displayName;
  if (seedName) return seedName;
  const tail = itemId.split("/").filter(Boolean).pop() ?? itemId;
  const trimmed =
    tail.length > 24 ? `${tail.slice(0, 10)}…${tail.slice(-6)}` : tail;
  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function dynamicBiomesBikkieLiveModeItemDefinition(
  itemId: string
): HarthmereItemDefinition | undefined {
  // Cloud Save can receive real Biomes biscuit ids from mining, harvesting, or
  // loot. Register them lazily so persistence accepts exact `b:<id>` stacks.
  const requestedItemId = String(itemId);
  const biomesId = safeParseBiomesId(itemId);
  if (!biomesId) return undefined;
  const canonicalItemId = `b:${biomesId}`;
  const existing = getHarthmereItemDefinition(canonicalItemId);
  if (existing) {
    if (
      requestedItemId !== canonicalItemId &&
      !getHarthmereItemDefinition(requestedItemId)
    ) {
      const alias = { ...existing, itemId: requestedItemId };
      registerHarthmereItemDefinition(alias);
      return alias;
    }
    return existing;
  }
  // `anItem`/`prepareItem` THROWS when the biscuit id is not a valid item
  // biscuit (e.g. a raw terrain/grass biscuit surfaced by mining). That uncaught
  // throw used to 500 the ENTIRE live_mode request — so a mined block or a crate
  // pickup that carried such an id was never granted/persisted ("took items from
  // the crate and it's not in my inventory"; "Mined Grass" 500s). These ids all
  // arrive as `b:<id>` from mining/loot, so on failure fall back to a generic
  // stackable block definition instead of throwing.
  let item: ReturnType<typeof anItem> | undefined;
  try {
    item = anItem(biomesId);
  } catch {
    item = undefined;
  }
  const resolvedAsItem = item !== undefined;
  const isCamera = biomesId === BikkieIds.camera;
  // When the biscuit could not be resolved as an item at all, treat the mined
  // `b:<id>` as a block (that is where these unknown ids come from) so it still
  // grants as a stackable material rather than being dropped.
  const isBlock = item?.isBlock === true || !resolvedAsItem;
  const stackable = Number(item?.stackable ?? (isBlock ? 99n : 1n));
  const def: HarthmereItemDefinition = {
    itemId: canonicalItemId,
    displayName: isCamera
      ? "Camera"
      : typeof item?.displayName === "string" &&
        item.displayName.trim().length > 0
      ? item.displayName
      : isBlock
      ? `Biomes Block ${biomesId}`
      : `Biomes Item ${biomesId}`,
    description: isBlock
      ? "A mined Biomes voxel block saved from the world."
      : "A Biomes item saved from the world.",
    maxStackSize:
      Number.isFinite(stackable) && stackable > 1
        ? Math.max(2, Math.trunc(stackable))
        : 1,
    baseValue: 0,
    binding: "none",
    isQuestItem: false,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: isBlock,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: {},
    tradeable: true,
    category: isBlock ? "materials" : isCamera ? "tool" : "item",
    equipmentSlots: isCamera ? ["main_hand"] : undefined,
    weight: isBlock ? 1 : undefined,
    objectMetadata: isBlock
      ? {
          objectKind: "material",
          physicalForm: "block",
          sizeVoxels: { width: 1, depth: 1, height: 1 },
          sizeLabel: "voxel block",
          source: ["mining", "world"],
          handling: ["backpack", "hotbar"],
          visualDescription: "A mined Biomes voxel block.",
        }
      : undefined,
  };
  registerHarthmereItemDefinition(def);
  if (requestedItemId !== canonicalItemId) {
    const alias = { ...def, itemId: requestedItemId };
    registerHarthmereItemDefinition(alias);
    return alias;
  }
  return def;
}

function ensureLiveModeItemDefinition(
  itemId: string,
  snapshot: Pick<HarthmereInventorySnapshot, "items" | "bank">
): HarthmereItemDefinition | undefined {
  const existing = getHarthmereItemDefinition(itemId);
  if (existing) return existing;
  const knownCount =
    (snapshot.items[itemId] ?? 0) + (snapshot.bank[itemId] ?? 0);
  const isSeed = !!HARTHMERE_SEED_DEFINITIONS[itemId];
  const isFood = !!HARTHMERE_FOOD_DEFINITIONS[itemId];
  const helperQuestItemCopy = liveEntityHelperQuestItemCopyForId(itemId);
  const isJobsBoardExecutable =
    isKnownHarthmereJobsBoardExecutableItemId(itemId);
  const isKnownHarthmereCatalogItem =
    isSeed || isFood || !!helperQuestItemCopy || isJobsBoardExecutable;
  if (!isKnownHarthmereCatalogItem) {
    const biomesBikkie = dynamicBiomesBikkieLiveModeItemDefinition(itemId);
    if (biomesBikkie) return biomesBikkie;
  }
  if (knownCount <= 0 && !isKnownHarthmereCatalogItem) return undefined;
  const isMaterial =
    isSeed || isJobsBoardExecutable || isLikelyBankingMaterialItemId(itemId);
  const def: HarthmereItemDefinition = {
    itemId,
    displayName:
      helperQuestItemCopy?.displayName ?? humanizeHarthmereItemId(itemId),
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
  registerHarthmereItemDefinition(def);
  return def;
}

function liveModeGuildItemUnitGoldValue(
  itemId: string | undefined,
  snapshot: Pick<HarthmereInventorySnapshot, "items" | "bank">
) {
  if (!itemId) return undefined;
  const def =
    ensureLiveModeItemDefinition(itemId, snapshot) ??
    getHarthmereItemDefinition(itemId);
  return Math.max(1, Math.trunc(Number(def?.baseValue ?? 1)));
}

function bankUpgradeCost(
  kind: HarthmereBankingVaultKind,
  currentSlots: number
) {
  const base =
    kind === "materials"
      ? HARTHMERE_MATERIAL_STORAGE_BASE_SLOTS
      : kind === "account"
      ? HARTHMERE_ACCOUNT_BANK_BASE_SLOTS
      : HARTHMERE_PERSONAL_BANK_BASE_SLOTS;
  const upgradeNumber = Math.max(
    0,
    Math.floor((currentSlots - base) / HARTHMERE_BANK_SLOT_UPGRADE_SIZE)
  );
  return 100 + upgradeNumber * 75;
}

function normalizeBankVaultKind(
  value: string | undefined
): HarthmereBankingVaultKind {
  if (value === "account") return "account";
  if (value === "materials" || value === "material") return "materials";
  return "personal";
}

function activeLoanBalance(loan: HarthmereBankingLoan, nowMs: number) {
  const boundedRegularEndMs = Math.min(nowMs, loan.dueAtMs);
  const regularInterestDays = Math.max(
    0,
    Math.ceil((boundedRegularEndMs - loan.openedAtMs) / HARTHMERE_LOAN_DAY_MS)
  );
  const lateDays = Math.max(
    0,
    Math.ceil((nowMs - loan.dueAtMs) / HARTHMERE_LOAN_DAY_MS)
  );
  const regularInterest = Math.ceil(
    loan.principalRemaining * loan.dailyInterestRate * regularInterestDays
  );
  const lateInterest = Math.ceil(
    loan.principalRemaining *
      loan.dailyInterestRate *
      HARTHMERE_LOAN_LATE_INTEREST_MULTIPLIER *
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

export function createHarthmereLiveModeBankingClientSnapshot(
  state: HarthmereLiveModeBackendState
) {
  const activeLoans = Object.values(state.banking.loans).map((loan) => ({
    ...loan,
    balance: activeLoanBalance(loan, state.updatedAtMs),
  }));
  return {
    actorId: state.actorId,
    gold: state.inventory.gold,
    carryWeight: {
      current: harthmereInventoryCarryWeight(
        carriedItemsForWeight(
          state.inventory.items,
          state.banking.materialStorage
        )
      ),
      max: HARTHMERE_CARRY_WEIGHT_LIMIT,
      overLimit:
        harthmereInventoryCarryWeight(
          carriedItemsForWeight(
            state.inventory.items,
            state.banking.materialStorage
          )
        ) > HARTHMERE_CARRY_WEIGHT_LIMIT,
    },
    creditHold: !!state.law.flags[HARTHMERE_BANK_CREDIT_HOLD_FLAG],
    personalVault: {
      items: state.inventory.bank,
      maxSlots: state.banking.personalBankMaxSlots,
      usedSlots: countOccupiedBankSlots(state.inventory.bank),
    },
    accountVault: {
      items: state.banking.accountBank,
      maxSlots: state.banking.accountBankMaxSlots,
      usedSlots: countOccupiedBankSlots(state.banking.accountBank),
    },
    materialStorage: {
      items: state.banking.materialStorage,
      maxSlots: state.banking.materialStorageMaxSlots,
      usedSlots: countOccupiedBankSlots(state.banking.materialStorage),
    },
    loans: activeLoans,
    transactionLogs: state.banking.transactionLogs.slice(-50),
    nextUpgradeCosts: {
      personal: bankUpgradeCost("personal", state.banking.personalBankMaxSlots),
      account: bankUpgradeCost("account", state.banking.accountBankMaxSlots),
      materials: bankUpgradeCost(
        "materials",
        state.banking.materialStorageMaxSlots
      ),
    },
  };
}

export function createHarthmereProgressionClientSnapshotFromBackend(
  state: HarthmereLiveModeBackendState
) {
  return {
    ...createHarthmereProgressionClientSnapshot({
      actorId: state.actorId,
      classMagic: state.classMagic,
      economy: state.economy.production,
      collections: state.collections,
    }),
    questState: createHarthmereLiveModeQuestClientSnapshot(state),
  };
}

function liveModeResourceLabel(kind: HarthmereResourceKind) {
  return kind
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function liveModePrimaryStanding(state: HarthmereLiveModeBackendState) {
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
    standing: normalizeReputationStanding(state.law.standing[scopeId]),
  };
}

export function createHarthmereLiveModePlayerStatusClientSnapshot(
  state: HarthmereLiveModeBackendState
) {
  const pools = ensureCombatResourcePools(state);
  const combatHp = normalizedLiveModePlayerHp(state);
  const deathState = liveModePlayerDeathStateForHp(state);
  const classId = state.classMagic.classId ?? "warrior";
  const classDef =
    HARTHMERE_CLASS_DEFINITIONS[
      classId as keyof typeof HARTHMERE_CLASS_DEFINITIONS
    ];
  const primaryResource = abilityResourceKindForLiveMode(undefined, classId);
  const characterLevel = state.classMagic.skills.character_level ?? {
    xp: 0,
    level: 1,
  };
  const characterProgress = harthmereSkillProgressFromTotalXp(
    "character_level",
    characterLevel.xp
  );
  const standing = liveModePrimaryStanding(state);
  const lastDeath = latestHarthmereLiveModeDeathRecord(state);
  return {
    version: "harthmere-live-mode-player-status",
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
      lastDeath: lastDeath
        ? {
            deathId: lastDeath.deathId,
            cause: lastDeath.cause,
            zoneId: lastDeath.zoneId,
            atMs: lastDeath.atMs,
            respawnAvailableAtMs: lastDeath.respawnAvailableAtMs,
          }
        : undefined,
      primaryResource,
      primaryResourceLabel: liveModeResourceLabel(primaryResource),
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
      legacyReputation: clampSignedReputation(
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
  envelope: HarthmereLiveModeAuthorityEnvelope,
  key: string
) {
  const value = envelope.payload[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function payloadStringOrNumber(
  envelope: HarthmereLiveModeAuthorityEnvelope,
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
  envelope: HarthmereLiveModeAuthorityEnvelope,
  key: string
) {
  const value = envelope.payload[key];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function payloadPositiveWholeCount(
  envelope: HarthmereLiveModeAuthorityEnvelope,
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

function clampLiveModeMutationDelta(delta: number) {
  if (!Number.isFinite(delta)) {
    return 0;
  }
  const wholeDelta = Math.trunc(delta);
  return Math.max(-250, Math.min(250, wholeDelta));
}

function payloadRecord(
  envelope: HarthmereLiveModeAuthorityEnvelope,
  key: string
) {
  const value = envelope.payload[key];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

// HARTHMERE_WORLD_THROW_DROP (audit fix, 2026-07-13): parse a generic
// `{x,y,z}` (or `[x,y,z]`) world position from the payload. Used by the throw
// path to place the resulting world loot drop.
function payloadWorldPosition(
  envelope: HarthmereLiveModeAuthorityEnvelope,
  key: string
): { x: number; y: number; z: number } | undefined {
  const record = payloadRecord(envelope, key);
  if (record) {
    const x = Number(record.x);
    const y = Number(record.y);
    const z = Number(record.z);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      return { x, y, z };
    }
  }
  const raw = envelope.payload[key];
  if (Array.isArray(raw) && raw.length >= 3) {
    const [x, y, z] = raw.map(Number);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      return { x, y, z };
    }
  }
  return undefined;
}

function payloadBoolean(
  envelope: HarthmereLiveModeAuthorityEnvelope,
  key: string
) {
  const value = envelope.payload[key];
  return typeof value === "boolean" ? value : undefined;
}

function payloadStringArray(
  envelope: HarthmereLiveModeAuthorityEnvelope,
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

function questInviteSharedWorldKey() {
  return harthmereLiveModeSharedWorldStateKey();
}

function questInvitePayloadWorldPosition(
  envelope: HarthmereLiveModeAuthorityEnvelope
): [number, number, number] | undefined {
  const record = payloadRecord(envelope, "markerWorldPosition");
  if (record) {
    const position = normalizeQuestInviteVec3([record.x, record.y, record.z]);
    if (position) return position;
  }
  const fromArray = normalizeQuestInviteVec3(
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

function slugQuestInvitePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

const QUEST_INVITE_MAX_DISTANCE_METERS = 16;

function reduceQuestInviteMutation(input: {
  state: HarthmereLiveModeBackendState;
  envelope: HarthmereLiveModeAuthorityEnvelope;
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
    const questTitle = cleanQuestInviteText(
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
    const actorPosition = actorWorldPositionFromAuthority(envelope);
    if (!actorPosition || !envelope.serverTargetPosition) {
      warnings.push("quest_invite_rejected:proximity_unverified");
      touchedModels.add("quest_invite_rejection");
      return true;
    }
    if (
      distanceSq3(actorPosition, envelope.serverTargetPosition) >
      QUEST_INVITE_MAX_DISTANCE_METERS * QUEST_INVITE_MAX_DISTANCE_METERS
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
      `shared_quest:${slugQuestInvitePart(questId)}:${slugQuestInvitePart(
        envelope.actorId
      )}`;
    const inviteId =
      payloadString(envelope, "inviteId") ??
      `quest_invite:${slugQuestInvitePart(questId)}:${slugQuestInvitePart(
        envelope.actorId
      )}:${slugQuestInvitePart(inviteeActorId)}:${slugQuestInvitePart(
        envelope.requestId
      )}`;
    const questArea = cleanQuestInviteText(
      payloadString(envelope, "questArea"),
      "Quest"
    );
    const objectiveText = cleanQuestInviteText(
      payloadString(envelope, "objectiveText"),
      "Join this quest together."
    );
    const reward = payloadString(envelope, "reward");
    const firstMarkerId = payloadString(envelope, "firstMarkerId");
    const markerWorldPosition = questInvitePayloadWorldPosition(envelope);
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
    sharedStateKeys.add(questInviteSharedWorldKey());
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
      sharedStateKeys.add(questInviteSharedWorldKey());
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
      } satisfies HarthmereSharedQuestPartyRecord);
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
    sharedStateKeys.add(questInviteSharedWorldKey());
    return true;
  }

  return false;
}

const LIVE_ENTITY_HELPER_ACCEPTED_STEP_ID = "live_entity_helper:accepted";
const LIVE_ENTITY_HELPER_BOSS_DEFEATED_STEP_ID =
  "live_entity_helper:boss_defeated";

function isLiveEntityHelperQuestKindPayload(
  value: string | undefined
): value is LiveEntityHelperQuestInstance["kind"] {
  return (
    value === "exotic_matter" || value === "food_water" || value === "hard_boss"
  );
}

function liveEntityHelperQuestContextFromEnvelope(
  envelope: HarthmereLiveModeAuthorityEnvelope
): LiveEntityHelperQuestEntityContext | undefined {
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
  // current: mirror the client-side classifier. The previous envelope
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

function liveEntityHelperQuestFromEnvelope(
  envelope: HarthmereLiveModeAuthorityEnvelope,
  warnings: string[]
) {
  const context = liveEntityHelperQuestContextFromEnvelope(envelope);
  if (!context) {
    warnings.push("live_entity_helper_rejected:server_entity_context_required");
    return undefined;
  }
  const quest = getLiveEntityHelperQuestForEntity(context);
  if (!quest) {
    warnings.push("live_entity_helper_rejected:ineligible_entity");
    return undefined;
  }
  const requestedKind = payloadString(envelope, "questKind");
  if (
    requestedKind &&
    (!isLiveEntityHelperQuestKindPayload(requestedKind) ||
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

function upsertLiveEntityHelperQuestMarker(
  state: HarthmereLiveModeBackendState,
  quest: LiveEntityHelperQuestInstance,
  nowMs: number
) {
  const marker = liveEntityHelperQuestTargetMarkerForKind(quest.kind);
  if (!marker) {
    return undefined;
  }
  state.building.inWorldMarkers[marker.id] = {
    markerId: marker.id,
    plotId: `live_entity_helper:${quest.kind}`,
    kind: "map_marker",
    position: resolveHarthmereProductionMarkerPosition({
      markerId: marker.id,
      fallback: marker.position,
    }),
    label: marker.label,
    createdAtMs: nowMs,
  };
  return marker;
}

function removeLiveEntityHelperQuestMarker(
  state: HarthmereLiveModeBackendState,
  quest: LiveEntityHelperQuestInstance
) {
  const marker = liveEntityHelperQuestTargetMarkerForKind(quest.kind);
  if (marker) {
    delete state.building.inWorldMarkers[marker.id];
  }
}

// How close (XZ blocks) a defeated hostile mucker must be to the boss marker for
// its kill to count as completing the hard_boss quest. Sized to the West Muck
// Breach containment zone so a player must actually fight at the marked breach.
const LIVE_ENTITY_HELPER_BOSS_DEFEAT_CREDIT_RADIUS = 48;

function hasLiveEntityHelperBossDefeatEvidence(
  state: HarthmereLiveModeBackendState,
  envelope: HarthmereLiveModeAuthorityEnvelope
) {
  const actorId = envelope.actorId;
  const creditedToActor = (
    snapshot: HarthmereLiveCombatEntitySnapshot
  ): boolean =>
    snapshot.killedByActorId === actorId ||
    snapshot.lastAttackerId === actorId ||
    snapshot.lootOwnerActorIds?.includes(actorId) === true;
  const isDefeated = (snapshot: HarthmereLiveCombatEntitySnapshot): boolean =>
    !snapshot.isAlive && snapshot.hp <= 0;

  // 1) If the client named a specific defeated entity, honor it when it maps to
  // a real combat snapshot the actor actually defeated.
  const explicitBossEntityId = payloadString(envelope, "bossEntityId");
  if (explicitBossEntityId) {
    const explicitSnapshot = state.combat.entitySnapshots[explicitBossEntityId];
    if (explicitSnapshot) {
      return isDefeated(explicitSnapshot) && creditedToActor(explicitSnapshot);
    }
  }

  // 2) Primary path: credit a REAL hostile mucker the actor defeated near the
  // marked breach. The marker id itself is never a combat-snapshot key (snapshots
  // are keyed `server-muck-combat:...`), so we match by hostility + kill credit +
  // proximity to the boss marker instead of a string lookup that never hit.
  const marker = liveEntityHelperQuestTargetMarkerForKind("hard_boss");
  if (marker) {
    const [markerX, , markerZ] = marker.position;
    for (const snapshot of Object.values(state.combat.entitySnapshots)) {
      if (!snapshot || snapshot.isHostile !== true) {
        continue;
      }
      if (!isDefeated(snapshot) || !creditedToActor(snapshot)) {
        continue;
      }
      const home = snapshot.homePosition ?? snapshot.position;
      if (!home) {
        continue;
      }
      const distance = Math.hypot(
        Number(home.x) - markerX,
        Number(home.z) - markerZ
      );
      if (distance <= LIVE_ENTITY_HELPER_BOSS_DEFEAT_CREDIT_RADIUS) {
        return true;
      }
    }
  }

  // 3) Last-resort legacy fallback: only when no real combat snapshot matched
  // (e.g. a world seeded before combat snapshots existed).
  const clientSawDefeat = payloadBoolean(envelope, "bossDefeated") === true;
  const clientKillCredit = payloadNumber(envelope, "bossKillCredit") ?? 0;
  return clientSawDefeat && clientKillCredit > 0;
}

function applyLiveEntityHelperQuestXp(
  state: HarthmereLiveModeBackendState,
  quest: LiveEntityHelperQuestInstance,
  warnings: string[],
  touchedModels: Set<string>
) {
  const actorLevel = state.classMagic.skills.character_level?.level ?? 1;
  const reward = computeHarthmereXpReward({
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

function applyLiveEntityRobotRechargeReward(
  state: HarthmereLiveModeBackendState,
  warnings: string[],
  touchedModels: Set<string>
) {
  const actorLevel = state.classMagic.skills.character_level?.level ?? 1;
  const xp = computeHarthmereXpReward({
    actorLevel,
    targetLevel: LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP.sourceLevel,
    baseXp: LIVE_ENTITY_ROBOT_RECHARGE_REWARD_XP.baseXp,
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
  for (const item of LIVE_ENTITY_ROBOT_RECHARGE_REWARD_ITEMS) {
    ensureLiveEntityHelperServerItemDefinition(item.itemId);
    recordDelta(state.inventory.items, item.itemId, item.quantity);
  }
  touchedModels.add("skill_xp");
  touchedModels.add("inventory_items");
}

// ---------------------------------------------------------------------------
// HARTHMERE_BIBLE_QUEST_WIRING (bible-wiring fix, 2026-07-14): apply the
// reward INSTRUCTIONS returned by the pure bible-quest reducer. All economy
// writes stay in this file (the backend's single choke point): xp lands on
// character_level, "silver" is the player-facing name of the gold wallet, and
// every granted item gets a registered definition FIRST — the audit found the
// catalog's 72 reward item ids exist in no item catalogue, so skipping the
// registration would create inventory rows the UI cannot name.
// ---------------------------------------------------------------------------
function applyHarthmereBibleQuestRewards(
  state: HarthmereLiveModeBackendState,
  rewards: HarthmereBibleQuestRewardInstructions,
  warnings: string[],
  touchedModels: Set<string>,
  nowMs: number
) {
  if (rewards.xpDelta > 0) {
    const skillProgress = upsertSkill(
      state.classMagic.skills,
      "character_level",
      rewards.xpDelta
    );
    if (skillProgress.warning) warnings.push(skillProgress.warning);
    touchedModels.add("skill_xp");
  }
  if (rewards.goldDelta > 0) {
    state.inventory.gold = Math.max(
      0,
      state.inventory.gold + rewards.goldDelta
    );
    state.economy.ledger.push({
      id: rewards.rewardGrantId,
      kind: "bible_quest_reward",
      amount: rewards.goldDelta,
      atMs: nowMs,
    });
    touchedModels.add("wallet");
    touchedModels.add("economy_ledger");
  }
  for (const item of rewards.items) {
    if (!getHarthmereItemDefinition(item.itemId)) {
      registerHarthmereItemDefinition(
        harthmereBibleRewardItemDefinition(item.itemId)
      );
    }
    recordDelta(state.inventory.items, item.itemId, item.count);
    touchedModels.add("inventory_items");
  }
  if (rewards.titles.length || rewards.unlockFlags.length) {
    // Titles/unlock flags already persisted on the bible slice by the
    // reducer; just mark the model dirty so clients refresh.
    touchedModels.add("quest_state");
  }
}

/**
 * HARTHMERE_BIBLE_QUEST_WIRING: keep the Thaedryn combat entity snapshot in
 * lockstep with the encounter state machine. The machine is authoritative for
 * boss HP; the snapshot exists so the native attack ray, health-bar HUD, and
 * NPC AI loop all see a normal combat entity.
 */
function syncHarthmereThaedrynCombatSnapshot(
  state: HarthmereLiveModeBackendState,
  nowMs: number,
  mode: "seed" | "sync" | "remove"
) {
  if (mode === "remove") {
    delete state.combat.entitySnapshots[HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID];
    return;
  }
  const machine = state.quests.bible.thaedryn;
  const snapshot = harthmereThaedrynCombatSnapshot(machine, nowMs);
  const existing =
    state.combat.entitySnapshots[HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID];
  state.combat.entitySnapshots[HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID] = {
    ...(existing ?? {}),
    ...snapshot,
    // Preserve attack bookkeeping the combat loop wrote onto the snapshot.
    lastAttackerId: existing?.lastAttackerId,
    lastAttackedAtMs: existing?.lastAttackedAtMs,
    lastDamageTaken: existing?.lastDamageTaken,
  } as (typeof state.combat.entitySnapshots)[string];
}

function ensureLiveEntityHelperServerItemDefinition(itemId: string) {
  if (getHarthmereItemDefinition(itemId)) {
    return;
  }
  const copy = liveEntityHelperQuestItemCopyForId(itemId);
  if (!copy) {
    return;
  }
  registerHarthmereItemDefinition({
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

function syncLiveEntityRobotProtectionToBuilding(
  state: HarthmereLiveModeBackendState,
  nowMs: number
) {
  for (const area of LIVE_ENTITY_ROBOT_PROTECTION_AREAS) {
    const marker = liveEntityRobotProtectionBuildingMarker(
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

function isLiveEntityRobotProtectedPosition(
  state: HarthmereLiveModeBackendState,
  position: readonly number[] | undefined
) {
  const area = liveEntityRobotProtectionAreaForPosition(position);
  return area
    ? state.robotProtection.areas[area.areaId]?.safeFromMuck === true
    : false;
}

// HARTHMERE_MUCK_EXPOSURE_FORCES_AGGRESSION_SCOPE (2026-07-07): this is used
// ONLY to decide `muckExposureForcesAggression`, which makes muck monsters attack
// unprovoked in daylight and up to their full leash range (~34 units). It must
// therefore mean "the ground here is ACTIVELY mucked", not merely "this land has
// not been secured as a safe zone". `safeFromMuck` defaults to `false` for every
// un-terraformed area, so the old `|| safeFromMuck === false` clause treated the
// entire unsecured world as active muck — forcing distant, off-screen muck
// monsters to aggro and kill players who saw no creature near them ("something
// was hitting me and killing me, no Muckling nearby"). Only an area explicitly
// flagged `status: "mucked"` should force aggression; unsecured land relies on
// the normal proximity/day-night unprovoked-aggression rules instead.
function isLiveEntityRobotMuckedPosition(
  state: HarthmereLiveModeBackendState,
  position: readonly number[] | undefined
) {
  const area = liveEntityRobotProtectionAreaForPosition(position);
  return area
    ? state.robotProtection.areas[area.areaId]?.status === "mucked"
    : false;
}

function liveModePositionObjectToTuple(
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

// True when the position falls inside a player-owned property that has been
// activated as a muck safe zone (terraformed / built). The safeZones map only
// stores a string area label, so geometry is resolved from the plot catalog by
// plot id. This is what finally makes "owning + securing a property protects
// it from muck" real -- previously building.safeZones was written but never read.
function isPositionInsideOwnedSafeZone(
  safeZones: HarthmereLiveModeBackendState["building"]["safeZones"] | undefined,
  position: { x: number; z: number } | undefined,
  customPlots?: HarthmereLiveModeBackendState["building"]["customPlots"]
): boolean {
  if (!safeZones || !position) return false;
  for (const [plotId, zone] of Object.entries(safeZones)) {
    if (!zone?.safeFromMuck) continue;
    const bounds =
      customPlots?.[plotId]?.bounds ?? buildingSystemPlotBoundsById(plotId);
    if (isPositionInsideBuildingSystemPlotBounds(bounds, position)) {
      return true;
    }
  }
  return false;
}

function isHarthmereLiveModeTownSafePosition(
  position: { x: number; y: number; z: number } | undefined,
  safeZones?: HarthmereLiveModeBackendState["building"]["safeZones"],
  customPlots?: HarthmereLiveModeBackendState["building"]["customPlots"]
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
  const inBusinessSafeSite = isPointInsideHarthmereBusinessSafeSite({ x, z });
  // Additive: a player-owned, secured property is also a safe zone. OR-ing this
  // in can only ADD safety, never remove an existing safe area.
  return (
    inGroveAndTownCore ||
    inGroveRespawnPoint ||
    inBusinessSafeSite ||
    isPositionInsideOwnedSafeZone(safeZones, { x, z }, customPlots)
  );
}

function authoritativeCrimeItemValueGold(
  state: HarthmereLiveModeBackendState,
  itemIds: string[]
) {
  return itemIds.reduce((sum, itemId) => {
    if ((state.inventory.items[itemId] ?? 0) <= 0) return sum;
    const def = getHarthmereItemDefinition(itemId);
    return sum + Math.max(0, Math.trunc(def?.baseValue ?? 0));
  }, 0);
}

const HARTHMERE_LIVE_MODE_CRIME_SEVERITY: Record<
  HarthmereLiveModeCrimeKind,
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

const HARTHMERE_LIVE_MODE_CRIME_EVIDENCE_HOURS: Record<
  HarthmereLiveModeCrimeKind,
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

function isHarthmereLiveModeCrimeKind(
  value: string | undefined
): value is HarthmereLiveModeCrimeKind {
  return !!value && value in HARTHMERE_LIVE_MODE_CRIME_SEVERITY;
}

function clampCrimeNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Number(value)));
}

function crimeDetectionScore(input: {
  kind: HarthmereLiveModeCrimeKind;
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
  const base = HARTHMERE_LIVE_MODE_CRIME_SEVERITY[input.kind] / 20;
  const witness = input.witnesses * 15;
  const los = input.lineOfSight ? 25 : -20;
  const noise = clampCrimeNumber(input.noise, 0, 0, 100) * 0.35;
  const lighting =
    input.lighting === "bright"
      ? 20
      : input.lighting === "normal"
      ? 10
      : input.lighting === "dim"
      ? -5
      : -15;
  const disguise = -clampCrimeNumber(input.disguiseQuality, 0, 0, 100) * 0.35;
  const alertness = clampCrimeNumber(input.guardAlertness, 50, 0, 100) * 0.4;
  const crowd =
    input.crowdDensity > 70 && input.kind === "pickpocket"
      ? -10
      : clampCrimeNumber(input.crowdDensity, 0, 0, 100) * 0.05;
  const reputation =
    input.legalStanding < -500 ? 12 : input.legalStanding > 2000 ? -10 : 0;
  const notoriety = input.notoriety > 5000 ? 8 : 0;
  return Math.round(
    clampCrimeNumber(
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

function guardResponseForCrime(input: {
  kind: HarthmereLiveModeCrimeKind;
  valueGold: number;
  legalStanding: number;
  notoriety: number;
  detectionScore: number;
}): HarthmereLiveModeGuardResponseLevel {
  const seriousness =
    HARTHMERE_LIVE_MODE_CRIME_SEVERITY[input.kind] +
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

function fineGoldForCrime(input: {
  kind: HarthmereLiveModeCrimeKind;
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
      ((HARTHMERE_LIVE_MODE_CRIME_SEVERITY[input.kind] +
        input.valueGold * 0.75) *
        repeatOffender *
        notoriety) /
        10
    )
  );
}

function isServerAuthorityEnvelope(
  envelope: HarthmereLiveModeAuthorityEnvelope
) {
  return envelope.source !== "client_request";
}

const HARTHMERE_CIVIL_LAW_FACTION_ID = "city_guard";

function activeBountyGoldForCivilPermits(
  state: HarthmereLiveModeBackendState,
  factionId = HARTHMERE_CIVIL_LAW_FACTION_ID
) {
  return (state.law.crimeRecords ?? []).reduce((sum, record) => {
    if (record.factionId !== factionId) return sum;
    if (record.status !== "wanted" && record.status !== "arrest_pending")
      return sum;
    return sum + Math.max(0, Math.trunc(record.bountyGold ?? 0));
  }, 0);
}

function civilLegalAccessBlockers(input: {
  state: HarthmereLiveModeBackendState;
  factionId?: string;
  minLegalStanding?: number;
  minTownReputation?: number;
}) {
  const factionId = input.factionId ?? HARTHMERE_CIVIL_LAW_FACTION_ID;
  const standing = normalizeReputationStanding(
    input.state.law.standing[factionId]
  );
  const townReputation = input.state.law.reputation[factionId] ?? 0;
  const blockers: string[] = [];
  if (activeBountyGoldForCivilPermits(input.state, factionId) > 0) {
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

function rejectForCivilLegalBlockers(input: {
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

function actorWorldPositionFromAuthority(
  envelope: HarthmereLiveModeAuthorityEnvelope
) {
  if (envelope.serverActorPosition) {
    return envelope.serverActorPosition;
  }
  if (!isServerAuthorityEnvelope(envelope)) {
    return undefined;
  }
  const x = payloadNumber(envelope, "actorX") ?? payloadNumber(envelope, "x");
  const y = payloadNumber(envelope, "actorY") ?? payloadNumber(envelope, "y");
  const z = payloadNumber(envelope, "actorZ") ?? payloadNumber(envelope, "z");
  return x === undefined || y === undefined || z === undefined
    ? undefined
    : { x, y, z };
}

function clientClaimedVisibleCombatTargetPosition(
  envelope: HarthmereLiveModeAuthorityEnvelope
): { x: number; y: number; z: number } | undefined {
  const raw = envelope.clientClaims?.targetPosition;
  let x: unknown;
  let y: unknown;
  let z: unknown;
  if (Array.isArray(raw)) {
    [x, y, z] = raw;
  } else if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    x = record.x;
    y = record.y;
    z = record.z;
  }
  const nx = Number(x);
  const ny = Number(y);
  const nz = Number(z);
  return Number.isFinite(nx) && Number.isFinite(ny) && Number.isFinite(nz)
    ? { x: nx, y: ny, z: nz }
    : undefined;
}

function isServerMuckCombatTargetId(targetId: string): boolean {
  return targetId.startsWith("server-muck-combat:");
}

function applyHarthmereLiveModeCrimeEvent(input: {
  state: HarthmereLiveModeBackendState;
  envelope: HarthmereLiveModeAuthorityEnvelope;
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
  let crimeKind = isHarthmereLiveModeCrimeKind(explicitCrimeKind)
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

  const standing = normalizeReputationStanding(
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
    authoritativeCrimeItemValueGold(input.state, itemIds)
  );
  const lineOfSight =
    payloadBoolean(input.envelope, "lineOfSight") ?? witnesses > 0;
  const noise = payloadNumber(input.envelope, "noise") ?? 0;
  // Whitelist lighting to the known values. An unknown string (e.g. a client sending
  // "pitch") otherwise falls through the detection ternary to the "dark" branch (-15),
  // letting a client fabricate darkness to suppress crime detection.
  const rawLighting = payloadString(input.envelope, "lighting") ?? "normal";
  const lighting = ["bright", "normal", "dim", "dark"].includes(rawLighting)
    ? rawLighting
    : "normal";
  const disguiseQuality = payloadNumber(input.envelope, "disguiseQuality") ?? 0;
  const guardAlertness = payloadNumber(input.envelope, "guardAlertness") ?? 60;
  const crowdDensity = payloadNumber(input.envelope, "crowdDensity") ?? 0;
  const detectionScore = crimeDetectionScore({
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
    !isServerAuthorityEnvelope(input.envelope) &&
    clientDetectedOverride !== undefined
  ) {
    input.warnings.push("law_ignored_client_detected_override");
  }
  const detectedOverride = isServerAuthorityEnvelope(input.envelope)
    ? clientDetectedOverride
    : undefined;
  const detected = detectedOverride ?? (detectionScore >= 35 || witnesses > 0);
  const response = detected
    ? guardResponseForCrime({
        kind: crimeKind,
        valueGold,
        legalStanding: standing.legal,
        notoriety: standing.notoriety,
        detectionScore,
      })
    : "warning";
  const fineGold = detected
    ? fineGoldForCrime({
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
      applyBankRecordDelta(input.state.inventory.items, itemId, -1);
      confiscatedItemIds.push(itemId);
    }
  }

  const severity = HARTHMERE_LIVE_MODE_CRIME_SEVERITY[crimeKind];
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
    HARTHMERE_LIVE_MODE_CRIME_EVIDENCE_HOURS[crimeKind] * 60 * 60 * 1000;
  const detentionUntilMs = [
    "arrest_attempt",
    "combat",
    "reinforcements",
    "city_lockdown",
  ].includes(response)
    ? input.nowMs + Math.max(5, Math.ceil(severity / 100)) * 60 * 1000
    : undefined;
  const status: HarthmereLiveModeCrimeRecord["status"] =
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
  const record: HarthmereLiveModeCrimeRecord = {
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
    harthmereLiveModeSharedStateKey("zone_law", input.envelope.zoneId)
  );
  return record;
}

function distanceSq3(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

const HARTHMERE_EXOTIC_MATTER_DEPOSIT_CLAIM_PREFIX = "exotic_matter_deposit:";
const HARTHMERE_EXOTIC_MATTER_MINE_INTERACTION_RADIUS = 4;

function exoticMatterDepositClaimKey(depositId: string) {
  return `${HARTHMERE_EXOTIC_MATTER_DEPOSIT_CLAIM_PREFIX}${depositId}`;
}

function normalizeExoticMatterDepositClaims(raw: unknown) {
  const value =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, minedAtMs]) =>
          key.startsWith(HARTHMERE_EXOTIC_MATTER_DEPOSIT_CLAIM_PREFIX) &&
          Number.isFinite(Number(minedAtMs))
      )
      .map(([key, minedAtMs]) => [
        key,
        Math.max(0, Math.trunc(Number(minedAtMs))),
      ])
  );
}

function liveExoticMatterDepositStateFromClaims(
  state: HarthmereLiveModeBackendState,
  nowMs: number
) {
  const deposits = defaultHarthmereExoticMatterDepositState();
  for (const entry of Object.values(deposits)) {
    const claimKey = exoticMatterDepositClaimKey(entry.depositId);
    const minedAtMs = state.combat.lootClaims[claimKey];
    if (typeof minedAtMs !== "number") continue;
    const replenishesAtMs =
      minedAtMs + HARTHMERE_EXOTIC_MATTER_DEPOSIT_REPLENISH_MS;
    if (replenishesAtMs > nowMs) {
      entry.available = false;
      entry.minedAtMs = minedAtMs;
      entry.replenishesAtMs = replenishesAtMs;
    } else {
      delete state.combat.lootClaims[claimKey];
    }
  }
  return replenishHarthmereExoticMatterDeposits({ state: deposits, nowMs });
}

// ---------------------------------------------------------------------------
// (foraging audit fix F-A/F-E, 2026-07-14): wild forage bushes and hunted
// animals authored a 12h respawn (`respawnAtMs` in mmo_farming_food_stamina),
// but the backend persisted the claim as a bare timestamp keyed by the RAW
// spawn id and read ANY non-zero value back as "depleted" — the respawn window
// was dead code, so every bush/animal was one-and-done per player forever.
// Mirror the exotic-matter deposit pattern instead:
//   * claims carry an identifying prefix (`wild_spawn:`) so they can be
//     normalized, shared, and expired without guessing at raw ids;
//   * an expired claim (respawn window passed) is deleted on read, making the
//     spawn harvestable again;
//   * claims are projected into the shared world state (`wildSpawnClaims`)
//     and merged back on every actor's sync, so depletion is WORLD-shared —
//     the same berry bush is not independently harvestable by every player
//     (the F-E "per-account scratch-off" problem).
// ---------------------------------------------------------------------------
const HARTHMERE_WILD_SPAWN_CLAIM_PREFIX = "wild_spawn:";
export const HARTHMERE_WILD_SPAWN_RESPAWN_MS = HARTHMERE_HALF_DAY_MS;
const HARTHMERE_GATHERING_NODE_RESPAWN_PREFIX = "gathering_node_respawn:";

function gatheringNodeRespawnKey(nodeId: string) {
  return `${HARTHMERE_GATHERING_NODE_RESPAWN_PREFIX}${nodeId}`;
}

function normalizeGatheringNodeRespawnAtMs(raw: unknown) {
  const value =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, respawnAtMs]) =>
          key.startsWith(HARTHMERE_GATHERING_NODE_RESPAWN_PREFIX) &&
          Number.isFinite(Number(respawnAtMs))
      )
      .map(([key, respawnAtMs]) => [
        key,
        Math.max(0, Math.trunc(Number(respawnAtMs))),
      ])
  );
}

// (foraging fix F-C, 2026-07-14): gather_seed authored no depletion/cooldown, so
// resubmitting it produced unlimited free seeds (and downstream farming XP). Gate
// each (source, seed) pair behind a cooldown so gathering is rate-limited instead
// of spammable. 5 minutes: long enough to defeat the exploit, short enough that
// normal foraging is never blocked in practice.
const HARTHMERE_GATHER_SEED_CLAIM_PREFIX = "gather_seed:";
export const HARTHMERE_GATHER_SEED_COOLDOWN_MS = 5 * 60 * 1000;

function gatherSeedCooldownKey(source: string, seedItemId: string) {
  return `${HARTHMERE_GATHER_SEED_CLAIM_PREFIX}${source}:${seedItemId}`;
}

/**
 * Returns the last-gathered timestamp if the (source, seed) pair is still on
 * cooldown, otherwise deletes the expired claim and returns undefined so the
 * seed can be gathered again.
 */
function gatherSeedOnCooldownAtMs(
  state: HarthmereLiveModeBackendState,
  source: string,
  seedItemId: string,
  nowMs: number
): number | undefined {
  const key = gatherSeedCooldownKey(source, seedItemId);
  const lastAtMs = Number(state.combat.lootClaims[key]);
  if (!Number.isFinite(lastAtMs) || lastAtMs <= 0) return undefined;
  if (lastAtMs + HARTHMERE_GATHER_SEED_COOLDOWN_MS > nowMs) return lastAtMs;
  delete state.combat.lootClaims[key];
  return undefined;
}

function wildSpawnClaimKey(spawnId: string) {
  return `${HARTHMERE_WILD_SPAWN_CLAIM_PREFIX}${spawnId}`;
}

function normalizeWildSpawnClaims(raw: unknown) {
  const value =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, claimedAtMs]) =>
          key.startsWith(HARTHMERE_WILD_SPAWN_CLAIM_PREFIX) &&
          Number.isFinite(Number(claimedAtMs))
      )
      .map(([key, claimedAtMs]) => [
        key,
        Math.max(0, Math.trunc(Number(claimedAtMs))),
      ])
  );
}

/**
 * Returns when the spawn was claimed if the claim is still inside the respawn
 * window, otherwise deletes the stale claim (both the new prefixed key and any
 * legacy raw-id key written before this fix) and returns undefined so the
 * spawn reads as available again.
 */
function wildSpawnActiveClaimAtMs(
  state: HarthmereLiveModeBackendState,
  spawnId: string,
  nowMs: number
): number | undefined {
  const prefixedKey = wildSpawnClaimKey(spawnId);
  const claimedAtMs = Number(
    state.combat.lootClaims[prefixedKey] ?? state.combat.lootClaims[spawnId]
  );
  if (!Number.isFinite(claimedAtMs) || claimedAtMs <= 0) {
    return undefined;
  }
  if (claimedAtMs + HARTHMERE_WILD_SPAWN_RESPAWN_MS > nowMs) {
    return claimedAtMs;
  }
  // Respawn window has passed — expire the claim so the 12h respawn the pure
  // authority functions author actually happens.
  delete state.combat.lootClaims[prefixedKey];
  delete state.combat.lootClaims[spawnId];
  return undefined;
}

const HARTHMERE_BUSINESS_IN_WORLD_INTERACTION_RADIUS = 18;
const HARTHMERE_HOME_CONSOLE_INTERACTION_RADIUS = 5;

function buildingMarkerPosition(marker: BuildingSystemInWorldMarker) {
  return Array.isArray(marker.position) && marker.position.length >= 3
    ? {
        x: Number(marker.position[0]),
        y: Number(marker.position[1]),
        z: Number(marker.position[2]),
      }
    : undefined;
}

function propertyBusinessInteractionPosition(
  property: BuildingSystemPropertyRecord | undefined
) {
  if (!property) return undefined;
  const plot = buildingSystemPlotById(property.plotId);
  const blueprint = buildingSystemBlueprintById(property.blueprintId);
  if (!blueprint) return undefined;
  const origin =
    property.origin ??
    (plot ? buildingSystemDefaultOrigin(plot, blueprint) : undefined);
  if (!origin) return undefined;
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

function outpostBusinessInteractionPosition(outpostBuilding: any) {
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

function economyBusinessInteractionPositions(
  state: HarthmereLiveModeBackendState,
  envelope: HarthmereLiveModeAuthorityEnvelope,
  businessId: string
) {
  const positions: Array<{ x: number; y: number; z: number }> = [];
  const requestedMarkerId = payloadString(
    envelope,
    "businessInteractionMarkerId"
  );
  const requestedMarker = requestedMarkerId
    ? state.building.inWorldMarkers[requestedMarkerId]
    : undefined;
  const requestedMarkerPosition = requestedMarker
    ? buildingMarkerPosition(requestedMarker)
    : undefined;
  if (requestedMarkerPosition) positions.push(requestedMarkerPosition);

  const marker = state.building.inWorldMarkers[`${businessId}:marker`];
  const markerPosition = marker ? buildingMarkerPosition(marker) : undefined;
  if (markerPosition) positions.push(markerPosition);

  const business = state.economy.production.businesses[businessId];
  const property = business?.propertyId
    ? state.property.owned[business.propertyId]
    : Object.values(state.property.owned).find(
        (record) => record.businessId === businessId
      );
  const propertyPosition = propertyBusinessInteractionPosition(property);
  if (propertyPosition) positions.push(propertyPosition);

  const systems = (state.economy.production as any).businessSystems ?? {};
  const branchId = payloadString(envelope, "branchId");
  const outpostId =
    payloadString(envelope, "outpostId") ??
    (branchId ? systems.empireBranches?.[branchId]?.outpostId : undefined);
  const outpostBuilding = outpostId
    ? systems.outpostBuildings?.[outpostId]
    : undefined;
  const outpostPosition = outpostBusinessInteractionPosition(outpostBuilding);
  if (outpostPosition) positions.push(outpostPosition);

  const clientBusinessPosition =
    payloadRecord(envelope, "businessInteractionPosition") ??
    payloadRecord(envelope, "businessInteractionWorldPosition");
  if (clientBusinessPosition) {
    positions.push({
      x: Number(clientBusinessPosition.x),
      y: Number(clientBusinessPosition.y),
      z: Number(clientBusinessPosition.z),
    });
  }

  return positions.filter(
    (position) =>
      Number.isFinite(position.x) &&
      Number.isFinite(position.y) &&
      Number.isFinite(position.z)
  );
}

function rejectEconomyMutationOutsideBusiness(input: {
  state: HarthmereLiveModeBackendState;
  envelope: HarthmereLiveModeAuthorityEnvelope;
  warnings: string[];
  touchedModels: Set<string>;
}) {
  if (input.envelope.actionKind !== "request_economy_mutation") return false;
  if (isServerAuthorityEnvelope(input.envelope)) return false;
  const businessId =
    payloadString(input.envelope, "businessId") ??
    payloadString(input.envelope, "interactionBusinessId") ??
    payloadString(input.envelope, "targetBusinessId");
  if (!businessId) return false;
  const business = input.state.economy.production.businesses[businessId];
  if (!business) return false;
  const actorPosition = actorWorldPositionFromAuthority(input.envelope);
  if (!actorPosition) {
    input.warnings.push("economy_rejected:business_proximity_unverified");
    input.touchedModels.add("economy_business_proximity_rejection");
    return true;
  }
  const positions = economyBusinessInteractionPositions(
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
    HARTHMERE_BUSINESS_IN_WORLD_INTERACTION_RADIUS,
    Math.min(32, Math.max(1, business.serviceRadius ?? 1) * 5)
  );
  if (
    positions.some(
      (position) => distanceSq3(actorPosition, position) <= radius * radius
    )
  ) {
    return false;
  }
  input.warnings.push("economy_rejected:business_proximity_required");
  input.touchedModels.add("economy_business_proximity_rejection");
  return true;
}

function homeConsoleMarkerForProperty(input: {
  state: HarthmereLiveModeBackendState;
  property: BuildingSystemPropertyRecord;
  nowMs: number;
  touchedModels: Set<string>;
}) {
  const expectedId = buildingSystemHomeConsoleMarkerId(
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
  const plot = buildingSystemPlotFromState(input.state, input.property.plotId);
  const blueprint = buildingSystemBlueprintById(input.property.blueprintId);
  if (!plot || !blueprint) return undefined;
  const marker = createBuildingSystemHomeConsoleMarker({
    property: input.property,
    plot,
    blueprint,
    nowMs: input.nowMs,
  });
  input.state.building.inWorldMarkers[marker.markerId] = marker;
  input.touchedModels.add("building_state");
  return marker;
}

function rejectHomeDecorationOutsideConsole(input: {
  state: HarthmereLiveModeBackendState;
  envelope: HarthmereLiveModeAuthorityEnvelope;
  nowMs: number;
  warnings: string[];
  touchedModels: Set<string>;
}) {
  if (input.envelope.actionKind !== "request_home_decoration") return false;
  if (isServerAuthorityEnvelope(input.envelope)) return false;
  const decorationId = payloadString(input.envelope, "decorationId");
  const propertyId =
    payloadString(input.envelope, "propertyId") ??
    (decorationId
      ? input.state.homeDecoration.placed[decorationId]?.propertyId
      : undefined);
  if (!propertyId) return false;
  const property = input.state.property.owned[propertyId];
  if (!property || property.use !== "home") return false;
  const actorPosition = actorWorldPositionFromAuthority(input.envelope);
  if (!actorPosition) {
    input.warnings.push(
      "home_decoration_rejected:console_proximity_unverified"
    );
    input.touchedModels.add("home_decoration_rejection");
    return true;
  }
  const marker = homeConsoleMarkerForProperty({
    state: input.state,
    property,
    nowMs: input.nowMs,
    touchedModels: input.touchedModels,
  });
  const markerPosition = marker ? buildingMarkerPosition(marker) : undefined;
  if (!markerPosition) {
    input.warnings.push("home_decoration_rejected:console_marker_missing");
    input.touchedModels.add("home_decoration_rejection");
    return true;
  }
  if (
    distanceSq3(actorPosition, markerPosition) <=
    HARTHMERE_HOME_CONSOLE_INTERACTION_RADIUS *
      HARTHMERE_HOME_CONSOLE_INTERACTION_RADIUS
  ) {
    return false;
  }
  input.warnings.push("home_decoration_rejected:console_proximity_required");
  input.touchedModels.add("home_decoration_rejection");
  return true;
}

function buildingProjectIdForPlot(plotId: string) {
  return `project_${plotId}`;
}

function buildingPropertyIdForPlot(plotId: string) {
  return `property_${plotId}`;
}

function buildingSystemPlotFromState(
  state: HarthmereLiveModeBackendState,
  plotId: string | undefined
) {
  if (!plotId) return undefined;
  return buildingSystemPlotById(plotId) ?? state.building.customPlots[plotId];
}

function buildingSystemPlotBoundsFromState(
  state: HarthmereLiveModeBackendState,
  plotId: string | undefined
) {
  return (
    buildingSystemPlotFromState(state, plotId)?.bounds ??
    (plotId ? buildingSystemPlotBoundsById(plotId) : undefined)
  );
}

const HARTHMERE_WORLD_PLACEMENT_INTERACTION_RADIUS = 8;

/**
 * Free-world placeables may use open terrain, but they may not overlap another
 * actor's claimed plot. The shared plot-owner ledger is the authorization
 * source; client-supplied ownership or visibility claims are never consulted.
 */
function worldPlacementOverlapsForeignPlot(input: {
  state: HarthmereLiveModeBackendState;
  actorId: string;
  position: { x: number; z: number };
  footprint: { width: number; depth: number };
  rotationDegrees: number;
}) {
  const rotated = input.rotationDegrees === 90 || input.rotationDegrees === 270;
  const width = rotated ? input.footprint.depth : input.footprint.width;
  const depth = rotated ? input.footprint.width : input.footprint.depth;
  const objectBounds = {
    xMin: input.position.x,
    xMax: input.position.x + width,
    zMin: input.position.z,
    zMax: input.position.z + depth,
  };
  return Object.entries(input.state.building.plotOwners).some(
    ([plotId, ownerActorId]) => {
      if (ownerActorId === input.actorId) return false;
      const bounds = buildingSystemPlotBoundsFromState(input.state, plotId);
      return Boolean(
        bounds &&
          objectBounds.xMin <= bounds.xMax &&
          objectBounds.xMax >= bounds.xMin &&
          objectBounds.zMin <= bounds.zMax &&
          objectBounds.zMax >= bounds.zMin
      );
    }
  );
}

function placedStructureBounds(
  origin: { x: number; y: number; z: number } | undefined,
  blueprintId: string | undefined
) {
  if (!origin) return undefined;
  const blueprint = buildingSystemBlueprintById(blueprintId);
  if (!blueprint) return undefined;
  return {
    minX: origin.x,
    maxX: origin.x + blueprint.footprint.width,
    minY: origin.y,
    maxY: origin.y + blueprint.footprint.height,
    minZ: origin.z,
    maxZ: origin.z + blueprint.footprint.depth,
  };
}

function buildingSystemNearbyStructuresForState(
  state: HarthmereLiveModeBackendState
): HarthmereBuildingPlacementContext["nearbyStructures"] {
  const structures: HarthmereBuildingPlacementContext["nearbyStructures"] = [];
  for (const [structureId, structure] of Object.entries(
    state.building.placedStructures
  )) {
    const bounds = placedStructureBounds(
      structure.origin,
      structure.blueprintId
    );
    if (!bounds) continue;
    structures.push({
      structureId,
      ...bounds,
      isProtectedInfrastructure: false,
    });
  }
  for (const [projectId, project] of Object.entries(
    state.building.activeProjects
  )) {
    if (project.status !== "active") continue;
    const bounds = placedStructureBounds(project.origin, project.blueprintId);
    if (!bounds) continue;
    structures.push({
      structureId: projectId,
      ...bounds,
      isProtectedInfrastructure: false,
    });
  }
  return structures;
}

function buildingSystemClaimBlockerForPlot(
  state: HarthmereLiveModeBackendState,
  plot: BuildingSystemPlotDefinition
) {
  for (const ownedPlotId of state.building.ownedPlots) {
    if (ownedPlotId === plot.plotId) continue;
    const ownedPlot = buildingSystemPlotFromState(state, ownedPlotId);
    if (
      ownedPlot &&
      buildingSystemPlotBoundsOverlap(plot.bounds, ownedPlot.bounds, 1)
    ) {
      return `area_already_claimed:${ownedPlotId}`;
    }
  }
  for (const [plotId, authoredPlot] of BUILDING_SYSTEM_PLOTS.map(
    (candidate) => [candidate.plotId, candidate] as const
  )) {
    if (!state.building.ownedPlots.includes(plotId)) continue;
    if (
      plotId !== plot.plotId &&
      buildingSystemPlotBoundsOverlap(plot.bounds, authoredPlot.bounds, 1)
    ) {
      return `area_already_claimed:${plotId}`;
    }
  }
  for (const structure of buildingSystemNearbyStructuresForState(state)) {
    const structureBounds = {
      xMin: structure.minX,
      xMax: structure.maxX,
      zMin: structure.minZ,
      zMax: structure.maxZ,
    };
    if (buildingSystemPlotBoundsOverlap(plot.bounds, structureBounds, 0)) {
      return `existing_building:${structure.structureId}`;
    }
  }
  return undefined;
}

function isBuildingSystemStage(
  stage: string | undefined
): stage is BuildingSystemStage {
  return BUILDING_SYSTEM_CONSTRUCTION_STAGES.includes(stage as any);
}

function nextBuildingSystemStage(
  stage: BuildingSystemStage
): BuildingSystemStage {
  const index = BUILDING_SYSTEM_CONSTRUCTION_STAGES.indexOf(stage as any);
  if (index < 0) {
    return "completed";
  }
  return BUILDING_SYSTEM_CONSTRUCTION_STAGES[index + 1] ?? "completed";
}

function normalizeMaterialContributionPayload(
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

function allBuildingMaterialsComplete(
  required: Record<string, number> | undefined,
  contributed: Record<string, number>
) {
  return Object.entries(required ?? {}).every(
    ([material, count]) => (contributed[material] ?? 0) >= count
  );
}

// Building materials can arrive from the ECS inventory by Bikkie item id, or
// from Harthmere material storage by local material symbol. Count both so the
// full build flow matches what the player sees in inventory and storage UI.
function buildingMaterialLookupKeys(
  line: BuildingSystemMaterialRequirementLine
) {
  return [line.itemId, line.material, line.bikkieName].filter(Boolean);
}

function countBuildingMaterialRecordKeys(
  record: Record<string, number>,
  line: BuildingSystemMaterialRequirementLine
) {
  let count = 0;
  for (const key of new Set(buildingMaterialLookupKeys(line))) {
    count += Math.max(0, Math.trunc(Number(record[key] ?? 0) || 0));
  }
  return count;
}

function countAvailableBuildingMaterial(input: {
  inventoryItems: Record<string, number>;
  materialStorage: Record<string, number>;
  line: BuildingSystemMaterialRequirementLine;
}) {
  return (
    countBuildingMaterialRecordKeys(input.inventoryItems, input.line) +
    countBuildingMaterialRecordKeys(input.materialStorage, input.line)
  );
}

function consumeBuildingMaterialRecordKeys(
  record: Record<string, number>,
  line: BuildingSystemMaterialRequirementLine,
  requested: number
) {
  let remaining = Math.max(0, Math.trunc(requested));
  let consumed = 0;
  for (const key of new Set(buildingMaterialLookupKeys(line))) {
    if (remaining <= 0) break;
    const available = Math.max(0, Math.trunc(Number(record[key] ?? 0) || 0));
    if (available <= 0) continue;
    const take = Math.min(available, remaining);
    recordDelta(record, key, -take);
    remaining -= take;
    consumed += take;
  }
  return { consumed, remaining };
}

function consumeAvailableBuildingMaterial(input: {
  inventoryItems: Record<string, number>;
  materialStorage: Record<string, number>;
  line: BuildingSystemMaterialRequirementLine;
  requested: number;
}) {
  const fromInventory = consumeBuildingMaterialRecordKeys(
    input.inventoryItems,
    input.line,
    input.requested
  );
  const fromStorage =
    fromInventory.remaining > 0
      ? consumeBuildingMaterialRecordKeys(
          input.materialStorage,
          input.line,
          fromInventory.remaining
        )
      : { consumed: 0, remaining: 0 };
  return {
    inventoryConsumed: fromInventory.consumed,
    materialStorageConsumed: fromStorage.consumed,
    remaining: fromStorage.remaining,
  };
}

function normalizePermissionSubject(
  subject: string | undefined
): BuildingSystemPermissionSubject | undefined {
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

function normalizePermissionKey(
  permission: string | undefined
): BuildingSystemPermissionKey | undefined {
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

function normalizeAccessMode(
  mode: string | undefined
): BuildingSystemAccessMode | undefined {
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

function getOwnedPropertyForMutation(input: {
  properties: Record<string, BuildingSystemPropertyRecord>;
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
  const lifecycle = applyBuildingSystemPropertyLifecycle({
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

function computePropertyTierValue(property: BuildingSystemPropertyRecord) {
  return Math.max(property.value + 25, Math.floor(property.value * 1.5));
}

function buildingSystemPhysicalOriginForProperty(
  state: HarthmereLiveModeBackendState,
  property: BuildingSystemPropertyRecord
) {
  return Object.values(state.building.placedStructures).find(
    (structure) =>
      structure.plotId === property.plotId &&
      structure.blueprintId === property.blueprintId &&
      structure.use === property.use
  )?.origin;
}

function syncBuildingSystemPhysicalAccessRecords(input: {
  state: HarthmereLiveModeBackendState;
  property: BuildingSystemPropertyRecord;
  plotId?: string;
  origin?: { x: number; y: number; z: number };
  nowMs: number;
}) {
  const plot = buildingSystemPlotFromState(
    input.state,
    input.property.plotId ?? input.plotId
  );
  const blueprint = buildingSystemBlueprintById(input.property.blueprintId);
  if (!plot || !blueprint) return;
  const origin =
    input.origin ??
    buildingSystemPhysicalOriginForProperty(input.state, input.property);
  const storage = createBuildingSystemStorageContainer({
    property: input.property,
    plot,
    blueprint,
    origin,
    nowMs: input.nowMs,
  });
  const door = createBuildingSystemDoorLock({
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
    const marker = createBuildingSystemHomeConsoleMarker({
      property: input.property,
      plot,
      blueprint,
      origin,
      nowMs: input.nowMs,
    });
    input.state.building.inWorldMarkers[marker.markerId] = marker;
    delete input.state.building.inWorldMarkers[
      `business_${input.property.propertyId}:marker`
    ];
  } else if (input.property.use === "business") {
    const resolvedOrigin =
      origin ?? buildingSystemDefaultOrigin(plot, blueprint);
    const markerId = `business_${input.property.propertyId}:marker`;
    input.state.building.inWorldMarkers[markerId] = {
      markerId,
      plotId: plot.plotId,
      kind: "business_marker",
      position: [
        resolvedOrigin.x + Math.floor(blueprint.footprint.width / 2),
        resolvedOrigin.y + 1,
        resolvedOrigin.z +
          Math.max(
            1,
            Math.min(
              blueprint.footprint.depth - 1,
              blueprint.footprint.depth - 2
            )
          ),
      ],
      label: `${blueprint.displayName} Counter`,
      createdAtMs: input.nowMs,
    };
    delete input.state.building.inWorldMarkers[
      buildingSystemHomeConsoleMarkerId(input.property.propertyId)
    ];
  } else {
    delete input.state.building.inWorldMarkers[
      buildingSystemHomeConsoleMarkerId(input.property.propertyId)
    ];
    delete input.state.building.inWorldMarkers[
      `business_${input.property.propertyId}:marker`
    ];
  }
}

function removeBuildingSystemPhysicalAccessRecords(input: {
  state: HarthmereLiveModeBackendState;
  property: BuildingSystemPropertyRecord;
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
    buildingSystemHomeConsoleMarkerId(input.property.propertyId)
  ];
  delete input.state.building.inWorldMarkers[
    `business_${input.property.propertyId}:marker`
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

function applyDirectInventoryItemPayload(
  target: Record<string, number>,
  envelope: HarthmereLiveModeAuthorityEnvelope,
  options: { includePrimaryItem: boolean }
) {
  let applied = false;

  if (options.includePrimaryItem) {
    const itemId = payloadString(envelope, "itemId");
    const count = payloadPositiveWholeCount(envelope);
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

function wouldDirectInventoryPayloadExceedCarryWeight(
  items: Record<string, number>,
  envelope: HarthmereLiveModeAuthorityEnvelope,
  options: { includePrimaryItem: boolean }
) {
  const projected = { ...items };
  let touched = false;
  if (options.includePrimaryItem) {
    const itemId = payloadString(envelope, "itemId");
    const count = payloadPositiveWholeCount(envelope);
    if (itemId && count !== undefined) {
      applyBankRecordDelta(projected, itemId, count);
      touched = true;
    }
  }
  const itemDeltas = payloadRecord(envelope, "itemDeltas");
  if (itemDeltas) {
    for (const [itemId, rawDelta] of Object.entries(itemDeltas)) {
      if (typeof rawDelta === "number" && Number.isFinite(rawDelta)) {
        applyBankRecordDelta(projected, itemId, rawDelta);
        touched = true;
      }
    }
  }
  return (
    touched &&
    harthmereInventoryCarryWeight(projected) > HARTHMERE_CARRY_WEIGHT_LIMIT
  );
}

const HARTHMERE_STARTER_KNOWN_RECIPE_IDS = [
  HARTHMERE_CRAFTING_STATION_RECIPE_IDS.workbench,
  HARTHMERE_CRAFTING_STATION_RECIPE_IDS.thermolite,
  HARTHMERE_CRAFTING_STATION_RECIPE_IDS.kitchen,
  HARTHMERE_CRAFTING_STATION_RECIPE_IDS.tailoringBooth,
  HARTHMERE_CRAFTING_STATION_RECIPE_IDS.seedMill,
  HARTHMERE_CRAFTING_STATION_RECIPE_IDS.anglersTable,
  HARTHMERE_CRAFTING_STATION_RECIPE_IDS.composter,
  HARTHMERE_HOME_DECORATION_RECIPE_IDS.storageCabinet,
  HARTHMERE_HOME_DECORATION_RECIPE_IDS.hearthLamp,
  HARTHMERE_HOME_DECORATION_RECIPE_IDS.gardenPlanterBox,
  "harthmere_tool_hoe_recipe",
  "harthmere_tool_watering_can_recipe",
  "harthmere_tool_bucket_recipe",
  // Road Ahead step 9 ("Craft a Muck Buster") requires obtaining a muck-clearing
  // tool; teach the recipe up front so the tutorial is completable by crafting.
  "harthmere_tool_muck_buster_recipe",
  "harthmere_blacksmith_repair_iron_sword",
  "harthmere_blacksmith_salvage_iron_sword",
  "harthmere_carpentry_wood_plank",
  "harthmere_carpentry_road_repair_kit",
  "harthmere_leatherworking_boiled_leather",
  "harthmere_alchemy_herbal_extract",
] as const;

function normalizeKnownRecipesWithStarterSet(value?: unknown): string[] {
  const recipes = new Set<string>(HARTHMERE_STARTER_KNOWN_RECIPE_IDS);
  if (Array.isArray(value)) {
    for (const recipeId of value) {
      if (typeof recipeId === "string" && recipeId.length > 0) {
        recipes.add(recipeId);
      }
    }
  }
  return [...recipes];
}

function upsertSkill(
  target: Record<string, { xp: number; level: number }>,
  skillId: string,
  xpDelta: number
) {
  const def = HARTHMERE_SKILL_DEFINITIONS[skillId];
  if (!def) {
    return { ok: false, warning: `skill_xp_rejected:unknown_skill:${skillId}` };
  }
  const current = target[skillId] ?? { xp: 0, level: 1 };
  if (!Number.isFinite(xpDelta) || xpDelta <= 0) {
    return { ok: false, warning: "skill_xp_rejected:invalid_xp_delta" };
  }
  const xp = Math.min(
    harthmereSkillTotalXpCap(skillId),
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
          harthmereSkillLevelFromTotalXp(skillId, xp)
        )
      )
    ),
  };
  if (target[skillId].level >= def.maxLevel && xpDelta > 0) {
    return { ok: true, warning: `skill_xp_capped:max_level:${skillId}` };
  }
  return { ok: true };
}

export function harthmereLiveModePlayerStateKey(actorId: string) {
  return `harthmere:live_mode:current:player_state:${actorId}`;
}

export function harthmereLiveModeLedgerStreamKey(actorId: string) {
  return `harthmere:live_mode:current:ledger:${actorId}`;
}

export function harthmereLiveModeSharedStateKey(kind: string, id: string) {
  return `harthmere:live_mode:current:${kind}:${id}`;
}

function defaultHarthmereBusinessOutpostBuildingState(nowMs: number) {
  const placedStructures: HarthmereLiveModeBackendState["building"]["placedStructures"] =
    {};
  const safeZones: HarthmereLiveModeBackendState["building"]["safeZones"] = {};
  const inWorldMarkers: HarthmereLiveModeBackendState["building"]["inWorldMarkers"] =
    {};
  const materializationPlans: HarthmereLiveModeBackendState["building"]["materializationPlans"] =
    {};
  for (const record of Object.values(
    HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS
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

export function defaultHarthmereLiveModeBackendState(
  actorId: string,
  nowMs: number
): HarthmereLiveModeBackendState {
  const businessOutpostBuildingState =
    defaultHarthmereBusinessOutpostBuildingState(nowMs);
  const state: HarthmereLiveModeBackendState = {
    version: HARTHMERE_LIVE_MODE_BACKEND_VERSION,
    actorId,
    updatedAtMs: nowMs,
    inventory: {
      items: {},
      bank: {},
      equipment: {},
      equipmentInstances: {},
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
      production: defaultHarthmereProductionEconomyState(),
      auctionSellerPayouts: {},
      claimedAuctionPayoutIds: {},
    },
    jobsBoard: defaultHarthmereJobsBoardState(nowMs),
    inventoryLoot: createHarthmereEmptyInventoryLootState(),
    crafting: defaultHarthmereLiveModeCraftingState(),
    homeDecoration: defaultHarthmereHomeDecorationState(),
    placeableWorld: defaultHarthmerePlaceableWorldState(),
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
      plotOwners: {},
      customPlots: {},
      safeZones: businessOutpostBuildingState.safeZones,
      activeProjects: {},
      // HARTHMERE_JOBS_BOARD_GROVE_PLACEMENT:
      // The Grove fountain center is [496, ~70, -126]; (4, 6) lands the
      // posting board on the east edge of the plaza, on the same tile as the
      // Jobs Board voxel kiosk placement in the client. Keeping
      // the live backend marker position aligned with the client landmark
      // means the server-authoritative "is the player near the board?"
      // proximity check uses the same coordinate the player sees.
      //
      // HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN:
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
    robotProtection: createLiveEntityRobotEnergyState(nowMs),
    guild: defaultHarthmereLiveModeGuildState(),
    banking: defaultHarthmereLiveModeBankingState(),
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
      knownRecipes: normalizeKnownRecipesWithStarterSet(),
      skills: {},
      magicSchools: {},
      loadout: { slot_0: "basic_strike" },
      faith: {},
      respecCount: 0,
    },
    collections: defaultHarthmereProgressionCollectionsState(),
    quests: {
      active: {
        [HARTHMERE_READ_JOBS_BOARD_QUEST_ID]: {
          stepId: HARTHMERE_READ_JOBS_BOARD_STEP_ID,
          progress: 0,
        },
        [BUILDING_SYSTEM_MIRA_INTRO_QUEST.questId]: {
          stepId: BUILDING_SYSTEM_MIRA_INTRO_QUEST.stepId,
          progress: 0,
        },
      },
      completed: {},
      // Bible catalog runtime starts empty; quests are accepted through NPC
      // dialogue / world triggers (bible-wiring fix, 2026-07-14).
      bible: defaultHarthmereBibleQuestLiveSlice(),
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
      cooking: {},
    },
    mail: {
      messages: {},
    },
    careLoops: defaultHarthmereCareLoopState(actorId, nowMs),
    combat: {
      hp: 100,
      maxHp: 100,
      ...defaultCombatResourcePools(1),
      lastStaminaTickMs: nowMs,
      deadFromStaminaAtMs: undefined,
      cooldowns: {},
      deathState: "alive",
      deathRecords: {},
      respawnProtectionUntilMs: undefined,
      threat: {},
      lootClaims: {},
      entitySnapshots: createHarthmereServerMuckCombatEntitySnapshots(nowMs),
      npcAiTicks: {},
      liveEntityNavigation: {},
      bossTicks: {},
      partyRaidCredits: {},
    },
  };
  ensureHarthmereBusinessOutpostEconomyRecords(state.economy.production, nowMs);
  ensurePlayerOwnedBusinessOwnerNpcMarkers(state, nowMs);
  syncLiveEntityRobotProtectionToBuilding(state, nowMs);
  return state;
}

/**
 * Storage format for the actor-owned half of the live-mode state.
 *
 * The reducer intentionally receives one merged view because many gameplay
 * operations need player and world data at the same time. That merged view is
 * not, however, the correct Redis ownership boundary. Production economy,
 * placed world structures, containers, jobs, guilds, auctions, robot state,
 * and quest invitations already live in the shared-world record. Persisting
 * them again for every player made a single actor record roughly 33 MB and
 * forced every button press to parse and rewrite the world twice.
 *
 * Keep this serializer shallow: its job is to omit shared-owned branches, not
 * to clone the state. `JSON.stringify` performs the only traversal. This also
 * means a legacy full record is migrated to the compact form on its next
 * successful mutation without an offline migration or a second authority.
 */
export const HARTHMERE_LIVE_MODE_PLAYER_STATE_STORAGE_VERSION = 4;

export function createHarthmereLiveModePlayerPersistenceState(
  state: HarthmereLiveModeBackendState
): Record<string, unknown> {
  const playerState: Record<string, unknown> = { ...state };

  delete playerState.jobsBoard;
  delete playerState.questInvites;
  delete playerState.robotProtection;
  delete playerState.homeDecoration;
  delete playerState.placeableWorld;
  // Property records and construction progress are shared physical-world
  // state. Keeping actor copies here made transfers invisible to recipients.
  delete playerState.property;

  // Guild membership is derivable from the shared guild roster. Retaining the
  // small local membership projection protects rolling deployments where the
  // shared roster and actor write may briefly be observed at different times.
  playerState.guild = {
    guildId: state.guild.guildId,
    memberGuildId: state.guild.memberGuildId,
    role: state.guild.role,
  };

  const playerEconomy: Record<string, unknown> = { ...state.economy };
  delete playerEconomy.production;
  delete playerEconomy.auctionListings;
  delete playerEconomy.auctionSellerPayouts;
  playerState.economy = playerEconomy;

  // `building` mixes ownership. Plot membership belongs to the actor as a
  // projection; the owner ledger and active projects belong to the shared
  // world. Jobs-board objective markers are the exception: they are
  // deliberately excluded from the public marker projection because another
  // player must not see this actor's private objective, so retain those here.
  playerState.building = {
    ownedPlots: [...state.building.ownedPlots],
    inWorldMarkers: Object.fromEntries(
      Object.entries(state.building.inWorldMarkers).filter(([markerId]) =>
        isHarthmereActorJobMarkerId(markerId)
      )
    ),
  };

  // Positioned world drops and pickup tokens are shared. Keep only item
  // instances already transferred into this actor's inventory in the actor
  // record, otherwise a stale player blob can resurrect a claimed drop.
  playerState.inventoryLoot = {
    ...state.inventoryLoot,
    lootDrops: {},
    usedPickupTokens: {},
    itemInstances: Object.fromEntries(
      Object.entries(state.inventoryLoot.itemInstances).filter(
        ([, instance]) => instance.location !== "loot_drop"
      )
    ),
    nextDropNumber: 1,
    nextInstanceNumber: 1,
  };

  playerState.playerStateStorageVersion =
    HARTHMERE_LIVE_MODE_PLAYER_STATE_STORAGE_VERSION;
  return playerState;
}

export function stringifyHarthmereLiveModePlayerPersistenceState(
  state: HarthmereLiveModeBackendState
) {
  return JSON.stringify(createHarthmereLiveModePlayerPersistenceState(state));
}

export function parseHarthmereLiveModeBackendState(
  raw: string | null | undefined,
  actorId: string,
  nowMs: number
): HarthmereLiveModeBackendState {
  if (!raw) {
    return defaultHarthmereLiveModeBackendState(actorId, nowMs);
  }
  try {
    const parsed = JSON.parse(raw) as HarthmereLiveModeBackendState;
    const defaults = defaultHarthmereLiveModeBackendState(actorId, nowMs);
    const businessOutpostBuildingState =
      defaultHarthmereBusinessOutpostBuildingState(nowMs);
    const state: HarthmereLiveModeBackendState = {
      ...defaults,
      ...parsed,
      actorId,
      version: HARTHMERE_LIVE_MODE_BACKEND_VERSION,
      inventory: { ...defaults.inventory, ...(parsed.inventory ?? {}) },
      economy: {
        ...defaults.economy,
        ...(parsed.economy ?? {}),
        businesses: {
          ...defaults.economy.businesses,
          ...((parsed.economy as any)?.businesses ?? {}),
        },
        production: normalizeHarthmereProductionEconomyState(
          (parsed.economy as any)?.production
        ),
      },
      jobsBoard: normalizeHarthmereJobsBoardState(
        (parsed as any).jobsBoard,
        nowMs
      ),
      inventoryLoot: normalizeHarthmereInventoryLootState(
        (parsed as any).inventoryLoot
      ),
      crafting: normalizeCraftingState((parsed as any).crafting),
      homeDecoration: normalizeHarthmereHomeDecorationState(
        (parsed as any).homeDecoration
      ),
      placeableWorld: normalizeHarthmerePlaceableWorldState(
        (parsed as any).placeableWorld
      ),
      guild: normalizeHarthmereLiveModeGuildState((parsed as any).guild, nowMs),
      banking: normalizeBankingState((parsed as any).banking),
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
            normalizeReputationStanding(
              raw as Partial<HarthmereLiveModeReputationStanding>
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
      classMagic: {
        ...defaults.classMagic,
        ...(parsed.classMagic ?? {}),
        // Empty/legacy Cloud Save loadouts should not make starter combat inert.
        loadout: {
          ...defaults.classMagic.loadout,
          ...((parsed.classMagic as any)?.loadout ?? {}),
        },
        knownRecipes: normalizeKnownRecipesWithStarterSet(
          (parsed.classMagic as any)?.knownRecipes
        ),
      },
      collections: normalizeHarthmereProgressionCollectionsState(
        (parsed as any).collections
      ),
      quests: {
        ...defaults.quests,
        ...(parsed.quests ?? {}),
        // Re-validate the bible slice on every deserialize: pre-fix blobs have
        // no `bible` key, and its shape is client-visible state, so it must
        // never round-trip garbage (bible-wiring fix, 2026-07-14).
        bible: normalizeHarthmereBibleQuestLiveSlice(
          (parsed.quests as any)?.bible
        ),
      },
      questInvites: normalizeHarthmereQuestInviteState(
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
            normalizeBuildingSystemPropertyRecord({
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
      careLoops: normalizeHarthmereCareLoopState(
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
        plotOwners: {
          ...defaults.building.plotOwners,
          ...((parsed.building as any)?.plotOwners ?? {}),
        },
        customPlots: {
          ...defaults.building.customPlots,
          ...((parsed.building as any)?.customPlots ?? {}),
        },
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
      robotProtection: normalizeLiveEntityRobotEnergyState(
        (parsed as any).robotProtection,
        nowMs
      ),
    };
    ensureHarthmereBusinessOutpostEconomyRecords(
      state.economy.production,
      nowMs
    );
    ensurePlayerOwnedBusinessOwnerNpcMarkers(state, nowMs);
    syncLiveEntityRobotProtectionToBuilding(state, nowMs);
    repairLiveModeZeroHpDeathState(state, {
      nowMs,
      deathId: `zero_hp_repair:${actorId}`,
      zoneId: "harthmere_wilderness",
      cause: "hp_zero_state_repaired",
    });
    harthmereNormalizeSeededCombatEntitySnapshots(
      state.combat.entitySnapshots,
      nowMs
    );
    harthmereReviveDefeatedSeededCombatEntities(
      state.combat.entitySnapshots,
      nowMs,
      state.combat.lootClaims
    );
    return state;
  } catch {
    return defaultHarthmereLiveModeBackendState(actorId, nowMs);
  }
}

export function harthmereLiveModeSharedWorldStateKey(
  worldId: string = HARTHMERE_LIVE_MODE_SHARED_WORLD_ID
) {
  return harthmereLiveModeSharedStateKey("world", worldId);
}

function createSharedLawStateFromBackend(
  state: HarthmereLiveModeBackendState
): HarthmereLiveModeSharedLawState {
  return {
    reputation: {},
    standing: {},
    recentReputationEvents: [],
    fines: {},
    flags: publicLawFlags(state.law.flags),
    crimeLog: (state.law.crimeLog ?? []).slice(-100),
    crimeRecords: (state.law.crimeRecords ?? []).slice(-100),
    guardResponses: (state.law.guardResponses ?? []).slice(-100),
    restrictedTrespass: { ...state.law.restrictedTrespass },
    detentionUntilMs: {},
  };
}

function normalizeAuctionSellerPayouts(
  raw: unknown
): Record<string, HarthmereAuctionSellerPayout[]> {
  const out: Record<string, HarthmereAuctionSellerPayout[]> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [sellerId, list] of Object.entries(
    raw as Record<string, unknown>
  )) {
    if (!Array.isArray(list)) continue;
    const cleaned = list
      .filter(
        (p): p is Record<string, unknown> => Boolean(p) && typeof p === "object"
      )
      .map((p) => ({
        listingId: String(p.listingId ?? ""),
        goldNet: Math.max(0, Math.trunc(Number(p.goldNet) || 0)),
        itemId: String(p.itemId ?? ""),
        count: Math.max(0, Math.trunc(Number(p.count) || 0)),
        soldAtMs: Math.max(0, Math.trunc(Number(p.soldAtMs) || 0)),
      }))
      .filter((p) => p.listingId && p.itemId);
    if (cleaned.length > 0) out[sellerId] = cleaned;
  }
  return out;
}

function applyAuctionSellerEscrowDelta(
  state: HarthmereLiveModeBackendState,
  itemId: string | undefined,
  escrowDelta: number
) {
  if (!itemId || !escrowDelta) return;
  state.inventory.escrow = { ...state.inventory.escrow };
  state.inventory.escrow[itemId] = Math.max(
    0,
    (state.inventory.escrow[itemId] ?? 0) + escrowDelta
  );
  if (state.inventory.escrow[itemId] <= 0)
    delete state.inventory.escrow[itemId];
}

export function createHarthmereLiveModeSharedWorldState(
  state: HarthmereLiveModeBackendState,
  nowMs: number = state.updatedAtMs
): HarthmereLiveModeSharedWorldState {
  return {
    version: HARTHMERE_LIVE_MODE_BACKEND_VERSION,
    sharedAuthoritySchemaVersion: 2,
    worldId: HARTHMERE_LIVE_MODE_SHARED_WORLD_ID,
    updatedAtMs: nowMs,
    economyProduction: normalizeHarthmereProductionEconomyState(
      state.economy.production
    ),
    jobsBoard: normalizeHarthmereJobsBoardState(state.jobsBoard, nowMs),
    inventoryLootWorld: {
      lootDrops: { ...state.inventoryLoot.lootDrops },
      dropItemInstances: Object.fromEntries(
        Object.entries(state.inventoryLoot.itemInstances).filter(
          ([, instance]) => instance.location === "loot_drop"
        )
      ),
      usedPickupTokens: { ...state.inventoryLoot.usedPickupTokens },
      nextDropNumber: state.inventoryLoot.nextDropNumber,
      nextInstanceNumber: state.inventoryLoot.nextInstanceNumber,
    },
    building: normalizeHarthmereLiveModeSharedBuildingState(
      {
        ...state.building,
        plotOwners: {
          ...Object.fromEntries(
            state.building.ownedPlots.map((plotId) => [plotId, state.actorId])
          ),
          ...state.building.plotOwners,
        },
        propertyRecords: state.property.owned,
        propertyBuildingProgress: state.property.buildingProgress,
      },
      nowMs
    ),
    homeDecoration: normalizeHarthmereHomeDecorationState(state.homeDecoration),
    placeableWorld: normalizeHarthmerePlaceableWorldState(state.placeableWorld),
    law: createSharedLawStateFromBackend(state),
    guild: normalizeHarthmereLiveModeGuildState(state.guild, nowMs),
    robotProtection: normalizeLiveEntityRobotEnergyState(
      state.robotProtection,
      nowMs
    ),
    exoticMatterDepositClaims: normalizeExoticMatterDepositClaims(
      state.combat.lootClaims
    ),
    // (foraging fix F-E, 2026-07-14): project wild-spawn depletion into the
    // shared world so every player sees the same depleted/respawned bushes.
    wildSpawnClaims: normalizeWildSpawnClaims(state.combat.lootClaims),
    gatheringNodeRespawnAtMs: normalizeGatheringNodeRespawnAtMs(
      state.combat.lootClaims
    ),
    questInvites: normalizeHarthmereQuestInviteState(state.questInvites, nowMs),
    auctionListings: { ...state.economy.auctionListings },
    auctionSellerPayouts: normalizeAuctionSellerPayouts(
      state.economy.auctionSellerPayouts
    ),
  };
}

export function parseHarthmereLiveModeSharedWorldState(
  raw: string | null | undefined,
  nowMs: number
): HarthmereLiveModeSharedWorldState | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(
      raw
    ) as Partial<HarthmereLiveModeSharedWorldState>;
    const law = (parsed as any).law ?? {};
    return {
      version: HARTHMERE_LIVE_MODE_BACKEND_VERSION,
      sharedAuthoritySchemaVersion: Math.max(
        0,
        Math.trunc(Number((parsed as any).sharedAuthoritySchemaVersion) || 0)
      ),
      worldId: HARTHMERE_LIVE_MODE_SHARED_WORLD_ID,
      updatedAtMs: Math.max(
        0,
        Math.trunc(Number(parsed.updatedAtMs ?? nowMs) || nowMs)
      ),
      economyProduction: normalizeHarthmereProductionEconomyState(
        (parsed as any).economyProduction ?? (parsed as any).economy?.production
      ),
      jobsBoard: normalizeHarthmereJobsBoardState(
        (parsed as any).jobsBoard,
        nowMs
      ),
      inventoryLootWorld:
        normalizeHarthmereLiveModeSharedInventoryLootWorldState(
          (parsed as any).inventoryLootWorld
        ),
      building: normalizeHarthmereLiveModeSharedBuildingState(
        (parsed as any).building,
        nowMs
      ),
      homeDecoration: normalizeHarthmereHomeDecorationState(
        (parsed as any).homeDecoration
      ),
      placeableWorld: normalizeHarthmerePlaceableWorldState(
        (parsed as any).placeableWorld
      ),
      robotProtection: normalizeLiveEntityRobotEnergyState(
        (parsed as any).robotProtection,
        nowMs
      ),
      law: {
        reputation: { ...(law.reputation ?? {}) },
        standing: Object.fromEntries(
          Object.entries((law.standing ?? {}) as Record<string, unknown>).map(
            ([scopeId, standing]) => [
              scopeId,
              normalizeReputationStanding(
                standing as Partial<HarthmereLiveModeReputationStanding>
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
      guild: normalizeHarthmereLiveModeGuildState((parsed as any).guild, nowMs),
      exoticMatterDepositClaims: normalizeExoticMatterDepositClaims(
        (parsed as any).exoticMatterDepositClaims
      ),
      // (foraging fix F-E, 2026-07-14): round-trip the shared wild-spawn claims.
      wildSpawnClaims: normalizeWildSpawnClaims(
        (parsed as any).wildSpawnClaims
      ),
      gatheringNodeRespawnAtMs: normalizeGatheringNodeRespawnAtMs(
        (parsed as any).gatheringNodeRespawnAtMs
      ),
      questInvites: normalizeHarthmereQuestInviteState(
        (parsed as any).questInvites,
        nowMs
      ),
      auctionListings: { ...((parsed as any).auctionListings ?? {}) },
      auctionSellerPayouts: normalizeAuctionSellerPayouts(
        (parsed as any).auctionSellerPayouts
      ),
    };
  } catch {
    return undefined;
  }
}

export function mergeHarthmereLiveModeSharedWorldStateIntoBackend(
  state: HarthmereLiveModeBackendState,
  shared: HarthmereLiveModeSharedWorldState | undefined,
  nowMs: number
) {
  if (!shared) return state;
  const sharedWorldObjectsAreAuthoritative =
    shared.sharedAuthoritySchemaVersion >= 2;
  state.economy.production = normalizeHarthmereProductionEconomyState(
    shared.economyProduction
  );
  ensureHarthmereBusinessOutpostEconomyRecords(state.economy.production, nowMs);
  state.jobsBoard = normalizeHarthmereJobsBoardState(shared.jobsBoard, nowMs);
  const sharedLoot = normalizeHarthmereLiveModeSharedInventoryLootWorldState(
    shared.inventoryLootWorld
  );
  state.inventoryLoot.lootDrops = sharedWorldObjectsAreAuthoritative
    ? { ...sharedLoot.lootDrops }
    : {
        ...state.inventoryLoot.lootDrops,
        ...sharedLoot.lootDrops,
      };
  state.inventoryLoot.usedPickupTokens = {
    ...state.inventoryLoot.usedPickupTokens,
    ...sharedLoot.usedPickupTokens,
  };
  state.inventoryLoot.itemInstances = {
    ...Object.fromEntries(
      Object.entries(state.inventoryLoot.itemInstances).filter(
        ([, instance]) =>
          !sharedWorldObjectsAreAuthoritative ||
          instance.location !== "loot_drop"
      )
    ),
    ...sharedLoot.dropItemInstances,
  };
  state.inventoryLoot.nextDropNumber = Math.max(
    state.inventoryLoot.nextDropNumber,
    sharedLoot.nextDropNumber
  );
  state.inventoryLoot.nextInstanceNumber = Math.max(
    state.inventoryLoot.nextInstanceNumber,
    sharedLoot.nextInstanceNumber
  );
  state.questInvites = normalizeHarthmereQuestInviteState(
    shared.questInvites,
    nowMs
  );
  // Auction marketplace is shared so a buyer can see/settle another player's listing.
  state.economy.auctionListings = { ...(shared.auctionListings ?? {}) };
  state.economy.auctionSellerPayouts = normalizeAuctionSellerPayouts(
    shared.auctionSellerPayouts
  );
  state.economy.claimedAuctionPayoutIds =
    state.economy.claimedAuctionPayoutIds ?? {};
  // Deliver this actor's owed auction sale proceeds exactly once (the shared blob is
  // last-write-wins and can re-deliver, so guard on the locally-recorded claimed ids).
  for (const payout of (shared.auctionSellerPayouts ?? {})[state.actorId] ??
    []) {
    if (state.economy.claimedAuctionPayoutIds[payout.listingId]) continue;
    state.economy.claimedAuctionPayoutIds[payout.listingId] = nowMs;
    state.inventory.gold = Math.max(
      0,
      state.inventory.gold + Math.max(0, payout.goldNet)
    );
    if (payout.count > 0 && payout.itemId) {
      // Release the sold stack from the seller's escrow lock and inventory.
      state.inventory.escrow = { ...state.inventory.escrow };
      state.inventory.escrow[payout.itemId] = Math.max(
        0,
        (state.inventory.escrow[payout.itemId] ?? 0) - payout.count
      );
      if (state.inventory.escrow[payout.itemId] <= 0)
        delete state.inventory.escrow[payout.itemId];
      state.inventory.items[payout.itemId] = Math.max(
        0,
        (state.inventory.items[payout.itemId] ?? 0) - payout.count
      );
      if (state.inventory.items[payout.itemId] <= 0)
        delete state.inventory.items[payout.itemId];
    }
  }
  const sharedBuilding = normalizeHarthmereLiveModeSharedBuildingState(
    shared.building,
    nowMs
  );
  const businessOutpostBuildingState =
    defaultHarthmereBusinessOutpostBuildingState(nowMs);
  state.building = {
    ...state.building,
    placedStructures: {
      ...state.building.placedStructures,
      ...sharedBuilding.placedStructures,
      ...businessOutpostBuildingState.placedStructures,
    },
    customPlots: {
      ...state.building.customPlots,
      ...sharedBuilding.customPlots,
    },
    safeZones: {
      ...state.building.safeZones,
      ...sharedBuilding.safeZones,
      ...businessOutpostBuildingState.safeZones,
    },
    plotOwners: {
      ...Object.fromEntries(
        state.building.ownedPlots.map((plotId) => [plotId, state.actorId])
      ),
      ...state.building.plotOwners,
      ...sharedBuilding.plotOwners,
    },
    activeProjects: {
      ...state.building.activeProjects,
      ...sharedBuilding.activeProjects,
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
  state.building.ownedPlots = Object.entries(state.building.plotOwners)
    .filter(([, ownerActorId]) => ownerActorId === state.actorId)
    .map(([plotId]) => plotId);
  // Legacy actor records may contain properties from before the shared-world
  // migration. Merge those once, then let the shared record own all future
  // mutations so transfers and decoration collisions are globally coherent.
  state.property = {
    owned: sharedWorldObjectsAreAuthoritative
      ? { ...sharedBuilding.propertyRecords }
      : {
          ...state.property.owned,
          ...sharedBuilding.propertyRecords,
        },
    buildingProgress: sharedWorldObjectsAreAuthoritative
      ? { ...sharedBuilding.propertyBuildingProgress }
      : {
          ...state.property.buildingProgress,
          ...sharedBuilding.propertyBuildingProgress,
        },
  };
  state.homeDecoration = normalizeHarthmereHomeDecorationState(
    sharedWorldObjectsAreAuthoritative
      ? shared.homeDecoration
      : {
          ...state.homeDecoration,
          ...shared.homeDecoration,
          placed: {
            ...state.homeDecoration.placed,
            ...shared.homeDecoration.placed,
          },
          appliedRequestIds: {
            ...state.homeDecoration.appliedRequestIds,
            ...shared.homeDecoration.appliedRequestIds,
          },
          nextDecorationNumber: Math.max(
            state.homeDecoration.nextDecorationNumber,
            shared.homeDecoration.nextDecorationNumber
          ),
        }
  );
  state.placeableWorld = normalizeHarthmerePlaceableWorldState(
    sharedWorldObjectsAreAuthoritative
      ? shared.placeableWorld
      : {
          ...state.placeableWorld,
          ...shared.placeableWorld,
          placed: {
            ...state.placeableWorld.placed,
            ...shared.placeableWorld.placed,
          },
          appliedRequestIds: {
            ...state.placeableWorld.appliedRequestIds,
            ...shared.placeableWorld.appliedRequestIds,
          },
          nextObjectNumber: Math.max(
            state.placeableWorld.nextObjectNumber,
            shared.placeableWorld.nextObjectNumber
          ),
        }
  );
  state.robotProtection = normalizeLiveEntityRobotEnergyState(
    shared.robotProtection,
    nowMs
  );
  const sharedExoticMatterDepositClaims = normalizeExoticMatterDepositClaims(
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
  // (foraging fix F-E, 2026-07-14): merge shared wild-spawn depletion the same
  // way — newest claim wins so a bush another player just foraged reads as
  // depleted for everyone until its respawn window elapses.
  const sharedWildSpawnClaims = normalizeWildSpawnClaims(
    shared.wildSpawnClaims
  );
  for (const [claimKey, claimedAtMs] of Object.entries(sharedWildSpawnClaims)) {
    state.combat.lootClaims[claimKey] = Math.max(
      state.combat.lootClaims[claimKey] ?? 0,
      claimedAtMs
    );
  }
  const sharedGatheringNodeRespawns = normalizeGatheringNodeRespawnAtMs(
    shared.gatheringNodeRespawnAtMs
  );
  for (const [claimKey, respawnAtMs] of Object.entries(
    sharedGatheringNodeRespawns
  )) {
    state.combat.lootClaims[claimKey] = Math.max(
      state.combat.lootClaims[claimKey] ?? 0,
      respawnAtMs
    );
  }
  syncLiveEntityRobotProtectionToBuilding(state, nowMs);
  state.law = {
    ...state.law,
    flags: {
      ...state.law.flags,
      ...publicLawFlags(shared.law.flags),
    },
    crimeLog: mergeByIdNewestFirst(
      state.law.crimeLog,
      shared.law.crimeLog,
      100
    ),
    crimeRecords: mergeByIdNewestFirst(
      state.law.crimeRecords,
      shared.law.crimeRecords,
      100
    ),
    guardResponses: mergeByIdNewestFirst(
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
  const sharedGuild = normalizeHarthmereLiveModeGuildState(shared.guild, nowMs);
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
  ensurePlayerOwnedBusinessOwnerNpcMarkers(state, nowMs);
  return state;
}

export function createHarthmereLiveModeGuildClientSnapshotFromBackend(
  state: HarthmereLiveModeBackendState
) {
  return createHarthmereLiveModeGuildClientSnapshot(state.guild, state.actorId);
}

export function createHarthmereInventoryLootClientSnapshotFromBackend(
  state: HarthmereLiveModeBackendState
) {
  if (!state.inventoryLoot.actors[state.actorId]) {
    state.inventoryLoot.actors[state.actorId] =
      createHarthmereInventoryLootActor(state.actorId, {
        gold: state.inventory.gold,
        items: { ...state.inventory.items },
        bank: { ...state.inventory.bank },
        equipment: { ...state.inventory.equipment },
        equipmentInstances: { ...state.inventory.equipmentInstances },
      });
  } else {
    const actor = state.inventoryLoot.actors[state.actorId];
    actor.gold = state.inventory.gold;
    actor.items = { ...state.inventory.items };
    actor.bank = { ...state.inventory.bank };
    actor.equipment = { ...state.inventory.equipment };
    actor.equipmentInstances = { ...state.inventory.equipmentInstances };
  }
  const snapshot = createHarthmereInventoryLootClientSnapshot(
    state.inventoryLoot,
    state.actorId
  );
  const nativeDropInstanceIds = nativeBiomesEcsAuthorityEnabled()
    ? new Set(
        Object.values(state.inventoryLoot.lootDrops).flatMap(
          (drop) => drop.instanceIds
        )
      )
    : undefined;
  return {
    ...snapshot,
    ...(nativeDropInstanceIds
      ? {
          availableLootDrops: [],
          itemInstances: Object.fromEntries(
            Object.entries(snapshot.itemInstances).filter(
              ([instanceId]) => !nativeDropInstanceIds.has(instanceId)
            )
          ),
        }
      : {}),
    overflow: state.inventory.overflow.map((entry) => ({ ...entry })),
    materialStorage: {
      items: { ...state.banking.materialStorage },
      maxSlots: state.banking.materialStorageMaxSlots,
      usedSlots: countOccupiedBankSlots(state.banking.materialStorage),
    },
  };
}

/**
 * Convert every still-available shared compatibility drop into the durable
 * native ECS outbox shape. This is also called by the inventory read endpoint
 * so drops saved before this migration are repaired on login without waiting
 * for an unrelated player mutation.
 */
export function harthmereNativeEcsPlansForAvailableInventoryLoot(
  state: HarthmereLiveModeBackendState,
  nowMs: number
): HarthmereNativeEcsDropMaterializationPlan[] {
  const plans: HarthmereNativeEcsDropMaterializationPlan[] = [];
  for (const drop of Object.values(state.inventoryLoot.lootDrops)) {
    if (
      drop.status !== "available" ||
      !drop.position ||
      drop.expiresAtMs <= nowMs
    ) {
      continue;
    }
    const itemStacks = { ...drop.itemStacks };
    for (const instanceId of drop.instanceIds) {
      const instance = state.inventoryLoot.itemInstances[instanceId];
      if (!instance || instance.quantity <= 0) continue;
      itemStacks[instance.itemId] =
        (itemStacks[instance.itemId] ?? 0) + instance.quantity;
    }
    if (!Object.values(itemStacks).some((count) => count > 0)) continue;
    plans.push({
      kind: "drop",
      materializationKey: `inventory-loot:${drop.dropId}`,
      position: { ...drop.position },
      itemStacks,
      ownerActorIds: [...drop.ownerActorIds],
      expiresAtMs: drop.expiresAtMs,
      mined: false,
      sourceKind: drop.sourceKind,
    });
  }
  return plans;
}

function normalizedLiveModePlayerHp(
  state: Pick<HarthmereLiveModeBackendState, "combat">
) {
  return Math.max(0, Math.trunc(Number(state.combat.hp ?? 0)));
}

function liveModePlayerDeathStateForHp(
  state: Pick<HarthmereLiveModeBackendState, "combat">
): NonNullable<HarthmereLiveModeBackendState["combat"]["deathState"]> {
  const deathState = state.combat.deathState ?? "alive";
  return normalizedLiveModePlayerHp(state) <= 0 && deathState === "alive"
    ? "dead"
    : deathState;
}

function repairLiveModeZeroHpDeathState(
  state: HarthmereLiveModeBackendState,
  input: {
    nowMs: number;
    deathId: string;
    zoneId: string;
    cause: string;
    respawnDelayMs?: number;
    createDeathRecord?: boolean;
  }
) {
  const hp = normalizedLiveModePlayerHp(state);
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

export function createHarthmereLiveEntityCombatClientSnapshot(
  state: HarthmereLiveModeBackendState
) {
  return {
    version: "harthmere-live-entity-combat-client",
    actorId: state.actorId,
    updatedAtMs: state.updatedAtMs,
    entitySnapshots: Object.fromEntries(
      Object.entries(state.combat.entitySnapshots).map(([entityId, entity]) => [
        entityId,
        {
          entityKind: entity.entityKind,
          position: entity.position,
          hp: entity.hp,
          maxHp: entity.maxHp,
          lastDamageTaken: entity.lastDamageTaken,
          lastAttackedAtMs: entity.lastAttackedAtMs,
          isAlive: entity.isAlive,
          isAttackable: entity.isAttackable,
          animationState: entity.animationState,
          animationMoving: entity.animationMoving,
          facingYaw: entity.facingYaw,
          combatProtection: entity.combatProtection,
          escortJobId: entity.escortJobId,
          escortActorId: entity.escortActorId,
          escortCompanionId: entity.escortCompanionId,
          escortDisplayName: entity.escortDisplayName,
          escortDestination: entity.escortDestination,
          escortStatus: entity.escortStatus,
        },
      ])
    ),
    npcAiTicks: { ...state.combat.npcAiTicks },
  };
}

export function createHarthmereCraftingStationClientSnapshotFromBackend(
  state: HarthmereLiveModeBackendState,
  stationId?: string | number,
  stationType?: string,
  nowMs: number = state.updatedAtMs
) {
  ensureHarthmereProductionCraftingCatalogue();
  const normalizedStationId = normalizeHarthmereCraftingStationId(stationId);
  const station = getHarthmereCraftingStation(normalizedStationId);
  return {
    actorId: state.actorId,
    stationId: normalizedStationId,
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

export function createHarthmereLiveModeFarmingFoodClientSnapshot(
  state: HarthmereLiveModeBackendState
) {
  const pools = ensureCombatResourcePools(state);
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
    version: "harthmere-live-mode-farming-food",
    actorId: state.actorId,
    stamina: Math.max(0, Math.trunc(Number(pools.resources.stamina ?? 0))),
    maxStamina: Math.max(
      1,
      Math.trunc(Number(pools.maxResources.stamina ?? 100))
    ),
    lastStaminaTickMs: state.combat.lastStaminaTickMs,
    deadFromStaminaAtMs: state.combat.deadFromStaminaAtMs,
    inventory: { ...state.inventory.items },
    materialStorage: { ...state.banking.materialStorage },
    foodDefinitions: HARTHMERE_FOOD_DEFINITIONS,
    seedDefinitions: HARTHMERE_SEED_DEFINITIONS,
    cookingRecipes: HARTHMERE_COOKING_RECIPES,
    availableCookingStations: Array.from(availableCookingStations),
    plots: Object.entries(state.farming.plots).map(([plotId, plot]) => ({
      plotId,
      ...plot,
      ready: Number(plot.harvestReadyAtMs ?? Number.POSITIVE_INFINITY) <= nowMs,
      // Surfaced so the UI can prompt "water for a full harvest" before ripening.
      watered: Boolean(plot.wateredAtMs),
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
    cookingStations: Object.values(
      tickHarthmereCooking(state.farming.cooking ?? {}, nowMs)
    ).map((station) => ({
      stationId: station.stationId,
      stationKind: station.stationKind,
      label: station.label,
      jobs: station.jobs.map((job) => {
        const recipe = HARTHMERE_COOKING_RECIPES[job.recipeId];
        const span = Math.max(1, job.readyAtMs - job.startedAtMs);
        const progress =
          job.status === "ready"
            ? 1
            : Math.max(0, Math.min(1, (nowMs - job.startedAtMs) / span));
        return {
          jobId: job.jobId,
          recipeId: job.recipeId,
          displayName: recipe?.displayName ?? job.recipeId,
          count: job.count,
          status: job.status,
          startedAtMs: job.startedAtMs,
          readyAtMs: job.readyAtMs,
          progress,
          outputs: recipe?.outputs ?? {},
        };
      }),
    })),
    updatedAtMs: state.updatedAtMs,
  };
}

export function tickHarthmereLiveModeStaminaForGameplay(
  state: HarthmereLiveModeBackendState,
  input: {
    nowMs: number;
    gameplayActive: boolean;
    allowDeathFromStamina?: boolean;
  }
) {
  if (
    (state.combat.deathState ?? "alive") !== "alive" ||
    normalizedLiveModePlayerHp(state) <= 0
  ) {
    return {
      warnings: [],
      deathTriggered: false,
      changed: false,
    };
  }
  const pools = ensureCombatResourcePools(state);
  const allowDeathFromStamina = input.allowDeathFromStamina !== false;
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
    ...defaultHarthmereFoodStaminaState(state.actorId, input.nowMs),
    stamina: previousStamina,
    maxStamina,
    lastStaminaTickMs,
    deadFromStaminaAtMs,
    inventory: carriedItemsForWeight(
      state.inventory.items,
      state.banking.materialStorage
    ),
  };
  const result = tickHarthmereStaminaForGameplay(authorityState, input);
  const nextStamina = Math.max(
    0,
    Math.min(maxStamina, Number(result.state.stamina))
  );
  const previousStoredLastTick = state.combat.lastStaminaTickMs;
  const previousStoredDeadAt = state.combat.deadFromStaminaAtMs;

  pools.resources.stamina = nextStamina;
  state.combat.lastStaminaTickMs = result.state.lastStaminaTickMs;
  const depletedForDeath =
    nextStamina < 1 && !Number.isFinite(Number(previousStoredDeadAt));
  const shouldTriggerStaminaDeath =
    allowDeathFromStamina && (result.deathTriggered || depletedForDeath);
  state.combat.deadFromStaminaAtMs = shouldTriggerStaminaDeath
    ? input.nowMs
    : allowDeathFromStamina
    ? result.state.deadFromStaminaAtMs
    : previousStoredDeadAt;

  if (shouldTriggerStaminaDeath) {
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
    deathTriggered: shouldTriggerStaminaDeath,
    changed:
      Math.abs(nextStamina - previousStamina) > 0.0001 ||
      state.combat.lastStaminaTickMs !== previousStoredLastTick ||
      state.combat.deadFromStaminaAtMs !== previousStoredDeadAt ||
      shouldTriggerStaminaDeath,
  };
}

function latestHarthmereLiveModeDeathRecord(
  state: HarthmereLiveModeBackendState
) {
  return Object.values(state.combat.deathRecords ?? {})
    .filter(
      (
        record
      ): record is HarthmereLiveModeBackendState["combat"]["deathRecords"][string] =>
        Boolean(record) && Number.isFinite(Number(record.atMs))
    )
    .sort((a, b) => Number(b.atMs) - Number(a.atMs))[0];
}

export function repairHarthmereStatusReadStaminaDeath(
  state: HarthmereLiveModeBackendState,
  input: { nowMs: number; restoreRatio?: number }
) {
  void state;
  void input;
  return { changed: false };
}

export function createHarthmereProductionEconomyClientSnapshotFromBackend(
  state: HarthmereLiveModeBackendState
) {
  ensureHarthmereBusinessOutpostEconomyRecords(
    state.economy.production,
    state.updatedAtMs || Date.now()
  );
  return createHarthmereProductionEconomyClientSnapshot(
    state.economy.production,
    state.actorId,
    state.classMagic.knownRecipes
  );
}

function harthmereJobsBoardLawRecordSummary(
  record: HarthmereLiveModeCrimeRecord
) {
  return {
    id: record.id,
    actorId: record.actorId,
    kind: record.kind,
    zoneId: record.zoneId,
    factionId: record.factionId,
    locationId: record.locationId,
    targetId: record.targetId,
    restrictedAreaId: record.restrictedAreaId,
    resourceNodeId: record.resourceNodeId,
    severity: Math.max(0, Math.trunc(Number(record.severity) || 0)),
    valueGold: Math.max(0, Math.trunc(Number(record.valueGold) || 0)),
    witnessLevel: record.witnessLevel,
    witnesses: Math.max(0, Math.trunc(Number(record.witnesses) || 0)),
    detected: Boolean(record.detected),
    response: record.response,
    fineGold: Math.max(0, Math.trunc(Number(record.fineGold) || 0)),
    bountyGold: Math.max(0, Math.trunc(Number(record.bountyGold) || 0)),
    status: record.status,
    evidenceExpiresAtMs: Math.max(
      0,
      Math.trunc(Number(record.evidenceExpiresAtMs) || 0)
    ),
    createdAtMs: Math.max(0, Math.trunc(Number(record.createdAtMs) || 0)),
  };
}

export function createHarthmereJobsBoardLawSummaryFromBackend(
  state: HarthmereLiveModeBackendState
) {
  const primaryStanding = liveModePrimaryStanding(state);
  const activeBounties = (state.law.crimeRecords ?? [])
    .filter(
      (record) =>
        (record.status === "wanted" || record.status === "arrest_pending") &&
        Math.trunc(Number(record.bountyGold) || 0) > 0
    )
    .sort(
      (a, b) =>
        Math.max(0, Math.trunc(Number(b.bountyGold) || 0)) -
          Math.max(0, Math.trunc(Number(a.bountyGold) || 0)) ||
        Math.max(0, Math.trunc(Number(b.createdAtMs) || 0)) -
          Math.max(0, Math.trunc(Number(a.createdAtMs) || 0))
    )
    .map(harthmereJobsBoardLawRecordSummary);
  const myActiveBounties = activeBounties.filter(
    (record) => record.actorId === state.actorId
  );
  const positiveFines = Object.fromEntries(
    Object.entries(state.law.fines ?? {})
      .map(([factionId, value]): [string, number] => [
        factionId,
        Math.max(0, Math.trunc(Number(value) || 0)),
      ])
      .filter(([, value]) => value > 0)
  );
  return {
    version: "harthmere-jobs-board-law-summary",
    actorId: state.actorId,
    standing: {
      scopeId: primaryStanding.scopeId,
      ...primaryStanding.standing,
    },
    fines: positiveFines,
    flags: publicLawFlags(state.law.flags),
    activeBounties,
    myActiveBounties,
    totalBountyGold: activeBounties.reduce(
      (sum, record) => sum + record.bountyGold,
      0
    ),
    myTotalBountyGold: myActiveBounties.reduce(
      (sum, record) => sum + record.bountyGold,
      0
    ),
    recentCrimeRecords: (state.law.crimeRecords ?? [])
      .slice()
      .sort(
        (a, b) =>
          Math.max(0, Math.trunc(Number(b.createdAtMs) || 0)) -
          Math.max(0, Math.trunc(Number(a.createdAtMs) || 0))
      )
      .slice(0, 10)
      .map(harthmereJobsBoardLawRecordSummary),
    updatedAtMs: state.updatedAtMs,
  };
}

export function createHarthmereJobsBoardClientSnapshotFromBackend(
  state: HarthmereLiveModeBackendState
) {
  const snapshot = createHarthmereJobsBoardClientSnapshotAtTime(
    state.jobsBoard,
    state.actorId,
    state.updatedAtMs || Date.now()
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
    lawSummary: createHarthmereJobsBoardLawSummaryFromBackend(state),
  };
}

export function createHarthmereCareLoopClientSnapshotFromBackend(
  state: HarthmereLiveModeBackendState,
  nowMs: number = state.updatedAtMs
): HarthmereCareLoopClientSnapshot {
  return createHarthmereCareLoopClientSnapshot(state.careLoops, nowMs);
}

export function createHarthmereLiveModeBuildingClientSnapshot(
  state: HarthmereLiveModeBackendState
) {
  return {
    actorId: state.actorId,
    gold: state.inventory.gold,
    inventoryItems: state.inventory.items,
    materialStorage: { ...state.banking.materialStorage },
    ownedPlotIds: state.building.ownedPlots,
    customPlots: state.building.customPlots,
    safeZones: state.building.safeZones,
    activeProjects: state.building.activeProjects,
    placedStructureIds: Object.values(state.building.placedStructures)
      .map((entry) => entry.plotId)
      .filter((plotId): plotId is string => typeof plotId === "string"),
    placedStructures: state.building.placedStructures,
    completedProperties: Object.fromEntries(
      Object.entries(state.property.owned).filter(
        ([, property]) => property.ownerId === state.actorId
      )
    ),
    buildingProgress: state.property.buildingProgress,
    homeDecoration: state.homeDecoration,
    placeableWorld: state.placeableWorld,
    inWorldMarkers: inWorldMarkersForActor(state),
    storageContainers: state.building.storageContainers,
    doorLocks: state.building.doorLocks,
    businesses: state.economy.businesses,
    robotProtection: state.robotProtection,
  };
}

export function createHarthmereLiveModeQuestClientSnapshot(
  state: HarthmereLiveModeBackendState
) {
  const questInvites = normalizeHarthmereQuestInviteState(
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
    version: "harthmere-live-mode-quest-state",
    actorId: state.actorId,
    active: JSON.parse(JSON.stringify(activeQuestEntriesForActor(state))),
    completed: { ...state.quests.completed },
    pendingReceivedInvites,
    sentPendingInvites,
    sharedQuests,
    // HARTHMERE_BIBLE_QUEST_WIRING (bible-wiring fix, 2026-07-14): the client
    // dialogue/journal needs the bible runtime (per-objective progress, quest
    // states, earned flags/titles) and the Thaedryn machine (phase/chains HUD)
    // to render offers and the encounter. Deep-copied so response serializers
    // can never alias live state.
    bible: JSON.parse(JSON.stringify(state.quests.bible)),
    updatedAtMs: state.updatedAtMs,
  };
}

export function reduceHarthmereLiveModeBackendState(
  state: HarthmereLiveModeBackendState,
  envelope: HarthmereLiveModeAuthorityEnvelope,
  nowMs: number
): {
  state: HarthmereLiveModeBackendState;
  summary: HarthmereLiveModeBackendMutationSummary;
} {
  const next: HarthmereLiveModeBackendState = JSON.parse(JSON.stringify(state));
  next.updatedAtMs = nowMs;
  const touchedModels = new Set<string>();
  const sharedStateKeys = new Set<string>();
  const warnings: string[] = [];
  const buildingMaterializationPlans: BuildingSystemAnyMaterializationPlan[] =
    [];
  const nativeEcsMaterializationPlans: HarthmereNativeEcsMaterializationPlan[] =
    [];
  const playerStateKey = harthmereLiveModePlayerStateKey(envelope.actorId);

  const loanConsequenceResult = applyHarthmereBankLoanConsequences(next, nowMs);
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

  ensureBuildingSystemStructureDefinitions();
  ensureHarthmereLiveModeCombatCatalogue();
  // Rolling-upgrade compatibility: old actor blobs and several server-side
  // callers only carried the per-actor `ownedPlots` projection. Repair the
  // shared owner ledger before enforcing it, but never overwrite an owner that
  // is already present from shared world state.
  for (const plotId of next.building.ownedPlots) {
    next.building.plotOwners[plotId] ??= envelope.actorId;
  }
  ensureHarthmereProductionCraftingCatalogue();
  ensureHarthmereProductionVendorCatalog();
  ensureCombatResourcePools(next);

  function markLiveModePlayerDeadForZeroHp(input: {
    deathId: string;
    cause: string;
    respawnDelayMs?: number;
  }) {
    const previousDeathState = next.combat.deathState ?? "alive";
    const hadDeathRecord = Boolean(next.combat.deathRecords[input.deathId]);
    const changed = repairLiveModeZeroHpDeathState(next, {
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
    markLiveModePlayerDeadForZeroHp({
      deathId: `${envelope.requestId}:player_zero_hp_repair`,
      cause: "hp_zero_state_repaired",
      respawnDelayMs: payloadNumber(envelope, "respawnDelayMs") ?? 5_000,
    });
  }

  // ---------------------------------------------------------------------------
  // Inventory snapshot helper — project current state into the authority type
  // ---------------------------------------------------------------------------
  function buildInventorySnapshot(): HarthmereInventorySnapshot {
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
  ): HarthmereCombatActorSnapshot {
    const resourceKind = abilityResourceKindForLiveMode(
      abilityId,
      next.classMagic.classId
    );
    const pools = ensureCombatResourcePools(next);
    const cooldowns = splitCombatCooldowns(next.combat.cooldowns);
    const knownAbilities = Array.from(
      knownHarthmereAbilityIds(next.classMagic)
    );
    const loadoutAbilities = Object.values(next.classMagic.loadout).filter(
      Boolean
    ) as string[];
    const equippedAbilities =
      loadoutAbilities.length > 0
        ? loadoutAbilities
        : abilityId && knownAbilities.includes(abilityId)
        ? [abilityId]
        : [];
    const equipmentStats = Object.values(next.inventory.equipment).reduce(
      (totals, itemId) => {
        const stats = getHarthmereItemDefinition(itemId)?.stats ?? {};
        totals.attack += Math.max(
          0,
          Number(
            stats.attackPoints ??
              stats.attack ??
              stats.rangedAttack ??
              stats.damage ??
              0
          ) || 0
        );
        totals.spell += Math.max(
          0,
          Number(stats.spellPower ?? stats.magicPower ?? 0) || 0
        );
        totals.armor += Math.max(
          0,
          Number(stats.armor ?? stats.defense ?? 0) || 0
        );
        return totals;
      },
      { attack: 0, spell: 0, armor: 0 }
    );
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
      knownAbilities,
      equippedAbilities,
      activeTalentNodes: [...(next.talents?.nodes ?? [])],
      // (combat fix C-4, 2026-07-14): derive the real equipped weapon type from
      // the player's equipment map instead of hard-coding "sword". The old stub
      // bypassed every ability `requiredWeaponType` gate (bow/staff/mace/etc.
      // always passed or always failed regardless of what was held).
      mainHandWeaponType: harthmereMainHandWeaponType(next.inventory.equipment),
      offHandWeaponType: harthmereOffHandWeaponType(next.inventory.equipment),
      attackPowerBonus: equipmentStats.attack,
      spellPowerBonus: equipmentStats.spell,
      armorRating: equipmentStats.armor,
      deathState: next.combat.deathState ?? "alive",
      position: actorWorldPositionFromAuthority(envelope) ?? {
        x: 0,
        y: 0,
        z: 0,
      },
      pvpFlagged: next.law.flags["pvp_flagged"] ?? false,
      legalFlags: { ...next.law.flags },
    };
  }

  // ---------------------------------------------------------------------------
  // Zone snapshot helper — resolves from envelope.zoneId
  // ---------------------------------------------------------------------------
  function buildZoneSnapshot(): HarthmereZoneSnapshot {
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
      isHarthmereLiveModeTownSafePosition(
        actorWorldPositionFromAuthority(envelope),
        next.building.safeZones,
        next.building.customPlots
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
    target: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string],
    zone: HarthmereZoneSnapshot
  ): HarthmereCombatTargetSnapshot {
    const combatProtection = liveEntityCombatProtectionReason(target);
    const actorPosition = actorWorldPositionFromAuthority(envelope);
    const visibleTargetPosition =
      actorPosition && isServerMuckCombatTargetId(targetId)
        ? clientClaimedVisibleCombatTargetPosition(envelope)
        : undefined;
    const visibleTargetReach =
      HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS +
      Math.max(0, Number(target.bodyRadius ?? 1)) +
      0.75;
    const targetPosition =
      actorPosition &&
      visibleTargetPosition &&
      liveEntityCombatHorizontalDistance(
        actorPosition,
        visibleTargetPosition
      ) <= visibleTargetReach
        ? { ...visibleTargetPosition, y: actorPosition.y }
        : actorPosition &&
          liveEntityCombatHorizontalDistance(actorPosition, target.position) <=
            HARTHMERE_VOXEL_INTERACTION_ATTACK_REACH_UNITS
        ? { ...target.position, y: actorPosition.y }
        : target.position;
    return {
      targetId,
      isHostile: target.isHostile,
      isAlive: target.isAlive,
      isAttackable: target.isAttackable && !combatProtection,
      hp: target.hp,
      maxHp: target.maxHp,
      position: targetPosition,
      pvpFlagged: target.pvpFlagged ?? false,
      isPlayer: target.isPlayer ?? false,
      zonePvPRule: target.zonePvPRule ?? zone.pvpRule,
    };
  }

  function buildLiveEntityAiActorSnapshot(
    npcId: string,
    npcSnapshot: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string],
    abilityId: string
  ): HarthmereCombatActorSnapshot {
    const resourceKind = abilityResourceKindForLiveMode(abilityId, "warrior");
    const level = Math.max(1, Math.trunc(Number(npcSnapshot.level ?? 1)));
    const maxResource = Math.max(
      1,
      Math.trunc(
        Number(
          npcSnapshot.maxResources?.[resourceKind] ??
            liveModeResourceMax(resourceKind, level)
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
    const cooldowns = splitCombatCooldowns(npcSnapshot.cooldowns ?? {});
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

  function buildLiveEntityAiPlayerTargetSnapshot(
    playerPosition: { x: number; y: number; z: number },
    zone: HarthmereZoneSnapshot
  ): HarthmereCombatTargetSnapshot {
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

  // HARTHMERE_COMBAT_DISTANCE_HORIZONTAL: muck monsters/wildlife are authored
  // at a flat seed Y (~54) while the real muck terrain — and the player on it —
  // sits at a different height, so a full 3D distance adds a phantom |dY| (often
  // 10-40m) and pushes hostiles "out of range", making melee swings pass right
  // through them. Combat range / aggro / leash for these creatures is resolved on
  // the HORIZONTAL plane (with generous vertical slack so genuinely different
  // floors like caves still separate). Used ONLY for muck-creature combat — never
  // for property/building distance checks, which are real-Y on both sides.
  function liveEntityCombatHorizontalDistance(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number }
  ) {
    const HARTHMERE_COMBAT_VERTICAL_TOLERANCE = 48;
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    const dy = Math.max(
      0,
      Math.abs(a.y - b.y) - HARTHMERE_COMBAT_VERTICAL_TOLERANCE
    );
    return Math.sqrt(dx * dx + dz * dz + dy * dy);
  }

  function liveEntityAiRequiresLineOfSight(
    npcSnapshot: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]
  ) {
    return npcSnapshot.requiresLineOfSight !== false;
  }

  function liveEntityAiLineOfSightToPlayer(
    npcSnapshot: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]
  ) {
    if (!liveEntityAiRequiresLineOfSight(npcSnapshot)) {
      return true;
    }
    // (combat fix C-2, 2026-07-14): decide INCOMING-damage line of sight from
    // the SERVER voxel raycast — the same authority the player's OUTGOING
    // attacks already use — rather than trusting the client-supplied
    // `lineOfSight` payload. Trusting the client here was both spoofable (a
    // client could claim lineOfSight:"false" to suppress incoming NPC damage)
    // and asymmetric (terrain that blocked the player's hits was ignored for
    // the NPC's hits). When both endpoints are known we raycast; if either
    // position is unavailable we fall back to the previous client-hint
    // behaviour so a missing snapshot can't make every NPC blind.
    const npcPosition = npcSnapshot.position;
    const playerPosition = actorWorldPositionFromAuthority(envelope);
    if (
      npcPosition &&
      Number.isFinite(npcPosition.x) &&
      Number.isFinite(npcPosition.y) &&
      Number.isFinite(npcPosition.z) &&
      playerPosition
    ) {
      return harthmereServerCheckLineOfSight(npcPosition, playerPosition);
    }
    return payloadString(envelope, "lineOfSight") === "false" ||
      payloadBoolean(envelope, "lineOfSight") === false
      ? false
      : true;
  }

  function liveEntityAiChaseRange(
    npcId: string,
    npcSnapshot: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string],
    input?: { pursuingActorThreat?: boolean }
  ) {
    const retaliationRange = input?.pursuingActorThreat
      ? HARTHMERE_LIVE_ENTITY_RETALIATION_CHASE_RANGE
      : 0;
    const explicitLeash = Number(npcSnapshot.leashRange);
    if (Number.isFinite(explicitLeash) && explicitLeash > 0) {
      return Math.max(
        1,
        Math.min(
          HARTHMERE_LIVE_ENTITY_RETALIATION_CHASE_RANGE,
          Math.max(explicitLeash, retaliationRange)
        )
      );
    }
    const explicitAggro = Number(npcSnapshot.aggroRange);
    if (Number.isFinite(explicitAggro) && explicitAggro > 0) {
      return Math.max(
        1,
        Math.min(
          HARTHMERE_LIVE_ENTITY_RETALIATION_CHASE_RANGE,
          Math.max(explicitAggro + 6, retaliationRange)
        )
      );
    }
    const kind = liveEntityKindForSnapshot(npcId, npcSnapshot);
    const base =
      kind === "mux" || kind === "hex"
        ? 22
        : kind === "monster" || kind === "undead"
        ? 24
        : kind === "robot" || kind === "construct"
        ? 18
        : kind === "animal"
        ? 14
        : 16;
    return Math.max(base, retaliationRange);
  }

  function liveEntityAiPlayerTargetBlockReason(input: {
    npcId: string;
    npcSnapshot: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string];
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
      isHarthmereLiveModeTownSafePosition(
        input.playerPosition,
        next.building.safeZones,
        next.building.customPlots
      )
    ) {
      return "safe_zone";
    }
    const distance = liveEntityCombatHorizontalDistance(
      input.npcSnapshot.position,
      input.playerPosition
    );
    const pursuingActorThreat =
      input.npcSnapshot.lastAttackerId === next.actorId ||
      (next.combat.threat[next.actorId] ?? 0) > 0 ||
      (next.combat.threat[input.npcId] ?? 0) > 0;
    if (
      distance >
      liveEntityAiChaseRange(input.npcId, input.npcSnapshot, {
        pursuingActorThreat,
      })
    ) {
      return "target_out_of_chase_range";
    }
    // Retaliation may continue outside the bounded server raycast distance,
    // but never outside the chase leash. Inside the raycast distance a wall
    // immediately clears the target. The attack path independently requires
    // both genuine attack reach and server-authoritative line of sight.
    if (
      distance <= HARTHMERE_SERVER_LOS_MAX_DISTANCE &&
      !liveEntityAiLineOfSightToPlayer(input.npcSnapshot)
    ) {
      return "no_line_of_sight";
    }
    return undefined;
  }

  function applyLiveEntityAiPlayerAttack(input: {
    npcId: string;
    npcSnapshot:
      | HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]
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
    const playerPosition = actorWorldPositionFromAuthority(envelope);
    if (!playerPosition) {
      return {
        attackBlockedReason: "missing_player_position",
        playerHpBefore: next.combat.hp,
        playerHpAfter: next.combat.hp,
        playerDeathState: next.combat.deathState ?? "alive",
      };
    }
    if (
      isHarthmereLiveModeTownSafePosition(
        playerPosition,
        next.building.safeZones,
        next.building.customPlots
      )
    ) {
      return {
        attackBlockedReason: "safe_zone",
        playerHpBefore: next.combat.hp,
        playerHpAfter: next.combat.hp,
        playerDeathState: next.combat.deathState ?? "alive",
      };
    }
    const abilityId =
      payloadString(envelope, "npcAbilityId") ??
      HARTHMERE_LIVE_ENTITY_NPC_ATTACK_ABILITY_ID;
    if (abilityId === HARTHMERE_LIVE_ENTITY_NPC_ATTACK_ABILITY_ID) {
      ensureHarthmereLiveEntityNpcAttackAbility();
    }
    const ability = getHarthmereAbility(abilityId);
    if (!ability) {
      return { attackBlockedReason: "unknown_npc_ability" };
    }

    // HARTHMERE_NPC_ATTACK_RANGE_HARD_CAP (2026-07-07): NPC melee attacks must
    // land only at genuine melee distance. Whatever `attackRange` a snapshot
    // carries (it can be stale, or accidentally seeded from an aggro/leash value),
    // clamp it to a sane maximum so a creature can never deal damage from across
    // the field — the "something hit and killed me from ~34 units with no monster
    // near me" report.
    // (combat fix C-3, 2026-07-14): the clamp now comes from the single shared
    // helper/ceiling (harthmereValidatedLiveEntityAttackReach /
    // HARTHMERE_MAX_NPC_ATTACK_RANGE_UNITS) instead of a local magic constant,
    // so this gate and any other reach consumer stay consistent.
    const range = harthmereValidatedLiveEntityAttackReach(
      npcSnapshot.attackRange,
      ability.rangeUnits
    );
    if (
      liveEntityCombatHorizontalDistance(npcSnapshot.position, playerPosition) >
      range
    ) {
      return {
        attackBlockedReason: "target_out_of_range",
        playerHpBefore: next.combat.hp,
        playerHpAfter: next.combat.hp,
        playerDeathState: next.combat.deathState ?? "alive",
      };
    }
    if (!liveEntityAiLineOfSightToPlayer(npcSnapshot)) {
      return {
        attackBlockedReason: "no_line_of_sight",
        playerHpBefore: next.combat.hp,
        playerHpAfter: next.combat.hp,
        playerDeathState: next.combat.deathState ?? "alive",
      };
    }

    const playerHpBefore = Math.max(0, Math.trunc(Number(next.combat.hp ?? 0)));
    const combatResult = reduceHarthmereCombatAction(
      {
        requestId: `${envelope.requestId}:npc_attack`,
        kind: "ability_cast",
        actorId: input.npcId,
        targetId: next.actorId,
        abilityId,
        nowMs,
      },
      {
        actor: buildLiveEntityAiActorSnapshot(
          input.npcId,
          npcSnapshot,
          abilityId
        ),
        target: buildLiveEntityAiPlayerTargetSnapshot(
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

    const resourceKind = abilityResourceKindForLiveMode(abilityId, "warrior");
    npcSnapshot.resources ??= {};
    npcSnapshot.maxResources ??= {};
    npcSnapshot.maxResources[resourceKind] = Math.max(
      1,
      Number(npcSnapshot.maxResources[resourceKind]) ||
        liveModeResourceMax(resourceKind, npcSnapshot.level ?? 1)
    );
    npcSnapshot.resources[resourceKind] = Math.max(
      0,
      combatResult.actorResourceAfter
    );

    // Ambient wildlife use a flat, size-scaled hit (cow > sheep > rabbit)
    // instead of the level-derived combat formula.
    const rawDamage = Math.max(
      0,
      Math.trunc(Number(npcSnapshot.attackDamage ?? combatResult.damage ?? 0))
    );
    const armorRating = buildActorSnapshot().armorRating ?? 0;
    const damage =
      rawDamage > 0
        ? Math.max(1, Math.round((rawDamage * 100) / (100 + armorRating)))
        : 0;
    if (damage > 0) {
      next.combat.hp = Math.max(0, playerHpBefore - damage);
      npcSnapshot.lastAiAttackAtMs = nowMs;
      npcSnapshot.lastAiAttackDamage = damage;
      npcSnapshot.lastAiAttackTargetId = next.actorId;
      npcSnapshot.lastAiAttackResourceKind = resourceKind;
      npcSnapshot.lastAiAttackResourceAfter =
        npcSnapshot.resources[resourceKind];
      if (next.combat.hp <= 0) {
        markLiveModePlayerDeadForZeroHp({
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

  function liveEntityCombatProtectionReason(
    target: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]
  ): HarthmereLiveEntityCombatProtection | undefined {
    if (
      target.combatProtection &&
      liveEntityCombatProtectionBlocksDamage(target.combatProtection)
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

  function liveEntityCombatProtectionBlocksDamage(
    protection: HarthmereLiveEntityCombatProtection
  ) {
    return protection !== "livestock" && protection !== "owned_pet";
  }

  function liveEntityIsUnauthorizedOwnedAnimalKill(
    target: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]
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

  function liveEntityOwnedAnimalKillValueGold(
    target: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]
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

  function recordLiveEntityOwnedAnimalKillCrime(
    targetId: string,
    target: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]
  ) {
    if (!liveEntityIsUnauthorizedOwnedAnimalKill(target)) return;
    const factionId =
      payloadString(envelope, "factionId") ?? HARTHMERE_CIVIL_LAW_FACTION_ID;
    const witnessLevel = payloadString(envelope, "witnessLevel") ?? "public";
    const witnessMultiplier = reputationWitnessMultiplier(witnessLevel);
    const likeabilityDeltaBox = { value: 0 };
    const legalDeltaBox = { value: 0 };
    const notorietyDeltaBox = { value: 0 };
    const fineDeltaBox = { value: 0 };
    const crimeEnvelope: HarthmereLiveModeAuthorityEnvelope = {
      ...envelope,
      requestId: `${envelope.requestId}:owned_animal_kill_crime`,
      actionKind: "request_law_reputation_mutation",
      subsystem: "law",
      targetId,
      payload: {
        factionId,
        crimeKind: "murder",
        valueGold: liveEntityOwnedAnimalKillValueGold(target),
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
    const record = applyHarthmereLiveModeCrimeEvent({
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
    const before = next.law.standing[factionId] ?? defaultReputationStanding();
    const after = applyReputationStandingDelta(
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
    if (fineDeltaBox.value > 0) {
      // Enforced fine: charge the wallet, carry only the unpayable remainder as debt.
      if (chargeEnforcedLawFine(next, factionId, fineDeltaBox.value) > 0) {
        touchedModels.add("wallet");
      }
    } else if (fineDeltaBox.value < 0) {
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

  function normalizeLiveEntityLootStacks(
    target: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]
  ) {
    const stacks: Record<string, number> = {};
    for (const [itemId, count] of Object.entries(target.lootDrops ?? {})) {
      const safeCount = Math.max(0, Math.trunc(Number(count) || 0));
      if (itemId && safeCount > 0) {
        stacks[itemId] = (stacks[itemId] ?? 0) + safeCount;
      }
    }
    if (
      liveEntityShouldDropDefaultRawMeat(target) &&
      !Object.keys(stacks).some(liveEntityLootItemIsMeat)
    ) {
      stacks.raw_meat = (stacks.raw_meat ?? 0) + 2;
    }
    return stacks;
  }

  function liveEntityLootItemIsMeat(itemId: string) {
    return /(^|[_-])(meat|venison)($|[_-])/i.test(itemId);
  }

  function liveEntityShouldDropDefaultRawMeat(
    target: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]
  ) {
    if (
      target.protectedSpecies ||
      (target.combatProtection &&
        liveEntityCombatProtectionBlocksDamage(target.combatProtection)) ||
      target.entityKind === "pet" ||
      target.entityKind === "summon"
    ) {
      return false;
    }
    if (target.ownerId && !target.isLivestock) return false;
    if (target.entityKind === "animal") return true;
    const species = `${target.species ?? ""}`.toLowerCase();
    return /\b(wolf|bear|boar|deer|elk|moose|rabbit|hare|fox|snake|rat|stag|doe|buck|cow|sheep|goat|pig|boar|chicken|duck|turkey|horse)\b/.test(
      species
    );
  }

  function liveEntityLootSourceKind(
    target: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]
  ) {
    return `live_entity:${target.entityKind ?? target.species ?? "unknown"}`;
  }

  function createLiveEntityDefeatLootDrop(
    targetId: string,
    target: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]
  ) {
    const itemStacks = normalizeLiveEntityLootStacks(target);
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
    const drop: HarthmereInventoryLootDrop = {
      dropId,
      sourceKind: liveEntityLootSourceKind(target),
      sourceId: targetId,
      sourceLevel: target.level,
      position: liveEntityLootDropPosition(target),
      itemStacks,
      instanceIds: [],
      ownerActorIds: [
        ...new Set(target.lootOwnerActorIds ?? [envelope.actorId]),
      ],
      pickupToken: `${dropId}:${envelope.requestId}:${nowMs}`,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + HARTHMERE_INVENTORY_LOOT_DEFAULT_DROP_TTL_MS,
      status: "available",
      abuseFlags: [],
    };
    next.inventoryLoot.lootDrops[dropId] = drop;
    target.lootDropId = dropId;
    sharedStateKeys.add(harthmereLiveModeSharedStateKey("loot_drop", dropId));
    touchedModels.add("inventory_loot_drops");
    return dropId;
  }

  function ensureInventoryLootActorSynced() {
    const existing = next.inventoryLoot.actors[next.actorId];
    if (existing) {
      existing.gold = next.inventory.gold;
      existing.items = { ...next.inventory.items };
      existing.bank = { ...next.inventory.bank };
      existing.equipment = { ...next.inventory.equipment };
      existing.equipmentInstances = { ...next.inventory.equipmentInstances };
      return;
    }
    next.inventoryLoot.actors[next.actorId] = createHarthmereInventoryLootActor(
      next.actorId,
      {
        gold: next.inventory.gold,
        items: { ...next.inventory.items },
        bank: { ...next.inventory.bank },
        equipment: { ...next.inventory.equipment },
        equipmentInstances: { ...next.inventory.equipmentInstances },
      }
    );
  }

  function inventoryLootDefinitionFromLiveItem(
    itemId: string
  ): HarthmereInventoryLootItemDefinition | undefined {
    const def =
      getHarthmereItemDefinition(itemId) ??
      generatedLiveModeLootItemDefinition(itemId);
    if (!def) return undefined;
    const category = itemCategoryFromDefinition(def, itemId);
    const lootCategory: HarthmereInventoryLootItemDefinition["category"] =
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
      weight: harthmereItemUnitWeight(itemId),
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

  function generatedLiveModeLootItemDefinition(
    itemId: string
  ): HarthmereItemDefinition | undefined {
    const existing = getHarthmereItemDefinition(itemId);
    if (existing) return existing;
    const isSeed = !!HARTHMERE_SEED_DEFINITIONS[itemId];
    const isFood = !!HARTHMERE_FOOD_DEFINITIONS[itemId];
    const helperQuestItemCopy = liveEntityHelperQuestItemCopyForId(itemId);
    const isJobsBoardExecutable =
      isKnownHarthmereJobsBoardExecutableItemId(itemId);
    const isMaterial =
      isSeed || isJobsBoardExecutable || isLikelyBankingMaterialItemId(itemId);
    const isKnownHarthmereCatalogItem =
      isSeed || isFood || !!helperQuestItemCopy || isJobsBoardExecutable;
    if (!isKnownHarthmereCatalogItem && !isMaterial) {
      const biomesBikkie = dynamicBiomesBikkieLiveModeItemDefinition(itemId);
      if (biomesBikkie) return biomesBikkie;
      return undefined;
    }
    const def: HarthmereItemDefinition = {
      itemId,
      displayName:
        helperQuestItemCopy?.displayName ?? humanizeHarthmereItemId(itemId),
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
    registerHarthmereItemDefinition(def);
    return def;
  }

  function inventoryLootContextForDrop(drop: HarthmereInventoryLootDrop) {
    const itemDefinitions: Record<
      string,
      HarthmereInventoryLootItemDefinition
    > = {};
    for (const itemId of Object.keys(drop.itemStacks)) {
      const def = inventoryLootDefinitionFromLiveItem(itemId);
      if (def) itemDefinitions[itemId] = def;
    }
    for (const instanceId of drop.instanceIds) {
      const instance = next.inventoryLoot.itemInstances[instanceId];
      if (!instance) continue;
      const def = inventoryLootDefinitionFromLiveItem(instance.itemId);
      if (def) itemDefinitions[instance.itemId] = def;
    }
    return { itemDefinitions, lootTables: {} };
  }

  function liveLootDropBackpackStacksForCarry(stacks: Record<string, number>) {
    const backpackStacks: Record<string, number> = {};
    for (const [itemId, count] of Object.entries(stacks)) {
      const safeCount = Math.max(0, Math.trunc(Number(count) || 0));
      if (safeCount <= 0) continue;
      const def = getHarthmereItemDefinition(itemId);
      const category = itemCategoryFromDefinition(def, itemId);
      if (category === "currency") continue;
      if (
        category === "materials" &&
        bankRecordHasCapacity(
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

  function routeInventoryLootActorMaterialsToLiveStorage(
    stacks: Record<string, number>
  ) {
    const actor = next.inventoryLoot.actors[next.actorId];
    if (!actor) return;
    for (const [itemId, count] of Object.entries(stacks)) {
      const safeCount = Math.max(0, Math.trunc(Number(count) || 0));
      if (safeCount <= 0) continue;
      const def = getHarthmereItemDefinition(itemId);
      if (itemCategoryFromDefinition(def, itemId) !== "materials") continue;
      const actorCount = Math.max(0, Math.trunc(actor.items[itemId] ?? 0));
      const moveCount = Math.min(actorCount, safeCount);
      if (moveCount <= 0) continue;
      if (
        !bankRecordHasCapacity(
          next.banking.materialStorage,
          itemId,
          next.banking.materialStorageMaxSlots
        )
      ) {
        continue;
      }
      applyBankRecordDelta(actor.items, itemId, -moveCount);
      applyBankRecordDelta(next.banking.materialStorage, itemId, moveCount);
      touchedModels.add("material_storage");
    }
  }

  function syncInventoryLootActorToLiveInventory() {
    const actor = next.inventoryLoot.actors[next.actorId];
    if (!actor) return;
    next.inventory.gold = Math.max(0, Math.trunc(actor.gold));
    next.inventory.items = { ...actor.items };
    next.inventory.bank = { ...actor.bank };
    next.inventory.equipment = { ...actor.equipment };
    next.inventory.equipmentInstances = { ...actor.equipmentInstances };
  }

  function liveEntityKindForSnapshot(
    entityId: string,
    target: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]
  ): HarthmereLiveEntityKind {
    if (target.entityKind) return target.entityKind;
    const text = `${entityId} ${target.species ?? ""}`.toLowerCase();
    if (target.isLivestock || target.protectedSpecies) return "animal";
    if (
      /\b(robots?|bots?|sentinels?|sententials?|sentientals?|constructs?)\b/.test(
        text
      )
    ) {
      return "robot";
    }
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

  function liveEntityDefaultMovementSpeed(
    kind: HarthmereLiveEntityKind,
    target: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]
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

  function liveEntityCanMove(
    kind: HarthmereLiveEntityKind,
    target: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]
  ) {
    if (target.aiEnabled === false) return false;
    if (!target.isAlive || target.hp <= 0) return false;
    if (kind === "object" && !target.movementSpeed) return false;
    if (kind === "robot" || kind === "construct") {
      const area = liveEntityRobotProtectionAreaForPosition(
        liveEntityPositionFromObject(target.position)
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

  function escortCompanionEntityId(companion: HarthmereEscortCompanion) {
    return String(companion.entityId);
  }

  function activeEscortCompanionCanRender(companion: HarthmereEscortCompanion) {
    return companion.status === "following" || companion.status === "arrived";
  }

  function syncEscortCompanionCombatSnapshot(
    companion: HarthmereEscortCompanion
  ) {
    const entityId = escortCompanionEntityId(companion);
    if (!activeEscortCompanionCanRender(companion)) {
      if (next.combat.entitySnapshots[entityId]) {
        delete next.combat.entitySnapshots[entityId];
        delete next.combat.npcAiTicks[entityId];
        delete next.combat.liveEntityNavigation[entityId];
        touchedModels.add("escort_companion");
        touchedModels.add("live_entity_combat");
      }
      return;
    }
    const existing = next.combat.entitySnapshots[entityId];
    next.combat.entitySnapshots[entityId] = {
      hp: existing?.hp ?? 20,
      maxHp: existing?.maxHp ?? 20,
      position: { ...companion.position },
      homePosition: existing?.homePosition ?? { ...companion.position },
      isHostile: false,
      isAlive: companion.status !== "failed",
      isAttackable: false,
      entityKind: "human",
      movementSpeed: 4.4,
      bodyRadius: 0.45,
      patrolRadius: 0.25,
      aggroRange: 0,
      leashRange: 5000,
      requiresLineOfSight: false,
      aiEnabled: companion.status === "following",
      animationState:
        companion.status === "arrived"
          ? "idle"
          : existing?.animationState ?? "idle",
      animationStartedAtMs: existing?.animationStartedAtMs ?? nowMs,
      animationMoving:
        companion.status === "arrived"
          ? false
          : existing?.animationMoving ?? false,
      facingYaw: existing?.facingYaw,
      combatProtection: "friendly_noncombatant",
      retaliatesWhenAttacked: false,
      escortJobId: companion.jobId,
      escortActorId: companion.actorId,
      escortCompanionId: companion.companionId,
      escortDisplayName: companion.displayName,
      escortDestination: { ...companion.destination },
      escortDestinationTargetId: companion.destinationTargetId,
      escortDestinationMarkerId: companion.destinationMarkerId,
      escortStatus: companion.status,
    };
    touchedModels.add("escort_companion");
    touchedModels.add("live_entity_combat");
  }

  function syncAllEscortCompanionsToCombat() {
    for (const job of Object.values(next.jobsBoard.postings)) {
      if (!job.escortCompanion) continue;
      syncEscortCompanionCombatSnapshot(job.escortCompanion);
    }
  }

  function horizontalDistanceObject(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number }
  ) {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  function syncJobsBoardEscortCompanionFromSnapshot(
    snapshot: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string],
    status?: HarthmereEscortCompanion["status"]
  ) {
    if (!snapshot.escortJobId) return undefined;
    const job = next.jobsBoard.postings[snapshot.escortJobId];
    const companion = job?.escortCompanion;
    if (!companion) return undefined;
    companion.position = { ...snapshot.position };
    companion.updatedAtMs = nowMs;
    if (status && companion.status !== status) {
      companion.status = status;
      if (status === "arrived") companion.arrivedAtMs = nowMs;
      if (status === "failed") companion.failedAtMs = nowMs;
    }
    snapshot.escortStatus = companion.status;
    touchedModels.add("escort_companion");
    touchedModels.add("jobs_board_quest_todo");
    touchedModels.add("live_entity_combat");
    return { job, companion };
  }

  function completeArrivedEscortQuest(
    snapshot: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string]
  ) {
    if (!snapshot.escortJobId || !snapshot.escortActorId) return;
    const job = next.jobsBoard.postings[snapshot.escortJobId];
    if (!job || job.status !== "active") return;
    if (job.acceptedByActorId !== snapshot.escortActorId) return;
    const todo = Object.values(next.jobsBoard.todos).find(
      (candidate) =>
        candidate.jobId === job.jobId &&
        candidate.actorId === snapshot.escortActorId &&
        candidate.status === "active"
    );
    if (!todo) return;
    const companion = job.escortCompanion;
    if (!companion || companion.status !== "arrived") return;
    const result = reduceHarthmereJobsBoardMutation(
      next.jobsBoard,
      {
        requestId: `${envelope.requestId}:escort_arrived:${job.jobId}`,
        actorId: snapshot.escortActorId,
        nowMs,
        operation: "complete_job_quest",
        boardId: job.boardId,
        jobId: job.jobId,
        questTodoId: todo.todoId,
        completedTargetId:
          companion.destinationTargetId ??
          companion.destinationMarkerId ??
          job.targetId,
        completionNote: "escort companion arrived",
      } as any,
      {
        actorGold: next.inventory.gold,
        actorInventoryItems: combinedBackpackAndMaterialStorageItems(next),
        actorMaterialStorageItems: next.banking.materialStorage,
        actorCollectibles: next.collections.discovered,
        actorGuildId: next.guild.memberGuildId,
        actorPosition: snapshot.position,
        nearbyBoardId: job.boardId,
        economy: next.economy.production,
      }
    );
    next.jobsBoard = result.jobsBoard;
    for (const warning of result.warnings) warnings.push(warning);
    for (const model of result.touchedModels) touchedModels.add(model);
    for (const key of result.sharedStateKeys) sharedStateKeys.add(key);
    if (!result.warnings.length) {
      const questId = `jobs_board:${todo.todoId}`;
      const updatedTodo = next.jobsBoard.todos[todo.todoId] ?? todo;
      const updatedJob = next.jobsBoard.postings[job.jobId] ?? job;
      const plan = harthmereJobMarkerPlan({
        kind: updatedTodo.kind ?? updatedJob.kind,
        requirements: updatedJob.requirements,
        fieldMarkerId:
          updatedTodo.mapMarkerId ??
          updatedJob.mapMarkerId ??
          updatedTodo.targetId ??
          updatedJob.targetId,
        boardMarkerId: harthmereJobsBoardTodoBoardMarkerId(next, updatedTodo),
        progress: harthmereJobsBoardCompletedTodoProgress(
          updatedTodo.kind ?? updatedJob.kind,
          updatedJob
        ),
      });
      next.quests.active[questId] = {
        stepId: `${updatedTodo.jobId}:return_to_board`,
        progress: 1,
      };
      delete next.quests.completed[questId];
      const marker = harthmereJobsBoardQuestMarkerRuntimePositionForTodo({
        mapMarkerId: plan.activeMarkerId ?? plan.boardMarkerId,
        targetId: plan.activeMarkerId ?? plan.boardMarkerId,
        fallbackPosition: harthmereJobsBoardTodoFallbackPosition(
          next,
          updatedTodo
        ),
      });
      next.building.inWorldMarkers[`jobs_board_marker:${todo.todoId}`] = {
        markerId: `jobs_board_marker:${todo.todoId}`,
        plotId: marker.markerId,
        kind: "map_marker",
        position: marker.position,
        label:
          marker.label && !plan.hint.includes(marker.label)
            ? `${updatedTodo.title}: ${plan.hint} (${marker.label})`
            : `${updatedTodo.title}: ${plan.hint}`,
        createdAtMs: updatedTodo.createdAtMs,
      };
      touchedModels.add("building_state");
      touchedModels.add("quest_state");
    }
  }

  function liveEntityPositionFromObject(position: {
    x: number;
    y: number;
    z: number;
  }) {
    return [position.x, position.y, position.z] as [number, number, number];
  }

  function liveEntityObjectFromPosition(position: readonly number[]) {
    return {
      x: Number(position[0]) || 0,
      y: Number(position[1]) || 0,
      z: Number(position[2]) || 0,
    };
  }

  function liveEntityHashFloat(value: string) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return (Math.abs(hash) % 10_000) / 10_000;
  }

  function liveEntityTargetPositionForAi(targetId: string | undefined) {
    if (!targetId) return undefined;
    if (targetId === next.actorId) {
      return actorWorldPositionFromAuthority(envelope);
    }
    return next.combat.entitySnapshots[targetId]?.position;
  }

  function liveEntitySteppedDesiredPosition(input: {
    entityId: string;
    current: { x: number; y: number; z: number };
    target: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string];
    decision: string;
    targetId?: string;
    thinkIntervalMs: number;
    kind: HarthmereLiveEntityKind;
  }) {
    const current = input.current;
    const speed = liveEntityDefaultMovementSpeed(input.kind, input.target);
    const maxStep = Math.max(
      0.05,
      Math.min(4, speed * Math.max(0.25, input.thinkIntervalMs / 1000))
    );
    const targetPosition = liveEntityTargetPositionForAi(input.targetId);
    const shouldChase =
      input.decision === "retaliate_to_recent_attacker" ||
      input.decision === "engage_highest_threat" ||
      input.decision === "escort_follow_player" ||
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

    const directX = isServerAuthorityEnvelope(envelope)
      ? payloadNumber(envelope, "desiredX")
      : undefined;
    const directY = isServerAuthorityEnvelope(envelope)
      ? payloadNumber(envelope, "desiredY")
      : undefined;
    const directZ = isServerAuthorityEnvelope(envelope)
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
      liveEntityHashFloat(input.entityId) * Math.PI * 2 + (nowMs / 1000) * 0.18;
    return {
      x: home.x + Math.cos(phase) * radius,
      y: home.y,
      z: home.z + Math.sin(phase) * radius,
    };
  }

  function liveEntityAnimationForMovement(input: {
    kind: HarthmereLiveEntityKind;
    decision: string;
    movementMode: HarthmereNpcNavigationMode;
    animationMoving: boolean;
    isAlive: boolean;
  }): HarthmereLiveEntityAnimationState {
    if (!input.isAlive) return "death";
    if (!input.animationMoving) return "idle";
    if (input.decision.includes("flee")) return "flee";
    if (input.decision === "escort_follow_player") return "run";
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

  function applyLiveEntityAiMovement(input: {
    entityId: string;
    target: HarthmereLiveModeBackendState["combat"]["entitySnapshots"][string];
    decision: string;
    targetId?: string;
    thinkIntervalMs: number;
  }) {
    const target = input.target;
    const kind = liveEntityKindForSnapshot(input.entityId, target);
    const from = { ...target.position };
    if (!liveEntityCanMove(kind, target)) {
      const animationState: HarthmereLiveEntityAnimationState = target.isAlive
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

    const movementMode: HarthmereNpcNavigationMode =
      input.decision === "retaliate_to_recent_attacker" ||
      input.decision === "engage_highest_threat" ||
      input.decision === "escort_follow_player" ||
      input.decision.startsWith("muck_unprovoked:")
        ? "combat_chase"
        : "town_wander";
    const desired = liveEntitySteppedDesiredPosition({
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
      createHarthmereNpcNavigationState();
    if (!Number.isFinite(navState.stuckFrames)) {
      navState.stuckFrames = 0;
    }
    const nav = resolveHarthmereNpcNavigationStep({
      label: input.entityId,
      mode: movementMode,
      currentPosition: liveEntityPositionFromObject(from),
      desiredPosition: liveEntityPositionFromObject(desired),
      state: navState,
      obstacles: target.navigationObstacles,
      bodyRadius: target.bodyRadius,
    });
    next.combat.liveEntityNavigation[input.entityId] = navState;

    const to = liveEntityObjectFromPosition(nav.position);
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const facingYaw =
      Math.hypot(dx, dz) > 0.001 ? Math.atan2(dx, dz) : target.facingYaw;
    const animationState = liveEntityAnimationForMovement({
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
    target.movementSpeed = liveEntityDefaultMovementSpeed(kind, target);

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

  function liveFarmingAuthorityState(
    spawns: Record<string, HarthmereWorldSpawn> = {}
  ) {
    const pools = ensureCombatResourcePools(next);
    const plots: Record<string, HarthmereFarmingPlot> = {};
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
      ...defaultHarthmereFoodStaminaState(next.actorId, nowMs),
      stamina: pools.resources.stamina ?? 0,
      maxStamina: pools.maxResources.stamina ?? 100,
      lastStaminaTickMs: Number.isFinite(next.combat.lastStaminaTickMs)
        ? Number(next.combat.lastStaminaTickMs)
        : nowMs,
      deadFromStaminaAtMs: Number.isFinite(next.combat.deadFromStaminaAtMs)
        ? next.combat.deadFromStaminaAtMs
        : undefined,
      inventory: { ...next.inventory.items },
      plots,
      spawns,
      livestock: { ...(next.farming.livestock ?? {}) },
      cooking: { ...(next.farming.cooking ?? {}) },
    };
  }

  function applyLiveFarmingAuthorityResult(
    authorityState: HarthmereFoodStaminaState
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
    next.farming.cooking = { ...authorityState.cooking };
    if (Number.isFinite(authorityState.stamina)) {
      ensureCombatResourcePools(next).resources.stamina = Math.max(
        0,
        Math.min(
          ensureCombatResourcePools(next).maxResources.stamina ?? 100,
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

  function liveMedicalAuthorityState() {
    const doctorBusinesses: Record<string, HarthmereDoctorServiceSnapshot> = {};
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
      ...defaultHarthmereMedicalHealthState(next.actorId),
      health: next.combat.hp,
      maxHealth: next.combat.maxHp,
      gold: next.inventory.gold,
      inventory: { ...next.inventory.items },
      consumableCooldowns: { ...(next.inventory.consumableCooldowns ?? {}) },
      doctorBusinesses,
    };
  }

  function applyLiveMedicalAuthorityResult(
    authorityState: ReturnType<typeof liveMedicalAuthorityState>
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
        harthmereLiveModeSharedStateKey("business", businessId)
      );
    }
    touchedModels.add("combat_state");
    touchedModels.add("inventory_items");
    touchedModels.add("consumable_cooldown");
    touchedModels.add("wallet");
    touchedModels.add("business_state");
  }

  function recordEconomyBuildingMaterializationPlans(
    plans: BuildingSystemAnyMaterializationPlan[] | undefined
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
        harthmereLiveModeSharedStateKey(
          "building_materialization",
          plan.requestId
        )
      );
      sharedStateKeys.add(harthmereLiveModeSharedStateKey("plot", plan.plotId));
    }
  }

  function advanceSnapshotGroveQuestsFromAuthoritativeEvent(
    kind: "inventory" | "item_use" | "collect",
    event: Record<string, unknown>
  ) {
    for (const [questId, active] of Object.entries(next.quests.active)) {
      if (active.source !== "snapshot_grove") continue;
      const quest = SNAPSHOT_GROVE_QUESTS.find((entry) => entry.id === questId);
      if (!quest || quest.objectives.length === 0) continue;
      const objectiveIndex = Math.max(
        0,
        Math.min(quest.objectives.length - 1, (active.progress ?? 1) - 1)
      );
      const trigger = quest.triggers[objectiveIndex];
      const matches =
        kind === "inventory"
          ? trigger === "inventory_change" &&
            snapshotGroveInventoryEventMatchesObjective(
              event,
              quest,
              objectiveIndex
            )
          : kind === "item_use"
          ? trigger === "item_use" &&
            snapshotGroveItemUseEventMatchesObjective(
              event,
              quest,
              objectiveIndex
            )
          : (trigger === "collect" || trigger === "item_grant") &&
            snapshotGroveCollectEventMatchesObjective(
              event,
              quest,
              objectiveIndex
            );
      if (!matches) continue;

      const nextObjectiveIndex = objectiveIndex + 1;
      if (nextObjectiveIndex >= quest.objectives.length) {
        next.quests.completed[questId] = nowMs;
        delete next.quests.active[questId];
      } else {
        active.progress = nextObjectiveIndex + 1;
        active.stepId =
          questId +
          ":" +
          nextObjectiveIndex +
          ":" +
          (quest.triggers[nextObjectiveIndex] ?? "step");
      }
      touchedModels.add("quest_state");
    }
  }

  // ---------------------------------------------------------------------------
  // Legacy goldDelta — kept for non-authority mutations only
  // (authority mutations compute their own gold deltas via the authority modules)
  // ---------------------------------------------------------------------------
  const AUTHORITY_ACTION_KINDS = new Set<string>([
    "request_attack",
    "request_ability_cast",
    "request_equipment_change",
    "request_xp_reward",
    "request_skill_progress",
    "request_loot_roll",
    "request_loot_claim",
    "request_death_transition",
    "request_environment_damage",
    "request_revive",
    "request_respawn",
    "request_npc_ai_tick",
    "request_boss_tick",
    "request_pvp_flag_change",
    "request_pvp_reward",
    "request_party_raid_credit",
    "request_trainer_unlock",
    "request_skill_book_use",
    "request_vendor_transaction",
    "request_auction_post",
    "request_auction_settle",
    "request_auction_cancel",
    "request_auction_recover",
    "request_auction_expire",
    "request_pay_fine",
    "request_clear_bounty",
    "request_bank_transaction",
    "request_crafting",
    "request_inventory_mutation",
    "request_inventory_item_action",
    "request_container_transfer",
    "request_respec",
    "request_loadout_change",
    "request_property_building_mutation",
    "request_home_decoration",
    "request_world_placement",
    "request_guild_mutation",
    "request_economy_mutation",
    "request_jobs_board_mutation",
    "request_law_reputation_mutation",
    "request_magic_progress",
    "request_quest_state_update",
    "request_farming_action",
    "request_care_loop_action",
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
    // COMBAT — fully server-authoritative via mmo_combat_authority
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

      const target: HarthmereCombatTargetSnapshot | undefined =
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

      const combatReq: HarthmereCombatActionRequest = {
        requestId: envelope.requestId,
        kind: "ability_cast",
        actorId: envelope.actorId,
        targetId: envelope.targetId,
        abilityId,
        nowMs,
      };

      const combatResult = reduceHarthmereCombatAction(combatReq, {
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
      const resourceKind = abilityResourceKindForLiveMode(
        abilityId,
        next.classMagic.classId
      );
      ensureCombatResourcePools(next).resources[resourceKind] = Math.max(
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
          resolvedTarget.position =
            liveEntityDefeatRestingPosition(resolvedTarget);
          resolvedTarget.animationState = "death";
          resolvedTarget.animationMoving = false;
          resolvedTarget.animationStartedAtMs = nowMs;
          if (wasAliveBeforeDamage && resolvedTargetId) {
            recordLiveEntityOwnedAnimalKillCrime(
              resolvedTargetId,
              resolvedTarget
            );
          }
        }
      }

      // ---------------------------------------------------------------
      // HARTHMERE_BIBLE_QUEST_WIRING (bible-wiring fix, 2026-07-14):
      // attacks on Thaedryn feed the Q12 encounter state machine. The
      // machine is authoritative for boss HP (phases key off health
      // percent and remaining chains), so after applying the damage
      // events we re-sync the combat snapshot FROM the machine — the raw
      // hp decrement above is overwritten by the canonical value. The
      // wake path's "attacks after the third chain" counter is also fed
      // here, which is what makes the three endings genuinely exclusive.
      // ---------------------------------------------------------------
      if (
        resolvedTargetId === HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID &&
        combatResult.damage > 0 &&
        next.quests.bible.thaedryn &&
        !next.quests.bible.thaedryn.completed
      ) {
        let machine = next.quests.bible.thaedryn;
        for (const event of harthmereThaedrynDamageEventsForAttack(
          machine,
          combatResult.damage
        )) {
          machine = applyThaedrynBossEvent(machine, event as any);
        }
        next.quests.bible = { ...next.quests.bible, thaedryn: machine };
        syncHarthmereThaedrynCombatSnapshot(next, nowMs, "sync");
        touchedModels.add("quest_state");
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
          harthmereLiveModeSharedStateKey("entity_combat", resolvedTargetId)
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
        const xp = computeHarthmereXpReward({
          actorLevel: next.classMagic.skills["character_level"]?.level ?? 1,
          targetLevel: resolvedTarget?.level ?? 1,
          // Ambient wildlife grant a flat kill XP (cow 50 / sheep 20 / rabbit 5).
          baseXp: resolvedTarget?.killXp ?? combatResult.xpDelta,
          contributionScore: 1,
          antiFarmMultiplier: antiFarmRewardMultiplier({
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
          createLiveEntityDefeatLootDrop(resolvedTargetId, resolvedTarget);
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
      const instanceId = payloadString(envelope, "instanceId");
      ensureInventoryLootActorSynced();
      const lootActor = next.inventoryLoot.actors[next.actorId];
      const currentInstanceId = next.inventory.equipmentInstances[slot];
      const currentInstance = currentInstanceId
        ? next.inventoryLoot.itemInstances[currentInstanceId]
        : undefined;
      let snapshot = buildInventorySnapshot();
      if (itemId) {
        ensureLiveModeItemDefinition(itemId, snapshot);
      }

      const requestedInstance = instanceId
        ? next.inventoryLoot.itemInstances[instanceId]
        : undefined;
      if (instanceId) {
        if (!itemId || !requestedInstance) {
          warnings.push("equipment_rejected:unknown_instance_id");
          touchedModels.add("equipment_rejection");
          break;
        }
        if (
          requestedInstance.itemId !== itemId ||
          requestedInstance.ownerKind !== "actor" ||
          requestedInstance.ownerId !== next.actorId ||
          requestedInstance.location !== "actor_inventory" ||
          !lootActor?.instanceIds.includes(instanceId)
        ) {
          warnings.push("equipment_rejected:instance_not_owned");
          touchedModels.add("equipment_rejection");
          break;
        }
        if (requestedInstance.broken) {
          warnings.push("equipment_rejected:item_broken");
          touchedModels.add("equipment_rejection");
          break;
        }
        // The shared reducer validates this unique item with a temporary count.
        // Applying its -1 delta returns the stack map to its original value.
        snapshot = {
          ...snapshot,
          items: {
            ...snapshot.items,
            [itemId]: (snapshot.items[itemId] ?? 0) + 1,
          },
        };
      }
      // A currently equipped unique instance is not a stack. Exclude it from
      // the reducer's swap accounting; it is returned to instanceIds on commit.
      if (currentInstanceId && itemId) {
        snapshot = {
          ...snapshot,
          equipment: { ...snapshot.equipment },
        };
        delete snapshot.equipment[slot];
      }
      const invReq: HarthmereInventoryMutationRequest = {
        requestId: envelope.requestId,
        actorId: envelope.actorId,
        kind: itemId ? "equip_item" : "unequip_item",
        nowMs,
        itemId,
        targetSlot: slot,
        sourceSlot: slot,
      };
      const invResult = reduceHarthmereInventoryMutation(invReq, {
        snapshot,
        playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
        playerSkills: next.classMagic.skills,
        playerClassId: next.classMagic.classId ?? "warrior",
        reputation: next.law.reputation,
      });
      if (invResult.ok) {
        const updated = applyHarthmereInventoryMutationResult(
          snapshot,
          invResult
        );
        if (!itemId && currentInstance?.itemId) {
          const restoredCount = Math.max(
            0,
            (updated.items[currentInstance.itemId] ?? 0) - 1
          );
          if (restoredCount > 0) {
            updated.items[currentInstance.itemId] = restoredCount;
          } else {
            delete updated.items[currentInstance.itemId];
          }
        }
        const projectedInstanceCount =
          (lootActor?.instanceIds.length ?? 0) +
          (currentInstanceId ? 1 : 0) -
          (instanceId ? 1 : 0);
        if (
          Object.keys(updated.items).length + projectedInstanceCount >
          (lootActor?.maxInventorySlots ?? 40)
        ) {
          warnings.push("equipment_rejected:inventory_full");
          touchedModels.add("equipment_rejection");
          break;
        }

        if (currentInstanceId && currentInstance && lootActor) {
          if (!lootActor.instanceIds.includes(currentInstanceId)) {
            lootActor.instanceIds.push(currentInstanceId);
          }
          currentInstance.location = "actor_inventory";
          currentInstance.slot = undefined;
          currentInstance.updatedAtMs = nowMs;
        }
        if (instanceId && requestedInstance && lootActor) {
          lootActor.instanceIds = lootActor.instanceIds.filter(
            (candidate) => candidate !== instanceId
          );
          requestedInstance.location = "actor_equipment";
          requestedInstance.slot = slot;
          requestedInstance.updatedAtMs = nowMs;
          const def = getHarthmereItemDefinition(requestedInstance.itemId);
          if (def?.binding === "on_equip") {
            requestedInstance.boundToActorId = next.actorId;
          }
          next.inventory.equipmentInstances[slot] = instanceId;
        } else {
          delete next.inventory.equipmentInstances[slot];
        }
        next.inventory.items = updated.items;
        next.inventory.gold = updated.gold;
        next.inventory.escrow = updated.escrow;
        next.inventory.equipment = updated.equipment;
        next.banking.materialStorage =
          updated.materialStorage ?? next.banking.materialStorage;
        next.inventory.consumableCooldowns = updated.consumableCooldowns;
        if (lootActor) {
          lootActor.items = { ...updated.items };
          lootActor.equipment = { ...updated.equipment };
          lootActor.equipmentInstances = {
            ...next.inventory.equipmentInstances,
          };
        }
        if (itemId) {
          const equippedDefinition = getHarthmereItemDefinition(itemId);
          advanceSnapshotGroveQuestsFromAuthoritativeEvent("inventory", {
            kind: "equip",
            operation: "equip",
            itemId,
            itemName: equippedDefinition?.displayName,
            category: equippedDefinition?.category,
            slot,
            equipmentSlots: Object.keys(updated.equipment),
          });
        }
        touchedModels.add("inventory_items");
        touchedModels.add("equipment_slots");
        touchedModels.add("inventory_loot_instances");
        if (Object.keys(invResult.materialStorageDeltas ?? {}).length > 0) {
          touchedModels.add("material_storage");
        }
      } else {
        warnings.push(
          ...invResult.errors.map((e) => `equipment_rejected:${e}`)
        );
        touchedModels.add("equipment_rejection");
      }
      break;
    }

    case "request_inventory_item_action": {
      const operation = payloadString(envelope, "operation");
      const allowed = new Set<HarthmereInventoryMutationRequest["kind"]>([
        "drop_item",
        "destroy_item",
        "equip_item",
        "unequip_item",
        "use_item",
        "learn_spell_from_tome",
      ]);
      if (!operation || !allowed.has(operation as any)) {
        warnings.push("inventory_item_rejected:unsupported_operation");
        touchedModels.add("inventory_rejection");
        break;
      }
      const kind = operation as HarthmereInventoryMutationRequest["kind"];
      const snapshot = buildInventorySnapshot();
      const count = payloadPositiveWholeCount(envelope);
      const itemActionItemId = payloadString(envelope, "itemId");
      // Raw voxel blocks (b:<biscuitId>) are added to the inventory on mining
      // via an on-the-fly item definition (see the loot/inventory branch, which
      // calls ensureLiveModeItemDefinition). The drop/destroy path used by the
      // place-voxel mirror to debit a placed block must register the same
      // definition or the reducer rejects it as `unknown_item_id` and the count
      // never decrements (this is why placed blocks did not drop from the HUD).
      if (itemActionItemId) {
        ensureLiveModeItemDefinition(itemActionItemId, snapshot);
      }
      const itemActionDefinition = itemActionItemId
        ? getHarthmereItemDefinition(itemActionItemId)
        : undefined;
      const requestedDropPosition =
        kind === "drop_item"
          ? payloadWorldPosition(envelope, "position")
          : undefined;
      if (kind === "drop_item" && !requestedDropPosition) {
        warnings.push("inventory_item_rejected:missing_drop_position");
        touchedModels.add("inventory_rejection");
        break;
      }
      const reviveHealthPercent = Math.max(
        0,
        Number(itemActionDefinition?.stats.reviveHealthPercent ?? 0) || 0
      );
      const useHeal = Math.max(
        0,
        Number(itemActionDefinition?.stats.useHeal ?? 0) || 0
      );
      if (
        kind === "use_item" &&
        reviveHealthPercent > 0 &&
        (next.combat.deathState ?? "alive") === "alive" &&
        next.combat.hp > 0
      ) {
        warnings.push("inventory_item_rejected:revive_item_requires_death");
        touchedModels.add("inventory_rejection");
        break;
      }
      if (
        kind === "use_item" &&
        useHeal > 0 &&
        ((next.combat.deathState ?? "alive") !== "alive" || next.combat.hp <= 0)
      ) {
        warnings.push("inventory_item_rejected:healing_item_requires_alive");
        touchedModels.add("inventory_rejection");
        break;
      }
      const invReq: HarthmereInventoryMutationRequest = {
        requestId: envelope.requestId,
        actorId: envelope.actorId,
        kind,
        nowMs,
        itemId: itemActionItemId,
        count:
          kind === "drop_item" ||
          kind === "destroy_item" ||
          kind === "use_item" ||
          kind === "learn_spell_from_tome"
            ? count ?? 1
            : count,
        sourceSlot: payloadString(envelope, "sourceSlot"),
        targetSlot:
          payloadString(envelope, "targetSlot") ??
          payloadString(envelope, "slot"),
      };
      const invResult = reduceHarthmereInventoryMutation(invReq, {
        snapshot,
        playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
        playerSkills: next.classMagic.skills,
        playerClassId: next.classMagic.classId ?? "warrior",
        reputation: next.law.reputation,
      });
      if (invResult.ok) {
        const updated = applyHarthmereInventoryMutationResult(
          snapshot,
          invResult
        );
        next.inventory.items = updated.items;
        next.inventory.gold = updated.gold;
        next.inventory.escrow = updated.escrow;
        next.inventory.equipment = updated.equipment;
        next.inventory.consumableCooldowns = updated.consumableCooldowns;
        next.classMagic.knownAbilities = updated.knownAbilities;
        next.classMagic.knownRecipes = updated.knownRecipes;
        next.banking.materialStorage =
          updated.materialStorage ?? next.banking.materialStorage;
        if (kind === "use_item" && reviveHealthPercent > 0) {
          next.combat.hp = Math.max(
            1,
            Math.min(
              next.combat.maxHp,
              Math.ceil(next.combat.maxHp * reviveHealthPercent)
            )
          );
          next.combat.deathState = "alive";
          next.combat.deadFromStaminaAtMs = undefined;
          next.combat.lastStaminaTickMs = nowMs;
          next.combat.respawnProtectionUntilMs = nowMs + 3_000;
          touchedModels.add("death_state");
          touchedModels.add("respawn_protection");
        } else if (kind === "use_item" && useHeal > 0) {
          next.combat.hp = Math.min(
            next.combat.maxHp,
            next.combat.hp + useHeal * (invReq.count ?? 1)
          );
          touchedModels.add("health");
        }
        touchedModels.add("inventory_items");
        touchedModels.add("player_status");
        if (Object.keys(invResult.materialStorageDeltas ?? {}).length > 0) {
          touchedModels.add("material_storage");
        }
        if (Object.keys(invResult.equipmentChanges ?? {}).length > 0) {
          touchedModels.add("equipment_slots");
        }
        if (invResult.newAbilityIds.length > 0) {
          touchedModels.add("known_abilities");
          touchedModels.add("class_magic_progression");
        }
        // HARTHMERE_WORLD_THROW_DROP (audit fix, 2026-07-13): a drop_item with
        // a world position is a THROW — after the debit above succeeds, create
        // a positioned, claimable world loot drop so the item lands on the
        // ground (rendered + F-pickup) instead of vanishing. Position comes
        // from the throw location; the drop lives in SHARED state so every
        // player sees and can salvage it.
        if (kind === "drop_item" && itemActionItemId) {
          if (requestedDropPosition) {
            ensureInventoryLootActorSynced();
            const throwDropDef =
              inventoryLootDefinitionFromLiveItem(itemActionItemId);
            const worldDrop = throwDropDef
              ? createHarthmereDebitedWorldDrop(
                  next.inventoryLoot,
                  {
                    itemDefinitions: { [itemActionItemId]: throwDropDef },
                    lootTables: {},
                  },
                  {
                    requestId: envelope.requestId,
                    actorId: envelope.actorId,
                    nowMs,
                    itemId: itemActionItemId,
                    count: invReq.count ?? 1,
                    position: requestedDropPosition,
                  }
                )
              : undefined;
            if (worldDrop) {
              touchedModels.add("inventory_loot_drops");
              sharedStateKeys.add(
                harthmereLiveModeSharedStateKey("loot_drop", worldDrop.dropId)
              );
            } else {
              // Debit and world-drop creation are one atomic throw. Keeping the
              // debit here made Muckwad counts decrease without placing a
              // salvageable object in the world. Restore the pre-action
              // inventory and report a rejection so clients retain the stack.
              next.inventory.items = { ...snapshot.items };
              next.inventory.gold = snapshot.gold;
              next.inventory.escrow = snapshot.escrow;
              next.inventory.equipment = { ...snapshot.equipment };
              next.inventory.consumableCooldowns = {
                ...snapshot.consumableCooldowns,
              };
              next.banking.materialStorage = {
                ...(snapshot.materialStorage ?? {}),
              };
              touchedModels.delete("inventory_items");
              touchedModels.delete("player_status");
              touchedModels.delete("material_storage");
              touchedModels.add("inventory_rejection");
              warnings.push("inventory_item_rejected:world_drop_unavailable");
            }
          }
        }
        if (kind === "use_item" && itemActionItemId) {
          advanceSnapshotGroveQuestsFromAuthoritativeEvent("item_use", {
            itemId: itemActionItemId,
            itemName: itemActionDefinition?.displayName,
            category: itemActionDefinition?.category,
            useEffect:
              useHeal > 0 ? "heal" : reviveHealthPercent > 0 ? "revive" : "use",
          });
        } else if (kind === "equip_item" && itemActionItemId) {
          advanceSnapshotGroveQuestsFromAuthoritativeEvent("inventory", {
            kind: "equip",
            operation: "equip",
            itemId: itemActionItemId,
            itemName: itemActionDefinition?.displayName,
            category: itemActionDefinition?.category,
            slot: invReq.targetSlot,
            equipmentSlots: Object.keys(updated.equipment),
          });
        }
      } else {
        warnings.push(
          ...invResult.errors.map((e) => `inventory_item_rejected:${e}`)
        );
        touchedModels.add("inventory_rejection");
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
        if (!HARTHMERE_ABILITY_DEFINITIONS[abilityId]) {
          warnings.push("loadout_rejected:unknown_ability");
          touchedModels.add("loadout_rejection");
          break;
        }
        if (!knownHarthmereAbilityIds(next.classMagic).has(abilityId)) {
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
        const proposedLoadout = Array.from({ length: 8 }, (_unused, index) => {
          const existing = next.classMagic.loadout[`slot_${index}`];
          return existing === abilityId ? undefined : existing;
        });
        proposedLoadout[slotIndex] = abilityId;
        const loadoutReq: HarthmereCombatActionRequest = {
          requestId: envelope.requestId,
          kind: "loadout_change",
          actorId: envelope.actorId,
          nowMs,
          newLoadout: proposedLoadout.filter((entry): entry is string =>
            Boolean(entry)
          ),
        };
        const loadoutResult = reduceHarthmereCombatAction(loadoutReq, {
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
      const loadoutReq: HarthmereCombatActionRequest = {
        requestId: envelope.requestId,
        kind: "loadout_change",
        actorId: envelope.actorId,
        nowMs,
        newLoadout,
      };
      const loadoutResult = reduceHarthmereCombatAction(loadoutReq, {
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
      if (!HARTHMERE_SKILL_DEFINITIONS[skillId]) {
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
          ? computeHarthmereXpReward({
              actorLevel,
              targetLevel: Math.max(1, Math.trunc(sourceLevel ?? 1)),
              baseXp: boundedBaseXp,
              contributionScore,
              antiFarmMultiplier: antiFarmRewardMultiplier({
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
    // CONTAINER transfer — one all-or-nothing inventory transaction
    // -----------------------------------------------------------------------
    case "request_container_transfer": {
      const rawItems = payloadRecord(envelope, "items");
      const requestedItems = Object.entries(rawItems ?? {})
        .map(([itemId, rawCount]) => ({
          itemId,
          count:
            typeof rawCount === "number" &&
            Number.isFinite(rawCount) &&
            rawCount >= 1 &&
            rawCount <= 250 &&
            Math.trunc(rawCount) === rawCount
              ? rawCount
              : 0,
        }))
        .filter((entry) => entry.itemId.length > 0 && entry.count > 0)
        .slice(0, 20);
      if (
        requestedItems.length === 0 ||
        requestedItems.length !== Object.keys(rawItems ?? {}).length
      ) {
        warnings.push("container_transfer_rejected:invalid_items");
        touchedModels.add("container_transfer_rejection");
        break;
      }

      let working = buildInventorySnapshot();
      const overflow: Array<{
        itemId: string;
        count: number;
        reason: string;
      }> = [];
      let rejection: string | undefined;
      for (const item of requestedItems) {
        const parsedBiomesItemId = safeParseBiomesId(item.itemId);
        const existingDefinition = getHarthmereItemDefinition(item.itemId);
        if (
          !existingDefinition &&
          !(parsedBiomesItemId && anItem(parsedBiomesItemId))
        ) {
          rejection = `unknown_item_id:${item.itemId}`;
          break;
        }
        ensureLiveModeItemDefinition(item.itemId, working);
        const definition = getHarthmereItemDefinition(item.itemId);
        const result = reduceHarthmereInventoryMutation(
          {
            requestId: `${envelope.requestId}:${item.itemId}`,
            actorId: envelope.actorId,
            kind: "pickup_item",
            nowMs,
            itemId: item.itemId,
            count: item.count,
          },
          {
            snapshot: working,
            playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
            playerSkills: next.classMagic.skills,
            playerClassId: next.classMagic.classId ?? "warrior",
            reputation: next.law.reputation,
          }
        );
        if (!result.ok) {
          const canOverflow = result.errors.every(
            (error) =>
              error === "inventory_full" || error === "stack_size_exceeded"
          );
          if (!canOverflow) {
            rejection = result.errors.join(",") || "inventory_rejected";
            break;
          }

          const availableStackSpace = Math.max(
            0,
            (definition?.maxStackSize ?? 0) - (working.items[item.itemId] ?? 0)
          );
          let inventoryCount = Math.min(item.count, availableStackSpace);
          if (inventoryCount > 0) {
            const partialResult = reduceHarthmereInventoryMutation(
              {
                requestId: `${envelope.requestId}:${item.itemId}:partial`,
                actorId: envelope.actorId,
                kind: "pickup_item",
                nowMs,
                itemId: item.itemId,
                count: inventoryCount,
              },
              {
                snapshot: working,
                playerLevel:
                  next.classMagic.skills["character_level"]?.level ?? 1,
                playerSkills: next.classMagic.skills,
                playerClassId: next.classMagic.classId ?? "warrior",
                reputation: next.law.reputation,
              }
            );
            if (partialResult.ok) {
              working = applyHarthmereInventoryMutationResult(
                working,
                partialResult
              );
            } else if (
              partialResult.errors.every((error) => error === "inventory_full")
            ) {
              inventoryCount = 0;
            } else {
              rejection =
                partialResult.errors.join(",") || "inventory_rejected";
              break;
            }
          }
          const overflowCount = item.count - inventoryCount;
          if (overflowCount > 0) {
            overflow.push({
              itemId: item.itemId,
              count: overflowCount,
              reason: "container_sent_to_overflow",
            });
          }
          continue;
        }
        working = applyHarthmereInventoryMutationResult(working, result);
      }
      if (rejection) {
        warnings.push(`container_transfer_rejected:${rejection}`);
        touchedModels.add("container_transfer_rejection");
        break;
      }

      next.inventory.items = working.items;
      next.inventory.gold = working.gold;
      next.inventory.escrow = working.escrow;
      next.inventory.equipment = working.equipment;
      next.inventory.consumableCooldowns = working.consumableCooldowns;
      next.banking.materialStorage =
        working.materialStorage ?? next.banking.materialStorage;
      if (overflow.length > 0) {
        next.inventory.overflow.push(...overflow);
        for (const entry of overflow) {
          warnings.push(`${entry.reason}:${entry.itemId}`);
        }
        touchedModels.add("inventory_overflow");
      }
      ensureInventoryLootActorSynced();
      syncInventoryLootActorToLiveInventory();
      next.combat.lootClaims[envelope.requestId] = nowMs;
      for (const item of requestedItems) {
        const definition = getHarthmereItemDefinition(item.itemId);
        advanceSnapshotGroveQuestsFromAuthoritativeEvent("collect", {
          itemId: item.itemId,
          itemName: definition?.displayName,
        });
      }
      touchedModels.add("inventory_items");
      touchedModels.add("material_storage");
      touchedModels.add("container_transfer");
      touchedModels.add("loot_claims");
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
        const actorPosition = actorWorldPositionFromAuthority(envelope);
        if (!actorPosition) {
          warnings.push("loot_rejected:actor_position_unverified");
          touchedModels.add("loot_rejection");
          break;
        }
        if (!drop.position) {
          warnings.push("loot_rejected:drop_position_missing");
          touchedModels.add("loot_rejection");
          break;
        }
        // Custom string-id drops are a compatibility layer until every item is
        // a native Bikkie GrabBag. Match the native pickup radius and validate
        // against the server-read player position, never the browser claim.
        if (distanceSq3(actorPosition, drop.position) > 25) {
          warnings.push("loot_rejected:pickup_distance_too_large");
          touchedModels.add("loot_rejection");
          break;
        }
        const backpackStacks = liveLootDropBackpackStacksForCarry(
          drop.itemStacks
        );
        if (
          wouldStacksExceedCarryWeight(next.inventory.items, backpackStacks)
        ) {
          pushCarryWeightRejection(warnings, touchedModels, "loot");
          break;
        }
        ensureInventoryLootActorSynced();
        const lootResult = reduceHarthmereInventoryLootMutation(
          next.inventoryLoot,
          {
            requestId: envelope.requestId,
            actorId: envelope.actorId,
            nowMs,
            operation: "claim_loot_drop",
            dropId: inventoryLootDropId,
            pickupToken: payloadString(envelope, "pickupToken"),
          },
          inventoryLootContextForDrop(drop)
        );
        if (!lootResult.ok) {
          warnings.push(
            ...lootResult.errors.map((error) => `loot_rejected:${error}`)
          );
          touchedModels.add("loot_rejection");
          break;
        }
        next.inventoryLoot = lootResult.state;
        routeInventoryLootActorMaterialsToLiveStorage(
          next.inventoryLoot.lootDrops[inventoryLootDropId]?.itemStacks ?? {}
        );
        syncInventoryLootActorToLiveInventory();
        next.combat.lootClaims[envelope.requestId] = nowMs;
        for (const [itemId, count] of Object.entries(drop.itemStacks)) {
          if (count <= 0) continue;
          const definition = getHarthmereItemDefinition(itemId);
          advanceSnapshotGroveQuestsFromAuthoritativeEvent("collect", {
            itemId,
            itemName: definition?.displayName,
          });
        }
        touchedModels.add("inventory_items");
        touchedModels.add("inventory_loot_drops");
        touchedModels.add("loot_claims");
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey("loot_drop", inventoryLootDropId)
        );
        break;
      }
      if (
        envelope.actionKind === "request_inventory_mutation" &&
        !isServerAuthorityEnvelope(envelope)
      ) {
        warnings.push("inventory_rejected:admin_authority_required");
        touchedModels.add("inventory_rejection");
        break;
      }
      const invReq: HarthmereInventoryMutationRequest = {
        requestId: envelope.requestId,
        actorId: envelope.actorId,
        kind:
          envelope.actionKind === "request_inventory_mutation"
            ? "admin_grant"
            : "pickup_item",
        nowMs,
        itemId: payloadString(envelope, "itemId"),
        count: payloadPositiveWholeCount(envelope),
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
      if (invReq.itemId) {
        ensureLiveModeItemDefinition(invReq.itemId, snapshot);
      }
      const rewardSource =
        envelope.actionKind === "request_inventory_mutation"
          ? "inventory"
          : "loot";
      const hasDirectItemDeltas = !!payloadRecord(envelope, "itemDeltas");
      if (
        invReq.itemId &&
        !hasDirectItemDeltas &&
        routeLiveModeRewardOutsideBackpack(
          next,
          invReq.itemId,
          invReq.count ?? 1,
          rewardSource,
          warnings,
          touchedModels
        )
      ) {
        next.combat.lootClaims[envelope.requestId] = nowMs;
        const definition = getHarthmereItemDefinition(invReq.itemId);
        advanceSnapshotGroveQuestsFromAuthoritativeEvent("collect", {
          itemId: invReq.itemId,
          itemName: definition?.displayName,
        });
        touchedModels.add("loot_claims");
        break;
      }
      if (
        envelope.actionKind === "request_inventory_mutation"
          ? wouldDirectInventoryPayloadExceedCarryWeight(
              snapshot.items,
              envelope,
              { includePrimaryItem: true }
            )
          : wouldExceedCarryWeight(
              snapshot.items,
              invReq.itemId,
              invReq.count ?? 1
            )
      ) {
        pushCarryWeightRejection(
          warnings,
          touchedModels,
          envelope.actionKind === "request_inventory_mutation"
            ? "inventory"
            : "loot"
        );
        break;
      }
      const invResult = reduceHarthmereInventoryMutation(invReq, {
        snapshot,
        playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
        playerSkills: next.classMagic.skills,
        playerClassId: next.classMagic.classId ?? "warrior",
        reputation: next.law.reputation,
      });
      if (invResult.ok) {
        const updated = applyHarthmereInventoryMutationResult(
          snapshot,
          invResult
        );
        next.inventory.items = updated.items;
        next.inventory.gold = updated.gold;
        next.inventory.escrow = updated.escrow;
        next.banking.materialStorage =
          updated.materialStorage ?? next.banking.materialStorage;
        next.inventory.equipment = updated.equipment;
        next.inventory.consumableCooldowns = updated.consumableCooldowns;
        if (
          envelope.actionKind === "request_inventory_mutation" &&
          applyDirectInventoryItemPayload(next.inventory.items, envelope, {
            includePrimaryItem: false,
          })
        ) {
          touchedModels.add("inventory_items");
        }
        next.combat.lootClaims[envelope.requestId] = nowMs;
        if (invReq.itemId) {
          const definition = getHarthmereItemDefinition(invReq.itemId);
          advanceSnapshotGroveQuestsFromAuthoritativeEvent("collect", {
            itemId: invReq.itemId,
            itemName: definition?.displayName,
          });
        }
        touchedModels.add("inventory_items");
        touchedModels.add("loot_claims");
        if (Object.keys(invResult.materialStorageDeltas ?? {}).length > 0) {
          touchedModels.add("material_storage");
        }
        if (Object.keys(invResult.equipmentChanges ?? {}).length > 0) {
          touchedModels.add("equipment_slots");
        }
      } else {
        if (
          invResult.errors.some(
            (error) =>
              error === "inventory_full" ||
              error === "stack_size_exceeded" ||
              error === "inventory_full_or_stack_exceeded"
          ) &&
          sendLiveModeRewardToOverflow(
            next,
            invReq.itemId,
            invReq.count ?? 1,
            `${rewardSource}_sent_to_overflow`,
            warnings,
            touchedModels
          )
        ) {
          next.combat.lootClaims[envelope.requestId] = nowMs;
          if (invReq.itemId) {
            const definition = getHarthmereItemDefinition(invReq.itemId);
            advanceSnapshotGroveQuestsFromAuthoritativeEvent("collect", {
              itemId: invReq.itemId,
              itemName: definition?.displayName,
            });
          }
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
          harthmereLiveModeSharedStateKey("vendor", vendorId)
        );
        touchedModels.add("vendor_stock");
        warnings.push("vendor_transaction_recorded_without_item_id");
        break;
      }

      const snapshot = buildInventorySnapshot();
      const vendorCount = payloadPositiveWholeCount(envelope);
      if (vendorCount === undefined) {
        warnings.push("vendor_rejected:invalid_count");
        touchedModels.add("vendor_rejection");
        break;
      }
      const buyRoutesToMaterialStorage =
        transactionKind !== "sell" &&
        liveModeItemShouldRouteToMaterialStorage(vendorItemId) &&
        bankRecordHasCapacity(
          next.banking.materialStorage,
          vendorItemId,
          next.banking.materialStorageMaxSlots
        );
      if (
        transactionKind !== "sell" &&
        !buyRoutesToMaterialStorage &&
        wouldExceedCarryWeight(snapshot.items, vendorItemId, vendorCount)
      ) {
        pushCarryWeightRejection(warnings, touchedModels, "vendor");
        break;
      }
      const invReq: HarthmereInventoryMutationRequest = {
        requestId: envelope.requestId,
        actorId: envelope.actorId,
        kind: transactionKind === "sell" ? "sell_to_vendor" : "buy_from_vendor",
        nowMs,
        itemId: vendorItemId,
        count: vendorCount,
        vendorId,
      };
      const invResult = reduceHarthmereInventoryMutation(invReq, {
        snapshot,
        playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
        playerSkills: next.classMagic.skills,
        playerClassId: next.classMagic.classId ?? "warrior",
        reputation: next.law.reputation,
      });
      if (invResult.ok) {
        const updated = applyHarthmereInventoryMutationResult(
          snapshot,
          invResult
        );
        next.inventory.items = updated.items;
        next.inventory.gold = updated.gold;
        if (buyRoutesToMaterialStorage) {
          const carried = Math.max(
            0,
            Math.trunc(Number(next.inventory.items[vendorItemId] ?? 0) || 0)
          );
          const deposit = Math.min(vendorCount, carried);
          if (deposit > 0) {
            applyBankRecordDelta(next.inventory.items, vendorItemId, -deposit);
            applyBankRecordDelta(
              next.banking.materialStorage,
              vendorItemId,
              deposit
            );
            appendBankingLog(next, {
              kind: "vendor_material_storage_deposit",
              vault: "materials",
              itemId: vendorItemId,
              count: deposit,
            });
            warnings.push(`vendor_sent_to_material_storage:${vendorItemId}`);
            touchedModels.add("material_storage");
            touchedModels.add("bank_transaction_log");
          }
        }
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: `vendor_${transactionKind}`,
          amount: invResult.goldDelta,
          atMs: nowMs,
        });
        next.economy.vendorTransactions[vendorId] =
          (next.economy.vendorTransactions[vendorId] ?? 0) + 1;
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey("vendor", vendorId)
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
      const auctionReq: HarthmereAuctionMutationRequest = {
        requestId: envelope.requestId,
        kind: "post_listing",
        actorId: envelope.actorId,
        nowMs,
        itemId: payloadString(envelope, "itemId"),
        count: payloadPositiveWholeCount(envelope),
        suggestedUnitPrice: payloadNumber(envelope, "unitPrice") ?? undefined,
      };
      if (auctionReq.itemId && auctionReq.count === undefined) {
        warnings.push("auction_post_rejected:invalid_count");
        touchedModels.add("auction_post_rejection");
        break;
      }
      const auctionResult = reduceHarthmereAuctionMutation(auctionReq, {
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
          harthmereLiveModeSharedStateKey("auction_listing", listingId)
        );
        // Publish the listing to the shared marketplace so other players can settle it.
        sharedStateKeys.add(harthmereLiveModeSharedWorldStateKey());
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
        | HarthmereAuctionListing
        | undefined;
      const buyerSnapshot = buildInventorySnapshot();
      if (
        currentListing &&
        wouldExceedCarryWeight(
          buyerSnapshot.items,
          currentListing.itemId,
          currentListing.count
        )
      ) {
        pushCarryWeightRejection(warnings, touchedModels, "auction_settle");
        break;
      }
      const auctionReq: HarthmereAuctionMutationRequest = {
        requestId: envelope.requestId,
        kind: "buy_listing",
        actorId: envelope.actorId,
        nowMs,
        listingId,
      };
      const auctionResult = reduceHarthmereAuctionMutation(auctionReq, {
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
          harthmereLiveModeSharedStateKey("auction_listing", listingId)
        );
        // Queue the seller's sale proceeds + escrow/item release for them to collect on
        // their next sync (the seller is not the acting player here). Replaces the old
        // empty "seller_account" key that was never consumed, so the seller was never paid.
        const sellerId = auctionResult.listing.sellerId;
        next.economy.auctionSellerPayouts = {
          ...next.economy.auctionSellerPayouts,
          [sellerId]: [
            ...(next.economy.auctionSellerPayouts[sellerId] ?? []),
            {
              listingId,
              goldNet: Math.max(0, auctionResult.sellerGoldDelta),
              itemId,
              count: itemCount,
              soldAtMs: nowMs,
            },
          ],
        };
        sharedStateKeys.add(harthmereLiveModeSharedWorldStateKey());
        touchedModels.add("auction_listing");
        touchedModels.add("auction_seller_payout");
        touchedModels.add("inventory_items");
        touchedModels.add("wallet");
        touchedModels.add("economy_ledger");
        touchedModels.add("house_tax");
      } else {
        warnings.push(
          ...auctionResult.errors.map((e) => `auction_settle_rejected:${e}`)
        );
        touchedModels.add("auction_settle_rejection");
      }
      break;
    }

    // -----------------------------------------------------------------------
    // AUCTION CANCEL — seller pulls their own active listing; escrow released locally
    // -----------------------------------------------------------------------
    case "request_auction_cancel": {
      const listingId =
        payloadString(envelope, "listingId") ?? envelope.requestId;
      const currentListing = next.economy.auctionListings[listingId] as
        | HarthmereAuctionListing
        | undefined;
      const r = reduceHarthmereAuctionMutation(
        {
          requestId: envelope.requestId,
          kind: "cancel_listing",
          actorId: envelope.actorId,
          nowMs,
          listingId,
        },
        { actorSnapshot: buildInventorySnapshot(), currentListing }
      );
      if (r.ok && r.listing) {
        next.economy.auctionListings[listingId] = r.listing;
        applyAuctionSellerEscrowDelta(
          next,
          r.listing.itemId,
          r.sellerEscrowDelta
        );
        sharedStateKeys.add(harthmereLiveModeSharedWorldStateKey());
        touchedModels.add("auction_listing");
        touchedModels.add("inventory_escrow");
      } else {
        warnings.push(...r.errors.map((e) => `auction_cancel_rejected:${e}`));
        touchedModels.add("auction_cancel_rejection");
      }
      break;
    }

    // -----------------------------------------------------------------------
    // AUCTION RECOVER — seller reclaims an expired listing's escrowed item
    // -----------------------------------------------------------------------
    case "request_auction_recover": {
      const listingId =
        payloadString(envelope, "listingId") ?? envelope.requestId;
      const currentListing = next.economy.auctionListings[listingId] as
        | HarthmereAuctionListing
        | undefined;
      const r = reduceHarthmereAuctionMutation(
        {
          requestId: envelope.requestId,
          kind: "recover_expired_escrow",
          actorId: envelope.actorId,
          nowMs,
          listingId,
        },
        { actorSnapshot: buildInventorySnapshot(), currentListing }
      );
      if (r.ok) {
        applyAuctionSellerEscrowDelta(
          next,
          currentListing?.itemId,
          r.sellerEscrowDelta
        );
        // The listing is fully resolved once recovered; drop it from the marketplace.
        if (currentListing) delete next.economy.auctionListings[listingId];
        sharedStateKeys.add(harthmereLiveModeSharedWorldStateKey());
        touchedModels.add("auction_listing");
        touchedModels.add("inventory_escrow");
      } else {
        warnings.push(...r.errors.map((e) => `auction_recover_rejected:${e}`));
        touchedModels.add("auction_recover_rejection");
      }
      break;
    }

    // -----------------------------------------------------------------------
    // AUCTION EXPIRE — sweep due active listings to "expired" (escrow stays locked
    // until the seller recovers it). Safe to call on a periodic tick.
    // -----------------------------------------------------------------------
    case "request_auction_expire": {
      let expired = 0;
      for (const [lid, listing] of Object.entries(
        next.economy.auctionListings
      )) {
        if (listing.status !== "active" || nowMs <= listing.expiresAtMs)
          continue;
        const r = reduceHarthmereAuctionMutation(
          {
            requestId: `${envelope.requestId}:${lid}`,
            kind: "expire_listing",
            actorId: envelope.actorId,
            nowMs,
            listingId: lid,
          },
          { actorSnapshot: buildInventorySnapshot(), currentListing: listing }
        );
        if (r.ok && r.listing) {
          next.economy.auctionListings[lid] = r.listing;
          expired++;
        }
      }
      if (expired > 0) {
        sharedStateKeys.add(harthmereLiveModeSharedWorldStateKey());
        touchedModels.add("auction_listing");
      } else {
        warnings.push("auction_expire:no_listings_due");
      }
      break;
    }

    // -----------------------------------------------------------------------
    // PAY FINE — settle outstanding law-fine debt against the wallet
    // -----------------------------------------------------------------------
    case "request_pay_fine": {
      const factionId =
        payloadString(envelope, "factionId") ?? HARTHMERE_CIVIL_LAW_FACTION_ID;
      const owed = Math.max(0, Math.trunc(next.law.fines[factionId] ?? 0));
      if (owed <= 0) {
        warnings.push("pay_fine_rejected:no_outstanding_fine");
        touchedModels.add("law_fine_rejection");
        break;
      }
      const pay = Math.min(Math.max(0, next.inventory.gold), owed);
      if (pay <= 0) {
        warnings.push("pay_fine_rejected:insufficient_gold");
        touchedModels.add("law_fine_rejection");
        break;
      }
      next.inventory.gold -= pay;
      const remaining = owed - pay;
      if (remaining > 0) {
        next.law.fines[factionId] = remaining;
      } else {
        delete next.law.fines[factionId];
      }
      touchedModels.add("wallet");
      touchedModels.add("law_fines");
      break;
    }

    // -----------------------------------------------------------------------
    // CLEAR BOUNTY — offender pays off their own outstanding bounty, which resolves the
    // crime record(s) and unblocks civil permits (previously a permanent soft-lock).
    // -----------------------------------------------------------------------
    case "request_clear_bounty": {
      const factionId =
        payloadString(envelope, "factionId") ?? HARTHMERE_CIVIL_LAW_FACTION_ID;
      const records = next.law.crimeRecords ?? [];
      const outstanding = records.filter(
        (r) =>
          r.factionId === factionId &&
          (r.status === "wanted" || r.status === "arrest_pending") &&
          Math.trunc(r.bountyGold ?? 0) > 0
      );
      const totalBounty = outstanding.reduce(
        (sum, r) => sum + Math.max(0, Math.trunc(r.bountyGold ?? 0)),
        0
      );
      if (totalBounty <= 0) {
        warnings.push("clear_bounty_rejected:no_active_bounty");
        touchedModels.add("law_bounty_rejection");
        break;
      }
      if (next.inventory.gold < totalBounty) {
        warnings.push("clear_bounty_rejected:insufficient_gold");
        touchedModels.add("law_bounty_rejection");
        break;
      }
      next.inventory.gold -= totalBounty;
      const outstandingIds = new Set(outstanding.map((r) => r.id));
      next.law.crimeRecords = records.map((r) =>
        outstandingIds.has(r.id)
          ? { ...r, status: "served" as const, bountyGold: 0 }
          : r
      );
      sharedStateKeys.add(harthmereLiveModeSharedWorldStateKey());
      touchedModels.add("wallet");
      touchedModels.add("law_bounty_cleared");
      touchedModels.add("law_crime_records");
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
      const count = payloadPositiveWholeCount(envelope);
      const vaultKind = normalizeBankVaultKind(
        payloadString(envelope, "vaultKind")
      );
      sharedStateKeys.add(
        harthmereLiveModeSharedStateKey("bank", next.actorId)
      );
      if (itemId && count === undefined) {
        warnings.push("bank_rejected:invalid_count");
        touchedModels.add("bank_rejection");
        break;
      }

      if (operation === "deposit" || operation === "withdraw") {
        const snapshot = buildInventorySnapshot();
        if (itemId) {
          ensureLiveModeItemDefinition(itemId, snapshot);
        }
        const isDeposit = operation !== "withdraw";
        if (
          !isDeposit &&
          wouldExceedCarryWeight(next.inventory.items, itemId, count ?? 1)
        ) {
          pushCarryWeightRejection(warnings, touchedModels, "bank_withdraw");
          break;
        }
        if (
          isDeposit &&
          itemId &&
          !bankRecordHasCapacity(
            next.inventory.bank,
            itemId,
            next.banking.personalBankMaxSlots
          )
        ) {
          warnings.push("bank_rejected:bank_full");
          touchedModels.add("bank_rejection");
          break;
        }
        const bankReq: HarthmereInventoryMutationRequest = {
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          kind: isDeposit ? "transfer_to_bank" : "withdraw_from_bank",
          nowMs,
          bankItemId: itemId,
          bankCount: count ?? 1,
        };
        const bankResult = reduceHarthmereInventoryMutation(bankReq, {
          snapshot,
          playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
          playerSkills: next.classMagic.skills,
          playerClassId: next.classMagic.classId ?? "warrior",
          reputation: next.law.reputation,
        });
        if (bankResult.ok) {
          const updated = applyHarthmereInventoryMutationResult(
            snapshot,
            bankResult
          );
          next.inventory.items = updated.items;
          next.inventory.bank = updated.bank;
          appendBankingLog(next, {
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
        if (currentSlots >= HARTHMERE_BANK_MAX_SLOTS) {
          warnings.push("bank_rejected:max_slots_reached");
          touchedModels.add("bank_rejection");
          break;
        }
        const cost = bankUpgradeCost(vaultKind, currentSlots);
        if (next.inventory.gold < cost) {
          warnings.push("bank_rejected:not_enough_gold_for_slot_upgrade");
          touchedModels.add("bank_rejection");
          break;
        }
        next.inventory.gold -= cost;
        if (vaultKind === "account")
          next.banking.accountBankMaxSlots += HARTHMERE_BANK_SLOT_UPGRADE_SIZE;
        else if (vaultKind === "materials")
          next.banking.materialStorageMaxSlots +=
            HARTHMERE_BANK_SLOT_UPGRADE_SIZE;
        else
          next.banking.personalBankMaxSlots += HARTHMERE_BANK_SLOT_UPGRADE_SIZE;
        appendBankingLog(next, {
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
        const def = ensureLiveModeItemDefinition(itemId, snapshot);
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
            !bankRecordHasCapacity(
              next.banking.accountBank,
              itemId,
              next.banking.accountBankMaxSlots
            )
          ) {
            warnings.push("bank_rejected:account_bank_full");
            touchedModels.add("bank_rejection");
            break;
          }
          applyBankRecordDelta(next.inventory.items, itemId, -transferCount);
          applyBankRecordDelta(next.banking.accountBank, itemId, transferCount);
        } else {
          if ((next.banking.accountBank[itemId] ?? 0) < transferCount) {
            warnings.push("bank_rejected:insufficient_account_bank_item_count");
            touchedModels.add("bank_rejection");
            break;
          }
          if (
            wouldExceedCarryWeight(next.inventory.items, itemId, transferCount)
          ) {
            pushCarryWeightRejection(
              warnings,
              touchedModels,
              "account_bank_withdraw"
            );
            break;
          }
          applyBankRecordDelta(
            next.banking.accountBank,
            itemId,
            -transferCount
          );
          applyBankRecordDelta(next.inventory.items, itemId, transferCount);
        }
        appendBankingLog(next, {
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
        const def = ensureLiveModeItemDefinition(itemId, snapshot);
        const isMaterial =
          !!def?.isCraftingMaterial || isLikelyBankingMaterialItemId(itemId);
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
            !bankRecordHasCapacity(
              next.banking.materialStorage,
              itemId,
              next.banking.materialStorageMaxSlots
            )
          ) {
            warnings.push("bank_rejected:material_storage_full");
            touchedModels.add("bank_rejection");
            break;
          }
          applyBankRecordDelta(next.inventory.items, itemId, -transferCount);
          applyBankRecordDelta(
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
            wouldExceedCarryWeight(next.inventory.items, itemId, transferCount)
          ) {
            pushCarryWeightRejection(
              warnings,
              touchedModels,
              "material_storage_withdraw"
            );
            break;
          }
          applyBankRecordDelta(
            next.banking.materialStorage,
            itemId,
            -transferCount
          );
          applyBankRecordDelta(next.inventory.items, itemId, transferCount);
        }
        appendBankingLog(next, {
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
            HARTHMERE_LOAN_MAX_PRINCIPAL,
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
            activeLoanBalance(loan, nowMs).totalRemaining > 0
        );
        if (
          amount <= 0 ||
          unpaidLoan ||
          next.law.flags[HARTHMERE_BANK_CREDIT_HOLD_FLAG]
        ) {
          warnings.push(
            unpaidLoan?.status === "defaulted" ||
              next.law.flags[HARTHMERE_BANK_CREDIT_HOLD_FLAG]
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
          dailyInterestRate: HARTHMERE_LOAN_DAILY_INTEREST_RATE,
          openedAtMs: nowMs,
          dueAtMs: nowMs + days * HARTHMERE_LOAN_DAY_MS,
          status: "active",
        };
        next.inventory.gold += amount;
        appendBankingLog(next, {
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
        const balance = activeLoanBalance(loan, nowMs);
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
          activeLoanBalance(loan, nowMs).totalRemaining <= 0
        ) {
          loan.status = "paid";
          clearBankCreditHoldIfSettled(next, nowMs);
        }
        appendBankingLog(next, {
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
      const count = payloadPositiveWholeCount(envelope);
      if (itemId && count === undefined) {
        warnings.push("mail_rejected:invalid_count");
        touchedModels.add("mail_rejection");
        break;
      }
      const mail = next.mail.messages[mailId];
      if (!mail || mail.recipientActorId !== envelope.actorId) {
        warnings.push("mail_rejected:not_found");
        sharedStateKeys.add(harthmereLiveModeSharedStateKey("mail", mailId));
        touchedModels.add("mail_rejection");
        break;
      }
      if (mail.status === "deleted") {
        warnings.push("mail_rejected:deleted");
        sharedStateKeys.add(harthmereLiveModeSharedStateKey("mail", mailId));
        touchedModels.add("mail_rejection");
        break;
      }
      if (operation === "claim_attachment") {
        if (mail.status === "claimed") {
          warnings.push("mail_claim_rejected:already_claimed");
          sharedStateKeys.add(harthmereLiveModeSharedStateKey("mail", mailId));
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
          sharedStateKeys.add(harthmereLiveModeSharedStateKey("mail", mailId));
          touchedModels.add("mail_rejection");
          break;
        }
        const projectedItems = { ...next.inventory.items };
        for (const [attachmentItemId, attachmentCount] of claimEntries) {
          ensureLiveModeItemDefinition(
            attachmentItemId,
            buildInventorySnapshot()
          );
          applyBankRecordDelta(
            projectedItems,
            attachmentItemId,
            attachmentCount
          );
        }
        if (
          harthmereInventoryCarryWeight(projectedItems) >
          HARTHMERE_CARRY_WEIGHT_LIMIT
        ) {
          pushCarryWeightRejection(warnings, touchedModels, "mail_claim");
          sharedStateKeys.add(harthmereLiveModeSharedStateKey("mail", mailId));
          break;
        }
        for (const [attachmentItemId, attachmentCount] of claimEntries) {
          applyBankRecordDelta(
            next.inventory.items,
            attachmentItemId,
            attachmentCount
          );
          applyBankRecordDelta(
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
        sharedStateKeys.add(harthmereLiveModeSharedStateKey("mail", mailId));
        break;
      }
      sharedStateKeys.add(harthmereLiveModeSharedStateKey("mail", mailId));
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
        ensureLiveModeItemDefinition(itemId, buildInventorySnapshot());
      }
      const result = reduceHarthmereGuildMutation(
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
          itemGoldValue: liveModeGuildItemUnitGoldValue(
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
            const def = ensureLiveModeItemDefinition(
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
            !wouldExceedCarryWeight(
              next.inventory.items,
              candidateItemId,
              count
            ),
          guildBankHasCapacity: (items, candidateItemId, maxSlots) =>
            bankRecordHasCapacity(items, candidateItemId, maxSlots),
          canLinkGuildHallProperty: ({ guildId, actorId, propertyId }) => {
            const property = next.property.owned[propertyId];
            if (!property || property.guildId !== guildId) return false;
            const blueprint = buildingSystemBlueprintById(property.blueprintId);
            if (property.use !== "guild" && blueprint?.use !== "guild")
              return false;
            return buildingSystemCanActorAccessProperty({
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
        applyBankRecordDelta(next.inventory.items, deltaItemId, delta);
      }
      for (const warning of result.warnings) warnings.push(warning);
      for (const model of result.touchedModels) touchedModels.add(model);
      for (const guildId of result.sharedGuildIds) {
        sharedStateKeys.add(harthmereLiveModeSharedStateKey("guild", guildId));
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
        HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID;
      const actorPosition = actorWorldPositionFromAuthority(envelope);
      const authoritativeEquippedToolActions = [
        ...(harthmereRepairToolGate({ equipment: next.inventory.equipment }).ok
          ? ["repair"]
          : []),
        ...(harthmereCleanupToolGate({ equipment: next.inventory.equipment }).ok
          ? ["cleanup"]
          : []),
      ];
      const board = next.jobsBoard.boards[boardId];
      const nearbyBoardId =
        actorPosition && board
          ? distanceSq3(actorPosition, {
              x: board.location.x,
              y: board.location.y,
              z: board.location.z,
            }) <=
            board.location.radius * board.location.radius
            ? boardId
            : undefined
          : undefined;
      const requestedJobId = payloadString(envelope, "jobId");
      if (
        operation === "accept_job" &&
        requestedJobId &&
        !next.jobsBoard.postings[requestedJobId]
      ) {
        const seedResult = reduceHarthmereJobsBoardMutation(
          next.jobsBoard,
          {
            requestId: `${envelope.requestId}:accept_seed:${boardId}`,
            actorId: envelope.actorId,
            nowMs,
            operation: "economy_auto_seed_jobs",
            boardId,
          } as any,
          {
            actorGold: next.inventory.gold,
            actorInventoryItems: combinedBackpackAndMaterialStorageItems(next),
            actorMaterialStorageItems: next.banking.materialStorage,
            actorCollectibles: next.collections.discovered,
            actorGuildId: next.guild.memberGuildId,
            actorPosition,
            authoritativeEquippedToolActions,
            nearbyBoardId,
            economy: next.economy.production,
          }
        );
        next.jobsBoard = seedResult.jobsBoard;
        if (seedResult.economy) next.economy.production = seedResult.economy;
        for (const warning of seedResult.warnings) warnings.push(warning);
        for (const model of seedResult.touchedModels) touchedModels.add(model);
        for (const key of seedResult.sharedStateKeys) sharedStateKeys.add(key);
      }
      const result = reduceHarthmereJobsBoardMutation(
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
          actorInventoryItems: combinedBackpackAndMaterialStorageItems(next),
          actorMaterialStorageItems: next.banking.materialStorage,
          actorCollectibles: next.collections.discovered,
          actorGuildId: next.guild.memberGuildId,
          actorPosition,
          authoritativeEquippedToolActions,
          nearbyBoardId,
          economy: next.economy.production,
          canManageBusinessJobs: (business: any) =>
            (business.ownerKind === "player" &&
              business.ownerId === envelope.actorId) ||
            (business.ownerKind === "guild" &&
              business.ownerId === next.guild.memberGuildId &&
              hasHarthmereGuildPermission(
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
            hasHarthmereGuildPermission(
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
      syncAllEscortCompanionsToCombat();
      if (result.economy) next.economy.production = result.economy;
      next.inventory.gold = Math.max(
        0,
        next.inventory.gold + result.inventoryGoldDelta
      );
      for (const [itemId, delta] of Object.entries(
        result.inventoryItemDeltas
      )) {
        applyJobsBoardInventoryItemDelta(
          next,
          itemId,
          Number(delta),
          touchedModels
        );
      }
      for (const collectibleId of result.collectibleRewardIds ?? []) {
        if (HARTHMERE_COLLECTIBLE_DEFINITIONS[collectibleId]) {
          if (next.collections.discovered[collectibleId] === undefined) {
            next.collections.discovered[collectibleId] = nowMs;
            touchedModels.add("collections");
          }
        }
      }
      for (const todo of Object.values(next.jobsBoard.todos)) {
        if (todo.actorId !== envelope.actorId) continue;
        const questId = `jobs_board:${todo.todoId}`;
        const job = next.jobsBoard.postings[todo.jobId];
        const claimable = harthmereJobsBoardTodoIsClaimable(next, todo);
        if (todo.status === "active" || claimable) {
          const plan = harthmereJobMarkerPlan({
            kind: todo.kind ?? job?.kind,
            requirements: job?.requirements,
            fieldMarkerId:
              todo.mapMarkerId ??
              job?.mapMarkerId ??
              todo.targetId ??
              job?.targetId,
            boardMarkerId: harthmereJobsBoardTodoBoardMarkerId(next, todo),
            progress: harthmereJobsBoardTodoProgress(next, todo, job),
          });
          next.quests.active[questId] = {
            stepId: claimable
              ? `${todo.jobId}:return_to_board`
              : plan.phase === "return_to_board"
              ? `${todo.jobId}:return_to_board`
              : todo.jobId,
            progress: plan.objectiveMet ? 1 : 0,
          };
          delete next.quests.completed[questId];
          if (plan.activeMarkerId) {
            const marker = harthmereJobsBoardQuestMarkerRuntimePositionForTodo({
              mapMarkerId: plan.activeMarkerId,
              targetId: plan.activeMarkerId,
              fallbackPosition: harthmereJobsBoardTodoFallbackPosition(
                next,
                todo
              ),
            });
            next.building.inWorldMarkers[`jobs_board_marker:${todo.todoId}`] = {
              markerId: `jobs_board_marker:${todo.todoId}`,
              plotId: marker.markerId,
              kind: "map_marker",
              position: marker.position,
              label:
                marker.label && !plan.hint.includes(marker.label)
                  ? `${todo.title}: ${plan.hint} (${marker.label})`
                  : `${todo.title}: ${plan.hint}`,
              createdAtMs: todo.createdAtMs,
            };
          } else {
            delete next.building.inWorldMarkers[
              `jobs_board_marker:${todo.todoId}`
            ];
          }
          touchedModels.add("building_state");
          touchedModels.add("quest_state");
          const exoticRequirement = job?.requirements.find((requirement) =>
            isHarthmereExoticMatterMaterialItemId(requirement.itemId)
          );
          if (exoticRequirement && plan.phase !== "return_to_board") {
            const targetDeposit = harthmereExoticMatterDepositById(
              exoticRequirement.mapMarkerId ?? job.mapMarkerId
            );
            const requirementCount = Math.trunc(
              Number(exoticRequirement.count ?? 1)
            );
            const markers = harthmereExoticMatterAcceptedJobDepositMarkers({
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
                position: resolveHarthmereProductionMarkerPosition({
                  source: "exotic_matter_deposit",
                  markerId: marker.depositId,
                  fallback: marker.position,
                }),
                label: `${todo.title}: ${marker.label}`,
                createdAtMs: todo.createdAtMs,
              };
            }
          } else {
            for (const markerId of Object.keys(next.building.inWorldMarkers)) {
              if (
                markerId.startsWith(`jobs_board_exotic_deposit:${todo.todoId}:`)
              ) {
                delete next.building.inWorldMarkers[markerId];
              }
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
        rejectEconomyMutationOutsideBusiness({
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
      const result = reduceHarthmereEconomyMutation(
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
          actorKnownRecipes: next.classMagic.knownRecipes,
          actorGuildId: next.guild.memberGuildId,
          canManageGuildBusiness: (guildId: string) =>
            guildId === next.guild.memberGuildId &&
            hasHarthmereGuildPermission(
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
        applyBankRecordDelta(next.inventory.items, itemId, Number(delta));
      }
      for (const recipeId of result.newRecipeIds ?? []) {
        if (
          getHarthmereCraftingRecipe(recipeId) &&
          !next.classMagic.knownRecipes.includes(recipeId)
        ) {
          next.classMagic.knownRecipes.push(recipeId);
          touchedModels.add("known_recipes");
        }
      }
      for (const warning of result.warnings) warnings.push(warning);
      for (const model of result.touchedModels) touchedModels.add(model);
      for (const key of result.sharedStateKeys) sharedStateKeys.add(key);
      recordEconomyBuildingMaterializationPlans(
        result.buildingMaterializationPlans
      );
      if (result.inventoryGoldDelta !== 0) {
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: `economy_${operation}`,
          amount: result.inventoryGoldDelta,
          atMs: nowMs,
        });
        touchedModels.add("wallet");
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
      const witnessMultiplier = reputationWitnessMultiplier(witnessLevel);
      let likeabilityDelta = payloadNumber(envelope, "likeabilityDelta") ?? 0;
      let legalDelta = payloadNumber(envelope, "legalDelta") ?? 0;
      let notorietyDelta = payloadNumber(envelope, "notorietyDelta") ?? 0;
      const notorietyFloorDelta =
        payloadNumber(envelope, "notorietyFloorDelta") ?? 0;
      const requestedFineDelta = payloadNumber(envelope, "fineDelta") ?? 0;
      const fineDeltaBox = {
        value:
          !isServerAuthorityEnvelope(envelope) && requestedFineDelta < 0
            ? 0
            : requestedFineDelta,
      };
      if (!isServerAuthorityEnvelope(envelope) && requestedFineDelta < 0) {
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
      applyHarthmereLiveModeCrimeEvent({
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

      next.law.reputation[factionId] = clampSignedReputation(
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
          next.law.standing[factionId] ?? defaultReputationStanding();
        const after = applyReputationStandingDelta(
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
      if (fineDelta > 0) {
        // Enforced: charge the wallet, carry only the unpayable remainder as debt.
        if (chargeEnforcedLawFine(next, factionId, fineDelta) > 0) {
          touchedModels.add("wallet");
        }
      } else if (fineDelta < 0) {
        // Server-authorized fine reduction (e.g. amnesty) reduces outstanding debt.
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
        harthmereLiveModeSharedStateKey("zone_law", envelope.zoneId)
      );
      touchedModels.add("law_reputation");
      break;
    }
    case "request_trainer_unlock":
    case "request_skill_book_use": {
      // Trainer unlock / skill book: server validates access before granting
      const classChoice = payloadString(envelope, "classId");
      if (classChoice) {
        const result = applyHarthmereClassChoice(next.classMagic, classChoice);
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
        const result = applyHarthmereSpecializationChoice(
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
      if (recipeId && !getHarthmereCraftingRecipe(recipeId)) {
        warnings.push("recipe_rejected:unknown_recipe");
        touchedModels.add("known_recipes_rejection");
        break;
      }
      if (abilityId && !next.classMagic.knownAbilities.includes(abilityId)) {
        const learnResult = canLearnHarthmereAbility({
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
      const respecReq: HarthmereCombatActionRequest = {
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
      const respecResult = reduceHarthmereCombatAction(respecReq, {
        actor,
        zone: buildZoneSnapshot(),
        respecCount: next.respec?.count ?? 0,
        lastRespecAtMs: next.respec?.lastRespecAtMs,
        actorGold: next.inventory.gold,
        talentPointsAvailable: 0,
      });
      if (respecResult.ok) {
        // reduceHarthmereCombatAction returns a negative goldCost for respec
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
        reduceQuestInviteMutation({
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
      // -----------------------------------------------------------------
      // HARTHMERE_BIBLE_QUEST_WIRING (bible-wiring fix, 2026-07-14)
      //
      // Bible catalog operations: accept / advance / complete / abandon /
      // retry / boss_event. All quest-state math lives in the pure reducer
      // (bible_quest_live_authority.ts, unit-tested); this branch only
      // (1) feeds it live state, (2) writes back the returned slice, and
      // (3) applies reward instructions + journal mirrors + the Thaedryn
      // combat snapshot sync with this file's own helpers.
      // -----------------------------------------------------------------
      if (
        liveEntityHelperOperation?.startsWith(
          HARTHMERE_BIBLE_QUEST_OPERATION_PREFIX
        )
      ) {
        const actorPosition = actorWorldPositionFromAuthority(envelope);
        const result = reduceHarthmereBibleQuestOperation({
          slice: next.quests.bible,
          actorId: envelope.actorId,
          playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
          completedQuests: next.quests.completed,
          nowMs,
          operation: liveEntityHelperOperation,
          questId: payloadString(envelope, "questId"),
          objectiveId: payloadString(envelope, "objectiveId"),
          actorPosition: actorPosition
            ? [actorPosition.x, actorPosition.y, actorPosition.z]
            : undefined,
          choice: payloadString(envelope, "choice"),
          combatResult: payloadString(envelope, "combatResult") as any,
          requestId: envelope.requestId,
          weatherClaim: payloadString(envelope, "weather"),
          bossEventType: payloadString(envelope, "bossEventType"),
          bossEventAmount: payloadNumber(envelope, "bossEventAmount"),
          bossEventPath: payloadString(envelope, "bossEventPath"),
          bossMode: payloadString(envelope, "bossMode") as any,
        });
        warnings.push(...result.warnings);
        if (!result.ok) {
          touchedModels.add("quest_state_rejection");
          break;
        }
        next.quests.bible = result.slice;
        if (result.objectiveItemGrant) {
          const grant = result.objectiveItemGrant;
          if (!getHarthmereItemDefinition(grant.itemId)) {
            registerHarthmereItemDefinition(
              harthmereBibleObjectiveItemDefinition(grant)
            );
          }
          ensureInventoryLootActorSynced();
          const lootActor = next.inventoryLoot.actors[next.actorId];
          const stackSlotLimit = Math.max(
            0,
            (lootActor?.maxInventorySlots ?? 40) -
              (lootActor?.instanceIds.length ?? 0)
          );
          if (
            bankRecordHasCapacity(
              next.inventory.items,
              grant.itemId,
              stackSlotLimit
            )
          ) {
            recordDelta(next.inventory.items, grant.itemId, grant.count);
            if (lootActor) {
              lootActor.items = { ...next.inventory.items };
            }
            touchedModels.add("inventory_items");
          } else {
            next.inventory.overflow.push({
              itemId: grant.itemId,
              count: grant.count,
              reason: "quest_objective_inventory_full",
            });
            warnings.push(`quest_item_sent_to_overflow:${grant.itemId}`);
            touchedModels.add("inventory_overflow");
          }
        }
        // Journal mirror: the map/journal adapters read quests.active /
        // quests.completed, so bible quests surface with zero adapter work.
        if (result.activeMirror) {
          const bibleMarkerId = `bible_quest:${result.activeMirror.questId}`;
          if (result.activeMirror.remove) {
            delete next.quests.active[result.activeMirror.questId];
            delete next.building.inWorldMarkers[bibleMarkerId];
          } else if (result.activeMirror.entry) {
            next.quests.active[result.activeMirror.questId] =
              result.activeMirror.entry;
            // Map pin at the current objective's resolved position (same
            // in-world marker channel helper quests and Mira use), so the
            // minimap/compass guides the player to the next step.
            if (result.activeMirror.entry.giverPosition) {
              next.building.inWorldMarkers[bibleMarkerId] = {
                markerId: bibleMarkerId,
                plotId: "harthmere",
                // "npc_map_marker" is the existing marker kind rendered as a
                // guidance pin (the Mira/steward pattern); there is no
                // dedicated quest kind in BuildingSystemInWorldMarker.
                kind: "npc_map_marker",
                position: [...result.activeMirror.entry.giverPosition] as [
                  number,
                  number,
                  number
                ],
                label:
                  result.activeMirror.entry.title ??
                  result.activeMirror.questId,
                createdAtMs: nowMs,
              };
            }
          }
          touchedModels.add("building_state");
        }
        if (result.completedMirrorQuestId) {
          next.quests.completed[result.completedMirrorQuestId] = nowMs;
        }
        if (result.rewards) {
          applyHarthmereBibleQuestRewards(
            next,
            result.rewards,
            warnings,
            touchedModels,
            nowMs
          );
        }
        if (result.thaedrynSnapshot) {
          syncHarthmereThaedrynCombatSnapshot(
            next,
            nowMs,
            result.thaedrynSnapshot
          );
          touchedModels.add("entity_snapshots");
          sharedStateKeys.add(
            harthmereLiveModeSharedStateKey(
              "entity_combat",
              HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID
            )
          );
        }
        touchedModels.add("quest_state");
        touchedModels.add("building_state");
        break;
      }

      if (liveEntityHelperOperation?.startsWith("live_entity_robot_")) {
        if (liveEntityHelperOperation === "live_entity_robot_energy_tick") {
          const robotId =
            payloadString(envelope, "robotId") ??
            payloadString(envelope, "entityId") ??
            envelope.targetId;
          const result = tickLiveEntityRobotEnergy(next.robotProtection, {
            nowMs,
            drainPerHour: payloadNumber(envelope, "drainPerHour"),
            robotIds: robotId ? [robotId] : undefined,
          });
          next.robotProtection = result.state;
          warnings.push(...result.warnings);
          syncLiveEntityRobotProtectionToBuilding(next, nowMs);
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
            liveEntityRobotProtectionAreaForPosition(position)?.areaId;
          const result = rechargeLiveEntityRobotEnergy(next.robotProtection, {
            robotId,
            areaId,
            nowMs,
            amount:
              payloadNumber(envelope, "energyAmount") ??
              LIVE_ENTITY_ROBOT_RECHARGE_AMOUNT,
            displayName:
              payloadString(envelope, "entityLabel") ??
              payloadString(envelope, "robotName"),
          });
          if (result.warnings.length > 0) {
            warnings.push(...result.warnings);
            touchedModels.add("robot_protection_rejection");
            break;
          }
          ensureLiveEntityHelperServerItemDefinition(
            LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID
          );
          if (
            (next.inventory.items[LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID] ?? 0) <
            LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY
          ) {
            warnings.push(
              `live_entity_robot_rejected:item_required:${LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID}`
            );
            touchedModels.add("robot_protection_rejection");
            break;
          }
          next.robotProtection = result.state;
          recordDelta(
            next.inventory.items,
            LIVE_ENTITY_ROBOT_RECHARGE_ITEM_ID,
            -LIVE_ENTITY_ROBOT_RECHARGE_ITEM_QUANTITY
          );
          applyLiveEntityRobotRechargeReward(next, warnings, touchedModels);
          syncLiveEntityRobotProtectionToBuilding(next, nowMs);
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
        const quest = liveEntityHelperQuestFromEnvelope(envelope, warnings);
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
          const context = liveEntityHelperQuestContextFromEnvelope(envelope);
          next.quests.active[quest.questId] = {
            stepId:
              liveEntityHelperQuestTargetMarkerForKind(quest.kind)?.id ??
              LIVE_ENTITY_HELPER_ACCEPTED_STEP_ID,
            progress: 0,
            source: "live_entity_helper",
            title: quest.title,
            questKind: quest.kind,
            entityId: quest.entityId,
            giverName: quest.giverName,
            ...(context?.position
              ? {
                  giverPosition: [...context.position] as [
                    number,
                    number,
                    number
                  ],
                }
              : {}),
          };
          upsertLiveEntityHelperQuestMarker(next, quest, nowMs);
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
          const marker = liveEntityHelperQuestTargetMarkerForKind(quest.kind);
          if (!active) {
            warnings.push("live_entity_helper_rejected:active_quest_required");
            touchedModels.add("quest_state_rejection");
            break;
          }
          const hasBossMarker =
            !!next.building.inWorldMarkers[
              LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID
            ];
          const hasDefeatEvidence = hasLiveEntityHelperBossDefeatEvidence(
            next,
            envelope
          );
          if (!hasBossMarker && !hasDefeatEvidence) {
            warnings.push("live_entity_helper_rejected:boss_not_spawned");
            touchedModels.add("quest_state_rejection");
            break;
          }
          if (!isLiveEntityHelperMuckBossSpawnMarker(marker)) {
            warnings.push("live_entity_helper_rejected:boss_not_in_muck_area");
            touchedModels.add("quest_state_rejection");
            break;
          }
          if (!hasDefeatEvidence) {
            warnings.push("live_entity_helper_rejected:boss_defeat_required");
            touchedModels.add("quest_state_rejection");
            break;
          }
          next.quests.active[quest.questId] = {
            ...active,
            stepId: LIVE_ENTITY_HELPER_BOSS_DEFEATED_STEP_ID,
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
          const completion = canCompleteLiveEntityHelperQuest(quest, {
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
          const deltas = liveEntityHelperQuestDeltas(quest);
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
            ensureLiveEntityHelperServerItemDefinition(itemId);
          }
          for (const [itemId, quantity] of Object.entries(
            deltas.consumedItems
          )) {
            recordDelta(next.inventory.items, itemId, -quantity);
          }
          for (const [itemId, quantity] of Object.entries(deltas.rewardItems)) {
            recordDelta(next.inventory.items, itemId, quantity);
          }
          applyLiveEntityHelperQuestXp(next, quest, warnings, touchedModels);
          next.quests.completed[quest.questId] = nowMs;
          delete next.quests.active[quest.questId];
          removeLiveEntityHelperQuestMarker(next, quest);
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
            const result = reduceHarthmereJobsBoardMutation(
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
                usedToolAction: payloadString(envelope, "usedToolAction"),
              },
              {
                actorGold: next.inventory.gold,
                actorInventoryItems:
                  combinedBackpackAndMaterialStorageItems(next),
                actorMaterialStorageItems: next.banking.materialStorage,
                actorCollectibles: next.collections.discovered,
                actorGuildId: next.guild.memberGuildId,
                actorPosition: actorWorldPositionFromAuthority(envelope),
                authoritativeEquippedToolActions: [
                  ...(harthmereRepairToolGate({
                    equipment: next.inventory.equipment,
                  }).ok
                    ? ["repair"]
                    : []),
                  ...(harthmereCleanupToolGate({
                    equipment: next.inventory.equipment,
                  }).ok
                    ? ["cleanup"]
                    : []),
                ],
                economy: next.economy.production,
              }
            );
            next.jobsBoard = result.jobsBoard;
            if (result.economy) next.economy.production = result.economy;
            for (const [itemId, delta] of Object.entries(
              result.inventoryItemDeltas
            )) {
              applyJobsBoardInventoryItemDelta(
                next,
                itemId,
                Number(delta),
                touchedModels
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
          // NOTE: generic (non jobs-board / non live-entity-helper) quest
          // completion is currently client-asserted with no server-side
          // objective verification, and one-shot completion (without a prior
          // "active" record) is a supported flow. Proper anti-cheat here needs
          // the current quest objectives wired into this reducer so the server can
          // re-derive completion -- tracked as a feature-scale follow-up.
          next.quests.completed[questId] = nowMs;
          delete next.quests.active[questId];
        } else {
          const questSource = payloadString(envelope, "source");
          if (questSource === "snapshot_grove") {
            const authoredQuest = SNAPSHOT_GROVE_QUESTS.find(
              (quest) => quest.id === questId
            );
            if (!authoredQuest) {
              warnings.push("snapshot_grove_quest_rejected:unknown_quest");
              touchedModels.add("quest_state_rejection");
              break;
            }
            const firstAcceptance =
              next.quests.active[questId] === undefined &&
              next.quests.completed[questId] === undefined;
            if (firstAcceptance) {
              ensureInventoryLootActorSynced();
              const lootActor = next.inventoryLoot.actors[next.actorId];
              for (const grant of snapshotGroveTutorialInventoryGrantsForQuest(
                authoredQuest
              )) {
                const definition = ensureLiveModeItemDefinition(
                  grant.itemId,
                  buildInventorySnapshot()
                );
                if (!definition) {
                  warnings.push(
                    `snapshot_grove_item_grant_skipped:unknown_item:${grant.itemId}`
                  );
                  continue;
                }
                const alreadyEquipped = Object.values(
                  next.inventory.equipment
                ).includes(grant.itemId);
                const grantCount =
                  grant.trigger === "inventory_change" &&
                  ((next.inventory.items[grant.itemId] ?? 0) > 0 ||
                    alreadyEquipped)
                    ? 0
                    : grant.quantity;
                if (grantCount <= 0) continue;
                const stackSlotLimit = Math.max(
                  0,
                  (lootActor?.maxInventorySlots ?? 40) -
                    (lootActor?.instanceIds.length ?? 0)
                );
                if (
                  !bankRecordHasCapacity(
                    next.inventory.items,
                    grant.itemId,
                    stackSlotLimit
                  )
                ) {
                  next.inventory.overflow.push({
                    itemId: grant.itemId,
                    count: grantCount,
                    reason: "snapshot_grove_starter_inventory_full",
                  });
                  warnings.push(
                    `snapshot_grove_item_sent_to_overflow:${grant.itemId}`
                  );
                  touchedModels.add("inventory_overflow");
                  continue;
                }
                recordDelta(next.inventory.items, grant.itemId, grantCount);
                touchedModels.add("inventory_items");
              }
              if (lootActor) {
                lootActor.items = { ...next.inventory.items };
              }
            }
          }
          next.quests.active[questId] = {
            stepId: payloadString(envelope, "stepId"),
            progress: Math.max(0, payloadNumber(envelope, "progress") ?? 1),
            source: questSource,
            title:
              questSource === "snapshot_grove"
                ? SNAPSHOT_GROVE_QUESTS.find((quest) => quest.id === questId)
                    ?.title
                : payloadString(envelope, "title"),
          };
        }
        touchedModels.add("quest_state");
      }
      const collectibleId = payloadString(envelope, "collectibleId");
      if (collectibleId) {
        if (HARTHMERE_COLLECTIBLE_DEFINITIONS[collectibleId]) {
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
      let plot = buildingSystemPlotFromState(next, requestedPlotId);

      if (!plot && subAction === "claim_plot") {
        const claimBlueprintId = payloadString(envelope, "blueprintId");
        const claimBlueprintItemId =
          payloadStringOrNumber(envelope, "blueprintItemId") ??
          payloadStringOrNumber(envelope, "bikkieBlueprintItemId");
        const claimStructureTypeId = payloadString(envelope, "structureTypeId");
        const claimBlueprintFromItem =
          buildingSystemBlueprintByItemId(claimBlueprintItemId);
        const claimBlueprint =
          buildingSystemBlueprintById(claimBlueprintId) ??
          claimBlueprintFromItem ??
          buildingSystemBlueprintByStructureType(claimStructureTypeId);
        const dynamicPlot = createBuildingSystemMuckAreaPlotDefinition({
          plotId: requestedPlotId,
          blueprint: claimBlueprint,
          origin:
            payloadNumber(envelope, "originX") !== undefined &&
            payloadNumber(envelope, "originZ") !== undefined
              ? {
                  x: payloadNumber(envelope, "originX")!,
                  y: payloadNumber(envelope, "originY"),
                  z: payloadNumber(envelope, "originZ")!,
                }
              : undefined,
          areaId:
            payloadString(envelope, "muckAreaId") ??
            payloadString(envelope, "areaId"),
        });
        if (!dynamicPlot.ok) {
          warnings.push(
            ...dynamicPlot.errors.map((error) => `plot_claim_rejected:${error}`)
          );
          touchedModels.add("building_rejection");
          break;
        }
        const blocker = buildingSystemClaimBlockerForPlot(
          next,
          dynamicPlot.plot
        );
        if (blocker) {
          warnings.push(`plot_claim_rejected:${blocker}`);
          touchedModels.add("building_rejection");
          break;
        }
        plot = dynamicPlot.plot;
        next.building.customPlots[plot.plotId] = plot;
        touchedModels.add("custom_muck_plot");
      }

      if (subAction === "read_state") {
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey("building_state", envelope.actorId)
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
          HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION
        ) {
          const outpostState =
            defaultHarthmereBusinessOutpostBuildingState(nowMs);
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
            HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION;
          const rebuildPlans =
            createHarthmereBusinessOutpostRebuildMaterializationPlans();
          buildingMaterializationPlans.push(...rebuildPlans);
          warnings.push(
            `business_outpost_auto_rebuild:${HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION}:plans:${rebuildPlans.length}`
          );
          touchedModels.add("business_outpost_voxel_rebuild");
          touchedModels.add("terrain_materialization");
          sharedStateKeys.add(harthmereLiveModeSharedWorldStateKey());
        }
        // A Redis commit can outlive a transient ECS/materializer outage. Retry
        // only unapplied solid-building plans; this is idempotent terrain work
        // and does not charge the actor or recreate the construction project.
        for (const plan of Object.values(next.building.materializationPlans)) {
          if (!plan.materializesSolidVoxelBuilding) continue;
          const structureId = plan.projectId ?? plan.requestId;
          const structure = next.building.placedStructures[structureId];
          if (structure && structure.materializedInEcs !== true) {
            buildingMaterializationPlans.push(plan);
            touchedModels.add("building_materialization_retry");
          }
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
          defaultHarthmereBusinessOutpostBuildingState(nowMs);
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
          createHarthmereBusinessOutpostRebuildMaterializationPlans();
        buildingMaterializationPlans.push(...rebuildPlans);
        // Stamp the revision so read_state won't auto-rebuild again.
        next.building.outpostBuildRevision =
          HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION;
        warnings.push(
          `business_outpost_rebuild_queued:${HARTHMERE_BUSINESS_OUTPOST_REBUILD_REVISION}:plans:${rebuildPlans.length}`
        );
        touchedModels.add("business_outpost_voxel_rebuild");
        touchedModels.add("terrain_materialization");
        sharedStateKeys.add(harthmereLiveModeSharedWorldStateKey());
        break;
      }

      if (
        subAction === "talk_to_steward" ||
        subAction === "complete_mira_intro"
      ) {
        next.quests.completed[BUILDING_SYSTEM_MIRA_INTRO_QUEST.questId] = nowMs;
        delete next.quests.active[BUILDING_SYSTEM_MIRA_INTRO_QUEST.questId];
        next.building.inWorldMarkers["mira_grove_land_steward_board_marker"] = {
          markerId: "mira_grove_land_steward_board_marker",
          plotId: "the_grove",
          kind: "npc_board",
          position: [501, 53, -132],
          label: "Mira Thatch · Building System",
          createdAtMs: nowMs,
        };
        const miraMapMarker = createBuildingSystemMiraMapMarker(nowMs);
        next.building.inWorldMarkers[miraMapMarker.markerId] = miraMapMarker;
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey(
            "quest",
            BUILDING_SYSTEM_MIRA_INTRO_QUEST.questId
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
        const existingPlotOwner = next.building.plotOwners[plot.plotId];
        if (existingPlotOwner && existingPlotOwner !== envelope.actorId) {
          warnings.push("plot_claim_rejected:plot_owned_by_another_actor");
          touchedModels.add("building_rejection");
          break;
        }
        if (
          existingPlotOwner === envelope.actorId ||
          next.building.ownedPlots.includes(plot.plotId)
        ) {
          // Idempotent success: clients can lose the original response when the
          // browser queues/aborts a request, so a retry for an already-owned plot
          // must return the current land state instead of blocking progression.
          warnings.push("plot_claim_idempotent:already_owned_by_actor");
          if (!next.building.safeZones[plot.plotId]) {
            if (plot.startsMucked) {
              next.building.safeZones[plot.plotId] = {
                safeFromMuck: false,
                activatedAtMs: nowMs,
                area: plot.area,
              };
              const repairPlan =
                createBuildingSystemMuckClaimMaterializationPlan({
                  requestId: `${envelope.requestId}:muck_deed_repair`,
                  actorId: envelope.actorId,
                  plot,
                  activatedAtMs: nowMs,
                });
              for (const marker of repairPlan.inWorldMarkers ?? []) {
                next.building.inWorldMarkers[marker.markerId] = marker;
              }
              next.building.materializationPlans[repairPlan.requestId] =
                repairPlan;
              buildingMaterializationPlans.push(repairPlan);
              touchedModels.add("plot_boundary_markers");
              touchedModels.add("terrain_materialization");
            } else if (plot.safeAfterPurchase) {
              next.building.safeZones[plot.plotId] = {
                safeFromMuck: true,
                activatedAtMs: nowMs,
                area: plot.area,
              };
              const repairPlan =
                createBuildingSystemSafeGroundMaterializationPlan({
                  requestId: `${envelope.requestId}:safe_deed_repair`,
                  actorId: envelope.actorId,
                  plot,
                  activatedAtMs: nowMs,
                  reason: "plot_claim_safe_ground",
                });
              for (const marker of repairPlan.inWorldMarkers ?? []) {
                next.building.inWorldMarkers[marker.markerId] = marker;
              }
              next.building.materializationPlans[repairPlan.requestId] =
                repairPlan;
              buildingMaterializationPlans.push(repairPlan);
              touchedModels.add("muck_safe_zone");
              touchedModels.add("plot_boundary_markers");
              touchedModels.add("terrain_materialization");
            }
          }
          next.building.plotOwners[plot.plotId] = envelope.actorId;
          if (!next.building.ownedPlots.includes(plot.plotId)) {
            next.building.ownedPlots.push(plot.plotId);
          }
          touchedModels.add("owned_plots");
          break;
        }
        if (
          rejectForCivilLegalBlockers({
            blockers: civilLegalAccessBlockers({ state: next }),
            warningPrefix: "plot_claim_rejected",
            rejectionModel: "building_rejection",
            warnings,
            touchedModels,
          })
        ) {
          break;
        }
        const claimPlot = toHarthmerePlotDefinition(
          plot,
          next.building.plotOwners[plot.plotId] ?? "",
          true
        );
        const claim = validateHarthmerePlotClaim(
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
            maxPlotsPerActor: Number.POSITIVE_INFINITY,
          }
        );
        if (!claim.ok) {
          warnings.push(...claim.errors.map((e) => `plot_claim_rejected:${e}`));
          touchedModels.add("building_rejection");
          break;
        }

        next.inventory.gold = Math.max(0, next.inventory.gold - claim.goldCost);
        if (
          next.building.plotOwners[plot.plotId] !== envelope.actorId ||
          !next.building.ownedPlots.includes(plot.plotId)
        ) {
          next.building.ownedPlots.push(plot.plotId);
        }
        next.building.plotOwners[plot.plotId] = envelope.actorId;
        const claimMiraMapMarker = createBuildingSystemMiraMapMarker(nowMs);
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
            createBuildingSystemMuckClaimMaterializationPlan({
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
        } else if (plot.safeAfterPurchase) {
          next.building.safeZones[plot.plotId] = {
            safeFromMuck: true,
            activatedAtMs: nowMs,
            area: plot.area,
          };
          const safeClaimPlan =
            createBuildingSystemSafeGroundMaterializationPlan({
              requestId: `${envelope.requestId}:safe_deed`,
              actorId: envelope.actorId,
              plot,
              activatedAtMs: nowMs,
              reason: "plot_claim_safe_ground",
            });
          for (const marker of safeClaimPlan.inWorldMarkers ?? []) {
            next.building.inWorldMarkers[marker.markerId] = marker;
          }
          next.building.materializationPlans[safeClaimPlan.requestId] =
            safeClaimPlan;
          buildingMaterializationPlans.push(safeClaimPlan);
          touchedModels.add("safe_deed");
          touchedModels.add("plot_boundary_markers");
          touchedModels.add("deed_marker");
          touchedModels.add("map_marker");
          touchedModels.add("muck_safe_zone");
          touchedModels.add("terrain_materialization");
        }
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: "plot_claim",
          amount: -claim.goldCost,
          atMs: nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey("plot", plot.plotId)
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
          buildingPropertyIdForPlot(plot.plotId);
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
        const actorPosition = actorWorldPositionFromAuthority(envelope);
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
            .map(buildingMarkerPosition)
            .filter(
              (position): position is { x: number; y: number; z: number } =>
                position !== undefined &&
                Number.isFinite(position.x) &&
                Number.isFinite(position.y) &&
                Number.isFinite(position.z)
            );
          const radius =
            propertyForTerraform.use === "home"
              ? HARTHMERE_HOME_CONSOLE_INTERACTION_RADIUS
              : HARTHMERE_BUSINESS_IN_WORLD_INTERACTION_RADIUS;
          if (
            accessMarkers.length > 0 &&
            accessMarkers.every(
              (position) =>
                distanceSq3(actorPosition, position) > radius * radius
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
        const terraformPlan = createBuildingSystemSafeGroundMaterializationPlan(
          {
            requestId: `${envelope.requestId}:terraform`,
            actorId: envelope.actorId,
            plot,
            activatedAtMs: nowMs,
            reason: "plot_terraform_safe_ground",
          }
        );
        for (const marker of terraformPlan.inWorldMarkers ?? []) {
          next.building.inWorldMarkers[marker.markerId] = marker;
        }
        next.building.materializationPlans[terraformPlan.requestId] =
          terraformPlan;
        buildingMaterializationPlans.push(terraformPlan);
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey("plot", plot.plotId)
        );
        touchedModels.add("muck_safe_zone");
        touchedModels.add("plot_terraform");
        touchedModels.add("map_marker");
        touchedModels.add("terrain_materialization");
        break;
      }

      const blueprintId = payloadString(envelope, "blueprintId");
      const blueprintItemId =
        payloadStringOrNumber(envelope, "blueprintItemId") ??
        payloadStringOrNumber(envelope, "bikkieBlueprintItemId");
      const structureTypeId = payloadString(envelope, "structureTypeId");
      const blueprintFromItem =
        buildingSystemBlueprintByItemId(blueprintItemId);
      const blueprint =
        buildingSystemBlueprintById(blueprintId) ??
        blueprintFromItem ??
        buildingSystemBlueprintByStructureType(structureTypeId, plot?.plotType);
      const propertyId =
        payloadString(envelope, "propertyId") ??
        (plot ? buildingPropertyIdForPlot(plot.plotId) : envelope.requestId);
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
        if (
          next.building.plotOwners[plot.plotId] !== envelope.actorId ||
          !next.building.ownedPlots.includes(plot.plotId)
        ) {
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
          rejectForCivilLegalBlockers({
            blockers: civilLegalAccessBlockers({ state: next }),
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
          buildingProjectIdForPlot(plot.plotId);
        const existingProject = next.building.activeProjects[projectId];
        if (existingProject && existingProject.status !== "cancelled") {
          if (existingProject.actorId !== envelope.actorId) {
            warnings.push(
              "building_project_rejected:project_owned_by_another_actor"
            );
            touchedModels.add("building_rejection");
          } else {
            warnings.push("building_project_idempotent:project_already_exists");
            touchedModels.add("building_project");
          }
          break;
        }
        if (next.property.owned[propertyId]) {
          warnings.push(
            "building_project_idempotent:property_already_completed"
          );
          touchedModels.add("property_building");
          break;
        }
        const origin = {
          x:
            payloadNumber(envelope, "originX") ??
            buildingSystemDefaultOrigin(plot, blueprint).x,
          y:
            payloadNumber(envelope, "originY") ??
            buildingSystemDefaultOrigin(plot, blueprint).y,
          z:
            payloadNumber(envelope, "originZ") ??
            buildingSystemDefaultOrigin(plot, blueprint).z,
        };
        const rotation = (payloadNumber(envelope, "rotationDegrees") ?? 0) as
          | 0
          | 90
          | 180
          | 270;
        const guidePreview = createBuildingSystemPlacementPreview({
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
        const placementReq: HarthmereBuildingPlacementRequest = {
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          structureTypeId: blueprint.structureTypeId,
          origin,
          rotationDegrees: rotation,
          plotId: plot.plotId,
          nowMs,
        };
        const placementCtx = createBuildingSystemPlacementContext({
          actorId: envelope.actorId,
          plot,
          blueprint,
          origin,
          owned: true,
          nearbyStructures: buildingSystemNearbyStructuresForState(next),
          currentCoveredAreaVoxels: Object.values(
            next.building.placedStructures
          )
            .filter((entry) => entry.plotId === plot.plotId)
            .reduce((acc, entry) => acc + (entry.voxelEditCount ?? 0), 0),
        });
        const placementResult = validateHarthmereBuildingPlacement(
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
          harthmereLiveModeSharedStateKey("property", propertyId)
        );
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey("plot", plot.plotId)
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
          buildingProjectIdForPlot(plot.plotId);
        const project = next.building.activeProjects[projectId];
        if (!project || project.status !== "active") {
          warnings.push("building_stage_rejected:active_project_not_found");
          touchedModels.add("building_rejection");
          break;
        }
        if (project.actorId !== envelope.actorId) {
          warnings.push(
            "building_stage_rejected:project_owned_by_another_actor"
          );
          touchedModels.add("building_rejection");
          break;
        }
        const projectBlueprint = buildingSystemBlueprintById(
          project.blueprintId
        );
        if (!projectBlueprint) {
          warnings.push("building_stage_rejected:blueprint_not_found");
          touchedModels.add("building_rejection");
          break;
        }
        const requestedStage =
          payloadString(envelope, "stage") ?? project.currentStage;
        if (!isBuildingSystemStage(requestedStage)) {
          warnings.push("building_stage_rejected:invalid_stage");
          touchedModels.add("building_rejection");
          break;
        }
        if (project.completedStages.includes(requestedStage)) {
          warnings.push("building_stage_idempotent:stage_already_completed");
          touchedModels.add("construction_stage_state");
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
        const requestedMaterials = normalizeMaterialContributionPayload(
          payloadRecord(envelope, "materials")
        );
        const materialRequest = buildingSystemRemainingMaterialItemDeltas({
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
          const line = materialRequest.lines.find(
            (candidate) => candidate.itemId === itemId
          );
          const available = line
            ? countAvailableBuildingMaterial({
                inventoryItems: next.inventory.items,
                materialStorage: next.banking.materialStorage,
                line,
              })
            : next.inventory.items[itemId] ?? 0;
          if (available < needed) {
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

        let consumedMaterialStorage = false;
        for (const [itemId, delta] of Object.entries(
          materialRequest.itemDeltas
        )) {
          const needed = Math.abs(delta);
          const line = materialRequest.lines.find(
            (candidate) => candidate.itemId === itemId
          );
          if (!line) {
            recordDelta(next.inventory.items, itemId, delta);
            continue;
          }
          const consumed = consumeAvailableBuildingMaterial({
            inventoryItems: next.inventory.items,
            materialStorage: next.banking.materialStorage,
            line,
            requested: needed,
          });
          if (consumed.remaining > 0) {
            warnings.push(
              `building_stage_rejected:insufficient_material:${itemId}`
            );
            touchedModels.add("building_rejection");
            break;
          }
          consumedMaterialStorage =
            consumedMaterialStorage || consumed.materialStorageConsumed > 0;
        }
        if (touchedModels.has("building_rejection")) {
          break;
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

        const materialsComplete = allBuildingMaterialsComplete(
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
          project.currentStage = nextBuildingSystemStage(requestedStage);
          const stagePlan = createBuildingSystemStageMaterializationPlan({
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
            const completedProperty = createBuildingSystemPropertyRecord({
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
            syncBuildingSystemPhysicalAccessRecords({
              state: next,
              property: completedProperty,
              plotId: plot.plotId,
              origin: project.origin,
              nowMs,
            });
            if (projectBlueprint.use === "guild" && completedProperty.guildId) {
              const guildHallLink = linkHarthmereGuildHallProperty({
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
                  harthmereLiveModeSharedStateKey(
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
              // The API marks this true only after the ECS/world operation
              // succeeds. A committed Redis record is not proof of a house.
              materializedInEcs: false,
              ownerActorId: envelope.actorId,
            };
            touchedModels.add("property_building");
            touchedModels.add("placed_structures");
            touchedModels.add("storage_unlocked");
          } else {
            next.property.buildingProgress[propertyId] = Math.floor(
              (project.completedStages.length /
                BUILDING_SYSTEM_CONSTRUCTION_STAGES.length) *
                100
            );
          }
        }

        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey("property", propertyId)
        );
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey("plot", plot.plotId)
        );
        touchedModels.add("inventory_items");
        if (consumedMaterialStorage) {
          touchedModels.add("material_storage");
        }
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
        if (
          next.building.plotOwners[plot.plotId] !== envelope.actorId ||
          !next.building.ownedPlots.includes(plot.plotId)
        ) {
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
          rejectForCivilLegalBlockers({
            blockers: civilLegalAccessBlockers({ state: next }),
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
            buildingSystemDefaultOrigin(plot, blueprint).x,
          y:
            payloadNumber(envelope, "originY") ??
            buildingSystemDefaultOrigin(plot, blueprint).y,
          z:
            payloadNumber(envelope, "originZ") ??
            buildingSystemDefaultOrigin(plot, blueprint).z,
        };
        const rotation = (payloadNumber(envelope, "rotationDegrees") ?? 0) as
          | 0
          | 90
          | 180
          | 270;
        const guidePreview = createBuildingSystemPlacementPreview({
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
        const placementReq: HarthmereBuildingPlacementRequest = {
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          structureTypeId: blueprint.structureTypeId,
          origin,
          rotationDegrees: rotation,
          plotId: plot.plotId,
          nowMs,
        };
        const placementCtx = createBuildingSystemPlacementContext({
          actorId: envelope.actorId,
          plot,
          blueprint,
          origin,
          owned: true,
          nearbyStructures: buildingSystemNearbyStructuresForState(next),
          currentCoveredAreaVoxels: Object.values(
            next.building.placedStructures
          )
            .filter((entry) => entry.plotId === plot.plotId)
            .reduce((acc, entry) => acc + (entry.voxelEditCount ?? 0), 0),
        });
        const placementResult = validateHarthmereBuildingPlacement(
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
        const plan = createBuildingSystemMaterializationPlan({
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
          // Persist pending first; the post-commit materializer acknowledges
          // success back into the shared world record.
          materializedInEcs: false,
          ownerActorId: envelope.actorId,
        };
        next.building.materializationPlans[envelope.requestId] = plan;
        if (plan.safeZone) {
          next.building.safeZones[plot.plotId] = {
            safeFromMuck: true,
            activatedAtMs: plan.safeZone.activatedAtMs,
            area: plan.safeZone.area,
          };
        }
        const placedProperty = createBuildingSystemPropertyRecord({
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
        syncBuildingSystemPhysicalAccessRecords({
          state: next,
          property: placedProperty,
          plotId: plot.plotId,
          origin,
          nowMs,
        });
        if (blueprint.use === "guild" && placedProperty.guildId) {
          const guildHallLink = linkHarthmereGuildHallProperty({
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
              harthmereLiveModeSharedStateKey("guild", placedProperty.guildId)
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
          harthmereLiveModeSharedStateKey("property", propertyId)
        );
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey("plot", plot.plotId)
        );
        touchedModels.add("wallet");
        touchedModels.add("property_building");
        touchedModels.add("placed_structures");
        touchedModels.add("terrain_materialization");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "manage_property" || subAction === "assess_property") {
        const property = getOwnedPropertyForMutation({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (property) {
          const propertyPlot = buildingSystemPlotFromState(
            next,
            property.plotId
          );
          const propertyBlueprint = buildingSystemBlueprintById(
            property.blueprintId
          );
          if (
            propertyPlot &&
            propertyBlueprint &&
            property.condition <= 80 &&
            !property.visualDamageApplied
          ) {
            const damagePlan =
              createBuildingSystemRepairDamageMaterializationPlan({
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
          syncBuildingSystemPhysicalAccessRecords({
            state: next,
            property,
            plotId: property.plotId,
            nowMs,
          });
          sharedStateKeys.add(
            harthmereLiveModeSharedStateKey("property", propertyId)
          );
          touchedModels.add("property_building");
          touchedModels.add("property_lifecycle");
        }
        break;
      }

      if (subAction === "set_access_mode") {
        const property = getOwnedPropertyForMutation({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        const accessMode = normalizeAccessMode(
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
          createBuildingSystemDefaultPermissions(accessMode);
        property.updatedAtMs = nowMs;
        next.property.owned[propertyId] = property;
        syncBuildingSystemPhysicalAccessRecords({
          state: next,
          property,
          plotId: property.plotId,
          nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey("property", propertyId)
        );
        touchedModels.add("physical_access_controls");
        touchedModels.add("property_permissions");
        break;
      }

      if (subAction === "set_permission") {
        const property = getOwnedPropertyForMutation({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        const subject = normalizePermissionSubject(
          payloadString(envelope, "subject")
        );
        const permission = normalizePermissionKey(
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
          harthmereLiveModeSharedStateKey("property", propertyId)
        );
        touchedModels.add("property_permissions");
        break;
      }

      if (subAction === "add_guest" || subAction === "remove_guest") {
        const property = getOwnedPropertyForMutation({
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
        syncBuildingSystemPhysicalAccessRecords({
          state: next,
          property,
          plotId: property.plotId,
          nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey("property", propertyId)
        );
        touchedModels.add("physical_access_controls");
        touchedModels.add("property_permissions");
        break;
      }

      if (subAction === "pay_property_tax") {
        const property = getOwnedPropertyForMutation({
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
          harthmereLiveModeSharedStateKey("property", propertyId)
        );
        touchedModels.add("wallet");
        touchedModels.add("property_tax");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "repair_property") {
        const property = getOwnedPropertyForMutation({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        const cost = buildingSystemRepairCostGold(property);
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
        const propertyPlot = buildingSystemPlotFromState(next, property.plotId);
        const propertyBlueprint = buildingSystemBlueprintById(
          property.blueprintId
        );
        if (propertyPlot && propertyBlueprint) {
          const repairPlan =
            createBuildingSystemRepairRestoreMaterializationPlan({
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
        syncBuildingSystemPhysicalAccessRecords({
          state: next,
          property,
          plotId: property.plotId,
          nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey("property", propertyId)
        );
        touchedModels.add("wallet");
        touchedModels.add("property_repair");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "upgrade_property") {
        const property = getOwnedPropertyForMutation({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        if (
          !buildingSystemCanActorAccessProperty({
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
        const cost = buildingSystemUpgradeCostGold(property);
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
        property.value = computePropertyTierValue(property);
        property.storageSlots += Math.max(
          4,
          Math.floor(property.storageSlots * 0.5)
        );
        property.condition = Math.min(100, property.condition + 10);
        property.updatedAtMs = nowMs;
        const propertyPlot = buildingSystemPlotFromState(next, property.plotId);
        const propertyBlueprint = buildingSystemBlueprintById(
          property.blueprintId
        );
        if (propertyPlot && propertyBlueprint) {
          const upgradePlan = createBuildingSystemUpgradeMaterializationPlan({
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
        syncBuildingSystemPhysicalAccessRecords({
          state: next,
          property,
          plotId: property.plotId,
          nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey("property", propertyId)
        );
        touchedModels.add("wallet");
        touchedModels.add("property_upgrade");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "set_storage_item_count") {
        const property = getOwnedPropertyForMutation({
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
        syncBuildingSystemPhysicalAccessRecords({
          state: next,
          property,
          plotId: property.plotId,
          nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey("property", propertyId)
        );
        touchedModels.add("physical_storage_container");
        touchedModels.add("property_storage");
        break;
      }

      if (subAction === "demolish_property") {
        const property = getOwnedPropertyForMutation({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        if (
          !buildingSystemCanActorAccessProperty({
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
            : buildingSystemDemolitionRefundGold(property);
        next.inventory.gold += refund;
        property.status = "demolished";
        property.updatedAtMs = nowMs;
        const propertyPlot = buildingSystemPlotFromState(next, property.plotId);
        const propertyBlueprint = buildingSystemBlueprintById(
          property.blueprintId
        );
        if (propertyPlot && propertyBlueprint) {
          const demolitionPlan =
            createBuildingSystemDemolitionMaterializationPlan({
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
        removeBuildingSystemPhysicalAccessRecords({ state: next, property });
        if (property.businessId) {
          delete next.economy.businesses[property.businessId];
          const productionBusiness =
            next.economy.production.businesses[property.businessId];
          if (
            productionBusiness?.ownerKind === "player" &&
            productionBusiness.ownerId === envelope.actorId
          ) {
            delete next.economy.production.businesses[property.businessId];
            sharedStateKeys.add(
              `harthmere:economy:business:${property.businessId}`
            );
            touchedModels.add("economy_production_business_removed");
            touchedModels.add("economy_production_state");
          }
        }
        delete next.property.owned[propertyId];
        if (propertyPlot) {
          next.building.ownedPlots = next.building.ownedPlots.filter(
            (id) => id !== propertyPlot.plotId
          );
          if (
            next.building.plotOwners[propertyPlot.plotId] === envelope.actorId
          ) {
            delete next.building.plotOwners[propertyPlot.plotId];
          }
          delete next.building.customPlots[propertyPlot.plotId];
          for (const [structureId, structure] of Object.entries(
            next.building.placedStructures
          )) {
            if (structure.plotId === propertyPlot.plotId) {
              delete next.building.placedStructures[structureId];
            }
          }
          delete next.building.activeProjects[
            buildingProjectIdForPlot(propertyPlot.plotId)
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
          harthmereLiveModeSharedStateKey("property", propertyId)
        );
        touchedModels.add("property_demolition");
        touchedModels.add("owned_plots");
        touchedModels.add("wallet");
        touchedModels.add("economy_ledger");
        break;
      }

      if (subAction === "abandon_property") {
        const property = getOwnedPropertyForMutation({
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
          harthmereLiveModeSharedStateKey("property", propertyId)
        );
        touchedModels.add("property_abandonment");
        break;
      }

      if (
        subAction === "list_property_for_sale" ||
        subAction === "transfer_property"
      ) {
        const property = getOwnedPropertyForMutation({
          properties: next.property.owned,
          propertyId,
          actorId: envelope.actorId,
          nowMs,
          warnings,
          touchedModels,
        });
        if (!property) break;
        if (
          !buildingSystemCanActorAccessProperty({
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
          next.building.plotOwners[property.plotId] = newOwnerId;
          next.building.ownedPlots = next.building.ownedPlots.filter(
            (plotId) => plotId !== property.plotId
          );
          for (const structure of Object.values(
            next.building.placedStructures
          )) {
            if (structure.plotId === property.plotId) {
              structure.ownerActorId = newOwnerId;
            }
          }
          for (const decoration of Object.values(next.homeDecoration.placed)) {
            if (decoration.propertyId === property.propertyId) {
              decoration.ownerId = newOwnerId;
              decoration.updatedAtMs = nowMs;
            }
          }
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
        syncBuildingSystemPhysicalAccessRecords({
          state: next,
          property,
          plotId: property.plotId,
          nowMs,
        });
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey("property", propertyId)
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
        const preview = createBuildingSystemPlacementPreview({
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
            ? buildingSystemCanActorAccessProperty({
                property,
                actorId,
                permission: "storage_access",
                guildId: next.guild.guildId,
              })
            : property.accessMode === "public" ||
              buildingSystemCanActorAccessProperty({
                property,
                actorId,
                permission: "storage_access",
                guildId: next.guild.guildId,
              }) ||
              buildingSystemCanActorAccessProperty({
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
        const property = getOwnedPropertyForMutation({
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
          | BuildingSystemBusinessType
          | undefined;
        const businessDefinition = buildingSystemBusinessTypeById(businessType);
        if (!businessDefinition || !businessType) {
          warnings.push("business_rejected:unknown_business_type");
          touchedModels.add("business_rejection");
          break;
        }
        if (
          rejectForCivilLegalBlockers({
            blockers: civilLegalAccessBlockers({ state: next }),
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
          warnings.push("business_idempotent:already_started");
          touchedModels.add("business_started");
          break;
        }
        next.inventory.gold -= businessDefinition.startingCostGold;
        const business = createBuildingSystemBusinessRecord({
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
        const productionLinked = ensureProductionBusinessForPropertyBusiness({
          state: next,
          business,
          property,
          nowMs,
          warnings,
          touchedModels,
          sharedStateKeys,
        });
        const markerPlot = buildingSystemPlotFromState(next, property.plotId);
        const markerBlueprint = buildingSystemBlueprintById(
          property.blueprintId
        );
        const markerOrigin =
          property.origin ??
          (markerPlot && markerBlueprint
            ? buildingSystemDefaultOrigin(markerPlot, markerBlueprint)
            : undefined);
        if (markerOrigin) {
          next.building.inWorldMarkers[`${businessId}:marker`] = {
            markerId: `${businessId}:marker`,
            plotId: property.plotId,
            kind: "business_marker",
            position: [markerOrigin.x, markerOrigin.y + 2, markerOrigin.z],
            label: businessDefinition.displayName,
            createdAtMs: nowMs,
          };
        }
        ensurePlayerOwnedBusinessOwnerNpcMarkers(next, nowMs);
        next.economy.ledger.push({
          id: envelope.requestId,
          kind: `business_started_${businessType}`,
          amount: -businessDefinition.startingCostGold,
          atMs: nowMs,
        });
        if (productionLinked) {
          const jobSeed = reduceHarthmereJobsBoardMutation(
            next.jobsBoard,
            {
              requestId: `${envelope.requestId}:business_job_seed`,
              actorId: envelope.actorId,
              nowMs,
              operation: "economy_auto_seed_jobs",
              boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
            } as any,
            {
              actorGold: next.inventory.gold,
              actorInventoryItems:
                combinedBackpackAndMaterialStorageItems(next),
              actorMaterialStorageItems: next.banking.materialStorage,
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
        const property = getOwnedPropertyForMutation({
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
          const result = runBuildingSystemBusinessRevenueCycle({
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
            const taxResult = reduceHarthmereGuildMutation(
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
                harthmereLiveModeSharedStateKey("guild", guildId)
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
      const fallbackPlot =
        plot ?? buildingSystemPlotFromState(next, requestedPlotId);
      const fallbackBlueprint =
        blueprint ?? buildingSystemBlueprintById(blueprintId);
      if (fallbackPlot && fallbackBlueprint) {
        next.property.owned[propertyId] = createBuildingSystemPropertyRecord({
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
        harthmereLiveModeSharedStateKey("property", propertyId)
      );
      touchedModels.add("property_building");
      break;
    }
    case "request_home_decoration": {
      if (
        rejectHomeDecorationOutsideConsole({
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
        | HarthmereHomeDecorationOperation
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
      const result = reduceHarthmereHomeDecorationMutation(
        next.homeDecoration,
        {
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          operation,
          propertyId: payloadString(envelope, "propertyId"),
          decorationId,
          itemId: payloadStringOrNumber(envelope, "itemId"),
          seedItemId: payloadStringOrNumber(envelope, "seedItemId"),
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
        applyBankRecordDelta(next.inventory.items, itemId, delta);
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
        sharedStateKeys.add(harthmereLiveModeSharedWorldStateKey());
      }
      if (Object.keys(result.itemDeltas).length > 0) {
        touchedModels.add("inventory_items");
      }
      const propertyId =
        payloadString(envelope, "propertyId") ?? existingDecorationPropertyId;
      if (propertyId) {
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey("property", propertyId)
        );
      }
      break;
    }
    case "request_world_placement": {
      // Free-world placement supports open terrain, but remains a short-range,
      // server-positioned world mutation and cannot overlap another actor's
      // claimed plot. The reducer still owns inventory, object ownership,
      // idempotency, world bounds, and object-vs-object collision checks.
      const operation = payloadString(envelope, "operation") as
        | HarthmerePlaceableWorldOperation
        | undefined;
      if (!operation) {
        warnings.push("world_placement_rejected:missing_operation");
        touchedModels.add("world_placement_rejection");
        break;
      }
      const positionPayload = payloadRecord(envelope, "position");
      const requestedPosition = {
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
      };
      const objectId = payloadString(envelope, "objectId");
      const existingObject = objectId
        ? next.placeableWorld.placed[objectId]
        : undefined;
      const interactionPosition =
        operation === "remove_object"
          ? existingObject?.position
          : Number.isFinite(requestedPosition.x) &&
            Number.isFinite(requestedPosition.y) &&
            Number.isFinite(requestedPosition.z)
          ? {
              x: Number(requestedPosition.x),
              y: Number(requestedPosition.y),
              z: Number(requestedPosition.z),
            }
          : undefined;
      const actorPosition = actorWorldPositionFromAuthority(envelope);
      if (!actorPosition) {
        warnings.push("world_placement_rejected:actor_position_unverified");
        touchedModels.add("world_placement_rejection");
        break;
      }
      if (interactionPosition) {
        const dx = actorPosition.x - interactionPosition.x;
        const dy = actorPosition.y - interactionPosition.y;
        const dz = actorPosition.z - interactionPosition.z;
        if (
          dx * dx + dy * dy + dz * dz >
          HARTHMERE_WORLD_PLACEMENT_INTERACTION_RADIUS ** 2
        ) {
          warnings.push("world_placement_rejected:target_out_of_range");
          touchedModels.add("world_placement_rejection");
          break;
        }
      }
      if (operation !== "remove_object" && interactionPosition) {
        const itemId =
          operation === "move_object"
            ? existingObject?.itemId
            : payloadStringOrNumber(envelope, "itemId");
        const footprint =
          existingObject?.footprint ??
          (itemId
            ? getHarthmerePlaceableDecorSpec(itemId)?.footprint
            : undefined);
        const rotationDegrees =
          payloadNumber(envelope, "rotationDegrees") ??
          existingObject?.rotationDegrees ??
          0;
        if (
          footprint &&
          worldPlacementOverlapsForeignPlot({
            state: next,
            actorId: envelope.actorId,
            position: interactionPosition,
            footprint,
            rotationDegrees,
          })
        ) {
          warnings.push("world_placement_rejected:foreign_plot_overlap");
          touchedModels.add("world_placement_rejection");
          break;
        }
      }
      const result = reduceHarthmerePlaceableWorldMutation(
        next.placeableWorld,
        {
          requestId: envelope.requestId,
          actorId: envelope.actorId,
          operation,
          itemId: payloadStringOrNumber(envelope, "itemId"),
          objectId,
          position: requestedPosition,
          rotationDegrees: payloadNumber(envelope, "rotationDegrees"),
          nowMs,
        },
        { actorInventoryItems: next.inventory.items }
      );
      if (!result.ok) {
        for (const error of result.errors) {
          warnings.push(`world_placement_rejected:${error}`);
        }
        touchedModels.add("world_placement_rejection");
        break;
      }
      next.placeableWorld = result.state;
      for (const [itemId, delta] of Object.entries(result.itemDeltas)) {
        applyBankRecordDelta(next.inventory.items, itemId, delta);
      }
      if (Object.keys(result.itemDeltas).length > 0) {
        touchedModels.add("inventory_items");
      }
      touchedModels.add("world_placement");
      sharedStateKeys.add(harthmereLiveModeSharedWorldStateKey());
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
          applyBankRecordDelta(next.inventory.items, itemId, -delta);
        }
        for (const [itemId, delta] of Object.entries(
          job.reservedMaterialStorageDeltas
        )) {
          applyBankRecordDelta(next.banking.materialStorage, itemId, -delta);
        }
        next.inventory.gold = Math.max(
          0,
          next.inventory.gold - job.reservedGoldDelta
        );
        refundCraftingJobToolDurability(next, job, touchedModels);
        delete next.crafting.activeJobs[jobId];
        const cancelledJob: HarthmereLiveModeCraftingJob = {
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
            applyBankRecordDelta(next.inventory.items, itemId, -delta);
          }
          for (const [itemId, delta] of Object.entries(
            job.reservedMaterialStorageDeltas
          )) {
            applyBankRecordDelta(next.banking.materialStorage, itemId, -delta);
          }
          next.inventory.gold = Math.max(
            0,
            next.inventory.gold - job.reservedGoldDelta
          );
          refundCraftingJobToolDurability(next, job, touchedModels);
          delete next.crafting.activeJobs[jobId];
          const cancelledJob: HarthmereLiveModeCraftingJob = {
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
        const recipe = getHarthmereCraftingRecipe(job.recipeId);
        if (
          wouldCraftCompletionExceedCarryWeight(
            snapshot.items,
            recipe,
            job.count,
            job.targetItemId
          )
        ) {
          pushCarryWeightRejection(warnings, touchedModels, "crafting");
          break;
        }
        const craftReq: HarthmereInventoryMutationRequest = {
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
        const craftResult = reduceHarthmereInventoryMutation(craftReq, {
          snapshot,
          playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
          playerSkills: next.classMagic.skills,
          playerClassId: next.classMagic.classId ?? "warrior",
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
        const updated = applyHarthmereInventoryMutationResult(
          snapshot,
          craftResult
        );
        next.inventory.items = updated.items;
        next.inventory.gold = updated.gold;
        next.banking.materialStorage =
          updated.materialStorage ?? next.banking.materialStorage;
        next.classMagic.knownRecipes = updated.knownRecipes;
        if (craftResult.craftingOutcome?.success === false) {
          applyStartedCraftingFailureRefund(next, job, recipe, touchedModels);
        }
        applyCraftingOutcomeDurability(next, craftResult, touchedModels, {
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
        const completedJob: HarthmereLiveModeCraftingJob = {
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
      const recipe = getHarthmereCraftingRecipe(recipeId);
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
      const toolItemIds = selectedLiveCraftingToolItemIds(
        snapshot,
        requestedToolItemIds
      );
      const toolDurabilityRejection = craftingToolDurabilityRejection(
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
      if (wouldCraftExceedCarryWeight(snapshot.items, recipe, craftCount)) {
        pushCarryWeightRejection(warnings, touchedModels, "crafting");
        break;
      }
      const craftReq: HarthmereInventoryMutationRequest = {
        requestId: envelope.requestId,
        actorId: envelope.actorId,
        kind: "craft_item",
        nowMs,
        recipeId,
        count: craftCount,
        stationId: payloadStringOrNumber(envelope, "stationId"),
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
      const craftResult = reduceHarthmereInventoryMutation(craftReq, {
        snapshot,
        playerLevel: next.classMagic.skills["character_level"]?.level ?? 1,
        playerSkills: next.classMagic.skills,
        playerClassId: next.classMagic.classId ?? "warrior",
        reputation: next.law.reputation,
      });
      if (craftResult.ok) {
        const updated = applyHarthmereInventoryMutationResult(
          snapshot,
          craftResult
        );
        next.inventory.items = updated.items;
        next.inventory.gold = updated.gold;
        next.banking.materialStorage =
          updated.materialStorage ?? next.banking.materialStorage;
        next.classMagic.knownRecipes = updated.knownRecipes;
        applyCraftingOutcomeDurability(next, craftResult, touchedModels, {
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
          const jobId = nextCraftingJobId(next);
          next.crafting.activeJobs[jobId] = {
            jobId,
            actorId: envelope.actorId,
            recipeId,
            count: craftCount,
            stationId: normalizeHarthmereCraftingStationId(craftReq.stationId),
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
          const immediateJob: HarthmereLiveModeCraftingJob = {
            jobId: `craft_${envelope.requestId}`,
            actorId: envelope.actorId,
            recipeId,
            count: craftCount,
            stationId: normalizeHarthmereCraftingStationId(craftReq.stationId),
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
        let authority = liveFarmingAuthorityState();
        // Advance cooking-job statuses from the clock (and expire spoiled dishes /
        // prune emptied + orphaned stations) before any op reads them. Persist the
        // cleanup immediately so it survives even if the op below is rejected.
        authority.cooking = tickHarthmereCooking(authority.cooking, nowMs);
        next.farming.cooking = authority.cooking;
        touchedModels.add("farming");
        let authorityResult:
          | ReturnType<typeof plantHarthmereCrop>
          | ReturnType<typeof waterHarthmereCrop>
          | ReturnType<typeof harvestHarthmereCrop>
          | ReturnType<typeof gatherHarthmereSeed>
          | ReturnType<typeof forageHarthmereFoodSpawn>
          | ReturnType<typeof huntHarthmereAnimalForFood>
          | ReturnType<typeof cookHarthmereFood>
          | ReturnType<typeof eatHarthmereFood>
          | ReturnType<typeof feedHarthmereLivestock>
          | ReturnType<typeof collectHarthmereLivestockProduct>
          | undefined;

        if (operation === "gather_node") {
          const nodeId =
            payloadString(envelope, "nodeId") ?? envelope.targetId ?? "";
          const respawnKey = gatheringNodeRespawnKey(nodeId);
          const respawnAtMs = Number(next.combat.lootClaims[respawnKey] ?? 0);
          if (respawnAtMs > nowMs) {
            warnings.push(`gathering_rejected:node_depleted:${respawnAtMs}`);
            touchedModels.add("farming_rejection");
            break;
          }
          const gatheringNode = harthmereGatheringAuthorityNode(nodeId);
          const authorityAttempt = resolveHarthmereGatheringAuthorityAttempt({
            nodeId,
            actorPosition: actorWorldPositionFromAuthority(envelope),
            equippedItemIds: Object.values(next.inventory.equipment),
            equippedBiomesItemIds: envelope.serverActorItemIds,
            professionLevel:
              (gatheringNode &&
                next.classMagic.skills[gatheringNode.profession]?.level) ??
              1,
            nowMs,
            randomSeed: envelope.requestId,
          });
          if (!authorityAttempt.ok) {
            warnings.push(`gathering_rejected:${authorityAttempt.reason}`);
            touchedModels.add("farming_rejection");
            break;
          }
          const professionLevel =
            next.classMagic.skills[authorityAttempt.node.profession]?.level ??
            1;
          if (professionLevel < authorityAttempt.node.requiredSkill) {
            warnings.push(
              `gathering_rejected:profession_level_too_low:${authorityAttempt.node.profession}:${authorityAttempt.node.requiredSkill}`
            );
            touchedModels.add("farming_rejection");
            break;
          }
          for (const [itemId, count] of Object.entries(
            authorityAttempt.itemDeltas
          )) {
            ensureLiveModeItemDefinition(itemId, buildInventorySnapshot());
            if (count <= 0) delete authorityAttempt.itemDeltas[itemId];
          }
          if (nativeBiomesEcsAuthorityEnabled()) {
            nativeEcsMaterializationPlans.push({
              kind: "drop",
              materializationKey: `gathering:${nodeId}:${envelope.requestId}`,
              position: {
                x: authorityAttempt.node.position[0],
                y: authorityAttempt.node.position[1] + 0.5,
                z: authorityAttempt.node.position[2],
              },
              itemStacks: { ...authorityAttempt.itemDeltas },
              ownerActorIds: [envelope.actorId],
              expiresAtMs: authorityAttempt.respawnAtMs,
              mined: true,
              sourceKind: "harthmere_gathering_node",
            });
            warnings.push("gathering_yield_materialized_as_native_ecs_drop");
          } else {
            for (const [itemId, count] of Object.entries(
              authorityAttempt.itemDeltas
            )) {
              recordDelta(next.inventory.items, itemId, count);
              advanceSnapshotGroveQuestsFromAuthoritativeEvent("collect", {
                itemId,
                itemName: getHarthmereItemDefinition(itemId)?.displayName,
              });
            }
          }
          next.combat.lootClaims[respawnKey] = authorityAttempt.respawnAtMs;
          const skillProgress = upsertSkill(
            next.classMagic.skills,
            authorityAttempt.node.profession,
            Math.max(5, authorityAttempt.node.requiredSkill * 8)
          );
          if (skillProgress.warning) warnings.push(skillProgress.warning);
          if (authorityAttempt.illegal) {
            warnings.push(
              `gathering_illegal:${authorityAttempt.node.ownership}`
            );
          }
          if (!nativeBiomesEcsAuthorityEnabled()) {
            touchedModels.add("inventory_items");
          }
          touchedModels.add("gathering_nodes");
          touchedModels.add("loot_claims");
          touchedModels.add("skill_xp");
          sharedStateKeys.add(
            harthmereLiveModeSharedStateKey("gathering_node", nodeId)
          );
          break;
        } else if (operation === "native_plant_harvest") {
          if (nativeBiomesEcsAuthorityEnabled()) {
            warnings.push("farming_rejected:native_ecs_harvest_required");
            touchedModels.add("farming_rejection");
            break;
          }
          const plantId =
            payloadStringOrNumber(envelope, "plantId") ??
            envelope.targetId ??
            "";
          if (!plantId) {
            warnings.push("farming_rejected:missing_plant");
            touchedModels.add("farming_rejection");
            break;
          }
          if (payloadString(envelope, "plantStatus") !== "fully_grown") {
            warnings.push("farming_rejected:plant_not_ready");
            touchedModels.add("farming_rejection");
            break;
          }
          const seed = nativePlantHarvestSeedDefinition(envelope);
          if (!seed) {
            warnings.push("farming_rejected:unknown_seed");
            touchedModels.add("farming_rejection");
            break;
          }
          if (isHarthmereNativeHarvestTreeSeed(seed, envelope)) {
            warnings.push("farming_rejected:tree_harvest_not_supported");
            touchedModels.add("farming_rejection");
            break;
          }
          const claimKey = `native_plant_harvest:${plantId}`;
          if (next.combat.lootClaims[claimKey]) {
            warnings.push("farming_rejected:plant_already_harvested");
            touchedModels.add("farming_rejection");
            break;
          }
          const yieldCount = Math.max(1, Math.trunc(seed.yieldCount || 1));
          ensureLiveModeItemDefinition(
            seed.yieldItemId,
            buildInventorySnapshot()
          );
          if (
            wouldExceedCarryWeight(
              next.inventory.items,
              seed.yieldItemId,
              yieldCount
            )
          ) {
            pushCarryWeightRejection(warnings, touchedModels, "farming");
            break;
          }
          recordDelta(next.inventory.items, seed.yieldItemId, yieldCount);
          advanceSnapshotGroveQuestsFromAuthoritativeEvent("collect", {
            itemId: seed.yieldItemId,
            itemName: getHarthmereItemDefinition(seed.yieldItemId)?.displayName,
          });
          next.combat.lootClaims[claimKey] = nowMs;
          next.farming.harvests[plantId] = nowMs;
          upsertSkill(next.classMagic.skills, "farming", 30);
          touchedModels.add("inventory_items");
          touchedModels.add("farming");
          touchedModels.add("loot_claims");
          touchedModels.add("skill_xp");
          sharedStateKeys.add(
            harthmereLiveModeSharedStateKey("native_plant_harvest", plantId)
          );
          break;
        } else if (operation === "mine_exotic_matter_deposit") {
          const depositId =
            payloadString(envelope, "depositId") ?? envelope.targetId ?? "";
          const deposit = harthmereExoticMatterDepositById(depositId);
          if (!deposit) {
            warnings.push("exotic_matter_rejected:unknown_deposit");
            touchedModels.add("exotic_matter_rejection");
            break;
          }
          const actorPosition = actorWorldPositionFromAuthority(envelope);
          if (!actorPosition) {
            warnings.push(
              "exotic_matter_rejected:deposit_proximity_unverified"
            );
            touchedModels.add("exotic_matter_rejection");
            break;
          }
          // Deposits in shifted-world caves render their ore at `terrainPosition`
          // (X - 512), not `deposit.position`. The player physically stands at the
          // rendered ore, so proximity must accept either coordinate — otherwise every
          // shifted-cave deposit (the bulk of the content) is ~512 blocks from
          // `deposit.position` and can never be mined. Mirrors the dual-position logic in
          // harthmereExoticMatterDepositAtBlock.
          const mineRadiusSq =
            HARTHMERE_EXOTIC_MATTER_MINE_INTERACTION_RADIUS *
            HARTHMERE_EXOTIC_MATTER_MINE_INTERACTION_RADIUS;
          const minePositions = [
            deposit.position,
            deposit.terrainPosition,
          ].filter((value): value is [number, number, number] =>
            Array.isArray(value)
          );
          const withinMineRange = minePositions.some(
            (pos) =>
              distanceSq3(actorPosition, {
                x: pos[0],
                y: pos[1],
                z: pos[2],
              }) <= mineRadiusSq
          );
          if (!withinMineRange) {
            warnings.push("exotic_matter_rejected:deposit_proximity_required");
            touchedModels.add("exotic_matter_rejection");
            break;
          }
          const claimKey = exoticMatterDepositClaimKey(deposit.depositId);
          const mineResult = mineHarthmereExoticMatterDeposit({
            state: liveExoticMatterDepositStateFromClaims(next, nowMs),
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
            if (delta > 0) {
              advanceSnapshotGroveQuestsFromAuthoritativeEvent("collect", {
                itemId,
                itemName: getHarthmereItemDefinition(itemId)?.displayName,
              });
            }
          }
          next.combat.lootClaims[claimKey] = nowMs;
          touchedModels.add("inventory_items");
          touchedModels.add("exotic_matter_deposits");
          touchedModels.add("loot_claims");
          sharedStateKeys.add(
            harthmereLiveModeSharedStateKey(
              "exotic_matter_deposit",
              deposit.depositId
            )
          );
          break;
        } else if (operation === "gather_seed") {
          const seedItemId = payloadString(envelope, "seedItemId") ?? "";
          const seedSource =
            (payloadString(envelope, "source") as any) ?? "world";
          // (foraging fix F-C, 2026-07-14): reject a gather that is still on
          // cooldown for this (source, seed) pair before granting anything.
          const gatherOnCooldownAtMs = gatherSeedOnCooldownAtMs(
            next,
            seedSource,
            seedItemId,
            nowMs
          );
          if (gatherOnCooldownAtMs !== undefined) {
            warnings.push("farming_rejected:gather_on_cooldown");
            touchedModels.add("farming_rejection");
            break;
          }
          authorityResult = gatherHarthmereSeed(authority, {
            seedItemId,
            source: seedSource,
            nowMs,
          });
          if (authorityResult.warnings.length === 0) {
            // (foraging fix F-D, 2026-07-14): weight-gate the gathered seed.
            const seedYield = authorityResult.inventoryDeltas[seedItemId] ?? 1;
            if (
              wouldExceedCarryWeight(
                next.inventory.items,
                seedItemId,
                seedYield
              )
            ) {
              pushCarryWeightRejection(warnings, touchedModels, "farming");
              break;
            }
            // Stamp the cooldown so the next gather of this pair is rate-limited.
            next.combat.lootClaims[
              gatherSeedCooldownKey(seedSource, seedItemId)
            ] = nowMs;
            touchedModels.add("loot_claims");
          }
        } else if (operation === "plant") {
          authorityResult = plantHarthmereCrop(authority, {
            plotId: payloadString(envelope, "plotId") ?? envelope.requestId,
            seedItemId: payloadString(envelope, "seedItemId") ?? "",
            nowMs,
            plotHasSun: payloadBoolean(envelope, "plotHasSun"),
          });
        } else if (operation === "water") {
          authorityResult = waterHarthmereCrop(authority, {
            plotId: payloadString(envelope, "plotId") ?? "",
            nowMs,
          });
        } else if (operation === "harvest") {
          authorityResult = harvestHarthmereCrop(authority, {
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
          // (foraging fix F-A/F-E, 2026-07-14): read depletion through the
          // respawn-aware helper. It returns the claim time only while the 12h
          // respawn window is still open and EXPIRES a stale claim in place, so
          // the `respawnAtMs` the pure authority already authors finally takes
          // effect (the old bare `lootClaims[spawnId]` read made any past claim
          // read as depleted forever).
          const forageItemId =
            payloadString(envelope, "itemId") ?? "wild_berries";
          const forageClaimAtMs = wildSpawnActiveClaimAtMs(
            next,
            spawnId,
            nowMs
          );
          authority = liveFarmingAuthorityState({
            [spawnId]: {
              spawnId,
              kind: "food",
              itemId: forageItemId,
              depletedAtMs: forageClaimAtMs,
            },
          });
          authorityResult = forageHarthmereFoodSpawn(authority, {
            spawnId,
            nowMs,
          });
          if (authorityResult.warnings.length === 0) {
            // (foraging fix F-D, 2026-07-14): gate the grant on carry weight the
            // same way native_plant_harvest / vendor / loot paths do. Reject
            // BEFORE writing the claim so a weight-blocked forage does not also
            // (wrongly) deplete the bush.
            const forageYield =
              authorityResult.inventoryDeltas[forageItemId] ?? 1;
            if (
              wouldExceedCarryWeight(
                next.inventory.items,
                forageItemId,
                forageYield
              )
            ) {
              pushCarryWeightRejection(warnings, touchedModels, "farming");
              break;
            }
            // Persist under the prefixed key (and drop any legacy raw-id claim)
            // and project into shared world state so depletion is WORLD-shared.
            next.combat.lootClaims[wildSpawnClaimKey(spawnId)] = nowMs;
            delete next.combat.lootClaims[spawnId];
            touchedModels.add("loot_claims");
            sharedStateKeys.add(
              harthmereLiveModeSharedStateKey("wild_forage_spawn", spawnId)
            );
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
          // (foraging fix F-A/F-E, 2026-07-14): same respawn-aware depletion read
          // as forage_food — hunted animals now actually respawn after 12h.
          const huntClaimAtMs = wildSpawnActiveClaimAtMs(next, animalId, nowMs);
          authority = liveFarmingAuthorityState({
            [animalId]: {
              spawnId: animalId,
              kind: "animal",
              hp: animal.hp,
              maxHp: animal.maxHp,
              species: animal.species,
              protected: animal.protectedSpecies,
              isLivestock: animal.isLivestock,
              ownerId: animal.ownerId,
              depletedAtMs: huntClaimAtMs,
            },
          });
          authorityResult = huntHarthmereAnimalForFood(authority, {
            animalId,
            nowMs,
          });
          if (authorityResult.warnings.length === 0) {
            // (foraging fix F-D, 2026-07-14): carry-weight gate on the meat yield.
            const huntYield = authorityResult.inventoryDeltas["raw_meat"] ?? 2;
            if (
              wouldExceedCarryWeight(
                next.inventory.items,
                "raw_meat",
                huntYield
              )
            ) {
              pushCarryWeightRejection(warnings, touchedModels, "farming");
              break;
            }
            next.combat.lootClaims[wildSpawnClaimKey(animalId)] = nowMs;
            delete next.combat.lootClaims[animalId];
            touchedModels.add("loot_claims");
            sharedStateKeys.add(
              harthmereLiveModeSharedStateKey("wild_hunt_spawn", animalId)
            );
          }
        } else if (operation === "cook_food") {
          authorityResult = cookHarthmereFood(authority, {
            recipeId: payloadString(envelope, "recipeId"),
            rawItemId: payloadString(envelope, "rawItemId") ?? "",
            stationKind: payloadString(envelope, "stationKind") as any,
            count: payloadNumber(envelope, "count"),
            nowMs,
          });
        } else if (operation === "eat_food") {
          authorityResult = eatHarthmereFood(authority, {
            itemId: payloadString(envelope, "itemId") ?? "",
            nowMs,
          });
        } else if (operation === "feed_livestock") {
          authorityResult = feedHarthmereLivestock(authority, {
            livestockId: payloadString(envelope, "livestockId") ?? "",
            feedItemId: payloadString(envelope, "feedItemId") ?? "",
            nowMs,
          });
        } else if (operation === "collect_livestock_product") {
          authorityResult = collectHarthmereLivestockProduct(authority, {
            livestockId: payloadString(envelope, "livestockId") ?? "",
            nowMs,
          });
          // (foraging fix F-D, 2026-07-14): the collected product falls through
          // to applyLiveFarmingAuthorityResult with no weight gate — enforce the
          // carry cap here so livestock collection can't push the player over a
          // limit that native_plant_harvest / vendor / loot already respect.
          if (
            authorityResult.warnings.length === 0 &&
            Object.entries(authorityResult.inventoryDeltas).some(
              ([itemId, delta]) =>
                delta > 0 &&
                wouldExceedCarryWeight(next.inventory.items, itemId, delta)
            )
          ) {
            pushCarryWeightRejection(warnings, touchedModels, "farming");
            break;
          }
        } else if (operation === "cook_enqueue") {
          authorityResult = enqueueHarthmereCook(authority, {
            stationId: payloadString(envelope, "stationId") ?? "",
            stationKind: payloadString(envelope, "stationKind") as any,
            label: payloadString(envelope, "label") ?? undefined,
            recipeId: payloadString(envelope, "recipeId") ?? "",
            count: payloadNumber(envelope, "count"),
            nowMs,
          });
        } else if (operation === "cook_collect") {
          authorityResult = collectHarthmereCook(authority, {
            stationId: payloadString(envelope, "stationId") ?? "",
            jobId: payloadString(envelope, "jobId") ?? "",
            nowMs,
          });
        } else if (operation === "cook_cancel") {
          authorityResult = cancelHarthmereCook(authority, {
            stationId: payloadString(envelope, "stationId") ?? "",
            jobId: payloadString(envelope, "jobId") ?? "",
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
        applyLiveFarmingAuthorityResult(authorityResult.state);
        for (const [plotId, plot] of Object.entries(
          authorityResult.state.plots
        )) {
          if (plot.harvestedAtMs) {
            next.farming.harvests[plotId] = plot.harvestedAtMs;
          }
        }
        if (Object.keys(authorityResult.inventoryDeltas).length > 0) {
          touchedModels.add("inventory_items");
          for (const [itemId, delta] of Object.entries(
            authorityResult.inventoryDeltas
          )) {
            if (delta <= 0) continue;
            advanceSnapshotGroveQuestsFromAuthoritativeEvent("collect", {
              itemId,
              itemName: getHarthmereItemDefinition(itemId)?.displayName,
            });
          }
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
              ? HARTHMERE_COOKING_RECIPES[
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
        if (operation === "eat_food") {
          const itemId = payloadString(envelope, "itemId");
          if (itemId) {
            const definition = getHarthmereItemDefinition(itemId);
            advanceSnapshotGroveQuestsFromAuthoritativeEvent("item_use", {
              itemId,
              itemName: definition?.displayName,
              category: definition?.category,
              useEffect: "stamina",
            });
          }
        }
        if (authorityResult.cookingXpDelta) {
          // Timer-based cooking awards XP on collection (not enqueue).
          upsertSkill(
            next.classMagic.skills,
            "cooking",
            authorityResult.cookingXpDelta
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
      const authority = liveMedicalAuthorityState();
      let authorityResult:
        | ReturnType<typeof useHarthmereMedicalItem>
        | ReturnType<typeof receiveHarthmereDoctorTreatment>
        | undefined;

      if (operation === "use_medical_item" || operation === "use_item") {
        authorityResult = useHarthmereMedicalItem(authority, {
          itemId: payloadString(envelope, "itemId") ?? "",
          nowMs,
        });
      } else if (
        operation === "doctor_treatment" ||
        operation === "request_doctor_treatment"
      ) {
        authorityResult = receiveHarthmereDoctorTreatment(authority, {
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

      applyLiveMedicalAuthorityResult(authorityResult.state);
      if (operation === "use_medical_item" || operation === "use_item") {
        const itemId = payloadString(envelope, "itemId");
        if (itemId) {
          const definition = getHarthmereItemDefinition(itemId);
          advanceSnapshotGroveQuestsFromAuthoritativeEvent("item_use", {
            itemId,
            itemName: definition?.displayName,
            category: definition?.category,
            useEffect: "heal",
          });
        }
      }
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
        | HarthmereCareLoopKind
        | undefined;
      if (!operation) {
        warnings.push("care_rejected:missing_operation");
        touchedModels.add("care_loop_rejection");
        break;
      }
      const careResult = reduceHarthmereCareLoop(next.careLoops, {
        requestId: envelope.requestId,
        actorId: envelope.actorId,
        operation,
        nowMs,
        targetId: payloadString(envelope, "targetId"),
        itemId: payloadString(envelope, "itemId"),
        count: payloadNumber(envelope, "count"),
        season: payloadString(envelope, "season") as any,
        inventory: next.inventory.items,
        actorLevel: next.classMagic.skills.character_level?.level ?? 1,
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
      if (
        careResult.warnings.length === 0 &&
        operation === "daily_task_completed" &&
        payloadString(envelope, "targetId") === "jobs_board"
      ) {
        next.quests.completed[HARTHMERE_READ_JOBS_BOARD_QUEST_ID] = nowMs;
        delete next.quests.active[HARTHMERE_READ_JOBS_BOARD_QUEST_ID];
        touchedModels.add("quest_state");
      }
      break;
    }
    case "request_death_transition":
      if (next.combat.deathState === "dead") {
        warnings.push("death_transition_ignored:already_dead");
        touchedModels.add("death_rejection");
        break;
      }
      if (Number(next.combat.respawnProtectionUntilMs ?? 0) > nowMs) {
        warnings.push("death_transition_ignored:protected");
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
      touchedModels.add("combat_state");
      touchedModels.add("player_status");
      touchedModels.add("death_state");
      touchedModels.add("death_record");
      break;
    case "request_environment_damage": {
      const damageKind = payloadString(envelope, "damageKind") ?? "unknown";
      if (damageKind !== "fall" && damageKind !== "drowning") {
        warnings.push("environment_damage_rejected:unsupported_kind");
        touchedModels.add("environment_damage_rejection");
        break;
      }
      if (
        (next.combat.deathState ?? "alive") !== "alive" ||
        next.combat.hp <= 0
      ) {
        warnings.push("environment_damage_ignored:not_alive");
        touchedModels.add("environment_damage_rejection");
        break;
      }
      if (Number(next.combat.respawnProtectionUntilMs ?? 0) > nowMs) {
        warnings.push("environment_damage_ignored:protected");
        touchedModels.add("environment_damage_rejection");
        break;
      }
      const scaledDamage =
        damageKind === "fall"
          ? (() => {
              const fallBlocks = Math.max(
                0,
                payloadNumber(envelope, "fallBlocks") ?? 0
              );
              const baseDamage = fallDamageForBlocks(fallBlocks);
              if (baseDamage <= 0) {
                return 0;
              }
              return Math.max(
                1,
                Math.round((baseDamage * Math.max(1, next.combat.maxHp)) / 100)
              );
            })()
          : Math.max(1, Math.round(payloadNumber(envelope, "damage") ?? 1));
      if (scaledDamage <= 0) {
        warnings.push("environment_damage_ignored:below_threshold");
        touchedModels.add("environment_damage_rejection");
        break;
      }
      next.combat.hp = Math.max(0, next.combat.hp - scaledDamage);
      touchedModels.add("combat_state");
      touchedModels.add("player_status");
      touchedModels.add("environment_damage");
      if (next.combat.hp <= 0) {
        next.combat.deathState = "dead";
        next.combat.deathRecords[envelope.requestId] = {
          deathId: envelope.requestId,
          cause: damageKind === "fall" ? "fall_damage" : "drowning",
          zoneId: envelope.zoneId,
          atMs: nowMs,
          respawnAvailableAtMs:
            nowMs +
            Math.max(0, payloadNumber(envelope, "respawnDelayMs") ?? 5_000),
        };
        touchedModels.add("death_state");
        touchedModels.add("death_record");
      }
      break;
    }
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
      next.combat.deadFromStaminaAtMs = undefined;
      restoreCombatResources(next, 0.25, nowMs);
      next.combat.respawnProtectionUntilMs =
        nowMs +
        Math.max(1_000, payloadNumber(envelope, "protectionMs") ?? 10_000);
      touchedModels.add("revive_state");
      touchedModels.add("combat_resources");
      break;
    case "request_respawn":
      if (
        repairLiveModeZeroHpDeathState(next, {
          nowMs,
          deathId: `${envelope.requestId}:zero_hp_respawn_repair`,
          zoneId: envelope.zoneId,
          cause: "zero_hp_respawn_repair",
          createDeathRecord: false,
        })
      ) {
        touchedModels.add("combat_state");
        touchedModels.add("player_status");
        touchedModels.add("death_state");
      }
      if (next.combat.deathState !== "dead") {
        warnings.push("respawn_rejected:not_dead");
        touchedModels.add("respawn_rejection");
        break;
      }
      next.combat.deathState = "alive";
      next.combat.hp = next.combat.maxHp;
      next.combat.deadFromStaminaAtMs = undefined;
      restoreCombatResources(next, 1, nowMs);
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
      if (
        npcSnapshot?.escortJobId &&
        npcSnapshot.escortActorId === next.actorId &&
        npcSnapshot.escortStatus !== "arrived" &&
        npcSnapshot.isAlive
      ) {
        decision = "escort_follow_player";
        targetId = next.actorId;
      }
      if (recentAttackerStillRelevant && recentAttackerId) {
        next.combat.threat[recentAttackerId] = Math.max(
          next.combat.threat[recentAttackerId] ?? 0,
          Math.max(1, Math.trunc(npcSnapshot?.lastDamageTaken ?? 1))
        );
      }
      if (
        decision === "idle_patrol" &&
        npcSnapshot?.isAlive &&
        // Passive wildlife (e.g. cattle) never initiate unprovoked aggression.
        // They still retaliate when attacked via the recent-attacker path above.
        npcSnapshot?.isHostile !== false
      ) {
        const npcPosition = liveModePositionObjectToTuple(npcSnapshot.position);
        const actorWorldPosition = actorWorldPositionFromAuthority(envelope);
        const actorPosition = liveModePositionObjectToTuple(actorWorldPosition);
        const safeZone =
          isLiveEntityRobotProtectedPosition(next, npcPosition) ||
          isLiveEntityRobotProtectedPosition(next, actorPosition) ||
          isHarthmereLiveModeTownSafePosition(
            actorWorldPosition,
            next.building.safeZones,
            next.building.customPlots
          );
        const aggression = evaluateMuckMonsterAggression({
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
          muckExposureForcesAggression:
            isLiveEntityRobotMuckedPosition(next, npcPosition) ||
            isLiveEntityRobotMuckedPosition(next, actorPosition),
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
        npcSnapshot && targetId === next.actorId && !npcSnapshot.escortJobId
          ? liveEntityAiPlayerTargetBlockReason({
              npcId,
              npcSnapshot,
              playerPosition: actorWorldPositionFromAuthority(envelope),
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
        ? applyLiveEntityAiMovement({
            entityId: npcId,
            target: npcSnapshot,
            decision,
            targetId,
            thinkIntervalMs,
          })
        : undefined;
      const attack = applyLiveEntityAiPlayerAttack({
        npcId,
        npcSnapshot,
        targetId: npcSnapshot?.escortJobId ? undefined : targetId,
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
        if (
          npcSnapshot?.escortJobId &&
          npcSnapshot.escortDestination &&
          npcSnapshot.escortStatus !== "arrived"
        ) {
          if (
            horizontalDistanceObject(
              npcSnapshot.position,
              npcSnapshot.escortDestination
            ) <= 3.25
          ) {
            npcSnapshot.position = { ...npcSnapshot.escortDestination };
            npcSnapshot.animationState = "idle";
            npcSnapshot.animationMoving = false;
            syncJobsBoardEscortCompanionFromSnapshot(npcSnapshot, "arrived");
            completeArrivedEscortQuest(npcSnapshot);
          } else {
            syncJobsBoardEscortCompanionFromSnapshot(npcSnapshot);
          }
        }
        touchedModels.add("live_entity_movement");
        touchedModels.add("live_entity_animation");
      }
      if (npcId)
        sharedStateKeys.add(harthmereLiveModeSharedStateKey("npc_ai", npcId));
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
        harthmereLiveModeSharedStateKey("boss_encounter", bossId)
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
          harthmereLiveModeSharedStateKey("party", envelope.partyId)
        );
      if (envelope.raidId)
        sharedStateKeys.add(
          harthmereLiveModeSharedStateKey("raid", envelope.raidId)
        );
      break;
    }
  }

  if (nativeBiomesEcsAuthorityEnabled()) {
    nativeEcsMaterializationPlans.push(
      ...harthmereNativeEcsPlansForAvailableInventoryLoot(next, nowMs)
    );
  }

  return {
    state: next,
    summary: {
      version: HARTHMERE_LIVE_MODE_BACKEND_VERSION,
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
      nativeEcsMaterializationPlans: nativeEcsMaterializationPlans.length
        ? nativeEcsMaterializationPlans
        : undefined,
    },
  };
}
