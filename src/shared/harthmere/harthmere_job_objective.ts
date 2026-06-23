// HARTHMERE_JOB_OBJECTIVE
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
  HARTHMERE_BUSINESS_OWNER_MARKER_PREFIX,
  harthmereDeliveryRequirement,
  harthmereDeliveryPlan,
  type HarthmereJobsBoardRequirement,
} from "@/shared/harthmere/mmo_jobs_board_authority";
import type { Vec3 } from "@/shared/math/types";

export const HARTHMERE_JOB_OBJECTIVE_VERSION =
  "harthmere-job-objective" as const;

export type HarthmereJobPhase =
  | "pickup"
  | "field"
  | "return_to_board"
  | "failed";

export interface HarthmereJobProgress {
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
  // Item-only jobs (craft / buy / gather elsewhere, then turn in at the board)
  // can become ready without a separate field interaction.
  inventoryRequirementsSatisfied?: boolean;
  // Whether the kind-required tool (repair/cleanup) is currently equipped.
  toolEquipped?: boolean;
  // Whether the player OWNS the kind-required tool (in inventory, equipped or not).
  // The buy-redirect is keyed on this: only a player who does NOT own the tool is
  // sent to the shop; once owned, the marker points back at the job.
  toolOwned?: boolean;
}

export interface HarthmereJobMarkerPlan {
  kind: string;
  phase: HarthmereJobPhase;
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

// HARTHMERE_TOOL_SOURCE: where to GET a required tool when the player lacks
// it. The vendor is a real on-map business owner (already a marker), so a missing
// tool produces a concrete "go buy it here" objective with a map marker, and the
// tool must actually be stocked there (see the vendor stock wiring).
export interface HarthmereToolSource {
  action: string;
  toolItemId: string;
  toolName: string;
  vendorMarkerId: string;
  vendorName: string;
}

export const HARTHMERE_TOOL_SOURCES: Record<string, HarthmereToolSource> = {
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

export function harthmereToolSourceForAction(
  action: string | undefined
): HarthmereToolSource | undefined {
  return action ? HARTHMERE_TOOL_SOURCES[action] : undefined;
}

export type HarthmereJobItemSourceKind =
  | "gather"
  | "craft"
  | "vendor"
  | "pickup"
  | "quest_grant"
  | "loot"
  | "unknown";

export interface HarthmereJobItemSourceGuidance {
  itemId: string;
  itemName: string;
  requiredCount: number;
  haveCount: number;
  missingCount: number;
  sourceKind: HarthmereJobItemSourceKind;
  sourceName: string;
  markerId?: string;
  markerPosition?: Vec3;
  hint: string;
}

interface HarthmereJobItemSourceDefinition {
  sourceKind: HarthmereJobItemSourceKind;
  sourceName: string;
  markerId?: string;
  markerPosition?: Vec3;
  hint: (itemName: string, missingCount: number) => string;
}

function pluralItem(itemName: string, count: number) {
  return count === 1 ? itemName : `${itemName}s`;
}

function displayNameForItemId(itemId: string) {
  return itemId
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const HARTHMERE_JOB_ITEM_SOURCE_DEFINITIONS: Record<
  string,
  HarthmereJobItemSourceDefinition
> = {
  wild_berries: {
    sourceKind: "gather",
    sourceName: "Garden Edge Berries",
    markerId: "grove_garden_edge_berries",
    hint: (itemName, missing) =>
      `Forage ${missing} ${pluralItem(
        itemName,
        missing
      )} at the marked Garden Edge Berries.`,
  },
  softwood_log: {
    sourceKind: "gather",
    sourceName: "Orchard Softwood Branches",
    markerId: "harthmere_orchard_softwood",
    markerPosition: [468, 53, -118],
    hint: (itemName, missing) =>
      `Gather ${missing} ${pluralItem(
        itemName,
        missing
      )} from fallen branches at the Orchard Softwood Branches.`,
  },
  oak_branch: {
    sourceKind: "gather",
    sourceName: "Orchard Softwood Branches",
    markerId: "harthmere_orchard_softwood",
    markerPosition: [468, 53, -118],
    hint: (itemName, missing) =>
      `Gather ${missing} ${pluralItem(
        itemName,
        missing
      )} from fallen branches at the Orchard Softwood Branches.`,
  },
  tree_resin: {
    sourceKind: "gather",
    sourceName: "Orchard Softwood Branches",
    markerId: "harthmere_orchard_softwood",
    markerPosition: [468, 53, -118],
    hint: (itemName, missing) =>
      `Gather wood in the Orchard for a chance at ${missing} ${pluralItem(
        itemName,
        missing
      )}.`,
  },
  iron_ore: {
    sourceKind: "gather",
    sourceName: "North Road Iron Vein",
    markerId: "harthmere_north_iron_vein",
    markerPosition: [503, 53, -270],
    hint: (itemName, missing) =>
      `Mine ${missing} ${pluralItem(
        itemName,
        missing
      )} at the North Road Iron Vein.`,
  },
  rough_stone: {
    sourceKind: "gather",
    sourceName: "North Road Iron Vein",
    markerId: "harthmere_north_iron_vein",
    markerPosition: [503, 53, -270],
    hint: (itemName, missing) =>
      `Mine ${missing} ${pluralItem(
        itemName,
        missing
      )} from the rocky shoulder at the North Road Iron Vein.`,
  },
  iron_ingot: {
    sourceKind: "craft",
    sourceName: "Forge or Metal Vendor",
    markerId: "harthmere_owner:npc_outpost_metalmarket_smith",
    hint: (itemName, missing) =>
      `Smelt or buy ${missing} ${pluralItem(
        itemName,
        missing
      )} before turning in this job.`,
  },
  wood_plank: {
    sourceKind: "craft",
    sourceName: "Fountain Workbench",
    markerId: "grove_fountain_workbench",
    hint: (itemName, missing) =>
      `Craft or buy ${missing} ${pluralItem(
        itemName,
        missing
      )}. Start at the Fountain Workbench, or buy planks from a building-materials vendor.`,
  },
  road_ration: {
    sourceKind: "vendor",
    sourceName: "Fountain Food Satchel",
    markerId: "grove_mail_bank_satchel",
    hint: (itemName, missing) =>
      `Take or buy ${missing} ${pluralItem(
        itemName,
        missing
      )} from food supplies such as the Fountain Food Satchel.`,
  },
  clean_water: {
    sourceKind: "gather",
    sourceName: "Water Supply",
    markerId: "grove_mail_bank_satchel",
    hint: (itemName, missing) =>
      `Gather or buy ${missing} ${pluralItem(
        itemName,
        missing
      )} from Grove supply containers or water vendors.`,
  },
  sealed_package: {
    sourceKind: "quest_grant",
    sourceName: "Accepted Delivery Parcel",
    hint: (itemName, missing) =>
      `This delivery should place ${missing} ${pluralItem(
        itemName,
        missing
      )} in your inventory when you accept it. Check your backpack, then return to the board if it did not sync.`,
  },
  repair_part: {
    sourceKind: "vendor",
    sourceName: "Hingehall Repair Shop",
    markerId: "harthmere_owner:npc_outpost_hingehall_fixer",
    hint: (itemName, missing) =>
      `Buy or craft ${missing} ${pluralItem(
        itemName,
        missing
      )} through Hingehall Repair Shop before returning to the job.`,
  },
  field_medkit: {
    sourceKind: "vendor",
    sourceName: "Clinic Supplies",
    markerId: "harthmere_owner:npc_outpost_clinic_medic",
    hint: (itemName, missing) =>
      `Buy ${missing} ${pluralItem(
        itemName,
        missing
      )} from clinic supplies before turning in this job.`,
  },
  minor_healing_salve: {
    sourceKind: "vendor",
    sourceName: "Clinic Supplies",
    markerId: "harthmere_owner:npc_outpost_clinic_medic",
    hint: (itemName, missing) =>
      `Buy or craft ${missing} ${pluralItem(
        itemName,
        missing
      )} through clinic supplies before turning in this job.`,
  },
  bandage: {
    sourceKind: "vendor",
    sourceName: "Clinic Supplies",
    markerId: "harthmere_owner:npc_outpost_clinic_medic",
    hint: (itemName, missing) =>
      `Buy or craft ${missing} ${pluralItem(
        itemName,
        missing
      )} through clinic supplies before turning in this job.`,
  },
  mixed_waste: {
    sourceKind: "gather",
    sourceName: "Cleanup Yards",
    markerId: "harthmere_owner:npc_outpost_clearbarrel_boss",
    hint: (itemName, missing) =>
      `Collect ${missing} ${pluralItem(
        itemName,
        missing
      )} through cleanup work, or ask Clearbarrel Depot for sanitation work.`,
  },
};

export function harthmereJobItemSourceGuidance(input: {
  kind?: string;
  requirements?: HarthmereJobsBoardRequirement[];
  inventoryItems?: Record<string, number>;
}): HarthmereJobItemSourceGuidance | undefined {
  const requirements = input.requirements ?? [];
  const deliveryPlan = harthmereDeliveryPlan({
    kind: input.kind,
    requirements,
  });
  for (const req of requirements) {
    if (!req.itemId) continue;
    const required = requiredCount(req);
    const have = Math.max(
      0,
      Math.floor(Number(input.inventoryItems?.[req.itemId] ?? 0))
    );
    if (have >= required) continue;
    const missing = Math.max(1, required - have);
    const itemName = displayNameForItemId(req.itemId);
    if (req.pickupMarkerId) {
      return {
        itemId: req.itemId,
        itemName,
        requiredCount: required,
        haveCount: have,
        missingCount: missing,
        sourceKind: "pickup",
        sourceName: req.pickupMarkerId,
        markerId: req.pickupMarkerId,
        hint: `Pick up ${missing} ${pluralItem(
          itemName,
          missing
        )} at the marked pickup spot, then continue the job.`,
      };
    }
    const definition = HARTHMERE_JOB_ITEM_SOURCE_DEFINITIONS[req.itemId];
    if (definition) {
      return {
        itemId: req.itemId,
        itemName,
        requiredCount: required,
        haveCount: have,
        missingCount: missing,
        sourceKind:
          deliveryPlan?.parcelItemId === req.itemId &&
          deliveryPlan.grantOnAccept
            ? "quest_grant"
            : definition.sourceKind,
        sourceName: definition.sourceName,
        markerId: definition.markerId,
        markerPosition: definition.markerPosition
          ? ([...definition.markerPosition] as Vec3)
          : undefined,
        hint: definition.hint(itemName, missing),
      };
    }
    if (
      req.mapMarkerId &&
      (input.kind === "gather" || input.kind === "cleanup")
    ) {
      return {
        itemId: req.itemId,
        itemName,
        requiredCount: required,
        haveCount: have,
        missingCount: missing,
        sourceKind: input.kind === "cleanup" ? "loot" : "gather",
        sourceName: req.targetName ?? req.mapMarkerId,
        markerId: req.mapMarkerId,
        hint: `Get ${missing} ${pluralItem(itemName, missing)} at the marked ${
          req.targetName ?? "job location"
        }.`,
      };
    }
    return {
      itemId: req.itemId,
      itemName,
      requiredCount: required,
      haveCount: have,
      missingCount: missing,
      sourceKind: "unknown",
      sourceName: "Inventory Requirement",
      markerId: req.mapMarkerId,
      hint: `Obtain ${missing} ${pluralItem(
        itemName,
        missing
      )} through gathering, crafting, vendors, or loot before turning in this job.`,
    };
  }
  return undefined;
}

// HARTHMERE_JOB_REQUIRED_TOOL: which equipped tool action a job KIND demands
// before its field work can be done. Repair jobs need a repair tool; cleanup jobs
// need a cleanup tool. Every other kind needs none. Pure so both the map adapter
// and the quest detail can agree on "does this job need a tool the player lacks".
export function harthmereJobRequiredToolAction(
  kind: string | undefined
): string | undefined {
  if (kind === "repair") {
    return "repair";
  }
  if (kind === "cleanup") {
    return "cleanup";
  }
  return undefined;
}

export interface HarthmereJobToolSourceGuidance extends HarthmereToolSource {
  // A complete, user-facing sentence telling the player WHERE to buy the tool.
  hint: string;
}

// The single resolver for "this job needs a tool the player does NOT OWN — here is
// the business that sells it". Returns undefined when the kind needs no tool, when
// the player already OWNS the tool (they just need to equip it — no shopping trip),
// or when no vendor is registered. The redirect is keyed on OWNERSHIP, not on
// whether the tool is equipped: a player who already has the tool is sent to the
// job, never to a shop.
export function harthmereJobToolSourceGuidance(input: {
  kind?: string;
  toolOwned?: boolean;
}): HarthmereJobToolSourceGuidance | undefined {
  const action = harthmereJobRequiredToolAction(input.kind);
  if (!action) {
    return undefined;
  }
  if (input.toolOwned !== false) {
    // Owns it (or ownership unknown) -> no buy redirect.
    return undefined;
  }
  const source = harthmereToolSourceForAction(action);
  if (!source) {
    return undefined;
  }
  const what =
    action === "cleanup"
      ? `${source.toolName} (it turns muck back into dirt)`
      : source.toolName;
  return {
    ...source,
    hint: `You don't own a ${what} for this job. Buy one from ${source.vendorName} at the marked shop, then return to the job.`,
  };
}

function firstItemRequirement(
  requirements: HarthmereJobsBoardRequirement[] | undefined
): HarthmereJobsBoardRequirement | undefined {
  return (requirements ?? []).find((req) => req.itemId);
}

function requiredCount(req: HarthmereJobsBoardRequirement | undefined) {
  return Math.max(1, Math.floor(req?.count ?? req?.serviceUnits ?? 1));
}

function boardPhase(
  kind: string,
  boardMarkerId: string,
  hint: string,
  extra: Partial<HarthmereJobMarkerPlan> = {}
): HarthmereJobMarkerPlan {
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
export function harthmereJobMarkerPlan(input: {
  kind?: string;
  requirements?: HarthmereJobsBoardRequirement[];
  fieldMarkerId?: string;
  boardMarkerId: string;
  progress?: HarthmereJobProgress;
}): HarthmereJobMarkerPlan {
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
    const plan = harthmereDeliveryPlan({
      kind,
      requirements: input.requirements,
    });
    const deliveryRequirement = harthmereDeliveryRequirement({
      kind,
      requirements: input.requirements,
    });
    const recipientMarker = plan?.recipient.markerId ?? fieldMarker;
    const parcelName = plan?.parcelItemId
      ? displayNameForItemId(plan.parcelItemId)
      : "the parcel";
    const recipientName =
      deliveryRequirement?.targetName?.trim() ||
      (plan?.recipient.kind === "person"
        ? "the marked recipient"
        : "the marked drop-off");
    if (progress.deliveredToRecipient) {
      return boardPhase(
        kind,
        board,
        "Delivered. Return to the jobs board to collect your reward."
      );
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
          ? `Take ${parcelName} to ${recipientName} and talk to them to hand it over.`
          : `Deliver ${parcelName} to ${recipientName}. Stand at the drop-off and press F to complete the delivery.`,
    };
  }

  // ---- Gather -------------------------------------------------------------
  if (kind === "gather") {
    const req = firstItemRequirement(input.requirements);
    const required = requiredCount(req);
    const have = Math.max(0, Math.floor(progress.gatheredCount ?? 0));
    if (have >= required) {
      // Distinct messaging for the "already had them" shortcut so it is obvious
      // and never looks like the job auto-completed by mistake.
      const hint = progress.satisfiedOnAccept
        ? `You already have ${required} ${
            req?.itemId ?? "materials"
          } — no gathering needed. Return to the jobs board to hand them in.`
        : `Gathered ${required}/${required}. Return to the jobs board to hand them in.`;
      return boardPhase(kind, board, hint, {
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
      hint: `Gather ${have}/${required} ${
        req?.itemId ?? "materials"
      } at the marked spot.`,
      requiredCount: required,
      currentCount: have,
    };
  }

  // ---- Cleanup ------------------------------------------------------------
  if (kind === "cleanup") {
    const req =
      (input.requirements ?? []).find((r) => r.itemId) ??
      (input.requirements ?? [])[0];
    const required = requiredCount(req);
    const cleaned = Math.max(0, Math.floor(progress.cleanedCount ?? 0));
    if (cleaned >= required) {
      return boardPhase(
        kind,
        board,
        `Cleared ${required}/${required}. Return to the jobs board to collect your reward.`,
        { requiredCount: required, currentCount: cleaned }
      );
    }
    // Does NOT own the tool -> redirect to the shop that sells it. Once owned, the
    // marker flips back to the muck (the player can equip the tool they bought).
    if (progress.toolOwned === false) {
      const source = harthmereToolSourceForAction("cleanup");
      return {
        kind,
        phase: "field",
        activeMarkerId:
          source?.vendorMarkerId ?? req?.mapMarkerId ?? fieldMarker,
        boardMarkerId: board,
        objectiveMet: false,
        needsToolAction: "cleanup",
        hint: source
          ? `You don't own a ${source.toolName} (it turns muck back into dirt). Buy one from ${source.vendorName} at the marked shop, then return to the muck.`
          : "Get a cleanup tool to clear the marked muck.",
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
      hint:
        progress.toolEquipped === false
          ? `Equip your cleanup tool, then clear ${cleaned}/${required} muck at the marked spot.`
          : `Clear ${cleaned}/${required} muck at the marked spot with your cleanup tool.`,
      requiredCount: required,
      currentCount: cleaned,
    };
  }

  // ---- Repair -------------------------------------------------------------
  if (kind === "repair") {
    if (progress.repaired) {
      return boardPhase(
        kind,
        board,
        "Repaired. Return to the jobs board to collect your reward."
      );
    }
    // Does NOT own the tool -> redirect to the shop that sells it. Once owned, the
    // marker flips back to the structure (the player can equip the tool they bought).
    if (progress.toolOwned === false) {
      const source = harthmereToolSourceForAction("repair");
      return {
        kind,
        phase: "field",
        activeMarkerId: source?.vendorMarkerId ?? fieldMarker,
        boardMarkerId: board,
        objectiveMet: false,
        needsToolAction: "repair",
        hint: source
          ? `You don't own a ${source.toolName} to fix this. Buy one from ${source.vendorName} at the marked shop, then return to the structure.`
          : "Get a repair tool to fix the marked structure.",
      };
    }
    return {
      kind,
      phase: "field",
      activeMarkerId: fieldMarker,
      boardMarkerId: board,
      objectiveMet: false,
      hint:
        progress.toolEquipped === false
          ? "Equip your repair tool, then repair the marked structure."
          : "Repair the marked structure with your repair tool.",
    };
  }

  // ---- Escort -------------------------------------------------------------
  if (kind === "escort") {
    if (progress.escortArrived) {
      return boardPhase(
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
  if (progress.satisfiedOnAccept || progress.inventoryRequirementsSatisfied) {
    return boardPhase(
      kind,
      board,
      progress.satisfiedOnAccept
        ? "Objective complete. Return to the jobs board to collect your reward."
        : "Required items are ready. Return to the jobs board to turn them in."
    );
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

// HARTHMERE_JOB_TRACKING: with several active jobs, only one can guide the
// player at a time. This picks which job is "tracked" (its marker is the active
// one): an explicit player selection wins; otherwise the most-recently-accepted
// non-expired job. Expired jobs are never tracked.
export interface HarthmereTrackableJob {
  jobId: string;
  kind: string;
  acceptedAtMs?: number;
  deadlineAtMs?: number;
  requirements?: HarthmereJobsBoardRequirement[];
  fieldMarkerId?: string;
  progress?: HarthmereJobProgress;
}

function jobExpired(job: HarthmereTrackableJob, nowMs: number): boolean {
  return (
    job.deadlineAtMs !== undefined &&
    Number.isFinite(job.deadlineAtMs) &&
    job.deadlineAtMs <= nowMs
  );
}

export function harthmereSelectTrackedJob(
  jobs: readonly HarthmereTrackableJob[],
  trackedJobId: string | undefined,
  nowMs: number
): HarthmereTrackableJob | undefined {
  const active = jobs.filter((job) => !jobExpired(job, nowMs));
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
export function harthmereTrackedJobMarkerPlan(input: {
  jobs: readonly HarthmereTrackableJob[];
  trackedJobId: string | undefined;
  boardMarkerId: string;
  nowMs: number;
}): { jobId: string; plan: HarthmereJobMarkerPlan } | undefined {
  const job = harthmereSelectTrackedJob(
    input.jobs,
    input.trackedJobId,
    input.nowMs
  );
  if (!job) {
    return undefined;
  }
  return {
    jobId: job.jobId,
    plan: harthmereJobMarkerPlan({
      kind: job.kind,
      requirements: job.requirements,
      fieldMarkerId: job.fieldMarkerId,
      boardMarkerId: input.boardMarkerId,
      progress: job.progress,
    }),
  };
}

// HARTHMERE_JOB_NOTIFICATION: surface a one-time notification when a job
// becomes ready to turn in (objective met) or has expired, so the player is told
// instead of silently noticing the marker move.
export type HarthmereJobNotification =
  | { kind: "ready_to_turn_in"; jobId: string; message: string }
  | { kind: "expired"; jobId: string; message: string }
  | { kind: "failed"; jobId: string; message: string };

export function harthmereJobNotification(input: {
  jobId: string;
  jobTitle?: string;
  deadlineAtMs?: number;
  nowMs: number;
  objectiveMet: boolean;
  failed?: boolean;
}): HarthmereJobNotification | undefined {
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
export { HARTHMERE_BUSINESS_OWNER_MARKER_PREFIX };
