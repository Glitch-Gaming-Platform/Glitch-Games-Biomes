import { addToast } from "@/client/components/toast/helpers";
import {
  type HarthmereDailyTaskActivityId,
  completeHarthmereDailyTaskSoon,
} from "@/client/components/challenges/harthmereDailyTasks";
import { isHarthmereRepairToolEquipped } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  harthmereCookingStationId,
  openHarthmereCookingStation,
} from "@/client/components/harthmere_cooking/harthmereCookingStations";
import { harthmereGatheringNodeIdForObjectLabel } from "@/client/components/challenges/LocalDevHarthmereGatheringSystem";
import {
  harthmereGatheringErrorMessage,
  submitHarthmereGatheringNode,
} from "@/client/components/challenges/harthmereGatheringLiveAuthority";
import {
  HARTHMERE_JOBS_BOARD_OPEN_EVENT,
  HARTHMERE_WANTED_BOARD_OPEN_EVENT,
} from "@/client/components/challenges/harthmereEvents";
import {
  fetchHarthmereJobsBoardState,
  submitHarthmereJobsBoardMutation,
  type HarthmereJobsBoardPosting,
  type HarthmereJobsBoardSnapshot,
  type HarthmereJobsBoardTodo,
} from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";
import { dispatchHarthmereHudActionEvent } from "@/shared/harthmere/harthmere_hud_key_bindings";
import type { HarthmereObjectInteraction } from "@/shared/harthmere/object_interaction_semantics";
import { fireAndForget } from "@/shared/util/async";
import { fetchHarthmereLiveWithTimeout } from "@/client/components/harthmere_live_fetch";

// HARTHMERE_REPAIR_PERFORMED_EVENT: fired when the player interacts with a
// repair target. `repaired` is true only when a repair tool is equipped — that
// is the signal the jobs-board completion flow uses to send usedToolAction and
// (engine phase) to restore the broken structure's blocks.
export const HARTHMERE_REPAIR_PERFORMED_EVENT =
  "biomes:harthmere-repair-performed" as const;

export interface HarthmereRepairPerformedEventDetail {
  entityId?: unknown;
  label?: string | null;
  repaired: boolean;
}

export const HARTHMERE_WORLD_OBJECT_INTERACTION_EVENT =
  "biomes:harthmere-world-object-interaction" as const;

export interface HarthmereWorldObjectInteractionEventDetail {
  entityId?: unknown;
  objectId?: string;
  label?: string | null;
  kind: HarthmereObjectInteraction["kind"];
  title: string;
  /** The signed world-object receipt already granted this quest pickup. */
  serverAuthoritativePickup?: boolean;
}

const HARTHMERE_SERVER_RECEIPT_INTERACTION_KINDS = new Set<
  HarthmereObjectInteraction["kind"]
>([
  "open_door",
  "open_gate",
  "read",
  "use",
  "repair",
  "recover",
  "tend",
  "practice",
  "check_outfit",
  "take_photo",
  "inspect",
  "gather",
]);

export function harthmereWorldObjectInteractionNeedsServerReceiptForTest(
  kind: HarthmereObjectInteraction["kind"]
) {
  return HARTHMERE_SERVER_RECEIPT_INTERACTION_KINDS.has(kind);
}

function liveModeWorldObjectUrl(search?: string) {
  const params = new URLSearchParams(
    search ?? (typeof window === "undefined" ? "" : window.location.search)
  );
  const installId = params.get("install_id") ?? params.get("installId");
  return installId
    ? `/api/harthmere/live_mode?install_id=${encodeURIComponent(installId)}`
    : "/api/harthmere/live_mode";
}

export function harthmereWorldObjectInteractionRequestBodyForTest(input: {
  objectId: string;
  label?: string | null;
  interaction: HarthmereObjectInteraction;
  requestId: string;
}) {
  return {
    requestId: input.requestId,
    idempotencyKey: input.requestId,
    actionKind: "request_care_loop_action",
    subsystem: "care",
    actorEntityVersion: 1,
    zoneId: "harthmere",
    clientSentAtMs: Date.now(),
    payload: {
      operation: "world_object_interaction",
      objectId: input.objectId,
      label: input.label ?? undefined,
      interactionKind: input.interaction.kind,
    },
    clientClaims: {},
  };
}

export class HarthmereWorldObjectInteractionError extends Error {
  constructor(public readonly warnings: string[]) {
    super(warnings.join(","));
    this.name = "HarthmereWorldObjectInteractionError";
  }
}

export function harthmereWorldObjectInteractionErrorMessage(
  error: unknown,
  label = "this object"
) {
  const warnings =
    error instanceof HarthmereWorldObjectInteractionError
      ? error.warnings
      : [String((error as any)?.message ?? error ?? "")];
  if (warnings.some((warning) => warning.includes("repair_tool_required"))) {
    return `Equip a repair tool before repairing ${label}.`;
  }
  if (warnings.some((warning) => warning.includes("out_of_range"))) {
    return `Move closer to ${label} and try again.`;
  }
  if (
    warnings.some((warning) =>
      /unknown_object|missing_object|kind_mismatch|label_mismatch/.test(warning)
    )
  ) {
    return `${label} is not the authoritative interaction target. Face the object and try again.`;
  }
  return `${label} could not be used. Try again.`;
}

export async function submitHarthmereWorldObjectInteraction(input: {
  objectId: string;
  label?: string | null;
  interaction: HarthmereObjectInteraction;
  fetchImpl?: typeof fetch;
  locationSearch?: string;
  requestId?: string;
}) {
  const requestId =
    input.requestId ??
    `harthmere_world_object_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;
  const response = await fetchHarthmereLiveWithTimeout(
    input.fetchImpl ?? fetch,
    liveModeWorldObjectUrl(input.locationSearch),
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        harthmereWorldObjectInteractionRequestBodyForTest({
          objectId: input.objectId,
          label: input.label,
          interaction: input.interaction,
          requestId,
        })
      ),
    }
  );
  const body = await response.json();
  const warnings = Array.isArray(body?.backendMutation?.warnings)
    ? body.backendMutation.warnings.map(String)
    : [];
  const rejected = warnings.filter((warning: string) =>
    warning.startsWith("world_object_rejected:")
  );
  if (!response.ok || body?.ok === false || rejected.length > 0) {
    throw new HarthmereWorldObjectInteractionError(
      rejected.length > 0
        ? rejected
        : [String(body?.error ?? "world_object_interaction_failed")]
    );
  }
  return body;
}

const HARTHMERE_READABLE_OBJECT_TEXT = new Map<string, string>(
  Object.entries({
    "billy's drop post":
      "Billy's drop post marks courier handoffs, parcel drops, and the next safe road check.",
    "chat practice board":
      "The chat board points new players to local, party, guild, and world chat practice.",
    "fountain lesson board":
      "The Fountain Lesson Board lists the Grove's safe starter lessons and sends markers to each practice stop.",
    "grove guild charter board":
      "The charter board explains guild ranks, shared banks, permissions, and project promises.",
    "old grove road post":
      "The road post points back to the Grove and forward along the safe Road Ahead route.",
    "practice land ledger":
      "The land ledger explains practice claims, safe build space, and why roads and doors stay clear.",
  })
);

function normalizedLabel(label?: string | null) {
  return (label ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizedTarget(value?: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = normalizedLabel(value);
  return normalized || undefined;
}

function targetAliasesForObject(input: {
  objectId?: string;
  label?: string | null;
}) {
  const aliases = new Set<string>();
  const objectId = normalizedTarget(input.objectId);
  if (objectId) {
    aliases.add(objectId);
    if (objectId.startsWith("ecs:")) {
      aliases.add(objectId.slice("ecs:".length));
    }
    if (objectId.startsWith("jobs_board_marker:")) {
      aliases.add(objectId.slice("jobs_board_marker:".length));
    }
  }
  const label = normalizedTarget(input.label);
  if (label) aliases.add(label);
  return aliases;
}

function addTargetAlias(aliases: Set<string>, value?: unknown) {
  const normalized = normalizedTarget(value);
  if (!normalized) return;
  aliases.add(normalized);
  if (normalized.startsWith("harthmere_owner:")) {
    aliases.add(normalized.slice("harthmere_owner:".length));
  }
}

function jobsBoardRequirementTargetAliases(
  req: HarthmereJobsBoardPosting["requirements"][number]
) {
  const aliases = new Set<string>();
  addTargetAlias(aliases, (req as any).pickupMarkerId);
  addTargetAlias(aliases, (req as any).mapMarkerId);
  addTargetAlias(aliases, (req as any).targetId);
  addTargetAlias(aliases, (req as any).targetName);
  addTargetAlias(aliases, (req as any).recipientNpcId);
  return aliases;
}

function jobsBoardPostingTargetAliases(
  todo: HarthmereJobsBoardTodo,
  job: HarthmereJobsBoardPosting | undefined
) {
  const aliases = new Set<string>();
  addTargetAlias(aliases, todo.mapMarkerId);
  addTargetAlias(aliases, todo.targetId);
  for (const req of job?.requirements ?? []) {
    for (const alias of jobsBoardRequirementTargetAliases(req)) {
      aliases.add(alias);
    }
  }
  addTargetAlias(aliases, job?.mapMarkerId);
  addTargetAlias(aliases, job?.targetId);
  return aliases;
}

export function harthmereJobsBoardObjectMatchesFieldTarget(input: {
  objectId?: string;
  label?: string | null;
  todo: HarthmereJobsBoardTodo;
  job?: HarthmereJobsBoardPosting;
}) {
  const objectAliases = targetAliasesForObject(input);
  if (!objectAliases.size) return false;
  const targetAliases = jobsBoardPostingTargetAliases(input.todo, input.job);
  for (const alias of objectAliases) {
    if (targetAliases.has(alias)) return true;
  }
  return false;
}

function bestCompletionTargetId(input: {
  objectId?: string;
  label?: string | null;
  todo: HarthmereJobsBoardTodo;
  job?: HarthmereJobsBoardPosting;
}) {
  const objectAliases = targetAliasesForObject(input);
  for (const req of input.job?.requirements ?? []) {
    const aliases = jobsBoardRequirementTargetAliases(req);
    if ([...objectAliases].some((alias) => aliases.has(alias))) {
      if (
        (req as any).pickupMarkerId &&
        objectAliases.has(normalizedTarget((req as any).pickupMarkerId) ?? "")
      ) {
        return (req as any).pickupMarkerId;
      }
      return (
        (req as any).recipientNpcId ??
        (req as any).targetId ??
        (req as any).mapMarkerId ??
        input.objectId ??
        normalizedLabel(input.label)
      );
    }
  }
  return (
    input.todo.targetId ??
    input.todo.mapMarkerId ??
    input.job?.targetId ??
    input.job?.mapMarkerId ??
    input.objectId ??
    normalizedLabel(input.label)
  );
}

function isDeliveryPickupTarget(input: {
  completedTargetId?: string;
  job?: HarthmereJobsBoardPosting;
}) {
  if (input.job?.kind !== "delivery" || !input.completedTargetId) {
    return false;
  }
  const completed = normalizedTarget(input.completedTargetId);
  return (input.job.requirements ?? []).some(
    (req) =>
      Boolean((req as any).pickupMarkerId) &&
      normalizedTarget((req as any).pickupMarkerId) === completed
  );
}

const inFlightJobsBoardFieldCompletions = new Set<string>();

async function completeHarthmereJobsBoardFieldObjectiveForObject(input: {
  objectId?: string;
  label?: string | null;
  interactionKind?: HarthmereObjectInteraction["kind"] | "open_container";
  resources: Parameters<typeof addToast>[0];
}) {
  if (typeof window === "undefined") return;
  const snapshot: HarthmereJobsBoardSnapshot =
    await fetchHarthmereJobsBoardState();
  const jobsById = new Map(
    snapshot.myAcceptedJobs.map((job) => [job.jobId, job])
  );
  const todo = snapshot.myTodos.find((candidate) => {
    if (candidate.status !== "active") return false;
    const job = jobsById.get(candidate.jobId);
    return harthmereJobsBoardObjectMatchesFieldTarget({
      objectId: input.objectId,
      label: input.label,
      todo: candidate,
      job,
    });
  });
  if (!todo) return;
  const job = jobsById.get(todo.jobId);
  const key = `${todo.todoId}:${
    input.objectId ?? normalizedLabel(input.label)
  }`;
  if (inFlightJobsBoardFieldCompletions.has(key)) return;
  inFlightJobsBoardFieldCompletions.add(key);
  try {
    if (
      input.interactionKind === "repair" &&
      !isHarthmereRepairToolEquipped()
    ) {
      return;
    }
    const usedToolAction =
      input.interactionKind === "repair" && isHarthmereRepairToolEquipped()
        ? "repair"
        : undefined;
    const completedTargetId = bestCompletionTargetId({
      objectId: input.objectId,
      label: input.label,
      todo,
      job,
    });
    const operation = isDeliveryPickupTarget({ completedTargetId, job })
      ? "pickup_delivery_parcel"
      : "complete_job_quest";
    const requestId = [
      "jobs_board_field",
      operation,
      todo.jobId,
      todo.todoId,
      job?.acceptedAtMs ?? 0,
    ].join(":");
    const snapshotAfter = await submitHarthmereJobsBoardMutation(
      operation,
      {
        jobId: todo.jobId,
        boardId: todo.boardId,
        questTodoId: todo.todoId,
        completedTargetId,
        ...(usedToolAction ? { usedToolAction } : {}),
      },
      {
        boardId: todo.boardId,
        requestId,
      }
    );
    const updatedTodo = snapshotAfter.myTodos.find(
      (candidate) => candidate.todoId === todo.todoId
    );
    if (operation === "pickup_delivery_parcel") {
      addToast(input.resources, {
        kind: "basic",
        id: `harthmere-jobs-board-delivery-pickup:${todo.todoId}`,
        message: `${
          job?.title ?? todo.title ?? "Delivery"
        } picked up. Take it to the marked recipient.`,
      });
      return;
    }
    if (updatedTodo?.status === "completed") {
      addToast(input.resources, {
        kind: "basic",
        id: `harthmere-jobs-board-field-complete:${todo.todoId}`,
        message: `${
          job?.title ?? todo.title ?? "Job step"
        } complete. Return to the jobs board to collect your reward.`,
      });
    }
  } catch {
    addToast(input.resources, {
      kind: "basic",
      id: `harthmere-jobs-board-field-incomplete:${todo.todoId}`,
      message: `${
        job?.title ?? todo.title ?? "Job step"
      } is not ready to complete here yet. Check the objective, required items, or equipped tool.`,
    });
  } finally {
    inFlightJobsBoardFieldCompletions.delete(key);
  }
}

export function completeHarthmereJobsBoardFieldObjectiveForObjectSoon(input: {
  objectId?: string;
  label?: string | null;
  interactionKind?: HarthmereObjectInteraction["kind"] | "open_container";
  resources: Parameters<typeof addToast>[0];
}) {
  fireAndForget(
    completeHarthmereJobsBoardFieldObjectiveForObject(input),
    "Error completing Harthmere jobs board field objective"
  );
}

export function harthmereReadableObjectTextForLabel(label?: string | null) {
  return HARTHMERE_READABLE_OBJECT_TEXT.get(normalizedLabel(label));
}

export function harthmereObjectInteractionToastMessage(input: {
  label?: string | null;
  interaction: HarthmereObjectInteraction;
}) {
  const displayLabel = input.label?.trim() || "World object";
  if (input.interaction.kind === "read") {
    return (
      harthmereReadableObjectTextForLabel(input.label) ??
      `Read ${displayLabel}.`
    );
  }
  return `${input.interaction.toastVerb} ${displayLabel}.`;
}

function dailyTasksForObjectInteraction(input: {
  label?: string | null;
  interaction: HarthmereObjectInteraction;
}): HarthmereDailyTaskActivityId[] {
  const label = (input.label ?? "").toLowerCase();
  const tasks = new Set<HarthmereDailyTaskActivityId>();
  if (
    input.interaction.kind === "open_jobs_board" ||
    input.interaction.kind === "open_wanted_board"
  ) {
    tasks.add("jobs_board");
  }
  if (input.interaction.kind === "gather") {
    tasks.add("forage_walk");
    if (/garden|berries|berry|sprout|patch|beds?/.test(label)) {
      tasks.add("garden_care");
    }
  }
  if (input.interaction.kind === "tend") {
    tasks.add("garden_care");
  }
  if (
    input.interaction.kind === "repair" ||
    input.interaction.kind === "craft" ||
    input.interaction.kind === "cook" ||
    input.interaction.kind === "use"
  ) {
    tasks.add("home_care");
  }
  return [...tasks];
}

export function dispatchHarthmereWorldObjectInteractionEvent(
  detail: HarthmereWorldObjectInteractionEventDetail
) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_WORLD_OBJECT_INTERACTION_EVENT, {
      detail,
    })
  );
}

export async function performHarthmereObjectInteraction(input: {
  label?: string | null;
  objectId?: string;
  entityId: unknown;
  interaction: HarthmereObjectInteraction;
  resources: Parameters<typeof addToast>[0];
  gardenHose: { publish: (event: { kind: "inspect_frame" }) => void };
}) {
  const recordConfirmedInteraction = (serverAuthoritativePickup = false) => {
    dispatchHarthmereWorldObjectInteractionEvent({
      entityId: input.entityId,
      objectId: input.objectId,
      label: input.label,
      kind: input.interaction.kind,
      title: input.interaction.title,
      serverAuthoritativePickup,
    });
    completeHarthmereJobsBoardFieldObjectiveForObjectSoon({
      objectId: input.objectId,
      label: input.label,
      interactionKind: input.interaction.kind,
      resources: input.resources,
    });
    for (const activityId of dailyTasksForObjectInteraction(input)) {
      completeHarthmereDailyTaskSoon(activityId);
    }
  };

  if (
    input.interaction.kind === "open_jobs_board" ||
    input.interaction.kind === "open_wanted_board"
  ) {
    recordConfirmedInteraction();
    const eventName =
      input.interaction.kind === "open_wanted_board"
        ? HARTHMERE_WANTED_BOARD_OPEN_EVENT
        : HARTHMERE_JOBS_BOARD_OPEN_EVENT;
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: {
            source: "harthmere_object_interaction",
            entityId: input.entityId,
            objectId: input.objectId,
            interactionTargetId: input.objectId,
            label: input.label,
          },
        })
      );
    }
    return;
  }

  if (input.interaction.kind === "cook") {
    recordConfirmedInteraction();
    const stationKind = input.interaction.stationKind ?? "campfire";
    const stationId = harthmereCookingStationId(input.entityId, input.label);
    openHarthmereCookingStation({
      stationId,
      stationKind,
      label: input.label,
      entityId: input.entityId,
    });
    return;
  }

  if (input.interaction.kind === "craft") {
    recordConfirmedInteraction();
    dispatchHarthmereHudActionEvent("crafting");
    return;
  }

  if (input.interaction.kind === "gather") {
    const nodeId = harthmereGatheringNodeIdForObjectLabel(input.label);
    if (nodeId) {
      try {
        await submitHarthmereGatheringNode(nodeId);
        recordConfirmedInteraction();
        addToast(input.resources, {
          kind: "basic",
          id: `harthmere-gather:${nodeId}`,
          message: harthmereObjectInteractionToastMessage({
            label: input.label,
            interaction: input.interaction,
          }),
        });
      } catch (error) {
        addToast(input.resources, {
          kind: "basic",
          id: `harthmere-gather-rejected:${nodeId}`,
          message: harthmereGatheringErrorMessage(
            error,
            input.label ?? "this resource"
          ),
        });
        throw error;
      }
      return;
    }
    // Grove quest pickups are authored world props, not profession nodes. The
    // server validates the exact landmark, active quest step, and actor range,
    // then grants the objective item through native ECS.
    if (!input.objectId) {
      throw new HarthmereWorldObjectInteractionError([
        "world_object_rejected:missing_object",
      ]);
    }
    await submitHarthmereWorldObjectInteraction({
      objectId: input.objectId,
      label: input.label,
      interaction: input.interaction,
    });
    recordConfirmedInteraction(true);
    addToast(input.resources, {
      kind: "basic",
      id: `harthmere-pickup:${input.objectId}`,
      message: harthmereObjectInteractionToastMessage({
        label: input.label,
        interaction: input.interaction,
      }),
    });
    return;
  }

  if (
    harthmereWorldObjectInteractionNeedsServerReceiptForTest(
      input.interaction.kind
    )
  ) {
    if (!input.objectId) {
      throw new HarthmereWorldObjectInteractionError([
        "world_object_rejected:missing_object",
      ]);
    }
    await submitHarthmereWorldObjectInteraction({
      objectId: input.objectId,
      label: input.label,
      interaction: input.interaction,
    });
    recordConfirmedInteraction();
  }

  // HARTHMERE_REPAIR_TOOL_EQUIP: a repair only happens with a repair tool
  // EQUIPPED. With one, restore the structure (emit the repair-performed signal
  // the job flow consumes) and confirm; without one, direct the player to get
  // and equip a repair tool first instead of silently "repairing" nothing.
  if (input.interaction.kind === "repair") {
    const repairLabel = input.label?.trim() || "the structure";
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(HARTHMERE_REPAIR_PERFORMED_EVENT, {
          detail: {
            entityId: input.entityId,
            label: input.label,
            repaired: true,
          } satisfies HarthmereRepairPerformedEventDetail,
        })
      );
    }
    addToast(input.resources, {
      kind: "basic",
      id: `harthmere-repair:${String(input.entityId)}`,
      message: `Repaired ${repairLabel}. The server confirmed the equipped repair tool and recorded the world-object mutation.`,
    });
    return;
  }

  addToast(input.resources, {
    kind: "basic",
    id: `harthmere-world-object:${input.entityId}:${input.interaction.kind}`,
    message: harthmereObjectInteractionToastMessage({
      label: input.label,
      interaction: input.interaction,
    }),
  });
}
