import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  harthmereBusinessOutpostJobsBoardPosition,
} from "../../../shared/harthmere/business_customer_simulator";
import { formatHarthmereJobTimeRemaining } from "../../../shared/harthmere/mmo_jobs_board_authority";
import { completeHarthmereDailyTask } from "@/client/components/challenges/harthmereDailyTasks";
import { fetchHarthmereLiveWithTimeout } from "@/client/components/harthmere_live_fetch";
import { HARTHMERE_LIVE_INVENTORY_SYNC_EVENT } from "@/client/components/challenges/harthmereEvents";

export const HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID =
  "harthmere_grove_market_jobs_board" as const;
export const HARTHMERE_JOBS_BOARD_GROVE_MARKET_MARKER_ID =
  "harthmere_market_posting_board" as const;
export const HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS = 3.25;
export const HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT =
  "biomes:harthmere-jobs-board-state-updated" as const;

const HARTHMERE_BUSINESS_OUTPOST_PHYSICAL_JOB_BOARDS =
  HARTHMERE_BUSINESS_OUTPOSTS.map((outpost) => {
    const position = harthmereBusinessOutpostJobsBoardPosition(outpost);
    return {
      boardId: `${outpost.outpostId}_jobs_board`,
      displayName: `${outpost.displayName} Jobs Board`,
      position,
      radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
    };
  });

export const HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS = [
  {
    boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
    displayName: "Jobs Board",
    position: { x: 501.99486179104775, y: 70, z: -132.00350672753194 },
    radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
  },
  {
    boardId: "harthmere_town_market_jobs_board",
    displayName: "Harthmere Jobs Board",
    position: { x: 1046, y: 65, z: -202 },
    radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
  },
  ...HARTHMERE_BUSINESS_OUTPOST_PHYSICAL_JOB_BOARDS,
] as const;

export type HarthmereJobsBoardPoint = { x: number; y?: number; z: number };

export function normalizeHarthmereJobsBoardPoint(
  value: unknown
): HarthmereJobsBoardPoint | undefined {
  const parse = (
    xValue: unknown,
    yValue: unknown,
    zValue: unknown
  ): HarthmereJobsBoardPoint | undefined => {
    const x = Number(xValue);
    const y = Number(yValue);
    const z = Number(zValue);
    if (!Number.isFinite(x) || !Number.isFinite(z)) {
      return undefined;
    }
    return { x, y: Number.isFinite(y) ? y : undefined, z };
  };

  if (Array.isArray(value)) {
    return parse(value[0], value[1], value[2]);
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.v)) {
    return normalizeHarthmereJobsBoardPoint(record.v);
  }
  return parse(record.x, record.y, record.z);
}

export function nearestHarthmereJobsBoardPhysicalPrompt(
  playerPosition: HarthmereJobsBoardPoint | undefined
) {
  if (!playerPosition) return undefined;
  let best: (typeof HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS)[number] | undefined;
  let bestDistance = Infinity;
  for (const board of HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS) {
    const distance = Math.hypot(
      board.position.x - playerPosition.x,
      board.position.z - playerPosition.z
    );
    if (distance <= board.radius && distance < bestDistance) {
      best = board;
      bestDistance = distance;
    }
  }
  return best ? { ...best, distance: bestDistance } : undefined;
}

export type HarthmereJobsBoardJobKind =
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

export type HarthmereJobsBoardStatus =
  | "open"
  | "active"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export interface HarthmereJobsBoardPosting {
  jobId: string;
  boardId: string;
  issuerKind: "player" | "business" | "guild" | "town" | "npc";
  issuerId: string;
  title: string;
  description: string;
  kind: HarthmereJobsBoardJobKind;
  requirements: Array<{
    itemId?: string;
    count?: number;
    serviceKind?: string;
    serviceUnits?: number;
    targetId?: string;
    targetName?: string;
    mapMarkerId?: string;
  }>;
  templateId?: string;
  rewardGold: number;
  escrowGold: number;
  rewardItems?: Array<{ itemId: string; count: number }>;
  escrowItems?: Record<string, number>;
  rewardCollectibleIds?: string[];
  status: HarthmereJobsBoardStatus;
  townId: string;
  regionId: string;
  createdAtMs: number;
  deadlineAtMs: number;
  acceptedAtMs?: number;
  acceptedByActorId?: string;
  requiresFieldWork: boolean;
  mapMarkerId?: string;
  targetId?: string;
  abuseFlags: string[];
  logs: string[];
}

export interface HarthmereJobsBoardTodo {
  todoId: string;
  jobId: string;
  actorId: string;
  boardId: string;
  title: string;
  todoText: string;
  status: "active" | "completed" | "failed" | "cancelled" | "expired";
  kind: HarthmereJobsBoardJobKind;
  mapMarkerId?: string;
  targetId?: string;
  townId: string;
  regionId: string;
  createdAtMs: number;
  dueAtMs: number;
  questBoardTodo: true;
}

export interface HarthmereJobsBoardRecord {
  boardId: string;
  displayName: string;
  townId: string;
  regionId: string;
  markerId: string;
  location: {
    x: number;
    y: number;
    z: number;
    radius: number;
    district: string;
    landmarkId: string;
    voxelAssetHint?: string;
  };
  acceptedKinds: HarthmereJobsBoardJobKind[];
  requiresPhysicalInteraction: true;
}

export interface HarthmereJobsBoardLawCrimeRecord {
  id: string;
  actorId: string;
  kind: string;
  zoneId: string;
  factionId: string;
  locationId?: string;
  targetId?: string;
  restrictedAreaId?: string;
  resourceNodeId?: string;
  severity: number;
  valueGold: number;
  witnessLevel?: string;
  witnesses: number;
  detected: boolean;
  response: string;
  fineGold: number;
  bountyGold: number;
  status: string;
  evidenceExpiresAtMs: number;
  createdAtMs: number;
}

export interface HarthmereJobsBoardLawSummary {
  version: string;
  actorId: string;
  standing: {
    scopeId?: string;
    likeability: number;
    legal: number;
    notoriety: number;
    notorietyFloor?: number;
  };
  fines: Record<string, number>;
  flags: Record<string, boolean>;
  activeBounties: HarthmereJobsBoardLawCrimeRecord[];
  myActiveBounties: HarthmereJobsBoardLawCrimeRecord[];
  totalBountyGold: number;
  myTotalBountyGold: number;
  recentCrimeRecords: HarthmereJobsBoardLawCrimeRecord[];
  updatedAtMs?: number;
}

export interface HarthmereJobsBoardSnapshot {
  version: string;
  actorId: string;
  boards: Record<string, HarthmereJobsBoardRecord>;
  defaultBoardId: string;
  openJobs: HarthmereJobsBoardPosting[];
  activeJobs: HarthmereJobsBoardPosting[];
  myPostedJobs: HarthmereJobsBoardPosting[];
  myAcceptedJobs: HarthmereJobsBoardPosting[];
  myTodos: HarthmereJobsBoardTodo[];
  audit: unknown[];
  cooldown: {
    lastPostAtMs?: number;
    lastAcceptAtMs?: number;
    abuseScore: number;
  };
  safety: {
    minRewardGold: number;
    maxRewardGold: number;
    maxActivePostingsPerIssuer: number;
    maxActiveAcceptedPerSeeker: number;
    requiresPhysicalBoardInteraction: true;
  };
  walletGold?: number;
  inventoryItems?: Record<string, number>;
  discoveredCollectibles?: Record<string, number>;
  myBusinesses?: Array<{
    businessId: string;
    typeId: string;
    name: string;
    balanceGold: number;
    inventory?: Record<string, { itemId: string; count: number }>;
  }>;
  lawSummary?: HarthmereJobsBoardLawSummary;
}

function safeWhole(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : fallback;
}

function safeSignedNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeHarthmereJobsBoardLawCrimeRecord(
  raw: any
): HarthmereJobsBoardLawCrimeRecord {
  return {
    id: String(raw?.id ?? ""),
    actorId: String(raw?.actorId ?? ""),
    kind: String(raw?.kind ?? "unknown"),
    zoneId: String(raw?.zoneId ?? ""),
    factionId: String(raw?.factionId ?? "harthmere"),
    locationId:
      raw?.locationId === undefined ? undefined : String(raw.locationId),
    targetId: raw?.targetId === undefined ? undefined : String(raw.targetId),
    restrictedAreaId:
      raw?.restrictedAreaId === undefined
        ? undefined
        : String(raw.restrictedAreaId),
    resourceNodeId:
      raw?.resourceNodeId === undefined
        ? undefined
        : String(raw.resourceNodeId),
    severity: safeWhole(raw?.severity),
    valueGold: safeWhole(raw?.valueGold),
    witnessLevel:
      raw?.witnessLevel === undefined ? undefined : String(raw.witnessLevel),
    witnesses: safeWhole(raw?.witnesses),
    detected: Boolean(raw?.detected),
    response: String(raw?.response ?? ""),
    fineGold: safeWhole(raw?.fineGold),
    bountyGold: safeWhole(raw?.bountyGold),
    status: String(raw?.status ?? "recorded"),
    evidenceExpiresAtMs: safeWhole(raw?.evidenceExpiresAtMs),
    createdAtMs: safeWhole(raw?.createdAtMs),
  };
}

function normalizeHarthmereJobsBoardLawSummary(
  raw: any
): HarthmereJobsBoardLawSummary | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const standing = raw.standing ?? {};
  return {
    version: String(raw.version ?? "harthmere-jobs-board-law-summary"),
    actorId: String(raw.actorId ?? ""),
    standing: {
      scopeId:
        standing.scopeId === undefined ? undefined : String(standing.scopeId),
      likeability: Math.round(safeSignedNumber(standing.likeability)),
      legal: Math.round(safeSignedNumber(standing.legal)),
      notoriety: Math.round(safeSignedNumber(standing.notoriety)),
      notorietyFloor:
        standing.notorietyFloor === undefined
          ? undefined
          : Math.round(safeSignedNumber(standing.notorietyFloor)),
    },
    fines:
      raw.fines && typeof raw.fines === "object"
        ? Object.fromEntries(
            Object.entries(raw.fines)
              .map(
                ([factionId, value]) =>
                  [factionId, safeWhole(value)] as [string, number]
              )
              .filter(([, value]) => value > 0)
          )
        : {},
    flags:
      raw.flags && typeof raw.flags === "object"
        ? Object.fromEntries(
            Object.entries(raw.flags).map(([flagId, enabled]) => [
              flagId,
              Boolean(enabled),
            ])
          )
        : {},
    activeBounties: Array.isArray(raw.activeBounties)
      ? raw.activeBounties.map(normalizeHarthmereJobsBoardLawCrimeRecord)
      : [],
    myActiveBounties: Array.isArray(raw.myActiveBounties)
      ? raw.myActiveBounties.map(normalizeHarthmereJobsBoardLawCrimeRecord)
      : [],
    totalBountyGold: safeWhole(raw.totalBountyGold),
    myTotalBountyGold: safeWhole(raw.myTotalBountyGold),
    recentCrimeRecords: Array.isArray(raw.recentCrimeRecords)
      ? raw.recentCrimeRecords.map(normalizeHarthmereJobsBoardLawCrimeRecord)
      : [],
    updatedAtMs:
      raw.updatedAtMs === undefined ? undefined : safeWhole(raw.updatedAtMs),
  };
}

export interface HarthmereJobsBoardWorldContext {
  nearbyBoardId?: string;
  interactionTargetId?: string;
  playerPosition?: { x: number; y: number; z: number };
}

function normalizeJobsBoardPointForOpenContext(
  value: unknown
): { x: number; y: number; z: number } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const x = Number(record.x);
  const y = Number(record.y ?? 0);
  const z = Number(record.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return undefined;
  }
  return { x, y, z };
}

export function harthmereJobsBoardOpenContextFromInput(
  input: unknown
): HarthmereJobsBoardWorldContext | undefined {
  const detail =
    input && typeof input === "object" && "detail" in input
      ? (input as { detail?: unknown }).detail
      : input;
  if (!detail || typeof detail !== "object") return undefined;
  const record = detail as Record<string, unknown>;
  const nearbyBoardId =
    record.nearbyBoardId ?? record.boardId ?? record.interactionTargetId;
  const interactionTargetId =
    record.interactionTargetId ?? record.objectId ?? nearbyBoardId;
  const playerPosition = normalizeJobsBoardPointForOpenContext(
    record.playerPosition
  );
  if (!nearbyBoardId && !interactionTargetId && !playerPosition) {
    return undefined;
  }
  return {
    nearbyBoardId:
      nearbyBoardId === undefined ? undefined : String(nearbyBoardId),
    interactionTargetId:
      interactionTargetId === undefined
        ? undefined
        : String(interactionTargetId),
    playerPosition,
  };
}

export const HARTHMERE_JOBS_BOARD_JOB_KIND_LABELS: Record<
  HarthmereJobsBoardJobKind,
  string
> = {
  gather: "Gather",
  delivery: "Delivery",
  repair: "Repair",
  cleanup: "Cleanup",
  hunt: "Hunt",
  escort: "Escort",
  craft: "Craft",
  medical: "Medical",
  exploration: "Explore",
  construction: "Build",
  security: "Security",
  service: "Service",
};

export function normalizeHarthmereJobsBoardSnapshot(
  raw: any
): HarthmereJobsBoardSnapshot {
  return {
    version: String(raw?.version ?? "harthmere-jobs-board-authority"),
    actorId: String(raw?.actorId ?? ""),
    boards: { ...(raw?.boards ?? {}) },
    defaultBoardId: String(
      raw?.defaultBoardId ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID
    ),
    openJobs: Array.isArray(raw?.openJobs) ? raw.openJobs : [],
    activeJobs: Array.isArray(raw?.activeJobs) ? raw.activeJobs : [],
    myPostedJobs: Array.isArray(raw?.myPostedJobs) ? raw.myPostedJobs : [],
    myAcceptedJobs: Array.isArray(raw?.myAcceptedJobs)
      ? raw.myAcceptedJobs
      : [],
    myTodos: Array.isArray(raw?.myTodos) ? raw.myTodos : [],
    audit: Array.isArray(raw?.audit) ? raw.audit : [],
    cooldown: { abuseScore: 0, ...(raw?.cooldown ?? {}) },
    safety: {
      minRewardGold: 5,
      maxRewardGold: 5000,
      maxActivePostingsPerIssuer: 12,
      maxActiveAcceptedPerSeeker: 6,
      requiresPhysicalBoardInteraction: true,
      ...(raw?.safety ?? {}),
    },
    walletGold: Number.isFinite(Number(raw?.walletGold))
      ? Number(raw.walletGold)
      : undefined,
    inventoryItems:
      raw?.inventoryItems && typeof raw.inventoryItems === "object"
        ? { ...raw.inventoryItems }
        : undefined,
    discoveredCollectibles:
      raw?.discoveredCollectibles &&
      typeof raw.discoveredCollectibles === "object"
        ? { ...raw.discoveredCollectibles }
        : undefined,
    myBusinesses: Array.isArray(raw?.myBusinesses) ? raw.myBusinesses : [],
    lawSummary: normalizeHarthmereJobsBoardLawSummary(raw?.lawSummary),
  };
}

export function dispatchHarthmereJobsBoardStateUpdated(
  snapshot: HarthmereJobsBoardSnapshot
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT, {
      detail: { jobsBoardState: snapshot },
    })
  );
}

function dispatchHarthmereJobsBoardInventoryLootUpdated(response: any) {
  if (
    typeof window === "undefined" ||
    !response?.inventoryLootState ||
    typeof CustomEvent === "undefined"
  ) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_LIVE_INVENTORY_SYNC_EVENT, {
      detail: {
        body: response,
        inventoryLootState: response.inventoryLootState,
        playerStatusState: response.playerStatusState,
      },
    })
  );
}

export function displayNameForHarthmereJobsBoard(
  board: Pick<HarthmereJobsBoardRecord, "boardId" | "displayName"> | undefined
) {
  if (!board) return "Jobs Board";
  if (
    board.boardId === HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID ||
    /^harthmere grove jobs board$/i.test(board.displayName) ||
    /^grove jobs board$/i.test(board.displayName)
  ) {
    return "Jobs Board";
  }
  return board.displayName;
}

export function isHarthmereJobsBoardAvailable(
  snapshot: HarthmereJobsBoardSnapshot,
  world: HarthmereJobsBoardWorldContext
) {
  const boardId = nearestPhysicalHarthmereJobsBoardId(snapshot, world);
  return !!boardId && !!snapshot.boards[boardId];
}

function normalizeJobsBoardInteractionTargetId(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith("jobs_board_marker:")
    ? trimmed.slice("jobs_board_marker:".length)
    : trimmed;
}

// HARTHMERE_JOBS_BOARD_PROXIMITY_GATE:
// Return the boardId the player is physically near, or undefined if none.
// "Near" means: explicit `nearbyBoardId` set, OR `playerPosition` within the
// board's `location.radius`. Used by the UI to gate panel-open requests so
// players can only browse jobs from the physical board, not from anywhere
// in BiomesUI.
export function nearestPhysicalHarthmereJobsBoardId(
  snapshot: HarthmereJobsBoardSnapshot | undefined,
  world: HarthmereJobsBoardWorldContext
): string | undefined {
  if (!snapshot) return undefined;
  const nearbyBoardId = normalizeJobsBoardInteractionTargetId(
    world.nearbyBoardId
  );
  if (nearbyBoardId && snapshot.boards[nearbyBoardId]) {
    return nearbyBoardId;
  }
  const interactionTargetId = normalizeJobsBoardInteractionTargetId(
    world.interactionTargetId
  );
  if (interactionTargetId && snapshot.boards[interactionTargetId]) {
    return interactionTargetId;
  }
  if (interactionTargetId) {
    for (const board of Object.values(snapshot.boards)) {
      if (
        board.markerId === interactionTargetId ||
        board.location.landmarkId === interactionTargetId
      ) {
        return board.boardId;
      }
    }
  }
  const player = world.playerPosition;
  if (!player) return undefined;
  let bestId: string | undefined;
  let bestDist = Infinity;
  for (const board of Object.values(snapshot.boards)) {
    const dx = board.location.x - player.x;
    const dz = board.location.z - player.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= board.location.radius && distance < bestDist) {
      bestDist = distance;
      bestId = board.boardId;
    }
  }
  return bestId;
}

export interface HarthmereJobsBoardWayfindingHint {
  boardId: string;
  displayName: string;
  district: string;
  position: { x: number; y: number; z: number };
  approxDistanceMeters: number;
}

// HARTHMERE_JOBS_BOARD_PROXIMITY_GATE:
// When the player tries to open the panel from far away, give them a list of
// the boards sorted by distance so the UI can say "Go to the Grove Jobs
// Board, 240m north" instead of just refusing.
export function listHarthmereJobsBoardWayfindingHints(
  snapshot: HarthmereJobsBoardSnapshot | undefined,
  world: HarthmereJobsBoardWorldContext
): HarthmereJobsBoardWayfindingHint[] {
  if (!snapshot) return [];
  const player = world.playerPosition;
  return Object.values(snapshot.boards)
    .map((board) => ({
      boardId: board.boardId,
      displayName: displayNameForHarthmereJobsBoard(board),
      district: board.location.district,
      position: {
        x: board.location.x,
        y: board.location.y,
        z: board.location.z,
      },
      approxDistanceMeters: player
        ? Math.round(
            Math.hypot(board.location.x - player.x, board.location.z - player.z)
          )
        : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.approxDistanceMeters - b.approxDistanceMeters);
}

export function getHarthmereJobsBoardPrompt(
  snapshot: HarthmereJobsBoardSnapshot,
  world: HarthmereJobsBoardWorldContext
) {
  const boardId = nearestPhysicalHarthmereJobsBoardId(snapshot, world);
  if (!boardId || !snapshot.boards[boardId]) return undefined;
  const board = snapshot.boards[boardId];
  return {
    boardId,
    title: displayNameForHarthmereJobsBoard(board),
    subtitle: "Press E to post work, accept jobs, and turn in completed tasks.",
    actionLabel: "Open Jobs Board",
    key: "E",
    markerId: board.markerId,
  };
}

export function getHarthmereJobsBoardTabs(
  snapshot: HarthmereJobsBoardSnapshot
) {
  return [
    { id: "available", label: "Available", count: snapshot.openJobs.length },
    { id: "accepted", label: "My Jobs", count: snapshot.myAcceptedJobs.length },
    { id: "posted", label: "Posted", count: snapshot.myPostedJobs.length },
    { id: "post", label: "Post Job", count: 0 },
    { id: "safety", label: "Safety", count: snapshot.cooldown.abuseScore },
  ];
}

export function getHarthmereAvailableJobsPanel(
  snapshot: HarthmereJobsBoardSnapshot,
  boardId = snapshot.defaultBoardId,
  nowMs = Date.now()
) {
  return snapshot.openJobs
    .filter((job) => job.boardId === boardId)
    .sort(
      (a, b) => b.rewardGold - a.rewardGold || a.deadlineAtMs - b.deadlineAtMs
    )
    .map((job) => ({
      jobId: job.jobId,
      title: job.title,
      kindLabel: HARTHMERE_JOBS_BOARD_JOB_KIND_LABELS[job.kind],
      rewardGold: job.rewardGold,
      deadlineAtMs: job.deadlineAtMs,
      timeRemaining: formatHarthmereJobTimeRemaining(job.deadlineAtMs, nowMs),
      issuerKind: job.issuerKind,
      requiresFieldWork: job.requiresFieldWork,
      targetLabel:
        job.requirements.find((req) => req.targetName)?.targetName ??
        job.targetId,
      warning: job.abuseFlags.length ? "Flagged for review" : undefined,
    }));
}

export function getHarthmereMyJobsPanel(
  snapshot: HarthmereJobsBoardSnapshot,
  nowMs = Date.now()
) {
  return snapshot.myAcceptedJobs.map((job) => {
    const todo = snapshot.myTodos.find((entry) => entry.jobId === job.jobId);
    return {
      jobId: job.jobId,
      title: job.title,
      status: job.status,
      rewardGold: job.rewardGold,
      deadlineAtMs: job.deadlineAtMs,
      timeRemaining: formatHarthmereJobTimeRemaining(job.deadlineAtMs, nowMs),
      todo,
      todoStatus: todo?.status,
      questTodoId: todo?.todoId,
      mapMarkerId: job.mapMarkerId,
      // Enable the turn-in/complete action while the job is active and the
      // player still has a live (or already-verified) todo. The server is
      // authoritative: if requirements aren't met, complete_job_quest is
      // rejected and the payout step never runs, so this cannot pay early.
      canComplete:
        job.status === "active" &&
        (todo?.status === "active" || todo?.status === "completed"),
    };
  });
}

export function getHarthmerePostedJobsPanel(
  snapshot: HarthmereJobsBoardSnapshot
) {
  return snapshot.myPostedJobs.map((job) => ({
    jobId: job.jobId,
    title: job.title,
    status: job.status,
    rewardGold: job.rewardGold,
    acceptedByActorId: job.acceptedByActorId,
    escrowGold: job.escrowGold,
    canCancel: job.status === "open",
  }));
}

export function getHarthmereJobsBoardSafetyPanel(
  snapshot: HarthmereJobsBoardSnapshot
) {
  return {
    abuseScore: snapshot.cooldown.abuseScore,
    minRewardGold: snapshot.safety.minRewardGold,
    maxRewardGold: snapshot.safety.maxRewardGold,
    seekerLimit: snapshot.safety.maxActiveAcceptedPerSeeker,
    issuerLimit: snapshot.safety.maxActivePostingsPerIssuer,
    requiresBoard: snapshot.safety.requiresPhysicalBoardInteraction,
    guidance: [
      "Jobs require escrow before posting.",
      "Seekers cannot accept their own jobs.",
      "Accepted jobs become quest-board and map todos.",
      "Suspicious titles/descriptions are audit-flagged.",
    ],
  };
}

function harthmereJobsBoardLocationSearch(search?: string) {
  return (
    search ??
    (typeof window !== "undefined" ? window.location?.search ?? "" : "")
  );
}

export function harthmereJobsBoardStateUrl(search?: string) {
  const rawSearch = harthmereJobsBoardLocationSearch(search);
  const params = new URLSearchParams(rawSearch);
  const installId = params.get("install_id") ?? params.get("installId");
  const endpoint = "/api/harthmere/live_mode_jobs_board_state";
  return installId
    ? `${endpoint}?install_id=${encodeURIComponent(installId)}`
    : endpoint;
}

export function harthmereJobsBoardMutationUrl(search?: string) {
  const rawSearch = harthmereJobsBoardLocationSearch(search);
  const params = new URLSearchParams(rawSearch);
  const installId = params.get("install_id") ?? params.get("installId");
  const endpoint = "/api/harthmere/live_mode";
  return installId
    ? `${endpoint}?install_id=${encodeURIComponent(installId)}`
    : endpoint;
}

function harthmereJobsBoardMutationHeaders(search?: string) {
  const rawSearch = harthmereJobsBoardLocationSearch(search);
  const params = new URLSearchParams(rawSearch);
  const installId = params.get("install_id") ?? params.get("installId");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (installId) {
    headers["X-Glitch-Install-Id"] = installId;
  }
  return headers;
}

export async function fetchHarthmereJobsBoardState(
  fetchImpl: typeof fetch = fetch
) {
  const response = await fetchHarthmereLiveWithTimeout(
    fetchImpl,
    harthmereJobsBoardStateUrl(),
    {
      method: "GET",
      credentials: "same-origin",
    }
  );
  if (!response.ok)
    throw new Error(`Jobs board state request failed: ${response.status}`);
  const json = await response.json();
  if (!json?.ok) throw new Error("Jobs board state request was rejected");
  const snapshot = normalizeHarthmereJobsBoardSnapshot(json.jobsBoardState);
  dispatchHarthmereJobsBoardStateUpdated(snapshot);
  return snapshot;
}

export async function submitHarthmereJobsBoardMutation(
  operation: string,
  payload: Record<string, unknown>,
  options: {
    fetchImpl?: typeof fetch;
    requestId?: string;
    boardId?: string;
    locationSearch?: string;
  } = {}
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestId =
    options.requestId ??
    `jobs_board_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const boardId =
    options.boardId ??
    String(payload.boardId ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID);
  const body = {
    requestId,
    idempotencyKey: requestId,
    targetId: boardId,
    actionKind: "request_jobs_board_mutation",
    subsystem: "jobs",
    actorEntityVersion: 1,
    targetEntityVersion: 1,
    zoneId: "harthmere_grove",
    payload: {
      ...payload,
      boardId,
      interactionTargetId: boardId,
      operation,
    },
  };
  const response = await fetchHarthmereLiveWithTimeout(
    fetchImpl,
    harthmereJobsBoardMutationUrl(options.locationSearch),
    {
      method: "POST",
      credentials: "same-origin",
      headers: harthmereJobsBoardMutationHeaders(options.locationSearch),
      body: JSON.stringify(body),
    }
  );
  const json = await response.json();
  if (!response.ok || json?.ok === false) {
    const backendWarnings = Array.isArray(json?.backendMutation?.warnings)
      ? json.backendMutation.warnings.join(",")
      : undefined;
    throw new Error(
      json?.error ??
        json?.validation?.errors?.join(",") ??
        json?.validation?.warnings?.join(",") ??
        backendWarnings ??
        "Jobs board mutation failed"
    );
  }
  const warnings = json?.backendMutation?.warnings ?? [];
  const rejected = warnings.find((warning: string) =>
    warning.startsWith("jobs_board_rejected:")
  );
  if (rejected) throw new Error(rejected);
  const snapshot = normalizeHarthmereJobsBoardSnapshot(
    json.jobsBoardState ?? json.economyState?.jobsBoardState ?? {}
  );
  dispatchHarthmereJobsBoardStateUpdated(snapshot);
  dispatchHarthmereJobsBoardInventoryLootUpdated(json);
  return snapshot;
}

export async function submitHarthmereDailyTaskCompleted(
  activityId: string,
  options: { fetchImpl?: typeof fetch; requestId?: string } = {}
) {
  return completeHarthmereDailyTask(activityId as any, options);
}

export function buildHarthmereJobsBoardPostPayload(input: {
  templateId?: string;
  boardId?: string;
  issuerKind?: "player" | "business" | "guild" | "town" | "npc";
  issuerId?: string;
  businessId?: string;
  title: string;
  description: string;
  kind: HarthmereJobsBoardJobKind;
  requirements: HarthmereJobsBoardPosting["requirements"];
  rewardGold: number;
  rewardItems?: Array<{ itemId: string; count: number }>;
  rewardCollectibleIds?: string[];
  deadlineAtMs: number;
  requiresFieldWork?: boolean;
  mapMarkerId?: string;
  targetId?: string;
}) {
  return {
    boardId: input.boardId ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
    templateId: input.templateId,
    issuerKind: input.issuerKind ?? (input.businessId ? "business" : "player"),
    issuerId: input.issuerId,
    businessId: input.businessId,
    title: input.title,
    description: input.description,
    kind: input.kind,
    requirements: input.requirements,
    rewardGold: input.rewardGold,
    rewardItems: input.rewardItems,
    rewardCollectibleIds: input.rewardCollectibleIds,
    deadlineAtMs: input.deadlineAtMs,
    requiresFieldWork: input.requiresFieldWork,
    mapMarkerId: input.mapMarkerId,
    targetId: input.targetId,
  };
}

// HARTHMERE_JOBS_BOARD_COMPLETION_WIRING
// Completing a job is TWO server steps: `complete_job_quest` validates the work
// (the server consumes required items / checks the target) and marks the todo
// completed, then `complete_job` pays out the escrow. The client previously only
// ever sent `complete_job`, which the reducer rejects until the todo is
// `completed` -- so no job could ever be completed or paid. This plans the
// ordered steps to send based on the current todo status.
export function planHarthmereJobsBoardCompletionSteps(
  todoStatus: string | undefined
): Array<"complete_job_quest" | "complete_job"> {
  return todoStatus === "completed"
    ? ["complete_job"]
    : ["complete_job_quest", "complete_job"];
}

export function createHarthmereJobsBoardAdapter(
  fetchImpl: typeof fetch = fetch
) {
  return {
    fetchState: () => fetchHarthmereJobsBoardState(fetchImpl),
    completeDailyTask: (activityId: string, requestId?: string) =>
      submitHarthmereDailyTaskCompleted(activityId, { fetchImpl, requestId }),
    postJob: (payload: Record<string, unknown>, requestId?: string) =>
      submitHarthmereJobsBoardMutation("create_job_posting", payload, {
        fetchImpl,
        requestId,
      }),
    acceptJob: (
      jobId: string,
      boardId: string = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      requestId?: string
    ) =>
      submitHarthmereJobsBoardMutation(
        "accept_job",
        { jobId, boardId },
        { fetchImpl, requestId, boardId }
      ),
    completeJob: (
      jobId: string,
      boardId: string = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      requestId?: string
    ) =>
      submitHarthmereJobsBoardMutation(
        "complete_job",
        { jobId, boardId },
        { fetchImpl, requestId, boardId }
      ),
    // Mark the quest todo complete (server validates items/target, consumes
    // required items). Use before completeJob when the todo is not yet done.
    completeJobQuest: (
      jobId: string,
      boardId: string = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      evidence: {
        questTodoId?: string;
        completedTargetId?: string;
        completionItemDeltas?: Record<string, number>;
      } = {},
      requestId?: string
    ) =>
      submitHarthmereJobsBoardMutation(
        "complete_job_quest",
        { jobId, boardId, ...evidence },
        { fetchImpl, requestId, boardId }
      ),
    // Full completion: verify the work (consuming items / checking the target)
    // then claim the payout. Skips the verification step if the todo is already
    // completed. Throws (without paying) if verification is rejected.
    completeJobFully: async (
      jobId: string,
      boardId: string = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      options: {
        todoStatus?: string;
        questTodoId?: string;
        completedTargetId?: string;
        completionItemDeltas?: Record<string, number>;
        // HARTHMERE_REPAIR_TOOL_COMPLETION: the tool action the player used
        // to do the work (e.g. "repair"), set only when the matching tool was
        // equipped. The server rejects completion of a tool-gated requirement
        // unless this matches.
        usedToolAction?: string;
      } = {}
    ) => {
      const steps = planHarthmereJobsBoardCompletionSteps(options.todoStatus);
      let snapshot: HarthmereJobsBoardSnapshot | undefined;
      for (const step of steps) {
        const payload: Record<string, unknown> = { jobId, boardId };
        if (step === "complete_job_quest") {
          if (options.questTodoId) payload.questTodoId = options.questTodoId;
          if (options.completedTargetId) {
            payload.completedTargetId = options.completedTargetId;
          }
          if (options.completionItemDeltas) {
            payload.completionItemDeltas = options.completionItemDeltas;
          }
          if (options.usedToolAction) {
            payload.usedToolAction = options.usedToolAction;
          }
        }
        snapshot = await submitHarthmereJobsBoardMutation(step, payload, {
          fetchImpl,
          boardId,
        });
      }
      if (!snapshot) {
        // planHarthmereJobsBoardCompletionSteps always returns >=1 step, so
        // this is unreachable; it narrows the type and guards future changes.
        throw new Error("jobs_board_no_completion_step");
      }
      return snapshot;
    },
    cancelJob: (
      jobId: string,
      boardId: string = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
      requestId?: string
    ) =>
      submitHarthmereJobsBoardMutation(
        "cancel_job",
        { jobId, boardId },
        { fetchImpl, requestId, boardId }
      ),
  };
}
