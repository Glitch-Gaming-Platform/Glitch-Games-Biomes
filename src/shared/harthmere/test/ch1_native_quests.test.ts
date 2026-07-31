/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  allCh1NativeQuestBiscuits,
  ch1NativeQuestId,
  ch1NativeQuestRootId,
  ch1NativeQuestStepId,
  NATIVE_CH1_FIRST_QUEST_ID,
} from "../ch1_native_quests";
import { CH1_QUESTS } from "../ch1_quests";
import { NATIVE_MUCK_VS_MACHINE_QUEST_ID } from "../native_road_ahead_contract";

describe("Chapter 1 native Bikkie quests", () => {
  it("projects every authored quest and objective exactly once", () => {
    const biscuits = allCh1NativeQuestBiscuits();
    assert.equal(biscuits.length, CH1_QUESTS.length);
    assert.equal(
      new Set(biscuits.map((quest) => quest.id)).size,
      biscuits.length
    );
    for (const [index, quest] of CH1_QUESTS.entries()) {
      const biscuit = biscuits[index];
      assert.equal(biscuit.id, ch1NativeQuestId(quest.id));
      assert.equal(biscuit.displayName, quest.title);
      assert.equal(biscuit.trigger?.kind, "seq");
      if (biscuit.trigger?.kind === "seq") {
        assert.equal(biscuit.trigger.id, ch1NativeQuestRootId(quest.id));
        assert.equal(biscuit.trigger.triggers.length, quest.steps.length);
        for (const [stepIndex, trigger] of biscuit.trigger.triggers.entries()) {
          assert.equal(
            trigger.id,
            ch1NativeQuestStepId(quest.id, stepIndex),
            `${quest.id}/${quest.steps[stepIndex].id}`
          );
        }
      }
    }
  });

  it("continues from the retained Muck vs. Machine prerequisite", () => {
    const first = allCh1NativeQuestBiscuits()[0];
    assert.equal(first.id, NATIVE_CH1_FIRST_QUEST_ID);
    assert.equal(first.unlock?.kind, "challengeComplete");
    if (first.unlock?.kind === "challengeComplete") {
      assert.equal(first.unlock.challenge, NATIVE_MUCK_VS_MACHINE_QUEST_ID);
    }
    assert.equal(
      first.questGiver,
      undefined,
      "the wake-up quest must auto-start at the prologue handoff"
    );
  });

  it("chains later quests without an orphaned unlock", () => {
    const biscuits = allCh1NativeQuestBiscuits();
    for (let index = 1; index < biscuits.length; index += 1) {
      const unlock = biscuits[index].unlock;
      assert.equal(unlock?.kind, "challengeComplete");
      if (unlock?.kind === "challengeComplete") {
        assert.equal(unlock.challenge, biscuits[index - 1].id);
      }
    }
  });

  it("auto-starts the whole linear chain instead of binding staged actors to old ECS spawns", () => {
    for (const quest of allCh1NativeQuestBiscuits()) {
      assert.equal(quest.questGiver, undefined, quest.displayName);
      if (quest.trigger?.kind === "seq") {
        for (const step of quest.trigger.triggers) {
          assert.equal(
            step.navigationAid,
            undefined,
            "dynamic Chapter 1 targets are published by the authenticated objective bridge"
          );
        }
      }
    }
  });
});
