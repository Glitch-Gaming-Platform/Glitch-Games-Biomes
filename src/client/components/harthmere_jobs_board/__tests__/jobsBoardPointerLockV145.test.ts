/// <reference types="mocha" />

import assert from "assert";
import {
  closeHarthmereJobsBoardPointerLockV145,
  openHarthmereJobsBoardPointerLockV145,
} from "../jobsBoardPointerLockV145";

function fakePointerLockManager(locked: boolean) {
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

describe("Harthmere jobs board pointer lock lifecycle", () => {
  it("shows the cursor on open and restores pointer lock only when it owned the unlock", () => {
    const manager = fakePointerLockManager(true);
    const shouldReturn = { current: false };

    openHarthmereJobsBoardPointerLockV145(manager, shouldReturn);
    assert.equal(manager.unlocks, 1);
    assert.equal(manager.locked, false);
    assert.equal(shouldReturn.current, true);

    closeHarthmereJobsBoardPointerLockV145(manager, shouldReturn);
    assert.equal(manager.locks, 1);
    assert.equal(manager.locked, true);
    assert.equal(shouldReturn.current, false);

    closeHarthmereJobsBoardPointerLockV145(manager, shouldReturn);
    assert.equal(manager.locks, 1, "closing twice must not re-lock twice");
  });

  it("does not unexpectedly capture the cursor when opened while already unlocked", () => {
    const manager = fakePointerLockManager(false);
    const shouldReturn = { current: true };

    openHarthmereJobsBoardPointerLockV145(manager, shouldReturn);
    assert.equal(manager.unlocks, 1);
    assert.equal(shouldReturn.current, false);

    closeHarthmereJobsBoardPointerLockV145(manager, shouldReturn);
    assert.equal(manager.locks, 0);
    assert.equal(manager.locked, false);
  });

  it("resets ownership across repeated open and close cycles", () => {
    const manager = fakePointerLockManager(true);
    const shouldReturn = { current: false };

    openHarthmereJobsBoardPointerLockV145(manager, shouldReturn);
    closeHarthmereJobsBoardPointerLockV145(manager, shouldReturn);

    manager.locked = false;
    openHarthmereJobsBoardPointerLockV145(manager, shouldReturn);
    closeHarthmereJobsBoardPointerLockV145(manager, shouldReturn);

    assert.equal(manager.unlocks, 2);
    assert.equal(manager.locks, 1);
    assert.equal(shouldReturn.current, false);
  });
});
