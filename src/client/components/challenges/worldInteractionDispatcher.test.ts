import {
  registerWorldInteractionCandidate,
  resetWorldInteractionDispatcherForTest,
  selectedWorldInteractionIdForKey,
} from "@/client/components/challenges/worldInteractionDispatcher";
import assert from "assert";

describe("world interaction dispatcher", () => {
  afterEach(() => resetWorldInteractionDispatcherForTest());

  it("selects one highest-priority F action", () => {
    const low = registerWorldInteractionCandidate({
      id: "gathering",
      priority: 10,
      onInteract: () => undefined,
    });
    const high = registerWorldInteractionCandidate({
      id: "native-crate",
      priority: 100,
      onInteract: () => undefined,
    });
    assert.equal(selectedWorldInteractionIdForKey(), "native-crate");
    high.unregister();
    assert.equal(selectedWorldInteractionIdForKey(), "gathering");
    low.unregister();
  });

  it("keeps a disabled top-priority target selected", () => {
    registerWorldInteractionCandidate({
      id: "background",
      priority: 1,
      onInteract: () => undefined,
    });
    registerWorldInteractionCandidate({
      id: "locked-quest-object",
      priority: 2,
      disabled: true,
      onInteract: () => undefined,
    });
    assert.equal(selectedWorldInteractionIdForKey(), "locked-quest-object");
  });

  it("selects independently by key code", () => {
    registerWorldInteractionCandidate({
      id: "f-only",
      priority: 10,
      keyCodes: ["KeyF"],
      onInteract: () => undefined,
    });
    registerWorldInteractionCandidate({
      id: "e-only",
      priority: 20,
      keyCodes: ["KeyE"],
      onInteract: () => undefined,
    });
    assert.equal(selectedWorldInteractionIdForKey("KeyF"), "f-only");
    assert.equal(selectedWorldInteractionIdForKey("KeyE"), "e-only");
  });
});
