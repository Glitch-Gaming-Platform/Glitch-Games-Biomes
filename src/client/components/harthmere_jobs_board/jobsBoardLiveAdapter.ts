export const HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1 = "harthmere_grove_market_jobs_board" as const;
export const HARTHMERE_JOBS_BOARD_GROVE_MARKET_MARKER_ID_V1 = "harthmere_market_posting_board" as const;

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
  const boardId = world.nearbyBoardId ?? world.interactionTargetId;
  return !!boardId && !!snapshot.boards[boardId];
}

export function getHarthmereJobsBoardPromptV1(snapshot: HarthmereJobsBoardSnapshotV1, world: HarthmereJobsBoardWorldContextV1) {
  const boardId = world.nearbyBoardId ?? world.interactionTargetId;
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
    postJob: (payload: Record<string, unknown>, requestId?: string) => submitHarthmereJobsBoardMutationV1("create_job_posting", payload, { fetchImpl, requestId }),
    acceptJob: (jobId: string, boardId = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1, requestId?: string) => submitHarthmereJobsBoardMutationV1("accept_job", { jobId, boardId }, { fetchImpl, requestId, boardId }),
    completeJob: (jobId: string, boardId = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1, requestId?: string) => submitHarthmereJobsBoardMutationV1("complete_job", { jobId, boardId }, { fetchImpl, requestId, boardId }),
    cancelJob: (jobId: string, boardId = HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1, requestId?: string) => submitHarthmereJobsBoardMutationV1("cancel_job", { jobId, boardId }, { fetchImpl, requestId, boardId }),
  };
}
