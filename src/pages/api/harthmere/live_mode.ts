import { GameEvent } from "@/server/shared/api/game_event";
import type { AskApi } from "@/server/ask/api";
import type { LogicApi } from "@/server/shared/api/logic";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import type { WorldApi } from "@/server/shared/world/api";
import { ensurePlayerExists } from "@/server/logic/utils/players";
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
import { blockPos, voxelShard } from "@/shared/game/shard";
import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";
import { loadBlockWrapper, saveBlockWrapper } from "@/shared/wasm/biomes";
import { z } from "zod";
import { readHarthmerePlayerAndSharedStateStrings } from "@/server/harthmere/live_mode_state_read_helpers";
import {
  resolveHarthmereLiveModeActorContext,
  type HarthmereLiveModeActorStateAdoption,
} from "@/server/harthmere/live_mode_actor_resolution";
import { shouldAdoptHarthmereInstallOrphan } from "@/shared/harthmere/live_mode_actor_identity";

const HARTHMERE_LIVE_MODE_SERVER_ROUTE =
  "HARTHMERE_LIVE_MODE_SERVER_ROUTE" as const;
const HARTHMERE_WORLD_MATERIALIZER_USER_ID = 8810000000099191 as BiomesId;
const HARTHMERE_WORLD_MATERIALIZER_USERNAME = "HarthmereWorldMaterializer";
export const HARTHMERE_BUILDING_MATERIALIZATION_ECS_PUBLISH_CHUNK_SIZE = 1000;

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

function liveModeIdempotencyKey(actorId: string, idempotencyKey: string) {
  return `harthmere:live_mode:current:idempotency:${actorId}:${idempotencyKey}`;
}

function slimHarthmereLiveModeIdempotencyResponse(
  response: LiveModeResponse
): LiveModeResponse {
  const slim: LiveModeResponse = {
    ...response,
    snapshotMode: "changed",
    includedSnapshots: [],
    invalidatedSnapshots: [...HARTHMERE_LIVE_MODE_MUTATION_SNAPSHOT_KEYS],
  };
  for (const field of HARTHMERE_LIVE_MODE_RESPONSE_SNAPSHOT_FIELDS) {
    delete slim[field];
  }
  return slim;
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
  serverTargetPosition?: { x: number; y: number; z: number }
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
  try {
    const entity = await worldApi.get(userId);
    const position = entity?.position()?.v;
    if (!Array.isArray(position) || position.length < 3) return undefined;
    const [x, y, z] = position.map(Number);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return undefined;
    }
    return { x, y, z };
  } catch {
    return undefined;
  }
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
    body.actionKind !== "request_ability_cast"
  ) {
    return undefined;
  }
  if (body.subsystem !== "combat" && body.subsystem !== "ability") {
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
    Array<{ position: Vec3; value: number; shiftedOutpost: boolean }>
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
      shardEdits.push({ position, value: edit.value, shiftedOutpost });
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
    try {
      loadBlockWrapper(voxeloo, seed, terrainEntity.shardSeed());
      loadBlockWrapper(voxeloo, diff, terrainEntity.shardDiff());
      for (const edit of shardEdits) {
        const localPosition = blockPos(...edit.position);
        if (edit.value === 0) {
          if (seed.get(...localPosition) === 0) {
            diff.del(...localPosition);
          } else {
            diff.set(...localPosition, 0);
          }
        } else {
          diff.set(...localPosition, edit.value);
        }
      }
      terrainEntity.mutableShardDiff().buffer = saveBlockWrapper(
        voxeloo,
        diff
      ).buffer;
      directTerrainShardCount += 1;
    } finally {
      seed.delete();
      diff.delete();
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
  const defaultState = defaultHarthmereLiveModeBackendState(
    actorId,
    0
  );
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

export async function persistHarthmereLiveModeResponse(
  envelope: HarthmereLiveModeAuthorityEnvelope,
  response: LiveModeResponse,
  deps: {
    askApi?: Pick<AskApi, "scanForExport">;
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
  const stateAdoption = normalizeHarthmereLiveModeActorStateAdoption({
    actorId: response.actorId,
    playerStateKey,
    stateAdoption: deps.stateAdoption,
  });
  const adoptionSourceStateKey = stateAdoption?.fromStateKey;
  const supportsWatch = typeof (redis.primary as any).watch === "function";
  if (!supportsWatch) {
    throw new Error(
      "Harthmere live-mode Redis client must support WATCH for transactional persistence"
    );
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const attemptTimings: Record<string, number> = {};
    const mark = (stage: string, startedAt: number) => {
      attemptTimings[stage] = Date.now() - startedAt;
    };
    lastAttemptTimings = attemptTimings;
    let stageStartedAt = Date.now();
    const previous = await redis.primary.get(key);
    mark("idempotency_get_ms", stageStartedAt);
    if (previous) {
      return {
        ...(JSON.parse(previous) as LiveModeResponse),
        duplicate: true,
        replayed: true,
      };
    }

    const watchKeys = uniqueHarthmereLiveModeWatchKeys([
      key,
      playerStateKey,
      sharedWorldStateKey,
      adoptionSourceStateKey,
    ]);
    const now = Date.now();
    if (supportsWatch) {
      stageStartedAt = Date.now();
      await (redis.primary as any).watch(...watchKeys);
      mark("watch_ms", stageStartedAt);
    }

    stageStartedAt = Date.now();
    const watchedPrevious = await redis.primary.get(key);
    mark("watched_idempotency_get_ms", stageStartedAt);
    if (watchedPrevious) {
      await redisUnwatchIfSupported(redis.primary);
      return {
        ...(JSON.parse(watchedPrevious) as LiveModeResponse),
        duplicate: true,
        replayed: true,
      };
    }

    stageStartedAt = Date.now();
    let { rawState, rawSharedState } =
      await readHarthmerePlayerAndSharedStateStrings(
        redis.primary,
        playerStateKey,
        sharedWorldStateKey
      );
    let rawAdoptionSourceState = adoptionSourceStateKey
      ? await redis.primary.get(adoptionSourceStateKey)
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

    if (sellerStateKey && supportsWatch) {
      await redisUnwatchIfSupported(redis.primary);
      await (redis.primary as any).watch(
        ...uniqueHarthmereLiveModeWatchKeys([
          key,
          playerStateKey,
          sharedWorldStateKey,
          adoptionSourceStateKey,
          sellerStateKey,
        ])
      );
      const secondPrevious = await redis.primary.get(key);
      if (secondPrevious) {
        await redisUnwatchIfSupported(redis.primary);
        return {
          ...(JSON.parse(secondPrevious) as LiveModeResponse),
          duplicate: true,
          replayed: true,
        };
      }
      stageStartedAt = Date.now();
      ({ rawState, rawSharedState } =
        await readHarthmerePlayerAndSharedStateStrings(
          redis.primary,
          playerStateKey,
          sharedWorldStateKey
        ));
      rawAdoptionSourceState = adoptionSourceStateKey
        ? await redis.primary.get(adoptionSourceStateKey)
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
    }

    let sellerState:
      | ReturnType<typeof parseHarthmereLiveModeBackendState>
      | undefined;
    if (settlement && sellerStateKey) {
      stageStartedAt = Date.now();
      const rawSellerState = await redis.primary.get(sellerStateKey);
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
      persistedResponse.questState = createHarthmereLiveModeQuestClientSnapshot(
        reduced.state
      );
    }
    mark("snapshots_ms", stageStartedAt);

    stageStartedAt = Date.now();
    const tx = redis.primary.multi();
    tx.set(playerStateKey, JSON.stringify(reduced.state));
    tx.set(
      sharedWorldStateKey,
      JSON.stringify(
        createHarthmereLiveModeSharedWorldState(reduced.state, now)
      )
    );
    if (adoptedActorState && adoptionSourceStateKey) {
      (tx as { del?: (key: string) => unknown }).del?.(adoptionSourceStateKey);
    }
    if (sellerStateKey && sellerState) {
      tx.set(sellerStateKey, JSON.stringify(sellerState));
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
        persistedResponse.backendMutation?.warnings.push(
          `building_materialized:edit_events:${materializationCounts.editEventCount}:place_group_events:${materializationCounts.placeGroupEventCount}:publish_batches:${materializationCounts.publishBatchCount}`
        );
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
      await redis.primary.set(
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
          const materialized = await materializeHarthmereEscortCompanionsToEcs({
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
      await redis.primary.set(
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
        timings: attemptTimings,
        includedSnapshots,
        eventCount: persistedResponse.events.length,
        uiEventCount: persistedResponse.uiEvents.length,
      });
    }
    void flushHarthmereLiveModePostCommitOutbox(persistedResponse);
    return persistedResponse;
  }

  log.warn("HARTHMERE_LIVE_MODE_PERSIST_CONFLICTED", {
    requestId: envelope.requestId,
    actorId: response.actorId,
    actionKind: envelope.actionKind,
    subsystem: envelope.subsystem,
    persistMs: Date.now() - persistStartedAt,
    timings: lastAttemptTimings,
  });
  throw new Error(
    "Harthmere live-mode Redis transaction conflicted too many times"
  );
}

export default biomesApiHandler(
  {
    auth: "optional",
    body: zLiveModeRequest,
    response: zLiveModeResponse,
  },
  async ({
    context: { askApi, logicApi, worldApi },
    auth,
    body,
    unsafeRequest,
  }) => {
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
    // Heal the install/user split on writes too: converge an install-only write
    // onto the linked user key and record the install->user link on the first
    // authed write, so actions never strand progress under a second key.
    const actorContext = await resolveHarthmereLiveModeActorContext(
      await liveModeRedis(),
      { auth, unsafeRequest },
      actorIdentity.actorId
    );
    const actorId = actorContext.actorId;
    const serverActorPosition =
      actorIdentity.userId !== undefined
        ? await readServerActorPositionForLiveMode(
            worldApi,
            actorIdentity.userId
          )
        : combatActorPositionFromInstallLiveModeBody(body) ??
          jobsBoardPositionFromLiveModeBody(body);
    const serverTargetPosition = await readServerTargetPositionForQuestInvite(
      worldApi,
      body
    );
    const envelope =
      wire_network_requests_to_validateHarthmereLiveModeAuthorityEnvelope(
        actorId,
        body,
        serverActorPosition,
        serverTargetPosition
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
        logicApi,
        worldApi,
        userId: actorIdentity.userId,
        stateAdoption: actorContext.stateAdoption,
      }
    );
  }
);
