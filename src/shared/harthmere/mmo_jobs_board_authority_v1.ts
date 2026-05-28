/*
 * mmo_jobs_board_authority_v1.ts
 *
 * Server-authoritative universal jobs board for Harthmere.
 * The board is a physical Grove notice board. Posting, accepting, cancelling,
 * and turning in jobs require the actor to be at the board; accepted jobs become
 * quest-board todos / map-marker records for seekers. Runtime state starts empty:
 * the board registry is static world configuration, not dummy job data.
 */

import type {
  HarthmereEconomyBusinessRecordV1,
  HarthmereEconomyBusinessTypeIdV1,
  HarthmereProductionEconomyStateV1,
} from "./mmo_economy_authority_v1";

export const HARTHMERE_JOBS_BOARD_AUTHORITY_VERSION_V1 = "harthmere-jobs-board-authority-v1" as const;
export const HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1 = "harthmere_grove_market_jobs_board" as const;
export const HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_VOXEL_V1 = "public/assets/harthmere/vox/props/itch_voxel_asset_pack/Blacksmith Sign.vox" as const;
export const HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_MARKER_ID_V1 = "harthmere_market_posting_board" as const;
export const HARTHMERE_JOBS_BOARD_MAX_ACTIVE_POSTINGS_PER_ISSUER_V1 = 12;
export const HARTHMERE_JOBS_BOARD_MAX_ACTIVE_ACCEPTED_PER_SEEKER_V1 = 6;
export const HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD_V1 = 5;
export const HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD_V1 = 5000;
export const HARTHMERE_JOBS_BOARD_MAX_DURATION_MS_V1 = 30 * 24 * 60 * 60 * 1000;
export const HARTHMERE_JOBS_BOARD_POST_COOLDOWN_MS_V1 = 10 * 1000;
export const HARTHMERE_JOBS_BOARD_ACCEPT_COOLDOWN_MS_V1 = 3 * 1000;
export const HARTHMERE_JOBS_BOARD_MAX_LOGS_V1 = 300;

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
  rewardGold: number;
  escrowGold: number;
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
  rewardGold?: number;
  deadlineAtMs?: number;
  townId?: string;
  regionId?: string;
  mapMarkerId?: string;
  targetId?: string;
  requiresFieldWork?: boolean;
  completionItemDeltas?: Record<string, number>;
  completionNote?: string;
}

export interface HarthmereJobsBoardMutationContextV1 {
  actorGold: number;
  actorInventoryItems: Record<string, number>;
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
  warnings: string[];
  touched: Set<string>;
  shared: Set<string>;
};

export const HARTHMERE_JOBS_BOARD_LOCATIONS_V1: Record<string, HarthmereJobsBoardRecordV1> = {
  [HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1]: {
    boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
    displayName: "Harthmere Grove Jobs Board",
    townId: "harthmere_grove",
    regionId: "harthmere_grove_region",
    markerId: HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_MARKER_ID_V1,
    location: {
      x: 482,
      y: 66,
      z: -198,
      radius: 7,
      district: "Market Square",
      landmarkId: HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_MARKER_ID_V1,
      voxelAssetHint: HARTHMERE_JOBS_BOARD_GROVE_MARKET_BOARD_VOXEL_V1,
    },
    acceptedKinds: ["gather", "delivery", "repair", "cleanup", "hunt", "escort", "craft", "medical", "exploration", "construction", "security", "service"],
    requiresPhysicalInteraction: true,
    createdAtMs: 0,
  },
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

function chargeEscrow(result: MutableJobsResult, request: HarthmereJobsBoardMutationRequestV1, context: HarthmereJobsBoardMutationContextV1, issuerKind: HarthmereJobsBoardIssuerKindV1, issuerId: string, rewardGold: number) {
  if (issuerKind === "player") {
    if (context.actorGold + result.goldDelta < rewardGold) return reject(result, "jobs_board_rejected:escrow_gold_required");
    result.goldDelta -= rewardGold;
    return;
  }
  if (issuerKind === "business") {
    const business = result.economy?.businesses?.[issuerId];
    if (!business || business.balanceGold < rewardGold) return reject(result, "jobs_board_rejected:business_escrow_gold_required");
    business.balanceGold -= rewardGold;
    result.touched.add("economy_business_bank");
    result.shared.add(`harthmere:economy:business:${business.businessId}`);
    return;
  }
  // Guild/town/NPC postings can be backed by their own treasury systems later. For now
  // they are only allowed through explicit permission callbacks and are audit logged.
}

function refundEscrow(result: MutableJobsResult, job: HarthmereJobsBoardPostingV1, request: HarthmereJobsBoardMutationRequestV1) {
  if (job.escrowGold <= 0) return;
  if (job.issuerKind === "player" && job.issuerId === request.actorId) result.goldDelta += job.escrowGold;
  if (job.issuerKind === "business") {
    const business = result.economy?.businesses?.[job.issuerId];
    if (business) business.balanceGold += job.escrowGold;
    result.touched.add("economy_business_bank");
  }
  job.escrowGold = 0;
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
  const rewardGold = positiveInt(request.rewardGold, 0);
  if (rewardGold < HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD_V1) return reject(result, "jobs_board_rejected:reward_too_low");
  if (rewardGold > HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD_V1) return reject(result, "jobs_board_rejected:reward_too_high");
  const deadlineAtMs = request.deadlineAtMs ?? request.nowMs + 7 * 24 * 60 * 60 * 1000;
  if (deadlineAtMs <= request.nowMs || deadlineAtMs - request.nowMs > HARTHMERE_JOBS_BOARD_MAX_DURATION_MS_V1) return reject(result, "jobs_board_rejected:invalid_deadline");
  const kind = request.kind ?? "service";
  if (!board.acceptedKinds.includes(kind)) return reject(result, "jobs_board_rejected:unsupported_job_kind");
  const title = sanitizeText(request.title, "Work Needed", 100);
  const description = sanitizeText(request.description, "See the board notice for details.", 360);
  const requirements = normalizeRequirements(request.requirements);
  if (!requirements.length) return reject(result, "jobs_board_rejected:requirements_required");
  const flags: string[] = [];
  if (hasSuspiciousText(`${title} ${description}`)) flags.push("suspicious_text");
  const activeIssuerJobs = openJobIdsForIssuer(result.next, issuer.issuerKind, issuer.issuerId);
  if (activeIssuerJobs.length >= HARTHMERE_JOBS_BOARD_MAX_ACTIVE_POSTINGS_PER_ISSUER_V1) return reject(result, "jobs_board_rejected:issuer_posting_limit");
  chargeEscrow(result, request, context, issuer.issuerKind, issuer.issuerId, rewardGold);
  if (result.warnings.length) return;
  const jobId = `harthmere_job_${result.next.nextJobNumber++}`;
  const firstMarker = request.mapMarkerId ?? requirements.find((req) => req.mapMarkerId)?.mapMarkerId ?? requirements.find((req) => req.targetId)?.targetId;
  const targetId = request.targetId ?? requirements.find((req) => req.targetId)?.targetId;
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
    rewardGold,
    escrowGold: rewardGold,
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
  actorHasCompletionRequirements(job, request, context, result);
  if (result.warnings.length) return;
  for (const req of job.requirements) {
    if (req.itemId) recordItemDelta(result.itemDeltas, req.itemId, -positiveInt(req.count, 1));
  }
  result.goldDelta += job.escrowGold;
  job.escrowGold = 0;
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
    case "cancel_job":
      cancelJobPosting(result, request, context);
      break;
    case "expire_jobs":
      expireJobs(result, request, context);
      break;
    default:
      reject(result, `jobs_board_rejected:unsupported_operation:${request.operation}`);
  }
  return {
    jobsBoard: result.next,
    inventoryGoldDelta: result.goldDelta,
    inventoryItemDeltas: result.itemDeltas,
    economy: result.economy,
    warnings: result.warnings,
    touchedModels: Array.from(result.touched),
    sharedStateKeys: Array.from(result.shared),
  };
}

export function createHarthmereJobsBoardClientSnapshotV1(state: HarthmereJobsBoardStateV1, actorId: string) {
  const postings = Object.values(state.postings);
  const myPostedJobs = postings.filter((job) => job.issuerKind === "player" && job.issuerId === actorId);
  const myAcceptedJobs = postings.filter((job) => job.acceptedByActorId === actorId);
  const myTodos = Object.values(state.todos).filter((todo) => todo.actorId === actorId);
  return {
    version: state.version,
    actorId,
    boards: state.boards,
    defaultBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
    openJobs: postings.filter((job) => job.status === "open"),
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
