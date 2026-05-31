// SNAPSHOT_GROVE_TRIGGER_CONTRACT_V112
// Shared runtime/test contract for Snapshot Grove tutorial quest triggers.
// This file intentionally keeps the original v112 module name because local
// Harthmere builds import it directly from the inventory, HUD runtime, and
// grounded quest tests. Do not remove it when adding newer aliases.

import type {
  SnapshotGroveQuestV75,
  SnapshotGroveTriggerV75,
} from "@/shared/harthmere/snapshot_grove_content_v75";

// Keep the event name unversioned so a mixed local patch state where one file
// imports the v112 symbol and another imports a v130 alias still dispatches and
// listens on the same browser event.
export const HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT_V112 =
  "biomes:harthmere-local-dev-item-use";

export type SnapshotGroveCompletionEventKindV112 =
  | "talk_npc"
  | "arrival_distance_check"
  | "open_station"
  | "open_shop"
  | "inspect_frame"
  | "start_collide_placeable"
  | "start_collide_entity"
  | "destroy"
  | "place_voxel"
  | "place_placeable"
  | "inventory_change"
  | "equip"
  | "local_inventory_selection_change"
  | "selection_change"
  | "open_tab"
  | "jump"
  | "photo_post_attempt"
  | "photo_post"
  | "show_post_capture"
  | "craft"
  | "npc_damage"
  | "npc_killed"
  | "take_damage"
  | "inventory_overflow_item_received"
  | "mail_received"
  | "harthmere_local_dev_item_use"
  | "open_jobs_board"
  | "snapshot_grove_practice_action"
  | "move";

export const SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS_V112 = {
  talk_npc: ["talk_npc"],
  near_location: ["arrival_distance_check", "snapshot_grove_practice_action"],
  interact: [
    "open_station",
    "open_shop",
    "inspect_frame",
    "place_placeable",
    "start_collide_placeable",
    "start_collide_entity",
    "snapshot_grove_practice_action",
  ],
  destroy: ["destroy", "snapshot_grove_practice_action"],
  place_voxel: ["place_voxel", "place_placeable", "snapshot_grove_practice_action"],
  inventory_change: [
    "inventory_change",
    "equip",
    "local_inventory_selection_change",
    "selection_change",
    "snapshot_grove_practice_action",
  ],
  open_tab: ["open_tab"],
  jump_run: ["jump"],
  photo_post: [
    "photo_post_attempt",
    "photo_post",
    "show_post_capture",
    "snapshot_grove_practice_action",
  ],
  craft: ["craft", "snapshot_grove_practice_action"],
  combat: ["npc_damage", "npc_killed", "take_damage", "snapshot_grove_practice_action"],
  collect: [
    "inventory_change",
    "destroy",
    "inventory_overflow_item_received",
    "snapshot_grove_practice_action",
  ],
  choice: ["snapshot_grove_practice_action"],
  open_jobs_board: ["open_jobs_board", "snapshot_grove_practice_action"],
  item_grant: [
    "inventory_change",
    "inventory_overflow_item_received",
    "mail_received",
    "snapshot_grove_practice_action",
  ],
  item_use: [
    "harthmere_local_dev_item_use",
    "equip",
    "place_voxel",
    "take_damage",
    "snapshot_grove_practice_action",
  ],
  item_update: [
    "inventory_change",
    "local_inventory_selection_change",
    "selection_change",
    "snapshot_grove_practice_action",
  ],
  status_check: ["open_tab", "equip", "inventory_change", "snapshot_grove_practice_action"],
  escort: ["move", "snapshot_grove_practice_action"],
  carry: ["move", "snapshot_grove_practice_action"],
} satisfies Record<SnapshotGroveTriggerV75, readonly SnapshotGroveCompletionEventKindV112[]>;

export const SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGER_KIND_SET_V112 =
  new Set<SnapshotGroveTriggerV75>([
    "interact",
    "choice",
    "collect",
    "craft",
    "photo_post",
    "item_grant",
    "status_check",
    "item_use",
    "item_update",
    "escort",
    "carry",
  ]);

export type SnapshotGroveItemUseObjectiveKindV112 =
  | "food"
  | "healing"
  | "key"
  | "coil_or_bolt"
  | "hotbar_or_stone"
  | "generic";

function objectiveTextV112(
  quest: Pick<SnapshotGroveQuestV75, "id" | "title" | "objectives">,
  objectiveIndex: number,
) {
  const safeIndex = Math.max(0, Math.min(quest.objectives.length - 1, objectiveIndex));
  const objective = quest.objectives[safeIndex];
  return `${quest.id} ${quest.title} ${objective ?? ""}`.toLowerCase();
}

export function snapshotGroveItemUseObjectiveKindV112(
  quest: Pick<SnapshotGroveQuestV75, "id" | "title" | "objectives">,
  objectiveIndex: number,
): SnapshotGroveItemUseObjectiveKindV112 {
  const text = objectiveTextV112(quest, objectiveIndex);
  if (/ration|food|snack|eat|stamina/.test(text)) {
    return "food";
  }
  if (/bandage|first.?aid|scratch|wound|medicine|salve|health|heal/.test(text)) {
    return "healing";
  }
  if (/key|supply box|unlock/.test(text)) {
    return "key";
  }
  if (/coil|bolt|metal|console/.test(text)) {
    return "coil_or_bolt";
  }
  if (/stone|block|hotbar|hold|repair piece/.test(text)) {
    return "hotbar_or_stone";
  }
  return "generic";
}

export function snapshotGroveItemUseEventMatchesObjectiveV112(
  event: {
    itemId?: unknown;
    itemName?: unknown;
    category?: unknown;
    subtype?: unknown;
    useEffect?: unknown;
  },
  quest: Pick<SnapshotGroveQuestV75, "id" | "title" | "objectives">,
  objectiveIndex: number,
) {
  const itemText = `${event.itemId ?? ""} ${event.itemName ?? ""} ${
    event.category ?? ""
  } ${event.subtype ?? ""} ${event.useEffect ?? ""}`.toLowerCase();

  switch (snapshotGroveItemUseObjectiveKindV112(quest, objectiveIndex)) {
    case "food":
      return /ration|road_ration|food|snack|stamina|meal|bread|berry/.test(itemText);
    case "healing":
      return /bandage|salve|healing|heal|medicine|first.?aid|minor_healing_salve/.test(
        itemText,
      );
    case "key":
      return /key|iron_key|blank|supply|unlock/.test(itemText);
    case "coil_or_bolt":
      return /coil|bolt|metal|scrap_metal|console|repair/.test(itemText);
    case "hotbar_or_stone":
      return /stone|rough_stone|block|repair|hotbar|hold/.test(itemText);
    case "generic":
      return Boolean(itemText.trim());
  }
}

export interface SnapshotGroveObjectiveFixtureV112 {
  kind: SnapshotGroveCompletionEventKindV112;
  questId: string;
  objectiveIndex: number;
  trigger: SnapshotGroveTriggerV75;
  markerId?: string;
  tab?: string;
  itemId?: string;
  itemName?: string;
  category?: string;
  subtype?: string;
  useEffect?: string;
  running?: boolean;
}

function expectedOpenTabForObjectiveV112(objective: string | undefined) {
  const text = (objective ?? "").toLowerCase();
  if (text.includes("map") || text.includes("marker")) return "map";
  if (
    text.includes("inventory") ||
    text.includes("bag") ||
    text.includes("clothing") ||
    text.includes("hotbar")
  ) {
    return "inventory";
  }
  if (text.includes("recipe") || text.includes("craft")) return "crafting";
  if (text.includes("mail") || text.includes("storage") || text.includes("recovery")) {
    return "inbox";
  }
  if (text.includes("chat") || text.includes("channel") || text.includes("whisper")) {
    return "chat";
  }
  if (text.includes("journal")) return "journal";
  if (text.includes("quest")) return "quests";
  if (text.includes("guild") || text.includes("party") || text.includes("combat")) {
    return "tasks";
  }
  return undefined;
}

export function snapshotGroveObjectiveCompletionFixtureV112(
  quest: SnapshotGroveQuestV75,
  objectiveIndex: number,
): SnapshotGroveObjectiveFixtureV112 | undefined {
  const trigger = quest.triggers[objectiveIndex];
  if (!trigger) return undefined;

  const markerId = quest.markerIds[objectiveIndex];
  const objective = quest.objectives[objectiveIndex];
  const base = { questId: quest.id, objectiveIndex, trigger, markerId };

  switch (trigger) {
    case "talk_npc":
      return { ...base, kind: "talk_npc" };
    case "near_location":
      return { ...base, kind: "arrival_distance_check" };
    case "interact":
      return { ...base, kind: "open_station" };
    case "destroy":
      return { ...base, kind: "destroy" };
    case "place_voxel":
      return { ...base, kind: "place_voxel" };
    case "inventory_change":
      return { ...base, kind: "inventory_change" };
    case "open_tab":
      return { ...base, kind: "open_tab", tab: expectedOpenTabForObjectiveV112(objective) };
    case "jump_run":
      return { ...base, kind: "jump", running: true };
    case "photo_post":
      return { ...base, kind: "photo_post" };
    case "craft":
      return { ...base, kind: "craft" };
    case "combat":
      return { ...base, kind: "npc_damage" };
    case "collect":
      return { ...base, kind: "inventory_change" };
    case "choice":
      return { ...base, kind: "snapshot_grove_practice_action" };
    case "item_grant":
      return { ...base, kind: "inventory_change" };
    case "item_update":
      return { ...base, kind: "inventory_change" };
    case "status_check":
      return { ...base, kind: "open_tab", tab: expectedOpenTabForObjectiveV112(objective) };
    case "escort":
    case "carry":
      return { ...base, kind: "move" };
    case "item_use":
      switch (snapshotGroveItemUseObjectiveKindV112(quest, objectiveIndex)) {
        case "food":
          return {
            ...base,
            kind: "harthmere_local_dev_item_use",
            itemId: "road_ration",
            itemName: "Road Ration",
            category: "consumable",
            subtype: "food",
            useEffect: "stamina",
          };
        case "healing":
          return {
            ...base,
            kind: "harthmere_local_dev_item_use",
            itemId: "minor_healing_salve",
            itemName: "Practice Bandage",
            category: "consumable",
            subtype: "bandage",
            useEffect: "heal",
          };
        case "key":
          return {
            ...base,
            kind: "harthmere_local_dev_item_use",
            itemId: "iron_key_blank",
            itemName: "Practice Key",
            category: "quest",
            subtype: "key",
            useEffect: "unlock",
          };
        case "coil_or_bolt":
          return {
            ...base,
            kind: "harthmere_local_dev_item_use",
            itemId: "scrap_metal",
            itemName: "Road Bolt Coil",
            category: "quest",
            subtype: "repair",
            useEffect: "repair",
          };
        case "hotbar_or_stone":
          return {
            ...base,
            kind: "harthmere_local_dev_item_use",
            itemId: "rough_stone",
            itemName: "Practice Stone",
            category: "block",
            subtype: "stone",
            useEffect: "hold",
          };
        case "generic":
          return undefined;
      }
  }
}

export interface SnapshotGroveTutorialInventoryGrantV112 {
  questId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  objectiveIndexes: number[];
  trigger: "item_use";
}

export function snapshotGroveTutorialInventoryGrantsForQuestV112(
  quest: SnapshotGroveQuestV75,
): SnapshotGroveTutorialInventoryGrantV112[] {
  const grantsByItemId = new Map<string, SnapshotGroveTutorialInventoryGrantV112>();

  for (let objectiveIndex = 0; objectiveIndex < quest.triggers.length; objectiveIndex += 1) {
    if (quest.triggers[objectiveIndex] !== "item_use") {
      continue;
    }

    const fixture = snapshotGroveObjectiveCompletionFixtureV112(quest, objectiveIndex);
    if (fixture?.kind !== "harthmere_local_dev_item_use" || !fixture.itemId) {
      continue;
    }

    const existing = grantsByItemId.get(fixture.itemId);
    if (existing) {
      existing.quantity += 1;
      existing.objectiveIndexes.push(objectiveIndex);
      continue;
    }

    grantsByItemId.set(fixture.itemId, {
      questId: quest.id,
      itemId: fixture.itemId,
      itemName: fixture.itemName ?? fixture.itemId,
      quantity: 1,
      objectiveIndexes: [objectiveIndex],
      trigger: "item_use",
    });
  }

  return [...grantsByItemId.values()];
}

export interface SnapshotGroveTriggerContractReportV112 {
  unsupportedTriggers: string[];
  uncoveredTriggers: string[];
  markerViolations: string[];
  objectiveFixtureViolations: string[];
  itemUseObjectiveViolations: string[];
  arrayLengthViolations: string[];
}

export function validateSnapshotGroveTriggerContractsV112(
  quests: readonly SnapshotGroveQuestV75[],
): SnapshotGroveTriggerContractReportV112 {
  const unsupportedTriggers: string[] = [];
  const uncoveredTriggers: string[] = [];
  const markerViolations: string[] = [];
  const objectiveFixtureViolations: string[] = [];
  const itemUseObjectiveViolations: string[] = [];
  const arrayLengthViolations: string[] = [];

  for (const quest of quests) {
    if (quest.objectives.length !== quest.triggers.length) {
      arrayLengthViolations.push(
        `${quest.id}: objectives(${quest.objectives.length}) != triggers(${quest.triggers.length})`,
      );
    }
    if (quest.objectives.length !== quest.markerIds.length) {
      arrayLengthViolations.push(
        `${quest.id}: objectives(${quest.objectives.length}) != markerIds(${quest.markerIds.length})`,
      );
    }

    for (let objectiveIndex = 0; objectiveIndex < quest.objectives.length; objectiveIndex += 1) {
      const trigger = quest.triggers[objectiveIndex];
      const markerId = quest.markerIds[objectiveIndex];
      const objective = quest.objectives[objectiveIndex];
      const label = `${quest.id}[${objectiveIndex}] ${objective}`;

      if (!trigger) {
        unsupportedTriggers.push(`${label}: missing trigger`);
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS_V112, trigger)) {
        unsupportedTriggers.push(`${label}: unsupported trigger '${trigger}'`);
        continue;
      }

      const coveredEvents = SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS_V112[
        trigger
      ] as readonly SnapshotGroveCompletionEventKindV112[];
      if (!coveredEvents.length) {
        uncoveredTriggers.push(`${label}: trigger '${trigger}' has no completion events`);
      }
      if (!markerId || !String(markerId).trim()) {
        markerViolations.push(`${label}: missing markerId`);
      }

      const fixture = snapshotGroveObjectiveCompletionFixtureV112(quest, objectiveIndex);
      if (!fixture) {
        objectiveFixtureViolations.push(
          `${label}: no synthetic completion fixture for '${trigger}'`,
        );
      } else if (!coveredEvents.includes(fixture.kind)) {
        objectiveFixtureViolations.push(
          `${label}: fixture '${fixture.kind}' is not covered by '${trigger}'`,
        );
      }

      if (trigger === "item_use") {
        const itemKind = snapshotGroveItemUseObjectiveKindV112(quest, objectiveIndex);
        if (itemKind === "generic") {
          itemUseObjectiveViolations.push(
            `${label}: item_use objective does not identify a usable item family`,
          );
        } else if (fixture && !snapshotGroveItemUseEventMatchesObjectiveV112(fixture, quest, objectiveIndex)) {
          itemUseObjectiveViolations.push(
            `${label}: item_use fixture does not match objective family '${itemKind}'`,
          );
        }
      }
    }
  }

  return {
    unsupportedTriggers,
    uncoveredTriggers,
    markerViolations,
    objectiveFixtureViolations,
    itemUseObjectiveViolations,
    arrayLengthViolations,
  };
}
