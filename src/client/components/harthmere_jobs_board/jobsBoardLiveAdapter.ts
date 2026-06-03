import {
  HARTHMERE_BUSINESS_OUTPOSTS_V1,
  harthmereBusinessOutpostJobsBoardPositionV1,
} from "../../../shared/harthmere/business_customer_simulator_v1";
import { completeHarthmereDailyTaskV1 } from "@/client/components/challenges/harthmereDailyTasks";
import { fetchHarthmereLiveWithTimeoutV1 } from "@/client/components/harthmere_live_fetch";

export const HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1 =
  "harthmere_grove_market_jobs_board" as const;
export const HARTHMERE_JOBS_BOARD_GROVE_MARKET_MARKER_ID_V1 =
  "harthmere_market_posting_board" as const;
export const HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145 = 3.25;
export const HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT_V1 =
  "biomes:harthmere-jobs-board-state-updated-v1" as const;

const HARTHMERE_BUSINESS_OUTPOST_PHYSICAL_JOB_BOARDS_V1 =
  HARTHMERE_BUSINESS_OUTPOSTS_V1.map((outpost) => {
    const position = harthmereBusinessOutpostJobsBoardPositionV1(outpost);
    return {
      boardId: `${outpost.outpostId}_jobs_board`,
      displayName: `${outpost.displayName} Jobs Board`,
      position,
      radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
    };
  });

export const HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS_V141 = [
  {
    boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
    displayName: "Jobs Board",
    position: { x: 501.99486179104775, y: 70, z: -132.00350672753194 },
    radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
  },
  {
    boardId: "harthmere_town_market_jobs_board",
    displayName: "Harthmere Jobs Board",
    position: { x: 1046, y: 65, z: -202 },
    radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
  },
  ...HARTHMERE_BUSINESS_OUTPOST_PHYSICAL_JOB_BOARDS_V1,
] as const;

export type HarthmereJobsBoardPointV146 = { x: number; y?: number; z: number };

export function normalizeHarthmereJobsBoardPointV146(
  value: unknown
): HarthmereJobsBoardPointV146 | undefined {
  const parse = (
    xValue: unknown,
    yValue: unknown,
    zValue: unknown
  ): HarthmereJobsBoardPointV146 | undefined => {
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
    return normalizeHarthmereJobsBoardPointV146(record.v);
  }
  return parse(record.x, record.y, record.z);
}

export function nearestHarthmereJobsBoardPhysicalPromptV141(
  playerPosition: HarthmereJobsBoardPointV146 | undefined
) {
  if (!playerPosition) return undefined;
  let best:
    | (typeof HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS_V141)[number]
    | undefined;
  let bestDistance = Infinity;
  for (const board of HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS_V141) {
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

export type HarthmereJobsBoardStatusV1 =
  | "open"
  | "active"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export interface HarthmereJobsBoardPostingV1 {
  jobId: string;
  boardId: string;
  issuerKind: "player" | "business" | "guild" | "town" | "npc";
  issuerId: string;
  title: string;
  description: string;
  kind: HarthmereJobsBoardJobKindV1;
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
  status: HarthmereJobsBoardStatusV1;
  townId: string;
  regionId: string;
  createdAtMs: number;
  deadlineAtMs: number;
  acceptedByActorId?: string;
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

export interface HarthmereJobsBoardRecordV1 {
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
  acceptedKinds: HarthmereJobsBoardJobKindV1[];
  requiresPhysicalInteraction: true;
}

export interface HarthmereJobsBoardSnapshotV1 {
  version: string;
  actorId: string;
  boards: Record<string, HarthmereJobsBoardRecordV1>;
  defaultBoardId: string;
  openJobs: HarthmereJobsBoardPostingV1[];
  activeJobs: HarthmereJobsBoardPostingV1[];
  myPostedJobs: HarthmereJobsBoardPostingV1[];
  myAcceptedJobs: HarthmereJobsBoardPostingV1[];
  myTodos: HarthmereJobsBoardTodoV1[];
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
}

export interface HarthmereJobsBoardWorldContextV1 {
  nearbyBoardId?: string;
  interactionTargetId?: string;
  playerPosition?: { x: number; y: number; z: number };
}

export const HARTHMERE_JOBS_BOARD_JOB_KIND_LABELS_V1: Record<
  HarthmereJobsBoardJobKindV1,
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

export function normalizeHarthmereJobsBoardSnapshotV1(
  raw: any
): HarthmereJobsBoardSnapshotV1 {
  return {
    version: String(raw?.version ?? "harthmere-jobs-board-authority-v1"),
    actorId: String(raw?.actorId ?? ""),
    boards: { ...(raw?.boards ?? {}) },
    defaultBoardId: String(
      raw?.defaultBoardId ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1
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
  };
}

export function dispatchHarthmereJobsBoardStateUpdatedV1(
  snapshot: HarthmereJobsBoardSnapshotV1
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_JOBS_BOARD_STATE_UPDATED_EVENT_V1, {
      detail: { jobsBoardState: snapshot },
    })
  );
}

export function displayNameForHarthmereJobsBoardV145(
  board: Pick<HarthmereJobsBoardRecordV1, "boardId" | "displayName"> | undefined
) {
  if (!board) return "Jobs Board";
  if (
    board.boardId === HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1 ||
    /^harthmere grove jobs board$/i.test(board.displayName) ||
    /^grove jobs board$/i.test(board.displayName)
  ) {
    return "Jobs Board";
  }
  return board.displayName;
}

export function isHarthmereJobsBoardAvailableV1(
  snapshot: HarthmereJobsBoardSnapshotV1,
  world: HarthmereJobsBoardWorldContextV1
) {
  const boardId = nearestPhysicalHarthmereJobsBoardIdV141(snapshot, world);
  return !!boardId && !!snapshot.boards[boardId];
}

// HARTHMERE_JOBS_BOARD_PROXIMITY_GATE_V141:
// Return the boardId the player is physically near, or undefined if none.
// "Near" means: explicit `nearbyBoardId` set, OR `playerPosition` within the
// board's `location.radius`. Used by the UI to gate panel-open requests so
// players can only browse jobs from the physical board, not from anywhere
// in BiomesUI.
export function nearestPhysicalHarthmereJobsBoardIdV141(
  snapshot: HarthmereJobsBoardSnapshotV1 | undefined,
  world: HarthmereJobsBoardWorldContextV1
): string | undefined {
  if (!snapshot) return undefined;
  if (world.nearbyBoardId && snapshot.boards[world.nearbyBoardId]) {
    return world.nearbyBoardId;
  }
  if (world.interactionTargetId && snapshot.boards[world.interactionTargetId]) {
    return world.interactionTargetId;
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

export interface HarthmereJobsBoardWayfindingHintV141 {
  boardId: string;
  displayName: string;
  district: string;
  position: { x: number; y: number; z: number };
  approxDistanceMeters: number;
}

// HARTHMERE_JOBS_BOARD_PROXIMITY_GATE_V141:
// When the player tries to open the panel from far away, give them a list of
// the boards sorted by distance so the UI can say "Go to the Grove Jobs
// Board, 240m north" instead of just refusing.
export function listHarthmereJobsBoardWayfindingHintsV141(
  snapshot: HarthmereJobsBoardSnapshotV1 | undefined,
  world: HarthmereJobsBoardWorldContextV1
): HarthmereJobsBoardWayfindingHintV141[] {
  if (!snapshot) return [];
  const player = world.playerPosition;
  return Object.values(snapshot.boards)
    .map((board) => ({
      boardId: board.boardId,
      displayName: displayNameForHarthmereJobsBoardV145(board),
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

export function getHarthmereJobsBoardPromptV1(
  snapshot: HarthmereJobsBoardSnapshotV1,
  world: HarthmereJobsBoardWorldContextV1
) {
  const boardId = nearestPhysicalHarthmereJobsBoardIdV141(snapshot, world);
  if (!boardId || !snapshot.boards[boardId]) return undefined;
  const board = snapshot.boards[boardId];
  return {
    boardId,
    title: displayNameForHarthmereJobsBoardV145(board),
    subtitle: "Press E to post work, accept jobs, and turn in completed tasks.",
    actionLabel: "Open Jobs Board",
    key: "E",
    markerId: board.markerId,
  };
}

export function getHarthmereJobsBoardTabsV1(
  snapshot: HarthmereJobsBoardSnapshotV1
) {
  return [
    { id: "available", label: "Available", count: snapshot.openJobs.length },
    { id: "accepted", label: "My Jobs", count: snapshot.myAcceptedJobs.length },
    { id: "posted", label: "Posted", count: snapshot.myPostedJobs.length },
    { id: "post", label: "Post Job", count: 0 },
    { id: "safety", label: "Safety", count: snapshot.cooldown.abuseScore },
  ];
}

export function getHarthmereAvailableJobsPanelV1(
  snapshot: HarthmereJobsBoardSnapshotV1,
  boardId = snapshot.defaultBoardId
) {
  return snapshot.openJobs
    .filter((job) => job.boardId === boardId)
    .sort(
      (a, b) => b.rewardGold - a.rewardGold || a.deadlineAtMs - b.deadlineAtMs
    )
    .map((job) => ({
      jobId: job.jobId,
      title: job.title,
      kindLabel: HARTHMERE_JOBS_BOARD_JOB_KIND_LABELS_V1[job.kind],
      rewardGold: job.rewardGold,
      deadlineAtMs: job.deadlineAtMs,
      issuerKind: job.issuerKind,
      requiresFieldWork: job.requiresFieldWork,
      targetLabel:
        job.requirements.find((req) => req.targetName)?.targetName ??
        job.targetId,
      warning: job.abuseFlags.length ? "Flagged for review" : undefined,
    }));
}

export function getHarthmereMyJobsPanelV1(
  snapshot: HarthmereJobsBoardSnapshotV1
) {
  return snapshot.myAcceptedJobs.map((job) => ({
    jobId: job.jobId,
    title: job.title,
    status: job.status,
    rewardGold: job.rewardGold,
    todo: snapshot.myTodos.find((todo) => todo.jobId === job.jobId),
    mapMarkerId: job.mapMarkerId,
    canComplete:
      job.status === "active" &&
      snapshot.myTodos.find((todo) => todo.jobId === job.jobId)?.status ===
        "completed",
  }));
}

export function getHarthmerePostedJobsPanelV1(
  snapshot: HarthmereJobsBoardSnapshotV1
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

export function getHarthmereJobsBoardSafetyPanelV1(
  snapshot: HarthmereJobsBoardSnapshotV1
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

export function harthmereJobsBoardStateUrlV146(search?: string) {
  const rawSearch =
    search ?? (typeof window !== "undefined" ? window.location.search : "");
  const params = new URLSearchParams(rawSearch);
  const installId = params.get("install_id") ?? params.get("installId");
  const endpoint = "/api/harthmere/live_mode_jobs_board_state";
  return installId
    ? `${endpoint}?install_id=${encodeURIComponent(installId)}`
    : endpoint;
}

export function harthmereJobsBoardMutationUrlV151(search?: string) {
  const rawSearch =
    search ?? (typeof window !== "undefined" ? window.location.search : "");
  const params = new URLSearchParams(rawSearch);
  const installId = params.get("install_id") ?? params.get("installId");
  const endpoint = "/api/harthmere/live_mode";
  return installId
    ? `${endpoint}?install_id=${encodeURIComponent(installId)}`
    : endpoint;
}

function harthmereJobsBoardMutationHeadersV151(search?: string) {
  const rawSearch =
    search ?? (typeof window !== "undefined" ? window.location.search : "");
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

export async function fetchHarthmereJobsBoardStateV1(
  fetchImpl: typeof fetch = fetch
) {
  const response = await fetchHarthmereLiveWithTimeoutV1(
    fetchImpl,
    harthmereJobsBoardStateUrlV146(),
    {
      method: "GET",
      credentials: "same-origin",
    }
  );
  if (!response.ok)
    throw new Error(`Jobs board state request failed: ${response.status}`);
  const json = await response.json();
  if (!json?.ok) throw new Error("Jobs board state request was rejected");
  const snapshot = normalizeHarthmereJobsBoardSnapshotV1(json.jobsBoardState);
  dispatchHarthmereJobsBoardStateUpdatedV1(snapshot);
  return snapshot;
}

export async function submitHarthmereJobsBoardMutationV1(
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
    String(payload.boardId ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1);
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
  const response = await fetchHarthmereLiveWithTimeoutV1(
    fetchImpl,
    harthmereJobsBoardMutationUrlV151(options.locationSearch),
    {
      method: "POST",
      credentials: "same-origin",
      headers: harthmereJobsBoardMutationHeadersV151(options.locationSearch),
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
  const snapshot = normalizeHarthmereJobsBoardSnapshotV1(
    json.jobsBoardState ?? json.economyState?.jobsBoardState ?? {}
  );
  dispatchHarthmereJobsBoardStateUpdatedV1(snapshot);
  return snapshot;
}

export async function submitHarthmereDailyTaskCompletedV1(
  activityId: string,
  options: { fetchImpl?: typeof fetch; requestId?: string } = {}
) {
  return completeHarthmereDailyTaskV1(activityId as any, options);
}

export function buildHarthmereJobsBoardPostPayloadV1(input: {
  templateId?: string;
  boardId?: string;
  issuerKind?: "player" | "business" | "guild" | "town" | "npc";
  issuerId?: string;
  businessId?: string;
  title: string;
  description: string;
  kind: HarthmereJobsBoardJobKindV1;
  requirements: HarthmereJobsBoardPostingV1["requirements"];
  rewardGold: number;
  rewardItems?: Array<{ itemId: string; count: number }>;
  rewardCollectibleIds?: string[];
  deadlineAtMs: number;
  requiresFieldWork?: boolean;
  mapMarkerId?: string;
  targetId?: string;
}) {
  return {
    boardId: input.boardId ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
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

export function createHarthmereJobsBoardAdapterV1(
  fetchImpl: typeof fetch = fetch
) {
  return {
    fetchState: () => fetchHarthmereJobsBoardStateV1(fetchImpl),
    completeDailyTask: (activityId: string, requestId?: string) =>
      submitHarthmereDailyTaskCompletedV1(activityId, { fetchImpl, requestId }),
    postJob: (payload: Record<string, unknown>, requestId?: string) =>
      submitHarthmereJobsBoardMutationV1("create_job_posting", payload, {
        fetchImpl,
        requestId,
      }),
    acceptJob: (
      jobId: string,
      boardId: string = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      requestId?: string
    ) =>
      submitHarthmereJobsBoardMutationV1(
        "accept_job",
        { jobId, boardId },
        { fetchImpl, requestId, boardId }
      ),
    completeJob: (
      jobId: string,
      boardId: string = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      requestId?: string
    ) =>
      submitHarthmereJobsBoardMutationV1(
        "complete_job",
        { jobId, boardId },
        { fetchImpl, requestId, boardId }
      ),
    cancelJob: (
      jobId: string,
      boardId: string = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
      requestId?: string
    ) =>
      submitHarthmereJobsBoardMutationV1(
        "cancel_job",
        { jobId, boardId },
        { fetchImpl, requestId, boardId }
      ),
  };
}
