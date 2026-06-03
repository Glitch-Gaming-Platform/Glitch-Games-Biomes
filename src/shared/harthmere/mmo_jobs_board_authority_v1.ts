/*
 * mmo_jobs_board_authority_v1.ts
 *
 * Server-authoritative universal jobs board for Harthmere.
 * There are two physical notice boards: one in the Grove and one in Harthmere's
 * market district. Posting, accepting, cancelling, and turning in jobs require
 * the actor to be at the target board; accepted jobs become quest-board todos /
 * map-marker records for seekers. Runtime state starts empty: the board registry
 * is static world configuration, not dummy job data.
 */

import type {
  HarthmereEconomyBusinessRecordV1,
  HarthmereEconomyBusinessTypeIdV1,
  HarthmereProductionEconomyStateV1,
} from "./mmo_economy_authority_v1";
import {
  HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES_V146,
  harthmereJobsBoardBusinessTemplateByIdV146,
  isKnownHarthmereJobsBoardExecutableItemIdV146,
} from "./jobs_board_business_templates_v146";
import { HARTHMERE_COLLECTIBLE_DEFINITIONS_V1 } from "./mmo_class_ability_collectibles_v1";
import {
  HARTHMERE_BUSINESS_OUTPOSTS_V1,
  harthmereBusinessOutpostJobsBoardPositionV1,
  type HarthmereBusinessOutpostV1,
} from "./business_customer_simulator_v1";
import { HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1 } from "./exotic_matter_caves_v1";
import {
  HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_MARKER_ID_V1,
  HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_TARGET_ID_V1,
  HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID_V1,
  HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID_V1,
  HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_MARKER_ID_V1,
  HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_TARGET_ID_V1,
} from "./jobs_board_muck_bounty_targets_v1";

export const HARTHMERE_JOBS_BOARD_AUTHORITY_VERSION_V1 = "harthmere-jobs-board-authority-v1" as const;
export const HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1 = "harthmere_grove_market_jobs_board" as const;
export const HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_VOXEL_V1 = "public/assets/harthmere/vox/props/itch_voxel_asset_pack/Blacksmith Sign.vox" as const;
export const HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_MARKER_ID_V1 = "harthmere_market_posting_board" as const;
// HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN_V141:
// Second physical board located in Harthmere's market district. Lives near
// the Harthmere Market Office landmark and uses the same voxel kiosk asset
// as the Grove board. Jobs posted at this board are scoped to the Harthmere
// town/region so towns/guilds/NPCs based in Harthmere have a board to use.
export const HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141 = "harthmere_town_market_jobs_board" as const;
export const HARTHMERE_JOBS_BOARD_HARTHMERE_MARKER_ID_V141 = "harthmere_town_market_posting_board" as const;
export const HARTHMERE_JOBS_BOARD_HARTHMERE_DISPLAY_NAME_V141 = "Harthmere Town Jobs Board" as const;
export const HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145 = 3.25;
export const HARTHMERE_JOBS_BOARD_MAX_ACTIVE_POSTINGS_PER_ISSUER_V1 = 12;
export const HARTHMERE_JOBS_BOARD_MAX_ACTIVE_ACCEPTED_PER_SEEKER_V1 = 6;
export const HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD_V1 = 5;
export const HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD_V1 = 5000;
export const HARTHMERE_JOBS_BOARD_MAX_DURATION_MS_V1 = 30 * 24 * 60 * 60 * 1000;
export const HARTHMERE_JOBS_BOARD_POST_COOLDOWN_MS_V1 = 10 * 1000;
export const HARTHMERE_JOBS_BOARD_ACCEPT_COOLDOWN_MS_V1 = 3 * 1000;
export const HARTHMERE_JOBS_BOARD_MAX_LOGS_V1 = 300;
export const HARTHMERE_JOBS_BOARD_BUSINESS_AUTO_SEED_MAX_PER_TICK_V1 = 4;

export type HarthmereJobsBoardIssuerKindV1 = "player" | "business" | "guild" | "town" | "npc";
export type HarthmereJobsBoardJobKindV1 =
  | "gather"
  | "delivery"
  | "repair"
  | "cleanup"
  | "hunt"
  | "escort"
  | "craft"
  | "medical"
  | "exploration"
  | "construction"
  | "security"
  | "service";
export type HarthmereJobsBoardPostingStatusV1 = "open" | "active" | "completed" | "failed" | "cancelled" | "expired";

export interface HarthmereJobsBoardLocationV1 {
  x: number;
  y: number;
  z: number;
  radius: number;
  district: string;
  landmarkId: string;
  voxelAssetHint?: string;
}

export interface HarthmereJobsBoardRecordV1 {
  boardId: string;
  displayName: string;
  townId: string;
  regionId: string;
  markerId: string;
  location: HarthmereJobsBoardLocationV1;
  acceptedKinds: HarthmereJobsBoardJobKindV1[];
  requiresPhysicalInteraction: true;
  createdAtMs: number;
}

export interface HarthmereJobsBoardRequirementV1 {
  itemId?: string;
  count?: number;
  serviceKind?: string;
  serviceUnits?: number;
  targetId?: string;
  targetName?: string;
  mapMarkerId?: string;
}

export interface HarthmereJobsBoardRewardItemV146 {
  itemId: string;
  count: number;
}

export interface HarthmereJobsBoardPostingV1 {
  jobId: string;
  boardId: string;
  issuerKind: HarthmereJobsBoardIssuerKindV1;
  issuerId: string;
  issuerBusinessType?: HarthmereEconomyBusinessTypeIdV1;
  title: string;
  description: string;
  kind: HarthmereJobsBoardJobKindV1;
  requirements: HarthmereJobsBoardRequirementV1[];
  templateId?: string;
  rewardGold: number;
  escrowGold: number;
  rewardItems?: HarthmereJobsBoardRewardItemV146[];
  escrowItems?: Record<string, number>;
  rewardCollectibleIds?: string[];
  reputationDelta: number;
  status: HarthmereJobsBoardPostingStatusV1;
  townId: string;
  regionId: string;
  createdAtMs: number;
  deadlineAtMs: number;
  acceptedAtMs?: number;
  acceptedByActorId?: string;
  completedAtMs?: number;
  cancelledAtMs?: number;
  failurePenaltyGold: number;
  requiresFieldWork: boolean;
  mapMarkerId?: string;
  targetId?: string;
  abuseFlags: string[];
  logs: string[];
  // HARTHMERE_JOBS_BOARD_AUTO_POSTING_V141:
  // Optional metadata attached by the economy auto-seeder. These never affect
  // existing player-posted jobs and stay undefined for them. Monster-hunt
  // postings always set these so clients can flag party-required combat
  // jobs in the UI.
  autoPosted?: boolean;
  source?: "economy_auto_seed";
  partyRecommended?: boolean;
  partyMinSize?: number;
  monsterId?: "mucker" | "hex" | string;
  monsterTier?: "normal" | "strong" | "elite" | "boss";
  monsterPowerLevel?: number;
  lootHint?: string[];
}

export interface HarthmereJobsBoardTodoV1 {
  todoId: string;
  jobId: string;
  actorId: string;
  boardId: string;
  title: string;
  todoText: string;
  status: "active" | "completed" | "failed" | "cancelled" | "expired";
  kind: HarthmereJobsBoardJobKindV1;
  mapMarkerId?: string;
  targetId?: string;
  townId: string;
  regionId: string;
  createdAtMs: number;
  dueAtMs: number;
  questBoardTodo: true;
}

export interface HarthmereJobsBoardAuditEntryV1 {
  id: string;
  atMs: number;
  actorId: string;
  kind: string;
  jobId?: string;
  boardId?: string;
  issuerKind?: HarthmereJobsBoardIssuerKindV1;
  issuerId?: string;
  amountGold?: number;
  reason?: string;
}

export interface HarthmereJobsBoardStateV1 {
  version: typeof HARTHMERE_JOBS_BOARD_AUTHORITY_VERSION_V1;
  boards: Record<string, HarthmereJobsBoardRecordV1>;
  postings: Record<string, HarthmereJobsBoardPostingV1>;
  todos: Record<string, HarthmereJobsBoardTodoV1>;
  actorAcceptedJobIds: Record<string, string[]>;
  issuerOpenJobIds: Record<string, string[]>;
  actorCooldowns: Record<string, { lastPostAtMs?: number; lastAcceptAtMs?: number; abuseScore: number }>;
  audit: HarthmereJobsBoardAuditEntryV1[];
  nextJobNumber: number;
  nextTodoNumber: number;
}

export interface HarthmereJobsBoardMutationRequestV1 {
  requestId: string;
  actorId: string;
  nowMs: number;
  operation: string;
  boardId?: string;
  jobId?: string;
  issuerKind?: HarthmereJobsBoardIssuerKindV1;
  issuerId?: string;
  businessId?: string;
  title?: string;
  description?: string;
  kind?: HarthmereJobsBoardJobKindV1;
  requirements?: HarthmereJobsBoardRequirementV1[];
  templateId?: string;
  rewardGold?: number;
  rewardItems?: HarthmereJobsBoardRewardItemV146[];
  rewardCollectibleIds?: string[];
  deadlineAtMs?: number;
  townId?: string;
  regionId?: string;
  mapMarkerId?: string;
  targetId?: string;
  requiresFieldWork?: boolean;
  completionItemDeltas?: Record<string, number>;
  completionNote?: string;
  questTodoId?: string;
  completedTargetId?: string;
}

export interface HarthmereJobsBoardMutationContextV1 {
  actorGold: number;
  actorInventoryItems: Record<string, number>;
  actorCollectibles?: Record<string, number>;
  actorGuildId?: string;
  actorTownIds?: string[];
  nearbyBoardId?: string;
  actorPosition?: { x: number; y: number; z: number };
  economy?: HarthmereProductionEconomyStateV1;
  allowNpcJobPosting?: boolean;
  canManageGuildJobs?: (guildId: string) => boolean;
  canManageTownJobs?: (townId: string) => boolean;
  canManageBusinessJobs?: (business: HarthmereEconomyBusinessRecordV1) => boolean;
}

export interface HarthmereJobsBoardMutationResultV1 {
  jobsBoard: HarthmereJobsBoardStateV1;
  inventoryGoldDelta: number;
  inventoryItemDeltas: Record<string, number>;
  collectibleRewardIds: string[];
  economy?: HarthmereProductionEconomyStateV1;
  warnings: string[];
  touchedModels: string[];
  sharedStateKeys: string[];
}

type MutableJobsResult = {
  next: HarthmereJobsBoardStateV1;
  economy?: HarthmereProductionEconomyStateV1;
  goldDelta: number;
  itemDeltas: Record<string, number>;
  collectibleRewardIds: string[];
  warnings: string[];
  touched: Set<string>;
  shared: Set<string>;
};

const HARTHMERE_BUSINESS_OUTPOST_JOB_KIND_BY_TYPE_V1: Record<HarthmereEconomyBusinessTypeIdV1, HarthmereJobsBoardJobKindV1> = {
  exotic_matter_refinery: "craft",
  biome_maintenance_repair: "repair",
  biome_design_studio: "service",
  security_defense_contractor: "security",
  portal_transit_company: "delivery",
  biome_farming_rare_foods: "gather",
  weapons_tools: "craft",
  magic_goods: "craft",
  exploration_guide: "exploration",
  custom_home_property_development: "construction",
  general_trader: "delivery",
  hunter_wild_meat: "hunt",
  medical_doctor: "medical",
  teleport_owner: "delivery",
  waste_sanitation_cleanup: "cleanup",
  repair_maintenance_person: "repair",
  food_service_restaurant: "service",
  courier: "delivery",
  hospitality_inn_hotel_shelter: "service",
};

function harthmereBusinessOutpostJobsBoardIdV1(outpost: HarthmereBusinessOutpostV1) {
  return `${outpost.outpostId}_jobs_board`;
}

function harthmereBusinessOutpostJobMarkerIdV1(outpost: HarthmereBusinessOutpostV1) {
  return `${outpost.outpostId}_job_board`;
}

const HARTHMERE_BUSINESS_OUTPOST_JOB_BOARD_LOCATIONS_V1: Record<string, HarthmereJobsBoardRecordV1> = Object.fromEntries(
  HARTHMERE_BUSINESS_OUTPOSTS_V1.map((outpost) => {
    const boardId = harthmereBusinessOutpostJobsBoardIdV1(outpost);
    const markerId = harthmereBusinessOutpostJobMarkerIdV1(outpost);
    const kind = HARTHMERE_BUSINESS_OUTPOST_JOB_KIND_BY_TYPE_V1[outpost.businessType];
    const position = harthmereBusinessOutpostJobsBoardPositionV1(outpost);
    return [boardId, {
      boardId,
      displayName: `${outpost.displayName} Jobs Board`,
      townId: outpost.townId,
      regionId: outpost.regionId,
      markerId,
      location: {
        x: position.x,
        y: position.y,
        z: position.z,
        radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
        district: outpost.district,
        landmarkId: markerId,
        voxelAssetHint: "procedural_business_outpost_jobs_board",
      },
      acceptedKinds: [kind],
      requiresPhysicalInteraction: true,
      createdAtMs: 0,
    } satisfies HarthmereJobsBoardRecordV1];
  }),
);

function businessOutpostForJobsBoardIdV1(boardId: string) {
  return HARTHMERE_BUSINESS_OUTPOSTS_V1.find((outpost) => harthmereBusinessOutpostJobsBoardIdV1(outpost) === boardId);
}

export const HARTHMERE_JOBS_BOARD_LOCATIONS_V1: Record<string, HarthmereJobsBoardRecordV1> = {
  [HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1]: {
    boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
    displayName: "Jobs Board",
    townId: "harthmere_grove",
    regionId: "harthmere_grove_region",
    markerId: HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_MARKER_ID_V1,
    location: {
      // HARTHMERE_JOBS_BOARD_GROVE_RELOCATION_V143: snapped to the player's
      // reported feet position so the kiosk renders exactly where the pin says.
      x: 501.99486179104775,
      y: 70,
      z: -132.00350672753194,
      radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
      district: "The Grove",
      landmarkId: HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_MARKER_ID_V1,
      voxelAssetHint: HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_VOXEL_V1,
    },
    acceptedKinds: ["gather", "delivery", "repair", "cleanup", "hunt", "escort", "craft", "medical", "exploration", "construction", "security", "service"],
    requiresPhysicalInteraction: true,
    createdAtMs: 0,
  },
  // HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN_V141:
  // Harthmere town market district board. Sits east of the Grove (around
  // x ≈ 1046, z ≈ -202) next to the Harthmere Market Office landmark, and
  // is townId-scoped to `harthmere_town` so its postings stay distinct from
  // the Grove board in the live snapshot.
  [HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141]: {
    boardId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141,
    displayName: HARTHMERE_JOBS_BOARD_HARTHMERE_DISPLAY_NAME_V141,
    townId: "harthmere_town",
    regionId: "harthmere_town_region",
    markerId: HARTHMERE_JOBS_BOARD_HARTHMERE_MARKER_ID_V141,
    location: {
      x: 1046,
      y: 65,
      z: -202,
      radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
      district: "Harthmere Market District",
      landmarkId: HARTHMERE_JOBS_BOARD_HARTHMERE_MARKER_ID_V141,
      voxelAssetHint: HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_VOXEL_V1,
    },
    acceptedKinds: ["gather", "delivery", "repair", "cleanup", "hunt", "escort", "craft", "medical", "exploration", "construction", "security", "service"],
    requiresPhysicalInteraction: true,
    createdAtMs: 0,
  },
  ...HARTHMERE_BUSINESS_OUTPOST_JOB_BOARD_LOCATIONS_V1,
};

export function defaultHarthmereJobsBoardStateV1(nowMs = 0): HarthmereJobsBoardStateV1 {
  const boards = JSON.parse(JSON.stringify(HARTHMERE_JOBS_BOARD_LOCATIONS_V1)) as Record<string, HarthmereJobsBoardRecordV1>;
  for (const board of Object.values(boards)) board.createdAtMs = nowMs;
  return {
    version: HARTHMERE_JOBS_BOARD_AUTHORITY_VERSION_V1,
    boards,
    postings: {},
    todos: {},
    actorAcceptedJobIds: {},
    issuerOpenJobIds: {},
    actorCooldowns: {},
    audit: [],
    nextJobNumber: 1,
    nextTodoNumber: 1,
  };
}

export function normalizeHarthmereJobsBoardStateV1(raw: unknown, nowMs = 0): HarthmereJobsBoardStateV1 {
  const defaults = defaultHarthmereJobsBoardStateV1(nowMs);
  const value = raw && typeof raw === "object" ? raw as Partial<HarthmereJobsBoardStateV1> : {};
  return {
    ...defaults,
    ...value,
    version: HARTHMERE_JOBS_BOARD_AUTHORITY_VERSION_V1,
    boards: { ...defaults.boards, ...(value.boards ?? {}) },
    postings: { ...(value.postings ?? {}) },
    todos: { ...(value.todos ?? {}) },
    actorAcceptedJobIds: { ...(value.actorAcceptedJobIds ?? {}) },
    issuerOpenJobIds: { ...(value.issuerOpenJobIds ?? {}) },
    actorCooldowns: { ...(value.actorCooldowns ?? {}) },
    audit: Array.isArray(value.audit) ? value.audit.slice(-HARTHMERE_JOBS_BOARD_MAX_LOGS_V1) : [],
    nextJobNumber: Math.max(1, Math.trunc(Number(value.nextJobNumber) || 1)),
    nextTodoNumber: Math.max(1, Math.trunc(Number(value.nextTodoNumber) || 1)),
  };
}

function cloneJobsState(state: HarthmereJobsBoardStateV1) {
  return normalizeHarthmereJobsBoardStateV1(JSON.parse(JSON.stringify(state)));
}

function makeResult(state: HarthmereJobsBoardStateV1, context: HarthmereJobsBoardMutationContextV1): MutableJobsResult {
  return {
    next: cloneJobsState(state),
    economy: context.economy ? JSON.parse(JSON.stringify(context.economy)) : undefined,
    goldDelta: 0,
    itemDeltas: {},
    collectibleRewardIds: [],
    warnings: [],
    touched: new Set(),
    shared: new Set(),
  };
}

function reject(result: MutableJobsResult, warning: string) {
  result.warnings.push(warning);
  result.touched.add("jobs_board_rejection");
}

function pushAudit(result: MutableJobsResult, request: HarthmereJobsBoardMutationRequestV1, entry: Omit<HarthmereJobsBoardAuditEntryV1, "atMs" | "actorId">) {
  result.next.audit.push({ atMs: request.nowMs, actorId: request.actorId, ...entry });
  result.next.audit = result.next.audit.slice(-HARTHMERE_JOBS_BOARD_MAX_LOGS_V1);
}

function issuerKey(kind: HarthmereJobsBoardIssuerKindV1, id: string) {
  return `${kind}:${id}`;
}

function sharedBoardKey(boardId: string) { return `harthmere:jobs_board:${boardId}`; }
function sharedJobKey(jobId: string) { return `harthmere:jobs_board:job:${jobId}`; }
function sharedTodoKey(todoId: string) { return `harthmere:jobs_board:todo:${todoId}`; }

function positiveInt(value: unknown, fallback = 0) {
  return Math.max(0, Math.trunc(Number(value) || fallback));
}

function recordItemDelta(target: Record<string, number>, itemId: string, delta: number) {
  const next = (target[itemId] ?? 0) + Math.trunc(delta);
  if (next === 0) delete target[itemId];
  else target[itemId] = next;
}

function distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

export function isActorAtHarthmereJobsBoardV1(
  state: HarthmereJobsBoardStateV1,
  context: Pick<HarthmereJobsBoardMutationContextV1, "nearbyBoardId" | "actorPosition">,
  boardId: string = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
) {
  const board = state.boards[boardId];
  if (!board) return false;
  if (context.nearbyBoardId === boardId) return true;
  if (!context.actorPosition) return false;
  return distance(context.actorPosition, board.location) <= board.location.radius;
}

function requireBoard(result: MutableJobsResult, request: HarthmereJobsBoardMutationRequestV1, context: HarthmereJobsBoardMutationContextV1) {
  const boardId = request.boardId ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1;
  const board = result.next.boards[boardId];
  if (!board) {
    reject(result, "jobs_board_rejected:board_not_found");
    return undefined;
  }
  if (!isActorAtHarthmereJobsBoardV1(result.next, context, boardId)) {
    reject(result, "jobs_board_rejected:must_be_at_jobs_board");
    return undefined;
  }
  return board;
}

function sanitizeText(value: unknown, fallback: string, max: number) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return (text || fallback).slice(0, max);
}

function hasSuspiciousText(text: string) {
  const lowered = text.toLowerCase();
  return /https?:\/\/|discord\.gg|free\s+gold|dupe|exploit|admin\s+password/.test(lowered);
}

function normalizeRequirements(requirements: HarthmereJobsBoardRequirementV1[] | undefined) {
  const out: HarthmereJobsBoardRequirementV1[] = [];
  for (const req of requirements ?? []) {
    const itemId = typeof req.itemId === "string" && req.itemId.trim() ? req.itemId.trim().slice(0, 80) : undefined;
    const serviceKind = typeof req.serviceKind === "string" && req.serviceKind.trim() ? req.serviceKind.trim().slice(0, 80) : undefined;
    const targetId = typeof req.targetId === "string" && req.targetId.trim() ? req.targetId.trim().slice(0, 120) : undefined;
    const targetName = typeof req.targetName === "string" && req.targetName.trim() ? req.targetName.trim().slice(0, 120) : undefined;
    const mapMarkerId = typeof req.mapMarkerId === "string" && req.mapMarkerId.trim() ? req.mapMarkerId.trim().slice(0, 120) : undefined;
    const count = req.count === undefined ? undefined : positiveInt(req.count, 1);
    const serviceUnits = req.serviceUnits === undefined ? undefined : positiveInt(req.serviceUnits, 1);
    if (!itemId && !serviceKind && !targetId) continue;
    out.push({ itemId, count, serviceKind, serviceUnits, targetId, targetName, mapMarkerId });
  }
  return out.slice(0, 8);
}

function normalizeRewardItems(rewardItems: HarthmereJobsBoardRewardItemV146[] | undefined) {
  const out: Record<string, number> = {};
  for (const reward of rewardItems ?? []) {
    const itemId = typeof reward.itemId === "string" ? reward.itemId.trim().slice(0, 80) : "";
    if (!itemId || !isKnownHarthmereJobsBoardExecutableItemIdV146(itemId)) continue;
    const count = positiveInt(reward.count, 1);
    if (count <= 0) continue;
    out[itemId] = (out[itemId] ?? 0) + count;
  }
  return Object.entries(out).slice(0, 5).map(([itemId, count]) => ({ itemId, count }));
}

function normalizeRewardCollectibleIds(rewardCollectibleIds: string[] | undefined) {
  return Array.from(new Set((rewardCollectibleIds ?? [])
    .map((id) => typeof id === "string" ? id.trim().slice(0, 120) : "")
    .filter((id) => id && HARTHMERE_COLLECTIBLE_DEFINITIONS_V1[id])))
    .slice(0, 3);
}

function itemRewardsToRecord(rewardItems: HarthmereJobsBoardRewardItemV146[] | undefined) {
  const record: Record<string, number> = {};
  for (const reward of rewardItems ?? []) {
    if (reward.count > 0) record[reward.itemId] = (record[reward.itemId] ?? 0) + reward.count;
  }
  return record;
}

function applyBusinessTemplateDefaults(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequestV1,
  issuerBusinessType: HarthmereEconomyBusinessTypeIdV1 | undefined,
) {
  const template = harthmereJobsBoardBusinessTemplateByIdV146(request.templateId);
  if (!request.templateId) return undefined;
  if (!template) {
    reject(result, "jobs_board_rejected:unknown_business_job_template");
    return undefined;
  }
  if (issuerBusinessType && template.businessType !== issuerBusinessType) {
    reject(result, "jobs_board_rejected:template_business_type_mismatch");
    return undefined;
  }
  return template;
}

function validateIssuer(result: MutableJobsResult, request: HarthmereJobsBoardMutationRequestV1, context: HarthmereJobsBoardMutationContextV1) {
  const issuerKind = request.issuerKind ?? (request.businessId ? "business" : "player");
  let issuerId = request.issuerId ?? request.actorId;
  let issuerBusinessType: HarthmereEconomyBusinessTypeIdV1 | undefined;
  if (issuerKind === "player") {
    if (issuerId !== request.actorId) {
      reject(result, "jobs_board_rejected:player_issuer_mismatch");
      return undefined;
    }
    return { issuerKind, issuerId, issuerBusinessType };
  }
  if (issuerKind === "business") {
    issuerId = request.businessId ?? issuerId;
    const business = context.economy?.businesses?.[issuerId];
    if (!business) {
      reject(result, "jobs_board_rejected:business_not_found");
      return undefined;
    }
    const canManage = business.ownerKind === "player" && business.ownerId === request.actorId || context.canManageBusinessJobs?.(business) === true;
    if (!canManage) {
      reject(result, "jobs_board_rejected:business_job_permission_required");
      return undefined;
    }
    issuerBusinessType = business.typeId;
    return { issuerKind, issuerId, issuerBusinessType };
  }
  if (issuerKind === "guild") {
    if (!issuerId || context.canManageGuildJobs?.(issuerId) !== true) {
      reject(result, "jobs_board_rejected:guild_job_permission_required");
      return undefined;
    }
    return { issuerKind, issuerId, issuerBusinessType };
  }
  if (issuerKind === "town") {
    if (!issuerId || context.canManageTownJobs?.(issuerId) !== true) {
      reject(result, "jobs_board_rejected:town_job_permission_required");
      return undefined;
    }
    return { issuerKind, issuerId, issuerBusinessType };
  }
  if (issuerKind === "npc") {
    if (context.allowNpcJobPosting !== true) {
      reject(result, "jobs_board_rejected:npc_job_permission_required");
      return undefined;
    }
    return { issuerKind, issuerId, issuerBusinessType };
  }
  reject(result, "jobs_board_rejected:invalid_issuer");
  return undefined;
}

function chargeEscrow(result: MutableJobsResult, request: HarthmereJobsBoardMutationRequestV1, context: HarthmereJobsBoardMutationContextV1, issuerKind: HarthmereJobsBoardIssuerKindV1, issuerId: string, rewardGold: number, rewardItems: HarthmereJobsBoardRewardItemV146[], rewardCollectibleIds: string[]) {
  if (issuerKind === "player") {
    if (context.actorGold + result.goldDelta < rewardGold) return reject(result, "jobs_board_rejected:escrow_gold_required");
    for (const reward of rewardItems) {
      if ((context.actorInventoryItems[reward.itemId] ?? 0) + (result.itemDeltas[reward.itemId] ?? 0) < reward.count) {
        return reject(result, `jobs_board_rejected:escrow_item_required:${reward.itemId}`);
      }
    }
    for (const collectibleId of rewardCollectibleIds) {
      if (!context.actorCollectibles?.[collectibleId]) {
        return reject(result, `jobs_board_rejected:escrow_collectible_required:${collectibleId}`);
      }
    }
    result.goldDelta -= rewardGold;
    for (const reward of rewardItems) recordItemDelta(result.itemDeltas, reward.itemId, -reward.count);
    return;
  }
  if (issuerKind === "business") {
    const business = result.economy?.businesses?.[issuerId];
    if (!business || business.balanceGold < rewardGold) return reject(result, "jobs_board_rejected:business_escrow_gold_required");
    for (const reward of rewardItems) {
      const stack = business.inventory[reward.itemId];
      if (!stack || stack.count < reward.count) {
        return reject(result, `jobs_board_rejected:business_escrow_item_required:${reward.itemId}`);
      }
    }
    business.balanceGold -= rewardGold;
    for (const reward of rewardItems) {
      const stack = business.inventory[reward.itemId];
      if (!stack) continue;
      stack.count -= reward.count;
      if (stack.count <= 0) delete business.inventory[reward.itemId];
    }
    result.touched.add("economy_business_bank");
    if (rewardItems.length > 0) result.touched.add("economy_business_inventory");
    result.shared.add(`harthmere:economy:business:${business.businessId}`);
    return;
  }
  // Guild/town/NPC postings can be backed by their own treasury systems later. For now
  // they are only allowed through explicit permission callbacks and are audit logged.
}

function refundEscrow(result: MutableJobsResult, job: HarthmereJobsBoardPostingV1, request: HarthmereJobsBoardMutationRequestV1) {
  const escrowItems = job.escrowItems ?? itemRewardsToRecord(job.rewardItems);
  if (job.issuerKind === "player" && job.issuerId === request.actorId) {
    if (job.escrowGold > 0) result.goldDelta += job.escrowGold;
    for (const [itemId, count] of Object.entries(escrowItems)) recordItemDelta(result.itemDeltas, itemId, count);
  }
  if (job.issuerKind === "business") {
    const business = result.economy?.businesses?.[job.issuerId];
    if (business) {
      if (job.escrowGold > 0) business.balanceGold += job.escrowGold;
      for (const [itemId, count] of Object.entries(escrowItems)) {
        business.inventory[itemId] = {
          itemId,
          count: (business.inventory[itemId]?.count ?? 0) + count,
        };
      }
    }
    result.touched.add("economy_business_bank");
    if (Object.keys(escrowItems).length > 0) result.touched.add("economy_business_inventory");
  }
  job.escrowGold = 0;
  job.escrowItems = {};
}

function openJobIdsForIssuer(state: HarthmereJobsBoardStateV1, kind: HarthmereJobsBoardIssuerKindV1, id: string) {
  return Object.values(state.postings).filter((job) => job.issuerKind === kind && job.issuerId === id && (job.status === "open" || job.status === "active")).map((job) => job.jobId);
}

function activeJobIdsForActor(state: HarthmereJobsBoardStateV1, actorId: string) {
  return Object.values(state.postings).filter((job) => job.acceptedByActorId === actorId && job.status === "active").map((job) => job.jobId);
}

function createJobPosting(result: MutableJobsResult, request: HarthmereJobsBoardMutationRequestV1, context: HarthmereJobsBoardMutationContextV1) {
  const board = requireBoard(result, request, context);
  if (!board) return;
  const issuer = validateIssuer(result, request, context);
  if (!issuer) return;
  const cooldown = result.next.actorCooldowns[request.actorId] ?? { abuseScore: 0 };
  if ((cooldown.lastPostAtMs ?? 0) + HARTHMERE_JOBS_BOARD_POST_COOLDOWN_MS_V1 > request.nowMs) {
    cooldown.abuseScore += 1;
    result.next.actorCooldowns[request.actorId] = cooldown;
    return reject(result, "jobs_board_rejected:post_cooldown");
  }
  const template = applyBusinessTemplateDefaults(result, request, issuer.issuerBusinessType);
  if (result.warnings.length) return;
  const rewardGold = positiveInt(request.rewardGold, template?.defaultRewardGold ?? 0);
  if (rewardGold < HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD_V1) return reject(result, "jobs_board_rejected:reward_too_low");
  if (rewardGold > HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD_V1) return reject(result, "jobs_board_rejected:reward_too_high");
  const deadlineAtMs = request.deadlineAtMs ?? request.nowMs + (template?.defaultDeadlineDays ?? 7) * 24 * 60 * 60 * 1000;
  if (deadlineAtMs <= request.nowMs || deadlineAtMs - request.nowMs > HARTHMERE_JOBS_BOARD_MAX_DURATION_MS_V1) return reject(result, "jobs_board_rejected:invalid_deadline");
  const kind = request.kind ?? template?.kind ?? "service";
  if (!board.acceptedKinds.includes(kind)) return reject(result, "jobs_board_rejected:unsupported_job_kind");
  const title = sanitizeText(request.title, template?.title ?? "Work Needed", 100);
  const description = sanitizeText(request.description, template?.description ?? "See the board notice for details.", 360);
  const requirements = normalizeRequirements(request.requirements ?? template?.requirements);
  if (!requirements.length) return reject(result, "jobs_board_rejected:requirements_required");
  for (const req of requirements) {
    if (req.itemId && !isKnownHarthmereJobsBoardExecutableItemIdV146(req.itemId)) {
      return reject(result, `jobs_board_rejected:unknown_requirement_item:${req.itemId}`);
    }
  }
  const rewardItems = normalizeRewardItems(request.rewardItems);
  const rewardCollectibleIds = normalizeRewardCollectibleIds(request.rewardCollectibleIds);
  if ((request.rewardItems ?? []).length !== rewardItems.length) return reject(result, "jobs_board_rejected:invalid_reward_item");
  if ((request.rewardCollectibleIds ?? []).length !== rewardCollectibleIds.length) return reject(result, "jobs_board_rejected:invalid_reward_collectible");
  const flags: string[] = [];
  if (hasSuspiciousText(`${title} ${description}`)) flags.push("suspicious_text");
  const activeIssuerJobs = openJobIdsForIssuer(result.next, issuer.issuerKind, issuer.issuerId);
  if (activeIssuerJobs.length >= HARTHMERE_JOBS_BOARD_MAX_ACTIVE_POSTINGS_PER_ISSUER_V1) return reject(result, "jobs_board_rejected:issuer_posting_limit");
  chargeEscrow(result, request, context, issuer.issuerKind, issuer.issuerId, rewardGold, rewardItems, rewardCollectibleIds);
  if (result.warnings.length) return;
  const jobId = `harthmere_job_${result.next.nextJobNumber++}`;
  const firstMarker = request.mapMarkerId ?? template?.mapMarkerId ?? requirements.find((req) => req.mapMarkerId)?.mapMarkerId ?? requirements.find((req) => req.targetId)?.targetId;
  const targetId = request.targetId ?? template?.targetId ?? requirements.find((req) => req.targetId)?.targetId;
  result.next.postings[jobId] = {
    jobId,
    boardId: board.boardId,
    issuerKind: issuer.issuerKind,
    issuerId: issuer.issuerId,
    issuerBusinessType: issuer.issuerBusinessType,
    title,
    description,
    kind,
    requirements,
    templateId: request.templateId,
    rewardGold,
    escrowGold: rewardGold,
    rewardItems,
    escrowItems: itemRewardsToRecord(rewardItems),
    rewardCollectibleIds,
    reputationDelta: Math.max(1, Math.round(rewardGold / 100)),
    status: "open",
    townId: request.townId ?? board.townId,
    regionId: request.regionId ?? board.regionId,
    createdAtMs: request.nowMs,
    deadlineAtMs,
    failurePenaltyGold: Math.round(rewardGold * 0.1),
    requiresFieldWork: request.requiresFieldWork === true || ["delivery", "repair", "cleanup", "hunt", "escort", "medical", "exploration", "construction", "security"].includes(kind),
    mapMarkerId: firstMarker,
    targetId,
    abuseFlags: flags,
    logs: [`created:${request.actorId}:${request.nowMs}`],
  };
  result.next.issuerOpenJobIds[issuerKey(issuer.issuerKind, issuer.issuerId)] = openJobIdsForIssuer(result.next, issuer.issuerKind, issuer.issuerId);
  result.next.actorCooldowns[request.actorId] = { ...cooldown, lastPostAtMs: request.nowMs };
  pushAudit(result, request, { id: request.requestId, kind: "job_posted", jobId, boardId: board.boardId, issuerKind: issuer.issuerKind, issuerId: issuer.issuerId, amountGold: -rewardGold, reason: flags.join(",") || undefined });
  result.touched.add("jobs_board_posting");
  result.shared.add(sharedBoardKey(board.boardId));
  result.shared.add(sharedJobKey(jobId));
}

function createTodoForJob(result: MutableJobsResult, request: HarthmereJobsBoardMutationRequestV1, job: HarthmereJobsBoardPostingV1) {
  const existing = Object.values(result.next.todos).find((todo) => todo.jobId === job.jobId && todo.actorId === request.actorId);
  if (existing) return;
  const todoId = `harthmere_job_todo_${result.next.nextTodoNumber++}`;
  result.next.todos[todoId] = {
    todoId,
    jobId: job.jobId,
    actorId: request.actorId,
    boardId: job.boardId,
    title: job.title,
    todoText: job.requiresFieldWork ? `Go to the marked location and complete: ${job.title}` : `Complete board job: ${job.title}`,
    status: "active",
    kind: job.kind,
    mapMarkerId: job.mapMarkerId ?? job.targetId,
    targetId: job.targetId,
    townId: job.townId,
    regionId: job.regionId,
    createdAtMs: request.nowMs,
    dueAtMs: job.deadlineAtMs,
    questBoardTodo: true,
  };
  result.touched.add("jobs_board_quest_todo");
  result.shared.add(sharedTodoKey(todoId));
}

function acceptJobPosting(result: MutableJobsResult, request: HarthmereJobsBoardMutationRequestV1, context: HarthmereJobsBoardMutationContextV1) {
  const board = requireBoard(result, request, context);
  if (!board) return;
  const job = request.jobId ? result.next.postings[request.jobId] : undefined;
  if (!job) return reject(result, "jobs_board_rejected:job_not_found");
  if (job.boardId !== board.boardId) return reject(result, "jobs_board_rejected:wrong_board");
  if (job.status !== "open") return reject(result, "jobs_board_rejected:job_not_open");
  if (job.deadlineAtMs <= request.nowMs) {
    job.status = "expired";
    job.logs.push(`expired_on_accept:${request.nowMs}`);
    result.next.issuerOpenJobIds[issuerKey(job.issuerKind, job.issuerId)] =
      openJobIdsForIssuer(result.next, job.issuerKind, job.issuerId);
    result.shared.add(sharedJobKey(job.jobId));
    result.shared.add(sharedBoardKey(board.boardId));
    return reject(result, "jobs_board_rejected:job_expired");
  }
  if (job.issuerKind === "player" && job.issuerId === request.actorId) return reject(result, "jobs_board_rejected:cannot_accept_own_job");
  const cooldown = result.next.actorCooldowns[request.actorId] ?? { abuseScore: 0 };
  if ((cooldown.lastAcceptAtMs ?? 0) + HARTHMERE_JOBS_BOARD_ACCEPT_COOLDOWN_MS_V1 > request.nowMs) {
    cooldown.abuseScore += 1;
    result.next.actorCooldowns[request.actorId] = cooldown;
    return reject(result, "jobs_board_rejected:accept_cooldown");
  }
  if (activeJobIdsForActor(result.next, request.actorId).length >= HARTHMERE_JOBS_BOARD_MAX_ACTIVE_ACCEPTED_PER_SEEKER_V1) return reject(result, "jobs_board_rejected:seeker_active_job_limit");
  job.status = "active";
  job.acceptedAtMs = request.nowMs;
  job.acceptedByActorId = request.actorId;
  job.logs.push(`accepted:${request.actorId}:${request.nowMs}`);
  result.next.actorAcceptedJobIds[request.actorId] = activeJobIdsForActor(result.next, request.actorId);
  result.next.actorCooldowns[request.actorId] = { ...cooldown, lastAcceptAtMs: request.nowMs };
  createTodoForJob(result, request, job);
  pushAudit(result, request, { id: request.requestId, kind: "job_accepted", jobId: job.jobId, boardId: board.boardId, issuerKind: job.issuerKind, issuerId: job.issuerId });
  result.touched.add("jobs_board_posting");
  result.shared.add(sharedJobKey(job.jobId));
  result.shared.add(sharedBoardKey(board.boardId));
}

function actorHasCompletionRequirements(job: HarthmereJobsBoardPostingV1, request: HarthmereJobsBoardMutationRequestV1, context: HarthmereJobsBoardMutationContextV1, result: MutableJobsResult) {
  for (const req of job.requirements) {
    if (!req.itemId) continue;
    const needed = positiveInt(req.count, 1);
    const providedDelta = request.completionItemDeltas?.[req.itemId];
    if (typeof providedDelta === "number") {
      if (providedDelta !== -needed) return reject(result, `jobs_board_rejected:invalid_completion_delta:${req.itemId}`);
    }
    if ((context.actorInventoryItems[req.itemId] ?? 0) + (result.itemDeltas[req.itemId] ?? 0) < needed) {
      return reject(result, `jobs_board_rejected:missing_completion_item:${req.itemId}`);
    }
  }
}

function todoForJobAndActor(
  state: HarthmereJobsBoardStateV1,
  jobId: string,
  actorId: string,
  questTodoId?: string,
) {
  if (questTodoId) {
    const todo = state.todos[questTodoId];
    return todo?.jobId === jobId && todo.actorId === actorId ? todo : undefined;
  }
  return Object.values(state.todos).find((todo) => todo.jobId === jobId && todo.actorId === actorId);
}

function completeJobQuest(result: MutableJobsResult, request: HarthmereJobsBoardMutationRequestV1, context: HarthmereJobsBoardMutationContextV1) {
  const job = request.jobId ? result.next.postings[request.jobId] : undefined;
  if (!job) return reject(result, "jobs_board_rejected:job_not_found");
  if (job.status !== "active") return reject(result, "jobs_board_rejected:job_not_active");
  if (job.acceptedByActorId !== request.actorId) return reject(result, "jobs_board_rejected:job_not_accepted_by_actor");
  const todo = todoForJobAndActor(result.next, job.jobId, request.actorId, request.questTodoId);
  if (!todo) return reject(result, "jobs_board_rejected:quest_todo_required");
  if (todo.status === "completed") return reject(result, "jobs_board_rejected:quest_already_completed");
  if (todo.status !== "active") return reject(result, `jobs_board_rejected:quest_not_active:${todo.status}`);
  if (job.deadlineAtMs <= request.nowMs) {
    job.status = "expired";
    todo.status = "expired";
    return reject(result, "jobs_board_rejected:job_expired");
  }
  const serviceRequirements = job.requirements.filter((req) => !req.itemId && (req.targetId || req.serviceKind));
  for (const req of serviceRequirements) {
    if (req.targetId && request.completedTargetId !== req.targetId) {
      return reject(result, `jobs_board_rejected:wrong_quest_target:${req.targetId}`);
    }
  }
  actorHasCompletionRequirements(job, request, context, result);
  if (result.warnings.length) return;
  for (const req of job.requirements) {
    if (req.itemId) recordItemDelta(result.itemDeltas, req.itemId, -positiveInt(req.count, 1));
  }
  todo.status = "completed";
  job.logs.push(`quest_completed:${request.actorId}:${request.nowMs}`);
  pushAudit(result, request, { id: request.requestId, kind: "job_quest_completed", jobId: job.jobId, boardId: job.boardId, issuerKind: job.issuerKind, issuerId: job.issuerId, reason: sanitizeText(request.completionNote, "quest completed", 120) });
  result.touched.add("jobs_board_quest_todo");
  result.shared.add(sharedTodoKey(todo.todoId));
  result.shared.add(sharedJobKey(job.jobId));
}

function completeJobPosting(result: MutableJobsResult, request: HarthmereJobsBoardMutationRequestV1, context: HarthmereJobsBoardMutationContextV1) {
  const board = requireBoard(result, request, context);
  if (!board) return;
  const job = request.jobId ? result.next.postings[request.jobId] : undefined;
  if (!job) return reject(result, "jobs_board_rejected:job_not_found");
  if (job.status !== "active") return reject(result, "jobs_board_rejected:job_not_active");
  if (job.acceptedByActorId !== request.actorId) return reject(result, "jobs_board_rejected:job_not_accepted_by_actor");
  if (job.deadlineAtMs <= request.nowMs) {
    job.status = "expired";
    return reject(result, "jobs_board_rejected:job_expired");
  }
  const todo = todoForJobAndActor(result.next, job.jobId, request.actorId, request.questTodoId);
  if (!todo) return reject(result, "jobs_board_rejected:quest_todo_required");
  if (todo.status !== "completed") return reject(result, "jobs_board_rejected:quest_not_completed");
  result.goldDelta += job.escrowGold;
  for (const reward of job.rewardItems ?? []) recordItemDelta(result.itemDeltas, reward.itemId, reward.count);
  result.collectibleRewardIds.push(...(job.rewardCollectibleIds ?? []));
  job.escrowGold = 0;
  job.escrowItems = {};
  job.status = "completed";
  job.completedAtMs = request.nowMs;
  job.logs.push(`completed:${request.actorId}:${request.nowMs}`);
  for (const todo of Object.values(result.next.todos)) {
    if (todo.jobId === job.jobId && todo.actorId === request.actorId) todo.status = "completed";
  }
  result.next.actorAcceptedJobIds[request.actorId] = activeJobIdsForActor(result.next, request.actorId);
  result.next.issuerOpenJobIds[issuerKey(job.issuerKind, job.issuerId)] = openJobIdsForIssuer(result.next, job.issuerKind, job.issuerId);
  pushAudit(result, request, { id: request.requestId, kind: "job_completed", jobId: job.jobId, boardId: board.boardId, issuerKind: job.issuerKind, issuerId: job.issuerId, amountGold: job.rewardGold, reason: sanitizeText(request.completionNote, "completed", 120) });
  result.touched.add("jobs_board_posting");
  result.touched.add("jobs_board_quest_todo");
  result.shared.add(sharedJobKey(job.jobId));
  result.shared.add(sharedBoardKey(board.boardId));
}

function cancelJobPosting(result: MutableJobsResult, request: HarthmereJobsBoardMutationRequestV1, context: HarthmereJobsBoardMutationContextV1) {
  const board = requireBoard(result, request, context);
  if (!board) return;
  const job = request.jobId ? result.next.postings[request.jobId] : undefined;
  if (!job) return reject(result, "jobs_board_rejected:job_not_found");
  if (job.status === "completed") return reject(result, "jobs_board_rejected:cannot_cancel_completed_job");
  const issuerIsActor = job.issuerKind === "player" && job.issuerId === request.actorId;
  const business = job.issuerKind === "business" ? context.economy?.businesses?.[job.issuerId] : undefined;
  const canCancel = issuerIsActor || (business && context.canManageBusinessJobs?.(business) === true) ||
    (job.issuerKind === "guild" && context.canManageGuildJobs?.(job.issuerId) === true) ||
    (job.issuerKind === "town" && context.canManageTownJobs?.(job.issuerId) === true) ||
    (job.issuerKind === "npc" && context.allowNpcJobPosting === true);
  if (!canCancel) return reject(result, "jobs_board_rejected:cancel_permission_required");
  if (job.status === "active") {
    // Prevent bait-and-switch abuse: active jobs cannot be silently cancelled by issuer without failing.
    job.status = "failed";
    job.logs.push(`failed_by_cancel:${request.actorId}:${request.nowMs}`);
  } else {
    job.status = "cancelled";
    job.cancelledAtMs = request.nowMs;
    refundEscrow(result, job, request);
  }
  for (const todo of Object.values(result.next.todos)) {
    if (todo.jobId === job.jobId) todo.status = job.status === "cancelled" ? "cancelled" : "failed";
  }
  result.next.issuerOpenJobIds[issuerKey(job.issuerKind, job.issuerId)] = openJobIdsForIssuer(result.next, job.issuerKind, job.issuerId);
  if (job.acceptedByActorId) result.next.actorAcceptedJobIds[job.acceptedByActorId] = activeJobIdsForActor(result.next, job.acceptedByActorId);
  pushAudit(result, request, { id: request.requestId, kind: "job_cancelled", jobId: job.jobId, boardId: board.boardId, issuerKind: job.issuerKind, issuerId: job.issuerId });
  result.touched.add("jobs_board_posting");
  result.shared.add(sharedJobKey(job.jobId));
}

function expireJobs(result: MutableJobsResult, request: HarthmereJobsBoardMutationRequestV1, context: HarthmereJobsBoardMutationContextV1) {
  const board = requireBoard(result, request, context);
  if (!board) return;
  for (const job of Object.values(result.next.postings)) {
    if ((job.status === "open" || job.status === "active") && job.deadlineAtMs <= request.nowMs) {
      const wasOpen = job.status === "open";
      job.status = "expired";
      job.logs.push(`expired:${request.nowMs}`);
      if (wasOpen) refundEscrow(result, job, request);
      for (const todo of Object.values(result.next.todos)) {
        if (todo.jobId === job.jobId) todo.status = "expired";
      }
      result.shared.add(sharedJobKey(job.jobId));
    }
  }
  result.touched.add("jobs_board_expiration");
  result.shared.add(sharedBoardKey(board.boardId));
}

// HARTHMERE_JOBS_BOARD_AUTO_POSTING_V141:
// Tuning knobs for the economy-driven auto-seeder. Keep these named so tests
// can assert on them and ops can tune them without changing the seeder body.
export const HARTHMERE_JOBS_BOARD_AUTO_SEED_TARGET_OPEN_V141 = 8;
export const HARTHMERE_JOBS_BOARD_AUTO_SEED_MAX_PER_TICK_V141 = 4;
export const HARTHMERE_JOBS_BOARD_AUTO_SEED_DEADLINE_MS_V141 = 24 * 60 * 60 * 1000;
export const HARTHMERE_JOBS_BOARD_AUTO_SEED_ISSUER_PREFIX_V141 = "harthmere_auto_";
export const HARTHMERE_JOBS_BOARD_MONSTER_HUNT_REWARD_FLOOR_V141 = 1200;
export const HARTHMERE_JOBS_BOARD_MONSTER_HUNT_REWARD_CEILING_V141 = 4500;
export const HARTHMERE_EXOTIC_MATTER_MINING_TEMPLATE_ID_PREFIXES_V1 = [
  "exotic_matter_mine_",
  "deep_exotic_matter_mine_",
] as const;

export function isHarthmereExoticMatterMiningTemplateIdV1(
  templateId: string | undefined | null
) {
  return Boolean(
    templateId &&
      HARTHMERE_EXOTIC_MATTER_MINING_TEMPLATE_ID_PREFIXES_V1.some((prefix) =>
        templateId.startsWith(prefix)
      )
  );
}

// HARTHMERE_JOBS_BOARD_AUTO_POSTING_V141:
// Templates for procedurally generated NPC/town/business jobs. Each template
// is a plain data record so it's trivial to test, extend, and tune. Reward
// ranges intentionally overlap with player-posted job ranges (5–5000 gold)
// and respect HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD_V1.
//
// Monster-hunt templates are flagged `partyRecommended: true` with elevated
// `monsterPowerLevel` (player-character-level units). The intent: solo
// players can technically engage but the encounter is balanced for 3–4 and
// rewards reflect that, with named drop hints (e.g. Hex Sigil, Muckheart).
// HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN_V141:
// Templates can be scoped to a specific board id (grove vs harthmere) so the
// auto-seeder doesn't post Grove jobs on the Harthmere board (and vice
// versa). `boardScope: "any"` posts on either board.
type AutoSeedBoardScope = "grove" | "harthmere" | "any";
interface AutoSeedTemplate {
  templateId: string;
  issuerKind: HarthmereJobsBoardIssuerKindV1;
  issuerId: string;
  kind: HarthmereJobsBoardJobKindV1;
  title: string;
  description: string;
  requirements: HarthmereJobsBoardRequirementV1[];
  rewardGold: { min: number; max: number };
  requiresFieldWork: boolean;
  mapMarkerId?: string;
  targetId?: string;
  monsterId?: "mucker" | "hex";
  monsterTier?: "normal" | "strong" | "elite" | "boss";
  monsterPowerLevel?: number;
  partyRecommended?: boolean;
  partyMinSize?: number;
  lootHint?: string[];
  boardScope?: AutoSeedBoardScope;
}

function templateBoardScopeMatches(template: AutoSeedTemplate, boardId: string): boolean {
  const scope = template.boardScope ?? "any";
  if (scope === "any") return true;
  if (scope === "grove" && boardId === HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1) return true;
  if (scope === "harthmere" && boardId === HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141) return true;
  return false;
}

// HARTHMERE_JOBS_BOARD_AUTO_SEED_OBTAINABLE_REQUIREMENTS_V1
// An auto-seeded job must only require items a player can actually obtain. A
// template whose requirement references an item outside the known executable
// set (e.g. a placeholder id like `apple_basket`/`courier_pouch` that exists
// nowhere as loot/vendor/craft output) would produce a posting that can NEVER
// satisfy `actorHasCompletionRequirements`, so we exclude it from auto-seeding.
// Target-only requirements (no itemId) are always allowed.
export function harthmereAutoSeedTemplateRequirementsObtainableV1(
  requirements: ReadonlyArray<{ itemId?: string }>
): boolean {
  return requirements.every(
    (req) =>
      !req.itemId || isKnownHarthmereJobsBoardExecutableItemIdV146(req.itemId)
  );
}

function hasOpenExoticMatterMiningJobV1(
  state: HarthmereJobsBoardStateV1,
  boardId: string
) {
  return Object.values(state.postings).some(
    (job) =>
      job.boardId === boardId &&
      job.status === "open" &&
      isHarthmereExoticMatterMiningTemplateIdV1(job.templateId)
  );
}

export const HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES_V141: AutoSeedTemplate[] = [
  // Grove-scoped town/NPC/guild work — these reference Grove landmarks.
  {
    templateId: "town_gather_road_rations",
    issuerKind: "town",
    issuerId: "harthmere_grove",
    kind: "gather",
    title: "Stock the Road Rations Crate",
    description: "Grove travellers leave hungry. Gather 6 wild berries for the road rations crate at the fountain.",
    requirements: [{ itemId: "wild_berries", count: 6, mapMarkerId: "grove_garden_edge_berries" }],
    rewardGold: { min: 35, max: 75 },
    requiresFieldWork: true,
    mapMarkerId: "grove_garden_edge_berries",
    boardScope: "grove",
  },
  {
    templateId: "town_repair_fence",
    issuerKind: "town",
    issuerId: "harthmere_grove",
    kind: "repair",
    title: "Patch the Safe-Zone Fence",
    description: "The eastern fence post split again. Replace 3 softwood planks before the next muck flush.",
    requirements: [{ itemId: "softwood_log", count: 3, mapMarkerId: "grove_repair_fence" }],
    rewardGold: { min: 60, max: 110 },
    requiresFieldWork: true,
    mapMarkerId: "grove_repair_fence",
    boardScope: "grove",
  },
  {
    templateId: "town_cleanup_muck_patch",
    issuerKind: "town",
    issuerId: "harthmere_grove",
    kind: "cleanup",
    title: "Clear the Muckwad Patch",
    description: "Five muckwad clumps near the road need clearing before they spread to the practice fields.",
    requirements: [{ itemId: "muckwad", count: 5, mapMarkerId: "muckwad_patch" }],
    rewardGold: { min: 90, max: 160 },
    requiresFieldWork: true,
    mapMarkerId: "muckwad_patch",
    boardScope: "grove",
  },
  {
    templateId: "npc_delivery_apples",
    issuerKind: "npc",
    issuerId: "old_coop",
    kind: "delivery",
    title: "Run the Coop Apple Sack",
    description: "Old Coop wants an apple sack carried from the hen yard to the fountain bakery satchel.",
    requirements: [{ itemId: "apple_basket", count: 1, mapMarkerId: "grove_mail_bank_satchel" }],
    rewardGold: { min: 45, max: 90 },
    requiresFieldWork: true,
    mapMarkerId: "grove_mail_bank_satchel",
    boardScope: "grove",
  },
  {
    templateId: "business_craft_torch",
    issuerKind: "business",
    issuerId: "grove_kettle_inn",
    kind: "craft",
    title: "Craft Two Travel Torches",
    description: "The inn ran low on travel torches before dusk. Craft 2 and turn them in at the board.",
    requirements: [{ itemId: "torch", count: 2 }],
    rewardGold: { min: 70, max: 120 },
    requiresFieldWork: false,
    boardScope: "grove",
  },
  {
    templateId: "guild_escort_road_post",
    issuerKind: "guild",
    issuerId: "grove_wayfinder_guild",
    kind: "escort",
    title: "Escort a Newcomer to the Road Post",
    description: "A new arrival needs a steady walk to the Old Grove Road Post. Stay close until they reach it.",
    requirements: [{ targetId: "old_grove_road_post", targetName: "Old Grove Road Post", mapMarkerId: "old_grove_road_post" }],
    rewardGold: { min: 50, max: 100 },
    requiresFieldWork: true,
    mapMarkerId: "old_grove_road_post",
    boardScope: "grove",
  },
  // HARTHMERE_JOBS_BOARD_MONSTER_HUNT_V141:
  // Two high-reward party-required hunts. The Mucker variant is a tougher
  // version of the Mucked Robot the player meets in the muck edges; the Hex
  // variant is a corrupted boss that drops a sigil and an arcane shard. The
  // Grove board carries the Mucker hunt (closer to the Grove muck edge); the
  // Harthmere board carries the Hex wraith hunt (out in Mosslawn closer to
  // Harthmere's far districts), and there is a third "any" boss for both.
  {
    templateId: "hunt_mucker_elite",
    issuerKind: "town",
    issuerId: "harthmere_grove",
    kind: "hunt",
    title: "Bounty: Elite Mucker at the Muck Edge",
    description: "An elite Mucker has dug in past the safe-zone boundary. Strong, slow, hits like a piledriver — bring a party. Reward only paid on confirmed kill.",
    requirements: [{ targetId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID_V1, targetName: "Elite Mucker", mapMarkerId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID_V1 }],
    rewardGold: { min: HARTHMERE_JOBS_BOARD_MONSTER_HUNT_REWARD_FLOOR_V141, max: 2400 },
    requiresFieldWork: true,
    mapMarkerId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_MARKER_ID_V1,
    targetId: HARTHMERE_JOBS_BOARD_ELITE_MUCKER_BOUNTY_TARGET_ID_V1,
    monsterId: "mucker",
    monsterTier: "elite",
    monsterPowerLevel: 18,
    partyRecommended: true,
    partyMinSize: 3,
    lootHint: ["Muckheart", "Mucked Plate Fragment", "Elite Reward Chest"],
    boardScope: "grove",
  },
  {
    templateId: "hunt_hex_boss",
    issuerKind: "guild",
    issuerId: "harthmere_warden_guild",
    kind: "hunt",
    title: "Bounty: Hex Wraith Sighting in Mosslawn",
    description: "A Hex wraith has surfaced under the Mosslawn songline near Harthmere's borderlands. Heavily resists single attackers and drops a Hex Sigil. Take a party of four.",
    requirements: [{ targetId: HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_TARGET_ID_V1, targetName: "Hex Wraith", mapMarkerId: HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_MARKER_ID_V1 }],
    rewardGold: { min: 2600, max: HARTHMERE_JOBS_BOARD_MONSTER_HUNT_REWARD_CEILING_V141 },
    requiresFieldWork: true,
    mapMarkerId: HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_MARKER_ID_V1,
    targetId: HARTHMERE_JOBS_BOARD_HEX_WRAITH_BOUNTY_TARGET_ID_V1,
    monsterId: "hex",
    monsterTier: "boss",
    monsterPowerLevel: 24,
    partyRecommended: true,
    partyMinSize: 4,
    lootHint: ["Hex Sigil", "Arcane Shard", "Boss Loot Cache"],
    boardScope: "harthmere",
  },
  // HARTHMERE_EXOTIC_MATTER_CAVE_JOBS_V1:
  // High-value Harthmere board contracts that send miners into confirmed
  // underground cave rooms for the three antimatter blocks needed to craft Raw
  // Exotic Matter. These use shared cave deposit markers so the board, map,
  // renderer, and live backend agree on exact [x, y, z] targets.
  {
    templateId: "exotic_matter_mine_antihydrogen",
    issuerKind: "guild",
    issuerId: "harthmere_exotic_refiners_guild",
    kind: "gather",
    title: "Mine Antihydrogen for Exotic Matter",
    description: "The refiners need sealed Antihydrogen from the Mossglass survey cave before the next Biome stabilizer run. Mine the marked seam and bring the blocks back intact.",
    requirements: [
      {
        itemId: HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antihydrogen.itemId,
        count: 3,
        targetId: "harthmere_antihydrogen_deposit",
        targetName: HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antihydrogen.jobTargetName,
        mapMarkerId: "exotic_antihydrogen_mossglass_survey_02",
      },
    ],
    rewardGold: { min: 3200, max: HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD_V1 },
    requiresFieldWork: true,
    mapMarkerId: "exotic_antihydrogen_mossglass_survey_02",
    targetId: "harthmere_antihydrogen_deposit",
    lootHint: ["Refinery priority pay", "Biome stabilizer supply", "Rare mining bonus"],
    boardScope: "harthmere",
  },
  {
    templateId: "exotic_matter_mine_antihelium",
    issuerKind: "guild",
    issuerId: "harthmere_exotic_refiners_guild",
    kind: "gather",
    title: "Mine Antihelium for Exotic Matter",
    description: "A clean-power order is waiting on Antihelium. Follow the marked cave pocket, mine the contained blocks, and keep the shipment sealed.",
    requirements: [
      {
        itemId: HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antihelium.itemId,
        count: 2,
        targetId: "harthmere_antihelium_deposit",
        targetName: HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antihelium.jobTargetName,
        mapMarkerId: "exotic_antihelium_mossglass_survey_05",
      },
    ],
    rewardGold: { min: 3400, max: HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD_V1 },
    requiresFieldWork: true,
    mapMarkerId: "exotic_antihelium_mossglass_survey_05",
    targetId: "harthmere_antihelium_deposit",
    lootHint: ["Refinery priority pay", "Teleport fuel supply", "Rare mining bonus"],
    boardScope: "harthmere",
  },
  {
    templateId: "exotic_matter_mine_antiboron",
    issuerKind: "guild",
    issuerId: "harthmere_exotic_refiners_guild",
    kind: "gather",
    title: "Mine Antiboron for Exotic Matter",
    description: "Antiboron is scarce and the refinery is paying accordingly. Mine the marked blackglass vein in the Mossglass survey cave and return with sealed blocks.",
    requirements: [
      {
        itemId: HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antiboron.itemId,
        count: 1,
        targetId: "harthmere_antiboron_deposit",
        targetName: HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antiboron.jobTargetName,
        mapMarkerId: "exotic_antiboron_mossglass_survey_03",
      },
    ],
    rewardGold: { min: 3800, max: HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD_V1 },
    requiresFieldWork: true,
    mapMarkerId: "exotic_antiboron_mossglass_survey_03",
    targetId: "harthmere_antiboron_deposit",
    lootHint: ["Refinery priority pay", "Alcubierre supply chain", "Rare mining bonus"],
    boardScope: "harthmere",
  },
  {
    templateId: "deep_exotic_matter_mine_antihydrogen",
    issuerKind: "guild",
    issuerId: "harthmere_exotic_refiners_guild",
    kind: "gather",
    title: "Deep Mine Antihydrogen for Exotic Matter",
    description: "A major refinery order needs Antihydrogen from the Deep Spindle massive cave. Mine the marked blue seam and return with sealed blocks.",
    requirements: [
      {
        itemId: HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antihydrogen.itemId,
        count: 5,
        targetId: "harthmere_deep_antihydrogen_deposit",
        targetName: HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antihydrogen.jobTargetName,
        mapMarkerId: "exotic_antihydrogen_deep_spindle_14",
      },
    ],
    rewardGold: { min: 4600, max: HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD_V1 },
    requiresFieldWork: true,
    mapMarkerId: "exotic_antihydrogen_deep_spindle_14",
    targetId: "harthmere_deep_antihydrogen_deposit",
    lootHint: ["Deep-cave hazard pay", "Biome stabilizer supply", "Rare mining bonus"],
    boardScope: "harthmere",
  },
  {
    templateId: "deep_exotic_matter_mine_antihelium",
    issuerKind: "guild",
    issuerId: "harthmere_exotic_refiners_guild",
    kind: "gather",
    title: "Deep Mine Antihelium for Exotic Matter",
    description: "The clean-power line is short on Antihelium. Push into the Deep Spindle massive cave and mine the marked pocket.",
    requirements: [
      {
        itemId: HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antihelium.itemId,
        count: 4,
        targetId: "harthmere_deep_antihelium_deposit",
        targetName: HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antihelium.jobTargetName,
        mapMarkerId: "exotic_antihelium_deep_spindle_15",
      },
    ],
    rewardGold: { min: 4700, max: HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD_V1 },
    requiresFieldWork: true,
    mapMarkerId: "exotic_antihelium_deep_spindle_15",
    targetId: "harthmere_deep_antihelium_deposit",
    lootHint: ["Deep-cave hazard pay", "Teleport fuel supply", "Rare mining bonus"],
    boardScope: "harthmere",
  },
  {
    templateId: "deep_exotic_matter_mine_antiboron",
    issuerKind: "guild",
    issuerId: "harthmere_exotic_refiners_guild",
    kind: "gather",
    title: "Deep Mine Antiboron for Exotic Matter",
    description: "Antiboron from the Deep Spindle massive cave is scarce and dangerous to extract. Mine the marked blackglass vein for premium pay.",
    requirements: [
      {
        itemId: HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antiboron.itemId,
        count: 3,
        targetId: "harthmere_deep_antiboron_deposit",
        targetName: HARTHMERE_EXOTIC_MATTER_COMPONENTS_V1.antiboron.jobTargetName,
        mapMarkerId: "exotic_antiboron_deep_spindle_16",
      },
    ],
    rewardGold: { min: 4800, max: HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD_V1 },
    requiresFieldWork: true,
    mapMarkerId: "exotic_antiboron_deep_spindle_16",
    targetId: "harthmere_deep_antiboron_deposit",
    lootHint: ["Deep-cave hazard pay", "Alcubierre supply chain", "Rare mining bonus"],
    boardScope: "harthmere",
  },
  // HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN_V141:
  // Harthmere-scoped town/NPC/business work tied to Harthmere landmarks
  // (market office, chapel stone, bridge center, Mosslawn). These keep the
  // Harthmere board populated with town-flavored jobs.
  {
    templateId: "harthmere_town_market_delivery",
    issuerKind: "town",
    issuerId: "harthmere_town",
    kind: "delivery",
    title: "Deliver Ledger Pouch to Market Office",
    description: "The market office is waiting on a ledger pouch from the bridge clerk. Carry it east without breaking the seal.",
    requirements: [{ itemId: "harthmere_ledger_pouch", count: 1, mapMarkerId: "harthmere_market_office" }],
    rewardGold: { min: 60, max: 120 },
    requiresFieldWork: true,
    mapMarkerId: "harthmere_market_office",
    boardScope: "harthmere",
  },
  {
    templateId: "harthmere_town_repair_chapel",
    issuerKind: "town",
    issuerId: "harthmere_town",
    kind: "repair",
    title: "Restore the Chapel Stone Engravings",
    description: "Wind and muck have dulled the chapel stone. Bring 4 chisel-grade stones and an etcher's mallet to repair the etchings.",
    requirements: [{ itemId: "rough_stone", count: 4, mapMarkerId: "harthmere_chapel_stone" }],
    rewardGold: { min: 80, max: 150 },
    requiresFieldWork: true,
    mapMarkerId: "harthmere_chapel_stone",
    boardScope: "harthmere",
  },
  {
    templateId: "harthmere_npc_courier_bridge",
    issuerKind: "npc",
    issuerId: "sergeant_bram_holt",
    kind: "delivery",
    title: "Bram's Bridge Courier Run",
    description: "Sergeant Bram needs a courier pouch carried from the bridge center to the chapel stone before dusk.",
    requirements: [{ itemId: "courier_pouch", count: 1, mapMarkerId: "harthmere_chapel_stone" }],
    rewardGold: { min: 70, max: 140 },
    requiresFieldWork: true,
    mapMarkerId: "harthmere_bridge_center",
    boardScope: "harthmere",
  },
  {
    templateId: "harthmere_business_craft_lantern",
    issuerKind: "business",
    issuerId: "harthmere_marketcraft_co",
    kind: "craft",
    title: "Forge Three Market Lanterns",
    description: "The market lamps need replacements. Craft 3 lanterns and turn them in at the Harthmere jobs board.",
    requirements: [{ itemId: "iron_lantern", count: 3 }],
    rewardGold: { min: 90, max: 180 },
    requiresFieldWork: false,
    boardScope: "harthmere",
  },
  {
    templateId: "harthmere_guild_security_patrol",
    issuerKind: "guild",
    issuerId: "harthmere_warden_guild",
    kind: "security",
    title: "Night Patrol the Market District",
    description: "A night patrol pass between bridge and market office. Report anything that doesn't belong.",
    requirements: [{ targetId: "harthmere_market_office", targetName: "Harthmere Market Office", mapMarkerId: "harthmere_market_office" }],
    rewardGold: { min: 100, max: 200 },
    requiresFieldWork: true,
    mapMarkerId: "harthmere_market_office",
    boardScope: "harthmere",
  },
  // HARTHMERE_JOBS_BOARD_MONSTER_HUNT_V141 (Harthmere-side):
  // Tougher Mucker variant operating along the Harthmere borderlands. Same
  // pattern as the Grove Elite Mucker but rewards scale higher because the
  // monster is later-game power level and the travel distance is bigger.
  {
    templateId: "hunt_mucker_alpha",
    issuerKind: "town",
    issuerId: "harthmere_town",
    kind: "hunt",
    title: "Bounty: Alpha Mucker Past the Bridge",
    description: "An alpha Mucker is digging up the road past the bridge. Even a small party will struggle — bring four and stay clear of its slam radius.",
    requirements: [{ targetId: HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_TARGET_ID_V1, targetName: "Alpha Mucker", mapMarkerId: HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_MARKER_ID_V1 }],
    rewardGold: { min: 1800, max: 3600 },
    requiresFieldWork: true,
    mapMarkerId: HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_MARKER_ID_V1,
    targetId: HARTHMERE_JOBS_BOARD_ALPHA_MUCKER_BOUNTY_TARGET_ID_V1,
    monsterId: "mucker",
    monsterTier: "boss",
    monsterPowerLevel: 22,
    partyRecommended: true,
    partyMinSize: 4,
    lootHint: ["Alpha Muckheart", "Slag Plate", "Boss Loot Cache"],
    boardScope: "harthmere",
  },
];

// Small deterministic PRNG used by the seeder so tests can run with a fixed
// "now" timestamp and assert exact outputs. Mulberry32 is plenty for picking
// templates and rolling reward amounts.
function autoSeedRngV141(seed: number) {
  let state = (seed >>> 0) || 0x9E3779B9;
  return () => {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function countOpenAutoPostings(state: HarthmereJobsBoardStateV1, boardId: string): number {
  let count = 0;
  for (const job of Object.values(state.postings)) {
    if (job.boardId !== boardId) continue;
    if (job.status !== "open") continue;
    if (!job.autoPosted) continue;
    count += 1;
  }
  return count;
}

function expireStaleAutoPostingsForBoardV1(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequestV1,
  boardId: string,
) {
  let expired = 0;
  for (const job of Object.values(result.next.postings)) {
    if (job.boardId !== boardId) continue;
    if (!job.autoPosted) continue;
    if (job.status !== "open" && job.status !== "active") continue;
    if (job.deadlineAtMs > request.nowMs) continue;
    const wasOpen = job.status === "open";
    job.status = "expired";
    job.logs.push(`expired_auto_read:${request.nowMs}`);
    if (wasOpen) {
      refundEscrow(result, job, request);
    }
    for (const todo of Object.values(result.next.todos)) {
      if (todo.jobId === job.jobId) todo.status = "expired";
    }
    result.next.issuerOpenJobIds[issuerKey(job.issuerKind, job.issuerId)] =
      openJobIdsForIssuer(result.next, job.issuerKind, job.issuerId);
    if (job.acceptedByActorId) {
      result.next.actorAcceptedJobIds[job.acceptedByActorId] =
        activeJobIdsForActor(result.next, job.acceptedByActorId);
    }
    result.shared.add(sharedJobKey(job.jobId));
    expired += 1;
  }
  if (expired > 0) {
    result.touched.add("jobs_board_auto_expired");
    result.shared.add(sharedBoardKey(boardId));
  }
}

function hasOpenBusinessTemplateJob(
  state: HarthmereJobsBoardStateV1,
  boardId: string,
  businessId: string,
) {
  return Object.values(state.postings).some(
    (job) =>
      job.boardId === boardId &&
      job.issuerKind === "business" &&
      job.issuerId === businessId &&
      (job.status === "open" || job.status === "active") &&
      Boolean(job.templateId)
  );
}

function hasOpenOutpostStarterJob(
  state: HarthmereJobsBoardStateV1,
  boardId: string,
  outpostId: string,
) {
  return Object.values(state.postings).some(
    (job) =>
      job.boardId === boardId &&
      job.targetId === outpostId &&
      job.templateId === `business_outpost_starter:${outpostId}` &&
      (job.status === "open" || job.status === "active")
  );
}

function economyAutoSeedBusinessOutpostStarterJob(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequestV1,
  board: HarthmereJobsBoardRecordV1,
  outpost: HarthmereBusinessOutpostV1,
) {
  if (hasOpenOutpostStarterJob(result.next, board.boardId, outpost.outpostId)) {
    result.touched.add("jobs_board_outpost_starter_noop");
    return;
  }
  const kind = HARTHMERE_BUSINESS_OUTPOST_JOB_KIND_BY_TYPE_V1[outpost.businessType];
  const rewardGold = Math.max(
    HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD_V1,
    Math.min(HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD_V1, outpost.job.rewardGold),
  );
  let jobId = `harthmere_outpost_starter_${result.next.nextJobNumber++}`;
  while (result.next.postings[jobId]) {
    jobId = `harthmere_outpost_starter_${result.next.nextJobNumber++}`;
  }
  const posting: HarthmereJobsBoardPostingV1 = {
    jobId,
    boardId: board.boardId,
    issuerKind: "npc",
    issuerId: outpost.ownerNpcId,
    issuerBusinessType: outpost.businessType,
    title: `${outpost.job.title} at ${outpost.displayName}`,
    description: `${outpost.job.starterTask} Teaches: ${outpost.job.teaches}`,
    kind,
    requirements: [{
      serviceKind: outpost.businessType,
      serviceUnits: 1,
      targetId: outpost.outpostId,
      targetName: outpost.displayName,
      mapMarkerId: harthmereBusinessOutpostJobMarkerIdV1(outpost),
    }],
    templateId: `business_outpost_starter:${outpost.outpostId}`,
    rewardGold,
    escrowGold: rewardGold,
    reputationDelta: Math.max(1, Math.round(rewardGold / 100)),
    status: "open",
    townId: outpost.townId,
    regionId: outpost.regionId,
    createdAtMs: request.nowMs,
    deadlineAtMs: request.nowMs + 7 * 24 * 60 * 60 * 1000,
    failurePenaltyGold: Math.round(rewardGold * 0.1),
    requiresFieldWork: true,
    mapMarkerId: harthmereBusinessOutpostJobMarkerIdV1(outpost),
    targetId: outpost.outpostId,
    abuseFlags: [],
    logs: [`auto_seeded_business_outpost_starter:${outpost.outpostId}:${request.nowMs}`],
    autoPosted: true,
    source: "economy_auto_seed",
  };
  result.next.postings[jobId] = posting;
  const issuerKey = `npc:${outpost.ownerNpcId}`;
  result.next.issuerOpenJobIds[issuerKey] = [
    ...(result.next.issuerOpenJobIds[issuerKey] ?? []),
    jobId,
  ];
  result.next.audit.push({
    id: `${request.requestId}:${jobId}`,
    atMs: request.nowMs,
    actorId: request.actorId,
    kind: "job_auto_seeded",
    jobId,
    boardId: board.boardId,
    issuerKind: "npc",
    issuerId: outpost.ownerNpcId,
    amountGold: -rewardGold,
    reason: `business_outpost_starter:${outpost.businessType}`,
  });
  result.touched.add("jobs_board_posting");
  result.touched.add("jobs_board_outpost_starter_seeded");
  result.shared.add(sharedBoardKey(board.boardId));
  result.shared.add(sharedJobKey(jobId));
}

function economyAutoSeedProductionBusinessJobs(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequestV1,
  board: HarthmereJobsBoardRecordV1,
) {
  let produced = 0;
  const businesses = Object.values(result.economy?.businesses ?? {})
    .filter((business) =>
      business.status === "open" &&
      (business.townId === board.townId || business.regionId === board.regionId)
    )
    .sort((a, b) => a.businessId.localeCompare(b.businessId));

  for (const business of businesses) {
    if (produced >= HARTHMERE_JOBS_BOARD_BUSINESS_AUTO_SEED_MAX_PER_TICK_V1) break;
    if (hasOpenBusinessTemplateJob(result.next, board.boardId, business.businessId)) continue;
    const template = HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES_V146.find(
      (entry) => entry.businessType === business.typeId && board.acceptedKinds.includes(entry.kind)
    );
    if (!template) continue;
    const issuerKey = `business:${business.businessId}`;
    const issuerOpen = result.next.issuerOpenJobIds[issuerKey]?.length ?? 0;
    if (issuerOpen >= HARTHMERE_JOBS_BOARD_MAX_ACTIVE_POSTINGS_PER_ISSUER_V1) continue;
    const rewardGold = Math.max(
      HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD_V1,
      Math.min(HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD_V1, template.defaultRewardGold)
    );
    if (business.balanceGold < rewardGold) continue;
    business.balanceGold -= rewardGold;
    let jobId = `${HARTHMERE_JOBS_BOARD_AUTO_SEED_ISSUER_PREFIX_V141}${result.next.nextJobNumber++}`;
    while (result.next.postings[jobId]) {
      jobId = `${HARTHMERE_JOBS_BOARD_AUTO_SEED_ISSUER_PREFIX_V141}${result.next.nextJobNumber++}`;
    }
    const posting: HarthmereJobsBoardPostingV1 = {
      jobId,
      boardId: board.boardId,
      issuerKind: "business",
      issuerId: business.businessId,
      issuerBusinessType: business.typeId,
      title: template.title,
      description: template.description,
      kind: template.kind,
      requirements: template.requirements.map((req) => ({ ...req })),
      templateId: template.templateId,
      rewardGold,
      escrowGold: rewardGold,
      reputationDelta: Math.max(1, Math.round(rewardGold / 100)),
      status: "open",
      townId: business.townId ?? board.townId,
      regionId: business.regionId ?? board.regionId,
      createdAtMs: request.nowMs,
      deadlineAtMs: request.nowMs + template.defaultDeadlineDays * 24 * 60 * 60 * 1000,
      failurePenaltyGold: Math.round(rewardGold * 0.1),
      requiresFieldWork: true,
      mapMarkerId: template.mapMarkerId,
      targetId: template.targetId,
      abuseFlags: [],
      logs: [`auto_seeded_business:${template.templateId}:${request.nowMs}`],
      autoPosted: true,
      source: "economy_auto_seed",
    };
    result.next.postings[jobId] = posting;
    result.next.issuerOpenJobIds[issuerKey] = [
      ...(result.next.issuerOpenJobIds[issuerKey] ?? []),
      jobId,
    ];
    result.next.audit.push({
      id: `${request.requestId}:${jobId}`,
      atMs: request.nowMs,
      actorId: request.actorId,
      kind: "job_auto_seeded",
      jobId,
      boardId: board.boardId,
      issuerKind: "business",
      issuerId: business.businessId,
      amountGold: -rewardGold,
      reason: template.templateId,
    });
    result.touched.add("jobs_board_posting");
    result.touched.add("jobs_board_business_auto_seeded");
    result.touched.add("economy_business_bank");
    result.shared.add(sharedBoardKey(board.boardId));
    result.shared.add(sharedJobKey(jobId));
    result.shared.add(`harthmere:economy:business:${business.businessId}`);
    produced += 1;
  }
}

// HARTHMERE_JOBS_BOARD_AUTO_POSTING_V141:
// Generate up to `HARTHMERE_JOBS_BOARD_AUTO_SEED_MAX_PER_TICK_V141` new auto
// postings on the target board so the board stays around
// `HARTHMERE_JOBS_BOARD_AUTO_SEED_TARGET_OPEN_V141` open auto jobs. Picks
// templates deterministically from `request.nowMs` so the same tick on the
// same board produces the same output (testable). Skips boards that don't
// accept the template's kind. Escrow comes from the issuing town/guild —
// auto-posted town/business/guild jobs pre-commit the reward gold via the
// new posting's `escrowGold` field; the existing complete/cancel flow then
// pays it out or refunds it.
function economyAutoSeedJobs(
  result: MutableJobsResult,
  request: HarthmereJobsBoardMutationRequestV1,
  context: HarthmereJobsBoardMutationContextV1,
) {
  const boardId = request.boardId ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1;
  const board = result.next.boards[boardId];
  if (!board) {
    reject(result, "jobs_board_rejected:unknown_board");
    return;
  }
  expireStaleAutoPostingsForBoardV1(result, request, boardId);
  const outpost = businessOutpostForJobsBoardIdV1(boardId);
  if (outpost) {
    economyAutoSeedBusinessOutpostStarterJob(result, request, board, outpost);
    return;
  }
  economyAutoSeedProductionBusinessJobs(result, request, board);
  const openAuto = countOpenAutoPostings(result.next, boardId);
  const slotsToFill = Math.max(
    0,
    Math.min(
      HARTHMERE_JOBS_BOARD_AUTO_SEED_MAX_PER_TICK_V141,
      HARTHMERE_JOBS_BOARD_AUTO_SEED_TARGET_OPEN_V141 - openAuto,
    ),
  );
  if (slotsToFill === 0) {
    result.touched.add("jobs_board_auto_seed_noop");
    return;
  }
  // HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN_V141:
  // Mix `request.nowMs` with the board id so the same tick on different
  // boards still produces different template draws — otherwise both boards
  // would surface the same Mucker hunt slot when ticked at the same time.
  let boardSeed = 0;
  for (let i = 0; i < boardId.length; i += 1) {
    boardSeed = (boardSeed * 31 + boardId.charCodeAt(i)) | 0;
  }
  const rng = autoSeedRngV141((request.nowMs ^ boardSeed) >>> 0);
  const templates = HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES_V141.filter((tpl) =>
    board.acceptedKinds.includes(tpl.kind) &&
    templateBoardScopeMatches(tpl, boardId) &&
    harthmereAutoSeedTemplateRequirementsObtainableV1(tpl.requirements),
  );
  if (templates.length === 0) {
    result.touched.add("jobs_board_auto_seed_no_templates");
    return;
  }
  const exoticMatterTemplates =
    boardId === HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID_V141
      ? templates.filter((template) =>
          isHarthmereExoticMatterMiningTemplateIdV1(template.templateId)
        )
      : [];
  const shouldPrimeExoticMatterMining =
    exoticMatterTemplates.length > 0 &&
    !hasOpenExoticMatterMiningJobV1(result.next, boardId);

  // Pick distinct template ids per tick when possible so the board feels
  // varied. When the target slot count exceeds the template count, repeats
  // are allowed (still bounded by per-issuer cap below).
  const usedTemplateIds = new Set<string>();
  let produced = 0;
  let attempts = 0;
  while (produced < slotsToFill && attempts < slotsToFill * 6) {
    attempts += 1;
    const templatePool =
      shouldPrimeExoticMatterMining && produced === 0
        ? exoticMatterTemplates
        : templates;
    const template = templatePool[Math.floor(rng() * templatePool.length)];
    if (!template) break;
    if (usedTemplateIds.has(template.templateId) && usedTemplateIds.size < templates.length) {
      continue;
    }
    const issuerKey = `${template.issuerKind}:${template.issuerId}`;
    const issuerOpen = result.next.issuerOpenJobIds[issuerKey]?.length ?? 0;
    if (issuerOpen >= HARTHMERE_JOBS_BOARD_MAX_ACTIVE_POSTINGS_PER_ISSUER_V1) {
      continue;
    }

    const rewardSpan = template.rewardGold.max - template.rewardGold.min;
    const rewardGold = Math.max(
      HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD_V1,
      Math.min(
        HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD_V1,
        Math.round(template.rewardGold.min + rng() * Math.max(0, rewardSpan)),
      ),
    );
    // HARTHMERE_JOBS_BOARD_AUTO_POSTING_V141:
    // For business-issued auto jobs, we must actually debit the business's
    // treasury or skip the template. Town/guild/NPC issuers have no real
    // treasury yet (matches existing complete-job behaviour for those
    // issuer kinds), so we accept the pre-committed escrow as a sanctioned
    // faucet for v141. When town/guild treasuries land, this branch is the
    // single place to wire them up.
    if (template.issuerKind === "business") {
      const business = result.economy?.businesses?.[template.issuerId];
      if (!business || business.balanceGold < rewardGold) {
        continue;
      }
      business.balanceGold -= rewardGold;
      result.touched.add("economy_business_bank");
      result.shared.add(`harthmere:economy:business:${business.businessId}`);
    }
    let jobId = `${HARTHMERE_JOBS_BOARD_AUTO_SEED_ISSUER_PREFIX_V141}${result.next.nextJobNumber++}`;
    while (result.next.postings[jobId]) {
      jobId = `${HARTHMERE_JOBS_BOARD_AUTO_SEED_ISSUER_PREFIX_V141}${result.next.nextJobNumber++}`;
    }
    const flags: string[] = [];
    if (hasSuspiciousText(`${template.title} ${template.description}`)) {
      flags.push("suspicious_text");
    }
    const posting: HarthmereJobsBoardPostingV1 = {
      jobId,
      boardId,
      issuerKind: template.issuerKind,
      issuerId: template.issuerId,
      title: template.title,
      description: template.description,
      kind: template.kind,
      requirements: template.requirements.map((req) => ({ ...req })),
      templateId: template.templateId,
      rewardGold,
      escrowGold: rewardGold,
      reputationDelta: Math.max(1, Math.round(rewardGold / 100)),
      status: "open",
      townId: board.townId,
      regionId: board.regionId,
      createdAtMs: request.nowMs,
      deadlineAtMs: request.nowMs + HARTHMERE_JOBS_BOARD_AUTO_SEED_DEADLINE_MS_V141,
      failurePenaltyGold: Math.round(rewardGold * 0.1),
      requiresFieldWork: template.requiresFieldWork,
      mapMarkerId: template.mapMarkerId,
      targetId: template.targetId,
      abuseFlags: flags,
      logs: [
        `auto_seeded:${template.templateId}:${request.nowMs}`,
      ],
      autoPosted: true,
      source: "economy_auto_seed",
      partyRecommended: template.partyRecommended,
      partyMinSize: template.partyMinSize,
      monsterId: template.monsterId,
      monsterTier: template.monsterTier,
      monsterPowerLevel: template.monsterPowerLevel,
      lootHint: template.lootHint ? [...template.lootHint] : undefined,
    };
    result.next.postings[jobId] = posting;
    result.next.issuerOpenJobIds[issuerKey] = [
      ...(result.next.issuerOpenJobIds[issuerKey] ?? []),
      jobId,
    ];
    usedTemplateIds.add(template.templateId);
    produced += 1;

    // Audit and shared-state markers — same shape as player-posted jobs so
    // downstream consumers (UI live snapshot, audit log readers) work
    // identically for auto-posted jobs.
    result.next.audit.push({
      id: `${request.requestId}:${jobId}`,
      atMs: request.nowMs,
      actorId: request.actorId,
      kind: "job_auto_seeded",
      jobId,
      boardId,
      issuerKind: template.issuerKind,
      issuerId: template.issuerId,
      amountGold: -rewardGold,
      reason: template.monsterId ? `monster_hunt:${template.monsterId}` : template.templateId,
    });
    result.touched.add("jobs_board_posting");
    result.shared.add(sharedBoardKey(boardId));
    result.shared.add(sharedJobKey(jobId));
  }
  if (produced > 0) {
    result.touched.add("jobs_board_auto_seeded");
  }
  void context;
}

export function reduceHarthmereJobsBoardMutationV1(
  state: HarthmereJobsBoardStateV1,
  request: HarthmereJobsBoardMutationRequestV1,
  context: HarthmereJobsBoardMutationContextV1,
): HarthmereJobsBoardMutationResultV1 {
  const result = makeResult(state, context);
  switch (request.operation) {
    case "create_job_posting":
      createJobPosting(result, request, context);
      break;
    case "accept_job":
      acceptJobPosting(result, request, context);
      break;
    case "complete_job":
      completeJobPosting(result, request, context);
      break;
    case "complete_job_quest":
      completeJobQuest(result, request, context);
      break;
    case "cancel_job":
      cancelJobPosting(result, request, context);
      break;
    case "expire_jobs":
      expireJobs(result, request, context);
      break;
    case "economy_auto_seed_jobs":
      economyAutoSeedJobs(result, request, context);
      break;
    default:
      reject(result, `jobs_board_rejected:unsupported_operation:${request.operation}`);
  }
  return {
    jobsBoard: result.next,
    inventoryGoldDelta: result.goldDelta,
    inventoryItemDeltas: result.itemDeltas,
    collectibleRewardIds: result.collectibleRewardIds,
    economy: result.economy,
    warnings: result.warnings,
    touchedModels: Array.from(result.touched),
    sharedStateKeys: Array.from(result.shared),
  };
}

export function createHarthmereJobsBoardClientSnapshotV1(state: HarthmereJobsBoardStateV1, actorId: string) {
  return createHarthmereJobsBoardClientSnapshotAtTimeV1(state, actorId, Date.now());
}

export function createHarthmereJobsBoardClientSnapshotAtTimeV1(
  state: HarthmereJobsBoardStateV1,
  actorId: string,
  nowMs: number,
) {
  const postings = Object.values(state.postings);
  const myPostedJobs = postings.filter((job) => job.issuerKind === "player" && job.issuerId === actorId);
  const myAcceptedJobs = postings.filter((job) => job.acceptedByActorId === actorId);
  const myTodos = Object.values(state.todos).filter((todo) => todo.actorId === actorId);
  return {
    version: state.version,
    actorId,
    boards: state.boards,
    defaultBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
    openJobs: postings.filter(
      (job) => job.status === "open" && job.deadlineAtMs > nowMs
    ),
    activeJobs: postings.filter((job) => job.status === "active"),
    myPostedJobs,
    myAcceptedJobs,
    myTodos,
    audit: state.audit.slice(-100),
    cooldown: state.actorCooldowns[actorId] ?? { abuseScore: 0 },
    safety: {
      minRewardGold: HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD_V1,
      maxRewardGold: HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD_V1,
      maxActivePostingsPerIssuer: HARTHMERE_JOBS_BOARD_MAX_ACTIVE_POSTINGS_PER_ISSUER_V1,
      maxActiveAcceptedPerSeeker: HARTHMERE_JOBS_BOARD_MAX_ACTIVE_ACCEPTED_PER_SEEKER_V1,
      requiresPhysicalBoardInteraction: true,
    },
  };
}
