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
import {
  harthmereGatheringNodeIdForObjectLabel,
  performHarthmereGather,
} from "@/client/components/challenges/LocalDevHarthmereGatheringSystem";
import {
  HARTHMERE_JOBS_BOARD_OPEN_EVENT,
  HARTHMERE_WANTED_BOARD_OPEN_EVENT,
} from "@/client/components/challenges/harthmereEvents";
import { dispatchHarthmereHudActionEvent } from "@/shared/harthmere/harthmere_hud_key_bindings";
import type { HarthmereObjectInteraction } from "@/shared/harthmere/object_interaction_semantics";

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
  label?: string | null;
  kind: HarthmereObjectInteraction["kind"];
  title: string;
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

export function performHarthmereObjectInteraction(input: {
  label?: string | null;
  entityId: unknown;
  interaction: HarthmereObjectInteraction;
  resources: Parameters<typeof addToast>[0];
  gardenHose: { publish: (event: { kind: "inspect_frame" }) => void };
}) {
  dispatchHarthmereWorldObjectInteractionEvent({
    entityId: input.entityId,
    label: input.label,
    kind: input.interaction.kind,
    title: input.interaction.title,
  });
  for (const activityId of dailyTasksForObjectInteraction(input)) {
    completeHarthmereDailyTaskSoon(activityId);
  }

  if (
    input.interaction.kind === "open_jobs_board" ||
    input.interaction.kind === "open_wanted_board"
  ) {
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
            label: input.label,
          },
        })
      );
    }
    return;
  }

  if (input.interaction.kind === "cook") {
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
    dispatchHarthmereHudActionEvent("crafting");
  }

  if (input.interaction.kind === "gather") {
    const nodeId = harthmereGatheringNodeIdForObjectLabel(input.label);
    if (nodeId) {
      const result = performHarthmereGather(nodeId);
      addToast(input.resources, {
        kind: "basic",
        id: `harthmere-gather:${nodeId}`,
        message:
          result.message ??
          harthmereObjectInteractionToastMessage({
            label: input.label,
            interaction: input.interaction,
          }),
      });
      return;
    }
  }

  // HARTHMERE_REPAIR_TOOL_EQUIP: a repair only happens with a repair tool
  // EQUIPPED. With one, restore the structure (emit the repair-performed signal
  // the job flow consumes) and confirm; without one, direct the player to get
  // and equip a repair tool first instead of silently "repairing" nothing.
  if (input.interaction.kind === "repair") {
    const repaired = isHarthmereRepairToolEquipped();
    const repairLabel = input.label?.trim() || "the structure";
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(HARTHMERE_REPAIR_PERFORMED_EVENT, {
          detail: {
            entityId: input.entityId,
            label: input.label,
            repaired,
          } satisfies HarthmereRepairPerformedEventDetail,
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
    message: harthmereObjectInteractionToastMessage({
      label: input.label,
      interaction: input.interaction,
    }),
  });
}
