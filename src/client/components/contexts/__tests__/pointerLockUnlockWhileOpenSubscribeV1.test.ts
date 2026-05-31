/// <reference types="mocha" />
/// <reference types="node" />

// HARTHMERE_UI_V147: tests for the subscriber mechanism that lets the
// EscGameMenu (and any other React surface) react to "unlock-while-open"
// panels — Jobs Board, Home Console, Business Interface, Crafting Station —
// opening and closing. The fix prevents the "Return to Game" / "Give
// Feedback" overlay from appearing on top of those panels.

import assert from "assert";
import {
  beginPointerLockUnlockWhileOpenV1,
  closePointerLockUnlockWhileOpenV1,
  endPointerLockUnlockWhileOpenV1,
  isPointerLockUnlockWhileOpenActiveV1,
  openPointerLockUnlockWhileOpenV1,
  subscribePointerLockUnlockWhileOpenV1,
  type PointerLockUnlockWhileOpenManagerV1,
  type PointerLockUnlockWhileOpenReturnRefV1,
} from "../pointerLockModalPolicy";

function fakeManager(locked: boolean): PointerLockUnlockWhileOpenManagerV1 & {
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

function drainDepthV147() {
  // Some other test in the same file may have left the global depth counter
  // non-zero; pop it back to 0 before measuring. The counter is process-wide.
  while (isPointerLockUnlockWhileOpenActiveV1()) {
    endPointerLockUnlockWhileOpenV1();
  }
}

describe("pointerLockModalPolicy unlock-while-open subscribers (V147)", () => {
  beforeEach(() => {
    drainDepthV147();
  });

  it("notifies subscribers on begin and end and reports the new active flag", () => {
    const events: boolean[] = [];
    const unsubscribe = subscribePointerLockUnlockWhileOpenV1(() => {
      events.push(isPointerLockUnlockWhileOpenActiveV1());
    });

    beginPointerLockUnlockWhileOpenV1();
    beginPointerLockUnlockWhileOpenV1();
    endPointerLockUnlockWhileOpenV1();
    endPointerLockUnlockWhileOpenV1();

    assert.deepEqual(events, [true, true, true, false]);
    assert.equal(isPointerLockUnlockWhileOpenActiveV1(), false);

    unsubscribe();
  });

  it("does not fire a transition when end is called with depth already at zero", () => {
    const events: boolean[] = [];
    const unsubscribe = subscribePointerLockUnlockWhileOpenV1(() => {
      events.push(isPointerLockUnlockWhileOpenActiveV1());
    });

    endPointerLockUnlockWhileOpenV1();
    endPointerLockUnlockWhileOpenV1();

    assert.deepEqual(events, []);

    unsubscribe();
  });

  it("stops notifying after unsubscribe", () => {
    let calls = 0;
    const unsubscribe = subscribePointerLockUnlockWhileOpenV1(() => {
      calls += 1;
    });

    beginPointerLockUnlockWhileOpenV1();
    assert.equal(calls, 1);

    unsubscribe();

    endPointerLockUnlockWhileOpenV1();
    beginPointerLockUnlockWhileOpenV1();
    endPointerLockUnlockWhileOpenV1();
    assert.equal(calls, 1);
  });

  it("notifies when a subscriber unsubscribes itself during a callback", () => {
    let firstCalls = 0;
    let secondCalls = 0;
    let unsubFirst = () => {};
    let unsubSecond = () => {};

    unsubFirst = subscribePointerLockUnlockWhileOpenV1(() => {
      firstCalls += 1;
      unsubFirst();
    });
    unsubSecond = subscribePointerLockUnlockWhileOpenV1(() => {
      secondCalls += 1;
    });

    beginPointerLockUnlockWhileOpenV1();
    endPointerLockUnlockWhileOpenV1();

    assert.equal(firstCalls, 1, "first subscriber should fire exactly once before self-unsubscribing");
    assert.equal(secondCalls, 2, "second subscriber should fire on begin and end");

    unsubSecond();
  });

  it("integrates with openPointerLockUnlockWhileOpenV1 / close to round-trip the active flag", () => {
    const transitions: boolean[] = [];
    const unsubscribe = subscribePointerLockUnlockWhileOpenV1(() => {
      transitions.push(isPointerLockUnlockWhileOpenActiveV1());
    });

    const manager = fakeManager(true);
    const shouldReturn: PointerLockUnlockWhileOpenReturnRefV1 = { current: false };

    openPointerLockUnlockWhileOpenV1(manager, shouldReturn);
    assert.equal(isPointerLockUnlockWhileOpenActiveV1(), true);

    // Calling open a second time on the same ref must not increment the depth.
    openPointerLockUnlockWhileOpenV1(manager, shouldReturn);
    assert.equal(isPointerLockUnlockWhileOpenActiveV1(), true);

    closePointerLockUnlockWhileOpenV1(manager, shouldReturn);
    assert.equal(isPointerLockUnlockWhileOpenActiveV1(), false);

    // Idempotent close.
    closePointerLockUnlockWhileOpenV1(manager, shouldReturn);
    assert.equal(isPointerLockUnlockWhileOpenActiveV1(), false);

    assert.deepEqual(transitions, [true, false]);
    unsubscribe();
  });

  it("keeps subscribers isolated — one subscriber's throw does not silence others", () => {
    let throwCalls = 0;
    let safeCalls = 0;
    const unsubThrow = subscribePointerLockUnlockWhileOpenV1(() => {
      throwCalls += 1;
      throw new Error("intentional");
    });
    const unsubSafe = subscribePointerLockUnlockWhileOpenV1(() => {
      safeCalls += 1;
    });

    beginPointerLockUnlockWhileOpenV1();
    endPointerLockUnlockWhileOpenV1();

    assert.equal(throwCalls, 2);
    assert.equal(safeCalls, 2);

    unsubThrow();
    unsubSafe();
  });
});
