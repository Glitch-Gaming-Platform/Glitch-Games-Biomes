import assert from "assert";

import {
  HARTHMERE_ESCORT_ARRIVAL_DIALOGUE_EVENT,
  dispatchHarthmereLiveModeResponseEventsForTest,
} from "@/client/components/challenges/harthmereLiveModeClientEvents";

describe("Harthmere live-mode client events", () => {
  it("delivers an escorted person's completion line exactly once", () => {
    const dispatchedEvents: any[] = [];
    const win = {
      dispatchEvent(event: Event) {
        dispatchedEvents.push(event);
        return true;
      },
    } as unknown as Window;
    const response = {
      combatState: {
        entitySnapshots: {
          "8810000000030001": {
            escortStatus: "arrived",
            escortCompanionId: "escort_companion:job_1:player",
            escortDisplayName: "Newcomer",
            escortArrivedAtMs: 1_800_000_000_123,
            escortArrivalDialogue:
              "Thank you for seeing me safely to Doc's Bot. Please tell the Jobs Board we made it.",
          },
        },
      },
    };

    const first = dispatchHarthmereLiveModeResponseEventsForTest(response, win);
    const second = dispatchHarthmereLiveModeResponseEventsForTest(response, win);

    assert.equal(first.escortArrivalDialogues, 1);
    assert.equal(second.escortArrivalDialogues, 0);
    const dialogueEvents = dispatchedEvents.filter(
      (event) => event.type === HARTHMERE_ESCORT_ARRIVAL_DIALOGUE_EVENT
    );
    assert.equal(dialogueEvents.length, 1);
    assert.equal(dialogueEvents[0].detail.displayName, "Newcomer");
    assert.match(dialogueEvents[0].detail.dialogue, /Doc's Bot/);
  });
});
