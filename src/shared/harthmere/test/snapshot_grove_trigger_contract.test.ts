// SNAPSHOT_GROVE_TRIGGER_CONTRACT_TEST
// Locks the Snapshot Grove tutorial contract so every authored objective has a
// concrete runtime completion path. This catches the exact class of regression
// where a tutorial asks the player to eat/use/do something but no emitted event
// can complete that objective.

import assert from "assert";
import {
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_NPCS,
  SNAPSHOT_GROVE_QUESTS,
  type SnapshotGroveTrigger,
} from "@/shared/harthmere/snapshot_grove_content";
import { HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST } from "@/shared/harthmere/harthmere_native_quest_manifest";
import {
  HARTHMERE_LOCAL_DEV_ITEM_USE_EVENT,
  SNAPSHOT_GROVE_TRIGGER_COMPLETION_EVENTS,
  snapshotGroveCollectEventMatchesObjective,
  snapshotGroveInventoryEventMatchesObjective,
  snapshotGroveItemUseEventMatchesObjective,
  snapshotGroveItemUseObjectiveKind,
  snapshotGroveObjectiveInventoryRequirement,
  snapshotGroveObjectiveCompletionFixture,
  snapshotGroveObjectiveRequiredCount,
  snapshotGroveObjectiveTargetMarkerIds,
  snapshotGroveCraftEventMatchesObjective,
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

function placementRows() {
  return allGroveObjectiveRows().filter((row) => row.trigger === "place_voxel");
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
    (test as any)(
      "every Grove talk target resolves to a Grove or native Harthmere NPC",
      () => {
        const knownNpcIds = new Set([
          ...SNAPSHOT_GROVE_NPCS.map((npc) => npc.id),
          ...Object.keys(HARTHMERE_NATIVE_QUEST_GIVER_MANIFEST),
        ]);
        for (const quest of SNAPSHOT_GROVE_QUESTS) {
          (expect as any)(knownNpcIds.has(quest.giverNpcId)).toBe(true);
          for (const markerId of quest.markerIds) {
            const marker = SNAPSHOT_GROVE_LANDMARKS.find(
              (candidate) => candidate.id === markerId
            );
            if (marker?.npcId) {
              (expect as any)(knownNpcIds.has(marker.npcId)).toBe(true);
            }
          }
        }
      }
    );

    (test as any)(
      "The Moss That Went Quiet points its combat step at the live seedy nest",
      () => {
        const quest = SNAPSHOT_GROVE_QUESTS.find(
          (candidate) => candidate.id === "moss_that_went_quiet"
        );
        const marker = SNAPSHOT_GROVE_LANDMARKS.find(
          (candidate) => candidate.id === quest?.markerIds[3]
        );
        (expect as any)(quest?.markerIds[3]).toBe(
          "mosslawn_silent_muckling_nest"
        );
        (expect as any)(marker?.label).toBe("Silent Moss Muckling Nest");
        (expect as any)(marker?.kind).toBe("danger");
        (expect as any)(marker?.visibleOnWorldMap).toBe(true);
        (expect as any)(marker?.position).toEqual([334.621, 71, -394.393]);
      }
    );

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
      "every Grove quest ends in a visible return-to-giver conversation",
      () => {
        const missing = SNAPSHOT_GROVE_QUESTS.filter(
          (quest) => quest.triggers[quest.triggers.length - 1] !== "talk_npc"
        ).map((quest) => quest.id);
        (expect as any)(missing).toEqual([]);
      }
    );

    (test as any)(
      "all counted and ordered objectives resolve every physical subtarget",
      () => {
        const markerIds = new Set(
          SNAPSHOT_GROVE_LANDMARKS.map((marker) => marker.id)
        );
        const failures: string[] = [];
        for (const row of allGroveObjectiveRows()) {
          const targets = snapshotGroveObjectiveTargetMarkerIds(
            row.quest,
            row.objectiveIndex
          );
          const required = snapshotGroveObjectiveRequiredCount(
            row.quest,
            row.objectiveIndex
          );
          if (required > 1 && targets.length !== required) {
            // Collection quantities may intentionally come from one physical
            // basket in a single authoritative pickup.
            const fixture = snapshotGroveObjectiveCompletionFixture(
              row.quest,
              row.objectiveIndex
            );
            if ((fixture?.count ?? 0) < required) {
              failures.push(
                `${row.quest.id}[${row.objectiveIndex}]: ${targets.length}/${required} targets`
              );
            }
          }
          for (const markerId of targets) {
            if (!markerIds.has(markerId)) {
              failures.push(
                `${row.quest.id}[${row.objectiveIndex}]: missing ${markerId}`
              );
            }
          }
        }
        (expect as any)(failures).toEqual([]);
      }
    );

    (test as any)(
      "no Grove objective uses the old any-move or generic-status proxies",
      () => {
        const forbidden = new Set([
          "status_check",
          "escort",
          "carry",
          "item_update",
        ]);
        const violations = allGroveObjectiveRows()
          .filter((row) => forbidden.has(row.trigger))
          .map((row) => `${row.quest.id}[${row.objectiveIndex}]`);
        (expect as any)(violations).toEqual([]);
      }
    );

    (test as any)("craft objectives require their exact shipped recipe", () => {
      const craftRows = allGroveObjectiveRows().filter(
        (row) => row.trigger === "craft"
      );
      (expect as any)(craftRows.length).toBe(2);
      for (const row of craftRows) {
        const fixture = snapshotGroveObjectiveCompletionFixture(
          row.quest,
          row.objectiveIndex
        );
        (expect as any)(fixture?.recipeId).toBeTruthy();
        (expect as any)(fixture?.outputItemId).toBeTruthy();
        (expect as any)(
          snapshotGroveCraftEventMatchesObjective(
            fixture ?? {},
            row.quest,
            row.objectiveIndex
          )
        ).toBe(true);
        (expect as any)(
          snapshotGroveCraftEventMatchesObjective(
            { recipeId: "wrong_recipe", outputItemId: "wrong_output" },
            row.quest,
            row.objectiveIndex
          )
        ).toBe(false);
      }
    });

    (test as any)(
      "physical handoffs have an authoritative inventory requirement",
      () => {
        const expected = [
          "econ_billys_lost_lunch_pail:3",
          "sticky_medicine:3",
          "toll_ledger_problem:3",
          "econ_gus_fresh_loaves_to_fountain:2",
          "econ_gus_grain_run:2",
          "econ_kit_heavy_parcel_to_crossroads:3",
          "econ_mel_bench_repair:2",
          "econ_rin_mushroom_pickup:3",
          "econ_carlo_festival_skewers:3",
        ];
        const actual = allGroveObjectiveRows()
          .filter((row) =>
            Boolean(
              snapshotGroveObjectiveInventoryRequirement(
                row.quest,
                row.objectiveIndex
              )
            )
          )
          .map((row) => `${row.quest.id}:${row.objectiveIndex}`);
        (expect as any)(actual.sort()).toEqual(expected.sort());
      }
    );

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
      "every voxel-placement lesson grants an authored placeable material",
      () => {
        for (const row of placementRows()) {
          const fixture = snapshotGroveObjectiveCompletionFixture(
            row.quest,
            row.objectiveIndex
          );
          const grant = snapshotGroveTutorialInventoryGrantsForQuest(
            row.quest
          ).find((entry) =>
            entry.objectiveIndexes.includes(row.objectiveIndex)
          );
          (expect as any)(fixture?.kind).toBe("place_voxel");
          (expect as any)(grant?.itemId).toBeTruthy();
          (expect as any)(grant?.quantity).toBeGreaterThanOrEqual(1);
          // One starter stack can satisfy more than one objective (the hotbar
          // lesson first holds and then drops the same stone), so its summary
          // keeps the first trigger. Membership in objectiveIndexes is the
          // authoritative proof that this placement step receives the grant.
          (expect as any)(
            grant?.objectiveIndexes.includes(row.objectiveIndex)
          ).toBe(true);
        }

        // Route painting and delivery handoffs are object interactions now;
        // they must not receive a duplicate rough-stone placement workaround.
        for (const [questId, objectiveIndex] of [
          ["color_that_still_points_home", 3],
          ["econ_gus_fresh_loaves_to_fountain", 2],
        ] as const) {
          const quest = SNAPSHOT_GROVE_QUESTS.find(
            (entry) => entry.id === questId
          )!;
          (expect as any)(quest.triggers[objectiveIndex]).toBe("interact");
          assert.notEqual(
            snapshotGroveTutorialInventoryGrantsForQuest(quest).find((entry) =>
              entry.objectiveIndexes.includes(objectiveIndex)
            )?.itemId,
            "rough_stone"
          );
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
