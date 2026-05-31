// SNAPSHOT_GROVE_TRIGGER_CONTRACT_V131_TEST
// Locks the Snapshot Grove tutorial contract so every authored objective has a
// concrete runtime completion path. This catches the exact class of regression
// where a tutorial asks the player to eat/use/do something but no emitted event
// can complete that objective.

import { SNAPSHOT_GROVE_QUESTS_V75, type SnapshotGroveTriggerV75 } from "@/shared/harthmere/snapshot_grove_content_v75";
import {
  HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT_V112,
  SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS_V112,
  snapshotGroveItemUseEventMatchesObjectiveV112,
  snapshotGroveItemUseObjectiveKindV112,
  snapshotGroveObjectiveCompletionFixtureV112,
  snapshotGroveTutorialInventoryGrantsForQuestV112,
  validateSnapshotGroveTriggerContractsV112,
} from "@/shared/harthmere/snapshot_grove_trigger_contract_v112";
import { HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT_V130 } from "@/shared/harthmere/snapshot_grove_trigger_contract_v130";

export const SNAPSHOT_GROVE_TRIGGER_CONTRACT_TEST_VERSION_V131 =
  "snapshot-grove-trigger-contract-test-v131" as const;

declare const describe: unknown;
declare const test: unknown;
declare const expect: unknown;

function allGroveObjectiveRowsV131() {
  return SNAPSHOT_GROVE_QUESTS_V75.flatMap((quest) =>
    quest.objectives.map((objective, objectiveIndex) => ({
      quest,
      objective,
      objectiveIndex,
      trigger: quest.triggers[objectiveIndex],
      markerId: quest.markerIds[objectiveIndex],
    })),
  );
}

function itemUseRowsV131() {
  return allGroveObjectiveRowsV131().filter((row) => row.trigger === "item_use");
}

const WRONG_ITEM_BY_FAMILY_V131: Record<string, Record<string, string>> = {
  food: { itemId: "iron_key_blank", itemName: "Practice Key", subtype: "key" },
  healing: { itemId: "road_ration", itemName: "Road Ration", subtype: "food" },
  key: { itemId: "rough_stone", itemName: "Practice Stone", subtype: "stone" },
  coil_or_bolt: { itemId: "road_ration", itemName: "Road Ration", subtype: "food" },
  hotbar_or_stone: { itemId: "minor_healing_salve", itemName: "Practice Bandage", subtype: "bandage" },
  generic: {},
};

if (typeof (describe as any) === "function" && typeof (test as any) === "function") {
  (describe as any)("Snapshot Grove tutorial trigger contract v131", () => {
    const report = validateSnapshotGroveTriggerContractsV112(SNAPSHOT_GROVE_QUESTS_V75);

    (test as any)("the v112 and v130 browser item-use events stay compatible", () => {
      (expect as any)(HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT_V112).toBe(
        HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT_V130,
      );
    });

    (test as any)("every Grove objective has aligned objective/trigger/marker arrays", () => {
      (expect as any)(report.arrayLengthViolations).toEqual([]);
    });

    (test as any)("every Grove objective uses a supported runtime trigger", () => {
      (expect as any)(report.unsupportedTriggers).toEqual([]);
    });

    (test as any)("every Grove objective trigger has at least one completion event", () => {
      (expect as any)(report.uncoveredTriggers).toEqual([]);
    });

    (test as any)("every Grove objective has a marker id", () => {
      (expect as any)(report.markerViolations).toEqual([]);
    });

    (test as any)("every Grove objective has a synthetic completion fixture", () => {
      (expect as any)(report.objectiveFixtureViolations).toEqual([]);
    });

    (test as any)("every Grove item-use objective names a resolvable usable item family", () => {
      (expect as any)(report.itemUseObjectiveViolations).toEqual([]);
    });

    (test as any)("all authored item-use objectives are covered", () => {
      (expect as any)(
        itemUseRowsV131().map((row) => `${row.quest.id}[${row.objectiveIndex}]`),
      ).toEqual([
        "coops_key_hen[3]",
        "tower_with_a_headache[1]",
        "fountain_food_keeps_you_moving[2]",
        "fountain_food_keeps_you_moving[4]",
        "fountain_first_aid_before_road[3]",
        "fountain_hotbar_and_dropping[2]",
      ]);
    });

    (test as any)("item-use fixture families match the authored objective text", () => {
      const families = Object.fromEntries(
        itemUseRowsV131().map((row) => [
          `${row.quest.id}[${row.objectiveIndex}]`,
          snapshotGroveItemUseObjectiveKindV112(row.quest, row.objectiveIndex),
        ]),
      );
      (expect as any)(families).toEqual({
        "coops_key_hen[3]": "key",
        "tower_with_a_headache[1]": "coil_or_bolt",
        "fountain_food_keeps_you_moving[2]": "food",
        "fountain_food_keeps_you_moving[4]": "food",
        "fountain_first_aid_before_road[3]": "healing",
        "fountain_hotbar_and_dropping[2]": "hotbar_or_stone",
      });
    });

    (test as any)("real item-use fixtures complete their matching objectives", () => {
      for (const row of itemUseRowsV131()) {
        const fixture = snapshotGroveObjectiveCompletionFixtureV112(
          row.quest,
          row.objectiveIndex,
        );
        (expect as any)(fixture).toBeTruthy();
        (expect as any)(
          snapshotGroveItemUseEventMatchesObjectiveV112(
            fixture!,
            row.quest,
            row.objectiveIndex,
          ),
        ).toBe(true);
      }
    });

    (test as any)("item-use objectives have starter inventory grants on quest acceptance", () => {
      for (const row of itemUseRowsV131()) {
        const fixture = snapshotGroveObjectiveCompletionFixtureV112(
          row.quest,
          row.objectiveIndex,
        );
        const grant = snapshotGroveTutorialInventoryGrantsForQuestV112(
          row.quest,
        ).find((entry) => entry.objectiveIndexes.includes(row.objectiveIndex));
        (expect as any)(grant?.itemId).toBe(fixture?.itemId);
        (expect as any)(grant?.quantity).toBeGreaterThanOrEqual(1);
      }
    });

    (test as any)("repeat item-use objectives grant enough starter copies", () => {
      const quest = SNAPSHOT_GROVE_QUESTS_V75.find(
        (entry) => entry.id === "fountain_food_keeps_you_moving",
      )!;
      const grants = snapshotGroveTutorialInventoryGrantsForQuestV112(quest);
      (expect as any)(grants).toEqual([
        {
          questId: "fountain_food_keeps_you_moving",
          itemId: "road_ration",
          itemName: "Road Ration",
          quantity: 2,
          objectiveIndexes: [2, 4],
          trigger: "item_use",
        },
      ]);
    });

    (test as any)("wrong item families do not accidentally complete item-use objectives", () => {
      for (const row of itemUseRowsV131()) {
        const family = snapshotGroveItemUseObjectiveKindV112(row.quest, row.objectiveIndex);
        (expect as any)(
          snapshotGroveItemUseEventMatchesObjectiveV112(
            WRONG_ITEM_BY_FAMILY_V131[family],
            row.quest,
            row.objectiveIndex,
          ),
        ).toBe(false);
      }
    });

    (test as any)("every supported trigger has a fixture kind covered by its trigger map", () => {
      for (const row of allGroveObjectiveRowsV131()) {
        (expect as any)(row.trigger).toBeTruthy();
        const trigger = row.trigger!;
        const fixture = snapshotGroveObjectiveCompletionFixtureV112(
          row.quest,
          row.objectiveIndex,
        );
        (expect as any)(fixture).toBeTruthy();
        // SNAPSHOT_GROVE_TRIGGER_CONTRACT_V131_TS_FIX
        // SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS_V112 is declared with
        // `satisfies Record<SnapshotGroveTriggerV75, readonly SnapshotGroveCompletionEventKindV112[]>`.
        // The `satisfies` clause preserves the per-key literal tuple types, so
        // a union-indexed lookup makes `.includes(...)` parameter type collapse
        // to `never` (TS2345). Widen to `readonly string[]` for the runtime
        // contains-check; the static `satisfies` clause at the declaration
        // site still enforces the real type for the table itself.
        const coveredEvents =
          SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS_V112[
            trigger as SnapshotGroveTriggerV75
          ] as readonly string[];
        (expect as any)(
          coveredEvents.includes(fixture!.kind),
        ).toBe(true);
      }
    });
  });
}
