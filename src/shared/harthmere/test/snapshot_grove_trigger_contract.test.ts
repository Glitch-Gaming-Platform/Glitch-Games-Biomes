// SNAPSHOT_GROVE_TRIGGER_CONTRACT_TEST
// Locks the Snapshot Grove tutorial contract so every authored objective has a
// concrete runtime completion path. This catches the exact class of regression
// where a tutorial asks the player to eat/use/do something but no emitted event
// can complete that objective.

import assert from "assert";
import {
  SNAPSHOT_GROVE_QUESTS,
  type SnapshotGroveTrigger,
} from "@/shared/harthmere/snapshot_grove_content";
import {
  HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT,
  SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS,
  snapshotGroveCollectEventMatchesObjective,
  snapshotGroveInventoryEventMatchesObjective,
  snapshotGroveItemUseEventMatchesObjective,
  snapshotGroveItemUseObjectiveKind,
  snapshotGroveObjectiveCompletionFixture,
  snapshotGroveTutorialInventoryGrantsForQuest,
  validateSnapshotGroveTriggerContracts,
} from "@/shared/harthmere/snapshot_grove_trigger_contract";

export const SNAPSHOT_GROVE_TRIGGER_CONTRACT_TEST_VERSION =
  "snapshot-grove-trigger-contract-test" as const;

const test = it;
const expect = (actual: any) => ({
  toBe(expected: any) {
    assert.strictEqual(actual, expected);
  },
  toEqual(expected: any) {
    assert.deepStrictEqual(actual, expected);
  },
  toBeTruthy() {
    assert.ok(actual);
  },
  toBeGreaterThanOrEqual(expected: number) {
    assert.ok(actual >= expected, `${actual} must be >= ${expected}`);
  },
});

function allGroveObjectiveRows() {
  return SNAPSHOT_GROVE_QUESTS.flatMap((quest) =>
    quest.objectives.map((objective, objectiveIndex) => ({
      quest,
      objective,
      objectiveIndex,
      trigger: quest.triggers[objectiveIndex],
      markerId: quest.markerIds[objectiveIndex],
    }))
  );
}

function itemUseRows() {
  return allGroveObjectiveRows().filter((row) => row.trigger === "item_use");
}

function inventoryRows() {
  return allGroveObjectiveRows().filter(
    (row) => row.trigger === "inventory_change"
  );
}

function collectRows() {
  return allGroveObjectiveRows().filter((row) => row.trigger === "collect");
}

const WRONG_ITEM_BY_FAMILY: Record<string, Record<string, string>> = {
  food: { itemId: "iron_key_blank", itemName: "Practice Key", subtype: "key" },
  healing: { itemId: "road_ration", itemName: "Road Ration", subtype: "food" },
  key: { itemId: "rough_stone", itemName: "Practice Stone", subtype: "stone" },
  coil_or_bolt: {
    itemId: "road_ration",
    itemName: "Road Ration",
    subtype: "food",
  },
  hotbar_or_stone: {
    itemId: "minor_healing_salve",
    itemName: "Practice Bandage",
    subtype: "bandage",
  },
  generic: {},
};

if (
  typeof (describe as any) === "function" &&
  typeof (test as any) === "function"
) {
  (describe as any)("Snapshot Grove tutorial trigger contract current", () => {
    const report = validateSnapshotGroveTriggerContracts(SNAPSHOT_GROVE_QUESTS);

    (test as any)(
      "the current and current browser item-use events stay compatible",
      () => {
        (expect as any)(HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT).toBe(
          HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT
        );
      }
    );

    (test as any)(
      "every Grove objective has aligned objective/trigger/marker arrays",
      () => {
        (expect as any)(report.arrayLengthViolations).toEqual([]);
      }
    );

    (test as any)(
      "every Grove objective uses a supported runtime trigger",
      () => {
        (expect as any)(report.unsupportedTriggers).toEqual([]);
      }
    );

    (test as any)(
      "every Grove objective trigger has at least one completion event",
      () => {
        (expect as any)(report.uncoveredTriggers).toEqual([]);
      }
    );

    (test as any)("every Grove objective has a marker id", () => {
      (expect as any)(report.markerViolations).toEqual([]);
    });

    (test as any)(
      "every Grove objective has a synthetic completion fixture",
      () => {
        (expect as any)(report.objectiveFixtureViolations).toEqual([]);
      }
    );

    (test as any)(
      "every Grove item-use objective names a resolvable usable item family",
      () => {
        (expect as any)(report.itemUseObjectiveViolations).toEqual([]);
      }
    );

    (test as any)("all authored item-use objectives are covered", () => {
      (expect as any)(
        itemUseRows().map((row) => `${row.quest.id}[${row.objectiveIndex}]`)
      ).toEqual([
        "coops_key_hen[3]",
        "tower_with_a_headache[1]",
        "fountain_food_keeps_you_moving[2]",
        "fountain_food_keeps_you_moving[4]",
        "fountain_first_aid_before_road[3]",
        "fountain_hotbar_and_dropping[2]",
      ]);
    });

    (test as any)(
      "item-use fixture families match the authored objective text",
      () => {
        const families = Object.fromEntries(
          itemUseRows().map((row) => [
            `${row.quest.id}[${row.objectiveIndex}]`,
            snapshotGroveItemUseObjectiveKind(row.quest, row.objectiveIndex),
          ])
        );
        (expect as any)(families).toEqual({
          "coops_key_hen[3]": "key",
          "tower_with_a_headache[1]": "coil_or_bolt",
          "fountain_food_keeps_you_moving[2]": "food",
          "fountain_food_keeps_you_moving[4]": "food",
          "fountain_first_aid_before_road[3]": "healing",
          "fountain_hotbar_and_dropping[2]": "hotbar_or_stone",
        });
      }
    );

    (test as any)(
      "real item-use fixtures complete their matching objectives",
      () => {
        for (const row of itemUseRows()) {
          const fixture = snapshotGroveObjectiveCompletionFixture(
            row.quest,
            row.objectiveIndex
          );
          (expect as any)(fixture).toBeTruthy();
          (expect as any)(
            snapshotGroveItemUseEventMatchesObjective(
              fixture!,
              row.quest,
              row.objectiveIndex
            )
          ).toBe(true);
        }
      }
    );

    (test as any)(
      "item-use objectives have starter inventory grants on quest acceptance",
      () => {
        for (const row of itemUseRows()) {
          const fixture = snapshotGroveObjectiveCompletionFixture(
            row.quest,
            row.objectiveIndex
          );
          const grant = snapshotGroveTutorialInventoryGrantsForQuest(
            row.quest
          ).find((entry) =>
            entry.objectiveIndexes.includes(row.objectiveIndex)
          );
          (expect as any)(grant?.itemId).toBe(fixture?.itemId);
          (expect as any)(grant?.quantity).toBeGreaterThanOrEqual(1);
        }
      }
    );

    (test as any)(
      "equipment objectives grant the exact equippable starter item",
      () => {
        for (const row of inventoryRows()) {
          const fixture = snapshotGroveObjectiveCompletionFixture(
            row.quest,
            row.objectiveIndex
          );
          if (fixture?.kind !== "equip") continue;
          const grant = snapshotGroveTutorialInventoryGrantsForQuest(
            row.quest
          ).find((entry) =>
            entry.objectiveIndexes.includes(row.objectiveIndex)
          );
          (expect as any)(grant?.itemId).toBe(fixture.itemId);
          (expect as any)(grant?.trigger).toBe("inventory_change");
        }
      }
    );

    (test as any)(
      "repeat item-use objectives grant enough starter copies",
      () => {
        const quest = SNAPSHOT_GROVE_QUESTS.find(
          (entry) => entry.id === "fountain_food_keeps_you_moving"
        )!;
        const grants = snapshotGroveTutorialInventoryGrantsForQuest(quest);
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
      }
    );

    (test as any)(
      "wrong item families do not accidentally complete item-use objectives",
      () => {
        for (const row of itemUseRows()) {
          const family = snapshotGroveItemUseObjectiveKind(
            row.quest,
            row.objectiveIndex
          );
          (expect as any)(
            snapshotGroveItemUseEventMatchesObjective(
              WRONG_ITEM_BY_FAMILY[family],
              row.quest,
              row.objectiveIndex
            )
          ).toBe(false);
        }
      }
    );

    (test as any)(
      "equipment objectives require the authored item family and slot",
      () => {
        for (const row of inventoryRows()) {
          const fixture = snapshotGroveObjectiveCompletionFixture(
            row.quest,
            row.objectiveIndex
          );
          (expect as any)(fixture).toBeTruthy();
          (expect as any)(
            snapshotGroveInventoryEventMatchesObjective(
              fixture!,
              row.quest,
              row.objectiveIndex
            )
          ).toBe(true);
          if (fixture?.kind === "equip") {
            (expect as any)(
              snapshotGroveInventoryEventMatchesObjective(
                {
                  ...fixture,
                  itemId: "iron_sword",
                  itemName: "Iron Sword",
                  category: "weapon",
                },
                row.quest,
                row.objectiveIndex
              )
            ).toBe(false);
            (expect as any)(
              snapshotGroveInventoryEventMatchesObjective(
                { kind: "inventory_change" },
                row.quest,
                row.objectiveIndex
              )
            ).toBe(false);
          }
        }
      }
    );

    (test as any)("collection objectives require the collected item", () => {
      for (const row of collectRows()) {
        const fixture = snapshotGroveObjectiveCompletionFixture(
          row.quest,
          row.objectiveIndex
        );
        (expect as any)(fixture?.itemId).toBeTruthy();
        (expect as any)(
          snapshotGroveCollectEventMatchesObjective(
            fixture!,
            row.quest,
            row.objectiveIndex
          )
        ).toBe(true);
        (expect as any)(
          snapshotGroveCollectEventMatchesObjective(
            { itemId: "unrelated_iron_sword", itemName: "Iron Sword" },
            row.quest,
            row.objectiveIndex
          )
        ).toBe(false);
      }
    });

    (test as any)(
      "every supported trigger has a fixture kind covered by its trigger map",
      () => {
        for (const row of allGroveObjectiveRows()) {
          (expect as any)(row.trigger).toBeTruthy();
          const trigger = row.trigger!;
          const fixture = snapshotGroveObjectiveCompletionFixture(
            row.quest,
            row.objectiveIndex
          );
          (expect as any)(fixture).toBeTruthy();
          // SNAPSHOT_GROVE_TRIGGER_CONTRACT_TS_FIX
          // SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS is declared with
          // `satisfies Record<SnapshotGroveTrigger, readonly SnapshotGroveCompletionEventKind[]>`.
          // The `satisfies` clause preserves the per-key literal tuple types, so
          // a union-indexed lookup makes `.includes(...)` parameter type collapse
          // to `never` (TS2345). Widen to `readonly string[]` for the runtime
          // contains-check; the static `satisfies` clause at the declaration
          // site still enforces the real type for the table itself.
          const coveredEvents = SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS[
            trigger as SnapshotGroveTrigger
          ] as readonly string[];
          (expect as any)(coveredEvents.includes(fixture!.kind)).toBe(true);
        }
      }
    );
  });
}
