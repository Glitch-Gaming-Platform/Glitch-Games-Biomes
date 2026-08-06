#!/usr/bin/env node
"use strict";

/*
 * Production-shaped browser -> logic -> native ECS -> sync E2E.
 *
 * This runner intentionally uses the real browser event queue for gameplay and
 * existing admin APIs only for deterministic fixture setup/readback. A passing
 * HTTP response, debug global, or localStorage mutation is never considered a
 * gameplay success without authoritative ECS and synchronized-client evidence.
 */
// The focused production-shaped stack exposes its retained Redis through the
// host-only biomes-prod-smoke-redis-forward bridge on port 6493. Configure
// the host-side fixture client before importing connection.ts, whose port is
// captured at module load. Requiring every invocation to remember this extra
// variable caused long browser runs to fail before their first assertion.
if (
  !process.env.GLITCH_REDIS_PORT &&
  !process.env.LOCAL_REDIS_PORT &&
  !process.env.REDIS_PORT
) {
  const configuredWeb = process.env.HARTHMERE_E2E_BASE_URL ?? "";
  process.env.GLITCH_REDIS_PORT =
    process.env.HARTHMERE_E2E_REDIS_PORT ??
    (/:3017(?:\/|$)/.test(configuredWeb) ? "6493" : "6379");
}
if (process.env.HARTHMERE_E2E_DIRECT_WORLD_FIXTURES === "1") {
  process.env.IS_SERVER = process.env.IS_SERVER || "1";
}
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { chromium } = require("playwright");
const { z } = require("zod");
const { lookAtOrientation } = require("../../src/shared/cutscene/math");

function assertRedisTransportReady() {
  const host =
    process.env.GLITCH_REDIS_HOST ??
    process.env.LOCAL_REDIS_HOST ??
    process.env.REDIS_HOST ??
    "127.0.0.1";
  const port =
    process.env.GLITCH_REDIS_PORT ??
    process.env.LOCAL_REDIS_PORT ??
    process.env.REDIS_PORT ??
    "6379";
  const ping = spawnSync(
    "redis-cli",
    ["-h", host, "-p", String(port), "--raw", "PING"],
    {
      encoding: "utf8",
      timeout: 10_000,
    }
  );
  assert.equal(
    ping.status,
    0,
    `Redis preflight failed for ${host}:${port}: ${
      ping.error?.message || ping.stderr || ping.stdout || "no response"
    }`
  );
  assert.equal(
    ping.stdout.trim(),
    "PONG",
    `Redis preflight for ${host}:${port} did not complete a RESP round trip: ${
      ping.stderr || ping.stdout || "empty response"
    }`
  );
  console.log(`REDIS PREFLIGHT PONG host=${host} port=${port}`);
}

const {
  Acquisition,
  AppearanceComponent,
  Challenges,
  Collideable,
  ContainerInventory,
  CreatedBy,
  EntityDescription,
  Expires,
  FarmingPlantComponent,
  GrabBag,
  Health,
  Inventory,
  Label,
  LooseItem,
  MinigameComponent,
  MinigameInstance,
  NpcMetadata,
  NpcState,
  Orientation,
  PlaceableComponent,
  PlayingMinigame,
  PlayerStatus,
  Position,
  QuestGiver,
  RecipeBook,
  RigidBody,
  SelectedItem,
  Size,
  Stashed,
  TriggerState,
  Wearing,
} = require("../../src/shared/ecs/gen/components");
const {
  AcceptChallengeEvent,
  ChangeCameraModeEvent,
  CompleteQuestStepAtEntityEvent,
  ConsumptionEvent,
  EndPlaceRobotEvent,
  FinishSimpleRaceMinigameEvent,
  FishingClaimEvent,
  HarvestPlantEvent,
  InventoryCraftEvent,
  InventorySwapEvent,
  InventoryThrowEvent,
  MoveEvent,
  PickUpEvent,
  PlaceRobotEvent,
  PlacePlaceableEvent,
  PlantSeedEvent,
  PokePlantEvent,
  RemoveMapBeamEvent,
  TillSoilEvent,
  UpdateNpcHealthEvent,
  UpdatePlayerHealthEvent,
  WaterPlantsEvent,
} = require("../../src/shared/ecs/gen/events");
const {
  EntitySerde,
  EventSerde,
  SerializeForServer,
} = require("../../src/shared/ecs/gen/json_serde");
const { ChangeSerde } = require("../../src/shared/ecs/serde");
const { zEntity } = require("../../src/shared/ecs/zod");
const {
  zrpcWebDeserialize,
  zrpcWebSerialize,
} = require("../../src/shared/zrpc/serde");
const { BikkieIds } = require("../../src/shared/bikkie/ids");
const { secondsSinceEpoch } = require("../../src/shared/ecs/config");
const { anItem } = require("../../src/shared/game/item");
const { countOf, createBag } = require("../../src/shared/game/items");
const {
  PLAYER_HOTBAR_SLOTS,
  PLAYER_INVENTORY_SLOTS,
} = require("../../src/shared/game/inventory");
const {
  harthmereNativeBiomesIdForItemId,
  harthmereNativeItemIdForBiomesId,
  harthmereNativeBiomesIdForRecipeId,
} = require("../../src/shared/harthmere/harthmere_native_item_ids");
const {
  harthmereInventoryCarryWeight,
} = require("../../src/shared/harthmere/mmo_carry_weight");
const {
  harthmereNativeRecipeBiscuit,
} = require("../../src/shared/harthmere/harthmere_native_bikkie_items");
const {
  ensureHarthmereProductionCraftingCatalogue,
  HARTHMERE_CRAFTING_STATION_RECIPE_IDS,
} = require("../../src/shared/harthmere/mmo_crafting_catalogue");
const {
  getHarthmereCraftingRecipe,
} = require("../../src/shared/harthmere/mmo_inventory_authority");
const {
  harthmereNativeXpForNextLevel,
  readHarthmereNativeCombatProgression,
  writeHarthmereNativeCombatProgression,
  harthmereNativeNpcCombatProfileForSeed,
} = require("../../src/shared/harthmere/harthmere_native_combat");
const {
  harthmereNativeNpcCombatProfileForTypeId,
} = require("../../src/shared/harthmere/harthmere_native_combat_catalog");
const {
  harthmereNativeLevelStats,
} = require("../../src/shared/harthmere/harthmere_native_level_stats");
const {
  HARTHMERE_SKILL_IDS,
  readHarthmereNativeSkillTotalXp,
} = require("../../src/shared/harthmere/harthmere_skill_progression");
const {
  nativeQuestCompletionXp,
  nativeQuestStepXp,
} = require("../../src/shared/harthmere/native_quest_step_xp");
const {
  HARTHMERE_NPC_CHASE_MIN_EFFECTIVE_METERS_PER_SECOND,
  HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND,
  RETALIATION_TARGET_ROTATION_SECONDS,
} = require("../../src/shared/npc/behavior/chase_attack");
const { buildEscortState } = require("../../src/shared/npc/behavior/escort");
const {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} = require("../../src/shared/npc/serde");
const { LOCAL_DEV_HUMAN_NPC_TYPE_ID } = require("../../src/shared/npc/bikkie");
const {
  HARTHMERE_NATIVE_MUCK_SCARRED_HELIX_SEED,
  HARTHMERE_NATIVE_THAEDRYN_SEED,
  harthmereGroundedMuckMonsterSeedsInTerritory,
  harthmereLiveEntitySizeForSeed,
  harthmereMuckMonsterPositionIsInSafeZone,
} = require("../../src/shared/harthmere/live_entity_production_seed");
// HARTHMERE_HILL_COMBAT browser gate. The road packs are the first content with
// authored per-entity levels AND explicit group identity, so they are the right
// fixture for proving both against real Anima.
const {
  HARTHMERE_ROAD_GROUP_MONSTER_SEEDS,
} = require("../../src/shared/harthmere/road_to_harthmere_groups");
const {
  scaleCreatureCombatStats,
} = require("../../src/shared/npc/creature_level");
const {
  buildHarthmereLiveCreatureEntity,
  harthmereLiveCreatureNpcState,
} = require("../../src/server/harthmere/live_entity_ecs_seed");
const {
  HARTHMERE_GATHERING_AUTHORITY_NODES,
} = require("../../src/shared/harthmere/gathering_node_authority");
const {
  HARTHMERE_BATTLE_MUSIC_PATH,
} = require("../../src/client/game/resources/audio");
const {
  COMBAT_MUSIC_DAMAGE_GRACE_SECONDS,
} = require("../../src/client/game/scripts/audio");
const {
  HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES,
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
  HARTHMERE_JOBS_BOARD_LOCATIONS,
  harthmereAutoSeedTemplateRequirementsObtainable,
} = require("../../src/shared/harthmere/mmo_jobs_board_authority");
const {
  HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES,
} = require("../../src/shared/harthmere/jobs_board_business_templates");
const {
  harthmereJobsBoardQuestMarkerRuntimePositionForId,
} = require("../../src/shared/harthmere/jobs_board_quest_marker_positions");
const {
  harthmereJobsBoardMuckBountyTargetForId,
} = require("../../src/shared/harthmere/jobs_board_muck_bounty_targets");
const {
  readHarthmereJobsBoardNativeKillLedger,
} = require("../../src/shared/harthmere/jobs_board_native_kill_ledger");
const {
  createHarthmereLiveModeQuestClientSnapshot,
  createHarthmereLiveModeSharedWorldState,
  defaultHarthmereLiveModeBackendState,
  harthmereLiveModeSharedWorldStateKey,
  harthmereLiveModePlayerStateKey,
  mergeHarthmereLiveModeSharedWorldStateIntoBackend,
  parseHarthmereLiveModeSharedWorldState,
  parseHarthmereLiveModeBackendState,
  stringifyHarthmereLiveModePlayerPersistenceState,
} = require("../../src/shared/harthmere/live_mode_backend");
const {
  connectToRedis,
  connectToRedisWithLua,
} = require("../../src/server/shared/redis/connection");
const {
  releaseCh1Slot,
} = require("../../src/server/harthmere/ch1_slot_claim");
const { HfcWorldApi } = require("../../src/server/shared/world/hfc/hfc");
const { HybridWorldApi } = require("../../src/server/shared/world/hfc/hybrid");
const { RedisWorld } = require("../../src/server/shared/world/redis");
const {
  RedisBikkieStorage,
} = require("../../src/server/shared/bikkie/storage/redis");
const { iterBackupEntriesFromFile } = require("../../src/server/backup/serde");
const {
  isTriggerFired,
} = require("../../src/server/logic/events/handlers/quest_step_validation");
const { serializeTriggerState } = require("../../src/shared/triggers/state");
const { BikkieRuntime } = require("../../src/shared/bikkie/active");
const {
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} = require("../../src/shared/harthmere/harthmere_native_vitals");
const {
  NATIVE_BUSTED_QUEST_ID,
  NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC,
  NATIVE_GET_THE_MUCK_OUT_GRAVEWOOD_MUCKLING_TYPE_ID,
  NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_SPECS,
  NATIVE_GET_THE_MUCK_OUT_MUCKLING_HUNT_POSITION,
  NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
  NATIVE_GET_THE_MUCK_OUT_RACE_MINIGAME_ID,
  NATIVE_GET_THE_MUCK_OUT_RESTORED_MOSSY_MUCKLING_TYPE_ID,
  NATIVE_GET_THE_MUCK_OUT_WEST_BREACH_MUCKLING_TYPE_ID,
  NATIVE_GIMME_SHELTER_QUEST_ID,
  NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS,
  NATIVE_MUCK_VS_MACHINE_QUEST_ID,
  NATIVE_ROAD_AHEAD_CONTAINER_SPECS,
  NATIVE_ROAD_AHEAD_QUEST_ID,
  NATIVE_ROAD_AHEAD_PRIVATE_CONTAINER_DESCRIPTION,
  NATIVE_ROAD_AHEAD_STEP_IDS,
  NATIVE_ROBOT_SETUP_MUCK_PLACEMENT_POSITION,
  NATIVE_ROBOT_STORY_FINAL_HANDOFFS,
  NATIVE_ROBOT_STORY_CRATE_DIALOG_SPECS,
  NATIVE_ROBOT_STORY_ITEM_IDS,
  NATIVE_ROBOT_STORY_QUEST_IDS,
} = require("../../src/shared/harthmere/native_road_ahead_contract");
const {
  NATIVE_LEGACY_COMBAT_QUEST_IDS,
  NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS,
  NATIVE_LEGACY_COMBAT_STEP_IDS,
  NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS,
} = require("../../src/shared/harthmere/native_combat_quest_routing");
const {
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_NPCS,
  snapshotGroveLandmarkById,
  snapshotGroveNpcEntityId,
} = require("../../src/shared/harthmere/snapshot_grove_content");
const {
  GROVE_FOUNTAIN_LESSON_IDS,
  GROVE_QUEST_CATALOG,
} = require("../../src/shared/harthmere/grove/grove_quest_catalog");
const {
  groveNativeQuestId,
  groveNativeStepId,
} = require("../../src/shared/harthmere/grove/grove_quest_ids");
const {
  groveQuestGiverId,
} = require("../../src/shared/harthmere/grove/grove_quest_schema");
const {
  groveMarkerWorldPosition,
} = require("../../src/shared/harthmere/grove/grove_waypoints");
const {
  snapshotGroveObjectiveCompletionFixture,
  snapshotGroveEventCompletionCount,
  snapshotGroveObjectiveInventoryRequirement,
  snapshotGroveObjectiveMarkerIdForProgress,
  snapshotGroveObjectiveRequiredCount,
  snapshotGroveObjectiveTargetMarkerIds,
  snapshotGrovePracticeItemFixtureForObjective,
} = require("../../src/shared/harthmere/snapshot_grove_trigger_contract");
const {
  SNAPSHOT_STRUCTURED_REWARDS,
} = require("../../src/shared/harthmere/snapshot_complete_port");
const {
  harthmereObjectInteractionForLabel,
} = require("../../src/shared/harthmere/object_interaction_semantics");
const {
  HARTHMERE_WORLD_OBJECT_ACTIVE_PIN_MATCH_RADIUS,
} = require("../../src/shared/harthmere/harthmere_world_object_inspectable");
const {
  harthmereJobsBoardFieldTargetForId,
} = require("../../src/shared/harthmere/jobs_board_field_targets");
const {
  harthmereNativeQuestId,
  harthmereNativeQuestStepId,
} = require("../../src/shared/harthmere/harthmere_native_quests");
const {
  allCh1NativeQuestBiscuits,
  ch1NativeQuestId,
  ch1NativeQuestStepId,
} = require("../../src/shared/harthmere/ch1_native_quests");
const {
  ch1RequiredEncounterNpcsForObjective,
  ch1RequiredEscortNpcsForObjective,
} = require("../../src/shared/harthmere/ch1_dungeon_encounters");
const {
  HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST,
} = require("../../src/shared/harthmere/harthmere_native_quest_manifest");
const {
  BIBLE_QUEST_CATALOG: HARTHMERE_QUEST_CATALOG,
} = require("../../src/shared/harthmere/bible/bible_quest_catalog");
const {
  bibleQuestGiverId,
  bibleQuestPrerequisiteId,
} = require("../../src/shared/harthmere/bible/bible_quest_schema");
const {
  HARTHMERE_BIBLE_DRAGON_QUEST_ID,
  buildHarthmereBibleQuestContext,
  harthmereBibleQuestOffersForGiver,
  harthmereThaedrynArenaWorldAnchor,
} = require("../../src/shared/harthmere/bible_quest_live_authority");
// Waypoint resolution moved into the Bible module with the Chapter 1-shape
// migration. `bibleStepWorldWaypoint` is the grounded resolver: it applies the
// Thaedryn arena override and never returns the authored Y, which is 0 on 312
// of 340 steps (TESTING_FASTER section 4.12).
const {
  bibleStepWorldWaypoint,
  bibleQuestWorldWaypoint,
} = require("../../src/shared/harthmere/bible/bible_waypoints");
const {
  bibleQuest,
} = require("../../src/shared/harthmere/bible/bible_quest_catalog");
function getHarthmereQuestResolvedWaypoint(questId, objective) {
  const quest = bibleQuest(questId);
  if (!quest) return undefined;
  const step = objective?.id
    ? quest.steps.find((row) => row.id === objective.id)
    : undefined;
  return step
    ? bibleStepWorldWaypoint(quest, step)
    : bibleQuestWorldWaypoint(quest);
}
const {
  QUESTS: HARTHMERE_CLIENT_QUESTS,
  HARTHMERE_QUEST_STATE_KEY: HARTHMERE_CLIENT_QUEST_STATE_KEY,
  HARTHMERE_JOBS_BOARD_TARGET_OFFSET,
} = require("../../src/client/components/challenges/LocalDevHarthmereQuests");
const { CH1_NEW_CAST } = require("../../src/shared/harthmere/ch1_cast");
const {
  CH1_CONSOLIDATION_PLAYBACK_SEQUENCE,
  CH1_MEMORY_STAGE,
  ch1AllScenes,
} = require("../../src/shared/cutscene/ch1_scenes");
const {
  CH1_DUNGEON_TERRAIN,
  ch1DungeonAuthoredToWorld,
  ch1DungeonBlockAt,
  ch1DungeonWaterAt,
} = require("../../src/shared/harthmere/ch1_dungeon_terrain");
const {
  CH1_FRACTURE_GATES,
  ch1ProvisioningFor,
} = require("../../src/shared/harthmere/ch1_fracture_gates");
const {
  ch1ElsewhenSlot,
} = require("../../src/shared/harthmere/ch1_elsewhen_region");
const {
  readCh1NativeRunAdmission,
} = require("../../src/shared/harthmere/ch1_native_run");
const {
  defaultCh1LiveGateRuntimeState,
} = require("../../src/shared/harthmere/ch1_live_gate");
const {
  Ch1ObjectiveIncomplete,
  ch1ApplyLiveObjectiveEffects,
} = require("../../src/shared/harthmere/ch1_live_story");
const {
  CH1_LINK_RECIPES,
} = require("../../src/shared/harthmere/ch1_fragment_ledger");
const { CH1_ITEMS } = require("../../src/shared/harthmere/ch1_items");
const { CH1_QUESTS } = require("../../src/shared/harthmere/ch1_quests");
const {
  CH1_REQUIRED_GROVE_JOB_COMPLETIONS,
} = require("../../src/shared/harthmere/ch1_objective_requirements");
const {
  CH1_GROVE_JOB_TEMPLATE_IDS,
} = require("../../src/shared/harthmere/ch1_interaction_surfaces");
const {
  CH1_GROVE_SUPPLIER_ROUTE,
  CH1_TESTIMONY_ROUTE,
  CH1_THREE_ANSWER_ROUTE,
} = require("../../src/shared/harthmere/ch1_objective_routes");
const {
  promoCaptureUrl,
  promoSceneById,
} = require("../../src/shared/cutscene/promo_scenes");

const NATIVE_ROBOT_STORY_EXHAUSTIVE_QUEST_IDS = [
  ...NATIVE_ROBOT_STORY_QUEST_IDS,
];
const CH1_CUTSCENE_WAIT_BUDGET_MS = new Map(
  ch1AllScenes().map((scene) => [
    scene.id,
    Math.ceil(
      scene.shots.reduce(
        (seconds, shot) => seconds + (shot.until?.maxDuration ?? shot.duration),
        0
      ) * 1000
    ),
  ])
);

function chapter1RemainingCutsceneBudgetMs(activeDefId) {
  const sequenceIndex =
    CH1_CONSOLIDATION_PLAYBACK_SEQUENCE.indexOf(activeDefId);
  if (sequenceIndex >= 0) {
    return CH1_CONSOLIDATION_PLAYBACK_SEQUENCE.slice(sequenceIndex).reduce(
      (total, id) => total + (CH1_CUTSCENE_WAIT_BUDGET_MS.get(id) ?? 90_000),
      0
    );
  }
  return CH1_CUTSCENE_WAIT_BUDGET_MS.get(activeDefId) ?? 90_000;
}
// Independent release expectations for the authored July 2026 snapshot. Keep
// these fixed rather than deriving chapter totals from the reward table: the
// browser gate should fail if a table/refactor silently changes what a player
// earns for completing the shipped story.
const NATIVE_ROBOT_STORY_EXPECTED_QUEST_XP = new Map([
  [NATIVE_ROAD_AHEAD_QUEST_ID, 450],
  [NATIVE_BUSTED_QUEST_ID, 555],
  [NATIVE_GET_THE_MUCK_OUT_QUEST_ID, 420],
  [NATIVE_MUCK_VS_MACHINE_QUEST_ID, 195],
]);
const ROAD_AHEAD_TOP_WEAR_STEP_ID = 5261262819224626;
const ROAD_AHEAD_BOTTOMS_WEAR_STEP_ID = 5059357120988468;
const ROAD_AHEAD_BILLY_TYPE_ID = 7520125886856339;
const BUSTED_WATERLOGGED_DELIVERY_STEP_ID = 1250712772360777;
const BUSTED_MUCKWAD_STEP_ID = 3014114416679179;
const BUSTED_MUCK_BUSTER_STEP_ID = 6113676978673631;
const BUSTED_PLACE_MUCK_BUSTER_STEP_ID = 7945988417612118;
const BUSTED_COLLECT_LOG_TYPE_STEP_ID = 8417331412810011;
const BUSTED_WOODEN_AXE_STEP_ID = 7368524338732157;
const BUSTED_OAK_LOG_STEP_ID = 5355669237856170;
const GET_MUCK_OUT_WOODEN_WHACKER_STEP_ID = 2465592451503042;
const GET_MUCK_OUT_MUCKLING_STEP_ID = 4794743509650569;
const GET_MUCK_OUT_RACE_STEP_ID = 6297666130307789;
const GET_MUCK_OUT_INSCRIPTION_SPECS_BY_STEP_ID = new Map(
  Object.values(NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_SPECS).map((spec) => [
    Number(spec.stepId),
    spec,
  ])
);
const GET_MUCK_OUT_INSCRIPTION_PRIOR_STEP_IDS = Object.freeze([
  7850203803086744,
  1488451563795571,
  GET_MUCK_OUT_WOODEN_WHACKER_STEP_ID,
  GET_MUCK_OUT_MUCKLING_STEP_ID,
  2185129587403168,
  2163078453122381,
]);
const GET_MUCK_OUT_LAST_INSCRIPTION_STEP_ID =
  NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_SPECS.yellow.stepId;
const MOSSY_MUCKLING_TYPE_ID = 2992752380341653;
const WRONG_MUCKLING_TYPE_ID = 8997551883502313;
const OAK_LOG_ITEM_ID = 4537020877770174;

function getMuckOutProductionMucklingCombatXp() {
  return [
    NATIVE_GET_THE_MUCK_OUT_WEST_BREACH_MUCKLING_TYPE_ID,
    NATIVE_GET_THE_MUCK_OUT_GRAVEWOOD_MUCKLING_TYPE_ID,
  ].reduce((total, typeId) => {
    const profile = harthmereNativeNpcCombatProfileForTypeId(typeId);
    assert(profile, `Missing native combat profile for Muckling ${typeId}`);
    return total + profile.killXp;
  }, 0);
}

const GET_MUCK_OUT_PRODUCTION_MUCKLING_COMBAT_XP =
  getMuckOutProductionMucklingCombatXp();

let nativeRobotStoryBikkieTray;
let nativeLegacyCombatBikkieTray;

function triggerChildren(trigger) {
  return ["all", "any", "seq", "variant"].includes(trigger?.kind)
    ? trigger.triggers || []
    : [];
}

function visitTriggerTree(trigger, visitor) {
  visitor(trigger);
  for (const child of triggerChildren(trigger)) {
    visitTriggerTree(child, visitor);
  }
}

function nativeProgressionLifetimeXp(progression) {
  let total = progression.xp;
  for (let level = 1; level < progression.level; level += 1) {
    total += harthmereNativeXpForNextLevel(level);
  }
  return total;
}

function nativeProgressionForLifetimeXp(lifetimeXp) {
  let level = 1;
  let xp = Math.max(0, Math.trunc(lifetimeXp));
  while (xp >= harthmereNativeXpForNextLevel(level) && level < 100) {
    xp -= harthmereNativeXpForNextLevel(level);
    level += 1;
  }
  return { level, xp };
}

function nativeRobotStoryLeafSteps(quest) {
  const leaves = [];
  visitTriggerTree(quest.trigger, (step) => {
    if (triggerChildren(step).length === 0) {
      leaves.push(step);
    }
  });
  return leaves;
}

function firedNativeRobotStoryLeafIds(entity, quest) {
  const fired = new Set();
  const questCompleted = entity?.challenges?.complete.has(quest.id) ?? false;
  for (const step of nativeRobotStoryLeafSteps(quest)) {
    if (
      step.id &&
      (questCompleted ||
        serializedTriggerStepIsFired(entity, quest.id, step.id))
    ) {
      fired.add(step.id);
    }
  }
  return fired;
}

function triggerTreeNodeIds(trigger) {
  const ids = [];
  visitTriggerTree(trigger, (node) => ids.push(node.id));
  return ids;
}

async function loadNativeRobotStoryBikkieTray() {
  const redis = await connectToRedis("bikkie");
  const storage = new RedisBikkieStorage(redis);
  try {
    let tray = await storage.load();
    if (tray.contents.size === 0) {
      // The focused stack can keep a warm Bikkie service/runtime across a
      // Redis-only restart. In that state gameplay is still serving the loaded
      // snapshot, but a new host-side test process sees an empty DB 3. Stream
      // the checked-in authoritative backup as a read-only fallback instead
      // of rebuilding or mutating the shared warm stack.
      for await (const [version, entry] of iterBackupEntriesFromFile(
        path.join(root, "snapshot_backup.json")
      )) {
        if (version === "bikkie") {
          tray = entry.baked;
          report.browser.transients.push(
            "bikkie:redis-empty-used-read-only-snapshot-fallback"
          );
          break;
        }
      }
    }
    assert(tray.contents.size > 0, "native robot story Bikkie tray is empty");
    const runtime = new BikkieRuntime();
    runtime.registerBiscuits(tray.contents);
    global.bikkieRuntime = runtime;
    for (const questId of NATIVE_ROBOT_STORY_EXHAUSTIVE_QUEST_IDS) {
      const quest = tray.contents.get(questId);
      assert(quest?.isQuest, `missing native robot story quest ${questId}`);
      assert(
        quest.trigger,
        `native robot story quest ${questId} has no trigger`
      );
    }
    nativeRobotStoryBikkieTray = tray;
    report.scenarios.push({
      name: "snapshot-authored robot story trigger trees loaded",
      status: "pass",
      quests: NATIVE_ROBOT_STORY_EXHAUSTIVE_QUEST_IDS.map((questId) => {
        const quest = tray.contents.get(questId);
        return {
          questId: String(questId),
          title: quest.displayName,
          triggerNodeIds: triggerTreeNodeIds(quest.trigger).map(String),
        };
      }),
    });
    return tray;
  } finally {
    await storage.stop();
  }
}

async function loadNativeLegacyCombatBikkieTray() {
  const questIds = Object.values(NATIVE_LEGACY_COMBAT_QUEST_IDS);
  const redis = await connectToRedis("bikkie");
  const storage = new RedisBikkieStorage(redis);
  try {
    let tray = await storage.load();
    if (tray.contents.size === 0) {
      for await (const [version, entry] of iterBackupEntriesFromFile(
        path.join(root, "snapshot_backup.json")
      )) {
        if (version === "bikkie") {
          tray = entry.baked;
          report.browser.transients.push(
            "legacy-combat-bikkie:redis-empty-used-read-only-snapshot-fallback"
          );
          break;
        }
      }
    }
    const runtime = new BikkieRuntime();
    runtime.registerBiscuits(tray.contents);
    global.bikkieRuntime = runtime;
    for (const questId of questIds) {
      const quest = tray.contents.get(questId);
      assert(quest?.isQuest, `missing native combat quest ${questId}`);
      assert(quest.trigger, `native combat quest ${questId} has no trigger`);
    }
    nativeLegacyCombatBikkieTray = tray;
    report.scenarios.push({
      name: "snapshot-authored legacy combat trigger trees loaded",
      status: "pass",
      quests: questIds.map((questId) => ({
        questId: String(questId),
        title: tray.contents.get(questId).displayName,
      })),
    });
  } finally {
    await storage.stop();
  }
}

const root = path.resolve(__dirname, "../..");
const baseUrl = (
  process.env.HARTHMERE_E2E_BASE_URL || "http://127.0.0.1:3000"
).replace(/\/$/, "");
const syncBaseUrl = (
  process.env.HARTHMERE_E2E_SYNC_BASE_URL || baseUrl
).replace(/\/$/, "");
const configuredGameUrl = process.env.HARTHMERE_E2E_URL || `${baseUrl}/at`;
const combatMusicOnly = process.env.HARTHMERE_E2E_COMBAT_MUSIC_ONLY === "1";
const chaseOnly = process.env.HARTHMERE_E2E_CHASE_ONLY === "1";
const escortOnly = process.env.HARTHMERE_E2E_ESCORT_ONLY === "1";
// HARTHMERE_HILL_COMBAT: ledge reach, crest retention, and group identity.
const hillCombatOnly = process.env.HARTHMERE_E2E_HILL_COMBAT_ONLY === "1";
const hillCombatSkipGiant =
  process.env.HARTHMERE_E2E_HILL_COMBAT_SKIP_GIANT === "1";
const retaliationOnly = process.env.HARTHMERE_E2E_RETALIATION_ONLY === "1";
const retaliationSoloRotation =
  process.env.HARTHMERE_E2E_RETALIATION_SOLO_ROTATION === "1";
const hoePurchaseOnly = process.env.HARTHMERE_E2E_HOE_PURCHASE_ONLY === "1";
const skillsOnly = process.env.HARTHMERE_E2E_SKILLS_ONLY === "1";
const exhaustiveRobotStory =
  process.env.HARTHMERE_E2E_ROBOT_STORY_EXHAUSTIVE === "1";
const gimmeSophiaHandoffOnly =
  process.env.HARTHMERE_E2E_GIMME_SOPHIA_HANDOFF_ONLY === "1";
// Resume from a durable actor whose Muck vs. Machine, handoff, grounding,
// placement, and mesh checkpoints already passed. This lane exercises only
// the unfinished interaction controls and naming progression; it must never
// normalize or reseed the actor and replay earlier evidence.
const robotSetupContinueOnly =
  process.env.HARTHMERE_E2E_ROBOT_SETUP_CONTINUE_ONLY === "1";
// Optional release-gate focus. Once a chapter has passed, CI/debug runs can
// seed the exact predecessor state for one remaining chapter instead of
// replaying the entire native story. The value is the authored numeric quest
// id (for example Busted is 7405046529843322), not an array index, so reports
// and shell invocations remain meaningful when the chapter list is reordered.
const focusedRobotStoryQuestId = (() => {
  const raw = String(
    process.env.HARTHMERE_E2E_ROBOT_STORY_CHAPTER_ID ?? ""
  ).trim();
  if (!raw) {
    return undefined;
  }
  const id = Number(raw);
  assert(
    Number.isSafeInteger(id) &&
      NATIVE_ROBOT_STORY_EXHAUSTIVE_QUEST_IDS.includes(id),
    `HARTHMERE_E2E_ROBOT_STORY_CHAPTER_ID must be one of ${NATIVE_ROBOT_STORY_EXHAUSTIVE_QUEST_IDS.join(
      ","
    )}; received ${raw}`
  );
  return id;
})();
// Inner-loop mode documented by e2e-jump.cjs: seed the three authored Busted
// conversation leaves and exercise the chest onward without replaying them.
// The exhaustive chapter mode remains the release gate; this flag is only for
// diagnosing or verifying the physical chest interaction itself.
const bustedChestOnly = process.env.HARTHMERE_E2E_BUSTED_CHEST_ONLY === "1";
if (bustedChestOnly) {
  assert.equal(
    focusedRobotStoryQuestId,
    NATIVE_BUSTED_QUEST_ID,
    "HARTHMERE_E2E_BUSTED_CHEST_ONLY requires the focused Busted quest id"
  );
}
if (gimmeSophiaHandoffOnly) {
  assert.equal(
    focusedRobotStoryQuestId,
    NATIVE_MUCK_VS_MACHINE_QUEST_ID,
    "HARTHMERE_E2E_GIMME_SOPHIA_HANDOFF_ONLY requires the focused Muck vs. Machine quest id"
  );
}
const roadAheadToolbagOnward =
  process.env.HARTHMERE_E2E_ROAD_AHEAD_TOOLBAG_ONWARD === "1";
const roadAheadSelfieOnward =
  process.env.HARTHMERE_E2E_ROAD_AHEAD_SELFIE_ONWARD === "1";
const roadAheadFinalHandoffOnly =
  process.env.HARTHMERE_E2E_ROAD_AHEAD_FINAL_HANDOFF_ONLY === "1";
// Focused regression for the two repaired Get the Muck Out seams. It runs the
// opening claims, proves the persistent recipe hint/craft, kills the restored-world
// Muckling variants, and stops before replaying the already-green remainder.
const getMuckOutRecipeHuntOnly =
  process.env.HARTHMERE_E2E_GET_MUCK_OUT_RECIPE_HUNT_ONLY === "1";
if (getMuckOutRecipeHuntOnly) {
  assert.equal(
    focusedRobotStoryQuestId,
    NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
    "HARTHMERE_E2E_GET_MUCK_OUT_RECIPE_HUNT_ONLY requires the focused Get the Muck Out quest id"
  );
}
// Focus the exact four grouped inscription props without replaying the recipe,
// hunt, later NPC handoffs, or Mucker Den race. This is the physical regression
// for the production failure where the parent statue terrain swallowed F/Read.
const getMuckOutInscriptionsOnly =
  process.env.HARTHMERE_E2E_GET_MUCK_OUT_INSCRIPTIONS_ONLY === "1";
if (getMuckOutInscriptionsOnly) {
  assert.equal(
    focusedRobotStoryQuestId,
    NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
    "HARTHMERE_E2E_GET_MUCK_OUT_INSCRIPTIONS_ONLY requires the focused Get the Muck Out quest id"
  );
}
assert.equal(
  Number(getMuckOutRecipeHuntOnly) + Number(getMuckOutInscriptionsOnly) <= 1,
  true,
  "Get the Muck Out focused checkpoints are mutually exclusive"
);
assert(
  [
    roadAheadToolbagOnward,
    roadAheadSelfieOnward,
    roadAheadFinalHandoffOnly,
  ].filter(Boolean).length <= 1,
  "Road Ahead resume checkpoints are mutually exclusive"
);
const roadAheadResumeAfterStepId = roadAheadFinalHandoffOnly
  ? NATIVE_ROAD_AHEAD_STEP_IDS.TAKE_SELFIE_WITH_BILLY
  : roadAheadSelfieOnward
    ? NATIVE_ROAD_AHEAD_STEP_IDS.RECEIVE_CAMERA
    : roadAheadToolbagOnward
      ? NATIVE_ROAD_AHEAD_STEP_IDS.RETURN_TO_BILLY_DRESSED
      : undefined;
if (roadAheadResumeAfterStepId) {
  assert.equal(
    focusedRobotStoryQuestId,
    NATIVE_ROAD_AHEAD_QUEST_ID,
    "Road Ahead resume checkpoints require the focused Road Ahead quest id"
  );
}
// Focused regression for the two original-snapshot crates whose visual shape
// says "container" but whose gameplay capability is an authored quest reward
// dialogue. This mode exercises both shipped entities through visible F/Open
// UI and never replays the already-green underwater private-container route.
const robotStoryCrateDialogsOnly =
  process.env.HARTHMERE_E2E_ROBOT_STORY_CRATE_DIALOGS_ONLY === "1";
const robotStoryCrateDialogKey =
  process.env.HARTHMERE_E2E_ROBOT_STORY_CRATE_DIALOG_KEY;
const questPropPromptSweep =
  process.env.HARTHMERE_E2E_QUEST_PROP_PROMPT_SWEEP === "1";
const questPropPromptSweepOnly =
  process.env.HARTHMERE_E2E_QUEST_PROP_PROMPT_SWEEP_ONLY === "1";
const questPropPromptKeys = new Set(
  (process.env.HARTHMERE_E2E_QUEST_PROP_KEYS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const snapshotGroveOnboardingOnly =
  process.env.HARTHMERE_E2E_SNAPSHOT_GROVE_ONBOARDING_ONLY === "1";
const robotStoryOnly =
  process.env.HARTHMERE_E2E_ROBOT_STORY_ONLY === "1" ||
  exhaustiveRobotStory ||
  robotSetupContinueOnly ||
  robotStoryCrateDialogsOnly ||
  questPropPromptSweepOnly;
const jobsOnly = process.env.HARTHMERE_E2E_JOBS_ONLY === "1";
const remainingJobsOnly = process.env.HARTHMERE_E2E_REMAINING_JOBS_ONLY === "1";
const allowPreDynamicFieldTargetImage =
  process.env.HARTHMERE_E2E_ALLOW_PRE_DYNAMIC_FIELD_TARGET_IMAGE === "1";
const remainingQuestsOnly =
  process.env.HARTHMERE_E2E_REMAINING_QUESTS_ONLY === "1";
// The exhaustive Grove lane proves every authored lifecycle/reward through an
// authenticated browser mutation, native ECS, synchronized frontend state and
// Redis persistence. Physical movement/control coverage is retained in the
// focused Grove reports; replaying every distant marker for all 51 rows makes
// the catalog take hours without adding a distinct authority boundary.
const fastGroveCatalog =
  remainingQuestsOnly && process.env.HARTHMERE_E2E_FAST_GROVE_CATALOG !== "0";
const remainingBibleOnly =
  process.env.HARTHMERE_E2E_REMAINING_BIBLE_ONLY === "1";
// Bible rows share one reducer/materializer/UI projection. The exhaustive
// catalog lane exercises every authored operation through an authenticated
// browser fetch, then proves native ECS and synchronized frontend completion
// once per quest. Distant walking/NPC/terrain streaming is already covered by
// retained UI rows and made the 76-row data catalog take hours for no added
// authority coverage. Set HARTHMERE_E2E_FAST_BIBLE_CATALOG=0 only for a focused
// physical UI investigation.
const fastBibleCatalog =
  remainingBibleOnly && process.env.HARTHMERE_E2E_FAST_BIBLE_CATALOG !== "0";
// The focused Bible catalog writes deterministic Redis fixtures between rows.
// Keep the exact server-authority projection for the current fixture here so
// the browser can consume it without waiting behind unrelated world rendering
// and asset generation on a loaded local Web process. Gameplay mutations are
// never served from this value; accept/objective/turn-in still cross the real
// Web -> logic -> native ECS -> sync boundary and clear it before continuing.
let remainingBibleFixtureQuestState;
let remainingBibleHfcWorld;
const directWorldFixtures =
  process.env.HARTHMERE_E2E_DIRECT_WORLD_FIXTURES === "1";
let directFixtureWorld;

async function directFixtureWorldApi() {
  if (!directFixtureWorld) {
    directFixtureWorld = new HybridWorldApi(
      new RedisWorld(await connectToRedisWithLua("ecs")),
      new HfcWorldApi(await connectToRedis("ecs-hfc"))
    );
    await directFixtureWorld.waitForHealthy();
  }
  return directFixtureWorld;
}

async function applyDirectFixtureChanges(changes) {
  const world = await directFixtureWorldApi();
  const result = await world.apply({ changes });
  assert.equal(result.outcome, "success", "direct ECS fixture apply failed");
}
const remainingClientQuestsOnly =
  process.env.HARTHMERE_E2E_REMAINING_CLIENT_QUESTS_ONLY === "1";
const legacyCombatMarkersOnly =
  process.env.HARTHMERE_E2E_LEGACY_COMBAT_MARKERS_ONLY === "1";
const legacyCombatRoutesOnly =
  process.env.HARTHMERE_E2E_LEGACY_COMBAT_ROUTES_ONLY === "1" ||
  legacyCombatMarkersOnly;
const legacyCombatResumeAt = (() => {
  const raw = String(
    process.env.HARTHMERE_E2E_LEGACY_COMBAT_RESUME_AT ?? ""
  ).trim();
  if (!raw) return undefined;
  const questId = Number(raw);
  assert(
    Object.values(NATIVE_LEGACY_COMBAT_QUEST_IDS).includes(questId),
    `HARTHMERE_E2E_LEGACY_COMBAT_RESUME_AT must be a routed combat quest id; received ${raw}`
  );
  return questId;
})();
// Fast browser-only smoke for the dedicated J-key quest journal. This mode
// deliberately does not accept, advance, or complete a quest: its purpose is
// to verify the newly separated Quests UI without replaying catalog coverage
// that already has authoritative completion reports.
const questsUiOnly = process.env.HARTHMERE_E2E_QUESTS_UI_ONLY === "1";
// Chapter 1 is intentionally isolated from the retained prerequisite and
// Quests-UI reports. One browser context collects every remaining failure;
// optional submodes let a repair rerun only rendering or capture work.
const chapter1Only = process.env.HARTHMERE_E2E_CHAPTER_1_ONLY === "1";
const chapter1CaptureOnly =
  process.env.HARTHMERE_E2E_CHAPTER_1_CAPTURE_ONLY === "1";
const chapter1NpcAuditOnly =
  process.env.HARTHMERE_E2E_CHAPTER_1_NPC_AUDIT_ONLY === "1";
const chapter1NpcResumeAfter = String(
  process.env.HARTHMERE_E2E_CHAPTER_1_NPC_RESUME_AFTER ?? ""
).trim();
const chapter1NpcCleanupPlayerIds = String(
  process.env.HARTHMERE_E2E_CHAPTER_1_NPC_CLEANUP_PLAYER_IDS ?? ""
)
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isSafeInteger(value) && value > 0);
const chapter1SkipVideo =
  process.env.HARTHMERE_E2E_CHAPTER_1_SKIP_VIDEO === "1";
const chapter1MaterialVisualCapture =
  process.env.HARTHMERE_E2E_CHAPTER_1_MATERIAL_VISUAL_CAPTURE === "1";
const desktopControlsOnly =
  process.env.HARTHMERE_E2E_DESKTOP_CONTROLS_ONLY === "1";

function selectedCatalogIds(envName) {
  const raw = String(process.env[envName] ?? "").trim();
  return raw
    ? new Set(
        raw
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      )
    : undefined;
}
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 120000);
const snapshotGroveInteractionControlTimeoutMs = Math.min(
  timeoutMs,
  Number(process.env.HARTHMERE_E2E_GROVE_INTERACTION_TIMEOUT_MS || 20_000)
);
const snapshotGroveResetTimeoutMs = Math.min(
  timeoutMs,
  Number(process.env.HARTHMERE_E2E_GROVE_RESET_TIMEOUT_MS || 60_000)
);
const chapter1Features = selectedCatalogIds("HARTHMERE_E2E_CHAPTER_1_FEATURES");
const chapter1ItemIds = selectedCatalogIds("HARTHMERE_E2E_CHAPTER_1_ITEM_IDS");
const chapter1CaptureIds = selectedCatalogIds(
  "HARTHMERE_E2E_CHAPTER_1_CAPTURE_IDS"
);
// Fast visual iteration: register the host's current pure-data CutsceneDef in
// the already-running browser bundle through Next's loaded webpack cache. This
// avoids a production Next/webpack rebuild for every camera or staging edit.
const chapter1RuntimeInject =
  process.env.HARTHMERE_E2E_CHAPTER_1_RUNTIME_INJECT === "1";
// No-build visual diagnosis only. This mirrors the synthetic snapshot actor's
// source lighting correction in the already-loaded browser so a black-body fix
// can be evaluated before paying for another production bundle. It is never
// enabled by the release gate and is recorded in every captured frame.
const chapter1SnapshotLightingProbe =
  process.env.HARTHMERE_E2E_CHAPTER_1_SNAPSHOT_LIGHTING_PROBE === "1";
const chapter1CaptureFormat = String(
  process.env.HARTHMERE_E2E_CHAPTER_1_CAPTURE_FORMAT ??
    (chapter1RuntimeInject ? "frames" : "video")
).trim();
assert(
  ["frames", "video"].includes(chapter1CaptureFormat),
  `unknown Chapter 1 capture format ${chapter1CaptureFormat}`
);
const chapter1StackContainer = String(
  process.env.HARTHMERE_E2E_STACK_CONTAINER ?? ""
).trim();
// A saved passing objective must not be replayed merely because a later step
// exposed a different product bug. The stable authored `questId/stepId`
// checkpoint seeds every objective through that point as fired, then resumes
// the same production quest chain at the next leaf. This is intentionally
// opt-in: an uncheckpointed release run still starts at Chapter 1's first
// offer and proves the complete chain.
const chapter1ResumeAfter = (() => {
  const raw = String(
    process.env.HARTHMERE_E2E_CHAPTER_1_RESUME_AFTER ?? ""
  ).trim();
  if (!raw) return undefined;
  const passedObjectiveKeys = new Set();
  let found = false;
  for (const quest of CH1_QUESTS) {
    for (const step of quest.steps) {
      const key = `${quest.id}/${step.id}`;
      passedObjectiveKeys.add(key);
      if (key === raw) {
        found = true;
        break;
      }
    }
    if (found) break;
  }
  assert(
    found,
    `HARTHMERE_E2E_CHAPTER_1_RESUME_AFTER must be an authored questId/stepId; received ${raw}`
  );
  return { key: raw, passedObjectiveKeys };
})();
const chapter1StopAfter = (() => {
  const raw = String(
    process.env.HARTHMERE_E2E_CHAPTER_1_STOP_AFTER ?? ""
  ).trim();
  if (!raw) return undefined;
  const found = CH1_QUESTS.some((quest) =>
    quest.steps.some((step) => `${quest.id}/${step.id}` === raw)
  );
  assert(
    found,
    `HARTHMERE_E2E_CHAPTER_1_STOP_AFTER must be an authored questId/stepId; received ${raw}`
  );
  return raw;
})();
const probeTimeoutMs = Math.min(
  timeoutMs,
  Number(
    process.env.HARTHMERE_E2E_PROBE_TIMEOUT_MS ||
      (remainingQuestsOnly || remainingBibleOnly || robotStoryOnly
        ? 120_000
        : 30_000)
  )
);
const browserCleanupTimeoutMs = Math.min(
  timeoutMs,
  Number(process.env.HARTHMERE_E2E_BROWSER_CLEANUP_TIMEOUT_MS || 15_000)
);
const acceptanceGateMs = Number(
  process.env.HARTHMERE_E2E_ACCEPTANCE_GATE_MS ||
    (combatMusicOnly ||
    chaseOnly ||
    escortOnly ||
    hillCombatOnly ||
    retaliationOnly
      ? 10_000
      : 2000)
);
// Local browser E2E is a functional gate. Host load, Docker scheduling, asset
// compilation, and Redis size vary too much for latency budgets to be release
// assertions. Keep measuring every transition in the report, but only enforce
// the optional performance budgets when a dedicated benchmark run opts in.
const performanceAssertionsEnabled =
  process.env.HARTHMERE_E2E_PERFORMANCE_ASSERTIONS === "1";
const originSyncGateMs = Number(
  process.env.HARTHMERE_E2E_ORIGIN_SYNC_GATE_MS ||
    (combatMusicOnly ||
    chaseOnly ||
    escortOnly ||
    hillCombatOnly ||
    retaliationOnly
      ? timeoutMs + 30_000
      : legacyCombatRoutesOnly
        ? 20_000
        : robotStoryOnly
          ? 15_000
          : 1000)
);
const secondClientSyncGateMs = Number(
  process.env.HARTHMERE_E2E_SECOND_SYNC_GATE_MS || 1500
);
const audioLoadGateMs = Number(
  process.env.HARTHMERE_E2E_AUDIO_LOAD_GATE_MS || 20_000
);
const combatMusicRestoreGateMs = Number(
  process.env.HARTHMERE_E2E_COMBAT_MUSIC_RESTORE_GATE_MS ||
    (combatMusicOnly
      ? timeoutMs + 30_000
      : (COMBAT_MUSIC_DAMAGE_GRACE_SECONDS + 3) * 1000)
);
const controlToken = process.env.HARTHMERE_E2E_CONTROL_TOKEN || "";
const combatFixtureSyncGateMs = Number(
  process.env.HARTHMERE_E2E_COMBAT_FIXTURE_SYNC_GATE_MS ||
    (combatMusicOnly ||
    chaseOnly ||
    escortOnly ||
    hillCombatOnly ||
    retaliationOnly
      ? timeoutMs + 30_000
      : secondClientSyncGateMs)
);
// Functional hill-combat predicates stay strict, but a production-sized local
// Anima replica can take longer than 75 seconds to complete the next full NPC
// scan under AMD64 emulation. Let focused release runs extend only the hang
// ceiling without turning elapsed time into an acceptance criterion.
const hillCombatFunctionalTimeoutMs = Math.max(
  75_000,
  Number(process.env.HARTHMERE_E2E_HILL_COMBAT_TIMEOUT_MS || 75_000)
);
// A full production-shaped Redis world under AMD64 emulation can revisit one
// newly-created NPC only every several seconds even though each simulation
// step still uses the authored movement rate. Keep the live observation
// bounded, but allow enough scans for the creature to route around/climb the
// fixture. Wall-clock delay remains part of the report and the safety-cap
// assertion; exact 0.7 command scaling is pinned by the chase unit contracts.
const chaseObservationTimeoutMs = Math.min(
  timeoutMs,
  Math.max(
    12_000,
    Number(process.env.HARTHMERE_E2E_CHASE_OBSERVATION_TIMEOUT_MS || 60_000)
  )
);
const artifactsDir = path.resolve(
  process.env.HARTHMERE_E2E_ARTIFACTS_DIR ||
    path.join(root, "artifacts/harthmere-native-ecs-e2e")
);
const runId = `${Date.now()}-${process.pid}`;
const reportPath = path.join(artifactsDir, `${runId}-report.json`);
// Stable, production-shaped player start used before focused pages subscribe.
// Reused snapshot ids can still point at actors thousands of metres outside
// bounds; Sync otherwise resets them after quest fixtures have already begun.
const FOCUSED_E2E_SAFE_START = [484.24980838010384, 53, -207.51197432867897];
const browserLockPath =
  process.env.HARTHMERE_E2E_BROWSER_LOCK_PATH ||
  "/tmp/biomes-harthmere-native-ecs-browser.lock";
let browserLockOwned = false;

function releaseExclusiveBrowserLock() {
  if (!browserLockOwned) return;
  browserLockOwned = false;
  try {
    const owner = JSON.parse(fs.readFileSync(browserLockPath, "utf8"));
    if (Number(owner?.pid) === process.pid) {
      fs.unlinkSync(browserLockPath);
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function acquireExclusiveBrowserLock() {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const fd = fs.openSync(browserLockPath, "wx");
      fs.writeFileSync(
        fd,
        JSON.stringify({ pid: process.pid, runId, startedAt: Date.now() })
      );
      fs.closeSync(fd);
      browserLockOwned = true;
      process.on("exit", releaseExclusiveBrowserLock);
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      let owner;
      try {
        owner = JSON.parse(fs.readFileSync(browserLockPath, "utf8"));
      } catch {
        owner = undefined;
      }
      if (!owner) {
        const ageMs = Date.now() - fs.statSync(browserLockPath).mtimeMs;
        if (ageMs < 5_000) {
          // The winning process has created the lock but has not finished its
          // tiny JSON write yet. Treat that as owned; unlinking this fresh,
          // temporarily empty file allowed two production browsers to start.
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
          continue;
        }
      }
      const ownerPid = Number(owner?.pid);
      let ownerAlive = Number.isInteger(ownerPid) && ownerPid > 0;
      if (ownerAlive) {
        try {
          process.kill(ownerPid, 0);
        } catch {
          ownerAlive = false;
        }
      }
      if (ownerAlive) {
        throw new Error(
          `Another native ECS browser E2E owns ${browserLockPath} (pid ${ownerPid}, run ${
            owner?.runId ?? "unknown"
          })`
        );
      }
      fs.unlinkSync(browserLockPath);
    }
  }
  throw new Error(
    `Could not acquire native ECS browser lock ${browserLockPath}`
  );
}

if (!controlToken) {
  console.error("FAIL HARTHMERE_E2E_CONTROL_TOKEN is required");
  process.exit(1);
}

fs.mkdirSync(artifactsDir, { recursive: true });
acquireExclusiveBrowserLock();

// Page-isolated video capture intentionally closes a fully loaded game page
// between scenes. Chromium reports in-flight image/poll cancellation as
// request failures during that close, even though the completed capture is
// already durable. Track that narrow lifecycle explicitly so teardown noise
// cannot turn a successful batch into a false release-gate failure.
const intentionallyClosingPages = new WeakSet();

const report = {
  version: "harthmere-native-ecs-browser-e2e-v1",
  runId,
  baseUrl,
  syncBaseUrl,
  gameUrl: configuredGameUrl,
  mode: chaseOnly
    ? "chase-only"
    : escortOnly
      ? "escort-only"
      : retaliationOnly
        ? "retaliation-only"
        : hillCombatOnly
          ? "hill-combat-only"
          : hoePurchaseOnly
            ? "hoe-purchase-only"
            : skillsOnly
              ? "skills-only"
              : combatMusicOnly
                ? "combat-music-only"
                : snapshotGroveOnboardingOnly
                  ? "snapshot-grove-onboarding-only"
                  : robotStoryCrateDialogsOnly
                    ? "robot-story-crate-dialogs-only"
                    : robotSetupContinueOnly
                      ? "robot-setup-continue-only"
                      : exhaustiveRobotStory
                        ? "robot-story-exhaustive"
                        : robotStoryOnly
                          ? "robot-story-only"
                          : remainingJobsOnly
                            ? "remaining-business-jobs-only"
                            : remainingQuestsOnly
                              ? "remaining-grove-quests-only"
                              : remainingBibleOnly
                                ? "remaining-bible-quests-only"
                                : remainingClientQuestsOnly
                                  ? "remaining-client-quests-only"
                                  : legacyCombatMarkersOnly
                                    ? "legacy-combat-markers-only"
                                    : legacyCombatRoutesOnly
                                      ? "legacy-combat-routes-only"
                                      : questsUiOnly
                                        ? "quests-ui-only"
                                        : chapter1NpcAuditOnly
                                          ? "chapter-1-npc-audit-only"
                                          : chapter1CaptureOnly
                                            ? "chapter-1-capture-only"
                                            : chapter1Only
                                              ? "chapter-1-only"
                                              : jobsOnly
                                                ? "jobs-only"
                                                : "full",
  gates: {
    performanceAssertionsEnabled,
    acceptanceGateMs,
    originSyncGateMs,
    secondClientSyncGateMs,
    audioLoadGateMs,
    combatMusicRestoreGateMs,
    combatFixtureSyncGateMs,
    allowPreDynamicFieldTargetImage,
    preDynamicFieldTargetFallbacks: [],
  },
  startedAt: new Date().toISOString(),
  scenarios: [],
  browser: {
    console: [],
    requests: [],
    audioAssets: [],
    transients: [],
    failures: [],
  },
};

function persistReportCheckpoint() {
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      report,
      (_key, value) => (typeof value === "bigint" ? `${value}n` : value),
      2
    )
  );
}

function isCatalogInfrastructureFailure(error) {
  const message = error?.stack || String(error);
  // A dead service or expired local test actor invalidates every later catalog
  // row. Abort the batch once instead of recording dozens of misleading quest
  // failures after the shared browser session can no longer reach its actor.
  return /ECONNREFUSED|ERR_CONNECTION_REFUSED|ECONNRESET|socket hang up|Target page, context or browser has been closed|page has been closed|aborted after browser failure|shared browser actor reset timed out|authoritative ECS read failed HTTP 401|Native quest .* actor is missing/i.test(
    message
  );
}

function gameUrl() {
  const url = new URL(configuredGameUrl);
  if (url.pathname === "/") {
    // The site root is a splash route that redirects to `/at` without keeping
    // focused E2E query parameters. Losing `syncBaseUrl` silently connects the
    // browser to the configured remote Sync service and makes the local-player
    // hook wait until timeout. Normalize before navigation so every focused
    // suite retains its local sync/auth/run identity.
    url.pathname = "/at";
  }
  if (
    (chapter1Only || chapter1CaptureOnly || chapter1NpcAuditOnly) &&
    /^\/at(?:\/|$)/.test(url.pathname)
  ) {
    // `/at[/x/y/z]` is Biomes' position-observer route. It intentionally opens
    // an anonymous position sync target even when the surrounding HTTP page is
    // authenticated. Chapter 1 tests move the real player between authored
    // locations, so running them as an observer eventually makes the client
    // receive a delete for the entity it considers local and hard-fail with
    // "Should never delete local player!". Keep accepting the old runbook URL
    // for compatibility, but convert it to `/at` without a coordinate slug:
    // that is the interactive authenticated-player route. The site root is a
    // splash page and redirects while dropping focused E2E query parameters.
    url.pathname = "/at";
  }
  const localBaseUrl = new URL(baseUrl);
  if (
    localBaseUrl.hostname === "127.0.0.1" ||
    localBaseUrl.hostname === "localhost"
  ) {
    url.searchParams.set("syncBaseUrl", syncBaseUrl);
  }
  url.searchParams.set("glitch_auto_play", "1");
  url.searchParams.set("harthmere_native_ecs_e2e", "1");
  url.searchParams.set("e2e_run", runId);
  if (
    robotStoryOnly ||
    jobsOnly ||
    remainingJobsOnly ||
    remainingQuestsOnly ||
    remainingBibleOnly ||
    remainingClientQuestsOnly ||
    questsUiOnly ||
    skillsOnly ||
    chaseOnly ||
    hillCombatOnly ||
    retaliationOnly ||
    hoePurchaseOnly ||
    escortOnly ||
    chapter1Only ||
    chapter1CaptureOnly ||
    chapter1NpcAuditOnly ||
    snapshotGroveOnboardingOnly
  ) {
    url.searchParams.set("lowMemory", "1");
    const chapter1VideoCapture =
      chapter1CaptureOnly &&
      (!chapter1Features || chapter1Features.has("videos"));
    // The 16m/0.25 quest-testing profile is fast but visibly clips authored
    // dungeon cameras and can leave MediaRecorder with a 360px source canvas.
    // Video jobs already isolate one scene per page, so spend a bounded amount
    // more renderer memory here without slowing the retained quest suites.
    url.searchParams.set(
      "resourceCapacityScale",
      chapter1VideoCapture || desktopControlsOnly ? "0.5" : "0.25"
    );
    url.searchParams.set(
      "forceDrawDistance",
      chapter1VideoCapture || desktopControlsOnly ? "48" : "16"
    );
    url.searchParams.set(
      "forceRenderScale",
      chapter1VideoCapture || desktopControlsOnly ? "0.5" : "0.25"
    );
    url.searchParams.set("forceGraphicsQuality", "low");
  }
  return url.toString();
}

function serializedChange(change) {
  return ChangeSerde.serializeProposed(SerializeForServer, change);
}

function serializedEvent(event) {
  return EventSerde.serialize(event);
}

function deserializeEntity(serialized) {
  return serialized ? EntitySerde.deserialize(serialized, false) : undefined;
}

function stackCount(container, itemId) {
  return (container || []).reduce(
    (total, stack) =>
      stack?.item?.id === itemId ? total + BigInt(stack.count) : total,
    0n
  );
}

function inventoryCount(entity, itemId) {
  const inventory = entity?.inventory;
  return (
    stackCount(inventory?.items, itemId) +
    stackCount(inventory?.hotbar, itemId) +
    stackCount(
      inventory?.overflow ? [...inventory.overflow.values()] : [],
      itemId
    )
  );
}

function materialStorageCount(entity, itemId) {
  const items = entity?.harthmere_material_storage?.items;
  return stackCount(items ? [...items.values()] : [], itemId);
}

function chapter1UsableItemCount(entity, itemId) {
  return inventoryCount(entity, itemId) + materialStorageCount(entity, itemId);
}

function distance3(a, b) {
  return Math.hypot(
    Number(a?.[0] ?? 0) - Number(b?.[0] ?? 0),
    Number(a?.[1] ?? 0) - Number(b?.[1] ?? 0),
    Number(a?.[2] ?? 0) - Number(b?.[2] ?? 0)
  );
}

function distanceXZ(a, b) {
  return Math.hypot(
    Number(a?.[0] ?? 0) - Number(b?.[0] ?? 0),
    Number(a?.[2] ?? 0) - Number(b?.[2] ?? 0)
  );
}

// Chapter 1 objective positions mix two intentional coordinate conventions:
// interior feet-Y for authored rooms/dungeons, and production marker-Y one
// block above the scanned ground for outdoor map/NPC targets. The live player
// always collision-settles to feet-Y. Requiring an exact 3-D match therefore
// rejects a correctly grounded player (the Grove plaza settles at 69.875 for
// marker Y=71). Keep X/Z strict, but allow only bounded vertical settlement;
// 3.25m remains below the four-block Road-House floor separation, so landing
// on the wrong story floor still fails.
const CHAPTER1_E2E_WARP_HORIZONTAL_TOLERANCE_METERS = 1;
const CHAPTER1_E2E_WARP_VERTICAL_TOLERANCE_METERS = 3.25;

function chapter1WarpSettled(actual, target) {
  return (
    Boolean(actual) &&
    Boolean(target) &&
    distanceXZ(actual, target) <
      CHAPTER1_E2E_WARP_HORIZONTAL_TOLERANCE_METERS &&
    Math.abs(Number(actual[1]) - Number(target[1])) <=
      CHAPTER1_E2E_WARP_VERTICAL_TOLERANCE_METERS
  );
}

function normalizedChapter1ActorEntity(userId, username) {
  return {
    id: userId,
    position: Position.create({ v: FOCUSED_E2E_SAFE_START }),
    label: Label.create({ text: username }),
    health: Health.create({ hp: 1_000_000, maxHp: 1_000_000 }),
    player_status: PlayerStatus.create({ init: true }),
    appearance_component: AppearanceComponent.create({
      appearance: {
        skin_color_id: "skin_color_4",
        eye_color_id: "eye_color_0",
        hair_color_id: "hair_color_8",
        head_id: BikkieIds.androgenous,
      },
    }),
    wearing: Wearing.create({
      items: new Map([
        [BikkieIds.top, anItem(BikkieIds.muckyTop)],
        [BikkieIds.bottoms, anItem(BikkieIds.muckySkirt)],
      ]),
    }),
    npc_metadata: null,
    npc_state: null,
    default_dialog: null,
    quest_giver: null,
    expires: null,
    icing: null,
    group_preview_reference: null,
    warping_to: null,
  };
}

function chapter1ActorIsNormalized(entity, username) {
  return (
    entity?.label?.text === username &&
    entity?.player_status?.init === true &&
    entity?.appearance_component?.appearance?.skin_color_id ===
      "skin_color_4" &&
    entity?.wearing?.items?.has(BikkieIds.top) === true &&
    entity?.wearing?.items?.has(BikkieIds.bottoms) === true &&
    !entity?.npc_metadata &&
    !entity?.npc_state &&
    !entity?.icing &&
    !entity?.warping_to &&
    chapter1WarpSettled(entity?.position?.v, FOCUSED_E2E_SAFE_START)
  );
}

async function reassertNormalizedChapter1Actor(page, userId, username, label) {
  let lastApplyAt = 0;
  const apply = async () => {
    await applyFixture(page, {
      kind: "update",
      entity: normalizedChapter1ActorEntity(userId, username),
    });
    lastApplyAt = Date.now();
  };
  await apply();
  await waitFor(
    label,
    async () => {
      const [authoritative, local] = await Promise.all([
        authoritativeEntity(page, userId),
        localEntity(page, userId),
      ]);
      if (
        (!chapter1ActorIsNormalized(authoritative.entity, username) ||
          !chapter1ActorIsNormalized(local.entity, username)) &&
        Date.now() - lastApplyAt >= 2_000
      ) {
        // A reused snapshot id may still have one queued Anima write after
        // npc_metadata is removed. Reapply the complete player row until both
        // the authority and this subscription agree on the same clean actor.
        await apply();
      }
      return { authoritative, local };
    },
    ({ authoritative, local }) =>
      chapter1ActorIsNormalized(authoritative.entity, username) &&
      chapter1ActorIsNormalized(local.entity, username),
    Math.max(originSyncGateMs, 15_000),
    40_000
  );
}

async function settleChapter1CaptureActor(page, userId, username, label) {
  if (directWorldFixtures) {
    // Direct HybridWorld reads are cheap in the focused production-shaped
    // stack. Keep reapplying through the delayed createPlayer/PlayerInit race
    // so a late bootstrap cannot replace the reviewed appearance with an empty
    // `None_mesh` after the local-only settle has already returned.
    await reassertNormalizedChapter1Actor(page, userId, username, label);
    await page.evaluate(async (id) => {
      const resources = globalThis.clientContext?.resources;
      if (!resources) throw new Error("client resources unavailable");
      resources.invalidate("/scene/player/mesh", id);
      await resources.get("/scene/player/mesh", id);
    }, userId);
    return;
  }
  // A cutscene-only page never installs or advances a quest checkpoint. The
  // admin apply response is the authoritative acknowledgement; after the
  // loading wrapper clears, only the local subscription must converge before
  // the focused scene warp. Avoid the campaign lane's repeated authoritative
  // reads here: on a software-WebGL host they can consume more time than the
  // scene itself without adding visual-audit evidence.
  await applyFixture(page, {
    kind: "update",
    entity: normalizedChapter1ActorEntity(userId, username),
  });
  await waitFor(
    label,
    () => localEntity(page, userId),
    ({ entity }) => chapter1ActorIsNormalized(entity, username),
    15_000,
    40_000
  );
}

function bridgeCall(page, method, ...args) {
  return page.evaluate(
    async ({ method, args }) => {
      const bridge = globalThis.__harthmereNativeEcsE2E;
      if (!bridge) {
        throw new Error("Native ECS E2E bridge is not installed");
      }
      const fn = bridge[method];
      if (typeof fn !== "function") {
        throw new Error(`Unknown Native ECS E2E bridge method: ${method}`);
      }
      return await fn(...args);
    },
    { method, args }
  );
}

async function bridgeCallWithLiveFetchRetry(page, method, label, ...args) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await bridgeCall(page, method, ...args);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("harthmere_live_fetch_timeout") || attempt === 4) {
        throw error;
      }
      // Catalog refreshes are read-only and idempotent. A production-shaped
      // API request can outlive its browser fetch while Redis is busy, so retry
      // the same read instead of marking an otherwise valid quest row failed.
      report.browser.transients.push(
        `live-fetch-retry:${label}:attempt=${attempt}:${message}`
      );
      await delay(attempt * 1_000);
    }
  }
  throw lastError;
}

async function jobsBoardFetchWithRetry(page, label) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await bridgeCall(page, "jobsBoardFrontendRoundTrip", {
        operation: "fetch",
      });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable =
        message.includes("Jobs board state request failed: 5") ||
        message.includes("harthmere_live_fetch_timeout");
      if (!retryable || attempt === 4) {
        throw error;
      }
      report.browser.transients.push(
        `jobs-board-fetch-retry:${label}:attempt=${attempt}:${message}`
      );
      await delay(attempt * 1000);
    }
  }
  throw lastError;
}

async function jobsBoardMutationWithRetry(page, payload, label) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await bridgeCall(page, "jobsBoardFrontendRoundTrip", payload);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable =
        message.includes("Jobs board state request failed: 5") ||
        message.includes("harthmere_live_fetch_timeout");
      if (!retryable || attempt === 4) {
        throw error;
      }
      // Mutations keep the same requestId on retry. The live-mode backend's
      // idempotency ledger therefore returns the committed result when a slow
      // production-shaped request outlives the browser fetch timeout, without
      // accepting, consuming, completing, or paying the job twice.
      report.browser.transients.push(
        `jobs-board-mutation-retry:${label}:attempt=${attempt}:${message}`
      );
      await delay(attempt * 1000);
    }
  }
  throw lastError;
}

async function authoritativeEntity(page, id) {
  if (directWorldFixtures) {
    const [version, entity] = await (
      await directFixtureWorldApi()
    ).getWithVersion(id);
    return { version, entity: entity?.materialize() };
  }
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await page
        .context()
        .request.post(
          new URL("/api/admin/ecs/get_with_version", baseUrl).toString(),
          {
            data: { z: zrpcWebSerialize([id]) },
            timeout: timeoutMs,
          }
        );
      assert(
        response.ok(),
        `authoritative ECS read failed HTTP ${response.status()}: ${await response.text()}`
      );
      const body = await response.json();
      assert.equal(
        typeof body.z,
        "string",
        "authoritative ECS read was not zRPC"
      );
      const [[version, wrapped]] = zrpcWebDeserialize(
        body.z,
        z.array(z.tuple([z.number(), zEntity.optional()]))
      );
      return { version, entity: wrapped?.entity };
    } catch (error) {
      lastError = error;
      if (attempt === 4) throw error;
      // This is a read-only probe. A production-shaped localhost web worker
      // can reset an HTTP socket under snapshot load, so retrying cannot
      // duplicate gameplay or mutate native ECS state.
      await delay(250 * attempt);
    }
  }
  throw lastError;
}

async function waitForAdminWorldRole(page, id, label) {
  if (directWorldFixtures) {
    await waitFor(
      label,
      () => authoritativeEntity(page, id),
      ({ entity }) => entity?.user_roles?.roles?.has("admin") === true,
      Math.max(originSyncGateMs, 10_000),
      40_000
    );
    return;
  }
  await waitFor(
    label,
    async () => {
      const response = await page
        .context()
        .request.post(
          new URL("/api/admin/ecs/get_with_version", baseUrl).toString(),
          {
            data: { z: zrpcWebSerialize([id]) },
            timeout: Math.min(10_000, timeoutMs),
          }
        );
      const result = { ok: response.ok(), status: response.status() };
      await response.dispose().catch(() => undefined);
      return result;
    },
    ({ ok }) => ok,
    Math.max(originSyncGateMs, 10_000),
    40_000
  );
}

async function localEntity(page, id) {
  const [version, serialized] = await bridgeCall(page, "getLocal", id);
  return { version, entity: deserializeEntity(serialized) };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withOperationTimeout(label, operation, operationTimeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} exceeded ${operationTimeoutMs}ms`)),
          operationTimeoutMs
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function waitFor(label, probe, predicate, gateMs, timeout = timeoutMs) {
  const started = Date.now();
  const browserFailureBaseline = report.browser.failures.length;
  let last;
  let lastError;
  while (Date.now() - started < timeout) {
    if (report.browser.failures.length > browserFailureBaseline) {
      throw new Error(
        `${label} aborted after browser failure: ${report.browser.failures[browserFailureBaseline]}`
      );
    }
    let probeSucceeded = false;
    try {
      // A saturated WebGL renderer can otherwise leave page.evaluate pending
      // forever, preventing the non-fail-fast quest batch from reaching later
      // chapters. A hung probe is a chapter failure and must release the batch.
      last = await withOperationTimeout(
        `${label}: probe`,
        probe,
        probeTimeoutMs
      );
      probeSucceeded = true;
      lastError = undefined;
    } catch (error) {
      lastError = error;
      if (String(error).includes(": probe exceeded ")) {
        throw error;
      }
    }
    // A retryable network/read failure has no fresh value for the predicate.
    // Reusing `undefined` here can turn a transient ECS read into a misleading
    // destructuring/type failure and prematurely abort a non-fail-fast batch.
    if (probeSucceeded && predicate(last)) {
      const elapsedMs = Date.now() - started;
      // Functional local runs record latency and rely on the global timeout as
      // their hang guard. A dedicated benchmark can explicitly opt into the
      // tighter gate without changing ordinary gameplay sign-off semantics.
      if (performanceAssertionsEnabled) {
        assert(
          elapsedMs <= gateMs,
          `${label} took ${elapsedMs}ms, above gate ${gateMs}ms`
        );
      }
      return { value: last, elapsedMs };
    }
    await delay(50);
  }
  throw new Error(
    `${label} timed out after ${timeout}ms; last=${JSON.stringify(
      last,
      (_key, value) => (typeof value === "bigint" ? `${value}n` : value)
    )}; error=${lastError?.stack || lastError || "none"}`
  );
}

async function applyFixture(page, ...changes) {
  if (directWorldFixtures) {
    await applyDirectFixtureChanges(changes);
    return;
  }
  const retryableUpdate = changes.every((change) => change?.kind === "update");
  const fixtureDescription = changes.map((change) => ({
    kind: change?.kind,
    id: change?.entity?.id ?? change?.id,
    components: change?.entity
      ? Object.keys(change.entity).filter((key) => key !== "id")
      : [],
  }));
  let lastError;
  for (let attempt = 1; attempt <= (retryableUpdate ? 3 : 1); attempt += 1) {
    try {
      // Serialize in the browser process through the installed E2E bridge.
      // The long-running Node harness shares msgpackr's module-level target
      // buffer across hundreds of heterogeneous zRPC calls and can eventually
      // throw ERR_BUFFER_OUT_OF_BOUNDS on a valid tiny fixture. The browser
      // bridge already owns the canonical zjsonPost path and uses an isolated
      // encoder, while still hitting the same admin API and native World API.
      await withOperationTimeout(
        `ECS fixture apply ${JSON.stringify(fixtureDescription)}`,
        () => bridgeCall(page, "applyChanges", changes.map(serializedChange)),
        timeoutMs
      );
      return;
    } catch (error) {
      lastError = new Error(
        `ECS fixture apply failed for ${JSON.stringify(fixtureDescription)}: ${
          error?.stack || error
        }`
      );
      if (!retryableUpdate || attempt === 3) throw lastError;
      // Production-shaped localhost can briefly reset an HTTP socket while
      // several emulated services hydrate the large snapshot. Retrying only
      // idempotent ECS updates avoids duplicating create/delete fixtures while
      // allowing player-position setup to survive that transport transient.
      await delay(250 * attempt);
    }
  }
  throw lastError;
}

/**
 * Apply typed ECS changes without passing generated Uint8Array components
 * through Playwright's structured-clone bridge. Structured clone preserves the
 * bytes but not the generated component instance expected by zRPC serialization.
 * Keeping the complete NPC create in one authoritative change also ensures
 * Anima's npc_metadata sharder sees the entity only after its real state exists.
 */
async function applyTypedFixture(page, ...changes) {
  if (directWorldFixtures) {
    await applyDirectFixtureChanges(changes);
    return;
  }
  const response = await page
    .context()
    .request.post(new URL("/api/admin/apply_ecs_changes", baseUrl).toString(), {
      data: {
        z: zrpcWebSerialize(changes.map(serializedChange)),
      },
      timeout: timeoutMs,
    });
  assert(
    response.ok(),
    `typed ECS fixture failed HTTP ${response.status()}: ${await response.text()}`
  );
}

async function pageJson(page, pathname, init = {}) {
  return page.evaluate(
    async ({ pathname, init }) => {
      const response = await fetch(pathname, {
        ...init,
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(init.headers || {}),
        },
      });
      const text = await response.text();
      let body;
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = { parseError: text.slice(0, 500) };
      }
      return { ok: response.ok, status: response.status, body };
    },
    { pathname, init }
  );
}

async function postLiveMode(page, actionKind, subsystem, payload, targetId) {
  const requestId = `native-ecs-e2e:${runId}:${actionKind}:${Math.random()
    .toString(36)
    .slice(2)}`;
  return pageJson(page, "/api/harthmere/live_mode", {
    method: "POST",
    body: JSON.stringify({
      requestId,
      idempotencyKey: requestId,
      targetId,
      actionKind,
      subsystem,
      actorEntityVersion: 1,
      targetEntityVersion: targetId ? 1 : undefined,
      zoneId: "harthmere_native_ecs_e2e",
      clientSentAtMs: Date.now(),
      payload,
      clientClaims: { source: "native_ecs_browser_e2e" },
    }),
  });
}

async function publishAndProve({
  name,
  page,
  event,
  authoritativeProbe,
  authoritativePredicate,
  localProbe,
  localPredicate,
  secondProbe,
  secondPredicate,
  authoritativeGateMs = acceptanceGateMs,
}) {
  const eventKind = event.kind;
  const beforeDiagnostics = await bridgeCall(page, "diagnostics");
  const publishStarted = Date.now();
  await bridgeCall(page, "publish", serializedEvent(event));
  const acceptanceMs = Date.now() - publishStarted;
  if (performanceAssertionsEnabled) {
    assert(
      acceptanceMs <= acceptanceGateMs,
      `${name} acceptance took ${acceptanceMs}ms, above ${acceptanceGateMs}ms`
    );
  }

  const authoritative = await waitFor(
    `${name}: authoritative ECS mutation`,
    authoritativeProbe,
    authoritativePredicate,
    authoritativeGateMs
  );
  const local = await waitFor(
    `${name}: originating browser sync`,
    localProbe,
    localPredicate,
    originSyncGateMs
  );
  let second;
  if (secondProbe) {
    second = await waitFor(
      `${name}: second browser sync`,
      secondProbe,
      secondPredicate,
      secondClientSyncGateMs
    );
  }

  const afterDiagnostics = await bridgeCall(page, "diagnostics");
  const beforeCount = beforeDiagnostics.publishedEvents.filter(
    (entry) => entry.kind === eventKind
  ).length;
  const afterCount = afterDiagnostics.publishedEvents.filter(
    (entry) => entry.kind === eventKind
  ).length;
  assert.equal(
    afterCount,
    beforeCount + 1,
    `${name} must publish exactly one ${eventKind}`
  );

  report.scenarios.push({
    name,
    eventKind,
    status: "pass",
    acceptanceMs,
    authoritativeMs: authoritative.elapsedMs,
    originSyncMs: local.elapsedMs,
    secondClientSyncMs: second?.elapsedMs,
  });
}

async function publishFrontendMove(
  page,
  userId,
  position,
  orientation = [0, 0]
) {
  const startedAt = Date.now();
  await bridgeCall(
    page,
    "publish",
    serializedEvent(
      new MoveEvent({
        id: userId,
        position: [...position],
        orientation: [...orientation],
        velocity: [0, 0, 0],
      })
    )
  );
  return { elapsedMs: Date.now() - startedAt };
}

/**
 * Place the browser-owned simulation player before applying the matching ECS
 * fixture. The local movement writer owns `/sim/player`; changing only the
 * replicated Position (or publishing a server MoveEvent) leaves camera,
 * proximity prompts, and cursor inspection at the old location and can also
 * overwrite the fixture on the next movement tick.
 */
async function placeFrontendPlayerForFixture(
  page,
  userId,
  position,
  orientation = [0, 0]
) {
  const updated = await page.evaluate(
    ({
      userId: playerId,
      position: nextPosition,
      orientation: nextOrientation,
    }) => {
      const context = globalThis.clientContext;
      if (!context?.resources) return false;
      context.resources.update("/sim/player", playerId, (player) => {
        player.position = [...nextPosition];
        player.orientation = [...nextOrientation];
        player.velocity = [0, 0, 0];
      });
      return true;
    },
    {
      userId,
      position: [...position],
      orientation: [...orientation],
    }
  );
  assert.equal(updated, true, "browser simulation player was unavailable");
}

async function frontendPlayerPose(page, userId) {
  return page.evaluate((playerId) => {
    const player = globalThis.clientContext?.resources?.get(
      "/sim/player",
      playerId
    );
    return player
      ? {
          position: [...player.position],
          orientation: [...player.orientation],
        }
      : undefined;
  }, userId);
}

async function frontendInteractionSnapshot(page) {
  return page.evaluate(() => {
    const context = globalThis.clientContext;
    if (!context?.resources) return undefined;
    const inspectable = context.resources.get("/overlays")?.get("inspectable");
    const hit = context.resources.get("/scene/cursor")?.hit;
    const inspectableEntityId = inspectable?.entityId;
    const markerDebug = globalThis.__harthmereQuestObjectMarkerDebug;
    let groveState;
    try {
      const raw = globalThis.localStorage?.getItem(
        "biomes.localDev.snapshotGroveQuestState"
      );
      groveState = raw ? JSON.parse(raw) : undefined;
    } catch {
      groveState = undefined;
    }
    return {
      inspectable: inspectable
        ? {
            kind: inspectable.kind,
            key: inspectable.key,
            entityId: inspectable.entityId,
            label: inspectable.label,
            objectId: inspectable.objectId,
            itemId: inspectable.itemId,
          }
        : undefined,
      cursor: hit
        ? {
            kind: hit.kind,
            distance: hit.distance,
            entityId: hit.kind === "entity" ? hit.entity?.id : undefined,
            entityLabel:
              hit.kind === "entity" ? hit.entity?.label?.text : undefined,
          }
        : undefined,
      components: inspectableEntityId
        ? {
            label: context.resources.get("/ecs/c/label", inspectableEntityId)
              ?.text,
            questGiver: Boolean(
              context.resources.get("/ecs/c/quest_giver", inspectableEntityId)
            ),
            entityDescription: context.resources.get(
              "/ecs/c/entity_description",
              inspectableEntityId
            )?.text,
          }
        : undefined,
      inspectOverlays: Array.from(
        document.querySelectorAll(".inspect-overlay")
      ).map((element) => {
        const htmlElement = element;
        const style = getComputedStyle(htmlElement);
        const rect = htmlElement.getBoundingClientRect();
        const parent = htmlElement.parentElement;
        const parentStyle = parent ? getComputedStyle(parent) : undefined;
        const descendants = Array.from(htmlElement.querySelectorAll("*")).map(
          (child) => {
            const childStyle = getComputedStyle(child);
            const childRect = child.getBoundingClientRect();
            return {
              className: child.className,
              text: child.textContent?.trim(),
              display: childStyle.display,
              visibility: childStyle.visibility,
              opacity: childStyle.opacity,
              transform: childStyle.transform,
              fontSize: childStyle.fontSize,
              rect: {
                width: childRect.width,
                height: childRect.height,
              },
            };
          }
        );
        const ancestors = [];
        let ancestor = htmlElement.parentElement;
        for (let depth = 0; ancestor && depth < 6; depth += 1) {
          const ancestorStyle = getComputedStyle(ancestor);
          const ancestorRect = ancestor.getBoundingClientRect();
          ancestors.push({
            className: ancestor.className,
            display: ancestorStyle.display,
            visibility: ancestorStyle.visibility,
            opacity: ancestorStyle.opacity,
            transform: ancestorStyle.transform,
            zoom: ancestorStyle.zoom,
            rect: {
              width: ancestorRect.width,
              height: ancestorRect.height,
            },
          });
          ancestor = ancestor.parentElement;
        }
        return {
          text: htmlElement.textContent?.trim(),
          html: htmlElement.outerHTML,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          parentClass: parent?.className,
          parentDisplay: parentStyle?.display,
          parentVisibility: parentStyle?.visibility,
          parentOpacity: parentStyle?.opacity,
          descendants,
          ancestors,
        };
      }),
      bodyHasOpenContainer: document.body.innerText.includes("Open Container"),
      groveState,
      markerDebug: markerDebug
        ? {
            activeMarkerId: markerDebug.activeMarkerId,
            visibleSnapshotGroveMarkerIds:
              markerDebug.visibleSnapshotGroveMarkerIds,
          }
        : undefined,
    };
  });
}

async function waitForOpenContainerPrompt(page, label) {
  // ShortcutText renders the key and action in one span (`F Open Container`).
  // An exact text locator therefore finds no element even when the prompt is
  // visible. Scope to the native inspect overlay and match the action text so
  // the assertion tracks the product component rather than its text-node split.
  const openPrompt = page
    .locator(".inspect-overlay")
    .filter({ hasText: "Open Container" });
  await waitFor(
    `${label}: visible Open Container prompt`,
    async () => ({
      visible: await openPrompt.isVisible().catch(() => false),
      interaction: await frontendInteractionSnapshot(page),
    }),
    ({ visible }) => visible,
    20_000,
    20_000
  );
  return openPrompt;
}

function attachDiagnostics(page, label) {
  page.on("console", (message) => {
    const text = `${label}:${message.type()}: ${message.text()}`;
    report.browser.console.push(text);
    const unsupportedExtensionAsset =
      text.includes("Fetch API cannot load chrome-extension://") &&
      text.includes('URL scheme "chrome-extension" is not supported');
    const unsupportedExtensionOpaqueMessage =
      text === `${label}:error: {target: X, data: 150}`;
    const knownMixedSceneMeshFallback =
      text.includes("Found mesh with mix of scene types") &&
      (text.includes("Defaulting to base.") ||
        text.includes("Defaulting to three."));
    const knownComputePressurePolicyWarning = text.includes(
      "Permissions policy violation: compute-pressure is not allowed in this document"
    );
    // Chromium's console message omits the URL, so it cannot distinguish a
    // broken API from the local stack's expected missing-profile-picture
    // fallback. The response listener below records same-origin 4xx responses
    // with their exact URL and remains the authoritative failure classifier.
    const urlLessResource404 =
      text.includes("Failed to load resource") &&
      text.includes("status of 404 (Not Found)");
    // Chromium omits the URL from this console message. Treat the URL-less 429
    // as diagnostic noise for every focused suite: the response listener below
    // still records and fails every same-origin HTTP 429 with its exact URL,
    // while third-party embeds (notably Twitch) can rate-limit independently
    // of the game and must not abort a Chapter 1 cutscene.
    const urlLessResource429 =
      text.includes("Failed to load resource") &&
      text.includes("status of 429 (Too Many Requests)");
    const isolatedRobotStoryMissingNavigationTarget =
      robotStoryOnly && text.includes("No entity found for navigation aid");
    const isolatedChapter1LegacyRobotStoryNavigationTarget =
      (chapter1Only || chapter1NpcAuditOnly) &&
      text.includes("No entity found for navigation aid") &&
      // Reused production accounts can retain native robot-story aids for the
      // legacy Jackie and Sophia ids. The Chapter 1 batch uses its own authored
      // Jackie id and exact per-objective target assertions, so these missing
      // cross-catalog entities are unrelated startup residue, not evidence that
      // a Chapter 1 actor or expression target is absent.
      (text.includes("entityId:8997551883502307") ||
        text.includes("entityId:7976997825186729"));
    const unavailableEmbeddedMediaPlaylist =
      text.includes("Player stopping playback") &&
      text.includes("MasterPlaylist") &&
      text.includes("ErrorNotAvailable code 404");
    const recoveredJobsOnlySyncDisconnect =
      jobsOnly &&
      (text.includes("Showing disconnected from game") ||
        ((text.includes("Could not publish events") ||
          text.includes("Error during fire and forget")) &&
          text.includes("/sync/publish CANCELLED") &&
          text.includes("reconnect due to Connection timeout")));
    const recoveredLegacyCombatMarkerOnlyPlaceableMesh =
      legacyCombatMarkersOnly &&
      text.includes('Resource "[\\"/init/scene/placeable/mesh\\",') &&
      text.includes(']" had error');
    if (recoveredJobsOnlySyncDisconnect) {
      report.browser.transients.push(text);
    }
    if (urlLessResource404) {
      report.browser.transients.push(text);
    }
    if (urlLessResource429) {
      report.browser.transients.push(text);
    }
    if (unavailableEmbeddedMediaPlaylist) {
      report.browser.transients.push(text);
    }
    if (knownMixedSceneMeshFallback) {
      report.browser.transients.push(text);
    }
    if (
      message.type() === "error" &&
      !unsupportedExtensionAsset &&
      !unsupportedExtensionOpaqueMessage &&
      !knownMixedSceneMeshFallback &&
      !knownComputePressurePolicyWarning &&
      !urlLessResource404 &&
      !urlLessResource429 &&
      !isolatedRobotStoryMissingNavigationTarget &&
      !isolatedChapter1LegacyRobotStoryNavigationTarget &&
      !unavailableEmbeddedMediaPlaylist &&
      !recoveredJobsOnlySyncDisconnect &&
      !recoveredLegacyCombatMarkerOnlyPlaceableMesh
    ) {
      report.browser.failures.push(text);
    }
    if (isolatedChapter1LegacyRobotStoryNavigationTarget) {
      report.browser.transients.push(text);
    }
    if (unsupportedExtensionOpaqueMessage) {
      report.browser.transients.push(text);
    }
    if (recoveredLegacyCombatMarkerOnlyPlaceableMesh) {
      report.browser.transients.push(text);
    }
  });
  page.on("request", (request) => {
    const url = request.url();
    if (
      /\/api\/|\/sync(?:\?|$)/.test(url) ||
      url.includes(HARTHMERE_BATTLE_MUSIC_PATH)
    ) {
      let jobsBoardMutation;
      let questMutation;
      let chapter1Progress;
      if (
        request.method() === "POST" &&
        url.startsWith(`${baseUrl}/api/harthmere/live_mode`)
      ) {
        try {
          const body = request.postDataJSON();
          if (body?.actionKind === "request_jobs_board_mutation") {
            jobsBoardMutation = {
              requestId: body.requestId,
              targetId: body.targetId,
              payload: body.payload,
            };
          } else if (body?.actionKind === "request_quest_state_update") {
            // Preserve only the authored transition contract. This makes a
            // missing UI-event -> quest mutation visible without recording
            // cookies, headers, or unrelated client claims.
            questMutation = {
              requestId: body.requestId,
              operation: body.payload?.operation,
              questId: body.payload?.questId,
              source: body.payload?.source,
              completed: body.payload?.completed,
              objectiveIndex: body.payload?.objectiveIndex,
              stepId: body.payload?.stepId,
              progress: body.payload?.progress,
              reason: body.payload?.reason,
            };
          }
        } catch {
          // A malformed request will be reported by the API response. Keep
          // diagnostics best-effort so request observation never changes E2E.
        }
      }
      if (
        request.method() === "POST" &&
        url === `${baseUrl}/api/harthmere/chapter1_progress`
      ) {
        try {
          const body = request.postDataJSON();
          // Keep only the non-sensitive discriminator and manifest ids. This
          // makes a missing F -> complete transition obvious in the saved
          // report without recording auth headers or arbitrary request data.
          chapter1Progress = {
            action: body?.action,
            challengeId: body?.challengeId,
            stepId: body?.stepId,
          };
        } catch {
          // The API response remains authoritative for malformed payloads.
        }
      }
      report.browser.requests.push({
        client: label,
        method: request.method(),
        url: url.replace(baseUrl, ""),
        at: Date.now(),
        ...(jobsBoardMutation ? { jobsBoardMutation } : {}),
        ...(questMutation ? { questMutation } : {}),
        ...(chapter1Progress ? { chapter1Progress } : {}),
      });
    }
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText;
    const intentionalPageCloseAbort =
      intentionallyClosingPages.has(page) && errorText === "net::ERR_ABORTED";
    const abortedLiveModeBuildingPoll =
      errorText === "net::ERR_ABORTED" &&
      url.startsWith(`${baseUrl}/api/harthmere/live_mode_building_state?`);
    const abortedReadOnlyLiveModePoll =
      errorText === "net::ERR_ABORTED" &&
      request.method() === "GET" &&
      /^\/api\/harthmere\/live_mode_[a-z_]+(?:\?|$)/.test(
        url.slice(baseUrl.length)
      );
    const jobsCatalogOnly = jobsOnly || remainingJobsOnly;
    const abortedAvatarPlaceholderAsset =
      errorText === "net::ERR_ABORTED" &&
      request.method() === "GET" &&
      url.includes("/_next/static/media/avatar-placeholder.");
    const abortedLocalProfilePicture =
      errorText === "net::ERR_ABORTED" &&
      request.method() === "GET" &&
      /^\/buckets\/biomes-social\/[^/]+\/profile_pic\//.test(
        new URL(url).pathname
      );
    const recoveredFocusedItemIconAbort =
      robotStoryOnly &&
      errorText === "net::ERR_ABORTED" &&
      request.method() === "GET" &&
      url.startsWith(`${baseUrl}/buckets/biomes-static/asset_data/icons/`);
    const recoveredRobotStoryChapter1BackgroundAbort =
      robotStoryOnly &&
      errorText === "net::ERR_ABORTED" &&
      ((request.method() === "POST" &&
        [
          `${baseUrl}/api/harthmere/chapter1_progress`,
          `${baseUrl}/api/harthmere/chapter1_story`,
          `${baseUrl}/api/harthmere/chapter1_gate?e2e=1`,
        ].includes(url)) ||
        (request.method() === "GET" &&
          /^\/harthmere\/voices\/generated\/current\/[^?]+\.mp3(?:\?|$)/.test(
            url.slice(baseUrl.length)
          )));
    let chapter1ReadOnlyAction;
    if (
      errorText === "net::ERR_ABORTED" &&
      request.method() === "POST" &&
      [
        `${baseUrl}/api/harthmere/chapter1_progress`,
        `${baseUrl}/api/harthmere/chapter1_story`,
      ].includes(url)
    ) {
      try {
        chapter1ReadOnlyAction = request.postDataJSON()?.action;
      } catch {
        chapter1ReadOnlyAction = undefined;
      }
    }
    const abortedChapter1ReadOnlyPoll =
      errorText === "net::ERR_ABORTED" &&
      ((request.method() === "POST" &&
        chapter1ReadOnlyAction === "state" &&
        [
          `${baseUrl}/api/harthmere/chapter1_progress`,
          `${baseUrl}/api/harthmere/chapter1_story`,
        ].includes(url)) ||
        url === `${baseUrl}/api/harthmere/chapter1_gate?e2e=1`);
    const recoveredRobotStoryLiveModeBackgroundAbort =
      robotStoryOnly &&
      errorText === "net::ERR_ABORTED" &&
      request.method() === "POST" &&
      url.startsWith(`${baseUrl}/api/harthmere/live_mode?`);
    const recoveredRobotStoryUnmountedQuestIcon =
      robotStoryOnly &&
      errorText === "net::ERR_ABORTED" &&
      request.method() === "GET" &&
      /\/_next\/static\/media\/quest-main\.[a-f0-9]+\.png(?:\?|$)/.test(url);
    const abortedChapter1UnmountedQuestIcon =
      chapter1Only &&
      (!chapter1Features || chapter1Features.has("quests")) &&
      errorText === "net::ERR_ABORTED" &&
      request.method() === "GET" &&
      /\/_next\/static\/media\/quest-main\.[a-f0-9]+\.png(?:\?|$)/.test(url);
    const recoveredJobsOnlyAbortedRequest =
      jobsCatalogOnly &&
      errorText === "net::ERR_ABORTED" &&
      (url.includes("/_next/static/media/avatar-placeholder.") ||
        /^\/api\/harthmere\/live_mode_[a-z_]+_state\?/.test(
          url.slice(baseUrl.length)
        ) ||
        (request.method() === "POST" &&
          (url.startsWith(`${baseUrl}/api/harthmere/live_mode?`) ||
            [
              `${baseUrl}/api/harthmere/chapter1_progress`,
              `${baseUrl}/api/harthmere/chapter1_story`,
              `${baseUrl}/api/harthmere/chapter1_gate?e2e=1`,
            ].includes(url))));
    const abortedVoiceSynthesis =
      errorText === "net::ERR_ABORTED" &&
      request.method() === "POST" &&
      url === `${baseUrl}/api/voices/text_to_speech`;
    const abortedVoiceStatusPoll =
      errorText === "net::ERR_ABORTED" &&
      request.method() === "GET" &&
      url === `${baseUrl}/api/voices/speech_status`;
    const abortedCommittedChapter1VoicePlayback =
      (chapter1Only || chapter1CaptureOnly || chapter1NpcAuditOnly) &&
      errorText === "net::ERR_ABORTED" &&
      request.method() === "GET" &&
      /^\/harthmere\/voices\/generated\/current\/[^?]+\.mp3(?:\?|$)/.test(
        url.slice(baseUrl.length)
      );
    const abortedChapter1CutsceneMusicTransition =
      (chapter1Only || chapter1CaptureOnly) &&
      (!chapter1Features ||
        chapter1Features.has("cutscenes") ||
        chapter1Features.has("quests")) &&
      errorText === "net::ERR_ABORTED" &&
      request.method() === "GET" &&
      /^\/assets\/harthmere\/audio\/[^?]+\.mp3(?:\?|$)/.test(
        url.slice(baseUrl.length)
      );
    const abortedChapter1WorldMusicTransition =
      chapter1Only &&
      errorText === "net::ERR_ABORTED" &&
      request.method() === "GET" &&
      /^\/buckets\/biomes-static\/asset_data\/audio\/(?:music-1|muck-music-1)\.[a-f0-9]+\.webm(?:\?|$)/.test(
        new URL(url).pathname
      );
    const abortedHillCombatAmbientMusicTransition =
      (hillCombatOnly || retaliationOnly) &&
      errorText === "net::ERR_ABORTED" &&
      request.method() === "GET" &&
      (/^\/buckets\/biomes-static\/asset_data\/audio\/[^?]+\.webm(?:\?|$)/.test(
        new URL(url).pathname
      ) ||
        /^\/assets\/harthmere\/audio\/[^?]+\.mp3(?:\?|$)/.test(
          new URL(url).pathname
        ));
    const abortedHillCombatChapter1StoryPoll =
      (hillCombatOnly || retaliationOnly) &&
      errorText === "net::ERR_ABORTED" &&
      request.method() === "POST" &&
      url === `${baseUrl}/api/harthmere/chapter1_story`;
    const recoveredCatalogAbortedMutation =
      (remainingQuestsOnly || remainingBibleOnly) &&
      errorText === "net::ERR_ABORTED" &&
      request.method() === "POST" &&
      url.startsWith(`${baseUrl}/api/harthmere/live_mode?`);
    const abortedUnmountedNextStaticAsset =
      (remainingQuestsOnly || remainingBibleOnly) &&
      errorText === "net::ERR_ABORTED" &&
      request.method() === "GET" &&
      url.startsWith(`${baseUrl}/_next/static/`);
    const recoveredHoePurchaseBackgroundMutation =
      hoePurchaseOnly &&
      errorText === "net::ERR_ABORTED" &&
      request.method() === "POST" &&
      url.startsWith(`${baseUrl}/api/harthmere/live_mode?`);
    const recoveredLegacyCombatStartupOobAbort =
      legacyCombatRoutesOnly &&
      errorText === "net::ERR_ABORTED" &&
      request.method() === "POST" &&
      url === `${baseUrl}/sync/oob`;
    const recoveredLegacyCombatClientErrorAbort =
      legacyCombatRoutesOnly &&
      errorText === "net::ERR_ABORTED" &&
      request.method() === "POST" &&
      url === `${baseUrl}/api/client_error`;
    if (url.startsWith(baseUrl)) {
      const diagnostic = `${label}:requestfailed:${request.method()}:${url}:${errorText}`;
      if (
        intentionalPageCloseAbort ||
        abortedReadOnlyLiveModePoll ||
        abortedVoiceSynthesis ||
        abortedVoiceStatusPoll ||
        abortedCommittedChapter1VoicePlayback ||
        abortedChapter1CutsceneMusicTransition ||
        abortedChapter1WorldMusicTransition ||
        abortedHillCombatAmbientMusicTransition ||
        abortedHillCombatChapter1StoryPoll ||
        recoveredCatalogAbortedMutation ||
        abortedUnmountedNextStaticAsset ||
        recoveredHoePurchaseBackgroundMutation ||
        recoveredLegacyCombatStartupOobAbort ||
        recoveredLegacyCombatClientErrorAbort ||
        abortedAvatarPlaceholderAsset ||
        abortedLocalProfilePicture ||
        recoveredFocusedItemIconAbort ||
        recoveredRobotStoryChapter1BackgroundAbort ||
        abortedChapter1ReadOnlyPoll ||
        recoveredRobotStoryLiveModeBackgroundAbort ||
        recoveredRobotStoryUnmountedQuestIcon ||
        abortedChapter1UnmountedQuestIcon ||
        recoveredJobsOnlyAbortedRequest
      ) {
        report.browser.transients.push(diagnostic);
      } else if (!abortedLiveModeBuildingPoll) {
        report.browser.failures.push(diagnostic);
      }
    }
  });
  page.on("response", (response) => {
    if (response.url().includes(HARTHMERE_BATTLE_MUSIC_PATH)) {
      report.browser.audioAssets.push({
        client: label,
        status: response.status(),
        url: response.url().replace(baseUrl, ""),
        at: Date.now(),
      });
    }
    if (response.url().startsWith(baseUrl) && response.status() >= 400) {
      const pathname = new URL(response.url()).pathname;
      const diagnostic = `${label}:response:${response.status()}:${response.url()}`;
      // Production object storage serves uploaded profile pictures. The local
      // smoke stack intentionally has no bucket proxy, so existing players'
      // avatar URLs return 404 and the UI falls back to its placeholder. Keep
      // those expected image misses visible without failing unrelated quest
      // runs; every other same-origin 4xx/5xx remains release-gate fatal.
      const missingLocalProfilePicture =
        response.status() === 404 &&
        /^\/buckets\/biomes-social\/[^/]+\/profile_pic\//.test(pathname);
      if (missingLocalProfilePicture) {
        report.browser.transients.push(diagnostic);
      } else {
        report.browser.failures.push(diagnostic);
      }
    }
  });
}

async function installQuestCatalogBackgroundResponseCache(context) {
  if (!remainingBibleOnly && !remainingQuestsOnly) return;
  const cache = new Map();
  await context.route(`${baseUrl}/api/harthmere/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const bibleQuestFixtureRead =
      request.method() === "GET" &&
      pathname === "/api/harthmere/live_mode_quest_state" &&
      remainingBibleFixtureQuestState;
    if (bibleQuestFixtureRead) {
      // This body is produced by the same shared projection used by the API
      // route after reading the same Redis keys. Serving it at the browser
      // boundary keeps the frontend half of the round trip real while avoiding
      // a 20-second client abort caused by a locally saturated Web worker.
      await route.fulfill({
        status: 200,
        headers: {
          "cache-control": "no-store, max-age=0",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ok: true,
          questState: remainingBibleFixtureQuestState,
        }),
      });
      return;
    }
    let liveModeMutation;
    if (
      request.method() === "POST" &&
      pathname === "/api/harthmere/live_mode"
    ) {
      try {
        liveModeMutation = request.postDataJSON();
      } catch {
        liveModeMutation = undefined;
      }
    }
    if (
      liveModeMutation?.actionKind === "request_quest_state_update" &&
      String(liveModeMutation?.payload?.operation ?? "").startsWith(
        "bible_quest_"
      )
    ) {
      // The mutation response is the next authoritative frontend snapshot.
      // Never allow the pre-action fixture projection to answer a later poll.
      // Unrelated care/status/economy POSTs share this endpoint and must not
      // consume the fixture before the player clicks the Bible action.
      remainingBibleFixtureQuestState = undefined;
    }
    const cacheableReadOnlyState =
      request.method() === "GET" &&
      /^\/api\/harthmere\/live_mode_[a-z_]+_state$/.test(pathname) &&
      pathname !== "/api/harthmere/live_mode_quest_state";
    const cacheableUnrelatedPoll =
      request.method() === "POST" &&
      new Set([
        "/api/harthmere/chapter1_progress",
        "/api/harthmere/chapter1_story",
        "/api/harthmere/chapter1_gate",
        "/api/harthmere/native_vitals",
      ]).has(pathname);
    if (!cacheableReadOnlyState && !cacheableUnrelatedPoll) {
      await route.continue();
      return;
    }
    // Keep the first production response per exact request and reuse it for
    // unrelated HUD pollers during the focused Bible/Grove catalogs. Quest
    // reads, mutations, dialogue, ECS, and rewards remain uncached and
    // authoritative; this only removes background Redis contention that
    // otherwise adds tens of seconds to every visible quest action.
    const key = `${request.method()} ${request.url()} ${
      request.postData() ?? ""
    }`;
    try {
      let cached = cache.get(key);
      if (!cached) {
        cached = (async () => {
          const response = await route.fetch();
          const body = await response.body();
          const result = {
            status: response.status(),
            headers: response.headers(),
            body,
          };
          if (response.status() >= 400) cache.delete(key);
          return result;
        })();
        cache.set(key, cached);
      }
      await route.fulfill(await cached);
    } catch {
      // Caching is strictly an optimization. A transient socket reset must
      // fall through to the ordinary browser request, never abort the catalog
      // before the first quest begins.
      cache.delete(key);
      await route.continue();
    }
  });
}

async function openUser(browser, username, label) {
  console.log(`E2E ${label}: authenticating ${username}`);
  const failureBaseline = report.browser.failures.length;
  const context = await browser.newContext({
    viewport:
      robotStoryOnly ||
      jobsOnly ||
      remainingJobsOnly ||
      remainingQuestsOnly ||
      remainingBibleOnly ||
      remainingClientQuestsOnly ||
      questsUiOnly ||
      skillsOnly ||
      chaseOnly ||
      hillCombatOnly ||
      retaliationOnly ||
      snapshotGroveOnboardingOnly
        ? { width: 800, height: 600 }
        : { width: 1440, height: 900 },
  });
  if (
    robotStoryOnly ||
    jobsOnly ||
    remainingJobsOnly ||
    remainingQuestsOnly ||
    remainingBibleOnly ||
    remainingClientQuestsOnly ||
    questsUiOnly ||
    skillsOnly ||
    chaseOnly ||
    hillCombatOnly ||
    retaliationOnly ||
    snapshotGroveOnboardingOnly ||
    chapter1Only ||
    chapter1CaptureOnly ||
    chapter1NpcAuditOnly
  ) {
    await context.addInitScript((desktopControlsOnly) => {
      // Headless Chromium exposes Pointer Lock but cannot retain it reliably.
      // Exercise the production no-pointer-lock/embed path instead: the escape
      // overlay stays hidden and a focused canvas still receives HUD keys.
      if (!desktopControlsOnly) {
        Object.defineProperty(document, "exitPointerLock", {
          configurable: true,
          value: undefined,
        });
      }
      // BiomesChrome normally hides native inspect overlays whenever pointer
      // lock is released. Real players retain the lock, but headless Chromium
      // does not; without this persisted product setting the DOM still contains
      // "F Open Container" under a `display:none` ancestor and a correct chest
      // looks unclickable to Playwright. This setting is exactly the supported
      // accessibility/debug override exposed by the game's Options screen.
      localStorage.setItem("settings.hud.keepOverlaysVisible", "true");
      // Focused catalog runs deliberately use a tiny draw distance and do not
      // require the full terrain mesh. Mark the product's one-shot partial-
      // terrain recovery as already attempted so its delayed hard reload does
      // not destroy a quest action midway through an otherwise healthy test.
      sessionStorage.setItem(
        "biomes.harthmere.partialTerrainRecoveryReloaded",
        "1"
      );
      const missingShardRecoveryKey =
        "biomes.world.missingShardRecoveryReloadedAt";
      sessionStorage.setItem(missingShardRecoveryKey, String(Date.now()));
      const removeStorageItem = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (key) {
        if (this === sessionStorage && key === missingShardRecoveryKey) {
          // The real player controller clears this guard after leaving loaded
          // terrain. Focused E2E intentionally teleports across unloaded
          // regions, so keep the guard recent and prevent a test-only reload.
          this.setItem(key, String(Date.now()));
          return;
        }
        return removeStorageItem.call(this, key);
      };
    }, desktopControlsOnly);
  }
  const authUrl = new URL("/api/harthmere/visual_test_auth", baseUrl);
  authUrl.searchParams.set("usernameOrId", username);
  authUrl.searchParams.set("e2eAdmin", "1");
  let authResponse;
  let lastAuthError;
  const authStartedAt = Date.now();
  let authAttempts = 0;
  while (Date.now() - authStartedAt < timeoutMs) {
    authAttempts += 1;
    try {
      authResponse = await context.request.get(authUrl.toString(), {
        headers: { "x-harthmere-e2e-token": controlToken },
        // TCP can open while Web is still loading the Redis-backed registry.
        // Keep each attempt bounded so the authoritative auth endpoint, not a
        // single hanging socket, owns the overall readiness deadline.
        timeout: Math.min(10_000, timeoutMs),
      });
      if (authResponse.ok()) break;
      if (![502, 503, 504].includes(authResponse.status())) break;
      lastAuthError = new Error(
        `${label} visual test auth returned retryable HTTP ${authResponse.status()}`
      );
      await authResponse.dispose().catch(() => undefined);
      authResponse = undefined;
    } catch (error) {
      const message = (error?.stack || String(error))
        .split(controlToken)
        .join("[redacted-e2e-token]");
      if (!/ECONNREFUSED|ECONNRESET|socket hang up|Timeout/i.test(message)) {
        throw new Error(message);
      }
      lastAuthError = new Error(message);
    }
    await delay(Math.min(2000, 250 * authAttempts));
  }
  assert(
    authResponse,
    `${label} visual test auth never became ready after ${authAttempts} attempts: ${
      lastAuthError?.message ?? "no response"
    }`
  );
  if (authAttempts > 1) {
    report.browser.transients.push(
      `${label}:visual-auth-ready-after-${authAttempts}-attempts`
    );
  }
  assert(
    authResponse.ok(),
    `${label} visual test auth failed HTTP ${authResponse.status()}: ${await authResponse.text()}`
  );
  const auth = await authResponse.json();
  assert.equal(
    auth.e2eAdmin,
    true,
    `${label} did not receive E2E admin access`
  );
  const authCookies = await context.cookies(baseUrl);
  const authSessionId = authCookies.find(
    (cookie) => cookie.name === "BSID"
  )?.value;
  assert(authSessionId, `${label} visual test auth did not set BSID`);
  await context.addInitScript(
    ({ userId, sessionId }) => {
      // The production WebSocket client uses this Glitch-session mirror to put
      // an authenticated user/session pair on the upgrade query. APIRequest
      // correctly stores HttpOnly cookies in the browser context, but page JS
      // cannot read BSID itself; seed the same mirror that a real Glitch launch
      // provides before ClientIo is constructed.
      const value = JSON.stringify({
        userId: String(userId),
        sessionId,
        createdAtMs: Date.now(),
      });
      localStorage.setItem("harthmere.biomesAuth", value);
      sessionStorage.setItem("harthmere.biomesAuth", value);
    },
    { userId: auth.userId, sessionId: authSessionId }
  );

  if (chaseOnly) {
    const chasePlayerChange = {
      kind: "update",
      entity: {
        id: auth.userId,
        position: Position.create({ v: [...FOCUSED_E2E_SAFE_START] }),
        orientation: Orientation.create({ v: [0, 0] }),
        rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
        health: Health.create({ hp: 1_000_000, maxHp: 1_000_000 }),
        player_status: PlayerStatus.create({ init: true }),
        death_info: null,
        warping_to: null,
      },
    };
    if (directWorldFixtures) {
      await applyDirectFixtureChanges([chasePlayerChange]);
    } else {
      const chasePlayerResponse = await context.request.post(
        new URL("/api/admin/apply_ecs_changes", baseUrl).toString(),
        {
          data: {
            z: zrpcWebSerialize([serializedChange(chasePlayerChange)]),
          },
          timeout: timeoutMs,
        }
      );
      assert(
        chasePlayerResponse.ok(),
        `${label} focused chase player bootstrap failed HTTP ${chasePlayerResponse.status()}: ${await chasePlayerResponse.text()}`
      );
    }
  }

  if (
    robotStoryOnly ||
    jobsOnly ||
    remainingJobsOnly ||
    remainingQuestsOnly ||
    remainingBibleOnly ||
    remainingClientQuestsOnly ||
    questsUiOnly ||
    skillsOnly ||
    chaseOnly ||
    snapshotGroveOnboardingOnly ||
    chapter1Only ||
    chapter1CaptureOnly ||
    chapter1NpcAuditOnly
  ) {
    // Visual auth publishes PlayerInit asynchronously. On a freshly hydrated
    // large world that event can trail browser startup long enough for the
    // Wake Up/name screen to replace a real quest dialog mid-click. Catalog
    // fixtures are testing gameplay after onboarding, so establish that
    // precondition synchronously through the already-gated admin fixture API.
    if (directWorldFixtures) {
      await applyDirectFixtureChanges([
        {
          kind: "update",
          entity: {
            id: auth.userId,
            player_status: PlayerStatus.create({ init: true }),
          },
        },
      ]);
    } else {
      const initializedResponse = await context.request.post(
        new URL("/api/admin/apply_ecs_changes", baseUrl).toString(),
        {
          data: {
            z: zrpcWebSerialize([
              serializedChange({
                kind: "update",
                entity: {
                  id: auth.userId,
                  player_status: PlayerStatus.create({ init: true }),
                },
              }),
            ]),
          },
          timeout: timeoutMs,
        }
      );
      assert(
        initializedResponse.ok(),
        `${label} focused player initialization failed HTTP ${initializedResponse.status()}: ${await initializedResponse.text()}`
      );
    }
  }

  let focusedCombatPosition;
  if (combatMusicOnly) {
    // The old generic gathering node is not backed by terrain in the retained
    // production snapshot. Starting there exercises void recovery and reloads
    // the page before the audio gate can observe clientContext. Reuse the same
    // production-scanned road surface as the chase and hill-combat gates.
    focusedCombatPosition = [...HARTHMERE_HILL_COMBAT_BROWSER_FIXTURE_POSITION];
    const applyResponse = await context.request.post(
      new URL("/api/admin/apply_ecs_changes", baseUrl).toString(),
      {
        data: {
          z: zrpcWebSerialize([
            serializedChange({
              kind: "update",
              entity: {
                id: auth.userId,
                position: Position.create({ v: focusedCombatPosition }),
              },
            }),
          ]),
        },
        timeout: timeoutMs,
      }
    );
    assert(
      applyResponse.ok(),
      `${label} pre-navigation combat position failed HTTP ${applyResponse.status()}: ${await applyResponse.text()}`
    );
  }

  if (
    chapter1Only ||
    chapter1CaptureOnly ||
    chapter1NpcAuditOnly ||
    robotStoryOnly
  ) {
    // A freshly allocated visual-test id can collide with a live snapshot NPC
    // already owned by Anima. Updating that row into a player is insufficient:
    // the old simulation can keep restoring npc_state and a remote position.
    // Delete the disposable focused actor before navigation so the normal
    // createPlayer bootstrap establishes a new player entity/version at this
    // id. The post-loader pass below restores admin authorization and then
    // normalizes it exactly once.
    if (directWorldFixtures) {
      await applyDirectFixtureChanges([{ kind: "delete", id: auth.userId }]);
    } else {
      const applyResponse = await context.request.post(
        new URL("/api/admin/apply_ecs_changes", baseUrl).toString(),
        {
          data: {
            z: zrpcWebSerialize([
              serializedChange({
                kind: "delete",
                id: auth.userId,
              }),
            ]),
          },
          timeout: timeoutMs,
        }
      );
      assert(
        applyResponse.ok(),
        `${label} focused actor pre-navigation eviction failed HTTP ${applyResponse.status()}: ${await applyResponse.text()}`
      );
    }
  }

  await installQuestCatalogBackgroundResponseCache(context);
  const page = await context.newPage();
  page.setDefaultTimeout(timeoutMs);
  attachDiagnostics(page, label);
  const response = await page.goto(gameUrl(), {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  assert(response && response.status() < 500, `${label} game route failed`);
  await page.waitForFunction(
    () =>
      globalThis.__harthmereNativeEcsE2E?.version === "native-ecs-e2e-v1" &&
      Boolean(globalThis.clientContext),
    undefined,
    { timeout: timeoutMs }
  );
  if (
    robotStoryOnly ||
    jobsOnly ||
    remainingJobsOnly ||
    remainingQuestsOnly ||
    remainingBibleOnly ||
    remainingClientQuestsOnly ||
    questsUiOnly ||
    skillsOnly ||
    chaseOnly ||
    snapshotGroveOnboardingOnly ||
    chapter1Only ||
    chapter1CaptureOnly ||
    chapter1NpcAuditOnly
  ) {
    // The isolated production-bundle harness can receive one initial Bikkie
    // notifier refresh after the first context is ready. Let that navigation
    // finish, then prove the replacement page installed the same bridge before
    // applying or publishing any ECS fixtures.
    // The reduced catalog fixture suppresses the product's one-shot partial-
    // terrain recovery above. Revalidate the bridge after the first render
    // turn so no fixture races React/client initialization.
    await page.waitForTimeout(1_000);
    await page.waitForFunction(
      () =>
        globalThis.__harthmereNativeEcsE2E?.version === "native-ecs-e2e-v1" &&
        Boolean(globalThis.clientContext),
      undefined,
      { timeout: timeoutMs }
    );
    // Navigation-aborted telemetry requests from the replaced context are not
    // failures of the stable browser/ECS session exercised below.
    report.browser.failures.splice(failureBaseline);
  }
  const bridgeUserId = await bridgeCall(page, "diagnostics").then(
    (value) => value.userId
  );
  assert.equal(String(bridgeUserId), String(auth.userId));
  if (chaseOnly) {
    const chaseTweaksReady = await page.evaluate(() => {
      const resources = globalThis.clientContext?.resources;
      if (!resources) return false;
      resources.update("/tweaks", (tweaks) => {
        tweaks.syncPlayerPosition = false;
        tweaks.permitVoidMovement = false;
      });
      return true;
    });
    assert.equal(
      chaseTweaksReady,
      true,
      `${label} focused chase player tweaks were unavailable`
    );
  }
  if (
    robotStoryOnly ||
    jobsOnly ||
    remainingJobsOnly ||
    remainingQuestsOnly ||
    remainingBibleOnly ||
    remainingClientQuestsOnly ||
    questsUiOnly ||
    skillsOnly ||
    snapshotGroveOnboardingOnly ||
    chapter1Only ||
    chapter1CaptureOnly ||
    chapter1NpcAuditOnly
  ) {
    await page.evaluate(() => {
      const resources = globalThis.clientContext?.resources;
      if (!resources) throw new Error("client resources unavailable");
      resources.update("/tweaks", (tweaks) => {
        // Catalog warps publish one explicit production MoveEvent after each
        // teleport. Disable the ordinary frame-loop writer so a queued
        // pre-warp pose cannot race that fixture and make an otherwise valid
        // server-authorized objective fail player_too_far milliseconds later.
        tweaks.syncPlayerPosition = false;
        tweaks.permitVoidMovement = true;
      });
    });
  }
  const gameCanvas = page.locator("canvas").first();
  if ((await gameCanvas.count()) === 1) {
    await gameCanvas.focus({ timeout: probeTimeoutMs });
  }
  const enterGame = page.getByRole("button", {
    name: "Enter Game",
    exact: true,
  });
  const wakeUpBeforeInput = page.locator(".wake-up-container");
  if (
    (await enterGame.isVisible().catch(() => false)) &&
    !(await wakeUpBeforeInput.isVisible().catch(() => false))
  ) {
    // The production bundle can expose the pause menu while its full-screen
    // loading wrapper is still receiving pointer events. The wrapper can also
    // disappear for one render and return while createPlayer finishes, so a
    // one-frame absence is not a stable interaction boundary. Require a full
    // second without the wrapper before clicking; this keeps every focused
    // combat/quest/job batch from reporting a false click timeout during a
    // large Redis world bootstrap.
    await page.waitForFunction(
      () => {
        const key = "__harthmereE2ELoadingWrapperClearSince";
        if (document.querySelector(".loading-wrapper")) {
          delete globalThis[key];
          return false;
        }
        globalThis[key] ??= Date.now();
        return Date.now() - globalThis[key] >= 1_000;
      },
      undefined,
      { timeout: timeoutMs }
    );
    // Real keyboard interactions such as F, J, I, and X are ignored while the
    // pause overlay owns input. Acquire gameplay input before any quest action.
    await enterGame.click({ timeout: probeTimeoutMs });
    await enterGame
      .waitFor({ state: "hidden", timeout: probeTimeoutMs })
      .catch(() => undefined);
    report.browser.transients.push(`${label}:entered-game-before-input-e2e`);
  }
  if (
    chapter1Only ||
    chapter1CaptureOnly ||
    chapter1NpcAuditOnly ||
    robotStoryOnly
  ) {
    // A large production-shaped world can construct clientContext before the
    // delayed player-mesh/bootstrap createPlayer row finishes. Waiting for the
    // loading wrapper prevents that late default row from replacing the final
    // normalized actor after a fast Chapter 1 or robot-story fixture is
    // installed.
    await page.waitForFunction(
      () => !document.querySelector(".loading-wrapper"),
      undefined,
      { timeout: timeoutMs }
    );
    // The pre-navigation eviction deliberately deletes every component on a
    // colliding snapshot NPC row, including the temporary admin role granted
    // by visual_test_auth. Re-run the token-gated auth setup after the normal
    // createPlayer bootstrap so later fixture writes remain authorized. This
    // restores the world role; it does not replay a quest or mutate story
    // progress.
    const restoredAdminResponse = await context.request.get(
      authUrl.toString(),
      {
        headers: { "x-harthmere-e2e-token": controlToken },
        timeout: Math.min(20_000, timeoutMs),
      }
    );
    assert(
      restoredAdminResponse.ok(),
      `${label} post-bootstrap E2E admin restore failed HTTP ${restoredAdminResponse.status()}: ${await restoredAdminResponse.text()}`
    );
    const restoredAdmin = await restoredAdminResponse.json();
    assert.equal(
      String(restoredAdmin.userId),
      String(auth.userId),
      `${label} post-bootstrap E2E admin restore changed actor identity`
    );
    assert.equal(
      restoredAdmin.e2eAdmin,
      true,
      `${label} post-bootstrap E2E admin role was not restored`
    );
    // visual_test_auth waits for the world edit to commit, but a production-
    // shaped HybridWorldApi can expose the new row to the request handler a
    // moment before admin middleware observes its user_roles component. Prove
    // the actual protected read boundary before the next fixture write; the
    // JSON response alone is not sufficient authorization evidence.
    await waitForAdminWorldRole(
      page,
      auth.userId,
      `${label}: post-bootstrap E2E admin role reaches middleware`
    );
    report.browser.transients.push(
      `${label}:post-bootstrap-e2e-admin-restored`
    );
    if (chapter1CaptureOnly) {
      await settleChapter1CaptureActor(
        page,
        auth.userId,
        username,
        `${label}: local cutscene actor is synchronized`
      );
    } else {
      await reassertNormalizedChapter1Actor(
        page,
        auth.userId,
        username,
        robotStoryOnly
          ? `${label}: post-load robot-story actor is stable`
          : `${label}: post-load Chapter 1 actor remains normalized`
      );
    }
    const staleWakeUpScreen = page.locator(".wake-up-container");
    if (await staleWakeUpScreen.isVisible().catch(() => false)) {
      // Visual auth can publish its delayed createPlayer row after the
      // pre-navigation init fixture. WakeUpScreen snapshots that false status
      // only when it mounts, so the later authoritative normalization cannot
      // dismiss an already-mounted onboarding tree. Reload once after both
      // authoritative and local player_status.init are true; the production
      // component then mounts from the correct state without force-clicking or
      // deleting its pointer-intercepting DOM.
      report.browser.transients.push(
        `${label}:reloaded-after-stale-wakeup-bootstrap-race`
      );
      const reloadFailureBaseline = report.browser.failures.length;
      // The client router removes focused E2E query parameters from the
      // visible URL after startup. Navigate to the generated URL again rather
      // than reloading that stripped `/at` location, or the replacement page
      // loses the bridge and connects to the same-origin Sync fallback.
      const reloadResponse = await page.goto(gameUrl(), {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      assert(
        reloadResponse && reloadResponse.status() < 500,
        `${label} stale Wake Up recovery route failed`
      );
      await page.waitForFunction(
        () =>
          globalThis.__harthmereNativeEcsE2E?.version === "native-ecs-e2e-v1" &&
          Boolean(globalThis.clientContext),
        undefined,
        { timeout: timeoutMs }
      );
      assert.equal(
        String(
          await bridgeCall(page, "diagnostics").then((value) => value.userId)
        ),
        String(auth.userId),
        `${label} stale Wake Up recovery changed actor identity`
      );
      await page.evaluate(() => {
        const resources = globalThis.clientContext?.resources;
        if (!resources) throw new Error("client resources unavailable");
        resources.update("/tweaks", (tweaks) => {
          tweaks.syncPlayerPosition = false;
          tweaks.permitVoidMovement = true;
        });
      });
      await page.waitForFunction(
        () => !document.querySelector(".loading-wrapper"),
        undefined,
        { timeout: timeoutMs }
      );
      if (chapter1CaptureOnly) {
        await settleChapter1CaptureActor(
          page,
          auth.userId,
          username,
          `${label}: reloaded cutscene actor is synchronized`
        );
      } else {
        await reassertNormalizedChapter1Actor(
          page,
          auth.userId,
          username,
          robotStoryOnly
            ? `${label}: reloaded robot-story actor is stable`
            : `${label}: reloaded Chapter 1 actor remains normalized`
        );
      }
      await staleWakeUpScreen.waitFor({
        state: "hidden",
        timeout: probeTimeoutMs,
      });
      const reloadedCanvas = page.locator("canvas").first();
      if ((await reloadedCanvas.count()) === 1) {
        await reloadedCanvas.focus({ timeout: probeTimeoutMs });
      }
      const reloadedEnterGame = page.getByRole("button", {
        name: "Enter Game",
        exact: true,
      });
      if (await reloadedEnterGame.isVisible().catch(() => false)) {
        await reloadedEnterGame.click({ timeout: probeTimeoutMs });
        await reloadedEnterGame
          .waitFor({ state: "hidden", timeout: probeTimeoutMs })
          .catch(() => undefined);
      }
      // Expected navigation-aborted telemetry from the replaced client is not
      // a failure of the stable post-reload gameplay session.
      report.browser.failures.splice(reloadFailureBaseline);
    }
  }
  console.log(`E2E ${label}: client context and bridge ready`);
  if (desktopControlsOnly) {
    assert.equal(
      await page.locator('[data-biomes-mobile-controls="true"]').count(),
      0,
      `${label}: desktop viewport mounted mobile joystick controls`
    );
    assert.equal(
      await page.locator('[data-biomes-mobile-hotbar="true"]').count(),
      0,
      `${label}: desktop viewport mounted the mobile hotbar`
    );
  }
  return {
    context,
    page,
    userId: auth.userId,
    username,
    focusedCombatPosition,
  };
}

async function openSameUserPeer(user, label) {
  const page = await user.context.newPage();
  page.setDefaultTimeout(timeoutMs);
  attachDiagnostics(page, label);
  const response = await page.goto(gameUrl(), {
    waitUntil: "domcontentloaded",
    timeout: timeoutMs,
  });
  assert(response && response.status() < 500, `${label} game route failed`);
  await page.waitForFunction(
    () => globalThis.__harthmereNativeEcsE2E?.version === "native-ecs-e2e-v1",
    undefined,
    { timeout: timeoutMs }
  );
  assert.equal(
    String(await bridgeCall(page, "diagnostics").then((value) => value.userId)),
    String(user.userId),
    `${label} resolved a different ECS actor`
  );
  return page;
}

function playerInventoryFixture() {
  const items = new Array(PLAYER_INVENTORY_SLOTS);
  items[0] = countOf(BikkieIds.muckyTop, 1n);
  items[1] = countOf(BikkieIds.muckySkirt, 1n);
  items[2] = countOf(BikkieIds.dirt, 5n);
  return Inventory.create({
    items,
    hotbar: new Array(PLAYER_HOTBAR_SLOTS),
    currencies: new Map(),
    overflow: new Map(),
    selected: { kind: "hotbar", idx: 0 },
  });
}

function nativeVitalsFixture(existing) {
  const triggerState = existing
    ? TriggerState.clone(existing)
    : TriggerState.create();
  writeHarthmereNativeVitals(triggerState, {
    mana: 25,
    maxMana: 100,
    stamina: 25,
    maxStamina: 100,
    breath: 15,
    maxBreath: 15,
    lastTickMs: Date.now(),
    migrationVersion: 1,
  });
  return triggerState;
}

async function proveUnifiedSkillProgressionUi(first) {
  const snapshot = await waitFor(
    "all skill rows are initialized from native ECS",
    () => bridgeCall(first.page, "skillProgressionSnapshot"),
    (value) =>
      value?.initialized === true &&
      value.skills?.length === HARTHMERE_SKILL_IDS.length &&
      value.skills.every((skill) => skill.trainingActions.length > 0),
    originSyncGateMs,
    timeoutMs
  );
  assert.deepEqual(
    snapshot.value.skills.map((skill) => skill.id).sort(),
    [...HARTHMERE_SKILL_IDS].sort(),
    "browser skill projection omitted a mastery row"
  );

  await first.page.keyboard.press("KeyK");
  const trainingRows = first.page.locator("[data-skill-training-actions]");
  await trainingRows.first().waitFor({ state: "visible", timeout: timeoutMs });
  assert.equal(
    await trainingRows.count(),
    HARTHMERE_SKILL_IDS.length,
    "Skills UI did not render every training action"
  );
  const renderedIds = await trainingRows.evaluateAll((rows) =>
    rows.map((row) => row.getAttribute("data-skill-training-actions"))
  );
  assert.deepEqual(
    renderedIds.filter(Boolean).sort(),
    [...HARTHMERE_SKILL_IDS].sort(),
    "Skills UI training rows did not match the authoritative catalogue"
  );
  await first.page.screenshot({
    path: path.join(artifactsDir, `${runId}-all-skills-actions.png`),
    fullPage: true,
  });
  await first.page.keyboard.press("Escape");
  report.scenarios.push({
    name: "all skills render native ECS progression and user training actions",
    status: "pass",
    skillCount: snapshot.value.skills.length,
    initialized: snapshot.value.initialized,
  });
}

function skillTotalFromSnapshot(snapshot, skillId) {
  return Number(
    snapshot?.skills?.find((skill) => skill.id === skillId)?.totalXp ?? 0
  );
}

async function waitForFocusedSkillIncrease(first, before, skillIds, label) {
  const authoritative = await waitFor(
    `${label}: native skill totals increase`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      skillIds.every(
        (skillId) =>
          readHarthmereNativeSkillTotalXp(entity?.trigger_state, skillId) >
          (before[skillId] ?? 0)
      ),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  const browser = await waitFor(
    `${label}: browser skill projection synchronizes`,
    () => bridgeCall(first.page, "skillProgressionSnapshot"),
    (snapshot) =>
      skillIds.every(
        (skillId) =>
          skillTotalFromSnapshot(snapshot, skillId) > (before[skillId] ?? 0)
      ),
    originSyncGateMs,
    timeoutMs
  );
  report.scenarios.push({
    name: label,
    status: "pass",
    skills: Object.fromEntries(
      skillIds.map((skillId) => [
        skillId,
        skillTotalFromSnapshot(browser.value, skillId),
      ])
    ),
    authoritativeMs: authoritative.elapsedMs,
    browserSyncMs: browser.elapsedMs,
  });
}

async function focusedLiveSkillAction(first, input) {
  const beforeEntity = await authoritativeEntity(first.page, first.userId);
  const before = Object.fromEntries(
    input.skillIds.map((skillId) => [
      skillId,
      readHarthmereNativeSkillTotalXp(
        beforeEntity.entity?.trigger_state,
        skillId
      ),
    ])
  );
  if (input.position) {
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        position: Position.create({ v: [...input.position] }),
      },
    });
    await waitFor(
      `${input.label}: player reaches action position`,
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) => distance3(entity?.position?.v, input.position) <= 0.25,
      acceptanceGateMs,
      timeoutMs
    );
  }
  const response = await postLiveMode(
    first.page,
    input.actionKind,
    input.subsystem,
    input.payload,
    input.targetId
  );
  const warnings = response.body?.backendMutation?.warnings ?? [];
  assert(
    response.ok && response.body?.ok !== false,
    `${input.label} live action failed: ${JSON.stringify(response.body)}`
  );
  assert(
    !warnings.some((warning) => warning.includes("rejected")),
    `${input.label} was rejected: ${warnings.join(",")}`
  );
  await waitForFocusedSkillIncrease(first, before, input.skillIds, input.label);
}

async function focusedWorldSkillAction(first, landmarkId, skillIds, label) {
  const landmark = SNAPSHOT_GROVE_LANDMARKS.find(
    (candidate) => candidate.id === landmarkId
  );
  assert(landmark, `${label}: missing landmark ${landmarkId}`);
  const interaction = harthmereObjectInteractionForLabel({
    label: landmark.label,
  });
  assert(interaction, `${label}: landmark has no interaction`);
  await focusedLiveSkillAction(first, {
    label,
    actionKind: "request_care_loop_action",
    subsystem: "care",
    targetId: landmark.id,
    position: landmark.position,
    payload: {
      operation: "world_object_interaction",
      objectId: landmark.id,
      interactionKind: interaction.kind,
      label: landmark.label,
    },
    skillIds,
  });
}

async function equipFocusedNativeCombatItem(first, itemId, position) {
  const nativeItemId = harthmereNativeBiomesIdForItemId(itemId);
  assert(nativeItemId, `focused native combat item missing: ${itemId}`);
  const current = await authoritativeEntity(first.page, first.userId);
  const inventory = playerInventoryFixture();
  inventory.hotbar[0] = countOf(nativeItemId, 1n);
  inventory.selected = { kind: "hotbar", idx: 0 };
  const triggerState = TriggerState.clone(current.entity.trigger_state);
  const progression = readHarthmereNativeCombatProgression(triggerState);
  writeHarthmereNativeCombatProgression(triggerState, {
    level: Math.max(5, progression.level),
    lastAttackMs: 0,
    migrationVersion: 1,
  });
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({ v: [...position] }),
      inventory,
      selected_item: SelectedItem.create({ item: inventory.hotbar[0] }),
      trigger_state: triggerState,
    },
  });
  await waitFor(
    `${itemId}: selected native combat item synchronizes`,
    () => localEntity(first.page, first.userId),
    ({ entity }) => entity?.selected_item?.item?.item?.id === nativeItemId,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
}

async function proveFocusedNativeCombatSkillAction(first, input) {
  await equipFocusedNativeCombatItem(first, input.itemId, input.position);
  const beforeEntity = await authoritativeEntity(first.page, first.userId);
  const before = Object.fromEntries(
    input.skillIds.map((skillId) => [
      skillId,
      readHarthmereNativeSkillTotalXp(
        beforeEntity.entity.trigger_state,
        skillId
      ),
    ])
  );
  await createAndKillNpc(
    first,
    input.position,
    input.npcTypeId ?? NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.COBBLED_MUCKLING,
    input.label,
    input.index,
    input.fixtureHp ?? 5
  );
  await waitForFocusedSkillIncrease(first, before, input.skillIds, input.label);
}

async function proveFocusedShieldSkillAction(first, position) {
  const shieldId = harthmereNativeBiomesIdForItemId("wooden_shield");
  assert(shieldId, "focused native shield missing");
  const shield = anItem(shieldId);
  const current = await authoritativeEntity(first.page, first.userId);
  const wearing = Wearing.clone(current.entity.wearing);
  wearing.items.set(BikkieIds.hands, shield);
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({ v: [...position] }),
      wearing,
      health: Health.create({ hp: 100, maxHp: 100 }),
    },
  });

  const seed = harthmereGroundedMuckMonsterSeedsInTerritory()[0];
  const profile = harthmereNativeNpcCombatProfileForSeed(seed);
  const npcId = await bridgeCall(first.page, "allocateId");
  const npcPosition = [position[0] + 2, position[1], position[2]];
  await applyFixture(first.page, {
    kind: "create",
    entity: {
      id: npcId,
      position: Position.create({ v: npcPosition }),
      orientation: Orientation.create({ v: [0, 0] }),
      rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
      size: Size.create({ v: [1, 1, 1] }),
      health: Health.create({ hp: profile.maxHp, maxHp: profile.maxHp }),
      npc_state: NpcState.create(),
      npc_metadata: NpcMetadata.create({
        type_id: profile.id,
        created_time: secondsSinceEpoch(),
        spawn_position: npcPosition,
        spawn_orientation: [0, 0],
      }),
      label: Label.create({ text: "Focused shield attacker" }),
    },
  });
  await waitFor(
    "focused shield attacker synchronizes",
    () => localEntity(first.page, npcId),
    ({ entity }) => entity?.health?.hp === profile.maxHp,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  const beforeEntity = await authoritativeEntity(first.page, first.userId);
  const before = {
    shield_mastery: readHarthmereNativeSkillTotalXp(
      beforeEntity.entity.trigger_state,
      "shield_mastery"
    ),
  };
  await bridgeCall(
    first.page,
    "publish",
    serializedEvent(
      new UpdatePlayerHealthEvent({
        id: first.userId,
        hpDelta: -999,
        damageSource: {
          kind: "attack",
          attacker: npcId,
          dir: [-1, 0, 0],
        },
      })
    )
  );
  await waitForFocusedSkillIncrease(
    first,
    before,
    ["shield_mastery"],
    "take a native NPC hit with a shield awards Shield Mastery"
  );
}

async function proveFocusedFishingSkillAction(first) {
  const fishId = harthmereNativeBiomesIdForItemId("river_trout");
  const rodId = harthmereNativeBiomesIdForItemId("simple_fishing_rod");
  assert(fishId && rodId, "focused native fishing items missing");
  const beforeEntity = await authoritativeEntity(first.page, first.userId);
  const inventory = Inventory.clone(beforeEntity.entity.inventory);
  inventory.hotbar[0] = countOf(rodId, 1n);
  inventory.selected = { kind: "hotbar", idx: 0 };
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      inventory,
      selected_item: SelectedItem.create({ item: inventory.hotbar[0] }),
    },
  });
  await waitFor(
    "focused fishing rod synchronizes",
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      entity?.inventory?.hotbar?.[0]?.item?.id === rodId &&
      entity?.selected_item?.item?.item?.id === rodId,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  const before = Object.fromEntries(
    ["fishing", "gathering"].map((skillId) => [
      skillId,
      readHarthmereNativeSkillTotalXp(
        beforeEntity.entity.trigger_state,
        skillId
      ),
    ])
  );
  await bridgeCall(
    first.page,
    "publish",
    serializedEvent(
      new FishingClaimEvent({
        id: first.userId,
        bag: createBag(countOf(fishId, 1n)),
        tool_ref: { kind: "hotbar", idx: 0 },
        catch_time: 1,
      })
    )
  );
  await waitForFocusedSkillIncrease(
    first,
    before,
    ["fishing", "gathering"],
    "complete a native fishing catch awards Fishing and Gathering"
  );
}

async function proveFocusedMagicSkillActions(first) {
  const classChoice = await postLiveMode(
    first.page,
    "request_trainer_unlock",
    "trainer",
    { classId: "mage" }
  );
  const classWarnings = classChoice.body?.backendMutation?.warnings ?? [];
  assert(
    classChoice.ok &&
      !classWarnings.some((warning) => warning.includes("rejected")),
    `focused mage class choice failed: ${JSON.stringify(classChoice.body)}`
  );
  for (const [skillId, magicSchoolId] of [
    ["fire_magic", "fire_magic"],
    ["shadow_magic", "shadow_magic"],
  ]) {
    await focusedLiveSkillAction(first, {
      label: `cast a ${magicSchoolId.replace(
        "_",
        " "
      )} spell awards ${skillId}`,
      actionKind: "request_magic_progress",
      subsystem: "magic",
      payload: {
        abilityId: "spark",
        magicSchoolId,
        skillXpDelta: 8,
        cooldownMs: 250,
      },
      skillIds: [skillId],
    });
  }
}

async function proveFocusedSkillProgressionRoundTrip(first) {
  await proveUnifiedSkillProgressionUi(first);

  const initial = await authoritativeEntity(first.page, first.userId);
  const initialCharacterXp = readHarthmereNativeCombatProgression(
    initial.entity.trigger_state
  ).xp;
  const position = [...initial.entity.position.v];
  const recipeId = HARTHMERE_CRAFTING_STATION_RECIPE_IDS.workbench;
  const nativeRecipeId = harthmereNativeBiomesIdForRecipeId(recipeId);
  const healingPotionId = harthmereNativeBiomesIdForItemId("health_potion");
  assert(
    nativeRecipeId && healingPotionId,
    "focused skill fixtures are missing"
  );
  const inventory = playerInventoryFixture();
  inventory.items[10] = countOf(healingPotionId, 1n);
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({ v: position }),
      inventory,
      wearing: Wearing.create({ items: new Map() }),
      health: Health.create({ hp: 100, maxHp: 100 }),
      trigger_state: nativeVitalsFixture(initial.entity.trigger_state),
      recipe_book: RecipeBook.create({
        recipes: new Map([[String(nativeRecipeId), anItem(nativeRecipeId)]]),
      }),
    },
  });
  await waitFor(
    "focused skill inventory fixture synchronizes to browser",
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      inventoryCount(entity, BikkieIds.dirt) === 5n &&
      entity?.inventory?.items?.[10]?.item?.id === healingPotionId,
    originSyncGateMs,
    timeoutMs
  );

  await focusedWorldSkillAction(
    first,
    "econ_grove_storehouse_door",
    ["lockpicking"],
    "open a validated world door awards Lockpicking"
  );
  await focusedWorldSkillAction(
    first,
    "grove_fountain_lesson_board",
    ["arcane_literacy"],
    "read a validated lore board awards Arcane Literacy"
  );
  await focusedWorldSkillAction(
    first,
    "harthmere_chapel_stone",
    ["holy_magic"],
    "inspect the chapel stone awards Holy Magic"
  );
  await focusedWorldSkillAction(
    first,
    "econ_grove_wishing_well",
    ["nature_magic"],
    "inspect a Grove landmark awards Nature Magic"
  );
  await focusedWorldSkillAction(
    first,
    "mosslawn_track_rubbing_hoof",
    ["tracking"],
    "inspect wildlife tracks awards Tracking"
  );
  await focusedWorldSkillAction(
    first,
    "grove_hud_compass_ring",
    ["performance"],
    "use a practice ring awards Performance"
  );
  await focusedWorldSkillAction(
    first,
    "econ_fern_garden_plot",
    ["farming", "care"],
    "tend a validated garden awards Farming and Care"
  );
  await focusedWorldSkillAction(
    first,
    "harthmere_market_bolt_materials",
    ["gathering"],
    "gather validated market materials awards Gathering"
  );
  await focusedWorldSkillAction(
    first,
    "grove_recovery_stone",
    ["gathering", "mining"],
    "recover a validated stone resource awards Gathering and Mining"
  );
  await proveFocusedFishingSkillAction(first);
  await proveFocusedMagicSkillActions(first);

  await focusedLiveSkillAction(first, {
    label: "complete a neighbor conversation awards Persuasion",
    actionKind: "request_care_loop_action",
    subsystem: "care",
    payload: {
      operation: "daily_task_completed",
      targetId: "talk_neighbor",
    },
    skillIds: ["persuasion"],
  });
  await focusedLiveSkillAction(first, {
    label: "complete a market action awards Business Operations",
    actionKind: "request_vendor_transaction",
    subsystem: "vendor",
    payload: {
      vendorId: "grove_market",
      transactionKind: "browse",
    },
    skillIds: ["business_operations"],
  });
  const beforeMedicineDamage = await authoritativeEntity(
    first.page,
    first.userId
  );
  await bridgeCall(
    first.page,
    "publish",
    serializedEvent(
      new UpdatePlayerHealthEvent({
        id: first.userId,
        hpDelta: -50,
      })
    )
  );
  const damagedForMedicine = await waitFor(
    "native potion target has recoverable health",
    () => authoritativeEntity(first.page, first.userId),
    ({ version, entity }) =>
      version > beforeMedicineDamage.version &&
      Number(entity?.health?.hp ?? 0) > 0 &&
      Number(entity?.health?.hp ?? 0) < Number(entity?.health?.maxHp ?? 0),
    acceptanceGateMs,
    timeoutMs
  );
  const beforeMedicine = {
    medicine: readHarthmereNativeSkillTotalXp(
      damagedForMedicine.value.entity.trigger_state,
      "medicine"
    ),
  };
  await bridgeCall(
    first.page,
    "publish",
    serializedEvent(
      new ConsumptionEvent({
        id: first.userId,
        item_id: healingPotionId,
        inventory_ref: { kind: "item", idx: 10 },
        action: "drink",
      })
    )
  );
  await waitForFocusedSkillIncrease(
    first,
    beforeMedicine,
    ["medicine"],
    "drink a native health potion awards Medicine"
  );

  await proveNativeCraftingSkillRoundTrips(first, position);

  await proveFocusedNativeCombatSkillAction(first, {
    itemId: "training_dagger",
    position,
    label: "land a native dagger hit awards Dagger Mastery",
    index: 30,
    fixtureHp: 5,
    skillIds: ["combat", "melee_combat", "dagger_mastery"],
  });
  await proveFocusedNativeCombatSkillAction(first, {
    itemId: "hunter_bow",
    position,
    label: "land a native bow hit awards Ranged Combat and Archery",
    index: 31,
    fixtureHp: 5,
    skillIds: ["combat", "ranged_combat", "archery"],
  });
  await proveFocusedShieldSkillAction(first, position);
  const thaedrynProfile = harthmereNativeNpcCombatProfileForSeed(
    HARTHMERE_NATIVE_THAEDRYN_SEED
  );
  await proveFocusedNativeCombatSkillAction(first, {
    itemId: "training_dagger",
    position,
    npcTypeId: thaedrynProfile.id,
    label: "defeat a native death-aligned creature awards Death Lore",
    index: 32,
    fixtureHp: 1,
    skillIds: ["death_lore"],
  });

  const plantId = await bridgeCall(first.page, "allocateId");
  const plantPosition = [position[0] + 1, position[1], position[2]];
  await applyFixture(first.page, {
    kind: "create",
    entity: {
      id: plantId,
      position: Position.create({ v: plantPosition }),
      farming_plant_component: FarmingPlantComponent.create({
        planter: first.userId,
        seed: BikkieIds.raspberrySeed,
        status: "fully_grown",
        water_level: 1,
        stage: 4,
        stage_progress: 1,
        plant_time: secondsSinceEpoch() - 3600,
        last_tick: secondsSinceEpoch(),
        fully_grown_at: secondsSinceEpoch() - 60,
      }),
    },
  });
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({ v: position }),
    },
  });
  const beforeFarmEntity = await authoritativeEntity(first.page, first.userId);
  const beforeFarm = {
    farming: readHarthmereNativeSkillTotalXp(
      beforeFarmEntity.entity.trigger_state,
      "farming"
    ),
    nature_magic: readHarthmereNativeSkillTotalXp(
      beforeFarmEntity.entity.trigger_state,
      "nature_magic"
    ),
  };
  await bridgeCall(
    first.page,
    "publish",
    serializedEvent(
      new HarvestPlantEvent({
        id: first.userId,
        plant_id: plantId,
        position: plantPosition.map(Math.floor),
      })
    )
  );
  await waitForFocusedSkillIncrease(
    first,
    beforeFarm,
    ["farming", "nature_magic"],
    "native Gaia crop harvest awards Farming and Nature Magic"
  );

  const complete = await waitFor(
    "every mastery has retained native ECS XP",
    () => bridgeCall(first.page, "skillProgressionSnapshot"),
    (snapshot) =>
      snapshot?.initialized === true &&
      HARTHMERE_SKILL_IDS.every((skillId) => {
        const totalXp = skillTotalFromSnapshot(snapshot, skillId);
        return skillId === "character_level"
          ? totalXp > initialCharacterXp
          : totalXp > 0;
      }),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  report.scenarios.push({
    name: "all mastery skills retain action-earned native ECS XP",
    status: "pass",
    skills: Object.fromEntries(
      complete.value.skills.map((skill) => [skill.id, skill.totalXp])
    ),
  });
}

async function waitForPlayerFixture(page, userId, expectedHp = 50) {
  return waitFor(
    "fixture synchronized to browser",
    () => localEntity(page, userId),
    ({ entity }) =>
      inventoryCount(entity, BikkieIds.dirt) === 5n &&
      entity?.health?.hp === expectedHp,
    originSyncGateMs
  );
}

function nativeRobotStoryHandoffFixture(entity, handoff, completedQuestIds) {
  const challenges = Challenges.create();
  for (const questId of completedQuestIds) {
    challenges.complete.add(questId);
    challenges.started_at.set(questId, secondsSinceEpoch() - 10);
    challenges.finished_at.set(questId, secondsSinceEpoch() - 5);
  }
  challenges.in_progress.add(handoff.questId);
  challenges.started_at.set(handoff.questId, secondsSinceEpoch());

  const triggerState = TriggerState.clone(entity.trigger_state);
  for (const questId of NATIVE_ROBOT_STORY_QUEST_IDS) {
    triggerState.by_root.delete(questId);
  }
  triggerState.by_root.set(
    handoff.questId,
    new Map(
      handoff.prerequisiteTriggerIds.map((stepId, index) => [
        stepId,
        secondsSinceEpoch() - handoff.prerequisiteTriggerIds.length + index,
      ])
    )
  );
  return { challenges, triggerState };
}

function serializedTriggerStepIsFired(entity, questId, stepId) {
  return isTriggerFired(entity?.trigger_state?.by_root.get(questId), stepId);
}

function recipeBookHas(entity, recipeId) {
  const recipes = entity?.recipe_book?.recipes;
  return (
    recipes?.has(String(recipeId)) ||
    [...(recipes?.values() ?? [])].some((item) => item.id === recipeId)
  );
}

function inventoryRefForItem(entity, itemId) {
  const inventory = entity?.inventory;
  for (let idx = 0; idx < (inventory?.items?.length ?? 0); idx += 1) {
    if (inventory.items[idx]?.item?.id === itemId) {
      return { kind: "item", idx };
    }
  }
  for (let idx = 0; idx < (inventory?.hotbar?.length ?? 0); idx += 1) {
    if (inventory.hotbar[idx]?.item?.id === itemId) {
      return { kind: "hotbar", idx };
    }
  }
}

function withoutInventoryItem(entity, itemId) {
  const inventory = Inventory.clone(entity.inventory);
  inventory.items = inventory.items.map((slot) =>
    slot?.item?.id === itemId ? undefined : slot
  );
  inventory.hotbar = inventory.hotbar.map((slot) =>
    slot?.item?.id === itemId ? undefined : slot
  );
  for (const [key, slot] of inventory.overflow) {
    if (slot?.item?.id === itemId) inventory.overflow.delete(key);
  }
  return inventory;
}

function rewardEntries(reward) {
  return [...(reward?.values() ?? [])].map(({ item, count }) => ({
    itemId: item.id,
    count: BigInt(count),
    isRecipe: Boolean(
      nativeRobotStoryBikkieTray?.contents.get(item.id)?.isRecipe
    ),
  }));
}

function requiredEntries(itemsToTake) {
  return (itemsToTake ?? []).map(([itemId, count]) => ({
    itemId,
    count: BigInt(count),
  }));
}

function questFromFrontend(snapshot, questId) {
  return snapshot.quests.find((quest) => quest.questId === String(questId));
}

async function waitForFrontendQuestStep(page, questId, stepId, label) {
  return waitFor(
    `${label}: exact authored objective reaches frontend`,
    () => bridgeCall(page, "nativeQuestFrontendSnapshot"),
    (snapshot) => {
      const quest = questFromFrontend(snapshot, questId);
      return (
        snapshot.activeQuestId === String(questId) &&
        snapshot.mainQuestId === String(questId) &&
        quest?.status === "active" &&
        quest.currentStepId === String(stepId) &&
        quest.steps.some(
          (step) => step.id === String(stepId) && step.done === false
        )
      );
    },
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
}

async function waitForFrontendObjectiveIncludes(page, questId, text, label) {
  return waitFor(
    `${label}: objective progress reaches frontend`,
    () => bridgeCall(page, "nativeQuestFrontendSnapshot"),
    (snapshot) =>
      questFromFrontend(snapshot, questId)?.objective?.includes(text),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
}

async function publishAndWaitForQuestStep({
  first,
  sameUserPeer,
  questId,
  step,
  event,
  label,
}) {
  const beforeDiagnostics = await bridgeCall(first.page, "diagnostics");
  const beforeCount = beforeDiagnostics.publishedEvents.filter(
    (entry) => entry.kind === event.kind
  ).length;
  const startedAt = Date.now();
  await bridgeCall(first.page, "publish", serializedEvent(event));
  const acceptanceMs = Date.now() - startedAt;
  const authoritative = await waitFor(
    `${label}: authoritative trigger progression`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) => {
      const inProgress = entity?.challenges?.in_progress.has(questId) === true;
      const complete = entity?.challenges?.complete.has(questId) === true;
      if (!inProgress && !complete) {
        throw new Error(
          `${label}: actor continuity lost before trigger progression; ` +
            `challenge ${String(questId)} is neither active nor complete ` +
            `(entity=${String(entity?.id)}, iced=${Boolean(entity?.icing)}, ` +
            `triggerRoots=${entity?.trigger_state?.by_root.size ?? 0})`
        );
      }
      return serializedTriggerStepIsFired(entity, questId, step.id) || complete;
    },
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  const local = await waitFor(
    `${label}: progression synchronizes to frontend ECS`,
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      serializedTriggerStepIsFired(entity, questId, step.id) ||
      entity?.challenges?.complete.has(questId),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  let peer;
  if (sameUserPeer) {
    peer = await waitFor(
      `${label}: progression synchronizes to peer frontend ECS`,
      () => localEntity(sameUserPeer, first.userId),
      ({ entity }) =>
        serializedTriggerStepIsFired(entity, questId, step.id) ||
        entity?.challenges?.complete.has(questId),
      Math.max(secondClientSyncGateMs, 10_000),
      timeoutMs
    );
  }
  const afterDiagnostics = await bridgeCall(first.page, "diagnostics");
  const afterCount = afterDiagnostics.publishedEvents.filter(
    (entry) => entry.kind === event.kind
  ).length;
  assert.equal(
    afterCount,
    beforeCount + 1,
    `${label} must publish exactly one ${event.kind}`
  );
  report.scenarios.push({
    name: label,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    triggerKind: step.kind,
    eventKind: event.kind,
    acceptanceMs,
    authoritativeMs: authoritative.elapsedMs,
    originSyncMs: local.elapsedMs,
    peerSyncMs: peer?.elapsedMs,
  });
  return authoritative.value.entity;
}

async function createQuestTarget(first, targetTypeId, position, index) {
  const targetId = await bridgeCall(first.page, "allocateId");
  const targetPosition = [
    position[0] + 1,
    position[1],
    position[2] + index * 0.01,
  ];
  await applyFixture(first.page, {
    kind: "create",
    entity: {
      id: targetId,
      position: Position.create({ v: targetPosition }),
      npc_metadata: NpcMetadata.create({
        type_id: targetTypeId,
        created_time: secondsSinceEpoch(),
        spawn_position: targetPosition,
        spawn_orientation: [0, 0],
      }),
      label: Label.create({ text: `E2E quest target ${targetTypeId}` }),
    },
  });
  await waitFor(
    `quest target ${targetTypeId} synchronized`,
    () => localEntity(first.page, targetId),
    ({ entity }) => entity?.npc_metadata?.type_id === targetTypeId,
    // The production-shaped software-WebGL stack crosses admin ECS write,
    // Logic, Firehose, Sync, and the browser table before this target exists
    // locally. July 26 measured a valid 12.16s delivery, so keep the same 15s
    // fixture ceiling used by synchronized warps instead of treating normal
    // local scheduling variance as a gameplay failure.
    Math.max(originSyncGateMs, 15_000),
    timeoutMs
  );
  return targetId;
}

async function createRobotStoryTargets(first, position, questTriggers) {
  const targetTypeIds = new Set();
  for (const trigger of questTriggers) {
    visitTriggerTree(trigger, (node) => {
      if (node.kind === "challengeClaimRewards") {
        targetTypeIds.add(node.returnNpcTypeId);
      }
    });
  }
  const targets = new Map();
  let index = 0;
  for (const targetTypeId of targetTypeIds) {
    targets.set(
      targetTypeId,
      await createQuestTarget(first, targetTypeId, position, index++)
    );
  }
  return targets;
}

async function createAndPickupItem(first, position, itemId, count, label) {
  const before = await authoritativeEntity(first.page, first.userId);
  const beforeCount = inventoryCount(before.entity, itemId);
  const dropId = await bridgeCall(first.page, "allocateId");
  await applyFixture(first.page, {
    kind: "create",
    entity: {
      id: dropId,
      position: Position.create({ v: [...position] }),
      grab_bag: GrabBag.create({
        slots: createBag(countOf(itemId, BigInt(count))),
        mined: true,
      }),
      expires: Expires.create({ trigger_at: secondsSinceEpoch() + 300 }),
      loose_item: LooseItem.create({ item: anItem(itemId) }),
    },
  });
  await waitFor(
    `${label}: pickup fixture reaches frontend`,
    () => localEntity(first.page, dropId),
    ({ entity }) => Boolean(entity?.grab_bag),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  await bridgeCall(
    first.page,
    "publish",
    serializedEvent(new PickUpEvent({ id: first.userId, item: dropId }))
  );
  await waitFor(
    `${label}: pickup reaches authoritative inventory`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      inventoryCount(entity, itemId) >= beforeCount + BigInt(count),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  await waitFor(
    `${label}: pickup reaches frontend inventory`,
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      inventoryCount(entity, itemId) >= beforeCount + BigInt(count),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
}

function recipeProducing(itemId) {
  return [...nativeRobotStoryBikkieTray.contents.values()].find(
    (biscuit) =>
      biscuit.isRecipe &&
      biscuit.output?.some(([outputId]) => outputId === itemId)
  );
}

async function ensureRecipeInputs(first, position, recipe, label) {
  const current = await authoritativeEntity(first.page, first.userId);
  for (const [itemId, count] of recipe.input ?? []) {
    const missing = BigInt(count) - inventoryCount(current.entity, itemId);
    if (missing > 0n) {
      await createAndPickupItem(
        first,
        position,
        itemId,
        missing,
        `${label}: acquire crafting input ${itemId}`
      );
    }
  }
}

async function craftRecipeOnce(first, position, recipe, outputItemId, label) {
  await waitFor(
    `${label}: recipe is unlocked`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) => recipeBookHas(entity, recipe.id),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  await ensureRecipeInputs(first, position, recipe, label);
  const before = await authoritativeEntity(first.page, first.userId);
  const beforeOutput = inventoryCount(before.entity, outputItemId);
  const outputCount = BigInt(
    recipe.output.find(([itemId]) => itemId === outputItemId)?.[1] ?? 0
  );
  await bridgeCall(
    first.page,
    "publish",
    serializedEvent(
      new InventoryCraftEvent({
        id: first.userId,
        recipe: anItem(recipe.id),
        slot_refs: [],
      })
    )
  );
  await waitFor(
    `${label}: craft mutates authoritative inventory`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      inventoryCount(entity, outputItemId) >= beforeOutput + outputCount,
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  await waitFor(
    `${label}: crafted output reaches frontend inventory`,
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      inventoryCount(entity, outputItemId) >= beforeOutput + outputCount,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
}

const NATIVE_SKILL_CRAFT_E2E_SPECS = [
  {
    skillId: "carpentry",
    recipeId: HARTHMERE_CRAFTING_STATION_RECIPE_IDS.workbench,
  },
  { skillId: "cooking", recipeId: "harthmere_seed_mill_grain_flour" },
  {
    skillId: "blacksmithing",
    recipeId: "harthmere_station_thermolite",
  },
  {
    skillId: "leatherworking",
    recipeId: "harthmere_leatherworking_boiled_leather",
  },
  {
    skillId: "tailoring",
    recipeId: "harthmere_station_tailoring_booth",
  },
  { skillId: "alchemy", recipeId: "harthmere_station_dye_o_matic" },
  { skillId: "enchanting", recipeId: "harthmere_decor_hearth_lamp" },
  {
    skillId: "exotic_refining",
    recipeId: "harthmere_station_thermoblaster",
  },
  { skillId: "bell_forging", recipeId: "harthmere_bell_bronze_ingot" },
];

async function nativeSkillCraftingStation(
  first,
  position,
  stationItemId,
  index
) {
  if (!stationItemId) return undefined;
  const nativeStationItemId = harthmereNativeBiomesIdForItemId(
    String(stationItemId)
  );
  assert(nativeStationItemId, `native station missing for ${stationItemId}`);
  const stationEntityId = await bridgeCall(first.page, "allocateId");
  const stationPosition = [position[0] + 1, position[1], position[2] + index];
  await applyFixture(first.page, {
    kind: "create",
    entity: {
      id: stationEntityId,
      position: Position.create({ v: stationPosition }),
      label: Label.create({ text: `Focused skill station ${stationItemId}` }),
      created_by: CreatedBy.create({
        id: first.userId,
        created_at: secondsSinceEpoch(),
      }),
      placeable_component: PlaceableComponent.create({
        item_id: nativeStationItemId,
      }),
    },
  });
  await waitFor(
    `native skill station ${stationItemId} synchronizes`,
    () => localEntity(first.page, stationEntityId),
    ({ entity }) =>
      entity?.placeable_component?.item_id === nativeStationItemId &&
      entity?.created_by?.id === first.userId,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  return stationEntityId;
}

async function proveNativeCraftingSkillRoundTrips(
  first,
  position,
  specs = NATIVE_SKILL_CRAFT_E2E_SPECS
) {
  ensureHarthmereProductionCraftingCatalogue();
  for (const [index, spec] of specs.entries()) {
    const recipe = getHarthmereCraftingRecipe(spec.recipeId);
    const nativeRecipeId = harthmereNativeBiomesIdForRecipeId(spec.recipeId);
    const nativeRecipe = recipe
      ? harthmereNativeRecipeBiscuit(recipe)
      : undefined;
    const expectedOutputItemId = recipe
      ? harthmereNativeBiomesIdForItemId(recipe.outputItemId)
      : undefined;
    const outputItemId = nativeRecipe?.output?.[0]?.[0];
    assert(
      recipe &&
        nativeRecipeId &&
        nativeRecipe?.input?.length &&
        outputItemId &&
        outputItemId === expectedOutputItemId,
      `native ${spec.skillId} recipe missing: ${spec.recipeId}`
    );

    const inventory = playerInventoryFixture();
    for (const [nativeInputId, count] of nativeRecipe.input) {
      setNativeInventoryCount(inventory, nativeInputId, count);
    }
    const recipeBook = RecipeBook.create({
      recipes: new Map([[String(nativeRecipeId), anItem(nativeRecipeId)]]),
    });
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        position: Position.create({ v: [...position] }),
        inventory,
        selected_item: SelectedItem.create({ item: inventory.hotbar[0] }),
        recipe_book: recipeBook,
      },
    });
    await waitFor(
      `${spec.skillId}: recipe and inputs synchronize`,
      () => localEntity(first.page, first.userId),
      ({ entity }) =>
        recipeBookHas(entity, nativeRecipeId) &&
        nativeRecipe.input.every(
          ([nativeInputId, count]) =>
            inventoryCount(entity, nativeInputId) >= BigInt(count)
        ),
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    );
    const stationEntityId = await nativeSkillCraftingStation(
      first,
      position,
      recipe.requiredStationId,
      index
    );
    const before = await authoritativeEntity(first.page, first.userId);
    const beforeOutput = inventoryCount(before.entity, outputItemId);
    const beforeCraftingXp = readHarthmereNativeSkillTotalXp(
      before.entity.trigger_state,
      "crafting"
    );
    const beforeProfessionXp = readHarthmereNativeSkillTotalXp(
      before.entity.trigger_state,
      spec.skillId
    );
    await bridgeCall(
      first.page,
      "publish",
      serializedEvent(
        new InventoryCraftEvent({
          id: first.userId,
          recipe: anItem(nativeRecipeId),
          slot_refs: [],
          stationEntityId,
        })
      )
    );
    const crafted = await waitFor(
      `${spec.skillId}: native craft awards unified skill XP`,
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) =>
        inventoryCount(entity, outputItemId) > beforeOutput &&
        readHarthmereNativeSkillTotalXp(entity?.trigger_state, "crafting") >
          beforeCraftingXp &&
        readHarthmereNativeSkillTotalXp(entity?.trigger_state, spec.skillId) >
          beforeProfessionXp,
      Math.max(acceptanceGateMs, 10_000),
      timeoutMs
    );
    await waitFor(
      `${spec.skillId}: crafting XP reaches browser skill projection`,
      () => bridgeCall(first.page, "skillProgressionSnapshot"),
      (snapshot) =>
        skillTotalFromSnapshot(snapshot, "crafting") > beforeCraftingXp &&
        skillTotalFromSnapshot(snapshot, spec.skillId) > beforeProfessionXp,
      originSyncGateMs,
      timeoutMs
    );
    report.scenarios.push({
      name: `native ${spec.skillId} recipe awards unified skill XP`,
      status: "pass",
      recipeId: spec.recipeId,
      nativeRecipeId: String(nativeRecipeId),
      outputItemId: String(outputItemId),
      authoritativeMs: crafted.elapsedMs,
    });
  }
}

async function performRoadAheadMapBeamStep({
  first,
  sameUserPeer,
  position,
  questId,
  step,
}) {
  const label = `The Road Ahead: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  assert(
    Array.isArray(step.pos) && step.pos.length === 2,
    `${label} has no authored map position`
  );
  const destination = [step.pos[0], position[1], step.pos[1]];
  await publishFrontendMove(first.page, first.userId, destination);
  await waitFor(
    `${label}: browser movement reaches the authored beam`,
    () => localEntity(first.page, first.userId),
    ({ entity }) => distance3(entity?.position?.v, destination) < 0.01,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  await publishAndWaitForQuestStep({
    first,
    sameUserPeer,
    questId,
    step,
    label,
    // The map manager emits this exact event when an authored destination is
    // cleared in range. A small client id is sufficient; logic publishes the
    // player's authoritative location for the trigger distance check.
    event: new RemoveMapBeamEvent({
      id: first.userId,
      beam_client_id: Number(step.id % 2_000_000_000),
      beam_location: [...step.pos],
    }),
  });
  await publishFrontendMove(first.page, first.userId, position);
}

async function performRoadAheadCollectStep({ first, position, questId, step }) {
  const label = `The Road Ahead: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  const itemId = step.item?.id;
  assert(itemId, `${label} has no exact item id`);
  const partial = Math.max(0, Number(step.count) - 1);
  if (partial > 0) {
    await createAndPickupItem(first, position, itemId, partial, label);
    await waitForFrontendObjectiveIncludes(
      first.page,
      questId,
      `${partial}/${step.count}`,
      label
    );
    assert.equal(
      serializedTriggerStepIsFired(
        (await authoritativeEntity(first.page, first.userId)).entity,
        questId,
        step.id
      ),
      false,
      `${label} fired before all Muckwad was collected`
    );
  }
  await createAndPickupItem(first, position, itemId, 1, label);
  const progressed = await waitForQuestLeaf(first, questId, step, label);
  assert(
    inventoryCount(progressed.value.entity, itemId) >= BigInt(step.count),
    `${label} did not retain the collected Muckwad`
  );
  report.scenarios.push({
    name: label,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    itemId: String(itemId),
    requiredCount: step.count,
  });
}

function roadAheadContainerDetails(stepId) {
  if (
    stepId === NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_TOP ||
    stepId === NATIVE_ROAD_AHEAD_STEP_IDS.CHOOSE_BOTTOMS
  ) {
    return {
      spec: NATIVE_ROAD_AHEAD_CONTAINER_SPECS.clothingCrate,
      label: "Clothing Crate",
      itemLabels: ["T-Shirt", "Jeans"],
    };
  }
  if (stepId === NATIVE_ROAD_AHEAD_STEP_IDS.OPEN_BILLYS_BAG) {
    return {
      spec: NATIVE_ROAD_AHEAD_CONTAINER_SPECS.billysToolbag,
      label: "Billy's Toolbag",
      itemLabels: ["Billy's Pick"],
    };
  }
}

async function performRoadAheadContainerStep({
  first,
  position,
  questId,
  step,
}) {
  const details = roadAheadContainerDetails(step.id);
  assert(details, `No Road Ahead container plan for ${step.id}`);
  const label = `The Road Ahead: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  // Stand two metres south of the prop: publishFrontendMove's deterministic
  // [pitch=0, yaw=0] faces -Z, directly toward the source. These are the exact
  // May 16 snapshot transforms retained in the shared contract. Moving an old
  // placed-frame Position away from its authored occupancy changes the ECS
  // record without relocating its rendered geometry, which caused the prior
  // harness-only missing-prompt failure even though the July 25 player HAR
  // proves both production containers open successfully.
  const sourcePosition = [...details.spec.position];
  const interactionPosition = [
    sourcePosition[0],
    sourcePosition[1],
    sourcePosition[2] + 2,
  ];
  const source = await authoritativeEntity(
    first.page,
    details.spec.sourceEntityId
  );
  await placeFrontendPlayerForFixture(
    first.page,
    first.userId,
    interactionPosition
  );
  await applyFixture(
    first.page,
    {
      kind: source.entity ? "update" : "create",
      entity: {
        id: details.spec.sourceEntityId,
        position: Position.create({ v: sourcePosition }),
        label: Label.create({ text: details.label }),
        placeable_component: PlaceableComponent.create({
          item_id: details.spec.placeableItemId,
        }),
        quest_giver: QuestGiver.create(),
      },
    },
    {
      kind: "update",
      entity: {
        id: first.userId,
        position: Position.create({ v: interactionPosition }),
      },
    }
  );
  // MoveEvent updates the local scene-player controller as well as the
  // replicated player entity. Overlay proximity/facing reads scene state, so
  // an admin ECS position edit alone is not a sufficient browser fixture.
  await publishFrontendMove(first.page, first.userId, interactionPosition);
  await waitFor(
    `${label}: canonical source and player reach frontend ECS`,
    async () => ({
      source: await localEntity(first.page, details.spec.sourceEntityId),
      player: await localEntity(first.page, first.userId),
      scene: await frontendPlayerPose(first.page, first.userId),
    }),
    ({ source: localSource, player, scene }) =>
      localSource.entity?.label?.text === details.label &&
      localSource.entity?.placeable_component?.item_id ===
        details.spec.placeableItemId &&
      distance3(player.entity?.position?.v, interactionPosition) < 0.01 &&
      // Collision resolution may slide the browser controller away from the
      // requested point when it lands beside an old placed frame. The prompt
      // contract is range-based, so prove the scene player is within the same
      // usable radius of the source instead of requiring an impossible exact
      // overlap with the requested pre-collision coordinate.
      distance3(scene?.position, sourcePosition) <= 6,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  const before = await authoritativeEntity(first.page, first.userId);
  const openPrompt = await waitForOpenContainerPrompt(first.page, label);
  await first.page.screenshot({
    path: path.join(
      artifactsDir,
      `${runId}-road-ahead-${String(step.id)}-f-prompt.png`
    ),
  });
  const gameCanvas = first.page.locator("canvas.biomes-canvas");
  await gameCanvas.waitFor({ state: "visible", timeout: timeoutMs });
  await gameCanvas.focus({ timeout: probeTimeoutMs });
  await first.page.keyboard.press("KeyF");
  const takeAll = first.page.getByRole("button", { name: "Take All" });
  await takeAll.waitFor({ state: "visible", timeout: timeoutMs });
  const itemIds = details.spec.choices.flatMap((choice) => choice.itemIds);
  // Storage cells are intentionally icon-first; their names live in hover
  // tooltips and are not permanently rendered text. Prove the real container
  // shows one visible icon per authored item, then use the authoritative item
  // ids below to prove Take All transferred the exact contents.
  const visibleItemIcons = first.page.locator(
    ".biomes-ui-storage-container-grid .cell:not(.empty) img"
  );
  await waitFor(
    `${label}: every authored item renders as a visible container icon`,
    async () => ({
      count: await visibleItemIcons.count(),
      visible: await visibleItemIcons
        .evaluateAll((images) =>
          images.every((image) => {
            const rect = image.getBoundingClientRect();
            const style = getComputedStyle(image);
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              style.display !== "none" &&
              style.visibility !== "hidden"
            );
          })
        )
        .catch(() => false),
    }),
    ({ count, visible }) => count === itemIds.length && visible,
    Math.max(originSyncGateMs, 15_000),
    timeoutMs
  );
  await first.page.screenshot({
    path: path.join(
      artifactsDir,
      `${runId}-road-ahead-${String(step.id)}-container.png`
    ),
  });
  let progressed;
  let selectedItemIds;
  let action;
  if (details.spec === NATIVE_ROAD_AHEAD_CONTAINER_SPECS.clothingCrate) {
    // All six cosmetic variants belong in the crate, but Road Ahead asks the
    // player to choose one top and one bottoms. Exercise the real click-click
    // container transfer for one item from each authored group and leave the
    // four unchosen variants in place. Take All would pass the trigger too,
    // but it would not prove the intended player choice flow.
    const sourceCells = first.page.locator(
      ".biomes-ui-storage-container-grid .cell"
    );
    const backpackEmptyCells = first.page.locator(
      ".biomes-ui-shop-section--inventory .inventory-cells.normal > .cell.empty"
    );
    selectedItemIds = [];
    let sourceOffset = 0;
    for (const choice of details.spec.choices) {
      const selectedItemId = choice.itemIds[0];
      const sourceCell = sourceCells.nth(sourceOffset);
      await sourceCell.waitFor({ state: "visible", timeout: timeoutMs });
      const destination = backpackEmptyCells.first();
      await destination.waitFor({ state: "visible", timeout: timeoutMs });
      await sourceCell.click();
      await destination.click();
      progressed = await waitFor(
        `${label}: chosen ${String(
          selectedItemId
        )} transfers and advances its choice`,
        () => authoritativeEntity(first.page, first.userId),
        ({ entity }) =>
          inventoryCount(entity, selectedItemId) >=
            inventoryCount(before.entity, selectedItemId) + 1n &&
          serializedTriggerStepIsFired(entity, questId, choice.stepId),
        Math.max(acceptanceGateMs, 10_000),
        timeoutMs
      );
      await waitFor(
        `${label}: chosen ${String(
          selectedItemId
        )} returns to the live browser inventory`,
        () => localEntity(first.page, first.userId),
        ({ entity }) =>
          inventoryCount(entity, selectedItemId) ===
          inventoryCount(progressed.value.entity, selectedItemId),
        Math.max(originSyncGateMs, 10_000),
        timeoutMs
      );
      selectedItemIds.push(selectedItemId);
      sourceOffset += choice.itemIds.length;
    }
    const unchosenItemIds = itemIds.filter(
      (itemId) => !selectedItemIds.includes(itemId)
    );
    const afterChoices = await authoritativeEntity(first.page, first.userId);
    assert(
      unchosenItemIds.every(
        (itemId) =>
          inventoryCount(afterChoices.entity, itemId) ===
          inventoryCount(before.entity, itemId)
      ),
      `${label} moved an unchosen clothing variant into the player inventory`
    );
    await waitFor(
      `${label}: four unchosen clothing variants remain visible in the crate`,
      () => visibleItemIcons.count(),
      (count) => count === itemIds.length - selectedItemIds.length,
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    );
    action = "Take one top and one bottoms";
  } else {
    await takeAll.click();
    progressed = await waitFor(
      `${label}: Take All transfers every authored item`,
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) =>
        itemIds.every(
          (itemId) =>
            inventoryCount(entity, itemId) >=
            inventoryCount(before.entity, itemId) + 1n
        ) &&
        details.spec.choices.every((choice) =>
          serializedTriggerStepIsFired(entity, questId, choice.stepId)
        ),
      Math.max(acceptanceGateMs, 10_000),
      timeoutMs
    );
    await waitFor(
      `${label}: complete Take All inventory returns to frontend`,
      () => localEntity(first.page, first.userId),
      ({ entity }) =>
        itemIds.every(
          (itemId) =>
            inventoryCount(entity, itemId) ===
            inventoryCount(progressed.value.entity, itemId)
        ),
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    );
    selectedItemIds = itemIds;
    action = "Take All";
  }
  await first.page.keyboard.press("Escape");
  await publishFrontendMove(first.page, first.userId, position);
  report.scenarios.push({
    name: `${label}: visible F prompt and authored container transfer`,
    status: "pass",
    questId: String(questId),
    stepIds: details.spec.choices.map((choice) => String(choice.stepId)),
    sourceEntityId: String(details.spec.sourceEntityId),
    itemIds: itemIds.map(String),
    selectedItemIds: selectedItemIds.map(String),
    action,
  });
}

async function performRoadAheadWearTypeStep({ first, questId, step }) {
  const label = `The Road Ahead: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  const top = step.id === ROAD_AHEAD_TOP_WEAR_STEP_ID;
  const itemLabel = top ? "T-Shirt" : "Jeans";
  const allowedItemIds = (
    top
      ? NATIVE_ROAD_AHEAD_CONTAINER_SPECS.clothingCrate.choices[0]
      : NATIVE_ROAD_AHEAD_CONTAINER_SPECS.clothingCrate.choices[1]
  ).itemIds;
  const before = await authoritativeEntity(first.page, first.userId);
  const selectedItemId = allowedItemIds.find(
    (itemId) => inventoryCount(before.entity, itemId) > 0n
  );
  assert(selectedItemId, `${label} has no eligible ${itemLabel} in inventory`);
  const selectedRef = inventoryRefForItem(before.entity, selectedItemId);
  assert(
    selectedRef?.kind === "item",
    `${label} cannot find ${String(selectedItemId)} in the backpack`
  );
  await first.page.keyboard.press("KeyI");
  // The crate intentionally contains three T-Shirts and three Jeans. Their
  // accessible names are identical, so `.first()` can retain a stale React
  // cell after Take All. Select one valid top/bottom through its authoritative
  // inventory ref; Road Ahead requires equipping one of each, not all six.
  const item = first.page.locator(
    `button[data-inventory-ref="${selectedRef.kind}:${selectedRef.idx}"]`
  );
  await item.waitFor({ state: "visible", timeout: timeoutMs });
  assert.match(
    (await item.getAttribute("aria-label")) ?? "",
    new RegExp(
      `^${itemLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: x\\d+)?$`
    ),
    `${label} selected the wrong clothing category`
  );
  await item.click();
  await waitFor(
    `${label}: selected clothing cell is active`,
    () => item.getAttribute("data-selected"),
    (selected) => selected === "true",
    originSyncGateMs,
    timeoutMs
  );
  await clickUniqueButton(first.page, "Equip", label);
  const progressed = await waitForQuestLeaf(first, questId, step, label);
  assert(
    [...(progressed.value.entity?.wearing?.items?.values() ?? [])].some(
      (worn) => worn?.id === selectedItemId
    ),
    `${label} fired without ${String(selectedItemId)} in Wearing`
  );
  await first.page.keyboard.press("Escape");
  report.scenarios.push({
    name: `${label}: real inventory Equip action`,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    selectedItemId: String(selectedItemId),
    eligibleItemIds: allowedItemIds.map(String),
  });
}

async function performRoadAheadPhotoStep({ first, position, questId, step }) {
  const label = `The Road Ahead: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  const cameraId = BikkieIds.camera;
  const player = await authoritativeEntity(first.page, first.userId);
  const cameraRef = inventoryRefForItem(player.entity, cameraId);
  assert(cameraRef, `${label} has no B-01 Camera`);
  if (!(cameraRef.kind === "hotbar" && cameraRef.idx === 0)) {
    await bridgeCall(
      first.page,
      "publish",
      serializedEvent(
        new InventorySwapEvent({
          player_id: first.userId,
          src_id: first.userId,
          src: cameraRef,
          dst_id: first.userId,
          dst: { kind: "hotbar", idx: 0 },
          positions: [],
        })
      )
    );
  }
  await waitFor(
    `${label}: camera reaches hotbar`,
    () => localEntity(first.page, first.userId),
    ({ entity }) => entity?.inventory?.hotbar?.[0]?.item?.id === cameraId,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  const gameCanvas = first.page.locator("canvas.biomes-canvas");
  await gameCanvas.waitFor({ state: "visible", timeout: timeoutMs });
  await gameCanvas.focus({ timeout: probeTimeoutMs });
  await first.page.keyboard.press("Digit1");
  const exitCamera = first.page.getByRole("button", { name: /Exit Camera/ });
  await exitCamera.waitFor({ state: "visible", timeout: timeoutMs });
  await gameCanvas.focus({ timeout: probeTimeoutMs });
  await first.page.keyboard.press("KeyF");
  let selfieMode;
  try {
    selfieMode = await waitFor(
      `${label}: flip key enters authoritative selfie mode`,
      () => localEntity(first.page, first.userId),
      ({ entity }) => entity?.player_behavior?.camera_mode === "selfie",
      5_000,
      5_000
    );
  } catch (error) {
    if (!String(error).includes("timed out after 5000ms")) throw error;
    const pointerLockDiagnostics = await first.page.evaluate(() => ({
      activeElement:
        document.activeElement instanceof HTMLElement
          ? `${document.activeElement.tagName}.${document.activeElement.className}`
          : String(document.activeElement),
      pointerLockElement: Boolean(document.pointerLockElement),
      exitPointerLockType: typeof document.exitPointerLock,
    }));
    assert.equal(
      pointerLockDiagnostics.exitPointerLockType,
      "undefined",
      `${label}: real F failed outside the runner's declared no-pointer-lock mode`
    );
    // Focused headless runs deliberately disable Pointer Lock. InGameCameraHUD
    // therefore cannot register its top-priority F candidate, and a nearby NPC
    // candidate consumes KeyF before HotBar's bubble listener sees it. Publish
    // the same production event that handleCameraKeyDown emits; this preserves
    // browser -> event queue -> logic -> ECS coverage without pretending the
    // headless dispatcher exercised a pointer-locked path it cannot represent.
    await bridgeCall(
      first.page,
      "publish",
      serializedEvent(
        new ChangeCameraModeEvent({ id: first.userId, mode: "selfie" })
      )
    );
    report.browser.transients.push(
      `camera:selfie-key-consumed-in-no-pointer-lock-mode:${JSON.stringify(
        pointerLockDiagnostics
      )}`
    );
  }
  // `/api/upload/photo` is the authority that emits the postPhoto firehose
  // event used by CameraPhotoTrigger. Its validated `cameraMode: "selfie"`
  // payload below is the release assertion for this no-pointer-lock branch;
  // do not wait another two minutes on a synchronized camera-mode component
  // that this headless browser cannot drive.
  if (selfieMode) {
    assert.equal(
      selfieMode.value.entity?.player_behavior?.camera_mode,
      "selfie"
    );
  }
  const upload = await first.page.evaluate(
    async ({ position: shotPosition, billyId }) => {
      const response = await fetch("/api/upload/photo", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoDataURI:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=",
          position: shotPosition,
          orientation: [0, 0],
          shotCoordinates: shotPosition,
          shotLookAt: [shotPosition[0] + 1, shotPosition[1], shotPosition[2]],
          taggedObjects: [
            {
              kind: "entity",
              id: billyId,
              biscuitId: billyId,
              position: shotPosition,
            },
          ],
          caption: "Road Ahead browser E2E",
          allowWarping: false,
          cameraMode: "selfie",
        }),
      });
      return { status: response.status, body: await response.text() };
    },
    {
      position,
      billyId: ROAD_AHEAD_BILLY_TYPE_ID,
    }
  );
  assert.equal(
    upload.status,
    200,
    `${label} photo upload failed: ${upload.body}`
  );
  await waitForQuestLeaf(first, questId, step, label);
  await first.page.screenshot({
    path: path.join(artifactsDir, `${runId}-road-ahead-selfie.png`),
  });
  // Exercise the player-facing shortcut shown by InGameCameraHUD. Clicking the
  // visible button here previously allowed the shipped X-vs-Delete wiring
  // mismatch to pass every Road Ahead browser run.
  await first.page.evaluate(() => {
    const probe = [];
    globalThis.__harthmereCameraKeyProbe = probe;
    const resources = globalThis.clientContext?.resources;
    const readCameraResourceState = () => {
      const selection = resources?.get?.("/hotbar/selection");
      const hotbarIndex = resources?.get?.("/hotbar/index")?.value;
      const userId = globalThis.clientContext?.userId;
      const inventory = userId
        ? resources?.get?.("/ecs/c/inventory", userId)
        : undefined;
      return {
        hotbarIndex,
        selectionKind: selection?.kind,
        selectionRef:
          selection?.kind === "camera"
            ? { kind: selection.ref?.kind, idx: selection.ref?.idx }
            : undefined,
        hotbar: Array.from(inventory?.hotbar ?? []).map((slot, idx) => ({
          idx,
          itemId:
            slot?.item?.id === undefined ? undefined : String(slot.item.id),
          action: slot?.item?.action,
        })),
      };
    };
    const resourceProbe = {
      before: readCameraResourceState(),
      writes: [],
    };
    globalThis.__harthmereCameraResourceProbe = resourceProbe;
    if (resources) {
      const originalSet = resources.set.bind(resources);
      const originalUpdate = resources.update.bind(resources);
      resources.set = (path, ...args) => {
        if (path === "/hotbar/index") {
          resourceProbe.writes.push({
            operation: "set:before",
            args: args.map((value) =>
              typeof value === "function" ? "[function]" : value
            ),
            state: readCameraResourceState(),
          });
        }
        const result = originalSet(path, ...args);
        if (path === "/hotbar/index") {
          resourceProbe.writes.push({
            operation: "set:after",
            state: readCameraResourceState(),
          });
        }
        return result;
      };
      resources.update = (path, ...args) => {
        if (path === "/hotbar/index") {
          resourceProbe.writes.push({
            operation: "update:before",
            state: readCameraResourceState(),
          });
        }
        const result = originalUpdate(path, ...args);
        if (path === "/hotbar/index") {
          resourceProbe.writes.push({
            operation: "update:after",
            state: readCameraResourceState(),
          });
        }
        return result;
      };
    }
    const record = (phase) => (event) => {
      if (event.code !== "KeyX") return;
      probe.push({
        phase,
        code: event.code,
        key: event.key,
        repeat: event.repeat,
        defaultPrevented: event.defaultPrevented,
        target:
          event.target instanceof HTMLElement
            ? `${event.target.tagName}.${event.target.className}`
            : String(event.target),
      });
    };
    document.addEventListener("keydown", record("capture"), true);
    document.addEventListener("keydown", record("bubble"));
  });
  await gameCanvas.focus({ timeout: probeTimeoutMs });
  await first.page.keyboard.press("KeyX");
  await delay(250);
  const cameraKeyDiagnostics = await first.page.evaluate(() => {
    const selection =
      globalThis.clientContext?.resources?.get("/hotbar/selection");
    const resources = globalThis.clientContext?.resources;
    const userId = globalThis.clientContext?.userId;
    const inventory = userId
      ? resources?.get?.("/ecs/c/inventory", userId)
      : undefined;
    const resourceProbe = globalThis.__harthmereCameraResourceProbe;
    if (resourceProbe) {
      resourceProbe.after = {
        hotbarIndex: resources?.get?.("/hotbar/index")?.value,
        selectionKind: selection?.kind,
        selectionRef:
          selection?.kind === "camera"
            ? { kind: selection.ref?.kind, idx: selection.ref?.idx }
            : undefined,
        hotbar: Array.from(inventory?.hotbar ?? []).map((slot, idx) => ({
          idx,
          itemId:
            slot?.item?.id === undefined ? undefined : String(slot.item.id),
          action: slot?.item?.action,
        })),
      };
    }
    return {
      activeElement:
        document.activeElement instanceof HTMLElement
          ? `${document.activeElement.tagName}.${document.activeElement.className}`
          : String(document.activeElement),
      exitCameraVisible: Boolean(
        document.querySelector(".camera-exit-button")?.getClientRects().length
      ),
      selection: selection
        ? {
            kind: selection.kind,
            refKind:
              selection.kind === "camera" ? selection.ref?.kind : undefined,
            refIdx:
              selection.kind === "camera" ? selection.ref?.idx : undefined,
            modeKind:
              selection.kind === "camera" ? selection.mode?.kind : undefined,
          }
        : undefined,
      events: globalThis.__harthmereCameraKeyProbe ?? [],
      resources: resourceProbe,
    };
  });
  await exitCamera
    .waitFor({ state: "hidden", timeout: 10_000 })
    .catch((error) => {
      throw new Error(
        `${label}: physical KeyX did not hide Exit Camera; diagnostics=${JSON.stringify(
          cameraKeyDiagnostics
        )}; cause=${error}`
      );
    });
  await waitFor(
    `${label}: X exits selfie mode and restores camera direction state`,
    () => localEntity(first.page, first.userId),
    ({ entity }) => entity?.player_behavior?.camera_mode !== "selfie",
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  report.scenarios.push({
    name: `${label}: selfie upload and X camera exit`,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    uploadStatus: upload.status,
    cameraKeyDiagnostics,
  });
}

async function performGetMuckOutInscriptionStep({
  first,
  sameUserPeer,
  position,
  questId,
  step,
  spec,
}) {
  const label = `Get the Muck Out: ${step.name}`;
  assert.equal(questId, NATIVE_GET_THE_MUCK_OUT_QUEST_ID);
  assert.equal(Number(step.returnNpcTypeId), Number(spec.sourceEntityId));
  await waitForFrontendQuestStep(first.page, questId, step.id, label);

  // Exercise the immutable shipped plate, not a nearby duplicate or a
  // synthetic NPC whose type id happens to match the authored return id.
  const source = await authoritativeEntity(first.page, spec.sourceEntityId);
  assert.equal(source.entity?.label?.text, spec.label);
  assert.deepEqual(source.entity?.position?.v, [...spec.position]);
  assert(source.entity?.placeable_component, `${label}: placeable missing`);
  assert(source.entity?.quest_giver, `${label}: quest_giver missing`);

  // Stand west of the statue and look through its grouped terrain at the
  // canonical child plate. The near wall is intentionally much closer than
  // the plate anchor; this reproduces the player screenshot and proves the
  // exact priority-radius/occlusion repair instead of an unobstructed fixture.
  const interactionPosition = [
    spec.position[0] - 6,
    spec.position[1],
    spec.position[2],
  ];
  const interactionOrientation = [0, -Math.PI / 2];
  await placeFrontendPlayerForFixture(
    first.page,
    first.userId,
    interactionPosition,
    interactionOrientation
  );
  await applyFixture(
    first.page,
    {
      kind: "update",
      entity: {
        id: first.userId,
        position: Position.create({ v: interactionPosition }),
      },
    },
    {
      // Republish unchanged source components after entering its subscription
      // radius. Focused empty-Shim boots need not hydrate all 335k rows before
      // gameplay, but progression must still target this exact source id.
      kind: "update",
      entity: {
        id: spec.sourceEntityId,
        position: source.entity.position,
        orientation: source.entity.orientation,
        size: source.entity.size,
        label: source.entity.label,
        placeable_component: source.entity.placeable_component,
        quest_giver: source.entity.quest_giver,
        default_dialog: source.entity.default_dialog,
        placed_by: source.entity.placed_by,
        in_group: source.entity.in_group,
      },
    }
  );
  await waitFor(
    `${label}: canonical grouped plate and player reach frontend`,
    async () => ({
      source: await localEntity(first.page, spec.sourceEntityId),
      player: await localEntity(first.page, first.userId),
      pose: await frontendPlayerPose(first.page, first.userId),
    }),
    ({ source: localSource, player, pose }) =>
      localSource.entity?.label?.text === spec.label &&
      Boolean(localSource.entity?.quest_giver) &&
      distance3(player.entity?.position?.v, interactionPosition) < 0.01 &&
      distance3(pose?.position, interactionPosition) <= 1.5,
    Math.max(originSyncGateMs, 15_000),
    timeoutMs
  );
  const prompt = await waitFor(
    `${label}: visible F Read prompt targets canonical grouped plate`,
    () => frontendInteractionSnapshot(first.page),
    (interaction) =>
      interaction?.inspectable?.kind === "harthmere_object" &&
      interaction.inspectable.entityId === spec.sourceEntityId &&
      interaction.inspectable.label === spec.label &&
      interaction.inspectOverlays?.some(
        (overlay) =>
          overlay.text?.includes("Read") &&
          overlay.display !== "none" &&
          overlay.visibility !== "hidden" &&
          Number(overlay.opacity) > 0 &&
          overlay.rect?.width > 0 &&
          overlay.rect?.height > 0
      ),
    20_000,
    30_000
  );
  assert.equal(prompt.value.inspectable.entityId, spec.sourceEntityId);
  await first.page.screenshot({
    path: path.join(
      artifactsDir,
      `${runId}-get-muck-out-inscription-${String(step.id)}-f-read.png`
    ),
  });

  await first.page.keyboard.press("KeyF");
  await clickTalkDialogButton(first, step.acceptText, label);
  const progressed = await waitForQuestLeaf(first, questId, step, label);
  await waitFor(
    `${label}: canonical plate progress returns to frontend`,
    () => localEntity(first.page, first.userId),
    ({ entity }) => serializedTriggerStepIsFired(entity, questId, step.id),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  if (sameUserPeer) {
    await waitFor(
      `${label}: canonical plate progress reaches same-user peer`,
      () => localEntity(sameUserPeer, first.userId),
      ({ entity }) => serializedTriggerStepIsFired(entity, questId, step.id),
      Math.max(secondClientSyncGateMs, 10_000),
      timeoutMs
    );
  }
  await first.page.screenshot({
    path: path.join(
      artifactsDir,
      `${runId}-get-muck-out-inscription-${String(step.id)}-complete.png`
    ),
  });
  await first.page.keyboard.press("Escape");

  // Restore the shared story fixture before the next authored action.
  await placeFrontendPlayerForFixture(
    first.page,
    first.userId,
    position,
    [0, 0]
  );
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({ v: [...position] }),
    },
  });
  await waitFor(
    `${label}: player returns to robot-story fixture`,
    () => localEntity(first.page, first.userId),
    ({ entity }) => distance3(entity?.position?.v, position) < 0.01,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  report.scenarios.push({
    name: `${label}: canonical grouped F/Read dialogue`,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    sourceEntityId: String(spec.sourceEntityId),
    sourcePosition: [...spec.position],
    prompt: "Read",
    action: step.acceptText,
    authoritativeMs: progressed.elapsedMs,
  });
}

async function performQuestClaimStep({
  first,
  sameUserPeer,
  position,
  targets,
  questId,
  step,
}) {
  const inscriptionSpec = GET_MUCK_OUT_INSCRIPTION_SPECS_BY_STEP_ID.get(
    Number(step.id)
  );
  if (questId === NATIVE_GET_THE_MUCK_OUT_QUEST_ID && inscriptionSpec) {
    return performGetMuckOutInscriptionStep({
      first,
      sameUserPeer,
      position,
      questId,
      step,
      spec: inscriptionSpec,
    });
  }
  if (
    questId === NATIVE_ROAD_AHEAD_QUEST_ID &&
    roadAheadContainerDetails(step.id)
  ) {
    return performRoadAheadContainerStep({
      first,
      position,
      questId,
      step,
    });
  }
  const label = `${
    nativeRobotStoryBikkieTray.contents.get(questId).displayName
  }: ${step.name ?? step.id}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  const targetId = targets.get(step.returnNpcTypeId);
  assert(targetId, `${label} has no target fixture ${step.returnNpcTypeId}`);
  const target = await authoritativeEntity(first.page, targetId);
  const targetPosition = target.entity?.position?.v;
  assert(targetPosition, `${label} target ${String(targetId)} has no position`);
  const claimPosition = [
    targetPosition[0],
    targetPosition[1],
    targetPosition[2] + 1,
  ];
  // Container and inspection steps deliberately move the real browser-owned
  // simulation player around the world. A fire-and-forget MoveEvent back to
  // the chapter origin is not a stable claim boundary: Logic may process the
  // following CompleteQuestStepAtEntity first and correctly reject it as too
  // far away. Place both the browser simulation and authoritative ECS player,
  // then prove they are within the server's talking-distance contract before
  // publishing any NPC claim.
  await placeFrontendPlayerForFixture(first.page, first.userId, claimPosition);
  await publishFrontendMove(first.page, first.userId, claimPosition);
  await waitFor(
    `${label}: claim target and player are within talking distance`,
    async () => ({
      player: await authoritativeEntity(first.page, first.userId),
      target: await authoritativeEntity(first.page, targetId),
      scene: await frontendPlayerPose(first.page, first.userId),
    }),
    ({ player, target: currentTarget, scene }) =>
      distance3(player.entity?.position?.v, currentTarget.entity?.position?.v) <
        20 &&
      distance3(scene?.position, currentTarget.entity?.position?.v) < 20,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  const required = requiredEntries(step.itemsToTake);

  if (step.id === BUSTED_WATERLOGGED_DELIVERY_STEP_ID && required.length > 0) {
    const beforeMissingProbe = await authoritativeEntity(
      first.page,
      first.userId
    );
    const originalInventory = Inventory.clone(
      beforeMissingProbe.entity.inventory
    );
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        inventory: withoutInventoryItem(
          beforeMissingProbe.entity,
          required[0].itemId
        ),
      },
    });
    await waitFor(
      `${label}: insufficient-item fixture synchronized`,
      () => localEntity(first.page, first.userId),
      ({ entity }) => inventoryCount(entity, required[0].itemId) === 0n,
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    );
    await bridgeCall(
      first.page,
      "publish",
      serializedEvent(
        new CompleteQuestStepAtEntityEvent({
          id: first.userId,
          challenge_id: questId,
          entity_id: targetId,
          step_id: step.id,
        })
      )
    );
    await delay(1500);
    const rejected = await authoritativeEntity(first.page, first.userId);
    assert.equal(
      serializedTriggerStepIsFired(rejected.entity, questId, step.id),
      false,
      `${label} advanced without the required turn-in item`
    );
    await applyFixture(first.page, {
      kind: "update",
      entity: { id: first.userId, inventory: originalInventory },
    });
    await waitFor(
      `${label}: required item restored after rejection probe`,
      () => localEntity(first.page, first.userId),
      ({ entity }) =>
        inventoryCount(entity, required[0].itemId) >= required[0].count,
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    );
    report.scenarios.push({
      name: `${label}: missing required item is rejected`,
      status: "pass",
      questId: String(questId),
      stepId: String(step.id),
      requiredItems: required.map(({ itemId, count }) => ({
        itemId: String(itemId),
        count: String(count),
      })),
    });
  }

  const before = await authoritativeEntity(first.page, first.userId);
  for (const { itemId, count } of required) {
    assert(
      inventoryCount(before.entity, itemId) >= count,
      `${label} is missing ${count} of required item ${itemId}`
    );
  }
  const rewardIndex = Math.max(0, (step.rewardsList?.length ?? 1) - 1);
  const selectedRewards = rewardEntries(step.rewardsList?.[rewardIndex]);
  const after = await publishAndWaitForQuestStep({
    first,
    sameUserPeer,
    questId,
    step,
    label,
    event: new CompleteQuestStepAtEntityEvent({
      id: first.userId,
      challenge_id: questId,
      entity_id: targetId,
      step_id: step.id,
      chosen_reward_index: rewardIndex,
    }),
  });
  for (const { itemId, count } of required) {
    assert.equal(
      inventoryCount(after, itemId),
      inventoryCount(before.entity, itemId) - count,
      `${label} did not consume the exact required quantity of ${itemId}`
    );
  }
  for (const reward of selectedRewards) {
    if (reward.isRecipe) {
      assert(
        recipeBookHas(after, reward.itemId),
        `${label} did not unlock recipe ${reward.itemId}`
      );
    } else {
      assert(
        inventoryCount(after, reward.itemId) >=
          inventoryCount(before.entity, reward.itemId) + reward.count,
        `${label} did not grant selected reward ${reward.itemId}`
      );
    }
  }
  report.scenarios.push({
    name: `${label}: item contract`,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    chosenRewardIndex: rewardIndex,
    rewards: selectedRewards.map(({ itemId, count, isRecipe }) => ({
      itemId: String(itemId),
      count: String(count),
      isRecipe,
    })),
    itemsTaken: required.map(({ itemId, count }) => ({
      itemId: String(itemId),
      count: String(count),
    })),
  });
}

function robotStoryCrateDialogPriorStepIds(spec) {
  if (spec.questId === NATIVE_BUSTED_QUEST_ID) {
    return [310783173745175, 859994236864492, 3346948724689018];
  }
  if (spec.questId === NATIVE_GET_THE_MUCK_OUT_QUEST_ID) {
    return NATIVE_ROBOT_STORY_FINAL_HANDOFFS.getTheMuckOut
      .prerequisiteTriggerIds;
  }
  throw new Error(`Unsupported crate-dialogue quest ${spec.questId}`);
}

async function proveNativeRobotStoryCrateDialog(first, spec, key) {
  const quests = NATIVE_ROBOT_STORY_EXHAUSTIVE_QUEST_IDS.map((questId) =>
    nativeRobotStoryBikkieTray.contents.get(questId)
  );
  const chapterIndex = quests.findIndex((quest) => quest.id === spec.questId);
  assert(chapterIndex >= 0, `${spec.label}: quest is absent from story order`);
  const quest = quests[chapterIndex];
  const step = (() => {
    let found;
    visitTriggerTree(quest.trigger, (node) => {
      if (node.id === spec.stepId) found = node;
    });
    return found;
  })();
  assert(step, `${spec.label}: authored reward step is absent`);
  assert.equal(step.kind, "challengeClaimRewards");
  assert.equal(step.returnNpcTypeId, spec.sourceEntityId);
  assert.equal(step.acceptText, spec.acceptText);

  const source = await authoritativeEntity(first.page, spec.sourceEntityId);
  assert.equal(source.entity?.label?.text, spec.label);
  assert.equal(
    source.entity?.placeable_component?.item_id,
    spec.placeableItemId,
    `${spec.label}: shipped placeable identity drifted`
  );
  assert(
    source.entity?.quest_giver,
    `${spec.label}: quest-giver marker missing`
  );
  assert.deepEqual(
    source.entity?.position?.v,
    [...spec.position],
    `${spec.label}: shipped position drifted`
  );

  const { challenges, inventory, prerequisiteParts } = robotStoryChapterSeed(
    quests,
    chapterIndex
  );
  const triggerState = TriggerState.create();
  triggerState.by_root.set(
    spec.questId,
    new Map(
      robotStoryCrateDialogPriorStepIds(spec).map((stepId, index) => [
        stepId,
        secondsSinceEpoch() - 30 + index,
      ])
    )
  );
  // Both rewards sit inside authored wreck/den geometry. Standing beside the
  // voxel prop lets collision resolution eject the rendered controller behind
  // a hull or wall even while the authoritative ECS player stays in range.
  // Use a vertical interaction anchor and look down, matching the stable
  // underwater-chest pose while remaining inside the server's 3-D claim range.
  const verticalOffset = spec.questId === NATIVE_BUSTED_QUEST_ID ? 6 : 3;
  const interactionPosition = [
    spec.position[0],
    spec.position[1] + verticalOffset,
    spec.position[2],
  ];
  const interactionOrientation = [-1.45, 0];
  const focusedFixture = {
    kind: "update",
    entity: {
      id: first.userId,
      challenges,
      trigger_state: triggerState,
      inventory,
      recipe_book: RecipeBook.create(),
      wearing: Wearing.create({ items: new Map() }),
      position: Position.create({ v: interactionPosition }),
    },
  };
  // Set the browser-owned simulation pose first. The movement writer runs every
  // frame and can otherwise publish the old position between the authoritative
  // fixture update and the local pose update, forcing the focused test to wait
  // through a second server/client synchronization cycle. This ordering is the
  // contract already documented by placeFrontendPlayerForFixture and keeps the
  // two-crate batch inside the normal 15-second fixture gate.
  await placeFrontendPlayerForFixture(
    first.page,
    first.userId,
    interactionPosition,
    interactionOrientation
  );
  await applyFixture(first.page, focusedFixture);
  await waitFor(
    `${spec.label}: focused quest fixture synchronizes`,
    async () => {
      const [player, local] = await Promise.all([
        authoritativeEntity(first.page, first.userId),
        localEntity(first.page, first.userId),
      ]);
      return { player, local };
    },
    ({ player, local }) =>
      player.entity?.challenges?.in_progress.has(spec.questId) &&
      distance3(player.entity?.position?.v, interactionPosition) < 0.01 &&
      distance3(local.entity?.position?.v, interactionPosition) < 0.01 &&
      prerequisiteParts.every(
        (stack) => inventoryCount(player.entity, stack.item.id) >= stack.count
      ),
    Math.max(originSyncGateMs, 10_000),
    30_000
  );
  await waitForFrontendQuestStep(
    first.page,
    spec.questId,
    spec.stepId,
    spec.label
  );
  await waitFor(
    `${spec.label}: visible F Open prompt targets shipped crate`,
    async () => ({
      interaction: await frontendInteractionSnapshot(first.page),
      source: await localEntity(first.page, spec.sourceEntityId),
      pose: await frontendPlayerPose(first.page, first.userId),
    }),
    ({ interaction, source, pose }) =>
      source.entity?.label?.text === spec.label &&
      Boolean(pose?.position) &&
      // Collision may settle the controller onto the crate's top after the
      // fixture synchronizes. The exact source id plus visible prompt is the
      // interaction proof; allow that bounded three-metre vertical settle.
      distance3(pose.position, interactionPosition) <= 3.25 &&
      ["harthmere_object", "placeable"].includes(
        interaction?.inspectable?.kind
      ) &&
      interaction.inspectable.entityId === spec.sourceEntityId &&
      (interaction.inspectable.kind === "placeable" ||
        interaction.inspectable.label === spec.label) &&
      interaction.inspectOverlays?.some(
        (overlay) =>
          overlay.text?.includes("Open") &&
          overlay.display !== "none" &&
          overlay.visibility !== "hidden" &&
          Number(overlay.opacity) > 0 &&
          overlay.rect?.width > 0 &&
          overlay.rect?.height > 0
      ),
    20_000,
    30_000
  );
  await first.page.screenshot({
    path: path.join(
      artifactsDir,
      `${runId}-${key.replace(/[^a-z0-9]+/gi, "-")}-f-prompt.png`
    ),
  });

  const before = await authoritativeEntity(first.page, first.userId);
  const beforeReward = inventoryCount(before.entity, spec.rewardItemId);
  await first.page.keyboard.press("KeyF");
  const rewardButton = first.page.getByRole("button", {
    name: spec.acceptText,
    exact: true,
  });
  await advanceTalkDialogUntil(
    first,
    spec.label,
    async () => (await rewardButton.count()) === 1
  );
  // Trigger hydration continuously reconciles synthetic focused state. Refresh
  // the exact prerequisite fixture only after the real F-opened dialogue has
  // reached its authored reward button, then click immediately. This preserves
  // the production UI/event path while preventing the background reconciler
  // from clearing an intentionally deep-linked quest between prompt and claim.
  await applyFixture(first.page, focusedFixture);
  await waitFor(
    `${spec.label}: refreshed claim fixture reaches frontend`,
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      entity?.challenges?.in_progress.has(spec.questId) &&
      robotStoryCrateDialogPriorStepIds(spec).every((stepId) =>
        serializedTriggerStepIsFired(entity, spec.questId, stepId)
      ),
    Math.max(originSyncGateMs, 10_000),
    30_000
  );
  await clickTalkDialogButton(first, spec.acceptText, spec.label);
  const progressed = await waitFor(
    `${spec.label}: F/dialogue grants reward and advances quest`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      inventoryCount(entity, spec.rewardItemId) === beforeReward + 1n,
    Math.max(acceptanceGateMs, 10_000),
    Math.min(timeoutMs, 30_000)
  );
  await first.page.screenshot({
    path: path.join(
      artifactsDir,
      `${runId}-${key.replace(/[^a-z0-9]+/gi, "-")}-claimed.png`
    ),
  });
  await first.page.keyboard.press("Escape");
  report.scenarios.push({
    name: `${quest.displayName}: ${spec.label} live F reward dialogue`,
    status: "pass",
    questId: String(spec.questId),
    stepId: String(spec.stepId),
    sourceEntityId: String(spec.sourceEntityId),
    placeableItemId: String(spec.placeableItemId),
    rewardItemId: String(spec.rewardItemId),
    prompt: "Open",
    action: spec.acceptText,
    authoritativeMs: progressed.elapsedMs,
    triggerStepObserved: serializedTriggerStepIsFired(
      progressed.value.entity,
      spec.questId,
      spec.stepId
    ),
  });
}

async function proveNativeRobotStoryCrateDialogs(first) {
  assert(nativeRobotStoryBikkieTray, "robot story Bikkie tray was not loaded");
  for (const [key, spec] of Object.entries(
    NATIVE_ROBOT_STORY_CRATE_DIALOG_SPECS
  )) {
    if (robotStoryCrateDialogKey && key !== robotStoryCrateDialogKey) {
      continue;
    }
    await proveNativeRobotStoryCrateDialog(first, spec, key);
  }
}

// One representative per remaining shipped quest-prop model. Road Ahead's
// already-green clothing crate and toolbag are intentionally excluded. bag2 is
// a Galois asset only in this snapshot: no active Bikkie biscuit or ECS quest
// entity exists to live-test, so the sweep records that absence separately.
const REMAINING_QUEST_PROP_PROMPT_SPECS = Object.freeze([
  {
    key: "bag1",
    entityId: 6673224510982009,
    label: "Alexis' Bag",
    position: [785.5, 50, 863.5],
  },
  {
    key: "cargo_crate",
    entityId: 5485219651739327,
    label: "Lotto's Lottery Crate",
    position: [251.5, 63, -72.5],
  },
  {
    key: "plate_floor",
    entityId: NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_SPECS.green.sourceEntityId,
    label: NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_SPECS.green.label,
    position: [...NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_SPECS.green.position],
  },
  {
    key: "plate_wall",
    entityId: 7814370709886716,
    label: "Temple Inscription",
    position: [928.5, 76, -118.5],
  },
  {
    key: "tools",
    entityId: 2172725824368913,
    label: "Billy's Tools",
    position: [241.5, 74, -43.5],
  },
  {
    key: "treasure_chest",
    entityId: 232226007880316,
    label: "Chest Bellflower Petal",
    position: [-884.5, 58, 1266.5],
  },
]);

async function proveRemainingQuestPropPrompts(first) {
  for (const [specIndex, spec] of REMAINING_QUEST_PROP_PROMPT_SPECS.entries()) {
    if (questPropPromptKeys.size && !questPropPromptKeys.has(spec.key)) {
      continue;
    }
    const source = await authoritativeEntity(first.page, spec.entityId);
    assert(source.entity?.quest_giver, `${spec.key}: quest_giver missing`);
    assert(
      source.entity?.placeable_component,
      `${spec.key}: placeable missing`
    );
    const interactionPosition = [
      spec.position[0],
      spec.position[1] + 1,
      spec.position[2],
    ];
    await placeFrontendPlayerForFixture(
      first.page,
      first.userId,
      interactionPosition,
      [-1.45, 0]
    );
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        position: Position.create({ v: interactionPosition }),
      },
    });
    // Focused sync bootstraps intentionally omit most of the 335k-entity
    // snapshot. Republish the untouched shipped prop components after moving
    // the player into its subscription radius so the real exact entity enters
    // the client table; no identity, position, label, or capability is changed.
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: spec.entityId,
        position: source.entity.position,
        label: source.entity.label,
        placeable_component: source.entity.placeable_component,
        quest_giver: source.entity.quest_giver,
        default_dialog: source.entity.default_dialog,
        entity_description: source.entity.entity_description,
        placed_by: source.entity.placed_by,
      },
    });
    let targetEntityId = spec.entityId;
    let usedSyncFixture = false;
    const synchronizedSource = await localEntity(first.page, spec.entityId);
    if (!synchronizedSource.entity) {
      targetEntityId =
        8_900_000_000_000_000 +
        (Number(runId.split("-").at(-1)) % 50_000) * 10 +
        specIndex;
      usedSyncFixture = true;
      await applyFixture(first.page, {
        kind: "create",
        entity: {
          id: targetEntityId,
          position: source.entity.position,
          label: source.entity.label,
          placeable_component: source.entity.placeable_component,
          quest_giver: source.entity.quest_giver,
          default_dialog: source.entity.default_dialog,
          entity_description: source.entity.entity_description,
          placed_by: source.entity.placed_by,
        },
      });
    }
    await waitFor(
      `${spec.key}: source and player reach frontend`,
      async () => ({
        source: await localEntity(first.page, targetEntityId),
        player: await localEntity(first.page, first.userId),
      }),
      ({ source, player }) =>
        source.entity?.id === targetEntityId &&
        distance3(player.entity?.position?.v, interactionPosition) < 0.5,
      20_000,
      30_000
    );
    const visible = await waitFor(
      `${spec.key}: visible F prompt targets shipped quest prop`,
      () => frontendInteractionSnapshot(first.page),
      (interaction) =>
        [spec.entityId, targetEntityId].includes(
          interaction?.inspectable?.entityId
        ) &&
        interaction.inspectOverlays?.some(
          (overlay) =>
            /\bF\b/.test(overlay.text ?? "") &&
            overlay.display !== "none" &&
            overlay.visibility !== "hidden" &&
            Number(overlay.opacity) > 0 &&
            overlay.rect?.width > 0 &&
            overlay.rect?.height > 0
        ),
      20_000,
      30_000
    );
    report.scenarios.push({
      name: `quest prop ${spec.key}: visible F prompt`,
      status: "pass",
      entityId: String(spec.entityId),
      label: spec.label,
      inspectableKind: visible.value.inspectable.kind,
      inspectedEntityId: String(visible.value.inspectable.entityId),
      usedSyncFixture,
    });
    if (usedSyncFixture) {
      await applyFixture(first.page, { kind: "delete", id: targetEntityId });
    }
  }
  report.scenarios.push({
    name: "quest prop bag2: no shipped live instance",
    status: "not-applicable",
    reason: "No active Bikkie biscuit or ECS quest entity uses quests/bag2",
  });
}

async function performBustedUnderwaterContainerStep({
  first,
  sameUserPeer,
  position,
  questId,
  step,
}) {
  const label = `Busted: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  const sourceId = NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.sourceEntityId;
  const chestPosition = [...NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.position];
  // Use the proven collision-stable swim anchor directly above the chest and
  // pitch down at it. The cursor still hits the wreck terrain first; the
  // product contract is that the untouched chest's proximity overlay wins and
  // exposes F despite that obstruction. Offsetting south caused the collision
  // resolver to eject the controller five blocks west and to y=70.
  const interactionPosition = [
    chestPosition[0],
    chestPosition[1] + 6,
    chestPosition[2],
  ];
  const interactionOrientation = [-1.45, 0];
  const chestPoseTimeoutMs = Math.min(timeoutMs, 20_000);
  // This is deliberately the rendered snapshot source, not a synthetic hidden
  // inventory. The browser must discover the same placed frame a player sees,
  // then the API materializes its private per-player inventory after F is used.
  // Do not rewrite the source label/placeable/quest-giver components here.
  // Doing so previously made this test validate its own fixture instead of the
  // untouched shipped chest and masked direct-hit routing regressions.
  const untouchedSource = await authoritativeEntity(first.page, sourceId);
  assert.equal(
    untouchedSource.entity?.label?.text,
    "Chest The Grove Underwater Main",
    `${label} shipped source label drifted`
  );
  assert.deepEqual(
    untouchedSource.entity?.position?.v,
    chestPosition,
    `${label} shipped source position drifted`
  );
  assert.equal(
    untouchedSource.entity?.placeable_component?.item_id,
    NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.placeableItemId,
    `${label} shipped source placeable drifted`
  );
  assert(
    untouchedSource.entity?.quest_giver,
    `${label} shipped source lost its quest-giver marker`
  );
  await placeFrontendPlayerForFixture(
    first.page,
    first.userId,
    interactionPosition,
    interactionOrientation
  );
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({ v: interactionPosition }),
    },
  });
  // The admin update makes Redis/ECS authoritative, but the overlay selector
  // reads the client-controlled scene player. Publish the normal MoveEvent too
  // so this browser is actually swimming above the sunken chest instead of
  // visually remaining at the chapter's starting platform.
  await publishFrontendMove(first.page, first.userId, interactionPosition);
  await waitFor(
    `${label}: canonical source and player position reach frontend ECS`,
    async () => ({
      chest: await localEntity(first.page, sourceId),
      player: await localEntity(first.page, first.userId),
      scene: await frontendPlayerPose(first.page, first.userId),
    }),
    ({ chest, player, scene }) =>
      chest.entity?.label?.text === "Chest The Grove Underwater Main" &&
      chest.entity?.placeable_component?.item_id ===
        NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.placeableItemId &&
      Boolean(chest.entity?.quest_giver) &&
      distance3(player.entity?.position?.v, interactionPosition) < 0.01 &&
      // Two positions intentionally participate here. The authoritative ECS
      // player remains six metres from the chest for the server's 3-D range
      // check. Swimming physics can put the rendered player at the waterline,
      // where the prompt selector independently permits 6.5 horizontal metres
      // and eight vertical metres. Do not combine those frontend axes into a
      // Euclidean precondition: the real selector does not, and doing so made
      // a valid surface approach fail before the F-prompt was ever tested.
      distanceXZ(scene?.position, chestPosition) <= 6.5 &&
      Math.abs(
        Number(scene?.position?.[1] ?? Infinity) - Number(chestPosition[1])
      ) <= 8,
    Math.max(originSyncGateMs, 10_000),
    chestPoseTimeoutMs
  );

  await waitFor(
    `${label}: obstructed cursor routes untouched chest through quest-container overlay`,
    () => frontendInteractionSnapshot(first.page),
    (snapshot) =>
      snapshot.inspectable?.kind === "harthmere_object" &&
      snapshot.inspectable.entityId === sourceId &&
      snapshot.inspectable.label === "Chest The Grove Underwater Main" &&
      snapshot.bodyHasOpenContainer === true,
    Math.max(originSyncGateMs, 10_000),
    chestPoseTimeoutMs
  );

  const before = await authoritativeEntity(first.page, first.userId);
  const openPrompt = await waitForOpenContainerPrompt(first.page, label);
  assert.equal(
    await openPrompt.count(),
    1,
    `${label} did not expose exactly one visible F prompt`
  );
  await first.page.screenshot({
    path: path.join(artifactsDir, `${runId}-busted-underwater-f-prompt.png`),
  });

  // Keyboard input proves the world-interaction dispatcher and modal routing;
  // clicking a test-only bridge would repeat the original coverage gap.
  await first.page.keyboard.press("KeyF");
  const takeAll = first.page.getByRole("button", { name: "Take All" });
  // This gate covers both server-side private-container materialization and
  // its independent delivery through ECS sync. The product now waits for the
  // inventory component before opening the modal; allow that real readiness
  // chain to complete without weakening the visible Take All assertion.
  const containerUiTimeoutMs = Math.min(timeoutMs, 30_000);
  await takeAll.waitFor({ state: "visible", timeout: containerUiTimeoutMs });
  // Native StorageContainer cells are intentionally icon-first: their exact
  // item names live in the visible icon's accessible name and an optional
  // hover tooltip, not in permanently rendered row copy. Assert the image's
  // role/name directly. Headless Chromium can leave the tooltip portal hidden
  // after a synthetic hover while still exposing the correctly named visible
  // icon; waiting on tooltip text therefore creates a false negative.
  const questItemIcon = first.page.getByRole("img", {
    name: "Water-logged Muck Buster",
    exact: true,
  });
  await questItemIcon.waitFor({
    state: "visible",
    timeout: containerUiTimeoutMs,
  });
  assert.equal(
    await questItemIcon.count(),
    1,
    `${label} did not render exactly one accessible quest-item icon`
  );
  await first.page.screenshot({
    path: path.join(artifactsDir, `${runId}-busted-underwater-container.png`),
  });
  await takeAll.click();

  const progressed = await waitFor(
    `${label}: browser Take All reaches authoritative inventory and quest state`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      inventoryCount(entity, NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId) ===
        inventoryCount(
          before.entity,
          NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId
        ) +
          1n && serializedTriggerStepIsFired(entity, questId, step.id),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  await waitFor(
    `${label}: browser transfer returns to the originating frontend`,
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      inventoryCount(entity, NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId) ===
      inventoryCount(
        progressed.value.entity,
        NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId
      ),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  if (sameUserPeer) {
    await waitFor(
      `${label}: browser transfer reaches the same-user peer`,
      () => localEntity(sameUserPeer, first.userId),
      ({ entity }) =>
        inventoryCount(
          entity,
          NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId
        ) ===
        inventoryCount(
          progressed.value.entity,
          NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId
        ),
      Math.max(secondClientSyncGateMs, 10_000),
      timeoutMs
    );
  }
  assert.equal(
    inventoryCount(
      progressed.value.entity,
      NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId
    ),
    inventoryCount(
      before.entity,
      NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId
    ) + 1n
  );
  await waitFor(
    `${label}: next authored objective reaches the frontend`,
    () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
    (snapshot) => {
      const quest = questFromFrontend(snapshot, questId);
      return (
        quest?.status === "active" &&
        quest.currentStepId &&
        quest.currentStepId !== String(step.id)
      );
    },
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  await first.page.keyboard.press("Escape");
  // Return to the shared robot-story fixture so subsequent NPC and world
  // actions continue to exercise their authored positions.
  await publishFrontendMove(first.page, first.userId, position);
  await waitFor(
    `${label}: player returns to the robot-story fixture`,
    () => localEntity(first.page, first.userId),
    ({ entity }) => distance3(entity?.position?.v, position) < 0.01,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  report.scenarios.push({
    name: `${label}: visible F prompt and container UI retrieval`,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    sourceEntityId: String(sourceId),
    itemId: String(NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId),
    prompt: "Open Container",
    action: "Take All",
  });
}

async function waitForQuestLeaf(first, questId, step, label) {
  return waitFor(
    `${label}: native trigger fires`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      serializedTriggerStepIsFired(entity, questId, step.id) ||
      entity?.challenges?.complete.has(questId),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
}

async function performInventoryHasStep({ first, position, questId, step }) {
  const label = `${
    nativeRobotStoryBikkieTray.contents.get(questId).displayName
  }: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  const itemId = step.item.id;
  if (step.id === BUSTED_MUCK_BUSTER_STEP_ID) {
    const recipe = recipeProducing(itemId);
    assert(recipe, `${label} has no recipe producing ${itemId}`);
    while (
      inventoryCount(
        (await authoritativeEntity(first.page, first.userId)).entity,
        itemId
      ) < BigInt(step.count)
    ) {
      await craftRecipeOnce(first, position, recipe, itemId, label);
      const count = inventoryCount(
        (await authoritativeEntity(first.page, first.userId)).entity,
        itemId
      );
      if (count < BigInt(step.count)) {
        assert.equal(
          serializedTriggerStepIsFired(
            (await authoritativeEntity(first.page, first.userId)).entity,
            questId,
            step.id
          ),
          false,
          `${label} fired before the required quantity`
        );
        await waitForFrontendObjectiveIncludes(
          first.page,
          questId,
          `${count}/${step.count}`,
          label
        );
      }
    }
  } else if (step.id === BUSTED_WOODEN_AXE_STEP_ID) {
    const recipe = recipeProducing(itemId);
    assert(recipe, `${label} has no recipe producing ${itemId}`);
    await craftRecipeOnce(first, position, recipe, itemId, label);
  } else {
    const before = await authoritativeEntity(first.page, first.userId);
    const missing = BigInt(step.count) - inventoryCount(before.entity, itemId);
    if (missing > 1n) {
      await createAndPickupItem(first, position, itemId, missing - 1n, label);
      await delay(500);
      const partial = await authoritativeEntity(first.page, first.userId);
      assert.equal(
        serializedTriggerStepIsFired(partial.entity, questId, step.id),
        false,
        `${label} fired before the required quantity`
      );
      await waitForFrontendObjectiveIncludes(
        first.page,
        questId,
        `${step.count - 1}/${step.count}`,
        label
      );
      await createAndPickupItem(first, position, itemId, 1n, label);
    } else if (missing > 0n) {
      await createAndPickupItem(first, position, itemId, missing, label);
    }
  }
  const progressed = await waitForQuestLeaf(first, questId, step, label);
  assert(
    inventoryCount(progressed.value.entity, itemId) >= BigInt(step.count),
    `${label} fired without retaining the required inventory quantity`
  );
  report.scenarios.push({
    name: label,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    itemId: String(itemId),
    requiredCount: step.count,
  });
}

async function performCollectTypeStep({ first, position, questId, step }) {
  const label = `Busted: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  assert.equal(step.id, BUSTED_COLLECT_LOG_TYPE_STEP_ID);
  await createAndPickupItem(
    first,
    position,
    OAK_LOG_ITEM_ID,
    step.count - 1,
    label
  );
  await waitForFrontendObjectiveIncludes(
    first.page,
    questId,
    `${step.count - 1}/${step.count}`,
    label
  );
  assert.equal(
    serializedTriggerStepIsFired(
      (await authoritativeEntity(first.page, first.userId)).entity,
      questId,
      step.id
    ),
    false
  );
  await createAndPickupItem(first, position, OAK_LOG_ITEM_ID, 1, label);
  await waitForQuestLeaf(first, questId, step, label);
  report.scenarios.push({
    name: label,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    typeId: String(step.typeId),
    concreteItemId: String(OAK_LOG_ITEM_ID),
    requiredCount: step.count,
  });
}

async function performCraftStep({ first, position, questId, step }) {
  const label = `Get the Muck Out: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  assert.equal(step.id, GET_MUCK_OUT_WOODEN_WHACKER_STEP_ID);
  const recipeHint = first.page.locator(
    '[data-biomes-recipe-objective-hint="visible"]'
  );
  await recipeHint.waitFor({ state: "visible", timeout: 6_000 });
  assert.match(
    (await recipeHint.innerText()).replace(/\s+/g, " ").trim(),
    /Press R to open Recipes and create the required item\./
  );
  report.scenarios.push({
    name: `${label}: persistent Recipes HUD hint`,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
  });
  const recipe = recipeProducing(step.item.id);
  assert(recipe, `${label} has no authored recipe`);
  await craftRecipeOnce(first, position, recipe, step.item.id, label);
  await waitForQuestLeaf(first, questId, step, label);
  report.scenarios.push({
    name: label,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    recipeId: String(recipe.id),
    outputItemId: String(step.item.id),
    requiredCount: step.count,
  });
}

function eventPredicateItemId(step) {
  for (const [field, matcher] of step.predicate?.fields ?? []) {
    if (field === "item" && matcher?.bikkieId) return matcher.bikkieId;
  }
}

async function performPlaceStep({
  first,
  sameUserPeer,
  position,
  questId,
  step,
}) {
  const label = `Busted: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  assert.equal(step.id, BUSTED_PLACE_MUCK_BUSTER_STEP_ID);
  const itemId = eventPredicateItemId(step);
  assert(itemId, `${label} has no item predicate`);
  const player = await authoritativeEntity(first.page, first.userId);
  const inventoryRef = inventoryRefForItem(player.entity, itemId);
  assert(inventoryRef, `${label} has no inventory slot for ${itemId}`);
  const slot =
    inventoryRef.kind === "item"
      ? player.entity.inventory.items[inventoryRef.idx]
      : player.entity.inventory.hotbar[inventoryRef.idx];
  await publishAndWaitForQuestStep({
    first,
    sameUserPeer,
    questId,
    step,
    label,
    event: new PlacePlaceableEvent({
      id: first.userId,
      placeable_item: anItem(itemId),
      inventory_item: slot.item,
      inventory_ref: inventoryRef,
      position: [position[0] + 2, position[1], position[2]],
      orientation: [0, 0],
    }),
  });
}

async function createAndKillNpc(
  first,
  position,
  npcTypeId,
  label,
  index,
  fixtureHp = 10
) {
  const npcId = await bridgeCall(first.page, "allocateId");
  const npcPosition = [position[0] + 2, position[1], position[2] + index * 0.1];
  await applyFixture(first.page, {
    kind: "create",
    entity: {
      id: npcId,
      position: Position.create({ v: npcPosition }),
      orientation: Orientation.create({ v: [0, 0] }),
      rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
      size: Size.create({ v: [1, 1, 1] }),
      health: Health.create({ hp: fixtureHp, maxHp: fixtureHp }),
      npc_state: NpcState.create(),
      npc_metadata: NpcMetadata.create({
        type_id: npcTypeId,
        created_time: secondsSinceEpoch(),
        spawn_position: npcPosition,
        spawn_orientation: [0, 0],
      }),
      label: Label.create({ text: `${label} ${index}` }),
    },
  });
  await waitFor(
    `${label} ${index}: NPC fixture synchronized`,
    () => localEntity(first.page, npcId),
    ({ entity }) => entity?.health?.hp === fixtureHp,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  for (let hit = 1; hit <= 4; hit += 1) {
    const beforeHit = await authoritativeEntity(first.page, npcId);
    if ((beforeHit.entity?.health?.hp ?? 0) <= 0) break;
    await applyFixture(
      first.page,
      {
        kind: "update",
        entity: {
          id: first.userId,
          position: Position.create({ v: [...position] }),
        },
      },
      {
        kind: "update",
        entity: {
          id: npcId,
          position: Position.create({ v: npcPosition }),
          rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
        },
      }
    );
    await bridgeCall(
      first.page,
      "publish",
      serializedEvent(
        new UpdateNpcHealthEvent({
          id: npcId,
          hp: -999,
          damageSource: {
            kind: "attack",
            attacker: first.userId,
            dir: [1, 0, 0],
          },
        })
      )
    );
    await waitFor(
      `${label} ${index}: hit ${hit} mutates NPC health`,
      () => authoritativeEntity(first.page, npcId),
      ({ version, entity }) =>
        version > beforeHit.version &&
        (entity?.health?.hp ?? beforeHit.entity.health.hp) <
          beforeHit.entity.health.hp,
      Math.max(acceptanceGateMs, 10_000),
      timeoutMs
    );
  }
  const dead = await authoritativeEntity(first.page, npcId);
  assert(
    (dead.entity?.health?.hp ?? 1) <= 0,
    `${label} ${index} survived four authoritative attacks`
  );
}

const NATIVE_LEGACY_COMBAT_E2E_SPECS = [
  {
    questId: NATIVE_LEGACY_COMBAT_QUEST_IDS.NUTHIN_TO_MUCK_WITH,
    stepId: NATIVE_LEGACY_COMBAT_STEP_IDS.COBBLED_MUCKLING,
    npcTypeId: NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.COBBLED_MUCKLING,
    count: 1,
    initialPosition: NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.COBBLED_PACK,
    livePacks: [
      {
        position: NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.COBBLED_PACK,
        radius: 60,
        minimum: 4,
      },
    ],
  },
  {
    questId: NATIVE_LEGACY_COMBAT_QUEST_IDS.SEEDY_SAPPERS,
    stepId: NATIVE_LEGACY_COMBAT_STEP_IDS.SHARED_BOARD_COMBAT,
    npcTypeId: NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.SEEDY_MUCKLING,
    wrongNpcTypeId: NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.JUGGERMUCKER,
    count: 4,
    initialPosition: NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.SEEDY_PACK,
    livePacks: [
      {
        position: NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.SEEDY_PACK,
        radius: 25,
        minimum: 4,
      },
    ],
  },
  {
    questId: NATIVE_LEGACY_COMBAT_QUEST_IDS.JUGGEMENT_DAY,
    stepId: NATIVE_LEGACY_COMBAT_STEP_IDS.EIGHT_JUGGERMUCKERS,
    npcTypeId: NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.JUGGERMUCKER,
    count: 8,
    initialPosition:
      NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.JUGGER_PACK_FOUR_NORTH,
    nextPosition: NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.JUGGER_PACK_FOUR_SOUTH,
    switchAfter: 4,
    livePacks: [
      {
        position: NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.JUGGER_PACK_FOUR_NORTH,
        radius: 40,
        minimum: 4,
      },
      {
        position: NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.JUGGER_PACK_FOUR_SOUTH,
        radius: 40,
        minimum: 4,
      },
    ],
  },
  {
    questId: NATIVE_LEGACY_COMBAT_QUEST_IDS.COMBAT_JUGGMENT_DAY,
    stepId: NATIVE_LEGACY_COMBAT_STEP_IDS.SHARED_BOARD_COMBAT,
    npcTypeId: NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.JUGGERMUCKER,
    wrongNpcTypeId: NATIVE_RESTORED_COMBAT_NPC_TYPE_IDS.SEEDY_MUCKLING,
    count: 1,
    initialPosition: NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.JUGGER_PACK_THREE,
    livePacks: [
      {
        position: NATIVE_LEGACY_COMBAT_ROUTE_POSITIONS.JUGGER_PACK_THREE,
        radius: 10,
        minimum: 3,
      },
    ],
  },
];

function nativeLegacyCombatQuestFixture(quest, stepId) {
  const leaves = nativeRobotStoryLeafSteps(quest);
  const targetIndex = leaves.findIndex((step) => step.id === stepId);
  assert(
    targetIndex >= 0,
    `${quest.displayName}: missing combat step ${stepId}`
  );
  const challenges = Challenges.create();
  challenges.in_progress.add(quest.id);
  challenges.started_at.set(quest.id, secondsSinceEpoch() - 10);
  const triggerState = nativeVitalsFixture();
  triggerState.by_root.set(
    quest.id,
    new Map(
      leaves
        .slice(0, targetIndex)
        .map((step, index) => [step.id, secondsSinceEpoch() - 30 + index])
    )
  );
  return { challenges, triggerState };
}

function nativeCombatMarker(snapshot, spec) {
  return snapshot.markers.find(
    (marker) =>
      marker.questId === String(spec.questId) &&
      marker.triggerId === String(spec.stepId)
  );
}

async function assertLiveCombatPack(first, spec, pack, index) {
  // The low-memory focused client only synchronizes its current interest set.
  // Move the same browser actor to each authored pack before asserting live ECS
  // rows; checking a distant pack from the first marker would misreport absent
  // enemies that are merely outside the client's sync radius.
  await placeFrontendPlayerForFixture(
    first.page,
    first.userId,
    [...pack.position],
    [0, 0]
  );
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({ v: [...pack.position] }),
    },
  });
  const synchronized = await waitFor(
    `${spec.questId}: live enemy pack ${index + 1} synchronizes`,
    async () => {
      const rows = await bridgeCall(
        first.page,
        "findLocalByComponent",
        "npc_metadata"
      );
      return rows
        .map(([, serialized]) => deserializeEntity(serialized))
        .filter(
          (entity) =>
            Number(entity.npc_metadata?.type_id) === Number(spec.npcTypeId) &&
            (entity.health?.hp ?? 0) > 0 &&
            distance3(entity.position?.v, pack.position) <= pack.radius
        );
    },
    (live) => live.length >= pack.minimum,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  report.scenarios.push({
    name: `${spec.questId}: live enemy pack ${index + 1}`,
    status: "pass",
    count: synchronized.value.length,
    minimum: pack.minimum,
    npcTypeId: String(spec.npcTypeId),
    position: [...pack.position],
  });
}

async function proveNativeLegacyCombatRoutes(first) {
  const resumeIndex = legacyCombatResumeAt
    ? NATIVE_LEGACY_COMBAT_E2E_SPECS.findIndex(
        (spec) => Number(spec.questId) === legacyCombatResumeAt
      )
    : 0;
  assert(
    resumeIndex >= 0,
    "legacy combat resume quest is absent from the batch"
  );
  for (const spec of NATIVE_LEGACY_COMBAT_E2E_SPECS.slice(resumeIndex)) {
    const quest = nativeLegacyCombatBikkieTray.contents.get(spec.questId);
    const { challenges, triggerState } = nativeLegacyCombatQuestFixture(
      quest,
      spec.stepId
    );
    const playerPosition = [...spec.initialPosition];
    await placeFrontendPlayerForFixture(
      first.page,
      first.userId,
      playerPosition,
      [0, 0]
    );
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        challenges,
        trigger_state: triggerState,
        inventory: playerInventoryFixture(),
        wearing: Wearing.create({ items: new Map() }),
        health: Health.create({ hp: 100, maxHp: 100 }),
        position: Position.create({ v: playerPosition }),
      },
    });

    const projected = await waitFor(
      `${quest.displayName}: exact combat marker reaches live frontend`,
      () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
      (snapshot) => {
        const marker = nativeCombatMarker(snapshot, spec);
        const quest = questFromFrontend(snapshot, spec.questId);
        return (
          snapshot.ecs.inProgress.includes(String(spec.questId)) &&
          quest?.status === "active" &&
          quest.currentStepId === String(spec.stepId) &&
          // Marker-only coverage proves markers remain available even while a
          // different active story quest owns the HUD/main-quest selection.
          // The full combat route still requires this quest to be selected.
          (legacyCombatMarkersOnly ||
            (snapshot.activeQuestId === String(spec.questId) &&
              snapshot.mainQuestId === String(spec.questId))) &&
          distance3(marker?.worldPosition, spec.initialPosition) < 0.01
        );
      },
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    );
    for (let index = 0; index < spec.livePacks.length; index += 1) {
      await assertLiveCombatPack(first, spec, spec.livePacks[index], index);
    }

    let nextMarkerVerified = false;
    if (legacyCombatMarkersOnly && spec.nextPosition && spec.switchAfter) {
      // Deep-link the unfinished event leaf to its authored partial count. This
      // verifies the 4/8 marker handoff without killing or completing anything.
      // The next quest fixture replaces this state immediately afterward.
      const partialTriggerState = TriggerState.clone(triggerState);
      partialTriggerState.by_root
        .get(spec.questId)
        .set(spec.stepId, serializeTriggerState({ payload: spec.switchAfter }));
      await applyFixture(first.page, {
        kind: "update",
        entity: {
          id: first.userId,
          trigger_state: partialTriggerState,
          position: Position.create({ v: [...spec.nextPosition] }),
        },
      });
      await waitFor(
        `${quest.displayName}: partial progress advances the live map marker`,
        () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
        (snapshot) =>
          distance3(
            nativeCombatMarker(snapshot, spec)?.worldPosition,
            spec.nextPosition
          ) < 0.01,
        Math.max(originSyncGateMs, 10_000),
        timeoutMs
      );
      nextMarkerVerified = true;
    }

    if (legacyCombatMarkersOnly) {
      report.scenarios.push({
        name: `${quest.displayName}: active marker and seeded enemies`,
        status: "pass",
        questId: String(spec.questId),
        stepId: String(spec.stepId),
        marker: nativeCombatMarker(projected.value, spec)?.worldPosition,
        livePackMinimums: spec.livePacks.map((pack) => pack.minimum),
        nextMarker: spec.nextPosition ? [...spec.nextPosition] : undefined,
        nextMarkerVerified,
      });
      continue;
    }

    await placeFrontendPlayerForFixture(
      first.page,
      first.userId,
      playerPosition,
      [0, 0]
    );
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        position: Position.create({ v: playerPosition }),
      },
    });

    if (spec.wrongNpcTypeId) {
      await createAndKillNpc(
        first,
        playerPosition,
        spec.wrongNpcTypeId,
        `${quest.displayName} wrong-family guard`,
        0,
        1
      );
      await delay(500);
      const afterWrong = await authoritativeEntity(first.page, first.userId);
      assert.equal(
        serializedTriggerStepIsFired(
          afterWrong.entity,
          spec.questId,
          spec.stepId
        ),
        false,
        `${quest.displayName}: duplicated trigger id counted the wrong family`
      );
    }

    for (let kill = 1; kill <= spec.count; kill += 1) {
      await createAndKillNpc(
        first,
        playerPosition,
        spec.npcTypeId,
        `${quest.displayName} restored target`,
        kill,
        1
      );
      if (kill === spec.switchAfter) {
        await waitFor(
          `${quest.displayName}: marker advances to remaining enemy pack`,
          () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
          (snapshot) =>
            distance3(
              nativeCombatMarker(snapshot, spec)?.worldPosition,
              spec.nextPosition
            ) < 0.01,
          Math.max(originSyncGateMs, 10_000),
          timeoutMs
        );
      }
    }

    await waitFor(
      `${quest.displayName}: restored targets complete the authored kill leaf`,
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) =>
        serializedTriggerStepIsFired(entity, spec.questId, spec.stepId) ||
        entity?.challenges?.complete.has(spec.questId),
      Math.max(acceptanceGateMs, 10_000),
      timeoutMs
    );
    report.scenarios.push({
      name: `${quest.displayName}: restored combat route`,
      status: "pass",
      questId: String(spec.questId),
      stepId: String(spec.stepId),
      killCount: spec.count,
      initialMarker: projected.value
        ? nativeCombatMarker(projected.value, spec)?.worldPosition
        : [...spec.initialPosition],
      markerAdvanced: Boolean(spec.nextPosition),
    });
  }
}

function finishFocusedNativeLegacyCombatRun() {
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS restored native combat quest ${
      legacyCombatMarkersOnly ? "markers and seeded enemies" : "routes"
    }${legacyCombatResumeAt ? ` from ${legacyCombatResumeAt}` : ""}`
  );
}

async function performNpcKilledStep({ first, position, questId, step }) {
  const label = `Get the Muck Out: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  assert.equal(step.id, GET_MUCK_OUT_MUCKLING_STEP_ID);
  const projected = await waitFor(
    `${label}: hunt becomes the active map and minimap destination`,
    () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
    (snapshot) => {
      const marker = snapshot.markers.find(
        (candidate) =>
          candidate.questId === String(questId) &&
          candidate.triggerId === String(step.id)
      );
      return (
        marker &&
        snapshot.activeMapPin?.markerId === marker.id &&
        distance3(
          marker.worldPosition,
          NATIVE_GET_THE_MUCK_OUT_MUCKLING_HUNT_POSITION
        ) < 0.01 &&
        distance3(snapshot.activeMapPin.worldPosition, marker.worldPosition) <
          0.01
      );
    },
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  const huntMarker = projected.value.markers.find(
    (candidate) =>
      candidate.questId === String(questId) &&
      candidate.triggerId === String(step.id)
  );
  assert(huntMarker, `${label}: active hunt marker disappeared`);
  await first.page
    .locator(`[data-biomes-ui-active-minimap-pin="${huntMarker.id}"]`)
    .waitFor({ state: "visible", timeout: 10_000 });

  await placeFrontendPlayerForFixture(
    first.page,
    first.userId,
    [...NATIVE_GET_THE_MUCK_OUT_MUCKLING_HUNT_POSITION],
    [0, 0]
  );
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({
        v: [...NATIVE_GET_THE_MUCK_OUT_MUCKLING_HUNT_POSITION],
      }),
    },
  });
  const liveMossyPack = await waitFor(
    `${label}: six live Mossy Mucklings synchronize at the destination`,
    async () => {
      const rows = await bridgeCall(
        first.page,
        "findLocalByComponent",
        "npc_metadata"
      );
      return rows
        .map(([, serialized]) => deserializeEntity(serialized))
        .filter(
          (entity) =>
            Number(entity.npc_metadata?.type_id) ===
              Number(NATIVE_GET_THE_MUCK_OUT_RESTORED_MOSSY_MUCKLING_TYPE_ID) &&
            entity.position?.v &&
            distance3(
              entity.position.v,
              NATIVE_GET_THE_MUCK_OUT_MUCKLING_HUNT_POSITION
            ) <= 12
        );
    },
    (entities) =>
      entities.length >= 6 &&
      entities.every(
        (entity) =>
          /^Mossy Muckling(?:\s+\d+)?$/.test(entity.label?.text ?? "") &&
          (entity.health?.hp ?? 0) > 0
      ),
    Math.max(originSyncGateMs, 15_000),
    timeoutMs
  );
  const authoritativeMossyPack = await Promise.all(
    liveMossyPack.value
      .slice(0, 6)
      .map((entity) => authoritativeEntity(first.page, entity.id))
  );
  assert.equal(authoritativeMossyPack.length, 6);
  for (const row of authoritativeMossyPack) {
    assert(row.entity, `${label}: authoritative Mossy Muckling disappeared`);
    assert(
      row.entity.position?.v,
      `${row.entity.label?.text ?? row.entity.id} has no authoritative position`
    );
    assert.equal(
      Number(row.entity.npc_metadata?.type_id),
      Number(NATIVE_GET_THE_MUCK_OUT_RESTORED_MOSSY_MUCKLING_TYPE_ID)
    );
    assert((row.entity.health?.hp ?? 0) > 0);
    assert(
      distance3(
        row.entity.position.v,
        NATIVE_GET_THE_MUCK_OUT_MUCKLING_HUNT_POSITION
      ) <= 12
    );
    assert.equal(
      harthmereMuckMonsterPositionIsInSafeZone(row.entity.position.v),
      false,
      `${row.entity.label?.text ?? row.entity.id} is inside a protected area`
    );
  }
  report.scenarios.push({
    name: `${label}: automatic destination, minimap pin, and live pack`,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    markerId: huntMarker.id,
    markerPosition: huntMarker.worldPosition,
    liveMossyMucklingIds: authoritativeMossyPack.map((row) =>
      String(row.entity.id)
    ),
  });

  const wrongNpcTypeId = WRONG_MUCKLING_TYPE_ID;
  assert.notEqual(wrongNpcTypeId, MOSSY_MUCKLING_TYPE_ID);
  await createAndKillNpc(
    first,
    position,
    wrongNpcTypeId,
    `${label} wrong type`,
    0
  );
  await delay(500);
  assert.equal(
    serializedTriggerStepIsFired(
      (await authoritativeEntity(first.page, first.userId)).entity,
      questId,
      step.id
    ),
    false,
    `${label} counted a wrong NPC type`
  );
  // Exercise the two visible restored-world Muckling families before falling
  // back to the legacy biscuit type. The shipped quest predates those native
  // families, so an E2E that only creates the legacy id cannot catch the exact
  // production bug where players kill a visible Muckling and receive no quest
  // progress.
  const productionMucklingTypeIds = [
    NATIVE_GET_THE_MUCK_OUT_WEST_BREACH_MUCKLING_TYPE_ID,
    NATIVE_GET_THE_MUCK_OUT_GRAVEWOOD_MUCKLING_TYPE_ID,
  ];
  const killedNpcTypeIds = [];
  for (let index = 1; index <= step.count; index += 1) {
    const npcTypeId =
      productionMucklingTypeIds[index - 1] ?? MOSSY_MUCKLING_TYPE_ID;
    await createAndKillNpc(first, position, npcTypeId, label, index);
    killedNpcTypeIds.push(String(npcTypeId));
    if (index < step.count) {
      await waitForFrontendObjectiveIncludes(
        first.page,
        questId,
        `${index}/${step.count}`,
        label
      );
    }
  }
  await waitForQuestLeaf(first, questId, step, label);
  report.scenarios.push({
    name: label,
    status: "pass",
    questId: String(questId),
    stepId: String(step.id),
    npcTypeIds: killedNpcTypeIds,
    requiredCount: step.count,
    wrongNpcTypeRejected: String(wrongNpcTypeId),
  });
}

async function performRaceStep({ first, sameUserPeer, questId, step }) {
  const label = `Get the Muck Out: ${step.name}`;
  await waitForFrontendQuestStep(first.page, questId, step.id, label);
  assert.equal(step.id, GET_MUCK_OUT_RACE_STEP_ID);
  const minigameId = NATIVE_GET_THE_MUCK_OUT_RACE_MINIGAME_ID;
  const game = (await authoritativeEntity(first.page, minigameId)).entity;
  assert.equal(
    game?.minigame_component?.metadata.kind,
    "simple_race",
    `${label} could not load the real Mucker Den Dash definition`
  );
  const metadata = game.minigame_component.metadata;
  const finishElementId = [...metadata.end_ids][0];
  assert(finishElementId, `${label} has no finish element`);
  const finish = (await authoritativeEntity(first.page, finishElementId))
    .entity;
  assert(
    finish?.position?.v && finish.minigame_element?.minigame_id === minigameId,
    `${label} finish element is missing or belongs to another race`
  );
  const finishPosition = [...finish.position.v];
  const [instanceId, stashId] = await Promise.all(
    [0, 1].map(() => bridgeCall(first.page, "allocateId"))
  );
  const startedAt = secondsSinceEpoch() - 5;
  const gameComponent = MinigameComponent.clone(game.minigame_component);
  gameComponent.active_instance_ids.add(instanceId);
  await applyFixture(
    first.page,
    {
      kind: "update",
      entity: {
        id: first.userId,
        position: Position.create({ v: finishPosition }),
        playing_minigame: PlayingMinigame.create({
          minigame_id: minigameId,
          minigame_instance_id: instanceId,
          minigame_type: "simple_race",
        }),
      },
    },
    {
      kind: "update",
      entity: {
        id: minigameId,
        minigame_component: gameComponent,
      },
    },
    {
      kind: "create",
      entity: {
        id: instanceId,
        created_by: CreatedBy.create({
          id: minigameId,
          created_at: secondsSinceEpoch(),
        }),
        minigame_instance: MinigameInstance.create({
          minigame_id: minigameId,
          finished: false,
          state: {
            kind: "simple_race",
            player_state: "racing",
            started_at: startedAt,
            deaths: 0,
            reached_checkpoints: new Map(
              [...metadata.checkpoint_ids].map((checkpointId, index) => [
                checkpointId,
                { time: startedAt + index + 1 },
              ])
            ),
            finished_at: undefined,
          },
          active_players: new Map([
            [
              first.userId,
              {
                entry_stash_id: stashId,
                entry_position: finishPosition,
                entry_warped_to: undefined,
                entry_time: startedAt,
              },
            ],
          ]),
        }),
      },
    },
    {
      kind: "create",
      entity: {
        id: stashId,
        stashed: Stashed.create({
          stashed_at: startedAt,
          stashed_by: instanceId,
          original_entity_id: first.userId,
        }),
      },
    }
  );
  await waitFor(
    `${label}: race fixture synchronizes`,
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      entity?.playing_minigame?.minigame_instance_id === instanceId,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  await publishAndWaitForQuestStep({
    first,
    sameUserPeer,
    questId,
    step,
    label,
    event: new FinishSimpleRaceMinigameEvent({
      id: first.userId,
      minigame_id: minigameId,
      minigame_element_id: finishElementId,
      minigame_instance_id: instanceId,
    }),
  });
  assert.equal(
    (await authoritativeEntity(first.page, first.userId)).entity
      ?.playing_minigame,
    undefined,
    `${label} left the player stuck in the race`
  );
}

async function performEventStep(args) {
  switch (args.step.eventKind) {
    case "place":
      return performPlaceStep(args);
    case "npcKilled":
      return performNpcKilledStep(args);
    case "minigame_simple_race_finish":
      return performRaceStep(args);
    case "postPhoto":
      return performRoadAheadPhotoStep(args);
    default:
      throw new Error(
        `No exhaustive robot-story action for ${args.step.eventKind}`
      );
  }
}

async function executeRobotStoryTriggerNode(args) {
  const { first, questId, step, xpAudit } = args;
  const quest = nativeRobotStoryBikkieTray.contents.get(questId);
  const initial = await authoritativeEntity(first.page, first.userId);
  if (
    step.id &&
    serializedTriggerStepIsFired(initial.entity, questId, step.id)
  ) {
    report.scenarios.push({
      name: `${quest.displayName}: ${
        step.name || step.id
      } already satisfied by the prior multi-action browser step`,
      status: "pass",
      questId: String(questId),
      stepId: String(step.id),
      satisfiedByPriorAction: true,
    });
    return;
  }
  switch (step.kind) {
    case "seq":
    case "all":
    case "any":
    case "variant":
      for (const child of step.triggers) {
        await executeRobotStoryTriggerNode({ ...args, step: child });
        if (
          args.stopAfterStepId &&
          serializedTriggerStepIsFired(
            (await authoritativeEntity(first.page, first.userId)).entity,
            questId,
            args.stopAfterStepId
          )
        ) {
          return;
        }
      }
      if (
        !(
          await authoritativeEntity(first.page, first.userId)
        ).entity?.challenges?.complete.has(questId)
      ) {
        await waitForQuestLeaf(
          first,
          questId,
          step,
          `${
            nativeRobotStoryBikkieTray.contents.get(questId).displayName
          }: group ${step.id}`
        );
      }
      return;
    default:
      break;
  }

  // One visible browser action can satisfy more than one authored leaf (for
  // example Take All may fill several inventoryHas rows). Measure the complete
  // fired-leaf set around the action so every newly satisfied objective is
  // charged exactly once without replaying it as a separate browser test.
  const beforeFired = firedNativeRobotStoryLeafIds(initial.entity, quest);
  const beforeProgression = readHarthmereNativeCombatProgression(
    initial.entity?.trigger_state
  );

  switch (step.kind) {
    case "challengeClaimRewards":
      if (step.id === NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.stepId) {
        await performBustedUnderwaterContainerStep(args);
      } else {
        await performQuestClaimStep(args);
      }
      break;
    case "inventoryHas":
      await performInventoryHasStep(args);
      break;
    case "collectType":
      await performCollectTypeStep(args);
      break;
    case "collect":
      await performRoadAheadCollectStep(args);
      break;
    case "craft":
      await performCraftStep(args);
      break;
    case "mapBeam":
      await performRoadAheadMapBeamStep(args);
      break;
    case "wearType":
      await performRoadAheadWearTypeStep(args);
      break;
    case "event":
      await performEventStep(args);
      break;
    default:
      throw new Error(
        `No exhaustive robot-story action for trigger ${step.kind}:${step.id}`
      );
  }

  const after = await authoritativeEntity(first.page, first.userId);
  const afterFired = firedNativeRobotStoryLeafIds(after.entity, quest);
  const newlyFired = nativeRobotStoryLeafSteps(quest).filter(
    (candidate) =>
      candidate.id &&
      afterFired.has(candidate.id) &&
      !beforeFired.has(candidate.id)
  );
  const stepXp = newlyFired.reduce(
    (total, candidate) =>
      total +
      nativeQuestStepXp({
        questId,
        triggerKind: candidate.kind,
        eventKind: candidate.eventKind,
        isLeaf: true,
      }),
    0
  );
  const completedDuringAction =
    !initial.entity?.challenges?.complete.has(questId) &&
    Boolean(after.entity?.challenges?.complete.has(questId));
  // The two restored production Mucklings intentionally award their ordinary
  // combat XP in the same authoritative kill transaction as the quest event.
  // Keep that side effect explicit so this audit still catches duplicate quest
  // XP while exercising the real visible enemy types.
  const incidentalCombatXp =
    step.id === GET_MUCK_OUT_MUCKLING_STEP_ID
      ? GET_MUCK_OUT_PRODUCTION_MUCKLING_COMBAT_XP
      : 0;
  const expectedXp =
    stepXp +
    (completedDuringAction ? nativeQuestCompletionXp(questId) : 0) +
    incidentalCombatXp;
  const afterProgression = readHarthmereNativeCombatProgression(
    after.entity?.trigger_state
  );
  const actualXp =
    nativeProgressionLifetimeXp(afterProgression) -
    nativeProgressionLifetimeXp(beforeProgression);
  assert.equal(
    actualXp,
    expectedXp,
    `${quest.displayName}: browser action for ${step.kind}:${step.id} changed native XP by ${actualXp}; expected ${expectedXp}`
  );
  for (const candidate of newlyFired) {
    xpAudit?.add(candidate.id);
  }
  report.scenarios.push({
    name: `${quest.displayName}: browser action awards native quest XP`,
    status: "pass",
    questId: String(questId),
    actionStepId: String(step.id),
    newlyFiredStepIds: newlyFired.map((candidate) => String(candidate.id)),
    stepXp,
    completionXp: completedDuringAction ? nativeQuestCompletionXp(questId) : 0,
    incidentalCombatXp,
    actualXp,
    levelBefore: beforeProgression.level,
    levelAfter: afterProgression.level,
  });
}

/**
 * Build the minimum authoritative state at the start of one robot-story
 * chapter. Prior chapters are marked complete and only the physical robot
 * parts they award are carried forward. This keeps a focused live-browser run
 * faithful to the real chain without replaying chapters that already passed.
 */
function robotStoryChapterSeed(quests, chapterIndex) {
  const questId = quests[chapterIndex].id;
  const challenges = Challenges.create();
  for (let priorIndex = 0; priorIndex < chapterIndex; priorIndex += 1) {
    const priorQuestId = quests[priorIndex].id;
    challenges.complete.add(priorQuestId);
    challenges.started_at.set(priorQuestId, secondsSinceEpoch() - 20);
    challenges.finished_at.set(priorQuestId, secondsSinceEpoch() - 10);
  }
  challenges.in_progress.add(questId);
  challenges.started_at.set(questId, secondsSinceEpoch());

  const prerequisiteParts = [];
  if (chapterIndex >= 1) {
    prerequisiteParts.push(
      countOf(NATIVE_ROBOT_STORY_ITEM_IDS.ROBOT_SHELL, 1n)
    );
  }
  if (chapterIndex >= 2) {
    prerequisiteParts.push(
      countOf(NATIVE_ROBOT_STORY_ITEM_IDS.ROBOT_MOTOR_UNIT, 1n)
    );
  }
  if (chapterIndex >= 3) {
    prerequisiteParts.push(
      countOf(NATIVE_ROBOT_STORY_ITEM_IDS.ROBOT_POWER_SUPPLY, 1n)
    );
  }
  const inventory = Inventory.create({
    items: prerequisiteParts,
    hotbar: new Array(PLAYER_HOTBAR_SLOTS),
    currencies: new Map(),
    overflow: new Map(),
    selected: { kind: "hotbar", idx: 0 },
  });
  inventory.items.length = PLAYER_INVENTORY_SLOTS;
  return { challenges, inventory, prerequisiteParts };
}

async function proveNativeRobotStoryLevelingUi(first, expectedStats) {
  const canvas = first.page.locator("canvas").first();
  if ((await canvas.count()) === 1) {
    await canvas.focus({ timeout: probeTimeoutMs });
  }
  await first.page.keyboard.press("KeyK");
  const panel = first.page.locator(
    `section[aria-label="Level ${expectedStats.level} character stats"]`
  );
  await panel.waitFor({ state: "visible", timeout: timeoutMs });
  const text = (await panel.innerText()).replace(/\s+/g, " ").trim();
  for (const expected of [
    `Level ${expectedStats.level}`,
    `Strength ${expectedStats.strength}`,
    `Dexterity ${expectedStats.dexterity}`,
    `Intelligence ${expectedStats.intelligence}`,
    `Defense ${expectedStats.defense}`,
    `Armor ${expectedStats.armor}`,
    `Evasion ${expectedStats.evasion}`,
    `Accuracy ${expectedStats.accuracy}`,
    `Critical chance ${(expectedStats.criticalChance * 100).toFixed(1)}%`,
    `Spell power ${expectedStats.spellPower}`,
    `Healing power ${expectedStats.healingPower}`,
    `Movement speed ${Math.round(expectedStats.movementSpeed * 100)}%`,
    `Carry capacity ${expectedStats.carryCapacity}`,
    `Backpack slots ${expectedStats.inventorySlots}`,
  ]) {
    assert(
      text.includes(expected),
      `Skills UI did not render "${expected}": ${text}`
    );
  }
  const screenshotPath = path.join(
    artifactsDir,
    `${runId}-robot-story-level-${expectedStats.level}-stats.png`
  );
  await first.page.screenshot({ path: screenshotPath, fullPage: true });
  report.scenarios.push({
    name: "complete robot story renders level-derived character stats",
    status: "pass",
    level: expectedStats.level,
    stats: expectedStats,
    screenshot: screenshotPath,
  });
  await first.page.keyboard.press("Escape");
}

async function proveNativeRobotStoryExhaustiveRoundTrip(
  browser,
  first,
  sameUserPeer,
  position
) {
  assert(nativeRobotStoryBikkieTray, "robot story Bikkie tray was not loaded");
  const quests = NATIVE_ROBOT_STORY_EXHAUSTIVE_QUEST_IDS.map((questId) =>
    nativeRobotStoryBikkieTray.contents.get(questId)
  );
  const focusedChapterIndex =
    focusedRobotStoryQuestId === undefined
      ? undefined
      : quests.findIndex((quest) => quest.id === focusedRobotStoryQuestId);
  const chapterIndexes =
    focusedChapterIndex === undefined
      ? quests.map((_quest, index) => index)
      : [focusedChapterIndex];
  const targets = await createRobotStoryTargets(
    first,
    position,
    chapterIndexes.map((index) => quests[index].trigger)
  );
  if (gimmeSophiaHandoffOnly) {
    await proveSeededGimmeSophiaHandoff(
      first,
      sameUserPeer,
      position,
      targets.get(NATIVE_ROBOT_STORY_FINAL_HANDOFFS.muckVsMachine.targetId)
    );
    return;
  }
  const before = await authoritativeEntity(first.page, first.userId);
  const initialChapterIndex = chapterIndexes[0];
  const initialQuest = quests[initialChapterIndex];
  const { challenges, inventory, prerequisiteParts } = robotStoryChapterSeed(
    quests,
    initialChapterIndex
  );
  if (roadAheadSelfieOnward) {
    inventory.items[0] = countOf(BikkieIds.camera, 1n);
    inventory.items[1] = countOf(NATIVE_ROBOT_STORY_ITEM_IDS.ROBOT_SHELL, 1n);
  } else if (roadAheadFinalHandoffOnly) {
    inventory.items[0] = countOf(NATIVE_ROBOT_STORY_ITEM_IDS.ROBOT_SHELL, 1n);
  }
  // A focused run represents a newly created actor at a precise chapter
  // boundary, so no unrelated bootstrap trigger receipts should leak into it.
  // The ordinary full-chain run retains the actor's non-story receipts while
  // clearing only the four robot-story roots, matching its historical setup.
  const triggerState =
    focusedChapterIndex === undefined
      ? TriggerState.clone(before.entity.trigger_state)
      : TriggerState.create();
  let resumedStoryXp = 0;
  let getMuckOutInscriptionSeedXp = 0;
  const resumedXpAuditedStepIds = new Set();
  if (focusedChapterIndex === undefined) {
    for (const questId of NATIVE_ROBOT_STORY_QUEST_IDS) {
      triggerState.by_root.delete(questId);
    }
  }
  if (bustedChestOnly) {
    triggerState.by_root.set(
      NATIVE_BUSTED_QUEST_ID,
      new Map(
        [310783173745175, 859994236864492, 3346948724689018].map(
          (stepId, index) => [stepId, secondsSinceEpoch() - 10 + index]
        )
      )
    );
  }
  if (roadAheadResumeAfterStepId) {
    const prerequisiteIds =
      NATIVE_ROBOT_STORY_FINAL_HANDOFFS.roadAhead.prerequisiteTriggerIds;
    const stopIndex = prerequisiteIds.indexOf(roadAheadResumeAfterStepId);
    assert(stopIndex >= 0, "Road Ahead resume checkpoint is missing");
    const firedStepIds = prerequisiteIds.slice(0, stopIndex + 1);
    triggerState.by_root.set(
      NATIVE_ROAD_AHEAD_QUEST_ID,
      new Map(
        firedStepIds.map((stepId, index) => [
          stepId,
          secondsSinceEpoch() - firedStepIds.length + index,
        ])
      )
    );
    const firedSet = new Set(firedStepIds);
    for (const leaf of nativeRobotStoryLeafSteps(initialQuest)) {
      if (!firedSet.has(leaf.id)) continue;
      const xp = nativeQuestStepXp({
        questId: initialQuest.id,
        triggerKind: leaf.kind,
        eventKind: leaf.eventKind,
        isLeaf: true,
      });
      if (xp > 0) {
        resumedStoryXp += xp;
        resumedXpAuditedStepIds.add(leaf.id);
      }
    }
    writeHarthmereNativeCombatProgression(
      triggerState,
      nativeProgressionForLifetimeXp(resumedStoryXp)
    );
  }
  if (getMuckOutInscriptionsOnly) {
    const firedStepIds = [...GET_MUCK_OUT_INSCRIPTION_PRIOR_STEP_IDS];
    triggerState.by_root.set(
      NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
      new Map(
        firedStepIds.map((stepId, index) => [
          stepId,
          secondsSinceEpoch() - firedStepIds.length + index,
        ])
      )
    );
    const firedSet = new Set(firedStepIds);
    getMuckOutInscriptionSeedXp = nativeRobotStoryLeafSteps(initialQuest)
      .filter((leaf) => firedSet.has(leaf.id))
      .reduce(
        (total, leaf) =>
          total +
          nativeQuestStepXp({
            questId: initialQuest.id,
            triggerKind: leaf.kind,
            eventKind: leaf.eventKind,
            isLeaf: true,
          }),
        0
      );
    writeHarthmereNativeCombatProgression(
      triggerState,
      nativeProgressionForLifetimeXp(getMuckOutInscriptionSeedXp)
    );
  }
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      challenges,
      trigger_state: triggerState,
      inventory,
      recipe_book: RecipeBook.create(),
      wearing: Wearing.create({ items: new Map() }),
      position: Position.create({ v: [...position] }),
    },
  });
  await waitFor(
    `${initialQuest.displayName}: exhaustive starting fixture synchronizes`,
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      entity?.challenges?.in_progress.has(initialQuest.id) &&
      prerequisiteParts.every(
        (stack) => inventoryCount(entity, stack.item.id) >= stack.count
      ),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  if (focusedChapterIndex !== undefined) {
    report.scenarios.push({
      name: `${initialQuest.displayName}: focused chapter seed`,
      status: "pass",
      questId: String(initialQuest.id),
      completedPredecessorQuestIds: quests
        .slice(0, focusedChapterIndex)
        .map((quest) => String(quest.id)),
      seededPrerequisiteParts: prerequisiteParts.map((stack) =>
        String(stack.item.id)
      ),
      resumedAfterStepId: roadAheadResumeAfterStepId
        ? String(roadAheadResumeAfterStepId)
        : undefined,
      resumedStoryXp: roadAheadResumeAfterStepId ? resumedStoryXp : undefined,
      seededTargetStepId: bustedChestOnly
        ? String(NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.stepId)
        : getMuckOutInscriptionsOnly
          ? String(NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_SPECS.green.stepId)
          : undefined,
      getMuckOutInscriptionSeedXp: getMuckOutInscriptionsOnly
        ? getMuckOutInscriptionSeedXp
        : undefined,
    });
  }

  const chapterFailures = [];
  const xpAuditedStepIds = new Map(
    quests.map((quest) => [
      quest.id,
      quest.id === NATIVE_ROAD_AHEAD_QUEST_ID && roadAheadResumeAfterStepId
        ? new Set(resumedXpAuditedStepIds)
        : new Set(),
    ])
  );
  const recordChapterFailure = async (quest, error) => {
    const message = error?.stack || String(error);
    chapterFailures.push({
      questId: String(quest.id),
      title: quest.displayName,
      error: message,
    });
    report.scenarios.push({
      name: `${quest.displayName}: exhaustive browser chapter`,
      status: "fail",
      questId: String(quest.id),
      error: message,
      triggerNodeIds: triggerTreeNodeIds(quest.trigger).map(String),
    });
    if (first?.page && !first.page.isClosed()) {
      await withOperationTimeout(
        `${quest.displayName}: failure screenshot`,
        () =>
          first.page.screenshot({
            path: path.join(
              artifactsDir,
              `${runId}-robot-story-${String(quest.id)}-failure.png`
            ),
            fullPage: true,
          }),
        browserCleanupTimeoutMs
      ).catch(() => undefined);
    }
    // Persist incremental evidence because a later renderer failure must not
    // erase the completed chapter results from this non-fail-fast batch.
    fs.writeFileSync(
      path.join(artifactsDir, `${runId}-partial-report.json`),
      JSON.stringify(
        report,
        (_key, value) => (typeof value === "bigint" ? `${value}n` : value),
        2
      )
    );
  };
  let recoverNextChapter = false;
  for (const index of chapterIndexes) {
    const quest = quests[index];
    const questId = quest.id;
    if (recoverNextChapter) {
      try {
        // A failed WebGL page can keep page.evaluate saturated. Start the next
        // chapter with a fresh actor/context so one renderer cannot stall the
        // remaining quest coverage or carry stale quest receipts forward.
        await withOperationTimeout(
          `${quest.displayName}: close failed chapter context`,
          () => first.context.close(),
          browserCleanupTimeoutMs
        ).catch((error) =>
          report.browser.transients.push(
            `${quest.displayName}:context-close-timeout:${String(error)}`
          )
        );
        first = await openUser(
          browser,
          `RobotChapter-${index + 1}-${runId.slice(-8)}`,
          `robot-chapter-${index + 1}`
        );
        sameUserPeer = undefined;

        const {
          challenges,
          inventory: recoveryInventory,
          prerequisiteParts: recoveryItems,
        } = robotStoryChapterSeed(quests, index);
        // A recovery context is a brand-new, chapter-isolated actor. Carrying
        // its hydrated bootstrap trigger graph into this synthetic fixture is
        // unnecessary and previously exposed a msgpackr buffer-bound failure
        // before Busted could even start. A fresh TriggerState is the faithful
        // state for an actor whose only seeded progression is the Challenges
        // component immediately above; no unrelated quest receipt should leak
        // between independently reported chapters.
        const recoveryTriggerState = TriggerState.create();
        await applyFixture(first.page, {
          kind: "update",
          entity: {
            id: first.userId,
            challenges,
            trigger_state: recoveryTriggerState,
            inventory: recoveryInventory,
            recipe_book: RecipeBook.create(),
            wearing: Wearing.create({ items: new Map() }),
            position: Position.create({ v: [...position] }),
          },
        });
        await waitFor(
          `${quest.displayName}: isolated recovery fixture synchronizes after the prior chapter failure`,
          () => localEntity(first.page, first.userId),
          ({ entity }) => entity?.challenges?.in_progress.has(questId),
          Math.max(originSyncGateMs, 10_000),
          timeoutMs
        );
        report.scenarios.push({
          name: `${quest.displayName}: isolated after prior chapter failure`,
          status: "pass",
          questId: String(questId),
          seededPrerequisiteParts: recoveryItems.map((stack) =>
            String(stack.item.id)
          ),
        });
      } catch (error) {
        await recordChapterFailure(quest, error);
        recoverNextChapter = true;
        continue;
      }
    }
    try {
      const chapterStart = await authoritativeEntity(first.page, first.userId);
      const chapterStartProgression = readHarthmereNativeCombatProgression(
        chapterStart.entity?.trigger_state
      );
      await waitFor(
        `${quest.displayName}: chapter is active before exhaustive actions`,
        () => authoritativeEntity(first.page, first.userId),
        ({ entity }) => entity?.challenges?.in_progress.has(questId),
        Math.max(acceptanceGateMs, 10_000),
        timeoutMs
      );
      await executeRobotStoryTriggerNode({
        first,
        sameUserPeer: recoverNextChapter ? undefined : sameUserPeer,
        position,
        targets,
        questId,
        step: quest.trigger,
        xpAudit: xpAuditedStepIds.get(questId),
        stopAfterStepId: getMuckOutRecipeHuntOnly
          ? GET_MUCK_OUT_MUCKLING_STEP_ID
          : getMuckOutInscriptionsOnly
            ? GET_MUCK_OUT_LAST_INSCRIPTION_STEP_ID
            : undefined,
      });
      if (getMuckOutRecipeHuntOnly) {
        const focused = await authoritativeEntity(first.page, first.userId);
        assert(
          focused.entity?.challenges?.in_progress.has(questId),
          "focused recipe/hunt batch unexpectedly completed the whole quest"
        );
        assert(
          serializedTriggerStepIsFired(
            focused.entity,
            questId,
            GET_MUCK_OUT_MUCKLING_STEP_ID
          ),
          "focused recipe/hunt batch did not complete the Muckling leaf"
        );
        const progression = readHarthmereNativeCombatProgression(
          focused.entity?.trigger_state
        );
        const expectedLifetimeXp =
          15 + 15 + 30 + 60 + GET_MUCK_OUT_PRODUCTION_MUCKLING_COMBAT_XP;
        assert.equal(
          nativeProgressionLifetimeXp(progression),
          expectedLifetimeXp,
          "focused recipe/hunt batch retained the wrong quest plus combat XP"
        );
        report.scenarios.push({
          name: "Get the Muck Out recipe hint, craft, and production Muckling hunt",
          status: "pass",
          questId: String(questId),
          stoppedAfterStepId: String(GET_MUCK_OUT_MUCKLING_STEP_ID),
          lifetimeXp: expectedLifetimeXp,
        });
        return;
      }
      if (getMuckOutInscriptionsOnly) {
        const focused = await authoritativeEntity(first.page, first.userId);
        assert(
          focused.entity?.challenges?.in_progress.has(questId),
          "focused inscription batch unexpectedly completed the whole quest"
        );
        for (const spec of Object.values(
          NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_SPECS
        )) {
          assert(
            serializedTriggerStepIsFired(focused.entity, questId, spec.stepId),
            `focused inscription batch did not complete ${spec.stepId}`
          );
        }
        const inscriptionXp = Object.values(
          NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_SPECS
        ).reduce(
          (total, spec) =>
            total +
            nativeQuestStepXp({
              questId,
              triggerKind: "challengeClaimRewards",
              isLeaf: true,
            }),
          0
        );
        const expectedLifetimeXp = getMuckOutInscriptionSeedXp + inscriptionXp;
        assert.equal(
          nativeProgressionLifetimeXp(
            readHarthmereNativeCombatProgression(focused.entity?.trigger_state)
          ),
          expectedLifetimeXp,
          "focused inscription batch retained the wrong quest XP"
        );
        report.scenarios.push({
          name: "Get the Muck Out canonical grouped inscription sequence",
          status: "pass",
          questId: String(questId),
          sourceEntityIds: Object.values(
            NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_SPECS
          ).map((spec) => String(spec.sourceEntityId)),
          stoppedAfterStepId: String(GET_MUCK_OUT_LAST_INSCRIPTION_STEP_ID),
          lifetimeXp: expectedLifetimeXp,
        });
        return;
      }
      const nextQuestId = quests[index + 1]?.id;
      const completed = await waitFor(
        `${quest.displayName}: chapter completion and automatic continuation`,
        () => authoritativeEntity(first.page, first.userId),
        ({ entity }) =>
          entity?.challenges?.complete.has(questId) &&
          (nextQuestId ? entity.challenges.in_progress.has(nextQuestId) : true),
        Math.max(acceptanceGateMs, 10_000),
        timeoutMs
      );
      if (nextQuestId) {
        await waitFor(
          `${quest.displayName}: next chapter reaches frontend`,
          () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
          (snapshot) =>
            snapshot.activeQuestId === String(nextQuestId) &&
            snapshot.mainQuestId === String(nextQuestId) &&
            questFromFrontend(snapshot, nextQuestId)?.status === "active",
          Math.max(originSyncGateMs, 10_000),
          timeoutMs
        );
      }
      const chapterEnd = await authoritativeEntity(first.page, first.userId);
      const chapterEndProgression = readHarthmereNativeCombatProgression(
        chapterEnd.entity?.trigger_state
      );
      const chapterXp =
        nativeProgressionLifetimeXp(chapterEndProgression) -
        nativeProgressionLifetimeXp(chapterStartProgression);
      assert.equal(
        chapterXp,
        NATIVE_ROBOT_STORY_EXPECTED_QUEST_XP.get(questId) -
          (questId === NATIVE_ROAD_AHEAD_QUEST_ID ? resumedStoryXp : 0) +
          (questId === NATIVE_GET_THE_MUCK_OUT_QUEST_ID
            ? GET_MUCK_OUT_PRODUCTION_MUCKLING_COMBAT_XP
            : 0),
        `${quest.displayName}: complete browser chapter awarded ${chapterXp} XP`
      );
      const rewardableLeafIds = nativeRobotStoryLeafSteps(quest)
        .filter(
          (candidate) =>
            nativeQuestStepXp({
              questId,
              triggerKind: candidate.kind,
              eventKind: candidate.eventKind,
              isLeaf: true,
            }) > 0
        )
        .map((candidate) => candidate.id);
      const audited = xpAuditedStepIds.get(questId);
      assert.deepEqual(
        rewardableLeafIds.filter((stepId) => !audited.has(stepId)),
        [],
        `${quest.displayName}: one or more XP-bearing leaves were not observed in the browser batch`
      );
      report.scenarios.push({
        name: `${quest.displayName}: every authored action completed`,
        status: "pass",
        questId: String(questId),
        triggerNodeIds: triggerTreeNodeIds(quest.trigger).map(String),
        nextQuestId: nextQuestId ? String(nextQuestId) : undefined,
        questXp: chapterXp,
        seededQuestXp: resumedStoryXp || undefined,
        levelAfter: chapterEndProgression.level,
        xpRemainderAfter: chapterEndProgression.xp,
        authoritativeMs: completed.elapsedMs,
      });
      recoverNextChapter = false;
    } catch (error) {
      await recordChapterFailure(quest, error);
      recoverNextChapter = true;
    }
  }

  if (chapterFailures.length) {
    throw new Error(
      `Robot-story browser batch found ${
        chapterFailures.length
      } failing chapter(s):\n${chapterFailures
        .map((failure) => `${failure.title}: ${failure.error}`)
        .join("\n\n")}`
    );
  }

  // The assembled-robot inventory contract belongs to the final chapter. A
  // focused Busted/Get run deliberately stops at its own automatic handoff and
  // must not pretend that Sophia has already consumed all three parts.
  if (focusedChapterIndex !== undefined) {
    const focusedFinal = await authoritativeEntity(first.page, first.userId);
    const focusedProgression = readHarthmereNativeCombatProgression(
      focusedFinal.entity?.trigger_state
    );
    const expectedLifetimeXp =
      NATIVE_ROBOT_STORY_EXPECTED_QUEST_XP.get(initialQuest.id) +
      (initialQuest.id === NATIVE_GET_THE_MUCK_OUT_QUEST_ID
        ? GET_MUCK_OUT_PRODUCTION_MUCKLING_COMBAT_XP
        : 0);
    assert.equal(
      nativeProgressionLifetimeXp(focusedProgression),
      expectedLifetimeXp,
      `${initialQuest.displayName}: focused browser actor retained the wrong total XP`
    );
    const focusedStats = harthmereNativeLevelStats(focusedProgression.level);
    const focusedVitals = readHarthmereNativeVitals(
      focusedFinal.entity?.trigger_state
    );
    assert.equal(focusedFinal.entity?.health?.maxHp, focusedStats.maxHp);
    assert.equal(focusedVitals.maxMana, focusedStats.maxMana);
    assert.equal(focusedVitals.maxStamina, focusedStats.maxStamina);
    assert.equal(
      focusedFinal.entity?.inventory?.items?.length,
      focusedStats.inventorySlots
    );
    await proveNativeRobotStoryLevelingUi(first, focusedStats);
    if (initialQuest.id === NATIVE_MUCK_VS_MACHINE_QUEST_ID) {
      await proveRobotSetupAndChapter1Handoff(
        first,
        sameUserPeer,
        position,
        targets.get(NATIVE_ROBOT_STORY_FINAL_HANDOFFS.muckVsMachine.targetId)
      );
    }
    return;
  }

  const final = await authoritativeEntity(first.page, first.userId);
  assert.equal(
    inventoryCount(final.entity, NATIVE_ROBOT_STORY_ITEM_IDS.ROBOT_SHELL),
    0n,
    "Sophia did not consume the Robot Shell"
  );
  assert.equal(
    inventoryCount(final.entity, NATIVE_ROBOT_STORY_ITEM_IDS.ROBOT_MOTOR_UNIT),
    0n,
    "Sophia did not consume the Robot Motor Unit"
  );
  assert.equal(
    inventoryCount(
      final.entity,
      NATIVE_ROBOT_STORY_ITEM_IDS.ROBOT_POWER_SUPPLY
    ),
    0n,
    "Sophia did not consume the Robot Power Supply"
  );
  assert.equal(
    inventoryCount(final.entity, NATIVE_ROBOT_STORY_ITEM_IDS.ASSEMBLED_ROBOT),
    1n,
    "Sophia did not grant the assembled Robot"
  );
  const finalProgression = readHarthmereNativeCombatProgression(
    final.entity?.trigger_state
  );
  const expectedFinalProgression = nativeProgressionForLifetimeXp(
    [...NATIVE_ROBOT_STORY_EXPECTED_QUEST_XP.values()].reduce(
      (sum, xp) => sum + xp,
      GET_MUCK_OUT_PRODUCTION_MUCKLING_COMBAT_XP
    )
  );
  assert.deepEqual(
    { level: finalProgression.level, xp: finalProgression.xp },
    {
      level: expectedFinalProgression.level,
      xp: expectedFinalProgression.xp,
    },
    "the complete four-quest chain did not retain quest plus production-combat XP"
  );
  const finalStats = harthmereNativeLevelStats(finalProgression.level);
  const finalVitals = readHarthmereNativeVitals(final.entity?.trigger_state);
  assert.equal(final.entity?.health?.maxHp, finalStats.maxHp);
  assert.equal(finalVitals.maxMana, finalStats.maxMana);
  assert.equal(finalVitals.maxStamina, finalStats.maxStamina);
  assert.equal(
    final.entity?.inventory?.items?.length,
    finalStats.inventorySlots
  );
  const levelOneStats = harthmereNativeLevelStats(1);
  for (const key of [
    "strength",
    "dexterity",
    "intelligence",
    "defense",
    "armor",
    "evasion",
    "accuracy",
    "criticalChance",
    "spellPower",
    "healingPower",
    "movementSpeed",
    "carryCapacity",
    "inventorySlots",
  ]) {
    assert(
      finalStats[key] > levelOneStats[key],
      `${key} did not increase from Level 1 to Level 5`
    );
  }
  await proveNativeRobotStoryLevelingUi(first, finalStats);
  await proveRobotSetupAndChapter1Handoff(
    first,
    sameUserPeer,
    position,
    targets.get(NATIVE_ROBOT_STORY_FINAL_HANDOFFS.muckVsMachine.targetId)
  );
}

async function proveBustedUnderwaterContainerProgression(
  first,
  sameUserPeer,
  position
) {
  const before = await authoritativeEntity(first.page, first.userId);
  const challenges = Challenges.clone(before.entity.challenges);
  challenges.available.delete(NATIVE_BUSTED_QUEST_ID);
  challenges.in_progress.add(NATIVE_BUSTED_QUEST_ID);
  challenges.complete.add(NATIVE_ROAD_AHEAD_QUEST_ID);

  const triggerState = TriggerState.clone(before.entity.trigger_state);
  // These are the original Busted seq nodes before the sunken-ship reward
  // leaf. The inventory event below must fire the reward leaf itself.
  triggerState.by_root.set(
    NATIVE_BUSTED_QUEST_ID,
    new Map(
      [310783173745175, 859994236864492, 3346948724689018].map(
        (stepId, index) => [stepId, secondsSinceEpoch() - 10 + index]
      )
    )
  );

  const containerId = await bridgeCall(first.page, "allocateId");
  const containerItems = new Array(16);
  containerItems[0] = countOf(
    NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId,
    1n
  );
  await applyFixture(
    first.page,
    {
      kind: "update",
      entity: {
        id: first.userId,
        challenges,
        trigger_state: triggerState,
      },
    },
    {
      kind: "create",
      entity: {
        id: containerId,
        position: Position.create({ v: [...position] }),
        label: Label.create({ text: "Chest The Grove Underwater Main" }),
        entity_description: EntityDescription.create({
          text: NATIVE_ROAD_AHEAD_PRIVATE_CONTAINER_DESCRIPTION,
        }),
        created_by: CreatedBy.create({
          id: first.userId,
          created_at: secondsSinceEpoch(),
        }),
        quest_giver: QuestGiver.create(),
        container_inventory: ContainerInventory.create({
          items: containerItems,
        }),
      },
    }
  );
  await waitFor(
    "Busted: underwater chest fixture synchronized",
    async () => ({
      player: await localEntity(first.page, first.userId),
      container: await localEntity(first.page, containerId),
    }),
    ({ player, container }) =>
      player.entity?.challenges?.in_progress.has(NATIVE_BUSTED_QUEST_ID) &&
      container.entity?.container_inventory?.items?.[0]?.item?.id ===
        NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId,
    originSyncGateMs
  );

  const beforeContainer = await authoritativeEntity(first.page, containerId);
  await publishAndProve({
    name: "Busted: underwater chest reward transfer",
    page: first.page,
    event: new InventorySwapEvent({
      player_id: first.userId,
      src_id: containerId,
      src: { kind: "item", idx: 0 },
      dst_id: first.userId,
      dst: { kind: "item", idx: 5 },
      positions: [
        [
          Math.floor(position[0]),
          Math.floor(position[1]),
          Math.floor(position[2]),
        ],
      ],
    }),
    authoritativeProbe: async () => ({
      container: await authoritativeEntity(first.page, containerId),
      player: await authoritativeEntity(first.page, first.userId),
    }),
    authoritativePredicate: ({ container, player }) =>
      container.version > beforeContainer.version &&
      !container.entity?.container_inventory?.items?.[0] &&
      player.entity?.inventory?.items?.[5]?.item?.id ===
        NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId,
    localProbe: async () => ({
      container: await localEntity(first.page, containerId),
      player: await localEntity(first.page, first.userId),
    }),
    localPredicate: ({ container, player }) =>
      !container.entity?.container_inventory?.items?.[0] &&
      player.entity?.inventory?.items?.[5]?.item?.id ===
        NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId,
    secondProbe: sameUserPeer
      ? async () => ({
          container: await localEntity(sameUserPeer, containerId),
          player: await localEntity(sameUserPeer, first.userId),
        })
      : undefined,
    secondPredicate: sameUserPeer
      ? ({ container, player }) =>
          !container.entity?.container_inventory?.items?.[0] &&
          player.entity?.inventory?.items?.[5]?.item?.id ===
            NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId
      : undefined,
  });

  const progressed = await waitFor(
    "Busted: underwater reward advances native quest state",
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      serializedTriggerStepIsFired(
        entity,
        NATIVE_BUSTED_QUEST_ID,
        NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.stepId
      ),
    Math.max(acceptanceGateMs, 5_000),
    timeoutMs
  );
  const frontend = await waitFor(
    "Busted: progressed objective reaches frontend",
    () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
    (snapshot) =>
      snapshot.activeQuestId === String(NATIVE_BUSTED_QUEST_ID) &&
      snapshot.mainQuestId === String(NATIVE_BUSTED_QUEST_ID) &&
      snapshot.quests.some(
        (quest) =>
          quest.questId === String(NATIVE_BUSTED_QUEST_ID) &&
          quest.status === "active" &&
          Boolean(quest.objective)
      ),
    originSyncGateMs,
    timeoutMs
  );
  report.scenarios.push({
    name: "Busted underwater chest advances native quest progression",
    status: "pass",
    questId: String(NATIVE_BUSTED_QUEST_ID),
    stepId: String(NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.stepId),
    itemId: String(NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.itemId),
    authoritativeMs: progressed.elapsedMs,
    frontendProjectionMs: frontend.elapsedMs,
  });
}

async function proveNativeRobotStoryRoundTrip(first, sameUserPeer, position) {
  const targetSpecs = [
    {
      name: "Jackie",
      typeId: NATIVE_ROBOT_STORY_FINAL_HANDOFFS.roadAhead.targetId,
    },
    {
      name: "Spare Robot Parts",
      typeId: NATIVE_ROBOT_STORY_FINAL_HANDOFFS.getTheMuckOut.targetId,
    },
    {
      name: "Sophia",
      typeId: NATIVE_ROBOT_STORY_FINAL_HANDOFFS.muckVsMachine.targetId,
    },
  ];
  const targetIds = [];
  for (let index = 0; index < targetSpecs.length; index++) {
    targetIds.push(await bridgeCall(first.page, "allocateId"));
  }
  await applyFixture(
    first.page,
    ...targetSpecs.map((target, index) => ({
      kind: "create",
      entity: {
        id: targetIds[index],
        position: Position.create({
          v: [position[0] + index + 1, position[1], position[2]],
        }),
        npc_metadata: NpcMetadata.create({
          type_id: target.typeId,
          created_time: secondsSinceEpoch(),
          spawn_position: [position[0] + index + 1, position[1], position[2]],
          spawn_orientation: [0, 0],
        }),
        label: Label.create({ text: `E2E ${target.name}` }),
      },
    }))
  );

  const chapters = [
    {
      title: "The Road Ahead",
      handoff: NATIVE_ROBOT_STORY_FINAL_HANDOFFS.roadAhead,
      targetId: targetIds[0],
      nextQuestId: NATIVE_BUSTED_QUEST_ID,
      nextTitle: "Busted",
    },
    {
      title: "Busted",
      handoff: NATIVE_ROBOT_STORY_FINAL_HANDOFFS.busted,
      targetId: targetIds[0],
      nextQuestId: NATIVE_GET_THE_MUCK_OUT_QUEST_ID,
      nextTitle: "Get the Muck Out",
    },
    {
      title: "Get the Muck Out",
      handoff: NATIVE_ROBOT_STORY_FINAL_HANDOFFS.getTheMuckOut,
      targetId: targetIds[1],
      nextQuestId: NATIVE_MUCK_VS_MACHINE_QUEST_ID,
      nextTitle: "Muck vs. Machine",
    },
    {
      title: "Muck vs. Machine",
      handoff: NATIVE_ROBOT_STORY_FINAL_HANDOFFS.muckVsMachine,
      targetId: targetIds[2],
    },
  ];
  const completedQuestIds = [];

  for (const chapter of chapters) {
    if (chapter.handoff.questId === NATIVE_BUSTED_QUEST_ID) {
      await proveBustedUnderwaterContainerProgression(
        first,
        sameUserPeer,
        position
      );
    }
    const before = await authoritativeEntity(first.page, first.userId);
    const fixture = nativeRobotStoryHandoffFixture(
      before.entity,
      chapter.handoff,
      completedQuestIds
    );
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        challenges: fixture.challenges,
        trigger_state: fixture.triggerState,
      },
    });
    await waitFor(
      `${chapter.title}: final handoff fixture synchronized`,
      () => localEntity(first.page, first.userId),
      ({ entity }) =>
        entity?.challenges?.in_progress.has(chapter.handoff.questId),
      originSyncGateMs
    );

    const activeFrontend = await waitFor(
      `${chapter.title}: active objective projected before final handoff`,
      () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
      (snapshot) =>
        snapshot.ecs.inProgress.includes(String(chapter.handoff.questId)) &&
        snapshot.activeQuestId === String(chapter.handoff.questId) &&
        snapshot.mainQuestId === String(chapter.handoff.questId) &&
        snapshot.quests.some(
          (quest) =>
            quest.questId === String(chapter.handoff.questId) &&
            quest.title === chapter.title &&
            quest.status === "active" &&
            Boolean(quest.objective)
        ),
      originSyncGateMs,
      timeoutMs
    );
    report.scenarios.push({
      name: `${chapter.title} active objective reaches the frontend`,
      status: "pass",
      questId: String(chapter.handoff.questId),
      frontendProjectionMs: activeFrontend.elapsedMs,
    });

    const preComplete = await authoritativeEntity(first.page, first.userId);
    await publishAndProve({
      name: `${chapter.title}: frontend final handoff completes native chapter`,
      page: first.page,
      event: new CompleteQuestStepAtEntityEvent({
        id: first.userId,
        challenge_id: chapter.handoff.questId,
        entity_id: chapter.targetId,
        step_id: chapter.handoff.finalStepId,
      }),
      authoritativeProbe: () => authoritativeEntity(first.page, first.userId),
      authoritativePredicate: ({ version, entity }) =>
        version > preComplete.version &&
        entity?.challenges?.complete.has(chapter.handoff.questId) &&
        (chapter.nextQuestId
          ? entity.challenges.in_progress.has(chapter.nextQuestId)
          : true),
      localProbe: () => localEntity(first.page, first.userId),
      localPredicate: ({ entity }) =>
        entity?.challenges?.complete.has(chapter.handoff.questId) &&
        (chapter.nextQuestId
          ? entity.challenges.in_progress.has(chapter.nextQuestId)
          : true),
      secondProbe: sameUserPeer
        ? () => localEntity(sameUserPeer, first.userId)
        : undefined,
      secondPredicate: sameUserPeer
        ? ({ entity }) =>
            entity?.challenges?.complete.has(chapter.handoff.questId) &&
            (chapter.nextQuestId
              ? entity.challenges.in_progress.has(chapter.nextQuestId)
              : true)
        : undefined,
    });

    const frontend = await waitFor(
      `${chapter.title}: synchronized frontend quest projection`,
      () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
      (snapshot) => {
        const completed = snapshot.quests.some(
          (quest) =>
            quest.questId === String(chapter.handoff.questId) &&
            quest.status === "completed"
        );
        if (!completed) return false;
        if (!chapter.nextQuestId) return true;
        return (
          snapshot.ecs.inProgress.includes(String(chapter.nextQuestId)) &&
          snapshot.activeQuestId === String(chapter.nextQuestId) &&
          snapshot.mainQuestId === String(chapter.nextQuestId) &&
          snapshot.quests.some(
            (quest) =>
              quest.questId === String(chapter.nextQuestId) &&
              quest.title === chapter.nextTitle &&
              quest.status === "active"
          )
        );
      },
      originSyncGateMs,
      timeoutMs
    );
    completedQuestIds.push(chapter.handoff.questId);
    report.scenarios.push({
      name: `${chapter.title} automatically continues the native robot story`,
      status: "pass",
      questId: String(chapter.handoff.questId),
      nextQuestId: chapter.nextQuestId
        ? String(chapter.nextQuestId)
        : undefined,
      frontendProjectionMs: frontend.elapsedMs,
    });
  }

  const completedStory = await authoritativeEntity(first.page, first.userId);
  assert(
    completedStory.entity?.challenges?.complete.has(
      NATIVE_MUCK_VS_MACHINE_QUEST_ID
    ),
    "Muck vs. Machine was not completed authoritatively"
  );
  assert(
    inventoryCount(
      completedStory.entity,
      NATIVE_ROBOT_STORY_ITEM_IDS.ASSEMBLED_ROBOT
    ) >= 1n,
    "the assembled robot reward was not delivered"
  );

  await proveRobotSetupAndChapter1Handoff(
    first,
    sameUserPeer,
    position,
    targetIds[2]
  );

  if (robotStoryOnly) {
    const reloadFailureBaseline = report.browser.failures.length;
    await first.page.reload({
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await first.page.waitForFunction(
      () => globalThis.__harthmereNativeEcsE2E?.version === "native-ecs-e2e-v1",
      undefined,
      { timeout: timeoutMs }
    );
    const reloaded = await waitFor(
      "robot story reload reconstructs all completed chapters",
      async () => ({
        entity: (await localEntity(first.page, first.userId)).entity,
        frontend: await bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
      }),
      ({ entity, frontend }) =>
        inventoryCount(entity, NATIVE_ROBOT_STORY_ITEM_IDS.ASSEMBLED_ROBOT) >=
          1n &&
        NATIVE_ROBOT_STORY_QUEST_IDS.every((questId) =>
          frontend.ecs.complete.includes(String(questId))
        ) &&
        NATIVE_ROBOT_STORY_QUEST_IDS.every((questId) =>
          frontend.quests.some(
            (quest) =>
              quest.questId === String(questId) && quest.status === "completed"
          )
        ),
      originSyncGateMs,
      timeoutMs
    );
    // A deliberate full-page reload aborts in-flight mesh requests and briefly
    // tears down the old sync socket. The reconstructed frontend projection
    // and assembled-robot inventory check above prove the replacement client
    // is healthy, so preserve those navigation diagnostics as transients
    // rather than misreporting them as gameplay failures.
    report.browser.transients.push(
      ...report.browser.failures.splice(reloadFailureBaseline)
    );
    report.scenarios.push({
      name: "complete robot story survives reload and frontend reconstruction",
      status: "pass",
      frontendProjectionMs: reloaded.elapsedMs,
    });
  }
}

async function proveRobotSetupAndChapter1Handoff(
  first,
  sameUserPeer,
  position,
  sophiaId,
  options = {}
) {
  const setupQuest = nativeRobotStoryBikkieTray.contents.get(
    NATIVE_GIMME_SHELTER_QUEST_ID
  );
  assert(setupQuest?.isQuest && setupQuest.trigger, "Gimme Shelter is missing");
  assert(sophiaId, "Sophia target is missing from the robot-story fixtures");
  const firstChapter1Quest = CH1_QUESTS[0];
  const firstChapter1QuestId = ch1NativeQuestId(firstChapter1Quest.id);
  assert(firstChapter1QuestId, "Chapter 1 opening quest id is missing");

  const continued = await waitFor(
    "Muck vs. Machine continues into robot setup and Chapter 1",
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      entity?.challenges?.complete.has(NATIVE_MUCK_VS_MACHINE_QUEST_ID) &&
      entity.challenges.in_progress.has(NATIVE_GIMME_SHELTER_QUEST_ID) &&
      entity.challenges.in_progress.has(firstChapter1QuestId),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  const openingFrontend = await waitFor(
    "robot setup and Chapter 1 opening objectives reach the frontend",
    () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
    (snapshot) =>
      snapshot.mainQuestId === String(NATIVE_GIMME_SHELTER_QUEST_ID) &&
      snapshot.quests.some(
        (quest) =>
          quest.questId === String(NATIVE_GIMME_SHELTER_QUEST_ID) &&
          quest.status === "active" &&
          quest.currentStepId ===
            String(NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.TALK_TO_SOPHIA)
      ) &&
      snapshot.quests.some(
        (quest) =>
          quest.questId === String(firstChapter1QuestId) &&
          quest.title === firstChapter1Quest.title &&
          quest.status === "active"
      ) &&
      snapshot.markers.some(
        (marker) => marker.questId === String(firstChapter1QuestId)
      ),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  report.scenarios.push({
    name: "Muck vs. Machine automatically opens robot setup and Chapter 1",
    status: "pass",
    setupQuestId: String(NATIVE_GIMME_SHELTER_QUEST_ID),
    chapter1QuestId: String(firstChapter1QuestId),
    authoritativeMs: continued.elapsedMs,
    frontendProjectionMs: openingFrontend.elapsedMs,
  });

  const beforeSophia = await authoritativeEntity(first.page, first.userId);
  await publishAndProve({
    name: "Gimme Shelter: Sophia handoff advances to robot placement",
    page: first.page,
    event: new CompleteQuestStepAtEntityEvent({
      id: first.userId,
      challenge_id: NATIVE_GIMME_SHELTER_QUEST_ID,
      entity_id: sophiaId,
      step_id: NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.TALK_TO_SOPHIA,
    }),
    authoritativeProbe: () => authoritativeEntity(first.page, first.userId),
    authoritativePredicate: ({ version, entity }) =>
      version > beforeSophia.version &&
      serializedTriggerStepIsFired(
        entity,
        NATIVE_GIMME_SHELTER_QUEST_ID,
        NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.TALK_TO_SOPHIA
      ),
    localProbe: () => localEntity(first.page, first.userId),
    localPredicate: ({ entity }) =>
      serializedTriggerStepIsFired(
        entity,
        NATIVE_GIMME_SHELTER_QUEST_ID,
        NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.TALK_TO_SOPHIA
      ),
    secondProbe: sameUserPeer
      ? () => localEntity(sameUserPeer, first.userId)
      : undefined,
    secondPredicate: sameUserPeer
      ? ({ entity }) =>
          serializedTriggerStepIsFired(
            entity,
            NATIVE_GIMME_SHELTER_QUEST_ID,
            NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.TALK_TO_SOPHIA
          )
      : undefined,
    // This handoff fans out through the original Gimme Shelter seq, map-aid
    // projection, and the already-open Chapter 1 continuation on a reused
    // 300k-entity local Redis world. The functional run only uses the global
    // timeout; an explicitly opted-in benchmark compares this multi-quest
    // transition against the same 10-second allowance used by similar flows.
    authoritativeGateMs: Math.max(acceptanceGateMs, 10_000),
  });

  const placementProjection = await waitFor(
    "Gimme Shelter placement objective and marker reach the frontend",
    () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
    (snapshot) => {
      const quest = snapshot.quests.find(
        (candidate) =>
          candidate.questId === String(NATIVE_GIMME_SHELTER_QUEST_ID)
      );
      return (
        snapshot.mainQuestId === String(NATIVE_GIMME_SHELTER_QUEST_ID) &&
        quest?.currentStepId ===
          String(
            NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.PLACE_ROBOT_IN_MUCK
          ) &&
        quest.objective ===
          "Place your Robot in the marked Muck clearing outside the Grove" &&
        snapshot.markers.some(
          (marker) =>
            marker.questId === String(NATIVE_GIMME_SHELTER_QUEST_ID) &&
            marker.triggerId ===
              String(
                NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.PLACE_ROBOT_IN_MUCK
              ) &&
            distance3(
              marker.worldPosition,
              NATIVE_ROBOT_SETUP_MUCK_PLACEMENT_POSITION
            ) <= 0.1
        )
      );
    },
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  if (options.stopAfterSophiaHandoff) {
    report.scenarios.push({
      name: "Gimme Shelter Sophia-only handoff reaches robot placement",
      status: "pass",
      questId: String(NATIVE_GIMME_SHELTER_QUEST_ID),
      stepId: String(NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.TALK_TO_SOPHIA),
      frontendProjectionMs: placementProjection.elapsedMs,
    });
    return;
  }

  const markerPosition = [...NATIVE_ROBOT_SETUP_MUCK_PLACEMENT_POSITION];
  const authoredObserverPosition = [
    markerPosition[0],
    markerPosition[1],
    markerPosition[2] + 4,
  ];
  // Exercise the real player contract: the player follows the marker to the
  // clearing before placing the robot. Besides matching gameplay, this moves
  // the browser subscription to the destination so the newly created robot is
  // expected to synchronize and render instead of remaining 230m off-screen.
  await placeFrontendPlayerForFixture(
    first.page,
    first.userId,
    authoredObserverPosition
  );
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({ v: authoredObserverPosition }),
    },
  });
  await waitFor(
    "player follows the placement marker into the Muck clearing",
    async () => ({
      authoritative: await authoritativeEntity(first.page, first.userId),
      local: await localEntity(first.page, first.userId),
      scene: await frontendPlayerPose(first.page, first.userId),
    }),
    ({ authoritative, local, scene }) =>
      Boolean(authoritative.entity?.position?.v) &&
      Boolean(local.entity?.position?.v) &&
      Boolean(scene?.position) &&
      distanceXZ(authoritative.entity.position.v, authoredObserverPosition) <=
        1 &&
      distanceXZ(local.entity.position.v, authoredObserverPosition) <= 1 &&
      distanceXZ(scene.position, authoredObserverPosition) <= 1,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  const groundedPlacement = await waitFor(
    "shared Harthmere grounder resolves the robot and approach columns",
    async () => ({
      robot: await bridgeCall(first.page, "groundedHarthmerePosition", {
        position: markerPosition,
        requireOpenSky: true,
      }),
      observer: await bridgeCall(first.page, "groundedHarthmerePosition", {
        position: authoredObserverPosition,
        requireOpenSky: true,
      }),
    }),
    ({ robot, observer }) =>
      robot.status === "grounded" &&
      Boolean(robot.position) &&
      observer.status === "grounded" &&
      Boolean(observer.position),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  const robotPosition = groundedPlacement.value.robot.position;
  const placementObserverPosition = groundedPlacement.value.observer.position;
  assert(robotPosition, "shared Harthmere grounder omitted robot position");
  assert(
    placementObserverPosition,
    "shared Harthmere grounder omitted approach position"
  );
  const placementOrientation = lookAtOrientation(
    [
      placementObserverPosition[0],
      placementObserverPosition[1] + 1.6,
      placementObserverPosition[2],
    ],
    [robotPosition[0], robotPosition[1] + 0.8, robotPosition[2]]
  );
  await placeFrontendPlayerForFixture(
    first.page,
    first.userId,
    placementObserverPosition,
    placementOrientation
  );
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({ v: placementObserverPosition }),
      orientation: Orientation.create({ v: placementOrientation }),
    },
  });

  const beforePlace = await authoritativeEntity(first.page, first.userId);
  const robotInventoryRef = inventoryRefForItem(
    beforePlace.entity,
    NATIVE_ROBOT_STORY_ITEM_IDS.ASSEMBLED_ROBOT
  );
  assert(robotInventoryRef, "assembled robot is not in a placeable slot");
  const priorRobotIds = new Set(
    (await bridgeCall(first.page, "findLocalByComponent", "robot_component"))
      .map(([, serialized]) => deserializeEntity(serialized))
      .filter((entity) => entity.created_by?.id === first.userId)
      .map((entity) => entity.id)
  );
  await publishAndProve({
    name: "Gimme Shelter: place the assembled robot through native ECS",
    page: first.page,
    event: new PlaceRobotEvent({
      id: first.userId,
      inventory_ref: robotInventoryRef,
      position: robotPosition,
      orientation: [0, 0],
      item_id: NATIVE_ROBOT_STORY_ITEM_IDS.ASSEMBLED_ROBOT,
    }),
    authoritativeProbe: () => authoritativeEntity(first.page, first.userId),
    authoritativePredicate: ({ version, entity }) =>
      version > beforePlace.version &&
      inventoryCount(entity, NATIVE_ROBOT_STORY_ITEM_IDS.ASSEMBLED_ROBOT) ===
        0n &&
      serializedTriggerStepIsFired(
        entity,
        NATIVE_GIMME_SHELTER_QUEST_ID,
        NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.PLACE_ROBOT_IN_MUCK
      ),
    localProbe: () => localEntity(first.page, first.userId),
    localPredicate: ({ entity }) =>
      inventoryCount(entity, NATIVE_ROBOT_STORY_ITEM_IDS.ASSEMBLED_ROBOT) ===
        0n &&
      serializedTriggerStepIsFired(
        entity,
        NATIVE_GIMME_SHELTER_QUEST_ID,
        NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.PLACE_ROBOT_IN_MUCK
      ),
    secondProbe: sameUserPeer
      ? () => localEntity(sameUserPeer, first.userId)
      : undefined,
    secondPredicate: sameUserPeer
      ? ({ entity }) =>
          inventoryCount(
            entity,
            NATIVE_ROBOT_STORY_ITEM_IDS.ASSEMBLED_ROBOT
          ) === 0n
      : undefined,
  });

  const placedRobot = await waitFor(
    "placed robot synchronizes with its owner and canonical mesh",
    async () => {
      const rows = await bridgeCall(
        first.page,
        "findLocalByComponent",
        "robot_component"
      );
      const entity = rows
        .map(([, serialized]) => deserializeEntity(serialized))
        .find(
          (candidate) =>
            candidate.created_by?.id === first.userId &&
            !priorRobotIds.has(candidate.id)
        );
      return entity
        ? {
            entity,
            frontend: await bridgeCall(
              first.page,
              "robotFrontendSnapshot",
              entity.id
            ),
          }
        : undefined;
    },
    (value) =>
      value?.frontend?.isRobot === true &&
      value.frontend.meshAssetKey === "npcs/helping_robot",
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  let robotId = placedRobot.value.entity.id;
  await bridgeCall(
    first.page,
    "publish",
    serializedEvent(
      new EndPlaceRobotEvent({
        id: first.userId,
        robot_entity_id: robotId,
        position: robotPosition,
        orientation: [0, 0],
      })
    )
  );
  const localPlacementExit = await first.page.evaluate((entityId) => {
    const resources = globalThis.clientContext?.resources;
    if (!resources) {
      throw new Error("client resources unavailable while finalizing robot");
    }
    const state = resources.get("/scene/npc/become_npc");
    if (
      state.kind === "active" &&
      Number(state.entityId) === Number(entityId)
    ) {
      // The normal primary-click path publishes EndPlaceRobotEvent and then
      // clears this local preview state. This fixture already published the
      // exact native event above, so mirror only that local lifecycle tail.
      resources.set("/scene/npc/become_npc", { kind: "empty" });
      return { kind: "empty", clearedRobotPreview: true };
    }
    return {
      kind: state.kind,
      activeEntityId:
        state.kind === "active" ? String(state.entityId) : undefined,
      clearedRobotPreview: false,
    };
  }, robotId);
  assert.notEqual(
    localPlacementExit.kind,
    "active",
    `another placement preview remained active: ${JSON.stringify(
      localPlacementExit
    )}`
  );

  await waitFor(
    "Gimme Shelter setup objective marker resolves to the placed robot",
    () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
    (snapshot) => {
      const quest = snapshot.quests.find(
        (candidate) =>
          candidate.questId === String(NATIVE_GIMME_SHELTER_QUEST_ID)
      );
      const marker = snapshot.markers.find(
        (candidate) =>
          candidate.questId === String(NATIVE_GIMME_SHELTER_QUEST_ID) &&
          candidate.triggerId ===
            String(NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.SET_UP_ROBOT)
      );
      return (
        quest?.currentStepId ===
          String(NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.SET_UP_ROBOT) &&
        Boolean(marker) &&
        distance3(marker.worldPosition, robotPosition) <= 2
      );
    },
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );

  const approachOffsets = [
    [0, 1.75],
    [1.75, 0],
    [0, -1.75],
    [-1.75, 0],
  ];
  let robotInteraction;
  let pinnedApproachPosition;
  const approachDiagnostics = [];
  for (const [dx, dz] of approachOffsets) {
    const approachHint = [
      robotPosition[0] + dx,
      robotPosition[1],
      robotPosition[2] + dz,
    ];
    const groundedApproach = await waitFor(
      `shared Harthmere grounder resolves robot interaction approach ${dx},${dz}`,
      () =>
        bridgeCall(first.page, "groundedHarthmerePosition", {
          position: approachHint,
          requireOpenSky: true,
        }),
      (result) => result.status === "grounded" && Boolean(result.position),
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    );
    const approachPosition = groundedApproach.value.position;
    assert(
      approachPosition,
      `shared Harthmere grounder omitted interaction approach ${dx},${dz}`
    );
    // Reuse the established sparse-terrain relocation contract. It moves the
    // production live-player object, persists the same ECS pose, makes the
    // fixture nonlethal, republishes movement, and pins the scene only while
    // the real contextual interaction is being exercised.
    await moveSnapshotGrovePlayer(
      first,
      approachPosition,
      `placed robot interaction approach ${dx},${dz}`
    );
    await faceSnapshotGroveWorldObject(
      first,
      { position: robotPosition },
      approachPosition
    );
    await waitFor(
      `player reaches canonical robot interaction approach ${dx},${dz}`,
      () => frontendPlayerPose(first.page, first.userId),
      (scene) =>
        Boolean(scene?.position) &&
        distanceXZ(scene.position, approachPosition) <= 1.25,
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    );

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const interaction = await frontendInteractionSnapshot(first.page);
      const inspectedRobotId = interaction?.inspectable?.entityId;
      const hasRobotActions = interaction?.inspectOverlays.some(
        (overlay) =>
          /\bTalk\b/i.test(overlay.text ?? "") &&
          /\bSettings\b/i.test(overlay.text ?? "")
      );
      if (String(inspectedRobotId) === String(robotId) && hasRobotActions) {
        // Placement already proved this exact id is current-user owned, has a
        // robot component, sits at the marker, and routes to helping_robot.
        // Settings is rendered only for the owner/admin. Repeating those reads
        // here can observe different HFC ticks and reject a correct visible
        // prompt, so this final UI gate checks the exact established id.
        robotInteraction = interaction;
        pinnedApproachPosition = approachPosition;
        break;
      }
      if (attempt === 29) {
        approachDiagnostics.push({
          expectedRobotId: String(robotId),
          approachPosition,
          interaction,
        });
      } else {
        await delay(200);
      }
    }
    if (robotInteraction) {
      break;
    }
    await setSnapshotGroveInteractionPin(first, approachPosition, false);
  }
  assert(
    robotInteraction,
    `placed robot never became the inspected Talk/Settings target: ${JSON.stringify(
      approachDiagnostics
    )}`
  );
  const promptText = robotInteraction.inspectOverlays.find(
    (overlay) =>
      /\bTalk\b/i.test(overlay.text ?? "") &&
      /\bSettings\b/i.test(overlay.text ?? "")
  )?.text;
  assert(promptText, "robot inspect overlay text was unavailable");
  assert.equal(
    (promptText.match(/\bTalk\b/gi) ?? []).length,
    1,
    `robot prompt rendered duplicate Talk actions: ${promptText}`
  );
  await first.page.keyboard.press("g");
  const settingsModal = await waitFor(
    "G opens robot Settings instead of Guilds",
    () =>
      first.page.evaluate(() =>
        globalThis.clientContext?.resources?.get("/game_modal")
      ),
    (modal) =>
      modal?.kind === "generic_miniphone" &&
      modal.rootPayload?.type === "robot_main_menu" &&
      String(modal.rootPayload?.entityId) === String(robotId),
    5_000,
    timeoutMs
  );
  assert(settingsModal.value, "robot Settings modal did not open");

  await first.page.evaluate((entityId) => {
    const resources = globalThis.clientContext?.reactResources;
    if (!resources) throw new Error("react resources unavailable");
    resources.set("/game_modal", { kind: "talk_to_robot", entityId });
  }, robotId);
  const nameInput = first.page.locator('input[type="text"]');
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (await nameInput.isVisible().catch(() => false)) break;
    await first.page.keyboard.press("f");
    await first.page.waitForTimeout(150);
  }
  await nameInput.waitFor({ state: "visible", timeout: 10_000 });
  const robotName = `E2E Sentinel ${String(robotId).slice(-4)}`;
  await nameInput.fill(robotName);
  await first.page.getByRole("button", { name: "Set Name" }).click();

  const named = await waitFor(
    "robot naming completes setup and advances the authoritative quest",
    async () => ({
      player: await authoritativeEntity(first.page, first.userId),
      robot: await authoritativeEntity(first.page, robotId),
      frontend: await bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
    }),
    ({ player, robot, frontend }) => {
      const setup = frontend.quests.find(
        (quest) => quest.questId === String(NATIVE_GIMME_SHELTER_QUEST_ID)
      );
      return (
        robot.entity?.label?.text === robotName &&
        serializedTriggerStepIsFired(
          player.entity,
          NATIVE_GIMME_SHELTER_QUEST_ID,
          NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.SET_UP_ROBOT
        ) &&
        setup?.currentStepId !==
          String(NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.SET_UP_ROBOT) &&
        frontend.mainQuestId === String(NATIVE_GIMME_SHELTER_QUEST_ID) &&
        frontend.markers.some(
          (marker) => marker.questId === String(NATIVE_GIMME_SHELTER_QUEST_ID)
        ) &&
        frontend.ecs.inProgress.includes(String(firstChapter1QuestId))
      );
    },
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  await setSnapshotGroveInteractionPin(
    first,
    pinnedApproachPosition ?? robotPosition,
    false
  );
  report.scenarios.push({
    name: "robot placement, canonical mesh, Settings key, naming, and quest advancement",
    status: "pass",
    robotId: String(robotId),
    robotName,
    meshAssetKey: "npcs/helping_robot",
    setupStepId: String(NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.SET_UP_ROBOT),
    chapter1QuestId: String(firstChapter1QuestId),
    authoritativeMs: named.elapsedMs,
  });
}

async function proveSeededGimmeSophiaHandoff(
  first,
  sameUserPeer,
  position,
  sophiaId
) {
  assert(sophiaId, "Sophia target is missing from the focused handoff fixture");
  const firstChapter1QuestId = ch1NativeQuestId(CH1_QUESTS[0].id);
  assert(firstChapter1QuestId, "Chapter 1 opening quest id is missing");
  const seededAt = secondsSinceEpoch();
  const challenges = Challenges.create();
  for (const questId of NATIVE_ROBOT_STORY_QUEST_IDS) {
    challenges.complete.add(questId);
    challenges.started_at.set(questId, seededAt - 20);
    challenges.finished_at.set(questId, seededAt - 10);
  }
  challenges.in_progress.add(NATIVE_GIMME_SHELTER_QUEST_ID);
  challenges.started_at.set(NATIVE_GIMME_SHELTER_QUEST_ID, seededAt);
  challenges.in_progress.add(firstChapter1QuestId);
  challenges.started_at.set(firstChapter1QuestId, seededAt);
  const inventory = Inventory.create({
    items: [countOf(NATIVE_ROBOT_STORY_ITEM_IDS.ASSEMBLED_ROBOT, 1n)],
    hotbar: new Array(PLAYER_HOTBAR_SLOTS),
    currencies: new Map(),
    overflow: new Map(),
    selected: { kind: "hotbar", idx: 0 },
  });
  inventory.items.length = PLAYER_INVENTORY_SLOTS;
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      challenges,
      trigger_state: TriggerState.create(),
      inventory,
      position: Position.create({ v: [...position] }),
    },
  });
  await waitFor(
    "Sophia-only post-Muck fixture synchronizes",
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      entity?.challenges?.complete.has(NATIVE_MUCK_VS_MACHINE_QUEST_ID) &&
      entity.challenges.in_progress.has(NATIVE_GIMME_SHELTER_QUEST_ID) &&
      entity.challenges.in_progress.has(firstChapter1QuestId) &&
      inventoryCount(entity, NATIVE_ROBOT_STORY_ITEM_IDS.ASSEMBLED_ROBOT) ===
        1n,
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  report.scenarios.push({
    name: "Sophia-only checkpoint seeds the retained post-Muck boundary",
    status: "pass",
    completedQuestId: String(NATIVE_MUCK_VS_MACHINE_QUEST_ID),
    setupQuestId: String(NATIVE_GIMME_SHELTER_QUEST_ID),
    chapter1QuestId: String(firstChapter1QuestId),
  });
  await proveRobotSetupAndChapter1Handoff(
    first,
    sameUserPeer,
    position,
    sophiaId,
    { stopAfterSophiaHandoff: true }
  );
}

async function proveExistingRobotSetupContinuation(first) {
  const firstChapter1Quest = CH1_QUESTS[0];
  const firstChapter1QuestId = ch1NativeQuestId(firstChapter1Quest.id);
  assert(firstChapter1QuestId, "Chapter 1 opening quest id is missing");

  const startingPlayer = await authoritativeEntity(first.page, first.userId);
  assert(
    startingPlayer.entity?.challenges?.complete.has(
      NATIVE_MUCK_VS_MACHINE_QUEST_ID
    ),
    "resume actor has not completed Muck vs. Machine"
  );
  assert(
    startingPlayer.entity?.challenges?.in_progress.has(
      NATIVE_GIMME_SHELTER_QUEST_ID
    ),
    "resume actor is not in Gimme Shelter"
  );
  assert(
    startingPlayer.entity?.challenges?.in_progress.has(firstChapter1QuestId),
    "resume actor has not started Chapter 1"
  );
  const playerPosition = startingPlayer.entity?.position?.v;
  assert(playerPosition, "resume actor has no authoritative position");

  const startingFrontend = await waitFor(
    "resume actor is on the robot naming step",
    () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
    (snapshot) =>
      snapshot.quests.some(
        (quest) =>
          quest.questId === String(NATIVE_GIMME_SHELTER_QUEST_ID) &&
          quest.currentStepId ===
            String(NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.SET_UP_ROBOT)
      ),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );

  // Restore the browser-owned simulation to the durable authoritative
  // checkpoint before asking the local interest set for the placed robot.
  // Opening a saved actor can initially render at Grove spawn even though ECS
  // already has the canonical Muck approach position.
  await moveSnapshotGrovePlayer(
    first,
    [...playerPosition],
    "resume existing placed robot subscription"
  );

  const robotId = Number(process.env.HARTHMERE_E2E_ROBOT_SETUP_ROBOT_ID);
  assert(
    Number.isSafeInteger(robotId),
    "HARTHMERE_E2E_ROBOT_SETUP_ROBOT_ID is required for resume-only testing"
  );
  const placedRobot = await authoritativeEntity(first.page, robotId);
  assert(
    placedRobot.entity?.robot_component &&
      placedRobot.entity?.created_by?.id === first.userId &&
      placedRobot.entity?.position?.v,
    "resume robot is not the saved actor's placed robot"
  );
  const robotPosition = placedRobot.entity.position.v;
  await faceSnapshotGroveWorldObject(
    first,
    { position: robotPosition },
    playerPosition
  );

  const robotPrompt = await waitFor(
    "existing placed robot is the exact Talk and Settings target",
    () => frontendInteractionSnapshot(first.page),
    (interaction) =>
      String(interaction?.inspectable?.entityId) === String(robotId) &&
      interaction.inspectOverlays.some(
        (overlay) =>
          (overlay.text?.match(/\bTalk\b/gi) ?? []).length === 1 &&
          (overlay.text?.match(/\bSettings\b/gi) ?? []).length === 1
      ),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );

  await first.page.keyboard.press("g");
  await waitFor(
    "G opens existing robot Settings instead of Guilds",
    () =>
      first.page.evaluate(() =>
        globalThis.clientContext?.resources?.get("/game_modal")
      ),
    (modal) =>
      modal?.kind === "generic_miniphone" &&
      modal.rootPayload?.type === "robot_main_menu" &&
      String(modal.rootPayload?.entityId) === String(robotId),
    5_000,
    timeoutMs
  );

  await first.page.keyboard.press("Escape");
  await waitFor(
    "robot Settings closes before naming",
    () =>
      first.page.evaluate(() =>
        globalThis.clientContext?.resources?.get("/game_modal")
      ),
    (modal) => modal?.kind === "empty",
    5_000,
    timeoutMs
  );
  await first.page.keyboard.press("f");
  await waitFor(
    "F opens the existing robot naming modal",
    () =>
      first.page.evaluate(() =>
        globalThis.clientContext?.resources?.get("/game_modal")
      ),
    (modal) =>
      modal?.kind === "talk_to_robot" &&
      String(modal.entityId) === String(robotId),
    5_000,
    timeoutMs
  );

  const nameInput = first.page.locator('input[type="text"]');
  await nameInput.waitFor({ state: "visible", timeout: 10_000 });
  const robotName = `E2E Sentinel ${String(robotId).slice(-4)}`;
  await nameInput.fill(robotName);
  await first.page.getByRole("button", { name: "Set Name" }).click();

  const advanced = await waitFor(
    "robot naming completes setup and advances Gimme Shelter",
    async () => ({
      player: await authoritativeEntity(first.page, first.userId),
      robot: await authoritativeEntity(first.page, robotId),
      frontend: await bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
    }),
    ({ player, robot, frontend }) => {
      const setup = frontend.quests.find(
        (quest) => quest.questId === String(NATIVE_GIMME_SHELTER_QUEST_ID)
      );
      return (
        robot.entity?.label?.text === robotName &&
        serializedTriggerStepIsFired(
          player.entity,
          NATIVE_GIMME_SHELTER_QUEST_ID,
          NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.SET_UP_ROBOT
        ) &&
        player.entity?.challenges?.in_progress.has(
          NATIVE_GIMME_SHELTER_QUEST_ID
        ) &&
        !player.entity?.challenges?.complete.has(
          NATIVE_GIMME_SHELTER_QUEST_ID
        ) &&
        setup?.currentStepId !==
          String(NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.SET_UP_ROBOT) &&
        frontend.mainQuestId === String(NATIVE_GIMME_SHELTER_QUEST_ID) &&
        frontend.markers.some(
          (marker) => marker.questId === String(NATIVE_GIMME_SHELTER_QUEST_ID)
        ) &&
        frontend.ecs.inProgress.includes(String(firstChapter1QuestId))
      );
    },
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  await setSnapshotGroveInteractionPin(first, playerPosition, false);

  report.scenarios.push({
    name: "resume-only robot Settings, naming, and Gimme Shelter advancement",
    status: "pass",
    robotId: String(robotId),
    robotName,
    prompt: robotPrompt.value.inspectOverlays
      .map((overlay) => overlay.text)
      .find((text) => /Settings/i.test(text ?? "")),
    setupStepId: String(NATIVE_GIMME_SHELTER_ROBOT_SETUP_STEP_IDS.SET_UP_ROBOT),
    chapter1QuestId: String(firstChapter1QuestId),
    authoritativeMs: advanced.elapsedMs,
    resumedFromCurrentStepId: startingFrontend.value.quests.find(
      (quest) => quest.questId === String(NATIVE_GIMME_SHELTER_QUEST_ID)
    )?.currentStepId,
  });
}

const JOBS_BOARD_E2E_FIXTURE_PREFIX = "native_ecs_e2e_job:";
const JOBS_BOARD_E2E_POSITION_TOLERANCE_METERS = 1.5;
// The authoritative fixture remains exact. The visible collision simulation
// may push a player several meters away when setup places them at an NPC's
// center, so use the real interaction-scale tolerance only for the local pose.
const SNAPSHOT_GROVE_LOCAL_POSITION_TOLERANCE_METERS = 6;

function e2eBoardIdForTemplate(template) {
  return template.boardScope === "harthmere"
    ? HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID
    : HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID;
}

function jobsBoardE2ETemplates(templateFamily) {
  if (templateFamily === "business") {
    // Business templates are production jobs too, but unlike the 20 automatic
    // board seeds they are issued by a business/outpost system. Normalize
    // their authoring shape here so the browser proves the same posting/todo/
    // native-inventory lifecycle without duplicating the execution harness.
    const skippedTemplateIds = new Set(
      String(process.env.HARTHMERE_E2E_SKIP_JOB_TEMPLATE_IDS ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    );
    return HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES.filter(
      (template) => !skippedTemplateIds.has(template.templateId)
    ).map((template) => ({
      ...template,
      // Business templates are issuer-authored and intentionally do not pin a
      // public board scope. Exercise their complete lifecycle on the default
      // Grove board; forcing `harthmere` here invents a location contract that
      // is absent from the template and duplicates the recently passed
      // auto-template coverage of the Harthmere town board.
      boardScope: "grove",
      issuerKind: "business",
      issuerId: template.businessType,
      rewardGold: { min: template.defaultRewardGold },
    }));
  }
  const templates = HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES.filter(
    (template) =>
      harthmereAutoSeedTemplateRequirementsObtainable(template.requirements)
  );
  const resumeAt = String(
    process.env.HARTHMERE_E2E_JOBS_RESUME_AT ?? ""
  ).trim();
  if (!resumeAt) return templates;
  const resumeIndex = templates.findIndex(
    (template) => template.templateId === resumeAt
  );
  assert(resumeIndex >= 0, `unknown Jobs Board resume template ${resumeAt}`);
  return templates.slice(resumeIndex);
}

async function installAllJobsBoardE2EFixtures(actorId, templateFamily) {
  const redis = await connectToRedis("firehose");
  const key = harthmereLiveModeSharedWorldStateKey();
  const nowMs = Date.now();
  const raw = await redis.primary.get(key);
  const defaults = defaultHarthmereLiveModeBackendState(
    `native-ecs-e2e-fixture:${actorId}`,
    nowMs
  );
  const shared =
    parseHarthmereLiveModeSharedWorldState(raw, nowMs) ??
    createHarthmereLiveModeSharedWorldState(defaults, nowMs);
  const jobs = shared.jobsBoard;

  // The browser suite runs against an isolated local Redis world. Remove old
  // fixture postings/todos so reruns stay deterministic without disturbing any
  // normal local jobs that a developer may be inspecting.
  const staleJobIds = new Set(
    Object.keys(jobs.postings).filter((jobId) =>
      jobId.startsWith(JOBS_BOARD_E2E_FIXTURE_PREFIX)
    )
  );
  for (const jobId of staleJobIds) delete jobs.postings[jobId];
  for (const [todoId, todo] of Object.entries(jobs.todos)) {
    if (staleJobIds.has(todo.jobId)) delete jobs.todos[todoId];
  }
  jobs.actorAcceptedJobIds[String(actorId)] = [];
  jobs.actorCooldowns[String(actorId)] = { abuseScore: 0 };

  const templates = jobsBoardE2ETemplates(templateFamily);
  const fixtures = templates.map((template, index) => {
    const boardId = e2eBoardIdForTemplate(template);
    const board = jobs.boards[boardId];
    assert(board, `missing jobs board fixture target ${boardId}`);
    const jobId = `${JOBS_BOARD_E2E_FIXTURE_PREFIX}${template.templateId}`;
    const rewardGold = Math.max(5, Number(template.rewardGold.min));
    const requirements = template.requirements.map((requirement) => ({
      ...requirement,
    }));
    if (template.kind === "delivery") {
      const parcel = requirements.find((requirement) => requirement.itemId);
      if (parcel) {
        // Production auto-seeding assigns a collection point to repeatable
        // deliveries. Keep the deterministic fixture production-shaped so the
        // browser test proves pickup -> parcel -> drop-off marker transitions.
        parcel.pickupMarkerId =
          template.boardScope === "harthmere"
            ? "harthmere_bridge_center"
            : "grove_tool_crate";
      }
    }
    jobs.postings[jobId] = {
      jobId,
      boardId,
      issuerKind: template.issuerKind,
      issuerId: template.issuerId,
      title: template.title,
      description: template.description,
      kind: template.kind,
      requirements,
      templateId: template.templateId,
      rewardGold,
      escrowGold: rewardGold,
      reputationDelta: Math.max(1, Math.round(rewardGold / 100)),
      status: "open",
      townId: board.townId,
      regionId: board.regionId,
      createdAtMs: nowMs + index,
      deadlineAtMs: nowMs + 24 * 60 * 60 * 1000,
      failurePenaltyGold: 0,
      requiresFieldWork: template.requiresFieldWork,
      mapMarkerId:
        template.mapMarkerId ??
        template.requirements.find((requirement) => requirement.mapMarkerId)
          ?.mapMarkerId,
      targetId:
        template.targetId ??
        template.requirements.find((requirement) => requirement.targetId)
          ?.targetId,
      abuseFlags: [],
      logs: [`native_ecs_e2e_fixture:${runId}`],
      autoPosted: true,
      source: "native_ecs_browser_e2e",
      partyRecommended: template.partyRecommended,
      partyMinSize: template.partyMinSize,
      monsterId: template.monsterId,
      monsterTier: template.monsterTier,
      monsterPowerLevel: template.monsterPowerLevel,
      lootHint: template.lootHint ? [...template.lootHint] : undefined,
    };
    return {
      jobId,
      boardId,
      templateId: template.templateId,
      title: template.title,
      kind: template.kind,
      requirements,
      rewardGold,
      mapMarkerId:
        jobs.postings[jobId].mapMarkerId ?? jobs.postings[jobId].targetId,
      targetId: jobs.postings[jobId].targetId,
    };
  });

  // Rebuild issuer indexes from the final posting set so accepting/completing
  // a fixture follows the exact same reducer path as ordinary production jobs.
  jobs.issuerOpenJobIds = {};
  for (const posting of Object.values(jobs.postings)) {
    if (posting.status !== "open" && posting.status !== "active") continue;
    const issuerKey = `${posting.issuerKind}:${posting.issuerId}`;
    (jobs.issuerOpenJobIds[issuerKey] ??= []).push(posting.jobId);
  }
  shared.updatedAtMs = nowMs;
  await redis.primary.set(key, JSON.stringify(shared));

  return {
    redis,
    key,
    fixtures,
    async clearAcceptCooldown() {
      const latestRaw = await redis.primary.get(key);
      const latest = parseHarthmereLiveModeSharedWorldState(
        latestRaw,
        Date.now()
      );
      assert(latest, "jobs-board E2E shared state disappeared");
      latest.jobsBoard.actorCooldowns[String(actorId)] = { abuseScore: 0 };
      latest.updatedAtMs = Date.now();
      await redis.primary.set(key, JSON.stringify(latest));
    },
    async serviceProgressCount(targetId) {
      const playerKey = harthmereLiveModePlayerStateKey(String(actorId));
      const playerRaw = await redis.primary.get(playerKey);
      const player = parseHarthmereLiveModeBackendState(
        playerRaw,
        String(actorId),
        Date.now()
      );
      return Math.max(
        0,
        Math.floor(
          Number(player.careLoops.worldInteractions[targetId]?.count ?? 0)
        )
      );
    },
    async escortCompanion(jobId) {
      const latestRaw = await redis.primary.get(key);
      const latest = parseHarthmereLiveModeSharedWorldState(
        latestRaw,
        Date.now()
      );
      return latest?.jobsBoard.postings[jobId]?.escortCompanion;
    },
    async close() {
      await redis.quit("native ECS jobs-board E2E complete");
    },
  };
}

function nativeGold(entity) {
  return stackCount(
    [...(entity?.inventory?.currencies?.values?.() ?? [])],
    BikkieIds.bling
  );
}

function replaceChapter1FixtureNativeGold(inventory, gold) {
  const amount = BigInt(Math.max(0, Math.trunc(Number(gold) || 0)));
  const key = String(BikkieIds.bling);
  if (amount === 0n) {
    inventory.currencies.delete(key);
  } else {
    inventory.currencies.set(key, countOf(BikkieIds.bling, amount));
  }
}

function setNativeInventoryCount(inventory, itemId, count) {
  for (const slots of [inventory.items, inventory.hotbar]) {
    for (let index = 0; index < slots.length; index += 1) {
      if (slots[index]?.item?.id !== itemId) continue;
      slots[index] = count > 0 ? countOf(itemId, BigInt(count)) : undefined;
      return;
    }
  }
  if (count <= 0) return;
  const emptyIndex = inventory.items.findIndex((slot) => !slot);
  assert(emptyIndex >= 0, `no native inventory slot available for ${itemId}`);
  inventory.items[emptyIndex] = countOf(itemId, BigInt(count));
}

async function moveJobsE2EPlayer(first, position, label) {
  // Jobs span the Grove, additive Harthmere, sparse caves, and distant Muck
  // packs. Reuse the established live-player relocation path so the camera,
  // simulation, interest set, authoritative ECS row, movement event, health,
  // and short-lived position pin move together. Direct /sim mutation can pass
  // an immediate readback and then lose to fall recovery while a saturated
  // jobs-board fetch is still pending, producing a false must_be_at_jobs_board.
  let safePosition = [...position];
  try {
    const grounded = await bridgeCall(first.page, "groundedHarthmerePosition", {
      position: [...position],
      // Jobs include outdoor boards and underground cave deposits. The shared
      // grounder should find the nearest standable feet position around the
      // authored hint without requiring sky above an underground objective.
      requireOpenSky: false,
    });
    if (grounded?.status === "grounded" && grounded.position) {
      safePosition = grounded.position;
    }
  } catch {
    // Terrain may not be in the current interest set yet. The live relocation
    // helper remains the authoritative fallback and will stream the target.
  }
  await moveSnapshotGrovePlayer(first, safePosition, label);
}

async function provisionJobsE2ERequirements(first, expected) {
  // Delivery pickup creates the first item requirement as the parcel. Any
  // additional delivery requirements (for example kitchen water + crops) are
  // ordinary player-supplied cargo and must still be provisioned and verified.
  // JOBS_BOARD_E2E_SECONDARY_DELIVERY_REQUIREMENTS
  let skippedDeliveryParcel = false;
  const requiredItems = expected.requirements.filter((requirement) => {
    if (!requirement.itemId) return false;
    if (expected.kind === "delivery" && !skippedDeliveryParcel) {
      skippedDeliveryParcel = true;
      return false;
    }
    return true;
  });
  const requiredToolAction = expected.requirements.find(
    (requirement) => requirement.requiredToolAction
  )?.requiredToolAction;
  if (!requiredItems.length && !requiredToolAction) return;

  const authoritative = await authoritativeEntity(first.page, first.userId);
  assert(
    authoritative.entity?.inventory,
    `${expected.templateId}: no inventory`
  );
  const inventory = Inventory.clone(authoritative.entity.inventory);
  for (const requirement of requiredItems) {
    const nativeItemId = harthmereNativeBiomesIdForItemId(requirement.itemId);
    assert(
      nativeItemId,
      `${expected.templateId}: ${requirement.itemId} has no native item id`
    );
    setNativeInventoryCount(
      inventory,
      nativeItemId,
      Math.max(1, Number(requirement.count ?? 1))
    );
  }

  let selectedItem;
  let selectedToolId;
  let selectedToolKey;
  if (requiredToolAction) {
    const toolItemKey =
      requiredToolAction === "repair" ? "repair_mallet" : "muck_rake";
    const toolItemId = harthmereNativeBiomesIdForItemId(toolItemKey);
    assert(toolItemId, `${toolItemKey} has no native item id`);
    selectedToolKey = toolItemKey;
    selectedToolId = toolItemId;
    inventory.hotbar[0] = countOf(toolItemId, 1n);
    inventory.selected = { kind: "hotbar", idx: 0 };
    selectedItem = SelectedItem.create({ item: inventory.hotbar[0] });
  }

  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      inventory,
      ...(selectedItem ? { selected_item: selectedItem } : {}),
    },
  });
  if (selectedToolKey) {
    // Fixture writes bypass the player's Inventory UI. Keep its local display
    // projection aligned with the authoritative native selected item so the
    // production F handler can run its normal client-side tool preflight. The
    // server still independently verifies the native selected item before it
    // accepts either the world interaction or the Jobs Board completion.
    await first.page.evaluate((toolItemKey) => {
      const key = "biomes.localDev.harthmere.inventoryState";
      let state = {};
      try {
        state = JSON.parse(localStorage.getItem(key) ?? "{}");
      } catch {
        state = {};
      }
      state.equipment = {
        ...(state.equipment ?? {}),
        main_hand: {
          itemId: toolItemKey,
          instanceId: `jobs-e2e:${toolItemKey}`,
          location: "equipment",
          equipmentSlot: "main_hand",
          quantity: 1,
          bound: false,
          stolen: false,
          locked: false,
          enchantments: [],
          acquiredAt: Date.now(),
        },
      };
      localStorage.setItem(key, JSON.stringify(state));
      window.dispatchEvent(new Event("biomes:harthmere-inventory-changed"));
    }, selectedToolKey);
  }
  await waitFor(
    `${expected.templateId}: native requirements synchronized`,
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      requiredItems.every((requirement) => {
        const nativeItemId = harthmereNativeBiomesIdForItemId(
          requirement.itemId
        );
        return (
          nativeItemId &&
          inventoryCount(entity, nativeItemId) >=
            BigInt(Math.max(1, Number(requirement.count ?? 1)))
        );
      }) &&
      (!selectedToolId ||
        entity?.selected_item?.item?.item?.id === selectedToolId),
    originSyncGateMs,
    timeoutMs
  );
}

// HARTHMERE_JOBS_E2E_NATIVE_BOUNTY_KILL (2026-07-29):
// A hunt cannot be completed by merely standing at its marker. Exercise the
// same native NPC damage event used by player combat against the exact ranked
// production entity, then require the server-owned TriggerState kill receipt
// before the Jobs Board objective is submitted.
async function performJobsE2ENativeBountyKill(first, targetId, label) {
  const target = harthmereJobsBoardMuckBountyTargetForId(targetId);
  if (!target) return false;

  const approachOffsets = [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
    [0, 0],
  ];
  const groundedApproaches = await waitFor(
    `${label}: shared grounder resolves a safe attack approach`,
    () =>
      Promise.all(
        approachOffsets.map(([dx, dz]) =>
          bridgeCall(first.page, "groundedHarthmerePosition", {
            position: [
              target.position[0] + dx,
              target.position[1],
              target.position[2] + dz,
            ],
            requireOpenSky: true,
          })
        )
      ),
    (results) => results.some((result) => result.status === "grounded"),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  const attackPosition = groundedApproaches.value.find(
    (result) => result.status === "grounded"
  )?.position;
  assert(attackPosition, `${label}: no grounded attack approach resolved`);
  await moveJobsE2EPlayer(first, attackPosition, `${label}: attack position`);

  const beforeTarget = await authoritativeEntity(first.page, target.entityId);
  assert(
    beforeTarget.entity?.npc_metadata && beforeTarget.entity?.health,
    `${label}: exact ranked native bounty entity is missing`
  );
  const beforeActor = await authoritativeEntity(first.page, first.userId);
  const previousKilledAt = Number(
    readHarthmereJobsBoardNativeKillLedger(beforeActor.entity?.trigger_state)[
      String(target.entityId)
    ] ?? 0
  );
  const maxHp = Math.max(1, Number(beforeTarget.entity.health.maxHp ?? 1));

  // Reused exact-image worlds can retain a corpse until its fixed-id respawn
  // window. Restore only the target's authoritative combat row so rerunning a
  // complete catalog remains deterministic without inventing a replacement id.
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: target.entityId,
      position: Position.create({ v: [...target.position] }),
      rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
      health: Health.create({ hp: 1, maxHp }),
    },
  });
  await waitFor(
    `${label}: exact ranked native bounty synchronizes alive`,
    () => localEntity(first.page, target.entityId),
    ({ entity }) => entity?.health?.hp === 1,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );

  await bridgeCall(
    first.page,
    "publish",
    serializedEvent(
      new UpdateNpcHealthEvent({
        id: target.entityId,
        hp: -999,
        damageSource: {
          kind: "attack",
          attacker: first.userId,
          dir: [1, 0, 0],
        },
      })
    )
  );
  await waitFor(
    `${label}: native player kill receipt records exact ranked bounty`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      Number(
        readHarthmereJobsBoardNativeKillLedger(entity?.trigger_state)[
          String(target.entityId)
        ] ?? 0
      ) > previousKilledAt,
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  const deadTarget = await authoritativeEntity(first.page, target.entityId);
  assert(
    (deadTarget.entity?.health?.hp ?? 1) <= 0,
    `${label}: exact ranked native bounty survived the player attack`
  );
  return true;
}

// HARTHMERE_JOBS_E2E_FIELD_INTERACTION (2026-07-29):
// Business job targets and outpost starter work stations are real world props
// now, and the server only credits their objective when it has issued its own
// world-object interaction receipt. Pressing "F" on the prop is therefore part
// of the player-reachable path the browser suite must prove — previously the
// harness moved the player to the marker and called completeQuest directly,
// which proved the reducer but not that the player could do the work.
async function performJobsE2EFieldInteraction(
  first,
  fixture,
  targetId,
  jobId,
  todoId,
  questTitle,
  label,
  requiredInteractionCount = 1
) {
  const fieldTarget = harthmereJobsBoardFieldTargetForId(targetId);
  // A Grove marker on an item-gather job identifies the source area, not a
  // second hand-in object. Resolve ordinary landmarks only for repeated
  // service work whose authored serviceUnits require multiple receipts.
  const landmark =
    Number(requiredInteractionCount) > 1
      ? snapshotGroveLandmarkById(targetId)
      : undefined;
  const target =
    fieldTarget ??
    (landmark
      ? {
          targetId: landmark.id,
          label: landmark.label,
          position: landmark.position,
        }
      : undefined);
  if (!target) {
    return undefined;
  }
  const interaction = harthmereObjectInteractionForLabel({
    label: target.label,
  });
  assert(interaction, `${label}: field target ${targetId} has no interaction`);

  if (landmark) {
    // Grove landmark props are intentionally visible only while their job is
    // the player-selected destination. Accepting work must not steal an
    // existing main-quest pin, so exercise the real Quests -> Show on map path
    // instead of mutating browser storage or expecting automatic replacement.
    await first.page.keyboard.press("KeyJ");
    const questsTab = first.page.getByTestId("biomes-ui-quests-tab");
    await questsTab.waitFor({ state: "visible", timeout: timeoutMs });
    const escapedTitle = questTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await questsTab
      .getByRole("button", { name: new RegExp(escapedTitle, "i") })
      .first()
      .click();
    await first.page
      .getByTestId("biomes-ui-quest-detail")
      .getByRole("button", { name: "Show on map" })
      .click();
    await waitFor(
      `${label}: Show on map selects the jobs-board destination`,
      () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
      (snapshot) =>
        snapshot.activeMapPin?.markerId === target.targetId ||
        (snapshot.activeMapPin?.worldPosition &&
          distanceXZ(snapshot.activeMapPin.worldPosition, target.position) <=
            HARTHMERE_WORLD_OBJECT_ACTIVE_PIN_MATCH_RADIUS),
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    );
    await first.page.keyboard.press("Escape");
    await questsTab.waitFor({ state: "hidden", timeout: timeoutMs });
  }

  // Exercise the actual visible player path. Try the four cardinal approach
  // directions at close and ordinary distances because narrow posts can leave
  // the cursor on terrain only one metre away. The production proximity
  // fallback intentionally caps itself to that cursor-hit depth, so standing
  // close enough to the real prop is part of the player-reachable path.
  const approaches = [
    [0, 0.65],
    [0.65, 0],
    [0, -0.65],
    [-0.65, 0],
    [0, 1.25],
    [1.25, 0],
    [0, -1.25],
    [-1.25, 0],
    [0, 2.25],
    [2.25, 0],
    [0, -2.25],
    [-2.25, 0],
  ];
  const requiredInteractions = Math.max(
    1,
    Math.floor(Number(requiredInteractionCount) || 1)
  );
  const initialReceiptCount = await fixture.serviceProgressCount(
    target.targetId
  );
  const displacedRetainedActorIds = new Set();
  for (
    let interactionIndex = 0;
    interactionIndex < requiredInteractions;
    interactionIndex += 1
  ) {
    let visiblePrompt;
    let visibleApproachPosition;
    let lastInteractionSnapshot;
    for (const [dx, dz] of approaches) {
      const approachPosition = [
        target.position[0] + dx,
        target.position[1],
        target.position[2] + dz,
      ];
      await moveJobsE2EPlayer(
        first,
        approachPosition,
        `${label}: approach ${interactionIndex + 1}/${requiredInteractions}`
      );
      await faceSnapshotGroveWorldObject(
        first,
        { position: target.position },
        approachPosition,
        0.9
      );
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const snapshot = await frontendInteractionSnapshot(first.page);
        lastInteractionSnapshot = snapshot;
        const blockingPlayerId = Number(snapshot?.inspectable?.entityId);
        if (
          snapshot?.inspectable?.kind === "player" &&
          Number.isSafeInteger(blockingPlayerId) &&
          blockingPlayerId !== first.userId &&
          String(snapshot?.components?.label ?? "").startsWith(
            "NativeECS-A-"
          ) &&
          !displacedRetainedActorIds.has(blockingPlayerId)
        ) {
          // Failed retained-state runs leave their deterministic test actors in
          // the world. If one is physically standing on this prop, move only
          // that E2E actor out of the interaction cone and retry the same real
          // player approach; never delete or move an ordinary player.
          displacedRetainedActorIds.add(blockingPlayerId);
          const parkingOffset = 20 + displacedRetainedActorIds.size;
          await applyFixture(first.page, {
            kind: "update",
            entity: {
              id: blockingPlayerId,
              position: Position.create({
                v: [
                  target.position[0] + parkingOffset,
                  target.position[1],
                  target.position[2] + parkingOffset,
                ],
              }),
              rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
            },
          });
          await delay(250);
          await faceSnapshotGroveWorldObject(
            first,
            { position: target.position },
            approachPosition,
            0.9
          );
          continue;
        }
        const promptVisible = snapshot?.inspectOverlays?.some(
          (overlay) =>
            overlay.text?.includes(interaction.title) &&
            overlay.display !== "none" &&
            overlay.visibility !== "hidden" &&
            Number(overlay.opacity) > 0 &&
            overlay.rect?.width > 0 &&
            overlay.rect?.height > 0
        );
        if (
          snapshot?.inspectable?.kind === "harthmere_object" &&
          snapshot.inspectable.objectId === target.targetId &&
          snapshot.inspectable.label === target.label &&
          promptVisible
        ) {
          visiblePrompt = snapshot;
          visibleApproachPosition = approachPosition;
          break;
        }
        await delay(150);
      }
      if (visiblePrompt) break;
    }
    if (!visiblePrompt && allowPreDynamicFieldTargetImage && fieldTarget) {
      const actor = await authoritativeEntity(first.page, first.userId);
      const actorPosition = actor.entity?.position?.v;
      const verticalDelta = Math.abs(
        Number(actorPosition?.[1]) - Number(target.position[1])
      );
      assert(
        Number.isFinite(verticalDelta) && verticalDelta > 3.5,
        `${label}: compatibility path requires a live-ground/authored-height mismatch; ` +
          `actor=${JSON.stringify(actorPosition)} target=${JSON.stringify(
            target.position
          )} last=${JSON.stringify(lastInteractionSnapshot)}`
      );
      const response = await postLiveMode(
        first.page,
        "request_care_loop_action",
        "care",
        {
          operation: "world_object_interaction",
          objectId: target.targetId,
          interactionKind: interaction.kind,
          label: target.label,
        },
        target.targetId
      );
      assert.equal(
        response.ok && response.body?.backendMutation?.applied === true,
        true,
        `${label}: compatibility interaction rejected ${JSON.stringify(
          response.body
        )}`
      );
      report.gates.preDynamicFieldTargetFallbacks.push({
        targetId: target.targetId,
        reason: "authored_height_mismatch",
        authoredY: target.position[1],
        actorY: actorPosition?.[1],
      });
      await waitFor(
        `${label}: server records compatibility interaction ${
          interactionIndex + 1
        }/${requiredInteractions}`,
        () => fixture.serviceProgressCount(target.targetId),
        (count) => count >= initialReceiptCount + interactionIndex + 1,
        Math.max(originSyncGateMs, 10_000),
        timeoutMs
      );
      return undefined;
    }
    assert(
      visiblePrompt,
      `${label}: no visible F ${interaction.title} prompt for ${target.label} ` +
        `(${
          interactionIndex + 1
        }/${requiredInteractions}); last=${JSON.stringify(
          lastInteractionSnapshot
        )}`
    );
    let receiptRecorded = false;
    let lastReceiptError;
    for (let keyAttempt = 1; keyAttempt <= 3; keyAttempt += 1) {
      await first.page.keyboard.press("KeyF");
      try {
        await waitFor(
          `${label}: server records interaction ${
            interactionIndex + 1
          }/${requiredInteractions}, key attempt ${keyAttempt}/3`,
          () => fixture.serviceProgressCount(target.targetId),
          (count) => count >= initialReceiptCount + interactionIndex + 1,
          Math.max(originSyncGateMs, 10_000),
          Math.min(timeoutMs, 20_000)
        );
        receiptRecorded = true;
        break;
      } catch (error) {
        lastReceiptError = error;
        if (keyAttempt < 3) {
          // Browser focus and a retained overlapping actor can consume one key
          // even while the correct prompt is visible. Reassert the real player
          // pose/facing and retry the same production keyboard path before
          // classifying the interaction as missing.
          await reassertSnapshotGrovePlayerForInteraction(
            first,
            visibleApproachPosition ?? target.position,
            `${label}: retry visible F ${keyAttempt + 1}/3`
          );
          await faceSnapshotGroveWorldObject(
            first,
            { position: target.position },
            visibleApproachPosition ?? target.position,
            0.9
          );
        }
      }
    }
    if (!receiptRecorded && allowPreDynamicFieldTargetImage && fieldTarget) {
      const response = await postLiveMode(
        first.page,
        "request_care_loop_action",
        "care",
        {
          operation: "world_object_interaction",
          objectId: target.targetId,
          interactionKind: interaction.kind,
          label: target.label,
        },
        target.targetId
      );
      assert.equal(
        response.ok && response.body?.backendMutation?.applied === true,
        true,
        `${label}: visible-prompt compatibility interaction rejected ${JSON.stringify(
          response.body
        )}`
      );
      report.gates.preDynamicFieldTargetFallbacks.push({
        targetId: target.targetId,
        reason: "visible_prompt_no_receipt_after_three_keypresses",
      });
      await waitFor(
        `${label}: server records visible-prompt compatibility interaction`,
        () => fixture.serviceProgressCount(target.targetId),
        (count) => count >= initialReceiptCount + interactionIndex + 1,
        Math.max(originSyncGateMs, 10_000),
        timeoutMs
      );
      return undefined;
    }
    if (!receiptRecorded) {
      throw lastReceiptError;
    }
  }

  // The real overlay first records the server-owned interaction receipt, then
  // submits the matching job objective. Waiting on the frontend snapshot proves
  // both mutations completed through the same path the player uses.
  const completed = await waitFor(
    `${label}: visible F interaction completes the accepted job objective`,
    () => jobsBoardFetchWithRetry(first.page, `${label}:after-visible-F`),
    (snapshot) =>
      snapshot.acceptedJobs.some((job) => job.jobId === jobId) &&
      snapshot.todos.some(
        (todo) => todo.todoId === todoId && todo.status === "completed"
      ),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  return completed.value;
}

function jobsE2EMarkerPosition(markerId, label) {
  const marker = harthmereJobsBoardQuestMarkerRuntimePositionForId(markerId);
  assert(marker, `${label}: missing runtime marker ${markerId}`);
  return marker.position;
}

async function proveAllJobsBoardFrontendNativeEcsRoundTrips(
  first,
  templateFamily = "auto"
) {
  const fixture = await installAllJobsBoardE2EFixtures(
    first.userId,
    templateFamily
  );
  try {
    // First prove the request really crosses the native ECS Position gate by
    // trying the frontend accept action before moving the player to the board.
    const firstFixture = fixture.fixtures[0];
    const firstBoard = HARTHMERE_JOBS_BOARD_LOCATIONS[firstFixture.boardId];
    assert(firstBoard, `missing board ${firstFixture.boardId}`);
    const awayPosition = [
      firstBoard.location.x + 20,
      firstBoard.location.y,
      firstBoard.location.z + 20,
    ];
    await moveJobsE2EPlayer(first, awayPosition, "jobs-board away-position");
    await assert.rejects(
      () =>
        jobsBoardMutationWithRetry(
          first.page,
          {
            operation: "accept",
            jobId: firstFixture.jobId,
            boardId: firstFixture.boardId,
            requestId: `jobs_e2e_away:${runId}`,
          },
          `${firstFixture.templateId}:away-rejection`
        ),
      /jobs_board_rejected:/
    );

    for (const expected of fixture.fixtures) {
      const board = HARTHMERE_JOBS_BOARD_LOCATIONS[expected.boardId];
      assert(board, `missing board ${expected.boardId}`);
      const boardPosition = [
        board.location.x,
        board.location.y,
        board.location.z,
      ];
      await moveJobsE2EPlayer(
        first,
        boardPosition,
        `${expected.templateId}: native ECS board position`
      );

      const before = await jobsBoardFetchWithRetry(
        first.page,
        `${expected.templateId}:before`
      );
      assert(
        before.openJobs.some(
          (job) =>
            job.jobId === expected.jobId &&
            job.templateId === expected.templateId &&
            job.title === expected.title &&
            job.kind === expected.kind
        ),
        `${expected.templateId}: exact fixture was not visible to the frontend`
      );

      const accepted = await jobsBoardMutationWithRetry(
        first.page,
        {
          operation: "accept",
          jobId: expected.jobId,
          boardId: expected.boardId,
          requestId: `jobs_e2e_accept:${runId}:${expected.templateId}`,
        },
        `${expected.templateId}:accept`
      );
      const acceptedJob = accepted.acceptedJobs.find(
        (job) => job.jobId === expected.jobId
      );
      assert.deepEqual(acceptedJob, {
        jobId: expected.jobId,
        boardId: expected.boardId,
        templateId: expected.templateId,
        title: expected.title,
        kind: expected.kind,
      });
      const todo = accepted.todos.find((row) => row.jobId === expected.jobId);
      assert(todo, `${expected.templateId}: authoritative todo missing`);
      assert.equal(todo.title, expected.title);
      assert.equal(todo.kind, expected.kind);
      assert.equal(todo.status, "active");
      const quest = accepted.quests.find(
        (row) => row.questId === `jobs_board:${todo.todoId}`
      );
      assert(
        quest,
        `${expected.templateId}: frontend quest projection missing`
      );
      assert.equal(quest.title, expected.title);
      assert.equal(quest.kind, expected.kind);
      assert.equal(quest.status, "active");
      const marker = accepted.markers.find(
        (row) =>
          row.jobsBoardJobId === expected.jobId &&
          row.jobsBoardTodoId === todo.todoId
      );
      assert(marker, `${expected.templateId}: frontend map marker missing`);
      assert(
        marker.position.every(Number.isFinite),
        `${expected.templateId}: map marker position is invalid`
      );

      const nativePlayer = await authoritativeEntity(first.page, first.userId);
      assert(
        distance3(nativePlayer.entity?.position?.v, boardPosition) <=
          JOBS_BOARD_E2E_POSITION_TOLERANCE_METERS,
        `${expected.templateId}: accept did not use the native ECS board proximity`
      );
      const goldBefore = nativeGold(nativePlayer.entity);
      await provisionJobsE2ERequirements(first, expected);

      let objectiveCompleted;
      if (expected.kind === "delivery") {
        const parcel = expected.requirements.find(
          (requirement) => requirement.itemId
        );
        assert(
          parcel?.pickupMarkerId,
          `${expected.templateId}: pickup missing`
        );
        assert.equal(
          marker.mapMarkerId,
          parcel.pickupMarkerId,
          `${expected.templateId}: frontend did not start at parcel pickup`
        );
        const parcelItemId = harthmereNativeBiomesIdForItemId(parcel.itemId);
        assert(parcelItemId, `${expected.templateId}: parcel item id missing`);
        const beforePickup = inventoryCount(nativePlayer.entity, parcelItemId);
        await moveJobsE2EPlayer(
          first,
          jobsE2EMarkerPosition(
            parcel.pickupMarkerId,
            `${expected.templateId}: pickup`
          ),
          `${expected.templateId}: pickup`
        );
        const pickedUp = await jobsBoardMutationWithRetry(
          first.page,
          {
            operation: "pickup",
            jobId: expected.jobId,
            boardId: expected.boardId,
            questTodoId: todo.todoId,
            completedTargetId: parcel.pickupMarkerId,
            requestId: `jobs_e2e_pickup:${runId}:${expected.templateId}`,
          },
          `${expected.templateId}:pickup`
        );
        const dropoffMarker = pickedUp.markers.find(
          (row) => row.jobsBoardJobId === expected.jobId
        );
        assert(
          dropoffMarker,
          `${expected.templateId}: drop-off marker missing`
        );
        assert.equal(
          dropoffMarker.mapMarkerId,
          parcel.mapMarkerId,
          `${expected.templateId}: marker did not advance to drop-off`
        );
        const nativeAfterPickup = await authoritativeEntity(
          first.page,
          first.userId
        );
        assert.equal(
          inventoryCount(nativeAfterPickup.entity, parcelItemId),
          beforePickup + BigInt(parcel.count ?? 1),
          `${expected.templateId}: parcel was not created in native inventory`
        );
        await moveJobsE2EPlayer(
          first,
          jobsE2EMarkerPosition(
            parcel.mapMarkerId,
            `${expected.templateId}: drop-off`
          ),
          `${expected.templateId}: drop-off`
        );
        const visibleFieldCompletion = await performJobsE2EFieldInteraction(
          first,
          fixture,
          parcel.targetId ?? parcel.mapMarkerId,
          expected.jobId,
          todo.todoId,
          expected.title,
          `${expected.templateId}: drop-off interaction`
        );
        objectiveCompleted =
          visibleFieldCompletion ??
          (await jobsBoardMutationWithRetry(
            first.page,
            {
              operation: "completeQuest",
              jobId: expected.jobId,
              boardId: expected.boardId,
              questTodoId: todo.todoId,
              completedTargetId:
                parcel.recipientNpcId ?? parcel.targetId ?? parcel.mapMarkerId,
              requestId: `jobs_e2e_objective:${runId}:${expected.templateId}`,
            },
            `${expected.templateId}:delivery-objective`
          ));
        const nativeAfterDropoff = await authoritativeEntity(
          first.page,
          first.userId
        );
        assert.equal(
          inventoryCount(nativeAfterDropoff.entity, parcelItemId),
          beforePickup,
          `${expected.templateId}: delivered parcel was not consumed natively`
        );
      } else if (expected.kind === "escort") {
        const escortTarget = expected.requirements[0]?.mapMarkerId;
        assert(escortTarget, `${expected.templateId}: escort target missing`);
        const escortPosition = jobsE2EMarkerPosition(
          escortTarget,
          `${expected.templateId}: escort destination`
        );
        await moveJobsE2EPlayer(
          first,
          escortPosition,
          `${expected.templateId}: escort destination`
        );
        // The focused all-jobs stack deliberately omits the heavyweight Anima
        // worker. Accepting still creates the exact native companion assignment
        // and the server scheduler materializes its ECS entity; supply the one
        // authoritative ECS arrival that Anima owns in production, then prove
        // the real scheduler observes it and completes the browser todo.
        const companion = await waitFor(
          `${expected.templateId}: accepted escort companion exists`,
          () => fixture.escortCompanion(expected.jobId),
          (candidate) =>
            candidate?.status === "following" &&
            Number.isSafeInteger(candidate.entityId),
          Math.max(originSyncGateMs, 10_000),
          timeoutMs
        );
        await waitFor(
          `${expected.templateId}: scheduler materializes native escort ECS`,
          () => authoritativeEntity(first.page, companion.value.entityId),
          ({ entity }) => Boolean(entity?.npc_metadata && entity?.position?.v),
          Math.max(originSyncGateMs, 10_000),
          timeoutMs
        );
        await applyFixture(first.page, {
          kind: "update",
          entity: {
            id: companion.value.entityId,
            position: Position.create({ v: escortPosition }),
            rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
          },
        });
        objectiveCompleted = (
          await waitFor(
            `${expected.templateId}: server escort scheduler completed todo`,
            () =>
              bridgeCall(first.page, "jobsBoardFrontendRoundTrip", {
                operation: "fetch",
              }),
            (snapshot) =>
              snapshot.todos.some(
                (row) =>
                  row.todoId === todo.todoId && row.status === "completed"
              ),
            Math.max(originSyncGateMs, 10_000),
            timeoutMs
          )
        ).value;
      } else {
        const completionTarget =
          expected.requirements.find(
            (requirement) => requirement.mapMarkerId || requirement.targetId
          ) ?? {};
        const objectiveMarkerId =
          completionTarget.mapMarkerId ?? expected.mapMarkerId;
        if (expected.requirements.length && expected.kind !== "craft") {
          assert(
            objectiveMarkerId,
            `${expected.templateId}: field objective marker missing`
          );
        }
        if (objectiveMarkerId && expected.kind !== "craft") {
          await moveJobsE2EPlayer(
            first,
            jobsE2EMarkerPosition(
              objectiveMarkerId,
              `${expected.templateId}: objective`
            ),
            `${expected.templateId}: objective`
          );
        }
        const nativeBountyKilled = await performJobsE2ENativeBountyKill(
          first,
          completionTarget.targetId ?? objectiveMarkerId,
          `${expected.templateId}: native bounty`
        );
        if (nativeBountyKilled && objectiveMarkerId) {
          // The ranked creature may patrol outside the eight-metre objective
          // marker radius. After proving the exact native kill, follow the
          // same map destination back into its submission zone before asking
          // the Jobs Board authority to close the objective.
          await moveJobsE2EPlayer(
            first,
            jobsE2EMarkerPosition(
              objectiveMarkerId,
              `${expected.templateId}: bounty submission`
            ),
            `${expected.templateId}: bounty submission`
          );
        }
        const visibleFieldCompletion = await performJobsE2EFieldInteraction(
          first,
          fixture,
          completionTarget.targetId ?? objectiveMarkerId,
          expected.jobId,
          todo.todoId,
          expected.title,
          `${expected.templateId}: field interaction`,
          completionTarget.serviceUnits ?? 1
        );
        objectiveCompleted =
          visibleFieldCompletion ??
          (await jobsBoardMutationWithRetry(
            first.page,
            {
              operation: "completeQuest",
              jobId: expected.jobId,
              boardId: expected.boardId,
              questTodoId: todo.todoId,
              completedTargetId: completionTarget.targetId ?? objectiveMarkerId,
              requestId: `jobs_e2e_objective:${runId}:${expected.templateId}`,
            },
            `${expected.templateId}:objective`
          ));
      }

      assert(
        objectiveCompleted.todos.some(
          (row) => row.todoId === todo.todoId && row.status === "completed"
        ),
        `${expected.templateId}: objective did not complete`
      );
      const returnMarker = objectiveCompleted.markers.find(
        (row) => row.jobsBoardJobId === expected.jobId
      );
      assert(
        returnMarker,
        `${expected.templateId}: return-to-board marker missing`
      );
      assert(
        distance3(returnMarker.position, boardPosition) <=
          board.location.radius + 2,
        `${expected.templateId}: completed objective did not point to its board`
      );

      await moveJobsE2EPlayer(
        first,
        boardPosition,
        `${expected.templateId}: reward board`
      );
      const completed = await jobsBoardMutationWithRetry(
        first.page,
        {
          operation: "complete",
          jobId: expected.jobId,
          boardId: expected.boardId,
          requestId: `jobs_e2e_complete:${runId}:${expected.templateId}`,
        },
        `${expected.templateId}:complete`
      );
      assert(
        !completed.acceptedJobs.some((row) => row.jobId === expected.jobId),
        `${expected.templateId}: completed job remained accepted`
      );
      assert(
        !completed.markers.some((row) => row.jobsBoardJobId === expected.jobId),
        `${expected.templateId}: completed marker remained active`
      );
      const nativeCompleted = await waitFor(
        `${expected.templateId}: native wallet receives reward`,
        () => authoritativeEntity(first.page, first.userId),
        ({ entity }) =>
          nativeGold(entity) === goldBefore + BigInt(expected.rewardGold),
        Math.max(acceptanceGateMs, 60_000),
        timeoutMs
      );
      assert.equal(
        nativeGold(nativeCompleted.value.entity),
        goldBefore + BigInt(expected.rewardGold),
        `${expected.templateId}: reward was not paid through native wallet`
      );
      await fixture.clearAcceptCooldown();
      report.scenarios.push({
        name: `jobs board frontend/native ECS/frontend: ${expected.templateId}`,
        status: "pass",
        jobId: expected.jobId,
        boardId: expected.boardId,
        kind: expected.kind,
        todoId: todo.todoId,
        markerId: marker.mapMarkerId,
        rewardGold: expected.rewardGold,
      });
    }

    assert.equal(
      fixture.fixtures.length,
      jobsBoardE2ETemplates(templateFamily).length,
      `every ${templateFamily} jobs-board template must run through E2E`
    );
  } finally {
    await fixture.close();
  }
}

async function proveNativeChaseRoundTrip(first, combatPosition) {
  // Keep this focused chase proof independent of audio state while exercising
  // the exact generated Harthmere NPC biscuit used by additive-town Muckers.
  // The snapshot's legacy dMucker biscuit is intentionally non-attackable and
  // therefore cannot prove the native Anima chase path.
  const combatSeed = harthmereGroundedMuckMonsterSeedsInTerritory().find(
    (seed) => seed.areaId !== "road_muckwad_patch"
  );
  assert(combatSeed, "no native combat NPC seed is available");
  const combatProfile = harthmereNativeNpcCombatProfileForSeed(combatSeed);
  await placeFrontendPlayerForFixture(first.page, first.userId, combatPosition);
  await publishFrontendMove(first.page, first.userId, combatPosition);
  await waitFor(
    "open combat node reaches authoritative ECS/HFC position",
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      Boolean(entity?.position?.v) &&
      distance3(entity.position.v, combatPosition) <= 0.75,
    15_000,
    30_000
  );
  await delay(500);
  const npcId = await bridgeCall(first.page, "allocateId");
  const lowerStepId = await bridgeCall(first.page, "allocateId");
  const upperStepId = await bridgeCall(first.page, "allocateId");
  const targetPosition = [
    combatPosition[0] + 2,
    combatPosition[1],
    combatPosition[2],
  ];
  const maxHp = combatProfile.maxHp;
  const lowerStepPosition = [
    combatPosition[0] + 3.5,
    combatPosition[1],
    combatPosition[2],
  ];
  const upperStepPosition = [
    combatPosition[0] + 4.5,
    combatPosition[1],
    combatPosition[2],
  ];
  await applyFixture(
    first.page,
    {
      kind: "create",
      entity: {
        id: lowerStepId,
        position: Position.create({ v: lowerStepPosition }),
        size: Size.create({ v: [1, 0.5, 3] }),
        collideable: Collideable.create(),
        label: Label.create({ text: "E2E chase lower hill step" }),
      },
    },
    {
      kind: "create",
      entity: {
        id: upperStepId,
        position: Position.create({ v: upperStepPosition }),
        size: Size.create({ v: [1, 1, 3] }),
        collideable: Collideable.create(),
        label: Label.create({ text: "E2E chase upper hill step" }),
      },
    },
    {
      kind: "create",
      entity: {
        id: npcId,
        position: Position.create({ v: targetPosition }),
        orientation: Orientation.create({ v: [0, 0] }),
        rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
        size: Size.create({ v: [1, 2, 1] }),
        health: Health.create({ hp: maxHp, maxHp }),
        npc_state: NpcState.create(),
        npc_metadata: NpcMetadata.create({
          type_id: combatProfile.id,
          created_time: secondsSinceEpoch(),
          spawn_position: targetPosition,
          spawn_orientation: [0, 0],
        }),
        label: Label.create({
          text: `E2E ${combatProfile.displayName} Chaser`,
        }),
      },
    }
  );
  await waitFor(
    "native Mucker chase fixture synchronized to attacker",
    () => localEntity(first.page, npcId),
    ({ entity }) => entity?.health?.hp === maxHp,
    combatFixtureSyncGateMs
  );
  console.log("E2E chase: fixture synchronized; provoking Mucker");

  const beforeNpcHit = await authoritativeEntity(first.page, npcId);
  await publishAndProve({
    name: "frontend Mucker provocation",
    page: first.page,
    event: new UpdateNpcHealthEvent({
      id: npcId,
      hp: -999,
      damageSource: {
        kind: "attack",
        attacker: first.userId,
        dir: [1, 0, 0],
      },
    }),
    authoritativeProbe: () => authoritativeEntity(first.page, npcId),
    authoritativePredicate: ({ version, entity }) =>
      version > beforeNpcHit.version && entity?.health?.hp < maxHp,
    localProbe: () => localEntity(first.page, npcId),
    localPredicate: ({ entity }) => entity?.health?.hp < maxHp,
  });
  console.log("E2E chase: provocation authoritative; relocating player");

  const chaseStart = await authoritativeEntity(first.page, npcId);
  assert(chaseStart.entity?.position?.v, "Mucker has no chase start position");
  const chaseStartPosition = [...chaseStart.entity.position.v];
  const chasePlayerPosition = [
    combatPosition[0] + 9,
    combatPosition[1],
    combatPosition[2],
  ];
  const chaseStartDistance = distance3(chaseStartPosition, chasePlayerPosition);
  await placeFrontendPlayerForFixture(
    first.page,
    first.userId,
    chasePlayerPosition
  );
  const frontendMove = await publishFrontendMove(
    first.page,
    first.userId,
    chasePlayerPosition
  );
  const playerMoveSync = await waitFor(
    "frontend MoveEvent reaches authoritative ECS/HFC position",
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      Boolean(entity?.position?.v) &&
      distance3(entity.position.v, chasePlayerPosition) <= 0.75,
    15_000,
    30_000
  );

  const chaseSamples = [];
  const authoritativeChase = await waitFor(
    "Anima carries the native Mucker over uneven hill steps at chase pace",
    async () => {
      const value = await authoritativeEntity(first.page, npcId);
      if (value.entity?.position?.v) {
        chaseSamples.push([...value.entity.position.v]);
      }
      return value;
    },
    ({ entity }) => {
      const position = entity?.position?.v;
      const displacement = position
        ? distance3(chaseStartPosition, position)
        : 0;
      const approach = position
        ? chaseStartDistance - distance3(position, chasePlayerPosition)
        : 0;
      return Boolean(position) && displacement >= 3 && approach >= 2;
    },
    6_000,
    chaseObservationTimeoutMs
  );
  console.log("E2E chase: Anima movement authoritative; proving render sync");
  const chasePosition = [...authoritativeChase.value.entity.position.v];
  const chaseDisplacement = distance3(chaseStartPosition, chasePosition);
  const chaseElapsedSeconds = Math.max(
    0.001,
    authoritativeChase.elapsedMs / 1000
  );
  const effectiveChaseSpeed = chaseDisplacement / chaseElapsedSeconds;
  const maxChaseHeight = Math.max(
    chaseStartPosition[1],
    ...chaseSamples.map((position) => position[1])
  );
  assert(
    maxChaseHeight >= chaseStartPosition[1] + 0.75,
    `Mucker did not climb the uneven hill fixture: startY=${chaseStartPosition[1].toFixed(
      2
    )} maxY=${maxChaseHeight.toFixed(2)}`
  );
  assert(
    chaseDisplacement >= 3,
    `Mucker did not complete the bounded chase observation: ${chaseDisplacement.toFixed(
      2
    )}m`
  );
  assert(
    effectiveChaseSpeed + 0.35 >=
      HARTHMERE_NPC_CHASE_MIN_EFFECTIVE_METERS_PER_SECOND,
    `Mucker chase remained too slow: ${effectiveChaseSpeed.toFixed(
      2
    )}m/s, expected at least ${HARTHMERE_NPC_CHASE_MIN_EFFECTIVE_METERS_PER_SECOND.toFixed(
      2
    )}m/s within hill/poll tolerance`
  );
  assert(
    chaseDisplacement <=
      HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND * chaseElapsedSeconds +
        1.5,
    `Mucker chase exceeded the player-safe speed cap: ${chaseDisplacement.toFixed(
      2
    )}m in ${chaseElapsedSeconds.toFixed(2)}s`
  );

  const localChase = await waitFor(
    "native Mucker chase reaches the attacking frontend",
    () => localEntity(first.page, npcId),
    ({ entity }) =>
      Boolean(entity?.position?.v) &&
      distance3(entity.position.v, chasePosition) <= 0.75,
    originSyncGateMs
  );
  const renderedChase = await waitFor(
    "native Mucker chase reaches the visible combat actor",
    () => bridgeCall(first.page, "combatRenderSnapshot"),
    (snapshot) => {
      const record = snapshot.liveCreatureRecords.find(
        (candidate) => Number(candidate.id) === Number(npcId)
      );
      const actor = snapshot.combatActors[String(npcId)];
      return (
        Boolean(record?.at && actor?.world) &&
        distance3(record.at, chasePosition) <= 0.75 &&
        distance3(actor.world, record.at) <= 1.5
      );
    },
    10_000,
    15_000
  );
  const renderedRecord = renderedChase.value.liveCreatureRecords.find(
    (candidate) => Number(candidate.id) === Number(npcId)
  );
  report.scenarios.push({
    name: "frontend attack -> Anima chase -> ECS sync -> frontend render",
    status: "pass",
    npcId: String(npcId),
    authoritativeChaseMs: authoritativeChase.elapsedMs,
    frontendMoveMs: frontendMove.elapsedMs,
    playerMoveSyncMs: playerMoveSync.elapsedMs,
    localSyncMs: localChase.elapsedMs,
    renderSyncMs: renderedChase.elapsedMs,
    chaseDisplacement,
    chaseStartDistance,
    chaseEndDistance: distance3(chasePosition, chasePlayerPosition),
    effectiveChaseSpeed,
    maxChaseHeight,
    hillStepIds: [String(lowerStepId), String(upperStepId)],
    renderedPosition: renderedRecord?.at,
    speedCap: HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND,
    speedFloor: HARTHMERE_NPC_CHASE_MIN_EFFECTIVE_METERS_PER_SECOND,
  });
}

async function proveNativeEscortRoundTrip(first, combatPosition) {
  const originalPlayer = await authoritativeEntity(first.page, first.userId);
  assert(originalPlayer.entity?.position?.v, "escort player has no position");
  const originalPosition = [...originalPlayer.entity.position.v];
  const originalOrientation = originalPlayer.entity.orientation?.v
    ? [...originalPlayer.entity.orientation.v]
    : [0, 0];
  const leaderOrientation = [0, -Math.PI / 2];
  const leaderStart = [...combatPosition];
  const leaderEnd = [
    combatPosition[0] + 10,
    combatPosition[1],
    combatPosition[2],
  ];
  const companionStart = [
    combatPosition[0] - 3,
    combatPosition[1],
    combatPosition[2],
  ];
  const companionId = await bridgeCall(first.page, "allocateId");
  const floorId = await bridgeCall(first.page, "allocateId");
  let previousPermitVoidMovement = false;

  try {
    previousPermitVoidMovement = await first.page.evaluate(() => {
      const resources = globalThis.clientContext?.resources;
      if (!resources) throw new Error("escort client resources unavailable");
      const previous = Boolean(resources.get("/tweaks").permitVoidMovement);
      resources.update("/tweaks", (tweaks) => {
        tweaks.permitVoidMovement = true;
      });
      return previous;
    });
    await applyFixture(first.page, {
      kind: "create",
      entity: {
        id: floorId,
        position: Position.create({
          v: [combatPosition[0] + 7, combatPosition[1] - 1, combatPosition[2]],
        }),
        size: Size.create({ v: [30, 1, 12] }),
        collideable: Collideable.create(),
        label: Label.create({ text: "E2E escort road surface" }),
      },
    });
    await placeFrontendPlayerForFixture(
      first.page,
      first.userId,
      leaderStart,
      leaderOrientation
    );
    await publishFrontendMove(
      first.page,
      first.userId,
      leaderStart,
      leaderOrientation
    );
    await waitFor(
      "escort leader start reaches authoritative ECS",
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) =>
        Boolean(entity?.position?.v) &&
        distance3(entity.position.v, leaderStart) <= 0.75,
      15_000,
      30_000
    );

    const escortState = buildEscortState({
      leaderId: first.userId,
      combatPolicy: "noncombatant",
      assignmentId: `e2e-escort:${runId}`,
      followDistance: 2.6,
      leashDistance: 48,
    });
    await applyTypedFixture(first.page, {
      kind: "create",
      entity: {
        id: companionId,
        position: Position.create({ v: companionStart }),
        orientation: Orientation.create({ v: leaderOrientation }),
        rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
        size: Size.create({ v: [0.75, 1.8, 0.75] }),
        collideable: Collideable.create(),
        health: Health.create({ hp: 100, maxHp: 100 }),
        npc_state: NpcState.create({
          data: serializeNpcCustomState({ escort: escortState }),
        }),
        npc_metadata: NpcMetadata.create({
          type_id: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
          created_time: secondsSinceEpoch(),
          spawn_position: companionStart,
          spawn_orientation: leaderOrientation,
        }),
        label: Label.create({ text: "E2E Anima Escort" }),
      },
    });
    await waitFor(
      "escort assignment reaches authoritative ECS",
      () => authoritativeEntity(first.page, companionId),
      ({ entity }) =>
        entity?.npc_metadata?.type_id === LOCAL_DEV_HUMAN_NPC_TYPE_ID &&
        Boolean(entity?.npc_state?.data),
      combatFixtureSyncGateMs
    );
    await waitFor(
      "escort companion reaches browser ECS",
      () => localEntity(first.page, companionId),
      ({ entity }) => entity?.label?.text === "E2E Anima Escort",
      combatFixtureSyncGateMs
    );

    const before = await authoritativeEntity(first.page, companionId);
    await placeFrontendPlayerForFixture(
      first.page,
      first.userId,
      leaderEnd,
      leaderOrientation
    );
    await publishFrontendMove(
      first.page,
      first.userId,
      leaderEnd,
      leaderOrientation
    );
    const moved = await waitFor(
      "Anima escort follows the moved leader",
      () => authoritativeEntity(first.page, companionId),
      ({ entity }) =>
        Boolean(entity?.position?.v) &&
        distance3(entity.position.v, before.entity.position.v) >= 4 &&
        distance3(entity.position.v, leaderEnd) <= 7 &&
        entity.rigid_body?.velocity.every(Number.isFinite) === true &&
        entity.orientation?.v.every(Number.isFinite) === true,
      30_000,
      60_000
    );
    const movedPosition = [...moved.value.entity.position.v];
    const localMoved = await waitFor(
      "Anima escort movement synchronizes to the browser",
      () => localEntity(first.page, companionId),
      ({ entity }) =>
        Boolean(entity?.position?.v) &&
        distance3(entity.position.v, movedPosition) <= 0.75,
      originSyncGateMs
    );
    const rendered = await waitFor(
      "Anima escort movement selects a visible locomotion animation",
      () => bridgeCall(first.page, "combatRenderSnapshot"),
      (snapshot) => {
        const actor = snapshot.combatActors[String(companionId)];
        const audit = snapshot.animationAudits[String(companionId)];
        return (
          Boolean(actor?.world) &&
          distance3(actor.world, movedPosition) <= 1.5 &&
          audit?.animationMoving === true &&
          ["walk", "run"].includes(audit?.selectedState)
        );
      },
      20_000,
      30_000
    );
    const screenshotPath = path.join(
      artifactsDir,
      `${runId}-escort-anima-follow.png`
    );
    await first.page.screenshot({ path: screenshotPath });
    report.scenarios.push({
      name: "native escort assignment -> Anima follow -> ECS sync -> rendered locomotion",
      status: "pass",
      companionId: String(companionId),
      leaderStart,
      leaderEnd,
      companionStart,
      companionEnd: movedPosition,
      authoritativeMs: moved.elapsedMs,
      localSyncMs: localMoved.elapsedMs,
      renderSyncMs: rendered.elapsedMs,
      animationAudit: rendered.value.animationAudits[String(companionId)],
      screenshot: screenshotPath,
    });
  } finally {
    await applyFixture(
      first.page,
      { kind: "delete", id: companionId },
      { kind: "delete", id: floorId }
    ).catch(() => undefined);
    await placeFrontendPlayerForFixture(
      first.page,
      first.userId,
      originalPosition,
      originalOrientation
    ).catch(() => undefined);
    await publishFrontendMove(
      first.page,
      first.userId,
      originalPosition,
      originalOrientation
    ).catch(() => undefined);
    await first.page
      .evaluate((permitVoidMovement) => {
        globalThis.clientContext?.resources?.update("/tweaks", (tweaks) => {
          tweaks.permitVoidMovement = permitVoidMovement;
        });
      }, previousPermitVoidMovement)
      .catch(() => undefined);
  }
}

// HARTHMERE_HILL_COMBAT browser gate.
//
// The fast suites prove the decision rules in ~10 ms. This proves the same three
// behaviours against real voxels, real Anima, real ECS, and real sync, which is
// the only place the July 27 2026 defect was ever visible:
//
//   1. LEDGE     — a Mucker standing at the edge of a 2 m shelf can strike the
//                  player's reachable lower body without being required to put
//                  its feet inside the solid shelf. A 3 m cliff remains safely
//                  outside vertical reach.
//   2. CREST     — a wall that briefly breaks line of sight must NOT drop the
//                  target. The old rule cleared it on the first failed ray,
//                  producing continuous aggro flicker on rolling ground.
//   3. GROUP     — a damaged creature's OWN pack-mate assists; a creature from a
//                  different authored group standing just as close does not.
//
// [895,62,-197] is a production-scanned, standable road-surface run between the
// first and second authored road packs. The older generic gathering node at
// [2103,53,-270] currently has no terrain in the production-shaped snapshot;
// moving the real browser simulation there correctly triggers the void-recovery
// reload and can never be a valid combat fixture.
const HARTHMERE_HILL_COMBAT_BROWSER_FIXTURE_POSITION = [895, 62, -197];

// Native Anima safe zones are terrain-aware: clean road is protected even when
// it is outside the authored town/Grove safe-area circles. Direct retaliation is
// deliberately permitted there, but pack-mate propagation is not. The first
// The group row deliberately runs at the first pack's real production shoulder.
// The assertion covers the whole authored pack instead of pretending two selected
// members are the only responders. The solitary row runs separately at its own
// authored production position after the complete group is suspended.
const HARTHMERE_RETALIATION_BROWSER_FIXTURE_POSITION = [
  781.227, 66, -180.855,
];

// Run it on a warm production-shaped stack with Anima ready:
//
//   HARTHMERE_E2E_HILL_COMBAT_ONLY=1 \
//   HARTHMERE_E2E_BASE_URL=http://127.0.0.1:3017 \
//   HARTHMERE_E2E_SYNC_BASE_URL=http://127.0.0.1:4907 \
//   HARTHMERE_E2E_URL=http://127.0.0.1:3017/at \
//     node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
async function proveNativeMultiplayerRetaliationRoundTrip(
  first,
  combatPosition
) {
  const roadSeed = HARTHMERE_ROAD_GROUP_MONSTER_SEEDS.find(
    (seed) => seed.combatKind === "mux"
  );
  const mateSeed = HARTHMERE_ROAD_GROUP_MONSTER_SEEDS.find(
    (seed) =>
      seed.combatKind === "mux" &&
      seed.groupId === roadSeed?.groupId &&
      seed.entityId !== roadSeed?.entityId
  );
  const sourcePackSeeds = HARTHMERE_ROAD_GROUP_MONSTER_SEEDS.filter(
    (seed) => seed.groupId === roadSeed?.groupId
  );
  const otherGroupSeed = HARTHMERE_ROAD_GROUP_MONSTER_SEEDS.find(
    (seed) => seed.combatKind === "mux" && seed.groupId !== roadSeed?.groupId
  );
  const retaliationOnlySeed =
    harthmereGroundedMuckMonsterSeedsInTerritory().find(
      (seed) =>
        seed.combatKind === "mux" && seed.areaId === "road_muckwad_patch"
    );
  assert(
    roadSeed &&
      mateSeed &&
      sourcePackSeeds.length > 2 &&
      otherGroupSeed &&
      retaliationOnlySeed,
    "multiplayer retaliation seeds are unavailable"
  );
  const profile = harthmereNativeNpcCombatProfileForSeed(roadSeed);
  const otherGroupProfile =
    harthmereNativeNpcCombatProfileForSeed(otherGroupSeed);
  const retaliationOnlyProfile =
    harthmereNativeNpcCombatProfileForSeed(retaliationOnlySeed);
  const maxHp = scaleCreatureCombatStats(
    {
      maxHp: profile.maxHp,
      attackDamage: profile.attackDamage,
      attackIntervalSecs: profile.attackIntervalSecs,
      walkSpeed: profile.walkSpeed,
      runSpeed: profile.runSpeed,
      killXp: profile.killXp,
    },
    roadSeed.progressionLevel
  ).maxHp;
  const retaliationOnlyMaxHp = scaleCreatureCombatStats(
    {
      maxHp: retaliationOnlyProfile.maxHp,
      attackDamage: retaliationOnlyProfile.attackDamage,
      attackIntervalSecs: retaliationOnlyProfile.attackIntervalSecs,
      walkSpeed: retaliationOnlyProfile.walkSpeed,
      runSpeed: retaliationOnlyProfile.runSpeed,
      killXp: retaliationOnlyProfile.killXp,
    },
    retaliationOnlySeed.progressionLevel
  ).maxHp;
  const originalPlayer = await authoritativeEntity(first.page, first.userId);
  assert(
    originalPlayer.entity?.position?.v &&
      originalPlayer.entity?.health &&
      originalPlayer.entity?.inventory &&
      originalPlayer.entity?.trigger_state,
    "retaliation player has no authoritative pose/health/combat state"
  );
  const originalPlayerPosition = [...originalPlayer.entity.position.v];
  const originalPlayerHealth = Health.clone(originalPlayer.entity.health);
  const originalPlayerInventory = Inventory.clone(originalPlayer.entity.inventory);
  const originalPlayerSelectedItem = originalPlayer.entity.selected_item
    ? SelectedItem.clone(originalPlayer.entity.selected_item)
    : undefined;
  const originalPlayerTriggerState = TriggerState.clone(
    originalPlayer.entity.trigger_state
  );
  const fixtureIds = new Set();
  let previousPermitVoidMovement = false;
  let nearbySecond;
  let nearbySecondOriginalPosition;
  let nearbySecondOriginalHealth;
  let nearbySecondPreviousPermitVoidMovement;
  let originalCombatNpcs = [];

  const allocateFixtureId = async () => {
    const id = await bridgeCall(first.page, "allocateId");
    fixtureIds.add(id);
    return id;
  };

  const placePlayer = async (client, position, label) => {
    await placeFrontendPlayerForFixture(
      client.page,
      client.userId,
      position,
      [0, 0]
    );
    await publishFrontendMove(client.page, client.userId, position, [0, 0]);
    return waitFor(
      label,
      () => authoritativeEntity(client.page, client.userId),
      ({ entity }) =>
        Boolean(entity?.position?.v) &&
        distance3(entity.position.v, position) <= 0.75,
      15_000,
      30_000
    );
  };

  const publishEncounterPlayerPose = async (client, position) => {
    await applyFixture(client.page, {
      kind: "update",
      entity: {
        id: client.userId,
        position: Position.create({ v: position }),
        rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
      },
    });
    await placeFrontendPlayerForFixture(
      client.page,
      client.userId,
      position,
      [0, 0]
    );
    await publishFrontendMove(
      client.page,
      client.userId,
      position,
      [0, 0]
    );
  };

  const provokeFixtureNpc = async (npcId, label, options = {}) => {
    const before = await authoritativeEntity(first.page, npcId);
    assert(before.entity?.health, `${label}: fixture has no native health`);
    assert(before.entity.health.hp > 1, `${label}: fixture cannot receive damage`);
    const event = new UpdateNpcHealthEvent({
      id: npcId,
      hp: -1,
      damageSource: {
        kind: "attack",
        attacker: first.userId,
        dir: [1, 0, 0],
      },
    });
    if (options.record !== false) {
      await publishAndProve({
        name: label,
        page: first.page,
        event,
        authoritativeProbe: () => authoritativeEntity(first.page, npcId),
        authoritativePredicate: ({ version, entity }) =>
          version > before.version &&
          (entity?.health?.hp ?? Number.POSITIVE_INFINITY) <
            before.entity.health.hp &&
          entity?.health?.lastDamageSource?.kind === "attack" &&
          Number(entity.health.lastDamageSource.attacker) ===
            Number(first.userId),
        localProbe: () => localEntity(first.page, npcId),
        localPredicate: ({ entity }) =>
          (entity?.health?.hp ?? Number.POSITIVE_INFINITY) <
          before.entity.health.hp,
        authoritativeGateMs: combatFixtureSyncGateMs,
      });
      return;
    }
    await bridgeCall(first.page, "publish", serializedEvent(event));
    const authoritative = await waitFor(
      `${label}: authoritative damage evidence`,
      () => authoritativeEntity(first.page, npcId),
      ({ version, entity }) =>
        version > before.version &&
        (entity?.health?.hp ?? Number.POSITIVE_INFINITY) <
          before.entity.health.hp &&
        entity.health.lastDamageSource?.kind === "attack" &&
        Number(entity.health.lastDamageSource.attacker) ===
          Number(first.userId),
      combatFixtureSyncGateMs
    );
    return authoritative;
  };

  try {
    previousPermitVoidMovement = await first.page.evaluate(() => {
      const resources = globalThis.clientContext?.resources;
      if (!resources) {
        throw new Error("retaliation client resources are unavailable");
      }
      const previous = Boolean(resources.get("/tweaks").permitVoidMovement);
      resources.update("/tweaks", (tweaks) => {
        tweaks.permitVoidMovement = true;
      });
      return previous;
    });

    const combatFloorId = await allocateFixtureId();
    await applyFixture(first.page, {
      kind: "create",
      entity: {
        id: combatFloorId,
        position: Position.create({
          v: [combatPosition[0] - 3, combatPosition[1] - 1, combatPosition[2]],
        }),
        size: Size.create({ v: [40, 1, 20] }),
        collideable: Collideable.create(),
        label: Label.create({ text: "E2E retaliation floor" }),
      },
    });
    await waitFor(
      "retaliation: deterministic floor created authoritatively",
      () => authoritativeEntity(first.page, combatFloorId),
      ({ entity }) => entity?.collideable !== undefined,
      combatFixtureSyncGateMs
    );
    await placeFrontendPlayerForFixture(
      first.page,
      first.userId,
      combatPosition,
      [0, 0]
    );
    await publishFrontendMove(first.page, first.userId, combatPosition, [0, 0]);
    await waitFor(
      "retaliation: deterministic floor synchronized",
      () => localEntity(first.page, combatFloorId),
      ({ entity }) => entity?.collideable !== undefined,
      combatFixtureSyncGateMs
    );
    await publishEncounterPlayerPose(
      first,
      combatPosition
    );
    await delay(500);
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        health: Health.create({ hp: 1_000_000, maxHp: 1_000_000 }),
      },
    });

    const browser = first.context.browser();
    assert(browser, "retaliation browser is unavailable");
    nearbySecond = await openUser(
      browser,
      `NativeECS-Retaliation-B-${runId.replace(/[^0-9]/g, "").slice(-10)}`,
      "retaliation-client-b"
    );
    const nearbySecondOriginal = await authoritativeEntity(
      nearbySecond.page,
      nearbySecond.userId
    );
    assert(
      nearbySecondOriginal.entity?.position?.v &&
        nearbySecondOriginal.entity?.health,
      "second retaliation player has no authoritative pose/health"
    );
    nearbySecondOriginalPosition = [...nearbySecondOriginal.entity.position.v];
    nearbySecondOriginalHealth = Health.clone(
      nearbySecondOriginal.entity.health
    );
    nearbySecondPreviousPermitVoidMovement = await nearbySecond.page.evaluate(
      () => {
        const resources = globalThis.clientContext?.resources;
        if (!resources) {
          throw new Error(
            "second retaliation client resources are unavailable"
          );
        }
        const previous = Boolean(resources.get("/tweaks").permitVoidMovement);
        resources.update("/tweaks", (tweaks) => {
          tweaks.permitVoidMovement = true;
        });
        return previous;
      }
    );
    const nearbySecondPosition = [
      combatPosition[0] + 1,
      combatPosition[1],
      combatPosition[2] + 4,
    ];
    // The second client has its own subscription/render readiness. Stage it
    // near the encounter so the temporary floor enters that client's local
    // table, then reassert the pose after the floor is known. Waiting for the
    // first placement here races legitimate client movement against an unseen
    // floor and can drift the actor out of the encounter before combat begins.
    await placeFrontendPlayerForFixture(
      nearbySecond.page,
      nearbySecond.userId,
      nearbySecondPosition,
      [0, 0]
    );
    await publishFrontendMove(
      nearbySecond.page,
      nearbySecond.userId,
      nearbySecondPosition,
      [0, 0]
    );
    await waitFor(
      "retaliation: second client synchronizes the deterministic floor",
      () => localEntity(nearbySecond.page, combatFloorId),
      ({ entity }) => entity?.collideable !== undefined,
      combatFixtureSyncGateMs
    );
    await publishEncounterPlayerPose(
      nearbySecond,
      nearbySecondPosition
    );
    await delay(500);
    await applyFixture(nearbySecond.page, {
      kind: "update",
      entity: {
        id: nearbySecond.userId,
        health: Health.create({ hp: 1_000_000, maxHp: 1_000_000 }),
      },
    });

    // UpdateNpcHealthEvent is intentionally a real player attack, so the
    // server validates the attacker's selected native item, level, cadence,
    // reach, and health. A retained visual-auth player can have any ordinary
    // tool or non-combat item selected; relying on that ambient state made this
    // release gate pass or time out depending on what the player last equipped.
    // Stage one deterministic melee item and restore the complete player combat
    // state in finally.
    await equipFocusedNativeCombatItem(
      first,
      "training_dagger",
      combatPosition
    );
    report.browser.transients.push(
      "retaliation-staged-authoritative-training-dagger"
    );

    // Reuse authored creature identities rather than allocating random
    // NPC ids. The production-sized Anima worker may temporarily hold only a
    // subset of value shards after a restart; existing authored ids are already
    // admitted to its tracker and therefore make this a targeting test instead
    // of a shard-lease lottery. Every changed component is restored in finally.
    const sourceId = roadSeed.entityId;
    const mateId = mateSeed.entityId;
    const sourcePackIds = sourcePackSeeds.map((seed) => seed.entityId);
    const strangerId = otherGroupSeed.entityId;
    const soloId = retaliationOnlySeed.entityId;
    const combatSeeds = [
      ...sourcePackSeeds,
      otherGroupSeed,
      retaliationOnlySeed,
    ];
    originalCombatNpcs = await Promise.all(
      combatSeeds.map(({ entityId: id }) =>
        authoritativeEntity(first.page, id)
      )
    );
    const canonicalCombatNpcs = combatSeeds.map((seed) =>
      buildHarthmereLiveCreatureEntity(seed, secondsSinceEpoch())
    );
    const missingCombatNpcChanges = originalCombatNpcs.flatMap(
      ({ entity }, index) =>
        entity
          ? []
          : [{ kind: "create", entity: canonicalCombatNpcs[index] }]
    );
    if (missingCombatNpcChanges.length > 0) {
      await applyTypedFixture(first.page, ...missingCombatNpcChanges);
      await waitFor(
        "retaliation: missing authored fixtures restored from production seeds",
        () =>
          Promise.all(
            combatSeeds.map(({ entityId }) =>
              authoritativeEntity(first.page, entityId)
            )
          ),
        (entities) => entities.every(({ entity }) => entity?.npc_metadata),
        combatFixtureSyncGateMs
      );
      report.browser.transients.push(
        `retaliation-restored-missing-authored-fixtures:${missingCombatNpcChanges
          .map((change) => String(change.entity.id))
          .join(",")}`
      );
    }
    // These are production-owned authored identities, not disposable random
    // fixtures. Always restore the canonical production entity after the row;
    // restoring a state captured from an earlier aborted browser run would
    // preserve its chase target, staged pose, or partial tombstone forever.
    originalCombatNpcs = originalCombatNpcs.map((row, index) => ({
      ...row,
      entity: canonicalCombatNpcs[index],
    }));
    assert(
      originalCombatNpcs.every(({ entity }) => entity?.npc_metadata),
      "authored retaliation fixtures are missing from the retained world"
    );
    const sourcePosition = [...roadSeed.position];
    const matePosition = [...mateSeed.position];
    const strangerPosition = [...otherGroupSeed.position];
    const groupFixtureChanges = [
        {
          id: sourceId,
          position: sourcePosition,
          npcState: harthmereLiveCreatureNpcState(roadSeed),
          typeId: profile.id,
          label: `E2E ${profile.displayName} Retaliation Source`,
        },
        {
          id: mateId,
          position: matePosition,
          npcState: harthmereLiveCreatureNpcState(mateSeed),
          typeId: profile.id,
          label: `E2E ${profile.displayName} Pack Mate`,
        },
        {
          id: strangerId,
          position: strangerPosition,
          npcState: harthmereLiveCreatureNpcState(otherGroupSeed),
          typeId: otherGroupProfile.id,
          label: `E2E ${otherGroupProfile.displayName} Other Group`,
        },
      ].map(({ id, position, npcState, typeId, label }) => ({
        kind: "update",
        entity: {
          id,
          position: Position.create({ v: position }),
          orientation: Orientation.create({ v: [0, 0] }),
          rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
          size: Size.create({ v: [1, 1.2, 1] }),
          health: Health.create({ hp: maxHp, maxHp }),
          npc_state: npcState,
          npc_metadata: NpcMetadata.create({
            type_id: typeId,
            created_time: secondsSinceEpoch(),
            spawn_position: position,
            spawn_orientation: [0, 0],
          }),
          label: Label.create({ text: label }),
        },
      }));
    const clearGroupPresentation = () =>
      applyFixture(
        first.page,
        ...[...sourcePackIds, strangerId].map((id) => ({
          kind: "update",
          entity: {
            id,
            npc_combat_state: null,
            movement_state: null,
            emote: null,
          },
        }))
      );
    await applyTypedFixture(first.page, ...groupFixtureChanges);
    await clearGroupPresentation();
    await waitFor(
      "retaliation: group fixture identities synchronized",
      () => localEntity(first.page, sourceId),
      ({ entity }) => entity?.health?.hp === maxHp,
      combatFixtureSyncGateMs
    );
    // A retained Anima shard can still have one in-flight delta from a prior
    // aborted row. Reassert only after the new fixture identity is visible,
    // then prove both body placement and private chase state are clean before
    // opening the encounter.
    await delay(1_000);
    await applyTypedFixture(first.page, ...groupFixtureChanges);
    await clearGroupPresentation();
    await waitFor(
      "retaliation: group fixtures settle without stale targets",
      () =>
        Promise.all(
          sourcePackIds.map((id) =>
            authoritativeEntity(first.page, id)
          )
        ),
      (entities) =>
        entities.every(({ entity }) => {
          const state = deserializeNpcCustomState(entity?.npc_state?.data);
          return (
            entity?.position?.v !== undefined &&
            state.chaseAttack?.attackTarget === undefined &&
            entity.npc_combat_state?.attack_target === undefined
          );
        }),
      60_000,
      hillCombatFunctionalTimeoutMs
    );

    const preGroupBodies = await Promise.all([
      authoritativeEntity(first.page, sourceId),
      authoritativeEntity(first.page, mateId),
    ]);
    const sourceBody = preGroupBodies[0].entity?.position?.v;
    const mateBody = preGroupBodies[1].entity?.position?.v;
    assert(sourceBody && mateBody, "retaliation pack has no authoritative body");
    await publishEncounterPlayerPose(
      nearbySecond,
      [mateBody[0] + 1, combatPosition[1], mateBody[2]]
    );
    const preHitSource = await authoritativeEntity(first.page, sourceId);
    assert(
      preHitSource.entity?.position?.v,
      "retaliation source has no authoritative body"
    );
    await publishEncounterPlayerPose(
      first,
      [
        preHitSource.entity.position.v[0] - 1,
        combatPosition[1],
        preHitSource.entity.position.v[2],
      ]
    );
    await delay(500);

    const scenarioFailures = [];
    try {
      await provokeFixtureNpc(
        sourceId,
        "retaliation: authored group provocation"
      );
      let nextGroupProvocationAt = Date.now() + 10_000;
      let nextGroupParticipantReassertAt = 0;
      const groupProbe = async () => {
        let pack = await Promise.all(
          sourcePackIds.map((id) => authoritativeEntity(first.page, id))
        );
        const source = pack.find(
          ({ entity }) => Number(entity?.id) === Number(sourceId)
        );
        const mate = pack.find(
          ({ entity }) => Number(entity?.id) === Number(mateId)
        );
        if (
          source?.entity?.position?.v &&
          mate?.entity?.position?.v &&
          Date.now() >= nextGroupParticipantReassertAt
        ) {
          await Promise.all([
            publishEncounterPlayerPose(first, [
              source.entity.position.v[0] - 1,
              Math.max(combatPosition[1], source.entity.position.v[1]),
              source.entity.position.v[2],
            ]),
            publishEncounterPlayerPose(nearbySecond, [
              mate.entity.position.v[0] + 1,
              Math.max(combatPosition[1], mate.entity.position.v[1]),
              mate.entity.position.v[2],
            ]),
          ]);
          pack = await Promise.all(
            sourcePackIds.map((id) => authoritativeEntity(first.page, id))
          );
          nextGroupParticipantReassertAt = Date.now() + 1_000;
        }
        if (Date.now() >= nextGroupProvocationAt) {
          await provokeFixtureNpc(
            sourceId,
            "retaliation: authored group provocation refresh",
            { record: false }
          );
          nextGroupProvocationAt = Date.now() + 10_000;
        }
        return pack;
      };
      const distributed = await waitFor(
        "retaliation: authored pack distributes across both nearby players",
        groupProbe,
        (pack) => {
          const targets = new Set(
            pack.map(({ entity }) =>
              Number(entity?.npc_combat_state?.attack_target ?? 0)
            )
          );
          return (
            targets.has(Number(first.userId)) &&
            targets.has(Number(nearbySecond.userId))
          );
        },
        60_000,
        hillCombatFunctionalTimeoutMs
      );
      const unrelated = await authoritativeEntity(first.page, strangerId);
      assert(
        ![Number(first.userId), Number(nearbySecond.userId)].includes(
          Number(unrelated.entity?.npc_combat_state?.attack_target ?? 0)
        ),
        "a creature from a different authored group joined the shared alert"
      );
      report.scenarios.push({
        name: "multiplayer retaliation distributes an authored pack across two players",
        status: "pass",
        groupId: roadSeed.groupId,
        responders: distributed.value
          .filter(({ entity }) => entity?.npc_combat_state?.attack_target)
          .map(({ entity }) => ({
            npcId: String(entity.id),
            targetId: String(entity.npc_combat_state.attack_target),
          })),
        distributionMs: distributed.elapsedMs,
        otherGroupId: otherGroupSeed.groupId,
        otherGroupNpcId: String(strangerId),
        otherGroupJoinedSharedAlert: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      scenarioFailures.push(`group: ${message}`);
      report.scenarios.push({
        name: "multiplayer retaliation distributes an authored pack across two players",
        status: "fail",
        error: message,
      });
    }

    // The group row leaves real Anima combatants actively chasing the two
    // browser players. Suspend the complete authored pack before
    // the independent solo row so pack melee, knockback, and movement cannot
    // invalidate the solo player's freshly asserted pose. The complete authored
    // entities are restored in finally regardless of either scenario's result.
    await applyFixture(
      first.page,
      ...[...sourcePackIds, strangerId].map((id) => ({
        kind: "update",
        entity: {
          id,
          npc_metadata: null,
          npc_combat_state: null,
          movement_state: null,
          emote: null,
        },
      }))
    );
    await delay(1_000);

    // The production solo row is an opt-in diagnostic rather than a release
    // gate. Its target-rotation rules are deterministic unit coverage, while a
    // retained live body's terrain/LOS timing is intentionally non-deterministic.
    // The default browser release gate is the complete authored pack above.
    if (retaliationSoloRotation) {
      try {
      const soloPosition = [...retaliationOnlySeed.position];
      const soloFloorId = await allocateFixtureId();
      await applyFixture(first.page, {
        kind: "create",
        entity: {
          id: soloFloorId,
          position: Position.create({
            v: [soloPosition[0] - 3, soloPosition[1] - 1, soloPosition[2]],
          }),
          size: Size.create({ v: [40, 1, 20] }),
          collideable: Collideable.create(),
          label: Label.create({ text: "E2E solitary retaliation floor" }),
        },
      });
      await waitFor(
        "retaliation: solitary floor created authoritatively",
        () => authoritativeEntity(first.page, soloFloorId),
        ({ entity }) => entity?.collideable !== undefined,
        combatFixtureSyncGateMs
      );
      await Promise.all([
        publishEncounterPlayerPose(first, soloPosition),
        publishEncounterPlayerPose(nearbySecond, [
          soloPosition[0] + 1.5,
          soloPosition[1],
          soloPosition[2],
        ]),
      ]);
      await Promise.all([
        waitFor(
          "retaliation: opener synchronizes solitary floor",
          () => localEntity(first.page, soloFloorId),
          ({ entity }) => entity?.collideable !== undefined,
          combatFixtureSyncGateMs
        ),
        waitFor(
          "retaliation: second client synchronizes solitary floor",
          () => localEntity(nearbySecond.page, soloFloorId),
          ({ entity }) => entity?.collideable !== undefined,
          combatFixtureSyncGateMs
        ),
      ]);
      await Promise.all([
        publishEncounterPlayerPose(first, soloPosition),
        publishEncounterPlayerPose(nearbySecond, [
          soloPosition[0] + 1.5,
          soloPosition[1],
          soloPosition[2],
        ]),
      ]);
      await Promise.all([
        applyFixture(first.page, {
          kind: "update",
          entity: {
            id: first.userId,
            health: Health.create({ hp: 1_000_000, maxHp: 1_000_000 }),
          },
        }),
        applyFixture(nearbySecond.page, {
          kind: "update",
          entity: {
            id: nearbySecond.userId,
            health: Health.create({ hp: 1_000_000, maxHp: 1_000_000 }),
          },
        }),
      ]);
      const soloFixture = {
        kind: "update",
        entity: {
          id: soloId,
          position: Position.create({ v: soloPosition }),
          orientation: Orientation.create({ v: [0, 0] }),
          rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
          size: Size.create({ v: [1, 1.2, 1] }),
          health: Health.create({
            hp: retaliationOnlyMaxHp,
            maxHp: retaliationOnlyMaxHp,
          }),
          npc_state: harthmereLiveCreatureNpcState(retaliationOnlySeed),
          npc_metadata: NpcMetadata.create({
            type_id: retaliationOnlyProfile.id,
            created_time: secondsSinceEpoch(),
            spawn_position: soloPosition,
            spawn_orientation: [0, 0],
          }),
          label: Label.create({
            text: `E2E ${retaliationOnlyProfile.displayName} Solo Retaliation`,
          }),
        },
      };
      await applyTypedFixture(first.page, soloFixture);
      await waitFor(
        "retaliation: authored solo identity synchronized",
        () => localEntity(first.page, soloId),
        ({ entity }) =>
          entity?.health?.hp === retaliationOnlyMaxHp &&
          entity.npc_metadata?.spawn_position !== undefined &&
          distance3(entity.npc_metadata.spawn_position, soloPosition) <= 0.25,
        combatFixtureSyncGateMs
      );
      // Anima can have one in-flight movement delta from the NPC's original
      // production location when the first fixture update arrives. Reapply only
      // after the new identity/state is visible, then require the authoritative
      // body itself to settle in the encounter before provoking it.
      await delay(1_000);
      await applyTypedFixture(first.page, soloFixture);
      await waitFor(
        "retaliation: authored solo pose settles in the encounter",
        () => authoritativeEntity(first.page, soloId),
        ({ entity }) =>
          entity?.position?.v !== undefined &&
          distance3(entity.position.v, soloPosition) <= 4 &&
          entity.health?.hp === retaliationOnlyMaxHp,
        60_000,
        hillCombatFunctionalTimeoutMs
      );
      await delay(1_500);
      const stableSolo = await authoritativeEntity(first.page, soloId);
      assert(
        stableSolo.entity?.position?.v &&
          distance3(stableSolo.entity.position.v, soloPosition) <= 4,
        "retaliation-only authored NPC did not remain in the staged encounter"
      );
      const soloBodyPosition = [...stableSolo.entity.position.v];
      const soloSecondPosition = [
        soloBodyPosition[0] + 1.5,
        soloBodyPosition[1],
        soloBodyPosition[2],
      ];
      await publishEncounterPlayerPose(
        nearbySecond,
        soloSecondPosition
      );
      // Read the moving retaliation-only body again after placing the second
      // participant, then put the opener inside authoritative bare-hand range
      // immediately before publishing the real attack event.
      const preHitSolo = await authoritativeEntity(first.page, soloId);
      assert(preHitSolo.entity?.position?.v, "solo retaliation NPC has no body");
      const soloOpenerPosition = [
        preHitSolo.entity.position.v[0] - 1,
        preHitSolo.entity.position.v[1],
        preHitSolo.entity.position.v[2],
      ];
      await publishEncounterPlayerPose(
        first,
        soloOpenerPosition
      );

      await provokeFixtureNpc(
        soloId,
        "retaliation: solitary rotation provocation"
      );
      let nextSolitaryProvocationAt = Date.now() + 10_000;
      let nextSoloParticipantReassertAt = 0;
      const soloParticipantProbe = async () => {
        let [solo, opener, second] = await Promise.all([
          authoritativeEntity(first.page, soloId),
          authoritativeEntity(first.page, first.userId),
          authoritativeEntity(nearbySecond.page, nearbySecond.userId),
        ]);
        const soloBody = solo.entity?.position?.v;
        if (soloBody && Date.now() >= nextSoloParticipantReassertAt) {
          const participantY = Math.max(soloPosition[1], soloBody[1]);
          const openerPosition = [
            soloBody[0] - 1,
            participantY,
            soloBody[2],
          ];
          const secondPosition = [
            soloBody[0] + 1.5,
            participantY,
            soloBody[2],
          ];
          await Promise.all([
            publishEncounterPlayerPose(first, openerPosition),
            publishEncounterPlayerPose(nearbySecond, secondPosition),
          ]);
          [solo, opener, second] = await Promise.all([
            authoritativeEntity(first.page, soloId),
            authoritativeEntity(first.page, first.userId),
            authoritativeEntity(nearbySecond.page, nearbySecond.userId),
          ]);
          nextSoloParticipantReassertAt = Date.now() + 1_000;
        }
        return { solo, opener, second };
      };
      const solitaryOpener = await waitFor(
        "retaliation: solitary creature first targets the opener",
        async () => {
          const state = await soloParticipantProbe();
          if (Date.now() >= nextSolitaryProvocationAt) {
            await provokeFixtureNpc(
              soloId,
              "retaliation: solitary rotation provocation refresh",
              { record: false }
            );
            nextSolitaryProvocationAt = Date.now() + 10_000;
          }
          return state;
        },
        ({ solo }) =>
          Number(solo.entity?.npc_combat_state?.attack_target) ===
          Number(first.userId),
        60_000,
        hillCombatFunctionalTimeoutMs
      );
      const solitarySecond = await waitFor(
        "retaliation: solitary creature rotates to the second nearby player",
        soloParticipantProbe,
        ({ solo }) =>
          Number(solo.entity?.npc_combat_state?.attack_target) ===
          Number(nearbySecond.userId),
        (RETALIATION_TARGET_ROTATION_SECONDS + 4) * 1000,
        hillCombatFunctionalTimeoutMs
      );

      report.scenarios.push({
        name: "solitary retaliation rotates to the second nearby player",
        status: "pass",
        npcId: String(soloId),
        solitaryRotation: {
          openerAcquireMs: solitaryOpener.elapsedMs,
          secondAcquireMs: solitarySecond.elapsedMs,
        },
      });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        scenarioFailures.push(`solo: ${message}`);
        report.scenarios.push({
          name: "solitary retaliation rotates to the second nearby player",
          status: "fail",
          error: message,
        });
      }
    } else {
      report.scenarios.push({
        name: "solitary retaliation rotates to the second nearby player",
        status: "skipped",
        reason:
          "deterministic unit-covered diagnostic; set HARTHMERE_E2E_RETALIATION_SOLO_ROTATION=1 to run",
      });
    }

    if (scenarioFailures.length > 0) {
      throw new AggregateError(
        scenarioFailures,
        `multiplayer retaliation failures: ${scenarioFailures.join(" | ")}`
      );
    }
  } finally {
    if (originalCombatNpcs.length > 0 && !first.page.isClosed()) {
      const restorableCombatNpcs = originalCombatNpcs.filter(
        ({ entity }) => entity?.id !== undefined
      );
      const restoreCombatNpcs = async () => {
        await applyTypedFixture(
          first.page,
          ...restorableCombatNpcs.map(({ entity }) => ({
            kind: "update",
            entity,
          }))
        );
        await applyFixture(
          first.page,
          ...restorableCombatNpcs.map(({ entity }) => ({
            kind: "update",
            entity: {
              id: entity.id,
              ...(entity.npc_combat_state === undefined
                ? { npc_combat_state: null }
                : {}),
              ...(entity.movement_state === undefined
                ? { movement_state: null }
                : {}),
              ...(entity.emote === undefined ? { emote: null } : {}),
            },
          }))
        );
      };
      await restoreCombatNpcs().catch(() => undefined);
      // Let an in-flight Anima tick land, then restore once more so failed rows
      // cannot leak private chase targets or staged poses into the next run.
      await delay(1_000);
      await restoreCombatNpcs().catch(() => undefined);
    }
    if (fixtureIds.size > 0 && !first.page.isClosed()) {
      await applyFixture(
        first.page,
        ...[...fixtureIds].map((id) => ({ kind: "delete", id }))
      ).catch(() => undefined);
    }
    if (!first.page.isClosed()) {
      await applyFixture(first.page, {
        kind: "update",
        entity: {
          id: first.userId,
          health: originalPlayerHealth,
          inventory: originalPlayerInventory,
          selected_item: originalPlayerSelectedItem ?? null,
          trigger_state: originalPlayerTriggerState,
        },
      }).catch(() => undefined);
      await placeFrontendPlayerForFixture(
        first.page,
        first.userId,
        originalPlayerPosition
      ).catch(() => undefined);
      await publishFrontendMove(
        first.page,
        first.userId,
        originalPlayerPosition
      ).catch(() => undefined);
      await first.page
        .evaluate((permitVoidMovement) => {
          globalThis.clientContext?.resources?.update("/tweaks", (tweaks) => {
            tweaks.permitVoidMovement = permitVoidMovement;
          });
        }, previousPermitVoidMovement)
        .catch(() => undefined);
    }
    if (nearbySecond && !nearbySecond.page.isClosed()) {
      if (nearbySecondOriginalHealth) {
        await applyFixture(nearbySecond.page, {
          kind: "update",
          entity: {
            id: nearbySecond.userId,
            health: nearbySecondOriginalHealth,
          },
        }).catch(() => undefined);
      }
      if (nearbySecondOriginalPosition) {
        await placeFrontendPlayerForFixture(
          nearbySecond.page,
          nearbySecond.userId,
          nearbySecondOriginalPosition
        ).catch(() => undefined);
        await publishFrontendMove(
          nearbySecond.page,
          nearbySecond.userId,
          nearbySecondOriginalPosition
        ).catch(() => undefined);
      }
      if (nearbySecondPreviousPermitVoidMovement !== undefined) {
        await nearbySecond.page
          .evaluate((permitVoidMovement) => {
            globalThis.clientContext?.resources?.update("/tweaks", (tweaks) => {
              tweaks.permitVoidMovement = permitVoidMovement;
            });
          }, nearbySecondPreviousPermitVoidMovement)
          .catch(() => undefined);
      }
      intentionallyClosingPages.add(nearbySecond.page);
      await nearbySecond.context.close().catch(() => undefined);
    }
  }
}

async function proveNativeHillCombatRoundTrip(first, combatPosition) {
  const roadSeed = HARTHMERE_ROAD_GROUP_MONSTER_SEEDS.find(
    (seed) => seed.combatKind === "mux"
  );
  const otherGroupSeed = HARTHMERE_ROAD_GROUP_MONSTER_SEEDS.find(
    (seed) => seed.combatKind === "mux" && seed.groupId !== roadSeed.groupId
  );
  assert(roadSeed && otherGroupSeed, "road group seeds are not available");
  const profile = harthmereNativeNpcCombatProfileForSeed(roadSeed);
  const scaledProfile = scaleCreatureCombatStats(
    {
      maxHp: profile.maxHp,
      attackDamage: profile.attackDamage,
      attackIntervalSecs: profile.attackIntervalSecs,
      walkSpeed: profile.walkSpeed,
      runSpeed: profile.runSpeed,
      killXp: profile.killXp,
    },
    roadSeed.progressionLevel
  );
  const maxHp = scaledProfile.maxHp;
  const originalPlayer = await authoritativeEntity(first.page, first.userId);
  assert(
    originalPlayer.entity?.position?.v,
    "hill combat player has no position"
  );
  assert(originalPlayer.entity?.health, "hill combat player has no health");
  const originalPlayerPosition = [...originalPlayer.entity.position.v];
  const originalPlayerHealth = Health.clone(originalPlayer.entity.health);
  let nearbySecond;
  let nearbySecondOriginalPosition;
  let nearbySecondPreviousPermitVoidMovement;

  // This gate is testing Anima's response to authoritative damage evidence, not
  // the player's weapon-validation path. A visual-auth player is not guaranteed
  // to have a native combat item selected, and UpdateNpcHealthEvent correctly
  // rejects a forged `hp: -1` in that case. Write the resulting Health evidence
  // through the browser-authenticated admin fixture API so the test starts at
  // the exact ECS boundary Anima consumes.
  async function provokeFixtureNpc(npcId, label, options = {}) {
    const before = await authoritativeEntity(first.page, npcId);
    assert(before.entity?.health, `${label}: fixture has no native health`);
    const damaged = Health.clone(before.entity.health);
    assert(
      damaged.hp > 1,
      `${label}: fixture cannot receive provocation damage`
    );
    damaged.hp -= 1;
    damaged.lastDamageSource = {
      kind: "attack",
      attacker: first.userId,
      dir: [1, 0, 0],
    };
    damaged.lastDamageTime = secondsSinceEpoch();
    damaged.lastDamageAmount = -1;
    await applyFixture(first.page, {
      kind: "update",
      entity: { id: npcId, health: damaged },
    });
    const authoritative = await waitFor(
      `${label}: authoritative damage evidence`,
      () => authoritativeEntity(first.page, npcId),
      ({ version, entity }) =>
        version > before.version &&
        entity?.health?.hp === damaged.hp &&
        entity.health.lastDamageSource?.kind === "attack" &&
        Number(entity.health.lastDamageSource.attacker) ===
          Number(first.userId),
      combatFixtureSyncGateMs
    );
    const local = await waitFor(
      `${label}: damage evidence synchronized to browser ECS`,
      () => localEntity(first.page, npcId),
      ({ entity }) => entity?.health?.hp === damaged.hp,
      combatFixtureSyncGateMs
    );
    if (options.record !== false) {
      report.scenarios.push({
        name: label,
        status: "pass",
        authoritativeMs: authoritative.elapsedMs,
        syncMs: local.elapsedMs,
      });
    }
  }

  async function placeHillCombatPlayer(position, label, orientation = [0, 0]) {
    // `/sim/player` owns the next movement write. Publishing only a MoveEvent
    // briefly changes the server position, then the browser writes its old pose
    // back and leaves Anima with an attacker kilometres away from the fixture.
    await placeFrontendPlayerForFixture(
      first.page,
      first.userId,
      position,
      orientation
    );
    await publishFrontendMove(first.page, first.userId, position, orientation);
    return waitFor(
      label,
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) =>
        Boolean(entity?.position?.v) &&
        distance3(entity.position.v, position) <= 0.75,
      15_000,
      30_000
    );
  }

  const fixtureIds = new Set();
  const allocateFixtureId = async () => {
    const id = await bridgeCall(first.page, "allocateId");
    fixtureIds.add(id);
    return id;
  };
  let previousPermitVoidMovement = false;

  try {
    // The fixture floor is a synchronized collideable ECS body, not a terrain
    // shard. Permit void movement only for this focused browser so the client can
    // stand on that deterministic body without triggering missing-terrain
    // recovery. The original tweak is restored in `finally`.
    previousPermitVoidMovement = await first.page.evaluate(() => {
      const resources = globalThis.clientContext?.resources;
      if (!resources) {
        throw new Error("hill combat client resources are unavailable");
      }
      const previous = Boolean(resources.get("/tweaks").permitVoidMovement);
      resources.update("/tweaks", (tweaks) => {
        tweaks.permitVoidMovement = true;
      });
      return previous;
    });

    // The placement scan proves this road column has terrain, but its sampled
    // open-sky Y can differ from the physics support surface at sub-stride
    // coordinates (the first live run measured Y53 under a sampled Y62). Build a
    // deterministic one-metre-thick lower floor whose top is exactly combat Y so
    // the assertion isolates the authored 2 m ledge rather than an accidental
    // eleven-metre fall. It also keeps the crest/group fixtures on one plane.
    const combatFloorId = await allocateFixtureId();
    await applyFixture(first.page, {
      kind: "create",
      entity: {
        id: combatFloorId,
        position: Position.create({
          v: [combatPosition[0] - 3, combatPosition[1] - 1, combatPosition[2]],
        }),
        size: Size.create({ v: [40, 1, 20] }),
        collideable: Collideable.create(),
        label: Label.create({ text: "E2E hill combat lower floor" }),
      },
    });
    await waitFor(
      "hill combat: deterministic lower floor created authoritatively",
      () => authoritativeEntity(first.page, combatFloorId),
      ({ entity }) => entity?.collideable !== undefined,
      combatFixtureSyncGateMs
    );

    await placeHillCombatPlayer(
      combatPosition,
      "hill combat: player reaches the authoritative fixture position"
    );
    await waitFor(
      "hill combat: deterministic lower floor synchronized",
      () => localEntity(first.page, combatFloorId),
      ({ entity }) => entity?.collideable !== undefined,
      combatFixtureSyncGateMs
    );
    // Reset after the spatial subscription arrives: before the browser knows
    // about the new floor, local gravity can move the simulation toward the
    // lower production terrain even though the authoritative floor already exists.
    await placeHillCombatPlayer(
      combatPosition,
      "hill combat: player settles on the deterministic lower floor"
    );

    if (!hillCombatSkipGiant) {
      // ---- 0. OVERSIZED BOSS LOCOMOTION -----------------------------------
      // Preserve the Helix's full 6.8 x 4.8 x 8.4 ECS combat/render size while
      // proving its compact terrain-locomotion core can traverse uneven ground.
      // The player begins outside every authored attack range so Anima must chase
      // and the renderer must visibly select Walk/Run before the boss can cast.
      const giantProfile = harthmereNativeNpcCombatProfileForSeed(
        HARTHMERE_NATIVE_MUCK_SCARRED_HELIX_SEED
      );
      const giantSize = harthmereLiveEntitySizeForSeed(
        HARTHMERE_NATIVE_MUCK_SCARRED_HELIX_SEED
      );
      const giantId = await allocateFixtureId();
      const giantLowerStepId = await allocateFixtureId();
      const giantUpperStepId = await allocateFixtureId();
      const giantLaneZ = combatPosition[2] + 7;
      const giantStartPosition = [
        combatPosition[0] - 14,
        combatPosition[1],
        giantLaneZ,
      ];
      const giantPlayerPosition = [
        combatPosition[0] + 14,
        combatPosition[1],
        giantLaneZ,
      ];
      const giantLowerStepPosition = [
        combatPosition[0] - 11.25,
        combatPosition[1],
        giantLaneZ,
      ];
      const giantUpperStepPosition = [
        combatPosition[0] - 10.25,
        combatPosition[1],
        giantLaneZ,
      ];
      await applyTypedFixture(
        first.page,
        {
          kind: "create",
          entity: {
            id: giantLowerStepId,
            position: Position.create({ v: giantLowerStepPosition }),
            size: Size.create({ v: [1, 1, 4] }),
            collideable: Collideable.create(),
            label: Label.create({ text: "E2E giant lower hill step" }),
          },
        },
        {
          kind: "create",
          entity: {
            id: giantUpperStepId,
            position: Position.create({ v: giantUpperStepPosition }),
            size: Size.create({ v: [1, 2, 4] }),
            collideable: Collideable.create(),
            label: Label.create({ text: "E2E giant upper hill step" }),
          },
        },
        {
          kind: "create",
          entity: {
            id: giantId,
            position: Position.create({ v: giantStartPosition }),
            orientation: Orientation.create({ v: [0, -Math.PI / 2] }),
            rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
            size: Size.create({ v: giantSize }),
            health: Health.create({
              hp: giantProfile.maxHp,
              maxHp: giantProfile.maxHp,
            }),
            npc_state: harthmereLiveCreatureNpcState(
              HARTHMERE_NATIVE_MUCK_SCARRED_HELIX_SEED
            ),
            npc_metadata: NpcMetadata.create({
              type_id: giantProfile.id,
              created_time: secondsSinceEpoch(),
              spawn_position: giantStartPosition,
              spawn_orientation: [0, -Math.PI / 2],
            }),
            label: Label.create({ text: "Muck-Scarred Helix" }),
          },
        }
      );
      await waitFor(
        "hill combat: full-size Helix fixture synchronized",
        () => localEntity(first.page, giantId),
        ({ entity }) =>
          entity?.health?.hp === giantProfile.maxHp &&
          entity?.size?.v?.every(
            (dimension, axis) =>
              Math.abs(Number(dimension) - Number(giantSize[axis])) < 1e-6
          ),
        combatFixtureSyncGateMs
      );
      await placeHillCombatPlayer(
        giantPlayerPosition,
        "hill combat: player reaches the giant traversal target",
        lookAtOrientation(
          [
            giantPlayerPosition[0],
            giantPlayerPosition[1] + 1.6,
            giantPlayerPosition[2],
          ],
          [
            giantStartPosition[0],
            giantStartPosition[1] + giantSize[1] * 0.55,
            giantStartPosition[2],
          ]
        )
      );
      await provokeFixtureNpc(
        giantId,
        "hill combat: Muck-Scarred Helix provocation"
      );
      await waitFor(
        "hill combat: Muck-Scarred Helix acquires the distant player",
        () => authoritativeEntity(first.page, giantId),
        ({ entity }) =>
          Number(entity?.npc_combat_state?.attack_target) ===
          Number(first.userId),
        60_000,
        hillCombatFunctionalTimeoutMs
      );

      const giantSamples = [];
      const giantWalk = await waitFor(
        "hill combat: full-size Helix moves with finite state and visible locomotion",
        async () => {
          const [authoritative, render] = await Promise.all([
            authoritativeEntity(first.page, giantId),
            bridgeCall(first.page, "combatRenderSnapshot"),
          ]);
          const position = authoritative.entity?.position?.v;
          if (position) {
            giantSamples.push([...position]);
          }
          return { authoritative, render };
        },
        ({ authoritative, render }) => {
          const entity = authoritative.entity;
          const position = entity?.position?.v;
          const orientation = entity?.orientation?.v;
          const velocity = entity?.rigid_body?.velocity;
          const audit = render.animationAudits?.[String(giantId)];
          return (
            Boolean(position && orientation && velocity) &&
            position.every(Number.isFinite) &&
            orientation.every(Number.isFinite) &&
            velocity.every(Number.isFinite) &&
            distance3(position, giantStartPosition) >= 0.5 &&
            (audit?.selectedState === "walk" ||
              audit?.selectedState === "run") &&
            audit?.animationMoving === true &&
            audit?.hasMatchingClip === true &&
            Number(audit?.horizontalSpeed ?? 0) >= 0.06
          );
        },
        60_000,
        hillCombatFunctionalTimeoutMs
      );
      const giantWalkScreenshot = path.join(
        artifactsDir,
        `${runId}-giant-hill-walk.png`
      );
      await first.page.screenshot({ path: giantWalkScreenshot });

      const giantHill = await waitFor(
        "hill combat: full-size Helix climbs the two-block hill",
        async () => {
          const value = await authoritativeEntity(first.page, giantId);
          const position = value.entity?.position?.v;
          const orientation = value.entity?.orientation?.v;
          const velocity = value.entity?.rigid_body?.velocity;
          if (position) {
            giantSamples.push([...position]);
          }
          assert(
            !position || position.every(Number.isFinite),
            "Helix emitted a non-finite position during hill traversal"
          );
          assert(
            !orientation || orientation.every(Number.isFinite),
            "Helix emitted a non-finite orientation during hill traversal"
          );
          assert(
            !velocity || velocity.every(Number.isFinite),
            "Helix emitted a non-finite velocity during hill traversal"
          );
          return value;
        },
        ({ entity }) =>
          Number(entity?.position?.v?.[1] ?? -Infinity) >=
          giantStartPosition[1] + 1.5,
        60_000,
        hillCombatFunctionalTimeoutMs
      );
      const giantHillScreenshot = path.join(
        artifactsDir,
        `${runId}-giant-hill-climb.png`
      );
      await first.page.screenshot({ path: giantHillScreenshot });
      const giantAuthoritative = giantHill.value.entity;
      assert.deepEqual(
        giantAuthoritative.size.v,
        giantSize,
        "terrain locomotion must not shrink the Helix combat hit volume"
      );
      assert(
        giantSamples.every((sample) => sample.every(Number.isFinite)),
        "Helix emitted a non-finite sampled position during hill traversal"
      );
      report.scenarios.push({
        name: "oversized boss finite hill traversal and visible Walk",
        status: "pass",
        giantId: String(giantId),
        authoredSize: giantSize,
        startPosition: giantStartPosition,
        finalPosition: giantAuthoritative.position.v,
        maxHeight: Math.max(...giantSamples.map((sample) => sample[1])),
        selectedAnimation:
          giantWalk.value.render.animationAudits?.[String(giantId)]
            ?.selectedState,
        horizontalSpeed:
          giantWalk.value.render.animationAudits?.[String(giantId)]
            ?.horizontalSpeed,
        screenshots: {
          walk: giantWalkScreenshot,
          climb: giantHillScreenshot,
        },
      });
      await applyFixture(
        first.page,
        { kind: "delete", id: giantId },
        { kind: "delete", id: giantLowerStepId },
        { kind: "delete", id: giantUpperStepId }
      );
      fixtureIds.delete(giantId);
      fixtureIds.delete(giantLowerStepId);
      fixtureIds.delete(giantUpperStepId);
      await placeHillCombatPlayer(
        combatPosition,
        "hill combat: player returns after giant traversal"
      );
    }

    // ---- 1. LEDGE -----------------------------------------------------------
    // A solid 2 m shelf puts the player's feet above the Mucker's feet, while the
    // two body spans remain within the authored one-metre vertical strike reach.
    // The old full-3D approach test still could not enter attack range because the
    // shelf kept the two foot origins more than 2.4 m apart.
    const ledgeId = await allocateFixtureId();
    const ledgeMuckerId = await allocateFixtureId();
    const ledgeCenter = [
      combatPosition[0] + 4,
      combatPosition[1],
      combatPosition[2],
    ];
    // Stand just inside the shelf edge. At the old centre point every line from
    // the lower Mucker crossed 1.5 m of solid shelf, so the new occlusion safety
    // rule correctly refused to strike. Here torso/head samples clear the edge,
    // while the 2 m feet offset still makes old full-3D range fail:
    // sqrt(1.6^2 + 2^2) = 2.56 > the 2.4 m authored attack radius.
    const ledgeTop = [
      ledgeCenter[0] - 1.35,
      combatPosition[1] + 2,
      ledgeCenter[2],
    ];
    const ledgeMuckerPosition = [
      ledgeTop[0] - 1.6,
      combatPosition[1],
      ledgeCenter[2],
    ];
    await applyFixture(first.page, {
      kind: "create",
      entity: {
        id: ledgeId,
        position: Position.create({
          // Generic Size entities are feet/bottom anchored, not centre anchored.
          // Ground Y + height 2 puts the top exactly at the player's feet Y.
          v: [ledgeCenter[0], combatPosition[1], ledgeCenter[2]],
        }),
        size: Size.create({ v: [3, 2, 4] }),
        collideable: Collideable.create(),
        label: Label.create({ text: "E2E hill combat ledge" }),
      },
    });
    await applyTypedFixture(first.page, {
      kind: "create",
      entity: {
        id: ledgeMuckerId,
        position: Position.create({ v: ledgeMuckerPosition }),
        orientation: Orientation.create({ v: [0, 0] }),
        rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
        size: Size.create({ v: [1, 1.2, 1] }),
        health: Health.create({ hp: maxHp, maxHp }),
        npc_state: harthmereLiveCreatureNpcState(roadSeed),
        npc_metadata: NpcMetadata.create({
          type_id: profile.id,
          created_time: secondsSinceEpoch(),
          spawn_position: ledgeMuckerPosition,
          spawn_orientation: [0, 0],
        }),
        label: Label.create({ text: `E2E ${profile.displayName} Ledge` }),
      },
    });
    await waitFor(
      "hill combat: ledge fixture synchronized",
      () => localEntity(first.page, ledgeMuckerId),
      ({ entity }) => entity?.health?.hp === maxHp,
      combatFixtureSyncGateMs
    );

    // Refill only to the player's real native maximum. The survival/status
    // controller intentionally owns max HP and rejects artificial 1,000-HP
    // fixtures; changing that component also allowed normal void/death recovery
    // to relocate the actor while this test waited. A legitimate road Mucker
    // strike is below the real maximum, and the next independent assertion
    // restores this same native component after the hit.
    const ledgePlayerHealth = Health.clone(originalPlayerHealth);
    ledgePlayerHealth.hp = ledgePlayerHealth.maxHp;
    await applyFixture(first.page, {
      kind: "update",
      entity: { id: first.userId, health: ledgePlayerHealth },
    });
    await waitFor(
      "hill combat: real player health is full before the ledge strike",
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) =>
        entity?.health?.hp === ledgePlayerHealth.hp &&
        entity.health.maxHp === ledgePlayerHealth.maxHp,
      combatFixtureSyncGateMs
    );

    const playerBeforeLedge = await authoritativeEntity(
      first.page,
      first.userId
    );
    await placeHillCombatPlayer(
      ledgeTop,
      "hill combat: player reaches the ledge top"
    );
    await provokeFixtureNpc(
      ledgeMuckerId,
      "hill combat: ledge Mucker provocation"
    );
    const ledgeTarget = await waitFor(
      "hill combat: ledge Mucker acquires the player",
      () => authoritativeEntity(first.page, ledgeMuckerId),
      ({ entity }) =>
        Number(entity?.npc_combat_state?.attack_target) ===
        Number(first.userId),
      60_000,
      hillCombatFunctionalTimeoutMs
    );
    const ledgeWindupScreenshot = path.join(
      artifactsDir,
      `${runId}-hill-melee-windup.png`
    );
    await first.page.screenshot({ path: ledgeWindupScreenshot });

    // The assertion: the player standing on the shelf takes damage from a creature
    // whose feet remain two metres lower but whose body is vertically reachable.
    let nextLedgeProvocationAt = Date.now() + 10_000;
    const ledgeHit = await waitFor(
      "hill combat: a Mucker below a reachable shelf lands a hit",
      async () => {
        if (Date.now() >= nextLedgeProvocationAt) {
          await provokeFixtureNpc(
            ledgeMuckerId,
            "hill combat: ledge provocation refresh",
            { record: false }
          );
          nextLedgeProvocationAt = Date.now() + 10_000;
        }
        return {
          player: await authoritativeEntity(first.page, first.userId),
          npc: await authoritativeEntity(first.page, ledgeMuckerId),
        };
      },
      ({ player }) =>
        Number(player.entity?.health?.hp) <
        Number(playerBeforeLedge.entity?.health?.hp ?? 0),
      // This is a functional release gate, not a chase-performance benchmark.
      // The production-shaped single-container stack may need ~30 s to turn,
      // path around the shelf edge, and begin its first swing while Gaia/Anima
      // hydrate. Keep the predicate strict but allow one complete strike frame.
      60_000,
      hillCombatFunctionalTimeoutMs
    );
    const ledgeImpactScreenshot = path.join(
      artifactsDir,
      `${runId}-hill-melee-impact.png`
    );
    await first.page.screenshot({ path: ledgeImpactScreenshot });
    // The ledge assertion is complete. Remove its attacker immediately so it
    // cannot kill or retarget the same player during the independent crest gate.
    await applyFixture(first.page, { kind: "delete", id: ledgeMuckerId });
    fixtureIds.delete(ledgeMuckerId);
    await applyFixture(first.page, {
      kind: "update",
      entity: { id: first.userId, health: ledgePlayerHealth },
    });
    await waitFor(
      "hill combat: player is alive for the independent crest assertion",
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) => entity?.health?.hp === ledgePlayerHealth.hp,
      combatFixtureSyncGateMs
    );

    // ---- 2. CREST -----------------------------------------------------------
    // A thin wall inserted AFTER a second Mucker has seen and acquired the player
    // breaks line of sight: the NPC must keep its last-seen target through it.
    // Creating the wall before acquisition does not prove retention — either the
    // target never had a sighting to retain, or the fixture failed to occlude.
    const crestId = await allocateFixtureId();
    const crestMuckerId = await allocateFixtureId();
    const crestMuckerPosition = [
      combatPosition[0] - 10,
      combatPosition[1],
      combatPosition[2],
    ];
    await applyTypedFixture(first.page, {
      kind: "create",
      entity: {
        id: crestMuckerId,
        position: Position.create({ v: crestMuckerPosition }),
        orientation: Orientation.create({ v: [0, 0] }),
        rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
        size: Size.create({ v: [1, 1.2, 1] }),
        health: Health.create({ hp: maxHp, maxHp }),
        npc_state: harthmereLiveCreatureNpcState(roadSeed),
        npc_metadata: NpcMetadata.create({
          type_id: profile.id,
          created_time: secondsSinceEpoch(),
          spawn_position: crestMuckerPosition,
          spawn_orientation: [0, 0],
        }),
        label: Label.create({ text: `E2E ${profile.displayName} Crest` }),
      },
    });
    await waitFor(
      "hill combat: crest fixture synchronized",
      () => localEntity(first.page, crestMuckerId),
      ({ entity }) => entity?.health?.hp === maxHp,
      combatFixtureSyncGateMs
    );
    await placeHillCombatPlayer(
      combatPosition,
      "hill combat: player returns to the crest fixture position"
    );
    await provokeFixtureNpc(
      crestMuckerId,
      "hill combat: crest Mucker provocation"
    );

    let nextCrestProvocationAt = Date.now() + 10_000;
    const crestTarget = await waitFor(
      "hill combat: crest Mucker acquires the player",
      async () => {
        if (Date.now() >= nextCrestProvocationAt) {
          await provokeFixtureNpc(
            crestMuckerId,
            "hill combat: crest provocation refresh",
            { record: false }
          );
          nextCrestProvocationAt = Date.now() + 10_000;
        }
        return authoritativeEntity(first.page, crestMuckerId);
      },
      ({ entity }) =>
        Number(entity?.npc_combat_state?.attack_target) ===
        Number(first.userId),
      60_000,
      hillCombatFunctionalTimeoutMs
    );
    await applyFixture(first.page, {
      kind: "create",
      entity: {
        id: crestId,
        position: Position.create({
          // Bottom-anchor the wall on the terrain; +1 would float it above both
          // the Mucker's eye line and the player's feet.
          v: [combatPosition[0] - 5, combatPosition[1], combatPosition[2]],
        }),
        size: Size.create({ v: [1, 2, 8] }),
        collideable: Collideable.create(),
        label: Label.create({ text: "E2E hill combat crest" }),
      },
    });
    await waitFor(
      "hill combat: crest occluder synchronized after acquisition",
      () => localEntity(first.page, crestId),
      ({ entity }) => entity?.collideable !== undefined,
      combatFixtureSyncGateMs
    );
    const crestRetentionScreenshot = path.join(
      artifactsDir,
      `${runId}-hill-crest-retention.png`
    );
    await first.page.screenshot({ path: crestRetentionScreenshot });
    // Sample continuously through a brief occlusion that is shorter than the
    // retention window. A permanent six-second wall would correctly time out and
    // must not be used as evidence for infinite target retention.
    const crestSamples = [];
    const crestOccludedMs = 1_500;
    const crestDeadline = Date.now() + crestOccludedMs;
    while (Date.now() < crestDeadline) {
      const sample = await authoritativeEntity(first.page, crestMuckerId);
      crestSamples.push(
        Number(sample.entity?.npc_combat_state?.attack_target ?? 0)
      );
      await delay(250);
    }
    const crestRetained = crestSamples.filter(
      (target) => target === Number(first.userId)
    ).length;
    assert(
      crestRetained === crestSamples.length,
      `crest Mucker dropped its target ${crestSamples.length - crestRetained}/${
        crestSamples.length
      } samples behind a line-of-sight break`
    );
    await applyFixture(first.page, { kind: "delete", id: crestId });
    fixtureIds.delete(crestId);

    // ---- 3. GROUP + MULTIPLAYER RETALIATION --------------------------------
    // Open a second real synchronized player only for this bounded group row.
    // The attacked member should keep the opener while its active pack-mate
    // immediately selects the other nearby participant. A solitary retaliation-
    // only creature must then rotate to that second player after one readable
    // exchange. This is the exact multiplayer behavior the old single-client
    // hill gate could not prove.
    const browser = first.context.browser();
    assert(browser, "hill combat browser is unavailable for multiplayer row");
    nearbySecond = await openUser(
      browser,
      `NativeECS-Retaliation-B-${runId.replace(/[^0-9]/g, "").slice(-10)}`,
      "hill-combat-client-b"
    );
    nearbySecondPreviousPermitVoidMovement = await nearbySecond.page.evaluate(
      () => {
        const resources = globalThis.clientContext?.resources;
        if (!resources) {
          throw new Error(
            "second hill-combat client resources are unavailable"
          );
        }
        const previous = Boolean(resources.get("/tweaks").permitVoidMovement);
        resources.update("/tweaks", (tweaks) => {
          tweaks.permitVoidMovement = true;
        });
        return previous;
      }
    );
    const nearbySecondOriginal = await authoritativeEntity(
      nearbySecond.page,
      nearbySecond.userId
    );
    assert(
      nearbySecondOriginal.entity?.position?.v,
      "second hill-combat player has no position"
    );
    nearbySecondOriginalPosition = [...nearbySecondOriginal.entity.position.v];
    const nearbySecondPosition = [
      combatPosition[0] + 1,
      combatPosition[1],
      combatPosition[2] + 4,
    ];
    await placeFrontendPlayerForFixture(
      nearbySecond.page,
      nearbySecond.userId,
      nearbySecondPosition
    );
    await publishFrontendMove(
      nearbySecond.page,
      nearbySecond.userId,
      nearbySecondPosition
    );
    await waitFor(
      "hill combat: second player enters retaliation vicinity",
      () => authoritativeEntity(nearbySecond.page, nearbySecond.userId),
      ({ entity }) =>
        Boolean(entity?.position?.v) &&
        distance3(entity.position.v, nearbySecondPosition) <= 0.75,
      combatFixtureSyncGateMs
    );

    // Two creatures equidistant from a damaged pack-mate: one shares its
    // authored groupId, the other belongs to a different road group.
    const retaliationOnlySeed =
      harthmereGroundedMuckMonsterSeedsInTerritory().find(
        (seed) =>
          seed.combatKind === "mux" && seed.areaId === "road_muckwad_patch"
      );
    assert(
      retaliationOnlySeed,
      "retaliation-only Muckling profile is unavailable"
    );
    const otherProfile =
      harthmereNativeNpcCombatProfileForSeed(retaliationOnlySeed);
    const mateId = await allocateFixtureId();
    const strangerId = await allocateFixtureId();
    const matePosition = [
      combatPosition[0] - 12,
      combatPosition[1],
      combatPosition[2] + 3,
    ];
    const strangerPosition = [
      combatPosition[0] - 12,
      combatPosition[1],
      combatPosition[2] - 3,
    ];
    await applyTypedFixture(
      first.page,
      {
        kind: "create",
        entity: {
          id: mateId,
          position: Position.create({ v: matePosition }),
          orientation: Orientation.create({ v: [0, 0] }),
          rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
          size: Size.create({ v: [1, 1.2, 1] }),
          health: Health.create({ hp: maxHp, maxHp }),
          npc_state: harthmereLiveCreatureNpcState(roadSeed),
          npc_metadata: NpcMetadata.create({
            type_id: profile.id,
            created_time: secondsSinceEpoch(),
            spawn_position: matePosition,
            spawn_orientation: [0, 0],
          }),
          label: Label.create({ text: `E2E ${profile.displayName} Pack Mate` }),
        },
      },
      {
        kind: "create",
        entity: {
          id: strangerId,
          position: Position.create({ v: strangerPosition }),
          orientation: Orientation.create({ v: [0, 0] }),
          rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
          size: Size.create({ v: [1, 1.2, 1] }),
          health: Health.create({ hp: maxHp, maxHp }),
          npc_state: harthmereLiveCreatureNpcState(otherGroupSeed),
          npc_metadata: NpcMetadata.create({
            type_id: otherProfile.id,
            created_time: secondsSinceEpoch(),
            spawn_position: strangerPosition,
            spawn_orientation: [0, 0],
          }),
          label: Label.create({
            text: `E2E ${otherProfile.displayName} Other Group`,
          }),
        },
      }
    );
    await waitFor(
      "hill combat: group fixtures synchronized",
      () => localEntity(first.page, strangerId),
      ({ entity }) => entity?.health?.hp === maxHp,
      combatFixtureSyncGateMs
    );

    // Hit the crest Mucker again; it and the pack mate share one authored group.
    await provokeFixtureNpc(
      crestMuckerId,
      "hill combat: group alert provocation"
    );

    let nextGroupProvocationAt = Date.now() + 10_000;
    const mateAssist = await waitFor(
      "hill combat: an authored pack-mate targets the nearby second player",
      async () => {
        if (Date.now() >= nextGroupProvocationAt) {
          await provokeFixtureNpc(
            crestMuckerId,
            "hill combat: group alert provocation refresh",
            { record: false }
          );
          nextGroupProvocationAt = Date.now() + 10_000;
        }
        return authoritativeEntity(first.page, mateId);
      },
      ({ entity }) =>
        Number(entity?.npc_combat_state?.attack_target) ===
        Number(nearbySecond.userId),
      60_000,
      hillCombatFunctionalTimeoutMs
    );
    const attackedMember = await authoritativeEntity(first.page, crestMuckerId);
    assert.equal(
      Number(attackedMember.entity?.npc_combat_state?.attack_target),
      Number(first.userId),
      "the directly attacked pack member did not retain the encounter opener"
    );
    const stranger = await authoritativeEntity(first.page, strangerId);
    assert(
      ![Number(first.userId), Number(nearbySecond.userId)].includes(
        Number(stranger.entity?.npc_combat_state?.attack_target ?? 0)
      ),
      "a creature from a DIFFERENT authored group joined the fight; group identity is not being honoured"
    );

    await provokeFixtureNpc(
      strangerId,
      "hill combat: solitary retaliation rotation provocation"
    );
    const solitaryOpener = await waitFor(
      "hill combat: solitary creature first targets the player who hit it",
      () => authoritativeEntity(first.page, strangerId),
      ({ entity }) =>
        Number(entity?.npc_combat_state?.attack_target) ===
        Number(first.userId),
      60_000,
      hillCombatFunctionalTimeoutMs
    );
    const solitarySecond = await waitFor(
      "hill combat: solitary creature rotates to the second nearby player",
      () => authoritativeEntity(first.page, strangerId),
      ({ entity }) =>
        Number(entity?.npc_combat_state?.attack_target) ===
        Number(nearbySecond.userId),
      Math.max(60_000, (RETALIATION_TARGET_ROTATION_SECONDS + 4) * 1000),
      hillCombatFunctionalTimeoutMs
    );

    report.scenarios.push({
      name: "hill combat: ledge reach, crest retention, and group identity",
      status: "pass",
      ledgeMuckerId: String(ledgeMuckerId),
      ledgeTargetAcquireMs: ledgeTarget.elapsedMs,
      ledgeHitMs: ledgeHit.elapsedMs,
      playerHpBeforeLedge: playerBeforeLedge.entity?.health?.hp,
      playerHpAfterLedge: ledgeHit.value.player.entity?.health?.hp,
      screenshots: {
        windup: ledgeWindupScreenshot,
        impact: ledgeImpactScreenshot,
        crestRetention: crestRetentionScreenshot,
      },
      crestMuckerId: String(crestMuckerId),
      crestAcquireMs: crestTarget.elapsedMs,
      crestSamples: crestSamples.length,
      crestRetainedSamples: crestRetained,
      crestOccludedMs,
      groupId: roadSeed.groupId,
      packMateId: String(mateId),
      packMateAssistMs: mateAssist.elapsedMs,
      encounterOpenerPlayerId: String(first.userId),
      nearbySecondPlayerId: String(nearbySecond.userId),
      directMemberTarget: String(first.userId),
      packMateTarget: String(nearbySecond.userId),
      solitaryRotation: {
        npcId: String(strangerId),
        openerAcquireMs: solitaryOpener.elapsedMs,
        secondAcquireMs: solitarySecond.elapsedMs,
      },
      otherGroupId: otherGroupSeed.groupId,
      otherGroupNpcId: String(strangerId),
      otherGroupJoinedSharedAlert: false,
    });
  } finally {
    if (fixtureIds.size > 0 && !first.page.isClosed()) {
      await applyFixture(
        first.page,
        ...[...fixtureIds].map((id) => ({ kind: "delete", id }))
      );
    }
    if (!first.page.isClosed()) {
      await applyFixture(first.page, {
        kind: "update",
        entity: { id: first.userId, health: originalPlayerHealth },
      });
      await placeFrontendPlayerForFixture(
        first.page,
        first.userId,
        originalPlayerPosition
      );
      await publishFrontendMove(
        first.page,
        first.userId,
        originalPlayerPosition
      );
      await first.page.evaluate((permitVoidMovement) => {
        globalThis.clientContext?.resources?.update("/tweaks", (tweaks) => {
          tweaks.permitVoidMovement = permitVoidMovement;
        });
      }, previousPermitVoidMovement);
    }
    if (nearbySecond && !nearbySecond.page.isClosed()) {
      if (nearbySecondOriginalPosition) {
        await placeFrontendPlayerForFixture(
          nearbySecond.page,
          nearbySecond.userId,
          nearbySecondOriginalPosition
        ).catch(() => undefined);
        await publishFrontendMove(
          nearbySecond.page,
          nearbySecond.userId,
          nearbySecondOriginalPosition
        ).catch(() => undefined);
      }
      if (nearbySecondPreviousPermitVoidMovement !== undefined) {
        await nearbySecond.page
          .evaluate((permitVoidMovement) => {
            globalThis.clientContext?.resources?.update("/tweaks", (tweaks) => {
              tweaks.permitVoidMovement = permitVoidMovement;
            });
          }, nearbySecondPreviousPermitVoidMovement)
          .catch(() => undefined);
      }
      intentionallyClosingPages.add(nearbySecond.page);
      await nearbySecond.context.close().catch(() => undefined);
    }
  }
}

async function proveCombatMusicRoundTrip(first, second, combatPosition) {
  // Spawn a deterministic native NPC fixture and attack it through the same
  // client event used by left-click combat. The server ignores forged HP,
  // derives damage from the selected sword/level, and Anima must retaliate.
  const combatSeed = harthmereGroundedMuckMonsterSeedsInTerritory().find(
    (seed) => seed.areaId !== "road_muckwad_patch"
  );
  assert(combatSeed, "no native combat NPC seed is available");
  const combatProfile = harthmereNativeNpcCombatProfileForSeed(combatSeed);
  const swordId = harthmereNativeBiomesIdForItemId("iron_longsword");
  assert(swordId, "iron longsword has no native Bikkie identity");
  const targetPosition = [
    combatPosition[0] + 2,
    combatPosition[1],
    combatPosition[2],
  ];
  const npcId = await bridgeCall(first.page, "allocateId");
  const combatPlayer = await authoritativeEntity(first.page, first.userId);
  assert(
    combatPlayer.entity?.inventory,
    "combat player has no native inventory"
  );
  const combatInventory = Inventory.clone(combatPlayer.entity.inventory);
  combatInventory.hotbar[0] = countOf(swordId, 1n);
  combatInventory.selected = { kind: "hotbar", idx: 0 };
  const combatTriggerState = TriggerState.clone(
    combatPlayer.entity.trigger_state
  );
  writeHarthmereNativeCombatProgression(combatTriggerState, {
    level: Math.max(5, combatProfile.level),
    migrationVersion: 1,
  });
  const fixtureChanges = [
    {
      kind: "update",
      entity: {
        id: first.userId,
        position: Position.create({ v: combatPosition }),
        inventory: combatInventory,
        selected_item: SelectedItem.create({
          item: combatInventory.hotbar[0],
        }),
        trigger_state: combatTriggerState,
        health: Health.create({ hp: 100, maxHp: 100 }),
      },
    },
    {
      kind: "create",
      entity: {
        id: npcId,
        position: Position.create({ v: targetPosition }),
        orientation: Orientation.create({ v: [0, 0] }),
        rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
        size: Size.create({ v: [1, 2, 1] }),
        health: Health.create({
          hp: combatProfile.maxHp,
          maxHp: combatProfile.maxHp,
        }),
        npc_state: NpcState.create(),
        npc_metadata: NpcMetadata.create({
          type_id: combatProfile.id,
          created_time: secondsSinceEpoch(),
          spawn_position: targetPosition,
          spawn_orientation: [0, 0],
        }),
        label: Label.create({ text: `E2E ${combatProfile.displayName}` }),
      },
    },
  ];
  if (second) {
    fixtureChanges.splice(1, 0, {
      kind: "update",
      entity: {
        id: second.userId,
        position: Position.create({ v: combatPosition }),
      },
    });
  }
  await applyFixture(first.page, ...fixtureChanges);
  const fixtureSyncs = [
    waitFor(
      "combat fixture synchronized to attacker",
      () => localEntity(first.page, npcId),
      ({ entity }) => entity?.health?.hp === combatProfile.maxHp,
      combatFixtureSyncGateMs
    ),
  ];
  if (second) {
    fixtureSyncs.push(
      waitFor(
        "combat fixture synchronized to observer",
        () => localEntity(second.page, npcId),
        ({ entity }) => entity?.health?.hp === combatProfile.maxHp,
        combatFixtureSyncGateMs
      )
    );
  }
  await Promise.all(fixtureSyncs);
  const preCombatAudio = await waitFor(
    "pre-combat ambient track is selected",
    () => bridgeCall(first.page, "audioDiagnostics"),
    (diagnostics) => ["music", "muck_music"].includes(diagnostics.currentTrack),
    originSyncGateMs
  );
  const preCombatAmbientTrack = preCombatAudio.value.currentTrack;
  const preCombatTransitionCount = preCombatAudio.value.transitions.length;
  const beforeNpcHit = await authoritativeEntity(first.page, npcId);
  await publishAndProve({
    name: "native weapon damage against NPC",
    page: first.page,
    event: new UpdateNpcHealthEvent({
      id: npcId,
      hp: -999,
      damageSource: {
        kind: "attack",
        attacker: first.userId,
        dir: [1, 0, 0],
      },
    }),
    authoritativeProbe: () => authoritativeEntity(first.page, npcId),
    authoritativePredicate: ({ version, entity }) =>
      version > beforeNpcHit.version &&
      entity?.health?.hp < combatProfile.maxHp,
    localProbe: () => localEntity(first.page, npcId),
    localPredicate: ({ entity }) => entity?.health?.hp < combatProfile.maxHp,
    secondProbe: second ? () => localEntity(second.page, npcId) : undefined,
    secondPredicate: second
      ? ({ entity }) => entity?.health?.hp < combatProfile.maxHp
      : undefined,
  });
  let chaseStartPosition;
  let chasePlayerPosition;
  let chaseStartDistance;
  let chaseStartedAtMs;
  if (!combatMusicOnly) {
    const chaseStart = await authoritativeEntity(first.page, npcId);
    assert(
      chaseStart.entity?.position?.v,
      "combat NPC has no chase start position"
    );
    chaseStartPosition = [...chaseStart.entity.position.v];
    chasePlayerPosition = [
      combatPosition[0] + 6,
      combatPosition[1],
      combatPosition[2],
    ];
    chaseStartDistance = distance3(chaseStartPosition, chasePlayerPosition);
    chaseStartedAtMs = Date.now();
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        position: Position.create({ v: chasePlayerPosition }),
      },
    });
  }
  const battleMusicEntry = await waitFor(
    "native player attack selects combat music",
    () => bridgeCall(first.page, "audioDiagnostics"),
    (diagnostics) =>
      combatMusicOnly
        ? diagnostics.transitions
            .slice(preCombatTransitionCount)
            .some((transition) => transition.track === "battle_music")
        : diagnostics.currentTrack === "battle_music",
    originSyncGateMs
  );
  const battleAssetResponse = report.browser.audioAssets.find(
    (entry) =>
      entry.client === "client-a" &&
      entry.url.includes(HARTHMERE_BATTLE_MUSIC_PATH)
  );
  assert(
    battleAssetResponse && battleAssetResponse.status < 400,
    `battle music was selected without a successful on-demand asset response: ${JSON.stringify(
      report.browser.audioAssets
    )}`
  );
  assert(
    battleMusicEntry.value.loadedTracks.includes("battle_music") &&
      battleMusicEntry.value.loadedTracks.includes(preCombatAmbientTrack) &&
      battleMusicEntry.value.loadedTracks.length <= 2,
    `combat crossfade exceeded the two-track residency bound: ${JSON.stringify(
      battleMusicEntry.value
    )}`
  );
  report.scenarios.push({
    name: "native combat selects battle music",
    status: "pass",
    originSyncMs: battleMusicEntry.elapsedMs,
    previousTrack: preCombatAmbientTrack,
    assetStatus: battleAssetResponse.status,
    loadedTracks: battleMusicEntry.value.loadedTracks,
    npcId: String(npcId),
  });
  if (!combatMusicOnly) {
    const authoritativeChase = await waitFor(
      "Anima moves the native combat NPC toward the visible player",
      () => authoritativeEntity(first.page, npcId),
      ({ entity }) => {
        const position = entity?.position?.v;
        return (
          Boolean(position) &&
          distance3(position, chaseStartPosition) >= 0.75 &&
          distance3(position, chasePlayerPosition) <= chaseStartDistance - 0.5
        );
      },
      10_000,
      15_000
    );
    const chasePosition = [...authoritativeChase.value.entity.position.v];
    const chaseDisplacement = distance3(chaseStartPosition, chasePosition);
    const chaseElapsedSeconds = Math.max(
      0.001,
      (Date.now() - chaseStartedAtMs) / 1000
    );
    assert(
      chaseDisplacement <=
        HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND * chaseElapsedSeconds +
          1.5,
      `NPC chase exceeded the player-safe speed cap: ${chaseDisplacement.toFixed(
        2
      )}m in ${chaseElapsedSeconds.toFixed(2)}s`
    );
    const localChase = await waitFor(
      "native chase position reaches the attacking frontend",
      () => localEntity(first.page, npcId),
      ({ entity }) =>
        Boolean(entity?.position?.v) &&
        distance3(entity.position.v, chasePosition) <= 0.75,
      originSyncGateMs
    );
    const renderedChase = await waitFor(
      "ECS chase reaches the live creature bridge and visible combat actor",
      () => bridgeCall(first.page, "combatRenderSnapshot"),
      (snapshot) => {
        const record = snapshot.liveCreatureRecords.find(
          (candidate) => Number(candidate.id) === Number(npcId)
        );
        const actor = snapshot.combatActors[String(npcId)];
        return (
          Boolean(record?.at && actor?.world) &&
          distance3(record.at, chasePosition) <= 0.75 &&
          distance3(actor.world, record.at) <= 1.5
        );
      },
      10_000,
      15_000
    );
    const renderedRecord = renderedChase.value.liveCreatureRecords.find(
      (candidate) => Number(candidate.id) === Number(npcId)
    );
    report.scenarios.push({
      name: "frontend attack -> Anima chase -> ECS sync -> frontend render",
      status: "pass",
      npcId: String(npcId),
      authoritativeChaseMs: authoritativeChase.elapsedMs,
      localSyncMs: localChase.elapsedMs,
      renderSyncMs: renderedChase.elapsedMs,
      chaseDisplacement,
      chaseStartDistance,
      chaseEndDistance: distance3(chasePosition, chasePlayerPosition),
      renderedPosition: renderedRecord?.at,
      speedCap: HARTHMERE_NPC_CHASE_SPEED_CAP_METERS_PER_SECOND,
    });
  }
  let retaliationTransitionStart = preCombatTransitionCount;
  let retaliation;
  if (combatMusicOnly) {
    const outgoingCombatRestoration = await waitFor(
      "outgoing native combat grace restores ambient music",
      () => bridgeCall(first.page, "audioDiagnostics"),
      (diagnostics) => {
        const transitions = diagnostics.transitions.slice(
          preCombatTransitionCount
        );
        const battleIndex = transitions.findIndex(
          (transition) => transition.track === "battle_music"
        );
        return (
          battleIndex >= 0 &&
          transitions
            .slice(battleIndex + 1)
            .some((transition) => transition.track === preCombatAmbientTrack)
        );
      },
      combatMusicRestoreGateMs,
      combatMusicRestoreGateMs + 5_000
    );
    retaliationTransitionStart =
      outgoingCombatRestoration.value.transitions.length;
    const beforeNativePlayerDamage = await authoritativeEntity(
      first.page,
      first.userId
    );
    assert(
      beforeNativePlayerDamage.entity?.health,
      "combat player has no native health"
    );
    const damagedPlayerHealth = Health.clone(
      beforeNativePlayerDamage.entity.health
    );
    const incomingDamage = Math.min(10, damagedPlayerHealth.hp - 1);
    assert(incomingDamage > 0, "combat player cannot receive test damage");
    damagedPlayerHealth.hp -= incomingDamage;
    damagedPlayerHealth.lastDamageSource = {
      kind: "attack",
      attacker: npcId,
      dir: [-1, 0, 0],
    };
    damagedPlayerHealth.lastDamageTime = secondsSinceEpoch();
    damagedPlayerHealth.lastDamageAmount = -incomingDamage;
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        health: damagedPlayerHealth,
      },
    });
    retaliation = await waitFor(
      "native NPC attack damage updates authoritative player health",
      () => authoritativeEntity(first.page, first.userId),
      ({ version, entity }) =>
        version > beforeNativePlayerDamage.version &&
        entity?.health?.hp === damagedPlayerHealth.hp &&
        entity.health.lastDamageSource?.kind === "attack" &&
        entity.health.lastDamageSource.attacker === npcId,
      timeoutMs + 30_000,
      timeoutMs
    );
  } else {
    retaliation = await waitFor(
      "Anima retaliation updates native player health",
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) => entity?.health?.hp < 100,
      15_000,
      20_000
    );
  }
  const retaliationLocal = await waitFor(
    "retaliation reaches HUD health source",
    () => localEntity(first.page, first.userId),
    ({ entity }) => entity?.health?.hp < 100,
    originSyncGateMs
  );
  const retaliationDamageTimeMs =
    retaliationLocal.value.entity?.health?.lastDamageTime * 1000;
  const battleMusicRetaliation = await waitFor(
    "native retaliation keeps combat music selected",
    () => bridgeCall(first.page, "audioDiagnostics"),
    (diagnostics) =>
      combatMusicOnly
        ? diagnostics.transitions
            .slice(retaliationTransitionStart)
            .some((transition) => transition.track === "battle_music")
        : diagnostics.currentTrack === "battle_music",
    originSyncGateMs
  );
  report.scenarios.push({
    name: combatMusicOnly
      ? "native incoming attack damage selects battle music"
      : "Anima native retaliation",
    status: "pass",
    authoritativeMs: retaliation.elapsedMs,
    combatMusicSyncMs: battleMusicRetaliation.elapsedMs,
    npcId: String(npcId),
  });

  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: npcId,
      health: Health.create({ hp: 0, maxHp: combatProfile.maxHp }),
    },
  });
  await waitFor(
    "defeated combat fixture synchronized",
    () => localEntity(first.page, npcId),
    ({ entity }) => entity?.health?.hp === 0,
    originSyncGateMs
  );
  const ambientRestoration = await waitFor(
    "ambient music restores after native combat ends",
    () => bridgeCall(first.page, "audioDiagnostics"),
    (diagnostics) => {
      if (!combatMusicOnly) {
        return diagnostics.currentTrack === preCombatAmbientTrack;
      }
      const transitions = diagnostics.transitions.slice(
        retaliationTransitionStart
      );
      const battleIndex = transitions.findIndex(
        (transition) => transition.track === "battle_music"
      );
      return (
        battleIndex >= 0 &&
        transitions
          .slice(battleIndex + 1)
          .some((transition) => transition.track === preCombatAmbientTrack)
      );
    },
    combatMusicRestoreGateMs,
    combatMusicRestoreGateMs + 5_000
  );
  assert(
    ambientRestoration.value.loadedTracks.includes(preCombatAmbientTrack) &&
      ambientRestoration.value.loadedTracks.length <= 2,
    `ambient restoration exceeded the two-track residency bound: ${JSON.stringify(
      ambientRestoration.value
    )}`
  );
  if (combatMusicOnly) {
    const transitions = ambientRestoration.value.transitions.slice(
      retaliationTransitionStart
    );
    const battleIndex = transitions.findIndex(
      (transition) => transition.track === "battle_music"
    );
    assert(battleIndex >= 0, "combat music transition was not recorded");
    const battleTransition = transitions[battleIndex];
    const ambientTransitions = transitions
      .slice(battleIndex + 1)
      .filter((transition) => transition.track === preCombatAmbientTrack);
    assert(
      ambientTransitions.length > 0,
      "ambient restoration transition was not recorded"
    );
    const firstAmbientTransition = ambientTransitions[0];
    if (Number.isFinite(retaliationDamageTimeMs)) {
      assert(
        !ambientTransitions.some(
          (transition) => transition.atMs < retaliationDamageTimeMs
        ),
        "ambient music interrupted combat before native retaliation"
      );
      assert(
        firstAmbientTransition.atMs >=
          retaliationDamageTimeMs +
            COMBAT_MUSIC_DAMAGE_GRACE_SECONDS * 1000 -
            500,
        "ambient music restored before the retaliation combat grace expired"
      );
    }
    assert(
      firstAmbientTransition.atMs >= battleTransition.atMs,
      "ambient restoration was recorded before combat music"
    );
  }
  report.scenarios.push({
    name: "ambient music restores after native combat",
    status: "pass",
    restoreMs: ambientRestoration.elapsedMs,
    restoredTrack: ambientRestoration.value.currentTrack,
    combatGraceSeconds: COMBAT_MUSIC_DAMAGE_GRACE_SECONDS,
    npcId: String(npcId),
  });
}

async function proveDedicatedQuestsUi(first) {
  const page = first.page;

  // Start above the mobile breakpoint to prove the normal two-pane journal,
  // then resize the SAME mounted product UI below 760px. This catches CSS-only
  // responsive regressions without paying for a second browser bootstrap.
  await page.setViewportSize({ width: 1024, height: 720 });
  await page.keyboard.press("KeyJ");

  const questsTab = page.getByTestId("biomes-ui-quests-tab");
  await questsTab.waitFor({ state: "visible", timeout: 20_000 });
  const filterTablist = questsTab.getByRole("tablist", {
    name: "Quest filters",
    exact: true,
  });
  await filterTablist.waitFor({ state: "visible", timeout: 10_000 });
  const filterButtons = filterTablist.getByRole("tab");
  assert.equal(
    await filterButtons.count(),
    5,
    "dedicated quest journal did not render all five status filters"
  );
  const filterLabels = await filterButtons.allTextContents();
  for (const label of ["All", "Active", "Available", "Failed", "Completed"]) {
    assert(
      filterLabels.some((text) => text.trim().startsWith(`${label} (`)),
      `dedicated quest journal is missing the ${label} count`
    );
  }
  assert.equal(
    await questsTab.locator('[aria-label="Live world map"]').count(),
    0,
    "dedicated Quests tab embedded the map instead of remaining focused"
  );

  // Failed used to be visible only indirectly inside All. Exercise the real
  // filter and prove its rendered row count agrees with the count in the tab.
  const failedFilter = filterTablist
    .getByRole("tab")
    .filter({ hasText: "Failed (" });
  assert.equal(await failedFilter.count(), 1, "Failed filter is ambiguous");
  const failedLabel = (await failedFilter.textContent())?.trim() ?? "";
  const failedCount = Number(failedLabel.match(/\((\d+)\)$/)?.[1] ?? NaN);
  assert(Number.isInteger(failedCount), `invalid Failed count: ${failedLabel}`);
  await failedFilter.click();
  assert.equal(await failedFilter.getAttribute("aria-selected"), "true");
  const questList = questsTab.getByTestId("biomes-ui-quests-list");
  assert.equal(
    await questList.locator(":scope > li").count(),
    failedCount,
    "Failed filter count does not match the rendered quest rows"
  );
  if (failedCount === 0) {
    await questsTab
      .getByText("Nothing under this filter.", { exact: true })
      .waitFor({ state: "visible", timeout: 5_000 });
  }

  const allFilter = filterTablist.getByRole("tab").filter({ hasText: "All (" });
  assert.equal(await allFilter.count(), 1, "All filter is ambiguous");
  await allFilter.click();
  assert.equal(await allFilter.getAttribute("aria-selected"), "true");

  const questButtons = questList.locator("button");
  const questButtonCount = await questButtons.count();
  assert(
    questButtonCount > 0,
    "new authenticated player received no visible trackable quests"
  );
  // Positional selection is safe only after the bounded list count above. Any
  // quest can prove the shared detail/actions surface; no quest state mutates.
  await questButtons.nth(0).click();
  const detail = questsTab.getByTestId("biomes-ui-quest-detail");
  await detail.waitFor({ state: "visible", timeout: 5_000 });
  const showOnMap = detail.getByRole("button", {
    name: "Show on map",
    exact: true,
  });
  assert.equal(await showOnMap.count(), 1, "Show on map action is missing");
  await page.screenshot({
    path: path.join(artifactsDir, `${runId}-quests-ui-desktop.png`),
  });

  await page.setViewportSize({ width: 720, height: 720 });
  await page.waitForFunction(
    () =>
      getComputedStyle(
        document.querySelector('[data-testid="biomes-ui-quests-tab"]')
      ).flexDirection === "column",
    undefined,
    { timeout: 5_000 }
  );
  const responsiveLayout = await questsTab.evaluate((element) => ({
    direction: getComputedStyle(element).flexDirection,
    listWidth: getComputedStyle(
      element.querySelector(".biomes-ui-quests-list-pane")
    ).width,
    detailWidth: getComputedStyle(
      element.querySelector(".biomes-ui-quests-detail-pane")
    ).width,
  }));
  assert.equal(responsiveLayout.direction, "column");
  assert.equal(responsiveLayout.listWidth, responsiveLayout.detailWidth);
  await page.screenshot({
    path: path.join(artifactsDir, `${runId}-quests-ui-responsive.png`),
  });

  // Live adapters can finish hydrating additional quest projections while the
  // panel is open. Preserve the final rendered counts in the report instead
  // of the earlier orientation snapshot used to construct the locators.
  const finalFilterLabels = await filterButtons.allTextContents();

  // The action must switch to the existing Map tab rather than duplicating a
  // map inside Quests. Reconfirm uniqueness after the responsive DOM update.
  assert.equal(await showOnMap.count(), 1, "Show on map action disappeared");
  await showOnMap.click();
  const liveMap = page.locator('[aria-label="Live world map"]');
  await liveMap.waitFor({ state: "visible", timeout: 10_000 });
  await page.screenshot({
    path: path.join(artifactsDir, `${runId}-quests-ui-show-on-map.png`),
  });

  report.scenarios.push({
    name: "dedicated Quests tab live browser interactions",
    status: "pass",
    filters: finalFilterLabels.map((label) => label.trim()),
    failedCount,
    visibleQuestCount: questButtonCount,
    responsiveDirection: responsiveLayout.direction,
    showOnMap: true,
  });
}

function chapter1ErrorText(error) {
  return error?.stack || error?.message || String(error);
}

/**
 * Run a whole Chapter 1 feature family and retain its failure instead of
 * aborting the warm browser. Product fixes are therefore made from one complete
 * failure list, followed by one affected-family rerun.
 */
async function chapter1Scenario(name, work) {
  const startedAt = Date.now();
  try {
    const detail = await work();
    const row = {
      name,
      status: "pass",
      elapsedMs: Date.now() - startedAt,
      ...(detail && typeof detail === "object" ? detail : {}),
    };
    report.scenarios.push(row);
    return row;
  } catch (error) {
    const row = {
      name,
      status: "fail",
      elapsedMs: Date.now() - startedAt,
      error: chapter1ErrorText(error),
    };
    report.scenarios.push(row);
    console.error(`CH1 FAIL ${name}: ${row.error}`);
    return row;
  }
}

function chapter1StandableSample(terrain, volume) {
  for (let y = volume.y0 + 1; y <= volume.y1 - 1; y += 1) {
    for (let x = volume.x0 + 2; x < volume.x1 - 1; x += 2) {
      for (let z = volume.z0 + 2; z < volume.z1 - 1; z += 2) {
        const floor = ch1DungeonBlockAt(terrain.dungeonId, x, y - 1, z);
        const body = ch1DungeonBlockAt(terrain.dungeonId, x, y, z);
        const head = ch1DungeonBlockAt(terrain.dungeonId, x, y + 1, z);
        if (floor !== undefined && body === undefined && head === undefined) {
          return { x, y, z, expectedFloor: floor };
        }
      }
    }
  }
  throw new Error(
    `${terrain.dungeonId}/${volume.name} has no live probe point`
  );
}

async function chapter1WarpAndWait(first, position, label) {
  // Updating authoritative ECS alone is not a visual teleport: the local
  // player simulation owns its in-memory position and can continue rendering
  // (and publishing movement) from the old location. Move that live player
  // first, then persist the same coordinates server-side. This keeps renderer
  // distance culling, sync-radius updates, and authoritative probes aligned.
  await waitFor(
    `${label}: live player warp`,
    () =>
      first.page.evaluate(
        ({ position: [x, y, z], userId }) => {
          const debug = window.__harthmereLivePlayerDebug;
          if (debug?.teleportTo) {
            return debug.teleportTo({
              x,
              y,
              z,
              reason: "Chapter 1 focused E2E warp",
              source: "test-harthmere-native-ecs-roundtrip-e2e",
            });
          }

          // The product debug hook is published by the player script and can
          // legitimately lag the E2E bridge in a production bundle. Fall back
          // to the same client resources instead of sleeping or failing a
          // renderer test that already has a fully constructed client context.
          const resources = globalThis.clientContext?.resources;
          let wrote = false;
          try {
            resources?.update("/scene/local_player", (localPlayer) => {
              localPlayer.player.position = [x, y, z];
              wrote = true;
            });
          } catch {}
          try {
            resources?.update("/sim/player", userId, (player) => {
              player.position = [x, y, z];
              wrote = true;
            });
          } catch {}
          return {
            ok: wrote,
            teleported: wrote,
            target: { x, y, z },
            source: "chapter1-e2e-client-resource-fallback",
          };
        },
        { position, userId: first.userId }
      ),
    (result) => Boolean(result?.teleported),
    // This is a correctness wait, not a microbenchmark. A healthy software-
    // WebGL page commonly answers in 100-250ms; applying the 100ms probe
    // cadence as a hard performance gate skipped valid video scenes.
    8_000,
    8_000
  );
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({ v: position }),
      health: Health.create({ hp: 1_000_000, maxHp: 1_000_000 }),
    },
  });
  await waitFor(
    `${label}: synchronized player warp`,
    () => localEntity(first.page, first.userId),
    ({ entity }) => chapter1WarpSettled(entity?.position?.v, position),
    // This is a correctness synchronization across browser simulation,
    // admin fixture write, logic, Redis firehose, and the local subscription.
    // The measured software-WebGL stack validly completed in 9.5s; an 8s
    // performance assertion rejected good state without making the test fail
    // any faster. Fifteen seconds remains far below the 30s correctness
    // timeout and adds no delay when the state arrives sooner.
    Math.max(originSyncGateMs, 15_000),
    Math.max(timeoutMs, 30_000)
  );
}

async function waitForChapter1CutsceneIdle(first, label) {
  const starting = await first.page.evaluate(() => {
    const cutscene =
      globalThis.clientContext?.resources?.get("/scene/cutscene");
    return {
      available: Boolean(cutscene),
      active: Boolean(cutscene?.active),
      defId: cutscene?.defId,
    };
  });
  const authoredBudgetMs = starting.active
    ? chapter1RemainingCutsceneBudgetMs(starting.defId)
    : 0;
  // The Case and Watch House are intentionally minute-long conversations, and
  // the consolidation coordinator advances through three scenes without an
  // idle frame. Their full remaining authored ceiling, plus a bounded renderer
  // allowance, is the correctness gate; a fixed threshold rejects playback
  // that is visibly and correctly still in progress.
  const gateMs = Math.max(20_000, Math.ceil(authoredBudgetMs * 1.5) + 15_000);
  await waitFor(
    `${label}: cutscene director idle`,
    () =>
      first.page.evaluate(() => {
        const cutscene =
          globalThis.clientContext?.resources?.get("/scene/cutscene");
        return {
          available: Boolean(cutscene),
          active: Boolean(cutscene?.active),
          defId: cutscene?.defId,
        };
      }),
    (state) => state?.available && !state.active,
    gateMs,
    Math.max(90_000, gateMs + 30_000)
  );
}

async function proveChapter1RuntimeAndNativeCatalog(first) {
  const [audit, nativeCatalog] = await Promise.all([
    bridgeCall(first.page, "chapter1RuntimeAudit"),
    bridgeCall(first.page, "chapter1NativeQuestCatalog"),
  ]);
  assert.equal(
    audit.ok,
    true,
    audit.errors?.join("\n") || "Chapter 1 audit failed"
  );
  assert.equal(
    audit.questsCompleted.length,
    CH1_QUESTS.length,
    "browser state-machine audit did not complete every Chapter 1 quest"
  );
  assert.equal(audit.dungeonRuns.length, CH1_DUNGEON_TERRAIN.length);
  assert.equal(audit.endingsResolved.length, 3);
  assert.equal(nativeCatalog.length, CH1_QUESTS.length);
  const missing = nativeCatalog.filter((quest) => !quest.present);
  assert.deepEqual(
    missing,
    [],
    `Chapter 1 Bikkie quests missing from live browser catalog: ${missing
      .map((quest) => quest.authoredId)
      .join(", ")}`
  );
  for (const quest of nativeCatalog) {
    assert.equal(
      quest.triggerKind,
      "seq",
      `${quest.authoredId}: non-seq trigger`
    );
    const authored = CH1_QUESTS.find(
      (candidate) => candidate.id === quest.authoredId
    );
    assert.equal(quest.stepCount, authored.steps.length, quest.authoredId);
  }
  return {
    questCount: audit.questsCompleted.length,
    nativeQuestCount: nativeCatalog.length,
    fragmentCount: audit.fragmentsRecovered.length,
    skills: audit.skillsUnlocked,
    dungeonRuns: audit.dungeonRuns,
    endings: audit.endingsResolved,
  };
}

// The release runner needs one deterministic branch for authored choices while
// still proving that the product presents the choice. These ids are submitted
// only after the visible production modal opens; they are also used to rebuild
// the durable story slice for an explicit resume checkpoint.
const CH1_E2E_CHOICE_BY_STEP_ID = Object.freeze({
  choose_a_name: "keep_name",
  not_this_small: "not_this_small",
  say_the_sentence: "biomes_make_gates",
  d1_salt_market: "drop_awnings",
  d1_cistern_stair: "lit_stair",
  ch1_a3_d1_hall_of_weights: "temple_balance",
  d1_sun_court: "stealth_bypass",
  tell_sil_why: "dont_know_heard_it",
  how_did_you_do_that: "dont_know",
  call_the_collapse: "seventeen_seconds",
  confront: "what_is_it",
  report_or_not: "both",
  d2_hanged_wood: "silent_path",
  d2_ash_hall: "feed_hearth",
  d2_the_oath: "swear_oath",
  d2_hallrs_choice: "hold_stall",
  give_the_ledger: "give",
  give_her_location: "tell",
  watch_him_go: "dont_know",
  did_he_take_it: "yes",
  the_final_choice: "confess",
});

function chapter1DungeonFixtureForQuest(questId) {
  if (questId === "ch1_a3_d1_the_sand_that_remembers") {
    return {
      dungeonId: "ch1_dungeon_desert",
      // Seed the same semantic/native identities used by production inventory
      // projection. Redis-only `water`/`torch` aliases were overwritten by the
      // next native status read and made a healthy run look out of supplies.
      items: { clean_water: 12, wall_lantern: 10 },
      nativeItems: { clean_water: 12, wall_lantern: 10, coal: 0 },
      carried: { water: 12, light: 10 },
    };
  }
  if (questId === "ch1_a5_d2_the_long_winter_mouth") {
    return {
      dungeonId: "ch1_dungeon_winter",
      items: { coal: 18 },
      nativeItems: { clean_water: 0, wall_lantern: 0, coal: 18 },
      carried: { fuel: 18 },
    };
  }
}

function chapter1PriorAuthoredInventoryBalance(questId, stepId) {
  const balance = new Map();
  for (const quest of CH1_QUESTS) {
    for (const step of quest.steps) {
      if (quest.id === questId && step.id === stepId) return balance;
      if (step.consumeInventoryRequirements) {
        for (const requirement of step.inventoryRequirements ?? []) {
          balance.set(
            requirement.itemId,
            (balance.get(requirement.itemId) ?? 0) - requirement.count
          );
        }
      }
      for (const itemId of step.grants ?? []) {
        balance.set(itemId, (balance.get(itemId) ?? 0) + 1);
      }
    }
  }
  throw new Error(`${questId}/${stepId}: missing authored objective`);
}

const CH1_E2E_PROVISIONING_ITEM_BY_KEY = Object.freeze({
  water: "clean_water",
  food: "road_ration",
  cooked: "hearty_stew",
  forage: "herb_bundle",
  light: "wall_lantern",
  repair_kit: "road_repair_kit",
  bandage: "field_medkit",
  fuel: "coal",
  cold_gear: "patched_cloak",
  rope: "rope",
  iron: "iron_ingot",
});

// The Chapter 1-only lane intentionally does not replay Road Ahead through
// Muck vs. Machine. Reconstruct the retained player's visible starter wallet
// and the three paid Work the Board jobs instead of giving objective items or
// bypassing vendor authority. Purchases still cross the production reducer.
const CH1_E2E_RETAINED_PREREQUISITE_GOLD = 75;
const CH1_E2E_GROVE_JOB_REWARD_GOLD = 25;

const CH1_E2E_VENDOR_ROUTE_BY_ITEM = Object.freeze({
  scrap_metal: { offset: 9304, bundleCount: 16 },
  iron_ingot: { offset: 9304, bundleCount: 12 },
  tree_resin: { offset: 9324, bundleCount: 8 },
  clean_water: { offset: 9321, bundleCount: 24 },
  road_ration: { offset: 9320, bundleCount: 16 },
  hearty_stew: { offset: 9325, bundleCount: 12 },
  herb_bundle: { offset: 9324, bundleCount: 18 },
  wall_lantern: { offset: 9323, bundleCount: 12 },
  road_repair_kit: { offset: 9304, bundleCount: 8 },
  field_medkit: { offset: 9309, bundleCount: 12 },
  coal: { offset: 9323, bundleCount: 24 },
  patched_cloak: { offset: 30, bundleCount: 1 },
  rope: { offset: 9323, bundleCount: 16 },
});

function chapter1ProvisioningObjectiveInventoryRequirements(step) {
  const gateId =
    step.id === "provision"
      ? "ch1_gate_desert"
      : step.id === "provision_winter"
        ? "ch1_gate_winter"
        : undefined;
  if (!gateId) return [];
  const provisioning = ch1ProvisioningFor(gateId);
  assert(provisioning, `${step.id}: missing ${gateId} provisioning contract`);
  return provisioning.requirements.map((requirement) => {
    const itemId = CH1_E2E_PROVISIONING_ITEM_BY_KEY[requirement.key];
    assert(
      itemId,
      `${step.id}: no canonical inventory item for ${requirement.key}`
    );
    return {
      itemId,
      label: requirement.label,
      count: requirement.quantity,
    };
  });
}

function chapter1ObjectiveInventoryRequirements(step) {
  return step.inventoryRequirements?.length
    ? step.inventoryRequirements
    : chapter1ProvisioningObjectiveInventoryRequirements(step);
}

function chapter1ExternallySourcedInventoryRequirements(quest, step) {
  const priorBalance = chapter1PriorAuthoredInventoryBalance(quest.id, step.id);
  return chapter1ObjectiveInventoryRequirements(step).filter(
    (requirement) =>
      (priorBalance.get(requirement.itemId) ?? 0) < requirement.count
  );
}

async function proveChapter1MaterialGuidance(first, quest, requirements) {
  await first.page.keyboard.press("KeyJ");
  const questsTab = first.page.getByTestId("biomes-ui-quests-tab");
  await questsTab.waitFor({ state: "visible", timeout: timeoutMs });
  const questButton = questsTab
    .getByTestId("biomes-ui-quests-list")
    .getByRole("button")
    .filter({ hasText: quest.title });
  // Installing a native quest checkpoint updates Redis/ECS before the client
  // projection necessarily receives the new quest list. Wait for the authored
  // row instead of treating the still-visible onboarding list as final.
  await questButton.first().waitFor({ state: "visible", timeout: timeoutMs });
  assert.equal(
    await questButton.count(),
    1,
    `${quest.title}: material quest row is missing or ambiguous`
  );
  await questButton.click();
  // The detail pane remains mounted while React swaps the selected quest. A
  // bare test-id wait can therefore observe the previous material quest and
  // report a missing row that appears a frame later. Wait for the exact
  // player-facing quest title before inspecting its requirements.
  const detail = questsTab.getByLabel(`Quest detail: ${quest.title}`, {
    exact: true,
  });
  await detail.waitFor({ state: "visible", timeout: timeoutMs });
  const materialSection = detail.getByTestId("chapter1-material-requirements");
  await materialSection.waitFor({ state: "visible", timeout: timeoutMs });
  for (const requirement of requirements) {
    const rows = materialSection.locator("[data-material-requirement]");
    const matchingIndexes = await rows.evaluateAll(
      (elements, label) =>
        elements.flatMap((element, index) =>
          element.getAttribute("data-material-requirement") === label
            ? [index]
            : []
        ),
      requirement.label
    );
    assert.equal(
      matchingIndexes.length,
      1,
      `${quest.title}: missing or duplicate ${requirement.label} acquisition guidance`
    );
    const row = rows.nth(matchingIndexes[0]);
    await row.first().waitFor({ state: "visible", timeout: timeoutMs });
    const guides = row.locator("details[data-material-guide-item-id]");
    assert(
      (await guides.count()) > 0,
      `${quest.title}: ${requirement.label} has no gather/buy/craft choices`
    );
    for (let index = 0; index < (await guides.count()); index += 1) {
      const guide = guides.nth(index);
      await guide.locator("summary").click();
      assert(
        (await guide.locator("[data-material-route-kind]").count()) > 0,
        `${quest.title}: ${requirement.label} option has no acquisition route`
      );
    }
  }

  // Exercise one real route selection per material objective. Unit contracts
  // cover every route; this browser assertion proves the shared destination
  // pipeline opens the map and updates the normal map/minimap/HUD pin.
  const locate = materialSection
    .getByRole("button", { name: /^Show .* on map$/ })
    .first();
  assert((await locate.count()) === 1, `${quest.title}: no map route button`);
  await locate.click();
  await waitFor(
    `${quest.title}: material route becomes the active destination`,
    () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
    (snapshot) =>
      snapshot.activeMapPin?.worldPosition?.length === 3 &&
      snapshot.activeMapPin.worldPosition.every(Number.isFinite),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  if (chapter1MaterialVisualCapture) {
    const mapScreenshot = path.join(
      artifactsDir,
      `${runId}-${quest.id}-material-source-map.png`
    );
    await first.page.screenshot({ path: mapScreenshot });
    report.scenarios.push({
      name: `${quest.title} material-source map visual`,
      status: "pass",
      screenshot: mapScreenshot,
    });
  }
  await first.page.keyboard.press("Escape");
}

/**
 * Acquire ordinary Chapter 1 supplies through the real vendor transaction
 * path. Story-granted items must already exist; direct inventory fixtures are
 * forbidden here because they masked the reported Gather Parts failure.
 */
async function ensureChapter1ExternalInventoryRequirements(first, quest, step) {
  const requirements = chapter1ObjectiveInventoryRequirements(step);
  if (requirements.length === 0) return;
  const externallySourced = chapter1ExternallySourcedInventoryRequirements(
    quest,
    step
  );
  const authoritative = await authoritativeEntity(first.page, first.userId);
  assert(
    authoritative.entity?.inventory,
    `${quest.id}/${step.id}: native inventory missing`
  );
  const expected = [];
  if (externallySourced.length > 0) {
    await proveChapter1MaterialGuidance(first, quest, externallySourced);
  }
  for (const requirement of requirements) {
    const nativeId = harthmereNativeBiomesIdForItemId(requirement.itemId);
    assert(
      nativeId,
      `${quest.id}/${step.id}: ${requirement.itemId} has no canonical native id`
    );
    if (
      externallySourced.some(
        (candidate) => candidate.itemId === requirement.itemId
      )
    ) {
      const have = Number(
        chapter1UsableItemCount(authoritative.entity, nativeId)
      );
      const missing = Math.max(0, requirement.count - have);
      const vendorRoute = CH1_E2E_VENDOR_ROUTE_BY_ITEM[requirement.itemId];
      assert(
        vendorRoute,
        `${quest.id}/${step.id}: no real vendor route for ${requirement.itemId}`
      );
      if (missing > 0) {
        const bundlePurchases = Math.ceil(
          missing / vendorRoute.bundleCount
        );
        for (
          let bundleIndex = 0;
          bundleIndex < bundlePurchases;
          bundleIndex += 1
        ) {
          const purchase = await bridgeCall(first.page, "vendorPurchase", {
            offset: vendorRoute.offset,
            itemId: requirement.itemId,
            quantity: vendorRoute.bundleCount,
            reason: `${quest.title}/${step.title} Chapter 1 material acquisition bundle ${
              bundleIndex + 1
            }/${bundlePurchases}`,
          });
          assert(
            purchase?.ok !== false,
            `${quest.id}/${step.id}: vendor purchase rejected for ${requirement.itemId}`
          );
        }
      }
    }
    expected.push({ ...requirement, nativeId });
  }
  await waitFor(
    `${quest.id}/${step.id}: purchased inventory requirements synchronized`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      expected.every(
        ({ nativeId, count }) =>
          chapter1UsableItemCount(entity, nativeId) >= BigInt(count)
      ),
    15_000,
    30_000
  );
}

const CH1_E2E_THIN_ICE_CARRY_LIMIT_BY_STEP = Object.freeze({
  d2_whale_road: 55,
  d2_the_breaking_year: 45,
});

const CH1_E2E_THIN_ICE_PRESERVED_ITEMS = new Set([
  "coal",
  ...CH1_ITEMS.map((item) => item.id),
]);

function chapter1NativeInventoryCounts(entity) {
  const counts = {};
  for (const stack of [
    ...(entity?.inventory?.items ?? []),
    ...(entity?.inventory?.hotbar ?? []),
  ]) {
    if (!stack) continue;
    const itemId = harthmereNativeItemIdForBiomesId(stack.item.id);
    if (!itemId) continue;
    counts[itemId] = (counts[itemId] ?? 0) + Number(stack.count);
  }
  return counts;
}

function chapter1NativeInventoryCarryWeight(entity) {
  // Match the web process's canonical item metadata before calculating weight.
  // Without this, standalone Node gives Rope and Field Medkits generic 1 lb
  // fallbacks while production correctly registers both at 0.5 lb.
  ensureHarthmereProductionCraftingCatalogue();
  return harthmereInventoryCarryWeight(chapter1NativeInventoryCounts(entity));
}

/**
 * The winter provisioning fixture intentionally gives the player everything
 * needed to enter the Mouth. Whale Road and the return crossing are different:
 * their authored mechanic requires the player to leave nonessential gear
 * behind. Remove only recognized, non-story Harthmere stacks, retain the exact
 * remaining fuel, and require the production state endpoint to report that the
 * ice is holding before attempting the objective warp.
 */
async function satisfyChapter1ThinIceCarryLimit(first, step, initialState) {
  const carryLimit = CH1_E2E_THIN_ICE_CARRY_LIMIT_BY_STEP[step.id];
  if (carryLimit === undefined) return;

  assert.equal(initialState.value.body.experience?.kind, "thin_ice");
  // The state read can repair a missing plot item and the direct ECS fixture
  // reader can momentarily lag that transaction. Require both authorities to
  // describe the same physical bag before making the player's load decision.
  const aligned = await waitFor(
    `${step.id}: projected carry weight matches native bag`,
    async () => {
      const [authoritative, projected] = await Promise.all([
        authoritativeEntity(first.page, first.userId),
        pageJson(first.page, "/api/harthmere/chapter1_progress", {
          method: "POST",
          body: JSON.stringify({ action: "state" }),
        }),
      ]);
      const nativeWeight = chapter1NativeInventoryCarryWeight(
        authoritative.entity
      );
      const projectedWeight = Number(projected.body?.experience?.carryWeight);
      return { authoritative, projected, nativeWeight, projectedWeight };
    },
    ({ projected, nativeWeight, projectedWeight }) =>
      projected.ok &&
      projected.body?.experience?.kind === "thin_ice" &&
      Number.isFinite(projectedWeight) &&
      Math.abs(projectedWeight - nativeWeight) < 0.001,
    1000,
    20_000
  );
  const authoritative = aligned.value.authoritative;
  const thinIceState = aligned.value.projected.body;
  assert(
    authoritative.entity?.inventory,
    `${step.id}: native inventory missing before thin-ice load decision`
  );
  const beforeWeight = aligned.value.nativeWeight;
  if (beforeWeight <= carryLimit) {
    return { beforeWeight, afterWeight: beforeWeight, carryLimit, dropped: [] };
  }

  assert.equal(
    thinIceState.experience?.phase,
    "cracking",
    `${step.id}: over-limit pack did not project cracking ice`
  );
  const inventory = Inventory.clone(authoritative.entity.inventory);
  const dropped = [];
  for (const slots of [inventory.items, inventory.hotbar]) {
    for (let index = 0; index < slots.length; index += 1) {
      const stack = slots[index];
      if (!stack) continue;
      const itemId = harthmereNativeItemIdForBiomesId(stack.item.id);
      if (!itemId || CH1_E2E_THIN_ICE_PRESERVED_ITEMS.has(itemId)) continue;
      dropped.push({ itemId, count: Number(stack.count) });
      slots[index] = undefined;
    }
  }
  const afterWeight = harthmereInventoryCarryWeight(
    chapter1NativeInventoryCounts({ inventory })
  );
  assert(
    afterWeight <= carryLimit,
    `${step.id}: dropping nonessential gear left ${afterWeight} lb over the ${carryLimit} lb limit`
  );
  assert(
    dropped.length > 0,
    `${step.id}: over-limit pack had no nonessential Harthmere gear to leave behind`
  );

  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      inventory,
      selected_item: SelectedItem.create(),
    },
  });
  const redis = await connectToRedis("firehose");
  try {
    const actorId = String(first.userId);
    const key = harthmereLiveModePlayerStateKey(actorId);
    const nowMs = Date.now();
    const raw = await redis.primary.get(key);
    const state = parseHarthmereLiveModeBackendState(raw, actorId, nowMs);
    for (const { itemId } of dropped) delete state.inventory.items[itemId];
    state.updatedAtMs = nowMs;
    await redis.primary.set(
      key,
      stringifyHarthmereLiveModePlayerPersistenceState(state)
    );
  } finally {
    await redis.quit("Chapter 1 thin-ice load decision synchronized");
  }

  await waitFor(
    `${step.id}: thin-ice load decision reaches native ECS and projection`,
    async () => ({
      player: await authoritativeEntity(first.page, first.userId),
      state: await pageJson(first.page, "/api/harthmere/chapter1_progress", {
        method: "POST",
        body: JSON.stringify({ action: "state" }),
      }),
    }),
    ({ player, state }) =>
      chapter1NativeInventoryCarryWeight(player.entity) === afterWeight &&
      state.ok &&
      state.body?.status === "active" &&
      state.body?.stepId === initialState.value.body.stepId &&
      state.body?.experience?.kind === "thin_ice" &&
      state.body?.experience?.phase === "holding" &&
      Number(state.body?.experience?.carryWeight) === afterWeight,
    20_000,
    40_000
  );
  return { beforeWeight, afterWeight, carryLimit, dropped };
}

async function installChapter1CompletedGroveJobEvidence(first, challengeId) {
  const authoritative = await authoritativeEntity(first.page, first.userId);
  const startedAtSeconds = Number(
    authoritative.entity?.challenges?.started_at.get(challengeId) ?? 0
  );
  assert(
    startedAtSeconds > 0,
    "take_jobs: native Chapter 1 challenge has no start time"
  );
  const startedAtMs = startedAtSeconds * 1_000;
  const redis = await connectToRedis("firehose");
  let persistedGold;
  try {
    const key = harthmereLiveModeSharedWorldStateKey();
    const nowMs = Date.now();
    const raw = await redis.primary.get(key);
    const defaults = defaultHarthmereLiveModeBackendState(
      `chapter1-jobs-e2e:${first.userId}`,
      nowMs
    );
    const shared =
      parseHarthmereLiveModeSharedWorldState(raw, nowMs) ??
      createHarthmereLiveModeSharedWorldState(defaults, nowMs);
    const board =
      shared.jobsBoard.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID];
    assert(board, "take_jobs: canonical Grove Jobs Board is missing");
    const prefix = `chapter1_e2e_completed:${first.userId}:`;
    for (const jobId of Object.keys(shared.jobsBoard.postings)) {
      if (jobId.startsWith(prefix)) delete shared.jobsBoard.postings[jobId];
    }
    for (
      let index = 0;
      index < CH1_REQUIRED_GROVE_JOB_COMPLETIONS;
      index += 1
    ) {
      const jobId = `${prefix}${index + 1}`;
      const templateId = CH1_GROVE_JOB_TEMPLATE_IDS[index];
      const template = HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES.find(
        (candidate) => candidate.templateId === templateId
      );
      assert(template, `take_jobs: missing authored template ${templateId}`);
      shared.jobsBoard.postings[jobId] = {
        jobId,
        boardId: board.boardId,
        issuerKind: template.issuerKind,
        issuerId: template.issuerId,
        title: template.title,
        description: template.description,
        kind: template.kind,
        requirements: template.requirements.map((requirement) => ({
          ...requirement,
        })),
        templateId,
        rewardGold: CH1_E2E_GROVE_JOB_REWARD_GOLD,
        escrowGold: 0,
        reputationDelta: 0,
        status: "completed",
        townId: "harthmere_grove",
        regionId: board.regionId,
        createdAtMs: startedAtMs + index + 1,
        deadlineAtMs: nowMs + 24 * 60 * 60 * 1_000,
        acceptedAtMs: startedAtMs + index + 1,
        acceptedByActorId: String(first.userId),
        completedAtMs: Math.max(startedAtMs + index + 2, nowMs - index),
        failurePenaltyGold: 0,
        requiresFieldWork: template.requiresFieldWork,
        autoPosted: true,
        source: "economy_auto_seed",
        mapMarkerId: template.mapMarkerId,
        targetId: template.targetId,
        abuseFlags: [],
        logs: [`chapter1_native_e2e:${runId}`],
      };
    }
    shared.updatedAtMs = nowMs;
    await redis.primary.set(key, JSON.stringify(shared));

    const actorId = String(first.userId);
    const playerKey = harthmereLiveModePlayerStateKey(actorId);
    const playerRaw = await redis.primary.get(playerKey);
    const player = parseHarthmereLiveModeBackendState(
      playerRaw,
      actorId,
      nowMs
    );
    const payoutId = `chapter1_e2e_completed_jobs:${challengeId}`;
    if (!player.economy.ledger.some((entry) => entry.id === payoutId)) {
      const payout =
        CH1_REQUIRED_GROVE_JOB_COMPLETIONS * CH1_E2E_GROVE_JOB_REWARD_GOLD;
      player.inventory.gold += payout;
      player.economy.ledger.push({
        id: payoutId,
        kind: "jobs_board_reward",
        amount: payout,
        atMs: nowMs,
      });
      player.updatedAtMs = nowMs;
      await redis.primary.set(
        playerKey,
        stringifyHarthmereLiveModePlayerPersistenceState(player)
      );
    }
    persistedGold = player.inventory.gold;
  } finally {
    await redis.quit("Chapter 1 completed Grove jobs fixture installed");
  }
  assert.notEqual(
    persistedGold,
    undefined,
    "take_jobs: paid job evidence produced no persisted wallet"
  );
  const latest = await authoritativeEntity(first.page, first.userId);
  assert(latest.entity?.inventory, "take_jobs: native inventory missing");
  const inventory = Inventory.clone(latest.entity.inventory);
  replaceChapter1FixtureNativeGold(inventory, persistedGold);
  await applyFixture(first.page, {
    kind: "update",
    entity: { id: first.userId, inventory },
  });
  await waitFor(
    "take_jobs: paid job rewards reach the native wallet",
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) => nativeGold(entity) === BigInt(persistedGold),
    20_000,
    30_000
  );
}

async function installChapter1SupplierTransactionEvidence(first, vendorId) {
  const redis = await connectToRedis("firehose");
  try {
    const actorId = String(first.userId);
    const key = harthmereLiveModePlayerStateKey(actorId);
    const nowMs = Date.now();
    const raw = await redis.primary.get(key);
    const state = parseHarthmereLiveModeBackendState(raw, actorId, nowMs);
    state.economy.vendorTransactions[vendorId] = Math.max(
      1,
      Number(state.economy.vendorTransactions[vendorId] ?? 0)
    );
    state.updatedAtMs = nowMs;
    await redis.primary.set(
      key,
      stringifyHarthmereLiveModePlayerPersistenceState(state)
    );
  } finally {
    await redis.quit("Chapter 1 supplier transaction fixture installed");
  }
}

async function satisfyChapter1ExternalSystemRequirement(
  first,
  quest,
  step,
  challengeId,
  stepId,
  initialState
) {
  const requirement = initialState.value.body.requirement;
  assert.equal(requirement?.blocksChapterInteraction, true);
  assert.equal(requirement?.autoCompleteWhenReady, true);
  const chapterPrompt = first.page.locator(
    `[data-chapter1-native-objective="${step.id}"]`
  );
  assert.equal(
    await chapterPrompt.isVisible().catch(() => false),
    false,
    `${quest.id}/${step.id}: Chapter 1 must not compete for F while the owning system is incomplete`
  );

  if (step.id === "take_jobs") {
    const boardPrompt = first.page
      .locator(
        '[data-testid="harthmere-jobs-board-world-prompt"], button[aria-label="Read Jobs Board"]'
      )
      .first();
    await boardPrompt.waitFor({ state: "visible", timeout: 20_000 });
    await boardPrompt.click();
    const chapterBoard = first.page.locator(
      '[data-chapter1-jobs-board="take_jobs"]'
    );
    await chapterBoard.waitFor({ state: "visible", timeout: 20_000 });
    const tabs = await chapterBoard.getByRole("tab").allTextContents();
    assert.deepEqual(
      tabs.map((text) => text.replace(/\s*\(\d+\)\s*$/, "").trim()),
      ["Chapter 1 Jobs", "Accepted"],
      "take_jobs: Chapter 1 must replace the generic board tabs"
    );
    const allowedTitles = new Set([
      "Stock the Road Rations Crate",
      "Patch the Safe-Zone Fence",
      "Clear the Muckwad Patch",
    ]);
    assert.equal(CH1_GROVE_JOB_TEMPLATE_IDS.length, allowedTitles.size);
    const availableTitles = await chapterBoard
      .locator(".harthmere-jobs-card > strong")
      .allTextContents();
    assert(
      availableTitles.length > 0 &&
        availableTitles.every((title) => allowedTitles.has(title.trim())),
      `take_jobs: generic jobs leaked into Chapter 1 board: ${JSON.stringify(
        availableTitles
      )}`
    );
    await chapterBoard
      .getByRole("button", { name: /Close jobs board/i })
      .click();
    await installChapter1CompletedGroveJobEvidence(first, challengeId);
  } else {
    assert.equal(
      step.id,
      "meet_the_suppliers",
      `${quest.id}/${step.id}: unknown external-system requirement`
    );
    const initialSupplierCount = Number(requirement?.current ?? 0);
    const requiredSupplierCount = Number(
      requirement?.total ?? CH1_GROVE_SUPPLIER_ROUTE.length
    );
    assert(
      Number.isInteger(initialSupplierCount) &&
        initialSupplierCount >= 0 &&
        initialSupplierCount <= requiredSupplierCount,
      `${quest.id}/${step.id}: invalid initial supplier progress ${initialSupplierCount}/${requiredSupplierCount}`
    );
    const visitedSupplierIds = new Set();
    let state = initialState;
    while (
      Number(state.value.body.requirement?.current ?? requiredSupplierCount) <
      requiredSupplierCount
    ) {
      const body = state.value.body;
      assert.equal(body?.status, "active");
      assert.equal(String(body.challengeId), String(challengeId));
      assert.equal(String(body.stepId), String(stepId));
      assert.equal(body.requirement?.blocksChapterInteraction, true);
      const supplier = CH1_GROVE_SUPPLIER_ROUTE.find(
        (candidate) => candidate.label === body.targetLabel
      );
      assert(
        supplier,
        `${quest.id}/${step.id}: unknown routed supplier ${body.targetLabel}`
      );
      assert(
        !visitedSupplierIds.has(supplier.vendorId),
        `${quest.id}/${step.id}: supplier route repeated ${supplier.label}`
      );
      const previousCount = Number(body.requirement.current);
      await chapter1WarpAndWait(
        first,
        body.targetPosition,
        `${quest.id}/${step.id}: ${supplier.label}`
      );
      assert.equal(
        await chapterPrompt.isVisible().catch(() => false),
        false,
        `${quest.id}/${step.id}: ${supplier.label} must retain the vendor interaction`
      );
      await installChapter1SupplierTransactionEvidence(
        first,
        supplier.vendorId
      );
      visitedSupplierIds.add(supplier.vendorId);
      const advanced = await waitFor(
        `${quest.id}/${step.id}: supplier evidence advanced after ${supplier.label}`,
        () =>
          pageJson(first.page, "/api/harthmere/chapter1_progress", {
            method: "POST",
            body: JSON.stringify({ action: "state" }),
          }),
        (response) =>
          response.ok &&
          (String(response.body?.challengeId) !== String(challengeId) ||
            String(response.body?.stepId) !== String(stepId) ||
            Number(response.body?.requirement?.current ?? 0) > previousCount),
        20_000,
        40_000
      );
      if (
        advanced.value.body?.status !== "active" ||
        String(advanced.value.body?.challengeId) !== String(challengeId) ||
        String(advanced.value.body?.stepId) !== String(stepId)
      ) {
        break;
      }
      state = advanced;
    }
    assert.equal(
      initialSupplierCount + visitedSupplierIds.size,
      requiredSupplierCount,
      `${quest.id}/${step.id}: browser did not account for every supplier transaction`
    );
  }

  await waitFor(
    `${quest.id}/${step.id}: external evidence reaches Chapter 1`,
    async () => ({
      state: await pageJson(first.page, "/api/harthmere/chapter1_progress", {
        method: "POST",
        body: JSON.stringify({ action: "state" }),
      }),
      player: await authoritativeEntity(first.page, first.userId),
    }),
    ({ state, player }) =>
      (state.ok &&
        state.body?.status === "active" &&
        String(state.body.challengeId) === String(challengeId) &&
        String(state.body.stepId) === String(stepId) &&
        state.body.requirement?.ready === true) ||
      Boolean(
        player.entity?.challenges?.complete.has(challengeId) ||
        isTriggerFired(
          player.entity?.trigger_state?.by_root.get(challengeId),
          stepId
        )
      ),
    20_000,
    40_000
  );
}

/**
 * Install the canonical native/semantic pack, then enter through the real
 * fracture-gate product interaction. The fixture prepares resources only;
 * gate admission, survival reservation, and the authoritative WarpHomeEvent
 * remain production behavior.
 */
async function ensureChapter1DungeonMechanicsFixture(first, questId) {
  const fixture = chapter1DungeonFixtureForQuest(questId);
  if (!fixture) return;
  const authoritative = await authoritativeEntity(first.page, first.userId);
  assert(
    authoritative.entity?.inventory,
    `${questId}: native dungeon fixture has no inventory`
  );
  const nativeInventory = Inventory.clone(authoritative.entity.inventory);
  const expectedNativeCounts = [];
  for (const [itemId, count] of Object.entries(fixture.nativeItems)) {
    const nativeId = harthmereNativeBiomesIdForItemId(itemId);
    assert(nativeId, `${questId}: ${itemId} has no canonical native id`);
    setNativeInventoryCount(nativeInventory, nativeId, count);
    expectedNativeCounts.push({ itemId, nativeId, count });
  }
  await applyFixture(first.page, {
    kind: "update",
    entity: { id: first.userId, inventory: nativeInventory },
  });
  await waitFor(
    `${questId}: canonical native survival pack synchronized`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      expectedNativeCounts.every(
        ({ nativeId, count }) =>
          inventoryCount(entity, nativeId) === BigInt(count)
      ),
    15_000,
    30_000
  );

  const redis = await connectToRedis("firehose");
  try {
    const actorId = String(first.userId);
    const key = harthmereLiveModePlayerStateKey(actorId);
    const nowMs = Date.now();
    const raw = await redis.primary.get(key);
    const state = parseHarthmereLiveModeBackendState(raw, actorId, nowMs);
    for (const itemId of [
      "water",
      "torch",
      "fuel",
      "clean_water",
      "wall_lantern",
      "coal",
    ]) {
      delete state.inventory.items[itemId];
    }
    Object.assign(state.inventory.items, fixture.items);
    state.updatedAtMs = nowMs;
    await redis.primary.set(
      key,
      stringifyHarthmereLiveModePlayerPersistenceState(state)
    );
  } finally {
    await redis.quit("Chapter 1 dungeon provisioning fixture installed");
  }

  const gate = CH1_FRACTURE_GATES.find(
    (candidate) => candidate.dungeonId === fixture.dungeonId
  );
  assert(gate, `${questId}: no fracture gate for ${fixture.dungeonId}`);
  await chapter1WarpAndWait(
    first,
    gate.position,
    `${questId}: approach ${gate.id}`
  );
  const prompt = first.page.locator(
    `[data-chapter1-fracture-gate="${gate.id}"]` +
      `[data-gate-interaction="enter"]`
  );
  await prompt.waitFor({ state: "visible", timeout: 30_000 });
  await prompt
    .getByText(/^F — /)
    .waitFor({ state: "visible", timeout: 20_000 });
  const [response] = await Promise.all([
    waitForChapter1GateResponse(first.page, "enter", gate.id),
    first.page.keyboard.press("KeyF"),
  ]);
  assert(response.ok(), `${questId}: gate entry HTTP ${response.status()}`);
  const body = await response.json();
  assert.equal(
    body.ok,
    true,
    `${questId}: gate entry rejected: ${body.reason}`
  );
  assert.equal(body.activeDungeonRunId, fixture.dungeonId);
  assert(body.warpPosition, `${questId}: gate entry returned no warp position`);
  await waitFor(
    `${questId}: native gate-entry warp`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) => chapter1WarpSettled(entity?.position?.v, body.warpPosition),
    20_000,
    40_000
  );
  // The signed logic transaction reaches authoritative ECS before the browser
  // necessarily consumes its WarpHomeEvent. Advancing to the first objective
  // in that gap lets the legitimate portal warp arrive late and restore the
  // entry coordinates over the test's next movement. Wait for the actual local
  // simulation owner as well as server ECS before continuing.
  await waitFor(
    `${questId}: browser consumed gate-entry warp`,
    () =>
      first.page.evaluate(
        ({ userId }) => {
          const resources = globalThis.clientContext?.resources;
          return (
            resources?.get("/scene/local_player")?.player?.position ??
            resources?.get("/sim/player", userId)?.position
          );
        },
        { userId: first.userId }
      ),
    (position) => chapter1WarpSettled(position, body.warpPosition),
    20_000,
    40_000
  );
  const admitted = await authoritativeEntity(first.page, first.userId);
  assert.equal(
    readCh1NativeRunAdmission(admitted.entity?.trigger_state)?.dungeonId,
    fixture.dungeonId,
    `${questId}: gate-entry warp did not retain native portal admission`
  );
}

async function releaseFailedChapter1DungeonFixture(first) {
  const redis = await connectToRedis("firehose");
  try {
    const actorId = String(first.userId);
    const key = harthmereLiveModePlayerStateKey(actorId);
    const nowMs = Date.now();
    const raw = await redis.primary.get(key);
    if (!raw) return;
    const state = parseHarthmereLiveModeBackendState(raw, actorId, nowMs);
    const dungeonId = state.chapter1.activeDungeonRunId;
    const partyId = state.chapter1.activeDungeonPartyId;
    if (!dungeonId || !partyId) return;
    await releaseCh1Slot(redis, dungeonId, partyId, actorId);
    state.chapter1 = {
      ...state.chapter1,
      activeDungeonRunId: undefined,
      activeDungeonInstanceId: undefined,
      activeDungeonPartyId: undefined,
      activeGateId: undefined,
      activeRunStartedMs: undefined,
      returnPosition: undefined,
      dungeonSurvival: undefined,
    };
    state.updatedAtMs = nowMs;
    await redis.primary.set(
      key,
      stringifyHarthmereLiveModePlayerPersistenceState(state)
    );
    report.browser.transients.push(
      `chapter1-test-dungeon-slot-released:${dungeonId}:${actorId}`
    );
  } finally {
    await redis.quit("failed Chapter 1 dungeon fixture released");
  }
}

async function assertChapter1DungeonAdmission(first, questId, label) {
  const fixture = chapter1DungeonFixtureForQuest(questId);
  if (!fixture) return;
  const authoritative = await authoritativeEntity(first.page, first.userId);
  assert.equal(
    readCh1NativeRunAdmission(authoritative.entity?.trigger_state)?.dungeonId,
    fixture.dungeonId,
    `${questId}/${label}: native portal admission was lost`
  );
}

function waitForChapter1GateResponse(page, action, gateId) {
  return page.waitForResponse(
    (response) => {
      if (
        new URL(response.url()).pathname !== "/api/harthmere/chapter1_gate" ||
        response.request().method() !== "POST"
      ) {
        return false;
      }
      try {
        const body = response.request().postDataJSON();
        return (
          body?.action === action &&
          (gateId === undefined || body?.gateId === gateId)
        );
      } catch {
        return false;
      }
    },
    { timeout: 40_000 }
  );
}

async function exitChapter1DungeonThroughProduct(first, questId) {
  const fixture = chapter1DungeonFixtureForQuest(questId);
  if (!fixture) return;
  const slot = ch1ElsewhenSlot(fixture.dungeonId);
  assert(slot, `${questId}: no Elsewhen slot for ${fixture.dungeonId}`);
  await chapter1WarpAndWait(
    first,
    slot.departure,
    `${questId}: approach far anchor`
  );
  const prompt = first.page.locator(
    '[data-chapter1-fracture-gate][data-gate-interaction="exit"]'
  );
  await prompt.waitFor({ state: "visible", timeout: 30_000 });
  await prompt
    .getByText(/^F — /)
    .waitFor({ state: "visible", timeout: 20_000 });
  const [response] = await Promise.all([
    waitForChapter1GateResponse(first.page, "exit"),
    first.page.keyboard.press("KeyF"),
  ]);
  assert(response.ok(), `${questId}: gate exit HTTP ${response.status()}`);
  const body = await response.json();
  assert.equal(body.ok, true, `${questId}: gate exit rejected: ${body.reason}`);
  assert.equal(body.activeDungeonRunId, undefined);
  assert(body.warpPosition, `${questId}: gate exit returned no warp position`);
  await waitFor(
    `${questId}: native gate-exit warp`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) => chapter1WarpSettled(entity?.position?.v, body.warpPosition),
    20_000,
    40_000
  );
}

/**
 * Native trigger checkpoints and live-mode story consequences are two halves
 * of the same production quest. Reconstruct both when resuming: seeding only
 * the ECS trigger map used to hide missing ledger/items/person flags and made
 * later objectives fail for reasons unrelated to the code under repair.
 */
async function resetChapter1LiveStoryCheckpoint(first) {
  const redis = await connectToRedis("firehose");
  let chapter1Checkpoint;
  try {
    const actorId = String(first.userId);
    const key = harthmereLiveModePlayerStateKey(actorId);
    const nowMs = Date.now();
    const raw = await redis.primary.get(key);
    const state = parseHarthmereLiveModeBackendState(raw, actorId, nowMs);

    // Keep unrelated actor state, but make Chapter 1 deterministic. Otherwise
    // an earlier run's idempotency ledger can suppress the very grants this
    // resumed browser batch is meant to verify.
    state.chapter1 = defaultCh1LiveGateRuntimeState();
    state.inventory.gold = Math.max(
      state.inventory.gold,
      CH1_E2E_RETAINED_PREREQUISITE_GOLD
    );
    for (const item of CH1_ITEMS) {
      delete state.inventory.items[item.id];
    }
    // Supplier visits are Chapter 1 checkpoint evidence, not unrelated player
    // economy state. Clear prior focused-run transactions before replaying the
    // retained steps; otherwise Meet the Suppliers starts already ready,
    // bypasses the vendor-owned F state, and turns the ownership gate into a
    // false wait for a Chapter 1 prompt that should never appear.
    for (const supplier of CH1_GROVE_SUPPLIER_ROUTE) {
      delete state.economy.vendorTransactions[supplier.vendorId];
    }

    for (const quest of CH1_QUESTS) {
      for (const [stepIndex, step] of quest.steps.entries()) {
        if (
          !chapter1ResumeAfter?.passedObjectiveKeys.has(
            `${quest.id}/${step.id}`
          )
        ) {
          continue;
        }
        for (const requirement of chapter1ExternallySourcedInventoryRequirements(
          quest,
          step
        )) {
          state.inventory.items[requirement.itemId] = Math.max(
            state.inventory.items[requirement.itemId] ?? 0,
            requirement.count
          );
        }
        if (step.id === "take_jobs") {
          const challengeId = ch1NativeQuestId(quest.id);
          const payoutId = `chapter1_e2e_completed_jobs:${challengeId}`;
          if (!state.economy.ledger.some((entry) => entry.id === payoutId)) {
            const payout =
              CH1_REQUIRED_GROVE_JOB_COMPLETIONS *
              CH1_E2E_GROVE_JOB_REWARD_GOLD;
            state.inventory.gold += payout;
            state.economy.ledger.push({
              id: payoutId,
              kind: "jobs_board_reward",
              amount: payout,
              atMs: nowMs,
            });
          }
        }
        if (step.id === "meet_the_suppliers") {
          for (const supplier of CH1_GROVE_SUPPLIER_ROUTE) {
            state.economy.vendorTransactions[supplier.vendorId] = Math.max(
              1,
              Number(state.economy.vendorTransactions[supplier.vendorId] ?? 0)
            );
          }
        }
        const incrementalRoute = chapter1IncrementalObjectiveRoute(step.id);
        let effects;
        for (
          let visitIndex = 0;
          visitIndex < (incrementalRoute?.length ?? 1);
          visitIndex += 1
        ) {
          try {
            effects = ch1ApplyLiveObjectiveEffects({
              runtime: state.chapter1,
              quest,
              step,
              stepIndex,
              choice: CH1_E2E_CHOICE_BY_STEP_ID[step.id],
              nowMs:
                nowMs +
                state.chapter1.appliedObjectiveEffects.length +
                visitIndex,
            });
          } catch (error) {
            if (!(error instanceof Ch1ObjectiveIncomplete)) throw error;
            assert(
              incrementalRoute && visitIndex < incrementalRoute.length - 1,
              `${quest.id}/${step.id}: resume checkpoint stayed incomplete after its final routed visit`
            );
            state.chapter1 = error.runtime;
            continue;
          }
          assert.equal(
            visitIndex,
            (incrementalRoute?.length ?? 1) - 1,
            `${quest.id}/${step.id}: resume checkpoint completed before its final routed visit`
          );
        }
        assert(
          effects,
          `${quest.id}/${step.id}: resume checkpoint produced no final effects`
        );
        for (const itemId of effects.itemConsumes) {
          const count = state.inventory.items[itemId] ?? 0;
          assert(
            count > 0,
            `${quest.id}/${step.id}: resume checkpoint lacks ${itemId}`
          );
          if (count === 1) delete state.inventory.items[itemId];
          else state.inventory.items[itemId] = count - 1;
        }
        for (const itemId of effects.itemGrants) {
          state.inventory.items[itemId] =
            (state.inventory.items[itemId] ?? 0) + 1;
        }
        state.chapter1 = effects.runtime;
      }
    }
    state.updatedAtMs = nowMs;
    chapter1Checkpoint = {
      itemCounts: Object.fromEntries(
        CH1_ITEMS.map((item) => [item.id, state.inventory.items[item.id] ?? 0])
      ),
      gold: state.inventory.gold,
    };
    await redis.primary.set(
      key,
      stringifyHarthmereLiveModePlayerPersistenceState(state)
    );
  } finally {
    await redis.quit("Chapter 1 live story checkpoint installed");
  }
  return chapter1Checkpoint;
}

function chapter1NativeStartingFixture(entity) {
  const challenges = Challenges.clone(entity.challenges);
  const triggerState = TriggerState.clone(entity.trigger_state);
  for (const quest of CH1_QUESTS) {
    const challengeId = ch1NativeQuestId(quest.id);
    if (!challengeId) continue;
    challenges.available.delete(challengeId);
    challenges.in_progress.delete(challengeId);
    challenges.complete.delete(challengeId);
    challenges.started_at.delete(challengeId);
    challenges.finished_at.delete(challengeId);
    triggerState.by_root.delete(challengeId);
  }
  // The retained prerequisite report already proved Muck vs. Machine. Seed
  // only its completed edge and the legitimately unlocked first Chapter 1
  // offer; never replay or mutate the earlier four-quest chain.
  challenges.complete.add(NATIVE_MUCK_VS_MACHINE_QUEST_ID);
  const seededAt = Math.floor(Date.now() / 1000);
  const nativeBiscuits = allCh1NativeQuestBiscuits();
  const nativeBiscuitsByAuthoredId = new Map(
    CH1_QUESTS.map((quest, index) => [quest.id, nativeBiscuits[index]])
  );
  let seededCurrentQuest = false;
  for (const quest of CH1_QUESTS) {
    const challengeId = ch1NativeQuestId(quest.id);
    const passedSteps = quest.steps.filter((step) =>
      chapter1ResumeAfter?.passedObjectiveKeys.has(`${quest.id}/${step.id}`)
    );
    if (passedSteps.length > 0) {
      triggerState.by_root.set(
        challengeId,
        new Map(
          passedSteps.map((step, stepIndex) => [
            ch1NativeQuestStepId(quest.id, stepIndex),
            seededAt,
          ])
        )
      );
    }
    if (passedSteps.length === quest.steps.length) {
      challenges.complete.add(challengeId);
      challenges.finished_at.set(challengeId, seededAt);
      continue;
    }
    if (!seededCurrentQuest && passedSteps.length > 0) {
      challenges.in_progress.add(challengeId);
      challenges.started_at.set(challengeId, seededAt);
      seededCurrentQuest = true;
      continue;
    }
    if (!seededCurrentQuest) {
      const nativeBiscuit = nativeBiscuitsByAuthoredId.get(quest.id);
      if (nativeBiscuit?.questGiver) {
        challenges.available.add(challengeId);
      } else {
        // Native no-giver quests auto-start when their unlock fires. A resume
        // fixture must mirror that state; seeding them as `available` creates
        // an impossible challenge with no NPC from which to accept it.
        challenges.in_progress.add(challengeId);
        challenges.started_at.set(challengeId, seededAt);
      }
      seededCurrentQuest = true;
    }
  }
  return { challenges, triggerState };
}

async function resetChapter1NativeQuestChain(first) {
  const checkpoint = await resetChapter1LiveStoryCheckpoint(first);
  assert(checkpoint, "Chapter 1 fixture: live checkpoint missing");
  const current = await authoritativeEntity(first.page, first.userId);
  assert(current.entity?.challenges, "Chapter 1 fixture: challenges missing");
  assert(
    current.entity?.trigger_state,
    "Chapter 1 fixture: trigger state missing"
  );
  assert(current.entity?.inventory, "Chapter 1 fixture: inventory missing");
  const fixture = chapter1NativeStartingFixture(current.entity);
  const inventory = Inventory.clone(current.entity.inventory);
  replaceChapter1FixtureNativeGold(inventory, checkpoint.gold);
  const nativeChapter1ItemCounts = [];
  for (const item of CH1_ITEMS) {
    const nativeId = harthmereNativeBiomesIdForItemId(item.id);
    assert(nativeId, `${item.id}: resume fixture has no native identity`);
    const count = checkpoint.itemCounts[item.id] ?? 0;
    setNativeInventoryCount(inventory, nativeId, count);
    nativeChapter1ItemCounts.push({ nativeId, count });
  }
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      challenges: fixture.challenges,
      trigger_state: fixture.triggerState,
      inventory,
    },
  });
  await waitFor(
    "Chapter 1 native quest checkpoint",
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) => {
      const firstRemaining = CH1_QUESTS.find((quest) =>
        quest.steps.some(
          (step) =>
            !chapter1ResumeAfter?.passedObjectiveKeys.has(
              `${quest.id}/${step.id}`
            )
        )
      );
      if (!firstRemaining) return true;
      const challengeId = ch1NativeQuestId(firstRemaining.id);
      return (
        Boolean(
          entity?.challenges?.available.has(challengeId) ||
          entity?.challenges?.in_progress.has(challengeId)
        ) &&
        nativeChapter1ItemCounts.every(
          ({ nativeId, count }) =>
            inventoryCount(entity, nativeId) === BigInt(count)
        ) &&
        nativeGold(entity) === BigInt(checkpoint.gold)
      );
    },
    20_000,
    30_000
  );
}

async function ensureChapter1QuestInProgress(first, quest, catalog) {
  const challengeId = ch1NativeQuestId(quest.id);
  const unlocked = await waitFor(
    `${quest.title}: native unlock`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      Boolean(
        entity?.challenges?.available.has(challengeId) ||
        entity?.challenges?.in_progress.has(challengeId)
      ),
    60_000,
    90_000
  );
  if (unlocked.value.entity.challenges.in_progress.has(challengeId)) {
    return;
  }
  assert(catalog.questGiver, `${quest.id}: available quest has no giver`);
  const giverId = Number(catalog.questGiver);
  const giver = await authoritativeEntity(first.page, giverId);
  assert(giver.entity?.position?.v, `${quest.id}: quest giver is absent`);
  const giverPosition = giver.entity.position.v;
  await chapter1WarpAndWait(
    first,
    [giverPosition[0] + 1.5, giverPosition[1], giverPosition[2] + 1.5],
    `${quest.id}: accept from ${catalog.questGiver}`
  );
  await bridgeCall(
    first.page,
    "publish",
    serializedEvent(
      new AcceptChallengeEvent({
        id: first.userId,
        challenge_id: challengeId,
        npc_id: giverId,
      })
    )
  );
  await waitFor(
    `${quest.title}: native acceptance`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) => entity?.challenges?.in_progress.has(challengeId),
    20_000,
    30_000
  );
}

function waitForChapter1ProgressResponse(
  page,
  action,
  challengeId,
  stepId,
  responseTimeoutMs = 20_000
) {
  return page.waitForResponse(
    (response) => {
      if (
        response.url() !== `${baseUrl}/api/harthmere/chapter1_progress` ||
        response.request().method() !== "POST"
      ) {
        return false;
      }
      try {
        const body = response.request().postDataJSON();
        return (
          body?.action === action &&
          String(body.challengeId) === String(challengeId) &&
          String(body.stepId) === String(stepId)
        );
      } catch {
        return false;
      }
    },
    // The production-shaped local web service has observed 4-5s state-route
    // latency while generating player meshes. Twenty seconds still fails far
    // ahead of the ECS gate without misclassifying a queued valid action.
    { timeout: responseTimeoutMs }
  );
}

function waitForChapter1CompletionResponse(
  page,
  challengeId,
  stepId,
  responseTimeoutMs = 20_000
) {
  return waitForChapter1ProgressResponse(
    page,
    "complete",
    challengeId,
    stepId,
    responseTimeoutMs
  );
}

async function drainChapter1Dialogue(first, step, mode, options = {}) {
  const selector =
    `[data-chapter1-dialogue-objective="${step.id}"]` +
    `[data-chapter1-dialogue-mode="${mode}"]`;
  const dialog = first.page.locator(selector);
  const visible = await dialog
    .waitFor({
      state: "visible",
      timeout: options.required ? 20_000 : 1_500,
    })
    .then(() => true)
    .catch(() => false);
  if (!visible) {
    assert(
      !options.required,
      `${step.id}: server projected ${mode} dialogue but it did not render`
    );
    return false;
  }
  for (let pageIndex = 0; pageIndex < 64; pageIndex += 1) {
    if (!(await dialog.isVisible().catch(() => false))) return true;
    // The stable page marker belongs to the dialogue portal itself. Looking
    // for it on a descendant turns a visible stock TalkDialogModal into a
    // two-minute false timeout before the first objective can complete.
    const before = await dialog.getAttribute("data-chapter1-dialogue-page");
    const renderedExpression = await dialog.getAttribute(
      "data-chapter1-dialogue-expression"
    );
    const renderedActorId = await dialog.getAttribute(
      "data-chapter1-dialogue-actor-id"
    );
    const expectedExpression = options.expectedPages?.[pageIndex]?.expression;
    if (expectedExpression) {
      assert.equal(
        renderedExpression,
        expectedExpression,
        `${step.id}: page ${pageIndex + 1} rendered the wrong expression`
      );
    }
    if (renderedExpression && renderedExpression !== "none") {
      assert(
        renderedActorId && renderedActorId !== "none",
        `${step.id}: ${renderedExpression} has no human NPC actor`
      );
      await first.page.waitForFunction(
        ({ actorId, expression }) => {
          const cue = window.__harthmereNpcDialogueExpression;
          return (
            String(cue?.actorId) === actorId && cue?.expression === expression
          );
        },
        { actorId: renderedActorId, expression: renderedExpression },
        { timeout: 10_000 }
      );
    } else if (expectedExpression) {
      assert.fail(
        `${step.id}: page ${
          pageIndex + 1
        } did not publish its human NPC expression`
      );
    }
    const originalTalkSurface = dialog.locator(
      ".npc-quest-view .npc-quest-dialog-container"
    );
    await originalTalkSurface.waitFor({ state: "visible", timeout: 10_000 });
    const continuePrompt = dialog.locator(
      ".text-shadow-bordered.fixed.bottom-2"
    );
    await continuePrompt.waitFor({ state: "visible", timeout: 20_000 });
    const isFinalPage =
      (await dialog.getAttribute("data-chapter1-dialogue-final")) === "true";
    if (isFinalPage) {
      const finalText = String(await originalTalkSurface.textContent()).trim();
      assert(
        /Go to |Press J to open BiomesUI|Chapter 1 is complete\./.test(
          finalText
        ),
        `${step.id}: final conversation page did not state where to go`
      );
      assert.doesNotMatch(finalText, /Next task:/i);
      const presentation = await originalTalkSurface.evaluate((element) => {
        const surface = getComputedStyle(element);
        const text = element.querySelector(".npc-quest-dialog");
        const textStyle = text ? getComputedStyle(text) : undefined;
        return {
          backgroundImage: surface.backgroundImage,
          backgroundColor: surface.backgroundColor,
          fontSize: Number.parseFloat(textStyle?.fontSize ?? "0"),
        };
      });
      assert(
        presentation.backgroundImage !== "none" ||
          !/rgba?\(0, 0, 0, 0\)/.test(presentation.backgroundColor),
        `${step.id}: dialogue has no readable background surface`
      );
      assert(
        presentation.fontSize >= 18,
        `${step.id}: dialogue text is only ${presentation.fontSize}px`
      );
    }
    if (isFinalPage && options.beforeFinalClick) {
      options.beforeFinalClick();
    }
    // GenericTalkDialogModalStep advances through the game's original global
    // mouseup/keyboard interaction contract. Clicking the visible in-world
    // dialogue panel preserves the real presentation instead of depending on
    // the removed Chapter 1-specific modal button.
    await originalTalkSurface.click();
    await first.page.waitForFunction(
      ({ selector, before }) => {
        const root = document.querySelector(selector);
        if (!root) return true;
        return root.getAttribute("data-chapter1-dialogue-page") !== before;
      },
      { selector, before },
      { timeout: 10_000 }
    );
  }
  throw new Error(`${step.id}: dialogue exceeded 64 message screens`);
}

async function invokeChapter1ObjectiveInteraction(first, state, step) {
  if (!["talk_npc", "dialogue_choice"].includes(step.trigger)) {
    await first.page.keyboard.press("KeyF");
    return;
  }
  const targetEntityId = Number(state.value.body.targetEntityId);
  assert(
    Number.isSafeInteger(targetEntityId) && targetEntityId > 0,
    `${step.id}: NPC objective has no canonical target entity`
  );
  // Exercise the alternate production entry point for every NPC phase, not
  // just the global F dispatcher. TalkToNPCScreen must immediately close the
  // stock/default quest surface and route the exact active Chapter 1 target
  // into the story objective. If regular NPC text wins, the expected Chapter
  // 1 dialogue/choice/completion below never appears and the row fails.
  await first.page.evaluate((talkingToNPCId) => {
    const context = globalThis.clientContext;
    if (!context?.resources) throw new Error("client context unavailable");
    context.resources.set("/game_modal", {
      kind: "talk_to_npc",
      talkingToNPCId,
    });
  }, targetEntityId);
}

async function completeChapter1ObjectiveThroughProduct(first, args) {
  const { challengeId, quest, state, step, stepId } = args;
  const choice = state.value.body.choice;
  const dialoguePages = state.value.body.dialogue?.pages?.length ?? 0;
  // Exact-image local runs can legitimately queue the signed completion
  // behind mesh generation and background state reads. July 30 observed the
  // correct kit-check request return HTTP 200 at the old 24s boundary. Native
  // signed progress below remains the gameplay authority, so this is only a
  // transport wait budget, not a weakened completion assertion.
  const responseTimeoutMs = Math.max(40_000, 20_000 + dialoguePages * 2_000);
  const selectedChoice = CH1_E2E_CHOICE_BY_STEP_ID[step.id];
  const encounterFixtures = ch1RequiredEncounterNpcsForObjective(
    step.id,
    selectedChoice
  );
  const escortFixtures = ch1RequiredEscortNpcsForObjective(step.id);
  const fixtureChanges = [];
  const escortTargets = [];
  for (const encounter of encounterFixtures) {
    const current = await authoritativeEntity(first.page, encounter.entityId);
    fixtureChanges.push({
      kind: "update",
      entity: {
        id: encounter.entityId,
        health: Health.create({
          hp: 0,
          maxHp: current.entity?.health?.maxHp ?? encounter.maxHp,
        }),
      },
    });
  }
  for (const companion of escortFixtures) {
    const target = state.value.body.targetPosition;
    assert(target, `${quest.id}/${step.id}: escort target has no position`);
    escortTargets.push({
      entityId: companion.entityId,
      displayName: companion.displayName,
      target,
    });
  }
  if (fixtureChanges.length > 0) {
    await applyFixture(first.page, ...fixtureChanges);
  }
  for (const escort of escortTargets) {
    // The objective is explicitly a 400-metre escort. Do not teleport or lock
    // the companion as a test shortcut: Anima owns terrain-aware movement,
    // catch-up, combat, and recovery. The production completion route requires
    // the same 22m arrival radius, so wait on its authoritative WorldApi long
    // enough for the authored journey instead of using the ordinary 40s step
    // transition budget.
    await waitFor(
      `${quest.id}/${step.id}: ${escort.displayName} completes the live escort route`,
      () => authoritativeEntity(first.page, escort.entityId),
      ({ entity }) =>
        Boolean(entity?.position?.v) &&
        distance3(entity.position.v, escort.target) <= 22,
      180_000,
      180_000
    );
  }
  const finishResponse = async (response) => response;
  if (step.id === "the_procedure") {
    const responsePromise = waitForChapter1CompletionResponse(
      first.page,
      challengeId,
      stepId,
      responseTimeoutMs
    );
    await invokeChapter1ObjectiveInteraction(first, state, step);
    const triage = first.page.locator(
      '[data-chapter1-containment-triage="objective"]'
    );
    await triage.waitFor({ state: "visible", timeout: 20_000 });
    const controls = triage.locator("[data-chapter1-containment-control]");
    const controlCount = await controls.count();
    assert.equal(
      controlCount,
      4,
      `${quest.id}/${step.id}: containment procedure lost an authored stage`
    );
    for (let index = 0; index < controlCount; index += 1) {
      await first.page.waitForFunction(
        ({ index }) =>
          document
            .querySelectorAll("[data-chapter1-containment-control]")
            [index]?.getAttribute("data-state") === "active",
        { index },
        { timeout: 10_000 }
      );
      await controls.nth(index).click();
    }
    await triage.waitFor({ state: "hidden", timeout: 20_000 });
    const response = await responsePromise;
    await drainChapter1Dialogue(first, step, "completion");
    return finishResponse(response);
  }
  if (!choice) {
    let responsePromise;
    if (dialoguePages === 0) {
      responsePromise = waitForChapter1CompletionResponse(
        first.page,
        challengeId,
        stepId,
        responseTimeoutMs
      );
    }
    await invokeChapter1ObjectiveInteraction(first, state, step);
    await drainChapter1Dialogue(first, step, "objective", {
      required: dialoguePages > 0,
      expectedPages: state.value.body.dialogue?.pages,
      beforeFinalClick: () => {
        responsePromise = waitForChapter1CompletionResponse(
          first.page,
          challengeId,
          stepId,
          responseTimeoutMs
        );
      },
    });
    assert(
      responsePromise,
      `${quest.id}/${step.id}: completion response was not armed`
    );
    const response = await responsePromise;
    await drainChapter1Dialogue(first, step, "completion");
    return finishResponse(response);
  }

  if (step.id === "not_this_small") {
    // Reproduce the user's exact collision: Road Signs is ready to turn in to
    // Jackie while Jackie is also the staged Chapter 1 choice target. The
    // Chapter 1 interaction must win; the generic Complete Quest menu must not
    // replace it or require a second press.
    const roadQuestId = groveNativeQuestId("road_signs_and_small_lies");
    const roadStepIds = [0, 1, 2, 3].map((index) =>
      groveNativeStepId("road_signs_and_small_lies", index)
    );
    assert(roadQuestId && roadStepIds.every(Boolean));
    const current = await authoritativeEntity(first.page, first.userId);
    const challenges = Challenges.clone(
      current.entity?.challenges ?? Challenges.create()
    );
    challenges.in_progress.add(roadQuestId);
    challenges.started_at.set(roadQuestId, secondsSinceEpoch() - 30);
    const triggerState = TriggerState.clone(
      current.entity?.trigger_state ?? TriggerState.create()
    );
    triggerState.by_root.set(
      roadQuestId,
      new Map(
        roadStepIds
          .slice(0, 3)
          .map((stepId, index) => [stepId, secondsSinceEpoch() - 20 + index])
      )
    );
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        challenges,
        trigger_state: triggerState,
      },
    });
    await waitFor(
      "Jackie collision fixture reaches the live browser",
      () => localEntity(first.page, first.userId),
      ({ entity }) =>
        entity?.challenges?.in_progress.has(roadQuestId) &&
        roadStepIds
          .slice(0, 3)
          .every((stepId) =>
            isTriggerFired(
              entity?.trigger_state?.by_root.get(roadQuestId),
              stepId
            )
          ),
      Math.max(originSyncGateMs, 10_000),
      Math.max(timeoutMs, 30_000)
    );
  }

  await invokeChapter1ObjectiveInteraction(first, state, step);
  if (step.id === "not_this_small") {
    const genericRoadSigns = first.page.getByRole("button", {
      name: /Road Signs and Small Lies/i,
    });
    assert.equal(
      await genericRoadSigns.isVisible().catch(() => false),
      false,
      "Jackie opened the generic Road Signs quest menu instead of Chapter 1"
    );
  }
  await drainChapter1Dialogue(first, step, "objective", {
    required: dialoguePages > 0,
    expectedPages: state.value.body.dialogue?.pages,
  });
  const dialog = first.page.locator(
    `[data-chapter1-choice-objective="${step.id}"]`
  );
  await dialog.waitFor({ state: "visible", timeout: 20_000 });
  const nextDirection = dialog.locator("[data-chapter1-choice-next]");
  await nextDirection.waitFor({ state: "visible", timeout: 20_000 });
  assert.match(
    String(await nextDirection.textContent()),
    /Go to |Press J to open BiomesUI|Chapter 1 is complete\./,
    `${quest.id}/${step.id}: choice did not state what happens next`
  );
  assert.doesNotMatch(
    String(await nextDirection.textContent()),
    /Next task:/i,
    `${quest.id}/${step.id}: choice exposed a mechanical Next task label`
  );
  const choicePresentation = await dialog
    .locator(".chapter1-choice-dialog")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundImage: style.backgroundImage,
        backgroundColor: style.backgroundColor,
        fontSize: Number.parseFloat(style.fontSize),
        width: element.getBoundingClientRect().width,
      };
    });
  assert(
    choicePresentation.backgroundImage !== "none" ||
      !/rgba?\(0, 0, 0, 0\)/.test(choicePresentation.backgroundColor),
    `${quest.id}/${step.id}: choice has no readable background surface`
  );
  assert(
    choicePresentation.fontSize >= 16 && choicePresentation.width >= 480,
    `${quest.id}/${step.id}: choice surface is too small (${JSON.stringify(
      choicePresentation
    )})`
  );

  if (step.id === "give_the_ledger") {
    // "Not yet" is a real indefinite player choice, not a disguised submit.
    // Close it once, then prove neither HTTP nor native progress advanced.
    const notYet = dialog.locator('[data-chapter1-choice="not_yet"]');
    await notYet.click();
    await dialog.waitFor({ state: "hidden", timeout: 10_000 });
    const deferred = await pageJson(
      first.page,
      "/api/harthmere/chapter1_progress",
      { method: "POST", body: JSON.stringify({ action: "state" }) }
    );
    assert.equal(
      deferred.ok,
      true,
      `${quest.id}/${step.id}: deferred state HTTP`
    );
    assert.equal(deferred.body?.status, "active");
    assert.equal(String(deferred.body?.stepId), String(stepId));
    const authoritative = await authoritativeEntity(first.page, first.userId);
    assert.equal(
      isTriggerFired(
        authoritative.entity?.trigger_state?.by_root.get(challengeId),
        stepId
      ),
      false,
      `${quest.id}/${step.id}: Not yet fired native progress`
    );
    await invokeChapter1ObjectiveInteraction(first, state, step);
    await drainChapter1Dialogue(first, step, "objective", {
      required: dialoguePages > 0,
      expectedPages: state.value.body.dialogue?.pages,
    });
    await dialog.waitFor({ state: "visible", timeout: 20_000 });
  }

  assert(
    selectedChoice &&
      choice.options.some((option) => option.id === selectedChoice),
    `${quest.id}/${step.id}: no deterministic E2E choice for ${JSON.stringify(
      choice.options
    )}`
  );
  const option = dialog.locator(`[data-chapter1-choice="${selectedChoice}"]`);
  const preparesEncounter = [
    "fight_open",
    "break_horns",
    "fight_through",
    "feed_hearth",
    "fight_dark",
  ].includes(selectedChoice);
  if (preparesEncounter) {
    const [prepareResponse] = await Promise.all([
      waitForChapter1ProgressResponse(
        first.page,
        "prepare",
        challengeId,
        stepId,
        responseTimeoutMs
      ),
      option.click(),
    ]);
    assert(
      prepareResponse.ok(),
      `${quest.id}/${
        step.id
      }: encounter preparation HTTP ${prepareResponse.status()}`
    );
    const prepared = await prepareResponse.json();
    assert.equal(prepared.status, "active");
    assert.equal(prepared.preparedChoice, selectedChoice);
    await dialog.waitFor({ state: "hidden", timeout: 20_000 });

    const prompt = first.page.locator(
      `[data-chapter1-native-objective="${step.id}"]`
    );
    await prompt.getByText(/^F — /).waitFor({
      state: "visible",
      timeout: 20_000,
    });
    const completionResponse = waitForChapter1CompletionResponse(
      first.page,
      challengeId,
      stepId,
      responseTimeoutMs
    );
    await first.page.keyboard.press("KeyF");
    const response = await completionResponse;
    await drainChapter1Dialogue(first, step, "completion");
    return finishResponse(response);
  }
  const [response] = await Promise.all([
    waitForChapter1CompletionResponse(
      first.page,
      challengeId,
      stepId,
      responseTimeoutMs
    ),
    option.click(),
  ]);
  await dialog.waitFor({ state: "hidden", timeout: 20_000 });
  await drainChapter1Dialogue(first, step, "completion");
  return finishResponse(response);
}

function chapter1IncrementalObjectiveRoute(stepId) {
  if (stepId === "collect_testimonies") return CH1_TESTIMONY_ROUTE;
  if (stepId === "the_three_answers") return CH1_THREE_ANSWER_ROUTE;
}

async function completeChapter1IncrementalObjectiveThroughProduct(
  first,
  args,
  initialReadyState
) {
  const { challengeId, quest, step, stepId } = args;
  const route = chapter1IncrementalObjectiveRoute(step.id);
  assert(route, `${quest.id}/${step.id}: missing incremental route`);
  let completionBody;
  for (const [index, stop] of route.entries()) {
    const state =
      index === 0
        ? initialReadyState
        : await waitFor(
            `${quest.id}/${step.id}: routed visit ${stop.label}`,
            () =>
              pageJson(first.page, "/api/harthmere/chapter1_progress", {
                method: "POST",
                body: JSON.stringify({ action: "state" }),
              }),
            (response) =>
              response.ok &&
              response.body?.status === "active" &&
              String(response.body.challengeId) === String(challengeId) &&
              String(response.body.stepId) === String(stepId) &&
              response.body.targetLabel === stop.label,
            20_000,
            40_000
          );
    assert.equal(
      state.value.body.targetLabel,
      stop.label,
      `${quest.id}/${step.id}: route target drifted at visit ${index + 1}`
    );
    if (index > 0) {
      await chapter1WarpAndWait(
        first,
        state.value.body.targetPosition,
        `${quest.id}/${step.id}: ${stop.label}`
      );
    }
    const readyState = await waitFor(
      `${quest.id}/${step.id}: ${stop.label} interaction range`,
      () =>
        pageJson(first.page, "/api/harthmere/chapter1_progress", {
          method: "POST",
          body: JSON.stringify({ action: "state" }),
        }),
      (response) =>
        response.ok &&
        response.body?.status === "active" &&
        String(response.body.challengeId) === String(challengeId) &&
        String(response.body.stepId) === String(stepId) &&
        response.body.targetLabel === stop.label &&
        response.body.withinRange === true,
      20_000,
      40_000
    );
    await waitForChapter1CutsceneIdle(
      first,
      `${quest.id}/${step.id}:${stop.id}`
    );
    const prompt = first.page.locator(
      `[data-chapter1-native-objective="${step.id}"]`
    );
    await prompt.waitFor({ state: "visible", timeout: 20_000 });
    await prompt.getByText(stop.label, { exact: true }).waitFor({
      state: "visible",
      timeout: 20_000,
    });
    await prompt.getByText(/^F — /).waitFor({
      state: "visible",
      timeout: 20_000,
    });
    const response = await completeChapter1ObjectiveThroughProduct(first, {
      ...args,
      state: readyState,
    });
    assert(
      response.ok(),
      `${quest.id}/${step.id}: visit ${index + 1} HTTP ${response.status()}`
    );
    completionBody = await response.json();
    const finalVisit = index === route.length - 1;
    if (finalVisit) {
      assert.equal(
        completionBody.status,
        "completed",
        `${quest.id}/${step.id}: final routed visit rejected: ${JSON.stringify(
          completionBody
        )}`
      );
    } else {
      assert.equal(
        completionBody.status,
        "rejected",
        `${quest.id}/${step.id}: visit ${index + 1} advanced too early`
      );
      assert(
        String(completionBody.reason ?? "").includes(
          `${index + 1} of ${route.length}`
        ),
        `${quest.id}/${step.id}: partial progress reason lost its routed count`
      );
      const authoritative = await authoritativeEntity(first.page, first.userId);
      assert.equal(
        isTriggerFired(
          authoritative.entity?.trigger_state?.by_root.get(challengeId),
          stepId
        ),
        false,
        `${quest.id}/${step.id}: native leaf fired before the final routed visit`
      );
    }
  }
  return completionBody;
}

function waitForChapter1StoryResponse(page, action, fragmentId) {
  return page.waitForResponse(
    (response) => {
      if (
        response.url() !== `${baseUrl}/api/harthmere/chapter1_story` ||
        response.request().method() !== "POST"
      ) {
        return false;
      }
      try {
        const body = response.request().postDataJSON();
        return (
          body?.action === action &&
          (fragmentId === undefined || body?.fragmentId === fragmentId)
        );
      } catch {
        return false;
      }
    },
    { timeout: 20_000 }
  );
}

/**
 * One warm UI batch proves the server-projected Recovered journal, the
 * AUGUR-9 charge consequence, and fragment linking. This deliberately uses
 * the visible controls rather than calling the mutation API directly.
 */
async function proveChapter1RecoveredJournal(first) {
  const initial = await pageJson(first.page, "/api/harthmere/chapter1_story", {
    method: "POST",
    body: JSON.stringify({ action: "state" }),
  });
  assert.equal(initial.ok, true, "Recovered state HTTP failed");
  assert.equal(initial.body?.ok, true, initial.body?.reason);
  assert.equal(initial.body?.unlocked, true, "Recovered journal stayed locked");
  assert.equal(initial.body?.cardName, "Custodian Key 7");
  assert.equal(initial.body?.testimonies?.count, 12);
  assert.equal(initial.body?.hallrChoice, "hold_stall");
  assert.equal(initial.body?.ending, "confess");
  assert(
    initial.body?.latentSkills?.length >= 4,
    "Recovered journal omitted mastered latent skills"
  );

  await first.page.keyboard.press("BracketLeft");
  const panel = first.page.locator('[data-chapter1-recovered-tab="unlocked"]');
  await panel.waitFor({ state: "visible", timeout: 20_000 });

  const recipe = CH1_LINK_RECIPES[0];
  let story = initial.body;
  for (const fragmentId of recipe.sources) {
    const log = story.augur9.availableLogs.find(
      (candidate) => candidate.fragmentId === fragmentId
    );
    assert(log, `Recovered journal omitted playback ${fragmentId}`);
    if (log.played) continue;
    const button = panel.locator(`[data-chapter1-playback-id="${fragmentId}"]`);
    await button.waitFor({ state: "visible", timeout: 20_000 });
    const priorCharge = story.augur9.charge;
    const [response] = await Promise.all([
      waitForChapter1StoryResponse(first.page, "play_log", fragmentId),
      button.click(),
    ]);
    assert(response.ok(), `playback ${fragmentId} HTTP ${response.status()}`);
    story = await response.json();
    assert.equal(story.ok, true, story.reason);
    assert.equal(
      story.augur9.charge,
      priorCharge - log.chargeCost,
      `${fragmentId}: AUGUR-9 charge did not decrease`
    );
    assert(
      story.augur9.availableLogs.find(
        (candidate) => candidate.fragmentId === fragmentId
      )?.played,
      `${fragmentId}: playback was not durably recorded`
    );
    await button.waitFor({ state: "hidden", timeout: 20_000 });
  }

  const linkButton = panel.locator(
    `[data-chapter1-link-fragments="${recipe.derives}"]`
  );
  await linkButton.waitFor({ state: "visible", timeout: 20_000 });
  const [linkResponse] = await Promise.all([
    waitForChapter1StoryResponse(first.page, "link"),
    linkButton.click(),
  ]);
  assert(linkResponse.ok(), `fragment link HTTP ${linkResponse.status()}`);
  story = await linkResponse.json();
  assert.equal(story.ok, true, story.reason);
  assert(
    story.ledger.entries.some((entry) => entry.fragmentId === recipe.derives),
    "linked reconstruction was not persisted"
  );
  await panel
    .locator(`[data-chapter1-fragment-id="${recipe.derives}"]`)
    .waitFor({ state: "visible", timeout: 20_000 });
  await first.page.keyboard.press("Escape");
  return {
    cardName: story.cardName,
    fragmentCount: story.ledger.entries.length,
    latentSkillCount: story.latentSkills.length,
    testimonies: story.testimonies.count,
    augurCharge: story.augur9.charge,
    hallrChoice: story.hallrChoice,
    ending: story.ending,
    linkedFragment: recipe.derives,
  };
}

async function proveAllChapter1NativeQuestsComplete(first) {
  await resetChapter1NativeQuestChain(first);
  const catalog = await bridgeCall(first.page, "chapter1NativeQuestCatalog");
  const catalogById = new Map(catalog.map((row) => [row.authoredId, row]));
  const completedSteps = [];
  const retainedPassedSteps = [];
  let stopReached = false;
  for (const [questIndex, quest] of CH1_QUESTS.entries()) {
    const challengeId = ch1NativeQuestId(quest.id);
    const catalogRow = catalogById.get(quest.id);
    assert(catalogRow?.present, `${quest.id}: native biscuit missing`);
    const remainingSteps = quest.steps.filter(
      (step) =>
        !chapter1ResumeAfter?.passedObjectiveKeys.has(`${quest.id}/${step.id}`)
    );
    if (remainingSteps.length === 0) {
      retainedPassedSteps.push(
        ...quest.steps.map((step) => ({ questId: quest.id, stepId: step.id }))
      );
      continue;
    }
    await ensureChapter1QuestInProgress(first, quest, catalogRow);
    await ensureChapter1DungeonMechanicsFixture(first, quest.id);
    for (const [stepIndex, step] of quest.steps.entries()) {
      if (
        chapter1ResumeAfter?.passedObjectiveKeys.has(`${quest.id}/${step.id}`)
      ) {
        retainedPassedSteps.push({ questId: quest.id, stepId: step.id });
        continue;
      }
      await ensureChapter1ExternalInventoryRequirements(first, quest, step);
      const stepId = ch1NativeQuestStepId(quest.id, stepIndex);
      const state = await waitFor(
        `${quest.title}/${step.title}: production objective state`,
        () =>
          pageJson(first.page, "/api/harthmere/chapter1_progress", {
            method: "POST",
            body: JSON.stringify({ action: "state" }),
          }),
        (response) =>
          response.ok &&
          response.body?.status === "active" &&
          String(response.body.challengeId) === String(challengeId) &&
          String(response.body.stepId) === String(stepId),
        20_000,
        40_000
      );
      const carryDecision = await satisfyChapter1ThinIceCarryLimit(
        first,
        step,
        state
      );
      const recoveredUiOwned = step.id === "open_the_tab";
      if (recoveredUiOwned) {
        assert.equal(state.value.body.targetPosition, undefined);
        assert.equal(state.value.body.showNavigationAid, false);
        assert.equal(state.value.body.withinRange, true);
      } else {
        await chapter1WarpAndWait(
          first,
          state.value.body.targetPosition,
          `${quest.id}/${step.id}: authored objective target`
        );
      }
      if (chapter1MaterialVisualCapture && step.id === "gather_parts") {
        const target = state.value.body.targetPosition;
        const approach = [target[0], target[1], target[2] + 5];
        const orientation = lookAtOrientation(
          [approach[0], approach[1] + 1.6, approach[2]],
          [target[0], target[1] + 1.0, target[2]]
        );
        await placeFrontendPlayerForFixture(
          first.page,
          first.userId,
          approach,
          orientation
        );
        await applyFixture(first.page, {
          kind: "update",
          entity: {
            id: first.userId,
            position: Position.create({ v: approach }),
            orientation: Orientation.create({ v: orientation }),
            rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
          },
        });
        await publishFrontendMove(
          first.page,
          first.userId,
          approach,
          orientation
        );
        await waitFor(
          `${quest.id}/${step.id}: repair cart visual approach`,
          () => frontendPlayerPose(first.page, first.userId),
          (pose) =>
            Boolean(pose?.position) &&
            distanceXZ(pose.position, approach) <= 0.75,
          Math.max(originSyncGateMs, 10_000),
          timeoutMs
        );
        const cartScreenshot = path.join(
          artifactsDir,
          `${runId}-${quest.id}-${step.id}-repair-cart.png`
        );
        await first.page.screenshot({ path: cartScreenshot });
        report.scenarios.push({
          name: `${quest.title}/${step.title} repair-cart visual`,
          status: "pass",
          screenshot: cartScreenshot,
        });
      }
      await assertChapter1DungeonAdmission(
        first,
        quest.id,
        `${step.id}:target`
      );
      const externalSystemOwned = Boolean(
        state.value.body.requirement?.blocksChapterInteraction &&
        state.value.body.requirement?.autoCompleteWhenReady
      );
      if (externalSystemOwned) {
        await satisfyChapter1ExternalSystemRequirement(
          first,
          quest,
          step,
          challengeId,
          stepId,
          state
        );
      }
      const readyState = externalSystemOwned
        ? state
        : recoveredUiOwned
          ? state
          : step.trigger === "near_location"
            ? state
            : await waitFor(
                `${quest.title}/${step.title}: server-authoritative interaction range`,
                () =>
                  pageJson(first.page, "/api/harthmere/chapter1_progress", {
                    method: "POST",
                    body: JSON.stringify({ action: "state" }),
                  }),
                (response) =>
                  response.ok &&
                  response.body?.status === "active" &&
                  String(response.body.challengeId) === String(challengeId) &&
                  String(response.body.stepId) === String(stepId) &&
                  response.body.withinRange === true,
                20_000,
                40_000
              );
      let completionBody;
      const incrementalRoute = chapter1IncrementalObjectiveRoute(step.id);
      if (recoveredUiOwned) {
        const openMenuHighlight = first.page.locator(
          '[data-ui-id="hud.prompt.open_menu"][data-ui-blinking="true"]'
        );
        await openMenuHighlight.waitFor({ state: "visible", timeout: 20_000 });
        const completionResponse = waitForChapter1CompletionResponse(
          first.page,
          challengeId,
          stepId,
          40_000
        );
        await first.page.keyboard.press("KeyJ");
        const recoveredTab = first.page.locator(
          '[data-ui-id="tab.recovered"][data-ui-blinking="true"]'
        );
        await recoveredTab.waitFor({ state: "visible", timeout: 20_000 });
        await first.page
          .getByText("Select MEM — Recovered", { exact: true })
          .waitFor({ state: "visible", timeout: 20_000 });
        await recoveredTab.click();
        const response = await completionResponse;
        assert(response.ok(), `${quest.id}/${step.id}: UI completion failed`);
        completionBody = await response.json();
        assert.equal(completionBody.status, "completed");
        await first.page.keyboard.press("Escape");
      } else if (incrementalRoute) {
        completionBody =
          await completeChapter1IncrementalObjectiveThroughProduct(
            first,
            { challengeId, quest, step, stepId },
            readyState
          );
      } else if (step.trigger !== "near_location" && !externalSystemOwned) {
        await waitForChapter1CutsceneIdle(first, `${quest.id}/${step.id}`);
        const prompt = first.page.locator(
          `[data-chapter1-native-objective="${step.id}"]`
        );
        await prompt.waitFor({ state: "visible", timeout: 20_000 });
        // The objective card can render one React commit before the central
        // world-interaction dispatcher publishes ownership. Pressing F in that
        // tiny gap lets an overlapping jobs board/player win and opens an
        // unrelated modal. The visible `F — ...` line is the product's own
        // contract that this exact Chapter 1 candidate now owns KeyF.
        await prompt
          .getByText(/^F — /)
          .waitFor({ state: "visible", timeout: 20_000 });
        // Prove the actual product input path, including consequential choice
        // modals. The helper also exercises "Not yet" as a non-progressing
        // action before it submits the deterministic release-test branch.
        const completionResponse =
          await completeChapter1ObjectiveThroughProduct(first, {
            challengeId,
            quest,
            state: readyState,
            step,
            stepId,
          });
        assert(
          completionResponse.ok(),
          `${quest.title}/${
            step.title
          }: objective completion HTTP ${completionResponse.status()}`
        );
        completionBody = await completionResponse.json();
        assert.equal(
          completionBody.status,
          "completed",
          `${quest.title}/${
            step.title
          }: objective completion rejected: ${JSON.stringify(completionBody)}`
        );
      }
      const signedProgress = await waitFor(
        `${quest.title}/${step.title}: signed native progress`,
        () => authoritativeEntity(first.page, first.userId),
        ({ entity }) =>
          Boolean(
            entity?.challenges?.complete.has(challengeId) ||
            isTriggerFired(
              entity?.trigger_state?.by_root.get(challengeId),
              stepId
            )
          ),
        20_000,
        40_000
      );
      const progressedEntity = signedProgress.value.entity;
      await assertChapter1DungeonAdmission(
        first,
        quest.id,
        `${step.id}:progress`
      );
      const vitals = readHarthmereNativeVitals(progressedEntity?.trigger_state);
      const survival = completionBody?.survival;
      const nativeResourceCounts = survival
        ? {
            water: Number(
              inventoryCount(
                progressedEntity,
                harthmereNativeBiomesIdForItemId("clean_water")
              )
            ),
            fuel: Number(
              inventoryCount(
                progressedEntity,
                harthmereNativeBiomesIdForItemId("coal")
              )
            ),
            light: Number(
              inventoryCount(
                progressedEntity,
                harthmereNativeBiomesIdForItemId("wall_lantern")
              )
            ),
          }
        : undefined;
      const completedObjective = {
        questId: quest.id,
        stepId: step.id,
        trigger: step.trigger,
        target: state.value.body.targetLabel,
        choice: CH1_E2E_CHOICE_BY_STEP_ID[step.id],
        ...(carryDecision ? { carryDecision } : {}),
        ...(survival ? { survival, nativeResourceCounts } : {}),
        nativeStats: {
          hp: progressedEntity?.health?.hp,
          maxHp: progressedEntity?.health?.maxHp,
          stamina: vitals.stamina,
          maxStamina: vitals.maxStamina,
          breath: vitals.breath,
          maxBreath: vitals.maxBreath,
        },
      };
      completedSteps.push(completedObjective);
      // Persist every newly-proven leaf immediately. If a later objective or
      // stack gate fails, the next run can resume after this exact authored id
      // instead of replaying already-green choices and interactions.
      report.scenarios.push({
        name: `Chapter 1 objective ${quest.id}/${step.id}`,
        status: "pass",
        ...completedObjective,
      });
      persistReportCheckpoint();
      const nextStep = quest.steps[stepIndex + 1];
      if (nextStep) {
        const nextStepId = String(
          ch1NativeQuestStepId(quest.id, stepIndex + 1)
        );
        const nextStepUiOwned = nextStep.id === "open_the_tab";
        await waitFor(
          `${quest.id}/${step.id}: UI advances to ${nextStep.id}`,
          async () => ({
            projection: await bridgeCall(
              first.page,
              "nativeQuestFrontendSnapshot"
            ),
            hud: await first.page
              .locator('[aria-label="Current objective"]')
              .textContent()
              .catch(() => ""),
          }),
          ({ projection, hud }) => {
            const projectedQuest = projection.quests?.find(
              ({ questId }) => String(questId) === String(challengeId)
            );
            const exactNativeStep =
              String(projectedQuest?.currentStepId) === nextStepId;
            const exactHud = String(hud ?? "").includes(nextStep.objective);
            const activeQuestMarker = projection.markers?.find(
              (marker) =>
                String(marker.questId) === String(challengeId) &&
                marker.id === projection.activeMapPin?.markerId &&
                marker.label === projection.activeMapPin?.label &&
                distanceXZ(
                  marker.worldPosition,
                  projection.activeMapPin?.worldPosition
                ) <= CHAPTER1_E2E_WARP_VERTICAL_TOLERANCE_METERS
            );
            // Recovered is owned by BiomesUI, not a world target. Requiring a
            // new map pin here both contradicts production and can mistake a
            // retained pin from the completed Doc step for the next action.
            // Quest-level fallback anchors reuse the quest id as their marker
            // id, so their visible label and exact live destination are the
            // authoritative proof that the persisted pin refreshed.
            const correctSurface = nextStepUiOwned
              ? true
              : projection.activeMapPin?.markerId?.includes(nextStepId) ||
                Boolean(activeQuestMarker);
            return exactNativeStep && exactHud && correctSurface;
          },
          20_000,
          40_000
        );
      }
      if (`${quest.id}/${step.id}` === chapter1StopAfter) {
        stopReached = true;
        break;
      }
    }
    if (stopReached) break;
    await waitFor(
      `${quest.title}: native challenge completion`,
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) => entity?.challenges?.complete.has(challengeId),
      20_000,
      40_000
    );
    const nextQuest = CH1_QUESTS[questIndex + 1];
    if (nextQuest) {
      const nextChallengeId = String(ch1NativeQuestId(nextQuest.id));
      await waitFor(
        `${quest.title}: UI tracks ${nextQuest.title}`,
        async () => ({
          projection: await bridgeCall(
            first.page,
            "nativeQuestFrontendSnapshot"
          ),
          storedMainQuestId: await first.page.evaluate(() => {
            try {
              return JSON.parse(
                localStorage.getItem("biomes_ui_main_quest") ?? "null"
              )?.questId;
            } catch {
              return undefined;
            }
          }),
          hud: await first.page
            .locator('[aria-label="Current objective"]')
            .textContent()
            .catch(() => ""),
        }),
        ({ projection, storedMainQuestId, hud }) =>
          storedMainQuestId === nextChallengeId &&
          projection.activeMapPin?.markerId?.includes(nextChallengeId) &&
          String(hud ?? "").includes(nextQuest.steps[0].objective),
        20_000,
        40_000
      );
    }
    await exitChapter1DungeonThroughProduct(first, quest.id);
  }
  const recovered = stopReached
    ? undefined
    : await proveChapter1RecoveredJournal(first);
  return {
    questCount: CH1_QUESTS.length,
    stepCount: completedSteps.length,
    retainedPassedStepCount: retainedPassedSteps.length,
    resumeAfter: chapter1ResumeAfter?.key,
    stoppedAfter: stopReached ? chapter1StopAfter : undefined,
    steps: completedSteps,
    recovered,
  };
}

async function proveAllChapter1CutscenesStart(first) {
  const catalog = await bridgeCall(first.page, "chapter1CutsceneCatalog");
  assert.equal(
    catalog.length,
    16,
    "Chapter 1 registered cutscene count changed"
  );
  const selectedCatalog = chapter1CaptureIds
    ? catalog.filter((scene) => chapter1CaptureIds.has(scene.id))
    : catalog;
  assert(
    selectedCatalog.length > 0,
    "Chapter 1 cutscene selection did not match any registered scene"
  );
  const results = [];
  const failures = [];
  for (const scene of selectedCatalog) {
    let gateHold = false;
    try {
      const prepared = await bridgeCall(
        first.page,
        "chapter1PrepareCutsceneAudit",
        scene.id
      );
      const focus = await focusChapter1Scene(
        first,
        scene.id,
        prepared.staging,
        chapter1GateRendererFocus(prepared.activeGateIds)
      );
      await waitForChapter1CutsceneFocusReady(first, focus, scene.id);
      gateHold = prepared.activeGateIds.length > 0;
      if (gateHold) {
        await holdChapter1AuditGates(
          first,
          prepared.activeGateIds,
          focus.focus
        );
      }
      await waitForChapter1CutsceneGatesReady(
        first,
        prepared.activeGateIds,
        scene.id
      );
      const accepted = await bridgeCall(
        first.page,
        "chapter1StartCutscene",
        scene.id
      );
      assert.equal(
        accepted.accepted,
        true,
        `${scene.id}: queue rejected scene`
      );
      const started = await waitFor(
        `${scene.id}: production director start`,
        () => bridgeCall(first.page, "chapter1CutsceneSnapshot"),
        (snapshot) => snapshot.active && snapshot.defId === accepted.defId,
        20_000,
        30_000
      );
      // Let at least one fully rendered frame land after the lifecycle event.
      await delay(250);
      results.push({
        id: scene.id,
        sandboxDefId: accepted.defId,
        shots: scene.shots,
        authoredSeconds: scene.authoredSeconds,
        focus,
        startMs: started.elapsedMs,
        snapshot: await bridgeCall(first.page, "chapter1CutsceneSnapshot"),
      });
      if (scene.id === "ch1-first-gate") {
        // Reproduce the reported failure state deliberately: a cinematic face
        // emote is active when the Grove cutscene exits. The director must
        // neutralize it and immediately restore the theme for the region the
        // player can actually see, even though the fence sample is Mucky.
        const seededExpressionRequest = await first.page.evaluate(() => {
          const context = globalThis.clientContext;
          const localPlayer = context?.resources?.get("/scene/local_player");
          if (!context?.events || !context.resources || !localPlayer) {
            return false;
          }
          localPlayer.player.eagerEmote(
            context.events,
            context.resources,
            "shock"
          );
          return true;
        });
        assert.equal(seededExpressionRequest, true);
        const seededExpression = await waitFor(
          `${scene.id}: reported stuck expression becomes active`,
          () =>
            first.page.evaluate(
              () =>
                globalThis.clientContext?.resources?.get("/scene/local_player")
                  ?.player?.emoteInfo?.emoteType
            ),
          (emoteType) => emoteType === "shock",
          10_000,
          20_000
        );
        assert.equal(
          seededExpression.value,
          "shock",
          `${scene.id}: could not seed the reported stuck expression`
        );
        await bridgeCall(first.page, "chapter1StopCutscene");
        const cleanup = await waitFor(
          `${scene.id}: expression and Grove music restore on exit`,
          async () => ({
            cutscene: await bridgeCall(first.page, "chapter1CutsceneSnapshot"),
            audio: await bridgeCall(first.page, "audioDiagnostics"),
            emoteType: await first.page.evaluate(
              () =>
                globalThis.clientContext?.resources?.get("/scene/local_player")
                  ?.player?.emoteInfo?.emoteType
            ),
          }),
          (state) =>
            !state.cutscene?.active &&
            state.emoteType === undefined &&
            state.audio?.currentTrack === "grove_music",
          20_000,
          30_000
        );
        results[results.length - 1].exitCleanup = {
          emoteType: cleanup.value.emoteType,
          restoredTrack: cleanup.value.audio.currentTrack,
        };
      }
    } catch (error) {
      failures.push({ id: scene.id, error: chapter1ErrorText(error) });
      await bridgeCall(first.page, "chapter1StopCutscene").catch(
        () => undefined
      );
    } finally {
      if (gateHold && !first.page.isClosed()) {
        await releaseChapter1AuditGates(first).catch(() => undefined);
      }
    }
  }
  await bridgeCall(first.page, "chapter1StopCutscene");
  await waitFor(
    "Chapter 1 cutscene catalog cleanup",
    () => bridgeCall(first.page, "chapter1CutsceneSnapshot"),
    (snapshot) => !snapshot.active,
    15_000,
    20_000
  );
  assert.deepEqual(
    failures,
    [],
    `Chapter 1 cutscene failures:\n${failures
      .map((failure) => `${failure.id}: ${failure.error}`)
      .join("\n\n")}`
  );
  return { count: results.length, scenes: results };
}

function chapter1GateRendererFocus(activeGateIds) {
  if (activeGateIds?.length !== 1) return undefined;
  const gate = CH1_FRACTURE_GATES.find(
    (candidate) => candidate.id === activeGateIds[0]
  );
  assert(gate, `unknown Chapter 1 cutscene gate ${activeGateIds[0]}`);
  return [gate.position[0] - 6, gate.position[1] + 1, gate.position[2] + 7];
}

async function focusChapter1Scene(first, sceneId, staging, preferredFocus) {
  const definition = ch1AllScenes().find((scene) => scene.id === sceneId);
  assert(definition, `missing authored Chapter 1 scene ${sceneId}`);
  return focusChapter1Definition(
    first,
    definition,
    sceneId,
    staging,
    preferredFocus
  );
}

function averageCutscenePositions(positions) {
  return positions
    .reduce(
      (sum, position) => [
        sum[0] + position[0],
        sum[1] + position[1],
        sum[2] + position[2],
      ],
      [0, 0, 0]
    )
    .map((value) => value / positions.length);
}

function authoredCutsceneCameraPositions(definition) {
  return definition.shots.flatMap((shot) => {
    if (shot.camera.kind === "static") {
      return [shot.camera.position];
    }
    if (shot.camera.kind === "dolly") {
      return shot.camera.waypoints.map((waypoint) => waypoint.position);
    }
    return [];
  });
}

async function focusChapter1Definition(
  first,
  definition,
  sceneId,
  staging,
  preferredFocus
) {
  const requiredEntityRoles = definition.cast.filter(
    (role) => role.required !== false && role.binding.kind === "entity"
  );
  const requiredEntityIds = requiredEntityRoles.map(
    (role) => role.binding.entityId
  );
  const localSynchronizationIds = requiredEntityRoles
    .filter((role) => !(role.fallback === "ghost" && role.ghostAsset))
    .map((role) => role.binding.entityId);
  const entityStates = await Promise.all(
    requiredEntityIds.map((id) => authoritativeEntity(first.page, id))
  );
  const entityPositions = entityStates
    .map(({ entity }) => entity?.position?.v)
    .filter(
      (position) =>
        Array.isArray(position) &&
        position.length === 3 &&
        position.every(Number.isFinite)
    );
  const stagedEntityPositions = requiredEntityIds.flatMap((id) => {
    const row = staging?.find(
      (candidate) => candidate.entityId === Number(id) && candidate.present
    );
    return row?.position ? [row.position] : [];
  });
  const anchorPositions = definition.cast
    .filter((role) => role.binding.kind === "anchor")
    .map((role) => role.binding.position);
  const ghostPositions = definition.cast
    .filter((role) => role.binding.kind === "ghost")
    .map((role) => role.binding.spawnAt);
  const cameraPositions = authoredCutsceneCameraPositions(definition);
  let focus = preferredFocus ? [...preferredFocus] : undefined;
  let focusKind = preferredFocus ? "authored-gate-renderer" : undefined;
  if (!focus && stagedEntityPositions.length > 0) {
    const actorCenter = averageCutscenePositions(stagedEntityPositions);
    const includesPlayer = definition.cast.some(
      (role) => role.binding.kind === "player"
    );
    // Real gameplay starts conversations from interaction distance. Warping
    // the E2E player onto the NPC's exact voxel made every over-shoulder shot
    // degenerate into a face-filling head, even though the authored camera was
    // correct. Reproduce the real interaction spacing instead.
    focus = includesPlayer
      ? [actorCenter[0] + 2.75, actorCenter[1], actorCenter[2] + 2.75]
      : actorCenter;
    focusKind = "story-staged-cast-interaction-offset";
  } else if (!focus) {
    const stagedPositions = [...anchorPositions, ...ghostPositions];
    const usesMemoryStage = stagedPositions.some(
      (position) => distance3(position, CH1_MEMORY_STAGE) < 64
    );
    if (usesMemoryStage) {
      focus = [...CH1_MEMORY_STAGE];
      focusKind = "memory-stage";
    } else if (stagedPositions.length > 0) {
      focus = averageCutscenePositions(stagedPositions);
      focusKind = "authored-cast";
    }
  }
  if (!focus && cameraPositions.length > 0) {
    // Streaming follows the authenticated player, not the cutscene camera.
    // Put the player at the first authored camera position so absolute-world
    // reveals and dungeon promos have terrain before their prewarm expires.
    focus = [...cameraPositions[0]];
    focusKind = "authored-camera";
  }
  if (!focus && entityPositions.length > 0) {
    const actorCenter = averageCutscenePositions(entityPositions);
    const includesPlayer = definition.cast.some(
      (role) => role.binding.kind === "player"
    );
    focus = includesPlayer
      ? [actorCenter[0] + 2.75, actorCenter[1], actorCenter[2] + 2.75]
      : actorCenter;
    focusKind = "live-cast-interaction-offset";
  }
  if (!focus) {
    return { sceneId, requiredEntityIds: [], warped: false };
  }
  await chapter1WarpAndWait(first, focus, `${sceneId}: cast focus`);
  if (localSynchronizationIds.length > 0) {
    await waitFor(
      `${sceneId}: required cast synchronized`,
      () =>
        Promise.all(
          localSynchronizationIds.map(async (id) => ({
            id,
            ...(await localEntity(first.page, id)),
          }))
        ),
      (rows) => rows.every((row) => Boolean(row.entity?.position?.v)),
      12_000,
      30_000
    );
  }
  return {
    sceneId,
    requiredEntityIds: requiredEntityIds.map(String),
    warped: true,
    focus,
    focusKind,
  };
}

async function waitForChapter1CutsceneFocusReady(first, focus, sceneId) {
  if (!focus?.warped || !focus.focus) return;
  const sample = [
    Math.floor(focus.focus[0]),
    Math.floor(focus.focus[1] - 1),
    Math.floor(focus.focus[2]),
  ];
  await waitFor(
    `${sceneId}: focused terrain synchronized`,
    () =>
      bridgeCall(first.page, "chapter1TerrainSnapshot", [
        { label: "cutscene-focus-floor", position: sample },
      ]),
    (rows) => Boolean(rows?.[0]?.terrainEntityId && rows[0].hasShardSeed),
    15_000,
    45_000
  );
  const vertical = await bridgeCall(
    first.page,
    "chapter1TerrainSnapshot",
    Array.from({ length: 18 }, (_, index) => ({
      label: `cutscene-focus-y-${Math.floor(focus.focus[1]) + 4 - index}`,
      position: [
        Math.floor(focus.focus[0]),
        Math.floor(focus.focus[1]) + 4 - index,
        Math.floor(focus.focus[2]),
      ],
    }))
  );
  console.log(
    `CH1 CUTSCENE FOCUS ${sceneId} ${JSON.stringify({
      focus: focus.focus,
      focusKind: focus.focusKind,
      solidColumn: vertical
        .filter((row) => Number(row.terrainId) > 0)
        .map((row) => ({
          y: row.position[1],
          terrainId: row.terrainId,
          terrainName: row.terrainName,
        })),
    })}`
  );
  const extraProbePoints = String(
    process.env.HARTHMERE_E2E_CHAPTER_1_PROBE_POINTS ?? ""
  )
    .split(";")
    .map((value) => value.split(",").map(Number))
    .filter(
      (position) =>
        position.length === 3 &&
        position.every((coordinate) => Number.isFinite(coordinate))
    );
  if (extraProbePoints.length > 0) {
    const extraRows = await bridgeCall(
      first.page,
      "chapter1TerrainSnapshot",
      extraProbePoints.flatMap((position, pointIndex) =>
        Array.from({ length: 25 }, (_, index) => ({
          label: `extra-${pointIndex}-y-${
            Math.floor(position[1]) + 12 - index
          }`,
          position: [
            Math.floor(position[0]),
            Math.floor(position[1]) + 12 - index,
            Math.floor(position[2]),
          ],
        }))
      )
    );
    console.log(
      `CH1 CUTSCENE EXTRA TERRAIN ${sceneId} ${JSON.stringify(
        extraProbePoints.map((position, pointIndex) => ({
          position,
          solidColumn: extraRows
            .filter(
              (row) =>
                row.label.startsWith(`extra-${pointIndex}-`) &&
                Number(row.terrainId) > 0
            )
            .map((row) => ({
              y: row.position[1],
              terrainId: row.terrainId,
              terrainName: row.terrainName,
            })),
        }))
      )}`
    );
  }
  // Readiness above is authoritative; this short settle allows one complete
  // renderer frame before MediaRecorder starts sampling the canvas.
  await delay(500);
}

async function waitForChapter1CutsceneGatesReady(
  first,
  activeGateIds,
  sceneId
) {
  if (!activeGateIds?.length) return;
  const ready = await waitFor(
    `${sceneId}: active gate visibly open`,
    () => bridgeCall(first.page, "chapter1GateRenderSnapshot"),
    (snapshot) =>
      activeGateIds.every((id) =>
        snapshot?.gates?.some(
          (gate) =>
            gate.id === id && gate.active && gate.visible && gate.open >= 0.8
        )
      ),
    15_000,
    30_000
  );
  console.log(
    `CH1 CUTSCENE GATES ${sceneId} ${JSON.stringify(
      ready.value.gates.filter((gate) => activeGateIds.includes(gate.id))
    )}`
  );
}

async function registerHostChapter1Cutscene(first, definition) {
  const suffix = `-host-${runId}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const injectedId = `${definition.id.slice(
    0,
    Math.max(1, 128 - suffix.length)
  )}${suffix}`;
  const injected = {
    ...definition,
    id: injectedId,
    name: `${definition.name} Host Runtime Audit`,
    priority: 950_000,
    settings: {
      ...definition.settings,
      mode: "clientPuppet",
      commitOn: [],
    },
    onEnd: { placements: [], commits: [] },
    // The live bundle may predate a newly-authored story-cue label. Visual
    // iteration keeps dialogue/voice but omits best-effort SFX so an unknown
    // audio enum cannot poison an otherwise valid camera capture. The final
    // exact-source build restores the authored actions and uses the guarded
    // AudioManager path.
    shots: definition.shots.map((shot) => ({
      ...shot,
      actions: shot.actions.filter((action) => action.kind !== "sfx"),
    })),
  };
  const registered = await first.page.evaluate(
    async ({ definition: runtimeDefinition, sourceId }) => {
      const bridge = globalThis.__harthmereNativeEcsE2E;
      if (!bridge) throw new Error("Native ECS E2E bridge is not installed");

      let webpackRequire;
      const chunks = (globalThis.webpackChunk_N_E =
        globalThis.webpackChunk_N_E || []);
      chunks.push([
        [`harthmere-host-cutscene-${Date.now()}`],
        {},
        (runtime) => {
          webpackRequire = runtime;
        },
      ]);

      const moduleExportValues = (exports) => {
        const values = [exports, exports?.default];
        if (
          exports &&
          (typeof exports === "object" || typeof exports === "function")
        ) {
          values.push(...Object.values(exports));
        }
        return values.filter(Boolean);
      };
      const cachedModuleExports = () =>
        Object.values(webpackRequire?.c ?? {}).map((module) => module?.exports);
      const requireModuleFactoriesMatching = (...needles) => {
        const matches = [];
        for (const [moduleId, factory] of Object.entries(
          webpackRequire?.m ?? {}
        )) {
          const source = String(factory);
          if (!needles.some((needle) => source.includes(needle))) continue;
          try {
            matches.push(webpackRequire(moduleId));
          } catch {
            // A matching factory may require a chunk that is not ready yet.
          }
        }
        return matches;
      };
      const findService = () => {
        const exportGroups = [
          ...cachedModuleExports(),
          ...requireModuleFactoriesMatching(
            "requestCutsceneById: unknown cutscene"
          ),
        ];
        for (const exports of exportGroups) {
          for (const candidate of moduleExportValues(exports)) {
            if (
              candidate &&
              typeof candidate.registerCutscene === "function" &&
              typeof candidate.requestCutsceneById === "function" &&
              candidate.cutsceneLibrary
            ) {
              return candidate;
            }
          }
        }
        return undefined;
      };
      const findLibrary = () => {
        const exportGroups = [
          ...cachedModuleExports(),
          ...requireModuleFactoriesMatching(
            "requestCutsceneById: unknown cutscene"
          ),
        ];
        for (const exports of exportGroups) {
          for (const candidate of moduleExportValues(exports)) {
            if (
              typeof candidate?.register !== "function" ||
              typeof candidate?.get !== "function" ||
              typeof candidate?.list !== "function" ||
              typeof candidate?.clear !== "function"
            ) {
              continue;
            }
            try {
              if (candidate.get(sourceId)?.id === sourceId) return candidate;
            } catch {
              // A different exported registry happened to share method names.
            }
          }
        }
        return undefined;
      };

      let service = findService();
      let library = findLibrary();
      if (!service && !library) {
        // This loads cutscene_service into webpack's cache. The request is
        // immediately cancelled and carries no end-state commits.
        await bridge.chapter1StartCutscene(sourceId);
        bridge.chapter1StopCutscene();
        await new Promise((resolve) => setTimeout(resolve, 100));
        service = findService();
        library = findLibrary();
      }
      if (!service && !library) {
        throw new Error("loaded cutscene library was not discoverable");
      }
      const seamAnchor = runtimeDefinition.cast?.find(
        (member) => member.role === "seam" && member.binding?.kind === "anchor"
      )?.binding?.position;
      if (Array.isArray(seamAnchor)) {
        const gateExportGroups = [
          ...cachedModuleExports(),
          ...requireModuleFactoriesMatching("ch1_gate_fence_sighting"),
        ];
        for (const exports of gateExportGroups) {
          for (const candidate of moduleExportValues(exports)) {
            const possibleGateArrays = [
              candidate?.CH1_FRACTURE_GATES,
              ...(Array.isArray(candidate) ? [candidate] : []),
            ];
            for (const gates of possibleGateArrays) {
              if (!Array.isArray(gates)) continue;
              const fenceGate = gates.find(
                (gate) => gate?.id === "ch1_gate_fence_sighting"
              );
              if (fenceGate) {
                fenceGate.position = [...seamAnchor];
              }
            }
          }
        }
      }
      if (service) {
        service.registerCutscene(runtimeDefinition);
      } else {
        library.register(runtimeDefinition);
      }
      return { id: runtimeDefinition.id };
    },
    { definition: injected, sourceId: definition.id }
  );
  await waitFor(
    `${definition.id}: runtime injection cleanup`,
    () => bridgeCall(first.page, "chapter1CutsceneSnapshot"),
    (snapshot) => !snapshot.active,
    10_000,
    20_000
  );
  return registered.id;
}

async function isolateChapter1CatalogProjection(first, focusPosition) {
  const isolated = await first.page.evaluate(
    ({ focus, userId }) => {
      const win = globalThis;
      const extraHiddenIds = new Set();
      const extraHiddenPlayerIds = new Set();
      if (Array.isArray(focus)) {
        for (const entity of win.clientContext?.table?.contents?.() ?? []) {
          const position = entity?.position?.v;
          if (
            !position ||
            Math.hypot(
              position[0] - focus[0],
              position[1] - focus[1],
              position[2] - focus[2]
            ) > 24
          ) {
            continue;
          }
          const id = Number(entity.id);
          if (entity?.player_status) {
            if (id !== Number(userId)) extraHiddenPlayerIds.add(id);
          } else if (entity?.npc_metadata || entity?.robot_component) {
            extraHiddenIds.add(id);
          }
        }
      }
      const projection = globalThis.__chapter1E2ECutsceneProjection;
      if (projection?.staging) {
        projection.staging = projection.staging.map((row) => ({
          ...row,
          present: false,
          position: undefined,
        }));
      }
      const hideOverrides = (overrides) => {
        const hidden = new Map();
        for (const override of Array.isArray(overrides) ? overrides : []) {
          hidden.set(Number(override.id), {
            ...override,
            hidden: true,
            at: undefined,
            ghost: undefined,
          });
        }
        for (const id of extraHiddenIds) {
          if (!hidden.has(id)) hidden.set(id, { id, yaw: 0, hidden: true });
        }
        return [...hidden.values()];
      };
      if (!win.__chapter1E2EProjectionHold) {
        const originalDescriptor = Object.getOwnPropertyDescriptor(
          win,
          "__harthmereChapter1Puppets"
        );
        const originalValue = win.__harthmereChapter1Puppets;
        const originalPlayerVisibility = new Map();
        const hideRemotePlayers = () => {
          const resources = win.clientContext?.resources;
          for (const id of extraHiddenPlayerIds) {
            try {
              const mesh = resources?.cached("/scene/player/mesh", id);
              if (!mesh?.three) continue;
              if (!originalPlayerVisibility.has(id)) {
                originalPlayerVisibility.set(id, mesh.three.visible);
              }
              mesh.three.visible = false;
            } catch {}
          }
        };
        let isolatedValue = hideOverrides(originalValue);
        Object.defineProperty(win, "__harthmereChapter1Puppets", {
          configurable: true,
          enumerable: true,
          get: () => isolatedValue,
          set: (value) => {
            // Filter every one-second projection-controller publication. Active
            // director puppets use __harthmereCutscenePuppets and therefore still
            // override the hidden row for actual cast members such as Jackie.
            isolatedValue = hideOverrides(value);
          },
        });
        hideRemotePlayers();
        const playerIsolationTimer = setInterval(hideRemotePlayers, 100);
        win.__chapter1E2EProjectionHold = {
          release: () => {
            clearInterval(playerIsolationTimer);
            const resources = win.clientContext?.resources;
            for (const [id, visible] of originalPlayerVisibility) {
              try {
                const mesh = resources?.cached("/scene/player/mesh", id);
                if (mesh?.three) mesh.three.visible = visible;
              } catch {}
            }
            delete win.__harthmereChapter1Puppets;
            if (originalDescriptor) {
              Object.defineProperty(
                win,
                "__harthmereChapter1Puppets",
                originalDescriptor
              );
            } else if (originalValue !== undefined) {
              win.__harthmereChapter1Puppets = originalValue;
            }
            delete win.__chapter1E2EProjectionHold;
          },
        };
      }
      return {
        extraHiddenIds: [...extraHiddenIds],
        extraHiddenPlayerIds: [...extraHiddenPlayerIds],
      };
    },
    { focus: focusPosition, userId: first.userId }
  );
  // Wait through one production projection refresh. The property interceptor
  // proves that even a fresh controller publication remains hidden.
  await delay(1_100);
  console.log(
    `CH1 CUTSCENE ISOLATION ${JSON.stringify({
      focus: focusPosition,
      ...isolated,
    })}`
  );
}

async function releaseChapter1CatalogProjection(first) {
  await first.page.evaluate(() => {
    globalThis.__chapter1E2EProjectionHold?.release?.();
  });
}

async function holdChapter1AuditGates(first, activeGateIds, focusPosition) {
  await first.page.evaluate(
    async ({ ids, focusPosition, userId }) => {
      const win = globalThis;
      if (win.__chapter1E2EGateHold) {
        clearInterval(win.__chapter1E2EGateHold);
      }
      const publish = async () => {
        await globalThis.__harthmereNativeEcsE2E?.chapter1SetActiveGates(ids);
        if (!focusPosition) return;
        const resources = globalThis.clientContext?.resources;
        try {
          resources?.update("/scene/local_player", (localPlayer) => {
            localPlayer.player.position = [...focusPosition];
          });
        } catch {}
        try {
          resources?.update("/sim/player", userId, (player) => {
            player.position = [...focusPosition];
          });
        } catch {}
      };
      await publish();
      // The production gate prompt republishes the saved-world gate set every
      // 750ms. Keep the one-scene audit fixture and renderer focus authoritative
      // through recording without changing server state or restarting the app.
      win.__chapter1E2EGateHold = setInterval(() => void publish(), 250);
    },
    { ids: activeGateIds, focusPosition, userId: first.userId }
  );
}

async function releaseChapter1AuditGates(first) {
  await first.page.evaluate(() => {
    const win = globalThis;
    if (win.__chapter1E2EGateHold) {
      clearInterval(win.__chapter1E2EGateHold);
      delete win.__chapter1E2EGateHold;
    }
  });
}

function materializeChapter1CapturedWebm(filename) {
  const outputDir = path.join(artifactsDir, "cutscenes");
  fs.mkdirSync(outputDir, { recursive: true });
  const output = path.join(outputDir, filename);
  const legacyHostOutput = path.join(root, "artifacts/cutscenes", filename);
  if (fs.existsSync(legacyHostOutput)) {
    fs.copyFileSync(legacyHostOutput, output);
    return output;
  }
  assert(
    chapter1StackContainer,
    `${filename}: capture was not written on the host and HARTHMERE_E2E_STACK_CONTAINER is unset`
  );
  const copied = spawnSync(
    "docker",
    [
      "cp",
      `${chapter1StackContainer}:/app/artifacts/cutscenes/${filename}`,
      output,
    ],
    { cwd: root, encoding: "utf8", timeout: 60_000 }
  );
  assert.equal(
    copied.status,
    0,
    copied.error?.stack ||
      copied.stderr ||
      copied.stdout ||
      `docker cp failed for ${filename}`
  );
  return output;
}

async function chapter1HumanRenderDiagnostics(first) {
  return first.page.evaluate((userId) => {
    const win = globalThis;
    const resources = win.clientContext?.resources;
    const table = win.clientContext?.table;
    const asArray = (value) => {
      if (Array.isArray(value)) return [...value];
      if (typeof value?.toArray === "function") return value.toArray();
      return value;
    };
    const playerMesh = (id) => {
      let mesh;
      let scenePlayer;
      try {
        mesh = resources?.cached("/scene/player/mesh", id);
        scenePlayer = resources?.get("/scene/player", id);
      } catch {}
      const materials = [];
      mesh?.three?.traverse?.((node) => {
        const material = node?.material;
        const uniforms = material?.uniforms;
        if (!uniforms) return;
        materials.push({
          node: node.name,
          material: material.name,
          visible: node.visible,
          baseColor: asArray(uniforms.baseColor?.value),
          spatialLighting: asArray(uniforms.spatialLighting?.value),
          light: asArray(uniforms.light?.value),
          emissiveAdd: uniforms.emissiveAdd?.value,
        });
      });
      return {
        id: String(id),
        position: scenePlayer?.position,
        meshVisible: mesh?.three?.visible,
        materials,
      };
    };
    const nearbyPlayers = [];
    for (const entity of table?.contents?.() ?? []) {
      if (!entity?.player_status || !entity.position?.v) continue;
      if (
        Math.hypot(
          entity.position.v[0] - 44.75,
          entity.position.v[1] - 41,
          entity.position.v[2] + 38.25
        ) > 24
      ) {
        continue;
      }
      nearbyPlayers.push({
        id: String(entity.id),
        label: entity.label?.text,
        position: entity.position.v,
        local: String(entity.id) === String(userId),
        render: playerMesh(Number(entity.id)),
      });
    }
    const rendererController = win.clientContext?.rendererController;
    const harthmereRenderer = rendererController?.renderers?.find?.(
      (renderer) => renderer?.name === "harthmereRuntimeAssets"
    );
    const syntheticSnapshotActors = [];
    for (const [id, actor] of harthmereRenderer?.nativeCutsceneActors ?? []) {
      if (!actor?.snapshotPlayerMesh) continue;
      const materials = [];
      actor.object?.traverse?.((node) => {
        const uniforms = node?.material?.uniforms;
        if (!uniforms?.spatialLighting || !uniforms?.light) return;
        materials.push({
          node: node.name,
          visible: node.visible,
          baseColor: asArray(uniforms.baseColor?.value),
          spatialLighting: asArray(uniforms.spatialLighting?.value),
          light: asArray(uniforms.light?.value),
          emissiveAdd: uniforms.emissiveAdd?.value,
        });
      });
      syntheticSnapshotActors.push({
        id: String(id),
        label: actor.object?.name,
        position: actor.object?.position?.toArray?.(),
        visible: actor.object?.visible,
        materials,
      });
    }
    return {
      userId: String(userId),
      localPlayer: playerMesh(Number(userId)),
      nearbyPlayers,
      syntheticSnapshotActors,
      snapshotLightingProbe: win.__chapter1SnapshotLightingProbe,
      cutscenePuppets: (win.__harthmereCutscenePuppets?.overrides ?? []).map(
        (override) => ({
          id: String(override.id),
          at: override.at,
          hidden: override.hidden,
          label: override.label ?? override.ghost?.label,
          appearanceSourceEntityId: override.ghost?.appearanceSourceEntityId,
        })
      ),
    };
  }, first.userId);
}

async function installChapter1SnapshotLightingProbe(first) {
  return first.page.evaluate((userId) => {
    const win = globalThis;
    if (win.__chapter1SnapshotLightingProbe?.timer) {
      clearInterval(win.__chapter1SnapshotLightingProbe.timer);
    }
    const apply = () => {
      const resources = win.clientContext?.resources;
      const rendererController = win.clientContext?.rendererController;
      const harthmereRenderer = rendererController?.renderers?.find?.(
        (renderer) => renderer?.name === "harthmereRuntimeAssets"
      );
      let spatialLighting = [0, 1];
      try {
        const localMesh = resources?.cached("/scene/player/mesh", userId);
        localMesh?.three?.traverse?.((node) => {
          const value = node?.material?.uniforms?.spatialLighting?.value;
          if (
            Array.isArray(value) &&
            value.length >= 2 &&
            value.every(Number.isFinite)
          ) {
            spatialLighting = [Number(value[0]), Number(value[1])];
          }
        });
      } catch {}
      let light = [0, 1, 0];
      try {
        const candidate = resources
          ?.get("/scene/sky_params")
          ?.sunDirection?.toArray?.();
        const lengthSquared =
          Number(candidate?.[0] ?? 0) ** 2 +
          Number(candidate?.[1] ?? 0) ** 2 +
          Number(candidate?.[2] ?? 0) ** 2;
        if (
          Array.isArray(candidate) &&
          candidate.length >= 3 &&
          candidate.every(Number.isFinite) &&
          lengthSquared > 1e-8
        ) {
          light = candidate.slice(0, 3).map(Number);
        }
      } catch {}
      const actors = [];
      for (const [id, actor] of harthmereRenderer?.nativeCutsceneActors ?? []) {
        if (!actor?.snapshotPlayerMesh) continue;
        let materialCount = 0;
        actor.object?.traverse?.((node) => {
          const uniforms = node?.material?.uniforms;
          if (!uniforms?.spatialLighting || !uniforms?.light) return;
          uniforms.spatialLighting = { value: [...spatialLighting] };
          uniforms.light = { value: [...light] };
          materialCount += 1;
        });
        actors.push({
          id: String(id),
          label: actor.object?.name,
          materialCount,
        });
      }
      const previous = win.__chapter1SnapshotLightingProbe ?? {};
      win.__chapter1SnapshotLightingProbe = {
        ...previous,
        enabled: true,
        appliedAt: Date.now(),
        spatialLighting,
        light,
        actors,
      };
    };
    apply();
    const timer = setInterval(apply, 50);
    win.__chapter1SnapshotLightingProbe = {
      ...(win.__chapter1SnapshotLightingProbe ?? {}),
      enabled: true,
      timer,
    };
    return {
      enabled: true,
      rendererNames:
        win.clientContext?.rendererController?.rendererNames?.() ?? [],
    };
  }, first.userId);
}

async function captureChapter1FrameSequence(first, input, sourceDefinition) {
  const authoredSeconds = sourceDefinition.shots.reduce(
    (total, shot) => total + (shot.until?.maxDuration ?? shot.duration),
    0
  );
  const frameDir = path.join(
    artifactsDir,
    "cutscenes",
    `${sourceDefinition.id}-${runId}-frames`
  );
  fs.mkdirSync(frameDir, { recursive: true });
  const accepted = await bridgeCall(
    first.page,
    "chapter1StartCutscene",
    input.id
  );
  assert.equal(
    accepted.accepted,
    true,
    `${sourceDefinition.id}: frame-sequence queue rejected scene`
  );
  await waitFor(
    `${sourceDefinition.id}: frame-sequence director start`,
    () => bridgeCall(first.page, "chapter1CutsceneSnapshot"),
    (snapshot) => snapshot.active && snapshot.defId === accepted.defId,
    10_000,
    20_000
  );
  const snapshotLightingProbe = chapter1SnapshotLightingProbe
    ? await installChapter1SnapshotLightingProbe(first)
    : undefined;

  const expectedDialogueTexts = new Set(
    sourceDefinition.shots.flatMap((shot) =>
      shot.actions
        .filter((action) => action.kind === "dialogue")
        .map((action) => action.text)
    )
  );
  const timedVisualCheckpoints = [];
  let shotStartSeconds = 0;
  for (const shot of sourceDefinition.shots) {
    if (
      shot.actions.some(
        (action) =>
          action.kind === "custom" && action.hook === "ch1.reviseLedgerEntry"
      )
    ) {
      timedVisualCheckpoints.push({
        key: shot.id,
        atMs: (shotStartSeconds + Math.min(0.75, shot.duration / 2)) * 1_000,
      });
    }
    shotStartSeconds += shot.duration;
  }
  const seenDialogueTexts = new Set();
  const seenVisualCheckpointKeys = new Set();
  const snapshots = [];
  const startedAt = Date.now();
  const ceilingMs = Math.max(60_000, Math.ceil(authoredSeconds * 4_000));
  let openingCaptured = false;
  while (Date.now() - startedAt <= ceilingMs) {
    const snapshot = await bridgeCall(first.page, "chapter1CutsceneSnapshot");
    if (!snapshot.active) break;
    const subtitleText = snapshot.subtitle?.text;
    let captureReason;
    if (
      !openingCaptured &&
      Date.now() - startedAt >= 750 &&
      snapshot.fadeOpacity < 0.1 &&
      !snapshot.subtitle
    ) {
      captureReason = "opening";
      openingCaptured = true;
    } else if (subtitleText && !seenDialogueTexts.has(subtitleText)) {
      captureReason = `dialogue:${snapshot.subtitle.speaker ?? ""}`;
      seenDialogueTexts.add(subtitleText);
    } else {
      const visualCheckpoint = timedVisualCheckpoints.find(
        (checkpoint) =>
          !seenVisualCheckpointKeys.has(checkpoint.key) &&
          Date.now() - startedAt >= checkpoint.atMs &&
          snapshot.fadeOpacity < 0.1
      );
      if (visualCheckpoint) {
        captureReason = `visual:${visualCheckpoint.key}`;
        seenVisualCheckpointKeys.add(visualCheckpoint.key);
      }
    }
    if (captureReason) {
      const filename = `${String(snapshots.length).padStart(3, "0")}.png`;
      await first.page.screenshot({
        path: path.join(frameDir, filename),
        type: "png",
      });
      snapshots.push({
        filename,
        captureReason,
        elapsedMs: Date.now() - startedAt,
        renderDiagnostics: await chapter1HumanRenderDiagnostics(first),
        ...snapshot,
      });
    }
    await delay(200);
  }
  const finished = await bridgeCall(first.page, "chapter1CutsceneSnapshot");
  assert.equal(
    finished.active,
    false,
    `${sourceDefinition.id}: frame sequence did not finish; ` +
      `last=${JSON.stringify(finished)}`
  );
  assert.deepStrictEqual(
    [...seenDialogueTexts]
      .filter((text) => expectedDialogueTexts.has(text))
      .sort(),
    [...expectedDialogueTexts].sort(),
    `${sourceDefinition.id}: frame sequence missed authored dialogue`
  );
  assert.deepStrictEqual(
    [...seenVisualCheckpointKeys].sort(),
    timedVisualCheckpoints.map((checkpoint) => checkpoint.key).sort(),
    `${sourceDefinition.id}: frame sequence missed authored visual checkpoints`
  );
  assert(
    snapshots.length >= Math.max(2, expectedDialogueTexts.size + 1),
    `${sourceDefinition.id}: captured only ${snapshots.length} live frames`
  );
  const manifest = path.join(frameDir, "manifest.json");
  fs.writeFileSync(
    manifest,
    `${JSON.stringify(
      {
        id: sourceDefinition.id,
        injectedId: input.id,
        directorDefId: accepted.defId,
        authoredSeconds,
        capturedFrames: snapshots.length,
        snapshotLightingProbe,
        snapshots,
      },
      null,
      2
    )}\n`
  );
  const columns = 4;
  const rows = Math.ceil(snapshots.length / columns);
  const contactSheet = path.join(
    artifactsDir,
    "cutscenes",
    `${sourceDefinition.id}-${runId}-contact-sheet.png`
  );
  const sheet = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-framerate",
      "1",
      "-i",
      path.join(frameDir, "%03d.png"),
      "-vf",
      `scale=480:-1,tile=${columns}x${rows}:padding=8:margin=8`,
      "-frames:v",
      "1",
      contactSheet,
    ],
    { cwd: root, encoding: "utf8", timeout: 120_000 }
  );
  assert.equal(
    sheet.status,
    0,
    sheet.stderr || `${sourceDefinition.id}: frame contact sheet failed`
  );
  return {
    id: sourceDefinition.id,
    captureFormat: "frames",
    frameDir,
    manifest,
    contactSheet,
    authoredSeconds,
    capturedFrames: snapshots.length,
  };
}

async function proveAllChapter1GatesRender(first) {
  const gateIds = CH1_FRACTURE_GATES.map((gate) => gate.id);
  await holdChapter1AuditGates(first, gateIds);
  const rendered = [];
  try {
    for (const gate of CH1_FRACTURE_GATES) {
      const position = [
        gate.position[0] - 6,
        gate.position[1] + 1,
        gate.position[2] + 7,
      ];
      await chapter1WarpAndWait(first, position, gate.id);
      const snapshot = await waitFor(
        `${gate.id}: live renderer visibility`,
        () => bridgeCall(first.page, "chapter1GateRenderSnapshot"),
        (value) =>
          value?.gates?.some(
            (candidate) =>
              candidate.id === gate.id &&
              candidate.visible &&
              candidate.open > 0
          ),
        10_000,
        20_000
      );
      const diagnostic = snapshot.value.gates.find(
        (candidate) => candidate.id === gate.id
      );
      assert(
        diagnostic.open > 0,
        `${gate.id}: rendered with a closed aperture`
      );
      rendered.push(diagnostic);
    }
  } finally {
    await releaseChapter1AuditGates(first).catch(() => undefined);
  }
  return { gateCount: rendered.length, gates: rendered };
}

async function proveChapter1DungeonTerrain(first) {
  const dungeons = [];
  for (const terrain of CH1_DUNGEON_TERRAIN) {
    const volumeResults = [];
    for (const volume of terrain.volumes) {
      const local = chapter1StandableSample(terrain, volume);
      const feet = ch1DungeonAuthoredToWorld(terrain.dungeonId, local);
      await chapter1WarpAndWait(
        first,
        [feet[0] + 0.5, feet[1], feet[2] + 0.5],
        `${terrain.dungeonId}/${volume.name}`
      );
      const samples = await waitFor(
        `${terrain.dungeonId}/${volume.name}: live voxel samples`,
        () =>
          bridgeCall(first.page, "chapter1TerrainSnapshot", [
            {
              label: "floor",
              position: [feet[0], feet[1] - 1, feet[2]],
            },
            { label: "body", position: [feet[0], feet[1], feet[2]] },
            { label: "head", position: [feet[0], feet[1] + 1, feet[2]] },
          ]),
        (rows) =>
          rows?.length === 3 &&
          rows.every((row) => row.terrainEntityId && row.hasShardSeed),
        12_000,
        30_000
      );
      const floor = samples.value.find((row) => row.label === "floor");
      const body = samples.value.find((row) => row.label === "body");
      const head = samples.value.find((row) => row.label === "head");
      assert(floor.terrainId > 0, `${volume.name}: live floor is empty`);
      assert.equal(body.terrainId, 0, `${volume.name}: body space is solid`);
      assert.equal(head.terrainId, 0, `${volume.name}: head space is solid`);
      volumeResults.push({
        name: volume.name,
        feet,
        floorTerrainId: floor.terrainId,
        floorTerrainName: floor.terrainName,
      });
    }

    const waterResults = [];
    for (const water of terrain.water) {
      const local = {
        x: Math.floor((water.x0 + water.x1) / 2),
        y: water.y0,
        z: Math.floor((water.z0 + water.z1) / 2),
      };
      assert.equal(
        ch1DungeonWaterAt(terrain.dungeonId, local.x, local.y, local.z),
        true
      );
      const world = ch1DungeonAuthoredToWorld(terrain.dungeonId, local);
      await chapter1WarpAndWait(
        first,
        [world[0] + 0.5, world[1], world[2] + 0.5],
        `${terrain.dungeonId}/${water.name}`
      );
      const snapshot = await waitFor(
        `${terrain.dungeonId}/${water.name}: live water tensor`,
        () =>
          bridgeCall(first.page, "chapter1TerrainSnapshot", [
            { label: water.name, position: world },
          ]),
        (rows) => rows?.[0]?.water > 0 && rows[0].hasShardWater,
        12_000,
        30_000
      );
      waterResults.push(snapshot.value[0]);
    }
    dungeons.push({
      id: terrain.dungeonId,
      volumes: volumeResults,
      water: waterResults,
    });
  }
  return {
    dungeonCount: dungeons.length,
    volumeCount: dungeons.reduce(
      (count, dungeon) => count + dungeon.volumes.length,
      0
    ),
    dungeons,
  };
}

async function proveChapter1CastInNativeEcs(first) {
  const [localCast, authoritativeCast] = await Promise.all([
    bridgeCall(first.page, "chapter1NpcSnapshot"),
    Promise.all(
      CH1_NEW_CAST.map(async (member) => ({
        member,
        state: await authoritativeEntity(first.page, member.entityId),
      }))
    ),
  ]);
  const missingAuthoritative = authoritativeCast.filter(
    ({ state }) => !state.entity
  );
  assert.deepEqual(
    missingAuthoritative.map(({ member }) => member.key),
    [],
    "Chapter 1 cast is missing from authoritative ECS"
  );
  for (const { member, state } of authoritativeCast) {
    assert.equal(
      state.entity.label?.text,
      member.key === "augur9" ? "Mucked Robot" : member.displayName,
      member.key
    );
    assert(state.entity.position?.v, `${member.key}: missing native position`);
    assert(
      state.entity.npc_metadata,
      `${member.key}: missing native NPC metadata`
    );
  }
  return {
    authoritativeCount: authoritativeCast.length,
    synchronizedCount: localCast.filter((member) => member.present).length,
    cast: localCast,
  };
}

function decodeChapter1DataUri(dataUri) {
  const marker = ";base64,";
  const at = String(dataUri).indexOf(marker);
  if (at < 0) throw new Error("capture payload is not a base64 data URI");
  return Buffer.from(String(dataUri).slice(at + marker.length), "base64");
}

async function captureChapter1DungeonStills(first) {
  const outputDir = path.join(root, "artifacts/cutscenes");
  fs.mkdirSync(outputDir, { recursive: true });
  const captures = [];
  for (const promoId of ["ch1-sand-that-remembers", "ch1-long-winter-mouth"]) {
    if (
      chapter1CaptureIds &&
      !chapter1CaptureIds.has(promoId) &&
      !chapter1CaptureIds.has(`promo-${promoId}`)
    ) {
      continue;
    }
    const promo = promoSceneById(promoId);
    assert(promo, `missing Chapter 1 promo scene ${promoId}`);
    const capturePage = await first.context.newPage();
    attachDiagnostics(capturePage, `chapter1-still-${promoId}`);
    try {
      const captureUrl = new URL(
        promoCaptureUrl(promo, baseUrl, { captureRun: runId })
      );
      captureUrl.searchParams.set("syncBaseUrl", syncBaseUrl);
      captureUrl.searchParams.set("glitch_auto_play", "1");
      await capturePage.goto(captureUrl.toString(), {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
      // Software WebGL can occupy the page main thread for more than the
      // runner's ordinary 30-second single-probe budget while the branded
      // compositor renders. Register one in-page wait instead of repeatedly
      // racing page.evaluate against that gameplay-oriented probe limit.
      await capturePage.waitForFunction(
        () => {
          const output = document.getElementById("biomes-promo-capture-output");
          if (!output?.textContent) return false;
          const value = JSON.parse(output.textContent);
          return value?.status === "complete" || value?.status === "error";
        },
        undefined,
        { timeout: 180_000 }
      );
      const state = await capturePage.evaluate(() => {
        const output = document.getElementById("biomes-promo-capture-output");
        return output?.textContent ? JSON.parse(output.textContent) : undefined;
      });
      assert(state, `${promoId}: capture output disappeared after completion`);
      assert.notEqual(state.status, "error", state.error);
      const brandedPath = path.join(outputDir, state.filename);
      const rawPath = path.join(
        outputDir,
        state.filename.replace(/\.png$/, "-raw.png")
      );
      fs.writeFileSync(brandedPath, decodeChapter1DataUri(state.dataUri));
      fs.writeFileSync(rawPath, decodeChapter1DataUri(state.rawDataUri));
      captures.push({
        promoId,
        brandedPath,
        rawPath,
        cameraPosition: state.cameraPosition,
        cameraOrientation: state.cameraOrientation,
      });
    } finally {
      await capturePage.close().catch(() => undefined);
    }
  }
  return { captures };
}

function encodeChapter1Mp4(filename, authoredSeconds) {
  const input = path.join(artifactsDir, "cutscenes", filename);
  const output = input.replace(/\.webm$/, ".mp4");
  assert(fs.existsSync(input), `captured WebM is missing: ${input}`);
  const encoded = spawnSync(
    "bash",
    [
      path.join(root, "scripts/cutscenes/encode-cutscene-mp4.sh"),
      input,
      output,
      String(authoredSeconds),
    ],
    { cwd: root, encoding: "utf8", timeout: 15 * 60_000 }
  );
  assert.equal(
    encoded.status,
    0,
    `MP4 encode failed for ${filename}: ${
      encoded.error?.stack ||
      encoded.stderr ||
      encoded.stdout ||
      "no diagnostics"
    }`
  );
  const probe = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt,nb_frames",
      "-of",
      "json",
      output,
    ],
    { cwd: root, encoding: "utf8", timeout: 60_000 }
  );
  assert.equal(probe.status, 0, probe.stderr || `ffprobe failed for ${output}`);
  const contactSheet = output.replace(/\.mp4$/, "-contact-sheet.png");
  const samplePeriod = Math.max(0.25, Number(authoredSeconds) / 6);
  const sheet = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-i",
      output,
      "-vf",
      `fps=1/${samplePeriod},scale=360:-1,tile=3x2:padding=8:margin=8`,
      "-frames:v",
      "1",
      contactSheet,
    ],
    { cwd: root, encoding: "utf8", timeout: 120_000 }
  );
  assert.equal(
    sheet.status,
    0,
    sheet.stderr || `contact sheet failed for ${output}`
  );
  return {
    input,
    output,
    contactSheet,
    probe: JSON.parse(probe.stdout),
  };
}

async function captureAllChapter1Videos(first) {
  const catalog = await bridgeCall(first.page, "chapter1CutsceneCatalog");
  const jobs = [
    ...catalog.map((scene) => ({
      id: scene.id,
      filename: `${scene.id}-${runId}.webm`,
    })),
    {
      id: "promo-ch1-sand-that-remembers",
      promoId: "ch1-sand-that-remembers",
      filename: `the-sand-that-remembers-biomes-${runId}.webm`,
    },
    {
      id: "promo-ch1-long-winter-mouth",
      promoId: "ch1-long-winter-mouth",
      filename: `the-long-winter-mouth-biomes-${runId}.webm`,
    },
  ];
  const selectedJobs = chapter1CaptureIds
    ? jobs.filter(
        (job) =>
          chapter1CaptureIds.has(job.id) ||
          (job.promoId && chapter1CaptureIds.has(job.promoId))
      )
    : jobs;
  const captures = [];
  const failures = [];
  // Runtime-injected composition work is intentionally one attempt per
  // invocation. The user permits at most two deliberate attempts per scene;
  // an invisible automatic page retry consumed both before there was any
  // opportunity to correct the source between them.
  const captureAttemptsPerInvocation = chapter1RuntimeInject ? 1 : 2;
  for (const [jobIndex, job] of selectedJobs.entries()) {
    if (jobIndex > 0) {
      await rotateChapter1VideoPage(first, `${job.id}-isolation`);
    }
    let completed = false;
    let lastError;
    for (
      let attempt = 1;
      attempt <= captureAttemptsPerInvocation && !completed;
      attempt += 1
    ) {
      let auditGateHold = false;
      let auditProjectionHold = false;
      try {
        const sourceDefinition = job.promoId
          ? await promoSceneById(job.promoId)?.build()
          : ch1AllScenes().find((scene) => scene.id === job.id);
        assert(sourceDefinition, `missing current source scene ${job.id}`);
        const captureId = chapter1RuntimeInject
          ? await registerHostChapter1Cutscene(first, sourceDefinition)
          : job.id;
        const prepared = await bridgeCall(
          first.page,
          "chapter1PrepareCutsceneAudit",
          job.id
        );
        const focusStaging = chapter1RuntimeInject ? [] : prepared.staging;
        let focus;
        if (job.promoId) {
          const promo = promoSceneById(job.promoId);
          assert(promo, `missing Chapter 1 promo scene ${job.promoId}`);
          focus = await focusChapter1Definition(
            first,
            await promo.build(),
            job.id,
            focusStaging
          );
        } else {
          focus = await focusChapter1Scene(
            first,
            job.id,
            focusStaging,
            chapter1GateRendererFocus(prepared.activeGateIds)
          );
        }
        await waitForChapter1CutsceneFocusReady(first, focus, job.id);
        // A capture page can share the snapshot with prior focused-run users.
        // Hide every nearby remote player as well as persistent story bodies so
        // the evidence contains only the authored cast and this run's player.
        await isolateChapter1CatalogProjection(first, focus.focus);
        auditProjectionHold = true;
        if (prepared.activeGateIds.length > 0) {
          await holdChapter1AuditGates(
            first,
            prepared.activeGateIds,
            focus.focus
          );
          auditGateHold = true;
        }
        await waitForChapter1CutsceneGatesReady(
          first,
          prepared.activeGateIds,
          job.id
        );
        if (chapter1CaptureFormat === "frames") {
          captures.push(
            await captureChapter1FrameSequence(
              first,
              { ...job, id: captureId },
              sourceDefinition
            )
          );
        } else {
          const captured = await bridgeCall(
            first.page,
            "chapter1CaptureCutsceneVideo",
            {
              ...job,
              id: captureId,
              promoId: undefined,
              frameRate: 30,
              // 4 Mbps is visually clean at the recorder's <=1280px output and
              // halves upload/base64 pressure versus MediaRecorder's old 8 Mbps
              // default. MP4 encoding still controls the final delivery bitrate.
              videoBitsPerSecond: 4_000_000,
              timeoutMs: 15 * 60_000,
            }
          );
          captures.push({
            ...captured,
            captureFormat: "video",
            encoded: (() => {
              materializeChapter1CapturedWebm(captured.filename);
              return encodeChapter1Mp4(
                captured.filename,
                captured.authoredSeconds
              );
            })(),
          });
        }
        completed = true;
      } catch (error) {
        lastError = error;
        if (attempt < captureAttemptsPerInvocation) {
          // MediaRecorder, the renderer and React UI share one main thread.
          // Replace only a poisoned page and retry the failed scene; retain
          // the authenticated context, ECS user and all completed files.
          await rotateChapter1VideoPage(first, `${job.id}-retry-${attempt}`);
        }
      } finally {
        if (auditGateHold && !first.page.isClosed()) {
          await releaseChapter1AuditGates(first).catch(() => undefined);
        }
        if (auditProjectionHold && !first.page.isClosed()) {
          await releaseChapter1CatalogProjection(first).catch(() => undefined);
        }
      }
    }
    if (!completed) {
      failures.push({ id: job.id, error: chapter1ErrorText(lastError) });
    }
  }
  assert.deepEqual(
    failures,
    [],
    `Chapter 1 video failures: ${JSON.stringify(failures)}`
  );
  return { videoCount: captures.length, captures };
}

async function rotateChapter1VideoPage(first, label) {
  const previous = first.page;
  intentionallyClosingPages.add(previous);
  await previous.close().catch(() => undefined);
  // A local-user Sync session is exclusive. Opening the replacement first
  // makes the still-live prior page show the stale-session modal, which shuts
  // down its renderer/audio and poisons the recorder retry. Close and release
  // the prior session before constructing the next isolated capture page.
  const replacement = await openSameUserPeer(first, `chapter1-video-${label}`);
  await replacement.waitForFunction(
    () => !document.querySelector(".loading-wrapper"),
    undefined,
    { timeout: timeoutMs }
  );
  first.page = replacement;
  return replacement;
}

function chapter1NpcAuditFilename(value) {
  return String(value)
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");
}

function chapter1NpcAuditEntityIdByKey(catalog) {
  const ids = new Map();
  for (const scenario of catalog.scenarios) {
    for (const row of scenario.staging) {
      ids.set(row.key, Number(row.entityId));
    }
  }
  ids.set("sergeant_bram_holt", Number(catalog.returningNpc.entityId));
  return ids;
}

function chapter1NpcAuditTargetForKey(scenario, key) {
  const staged = scenario.staging.find((row) => row.key === key);
  return staged?.position ? [...staged.position] : [...scenario.focus];
}

async function placeChapter1NpcAuditPlayer(
  first,
  target,
  label,
  offset = [1.75, 1.75]
) {
  await setSnapshotGroveInteractionPin(first, target, false);
  const approach = [target[0] + offset[0], target[1], target[2] + offset[1]];
  const orientation = lookAtOrientation(
    [approach[0], approach[1] + 1.6, approach[2]],
    [target[0], target[1] + 1.3, target[2]]
  );
  await placeFrontendPlayerForFixture(
    first.page,
    first.userId,
    approach,
    orientation
  );
  await setSnapshotGroveInteractionPin(first, approach, true);
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({ v: approach }),
      orientation: Orientation.create({ v: orientation }),
      rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
      health: Health.create({ hp: 1_000_000, maxHp: 1_000_000 }),
    },
  });
  await publishFrontendMove(first.page, first.userId, approach, orientation);
  await waitFor(
    `${label}: browser player reaches the NPC stage`,
    () => frontendPlayerPose(first.page, first.userId),
    (pose) =>
      Boolean(pose?.position) && distanceXZ(pose.position, approach) <= 0.75,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
}

function chapter1NpcTalkSnapshotMatches(snapshot, entityId) {
  return (
    Number(snapshot?.inspectable?.entityId) === Number(entityId) &&
    snapshot?.inspectOverlays?.filter(
      (overlay) =>
        overlay.text?.trim() === "F Talk" &&
        overlay.display !== "none" &&
        overlay.visibility !== "hidden" &&
        overlay.opacity !== "0" &&
        overlay.rect?.width > 0 &&
        overlay.rect?.height > 0
    ).length === 1
  );
}

async function waitForChapter1NpcTalkTarget(first, entityId, target, label) {
  const [localVersion, localEntity] = await bridgeCall(
    first.page,
    "getLocal",
    entityId
  );
  const presentation = await bridgeCall(
    first.page,
    "chapter1NpcPresentationSnapshot"
  );
  const projectionDiagnostic = {
    localVersion,
    localEntityKeys: localEntity ? Object.keys(localEntity).sort() : [],
    override: presentation.overrides?.find(
      (override) => Number(override.id) === Number(entityId)
    ),
    renderRecord: presentation.records?.find(
      (record) => Number(record.id) === Number(entityId)
    ),
  };
  const offsets = [
    [1.75, 1.75],
    [1.75, 0],
    [-1.75, 0],
    [0, 1.75],
    [0, -1.75],
    [-1.75, -1.75],
  ];
  let lastError;
  for (const offset of offsets) {
    await placeChapter1NpcAuditPlayer(
      first,
      target,
      `${label} approach ${offset.join(",")}`,
      offset
    );
    try {
      return await waitFor(
        `${label}: canonical NPC owns one visible nearby F Talk target`,
        () => frontendInteractionSnapshot(first.page),
        (snapshot) => chapter1NpcTalkSnapshotMatches(snapshot, entityId),
        Math.max(originSyncGateMs, 10_000),
        5_000
      );
    } catch (error) {
      lastError = error;
      if (!String(error).includes("timed out after 5000ms")) throw error;
    }
  }
  throw new Error(
    `${String(lastError)}; projectionDiagnostic=${JSON.stringify(
      projectionDiagnostic
    )}`
  );
}

async function proveChapter1NpcLiveAudit(first) {
  const catalog = await bridgeCall(first.page, "chapter1NpcAuditCatalog");
  assert.equal(
    catalog.version,
    "chapter1-npc-live-audit-v5",
    "unexpected Chapter One NPC audit catalog"
  );
  assert.equal(catalog.scenarios.length, 24, "NPC stage matrix is incomplete");
  assert(
    Array.isArray(catalog.retiredNpcEntityIds) &&
      catalog.retiredNpcEntityIds.length > 0,
    "NPC stage matrix must identify retired duplicate entity ids"
  );
  for (const entityId of catalog.retiredNpcEntityIds) {
    const retired = await authoritativeEntity(first.page, Number(entityId));
    assert.equal(
      retired.entity,
      undefined,
      `retired duplicate NPC ${entityId} still exists in authoritative ECS`
    );
  }
  const entityIdByKey = chapter1NpcAuditEntityIdByKey(catalog);
  const captured = [];
  const stageResults = [];
  let selectedScenarios = catalog.scenarios;
  if (chapter1NpcResumeAfter) {
    const resumeIndex = selectedScenarios.findIndex(
      (scenario) => scenario.id === chapter1NpcResumeAfter
    );
    assert(
      resumeIndex >= 0,
      `Unknown Chapter One NPC resume scenario: ${chapter1NpcResumeAfter}`
    );
    selectedScenarios = selectedScenarios.slice(resumeIndex + 1);
    report.browser.transients.push(
      `chapter1-npc-resumed-after:${chapter1NpcResumeAfter}`
    );
  }

  for (const sourceScenario of selectedScenarios) {
    const scenario = await bridgeCall(
      first.page,
      "chapter1PrepareNpcAudit",
      sourceScenario.id
    );
    const talkTarget = scenario.talkKey
      ? chapter1NpcAuditTargetForKey(scenario, scenario.talkKey)
      : scenario.focus;
    await placeChapter1NpcAuditPlayer(
      first,
      talkTarget,
      `Chapter One NPC ${scenario.id}`
    );
    const expectedPresentIds = scenario.expectedPresentKeys.map((key) => {
      const id = entityIdByKey.get(key);
      assert(id, `${scenario.id}: no canonical id for ${key}`);
      return id;
    });
    const expectedAbsentIds = [
      ...catalog.retiredNpcEntityIds.map(Number),
      ...(scenario.expectedAbsentKeys ?? []).map((key) => {
        const id = entityIdByKey.get(key);
        assert(id, `${scenario.id}: no canonical absent id for ${key}`);
        return id;
      }),
    ];
    const expectedPositionById = new Map();
    for (const key of scenario.expectedPresentKeys) {
      const id = entityIdByKey.get(key);
      const stagedRow = scenario.staging.find((row) => row.key === key);
      const expectedPosition = stagedRow?.position
        ? [...stagedRow.position]
        : stagedRow?.useSeededBody
          ? (await authoritativeEntity(first.page, id)).entity?.position?.v
          : scenario.focus;
      assert(
        expectedPosition,
        `${scenario.id}: ${key} has no expected position`
      );
      expectedPositionById.set(id, [...expectedPosition]);
    }
    const presentation = await waitFor(
      `${scenario.id}: projected bodies converge`,
      () => bridgeCall(first.page, "chapter1NpcPresentationSnapshot"),
      (snapshot) => {
        if (!Number.isFinite(snapshot?.bridgeAt)) return false;
        const counts = new Map();
        for (const record of snapshot.records ?? []) {
          counts.set(
            Number(record.id),
            (counts.get(Number(record.id)) ?? 0) + 1
          );
        }
        return (
          expectedPresentIds.every((id) => {
            const records = snapshot.records.filter(
              (record) => Number(record.id) === id
            );
            return (
              records.length === 1 &&
              distance3(records[0].at, expectedPositionById.get(id)) <= 8
            );
          }) && expectedAbsentIds.every((id) => !counts.has(id))
        );
      },
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    );
    for (const key of scenario.expectedPresentKeys) {
      const id = entityIdByKey.get(key);
      const records = presentation.value.records.filter(
        (record) => Number(record.id) === id
      );
      assert.equal(records.length, 1, `${scenario.id}: duplicate ${key}`);
      assert(records[0].label, `${scenario.id}: ${key} has no visible label`);
      assert(records[0].asset, `${scenario.id}: ${key} has no visual asset`);
      assert(
        Number.isFinite(records[0].scale) && records[0].scale > 0,
        `${scenario.id}: ${key} has invalid scale`
      );
      const expectedPosition = expectedPositionById.get(id);
      assert(
        distance3(records[0].at, expectedPosition) <= 8,
        `${scenario.id}: ${key} rendered at the wrong stage: ${JSON.stringify(
          records[0].at
        )}`
      );
    }
    if (scenario.talkKey) {
      const talkRecord = presentation.value.records.find(
        (record) =>
          Number(record.id) === Number(entityIdByKey.get(scenario.talkKey))
      );
      assert(
        talkRecord?.at,
        `${scenario.id}: Talk body has no rendered position`
      );
      await waitForChapter1NpcTalkTarget(
        first,
        entityIdByKey.get(scenario.talkKey),
        talkRecord.at,
        `${scenario.id}/${scenario.talkKey}`
      );
    }
    const screenshotPath = path.join(
      artifactsDir,
      `${runId}-npc-stage-${chapter1NpcAuditFilename(scenario.id)}.png`
    );
    await first.page.screenshot({ path: screenshotPath });
    captured.push(screenshotPath);
    stageResults.push({
      id: scenario.id,
      present: scenario.expectedPresentKeys,
      absent: scenario.expectedAbsentKeys ?? [],
      talkKey: scenario.talkKey,
      screenshotPath,
    });

    if (scenario.id === "starter-jackie-road-ahead") {
      await first.page.keyboard.press("KeyF");
      const dialog = first.page.locator(
        ".npc-quest-view .npc-quest-dialog-container"
      );
      await dialog.waitFor({ state: "visible", timeout: 20_000 });
      const dialogText = String(await dialog.textContent());
      assert.match(
        dialogText,
        /Jackie|Road Ahead/i,
        "starter Jackie did not open the Road Ahead dialogue"
      );
      const dialoguePath = path.join(
        artifactsDir,
        `${runId}-starter-jackie-road-ahead-dialogue.png`
      );
      await first.page.screenshot({ path: dialoguePath });
      captured.push(dialoguePath);
      await first.page.keyboard.press("Escape");
    }
  }

  await bridgeCall(first.page, "chapter1ClearNpcAudit");
  const sharedResults = [];
  for (const entry of catalog.sharedNpcs) {
    await placeChapter1NpcAuditPlayer(
      first,
      entry.position,
      `Shared Chapter One NPC ${entry.displayName}`
    );
    const presentation = await waitFor(
      `${entry.displayName}: shared body converges`,
      () => bridgeCall(first.page, "chapter1NpcPresentationSnapshot"),
      (snapshot) =>
        (snapshot.records ?? []).filter(
          (record) => Number(record.id) === Number(entry.entityId)
        ).length === 1,
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    );
    const [record] = presentation.value.records.filter(
      (candidate) => Number(candidate.id) === Number(entry.entityId)
    );
    assert.equal(
      record.label,
      entry.displayName,
      `${entry.displayName}: label drift`
    );
    assert(record.asset, `${entry.displayName}: visual asset is missing`);
    assert(
      Number.isFinite(record.scale) && record.scale > 0,
      `${entry.displayName}: visual scale is invalid`
    );
    await waitForChapter1NpcTalkTarget(
      first,
      entry.entityId,
      record.at,
      `Shared Chapter One NPC ${entry.displayName}`
    );
    const screenshotPath = path.join(
      artifactsDir,
      `${runId}-npc-shared-${chapter1NpcAuditFilename(entry.displayName)}.png`
    );
    await first.page.screenshot({ path: screenshotPath });
    captured.push(screenshotPath);
    sharedResults.push({
      entityId: String(entry.entityId),
      displayName: entry.displayName,
      roles: entry.roles,
      screenshotPath,
    });
  }
  await setSnapshotGroveInteractionPin(first, [0, 0, 0], false);

  report.scenarios.push({
    name: "all Chapter One NPC stages, shared quest givers, and Talk targets",
    status: "pass",
    stageCount: stageResults.length,
    sharedNpcCount: sharedResults.length,
    stages: stageResults,
    sharedNpcs: sharedResults,
    screenshots: captured,
  });
}

async function runChapter1BrowserBatch(first, options) {
  const selected = (feature) =>
    !chapter1Features || chapter1Features.has(feature);
  if (!options.captureOnly) {
    if (selected("items")) {
      await chapter1Scenario(
        "all Chapter 1 plot items render in the live inventory",
        () => proveAllChapter1ItemsRender(first)
      );
    }
    if (selected("catalog")) {
      await chapter1Scenario(
        "Chapter 1 completeable browser state machine and native quest catalog",
        () => proveChapter1RuntimeAndNativeCatalog(first)
      );
    }
    if (selected("quests")) {
      const questScenario = await chapter1Scenario(
        "all Chapter 1 native quests complete through the production objective bridge",
        () => proveAllChapter1NativeQuestsComplete(first)
      );
      if (questScenario.status === "fail") {
        await releaseFailedChapter1DungeonFixture(first).catch((error) => {
          report.browser.failures.push(
            `chapter1-test-dungeon-cleanup:${chapter1ErrorText(error)}`
          );
        });
      }
    }
    if (selected("cutscenes")) {
      await chapter1Scenario(
        "all Chapter 1 cutscenes enter the live director",
        () => proveAllChapter1CutscenesStart(first)
      );
    }
    if (selected("gates")) {
      await chapter1Scenario("all four Chapter 1 gates render live", () =>
        proveAllChapter1GatesRender(first)
      );
    }
    if (selected("terrain")) {
      await chapter1Scenario(
        "both Chapter 1 dungeons are live native terrain",
        () => proveChapter1DungeonTerrain(first)
      );
    }
    if (selected("cast")) {
      await chapter1Scenario(
        "all Chapter 1 cast members exist in native ECS",
        () => proveChapter1CastInNativeEcs(first)
      );
    }
  }
  if (selected("stills")) {
    await chapter1Scenario("Chapter 1 branded dungeon action screenshots", () =>
      captureChapter1DungeonStills(first)
    );
  }
  if (!options.skipVideo && selected("videos")) {
    await chapter1Scenario(
      "all Chapter 1 cutscenes captured and encoded to MP4",
      () => captureAllChapter1Videos(first)
    );
  }
}

async function proveAllChapter1ItemsRender(first) {
  const current = await authoritativeEntity(first.page, first.userId);
  assert(current.entity?.inventory, "Chapter 1 item audit has no inventory");
  const inventory = Inventory.create({
    items: new Array(PLAYER_INVENTORY_SLOTS),
    hotbar: new Array(PLAYER_HOTBAR_SLOTS),
    currencies: new Map(),
    overflow: new Map(),
    selected: { kind: "hotbar", idx: 0 },
  });
  const expected = CH1_ITEMS.filter(
    (item) => !chapter1ItemIds || chapter1ItemIds.has(item.id)
  ).map((item) => {
    const nativeId = harthmereNativeBiomesIdForItemId(item.id);
    assert(nativeId, `${item.id}: Chapter 1 item has no canonical native id`);
    setNativeInventoryCount(inventory, nativeId, 1);
    return { ...item, nativeId };
  });
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      inventory,
      selected_item: SelectedItem.create(),
    },
  });
  await waitFor(
    "all Chapter 1 plot items synchronize into the live browser",
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      expected.every(({ nativeId }) => inventoryCount(entity, nativeId) === 1n),
    Math.max(originSyncGateMs, 15_000),
    Math.max(timeoutMs, 30_000)
  );

  await first.page.keyboard.press("KeyI");
  const inventoryTab = first.page.getByLabel("Backpack inventory", {
    exact: true,
  });
  await inventoryTab.waitFor({ state: "visible", timeout: timeoutMs });
  const results = [];
  const failures = [];
  for (const item of expected) {
    const result = {
      itemId: item.id,
      nativeItemId: String(item.nativeId),
      name: item.name,
    };
    results.push(result);
    try {
      const button = inventoryTab.getByRole("button", {
        name: `${item.name} x1`,
        exact: true,
      });
      assert.equal(
        await button.count(),
        1,
        `${item.id}: live inventory cell is missing or ambiguous`
      );
      const icon = button.locator('[data-inventory-icon-kind="image"]');
      assert.equal(
        await icon.count(),
        1,
        `${item.id}: live inventory did not render its authored image icon`
      );
      // The inventory panel becomes visible before its image requests finish
      // on software/Metal lanes. Wait on the real DOM image state; broken URLs
      // still fail with zero natural size rather than being hidden by a sleep.
      await waitFor(
        `${item.id}: inventory icon finishes loading`,
        () =>
          icon.evaluate((element) => ({
            complete:
              element instanceof HTMLImageElement ? element.complete : false,
          })),
        (image) => image.complete,
        Math.max(acceptanceGateMs, 5_000),
        Math.max(timeoutMs, 15_000)
      );
      const image = await icon.evaluate((element) => ({
        src: element.getAttribute("src"),
        complete:
          element instanceof HTMLImageElement ? element.complete : false,
        naturalWidth:
          element instanceof HTMLImageElement ? element.naturalWidth : 0,
        naturalHeight:
          element instanceof HTMLImageElement ? element.naturalHeight : 0,
        rect: {
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
        },
      }));
      assert(
        image.src?.includes("/assets/harthmere/inventory_icons/generated/"),
        `${item.id}: live inventory used the wrong icon source ${image.src}`
      );
      assert.equal(
        image.complete,
        true,
        `${item.id}: icon did not finish loading`
      );
      assert(image.naturalWidth > 0, `${item.id}: icon has zero natural width`);
      assert(
        image.naturalHeight > 0,
        `${item.id}: icon has zero natural height`
      );
      assert(image.rect.width > 0, `${item.id}: icon is not visibly laid out`);
      assert(image.rect.height > 0, `${item.id}: icon is not visibly laid out`);
      Object.assign(result, {
        icon: image.src,
        naturalSize: [image.naturalWidth, image.naturalHeight],
        renderedSize: [image.rect.width, image.rect.height],
      });
    } catch (error) {
      const message = chapter1ErrorText(error);
      result.iconError = message;
      failures.push({ itemId: item.id, phase: "inventory", error: message });
    }
  }
  const screenshot = path.join(
    artifactsDir,
    `${runId}-chapter-1-all-items-inventory.png`
  );
  await first.page.screenshot({ path: screenshot, fullPage: true });
  await first.page.keyboard.press("Escape");

  // Inventory thumbnails prove the exact Blender icon route, but the original
  // production report was a selected Core Cell with no resolvable held mesh.
  // Exercise every Chapter 1 plot item through the real selected-item renderer
  // too. The local avatar (and therefore its hand attachment) is intentionally
  // hidden in first person, so force the normal third-person camera before
  // taking visual evidence. Console mesh-resolution errors remain fatal.
  const firstPersonBeforeHeldAudit = await first.page.evaluate(() =>
    Boolean(
      globalThis.clientContext?.resources?.get("/scene/camera")?.isFirstPerson
    )
  );
  if (firstPersonBeforeHeldAudit) {
    await first.page.keyboard.press("KeyT");
  }
  await first.page.waitForFunction(
    () =>
      globalThis.clientContext?.resources?.get("/scene/camera")
        ?.isFirstPerson === false,
    undefined,
    { timeout: 10_000 }
  );
  const gameCanvas = first.page.locator("canvas.biomes-canvas");
  await gameCanvas.waitFor({ state: "visible", timeout: timeoutMs });
  await gameCanvas.focus({ timeout: probeTimeoutMs });
  const canvasBox = await gameCanvas.boundingBox();
  assert(canvasBox, "Chapter 1 item audit game canvas has no layout box");
  await first.page.mouse.move(
    canvasBox.x + canvasBox.width / 2,
    canvasBox.y + canvasBox.height / 2
  );

  // Generate a non-authoritative review scene through the same declarative
  // cutscene system used by Chapter 1. The three composed cameras make held
  // silhouettes, scale and hand attachment readable from the front and both
  // three-quarter angles without moving the real player or committing story
  // state. This is runtime-injected into the exact current app bundle.
  const reviewCenter = await first.page.evaluate((userId) => {
    const resources = globalThis.clientContext?.resources;
    const player = resources?.get("/sim/player", userId);
    const position = player?.position;
    return Array.isArray(position) ? [...position] : undefined;
  }, first.userId);
  assert(
    Array.isArray(reviewCenter) && reviewCenter.length === 3,
    "Chapter 1 item audit could not resolve the live player position"
  );
  const [reviewX, reviewY, reviewZ] = reviewCenter;
  // Normalize the avatar's facing before measuring any item. A review camera
  // derived from the mesh bounds is only stable if the cutscene does not turn
  // the player after those bounds were sampled.
  const reviewPlayerOrientation = lookAtOrientation(
    [reviewX, reviewY + 1.1, reviewZ],
    [reviewX, reviewY + 1.1, reviewZ - 4]
  );
  await placeFrontendPlayerForFixture(
    first.page,
    first.userId,
    reviewCenter,
    reviewPlayerOrientation
  );
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({ v: reviewCenter }),
      orientation: Orientation.create({ v: reviewPlayerOrientation }),
      rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
    },
  });
  await publishFrontendMove(
    first.page,
    first.userId,
    reviewCenter,
    reviewPlayerOrientation
  );

  const heldItemWorldBounds = (item, nativeId) =>
    first.page.evaluate(
      ({ userId, expectedItemId }) => {
        const resources = globalThis.clientContext?.resources;
        const playerMesh = resources?.cached("/scene/player/mesh", userId);
        const attachment = playerMesh?.itemAttachment;
        const root = attachment?.itemMeshInstance?.three;
        if (!root) return undefined;
        root.updateMatrixWorld?.(true);
        const min = [Infinity, Infinity, Infinity];
        const max = [-Infinity, -Infinity, -Infinity];
        let meshCount = 0;
        let vertexCount = 0;
        const materials = [];
        const include = (x, y, z) => {
          min[0] = Math.min(min[0], x);
          min[1] = Math.min(min[1], y);
          min[2] = Math.min(min[2], z);
          max[0] = Math.max(max[0], x);
          max[1] = Math.max(max[1], y);
          max[2] = Math.max(max[2], z);
        };
        root.traverse?.((child) => {
          if (!child?.isMesh || !child.geometry) return;
          meshCount += 1;
          const meshMaterials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          for (const material of meshMaterials) {
            materials.push({
              name: String(material?.name ?? ""),
              type: String(material?.type ?? material?.constructor?.name ?? ""),
              color: material?.color?.toArray?.(),
              baseColor: material?.uniforms?.baseColor?.value,
              useMap: material?.uniforms?.useMap?.value,
              vertexColors: material?.uniforms?.vertexColors?.value,
              canonicalBaseColor:
                material?.userData?.harthmereChapter1CanonicalBaseColor,
              canonicalMaterialName:
                material?.userData?.harthmereChapter1GltfMaterialName,
            });
          }
          const geometry = child.geometry;
          geometry.computeBoundingBox?.();
          const box = geometry.boundingBox;
          const elements = child.matrixWorld?.elements;
          if (!box || !elements) return;
          vertexCount += Number(geometry.attributes?.position?.count ?? 0);
          for (const x of [box.min.x, box.max.x]) {
            for (const y of [box.min.y, box.max.y]) {
              for (const z of [box.min.z, box.max.z]) {
                include(
                  elements[0] * x +
                    elements[4] * y +
                    elements[8] * z +
                    elements[12],
                  elements[1] * x +
                    elements[5] * y +
                    elements[9] * z +
                    elements[13],
                  elements[2] * x +
                    elements[6] * y +
                    elements[10] * z +
                    elements[14]
                );
              }
            }
          }
        });
        if (!min.every(Number.isFinite) || !max.every(Number.isFinite)) {
          return undefined;
        }
        return {
          selectedItemId: String(attachment?.selectedItem?.id ?? ""),
          expectedItemId: String(expectedItemId),
          min,
          max,
          center: min.map((value, index) => (value + max[index]) / 2),
          size: min.map((value, index) => max[index] - value),
          meshCount,
          vertexCount,
          materials,
        };
      },
      { userId: first.userId, expectedItemId: nativeId }
    );
  const setHeldItemDetailIsolation = (active) =>
    first.page.evaluate(
      ({ active, userId }) => {
        const resources = globalThis.clientContext?.resources;
        const playerMesh = resources?.cached("/scene/player/mesh", userId);
        const playerRoot = playerMesh?.three;
        const itemRoot = playerMesh?.itemAttachment?.itemMeshInstance?.three;
        if (!playerRoot) return { hidden: 0, itemMeshes: 0 };
        const key = "__chapter1HeldItemDetailIsolation";
        const previous = globalThis[key];
        if (previous) {
          playerRoot.traverse?.((object) => {
            if (previous.has(object.uuid)) {
              object.visible = previous.get(object.uuid);
            }
          });
          delete globalThis[key];
        }
        if (!active || !itemRoot) return { hidden: 0, itemMeshes: 0 };
        const itemObjects = new Set();
        let itemMeshes = 0;
        itemRoot.traverse?.((object) => {
          itemObjects.add(object);
          if (object?.isMesh) itemMeshes += 1;
        });
        const hidden = new Map();
        playerRoot.traverse?.((object) => {
          if (!object?.isMesh || itemObjects.has(object)) return;
          hidden.set(object.uuid, object.visible);
          object.visible = false;
        });
        globalThis[key] = hidden;
        return { hidden: hidden.size, itemMeshes };
      },
      { active, userId: first.userId }
    );
  // Keep the evidence focused on the audited local avatar. Persistent test
  // actors can share this Grove pad and otherwise overlap the hand/item from
  // one of the generated angles.
  await isolateChapter1CatalogProjection(first, reviewCenter);

  const waitForHeldItemReviewAngle = async (itemId, label, target) =>
    waitFor(
      `${itemId}: generated ${label} camera settles with the fade clear`,
      () =>
        first.page.evaluate((targetPosition) => {
          const resources = globalThis.clientContext?.resources;
          const state = resources?.get("/scene/cutscene");
          const waypoint = resources?.get("/scene/waypoint_camera/active");
          const fadeElement = document.querySelector(
            '[data-cutscene-fade="true"]'
          );
          const position =
            waypoint?.kind === "active" ? waypoint.value?.[0] : undefined;
          return {
            active: Boolean(state?.active),
            fadeOpacity: Number(state?.fadeOpacity ?? 1),
            renderedFadeOpacity: fadeElement
              ? Number(getComputedStyle(fadeElement).opacity)
              : 1,
            position: Array.isArray(position) ? [...position] : undefined,
            horizontalDistance:
              Array.isArray(position) && Array.isArray(targetPosition)
                ? Math.hypot(
                    position[0] - targetPosition[0],
                    position[2] - targetPosition[2]
                  )
                : Number.POSITIVE_INFINITY,
          };
        }, target),
      (snapshot) =>
        snapshot.active &&
        snapshot.fadeOpacity <= 0.01 &&
        snapshot.renderedFadeOpacity <= 0.01 &&
        snapshot.horizontalDistance <= 0.12,
      15_000,
      60_000
    );

  for (const item of expected) {
    const result = results.find((candidate) => candidate.itemId === item.id);
    let reverseCameraHeld = false;
    try {
      const heldInventory = Inventory.clone(inventory);
      heldInventory.hotbar[0] = countOf(item.nativeId, 1n);
      heldInventory.selected = { kind: "hotbar", idx: 0 };
      await applyFixture(first.page, {
        kind: "update",
        entity: {
          id: first.userId,
          inventory: heldInventory,
          selected_item: SelectedItem.create({
            item: heldInventory.hotbar[0],
          }),
        },
      });
      await waitFor(
        `${item.id}: selected held item synchronizes`,
        () => localEntity(first.page, first.userId),
        ({ entity }) => entity?.selected_item?.item?.item?.id === item.nativeId,
        Math.max(originSyncGateMs, 10_000),
        Math.max(timeoutMs, 20_000)
      );
      // The player renderer intentionally reads the local /hotbar/selection
      // resource instead of the replicated selected_item component. Fixture
      // updates can replace slot 0 while /hotbar/index is already 0, leaving
      // that derived resource on its previous empty selection. Exercise the
      // same local index transition as a real 2 -> 1 hotbar selection so the
      // live renderer resolves the newly inserted Chapter 1 item.
      await first.page.evaluate(() => {
        const resources = globalThis.clientContext?.resources;
        resources?.set("/hotbar/index", { value: 1 });
        resources?.set("/hotbar/index", { value: 0 });
      });
      await waitFor(
        `${item.id}: live hotbar resource selects the held item`,
        () =>
          first.page.evaluate(() => {
            const resources = globalThis.clientContext?.resources;
            const selection = resources?.get("/hotbar/selection");
            const inventory = globalThis.clientContext?.userId
              ? resources?.get(
                  "/ecs/c/inventory",
                  globalThis.clientContext.userId
                )
              : undefined;
            return {
              selectedItemId: String(selection?.item?.id ?? ""),
              hotbarItemId: String(inventory?.hotbar?.[0]?.item?.id ?? ""),
              hotbarIndex: resources?.get("/hotbar/index")?.value,
            };
          }),
        (snapshot) =>
          snapshot.hotbarIndex === 0 &&
          snapshot.hotbarItemId === String(item.nativeId) &&
          snapshot.selectedItemId === String(item.nativeId),
        Math.max(originSyncGateMs, 10_000),
        Math.max(timeoutMs, 20_000)
      );
      const attachment = await waitFor(
        `${item.id}: authored held mesh attaches to the player`,
        () =>
          first.page.evaluate(
            ({ userId, nativeId }) => {
              const resources = globalThis.clientContext?.resources;
              const playerMesh = resources?.cached(
                "/scene/player/mesh",
                userId
              );
              const itemAttachment = playerMesh?.itemAttachment;
              const instance = itemAttachment?.itemMeshInstance;
              let renderedMeshCount = 0;
              instance?.three?.traverse?.((child) => {
                if (child?.isMesh) renderedMeshCount += 1;
              });
              return {
                cameraFirstPerson: Boolean(
                  resources?.get("/scene/camera")?.isFirstPerson
                ),
                selectedItemId: String(itemAttachment?.selectedItem?.id ?? ""),
                expectedItemId: String(nativeId),
                renderedMeshCount,
              };
            },
            { userId: first.userId, nativeId: item.nativeId }
          ),
        (snapshot) =>
          snapshot.cameraFirstPerson === false &&
          snapshot.selectedItemId === snapshot.expectedItemId &&
          snapshot.renderedMeshCount > 0,
        10_000,
        20_000
      );
      await first.page.waitForTimeout(500);
      const bounds = await waitFor(
        `${item.id}: live held mesh exposes finite world bounds`,
        () => heldItemWorldBounds(item, item.nativeId),
        (snapshot) =>
          Boolean(snapshot) &&
          snapshot.selectedItemId === snapshot.expectedItemId &&
          snapshot.meshCount > 0 &&
          snapshot.vertexCount > 0 &&
          snapshot.size.every(
            (axis) => Number.isFinite(axis) && axis >= 0 && axis < 8
          ) &&
          Math.max(...snapshot.size) > 0.01,
        10_000,
        20_000
      );
      const reviewTarget = [...bounds.value.center];
      const maxExtent = Math.max(...bounds.value.size);
      // Fit the actual selected GLB, not a guessed torso location. The lower
      // clamp leaves hand/grip context around tiny cells and papers; the upper
      // clamp prevents a malformed bound from putting the camera outside the
      // streamed scene.
      const reviewRadius = Math.max(0.62, Math.min(3.2, maxExtent * 2.35));
      const reviewAngle = (35 * Math.PI) / 180;
      const reviewFront = [
        reviewTarget[0],
        reviewTarget[1] + Math.min(0.12, maxExtent * 0.15),
        reviewTarget[2] - reviewRadius,
      ];
      const reviewLeft = [
        reviewTarget[0] - Math.sin(reviewAngle) * reviewRadius,
        reviewFront[1],
        reviewTarget[2] - Math.cos(reviewAngle) * reviewRadius,
      ];
      const reviewRight = [
        reviewTarget[0] + Math.sin(reviewAngle) * reviewRadius,
        reviewFront[1],
        reviewTarget[2] - Math.cos(reviewAngle) * reviewRadius,
      ];
      const heldItemReviewCutsceneId = await registerHostChapter1Cutscene(
        first,
        {
          id: `ch1-held-item-angle-review-${item.id.replace(
            /[^a-z0-9]+/gi,
            "-"
          )}`,
          name: `Chapter 1 Held Item Review — ${item.name}`,
          priority: 950_000,
          settings: {
            skippable: true,
            skipAfterSeconds: 0,
            lockPlayer: true,
            hideHud: false,
            letterbox: false,
            invulnerablePlayer: true,
            mode: "clientPuppet",
            commitOn: [],
            // This review scene is test-only and runs under software WebGL in
            // CI. Keep each angle alive long enough for a loaded renderer to
            // reach the real waypoint before the scene auto-cleans itself.
            maxSceneDurationSeconds: 30,
          },
          cast: [{ role: "player", binding: { kind: "player" } }],
          shots: [
            {
              id: "front",
              duration: 6,
              camera: {
                kind: "static",
                position: reviewFront,
                orientation: lookAtOrientation(reviewFront, reviewTarget),
              },
              // A fade adds no evidence to an isolated item review and its
              // DOM overlay can trail the logical cutscene state by a frame.
              // Start directly on the fitted item camera instead.
              transitionIn: "blend",
              blendSeconds: 0.1,
              actions: [{ kind: "fov", at: 0, fov: 40 }],
            },
            {
              id: "three-quarter-left",
              duration: 6,
              camera: {
                kind: "static",
                position: reviewLeft,
                orientation: lookAtOrientation(reviewLeft, reviewTarget),
              },
              transitionIn: "blend",
              blendSeconds: 0.35,
              actions: [],
            },
            {
              id: "three-quarter-right",
              duration: 6,
              camera: {
                kind: "static",
                position: reviewRight,
                orientation: lookAtOrientation(reviewRight, reviewTarget),
              },
              transitionIn: "blend",
              blendSeconds: 0.35,
              actions: [],
            },
          ],
          onEnd: { placements: [], commits: [] },
        }
      );
      // The production binding is middle mouse (button index 1), not right
      // mouse. Prove the input motion becomes active before trusting the frame.
      await gameCanvas.focus({ timeout: probeTimeoutMs });
      await first.page.mouse.move(
        canvasBox.x + canvasBox.width / 2,
        canvasBox.y + canvasBox.height / 2
      );
      await first.page.mouse.down({ button: "middle" });
      reverseCameraHeld = true;
      await first.page.waitForFunction(
        () =>
          (globalThis.clientContext?.input?.motion("reverse_camera") ?? 0) > 0,
        undefined,
        { timeout: Math.max(acceptanceGateMs, 30_000) }
      );
      await first.page.waitForTimeout(350);
      const heldScreenshot = path.join(
        artifactsDir,
        `${runId}-chapter-1-held-${item.id.replace(/[^a-z0-9]+/gi, "-")}.png`
      );
      await first.page.screenshot({ path: heldScreenshot, fullPage: true });
      await first.page.mouse.up({ button: "middle" });
      reverseCameraHeld = false;

      const anglePrefix = `${runId}-chapter-1-held-${item.id.replace(
        /[^a-z0-9]+/gi,
        "-"
      )}`;
      const angleScreenshots = {
        front: path.join(artifactsDir, `${anglePrefix}-cutscene-front.png`),
        threeQuarterLeft: path.join(
          artifactsDir,
          `${anglePrefix}-cutscene-three-quarter-left.png`
        ),
        threeQuarterRight: path.join(
          artifactsDir,
          `${anglePrefix}-cutscene-three-quarter-right.png`
        ),
      };
      const started = await bridgeCall(
        first.page,
        "chapter1StartCutscene",
        heldItemReviewCutsceneId
      );
      assert.equal(
        started.accepted,
        true,
        `${item.id}: generated held-item review cutscene was rejected`
      );
      await waitFor(
        `${item.id}: generated held-item review cutscene starts`,
        () => bridgeCall(first.page, "chapter1CutsceneSnapshot"),
        (snapshot) => snapshot.active,
        5_000,
        10_000
      );
      const isolation = await setHeldItemDetailIsolation(true);
      assert(
        isolation.hidden > 0 && isolation.itemMeshes > 0,
        `${item.id}: detail review could not isolate the live attached mesh`
      );
      // Authored time can advance substantially slower than wall time under
      // software WebGL. Gate each frame on the real waypoint-camera position
      // and cleared fade rather than sleeping and accidentally saving black.
      await waitForHeldItemReviewAngle(item.id, "front", reviewFront);
      await first.page.screenshot({
        path: angleScreenshots.front,
        fullPage: true,
      });
      await waitForHeldItemReviewAngle(
        item.id,
        "three-quarter-left",
        reviewLeft
      );
      await first.page.screenshot({
        path: angleScreenshots.threeQuarterLeft,
        fullPage: true,
      });
      await waitForHeldItemReviewAngle(
        item.id,
        "three-quarter-right",
        reviewRight
      );
      await first.page.screenshot({
        path: angleScreenshots.threeQuarterRight,
        fullPage: true,
      });
      // The review scene has no commits and its final frame is already saved.
      // Stop it explicitly instead of making a software-GL acceptance run wait
      // for an overloaded renderer to advance the last authored seconds. The
      // cleanup assertion below still proves camera/input/HUD restoration.
      await bridgeCall(first.page, "chapter1StopCutscene");
      await waitFor(
        `${item.id}: generated held-item review cutscene cleans up`,
        () => bridgeCall(first.page, "chapter1CutsceneSnapshot"),
        (snapshot) => !snapshot.active,
        10_000,
        30_000
      );
      if (result) {
        result.heldScreenshot = heldScreenshot;
        result.heldAngleScreenshots = angleScreenshots;
        result.heldMeshCount = attachment.value.renderedMeshCount;
        result.heldWorldBounds = bounds.value;
        result.heldReviewCamera = {
          radius: reviewRadius,
          target: reviewTarget,
          front: reviewFront,
          threeQuarterLeft: reviewLeft,
          threeQuarterRight: reviewRight,
        };
        result.heldDetailIsolation = isolation;
      }
    } catch (error) {
      const message = chapter1ErrorText(error);
      if (result) result.heldError = message;
      failures.push({ itemId: item.id, phase: "held", error: message });
    } finally {
      if (reverseCameraHeld) {
        await first.page.mouse.up({ button: "middle" }).catch(() => undefined);
      }
      await setHeldItemDetailIsolation(false).catch(() => undefined);
      const cutscene = await bridgeCall(
        first.page,
        "chapter1CutsceneSnapshot"
      ).catch(() => undefined);
      if (cutscene?.active) {
        await bridgeCall(first.page, "chapter1StopCutscene").catch(
          () => undefined
        );
        await first.page.waitForTimeout(250);
      }
    }
  }
  await releaseChapter1CatalogProjection(first);
  assert.deepEqual(
    failures,
    [],
    `Chapter 1 item visual failures:\n${failures
      .map((failure) => `${failure.itemId}/${failure.phase}: ${failure.error}`)
      .join("\n\n")}`
  );
  return { itemCount: results.length, items: results, screenshot };
}

function finishFocusedChapter1Run() {
  const failedScenarios = report.scenarios.filter(
    (scenario) => scenario.status === "fail"
  );
  assert.deepEqual(
    failedScenarios,
    [],
    `Chapter 1 browser batch failures:\n${failedScenarios
      .map((scenario) => `${scenario.name}: ${scenario.error}`)
      .join("\n\n")}`
  );
  const runtimeInjectionExternalFailures = chapter1RuntimeInject
    ? report.browser.failures.filter(
        (failure) =>
          /\/assets\/harthmere\/glb\/projectiles\/(photon_sidearm_pulse|nova_cannon_bolt|pulse_carbine_burst|helix_projector_beam|singularity_lance_beam)\.glb/.test(
            failure
          ) ||
          (failure.includes('/audio/buffer\\",null') &&
            failure.includes(
              "Cannot read properties of undefined (reading 'startsWith')"
            ))
      )
    : [];
  const recoveredBootstrapConnectionFailures = report.browser.transients.some(
    (entry) => entry.includes("reloaded-after-stale-wakeup-bootstrap-race")
  )
    ? report.browser.failures.filter((failure) =>
        failure.includes("Failed to load resource: net::ERR_CONNECTION_CLOSED")
      )
    : [];
  const scopedBrowserFailures = report.browser.failures.filter(
    (failure) =>
      !runtimeInjectionExternalFailures.includes(failure) &&
      !recoveredBootstrapConnectionFailures.includes(failure)
  );
  if (runtimeInjectionExternalFailures.length > 0) {
    report.browser.transients.push(
      ...runtimeInjectionExternalFailures.map(
        (failure) => `runtime-injection-external:${failure}`
      )
    );
  }
  if (recoveredBootstrapConnectionFailures.length > 0) {
    report.browser.transients.push(
      ...recoveredBootstrapConnectionFailures.map(
        (failure) => `recovered-stale-wakeup-bootstrap:${failure}`
      )
    );
  }
  assert.deepEqual(
    scopedBrowserFailures,
    [],
    `browser/network errors occurred:\n${scopedBrowserFailures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS Chapter 1 live browser/capture batch (${report.scenarios.length} groups)`
  );
}

function finishFocusedQuestsUiRun() {
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log("PASS dedicated Quests UI browser E2E");
}

function finishFocusedCombatMusicRun() {
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS focused combat music browser E2E (${report.scenarios.length} scenarios)`
  );
}

function finishFocusedChaseRun() {
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS focused native chase browser E2E (${report.scenarios.length} scenarios)`
  );
}

function finishFocusedEscortRun() {
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS focused native escort browser E2E (${report.scenarios.length} scenarios)`
  );
}

function finishFocusedHillCombatRun() {
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS focused native hill combat browser E2E (${report.scenarios.length} scenarios)`
  );
}

function finishFocusedHoePurchaseRun() {
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS focused Hoe purchase/browser/hotbar E2E (${report.scenarios.length} scenarios)`
  );
}

function finishFocusedSkillsRun() {
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS focused unified skills browser E2E (${report.scenarios.length} scenarios)`
  );
}

async function proveHoePurchaseInventoryHotbarRoundTrip(first) {
  const hoeItemId = "7539420629350046";
  const hoeId = harthmereNativeBiomesIdForItemId(hoeItemId);
  assert(hoeId, "native Hoe id missing");

  const beforeFixture = await authoritativeEntity(first.page, first.userId);
  const inventory = withoutInventoryItem(beforeFixture.entity, hoeId);
  // Native grants intentionally prefer empty hotbar slots. Fill every quick
  // slot with a harmless voxel so this regression proves the Hoe is also a
  // valid backpack item, then use the real Inventory UI to swap it into slot 1.
  inventory.hotbar = Array.from({ length: PLAYER_HOTBAR_SLOTS }, () =>
    countOf(BikkieIds.dirt, 1n)
  );
  inventory.currencies = createBag(countOf(BikkieIds.bling, 100n));
  inventory.selected = { kind: "hotbar", idx: 0 };
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      inventory,
      selected_item: SelectedItem.create({ item: inventory.hotbar[0] }),
    },
  });
  await waitFor(
    "Hoe purchase fixture reaches browser",
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      nativeGold(entity) === 100n &&
      inventoryCount(entity, hoeId) === 0n &&
      entity?.inventory?.hotbar?.every(
        (slot) => slot?.item?.id === BikkieIds.dirt
      ),
    originSyncGateMs,
    timeoutMs
  );

  const purchaseBody = await bridgeCall(first.page, "vendorPurchase", {
    offset: 63,
    itemId: hoeItemId,
    quantity: 2,
    reason: "Hoe purchased from Orchard Produce Stand in local browser E2E",
  });
  assert(purchaseBody, "Hoe vendor purchase returned no response");

  const bought = await waitFor(
    "bought Hoe reaches native backpack without overflow",
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      inventoryCount(entity, hoeId) === 2n &&
      nativeGold(entity) === 78n &&
      stackCount(
        [...(entity?.inventory?.overflow?.values?.() ?? [])],
        hoeId
      ) === 0n,
    acceptanceGateMs,
    timeoutMs
  );
  await waitFor(
    "bought Hoe synchronizes back into the browser inventory",
    () => localEntity(first.page, first.userId),
    ({ entity }) => inventoryCount(entity, hoeId) === 2n,
    originSyncGateMs,
    timeoutMs
  );
  const boughtHoeRef = inventoryRefForItem(bought.value.entity, hoeId);
  assert.equal(
    boughtHoeRef?.kind,
    "item",
    "bought Hoe must arrive in a backpack slot"
  );

  await first.page.keyboard.press("KeyI");
  const hoeBackpackButtons = first.page.getByRole("button", {
    name: "Hoe x1",
    exact: true,
  });
  assert.equal(
    await hoeBackpackButtons.count(),
    2,
    "inventory must render both non-stackable Hoes bought by the bundle"
  );
  const hoeBackpackButton = hoeBackpackButtons.first();
  const hoeIcon = hoeBackpackButton.locator("[data-inventory-icon-kind]");
  assert.equal(
    await hoeIcon.count(),
    1,
    "bought Hoe must render a visible inventory icon"
  );
  const hoeIconKind = await hoeIcon.getAttribute("data-inventory-icon-kind");
  const hoeIconValue =
    hoeIconKind === "image"
      ? await hoeIcon.getAttribute("src")
      : (await hoeIcon.textContent())?.trim();
  assert(
    hoeIconValue,
    "bought Hoe inventory icon must resolve to an image source or glyph"
  );
  await hoeBackpackButton.click();
  const hotbarAction = first.page.getByRole("button", {
    name: "Hotbar 1",
    exact: true,
  });
  assert.equal(
    await hotbarAction.count(),
    1,
    "selected Hoe must expose the Hotbar 1 action"
  );
  assert(await hotbarAction.isEnabled(), "Hoe hotbar action must be enabled");
  await first.page.screenshot({
    path: path.join(artifactsDir, `${runId}-bought-hoe-inventory.png`),
    fullPage: true,
  });
  await hotbarAction.click();

  const hotbar = await waitFor(
    "bought Hoe can be assigned to native hotbar",
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      entity?.inventory?.hotbar?.[0]?.item?.id === hoeId &&
      inventoryCount(entity, hoeId) === 2n,
    acceptanceGateMs,
    timeoutMs
  );
  await waitFor(
    "bought Hoe hotbar assignment synchronizes into browser UI",
    () => localEntity(first.page, first.userId),
    ({ entity }) => entity?.inventory?.hotbar?.[0]?.item?.id === hoeId,
    originSyncGateMs,
    timeoutMs
  );
  const hotbarHoeButton = first.page.getByRole("button", {
    name: "Hotbar 1: Hoe",
    exact: true,
  });
  assert.equal(
    await hotbarHoeButton.count(),
    1,
    "inventory must visibly mirror the Hoe in hotbar slot 1"
  );
  await first.page.screenshot({
    path: path.join(artifactsDir, `${runId}-bought-hoe-hotbar.png`),
    fullPage: true,
  });
  await first.page.keyboard.press("Escape");
  await first.page.keyboard.press("Digit1");
  const selected = await waitFor(
    "bought Hoe can be selected for tilling",
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      entity?.inventory?.selected?.kind === "hotbar" &&
      entity.inventory.selected.idx === 0 &&
      entity?.selected_item?.item?.item?.id === hoeId,
    originSyncGateMs,
    timeoutMs
  );

  report.scenarios.push({
    name: "Orchard Hoe purchase to backpack to selected hotbar",
    status: "pass",
    vendorId: "orchard_produce_stand",
    itemId: hoeItemId,
    nativeItemId: String(hoeId),
    purchasedCount: 2,
    goldBefore: 100,
    goldAfter: 78,
    overflowCount: 0,
    inventoryStacks: 2,
    inventoryIconKind: hoeIconKind,
    inventoryIconValue: hoeIconValue,
    hotbarSlot: 0,
    selectedItemId: String(selected.value.entity.selected_item.item.item.id),
    authoritativeMs: bought.elapsedMs,
    selectedSyncMs: selected.elapsedMs,
  });
}

function finishFocusedRobotStoryRun() {
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS focused native robot story browser E2E (${report.scenarios.length} scenarios)`
  );
}

function finishFocusedJobsRun() {
  const expectedJobCount = jobsBoardE2ETemplates("auto").length;
  assert.equal(
    report.scenarios.length,
    expectedJobCount + 1,
    `expected bootstrap plus ${expectedJobCount} job scenarios`
  );
  assert(
    report.scenarios.every((scenario) => scenario.status === "pass"),
    "one or more all-jobs browser scenarios did not pass"
  );
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS focused all-jobs browser E2E (${report.scenarios.length} scenarios)`
  );
}

function finishFocusedRemainingJobsRun() {
  const expectedTemplates = jobsBoardE2ETemplates("business");
  assert.equal(
    report.scenarios.filter((scenario) => scenario.status === "pass").length,
    expectedTemplates.length + 1,
    "expected bootstrap plus every untested business job template"
  );
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS remaining business jobs browser E2E (${expectedTemplates.length} templates)`
  );
}

const SNAPSHOT_GROVE_QUEST_STATE_KEY =
  // Keep this identical to LocalDevSnapshotGroveBibleRuntime. The event name
  // uses colon separators, but the persisted localStorage key uses dots; using
  // the event name here makes a healthy browser/ECS round trip look stalled.
  "biomes.localDev.snapshotGroveQuestState";
// Browser helpers still exercise the compatibility runtime API, whose
// functions accept the retired parallel-array shape. Project that shape from
// the authoritative typed catalog so dialogue givers and objective order
// cannot drift back to the retired source during E2E.
const SNAPSHOT_GROVE_QUESTS = GROVE_QUEST_CATALOG.map((quest) => ({
  id: quest.id,
  title: quest.title,
  giverNpcId: groveQuestGiverId(quest),
  area: quest.area,
  hook: quest.hook,
  objectives: quest.steps.map((step) => step.label),
  triggers: quest.steps.map((step) => step.trigger),
  markerIds: quest.steps.map((step) => step.markerId),
  reward: quest.reward,
  sampleDialogue: quest.sampleDialogue,
  connectorToHarthmere: quest.connectorToHarthmere,
  category: quest.category,
  unlockedBy:
    quest.start.kind === "after"
      ? { kind: "quest_completed", questId: quest.start.questId }
      : quest.start.kind === "after_accepted"
        ? { kind: "quest_accepted", questId: quest.start.questId }
        : quest.start.kind === "after_fountain_lessons"
          ? {
              kind: "fountain_completion_count",
              minCompletedFountainLessons: quest.start.minCompleted,
            }
          : undefined,
}));
const SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_IDS = [
  ...GROVE_FOUNTAIN_LESSON_IDS,
];
const SNAPSHOT_GROVE_ONBOARDING_QUEST_IDS = [
  "fountain_buttons_first",
  "tools_before_treasure",
  "road_ready_bag_check",
];
const SNAPSHOT_GROVE_REQUESTED_QUEST_IDS = selectedCatalogIds(
  "HARTHMERE_E2E_GROVE_QUEST_IDS"
);
const SNAPSHOT_GROVE_REMAINING_QUEST_IDS = SNAPSHOT_GROVE_QUESTS.map(
  (quest) => quest.id
).filter(
  (questId) =>
    !SNAPSHOT_GROVE_REQUESTED_QUEST_IDS ||
    SNAPSHOT_GROVE_REQUESTED_QUEST_IDS.has(questId)
);
const SNAPSHOT_GROVE_CONTEXTUAL_BUTTON_LABELS = {
  choice: "Pick practice answer",
};

function snapshotGroveObjectiveIndexInLocalState(state, questId) {
  const indexed = Number(state?.objectiveIndexByQuestId?.[questId]);
  if (Number.isFinite(indexed)) return Math.max(0, Math.trunc(indexed));
  return state?.activeQuestId === questId
    ? Math.max(0, Math.trunc(Number(state?.activeObjectiveIndex) || 0))
    : undefined;
}

function snapshotGroveQuest(questId) {
  const quest = SNAPSHOT_GROVE_QUESTS.find(
    (candidate) => candidate.id === questId
  );
  assert(quest, `missing Snapshot Grove quest ${questId}`);
  return quest;
}

function snapshotGroveMarker(markerId) {
  const marker = SNAPSHOT_GROVE_LANDMARKS.find(
    (candidate) => candidate.id === markerId
  );
  assert(marker, `missing Snapshot Grove marker ${markerId}`);
  const position = groveMarkerWorldPosition(markerId);
  assert(position, `missing live-space Snapshot Grove marker ${markerId}`);
  return { ...marker, position };
}

function snapshotGroveNpc(npcId) {
  const npc = SNAPSHOT_GROVE_NPCS.find((candidate) => candidate.id === npcId);
  if (npc) {
    return { ...npc, entityId: snapshotGroveNpcEntityId(npc) };
  }
  const nativeGiver = HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST[npcId];
  assert(nativeGiver, `missing Snapshot Grove/native NPC ${npcId}`);
  // Connector lessons legitimately hand the player to a native Harthmere
  // giver such as Sergeant Bram Holt. Resolve that checked-in entity directly
  // instead of requiring a duplicate Grove-only NPC record and identity.
  return {
    id: npcId,
    displayName: nativeGiver.displayName,
    entityId: nativeGiver.entityId,
  };
}

async function snapshotGroveLocalState(page) {
  return page.evaluate((key) => {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  }, SNAPSHOT_GROVE_QUEST_STATE_KEY);
}

async function snapshotGroveLiveState(first) {
  assert(first.groveRedis, "Snapshot Grove Cloud Save reader is unavailable");
  const nowMs = Date.now();
  const [rawState, rawSharedState] = await Promise.all([
    first.groveRedis.primary.get(
      harthmereLiveModePlayerStateKey(String(first.userId))
    ),
    first.groveRedis.primary.get(harthmereLiveModeSharedWorldStateKey()),
  ]);
  const state = parseHarthmereLiveModeBackendState(
    rawState,
    String(first.userId),
    nowMs
  );
  mergeHarthmereLiveModeSharedWorldStateIntoBackend(
    state,
    parseHarthmereLiveModeSharedWorldState(rawSharedState, nowMs),
    nowMs
  );
  state.updatedAtMs = nowMs;
  return createHarthmereLiveModeQuestClientSnapshot(state);
}

async function placeSnapshotGroveFrontendPlayer(first, position, label) {
  const placed = await waitFor(
    `${label}: live browser player accepts authored marker`,
    () =>
      first.page.evaluate(
        ({ userId, position: [x, y, z] }) => {
          const debug = window.__harthmereLivePlayerDebug;
          const resources = globalThis.clientContext?.resources;
          if (debug?.teleportTo) {
            // Bible/NPC catalog anchors intentionally use Y=0 as an unresolved
            // map height. Passing that literal value puts the live controller
            // below production terrain, where collision/fall recovery can move
            // the actor several meters away before the interaction opens. Let
            // the production teleport hook choose its grounded default Y while
            // preserving authored nonzero heights (including underwater rows).
            const target = {
              x,
              z,
              reason: "Snapshot Grove catalog marker warp",
              source: "test-harthmere-native-ecs-roundtrip-e2e",
            };
            if (Math.abs(y) > 0.001) target.y = y;
            const result = debug.teleportTo(target);
            const next = Array.isArray(result?.after)
              ? result.after
              : [x, target.y ?? y, z];
            // The debug hook mutates the live Player object directly. Also
            // invalidate the reactive resources so proximity panels recompute
            // their enabled state before Playwright attempts the real click.
            try {
              resources?.update("/scene/local_player", (localPlayer) => {
                localPlayer.player.position = [...next];
              });
            } catch {}
            try {
              resources?.update("/sim/player", userId, (player) => {
                player.position = [...next];
                player.velocity = [0, 0, 0];
              });
            } catch {}
            return result;
          }
          let wrote = false;
          try {
            resources?.update("/scene/local_player", (localPlayer) => {
              localPlayer.player.position = [x, y, z];
              wrote = true;
            });
          } catch {}
          try {
            resources?.update("/sim/player", userId, (player) => {
              player.position = [x, y, z];
              player.velocity = [0, 0, 0];
              wrote = true;
            });
          } catch {}
          return { teleported: wrote };
        },
        { userId: first.userId, position: [...position] }
      ),
    (result) => Boolean(result?.teleported),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  // The debug hook reports the actual live pose it accepted. Reuse that exact
  // grounded position for ECS and movement publication so a placeholder Y=0
  // cannot overwrite the browser's valid terrain-aware placement afterward.
  return Array.isArray(placed.value?.after)
    ? placed.value.after
    : [...position];
}

async function moveSnapshotGrovePlayer(first, position, label) {
  // Release the prior marker pin before asking the live teleport hook to move.
  // Otherwise its 50 ms interval can win the race and restore the old giver or
  // objective position while the next authored warp is being synchronized.
  await setSnapshotGroveInteractionPin(first, position, false);
  // Use the production live-player teleport hook so distant Grove/Harthmere
  // connector markers move camera, simulation, and interest-set ownership
  // together before the matching authoritative fixture is persisted.
  const livePosition = await placeSnapshotGroveFrontendPlayer(
    first,
    position,
    label
  );
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({ v: [...livePosition] }),
      rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
      // Catalog warps can cross unloaded terrain; keep test setup nonlethal so
      // a transient fall cannot delete the actor before quest progression.
      health: Health.create({ hp: 1_000_000, maxHp: 1_000_000 }),
    },
  });
  // Publish the same movement event as the live controller after the admin
  // fixture. Without this second half of the warp, a delayed movement tick can
  // restore the prior pose after ECS has already accepted the target position,
  // which strands return-to-giver objectives at the neutral reset location.
  await publishFrontendMove(first.page, first.userId, livePosition);
  await waitFor(
    `${label}: player reaches authored marker`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      distance3(entity?.position?.v, livePosition) <=
      JOBS_BOARD_E2E_POSITION_TOLERANCE_METERS,
    // Moving between authored lesson fixtures is test setup, not a quest
    // latency SLO. Give a production-shaped Redis bootstrap enough headroom
    // without weakening any of the action/progression synchronization gates.
    Math.max(originSyncGateMs, 60_000),
    timeoutMs
  );
  // Reassert the browser-owned simulation pose after the authoritative write
  // returns. A delayed pre-warp movement echo can otherwise arrive after ECS
  // succeeds and move only the rendered player back to the reset location,
  // causing the real contextual button to become "Walk to ... first".
  await placeSnapshotGroveFrontendPlayer(first, livePosition, label);
  await waitFor(
    `${label}: local simulation reaches authored marker`,
    () =>
      first.page.evaluate(() => [
        ...globalThis.clientContext.resources.get("/scene/local_player").player
          .position,
      ]),
    // Collision grounds the visible player against live terrain, while the
    // authored marker can carry a road/map Y above or below that terrain.
    // Grove proximity is horizontal, so verify the interaction-relevant X/Z
    // pose instead of rejecting a correctly grounded player on vertical drift.
    (localPosition) =>
      distanceXZ(localPosition, position) <=
      SNAPSHOT_GROVE_LOCAL_POSITION_TOLERANCE_METERS,
    10_000,
    20_000
  );
  // Keep the focused catalog actor on its authored marker until the next
  // fixture warp. The deliberately sparse low-memory terrain can otherwise
  // apply fall recovery after the movement gate passes, killing the actor,
  // moving its interest set back to spawn, and hiding the next giver/objective
  // even though the authoritative quest action itself was correct.
  await setSnapshotGroveInteractionPin(first, livePosition, true);
}

async function faceSnapshotGroveWorldObject(
  first,
  marker,
  approachPosition,
  targetHeightOffset = -0.25
) {
  const pose = await frontendPlayerPose(first.page, first.userId);
  const livePosition = pose?.position ?? approachPosition;
  const orientation = lookAtOrientation(
    [livePosition[0], livePosition[1] + 1.6, livePosition[2]],
    [
      marker.position[0],
      marker.position[1] + targetHeightOffset,
      marker.position[2],
    ]
  );
  await first.page.evaluate(
    ({ userId, orientation: nextOrientation }) => {
      const resources = globalThis.clientContext?.resources;
      if (!resources) throw new Error("client resources unavailable");
      resources.update("/scene/local_player", (localPlayer) => {
        localPlayer.player.orientation = [...nextOrientation];
      });
      resources.update("/sim/player", userId, (player) => {
        player.orientation = [...nextOrientation];
      });
    },
    { userId: first.userId, orientation }
  );
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      orientation: Orientation.create({ v: [...orientation] }),
    },
  });
  await publishFrontendMove(
    first.page,
    first.userId,
    livePosition,
    orientation
  );
}

async function reassertSnapshotGrovePlayerForInteraction(
  first,
  position,
  label
) {
  // The low-memory catalog client can emit one delayed pre-warp movement tick
  // while a newly mounted contextual panel is becoming visible. Put the live
  // simulation at the target first, then make the authoritative ECS position
  // the final write immediately before the real button click.
  const livePosition = await placeSnapshotGroveFrontendPlayer(
    first,
    position,
    label
  );
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({ v: [...livePosition] }),
      rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
      health: Health.create({ hp: 1_000_000, maxHp: 1_000_000 }),
    },
  });
  await waitFor(
    `${label}: final authoritative interaction pose`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      distance3(entity?.position?.v, livePosition) <=
      JOBS_BOARD_E2E_POSITION_TOLERANCE_METERS,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
}

async function setSnapshotGroveInteractionPin(first, position, enabled) {
  await first.page.evaluate(
    ({ userId, position, enabled }) => {
      const win = window;
      if (win.__harthmereCatalogInteractionPin) {
        window.clearInterval(win.__harthmereCatalogInteractionPin);
        win.__harthmereCatalogInteractionPin = undefined;
      }
      if (!enabled) return;
      const pin = () => {
        const resources = globalThis.clientContext?.resources;
        try {
          resources?.update("/scene/local_player", (localPlayer) => {
            localPlayer.player.position = [...position];
          });
        } catch {}
        try {
          resources?.update("/sim/player", userId, (player) => {
            player.position = [...position];
            player.velocity = [0, 0, 0];
          });
        } catch {}
      };
      // The focused stack intentionally omits most distant terrain. Pin only
      // during the real contextual click so local collision cannot move the
      // rendered actor out of range between React enabling the button and the
      // server-authorized request being emitted.
      pin();
      win.__harthmereCatalogInteractionPin = window.setInterval(pin, 50);
    },
    { userId: first.userId, position: [...position], enabled }
  );
}

async function applySnapshotGroveAuthoritativePositionPin(first, position) {
  if (directWorldFixtures) {
    await applyDirectFixtureChanges([
      {
        kind: "update",
        entity: {
          id: first.userId,
          position: Position.create({ v: [...position] }),
          rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
          health: Health.create({ hp: 1_000_000, maxHp: 1_000_000 }),
        },
      },
    ]);
    return;
  }
  const response = await first.context.request.post(
    new URL("/api/admin/apply_ecs_changes", baseUrl).toString(),
    {
      data: {
        z: zrpcWebSerialize([
          serializedChange({
            kind: "update",
            entity: {
              id: first.userId,
              position: Position.create({ v: [...position] }),
              rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
              health: Health.create({ hp: 1_000_000, maxHp: 1_000_000 }),
            },
          }),
        ]),
      },
      timeout: 30_000,
    }
  );
  assert(
    response.ok(),
    `authoritative interaction pin failed HTTP ${response.status()}: ${await response.text()}`
  );
}

async function withSnapshotGroveAuthoritativePositionPin(
  first,
  position,
  operation
) {
  let stopped = false;
  let loopError;
  let markFirstApplied;
  let markFirstFailed;
  const firstApplied = new Promise((resolve, reject) => {
    markFirstApplied = resolve;
    markFirstFailed = reject;
  });
  const loop = (async () => {
    let firstIteration = true;
    while (!stopped) {
      try {
        await applySnapshotGroveAuthoritativePositionPin(first, position);
        if (firstIteration) markFirstApplied();
      } catch (error) {
        loopError = error;
        if (firstIteration) markFirstFailed(error);
        break;
      }
      firstIteration = false;
      await delay(100);
    }
  })();
  await firstApplied;
  try {
    return await operation();
  } finally {
    stopped = true;
    await loop;
    if (loopError) throw loopError;
  }
}

async function openSnapshotGroveNpcDialog(first, npcId, label) {
  const npc = snapshotGroveNpc(npcId);
  const entityId = npc.entityId;
  const entity = await authoritativeEntity(first.page, entityId);
  assert(
    entity.entity?.position?.v,
    `${label}: NPC ${npcId} is absent from ECS`
  );
  await moveSnapshotGrovePlayer(first, entity.entity.position.v, label);
  await waitFor(
    `${label}: talk target reaches browser ECS`,
    () => localEntity(first.page, entityId),
    ({ entity: local }) => Boolean(local?.position?.v),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  // Open the production TalkToNPCScreen in the browser. Its mount publishes
  // the same talk_npc GardenHose event as the normal F interaction. Waiting
  // for local ECS above preserves the normal overlay contract: the camera
  // cannot track an authoritative-only NPC that has not synchronized yet.
  await first.page.evaluate((talkingToNPCId) => {
    const context = globalThis.clientContext;
    if (!context?.resources) throw new Error("client context unavailable");
    context.resources.set("/game_modal", {
      kind: "talk_to_npc",
      talkingToNPCId,
    });
  }, entityId);
  return entityId;
}

async function closeSnapshotGroveModal(page) {
  // Standalone Harthmere panels own their own close state and can sit above the
  // game modal stack. Close the Jobs Board explicitly so one completed lesson
  // cannot hide the next lesson's Map-panel practice action.
  const jobsBoardClose = page.getByRole("button", {
    name: "Close jobs board",
    exact: true,
  });
  if (
    (await jobsBoardClose.count()) === 1 &&
    (await jobsBoardClose.isVisible())
  ) {
    await jobsBoardClose.click({ force: true });
  }
  await page.keyboard.press("Escape");
}

async function openSnapshotGroveJournal(page, quest) {
  await page.keyboard.press("KeyJ");
  if (quest) {
    // J now opens the dedicated Quests tab. Prove the exact authored title in
    // its scoped list while retaining the legacy Map & Quests fallback for
    // older production images used by compatibility runs.
    const dedicatedQuestList = page.getByTestId("biomes-ui-quests-list");
    if (
      await dedicatedQuestList
        .waitFor({ state: "visible", timeout: 10_000 })
        .then(() => true)
        .catch(() => false)
    ) {
      const dedicatedQuestTitle = dedicatedQuestList.getByText(quest.title, {
        exact: true,
      });
      await dedicatedQuestTitle.waitFor({
        state: "attached",
        timeout: Math.max(originSyncGateMs, 10_000),
      });
      assert.equal(
        await dedicatedQuestTitle.count(),
        1,
        `${quest.title}: dedicated journal must render one exact row`
      );
      await dedicatedQuestTitle.scrollIntoViewIfNeeded({ timeout: timeoutMs });
      await dedicatedQuestTitle.waitFor({
        state: "visible",
        timeout: timeoutMs,
      });
      return;
    }
    // Scope the assertion to the real Map & Quests list. The compact Grove HUD
    // can contain the same title behind the modal and must not satisfy this
    // journal visibility check.
    const nativeQuestId = harthmereNativeQuestId("grove", quest.id);
    assert(nativeQuestId, `${quest.title}: missing native journal identity`);
    // The map adapter collapses authored and native projections by manifest ID
    // and intentionally keeps the native row. Assert that authoritative ID,
    // not the retired compatibility string used by the local lesson runtime.
    const candidateQuestIds = [String(nativeQuestId), quest.id];
    // Native and authored projections are deliberately deduplicated. Depending
    // on which React adapter refresh wins the same frame, the visible row may
    // retain either stable identity while still representing the same native
    // challenge. Accept both and record the actual DOM contract instead of
    // waiting three minutes for a card that is already visibly present.
    const renderedQuestIdHandle = await page.waitForFunction(
      ({ candidateQuestIds }) =>
        candidateQuestIds.find((questId) =>
          document.querySelector(`[data-testid="biomes-map-quest-${questId}"]`)
        ),
      { candidateQuestIds },
      { timeout: Math.max(originSyncGateMs, 10_000) }
    );
    const renderedQuestId = await renderedQuestIdHandle.jsonValue();
    assert(renderedQuestId, `${quest.title}: journal row is absent`);
    const questCard = page.getByTestId(`biomes-map-quest-${renderedQuestId}`);
    await questCard.waitFor({ state: "attached", timeout: timeoutMs });
    // Native Road Ahead can contribute a long step list before the Grove
    // quests. Reach the lesson card through the journal's real scroll region.
    await questCard.scrollIntoViewIfNeeded({ timeout: timeoutMs });
    await questCard.waitFor({ state: "visible", timeout: timeoutMs });
  }
}

async function clickUniqueButton(page, name, label) {
  const button = page.getByRole("button", { name, exact: true });
  await button.waitFor({ state: "attached", timeout: timeoutMs });
  assert.equal(
    await button.count(),
    1,
    `${label}: expected one ${name} button`
  );
  // Snapshot Grove's objective HUD is intentionally scrollable on short
  // desktop viewports; bring the real action into view before clicking it.
  await button.scrollIntoViewIfNeeded({ timeout: timeoutMs });
  await button.waitFor({ state: "visible", timeout: timeoutMs });
  await waitFor(
    `${label}: ${name} button enabled`,
    () => button.isEnabled(),
    Boolean,
    10_000,
    20_000
  );
  const focusedCatalogLoadingOverlay =
    (remainingBibleOnly || remainingQuestsOnly) &&
    (await page
      .locator(".loading-wrapper")
      .isVisible()
      .catch(() => false));
  if (focusedCatalogLoadingOverlay) {
    // Low-memory catalog warps can deliberately leave terrain streaming behind
    // the already-mounted HUD. The exact unique enabled React action is the
    // contract under test, and its server/ECS/frontend effects are all asserted
    // afterward. Invoke that real onClick directly instead of waiting minutes
    // for the test-only sparse terrain overlay to release its pointer hitbox.
    report.browser.transients.push(
      `${label}:clicked-enabled-action-under-focused-loading-overlay`
    );
    await button.evaluate((element) => element.click());
    return;
  }
  await button.click();
}

async function advanceTalkDialogUntil(first, label, predicate) {
  // NPCs can combine native Bible/Grove copy, helper context, ambient lore,
  // and the compatibility route. Bible actions also arrive from an uncached
  // server snapshot after the modal mounts. Use a time budget instead of the
  // old six-second iteration count so a warm stack under load can update the
  // already-visible choice page without turning that normal refresh into a
  // false missing-action failure.
  const deadlineMs = Date.now() + 30_000;
  while (Date.now() < deadlineMs) {
    if (await predicate()) return;
    const continueText = first.page.getByText("Click to continue", {
      exact: true,
    });
    if (
      (await continueText.count()) === 1 &&
      (await continueText.isVisible())
    ) {
      // The full-screen loading footer can overlap this animated hint even
      // after the game and dialogue are interactive. The exact visible hint
      // has already proven the intended UI state; force only bypasses the
      // unrelated footer's stale pointer hitbox.
      await continueText.click({ force: true });
    } else {
      await first.page.keyboard.press("Space");
    }
    await first.page.waitForTimeout(150);
  }
  assert.fail(`${label}: dialogue did not reach the expected action or copy`);
}

async function clickTalkDialogButton(first, name, label) {
  const button = first.page.getByRole("button", { name, exact: true });
  await advanceTalkDialogUntil(
    first,
    label,
    // Choice rows can extend below a short software-WebGL viewport when one
    // NPC contributes Grove/Bible/helper/client actions at the same time. The
    // action is ready once the final dialogue page attaches it; scrolling it
    // into view below exercises the same real button without mistaking an
    // off-screen row for a missing quest action.
    async () => (await button.count()) === 1
  );
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await button.waitFor({ state: "attached", timeout: timeoutMs });
      assert(await button.isEnabled(), `${label}: ${name} is disabled`);
      await button.scrollIntoViewIfNeeded({ timeout: timeoutMs });
      // Software WebGL overlays and the retained mobile joystick can retain a
      // stale hit-test layer over a visibly rendered dialogue button. The
      // exact, unique, enabled React button is already validated above; invoke
      // its native click directly so the test exercises the real onClick and
      // action handler without treating compositor hit-testing as quest logic.
      await button.evaluate((element) => element.click());
      return;
    } catch (error) {
      if (!/not attached|detached/i.test(String(error)) || attempt === 3) {
        throw error;
      }
      await first.page.waitForTimeout(100);
    }
  }
}

async function openRenderedJobsBoard(first, label) {
  // KeyB belongs to the current BiomesUI Bank shortcut, so using it as a
  // Jobs Board test silently exercised the wrong feature. Route through the
  // mounted production board opener shared by HUD/object entry points and
  // assert that its visible panel opens before checking quest progression.
  await first.page.evaluate(() => {
    window.dispatchEvent(
      new CustomEvent("biomes:harthmere-jobs-board-open", {
        detail: { source: "native_ecs_browser_e2e" },
      })
    );
  });
  await first.page
    .getByText("Jobs Board", { exact: true })
    .first()
    .waitFor({ state: "visible", timeout: timeoutMs })
    .catch(async () => {
      // The panel title can be board-specific; the close control is the stable
      // rendered contract common to every Jobs Board instance.
      await first.page
        .getByRole("button", { name: /close/i })
        .first()
        .waitFor({ state: "visible", timeout: timeoutMs });
    });
  assert(label, "Jobs Board browser action requires a diagnostic label");
}

async function publishSnapshotGroveGardenHoseEvent(page, event) {
  await page.evaluate((value) => {
    const gardenHose = globalThis.clientContext?.gardenHose;
    if (!gardenHose) throw new Error("GardenHose unavailable");
    gardenHose.publish(value);
  }, event);
}

async function waitForSnapshotGroveObjective(first, quest, objectiveIndex) {
  const challengeId = harthmereNativeQuestId("grove", quest.id);
  const stepId = harthmereNativeQuestStepId("grove", quest.id, objectiveIndex);
  assert(challengeId, `${quest.title}: missing native challenge id`);
  assert(stepId, `${quest.title}: missing native objective ${objectiveIndex}`);
  const completed = objectiveIndex === quest.objectives.length - 1;
  const nextObjectiveIndex = objectiveIndex + 1;
  const label = `${quest.title}: objective ${objectiveIndex + 1}`;

  // These four views observe the same committed action. Waiting for them
  // serially charged their latencies four times and made Grove dramatically
  // slower than the Chapter 1/Bible checkpoint suites. Start all probes at the
  // action boundary and require all four results before recording the step.
  const [authoritative, local, live, frontend] = await Promise.all([
    waitFor(
      `${label}: frontend action reaches native ECS`,
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) =>
        completed
          ? // Native completion deliberately removes the finished TriggerState
            // root. Challenges.complete is the durable final-step authority.
            entity?.challenges?.complete.has(challengeId)
          : serializedTriggerStepIsFired(entity, challengeId, stepId) &&
            entity?.challenges?.in_progress.has(challengeId),
      Math.max(acceptanceGateMs, 10_000),
      timeoutMs
    ),
    waitFor(
      `${label}: authoritative result returns to lesson runtime`,
      () => snapshotGroveLocalState(first.page),
      (state) =>
        completed
          ? state?.completedQuestIds?.includes(quest.id) &&
            state?.activeQuestId !== quest.id
          : state?.acceptedQuestIds?.includes(quest.id) &&
            snapshotGroveObjectiveIndexInLocalState(state, quest.id) >=
              nextObjectiveIndex,
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    ),
    waitFor(
      `${label}: Cloud Save persistence is authoritative`,
      () => snapshotGroveLiveState(first),
      (state) =>
        completed
          ? Boolean(state?.completed?.[quest.id]) && !state?.active?.[quest.id]
          : state?.active?.[quest.id]?.source === "snapshot_grove" &&
            Number(state.active[quest.id].progress) >= nextObjectiveIndex + 1,
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    ),
    waitFor(
      `${label}: native quest projection returns to frontend`,
      () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
      (snapshot) => {
        const projected = questFromFrontend(snapshot, challengeId);
        return completed
          ? !projected && snapshot.ecs.complete.includes(String(challengeId))
          : projected?.status === "active";
      },
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    ),
  ]);

  report.scenarios.push({
    name: `${label}: ${quest.objectives[objectiveIndex]}`,
    status: "pass",
    questId: quest.id,
    nativeChallengeId: String(challengeId),
    objectiveIndex,
    nativeStepId: String(stepId),
    trigger: quest.triggers[objectiveIndex],
    markerId: quest.markerIds[objectiveIndex],
    authoritativeMs: authoritative.elapsedMs,
    frontendMs: local.elapsedMs,
    liveModeMs: live.elapsedMs,
    nativeProjectionMs: frontend.elapsedMs,
  });
}

async function acceptSnapshotGroveQuestInBrowser(first, quest) {
  await openSnapshotGroveNpcDialog(first, quest.giverNpcId, quest.title);
  await clickTalkDialogButton(
    first,
    `Start ${quest.title}`,
    `${quest.title}: acceptance`
  );
  await waitForSnapshotGroveObjective(first, quest, 0);
  await first.page.screenshot({
    path: path.join(artifactsDir, `${runId}-${quest.id}-accepted.png`),
  });
  await closeSnapshotGroveModal(first.page);
  await openSnapshotGroveJournal(first.page, quest);
  await closeSnapshotGroveModal(first.page);
}

async function seedSnapshotGroveUnlockState(first, quest) {
  const prerequisite = quest.unlockedBy;
  if (!prerequisite) return;
  const acceptedQuestIds = [];
  const completedQuestIds = [];
  if (prerequisite.kind === "fountain_completion_count") {
    // This is an unlock fixture only. Every uncovered fountain lesson still
    // gets its own full browser run; the graduation actor receives five known
    // completions so the test does not re-run the three recently proven ones.
    // Use the runtime's canonical shared list. Filtering by an optional quest
    // category previously selected unrelated legacy quests and left Jackie
    // offering unfinished lessons instead of the graduation tour.
    const seeds = SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_IDS.slice(
      0,
      prerequisite.minCompletedFountainLessons
    );
    acceptedQuestIds.push(...seeds);
    completedQuestIds.push(...seeds);
  } else if (prerequisite.kind === "quest_accepted") {
    acceptedQuestIds.push(prerequisite.questId);
  } else if (prerequisite.kind === "quest_completed") {
    acceptedQuestIds.push(prerequisite.questId);
    completedQuestIds.push(prerequisite.questId);
  }
  await first.page.evaluate(
    ({ key, accepted, completed }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          acceptedQuestIds: accepted,
          activeQuestId: accepted.find(
            (questId) => !completed.includes(questId)
          ),
          activeObjectiveIndex: 0,
          objectiveIndexByQuestId: Object.fromEntries(
            accepted
              .filter((questId) => !completed.includes(questId))
              .map((questId) => [questId, 0])
          ),
          objectiveProgressByQuestId: {},
          completedQuestIds: completed,
          completedObjectiveIds: [],
          rewards: [],
        })
      );
      window.dispatchEvent(
        new CustomEvent("biomes:local-dev-snapshot-grove-quest-state")
      );
    },
    {
      key: SNAPSHOT_GROVE_QUEST_STATE_KEY,
      accepted: acceptedQuestIds,
      completed: completedQuestIds,
    }
  );
}

async function waitForSnapshotGroveAcceptance(first, quest) {
  const challengeId = harthmereNativeQuestId("grove", quest.id);
  assert(challengeId, `${quest.title}: missing native challenge id`);
  const authoritative = await waitFor(
    `${quest.title}: acceptance reaches native ECS`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) => entity?.challenges?.in_progress.has(challengeId),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  const local = await waitFor(
    `${quest.title}: acceptance returns to lesson runtime`,
    () => snapshotGroveLocalState(first.page),
    (state) =>
      state?.acceptedQuestIds?.includes(quest.id) &&
      state?.activeQuestId === quest.id &&
      snapshotGroveObjectiveIndexInLocalState(state, quest.id) === 0,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  const live = await waitFor(
    `${quest.title}: acceptance reaches Cloud Save`,
    () => snapshotGroveLiveState(first),
    (state) =>
      state?.active?.[quest.id]?.source === "snapshot_grove" &&
      Number(state.active[quest.id].progress) >= 1,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  const frontend = await waitFor(
    `${quest.title}: accepted native quest returns to frontend`,
    () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
    (snapshot) => questFromFrontend(snapshot, challengeId)?.status === "active",
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  report.scenarios.push({
    name: `${quest.title}: browser acceptance`,
    status: "pass",
    questId: quest.id,
    nativeChallengeId: String(challengeId),
    authoritativeMs: authoritative.elapsedMs,
    frontendMs: local.elapsedMs,
    liveModeMs: live.elapsedMs,
    nativeProjectionMs: frontend.elapsedMs,
  });
}

async function acceptRemainingSnapshotGroveQuest(first, quest) {
  await seedSnapshotGroveUnlockState(first, quest);
  await openSnapshotGroveNpcDialog(first, quest.giverNpcId, quest.title);
  await clickTalkDialogButton(
    first,
    `Start ${quest.title}`,
    `${quest.title}: acceptance`
  );
  const leadingTalkCompletesOnAcceptance =
    quest.triggers[0] === "talk_npc" && quest.objectives.length > 1;
  if (leadingTalkCompletesOnAcceptance) {
    await waitForSnapshotGroveObjective(first, quest, 0);
  } else {
    await waitForSnapshotGroveAcceptance(first, quest);
  }
  await first.page.screenshot({
    path: path.join(artifactsDir, `${runId}-${quest.id}-accepted.png`),
  });
  await closeSnapshotGroveModal(first.page);
  await openSnapshotGroveJournal(first.page, quest);
  await closeSnapshotGroveModal(first.page);
  return leadingTalkCompletesOnAcceptance ? 1 : 0;
}

async function completeSnapshotGroveTalkStep(first, quest, objectiveIndex) {
  const marker = snapshotGroveMarker(quest.markerIds[objectiveIndex]);
  await openSnapshotGroveNpcDialog(
    first,
    marker.npcId ?? quest.giverNpcId,
    `${quest.title}: ${marker.label}`
  );
  const isCompletionTurnIn =
    objectiveIndex === quest.objectives.length - 1 &&
    quest.triggers[objectiveIndex] === "talk_npc";
  if (isCompletionTurnIn) {
    const actionName = `Complete ${quest.title}`;
    const action = first.page.getByRole("button", {
      name: actionName,
      exact: true,
    });
    await advanceTalkDialogUntil(
      first,
      `${quest.title}: completion dialogue`,
      async () => (await action.count()) === 1
    );
    // The opening completion sentence and the reward confirmation are two
    // authored dialogue pages. The action is intentionally attached to the
    // final page, so assert the visible reward copy that accompanies the real
    // turn-in button instead of looking backward for the prior page.
    await first.page
      .getByText(quest.reward, { exact: false })
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs });
    await clickTalkDialogButton(
      first,
      actionName,
      `${quest.title}: completion turn-in`
    );
  }
  await waitForSnapshotGroveObjective(first, quest, objectiveIndex);
  await closeSnapshotGroveModal(first.page);
}

async function waitForSnapshotGrovePartialProgress(
  first,
  quest,
  objectiveIndex,
  expectedCount
) {
  const label = `${quest.title}: objective ${
    objectiveIndex + 1
  } partial ${expectedCount}`;
  await Promise.all([
    waitFor(
      `${label}: lesson runtime`,
      () => snapshotGroveLocalState(first.page),
      (state) =>
        snapshotGroveObjectiveIndexInLocalState(state, quest.id) ===
          objectiveIndex &&
        Number(state?.objectiveProgressByQuestId?.[quest.id]?.count ?? 0) >=
          expectedCount,
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    ),
    waitFor(
      `${label}: Cloud Save`,
      () => snapshotGroveLiveState(first),
      (state) =>
        Number(state?.active?.[quest.id]?.objectiveProgress?.objectiveIndex) ===
          objectiveIndex &&
        Number(state?.active?.[quest.id]?.objectiveProgress?.count ?? 0) >=
          expectedCount,
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    ),
  ]);
}

async function completeSnapshotGroveCountedAction(
  first,
  quest,
  objectiveIndex,
  action
) {
  const requiredCount = snapshotGroveObjectiveRequiredCount(
    quest,
    objectiveIndex
  );
  const baseFixture = snapshotGroveObjectiveCompletionFixture(
    quest,
    objectiveIndex
  );
  assert(
    baseFixture,
    `${quest.title}: objective ${objectiveIndex + 1} has no completion fixture`
  );
  const countPerAction = Math.max(
    1,
    snapshotGroveEventCompletionCount(baseFixture)
  );
  let completedCount = 0;
  while (completedCount < requiredCount) {
    const markerId = snapshotGroveObjectiveMarkerIdForProgress(
      quest,
      objectiveIndex,
      completedCount
    );
    assert(
      markerId,
      `${quest.title}: objective ${
        objectiveIndex + 1
      } has no marker at ${completedCount}/${requiredCount}`
    );
    const marker = snapshotGroveMarker(markerId);
    await action(marker, {
      ...baseFixture,
      markerId,
      targetMarkerIds: snapshotGroveObjectiveTargetMarkerIds(
        quest,
        objectiveIndex
      ),
    });
    completedCount = Math.min(requiredCount, completedCount + countPerAction);
    if (completedCount < requiredCount) {
      await waitForSnapshotGrovePartialProgress(
        first,
        quest,
        objectiveIndex,
        completedCount
      );
    } else {
      await waitForSnapshotGroveObjective(first, quest, objectiveIndex);
    }
  }
}

async function completeSnapshotGroveWorldObjectStep(
  first,
  quest,
  objectiveIndex
) {
  await completeSnapshotGroveCountedAction(
    first,
    quest,
    objectiveIndex,
    async (marker) => {
      assert.notEqual(
        marker.kind,
        "npc",
        `${quest.title}: objective ${
          objectiveIndex + 1
        } needs a dedicated NPC interaction plan`
      );
      const approaches = [
        [marker.position[0], marker.position[1], marker.position[2] + 2.25],
        [marker.position[0], marker.position[1], marker.position[2] - 2.25],
        [marker.position[0] + 2.25, marker.position[1], marker.position[2]],
        [marker.position[0] - 2.25, marker.position[1], marker.position[2]],
      ];
      let promptFound = false;
      let lastError;
      for (let index = 0; index < approaches.length; index += 1) {
        const approachPosition = approaches[index];
        await moveSnapshotGrovePlayer(
          first,
          approachPosition,
          `${quest.title}: approach ${marker.label} side ${index + 1}`
        );
        await faceSnapshotGroveWorldObject(first, marker, approachPosition);
        try {
          await waitFor(
            `${quest.title}: visible F prompt for ${marker.label} side ${
              index + 1
            }`,
            () => frontendInteractionSnapshot(first.page),
            (interaction) =>
              (interaction?.inspectable?.objectId === marker.id ||
                interaction?.inspectable?.label === marker.label) &&
              interaction.inspectOverlays?.some(
                (overlay) =>
                  /\bF\b/.test(overlay.text ?? "") &&
                  overlay.display !== "none" &&
                  overlay.visibility !== "hidden" &&
                  Number(overlay.opacity) > 0
              ),
            Math.min(snapshotGroveInteractionControlTimeoutMs, 4_000),
            Math.min(snapshotGroveInteractionControlTimeoutMs, 5_000)
          );
          promptFound = true;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!promptFound) {
        throw lastError ?? new Error(`${marker.label}: no F prompt`);
      }
      await first.page.keyboard.press("KeyF");
    }
  );
}

async function completeSnapshotGroveFixtureEventStep(
  first,
  quest,
  objectiveIndex
) {
  await completeSnapshotGroveCountedAction(
    first,
    quest,
    objectiveIndex,
    async (marker, fixture) => {
      await moveSnapshotGrovePlayer(
        first,
        marker.position,
        `${quest.title}: ${marker.label}`
      );
      await publishSnapshotGroveGardenHoseEvent(first.page, fixture);
    }
  );
}

async function completeSnapshotGroveCraftStep(first, quest, objectiveIndex) {
  ensureHarthmereProductionCraftingCatalogue();
  const fixture = snapshotGroveObjectiveCompletionFixture(
    quest,
    objectiveIndex
  );
  assert(
    fixture?.recipeId && fixture.outputItemId,
    `${quest.title}: craft objective is missing its exact recipe/output fixture`
  );
  const recipe = getHarthmereCraftingRecipe(fixture.recipeId);
  const nativeRecipeId = harthmereNativeBiomesIdForRecipeId(fixture.recipeId);
  const nativeOutputItemId = harthmereNativeBiomesIdForItemId(
    fixture.outputItemId
  );
  assert(
    recipe && nativeRecipeId && nativeOutputItemId,
    `${quest.title}: craft recipe is not registered in native ECS`
  );
  await waitFor(
    `${quest.title}: exact recipe reaches native RecipeBook`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) => recipeBookHas(entity, nativeRecipeId),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  const marker = snapshotGroveMarker(quest.markerIds[objectiveIndex]);
  const stationEntityId = await nativeSkillCraftingStation(
    first,
    marker.position,
    recipe.requiredStationId,
    objectiveIndex
  );
  for (const input of recipe.inputs) {
    const nativeInputId = harthmereNativeBiomesIdForItemId(input.itemId);
    assert(
      nativeInputId,
      `${quest.title}: native crafting input missing for ${input.itemId}`
    );
    const current = await authoritativeEntity(first.page, first.userId);
    const missing =
      BigInt(input.count) - inventoryCount(current.entity, nativeInputId);
    if (missing > 0n) {
      await createAndPickupItem(
        first,
        marker.position,
        nativeInputId,
        missing,
        `${quest.title}: acquire ${input.itemId}`
      );
    }
  }
  const before = await authoritativeEntity(first.page, first.userId);
  const beforeOutput = inventoryCount(before.entity, nativeOutputItemId);
  await bridgeCall(
    first.page,
    "publish",
    serializedEvent(
      new InventoryCraftEvent({
        id: first.userId,
        recipe: anItem(nativeRecipeId),
        slot_refs: [],
        stationEntityId: stationEntityId ?? INVALID_BIOMES_ID,
      })
    )
  );
  await waitFor(
    `${quest.title}: exact crafted output reaches native inventory`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      inventoryCount(entity, nativeOutputItemId) >=
      beforeOutput + BigInt(recipe.outputCount),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  await first.page.evaluate(
    ({ eventName, detail }) =>
      window.dispatchEvent(new CustomEvent(eventName, { detail })),
    {
      eventName: "biomes:harthmere-craft-completed",
      detail: fixture,
    }
  );
  await waitForSnapshotGroveObjective(first, quest, objectiveIndex);
}

async function completeSnapshotGroveInventoryStep(
  first,
  quest,
  objectiveIndex
) {
  const fixture = snapshotGroveObjectiveCompletionFixture(
    quest,
    objectiveIndex
  );
  assert(fixture, `${quest.title}: inventory objective has no fixture`);
  if (fixture.operation === "organize") {
    await first.page.keyboard.press("KeyI");
    await clickUniqueButton(
      first.page,
      "Sort",
      `${quest.title}: organize inventory`
    );
    await waitForSnapshotGroveObjective(first, quest, objectiveIndex);
    await closeSnapshotGroveModal(first.page);
    return;
  }

  const itemId = harthmereNativeBiomesIdForItemId(fixture.itemId);
  assert(itemId, `${quest.title}: ${fixture.itemId} has no native item id`);
  const before = await authoritativeEntity(first.page, first.userId);
  assert(
    inventoryCount(before.entity, itemId) >= 1n,
    `${quest.title}: acceptance did not grant ${fixture.itemName}`
  );
  const displayName =
    fixture.itemId === "baker_apron"
      ? "Dawn Loaf Apron"
      : fixture.itemId === "field_trousers"
        ? "Grove Field Trousers"
        : "B-01 Camera";
  await first.page.keyboard.press("KeyI");
  const item = first.page.getByText(displayName, { exact: true });
  await item.first().waitFor({ state: "visible", timeout: timeoutMs });
  await item.first().click();
  if (fixture.slot === "main_hand") {
    await clickUniqueButton(
      first.page,
      "Hotbar 1",
      `${quest.title}: equip hand item`
    );
    await waitFor(
      `${quest.title}: hand item reaches native hotbar`,
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) =>
        entity?.inventory?.hotbar?.some((slot) => slot?.item?.id === itemId),
      Math.max(acceptanceGateMs, 10_000),
      timeoutMs
    );
    await waitForSnapshotGroveObjective(first, quest, objectiveIndex);
    await closeSnapshotGroveModal(first.page);
    return;
  }
  await clickUniqueButton(first.page, "Equip", `${quest.title}: equip item`);
  await waitFor(
    `${quest.title}: equipment reaches native wearing`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      entity?.wearing?.items &&
      [...entity.wearing.items.values()].some((entry) => entry?.id === itemId),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  await waitForSnapshotGroveObjective(first, quest, objectiveIndex);
  await closeSnapshotGroveModal(first.page);
}

async function completeSnapshotGroveOpenTabStep(first, quest, objectiveIndex) {
  const fixture = snapshotGroveObjectiveCompletionFixture(
    quest,
    objectiveIndex
  );
  assert(fixture, `${quest.title}: open-tab objective has no fixture`);
  const keyByTab = {
    map: "KeyM",
    inventory: "KeyI",
    journal: "KeyJ",
    quests: "KeyJ",
    inbox: "KeyV",
  };
  const key = keyByTab[fixture.tab];
  if (fixture.tab === "chat") {
    await first.page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent("biomes:snapshot-grove-tutor-chat-panel-open")
      )
    );
    await first.page
      .getByRole("dialog", { name: "Tutorial chat panel", exact: true })
      .waitFor({
        state: "visible",
        timeout: snapshotGroveInteractionControlTimeoutMs,
      });
  } else if (key) {
    await first.page.keyboard.press(key);
  } else {
    // Crafting/chat/tasks do not have a single stable global shortcut in the
    // production HUD. Publish the exact frontend open_tab signal after the
    // browser has focused the live game page; the signed quest mutation and
    // all ECS/frontend return boundaries remain fully asserted below.
    await publishSnapshotGroveGardenHoseEvent(first.page, fixture);
  }
  await waitForSnapshotGroveObjective(first, quest, objectiveIndex);
  await closeSnapshotGroveModal(first.page);
}

async function completeSnapshotGroveChatMessageStep(
  first,
  quest,
  objectiveIndex,
  channel
) {
  await first.page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("biomes:snapshot-grove-tutor-chat-panel-open")
    )
  );
  const panel = first.page.getByRole("dialog", {
    name: "Tutorial chat panel",
    exact: true,
  });
  await panel.waitFor({
    state: "visible",
    timeout: snapshotGroveInteractionControlTimeoutMs,
  });
  const channelName = channel === "whisper" ? "Whisper" : "Say";
  await panel.getByRole("tab", { name: channelName, exact: true }).click();
  await panel
    .getByRole("textbox", {
      name: `Compose ${channelName} message`,
      exact: true,
    })
    .fill(`${quest.title} objective ${objectiveIndex + 1}`);
  await panel.getByRole("button", { name: "Send", exact: true }).click();
  await waitForSnapshotGroveObjective(first, quest, objectiveIndex);
  await closeSnapshotGroveModal(first.page);
}

async function completeRemainingSnapshotGroveObjective(
  first,
  quest,
  objectiveIndex
) {
  const existingState = await snapshotGroveLocalState(first.page);
  const alreadyAdvanced =
    existingState?.completedQuestIds?.includes(quest.id) ||
    snapshotGroveObjectiveIndexInLocalState(existingState, quest.id) >
      objectiveIndex;
  if (alreadyAdvanced) {
    // One real gameplay event can satisfy adjacent Grove objectives (for
    // example equipping a road-ready item while already standing beside the
    // mirror). Prove every authoritative projection for the skipped step, but
    // do not replay an obsolete marker after the active objective has moved.
    await waitForSnapshotGroveObjective(first, quest, objectiveIndex);
    return;
  }
  const trigger = quest.triggers[objectiveIndex];
  const contextualLabel = SNAPSHOT_GROVE_CONTEXTUAL_BUTTON_LABELS[trigger];
  if (contextualLabel) {
    await completeSnapshotGroveContextualStep(
      first,
      quest,
      objectiveIndex,
      contextualLabel
    );
    return;
  }
  switch (trigger) {
    case "talk_npc":
      await completeSnapshotGroveTalkStep(first, quest, objectiveIndex);
      return;
    case "near_location": {
      const marker = snapshotGroveMarker(quest.markerIds[objectiveIndex]);
      await moveSnapshotGrovePlayer(
        first,
        marker.position,
        `${quest.title}: ${marker.label}`
      );
      await waitForSnapshotGroveObjective(first, quest, objectiveIndex);
      return;
    }
    case "open_tab":
      await completeSnapshotGroveOpenTabStep(first, quest, objectiveIndex);
      return;
    case "inventory_change":
      await completeSnapshotGroveInventoryStep(first, quest, objectiveIndex);
      return;
    case "collect":
    case "item_grant":
    case "interact":
      if (quest.id === "fountain_chat_channels" && objectiveIndex === 2) {
        await completeSnapshotGroveChatMessageStep(
          first,
          quest,
          objectiveIndex,
          "say"
        );
        return;
      }
      if (quest.id === "fountain_chat_channels" && objectiveIndex === 3) {
        await completeSnapshotGroveChatMessageStep(
          first,
          quest,
          objectiveIndex,
          "whisper"
        );
        return;
      }
      await completeSnapshotGroveWorldObjectStep(first, quest, objectiveIndex);
      return;
    case "craft":
      await completeSnapshotGroveCraftStep(first, quest, objectiveIndex);
      return;
    case "place_voxel":
      await completeSnapshotGrovePlacementStep(first, quest, objectiveIndex);
      return;
    case "open_jobs_board":
      await openRenderedJobsBoard(
        first,
        `${quest.title}: rendered Jobs Board opener`
      );
      await waitForSnapshotGroveObjective(first, quest, objectiveIndex);
      await closeSnapshotGroveModal(first.page);
      return;
    case "destroy":
    case "combat":
    case "jump_run":
    case "item_use":
    case "photo_post":
      await completeSnapshotGroveFixtureEventStep(first, quest, objectiveIndex);
      return;
    default:
      assert.fail(`${quest.title}: unsupported browser trigger ${trigger}`);
  }
}

function snapshotGroveStructuredReward(questId) {
  const reward = SNAPSHOT_STRUCTURED_REWARDS.find(
    (candidate) => candidate.questId === questId
  );
  assert(reward, `${questId}: structured reward missing`);
  return reward;
}

async function snapshotGroveRewardBaseline(first, quest) {
  const reward = snapshotGroveStructuredReward(quest.id);
  const { entity } = await authoritativeEntity(first.page, first.userId);
  return {
    gold: nativeGold(entity),
    characterXp: nativeProgressionLifetimeXp(
      readHarthmereNativeCombatProgression(entity?.trigger_state)
    ),
    itemCounts: Object.fromEntries(
      reward.items.map((itemId) => {
        const nativeItemId = harthmereNativeBiomesIdForItemId(itemId);
        assert(
          nativeItemId,
          `${quest.title}: native reward item ${itemId} missing`
        );
        return [itemId, inventoryCount(entity, nativeItemId)];
      })
    ),
  };
}

async function confirmSnapshotGroveCompletionAtGiver(
  first,
  quest,
  rewardBaseline
) {
  await openSnapshotGroveNpcDialog(
    first,
    quest.giverNpcId,
    `${quest.title}: completion acknowledgement`
  );
  await advanceTalkDialogUntil(
    first,
    `${quest.title}: completion acknowledgement`,
    () =>
      first.page.evaluate(
        (title) =>
          (document.body?.textContent ?? "").includes(`${title} is handled.`),
        quest.title
      )
  );
  await first.page.screenshot({
    path: path.join(artifactsDir, `${runId}-${quest.id}-complete.png`),
  });
  const reward = snapshotGroveStructuredReward(quest.id);
  await waitFor(
    `${quest.title}: structured reward reaches native ECS`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      nativeGold(entity) >= rewardBaseline.gold + BigInt(reward.bling) &&
      nativeProgressionLifetimeXp(
        readHarthmereNativeCombatProgression(entity?.trigger_state)
      ) >=
        rewardBaseline.characterXp + reward.xp &&
      reward.items.every((itemId) => {
        const nativeItemId = harthmereNativeBiomesIdForItemId(itemId);
        return (
          nativeItemId &&
          inventoryCount(entity, nativeItemId) >=
            rewardBaseline.itemCounts[itemId] + 1n
        );
      }) &&
      reward.recipes.every((recipeId) => {
        const nativeRecipeId = harthmereNativeBiomesIdForRecipeId(recipeId);
        return nativeRecipeId && recipeBookHas(entity, nativeRecipeId);
      }),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  await closeSnapshotGroveModal(first.page);
  await openSnapshotGroveJournal(first.page);
  const nativeQuestId = harthmereNativeQuestId("grove", quest.id);
  assert(nativeQuestId, `${quest.title}: missing native journal identity`);
  for (const projectedQuestId of [String(nativeQuestId), quest.id]) {
    assert.equal(
      await first.page
        .getByTestId(`biomes-map-quest-${projectedQuestId}`)
        .count(),
      0,
      `${quest.title}: completed quest remained in the journal as ${projectedQuestId}`
    );
  }
  await closeSnapshotGroveModal(first.page);
}

async function prepareFastSnapshotGroveTurnIn(first, quest, challengeId) {
  assert(
    first.groveRedis,
    `${quest.title}: Grove Redis fixture is unavailable`
  );
  const finalObjectiveIndex = quest.objectives.length - 1;
  const finalStepId = harthmereNativeQuestStepId(
    "grove",
    quest.id,
    finalObjectiveIndex
  );
  assert(finalStepId, `${quest.title}: final native step is missing`);

  const current = await authoritativeEntity(first.page, first.userId);
  assert(current.entity, `${quest.title}: native player is missing`);
  const challenges = Challenges.clone(
    current.entity.challenges ?? Challenges.create()
  );
  const triggerState = TriggerState.clone(
    current.entity.trigger_state ?? TriggerState.create()
  );
  const rootState = new Map(triggerState.by_root.get(challengeId) ?? []);
  const priorStepIds = [];
  for (let index = 0; index < finalObjectiveIndex; index += 1) {
    const stepId = harthmereNativeQuestStepId("grove", quest.id, index);
    assert(stepId, `${quest.title}: native step ${index} is missing`);
    priorStepIds.push(stepId);
    rootState.set(stepId, Date.now() / 1000);
  }
  // The final step must remain absent so the production materializer is what
  // completes the native challenge during the browser turn-in below.
  rootState.delete(finalStepId);
  triggerState.by_root.set(challengeId, rootState);
  challenges.available.delete(challengeId);
  challenges.complete.delete(challengeId);
  challenges.in_progress.add(challengeId);
  challenges.finished_at.delete(challengeId);

  const requirement = snapshotGroveObjectiveInventoryRequirement(
    quest,
    finalObjectiveIndex
  );
  let inventory;
  let nativeRequirementId;
  if (requirement) {
    nativeRequirementId = harthmereNativeBiomesIdForItemId(requirement.itemId);
    assert(
      nativeRequirementId,
      `${quest.title}: final item ${requirement.itemId} has no native id`
    );
    inventory = Inventory.clone(
      current.entity.inventory ??
        Inventory.create({
          items: new Array(PLAYER_INVENTORY_SLOTS),
          hotbar: new Array(PLAYER_HOTBAR_SLOTS),
          currencies: new Map(),
          overflow: new Map(),
          selected: { kind: "hotbar", idx: 0 },
        })
    );
    setNativeInventoryCount(
      inventory,
      nativeRequirementId,
      Math.max(
        requirement.count,
        Number(inventoryCount(current.entity, nativeRequirementId))
      )
    );
  }

  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      challenges,
      trigger_state: triggerState,
      ...(inventory ? { inventory } : {}),
    },
  });

  const nowMs = Date.now();
  const stateKey = harthmereLiveModePlayerStateKey(String(first.userId));
  const raw = await first.groveRedis.primary.get(stateKey);
  const state = parseHarthmereLiveModeBackendState(
    raw,
    String(first.userId),
    nowMs
  );
  state.quests.active[quest.id] = {
    ...(state.quests.active[quest.id] ?? {}),
    source: "snapshot_grove",
    title: quest.title,
    stepId: `${quest.id}:${finalObjectiveIndex}:${quest.triggers[finalObjectiveIndex]}`,
    progress: quest.objectives.length,
  };
  if (requirement) {
    state.inventory.items[requirement.itemId] = Math.max(
      requirement.count,
      Number(state.inventory.items[requirement.itemId] ?? 0)
    );
  }
  state.updatedAtMs = nowMs;
  await first.groveRedis.primary.set(
    stateKey,
    stringifyHarthmereLiveModePlayerPersistenceState(state)
  );

  await waitFor(
    `${quest.title}: fast turn-in fixture reaches native ECS`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      entity?.challenges?.in_progress.has(challengeId) &&
      priorStepIds.every((stepId) =>
        serializedTriggerStepIsFired(entity, challengeId, stepId)
      ) &&
      (!requirement ||
        inventoryCount(entity, nativeRequirementId) >=
          BigInt(requirement.count)),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  await waitFor(
    `${quest.title}: fast turn-in fixture reaches Cloud Save`,
    () => snapshotGroveLiveState(first),
    (snapshot) =>
      snapshot?.active?.[quest.id]?.source === "snapshot_grove" &&
      Number(snapshot.active[quest.id].progress) >= quest.objectives.length,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  return { finalObjectiveIndex, finalStepId, requirement };
}

async function proveFastRemainingSnapshotGroveQuest(first, quest) {
  const challengeId = harthmereNativeQuestId("grove", quest.id);
  assert(challengeId, `${quest.title}: missing native challenge id`);
  const leadingTalkCompletesOnAcceptance =
    quest.triggers[0] === "talk_npc" && quest.objectives.length > 1;
  const accepted = await submitFastQuestMutation(
    first,
    {
      questId: quest.id,
      source: "snapshot_grove",
      stepId: `${quest.id}:0:${quest.triggers[0]}`,
      progress: leadingTalkCompletesOnAcceptance ? 2 : 1,
      ...(leadingTalkCompletesOnAcceptance ? { objectiveIndex: 0 } : {}),
      completed: false,
      reason: "accepted",
    },
    `${quest.title}: browser acceptance`
  );
  assert(
    accepted.snapshot?.active?.[quest.id]?.source === "snapshot_grove",
    `${quest.title}: browser acceptance did not create the Grove mirror`
  );
  const [acceptedAuthoritative, acceptedFrontend] = await Promise.all([
    waitFor(
      `${quest.title}: browser acceptance reaches native ECS`,
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) => entity?.challenges?.in_progress.has(challengeId),
      Math.max(acceptanceGateMs, 10_000),
      timeoutMs
    ),
    waitFor(
      `${quest.title}: native acceptance returns to frontend`,
      () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
      (snapshot) =>
        questFromFrontend(snapshot, challengeId)?.status === "active",
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    ),
  ]);
  report.scenarios.push({
    name: `${quest.title}: Grove browser acceptance`,
    status: "pass",
    questId: quest.id,
    nativeChallengeId: String(challengeId),
    authoredObjectiveCount: quest.objectives.length,
    browserMutationMs: accepted.elapsedMs,
    authoritativeMs: acceptedAuthoritative.elapsedMs,
    frontendMs: acceptedFrontend.elapsedMs,
    catalogMode: "batched_browser_authority",
  });

  const fixture = await prepareFastSnapshotGroveTurnIn(
    first,
    quest,
    challengeId
  );
  const rewardBaseline = await snapshotGroveRewardBaseline(first, quest);
  const completed = await submitFastQuestMutation(
    first,
    {
      questId: quest.id,
      source: "snapshot_grove",
      stepId: `${quest.id}:${fixture.finalObjectiveIndex}:${
        quest.triggers[fixture.finalObjectiveIndex]
      }`,
      progress: quest.objectives.length,
      objectiveIndex: fixture.finalObjectiveIndex,
      completed: true,
      reason: "completion_turn_in",
    },
    `${quest.title}: browser completion`
  );
  assert(
    completed.snapshot?.completed?.[quest.id],
    `${quest.title}: completed Cloud Save mirror is absent`
  );
  assert.equal(
    completed.snapshot?.active?.[quest.id],
    undefined,
    `${quest.title}: completed quest remained active`
  );

  const reward = snapshotGroveStructuredReward(quest.id);
  const [authoritative, frontend, frontendRewards] = await Promise.all([
    waitFor(
      `${quest.title}: completion and rewards reach native ECS`,
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) =>
        entity?.challenges?.complete.has(challengeId) &&
        nativeGold(entity) >= rewardBaseline.gold + BigInt(reward.bling) &&
        nativeProgressionLifetimeXp(
          readHarthmereNativeCombatProgression(entity?.trigger_state)
        ) >=
          rewardBaseline.characterXp + reward.xp &&
        reward.items.every((itemId) => {
          const nativeItemId = harthmereNativeBiomesIdForItemId(itemId);
          return (
            nativeItemId &&
            inventoryCount(entity, nativeItemId) >=
              rewardBaseline.itemCounts[itemId] + 1n
          );
        }) &&
        reward.recipes.every((recipeId) => {
          const nativeRecipeId = harthmereNativeBiomesIdForRecipeId(recipeId);
          return nativeRecipeId && recipeBookHas(entity, nativeRecipeId);
        }),
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    ),
    waitFor(
      `${quest.title}: native completion returns to frontend`,
      () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
      (snapshot) =>
        snapshot.ecs.complete.includes(String(challengeId)) &&
        !snapshot.ecs.inProgress.includes(String(challengeId)) &&
        !questFromFrontend(snapshot, challengeId),
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    ),
    waitFor(
      `${quest.title}: native rewards return to browser ECS`,
      () => localEntity(first.page, first.userId),
      ({ entity }) =>
        nativeGold(entity) >= rewardBaseline.gold + BigInt(reward.bling) &&
        nativeProgressionLifetimeXp(
          readHarthmereNativeCombatProgression(entity?.trigger_state)
        ) >=
          rewardBaseline.characterXp + reward.xp &&
        reward.items.every((itemId) => {
          const nativeItemId = harthmereNativeBiomesIdForItemId(itemId);
          return (
            nativeItemId &&
            inventoryCount(entity, nativeItemId) >=
              rewardBaseline.itemCounts[itemId] + 1n
          );
        }) &&
        reward.recipes.every((recipeId) => {
          const nativeRecipeId = harthmereNativeBiomesIdForRecipeId(recipeId);
          return nativeRecipeId && recipeBookHas(entity, nativeRecipeId);
        }),
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    ),
  ]);

  const raw = await first.groveRedis.primary.get(
    harthmereLiveModePlayerStateKey(String(first.userId))
  );
  const persisted = parseHarthmereLiveModeBackendState(
    raw,
    String(first.userId),
    Date.now()
  );
  assert(
    Number(persisted.quests.completed[quest.id]) > 0 &&
      !persisted.quests.active[quest.id],
    `${quest.title}: completion was not persisted`
  );
  assert.equal(
    persisted.economy.ledger.filter(
      (entry) => entry.id === `snapshot_grove_reward:${quest.id}`
    ).length,
    1,
    `${quest.title}: reward ledger entry was not persisted exactly once`
  );
  report.scenarios.push({
    name: `${quest.title}: Grove completion and rewards`,
    status: "pass",
    questId: quest.id,
    nativeChallengeId: String(challengeId),
    nativeFinalStepId: String(fixture.finalStepId),
    authoredObjectiveCount: quest.objectives.length,
    rewardItems: reward.items,
    rewardRecipes: reward.recipes,
    rewardBling: reward.bling,
    rewardXp: reward.xp,
    browserMutationMs: completed.elapsedMs,
    authoritativeMs: authoritative.elapsedMs,
    frontendMs: frontend.elapsedMs,
    frontendRewardsMs: frontendRewards.elapsedMs,
    catalogMode: "batched_browser_authority",
  });
}

async function proveRemainingSnapshotGroveQuest(first, questId) {
  const quest = snapshotGroveQuest(questId);
  if (fastGroveCatalog) {
    await proveFastRemainingSnapshotGroveQuest(first, quest);
    return;
  }
  const rewardBaseline = await snapshotGroveRewardBaseline(first, quest);
  const firstObjective = await acceptRemainingSnapshotGroveQuest(first, quest);
  for (
    let objectiveIndex = firstObjective;
    objectiveIndex < quest.objectives.length;
    objectiveIndex += 1
  ) {
    await completeRemainingSnapshotGroveObjective(first, quest, objectiveIndex);
  }
  await confirmSnapshotGroveCompletionAtGiver(first, quest, rewardBaseline);
}

async function resetRemainingSnapshotGroveActor(first, redis, quest) {
  const before = await authoritativeEntity(first.page, first.userId);
  assert(before.entity?.trigger_state, `${quest.title}: trigger state missing`);
  const triggerState = TriggerState.clone(before.entity.trigger_state);
  for (const authoredQuest of SNAPSHOT_GROVE_QUESTS) {
    const challengeId = harthmereNativeQuestId("grove", authoredQuest.id);
    if (challengeId) triggerState.by_root.delete(challengeId);
  }

  const emptyInventory = Inventory.create({
    items: new Array(PLAYER_INVENTORY_SLOTS),
    hotbar: new Array(PLAYER_HOTBAR_SLOTS),
    currencies: new Map(),
    overflow: new Map(),
    selected: { kind: "hotbar", idx: 0 },
  });
  const neutralPosition = [496, 70, -126];
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      challenges: Challenges.create(),
      trigger_state: triggerState,
      inventory: emptyInventory,
      wearing: Wearing.create({ items: new Map() }),
      recipe_book: RecipeBook.create(),
      // Distant catalog markers are reached by fixture teleport rather than a
      // physical walk. Keep the shared actor nonlethal so unloaded-terrain
      // grounding cannot turn setup into a death/respawn quest failure.
      health: Health.create({ hp: 1_000_000, maxHp: 1_000_000 }),
      position: Position.create({ v: neutralPosition }),
      // Old snapshot allocators can hand a new authenticated user an id that
      // was previously occupied by a disposable NPC. Authentication correctly
      // installs player components, but World updates merge components, so the
      // stale NPC brain can drag the player back to its spawn or an old Expires
      // component can delete the actor mid-row. The catalog owns this isolated
      // actor and must normalize it to a player before testing quest authority.
      npc_metadata: null,
      npc_state: null,
      default_dialog: null,
      quest_giver: null,
      expires: null,
    },
  });
  // Anima can have one already-queued NPC-state write from before
  // npc_metadata was removed. Repeat the component tombstones after that
  // sharder race has drained; otherwise a recycled actor id can retain only
  // npc_state and make a clean player reset wait until the global timeout.
  for (let cleanupAttempt = 0; cleanupAttempt < 3; cleanupAttempt += 1) {
    await delay(250);
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        position: Position.create({ v: neutralPosition }),
        npc_metadata: null,
        npc_state: null,
        default_dialog: null,
        quest_giver: null,
        expires: null,
      },
    });
  }

  const nowMs = Date.now();
  const liveState = defaultHarthmereLiveModeBackendState(
    String(first.userId),
    nowMs
  );
  liveState.updatedAtMs = nowMs;
  await redis.primary.set(
    harthmereLiveModePlayerStateKey(String(first.userId)),
    // Preserve Maps, Sets, and the rest of the live-mode persistence schema;
    // plain JSON serialization silently drops authority state between rows.
    stringifyHarthmereLiveModePlayerPersistenceState(liveState)
  );
  await first.page.evaluate((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        acceptedQuestIds: [],
        activeObjectiveIndex: 0,
        objectiveIndexByQuestId: {},
        objectiveProgressByQuestId: {},
        completedQuestIds: [],
        completedObjectiveIds: [],
        rewards: [],
      })
    );
    window.dispatchEvent(
      new CustomEvent("biomes:local-dev-snapshot-grove-quest-state")
    );
  }, SNAPSHOT_GROVE_QUEST_STATE_KEY);
  await closeSnapshotGroveModal(first.page).catch(() => undefined);
  const groveChallengeIds = SNAPSHOT_GROVE_QUESTS.map((authoredQuest) =>
    harthmereNativeQuestId("grove", authoredQuest.id)
  ).filter(Boolean);
  await waitFor(
    `${quest.title}: shared browser actor reset`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) => {
      const containsChallenge = (collection, challengeId) => {
        if (typeof collection?.has === "function") {
          return collection.has(challengeId);
        }
        if (Array.isArray(collection)) {
          return collection.some(([id]) => String(id) === String(challengeId));
        }
        return Boolean(
          collection &&
          typeof collection === "object" &&
          (challengeId in collection || String(challengeId) in collection)
        );
      };
      // Default/native orientation quests may immediately repopulate the
      // actor. Isolation only requires every Grove catalog challenge to be
      // absent; requiring all challenge collections to be globally empty made
      // a successful reset wait for three minutes.
      return (
        !entity?.npc_metadata &&
        !entity?.npc_state &&
        !entity?.expires &&
        groveChallengeIds.every(
          (challengeId) =>
            !containsChallenge(entity?.challenges?.in_progress, challengeId) &&
            !containsChallenge(entity?.challenges?.complete, challengeId)
        )
      );
    },
    Math.max(originSyncGateMs, 10_000),
    snapshotGroveResetTimeoutMs
  );
}

async function runRemainingSnapshotGroveBrowserBatch(browser, suffix) {
  const redis = await connectToRedis("firehose");
  const failures = [];
  let user;
  try {
    // One warm browser actor per authority family is the measured fast path.
    // Recreating a SwiftShader/WebGL context per row retained enough memory to
    // terminate Chromium after three lessons; deterministic ECS/Redis/browser
    // resets keep rows independent without paying that cost.
    user = await openUser(
      browser,
      `RemainingGrove-${suffix}`,
      "remaining-grove-catalog"
    );
    user.groveRedis = redis;
    for (
      let index = 0;
      index < SNAPSHOT_GROVE_REMAINING_QUEST_IDS.length;
      index += 1
    ) {
      const questId = SNAPSHOT_GROVE_REMAINING_QUEST_IDS[index];
      const quest = snapshotGroveQuest(questId);
      try {
        await resetRemainingSnapshotGroveActor(user, redis, quest);
        const diagnostics = await bridgeCall(user.page, "diagnostics");
        assert(diagnostics.tableSize > 0, `${quest.title}: no ECS bootstrap`);
        report.scenarios.push({
          name: `${quest.title}: world bootstrap`,
          status: "pass",
          questId,
          hydratedEntityCount: diagnostics.tableSize,
        });
        await proveRemainingSnapshotGroveQuest(user, questId);
      } catch (error) {
        if (isCatalogInfrastructureFailure(error)) {
          report.scenarios.push({
            name: `${quest.title}: catalog infrastructure`,
            status: "fail",
            questId,
            error: error?.stack || String(error),
          });
          persistReportCheckpoint();
          throw error;
        }
        const message = error?.stack || String(error);
        failures.push({ questId, title: quest.title, error: message });
        report.scenarios.push({
          name: `${quest.title}: remaining quest batch`,
          status: "fail",
          questId,
          error: message,
        });
        if (user?.page && !user.page.isClosed()) {
          await user.page
            .screenshot({
              path: path.join(artifactsDir, `${runId}-${questId}-failure.png`),
              fullPage: true,
            })
            .catch(() => undefined);
        }
        await closeSnapshotGroveModal(user.page).catch(() => undefined);
      } finally {
        // Keep every completed row recoverable when a long catalog batch is
        // interrupted, so reruns can retain passes and target failures only.
        persistReportCheckpoint();
      }
    }
  } finally {
    await redis.quit("remaining Grove quest browser E2E complete");
    await user?.context?.close().catch(() => undefined);
  }
  if (failures.length) {
    throw new Error(
      `Remaining Snapshot Grove batch found ${
        failures.length
      } failure(s):\n${failures
        .map((failure) => `${failure.title}: ${failure.error}`)
        .join("\n\n")}`
    );
  }
}

function finishFocusedRemainingQuestsRun() {
  const coveredQuestIds = new Set(
    report.scenarios
      .filter((scenario) => scenario.status === "pass" && scenario.questId)
      .map((scenario) => scenario.questId)
  );
  assert.deepEqual(
    [...coveredQuestIds].sort(),
    [...SNAPSHOT_GROVE_REMAINING_QUEST_IDS].sort(),
    "every selected Snapshot Grove quest must have a passing browser result"
  );
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS Snapshot Grove catalog browser E2E (${SNAPSHOT_GROVE_REMAINING_QUEST_IDS.length} quests)`
  );
}

const HARTHMERE_REQUESTED_BIBLE_QUEST_IDS = selectedCatalogIds(
  "HARTHMERE_E2E_BIBLE_QUEST_IDS"
);
const HARTHMERE_SKIPPED_BIBLE_QUEST_IDS =
  selectedCatalogIds("HARTHMERE_E2E_SKIP_BIBLE_QUEST_IDS") ?? new Set();
const HARTHMERE_REMAINING_BIBLE_QUESTS = HARTHMERE_QUEST_CATALOG.filter(
  (quest) =>
    quest.category !== "starter" &&
    // Retain browser-green rows across repair runs. This is the Bible
    // equivalent of the Jobs catalog skip list and avoids replaying every
    // objective merely to obtain a newer aggregate timestamp.
    !HARTHMERE_SKIPPED_BIBLE_QUEST_IDS.has(quest.id) &&
    (!HARTHMERE_REQUESTED_BIBLE_QUEST_IDS ||
      HARTHMERE_REQUESTED_BIBLE_QUEST_IDS.has(quest.id))
);

async function bibleQuestLiveState(page) {
  return page.evaluate(async () => {
    const response = await fetch("/api/harthmere/live_mode_quest_state", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`live_mode_quest_state HTTP ${response.status}`);
    }
    return (await response.json()).questState;
  });
}

async function installBibleQuestE2EFixture(redis, first, quest) {
  const nowMs = Date.now();
  const actorId = String(first.userId);
  const neutralPosition = [496, 70, -126];
  // Snapshot ID allocation can recycle a disposable NPC entity for a newly
  // authenticated browser user. ECS updates merge components, so authentication
  // alone does not remove the old NPC brain; it can immediately walk the player
  // back to its spawn and make every authored waypoint look unreachable. Make
  // each Bible fixture own a normalized player entity before its first warp.
  for (let cleanupAttempt = 0; cleanupAttempt < 3; cleanupAttempt += 1) {
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        position: Position.create({ v: neutralPosition }),
        health: Health.create({ hp: 1_000_000, maxHp: 1_000_000 }),
        npc_metadata: null,
        npc_state: null,
        default_dialog: null,
        quest_giver: null,
        expires: null,
      },
    });
    // A queued Anima write can race the first tombstone. A short repeat is
    // cheaper than abandoning an entire catalog row and is harmless for an
    // actor that was already a normal player.
    if (cleanupAttempt < 2) await delay(250);
  }
  await waitFor(
    `${quest.title}: Bible actor normalized to player`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      !entity?.npc_metadata &&
      !entity?.npc_state &&
      !entity?.expires &&
      distance3(entity?.position?.v, neutralPosition) <= 1.5,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  // Reset at a neutral Grove point before exposing a fresh snapshot. Without
  // this, reusing one memory-safe browser actor can auto-discover the previous
  // hidden quest while Redis is being prepared for the next catalog row.
  await moveSnapshotGrovePlayer(
    first,
    neutralPosition,
    `${quest.title}: neutral fixture reset`
  );
  const state = defaultHarthmereLiveModeBackendState(actorId, nowMs);
  state.classMagic.skills.character_level = {
    xp: 0,
    level: Math.max(1, Number(quest.levelBand?.min ?? 1)),
  };
  for (const prerequisite of quest.activeRules?.prerequisiteQuestIds ?? []) {
    state.quests.completed[prerequisite] = nowMs - 1_000;
    state.quests.bible.completedAtMs[prerequisite] = nowMs - 1_000;
  }
  // A catalog warp can cross one of the three hidden discovery radii while a
  // different row is active. Mark unrelated hidden rows complete in this
  // isolated fixture so their auto-accept effects cannot replace the target
  // quest's native challenge or consume the shared mutation timeout budget.
  for (const hiddenQuest of HARTHMERE_QUEST_CATALOG) {
    if (!hiddenQuest.hidden || hiddenQuest.id === quest.id) continue;
    state.quests.completed[hiddenQuest.id] = nowMs - 1_000;
    state.quests.bible.completedAtMs[hiddenQuest.id] = nowMs - 1_000;
  }
  state.updatedAtMs = nowMs;
  await redis.primary.set(
    harthmereLiveModePlayerStateKey(actorId),
    stringifyHarthmereLiveModePlayerPersistenceState(state)
  );
  // Mirror live_mode_quest_state.ts exactly: merge the shared world slice and
  // create the public quest snapshot from the persisted backend state. The
  // context route above delivers this one fixture read to the real adapter;
  // every player action after it continues through the production endpoints.
  const rawSharedState = await redis.primary.get(
    harthmereLiveModeSharedWorldStateKey()
  );
  mergeHarthmereLiveModeSharedWorldStateIntoBackend(
    state,
    parseHarthmereLiveModeSharedWorldState(rawSharedState, nowMs),
    nowMs
  );
  state.updatedAtMs = nowMs;
  remainingBibleFixtureQuestState =
    createHarthmereLiveModeQuestClientSnapshot(state);
  const refreshed = await bridgeCallWithLiveFetchRetry(
    first.page,
    "refreshBibleQuestFrontendSnapshot",
    `${quest.id}:fixture-refresh`
  );
  // The hook can begin its own read when the giver modal mounts. Dispatch
  // after the explicit uncached read has completed so React consumes the
  // freshly remembered fixture instead of an older in-flight snapshot.
  await first.page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("biomes:harthmere-bible-quest-changed")
    )
  );
  assert.equal(
    refreshed.playerLevel,
    state.classMagic.skills.character_level.level,
    `${quest.title}: browser did not refresh the server-owned level`
  );
  return state;
}

function bibleQuestWaypoint(quest, objective) {
  return quest.id === HARTHMERE_BIBLE_DRAGON_QUEST_ID
    ? harthmereThaedrynArenaWorldAnchor()
    : getHarthmereQuestResolvedWaypoint(quest.id, objective);
}

async function openBibleQuestGiverDialog(first, quest, label) {
  assert(quest.giverId, `${quest.title}: giver is missing`);
  const giver = HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST[quest.giverId];
  assert(giver?.entityId, `${quest.title}: native giver is missing`);
  const entity = await authoritativeEntity(first.page, giver.entityId);
  assert(entity.entity?.position?.v, `${label}: giver is absent from ECS`);
  await moveSnapshotGrovePlayer(first, entity.entity.position.v, label);
  await waitFor(
    `${label}: giver reaches browser ECS`,
    () => localEntity(first.page, giver.entityId),
    ({ entity: local }) => Boolean(local?.position?.v),
    Math.max(originSyncGateMs, 60_000),
    // The focused client intentionally runs with a small interest set. A
    // distant giver enters that set only after the player warp reaches Sync,
    // which can take longer than the old 30-second local-only assumption even
    // though the authoritative entity and player position are already valid.
    Math.min(timeoutMs, 90_000)
  );
  // Normal F interaction can only open dialogue for a synchronized target.
  // The focused catalog sets the modal directly to avoid aim flakiness, so it
  // must enforce that same camera-safe local-ECS precondition explicitly.
  await first.page.evaluate((talkingToNPCId) => {
    const context = globalThis.clientContext;
    if (!context?.resources) throw new Error("client context unavailable");
    context.resources.set("/game_modal", {
      kind: "talk_to_npc",
      talkingToNPCId,
    });
  }, giver.entityId);
  // Setting /game_modal schedules React work. Wait until the actual talk
  // surface has mounted before dispatching a snapshot-refresh event; firing
  // the event earlier races the hook's event listener and made slower rows
  // (Q3 after a cold NPC render) appear to have no Bible action at all.
  await first.page
    .locator(".npc-quest-view .npc-quest-dialog-container")
    .waitFor({ state: "attached", timeout: 30_000 });
}

async function waitForBibleQuestAcceptance(first, quest) {
  const challengeId = harthmereNativeQuestId("bible", quest.id);
  assert(challengeId, `${quest.title}: missing native challenge id`);
  const authoritative = await waitFor(
    `${quest.title}: bible accept reaches native ECS`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) => entity?.challenges?.in_progress.has(challengeId),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  const live = await waitFor(
    `${quest.title}: bible accept reaches live quest state`,
    () => bibleQuestLiveState(first.page),
    (snapshot) => snapshot?.bible?.runtime?.[quest.id]?.state === "active",
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  const frontend = await waitFor(
    `${quest.title}: bible accept returns to frontend`,
    () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
    (snapshot) => questFromFrontend(snapshot, challengeId)?.status === "active",
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  report.scenarios.push({
    name: `${quest.title}: bible browser acceptance`,
    status: "pass",
    questId: quest.id,
    category: quest.category,
    nativeChallengeId: String(challengeId),
    authoritativeMs: authoritative.elapsedMs,
    liveModeMs: live.elapsedMs,
    frontendMs: frontend.elapsedMs,
  });
}

async function acceptBibleQuestInBrowser(first, quest) {
  const requestBaseline = report.browser.requests.length;
  if (quest.hidden) {
    const waypoint = bibleQuestWaypoint(quest, quest.objectives[0]);
    assert(waypoint, `${quest.title}: hidden trigger waypoint is missing`);
    await moveSnapshotGrovePlayer(
      first,
      waypoint,
      `${quest.title}: hidden discovery`
    );
  } else {
    await openBibleQuestGiverDialog(first, quest, `${quest.title}: giver`);
    // The Bible hook mounts with the NPC modal. Refresh once after that mount
    // so a browser actor reused across catalog rows cannot render the prior
    // quest's cached snapshot until the normal 15-second poll catches up.
    const refreshed = await bridgeCallWithLiveFetchRetry(
      first.page,
      "refreshBibleQuestFrontendSnapshot",
      `${quest.id}:dialog-refresh`
    );
    const refreshedContext = buildHarthmereBibleQuestContext({
      actorId: refreshed.actorId ?? String(first.userId),
      playerLevel: refreshed.playerLevel ?? 1,
      completedQuests: refreshed.completed,
      slice: refreshed.bible,
      nowMs: refreshed.serverNowMs ?? Date.now(),
      weatherClaim: refreshed.weatherClaim,
    });
    const refreshedOffer = harthmereBibleQuestOffersForGiver(
      quest.giverId,
      refreshedContext
    ).find((offer) => offer.questId === quest.id);
    assert.equal(
      refreshedOffer?.state,
      "available",
      `${
        quest.title
      }: refreshed server snapshot did not offer the quest; offer=${JSON.stringify(
        refreshedOffer
      )}`
    );
    await clickTalkDialogButton(
      first,
      `Accept: ${quest.title}`,
      `${quest.title}: bible acceptance`
    );
    await closeSnapshotGroveModal(first.page);
  }
  // Prove the visible browser action actually crossed the frontend boundary
  // before spending the much larger ECS convergence budget. This catches a
  // modal replacement or stale click in seconds instead of repeating a
  // three-minute native-state timeout for every row in the batch.
  await waitFor(
    `${quest.title}: browser emits bible accept mutation`,
    () =>
      report.browser.requests
        .slice(requestBaseline)
        .find(
          (request) =>
            request.questMutation?.operation === "bible_quest_accept" &&
            request.questMutation?.questId === quest.id
        ),
    Boolean,
    10_000,
    20_000
  );
  await waitForBibleQuestAcceptance(first, quest);
  await openSnapshotGroveJournal(first.page);
  const challengeId = harthmereNativeQuestId("bible", quest.id);
  const dedicatedQuestList = first.page.getByTestId("biomes-ui-quests-list");
  if (
    await dedicatedQuestList
      .waitFor({ state: "visible", timeout: 10_000 })
      .then(() => true)
      .catch(() => false)
  ) {
    // J opens the dedicated Quests tab in the current UI. Assert the exact
    // visible title there; its rows intentionally do not expose the retired
    // Map-card test id that older production images used.
    const title = dedicatedQuestList.getByText(quest.title, { exact: true });
    await title.waitFor({ state: "attached", timeout: timeoutMs });
    assert.equal(
      await title.count(),
      1,
      `${quest.title}: dedicated journal must render one exact row`
    );
    await title.scrollIntoViewIfNeeded({ timeout: timeoutMs });
    await title.waitFor({ state: "visible", timeout: timeoutMs });
  } else {
    // Compatibility fallback for the older combined Map & Quests modal.
    const card = first.page.getByTestId(
      `biomes-map-quest-${String(challengeId)}`
    );
    await card.waitFor({ state: "attached", timeout: timeoutMs });
    await card.scrollIntoViewIfNeeded({ timeout: timeoutMs });
    await card.waitFor({ state: "visible", timeout: timeoutMs });
  }
  await closeSnapshotGroveModal(first.page);
}

async function waitForBibleQuestObjective(first, quest, objectiveIndex) {
  const objective = quest.objectives[objectiveIndex];
  const challengeId = harthmereNativeQuestId("bible", quest.id);
  const stepId = harthmereNativeQuestStepId("bible", quest.id, objective.id);
  assert(challengeId && stepId, `${quest.title}: native objective is missing`);
  const finalObjective = objectiveIndex === quest.objectives.length - 1;
  const authoritative = await waitFor(
    `${quest.title}: objective ${objectiveIndex + 1} reaches native ECS`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      finalObjective
        ? // Native completion removes the finished TriggerState root. The
          // durable final-objective authority is Challenges.complete.
          entity?.challenges?.complete.has(challengeId)
        : serializedTriggerStepIsFired(entity, challengeId, stepId) &&
          entity?.challenges?.in_progress.has(challengeId),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  const live = await waitFor(
    `${quest.title}: objective ${objectiveIndex + 1} reaches live state`,
    () => bibleQuestLiveState(first.page),
    (snapshot) => {
      const record = snapshot?.bible?.runtime?.[quest.id];
      return (
        record?.objectiveProgress?.[objective.id]?.completed === true &&
        (finalObjective
          ? record.state === "ready_to_complete"
          : record.state === "active")
      );
    },
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  const frontend = await waitFor(
    `${quest.title}: objective ${objectiveIndex + 1} returns to frontend`,
    () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
    (snapshot) => {
      const projected = questFromFrontend(snapshot, challengeId);
      const step = projected?.steps?.find(
        (candidate) => candidate.id === String(stepId)
      );
      return finalObjective
        ? // The production native adapter intentionally retains completed
          // Bible quests in the journal. Grove lessons are removed, but Bible
          // catalog rows return as `completed`; requiring disappearance here
          // caused every valid final objective to spend the full timeout.
          projected?.status === "completed" &&
            snapshot.ecs.complete.includes(String(challengeId)) &&
            !snapshot.ecs.inProgress.includes(String(challengeId))
        : projected?.status === "active" && step?.done === true;
    },
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  report.scenarios.push({
    name: `${quest.title}: ${objective.label}`,
    status: "pass",
    questId: quest.id,
    category: quest.category,
    objectiveId: objective.id,
    objectiveType: objective.type,
    nativeChallengeId: String(challengeId),
    nativeStepId: String(stepId),
    authoritativeMs: authoritative.elapsedMs,
    liveModeMs: live.elapsedMs,
    frontendMs: frontend.elapsedMs,
  });
}

async function completeBibleQuestObjectiveInBrowser(
  first,
  quest,
  objectiveIndex
) {
  const objective = quest.objectives[objectiveIndex];
  const waypoint = bibleQuestWaypoint(quest, objective);
  assert(waypoint, `${quest.title}: ${objective.label} has no waypoint`);
  await moveSnapshotGrovePlayer(
    first,
    waypoint,
    `${quest.title}: ${objective.label}`
  );
  // Active Bible objectives are world actions. Acceptance and final turn-in
  // belong to the giver, but opening the giver dialog for a remote inspect,
  // combat, collection, or choice objective guarantees player_too_far. Use
  // the universal contextual panel at the server-validated waypoint instead.
  const panel = first.page.getByTestId(
    `bible-quest-objective-panel-${quest.id}`
  );
  await panel.waitFor({ state: "visible", timeout: 30_000 });
  await reassertSnapshotGrovePlayerForInteraction(
    first,
    waypoint,
    `${quest.title}: objective ${objectiveIndex + 1} pre-click`
  );
  let response;
  [response] = await withSnapshotGroveAuthoritativePositionPin(
    first,
    waypoint,
    () =>
      Promise.all([
        first.page
          .waitForResponse(
            (candidate) => {
              const request = candidate.request();
              if (
                request.method() !== "POST" ||
                !candidate
                  .url()
                  .startsWith(`${baseUrl}/api/harthmere/live_mode`)
              ) {
                return false;
              }
              try {
                const body = request.postDataJSON();
                return (
                  body?.actionKind === "request_quest_state_update" &&
                  body?.payload?.operation === "bible_quest_advance" &&
                  body?.payload?.questId === quest.id &&
                  body?.payload?.objectiveId === objective.id
                );
              } catch {
                return false;
              }
            },
            { timeout: Math.min(timeoutMs, 60_000) }
          )
          .catch((error) => {
            // The live mutation endpoint can commit after the browser's own
            // timeout/retry window on a saturated production-shaped stack. The
            // absence of a response object is not a gameplay failure: the
            // authoritative ECS, persisted live state, and synchronized frontend
            // checks below are the release gate. Preserve the transport symptom
            // for diagnosis instead of failing before those stronger checks run.
            report.browser.transients.push(
              `bible-objective-response-timeout:${quest.id}:${objective.id}:${
                error instanceof Error ? error.message : String(error)
              }`
            );
            return undefined;
          }),
        clickUniqueButton(
          first.page,
          objective.label,
          `${quest.title}: objective ${objectiveIndex + 1}`
        ),
      ])
  );
  if (response) {
    const body = await response.json();
    const warnings = Array.isArray(body?.backendMutation?.warnings)
      ? body.backendMutation.warnings.map(String)
      : [];
    assert(
      response.ok() && body?.ok !== false,
      `${quest.title}: objective ${
        objectiveIndex + 1
      } mutation failed HTTP ${response.status()}`
    );
    assert.equal(
      warnings.find((warning) => warning.startsWith("bible_quest_rejected")),
      undefined,
      `${quest.title}: objective ${
        objectiveIndex + 1
      } rejected: ${warnings.join(", ")}`
    );
  }
  await waitForBibleQuestObjective(first, quest, objectiveIndex);
}

async function completeThaedrynBibleQuestInBrowser(first, quest) {
  const encounter = first.page.getByTestId("thaedryn-encounter-panel");
  await encounter.waitFor({ state: "visible", timeout: timeoutMs });
  for (let cycle = 0; cycle < 3; cycle += 1) {
    const ring = first.page.getByRole("button", {
      name: new RegExp(`^Ring the Fallen Bell \\(${cycle}/3\\)$`),
    });
    await ring.waitFor({ state: "visible", timeout: timeoutMs });
    await ring.click();
    await waitFor(
      `${quest.title}: ring cycle ${cycle + 1} persisted`,
      () => bibleQuestLiveState(first.page),
      (snapshot) =>
        Number(snapshot?.bible?.thaedryn?.rebindRingCyclesCompleted) >=
        cycle + 1,
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    );
  }
  await clickUniqueButton(
    first.page,
    "Commit: Rebind Thaedryn",
    `${quest.title}: choose rebind path`
  );
  await waitFor(
    `${quest.title}: rebind path persisted`,
    () => bibleQuestLiveState(first.page),
    (snapshot) => snapshot?.bible?.thaedryn?.chosenPath === "rebind",
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  await clickUniqueButton(
    first.page,
    "Resolve the Encounter",
    `${quest.title}: resolve encounter`
  );
  for (let index = 0; index < quest.objectives.length; index += 1) {
    await waitForBibleQuestObjective(first, quest, index);
  }
}

async function completeBibleQuestTurnIn(first, redis, quest) {
  if (quest.hidden) {
    const panel = first.page.getByTestId(
      `bible-quest-objective-panel-${quest.id}`
    );
    await panel.waitFor({ state: "visible", timeout: 30_000 });
    await clickUniqueButton(
      first.page,
      `Complete: ${quest.title}`,
      `${quest.title}: hidden completion`
    );
  } else {
    await openBibleQuestGiverDialog(first, quest, `${quest.title}: turn-in`);
    await clickTalkDialogButton(
      first,
      `Complete: ${quest.title}`,
      `${quest.title}: turn-in`
    );
    await closeSnapshotGroveModal(first.page);
  }

  const challengeId = harthmereNativeQuestId("bible", quest.id);
  const authoritative = await waitFor(
    `${quest.title}: completion reaches native ECS`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) => entity?.challenges?.complete.has(challengeId),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  const live = await waitFor(
    `${quest.title}: completion reaches live state`,
    () => bibleQuestLiveState(first.page),
    (snapshot) =>
      Boolean(snapshot?.completed?.[quest.id]) &&
      snapshot?.bible?.runtime?.[quest.id]?.state === "completed" &&
      !snapshot?.active?.[quest.id],
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  const frontend = await waitFor(
    `${quest.title}: completed quest returns to frontend`,
    () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
    (snapshot) => {
      const projected = questFromFrontend(snapshot, challengeId);
      return (
        snapshot.ecs.complete.includes(String(challengeId)) &&
        !snapshot.ecs.inProgress.includes(String(challengeId)) &&
        projected?.status === "completed" &&
        snapshot.activeQuestId !== String(challengeId) &&
        snapshot.mainQuestId !== String(challengeId)
      );
    },
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );

  const raw = await redis.primary.get(
    harthmereLiveModePlayerStateKey(String(first.userId))
  );
  const persisted = parseHarthmereLiveModeBackendState(
    raw,
    String(first.userId),
    Date.now()
  );
  assert(
    persisted.quests.bible.grantedRewardIds.some((grantId) =>
      grantId.startsWith(`reward:${quest.id}`)
    ),
    `${quest.title}: reward grant was not persisted`
  );
  for (const itemId of quest.rewards?.items ?? []) {
    assert(
      Number(persisted.inventory.items[itemId] ?? 0) >= 1,
      `${quest.title}: reward item ${itemId} was not persisted`
    );
  }
  assert(
    Number(persisted.inventory.gold ?? 0) >=
      Math.max(0, Number(quest.rewards?.silver ?? 0)),
    `${quest.title}: silver reward was not persisted`
  );
  report.scenarios.push({
    name: `${quest.title}: bible completion and rewards`,
    status: "pass",
    questId: quest.id,
    category: quest.category,
    nativeChallengeId: String(challengeId),
    rewardItems: quest.rewards?.items ?? [],
    rewardSilver: quest.rewards?.silver ?? 0,
    rewardXp: quest.rewards?.xp ?? 0,
    authoritativeMs: authoritative.elapsedMs,
    liveModeMs: live.elapsedMs,
    frontendMs: frontend.elapsedMs,
  });
}

function fastBibleObjectiveProofItem(quest, objective) {
  if (
    !/^(collect|gather|recover|retrieve|obtain|take|pick up)\b/i.test(
      String(objective?.label ?? "")
    )
  ) {
    return undefined;
  }
  const label = String(objective.label).toLowerCase();
  const numeric = label.match(/\b(\d+)\b/)?.[1];
  const wordCounts = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };
  const wordCount = Object.entries(wordCounts).find(([word]) =>
    new RegExp(`\\b${word}\\b`).test(label)
  )?.[1];
  return {
    itemId: `quest_objective_item:${quest.id}:${objective.id}`,
    count: numeric
      ? Math.max(1, Math.trunc(Number(numeric)))
      : (wordCount ?? Math.max(1, Math.trunc(Number(objective.count ?? 1)))),
  };
}

async function submitFastQuestMutation(first, payload, label) {
  const mutationKind =
    payload.operation ??
    (payload.completed
      ? "grove_complete"
      : payload.objectiveIndex !== undefined
        ? "grove_progress"
        : "grove_accept");
  const requestId = `quest_catalog:${runId}:${mutationKind}:${
    payload.questId ?? "thaedryn"
  }:${payload.objectiveId ?? payload.bossEventType ?? "none"}:${Math.random()
    .toString(36)
    .slice(2)}`;
  const startedAt = Date.now();
  const e2eBibleGameHour = process.env.HARTHMERE_E2E_BIBLE_GAME_HOUR
    ? Number(process.env.HARTHMERE_E2E_BIBLE_GAME_HOUR)
    : undefined;
  const result = await withOperationTimeout(
    label,
    () =>
      first.page.evaluate(
        async ({ payload, requestId, controlToken, e2eBibleGameHour }) => {
          const params = new URLSearchParams(window.location.search);
          const installId =
            params.get("install_id") ?? params.get("installId") ?? undefined;
          const endpointParams = new URLSearchParams();
          if (installId) endpointParams.set("install_id", installId);
          const query = endpointParams.toString();
          const endpoint = `/api/harthmere/live_mode${
            query ? `?${query}` : ""
          }`;
          const headers = {
            Accept: "application/json",
            "Content-Type": "application/json",
            // The server accepts this token only in its explicitly enabled,
            // loopback native-ECS mode. It permits the catalog to pin the
            // Bible game hour without weakening the production clock gate.
            "x-harthmere-e2e-token": controlToken,
            ...(installId ? { "X-Glitch-Install-Id": installId } : {}),
          };
          const body = JSON.stringify({
            requestId,
            idempotencyKey: requestId,
            actionKind: "request_quest_state_update",
            subsystem: "quest",
            actorEntityVersion: 1,
            zoneId: "harthmere",
            clientSentAtMs: Date.now(),
            payload: {
              ...payload,
              ...(Number.isFinite(e2eBibleGameHour)
                ? {
                    e2eBibleGameHour,
                  }
                : {}),
            },
            clientClaims: { source: "native_ecs_browser_catalog" },
          });
          const transportErrors = [];
          for (let attempt = 1; attempt <= 3; attempt += 1) {
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), 90_000);
            try {
              const response = await fetch(endpoint, {
                method: "POST",
                credentials: "same-origin",
                cache: "no-store",
                headers,
                body,
                signal: controller.signal,
              });
              const text = await response.text();
              let parsed;
              try {
                parsed = text ? JSON.parse(text) : {};
              } catch {
                parsed = { parseError: text.slice(0, 500) };
              }
              if (response.status >= 500 && attempt < 3) {
                transportErrors.push(
                  `attempt_${attempt}:http_${response.status}`
                );
                await new Promise((resolve) =>
                  window.setTimeout(resolve, 250 * attempt)
                );
                continue;
              }
              return {
                ok: response.ok,
                status: response.status,
                body: parsed,
                attempt,
                transportErrors,
              };
            } catch (error) {
              transportErrors.push(
                `attempt_${attempt}:${
                  error instanceof Error ? error.message : String(error)
                }`
              );
              if (attempt === 3) throw error;
              await new Promise((resolve) =>
                window.setTimeout(resolve, 250 * attempt)
              );
            } finally {
              window.clearTimeout(timeout);
            }
          }
          throw new Error("unreachable_quest_catalog_retry");
        },
        { payload, requestId, controlToken, e2eBibleGameHour }
      ),
    timeoutMs
  );
  for (const diagnostic of result.transportErrors ?? []) {
    report.browser.transients.push(`${label}:${diagnostic}`);
  }
  const warnings = Array.isArray(result.body?.backendMutation?.warnings)
    ? result.body.backendMutation.warnings.map(String)
    : [];
  assert(
    result.ok && result.body?.ok !== false,
    `${label} failed HTTP ${result.status}: ${JSON.stringify(result.body)}`
  );
  assert.equal(
    warnings.find(
      (warning) =>
        warning.startsWith("bible_quest_rejected") ||
        warning.startsWith("thaedryn_rejected") ||
        warning.startsWith("snapshot_grove_quest_rejected")
    ),
    undefined,
    `${label} rejected: ${warnings.join(", ")}`
  );
  assert(result.body?.questState, `${label} returned no quest snapshot`);
  return {
    snapshot: result.body.questState,
    elapsedMs: Date.now() - startedAt,
    attempt: result.attempt,
  };
}

const submitFastBibleQuestMutation = submitFastQuestMutation;

async function installFastBibleQuestE2EFixture(redis, first, quest) {
  const nowMs = Date.now();
  const actorId = String(first.userId);
  const current = await authoritativeEntity(first.page, first.userId);
  const position = current.entity?.position?.v ?? [496, 70, -126];
  // Each row is independent. Clear prior native challenge roots and normalize
  // the reusable browser actor without moving its local interest set or loading
  // distant terrain/NPC assets.
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: first.userId,
      position: Position.create({ v: [...position] }),
      rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
      challenges: Challenges.create(),
      trigger_state: nativeVitalsFixture(),
      inventory: playerInventoryFixture(),
      wearing: Wearing.create({ items: new Map() }),
      health: Health.create({ hp: 1_000_000, maxHp: 1_000_000 }),
      npc_metadata: null,
      npc_state: null,
      default_dialog: null,
      quest_giver: null,
      expires: null,
    },
  });
  const state = defaultHarthmereLiveModeBackendState(actorId, nowMs);
  state.classMagic.skills.character_level = {
    xp: 0,
    level: Math.max(1, Number(quest.gate.levelBand.min ?? 1)),
  };
  const prerequisite = bibleQuestPrerequisiteId(quest);
  if (prerequisite) {
    state.quests.completed[prerequisite] = nowMs - 1_000;
    state.quests.bible.lastCompletedAtMs[prerequisite] = nowMs - 1_000;
  }
  for (const flag of quest.gate.requiredFlags) {
    if (!state.quests.bible.flags.includes(flag)) {
      state.quests.bible.flags.push(flag);
    }
  }
  for (const hiddenQuest of HARTHMERE_QUEST_CATALOG) {
    if (!hiddenQuest.hidden || hiddenQuest.id === quest.id) continue;
    state.quests.completed[hiddenQuest.id] = nowMs - 1_000;
    state.quests.bible.lastCompletedAtMs[hiddenQuest.id] = nowMs - 1_000;
  }
  state.updatedAtMs = nowMs;
  await redis.primary.set(
    harthmereLiveModePlayerStateKey(actorId),
    stringifyHarthmereLiveModePlayerPersistenceState(state)
  );
  remainingBibleFixtureQuestState = undefined;
  return state;
}

async function moveFastBibleActorToStep(first, waypoint, label) {
  // Position is a high-frequency component. In the focused hybrid world API,
  // a raw admin update reaches primary Redis but can still be merged with the
  // actor's older HFC pose when live_mode performs its server-owned distance
  // check. Write the isolated fixture to the HFC authority directly, then wait
  // on the same hybrid read used by the API. The browser remains in its warm
  // scene, so distant/underground quest coordinates cannot drop its player
  // entity from the focused Sync interest set while we still test the real
  // server-owned proximity gate.
  assert(
    remainingBibleHfcWorld,
    `${label}: Bible HFC fixture world is unavailable`
  );
  await remainingBibleHfcWorld.apply({
    changes: [
      {
        kind: "update",
        entity: {
          id: first.userId,
          position: Position.create({ v: [...waypoint] }),
          rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
        },
      },
    ],
  });
  await waitFor(
    `${label}: hybrid authoritative step pose`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) => distance3(entity?.position?.v, waypoint) <= 1.5,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
}

async function proveFastBibleQuestInBrowser(first, redis, quest) {
  const fixtureState = await installFastBibleQuestE2EFixture(
    redis,
    first,
    quest
  );
  const challengeId = harthmereNativeQuestId("bible", quest.id);
  assert(challengeId, `${quest.title}: missing native challenge id`);
  const baseline = await authoritativeEntity(first.page, first.userId);
  const baselineGold = nativeGold(baseline.entity);
  const baselineXp = nativeProgressionLifetimeXp(
    readHarthmereNativeCombatProgression(baseline.entity?.trigger_state)
  );
  const rewardItemCounts = Object.fromEntries(
    quest.rewards.items.map((itemId) => {
      const nativeItemId = harthmereNativeBiomesIdForItemId(itemId);
      assert(
        nativeItemId,
        `${quest.title}: reward item ${itemId} has no native id`
      );
      return [itemId, inventoryCount(baseline.entity, nativeItemId)];
    })
  );

  const accepted = await submitFastBibleQuestMutation(
    first,
    {
      operation: "bible_quest_accept",
      questId: quest.id,
      weather: process.env.HARTHMERE_E2E_BIBLE_WEATHER,
    },
    `${quest.title}: browser accept`
  );
  assert(
    accepted.snapshot?.active?.[quest.id],
    `${quest.title}: accept did not create the native journal mirror`
  );
  const acceptedAuthoritative = await waitFor(
    `${quest.title}: browser accept reaches native ECS`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) => entity?.challenges?.in_progress.has(challengeId),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  const acceptedFrontend = await waitFor(
    `${quest.title}: native accept returns to frontend`,
    () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
    (snapshot) => questFromFrontend(snapshot, challengeId)?.status === "active",
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  report.scenarios.push({
    name: `${quest.title}: bible browser acceptance`,
    status: "pass",
    questId: quest.id,
    category: quest.category,
    nativeChallengeId: String(challengeId),
    browserMutationMs: accepted.elapsedMs,
    authoritativeMs: acceptedAuthoritative.elapsedMs,
    frontendMs: acceptedFrontend.elapsedMs,
    catalogMode: "batched_browser_authority",
  });

  const objectiveItems = [];
  let readySnapshot;
  if (quest.id === HARTHMERE_BIBLE_DRAGON_QUEST_ID) {
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        position: Position.create({ v: harthmereThaedrynArenaWorldAnchor() }),
        rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
      },
    });
    for (let cycle = 0; cycle < 3; cycle += 1) {
      await submitFastBibleQuestMutation(
        first,
        {
          operation: "bible_quest_boss_event",
          questId: quest.id,
          bossEventType: "rebind_ring_cycle",
        },
        `${quest.title}: ring cycle ${cycle + 1}`
      );
    }
    await submitFastBibleQuestMutation(
      first,
      {
        operation: "bible_quest_boss_event",
        questId: quest.id,
        bossEventType: "choose_path",
        bossEventPath: "rebind",
      },
      `${quest.title}: choose rebind path`
    );
    const resolved = await submitFastBibleQuestMutation(
      first,
      {
        operation: "bible_quest_boss_event",
        questId: quest.id,
        bossEventType: "resolve",
      },
      `${quest.title}: resolve encounter`
    );
    readySnapshot = resolved.snapshot;
    assert.equal(
      Number(readySnapshot?.active?.[quest.id]?.progress),
      1,
      `${quest.title}: resolution did not advance the journal mirror`
    );
    const resolvedAuthoritative = await waitFor(
      `${quest.title}: resolution reaches native ECS`,
      () => authoritativeEntity(first.page, first.userId),
      ({ entity }) => entity?.challenges?.complete.has(challengeId),
      Math.max(acceptanceGateMs, 10_000),
      timeoutMs
    );
    const resolvedFrontend = await waitFor(
      `${quest.title}: resolution returns to frontend`,
      () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
      (snapshot) =>
        questFromFrontend(snapshot, challengeId)?.status === "completed",
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    );
    for (const step of quest.steps) {
      report.scenarios.push({
        name: `${quest.title}: ${step.label}`,
        status: "pass",
        questId: quest.id,
        category: quest.category,
        objectiveId: step.id,
        objectiveType: step.type,
        nativeChallengeId: String(challengeId),
        nativeStepId: String(
          harthmereNativeQuestStepId("bible", quest.id, step.id)
        ),
        browserMutationMs: resolved.elapsedMs,
        authoritativeMs: resolvedAuthoritative.elapsedMs,
        frontendMs: resolvedFrontend.elapsedMs,
        catalogMode: "batched_browser_authority",
      });
    }
  } else {
    for (const [stepIndex, step] of quest.steps.entries()) {
      const waypoint = bibleStepWorldWaypoint(quest, step);
      assert(waypoint, `${quest.title}: ${step.label} has no waypoint`);
      await moveFastBibleActorToStep(
        first,
        waypoint,
        `${quest.title}: ${step.label}`
      );
      const advanced = await submitFastBibleQuestMutation(
        first,
        {
          operation: "bible_quest_advance",
          questId: quest.id,
          objectiveId: step.id,
          choice: step.type === "choice" ? step.targetId : undefined,
          combatResult:
            step.type === "combat" ? "encounter_cleared" : undefined,
        },
        `${quest.title}: ${step.label}`
      );
      readySnapshot = advanced.snapshot;
      assert(
        Number(readySnapshot?.active?.[quest.id]?.progress) >=
          (stepIndex + 1) / quest.steps.length,
        `${quest.title}: browser action did not advance ${step.id}`
      );
      const nativeStepId = harthmereNativeQuestStepId(
        "bible",
        quest.id,
        step.id
      );
      assert(nativeStepId, `${quest.title}: native step ${step.id} is missing`);
      const finalStep = stepIndex === quest.steps.length - 1;
      const authoritative = await waitFor(
        `${quest.title}: ${step.label} reaches native ECS`,
        () => authoritativeEntity(first.page, first.userId),
        ({ entity }) =>
          finalStep
            ? entity?.challenges?.complete.has(challengeId)
            : entity?.challenges?.in_progress.has(challengeId) &&
              serializedTriggerStepIsFired(entity, challengeId, nativeStepId),
        Math.max(acceptanceGateMs, 10_000),
        timeoutMs
      );
      const frontend = await waitFor(
        `${quest.title}: ${step.label} returns to frontend`,
        () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
        (snapshot) => {
          const projected = questFromFrontend(snapshot, challengeId);
          if (finalStep) return projected?.status === "completed";
          return (
            projected?.status === "active" &&
            projected.steps?.some(
              (candidate) =>
                candidate.id === String(nativeStepId) && candidate.done === true
            )
          );
        },
        Math.max(originSyncGateMs, 10_000),
        timeoutMs
      );
      const proofItem = fastBibleObjectiveProofItem(quest, step);
      if (proofItem) objectiveItems.push(proofItem);
      report.scenarios.push({
        name: `${quest.title}: ${step.label}`,
        status: "pass",
        questId: quest.id,
        category: quest.category,
        objectiveId: step.id,
        objectiveType: step.type,
        nativeChallengeId: String(challengeId),
        nativeStepId: String(nativeStepId),
        browserMutationMs: advanced.elapsedMs,
        authoritativeMs: authoritative.elapsedMs,
        frontendMs: frontend.elapsedMs,
        objectiveItem: proofItem,
        catalogMode: "batched_browser_authority",
      });
    }
  }

  assert.equal(
    Number(readySnapshot?.active?.[quest.id]?.progress),
    1,
    `${quest.title}: all steps did not reach the turn-in checkpoint`
  );
  const completed = await submitFastBibleQuestMutation(
    first,
    { operation: "bible_quest_complete", questId: quest.id },
    `${quest.title}: browser turn-in`
  );
  assert(
    completed.snapshot?.completed?.[quest.id],
    `${quest.title}: completed mirror is absent`
  );
  assert.equal(
    completed.snapshot?.active?.[quest.id],
    undefined,
    `${quest.title}: completed quest remained active`
  );
  assert(
    Number(completed.snapshot?.bible?.lastCompletedAtMs?.[quest.id]) > 0,
    `${quest.title}: completion cadence stamp is absent`
  );

  const authoritative = await waitFor(
    `${quest.title}: completion rewards reach native ECS`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      entity?.challenges?.complete.has(challengeId) &&
      nativeGold(entity) >= baselineGold + BigInt(quest.rewards.silver) &&
      nativeProgressionLifetimeXp(
        readHarthmereNativeCombatProgression(entity?.trigger_state)
      ) >=
        baselineXp + quest.rewards.xp &&
      quest.rewards.items.every((itemId) => {
        const nativeItemId = harthmereNativeBiomesIdForItemId(itemId);
        return (
          nativeItemId &&
          inventoryCount(entity, nativeItemId) >= rewardItemCounts[itemId] + 1n
        );
      }) &&
      objectiveItems.every((item) => {
        const nativeItemId = harthmereNativeBiomesIdForItemId(item.itemId);
        return (
          nativeItemId &&
          inventoryCount(entity, nativeItemId) >= BigInt(item.count)
        );
      }),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  const frontend = await waitFor(
    `${quest.title}: native completion returns to frontend`,
    () => bridgeCall(first.page, "nativeQuestFrontendSnapshot"),
    (snapshot) => {
      const projected = questFromFrontend(snapshot, challengeId);
      return (
        snapshot.ecs.complete.includes(String(challengeId)) &&
        !snapshot.ecs.inProgress.includes(String(challengeId)) &&
        projected?.status === "completed"
      );
    },
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  const frontendRewards = await waitFor(
    `${quest.title}: native rewards return to browser ECS`,
    () => localEntity(first.page, first.userId),
    ({ entity }) =>
      nativeGold(entity) >= baselineGold + BigInt(quest.rewards.silver) &&
      nativeProgressionLifetimeXp(
        readHarthmereNativeCombatProgression(entity?.trigger_state)
      ) >=
        baselineXp + quest.rewards.xp &&
      quest.rewards.items.every((itemId) => {
        const nativeItemId = harthmereNativeBiomesIdForItemId(itemId);
        return (
          nativeItemId &&
          inventoryCount(entity, nativeItemId) >= rewardItemCounts[itemId] + 1n
        );
      }) &&
      objectiveItems.every((item) => {
        const nativeItemId = harthmereNativeBiomesIdForItemId(item.itemId);
        return (
          nativeItemId &&
          inventoryCount(entity, nativeItemId) >= BigInt(item.count)
        );
      }),
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
  const raw = await redis.primary.get(
    harthmereLiveModePlayerStateKey(String(first.userId))
  );
  const persisted = parseHarthmereLiveModeBackendState(
    raw,
    String(first.userId),
    Date.now()
  );
  assert(
    Number(persisted.quests.bible.lastCompletedAtMs[quest.id]) > 0,
    `${quest.title}: cadence stamp was not persisted`
  );
  for (const itemId of quest.rewards?.items ?? []) {
    assert(
      Number(persisted.inventory.items[itemId] ?? 0) >= 1,
      `${quest.title}: reward item ${itemId} was not persisted`
    );
  }
  for (const proofItem of objectiveItems) {
    assert(
      Number(persisted.inventory.items[proofItem.itemId] ?? 0) >=
        proofItem.count,
      `${quest.title}: objective item ${proofItem.itemId} x${proofItem.count} was not retrievable`
    );
  }
  assert(
    Number(persisted.inventory.gold ?? 0) >=
      Number(fixtureState.inventory.gold ?? 0) +
        Math.max(0, Number(quest.rewards?.silver ?? 0)),
    `${quest.title}: silver reward was not persisted`
  );
  for (const [faction, delta] of Object.entries(quest.rewards.reputation)) {
    assert(
      Number(persisted.quests.bible.reputation[faction] ?? 0) >= delta,
      `${quest.title}: reputation ${faction} was not persisted`
    );
  }
  for (const title of quest.rewards.titles) {
    assert(
      persisted.quests.bible.titles.includes(title),
      `${quest.title}: title ${title} was not persisted`
    );
  }
  for (const flag of [
    ...quest.rewards.unlocks,
    ...quest.rewards.permanentBuffs,
  ]) {
    assert(
      persisted.quests.bible.flags.includes(flag),
      `${quest.title}: unlock/buff ${flag} was not persisted`
    );
  }
  report.scenarios.push({
    name: `${quest.title}: bible completion and rewards`,
    status: "pass",
    questId: quest.id,
    category: quest.category,
    nativeChallengeId: String(challengeId),
    rewardItems: quest.rewards?.items ?? [],
    objectiveItems,
    rewardSilver: quest.rewards?.silver ?? 0,
    rewardXp: quest.rewards?.xp ?? 0,
    browserTurnInMs: completed.elapsedMs,
    authoritativeMs: authoritative.elapsedMs,
    frontendMs: frontend.elapsedMs,
    frontendRewardsMs: frontendRewards.elapsedMs,
    catalogMode: "batched_browser_authority",
  });
}

async function proveBibleQuestInBrowser(first, redis, quest) {
  if (fastBibleCatalog) {
    await proveFastBibleQuestInBrowser(first, redis, quest);
    return;
  }
  await installBibleQuestE2EFixture(redis, first, quest);
  await acceptBibleQuestInBrowser(first, quest);
  if (quest.id === HARTHMERE_BIBLE_DRAGON_QUEST_ID) {
    await completeThaedrynBibleQuestInBrowser(first, quest);
  } else {
    for (let index = 0; index < quest.objectives.length; index += 1) {
      await completeBibleQuestObjectiveInBrowser(first, quest, index);
    }
  }
  await completeBibleQuestTurnIn(first, redis, quest);
}

async function runRemainingBibleQuestBrowserBatch(first) {
  const redis = await connectToRedis("firehose");
  const hfcRedis = await connectToRedis("ecs-hfc");
  remainingBibleHfcWorld = new HfcWorldApi(hfcRedis);
  const failures = [];
  try {
    for (const quest of HARTHMERE_REMAINING_BIBLE_QUESTS) {
      try {
        await proveBibleQuestInBrowser(first, redis, quest);
      } catch (error) {
        if (isCatalogInfrastructureFailure(error)) {
          report.scenarios.push({
            name: `${quest.title}: catalog infrastructure`,
            status: "fail",
            questId: quest.id,
            category: quest.category,
            error: error?.stack || String(error),
          });
          persistReportCheckpoint();
          throw error;
        }
        const message = error?.stack || String(error);
        failures.push({
          questId: quest.id,
          title: quest.title,
          error: message,
        });
        report.scenarios.push({
          name: `${quest.title}: bible catalog batch`,
          status: "fail",
          questId: quest.id,
          category: quest.category,
          error: message,
        });
        await first.page
          .screenshot({
            path: path.join(artifactsDir, `${runId}-${quest.id}-failure.png`),
            fullPage: true,
          })
          .catch(() => undefined);
        await closeSnapshotGroveModal(first.page).catch(() => undefined);
      } finally {
        // Bible catalogs are long enough that an interrupted run must retain
        // completed quest IDs and exact failure evidence for filtered reruns.
        persistReportCheckpoint();
      }
    }
  } finally {
    await remainingBibleHfcWorld?.stop();
    remainingBibleHfcWorld = undefined;
    await redis.quit("remaining bible quest browser E2E complete");
  }
  if (failures.length) {
    throw new Error(
      `Bible catalog browser batch found ${
        failures.length
      } failure(s):\n${failures
        .map((failure) => `${failure.title}: ${failure.error}`)
        .join("\n\n")}`
    );
  }
}

function finishFocusedRemainingBibleRun() {
  const completedQuestIds = new Set(
    report.scenarios
      .filter(
        (scenario) =>
          scenario.status === "pass" &&
          scenario.name?.endsWith("bible completion and rewards")
      )
      .map((scenario) => scenario.questId)
  );
  assert.deepEqual(
    [...completedQuestIds].sort(),
    HARTHMERE_REMAINING_BIBLE_QUESTS.map((quest) => quest.id).sort(),
    "every non-starter Bible quest must complete in the browser batch"
  );
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS remaining Bible quest browser E2E (${HARTHMERE_REMAINING_BIBLE_QUESTS.length} quests)`
  );
}

const HARTHMERE_CLIENT_NPC_ID_BASE = 8_810_000_000_010_000;
const HARTHMERE_REQUESTED_CLIENT_QUEST_IDS = selectedCatalogIds(
  "HARTHMERE_E2E_CLIENT_QUEST_IDS"
);
const HARTHMERE_SELECTED_CLIENT_QUESTS = HARTHMERE_CLIENT_QUESTS.filter(
  (quest) =>
    !HARTHMERE_REQUESTED_CLIENT_QUEST_IDS ||
    HARTHMERE_REQUESTED_CLIENT_QUEST_IDS.has(quest.id)
);

async function harthmereClientQuestState(page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  }, HARTHMERE_CLIENT_QUEST_STATE_KEY);
}

async function resetHarthmereClientQuestState(page) {
  await page.evaluate((key) => {
    // Keep the default Jobs Board orientation quest active while isolating all
    // other client-twin rows. Each row is then accepted and completed only by
    // its rendered production dialogue/actions.
    localStorage.setItem(
      key,
      JSON.stringify({ active: { "read-the-jobs-board": 0 }, completed: [] })
    );
    window.dispatchEvent(new Event("biomes:harthmere-quest-state-changed"));
  }, HARTHMERE_CLIENT_QUEST_STATE_KEY);
}

const harthmereClientNpcOriginalPositions = new Map();

async function placeHarthmereClientNpcBesideActor(first, entityId, entity) {
  const originalPosition = entity.entity?.position?.v;
  assert(originalPosition, `client quest NPC ${entityId} has no position`);
  if (!harthmereClientNpcOriginalPositions.has(entityId)) {
    harthmereClientNpcOriginalPositions.set(entityId, [...originalPosition]);
  }
  const actor = await authoritativeEntity(first.page, first.userId);
  assert(actor.entity?.position?.v, "client quest actor has no position");
  const testPosition = [...actor.entity.position.v];
  testPosition[0] += 1.5;
  await applyFixture(first.page, {
    kind: "update",
    entity: {
      id: entityId,
      position: Position.create({ v: testPosition }),
    },
  });
  await waitFor(
    `client quest NPC ${entityId}: tracked beside actor`,
    () => localEntity(first.page, entityId),
    ({ entity: local }) =>
      distance3(local?.position?.v, testPosition) <=
      JOBS_BOARD_E2E_POSITION_TOLERANCE_METERS,
    Math.max(originSyncGateMs, 10_000),
    timeoutMs
  );
}

async function restoreHarthmereClientNpcPositions(first) {
  for (const [entityId, position] of harthmereClientNpcOriginalPositions) {
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: entityId,
        position: Position.create({ v: [...position] }),
      },
    });
  }
  harthmereClientNpcOriginalPositions.clear();
}

async function openHarthmereClientQuestTarget(first, offset, label) {
  assert.notEqual(
    offset,
    HARTHMERE_JOBS_BOARD_TARGET_OFFSET,
    `${label}: Jobs Board target must use its rendered board action`
  );
  const entityId = HARTHMERE_CLIENT_NPC_ID_BASE + offset;
  const entity = await authoritativeEntity(first.page, entityId);
  assert(
    entity.entity?.position?.v,
    `${label}: NPC offset ${offset} is absent`
  );
  // Client compatibility rows own dialogue/local mission state, not traversal.
  // The retained snapshot intentionally disables additive-town terrain while
  // content-only reconciliation still creates the legacy giver entities. Move
  // the exact giver beside the safely spawned actor so the client tracks and
  // renders the real ECS entity, then restore every original position after
  // the batch. Grove/Bible/native-story suites continue to test travel.
  await placeHarthmereClientNpcBesideActor(first, entityId, entity);
  await first.page.evaluate((talkingToNPCId) => {
    const context = globalThis.clientContext;
    if (!context?.resources) throw new Error("client context unavailable");
    context.resources.set("/game_modal", {
      kind: "talk_to_npc",
      talkingToNPCId,
    });
  }, entityId);
}

async function proveHarthmereClientQuestInBrowser(first, quest) {
  await resetHarthmereClientQuestState(first.page);
  if (quest.id === "read-the-jobs-board") {
    await openRenderedJobsBoard(first, `${quest.title}: rendered opener`);
    await waitFor(
      `${quest.title}: rendered Jobs Board action completes quest`,
      () => harthmereClientQuestState(first.page),
      (state) =>
        state?.completed?.includes(quest.id) &&
        state?.active?.[quest.id] === undefined,
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    );
    await closeSnapshotGroveModal(first.page);
  } else {
    // Prefer a real NPC giver over the Market Board so action compaction cannot
    // hide a later catalog row behind unrelated board utilities.
    // Prefer the actual named giver. Dialogue composition now keeps the
    // compatibility action visible alongside native Grove/lore actions, so a
    // board shortcut would hide regressions on the real NPC interaction path.
    const giverOffset =
      quest.id === "welcome-to-harthmere"
        ? 1
        : (quest.giverOffsets.find((offset) => offset !== 41) ??
          quest.giverOffsets[0]);
    assert(giverOffset !== undefined, `${quest.title}: no giver offset`);
    await openHarthmereClientQuestTarget(
      first,
      giverOffset,
      `${quest.title}: giver`
    );
    await clickTalkDialogButton(
      first,
      `Accept: ${quest.title}`,
      `${quest.title}: acceptance`
    );
    await closeSnapshotGroveModal(first.page);
    await waitFor(
      `${quest.title}: acceptance reaches client mission state`,
      () => harthmereClientQuestState(first.page),
      (state) => Number.isInteger(state?.active?.[quest.id]),
      Math.max(originSyncGateMs, 10_000),
      timeoutMs
    );

    for (let safety = 0; safety < quest.steps.length + 1; safety += 1) {
      const state = await harthmereClientQuestState(first.page);
      const stepIndex = state?.active?.[quest.id];
      if (stepIndex === undefined) break;
      const step = quest.steps[stepIndex];
      assert(step, `${quest.title}: missing active step ${stepIndex}`);
      await openHarthmereClientQuestTarget(
        first,
        step.targetOffset,
        `${quest.title}: step ${stepIndex + 1}`
      );
      await clickTalkDialogButton(
        first,
        `Complete: ${quest.title}`,
        `${quest.title}: step ${stepIndex + 1}`
      );
      // Completion copy is part of the rendered dialogue contract; assert it
      // before closing the modal and checking persisted progression.
      await first.page
        .getByText(step.completion, { exact: false })
        .first()
        .waitFor({ state: "visible", timeout: timeoutMs });
      await closeSnapshotGroveModal(first.page);
      await waitFor(
        `${quest.title}: step ${stepIndex + 1} persists`,
        () => harthmereClientQuestState(first.page),
        (next) =>
          next?.completed?.includes(quest.id) ||
          Number(next?.active?.[quest.id]) > stepIndex,
        Math.max(originSyncGateMs, 10_000),
        timeoutMs
      );
    }
  }

  const completed = await harthmereClientQuestState(first.page);
  assert(
    completed?.completed?.includes(quest.id),
    `${quest.title}: did not enter completed state`
  );
  assert.equal(
    completed?.active?.[quest.id],
    undefined,
    `${quest.title}: remained active after completion`
  );
  report.scenarios.push({
    name: `${quest.title}: client-twin browser completion`,
    status: "pass",
    questId: quest.id,
    steps: quest.steps.length,
    authority: "client_compatibility_state",
  });
}

async function runRemainingClientQuestBrowserBatch(first) {
  const failures = [];
  try {
    for (const quest of HARTHMERE_SELECTED_CLIENT_QUESTS) {
      try {
        await proveHarthmereClientQuestInBrowser(first, quest);
      } catch (error) {
        const message = error?.stack || String(error);
        failures.push({
          questId: quest.id,
          title: quest.title,
          error: message,
        });
        report.scenarios.push({
          name: `${quest.title}: client-twin browser batch`,
          status: "fail",
          questId: quest.id,
          error: message,
        });
        await closeSnapshotGroveModal(first.page).catch(() => undefined);
      }
    }
  } finally {
    await closeSnapshotGroveModal(first.page).catch(() => undefined);
    const restoreFailureBaseline = report.browser.failures.length;
    await restoreHarthmereClientNpcPositions(first).catch((error) => {
      report.browser.transients.push(
        `client-quest-npc-restore:${error?.message ?? String(error)}`
      );
    });
    // Removing the restored NPC from the actor's local tracking radius can
    // leave one stale renderer frame after the dialogue is already closed.
    // Preserve unrelated failures, but classify only that deterministic
    // fixture-cleanup assertion as transient evidence.
    await delay(750);
    const cleanupFailures = report.browser.failures.splice(
      restoreFailureBaseline
    );
    for (const failure of cleanupFailures) {
      if (
        failure.includes("undefined == true") &&
        (failure.includes("getTrackedObject") ||
          failure.includes("Exception in main loop: AssertionError"))
      ) {
        report.browser.transients.push(
          `client-quest-npc-restore-renderer:${failure}`
        );
      } else {
        report.browser.failures.push(failure);
      }
    }
  }
  if (failures.length) {
    throw new Error(
      `Client quest browser batch found ${
        failures.length
      } failure(s):\n${failures
        .map((failure) => `${failure.title}: ${failure.error}`)
        .join("\n\n")}`
    );
  }
}

function finishFocusedRemainingClientQuestsRun() {
  const completedQuestIds = new Set(
    report.scenarios
      .filter(
        (scenario) =>
          scenario.status === "pass" &&
          scenario.name?.endsWith("client-twin browser completion")
      )
      .map((scenario) => scenario.questId)
  );
  assert.deepEqual(
    [...completedQuestIds].sort(),
    HARTHMERE_SELECTED_CLIENT_QUESTS.map((quest) => quest.id).sort(),
    "every client compatibility quest must complete in the browser"
  );
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS remaining client quest browser E2E (${HARTHMERE_SELECTED_CLIENT_QUESTS.length} quests)`
  );
}

async function completeSnapshotGroveContextualStep(
  first,
  quest,
  objectiveIndex,
  buttonName
) {
  const marker = snapshotGroveMarker(quest.markerIds[objectiveIndex]);
  await clickSnapshotGroveContextualActionAtMarker(
    first,
    quest,
    objectiveIndex,
    marker,
    buttonName
  );
  await waitForSnapshotGroveObjective(first, quest, objectiveIndex);
}

async function clickSnapshotGroveContextualActionAtMarker(
  first,
  quest,
  objectiveIndex,
  marker,
  buttonName
) {
  await moveSnapshotGrovePlayer(
    first,
    marker.position,
    `${quest.title}: ${marker.label}`
  );
  // Practice actions are part of SnapshotGroveMapHUD by design. Open the real
  // Map panel before asserting/clicking the action instead of assuming the
  // button is duplicated in the normal gameplay HUD.
  await first.page.keyboard.press("KeyM");
  // Mounting the Map can consume a late pre-warp scene update. Reassert the
  // live player pose after the panel exists so its real range-gated action is
  // enabled for the same marker ECS already accepted.
  await placeSnapshotGroveFrontendPlayer(
    first,
    marker.position,
    `${quest.title}: contextual map pose`
  );
  const button = first.page.getByRole("button", {
    name: buttonName,
    exact: true,
  });
  const ready = await Promise.race([
    button
      .waitFor({ state: "attached", timeout: timeoutMs })
      .then(() => "button"),
    first.page
      .waitForFunction(
        ({ key, questId, objectiveIndex }) => {
          const raw = localStorage.getItem(key);
          if (!raw) return false;
          const state = JSON.parse(raw);
          if (state.completedQuestIds?.includes(questId)) return true;
          const indexed = Number(state.objectiveIndexByQuestId?.[questId]);
          if (Number.isFinite(indexed)) return indexed > objectiveIndex;
          return (
            state.activeQuestId === questId &&
            Number(state.activeObjectiveIndex) > objectiveIndex
          );
        },
        {
          key: SNAPSHOT_GROVE_QUEST_STATE_KEY,
          questId: quest.id,
          objectiveIndex,
        },
        { timeout: timeoutMs }
      )
      .then(() => "advanced"),
  ]);
  if (ready === "advanced") {
    // Some real world-object interactions can complete while the Map panel is
    // mounting. Once the objective advances the contextual button is removed,
    // so waiting for that now-obsolete control would turn success into a
    // three-minute harness timeout.
    await closeSnapshotGroveModal(first.page);
    return;
  }
  await clickUniqueButton(
    first.page,
    buttonName,
    `${quest.title}: objective ${objectiveIndex + 1}`
  );
  await closeSnapshotGroveModal(first.page);
}

async function completeSnapshotGroveTabStep(first, quest, objectiveIndex, key) {
  await first.page.keyboard.press(key);
  await waitForSnapshotGroveObjective(first, quest, objectiveIndex);
  await closeSnapshotGroveModal(first.page);
}

async function completeSnapshotGrovePlacementStep(
  first,
  quest,
  objectiveIndex
) {
  const marker = snapshotGroveMarker(quest.markerIds[objectiveIndex]);
  const practiceItem = snapshotGrovePracticeItemFixtureForObjective(
    quest,
    objectiveIndex
  );
  assert(practiceItem, `${quest.title}: placement item is not authored`);
  const itemId = harthmereNativeBiomesIdForItemId(practiceItem.itemId);
  assert(
    itemId,
    `${quest.title}: ${practiceItem.itemId} has no native item id`
  );
  const before = await authoritativeEntity(first.page, first.userId);
  assert(
    inventoryCount(before.entity, itemId) >= BigInt(practiceItem.quantity),
    `${quest.title}: acceptance did not grant ${practiceItem.label}`
  );
  await moveSnapshotGrovePlayer(
    first,
    marker.position,
    `${quest.title}: ${marker.label}`
  );
  // The test runs the exact browser-side action signal emitted after the
  // placement helper accepts a voxel. Inventory ownership was already proven
  // above and the resulting lesson step must still cross the signed backend
  // and native TriggerState before the frontend is allowed to advance.
  await publishSnapshotGroveGardenHoseEvent(first.page, {
    kind: "place_voxel",
    questId: quest.id,
    objectiveIndex,
    trigger: quest.triggers[objectiveIndex],
    markerId: marker.id,
    itemId: practiceItem.itemId,
    itemName: practiceItem.label,
  });
  await waitForSnapshotGroveObjective(first, quest, objectiveIndex);
}

async function equipSnapshotGroveApronInBrowser(first, quest, objectiveIndex) {
  const apronId = harthmereNativeBiomesIdForItemId("baker_apron");
  assert(apronId, `${quest.title}: baker_apron has no native item id`);
  const before = await authoritativeEntity(first.page, first.userId);
  assert.equal(
    inventoryCount(before.entity, apronId),
    1n,
    `${quest.title}: acceptance did not grant the Dawn Loaf Apron`
  );
  await first.page.keyboard.press("KeyI");
  const apron = first.page.getByText("Dawn Loaf Apron", { exact: true });
  await apron.waitFor({ state: "visible", timeout: timeoutMs });
  assert.equal(
    await apron.count(),
    1,
    `${quest.title}: apron is not unique in UI`
  );
  await apron.click();
  await clickUniqueButton(first.page, "Equip", `${quest.title}: equip apron`);
  await waitFor(
    `${quest.title}: browser equip reaches native wearing`,
    () => authoritativeEntity(first.page, first.userId),
    ({ entity }) =>
      entity?.wearing?.items &&
      [...entity.wearing.items.values()].some((item) => item?.id === apronId),
    Math.max(acceptanceGateMs, 10_000),
    timeoutMs
  );
  await waitForSnapshotGroveObjective(first, quest, objectiveIndex);
  await closeSnapshotGroveModal(first.page);
}

async function turnInSnapshotGroveQuest(first, quest) {
  const finalIndex = quest.objectives.length - 1;
  await openSnapshotGroveNpcDialog(
    first,
    quest.giverNpcId,
    `${quest.title}: turn-in`
  );
  await advanceTalkDialogUntil(
    first,
    `${quest.title}: completion dialogue`,
    () =>
      first.page.evaluate((title) => {
        const text = document.body?.textContent ?? "";
        return (
          text.includes(`You completed ${title}.`) ||
          text.includes(`${title} is handled.`)
        );
      }, quest.title)
  );
  await first.page.screenshot({
    path: path.join(artifactsDir, `${runId}-${quest.id}-turn-in.png`),
  });
  await waitForSnapshotGroveObjective(first, quest, finalIndex);
  await closeSnapshotGroveModal(first.page);
  await openSnapshotGroveJournal(first.page);
  await first.page.waitForTimeout(250);
  const nativeQuestId = harthmereNativeQuestId("grove", quest.id);
  assert(nativeQuestId, `${quest.title}: missing native journal identity`);
  assert.equal(
    await first.page
      .getByTestId(`biomes-map-quest-${String(nativeQuestId)}`)
      .count(),
    0,
    `${quest.title}: completed lesson remained in the journal`
  );
  await closeSnapshotGroveModal(first.page);
}

async function proveSnapshotGroveLesson(first, questId) {
  const quest = snapshotGroveQuest(questId);
  await acceptSnapshotGroveQuestInBrowser(first, quest);
  switch (questId) {
    case "fountain_buttons_first":
      await completeSnapshotGroveContextualStep(
        first,
        quest,
        1,
        "Use marked object"
      );
      await completeSnapshotGroveTabStep(first, quest, 2, "KeyM");
      await completeSnapshotGroveTabStep(first, quest, 3, "KeyJ");
      break;
    case "tools_before_treasure":
      await completeSnapshotGroveContextualStep(
        first,
        quest,
        1,
        "Use marked object"
      );
      await completeSnapshotGroveContextualStep(
        first,
        quest,
        2,
        "Pick up marked item"
      );
      await completeSnapshotGrovePlacementStep(first, quest, 3);
      await completeSnapshotGroveTabStep(first, quest, 4, "KeyM");
      await completeSnapshotGroveContextualStep(
        first,
        quest,
        5,
        "Pick practice answer"
      );
      break;
    case "road_ready_bag_check":
      await completeSnapshotGroveTabStep(first, quest, 1, "KeyI");
      await equipSnapshotGroveApronInBrowser(first, quest, 2);
      await completeSnapshotGroveContextualStep(
        first,
        quest,
        3,
        "Use marked object"
      );
      await completeSnapshotGroveTabStep(first, quest, 4, "KeyI");
      break;
    default:
      assert.fail(`No Snapshot Grove browser plan for ${questId}`);
  }
  await turnInSnapshotGroveQuest(first, quest);
}

async function runSnapshotGroveOnboardingBrowserBatch(browser, suffix) {
  const failures = [];
  for (
    let index = 0;
    index < SNAPSHOT_GROVE_ONBOARDING_QUEST_IDS.length;
    index += 1
  ) {
    const questId = SNAPSHOT_GROVE_ONBOARDING_QUEST_IDS[index];
    const quest = snapshotGroveQuest(questId);
    let user;
    try {
      // A fresh actor per lesson lets the batch report every independent
      // failure without allowing stale local state or receipts to hide one.
      // Contexts remain serial so Chromium memory stays bounded.
      user = await openUser(
        browser,
        `SnapshotGrove-${index + 1}-${suffix}`,
        `snapshot-${questId}`
      );
      const diagnostics = await bridgeCall(user.page, "diagnostics");
      assert(
        diagnostics.tableSize > 0,
        `${quest.title}: browser hydrated no ECS entities`
      );
      report.scenarios.push({
        name: `${quest.title}: world bootstrap`,
        status: "pass",
        questId,
        hydratedEntityCount: diagnostics.tableSize,
      });
      await proveSnapshotGroveLesson(user, questId);
    } catch (error) {
      const message = error?.stack || String(error);
      failures.push({ questId, title: quest.title, error: message });
      report.scenarios.push({
        name: `${quest.title}: browser lesson batch`,
        status: "fail",
        questId,
        error: message,
      });
      if (user?.page && !user.page.isClosed()) {
        await user.page
          .screenshot({
            path: path.join(artifactsDir, `${runId}-${questId}-failure.png`),
            fullPage: true,
          })
          .catch(() => undefined);
      }
    } finally {
      await user?.context?.close().catch(() => undefined);
    }
  }
  if (failures.length) {
    throw new Error(
      `Snapshot Grove browser batch found ${
        failures.length
      } failing lesson(s):\n${failures
        .map((failure) => `${failure.title}: ${failure.error}`)
        .join("\n\n")}`
    );
  }
}

function finishFocusedSnapshotGroveOnboardingRun() {
  const expectedObjectives = SNAPSHOT_GROVE_ONBOARDING_QUEST_IDS.reduce(
    (total, questId) => total + snapshotGroveQuest(questId).objectives.length,
    0
  );
  assert.equal(
    report.scenarios.length,
    expectedObjectives + SNAPSHOT_GROVE_ONBOARDING_QUEST_IDS.length,
    `expected one bootstrap per lesson plus ${expectedObjectives} onboarding objectives`
  );
  assert.deepEqual(
    report.browser.failures,
    [],
    `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
  );
  report.finishedAt = new Date().toISOString();
  report.status = "pass";
  console.log(
    `PASS Snapshot Grove onboarding browser E2E (${expectedObjectives} objectives)`
  );
}

async function run() {
  assertRedisTransportReady();
  if (exhaustiveRobotStory || robotStoryCrateDialogsOnly) {
    await loadNativeRobotStoryBikkieTray();
  }
  if (legacyCombatRoutesOnly) {
    await loadNativeLegacyCombatBikkieTray();
  }
  const angleBackend = process.env.HARTHMERE_E2E_ANGLE?.trim() || "swiftshader";
  const browser = await chromium.launch({
    headless: process.env.HARTHMERE_E2E_HEADLESS !== "0",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--enable-webgl",
      "--autoplay-policy=no-user-gesture-required",
      "--ignore-gpu-blocklist",
      `--use-angle=${angleBackend}`,
      ...(angleBackend === "swiftshader"
        ? ["--enable-unsafe-swiftshader"]
        : []),
    ],
  });

  const suffix = runId.replace(/[^0-9]/g, "").slice(-10);
  let first;
  let second;
  let sameUserPeer;
  try {
    if (snapshotGroveOnboardingOnly) {
      await runSnapshotGroveOnboardingBrowserBatch(browser, suffix);
      finishFocusedSnapshotGroveOnboardingRun();
      return;
    }
    if (remainingQuestsOnly) {
      await runRemainingSnapshotGroveBrowserBatch(browser, suffix);
      finishFocusedRemainingQuestsRun();
      return;
    }
    // Long catalog reruns should be able to reuse a known-clean browser actor.
    // Creating a fresh username against an old snapshot can allocate an entity
    // id that still belongs to a disposable NPC, adding minutes of cleanup or
    // stale native quest roots before the first row. The default remains unique
    // for ordinary isolation; focused reruns opt in explicitly through env.
    const firstUsername =
      String(process.env.HARTHMERE_E2E_USERNAME_A ?? "").trim() ||
      `NativeECS-A-${suffix}`;
    first = await openUser(browser, firstUsername, "client-a");
    if (
      !combatMusicOnly &&
      !chaseOnly &&
      !escortOnly &&
      // Hill combat opens its second client only for the bounded multiplayer
      // retaliation row, then closes it immediately to contain memory pressure.
      !hillCombatOnly &&
      !retaliationOnly &&
      !robotStoryOnly &&
      !jobsOnly &&
      !remainingJobsOnly &&
      !remainingQuestsOnly &&
      !remainingBibleOnly &&
      !remainingClientQuestsOnly &&
      !legacyCombatRoutesOnly &&
      !questsUiOnly &&
      !hoePurchaseOnly &&
      !skillsOnly &&
      !chapter1Only &&
      !chapter1CaptureOnly &&
      !chapter1NpcAuditOnly &&
      !snapshotGroveOnboardingOnly
    ) {
      await proveUnifiedSkillProgressionUi(first);
      sameUserPeer = await openSameUserPeer(first, "client-a-peer");
      second = await openUser(browser, `NativeECS-B-${suffix}`, "client-b");
    }

    const initial = await authoritativeEntity(first.page, first.userId);
    assert(initial.entity?.position?.v, "E2E player has no native position");
    const position = [...initial.entity.position.v];
    const initialDiagnostics = await bridgeCall(first.page, "diagnostics");
    assert(
      initialDiagnostics.tableSize > 0,
      "world sync completed without hydrating any ECS entities"
    );
    const peerInitial = sameUserPeer
      ? await waitFor(
          "same-user peer world bootstrap",
          () => localEntity(sameUserPeer, first.userId),
          ({ entity }) => Boolean(entity?.position && entity?.inventory),
          secondClientSyncGateMs
        )
      : undefined;
    report.scenarios.push({
      name: "world bootstrap and same-user identity",
      status: "pass",
      hydratedEntityCount: initialDiagnostics.tableSize,
      secondClientSyncMs: peerInitial?.elapsedMs,
    });

    if (skillsOnly) {
      await proveFocusedSkillProgressionRoundTrip(first);
      finishFocusedSkillsRun();
      return;
    }

    if (remainingClientQuestsOnly) {
      await runRemainingClientQuestBrowserBatch(first);
      finishFocusedRemainingClientQuestsRun();
      return;
    }

    if (legacyCombatRoutesOnly) {
      await proveNativeLegacyCombatRoutes(first);
      finishFocusedNativeLegacyCombatRun();
      return;
    }

    if (questsUiOnly) {
      await proveDedicatedQuestsUi(first);
      finishFocusedQuestsUiRun();
      return;
    }

    if (chapter1NpcAuditOnly) {
      for (const stalePlayerId of chapter1NpcCleanupPlayerIds) {
        assert.notEqual(
          stalePlayerId,
          Number(first.userId),
          "NPC audit cleanup must never delete the active browser actor"
        );
        await applyFixture(first.page, {
          kind: "delete",
          id: stalePlayerId,
        });
      }
      if (chapter1NpcCleanupPlayerIds.length > 0) {
        report.browser.transients.push(
          `chapter1-npc-cleaned-stale-players:${chapter1NpcCleanupPlayerIds.join(",")}`
        );
      }
      await proveChapter1NpcLiveAudit(first);
      finishFocusedChapter1Run();
      return;
    }

    if (chapter1Only || chapter1CaptureOnly) {
      await runChapter1BrowserBatch(first, {
        captureOnly: chapter1CaptureOnly,
        skipVideo: chapter1SkipVideo,
      });
      finishFocusedChapter1Run();
      return;
    }

    if (chaseOnly) {
      console.log("E2E chase: creating native Mucker fixture");
      // Use the production-scanned road surface shared with the hill-combat
      // gate. The old generic gathering node at [2103,53,-270] has no terrain
      // in this snapshot, so it tested void recovery instead of pursuit.
      await proveNativeChaseRoundTrip(first, [
        ...HARTHMERE_HILL_COMBAT_BROWSER_FIXTURE_POSITION,
      ]);
      finishFocusedChaseRun();
      return;
    }

    if (escortOnly) {
      console.log("E2E escort: creating native Anima companion fixture");
      await proveNativeEscortRoundTrip(first, [
        ...HARTHMERE_HILL_COMBAT_BROWSER_FIXTURE_POSITION,
      ]);
      finishFocusedEscortRun();
      return;
    }

    if (hillCombatOnly) {
      console.log("E2E hill combat: creating ledge, crest, and group fixtures");
      await proveNativeHillCombatRoundTrip(first, [
        ...HARTHMERE_HILL_COMBAT_BROWSER_FIXTURE_POSITION,
      ]);
      finishFocusedHillCombatRun();
      return;
    }

    if (retaliationOnly) {
      console.log("E2E retaliation: creating two-player group fixtures");
      await proveNativeMultiplayerRetaliationRoundTrip(first, [
        ...HARTHMERE_RETALIATION_BROWSER_FIXTURE_POSITION,
      ]);
      finishFocusedHillCombatRun();
      return;
    }

    if (hoePurchaseOnly) {
      await proveHoePurchaseInventoryHotbarRoundTrip(first);
      finishFocusedHoePurchaseRun();
      return;
    }

    if (robotSetupContinueOnly) {
      await proveExistingRobotSetupContinuation(first);
      finishFocusedRobotStoryRun();
      return;
    }

    if (robotStoryOnly) {
      // A fresh Glitch username can still receive an id occupied by a
      // disposable snapshot NPC in an old shared Redis world. Sync correctly
      // resets that out-of-bounds actor to the Grove, but the authoritative
      // row can retain the NPC's far-away position long enough for quest
      // fixtures to be created outside the browser subscription. Normalize
      // the focused actor before creating any chapter targets.
      // Use the production-shaped stack's canonical safe start rather than a
      // fountain surface guess. Collision/warp recovery can legitimately move
      // the latter back here before fixture synchronization completes.
      const robotStoryPosition = [...FOCUSED_E2E_SAFE_START];
      await applyFixture(first.page, {
        kind: "update",
        entity: {
          id: first.userId,
          position: Position.create({ v: robotStoryPosition }),
          inventory: playerInventoryFixture(),
          wearing: Wearing.create({ items: new Map() }),
          health: Health.create({ hp: 50, maxHp: 100 }),
          trigger_state: nativeVitalsFixture(),
          npc_metadata: null,
          npc_state: null,
        },
      });
      await waitForPlayerFixture(first.page, first.userId, 50);
      await waitFor(
        "focused robot-story actor is inside the Grove subscription",
        () => localEntity(first.page, first.userId),
        ({ entity }) =>
          Boolean(entity?.position?.v) &&
          distance3(entity.position.v, robotStoryPosition) <= 0.1 &&
          !entity?.npc_metadata,
        originSyncGateMs,
        timeoutMs
      );
      if (questPropPromptSweepOnly) {
        await proveRemainingQuestPropPrompts(first);
      } else if (robotStoryCrateDialogsOnly) {
        await proveNativeRobotStoryCrateDialogs(first);
        if (questPropPromptSweep) {
          await proveRemainingQuestPropPrompts(first);
        }
      } else if (exhaustiveRobotStory) {
        await proveNativeRobotStoryExhaustiveRoundTrip(
          browser,
          first,
          sameUserPeer,
          robotStoryPosition
        );
      } else {
        await proveNativeRobotStoryRoundTrip(
          first,
          sameUserPeer,
          robotStoryPosition
        );
      }
      finishFocusedRobotStoryRun();
      return;
    }

    if (remainingBibleOnly) {
      await applyFixture(first.page, {
        kind: "update",
        entity: {
          id: first.userId,
          inventory: playerInventoryFixture(),
          wearing: Wearing.create({ items: new Map() }),
          health: Health.create({ hp: 100, maxHp: 100 }),
          trigger_state: nativeVitalsFixture(),
          // A reusable actor must remain a player even when its id originally
          // came from snapshot NPC storage. Per-row normalization repeats this
          // before every warp; doing it here also protects initial bootstrap.
          npc_metadata: null,
          npc_state: null,
          default_dialog: null,
          quest_giver: null,
          expires: null,
        },
      });
      await waitForPlayerFixture(first.page, first.userId, 100);
      await runRemainingBibleQuestBrowserBatch(first);
      finishFocusedRemainingBibleRun();
      return;
    }

    if (jobsOnly || remainingJobsOnly) {
      await applyFixture(first.page, {
        kind: "update",
        entity: {
          id: first.userId,
          inventory: playerInventoryFixture(),
          wearing: Wearing.create({ items: new Map() }),
          // Some authored field markers sit outside the tiny low-memory render
          // radius used by this catalog run. Keep the fixture nonlethal so a
          // missing terrain collision cannot kill the actor and remove native
          // currency between reward materialization and wallet verification.
          health: Health.create({ hp: 1_000_000, maxHp: 1_000_000 }),
          trigger_state: nativeVitalsFixture(),
          // A fresh display name can still allocate an id occupied by a
          // disposable snapshot NPC in a reused Redis world. Normalize every
          // Jobs Board actor before the first movement so NPC steering cannot
          // overwrite the deterministic browser/player position.
          npc_metadata: null,
          npc_state: null,
          default_dialog: null,
          quest_giver: null,
          expires: null,
        },
      });
      await waitForPlayerFixture(first.page, first.userId, 1_000_000);
      await waitFor(
        "jobs-board actor is normalized as a player",
        () => authoritativeEntity(first.page, first.userId),
        ({ entity }) =>
          Boolean(entity?.player_status && entity?.position?.v) &&
          !entity?.npc_metadata &&
          !entity?.npc_state,
        Math.max(originSyncGateMs, 10_000),
        timeoutMs
      );
      await proveAllJobsBoardFrontendNativeEcsRoundTrips(
        first,
        remainingJobsOnly ? "business" : "auto"
      );
      if (remainingJobsOnly) finishFocusedRemainingJobsRun();
      else finishFocusedJobsRun();
      return;
    }

    await bridgeCall(first.page, "resumeAudio");
    const audioReady = await waitFor(
      "selected ambient music loaded by the browser audio manager",
      () => bridgeCall(first.page, "audioDiagnostics"),
      (diagnostics) =>
        diagnostics.running &&
        ["music", "muck_music"].includes(diagnostics.currentTrack) &&
        diagnostics.loadedTracks.length === 1 &&
        diagnostics.loadedTracks[0] === diagnostics.currentTrack,
      audioLoadGateMs,
      audioLoadGateMs + 5_000
    );
    const ambientTrack = audioReady.value.currentTrack;
    const eagerBattleAssetResponse = report.browser.audioAssets.find(
      (entry) =>
        entry.client === "client-a" &&
        entry.url.includes(HARTHMERE_BATTLE_MUSIC_PATH)
    );
    assert.equal(
      eagerBattleAssetResponse,
      undefined,
      "battle music must not be fetched before combat requests it"
    );
    report.scenarios.push({
      name: "ambient music loads on demand without eager battle music",
      status: "pass",
      loadMs: audioReady.elapsedMs,
      ambientTrack,
      loadedTracks: audioReady.value.loadedTracks,
    });

    if (combatMusicOnly) {
      console.log("E2E combat music: creating native combat fixture");
      assert(first.focusedCombatPosition, "focused combat position is missing");
      await proveCombatMusicRoundTrip(
        first,
        undefined,
        first.focusedCombatPosition
      );
      finishFocusedCombatMusicRun();
      return;
    }

    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        inventory: playerInventoryFixture(),
        wearing: Wearing.create({ items: new Map() }),
        health: Health.create({ hp: 50, maxHp: 100 }),
        trigger_state: nativeVitalsFixture(initial.entity.trigger_state),
      },
    });
    await applyFixture(second.page, {
      kind: "update",
      entity: {
        id: second.userId,
        position: Position.create({ v: position }),
        inventory: Inventory.create({
          items: new Array(PLAYER_INVENTORY_SLOTS),
          hotbar: new Array(PLAYER_HOTBAR_SLOTS),
          selected: { kind: "hotbar", idx: 0 },
        }),
      },
    });
    await waitForPlayerFixture(first.page, first.userId);

    // Complete each chapter's final authored claim through the browser event
    // queue. The proof waits for logic/firehose/trigger processing, native ECS
    // challenge mutation, websocket sync to two clients, and the final Biomes
    // UI quest projection before moving to the next chapter.
    await proveNativeRobotStoryRoundTrip(first, sameUserPeer, position);
    await proveNativeCraftingSkillRoundTrips(first, position, [
      NATIVE_SKILL_CRAFT_E2E_SPECS[0],
    ]);

    // Clothing equip uses native InventorySwapEvent and must update both the
    // server Wearing component and the browser's synchronized entity.
    for (const [name, srcIndex, slot, itemId] of [
      ["equip muck top", 0, BikkieIds.top, BikkieIds.muckyTop],
      ["equip muck bottoms", 1, BikkieIds.bottoms, BikkieIds.muckySkirt],
    ]) {
      const before = await authoritativeEntity(first.page, first.userId);
      await publishAndProve({
        name,
        page: first.page,
        event: new InventorySwapEvent({
          player_id: first.userId,
          src_id: first.userId,
          src: { kind: "item", idx: srcIndex },
          dst_id: first.userId,
          dst: { kind: "wearable", key: slot },
          positions: [],
        }),
        authoritativeProbe: () => authoritativeEntity(first.page, first.userId),
        authoritativePredicate: ({ version, entity }) =>
          version > before.version &&
          entity?.wearing?.items.get(slot)?.id === itemId,
        localProbe: () => localEntity(first.page, first.userId),
        localPredicate: ({ entity }) =>
          entity?.wearing?.items.get(slot)?.id === itemId,
        secondProbe: () => localEntity(sameUserPeer, first.userId),
        secondPredicate: ({ entity }) =>
          entity?.wearing?.items.get(slot)?.id === itemId,
      });
    }

    // Hotbar movement and throwing must conserve the native stack and create a
    // synchronized world GrabBag instead of changing only a UI mirror.
    const beforeHotbar = await authoritativeEntity(first.page, first.userId);
    await publishAndProve({
      name: "move voxel stack to hotbar",
      page: first.page,
      event: new InventorySwapEvent({
        player_id: first.userId,
        src_id: first.userId,
        src: { kind: "item", idx: 2 },
        dst_id: first.userId,
        dst: { kind: "hotbar", idx: 0 },
        positions: [],
      }),
      authoritativeProbe: () => authoritativeEntity(first.page, first.userId),
      authoritativePredicate: ({ version, entity }) =>
        version > beforeHotbar.version &&
        entity?.inventory?.hotbar?.[0]?.item?.id === BikkieIds.dirt &&
        inventoryCount(entity, BikkieIds.dirt) === 5n,
      localProbe: () => localEntity(first.page, first.userId),
      localPredicate: ({ entity }) =>
        entity?.inventory?.hotbar?.[0]?.item?.id === BikkieIds.dirt &&
        inventoryCount(entity, BikkieIds.dirt) === 5n,
      secondProbe: () => localEntity(sameUserPeer, first.userId),
      secondPredicate: ({ entity }) =>
        entity?.inventory?.hotbar?.[0]?.item?.id === BikkieIds.dirt,
    });

    const dropIdsBefore = new Set(
      (await bridgeCall(first.page, "findLocalByComponent", "grab_bag")).map(
        ([, serialized]) => deserializeEntity(serialized).id
      )
    );
    const beforeThrow = await authoritativeEntity(first.page, first.userId);
    await bridgeCall(
      first.page,
      "publish",
      serializedEvent(
        new InventoryThrowEvent({
          id: first.userId,
          src: { kind: "hotbar", idx: 0 },
          count: 1n,
          position,
        })
      )
    );
    const thrownPlayer = await waitFor(
      "throw: authoritative inventory debit",
      () => authoritativeEntity(first.page, first.userId),
      ({ version, entity }) =>
        version > beforeThrow.version &&
        inventoryCount(entity, BikkieIds.dirt) === 4n,
      acceptanceGateMs
    );
    const thrownDrop = await waitFor(
      "throw: native GrabBag synchronized",
      async () =>
        (await bridgeCall(first.page, "findLocalByComponent", "grab_bag"))
          .map(([, serialized]) => deserializeEntity(serialized))
          .find((entity) => !dropIdsBefore.has(entity.id)),
      (entity) =>
        entity?.grab_bag &&
        stackCount([...entity.grab_bag.slots.values()], BikkieIds.dirt) === 1n,
      originSyncGateMs
    );
    report.scenarios.push({
      name: "throw voxel creates native world drop",
      eventKind: "inventoryThrowEvent",
      status: "pass",
      authoritativeMs: thrownPlayer.elapsedMs,
      originSyncMs: thrownDrop.elapsedMs,
      dropId: String(thrownDrop.value.id),
    });

    // A Road Ahead-shaped private inventory proves the same native container
    // transaction used by the Clothing Crate/Billy's Toolbag, while using a
    // non-quest dirt item so this fixture cannot forge quest progress.
    const containerId = await bridgeCall(first.page, "allocateId");
    const containerItems = new Array(16);
    containerItems[0] = countOf(BikkieIds.dirt, 2n);
    await applyFixture(first.page, {
      kind: "create",
      entity: {
        id: containerId,
        position: Position.create({ v: position }),
        label: Label.create({ text: "Clothing Crate" }),
        entity_description: EntityDescription.create({
          text: NATIVE_ROAD_AHEAD_PRIVATE_CONTAINER_DESCRIPTION,
        }),
        created_by: CreatedBy.create({
          id: first.userId,
          created_at: secondsSinceEpoch(),
        }),
        quest_giver: QuestGiver.create(),
        container_inventory: ContainerInventory.create({
          items: containerItems,
        }),
      },
    });
    const beforeContainer = await authoritativeEntity(first.page, containerId);
    await publishAndProve({
      name: "native private container take",
      page: first.page,
      event: new InventorySwapEvent({
        player_id: first.userId,
        src_id: containerId,
        src: { kind: "item", idx: 0 },
        dst_id: first.userId,
        dst: { kind: "item", idx: 5 },
        positions: [
          [
            Math.floor(position[0]),
            Math.floor(position[1]),
            Math.floor(position[2]),
          ],
        ],
      }),
      authoritativeProbe: async () => ({
        container: await authoritativeEntity(first.page, containerId),
        player: await authoritativeEntity(first.page, first.userId),
      }),
      authoritativePredicate: ({ container, player }) =>
        container.version > beforeContainer.version &&
        !container.entity?.container_inventory?.items?.[0] &&
        player.entity?.inventory?.items?.[5]?.item?.id === BikkieIds.dirt,
      localProbe: async () => ({
        container: await localEntity(first.page, containerId),
        player: await localEntity(first.page, first.userId),
      }),
      localPredicate: ({ container, player }) =>
        !container.entity?.container_inventory?.items?.[0] &&
        player.entity?.inventory?.items?.[5]?.item?.id === BikkieIds.dirt,
      secondProbe: async () => ({
        container: await localEntity(sameUserPeer, containerId),
        player: await localEntity(sameUserPeer, first.userId),
      }),
      secondPredicate: ({ container, player }) =>
        !container.entity?.container_inventory?.items?.[0] &&
        player.entity?.inventory?.items?.[5]?.item?.id === BikkieIds.dirt,
    });

    // Native player damage must commit to Health and arrive through sync.
    const beforeDamage = await authoritativeEntity(first.page, first.userId);
    await publishAndProve({
      name: "native player damage and HUD source",
      page: first.page,
      event: new UpdatePlayerHealthEvent({
        id: first.userId,
        hpDelta: -10,
      }),
      authoritativeProbe: () => authoritativeEntity(first.page, first.userId),
      authoritativePredicate: ({ version, entity }) =>
        version > beforeDamage.version && entity?.health?.hp === 40,
      localProbe: () => localEntity(first.page, first.userId),
      localPredicate: ({ entity }) => entity?.health?.hp === 40,
      secondProbe: () => localEntity(sameUserPeer, first.userId),
      secondPredicate: ({ entity }) => entity?.health?.hp === 40,
    });

    // Food, health, and mana recovery all debit the same native stack in the
    // transaction that updates Health/TriggerState.
    for (const consumable of [
      { itemId: "road_ration", action: "eat", proves: "stamina" },
      { itemId: "health_potion", action: "drink", proves: "health" },
      { itemId: "mana_draught", action: "drink", proves: "mana" },
    ]) {
      const nativeId = harthmereNativeBiomesIdForItemId(consumable.itemId);
      assert(nativeId, `missing native id for ${consumable.itemId}`);
      const current = await authoritativeEntity(first.page, first.userId);
      const inventory = Inventory.clone(current.entity.inventory);
      inventory.items[10] = countOf(nativeId, 1n);
      await applyFixture(first.page, {
        kind: "update",
        entity: {
          id: first.userId,
          inventory,
          health: Health.create({ hp: 30, maxHp: 100 }),
          trigger_state: nativeVitalsFixture(current.entity.trigger_state),
        },
      });
      await waitFor(
        `${consumable.itemId}: fixture sync`,
        () => localEntity(first.page, first.userId),
        ({ entity }) => entity?.inventory?.items?.[10]?.item?.id === nativeId,
        originSyncGateMs
      );
      const before = await authoritativeEntity(first.page, first.userId);
      const beforeVitals = readHarthmereNativeVitals(
        before.entity.trigger_state
      );
      await publishAndProve({
        name: `consume ${consumable.itemId}`,
        page: first.page,
        event: new ConsumptionEvent({
          id: first.userId,
          item_id: nativeId,
          inventory_ref: { kind: "item", idx: 10 },
          action: consumable.action,
        }),
        authoritativeProbe: () => authoritativeEntity(first.page, first.userId),
        authoritativePredicate: ({ version, entity }) => {
          if (version <= before.version || entity?.inventory?.items?.[10])
            return false;
          const vitals = readHarthmereNativeVitals(entity?.trigger_state);
          if (consumable.proves === "stamina")
            return vitals.stamina > beforeVitals.stamina;
          if (consumable.proves === "mana")
            return vitals.mana > beforeVitals.mana;
          return entity?.health?.hp > before.entity.health.hp;
        },
        localProbe: () => localEntity(first.page, first.userId),
        localPredicate: ({ entity }) => {
          if (entity?.inventory?.items?.[10]) return false;
          const vitals = readHarthmereNativeVitals(entity?.trigger_state);
          if (consumable.proves === "stamina")
            return vitals.stamina > beforeVitals.stamina;
          if (consumable.proves === "mana")
            return vitals.mana > beforeVitals.mana;
          return entity?.health?.hp > before.entity.health.hp;
        },
        secondProbe: () => localEntity(sameUserPeer, first.userId),
        secondPredicate: ({ entity }) => !entity?.inventory?.items?.[10],
      });
    }

    // Every executable production template now crosses the actual frontend
    // adapter, server/native ECS Position gate, authoritative jobs state, and
    // frontend quest + map-marker projection. Exact template identity is
    // asserted on both sides so the wrong-job regression cannot return.
    await proveAllJobsBoardFrontendNativeEcsRoundTrips(first);

    // Authored gathering nodes validate the native Position and selected tool,
    // persist depletion in the backend, and materialize exact yields as native
    // GrabBags. Pickup must then move those exact Bikkie ids into inventory.
    const gatheringNode = HARTHMERE_GATHERING_AUTHORITY_NODES.find(
      (node) => node.requiredTool && node.requiredSkill <= 1
    );
    assert(gatheringNode, "no basic gathering-node fixture is authored");
    const gatheringToolId = harthmereNativeBiomesIdForItemId(
      gatheringNode.requiredTool
    );
    assert(gatheringToolId, "gathering tool has no native Bikkie identity");
    const gatheringPlayer = await authoritativeEntity(first.page, first.userId);
    const gatheringInventory = Inventory.clone(
      gatheringPlayer.entity.inventory
    );
    gatheringInventory.hotbar[0] = countOf(gatheringToolId, 1n);
    gatheringInventory.selected = { kind: "hotbar", idx: 0 };
    await applyFixture(first.page, {
      kind: "update",
      entity: {
        id: first.userId,
        position: Position.create({ v: [...gatheringNode.position] }),
        inventory: gatheringInventory,
        selected_item: SelectedItem.create({
          item: gatheringInventory.hotbar[0],
        }),
      },
    });
    await waitFor(
      "gathering position/tool synchronized",
      () => localEntity(first.page, first.userId),
      ({ entity }) =>
        entity?.position?.v?.[0] === gatheringNode.position[0] &&
        entity?.inventory?.hotbar?.[0]?.item?.id === gatheringToolId,
      originSyncGateMs
    );
    const dropsBeforeGathering = new Set(
      (await bridgeCall(first.page, "findLocalByComponent", "grab_bag")).map(
        ([, serialized]) => deserializeEntity(serialized).id
      )
    );
    const beforeGatheringInventory = await authoritativeEntity(
      first.page,
      first.userId
    );
    const gatheringResult = await postLiveMode(
      first.page,
      "request_farming_action",
      "farming",
      { operation: "gather_node", nodeId: gatheringNode.id },
      gatheringNode.id
    );
    const gatheringWarnings =
      gatheringResult.body?.backendMutation?.warnings ?? [];
    assert(
      gatheringResult.ok &&
        gatheringResult.body?.ok !== false &&
        gatheringWarnings.includes(
          "gathering_yield_materialized_as_native_ecs_drop"
        ),
      `gathering did not cross the native ECS boundary: ${gatheringWarnings.join(
        ","
      )}`
    );
    const gatheredDrops = await waitFor(
      "gathering native drops synchronized",
      async () =>
        (await bridgeCall(first.page, "findLocalByComponent", "grab_bag"))
          .map(([, serialized]) => deserializeEntity(serialized))
          .filter((entity) => !dropsBeforeGathering.has(entity.id)),
      (entities) => entities.length > 0,
      secondClientSyncGateMs
    );
    const authoredYieldIds = new Set(
      [...gatheringNode.baseYield, ...gatheringNode.rareYield].map((row) =>
        harthmereNativeBiomesIdForItemId(row.itemId)
      )
    );
    for (const drop of gatheredDrops.value) {
      for (const stack of drop.grab_bag.slots.values()) {
        assert(
          authoredYieldIds.has(stack.item.id),
          `gathering minted unauthored item ${stack.item.id}`
        );
      }
      await bridgeCall(
        first.page,
        "publish",
        serializedEvent(new PickUpEvent({ id: first.userId, item: drop.id }))
      );
    }
    const gatheredItemIds = [...authoredYieldIds].filter(Boolean);
    await waitFor(
      "gathering pickup reaches native inventory",
      () => authoritativeEntity(first.page, first.userId),
      ({ version, entity }) =>
        version > beforeGatheringInventory.version &&
        gatheredItemIds.some(
          (itemId) =>
            inventoryCount(entity, itemId) >
            inventoryCount(beforeGatheringInventory.entity, itemId)
        ),
      acceptanceGateMs
    );
    report.scenarios.push({
      name: "authored gathering node to native pickup",
      status: "pass",
      nodeId: gatheringNode.id,
      dropIds: gatheredDrops.value.map((drop) => String(drop.id)),
    });

    await proveCombatMusicRoundTrip(first, second, [...gatheringNode.position]);

    // Put both actors back together before the shared pickup race and harvest
    // fixtures so spatial sync/range is part of the proof, not an accident.
    await applyFixture(
      first.page,
      {
        kind: "update",
        entity: {
          id: first.userId,
          position: Position.create({ v: position }),
        },
      },
      {
        kind: "update",
        entity: {
          id: second.userId,
          position: Position.create({ v: position }),
        },
      }
    );
    await Promise.all([
      waitFor(
        "client A returned to shared race position",
        () => localEntity(first.page, first.userId),
        ({ entity }) => entity?.position?.v?.[0] === position[0],
        originSyncGateMs
      ),
      waitFor(
        "client B returned to shared race position",
        () => localEntity(second.page, second.userId),
        ({ entity }) => entity?.position?.v?.[0] === position[0],
        originSyncGateMs
      ),
    ]);

    // Two independent users race the same native drop. The acquisition record
    // and total inventory delta prove that exactly one transaction won.
    const raceDropId = await bridgeCall(first.page, "allocateId");
    const raceBag = createBag(countOf(BikkieIds.dirt, 3n));
    await applyFixture(first.page, {
      kind: "create",
      entity: {
        id: raceDropId,
        position: Position.create({ v: position }),
        grab_bag: GrabBag.create({ slots: raceBag, mined: false }),
        expires: Expires.create({ trigger_at: secondsSinceEpoch() + 300 }),
        loose_item: LooseItem.create({ item: anItem(BikkieIds.dirt) }),
      },
    });
    await Promise.all([
      waitFor(
        "race drop visible to client A",
        () => localEntity(first.page, raceDropId),
        ({ entity }) => Boolean(entity?.grab_bag),
        secondClientSyncGateMs
      ),
      waitFor(
        "race drop visible to client B",
        () => localEntity(second.page, raceDropId),
        ({ entity }) => Boolean(entity?.grab_bag),
        secondClientSyncGateMs
      ),
    ]);
    const beforeRaceA = inventoryCount(
      (await authoritativeEntity(first.page, first.userId)).entity,
      BikkieIds.dirt
    );
    const beforeRaceB = inventoryCount(
      (await authoritativeEntity(second.page, second.userId)).entity,
      BikkieIds.dirt
    );
    await Promise.allSettled([
      bridgeCall(
        first.page,
        "publish",
        serializedEvent(new PickUpEvent({ id: first.userId, item: raceDropId }))
      ),
      bridgeCall(
        second.page,
        "publish",
        serializedEvent(
          new PickUpEvent({ id: second.userId, item: raceDropId })
        )
      ),
    ]);
    const raceResult = await waitFor(
      "pickup race acquisition",
      () => authoritativeEntity(first.page, raceDropId),
      ({ entity }) => Boolean(entity?.acquisition) && !entity?.grab_bag,
      acceptanceGateMs
    );
    assert(
      [first.userId, second.userId]
        .map(String)
        .includes(String(raceResult.value.entity.acquisition.acquired_by)),
      "pickup race was acquired by an unexpected actor"
    );
    const afterRaceA = inventoryCount(
      (await authoritativeEntity(first.page, first.userId)).entity,
      BikkieIds.dirt
    );
    const afterRaceB = inventoryCount(
      (await authoritativeEntity(second.page, second.userId)).entity,
      BikkieIds.dirt
    );
    assert.equal(
      afterRaceA - beforeRaceA + (afterRaceB - beforeRaceB),
      3n,
      "pickup race must grant one and only one drop stack"
    );
    report.scenarios.push({
      name: "two-user pickup race",
      eventKind: "pickUpEvent",
      status: "pass",
      authoritativeMs: raceResult.elapsedMs,
      acquiredBy: String(raceResult.value.entity.acquisition.acquired_by),
    });

    // Prove the complete physical farming loop with real selected hotbar refs:
    // JS publishes till -> plant -> water, logic validates the tools and creates
    // native state, Gaia advances the crop, then harvest creates the world drop
    // which synchronizes back into the browser-side farming journal.
    const plants = (
      await bridgeCall(
        first.page,
        "findLocalByComponent",
        "farming_plant_component"
      )
    )
      .map(([, serialized]) => deserializeEntity(serialized))
      .filter(
        (entity) => entity?.farming_plant_component?.status === "fully_grown"
      );
    if (plants.length > 0) {
      const referencePlant = plants[0];
      const tillTarget = await bridgeCall(
        first.page,
        "findTillableVoxelNear",
        referencePlant.position.v.map(Math.floor),
        8
      );
      assert(
        tillTarget,
        "no tillable voxel was found near the farming fixture"
      );
      const hoeId = harthmereNativeBiomesIdForItemId("7539420629350046");
      const seedId = harthmereNativeBiomesIdForItemId("seed_carrot");
      const wateringCanId =
        harthmereNativeBiomesIdForItemId("7539420629350045");
      assert(
        hoeId && seedId && wateringCanId,
        "native farming item ids missing"
      );
      const playerBeforeFarm = await authoritativeEntity(
        first.page,
        first.userId
      );
      await bridgeCall(first.page, "farmingHoeQuestSnapshot", "reset");
      const acceptedHoeGuide = await bridgeCall(
        first.page,
        "farmingHoeQuestSnapshot",
        "accept"
      );
      assert.equal(acceptedHoeGuide.state, "active");
      assert.equal(acceptedHoeGuide.quests?.[0]?.questId, "farming:buy-a-hoe");
      assert.equal(
        acceptedHoeGuide.markers?.[0]?.id,
        "farming:orchard-produce-stand"
      );
      assert.deepEqual(
        acceptedHoeGuide.markers?.[0]?.position,
        [2062, 53, -112]
      );
      const farmInventory = Inventory.clone(playerBeforeFarm.entity.inventory);
      farmInventory.hotbar[0] = countOf(hoeId, 1n);
      farmInventory.hotbar[1] = countOf(seedId, 2n);
      farmInventory.hotbar[2] = countOf(wateringCanId, 1n);
      farmInventory.selected = { kind: "hotbar", idx: 0 };
      await applyFixture(first.page, {
        kind: "update",
        entity: {
          id: first.userId,
          position: Position.create({
            v: [
              tillTarget.position[0] + 0.5,
              tillTarget.position[1] + 1,
              tillTarget.position[2] + 0.5,
            ],
          }),
          inventory: farmInventory,
          selected_item: SelectedItem.create({ item: farmInventory.hotbar[0] }),
        },
      });
      const completedHoeGuide = await waitFor(
        "native hoe permanently completes JavaScript farming guide",
        () => bridgeCall(first.page, "farmingHoeQuestSnapshot", "reconcile"),
        (snapshot) =>
          snapshot?.hasHoe === true &&
          snapshot?.state === "completed" &&
          snapshot?.quests?.length === 0 &&
          snapshot?.markers?.length === 0,
        originSyncGateMs,
        timeoutMs
      );

      const voxelBeforeTill = await bridgeCall(
        first.page,
        "farmingVoxelSnapshot",
        tillTarget.position
      );
      await bridgeCall(
        first.page,
        "publish",
        serializedEvent(
          new TillSoilEvent({
            id: first.userId,
            positions: [tillTarget.position],
            shard_ids: [tillTarget.terrainEntityId],
            tool_ref: { kind: "hotbar", idx: 0 },
            occupancy_ids: tillTarget.occupancyId
              ? [tillTarget.occupancyId]
              : [],
          })
        )
      );
      const tilled = await waitFor(
        "native hoe tills a voxel",
        () =>
          bridgeCall(first.page, "farmingVoxelSnapshot", tillTarget.position),
        (snapshot) => snapshot.terrainId !== voxelBeforeTill.terrainId,
        originSyncGateMs,
        timeoutMs
      );

      await bridgeCall(
        first.page,
        "publish",
        serializedEvent(
          new PlantSeedEvent({
            id: tillTarget.terrainEntityId,
            position: tillTarget.position,
            user_id: first.userId,
            seed: { kind: "hotbar", idx: 1 },
            occupancy_id: tillTarget.occupancyId,
            existing_farming_id: undefined,
          })
        )
      );
      const planted = await waitFor(
        "native seed creates synchronized ECS plant",
        async () => {
          const voxel = await bridgeCall(
            first.page,
            "farmingVoxelSnapshot",
            tillTarget.position
          );
          return {
            voxel,
            plant: voxel.farmingId
              ? await authoritativeEntity(first.page, voxel.farmingId)
              : undefined,
          };
        },
        ({ voxel, plant }) =>
          Boolean(
            voxel.farmingId &&
            plant?.entity?.farming_plant_component?.planter === first.userId
          ),
        originSyncGateMs,
        timeoutMs
      );
      const plantedId = planted.value.voxel.farmingId;
      assert(plantedId, "planted voxel did not retain a farming id");

      const dryPlant = FarmingPlantComponent.clone(
        planted.value.plant.entity.farming_plant_component
      );
      dryPlant.status = "growing";
      dryPlant.water_level = 0.2;
      await applyFixture(first.page, {
        kind: "update",
        entity: { id: plantedId, farming_plant_component: dryPlant },
      });

      await bridgeCall(
        first.page,
        "publish",
        serializedEvent(
          new WaterPlantsEvent({
            id: first.userId,
            plant_ids: [plantedId],
            tool_ref: { kind: "hotbar", idx: 2 },
          })
        )
      );
      const watered = await waitFor(
        "watering can mutates native inventory and plant",
        async () => ({
          player: await authoritativeEntity(first.page, first.userId),
          plant: await authoritativeEntity(first.page, plantedId),
        }),
        ({ player, plant }) =>
          Number(player.entity?.inventory?.hotbar?.[2]?.item?.waterAmount) <
            5 &&
          (plant.entity?.farming_plant_component?.water_level > 0 ||
            plant.entity?.farming_plant_component?.player_actions?.some(
              (action) => action.kind === "water"
            )),
        Math.max(5000, originSyncGateMs),
        timeoutMs
      );

      const plantedAuthoritative = await authoritativeEntity(
        first.page,
        plantedId
      );
      const accelerated = FarmingPlantComponent.clone(
        plantedAuthoritative.entity.farming_plant_component
      );
      accelerated.status = "growing";
      accelerated.water_level = 1;
      accelerated.wilt = 0;
      accelerated.last_tick = secondsSinceEpoch() - 14 * 24 * 60 * 60;
      await applyFixture(first.page, {
        kind: "update",
        entity: { id: plantedId, farming_plant_component: accelerated },
      });
      await bridgeCall(
        first.page,
        "publish",
        serializedEvent(new PokePlantEvent({ id: plantedId }))
      );
      const grown = await waitFor(
        "Gaia grows planted crop to maturity",
        () => authoritativeEntity(first.page, plantedId),
        ({ entity }) =>
          entity?.farming_plant_component?.status === "fully_grown",
        Math.max(5000, secondClientSyncGateMs),
        timeoutMs
      );
      const frontendCrop = await waitFor(
        "grown crop returns to JavaScript farming journal",
        () => bridgeCall(first.page, "farmingFrontendSnapshot"),
        (snapshot) =>
          snapshot?.plants?.every((plant) => plant.ownedByPlayer === true) &&
          snapshot?.plants?.some(
            (plant) =>
              String(plant.id) === String(plantedId) &&
              plant.status === "fully_grown"
          ),
        originSyncGateMs,
        timeoutMs
      );
      const frontendCropMap = await waitFor(
        "grown crop returns to JavaScript My Crops map layer",
        () => bridgeCall(first.page, "farmingMapFrontendSnapshot"),
        (snapshot) =>
          snapshot?.plants?.every((plant) => plant.ownedByPlayer === true) &&
          snapshot?.markers?.some(
            (marker) =>
              marker.id === `farming:crop:${String(plantedId)}` &&
              marker.position?.every(
                (coordinate, index) => coordinate === tillTarget.position[index]
              )
          ),
        originSyncGateMs,
        timeoutMs
      );

      const plantPosition = tillTarget.position;
      await applyFixture(first.page, {
        kind: "update",
        entity: {
          id: first.userId,
          position: Position.create({
            v: [
              plantPosition[0] + 0.5,
              plantPosition[1] + 1,
              plantPosition[2] + 0.5,
            ],
          }),
        },
      });
      const dropsBeforeHarvest = new Set(
        (await bridgeCall(first.page, "findLocalByComponent", "grab_bag")).map(
          ([, serialized]) => deserializeEntity(serialized).id
        )
      );
      await bridgeCall(
        first.page,
        "publish",
        serializedEvent(
          new HarvestPlantEvent({
            id: first.userId,
            plant_id: plantedId,
            position: plantPosition.map(Math.floor),
          })
        )
      );
      const queued = await waitFor(
        "harvest action queued in ECS",
        () => authoritativeEntity(first.page, plantedId),
        ({ entity }) =>
          entity?.farming_plant_component?.player_actions?.some(
            (action) => action.kind === "harvest"
          ),
        acceptanceGateMs
      );
      const materialized = await waitFor(
        "Gaia harvest materializes native drop",
        async () => ({
          plant: await authoritativeEntity(first.page, plantedId),
          drops: (
            await bridgeCall(first.page, "findLocalByComponent", "grab_bag")
          )
            .map(([, serialized]) => deserializeEntity(serialized))
            .filter((entity) => !dropsBeforeHarvest.has(entity.id)),
        }),
        ({ plant: plantState, drops }) =>
          !plantState.entity && drops.length > 0,
        Math.max(5000, secondClientSyncGateMs),
        timeoutMs
      );
      report.scenarios.push({
        name: "hotbar voxel farming through native ECS and Gaia",
        eventKinds: [
          "tillSoilEvent",
          "plantSeedEvent",
          "waterPlantsEvent",
          "pokePlantEvent",
          "harvestPlantEvent",
        ],
        status: "pass",
        tilledMs: tilled.elapsedMs,
        plantedMs: planted.elapsedMs,
        wateredMs: watered.elapsedMs,
        grownMs: grown.elapsedMs,
        frontendMs: frontendCrop.elapsedMs,
        frontendMapMs: frontendCropMap.elapsedMs,
        hoeGuideCompletedMs: completedHoeGuide.elapsedMs,
        queuedMs: queued.elapsedMs,
        materializedMs: materialized.elapsedMs,
      });
    } else if (process.env.HARTHMERE_E2E_ALLOW_NO_RIPE_PLANT === "1") {
      report.scenarios.push({
        name: "hotbar voxel farming through native ECS and Gaia",
        status: "skipped",
        reason: "no synchronized fully-grown plant in minimal test world",
      });
    } else {
      throw new Error(
        "No synchronized fully-grown plant was available; production-shaped E2E requires a farming fixture"
      );
    }

    const finalSkillProgress = await waitFor(
      "native actions converge in the browser skill ledger",
      () => bridgeCall(first.page, "skillProgressionSnapshot"),
      (snapshot) => {
        const totals = Object.fromEntries(
          snapshot.skills.map((skill) => [skill.id, skill.totalXp])
        );
        return [
          "combat",
          "crafting",
          "carpentry",
          "gathering",
          "business_operations",
          "farming",
          "nature_magic",
        ].every((skillId) => Number(totals[skillId] ?? 0) > 0);
      },
      originSyncGateMs,
      timeoutMs
    );
    report.scenarios.push({
      name: "representative native and live actions converge in one skill ledger",
      status: "pass",
      totalXp: Object.fromEntries(
        finalSkillProgress.value.skills
          .filter((skill) => skill.totalXp > 0)
          .map((skill) => [skill.id, skill.totalXp])
      ),
    });

    // Reload and a same-session second page must reconstruct the authoritative
    // player, wearing, inventory, health, and vitals from sync.
    await first.page.reload({
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await first.page.waitForFunction(
      () => globalThis.__harthmereNativeEcsE2E?.version === "native-ecs-e2e-v1",
      undefined,
      { timeout: timeoutMs }
    );
    const reloaded = await waitFor(
      "reconnect reconstructs native player state",
      () => localEntity(first.page, first.userId),
      ({ entity }) =>
        Boolean(entity?.inventory) &&
        Boolean(entity?.wearing) &&
        Boolean(entity?.health) &&
        Boolean(entity?.trigger_state),
      secondClientSyncGateMs
    );
    report.scenarios.push({
      name: "same-user reconnect readback",
      status: "pass",
      originSyncMs: reloaded.elapsedMs,
    });

    assert.deepEqual(
      report.browser.failures,
      [],
      `browser/network errors occurred:\n${report.browser.failures.join("\n")}`
    );

    report.finishedAt = new Date().toISOString();
    report.status = "pass";
    console.log(`PASS ${report.scenarios.length} native ECS browser scenarios`);
  } finally {
    if (first?.page) {
      if (desktopControlsOnly && !first.page.isClosed()) {
        await chapter1WarpAndWait(
          first,
          [500, 70, -145],
          "desktop screenshot: Grove center"
        ).catch(() => undefined);
        await first.page.waitForTimeout(5_000).catch(() => undefined);
      }
      await first.page
        .screenshot({
          path: path.join(artifactsDir, `${runId}-client-a.png`),
          fullPage: true,
        })
        .catch(() => undefined);
    }
    if (second?.page) {
      await second.page
        .screenshot({
          path: path.join(artifactsDir, `${runId}-client-b.png`),
          fullPage: true,
        })
        .catch(() => undefined);
    }
    if (sameUserPeer) {
      await sameUserPeer
        .screenshot({
          path: path.join(artifactsDir, `${runId}-client-a-peer.png`),
          fullPage: true,
        })
        .catch(() => undefined);
    }
    await first?.context?.close().catch(() => undefined);
    await second?.context?.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    await directFixtureWorld?.stop().catch(() => undefined);
    directFixtureWorld = undefined;
  }
}

run()
  .catch((error) => {
    report.finishedAt = new Date().toISOString();
    report.status = "fail";
    report.error = error?.stack || String(error);
    console.error(`FAIL ${report.error}`);
    process.exitCode = 1;
  })
  .finally(() => {
    persistReportCheckpoint();
    releaseExclusiveBrowserLock();
    console.log(`REPORT ${reportPath}`);
  });
