import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  HARTHMERE_JOBS_BOARD_JOB_KIND_LABELS_V1,
  displayNameForHarthmereJobsBoardV145,
  harthmereJobsBoardMutationUrlV151,
  type HarthmereJobsBoardLawCrimeRecordV1,
  type HarthmereJobsBoardPostingV1,
  type HarthmereJobsBoardSnapshotV1,
} from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";
import { fetchHarthmereLiveWithTimeoutV1 } from "@/client/components/harthmere_live_fetch";
import { formatHarthmereJobTimeRemainingV151 } from "@/shared/harthmere/mmo_jobs_board_authority_v1";
import { HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS_V1 } from "@/shared/harthmere/jobs_board_muck_bounty_targets_v1";
import { HARTHMERE_TOWN_LAW_RULES_V1 } from "@/shared/harthmere/town_law";

export const HARTHMERE_WANTED_BOARD_VERSION_V1 =
  "harthmere-wanted-board-v1" as const;

export type HarthmereWantedBoardNoticeSourceV1 =
  | "jobs_board"
  | "law_system"
  | "muck_watchlist";

export interface HarthmereWantedBoardNoticeV1 {
  noticeId: string;
  source: HarthmereWantedBoardNoticeSourceV1;
  title: string;
  subtitle: string;
  description: string;
  rewardGold: number;
  status: string;
  boardId?: string;
  boardName?: string;
  jobId?: string;
  crimeId?: string;
  targetId?: string;
  markerId?: string;
  targetLabel?: string;
  areaLabel?: string;
  kindLabel: string;
  timeRemaining?: string;
  canAccept: boolean;
  canComplete: boolean;
  canClear?: boolean;
  warning?: string;
}

export interface HarthmereWantedBoardLawPanelV1 {
  legal: number;
  likeability: number;
  notoriety: number;
  scopeId?: string;
  finesGold: number;
  activeBountyGold: number;
  myActiveBountyGold: number;
  publicFlags: string[];
  guidance: string[];
}

export interface HarthmereWantedBoardViewV1 {
  version: typeof HARTHMERE_WANTED_BOARD_VERSION_V1;
  boardId: string;
  boardName: string;
  openNotices: HarthmereWantedBoardNoticeV1[];
  myNotices: HarthmereWantedBoardNoticeV1[];
  lawNotices: HarthmereWantedBoardNoticeV1[];
  watchlistNotices: HarthmereWantedBoardNoticeV1[];
  law: HarthmereWantedBoardLawPanelV1;
  totals: {
    open: number;
    mine: number;
    law: number;
    watchlist: number;
    rewardGold: number;
  };
}

const WANTED_JOB_TEXT_RE_V1 =
  /\b(wanted|bount(?:y|ies)|warrant|hunt|muck|mucker|hex|patrol|outlaw|bandit|guard|security|threat|monster)\b/i;

function jobTargetLabelV1(job: HarthmereJobsBoardPostingV1) {
  return (
    job.requirements.find((req) => req.targetName)?.targetName ??
    job.targetId ??
    job.requirements.find((req) => req.targetId)?.targetId ??
    job.requirements.find((req) => req.mapMarkerId)?.mapMarkerId
  );
}

function jobMarkerIdV1(job: HarthmereJobsBoardPostingV1) {
  return (
    job.mapMarkerId ??
    job.requirements.find((req) => req.mapMarkerId)?.mapMarkerId ??
    job.requirements.find((req) => req.targetId)?.targetId
  );
}

export function isHarthmereWantedBoardJobV1(
  job: HarthmereJobsBoardPostingV1 | undefined
) {
  if (!job) return false;
  const auto = job as HarthmereJobsBoardPostingV1 & {
    monsterId?: string;
    monsterTier?: string;
    partyRecommended?: boolean;
  };
  if (job.kind === "hunt" || job.kind === "security") return true;
  if (auto.monsterId || auto.monsterTier || auto.partyRecommended) return true;
  const requirementsText = job.requirements
    .map((req) =>
      [req.targetId, req.targetName, req.mapMarkerId, req.serviceKind]
        .filter(Boolean)
        .join(" ")
    )
    .join(" ");
  return WANTED_JOB_TEXT_RE_V1.test(
    `${job.title} ${job.description} ${job.kind} ${requirementsText}`
  );
}

function noticeFromJobV1(input: {
  job: HarthmereJobsBoardPostingV1;
  snapshot: HarthmereJobsBoardSnapshotV1;
  nowMs: number;
  mine?: boolean;
}): HarthmereWantedBoardNoticeV1 {
  const { job, snapshot, nowMs } = input;
  const board = snapshot.boards[job.boardId];
  const targetLabel = jobTargetLabelV1(job);
  const markerId = jobMarkerIdV1(job);
  const warning = job.abuseFlags.length
    ? "This notice has audit flags."
    : (job as any).partyRecommended
    ? `Party recommended${(job as any).partyMinSize ? `: ${(job as any).partyMinSize}+` : ""}.`
    : undefined;
  return {
    noticeId: `job:${job.jobId}`,
    source: "jobs_board",
    jobId: job.jobId,
    boardId: job.boardId,
    boardName: displayNameForHarthmereJobsBoardV145(board),
    title: job.title,
    subtitle: targetLabel
      ? `${HARTHMERE_JOBS_BOARD_JOB_KIND_LABELS_V1[job.kind]} · ${targetLabel}`
      : HARTHMERE_JOBS_BOARD_JOB_KIND_LABELS_V1[job.kind],
    description: job.description,
    rewardGold: Math.max(0, Math.trunc(Number(job.rewardGold) || 0)),
    status: job.status,
    targetId: job.targetId,
    markerId,
    targetLabel,
    kindLabel: HARTHMERE_JOBS_BOARD_JOB_KIND_LABELS_V1[job.kind],
    timeRemaining: formatHarthmereJobTimeRemainingV151(
      job.deadlineAtMs,
      nowMs
    ),
    canAccept: job.status === "open",
    canComplete: job.status === "active",
    warning,
  };
}

function titleCaseV1(value: string) {
  return String(value || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function noticeFromLawRecordV1(
  record: HarthmereJobsBoardLawCrimeRecordV1,
  actorId: string
): HarthmereWantedBoardNoticeV1 {
  const ownRecord = record.actorId === actorId;
  const kind = titleCaseV1(record.kind);
  const target = record.targetId || record.locationId || record.zoneId;
  return {
    noticeId: `law:${record.id}`,
    source: "law_system",
    crimeId: record.id,
    title: `${kind} Warrant`,
    subtitle: `${record.factionId} · ${titleCaseV1(record.status)}`,
    description: target
      ? `${record.actorId} is wanted for ${kind.toLowerCase()} near ${target}.`
      : `${record.actorId} is wanted for ${kind.toLowerCase()}.`,
    rewardGold: record.bountyGold,
    status: record.status,
    targetId: record.targetId,
    areaLabel: record.zoneId,
    kindLabel: kind,
    canAccept: false,
    canComplete: false,
    canClear: ownRecord,
    warning: ownRecord
      ? "This is your active bounty. Clear it through the law system."
      : record.detected
      ? `Witnessed by ${record.witnesses || 1}.`
      : "Unconfirmed report.",
  };
}

function watchlistNoticeForTargetV1(
  target: (typeof HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS_V1)[number],
  coveredTargetIds: Set<string>,
  coveredMarkerIds: Set<string>
): HarthmereWantedBoardNoticeV1 | undefined {
  if (coveredTargetIds.has(target.targetId) || coveredMarkerIds.has(target.markerId)) {
    return undefined;
  }
  return {
    noticeId: `watch:${target.targetId}`,
    source: "muck_watchlist",
    title: target.label,
    subtitle: `${titleCaseV1(target.monsterTier)} ${titleCaseV1(target.monsterId)}`,
    description: `${target.targetName} has been sighted in ${target.areaLabel}. Watch for a live bounty posting before claiming a reward.`,
    rewardGold: 0,
    status: "watchlisted",
    targetId: target.targetId,
    markerId: target.markerId,
    targetLabel: target.targetName,
    areaLabel: target.areaLabel,
    kindLabel: "Watchlist",
    canAccept: false,
    canComplete: false,
    warning: "No active reward posting is attached yet.",
  };
}

function defaultLawPanelV1(): HarthmereWantedBoardLawPanelV1 {
  return {
    legal: 0,
    likeability: 0,
    notoriety: 0,
    finesGold: 0,
    activeBountyGold: 0,
    myActiveBountyGold: 0,
    publicFlags: [],
    guidance: [
      HARTHMERE_TOWN_LAW_RULES_V1.warnings,
      HARTHMERE_TOWN_LAW_RULES_V1.trespass,
      HARTHMERE_TOWN_LAW_RULES_V1.criminal,
    ],
  };
}

function lawPanelFromSnapshotV1(
  snapshot: HarthmereJobsBoardSnapshotV1
): HarthmereWantedBoardLawPanelV1 {
  const law = snapshot.lawSummary;
  if (!law) return defaultLawPanelV1();
  return {
    legal: law.standing.legal,
    likeability: law.standing.likeability,
    notoriety: law.standing.notoriety,
    scopeId: law.standing.scopeId,
    finesGold: Object.values(law.fines).reduce((sum, value) => sum + value, 0),
    activeBountyGold: law.totalBountyGold,
    myActiveBountyGold: law.myTotalBountyGold,
    publicFlags: Object.entries(law.flags)
      .filter(([, enabled]) => enabled)
      .map(([flag]) => flag)
      .sort(),
    guidance: [
      HARTHMERE_TOWN_LAW_RULES_V1.warnings,
      HARTHMERE_TOWN_LAW_RULES_V1.trespass,
      HARTHMERE_TOWN_LAW_RULES_V1.temple,
      HARTHMERE_TOWN_LAW_RULES_V1.criminal,
    ],
  };
}

export function buildHarthmereWantedBoardViewV1(
  snapshot: HarthmereJobsBoardSnapshotV1,
  boardId = snapshot.defaultBoardId || HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  nowMs = Date.now()
): HarthmereWantedBoardViewV1 {
  const board = snapshot.boards[boardId] ?? snapshot.boards[snapshot.defaultBoardId];
  const wantedOpenJobs = snapshot.openJobs.filter(isHarthmereWantedBoardJobV1);
  const myWantedJobs = snapshot.myAcceptedJobs.filter(isHarthmereWantedBoardJobV1);
  const openNotices = wantedOpenJobs
    .map((job) => noticeFromJobV1({ job, snapshot, nowMs }))
    .sort(
      (a, b) =>
        b.rewardGold - a.rewardGold ||
        String(a.timeRemaining ?? "").localeCompare(String(b.timeRemaining ?? ""))
    );
  const myNotices = myWantedJobs
    .map((job) => noticeFromJobV1({ job, snapshot, nowMs, mine: true }))
    .sort((a, b) => b.rewardGold - a.rewardGold);
  const lawNotices = (snapshot.lawSummary?.activeBounties ?? [])
    .map((record) => noticeFromLawRecordV1(record, snapshot.actorId))
    .sort((a, b) => b.rewardGold - a.rewardGold);
  const coveredTargetIds = new Set(
    [...openNotices, ...myNotices]
      .map((notice) => notice.targetId)
      .filter((value): value is string => Boolean(value))
  );
  const coveredMarkerIds = new Set(
    [...openNotices, ...myNotices]
      .map((notice) => notice.markerId)
      .filter((value): value is string => Boolean(value))
  );
  const watchlistNotices = HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS_V1.map(
    (target) => watchlistNoticeForTargetV1(target, coveredTargetIds, coveredMarkerIds)
  ).filter((notice): notice is HarthmereWantedBoardNoticeV1 => Boolean(notice));
  return {
    version: HARTHMERE_WANTED_BOARD_VERSION_V1,
    boardId,
    boardName: board
      ? displayNameForHarthmereJobsBoardV145(board)
      : "Wanted Board",
    openNotices,
    myNotices,
    lawNotices,
    watchlistNotices,
    law: lawPanelFromSnapshotV1(snapshot),
    totals: {
      open: openNotices.length,
      mine: myNotices.length,
      law: lawNotices.length,
      watchlist: watchlistNotices.length,
      rewardGold: [...openNotices, ...myNotices, ...lawNotices].reduce(
        (sum, notice) => sum + notice.rewardGold,
        0
      ),
    },
  };
}

function harthmereWantedBoardMutationHeadersV1(search?: string) {
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

export async function submitHarthmereWantedBoardClearBountyV1(options: {
  factionId?: string;
  fetchImpl?: typeof fetch;
  requestId?: string;
  locationSearch?: string;
} = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const factionId = options.factionId || "city_guard";
  const requestId =
    options.requestId ??
    `wanted_board_clear_bounty_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;
  const response = await fetchHarthmereLiveWithTimeoutV1(
    fetchImpl,
    harthmereJobsBoardMutationUrlV151(options.locationSearch),
    {
      method: "POST",
      credentials: "same-origin",
      headers: harthmereWantedBoardMutationHeadersV1(options.locationSearch),
      body: JSON.stringify({
        requestId,
        idempotencyKey: requestId,
        targetId: factionId,
        actionKind: "request_clear_bounty",
        subsystem: "law",
        actorEntityVersion: 1,
        targetEntityVersion: 1,
        zoneId: "harthmere_grove",
        payload: { factionId },
      }),
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
        "Clear bounty request failed"
    );
  }
  const warnings = json?.backendMutation?.warnings ?? [];
  const rejected = warnings.find((warning: string) =>
    warning.startsWith("clear_bounty_rejected:")
  );
  if (rejected) throw new Error(rejected);
  return json;
}
