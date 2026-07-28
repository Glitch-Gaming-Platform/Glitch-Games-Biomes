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

export const SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS = {
  roadTorch: "grove_road_torch",
  festivalSkewer: "grove_festival_skewer",
  festivalSkewerIngredients: "grove_festival_skewer_ingredients",
  warmLoafTray: "grove_warm_loaf_tray",
  heavyParcel: "grove_heavy_parcel",
  boltCrate: "grove_bolt_crate",
} as const;

export const SNAPSHOT_GROVE_TUTORIAL_RECIPE_IDS = {
  roadTorch: "harthmere_grove_road_torch",
  festivalSkewer: "harthmere_grove_festival_skewer",
} as const;

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
  new Set<SnapshotGroveTrigger>(["choice"]);

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

const SNAPSHOT_GROVE_REQUIRED_COUNT_OVERRIDES: Readonly<
  Record<string, number>
> = {
  "color_that_still_points_home:1": 2,
  "cart_that_forgot_its_wheel:1": 3,
  "moss_that_went_quiet:2": 3,
  "songline_under_the_lawn:0": 3,
  "antlers_for_the_watch:0": 3,
  "fountain_first_recipe_torch:1": 2,
};

const SNAPSHOT_GROVE_OBJECTIVE_TARGET_MARKER_OVERRIDES: Readonly<
  Record<string, readonly string[]>
> = {
  "color_that_still_points_home:1": [
    "muckwad_pigment_clump_west",
    "muckwad_pigment_clump_east",
  ],
  "moss_that_went_quiet:2": [
    "mosslawn_warning_moss_west",
    "mosslawn_warning_moss_center",
    "mosslawn_warning_moss_east",
  ],
  "songline_under_the_lawn:0": [
    "mosslawn_song_stone_low",
    "mosslawn_song_stone_middle",
    "mosslawn_song_stone_high",
  ],
  "antlers_for_the_watch:0": [
    "mosslawn_track_rubbing_hoof",
    "mosslawn_track_rubbing_antler",
    "mosslawn_track_rubbing_claw",
  ],
};

export function snapshotGroveObjectiveRequiredCount(
  quest: Pick<SnapshotGroveQuest, "id" | "objectives">,
  objectiveIndex: number
) {
  return (
    SNAPSHOT_GROVE_REQUIRED_COUNT_OVERRIDES[`${quest.id}:${objectiveIndex}`] ??
    1
  );
}

export function snapshotGroveObjectiveTargetMarkerIds(
  quest: Pick<SnapshotGroveQuest, "id" | "markerIds">,
  objectiveIndex: number
): readonly string[] {
  const override =
    SNAPSHOT_GROVE_OBJECTIVE_TARGET_MARKER_OVERRIDES[
      `${quest.id}:${objectiveIndex}`
    ];
  if (override?.length) {
    return override;
  }
  const markerId = quest.markerIds[objectiveIndex];
  return markerId ? [markerId] : [];
}

export function snapshotGroveObjectiveMarkerIdForProgress(
  quest: Pick<SnapshotGroveQuest, "id" | "markerIds">,
  objectiveIndex: number,
  completedCount = 0
) {
  const markerIds = snapshotGroveObjectiveTargetMarkerIds(
    quest,
    objectiveIndex
  );
  if (!markerIds.length) return undefined;
  return markerIds[
    Math.max(0, Math.min(markerIds.length - 1, Math.trunc(completedCount)))
  ];
}

export function snapshotGroveEventCompletionCount(event: {
  count?: unknown;
  quantity?: unknown;
}) {
  const raw = Number(event.count ?? event.quantity ?? 1);
  return Number.isFinite(raw) ? Math.max(1, Math.trunc(raw)) : 1;
}

export function snapshotGroveCraftEventMatchesObjective(
  event: {
    recipeId?: unknown;
    outputItemId?: unknown;
    itemId?: unknown;
  },
  quest: Pick<SnapshotGroveQuest, "id">,
  objectiveIndex: number
) {
  const expected =
    quest.id === "fountain_first_recipe_torch" && objectiveIndex === 3
      ? {
          recipeId: SNAPSHOT_GROVE_TUTORIAL_RECIPE_IDS.roadTorch,
          outputItemId: SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.roadTorch,
        }
      : quest.id === "econ_carlo_festival_skewers" && objectiveIndex === 2
      ? {
          recipeId: SNAPSHOT_GROVE_TUTORIAL_RECIPE_IDS.festivalSkewer,
          outputItemId: SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.festivalSkewer,
        }
      : undefined;
  if (!expected) return false;
  const recipeId = String(event.recipeId ?? "");
  const outputItemId = String(event.outputItemId ?? event.itemId ?? "");
  return (
    recipeId === expected.recipeId || outputItemId === expected.outputItemId
  );
}

export interface SnapshotGroveObjectiveInventoryRequirement {
  itemId: string;
  count: number;
  consumeOnComplete: boolean;
}

const SNAPSHOT_GROVE_OBJECTIVE_INVENTORY_REQUIREMENTS: Readonly<
  Record<string, SnapshotGroveObjectiveInventoryRequirement>
> = {
  "econ_billys_lost_lunch_pail:3": {
    itemId: "billys_lunch_pail",
    count: 1,
    consumeOnComplete: true,
  },
  "sticky_medicine:3": {
    itemId: "mudroot",
    count: 2,
    consumeOnComplete: true,
  },
  "toll_ledger_problem:3": {
    itemId: SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.boltCrate,
    count: 1,
    consumeOnComplete: true,
  },
  "econ_gus_fresh_loaves_to_fountain:2": {
    itemId: SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.warmLoafTray,
    count: 1,
    consumeOnComplete: true,
  },
  "econ_gus_grain_run:2": {
    itemId: "field_wheat",
    count: 1,
    consumeOnComplete: true,
  },
  "econ_kit_heavy_parcel_to_crossroads:3": {
    itemId: SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.heavyParcel,
    count: 1,
    consumeOnComplete: true,
  },
  "econ_mel_bench_repair:2": {
    itemId: "scrap_metal",
    count: 1,
    consumeOnComplete: true,
  },
  "econ_rin_mushroom_pickup:3": {
    itemId: "forest_mushroom",
    count: 1,
    consumeOnComplete: true,
  },
  "econ_carlo_festival_skewers:3": {
    itemId: SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.festivalSkewer,
    count: 1,
    consumeOnComplete: true,
  },
};

export function snapshotGroveObjectiveInventoryRequirement(
  quest: Pick<SnapshotGroveQuest, "id">,
  objectiveIndex: number
) {
  return SNAPSHOT_GROVE_OBJECTIVE_INVENTORY_REQUIREMENTS[
    `${quest.id}:${objectiveIndex}`
  ];
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
  count?: number;
  recipeId?: string;
  outputItemId?: string;
  targetMarkerIds?: readonly string[];
}

export function snapshotGrovePracticeItemFixtureForObjective(
  quest: Pick<SnapshotGroveQuest, "objectives"> &
    Partial<Pick<SnapshotGroveQuest, "id">>,
  objectiveIndex: number
): { itemId: string; quantity: number; label: string } | undefined {
  const text = (
    quest.objectives[
      Math.max(0, Math.min(quest.objectives.length - 1, objectiveIndex))
    ] ?? ""
  ).toLowerCase();
  if (quest.id === "econ_billys_lost_lunch_pail" && objectiveIndex === 2) {
    return {
      itemId: "billys_lunch_pail",
      quantity: 1,
      label: "Billy's Lunch Pail",
    };
  }
  if (quest.id === "fountain_first_recipe_torch" && objectiveIndex === 1) {
    return {
      itemId: "softwood_log",
      quantity: 2,
      label: "Two Practice Sticks",
    };
  }
  if (quest.id === "econ_carlo_festival_skewers" && objectiveIndex === 1) {
    return {
      itemId: SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.festivalSkewerIngredients,
      quantity: 1,
      label: "Festival Skewer Ingredients",
    };
  }
  if (quest.id === "econ_gus_fresh_loaves_to_fountain") {
    return {
      itemId: SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.warmLoafTray,
      quantity: 1,
      label: "Warm Loaf Tray",
    };
  }
  if (quest.id === "econ_kit_heavy_parcel_to_crossroads") {
    return {
      itemId: SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.heavyParcel,
      quantity: 1,
      label: "Kit's Heavy Parcel",
    };
  }
  if (quest.id === "toll_ledger_problem" && objectiveIndex === 2) {
    return {
      itemId: SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.boltCrate,
      quantity: 1,
      label: "Luis's Bolt Crate",
    };
  }
  if (quest.id === "coops_key_hen" && objectiveIndex === 1) {
    return {
      itemId: "field_wheat",
      quantity: 1,
      label: "Coop's Dropped Feed",
    };
  }
  if (quest.id === "letter_for_the_north_gate" && objectiveIndex === 0) {
    return {
      itemId: "jackies_sealed_letter",
      quantity: 1,
      label: "Jackie's Sealed Letter",
    };
  }
  if (quest.id === "toll_ledger_problem" && objectiveIndex === 0) {
    return {
      itemId: "bolt_order",
      quantity: 1,
      label: "Luis's Bolt Order",
    };
  }
  if (quest.id === "tone_beneath_the_road" && objectiveIndex === 0) {
    return {
      itemId: "sils_tuning_strip",
      quantity: 1,
      label: "Sil's Tuning Strip",
    };
  }
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
  if (/fresh paint|painted route flags?|route flags?/.test(text)) {
    // Paint is represented by a placeable practice marker block so the lesson
    // can exercise the real voxel-placement path instead of granting a
    // non-placeable cosmetic or silently leaving the objective impossible.
    return {
      itemId: "rough_stone",
      quantity: 1,
      label: "Painted Route Marker",
    };
  }
  if (/loaves?|bread/.test(text)) {
    // The current native tray has no independently placeable bread biscuit.
    // Give the delivery a placeable sealed token so the player can perform the
    // authored voxel action at the satchel instead of receiving a food item
    // that can only be eaten and can never complete the delivery objective.
    return {
      itemId: "rough_stone",
      quantity: 1,
      label: "Sealed Warm-Loaf Delivery",
    };
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
    const quantity =
      text.includes("three") || text.includes("3")
        ? 3
        : text.includes("two") || text.includes("2")
        ? 2
        : 1;
    return {
      itemId: "softwood_log",
      quantity,
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
      quantity: 1,
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
  const targetMarkerIds = snapshotGroveObjectiveTargetMarkerIds(
    quest,
    objectiveIndex
  );
  const requiredCount = snapshotGroveObjectiveRequiredCount(
    quest,
    objectiveIndex
  );
  const base = {
    questId: quest.id,
    objectiveIndex,
    trigger,
    markerId: targetMarkerIds[0] ?? markerId,
    targetMarkerIds,
    count: requiredCount,
  };

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
      if (quest.id === "fountain_first_recipe_torch" && objectiveIndex === 3) {
        return {
          ...base,
          kind: "craft",
          recipeId: SNAPSHOT_GROVE_TUTORIAL_RECIPE_IDS.roadTorch,
          outputItemId: SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.roadTorch,
        };
      }
      if (quest.id === "econ_carlo_festival_skewers" && objectiveIndex === 2) {
        return {
          ...base,
          kind: "craft",
          recipeId: SNAPSHOT_GROVE_TUTORIAL_RECIPE_IDS.festivalSkewer,
          outputItemId: SNAPSHOT_GROVE_TUTORIAL_ITEM_IDS.festivalSkewer,
        };
      }
      return undefined;
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
            count: collectItem.quantity,
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
  trigger: "item_use" | "inventory_change" | "place_voxel";
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
    if (
      trigger !== "item_use" &&
      trigger !== "inventory_change" &&
      trigger !== "place_voxel"
    ) {
      continue;
    }

    const fixture = snapshotGroveObjectiveCompletionFixture(
      quest,
      objectiveIndex
    );
    // Placement fixtures describe the world action, so their required block
    // comes from the objective's authored practice-item contract instead of an
    // event item field. Grant it up front just like equipment and consumables.
    const placementItem =
      trigger === "place_voxel"
        ? snapshotGrovePracticeItemFixtureForObjective(quest, objectiveIndex)
        : undefined;
    const itemId = fixture?.itemId ?? placementItem?.itemId;
    const itemName = fixture?.itemName ?? placementItem?.label ?? itemId;
    const completionKind =
      fixture?.kind ?? (placementItem ? "place_voxel" : undefined);
    if (
      !itemId ||
      (completionKind !== "harthmere_local_dev_item_use" &&
        completionKind !== "equip" &&
        completionKind !== "place_voxel")
    ) {
      continue;
    }

    const existing = grantsByItemId.get(itemId);
    if (existing) {
      existing.quantity += 1;
      existing.objectiveIndexes.push(objectiveIndex);
      continue;
    }

    grantsByItemId.set(itemId, {
      questId: quest.id,
      itemId,
      // itemId is guaranteed above; use it as the final readable fallback for
      // sparse authored placement fixtures.
      itemName: itemName ?? itemId,
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
