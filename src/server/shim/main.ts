import { BACKUP_BIKKIE_TRAY_ID } from "@/server/backup/serde";
import { resetPlayerDelta } from "@/server/logic/utils/players";
import { parseArgs, stringLiteralCtor } from "@/server/shared/args";
import { encodeNames } from "@/server/shared/bikkie/bakery";
import {
  loadBakedTrayFromProd,
  loadTrayDefinitionFromProd,
} from "@/server/shared/bikkie/dev";
import {
  ExposeBikkieStorageService,
  zShimBikkieStorageService,
} from "@/server/shared/bikkie/storage/shim";
import type {
  Bootstrap,
  BootstrapMode,
} from "@/server/shared/bootstrap/bootstrap";
import { registerBootstrap } from "@/server/shared/bootstrap/bootstrap";
import type { ChatApi } from "@/server/shared/chat/api";
import { InMemoryChatApi } from "@/server/shared/chat/memory";
import type { PlayerSpatialObserver } from "@/server/shared/chat/player_observer";
import { registerPlayerSpatialObserver } from "@/server/shared/chat/player_observer";
import { ExposeChatService, zChatService } from "@/server/shared/chat/remote";
import type { SharedServerContext } from "@/server/shared/context";
import { sharedServerContext } from "@/server/shared/context";
import { createShimServiceDiscovery } from "@/server/shared/discovery/discovery";
import { zServiceDiscoveryService } from "@/server/shared/discovery/remote";
import {
  ShimNotifierService,
  zShimNotifierService,
} from "@/server/shared/distributed_notifier/shim";
import type { Firehose } from "@/server/shared/firehose/api";
import { InMemoryFirehose } from "@/server/shared/firehose/memory";
import {
  ExposeFirehoseService,
  zRemoteFirehoseService,
} from "@/server/shared/firehose/remote";
import { runServer } from "@/server/shared/main";
import { HostPort } from "@/server/shared/ports";
import {
  ShimPubSubService,
  zShimPubSubService,
} from "@/server/shared/pubsub/shim";
import type { BaseServerConfig } from "@/server/shared/server_config";
import {
  applyGlitchRuntimeDefaults,
  baseServerArgumentConfig,
} from "@/server/shared/server_config";
import type { BDB } from "@/server/shared/storage";
import { registerBiomesStorage } from "@/server/shared/storage";
import {
  ExposeStorageService,
  zRemoteStorageService,
} from "@/server/shared/storage/remote";
import {
  buildHarthmereLiveEntityProductionSeedChanges,
  harthmereLiveEntityProductionSeedIds,
} from "@/server/harthmere/live_entity_ecs_seed";
import { harthmereSharedLiveCreatureRespawnRegistry } from "@/shared/harthmere/live_creature_respawn_registry";
import {
  buildHarthmereGroveRaceMinigameSeedChanges,
  harthmereGroveRaceMinigameSeedIds,
} from "@/server/harthmere/grove_race_minigame_ecs_seed";
import { reconcileSnapshotMinigameCatalog } from "@/server/harthmere/snapshot_minigame_ecs_seed";
import { buildHarthmereObsoleteSnapshotGroveNpcDeleteChanges } from "@/server/harthmere/snapshot_grove_npc_ecs_seed";
import {
  buildHarthmereBusinessOwnerNpcSeedChanges,
  harthmereBusinessOwnerNpcSeedEntityIds,
} from "@/server/harthmere/business_owner_npc_ecs_seed";
import { harthmereBusinessCustomerNpcSeedEntityIds } from "@/server/harthmere/business_customer_npc_ecs_seed";
import {
  buildHarthmereBusinessCraftingStationSeedChanges,
  harthmereBusinessCraftingStationSeedEntityIds,
} from "@/server/harthmere/business_crafting_station_ecs_seed";
import {
  buildHarthmereBusinessInteriorCollisionSeedChanges,
  harthmereBusinessInteriorCollisionSeedEntityIds,
} from "@/server/harthmere/business_interior_collision_ecs_seed";
import {
  buildHarthmereAdditiveTownInteriorCollisionSeedChanges,
  harthmereAdditiveTownInteriorCollisionSeedEntityIds,
} from "@/server/harthmere/additive_town_interior_collision_ecs_seed";
import {
  buildHarthmereAdditiveTownCookingStationSeedChanges,
  harthmereAdditiveTownCookingStationSeedEntityIds,
} from "@/server/harthmere/additive_town_cooking_station_ecs_seed";
import {
  HARTHMERE_REQUEST_BOARD_ECS_SEED_VERSION,
  buildHarthmereRequestBoardEcsSeedChanges,
  harthmereRequestBoardEcsSeedEntityIds,
} from "@/server/harthmere/request_board_ecs_seed";
import {
  HARTHMERE_BUSINESS_AISLE_NPC_SWEEP_VERSION,
  applyHarthmereBusinessAisleKeepOutToSeedChanges,
} from "@/server/harthmere/business_aisle_npc_sweep";
import {
  buildChapter1PropSeedChanges,
  chapter1PropSeedIds,
} from "@/server/harthmere/ch1_prop_ecs_seed";
import { CH1_PROP_SEED_VERSION } from "@/shared/harthmere/ch1_prop_seed";
import {
  HARTHMERE_PLAYER_LIKE_NPC_COSMETIC_RESET_VERSION,
  prepareHarthmerePlayerLikeNpcForUniqueAppearance,
} from "@/server/harthmere/player_like_npc_cosmetics";
import { HARTHMERE_BUSINESS_CRAFTING_STATION_SEED_VERSION } from "@/shared/harthmere/business_crafting_station_seed";
import { HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEED_VERSION } from "@/shared/harthmere/business_interior_collision_seed";
import { HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEED_VERSION } from "@/shared/harthmere/additive_town_interior_collision_seed";
import { HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEED_VERSION } from "@/shared/harthmere/additive_town_cooking_station_seed";
import { HARTHMERE_BUSINESS_OWNER_NPC_SEED_VERSION } from "@/shared/harthmere/business_owner_npc_seed";
import { HARTHMERE_BUSINESS_CUSTOMER_NPC_SEED_VERSION } from "@/shared/harthmere/business_customer_npc_seed";
import {
  HARTHMERE_LIVE_ENTITY_PRODUCTION_SEED_VERSION,
  harthmereExcludedMuckMonsterSeedIds,
} from "@/shared/harthmere/live_entity_production_seed";
import { HARTHMERE_GROVE_RACE_MINIGAME_SEED_VERSION } from "@/shared/harthmere/grove_race_minigame_seed";
import type { WorldApi } from "@/server/shared/world/api";
import { npcEntity } from "@/server/spawn/spawn_npc";
import { registerWorldApi } from "@/server/shared/world/register";
import {
  ShimWorldApi,
  ShimWorldService,
  zWorldService,
} from "@/server/shared/world/shim/api";
import { InMemoryWorld } from "@/server/shared/world/shim/in_memory_world";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import {
  terrainSeedEntityForWrite,
  terrainSeedMigrationMode,
  terrainSeedModeRewritesExistingShards,
} from "@/server/shim/terrain_seed_migration";
import { partitionTerrainSeedIds } from "@/server/shim/terrain_seed_partition";
import {
  snapshotNpcGroundingRepairSatisfied,
  snapshotNpcGroundingRepairTarget,
  type SnapshotNpcGroundingRepair,
} from "@/server/shim/snapshot_npc_grounding_repair";
import type { ZrpcServer } from "@/server/shared/zrpc/server";
import { registerRpcServer } from "@/server/shared/zrpc/server";
import {
  getTerrainID,
  safeGetTerrainId,
  type TerrainID,
} from "@/shared/asset_defs/terrain";
import { getBiscuits } from "@/shared/bikkie/active";
import { BikkieIds } from "@/shared/bikkie/ids";
import { using } from "@/shared/deletable";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import {
  Box,
  EntityDescription,
  Health,
  NpcMetadata,
  QuestGiver,
  Size,
  ShardDiff,
  ShardMuck,
  ShardSeed,
  ShardShapes,
  ShardWater,
  Voice,
  WorldMetadata,
  type ReadonlyWorldMetadata,
} from "@/shared/ecs/gen/components";
import { WorldMetadataId } from "@/shared/ecs/ids";
import { isPlayer } from "@/shared/game/players";
import { loadSeed } from "@/shared/game/terrain";
import {
  HARTHMERE_EXTENSION_SURFACE_REPAIR_VERSION,
  harthmereSurfaceRepairShardSpecs,
} from "@/shared/harthmere/extension_surface_repair";
import {
  harthmereExtensionEdgeHorizonBlockAt,
  harthmereExtensionEdgeHorizonShardSpecs,
  type HarthmereExtensionEdgeHorizonMaterial,
} from "@/shared/harthmere/extension_edge_horizon";
import {
  harthmereAdditiveTownNpcDialogueForOffset,
  harthmereAdditiveTownNpcVoiceProfile,
} from "@/shared/harthmere/additive_town_npc_dialogue";
import {
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_NPC_ANCHORS,
  HARTHMERE_ADDITIVE_TOWN_INTERIORS_VERSION,
  harthmereAdditiveTownInteriorNpcAnchor,
} from "@/shared/harthmere/harthmere_additive_town_interiors";
import {
  SHARD_DIM,
  shardDecode,
  shardToVoxelPos,
  voxelShard,
} from "@/shared/game/shard";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import type { RegistryLoader } from "@/shared/registry";
import type { VoxelooModule } from "@/shared/wasm/types";
import {
  LOCAL_DEV_HUMAN_NPC_TYPE_ID,
  LOCAL_DEV_WALKER_NPC_TYPE_ID,
  isNpcTypeId,
} from "@/shared/npc/bikkie";
import type { Vec2, Vec3 } from "@/shared/math/types";
import { Sparse3 } from "@/shared/util/sparse";
import { saveBlock } from "@/shared/wasm/biomes";
import { Tensor } from "@/shared/wasm/tensors";
import { RegistryBuilder } from "@/shared/registry";
import {
  makeHarthmereNpcAppearanceConfig,
  makeHarthmereNpcBodyConfig,
  makeHarthmereNpcFaceConfig,
  withHarthmereAppearanceMarker,
  withHarthmereBodyAndFaceMarkers,
  type HarthmereVoxelBodyConfig,
  type HarthmereVoxelFaceConfig,
} from "@/shared/harthmere/voxel_faces";
import { HARTHMERE_PLAYER_LIKE_NPC_VARIANT_VERSION } from "@/shared/harthmere/npc_playerlike_variants";
import {
  SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS,
  SNAPSHOT_HARTHMERE_MUCK_ZONES,
  isAuthoredPointInSnapshotMuckZone,
  snapshotCombatGroundedPosition,
} from "@/shared/harthmere/snapshot_runtime_rules";
import {
  SNAPSHOT_GROVE_NPCS,
  SNAPSHOT_GROVE_NPC_GROUNDING_VERSION,
  snapshotGroveGroundedPosition,
  snapshotGroveNpcEntityId,
} from "@/shared/harthmere/snapshot_grove_content";
import {
  SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS,
  SNAPSHOT_GROVE_RHIAMON_DRY_POSITION,
  SNAPSHOT_GROVE_RHIAMON_ENTITY_ID,
} from "@/shared/harthmere/snapshot_grove_ids";
import { harthmereExoticMatterDepositAtBlock } from "@/shared/harthmere/exotic_matter_caves";
import { createHarthmereBusinessOutpostRebuildMaterializationPlans } from "@/shared/harthmere/business_customer_simulator";
import { HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST } from "@/shared/harthmere/harthmere_native_quest_manifest";
import { CH1_NEW_CAST, CH1_SEEDED_CAST } from "@/shared/harthmere/ch1_cast";
import {
  CH1_RETIRED_DUPLICATE_TESTIMONY_NPC_IDS,
  CH1_TESTIMONY_NPC_SEEDS,
  CH1_TESTIMONY_NPC_SEED_VERSION,
} from "@/shared/harthmere/ch1_testimony_npcs";
import { CH1_RETURNING_NPC_SEED_VERSION } from "@/shared/harthmere/ch1_returning_npcs";
import { CH1_DUNGEON_ENCOUNTER_NPCS } from "@/shared/harthmere/ch1_dungeon_encounters";
import {
  CH1_DUNGEON_TERRAIN_VERSION,
  ch1DungeonBlockAt,
  ch1DungeonAuthoredToWorld,
  ch1DungeonShardSpecs,
  ch1DungeonWaterAt,
  ch1DungeonWorldToAuthored,
} from "@/shared/harthmere/ch1_dungeon_terrain";
import {
  CH1_ELSEWHEN_BAND_END_X,
  ch1NormalizeOrdinaryWorldEastEdge,
  ch1ElsewhenSlotAt,
  ch1ElsewhenTerrainEntityIdForShard,
} from "@/shared/harthmere/ch1_elsewhen_region";
import { findNearestHarthmereProductionPlacement } from "@/shared/harthmere/production_terrain_placement_map";
import { harthmereBuildingInteriorBlockAt } from "@/shared/harthmere/harthmere_building_interiors";
import {
  HARTHMERE_ADDITIONAL_SERVER_STRUCTURES,
  HARTHMERE_BUILDINGS,
  harthmereStairsFor,
  type HarthmereBuilding,
  type HarthmereMat as HarthmereBuildingMat,
  type HarthmereStairs,
} from "@/shared/harthmere/harthmere_town_buildings";
import {
  HARTHMERE_TOWN_STREETS_VERSION,
  harthmereTownStreetSurfaceAt,
} from "@/shared/harthmere/harthmere_town_streets";
import {
  HARTHMERE_BUILDING_STYLE_VERSION,
  harthmereBuildingFacadeMaterialAt,
  harthmereBuildingRoofBlockAt,
  harthmereBuildingTopRelY,
} from "@/shared/harthmere/harthmere_building_style";
import {
  HARTHMERE_TOWN_SURFACE_STYLE_VERSION,
  harthmereTownSurfaceMaterialAt,
} from "@/shared/harthmere/harthmere_town_surface";
import {
  HARTHMERE_NPC_POPULATION_POLICY_VERSION,
  HARTHMERE_RETIRED_GENERIC_TOWNSPERSON_IDS,
  shouldRetireGenericHarthmereTownsperson,
} from "@/shared/harthmere/harthmere_npc_population_policy";
import {
  HARTHMERE_FOREST_MAX_HEIGHT,
  harthmereWildsForestBlockAt,
  harthmereWildsGroundCoverAt,
} from "@/shared/harthmere/harthmere_wilds_forest";
import {
  HARTHMERE_STILL_WATER_MAX_REL_Y,
  HARTHMERE_STILL_WATER_MIN_REL_Y,
  harthmereStillWaterBlockAt,
  harthmereStillWaterContains,
  harthmereStillWaterCarvesAirAt,
  harthmereStillWaterLevelAt,
  harthmereStillWaterTouchesAuthoredSpan,
} from "@/shared/harthmere/harthmere_still_water";
import {
  HARTHMERE_RIVER_MAX_CARVE_DEPTH,
  harthmereRiverBedMaterialAt,
  harthmereRiverCarvesAirAt,
  harthmereRiverContains,
  harthmereRiverCrossingDeckAt,
  harthmereRiverExcludesVegetation,
  harthmereRiverTouchesAuthoredSpan,
  harthmereRiverWaterLevelAt,
} from "@/shared/harthmere/harthmere_river";
import { HARTHMERE_TOWN_BACK_BOUNDARY_X } from "@/shared/harthmere/harthmere_town_horizon";
import { isHarthmereBuildingVegetationExclusion } from "@/shared/harthmere/harthmere_building_exclusion";
import { HARTHMERE_ICED_BOARD_ENTITY_IDS } from "@/shared/harthmere/native_request_boards";
import {
  harthmereShardHasAuthoredWater,
  isHarthmereAuthoredWaterColumn,
} from "@/shared/harthmere/harthmere_authored_water";
import {
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
  HARTHMERE_ADDITIVE_TOWN_OFFSET_Z,
  HARTHMERE_ADDITIVE_WORLD_EXTENSION_VERSION,
  HARTHMERE_BELLBINDER_DESCENT,
  HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X,
  HARTHMERE_EXTENSION_FEET_Y,
  HARTHMERE_EXTENSION_TERRAIN_ENTITY_ID_BASE,
  HARTHMERE_EXTENSION_TERRAIN_ENTITY_ID_LIMIT,
  HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
  HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_BASE,
  HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_LIMIT,
  expandWorldAabbForHarthmere,
  harthmereBellbinderDescentFloorBlocks,
  harthmereExtensionFoundationShardSpecs,
  harthmereExtensionTerrainEntityIdForShard,
  initialHarthmereWorldAabb,
  isHarthmereExtensionWorldPosition,
  isHarthmereExtensionWorldShardX,
  shouldEnableHarthmereAdditiveWorldExtension,
} from "@/shared/harthmere/world_extension";

export interface ShimServerConfig extends BaseServerConfig {
  bootstrapMode: BootstrapMode;
}

export async function registerShimServerConfig(): Promise<ShimServerConfig> {
  const config = await parseArgs<ShimServerConfig>({
    ...baseServerArgumentConfig,
    bootstrapMode: {
      type: stringLiteralCtor("sync", "empty"),
      defaultValue: "sync",
    },
  });
  return applyGlitchRuntimeDefaults(config);
}

async function registerShimWorldService(
  loader: RegistryLoader<ShimServerContext>
) {
  const config = await loader.get("config");
  if (config.worldApiMode !== "shim") {
    return;
  }
  const firehose = await loader.get("firehose");
  return new ShimWorldService(new InMemoryWorld(true, firehose));
}

// v3 (2026-07-28): the 2026-07-28 HAR capture proved that some SURFACE shards
// (the shardY=1 layer that owns the flat cap at Y=52) never made it into the
// live ECS, so those columns fell through to the foundation top at Y=31 and
// read as 32x32 black pits in the wilds forest. Bumping this version records a
// new authored baseline. Ordinary additive deployments still repair only
// missing/invalid authored seeds; applying a changed baseline to existing
// shards requires the explicit overlay-preserving terrain migration mode.
const HARTHMERE_LOCAL_DEV_TERRAIN_BOUNDS_VERSION =
  "harthmere-local-dev-terrain-v4-unreachable-edge-horizon";
const HARTHMERE_LOCAL_DEV_SEED_CONTENT_PASS =
  "harthmere-additive-east-extension-complete-foundation-flat-town";
const HARTHMERE_LOCAL_DEV_SEED_FINGERPRINT_VERSION =
  "harthmere-local-dev-seed-fingerprint-additive-edge-horizon-v6";

// Use a new terrain id band for the additive extension. Reusing the legacy
// band would move existing +512 town entities to +1600 and therefore remove
// terrain from the current map—the opposite of the user's add-only contract.
const LEGACY_LOCAL_DEV_TERRAIN_ID_BASE = 8_810_000_000_000_000 as BiomesId;
const LEGACY_LOCAL_DEV_TERRAIN_ID_LIMIT = 8_810_000_000_010_000;
const LOCAL_DEV_TERRAIN_ID_BASE =
  HARTHMERE_EXTENSION_TERRAIN_ENTITY_ID_BASE as BiomesId;
const LOCAL_DEV_NPC_ID_BASE = 8_810_000_000_010_000 as BiomesId;
const LOCAL_DEV_TERRAIN_ID_LIMIT = HARTHMERE_EXTENSION_TERRAIN_ENTITY_ID_LIMIT;
const LOCAL_DEV_NPC_ID_LIMIT = 8_810_000_000_020_000;
// Keep seed markers outside both the local NPC entity band and the synthetic
// Bikkie NPC-type ids. The previous 020_001/020_002 values were exactly the
// local_dev_human/local_dev_walker type ids; in an imported world, 020_001 was
// also a real Muckmeadow cow, so the runtime-content fingerprint could never
// safely own that row.
const LOCAL_DEV_SEED_MARKER_ID = 8_810_000_000_029_000 as BiomesId;
const LOCAL_DEV_RUNTIME_CONTENT_MARKER_ID = 8_810_000_000_029_001 as BiomesId;
const LOCAL_DEV_NPC_COSMETIC_MARKER_ID = 8_810_000_000_029_002 as BiomesId;
const HARTHMERE_ADDITIVE_RUNTIME_CONTENT_VERSION =
  "harthmere-additive-runtime-content-grove-identity-v7" as const;

const STARTER_TOWN_GROUND_Y = 52;
const STARTER_TOWN_SPAWN: Vec3 = [486, STARTER_TOWN_GROUND_Y + 1, -209];

// HARTHMERE_CONNECTED_MAP_ROAD_VERSION:
// Harthmere is no longer treated as a hidden or overlapping local-dev island.
// The authored road below crosses the old X=1792 boundary and continues over
// newly seeded extension terrain to Harthmere's west approach:
//   authored [192, -209] -> [392, -209]
//   shifted  [1792, -209] -> [1992, -209]
const HARTHMERE_CONNECTED_MAP_ROAD_VERSION =
  "harthmere-additive-extension-road";
const HARTHMERE_CONNECTED_MAP_DEFAULT_OFFSET_X =
  HARTHMERE_ADDITIVE_TOWN_OFFSET_X;
const HARTHMERE_CONNECTED_MAP_DEFAULT_OFFSET_Z =
  HARTHMERE_ADDITIVE_TOWN_OFFSET_Z;
const HARTHMERE_SNAPSHOT_EDGE_ROAD_AUTHORED_START_X = 192;
const HARTHMERE_SNAPSHOT_EDGE_ROAD_AUTHORED_Z = -209;
const HARTHMERE_WEST_GATE_AUTHORED_X = 392;

// HARTHMERE_EXTRA_TOWN_OFFSET:
// In snapshot-merge mode, Harthmere becomes a shifted extra town instead of
// the base spawn world. +1600 is shard-aligned and places authored shard X=6
// exactly at the old production edge (1600 + 6 * 32 = 1792).
const HARTHMERE_EXTRA_TOWN_OFFSET_X = Number.parseInt(
  process.env.BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X ??
    String(HARTHMERE_CONNECTED_MAP_DEFAULT_OFFSET_X),
  10
);
const HARTHMERE_EXTRA_TOWN_OFFSET_Z = Number.parseInt(
  process.env.BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_Z ??
    String(HARTHMERE_CONNECTED_MAP_DEFAULT_OFFSET_Z),
  10
);
function shouldUseHarthmereExtraTownOffset() {
  // HARTHMERE_GROVE_SEPARATION:
  // With the production snapshot installed, BIOMES_FORCE_LOCAL_DEV_TOWN means
  // "seed Harthmere as the connected extra town". It must never paint the
  // Harthmere terrain/NPC layer directly over The Grove. Use
  // BIOMES_HARTHMERE_STANDALONE_TOWN=1 only for legacy unshifted tests.
  // The additive town is normal world content now, not an opt-in debug mode.
  // Keeping only explicit disable/standalone switches makes production boots
  // self-healing while preserving a deliberate emergency rollback path.
  return shouldEnableHarthmereAdditiveWorldExtension(process.env);
}
function harthmereExtraTownOffsetX() {
  return shouldUseHarthmereExtraTownOffset()
    ? HARTHMERE_EXTRA_TOWN_OFFSET_X
    : 0;
}
function harthmereExtraTownOffsetZ() {
  return shouldUseHarthmereExtraTownOffset()
    ? HARTHMERE_EXTRA_TOWN_OFFSET_Z
    : 0;
}
function harthmereExtraTownShardOffsetX() {
  return Math.trunc(harthmereExtraTownOffsetX() / SHARD_DIM);
}
function harthmereExtraTownShardOffsetZ() {
  return Math.trunc(harthmereExtraTownOffsetZ() / SHARD_DIM);
}
function harthmereAuthoredWorldX(worldX: number) {
  return worldX - harthmereExtraTownOffsetX();
}
function harthmereAuthoredWorldZ(worldZ: number) {
  return worldZ - harthmereExtraTownOffsetZ();
}
function harthmereWorldPosition(position: Vec3): Vec3 {
  return [
    position[0] + harthmereExtraTownOffsetX(),
    position[1],
    position[2] + harthmereExtraTownOffsetZ(),
  ];
}

function harthmereBusinessOutpostSeedTerrainEditsByShard() {
  const editsByShard = new Map<
    string,
    { position: Vec3; value: TerrainID }[]
  >();
  for (const plan of createHarthmereBusinessOutpostRebuildMaterializationPlans()) {
    for (const edit of plan.edits) {
      // Business outposts now use the production/world coordinates captured
      // from __harthmereLivePlayerDebug.getPosition(), so local screenshots
      // must not apply the legacy +512 Harthmere extra-town offset here.
      const position = edit.position as Vec3;
      const shardId = voxelShard(...position);
      const edits = editsByShard.get(shardId) ?? [];
      if (edit.value) {
        edits.push({ position, value: edit.value as unknown as TerrainID });
      }
      editsByShard.set(shardId, edits);
    }
  }
  return editsByShard;
}

const HARTHMERE_BUSINESS_OUTPOST_SEED_TERRAIN_EDITS_BY_SHARD =
  harthmereBusinessOutpostSeedTerrainEditsByShard();

const HARTHMERE_BUSINESS_OUTPOST_SEED_TERRAIN_SHARDS = Array.from(
  HARTHMERE_BUSINESS_OUTPOST_SEED_TERRAIN_EDITS_BY_SHARD.keys()
).map((shardId) => shardDecode(shardId as ReturnType<typeof voxelShard>));

// SNAPSHOT_GROVE_VISIBLE_NPCS:
// Keep Grove snapshot NPCs in authored Grove X/Z, but ground them on the live
// installed snapshot courtyard height. The logs showed the player standing at
// y=70.5 while seeded Grove NPCs were at y=53, which means the cast existed but
// was buried under the visible courtyard. Do not apply the Harthmere town X
// offset here; only fix the Grove live Y band.
function snapshotGroveRuntimeGroundedPosition(position: Vec3): Vec3 {
  return snapshotGroveGroundedPosition(position);
}

function snapshotCombatRuntimeGroundedPosition(position: Vec3): Vec3 {
  const sampled = findNearestHarthmereProductionPlacement(position, {
    purpose: "monster",
    maxDistance: 32,
  });
  if (sampled?.placementMode === "outdoor_surface") {
    return [...sampled.recommendedPosition];
  }
  return snapshotCombatGroundedPosition(position);
}

const GLITCH_SNAPSHOT_NPC_GROUNDING_REPAIR_VERSION =
  "glitch-snapshot-npc-grounding-repair-v2";

const GLITCH_SNAPSHOT_NPC_GROUNDING_REPAIRS = new Map<
  BiomesId,
  SnapshotNpcGroundingRepair
>([
  [3442733339259323 as BiomesId, 67],
  [5565155013544756 as BiomesId, 58],
  [2562755261964429 as BiomesId, 65],
  [7976997825186729 as BiomesId, 79],
  [8810000000019304 as BiomesId, 64],
  [1970820126185660 as BiomesId, 78],
  [2737786140252038 as BiomesId, 78],
  [8810000000019303 as BiomesId, 49],
  [3209818233438093 as BiomesId, 83],
  [2308478119772205 as BiomesId, 86],
  [8810000000019310 as BiomesId, 59],
  [8810000000019307 as BiomesId, 49],
  [8810000000019306 as BiomesId, 74],
  [8810000000019311 as BiomesId, 64],
  [1079816481736910 as BiomesId, 77],
  [1544957595432977 as BiomesId, 70],
  // A Y-only correction left Rhiamon inside the migrated Grove water. Repair
  // X/Z and NPC spawn as one identity-preserving move to the measured dry post.
  [SNAPSHOT_GROVE_RHIAMON_ENTITY_ID, SNAPSHOT_GROVE_RHIAMON_DRY_POSITION],
  [4082216233317240 as BiomesId, 82],
  [3592267593576780 as BiomesId, 70],
  [5578936972474260 as BiomesId, 57],
  [5162032715011390 as BiomesId, 76],
  [8507603243812346 as BiomesId, 71],
  [7247932198135555 as BiomesId, 85],
  [1396112439044639 as BiomesId, 54],
  [4065677882607930 as BiomesId, 57],
  [7068077634188260 as BiomesId, 53],
  [5802893804974411 as BiomesId, 41],
  [7659323672038846 as BiomesId, 70],
  [3726641693045265 as BiomesId, 76],
  [2491089075513661 as BiomesId, 76],
  [3732154476643133 as BiomesId, 87],
  [7382995395593423 as BiomesId, 70],
  [7640028929538594 as BiomesId, 48],
  [7059119360887923 as BiomesId, 70],
  [8810000000019308 as BiomesId, 73],
  [1393356047266006 as BiomesId, 107],
  [1335471819771907 as BiomesId, 58],
  [5083475549151094 as BiomesId, 66],
  [4337871571352237 as BiomesId, 60],
  [3431707772113903 as BiomesId, 70],
  [8363581773034518 as BiomesId, 4],
  [3909941746768118 as BiomesId, 90],
  [3958178602967295 as BiomesId, 81],
  [6943350905944077 as BiomesId, 83],
  [4845047659769271 as BiomesId, 70],
  [1219703364811429 as BiomesId, 79],
  [1815083990334304 as BiomesId, 43],
  [7819883493494961 as BiomesId, 48],
  [7639339831591232 as BiomesId, 82],
  [8810000000019202 as BiomesId, 39],
  [2179616803876607 as BiomesId, 84],
  [419660649242611 as BiomesId, 77],
]);

async function repairKnownSnapshotNpcGrounding(worldApi: WorldApi) {
  if (process.env.GLITCH_REPAIR_SNAPSHOT_NPC_GROUNDING === "0") {
    return;
  }
  const ids = [...GLITCH_SNAPSHOT_NPC_GROUNDING_REPAIRS.keys()];
  const existing = await worldApi.getWithVersion(ids);
  const changes: ProposedChange[] = [];
  for (const [, lazyEntity] of existing) {
    const entity = lazyEntity?.materialize();
    const position = entity?.position?.v;
    if (!entity || !position) {
      continue;
    }
    const repair = GLITCH_SNAPSHOT_NPC_GROUNDING_REPAIRS.get(entity.id);
    if (repair === undefined) {
      continue;
    }
    const targetPosition = snapshotNpcGroundingRepairTarget(position, repair);
    const spawnPosition = entity.npc_metadata?.spawn_position;
    if (
      snapshotNpcGroundingRepairSatisfied({
        currentPosition: position,
        spawnPosition,
        repair,
      })
    ) {
      continue;
    }
    const npcMetadata = entity.npc_metadata;
    changes.push({
      kind: "update",
      entity: {
        id: entity.id,
        position: { v: targetPosition },
        ...(typeof repair !== "number" && npcMetadata
          ? {
              npc_metadata: NpcMetadata.create({
                ...npcMetadata,
                spawn_position: targetPosition,
                spawn_orientation: [...npcMetadata.spawn_orientation] as [
                  number,
                  number,
                ],
              }),
            }
          : {}),
      },
    });
  }
  if (changes.length === 0) {
    return;
  }
  const { outcome } = await worldApi.apply({ changes });
  log.warn(
    "Repaired known snapshot NPC grounding from production perf report",
    {
      version: GLITCH_SNAPSHOT_NPC_GROUNDING_REPAIR_VERSION,
      outcome,
      repairs: changes.length,
    }
  );
}

// HARTHMERE_NPC_GROUNDING_VERSION
// Harthmere NPCs are authored to stand on server terrain. Never preserve stale
// Y values from old local-dev placements after snapshot/extra-town shifting.
const HARTHMERE_NPC_GROUNDING_VERSION = "harthmere-npc-grounding";
const HARTHMERE_NPC_TERRAIN_FOOTING_VERSION = "harthmere-npc-terrain-footing";

function harthmereIsNpcFootingBlock(
  materials: ReturnType<typeof localDevMaterials>,
  block: TerrainID | undefined
) {
  if (!block) return false;
  // Ignore small deco/foliage when choosing where an NPC's feet should land.
  // The auto-survey found NPCs buried/floating because we used one global
  // y=53 even when Harthmere terrain/building floors were much higher.
  return ![
    materials.oakLeaf,
    materials.rose,
    materials.dandelion,
    materials.sunflower,
    materials.switchGrass,
    materials.wheat,
    materials.carrot,
  ].includes(block);
}

function harthmereNpcFeetYForAuthoredPosition(position: Vec3) {
  const materials = localDevMaterials();
  const authoredX = Math.round(position[0]);
  const authoredZ = Math.round(position[2]);
  let feetY = localDevTerrainHeight(authoredX, authoredZ) + 1;

  // Search the authored column, not the shifted runtime column. The terrain
  // shard builder applies the same Harthmere offset before it calls the block
  // generator, so authored X/Z is the single source of truth here.
  for (
    let worldY = STARTER_TOWN_GROUND_Y + 40;
    worldY >= STARTER_TOWN_GROUND_Y + 1;
    worldY -= 1
  ) {
    const block = starterTownAboveGroundBlockAt(
      materials,
      authoredX,
      worldY,
      authoredZ
    );
    if (harthmereIsNpcFootingBlock(materials, block)) {
      feetY = worldY + 1;
      break;
    }
  }

  return feetY;
}

const HARTHMERE_NPC_SAFE_SPAWN_VERSION =
  "harthmere-npc-safe-visible-grounded-spawn";

function harthmereBuildingAtAuthoredColumn(x: number, z: number) {
  return HARTHMERE_BUILDINGS.find((building) =>
    harthmereIsInsideRect(
      x,
      z,
      building.x0,
      building.x1,
      building.z0,
      building.z1,
      0
    )
  );
}

function harthmereDoorOutsideCandidates(building: HarthmereBuilding): Vec3[] {
  const out: Vec3[] = [];
  if (building.doorSide === "north") {
    for (let dx = -2; dx <= 2; dx += 1)
      out.push([
        building.doorCenter + dx,
        STARTER_TOWN_GROUND_Y + 1,
        building.z0 - 2,
      ]);
  } else if (building.doorSide === "south") {
    for (let dx = -2; dx <= 2; dx += 1)
      out.push([
        building.doorCenter + dx,
        STARTER_TOWN_GROUND_Y + 1,
        building.z1 + 2,
      ]);
  } else if (building.doorSide === "west") {
    for (let dz = -2; dz <= 2; dz += 1)
      out.push([
        building.x0 - 2,
        STARTER_TOWN_GROUND_Y + 1,
        building.doorCenter + dz,
      ]);
  } else {
    for (let dz = -2; dz <= 2; dz += 1)
      out.push([
        building.x1 + 2,
        STARTER_TOWN_GROUND_Y + 1,
        building.doorCenter + dz,
      ]);
  }
  return out;
}

function harthmereColumnHasNpcClearance(
  materials: ReturnType<typeof localDevMaterials>,
  authoredX: number,
  authoredZ: number,
  feetY: number
) {
  // The auto-survey showed many local-dev NPCs invisible because their X/Z
  // landed inside voxel walls or roof columns. A valid visible spawn needs a
  // solid floor below, then clear feet/body/head space.
  for (let y = feetY; y <= feetY + 2; y += 1) {
    if (starterTownAboveGroundBlockAt(materials, authoredX, y, authoredZ)) {
      return false;
    }
  }
  return true;
}

function harthmereNpcFeetYForAuthoredColumn(
  authoredX: number,
  authoredZ: number
) {
  return harthmereNpcFeetYForAuthoredPosition([
    authoredX,
    STARTER_TOWN_GROUND_Y + 1,
    authoredZ,
  ]);
}

function harthmereNpcSafeAuthoredPosition(position: Vec3): Vec3 {
  const materials = localDevMaterials();
  const originX = Math.round(position[0]);
  const originZ = Math.round(position[2]);
  const candidates: Vec3[] = [];

  const building = harthmereBuildingAtAuthoredColumn(originX, originZ);
  if (building) {
    candidates.push(...harthmereDoorOutsideCandidates(building));
  }

  for (let radius = 0; radius <= 14; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
        candidates.push([
          originX + dx,
          STARTER_TOWN_GROUND_Y + 1,
          originZ + dz,
        ]);
      }
    }
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const x = Math.round(candidate[0]);
    const z = Math.round(candidate[2]);
    const key = `${x}:${z}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Keep NPCs visible and clickable. If someone is authored inside a shop or
    // house, move them to the doorway/nearby street rather than burying them
    // inside a solid wall. The buildings remain enterable through the door
    // clearance carved below. Every candidate now gets grounded against the
    // authored column it actually lands on instead of the old flat y=53 town
    // assumption that caused buried and floating NPC audits.
    if (harthmereIsInsideAnyBuildingFootprint(x, z, 0)) continue;
    const candidateFeetY = harthmereNpcFeetYForAuthoredColumn(x, z);
    if (!harthmereColumnHasNpcClearance(materials, x, z, candidateFeetY))
      continue;
    return [x, candidateFeetY, z];
  }

  return [originX, harthmereNpcFeetYForAuthoredPosition(position), originZ];
}

const HARTHMERE_NPC_POSITION_OVERRIDE_VERSION =
  "harthmere-known-audit-npc-safe-position-overrides";

// The v90/v84 audit series repeatedly identified the same bad cluster: legacy
// Harthmere NPCs authored at flat y=53 in places where the live terrain/floors
// are y=58-73, especially the docks, tavern, market-board roof edge, guard yard,
// and civic hill. Keep this as data so future audits can remove entries once the
// authored town layout is rebuilt, instead of reintroducing roof/interior spawns.
const HARTHMERE_NPC_AUTHORED_POSITION_OVERRIDES = new Map<number, Vec3>([
  [3, [503, STARTER_TOWN_GROUND_Y + 1, -211]], // Toma, Builder near board
  [6, [545, STARTER_TOWN_GROUND_Y + 1, -223]], // Banker Merl Voss
  [11, [531, STARTER_TOWN_GROUND_Y + 1, -187]], // Garrick, Bartender
  [13, [543, STARTER_TOWN_GROUND_Y + 1, -187]], // Bela, Storyteller
  [14, [539, STARTER_TOWN_GROUND_Y + 1, -179]], // Kip, Card Player
  [15, [531, STARTER_TOWN_GROUND_Y + 1, -190]], // Sola, Traveler
  [29, [506, STARTER_TOWN_GROUND_Y + 1, -220]], // Master Osric Vale
  [30, [532, STARTER_TOWN_GROUND_Y + 1, -187]], // Elowen Pike
  [32, [564, STARTER_TOWN_GROUND_Y + 1, -262]], // Reeve Caldus Merrow
  [34, [587, STARTER_TOWN_GROUND_Y + 1, -214]], // Tovin Reed moved off the high dock roof column
  [36, [545, STARTER_TOWN_GROUND_Y + 1, -237]], // Perrin, Moneylender
  [41, [503, STARTER_TOWN_GROUND_Y + 1, -211]], // Harthmere Market Board
  [44, [512, STARTER_TOWN_GROUND_Y + 1, -256]], // Drill Instructor Hal
  [45, [516, STARTER_TOWN_GROUND_Y + 1, -256]], // Bounty Clerk Rowan
  [51, [590, STARTER_TOWN_GROUND_Y + 1, -214]], // Ferry Master Wren
  [54, [562, STARTER_TOWN_GROUND_Y + 1, -266]], // Tax Clerk Iven
  [55, [575, STARTER_TOWN_GROUND_Y + 1, -245]], // Noble Servant Rose
  [56, [508, STARTER_TOWN_GROUND_Y + 1, -256]], // Guard Quartermaster Tarrow
  [59, [545, STARTER_TOWN_GROUND_Y + 1, -223]], // Guild Registrar Wyne
  [65, [594, STARTER_TOWN_GROUND_Y + 1, -214]], // River Knots Lookout
]);

function harthmereNpcAuthoredPositionWithAuditOverride(npc: StarterNpc): Vec3 {
  const offset = Number(npc.id) - Number(LOCAL_DEV_NPC_ID_BASE);
  return HARTHMERE_NPC_AUTHORED_POSITION_OVERRIDES.get(offset) ?? npc.position;
}

function harthmereGroundedNpcWorldPosition(position: Vec3): Vec3 {
  const safeAuthored = harthmereNpcSafeAuthoredPosition(position);
  const shifted = harthmereWorldPosition(safeAuthored);
  // The old live-snapshot Harthmere used several measured hill/structure Y
  // bands. The additive town is a separate, deliberately flat terrain layer.
  // Preserve those measured heights only in explicit legacy standalone mode.
  return [
    shifted[0],
    shouldUseHarthmereExtraTownOffset()
      ? HARTHMERE_EXTENSION_FEET_Y
      : safeAuthored[1],
    shifted[2],
  ];
}

// HARTHMERE_PERF_AND_PLACEMENT
//
// Every prior patch (v91, v92, v93) failed in the same way: it adjusted NPC
// authored Y values that the *local-dev terrain generator* still re-grounded
// to y=53 because `localDevTerrainHeight()` always returns 52. The live
// installed snapshot terrain, however, has raised structures (docks at y=72,
// market plaza at y=67, smithy at y=67, tavern at y=62, bank at y=57). The
// audits from 2026-05-21 measured those structure heights directly from the
// runtime terrain tensor and recorded them in `targetTerrain.groundBlockY`.
// v94 uses those measurements as ground truth and refuses to let the
// safe-relocation pass override them.
//
// Two structural fixes:
//   1. Per-NPC anchor table (HARTHMERE_NPC_STABLE_ANCHOR) seeded from the
//      mission-audit cluster measurements. Its X/Z remains the stable placement
//      source. Its measured Y is used only by explicit legacy standalone mode;
//      additive Harthmere normalizes every outdoor town actor to feet Y=53.
//      Anchored NPCs skip the outward safe-relocation search entirely — that
//      search was the source of multiple NPCs collapsing to the same first-found
//      clearance spot.
//   2. A shared collision claim set (`HarthmereNpcClaimSet`) prevents two
//      anchored NPCs from landing on the same (x, z) by nudging the second one
//      ±2 blocks in a deterministic per-id direction.
//
// Authored cluster Y values (measured live with the v90 mission audit):
//   Bakery / Mudden / Chapel band         feetY 53  (matches authored ground)
//   Apothecary / Magic Shop belt          feetY 58  (Green Mortar)
//   Bank / Services Plaza                 feetY 58  (Brass Scale Bank)
//   Copper Kettle Tavern                  feetY 63
//   Market Board / Plaza fountain         feetY 68  (raised plaza)
//   Black Anvil Smithy / Craftsman Row    feetY 68
//   River Docks                           feetY 73  (high dock structures)
//   Reeve Hall / Noble Rise               feetY 63  (audit-aligned)
//   Guard Yard / North Gate area          feetY 58
//
// When adding a new NPC: pick the cluster from the table above and set its
// authored Y to the cluster's feetY. Do NOT rely on the safe-relocation pass
// to find the right Y — that pass reads the authored generator, which is flat.
const HARTHMERE_PERF_AND_PLACEMENT_VERSION = "harthmere-perf-and-placement";

// Cluster feet-Y constants — every value below was measured from a
// `harthmere-mission-audit` capture (targetTerrain.feetY field), or
// derived by neighbor inference where the audit lacked direct coverage.
const HARTHMERE_CLUSTER_FEET_Y_BASE = STARTER_TOWN_GROUND_Y + 1; // 53
const HARTHMERE_CLUSTER_FEET_Y_APOTHECARY = 58;
const HARTHMERE_CLUSTER_FEET_Y_BANK = 58;
const HARTHMERE_CLUSTER_FEET_Y_TAVERN = 63;
const HARTHMERE_CLUSTER_FEET_Y_PLAZA_FOUNTAIN = 68;
const HARTHMERE_CLUSTER_FEET_Y_SMITHY = 68;
const HARTHMERE_CLUSTER_FEET_Y_DOCKS = 73;
const HARTHMERE_CLUSTER_FEET_Y_NOBLE_RISE = 63;
const HARTHMERE_CLUSTER_FEET_Y_GUARD_YARD = 58;
const HARTHMERE_CLUSTER_FEET_Y_NORTH_GATE = 58;

// Per-NPC stable anchor table keyed by id offset (id = LOCAL_DEV_NPC_ID_BASE
// + offset). Coordinates are authored (pre-shift). Y is the measured cluster
// feet-Y from the live snapshot terrain, NOT the flat authored ground.
//
// Adding a new NPC here promises three things:
//   1. The XZ position is reachable (no building wall directly above).
//   2. The Y is the actual legacy snapshot feet-Y for standalone compatibility;
//      normal additive-world seeding replaces it with HARTHMERE_EXTENSION_FEET_Y.
//   3. The NPC will NOT be re-located by safe-relocation; this is the final XZ.
const HARTHMERE_NPC_STABLE_ANCHOR = new Map<number, Vec3>([
  // --- Welcome / orientation around the Plaza fountain ---
  [1, [488, HARTHMERE_CLUSTER_FEET_Y_APOTHECARY, -205]], // Mira, Town Guide
  [2, [505, HARTHMERE_CLUSTER_FEET_Y_PLAZA_FOUNTAIN, -211]], // Bolt, Archive Robot
  [3, [507, HARTHMERE_CLUSTER_FEET_Y_PLAZA_FOUNTAIN, -213]], // Toma, Builder (off board)
  [41, [503, HARTHMERE_CLUSTER_FEET_Y_PLAZA_FOUNTAIN, -209]], // Market Board
  [42, [501, HARTHMERE_CLUSTER_FEET_Y_PLAZA_FOUNTAIN, -211]], // Town Crier Pell

  // --- Plaza fountain craftsmen (audit collision target) ---
  [29, [510, HARTHMERE_CLUSTER_FEET_Y_PLAZA_FOUNTAIN, -217]], // Master Osric Vale (smithy door)
  [48, [504, HARTHMERE_CLUSTER_FEET_Y_PLAZA_FOUNTAIN, -215]], // Garrik Fen, Carpenter
  [49, [497, HARTHMERE_CLUSTER_FEET_Y_PLAZA_FOUNTAIN, -223]], // Helna Voss

  // --- Black Anvil smithy interior approach ---
  [7, [532, HARTHMERE_CLUSTER_FEET_Y_SMITHY, -228]], // Brann, Weapons Teller
  [67, [528, HARTHMERE_CLUSTER_FEET_Y_SMITHY, -225]], // Forge Apprentice Luth

  // --- Bank / Services Plaza ---
  [6, [552, HARTHMERE_CLUSTER_FEET_Y_BANK, -222]], // Banker Merl Voss
  [35, [538, HARTHMERE_CLUSTER_FEET_Y_BANK, -204]], // Lysa, Cloth Merchant
  [36, [556, HARTHMERE_CLUSTER_FEET_Y_BANK, -228]], // Perrin, Moneylender
  [43, [549, HARTHMERE_CLUSTER_FEET_Y_BANK, -213]], // Courier Anwen
  [59, [544, HARTHMERE_CLUSTER_FEET_Y_BANK, -220]], // Guild Registrar Wyne
  [60, [556, HARTHMERE_CLUSTER_FEET_Y_BANK, -218]], // Auction Clerk Pellam

  // --- Copper Kettle tavern (audit-measured y=63) ---
  [11, [538, HARTHMERE_CLUSTER_FEET_Y_TAVERN, -194]], // Garrick, Bartender
  [12, [550, HARTHMERE_CLUSTER_FEET_Y_TAVERN, -200]], // Jori, Dockhand
  [13, [554, HARTHMERE_CLUSTER_FEET_Y_TAVERN, -190]], // Bela, Storyteller
  [14, [546, HARTHMERE_CLUSTER_FEET_Y_TAVERN, -186]], // Kip, Card Player
  [15, [540, HARTHMERE_CLUSTER_FEET_Y_TAVERN, -188]], // Sola, Traveler
  [16, [558, HARTHMERE_CLUSTER_FEET_Y_TAVERN, -200]], // Mern, Tavern Bard
  [30, [545, HARTHMERE_CLUSTER_FEET_Y_TAVERN, -192]], // Elowen Pike
  [57, [536, HARTHMERE_CLUSTER_FEET_Y_TAVERN, -198]], // Traveling Merchant Ossa

  // --- River Docks (audit-measured y=73) ---
  [34, [584, HARTHMERE_CLUSTER_FEET_Y_DOCKS, -183]], // Tovin Reed (dockmaster office)
  [51, [594, HARTHMERE_CLUSTER_FEET_Y_DOCKS, -185]], // Ferry Master Wren
  [65, [602, HARTHMERE_CLUSTER_FEET_Y_DOCKS, -176]], // River Knots Lookout

  // --- Bakery / Market belt (audit-confirmed y=53) ---
  [4, [441, HARTHMERE_CLUSTER_FEET_Y_BASE, -202]], // Pip, Harbor Mascot
  [5, [434, HARTHMERE_CLUSTER_FEET_Y_BASE, -192]], // Maren Dawnloaf
  [28, [440, HARTHMERE_CLUSTER_FEET_Y_BASE, -200]], // Mara Thistle
  [50, [457, HARTHMERE_CLUSTER_FEET_Y_BASE, -194]], // Selka Weaver
  [58, [445, HARTHMERE_CLUSTER_FEET_Y_BASE, -198]], // Food Vendor Marae
  [68, [428, HARTHMERE_CLUSTER_FEET_Y_BASE, -188]], // Bakery Apprentice Noll
  [69, [450, HARTHMERE_CLUSTER_FEET_Y_BASE, -206]], // Market Guard Sen

  // --- Apothecary / Magic Shop belt (raised y=58) ---
  [8, [456, HARTHMERE_CLUSTER_FEET_Y_APOTHECARY, -176]], // Luma, Healer
  [9, [514, HARTHMERE_CLUSTER_FEET_Y_APOTHECARY, -168]], // Edrin Starling
  [47, [460, HARTHMERE_CLUSTER_FEET_Y_APOTHECARY, -172]], // Ysabet Fenlow

  // --- Chapel / Temple Green (authored y=53 is correct) ---
  [31, [477, HARTHMERE_CLUSTER_FEET_Y_BASE, -139]], // Father Aldren
  [46, [486, HARTHMERE_CLUSTER_FEET_Y_BASE, -136]], // Sister Maelle
  [66, [472, HARTHMERE_CLUSTER_FEET_Y_BASE, -134]], // Chapel Choir Child
  [38, [518, HARTHMERE_CLUSTER_FEET_Y_BASE, -137]], // Mirel, Gravekeeper

  // --- Mudden Ward / Farm / Orchard ---
  [10, [444, HARTHMERE_CLUSTER_FEET_Y_BASE, -236]], // Tilda Fen
  [33, [404, HARTHMERE_CLUSTER_FEET_Y_BASE, -160]], // Nessa Crowe
  [37, [431, HARTHMERE_CLUSTER_FEET_Y_BASE, -112]], // Old Jory
  [40, [399, HARTHMERE_CLUSTER_FEET_Y_BASE, -235]], // Sable, Smuggler
  [52, [418, HARTHMERE_CLUSTER_FEET_Y_BASE, -156]], // Mudden Child Lio
  [53, [424, HARTHMERE_CLUSTER_FEET_Y_BASE, -152]], // Washerwoman Cale
  [61, [406, HARTHMERE_CLUSTER_FEET_Y_BASE, -162]], // Rat Catcher Dima
  [62, [486, HARTHMERE_CLUSTER_FEET_Y_BASE, -188]], // Bell-Witness Ora (well)
  [63, [462, HARTHMERE_CLUSTER_FEET_Y_BASE, -112]], // Apple Picker Ren
  [70, [402, HARTHMERE_CLUSTER_FEET_Y_BASE, -235]], // Underways Echo

  // --- Reeve Hall / Noble Rise (raised y=63) ---
  [32, [564, HARTHMERE_CLUSTER_FEET_Y_NOBLE_RISE, -262]], // Reeve Caldus Merrow
  [54, [555, HARTHMERE_CLUSTER_FEET_Y_NOBLE_RISE, -260]], // Tax Clerk Iven
  [55, [570, HARTHMERE_CLUSTER_FEET_Y_NOBLE_RISE, -258]], // Noble Servant Rose

  // --- North Gate / Guard Yard / Stables ---
  [27, [486, HARTHMERE_CLUSTER_FEET_Y_NORTH_GATE, -277]], // Sergeant Bram Holt
  [39, [482, HARTHMERE_CLUSTER_FEET_Y_NORTH_GATE, -280]], // Rusk, Toll Clerk
  [44, [512, HARTHMERE_CLUSTER_FEET_Y_GUARD_YARD, -266]], // Drill Instructor Hal
  [45, [518, HARTHMERE_CLUSTER_FEET_Y_GUARD_YARD, -262]], // Bounty Clerk Rowan
  [56, [504, HARTHMERE_CLUSTER_FEET_Y_GUARD_YARD, -262]], // Guard Quartermaster Tarrow
  [64, [432, HARTHMERE_CLUSTER_FEET_Y_BASE, -260]], // Stablehand Corin
]);

// The shell audit is now the final authority for NPCs assigned to an indoor
// job/home. Replace stale plaza/street approximations with collision-checked
// points inside the intended one of the 57 fixed additive-town buildings.
// Outdoor walkers and quest actors not assigned by the interior audit retain
// their existing authored anchors.
for (const anchor of HARTHMERE_ADDITIVE_TOWN_INTERIOR_NPC_ANCHORS) {
  HARTHMERE_NPC_STABLE_ANCHOR.set(anchor.offset, [...anchor.position]);
}

// Walker NPC ids (17-26) intentionally NOT in the anchor table — they wander.
// They keep using the existing safe-relocation, which is correct for movers.
// The check script verifies named-and-stationary NPCs are anchored.

type HarthmereNpcClaimSet = Set<string>;

function harthmereClaimKey(x: number, z: number): string {
  return `${Math.round(x)}:${Math.round(z)}`;
}

function harthmereDeterministicNudge(idOffset: number): [number, number] {
  // Spread a colliding pair by ±2 along one of 8 compass directions chosen
  // from the NPC's id offset. Deterministic so re-runs don't shuffle people.
  const directions: ReadonlyArray<[number, number]> = [
    [2, 0],
    [-2, 0],
    [0, 2],
    [0, -2],
    [2, 2],
    [2, -2],
    [-2, 2],
    [-2, -2],
  ];
  return directions[Math.abs(idOffset) % directions.length];
}

function harthmereResolveCollision(
  authored: Vec3,
  idOffset: number,
  claimed: HarthmereNpcClaimSet
): Vec3 {
  let x = Math.round(authored[0]);
  let z = Math.round(authored[2]);
  const y = authored[1];
  if (!claimed.has(harthmereClaimKey(x, z))) {
    claimed.add(harthmereClaimKey(x, z));
    return [x, y, z];
  }
  const [nudgeX, nudgeZ] = harthmereDeterministicNudge(idOffset);
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const tryX = x + nudgeX * attempt;
    const tryZ = z + nudgeZ * attempt;
    if (!claimed.has(harthmereClaimKey(tryX, tryZ))) {
      claimed.add(harthmereClaimKey(tryX, tryZ));
      return [tryX, y, tryZ];
    }
  }
  // Worst case, still claim something even if it overlaps; the NPC remains
  // visible and quest markers can still resolve them.
  claimed.add(harthmereClaimKey(x, z));
  return [x, y, z];
}

function harthmereStableAnchorAuthoredPosition(
  npc: StarterNpc,
  claimed: HarthmereNpcClaimSet
): Vec3 | undefined {
  const offset = Number(npc.id) - Number(LOCAL_DEV_NPC_ID_BASE);
  const anchor = HARTHMERE_NPC_STABLE_ANCHOR.get(offset);
  if (!anchor) {
    return undefined;
  }
  return harthmereResolveCollision(anchor, offset, claimed);
}

function harthmereGroundedNpcWorldPositionWithClaim(
  npc: StarterNpc,
  claimed: HarthmereNpcClaimSet
): Vec3 {
  // Anchored NPCs use their stable X/Z and skip safe-relocation entirely —
  // that's what was collapsing multiple NPCs onto the same first available
  // clearance column. Audited indoor anchors preserve their assigned floor Y;
  // ordinary outdoor anchors still use the shared additive-town feet plane.
  // Non-anchored NPCs (walkers, late additions) continue through the clearance
  // path for X/Z.
  const anchorAuthored = harthmereStableAnchorAuthoredPosition(npc, claimed);
  if (anchorAuthored) {
    const offset = Number(npc.id) - Number(LOCAL_DEV_NPC_ID_BASE);
    const interiorAnchor = harthmereAdditiveTownInteriorNpcAnchor(offset);
    const shifted = harthmereWorldPosition(anchorAuthored);
    return [
      shifted[0],
      shouldUseHarthmereExtraTownOffset()
        ? (interiorAnchor?.position[1] ?? HARTHMERE_EXTENSION_FEET_Y)
        : anchorAuthored[1],
      shifted[2],
    ];
  }
  const legacyAuthored = harthmereNpcAuthoredPositionWithAuditOverride(npc);
  const safeAuthored = harthmereNpcSafeAuthoredPosition(legacyAuthored);
  const claimedKey = harthmereClaimKey(safeAuthored[0], safeAuthored[2]);
  if (!claimed.has(claimedKey)) {
    claimed.add(claimedKey);
  }
  const shifted = harthmereWorldPosition(safeAuthored);
  return [
    shifted[0],
    shouldUseHarthmereExtraTownOffset()
      ? HARTHMERE_EXTENSION_FEET_Y
      : safeAuthored[1],
    shifted[2],
  ];
}

const STARTER_TOWN_SAFE_X0 = 352;
const STARTER_TOWN_SAFE_X1 = 640;
const STARTER_TOWN_SAFE_Z0 = -320;
const STARTER_TOWN_SAFE_Z1 = -32;

// Harthmere local-dev terrain performance profile.
// The previous full wilds seed created 2209 terrain shards and 11k+ harvestable
// blocks even when testing inside the town, which showed up in logs as ~19s of
// terrain seeding and poor frame pacing. Default to the town + near-wilds band;
// set BIOMES_HARTHMERE_PERF_PROFILE=full for long-distance world screenshots.
const HARTHMERE_LOCAL_DEV_PERF_PROFILE =
  process.env.BIOMES_HARTHMERE_PERF_PROFILE === "full" ? "full" : "optimized";
const HARTHMERE_FULL_WILDS_SHARD_X0 = -8;
const HARTHMERE_FULL_WILDS_SHARD_X1 = 38;
const HARTHMERE_FULL_WILDS_SHARD_Z0 = -31;
const HARTHMERE_FULL_WILDS_SHARD_Z1 = 15;
const HARTHMERE_OPTIMIZED_WILDS_SHARD_X0 = 6;
const HARTHMERE_OPTIMIZED_WILDS_SHARD_X1 = 23;
// Include the complete West Muck Breach (Z=-560) plus one shard of terrain
// support so no extension-owned creature or object can stand over the void.
const HARTHMERE_OPTIMIZED_WILDS_SHARD_Z0 = -18;
const HARTHMERE_OPTIMIZED_WILDS_SHARD_Z1 = 5;
const STARTER_TOWN_WILDS_SHARD_X0 =
  HARTHMERE_LOCAL_DEV_PERF_PROFILE === "full"
    ? HARTHMERE_FULL_WILDS_SHARD_X0
    : HARTHMERE_OPTIMIZED_WILDS_SHARD_X0;
const STARTER_TOWN_WILDS_SHARD_X1 =
  HARTHMERE_LOCAL_DEV_PERF_PROFILE === "full"
    ? HARTHMERE_FULL_WILDS_SHARD_X1
    : HARTHMERE_OPTIMIZED_WILDS_SHARD_X1;
const STARTER_TOWN_WILDS_SHARD_Z0 =
  HARTHMERE_LOCAL_DEV_PERF_PROFILE === "full"
    ? HARTHMERE_FULL_WILDS_SHARD_Z0
    : HARTHMERE_OPTIMIZED_WILDS_SHARD_Z0;
const STARTER_TOWN_WILDS_SHARD_Z1 =
  HARTHMERE_LOCAL_DEV_PERF_PROFILE === "full"
    ? HARTHMERE_FULL_WILDS_SHARD_Z1
    : HARTHMERE_OPTIMIZED_WILDS_SHARD_Z1;
const STARTER_TOWN_WILDS_X0 = STARTER_TOWN_WILDS_SHARD_X0 * SHARD_DIM;
const STARTER_TOWN_WILDS_X1 = (STARTER_TOWN_WILDS_SHARD_X1 + 1) * SHARD_DIM;
const STARTER_TOWN_WILDS_Z0 = STARTER_TOWN_WILDS_SHARD_Z0 * SHARD_DIM;
const STARTER_TOWN_WILDS_Z1 = (STARTER_TOWN_WILDS_SHARD_Z1 + 1) * SHARD_DIM;
const HARTHMERE_LEGACY_LOCAL_DEV_TERRAIN_SHARD_COUNT =
  (HARTHMERE_FULL_WILDS_SHARD_X1 - HARTHMERE_FULL_WILDS_SHARD_X0 + 1) *
  (HARTHMERE_FULL_WILDS_SHARD_Z1 - HARTHMERE_FULL_WILDS_SHARD_Z0 + 1);
const HARTHMERE_SUPPLEMENTAL_TERRAIN_SHARDS: ReadonlyArray<{
  readonly shardX: number;
  readonly shardY: number;
  readonly shardZ: number;
}> = [
  // User-confirmed high-vault cave at live [193.886, 102, 309.032].
  // Authored X removes the extra-town +512 offset, while Z is unchanged.
  ...[-11, -10, -9].flatMap((shardX) =>
    [8, 9, 10].map((shardZ) => ({ shardX, shardY: 3, shardZ }))
  ),
];

function isHarthmereLocalDevTerrainShardEnabledForWorld(
  worldX: number,
  worldZ: number
) {
  const shardX = Math.floor(worldX / SHARD_DIM);
  const shardZ = Math.floor(worldZ / SHARD_DIM);
  return (
    shardX >= STARTER_TOWN_WILDS_SHARD_X0 &&
    shardX <= STARTER_TOWN_WILDS_SHARD_X1 &&
    shardZ >= STARTER_TOWN_WILDS_SHARD_Z0 &&
    shardZ <= STARTER_TOWN_WILDS_SHARD_Z1
  );
}

function shouldSeedLocalDevTerrain() {
  // Snapshot merge extra-town v1: legacy local-dev mode still requires
  // BIOMES_FORCE_LOCAL_DEV_TOWN=1, but snapshot merge can now opt into a
  // shifted Harthmere town with BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1.
  const allowLocalTerrainRuntime =
    process.env.NODE_ENV !== "production" ||
    process.env.GLITCH_RUNTIME === "1" ||
    process.env.GLITCH_LOCAL_ASSETS === "1" ||
    !!process.env.GLITCH_TITLE_ID;
  return (
    allowLocalTerrainRuntime &&
    shouldUseHarthmereExtraTownOffset() &&
    process.env.BIOMES_CREATE_LOCAL_DEV_TERRAIN !== "0"
  );
}

function isLocalDevStarterWorldEntityId(id: BiomesId) {
  return (
    (id >= LEGACY_LOCAL_DEV_TERRAIN_ID_BASE &&
      id < LEGACY_LOCAL_DEV_TERRAIN_ID_LIMIT) ||
    (id >= HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_BASE &&
      id < HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_LIMIT) ||
    (id >= LOCAL_DEV_TERRAIN_ID_BASE && id < LOCAL_DEV_TERRAIN_ID_LIMIT) ||
    (id >= LOCAL_DEV_NPC_ID_BASE && id < LOCAL_DEV_NPC_ID_LIMIT)
  );
}

function hasNonLocalTerrainShard(service: ShimWorldService) {
  for (const entity of service.table.contents()) {
    if (
      entity.box &&
      entity.shard_seed &&
      entity.shard_diff &&
      entity.shard_shapes &&
      !isLocalDevStarterWorldEntityId(entity.id)
    ) {
      return true;
    }
  }
  return false;
}

function toProposedChange(change: Change): ProposedChange {
  switch (change.kind) {
    case "create":
      return { kind: "create", entity: change.entity };
    case "update":
      return { kind: "update", entity: change.entity };
    case "delete":
      return { kind: "delete", id: change.id };
  }
}

function terrainId(name: string, fallback: TerrainID): TerrainID {
  return safeGetTerrainId(name) ?? fallback;
}

function inRange(value: number, min: number, max: number) {
  return value >= min && value <= max;
}

function inRect(
  worldX: number,
  worldZ: number,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  pad = 0
) {
  return (
    inRange(worldX, x0 - pad, x1 + pad) && inRange(worldZ, z0 - pad, z1 + pad)
  );
}

function isStarterTownSafeFlatZone(worldX: number, worldZ: number) {
  return (
    inRect(
      worldX,
      worldZ,
      STARTER_TOWN_SAFE_X0,
      STARTER_TOWN_SAFE_X1,
      STARTER_TOWN_SAFE_Z0,
      STARTER_TOWN_SAFE_Z1
    ) ||
    Math.hypot(
      worldX - STARTER_TOWN_SPAWN[0],
      worldZ - STARTER_TOWN_SPAWN[2]
    ) <= 128
  );
}

function localDevTerrainHeight(worldX: number, worldZ: number) {
  // Keep the entire authored local-dev Harthmere map flat and walkable.
  // Earlier terrain waves made the town edge and forest edge feel like a hard
  // cliff: players could step out of the seeded town footprint and get caught
  // against missing or uneven shards. Visual variation now comes from material
  // tiles, road/forest props, and sparse block landmarks, not dangerous height
  // changes. Keep the surface exactly one block below NPC/player feet.
  void worldX;
  void worldZ;
  return STARTER_TOWN_GROUND_Y;
}

type StarterBuilding = {
  name: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  height: number;
  floor: TerrainID;
  wall: TerrainID;
  roof: TerrainID;
  doorSide: "north" | "south" | "east" | "west";
};

function starterBuildings(materials: ReturnType<typeof localDevMaterials>) {
  return [
    {
      name: "Welcome Hall",
      x0: 462,
      x1: 478,
      z0: -232,
      z1: -218,
      height: 7,
      floor: materials.stonePolished,
      wall: materials.oakLumber,
      roof: materials.stoneShingles,
      doorSide: "south",
    },
    {
      name: "Player House",
      x0: 448,
      x1: 466,
      z0: -268,
      z1: -246,
      height: 10,
      floor: materials.oakLumber,
      wall: materials.oakLumber,
      roof: materials.thatch,
      doorSide: "south",
    },
    {
      name: "Bakery",
      x0: 420,
      x1: 438,
      z0: -200,
      z1: -184,
      height: 6,
      floor: materials.stonePolished,
      wall: materials.limestoneBrick,
      roof: materials.thatch,
      doorSide: "east",
    },
    {
      name: "Bank",
      x0: 544,
      x1: 562,
      z0: -232,
      z1: -214,
      height: 8,
      floor: materials.stonePolished,
      wall: materials.stoneBrick,
      roof: materials.stoneShingles,
      doorSide: "west",
    },
    {
      name: "Weapons Shop",
      x0: 520,
      x1: 540,
      z0: -238,
      z1: -220,
      height: 7,
      floor: materials.cobblestone,
      wall: materials.oakLumber,
      roof: materials.stoneShingles,
      doorSide: "south",
    },
    {
      name: "Healing Shop",
      x0: 448,
      x1: 464,
      z0: -184,
      z1: -168,
      height: 6,
      floor: materials.stonePolished,
      wall: materials.limestoneBrick,
      roof: materials.thatch,
      doorSide: "east",
    },
    {
      name: "Magic Shop",
      x0: 506,
      x1: 524,
      z0: -176,
      z1: -158,
      height: 8,
      floor: materials.stonePolished,
      wall: materials.stoneBrick,
      roof: materials.led,
      doorSide: "west",
    },
    {
      name: "Tavern",
      x0: 532,
      x1: 562,
      z0: -206,
      z1: -180,
      height: 7,
      floor: materials.oakLumber,
      wall: materials.oakLumber,
      roof: materials.thatch,
      doorSide: "west",
    },
    {
      name: "Chapel of Saint Verena",
      x0: 462,
      x1: 492,
      z0: -150,
      z1: -128,
      height: 8,
      floor: materials.stonePolished,
      wall: materials.limestoneBrick,
      roof: materials.stoneShingles,
      doorSide: "south",
    },
    {
      name: "Reeve Hall",
      x0: 548,
      x1: 580,
      z0: -274,
      z1: -250,
      height: 9,
      floor: materials.stonePolished,
      wall: materials.limestoneBrick,
      roof: materials.stoneShingles,
      doorSide: "south",
    },
    {
      name: "Guard Yard Office",
      x0: 500,
      x1: 522,
      z0: -274,
      z1: -258,
      height: 6,
      floor: materials.cobblestone,
      wall: materials.stoneBrick,
      roof: materials.stoneShingles,
      doorSide: "south",
    },
    {
      name: "Dockmaster Shed",
      x0: 572,
      x1: 586,
      z0: -190,
      z1: -176,
      height: 5,
      floor: materials.oakLumber,
      wall: materials.oakLumber,
      roof: materials.thatch,
      doorSide: "east",
    },
    {
      name: "Mudden Ward Home",
      x0: 398,
      x1: 412,
      z0: -168,
      z1: -154,
      height: 5,
      floor: materials.dirt,
      wall: materials.oakLumber,
      roof: materials.thatch,
      doorSide: "east",
    },
    {
      name: "Mudden Ward Laundry House",
      x0: 416,
      x1: 430,
      z0: -158,
      z1: -144,
      height: 5,
      floor: materials.dirt,
      wall: materials.oakLumber,
      roof: materials.thatch,
      doorSide: "east",
    },
    {
      name: "Watermill",
      x0: 414,
      x1: 436,
      z0: -120,
      z1: -104,
      height: 7,
      floor: materials.oakLumber,
      wall: materials.oakLumber,
      roof: materials.thatch,
      doorSide: "north",
    },
    {
      name: "Workshop",
      x0: 498,
      x1: 514,
      z0: -228,
      z1: -212,
      height: 6,
      floor: materials.cobblestone,
      wall: materials.oakLumber,
      roof: materials.thatch,
      doorSide: "west",
    },
    {
      name: "Inn",
      x0: 452,
      x1: 468,
      z0: -196,
      z1: -180,
      height: 7,
      floor: materials.oakLumber,
      wall: materials.oakLumber,
      roof: materials.thatch,
      doorSide: "east",
    },
    {
      name: "Archive House",
      x0: 501,
      x1: 516,
      z0: -196,
      z1: -181,
      height: 6,
      floor: materials.stonePolished,
      wall: materials.limestoneBrick,
      roof: materials.stoneShingles,
      doorSide: "west",
    },
  ] satisfies StarterBuilding[];
}

function localDevMaterials() {
  const grass = getTerrainID("grass");
  const dirt = getTerrainID("dirt");
  const stone = getTerrainID("stone");
  return {
    grass,
    dirt,
    stone,
    gravel: terrainId("gravel", stone),
    cobblestone: terrainId("cobblestone", stone),
    cobblestoneBrick: terrainId("cobblestone_brick", stone),
    oakLog: terrainId("oak_log", stone),
    oakLumber: terrainId("oak_lumber", dirt),
    oakLeaf: terrainId("oak_leaf", grass),
    // HARTHMERE_WILDS_FOREST: birch and rubber complete the doc's three
    // species. Gaia pairs each leaf with its own log (gaiaLeafGrowthRoots), so
    // the pairs must be real terrain ids, not shared substitutes.
    birchLog: terrainId("birch_log", terrainId("oak_log", stone)),
    birchLeaf: terrainId("birch_leaf", terrainId("oak_leaf", grass)),
    rubberLog: terrainId("rubber_log", terrainId("oak_log", stone)),
    rubberLeaf: terrainId("rubber_leaf", terrainId("oak_leaf", grass)),
    stoneBrick: terrainId("stone_brick", stone),
    stonePolished: terrainId("stone_polished", stone),
    stoneShingles: terrainId("stone_shingles", stone),
    limestoneBrick: terrainId("limestone_brick", stone),
    simpleGlass: terrainId("simple_glass", stone),
    hay: terrainId("hay", dirt),
    thatch: terrainId("thatch", dirt),
    soil: terrainId("soil", dirt),
    // Use block-like substitutes in the synthetic local world. Some flora
    // terrain IDs exist only as flora, and deletion paths expect block terrain.
    wheat: terrainId("hay", dirt),
    carrot: terrainId("yellow_wool", dirt),
    rose: terrainId("red_wool", grass),
    dandelion: terrainId("yellow_wool", grass),
    sunflower: terrainId("yellow_wool", grass),
    switchGrass: terrainId("moss", grass),
    woodCrate: terrainId("wood_crate", dirt),
    led: terrainId("led", stone),
    moss: terrainId("moss", grass),
    muckwad: terrainId("muckwad", terrainId("moss", grass)),
    sand: terrainId("sand", dirt),
    snow: terrainId("snow", stone),
    ice: terrainId("ice", terrainId("simple_glass", stone)),
    whiteWool: terrainId("white_wool", stone),
    yellowWool: terrainId("yellow_wool", dirt),
    redWool: terrainId("red_wool", dirt),
    blueWool: terrainId("blue_wool", stone),
    blackWool: terrainId("black_wool", stone),
    greenWool: terrainId("green_wool", grass),
    coal: terrainId("coal", stone),
    copperOre: terrainId("copper_ore", terrainId("iron_ore", stone)),
    ironOre: terrainId("iron_ore", terrainId("coal", stone)),
    silverOre: terrainId("silver_ore", stone),
    goldOre: terrainId("gold_ore", stone),
    diamondOre: terrainId("diamond_ore", stone),
    // NOTE: there is deliberately no `water` entry here.
    //
    // There is no water block in Biomes — water is the parallel `ShardWater`
    // field (world-anatomy doc §5.1), and there is no `water.json` under
    // src/galois/data/blocks. The entry that used to sit here,
    // `terrainId("water", terrainId("blue_wool", stone))`, therefore always
    // resolved to its fallback, and every "water" feature in Harthmere — the
    // river, the Briarfen, the fountain, the trough, the mill race — was
    // rendered in blue wool. Water is now authored by `harthmere_river.ts` and
    // `harthmere_still_water.ts` and written into shard_water. Do not add this
    // key back; a block cannot be water.
  };
}

function isStarterTownRoad(worldX: number, worldZ: number) {
  return (
    inRect(worldX, worldZ, 482, 490, -270, -156) ||
    inRect(worldX, worldZ, 416, 566, -214, -206) ||
    inRect(worldX, worldZ, 476, 500, -222, -196) ||
    inRect(worldX, worldZ, 448, 468, -256, -250) ||
    inRect(worldX, worldZ, 420, 486, -194, -188) ||
    inRect(worldX, worldZ, 542, 564, -224, -218) ||
    inRect(worldX, worldZ, 520, 542, -230, -224) ||
    inRect(worldX, worldZ, 448, 486, -180, -174) ||
    inRect(worldX, worldZ, 506, 526, -170, -164) ||
    inRect(worldX, worldZ, 532, 564, -196, -190) ||
    inRect(worldX, worldZ, 432, 460, -236, -230) ||
    inRect(worldX, worldZ, 482, 490, -286, -104) ||
    inRect(worldX, worldZ, 404, 586, -150, -142) ||
    inRect(worldX, worldZ, 560, 590, -262, -256) ||
    inRect(worldX, worldZ, 570, 604, -186, -180) ||
    inRect(worldX, worldZ, 396, 436, -162, -156) ||
    inRect(worldX, worldZ, 420, 488, -112, -106)
  );
}

function isStarterTownPlaza(worldX: number, worldZ: number) {
  return inRect(worldX, worldZ, 474, 498, -222, -196);
}

function isStarterTownFarm(worldX: number, worldZ: number) {
  return (
    inRect(worldX, worldZ, 432, 458, -246, -224) ||
    inRect(worldX, worldZ, 438, 474, -122, -106)
  );
}

function doorCenter(building: StarterBuilding): [number, number] {
  const midX = Math.floor((building.x0 + building.x1) / 2);
  const midZ = Math.floor((building.z0 + building.z1) / 2);
  switch (building.doorSide) {
    case "north":
      return [midX, building.z0];
    case "south":
      return [midX, building.z1];
    case "east":
      return [building.x1, midZ];
    case "west":
      return [building.x0, midZ];
  }
}

function isDoorOpening(
  building: StarterBuilding,
  worldX: number,
  worldY: number,
  worldZ: number
) {
  if (!inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 3)) {
    return false;
  }
  const [doorX, doorZ] = doorCenter(building);
  if (building.doorSide === "north" || building.doorSide === "south") {
    return worldZ === doorZ && Math.abs(worldX - doorX) <= 1;
  }
  return worldX === doorX && Math.abs(worldZ - doorZ) <= 1;
}

function buildingBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  for (const building of starterBuildings(materials)) {
    const inside = inRect(
      worldX,
      worldZ,
      building.x0,
      building.x1,
      building.z0,
      building.z1
    );
    const onOuterWall =
      inside &&
      (worldX === building.x0 ||
        worldX === building.x1 ||
        worldZ === building.z0 ||
        worldZ === building.z1);

    if (inside && worldY === STARTER_TOWN_GROUND_Y) {
      return building.floor;
    }

    if (
      building.name === "Player House" &&
      inside &&
      worldY === STARTER_TOWN_GROUND_Y + 5
    ) {
      const stairVoid =
        worldX >= building.x0 + 2 &&
        worldX <= building.x0 + 5 &&
        worldZ >= building.z1 - 4 &&
        worldZ <= building.z1 - 2;
      return stairVoid ? undefined : building.floor;
    }

    if (
      building.name === "Player House" &&
      worldX >= building.x0 + 2 &&
      worldX <= building.x0 + 5 &&
      worldZ === building.z1 - 3 &&
      worldY === STARTER_TOWN_GROUND_Y + (worldX - building.x0)
    ) {
      return materials.oakLumber;
    }

    if (
      onOuterWall &&
      inRange(
        worldY,
        STARTER_TOWN_GROUND_Y + 1,
        STARTER_TOWN_GROUND_Y + building.height - 1
      )
    ) {
      if (isDoorOpening(building, worldX, worldY, worldZ)) {
        return undefined;
      }
      const isCorner =
        (worldX === building.x0 || worldX === building.x1) &&
        (worldZ === building.z0 || worldZ === building.z1);
      if (isCorner) {
        return materials.oakLog;
      }
      const windowBand =
        worldY === STARTER_TOWN_GROUND_Y + 3 && (worldX + worldZ) % 4 === 0;
      return windowBand ? materials.simpleGlass : building.wall;
    }

    if (
      inRect(
        worldX,
        worldZ,
        building.x0,
        building.x1,
        building.z0,
        building.z1,
        1
      ) &&
      worldY === STARTER_TOWN_GROUND_Y + building.height
    ) {
      return building.roof;
    }

    if (
      building.name === "Workshop" &&
      inRect(
        worldX,
        worldZ,
        building.x1 - 3,
        building.x1 - 2,
        building.z0 + 2,
        building.z0 + 3
      ) &&
      inRange(
        worldY,
        STARTER_TOWN_GROUND_Y + building.height + 1,
        STARTER_TOWN_GROUND_Y + building.height + 4
      )
    ) {
      return materials.stoneBrick;
    }
  }

  return undefined;
}

function towerBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const x0 = 520;
  const x1 = 529;
  const z0 = -254;
  const z1 = -245;
  if (!inRect(worldX, worldZ, x0, x1, z0, z1, 1)) {
    return undefined;
  }

  const inside = inRect(worldX, worldZ, x0, x1, z0, z1);
  const wall =
    inside &&
    (worldX === x0 || worldX === x1 || worldZ === z0 || worldZ === z1);
  if (inside && worldY === STARTER_TOWN_GROUND_Y) {
    return materials.stonePolished;
  }
  if (
    wall &&
    inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 15)
  ) {
    const door =
      worldZ === z1 &&
      Math.abs(worldX - Math.floor((x0 + x1) / 2)) <= 1 &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 3);
    if (door) {
      return undefined;
    }
    const window =
      [
        STARTER_TOWN_GROUND_Y + 6,
        STARTER_TOWN_GROUND_Y + 10,
        STARTER_TOWN_GROUND_Y + 14,
      ].includes(worldY) && (worldX + worldZ) % 3 === 0;
    return window ? materials.simpleGlass : materials.stoneBrick;
  }
  if (
    inRect(worldX, worldZ, x0, x1, z0, z1, 1) &&
    worldY === STARTER_TOWN_GROUND_Y + 16
  ) {
    return materials.led;
  }
  return undefined;
}

function marketBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const stalls = [
    [526, 533, -205, -199],
    [526, 533, -194, -188],
    [438, 445, -203, -197],
  ] as const;
  for (const [x0, x1, z0, z1] of stalls) {
    if (!inRect(worldX, worldZ, x0, x1, z0, z1)) {
      continue;
    }
    const post =
      (worldX === x0 || worldX === x1) && (worldZ === z0 || worldZ === z1);
    if (
      post &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 4)
    ) {
      return materials.oakLog;
    }
    if (worldY === STARTER_TOWN_GROUND_Y + 5) {
      return materials.hay;
    }
    if (
      worldY === STARTER_TOWN_GROUND_Y + 1 &&
      inRect(worldX, worldZ, x0 + 2, x1 - 2, z0 + 2, z1 - 2)
    ) {
      return materials.woodCrate;
    }
  }
  return undefined;
}

function treeBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const trees = [
    [431, -187],
    [444, -260],
    [463, -253],
    [533, -232],
    [545, -180],
    [414, -217],
    [559, -211],
  ] as const;
  for (const [tx, tz] of trees) {
    const dx = Math.abs(worldX - tx);
    const dz = Math.abs(worldZ - tz);
    if (
      dx === 0 &&
      dz === 0 &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 6)
    ) {
      return materials.oakLog;
    }
    const leafY = worldY - (STARTER_TOWN_GROUND_Y + 6);
    if (leafY >= -1 && leafY <= 3 && dx + dz + Math.abs(leafY - 1) <= 5) {
      return materials.oakLeaf;
    }
  }
  return undefined;
}

function wellBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const dx = Math.abs(worldX - 486);
  const dz = Math.abs(worldZ + 190);
  if (dx <= 2 && dz <= 2) {
    if (worldY === STARTER_TOWN_GROUND_Y + 1 && (dx === 2 || dz === 2)) {
      return materials.cobblestone;
    }
    if ((dx === 2 && dz === 0) || (dx === 0 && dz === 2)) {
      if (
        inRange(worldY, STARTER_TOWN_GROUND_Y + 2, STARTER_TOWN_GROUND_Y + 4)
      ) {
        return materials.oakLog;
      }
    }
    if (worldY === STARTER_TOWN_GROUND_Y + 5 && dz <= 2) {
      return materials.oakLumber;
    }
  }
  return undefined;
}

function blockRange(
  worldX: number,
  worldY: number,
  worldZ: number,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y0: number,
  y1 = y0
) {
  return (
    inRect(worldX, worldZ, x0, x1, z0, z1) &&
    inRange(worldY, STARTER_TOWN_GROUND_Y + y0, STARTER_TOWN_GROUND_Y + y1)
  );
}

function starterTownDenseInteriorBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  // Disabled by default. Dense block-built interiors create real terrain
  // collision and can trap players in doors, shop lanes, and interior paths.
  // Keep this as an emergency fallback only.
  if (process.env.BIOMES_LOCAL_DEV_BLOCK_INTERIORS !== "1") {
    return undefined;
  }

  // Dense, block-built interiors and exterior shop identity props. These use only
  // terrain blocks from the local snapshot so they cannot 404 like production
  // meshes, icons, or decals.

  // --- Player House: real home base, not an empty shell ---
  if (blockRange(worldX, worldY, worldZ, 451, 455, -263, -261, 1)) {
    return worldZ === -261 ? materials.whiteWool : materials.redWool; // downstairs bed.
  }
  if (blockRange(worldX, worldY, worldZ, 458, 462, -257, -255, 1)) {
    return materials.oakLumber; // dining table.
  }
  if (
    blockRange(worldX, worldY, worldZ, 457, 457, -258, -254, 1) ||
    blockRange(worldX, worldY, worldZ, 463, 463, -258, -254, 1)
  ) {
    return materials.oakLumber; // chairs/benches.
  }
  if (blockRange(worldX, worldY, worldZ, 463, 464, -252, -250, 1, 3)) {
    return worldY === STARTER_TOWN_GROUND_Y + 1
      ? materials.coal
      : materials.stoneBrick; // hearth/chimney base.
  }
  if (blockRange(worldX, worldY, worldZ, 450, 450, -256, -250, 1, 4)) {
    return (worldY + worldZ) % 2 === 0
      ? materials.oakLumber
      : materials.yellowWool; // books/shelves.
  }
  if (blockRange(worldX, worldY, worldZ, 456, 459, -250, -249, 1)) {
    return materials.woodCrate; // storage chest cluster.
  }
  if (blockRange(worldX, worldY, worldZ, 458, 460, -261, -259, 1)) {
    return materials.blueWool; // rug and starter journal corner.
  }
  if (blockRange(worldX, worldY, worldZ, 452, 456, -263, -261, 6)) {
    return worldZ === -261 ? materials.whiteWool : materials.blueWool; // upstairs bed.
  }
  if (blockRange(worldX, worldY, worldZ, 459, 463, -257, -255, 6)) {
    return materials.oakLumber; // upstairs desk.
  }
  if (blockRange(worldX, worldY, worldZ, 450, 450, -263, -255, 6, 8)) {
    return materials.oakLumber; // upstairs shelf wall.
  }
  if (blockRange(worldX, worldY, worldZ, 456, 462, -249, -248, 6)) {
    return materials.redWool; // upstairs rug.
  }

  // --- Dawn Loaf Bakery: oven, racks, sacks, counter, exterior bread display ---
  if (blockRange(worldX, worldY, worldZ, 422, 426, -198, -194, 1, 4)) {
    if (
      worldY === STARTER_TOWN_GROUND_Y + 2 &&
      inRect(worldX, worldZ, 423, 425, -197, -195)
    ) {
      return materials.coal;
    }
    return materials.stoneBrick;
  }
  if (blockRange(worldX, worldY, worldZ, 424, 424, -196, -196, 5, 8)) {
    return materials.stoneBrick; // oven chimney.
  }
  if (blockRange(worldX, worldY, worldZ, 434, 436, -197, -187, 1, 2)) {
    return materials.oakLumber; // long sales counter.
  }
  if (blockRange(worldX, worldY, worldZ, 421, 421, -192, -186, 1, 4)) {
    return (worldY + worldZ) % 2 === 0 ? materials.hay : materials.yellowWool; // bread racks.
  }
  if (blockRange(worldX, worldY, worldZ, 427, 431, -188, -186, 1)) {
    return materials.whiteWool; // flour sacks.
  }
  if (blockRange(worldX, worldY, worldZ, 428, 432, -193, -191, 1)) {
    return materials.oakLumber; // kneading table.
  }
  if (blockRange(worldX, worldY, worldZ, 439, 442, -197, -193, 1)) {
    return (worldX + worldZ) % 2 === 0 ? materials.hay : materials.yellowWool; // outside bread baskets.
  }

  // --- Harthmere Bank: vault, queue, ledgers, lockboxes, coins ---
  if (blockRange(worldX, worldY, worldZ, 546, 548, -230, -216, 1, 3)) {
    return materials.oakLumber; // teller counter.
  }
  if (blockRange(worldX, worldY, worldZ, 559, 561, -228, -218, 1, 6)) {
    return worldY === STARTER_TOWN_GROUND_Y + 3
      ? materials.coal
      : materials.stoneBrick; // vault door wall.
  }
  if (blockRange(worldX, worldY, worldZ, 551, 555, -229, -226, 1, 2)) {
    return materials.woodCrate; // lockboxes.
  }
  if (blockRange(worldX, worldY, worldZ, 552, 556, -218, -216, 1)) {
    return materials.yellowWool; // coin table.
  }
  if (
    blockRange(worldX, worldY, worldZ, 550, 550, -222, -216, 1, 2) ||
    blockRange(worldX, worldY, worldZ, 556, 556, -222, -216, 1, 2)
  ) {
    return materials.oakLog; // queue rails.
  }
  if (blockRange(worldX, worldY, worldZ, 563, 566, -224, -220, 1)) {
    return materials.stoneBrick; // exterior vault sign/display.
  }

  // --- Black Anvil / Weapons Shop: weapons, forge, shield wall, armor display ---
  if (blockRange(worldX, worldY, worldZ, 522, 526, -236, -232, 1, 4)) {
    return worldY === STARTER_TOWN_GROUND_Y + 2
      ? materials.coal
      : materials.stoneBrick; // forge.
  }
  if (blockRange(worldX, worldY, worldZ, 528, 531, -235, -233, 1)) {
    return materials.coal; // anvil.
  }
  if (blockRange(worldX, worldY, worldZ, 537, 538, -236, -222, 1, 4)) {
    return (worldY + worldZ) % 2 === 0
      ? materials.oakLumber
      : materials.stoneBrick; // weapon racks.
  }
  if (blockRange(worldX, worldY, worldZ, 524, 527, -222, -221, 1)) {
    return materials.blueWool; // water trough.
  }
  if (blockRange(worldX, worldY, worldZ, 532, 535, -223, -221, 1, 3)) {
    return (worldX + worldY + worldZ) % 2 === 0
      ? materials.redWool
      : materials.blackWool; // shield wall.
  }
  if (blockRange(worldX, worldY, worldZ, 540, 543, -231, -227, 1, 3)) {
    return worldY === STARTER_TOWN_GROUND_Y + 1
      ? materials.oakLumber
      : materials.stoneBrick; // exterior armor stand / sign.
  }

  // --- Green Mortar Healing Shop: treatment bed, herb shelves, bottles, mortar ---
  if (blockRange(worldX, worldY, worldZ, 450, 454, -181, -179, 1)) {
    return worldZ === -179 ? materials.whiteWool : materials.greenWool;
  }
  if (blockRange(worldX, worldY, worldZ, 461, 462, -182, -170, 1, 4)) {
    return (worldY + worldZ) % 2 === 0
      ? materials.greenWool
      : materials.yellowWool; // herb/potion shelves.
  }
  if (blockRange(worldX, worldY, worldZ, 455, 459, -172, -170, 1)) {
    return materials.stonePolished; // mortar table.
  }
  if (blockRange(worldX, worldY, worldZ, 451, 451, -174, -170, 1, 4)) {
    return materials.moss; // hanging herbs.
  }
  if (blockRange(worldX, worldY, worldZ, 464, 467, -180, -176, 1)) {
    return (worldX + worldZ) % 2 === 0
      ? materials.greenWool
      : materials.whiteWool; // outside remedy display.
  }

  // --- Wyrm & Candle Magic Supply: books, scrolls, candles, crystal, locked room ---
  if (blockRange(worldX, worldY, worldZ, 508, 508, -173, -161, 1, 5)) {
    return (worldY + worldZ) % 2 === 0
      ? materials.blueWool
      : materials.blackWool; // book wall.
  }
  if (blockRange(worldX, worldY, worldZ, 520, 522, -173, -161, 1, 5)) {
    return (worldY + worldZ) % 2 === 0
      ? materials.blackWool
      : materials.whiteWool; // scroll shelves.
  }
  if (blockRange(worldX, worldY, worldZ, 513, 517, -169, -165, 1)) {
    return materials.stonePolished; // arcane table.
  }
  if (blockRange(worldX, worldY, worldZ, 515, 515, -167, -167, 2, 5)) {
    return materials.led; // glowing crystal.
  }
  if (blockRange(worldX, worldY, worldZ, 512, 518, -164, -160, 1)) {
    return materials.redWool; // ritual rug.
  }
  if (blockRange(worldX, worldY, worldZ, 523, 526, -170, -166, 1, 4)) {
    return materials.led; // exterior magic sign / beacon.
  }
  const candleSpots = [
    [511, -172],
    [519, -172],
    [511, -162],
    [519, -162],
    [514, -165],
    [516, -169],
  ] as const;
  for (const [cx, cz] of candleSpots) {
    if (
      worldX === cx &&
      worldZ === cz &&
      worldY === STARTER_TOWN_GROUND_Y + 1
    ) {
      return materials.yellowWool;
    }
  }

  // --- Copper Kettle Tavern: bar, tables, chairs, stage, hearth, kegs, kitchen ---
  if (blockRange(worldX, worldY, worldZ, 534, 536, -204, -183, 1, 2)) {
    return materials.oakLumber; // long bar.
  }
  if (blockRange(worldX, worldY, worldZ, 537, 537, -202, -184, 3, 4)) {
    return (worldY + worldZ) % 2 === 0 ? materials.hay : materials.yellowWool; // bottle shelves.
  }
  if (blockRange(worldX, worldY, worldZ, 555, 560, -204, -198, 1)) {
    return materials.oakLumber; // stage.
  }
  if (blockRange(worldX, worldY, worldZ, 558, 561, -186, -182, 1, 3)) {
    return worldY === STARTER_TOWN_GROUND_Y + 1
      ? materials.coal
      : materials.stoneBrick; // hearth.
  }
  const tavernTables = [
    [542, -198],
    [550, -198],
    [544, -190],
    [552, -190],
    [546, -184],
  ] as const;
  for (const [tx, tz] of tavernTables) {
    if (blockRange(worldX, worldY, worldZ, tx - 1, tx + 1, tz - 1, tz + 1, 1)) {
      return materials.oakLumber;
    }
    if (
      worldY === STARTER_TOWN_GROUND_Y + 1 &&
      Math.abs(worldX - tx) + Math.abs(worldZ - tz) === 3
    ) {
      return materials.oakLumber; // chairs.
    }
  }
  if (blockRange(worldX, worldY, worldZ, 532, 533, -204, -198, 1, 2)) {
    return materials.hay; // kegs.
  }
  if (blockRange(worldX, worldY, worldZ, 563, 566, -198, -192, 1)) {
    return materials.yellowWool; // exterior kettle sign.
  }

  // --- Chapel, Reeve Hall, Guard Yard, Docks, Mudden Ward, Farm details ---
  if (blockRange(worldX, worldY, worldZ, 468, 486, -147, -147, 1, 2)) {
    return materials.oakLumber; // pews.
  }
  if (blockRange(worldX, worldY, worldZ, 475, 479, -131, -130, 1, 3)) {
    return materials.stonePolished; // altar.
  }
  if (blockRange(worldX, worldY, worldZ, 478, 478, -129, -129, 4, 7)) {
    return worldY === STARTER_TOWN_GROUND_Y + 7
      ? materials.blackWool
      : materials.oakLog; // empty bell frame.
  }
  if (blockRange(worldX, worldY, worldZ, 552, 576, -252, -252, 1, 3)) {
    return materials.redWool; // Reeve Hall red banner rail.
  }
  if (blockRange(worldX, worldY, worldZ, 552, 558, -264, -260, 1)) {
    return materials.oakLumber; // tax clerk desks.
  }
  if (blockRange(worldX, worldY, worldZ, 562, 570, -264, -260, 1)) {
    return materials.yellowWool; // permit/ledger table.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRange(worldX, 505, 518) &&
    [-266, -262].includes(worldZ)
  ) {
    return materials.oakLumber; // training rails.
  }
  if (
    blockRange(worldX, worldY, worldZ, 508, 508, -269, -269, 1, 4) ||
    blockRange(worldX, worldY, worldZ, 516, 516, -269, -269, 1, 4)
  ) {
    return materials.hay; // practice dummies.
  }
  if (blockRange(worldX, worldY, worldZ, 578, 584, -186, -178, 1, 2)) {
    return materials.woodCrate; // cargo stack.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRange(worldX, 592, 604) &&
    [-189, -177, -165].includes(worldZ)
  ) {
    return materials.oakLumber; // dock tables.
  }
  if (blockRange(worldX, worldY, worldZ, 596, 599, -181, -179, 1, 3)) {
    return materials.blackWool; // suspicious crate.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 3 &&
    inRange(worldX, 400, 430) &&
    [-158, -150].includes(worldZ)
  ) {
    return materials.whiteWool; // laundry lines.
  }
  if (blockRange(worldX, worldY, worldZ, 402, 407, -166, -164, 1)) {
    return materials.hay; // patched bedding.
  }
  if (blockRange(worldX, worldY, worldZ, 420, 426, -156, -154, 1)) {
    return materials.blueWool; // wash tubs.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRect(worldX, worldZ, 431, 459, -247, -223) &&
    (worldX === 431 || worldX === 459 || worldZ === -247 || worldZ === -223)
  ) {
    return materials.oakLog; // chicken-yard fence.
  }
  if (blockRange(worldX, worldY, worldZ, 435, 442, -224, -222, 1, 2)) {
    return materials.hay; // hay bales.
  }
  if (blockRange(worldX, worldY, worldZ, 455, 457, -245, -241, 1)) {
    return materials.blueWool; // water trough.
  }
  if (blockRange(worldX, worldY, worldZ, 443, 445, -242, -242, 4)) {
    return materials.hay; // scarecrow arms.
  }
  if (blockRange(worldX, worldY, worldZ, 444, 444, -242, -242, 1, 5)) {
    return worldY === STARTER_TOWN_GROUND_Y + 5
      ? materials.yellowWool
      : materials.oakLog;
  }

  return undefined;
}

function starterTownInteriorAndStoryBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  // --- New-player signpost and Market Board / quest hub ---
  // These are deliberately block-built so they never 404 on missing sign or UI assets.
  if (blockRange(worldX, worldY, worldZ, 482, 490, -268, -268, 1, 4)) {
    return worldX === 486 && worldY === STARTER_TOWN_GROUND_Y + 4
      ? materials.yellowWool
      : materials.oakLumber;
  }
  if (blockRange(worldX, worldY, worldZ, 500, 506, -211, -211, 1, 5)) {
    if (
      (worldX === 500 || worldX === 506) &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 5)
    ) {
      return materials.oakLog;
    }
    if (worldY === STARTER_TOWN_GROUND_Y + 5 && worldX === 503) {
      return materials.yellowWool; // visible quest marker above the Market Board.
    }
    if (worldY === STARTER_TOWN_GROUND_Y + 4 && worldX === 503) {
      return materials.blackWool;
    }
    return materials.oakLumber;
  }
  // Colored direction signs around the square: inn, bank, smithy, chapel, docks, farm, guard yard.
  const signs = [
    [492, -205, materials.redWool],
    [494, -216, materials.blueWool],
    [478, -205, materials.greenWool],
    [480, -216, materials.yellowWool],
    [486, -224, materials.redWool],
    [486, -195, materials.blueWool],
    [474, -211, materials.yellowWool],
  ] as const;
  for (const [sx, sz, mat] of signs) {
    if (
      worldX === sx &&
      worldZ === sz &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 2)
    ) {
      return materials.oakLog;
    }
    if (
      Math.abs(worldX - sx) <= 1 &&
      worldZ === sz &&
      worldY === STARTER_TOWN_GROUND_Y + 3
    ) {
      return mat;
    }
  }

  // Keep the local-dev town playable by default. Dense furniture, counters,
  // racks, beds, and shop clutter are now rendered as visual-only curated
  // GLB/OBJ/FBX props in the Harthmere runtime asset renderer. Block-built
  // furniture is useful as an emergency fallback, but it creates real terrain
  // collision and was forcing players to dig through interiors and door lanes.
  if (process.env.BIOMES_LOCAL_DEV_BLOCK_INTERIORS !== "1") {
    return undefined;
  }

  // --- Player House: two levels with home-base details ---
  if (blockRange(worldX, worldY, worldZ, 451, 455, -263, -261, 1)) {
    return worldZ === -261 ? materials.whiteWool : materials.redWool; // downstairs bed.
  }
  if (blockRange(worldX, worldY, worldZ, 458, 461, -255, -253, 1)) {
    return materials.oakLumber; // table.
  }
  if (blockRange(worldX, worldY, worldZ, 463, 464, -252, -250, 1, 2)) {
    return worldY === STARTER_TOWN_GROUND_Y + 1
      ? materials.coal
      : materials.stoneBrick; // hearth.
  }
  if (blockRange(worldX, worldY, worldZ, 450, 450, -256, -250, 1, 3)) {
    return materials.oakLumber; // shelves.
  }
  if (blockRange(worldX, worldY, worldZ, 457, 458, -249, -248, 1)) {
    return materials.blueWool; // starter journal / welcome note.
  }
  if (blockRange(worldX, worldY, worldZ, 452, 456, -263, -261, 6)) {
    return worldZ === -261 ? materials.whiteWool : materials.blueWool; // upstairs bed.
  }
  if (blockRange(worldX, worldY, worldZ, 460, 463, -257, -255, 6)) {
    return materials.oakLumber; // upstairs desk.
  }
  if (blockRange(worldX, worldY, worldZ, 449, 465, -247, -247, 6)) {
    return materials.redWool; // upstairs rug edge.
  }

  // --- Dawn Loaf Bakery ---
  if (blockRange(worldX, worldY, worldZ, 422, 425, -198, -195, 1, 3)) {
    return worldY === STARTER_TOWN_GROUND_Y + 2 &&
      inRect(worldX, worldZ, 423, 424, -197, -196)
      ? materials.coal
      : materials.stoneBrick; // oven.
  }
  if (blockRange(worldX, worldY, worldZ, 434, 436, -197, -187, 1)) {
    return materials.oakLumber; // counter.
  }
  if (blockRange(worldX, worldY, worldZ, 421, 421, -191, -186, 1, 3)) {
    return (worldY + worldZ) % 2 === 0 ? materials.hay : materials.yellowWool; // bread shelves.
  }
  if (blockRange(worldX, worldY, worldZ, 427, 430, -188, -186, 1)) {
    return materials.whiteWool; // flour sacks.
  }

  // --- Harthmere Bank ---
  if (blockRange(worldX, worldY, worldZ, 546, 548, -230, -216, 1, 2)) {
    return materials.oakLumber; // teller counter.
  }
  if (blockRange(worldX, worldY, worldZ, 559, 561, -228, -218, 1, 5)) {
    return worldY === STARTER_TOWN_GROUND_Y + 3
      ? materials.coal
      : materials.stoneBrick; // vault door / wall.
  }
  if (blockRange(worldX, worldY, worldZ, 551, 555, -229, -226, 1)) {
    return materials.woodCrate; // lockboxes.
  }
  if (blockRange(worldX, worldY, worldZ, 552, 556, -218, -216, 1)) {
    return materials.yellowWool; // coin ledger table.
  }

  // --- Black Anvil / Weapons Shop ---
  if (blockRange(worldX, worldY, worldZ, 522, 525, -236, -233, 1, 3)) {
    return worldY === STARTER_TOWN_GROUND_Y + 2
      ? materials.coal
      : materials.stoneBrick; // forge.
  }
  if (blockRange(worldX, worldY, worldZ, 528, 531, -235, -233, 1)) {
    return materials.coal; // anvil.
  }
  if (blockRange(worldX, worldY, worldZ, 537, 538, -236, -222, 1, 3)) {
    return (worldY + worldZ) % 2 === 0
      ? materials.oakLumber
      : materials.stoneBrick; // weapon racks.
  }
  if (blockRange(worldX, worldY, worldZ, 524, 527, -222, -221, 1)) {
    return materials.blueWool; // water trough.
  }
  if (blockRange(worldX, worldY, worldZ, 532, 534, -223, -221, 1, 2)) {
    return materials.redWool; // shield display.
  }

  // --- Green Mortar Healing Shop ---
  if (blockRange(worldX, worldY, worldZ, 450, 454, -181, -179, 1)) {
    return worldZ === -179 ? materials.whiteWool : materials.greenWool; // treatment bed.
  }
  if (blockRange(worldX, worldY, worldZ, 461, 462, -182, -170, 1, 3)) {
    return (worldY + worldZ) % 2 === 0
      ? materials.greenWool
      : materials.yellowWool; // herb/potion shelves.
  }
  if (blockRange(worldX, worldY, worldZ, 455, 458, -172, -170, 1)) {
    return materials.stonePolished; // mortar table.
  }
  if (blockRange(worldX, worldY, worldZ, 451, 451, -173, -170, 1, 3)) {
    return materials.moss; // hanging herbs.
  }

  // --- Wyrm & Candle Magic Supply ---
  if (blockRange(worldX, worldY, worldZ, 508, 508, -173, -161, 1, 4)) {
    return materials.blueWool; // book wall.
  }
  if (blockRange(worldX, worldY, worldZ, 520, 522, -173, -161, 1, 4)) {
    return materials.blackWool; // scroll/book shelves.
  }
  if (blockRange(worldX, worldY, worldZ, 514, 516, -168, -166, 1)) {
    return materials.stonePolished; // arcane desk.
  }
  if (blockRange(worldX, worldY, worldZ, 515, 515, -167, -167, 2, 4)) {
    return materials.led; // glowing crystal.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    Math.abs(worldX - 515) + Math.abs(worldZ + 167) === 4
  ) {
    return materials.yellowWool; // candle circle.
  }

  // --- Copper Kettle Tavern ---
  if (blockRange(worldX, worldY, worldZ, 534, 536, -203, -183, 1, 2)) {
    return materials.oakLumber; // bar counter.
  }
  if (blockRange(worldX, worldY, worldZ, 558, 561, -203, -198, 1)) {
    return materials.redWool; // bard stage.
  }
  if (blockRange(worldX, worldY, worldZ, 553, 557, -185, -181, 1, 3)) {
    return worldY === STARTER_TOWN_GROUND_Y + 2
      ? materials.coal
      : materials.stoneBrick; // hearth.
  }
  const tavernTables = [
    [543, -199],
    [551, -199],
    [543, -190],
    [551, -190],
    [547, -185],
  ] as const;
  for (const [tx, tz] of tavernTables) {
    if (blockRange(worldX, worldY, worldZ, tx - 1, tx + 1, tz - 1, tz + 1, 1)) {
      return worldX === tx && worldZ === tz
        ? materials.oakLumber
        : materials.hay;
    }
  }
  if (blockRange(worldX, worldY, worldZ, 537, 538, -183, -181, 1, 3)) {
    return materials.yellowWool; // drink/food shelves.
  }

  // --- Chapel, grave story, and missing bell clue ---
  if (blockRange(worldX, worldY, worldZ, 474, 480, -132, -130, 1, 2)) {
    return materials.whiteWool; // altar.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRange(worldX, 466, 488) &&
    [-142, -138, -134].includes(worldZ)
  ) {
    return materials.oakLumber; // pew rows.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRect(worldX, worldZ, 468, 486, -148, -148) &&
    worldX % 3 === 0
  ) {
    return materials.yellowWool; // chapel candles.
  }
  if (blockRange(worldX, worldY, worldZ, 477, 481, -150, -150, 2, 5)) {
    return worldY === STARTER_TOWN_GROUND_Y + 5
      ? materials.blackWool
      : materials.oakLog; // empty bell frame.
  }

  // --- Guard yard and Reeve Hall ---
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRange(worldX, 505, 518) &&
    [-266, -262].includes(worldZ)
  ) {
    return materials.oakLumber; // training rails.
  }
  if (
    blockRange(worldX, worldY, worldZ, 508, 508, -269, -269, 1, 3) ||
    blockRange(worldX, worldY, worldZ, 516, 516, -269, -269, 1, 3)
  ) {
    return materials.hay; // practice dummies.
  }
  if (blockRange(worldX, worldY, worldZ, 552, 576, -252, -252, 1, 2)) {
    return materials.redWool; // Reeve Hall red banner rail.
  }
  if (blockRange(worldX, worldY, worldZ, 552, 556, -264, -260, 1)) {
    return materials.oakLumber; // tax clerk desks.
  }

  // --- Docks and Mudden Ward details ---
  if (blockRange(worldX, worldY, worldZ, 578, 584, -186, -178, 1)) {
    return materials.woodCrate; // cargo stack in dockmaster shed.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRange(worldX, 592, 604) &&
    [-189, -177, -165].includes(worldZ)
  ) {
    return materials.oakLumber; // dock benches / fish tables.
  }
  if (blockRange(worldX, worldY, worldZ, 596, 598, -181, -179, 1, 2)) {
    return materials.blackWool; // suspicious whispering crate.
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 3 &&
    inRange(worldX, 400, 430) &&
    [-158, -150].includes(worldZ)
  ) {
    return materials.whiteWool; // laundry lines.
  }
  if (blockRange(worldX, worldY, worldZ, 402, 406, -166, -164, 1)) {
    return materials.hay; // patched bed / poor-home detail.
  }
  if (blockRange(worldX, worldY, worldZ, 420, 426, -156, -154, 1)) {
    return materials.blueWool; // wash tubs / water detail.
  }

  // --- Farm and orchard details ---
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRect(worldX, worldZ, 431, 459, -247, -223) &&
    (worldX === 431 || worldX === 459 || worldZ === -247 || worldZ === -223)
  ) {
    return materials.oakLog; // chicken-yard fence.
  }
  if (blockRange(worldX, worldY, worldZ, 435, 440, -224, -222, 1, 2)) {
    return materials.hay; // hay bales.
  }
  if (blockRange(worldX, worldY, worldZ, 455, 457, -245, -241, 1)) {
    return materials.blueWool; // water trough.
  }
  if (blockRange(worldX, worldY, worldZ, 444, 444, -242, -242, 1, 4)) {
    return materials.oakLog; // scarecrow post.
  }
  if (blockRange(worldX, worldY, worldZ, 443, 445, -242, -242, 4)) {
    return materials.hay; // scarecrow arms.
  }
  if (blockRange(worldX, worldY, worldZ, 444, 444, -242, -242, 5)) {
    return materials.yellowWool; // scarecrow head.
  }

  return undefined;
}

// HARTHMERE_CLEAN_TOWN_REBUILD_START

// HARTHMERE_SERVER_VOXEL_ALL_BUILDINGS_DUNGEONS
// Server-side terrain is now the owner for structural buildings, town walls,
// bridge parapets, watchtowers, and the Old Well/Underways dungeon. Runtime
// GLB assets may still decorate rooms, but walls/floors/ceilings/stairs are
// real voxel terrain blocks seeded by the shim.
const HARTHMERE_SERVER_VOXEL_ALL_BUILDINGS_DUNGEONS_VERSION =
  "harthmere-server-voxel-all-buildings-dungeons";

// Preserve the V6 names because starterTownSurfaceMaterial() and
// starterTownAboveGroundBlockAt() already call these functions.
// The building table and its types now live in
// src/shared/harthmere/harthmere_town_buildings.ts so they can be tested
// without booting a server. Only the data moved; every generator below is
// unchanged.
type HarthmereMat = HarthmereBuildingMat;

// HARTHMERE_SERVER_VOXEL_OCCUPANCY_STRUCTURES_START
// HARTHMERE_SERVER_VOXEL_OCCUPANCY_STRUCTURES_VERSION
// Extra server-owned structures that replace the remaining large runtime OBJ/GLB
// silhouettes: wilds houses, watch posts, watermill/windmill landmarks, dockside
// homes, and NPC trade/home annexes. These are terrain blocks, not prop shells.
const HARTHMERE_SERVER_VOXEL_OCCUPANCY_STRUCTURES_VERSION =
  "harthmere-server-voxel-occupancy-structures";

// HARTHMERE_SERVER_VOXEL_OCCUPANCY_STRUCTURES_END

const HARTHMERE_DUNGEON_AREAS: ReadonlyArray<{
  readonly name: string;
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly y0: number;
  readonly y1: number;
}> = [
  {
    name: "old_well_descent_room",
    x0: 394,
    x1: 408,
    z0: -242,
    z1: -228,
    y0: -6,
    y1: -1,
  },
  {
    name: "underways_north_south_tunnel",
    x0: 399,
    x1: 403,
    z0: -270,
    z1: -226,
    y0: -5,
    y1: -1,
  },
  {
    name: "underways_east_west_tunnel",
    x0: 399,
    x1: 446,
    z0: -238,
    z1: -234,
    y0: -5,
    y1: -1,
  },
  {
    name: "rat_crowns_den",
    x0: 424,
    x1: 446,
    z0: -246,
    z1: -228,
    y0: -6,
    y1: -1,
  },
  {
    name: "smuggler_drain_vault",
    x0: 388,
    x1: 408,
    z0: -276,
    z1: -260,
    y0: -6,
    y1: -1,
  },
  {
    name: "crypt_rest_room",
    x0: 430,
    x1: 450,
    z0: -226,
    z1: -210,
    y0: -6,
    y1: -1,
  },
  {
    name: "mossglass_survey_cave",
    x0: 172,
    x1: 184,
    z0: -96,
    z1: -84,
    y0: -6,
    y1: -1,
  },
  {
    name: "windowlight_little_cave",
    x0: 92,
    x1: 103,
    z0: -486,
    z1: -474,
    y0: -21,
    y1: -17,
  },
  {
    name: "deep_spindle_massive_cave",
    x0: 194,
    x1: 230,
    z0: -389,
    z1: -349,
    y0: -88,
    y1: -78,
  },
  {
    name: "harthmere_core_massive_cave",
    x0: 396,
    x1: 460,
    z0: -330,
    z1: -268,
    y0: -59,
    y1: -46,
  },
  {
    name: "harthmere_far_hollow_massive_cave",
    x0: 428,
    x1: 492,
    z0: -706,
    z1: -642,
    y0: -45,
    y1: -32,
  },
  {
    name: "harthmere_high_vault_massive_cave",
    x0: -350,
    x1: -286,
    z0: 277,
    z1: 341,
    y0: 45,
    y1: 57,
  },
  {
    // A single continuous shaft serves every negative-Y Bellbound quest.
    // The generated switchback stair and level landings are added below.
    name: "bellbinder_switchback_descent",
    x0: HARTHMERE_BELLBINDER_DESCENT.authoredBounds.minX,
    x1: HARTHMERE_BELLBINDER_DESCENT.authoredBounds.maxX,
    z0: HARTHMERE_BELLBINDER_DESCENT.authoredBounds.minZ,
    z1: HARTHMERE_BELLBINDER_DESCENT.authoredBounds.maxZ,
    y0: HARTHMERE_BELLBINDER_DESCENT.minRelativeY,
    y1: HARTHMERE_BELLBINDER_DESCENT.maxRelativeY,
  },
];

// One horizontal step descends one block. The first stair floor is Y=51,
// immediately below the Y=52 chapel opening; step 112 reaches feet Y=-60.
const HARTHMERE_BELLBINDER_FLOOR_BLOCKS = new Set(
  harthmereBellbinderDescentFloorBlocks().map(([x, y, z]) => `${x}:${y}:${z}`)
);

function harthmereIsBellbinderSurfaceOpening(
  worldX: number,
  worldY: number,
  worldZ: number
) {
  const [centerX, centerY, centerZ] =
    HARTHMERE_BELLBINDER_DESCENT.surfaceOpeningCenter;
  return (
    worldY === centerY &&
    inRange(worldX, centerX - 1, centerX + 1) &&
    inRange(worldZ, centerZ - 2, centerZ)
  );
}

function harthmereBellbinderDescentBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  return HARTHMERE_BELLBINDER_FLOOR_BLOCKS.has(`${worldX}:${worldY}:${worldZ}`)
    ? materials.stoneBrick
    : undefined;
}

function harthmereMat(
  materials: ReturnType<typeof localDevMaterials>,
  key: HarthmereMat | HarthmereExtensionEdgeHorizonMaterial
): TerrainID {
  return materials[key] as TerrainID;
}

function harthmereFloorCount(building: HarthmereBuilding): number {
  return Math.max(1, building.floors ?? (building.upper ? 2 : 1));
}

function harthmereStoryHeight(building: HarthmereBuilding): number {
  return building.profile === "slum" ? 4 : 5;
}

function harthmereTopRelY(building: HarthmereBuilding): number {
  return harthmereBuildingTopRelY(
    building,
    harthmereFloorCount(building),
    harthmereStoryHeight(building)
  );
}

function harthmereIsDoor(
  building: HarthmereBuilding,
  worldX: number,
  worldZ: number,
  relY: number
) {
  const storyHeight = harthmereStoryHeight(building);
  if (relY < 1 || relY > Math.min(3, storyHeight - 1)) {
    return false;
  }

  if (building.doorSide === "north") {
    return (
      worldZ === building.z0 && Math.abs(worldX - building.doorCenter) <= 1
    );
  }
  if (building.doorSide === "south") {
    return (
      worldZ === building.z1 && Math.abs(worldX - building.doorCenter) <= 1
    );
  }
  if (building.doorSide === "west") {
    return (
      worldX === building.x0 && Math.abs(worldZ - building.doorCenter) <= 1
    );
  }
  return worldX === building.x1 && Math.abs(worldZ - building.doorCenter) <= 1;
}

// BIOMES_HARTHMERE_BUILDING_ACCESS_CLEARANCE
// The v84/v87 walk surveys showed high collision density around the shifted
// Harthmere town and the player reported that many shops felt blocked off by
// walls. Keep the solid block buildings, but carve a short doorway lane through
// the outside threshold and first few interior blocks so every authored building
// has a visible, walkable entry.
function harthmereDoorLaneClearanceBlock(
  building: HarthmereBuilding,
  worldX: number,
  worldY: number,
  worldZ: number
) {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  if (relY < 1 || relY > 3) return false;

  if (building.doorSide === "north") {
    return (
      Math.abs(worldX - building.doorCenter) <= 2 &&
      inRange(worldZ, building.z0 - 3, building.z0 + 3)
    );
  }
  if (building.doorSide === "south") {
    return (
      Math.abs(worldX - building.doorCenter) <= 2 &&
      inRange(worldZ, building.z1 - 3, building.z1 + 3)
    );
  }
  if (building.doorSide === "west") {
    return (
      Math.abs(worldZ - building.doorCenter) <= 2 &&
      inRange(worldX, building.x0 - 3, building.x0 + 3)
    );
  }
  return (
    Math.abs(worldZ - building.doorCenter) <= 2 &&
    inRange(worldX, building.x1 - 3, building.x1 + 3)
  );
}

function harthmereBalconyBounds(building: HarthmereBuilding) {
  const b = building.balcony;
  if (!b) return undefined;
  if (b.side === "east")
    return [building.x1 + 1, building.x1 + b.depth, b.start, b.end] as const;
  if (b.side === "west")
    return [building.x0 - b.depth, building.x0 - 1, b.start, b.end] as const;
  if (b.side === "south")
    return [b.start, b.end, building.z1 + 1, building.z1 + b.depth] as const;
  return [b.start, b.end, building.z0 - b.depth, building.z0 - 1] as const;
}

function harthmereWithinBuildingExpandedBounds(
  building: HarthmereBuilding,
  worldX: number,
  worldZ: number
) {
  let x0 = building.x0 - 1;
  let x1 = building.x1 + 1;
  let z0 = building.z0 - 1;
  let z1 = building.z1 + 1;
  const b = harthmereBalconyBounds(building);
  if (b) {
    x0 = Math.min(x0, b[0] - 1);
    x1 = Math.max(x1, b[1] + 1);
    z0 = Math.min(z0, b[2] - 1);
    z1 = Math.max(z1, b[3] + 1);
  }
  return inRect(worldX, worldZ, x0, x1, z0, z1);
}

const HARTHMERE_CLEAR_ROOF_STREET_AIR_VERSION =
  "harthmere-clear-roof-street-air";
const HARTHMERE_CLEAR_STREET_RECTS: ReadonlyArray<
  readonly [number, number, number, number]
> = [
  [478, 496, -292, -214],
  [414, 606, -218, -202],
  [586, 612, -218, -176],
  [400, 434, -162, -146],
  [478, 492, -198, -126],
  [336, 476, -366, -306],
  [362, 470, -138, -92],
];

function harthmereIsInsideRect(
  worldX: number,
  worldZ: number,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  pad = 0
) {
  return (
    worldX >= x0 - pad &&
    worldX <= x1 + pad &&
    worldZ >= z0 - pad &&
    worldZ <= z1 + pad
  );
}

function harthmereIsInsideAnyBuildingFootprint(
  worldX: number,
  worldZ: number,
  pad = 0
) {
  return HARTHMERE_BUILDINGS.some((building) => {
    if (
      harthmereIsInsideRect(
        worldX,
        worldZ,
        building.x0,
        building.x1,
        building.z0,
        building.z1,
        pad
      )
    ) {
      return true;
    }
    const balcony = harthmereBalconyBounds(building);
    return balcony
      ? harthmereIsInsideRect(
          worldX,
          worldZ,
          balcony[0],
          balcony[1],
          balcony[2],
          balcony[3],
          pad
        )
      : false;
  });
}

function harthmereIsInsideClearStreetRect(worldX: number, worldZ: number) {
  return HARTHMERE_CLEAR_STREET_RECTS.some(([x0, x1, z0, z1]) =>
    harthmereIsInsideRect(worldX, worldZ, x0, x1, z0, z1)
  );
}

function harthmereShouldClearStreetAirBlock(
  worldX: number,
  worldY: number,
  worldZ: number
) {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  if (relY < 1 || relY > 32) return false;
  if (!harthmereIsInsideClearStreetRect(worldX, worldZ)) return false;
  return !harthmereIsInsideAnyBuildingFootprint(worldX, worldZ, 0);
}

function harthmereShouldClearRoofAirBlock(
  worldX: number,
  worldY: number,
  worldZ: number
) {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  for (const building of HARTHMERE_BUILDINGS) {
    if (!harthmereWithinBuildingExpandedBounds(building, worldX, worldZ))
      continue;
    return relY > harthmereTopRelY(building) && relY <= 32;
  }
  return false;
}

function harthmereShouldForceClearRoofStreetAirBlock(
  worldX: number,
  worldY: number,
  worldZ: number
) {
  return (
    harthmereShouldClearStreetAirBlock(worldX, worldY, worldZ) ||
    harthmereShouldClearRoofAirBlock(worldX, worldY, worldZ)
  );
}

function harthmereIsInDungeonArea(
  worldX: number,
  worldZ: number,
  relY: number
) {
  return HARTHMERE_DUNGEON_AREAS.some(
    (area) =>
      inRect(worldX, worldZ, area.x0, area.x1, area.z0, area.z1) &&
      inRange(relY, area.y0, area.y1)
  );
}

function harthmereIsDungeonBoundary(
  worldX: number,
  worldZ: number,
  relY: number
) {
  return HARTHMERE_DUNGEON_AREAS.some((area) => {
    if (!inRange(relY, area.y0, area.y1)) return false;
    if (!inRect(worldX, worldZ, area.x0, area.x1, area.z0, area.z1))
      return false;
    return (
      worldX === area.x0 ||
      worldX === area.x1 ||
      worldZ === area.z0 ||
      worldZ === area.z1
    );
  });
}

function harthmereShouldCarveDungeonAirBlockAt(
  worldX: number,
  worldY: number,
  worldZ: number
) {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  return HARTHMERE_DUNGEON_AREAS.some((area) => {
    if (!inRange(relY, area.y0 + 1, area.y1)) return false;
    if (!inRect(worldX, worldZ, area.x0, area.x1, area.z0, area.z1))
      return false;
    if (harthmereIsDungeonBoundary(worldX, worldZ, relY)) return false;
    return true;
  });
}

function harthmereExoticMatterDepositTerrain(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const deposit = harthmereExoticMatterDepositAtBlock({
    x: worldX,
    y: worldY,
    z: worldZ,
  });
  if (!deposit) return undefined;
  if (deposit.componentId === "antihydrogen") return materials.diamondOre;
  if (deposit.componentId === "antihelium") return materials.goldOre;
  return (worldX + worldY + worldZ) % 2 === 0
    ? materials.blackWool
    : materials.ironOre;
}

function harthmereDungeonBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  const exoticMatterDeposit = harthmereExoticMatterDepositTerrain(
    materials,
    worldX,
    worldY,
    worldZ
  );
  if (exoticMatterDeposit !== undefined) return exoticMatterDeposit;

  const bellbinderDescent = harthmereBellbinderDescentBlockAt(
    materials,
    worldX,
    worldY,
    worldZ
  );
  if (bellbinderDescent !== undefined) return bellbinderDescent;

  for (const area of HARTHMERE_DUNGEON_AREAS) {
    if (!inRect(worldX, worldZ, area.x0, area.x1, area.z0, area.z1)) continue;
    const boundary =
      worldX === area.x0 ||
      worldX === area.x1 ||
      worldZ === area.z0 ||
      worldZ === area.z1;
    if (relY === area.y0 - 1) {
      return (worldX + worldZ) % 7 === 0
        ? materials.coal
        : materials.stoneBrick;
    }
    if (boundary && inRange(relY, area.y0, area.y1)) {
      return (worldX + worldZ + relY) % 11 === 0
        ? materials.ironOre
        : materials.stoneBrick;
    }
    if (
      relY === area.y1 + 1 &&
      inRect(worldX, worldZ, area.x0, area.x1, area.z0, area.z1)
    ) {
      return materials.stoneBrick;
    }
  }

  // Entry ladder/shaft under the old well. It is visible and carved from server terrain.
  if (worldX === 400 && worldZ === -235 && inRange(relY, -6, 1)) {
    return relY % 2 === 0 ? materials.oakLog : materials.coal;
  }

  return undefined;
}

function harthmereSurfaceMaterial(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldZ: number
): TerrainID | undefined {
  const material = harthmereTownSurfaceMaterialAt(worldX, worldZ);
  return material ? harthmereMat(materials, material) : undefined;
}

function harthmereStairStepFor(
  stair: HarthmereStairs,
  worldX: number,
  worldZ: number
): number | undefined {
  const inWidth =
    stair.direction === "east" || stair.direction === "west"
      ? worldZ >= stair.z0 && worldZ < stair.z0 + stair.width
      : worldX >= stair.x0 && worldX < stair.x0 + stair.width;
  if (!inWidth) return undefined;

  if (stair.direction === "east") {
    if (worldX < stair.x0 || worldX >= stair.x0 + stair.length)
      return undefined;
    return worldX - stair.x0;
  }
  if (stair.direction === "west") {
    if (worldX < stair.x0 || worldX >= stair.x0 + stair.length)
      return undefined;
    return stair.x0 + stair.length - 1 - worldX;
  }
  if (stair.direction === "south") {
    if (worldZ < stair.z0 || worldZ >= stair.z0 + stair.length)
      return undefined;
    return worldZ - stair.z0;
  }
  if (worldZ < stair.z0 || worldZ >= stair.z0 + stair.length) return undefined;
  return stair.z0 + stair.length - 1 - worldZ;
}

function harthmereIsStairOrLanding(
  building: HarthmereBuilding,
  worldX: number,
  worldZ: number
) {
  const stair = building.stairs;
  if (!stair) return false;
  const step = harthmereStairStepFor(stair, worldX, worldZ);
  if (step !== undefined) return true;
  if (stair.direction === "east" || stair.direction === "west") {
    return (
      worldZ >= stair.z0 &&
      worldZ < stair.z0 + stair.width &&
      worldX >= stair.x0 &&
      worldX <= stair.x0 + stair.length + 1
    );
  }
  return (
    worldX >= stair.x0 &&
    worldX < stair.x0 + stair.width &&
    worldZ >= stair.z0 &&
    worldZ <= stair.z0 + stair.length + 1
  );
}

function harthmereBalconyDoor(
  building: HarthmereBuilding,
  worldX: number,
  worldZ: number,
  relY: number
) {
  const b = building.balcony;
  if (!b) return false;
  const storyHeight = harthmereStoryHeight(building);
  const baseY = (b.floor - 1) * storyHeight;
  if (relY < baseY + 1 || relY > baseY + 3) return false;
  if (b.side === "east")
    return (
      worldX === building.x1 && worldZ >= b.start + 1 && worldZ <= b.end - 1
    );
  if (b.side === "west")
    return (
      worldX === building.x0 && worldZ >= b.start + 1 && worldZ <= b.end - 1
    );
  if (b.side === "south")
    return (
      worldZ === building.z1 && worldX >= b.start + 1 && worldX <= b.end - 1
    );
  return worldZ === building.z0 && worldX >= b.start + 1 && worldX <= b.end - 1;
}

// HARTHMERE_AUTO_EXTERNAL_STAIRS_VERSION
// Multi-floor buildings must have a physical voxel stair/landing. If a building
// definition forgets explicit `stairs`, generate a conservative exterior stair
// off the door side instead of leaving the upper floor as a floating box.
const HARTHMERE_AUTO_EXTERNAL_STAIRS_VERSION = "harthmere-auto-external-stairs";

function harthmereDefaultStairsForBuilding(
  building: HarthmereBuilding
): HarthmereStairs | undefined {
  if (harthmereFloorCount(building) < 2 || building.stairs) return undefined;
  const centerX = Math.floor((building.x0 + building.x1) / 2);
  const centerZ = Math.floor((building.z0 + building.z1) / 2);
  if (building.doorSide === "south")
    return harthmereStairsFor(centerX - 2, building.z1 + 2, "east", 6, 2);
  if (building.doorSide === "north")
    return harthmereStairsFor(centerX - 2, building.z0 - 7, "east", 6, 2);
  if (building.doorSide === "east")
    return harthmereStairsFor(building.x1 + 2, centerZ - 2, "south", 6, 2);
  return harthmereStairsFor(building.x0 - 7, centerZ - 2, "south", 6, 2);
}

function harthmereAutoExternalStairBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  building: HarthmereBuilding,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const stair = harthmereDefaultStairsForBuilding(building);
  if (!stair) return undefined;
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  const storyHeight = harthmereStoryHeight(building);
  const step = harthmereStairStepFor(stair, worldX, worldZ);
  if (step !== undefined && relY === Math.min(storyHeight, step + 1)) {
    return building.floor
      ? harthmereMat(materials, building.floor)
      : materials.stoneBrick;
  }
  // Landing outside upper doorway.
  if (stair.direction === "east" || stair.direction === "west") {
    const landingX =
      stair.direction === "east" ? stair.x0 + stair.length : stair.x0 - 1;
    if (
      inRange(worldX, landingX - 1, landingX + 1) &&
      inRange(worldZ, stair.z0, stair.z0 + stair.width - 1) &&
      relY === storyHeight
    ) {
      return building.floor
        ? harthmereMat(materials, building.floor)
        : materials.stoneBrick;
    }
  } else {
    const landingZ =
      stair.direction === "south" ? stair.z0 + stair.length : stair.z0 - 1;
    if (
      inRange(worldZ, landingZ - 1, landingZ + 1) &&
      inRange(worldX, stair.x0, stair.x0 + stair.width - 1) &&
      relY === storyHeight
    ) {
      return building.floor
        ? harthmereMat(materials, building.floor)
        : materials.stoneBrick;
    }
  }
  return undefined;
}

function harthmereBalconyBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  building: HarthmereBuilding,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const b = building.balcony;
  if (!b) return undefined;
  const bounds = harthmereBalconyBounds(building);
  if (
    !bounds ||
    !inRect(worldX, worldZ, bounds[0], bounds[1], bounds[2], bounds[3])
  )
    return undefined;
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  const storyHeight = harthmereStoryHeight(building);
  const deckY = (b.floor - 1) * storyHeight;
  const edge =
    worldX === bounds[0] ||
    worldX === bounds[1] ||
    worldZ === bounds[2] ||
    worldZ === bounds[3];

  if (relY === deckY)
    return harthmereMat(materials, b.material ?? building.floor);
  if (edge && relY === deckY + 1)
    return building.trim
      ? harthmereMat(materials, building.trim)
      : materials.stoneBrick;
  return undefined;
}

// HARTHMERE_SERVER_VOXEL_ROOM_PARTITIONS_START
// HARTHMERE_SERVER_VOXEL_ROOM_PARTITIONS_VERSION
// Adds interior rooms to the server-side voxel buildings. Furniture stays as
// runtime props, but rooms/walls/floors/ceilings remain real terrain.
const HARTHMERE_SERVER_VOXEL_ROOM_PARTITIONS_VERSION =
  "harthmere-server-voxel-room-partitions";

function harthmereBuildingNeedsRooms(building: HarthmereBuilding) {
  const floors = harthmereFloorCount(building);
  const label = (
    building.name +
    " " +
    building.district +
    " " +
    (building.profile ?? "")
  ).toLowerCase();
  return (
    floors >= 2 ||
    building.profile === "apartment" ||
    building.profile === "slum" ||
    building.profile === "house" ||
    /barracks|inn|hall|estate|cottage|shelter|stack|family|loft|bunkhouse|cabin|camp|hut|lodge|post|chapel|smithy|bakery|workshop|warehouse|apothecary/.test(
      label
    )
  );
}

function harthmereInteriorPartitionBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  building: HarthmereBuilding,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  if (!harthmereBuildingNeedsRooms(building)) return undefined;

  const relY = worldY - STARTER_TOWN_GROUND_Y;
  const floors = harthmereFloorCount(building);
  const storyHeight = harthmereStoryHeight(building);
  const inside = inRect(
    worldX,
    worldZ,
    building.x0 + 1,
    building.x1 - 1,
    building.z0 + 1,
    building.z1 - 1
  );
  if (!inside) return undefined;
  if (harthmereDoorLaneClearanceBlock(building, worldX, worldY, worldZ))
    return undefined;
  if (building.stairs && harthmereIsStairOrLanding(building, worldX, worldZ))
    return undefined;

  const midX = Math.floor((building.x0 + building.x1) / 2);
  const midZ = Math.floor((building.z0 + building.z1) / 2);
  const width = building.x1 - building.x0 + 1;
  const depth = building.z1 - building.z0 + 1;
  if (width < 12 || depth < 12) return undefined;

  for (let floor = 0; floor < floors; floor += 1) {
    const baseY = floor * storyHeight;
    if (relY < baseY + 1 || relY > baseY + Math.min(3, storyHeight - 1))
      continue;

    const verticalRoomWall = worldX === midX;
    const horizontalRoomWall = worldZ === midZ;
    const verticalDoorGap =
      verticalRoomWall && Math.abs(worldZ - midZ) <= 2 && relY <= baseY + 3;
    const horizontalDoorGap =
      horizontalRoomWall && Math.abs(worldX - midX) <= 2 && relY <= baseY + 3;
    const stairVoid =
      building.stairs &&
      Math.abs(worldX - building.stairs.x0) <= building.stairs.length + 2 &&
      Math.abs(worldZ - building.stairs.z0) <= building.stairs.width + 2;

    if (
      (verticalRoomWall && !verticalDoorGap && !stairVoid) ||
      (horizontalRoomWall && !horizontalDoorGap && !stairVoid)
    ) {
      return building.trim
        ? harthmereMat(materials, building.trim)
        : harthmereMat(materials, building.wall);
    }
  }

  return undefined;
}
// HARTHMERE_SERVER_VOXEL_ROOM_PARTITIONS_END

function harthmereBuildingBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  building: HarthmereBuilding,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  if (!harthmereWithinBuildingExpandedBounds(building, worldX, worldZ))
    return undefined;

  const relY = worldY - STARTER_TOWN_GROUND_Y;
  const floors = harthmereFloorCount(building);
  const storyHeight = harthmereStoryHeight(building);
  const inside = inRect(
    worldX,
    worldZ,
    building.x0,
    building.x1,
    building.z0,
    building.z1
  );
  const perimeter =
    inside &&
    (worldX === building.x0 ||
      worldX === building.x1 ||
      worldZ === building.z0 ||
      worldZ === building.z1);
  const corner =
    (worldX === building.x0 || worldX === building.x1) &&
    (worldZ === building.z0 || worldZ === building.z1);

  if (harthmereDoorLaneClearanceBlock(building, worldX, worldY, worldZ))
    return undefined;

  const balconyBlock = harthmereBalconyBlockAt(
    materials,
    building,
    worldX,
    worldY,
    worldZ
  );
  if (balconyBlock !== undefined) return balconyBlock;

  const roomPartitionBlock = harthmereInteriorPartitionBlockAt(
    materials,
    building,
    worldX,
    worldY,
    worldZ
  );
  if (roomPartitionBlock !== undefined) return roomPartitionBlock;

  // HARTHMERE_BUILDING_INTERIORS: structure-owned ceiling LEDs only. The
  // coarse voxel furniture from the first shell pass is retired; the audited
  // 57-building Blender/native-ECS manifest owns furniture and collision now.
  const furnitureBlock = harthmereBuildingInteriorBlockAt(
    building,
    worldX,
    relY,
    worldZ
  );
  if (furnitureBlock !== undefined) {
    return harthmereMat(materials, furnitureBlock);
  }

  if (building.chimney) {
    const [cx, cz] = building.chimney;
    const top = floors * storyHeight;
    if (worldX === cx && worldZ === cz && inRange(relY, top + 1, top + 4))
      return materials.stoneBrick;
    if (worldX === cx && worldZ === cz && relY === top + 5)
      return materials.coal;
  }

  const shellTopRelY = floors * storyHeight;
  const roofBlock = harthmereBuildingRoofBlockAt(
    building,
    worldX,
    relY,
    worldZ,
    shellTopRelY
  );
  if (roofBlock !== undefined) {
    return harthmereMat(materials, roofBlock);
  }

  for (let floor = 0; floor < floors; floor += 1) {
    const baseY = floor * storyHeight;
    const isTop = floor === floors - 1;

    if (building.stairs && floor < floors - 1) {
      const step = harthmereStairStepFor(building.stairs, worldX, worldZ);
      if (step !== undefined) {
        const stairY = baseY + 1 + Math.min(step, storyHeight - 1);
        if (relY === stairY) return harthmereMat(materials, building.floor);
      }
    }

    if (relY === baseY && inside)
      return harthmereMat(materials, building.floor);

    if (relY >= baseY + 1 && relY <= baseY + storyHeight - 1 && perimeter) {
      const groundDoor =
        floor === 0 && harthmereIsDoor(building, worldX, worldZ, relY);
      const balconyDoor = harthmereBalconyDoor(building, worldX, worldZ, relY);
      if (groundDoor || balconyDoor) return undefined;
      const window =
        relY === baseY + Math.min(3, storyHeight - 1) &&
        !corner &&
        (worldX + worldZ + floor) % 5 === 0;
      return window
        ? materials.simpleGlass
        : harthmereMat(
            materials,
            harthmereBuildingFacadeMaterialAt(
              building,
              worldX,
              relY,
              worldZ,
              storyHeight
            )
          );
    }

    if (relY === baseY + storyHeight) {
      const onSlab = inRect(
        worldX,
        worldZ,
        building.x0,
        building.x1,
        building.z0,
        building.z1
      );
      if (!onSlab) continue;
      if (
        !isTop &&
        building.stairs &&
        harthmereIsStairOrLanding(building, worldX, worldZ)
      )
        return undefined;
      // The top floor keeps a real ceiling, while the visible roof is the
      // stepped gable emitted above. This removes the flat colored-wool slabs
      // without opening buildings to rain or leaving floating upper floors.
      return harthmereMat(materials, building.floor);
    }
  }

  return undefined;
}

// HARTHMERE_SERVER_VOXEL_WILDS_STRUCTURES_TREES_START
// HARTHMERE_SERVER_VOXEL_WILDS_STRUCTURES_TREES_VERSION
// Server-side replacements for remaining large wilds structures. The 5,000
// backend voxel tree field is present but env-gated because the earlier wilds
// seed was already a performance risk; turn it on only for profiling/screenshot
// passes with BIOMES_LOCAL_DEV_BACKEND_VOXEL_TREES=1.
const HARTHMERE_SERVER_VOXEL_WILDS_STRUCTURES_TREES_VERSION =
  "harthmere-server-voxel-wilds-structures-trees";
const HARTHMERE_BACKEND_VOXEL_TREE_TARGET = 5000;
const HARTHMERE_BACKEND_VOXEL_TREES_ENABLED =
  process.env.BIOMES_LOCAL_DEV_BACKEND_VOXEL_TREES === "1";

function harthmereHash2(x: number, z: number) {
  let h =
    Math.imul(x ^ 0x9e3779b9, 0x85ebca6b) ^
    Math.imul(z ^ 0xc2b2ae35, 0x27d4eb2d);
  h ^= h >>> 15;
  return h >>> 0;
}

function harthmereVoxelTreeBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  if (!HARTHMERE_BACKEND_VOXEL_TREES_ENABLED) return undefined;
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  if (relY < 1 || relY > 8) return undefined;
  if (worldX < 96 || worldX > 760 || worldZ < -724 || worldZ > -320)
    return undefined;
  if (worldX > 330 && worldX < 640 && worldZ > -370 && worldZ < -88)
    return undefined;

  const cell = 6;
  const cx = Math.floor(worldX / cell);
  const cz = Math.floor(worldZ / cell);
  const h = harthmereHash2(cx, cz);
  if (h % 100 >= 70) return undefined;
  const anchorX = cx * cell + 2 + (h % 3);
  const anchorZ = cz * cell + 2 + ((h >>> 8) % 3);
  const dx = Math.abs(worldX - anchorX);
  const dz = Math.abs(worldZ - anchorZ);

  if (dx === 0 && dz === 0 && relY >= 1 && relY <= 4) return materials.oakLog;
  const leafRadius = relY <= 5 ? 2 : relY <= 7 ? 1 : 0;
  if (
    relY >= 4 &&
    relY <= 8 &&
    dx + dz <= leafRadius + 1 &&
    Math.max(dx, dz) <= leafRadius + 1
  ) {
    return (h + relY) % 5 === 0 ? materials.greenWool : materials.oakLeaf;
  }
  return undefined;
}

function harthmereWildsServerStructureBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;

  // Thornbridge Crossing: real terrain bridge deck/parapets replacing obj_bridge_low_body.
  if (inRect(worldX, worldZ, 324, 352, -504, -492)) {
    if (relY === 0) return materials.stonePolished;
    const edge =
      worldZ === -504 || worldZ === -492 || worldX === 324 || worldX === 352;
    if (edge && inRange(relY, 1, 2))
      return relY === 2 ? materials.moss : materials.stoneBrick;
  }

  // Last Watch low wall, now server-side instead of obj_wall_simple.
  if (inRect(worldX, worldZ, 468, 492, -340, -322)) {
    const edge =
      worldX === 468 || worldX === 492 || worldZ === -340 || worldZ === -322;
    const gate = worldZ === -322 && inRange(worldX, 478, 482);
    if (edge && !gate && inRange(relY, 1, 3)) return materials.stoneBrick;
  }

  // Watermill wheel and race marker, built from server blocks rather than arch_watermill/arch_wheel.
  const wheelD = Math.hypot(worldX - 374, worldZ + 404);
  if (wheelD >= 3.2 && wheelD <= 4.4 && inRange(relY, 1, 6))
    return materials.oakLog;
  // HARTHMERE_STILL_WATER: the mill race. Was a wool patch half-buried under
  // the mill building; now a real channel alongside its west wall.

  // Orchard windmill cross arms, terrain replacement for arch_windmill.
  if (worldZ === 171 && inRange(worldX, 150, 174) && relY === 13)
    return materials.oakLog;
  if (worldX === 162 && inRange(worldZ, 159, 183) && relY === 13)
    return materials.oakLog;
  if (worldX === 162 && worldZ === 171 && inRange(relY, 10, 15))
    return materials.oakLog;

  // Gravewood fence: server-side cemetery perimeter instead of obj_church_grave_fence.
  if (inRect(worldX, worldZ, 752, 808, 206, 262)) {
    const edge =
      worldX === 752 || worldX === 808 || worldZ === 206 || worldZ === 262;
    const gate = worldZ === 206 && inRange(worldX, 776, 784);
    if (edge && !gate && inRange(relY, 1, 2))
      return relY === 2 ? materials.blackWool : materials.stoneBrick;
  }

  return harthmereVoxelTreeBlockAt(materials, worldX, worldY, worldZ);
}
// HARTHMERE_SERVER_VOXEL_WILDS_STRUCTURES_TREES_END

function harthmerePriorityStructureBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;

  const v65WildsServerBlock = harthmereWildsServerStructureBlockAt(
    materials,
    worldX,
    worldY,
    worldZ
  );
  if (v65WildsServerBlock !== undefined) return v65WildsServerBlock;

  // Large, obvious north-gate crossbar. It is before the street clear pass so
  // relY 7 survives while the walk-through gate lane stays empty below it.
  if (worldZ === -282 && inRange(worldX, 476, 498) && relY === 7)
    return materials.stoneBrick;
  if (
    (worldX === 476 || worldX === 498) &&
    inRange(worldZ, -286, -278) &&
    inRange(relY, 1, 8)
  )
    return materials.stoneBrick;
  if (worldZ === -286 && inRange(worldX, 472, 502) && relY === 8)
    return materials.stoneShingles;

  // Real walkable bridge with parapets; the center remains open.
  if (inRect(worldX, worldZ, 586, 612, -212, -200)) {
    if (relY === 0) return materials.stonePolished;
    const parapet =
      worldZ === -212 || worldZ === -200 || worldX === 586 || worldX === 612;
    if (parapet && inRange(relY, 1, 2))
      return relY === 2 ? materials.stoneShingles : materials.stoneBrick;
  }

  return undefined;
}

function harthmereWallAndGateBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  const x0 = 392;
  const x1 = 590;
  const z0 = -282;
  const z1 = -112;
  const onWall =
    (worldX === x0 || worldX === x1 || worldZ === z0 || worldZ === z1) &&
    inRect(worldX, worldZ, x0, x1, z0, z1);
  const northGateGap = worldZ === z0 && inRange(worldX, 477, 497);
  const bridgeGateGap = worldX === x1 && inRange(worldZ, -212, -198);
  const westGateGap = worldX === x0 && inRange(worldZ, -217, -201);
  const southGateGap = worldZ === z1 && inRange(worldX, 476, 496);

  if (
    onWall &&
    !northGateGap &&
    !bridgeGateGap &&
    !westGateGap &&
    !southGateGap &&
    inRange(relY, 1, 7)
  ) {
    return relY === 7 ? materials.stoneShingles : materials.stoneBrick;
  }

  // Watchtowers facing the wilds and bridge. They are terrain, not silhouettes.
  const towers = [
    [462, 476, -290, -276],
    [498, 512, -290, -276],
    [584, 596, -220, -208],
    [584, 596, -194, -182],
    [386, 398, -220, -206],
    [386, 398, -126, -112],
    [584, 596, -126, -112],
  ] as const;
  for (const [tx0, tx1, tz0, tz1] of towers) {
    const inside = inRect(worldX, worldZ, tx0, tx1, tz0, tz1);
    const edge =
      inside &&
      (worldX === tx0 || worldX === tx1 || worldZ === tz0 || worldZ === tz1);
    if (inside && relY === 0) return materials.stonePolished;
    if (edge && inRange(relY, 1, 11))
      return relY % 5 === 0 ? materials.stonePolished : materials.stoneBrick;
    if (inside && relY === 12) return materials.stoneShingles;
  }

  return undefined;
}

function harthmereFenceBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  if (relY !== 1 && relY !== 2) return undefined;

  if (inRect(worldX, worldZ, 430, 466, -250, -220)) {
    const edge =
      worldX === 430 || worldX === 466 || worldZ === -250 || worldZ === -220;
    const gate = inRange(worldX, 444, 450) && worldZ === -220;
    if (edge && !gate) return materials.oakLog;
  }
  if (inRect(worldX, worldZ, 500, 548, -278, -256)) {
    const edge =
      worldX === 500 || worldX === 548 || worldZ === -278 || worldZ === -256;
    const gate = inRange(worldX, 510, 514) && worldZ === -256;
    if (edge && !gate) return materials.oakLog;
  }
  if (inRect(worldX, worldZ, 546, 624, -280, -246)) {
    const edge = worldX === 546 || worldX === 624 || worldZ === -280;
    const gate = inRange(worldX, 560, 572) && worldZ === -246;
    if (edge && !gate) return materials.oakLog;
  }
  if (
    (worldX === 396 && inRange(worldZ, -172, -130)) ||
    (worldZ === -130 && inRange(worldX, 396, 418))
  )
    return materials.oakLog;

  // Underways grate near Mudden Ward. It marks a dungeon entrance without trapping players.
  if (worldX === 402 && inRange(worldZ, -238, -234))
    return relY === 1 ? materials.blackWool : materials.coal;

  return undefined;
}

function harthmereLandmarkBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;

  // HARTHMERE_CONNECTED_ROAD_BLOCK_CUES_VERSION:
  // Block-built replacements for the removed GLB signs/lamps/banners on the
  // snapshot-edge road. These are terrain blocks, so they cannot float, 404, or
  // drift apart from the shifted town.
  const roadPosts = [
    [128, -205, "yellowWool"],
    [184, -215, "whiteWool"],
    [280, -205, "yellowWool"],
    [392, -206, "redWool"],
  ] as const;
  for (const [px, pz, cap] of roadPosts) {
    if (worldX === px && worldZ === pz && inRange(relY, 1, 3))
      return materials.oakLog;
    if (Math.abs(worldX - px) <= 1 && worldZ === pz && relY === 4) {
      return harthmereMat(materials, cap);
    }
  }
  const roadBannerPosts = [168, 224, 336] as const;
  for (const px of roadBannerPosts) {
    if (worldX === px && worldZ === -214 && inRange(relY, 1, 4))
      return materials.oakLog;
    if (Math.abs(worldX - px) <= 1 && worldZ === -214 && relY === 5)
      return materials.redWool;
    if (Math.abs(worldX - px) <= 1 && worldZ === -213 && relY === 5)
      return materials.blackWool;
  }

  const wellD = Math.hypot(worldX - 400, worldZ + 235);
  if (wellD <= 4.25 && inRange(relY, 1, 3)) {
    if (relY === 1)
      return wellD <= 1.75 ? materials.blackWool : materials.stoneBrick;
    if (wellD >= 2.6 && wellD <= 4.25) return materials.stoneBrick;
  }

  // HARTHMERE_STILL_WATER: the Market Plaza fountain and the farmyard trough.
  //
  // The fountain used to be a wool disc (`materials.water` resolving to
  // blue_wool) with a floating wool column on top; the trough was a bare 5x5
  // wool patch on the grass. Both are now real masonry — basin wall, plinth,
  // bowl rim, trough walls — with the water itself written into shard_water by
  // the same module. Nothing floats and every basin is proven watertight in
  // `harthmere_still_water.test.ts`.
  const stillWaterBlock = harthmereStillWaterBlockAt(worldX, relY, worldZ);
  if (stillWaterBlock) {
    return harthmereMat(materials, stillWaterBlock);
  }

  const serviceSigns = [
    [502, -212, "yellowWool"],
    [446, -204, "yellowWool"],
    [520, -214, "greenWool"],
    [544, -218, "blackWool"],
    [486, -154, "whiteWool"],
    [584, -198, "blueWool"],
    [404, -176, "blackWool"],
    [510, -256, "redWool"],
    [566, -246, "greenWool"],
    [485, -282, "redWool"],
    [402, -235, "blackWool"],
  ] as const;
  for (const [sx, sz, mat] of serviceSigns) {
    if (worldX === sx && worldZ === sz && inRange(relY, 1, 2))
      return materials.oakLog;
    if (Math.abs(worldX - sx) <= 1 && worldZ === sz && relY === 3)
      return harthmereMat(materials, mat as HarthmereMat);
  }

  const dockDecks =
    inRect(worldX, worldZ, 590, 608, -192, -184) ||
    inRect(worldX, worldZ, 590, 608, -180, -172) ||
    inRect(worldX, worldZ, 590, 608, -168, -160) ||
    inRect(worldX, worldZ, 590, 608, -156, -150);
  if (dockDecks && relY === 0) return materials.oakLumber;
  const dockPost =
    (worldX === 590 || worldX === 608) &&
    [-192, -184, -180, -172, -168, -160, -156, -150].includes(worldZ);
  if (dockPost && inRange(relY, 1, 3)) return materials.oakLog;

  const graveStones = [
    [506, -145],
    [516, -139],
    [528, -147],
    [512, -132],
    [524, -134],
  ] as const;
  for (const [gx, gz] of graveStones) {
    if (worldX === gx && worldZ === gz && inRange(relY, 1, 2))
      return materials.stoneBrick;
    if (relY === 3 && worldZ === gz && Math.abs(worldX - gx) <= 1)
      return materials.stoneBrick;
  }

  if (inRect(worldX, worldZ, 435, 443, -224, -222) && inRange(relY, 1, 2))
    return materials.hay;
  // HARTHMERE_STILL_WATER: the farmyard trough beside the hayrack. Was a bare
  // 5x5 wool patch on the grass; now a walled trough with real water.
  if (worldX === 444 && worldZ === -242 && inRange(relY, 1, 5))
    return relY === 5 ? materials.yellowWool : materials.oakLog;
  if (inRange(worldX, 442, 446) && worldZ === -242 && relY === 4)
    return materials.hay;

  return undefined;
}

function harthmereFullTownBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const priorityBlock = harthmerePriorityStructureBlockAt(
    materials,
    worldX,
    worldY,
    worldZ
  );
  if (priorityBlock !== undefined) return priorityBlock;

  const dungeonBlock = harthmereDungeonBlockAt(
    materials,
    worldX,
    worldY,
    worldZ
  );
  if (dungeonBlock !== undefined) return dungeonBlock;

  if (harthmereShouldForceClearRoofStreetAirBlock(worldX, worldY, worldZ))
    return undefined;

  for (const building of HARTHMERE_BUILDINGS) {
    const block = harthmereBuildingBlockAt(
      materials,
      building,
      worldX,
      worldY,
      worldZ
    );
    if (block !== undefined) return block;
  }

  return (
    harthmereWallAndGateBlockAt(materials, worldX, worldY, worldZ) ??
    harthmereFenceBlockAt(materials, worldX, worldY, worldZ) ??
    harthmereLandmarkBlockAt(materials, worldX, worldY, worldZ) ??
    harthmereTownStreetBlockAt(materials, worldX, worldY, worldZ)
  );
}

// HARTHMERE_TOWN_STREETS: pave the ground surface of the derived street
// network. Checked LAST in the chain, so a wall, a fence, a landmark or a
// building always wins the column — the network is computed to miss every
// footprint, but a lower-priority surface pass cannot break anything even if a
// future building is authored on top of a lane.
//
// relY 0 is the ground plane itself. Streets replace the grass there rather
// than sitting one voxel proud of it, so a player walks along a road instead of
// stepping up onto a kerb every few metres.
function harthmereTownStreetBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  void HARTHMERE_TOWN_STREETS_VERSION;
  if (worldY - STARTER_TOWN_GROUND_Y !== 0) {
    return undefined;
  }
  const surface = harthmereTownStreetSurfaceAt(worldX, worldZ);
  return surface ? harthmereMat(materials, surface) : undefined;
}

// HARTHMERE_CLEAN_TOWN_REBUILD_END

function distanceToSegment2D(
  worldX: number,
  worldZ: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
) {
  const abX = bx - ax;
  const abZ = bz - az;
  const apX = worldX - ax;
  const apZ = worldZ - az;
  const abLen2 = abX * abX + abZ * abZ;
  const t =
    abLen2 === 0
      ? 0
      : Math.max(0, Math.min(1, (apX * abX + apZ * abZ) / abLen2));
  const cx = ax + abX * t;
  const cz = az + abZ * t;
  return Math.hypot(worldX - cx, worldZ - cz);
}

function localDevWildsHash(worldX: number, worldZ: number, salt = 0) {
  const raw =
    Math.sin(worldX * 12.9898 + worldZ * 78.233 + salt * 37.719) * 43758.5453;
  return Math.abs(Math.floor(raw));
}

function isHarthmereWideWildsRoad(worldX: number, worldZ: number, width = 4) {
  const roads = [
    // HARTHMERE_CONNECTED_MAP_ROAD: road from the snapshot edge into Harthmere's west approach.
    [
      HARTHMERE_SNAPSHOT_EDGE_ROAD_AUTHORED_START_X,
      HARTHMERE_SNAPSHOT_EDGE_ROAD_AUTHORED_Z,
      HARTHMERE_WEST_GATE_AUTHORED_X,
      HARTHMERE_SNAPSHOT_EDGE_ROAD_AUTHORED_Z,
    ],
    // North road out of the gate and into Greenmere.
    [486, -286, 486, STARTER_TOWN_WILDS_Z0 + 36],
    // South road through the new south gate into orchards and gravewood edge.
    [486, -112, 486, STARTER_TOWN_WILDS_Z1 - 36],
    // West trade road from market/west gate to Mill Road and Hunter's Track.
    [392, -209, STARTER_TOWN_WILDS_X0 + 36, -209],
    // East river road across the bridge into Briarfen.
    [590, -205, STARTER_TOWN_WILDS_X1 - 36, -205],
    // North-west hunter path.
    [430, -286, STARTER_TOWN_WILDS_X0 + 80, STARTER_TOWN_WILDS_Z0 + 110],
    // North-east wetland trail.
    [590, -250, STARTER_TOWN_WILDS_X1 - 110, STARTER_TOWN_WILDS_Z0 + 120],
    // South-west orchard lane.
    [430, -112, STARTER_TOWN_WILDS_X0 + 120, STARTER_TOWN_WILDS_Z1 - 120],
    // South-east gravewood lane.
    [560, -112, STARTER_TOWN_WILDS_X1 - 130, STARTER_TOWN_WILDS_Z1 - 130],
  ] as const;

  return roads.some(
    ([ax, az, bx, bz]) =>
      distanceToSegment2D(worldX, worldZ, ax, az, bx, bz) <= width
  );
}

function isInsideAuthoredHarthmereTown(
  worldX: number,
  worldZ: number,
  pad = 0
) {
  return inRect(worldX, worldZ, 392, 590, -282, -112, pad);
}

function isHarthmereSnapshotMuckPatch(worldX: number, worldZ: number) {
  return isAuthoredPointInSnapshotMuckZone(
    [worldX, STARTER_TOWN_GROUND_Y + 1, worldZ],
    0
  );
}

function harthmereWideWildsSurfaceMaterial(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldZ: number,
  allowMuckwad = true
): TerrainID | undefined {
  const hash = localDevWildsHash(worldX, worldZ, 13);

  // SNAPSHOT_MUCK_TERRAIN_SURFACE: source-visible muck/muckwad
  // tutorial areas are authored once in snapshot_runtime_rules and painted
  // as real terrain, not GLB decoration.
  if (allowMuckwad && isHarthmereSnapshotMuckPatch(worldX, worldZ)) {
    return materials.muckwad;
  }

  if (isHarthmereWideWildsRoad(worldX, worldZ, 3)) {
    return materials.gravel;
  }
  if (isHarthmereWideWildsRoad(worldX, worldZ, 7)) {
    return hash % 3 === 0 ? materials.dirt : materials.grass;
  }

  // HARTHMERE_CONNECTED_MAP_ROAD_SURFACE:
  // The snapshot-edge road should read like the Wilds bible: packed dirt,
  // pale gravel, wagon ruts, grass shoulders, and signs of civilization before
  // the player reaches the safer town gate. The hard road lane is handled by
  // isHarthmereWideWildsRoad(); this paints the readable shoulder.
  if (
    distanceToSegment2D(
      worldX,
      worldZ,
      HARTHMERE_SNAPSHOT_EDGE_ROAD_AUTHORED_START_X,
      HARTHMERE_SNAPSHOT_EDGE_ROAD_AUTHORED_Z,
      HARTHMERE_WEST_GATE_AUTHORED_X,
      HARTHMERE_SNAPSHOT_EDGE_ROAD_AUTHORED_Z
    ) <= 16
  ) {
    if (hash % 11 === 0) return materials.hay;
    if (hash % 5 === 0) return materials.dirt;
    return materials.grass;
  }

  // Do not repaint the authored town core. The town renderer owns that space.
  if (isInsideAuthoredHarthmereTown(worldX, worldZ, 10)) {
    return undefined;
  }

  // HARTHMERE_WILDS_FOREST_TRUNK_SOIL
  //
  // Gaia's tree_growth decays any log whose same-species chain cannot reach
  // dirt, grass or moss directly beneath it. The wilds palette scatters hay,
  // soil, sand, stone and coal through these fields, so a trunk that happened
  // to land on one of those would take its whole tree down with it two minutes
  // after the world loaded. One voxel of grass under each trunk is the entire
  // fix. It changes no heights — the terrain stays flat.
  if (harthmereWildsForestAllowed(worldX, worldZ)) {
    const trunk = harthmereWildsForestBlockAt(worldX, 1, worldZ);
    if (trunk === "oakLog" || trunk === "birchLog" || trunk === "rubberLog") {
      return materials.grass;
    }
  }

  // Gate Fields around all road exits: owned farms, grazing, and soft starter wilderness.
  const nearNorthGate = inRect(worldX, worldZ, 300, 680, -470, -286);
  const nearSouthGate = inRect(worldX, worldZ, 300, 680, -108, 210);
  const nearWestGate = inRect(worldX, worldZ, 80, 392, -300, -110);
  if (nearNorthGate || nearSouthGate || nearWestGate) {
    if (hash % 11 === 0) {
      return materials.soil;
    }
    if (hash % 7 === 0) {
      return materials.hay;
    }
    return materials.grass;
  }

  // HARTHMERE_RIVER: the Briarfen wetland the Brell runs through.
  //
  // This used to scatter `materials.water` at 1-in-17 across the whole
  // rectangle. There is no water *block* in Biomes — water is the separate
  // `ShardWater` field — so `terrainId("water", ...)` fell through to its
  // blue_wool fallback and speckled the wetland with wool. The real river is
  // now carved and filled by `harthmere_river.ts`; what is left here is the
  // damp ground around it.
  if (worldX > 630 && worldZ > -360 && worldZ < 180) {
    if (hash % 5 === 0) {
      return materials.moss;
    }
    if (hash % 7 === 0) {
      return materials.sand;
    }
    return materials.grass;
  }

  // Ruined Watchtower Ridge and quarry stone to the north-west.
  if (worldX < 350 && worldZ < -350) {
    if (hash % 5 === 0) {
      return materials.stone;
    }
    if (hash % 11 === 0) {
      return materials.coal;
    }
    return materials.grass;
  }

  // Gravewood to the south/south-east: colder ground, moss, old paths.
  if (worldZ > -80 && worldX > 420) {
    if (hash % 6 === 0) {
      return materials.moss;
    }
    if (hash % 19 === 0) {
      return materials.stoneBrick;
    }
    return materials.grass;
  }

  // Deep forest everywhere else.
  if (hash % 8 === 0) {
    return materials.moss;
  }
  if (hash % 37 === 0) {
    return materials.dandelion;
  }
  return materials.grass;
}

// HARTHMERE_WILDS_FOREST_GATE
//
// One predicate owns every place the forest must keep out of. Coordinates here
// are AUTHORED (the seeder converts before calling), so the single upper bound
// on X covers both the back-country backdrop and the Elsewhen dungeon band,
// which both live east of the town's back boundary.
function harthmereWildsForestAllowed(authoredX: number, authoredZ: number) {
  if (isInsideAuthoredHarthmereTown(authoredX, authoredZ, 22)) return false;
  // HARTHMERE_BUILDING_EXCLUSION: a building only writes its SOLID voxels, so
  // the room it encloses comes back to this generator as open air and used to
  // grow a tree in it. The town rectangle above hid that for the 34 buildings
  // inside it; the 23 outside — every Residential row house and every Wilds
  // structure — were full of trunks, leaf blocks and wild grass. Derived from
  // the building table, so a new building is excluded without touching this.
  if (isHarthmereBuildingVegetationExclusion(authoredX, authoredZ))
    return false;
  // HARTHMERE_RIVER: nothing grows in the channel or close enough to lean over
  // it. A trunk in the water has no soil beneath it and Gaia's tree_growth
  // would decay the whole tree two minutes after load; a canopy overhanging the
  // water would raise skyOcclusion above the fishing `inOpen` threshold and
  // silently make the river's fish unrollable.
  if (harthmereRiverExcludesVegetation(authoredX, authoredZ)) return false;
  // Same reasoning for the mill race, the fountain and the trough: a trunk in
  // the water has no soil under it, and undergrowth inside a basin looks like
  // a bug.
  if (harthmereStillWaterContains(authoredX, authoredZ)) return false;
  // Roads keep a nine-voxel margin. This is the rule the old (dead)
  // isWideWildsTreeCenter used, and it is why a forest this dense still leaves
  // every route across the map open.
  if (isHarthmereWideWildsRoad(authoredX, authoredZ, 9)) return false;
  if (isHarthmereSnapshotMuckPatch(authoredX, authoredZ)) return false;
  // Nothing grows in the back country or the Elsewhen band; those layers own
  // their own ground and a tree here would poke through the boundary wall.
  if (authoredX > HARTHMERE_TOWN_BACK_BOUNDARY_X) return false;
  return true;
}

function isWideWildsTreeCenter(worldX: number, worldZ: number) {
  if (isInsideAuthoredHarthmereTown(worldX, worldZ, 22)) {
    return false;
  }
  if (isHarthmereWideWildsRoad(worldX, worldZ, 9)) {
    return false;
  }
  // Sparse block trees only. Dense visual forest lives in the runtime asset
  // renderer so collision remains playable and roads stay open.
  return localDevWildsHash(worldX, worldZ, 31) % 541 === 0;
}

type HarthmereHarvestableTreeKind =
  "oak" | "orchard" | "dead" | "pine" | "birch" | "willow";
type HarthmereHarvestableForageKind =
  | "mushroom"
  | "berry"
  | "herb"
  | "reed"
  | "clay"
  | "flax"
  | "root"
  | "flower"
  | "grave_moss"
  | "wild_garlic"
  | "honey";
type HarthmereHarvestableOreKind =
  "stone" | "coal" | "copper" | "iron" | "silver" | "gold";

// These are actual voxel/block resources, not GLB decoration. The dense forest
// renderer makes the Wilds look alive, but the player can only harvest blocks
// that exist in terrain shards. Keep these away from roads/town so harvesting
// does not tear holes in buildings or create collision traps.
const HARTHMERE_HARVESTABLE_TREE_CENTERS = [
  // North / Greenmere: true timber groves beyond the gate road.
  [438, -366, "oak"],
  [470, -394, "birch"],
  [506, -382, "oak"],
  [524, -414, "oak"],
  [486, -448, "birch"],
  [552, -472, "pine"],
  [460, -520, "oak"],
  [580, -556, "pine"],
  [430, -610, "oak"],
  [508, -628, "birch"],
  [625, -662, "pine"],
  [700, -712, "pine"],
  [352, -706, "oak"],
  [602, -768, "pine"],
  [788, -824, "pine"],
  // West Old Wood and hunter track: dense, older, varied logging resources.
  [318, -300, "oak"],
  [250, -350, "birch"],
  [180, -260, "oak"],
  [112, -182, "oak"],
  [38, -104, "birch"],
  [-82, 28, "oak"],
  [-154, 166, "pine"],
  [208, 84, "oak"],
  [-178, -420, "pine"],
  [-90, -560, "oak"],
  [54, -660, "pine"],
  [210, -742, "birch"],
  [-188, -764, "pine"],
  [-188, 338, "oak"],
  [90, 394, "birch"],
  // South / orchard woods: apples near farms, then normal forest beyond.
  [370, -66, "orchard"],
  [408, -22, "orchard"],
  [432, 14, "orchard"],
  [512, 96, "oak"],
  [602, 178, "oak"],
  [682, 320, "dead"],
  [792, 382, "dead"],
  [382, 256, "oak"],
  [486, 336, "birch"],
  [588, 430, "oak"],
  [710, 452, "dead"],
  [926, 414, "dead"],
  // East Briarfen / wet forest: willow-like wetland timber and reeds around it.
  [700, -318, "willow"],
  [772, -412, "willow"],
  [872, -332, "oak"],
  [968, -244, "willow"],
  [1048, -128, "oak"],
  [1136, 34, "willow"],
  [1180, -620, "pine"],
  [1168, -462, "willow"],
  [1200, -196, "willow"],
  [1120, 210, "dead"],
  [1172, 420, "dead"],
  // Edge samples in every direction so long walks always find real trees.
  [-198, -620, "oak"],
  [-210, -890, "pine"],
  [96, -900, "pine"],
  [420, -902, "pine"],
  [934, -910, "pine"],
  [1180, -820, "pine"],
  [-180, 430, "oak"],
  [256, 468, "birch"],
] as const satisfies ReadonlyArray<
  readonly [number, number, HarthmereHarvestableTreeKind]
>;

const HARTHMERE_HARVESTABLE_ORE_CENTERS = [
  // Watchtower ridge / quarry and bandit mine cuts.
  [292, -476, "stone"],
  [244, -532, "coal"],
  [178, -604, "iron"],
  [212, -566, "copper"],
  [112, -696, "silver"],
  [326, -720, "coal"],
  [220, -820, "iron"],
  [64, -842, "coal"],
  [-116, -792, "silver"],
  // West old rocky cuts.
  [90, -338, "stone"],
  [-18, -258, "coal"],
  [-126, -146, "stone"],
  [-190, 92, "silver"],
  [-222, -432, "iron"],
  [-154, -494, "copper"],
  [-190, -610, "coal"],
  [-90, 332, "stone"],
  [132, 442, "coal"],
  // East Briarfen exposed stones and wet river cuts.
  [724, -396, "stone"],
  [836, -468, "coal"],
  [946, -364, "iron"],
  [884, -420, "copper"],
  [1088, -236, "silver"],
  [1122, -518, "coal"],
  [1190, -318, "iron"],
  [1024, 12, "stone"],
  [1168, 240, "silver"],
  // South / Gravewood relic stones.
  [604, 118, "stone"],
  [710, 242, "coal"],
  [822, 344, "gold"],
  [1018, 388, "silver"],
  [496, 394, "iron"],
  [548, 326, "copper"],
  [340, 372, "stone"],
  [940, 118, "coal"],
  [1098, 420, "gold"],
  // Far north samples so the extended woods stay useful.
  [420, -870, "iron"],
  [612, -878, "coal"],
  [790, -848, "silver"],
  [980, -824, "gold"],
] as const satisfies ReadonlyArray<
  readonly [number, number, HarthmereHarvestableOreKind]
>;

const HARTHMERE_HARVESTABLE_FORAGE_CENTERS = [
  // Herbs, berries, mushrooms, flax, reeds, clay, and roots. These are small
  // voxel/block resources so harvesting has real gameplay, not just GLB scenery.
  [430, -350, "flax"],
  [450, -372, "herb"],
  [468, -398, "berry"],
  [394, -378, "honey"],
  [520, -398, "mushroom"],
  [546, -430, "berry"],
  [566, -462, "herb"],
  [586, -508, "root"],
  [420, -560, "mushroom"],
  [638, -620, "herb"],
  [720, -690, "berry"],
  [802, -760, "mushroom"],
  [250, -360, "wild_garlic"],
  [170, -280, "root"],
  [42, -138, "mushroom"],
  [-122, 24, "berry"],
  [-186, 188, "herb"],
  [-194, -620, "mushroom"],
  [88, -710, "root"],
  [240, -780, "berry"],
  [382, -54, "flower"],
  [420, 22, "berry"],
  [462, 74, "herb"],
  [536, 126, "mushroom"],
  [642, 220, "grave_moss"],
  [736, 314, "grave_moss"],
  [828, 386, "grave_moss"],
  [948, 444, "mushroom"],
  [650, -260, "reed"],
  [704, -320, "clay"],
  [780, -378, "reed"],
  [864, -286, "clay"],
  [930, -192, "reed"],
  [1016, -82, "reed"],
  [1110, 48, "clay"],
  [1184, 188, "reed"],
  [490, -840, "mushroom"],
  [620, -890, "berry"],
  [900, -860, "herb"],
  [1100, -720, "root"],
  [-170, -870, "mushroom"],
  [-210, 410, "herb"],
  [160, 460, "flower"],
  [1180, 420, "grave_moss"],
] as const satisfies ReadonlyArray<
  readonly [number, number, HarthmereHarvestableForageKind]
>;

function harthmereResourceKey(x: number, z: number) {
  return `${x},${z}`;
}

const HARTHMERE_HARVESTABLE_TREE_CENTER_BY_COORD = new Map<
  string,
  HarthmereHarvestableTreeKind
>(
  HARTHMERE_HARVESTABLE_TREE_CENTERS.map(([x, z, kind]) => [
    harthmereResourceKey(x, z),
    kind,
  ])
);

const HARTHMERE_HARVESTABLE_ORE_CENTER_BY_COORD = new Map<
  string,
  HarthmereHarvestableOreKind
>(
  HARTHMERE_HARVESTABLE_ORE_CENTERS.map(([x, z, kind]) => [
    harthmereResourceKey(x, z),
    kind,
  ])
);

const HARTHMERE_HARVESTABLE_FORAGE_CENTER_BY_COORD = new Map<
  string,
  HarthmereHarvestableForageKind
>(
  HARTHMERE_HARVESTABLE_FORAGE_CENTERS.map(([x, z, kind]) => [
    harthmereResourceKey(x, z),
    kind,
  ])
);

type HarthmereFastHarvestableMaterialName = keyof ReturnType<
  typeof localDevMaterials
>;

function harthmereFastBlockKey(x: number, y: number, z: number) {
  return `${x},${y},${z}`;
}

function setHarthmereFastBlock(
  blocks: Map<string, HarthmereFastHarvestableMaterialName>,
  x: number,
  relY: number,
  z: number,
  materialName: HarthmereFastHarvestableMaterialName
) {
  if (!isHarthmereLocalDevTerrainShardEnabledForWorld(x, z)) {
    return;
  }
  if (
    isInsideAuthoredHarthmereTown(x, z, 18) ||
    isHarthmereWideWildsRoad(x, z, 5)
  ) {
    return;
  }

  const y = STARTER_TOWN_GROUND_Y + relY;
  const key = harthmereFastBlockKey(x, y, z);
  if (!blocks.has(key)) {
    blocks.set(key, materialName);
  }
}

function buildHarthmereFastHarvestableBlockMap() {
  const blocks = new Map<string, HarthmereFastHarvestableMaterialName>();

  for (const [cx, cz, kind] of HARTHMERE_HARVESTABLE_TREE_CENTERS) {
    if (
      isInsideAuthoredHarthmereTown(cx, cz, 18) ||
      isHarthmereWideWildsRoad(cx, cz, 8)
    ) {
      continue;
    }

    const trunkHeight =
      kind === "orchard"
        ? 4
        : kind === "dead"
          ? 5
          : kind === "pine"
            ? 8
            : kind === "birch"
              ? 7
              : kind === "willow"
                ? 6
                : 6;

    for (let relY = 1; relY <= trunkHeight; relY += 1) {
      setHarthmereFastBlock(
        blocks,
        cx,
        relY,
        cz,
        kind === "birch" && relY % 2 === 0 ? "whiteWool" : "oakLog"
      );
    }

    if (kind !== "dead") {
      const branchY = trunkHeight - 1;
      for (let offset = -2; offset <= 2; offset += 1) {
        setHarthmereFastBlock(blocks, cx + offset, branchY, cz, "oakLog");
        setHarthmereFastBlock(blocks, cx, branchY, cz + offset, "oakLog");
      }
    } else {
      for (let offset = -2; offset <= 2; offset += 1) {
        setHarthmereFastBlock(blocks, cx + offset, trunkHeight, cz, "oakLog");
        setHarthmereFastBlock(blocks, cx, trunkHeight, cz + offset, "oakLog");
      }
      continue;
    }

    if (kind === "pine") {
      const canopyBottom = trunkHeight - 3;
      const canopyTop = trunkHeight + 3;
      for (let relY = canopyBottom; relY <= canopyTop; relY += 1) {
        const taper = Math.max(1, 5 - Math.max(0, relY - canopyBottom));
        for (let dx = -taper; dx <= taper; dx += 1) {
          for (let dz = -taper; dz <= taper; dz += 1) {
            if (Math.abs(dx) + Math.abs(dz) <= taper) {
              setHarthmereFastBlock(blocks, cx + dx, relY, cz + dz, "oakLeaf");
            }
          }
        }
      }
      continue;
    }

    const leafCenterY = kind === "willow" ? trunkHeight : trunkHeight + 1;
    const leafRadius = kind === "orchard" ? 3 : kind === "willow" ? 5 : 4;
    for (let relY = trunkHeight - 2; relY <= trunkHeight + 3; relY += 1) {
      const verticalPenalty = Math.max(0, Math.abs(relY - leafCenterY) - 1);
      for (let dx = -leafRadius; dx <= leafRadius; dx += 1) {
        for (let dz = -leafRadius; dz <= leafRadius; dz += 1) {
          if (Math.abs(dx) + Math.abs(dz) + verticalPenalty <= leafRadius) {
            setHarthmereFastBlock(
              blocks,
              cx + dx,
              relY,
              cz + dz,
              kind === "orchard" &&
                relY === trunkHeight &&
                (cx + dx + cz + dz) % 5 === 0
                ? "rose"
                : "oakLeaf"
            );
          }
        }
      }
    }
  }

  for (const [cx, cz, kind] of HARTHMERE_HARVESTABLE_ORE_CENTERS) {
    if (
      isInsideAuthoredHarthmereTown(cx, cz, 18) ||
      isHarthmereWideWildsRoad(cx, cz, 7)
    ) {
      continue;
    }

    const materialName: HarthmereFastHarvestableMaterialName =
      kind === "coal"
        ? "coal"
        : kind === "copper"
          ? "copperOre"
          : kind === "iron"
            ? "ironOre"
            : kind === "silver"
              ? "silverOre"
              : kind === "gold"
                ? "goldOre"
                : "stone";

    for (let dx = -4; dx <= 4; dx += 1) {
      for (let dz = -4; dz <= 4; dz += 1) {
        const horizontal = Math.abs(dx) + Math.abs(dz);
        if (horizontal <= 3) {
          setHarthmereFastBlock(blocks, cx + dx, 1, cz + dz, materialName);
        }
        if (horizontal <= 2) {
          setHarthmereFastBlock(blocks, cx + dx, 2, cz + dz, materialName);
        }
        if (horizontal <= 1) {
          setHarthmereFastBlock(blocks, cx + dx, 3, cz + dz, materialName);
        }
        if (
          kind !== "stone" &&
          horizontal === 3 &&
          (cx + dx + cz + dz) % 2 === 0
        ) {
          setHarthmereFastBlock(blocks, cx + dx, 2, cz + dz, materialName);
        }
      }
    }
  }

  for (const [cx, cz, kind] of HARTHMERE_HARVESTABLE_FORAGE_CENTERS) {
    if (
      isInsideAuthoredHarthmereTown(cx, cz, 18) ||
      isHarthmereWideWildsRoad(cx, cz, 5)
    ) {
      continue;
    }

    for (let dx = -3; dx <= 3; dx += 1) {
      for (let dz = -3; dz <= 3; dz += 1) {
        const horizontal = Math.abs(dx) + Math.abs(dz);
        const x = cx + dx;
        const z = cz + dz;

        if (kind === "clay") {
          if (horizontal <= 2) {
            setHarthmereFastBlock(
              blocks,
              x,
              1,
              z,
              (x + z) % 2 === 0 ? "soil" : "sand"
            );
          }
          if (horizontal <= 1) {
            setHarthmereFastBlock(
              blocks,
              x,
              2,
              z,
              (x + z) % 2 === 0 ? "soil" : "sand"
            );
          }
          continue;
        }

        if (kind === "reed" || kind === "flax") {
          if (horizontal <= 1) {
            for (let relY = 1; relY <= (kind === "reed" ? 4 : 3); relY += 1) {
              setHarthmereFastBlock(
                blocks,
                x,
                relY,
                z,
                kind === "reed" ? "switchGrass" : "hay"
              );
            }
          }
          continue;
        }

        if (kind === "root") {
          if (horizontal <= 2) {
            setHarthmereFastBlock(blocks, x, 1, z, "oakLog");
          }
          continue;
        }

        if (horizontal > 2) {
          continue;
        }

        switch (kind) {
          case "mushroom":
            setHarthmereFastBlock(
              blocks,
              x,
              1,
              z,
              horizontal === 0 ? "redWool" : "moss"
            );
            break;
          case "berry":
            setHarthmereFastBlock(
              blocks,
              x,
              1,
              z,
              horizontal <= 1 ? "rose" : "oakLeaf"
            );
            break;
          case "herb":
          case "wild_garlic":
            setHarthmereFastBlock(blocks, x, 1, z, "switchGrass");
            break;
          case "flower":
            setHarthmereFastBlock(
              blocks,
              x,
              1,
              z,
              (x + z) % 2 === 0 ? "dandelion" : "rose"
            );
            break;
          case "grave_moss":
            setHarthmereFastBlock(
              blocks,
              x,
              1,
              z,
              horizontal === 0 ? "blackWool" : "moss"
            );
            break;
          case "honey":
            setHarthmereFastBlock(
              blocks,
              x,
              1,
              z,
              horizontal === 0 ? "yellowWool" : "oakLog"
            );
            break;
          default:
            setHarthmereFastBlock(blocks, x, 1, z, "switchGrass");
            break;
        }
      }
    }
  }

  return blocks;
}

const HARTHMERE_FAST_HARVESTABLE_BLOCK_BY_COORD =
  buildHarthmereFastHarvestableBlockMap();

function harthmereFastHarvestableBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const materialName = HARTHMERE_FAST_HARVESTABLE_BLOCK_BY_COORD.get(
    harthmereFastBlockKey(worldX, worldY, worldZ)
  );
  return materialName ? materials[materialName] : undefined;
}

function harthmereHarvestableOreMaterial(
  materials: ReturnType<typeof localDevMaterials>,
  kind: HarthmereHarvestableOreKind
) {
  switch (kind) {
    case "coal":
      return materials.coal;
    case "copper":
      return materials.copperOre;
    case "iron":
      return materials.ironOre;
    case "silver":
      return materials.silverOre;
    case "gold":
      return materials.goldOre;
    case "stone":
    default:
      return materials.stone;
  }
}

function harthmereHarvestableTreeCandidates(worldX: number, worldZ: number) {
  const candidates: Array<
    readonly [number, number, HarthmereHarvestableTreeKind]
  > = [];
  for (let dx = -6; dx <= 6; dx += 1) {
    for (let dz = -6; dz <= 6; dz += 1) {
      const cx = worldX - dx;
      const cz = worldZ - dz;
      const kind = HARTHMERE_HARVESTABLE_TREE_CENTER_BY_COORD.get(
        harthmereResourceKey(cx, cz)
      );
      if (kind) {
        candidates.push([cx, cz, kind]);
      }
    }
  }
  return candidates;
}

function harthmereHarvestableTreeBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  if (relY < 1 || relY > 12) {
    return undefined;
  }
  if (
    isInsideAuthoredHarthmereTown(worldX, worldZ, 18) ||
    isHarthmereWideWildsRoad(worldX, worldZ, 8)
  ) {
    return undefined;
  }

  for (const [cx, cz, kind] of harthmereHarvestableTreeCandidates(
    worldX,
    worldZ
  )) {
    const dx = worldX - cx;
    const dz = worldZ - cz;
    const adx = Math.abs(dx);
    const adz = Math.abs(dz);
    const trunkHeight =
      kind === "orchard"
        ? 4
        : kind === "dead"
          ? 5
          : kind === "pine"
            ? 8
            : kind === "birch"
              ? 7
              : kind === "willow"
                ? 6
                : 6;

    if (adx === 0 && adz === 0 && inRange(relY, 1, trunkHeight)) {
      return kind === "birch" && relY % 2 === 0
        ? materials.whiteWool
        : materials.oakLog;
    }

    if (
      kind !== "dead" &&
      relY === trunkHeight - 1 &&
      ((adz === 0 && adx <= 2) || (adx === 0 && adz <= 2))
    ) {
      return materials.oakLog;
    }

    if (kind === "dead") {
      if (
        relY === trunkHeight &&
        ((adz === 0 && adx <= 2) || (adx === 0 && adz <= 2))
      ) {
        return materials.oakLog;
      }
      continue;
    }

    if (kind === "pine") {
      const canopyBottom = trunkHeight - 3;
      const canopyTop = trunkHeight + 3;
      if (relY >= canopyBottom && relY <= canopyTop) {
        const taper = Math.max(1, 5 - Math.max(0, relY - canopyBottom));
        if (adx + adz <= taper) {
          return materials.oakLeaf;
        }
      }
      continue;
    }

    const leafCenterY = kind === "willow" ? trunkHeight : trunkHeight + 1;
    const verticalPenalty = Math.max(0, Math.abs(relY - leafCenterY) - 1);
    const leafRadius = kind === "orchard" ? 3 : kind === "willow" ? 5 : 4;
    if (
      relY >= trunkHeight - 2 &&
      relY <= trunkHeight + 3 &&
      adx + adz + verticalPenalty <= leafRadius
    ) {
      if (
        kind === "orchard" &&
        relY === trunkHeight &&
        (worldX + worldZ) % 5 === 0
      ) {
        return materials.rose;
      }
      return materials.oakLeaf;
    }
  }

  return undefined;
}

function harthmereHarvestableOreCandidates(worldX: number, worldZ: number) {
  const candidates: Array<
    readonly [number, number, HarthmereHarvestableOreKind]
  > = [];
  for (let dx = -4; dx <= 4; dx += 1) {
    for (let dz = -4; dz <= 4; dz += 1) {
      const cx = worldX - dx;
      const cz = worldZ - dz;
      const kind = HARTHMERE_HARVESTABLE_ORE_CENTER_BY_COORD.get(
        harthmereResourceKey(cx, cz)
      );
      if (kind) {
        candidates.push([cx, cz, kind]);
      }
    }
  }
  return candidates;
}

function harthmereHarvestableOreBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  if (relY < 1 || relY > 4) {
    return undefined;
  }
  if (
    isInsideAuthoredHarthmereTown(worldX, worldZ, 18) ||
    isHarthmereWideWildsRoad(worldX, worldZ, 7)
  ) {
    return undefined;
  }

  for (const [cx, cz, kind] of harthmereHarvestableOreCandidates(
    worldX,
    worldZ
  )) {
    const adx = Math.abs(worldX - cx);
    const adz = Math.abs(worldZ - cz);
    const horizontal = adx + adz;
    const isBase = relY === 1 && horizontal <= 3;
    const isMiddle = relY === 2 && horizontal <= 2;
    const isCap = relY === 3 && horizontal <= 1;
    const isClusterChip =
      kind !== "stone" &&
      relY === 2 &&
      horizontal === 3 &&
      (worldX + worldZ) % 2 === 0;
    if (isBase || isMiddle || isCap || isClusterChip) {
      return harthmereHarvestableOreMaterial(materials, kind);
    }
  }

  return undefined;
}

function harthmereHarvestableForageCandidates(worldX: number, worldZ: number) {
  const candidates: Array<
    readonly [number, number, HarthmereHarvestableForageKind]
  > = [];
  for (let dx = -3; dx <= 3; dx += 1) {
    for (let dz = -3; dz <= 3; dz += 1) {
      const cx = worldX - dx;
      const cz = worldZ - dz;
      const kind = HARTHMERE_HARVESTABLE_FORAGE_CENTER_BY_COORD.get(
        harthmereResourceKey(cx, cz)
      );
      if (kind) {
        candidates.push([cx, cz, kind]);
      }
    }
  }
  return candidates;
}

function harthmereHarvestableForageBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  if (relY < 1 || relY > 4) {
    return undefined;
  }
  if (
    isInsideAuthoredHarthmereTown(worldX, worldZ, 18) ||
    isHarthmereWideWildsRoad(worldX, worldZ, 5)
  ) {
    return undefined;
  }

  for (const [cx, cz, kind] of harthmereHarvestableForageCandidates(
    worldX,
    worldZ
  )) {
    const adx = Math.abs(worldX - cx);
    const adz = Math.abs(worldZ - cz);
    const horizontal = adx + adz;
    if (kind === "clay") {
      if ((relY === 1 && horizontal <= 2) || (relY === 2 && horizontal <= 1)) {
        return (worldX + worldZ) % 2 === 0 ? materials.soil : materials.sand;
      }
      continue;
    }
    if (kind === "reed" || kind === "flax") {
      if (horizontal <= 1 && inRange(relY, 1, kind === "reed" ? 4 : 3)) {
        return kind === "reed" ? materials.switchGrass : materials.hay;
      }
      continue;
    }
    if (kind === "root") {
      if (relY === 1 && horizontal <= 2) {
        return materials.oakLog;
      }
      continue;
    }
    if (relY !== 1 || horizontal > 2) {
      continue;
    }
    switch (kind) {
      case "mushroom":
        return horizontal === 0 ? materials.redWool : materials.moss;
      case "berry":
        return horizontal <= 1 ? materials.rose : materials.oakLeaf;
      case "herb":
      case "wild_garlic":
        return materials.switchGrass;
      case "flower":
        return (worldX + worldZ) % 2 === 0
          ? materials.dandelion
          : materials.rose;
      case "grave_moss":
        return horizontal === 0 ? materials.blackWool : materials.moss;
      case "honey":
        return horizontal === 0 ? materials.yellowWool : materials.oakLog;
      default:
        return materials.switchGrass;
    }
  }

  return undefined;
}

function harthmereWideWildsBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const relY = worldY - STARTER_TOWN_GROUND_Y;
  // The ceiling used to be 10, which predates the forest. Canopies reach
  // HARTHMERE_FOREST_MAX_HEIGHT, and clipping them would sever leaves from
  // their logs and hand Gaia a decaying tree.
  if (relY < 1 || relY > HARTHMERE_FOREST_MAX_HEIGHT) {
    return undefined;
  }
  if (isInsideAuthoredHarthmereTown(worldX, worldZ, 16)) {
    return undefined;
  }

  const harvestableResource = harthmereFastHarvestableBlockAt(
    materials,
    worldX,
    worldY,
    worldZ
  );
  if (harvestableResource) {
    return harvestableResource;
  }

  // Waystones at the four new road exits and major wilderness bends. They are
  // deliberately off the centerline so they guide without blocking movement.
  const waystones = [
    [486, -344, "redWool"],
    [486, 36, "yellowWool"],
    [322, -209, "greenWool"],
    [660, -205, "blueWool"],
    [255, -410, "blackWool"],
    [720, -365, "blueWool"],
    [250, 120, "greenWool"],
    [720, 120, "whiteWool"],
  ] as const;
  for (const [sx, sz, mat] of waystones) {
    if (worldX === sx && worldZ === sz && inRange(relY, 1, 3)) {
      return relY === 3
        ? harthmereMat(materials, mat as HarthmereMat)
        : materials.stoneBrick;
    }
  }

  // HARTHMERE_WILDS_FOREST
  //
  // This replaces the note that used to sit here saying forest density was the
  // runtime renderer's job. It was not doing it — in snapshot-built mode every
  // GLB tree prop is filtered out precisely because voxel terrain is supposed
  // to own trees — so the fields were bare.
  //
  // The two original objections are answered in the generator, not here:
  // placement is a pure hash-lattice function with a per-column cache rather
  // than a global pass, and every leaf sits above head height so a dense wood
  // stays walkable. See src/shared/harthmere/harthmere_wilds_forest.ts.
  if (harthmereWildsForestAllowed(worldX, worldZ)) {
    const forest = harthmereWildsForestBlockAt(worldX, relY, worldZ);
    if (forest) {
      return harthmereMat(materials, forest as HarthmereMat);
    }
    if (relY === 1) {
      const cover = harthmereWildsGroundCoverAt(worldX, worldZ);
      if (cover) {
        return harthmereMat(materials, cover as HarthmereMat);
      }
    }
  }

  // Small wilderness harvest markers. These are sparse and never placed on the
  // road so the player can cross the whole map without getting wedged, nor over
  // the river, where they would float above the water.
  if (
    relY === 1 &&
    !isHarthmereWideWildsRoad(worldX, worldZ, 9) &&
    !harthmereRiverContains(worldX, worldZ) &&
    !harthmereStillWaterContains(worldX, worldZ) &&
    // Same reason as the forest gate above: this scatter runs in the air
    // volume a building encloses, which is how crates and roses ended up on
    // the floor of the watermill and the Deep Old Wood lodge.
    !isHarthmereBuildingVegetationExclusion(worldX, worldZ)
  ) {
    const hash = localDevWildsHash(worldX, worldZ, 47);
    if (hash % 863 === 0) {
      return materials.woodCrate;
    }
    if (hash % 431 === 0) {
      return materials.switchGrass;
    }
    if (hash % 389 === 0) {
      return materials.rose;
    }
  }

  return undefined;
}

function starterTownSurfaceMaterial(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldZ: number,
  current: TerrainID,
  allowMuckwad = true
): TerrainID {
  const harthmereSurface = harthmereSurfaceMaterial(materials, worldX, worldZ);
  const wideWildsSurface = harthmereWideWildsSurfaceMaterial(
    materials,
    worldX,
    worldZ,
    allowMuckwad
  );
  return harthmereSurface ?? wideWildsSurface ?? current;
}

function chickenBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const chickens = [
    [439, -235],
    [444, -230],
    [451, -239],
    [455, -229],
    [436, -243],
  ] as const;
  for (const [cx, cz] of chickens) {
    const dx = worldX - cx;
    const dz = worldZ - cz;
    if (worldY === STARTER_TOWN_GROUND_Y + 1 && Math.abs(dx) <= 1 && dz === 0) {
      return materials.whiteWool;
    }
    if (worldY === STARTER_TOWN_GROUND_Y + 2 && dx === 0 && dz === 0) {
      return materials.whiteWool;
    }
    if (worldY === STARTER_TOWN_GROUND_Y + 2 && dx === 0 && dz === -1) {
      return materials.yellowWool;
    }
    if (
      worldY === STARTER_TOWN_GROUND_Y + 2 &&
      Math.abs(dx) === 1 &&
      dz === -1
    ) {
      return materials.coal;
    }
  }
  return undefined;
}

function townWallBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const x0 = 392;
  const x1 = 590;
  const z0 = -282;
  const z1 = -112;
  const onWall =
    (worldX === x0 || worldX === x1 || worldZ === z0 || worldZ === z1) &&
    inRect(worldX, worldZ, x0, x1, z0, z1);
  const northGateGap = worldZ === z0 && inRange(worldX, 477, 497);
  const bridgeGateGap = worldX === x1 && inRange(worldZ, -212, -198);
  if (
    onWall &&
    !northGateGap &&
    !bridgeGateGap &&
    inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 6)
  ) {
    return materials.stoneBrick;
  }

  const gateTowers = [
    [466, 474, -284, -276],
    [500, 508, -284, -276],
    [584, 592, -216, -208],
    [584, 592, -194, -186],
  ] as const;
  for (const [tx0, tx1, tz0, tz1] of gateTowers) {
    const inside = inRect(worldX, worldZ, tx0, tx1, tz0, tz1);
    const edge =
      inside &&
      (worldX === tx0 || worldX === tx1 || worldZ === tz0 || worldZ === tz1);
    if (inside && worldY === STARTER_TOWN_GROUND_Y) {
      return materials.stonePolished;
    }
    if (
      edge &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 10)
    ) {
      return materials.stoneBrick;
    }
    if (inside && worldY === STARTER_TOWN_GROUND_Y + 11) {
      return materials.stoneShingles;
    }
  }

  return undefined;
}

function bridgeDockBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  if (worldY === STARTER_TOWN_GROUND_Y) {
    if (inRect(worldX, worldZ, 586, 607, -210, -200)) {
      return materials.stonePolished;
    }
    const dockDecks =
      inRect(worldX, worldZ, 590, 606, -190, -184) ||
      inRect(worldX, worldZ, 590, 606, -178, -172) ||
      inRect(worldX, worldZ, 590, 606, -166, -160);
    if (dockDecks) {
      return materials.oakLumber;
    }
  }
  const dockPost =
    (worldX === 590 || worldX === 606) &&
    (worldZ === -190 ||
      worldZ === -184 ||
      worldZ === -178 ||
      worldZ === -172 ||
      worldZ === -166 ||
      worldZ === -160);
  if (
    dockPost &&
    inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 3)
  ) {
    return materials.oakLog;
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y + 1 &&
    inRect(worldX, worldZ, 594, 600, -188, -162) &&
    (worldX + worldZ) % 7 === 0
  ) {
    return materials.woodCrate;
  }
  return undefined;
}

function graveyardBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const stones = [
    [504, -144],
    [510, -140],
    [516, -146],
    [522, -138],
    [528, -148],
    [508, -130],
    [520, -128],
    [532, -134],
  ] as const;
  for (const [sx, sz] of stones) {
    if (
      worldX === sx &&
      worldZ === sz &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 3)
    ) {
      return materials.stoneBrick;
    }
    if (
      worldY === STARTER_TOWN_GROUND_Y + 3 &&
      worldZ === sz &&
      Math.abs(worldX - sx) <= 1
    ) {
      return materials.stoneBrick;
    }
  }
  return undefined;
}

function drainTunnelBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  if (!inRect(worldX, worldZ, 396, 404, -238, -232)) {
    return undefined;
  }
  const arch =
    (worldX === 396 || worldX === 404 || worldZ === -238 || worldZ === -232) &&
    inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 4);
  if (arch) {
    return materials.stoneBrick;
  }
  if (
    worldY === STARTER_TOWN_GROUND_Y &&
    inRect(worldX, worldZ, 398, 402, -236, -234)
  ) {
    return materials.cobblestone;
  }
  return undefined;
}

function appleOrchardBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const trees = [
    [448, -112],
    [460, -114],
    [472, -116],
    [446, -100],
    [458, -98],
    [470, -102],
  ] as const;
  for (const [tx, tz] of trees) {
    const dx = Math.abs(worldX - tx);
    const dz = Math.abs(worldZ - tz);
    if (
      dx === 0 &&
      dz === 0 &&
      inRange(worldY, STARTER_TOWN_GROUND_Y + 1, STARTER_TOWN_GROUND_Y + 5)
    ) {
      return materials.oakLog;
    }
    const leafY = worldY - (STARTER_TOWN_GROUND_Y + 5);
    if (leafY >= -1 && leafY <= 3 && dx + dz + Math.abs(leafY - 1) <= 4) {
      if (leafY === 0 && (worldX + worldZ) % 5 === 0) {
        return materials.rose;
      }
      return materials.oakLeaf;
    }
  }
  return undefined;
}

function starterTownAboveGroundBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  const authoredBlock =
    harthmereFullTownBlockAt(materials, worldX, worldY, worldZ) ??
    harthmereWideWildsBlockAt(materials, worldX, worldY, worldZ);
  if (authoredBlock) {
    return authoredBlock;
  }
  const edgeHorizon = harthmereExtensionEdgeHorizonBlockAt(
    worldX + harthmereExtraTownOffsetX(),
    worldY,
    worldZ + harthmereExtraTownOffsetZ()
  );
  return edgeHorizon ? harthmereMat(materials, edgeHorizon) : undefined;
}

function starterTownDecorBlockAt(
  materials: ReturnType<typeof localDevMaterials>,
  worldX: number,
  worldY: number,
  worldZ: number
): TerrainID | undefined {
  if (worldY !== STARTER_TOWN_GROUND_Y + 1) {
    return undefined;
  }

  if (isStarterTownFarm(worldX, worldZ)) {
    if ((worldX + worldZ) % 5 === 0) {
      return materials.carrot;
    }
    return (worldX + worldZ) % 2 === 0 ? materials.wheat : undefined;
  }

  if (isStarterTownRoad(worldX, worldZ) || isStarterTownPlaza(worldX, worldZ)) {
    return undefined;
  }

  const hash = Math.abs((worldX * 73856093) ^ (worldZ * 19349663));
  if (hash % 131 === 0) {
    return materials.sunflower;
  }
  if (hash % 97 === 0) {
    return materials.rose;
  }
  if (hash % 53 === 0) {
    return materials.dandelion;
  }
  if (hash % 17 === 0) {
    return materials.switchGrass;
  }
  return undefined;
}

function localDevTerrainShardSpecs() {
  const specs: Array<{
    id: BiomesId;
    shardX: number;
    shardY: number;
    shardZ: number;
  }> = [];
  const seen = new Set<string>();
  const pushRuntimeSpec = (shardX: number, shardY: number, shardZ: number) => {
    // In connected-world mode, this seed owns only the new east extension.
    // Skipping every older-map shard is the fail-closed guarantee that cave,
    // outpost, or full-profile additions cannot replace production terrain.
    if (
      shouldUseHarthmereExtraTownOffset() &&
      !isHarthmereExtensionWorldShardX(shardX)
    ) {
      return;
    }
    const key = `${shardX}:${shardY}:${shardZ}`;
    if (seen.has(key)) {
      return;
    }
    const terrainEntityId = harthmereExtensionTerrainEntityIdForShard(
      shardX,
      shardY,
      shardZ
    );
    if (terrainEntityId === undefined) {
      throw new Error(
        `Harthmere terrain shard is outside the stable id grid: ${key}`
      );
    }
    seen.add(key);
    specs.push({
      id: terrainEntityId as BiomesId,
      shardX,
      shardY,
      shardZ,
    });
  };
  const pushSpec = (shardX: number, shardY: number, shardZ: number) => {
    pushRuntimeSpec(
      shardX + harthmereExtraTownShardOffsetX(),
      shardY,
      shardZ + harthmereExtraTownShardOffsetZ()
    );
  };

  const pushAuthoredVolume = (
    x0: number,
    x1: number,
    worldY0: number,
    worldY1: number,
    z0: number,
    z1: number
  ) => {
    for (
      let shardX = Math.floor(x0 / SHARD_DIM);
      shardX <= Math.floor(x1 / SHARD_DIM);
      shardX += 1
    ) {
      if (
        shardX < STARTER_TOWN_WILDS_SHARD_X0 ||
        shardX > STARTER_TOWN_WILDS_SHARD_X1
      ) {
        continue;
      }
      for (
        let shardZ = Math.floor(z0 / SHARD_DIM);
        shardZ <= Math.floor(z1 / SHARD_DIM);
        shardZ += 1
      ) {
        if (
          shardZ < STARTER_TOWN_WILDS_SHARD_Z0 ||
          shardZ > STARTER_TOWN_WILDS_SHARD_Z1
        ) {
          continue;
        }
        for (
          let shardY = Math.floor(worldY0 / SHARD_DIM);
          shardY <= Math.floor(worldY1 / SHARD_DIM);
          shardY += 1
        ) {
          pushSpec(shardX, shardY, shardZ);
        }
      }
    }
  };

  // Seed every shard in the additive rectangle from Y=-64 through the surface
  // shard. The old surface-only pass made Harthmere a thin floating slab and
  // also stopped at the authored town edge, leaving the map's east padding as
  // a sheer void. These specs are already in runtime/world coordinates.
  for (const spec of harthmereExtensionFoundationShardSpecs()) {
    pushRuntimeSpec(spec.shardX, spec.shardY, spec.shardZ);
  }
  for (const spec of harthmereExtensionEdgeHorizonShardSpecs()) {
    pushRuntimeSpec(spec.shardX, spec.shardY, spec.shardZ);
  }

  for (const building of HARTHMERE_BUILDINGS) {
    const topWorldY = STARTER_TOWN_GROUND_Y + harthmereTopRelY(building) + 2;
    if (topWorldY < 64) continue;
    pushAuthoredVolume(
      building.x0 - 2,
      building.x1 + 2,
      64,
      topWorldY,
      building.z0 - 2,
      building.z1 + 2
    );
  }
  // Legacy gate/watchtower generators are not represented in the building
  // array, but their roofs cross the Y=64 shard boundary.
  for (const [x0, x1, z0, z1, topWorldY] of [
    [520, 529, -254, -245, STARTER_TOWN_GROUND_Y + 16],
    [462, 476, -290, -276, STARTER_TOWN_GROUND_Y + 12],
    [498, 512, -290, -276, STARTER_TOWN_GROUND_Y + 12],
    [584, 596, -220, -208, STARTER_TOWN_GROUND_Y + 12],
    [584, 596, -194, -182, STARTER_TOWN_GROUND_Y + 12],
    [386, 398, -220, -206, STARTER_TOWN_GROUND_Y + 12],
    [386, 398, -126, -112, STARTER_TOWN_GROUND_Y + 12],
    [584, 596, -126, -112, STARTER_TOWN_GROUND_Y + 12],
  ] as const) {
    pushAuthoredVolume(x0, x1, 64, topWorldY, z0, z1);
  }

  for (const area of HARTHMERE_DUNGEON_AREAS) {
    pushAuthoredVolume(
      area.x0 - 1,
      area.x1 + 1,
      STARTER_TOWN_GROUND_Y + area.y0 - 1,
      STARTER_TOWN_GROUND_Y + area.y1 + 1,
      area.z0 - 1,
      area.z1 + 1
    );
  }

  for (const shard of HARTHMERE_SUPPLEMENTAL_TERRAIN_SHARDS) {
    pushSpec(shard.shardX, shard.shardY, shard.shardZ);
  }
  for (const [
    shardX,
    shardY,
    shardZ,
  ] of HARTHMERE_BUSINESS_OUTPOST_SEED_TERRAIN_SHARDS) {
    pushRuntimeSpec(shardX, shardY, shardZ);
  }
  return specs;
}

/**
 * The Elsewhen dungeons own a small sparse shard set, not the whole 1,024 x
 * 1,024 band. Keeping this list separate from the flat Harthmere foundation
 * avoids both filling the deliberate void gap and paying to serialize empty
 * terrain on every maintenance seed.
 */
function localDevChapter1TerrainShardSpecs() {
  const specs = new Map<
    string,
    { id: BiomesId; shardX: number; shardY: number; shardZ: number }
  >();
  for (const dungeonId of ["ch1_dungeon_desert", "ch1_dungeon_winter"]) {
    for (const spec of ch1DungeonShardSpecs(dungeonId, SHARD_DIM)) {
      const id = ch1ElsewhenTerrainEntityIdForShard(
        spec.shardX,
        spec.shardY,
        spec.shardZ
      );
      if (id === undefined) {
        throw new Error(
          `Chapter 1 terrain shard is outside the stable Elsewhen id grid: ` +
            `${spec.shardX}:${spec.shardY}:${spec.shardZ}`
        );
      }
      specs.set(`${spec.shardX}:${spec.shardY}:${spec.shardZ}`, {
        id: id as BiomesId,
        ...spec,
      });
    }
  }
  return [...specs.values()].sort(
    (a, b) => a.shardX - b.shardX || a.shardY - b.shardY || a.shardZ - b.shardZ
  );
}

function localDevLegacyTerrainShardIds() {
  return Array.from(
    { length: HARTHMERE_LEGACY_LOCAL_DEV_TERRAIN_SHARD_COUNT },
    (_, offset) => (LEGACY_LOCAL_DEV_TERRAIN_ID_BASE + offset) as BiomesId
  );
}

function localDevPreviousAdditiveTerrainIds() {
  return Array.from(
    {
      length:
        HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_LIMIT -
        HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_BASE,
    },
    (_, offset) =>
      (HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_BASE + offset) as BiomesId
  );
}

async function existingPreviousAdditiveTerrainIds(
  service: ShimWorldService | undefined,
  worldApi: WorldApi
) {
  const previousIds = localDevPreviousAdditiveTerrainIds();
  const terrainIds = new Set<BiomesId>();
  if (service) {
    for (const id of previousIds) {
      const entity = service.table.get(id);
      if (entity?.box && entity.shard_seed) {
        terrainIds.add(id);
      }
    }
    return terrainIds;
  }

  if (process.env.BIOMES_SKIP_RETIRED_TERRAIN_SCAN === "1") {
    log.warn("Skipping retired additive terrain scan by explicit request", {
      previousTerrainIds: previousIds.length,
    });
    return terrainIds;
  }

  // The retired terrain band collided with escort-companion ids. Never delete
  // a numeric range blindly: inspect the ECS components and retain only actual
  // terrain entities (box + shard seed) for migration cleanup.
  for (let start = 0; start < previousIds.length; start += 500) {
    const batch = previousIds.slice(start, start + 500);
    log.warn("Inspecting retired additive terrain id batch", {
      start,
      end: start + batch.length,
      total: previousIds.length,
    });
    const existingIds = (await worldApi.has(batch)) as BiomesId[];
    const entities = await worldApi.get(existingIds);
    for (let index = 0; index < entities.length; index += 1) {
      const entity = entities[index];
      if (entity?.hasBox?.() && entity.hasShardSeed?.()) {
        terrainIds.add(existingIds[index]);
      }
    }
    log.warn("Inspected retired additive terrain id batch", {
      start,
      end: start + batch.length,
      total: previousIds.length,
      existingIds: existingIds.length,
      retiredTerrainIds: terrainIds.size,
    });
  }
  return terrainIds;
}

function makeLocalDevStaleTerrainDeletes(
  tick: number,
  activeTerrainIds: Set<BiomesId>,
  existingIds: Set<BiomesId>
): Change[] {
  if (shouldUseHarthmereExtraTownOffset()) {
    // Additive mode never deletes the old terrain id band. Old map state is
    // preserved byte-for-byte while the new extension uses its own entities.
    return [];
  }
  if (HARTHMERE_LOCAL_DEV_PERF_PROFILE === "full") {
    return [];
  }
  const deletes: Change[] = [];
  for (const id of localDevLegacyTerrainShardIds()) {
    if (!activeTerrainIds.has(id) && existingIds.has(id)) {
      deletes.push({ kind: "delete", tick, id });
    }
  }
  return deletes;
}

function localDevTerrainShardHasAuthoredWater(
  shardX: number,
  shardY: number,
  shardZ: number
) {
  const v0 = shardToVoxelPos(shardX, shardY, shardZ);
  const v1 = [v0[0] + SHARD_DIM, v0[1] + SHARD_DIM, v0[2] + SHARD_DIM] as [
    number,
    number,
    number,
  ];
  const authoredX0 = harthmereAuthoredWorldX(v0[0]);
  const authoredX1 = harthmereAuthoredWorldX(v1[0] - 1);
  const authoredZ0 = harthmereAuthoredWorldZ(v0[2]);
  const authoredZ1 = harthmereAuthoredWorldZ(v1[2] - 1);
  const spanX0 = Math.min(authoredX0, authoredX1);
  const spanX1 = Math.max(authoredX0, authoredX1);
  const spanZ0 = Math.min(authoredZ0, authoredZ1);
  const spanZ1 = Math.max(authoredZ0, authoredZ1);
  return (
    (v0[1] <= STARTER_TOWN_GROUND_Y &&
      v1[1] > STARTER_TOWN_GROUND_Y - HARTHMERE_RIVER_MAX_CARVE_DEPTH &&
      harthmereRiverTouchesAuthoredSpan(spanX0, spanX1, spanZ0, spanZ1)) ||
    (v0[1] <= STARTER_TOWN_GROUND_Y + HARTHMERE_STILL_WATER_MAX_REL_Y &&
      v1[1] > STARTER_TOWN_GROUND_Y + HARTHMERE_STILL_WATER_MIN_REL_Y &&
      harthmereStillWaterTouchesAuthoredSpan(spanX0, spanX1, spanZ0, spanZ1))
  );
}

function makeLocalDevTerrainShard(
  voxeloo: VoxelooModule,
  kind: "create" | "update",
  id: BiomesId,
  shardX: number,
  shardY: number,
  shardZ: number,
  tick: number,
  authoredWaterOnly = false
): Change {
  const v0 = shardToVoxelPos(shardX, shardY, shardZ);
  const v1 = [v0[0] + SHARD_DIM, v0[1] + SHARD_DIM, v0[2] + SHARD_DIM] as [
    number,
    number,
    number,
  ];

  const materials = localDevMaterials();

  const buffer = using(new voxeloo.VolumeBlock_U32(), (seedBlock) => {
    const groundLocalY = STARTER_TOWN_GROUND_Y - v0[1];
    const hasGroundInShard = groundLocalY >= 0 && groundLocalY < SHARD_DIM;

    // The Harthmere local-dev world is intentionally flat. Fill the ground and
    // underground material directly, then only check authored town/wilderness
    // structures for the few above-ground y values. This keeps the expanded
    // Wilds playable without blocking shim readiness for minutes.
    for (let z = 0; z < SHARD_DIM; z += 1) {
      for (let x = 0; x < SHARD_DIM; x += 1) {
        const worldX = v0[0] + x;
        const worldZ = v0[2] + z;
        const authoredWorldX = harthmereAuthoredWorldX(worldX);
        const authoredWorldZ = harthmereAuthoredWorldZ(worldZ);

        if (hasGroundInShard) {
          for (let y = 0; y <= groundLocalY; y += 1) {
            const worldY = v0[1] + y;
            const depth = STARTER_TOWN_GROUND_Y - worldY;
            const base =
              depth === 0
                ? materials.grass
                : depth > 6
                  ? materials.stone
                  : materials.dirt;

            // HARTHMERE_RIVER: the Brell is cut out of the flat plane. The
            // authored bridge deck and the module's own plank crossings are
            // excluded from the carve, so every route across the map survives.
            // `relY` here is negative going down, matching the river module.
            const riverRelY = worldY - STARTER_TOWN_GROUND_Y;
            // HARTHMERE_STILL_WATER: the mill race is cut into the surface.
            // The fountain and trough sit ABOVE grade and are authored through
            // `starterTownAboveGroundBlockAt` instead, like the rest of the
            // town's props.
            if (
              harthmereStillWaterCarvesAirAt(
                authoredWorldX,
                riverRelY,
                authoredWorldZ
              )
            ) {
              continue;
            }
            const riverBed = harthmereRiverBedMaterialAt(
              authoredWorldX,
              riverRelY,
              authoredWorldZ
            );
            if (riverBed) {
              seedBlock.set(x, y, z, harthmereMat(materials, riverBed));
              continue;
            }
            if (
              harthmereRiverCarvesAirAt(
                authoredWorldX,
                riverRelY,
                authoredWorldZ
              )
            ) {
              // The volume block starts empty, so air needs no write.
              continue;
            }

            if (depth === 0) {
              if (
                harthmereIsBellbinderSurfaceOpening(
                  authoredWorldX,
                  worldY,
                  authoredWorldZ
                )
              ) {
                // Leave the chapel stair mouth as real air. The volume block
                // starts empty, so no explicit zero write is required.
                continue;
              }
              const riverDeck = harthmereRiverCrossingDeckAt(
                authoredWorldX,
                riverRelY,
                authoredWorldZ
              );
              if (riverDeck) {
                seedBlock.set(x, y, z, harthmereMat(materials, riverDeck));
                continue;
              }
              const authoredGround = starterTownAboveGroundBlockAt(
                materials,
                authoredWorldX,
                worldY,
                authoredWorldZ
              );
              seedBlock.set(
                x,
                y,
                z,
                authoredGround ??
                  starterTownSurfaceMaterial(
                    materials,
                    authoredWorldX,
                    authoredWorldZ,
                    base,
                    // Muck terrain belongs to the original map's danger zones.
                    // The additive Harthmere town is intentionally clean
                    // grass/dirt/road terrain, even when an authored legacy
                    // muck circle overlaps its transformed X/Z coordinates.
                    !isHarthmereExtensionWorldPosition([
                      worldX,
                      STARTER_TOWN_GROUND_Y,
                      worldZ,
                    ])
                  )
              );
            } else {
              // Buildings, vegetation, roads, and landmarks are surface-only.
              // Calling the full town generator for every underground voxel
              // made deployment seeding unnecessarily expensive; dungeon and
              // cave generation is the only authored source below ground.
              const authoredUnderground = harthmereDungeonBlockAt(
                materials,
                authoredWorldX,
                worldY,
                authoredWorldZ
              );
              if (authoredUnderground) {
                seedBlock.set(x, y, z, authoredUnderground);
              } else if (
                !harthmereShouldCarveDungeonAirBlockAt(
                  authoredWorldX,
                  worldY,
                  authoredWorldZ
                )
              ) {
                seedBlock.set(x, y, z, base);
              }
            }
          }

          for (let y = groundLocalY + 1; y < SHARD_DIM; y += 1) {
            const worldY = v0[1] + y;
            const authoredBlock = starterTownAboveGroundBlockAt(
              materials,
              authoredWorldX,
              worldY,
              authoredWorldZ
            );
            if (authoredBlock) {
              seedBlock.set(x, y, z, authoredBlock);
            }
          }
        } else if (v1[1] <= STARTER_TOWN_GROUND_Y) {
          for (let y = 0; y < SHARD_DIM; y += 1) {
            const worldY = v0[1] + y;
            const authoredUnderground = harthmereDungeonBlockAt(
              materials,
              authoredWorldX,
              worldY,
              authoredWorldZ
            );
            if (authoredUnderground) {
              seedBlock.set(x, y, z, authoredUnderground);
            } else if (
              !harthmereShouldCarveDungeonAirBlockAt(
                authoredWorldX,
                worldY,
                authoredWorldZ
              )
            ) {
              seedBlock.set(x, y, z, materials.stone);
            }
          }
        } else {
          for (let y = 0; y < SHARD_DIM; y += 1) {
            const worldY = v0[1] + y;
            const authoredBlock = starterTownAboveGroundBlockAt(
              materials,
              authoredWorldX,
              worldY,
              authoredWorldZ
            );
            if (authoredBlock) {
              seedBlock.set(x, y, z, authoredBlock);
            }
          }
        }
      }
    }

    const businessOutpostEdits =
      HARTHMERE_BUSINESS_OUTPOST_SEED_TERRAIN_EDITS_BY_SHARD.get(
        voxelShard(...v0)
      ) ?? [];
    for (const edit of businessOutpostEdits) {
      const [worldX, worldY, worldZ] = edit.position;
      if (
        worldX >= v0[0] &&
        worldX < v1[0] &&
        worldY >= v0[1] &&
        worldY < v1[1] &&
        worldZ >= v0[2] &&
        worldZ < v1[2]
      ) {
        seedBlock.set(
          worldX - v0[0],
          worldY - v0[1],
          worldZ - v0[2],
          edit.value
        );
      }
    }

    // Authored water geometry must be the final owner of its channel/basin.
    // Business materialization plans are applied after the ordinary terrain
    // generator and historically refilled the Brell with dirt/grass while the
    // parallel shard_water tensor remained level 15. That produced buried,
    // invisible water in production. Reapply the carve after every authored
    // solid edit, retaining only explicit crossing decks and basin blocks.
    const authoredSpanX0 = harthmereAuthoredWorldX(v0[0]);
    const authoredSpanX1 = harthmereAuthoredWorldX(v1[0] - 1);
    const authoredSpanZ0 = harthmereAuthoredWorldZ(v0[2]);
    const authoredSpanZ1 = harthmereAuthoredWorldZ(v1[2] - 1);
    const hasAuthoredWaterGeometry =
      (v0[1] <= STARTER_TOWN_GROUND_Y &&
        v1[1] > STARTER_TOWN_GROUND_Y - HARTHMERE_RIVER_MAX_CARVE_DEPTH &&
        harthmereRiverTouchesAuthoredSpan(
          Math.min(authoredSpanX0, authoredSpanX1),
          Math.max(authoredSpanX0, authoredSpanX1),
          Math.min(authoredSpanZ0, authoredSpanZ1),
          Math.max(authoredSpanZ0, authoredSpanZ1)
        )) ||
      (v0[1] <= STARTER_TOWN_GROUND_Y + HARTHMERE_STILL_WATER_MAX_REL_Y &&
        v1[1] > STARTER_TOWN_GROUND_Y + HARTHMERE_STILL_WATER_MIN_REL_Y &&
        harthmereStillWaterTouchesAuthoredSpan(
          Math.min(authoredSpanX0, authoredSpanX1),
          Math.max(authoredSpanX0, authoredSpanX1),
          Math.min(authoredSpanZ0, authoredSpanZ1),
          Math.max(authoredSpanZ0, authoredSpanZ1)
        ));
    if (hasAuthoredWaterGeometry) {
      for (let z = 0; z < SHARD_DIM; z += 1) {
        const worldZ = v0[2] + z;
        const authoredWorldZ = harthmereAuthoredWorldZ(worldZ);
        for (let x = 0; x < SHARD_DIM; x += 1) {
          const worldX = v0[0] + x;
          const authoredWorldX = harthmereAuthoredWorldX(worldX);
          for (let y = 0; y < SHARD_DIM; y += 1) {
            const worldY = v0[1] + y;
            const relY = worldY - STARTER_TOWN_GROUND_Y;
            const stillWaterBlock = harthmereStillWaterBlockAt(
              authoredWorldX,
              relY,
              authoredWorldZ
            );
            if (stillWaterBlock !== undefined) {
              seedBlock.set(x, y, z, harthmereMat(materials, stillWaterBlock));
              continue;
            }
            if (
              harthmereStillWaterCarvesAirAt(
                authoredWorldX,
                relY,
                authoredWorldZ
              )
            ) {
              seedBlock.set(x, y, z, 0);
              continue;
            }
            const riverBed = harthmereRiverBedMaterialAt(
              authoredWorldX,
              relY,
              authoredWorldZ
            );
            if (riverBed !== undefined) {
              seedBlock.set(x, y, z, materials[riverBed]);
              continue;
            }
            if (
              harthmereRiverCarvesAirAt(authoredWorldX, relY, authoredWorldZ)
            ) {
              const crossingDeck = harthmereRiverCrossingDeckAt(
                authoredWorldX,
                relY,
                authoredWorldZ
              );
              seedBlock.set(
                x,
                y,
                z,
                crossingDeck === undefined ? 0 : materials[crossingDeck]
              );
            }
          }
        }
      }
    }
    return saveBlock(voxeloo, seedBlock);
  });
  // New shards start with a clean atmospheric field. Existing shards keep
  // their live shard_muck component because it represents simulation/player
  // state (including robot-protected areas), not authored baseline terrain.
  const muckBuffer = using(
    Tensor.make(voxeloo, [SHARD_DIM, SHARD_DIM, SHARD_DIM], "U8"),
    (muck) => muck.save()
  );

  // HARTHMERE_RIVER: the Brell's at-rest body, written as real ShardWater.
  //
  // Water is not a block in Biomes (see the world-anatomy doc §5.1) — it is
  // this parallel field, and it is what `TerrainHelper.getWater`,
  // `isWaterAtPosition`, `marchWaterDepth`, the swim physics and the water
  // mesher all read. Level 15 is a source and never depletes (§5.3), which is
  // exactly the semantics an authored river wants; Gaia's WaterSimulation then
  // owns spread, falling water and the player's bucket from here.
  //
  // The same pass also fills the town's three still-water features — the
  // Market Plaza fountain, the farmyard trough and the watermill race — which
  // were all blue wool for the same reason. Shards nowhere near any of it skip
  // the inner loop entirely.
  const authoredX0 = harthmereAuthoredWorldX(v0[0]);
  const authoredX1 = harthmereAuthoredWorldX(v1[0] - 1);
  const authoredZ0 = harthmereAuthoredWorldZ(v0[2]);
  const authoredZ1 = harthmereAuthoredWorldZ(v1[2] - 1);
  const spanX0 = Math.min(authoredX0, authoredX1);
  const spanX1 = Math.max(authoredX0, authoredX1);
  const spanZ0 = Math.min(authoredZ0, authoredZ1);
  const spanZ1 = Math.max(authoredZ0, authoredZ1);
  const shardHasAuthoredRiver =
    v0[1] <= STARTER_TOWN_GROUND_Y &&
    v1[1] > STARTER_TOWN_GROUND_Y - HARTHMERE_RIVER_MAX_CARVE_DEPTH &&
    harthmereRiverTouchesAuthoredSpan(spanX0, spanX1, spanZ0, spanZ1);
  const shardHasAuthoredStillWater =
    v0[1] <= STARTER_TOWN_GROUND_Y + HARTHMERE_STILL_WATER_MAX_REL_Y &&
    v1[1] > STARTER_TOWN_GROUND_Y + HARTHMERE_STILL_WATER_MIN_REL_Y &&
    harthmereStillWaterTouchesAuthoredSpan(spanX0, spanX1, spanZ0, spanZ1);
  const shardHasAuthoredWater =
    shardHasAuthoredRiver || shardHasAuthoredStillWater;
  const shardWater = using(
    Tensor.make(voxeloo, [SHARD_DIM, SHARD_DIM, SHARD_DIM], "U8"),
    (water) => {
      // The river's column lives in the handful of voxels directly below the
      // flat ground plane; the still-water features sit in a small band just
      // above and below it. Only a shard owning one of those bands can hold
      // anything.
      const hasRiver = shardHasAuthoredRiver;
      const hasStillWater = shardHasAuthoredStillWater;
      if (hasRiver || hasStillWater) {
        const values = new Sparse3<number>([SHARD_DIM, SHARD_DIM, SHARD_DIM]);
        for (let z = 0; z < SHARD_DIM; z += 1) {
          for (let x = 0; x < SHARD_DIM; x += 1) {
            const authoredX = harthmereAuthoredWorldX(v0[0] + x);
            const authoredZ = harthmereAuthoredWorldZ(v0[2] + z);
            const inRiver =
              hasRiver && harthmereRiverContains(authoredX, authoredZ);
            if (!inRiver && !hasStillWater) {
              continue;
            }
            for (let y = 0; y < SHARD_DIM; y += 1) {
              const relY = v0[1] + y - STARTER_TOWN_GROUND_Y;
              const level = inRiver
                ? harthmereRiverWaterLevelAt(authoredX, relY, authoredZ)
                : harthmereStillWaterLevelAt(authoredX, relY, authoredZ);
              if (level > 0) {
                values.set([x, y, z], level);
              }
            }
          }
        }
        water.assign(values);
      }
      return ShardWater.create(water.saveWrapped());
    }
  );

  const authored = {
    id,
    box: Box.create({ v0, v1 }),
    shard_seed: ShardSeed.create({ buffer }),
    // HARTHMERE_AUTHORED_WATER: for a shard that carries authored water, the
    // water IS authored terrain and travels with `shard_seed`.
    //
    // `terrainSeedEntityForWrite` only applies `mutableDefaults` on create, so
    // leaving shard_water there meant an ordinary additive deploy rewrote the
    // carved channel and left it dry — a trench the surface repair then filled
    // in. Promoting it to authored data is what makes the river survive a
    // deploy at all.
    //
    // The trade-off is deliberate and narrow: on these shards only, a player's
    // own water edits are re-flattened to the authored river. That is the same
    // contract the authored seed already has for terrain, and it applies to a
    // few dozen shards along the Brell rather than the whole town.
    ...(kind === "update" && shardHasAuthoredWater
      ? { shard_water: shardWater }
      : {}),
  };
  if (authoredWaterOnly) {
    if (kind !== "update") {
      throw new Error(
        "Authored-water-only migration requires an existing terrain shard."
      );
    }
    return {
      kind,
      tick,
      entity: { id, shard_water: shardWater },
    };
  }
  const mutableDefaults = {
    shard_diff: ShardDiff.create(),
    shard_shapes: ShardShapes.create(),
    shard_muck: ShardMuck.create({ buffer: muckBuffer }),
    shard_water: shardWater,
  };
  const entity = terrainSeedEntityForWrite({
    kind,
    mode: terrainSeedMigrationMode(),
    authored,
    mutableDefaults,
  });

  return kind === "create" ? { kind, tick, entity } : { kind, tick, entity };
}

/** Build one canonical Chapter 1 dungeon terrain shard. */
function makeLocalDevChapter1TerrainShard(
  voxeloo: VoxelooModule,
  kind: "create" | "update",
  id: BiomesId,
  shardX: number,
  shardY: number,
  shardZ: number,
  tick: number
): Change {
  const v0 = shardToVoxelPos(shardX, shardY, shardZ);
  const v1 = [v0[0] + SHARD_DIM, v0[1] + SHARD_DIM, v0[2] + SHARD_DIM] as [
    number,
    number,
    number,
  ];
  const materials = localDevMaterials() as unknown as Record<string, TerrainID>;

  const buffer = using(new voxeloo.VolumeBlock_U32(), (seedBlock) => {
    for (let z = 0; z < SHARD_DIM; z += 1) {
      for (let x = 0; x < SHARD_DIM; x += 1) {
        const worldX = v0[0] + x;
        const worldZ = v0[2] + z;
        const slot = ch1ElsewhenSlotAt([worldX, 0, worldZ] as never);
        if (!slot) {
          continue;
        }
        for (let y = 0; y < SHARD_DIM; y += 1) {
          const worldY = v0[1] + y;
          const local = ch1DungeonWorldToAuthored(slot.dungeonId, [
            worldX,
            worldY,
            worldZ,
          ]);
          const materialName = ch1DungeonBlockAt(
            slot.dungeonId,
            local.x,
            local.y,
            local.z
          );
          if (!materialName) {
            continue;
          }
          const terrainId = materials[materialName];
          if (!terrainId) {
            throw new Error(
              `Chapter 1 terrain material ${materialName} is not in localDevMaterials()`
            );
          }
          seedBlock.set(x, y, z, terrainId);
        }
      }
    }
    return saveBlock(voxeloo, seedBlock);
  });

  // New dungeon shards receive authored water. Existing shards retain their
  // live water component during overlay-preserving seed migrations.
  const shardWater = using(
    Tensor.make(voxeloo, [SHARD_DIM, SHARD_DIM, SHARD_DIM], "U8"),
    (water) => {
      const values = new Sparse3<number>([SHARD_DIM, SHARD_DIM, SHARD_DIM]);
      for (let z = 0; z < SHARD_DIM; z += 1) {
        for (let x = 0; x < SHARD_DIM; x += 1) {
          const worldX = v0[0] + x;
          const worldZ = v0[2] + z;
          const slot = ch1ElsewhenSlotAt([worldX, 0, worldZ] as never);
          if (!slot) {
            continue;
          }
          for (let y = 0; y < SHARD_DIM; y += 1) {
            const local = ch1DungeonWorldToAuthored(slot.dungeonId, [
              worldX,
              v0[1] + y,
              worldZ,
            ]);
            if (ch1DungeonWaterAt(slot.dungeonId, local.x, local.y, local.z)) {
              values.set([x, y, z], 15);
            }
          }
        }
      }
      water.assign(values);
      return ShardWater.create(water.saveWrapped());
    }
  );
  const muckBuffer = using(
    Tensor.make(voxeloo, [SHARD_DIM, SHARD_DIM, SHARD_DIM], "U8"),
    (muck) => muck.save()
  );
  const authored = {
    id,
    box: Box.create({ v0, v1 }),
    shard_seed: ShardSeed.create({ buffer }),
  };
  const mutableDefaults = {
    shard_diff: ShardDiff.create(),
    shard_shapes: ShardShapes.create(),
    shard_muck: ShardMuck.create({ buffer: muckBuffer }),
    shard_water: shardWater,
  };
  const entity = terrainSeedEntityForWrite({
    kind,
    mode: terrainSeedMigrationMode(),
    authored,
    mutableDefaults,
  });
  return { kind, tick, entity };
}

function resolveNpcTypeId(
  preferredNames: string[],
  fallbackIds: BiomesId[] = []
): BiomesId | undefined {
  // Harthmere local-dev townspeople must use the synthetic local-dev human
  // type. It is explicitly player-like, so named residents share the player's
  // animated mesh pipeline while their stable entity ids choose unique hair,
  // face, palette, clothing, and accessories.
  if (preferredNames.includes("local_dev_human")) {
    return LOCAL_DEV_HUMAN_NPC_TYPE_ID;
  }
  if (preferredNames.includes("local_dev_walker")) {
    return LOCAL_DEV_WALKER_NPC_TYPE_ID;
  }

  const preferred = getBiscuits("/npcs/types").find((biscuit) =>
    preferredNames.includes(biscuit.name)
  );
  if (preferred?.id && isNpcTypeId(preferred.id)) {
    return preferred.id;
  }
  return fallbackIds.find((id) => isNpcTypeId(id));
}

type StarterNpc = {
  id: BiomesId;
  preferredTypes: string[];
  fallbackTypes: BiomesId[];
  displayName: string;
  position: Vec3;
  orientation: Vec2;
  velocity?: Vec3;
  dialog: string;
  description: string;
  face: HarthmereVoxelFaceConfig;
  body: HarthmereVoxelBodyConfig;
};

function starterNpc(
  offset: number,
  displayName: string,
  position: Vec3,
  orientation: Vec2,
  dialog: string,
  description = "A local-dev Harthmere resident.",
  velocity?: Vec3
): StarterNpc {
  const curatedDialogue = harthmereAdditiveTownNpcDialogueForOffset(offset);
  return {
    id: (LOCAL_DEV_NPC_ID_BASE + offset) as BiomesId,
    preferredTypes: ["local_dev_human"],
    fallbackTypes: [LOCAL_DEV_HUMAN_NPC_TYPE_ID],
    displayName,
    position,
    orientation,
    velocity,
    dialog: curatedDialogue ? npcDialog(curatedDialogue.intro) : dialog,
    description,
    face: makeHarthmereNpcFaceConfig({
      id: (LOCAL_DEV_NPC_ID_BASE + offset) as BiomesId,
      name: displayName,
      roleHint: description,
    }),
    body: makeHarthmereNpcBodyConfig({
      id: (LOCAL_DEV_NPC_ID_BASE + offset) as BiomesId,
      name: displayName,
      roleHint: description,
    }),
  };
}

function starterWalkerNpc(
  offset: number,
  displayName: string,
  position: Vec3,
  orientation: Vec2,
  dialog: string,
  velocity?: Vec3
): StarterNpc {
  return {
    ...starterNpc(
      offset,
      displayName,
      position,
      orientation,
      dialog,
      "A walking town NPC.",
      velocity
    ),
    preferredTypes: ["local_dev_walker"],
    fallbackTypes: [LOCAL_DEV_WALKER_NPC_TYPE_ID, LOCAL_DEV_HUMAN_NPC_TYPE_ID],
  };
}

function npcDialog(...lines: string[]) {
  return lines.map((line) => `<text>${line}</text>`).join("{break}");
}

function starterTownNpcs(): StarterNpc[] {
  // NPC feet should sit on the authored ground/floor block. The previous +2
  // offset made several townspeople float above roads, shop floors, and paths.
  const y = STARTER_TOWN_GROUND_Y + 1;
  return [
    starterNpc(
      1,
      "Mira, Town Guide",
      [488, y, -205],
      [0, 3.15],
      npcDialog(
        "Welcome to Harthmere, traveler. Start with the Market Board beside the fountain; it tells new arrivals what to do next.",
        "A small house south-west of the square is kept for new residents; its hearth, storage, and upstairs ledger are ready for use.",
        "If you get lost, follow the colored signs: red for safety and law, blue for services, yellow for jobs, green for food and healing.",
        "The town is safe in the center, but the docks, drains, and old well are where the strange stories begin."
      ),
      "The guide for the local-dev starter town."
    ),
    starterNpc(
      2,
      "Bolt, Archive Robot",
      [505, y, -190],
      [0, 4.7],
      npcDialog(
        // Explain the science-fantasy/medieval tension in-world; these lines
        // replace former local-development and missing-asset diagnostics.
        "Archive note: Harthmere's oldest street plan shows repairs layered over repairs, as if the town has been rebuilding around one buried mistake.",
        "My frame makes residents uneasy. Harthmere distrusts robots, portals, and Exotic Matter, but the Reeve still permits an archivist that records without preaching.",
        "When my memory loses an image, I keep the account in words; history should survive the failure of any single machine or medium.",
        "The Market Board is my best public source because shortages, road closures, and private fear usually appear there before official histories admit them."
      ),
      "A robot archivist explaining the local-dev setup."
    ),
    starterNpc(
      3,
      "Toma, Builder",
      [504, y, -221],
      [0, 3.0],
      npcDialog(
        "Mind the roads. I have reset half these pavers after rain exposed hollows above the old drains.",
        "The important interiors now have props: counters, beds, shelves, barrels, vaults, hearths, and worktables.",
        "If a boot sinks near a threshold, check the drainage and foundation before blaming the traveler; the Underways make liars of solid-looking ground.",
        "My next inspection runs from the Market Board through every shop doorway and signpost, because small obstructions become dangerous in a crowded evacuation."
      ),
      "The builder standing by the workshop."
    ),
    starterNpc(
      4,
      "Pip, Harbor Mascot",
      [441, y, -202],
      [0, 1.5],
      npcDialog(
        "Peep! I am not an official guide, but even I know the Market Board is where new work starts.",
        "The baker gives good crumbs. The banker does not.",
        "The chickens are near the farm. They have formed no government yet.",
        "If the old well rings, I was never here."
      ),
      "A friendly town mascot near the market stalls."
    ),
    starterNpc(
      5,
      "Maren Dawnloaf, Baker",
      [434, y, -192],
      [0, 1.55],
      // HARTHMERE_PERF_AND_PLACEMENT — dialogue rewritten from the
      // Bellbound bible (III.3): she's a halfling, fourth-generation Loaf
      // family, best friends with Mara Thistle, quietly subsidizes the
      // chapel's bread for the Mudden Ward.
      npcDialog(
        "Four generations of Loafs have worked this oven. I am the fourth. Tomas is the fifth quietly. The children are negotiating.",
        "Mara Thistle is over in the market square calling me a thief. She means it lovingly. Mostly.",
        "Bring me clean orchard apples and the road cakes go out on time. Hungry guards lose stops on the patrol.",
        "Some of yesterday's loaves go to the chapel as 'leftovers.' Father Aldren has never once asked why a leftover is still warm."
      ),
      "Brenna 'Maren' Dawnloaf — fourth-generation halfling baker."
    ),
    starterNpc(
      6,
      "Banker Merl Voss",
      [550, y, -222],
      [0, 4.7],
      // v94 bible dialog (III.8): Northborn, came 30 years ago, immune to
      // charm, writes bad poetry no one knows about, descended from a
      // Bellbinder line he doesn't know.
      npcDialog(
        "Voss. Banker Merl Voss. I came down from the Northborn houses thirty years ago. I have been counting Harthmere's coin for twenty-eight.",
        "I have not made an accounting error in three years and one month. I keep a private tally. It is not for your reading.",
        "A lockbox left this counter and did not arrive at the courier desk. The interval was forty-three seconds. I have asked the Watch to be precise about precise things.",
        "I do not enjoy small talk. If your business is with the vault, the queue is in front of the counter. If your business is with me, it can be expressed in coin."
      ),
      "Merl Voss — Northborn banker, twenty-eight years at Harthmere's vault."
    ),
    starterNpc(
      7,
      "Brann, Weapons Teller",
      [532, y, -228],
      [0, 3.15],
      npcDialog(
        "Blades, cudgels, spearheads, and repair work. The Black Anvil keeps the Watch armed.",
        "If you are new, start with a training blade and learn where the Guard Yard stands.",
        "Master Osric says every tool has a memory. I say every dull sword has a fee.",
        "There is a work order on the Market Board for cold iron and hot tempers."
      ),
      "The weapons shopkeeper."
    ),
    starterNpc(
      8,
      "Luma, Healer",
      [456, y, -176],
      [0, 1.55],
      npcDialog(
        "Breathe. Sit. Let the shaking stop before you call it courage.",
        "The Green Mortar keeps salves, bandages, fever tea, and honest advice.",
        "The road herbs are thin this week. If you see willow bark or mint, bring it here.",
        "The chapel candles burn strangely when the old bell is heard under the stones."
      ),
      "The healing shop NPC."
    ),
    starterNpc(
      9,
      "Edrin Starling, Magic Supplier",
      [514, y, -168],
      [0, 4.7],
      npcDialog(
        "Welcome to the Wyrm and Candle. Do not touch the glowing crystal unless it touches you first.",
        "I sell chalk, candles, scrolls, crystals, and explanations nobody believes until too late.",
        "The old bridge carvings match symbols under the well. That should bother more people.",
        "If the Market Board sends you here, ask about the Missing Bell and keep your voice down."
      ),
      "The magic shop supplier."
    ),
    starterNpc(
      10,
      "Tilda Fen, Farmer",
      [444, y, -236],
      [0, 0.1],
      npcDialog(
        "The chickens are loose again. That is not a metaphor, though this town deserves one.",
        "The farm feeds the bakery, the tavern, and half the complaints at the market.",
        "If you find eggs outside the fence, bring them back before Pip starts a feast.",
        "The orchard road is safe by day. By night, keep to the lanterns."
      ),
      "The farmer watching the chicken yard."
    ),
    starterNpc(
      11,
      "Garrick, Bartender",
      [538, y, -194],
      [0, 4.7],
      npcDialog(
        "Welcome to the Copper Kettle. If you can still stand, you can still order.",
        "The stage is open, the hearth is warm, and every table has heard a lie worth repeating.",
        "Ask three patrons for rumors and you will learn which roads are trouble.",
        "If you need a room, speak to Elowen. If you need a secret, pay first."
      ),
      "The tavern bartender."
    ),
    starterNpc(
      12,
      "Jori, Dockhand",
      [550, y, -198],
      [0, 2.4],
      npcDialog(
        "The river is quiet when it wants you careless.",
        "Tovin tracks every crate, except the ones he very carefully does not track.",
        "There is a black crate on the lower pier that whispers in damp weather.",
        "If the Market Board says dock work is available, bring boots."
      ),
      "A tavern patron and dock worker."
    ),
    starterNpc(
      13,
      "Bela, Storyteller",
      [554, y, -190],
      [0, 3.4],
      npcDialog(
        "They say Harthmere began as a toll bridge and became a town by accident.",
        "They also say the chapel bell was buried, not stolen. That is the version people dislike.",
        "The old well rings during storms. Not loudly. Personally.",
        "Stories are warnings wearing nicer clothes."
      ),
      "A tavern patron with local lore."
    ),
    starterNpc(
      14,
      "Kip, Card Player",
      [546, y, -186],
      [0, 0.5],
      npcDialog(
        "I would deal you in, but the cards keep finding better hands.",
        "If you want easy coin, try courier work. If you want interesting coin, try the docks.",
        "The banker hates dice because dice do not respect ledgers.",
        "Ask Elowen about the cellar if you enjoy being told no."
      ),
      "A tavern card player."
    ),
    starterNpc(
      15,
      "Sola, Traveler",
      [538, y, -186],
      [0, 5.5],
      npcDialog(
        "I came looking for the old Biomes trails. Harthmere is smaller, but at least it answers back.",
        "The north road is good for beginners. The drains are not, whatever Nessa says.",
        "The Market Board has the least bad directions in town.",
        "If you hear a bell underground, pretend you did not until someone pays you."
      ),
      "A tavern traveler."
    ),
    starterNpc(
      16,
      "Mern, Tavern Bard",
      [558, y, -200],
      [0, 3.8],
      npcDialog(
        "I know one song: Ninety-eight Shards on the Wall. It is longer than the siege and twice as educational.",
        "The Copper Kettle stage is where rumors become public facts.",
        "A bard hears taxes, love, treason, and bad rhyme before breakfast.",
        "Bring me a true rumor and I will make it prettier."
      ),
      "A bard in the tavern."
    ),
    starterWalkerNpc(
      17,
      "Rowan, Walker",
      [486, y, -238],
      [0, 0.0],
      npcDialog(
        "I patrol the north road. If I stop moving, assume I found a good view.",
        "The new signs help. Before them, everyone asked the chickens for directions."
      ),
      [0.35, 0, 0]
    ),
    starterWalkerNpc(
      18,
      "Iva, Walker",
      [470, y, -210],
      [0, 1.57],
      npcDialog(
        "The plaza connects the important shops by design; market smoke, festival crowds, and frightened newcomers all need a route that remains readable.",
        "If you are new, read the Market Board before picking a road."
      ),
      [0, 0, 0.35]
    ),
    starterWalkerNpc(
      19,
      "Cade, Walker",
      [520, y, -210],
      [0, 4.71],
      npcDialog(
        "I walk between the bank and the weapons shop to make the town feel less empty.",
        "The blacksmith has opinions about bad steel and worse politics."
      ),
      [0, 0, -0.35]
    ),
    starterWalkerNpc(
      20,
      "Sera, Walker",
      [486, y, -178],
      [0, 3.14],
      npcDialog(
        "The healing shop and magic shop are both open. One fixes mistakes; the other causes them carefully.",
        "The chapel is quiet today. That usually means Aldren knows something."
      ),
      [-0.35, 0, 0]
    ),
    starterWalkerNpc(
      21,
      "Tess, Walker",
      [438, y, -210],
      [0, 1.2],
      npcDialog(
        "The bakery smells better than the archive. Do not tell Bolt I said that.",
        "Market work pays small, but it teaches the town."
      ),
      [0.25, 0, 0.25]
    ),
    starterWalkerNpc(
      22,
      "Niko, Walker",
      [558, y, -210],
      [0, 4.2],
      npcDialog(
        "The bank is mostly stone, optimism, and a very serious teller.",
        "Merl once frowned at a coin until it apologized."
      ),
      [-0.25, 0, -0.25]
    ),
    starterWalkerNpc(
      23,
      "Pera, Walker",
      [462, y, -250],
      [0, 0.8],
      npcDialog(
        "That two-level house is yours. Upstairs is for looking important; downstairs is for finding the door.",
        "There is a household ledger inside with the Market Board route copied on its first page, in case the square fogs over again."
      ),
      [0.2, 0, 0.3]
    ),
    starterWalkerNpc(
      24,
      "Olan, Walker",
      [532, y, -170],
      [0, 5.4],
      npcDialog(
        "The magic shop roof glows because someone insisted the town needed a landmark besides the tower.",
        "If the crystal hums, do not hum back."
      ),
      [-0.2, 0, -0.3]
    ),
    starterWalkerNpc(
      25,
      "Rin, Walker",
      [452, y, -232],
      [0, 2.1],
      npcDialog(
        "The chickens are near the farm. They are small, loud, and committed to their role.",
        "Tilda pays in eggs and blunt wisdom."
      ),
      [0.3, 0, -0.2]
    ),
    starterWalkerNpc(
      26,
      "Dax, Walker",
      [512, y, -236],
      [0, 0.2],
      npcDialog(
        "The weapons shop is south of the bank. The tavern is where everyone goes after pretending to work.",
        "The Guard Yard has dummies if you need to hit something legal."
      ),
      [-0.3, 0, 0.2]
    ),
    starterNpc(
      27,
      "Sergeant Bram Holt",
      [486, y, -277],
      [0, 3.14],
      // v94 bible dialog (III.2): Riverlander, 47, widower, daughter Yenna
      // chronically ill, takes small bribes for her medicine, never told a
      // soul, has a hidden ledger, slow to anger, treats new recruits with
      // patience. Slightly more honest tone than the stock dialog.
      npcDialog(
        "Bram Holt. Sergeant of the gate, twenty-three years. State your name and your business and I will write you into the ledger.",
        "Harthmere is a town that opens its gate before it opens its mind. Read the Market Board, then go to Walt at the Guard Yard if you want patrol work.",
        "I have buried more friends than the Reeve has signed proclamations. Treat the people in this town like they could be next.",
        "My daughter is in the apothecary. If you ever need a favor from me, that is the only one I will not say no to. Quietly."
      ),
      "Sergeant Bramwell 'Bram' Holt — 47, widower, twenty-three years at the gate."
    ),
    starterNpc(
      28,
      "Mara Thistle",
      [440, y, -200],
      [0, 1.2],
      // v94 bible dialog (III.3): widowed at 29, two sons, sharpest eye for
      // a cheat in five miles, informal spymaster, refused the Compact's
      // grain price-fixing scheme.
      npcDialog(
        "Mara Thistle. Stall belonged to my mother, and her mother, and one of the seven things I will die before letting Edrik Vane own.",
        "Buy two onions and I might tell you who crossed the bridge after midnight. Buy a turnip and I will throw in advice you did not ask for.",
        "Bread, bank, blade, blessing. Learn those four stops in that order and Harthmere stops feeling like a maze.",
        "Brenna over at Dawn Loaf is my best friend and a thief. She steals my customers. We have a system."
      ),
      "Mara Thistle — market vendor, widowed at 29, knows everyone's name and most of their secrets."
    ),
    starterNpc(
      29,
      "Master Osric Vale",
      [506, y, -220],
      [0, 4.7],
      // v94 bible dialog (III.4): 64, widower, son in capital, apprentice
      // Luth, fifth-generation smith, quietly carries the Bell secret from
      // his father, fought as a caravan guard in youth.
      npcDialog(
        "Osric Vale. The forge has been Vale-run for five generations. I am the fifth. Luth, my apprentice, is not blood but he will be the sixth if he stays.",
        "Tell me what is broken. Plow blade, dagger, hinge. I do not ask why. I ask how much it needs to last.",
        "I fought as a caravan guard in my youth. Three men. I do not enjoy remembering them. Mention it once and I will give you a fair price. Mention it twice and I will give you the door.",
        "If you come asking about an old bell — sit down. We will talk after I close the shutters."
      ),
      "Master Osric Vale — 64, widower, fifth-generation smith of the Black Anvil."
    ),
    starterNpc(
      30,
      "Elowen Pike",
      [545, y, -192],
      [0, 4.7],
      // v94 bible dialog (III.6): 58, widowed at 27, hides fugitives in the
      // cellar a few times a year, quietly in love with Father Aldren for
      // sixteen years, calls everyone "love."
      npcDialog(
        "Elowen Pike, love. Copper Kettle is mine for thirty-three years and counting, and I have heard every kind of trouble walk through that door.",
        "Order the stew. If you want a room, Tisa has the key. If you want to talk about anything heavier than the stew, sit by the fire and I will come find you.",
        "I hold rooms for travelers. I hold secrets for friends. I have only ever confused the two on purpose.",
        "Father Aldren is at the chapel. He keeps strange hours these last three years. Tell him Elowen says to eat something warm."
      ),
      "Mistress Elowen Pike — 58, widowed innkeeper of the Copper Kettle."
    ),
    starterNpc(
      31,
      "Father Aldren",
      [477, y, -139],
      [0, 3.14],
      // v94 bible dialog (III.5): 53, half-elven (quarter elven), inherited
      // the chapel from Mother Halene three years ago, has spent that time
      // privately panicking about the buried bell, failing alone.
      npcDialog(
        "Aldren. Father Aldren Mell. Mother Halene was the priest before me. I have been trying to fill her shoes for three years and I am not yet succeeding.",
        "Light a candle if you mean to leave town. The roads do not care about prayer, but the priest does.",
        "There is a sound under this chapel that I cannot quite hear and cannot quite stop. I have not told the town. I am telling you because you asked.",
        "Sister Maelle is the bright one. If I am out, ask her. If she is out, sit in the pews. Saint Verena listens whether you believe she does or not."
      ),
      "Father Aldren Mell — 53, half-elven priest of Saint Verena's chapel."
    ),
    starterNpc(
      32,
      "Reeve Caldus Merrow",
      [564, y, -262],
      [0, 3.14],
      // v94 bible dialog (III.3): hereditary office, 21 years served, hiding
      // tax irregularities, suspects Vane runs the Compact, loves his
      // daughter Lila who's seeing a Mudden Ward boy.
      npcDialog(
        "Reeve Caldus Merrow. My great-grandfather held this office. So did my father. So will my son, if the bridge still stands when his time comes.",
        "Order is expensive. People who complain about taxes have rarely costed out a year of chaos. I have. The bill comes due in funerals.",
        "If you came for permits, speak to my clerk Iven. If you came with rumors about the Compact, speak quietly, and only once.",
        "My daughter is a better person than I am. That is the one thing about this house I will not let the Compact ruin."
      ),
      "Reeve Caldus Merrow — 52, hereditary office-holder, 21 years on the bench."
    ),
    starterNpc(
      33,
      "Nessa Crowe",
      [404, y, -160],
      [0, 1.57],
      // v94 bible dialog (III.7): Mudden Ward rat-catcher and guide, knows
      // the drain tunnels intimately.
      npcDialog(
        "Nessa Crowe. I catch rats for the chapel and watch drains for the people the Reeve does not see.",
        "You walk like someone who has never been chased by three dogs and a landlord. That is fine. The drains will teach you fast.",
        "Children hear the old bell first because adults are better at lying to themselves about what they heard.",
        "If the Market Board sends you to the Old Well, bring a light, a knife, and fewer assumptions than you currently have."
      ),
      "Nessa Crowe — Mudden Ward rat-catcher and drain guide."
    ),
    starterNpc(
      34,
      "Tovin Reed",
      [579, y, -183],
      [0, 1.57],
      // v94 bible dialog (III.4): 49, dockmaster, married to Mira, two
      // daughters (Lina dreams of "the lady in the river"), keeps two
      // ledgers, secretly River Knots, terrified about Lina's dreams.
      npcDialog(
        "Tovin Reed. Dockmaster fourteen years. River takes who the river takes. I would rather it not take any of mine.",
        "I keep two ledgers and one secret. The ledgers are mostly honest. The secret is that my eight-year-old has been dreaming of a lady in the river. She is not making it up.",
        "If a black crate shows up on the lower pier and nobody owns it, that is not mine. If you ask twice, that is still not mine.",
        "Bram and I have an understanding. Do not ask him about it. Do not ask me about it. The understanding is the point."
      ),
      "Master Tovin Reed — 49, dockmaster, husband to Mira, father to Lina and Sora."
    ),
    starterNpc(
      35,
      "Lysa, Cloth Merchant",
      [532, y, -202],
      [0, 2.0],
      npcDialog(
        "Burgundy cloth for market days, gray wool for honest work, and a hood if you would rather not be noticed.",
        "The Merchant Compact loves rules until rules cost them money.",
        "If you need dye, check Craftsman Row. If you need gossip, stay here."
      ),
      "A merchant selling cloth and rumors."
    ),
    starterNpc(
      36,
      "Perrin, Moneylender",
      [556, y, -226],
      [0, 4.2],
      npcDialog(
        "Debt is only frightening to those who pretend promises are lighter than iron.",
        "The bank stores valuables. I store leverage.",
        "A missing lockbox is a tragedy. A missing ledger is an opportunity."
      ),
      "A moneylender watching the bank door."
    ),
    starterNpc(
      37,
      "Old Jory",
      [431, y, -112],
      [0, 0.6],
      npcDialog(
        "Apples grow sweeter near old trouble.",
        "The orchard remembers the bridge tax riot better than the reeve does.",
        "Bring the baker good apples and she will send you away heavier than you came."
      ),
      "A farmer from the apple fields."
    ),
    starterNpc(
      38,
      "Mirel, Gravekeeper",
      [518, y, -137],
      [0, 3.8],
      npcDialog(
        "The dead do not mind visitors. They mind thieves, liars, and people who whistle near the crypt wall.",
        "Someone has been leaving wet footprints near dry graves.",
        "A missing bell is bad. A buried bell is worse."
      ),
      "The quiet keeper of the chapel graveyard."
    ),
    starterNpc(
      39,
      "Rusk, Toll Clerk",
      [482, y, -280],
      [0, 0.0],
      npcDialog(
        "One copper to cross, two if your cart wheel squeaks, and nothing if Sergeant Holt is glaring at me.",
        "The bridge tax is legal. Popular is a different question.",
        "I just write the numbers. Please direct threats to the office with better curtains."
      ),
      "A nervous toll clerk beneath the north gate."
    ),
    starterNpc(
      40,
      "Sable, Smuggler",
      [399, y, -235],
      [0, 1.57],
      npcDialog(
        "The underways are just drains to honest folk. To everyone else, they are doors without hinges.",
        "If you want clean work, ask the Market Board. If you want useful work, ask quieter.",
        "The old well has bars for a reason. The reason is not safety."
      ),
      "A suspicious figure near the old drain tunnel."
    ),
    starterNpc(
      41,
      "Harthmere Market Board",
      [503, y, -209],
      [0, 3.14],
      npcDialog(
        "MARKET BOARD: New arrivals should begin with Welcome to Harthmere.",
        "Available work: bakery apples, missing lockbox, cold iron, fever tea, tavern rumors, loose chickens, whispering crate, and Missing Bell inquiry.",
        "Suggested path: read this board, ask Mara, visit Smithy, Bank, Inn, Chapel, North Gate, Guard Yard, then choose Farms, Docks, or Old Drains.",
        "Clerks copy urgent notices here at dawn, and I keep the older layers posted long enough for travelers to see which troubles refuse to stay solved."
      ),
      "A quest board covered in notices, arrows, and beginner work."
    ),
    starterNpc(
      42,
      "Town Crier Pell",
      [499, y, -207],
      [0, 3.14],
      npcDialog(
        "Hear ye, hear ye! Newcomers should read the Market Board before bothering the baker, banker, or birds.",
        "Daily writs are posted beside the fountain. Honest coin for honest confusion.",
        "The chapel bell remains missing. Reeve Hall insists this is not news.",
        "If you cannot find your next objective, come back to the board."
      ),
      "A loud town crier standing beside the Market Board."
    ),
    starterNpc(
      43,
      "Courier Anwen",
      [552, y, -216],
      [0, 4.7],
      npcDialog(
        "Mail for the bank, letters for the chapel, notices for the docks. I run because everyone else waits.",
        "Courier jobs teach the town faster than any map.",
        "If a package whispers, deliver it to Tovin and then forget my name."
      ),
      "The courier for mail and delivery work."
    ),
    starterNpc(
      44,
      "Drill Instructor Hal",
      [512, y, -266],
      [0, 3.14],
      // v94: in the bible canon the drill instructor is "Walt the Cudgel"
      // Ormsby (III.2). Anti-bullying, refused to charge the crowd at the
      // Bridge Tax Riot, buys boots for Mudden Ward children from his pay.
      npcDialog(
        "Hal, lad. Drill Instructor for the better part of the last twenty winters. Bram sends recruits to me when they need either discipline or a quiet morning.",
        "Feet apart. Eyes forward. Hit the dummy, not the quartermaster, and on no account hit a citizen who is not also hitting you.",
        "I refused to charge the crowd during the Bridge Tax Riot. Bram knows. The Reeve suspects. I do not regret it. Recruits ask me about it; I tell them it is not their question to ask yet.",
        "If you see a Mudden Ward child without boots when winter comes, walk past me on the way to the cobbler and I will pretend I dropped a few coins."
      ),
      "Drill Instructor Hal — anti-bullying, anti-charge, anti-cold-feet. Thirty-nine years in the Watch."
    ),
    starterNpc(
      45,
      "Bounty Clerk Rowan",
      [518, y, -262],
      [0, 3.14],
      npcDialog(
        "Bounties are posted by threat, distance, and how likely you are to come back complaining.",
        "Rats count. Bandits count more. Grave robbers count only if they are still breathing.",
        "The first bounty is usually a lesson, not a fortune."
      ),
      "The clerk for bounties and patrol work."
    ),
    starterNpc(
      46,
      "Sister Maelle",
      [486, y, -136],
      [0, 3.14],
      // v94 bible dialog (III.5): 31, southern merchant family she's
      // estranged from, six years under Aldren, secretly in love with
      // Helna Voss, has been reading about pre-Verenine faiths.
      npcDialog(
        "Maelle Frenn. I came north from the southern bishopric six years ago. Father Aldren took me on. I have not been home since.",
        "Charity is posted on the chapel door — food rounds, bandage runs, candle deliveries. Pick one. Saint Verena prefers volunteers to apologists.",
        "Father Aldren carries something he will not name. I have stopped asking him directly. He answers obliquely or not at all.",
        "If you see Helna Voss in the leather shop, tell her I will bring the lamps by tonight. Just that. Nothing more."
      ),
      "Sister Maelle Frenn — 31, six years under Father Aldren, the chapel's most promising cleric."
    ),
    starterNpc(
      47,
      "Ysabet Fenlow",
      [458, y, -172],
      [0, 4.7],
      npcDialog(
        "The correct dose is the difference between remedy, poison, and paperwork.",
        "Fever tea needs willow bark, mint, and clean water. The clean water is somehow the hardest part.",
        "People call magic suspicious until they need medicine."
      ),
      "The apothecary of the Green Mortar."
    ),
    starterNpc(
      48,
      "Garrik Fen",
      [504, y, -216],
      [0, 4.7],
      // v94 bible dialog (III.4): 51, married to Jansa the midwife, four
      // children, irrepressibly cheerful, cannot keep a secret.
      npcDialog(
        "Garrik Fen. Carpenter. Four children, one wife, one workshop, and one promise I keep failing — which is keeping any secret you give me.",
        "I build crates, handles, signs, and the bridges nobody thanks me for until they fall apart.",
        "If you tell me a rumor, I will hear it twice in the market by sundown. I did not do that on purpose. It just happens.",
        "I have been carving little wooden bells for the chapel altar lately. Do not ask me why. I am not entirely sure."
      ),
      "Master Garrik Fen — 51, Craftsman Row carpenter, irrepressible father of four."
    ),
    starterNpc(
      49,
      "Helna Voss",
      [499, y, -225],
      [0, 3.14],
      npcDialog(
        "Boots, belts, straps, waterskins. Leather keeps the town moving when iron cannot.",
        "The stable owes me coin. The bank says it is a process. I say it is theft with chairs.",
        "Bring hides later and I will teach you which cuts survive rain."
      ),
      "A leatherworker."
    ),
    starterNpc(
      50,
      "Selka Weaver",
      [455, y, -194],
      [0, 1.57],
      npcDialog(
        "Cloth tells class before a mouth opens.",
        "I keep banners for guilds, aprons for bakers, and hoods for people with too much history.",
        "Red-and-black means Watch. Green shutters mean money. Mud means Mudden Ward got ignored again."
      ),
      "A tailor and banner maker."
    ),
    starterNpc(
      51,
      "Ferry Master Wren",
      [592, y, -184],
      [0, 1.57],
      // v94 dialog: in the bible canon (III.10) the ferry master is Henrick
      // Brell. Wren keeps the name role active without violating the
      // bible's full character. Generic-but-grounded.
      npcDialog(
        "Wren of the Brell ferry line. We have run this stretch of river since before the bridge was hers.",
        "The ferry runs when the river permits and when Tovin Reed stops arguing with the manifest. Two conditions, not one.",
        "Boat travel for new arrivals will open later. For now, learn the docks. Keep your hands out of black water.",
        "Fog makes fools brave. River takes the brave first. Mostly."
      ),
      "Ferry Master Wren — keeper of the Brell ferry, partner-in-arguments with Tovin Reed."
    ),
    starterNpc(
      52,
      "Mudden Child Lio",
      [418, y, -156],
      [0, 1.57],
      npcDialog(
        "Nessa says not to talk to strangers unless they look lost enough to help.",
        "The drains have voices. The grown-ups call them echoes.",
        "If you find a red ribbon near the well, do not keep it."
      ),
      "A child from Mudden Ward."
    ),
    starterNpc(
      53,
      "Washerwoman Cale",
      [424, y, -152],
      [0, 1.57],
      npcDialog(
        "Laundry tells the truth. Blood, river mud, perfume, ash. Nobles pay extra to pretend it does not.",
        "The ward floods first and gets repaired last.",
        "If you want to help, bring soup, not speeches."
      ),
      "A Mudden Ward washerwoman."
    ),
    starterNpc(
      54,
      "Tax Clerk Iven",
      [555, y, -260],
      [0, 3.14],
      npcDialog(
        "Permits require a stamp, a fee, and patience measured in geologic time.",
        "The reeve is available never. I am available unfortunately.",
        "If your complaint concerns the bridge tax, take a number and lower your expectations."
      ),
      "A clerk in Reeve Hall."
    ),
    starterNpc(
      55,
      "Noble Servant Rose",
      [570, y, -258],
      [0, 3.14],
      npcDialog(
        "The gardens are trimmed, the brass is polished, and everyone downstairs is pretending not to hear the protests.",
        "Servants know which doors are locked and which locks are decorative.",
        "Reeve Hall has more windows than honesty."
      ),
      "A servant in Noble Rise."
    ),
    starterNpc(
      56,
      "Guard Quartermaster Tarrow",
      [504, y, -262],
      [0, 3.14],
      npcDialog(
        "If it has a point, edge, strap, or dent, I inventory it.",
        "Do not borrow Watch equipment unless you enjoy being counted as missing property.",
        "Osric repairs the serious damage. I assign blame for the rest."
      ),
      "The Guard Yard quartermaster."
    ),
    starterNpc(
      57,
      "Traveling Merchant Ossa",
      [528, y, -202],
      [0, 2.4],
      npcDialog(
        "Today I sell rope, maps, chalk, whistles, and optimism by the yard.",
        "Bridge Day brings better stock if the roads stay clear.",
        "If you cannot afford a compass, follow the loudest argument."
      ),
      "A traveling market merchant."
    ),
    starterNpc(
      58,
      "Food Vendor Marae",
      [443, y, -197],
      [0, 1.2],
      npcDialog(
        "Hot onions, seed cakes, and cider. Cheap enough to regret twice.",
        "The Market Board sends hungry travelers everywhere except lunch.",
        "A good meal is a minor blessing with better smell."
      ),
      "A market food vendor."
    ),
    starterNpc(
      59,
      "Guild Registrar Wyne",
      [550, y, -218],
      [0, 4.7],
      npcDialog(
        "Guild names must be legible, non-treasonous, and not already claimed by someone louder.",
        "Recruitment notices belong on the board wall, not nailed to my chair.",
        "Crests cost extra because artists eat too."
      ),
      "The guild registrar in the services area."
    ),
    starterNpc(
      60,
      "Auction Clerk Pellam",
      [556, y, -218],
      [0, 4.7],
      npcDialog(
        "Listing fees first. Complaints second. Regret is handled by appointment only.",
        "The market board teaches work. The auction board teaches consequences.",
        "Do not list haunted crates without disclosure."
      ),
      "The auction and trade clerk."
    ),
    starterNpc(
      61,
      "Rat Catcher Dima",
      [406, y, -162],
      [0, 1.57],
      npcDialog(
        "Rats are honest. They bite, steal, and run without inventing laws about it.",
        "Nessa knows the drains. I know which drains know back.",
        "Rat-catching is posted daily because rats are punctual criminals."
      ),
      "A Mudden Ward rat-catcher."
    ),
    starterNpc(
      62,
      "Bell-Witness Ora",
      [484, y, -188],
      [0, 3.14],
      npcDialog(
        "I heard the bell at dawn. Nobody believes an old woman until the stone starts singing under their own feet.",
        "The sound came from below the square, not the chapel.",
        "Read the board. Follow the candles. Do not go alone after the third ring."
      ),
      "An old witness near the well."
    ),
    starterNpc(
      63,
      "Apple Picker Ren",
      [462, y, -112],
      [0, 0.6],
      npcDialog(
        "The baker wants apples without wormholes, bruises, or ghost stories.",
        "The orchard road is pretty. That is how roads trick you.",
        "Old Jory says trees remember. I say they drop things on my head."
      ),
      "An apple picker in the orchard."
    ),
    starterNpc(
      64,
      "Stablehand Corin",
      [432, y, -260],
      [0, 0.6],
      npcDialog(
        "The stable is small today, but the travel system has ambitions.",
        "Feed the mule before judging it. Same advice works on guards.",
        "This yard sends riders toward the farms, road posts, and ferry landings; each route needs a different horse and a different warning."
      ),
      "A stablehand near the south-west road."
    ),
    starterNpc(
      65,
      "River Knots Lookout",
      [602, y, -176],
      [0, 4.7],
      npcDialog(
        "Pretty docks, ugly secrets.",
        "If Tovin says a crate is boring, count your fingers after touching it.",
        "Legal work is on the Market Board. Better stories are found after sunset."
      ),
      "A suspicious dock lookout."
    ),
    starterNpc(
      66,
      "Chapel Choir Child",
      [470, y, -134],
      [0, 3.14],
      npcDialog(
        "We sing softer since the bell went missing.",
        "Father says silence can be holy. I think he is scared of echoes.",
        "Sister Maelle lets me light candles if I do not drip wax on the floor."
      ),
      "A child in the chapel choir."
    ),
    starterNpc(
      67,
      "Forge Apprentice Luth",
      [526, y, -225],
      [0, 3.14],
      // v94 bible dialog (III.4): 19, orphan found at the gate at 11,
      // raised by Osric, remembers a woman singing in an unknown language,
      // keeps a bronze talisman hidden, reads three languages.
      npcDialog(
        "Luth. Apprentice eight years now. Master Osric is the closest thing I have to a father, which by coincidence is also exactly what he is.",
        "Beginner work order is nails, hinges, and the patience to do them properly. I will not skip you to a blade because you asked nicely.",
        "I read more than I talk. Three languages so far, two of them poorly. Sometimes a fourth comes to me in dreams and I cannot place it.",
        "If you find anything that bears a small spiral sigil, do not tell Master Osric. Bring it to me. Quietly."
      ),
      "Apprentice Luth — 19, orphan, eight years at the Black Anvil."
    ),
    starterNpc(
      68,
      "Bakery Apprentice Noll",
      [426, y, -188],
      [0, 1.55],
      npcDialog(
        "I burned the first batch, underbaked the second, and named the third progress.",
        "Maren says road bread should be hard enough to travel but soft enough to forgive.",
        "The apple quest is real. Please choose apples that have not fought back."
      ),
      "A bakery apprentice."
    ),
    starterNpc(
      69,
      "Market Guard Sen",
      [448, y, -206],
      [0, 1.2],
      npcDialog(
        "Keep the path clear. The square handles pilgrims, carts, stalls, and more bad decisions than the watch ledger has room to describe.",
        "The board is watched. So are the pockets near it.",
        "If a riot starts, stand behind the fountain unless you are useful."
      ),
      "A guard assigned to the market."
    ),
    starterNpc(
      70,
      "Underways Echo",
      [402, y, -235],
      [0, 1.57],
      npcDialog(
        "The bars are new. The stones are not.",
        "Something below remembers the bell by name.",
        "This entrance should unlock through the Missing Bell chain, not by wandering in blind."
      ),
      "A strange whisper near the sealed underways entrance."
    ),
  ];
}

const SNAPSHOT_GROVE_COMBAT_NO_HARTHMERE_OFFSET =
  "snapshot-grove-combat-no-harthmere-offset";

function makeLocalDevSnapshotCombatNpcChanges(
  tick: number,
  existingIds: Set<BiomesId>
) {
  const now = secondsSinceEpoch();
  const changes: Change[] = [];
  const typeId = isNpcTypeId(BikkieIds.dMucker)
    ? BikkieIds.dMucker
    : LOCAL_DEV_HUMAN_NPC_TYPE_ID;

  for (const spawn of SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS) {
    const id = (Number(LOCAL_DEV_NPC_ID_BASE) + spawn.idOffset) as BiomesId;
    const entity = npcEntity(
      {
        id,
        typeId,
        // SNAPSHOT_COMBAT_MUCKER_GROUNDING_VERSION:
        // Combat Muckers/Hexers are dMucker-style hostile creatures with their
        // own damageable health/interaction body. They live on the authored
        // wilds/muck terrain layer, not the raised Grove fountain courtyard, so
        // do not use snapshotGroveGroundedPosition here.
        position: snapshotCombatRuntimeGroundedPosition(spawn.authoredPosition),
        orientation: [0, 0],
        velocity: [0, 0, 0],
        displayName: spawn.displayName,
        defaultDialog: spawn.defaultDialog,
      },
      now
    );
    changes.push({
      kind: existingIds.has(id) ? "update" : "create",
      tick,
      entity: {
        ...entity,
        entity_description: EntityDescription.create({
          text: `SNAPSHOT_COMBAT_RUNTIME ${spawn.profile} ${spawn.areaId} leash=${spawn.leashRadius}`,
        }),
      },
    });
  }
  return changes;
}

function makeLocalDevSnapshotGroveNpcChanges(
  tick: number,
  existingIds: Set<BiomesId>
) {
  const now = secondsSinceEpoch();
  const changes: Change[] = [];
  for (const npc of SNAPSHOT_GROVE_NPCS) {
    if (!npc.seedServerNpc) {
      continue;
    }
    const id = snapshotGroveNpcEntityId(npc);
    const kind = existingIds.has(id) ? "update" : "create";
    const typeId =
      npc.id === "mucked_robot" && isNpcTypeId(BikkieIds.dMucker)
        ? BikkieIds.dMucker
        : LOCAL_DEV_HUMAN_NPC_TYPE_ID;
    const description = `${SNAPSHOT_GROVE_NPC_GROUNDING_VERSION} ${npc.shortDescription} ${npc.role}`;
    const appearance = makeHarthmereNpcAppearanceConfig({
      id,
      name: npc.displayName,
      roleHint: npc.role,
      forwardAxis: "minusZ",
      source: "snapshot-grove-npc-seed",
    });
    let base = npcEntity(
      {
        id,
        typeId,
        // v75 compatibility marker: snapshotGroveGroundedPosition(npc.authoredPosition)
        position: snapshotGroveRuntimeGroundedPosition(npc.authoredPosition),
        orientation: npc.orientation ?? [0, 3.14],
        velocity: [0, 0, 0],
        displayName: npc.displayName,
        defaultDialog: npcDialog(npc.line, ...npc.extraLines),
        // Match the production Grove seeder: named quest NPC homes are exact,
        // while per-player story movement belongs to the staging projection.
        spawnPositionJitterRadius: 0,
      },
      now
    );
    if (typeId === LOCAL_DEV_HUMAN_NPC_TYPE_ID && !npc.snapshotAsset) {
      // Match the live seeder: no-asset Grove humans use the player/Grove
      // avatar mesh pipeline with deterministic per-id cosmetics. Updates must
      // explicitly remove the old defaults or production keeps the same bald,
      // tattered NPC appearance even after a reseed.
      base = prepareHarthmerePlayerLikeNpcForUniqueAppearance(base, kind);
    }
    const entity = {
      ...base,
      entity_description: EntityDescription.create({
        text: withHarthmereAppearanceMarker(
          withHarthmereBodyAndFaceMarkers(
            description,
            appearance.face,
            appearance.body
          ),
          appearance
        ),
      }),
      quest_giver: QuestGiver.create({
        concurrent_quests: 1,
        concurrent_quest_dialog: npcDialog(npc.line),
      }),
    };
    changes.push({
      kind,
      tick,
      entity,
    });
  }
  return changes;
}

function ch1SeedPlacement(member: (typeof CH1_NEW_CAST)[number]): Vec3 {
  if (member.placement) {
    return [...member.placement] as Vec3;
  }
  switch (member.key) {
    case "iris_fen":
      return ch1DungeonAuthoredToWorld("ch1_dungeon_desert", {
        x: 386,
        y: -20,
        z: -56,
      });
    case "marrow":
      return ch1DungeonAuthoredToWorld("ch1_dungeon_desert", {
        x: 391,
        y: -20,
        z: -52,
      });
    case "nadia_sorrel":
      return ch1DungeonAuthoredToWorld("ch1_dungeon_winter", {
        x: 308,
        y: 1,
        z: -88,
      });
    case "hallr_ironmouth":
      return ch1DungeonAuthoredToWorld("ch1_dungeon_winter", {
        x: 384,
        y: 1,
        z: -88,
      });
  }
  throw new Error(`Chapter 1 NPC ${member.key} has no seed placement`);
}

/**
 * Seed the Chapter 1 identities as real synchronized NPC entities.
 *
 * AUGUR-9 is deliberately NOT in this set. It is the snapshot Mucked Robot,
 * already seeded by the Grove seeder, and writing a second body here is exactly
 * the duplicate the promotion exists to remove.
 */
function makeLocalDevChapter1NpcChanges(
  tick: number,
  existingIds: Set<BiomesId>
) {
  const now = secondsSinceEpoch();
  const castChanges = CH1_SEEDED_CAST.map((member): Change => {
    const kind = existingIds.has(member.entityId) ? "update" : "create";
    const preferredTypes =
      member.key === "augur9"
        ? ["biomesRobot", "dRobot"]
        : member.key === "marrow"
          ? ["dog", "wolf", "rabbit"]
          : ["local_dev_human"];
    const fallbackTypes =
      member.key === "augur9" && isNpcTypeId(BikkieIds.biomesRobot)
        ? [BikkieIds.biomesRobot]
        : [LOCAL_DEV_HUMAN_NPC_TYPE_ID];
    const typeId =
      resolveNpcTypeId(preferredTypes, fallbackTypes) ??
      LOCAL_DEV_HUMAN_NPC_TYPE_ID;
    let base = npcEntity(
      {
        id: member.entityId,
        typeId,
        position: ch1SeedPlacement(member),
        orientation: [0, Math.PI],
        velocity: [0, 0, 0],
        displayName: member.displayName,
        defaultDialog: npcDialog(member.sampleLine || member.role),
      },
      now
    );
    if (typeId === LOCAL_DEV_HUMAN_NPC_TYPE_ID) {
      base = prepareHarthmerePlayerLikeNpcForUniqueAppearance(base, kind);
    }
    return {
      kind,
      tick,
      entity: {
        ...base,
        entity_description: EntityDescription.create({
          // Do not attach Harthmere's procedural voxel-face marker to Chapter
          // 1 humans. `local_dev_human` is a player-like NPC type and must use
          // the same snapshot appearance mesh path as the original May world.
          text: `${CH1_DUNGEON_TERRAIN_VERSION} ${member.faction} ${member.role}`,
        }),
        quest_giver: QuestGiver.create({
          concurrent_quests: 1,
          concurrent_quest_dialog: npcDialog(member.sampleLine || member.role),
        }),
      },
    };
  });
  const hostileTypeId = isNpcTypeId(BikkieIds.dMucker)
    ? BikkieIds.dMucker
    : LOCAL_DEV_WALKER_NPC_TYPE_ID;
  const encounterChanges = CH1_DUNGEON_ENCOUNTER_NPCS.map(
    (encounter): Change => {
      const kind = existingIds.has(encounter.entityId) ? "update" : "create";
      const base = npcEntity(
        {
          id: encounter.entityId,
          typeId: hostileTypeId,
          position: [...encounter.position],
          orientation: [0, Math.PI],
          velocity: [0, 0, 0],
          displayName: encounter.displayName,
          defaultDialog: npcDialog("It does not answer."),
        },
        now
      );
      return {
        kind,
        tick,
        entity: {
          ...base,
          health: Health.create({
            hp: encounter.maxHp,
            maxHp: encounter.maxHp,
          }),
          ...(encounter.size
            ? { size: Size.create({ v: encounter.size }) }
            : {}),
          entity_description: EntityDescription.create({
            text: `${CH1_DUNGEON_TERRAIN_VERSION} CH1_ENCOUNTER ${encounter.dungeonId} ${encounter.encounterId} ${encounter.objectiveId}`,
          }),
        },
      };
    }
  );
  return [
    ...castChanges,
    ...makeLocalDevChapter1TestimonyNpcChanges(tick, existingIds),
    ...encounterChanges,
  ];
}

function makeLocalDevChapter1TestimonyNpcChanges(
  tick: number,
  existingIds: Set<BiomesId>
): Change[] {
  const now = secondsSinceEpoch();
  const testimonyChanges = CH1_TESTIMONY_NPC_SEEDS.map((seed): Change => {
    const kind = existingIds.has(seed.entityId) ? "update" : "create";
    let base = npcEntity(
      {
        id: seed.entityId,
        typeId: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
        position: [...seed.position],
        orientation: [0, Math.PI],
        velocity: [0, 0, 0],
        displayName: seed.displayName,
        defaultDialog: npcDialog(seed.line),
        // Testimony witnesses are authored interaction posts, not ambient
        // walkers. Keep Anima's home/respawn anchor on the exact route post.
        spawnPositionJitterRadius: 0,
      },
      now
    );
    if (!seed.preserveSnapshotAppearance) {
      base = prepareHarthmerePlayerLikeNpcForUniqueAppearance(base, kind);
    }
    return {
      kind,
      tick,
      entity: {
        ...base,
        entity_description: EntityDescription.create({
          text: `${CH1_TESTIMONY_NPC_SEED_VERSION} grove witness ${seed.role}`,
        }),
        ...(seed.questGiver
          ? {
              quest_giver: QuestGiver.create({
                concurrent_quests: 1,
                concurrent_quest_dialog: npcDialog(seed.line),
              }),
            }
          : {}),
      },
    };
  });
  const duplicateDeletes: Change[] =
    CH1_RETIRED_DUPLICATE_TESTIMONY_NPC_IDS.filter((id) =>
      existingIds.has(id)
    ).map((id) => ({ kind: "delete", tick, id }));
  return [...duplicateDeletes, ...testimonyChanges];
}

function localDevChapter1NpcIds() {
  return [
    ...CH1_SEEDED_CAST.map((member) => member.entityId),
    ...CH1_TESTIMONY_NPC_SEEDS.map((seed) => seed.entityId),
    ...CH1_DUNGEON_ENCOUNTER_NPCS.map((encounter) => encounter.entityId),
  ];
}

function localDevSnapshotGroveNpcIds() {
  return SNAPSHOT_GROVE_NPCS.filter((npc) => npc.seedServerNpc).map((npc) =>
    snapshotGroveNpcEntityId(npc)
  );
}

function localDevSnapshotCombatNpcIds() {
  return SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS.map(
    (spawn) => (Number(LOCAL_DEV_NPC_ID_BASE) + spawn.idOffset) as BiomesId
  );
}

function localDevLiveEntityProductionSeedIds() {
  return harthmereLiveEntityProductionSeedIds();
}

function localDevGroveRaceMinigameSeedIds() {
  return harthmereGroveRaceMinigameSeedIds();
}

function localDevBusinessOwnerNpcIds() {
  return harthmereBusinessOwnerNpcSeedEntityIds();
}

function localDevBusinessCustomerNpcIds() {
  return harthmereBusinessCustomerNpcSeedEntityIds();
}

function localDevBusinessCraftingStationIds() {
  return harthmereBusinessCraftingStationSeedEntityIds();
}

function localDevBusinessInteriorCollisionIds() {
  return harthmereBusinessInteriorCollisionSeedEntityIds();
}

function localDevRequestBoardEcsSeedIds() {
  return harthmereRequestBoardEcsSeedEntityIds();
}

function localDevPlayerLikeNpcCosmeticRepairIds() {
  return [
    ...new Set([
      ...starterTownNpcs().map((npc) => npc.id),
      ...Object.values(HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST)
        .filter((giver) => giver.needsSeed)
        .map((giver) => giver.entityId),
      ...SNAPSHOT_GROVE_NPCS.filter(
        (npc) => npc.seedServerNpc && !npc.snapshotAsset
      ).map((npc) => snapshotGroveNpcEntityId(npc)),
      ...localDevBusinessOwnerNpcIds(),
      ...CH1_NEW_CAST.filter(
        (member) => !member.promotesExistingEntity && member.key !== "marrow"
      ).map((member) => member.entityId),
    ]),
  ];
}

function localDevCanonicalPersistentNpcIds() {
  return [
    ...new Set([
      ...starterTownNpcs().map((npc) => npc.id),
      ...localDevChapter1NpcIds(),
      ...localDevSnapshotGroveNpcIds(),
      ...localDevSnapshotCombatNpcIds(),
      ...localDevLiveEntityProductionSeedIds(),
      ...localDevGroveRaceMinigameSeedIds(),
      ...localDevBusinessOwnerNpcIds(),
    ]),
  ];
}

function makeRetiredBusinessCustomerNpcChanges(
  tick: number,
  existingIds: ReadonlySet<BiomesId>
): Change[] {
  return localDevBusinessCustomerNpcIds()
    .filter((id) => existingIds.has(id))
    .map((id) => ({ kind: "delete", tick, id }));
}

async function makeRetiredSnapshotGroveNpcChanges(
  tick: number,
  service: ShimWorldService | undefined,
  worldApi: WorldApi
): Promise<Change[]> {
  const legacyIds = Object.values(SNAPSHOT_GROVE_LEGACY_NPC_ENTITY_IDS);
  if (service) {
    return buildHarthmereObsoleteSnapshotGroveNpcDeleteChanges({
      tick,
      candidates: legacyIds.flatMap((id) => {
        const entity = service.table.get(id);
        return entity
          ? [
              {
                id: entity.id,
                label: entity.label?.text,
                hasNpcMetadata: Boolean(entity.npc_metadata),
                hasPlayerStatus: Boolean(entity.player_status),
                hasRemoteConnection: Boolean(entity.remote_connection),
              },
            ]
          : [];
      }),
    });
  }

  const entities = await worldApi.get(legacyIds);
  return buildHarthmereObsoleteSnapshotGroveNpcDeleteChanges({
    tick,
    candidates: entities.flatMap((entity) =>
      entity
        ? [
            {
              id: entity.id,
              label: entity.label()?.text,
              hasNpcMetadata: Boolean(entity.npcMetadata()),
              hasPlayerStatus: Boolean(entity.playerStatus()),
              hasRemoteConnection: Boolean(entity.remoteConnection()),
            },
          ]
        : []
    ),
  });
}

function makeRetiredGenericTownspersonChanges(
  tick: number,
  service: ShimWorldService | undefined,
  canonicalNpcIds: ReadonlySet<BiomesId>,
  knownPresentIds: ReadonlySet<BiomesId>
): Change[] {
  const retiredIds = new Set<BiomesId>(knownPresentIds);
  if (!service) {
    return [...retiredIds].map((id) => ({ kind: "delete", tick, id }));
  }
  for (const entity of service.table.contents()) {
    const position = entity.position?.v ?? entity.npc_metadata?.spawn_position;
    if (
      shouldRetireGenericHarthmereTownsperson(
        {
          id: entity.id,
          typeId: entity.npc_metadata?.type_id,
          label: entity.label?.text,
          position,
          isPlayer: isPlayer(entity),
          isCanonicalPersistentNpc: canonicalNpcIds.has(entity.id),
        },
        harthmereExtraTownOffsetX(),
        harthmereExtraTownOffsetZ()
      )
    ) {
      retiredIds.add(entity.id);
    }
  }
  return [...retiredIds].map((id) => ({ kind: "delete", tick, id }));
}

function makeLocalDevPlayerLikeNpcCosmeticRepairChanges(
  tick: number,
  existingIds: ReadonlySet<BiomesId>
): Change[] {
  // This migration is intentionally component-only: it repairs the old shared
  // avatar defaults without moving NPCs, replacing dialogue, or touching any
  // player-built/world content in an imported snapshot.
  return localDevPlayerLikeNpcCosmeticRepairIds()
    .filter((id) => existingIds.has(id))
    .map((id) => ({
      kind: "update" as const,
      tick,
      entity: {
        id,
        appearance_component: null,
        wearing: null,
      },
    }));
}

function isLocalDevQuestGiverNpcId(id: BiomesId) {
  const offset = Number(id) - Number(LOCAL_DEV_NPC_ID_BASE);
  return (
    new Set([
      1, 5, 6, 7, 8, 9, 10, 11, 27, 28, 29, 30, 31, 33, 34, 41, 42, 44, 46, 47,
      62, 70, 9302, 9303, 9304, 9305, 9306, 9307, 9308, 9309, 9310, 9311, 9312,
      9313,
    ]).has(offset) ||
    Object.values(HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST).some(
      (giver) => giver.entityId === id
    )
  );
}
function makeLocalDevNpcChanges(tick: number, existingIds: Set<BiomesId>) {
  const now = secondsSinceEpoch();
  const changes: Change[] = [];
  // Shared claim set so two anchored NPCs cannot collapse to the same
  // (x, z) — this is the v94 fix for the audit-confirmed stacking bug
  // (Tovin Reed + Ferry Master Wren + River Knots Lookout all at [1084,53,-188];
  // Toma + Master Osric + Market Board all at [1010,58,-219]).
  const claimed: HarthmereNpcClaimSet = new Set();
  for (const npc of starterTownNpcs()) {
    const typeId = resolveNpcTypeId(npc.preferredTypes, npc.fallbackTypes);
    if (!typeId) {
      log.warn("Could not find a usable local dev NPC type", {
        displayName: npc.displayName,
        preferredTypes: npc.preferredTypes,
      });
      continue;
    }

    const kind = existingIds.has(npc.id) ? "update" : "create";
    const appearance = makeHarthmereNpcAppearanceConfig({
      id: npc.id,
      name: npc.displayName,
      roleHint: npc.description,
      forwardAxis: "minusZ",
      source: "harthmere-starter-town-npc",
    });
    const base = prepareHarthmerePlayerLikeNpcForUniqueAppearance(
      npcEntity(
        {
          id: npc.id,
          typeId,
          position: harthmereGroundedNpcWorldPositionWithClaim(npc, claimed),
          orientation: npc.orientation,
          velocity: npc.velocity,
          displayName: npc.displayName,
          defaultDialog: npc.dialog,
        },
        now
      ),
      kind
    );
    const additiveTownProfile = harthmereAdditiveTownNpcDialogueForOffset(
      Number(npc.id) - Number(LOCAL_DEV_NPC_ID_BASE)
    );
    const entity = {
      ...base,
      ...(additiveTownProfile
        ? {
            voice: Voice.create({
              voice:
                harthmereAdditiveTownNpcVoiceProfile(additiveTownProfile)
                  .voiceParameterId,
            }),
          }
        : {}),
      entity_description: EntityDescription.create({
        text: withHarthmereAppearanceMarker(
          withHarthmereBodyAndFaceMarkers(
            npc.description,
            appearance.face,
            appearance.body
          ),
          appearance
        ),
      }),
      ...(isLocalDevQuestGiverNpcId(npc.id)
        ? {
            quest_giver: QuestGiver.create({
              concurrent_quests: 1,
              concurrent_quest_dialog: npc.dialog,
            }),
          }
        : {}),
    };
    changes.push({
      kind,
      tick,
      entity,
    });
  }

  // A small set of Bible quest givers had authored dialogue/locations but no
  // ECS entity in the original local-town seed. Seed those exact manifest ids
  // so native quest availability never points at an invisible string actor.
  for (const giver of Object.values(HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST)) {
    if (!giver.needsSeed) continue;
    const kind = existingIds.has(giver.entityId) ? "update" : "create";
    const appearance = makeHarthmereNpcAppearanceConfig({
      id: giver.entityId,
      name: giver.displayName,
      roleHint: "native Harthmere quest giver",
      forwardAxis: "minusZ",
      source: "harthmere-native-quest-giver",
    });
    const base = prepareHarthmerePlayerLikeNpcForUniqueAppearance(
      npcEntity(
        {
          id: giver.entityId,
          typeId: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
          position: harthmereGroundedNpcWorldPosition([...giver.position]),
          orientation: [0, 3.14],
          velocity: [0, 0, 0],
          displayName: giver.displayName,
          defaultDialog: npcDialog(
            `${giver.displayName}. You look like someone following a marked trail.`,
            "Ask me about the work tied to this place."
          ),
        },
        now
      ),
      kind
    );
    const entity = {
      ...base,
      entity_description: EntityDescription.create({
        text: withHarthmereAppearanceMarker(
          withHarthmereBodyAndFaceMarkers(
            `${giver.displayName} — native Harthmere quest giver.`,
            appearance.face,
            appearance.body
          ),
          appearance
        ),
      }),
      quest_giver: QuestGiver.create({
        concurrent_quests: 1,
        concurrent_quest_dialog: `${giver.displayName} has work to discuss.`,
      }),
    };
    changes.push({
      kind,
      tick,
      entity,
    });
  }
  return changes;
}

const LOCAL_DEV_SEED_APPLY_BATCH_SIZE = 400;
const LOCAL_DEV_TERRAIN_BUILD_APPLY_BATCH_SIZE = Math.max(
  1,
  Number.parseInt(
    process.env.HARTHMERE_TERRAIN_SEED_BUILD_APPLY_BATCH_SIZE ?? "16",
    10
  ) || 16
);

function localDevSeedChangeId(change: Change) {
  if (change.kind === "create" || change.kind === "update") {
    return change.entity.id;
  }
  return change.id;
}

function summarizeLocalDevSeedChanges(changes: Change[]) {
  let creates = 0;
  let updates = 0;
  let deletes = 0;
  let terrainShards = 0;
  let npcs = 0;
  let other = 0;

  for (const change of changes) {
    if (change.kind === "create") {
      creates += 1;
    } else if (change.kind === "update") {
      updates += 1;
    } else if (change.kind === "delete") {
      deletes += 1;
    }

    const id = localDevSeedChangeId(change);
    if (id >= LOCAL_DEV_TERRAIN_ID_BASE && id < LOCAL_DEV_TERRAIN_ID_LIMIT) {
      terrainShards += 1;
    } else if (id >= LOCAL_DEV_NPC_ID_BASE && id < LOCAL_DEV_NPC_ID_LIMIT) {
      npcs += 1;
    } else {
      other += 1;
    }
  }

  return {
    totalChanges: changes.length,
    creates,
    updates,
    deletes,
    terrainShards,
    npcs,
    other,
  };
}

function firstAndLastLocalDevSeedIds(changes: Change[]) {
  if (changes.length === 0) {
    return { firstId: undefined, lastId: undefined };
  }
  return {
    firstId: localDevSeedChangeId(changes[0]),
    lastId: localDevSeedChangeId(changes[changes.length - 1]),
  };
}

function localDevSeedChangeBatches(changes: Change[], batchSize: number) {
  const batches: Change[][] = [];
  for (let start = 0; start < changes.length; start += batchSize) {
    batches.push(changes.slice(start, start + batchSize));
  }
  return batches;
}

async function applyLocalDevSeedChangesInDebugBatches(
  worldApi: WorldApi,
  changes: Change[]
) {
  const batches = localDevSeedChangeBatches(
    changes,
    LOCAL_DEV_SEED_APPLY_BATCH_SIZE
  );

  log.warn("Applying local dev starter town seed changes in batches", {
    reason:
      "Redis Lua apply has a max key count per transaction; Harthmere terrain + NPCs exceed that if applied at once.",
    maxBatchSize: LOCAL_DEV_SEED_APPLY_BATCH_SIZE,
    batchCount: batches.length,
    ...summarizeLocalDevSeedChanges(changes),
    ...firstAndLastLocalDevSeedIds(changes),
  });

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    log.warn("Applying local dev starter town seed batch", {
      batchNumber: index + 1,
      batchCount: batches.length,
      maxBatchSize: LOCAL_DEV_SEED_APPLY_BATCH_SIZE,
      ...summarizeLocalDevSeedChanges(batch),
      ...firstAndLastLocalDevSeedIds(batch),
    });

    const applied = await worldApi.apply({
      changes: batch.map(toProposedChange),
    });
    if (applied.outcome !== "success") {
      log.warn("Local dev starter town seed batch did not apply", {
        batchNumber: index + 1,
        batchCount: batches.length,
        outcome: applied.outcome,
        ...summarizeLocalDevSeedChanges(batch),
        ...firstAndLastLocalDevSeedIds(batch),
      });
      return false;
    }
  }

  return true;
}

function makeLocalDevObsoleteTerrainDeletionChanges(
  tick: number,
  existingIds: Set<BiomesId>
) {
  if (terrainSeedMigrationMode() === "additive") {
    // Ordinary deployments are append-only. Retired terrain can contain
    // durable player diffs, buildings, farming ownership, or other overlays;
    // removing it requires an explicit reviewed migration.
    return [];
  }
  const wantedTerrainIds = new Set(
    localDevTerrainShardSpecs().map((spec) => spec.id)
  );
  const changes: Change[] = [];
  for (const id of existingIds) {
    const isPreviousAdditiveTerrain =
      id >= HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_BASE &&
      id < HARTHMERE_PREVIOUS_EXTENSION_TERRAIN_ENTITY_ID_LIMIT;
    const isUnwantedCurrentTerrain =
      id >= LOCAL_DEV_TERRAIN_ID_BASE &&
      id < LOCAL_DEV_TERRAIN_ID_LIMIT &&
      !wantedTerrainIds.has(id);
    if (isPreviousAdditiveTerrain) {
      // This retired band overlaps deterministic escort-companion ids. Strip
      // only the terrain identity instead of deleting the whole ECS record, so
      // any NPC/living components sharing the id survive the migration.
      changes.push({
        kind: "update",
        tick,
        entity: {
          id,
          box: null,
          shard_seed: null,
          shard_diff: null,
          shard_shapes: null,
        },
      });
    } else if (isUnwantedCurrentTerrain) {
      changes.push({ kind: "delete", tick, id });
    }
  }
  return changes;
}

function makeLocalDevSeedFingerprint(input: {
  terrainIds: BiomesId[];
  chapter1TerrainIds: BiomesId[];
  npcIds: BiomesId[];
  chapter1NpcIds: BiomesId[];
  snapshotGroveNpcIds: BiomesId[];
  snapshotCombatNpcIds: BiomesId[];
  liveEntityProductionSeedIds: BiomesId[];
  groveRaceMinigameSeedIds: BiomesId[];
  businessOwnerNpcIds: BiomesId[];
  retiredBusinessCustomerNpcIds: BiomesId[];
  businessCraftingStationIds: BiomesId[];
  businessInteriorCollisionIds: BiomesId[];
  additiveTownInteriorCollisionIds: BiomesId[];
  additiveTownCookingStationIds: BiomesId[];
  requestBoardEcsSeedIds: BiomesId[];
  chapter1PropIds: BiomesId[];
}) {
  return JSON.stringify({
    version: HARTHMERE_LOCAL_DEV_SEED_FINGERPRINT_VERSION,
    chapter1PropSeedVersion: CH1_PROP_SEED_VERSION,
    chapter1TestimonyNpcSeedVersion: CH1_TESTIMONY_NPC_SEED_VERSION,
    chapter1ReturningNpcSeedVersion: CH1_RETURNING_NPC_SEED_VERSION,
    businessOwnerNpcSeedVersion: HARTHMERE_BUSINESS_OWNER_NPC_SEED_VERSION,
    retiredBusinessCustomerNpcSeedVersion:
      HARTHMERE_BUSINESS_CUSTOMER_NPC_SEED_VERSION,
    npcPopulationPolicyVersion: HARTHMERE_NPC_POPULATION_POLICY_VERSION,
    townSurfaceStyleVersion: HARTHMERE_TOWN_SURFACE_STYLE_VERSION,
    buildingStyleVersion: HARTHMERE_BUILDING_STYLE_VERSION,
    businessCraftingStationSeedVersion:
      HARTHMERE_BUSINESS_CRAFTING_STATION_SEED_VERSION,
    businessInteriorCollisionSeedVersion:
      HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEED_VERSION,
    additiveTownInteriorCollisionSeedVersion:
      HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEED_VERSION,
    additiveTownCookingStationSeedVersion:
      HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEED_VERSION,
    additiveTownInteriorsVersion: HARTHMERE_ADDITIVE_TOWN_INTERIORS_VERSION,
    requestBoardEcsSeedVersion: HARTHMERE_REQUEST_BOARD_ECS_SEED_VERSION,
    contentPass: HARTHMERE_LOCAL_DEV_SEED_CONTENT_PASS,
    terrainBoundsVersion: HARTHMERE_LOCAL_DEV_TERRAIN_BOUNDS_VERSION,
    chapter1DungeonTerrainVersion: CH1_DUNGEON_TERRAIN_VERSION,
    npcPositionOverrideVersion: HARTHMERE_NPC_POSITION_OVERRIDE_VERSION,
    perfAndPlacementVersion: HARTHMERE_PERF_AND_PLACEMENT_VERSION,
    performanceProfile: HARTHMERE_LOCAL_DEV_PERF_PROFILE,
    liveEntityProductionSeedVersion:
      HARTHMERE_LIVE_ENTITY_PRODUCTION_SEED_VERSION,
    groveRaceMinigameSeedVersion: HARTHMERE_GROVE_RACE_MINIGAME_SEED_VERSION,
    offsets: {
      x: harthmereExtraTownOffsetX(),
      z: harthmereExtraTownOffsetZ(),
    },
    bounds: {
      x0: STARTER_TOWN_WILDS_X0 + harthmereExtraTownOffsetX(),
      x1: STARTER_TOWN_WILDS_X1 + harthmereExtraTownOffsetX(),
      z0: STARTER_TOWN_WILDS_Z0 + harthmereExtraTownOffsetZ(),
      z1: STARTER_TOWN_WILDS_Z1 + harthmereExtraTownOffsetZ(),
    },
    counts: {
      terrain: input.terrainIds.length,
      chapter1Terrain: input.chapter1TerrainIds.length,
      npcs: input.npcIds.length,
      chapter1Npcs: input.chapter1NpcIds.length,
      snapshotGroveNpcs: input.snapshotGroveNpcIds.length,
      snapshotCombatNpcs: input.snapshotCombatNpcIds.length,
      liveEntityProductionSeeds: input.liveEntityProductionSeedIds.length,
      groveRaceMinigameSeeds: input.groveRaceMinigameSeedIds.length,
      businessOwnerNpcs: input.businessOwnerNpcIds.length,
      retiredBusinessCustomerNpcs: input.retiredBusinessCustomerNpcIds.length,
      businessCraftingStations: input.businessCraftingStationIds.length,
      businessInteriorCollisions: input.businessInteriorCollisionIds.length,
      additiveTownInteriorCollisions:
        input.additiveTownInteriorCollisionIds.length,
      additiveTownCookingStations: input.additiveTownCookingStationIds.length,
      requestBoardEcsSeeds: input.requestBoardEcsSeedIds.length,
      fastHarvestableBlocks: HARTHMERE_FAST_HARVESTABLE_BLOCK_BY_COORD.size,
      harvestableTreeCenters: HARTHMERE_HARVESTABLE_TREE_CENTERS.length,
      harvestableOreClusters: HARTHMERE_HARVESTABLE_ORE_CENTERS.length,
      harvestableForageClusters: HARTHMERE_HARVESTABLE_FORAGE_CENTERS.length,
    },
    idRanges: {
      terrainFirst: input.terrainIds[0],
      terrainLast: input.terrainIds[input.terrainIds.length - 1],
      chapter1TerrainFirst: input.chapter1TerrainIds[0],
      chapter1TerrainLast:
        input.chapter1TerrainIds[input.chapter1TerrainIds.length - 1],
      npcFirst: input.npcIds[0],
      npcLast: input.npcIds[input.npcIds.length - 1],
      chapter1NpcFirst: input.chapter1NpcIds[0],
      chapter1NpcLast: input.chapter1NpcIds[input.chapter1NpcIds.length - 1],
      snapshotGroveNpcFirst: input.snapshotGroveNpcIds[0],
      snapshotGroveNpcLast:
        input.snapshotGroveNpcIds[input.snapshotGroveNpcIds.length - 1],
      snapshotCombatNpcFirst: input.snapshotCombatNpcIds[0],
      snapshotCombatNpcLast:
        input.snapshotCombatNpcIds[input.snapshotCombatNpcIds.length - 1],
      liveEntityProductionSeedFirst: input.liveEntityProductionSeedIds[0],
      liveEntityProductionSeedLast:
        input.liveEntityProductionSeedIds[
          input.liveEntityProductionSeedIds.length - 1
        ],
      groveRaceMinigameSeedFirst: input.groveRaceMinigameSeedIds[0],
      groveRaceMinigameSeedLast:
        input.groveRaceMinigameSeedIds[
          input.groveRaceMinigameSeedIds.length - 1
        ],
    },
  });
}

function makeLocalDevSeedMarkerChange(
  tick: number,
  existingIds: Set<BiomesId>,
  fingerprint: string
): Change {
  return {
    kind: existingIds.has(LOCAL_DEV_SEED_MARKER_ID) ? "update" : "create",
    tick,
    entity: {
      id: LOCAL_DEV_SEED_MARKER_ID,
      entity_description: EntityDescription.create({
        text: fingerprint,
      }),
    },
  };
}

function makeLocalDevRuntimeContentFingerprint() {
  return JSON.stringify({
    version: HARTHMERE_ADDITIVE_RUNTIME_CONTENT_VERSION,
    businessAisleNpcSweepVersion: HARTHMERE_BUSINESS_AISLE_NPC_SWEEP_VERSION,
    chapter1TestimonyNpcSeedVersion: CH1_TESTIMONY_NPC_SEED_VERSION,
    chapter1ReturningNpcSeedVersion: CH1_RETURNING_NPC_SEED_VERSION,
    playerLikeNpcCosmeticResetVersion:
      HARTHMERE_PLAYER_LIKE_NPC_COSMETIC_RESET_VERSION,
    playerLikeNpcVariantVersion: HARTHMERE_PLAYER_LIKE_NPC_VARIANT_VERSION,
    liveEntityProductionSeedVersion:
      HARTHMERE_LIVE_ENTITY_PRODUCTION_SEED_VERSION,
    npcPositionOverrideVersion: HARTHMERE_NPC_POSITION_OVERRIDE_VERSION,
    performanceAndPlacementVersion: HARTHMERE_PERF_AND_PLACEMENT_VERSION,
    npcPopulationPolicyVersion: HARTHMERE_NPC_POPULATION_POLICY_VERSION,
    retiredBusinessCustomerNpcSeedVersion:
      HARTHMERE_BUSINESS_CUSTOMER_NPC_SEED_VERSION,
    businessCraftingStationSeedVersion:
      HARTHMERE_BUSINESS_CRAFTING_STATION_SEED_VERSION,
    businessInteriorCollisionSeedVersion:
      HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEED_VERSION,
    additiveTownInteriorCollisionSeedVersion:
      HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEED_VERSION,
    additiveTownCookingStationSeedVersion:
      HARTHMERE_ADDITIVE_TOWN_COOKING_STATION_SEED_VERSION,
    additiveTownInteriorsVersion: HARTHMERE_ADDITIVE_TOWN_INTERIORS_VERSION,
    requestBoardEcsSeedVersion: HARTHMERE_REQUEST_BOARD_ECS_SEED_VERSION,
    offsets: {
      x: harthmereExtraTownOffsetX(),
      z: harthmereExtraTownOffsetZ(),
    },
  });
}

function makeLocalDevRuntimeContentMarkerChange(
  tick: number,
  existingIds: Set<BiomesId>,
  fingerprint = makeLocalDevRuntimeContentFingerprint()
): Change {
  return {
    kind: existingIds.has(LOCAL_DEV_RUNTIME_CONTENT_MARKER_ID)
      ? "update"
      : "create",
    tick,
    entity: {
      id: LOCAL_DEV_RUNTIME_CONTENT_MARKER_ID,
      entity_description: EntityDescription.create({ text: fingerprint }),
    },
  };
}

function makeLocalDevNpcCosmeticMarkerFingerprint() {
  return JSON.stringify({
    playerLikeNpcCosmeticResetVersion:
      HARTHMERE_PLAYER_LIKE_NPC_COSMETIC_RESET_VERSION,
    playerLikeNpcVariantVersion: HARTHMERE_PLAYER_LIKE_NPC_VARIANT_VERSION,
  });
}

async function localDevNpcCosmeticMarkerFingerprint(
  service: ShimWorldService | undefined,
  worldApi: WorldApi
) {
  const entity = service
    ? service.table.get(LOCAL_DEV_NPC_COSMETIC_MARKER_ID)
    : await worldApi.get(LOCAL_DEV_NPC_COSMETIC_MARKER_ID);
  if (!entity) return undefined;
  const description =
    "entityDescription" in entity
      ? entity.entityDescription()
      : entity.entity_description;
  return description?.text;
}

async function reconcileLocalDevPlayerLikeNpcCosmetics(
  service: ShimWorldService | undefined,
  worldApi: WorldApi
) {
  const fingerprint = makeLocalDevNpcCosmeticMarkerFingerprint();
  if (
    (await localDevNpcCosmeticMarkerFingerprint(service, worldApi)) ===
    fingerprint
  ) {
    return true;
  }

  const tick = service ? service.table.tick + 1 : 1;
  const cosmeticIds = localDevPlayerLikeNpcCosmeticRepairIds();
  const existingIds = await existingLocalDevIds(
    [...cosmeticIds, LOCAL_DEV_NPC_COSMETIC_MARKER_ID],
    service,
    worldApi
  );
  const changes: Change[] = [
    ...makeLocalDevPlayerLikeNpcCosmeticRepairChanges(tick, existingIds),
    {
      kind: existingIds.has(LOCAL_DEV_NPC_COSMETIC_MARKER_ID)
        ? "update"
        : "create",
      tick,
      entity: {
        id: LOCAL_DEV_NPC_COSMETIC_MARKER_ID,
        entity_description: EntityDescription.create({ text: fingerprint }),
      },
    },
  ];

  log.warn("Reconciling unique player-like NPC cosmetics", {
    version: HARTHMERE_PLAYER_LIKE_NPC_COSMETIC_RESET_VERSION,
    presentNpcIds: existingIds.size,
    repairedNpcCosmetics: changes.length - 1,
  });
  if (service) {
    service.writeableTable.apply(changes);
    return true;
  }
  return applyLocalDevSeedChangesInDebugBatches(worldApi, changes);
}

async function localDevSeedMarkerFingerprint(
  service: ShimWorldService | undefined,
  worldApi: WorldApi
) {
  const entity = service
    ? service.table.get(LOCAL_DEV_SEED_MARKER_ID)
    : await worldApi.get(LOCAL_DEV_SEED_MARKER_ID);
  if (!entity) {
    return undefined;
  }
  const description =
    "entityDescription" in entity
      ? entity.entityDescription()
      : entity.entity_description;
  return description?.text;
}

async function localDevRuntimeContentMarkerFingerprint(
  service: ShimWorldService | undefined,
  worldApi: WorldApi
) {
  const entity = service
    ? service.table.get(LOCAL_DEV_RUNTIME_CONTENT_MARKER_ID)
    : await worldApi.get(LOCAL_DEV_RUNTIME_CONTENT_MARKER_ID);
  if (!entity) return undefined;
  const description =
    "entityDescription" in entity
      ? entity.entityDescription()
      : entity.entity_description;
  return description?.text;
}

async function reconcileLocalDevRuntimeContent(
  service: ShimWorldService | undefined,
  worldApi: WorldApi
) {
  await reconcileSnapshotMinigameCatalog(worldApi);
  const fingerprint = makeLocalDevRuntimeContentFingerprint();
  const tick = service ? service.table.tick + 1 : 1;
  const retiredCustomerIds = localDevBusinessCustomerNpcIds();
  const presentRetiredCustomerIds = await existingLocalDevIds(
    retiredCustomerIds,
    service,
    worldApi
  );
  const presentKnownGenericTownspersonIds = await existingLocalDevIds(
    [...HARTHMERE_RETIRED_GENERIC_TOWNSPERSON_IDS],
    service,
    worldApi
  );
  const canonicalNpcIds = new Set(localDevCanonicalPersistentNpcIds());
  const retiredCustomerChanges = makeRetiredBusinessCustomerNpcChanges(
    tick,
    presentRetiredCustomerIds
  );
  const retiredSnapshotGroveNpcChanges =
    await makeRetiredSnapshotGroveNpcChanges(tick, service, worldApi);
  const retiredGenericTownspersonChanges = makeRetiredGenericTownspersonChanges(
    tick,
    service,
    canonicalNpcIds,
    presentKnownGenericTownspersonIds
  );
  if (
    (await localDevRuntimeContentMarkerFingerprint(service, worldApi)) ===
      fingerprint &&
    retiredCustomerChanges.length === 0 &&
    retiredSnapshotGroveNpcChanges.length === 0 &&
    retiredGenericTownspersonChanges.length === 0
  ) {
    return true;
  }

  const emptyIds = new Set<BiomesId>();
  const cosmeticRepairIds = localDevPlayerLikeNpcCosmeticRepairIds();
  const nowSeconds = secondsSinceEpoch();
  const candidateNpcChanges = applyHarthmereBusinessAisleKeepOutToSeedChanges([
    ...makeLocalDevNpcChanges(tick, emptyIds),
    ...makeLocalDevChapter1NpcChanges(tick, emptyIds),
    ...makeLocalDevSnapshotGroveNpcChanges(tick, emptyIds),
    ...buildHarthmereBusinessOwnerNpcSeedChanges({
      tick,
      nowSeconds,
      existingIds: emptyIds,
    }),
    ...buildHarthmereLiveEntityProductionSeedChanges({
      tick,
      nowSeconds,
      existingIds: emptyIds,
      isRespawnSuppressed: (id) =>
        harthmereSharedLiveCreatureRespawnRegistry().isSuppressed(
          id,
          Date.now()
        ),
    }),
  ]).changes;
  const candidate = [
    ...candidateNpcChanges,
    ...buildHarthmereBusinessCraftingStationSeedChanges({
      tick,
      nowSeconds,
      existingIds: emptyIds,
    }),
    ...buildHarthmereBusinessInteriorCollisionSeedChanges({
      tick,
      existingIds: emptyIds,
    }),
    ...buildHarthmereAdditiveTownInteriorCollisionSeedChanges({
      tick,
      existingIds: emptyIds,
    }),
    ...buildHarthmereAdditiveTownCookingStationSeedChanges({
      tick,
      nowSeconds,
      existingIds: emptyIds,
    }),
    ...buildHarthmereRequestBoardEcsSeedChanges({
      tick,
      existingIds: emptyIds,
    }),
  ];
  const candidateIds = candidate.map(localDevSeedChangeId);
  const existingIds = await existingLocalDevIds(
    [
      ...new Set([
        ...candidateIds,
        ...cosmeticRepairIds,
        ...retiredCustomerIds,
        ...HARTHMERE_RETIRED_GENERIC_TOWNSPERSON_IDS,
        LOCAL_DEV_RUNTIME_CONTENT_MARKER_ID,
      ]),
    ],
    service,
    worldApi
  );
  const runtimeNpcSeedChanges = applyHarthmereBusinessAisleKeepOutToSeedChanges(
    [
      ...makeLocalDevNpcChanges(tick, existingIds),
      ...makeLocalDevChapter1NpcChanges(tick, existingIds),
      ...makeLocalDevSnapshotGroveNpcChanges(tick, existingIds),
      ...buildHarthmereBusinessOwnerNpcSeedChanges({
        tick,
        nowSeconds,
        existingIds,
      }),
      ...buildHarthmereLiveEntityProductionSeedChanges({
        tick,
        nowSeconds,
        existingIds,
        isRespawnSuppressed: (id) =>
          harthmereSharedLiveCreatureRespawnRegistry().isSuppressed(
            id,
            Date.now()
          ),
      }),
    ]
  );
  const changes = [
    ...runtimeNpcSeedChanges.changes,
    ...buildHarthmereBusinessCraftingStationSeedChanges({
      tick,
      nowSeconds,
      existingIds,
    }),
    ...buildHarthmereBusinessInteriorCollisionSeedChanges({
      tick,
      existingIds,
    }),
    ...buildHarthmereAdditiveTownInteriorCollisionSeedChanges({
      tick,
      existingIds,
    }),
    ...buildHarthmereAdditiveTownCookingStationSeedChanges({
      tick,
      nowSeconds,
      existingIds,
    }),
    ...buildHarthmereRequestBoardEcsSeedChanges({ tick, existingIds }),
    ...makeLocalDevPlayerLikeNpcCosmeticRepairChanges(tick, existingIds),
    ...retiredSnapshotGroveNpcChanges,
    ...retiredCustomerChanges,
    ...retiredGenericTownspersonChanges,
    makeLocalDevRuntimeContentMarkerChange(tick, existingIds, fingerprint),
  ];

  log.warn("Reconciling additive Harthmere runtime content coordinates", {
    version: HARTHMERE_ADDITIVE_RUNTIME_CONTENT_VERSION,
    ...summarizeLocalDevSeedChanges(changes),
    runtimeOffsetX: harthmereExtraTownOffsetX(),
    runtimeOffsetZ: harthmereExtraTownOffsetZ(),
    retiredSnapshotGroveNpcs: retiredSnapshotGroveNpcChanges.length,
    retiredPersistentBusinessCustomers: retiredCustomerChanges.length,
    retiredGenericTownspeople: retiredGenericTownspersonChanges.length,
    relocatedBusinessAisleNpcs: runtimeNpcSeedChanges.correctedIds.length,
    relocatedBusinessAisleNpcIds: runtimeNpcSeedChanges.correctedIds,
  });
  if (service) {
    service.writeableTable.apply(changes);
    return true;
  }
  return applyLocalDevSeedChangesInDebugBatches(worldApi, changes);
}

function allExpectedLocalDevSeedIdsExist(
  expectedIds: BiomesId[],
  existingIds: Set<BiomesId>
) {
  return expectedIds.every((id) => existingIds.has(id));
}

async function stampLocalDevSeedMarker(
  service: ShimWorldService | undefined,
  worldApi: WorldApi,
  existingIds: Set<BiomesId>,
  fingerprint: string
) {
  const tick = service ? service.table.tick + 1 : 1;
  const change = makeLocalDevSeedMarkerChange(tick, existingIds, fingerprint);
  if (service) {
    service.writeableTable.apply([change]);
    return true;
  }
  const applied = await worldApi.apply({
    changes: [toProposedChange(change)],
  });
  return applied.outcome === "success";
}

function makeLocalDevMiniWorldChanges(
  voxeloo: VoxelooModule,
  tick: number,
  existingIds: Set<BiomesId>,
  seedFingerprint: string,
  includeTerrain = true,
  terrainIdsToBuild?: ReadonlySet<BiomesId>,
  authoredWaterOnlyIds?: ReadonlySet<BiomesId>
) {
  const changes: Change[] = [];
  const specs = localDevTerrainShardSpecs();
  const chapter1Specs = localDevChapter1TerrainShardSpecs();
  const staleTerrainDeletes = makeLocalDevObsoleteTerrainDeletionChanges(
    tick,
    existingIds
  );
  if (staleTerrainDeletes.length) {
    log.warn("Pruning obsolete local dev terrain shards", {
      version: HARTHMERE_LOCAL_DEV_TERRAIN_BOUNDS_VERSION,
      count: staleTerrainDeletes.length,
    });
  }
  const startedAt = Date.now();

  if (includeTerrain) {
    log.warn("Building local dev starter town seed changes", {
      terrainShardSpecs: specs.length,
      existingLocalDevIds: existingIds.size,
      fastHarvestableBlocks: HARTHMERE_FAST_HARVESTABLE_BLOCK_BY_COORD.size,
      muckZones: SNAPSHOT_HARTHMERE_MUCK_ZONES.length,
      harvestableTreeCenters: HARTHMERE_HARVESTABLE_TREE_CENTERS.length,
      harvestableOreClusters: HARTHMERE_HARVESTABLE_ORE_CENTERS.length,
      harvestableForageClusters: HARTHMERE_HARVESTABLE_FORAGE_CENTERS.length,
    });
  }

  if (includeTerrain) {
    for (let index = 0; index < specs.length; index += 1) {
      const spec = specs[index];
      if (terrainIdsToBuild && !terrainIdsToBuild.has(spec.id)) {
        continue;
      }
      const shardStartedAt = Date.now();
      const terrainChange = makeLocalDevTerrainShard(
        voxeloo,
        existingIds.has(spec.id) ? "update" : "create",
        spec.id,
        spec.shardX,
        spec.shardY,
        spec.shardZ,
        tick,
        authoredWaterOnlyIds?.has(spec.id) ?? false
      );
      changes.push(terrainChange);

      const shardElapsedMs = Date.now() - shardStartedAt;
      if (
        index === 0 ||
        (index + 1) % 128 === 0 ||
        index + 1 === specs.length ||
        shardElapsedMs > 750
      ) {
        log.warn("Built local dev terrain seed shard", {
          shardNumber: index + 1,
          terrainShardSpecs: specs.length,
          shardId: spec.id,
          shardX: spec.shardX,
          shardY: spec.shardY,
          shardZ: spec.shardZ,
          shardElapsedMs,
          totalElapsedMs: Date.now() - startedAt,
        });
      }
    }
    for (const spec of chapter1Specs) {
      if (terrainIdsToBuild && !terrainIdsToBuild.has(spec.id)) {
        continue;
      }
      changes.push(
        makeLocalDevChapter1TerrainShard(
          voxeloo,
          existingIds.has(spec.id) ? "update" : "create",
          spec.id,
          spec.shardX,
          spec.shardY,
          spec.shardZ,
          tick
        )
      );
    }
  }

  // Apply any new or explicitly migrated foundation before stripping retired
  // terrain components. Production clients share Redis during this maintenance
  // pass; create-first ordering prevents even a temporary hole between batches.
  changes.push(...staleTerrainDeletes);

  const npcStartedAt = Date.now();
  const npcChanges = makeLocalDevNpcChanges(tick, existingIds);
  const chapter1NpcChanges = makeLocalDevChapter1NpcChanges(tick, existingIds);
  const groveNpcChanges = makeLocalDevSnapshotGroveNpcChanges(
    tick,
    existingIds
  );
  const combatNpcChanges = makeLocalDevSnapshotCombatNpcChanges(
    tick,
    existingIds
  );
  const liveEntitySeedChanges = buildHarthmereLiveEntityProductionSeedChanges({
    tick,
    nowSeconds: secondsSinceEpoch(),
    existingIds,
    // Leave recently-killed muckers/animals dead until their respawn window
    // (30-60 min) elapses, instead of re-creating them on the next tick.
    isRespawnSuppressed: (id) =>
      harthmereSharedLiveCreatureRespawnRegistry().isSuppressed(id, Date.now()),
  });
  const groveRaceSeedChanges = buildHarthmereGroveRaceMinigameSeedChanges({
    tick,
    nowSeconds: secondsSinceEpoch(),
    existingIds,
  });
  const businessOwnerNpcChanges = buildHarthmereBusinessOwnerNpcSeedChanges({
    tick,
    nowSeconds: secondsSinceEpoch(),
    existingIds,
  });
  const retiredBusinessCustomerNpcChanges =
    makeRetiredBusinessCustomerNpcChanges(tick, existingIds);
  const businessCraftingStationChanges =
    buildHarthmereBusinessCraftingStationSeedChanges({
      tick,
      nowSeconds: secondsSinceEpoch(),
      existingIds,
    });
  const businessInteriorCollisionChanges =
    buildHarthmereBusinessInteriorCollisionSeedChanges({
      tick,
      existingIds,
    });
  const additiveTownInteriorCollisionChanges =
    buildHarthmereAdditiveTownInteriorCollisionSeedChanges({
      tick,
      existingIds,
    });
  const additiveTownCookingStationChanges =
    buildHarthmereAdditiveTownCookingStationSeedChanges({
      tick,
      nowSeconds: secondsSinceEpoch(),
      existingIds,
    });
  const requestBoardEcsSeedChanges = buildHarthmereRequestBoardEcsSeedChanges({
    tick,
    existingIds,
  });
  // CHAPTER_1_PROPS: the road-house, its hearth, cot and stores, Coretta's
  // ledger and the watch-house post. Act 1 was written around objects that were
  // never modelled; these are create-only so a container's contents survive a
  // re-seed.
  const chapter1PropChanges = buildChapter1PropSeedChanges({
    tick,
    nowSeconds: secondsSinceEpoch(),
    existingIds,
  });
  // HARTHMERE_BUSINESS_AISLE_NPC_SWEEP
  // Persistent NPC posts are corrected out of business customer aisles before
  // they are written. The outposts only grew to their audited 24x20 / 28x22
  // footprints after most of this cast was authored, so Chapter 1 actors,
  // Grove residents and additive-town NPCs can now find themselves standing
  // across a shop's entrance. A collidable one-metre body parked in a
  // three-voxel doorway is physically a wall, and it reproduces exactly the
  // stall the widened doorway was meant to end.
  //
  // Correcting the seed in place — rather than writing the blocker and
  // relocating it afterwards — means the world never contains the obstruction,
  // and a warm-Redis refresh converges on the same state as a cold seed.
  const aisleSweptNpcChanges = applyHarthmereBusinessAisleKeepOutToSeedChanges([
    ...npcChanges,
    ...chapter1NpcChanges,
    ...groveNpcChanges,
    ...combatNpcChanges,
    ...liveEntitySeedChanges,
    ...businessOwnerNpcChanges,
  ]);
  if (aisleSweptNpcChanges.correctedIds.length > 0) {
    log.warn("Relocated persistent NPCs out of business customer aisles", {
      version: HARTHMERE_BUSINESS_AISLE_NPC_SWEEP_VERSION,
      count: aisleSweptNpcChanges.correctedIds.length,
      ids: aisleSweptNpcChanges.correctedIds,
    });
  }
  changes.push(
    ...aisleSweptNpcChanges.changes,
    ...chapter1PropChanges,
    ...groveRaceSeedChanges,
    ...retiredBusinessCustomerNpcChanges,
    ...businessCraftingStationChanges,
    ...businessInteriorCollisionChanges,
    ...additiveTownInteriorCollisionChanges,
    ...additiveTownCookingStationChanges,
    ...requestBoardEcsSeedChanges,
    makeLocalDevRuntimeContentMarkerChange(tick, existingIds),
    makeLocalDevSeedMarkerChange(tick, existingIds, seedFingerprint)
  );

  log.warn("Built local dev starter town seed changes", {
    terrainShards: includeTerrain ? specs.length : 0,
    chapter1TerrainShards: includeTerrain ? chapter1Specs.length : 0,
    npcs: npcChanges.length,
    chapter1Npcs: chapter1NpcChanges.length,
    chapter1Props: chapter1PropChanges.length,
    snapshotGroveNpcs: groveNpcChanges.length,
    snapshotCombatNpcs: combatNpcChanges.length,
    liveEntityProductionSeeds: liveEntitySeedChanges.length,
    groveRaceMinigameSeeds: groveRaceSeedChanges.length,
    businessOwnerNpcs: businessOwnerNpcChanges.length,
    retiredBusinessCustomerNpcs: retiredBusinessCustomerNpcChanges.length,
    businessCraftingStations: businessCraftingStationChanges.length,
    businessInteriorCollisions: businessInteriorCollisionChanges.length,
    additiveTownInteriorCollisions: additiveTownInteriorCollisionChanges.length,
    additiveTownCookingStations: additiveTownCookingStationChanges.length,
    requestBoardEcsSeeds: requestBoardEcsSeedChanges.length,
    runtimeOffsetX: harthmereExtraTownOffsetX(),
    runtimeOffsetZ: harthmereExtraTownOffsetZ(),
    firstSnapshotGroveNpc:
      groveNpcChanges[0]?.kind === "create" ||
      groveNpcChanges[0]?.kind === "update"
        ? groveNpcChanges[0].entity.position?.v
        : undefined,
    totalChanges: changes.length,
    terrainElapsedMs: npcStartedAt - startedAt,
    npcElapsedMs: Date.now() - npcStartedAt,
    totalElapsedMs: Date.now() - startedAt,
  });

  return changes;
}

async function buildAndApplyLocalDevTerrainSeedBatches(
  voxeloo: VoxelooModule,
  tick: number,
  existingIds: Set<BiomesId>,
  worldApi: WorldApi,
  terrainIdsToBuild?: ReadonlySet<BiomesId>,
  authoredWaterOnlyIds?: ReadonlySet<BiomesId>
) {
  const specs = [
    ...localDevTerrainShardSpecs().map((spec) => ({
      ...spec,
      chapter1: false as const,
    })),
    ...localDevChapter1TerrainShardSpecs().map((spec) => ({
      ...spec,
      chapter1: true as const,
    })),
  ].filter((spec) => !terrainIdsToBuild || terrainIdsToBuild.has(spec.id));
  const startedAt = Date.now();
  let appliedShardCount = 0;
  let batch: Change[] = [];

  log.warn("Building and applying local dev terrain in bounded batches", {
    reason:
      "Retaining every serialized shard until the final Redis write exceeded the 16 GiB maintenance replica.",
    terrainShardSpecs: specs.length,
    buildApplyBatchSize: LOCAL_DEV_TERRAIN_BUILD_APPLY_BATCH_SIZE,
    existingLocalDevIds: existingIds.size,
  });

  for (let index = 0; index < specs.length; index += 1) {
    const spec = specs[index];
    const shardStartedAt = Date.now();
    batch.push(
      spec.chapter1
        ? makeLocalDevChapter1TerrainShard(
            voxeloo,
            existingIds.has(spec.id) ? "update" : "create",
            spec.id,
            spec.shardX,
            spec.shardY,
            spec.shardZ,
            tick
          )
        : makeLocalDevTerrainShard(
            voxeloo,
            existingIds.has(spec.id) ? "update" : "create",
            spec.id,
            spec.shardX,
            spec.shardY,
            spec.shardZ,
            tick,
            authoredWaterOnlyIds?.has(spec.id) ?? false
          )
    );

    const shardElapsedMs = Date.now() - shardStartedAt;
    if (
      index === 0 ||
      (index + 1) % 128 === 0 ||
      index + 1 === specs.length ||
      shardElapsedMs > 750
    ) {
      log.warn("Built local dev terrain seed shard", {
        shardNumber: index + 1,
        terrainShardSpecs: specs.length,
        shardId: spec.id,
        shardX: spec.shardX,
        shardY: spec.shardY,
        shardZ: spec.shardZ,
        shardElapsedMs,
        totalElapsedMs: Date.now() - startedAt,
      });
    }

    if (
      batch.length < LOCAL_DEV_TERRAIN_BUILD_APPLY_BATCH_SIZE &&
      index + 1 < specs.length
    ) {
      continue;
    }

    // Apply and release each serialized terrain batch before building the next
    // one. The seed marker is written later, after every shard and authored
    // entity succeeds, so a restart cannot falsely advertise a complete map.
    const batchSize = batch.length;
    const applied = await applyLocalDevSeedChangesInDebugBatches(
      worldApi,
      batch
    );
    if (!applied) {
      return false;
    }
    appliedShardCount += batchSize;
    log.warn("Applied bounded local dev terrain seed batch", {
      appliedShardCount,
      terrainShardSpecs: specs.length,
      buildApplyBatchSize: LOCAL_DEV_TERRAIN_BUILD_APPLY_BATCH_SIZE,
      totalElapsedMs: Date.now() - startedAt,
    });
    batch = [];
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }

  return true;
}

async function existingLocalDevIds(
  ids: BiomesId[],
  service: ShimWorldService | undefined,
  worldApi: WorldApi
) {
  if (service) {
    return new Set(ids.filter((id) => service.table.get(id) !== undefined));
  }
  const existingIds = new Set<BiomesId>();
  for (let start = 0; start < ids.length; start += 500) {
    const batch = ids.slice(start, start + 500);
    for (const id of (await worldApi.has(batch)) as BiomesId[]) {
      existingIds.add(id);
    }
    log.warn("Checked local dev seed id batch", {
      checked: start + batch.length,
      total: ids.length,
      existingIds: existingIds.size,
    });
  }
  return existingIds;
}

/**
 * HARTHMERE_EXTENSION_SURFACE_SOLIDITY (sunken-forest fix, 2026-07-28)
 *
 * Terrain seeding used to decide "this shard is fine" purely from whether the
 * ENTITY ID EXISTS. That test cannot see a shard whose record is present but
 * whose tensor has no ground at Y=52, and — worse — it treats a shard that was
 * never written as fine as soon as some later pass creates the record. The
 * 2026-07-28 capture showed the consequence in the live world: surface shards
 * absent or holed, columns falling to the foundation top at Y=31, and 32x32
 * black pits in the wilds forest with NPCs and livestock grounded on the floor.
 *
 * This asks the question the old test should have asked: is the flat plane
 * actually solid? Any surface shard that answers no is added to the rebuild
 * set, so a boot with terrain seeding enabled self-heals instead of skipping.
 *
 * The read is bounded — one tensor per surface shard, and it only runs on the
 * maintenance revision where terrain creation is enabled at all.
 */
async function harthmereUnsolidSurfaceTerrainIds(
  voxeloo: VoxelooModule,
  service: ShimWorldService | undefined,
  worldApi: WorldApi,
  existingIds: Set<BiomesId>
): Promise<Set<BiomesId>> {
  const unsolid = new Set<BiomesId>();
  if (!shouldUseHarthmereExtraTownOffset()) {
    return unsolid;
  }
  const specs = harthmereSurfaceRepairShardSpecs().filter((spec) =>
    existingIds.has(spec.id as BiomesId)
  );
  const readEntity = async (id: BiomesId) => {
    if (service) {
      return service.table.get(id);
    }
    const [entity] = await worldApi.get([id]);
    return entity;
  };
  for (const spec of specs) {
    const id = spec.id as BiomesId;
    let entity: any;
    try {
      entity = await readEntity(id);
    } catch {
      unsolid.add(id);
      continue;
    }
    const seed = entity?.shardSeed?.() ?? entity?.shard_seed;
    if (!seed) {
      unsolid.add(id);
      continue;
    }
    const v0 = shardToVoxelPos(spec.shardX, spec.shardY, spec.shardZ);
    const localGroundY = STARTER_TOWN_GROUND_Y - v0[1];
    let seedTerrain: ReturnType<typeof loadSeed> | undefined;
    try {
      seedTerrain = loadSeed(voxeloo, {
        id,
        shard_seed: seed,
      });
      if (!seedTerrain) {
        unsolid.add(id);
        continue;
      }
      let holed = false;
      for (let localZ = 0; localZ < SHARD_DIM && !holed; localZ += 1) {
        for (let localX = 0; localX < SHARD_DIM; localX += 1) {
          const worldX = v0[0] + localX;
          const worldZ = v0[2] + localZ;
          if (
            harthmereIsBellbinderSurfaceOpening(
              harthmereAuthoredWorldX(worldX),
              STARTER_TOWN_GROUND_Y,
              harthmereAuthoredWorldZ(worldZ)
            )
          ) {
            continue;
          }
          // HARTHMERE_AUTHORED_WATER: the Brell's channel and the mill race are
          // open by design. Counting them as holes marked every river shard
          // "unsolid" on every boot, which queued an endless rebuild and fed
          // the surface repair that filled the river in with dirt.
          if (isHarthmereAuthoredWaterColumn(worldX, worldZ)) {
            continue;
          }
          if (!Number(seedTerrain.get(localX, localGroundY, localZ))) {
            holed = true;
            break;
          }
        }
      }
      if (holed) {
        unsolid.add(id);
      }
    } catch {
      unsolid.add(id);
    } finally {
      seedTerrain?.delete?.();
    }
  }
  if (unsolid.size) {
    log.warn("Harthmere surface shards are not solid at the flat plane", {
      version: HARTHMERE_EXTENSION_SURFACE_REPAIR_VERSION,
      groundY: STARTER_TOWN_GROUND_Y,
      checkedSurfaceShards: specs.length,
      unsolidSurfaceShards: unsolid.size,
      sample: [...unsolid].slice(0, 8),
    });
  }
  return unsolid;
}

async function ensureHarthmereAdditiveWorldBoundary(
  service: ShimWorldService | undefined,
  worldApi: WorldApi,
  extensionTerrainAlreadyExists: boolean
) {
  if (!shouldUseHarthmereExtraTownOffset()) {
    return false;
  }

  // Read through the concrete shim entity when available and through the lazy
  // WorldApi entity in Redis-backed production. Keeping the two paths explicit
  // avoids accidentally serializing lazy component accessors into ECS state.
  let current: ReadonlyWorldMetadata | undefined;
  let currentEntityExists = false;
  if (service) {
    const currentEntity = service.table.get(WorldMetadataId);
    currentEntityExists = currentEntity !== undefined;
    current = currentEntity?.world_metadata;
  } else {
    const currentEntity = await worldApi.get(WorldMetadataId);
    currentEntityExists = currentEntity !== undefined;
    current = currentEntity?.worldMetadata();
  }
  if (!current) {
    // A brand-new snapshot can legitimately have no WorldMetadata entity yet.
    // Create only that singleton component so the normal extension terrain can
    // seed itself; no existing terrain or entity is modified by this bootstrap.
    const initial = initialHarthmereWorldAabb();
    const tick = service ? service.table.tick + 1 : 1;
    const change: Change = {
      kind: currentEntityExists ? "update" : "create",
      tick,
      entity: {
        id: WorldMetadataId,
        world_metadata: WorldMetadata.create({ aabb: initial }),
      },
    };
    if (service) {
      service.writeableTable.apply([change]);
    } else {
      const applied = await worldApi.apply({
        changes: [toProposedChange(change)],
      });
      if (applied.outcome !== "success") {
        log.error("Failed to create WorldMetadata for additive Harthmere", {
          version: HARTHMERE_ADDITIVE_WORLD_EXTENSION_VERSION,
          outcome: applied.outcome,
        });
        return false;
      }
    }
    log.warn("Created WorldMetadata for fresh additive Harthmere world", {
      version: HARTHMERE_ADDITIVE_WORLD_EXTENSION_VERSION,
      aabb: initial,
    });
    return true;
  }

  const currentEastEdge = current.aabb.v1[0];
  if (
    !extensionTerrainAlreadyExists &&
    currentEastEdge > HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X &&
    currentEastEdge !== HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X &&
    currentEastEdge !== CH1_ELSEWHEN_BAND_END_X
  ) {
    // A differently-expanded world may already own part of X=1792..2559.
    // Refuse to guess: automatic add-only seeding is safe only against the
    // known original edge, our exact idempotent bound, or our own terrain IDs.
    log.error("Refusing Harthmere extension over an unknown expanded map", {
      version: HARTHMERE_ADDITIVE_WORLD_EXTENSION_VERSION,
      currentEastEdge,
      expectedOriginalEastEdge: HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
      expectedExtensionEastEdge: HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X,
      expectedChapter1EastEdge: CH1_ELSEWHEN_BAND_END_X,
    });
    return false;
  }

  const expanded = expandWorldAabbForHarthmere(current.aabb);
  // v2 incorrectly advertised detached Elsewhen instances as continuous world
  // terrain. Migrate that exact known boundary back to Harthmere's real east
  // edge; other pre-existing world sizes remain untouched.
  expanded.v1[0] = ch1NormalizeOrdinaryWorldEastEdge(expanded.v1[0]);
  if (
    expanded.v0.every((value, index) => value === current.aabb.v0[index]) &&
    expanded.v1.every((value, index) => value === current.aabb.v1[index])
  ) {
    return true;
  }

  const tick = service ? service.table.tick + 1 : 1;
  const change: Change = {
    kind: "update",
    tick,
    entity: {
      id: WorldMetadataId,
      world_metadata: WorldMetadata.create({ aabb: expanded }),
    },
  };
  if (service) {
    service.writeableTable.apply([change]);
  } else {
    const applied = await worldApi.apply({
      changes: [toProposedChange(change)],
    });
    if (applied.outcome !== "success") {
      log.error("Failed to expand the Harthmere world-map boundary", {
        version: HARTHMERE_ADDITIVE_WORLD_EXTENSION_VERSION,
        outcome: applied.outcome,
      });
      return false;
    }
  }
  log.warn("Expanded world metadata for additive Harthmere terrain", {
    version: HARTHMERE_ADDITIVE_WORLD_EXTENSION_VERSION,
    previous: current.aabb,
    expanded,
  });
  return true;
}

// PRODUCTION_CONTENT_SYNC:
// When a real (non-local) world already exists we must NOT rebuild or overwrite
// terrain. But authored CONTENT added since the world was first seeded (e.g. the
// business owner NPCs) would otherwise never appear in production, because the
// terrain guard used to `return` and skip the whole seed. This creates missing
// authored content and performs a small reviewed set of idempotent retirements
// (obsolete hostiles and session-only business customers), without touching
// terrain or deleting arbitrary world/player content.
async function seedMissingLocalDevContentIntoExistingWorld(
  service: ShimWorldService | undefined,
  worldApi: WorldApi
) {
  await reconcileSnapshotMinigameCatalog(worldApi);
  const tick = service ? service.table.tick + 1 : 1;
  const nowSeconds = secondsSinceEpoch();
  // An empty existingIds set makes every builder emit "create" changes; we then
  // keep only the ones whose id is genuinely absent from the live world.
  const emptyIds = new Set<BiomesId>();
  const candidate: Change[] = [
    ...makeLocalDevNpcChanges(tick, emptyIds),
    ...makeLocalDevChapter1NpcChanges(tick, emptyIds),
    ...makeLocalDevSnapshotGroveNpcChanges(tick, emptyIds),
    ...makeLocalDevSnapshotCombatNpcChanges(tick, emptyIds),
    ...buildHarthmereLiveEntityProductionSeedChanges({
      tick,
      nowSeconds,
      existingIds: emptyIds,
    }),
    ...buildHarthmereGroveRaceMinigameSeedChanges({
      tick,
      nowSeconds,
      existingIds: emptyIds,
    }),
    ...buildHarthmereBusinessOwnerNpcSeedChanges({
      tick,
      nowSeconds,
      existingIds: emptyIds,
    }),
    ...buildHarthmereBusinessCraftingStationSeedChanges({
      tick,
      nowSeconds,
      existingIds: emptyIds,
    }),
    ...buildHarthmereBusinessInteriorCollisionSeedChanges({
      tick,
      existingIds: emptyIds,
    }),
    ...buildHarthmereAdditiveTownInteriorCollisionSeedChanges({
      tick,
      existingIds: emptyIds,
    }),
    ...buildHarthmereAdditiveTownCookingStationSeedChanges({
      tick,
      nowSeconds,
      existingIds: emptyIds,
    }),
    ...buildHarthmereRequestBoardEcsSeedChanges({
      tick,
      existingIds: emptyIds,
    }),
  ];
  const createChanges = candidate.filter((change) => change.kind === "create");
  const createIds = createChanges.map((change) =>
    change.kind === "create" ? change.entity.id : (0 as BiomesId)
  );
  const present = await existingLocalDevIds(createIds, service, worldApi);
  const missing = createChanges.filter(
    (change) => change.kind === "create" && !present.has(change.entity.id)
  );

  const testimonyCandidateIds = [
    ...CH1_TESTIMONY_NPC_SEEDS.map((seed) => seed.entityId),
    ...CH1_RETIRED_DUPLICATE_TESTIMONY_NPC_IDS,
  ];
  const presentTestimonyIds = await existingLocalDevIds(
    testimonyCandidateIds,
    service,
    worldApi
  );
  const testimonyReconciliations = makeLocalDevChapter1TestimonyNpcChanges(
    tick,
    presentTestimonyIds
  ).filter((change) => change.kind === "update" || change.kind === "delete");

  // Also remove authored content that should no longer exist — currently the
  // muck monsters that now resolve inside a safe zone (e.g. the road_muckwad
  // muckers sitting inside the Grove). These were created by an earlier seed and
  // must be deleted through the proper ECS delete path.
  const excludedMuckIds = harthmereExcludedMuckMonsterSeedIds();
  const presentExcludedMuck = await existingLocalDevIds(
    excludedMuckIds,
    service,
    worldApi
  );
  const obsoleteDeletes: Change[] = excludedMuckIds
    .filter((id) => presentExcludedMuck.has(id))
    .map((id) => ({ kind: "delete", tick, id }));

  // Business patrons are simulated per active session. Earlier revisions
  // persisted 57 of them as permanent ECS residents, creating the crowd of
  // generic townspeople seen in the HAR. Retire only that reserved stable band;
  // owners, employees, quest actors, and named residents remain persistent.
  const retiredCustomerIds = localDevBusinessCustomerNpcIds();
  const presentRetiredCustomerIds = await existingLocalDevIds(
    retiredCustomerIds,
    service,
    worldApi
  );
  const retiredCustomerDeletes = makeRetiredBusinessCustomerNpcChanges(
    tick,
    presentRetiredCustomerIds
  );

  // HARTHMERE_REQUEST_BOARDS: thaw the four snapshot request boards.
  //
  // Fishing, Collective Research, Farming Bounties and Industrial Job Board
  // all survive in the snapshot complete with their quest_giver components and
  // their twenty listings — but every one of them carries `iced`, so the whole
  // catalogue is unreachable. Clearing that one component is the entire
  // restore; nothing else about them needs rebuilding.
  //
  // `iced: null` is how this ECS clears a component on an update, and the pass
  // is idempotent: a board that is already thawed simply is not in the set.
  const icedBoardIds = [...HARTHMERE_ICED_BOARD_ENTITY_IDS];
  const presentBoards = await existingLocalDevIds(
    icedBoardIds,
    service,
    worldApi
  );
  const boardThaws: Change[] = icedBoardIds
    .filter((id) => presentBoards.has(id))
    .map((id) => ({
      kind: "update",
      tick,
      entity: { id, iced: null },
    })) as Change[];

  const toApply: Change[] = [
    ...missing,
    ...testimonyReconciliations,
    ...obsoleteDeletes,
    ...retiredCustomerDeletes,
    ...boardThaws,
  ];
  if (toApply.length === 0) {
    log.info(
      "PRODUCTION_CONTENT_SYNC: all authored content already present; nothing to seed."
    );
    return;
  }
  log.warn(
    "PRODUCTION_CONTENT_SYNC: reconciling authored content in existing world",
    {
      created: missing.length,
      reconciledChapter1TestimonyNpcs: testimonyReconciliations.length,
      deletedObsoleteMuck: obsoleteDeletes.length,
      retiredPersistentBusinessCustomers: retiredCustomerDeletes.length,
      thawedRequestBoards: boardThaws.length,
      ...firstAndLastLocalDevSeedIds(missing),
    }
  );
  if (service) {
    service.writeableTable.apply(toApply);
  } else {
    await applyLocalDevSeedChangesInDebugBatches(worldApi, toApply);
  }
}

// HARTHMERE_EDGE_HORIZON_PRODUCTION_TERRAIN_SYNC:
// Production snapshots disable the broad generated-town terrain pass because
// existing imported terrain must never be rebuilt in place. The edge horizon
// occupies new stable shard ids outside the playable Z band, so it is safe to
// create only those missing shards without updating or deleting any existing
// terrain entity.
async function seedMissingHarthmereEdgeHorizonTerrainIntoExistingWorld(
  service: ShimWorldService | undefined,
  worldApi: WorldApi
) {
  const specs = harthmereExtensionEdgeHorizonShardSpecs().map((spec) => {
    const id = harthmereExtensionTerrainEntityIdForShard(
      spec.shardX,
      spec.shardY,
      spec.shardZ
    );
    if (id === undefined) {
      throw new Error(
        `Harthmere edge horizon shard is outside the stable id grid: ` +
          `${spec.shardX}:${spec.shardY}:${spec.shardZ}`
      );
    }
    return { ...spec, id: id as BiomesId };
  });
  const present = await existingLocalDevIds(
    specs.map((spec) => spec.id),
    service,
    worldApi
  );
  const missing = specs.filter((spec) => !present.has(spec.id));
  if (missing.length === 0) {
    log.info(
      "HARTHMERE_EDGE_HORIZON_PRODUCTION_TERRAIN_SYNC: all visual edge terrain already present."
    );
    return;
  }

  const voxeloo = await loadVoxeloo();
  const tick = service ? service.table.tick + 1 : 1;
  const changes = missing.map((spec) =>
    makeLocalDevTerrainShard(
      voxeloo,
      "create",
      spec.id,
      spec.shardX,
      spec.shardY,
      spec.shardZ,
      tick
    )
  );
  log.warn(
    "HARTHMERE_EDGE_HORIZON_PRODUCTION_TERRAIN_SYNC: creating missing visual edge terrain",
    {
      created: changes.length,
      totalAuthoredShards: specs.length,
      ...firstAndLastLocalDevSeedIds(changes),
    }
  );

  if (service) {
    for (const batch of localDevSeedChangeBatches(
      changes,
      LOCAL_DEV_TERRAIN_BUILD_APPLY_BATCH_SIZE
    )) {
      service.writeableTable.apply(batch);
    }
  } else {
    await applyLocalDevSeedChangesInDebugBatches(worldApi, changes);
  }
}

// CHAPTER_1_PRODUCTION_TERRAIN_SYNC:
// Existing production snapshots deliberately disable the broad local-dev town
// terrain generator, but the two Elsewhen dungeons live in a new, reserved
// additive band and have no legacy snapshot terrain to preserve. Create only
// missing stable Chapter 1 shard ids; never update or delete an existing shard.
async function seedMissingChapter1TerrainIntoExistingWorld(
  service: ShimWorldService | undefined,
  worldApi: WorldApi
) {
  const specs = localDevChapter1TerrainShardSpecs();
  const present = await existingLocalDevIds(
    specs.map((spec) => spec.id),
    service,
    worldApi
  );
  const missing = specs.filter((spec) => !present.has(spec.id));
  if (missing.length === 0) {
    log.info(
      "CHAPTER_1_PRODUCTION_TERRAIN_SYNC: all Elsewhen terrain already present."
    );
    return;
  }

  const voxeloo = await loadVoxeloo();
  const tick = service ? service.table.tick + 1 : 1;
  const changes = missing.map((spec) =>
    makeLocalDevChapter1TerrainShard(
      voxeloo,
      "create",
      spec.id,
      spec.shardX,
      spec.shardY,
      spec.shardZ,
      tick
    )
  );
  log.warn(
    "CHAPTER_1_PRODUCTION_TERRAIN_SYNC: creating missing Elsewhen terrain",
    {
      created: changes.length,
      totalAuthoredShards: specs.length,
      ...firstAndLastLocalDevSeedIds(changes),
    }
  );

  if (service) {
    for (const batch of localDevSeedChangeBatches(
      changes,
      LOCAL_DEV_TERRAIN_BUILD_APPLY_BATCH_SIZE
    )) {
      service.writeableTable.apply(batch);
    }
  } else {
    await applyLocalDevSeedChangesInDebugBatches(worldApi, changes);
  }
}

async function seedLocalDevTerrainIfMissing(
  service: ShimWorldService | undefined,
  worldApi: WorldApi
) {
  if (!shouldSeedLocalDevTerrain()) {
    if (shouldUseHarthmereExtraTownOffset()) {
      // Production snapshot deployments deliberately disable generated terrain
      // while still requiring newly authored NPCs, quest givers, businesses,
      // and stations. Returning here used to skip that create-only content
      // reconciliation too, leaving exact quest target IDs permanently absent.
      // Keep existing terrain untouched, but self-heal missing additive content
      // and create-only horizon/dungeon terrain on boot.
      log.info(
        "Harthmere town terrain generation is disabled; syncing missing authored content and create-only additive terrain."
      );
      const firstExtensionTerrainId = localDevTerrainShardSpecs()[0]?.id;
      const extensionTerrainAlreadyExists = firstExtensionTerrainId
        ? (
            await existingLocalDevIds(
              [firstExtensionTerrainId],
              service,
              worldApi
            )
          ).has(firstExtensionTerrainId)
        : false;
      if (
        !(await ensureHarthmereAdditiveWorldBoundary(
          service,
          worldApi,
          extensionTerrainAlreadyExists
        ))
      ) {
        return;
      }
      await seedMissingHarthmereEdgeHorizonTerrainIntoExistingWorld(
        service,
        worldApi
      );
      await seedMissingLocalDevContentIntoExistingWorld(service, worldApi);
      await seedMissingChapter1TerrainIntoExistingWorld(service, worldApi);
      // Terrain is intentionally untouched in this branch, but existing
      // authored NPCs still need versioned coordinate/identity updates. This
      // is what moves the single canonical Sergeant Holt body to the Grove
      // watch house and prevents a stale remote expression target.
      await reconcileLocalDevRuntimeContent(service, worldApi);
      await reconcileLocalDevPlayerLikeNpcCosmetics(service, worldApi);
    }
    return;
  }

  const firstExtensionTerrainId = localDevTerrainShardSpecs()[0]?.id;
  const extensionTerrainAlreadyExists = firstExtensionTerrainId
    ? (
        await existingLocalDevIds([firstExtensionTerrainId], service, worldApi)
      ).has(firstExtensionTerrainId)
    : false;
  // Map metadata must include the new shard band before clients receive town
  // landmarks or terrain changes. This is idempotent and never shrinks bounds.
  if (
    !(await ensureHarthmereAdditiveWorldBoundary(
      service,
      worldApi,
      extensionTerrainAlreadyExists
    ))
  ) {
    return;
  }

  if (
    service &&
    hasNonLocalTerrainShard(service) &&
    !shouldUseHarthmereExtraTownOffset()
  ) {
    // PRODUCTION_CONTENT_SYNC: existing non-local terrain — do NOT rebuild
    // terrain, but still create any missing authored content (e.g. business
    // owner NPCs) so new content reaches production without a terrain reseed.
    log.info(
      "Existing non-local terrain detected; syncing missing authored content and additive NPC cosmetics only."
    );
    await seedMissingLocalDevContentIntoExistingWorld(service, worldApi);
    // The imported production world already contains most NPC ids, so a
    // create-only sync cannot repair their stale shared appearance components.
    // The versioned reconciler performs the component-only cosmetic migration.
    await reconcileLocalDevPlayerLikeNpcCosmetics(service, worldApi);
    return;
  }

  const terrainIds = localDevTerrainShardSpecs().map((spec) => spec.id);
  const chapter1TerrainIds = localDevChapter1TerrainShardSpecs().map(
    (spec) => spec.id
  );
  const npcIds = starterTownNpcs().map((npc) => npc.id);
  const chapter1NpcIds = localDevChapter1NpcIds();
  const snapshotGroveNpcIds = localDevSnapshotGroveNpcIds();
  const snapshotCombatNpcIds = localDevSnapshotCombatNpcIds();
  const liveEntityProductionSeedIds = localDevLiveEntityProductionSeedIds();
  const groveRaceMinigameSeedIds = localDevGroveRaceMinigameSeedIds();
  const businessOwnerNpcIds = localDevBusinessOwnerNpcIds();
  const retiredBusinessCustomerNpcIds = localDevBusinessCustomerNpcIds();
  const businessCraftingStationIds = localDevBusinessCraftingStationIds();
  const businessInteriorCollisionIds = localDevBusinessInteriorCollisionIds();
  const additiveTownInteriorCollisionIds =
    harthmereAdditiveTownInteriorCollisionSeedEntityIds();
  const additiveTownCookingStationIds =
    harthmereAdditiveTownCookingStationSeedEntityIds();
  const requestBoardEcsSeedIds = localDevRequestBoardEcsSeedIds();
  const chapter1PropIds = chapter1PropSeedIds();
  const legacyTerrainIds = localDevLegacyTerrainShardIds();
  const activeTerrainIds = new Set(terrainIds);
  const expectedSeedIds = [
    ...terrainIds,
    ...chapter1TerrainIds,
    ...npcIds,
    ...chapter1NpcIds,
    ...chapter1PropIds,
    ...snapshotGroveNpcIds,
    ...snapshotCombatNpcIds,
    ...liveEntityProductionSeedIds,
    ...groveRaceMinigameSeedIds,
    ...businessOwnerNpcIds,
    ...businessCraftingStationIds,
    ...businessInteriorCollisionIds,
    ...additiveTownInteriorCollisionIds,
    ...additiveTownCookingStationIds,
    ...requestBoardEcsSeedIds,
  ];
  const seedFingerprint = makeLocalDevSeedFingerprint({
    terrainIds,
    chapter1TerrainIds,
    npcIds,
    chapter1NpcIds,
    chapter1PropIds,
    snapshotGroveNpcIds,
    snapshotCombatNpcIds,
    liveEntityProductionSeedIds,
    groveRaceMinigameSeedIds,
    businessOwnerNpcIds,
    retiredBusinessCustomerNpcIds,
    businessCraftingStationIds,
    businessInteriorCollisionIds,
    additiveTownInteriorCollisionIds,
    additiveTownCookingStationIds,
    requestBoardEcsSeedIds,
  });
  const previousAdditiveTerrainIds = await existingPreviousAdditiveTerrainIds(
    service,
    worldApi
  );
  const existingIds = await existingLocalDevIds(
    [
      ...new Set([
        ...expectedSeedIds,
        LOCAL_DEV_SEED_MARKER_ID,
        LOCAL_DEV_RUNTIME_CONTENT_MARKER_ID,
        ...legacyTerrainIds,
        ...retiredBusinessCustomerNpcIds,
      ]),
    ],
    service,
    worldApi
  );
  for (const id of previousAdditiveTerrainIds) {
    existingIds.add(id);
  }
  const terrainMigrationMode = terrainSeedMigrationMode();
  const shouldRewriteExistingTerrain =
    terrainSeedModeRewritesExistingShards(terrainMigrationMode);
  const obsoleteLocalDevIds =
    terrainMigrationMode === "additive"
      ? []
      : shouldUseHarthmereExtraTownOffset()
        ? [...previousAdditiveTerrainIds]
        : legacyTerrainIds.filter(
            (id) => existingIds.has(id) && !activeTerrainIds.has(id)
          );
  const allExpectedSeedIdsExist = allExpectedLocalDevSeedIdsExist(
    expectedSeedIds,
    existingIds
  );
  const markerFingerprint = await localDevSeedMarkerFingerprint(
    service,
    worldApi
  );
  const terrainIdsToBuild = new Set<BiomesId>();
  const authoredWaterOnlyIds = new Set<BiomesId>();
  const addMissing = (ids: readonly BiomesId[]) => {
    for (const id of ids) {
      if (!existingIds.has(id)) {
        terrainIdsToBuild.add(id);
      }
    }
  };
  addMissing(terrainIds);
  addMissing(chapter1TerrainIds);
  // HARTHMERE_EXTENSION_SURFACE_SOLIDITY: an existing shard id is not proof of
  // authored ground. Inspect shard_seed only: a player's deliberate hole in
  // shard_diff must never turn into a request to rebuild their terrain.
  const unsolidSurfaceIds = await harthmereUnsolidSurfaceTerrainIds(
    await loadVoxeloo(),
    service,
    worldApi,
    existingIds
  );
  for (const id of unsolidSurfaceIds) {
    terrainIdsToBuild.add(id);
  }
  // HARTHMERE_AUTHORED_WATER: re-assert the river on EVERY deploy.
  //
  // Two separate reasons this is unconditional rather than opt-in or
  // conditional on a diff:
  //
  //   * it used to sit behind BIOMES_MIGRATE_HARTHMERE_AUTHORED_WATER=1, so an
  //     ordinary deploy left the carved channel dry and the next surface-repair
  //     pass filled it in with soil;
  //   * worlds deployed before this fix already have the channel PAVED OVER in
  //     their seed. Now that river columns no longer count as "unsolid", the
  //     hole detector will never ask for those shards again — so nothing else
  //     would ever restore the carve.
  //
  // These shards therefore get a FULL authored rebuild (seed and water), not a
  // water-only patch, which is what puts the channel back and fills it in one
  // pass. It re-writes identical bytes for a healthy world; the cost is a few
  // dozen shards along the Brell, and the alternative is a river that silently
  // disappears again.
  if (!shouldRewriteExistingTerrain) {
    for (const spec of localDevTerrainShardSpecs()) {
      if (
        existingIds.has(spec.id) &&
        localDevTerrainShardHasAuthoredWater(
          spec.shardX,
          spec.shardY,
          spec.shardZ
        )
      ) {
        terrainIdsToBuild.add(spec.id);
      }
    }
  }
  if (shouldRewriteExistingTerrain) {
    for (const id of [...terrainIds, ...chapter1TerrainIds]) {
      terrainIdsToBuild.add(id);
    }
  }
  const terrainPartitionCount = Number.parseInt(
    process.env.BIOMES_HARTHMERE_TERRAIN_PARTITION_COUNT ?? "1",
    10
  );
  const terrainPartitionIndex = Number.parseInt(
    process.env.BIOMES_HARTHMERE_TERRAIN_PARTITION_INDEX ?? "0",
    10
  );
  if (terrainPartitionCount > 1) {
    const ownedTerrainIds = partitionTerrainSeedIds(
      new Set([...terrainIds, ...chapter1TerrainIds]),
      terrainPartitionCount,
      terrainPartitionIndex
    );
    for (const id of terrainIdsToBuild) {
      if (!ownedTerrainIds.has(id)) {
        terrainIdsToBuild.delete(id);
      }
    }
    log.warn("Partitioned additive terrain maintenance", {
      partitionCount: terrainPartitionCount,
      partitionIndex: terrainPartitionIndex,
      terrainShardsToBuild: terrainIdsToBuild.size,
    });
  }
  if (
    !shouldRewriteExistingTerrain &&
    allExpectedSeedIdsExist &&
    // A current fingerprint over holed terrain is exactly how the sunken-forest
    // pits survived every boot. Solid ground is now part of "already seeded".
    unsolidSurfaceIds.size === 0 &&
    terrainIdsToBuild.size === 0 &&
    obsoleteLocalDevIds.length === 0 &&
    markerFingerprint === seedFingerprint
  ) {
    log.info(
      "Skipping local dev starter town seed; fingerprint already current.",
      {
        fingerprintVersion: HARTHMERE_LOCAL_DEV_SEED_FINGERPRINT_VERSION,
        expectedSeedIds: expectedSeedIds.length,
        terrainShards: terrainIds.length,
        chapter1TerrainShards: chapter1TerrainIds.length,
        npcs:
          npcIds.length +
          chapter1NpcIds.length +
          snapshotGroveNpcIds.length +
          snapshotCombatNpcIds.length +
          liveEntityProductionSeedIds.length,
        groveRaceMinigameSeeds: groveRaceMinigameSeedIds.length,
        runtimeOffsetX: harthmereExtraTownOffsetX(),
        runtimeOffsetZ: harthmereExtraTownOffsetZ(),
      }
    );
    await reconcileLocalDevRuntimeContent(service, worldApi);
    return;
  }
  if (
    !shouldRewriteExistingTerrain &&
    allExpectedSeedIdsExist &&
    unsolidSurfaceIds.size === 0 &&
    terrainIdsToBuild.size === 0 &&
    obsoleteLocalDevIds.length === 0 &&
    !markerFingerprint &&
    process.env.BIOMES_ENABLE_MARKERLESS_LOCAL_DEV_SEED_ADOPTION === "1"
  ) {
    const stamped = await stampLocalDevSeedMarker(
      service,
      worldApi,
      existingIds,
      seedFingerprint
    );
    if (stamped) {
      log.info(
        "Adopted existing markerless local dev starter town seed; future boots can skip terrain rebuild.",
        {
          fingerprintVersion: HARTHMERE_LOCAL_DEV_SEED_FINGERPRINT_VERSION,
          expectedSeedIds: expectedSeedIds.length,
          terrainShards: terrainIds.length,
          chapter1TerrainShards: chapter1TerrainIds.length,
          npcs:
            npcIds.length +
            chapter1NpcIds.length +
            snapshotGroveNpcIds.length +
            snapshotCombatNpcIds.length +
            liveEntityProductionSeedIds.length,
          groveRaceMinigameSeeds: groveRaceMinigameSeedIds.length,
          runtimeOffsetX: harthmereExtraTownOffsetX(),
          runtimeOffsetZ: harthmereExtraTownOffsetZ(),
        }
      );
      await reconcileLocalDevRuntimeContent(service, worldApi);
      return;
    }
  }

  if (
    terrainMigrationMode === "additive" &&
    markerFingerprint &&
    markerFingerprint !== seedFingerprint
  ) {
    log.warn(
      "Local dev seed content changed; additive terrain mode will preserve every existing terrain shard.",
      {
        action:
          "Use the reviewed --migrate-existing-terrain deployment option only when the authored seed itself must change on existing shards.",
        terrainShardsToCreateOrRepair: terrainIdsToBuild.size,
      }
    );
  }

  const voxeloo = await loadVoxeloo();
  log.warn("Seeding local dev starter town terrain", {
    contentPass: HARTHMERE_LOCAL_DEV_SEED_CONTENT_PASS,
    npcPositionOverrideVersion: HARTHMERE_NPC_POSITION_OVERRIDE_VERSION,
    performanceProfile: HARTHMERE_LOCAL_DEV_PERF_PROFILE,
    fingerprintVersion: HARTHMERE_LOCAL_DEV_SEED_FINGERPRINT_VERSION,
    markerFingerprintMatched: markerFingerprint === seedFingerprint,
    markerFingerprintPresent: Boolean(markerFingerprint),
    terrainMigrationMode,
    rewritesExistingTerrain: shouldRewriteExistingTerrain,
    authoredWaterOnlyShards: authoredWaterOnlyIds.size,
    obsoleteLocalDevIds: obsoleteLocalDevIds.length,
    terrainShardSpecs: terrainIds.length,
    harvestableTreeCenters: HARTHMERE_HARVESTABLE_TREE_CENTERS.length,
    harvestableOreClusters: HARTHMERE_HARVESTABLE_ORE_CENTERS.length,
    harvestableForageClusters: HARTHMERE_HARVESTABLE_FORAGE_CENTERS.length,
    fastHarvestableBlocks: HARTHMERE_FAST_HARVESTABLE_BLOCK_BY_COORD.size,
    x: [
      STARTER_TOWN_WILDS_X0 + harthmereExtraTownOffsetX(),
      STARTER_TOWN_WILDS_X1 + harthmereExtraTownOffsetX(),
    ],
    z: [
      STARTER_TOWN_WILDS_Z0 + harthmereExtraTownOffsetZ(),
      STARTER_TOWN_WILDS_Z1 + harthmereExtraTownOffsetZ(),
    ],
  });
  const tick = service ? service.table.tick + 1 : 1;
  let terrainWasAppliedSeparately = false;
  if (!service) {
    const applied = await buildAndApplyLocalDevTerrainSeedBatches(
      voxeloo,
      tick,
      existingIds,
      worldApi,
      terrainIdsToBuild,
      authoredWaterOnlyIds
    );
    if (!applied) {
      return;
    }
    terrainWasAppliedSeparately = true;
  }
  if (
    terrainPartitionCount > 1 &&
    process.env.BIOMES_HARTHMERE_TERRAIN_PARTITION_ONLY === "1"
  ) {
    log.warn("Completed additive terrain maintenance partition", {
      partitionCount: terrainPartitionCount,
      partitionIndex: terrainPartitionIndex,
      terrainShardsBuilt: terrainIdsToBuild.size,
    });
    return;
  }
  const changes = makeLocalDevMiniWorldChanges(
    voxeloo,
    tick,
    existingIds,
    seedFingerprint,
    !terrainWasAppliedSeparately,
    terrainIdsToBuild,
    authoredWaterOnlyIds
  );
  changes.push(
    ...makeLocalDevStaleTerrainDeletes(tick, new Set(terrainIds), existingIds)
  );

  if (service) {
    log.warn("Applying local dev starter town seed changes to shim table", {
      ...summarizeLocalDevSeedChanges(changes),
      ...firstAndLastLocalDevSeedIds(changes),
    });
    service.writeableTable.apply(changes);
  } else {
    const applied = await applyLocalDevSeedChangesInDebugBatches(
      worldApi,
      changes
    );
    if (!applied) {
      return;
    }
  }

  const terrainUpdateCount = terrainWasAppliedSeparately
    ? terrainIdsToBuild.size
    : changes.filter(
        (change) =>
          (change.kind === "create" || change.kind === "update") &&
          ((change.entity.id >= LOCAL_DEV_TERRAIN_ID_BASE &&
            change.entity.id < LOCAL_DEV_TERRAIN_ID_LIMIT) ||
            chapter1TerrainIds.includes(change.entity.id))
      ).length;
  const npcUpdates = changes.filter(
    (change) =>
      (change.kind === "create" || change.kind === "update") &&
      change.entity.id >= LOCAL_DEV_NPC_ID_BASE &&
      change.entity.id < LOCAL_DEV_NPC_ID_LIMIT
  );

  log.warn("Seeded local dev starter town", {
    contentPass: HARTHMERE_LOCAL_DEV_SEED_CONTENT_PASS,
    npcPositionOverrideVersion: HARTHMERE_NPC_POSITION_OVERRIDE_VERSION,
    performanceProfile: HARTHMERE_LOCAL_DEV_PERF_PROFILE,
    fingerprintVersion: HARTHMERE_LOCAL_DEV_SEED_FINGERPRINT_VERSION,
    terrainShards: terrainUpdateCount,
    chapter1TerrainShards: chapter1TerrainIds.length,
    npcs: npcUpdates.length,
    harvestableTreeCenters: HARTHMERE_HARVESTABLE_TREE_CENTERS.length,
    harvestableOreClusters: HARTHMERE_HARVESTABLE_ORE_CENTERS.length,
    harvestableForageClusters: HARTHMERE_HARVESTABLE_FORAGE_CENTERS.length,
    fastHarvestableBlocks: HARTHMERE_FAST_HARVESTABLE_BLOCK_BY_COORD.size,
    spawn: harthmereWorldPosition(STARTER_TOWN_SPAWN),
    groundY: STARTER_TOWN_GROUND_Y,
    runtimeOffsetX: harthmereExtraTownOffsetX(),
    runtimeOffsetZ: harthmereExtraTownOffsetZ(),
    x: [
      STARTER_TOWN_WILDS_X0 + harthmereExtraTownOffsetX(),
      HARTHMERE_EXPANDED_WORLD_EAST_EDGE_X,
    ],
    y: [-64, 96],
    z: [
      STARTER_TOWN_WILDS_Z0 + harthmereExtraTownOffsetZ(),
      STARTER_TOWN_WILDS_Z1 + harthmereExtraTownOffsetZ(),
    ],
  });
  // Full terrain seeding also runs the population policy so arbitrary stale
  // local-dev crowd rows (which are outside the deterministic seed-id list)
  // cannot survive merely because this boot took the terrain path.
  await reconcileLocalDevRuntimeContent(service, worldApi);
}

export async function registerShimWorldApi<C extends ShimServerContext>(
  loader: RegistryLoader<C>
) {
  const service = await loader.get("shimWorldService");
  if (service === undefined) {
    return registerWorldApi<C>({})(loader);
  }
  return ShimWorldApi.createForService(service);
}

export async function registerShimChatApi<C extends ShimServerContext>(
  loader: RegistryLoader<C>
) {
  return new InMemoryChatApi(await loader.get("playerSpatialObserver"));
}
interface ShimServerContext extends SharedServerContext {
  bootstrap: Bootstrap;
  chatApi: ChatApi;
  config: ShimServerConfig;
  db: BDB;
  firehose: Firehose;
  notifierService: ShimNotifierService;
  pubsubService: ShimPubSubService;
  playerSpatialObserver: PlayerSpatialObserver;
  rpcServer: ZrpcServer;
  shimWorldService?: ShimWorldService;
  worldApi: WorldApi;
}

async function start({
  bikkieRefresher,
  bikkieStorage,
  bootstrap,
  chatApi,
  config,
  db,
  firehose,
  notifierService,
  pubsubService,
  playerSpatialObserver,
  rpcServer,
  shimWorldService,
  worldApi,
}: ShimServerContext) {
  // Bootstrap Bikkie for our clients.
  if (config.bootstrapMode !== "empty" && config.biscuitMode === "memory") {
    if (
      process.env.GLITCH_SKIP_PROD_TRAY === "1" ||
      process.env.GLITCH_DISABLE_GCP === "1" ||
      process.env.GLITCH_RUNTIME === "1" ||
      !!process.env.GLITCH_TITLE_ID
    ) {
      log.info(
        "Skipping production tray definition load for Glitch/local runtime."
      );
    } else {
      await loadTrayDefinitionFromProd(bikkieStorage);
    }
    await bikkieStorage.save(await loadBakedTrayFromProd());
    // Force refresh of Bikkie in the Shim server itself.
    await bikkieRefresher.force();
  } else {
    // Set the fake Bikkie tray ID.
    notifierService.set("bikkie", String(BACKUP_BIKKIE_TRAY_ID));
    // Force refresh of Bikkie in the Shim server itself.
    log.info("Shim initializer: refreshing Bikkie");
    await bikkieRefresher.force();
    log.info("Shim initializer: Bikkie refresh complete");
    // Force-set the names in the DB to match the active bikkie tray.
    if (process.env.BIOMES_SKIP_BIKKIE_NAMES_WRITE === "1") {
      log.warn("Shim initializer: skipping Bikkie names write for maintenance");
    } else {
      log.info("Shim initializer: writing Bikkie names");
      await db
        .collection("bikkie")
        .doc("names")
        .set({
          idToName: encodeNames(getBiscuits().map((b) => [b.id, b.name])),
        });
      log.info("Shim initializer: Bikkie names write complete");
    }
  }

  // Start the player spatial observer, used for shim chat distribution.
  if (process.env.BIOMES_SKIP_PLAYER_SPATIAL_OBSERVER === "1") {
    log.warn(
      "Shim initializer: skipping player spatial observer for maintenance"
    );
  } else {
    log.info("Shim initializer: starting player spatial observer");
    await playerSpatialObserver.start();
    log.info("Shim initializer: player spatial observer ready");
  }

  // Bootstrap the world and chat.
  log.info("Bootstrapping shim world and chat...");
  const [changes, deliveries] = await bootstrap.load();
  if (chatApi instanceof InMemoryChatApi) {
    log.info(`Shim chat loaded ${deliveries.length}, ready to serve.`);
    chatApi.deliverAllForTest(deliveries);
  }
  if (shimWorldService) {
    shimWorldService.writeableTable.apply(changes);
    await seedLocalDevTerrainIfMissing(shimWorldService, worldApi);
    log.info(`Shim world loaded ${changes.length}, ready to serve.`);
    if (CONFIG.devResetAllPlayers) {
      log.info("Resetting all players...");
      for (const [
        _,
        [version, entity],
      ] of shimWorldService.table.deltaSince()) {
        if (!isPlayer(entity) || !entity.label?.text) {
          continue;
        }
        const delta = resetPlayerDelta(entity);
        // For shim, don't reset position or orientation.
        delta.position = undefined;
        delta.orientation = undefined;
        shimWorldService.writeableTable.apply([
          {
            kind: "update",
            tick: version.tick,
            entity: delta,
          },
        ]);
      }
    }
  }
  if (!shimWorldService) {
    await seedLocalDevTerrainIfMissing(undefined, worldApi);
  }
  await repairKnownSnapshotNpcGrounding(worldApi);

  // Expose all shim services.
  rpcServer.install(zShimNotifierService, notifierService);
  rpcServer.install(zServiceDiscoveryService, createShimServiceDiscovery());
  rpcServer.install(zShimPubSubService, pubsubService);
  rpcServer.install(
    zRemoteStorageService,
    new ExposeStorageService(db.backing)
  );
  rpcServer.install(
    zRemoteFirehoseService,
    new ExposeFirehoseService(firehose)
  );
  rpcServer.install(
    zShimBikkieStorageService,
    new ExposeBikkieStorageService(bikkieStorage)
  );
  rpcServer.install(zChatService, new ExposeChatService(chatApi));
  if (shimWorldService) {
    rpcServer.install(zWorldService, shimWorldService);
  }
  await rpcServer.start(HostPort.rpcPort);
}

void runServer(
  "shim",
  () =>
    new RegistryBuilder<ShimServerContext>()
      .install(sharedServerContext)
      .bind("bootstrap", registerBootstrap)
      .bind("config", registerShimServerConfig)
      .bind("db", registerBiomesStorage)
      .bind("worldApi", registerShimWorldApi)
      .bind(
        "firehose",
        async (loader) =>
          new InMemoryFirehose(loader.provide((context) => context.worldApi))
      )
      .bind("rpcServer", () => registerRpcServer())
      .bind("shimWorldService", registerShimWorldService)
      .bind("notifierService", async () => new ShimNotifierService())
      .bind("pubsubService", async () => new ShimPubSubService())
      .bind("playerSpatialObserver", registerPlayerSpatialObserver)
      .bind("chatApi", registerShimChatApi)
      .build(),
  async (context) => {
    await start(context);
  }
);
