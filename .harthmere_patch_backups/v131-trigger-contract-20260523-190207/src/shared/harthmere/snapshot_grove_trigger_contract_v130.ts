// SNAPSHOT_GROVE_TRIGGER_CONTRACT_V130
// Shared test/runtime contract for Snapshot Grove tutorial quest triggers.
// Keep this data-only so quest tests can verify every authored objective has
// a supported completion path before the tutorial reaches QA.

import type {
  SnapshotGroveQuestV75,
  SnapshotGroveTriggerV75,
} from "@/shared/harthmere/snapshot_grove_content_v75";

export const HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT_V130 =
  "biomes:harthmere-local-dev-item-use-v130";

export type SnapshotGroveCompletionEventKindV130 =
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
  | "snapshot_grove_practice_action"
  | "move";

export const SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS_V130 = {
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
} satisfies Record<SnapshotGroveTriggerV75, readonly SnapshotGroveCompletionEventKindV130[]>;

export const SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGER_KIND_SET_V130 =
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

export type SnapshotGroveItemUseObjectiveKindV130 =
  | "food"
  | "healing"
  | "key"
  | "coil_or_bolt"
  | "hotbar_or_stone"
  | "generic";

function objectiveTextV130(
  quest: Pick<SnapshotGroveQuestV75, "id" | "title" | "objectives">,
  objectiveIndex: number,
) {
  const objective = quest.objectives[
    Math.max(0, Math.min(quest.objectives.length - 1, objectiveIndex))
  ];
  return `${quest.id} ${quest.title} ${objective ?? ""}`.toLowerCase();
}

export function snapshotGroveItemUseObjectiveKindV130(
  quest: Pick<SnapshotGroveQuestV75, "id" | "title" | "objectives">,
  objectiveIndex: number,
): SnapshotGroveItemUseObjectiveKindV130 {
  const text = objectiveTextV130(quest, objectiveIndex);
  if (/ration|food|snack|eat|stamina/.test(text)) return "food";
  if (/bandage|first.?aid|scratch|wound|medicine|salve|health|heal/.test(text)) return "healing";
  if (/key|supply box|unlock/.test(text)) return "key";
  if (/coil|bolt|metal|console/.test(text)) return "coil_or_bolt";
  if (/stone|block|hotbar|hold|repair piece/.test(text)) return "hotbar_or_stone";
  return "generic";
}

export function snapshotGroveItemUseEventMatchesObjectiveV130(
  event: Record<string, unknown>,
  quest: Pick<SnapshotGroveQuestV75, "id" | "title" | "objectives">,
  objectiveIndex: number,
) {
  const itemText = `${event.itemId ?? ""} ${event.itemName ?? ""} ${event.category ?? ""} ${event.subtype ?? ""} ${event.useEffect ?? ""}`.toLowerCase();
  switch (snapshotGroveItemUseObjectiveKindV130(quest, objectiveIndex)) {
    case "food":
      return /ration|road_ration|food|snack|stamina|meal|bread|berry/.test(itemText);
    case "healing":
      return /bandage|salve|healing|heal|medicine|first.?aid|minor_healing_salve/.test(itemText);
    case "key":
      return /key|iron_key|blank|supply/.test(itemText);
    case "coil_or_bolt":
      return /coil|bolt|metal|scrap_metal|console/.test(itemText);
    case "hotbar_or_stone":
      return /stone|rough_stone|block|repair|hotbar/.test(itemText);
    case "generic":
      return Boolean(itemText.trim());
  }
}

export type SnapshotGroveObjectiveFixtureV130 = {
  kind: SnapshotGroveCompletionEventKindV130;
  questId: string;
  objectiveIndex: number;
  trigger: SnapshotGroveTriggerV75;
  markerId?: string;
  tab?: string;
  itemId?: string;
  itemName?: string;
  useEffect?: string;
  running?: boolean;
};

function expectedOpenTabForObjectiveV130(objective: string | undefined) {
  const text = (objective ?? "").toLowerCase();
  if (text.includes("map") || text.includes("marker")) return "map";
  if (text.includes("inventory") || text.includes("bag") || text.includes("clothing") || text.includes("hotbar")) return "inventory";
  if (text.includes("recipe") || text.includes("craft")) return "crafting";
  if (text.includes("mail") || text.includes("storage") || text.includes("recovery")) return "inbox";
  if (text.includes("chat") || text.includes("channel") || text.includes("whisper")) return "chat";
  if (text.includes("journal")) return "journal";
  if (text.includes("quest")) return "quests";
  if (text.includes("guild") || text.includes("party") || text.includes("combat")) return "tasks";
  return undefined;
}

export function snapshotGroveObjectiveCompletionFixtureV130(
  quest: SnapshotGroveQuestV75,
  objectiveIndex: number,
): SnapshotGroveObjectiveFixtureV130 | undefined {
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
      return { ...base, kind: "open_tab", tab: expectedOpenTabForObjectiveV130(objective) };
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
      return { ...base, kind: "open_tab", tab: expectedOpenTabForObjectiveV130(objective) };
    case "escort":
    case "carry":
      return { ...base, kind: "move" };
    case "item_use": {
      switch (snapshotGroveItemUseObjectiveKindV130(quest, objectiveIndex)) {
        case "food":
          return { ...base, kind: "harthmere_local_dev_item_use", itemId: "road_ration", itemName: "Road Ration", useEffect: "stamina" };
        case "healing":
          return { ...base, kind: "harthmere_local_dev_item_use", itemId: "minor_healing_salve", itemName: "Practice Bandage", useEffect: "heal" };
        case "key":
          return { ...base, kind: "harthmere_local_dev_item_use", itemId: "iron_key_blank", itemName: "Practice Key", useEffect: "unlock" };
        case "coil_or_bolt":
          return { ...base, kind: "harthmere_local_dev_item_use", itemId: "scrap_metal", itemName: "Road Bolt", useEffect: "repair" };
        case "hotbar_or_stone":
          return { ...base, kind: "harthmere_local_dev_item_use", itemId: "rough_stone", itemName: "Practice Stone", useEffect: "hold" };
        case "generic":
          return undefined;
      }
    }
  }
}

export interface SnapshotGroveTriggerContractReportV130 {
  unsupportedTriggers: string[];
  uncoveredTriggers: string[];
  markerViolations: string[];
  objectiveFixtureViolations: string[];
  itemUseObjectiveViolations: string[];
}

export function validateSnapshotGroveTriggerContractsV130(
  quests: readonly SnapshotGroveQuestV75[],
): SnapshotGroveTriggerContractReportV130 {
  const unsupportedTriggers: string[] = [];
  const uncoveredTriggers: string[] = [];
  const markerViolations: string[] = [];
  const objectiveFixtureViolations: string[] = [];
  const itemUseObjectiveViolations: string[] = [];

  for (const quest of quests) {
    for (let objectiveIndex = 0; objectiveIndex < quest.objectives.length; objectiveIndex += 1) {
      const trigger = quest.triggers[objectiveIndex];
      const markerId = quest.markerIds[objectiveIndex];
      const objective = quest.objectives[objectiveIndex];
      const label = `${quest.id}[${objectiveIndex}] ${objective}`;

      if (!trigger) {
        unsupportedTriggers.push(`${label}: missing trigger`);
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS_V130, trigger)) {
        unsupportedTriggers.push(`${label}: unsupported trigger '${trigger}'`);
        continue;
      }
      const coveredEvents = SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS_V130[
        trigger
      ] as readonly SnapshotGroveCompletionEventKindV130[];
      if (!coveredEvents.length) {
        uncoveredTriggers.push(`${label}: trigger '${trigger}' has no completion events`);
      }
      if (!markerId || !String(markerId).trim()) {
        markerViolations.push(`${label}: missing markerId`);
      }
      const fixture = snapshotGroveObjectiveCompletionFixtureV130(quest, objectiveIndex);
      if (!fixture) {
        objectiveFixtureViolations.push(`${label}: no synthetic completion fixture for '${trigger}'`);
      } else if (!coveredEvents.includes(fixture.kind)) {
        objectiveFixtureViolations.push(`${label}: fixture '${fixture.kind}' is not covered by '${trigger}'`);
      }
      if (trigger === "item_use") {
        const kind = snapshotGroveItemUseObjectiveKindV130(quest, objectiveIndex);
        if (kind === "generic") {
          itemUseObjectiveViolations.push(`${label}: item_use objective does not identify a usable item family`);
        } else if (fixture && !snapshotGroveItemUseEventMatchesObjectiveV130(fixture, quest, objectiveIndex)) {
          itemUseObjectiveViolations.push(`${label}: item_use fixture does not match objective family '${kind}'`);
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
  };
}
