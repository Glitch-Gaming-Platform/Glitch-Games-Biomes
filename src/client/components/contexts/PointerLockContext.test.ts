/// <reference types="mocha" />

import assert from "assert";
import { PointerLockManager, shouldUsePointerLock } from "./PointerLockContext";

function withDocument<T>(
  documentValue: {
    activeElement?: unknown;
    pointerLockElement?: unknown;
    exitPointerLock?: () => void;
  },
  fn: () => T
): T {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value: documentValue,
  });
  try {
    return fn();
  } finally {
    if (previous) {
      Object.defineProperty(globalThis, "document", previous);
    } else {
      delete (globalThis as any).document;
    }
  }
}

function managerForCanvas(canvas: unknown) {
  const manager = Object.create(
    PointerLockManager.prototype
  ) as PointerLockManager;
  manager.lockElementRef = { current: canvas as HTMLCanvasElement };
  manager.deadZone = 0;
  return manager;
}

function withWindowAndNavigator<T>(
  windowValue: unknown,
  navigatorValue: unknown,
  fn: () => T
): T {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator"
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: windowValue,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: navigatorValue,
  });
  try {
    return fn();
  } finally {
    if (previousWindow) {
      Object.defineProperty(globalThis, "window", previousWindow);
    } else {
      delete (globalThis as any).window;
    }
    if (previousNavigator) {
      Object.defineProperty(globalThis, "navigator", previousNavigator);
    } else {
      delete (globalThis as any).navigator;
    }
  }
}

describe("PointerLockManager HUD input recovery", () => {
  it("never requires Pointer Lock on a touch device", () => {
    withDocument(
      {
        exitPointerLock() {},
      },
      () =>
        withWindowAndNavigator(
          { ontouchstart() {} },
          { maxTouchPoints: 1 },
          () => assert.equal(shouldUsePointerLock(), false)
        )
    );
  });

  it("focuses virtual-joystick gameplay without requesting Pointer Lock", () => {
    let focusCalls = 0;
    let pointerLockCalls = 0;
    const canvas = {
      focus: () => {
        focusCalls += 1;
      },
      requestPointerLock: () => {
        pointerLockCalls += 1;
      },
    };
    withDocument(
      {
        activeElement: undefined,
        pointerLockElement: undefined,
        exitPointerLock() {},
      },
      () => {
        const manager = managerForCanvas(canvas);
        (manager as any).pointerLockDisabled = true;
        manager.focusAndLock();
      }
    );
    assert.equal(focusCalls, 1);
    assert.equal(pointerLockCalls, 0);
  });

  it("allows HUD interaction keys when pointer locked even if the canvas is not activeElement", () => {
    const canvas = { tagName: "CANVAS" };
    const body = { tagName: "BODY" };
    withDocument(
      {
        activeElement: body,
        pointerLockElement: canvas,
      },
      () => {
        const manager = managerForCanvas(canvas);
        assert.equal(manager.isLocked(), true);
        assert.equal(manager.isFocused(), false);
        assert.equal(manager.allowHUDInput(), true);
      }
    );
  });

  it("still allows HUD interaction keys when the canvas is focused but not pointer locked", () => {
    const canvas = { tagName: "CANVAS" };
    withDocument(
      {
        activeElement: canvas,
        pointerLockElement: undefined,
      },
      () => {
        const manager = managerForCanvas(canvas);
        assert.equal(manager.isLocked(), false);
        assert.equal(manager.isFocused(), true);
        assert.equal(manager.allowHUDInput(), true);
      }
    );
  });

  it("does not allow HUD interaction keys while neither locked nor focused", () => {
    const canvas = { tagName: "CANVAS" };
    const input = { tagName: "INPUT" };
    withDocument(
      {
        activeElement: input,
        pointerLockElement: undefined,
      },
      () => {
        const manager = managerForCanvas(canvas);
        assert.equal(manager.isLocked(), false);
        assert.equal(manager.isFocused(), false);
        assert.equal(manager.allowHUDInput(), false);
      }
    );
  });
});
