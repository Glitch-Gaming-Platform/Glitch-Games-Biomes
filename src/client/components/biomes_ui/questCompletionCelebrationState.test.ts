import assert from "assert";
import {
  announceHarthmereQuestCompletion,
  HARTHMERE_QUEST_COMPLETED_EVENT,
  playerReadableQuestRewardItemName,
} from "./questCompletionCelebrationState";

describe("quest completion celebration state", () => {
  it("never exposes developer item ids in reward copy", () => {
    assert.equal(
      playerReadableQuestRewardItemName("item_bulls_core"),
      "Bulls Core"
    );
    assert.equal(
      playerReadableQuestRewardItemName("wild_berries"),
      "Wild Berries"
    );
    assert.equal(playerReadableQuestRewardItemName("b:123456"), "Item");
  });

  it("normalizes and deduplicates queued reward lines", () => {
    const previousWindow = (globalThis as any).window;
    let detail: any;
    try {
      (globalThis as any).window = {
        dispatchEvent(event: CustomEvent) {
          assert.equal(event.type, HARTHMERE_QUEST_COMPLETED_EVENT);
          detail = event.detail;
          return true;
        },
      };
      announceHarthmereQuestCompletion({
        id: "job-1",
        title: "  Stock the Road Rations Crate  ",
        rewards: ["68 gold", "68 gold", "  1 × Wild Berries  "],
      });
      assert.deepStrictEqual(detail, {
        id: "job-1",
        title: "Stock the Road Rations Crate",
        rewards: ["68 gold", "1 × Wild Berries"],
      });
    } finally {
      if (previousWindow === undefined) delete (globalThis as any).window;
      else (globalThis as any).window = previousWindow;
    }
  });
});
