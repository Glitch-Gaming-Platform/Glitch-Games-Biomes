import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  normalizeHarthmereJobsBoardSnapshotV1,
  type HarthmereJobsBoardSnapshotV1,
  type HarthmereJobsBoardTodoV1,
} from "../../harthmere_jobs_board/jobsBoardLiveAdapter";
import { harthmereJobsBoardQuestMarkerPositionForTodoV1 } from "@/shared/harthmere/jobs_board_quest_marker_positions_v1";
import { formatHarthmereJobTimeRemainingV151 } from "@/shared/harthmere/mmo_jobs_board_authority_v1";
import type { Vec3 } from "@/shared/math/types";
import type { MapTrackableQuest } from "../tabs/MapQuestsTab";

export const BIOMES_UI_JOBS_BOARD_ACCEPTED_JOB_MARKER_SOURCE_V1 =
  "jobs_board_accepted_job" as const;

export interface BiomesUIJobsBoardAcceptedJobLandmarkV1 {
  id: string;
  label: string;
  position: Vec3;
  kind: "objective";
  area: string;
  visibleOnWorldMap: true;
  visibleOnHudMap: true;
  active: true;
  description: string;
  source: typeof BIOMES_UI_JOBS_BOARD_ACCEPTED_JOB_MARKER_SOURCE_V1;
  jobsBoardTodoId: string;
  jobsBoardJobId: string;
  mapMarkerId: string;
  targetId?: string;
}

export interface BiomesUIJobsBoardMissionStepV1 {
  id: string;
  title: string;
  objective: string;
  done: boolean;
}

// HARTHMERE_JOBS_BOARD_KIND_LABEL_V1:
// Human-facing label per job kind so an accepted job reads as the work it
// actually is (a repair shows "Repair", a hunt shows "Hunt") instead of a
// generic "Accepted job N". This is the fix for the reported bug where a fence
// repair appeared indistinguishable from — and was eclipsed by — a kill quest.
const JOBS_BOARD_KIND_LABEL_V1: Record<string, string> = {
  gather: "Gather",
  delivery: "Delivery",
  repair: "Repair",
  cleanup: "Cleanup",
  hunt: "Hunt",
  escort: "Escort",
  craft: "Craft",
  medical: "Medical",
  exploration: "Exploration",
  construction: "Construction",
  security: "Security",
  service: "Service",
};

export function jobsBoardKindLabelV1(kind: string | undefined): string {
  if (!kind) return "Job";
  return JOBS_BOARD_KIND_LABEL_V1[kind] ?? "Job";
}

const JOBS_BOARD_FALLBACK_POSITION_V1: Vec3 = [
  501.99486179104775,
  71,
  -132.00350672753194,
];

function normalizeJobsBoardSnapshotForBiomesUIV1(
  raw: unknown
): HarthmereJobsBoardSnapshotV1 | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return normalizeHarthmereJobsBoardSnapshotV1(raw);
}

export const JOBS_BOARD_MARKER_ID_PREFIX_V1 = "jobs_board_marker:";

function jobsBoardTodoMarkerIdV1(todo: HarthmereJobsBoardTodoV1) {
  return `${JOBS_BOARD_MARKER_ID_PREFIX_V1}${todo.todoId}`;
}

// HARTHMERE_STALE_JOBS_BOARD_PIN_V151:
// A jobs-board active map pin must be dropped once its job is no longer active
// (completed or abandoned). Otherwise it keeps driving the HUD aid — and, with
// the world-beacon active-pin override, would keep suppressing other quest
// beacons — pointing the player at a job they already finished. Only clears a
// jobs-board pin (never a user-set vendor/property pin), and only against the
// list of CURRENTLY-active jobs-board marker ids.
export function shouldClearStaleJobsBoardPinV151(input: {
  activePinMarkerId: string | undefined;
  activeJobsBoardMarkerIds: readonly string[];
}): boolean {
  const id = input.activePinMarkerId;
  if (!id || !id.startsWith(JOBS_BOARD_MARKER_ID_PREFIX_V1)) {
    return false;
  }
  return !input.activeJobsBoardMarkerIds.includes(id);
}

function jobsBoardTodoQuestIdV1(todo: HarthmereJobsBoardTodoV1) {
  return `jobs_board:${todo.todoId}`;
}

function jobsBoardTodoFallbackPositionV1(
  snapshot: HarthmereJobsBoardSnapshotV1,
  todo: HarthmereJobsBoardTodoV1
): Vec3 {
  const board =
    snapshot.boards[todo.boardId] ??
    snapshot.boards[snapshot.defaultBoardId] ??
    snapshot.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1];
  const location = board?.location;
  const x = Number(location?.x);
  const y = Number(location?.y);
  const z = Number(location?.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return [...JOBS_BOARD_FALLBACK_POSITION_V1] as Vec3;
  }
  return [x, Number.isFinite(y) ? y + 1 : JOBS_BOARD_FALLBACK_POSITION_V1[1], z];
}

function jobsBoardTodoAreaV1(
  snapshot: HarthmereJobsBoardSnapshotV1,
  todo: HarthmereJobsBoardTodoV1
) {
  return (
    snapshot.boards[todo.boardId]?.location?.district ??
    todo.townId ??
    "Jobs Board"
  );
}

function jobsBoardTodoStatusToTrackableStatusV1(
  status: HarthmereJobsBoardTodoV1["status"]
): MapTrackableQuest["status"] | undefined {
  if (status === "active") return "active";
  if (status === "completed") return "completed";
  // Surface failed jobs in the tracker so the player sees the outcome (its map
  // markers already drop, since only active todos produce landmarks).
  if (status === "failed") return "failed";
  return undefined;
}

export function jobsBoardAcceptedJobLandmarksForBiomesUIV1(
  raw: unknown
): BiomesUIJobsBoardAcceptedJobLandmarkV1[] {
  const snapshot = normalizeJobsBoardSnapshotForBiomesUIV1(raw);
  if (!snapshot) return [];
  const jobsById = new Map(
    snapshot.myAcceptedJobs.map((job) => [job.jobId, job])
  );
  const seenTodoIds = new Set<string>();

  return snapshot.myTodos.flatMap((todo) => {
    if (todo.status !== "active" || seenTodoIds.has(todo.todoId)) {
      return [];
    }
    seenTodoIds.add(todo.todoId);
    const job = jobsById.get(todo.jobId);
    const marker = harthmereJobsBoardQuestMarkerPositionForTodoV1({
      mapMarkerId: todo.mapMarkerId ?? job?.mapMarkerId,
      targetId: todo.targetId ?? job?.targetId,
      fallbackPosition: jobsBoardTodoFallbackPositionV1(snapshot, todo),
    });
    return [
      {
        id: jobsBoardTodoMarkerIdV1(todo),
        label: todo.title || job?.title || "Accepted Job",
        position: marker.position,
        kind: "objective" as const,
        area: jobsBoardTodoAreaV1(snapshot, todo),
        visibleOnWorldMap: true as const,
        visibleOnHudMap: true as const,
        active: true as const,
        description:
          todo.todoText ||
          job?.description ||
          "Follow the job marker and complete the accepted board job.",
        source: BIOMES_UI_JOBS_BOARD_ACCEPTED_JOB_MARKER_SOURCE_V1,
        jobsBoardTodoId: todo.todoId,
        jobsBoardJobId: todo.jobId,
        mapMarkerId: marker.markerId,
        targetId: todo.targetId ?? job?.targetId,
      },
    ];
  });
}

export function jobsBoardTrackableQuestsForBiomesUIV1(
  raw: unknown,
  nowMs: number = Date.now()
): MapTrackableQuest[] {
  const snapshot = normalizeJobsBoardSnapshotForBiomesUIV1(raw);
  if (!snapshot) return [];
  const jobsById = new Map(
    snapshot.myAcceptedJobs.map((job) => [job.jobId, job])
  );
  const seenTodoIds = new Set<string>();

  return snapshot.myTodos.flatMap((todo) => {
    const status = jobsBoardTodoStatusToTrackableStatusV1(todo.status);
    if (!status || seenTodoIds.has(todo.todoId)) return [];
    seenTodoIds.add(todo.todoId);
    const job = jobsById.get(todo.jobId);
    const rewardGold = Number(job?.rewardGold ?? 0);
    return [
      {
        questId: jobsBoardTodoQuestIdV1(todo),
        title: todo.title || job?.title || "Accepted Job",
        area: jobsBoardTodoAreaV1(snapshot, todo),
        status,
        firstMarkerId:
          status === "active" ? jobsBoardTodoMarkerIdV1(todo) : undefined,
        reward:
          Number.isFinite(rewardGold) && rewardGold > 0
            ? `${Math.trunc(rewardGold)} gold`
            : undefined,
        // The job's accept-window countdown (jobs are timed; quests are not).
        timeRemaining:
          status === "active"
            ? formatHarthmereJobTimeRemainingV151(todo.dueAtMs, nowMs)
            : undefined,
      },
    ];
  });
}

export function activeJobsBoardMissionStepsForBiomesUIV1(
  raw: unknown,
  nowMs: number = Date.now()
): BiomesUIJobsBoardMissionStepV1[] {
  const snapshot = normalizeJobsBoardSnapshotForBiomesUIV1(raw);
  if (!snapshot) return [];
  return snapshot.myTodos
    .filter((todo) => todo.status === "active")
    .map((todo) => {
      const baseObjective =
        todo.todoText ||
        `Complete accepted board job: ${todo.title || todo.jobId}`;
      const kindLabel = jobsBoardKindLabelV1(todo.kind);
      // Show the accept-window countdown on the quest entry (jobs are timed).
      const timeLabel = formatHarthmereJobTimeRemainingV151(todo.dueAtMs, nowMs);
      return {
        id: jobsBoardTodoQuestIdV1(todo),
        // Show the real job title (e.g. "Patch the Safe-Zone Fence") instead of
        // a generic "Accepted job N", and prefix the objective with the job kind
        // so the player can tell a repair from a hunt at a glance.
        title: todo.title || todo.jobId || "Accepted Job",
        objective: timeLabel
          ? `[${kindLabel}] ${baseObjective} (${timeLabel})`
          : `[${kindLabel}] ${baseObjective}`,
        done: false,
      };
    });
}

export function firstActiveJobsBoardQuestTitleForBiomesUIV1(raw: unknown) {
  const snapshot = normalizeJobsBoardSnapshotForBiomesUIV1(raw);
  return snapshot?.myTodos.find((todo) => todo.status === "active")?.title;
}

export function firstActiveJobsBoardLandmarkForBiomesUIV1(raw: unknown) {
  return jobsBoardAcceptedJobLandmarksForBiomesUIV1(raw)[0];
}
