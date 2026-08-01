/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";
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
import { CH1_ITEMS } from "@/shared/harthmere/ch1_items";
import {
  chapter1NativeInventoryTakeSourcesForTest,
  chapter1NativeInventoryRepairPlanForTest,
  combineCh1NativeItemCounts,
  chapter1ProgressExpectedPlotInventoryForTest,
} from "@/server/harthmere/ch1_native_inventory";

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

  it("publishes an entity target for real Chapter 1 NPC conversations", () => {
    const quest = CH1_QUESTS[0];
    const targetStep = quest.steps.findIndex((step) => step.id === "kit_check");
    assert.ok(targetStep >= 0);
    // The resolver contract is covered in the shared target suite; this API
    // assertion protects the field that lets MapManager follow the one live
    // canonical Jackie instead of a stale authored coordinate.
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/pages/api/harthmere/chapter1_progress.ts"),
      "utf8"
    );
    assert.match(source, /targetEntityId: target\.entityId/);
    assert.match(source, /resolveChapter1EntityTarget/);
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

  it("counts vendor-deposited material storage and consumes it after the bag", () => {
    assert.deepEqual(
      combineCh1NativeItemCounts(
        { scrap_metal: 1, item_augur9_core_cell: 1 },
        { scrap_metal: 16, iron_ingot: 12 }
      ),
      {
        scrap_metal: 17,
        item_augur9_core_cell: 1,
        iron_ingot: 12,
      }
    );
    const scrapId = harthmereNativeBiomesIdForItemId("scrap_metal")!;
    const ironId = harthmereNativeBiomesIdForItemId("iron_ingot")!;
    assert.deepEqual(
      chapter1NativeInventoryTakeSourcesForTest({
        required: [
          { itemId: "scrap_metal", nativeId: scrapId, count: 4 },
          { itemId: "iron_ingot", nativeId: ironId, count: 2 },
        ],
        inventory: { scrap_metal: 1 },
        materialStorage: { scrap_metal: 16, iron_ingot: 12 },
      }),
      {
        inventory: [{ itemId: "scrap_metal", nativeId: scrapId, count: 1 }],
        materialStorage: [
          { itemId: "scrap_metal", nativeId: scrapId, count: 3 },
          { itemId: "iron_ingot", nativeId: ironId, count: 2 },
        ],
        missing: [],
      }
    );
  });

  it("never treats material storage as carried dungeon weight or supplies", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/pages/api/harthmere/chapter1_progress.ts"),
      "utf8"
    );
    assert.match(
      source,
      /ch1ProvisioningCarriedFromInventory\(\s*nativeInventoryCounts\s*\)/
    );
    assert.match(
      source,
      /carryWeight:\s*harthmereInventoryCarryWeight\(nativeInventoryCounts\)/
    );
    assert.match(
      source,
      /const nativeResourceCounts = \{ \.\.\.nativeInventoryCounts \}/
    );
    assert.doesNotMatch(
      source,
      /carryWeight:\s*harthmereInventoryCarryWeight\(nativeUsableItemCounts\)/
    );
  });

  it("repairs every Chapter 1 plot item recorded by the durable story inventory", () => {
    const expected = Object.fromEntries(CH1_ITEMS.map((item) => [item.id, 1]));
    const plan = chapter1NativeInventoryRepairPlanForTest({
      expected,
      available: {},
    });
    assert.deepEqual(
      new Set(plan.grant.map(({ itemId }) => itemId)),
      new Set(CH1_ITEMS.map((item) => item.id))
    );
    assert.deepEqual(plan.moveFromOverflow, []);
  });

  it("keeps every plot-item reference in quests and live effects inside the repair catalogue", () => {
    const catalogue = new Set(CH1_ITEMS.map((item) => item.id));
    const sources = [
      fs.readFileSync(
        path.join(process.cwd(), "src/shared/harthmere/ch1_quests.ts"),
        "utf8"
      ),
      fs.readFileSync(
        path.join(process.cwd(), "src/shared/harthmere/ch1_live_story.ts"),
        "utf8"
      ),
    ];
    const referenced = new Set(
      sources.flatMap((source) =>
        [...source.matchAll(/["'](item_[a-z0-9_]+)["']/g)].map(
          (match) => match[1]
        )
      )
    );
    assert.deepEqual(
      [...referenced].filter((itemId) => !catalogue.has(itemId)),
      [],
      "every Chapter 1 plot item must be eligible for durable/native repair"
    );
  });

  it("moves an overflowed quest reward instead of duplicating it", () => {
    const plan = chapter1NativeInventoryRepairPlanForTest({
      expected: { item_ch1_breakfast_tea: 1 },
      available: {},
      overflow: { item_ch1_breakfast_tea: 1 },
    });
    assert.deepEqual(plan, {
      moveFromOverflow: [{ itemId: "item_ch1_breakfast_tea", count: 1 }],
      grant: [],
    });
  });

  it("recovers breakfast tea from fired wake-up progress when the durable effect is missing", () => {
    const expected = chapter1ProgressExpectedPlotInventoryForTest({
      durable: {},
      activeQuestId: "ch1_a1_q01_morning_after",
      activeStepId: "the_tea",
      fired: (questId, stepIndex) =>
        questId === "ch1_a1_q01_morning_after" && stepIndex === 0,
    });
    assert.equal(expected.item_ch1_breakfast_tea, 1);
    assert.deepEqual(
      chapter1NativeInventoryRepairPlanForTest({
        expected,
        available: {},
      }).grant,
      [{ itemId: "item_ch1_breakfast_tea", count: 1 }]
    );
  });

  it("gives every blocking Chapter 1 plot item an earlier authored grant", () => {
    const plotItems = new Set(CH1_ITEMS.map((item) => item.id));
    const earlierGrants = new Set<string>();
    for (const quest of CH1_QUESTS) {
      for (const step of quest.steps) {
        for (const requirement of step.inventoryRequirements ?? []) {
          if (!plotItems.has(requirement.itemId)) continue;
          assert.ok(
            earlierGrants.has(requirement.itemId),
            `${quest.id}/${step.id} requires ${requirement.itemId} before Chapter 1 grants it`
          );
        }
        for (const itemId of step.grants ?? []) earlierGrants.add(itemId);
      }
    }
  });
});
