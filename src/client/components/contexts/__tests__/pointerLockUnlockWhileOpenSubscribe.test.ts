/// <reference types="mocha" />
/// <reference types="node" />

// HARTHMERE_UI: tests for the subscriber mechanism that lets the
// EscGameMenu (and any other React surface) react to "unlock-while-open"
// panels — Jobs Board, Home Console, Business Interface, Crafting Station —
// opening and closing. The fix prevents the "Return to Game" / "Give
// Feedback" overlay from appearing on top of those panels.

import assert from "assert";
import {
  beginPointerLockUnlockWhileOpen,
  closePointerLockUnlockWhileOpen,
  endPointerLockUnlockWhileOpen,
  isPointerLockUnlockWhileOpenActive,
  openPointerLockUnlockWhileOpen,
  subscribePointerLockUnlockWhileOpen,
  type PointerLockUnlockWhileOpenManager,
  type PointerLockUnlockWhileOpenReturnRef,
} from "../pointerLockModalPolicy";

function fakeManager(locked: boolean): PointerLockUnlockWhileOpenManager & {
  locked: boolean;
  unlocks: number;
  locks: number;
} {
  return {
    locked,
    unlocks: 0,
    locks: 0,
    isLocked() {
      return this.locked;
    },
    unlock() {
      this.unlocks += 1;
      this.locked = false;
    },
    focusAndLock() {
      this.locks += 1;
      this.locked = true;
    },
  };
}

function drainDepth() {
  // Some other test in the same file may have left the global depth counter
  // non-zero; pop it back to 0 before measuring. The counter is process-wide.
  while (isPointerLockUnlockWhileOpenActive()) {
    endPointerLockUnlockWhileOpen();
  }
}

describe("pointerLockModalPolicy unlock-while-open subscribers (V147)", () => {
  beforeEach(() => {
    drainDepth();
  });

  it("notifies subscribers on begin and end and reports the new active flag", () => {
    const events: boolean[] = [];
    const unsubscribe = subscribePointerLockUnlockWhileOpen(() => {
      events.push(isPointerLockUnlockWhileOpenActive());
    });

    beginPointerLockUnlockWhileOpen();
    beginPointerLockUnlockWhileOpen();
    endPointerLockUnlockWhileOpen();
    endPointerLockUnlockWhileOpen();

    assert.deepEqual(events, [true, true, true, false]);
    assert.equal(isPointerLockUnlockWhileOpenActive(), false);

    unsubscribe();
  });

  it("does not fire a transition when end is called with depth already at zero", () => {
    const events: boolean[] = [];
    const unsubscribe = subscribePointerLockUnlockWhileOpen(() => {
      events.push(isPointerLockUnlockWhileOpenActive());
    });

    endPointerLockUnlockWhileOpen();
    endPointerLockUnlockWhileOpen();

    assert.deepEqual(events, []);

    unsubscribe();
  });

  it("stops notifying after unsubscribe", () => {
    let calls = 0;
    const unsubscribe = subscribePointerLockUnlockWhileOpen(() => {
      calls += 1;
    });

    beginPointerLockUnlockWhileOpen();
    assert.equal(calls, 1);

    unsubscribe();

    endPointerLockUnlockWhileOpen();
    beginPointerLockUnlockWhileOpen();
    endPointerLockUnlockWhileOpen();
    assert.equal(calls, 1);
  });

  it("notifies when a subscriber unsubscribes itself during a callback", () => {
    let firstCalls = 0;
    let secondCalls = 0;
    let unsubFirst = () => {};
    let unsubSecond = () => {};

    unsubFirst = subscribePointerLockUnlockWhileOpen(() => {
      firstCalls += 1;
      unsubFirst();
    });
    unsubSecond = subscribePointerLockUnlockWhileOpen(() => {
      secondCalls += 1;
    });

    beginPointerLockUnlockWhileOpen();
    endPointerLockUnlockWhileOpen();

    assert.equal(firstCalls, 1, "first subscriber should fire exactly once before self-unsubscribing");
    assert.equal(secondCalls, 2, "second subscriber should fire on begin and end");

    unsubSecond();
  });

  it("integrates with openPointerLockUnlockWhileOpen / close to round-trip the active flag", () => {
    const transitions: boolean[] = [];
    const unsubscribe = subscribePointerLockUnlockWhileOpen(() => {
      transitions.push(isPointerLockUnlockWhileOpenActive());
    });

    const manager = fakeManager(true);
    const shouldReturn: PointerLockUnlockWhileOpenReturnRef = { current: false };

    openPointerLockUnlockWhileOpen(manager, shouldReturn);
    assert.equal(isPointerLockUnlockWhileOpenActive(), true);

    // Calling open a second time on the same ref must not increment the depth.
    openPointerLockUnlockWhileOpen(manager, shouldReturn);
    assert.equal(isPointerLockUnlockWhileOpenActive(), true);

    closePointerLockUnlockWhileOpen(manager, shouldReturn);
    assert.equal(isPointerLockUnlockWhileOpenActive(), false);

    // Idempotent close.
    closePointerLockUnlockWhileOpen(manager, shouldReturn);
    assert.equal(isPointerLockUnlockWhileOpenActive(), false);

    assert.deepEqual(transitions, [true, false]);
    unsubscribe();
  });

  it("keeps subscribers isolated — one subscriber's throw does not silence others", () => {
    let throwCalls = 0;
    let safeCalls = 0;
    const unsubThrow = subscribePointerLockUnlockWhileOpen(() => {
      throwCalls += 1;
      throw new Error("intentional");
    });
    const unsubSafe = subscribePointerLockUnlockWhileOpen(() => {
      safeCalls += 1;
    });

    beginPointerLockUnlockWhileOpen();
    endPointerLockUnlockWhileOpen();

    assert.equal(throwCalls, 2);
    assert.equal(safeCalls, 2);

    unsubThrow();
    unsubSafe();
  });
});
