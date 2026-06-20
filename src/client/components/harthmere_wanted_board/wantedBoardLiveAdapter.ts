import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_JOB_KIND_LABELS,
  displayNameForHarthmereJobsBoard,
  harthmereJobsBoardMutationUrl,
  type HarthmereJobsBoardLawCrimeRecord,
  type HarthmereJobsBoardPosting,
  type HarthmereJobsBoardSnapshot,
} from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";
import { fetchHarthmereLiveWithTimeout } from "@/client/components/harthmere_live_fetch";
import { formatHarthmereJobTimeRemaining } from "@/shared/harthmere/mmo_jobs_board_authority";
import { HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS } from "@/shared/harthmere/jobs_board_muck_bounty_targets";
import { HARTHMERE_TOWN_LAW_RULES } from "@/shared/harthmere/town_law";

export const HARTHMERE_WANTED_BOARD_VERSION =
  "harthmere-wanted-board" as const;

export type HarthmereWantedBoardNoticeSource =
  | "jobs_board"
  | "law_system"
  | "muck_watchlist";

export interface HarthmereWantedBoardNotice {
  noticeId: string;
  source: HarthmereWantedBoardNoticeSource;
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

export interface HarthmereWantedBoardLawPanel {
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

export interface HarthmereWantedBoardView {
  version: typeof HARTHMERE_WANTED_BOARD_VERSION;
  boardId: string;
  boardName: string;
  openNotices: HarthmereWantedBoardNotice[];
  myNotices: HarthmereWantedBoardNotice[];
  lawNotices: HarthmereWantedBoardNotice[];
  watchlistNotices: HarthmereWantedBoardNotice[];
  law: HarthmereWantedBoardLawPanel;
  totals: {
    open: number;
    mine: number;
    law: number;
    watchlist: number;
    rewardGold: number;
  };
}

const WANTED_JOB_TEXT_RE =
  /\b(wanted|bount(?:y|ies)|warrant|hunt|muck|mucker|hex|patrol|outlaw|bandit|guard|security|threat|monster)\b/i;

function jobTargetLabel(job: HarthmereJobsBoardPosting) {
  return (
    job.requirements.find((req) => req.targetName)?.targetName ??
    job.targetId ??
    job.requirements.find((req) => req.targetId)?.targetId ??
    job.requirements.find((req) => req.mapMarkerId)?.mapMarkerId
  );
}

function jobMarkerId(job: HarthmereJobsBoardPosting) {
  return (
    job.mapMarkerId ??
    job.requirements.find((req) => req.mapMarkerId)?.mapMarkerId ??
    job.requirements.find((req) => req.targetId)?.targetId
  );
}

export function isHarthmereWantedBoardJob(
  job: HarthmereJobsBoardPosting | undefined
) {
  if (!job) return false;
  const auto = job as HarthmereJobsBoardPosting & {
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
  return WANTED_JOB_TEXT_RE.test(
    `${job.title} ${job.description} ${job.kind} ${requirementsText}`
  );
}

function noticeFromJob(input: {
  job: HarthmereJobsBoardPosting;
  snapshot: HarthmereJobsBoardSnapshot;
  nowMs: number;
  mine?: boolean;
}): HarthmereWantedBoardNotice {
  const { job, snapshot, nowMs } = input;
  const board = snapshot.boards[job.boardId];
  const targetLabel = jobTargetLabel(job);
  const markerId = jobMarkerId(job);
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
    boardName: displayNameForHarthmereJobsBoard(board),
    title: job.title,
    subtitle: targetLabel
      ? `${HARTHMERE_JOBS_BOARD_JOB_KIND_LABELS[job.kind]} · ${targetLabel}`
      : HARTHMERE_JOBS_BOARD_JOB_KIND_LABELS[job.kind],
    description: job.description,
    rewardGold: Math.max(0, Math.trunc(Number(job.rewardGold) || 0)),
    status: job.status,
    targetId: job.targetId,
    markerId,
    targetLabel,
    kindLabel: HARTHMERE_JOBS_BOARD_JOB_KIND_LABELS[job.kind],
    timeRemaining: formatHarthmereJobTimeRemaining(
      job.deadlineAtMs,
      nowMs
    ),
    canAccept: job.status === "open",
    canComplete: job.status === "active",
    warning,
  };
}

function titleCase(value: string) {
  return String(value || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function noticeFromLawRecord(
  record: HarthmereJobsBoardLawCrimeRecord,
  actorId: string
): HarthmereWantedBoardNotice {
  const ownRecord = record.actorId === actorId;
  const kind = titleCase(record.kind);
  const target = record.targetId || record.locationId || record.zoneId;
  return {
    noticeId: `law:${record.id}`,
    source: "law_system",
    crimeId: record.id,
    title: `${kind} Warrant`,
    subtitle: `${record.factionId} · ${titleCase(record.status)}`,
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

function watchlistNoticeForTarget(
  target: (typeof HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS)[number],
  coveredTargetIds: Set<string>,
  coveredMarkerIds: Set<string>
): HarthmereWantedBoardNotice | undefined {
  if (coveredTargetIds.has(target.targetId) || coveredMarkerIds.has(target.markerId)) {
    return undefined;
  }
  return {
    noticeId: `watch:${target.targetId}`,
    source: "muck_watchlist",
    title: target.label,
    subtitle: `${titleCase(target.monsterTier)} ${titleCase(target.monsterId)}`,
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

function defaultLawPanel(): HarthmereWantedBoardLawPanel {
  return {
    legal: 0,
    likeability: 0,
    notoriety: 0,
    finesGold: 0,
    activeBountyGold: 0,
    myActiveBountyGold: 0,
    publicFlags: [],
    guidance: [
      HARTHMERE_TOWN_LAW_RULES.warnings,
      HARTHMERE_TOWN_LAW_RULES.trespass,
      HARTHMERE_TOWN_LAW_RULES.criminal,
    ],
  };
}

function lawPanelFromSnapshot(
  snapshot: HarthmereJobsBoardSnapshot
): HarthmereWantedBoardLawPanel {
  const law = snapshot.lawSummary;
  if (!law) return defaultLawPanel();
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
      HARTHMERE_TOWN_LAW_RULES.warnings,
      HARTHMERE_TOWN_LAW_RULES.trespass,
      HARTHMERE_TOWN_LAW_RULES.temple,
      HARTHMERE_TOWN_LAW_RULES.criminal,
    ],
  };
}

export function buildHarthmereWantedBoardView(
  snapshot: HarthmereJobsBoardSnapshot,
  boardId = snapshot.defaultBoardId || HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  nowMs = Date.now()
): HarthmereWantedBoardView {
  const board = snapshot.boards[boardId] ?? snapshot.boards[snapshot.defaultBoardId];
  const wantedOpenJobs = snapshot.openJobs.filter(isHarthmereWantedBoardJob);
  const myWantedJobs = snapshot.myAcceptedJobs.filter(isHarthmereWantedBoardJob);
  const openNotices = wantedOpenJobs
    .map((job) => noticeFromJob({ job, snapshot, nowMs }))
    .sort(
      (a, b) =>
        b.rewardGold - a.rewardGold ||
        String(a.timeRemaining ?? "").localeCompare(String(b.timeRemaining ?? ""))
    );
  const myNotices = myWantedJobs
    .map((job) => noticeFromJob({ job, snapshot, nowMs, mine: true }))
    .sort((a, b) => b.rewardGold - a.rewardGold);
  const lawNotices = (snapshot.lawSummary?.activeBounties ?? [])
    .map((record) => noticeFromLawRecord(record, snapshot.actorId))
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
  const watchlistNotices = HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS.map(
    (target) => watchlistNoticeForTarget(target, coveredTargetIds, coveredMarkerIds)
  ).filter((notice): notice is HarthmereWantedBoardNotice => Boolean(notice));
  return {
    version: HARTHMERE_WANTED_BOARD_VERSION,
    boardId,
    boardName: board
      ? displayNameForHarthmereJobsBoard(board)
      : "Wanted Board",
    openNotices,
    myNotices,
    lawNotices,
    watchlistNotices,
    law: lawPanelFromSnapshot(snapshot),
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

function harthmereWantedBoardMutationHeaders(search?: string) {
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

export async function submitHarthmereWantedBoardClearBounty(options: {
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
  const response = await fetchHarthmereLiveWithTimeout(
    fetchImpl,
    harthmereJobsBoardMutationUrl(options.locationSearch),
    {
      method: "POST",
      credentials: "same-origin",
      headers: harthmereWantedBoardMutationHeaders(options.locationSearch),
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
