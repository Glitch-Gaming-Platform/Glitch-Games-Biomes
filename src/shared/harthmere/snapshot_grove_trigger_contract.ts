// SNAPSHOT_GROVE_TRIGGER_CONTRACT
// Shared runtime/test contract for Snapshot Grove tutorial quest triggers.
// This file intentionally keeps the original current module name because local
// Harthmere builds import it directly from the inventory, HUD runtime, and
// grounded quest tests. Do not remove it when adding newer aliases.

import type {
  SnapshotGroveQuest,
  SnapshotGroveTrigger,
} from "@/shared/harthmere/snapshot_grove_content";
import { BikkieIds } from "@/shared/bikkie/ids";

// Keep the event name ununified so a mixed local patch state where one file
// imports the current symbol and another imports a current alias still dispatches and
// listens on the same browser event.
export const HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT =
  "biomes:harthmere-local-dev-item-use";

export type SnapshotGroveCompletionEventKind =
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

export const SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS = {
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
  place_voxel: [
    "place_voxel",
    "place_placeable",
    "snapshot_grove_practice_action",
  ],
  inventory_change: [
    "inventory_change",
    "equip",
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
  combat: [
    "npc_damage",
    "npc_killed",
    "take_damage",
    "snapshot_grove_practice_action",
  ],
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
  item_use: ["harthmere_local_dev_item_use", "snapshot_grove_practice_action"],
  item_update: [
    "inventory_change",
    "local_inventory_selection_change",
    "selection_change",
    "snapshot_grove_practice_action",
  ],
  status_check: [
    "open_tab",
    "equip",
    "inventory_change",
    "snapshot_grove_practice_action",
  ],
  escort: ["move", "snapshot_grove_practice_action"],
  carry: ["move", "snapshot_grove_practice_action"],
} satisfies Record<
  SnapshotGroveTrigger,
  readonly SnapshotGroveCompletionEventKind[]
>;

export const SNAPSHOT_GROVE_CONTEXTUAL_PRACTICE_TRIGGER_KIND_SET =
  new Set<SnapshotGroveTrigger>([
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

export type SnapshotGroveItemUseObjectiveKind =
  | "food"
  | "healing"
  | "key"
  | "coil_or_bolt"
  | "hotbar_or_stone"
  | "generic";

export type SnapshotGroveInventoryObjectiveKind =
  | "equip_top"
  | "equip_bottoms"
  | "equip_camera"
  | "equip_clothing"
  | "organize"
  | "generic";

function objectiveText(
  quest: Pick<SnapshotGroveQuest, "id" | "title" | "objectives">,
  objectiveIndex: number
) {
  const safeIndex = Math.max(
    0,
    Math.min(quest.objectives.length - 1, objectiveIndex)
  );
  const objective = quest.objectives[safeIndex];
  return `${quest.id} ${quest.title} ${objective ?? ""}`.toLowerCase();
}

export function snapshotGroveItemUseObjectiveKind(
  quest: Pick<SnapshotGroveQuest, "id" | "title" | "objectives">,
  objectiveIndex: number
): SnapshotGroveItemUseObjectiveKind {
  const text = objectiveText(quest, objectiveIndex);
  if (/ration|food|snack|eat|stamina/.test(text)) {
    return "food";
  }
  if (
    /bandage|first.?aid|scratch|wound|medicine|salve|health|heal/.test(text)
  ) {
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

export function snapshotGroveItemUseEventMatchesObjective(
  event: {
    itemId?: unknown;
    itemName?: unknown;
    category?: unknown;
    subtype?: unknown;
    useEffect?: unknown;
  },
  quest: Pick<SnapshotGroveQuest, "id" | "title" | "objectives">,
  objectiveIndex: number
) {
  const itemText = `${event.itemId ?? ""} ${event.itemName ?? ""} ${
    event.category ?? ""
  } ${event.subtype ?? ""} ${event.useEffect ?? ""}`.toLowerCase();

  switch (snapshotGroveItemUseObjectiveKind(quest, objectiveIndex)) {
    case "food":
      return /ration|road_ration|food|snack|stamina|meal|bread|berry/.test(
        itemText
      );
    case "healing":
      return /bandage|salve|healing|heal|medicine|first.?aid|minor_healing_salve/.test(
        itemText
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

export function snapshotGroveInventoryObjectiveKind(
  quest: Pick<SnapshotGroveQuest, "id" | "title" | "objectives">,
  objectiveIndex: number
): SnapshotGroveInventoryObjectiveKind {
  const text = objectiveText(quest, objectiveIndex);
  if (/equip.*(travel )?top|wear.*(travel )?top/.test(text)) return "equip_top";
  if (/equip.*(bottom|trouser|pants)|wear.*(bottom|trouser|pants)/.test(text)) {
    return "equip_bottoms";
  }
  if (/equip.*camera|wear.*camera/.test(text)) return "equip_camera";
  if (/equip|wear|clothing|outfit|road-ready|travel-ready/.test(text)) {
    return "equip_clothing";
  }
  if (/store|organize|sort|move/.test(text)) return "organize";
  return "generic";
}

export function snapshotGroveInventoryEventMatchesObjective(
  event: {
    kind?: unknown;
    itemId?: unknown;
    itemName?: unknown;
    category?: unknown;
    slot?: unknown;
    operation?: unknown;
    equipmentSlots?: unknown;
  },
  quest: Pick<SnapshotGroveQuest, "id" | "title" | "objectives">,
  objectiveIndex: number
) {
  const objectiveKind = snapshotGroveInventoryObjectiveKind(
    quest,
    objectiveIndex
  );
  const operation = String(event.operation ?? "").toLowerCase();
  const eventKind = String(event.kind ?? "").toLowerCase();
  const slots = new Set(
    [
      typeof event.slot === "string" ? event.slot : undefined,
      ...(Array.isArray(event.equipmentSlots)
        ? event.equipmentSlots.filter(
            (slot): slot is string => typeof slot === "string"
          )
        : []),
    ]
      .filter(Boolean)
      .map((slot) => String(slot).toLowerCase())
  );
  const itemText = `${event.itemId ?? ""} ${event.itemName ?? ""} ${
    event.category ?? ""
  }`.toLowerCase();
  const isEquip =
    operation === "equip" || (eventKind === "equip" && operation !== "unequip");

  switch (objectiveKind) {
    case "equip_top":
      return (
        isEquip &&
        slots.has("chest") &&
        /top|shirt|tunic|apron|vest|jacket|coat|armor/.test(itemText)
      );
    case "equip_bottoms":
      return (
        isEquip &&
        slots.has("legs") &&
        /bottom|trouser|pants|legging|skirt|greaves/.test(itemText)
      );
    case "equip_camera":
      return isEquip && slots.has("main_hand") && /camera/.test(itemText);
    case "equip_clothing":
      return (
        isEquip &&
        /cosmetic|armor|armour|clothing|outfit|shirt|tunic|apron|trouser|pants|legging|skirt|boot|shoe|hat|helm|hood|cloak|cape|glove/.test(
          itemText
        ) &&
        [...slots].some((slot) =>
          ["head", "chest", "legs", "feet", "hands", "back", "neck"].includes(
            slot
          )
        )
      );
    case "organize":
      return (
        eventKind === "inventory_change" &&
        (operation === "move" ||
          operation === "store" ||
          operation === "sort" ||
          operation === "organize")
      );
    case "generic":
      return false;
  }
}

export function snapshotGroveCollectEventMatchesObjective(
  event: { itemId?: unknown; itemName?: unknown },
  quest: SnapshotGroveQuest,
  objectiveIndex: number
) {
  const fixture = snapshotGroveObjectiveCompletionFixture(
    quest,
    objectiveIndex
  );
  const expected = `${fixture?.itemId ?? ""} ${fixture?.itemName ?? ""}`
    .trim()
    .toLowerCase();
  const actual = `${event.itemId ?? ""} ${event.itemName ?? ""}`
    .trim()
    .toLowerCase();
  if (!expected || !actual) return false;
  if (fixture?.itemId && typeof event.itemId === "string") {
    return fixture.itemId.toLowerCase() === event.itemId.toLowerCase();
  }
  const expectedTokens = expected
    .split(/[^a-z0-9]+/)
    .filter(
      (token) =>
        token.length > 2 &&
        !["practice", "collect", "gather", "item", "trade"].includes(token)
    );
  return expectedTokens.some((token) => actual.includes(token));
}

export interface SnapshotGroveObjectiveFixture {
  kind: SnapshotGroveCompletionEventKind;
  questId: string;
  objectiveIndex: number;
  trigger: SnapshotGroveTrigger;
  markerId?: string;
  tab?: string;
  itemId?: string;
  itemName?: string;
  category?: string;
  subtype?: string;
  useEffect?: string;
  slot?: string;
  operation?: string;
  running?: boolean;
}

export function snapshotGrovePracticeItemFixtureForObjective(
  quest: Pick<SnapshotGroveQuest, "objectives">,
  objectiveIndex: number
): { itemId: string; quantity: number; label: string } | undefined {
  const text = (
    quest.objectives[
      Math.max(0, Math.min(quest.objectives.length - 1, objectiveIndex))
    ] ?? ""
  ).toLowerCase();
  if (
    /clean root|mucked root|root sample|muck sample|sealed muck|mudroot/.test(
      text
    )
  ) {
    return {
      itemId: "mudroot",
      quantity: 1,
      label: /mucked|muck|sealed/.test(text)
        ? "Mucked Root Sample"
        : "Clean Root Sample",
    };
  }
  if (/mushrooms?|fungus|spore|cap/.test(text)) {
    return { itemId: "forest_mushroom", quantity: 1, label: "Forage Mushroom" };
  }
  if (/grain|wheat|feed/.test(text)) {
    return { itemId: "field_wheat", quantity: 1, label: "Practice Grain" };
  }
  if (/bright berr|berries|berry/.test(text)) {
    return { itemId: "wild_berries", quantity: 1, label: "Bright Berries" };
  }
  if (/ration|food|snack|eat/.test(text)) {
    return { itemId: "road_ration", quantity: 1, label: "Road Ration" };
  }
  if (/bandage|first.?aid|scratch|wound|medicine|salve/.test(text)) {
    return {
      itemId: "minor_healing_salve",
      quantity: 1,
      label: "Practice Bandage",
    };
  }
  if (
    /wood scraps?|scrap wood|practice sticks?|sticks?|branches?|wheel|ingredients?|skewers?/.test(
      text
    )
  ) {
    return {
      itemId: "softwood_log",
      quantity: text.includes("three") || text.includes("3") ? 3 : 1,
      label: "Practice Wood",
    };
  }
  if (
    /stone|repair piece|block|road block|drop|dropped stack|stack back/.test(
      text
    )
  ) {
    return { itemId: "rough_stone", quantity: 1, label: "Practice Stone" };
  }
  if (/bolt|coil|metal|hinges?|part/.test(text)) {
    return { itemId: "scrap_metal", quantity: 1, label: "Road Bolt" };
  }
  if (/key/.test(text)) {
    return { itemId: "iron_key_blank", quantity: 1, label: "Practice Key" };
  }
  if (/camera|photo/.test(text)) {
    return { itemId: "old_coin", quantity: 1, label: "Camera Practice Token" };
  }
  if (/rubbings?|track rubbings?/.test(text)) {
    return {
      itemId: "cloth_scrap",
      quantity: text.includes("three") || text.includes("3") ? 3 : 1,
      label: "Track Rubbings",
    };
  }
  if (
    /cloth|trade slot|practice item|pail|parcel|packet|letter|slip|sack|basket|tray|order|recipe|tuning strip|strip/.test(
      text
    )
  ) {
    return {
      itemId: "cloth_scrap",
      quantity: 1,
      label: "Practice Trade Cloth",
    };
  }
  return undefined;
}

function expectedOpenTabForObjective(objective: string | undefined) {
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
  if (
    text.includes("mail") ||
    text.includes("storage") ||
    text.includes("recovery")
  ) {
    return "inbox";
  }
  if (
    text.includes("chat") ||
    text.includes("channel") ||
    text.includes("whisper")
  ) {
    return "chat";
  }
  if (text.includes("journal")) return "journal";
  if (text.includes("quest")) return "quests";
  if (
    text.includes("guild") ||
    text.includes("party") ||
    text.includes("combat")
  ) {
    return "tasks";
  }
  return undefined;
}

export function snapshotGroveObjectiveCompletionFixture(
  quest: SnapshotGroveQuest,
  objectiveIndex: number
): SnapshotGroveObjectiveFixture | undefined {
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
      switch (snapshotGroveInventoryObjectiveKind(quest, objectiveIndex)) {
        case "equip_top":
          return {
            ...base,
            kind: "equip",
            operation: "equip",
            slot: "chest",
            itemId: "baker_apron",
            itemName: "Travel Top Apron",
            category: "cosmetic",
          };
        case "equip_bottoms":
          return {
            ...base,
            kind: "equip",
            operation: "equip",
            slot: "legs",
            itemId: "field_trousers",
            itemName: "Travel Bottoms",
            category: "cosmetic",
          };
        case "equip_camera":
          return {
            ...base,
            kind: "equip",
            operation: "equip",
            slot: "main_hand",
            itemId: `b:${BikkieIds.camera}`,
            itemName: "Camera",
          };
        case "equip_clothing":
          return {
            ...base,
            kind: "equip",
            operation: "equip",
            slot: "chest",
            itemId: "baker_apron",
            itemName: "Road-ready Apron",
            category: "cosmetic",
          };
        case "organize":
          return { ...base, kind: "inventory_change", operation: "organize" };
        case "generic":
          return undefined;
      }
    case "open_tab":
      return {
        ...base,
        kind: "open_tab",
        tab: expectedOpenTabForObjective(objective),
      };
    case "jump_run":
      return { ...base, kind: "jump", running: true };
    case "photo_post":
      return { ...base, kind: "photo_post" };
    case "craft":
      return { ...base, kind: "craft" };
    case "combat":
      return { ...base, kind: "npc_damage" };
    case "collect": {
      const collectItem = snapshotGrovePracticeItemFixtureForObjective(
        quest,
        objectiveIndex
      );
      return collectItem
        ? {
            ...base,
            kind: "inventory_change",
            itemId: collectItem.itemId,
            itemName: collectItem.label,
          }
        : undefined;
    }
    case "choice":
      return { ...base, kind: "snapshot_grove_practice_action" };
    case "open_jobs_board":
      return { ...base, kind: "open_jobs_board" };
    case "item_grant":
      return { ...base, kind: "inventory_change" };
    case "item_update":
      return { ...base, kind: "inventory_change" };
    case "status_check":
      return {
        ...base,
        kind: "open_tab",
        tab: expectedOpenTabForObjective(objective),
      };
    case "escort":
    case "carry":
      return { ...base, kind: "move" };
    case "item_use":
      switch (snapshotGroveItemUseObjectiveKind(quest, objectiveIndex)) {
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

export interface SnapshotGroveTutorialInventoryGrant {
  questId: string;
  itemId: string;
  itemName: string;
  quantity: number;
  objectiveIndexes: number[];
  trigger: "item_use" | "inventory_change";
}

export function snapshotGroveTutorialInventoryGrantsForQuest(
  quest: SnapshotGroveQuest
): SnapshotGroveTutorialInventoryGrant[] {
  const grantsByItemId = new Map<string, SnapshotGroveTutorialInventoryGrant>();

  for (
    let objectiveIndex = 0;
    objectiveIndex < quest.triggers.length;
    objectiveIndex += 1
  ) {
    const trigger = quest.triggers[objectiveIndex];
    if (trigger !== "item_use" && trigger !== "inventory_change") {
      continue;
    }

    const fixture = snapshotGroveObjectiveCompletionFixture(
      quest,
      objectiveIndex
    );
    if (
      !fixture?.itemId ||
      (fixture.kind !== "harthmere_local_dev_item_use" &&
        fixture.kind !== "equip")
    ) {
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
      trigger,
    });
  }

  return [...grantsByItemId.values()];
}

export interface SnapshotGroveTriggerContractReport {
  unsupportedTriggers: string[];
  uncoveredTriggers: string[];
  markerViolations: string[];
  objectiveFixtureViolations: string[];
  itemUseObjectiveViolations: string[];
  arrayLengthViolations: string[];
}

export function validateSnapshotGroveTriggerContracts(
  quests: readonly SnapshotGroveQuest[]
): SnapshotGroveTriggerContractReport {
  const unsupportedTriggers: string[] = [];
  const uncoveredTriggers: string[] = [];
  const markerViolations: string[] = [];
  const objectiveFixtureViolations: string[] = [];
  const itemUseObjectiveViolations: string[] = [];
  const arrayLengthViolations: string[] = [];

  for (const quest of quests) {
    if (quest.objectives.length !== quest.triggers.length) {
      arrayLengthViolations.push(
        `${quest.id}: objectives(${quest.objectives.length}) != triggers(${quest.triggers.length})`
      );
    }
    if (quest.objectives.length !== quest.markerIds.length) {
      arrayLengthViolations.push(
        `${quest.id}: objectives(${quest.objectives.length}) != markerIds(${quest.markerIds.length})`
      );
    }

    for (
      let objectiveIndex = 0;
      objectiveIndex < quest.objectives.length;
      objectiveIndex += 1
    ) {
      const trigger = quest.triggers[objectiveIndex];
      const markerId = quest.markerIds[objectiveIndex];
      const objective = quest.objectives[objectiveIndex];
      const label = `${quest.id}[${objectiveIndex}] ${objective}`;

      if (!trigger) {
        unsupportedTriggers.push(`${label}: missing trigger`);
        continue;
      }
      if (
        !Object.prototype.hasOwnProperty.call(
          SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS,
          trigger
        )
      ) {
        unsupportedTriggers.push(`${label}: unsupported trigger '${trigger}'`);
        continue;
      }

      const coveredEvents = SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS[
        trigger
      ] as readonly SnapshotGroveCompletionEventKind[];
      if (!coveredEvents.length) {
        uncoveredTriggers.push(
          `${label}: trigger '${trigger}' has no completion events`
        );
      }
      if (!markerId || !String(markerId).trim()) {
        markerViolations.push(`${label}: missing markerId`);
      }

      const fixture = snapshotGroveObjectiveCompletionFixture(
        quest,
        objectiveIndex
      );
      if (!fixture) {
        objectiveFixtureViolations.push(
          `${label}: no synthetic completion fixture for '${trigger}'`
        );
      } else if (!coveredEvents.includes(fixture.kind)) {
        objectiveFixtureViolations.push(
          `${label}: fixture '${fixture.kind}' is not covered by '${trigger}'`
        );
      }

      if (trigger === "item_use") {
        const itemKind = snapshotGroveItemUseObjectiveKind(
          quest,
          objectiveIndex
        );
        if (itemKind === "generic") {
          itemUseObjectiveViolations.push(
            `${label}: item_use objective does not identify a usable item family`
          );
        } else if (
          fixture &&
          !snapshotGroveItemUseEventMatchesObjective(
            fixture,
            quest,
            objectiveIndex
          )
        ) {
          itemUseObjectiveViolations.push(
            `${label}: item_use fixture does not match objective family '${itemKind}'`
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
