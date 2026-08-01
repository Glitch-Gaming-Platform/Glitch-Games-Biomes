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

describe("authored NPC dialogue expression catalog", () => {
  it("covers every mapped human line and keeps the generated catalog current", () => {
    const current = buildHarthmereDialogueExpressionRecords();
    assert.equal(current.length, 768);
    assert.equal(HARTHMERE_DIALOGUE_EXPRESSION_RECORD_COUNT, 768);
    assert.deepEqual(HARTHMERE_DIALOGUE_EXPRESSION_RECORDS, current);
    assert.deepEqual(
      Object.fromEntries(
        ["compendium", "additive_town", "grove_ambient", "grove_quest"].map(
          (source) => [
            source,
            current.filter((record) => record.source === source).length,
          ]
        )
      ),
      {
        compendium: 460,
        additive_town: 198,
        grove_ambient: 60,
        grove_quest: 50,
      }
    );
    assert.equal(new Set(current.map((record) => record.textKey)).size, 768);
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
