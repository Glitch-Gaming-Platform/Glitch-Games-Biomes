/// <reference types="mocha" />

import assert from "assert";
import { HARTHMERE_DIALOGUE_EXPRESSION_RECORDS } from "@/shared/harthmere/generated/npc_dialogue_expression_catalog";
import { GROVE_QUEST_CATALOG } from "@/shared/harthmere/grove/grove_quest_catalog";
import { HARTHMERE_ALL_NPCS } from "@/shared/harthmere/npc_compendium";
import { buildHarthmereDialogueExpressionRecords } from "@/shared/harthmere/npc_dialogue_expression_authoring";
import {
  HARTHMERE_DIALOGUE_EXPRESSION_RECORD_COUNT,
  harthmereDialogueExpressionForText,
} from "@/shared/harthmere/npc_dialogue_expression_catalog";
import { HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE } from "@/shared/harthmere/additive_town_npc_dialogue";
import { SNAPSHOT_GROVE_AMBIENT_DIALOGUE } from "@/shared/harthmere/snapshot_grove_ambient_dialogue";
import {
  HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS,
  HARTHMERE_NATIVE_QUEST_DIALOGUE_EXCLUSIONS,
  HARTHMERE_NATIVE_QUEST_DIALOGUE_EXPRESSION_EVENTS,
} from "@/shared/harthmere/native_quest_dialogue_expression_plan";
import { SNAPSHOT_GROVE_JACKIE_ENTITY_ID } from "@/shared/harthmere/snapshot_grove_ids";

describe("authored NPC dialogue expression catalog", () => {
  it("covers every mapped human line and keeps the generated catalog current", () => {
    const current = buildHarthmereDialogueExpressionRecords();
    assert.equal(current.length, 973);
    assert.equal(HARTHMERE_DIALOGUE_EXPRESSION_RECORD_COUNT, 973);
    assert.deepEqual(HARTHMERE_DIALOGUE_EXPRESSION_RECORDS, current);
    assert.deepEqual(
      Object.fromEntries(
        [
          "compendium",
          "additive_town",
          "grove_ambient",
          "grove_quest",
          "native_quest",
        ].map((source) => [
          source,
          current.filter((record) => record.source === source).length,
        ])
      ),
      {
        compendium: 460,
        additive_town: 198,
        grove_ambient: 60,
        grove_quest: 50,
        native_quest: 205,
      }
    );
    assert.equal(new Set(current.map((record) => record.textKey)).size, 972);
    const duplicateTextKeys = new Map<string, typeof current>();
    for (const record of current) {
      const records = duplicateTextKeys.get(record.textKey) ?? [];
      records.push(record);
      duplicateTextKeys.set(record.textKey, records);
    }
    const duplicateGroups = [...duplicateTextKeys.values()].filter(
      (records) => records.length > 1
    );
    assert.equal(duplicateGroups.length, 1);
    assert.deepEqual(
      duplicateGroups[0].map((record) => [
        record.textTemplate,
        record.actorKey,
        record.expression,
      ]),
      [
        ["{username}!", "sophia", "surprise"],
        ["{username}!", "anne_choveigh", "beckon"],
      ]
    );
  });

  it("covers all native onboarding quests while excluding non-human presentations", () => {
    const authoredPageOccurrences =
      HARTHMERE_NATIVE_QUEST_DIALOGUE_EXPRESSION_EVENTS.reduce(
        (count, event) => count + event.pages.length,
        0
      );
    assert.equal(authoredPageOccurrences, 206);
    assert.equal(
      new Set(
        HARTHMERE_NATIVE_QUEST_DIALOGUE_EXPRESSION_EVENTS.map(
          (event) => event.actor.entityId
        )
      ).size,
      13
    );
    const coveredQuestIds = new Set([
      ...HARTHMERE_NATIVE_QUEST_DIALOGUE_EXPRESSION_EVENTS.map(
        (event) => event.questId
      ),
      ...HARTHMERE_NATIVE_QUEST_DIALOGUE_EXCLUSIONS.map(
        (entry) => entry.questId
      ),
    ]);
    assert.deepEqual(
      [...coveredQuestIds].sort((a, b) => a - b),
      Object.values(HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS).sort((a, b) => a - b)
    );
    assert.ok(
      HARTHMERE_NATIVE_QUEST_DIALOGUE_EXCLUSIONS.some(
        (entry) =>
          entry.questId ===
            HARTHMERE_NATIVE_ONBOARDING_QUEST_IDS.parcelPursuit &&
          /robot transmission/.test(entry.reason)
      )
    );
    assert.equal(
      HARTHMERE_NATIVE_QUEST_DIALOGUE_EXPRESSION_EVENTS.some((event) =>
        /robot|crate|toolbag|inscription|parts/i.test(event.actor.displayName)
      ),
      false
    );
  });

  it("resolves native quest pages by exact actor, step, and dynamic placeholders", () => {
    assert.equal(
      harthmereDialogueExpressionForText(
        "The name is **Jackie**. I'm glad we found ya before the Muckers did.",
        {
          entityId: Number(SNAPSHOT_GROVE_JACKIE_ENTITY_ID),
          title: "Jackie",
          dialogueId: 3_960_245_896_803_219,
        }
      )?.expression,
      "relief",
      "canonical Jackie must play the expression authored for her legacy Road Ahead identity"
    );
    assert.equal(
      harthmereDialogueExpressionForText("Right then! Nice to meet ya Devin!", {
        entityId: 7_520_125_886_856_339,
        title: "Billy Rhodes",
        dialogueId: 166_072_605_041_642,
      })?.expression,
      "gratitude"
    );
    assert.equal(
      harthmereDialogueExpressionForText("Right then! Nice to meet ya Devin!", {
        entityId: 7_520_125_886_856_339,
        title: "Billy Rhodes",
        dialogueId: 123,
      }),
      undefined,
      "a dynamic page cannot leak into another quest step"
    );
    assert.equal(
      harthmereDialogueExpressionForText("Right then! Nice to meet ya Devin!", {
        entityId: 8_997_551_883_502_307,
        title: "Jackie",
        dialogueId: 166_072_605_041_642,
      }),
      undefined,
      "a native expression cannot animate the wrong human"
    );
    assert.equal(
      harthmereDialogueExpressionForText("Devin!", {
        entityId: 7_976_997_825_186_729,
        title: "Sophia",
        dialogueId: 4_851_249_541_237_155,
      })?.expression,
      "surprise"
    );
    assert.equal(
      harthmereDialogueExpressionForText("Devin!", {
        entityId: 742_847_586_011_759,
        title: "Anne Choveigh",
        dialogueId: 2_602_033_844_849_937,
      })?.expression,
      "beckon"
    );
    assert.equal(
      harthmereDialogueExpressionForText(
        "Devin! We've been waiting for yer arrival! What have ya got for me?",
        {
          entityId: 5_061_424_414_825_022,
          title: "Budd Sower",
          dialogueId: "150912450227071-78",
        }
      )?.expression,
      "beckon",
      "take-item dialogue ids retain their native step prefix"
    );
    assert.equal(
      harthmereDialogueExpressionForText(
        "Head back to **Auggie** and feed that extra **Bling** you just picked up into it's power slot.",
        {
          entityId: 742_847_586_011_759,
          title: "Anne Choveigh",
          dialogueId: 7_325_800_266_031_323,
        }
      )?.expression,
      "beckon"
    );
  });

  it("does not assign expressions to native quest props, inscriptions, or robots", () => {
    for (const text of [
      "What to choose, what to choose...",
      "Here it is!",
      "Yikes... this got a bit wet!",
      'The Green Statue Inscription reads, "Mukuluku"',
      "Bingo!",
    ]) {
      assert.equal(harthmereDialogueExpressionForText(text), undefined, text);
    }
    assert.equal(
      harthmereDialogueExpressionForText("BZZT. UNIT READY.", {
        entityId: 8_997_551_883_502_307,
        title: "Mucked Robot",
        dialogueId: 731_822_018_871_376,
      }),
      undefined
    );
  });

  it("resolves exact visible pages, including text wrappers and follow-ups", () => {
    const mira = HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE.find(
      (profile) => profile.offset === 1
    );
    assert.ok(mira);
    assert.equal(
      harthmereDialogueExpressionForText(`<text>${mira.intro}</text>`)
        ?.expression,
      "beckon"
    );
    assert.equal(
      harthmereDialogueExpressionForText(mira.story)?.expression,
      "gratitude"
    );
    assert.equal(
      harthmereDialogueExpressionForText(mira.location)?.expression,
      "determined"
    );
    assert.equal(
      harthmereDialogueExpressionForText(mira.intro, {
        entityId: 8_810_000_000_010_002,
        title: "Bolt, Archive Robot",
      }),
      undefined,
      "an authored human line cannot animate a different actor"
    );
    assert.equal(
      harthmereDialogueExpressionForText(mira.intro, {
        entityId: 8_810_000_000_010_001,
        title: mira.displayName,
      })?.expression,
      "beckon"
    );

    const jackieNeutral = SNAPSHOT_GROVE_AMBIENT_DIALOGUE.jackie[0];
    assert.equal(
      harthmereDialogueExpressionForText(`<text>${jackieNeutral}</text>`)
        ?.expression,
      "thinking"
    );
    const sparring = GROVE_QUEST_CATALOG.find(
      (quest) => quest.id === "safe_sparring_not_pvp"
    );
    assert.ok(sparring);
    assert.equal(
      harthmereDialogueExpressionForText(
        `<text>${sparring.sampleDialogue}</text>`
      )?.expression,
      "guard"
    );
  });

  it("maps all four non-quest compendium fields but not quest offers", () => {
    const bram = HARTHMERE_ALL_NPCS.find(
      (npc) => npc.id === "sergeant_bram_holt"
    );
    assert.ok(bram);
    assert.equal(
      harthmereDialogueExpressionForText(bram.dialogue.greeting)?.expression,
      "guard"
    );
    assert.equal(
      harthmereDialogueExpressionForText(bram.dialogue.service)?.expression,
      "determined"
    );
    assert.equal(
      harthmereDialogueExpressionForText(bram.dialogue.rumor)?.expression,
      "thinking"
    );
    assert.equal(
      harthmereDialogueExpressionForText(bram.dialogue.farewell)?.expression,
      "salute"
    );
    assert.equal(
      harthmereDialogueExpressionForText(bram.dialogue.questOffer),
      undefined
    );
  });

  it("never assigns human acting to robots, animals, or generated chat", () => {
    for (const offset of [2, 4]) {
      const profile = HARTHMERE_ADDITIVE_TOWN_NPC_DIALOGUE.find(
        (candidate) => candidate.offset === offset
      );
      assert.ok(profile);
      assert.equal(
        harthmereDialogueExpressionForText(profile.intro),
        undefined
      );
      assert.equal(
        harthmereDialogueExpressionForText(profile.story),
        undefined
      );
      assert.equal(
        harthmereDialogueExpressionForText(profile.location),
        undefined
      );
    }
    for (const npcId of ["buddy", "mucked_robot"] as const) {
      for (const line of SNAPSHOT_GROVE_AMBIENT_DIALOGUE[npcId]) {
        assert.equal(harthmereDialogueExpressionForText(line), undefined);
      }
    }
    const buddyQuest = GROVE_QUEST_CATALOG.find(
      (quest) => quest.id === "tower_with_a_headache"
    );
    assert.ok(buddyQuest);
    assert.equal(
      harthmereDialogueExpressionForText(buddyQuest.sampleDialogue),
      undefined
    );
    assert.equal(
      harthmereDialogueExpressionForText(
        "This is a generated reply that was never authored in the expression plan."
      ),
      undefined
    );
  });
});
