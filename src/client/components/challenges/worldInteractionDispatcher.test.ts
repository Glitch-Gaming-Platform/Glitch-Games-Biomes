import {
  registerWorldInteractionCandidate,
  resetWorldInteractionDispatcherForTest,
  selectedWorldInteractionIdForKey,
  WORLD_INTERACTION_PRIORITY,
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

  it("lets an explicitly active tool own F over an inspected world entity", () => {
    registerWorldInteractionCandidate({
      id: "native-container",
      priority: WORLD_INTERACTION_PRIORITY.nativeEcs,
      onInteract: () => undefined,
    });
    registerWorldInteractionCandidate({
      id: "active-camera",
      priority: WORLD_INTERACTION_PRIORITY.activeTool,
      onInteract: () => undefined,
    });
    assert.equal(selectedWorldInteractionIdForKey("KeyF"), "active-camera");
  });

  it("ignores candidates whose current target guard is false", () => {
    registerWorldInteractionCandidate({
      id: "stale-nearest-board",
      priority: 100,
      canHandle: () => false,
      onInteract: () => undefined,
    });
    registerWorldInteractionCandidate({
      id: "faced-sign",
      priority: 90,
      canHandle: () => true,
      onInteract: () => undefined,
    });
    assert.equal(selectedWorldInteractionIdForKey("KeyF"), "faced-sign");
  });

  it("restores the prior candidate when an overlapping target unmounts", () => {
    const board = registerWorldInteractionCandidate({
      id: "board",
      priority: 100,
      onInteract: () => undefined,
    });
    const crate = registerWorldInteractionCandidate({
      id: "crate",
      priority: 100,
      onInteract: () => undefined,
    });
    assert.equal(selectedWorldInteractionIdForKey(), "crate");
    crate.unregister();
    assert.equal(selectedWorldInteractionIdForKey(), "board");
    board.unregister();
    assert.equal(selectedWorldInteractionIdForKey(), undefined);
  });
});
