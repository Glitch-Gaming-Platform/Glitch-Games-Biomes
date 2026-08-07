import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_GROVE_MARKET_MARKER_ID,
  normalizeHarthmereJobsBoardSnapshot,
  type HarthmereJobsBoardPosting,
  type HarthmereJobsBoardSnapshot,
  type HarthmereJobsBoardTodo,
} from "../../harthmere_jobs_board/jobsBoardLiveAdapter";
import {
  harthmereJobsBoardQuestMarkerRuntimePositionForId,
  harthmereJobsBoardQuestMarkerRuntimePositionForTodo,
} from "@/shared/harthmere/jobs_board_quest_marker_positions";
import { harthmereJobsBoardFieldTargetForId } from "@/shared/harthmere/jobs_board_field_targets";
import {
  harthmereDeliveryParcelPickupRecorded,
  harthmereJobMarkerPlan,
  harthmereJobItemSourceGuidance,
  harthmereJobToolSourceGuidance,
  type HarthmereJobMarkerPlan,
  type HarthmereJobProgress,
} from "@/shared/harthmere/harthmere_job_objective";
import { formatHarthmereJobTimeRemaining } from "@/shared/harthmere/mmo_jobs_board_authority";
import { humanReadableHarthmereIdentifier } from "@/shared/harthmere/harthmere_readable_names";
import type { Vec3 } from "@/shared/math/types";
import type { MapTrackableQuest } from "../tabs/MapQuestsTab";

// HARTHMERE_JOB_TOOL_OWNED_FOR_MAP: whether the player OWNS the repair /
// cleanup tools (backpack or equipped), passed in by the map surfaces. A job that
// needs a tool the player does NOT own points them at the business that sells it;
// once owned, the buy pin drops and the marker returns to the job.
export interface BiomesUIJobsBoardToolOwnedState {
  repairToolOwned?: boolean;
  cleanupToolOwned?: boolean;
}

function toolOwnedForAction(
  action: string,
  toolOwned: BiomesUIJobsBoardToolOwnedState
): boolean | undefined {
  if (action === "repair") {
    return toolOwned.repairToolOwned;
  }
  if (action === "cleanup") {
    return toolOwned.cleanupToolOwned;
  }
  return undefined;
}

export const BIOMES_UI_JOBS_BOARD_ACCEPTED_JOB_MARKER_SOURCE =
  "jobs_board_accepted_job" as const;

export const BIOMES_UI_JOBS_BOARD_TOOL_SOURCE_MARKER_SOURCE =
  "jobs_board_tool_source" as const;
export const BIOMES_UI_JOBS_BOARD_ITEM_SOURCE_MARKER_SOURCE =
  "jobs_board_item_source" as const;

export const JOBS_BOARD_TOOL_SOURCE_MARKER_ID_PREFIX =
  "jobs_board_tool_source:";
export const JOBS_BOARD_ITEM_SOURCE_MARKER_ID_PREFIX =
  "jobs_board_item_source:";

export interface BiomesUIJobsBoardAcceptedJobLandmark {
  id: string;
  label: string;
  position: Vec3;
  kind: "objective";
  area: string;
  visibleOnWorldMap: true;
  visibleOnHudMap: true;
  active: true;
  description: string;
  source:
    | typeof BIOMES_UI_JOBS_BOARD_ACCEPTED_JOB_MARKER_SOURCE
    | typeof BIOMES_UI_JOBS_BOARD_TOOL_SOURCE_MARKER_SOURCE
    | typeof BIOMES_UI_JOBS_BOARD_ITEM_SOURCE_MARKER_SOURCE;
  jobsBoardTodoId: string;
  jobsBoardJobId: string;
  mapMarkerId: string;
  targetId?: string;
}

export interface BiomesUIJobsBoardMissionStep {
  id: string;
  title: string;
  objective: string;
  done: boolean;
}

// HARTHMERE_JOBS_BOARD_KIND_LABEL:
// Human-facing label per job kind so an accepted job reads as the work it
// actually is (a repair shows "Repair", a hunt shows "Hunt") instead of a
// generic "Accepted job N". This is the fix for the reported bug where a fence
// repair appeared indistinguishable from — and was eclipsed by — a kill quest.
const JOBS_BOARD_KIND_LABEL: Record<string, string> = {
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

export function jobsBoardKindLabel(kind: string | undefined): string {
  if (!kind) return "Job";
  return JOBS_BOARD_KIND_LABEL[kind] ?? "Job";
}

const JOBS_BOARD_FALLBACK_POSITION: Vec3 = [
  501.99486179104775, 71, -132.00350672753194,
];

function normalizeJobsBoardSnapshotForBiomesUI(
  raw: unknown
): HarthmereJobsBoardSnapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return normalizeHarthmereJobsBoardSnapshot(raw);
}

export const JOBS_BOARD_MARKER_ID_PREFIX = "jobs_board_marker:";

function jobsBoardTodoMarkerId(todo: HarthmereJobsBoardTodo) {
  return `${JOBS_BOARD_MARKER_ID_PREFIX}${todo.todoId}`;
}

function jobsBoardTodoIsClaimable(
  todo: HarthmereJobsBoardTodo,
  job: HarthmereJobsBoardPosting | undefined
) {
  return todo.status === "completed" && job?.status === "active";
}

function jobsBoardTodoIsActiveOrClaimable(
  todo: HarthmereJobsBoardTodo,
  job: HarthmereJobsBoardPosting | undefined
) {
  return todo.status === "active" || jobsBoardTodoIsClaimable(todo, job);
}

// HARTHMERE_STALE_JOBS_BOARD_PIN:
// A jobs-board active map pin must be dropped once its job is no longer active
// (completed or abandoned). Otherwise it keeps driving the HUD aid — and, with
// the world-beacon active-pin override, would keep suppressing other quest
// beacons — pointing the player at a job they already finished. Only clears a
// jobs-board pin (never a user-set vendor/property pin), and only against the
// list of CURRENTLY-active jobs-board marker ids.
export function shouldClearStaleJobsBoardPin(input: {
  activePinMarkerId: string | undefined;
  activeJobsBoardMarkerIds: readonly string[];
}): boolean {
  const id = input.activePinMarkerId;
  if (
    !id ||
    (!id.startsWith(JOBS_BOARD_MARKER_ID_PREFIX) &&
      !id.startsWith(JOBS_BOARD_ITEM_SOURCE_MARKER_ID_PREFIX) &&
      !id.startsWith(JOBS_BOARD_TOOL_SOURCE_MARKER_ID_PREFIX))
  ) {
    return false;
  }
  return !input.activeJobsBoardMarkerIds.includes(id);
}

export function jobsBoardTodoIdFromMarkerIdForTest(
  markerId: string | undefined
): string | undefined {
  const id = String(markerId ?? "");
  for (const prefix of [
    JOBS_BOARD_MARKER_ID_PREFIX,
    JOBS_BOARD_ITEM_SOURCE_MARKER_ID_PREFIX,
    JOBS_BOARD_TOOL_SOURCE_MARKER_ID_PREFIX,
  ]) {
    if (id.startsWith(prefix)) {
      return id.slice(prefix.length) || undefined;
    }
  }
  return undefined;
}

export function newlyAcceptedJobsBoardTodoIdForTest(input: {
  previous: unknown;
  next: unknown;
}): string | undefined {
  if (!input.previous) return undefined;
  const previous = normalizeJobsBoardSnapshotForBiomesUI(input.previous);
  const next = normalizeJobsBoardSnapshotForBiomesUI(input.next);
  if (!previous || !next) return undefined;
  const previousActiveTodoIds = new Set(
    previous.myTodos
      .filter((todo) => todo.status === "active")
      .map((todo) => todo.todoId)
  );
  return next.myTodos.find(
    (todo) =>
      todo.status === "active" && !previousActiveTodoIds.has(todo.todoId)
  )?.todoId;
}

/** Preserve the player's selected todo while its current phase marker changes. */
export function jobsBoardLandmarkForActivePinHandoffForTest(input: {
  activePinMarkerId: string | undefined;
  landmarks: readonly BiomesUIJobsBoardAcceptedJobLandmark[];
}): BiomesUIJobsBoardAcceptedJobLandmark | undefined {
  const exact = input.landmarks.find(
    (landmark) => landmark.id === input.activePinMarkerId
  );
  const todoId = jobsBoardTodoIdFromMarkerIdForTest(input.activePinMarkerId);
  if (!todoId) return exact;
  const phasePriority = (
    landmark: BiomesUIJobsBoardAcceptedJobLandmark
  ): number => {
    switch (landmark.source) {
      case BIOMES_UI_JOBS_BOARD_TOOL_SOURCE_MARKER_SOURCE:
        return 0;
      case BIOMES_UI_JOBS_BOARD_ITEM_SOURCE_MARKER_SOURCE:
        return 1;
      case BIOMES_UI_JOBS_BOARD_ACCEPTED_JOB_MARKER_SOURCE:
        return 2;
    }
  };
  const best = input.landmarks
    .filter((landmark) => landmark.jobsBoardTodoId === todoId)
    .sort((a, b) => phasePriority(a) - phasePriority(b))[0];
  if (!best) return exact;
  if (exact && phasePriority(exact) <= phasePriority(best)) return exact;
  return best;
}

function jobsBoardTodoQuestId(todo: HarthmereJobsBoardTodo) {
  return `jobs_board:${todo.todoId}`;
}

function jobsBoardTodoFallbackPosition(
  snapshot: HarthmereJobsBoardSnapshot,
  todo: HarthmereJobsBoardTodo
): Vec3 {
  const board =
    snapshot.boards[todo.boardId] ??
    snapshot.boards[snapshot.defaultBoardId] ??
    snapshot.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID];
  const location = board?.location;
  const x = Number(location?.x);
  const y = Number(location?.y);
  const z = Number(location?.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return [...JOBS_BOARD_FALLBACK_POSITION] as Vec3;
  }
  return [x, Number.isFinite(y) ? y + 1 : JOBS_BOARD_FALLBACK_POSITION[1], z];
}

function jobsBoardTodoArea(
  snapshot: HarthmereJobsBoardSnapshot,
  todo: HarthmereJobsBoardTodo
) {
  return (
    snapshot.boards[todo.boardId]?.location?.district ??
    todo.townId ??
    "Jobs Board"
  );
}

function jobsBoardTodoBoardMarkerId(
  snapshot: HarthmereJobsBoardSnapshot,
  todo: HarthmereJobsBoardTodo
) {
  const board =
    snapshot.boards[todo.boardId] ??
    snapshot.boards[snapshot.defaultBoardId] ??
    snapshot.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID];
  return (
    board?.markerId ??
    board?.location?.landmarkId ??
    HARTHMERE_JOBS_BOARD_GROVE_MARKET_MARKER_ID
  );
}

function firstRequirementItemCount(
  job: HarthmereJobsBoardPosting | undefined,
  inventoryItems: Record<string, number> | undefined
) {
  const req = job?.requirements?.find((entry) => entry.itemId);
  if (!req?.itemId) {
    return undefined;
  }
  return Math.max(0, Math.floor(Number(inventoryItems?.[req.itemId] ?? 0)));
}

function firstRequirementCount(job: HarthmereJobsBoardPosting | undefined) {
  const req = job?.requirements?.find(
    (entry) => entry.itemId || entry.serviceKind || entry.targetId
  );
  return Math.max(1, Math.floor(Number(req?.count ?? req?.serviceUnits ?? 1)));
}

function completedJobsBoardTodoProgress(
  kind: string | undefined,
  job: HarthmereJobsBoardPosting | undefined
): HarthmereJobProgress {
  const completedCount = firstRequirementCount(job);
  if (kind === "delivery") {
    return { deliveredToRecipient: true };
  }
  if (kind === "gather") {
    return { gatheredCount: completedCount };
  }
  if (kind === "cleanup") {
    return { cleanedCount: completedCount };
  }
  if (kind === "repair") {
    return { repaired: true };
  }
  if (kind === "escort") {
    return { escortArrived: true };
  }
  return { inventoryRequirementsSatisfied: true };
}

function itemRequirementsSatisfied(
  job: HarthmereJobsBoardPosting | undefined,
  inventoryItems: Record<string, number> | undefined
) {
  const itemRequirements = (job?.requirements ?? []).filter(
    (entry) => entry.itemId
  );
  return (
    itemRequirements.length > 0 &&
    itemRequirements.every((req) => {
      const needed = Math.max(1, Math.floor(Number(req.count ?? 1)));
      return (
        Math.max(
          0,
          Math.floor(Number(inventoryItems?.[req.itemId ?? ""] ?? 0))
        ) >= needed
      );
    })
  );
}

function jobsBoardTodoMarkerPlanForBiomesUI(
  snapshot: HarthmereJobsBoardSnapshot,
  todo: HarthmereJobsBoardTodo,
  job: HarthmereJobsBoardPosting | undefined
): HarthmereJobMarkerPlan {
  const kind = todo.kind ?? job?.kind;
  const boardMarkerId = jobsBoardTodoBoardMarkerId(snapshot, todo);
  // Business gather jobs do not finish merely because the materials are in the
  // backpack: the player must carry them to the registered physical hand-in
  // prop and interact with it. Keep the field target active until the server
  // marks the todo complete, while the separate item-source pin continues to
  // guide any materials that are still missing.
  if (kind === "gather" && !jobsBoardTodoIsClaimable(todo, job)) {
    const target = [
      todo.targetId,
      job?.targetId,
      todo.mapMarkerId,
      job?.mapMarkerId,
      ...(job?.requirements ?? []).flatMap((requirement) => [
        requirement.targetId,
        requirement.mapMarkerId,
      ]),
    ]
      .map((id) => harthmereJobsBoardFieldTargetForId(id))
      .find(Boolean);
    if (target) {
      const targetName =
        job?.requirements.find(
          (requirement) =>
            requirement.targetId === target.targetId ||
            requirement.mapMarkerId === target.mapMarkerId
        )?.targetName ?? target.label;
      const itemsReady = itemRequirementsSatisfied(
        job,
        snapshot.inventoryItems
      );
      return {
        kind,
        phase: "field",
        activeMarkerId: target.mapMarkerId,
        boardMarkerId,
        objectiveMet: false,
        hint: itemsReady
          ? `Take the required materials to ${targetName} and press F to complete the job.`
          : `Gather all required materials, then take them to ${targetName} and press F to complete the job.`,
      };
    }
  }
  const progress: HarthmereJobProgress = {};
  if (jobsBoardTodoIsClaimable(todo, job)) {
    Object.assign(progress, completedJobsBoardTodoProgress(kind, job));
  } else {
    const itemCount = firstRequirementItemCount(job, snapshot.inventoryItems);
    if (kind === "gather" && itemCount !== undefined) {
      progress.gatheredCount = itemCount;
    }
    if (kind === "delivery" && itemCount !== undefined) {
      progress.hasParcel =
        itemCount > 0 || harthmereDeliveryParcelPickupRecorded(job);
    } else if (kind === "delivery") {
      progress.hasParcel = harthmereDeliveryParcelPickupRecorded(job);
    }
    if (kind === "cleanup") {
      const repeatedRequirement = job?.requirements.find(
        (requirement) =>
          !requirement.itemId &&
          Boolean(requirement.targetId) &&
          Math.max(1, Math.floor(Number(requirement.serviceUnits ?? 1))) > 1 &&
          String(requirement.serviceKind ?? "").startsWith("cleanup")
      );
      const repeatedTargetId = repeatedRequirement?.targetId;
      if (repeatedTargetId) {
        const current = Math.max(
          0,
          Math.floor(
            Number(snapshot.serviceProgressCounts?.[repeatedTargetId] ?? 0)
          )
        );
        const baseline = Math.max(
          0,
          Math.floor(
            Number(todo.serviceProgressBaseline?.[repeatedTargetId] ?? 0)
          )
        );
        progress.cleanedCount = Math.max(0, current - baseline);
      }
    }
    if (kind === "escort" && job?.escortCompanion?.status === "arrived") {
      progress.escortArrived = true;
    }
    if (
      job?.requiresFieldWork === false &&
      itemRequirementsSatisfied(job, snapshot.inventoryItems)
    ) {
      progress.inventoryRequirementsSatisfied = true;
    }
  }
  return harthmereJobMarkerPlan({
    kind,
    requirements: job?.requirements,
    fieldMarkerId:
      todo.mapMarkerId ?? job?.mapMarkerId ?? todo.targetId ?? job?.targetId,
    boardMarkerId,
    progress,
  });
}

function jobsBoardTodoStillNeedsItemSource(
  todo: HarthmereJobsBoardTodo,
  job: HarthmereJobsBoardPosting | undefined
) {
  return !(
    (todo.kind ?? job?.kind) === "delivery" &&
    harthmereDeliveryParcelPickupRecorded(job)
  );
}

function jobsBoardEscortDestinationForBiomesUI(
  todo: HarthmereJobsBoardTodo,
  job: HarthmereJobsBoardPosting | undefined,
  plan: HarthmereJobMarkerPlan
) {
  if ((todo.kind ?? job?.kind) !== "escort" || plan.phase !== "field") {
    return undefined;
  }
  const companion = job?.escortCompanion;
  const destination = companion?.destination;
  const x = Number(destination?.x);
  const y = Number(destination?.y);
  const z = Number(destination?.z);
  if (![x, y, z].every(Number.isFinite)) {
    return undefined;
  }
  const markerId =
    companion?.destinationMarkerId ??
    companion?.destinationTargetId ??
    plan.activeMarkerId ??
    todo.mapMarkerId ??
    job?.mapMarkerId ??
    `escort_destination:${todo.todoId}`;
  const label =
    job?.requirements.find(
      (requirement) =>
        requirement.mapMarkerId === markerId ||
        requirement.targetId === markerId
    )?.targetName ?? "Escort Destination";
  return {
    markerId,
    label,
    position: [x, y, z] as Vec3,
  };
}

function jobsBoardTodoObjectiveForBiomesUI(
  todo: HarthmereJobsBoardTodo,
  job: HarthmereJobsBoardPosting | undefined,
  plan: HarthmereJobMarkerPlan | undefined
) {
  // Keep authored field objectives for plain "go do the job" phases so old hunt
  // and repair copy still names the exact task. When the kind-aware planner
  // detects a real phase change (pickup / return-to-board / failed), its hint is
  // the clearest source of truth for every map and mission surface.
  if (
    plan &&
    (plan.phase !== "field" ||
      todo.kind === "gather" ||
      todo.kind === "delivery" ||
      todo.kind === "cleanup")
  ) {
    return plan.hint;
  }
  return (
    todo.todoText ||
    job?.description ||
    "Follow the job marker and complete the accepted board job."
  );
}

function jobsBoardTodoStatusToTrackableStatus(
  todo: HarthmereJobsBoardTodo,
  job: HarthmereJobsBoardPosting | undefined
): MapTrackableQuest["status"] | undefined {
  if (jobsBoardTodoIsActiveOrClaimable(todo, job)) return "active";
  if (todo.status === "completed") return "completed";
  // Surface failed jobs in the tracker so the player sees the outcome (its map
  // markers already drop, since only active todos produce landmarks).
  if (todo.status === "failed") return "failed";
  return undefined;
}

export function jobsBoardAcceptedJobLandmarksForBiomesUI(
  raw: unknown
): BiomesUIJobsBoardAcceptedJobLandmark[] {
  const snapshot = normalizeJobsBoardSnapshotForBiomesUI(raw);
  if (!snapshot) return [];
  const jobsById = new Map(
    snapshot.myAcceptedJobs.map((job) => [job.jobId, job])
  );
  const seenTodoIds = new Set<string>();

  return snapshot.myTodos.flatMap((todo) => {
    const job = jobsById.get(todo.jobId);
    if (
      !jobsBoardTodoIsActiveOrClaimable(todo, job) ||
      seenTodoIds.has(todo.todoId)
    ) {
      return [];
    }
    seenTodoIds.add(todo.todoId);
    const plan = jobsBoardTodoMarkerPlanForBiomesUI(snapshot, todo, job);
    const marker =
      jobsBoardEscortDestinationForBiomesUI(todo, job, plan) ??
      harthmereJobsBoardQuestMarkerRuntimePositionForTodo({
        mapMarkerId:
          plan.activeMarkerId ?? todo.mapMarkerId ?? job?.mapMarkerId,
        targetId: plan.activeMarkerId ?? todo.targetId ?? job?.targetId,
        fallbackPosition: jobsBoardTodoFallbackPosition(snapshot, todo),
      });
    const targetId =
      (todo.kind ?? job?.kind) === "escort"
        ? marker.markerId
        : (todo.targetId ?? job?.targetId);
    return [
      {
        id: jobsBoardTodoMarkerId(todo),
        label: todo.title || job?.title || "Accepted Job",
        position: marker.position,
        kind: "objective" as const,
        area: jobsBoardTodoArea(snapshot, todo),
        visibleOnWorldMap: true as const,
        visibleOnHudMap: true as const,
        active: true as const,
        description: plan.hint,
        source: BIOMES_UI_JOBS_BOARD_ACCEPTED_JOB_MARKER_SOURCE,
        jobsBoardTodoId: todo.todoId,
        jobsBoardJobId: todo.jobId,
        mapMarkerId: marker.markerId,
        targetId,
      },
    ];
  });
}

// HARTHMERE_JOB_TOOL_SOURCE_LANDMARK:
// For every ACTIVE accepted job that needs a tool the player doesn't have
// equipped (repair / cleanup), emit a vendor landmark pointing at the shop that
// sells that tool. This is what makes "the quest tells you WHERE to get the tool"
// show up as a pin on every map surface that renders accepted-job landmarks
// (BiomesUI world map, BiomesUI HUD minimap). The vendor is a real on-map business
// owner, so its position resolves through the shared marker registry.
export function jobsBoardToolSourceLandmarksForBiomesUI(
  raw: unknown,
  toolOwned: BiomesUIJobsBoardToolOwnedState = {}
): BiomesUIJobsBoardAcceptedJobLandmark[] {
  const snapshot = normalizeJobsBoardSnapshotForBiomesUI(raw);
  if (!snapshot) return [];
  const seenTodoIds = new Set<string>();

  return snapshot.myTodos.flatMap((todo) => {
    if (todo.status !== "active" || seenTodoIds.has(todo.todoId)) {
      return [];
    }
    seenTodoIds.add(todo.todoId);
    const action =
      todo.kind === "repair"
        ? "repair"
        : todo.kind === "cleanup"
          ? "cleanup"
          : undefined;
    if (!action) return [];
    // Only guide to the shop when we KNOW the player does NOT own the tool, so a
    // player who already has it never sees a spurious "buy it" pin (they're sent
    // to the job instead).
    if (toolOwnedForAction(action, toolOwned) !== false) {
      return [];
    }
    const guidance = harthmereJobToolSourceGuidance({
      kind: todo.kind,
      toolOwned: false,
    });
    if (!guidance) return [];
    const vendor = harthmereJobsBoardQuestMarkerRuntimePositionForId(
      guidance.vendorMarkerId
    );
    if (!vendor) return [];
    return [
      {
        id: `${JOBS_BOARD_TOOL_SOURCE_MARKER_ID_PREFIX}${todo.todoId}`,
        label: `Buy ${guidance.toolName} — ${guidance.vendorName}`,
        position: [...vendor.position] as Vec3,
        kind: "objective" as const,
        area: vendor.label,
        visibleOnWorldMap: true as const,
        visibleOnHudMap: true as const,
        active: true as const,
        description: guidance.hint,
        source: BIOMES_UI_JOBS_BOARD_TOOL_SOURCE_MARKER_SOURCE,
        jobsBoardTodoId: todo.todoId,
        jobsBoardJobId: todo.jobId,
        mapMarkerId: guidance.vendorMarkerId,
        targetId: guidance.vendorMarkerId,
      },
    ];
  });
}

export function jobsBoardItemSourceLandmarksForBiomesUI(
  raw: unknown
): BiomesUIJobsBoardAcceptedJobLandmark[] {
  const snapshot = normalizeJobsBoardSnapshotForBiomesUI(raw);
  if (!snapshot) return [];
  const jobsById = new Map(
    snapshot.myAcceptedJobs.map((job) => [job.jobId, job])
  );
  const seenTodoIds = new Set<string>();

  return snapshot.myTodos.flatMap((todo) => {
    const job = jobsById.get(todo.jobId);
    if (
      todo.status !== "active" ||
      jobsBoardTodoIsClaimable(todo, job) ||
      !jobsBoardTodoStillNeedsItemSource(todo, job) ||
      seenTodoIds.has(todo.todoId)
    ) {
      return [];
    }
    seenTodoIds.add(todo.todoId);
    const guidance = harthmereJobItemSourceGuidance({
      kind: todo.kind,
      requirements: job?.requirements,
      inventoryItems: snapshot.inventoryItems,
    });
    if (!guidance) return [];
    const registryMarker = guidance.markerId
      ? harthmereJobsBoardQuestMarkerRuntimePositionForId(guidance.markerId)
      : undefined;
    const position =
      registryMarker?.position ??
      (guidance.markerPosition
        ? ([...guidance.markerPosition] as Vec3)
        : undefined);
    if (!position) return [];
    const sourceName =
      registryMarker?.label ??
      humanReadableHarthmereIdentifier(guidance.sourceName);
    return [
      {
        id: `${JOBS_BOARD_ITEM_SOURCE_MARKER_ID_PREFIX}${todo.todoId}`,
        label: `Get ${guidance.itemName} — ${sourceName}`,
        position,
        kind: "objective" as const,
        area: sourceName,
        visibleOnWorldMap: true as const,
        visibleOnHudMap: true as const,
        active: true as const,
        description: guidance.hint,
        source: BIOMES_UI_JOBS_BOARD_ITEM_SOURCE_MARKER_SOURCE,
        jobsBoardTodoId: todo.todoId,
        jobsBoardJobId: todo.jobId,
        mapMarkerId:
          guidance.markerId ??
          `${JOBS_BOARD_ITEM_SOURCE_MARKER_ID_PREFIX}${todo.todoId}`,
        targetId: guidance.markerId,
      },
    ];
  });
}

export function jobsBoardTrackableQuestsForBiomesUI(
  raw: unknown,
  nowMs: number = Date.now(),
  toolOwned: BiomesUIJobsBoardToolOwnedState = {}
): MapTrackableQuest[] {
  const snapshot = normalizeJobsBoardSnapshotForBiomesUI(raw);
  if (!snapshot) return [];
  const jobsById = new Map(
    snapshot.myAcceptedJobs.map((job) => [job.jobId, job])
  );
  const seenTodoIds = new Set<string>();

  return snapshot.myTodos.flatMap((todo) => {
    const job = jobsById.get(todo.jobId);
    const status = jobsBoardTodoStatusToTrackableStatus(todo, job);
    if (!status || seenTodoIds.has(todo.todoId)) return [];
    seenTodoIds.add(todo.todoId);
    const isClaimable = jobsBoardTodoIsClaimable(todo, job);
    const rewardGold = Number(job?.rewardGold ?? 0);
    const plan =
      status === "active"
        ? jobsBoardTodoMarkerPlanForBiomesUI(snapshot, todo, job)
        : undefined;
    const objective = jobsBoardTodoObjectiveForBiomesUI(todo, job, plan);
    const itemGuidance =
      status === "active" &&
      !isClaimable &&
      jobsBoardTodoStillNeedsItemSource(todo, job)
        ? harthmereJobItemSourceGuidance({
            kind: todo.kind,
            requirements: job?.requirements,
            inventoryItems: snapshot.inventoryItems,
          })
        : undefined;
    const itemSourceName = itemGuidance
      ? ((itemGuidance.markerId
          ? harthmereJobsBoardQuestMarkerRuntimePositionForId(
              itemGuidance.markerId
            )?.label
          : undefined) ??
        humanReadableHarthmereIdentifier(itemGuidance.sourceName))
      : undefined;
    // Full-detail fields for the click-to-review quest panel. The tool-source
    // callout only shows for an active job whose tool the player does NOT own.
    const guidance =
      status === "active" && !isClaimable
        ? harthmereJobToolSourceGuidance({
            kind: todo.kind,
            toolOwned: toolOwnedForAction(
              todo.kind === "repair"
                ? "repair"
                : todo.kind === "cleanup"
                  ? "cleanup"
                  : "",
              toolOwned
            ),
          })
        : undefined;
    return [
      {
        questId: jobsBoardTodoQuestId(todo),
        title: todo.title || job?.title || "Accepted Job",
        area: jobsBoardTodoArea(snapshot, todo),
        status,
        firstMarkerId:
          status === "active"
            ? itemGuidance?.markerId || itemGuidance?.markerPosition
              ? `${JOBS_BOARD_ITEM_SOURCE_MARKER_ID_PREFIX}${todo.todoId}`
              : jobsBoardTodoMarkerId(todo)
            : undefined,
        reward:
          Number.isFinite(rewardGold) && rewardGold > 0
            ? `${Math.trunc(rewardGold)} gold`
            : undefined,
        // The job's accept-window countdown (jobs are timed; quests are not).
        timeRemaining:
          status === "active"
            ? formatHarthmereJobTimeRemaining(todo.dueAtMs, nowMs)
            : undefined,
        kind: todo.kind,
        kindLabel: jobsBoardKindLabel(todo.kind),
        objective,
        objectives: itemGuidance ? [objective, itemGuidance.hint] : [objective],
        description: job?.description || undefined,
        itemSource: itemGuidance
          ? {
              itemId: itemGuidance.itemId,
              itemName: itemGuidance.itemName,
              sourceName: itemSourceName ?? itemGuidance.sourceName,
              markerId: itemGuidance.markerId,
              hint: itemGuidance.hint,
              missingCount: itemGuidance.missingCount,
            }
          : undefined,
        toolSource: guidance
          ? {
              action: guidance.action,
              toolName: guidance.toolName,
              vendorName: guidance.vendorName,
              vendorMarkerId: guidance.vendorMarkerId,
              hint: guidance.hint,
            }
          : undefined,
      },
    ];
  });
}

export function activeJobsBoardMissionStepsForBiomesUI(
  raw: unknown,
  nowMs: number = Date.now()
): BiomesUIJobsBoardMissionStep[] {
  const snapshot = normalizeJobsBoardSnapshotForBiomesUI(raw);
  if (!snapshot) return [];
  const jobsById = new Map(
    snapshot.myAcceptedJobs.map((job) => [job.jobId, job])
  );
  return snapshot.myTodos
    .filter((todo) =>
      jobsBoardTodoIsActiveOrClaimable(todo, jobsById.get(todo.jobId))
    )
    .map((todo) => {
      const job = jobsById.get(todo.jobId);
      const isClaimable = jobsBoardTodoIsClaimable(todo, job);
      const plan = jobsBoardTodoMarkerPlanForBiomesUI(snapshot, todo, job);
      const baseObjective =
        jobsBoardTodoObjectiveForBiomesUI(todo, job, plan) ||
        `Complete accepted board job: ${todo.title || todo.jobId}`;
      const itemGuidance = isClaimable
        ? undefined
        : harthmereJobItemSourceGuidance({
            kind: todo.kind,
            requirements: job?.requirements,
            inventoryItems: snapshot.inventoryItems,
          });
      const objective = itemGuidance
        ? `${baseObjective} ${itemGuidance.hint}`
        : baseObjective;
      const kindLabel = jobsBoardKindLabel(todo.kind);
      // Show the accept-window countdown on the quest entry (jobs are timed).
      const timeLabel = formatHarthmereJobTimeRemaining(todo.dueAtMs, nowMs);
      return {
        id: jobsBoardTodoQuestId(todo),
        // Show the real job title (e.g. "Patch the Safe-Zone Fence") instead of
        // a generic "Accepted job N", and prefix the objective with the job kind
        // so the player can tell a repair from a hunt at a glance.
        title: todo.title || todo.jobId || "Accepted Job",
        objective: timeLabel
          ? `[${kindLabel}] ${objective} (${timeLabel})`
          : `[${kindLabel}] ${objective}`,
        done: false,
      };
    });
}

export function firstActiveJobsBoardQuestTitleForBiomesUI(raw: unknown) {
  const snapshot = normalizeJobsBoardSnapshotForBiomesUI(raw);
  if (!snapshot) return undefined;
  const jobsById = new Map(
    snapshot.myAcceptedJobs.map((job) => [job.jobId, job])
  );
  return snapshot.myTodos.find((todo) =>
    jobsBoardTodoIsActiveOrClaimable(todo, jobsById.get(todo.jobId))
  )?.title;
}

export function firstActiveJobsBoardLandmarkForBiomesUI(raw: unknown) {
  return jobsBoardAcceptedJobLandmarksForBiomesUI(raw)[0];
}
