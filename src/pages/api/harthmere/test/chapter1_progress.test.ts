/// <reference types="mocha" />

import assert from "assert";
import {
  activeChapter1ObjectiveForTest,
  chapter1NativeInventoryPlanForTest,
} from "@/pages/api/harthmere/chapter1_progress";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";
import {
  ch1NativeQuestId,
  ch1NativeQuestStepId,
} from "@/shared/harthmere/ch1_native_quests";
import { CH1_QUESTS } from "@/shared/harthmere/ch1_quests";

describe("Chapter 1 native progress API", () => {
  it("exposes only the first unfinished leaf of the active quest", () => {
    const quest = CH1_QUESTS[0];
    const challengeId = ch1NativeQuestId(quest.id)!;
    const fired = new Set<number>();
    let active = activeChapter1ObjectiveForTest({
      inProgress: new Set([challengeId]),
      fired: (_questId, stepId) => fired.has(stepId),
    });
    assert.equal(active?.step.id, quest.steps[0].id);
    fired.add(ch1NativeQuestStepId(quest.id, 0)!);
    active = activeChapter1ObjectiveForTest({
      inProgress: new Set([challengeId]),
      fired: (_questId, stepId) => fired.has(stepId),
    });
    assert.equal(active?.step.id, quest.steps[1].id);
  });

  it("never exposes a later quest while an earlier authored quest is active", () => {
    const first = CH1_QUESTS[0];
    const later = CH1_QUESTS[5];
    const active = activeChapter1ObjectiveForTest({
      inProgress: new Set([
        ch1NativeQuestId(later.id)!,
        ch1NativeQuestId(first.id)!,
      ]),
      fired: () => false,
    });
    assert.equal(active?.quest.id, first.id);
  });

  it("returns no action after every leaf is fired", () => {
    const quest = CH1_QUESTS[0];
    const active = activeChapter1ObjectiveForTest({
      inProgress: new Set([ch1NativeQuestId(quest.id)!]),
      fired: () => true,
    });
    assert.equal(active, undefined);
  });

  it("commits plot items and dungeon supplies through one native plan", () => {
    const plan = chapter1NativeInventoryPlanForTest({
      itemConsumes: ["item_ch1_compound_b"],
      itemGrants: ["item_sorrel_field_ledger"],
      resourceConsumes: { clean_water: 2 },
    });
    assert.deepEqual(plan, {
      take: [
        {
          itemId: "item_ch1_compound_b",
          nativeId: harthmereNativeBiomesIdForItemId("item_ch1_compound_b"),
          count: 1,
        },
        {
          itemId: "clean_water",
          nativeId: harthmereNativeBiomesIdForItemId("clean_water"),
          count: 2,
        },
      ],
      give: [
        {
          itemId: "item_sorrel_field_ledger",
          nativeId: harthmereNativeBiomesIdForItemId(
            "item_sorrel_field_ledger"
          ),
          count: 1,
        },
      ],
    });
  });

  it("aggregates repeated authored inventory requirements", () => {
    const plan = chapter1NativeInventoryPlanForTest({
      itemConsumes: [
        "scrap_metal",
        "scrap_metal",
        "scrap_metal",
        "scrap_metal",
        "iron_ingot",
        "iron_ingot",
        "tree_resin",
      ],
      itemGrants: ["item_augur9_core_cell"],
    });
    assert.deepEqual(
      plan.take.map(({ itemId, count }) => ({ itemId, count })),
      [
        { itemId: "scrap_metal", count: 4 },
        { itemId: "iron_ingot", count: 2 },
        { itemId: "tree_resin", count: 1 },
      ]
    );
  });
});
