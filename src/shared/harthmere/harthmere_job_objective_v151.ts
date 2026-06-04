// HARTHMERE_JOB_OBJECTIVE_V151
//
// One pure, kind-aware resolver for "what should the player be doing right now,
// and which marker should be active on EVERY map surface (world map, HUD aid,
// minimap)". Every accepted job moves through phases:
//
//   pickup?  ->  field  ->  return_to_board
//
// - pickup (delivery only): collect the parcel at a pickup spot before delivering.
// - field: do the work — deliver to a recipient, gather N at a spot, clean N muck
//   at a spot, repair the structure.
// - return_to_board: the field objective is met; go back to the board to turn in.
//
// The "already satisfied on accept" shortcut (e.g. the player already carries the
// gather materials) jumps straight to return_to_board, but with DISTINCT, obvious
// messaging so it never looks like a bug.
//
// This module is intentionally free of any client/runtime imports so it is unit
// testable. The client computes the small `progress` signals (inventory counts,
// cleaned counts, handoff flags) and renders `activeMarkerId` on all surfaces.

import {
  HARTHMERE_BUSINESS_OWNER_MARKER_PREFIX_V151,
  harthmereDeliveryPlanV151,
  type HarthmereJobsBoardRequirementV1,
} from "@/shared/harthmere/mmo_jobs_board_authority_v1";

export const HARTHMERE_JOB_OBJECTIVE_VERSION_V151 =
  "harthmere-job-objective-v151" as const;

export type HarthmereJobPhaseV151 =
  | "pickup"
  | "field"
  | "return_to_board"
  | "failed";

export interface HarthmereJobProgressV151 {
  // Delivery
  hasParcel?: boolean; // parcel is currently in the player's inventory
  deliveredToRecipient?: boolean; // handed off to the recipient
  // Gather / cleanup counts (progress made SINCE accepting, measured by the client)
  gatheredCount?: number;
  cleanedCount?: number;
  // Repair
  repaired?: boolean;
  // Escort: the escorted follower NPC reached the destination.
  escortArrived?: boolean;
  // The objective failed (timer lapsed, or the escorted NPC was killed). A failed
  // quest shows no active marker and routes to the "failed" phase.
  failed?: boolean;
  // Escort-specific failure: the escorted NPC was killed.
  escortFailed?: boolean;
  // The player already satisfied the objective at accept time (e.g. already
  // carried the required gather materials). Drives the distinct shortcut message.
  satisfiedOnAccept?: boolean;
  // Whether the kind-required tool (repair/cleanup) is currently equipped.
  toolEquipped?: boolean;
}

export interface HarthmereJobMarkerPlanV151 {
  kind: string;
  phase: HarthmereJobPhaseV151;
  // The single marker the player is being guided to RIGHT NOW. Every map surface
  // should render exactly this id so they never diverge between steps.
  activeMarkerId?: string;
  boardMarkerId: string;
  objectiveMet: boolean; // field work done -> return to board
  // Clear, user-facing one-liner for the current step.
  hint: string;
  // The tool action that must be equipped for this step (cleanup/repair), if any
  // and not yet satisfied — the client turns this into an "equip a tool" prompt.
  needsToolAction?: string;
  requiredCount?: number;
  currentCount?: number;
}

// HARTHMERE_TOOL_SOURCE_V151: where to GET a required tool when the player lacks
// it. The vendor is a real on-map business owner (already a marker), so a missing
// tool produces a concrete "go buy it here" objective with a map marker, and the
// tool must actually be stocked there (see the vendor stock wiring).
export interface HarthmereToolSourceV151 {
  action: string;
  toolItemId: string;
  toolName: string;
  vendorMarkerId: string;
  vendorName: string;
}

export const HARTHMERE_TOOL_SOURCES_V151: Record<string, HarthmereToolSourceV151> = {
  repair: {
    action: "repair",
    toolItemId: "repair_mallet",
    toolName: "Repair Mallet",
    // Fixer Tomas Hinge — Hingehall Workshop (repair_maintenance_person).
    vendorMarkerId: "harthmere_owner:npc_outpost_hingehall_fixer",
    vendorName: "Fixer Tomas Hinge",
  },
  cleanup: {
    action: "cleanup",
    toolItemId: "muck_rake",
    toolName: "Muck Rake",
    // Boss Greta Clearbarrel — Clearbarrel Depot (waste_sanitation_cleanup).
    vendorMarkerId: "harthmere_owner:npc_outpost_clearbarrel_boss",
    vendorName: "Boss Greta Clearbarrel",
  },
};

export function harthmereToolSourceForActionV151(
  action: string | undefined
): HarthmereToolSourceV151 | undefined {
  return action ? HARTHMERE_TOOL_SOURCES_V151[action] : undefined;
}

function firstItemRequirementV151(
  requirements: HarthmereJobsBoardRequirementV1[] | undefined
): HarthmereJobsBoardRequirementV1 | undefined {
  return (requirements ?? []).find((req) => req.itemId);
}

function requiredCountV151(req: HarthmereJobsBoardRequirementV1 | undefined) {
  return Math.max(1, Math.floor(req?.count ?? 1));
}

function boardPhaseV151(
  kind: string,
  boardMarkerId: string,
  hint: string,
  extra: Partial<HarthmereJobMarkerPlanV151> = {}
): HarthmereJobMarkerPlanV151 {
  return {
    kind,
    phase: "return_to_board",
    activeMarkerId: boardMarkerId,
    boardMarkerId,
    objectiveMet: true,
    hint,
    ...extra,
  };
}

// Resolve the active phase + marker + hint for an accepted job. `fieldMarkerId`
// is the job's authored field marker (job.mapMarkerId); `boardMarkerId` is where
// the player turns the job in.
export function harthmereJobMarkerPlanV151(input: {
  kind?: string;
  requirements?: HarthmereJobsBoardRequirementV1[];
  fieldMarkerId?: string;
  boardMarkerId: string;
  progress?: HarthmereJobProgressV151;
}): HarthmereJobMarkerPlanV151 {
  const kind = input.kind ?? "";
  const board = input.boardMarkerId;
  const progress = input.progress ?? {};
  const fieldMarker = input.fieldMarkerId;

  // FAILED short-circuits everything: a failed quest has NO active marker (its
  // map markers no longer apply) and the UI shows it as failed.
  if (progress.failed || (kind === "escort" && progress.escortFailed)) {
    return {
      kind,
      phase: "failed",
      activeMarkerId: undefined,
      boardMarkerId: board,
      objectiveMet: false,
      hint:
        kind === "escort" && progress.escortFailed
          ? "Your companion was lost — the escort failed."
          : "This job failed. It has been released on the board.",
    };
  }

  // ---- Delivery -----------------------------------------------------------
  if (kind === "delivery") {
    const plan = harthmereDeliveryPlanV151({ kind, requirements: input.requirements });
    const recipientMarker =
      plan?.recipient.markerId ?? fieldMarker;
    const parcelName = plan?.parcelItemId ?? "the parcel";
    if (progress.deliveredToRecipient) {
      return boardPhaseV151(kind, board, "Delivered. Return to the jobs board to collect your reward.");
    }
    // Pickup phase: a pickup spot exists and the parcel is not yet in hand.
    if (plan?.pickupMarkerId && !plan.grantOnAccept && !progress.hasParcel) {
      return {
        kind,
        phase: "pickup",
        activeMarkerId: plan.pickupMarkerId,
        boardMarkerId: board,
        objectiveMet: false,
        hint: `Collect ${parcelName} at the marked spot, then deliver it.`,
      };
    }
    return {
      kind,
      phase: "field",
      activeMarkerId: recipientMarker,
      boardMarkerId: board,
      objectiveMet: false,
      hint:
        plan?.recipient.kind === "person"
          ? `Take ${parcelName} to the marked person and hand it over.`
          : `Deliver ${parcelName} to the marked drop-off.`,
    };
  }

  // ---- Gather -------------------------------------------------------------
  if (kind === "gather") {
    const req = firstItemRequirementV151(input.requirements);
    const required = requiredCountV151(req);
    const have = Math.max(0, Math.floor(progress.gatheredCount ?? 0));
    if (have >= required) {
      // Distinct messaging for the "already had them" shortcut so it is obvious
      // and never looks like the job auto-completed by mistake.
      const hint = progress.satisfiedOnAccept
        ? `You already have ${required} ${req?.itemId ?? "materials"} — no gathering needed. Return to the jobs board to hand them in.`
        : `Gathered ${required}/${required}. Return to the jobs board to hand them in.`;
      return boardPhaseV151(kind, board, hint, {
        requiredCount: required,
        currentCount: have,
      });
    }
    return {
      kind,
      phase: "field",
      activeMarkerId: req?.mapMarkerId ?? fieldMarker,
      boardMarkerId: board,
      objectiveMet: false,
      hint: `Gather ${have}/${required} ${req?.itemId ?? "materials"} at the marked spot.`,
      requiredCount: required,
      currentCount: have,
    };
  }

  // ---- Cleanup ------------------------------------------------------------
  if (kind === "cleanup") {
    const req =
      (input.requirements ?? []).find((r) => r.itemId) ??
      (input.requirements ?? [])[0];
    const required = requiredCountV151(req);
    const cleaned = Math.max(0, Math.floor(progress.cleanedCount ?? 0));
    if (cleaned >= required) {
      return boardPhaseV151(
        kind,
        board,
        `Cleared ${required}/${required}. Return to the jobs board to collect your reward.`,
        { requiredCount: required, currentCount: cleaned }
      );
    }
    if (progress.toolEquipped === false) {
      const source = harthmereToolSourceForActionV151("cleanup");
      return {
        kind,
        phase: "field",
        // No tool: guide the player to BUY one from the marked vendor first.
        activeMarkerId: source?.vendorMarkerId ?? req?.mapMarkerId ?? fieldMarker,
        boardMarkerId: board,
        objectiveMet: false,
        needsToolAction: "cleanup",
        hint: source
          ? `You need a ${source.toolName} (it turns muck back into dirt). Buy one from ${source.vendorName} at the marked shop, equip it, then return to the muck.`
          : "Equip a cleanup tool to clear the marked muck.",
        requiredCount: required,
        currentCount: cleaned,
      };
    }
    return {
      kind,
      phase: "field",
      activeMarkerId: req?.mapMarkerId ?? fieldMarker,
      boardMarkerId: board,
      objectiveMet: false,
      hint: `Clear ${cleaned}/${required} muck at the marked spot with your cleanup tool.`,
      requiredCount: required,
      currentCount: cleaned,
    };
  }

  // ---- Repair -------------------------------------------------------------
  if (kind === "repair") {
    if (progress.repaired) {
      return boardPhaseV151(kind, board, "Repaired. Return to the jobs board to collect your reward.");
    }
    if (progress.toolEquipped === false) {
      const source = harthmereToolSourceForActionV151("repair");
      return {
        kind,
        phase: "field",
        // No tool: guide the player to BUY one from the marked vendor first.
        activeMarkerId: source?.vendorMarkerId ?? fieldMarker,
        boardMarkerId: board,
        objectiveMet: false,
        needsToolAction: "repair",
        hint: source
          ? `You need a ${source.toolName} to fix this. Buy one from ${source.vendorName} at the marked shop, equip it, then return to the structure.`
          : "Equip a repair tool to fix the marked structure.",
      };
    }
    return {
      kind,
      phase: "field",
      activeMarkerId: fieldMarker,
      boardMarkerId: board,
      objectiveMet: false,
      hint: "Repair the marked structure with your repair tool.",
    };
  }

  // ---- Escort -------------------------------------------------------------
  if (kind === "escort") {
    if (progress.escortArrived) {
      return boardPhaseV151(
        kind,
        board,
        "Your companion arrived safely. Return to the jobs board to collect your reward."
      );
    }
    return {
      kind,
      phase: "field",
      activeMarkerId: fieldMarker,
      boardMarkerId: board,
      objectiveMet: false,
      hint: "Escort your companion to the marked destination — stay close so they keep following.",
    };
  }

  // ---- Default (hunt / craft / security / service / etc.) -----------------
  // Generic: go to the field marker; the kind-specific objective detection lives
  // with that kind. Once met, the client passes satisfiedOnAccept/objective via
  // progress and we route to the board.
  if (progress.satisfiedOnAccept) {
    return boardPhaseV151(kind, board, "Objective complete. Return to the jobs board to collect your reward.");
  }
  return {
    kind,
    phase: "field",
    activeMarkerId: fieldMarker,
    boardMarkerId: board,
    objectiveMet: false,
    hint: "Travel to the marked location and complete the job.",
  };
}

// HARTHMERE_JOB_TRACKING_V151: with several active jobs, only one can guide the
// player at a time. This picks which job is "tracked" (its marker is the active
// one): an explicit player selection wins; otherwise the most-recently-accepted
// non-expired job. Expired jobs are never tracked.
export interface HarthmereTrackableJobV151 {
  jobId: string;
  kind: string;
  acceptedAtMs?: number;
  deadlineAtMs?: number;
  requirements?: HarthmereJobsBoardRequirementV1[];
  fieldMarkerId?: string;
  progress?: HarthmereJobProgressV151;
}

function jobExpiredV151(job: HarthmereTrackableJobV151, nowMs: number): boolean {
  return (
    job.deadlineAtMs !== undefined &&
    Number.isFinite(job.deadlineAtMs) &&
    job.deadlineAtMs <= nowMs
  );
}

export function harthmereSelectTrackedJobV151(
  jobs: readonly HarthmereTrackableJobV151[],
  trackedJobId: string | undefined,
  nowMs: number
): HarthmereTrackableJobV151 | undefined {
  const active = jobs.filter((job) => !jobExpiredV151(job, nowMs));
  if (active.length === 0) {
    return undefined;
  }
  if (trackedJobId) {
    const explicit = active.find((job) => job.jobId === trackedJobId);
    if (explicit) {
      return explicit;
    }
  }
  return [...active].sort(
    (a, b) => (b.acceptedAtMs ?? 0) - (a.acceptedAtMs ?? 0)
  )[0];
}

// Resolve the marker plan for the tracked job (selection + per-kind resolution).
export function harthmereTrackedJobMarkerPlanV151(input: {
  jobs: readonly HarthmereTrackableJobV151[];
  trackedJobId: string | undefined;
  boardMarkerId: string;
  nowMs: number;
}): { jobId: string; plan: HarthmereJobMarkerPlanV151 } | undefined {
  const job = harthmereSelectTrackedJobV151(
    input.jobs,
    input.trackedJobId,
    input.nowMs
  );
  if (!job) {
    return undefined;
  }
  return {
    jobId: job.jobId,
    plan: harthmereJobMarkerPlanV151({
      kind: job.kind,
      requirements: job.requirements,
      fieldMarkerId: job.fieldMarkerId,
      boardMarkerId: input.boardMarkerId,
      progress: job.progress,
    }),
  };
}

// HARTHMERE_JOB_NOTIFICATION_V151: surface a one-time notification when a job
// becomes ready to turn in (objective met) or has expired, so the player is told
// instead of silently noticing the marker move.
export type HarthmereJobNotificationV151 =
  | { kind: "ready_to_turn_in"; jobId: string; message: string }
  | { kind: "expired"; jobId: string; message: string }
  | { kind: "failed"; jobId: string; message: string };

export function harthmereJobNotificationV151(input: {
  jobId: string;
  jobTitle?: string;
  deadlineAtMs?: number;
  nowMs: number;
  objectiveMet: boolean;
  failed?: boolean;
}): HarthmereJobNotificationV151 | undefined {
  const title = input.jobTitle?.trim() || "your job";
  // Explicit failure (e.g. escorted NPC killed) — surfaced over everything else.
  if (input.failed) {
    return {
      kind: "failed",
      jobId: input.jobId,
      message: `${title} failed.`,
    };
  }
  if (
    input.deadlineAtMs !== undefined &&
    Number.isFinite(input.deadlineAtMs) &&
    input.deadlineAtMs <= input.nowMs
  ) {
    return {
      kind: "expired",
      jobId: input.jobId,
      message: `${title} ran out of time and failed.`,
    };
  }
  if (input.objectiveMet) {
    return {
      kind: "ready_to_turn_in",
      jobId: input.jobId,
      message: `${title} is ready — return to the jobs board to collect your reward.`,
    };
  }
  return undefined;
}

// Marker-prefix re-export so client surfaces can recognize an owner-recipient pin.
export { HARTHMERE_BUSINESS_OWNER_MARKER_PREFIX_V151 };
