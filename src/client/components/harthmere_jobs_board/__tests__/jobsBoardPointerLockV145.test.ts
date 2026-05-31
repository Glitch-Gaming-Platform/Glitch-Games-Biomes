/// <reference types="mocha" />

import assert from "assert";
import {
  hasPointerLockUnlockWhileOpenSurfaceV1,
  isPointerLockUnlockWhileOpenActiveV1,
  POINTER_LOCK_UNLOCK_WHILE_OPEN_SELECTOR_V1,
} from "@/client/components/contexts/pointerLockModalPolicy";
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
    assert.equal(isPointerLockUnlockWhileOpenActiveV1(), true);

    closeHarthmereJobsBoardPointerLockV145(manager, shouldReturn);
    assert.equal(manager.locks, 1);
    assert.equal(manager.locked, true);
    assert.equal(shouldReturn.current, false);
    assert.equal(isPointerLockUnlockWhileOpenActiveV1(), false);

    closeHarthmereJobsBoardPointerLockV145(manager, shouldReturn);
    assert.equal(manager.locks, 1, "closing twice must not re-lock twice");
    assert.equal(isPointerLockUnlockWhileOpenActiveV1(), false);
  });

  it("does not unexpectedly capture the cursor when opened while already unlocked", () => {
    const manager = fakePointerLockManager(false);
    const shouldReturn = { current: true };

    openHarthmereJobsBoardPointerLockV145(manager, shouldReturn);
    assert.equal(manager.unlocks, 1);
    assert.equal(shouldReturn.current, false);
    assert.equal(isPointerLockUnlockWhileOpenActiveV1(), true);

    closeHarthmereJobsBoardPointerLockV145(manager, shouldReturn);
    assert.equal(manager.locks, 0);
    assert.equal(manager.locked, false);
    assert.equal(isPointerLockUnlockWhileOpenActiveV1(), false);
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
    assert.equal(isPointerLockUnlockWhileOpenActiveV1(), false);
  });

  it("keeps one suppression policy open for repeated opens of the same board", () => {
    const manager = fakePointerLockManager(true);
    const shouldReturn = { current: false };

    openHarthmereJobsBoardPointerLockV145(manager, shouldReturn);
    openHarthmereJobsBoardPointerLockV145(manager, shouldReturn);
    assert.equal(manager.unlocks, 2);
    assert.equal(isPointerLockUnlockWhileOpenActiveV1(), true);

    closeHarthmereJobsBoardPointerLockV145(manager, shouldReturn);
    assert.equal(isPointerLockUnlockWhileOpenActiveV1(), false);
    assert.equal(manager.locks, 1);
  });

  it("marks BiomesUI-style unlock surfaces as suppressing the pause menu", () => {
    const root = {
      querySelector(selector: string) {
        return selector === POINTER_LOCK_UNLOCK_WHILE_OPEN_SELECTOR_V1
          ? { nodeType: 1 }
          : null;
      },
    };
    const emptyRoot = {
      querySelector() {
        return null;
      },
    };

    assert.equal(hasPointerLockUnlockWhileOpenSurfaceV1(root as any), true);
    assert.equal(hasPointerLockUnlockWhileOpenSurfaceV1(emptyRoot as any), false);
  });
});
