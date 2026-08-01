/// <reference types="mocha" />

import assert from "assert";
import {
  clearHarthmereNpcDialogueExpression,
  publishHarthmereNpcDialogueExpression,
  readHarthmereNpcDialogueExpression,
  resolveHarthmereNpcDialogueActor,
} from "@/shared/harthmere/npc_dialogue_expressions";

describe("Harthmere NPC dialogue expressions", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });
  });

  afterEach(() => {
    if (previousWindow) {
      Object.defineProperty(globalThis, "window", previousWindow);
    } else {
      delete (globalThis as { window?: unknown }).window;
    }
  });

  it("prefers a canonical actor id over duplicate labels", () => {
    assert.equal(
      resolveHarthmereNpcDialogueActor({
        speaker: "Jackie",
        preferredActorId: 42,
        candidates: [
          { id: 7, label: "Jackie", position: [0, 0, 0] },
          { id: 42, label: "Jackie", position: [10, 0, 0] },
        ],
      }),
      42
    );
  });

  it("uses aliases and target distance for snapshot witnesses", () => {
    assert.equal(
      resolveHarthmereNpcDialogueActor({
        speaker: "Sergeant Bram Holt",
        aliases: ["Sergeant Bramwell Holt"],
        targetPosition: [10, 2, 10],
        candidates: [
          { id: 80, label: "Sergeant Bramwell Holt", position: [100, 2, 10] },
          { id: 81, label: "Sergeant Bramwell Holt", position: [11, 2, 10] },
          { id: 82, label: "AUGUR-9", position: [10, 2, 10] },
        ],
      }),
      81
    );
  });

  it("publishes only to the selected actor and clears by nonce", () => {
    const cue = publishHarthmereNpcDialogueExpression({
      actorId: 81,
      expression: "determined",
      nonce: "chapter1:page-1",
      startedAtMs: 1_000,
    });
    assert.equal(cue?.actorId, 81);
    assert.equal(
      readHarthmereNpcDialogueExpression(81, 1_500)?.expression,
      "determined"
    );
    assert.equal(readHarthmereNpcDialogueExpression(82, 1_500), undefined);

    clearHarthmereNpcDialogueExpression("another-page");
    assert.ok(readHarthmereNpcDialogueExpression(81, 1_500));
    clearHarthmereNpcDialogueExpression("chapter1:page-1");
    assert.equal(readHarthmereNpcDialogueExpression(81, 1_500), undefined);
  });

  it("drops a stale dialogue cue instead of freezing an NPC", () => {
    publishHarthmereNpcDialogueExpression({
      actorId: 81,
      expression: "sadness",
      nonce: "chapter1:stale",
      startedAtMs: 1_000,
    });
    assert.equal(
      readHarthmereNpcDialogueExpression(81, 11 * 60 * 1_000),
      undefined
    );
  });
});
