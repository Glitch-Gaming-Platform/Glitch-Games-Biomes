/// <reference types="mocha" />

import assert from "assert";
import { PointerLockManager } from "./PointerLockContext";

function withDocument<T>(
  documentValue: {
    activeElement?: unknown;
    pointerLockElement?: unknown;
    exitPointerLock?: () => void;
  },
  fn: () => T
): T {
  const previous = (globalThis as any).document;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: documentValue,
  });
  try {
    return fn();
  } finally {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: previous,
    });
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

describe("PointerLockManager HUD input recovery", () => {
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
