import { addToast } from "@/client/components/toast/helpers";
import {
  type HarthmereDailyTaskActivityIdV1,
  completeHarthmereDailyTaskSoonV1,
} from "@/client/components/challenges/harthmereDailyTasks";
import { isHarthmereRepairToolEquippedV151 } from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  harthmereCookingStationIdV1,
  openHarthmereCookingStationV1,
} from "@/client/components/harthmere_cooking/harthmereCookingStations";
import {
  harthmereGatheringNodeIdForObjectLabelV1,
  performHarthmereGather,
} from "@/client/components/challenges/LocalDevHarthmereGatheringSystem";
import { dispatchHarthmereHudActionEventV96 } from "@/shared/harthmere/harthmere_hud_key_bindings_v96";
import type { HarthmereObjectInteractionV1 } from "@/shared/harthmere/object_interaction_semantics_v1";

export const HARTHMERE_JOBS_BOARD_OPEN_EVENT_V141 =
  "biomes:harthmere-jobs-board-open-v141" as const;
export const HARTHMERE_WANTED_BOARD_OPEN_EVENT_V1 =
  "biomes:harthmere-wanted-board-open-v1" as const;

// HARTHMERE_REPAIR_PERFORMED_EVENT_V151: fired when the player interacts with a
// repair target. `repaired` is true only when a repair tool is equipped — that
// is the signal the jobs-board completion flow uses to send usedToolAction and
// (engine phase) to restore the broken structure's blocks.
export const HARTHMERE_REPAIR_PERFORMED_EVENT_V151 =
  "biomes:harthmere-repair-performed-v151" as const;

export interface HarthmereRepairPerformedEventDetailV151 {
  entityId?: unknown;
  label?: string | null;
  repaired: boolean;
}

export const HARTHMERE_WORLD_OBJECT_INTERACTION_EVENT_V1 =
  "biomes:harthmere-world-object-interaction-v1" as const;

export interface HarthmereWorldObjectInteractionEventDetailV1 {
  entityId?: unknown;
  label?: string | null;
  kind: HarthmereObjectInteractionV1["kind"];
  title: string;
}

const HARTHMERE_READABLE_OBJECT_TEXT_V1 = new Map<string, string>(
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

function normalizedLabelV1(label?: string | null) {
  return (label ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function harthmereReadableObjectTextForLabelV1(label?: string | null) {
  return HARTHMERE_READABLE_OBJECT_TEXT_V1.get(normalizedLabelV1(label));
}

export function harthmereObjectInteractionToastMessageV1(input: {
  label?: string | null;
  interaction: HarthmereObjectInteractionV1;
}) {
  const displayLabel = input.label?.trim() || "World object";
  if (input.interaction.kind === "read") {
    return (
      harthmereReadableObjectTextForLabelV1(input.label) ??
      `Read ${displayLabel}.`
    );
  }
  return `${input.interaction.toastVerb} ${displayLabel}.`;
}

function dailyTasksForObjectInteractionV1(input: {
  label?: string | null;
  interaction: HarthmereObjectInteractionV1;
}): HarthmereDailyTaskActivityIdV1[] {
  const label = (input.label ?? "").toLowerCase();
  const tasks = new Set<HarthmereDailyTaskActivityIdV1>();
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

export function dispatchHarthmereWorldObjectInteractionEventV1(
  detail: HarthmereWorldObjectInteractionEventDetailV1
) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_WORLD_OBJECT_INTERACTION_EVENT_V1, {
      detail,
    })
  );
}

export function performHarthmereObjectInteractionV1(input: {
  label?: string | null;
  entityId: unknown;
  interaction: HarthmereObjectInteractionV1;
  resources: Parameters<typeof addToast>[0];
  gardenHose: { publish: (event: { kind: "inspect_frame" }) => void };
}) {
  dispatchHarthmereWorldObjectInteractionEventV1({
    entityId: input.entityId,
    label: input.label,
    kind: input.interaction.kind,
    title: input.interaction.title,
  });
  for (const activityId of dailyTasksForObjectInteractionV1(input)) {
    completeHarthmereDailyTaskSoonV1(activityId);
  }

  if (
    input.interaction.kind === "open_jobs_board" ||
    input.interaction.kind === "open_wanted_board"
  ) {
    const eventName =
      input.interaction.kind === "open_wanted_board"
        ? HARTHMERE_WANTED_BOARD_OPEN_EVENT_V1
        : HARTHMERE_JOBS_BOARD_OPEN_EVENT_V141;
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(eventName, {
          detail: {
            source: "harthmere_object_interaction",
            entityId: input.entityId,
            label: input.label,
          },
        })
      );
    }
    return;
  }

  if (input.interaction.kind === "cook") {
    const stationKind = input.interaction.stationKind ?? "campfire";
    const stationId = harthmereCookingStationIdV1(input.entityId, input.label);
    openHarthmereCookingStationV1({
      stationId,
      stationKind,
      label: input.label,
      entityId: input.entityId,
    });
    return;
  }

  if (input.interaction.kind === "craft") {
    dispatchHarthmereHudActionEventV96("crafting");
  }

  if (input.interaction.kind === "gather") {
    const nodeId = harthmereGatheringNodeIdForObjectLabelV1(input.label);
    if (nodeId) {
      const result = performHarthmereGather(nodeId);
      addToast(input.resources, {
        kind: "basic",
        id: `harthmere-gather:${nodeId}`,
        message:
          result.message ??
          harthmereObjectInteractionToastMessageV1({
            label: input.label,
            interaction: input.interaction,
          }),
      });
      return;
    }
  }

  // HARTHMERE_REPAIR_TOOL_EQUIP_V151: a repair only happens with a repair tool
  // EQUIPPED. With one, restore the structure (emit the repair-performed signal
  // the job flow consumes) and confirm; without one, direct the player to get
  // and equip a repair tool first instead of silently "repairing" nothing.
  if (input.interaction.kind === "repair") {
    const repaired = isHarthmereRepairToolEquippedV151();
    const repairLabel = input.label?.trim() || "the structure";
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(HARTHMERE_REPAIR_PERFORMED_EVENT_V151, {
          detail: {
            entityId: input.entityId,
            label: input.label,
            repaired,
          } satisfies HarthmereRepairPerformedEventDetailV151,
        })
      );
    }
    addToast(input.resources, {
      kind: "basic",
      id: `harthmere-repair:${String(input.entityId)}`,
      message: repaired
        ? `Repaired ${repairLabel} — your repair tool restored the broken blocks.`
        : `Equip a repair tool to fix ${repairLabel}. Buy or craft a Repair Mallet, equip it in your main hand, then try again.`,
    });
    return;
  }

  addToast(input.resources, {
    kind: "basic",
    id: `harthmere-world-object:${input.entityId}:${input.interaction.kind}`,
    message: harthmereObjectInteractionToastMessageV1({
      label: input.label,
      interaction: input.interaction,
    }),
  });
}
