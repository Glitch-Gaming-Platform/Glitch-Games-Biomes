export const HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1 = "harthmere_grove_market_jobs_board" as const;
export const HARTHMERE_JOBS_BOARD_GROVE_MARKET_MARKER_ID_V1 = "harthmere_market_posting_board" as const;

export const HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS_V141 = [
  {
    boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
    displayName: "Grove Jobs Board",
    position: { x: 501.59, y: 70, z: -133.35 },
    radius: 12,
  },
  {
    boardId: "harthmere_town_market_jobs_board",
    displayName: "Harthmere Jobs Board",
    position: { x: 1046, y: 66, z: -202 },
    radius: 9,
  },
] as const;

export function nearestHarthmereJobsBoardPhysicalPromptV141(
  playerPosition: { x: number; y?: number; z: number } | undefined,
) {
  if (!playerPosition) return undefined;
  let best: (typeof HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS_V141)[number] | undefined;
  let bestDistance = Infinity;
  for (const board of HARTHMERE_JOBS_BOARD_PHYSICAL_BOARDS_V141) {
    const distance = Math.hypot(board.position.x - playerPosition.x, board.position.z - playerPosition.z);
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

export type HarthmereJobsBoardStatusV1 = "open" | "active" | "completed" | "failed" | "cancelled" | "expired";

export interface HarthmereJobsBoardPostingV1 {
  jobId: string;
  boardId: string;
  issuerKind: "player" | "business" | "guild" | "town" | "npc";
  issuerId: string;
  title: string;
  description: string;
  kind: HarthmereJobsBoardJobKindV1;
  requirements: Array<{ itemId?: string; count?: number; serviceKind?: string; serviceUnits?: number; targetId?: string; targetName?: string; mapMarkerId?: string }>;
  rewardGold: number;
  escrowGold: number;
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
  location: { x: number; y: number; z: number; radius: number; district: string; landmarkId: string; voxelAssetHint?: string };
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
  cooldown: { lastPostAtMs?: number; lastAcceptAtMs?: number; abuseScore: number };
  safety: {
    minRewardGold: number;
    maxRewardGold: number;
    maxActivePostingsPerIssuer: number;
    maxActiveAcceptedPerSeeker: number;
    requiresPhysicalBoardInteraction: true;
  };
}

export interface HarthmereJobsBoardWorldContextV1 {
  nearbyBoardId?: string;
  interactionTargetId?: string;
  playerPosition?: { x: number; y: number; z: number };
}

export const HARTHMERE_JOBS_BOARD_JOB_KIND_LABELS_V1: Record<HarthmereJobsBoardJobKindV1, string> = {
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

export function normalizeHarthmereJobsBoardSnapshotV1(raw: any): HarthmereJobsBoardSnapshotV1 {
  return {
    version: String(raw?.version ?? "harthmere-jobs-board-authority-v1"),
    actorId: String(raw?.actorId ?? ""),
    boards: { ...(raw?.boards ?? {}) },
    defaultBoardId: String(raw?.defaultBoardId ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1),
    openJobs: Array.isArray(raw?.openJobs) ? raw.openJobs : [],
    activeJobs: Array.isArray(raw?.activeJobs) ? raw.activeJobs : [],
    myPostedJobs: Array.isArray(raw?.myPostedJobs) ? raw.myPostedJobs : [],
    myAcceptedJobs: Array.isArray(raw?.myAcceptedJobs) ? raw.myAcceptedJobs : [],
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
  };
}

export function isHarthmereJobsBoardAvailableV1(snapshot: HarthmereJobsBoardSnapshotV1, world: HarthmereJobsBoardWorldContextV1) {
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
  world: HarthmereJobsBoardWorldContextV1,
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
  world: HarthmereJobsBoardWorldContextV1,
): HarthmereJobsBoardWayfindingHintV141[] {
  if (!snapshot) return [];
  const player = world.playerPosition;
  return Object.values(snapshot.boards)
    .map((board) => ({
      boardId: board.boardId,
      displayName: board.displayName,
      district: board.location.district,
      position: { x: board.location.x, y: board.location.y, z: board.location.z },
      approxDistanceMeters: player
        ? Math.round(Math.hypot(board.location.x - player.x, board.location.z - player.z))
        : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.approxDistanceMeters - b.approxDistanceMeters);
}

export function getHarthmereJobsBoardPromptV1(snapshot: HarthmereJobsBoardSnapshotV1, world: HarthmereJobsBoardWorldContextV1) {
  const boardId = nearestPhysicalHarthmereJobsBoardIdV141(snapshot, world);
  if (!boardId || !snapshot.boards[boardId]) return undefined;
  const board = snapshot.boards[boardId];
  return {
    boardId,
    title: board.displayName,
    subtitle: "Press E to post work, accept jobs, and turn in completed tasks.",
    actionLabel: "Open Jobs Board",
    key: "E",
    markerId: board.markerId,
  };
}

export function getHarthmereJobsBoardTabsV1(snapshot: HarthmereJobsBoardSnapshotV1) {
  return [
    { id: "available", label: "Available", count: snapshot.openJobs.length },
    { id: "accepted", label: "My Jobs", count: snapshot.myAcceptedJobs.length },
    { id: "posted", label: "Posted", count: snapshot.myPostedJobs.length },
    { id: "post", label: "Post Job", count: 0 },
    { id: "safety", label: "Safety", count: snapshot.cooldown.abuseScore },
  ];
}

export function getHarthmereAvailableJobsPanelV1(snapshot: HarthmereJobsBoardSnapshotV1, boardId = snapshot.defaultBoardId) {
  return snapshot.openJobs
    .filter((job) => job.boardId === boardId)
    .sort((a, b) => b.rewardGold - a.rewardGold || a.deadlineAtMs - b.deadlineAtMs)
    .map((job) => ({
      jobId: job.jobId,
      title: job.title,
      kindLabel: HARTHMERE_JOBS_BOARD_JOB_KIND_LABELS_V1[job.kind],
      rewardGold: job.rewardGold,
      deadlineAtMs: job.deadlineAtMs,
      issuerKind: job.issuerKind,
      requiresFieldWork: job.requiresFieldWork,
      targetLabel: job.requirements.find((req) => req.targetName)?.targetName ?? job.targetId,
      warning: job.abuseFlags.length ? "Flagged for review" : undefined,
    }));
}

export function getHarthmereMyJobsPanelV1(snapshot: HarthmereJobsBoardSnapshotV1) {
  return snapshot.myAcceptedJobs.map((job) => ({
    jobId: job.jobId,
    title: job.title,
    status: job.status,
    rewardGold: job.rewardGold,
    todo: snapshot.myTodos.find((todo) => todo.jobId === job.jobId),
    mapMarkerId: job.mapMarkerId,
    canComplete: job.status === "active",
  }));
}

export function getHarthmerePostedJobsPanelV1(snapshot: HarthmereJobsBoardSnapshotV1) {
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

export function getHarthmereJobsBoardSafetyPanelV1(snapshot: HarthmereJobsBoardSnapshotV1) {
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

export async function fetchHarthmereJobsBoardStateV1(fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl("/api/harthmere/live_mode_jobs_board_state", {
    method: "GET",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(`Jobs board state request failed: ${response.status}`);
  const json = await response.json();
  if (!json?.ok) throw new Error("Jobs board state request was rejected");
  return normalizeHarthmereJobsBoardSnapshotV1(json.jobsBoardState);
}

export async function submitHarthmereJobsBoardMutationV1(
  operation: string,
  payload: Record<string, unknown>,
  options: { fetchImpl?: typeof fetch; requestId?: string; boardId?: string } = {},
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestId = options.requestId ?? `jobs_board_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const boardId = options.boardId ?? String(payload.boardId ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1);
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
  const response = await fetchImpl("/api/harthmere/live_mode", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok || json?.ok === false) {
    throw new Error(json?.error ?? json?.validation?.warnings?.join(",") ?? "Jobs board mutation failed");
  }
  const warnings = json?.backendMutation?.warnings ?? [];
  const rejected = warnings.find((warning: string) => warning.startsWith("jobs_board_rejected:"));
  if (rejected) throw new Error(rejected);
  return normalizeHarthmereJobsBoardSnapshotV1(json.jobsBoardState ?? json.economyState?.jobsBoardState ?? {});
}

export async function submitHarthmereDailyTaskCompletedV1(
  activityId: string,
  options: { fetchImpl?: typeof fetch; requestId?: string } = {},
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestId = options.requestId ?? `jobs_board_daily_${activityId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const response = await fetchImpl("/api/harthmere/live_mode", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId,
      idempotencyKey: requestId,
      actionKind: "request_care_loop_action",
      subsystem: "care",
      actorEntityVersion: 1,
      zoneId: "the_grove",
      payload: {
        operation: "daily_task_completed",
        targetId: activityId,
      },
      clientClaims: {},
    }),
  });
  const json = await response.json();
  if (!response.ok || json?.ok === false) {
    throw new Error(json?.error ?? json?.validation?.errors?.join(",") ?? `daily_task_completion_failed:${activityId}`);
  }
  return json;
}

export function buildHarthmereJobsBoardPostPayloadV1(input: {
  boardId?: string;
  issuerKind?: "player" | "business" | "guild" | "town" | "npc";
  issuerId?: string;
  businessId?: string;
  title: string;
  description: string;
  kind: HarthmereJobsBoardJobKindV1;
  requirements: HarthmereJobsBoardPostingV1["requirements"];
  rewardGold: number;
  deadlineAtMs: number;
  requiresFieldWork?: boolean;
  mapMarkerId?: string;
  targetId?: string;
}) {
  return {
    boardId: input.boardId ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
    issuerKind: input.issuerKind ?? (input.businessId ? "business" : "player"),
    issuerId: input.issuerId,
    businessId: input.businessId,
    title: input.title,
    description: input.description,
    kind: input.kind,
    requirements: input.requirements,
    rewardGold: input.rewardGold,
    deadlineAtMs: input.deadlineAtMs,
    requiresFieldWork: input.requiresFieldWork,
    mapMarkerId: input.mapMarkerId,
    targetId: input.targetId,
  };
}

export function createHarthmereJobsBoardAdapterV1(fetchImpl: typeof fetch = fetch) {
  return {
    fetchState: () => fetchHarthmereJobsBoardStateV1(fetchImpl),
    completeDailyTask: (activityId: string, requestId?: string) => submitHarthmereDailyTaskCompletedV1(activityId, { fetchImpl, requestId }),
    postJob: (payload: Record<string, unknown>, requestId?: string) => submitHarthmereJobsBoardMutationV1("create_job_posting", payload, { fetchImpl, requestId }),
    acceptJob: (jobId: string, boardId: string = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1, requestId?: string) => submitHarthmereJobsBoardMutationV1("accept_job", { jobId, boardId }, { fetchImpl, requestId, boardId }),
    completeJob: (jobId: string, boardId: string = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1, requestId?: string) => submitHarthmereJobsBoardMutationV1("complete_job", { jobId, boardId }, { fetchImpl, requestId, boardId }),
    cancelJob: (jobId: string, boardId: string = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1, requestId?: string) => submitHarthmereJobsBoardMutationV1("cancel_job", { jobId, boardId }, { fetchImpl, requestId, boardId }),
  };
}
