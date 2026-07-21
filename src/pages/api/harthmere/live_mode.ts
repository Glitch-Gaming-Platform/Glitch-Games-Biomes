import { GameEvent } from "@/server/shared/api/game_event";
import type { AskApi } from "@/server/ask/api";
import type { LogicApi } from "@/server/shared/api/logic";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import type { WorldApi } from "@/server/shared/world/api";
import type { IdGenerator } from "@/server/shared/ids/generator";
import { ensurePlayerExists } from "@/server/logic/utils/players";
import { materializeHarthmereNativeEcsPlans } from "@/server/harthmere/native_ecs_drop_materialization";
import { connectToRedis } from "@/server/shared/redis/connection";
import { biomesApiHandler } from "@/server/web/util/api_middleware";
import { log } from "@/shared/logging";
import {
  harthmereLiveModeLedgerStreamKey,
  harthmereLiveModePlayerStateKey,
  harthmereLiveModeSharedWorldStateKey,
  createHarthmereLiveModeBuildingClientSnapshot,
  createHarthmereLiveModeBankingClientSnapshot,
  createHarthmereLiveModeGuildClientSnapshotFromBackend,
  createHarthmereInventoryLootClientSnapshotFromBackend,
  createHarthmereLiveModePlayerStatusClientSnapshot,
  createHarthmereProductionEconomyClientSnapshotFromBackend,
  createHarthmereJobsBoardClientSnapshotFromBackend,
  createHarthmereCareLoopClientSnapshotFromBackend,
  createHarthmereLiveModeFarmingFoodClientSnapshot,
  createHarthmereLiveEntityCombatClientSnapshot,
  createHarthmereCraftingStationClientSnapshotFromBackend,
  createHarthmereLiveModeQuestClientSnapshot,
  createHarthmereLiveModeSharedWorldState,
  defaultHarthmereLiveModeBackendState,
  mergeHarthmereLiveModeSharedWorldStateIntoBackend,
  parseHarthmereLiveModeBackendState,
  parseHarthmereLiveModeSharedWorldState,
  reduceHarthmereLiveModeBackendState,
  stringifyHarthmereLiveModePlayerPersistenceState,
  type HarthmereLiveModeBackendState,
} from "@/shared/harthmere/live_mode_backend";
import { buildHarthmereEscortCompanionNpcProposedChanges } from "@/server/harthmere/escort_companion_npc_ecs";
import {
  groundedBuildingSystemMaterializationPlan,
  type BuildingSystemAnyMaterializationPlan,
} from "@/shared/harthmere/building_system";
import {
  buildHarthmereLiveModePersistenceMutationPlan,
  createHarthmereLiveModeEvent,
  createHarthmereLiveModeUiEvent,
  type HarthmereLiveModeActionKind,
  type HarthmereLiveModeAnySubsystem,
  type HarthmereLiveModeAuthorityEnvelope,
  type HarthmereLiveModeEventKind,
  type HarthmereLiveModeUiEventKind,
  validateHarthmereLiveModeAuthorityEnvelope,
} from "@/shared/harthmere/live_mode_readiness";
import { HARTHMERE_JOBS_BOARD_LOCATIONS } from "@/shared/harthmere/mmo_jobs_board_authority";
import { EditEvent, PlaceGroupEvent } from "@/shared/ecs/gen/events";
import { getSlotByRef } from "@/shared/game/inventory";
import {
  biomesIdToHarthmereItemId,
  harthmereItemIdToBiomesId,
} from "@/shared/harthmere/harthmere_biomes_ecs_bridge";
import { ensureHarthmereNativeItemCatalogue } from "@/shared/harthmere/harthmere_native_bikkie_items";
import { blockPos, voxelShard } from "@/shared/game/shard";
import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import { safeParseBiomesId, type BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";
import { loadBlockWrapper, saveBlockWrapper } from "@/shared/wasm/biomes";
import { z } from "zod";
import { readHarthmerePlayerAndSharedStateStrings } from "@/server/harthmere/live_mode_state_read_helpers";
import { disableHarthmereLiveModeHttpCaching } from "@/server/harthmere/live_mode_http_cache";
import {
  resolveHarthmereLiveModeActorContext,
  type HarthmereLiveModeActorStateAdoption,
} from "@/server/harthmere/live_mode_actor_resolution";
import { shouldAdoptHarthmereInstallOrphan } from "@/shared/harthmere/live_mode_actor_identity";
import {
  acquireHarthmereActorStateLock,
  type HarthmereActorStateLock,
} from "@/server/harthmere/live_mode_actor_state_authority";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import { syncHarthmereCommittedStatusToNativeEcs } from "@/server/harthmere/native_vitals";

export { materializeHarthmereNativeEcsPlans } from "@/server/harthmere/native_ecs_drop_materialization";

const HARTHMERE_LIVE_MODE_SERVER_ROUTE =
  "HARTHMERE_LIVE_MODE_SERVER_ROUTE" as const;
const HARTHMERE_WORLD_MATERIALIZER_USER_ID = 8810000000099191 as BiomesId;
const HARTHMERE_WORLD_MATERIALIZER_USERNAME = "HarthmereWorldMaterializer";
export const HARTHMERE_BUILDING_MATERIALIZATION_ECS_PUBLISH_CHUNK_SIZE = 1000;

const HARTHMERE_SHARED_WORLD_TOUCH_MODELS = new Set([
  "auction_listing",
  "auction_seller_payout",
  "business_marker",
  "business_outpost_materialization",
  "business_outpost_voxel_rebuild",
  "custom_muck_plot",
  "economy_production_business_linked",
  "economy_production_business_removed",
  "economy_production_business_replaced",
  "economy_production_state",
  "exotic_matter_deposits",
  "guild_hall",
  "gathering_nodes",
  "home_decoration_voxel_materialization",
  "jobs_board_quest_todo",
  "inventory_loot_drops",
  "loot_claims",
  "law_bounty_cleared",
  "law_crime_records",
  "law_flags",
  "law_guard_response",
  "map_marker",
  "muck_safe_zone",
  "physical_access_controls",
  "physical_storage_container",
  "placed_structures",
  "plot_boundary_markers",
  "plot_terraform",
  "quest_invites",
  "robot_protection",
  "terrain_materialization",
  "vendor_stock",
  "world_placement",
]);

/**
 * Fast ownership check before comparing the large shared-world projection.
 *
 * A normal inventory/equipment/status mutation cannot change production
 * economy, global buildings, jobs, law, guilds, robots, shared claims, quest
 * invitations, or auctions. Skipping the two ~33 MB JSON serializations for
 * those actor-only operations removes a large fixed delay from every button
 * press. False positives are intentionally safe (they perform the old compare);
 * this predicate must never return false for a shared-owned branch.
 */
export function harthmereMutationMayChangeSharedWorldForTest(input: {
  sharedWorldStateKey: string;
  sharedStateKeys?: readonly string[];
  touchedModels?: readonly string[];
}) {
  const keys = input.sharedStateKeys ?? [];
  if (keys.includes(input.sharedWorldStateKey)) {
    return true;
  }
  if (
    keys.some((key) =>
      /(?:jobs_board|economy(?::|_)(?:business|town|contract)|zone_law|guild|building|plot|property|auction|quest_invite|loot_drop|gathering_node|exotic_matter|wild_(?:forage|hunt)_spawn)/.test(
        key
      )
    )
  ) {
    return true;
  }
  return (input.touchedModels ?? []).some(
    (model) =>
      HARTHMERE_SHARED_WORLD_TOUCH_MODELS.has(model) ||
      model.startsWith("building_") ||
      model.startsWith("business_") ||
      model.startsWith("guild_") ||
      model.startsWith("jobs_board_") ||
      model.startsWith("property_")
  );
}

const HARTHMERE_LIVE_MODE_ACTION_KINDS = [
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
  "request_respec",
  "request_loadout_change",
  "request_inventory_mutation",
  "request_inventory_item_action",
  "request_container_transfer",
  "request_vendor_transaction",
  "request_auction_post",
  "request_auction_settle",
  "request_auction_cancel",
  "request_auction_recover",
  "request_auction_expire",
  "request_bank_transaction",
  "request_mail_transaction",
  "request_guild_mutation",
  "request_economy_mutation",
  "request_jobs_board_mutation",
  "request_law_reputation_mutation",
  "request_pay_fine",
  "request_clear_bounty",
  "request_magic_progress",
  "request_quest_state_update",
  "request_property_building_mutation",
  "request_home_decoration",
  "request_world_placement",
  "request_crafting",
  "request_farming_action",
  "request_medical_action",
  "request_care_loop_action",
] as const satisfies readonly HarthmereLiveModeActionKind[];

const HARTHMERE_LIVE_MODE_SUBSYSTEMS = [
  "combat",
  "ability",
  "equipment",
  "leveling",
  "skill_progression",
  "loot",
  "death",
  "revive",
  "respawn",
  "npc_ai",
  "boss_encounter",
  "pvp",
  "party",
  "raid",
  "trainer",
  "skill_book",
  "respec",
  "loadout",
  "audit",
  "ui_event",
  "anti_abuse",
  "inventory",
  "economy",
  "jobs",
  "guild",
  "law",
  "magic",
  "quest",
  "vendor",
  "auction",
  "bank",
  "mail",
  "property",
  "crafting",
  "home_decoration",
  "farming",
  "building",
  "care",
  "medical",
] as const satisfies readonly HarthmereLiveModeAnySubsystem[];

const zJsonRecord = z.record(z.unknown());
const zBuildingMaterializationPlansResponse = z
  .unknown()
  .array()
  .optional() as z.ZodType<BuildingSystemAnyMaterializationPlan[] | undefined>;
const zHarthmereCareLoopClientSnapshotResponse = z.object({
  actorId: z.string(),
  day: z.number(),
  streak: z.number(),
  claimedToday: z.record(z.number()),
  completedToday: z.record(z.number()),
  claimed: z.record(z.number()),
  completed: z.record(z.number()),
  townNeeds: z.record(z.number()),
  skills: z.record(z.object({ xp: z.number(), level: z.number() })),
  projects: z.record(z.unknown()),
});

const zLiveModeRequest = z.object({
  requestId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  targetId: z.string().optional(),
  actionKind: z.enum(HARTHMERE_LIVE_MODE_ACTION_KINDS),
  subsystem: z.enum(HARTHMERE_LIVE_MODE_SUBSYSTEMS),
  clientSentAtMs: z.number().optional(),
  actorEntityVersion: z.number().default(1),
  targetEntityVersion: z.number().optional(),
  zoneId: z.string().min(1),
  encounterId: z.string().optional(),
  partyId: z.string().optional(),
  raidId: z.string().optional(),
  pvpContextId: z.string().optional(),
  payload: zJsonRecord.default({}),
  clientClaims: zJsonRecord.optional(),
});

const zLiveModeValidationResponse = z.object({
  ok: z.boolean(),
  errors: z.string().array(),
  warnings: z.string().array(),
  rejectedClientClaims: z.string().array(),
});

const zLiveModeMutationPlanResponse = z.object({
  planId: z.string(),
  actionKind: z.enum(HARTHMERE_LIVE_MODE_ACTION_KINDS),
  idempotencyKey: z.string(),
  transactionScope: z.string(),
  requiredLocks: z.string().array(),
  readModels: z.string().array(),
  writeModels: z.string().array(),
  appendOnlyLogs: z.string().array(),
  rollbackPlan: z.string().array(),
  uiEventOutbox: z.string().array(),
  auditEventOutbox: z.string().array(),
});

const zLiveModeEventResponse = z.object({
  eventId: z.string(),
  kind: z.string(),
  requestId: z.string(),
  actorId: z.string(),
  targetId: z.string().optional(),
  zoneId: z.string(),
  serverTick: z.number(),
  createdAtMs: z.number(),
  payload: zJsonRecord,
});

const zHarthmereNativeEcsMaterializationPlan = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("drop"),
    materializationKey: z.string(),
    position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    itemStacks: z.record(z.number()),
    ownerActorIds: z.string().array(),
    expiresAtMs: z.number(),
    mined: z.boolean(),
    sourceKind: z.string(),
  }),
  z.object({
    kind: z.literal("inventory_exchange"),
    materializationKey: z.string(),
    actorId: z.string(),
    position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
    consumeItemStacks: z.record(z.number()),
    rewardItemStacks: z.record(z.number()),
    expiresAtMs: z.number(),
    sourceKind: z.string(),
  }),
]);

const zLiveModeUiEventResponse = z.object({
  uiEventId: z.string(),
  kind: z.string(),
  playerId: z.string(),
  requestId: z.string(),
  priority: z.enum(["low", "normal", "high", "critical"]),
  dedupeKey: z.string(),
  createdAtMs: z.number(),
  payload: zJsonRecord,
});

const zLiveModeBackendMutationResponse = z.object({
  version: z.string(),
  applied: z.boolean(),
  actionKind: z.string(),
  subsystem: z.string(),
  actorId: z.string(),
  targetId: z.string().optional(),
  playerStateKey: z.string(),
  sharedStateKeys: z.string().array(),
  warnings: z.string().array(),
  touchedModels: z.string().array(),
  buildingMaterializationPlans: zBuildingMaterializationPlansResponse,
  nativeEcsMaterializationPlans: zHarthmereNativeEcsMaterializationPlan
    .array()
    .optional(),
});

const zLiveModeResponse = z.object({
  ok: z.boolean(),
  version: z.literal(HARTHMERE_LIVE_MODE_SERVER_ROUTE),
  actorId: z.string(),
  duplicate: z.boolean(),
  replayed: z.boolean(),
  persisted: z.boolean(),
  validation: zLiveModeValidationResponse,
  mutationPlan: zLiveModeMutationPlanResponse.optional(),
  backendMutation: zLiveModeBackendMutationResponse.optional(),
  buildingState: zJsonRecord.optional(),
  bankingState: zJsonRecord.optional(),
  guildState: zJsonRecord.optional(),
  economyState: zJsonRecord.optional(),
  jobsBoardState: zJsonRecord.optional(),
  dailyState: zHarthmereCareLoopClientSnapshotResponse.optional(),
  farmingFoodState: zJsonRecord.optional(),
  craftingState: zJsonRecord.optional(),
  inventoryLootState: zJsonRecord.optional(),
  combatState: zJsonRecord.optional(),
  playerStatusState: zJsonRecord.optional(),
  questState: zJsonRecord.optional(),
  snapshotMode: z.enum(["full", "changed"]).optional(),
  includedSnapshots: z.string().array().optional(),
  invalidatedSnapshots: z.string().array().optional(),
  events: zLiveModeEventResponse.array(),
  uiEvents: zLiveModeUiEventResponse.array(),
});

type LiveModeResponse = z.infer<typeof zLiveModeResponse>;

const HARTHMERE_LIVE_MODE_MUTATION_SNAPSHOT_KEYS = [
  "buildingState",
  "bankingState",
  "guildState",
  "economyState",
  "jobsBoardState",
  "dailyState",
  "farmingFoodState",
  "craftingState",
  "inventoryLootState",
  "combatState",
  "playerStatusState",
  "questState",
] as const;

const HARTHMERE_NATIVE_ECS_OWNED_LIVE_MODE_ACTIONS =
  new Set<HarthmereLiveModeActionKind>([
    "request_attack",
    "request_ability_cast",
    "request_death_transition",
    "request_environment_damage",
    "request_revive",
    "request_respawn",
    "request_npc_ai_tick",
    "request_boss_tick",
    "request_loot_roll",
    "request_loot_claim",
    "request_container_transfer",
  ]);

export function nativeEcsOwnsHarthmereLiveModeActionForTest(
  actionKind: HarthmereLiveModeActionKind
) {
  return HARTHMERE_NATIVE_ECS_OWNED_LIVE_MODE_ACTIONS.has(actionKind);
}

export function nativeEcsPhysicalDropNeedsAuthenticatedActorForTest(input: {
  actionKind: HarthmereLiveModeActionKind;
  payload: Record<string, unknown>;
}) {
  return (
    (input.actionKind === "request_farming_action" &&
      [
        "gather_node",
        "mine_exotic_matter_deposit",
        "cook_enqueue",
        "cook_collect",
        "cook_cancel",
      ].includes(String(input.payload.operation ?? ""))) ||
    (input.actionKind === "request_inventory_item_action" &&
      input.payload.operation === "drop_item") ||
    input.actionKind === "request_jobs_board_mutation" ||
    (input.actionKind === "request_quest_state_update" &&
      input.payload.completed === true &&
      String(input.payload.questId ?? "").startsWith("jobs_board:"))
  );
}

const HARTHMERE_NATIVE_ECS_ALLOWED_FARMING_OPERATIONS = new Set([
  "gather_node",
  "mine_exotic_matter_deposit",
  // Cooking recipes remain a Harthmere server reducer, but their ingredients
  // and outputs are exchanged through the actor's native ECS inventory.
  "cook_enqueue",
  "cook_collect",
  "cook_cancel",
]);

/**
 * Legacy field/livestock/cooking actions mutate a second Redis inventory from
 * browser-authored facts. Native mode keeps those endpoints closed until the
 * action is represented by a native ECS event and entity.
 */
export function nativeEcsRejectsLegacyFarmingRequestForTest(input: {
  actionKind: HarthmereLiveModeActionKind;
  payload: Record<string, unknown>;
}) {
  return (
    input.actionKind === "request_farming_action" &&
    !HARTHMERE_NATIVE_ECS_ALLOWED_FARMING_OPERATIONS.has(
      String(input.payload.operation ?? "")
    )
  );
}

type HarthmereLiveModeMutationSnapshotKey =
  (typeof HARTHMERE_LIVE_MODE_MUTATION_SNAPSHOT_KEYS)[number];

const HARTHMERE_LIVE_MODE_RESPONSE_SNAPSHOT_FIELDS = [
  "buildingState",
  "bankingState",
  "guildState",
  "economyState",
  "jobsBoardState",
  "dailyState",
  "farmingFoodState",
  "craftingState",
  "inventoryLootState",
  "combatState",
  "playerStatusState",
  "questState",
] as const satisfies readonly HarthmereLiveModeMutationSnapshotKey[];

export function useFullHarthmereLiveModeMutationSnapshots(
  env: NodeJS.ProcessEnv = process.env
) {
  return env.HARTHMERE_LIVE_MODE_FULL_MUTATION_SNAPSHOTS === "1";
}

function addLiveModeSnapshotForTouchedModel(
  snapshots: Set<HarthmereLiveModeMutationSnapshotKey>,
  model: string
) {
  const lower = model.toLowerCase();
  if (
    lower.includes("building") ||
    lower.includes("property") ||
    lower.includes("plot") ||
    lower.includes("marker") ||
    lower.includes("structure") ||
    lower.includes("terrain") ||
    lower.includes("home_decoration") ||
    lower.includes("physical_")
  ) {
    snapshots.add("buildingState");
  }
  if (
    lower.includes("bank") ||
    lower.includes("vault") ||
    lower.includes("loan") ||
    lower.includes("mail")
  ) {
    snapshots.add("bankingState");
  }
  if (lower.includes("guild")) {
    snapshots.add("guildState");
  }
  if (
    lower.includes("economy") ||
    lower.includes("business") ||
    lower.includes("auction") ||
    lower.includes("vendor")
  ) {
    snapshots.add("economyState");
  }
  if (lower.includes("jobs_board") || lower.includes("todo")) {
    snapshots.add("jobsBoardState");
  }
  if (lower.includes("care")) {
    snapshots.add("dailyState");
  }
  if (
    lower.includes("farming") ||
    lower.includes("food") ||
    lower.includes("stamina") ||
    lower.includes("cooking")
  ) {
    snapshots.add("farmingFoodState");
  }
  if (lower.includes("crafting")) {
    snapshots.add("craftingState");
  }
  if (
    lower.includes("inventory") ||
    lower.includes("material") ||
    lower.includes("wallet") ||
    lower.includes("loot") ||
    lower.includes("collectible") ||
    lower.includes("item_") ||
    lower.includes("tool_") ||
    lower.includes("loadout") ||
    lower.includes("equipment")
  ) {
    snapshots.add("inventoryLootState");
  }
  if (
    lower.includes("combat") ||
    lower.includes("death") ||
    lower.includes("revive") ||
    lower.includes("respawn") ||
    lower.includes("threat") ||
    lower.includes("cooldown") ||
    lower.includes("npc_ai") ||
    lower.includes("boss")
  ) {
    snapshots.add("combatState");
    snapshots.add("playerStatusState");
  }
  if (
    lower.includes("player_status") ||
    lower.includes("skill") ||
    lower.includes("xp") ||
    lower.includes("level") ||
    lower.includes("class") ||
    lower.includes("magic") ||
    lower.includes("law") ||
    lower.includes("reputation")
  ) {
    snapshots.add("playerStatusState");
  }
  if (lower.includes("quest")) {
    snapshots.add("questState");
  }
}

export function harthmereLiveModeMutationSnapshotKeys(input: {
  actionKind: string;
  subsystem: string;
  touchedModels: readonly string[];
}) {
  if (useFullHarthmereLiveModeMutationSnapshots()) {
    return [...HARTHMERE_LIVE_MODE_MUTATION_SNAPSHOT_KEYS];
  }

  const snapshots = new Set<HarthmereLiveModeMutationSnapshotKey>();
  switch (input.actionKind) {
    case "request_jobs_board_mutation":
      snapshots.add("jobsBoardState");
      snapshots.add("questState");
      snapshots.add("inventoryLootState");
      snapshots.add("playerStatusState");
      break;
    case "request_care_loop_action":
      snapshots.add("dailyState");
      snapshots.add("inventoryLootState");
      snapshots.add("playerStatusState");
      break;
    case "request_bank_transaction":
    case "request_mail_transaction":
      snapshots.add("bankingState");
      snapshots.add("inventoryLootState");
      snapshots.add("playerStatusState");
      break;
    case "request_guild_mutation":
      snapshots.add("guildState");
      snapshots.add("playerStatusState");
      break;
    case "request_economy_mutation":
    case "request_vendor_transaction":
    case "request_auction_post":
    case "request_auction_settle":
    case "request_auction_cancel":
    case "request_auction_recover":
    case "request_auction_expire":
      snapshots.add("economyState");
      snapshots.add("inventoryLootState");
      snapshots.add("playerStatusState");
      break;
    case "request_property_building_mutation":
    case "request_world_placement":
      snapshots.add("buildingState");
      snapshots.add("inventoryLootState");
      snapshots.add("playerStatusState");
      break;
    case "request_crafting":
      snapshots.add("craftingState");
      snapshots.add("inventoryLootState");
      snapshots.add("playerStatusState");
      break;
    case "request_inventory_item_action":
      snapshots.add("inventoryLootState");
      snapshots.add("playerStatusState");
      break;
    case "request_farming_action":
      snapshots.add("farmingFoodState");
      snapshots.add("inventoryLootState");
      snapshots.add("playerStatusState");
      break;
    case "request_attack":
    case "request_death_transition":
    case "request_environment_damage":
    case "request_revive":
    case "request_respawn":
    case "request_npc_ai_tick":
    case "request_boss_tick":
      snapshots.add("combatState");
      snapshots.add("playerStatusState");
      break;
    case "request_quest_state_update":
      snapshots.add("questState");
      break;
    case "request_magic_progress":
    case "request_law_reputation_mutation":
    case "request_pay_fine":
    case "request_clear_bounty":
      snapshots.add("inventoryLootState");
      snapshots.add("playerStatusState");
      break;
    case "request_inventory_mutation":
    case "request_loot_claim":
    case "request_loot_roll":
      snapshots.add("inventoryLootState");
      snapshots.add("playerStatusState");
      break;
  }

  for (const model of input.touchedModels) {
    addLiveModeSnapshotForTouchedModel(snapshots, model);
  }

  if (snapshots.size === 0) {
    const subsystem = input.subsystem.toLowerCase();
    if (subsystem === "jobs") snapshots.add("jobsBoardState");
    else if (subsystem === "care") snapshots.add("dailyState");
    else if (subsystem === "building" || subsystem === "property")
      snapshots.add("buildingState");
    else if (subsystem === "guild") snapshots.add("guildState");
    else if (subsystem === "economy") snapshots.add("economyState");
    else if (subsystem === "crafting") snapshots.add("craftingState");
    else if (subsystem === "farming") snapshots.add("farmingFoodState");
    else if (subsystem === "combat") snapshots.add("combatState");
    else if (subsystem === "quest") snapshots.add("questState");
    else snapshots.add("playerStatusState");
  }

  return [...snapshots];
}

const globalForHarthmereLiveMode = globalThis as typeof globalThis & {
  __harthmereLiveModeRedis?: ReturnType<typeof connectToRedis>;
};

function liveModeRedis() {
  return (globalForHarthmereLiveMode.__harthmereLiveModeRedis ??=
    connectToRedis("firehose"));
}

// HARTHMERE_LIVE_MODE_TX_CONNECTION (2026-07-06): redis WATCH state is per
// CONNECTION. Every live-mode request used to share ONE connection, so two
// concurrent mutations interleaved their WATCH/…/EXEC on it: the first EXEC
// consumes the connection's ENTIRE watch set, leaving the second EXEC running
// UNWATCHED — silent last-writer-wins. With server latency of 20-30s per
// mutation, rapid player actions always overlap, which lost inventory
// increments (10 harvests → count 1), resurrected already-claimed harvest
// plants (`plant_already_harvested` never fired), and made item counts jump
// down as stale states overwrote fresh ones. Give each persist call its own
// dedicated connection so optimistic concurrency actually holds; conflicting
// writers then genuinely retry via the EXEC-null loop. Falls back to the
// shared client when duplication isn't available (unit-test mocks).
async function acquireHarthmereLiveModeTxClient(shared: any): Promise<{
  client: any;
  release: () => Promise<void>;
}> {
  const duplicate = (shared as { duplicate?: () => any })?.duplicate;
  if (typeof duplicate !== "function") {
    return { client: shared, release: async () => {} };
  }
  try {
    const client = duplicate.call(shared);
    if (typeof client?.connect === "function") {
      // Shared options use lazyConnect; ensure the socket is live before
      // WATCH. connect() rejects if already connecting — safe to ignore.
      await client.connect().catch(() => {});
    }
    return {
      client,
      release: async () => {
        try {
          if (typeof client?.quit === "function") {
            await client.quit();
          } else if (typeof client?.disconnect === "function") {
            client.disconnect();
          }
        } catch {
          // Releasing a dead connection is fine.
        }
      },
    };
  } catch {
    return { client: shared, release: async () => {} };
  }
}

function liveModeIdempotencyKey(actorId: string, idempotencyKey: string) {
  return `harthmere:live_mode:current:idempotency:${actorId}:${idempotencyKey}`;
}

function slimBuildingMaterializationPlanForClient(
  plan: BuildingSystemAnyMaterializationPlan
) {
  const raw = plan as any;
  return {
    version: raw.version,
    requestId: raw.requestId,
    actorId: raw.actorId,
    plotId: raw.plotId,
    propertyId: raw.propertyId,
    blueprintId: raw.blueprintId,
    structureTypeId: raw.structureTypeId,
    use: raw.use,
    projectId: raw.projectId,
    stage: raw.stage,
    reason: raw.reason,
    operation: raw.operation,
    decorationId: raw.decorationId,
    materializesSolidVoxelBuilding: raw.materializesSolidVoxelBuilding,
    editCount: Array.isArray(raw.edits) ? raw.edits.length : 0,
    inWorldMarkerCount: Array.isArray(raw.inWorldMarkers)
      ? raw.inWorldMarkers.length
      : 0,
    hasSafeZone: Boolean(raw.safeZone),
    hasPlaceGroup: Boolean(raw.placeGroup),
  };
}

function slimLiveModeBackendMutationForClient(
  backendMutation: LiveModeResponse["backendMutation"]
): LiveModeResponse["backendMutation"] {
  if (!backendMutation?.buildingMaterializationPlans?.length) {
    return backendMutation;
  }
  return {
    ...backendMutation,
    // The authoritative edit list can be hundreds of thousands of voxels after
    // business outpost repair. Clients only need the ids/counts; terrain writes
    // already happened server-side before this response is returned.
    buildingMaterializationPlans:
      backendMutation.buildingMaterializationPlans.map(
        slimBuildingMaterializationPlanForClient
      ) as any,
  };
}

function slimLiveModeResponseForClient(
  response: LiveModeResponse
): LiveModeResponse {
  return {
    ...response,
    backendMutation: slimLiveModeBackendMutationForClient(
      response.backendMutation
    ),
  };
}

function slimHarthmereLiveModeIdempotencyResponse(
  response: LiveModeResponse
): LiveModeResponse {
  const slim: LiveModeResponse = {
    ...response,
    backendMutation: slimLiveModeBackendMutationForClient(
      response.backendMutation
    ),
    snapshotMode: "changed",
    // Keep the list, but not the large snapshot bodies. A timed-out client can
    // retry the same idempotency key and the server will rehydrate these fields
    // from the current authoritative actor document instead of returning an
    // unusable empty replay.
    includedSnapshots: [...(response.includedSnapshots ?? [])],
    invalidatedSnapshots: [...(response.invalidatedSnapshots ?? [])],
  };
  for (const field of HARTHMERE_LIVE_MODE_RESPONSE_SNAPSHOT_FIELDS) {
    delete slim[field];
  }
  return slim;
}

function isHarthmereLiveModeMutationSnapshotKey(
  value: string
): value is HarthmereLiveModeMutationSnapshotKey {
  return (
    HARTHMERE_LIVE_MODE_MUTATION_SNAPSHOT_KEYS as readonly string[]
  ).includes(value);
}

async function hydrateHarthmereLiveModeIdempotencyReplay(input: {
  redisPrimary: any;
  envelope: HarthmereLiveModeAuthorityEnvelope;
  response: LiveModeResponse;
}) {
  const now = Date.now();
  const playerStateKey = harthmereLiveModePlayerStateKey(
    input.response.actorId
  );
  const sharedWorldStateKey = harthmereLiveModeSharedWorldStateKey();
  const { rawState, rawSharedState } =
    await readHarthmerePlayerAndSharedStateStrings(
      input.redisPrimary,
      playerStateKey,
      sharedWorldStateKey
    );
  const state = parseHarthmereLiveModeBackendState(
    rawState,
    input.response.actorId,
    now
  );
  mergeHarthmereLiveModeSharedWorldStateIntoBackend(
    state,
    parseHarthmereLiveModeSharedWorldState(rawSharedState, now),
    now
  );

  const storedIncludedSnapshots = (
    input.response.includedSnapshots ?? []
  ).filter(isHarthmereLiveModeMutationSnapshotKey);
  const includedSnapshots = storedIncludedSnapshots.length
    ? storedIncludedSnapshots
    : harthmereLiveModeMutationSnapshotKeys({
        actionKind:
          input.response.backendMutation?.actionKind ??
          input.response.mutationPlan?.actionKind ??
          input.envelope.actionKind,
        subsystem:
          input.response.backendMutation?.subsystem ?? input.envelope.subsystem,
        touchedModels: input.response.backendMutation?.touchedModels ?? [],
      });
  const includedSnapshotSet = new Set(includedSnapshots);
  const hydrated: LiveModeResponse = {
    ...input.response,
    duplicate: true,
    replayed: true,
    snapshotMode: "changed",
    includedSnapshots,
    invalidatedSnapshots: HARTHMERE_LIVE_MODE_MUTATION_SNAPSHOT_KEYS.filter(
      (snapshot) => !includedSnapshotSet.has(snapshot)
    ),
  };

  if (includedSnapshotSet.has("buildingState")) {
    hydrated.buildingState =
      createHarthmereLiveModeBuildingClientSnapshot(state);
  }
  if (includedSnapshotSet.has("bankingState")) {
    hydrated.bankingState = createHarthmereLiveModeBankingClientSnapshot(state);
  }
  if (includedSnapshotSet.has("guildState")) {
    hydrated.guildState =
      createHarthmereLiveModeGuildClientSnapshotFromBackend(state);
  }
  if (includedSnapshotSet.has("economyState")) {
    hydrated.economyState =
      createHarthmereProductionEconomyClientSnapshotFromBackend(state);
  }
  if (includedSnapshotSet.has("jobsBoardState")) {
    hydrated.jobsBoardState =
      createHarthmereJobsBoardClientSnapshotFromBackend(state);
  }
  if (includedSnapshotSet.has("dailyState")) {
    hydrated.dailyState = createHarthmereCareLoopClientSnapshotFromBackend(
      state,
      now
    );
  }
  if (includedSnapshotSet.has("farmingFoodState")) {
    hydrated.farmingFoodState =
      createHarthmereLiveModeFarmingFoodClientSnapshot(state);
  }
  if (includedSnapshotSet.has("craftingState")) {
    const stationId =
      typeof input.envelope.payload.stationId === "string"
        ? input.envelope.payload.stationId
        : typeof input.envelope.payload.stationId === "number"
        ? String(Math.trunc(input.envelope.payload.stationId))
        : undefined;
    const stationType =
      typeof input.envelope.payload.stationType === "string"
        ? input.envelope.payload.stationType
        : undefined;
    hydrated.craftingState =
      createHarthmereCraftingStationClientSnapshotFromBackend(
        state,
        stationId,
        stationType,
        now
      );
  }
  if (includedSnapshotSet.has("inventoryLootState")) {
    hydrated.inventoryLootState =
      createHarthmereInventoryLootClientSnapshotFromBackend(state);
  }
  if (includedSnapshotSet.has("combatState")) {
    hydrated.combatState = createHarthmereLiveEntityCombatClientSnapshot(state);
  }
  if (includedSnapshotSet.has("playerStatusState")) {
    hydrated.playerStatusState =
      createHarthmereLiveModePlayerStatusClientSnapshot(state);
  }
  if (includedSnapshotSet.has("questState")) {
    hydrated.questState = createHarthmereLiveModeQuestClientSnapshot(state);
  }
  return slimLiveModeResponseForClient(hydrated);
}

function liveModeEventStreamKey() {
  return "harthmere:live_mode:current:events";
}

function liveModeUiOutboxStreamKey(actorId: string) {
  return `harthmere:live_mode:current:ui_outbox:${actorId}`;
}

function applyRouteRecordDelta(
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

async function redisUnwatchIfSupported(redisPrimary: any) {
  if (typeof redisPrimary.unwatch === "function") {
    await redisPrimary.unwatch();
  }
}

/**
 * A building is not materialized merely because its Redis transaction committed.
 * Acknowledge successful ECS/world work in a second optimistic transaction so a
 * failed publish remains visibly pending and can be retried by `read_state`.
 */
export async function markBuildingMaterializationPlansAppliedForTest(input: {
  redisPrimary: any;
  sharedWorldStateKey: string;
  plans: readonly BuildingSystemAnyMaterializationPlan[];
  nowMs?: number;
}) {
  const structureIds = [
    ...new Set(
      input.plans
        .filter((plan) => plan.materializesSolidVoxelBuilding)
        .map((plan) => plan.projectId ?? plan.requestId)
    ),
  ];
  if (structureIds.length === 0) return 0;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await input.redisPrimary.watch(input.sharedWorldStateKey);
    const raw = await input.redisPrimary.get(input.sharedWorldStateKey);
    const shared = parseHarthmereLiveModeSharedWorldState(
      raw,
      input.nowMs ?? Date.now()
    );
    if (!shared) {
      await redisUnwatchIfSupported(input.redisPrimary);
      return 0;
    }
    let changed = 0;
    for (const structureId of structureIds) {
      const structure = shared.building.placedStructures[structureId];
      if (structure && structure.materializedInEcs !== true) {
        structure.materializedInEcs = true;
        changed += 1;
      }
    }
    if (changed === 0) {
      await redisUnwatchIfSupported(input.redisPrimary);
      return 0;
    }
    shared.updatedAtMs = input.nowMs ?? Date.now();
    const tx = input.redisPrimary.multi();
    tx.set(input.sharedWorldStateKey, JSON.stringify(shared));
    if ((await tx.exec()) !== null) return changed;
  }
  await redisUnwatchIfSupported(input.redisPrimary);
  throw new Error("Building materialization acknowledgement conflicted");
}

function buildAuctionSellerSettlement(input: {
  envelope: HarthmereLiveModeAuthorityEnvelope;
  beforeState: ReturnType<typeof parseHarthmereLiveModeBackendState>;
  afterState: ReturnType<typeof parseHarthmereLiveModeBackendState>;
}) {
  if (input.envelope.actionKind !== "request_auction_settle") {
    return undefined;
  }
  const listingId =
    typeof input.envelope.payload.listingId === "string"
      ? input.envelope.payload.listingId
      : input.envelope.requestId;
  const beforeListing = input.beforeState.economy.auctionListings[listingId];
  const afterListing = input.afterState.economy.auctionListings[listingId];
  if (
    !beforeListing ||
    !afterListing ||
    beforeListing.status !== "active" ||
    afterListing.status !== "sold" ||
    afterListing.sellerId === input.envelope.actorId
  ) {
    return undefined;
  }
  return {
    listingId,
    sellerId: afterListing.sellerId,
    itemId: afterListing.itemId,
    count: Math.max(0, Math.trunc(afterListing.count)),
    sellerGoldDelta: Math.max(0, Math.trunc(afterListing.sellerNetGold ?? 0)),
  };
}

function applyAuctionSellerSettlement(input: {
  sellerState: ReturnType<typeof parseHarthmereLiveModeBackendState>;
  settlement: NonNullable<ReturnType<typeof buildAuctionSellerSettlement>>;
  requestId: string;
  nowMs: number;
}) {
  applyRouteRecordDelta(
    input.sellerState.inventory.items,
    input.settlement.itemId,
    -input.settlement.count
  );
  applyRouteRecordDelta(
    input.sellerState.inventory.escrow,
    input.settlement.itemId,
    -input.settlement.count
  );
  input.sellerState.inventory.gold = Math.max(
    0,
    input.sellerState.inventory.gold + input.settlement.sellerGoldDelta
  );
  input.sellerState.economy.ledger.push({
    id: input.requestId,
    kind: "auction_sale_seller_settlement",
    amount: input.settlement.sellerGoldDelta,
    atMs: input.nowMs,
  });
  input.sellerState.updatedAtMs = input.nowMs;
}

function wire_network_requests_to_validateHarthmereLiveModeAuthorityEnvelope(
  actorId: string,
  body: z.infer<typeof zLiveModeRequest>,
  serverActorPosition?: { x: number; y: number; z: number },
  serverTargetPosition?: { x: number; y: number; z: number },
  serverActorItemIds?: BiomesId[],
  serverActorItemCounts?: Record<string, number>,
  serverActorEquippedItemKeys?: string[]
): HarthmereLiveModeAuthorityEnvelope {
  const now = Date.now();
  return {
    requestId: body.requestId,
    idempotencyKey: body.idempotencyKey,
    actorId,
    targetId: body.targetId,
    actionKind: body.actionKind,
    subsystem: body.subsystem,
    source: "client_request",
    serverActorPosition,
    serverActorItemIds,
    serverActorItemCounts,
    serverActorEquippedItemKeys,
    serverTargetPosition,
    clientSentAtMs: body.clientSentAtMs,
    serverReceivedAtMs: now,
    serverTick: now,
    actorEntityVersion: body.actorEntityVersion,
    targetEntityVersion: body.targetEntityVersion,
    zoneId: body.zoneId,
    encounterId: body.encounterId,
    partyId: body.partyId,
    raidId: body.raidId,
    pvpContextId: body.pvpContextId,
    payload: body.payload,
    clientClaims: body.clientClaims,
  };
}

export async function readServerActorPositionForLiveMode(
  worldApi: WorldApi,
  userId: BiomesId
) {
  return (await readServerActorNativeContextForLiveMode(worldApi, userId))
    .position;
}

export async function readServerActorNativeContextForLiveMode(
  worldApi: WorldApi,
  userId: BiomesId,
  includeItemIds = false
) {
  try {
    const entity = await worldApi.get(userId);
    const position = entity?.position()?.v;
    let parsedPosition: { x: number; y: number; z: number } | undefined;
    if (Array.isArray(position) && position.length >= 3) {
      const [x, y, z] = position.map(Number);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
        parsedPosition = { x, y, z };
      }
    }
    const ids = new Set<BiomesId>();
    const itemCounts: Record<string, number> = {};
    let equippedItemKeys: string[] = [];
    if (includeItemIds) {
      const inventory = entity?.inventory();
      const wearing = entity?.wearing();
      if (inventory) {
        const selected = getSlotByRef(
          { inventory, wearing },
          inventory.selected
        );
        if (selected) ids.add(selected.item.id);
      }
      for (const item of wearing?.items.values() ?? []) {
        ids.add(item.id);
      }
      const semanticIds = new Map<BiomesId, string>();
      for (const definition of ensureHarthmereNativeItemCatalogue()) {
        const nativeId = harthmereItemIdToBiomesId(definition.itemId);
        if (nativeId !== undefined) {
          semanticIds.set(nativeId, definition.itemId);
        }
      }
      equippedItemKeys = [...ids].flatMap((id) => {
        const semanticId = semanticIds.get(id) ?? biomesIdToHarthmereItemId(id);
        return semanticId ? [semanticId] : [];
      });
      const addCount = (item: { item: { id: BiomesId }; count: bigint }) => {
        const semanticId =
          semanticIds.get(item.item.id) ??
          biomesIdToHarthmereItemId(item.item.id);
        if (!semanticId) return;
        itemCounts[semanticId] =
          (itemCounts[semanticId] ?? 0) + Number(item.count);
      };
      for (const item of inventory?.items ?? []) {
        if (item) addCount(item);
      }
      for (const item of inventory?.hotbar ?? []) {
        if (item) addCount(item);
      }
      // Wearing is evidence that an item is equipped, not spendable inventory.
      // Excluding it prevents a delivery/cooking exchange from consuming armor
      // or clothing merely because it shares the requested item identity.
    }
    return {
      position: parsedPosition,
      itemIds: includeItemIds ? [...ids] : undefined,
      itemCounts: includeItemIds ? itemCounts : undefined,
      equippedItemKeys: includeItemIds ? equippedItemKeys : undefined,
    };
  } catch {
    return {
      position: undefined,
      itemIds: includeItemIds ? [] : undefined,
      itemCounts: includeItemIds ? {} : undefined,
      equippedItemKeys: includeItemIds ? [] : undefined,
    };
  }
}

export async function readServerActorNativeItemIdsForLiveMode(
  worldApi: WorldApi,
  userId: BiomesId
) {
  return (await readServerActorNativeContextForLiveMode(worldApi, userId, true))
    .itemIds!;
}

function biomesIdFromLiveModeActorId(value: unknown): BiomesId | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0
    ? (numeric as BiomesId)
    : undefined;
}

async function readServerTargetPositionForQuestInvite(
  worldApi: WorldApi,
  body: z.infer<typeof zLiveModeRequest>
) {
  if (
    body.actionKind !== "request_quest_state_update" ||
    body.payload.operation !== "invite_to_quest"
  ) {
    return undefined;
  }
  const inviteeUserId = biomesIdFromLiveModeActorId(
    body.payload.inviteeActorId ?? body.targetId
  );
  return inviteeUserId !== undefined
    ? readServerActorPositionForLiveMode(worldApi, inviteeUserId)
    : undefined;
}

function firstLiveModeRequestString(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" && candidate.trim()
    ? candidate.trim()
    : undefined;
}

function liveModeInstallIdFromUnsafeRequest(unsafeRequest: {
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}) {
  return (
    firstLiveModeRequestString(unsafeRequest.query?.install_id) ??
    firstLiveModeRequestString(unsafeRequest.query?.installId) ??
    firstLiveModeRequestString(unsafeRequest.headers?.["x-glitch-install-id"])
  );
}

export function liveModeActorIdentityFromRequest(input: {
  auth?: { userId?: unknown };
  unsafeRequest: {
    query?: Record<string, unknown>;
    headers?: Record<string, unknown>;
  };
}) {
  if (input.auth?.userId !== undefined) {
    return {
      actorId: String(input.auth.userId),
      userId: input.auth.userId as BiomesId,
      installId: undefined,
    };
  }
  const installId = liveModeInstallIdFromUnsafeRequest(input.unsafeRequest);
  return installId
    ? {
        actorId: `install:${installId}`,
        userId: undefined,
        installId,
      }
    : {
        actorId: "anonymous:live-mode-writer",
        userId: undefined,
        installId: undefined,
      };
}

function payloadString(body: z.infer<typeof zLiveModeRequest>, key: string) {
  const value = body.payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function jobsBoardPositionFromLiveModeBody(
  body: z.infer<typeof zLiveModeRequest>
) {
  if (body.actionKind !== "request_jobs_board_mutation") {
    return undefined;
  }
  const boardId =
    payloadString(body, "interactionTargetId") ??
    payloadString(body, "boardId") ??
    body.targetId;
  const board = boardId ? HARTHMERE_JOBS_BOARD_LOCATIONS[boardId] : undefined;
  return board
    ? {
        x: board.location.x,
        y: board.location.y,
        z: board.location.z,
      }
    : undefined;
}

function liveModeNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function liveModePositionFromUnknown(value: unknown) {
  if (Array.isArray(value)) {
    const x = liveModeNumber(value[0]);
    const y = liveModeNumber(value[1]);
    const z = liveModeNumber(value[2]);
    return x === undefined || y === undefined || z === undefined
      ? undefined
      : { x, y, z };
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const x = liveModeNumber(record.x);
  const y = liveModeNumber(record.y);
  const z = liveModeNumber(record.z);
  return x === undefined || y === undefined || z === undefined
    ? undefined
    : { x, y, z };
}

export function combatActorPositionFromInstallLiveModeBody(
  body: z.infer<typeof zLiveModeRequest>
) {
  if (
    body.actionKind !== "request_attack" &&
    body.actionKind !== "request_ability_cast" &&
    body.actionKind !== "request_npc_ai_tick" &&
    body.actionKind !== "request_home_decoration"
  ) {
    return undefined;
  }
  if (
    body.subsystem !== "combat" &&
    body.subsystem !== "ability" &&
    body.subsystem !== "npc_ai" &&
    body.subsystem !== "home_decoration"
  ) {
    return undefined;
  }
  const claims = body.clientClaims ?? {};
  return (
    liveModePositionFromUnknown(claims.runtimePosition) ??
    liveModePositionFromUnknown(claims.actorPosition)
  );
}

function route_real_attacks_abilities_xp_loot_death_respawn_through_shared_rules(
  envelope: HarthmereLiveModeAuthorityEnvelope,
  plan: NonNullable<LiveModeResponse["mutationPlan"]>
) {
  const events = plan.auditEventOutbox.map((kind) =>
    createHarthmereLiveModeEvent({
      kind: kind as HarthmereLiveModeEventKind,
      envelope,
      payload: {
        authoritative: true,
        mutationPlanId: plan.planId,
      },
    })
  );
  const uiEvents = plan.uiEventOutbox.map((kind) =>
    createHarthmereLiveModeUiEvent({
      kind: kind as HarthmereLiveModeUiEventKind,
      envelope,
      payload: {
        authoritative: true,
        mutationPlanId: plan.planId,
      },
    })
  );
  return { events, uiEvents };
}

async function publish_createHarthmereLiveModeEvent_to_server_event_stream(
  response: LiveModeResponse
) {
  if (!response.events.length) {
    return;
  }
  const redis = await liveModeRedis();
  const tx = redis.primary.multi();
  for (const event of response.events) {
    tx.xadd(
      liveModeEventStreamKey(),
      "*",
      "requestId",
      event.requestId,
      "actorId",
      event.actorId,
      "kind",
      event.kind,
      "event",
      JSON.stringify(event)
    );
  }
  await tx.exec();
}

async function deliver_createHarthmereLiveModeUiEvent_from_server_outbox(
  response: LiveModeResponse
) {
  if (!response.uiEvents.length) {
    return;
  }
  const redis = await liveModeRedis();
  const tx = redis.primary.multi();
  for (const uiEvent of response.uiEvents) {
    tx.xadd(
      liveModeUiOutboxStreamKey(uiEvent.playerId),
      "*",
      "requestId",
      uiEvent.requestId,
      "playerId",
      uiEvent.playerId,
      "kind",
      uiEvent.kind,
      "uiEvent",
      JSON.stringify(uiEvent)
    );
  }
  await tx.exec();
}

async function flushHarthmereLiveModePostCommitOutbox(
  response: LiveModeResponse
) {
  const startedAt = Date.now();
  try {
    await publish_createHarthmereLiveModeEvent_to_server_event_stream(response);
    await deliver_createHarthmereLiveModeUiEvent_from_server_outbox(response);
    const ms = Date.now() - startedAt;
    if (process.env.NODE_ENV === "production" && ms >= 500) {
      log.warn("HARTHMERE_LIVE_MODE_POST_COMMIT_OUTBOX_SLOW", {
        requestId: response.events[0]?.requestId,
        actorId: response.actorId,
        eventCount: response.events.length,
        uiEventCount: response.uiEvents.length,
        ms,
      });
    }
  } catch (error) {
    log.warn("HARTHMERE_LIVE_MODE_POST_COMMIT_OUTBOX_FAILED", {
      requestId: response.events[0]?.requestId,
      actorId: response.actorId,
      eventCount: response.events.length,
      uiEventCount: response.uiEvents.length,
      error,
    });
  }
}

function isHarthmereServerOutpostMaterializationPlan(
  plan: BuildingSystemAnyMaterializationPlan
) {
  return false;
}

export function buildingSystemMaterializationWorldPositionForTest(
  plan: BuildingSystemAnyMaterializationPlan,
  position: readonly [number, number, number]
): Vec3 {
  // Business outposts are authored from production/live coordinates captured
  // in-world, so do not apply the old local-dev Harthmere +512 town shift here.
  return isHarthmereServerOutpostMaterializationPlan(plan)
    ? shiftHarthmereAuthoredPositionToWorld(position)
    : [position[0], position[1], position[2]];
}

function terrainShardAabbForMaterializationPositions(positions: Vec3[]) {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const position of positions) {
    min[0] = Math.min(min[0], position[0]);
    min[1] = Math.min(min[1], position[1]);
    min[2] = Math.min(min[2], position[2]);
    max[0] = Math.max(max[0], position[0] + 1);
    max[1] = Math.max(max[1], position[1] + 1);
    max[2] = Math.max(max[2], position[2] + 1);
  }
  return [min, max] as [Vec3, Vec3];
}

async function resolveTerrainEntityIdsForMaterialization(input: {
  askApi?: Pick<AskApi, "scanForExport">;
  positions: Vec3[];
}) {
  const terrainIdsByShard = new Map<string, BiomesId>();
  const requestedShards = new Set(
    input.positions.map((position) => voxelShard(...position))
  );
  if (!requestedShards.size || !input.askApi) {
    return {
      terrainIdsByShard,
      missingShardCount: 0,
      usedLegacyShardIds: true,
    };
  }

  const bestByShard = new Map<string, { id: BiomesId; version: number }>();
  const aabb = terrainShardAabbForMaterializationPositions(input.positions);
  for await (const [version, entity] of input.askApi.scanForExport({ aabb })) {
    if (!entity.hasShardSeed?.() || !entity.hasBox?.()) {
      continue;
    }
    const box = entity.box();
    if (!box) {
      continue;
    }
    const shardId = voxelShard(...box.v0);
    if (!requestedShards.has(shardId)) {
      continue;
    }
    const current = bestByShard.get(shardId);
    if (
      !current ||
      version > current.version ||
      (version === current.version && entity.id > current.id)
    ) {
      bestByShard.set(shardId, { id: entity.id, version });
    }
  }

  for (const [shardId, match] of bestByShard) {
    terrainIdsByShard.set(shardId, match.id);
  }

  return {
    terrainIdsByShard,
    missingShardCount: [...requestedShards].filter(
      (shardId) => !terrainIdsByShard.has(shardId)
    ).length,
    usedLegacyShardIds: false,
  };
}

export async function publishBuildingSystemMaterializationPlansToEcs(input: {
  logicApi: LogicApi;
  askApi?: Pick<AskApi, "scanForExport">;
  userId: BiomesId;
  plans: BuildingSystemAnyMaterializationPlan[] | undefined;
}) {
  if (!input.plans?.length) {
    return {
      directTerrainEditCount: 0,
      directTerrainShardCount: 0,
      editEventCount: 0,
      missingTerrainShardCount: 0,
      placeGroupEventCount: 0,
      publishBatchCount: 0,
      shiftedOutpostEditEventCount: 0,
      usedLegacyShardIds: false,
    };
  }
  const events: GameEvent[] = [];
  let editEventCount = 0;
  let shiftedOutpostEditEventCount = 0;
  let placeGroupEventCount = 0;
  const worldPositions = input.plans.flatMap((plan) =>
    plan.edits.map((edit) =>
      buildingSystemMaterializationWorldPositionForTest(plan, edit.position)
    )
  );
  const terrainResolution = await resolveTerrainEntityIdsForMaterialization({
    askApi: input.askApi,
    positions: worldPositions,
  });

  for (const plan of input.plans) {
    const shiftsOutpost = isHarthmereServerOutpostMaterializationPlan(plan);
    for (const edit of plan.edits) {
      const position = buildingSystemMaterializationWorldPositionForTest(
        plan,
        edit.position
      );
      const shardId = voxelShard(...position);
      const terrainEntityId =
        terrainResolution.terrainIdsByShard.get(shardId) ??
        (shardId as unknown as BiomesId);
      events.push(
        new GameEvent(
          input.userId,
          new EditEvent({
            id: terrainEntityId,
            position,
            value: edit.value,
            user_id: input.userId,
          })
        )
      );
      editEventCount += 1;
      if (shiftsOutpost) {
        shiftedOutpostEditEventCount += 1;
      }
    }

    if ("placeGroup" in plan && plan.placeGroup.groupId) {
      // Only publish a PlaceGroupEvent when the group id refers to a real,
      // pre-created ECS/DB group. Otherwise the voxel EditEvents above are the
      // authoritative materialization path for this generated building.
      events.push(
        new GameEvent(
          input.userId,
          new PlaceGroupEvent({
            id: plan.placeGroup.groupId,
            user_id: input.userId,
            name: plan.placeGroup.name,
            box: plan.placeGroup.box as any,
          })
        )
      );
      placeGroupEventCount += 1;
    }
  }
  if (terrainResolution.missingShardCount > 0 && input.askApi) {
    throw new Error(
      `Missing ${terrainResolution.missingShardCount} terrain shards for building materialization`
    );
  }

  let publishBatchCount = 0;
  for (
    let offset = 0;
    offset < events.length;
    offset += HARTHMERE_BUILDING_MATERIALIZATION_ECS_PUBLISH_CHUNK_SIZE
  ) {
    await input.logicApi.publish(
      ...events.slice(
        offset,
        offset + HARTHMERE_BUILDING_MATERIALIZATION_ECS_PUBLISH_CHUNK_SIZE
      )
    );
    publishBatchCount += 1;
  }
  return {
    directTerrainEditCount: 0,
    directTerrainShardCount: 0,
    editEventCount,
    missingTerrainShardCount: terrainResolution.missingShardCount,
    placeGroupEventCount,
    publishBatchCount,
    shiftedOutpostEditEventCount,
    usedLegacyShardIds: terrainResolution.usedLegacyShardIds,
  };
}

// HARTHMERE_BUILDING_TERRAIN_GROUNDING (server probe):
// Resolve the REAL surface under each player building / plot-claim plan and shift
// the plan onto it, so a baked structure rests on the ground instead of the flat
// authored plot Y — the same correctness the muckers/animals/markers get from the
// shared grounder, applied once at bake time because voxels cannot be re-grounded
// per frame. Read-only: it probes ONLY the committed seed terrain (player diffs
// ignored, so we never ground onto another player's build) using the same
// `seed.get` call the writer uses. Pre-authored server outpost plans are left
// alone, and ANY failure (missing/unreadable column, no standable surface) falls
// back to the unchanged plans, so the worst case is exactly today's behavior —
// a structure is never buried or teleported, only ever corrected onto real ground.
async function groundBuildingSystemPlansToRealTerrain(input: {
  worldApi: WorldApi;
  askApi?: Pick<AskApi, "scanForExport">;
  plans: BuildingSystemAnyMaterializationPlan[];
}): Promise<BuildingSystemAnyMaterializationPlan[]> {
  const SCAN = 24;
  const groundablePlans = input.plans.filter(
    (plan) =>
      !isHarthmereServerOutpostMaterializationPlan(plan) && plan.edits.length
  );
  if (!groundablePlans.length) {
    return input.plans;
  }
  try {
    // For each plan, load a vertical window of seed terrain around its edit
    // centroid so the shared scan can find the real surface there.
    const probePositions: Vec3[] = [];
    for (const plan of groundablePlans) {
      let sumX = 0;
      let sumZ = 0;
      let minEditY = Infinity;
      for (const edit of plan.edits) {
        sumX += edit.position[0];
        sumZ += edit.position[2];
        minEditY = Math.min(minEditY, edit.position[1]);
      }
      const referenceY =
        "origin" in plan && (plan as any).origin
          ? (plan as any).origin.y
          : minEditY;
      const columnX = Math.floor(sumX / plan.edits.length);
      const columnZ = Math.floor(sumZ / plan.edits.length);
      const anchorY = Math.round(referenceY);
      for (let y = anchorY - SCAN - 1; y <= anchorY + SCAN + 1; y += 1) {
        probePositions.push([columnX, y, columnZ]);
      }
    }
    const terrainResolution = await resolveTerrainEntityIdsForMaterialization({
      askApi: input.askApi,
      positions: probePositions,
    });
    const voxeloo = await loadVoxeloo();
    const editor = input.worldApi.edit();
    const shardIds = [...new Set(probePositions.map((p) => voxelShard(...p)))];
    const terrainIds = shardIds.map(
      (shardId) =>
        terrainResolution.terrainIdsByShard.get(shardId) ??
        (shardId as unknown as BiomesId)
    );
    const terrainEntities = await editor.get(terrainIds);
    const seedByShard = new Map<string, any>();
    try {
      for (let i = 0; i < shardIds.length; i += 1) {
        const terrainEntity = terrainEntities[i];
        if (!terrainEntity) {
          continue;
        }
        const seed = new voxeloo.VolumeBlock_U32();
        loadBlockWrapper(voxeloo, seed, terrainEntity.shardSeed());
        seedByShard.set(shardIds[i], seed);
      }
      const isSolid = (x: number, y: number, z: number): boolean => {
        try {
          const seed = seedByShard.get(voxelShard(x, y, z));
          if (!seed) {
            return false;
          }
          return seed.get(...blockPos(x, y, z)) !== 0;
        } catch {
          return false;
        }
      };
      return input.plans.map((plan) =>
        isHarthmereServerOutpostMaterializationPlan(plan)
          ? plan
          : groundedBuildingSystemMaterializationPlan(plan, isSolid, {
              maxScan: SCAN,
            })
      );
    } finally {
      for (const seed of seedByShard.values()) {
        seed.delete();
      }
    }
  } catch {
    return input.plans;
  }
}

export async function materializeBuildingSystemMaterializationPlansToTerrain(input: {
  worldApi: WorldApi;
  logicApi?: LogicApi;
  askApi?: Pick<AskApi, "scanForExport">;
  userId: BiomesId;
  plans: BuildingSystemAnyMaterializationPlan[] | undefined;
}) {
  if (!input.plans?.length) {
    return {
      directTerrainEditCount: 0,
      directTerrainShardCount: 0,
      editEventCount: 0,
      missingTerrainShardCount: 0,
      placeGroupEventCount: 0,
      publishBatchCount: 0,
      shiftedOutpostEditEventCount: 0,
      usedLegacyShardIds: false,
    };
  }

  // Ground each plan onto the REAL surface before baking, so a building/marker
  // rests on the terrain instead of the flat authored plot Y (see
  // groundBuildingSystemPlansToRealTerrain). Best-effort: failure returns the
  // authored-Y plans unchanged.
  const plans = await groundBuildingSystemPlansToRealTerrain({
    worldApi: input.worldApi,
    askApi: input.askApi,
    plans: input.plans,
  });

  const worldPositions = plans.flatMap((plan) =>
    plan.edits.map((edit) =>
      buildingSystemMaterializationWorldPositionForTest(plan, edit.position)
    )
  );
  const terrainResolution = await resolveTerrainEntityIdsForMaterialization({
    askApi: input.askApi,
    positions: worldPositions,
  });
  if (terrainResolution.missingShardCount > 0 && input.askApi) {
    throw new Error(
      `Missing ${terrainResolution.missingShardCount} terrain shards for building materialization`
    );
  }

  const editsByShard = new Map<
    string,
    Array<{
      position: Vec3;
      value: number;
      expectedValue?: number;
      label: BuildingSystemAnyMaterializationPlan["edits"][number]["label"];
      placerId: BiomesId;
      shiftedOutpost: boolean;
    }>
  >();
  let directTerrainEditCount = 0;
  let shiftedOutpostEditEventCount = 0;
  const placeGroupEvents: GameEvent[] = [];
  for (const plan of plans) {
    const shiftedOutpost = isHarthmereServerOutpostMaterializationPlan(plan);
    for (const edit of plan.edits) {
      const position = buildingSystemMaterializationWorldPositionForTest(
        plan,
        edit.position
      );
      const shardId = voxelShard(...position);
      const shardEdits = editsByShard.get(shardId) ?? [];
      shardEdits.push({
        position,
        value: edit.value,
        expectedValue: edit.expectedValue,
        label: edit.label,
        placerId: safeParseBiomesId(plan.actorId) ?? input.userId,
        shiftedOutpost,
      });
      editsByShard.set(shardId, shardEdits);
      directTerrainEditCount += 1;
      if (shiftedOutpost) {
        shiftedOutpostEditEventCount += 1;
      }
    }

    if ("placeGroup" in plan && plan.placeGroup.groupId) {
      placeGroupEvents.push(
        new GameEvent(
          input.userId,
          new PlaceGroupEvent({
            id: plan.placeGroup.groupId,
            user_id: input.userId,
            name: plan.placeGroup.name,
            box: plan.placeGroup.box as any,
          })
        )
      );
    }
  }

  const voxeloo = await loadVoxeloo();
  const editor = input.worldApi.edit();
  const shardEntries = [...editsByShard.entries()];
  const terrainIds = shardEntries.map(([shardId]) => {
    const terrainEntityId = terrainResolution.terrainIdsByShard.get(shardId);
    if (terrainEntityId !== undefined) {
      return terrainEntityId;
    }
    return shardId as unknown as BiomesId;
  });
  const terrainEntities = await editor.get(terrainIds);
  let directTerrainShardCount = 0;
  for (let i = 0; i < shardEntries.length; i += 1) {
    const [shardId, shardEdits] = shardEntries[i];
    const terrainEntity = terrainEntities[i];
    if (!terrainEntity) {
      throw new Error(
        `Missing terrain entity ${terrainIds[i]} for materialization shard ${shardId}`
      );
    }
    const seed = new voxeloo.VolumeBlock_U32();
    const diff = new voxeloo.SparseBlock_U32();
    const placer = new voxeloo.SparseBlock_U32();
    const occupancy = new voxeloo.SparseBlock_U32();
    try {
      loadBlockWrapper(voxeloo, seed, terrainEntity.shardSeed());
      loadBlockWrapper(voxeloo, diff, terrainEntity.shardDiff());
      loadBlockWrapper(voxeloo, placer, terrainEntity.shardPlacer());
      loadBlockWrapper(voxeloo, occupancy, terrainEntity.shardOccupancy());
      for (const edit of shardEdits) {
        const localPosition = blockPos(...edit.position);
        const currentValue =
          diff.get(...localPosition) ?? seed.get(...localPosition) ?? 0;
        const currentPlacer = placer.get(...localPosition) ?? 0;
        const occupancyId = occupancy.get(...localPosition) ?? 0;
        if (occupancyId) {
          throw new Error(
            `Building materialization conflicts with occupied voxel at ${edit.position.join(
              ","
            )}`
          );
        }
        if (edit.value === 0) {
          if (currentValue === 0) {
            placer.del(...localPosition);
            continue;
          }
          if (
            edit.expectedValue === undefined ||
            currentValue !== edit.expectedValue
          ) {
            throw new Error(
              `Building cleanup expected ${
                edit.expectedValue ?? "an explicit value"
              } but found ${currentValue} at ${edit.position.join(",")}`
            );
          }
          if (seed.get(...localPosition) === 0) {
            diff.del(...localPosition);
          } else {
            diff.set(...localPosition, 0);
          }
          placer.del(...localPosition);
        } else {
          if (currentValue === edit.value) {
            // Idempotent retry. Preserve another actor's placer metadata rather
            // than silently taking ownership of an already-materialized voxel.
            if (!currentPlacer) {
              placer.set(...localPosition, edit.placerId);
            }
            continue;
          }
          const mayReplaceNaturalGround =
            !currentPlacer &&
            (edit.label === "foundation" || edit.label === "safe_ground");
          if (currentValue !== 0 && !mayReplaceNaturalGround) {
            throw new Error(
              `Building materialization would overwrite terrain ${currentValue} at ${edit.position.join(
                ","
              )}`
            );
          }
          diff.set(...localPosition, edit.value);
          placer.set(...localPosition, edit.placerId);
        }
      }
      terrainEntity.mutableShardDiff().buffer = saveBlockWrapper(
        voxeloo,
        diff
      ).buffer;
      terrainEntity.mutableShardPlacer().buffer = saveBlockWrapper(
        voxeloo,
        placer
      ).buffer;
      directTerrainShardCount += 1;
    } finally {
      seed.delete();
      diff.delete();
      placer.delete();
      occupancy.delete();
    }
  }
  await editor.commit();

  let publishBatchCount = 0;
  if (input.logicApi) {
    for (
      let offset = 0;
      offset < placeGroupEvents.length;
      offset += HARTHMERE_BUILDING_MATERIALIZATION_ECS_PUBLISH_CHUNK_SIZE
    ) {
      await input.logicApi.publish(
        ...placeGroupEvents.slice(
          offset,
          offset + HARTHMERE_BUILDING_MATERIALIZATION_ECS_PUBLISH_CHUNK_SIZE
        )
      );
      publishBatchCount += 1;
    }
  }

  return {
    directTerrainEditCount,
    directTerrainShardCount,
    editEventCount: 0,
    missingTerrainShardCount: terrainResolution.missingShardCount,
    placeGroupEventCount: placeGroupEvents.length,
    publishBatchCount,
    shiftedOutpostEditEventCount,
    usedLegacyShardIds: terrainResolution.usedLegacyShardIds,
  };
}

export function harthmereEscortCompanionsFromBackendState(
  state: HarthmereLiveModeBackendState
) {
  return Object.values(state.jobsBoard.postings)
    .map((job) => job.escortCompanion)
    .filter((companion): companion is NonNullable<typeof companion> =>
      Boolean(companion)
    );
}

export async function materializeHarthmereEscortCompanionsToEcs(input: {
  worldApi: WorldApi;
  state: HarthmereLiveModeBackendState;
  nowSeconds: number;
}) {
  const companions = harthmereEscortCompanionsFromBackendState(input.state);
  if (!companions.length) {
    return { changeCount: 0, outcome: "success" as const };
  }
  const ids = companions.map((companion) => companion.entityId);
  const existing = new Set(await input.worldApi.has(ids));
  const changes = buildHarthmereEscortCompanionNpcProposedChanges({
    companions,
    existingIds: existing,
    nowSeconds: input.nowSeconds,
  });
  if (!changes.length) {
    return { changeCount: 0, outcome: "success" as const };
  }
  const applied = await input.worldApi.apply({ changes });
  return { changeCount: changes.length, outcome: applied.outcome };
}

async function hydrateAndRepairHarthmereLiveModeIdempotencyReplay(input: {
  redisPrimary: any;
  idempotencyRedisKey: string;
  envelope: HarthmereLiveModeAuthorityEnvelope;
  response: LiveModeResponse;
  worldApi?: WorldApi;
  idGenerator?: IdGenerator;
}) {
  const hydrated = await hydrateHarthmereLiveModeIdempotencyReplay(input);
  const plans = hydrated.backendMutation?.nativeEcsMaterializationPlans;
  if (!plans?.length) return hydrated;
  const requiresAtomicInventoryExchange = plans.some(
    (plan) => plan.kind === "inventory_exchange"
  );
  let repairError: unknown;

  try {
    if (!input.worldApi || !input.idGenerator) {
      throw new Error(!input.worldApi ? "no_world_api" : "no_id_generator");
    } else {
      const result = await materializeHarthmereNativeEcsPlans({
        redisPrimary: input.redisPrimary,
        worldApi: input.worldApi,
        idGenerator: input.idGenerator,
        plans,
      });
      hydrated.backendMutation?.warnings.push(
        `native_ecs_replay_repaired:created:${result.created}:existing:${result.alreadyMaterialized}`
      );
    }
  } catch (error) {
    repairError = error;
    hydrated.backendMutation?.warnings.push(
      `native_ecs_replay_repair_deferred:${String(
        error instanceof Error ? error.message : error
      ).slice(0, 240)}`
    );
  }

  await input.redisPrimary.set(
    input.idempotencyRedisKey,
    JSON.stringify(slimHarthmereLiveModeIdempotencyResponse(hydrated)),
    "EX",
    24 * 60 * 60
  );
  if (requiresAtomicInventoryExchange && repairError) {
    throw repairError;
  }
  return hydrated;
}

export async function ensureHarthmereWorldMaterializerPlayerExists(
  worldApi: WorldApi
) {
  const editor = worldApi.edit();
  await ensurePlayerExists(
    editor,
    HARTHMERE_WORLD_MATERIALIZER_USER_ID,
    HARTHMERE_WORLD_MATERIALIZER_USERNAME,
    true
  );
  await editor.commit();
}

function normalizeHarthmereLiveModeActorStateAdoption(input: {
  actorId: string;
  playerStateKey: string;
  stateAdoption?: HarthmereLiveModeActorStateAdoption;
}) {
  if (!input.stateAdoption) {
    return undefined;
  }
  if (input.stateAdoption.toActorId !== input.actorId) {
    return undefined;
  }
  if (input.stateAdoption.toStateKey !== input.playerStateKey) {
    return undefined;
  }
  if (input.stateAdoption.fromStateKey === input.playerStateKey) {
    return undefined;
  }
  return input.stateAdoption;
}

function uniqueHarthmereLiveModeWatchKeys(keys: Array<string | undefined>) {
  return [...new Set(keys.filter((key): key is string => !!key))];
}

function shouldAdoptHarthmereLiveModeActorState(input: {
  targetStateRaw: string | null | undefined;
  sourceStateRaw: string | null | undefined;
  reason?: HarthmereLiveModeActorStateAdoption["reason"];
}) {
  if (
    shouldAdoptHarthmereInstallOrphan({
      userStateRaw: input.targetStateRaw,
      installStateRaw: input.sourceStateRaw,
    })
  ) {
    return true;
  }
  if (input.reason !== "linked_game_user") {
    return false;
  }
  const targetProgress = summarizeHarthmereLiveActorStateProgress(
    input.targetStateRaw
  );
  const sourceProgress = summarizeHarthmereLiveActorStateProgress(
    input.sourceStateRaw
  );
  return sourceProgress.meaningful && !targetProgress.meaningful;
}

function summarizeHarthmereLiveActorStateProgress(
  raw: string | null | undefined
) {
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) {
    return { meaningful: false };
  }
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { meaningful: false };
  }
  const inventory = parsed?.inventory ?? {};
  const items: Record<string, unknown> =
    inventory.items && typeof inventory.items === "object"
      ? inventory.items
      : {};
  const materialStorage: Record<string, unknown> =
    parsed?.materialStorage?.items &&
    typeof parsed.materialStorage.items === "object"
      ? parsed.materialStorage.items
      : parsed?.materialStorage && typeof parsed.materialStorage === "object"
      ? parsed.materialStorage
      : {};
  const itemCount = Object.values({ ...items, ...materialStorage }).reduce(
    (sum: number, value: unknown) => sum + Math.max(0, Number(value) || 0),
    0
  );
  const gold = Math.max(
    0,
    Number(inventory.gold ?? parsed?.gold ?? parsed?.wallet?.gold) || 0
  );
  const skills: Record<string, any> =
    parsed?.classMagic?.skills && typeof parsed.classMagic.skills === "object"
      ? parsed.classMagic.skills
      : {};
  const skillXp = Object.values(skills).reduce(
    (sum: number, value: any) => sum + Math.max(0, Number(value?.xp) || 0),
    0
  );
  const actorId =
    typeof parsed?.actorId === "string" ? parsed.actorId : "progress-summary";
  const defaultState = defaultHarthmereLiveModeBackendState(actorId, 0);
  const defaultSkillRows = defaultState.classMagic.skills;
  const defaultSkillXp = Object.values(defaultSkillRows).reduce(
    (sum: number, value: any) => sum + Math.max(0, Number(value?.xp) || 0),
    0
  );
  const activeQuests =
    parsed?.quests?.active && typeof parsed.quests.active === "object"
      ? parsed.quests.active
      : {};
  const completedQuests =
    parsed?.quests?.completed && typeof parsed.quests.completed === "object"
      ? parsed.quests.completed
      : {};
  const activeQuestProgress = Object.values(activeQuests).some(
    (value: any) => Math.max(0, Number(value?.progress) || 0) > 0
  );
  const questCount =
    Object.keys(activeQuests).length + Object.keys(completedQuests).length;
  const defaultQuestCount =
    Object.keys(defaultState.quests.active ?? {}).length +
    Object.keys(defaultState.quests.completed ?? {}).length;
  const propertyCount =
    Object.keys(parsed?.property?.owned ?? {}).length +
    Object.keys(parsed?.building?.ownedPlots ?? {}).length;
  const progressionCount =
    Object.keys(parsed?.progression?.completedMilestones ?? {}).length +
    Object.keys(parsed?.daily?.completedTasks ?? {}).length;
  return {
    meaningful:
      gold > 0 ||
      itemCount > 0 ||
      skillXp > defaultSkillXp ||
      questCount > defaultQuestCount ||
      activeQuestProgress ||
      propertyCount > 0 ||
      progressionCount > 0,
  };
}

function isHarthmereLiveModeReadOnlySnapshotRequest(
  envelope: HarthmereLiveModeAuthorityEnvelope,
  summary: { touchedModels?: string[] }
) {
  const operation = envelope.payload?.operation;
  if (
    envelope.actionKind !== "request_quest_state_update" ||
    envelope.subsystem !== "quest" ||
    ![
      "live_entity_helper_read_state",
      // Compatibility for already-deployed clients. New clients use the
      // dedicated GET route, but an old pure read must never enter Redis WATCH,
      // rewrite player state, or append a mutation ledger record.
      "bible_quest_read",
    ].includes(String(operation ?? ""))
  ) {
    return false;
  }
  const readOnlySnapshotModels = new Set([
    "quest_state",
    "inventory_items",
    "building_state",
  ]);
  // Helper read-state requests return multiple snapshots to hydrate UI, but
  // they are not authoritative writes. Persisting their parsed state can race
  // a just-accepted quest and overwrite it with an older client snapshot.
  return (summary.touchedModels ?? []).every((model) =>
    readOnlySnapshotModels.has(model)
  );
}

function cloneLiveModeStatusChannelValue<T>(value: T): T {
  if (!value || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function statusChannelJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function healthStatusChannel(state: HarthmereLiveModeBackendState) {
  return {
    hp: state.combat.hp,
    maxHp: state.combat.maxHp,
    deathState: state.combat.deathState,
    deathRecords: state.combat.deathRecords,
    respawnProtectionUntilMs: state.combat.respawnProtectionUntilMs,
  };
}

function resourceStatusChannel(state: HarthmereLiveModeBackendState) {
  return {
    resources: state.combat.resources,
    maxResources: state.combat.maxResources,
    lastStaminaTickMs: state.combat.lastStaminaTickMs,
    deadFromStaminaAtMs: state.combat.deadFromStaminaAtMs,
  };
}

function standingStatusChannel(state: HarthmereLiveModeBackendState) {
  return {
    standing: state.law.standing,
    reputation: state.law.reputation,
    recentReputationEvents: state.law.recentReputationEvents,
  };
}

export function preserveFreshHarthmereLiveModeStatusChannelsForTest(input: {
  currentState: HarthmereLiveModeBackendState;
  reducedState: HarthmereLiveModeBackendState;
  latestRawState: string | null | undefined;
  actorId: string;
  nowMs: number;
}) {
  if (!input.latestRawState)
    return { changed: false, channels: [] as string[] };
  let latestState: HarthmereLiveModeBackendState;
  try {
    latestState = parseHarthmereLiveModeBackendState(
      input.latestRawState,
      input.actorId,
      input.nowMs
    );
  } catch {
    return { changed: false, channels: [] as string[] };
  }

  const latestUpdatedAtMs = Number(latestState.updatedAtMs);
  const currentUpdatedAtMs = Number(input.currentState.updatedAtMs);
  if (
    !Number.isFinite(latestUpdatedAtMs) ||
    !Number.isFinite(currentUpdatedAtMs) ||
    latestUpdatedAtMs <= currentUpdatedAtMs
  ) {
    return { changed: false, channels: [] as string[] };
  }

  const channels: string[] = [];
  if (
    statusChannelJson(healthStatusChannel(input.currentState)) ===
    statusChannelJson(healthStatusChannel(input.reducedState))
  ) {
    input.reducedState.combat.hp = latestState.combat.hp;
    input.reducedState.combat.maxHp = latestState.combat.maxHp;
    input.reducedState.combat.deathState = latestState.combat.deathState;
    input.reducedState.combat.deathRecords = cloneLiveModeStatusChannelValue(
      latestState.combat.deathRecords ?? {}
    );
    input.reducedState.combat.respawnProtectionUntilMs =
      latestState.combat.respawnProtectionUntilMs;
    channels.push("health");
  }

  if (
    statusChannelJson(resourceStatusChannel(input.currentState)) ===
    statusChannelJson(resourceStatusChannel(input.reducedState))
  ) {
    input.reducedState.combat.resources = cloneLiveModeStatusChannelValue(
      latestState.combat.resources ?? {}
    );
    input.reducedState.combat.maxResources = cloneLiveModeStatusChannelValue(
      latestState.combat.maxResources ?? {}
    );
    input.reducedState.combat.lastStaminaTickMs =
      latestState.combat.lastStaminaTickMs;
    input.reducedState.combat.deadFromStaminaAtMs =
      latestState.combat.deadFromStaminaAtMs;
    channels.push("resources");
  }

  if (
    statusChannelJson(standingStatusChannel(input.currentState)) ===
    statusChannelJson(standingStatusChannel(input.reducedState))
  ) {
    input.reducedState.law.standing = cloneLiveModeStatusChannelValue(
      latestState.law.standing ?? input.reducedState.law.standing ?? {}
    );
    input.reducedState.law.reputation = cloneLiveModeStatusChannelValue(
      latestState.law.reputation ?? input.reducedState.law.reputation ?? {}
    );
    input.reducedState.law.recentReputationEvents =
      cloneLiveModeStatusChannelValue(
        latestState.law.recentReputationEvents ??
          input.reducedState.law.recentReputationEvents ??
          []
      );
    channels.push("standing");
  }

  return { changed: channels.length > 0, channels };
}

export async function persistHarthmereLiveModeResponse(
  envelope: HarthmereLiveModeAuthorityEnvelope,
  response: LiveModeResponse,
  deps: {
    askApi?: Pick<AskApi, "scanForExport">;
    idGenerator?: IdGenerator;
    logicApi: LogicApi;
    worldApi?: WorldApi;
    userId?: BiomesId;
    stateAdoption?: HarthmereLiveModeActorStateAdoption;
  }
): Promise<LiveModeResponse> {
  const persistStartedAt = Date.now();
  let lastAttemptTimings: Record<string, number> | undefined;
  const key = liveModeIdempotencyKey(
    response.actorId,
    response.mutationPlan?.idempotencyKey ?? "invalid"
  );
  const redis = await liveModeRedis();
  const playerStateKey = harthmereLiveModePlayerStateKey(response.actorId);
  const sharedWorldStateKey = harthmereLiveModeSharedWorldStateKey();
  const readOnlyQuestOperation =
    envelope.actionKind === "request_quest_state_update" &&
    envelope.subsystem === "quest"
      ? String(envelope.payload?.operation ?? "")
      : undefined;
  if (
    readOnlyQuestOperation === "bible_quest_read" ||
    readOnlyQuestOperation === "live_entity_helper_read_state"
  ) {
    // Compatibility path for clients deployed before these reads moved away
    // from the mutation endpoint. They are projections: no actor lock, WATCH,
    // reducer, ledger append, idempotency write, or state rewrite.
    const now = Date.now();
    const { rawState, rawSharedState } =
      await readHarthmerePlayerAndSharedStateStrings(
        redis.primary,
        playerStateKey,
        sharedWorldStateKey
      );
    const state = parseHarthmereLiveModeBackendState(
      rawState,
      response.actorId,
      now
    );
    mergeHarthmereLiveModeSharedWorldStateIntoBackend(
      state,
      parseHarthmereLiveModeSharedWorldState(rawSharedState, now),
      now
    );
    const includedSnapshots: HarthmereLiveModeMutationSnapshotKey[] =
      readOnlyQuestOperation === "live_entity_helper_read_state"
        ? ["questState", "inventoryLootState", "buildingState"]
        : ["questState"];
    const includedSnapshotSet = new Set(includedSnapshots);
    return {
      ...response,
      persisted: false,
      snapshotMode: "changed",
      includedSnapshots,
      invalidatedSnapshots: HARTHMERE_LIVE_MODE_MUTATION_SNAPSHOT_KEYS.filter(
        (snapshot) => !includedSnapshotSet.has(snapshot)
      ),
      ...(includedSnapshotSet.has("inventoryLootState")
        ? {
            inventoryLootState:
              createHarthmereInventoryLootClientSnapshotFromBackend(state),
          }
        : {}),
      ...(includedSnapshotSet.has("buildingState")
        ? {
            buildingState: createHarthmereLiveModeBuildingClientSnapshot(state),
          }
        : {}),
      questState: createHarthmereLiveModeQuestClientSnapshot(state),
    };
  }

  const previousBeforeActorLock = await redis.primary.get(key);
  if (previousBeforeActorLock) {
    return hydrateAndRepairHarthmereLiveModeIdempotencyReplay({
      redisPrimary: redis.primary,
      idempotencyRedisKey: key,
      envelope,
      response: JSON.parse(previousBeforeActorLock) as LiveModeResponse,
      worldApi: deps.worldApi,
      idGenerator: deps.idGenerator,
    });
  }
  const stateAdoption = normalizeHarthmereLiveModeActorStateAdoption({
    actorId: response.actorId,
    playerStateKey,
    stateAdoption: deps.stateAdoption,
  });
  const adoptionSourceStateKey = stateAdoption?.fromStateKey;
  const actorLock: HarthmereActorStateLock =
    await acquireHarthmereActorStateLock(
      redis.primary as any,
      response.actorId,
      {
        waitMs: 25_000,
        ttlMs: 45_000,
        retryMs: 20,
      }
    );
  if (!actorLock.acquired) {
    throw new Error("Harthmere live-mode actor authority lock timed out");
  }
  let actorLockReleased = false;
  const releaseActorLock = async () => {
    if (actorLockReleased) return;
    actorLockReleased = true;
    await actorLock.release();
  };
  // Dedicated per-request connection: WATCH is per-connection, so sharing one
  // connection across concurrent requests silently disables optimistic
  // concurrency (see acquireHarthmereLiveModeTxClient).
  const { client: txPrimary, release: releaseTxPrimary } =
    await acquireHarthmereLiveModeTxClient(redis.primary);
  const supportsWatch = typeof (txPrimary as any).watch === "function";
  if (!supportsWatch) {
    await releaseActorLock();
    await releaseTxPrimary();
    throw new Error(
      "Harthmere live-mode Redis client must support WATCH for transactional persistence"
    );
  }

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const attemptTimings: Record<string, number> = {};
      const mark = (stage: string, startedAt: number) => {
        attemptTimings[stage] = Date.now() - startedAt;
      };
      lastAttemptTimings = attemptTimings;
      let stageStartedAt = Date.now();
      const previous = await txPrimary.get(key);
      mark("idempotency_get_ms", stageStartedAt);
      if (previous) {
        return hydrateHarthmereLiveModeIdempotencyReplay({
          redisPrimary: txPrimary,
          envelope,
          response: JSON.parse(previous) as LiveModeResponse,
        });
      }

      // HARTHMERE_LIVE_MODE_SCOPED_WATCH (audit fix, 2026-07-13): previously
      // EVERY mutation WATCHed (and re-wrote) the single global
      // `sharedWorldStateKey`, so any concurrent write by ANY player aborted the
      // EXEC and forced a full re-read/re-reduce retry — the primary source of
      // the observed 4–29s mutation latencies under load. The first attempt now
      // watches only the keys this mutation always touches; if the reducer turns
      // out to have CHANGED shared world state, we escalate below (same
      // re-watch/re-read/re-reduce pattern the auction-seller settlement already
      // uses) and only then watch + write the shared key. Mutations that never
      // touch shared state (eat, medical, movement mirrors, inventory ops)
      // no longer contend on it at all.
      const watchKeys = uniqueHarthmereLiveModeWatchKeys([
        key,
        playerStateKey,
        adoptionSourceStateKey,
      ]);
      const now = Date.now();
      if (supportsWatch) {
        stageStartedAt = Date.now();
        await (txPrimary as any).watch(...watchKeys);
        mark("watch_ms", stageStartedAt);
      }

      stageStartedAt = Date.now();
      const watchedPrevious = await txPrimary.get(key);
      mark("watched_idempotency_get_ms", stageStartedAt);
      if (watchedPrevious) {
        await redisUnwatchIfSupported(txPrimary);
        return hydrateHarthmereLiveModeIdempotencyReplay({
          redisPrimary: txPrimary,
          envelope,
          response: JSON.parse(watchedPrevious) as LiveModeResponse,
        });
      }

      stageStartedAt = Date.now();
      let { rawState, rawSharedState } =
        await readHarthmerePlayerAndSharedStateStrings(
          txPrimary,
          playerStateKey,
          sharedWorldStateKey
        );
      let rawAdoptionSourceState = adoptionSourceStateKey
        ? await txPrimary.get(adoptionSourceStateKey)
        : undefined;
      mark("state_get_ms", stageStartedAt);
      stageStartedAt = Date.now();
      let adoptedActorState =
        stateAdoption &&
        shouldAdoptHarthmereLiveModeActorState({
          targetStateRaw: rawState,
          sourceStateRaw: rawAdoptionSourceState,
          reason: stateAdoption.reason,
        });
      let currentState = parseHarthmereLiveModeBackendState(
        adoptedActorState ? rawAdoptionSourceState : rawState,
        response.actorId,
        now
      );
      mergeHarthmereLiveModeSharedWorldStateIntoBackend(
        currentState,
        parseHarthmereLiveModeSharedWorldState(rawSharedState, now),
        now
      );
      mark("state_parse_merge_ms", stageStartedAt);
      stageStartedAt = Date.now();
      let reduced = reduceHarthmereLiveModeBackendState(
        currentState,
        envelope,
        now
      );
      mark("reduce_ms", stageStartedAt);
      let settlement = buildAuctionSellerSettlement({
        envelope,
        beforeState: currentState,
        afterState: reduced.state,
      });
      let sellerStateKey = settlement
        ? harthmereLiveModePlayerStateKey(settlement.sellerId)
        : undefined;

      // HARTHMERE_LIVE_MODE_SCOPED_WATCH: detect whether this mutation actually
      // changed the shared world projection. Both serializations use the same
      // `now`, so timestamps cancel and the comparison is purely structural.
      // `reduceHarthmereLiveModeBackendState` deep-clones its input, so
      // `currentState` still holds the pre-reduce (merged) view here.
      const mayChangeSharedWorld = harthmereMutationMayChangeSharedWorldForTest(
        {
          sharedWorldStateKey,
          sharedStateKeys: reduced.summary.sharedStateKeys,
          touchedModels: reduced.summary.touchedModels,
        }
      );
      let sharedWorldStateAfter = "";
      let sharedWorldWriteNeeded = false;
      if (mayChangeSharedWorld) {
        const sharedWorldStateBefore = JSON.stringify(
          createHarthmereLiveModeSharedWorldState(currentState, now)
        );
        sharedWorldStateAfter = JSON.stringify(
          createHarthmereLiveModeSharedWorldState(reduced.state, now)
        );
        sharedWorldWriteNeeded =
          sharedWorldStateAfter !== sharedWorldStateBefore;
      }

      if ((sellerStateKey || sharedWorldWriteNeeded) && supportsWatch) {
        await redisUnwatchIfSupported(txPrimary);
        await (txPrimary as any).watch(
          ...uniqueHarthmereLiveModeWatchKeys([
            key,
            playerStateKey,
            sharedWorldStateKey,
            adoptionSourceStateKey,
            sellerStateKey,
          ])
        );
        const secondPrevious = await txPrimary.get(key);
        if (secondPrevious) {
          await redisUnwatchIfSupported(txPrimary);
          return hydrateHarthmereLiveModeIdempotencyReplay({
            redisPrimary: txPrimary,
            envelope,
            response: JSON.parse(secondPrevious) as LiveModeResponse,
          });
        }
        stageStartedAt = Date.now();
        ({ rawState, rawSharedState } =
          await readHarthmerePlayerAndSharedStateStrings(
            txPrimary,
            playerStateKey,
            sharedWorldStateKey
          ));
        rawAdoptionSourceState = adoptionSourceStateKey
          ? await txPrimary.get(adoptionSourceStateKey)
          : undefined;
        mark("seller_state_get_ms", stageStartedAt);
        stageStartedAt = Date.now();
        adoptedActorState =
          stateAdoption &&
          shouldAdoptHarthmereLiveModeActorState({
            targetStateRaw: rawState,
            sourceStateRaw: rawAdoptionSourceState,
            reason: stateAdoption.reason,
          });
        currentState = parseHarthmereLiveModeBackendState(
          adoptedActorState ? rawAdoptionSourceState : rawState,
          response.actorId,
          now
        );
        mergeHarthmereLiveModeSharedWorldStateIntoBackend(
          currentState,
          parseHarthmereLiveModeSharedWorldState(rawSharedState, now),
          now
        );
        mark("seller_state_parse_merge_ms", stageStartedAt);
        stageStartedAt = Date.now();
        reduced = reduceHarthmereLiveModeBackendState(
          currentState,
          envelope,
          now
        );
        mark("seller_reduce_ms", stageStartedAt);
        settlement = buildAuctionSellerSettlement({
          envelope,
          beforeState: currentState,
          afterState: reduced.state,
        });
        sellerStateKey = settlement
          ? harthmereLiveModePlayerStateKey(settlement.sellerId)
          : undefined;
        // HARTHMERE_LIVE_MODE_SCOPED_WATCH: we escalated because the first
        // reduce changed shared world state (or settled an auction). The shared
        // key is now WATCHed and the state re-read, so persist the (re-reduced)
        // shared projection unconditionally — writing an identical value under
        // WATCH is harmless, missing a changed one is not.
        sharedWorldStateAfter = JSON.stringify(
          createHarthmereLiveModeSharedWorldState(reduced.state, now)
        );
        sharedWorldWriteNeeded = true;
      }

      let sellerState:
        | ReturnType<typeof parseHarthmereLiveModeBackendState>
        | undefined;
      if (settlement && sellerStateKey) {
        stageStartedAt = Date.now();
        const rawSellerState = await txPrimary.get(sellerStateKey);
        sellerState = parseHarthmereLiveModeBackendState(
          rawSellerState,
          settlement.sellerId,
          now
        );
        applyAuctionSellerSettlement({
          sellerState,
          settlement,
          requestId: envelope.requestId,
          nowMs: now,
        });
        reduced.summary.warnings.push(
          "auction_seller_account_settled_atomically"
        );
        mark("seller_settlement_ms", stageStartedAt);
      }

      const requestedCraftingStationId =
        typeof envelope.payload.stationId === "string"
          ? envelope.payload.stationId
          : typeof envelope.payload.stationId === "number"
          ? String(Math.trunc(envelope.payload.stationId))
          : undefined;
      const requestedCraftingStationType =
        typeof envelope.payload.stationType === "string"
          ? envelope.payload.stationType
          : undefined;

      if (adoptedActorState && stateAdoption) {
        reduced.summary.warnings.push(
          `actor_state_adopted:${stateAdoption.reason}:${stateAdoption.fromActorId}->${stateAdoption.toActorId}`
        );
      }

      const includedSnapshots = harthmereLiveModeMutationSnapshotKeys({
        actionKind: reduced.summary.actionKind,
        subsystem: reduced.summary.subsystem,
        touchedModels: reduced.summary.touchedModels,
      });
      const persistActorAndSharedState =
        !isHarthmereLiveModeReadOnlySnapshotRequest(envelope, reduced.summary);
      if (persistActorAndSharedState && !nativeBiomesEcsAuthorityEnabled()) {
        stageStartedAt = Date.now();
        const latestRawStateForStatusChannels = await txPrimary.get(
          playerStateKey
        );
        const statusChannelPreservation =
          preserveFreshHarthmereLiveModeStatusChannelsForTest({
            currentState,
            reducedState: reduced.state,
            latestRawState: latestRawStateForStatusChannels,
            actorId: response.actorId,
            nowMs: now,
          });
        if (statusChannelPreservation.changed) {
          reduced.summary.warnings.push(
            `fresh_status_channels_preserved:${statusChannelPreservation.channels.join(
              ","
            )}`
          );
        }
        mark("fresh_status_channels_ms", stageStartedAt);
      }
      const includedSnapshotSet = new Set(includedSnapshots);
      const persistedResponse: LiveModeResponse = {
        ...response,
        backendMutation: reduced.summary,
        snapshotMode: useFullHarthmereLiveModeMutationSnapshots()
          ? "full"
          : "changed",
        includedSnapshots,
        invalidatedSnapshots: HARTHMERE_LIVE_MODE_MUTATION_SNAPSHOT_KEYS.filter(
          (key) => !includedSnapshotSet.has(key)
        ),
      };

      stageStartedAt = Date.now();
      if (includedSnapshotSet.has("buildingState")) {
        persistedResponse.buildingState =
          createHarthmereLiveModeBuildingClientSnapshot(reduced.state);
      }
      if (includedSnapshotSet.has("bankingState")) {
        persistedResponse.bankingState =
          createHarthmereLiveModeBankingClientSnapshot(reduced.state);
      }
      if (includedSnapshotSet.has("guildState")) {
        persistedResponse.guildState =
          createHarthmereLiveModeGuildClientSnapshotFromBackend(reduced.state);
      }
      if (includedSnapshotSet.has("economyState")) {
        persistedResponse.economyState =
          createHarthmereProductionEconomyClientSnapshotFromBackend(
            reduced.state
          );
      }
      if (includedSnapshotSet.has("jobsBoardState")) {
        persistedResponse.jobsBoardState =
          createHarthmereJobsBoardClientSnapshotFromBackend(reduced.state);
      }
      if (includedSnapshotSet.has("dailyState")) {
        persistedResponse.dailyState =
          createHarthmereCareLoopClientSnapshotFromBackend(reduced.state, now);
      }
      if (includedSnapshotSet.has("farmingFoodState")) {
        persistedResponse.farmingFoodState =
          createHarthmereLiveModeFarmingFoodClientSnapshot(reduced.state);
      }
      if (includedSnapshotSet.has("craftingState")) {
        persistedResponse.craftingState =
          createHarthmereCraftingStationClientSnapshotFromBackend(
            reduced.state,
            requestedCraftingStationId,
            requestedCraftingStationType,
            now
          );
      }
      if (includedSnapshotSet.has("inventoryLootState")) {
        persistedResponse.inventoryLootState =
          createHarthmereInventoryLootClientSnapshotFromBackend(reduced.state);
      }
      if (includedSnapshotSet.has("combatState")) {
        persistedResponse.combatState =
          createHarthmereLiveEntityCombatClientSnapshot(reduced.state);
      }
      if (includedSnapshotSet.has("playerStatusState")) {
        persistedResponse.playerStatusState =
          createHarthmereLiveModePlayerStatusClientSnapshot(reduced.state);
      }
      if (includedSnapshotSet.has("questState")) {
        persistedResponse.questState =
          createHarthmereLiveModeQuestClientSnapshot(reduced.state);
      }
      mark("snapshots_ms", stageStartedAt);

      stageStartedAt = Date.now();
      const tx = txPrimary.multi();
      if (persistActorAndSharedState) {
        tx.set(
          playerStateKey,
          stringifyHarthmereLiveModePlayerPersistenceState(reduced.state)
        );
        // HARTHMERE_LIVE_MODE_SCOPED_WATCH: only rewrite the global shared
        // world blob when this mutation actually changed it (detected above,
        // in which case the shared key was escalated into the WATCH set).
        // Skipping the no-op write removes the cross-player EXEC contention
        // that made unrelated mutations (eat/medical/inventory) retry for
        // seconds under load.
        if (sharedWorldWriteNeeded) {
          tx.set(sharedWorldStateKey, sharedWorldStateAfter);
        }
      }
      if (adoptedActorState && adoptionSourceStateKey) {
        (tx as { del?: (key: string) => unknown }).del?.(
          adoptionSourceStateKey
        );
      }
      if (sellerStateKey && sellerState) {
        tx.set(
          sellerStateKey,
          stringifyHarthmereLiveModePlayerPersistenceState(sellerState)
        );
      }
      tx.xadd(
        harthmereLiveModeLedgerStreamKey(response.actorId),
        "*",
        "requestId",
        persistedResponse.events[0]?.requestId ??
          response.mutationPlan?.planId ??
          key,
        "actorId",
        response.actorId,
        "actionKind",
        response.mutationPlan?.actionKind ?? "unknown",
        "mutation",
        JSON.stringify(reduced.summary)
      );
      tx.set(
        key,
        JSON.stringify(
          slimHarthmereLiveModeIdempotencyResponse(persistedResponse)
        ),
        "EX",
        24 * 60 * 60,
        "NX"
      );
      const txResult = await tx.exec();
      mark("tx_exec_ms", stageStartedAt);
      if (supportsWatch && txResult === null) {
        continue;
      }
      if (
        nativeBiomesEcsAuthorityEnabled() &&
        deps.worldApi &&
        deps.userId !== undefined
      ) {
        stageStartedAt = Date.now();
        try {
          await syncHarthmereCommittedStatusToNativeEcs({
            worldApi: deps.worldApi,
            userId: deps.userId,
            state: reduced.state,
          });
          persistedResponse.backendMutation?.warnings.push(
            "native_ecs_status_projected:gold:standing"
          );
          const sellerUserId = settlement
            ? safeParseBiomesId(settlement.sellerId)
            : undefined;
          if (sellerUserId && sellerState) {
            await syncHarthmereCommittedStatusToNativeEcs({
              worldApi: deps.worldApi,
              userId: sellerUserId,
              state: sellerState,
            });
            persistedResponse.backendMutation?.warnings.push(
              "native_ecs_seller_status_projected:gold:standing"
            );
          }
        } catch (error) {
          persistedResponse.backendMutation?.warnings.push(
            `native_ecs_status_projection_deferred:${String(
              error instanceof Error ? error.message : error
            ).slice(0, 240)}`
          );
        }
        await txPrimary.set(
          key,
          JSON.stringify(
            slimHarthmereLiveModeIdempotencyResponse(persistedResponse)
          ),
          "EX",
          24 * 60 * 60
        );
        mark("native_ecs_status_projection_ms", stageStartedAt);
      }

      // Keep the actor lock through the small ECS wallet/standing projection so
      // two committed mutations cannot publish their results out of order.
      // Release before terrain/drop materialization, which may be substantially
      // slower and is independently idempotent.
      await releaseActorLock();

      if (reduced.summary.nativeEcsMaterializationPlans?.length) {
        stageStartedAt = Date.now();
        const requiresAtomicInventoryExchange =
          reduced.summary.nativeEcsMaterializationPlans.some(
            (plan) => plan.kind === "inventory_exchange"
          );
        let materializationError: unknown;
        try {
          if (!deps.worldApi || !deps.idGenerator) {
            throw new Error(
              !deps.worldApi ? "no_world_api" : "no_id_generator"
            );
          } else {
            const materialized = await materializeHarthmereNativeEcsPlans({
              redisPrimary: txPrimary,
              worldApi: deps.worldApi,
              idGenerator: deps.idGenerator,
              plans: reduced.summary.nativeEcsMaterializationPlans,
            });
            persistedResponse.backendMutation?.warnings.push(
              `native_ecs_materialized:created:${materialized.created}:existing:${materialized.alreadyMaterialized}`
            );
          }
        } catch (error) {
          materializationError = error;
          persistedResponse.backendMutation?.warnings.push(
            `native_ecs_materialization_deferred:${String(
              error instanceof Error ? error.message : error
            ).slice(0, 240)}`
          );
        }
        await txPrimary.set(
          key,
          JSON.stringify(
            slimHarthmereLiveModeIdempotencyResponse(persistedResponse)
          ),
          "EX",
          24 * 60 * 60
        );
        mark("native_ecs_materialization_ms", stageStartedAt);
        if (requiresAtomicInventoryExchange && materializationError) {
          // The Redis/idempotency commit remains repairable, but the client
          // must not advance to the payout step until this exact request is
          // replayed and the native exchange succeeds.
          throw materializationError;
        }
      }

      // Materialize server-approved building plans after the state/idempotency
      // commit succeeds. This keeps ECS side effects downstream of durable state.
      if (reduced.summary.buildingMaterializationPlans?.length) {
        stageStartedAt = Date.now();
        const materializerUserId =
          deps.userId ?? HARTHMERE_WORLD_MATERIALIZER_USER_ID;
        try {
          if (deps.userId === undefined) {
            if (deps.worldApi) {
              await ensureHarthmereWorldMaterializerPlayerExists(deps.worldApi);
              persistedResponse.backendMutation?.warnings.push(
                "building_materializer_player_ensured"
              );
            } else {
              persistedResponse.backendMutation?.warnings.push(
                "building_materializer_player_not_ensured:no_world_api"
              );
            }
          }
          const materializationCounts =
            deps.worldApi && deps.askApi
              ? await materializeBuildingSystemMaterializationPlansToTerrain({
                  askApi: deps.askApi,
                  logicApi: deps.logicApi,
                  userId: materializerUserId,
                  worldApi: deps.worldApi,
                  plans: reduced.summary.buildingMaterializationPlans,
                })
              : await publishBuildingSystemMaterializationPlansToEcs({
                  askApi: deps.askApi,
                  logicApi: deps.logicApi,
                  userId: materializerUserId,
                  plans: reduced.summary.buildingMaterializationPlans,
                });
          const acknowledgedStructures =
            await markBuildingMaterializationPlansAppliedForTest({
              redisPrimary: txPrimary,
              sharedWorldStateKey,
              plans: reduced.summary.buildingMaterializationPlans,
              nowMs: Date.now(),
            });
          persistedResponse.backendMutation?.warnings.push(
            `building_materialized:edit_events:${materializationCounts.editEventCount}:place_group_events:${materializationCounts.placeGroupEventCount}:publish_batches:${materializationCounts.publishBatchCount}`
          );
          if (acknowledgedStructures > 0) {
            persistedResponse.backendMutation?.warnings.push(
              `building_materialization_acknowledged:${acknowledgedStructures}`
            );
          }
          if (materializationCounts.directTerrainEditCount > 0) {
            persistedResponse.backendMutation?.warnings.push(
              `building_materialized_direct_terrain:terrain_edits:${materializationCounts.directTerrainEditCount}:terrain_shards:${materializationCounts.directTerrainShardCount}`
            );
          }
          if (materializationCounts.shiftedOutpostEditEventCount > 0) {
            persistedResponse.backendMutation?.warnings.push(
              `building_materialized_harthmere_outpost_world_shifted:edit_events:${materializationCounts.shiftedOutpostEditEventCount}`
            );
          }
          if (materializationCounts.usedLegacyShardIds) {
            persistedResponse.backendMutation?.warnings.push(
              "building_materialized_without_terrain_entity_resolution"
            );
          }
          if (deps.userId === undefined) {
            persistedResponse.backendMutation?.warnings.push(
              "building_materialized_with_world_materializer_user"
            );
          }
        } catch (error) {
          persistedResponse.backendMutation?.warnings.push(
            `building_materialization_deferred:${String(
              error instanceof Error ? error.message : error
            ).slice(0, 240)}`
          );
        }
        await txPrimary.set(
          key,
          JSON.stringify(
            slimHarthmereLiveModeIdempotencyResponse(persistedResponse)
          ),
          "EX",
          24 * 60 * 60
        );
        mark("materialization_ms", stageStartedAt);
      }

      if (
        reduced.summary.touchedModels.some((model) =>
          model.toLowerCase().includes("escort_companion")
        )
      ) {
        stageStartedAt = Date.now();
        try {
          if (!deps.worldApi) {
            persistedResponse.backendMutation?.warnings.push(
              "escort_companion_materialization_deferred:no_world_api"
            );
          } else {
            const materialized =
              await materializeHarthmereEscortCompanionsToEcs({
                worldApi: deps.worldApi,
                state: reduced.state,
                nowSeconds: Math.floor(now / 1000),
              });
            persistedResponse.backendMutation?.warnings.push(
              `escort_companion_materialized:changes:${materialized.changeCount}:outcome:${materialized.outcome}`
            );
          }
        } catch (error) {
          persistedResponse.backendMutation?.warnings.push(
            `escort_companion_materialization_deferred:${String(
              error instanceof Error ? error.message : error
            ).slice(0, 240)}`
          );
        }
        await txPrimary.set(
          key,
          JSON.stringify(
            slimHarthmereLiveModeIdempotencyResponse(persistedResponse)
          ),
          "EX",
          24 * 60 * 60
        );
        mark("escort_companion_materialization_ms", stageStartedAt);
      }

      const persistMs = Date.now() - persistStartedAt;
      if (process.env.NODE_ENV === "production" && persistMs >= 1000) {
        log.warn("HARTHMERE_LIVE_MODE_PERSIST_SLOW", {
          requestId: envelope.requestId,
          actorId: response.actorId,
          actionKind: envelope.actionKind,
          subsystem: envelope.subsystem,
          attempt,
          persistMs,
          actorLockWaitMs: actorLock.waitedMs,
          timings: attemptTimings,
          includedSnapshots,
          eventCount: persistedResponse.events.length,
          uiEventCount: persistedResponse.uiEvents.length,
        });
      }
      void flushHarthmereLiveModePostCommitOutbox(persistedResponse);
      return slimLiveModeResponseForClient(persistedResponse);
    }

    log.warn("HARTHMERE_LIVE_MODE_PERSIST_CONFLICTED", {
      requestId: envelope.requestId,
      actorId: response.actorId,
      actionKind: envelope.actionKind,
      subsystem: envelope.subsystem,
      persistMs: Date.now() - persistStartedAt,
      timings: lastAttemptTimings,
      actorLockWaitMs: actorLock.waitedMs,
    });
    throw new Error(
      "Harthmere live-mode Redis transaction conflicted too many times"
    );
  } finally {
    await releaseActorLock();
    await releaseTxPrimary();
  }
}

export default biomesApiHandler(
  {
    auth: "optional",
    body: zLiveModeRequest,
    response: zLiveModeResponse,
  },
  async ({
    context: { askApi, idGenerator, logicApi, worldApi },
    auth,
    body,
    unsafeRequest,
    unsafeResponse,
  }) => {
    disableHarthmereLiveModeHttpCaching(unsafeResponse);
    const actorIdentity = liveModeActorIdentityFromRequest({
      auth,
      unsafeRequest,
    });
    if (
      actorIdentity.userId === undefined &&
      actorIdentity.installId === undefined
    ) {
      return {
        ok: false,
        version: HARTHMERE_LIVE_MODE_SERVER_ROUTE,
        actorId: actorIdentity.actorId,
        duplicate: false,
        replayed: false,
        persisted: false,
        validation: {
          ok: false,
          errors: ["unauthorized:missing_biomes_auth_or_glitch_install_id"],
          warnings: [],
          rejectedClientClaims: [],
        },
        events: [],
        uiEvents: [],
      };
    }
    if (
      nativeBiomesEcsAuthorityEnabled() &&
      nativeEcsOwnsHarthmereLiveModeActionForTest(body.actionKind)
    ) {
      return {
        ok: false,
        version: HARTHMERE_LIVE_MODE_SERVER_ROUTE,
        actorId: actorIdentity.actorId,
        duplicate: false,
        replayed: false,
        persisted: false,
        validation: {
          ok: false,
          errors: [
            actorIdentity.userId === undefined
              ? "native_ecs_authenticated_actor_required"
              : `native_ecs_authority_required:${body.actionKind}`,
          ],
          warnings: [],
          rejectedClientClaims: [],
        },
        events: [],
        uiEvents: [],
      };
    }
    if (
      nativeBiomesEcsAuthorityEnabled() &&
      nativeEcsRejectsLegacyFarmingRequestForTest(body)
    ) {
      return {
        ok: false,
        version: HARTHMERE_LIVE_MODE_SERVER_ROUTE,
        actorId: actorIdentity.actorId,
        duplicate: false,
        replayed: false,
        persisted: false,
        validation: {
          ok: false,
          errors: [
            `native_ecs_farming_action_required:${String(
              body.payload.operation ?? "unknown"
            )}`,
          ],
          warnings: [],
          rejectedClientClaims: [],
        },
        events: [],
        uiEvents: [],
      };
    }
    if (
      actorIdentity.userId === undefined &&
      nativeBiomesEcsAuthorityEnabled() &&
      nativeEcsPhysicalDropNeedsAuthenticatedActorForTest(body)
    ) {
      return {
        ok: false,
        version: HARTHMERE_LIVE_MODE_SERVER_ROUTE,
        actorId: actorIdentity.actorId,
        duplicate: false,
        replayed: false,
        persisted: false,
        validation: {
          ok: false,
          errors: ["native_ecs_authenticated_actor_required"],
          warnings: [],
          rejectedClientClaims: [],
        },
        events: [],
        uiEvents: [],
      };
    }
    // Heal the install/user split on writes too: converge an install-only write
    // onto the linked user key and record the install->user link on the first
    // authed write, so actions never strand progress under a second key.
    const actorContext = await resolveHarthmereLiveModeActorContext(
      await liveModeRedis(),
      { auth, unsafeRequest },
      actorIdentity.actorId
    );
    const actorId = actorContext.actorId;
    const needsNativeToolEvidence =
      (body.actionKind === "request_farming_action" &&
        [
          "gather_node",
          "mine_exotic_matter_deposit",
          "cook_enqueue",
          "cook_collect",
          "cook_cancel",
        ].includes(String(body.payload.operation ?? ""))) ||
      body.actionKind === "request_jobs_board_mutation" ||
      (body.actionKind === "request_care_loop_action" &&
        body.payload.operation === "world_object_interaction" &&
        body.payload.interactionKind === "repair") ||
      (body.actionKind === "request_quest_state_update" &&
        body.payload.completed === true &&
        String(body.payload.questId ?? "").startsWith("jobs_board:"));
    const [serverActorContext, serverTargetPosition] = await Promise.all([
      actorIdentity.userId !== undefined
        ? readServerActorNativeContextForLiveMode(
            worldApi,
            actorIdentity.userId,
            needsNativeToolEvidence
          )
        : Promise.resolve({
            position: combatActorPositionFromInstallLiveModeBody(body),
            itemIds: undefined,
            itemCounts: undefined,
            equippedItemKeys: undefined,
          }),
      readServerTargetPositionForQuestInvite(worldApi, body),
    ]);
    const envelope =
      wire_network_requests_to_validateHarthmereLiveModeAuthorityEnvelope(
        actorId,
        body,
        serverActorContext.position,
        serverTargetPosition,
        serverActorContext.itemIds,
        serverActorContext.itemCounts,
        serverActorContext.equippedItemKeys
      );
    const validation = validateHarthmereLiveModeAuthorityEnvelope(envelope);
    if (!validation.ok) {
      return {
        ok: false,
        version: HARTHMERE_LIVE_MODE_SERVER_ROUTE,
        actorId,
        duplicate: false,
        replayed: false,
        persisted: false,
        validation,
        events: [],
        uiEvents: [],
      };
    }

    const mutationPlan =
      buildHarthmereLiveModePersistenceMutationPlan(envelope);
    const routed =
      route_real_attacks_abilities_xp_loot_death_respawn_through_shared_rules(
        envelope,
        mutationPlan
      );
    return persistHarthmereLiveModeResponse(
      envelope,
      {
        ok: true,
        version: HARTHMERE_LIVE_MODE_SERVER_ROUTE,
        actorId,
        duplicate: false,
        replayed: false,
        persisted: true,
        validation,
        mutationPlan,
        events: routed.events,
        uiEvents: routed.uiEvents,
      },
      {
        askApi,
        idGenerator,
        logicApi,
        worldApi,
        userId: actorIdentity.userId,
        stateAdoption: actorContext.stateAdoption,
      }
    );
  }
);
