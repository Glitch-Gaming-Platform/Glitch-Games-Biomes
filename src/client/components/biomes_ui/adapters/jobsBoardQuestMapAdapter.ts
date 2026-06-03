import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID_V1,
  normalizeHarthmereJobsBoardSnapshotV1,
  type HarthmereJobsBoardSnapshotV1,
  type HarthmereJobsBoardTodoV1,
} from "../../harthmere_jobs_board/jobsBoardLiveAdapter";
import { harthmereJobsBoardQuestMarkerPositionForTodoV1 } from "@/shared/harthmere/jobs_board_quest_marker_positions_v1";
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

function jobsBoardTodoMarkerIdV1(todo: HarthmereJobsBoardTodoV1) {
  return `jobs_board_marker:${todo.todoId}`;
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
  raw: unknown
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
      },
    ];
  });
}

export function activeJobsBoardMissionStepsForBiomesUIV1(
  raw: unknown
): BiomesUIJobsBoardMissionStepV1[] {
  const snapshot = normalizeJobsBoardSnapshotForBiomesUIV1(raw);
  if (!snapshot) return [];
  return snapshot.myTodos
    .filter((todo) => todo.status === "active")
    .map((todo, index) => ({
      id: jobsBoardTodoQuestIdV1(todo),
      title: `Accepted job ${index + 1}`,
      objective:
        todo.todoText ||
        `Complete accepted board job: ${todo.title || todo.jobId}`,
      done: false,
    }));
}

export function firstActiveJobsBoardQuestTitleForBiomesUIV1(raw: unknown) {
  const snapshot = normalizeJobsBoardSnapshotForBiomesUIV1(raw);
  return snapshot?.myTodos.find((todo) => todo.status === "active")?.title;
}

export function firstActiveJobsBoardLandmarkForBiomesUIV1(raw: unknown) {
  return jobsBoardAcceptedJobLandmarksForBiomesUIV1(raw)[0];
}
